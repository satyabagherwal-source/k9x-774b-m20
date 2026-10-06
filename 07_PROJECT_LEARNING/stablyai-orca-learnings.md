# Forensic Learning Record (Deep Inspection): stablyai/orca

> **Canonical Artifact**: `07_PROJECT_LEARNING/stablyai-orca-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/stablyai/orca](https://github.com/stablyai/orca))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:50:47.288Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `stablyai/orca`
- **Description**: Orca is the ADE for working with a fleet of parallel agents. Run any coding agent with your own subscription. Available on desktop, mobile and remote runtime.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 85989 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cloud/apps/push/src/durable-push-worker.ts`
```
import { buildPushDelivery } from './push-delivery-message.js'
import type { PushDispatcher } from './push-dispatcher.js'
import type { DurablePushStore } from './durable-push-store.js'
import { WORKER_DRAINS } from './push-worker-concurrency.js'

export class DurablePushWorker {
  private timer?: NodeJS.Timeout
  private running: Promise<void> | null = null
  private stopped = false
  constructor(
    private readonly store: DurablePushStore,
    private readonly dispatcher: PushDispatcher,
    private readonly options: { now?: () => number; onRetry?: () => void } = {}
  ) {}

  start(): void {
    if (this.timer) return
    this.stopped = false
    this.timer = setInterval(() => {
      void this.runDue().catch(() => {
        console.warn(JSON.stringify({ event: 'orca_push_worker_failed' }))
      })
    }, 1000)
    this.timer.unref()
  }

  async runDue(): Promise<void> {
    if (this.running) {
      await this.running
      return
    }
    if (this.stopped) return
    const drains = Array.from({ length: WORKER_DRAINS }, () => this.drain())
    const pending = Promise.allSettled(drains).then(
      (results) => {
        const failure = results.find((result) => result.status === 'rejected')
        if (failure?.status === 'rejected') throw failure.reason
      }
    )
    this.running = pending
    try {
      await pending
    } finally {
      this.running = null
    }
  }

  private async drain(): Promise<void> {
    for (let count = 0; count < 25 && !this.stopped; count++) {
      const queued = await this.store.claim()
      if (!queued) return
      const delivery = buildPushDelivery({
        expiresAt: queued.expiresAt,
        registrationId: queued.registrationId,
        hostFingerprint: queued.hostFingerprint,
        notification: queued.notification
      })
      if ((this.options.now ?? Date.now)() >= queued.expiresAt) {
        await this.store.finish(queued)
        continue
      }
      const heartbeat = setInterval(() => {
        void this.store.renew(queued).catch(() => {})
      }, 10_000)
      heartbeat.unref()
      try {
        if (queued.attempts > 1) this.options.onRetry?.()
        const outcome = await this.dispatcher.sendOnce(delivery)
        const retryAfterMs =
          outcome.status === 'error' && outcome.retryable
            ? Math.max(
                outcome.retryAfterMs ?? 0,
                Math.min(30_000, 1000 * 2 ** Math.min(queued.attempts, 5))
              )
            : undefined
        await this.store.finish(queued, retryAfterMs)
      } catch {
        await this.store.finish(queued, 5000)
      } finally {
        clearInterval(heartbeat)
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    await this.running
  }
}

```

### Core Architecture Module: `cloud/apps/push/src/push-queued-dismissal.ts`
```
import type { PushNotification } from '@orca-cloud/push-contract'
import type { PushDatabase } from './push-database.js'
import { parsePushDeliveryPayload } from './push-delivery-payload.js'

export async function reconcileQueuedDismissal(
  tx: PushDatabase,
  host: string,
  registrationId: string,
  notification: PushNotification,
  now: number
): Promise<boolean> {
  if (!notification.notificationId) return false
  const key = [host, notification.notificationEpoch, notification.notificationId]
  const [dismissed] = await tx.query(
    'SELECT notification_seq FROM push_dismissed_events WHERE host_fingerprint = ? AND notification_epoch = ? AND notification_id = ?',
    key
  )
  if (notification.kind !== 'dismiss')
    return Number(dismissed?.notification_seq ?? -1) >= notification.notificationSeq
  await tx.query(
    `INSERT INTO push_dismissed_events(host_fingerprint, notification_epoch, notification_id, notification_seq, created_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(host_fingerprint, notification_epoch, notification_id)
    DO UPDATE SET notification_seq = CASE WHEN push_dismissed_events.notification_seq > excluded.notification_seq THEN push_dismissed_events.notification_seq ELSE excluded.notification_seq END, created_at = excluded.created_at`,
    [...key, notification.notificationSeq, now]
  )
  const deliveries = await tx.query(
    "SELECT batch_id, payload_json FROM push_delivery_batches WHERE host_fingerprint = ? AND registration_id = ? AND kind = 'alert' AND state = 'pending' AND lease_until <= ?",
    [host, registrationId, now]
  )
  for (const delivery of deliveries) {
    const queued = parsePushDeliveryPayload(String(delivery.payload_json))
    if (
      queued.notificationEpoch !== notification.notificationEpoch ||
      queued.notificationId !== notification.notificationId ||
      queued.notificationSeq > notification.notificationSeq
    )
      continue
    // The lease guard re-evaluates after a concurrent claim commits; that alert then goes out and
    // this dismissal is delivered after it.
    await tx.query(
      "DELETE FROM push_delivery_batches WHERE batch_id = ? AND state = 'pending' AND lease_until <= ?",
      [delivery.batch_id, now]
    )
  }
  return false
}

export async function isDismissedAlert(
  tx: PushDatabase,
  host: string,
  notification: PushNotification
): Promise<boolean> {
  if (notification.kind === 'dismiss' || !notification.notificationId) return false
  const rows = await tx.query(
    'SELECT notification_seq FROM push_dismissed_events WHERE host_fingerprint = ? AND notification_epoch = ? AND notification_id = ?',
    [host, notification.notificationEpoch, notification.notificationId]
  )
  return Number(rows[0]?.notification_seq ?? -1) >= notification.notificationSeq
}

```

### Core Architecture Module: `cloud/apps/push/src/push-worker-concurrency.ts`
```
// Twelve drains lift the ~30/s ceiling four drains hit at ~120 ms per item; each drain holds one
// delivery in flight, so this is the worker's concurrency, not its database draw.
export const WORKER_DRAINS = 12

```

### Core Architecture Module: `cloud/apps/relay/src/assignment-identity-queue.ts`
```
export type AssignmentIdentity = {
  userId: string
  relayHostId: string
}

export class AssignmentIdentityQueue {
  private readonly tails = new Map<string, Promise<void>>()

  async run<T>(identity: AssignmentIdentity, operation: () => Promise<T>): Promise<T> {
    const key = JSON.stringify([identity.userId, identity.relayHostId])
    const previous = this.tails.get(key) ?? Promise.resolve()
    const result = previous.catch(() => undefined).then(operation)
    const tail = result.then(
      () => undefined,
      () => undefined
    )
    this.tails.set(key, tail)
    try {
      return await result
    } finally {
      if (this.tails.get(key) === tail) this.tails.delete(key)
    }
  }
}

```

### Core Architecture Module: `cloud/apps/relay/src/control-renewal-statement.ts`
```
import type { AssignmentIdentity } from './assignment-identity-queue.js'
import type { SqlRow } from './database.js'

export type ControlRenewalOutcome =
  | 'renewed'
  | 'assignment_not_found'
  | 'activity_cell_not_authoritative'
  | 'control_activity_not_found'
  | 'control_activity_moved'
  // The host's assignment row was already locked by one of the per-host
  // transactional paths. Retryable, and never a reason to close a control: the
  // next tick is 15s away and the lease has 105s on it.
  | 'assignment_lock_unavailable'
  // Decided per row before the statement runs, so one malformed request cannot
  // cost the rest of the batch its renewal.
  | 'invalid_activity_id'
  | 'invalid_activity_expiry'
  | 'database_error'

// Outcomes the statement itself can report. `database_error` is raised by the
// driver, and `invalid_activity_expiry` is decided per row before the statement
// is built, so neither can come back as a row.
export const CONTROL_RENEWAL_STATEMENT_OUTCOMES = new Set<ControlRenewalOutcome>([
  'renewed',
  'assignment_not_found',
  'activity_cell_not_authoritative',
  'control_activity_not_found',
  'control_activity_moved',
  'assignment_lock_unavailable'
])

export type ControlRenewalRequest = {
  identity: AssignmentIdentity
  activityId: string
  cellId: string
  expiresAt: number
}

// LOCK ORDER - (user_id, relay_host_id), the primary key of relay_assignments,
// applied here and repeated as the statement's ORDER BY so it holds whether the
// planner walks the primary-key index or sorts under the LockRows node.
//
// The batch never waits for an assignment row: SKIP LOCKED reports a contended
// host separately instead. That is what bounds how long a flush holds its locks
// to its own execution time, because row locks live until the statement commits,
// and it is why one host wedged in a per-host transaction cannot stall the
// renewals of every other host sharing the flush.
//
// With no wait on the assignment pass, the deadlock question reduces to the two
// later passes. Every writer in this store locks a host's assignment row before
// that host's lease rows (`assignmentRow` then `lockAssignmentActivities`), and
// a host whose assignment row is held was skipped, so the batch never reaches
// that host's lease: the lease pass cannot wait either.
// `markMigrationTargetRegistered` is the one writer that locks a migration row
// without the assignment row first. It takes no further locks, so it can delay a
// mid-migration row by up to the pool's lock_timeout but cannot close a cycle.
export function orderedControlRenewalRows<Row extends { identity: AssignmentIdentity }>(
  rows: readonly Row[]
): Row[] {
  return [...rows].sort(
    (left, right) =>
      left.identity.userId.localeCompare(right.identity.userId) ||
      left.identity.relayHostId.localeCompare(right.identity.relayHostId)
  )
}

// One statement renewing every due control lease on this cell, row-wise over the
// unnested parameter arrays. Logic per row is what the single-row predecessor
// did: lock the assignment, admit the caller's cell either as the current cell or
// as the source of an active forward migration, lock that host's control lease,
// push both expiries forward, and report one outcome. The one addition is
// `present_assignment`, an unlocked probe that separates a host with no
// assignment row at all from one whose row SKIP LOCKED passed over - the first
// closes the control, the second retries.
export const CONTROL_RENEWAL_BATCH_SQL = `WITH renewal_input AS MATERIALIZED (
           SELECT
             renewal.ordinality AS row_index,
             renewal.user_id,
             renewal.relay_host_id,
             renewal.activity_id,
             renewal.cell_id,
             renewal.expires_at
           FROM unnest(?::text[], ?::text[], ?::text[], ?::text[], ?::bigint[])
             WITH ORDINALITY AS renewal(
               user_id, relay_host_id, activity_id, cell_id, expires_at, ordinality
             )
         ), present_assignment AS MATERIALIZED (
           SELECT input.row_index
           FROM renewal_input input
           JOIN relay_assignments assignment
             ON assignment.user_id = input.user_id
            AND assignment.relay_host_id = input.relay_host_id
         ), assignment_state AS MATERIALIZED (
           SELECT input.row_index, assignment.cell_id, assignment.assignment_epoch
           FROM renewal_input input
           JOIN relay_assignments assignment
             ON assignment.user_id = input.user_id
            AND assignment.relay_host_id = input.relay_host_id
           ORDER BY assignment.user_id, assignment.relay_host_id
           FOR UPDATE OF assignment SKIP LOCKED
         ), migration_state AS MATERIALIZED (
           SELECT locked.row_index
           FROM assignment_state locked
           JOIN renewal_input input ON input.row_index = locked.row_index
           JOIN relay_assignment_migrations migration
             ON migration.user_id = input.user_id
            AND migration.relay_host_id = input.relay_host_id
            AND migration.source_cell_id = input.cell_id
            AND migration.target_cell_id = locked.cell_id
            AND migration.assignment_epoch = locked.assignment_epoch
            AND migration.completed_at IS NULL AND migration.aborted_at IS NULL
           ORDER BY migration.user_id, migration.relay_host_id
           FOR UPDATE OF migration
         ), authorization_state AS MATERIALIZED (
           SELECT locked.row_index
           FROM assignment_state locked
           JOIN renewal_input input ON input.row_index = locked.row_index
           WHERE locked.cell_id = input.cell_id
              OR EXISTS (
                SELECT 1 FROM migration_state moving
                WHERE moving.row_index = locked.row_index
              )
         ), lease_state AS MATERIALIZED (
           SELECT authorized.row_index, lease.activity_kind, lease.cell_id
           FROM authorization_state authorized
           JOIN renewal_input input ON input.row_index = authorized.row_index
           JOIN relay_assignment_activity_leases lease
             ON lease.user_id = input.user_id
            AND lease.relay_host_id = input.relay_host_id
            AND lease.activity_id = input.activity_id
           ORDER BY lease.user_id, lease.relay_host_id, lease.activity_id
           FOR UPDATE OF lease
         ), renewed_lease AS (
           UPDATE relay_assignment_activity_leases lease
           SET expires_at = GREATEST(lease.expires_at, input.expires_at),
               updated_at = GREATEST(lease.updated_at, ?)
           FROM lease_state state
           JOIN renewal_input input ON input.row_index = state.row_index
           WHERE lease.user_id = input.user_id
             AND lease.relay_host_id = input.relay_host_id
             AND lease.activity_id = input.activity_id
             AND state.activity_kind = 'control' AND state.cell_id = input.cell_id
           RETURNING state.row_index
         ), renewed_assignment AS (
           -- Grouped per host: an UPDATE whose FROM offers a target row more than
           -- once applies one source row and returns one, so two leases on one
           -- host would leave the assignment carrying the wrong expiry. The
           -- aggregate hands it exactly one row, carrying the later expiry.
           UPDATE relay_assignments assignment
           SET lease_expires_at = GREATEST(assignment.lease_expires_at, renewed.expires_at),
               last_activity_at = GREATEST(assignment.last_activity_at, ?)
           FROM (
             SELECT input.user_id, input.relay_host_id, MAX(input.expires_at) AS expires_at
             FROM renewed_lease renewed
             JOIN renewal_input input ON input.row_index = renewed.row_index
             GROUP BY input.user_id, input.relay_host_id
           ) renewed
           WHERE assignment.user_id = renewed.user_id
             AND assignment.relay_host_id = renewed.relay_host_id
           RETURNING renewed.user_id
         )
         SELECT input.row_index, CASE
           WHEN NOT EXISTS (
             SELECT 1 FROM present_assignment present
             WHERE present.row_index = input.row_index
           ) THEN 'assignment_not_found'
           WHEN NOT EXISTS (
             SELECT 1 FROM assignment_state locked WHERE locked.row_index = input.row_index
           ) THEN 'assignment_lock_unavailable'
           WHEN NOT EXISTS (
             SELECT 1 FROM authorization_state authorized
             WHERE authorized.row_index = input.row_index
           ) THEN 'activity_cell_not_authoritative'
           WHEN NOT EXISTS (
             SELECT 1 FROM lease_state state WHERE state.row_index = input.row_index
           ) THEN 'control_activity_not_found'
           WHEN EXISTS (
             SELECT 1 FROM lease_state state
             WHERE state.row_index = input.row_index
               AND (state.activity_kind <> 'control' OR state.cell_id <> input.cell_id)
           ) THEN 'control_activity_moved'
           -- Read from renewed_lease, which has one row per input row. The
           -- assignment update collapses to one row per host, so it cannot answer
           -- for a host that brought two leases to the same batch.
           WHEN EXISTS (
             SELECT 1 FROM renewed_lease renewed
             WHERE renewed.row_index = input.row_index
           ) THEN 'renewed'
           ELSE 'control_activity_not_found'
         END AS outcome
         FROM renewal_input input
         ORDER BY input.row_index`

export function controlRenewalBatchParams(
  rows: readonly ControlRenewalRequest[],
  now: number
): unknown[] {
  return [
    rows.map((row) => row.identity.userId),
    rows.map((row) => row.identity.relayHostId),
    rows.map((row) => row.activityId),
    rows.map((row) => row.cellId),
    rows.map((row) => row.expiresAt),
    now,
    now
  ]
}

// Rows come back ordered by row_index, which is the 1-based position in 
```

### Core Architecture Module: `cloud/apps/relay/src/postgres-statement-stats.ts`
```
// Expose an already-running collector; never preload a module or require elevated runtime privileges.
export const POSTGRES_STATEMENT_STATS_MIGRATION = `
DO $relay_statement_stats$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_settings
    WHERE name = 'shared_preload_libraries'
      AND 'pg_stat_statements' = ANY(string_to_array(replace(setting, ' ', ''), ','))
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_stat_statements'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_available_extensions WHERE name = 'pg_stat_statements'
  ) THEN
    RETURN;
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('orca-relay'), hashtext('statement-stats')) THEN
    RETURN;
  END IF;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE WARNING 'orca_relay_statement_stats_unavailable: insufficient privilege';
  END;
END
$relay_statement_stats$;
`

```

### Core Architecture Module: `cloud/apps/relay/src/region-correction-state.ts`
```
import { relayHostLogDigest } from './relay-host-log-digest.js'
import { createHash } from 'node:crypto'
import type {
  RegionCorrectionRequest,
  RegionCorrectionResponse,
  RelayRegion
} from '@orca-cloud/relay-contract'
import type { RelayDatabase } from './database.js'

type Identity = { userId: string; relayHostId: string }
export const REGION_DECISION_TTL_MS = 24 * 60 * 60_000
export const REGIONAL_REHOME_CONCURRENT_LIMIT = 8

export async function exchangeRegionCorrection(
  database: RelayDatabase,
  identity: Identity,
  request: RegionCorrectionRequest,
  assignmentEpoch: number,
  now: number
): Promise<RegionCorrectionResponse> {
  const result: RegionCorrectionResponse = await database.transaction(async (transaction) => {
    const assignment = (
      await transaction.queryLocked(
        `SELECT * FROM relay_assignments WHERE user_id = ? AND relay_host_id = ?`,
        [identity.userId, identity.relayHostId]
      )
    )[0]
    const region =
      assignment &&
      (
        await transaction.query(`SELECT region FROM relay_cell_regions WHERE cell_id = ?`, [
          assignment.cell_id
        ])
      )[0]
    if (!assignment || !region || Number(assignment.assignment_epoch) !== assignmentEpoch) {
      return { v: 1, reportStatus: 'basis-changed' }
    }
    const prior = (
      await transaction.queryLocked(
        `SELECT * FROM relay_region_decisions WHERE user_id = ? AND relay_host_id = ?`,
        [identity.userId, identity.relayHostId]
      )
    )[0]
    if (request.action === 'issue-window') {
      const generation = Number(prior?.generation ?? 0) + 1
      if (!Number.isSafeInteger(generation)) throw new Error('region_generation_exhausted')
      const expiresAt = now + REGION_DECISION_TTL_MS
      const cohortBucket =
        createHash('sha256')
          .update(JSON.stringify([identity.userId, identity.relayHostId]))
          .digest()
          .readUInt32BE(0) % 100
      await transaction.query(
        `INSERT INTO relay_region_decisions
         (user_id, relay_host_id, generation, expires_at, assignment_epoch, incumbent_region,
          policy_version, outcome, preferred_region, observed_at, report_json, cohort_bucket)
         VALUES (?, ?, ?, ?, ?, ?, 1, 'pending', NULL, ?, NULL, ?)
         ON CONFLICT (user_id, relay_host_id) DO UPDATE SET
           generation = excluded.generation, expires_at = excluded.expires_at,
           assignment_epoch = excluded.assignment_epoch, incumbent_region = excluded.incumbent_region,
           policy_version = 1, outcome = 'pending', preferred_region = NULL,
           observed_at = excluded.observed_at, report_json = NULL, cohort_bucket = excluded.cohort_bucket`,
        [
          identity.userId,
          identity.relayHostId,
          generation,
          expiresAt,
          assignmentEpoch,
          region.region,
          now,
          cohortBucket
        ]
      )
      return {
        v: 1,
        window: {
          generation,
          expiresAt,
          assignmentEpoch,
          incumbentRegion: region.region as RelayRegion,
          policyVersion: 1
        }
      }
    }
    if (!prior || Number(prior.generation) !== request.generation)
      return { v: 1, reportStatus: 'stale' }
    if (Number(prior.policy_version) !== request.policyVersion)
      return { v: 1, reportStatus: 'stale' }
    if (Number(prior.expires_at) <= now) return { v: 1, reportStatus: 'expired' }
    if (
      request.assignmentEpoch !== assignmentEpoch ||
      Number(prior.assignment_epoch) !== assignmentEpoch ||
      prior.incumbent_region !== region.region
    ) {
      return { v: 1, reportStatus: 'basis-changed' }
    }
    // The first report wins, including an inconclusive tombstone.
    if (prior.outcome !== 'pending') return { v: 1, reportStatus: 'duplicate' }
    let preferredRegion: RelayRegion | null = null
    if (request.outcome === 'conclusive') {
      const incumbent = request.measurements[region.region as RelayRegion]
      const target: RelayRegion = region.region === 'us-central1' ? 'asia-east2' : 'us-central1'
      const targetRtt = request.measurements[target]
      if (incumbent - targetRtt >= 25 && targetRtt <= incumbent * 0.8) preferredRegion = target
    }
    await transaction.query(
      `UPDATE relay_region_decisions SET outcome = ?, preferred_region = ?, report_json = ?
       WHERE user_id = ? AND relay_host_id = ? AND generation = ?`,
      [
        request.outcome,
        preferredRegion,
        JSON.stringify(request),
        identity.userId,
        identity.relayHostId,
        request.generation
      ]
    )
    return { v: 1, reportStatus: 'accepted' }
  })
  if (request.action === 'report' && result.reportStatus === 'accepted') {
    const digest = relayHostLogDigest(identity.relayHostId)
    // Stable sampling includes unchanged hosts for before/after comparisons.
    if (Number.parseInt(digest.slice(0, 8), 16) % 10 === 0) {
      console.log(
        JSON.stringify({
          event: 'orca_relay_region_comparison',
          relayHostIdDigest: digest,
          assignmentEpoch,
          generation: request.generation,
          policyVersion: request.policyVersion,
          outcome: request.outcome,
          ...(request.outcome === 'conclusive' ? { measurements: request.measurements } : {})
        })
      )
    }
  }
  return result
}

export async function previewRegionCorrection(
  database: RelayDatabase,
  now: number
): Promise<Record<string, number>> {
  const rows = await database.query(
    `SELECT CASE WHEN decision.expires_at <= ? THEN 'expired'
       WHEN decision.assignment_epoch <> assignment.assignment_epoch THEN 'basis-changed'
       WHEN decision.outcome = 'pending' THEN 'pending'
       WHEN decision.preferred_region IS NULL THEN 'ineligible'
       ELSE decision.incumbent_region || '-to-' || decision.preferred_region END AS reason,
       COUNT(*) AS count
     FROM relay_region_decisions decision
     JOIN relay_assignments assignment ON assignment.user_id = decision.user_id
       AND assignment.relay_host_id = decision.relay_host_id
     GROUP BY reason`,
    [now]
  )
  return Object.fromEntries(rows.map((row) => [String(row.reason), Number(row.count)]))
}

```

### Core Architecture Module: `cloud/apps/relay/src/regional-rehome-worker.ts`
```
import {
  IdleRegionalRehomeResponseSchema,
  isGlobalIdleRegionalRehomeDeferral
} from '@orca-cloud/relay-contract'
import type { RelayAssignmentStore } from './assignment-store.js'
import type { RelayConfig } from './config.js'
import { googleMetadataIdentityToken } from './google-metadata-identity-token.js'
import type { RegionalRehomeSafetySnapshot } from './relay-observability.js'
import { jitteredSweepIntervalMs } from './relay-sweep-schedule.js'

type RegionalRehomeWorkerOptions = {
  fetch?: typeof fetch
  identityToken?: (audience: string) => Promise<string>
  now?: () => number
  intervalMs?: number
  requestTimeoutMs?: number
  random?: () => number
  safetySnapshot?: () => RegionalRehomeSafetySnapshot
}

export type RegionalRehomeWorker = {
  run: () => Promise<void>
  stop: () => void
}

export function startRegionalRehomeWorker(
  config: RelayConfig,
  assignments: RelayAssignmentStore,
  options: RegionalRehomeWorkerOptions = {}
): RegionalRehomeWorker | null {
  if (
    config.role !== 'director' ||
    !config.rehomeAudience ||
    !config.rehomeDirectorServiceAccount ||
    !options.safetySnapshot
  ) {
    return null
  }
  const audience = config.rehomeAudience
  const safetySnapshot = options.safetySnapshot
  const fetchImpl = options.fetch ?? fetch
  const tokenProvider =
    options.identityToken ??
    ((audience: string) => googleMetadataIdentityToken(audience, fetchImpl))
  let stopped = false
  let inFlight = false
  const run = async (): Promise<void> => {
    if (stopped || inFlight) return
    inFlight = true
    try {
      const candidates = await assignments.selectIdleRegionalRehomeCandidates(safetySnapshot())
      if (candidates.length === 0) return
      const token = await tokenProvider(audience)
      const outcomes: Record<string, number> = {}
      const tally = (key: string) => {
        outcomes[key] = (outcomes[key] ?? 0) + 1
      }
      let stoppedBy: string | null = null
      for (const candidate of candidates) {
        if (stopped) break
        const { sourceCellUrl, ...request } = candidate
        try {
          const response = await fetchImpl(new URL('/v1/admin/host-idle-rehome', sourceCellUrl), {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              ...request,
              cohortPercent: config.regionCorrectionCohortPercent ?? 0,
              directorSafety: safetySnapshot()
            }),
            signal: AbortSignal.timeout(options.requestTimeoutMs ?? 10_000)
          })
          if (!response.ok) throw new Error(`regional_rehome_source_${response.status}`)
          const body = IdleRegionalRehomeResponseSchema.parse(await response.json())
          tally(body.reason ? `${body.outcome}:${body.reason}` : body.outcome)
          if (body.outcome === 'committed') {
            console.warn(
              JSON.stringify({
                event: 'orca_relay_idle_rehome_committed',
                sourceCellId: candidate.sourceCellId,
                targetCellId: candidate.targetCellId
              })
            )
            stoppedBy = 'committed'
            break
          }
          // Every remaining candidate would re-read the same durable row and
          // answer the same way, so the rest of this page is wasted POSTs.
          // A source on an older image sends no reason and keeps the old walk.
          if (body.outcome === 'deferred' && isGlobalIdleRegionalRehomeDeferral(body.reason)) {
            stoppedBy = body.reason
            break
          }
        } catch (error) {
          tally('failed')
          // The source may have committed; its durable outcome owns recovery.
          console.warn(
            JSON.stringify({
              event: 'orca_relay_idle_rehome_request_failed',
              reason: error instanceof Error ? error.message : 'unknown'
            })
          )
        }
      }
      // One line per poll that dispatched: silence used to be the only signal
      // that 100+ candidates all came back deferred.
      console.warn(
        JSON.stringify({
          event: 'orca_relay_idle_rehome_dispatch_summary',
          candidates: candidates.length,
          dispatched: Object.values(outcomes).reduce((total, count) => total + count, 0),
          stoppedBy,
          outcomes
        })
      )
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: 'orca_relay_regional_rehome_poll_failed',
          reason: error instanceof Error ? error.message : 'unknown'
        })
      )
    } finally {
      inFlight = false
    }
  }
  const timer = setInterval(
    () => void run(),
    // Match the initial ten-moves/minute budget without replanning the join every second.
    options.intervalMs ?? jitteredSweepIntervalMs(6_000, options.random)
  )
  timer.unref()
  void run()
  return {
    run,
    stop: () => {
      stopped = true
      clearInterval(timer)
    }
  }
}

```

### Core Architecture Module: `cloud/dev/scripts/relay-load-run-lifecycle.mjs`
```
export function assertRelayLoadRampAccepted(rampConnectionFailures, maximum) {
  if (rampConnectionFailures > maximum) {
    throw new Error('relay load ramp exceeded the allowed connection failures')
  }
}

export async function runRelayLoadWithShutdown(operation, shutdown) {
  try {
    return await operation()
  } finally {
    await shutdown()
  }
}

export function relayLoadRunHasDisallowedFailures(result, config) {
  return (
    result.rampConnectionFailures > config.maxRampConnectionFailures ||
    (!config.allowPlannedTransitionRetries && result.transitionConnectionFailures > 0) ||
    result.steadyConnectionFailures > 0 ||
    result.unexpectedCloses > config.maxUnexpectedCloses ||
    result.protocolErrors > 0 ||
    result.refreshErrors > 0 ||
    result.socketErrors > 0
  )
}

```

### Core Architecture Module: `cloud/dev/scripts/render-workload-identity-conditions.mjs`
```
// Renders every Workload Identity provider `attribute_condition` exactly as
// Terraform would, so contract tests can pin the resulting strings without a
// plan. Understands only the HCL subset those expressions use.
//
// Each root is loaded on its own: the relay and apps roots both declare a provider named
// `github` while the staging copy waits on its state surgery, and only separate scopes can
// show that the two render the same string.
//
// Only the relay root ships in this repository. The apps root is still declared so this stays a
// straight copy of the private original, and is skipped when its directory is absent.
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

const TERRAFORM_ROOTS = {
  relay: {
    directory: 'infra/terraform',
    sources: [
      'infra/terraform/relay-shared.tf',
      'infra/terraform/relay-github-workflow-trust.tf',
      'infra/terraform/relay-github-actions.tf',
      'infra/terraform/push-deploy-identity.tf',
      'infra/terraform/relay-staging-deploy-iam.tf',
      'infra/terraform/relay-asia-topology-iam.tf',
      'infra/terraform/relay-asia-proof-iam.tf'
    ]
  },
  apps: {
    directory: 'infra/terraform-apps',
    sources: ['infra/terraform-apps/github-actions.tf']
  }
}

export function hasTerraformRoot(root) {
  const directory = TERRAFORM_ROOTS[root]?.directory
  return directory !== undefined && existsSync(repoFile(directory))
}

export const TERRAFORM_ROOT_NAMES = Object.keys(TERRAFORM_ROOTS).filter(hasTerraformRoot)

const PROVIDER_RESOURCE = 'google_iam_workload_identity_pool_provider'

function repoFile(path) {
  return new URL(`../../${path}`, import.meta.url)
}

function skipTrivia(src, index) {
  let i = index
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i += 1
    if (src[i] === '#') {
      while (i < src.length && src[i] !== '\n') i += 1
      continue
    }
    return i
  }
}

// Returns the index just past the closing quote of the string starting at `i`.
function endOfString(src, i) {
  let cursor = i + 1
  while (src[cursor] !== '"') {
    if (src[cursor] === '\\') {
      cursor += 2
      continue
    }
    if (src[cursor] === '$' && src[cursor + 1] === '{') {
      cursor = endOfInterpolation(src, cursor + 2).next
      continue
    }
    cursor += 1
  }
  return cursor + 1
}

function endOfInterpolation(src, i) {
  let depth = 1
  let cursor = i
  while (depth > 0) {
    const char = src[cursor]
    if (char === undefined) throw new Error('unterminated interpolation')
    if (char === '"') {
      cursor = endOfString(src, cursor)
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) break
    }
    cursor += 1
  }
  return { text: src.slice(i, cursor), next: cursor + 1 }
}

// Stands in for a loop variable when the collection is empty: the body still has to be parsed
// once to find where it ends, and any attribute of the probe is another probe.
const PROBE = new Proxy(
  {},
  {
    get: (target, key) => (key === Symbol.toPrimitive ? () => '' : PROBE)
  }
)

function readMember(value, key) {
  if (value === PROBE) return PROBE
  if (value === null || value === undefined) throw new Error(`cannot read ${String(key)} of ${value}`)
  if (Array.isArray(value)) {
    if (typeof key !== 'number') throw new Error(`list index must be a number, got ${String(key)}`)
    if (!Number.isInteger(key) || key < 0 || key >= value.length) {
      throw new Error(`list index ${key} is out of range`)
    }
    return value[key]
  }
  if (typeof value !== 'object') throw new Error(`cannot index ${typeof value}`)
  if (!Object.hasOwn(value, key)) throw new Error(`unknown attribute ${String(key)}`)
  return value[key]
}

// [key, value] pairs the way HCL iterates: list index and element, or object key and value.
function collectionEntries(collection) {
  if (Array.isArray(collection)) return collection.map((item, index) => [index, item])
  if (collection && typeof collection === 'object') return Object.entries(collection)
  throw new Error(`cannot iterate ${typeof collection}`)
}

class ExpressionParser {
  constructor(source, scope) {
    this.source = source
    this.scope = scope
    this.index = 0
  }

  parse() {
    const value = this.parseTernary()
    this.index = skipTrivia(this.source, this.index)
    if (this.index !== this.source.length) {
      throw new Error(`trailing expression text: ${this.source.slice(this.index)}`)
    }
    return value
  }

  peek(token) {
    this.index = skipTrivia(this.source, this.index)
    return this.source.startsWith(token, this.index)
  }

  eat(token) {
    if (!this.peek(token)) return false
    this.index += token.length
    return true
  }

  expect(token) {
    if (!this.eat(token)) {
      throw new Error(`expected ${token} at ${this.source.slice(this.index, this.index + 40)}`)
    }
  }

  parseTernary() {
    const condition = this.parseOr()
    if (!this.eat('?')) return condition
    const consequent = this.parseTernary()
    this.expect(':')
    const alternate = this.parseTernary()
    return condition ? consequent : alternate
  }

  parseOr() {
    let left = this.parseAnd()
    while (this.eat('||')) left = Boolean(this.parseAnd()) || Boolean(left)
    return left
  }

  parseAnd() {
    let left = this.parseEquality()
    while (this.eat('&&')) left = Boolean(this.parseEquality()) && Boolean(left)
    return left
  }

  parseEquality() {
    let left = this.parseUnary()
    for (;;) {
      if (this.eat('==')) left = left === this.parseUnary()
      else if (this.eat('!=')) left = left !== this.parseUnary()
      else return left
    }
  }

  parseUnary() {
    return this.parsePostfix(this.parsePrimary())
  }

  parsePrimary() {
    if (this.eat('(')) {
      const value = this.parseTernary()
      this.expect(')')
      return value
    }
    if (this.peek('"')) return this.parseString()
    if (this.peek('[')) return this.parseList()
    if (this.peek('{')) return this.parseObject()
    const number = /^[0-9]+/.exec(this.source.slice(this.index))
    if (number) {
      this.index += number[0].length
      return Number(number[0])
    }
    return this.parseIdentifier()
  }

  parsePostfix(value) {
    let current = value
    for (;;) {
      if (this.eat('.')) {
        current = readMember(current, this.readWord())
        continue
      }
      if (this.peek('[')) {
        this.index += 1
        const key = this.parseTernary()
        this.expect(']')
        current = readMember(current, key)
        continue
      }
      return current
    }
  }

  // `for a in x : body` / `for a, b in x : body`, shared by list and object comprehensions.
  parseComprehension(readBody) {
    const names = [this.readWord()]
    if (this.eat(',')) names.push(this.readWord())
    this.expect('in')
    const collection = this.parseUnary()
    this.expect(':')
    const bodyStart = skipTrivia(this.source, this.index)
    const entries = collectionEntries(collection)
    const bodyParser = ([key, item]) => {
      const bindings = { ...this.scope.bindings }
      if (names.length === 1) bindings[names[0]] = Array.isArray(collection) ? item : key
      else {
        bindings[names[0]] = key
        bindings[names[1]] = item
      }
      const parser = new ExpressionParser(this.source, { ...this.scope, bindings })
      parser.index = bodyStart
      return parser
    }
    // Parse once with a probe binding to find where the body ends, because an empty
    // collection would never parse it.
    const probe = bodyParser(entries[0] ?? [PROBE, PROBE])
    readBody(probe)
    this.index = probe.index
    return entries.map((entry) => readBody(bodyParser(entry)))
  }

  parseObject() {
    this.expect('{')
    if (this.eat('for')) {
      const pairs = this.parseComprehension((parser) => {
        const key = parser.parseTernary()
        parser.expect('=>')
        return [key, parser.parseTernary()]
      })
      this.expect('}')
      return Object.fromEntries(pairs)
    }
    const object = {}
    if (this.eat('}')) return object
    for (;;) {
      const key = this.peek('"') ? this.parseString() : this.readWord()
      this.expect('=')
      object[key] = this.parseTernary()
      this.eat(',')
      if (this.eat('}')) return object
    }
  }

  parseString() {
    this.index = skipTrivia(this.source, this.index)
    const src = this.source
    let cursor = this.index + 1
    let rendered = ''
    while (src[cursor] !== '"') {
      if (src[cursor] === '\\') {
        rendered += src[cursor + 1]
        cursor += 2
        continue
      }
      if (src[cursor] === '$' && src[cursor + 1] === '{') {
        const { text, next } = endOfInterpolation(src, cursor + 2)
        rendered += String(evaluate(text, this.scope))
        cursor = next
        continue
      }
      rendered += src[cursor]
      cursor += 1
    }
    this.index = cursor + 1
    return rendered
  }

  parseList() {
    this.expect('[')
    if (this.eat('for')) {
      const items = this.parseComprehension((parser) => parser.parseTernary())
      this.expect(']')
      return items
    }
    const items = []
    if (this.eat(']')) return items
    for (;;) {
      items.push(this.parseTernary())
      if (this.eat(',')) {
        if (this.eat(']')) return items
        continue
      }
      this.expect(']')
      return items
    }
  }

  readWord() {
    this.index = skipTrivia(this.source, this.index)
    const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.source.slice(this.index))
    if (!match) throw new Error(`expected identifier at ${this.source.slice(this.index, this.index + 40)}`)
    this.index += match[0].length
    return match[0]
  }

  parseIdentifier() {
    const word = this.readWord()
    if (word === 'join') {
      this.expect('(')
      const separator = this.parseTernary()
      this.expect(',')
      const parts = this.parseTernary()
      this.eat(',')
      this.expect(')')
      return parts.join(sep
```

### Core Architecture Module: `cloud/packages/relay-contract/src/splice-state-machine.ts`
```
export const SPLICE_STATE = {
  PRE_AUTH_ADMITTED: 'pre-auth-admitted',
  CREDENTIAL_LEASE_RESERVED: 'credential-lease-reserved',
  HOST_NOTIFIED: 'host-notified',
  ATTACH_PENDING: 'attach-pending',
  HOST_ATTACHED: 'host-attached',
  CLIENT_ACKNOWLEDGED: 'client-acknowledged',
  SPLICED: 'spliced',
  E2EE_CONFIRMABLE: 'e2ee-confirmable',
  TEARDOWN: 'teardown'
} as const

export type SpliceState = (typeof SPLICE_STATE)[keyof typeof SPLICE_STATE]

export const SPLICE_FORWARD_TRANSITIONS: Readonly<Record<SpliceState, readonly SpliceState[]>> = {
  [SPLICE_STATE.PRE_AUTH_ADMITTED]: [SPLICE_STATE.CREDENTIAL_LEASE_RESERVED, SPLICE_STATE.TEARDOWN],
  [SPLICE_STATE.CREDENTIAL_LEASE_RESERVED]: [SPLICE_STATE.HOST_NOTIFIED, SPLICE_STATE.TEARDOWN],
  [SPLICE_STATE.HOST_NOTIFIED]: [SPLICE_STATE.ATTACH_PENDING, SPLICE_STATE.TEARDOWN],
  [SPLICE_STATE.ATTACH_PENDING]: [SPLICE_STATE.HOST_ATTACHED, SPLICE_STATE.TEARDOWN],
  [SPLICE_STATE.HOST_ATTACHED]: [SPLICE_STATE.CLIENT_ACKNOWLEDGED, SPLICE_STATE.TEARDOWN],
  [SPLICE_STATE.CLIENT_ACKNOWLEDGED]: [SPLICE_STATE.SPLICED, SPLICE_STATE.TEARDOWN],
  [SPLICE_STATE.SPLICED]: [SPLICE_STATE.E2EE_CONFIRMABLE, SPLICE_STATE.TEARDOWN],
  [SPLICE_STATE.E2EE_CONFIRMABLE]: [SPLICE_STATE.TEARDOWN],
  [SPLICE_STATE.TEARDOWN]: []
}

export function canAdvanceSplice(from: SpliceState, to: SpliceState): boolean {
  return SPLICE_FORWARD_TRANSITIONS[from].includes(to)
}

export function mayAcknowledgeClient(state: SpliceState, forwardingHandlersInstalled: boolean): boolean {
  // Why: success before both forwarding handlers exist can strand a client on a fake splice.
  return state === SPLICE_STATE.HOST_ATTACHED && forwardingHandlersInstalled
}

```

### Core Architecture Module: `config/oxlint-plugins/renderer-scrollbar-style.mjs`
```
const STYLED_SCROLLBAR_CLASSES = new Set([
  'scrollbar-sleek',
  'scrollbar-editor',
  'worktree-sidebar-scrollbar'
])
const VERTICAL_SCROLL_CLASSES = new Set([
  'overflow-auto',
  'overflow-scroll',
  'overflow-y-auto',
  'overflow-y-scroll'
])
const VERTICAL_SCROLL_STYLE_VALUES = new Set(['auto', 'scroll'])

function withoutImportantModifier(className) {
  const withoutPrefix = className.startsWith('!') ? className.slice(1) : className
  return withoutPrefix.endsWith('!') ? withoutPrefix.slice(0, -1) : withoutPrefix
}

export function plainClassName(token) {
  const normalizedToken = token.startsWith('!') ? token.slice(1) : token
  const parts = []
  let bracketDepth = 0
  let currentPart = ''

  for (const char of normalizedToken) {
    if (char === '[') {
      bracketDepth += 1
    } else if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1)
    }
    if (char === ':' && bracketDepth === 0) {
      parts.push(currentPart)
      currentPart = ''
    } else {
      currentPart += char
    }
  }

  parts.push(currentPart)
  return withoutImportantModifier(parts.at(-1) ?? '')
}

function classTokenParts(token) {
  const variants = []
  let bracketDepth = 0
  let currentPart = ''

  for (const char of token.startsWith('!') ? token.slice(1) : token) {
    if (char === '[') {
      bracketDepth += 1
    } else if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1)
    }
    if (char === ':' && bracketDepth === 0) {
      variants.push(currentPart)
      currentPart = ''
    } else {
      currentPart += char
    }
  }

  return { className: withoutImportantModifier(currentPart), variants: variants.filter(Boolean) }
}

function classTokens(text) {
  return text.split(/\s+/).filter(Boolean).map(classTokenParts)
}

function sameVariants(left, right) {
  return left.length === right.length && left.every((variant, index) => variant === right[index])
}

function literalHasScrollbarForVertical(text, verticalToken) {
  return classTokens(text).some(
    (candidate) =>
      STYLED_SCROLLBAR_CLASSES.has(candidate.className) &&
      (candidate.variants.length === 0 || sameVariants(candidate.variants, verticalToken.variants))
  )
}

function uncoveredVerticalClass(text) {
  return classTokens(text).find(
    (token) =>
      VERTICAL_SCROLL_CLASSES.has(token.className) && !literalHasScrollbarForVertical(text, token)
  )
}

function stringLiteralTexts(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return [node.value]
  }
  if (node?.type !== 'TemplateLiteral') {
    return []
  }
  return node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw)
}

function visitChildren(node, visit) {
  for (const [key, child] of Object.entries(node)) {
    if (['parent', 'loc', 'range'].includes(key)) {
      continue
    }
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item?.type) {
          visit(item)
        }
      }
    } else if (child?.type) {
      visit(child)
    }
  }
}

function collectClassLiteralReports(node) {
  const reports = []
  const visit = (current) => {
    for (const text of stringLiteralTexts(current)) {
      const uncovered = uncoveredVerticalClass(text)
      if (uncovered) {
        reports.push({ node: current, detail: uncovered.className })
      }
    }
    visitChildren(current, visit)
  }
  visit(node)
  return reports
}

function expressionHasStyledScrollbarLiteral(node) {
  let found = false
  const visit = (current) => {
    if (found || current.type === 'ConditionalExpression' || current.type === 'LogicalExpression') {
      return
    }
    found = stringLiteralTexts(current).some((text) =>
      classTokens(text).some((token) => STYLED_SCROLLBAR_CLASSES.has(token.className))
    )
    if (!found) {
      visitChildren(current, visit)
    }
  }
  visit(node)
  return found
}

function propertyName(node) {
  if (node?.type !== 'Property') {
    return null
  }
  if (!node.computed && node.key.type === 'Identifier') {
    return node.key.name
  }
  return node.key.type === 'Literal' && typeof node.key.value === 'string' ? node.key.value : null
}

function styleValueIsVerticalScroll(name, value) {
  const parts = value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return false
  }
  if (name === 'overflowY' || name === 'overflow-y') {
    return VERTICAL_SCROLL_STYLE_VALUES.has(parts[0])
  }
  if (name !== 'overflow') {
    return false
  }
  return VERTICAL_SCROLL_STYLE_VALUES.has(parts.length > 1 ? parts[1] : parts[0])
}

function collectStyleReports(node) {
  const reports = []
  const visit = (current) => {
    if (current.type === 'Property') {
      const name = propertyName(current)
      for (const value of name ? stringLiteralTexts(current.value) : []) {
        if (styleValueIsVerticalScroll(name, value)) {
          reports.push({ node: current, detail: 'inline vertical scroll' })
        }
      }
      visit(current.value)
      return
    }
    visitChildren(current, visit)
  }
  visit(node)
  return reports
}

function unwrapExpression(node) {
  if (
    ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ChainExpression'].includes(
      node?.type
    )
  ) {
    return unwrapExpression(node.expression)
  }
  return node
}

function spreadPropExpressions(expression, propName) {
  const node = unwrapExpression(expression)
  if (!node) {
    return []
  }
  if (node.type === 'ConditionalExpression') {
    return [
      ...spreadPropExpressions(node.consequent, propName),
      ...spreadPropExpressions(node.alternate, propName)
    ]
  }
  if (node.type === 'LogicalExpression' || node.type === 'BinaryExpression') {
    return [
      ...spreadPropExpressions(node.left, propName),
      ...spreadPropExpressions(node.right, propName)
    ]
  }
  if (node.type !== 'ObjectExpression') {
    return []
  }
  return node.properties.flatMap((property) => {
    if (property.type === 'SpreadElement') {
      return spreadPropExpressions(property.argument, propName)
    }
    return propertyName(property) === propName ? [property.value] : []
  })
}

function jsxAttributeExpression(attribute) {
  if (attribute.value?.type === 'Literal') {
    return attribute.value
  }
  return attribute.value?.type === 'JSXExpressionContainer' ? attribute.value.expression : null
}

function jsxElementReports(node) {
  let classExpression = null
  const styleExpressions = []

  for (const attribute of node.attributes) {
    if (attribute.type === 'JSXSpreadAttribute') {
      const spreadClassExpression = spreadPropExpressions(attribute.argument, 'className').at(-1)
      if (spreadClassExpression) {
        classExpression = spreadClassExpression
      }
      styleExpressions.push(...spreadPropExpressions(attribute.argument, 'style'))
    } else if (attribute.name?.name === 'className') {
      classExpression = jsxAttributeExpression(attribute)
    } else if (attribute.name?.name === 'style') {
      const expression = jsxAttributeExpression(attribute)
      if (expression) {
        styleExpressions.push(expression)
      }
    }
  }

  const reports = classExpression ? collectClassLiteralReports(classExpression) : []
  if (!classExpression || !expressionHasStyledScrollbarLiteral(classExpression)) {
    for (const expression of styleExpressions) {
      reports.push(...collectStyleReports(expression))
    }
  }
  return reports
}

function bindContext(createVisitors) {
  return (context) => {
    const visitors = createVisitors()
    for (const [nodeType, visit] of Object.entries(visitors)) {
      visitors[nodeType] = visit.bind(context)
    }
    return visitors
  }
}

export default {
  meta: { name: 'renderer-scrollbar-style' },
  rules: {
    'require-styled-vertical-scrollbar': {
      create: bindContext(() => ({
        JSXOpeningElement(node) {
          for (const report of jsxElementReports(node)) {
            this.report({
              node: report.node,
              message: `Vertical scroll container (${report.detail}) must use scrollbar-sleek, scrollbar-editor, or worktree-sidebar-scrollbar.`
            })
          }
        }
      }))
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #25254** (2026-10-06): **[Bug]: Garbled Japanese name suggestion in the Create worktree dialog**
  *Symptoms*: ### Operating system  Windows  ### Orca version  v1.4.220  ### Details  Short summary:  The name suggestion row in the Create worktree dialog is garbled in Japanese.  What happened?  After typing `hoge` into the search field, the row reads:  > 使用 」hoge」 ワークスペース名として  <img width="649" height="682" alt="Image" src="https://github.com/user-attachments/assets/d6349da3-570f-4648-828c-0de01a5c7ab2" />  The word order is reversed and the opening quote is a closing mark (`」` instead of `「`). It should read:  > ワークスペース名として「hoge」を使用  How can we reproduce it?  1. Set the app language to Japanese. 2. Open the Create worktree dialog for an existing project. 3. Type any text into the search field on the Smart tab and look at the suggestion row.  Anything else that might help:  I already have a fix for this.

- **Issue #25186** (2026-10-04): **[Bug]: Chat UI blocks all requests with "Orca has received too many requests in the last day" during normal use**
  *Symptoms*: ### Operating system  macOS  ### Orca version  1.4.220 (1.4.220)  ### Details  Short summary: After using Chat UI for a while, it refuses every request with:  "Orca has received too many requests in the last day. Your answer was not sent."  It only happens in Chat UI. The terminal view keeps working with the same agent and account, so this is not a provider rate limit.  What happened? Once the message appears, Chat UI stays blocked. Starting a new chat does not help, and neither does restarting Orca. I have to switch to the terminal view to keep working.  From the source, this looks like the durable operation ledger filling up (refusal code agent_session_operation_capacity): - src/shared/agent-session-operation-ledger.ts sets AGENT_SESSION_DURABLE_OPERATION_PER_CLIENT_LIMIT = 512 and AGENT_SESSION_DURABLE_OPERATION_GLOBAL_LIMIT = 4_096 - rows are retained for 24 hours plus 5 minutes and cannot be evicted early - the count is across every chat and is persisted, so it survives a restart  How can we reproduce it? 1. Enable Chat UI and work with [Claude / Codex] agents through it for several hours ([N] agents in parallel). 2. Send messages and answer agent questions and approval prompts as usual. 3. After some time, every new request is refused with the message above.  Expected: Normal daily use of Chat UI should not hit this cap. If I really made 512 requests, the cap is too low for a day of multi-agent work. If I made far fewer, something is using up operation ids (retries with

- **Issue #25015** (2026-10-03): **[Bug]:**
  *Symptoms*: ### Operating system  macOS  ### Orca version  _No response_  ### Details  <img width="525" height="201" alt="Image" src="https://github.com/user-attachments/assets/57a1b22a-970d-47a5-9484-67c82318f26c" />
  **Post-Mortem & Fix Analysis**:
  > Closing in favor of #25016, which rewrites this report with full details (Windows, Orca 1.4.219, repro steps).

- **Issue #24982** (2026-10-06): **[Bug]: Markdown table grid lines are nearly invisible in dark mode**
  *Symptoms*: ### Operating system  Windows  ### Orca version  _No response_  ### Details  Short summary: In dark mode, the grid lines of Markdown tables are almost invisible, in both the Markdown preview and the rich Markdown editor. In light mode the same lines are clearly visible.  What happened? Table cells are drawn with `border: 1px solid var(--border)` (`src/renderer/src/assets/markdown-preview.css` and `src/renderer/src/assets/rich-markdown-editor.css`). In dark mode `--border` is `rgb(255 255 255 / 0.07)`, which is too faint to see as a grid line on the editor surface. In light mode it is `#e5e5e5`, which reads fine.  How can we reproduce it? 1. Switch Orca to dark mode. 2. Open a Markdown file that contains a table, for example:     | Name | Value |    | ---- | ----- |    | a    | 1     |    | b    | 2     |  3. View it in the Markdown preview (or the rich editor). The lines between cells are barely visible. Switch to light mode and they are clearly visible.  Anything else that might help: A possible fix is to draw table cells with `--input` instead of `--border`. `--input` is identical to `--border` in light mode (`#e5e5e5`), so light mode does not change, and it is `rgb(255 255 255 / 0.15)` in dark mode. I have this change ready and can open a PR. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for issue + PR   I think it's reasonable. Will get merged. Ignore my duplicate PR haha

- **Issue #24667** (2026-10-03): **切换窗口后 Markdown 阅读器自动回到顶部**
  *Symptoms*: ### Operating system  macOS  ### Orca version  1.4.218  ### Details  ## 问题描述                                                                                           在 Orca 中阅读 Markdown 文件时，切换到其他窗口再切回来，   阅读器会自动跳回到文件顶部，导致之前的阅读位置丢失。    ## 复现步骤   1. 在 Orca 中打开一个 Markdown 文件   2. 向下滚动到任意位置   3. 切换到其他应用或终端   4. 切回 Orca   5. 阅读器自动跳回顶部    ## 期望行为   切换窗口后回来，滚动位置应该保持不变。    ## 实际行为   每次切回窗口，都会自动滚动回文件顶部。    ## 环境   - Orca 版本：1.4.218    - macOS 版本：26.5
  **Post-Mortem & Fix Analysis**:
  > I read the code on current `main` (4e46969b7c) and found two paths that run when the Orca window regains focus and can move a Markdown view. I could not reproduce the bug, so I don't know which one you hit. Three details would narrow it down:  1. Which view is it: **Preview** (read-only rendered), **Rich** (editable), or **Source**? 2. Does the file contain local images (`![](./img.png)`)? 3. Was an agent or another program writing to the file while you were away?  What each path does:  - **Local images (Preview):** `src/renderer/src/components/editor/local-image-src-cache.ts` registers `window.addEventListener('focus', invalidateLocalImageCache)`. On every window focus, each local image in the preview is read again and gets a new blob URL (`useLocalImageSrc.ts`). If an image briefly has no height, the page gets shorter and the browser can clamp the scroll position. The preview's scroll cache (`use-markdown-preview-scroll-viewport.ts`) then saves that clamped value. - **External change
  > This should be fixed in the latest main
  > Got it, thanks! I'll update it right away.   I usually try to stay on the latest version, but I must have missed yesterday's release — you guys are shipping fast! 😄  Since it's likely already addressed in the latest build, I won't upload the reproduction video for now. I'll test it out and report back if the issue still happens.

- **Issue #24520** (2026-10-03): **[Bug]: Clone from URL aborts when user clicks outside of the dialog**
  *Symptoms*: ### Operating system  macOS  ### Orca version  v1.4.218  ### Details  Today I tried to clone this opensource CRM project: https://github.com/twentyhq/twenty; it's a big checkout it takes a *long* time to pull everything down.  I clicked off of the `Clone from URL` dialog while it was like 15% expecting the dialog to remain open in the background, instead the dialog silently closed aborting the checkout.  Since the `Clone from URL` dialog is modal, I'm blocked from doing anything while I wait to finish cloning; if cloning is going to abort I'd like at least a warning giving me the option not to.

- **Issue #24360** (2026-10-02): **[Bug]: Main process freezes 4–6 s on window focus: Cursor `state.vscdb` read synchronously on the main thread**
  *Symptoms*: ### Operating system  macOS  ### Orca version  1.4.218  ### Details  # Main process freezes 4–6 s on window focus: Cursor `state.vscdb` read synchronously on the main thread  ## Summary  When Orca regains focus (switching back to the app, clicking a conversation or changing project), the whole UI freezes for 4–6 seconds with the macOS spinning cursor. Colleagues on the same Orca version are not affected.  Root cause: the Cursor desktop-login probe opens Cursor's `state.vscdb` with `node:sqlite` `DatabaseSync` **on the Electron main thread**. On this machine that database has a **1.5 GB WAL** (Cursor has not been used since March, so the WAL was never checkpointed). Opening it forces SQLite to scan the whole WAL to rebuild the wal-index before the first `prepare()` returns, which blocks the main thread on `pread` for several seconds.  ## Environment  - Orca 1.4.218 (Electron 43.7.5) - macOS 26.7.1 (25G241), Apple M1 Pro, 16 GB - `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`: 1494 MB, last modified 2026-02-06 - `state.vscdb-wal`: 1501 MB, last modified 2026-03-06 - Cursor installed but not running and not used for months  ## Evidence  **1. Main-thread samples (`sample <orca-main-pid> 10 1`)**, captured in 10 s chunks while reproducing. Busy samples on `CrBrowserMain` (baseline is under 70 per chunk):  | Freeze | Busy samples (of ~8,400) | |---|---| | #1 12:31:57 | 5,675 | | #2 12:41:47 | 4,523 | | #3 12:48:29 | 4,313 |  The hot path is the same every tim

- **Issue #24256** (2026-10-04): **[Bug] Tab Syncing Issue Across Devices (Seemingly Chat UI-Specific)**
  *Symptoms*: <kbd>[![Cole](https://cdn.discordapp.com/avatars/174300512441729024/db55a1927cdbf8d9a0ba577172a09045.webp?size=40)](https://discord.com/channels/1492228674081263786/1555029525736460411/1555029525736460411)</kbd> [Cole](https://discord.com/channels/1492228674081263786/1555029525736460411/1555029525736460411)  `via Discord`  Hi! These tests were conducted on a Mac Mini and MacBook Pro both connected via Remote Server. The rest of the Guideline details and the summary of the bug are within this artifact.  https://share.onorca.dev/a/XHYXTKLK1P1Z  
  **Post-Mortem & Fix Analysis**:
  > I've actually seen it happening too when using the orca cli to open new tabs from the server, they don't always (sometimes do) sync to the mobile app
  > <kbd>[![nwparker](https://cdn.discordapp.com/avatars/93764454222659584/56e9687fef243512ceb8140fa0b0ac4a.webp?size=40)](https://discord.com/channels/1492228674081263786/1555029525736460411/1555100381959290881)</kbd> [nwparker](https://discord.com/channels/1492228674081263786/1555029525736460411/1555100381959290881)  `via Discord`  Thanks for sharing! We'll fix this one.  Though we likely next week since a few sensitive changes are landing the next 2 days in this area. But then we'll clean up this for sure 🫡  
  > Thanks for reporting. Looking into it

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `e2ccf52d` (2026-10-06)
**Commit Message**: fix(remote-runtime): a paired terminal accepts input again after its host app relaunches (#25736)

* test(remote-runtime): reproduce dead input after a paired host relaunch

A relaunched desktop host accepts RPC before its renderer publishes a window
graph. During that gap session.tabs.list answers with an unpublished empty
graph (publicationEpoch "none", snapshotVersion 0, tabs []). The client's
reconnect inventory treats that as removal and retires the pane
(retireRemoteTerminalId(-1)): the pane goes to "ended", the reconnect overlay
disappears, and keystrokes never reach the surviving daemon PTY.

Both tests are red on main by design; they are the repro for the fix.

- e2e: holds the relaunched host's runtime:syncWindowGraph so the client's
  reconnect deterministically meets the unpublished host (4/4 red).
- unit: transport-level repro of the same retirement (red in ~2s).
- restart helper gains a beforeFirstWindow hook; LaunchOptions moves to its
  own module to stay under the max-lines budget.

* fix(remote-runtime): a paired terminal survives its host app relaunching

After the host app quit and relaunched (daemon still running), a paired
client's terminal cleared its reconne

**File**: `config/reliability-gates.jsonc` (modified, +10/-2)
```diff
@@ -11647,9 +11647,13 @@
         "https://github.com/stablyai/orca/issues/8652",
         "https://github.com/stablyai/orca/pull/10625"
       ],
-      "invariant": "A host advertising terminal.paired-parking.v1 keeps the PTY and bounded authoritative history alive while an ordinary hidden-view park destroys the client xterm and releases its raw per-PTY stream. Reveal must restore up to the requested 5,000 rows, parked-time side effects/output, the same PTY identity, and continued input/output. Parked watcher synchronization compares parking semantics rather than fresh object identity, owns setup and cleanup across StrictMode replay, reconciles real PTY/layout changes, and performs no terminal-state scan when nothing is parked. After a host main-process relaunch, unknown local delivery-sync state must not be treated as proof that a surviving daemon PTY is already foregrounded. An empty headed session-tab inventory is authoritative only after the current renderer graph generation publishes a complete inventory and every execution host answers the PTY census; unpublished, resync-pending, transport-failed, and partially scoped inventories remain unverifiable, while genuinely authoritative empty and non-empty inventories settle and a scope-less legacy empty keeps its pre-authority best-effort settle so outdated hosts retain agent auto-resume. The unpublished-empty regression must keep the resume dispatch parked with exactly one daemon process/writer; restoring unconditional empty hydration must release one dispatch and create two live writers. If subscription precedes provider readiness, authoritative inventory must reconsider that existing subscriber without spawning, resizing, or changing reconnect state. A snapshot without an output high-water must keep it unknown rather than borrowing a layout version that can suppress newer live output. Hosts without the capability must gate hidden raw output before xterm scheduling and repaint from the authoritative snapshot on reveal while retaining the existing limit/TTL force-parking fallback. After the first semantic title state, decorative spinner frequency must add zero paired client-event frames and zero full session-tabs work between status-freshness leases regardless of hidden worktree count. Continuous working or permission evidence may refresh each affected worktree once per 15 minutes through one globally spaced FIFO so current and legacy viewers do not decay before 30 minutes; sibling PTYs share that worktree refresh, while local title animation, raw output, and semantic title, status, bell, completion, and query facts remain intact. A paired terminal stream whose delivery credits stop progressing must replace only that stream; command silence first probes authoritative state and replaces the stream if the probe times out or proves the PTY advanced beyond the client's delivered output sequence. When no comparable delivery high-water exists, the first sequenced probe establishes a baseline and only later advancement proves staleness. A same-sequence snapshot remains valid proof of a responsive silent command. A successful status probe may replace a pre-ready shared-control socket without rejecting or duplicating calls already waiting for that transport. Manual disconnect must retain pairing while preventing queued or passive calls and subscriptions from recreating transport until explicit Connect.",
+      "invariant": "A host advertising terminal.paired-parking.v1 keeps the PTY and bounded authoritative history alive while an ordinary hidden-view park destroys the client xterm and releases its raw per-PTY stream. Reveal must restore up to the requested 5,000 rows, parked-time side effects/output, the same PTY identity, and continued input/output. Parked watcher synchronization compares parking semantics rather than fresh object identity, owns setup and cleanup across StrictMode replay, reconciles real PTY/layout changes, and performs no terminal-state scan when nothing is parked. After a host main-process relaunch, unknown local delivery-sync state must not be treated as proof that a surviving daemon PTY is already foregrounded. An empty headed session-tab inventory is authoritative only after the current renderer graph generation publishes a complete inventory and every execution host answers the PTY census; unpublished, resync-pending, transport-failed, and partially scoped inventories remain unverifiable, while genuinely authoritative empty and non-empty inventories settle and a scope-less legacy empty keeps its pre-authority best-effort settle so outdated hosts retain agent auto-resume. The unpublished-empty regression must keep the resume dispatch parked with exactly one daemon process/writer; restoring unconditional empty hydration must release one dispatch and create two live writers. If subscription precedes provider readiness, authoritative inventory must reconsider that existing subscriber without spawning, resizing, or changing reconnect state. A
```

**File**: `src/main/runtime/client-session-tab-selection.ts` (modified, +6/-5)
```diff
@@ -1,6 +1,7 @@
-import type {
-  RuntimeMobileSessionClientTab,
-  RuntimeMobileSessionTabsResult
+import {
+  CLIENT_NAVIGATION_PUBLICATION_EPOCH_SUFFIX,
+  type RuntimeMobileSessionClientTab,
+  type RuntimeMobileSessionTabsResult
 } from '../../shared/runtime-types'
 import type { PersistedMobileClientTabSelections } from '../../shared/persisted-state-types'
 import {
@@ -209,7 +210,7 @@ export class ClientSessionTabSelectionStore {
       // Why: an empty snapshot has no topology to project; writing it back would wipe a restart-hydrated selection before tabs arrive.
       return {
         ...closed.snapshot,
-        publicationEpoch: `${snapshot.publicationEpoch}:client-navigation`,
+        publicationEpoch: `${snapshot.publicationEpoch}${CLIENT_NAVIGATION_PUBLICATION_EPOCH_SUFFIX}`,
         snapshotVersion: snapshot.snapshotVersion + state.revision
       }
     }
@@ -227,7 +228,7 @@ export class ClientSessionTabSelectionStore {
     })
     return {
       ...projected.snapshot,
-      publicationEpoch: `${snapshot.publicationEpoch}:client-navigation`,
+      publicationEpoch: `${snapshot.publicationEpoch}${CLIENT_NAVIGATION_PUBLICATION_EPOCH_SUFFIX}`,
       snapshotVersion: snapshot.snapshotVersion + state.revision
     }
   }
```

**File**: `src/main/runtime/orca-runtime-runtime-id.ts` (modified, +3/-0)
```diff
@@ -133,6 +133,9 @@ export class OrcaRuntimeWithRuntimeId {
 
   protected sessionTabsInventoryWaiters = new Set<() => void>()
 
+  // Worktrees answered with the unpublished placeholder, owed their real answer once the graph publishes.
+  protected worktreesAwaitingSessionTabsPublication = new Set<string>()
+
   protected readonly clientHostedPageReconciliation = new ClientHostedPageReconciliationWindow(
     Date.now()
   )
```

**File**: `src/main/runtime/orca-runtime-schedule-mobile-session-tabs-changed.ts` (modified, +51/-9)
```diff
@@ -73,16 +73,12 @@ export class OrcaRuntimeWithScheduleMobileSessionTabsChanged extends OrcaRuntime
   ): RuntimeMobileSessionTabsResult {
     const snapshot = this.mobileSessionTabsByWorktree.get(worktreeId)
     if (!snapshot) {
+      const publishedEpoch = this.getAuthoritativeSessionTabsInventoryEpoch()
+      if (publishedEpoch === null) {
+        this.notifyEmptyWorktreeOnPublication(worktreeId)
+      }
       return this.projectMobileSessionTabsForClient(
-        {
-          worktree: worktreeId,
-          publicationEpoch: UNPUBLISHED_WORKTREE_PUBLICATION_EPOCH,
-          snapshotVersion: 0,
-          activeGroupId: null,
-          activeTabId: null,
-          activeTabType: null,
-          tabs: []
-        },
+        this.emptyMobileSessionTabsResult(worktreeId, publishedEpoch),
         clientNavigationId
       )
     }
@@ -92,6 +88,52 @@ export class OrcaRuntimeWithScheduleMobileSessionTabsChanged extends OrcaRuntime
     )
   }
 
+  // Why: only an unpublished graph is "ask me later"; once it publishes, a worktree with no entry
+  // really has no tabs, and saying so lets a client open its first terminal.
+  protected emptyMobileSessionTabsResult(
+    worktreeId: string,
+    publishedEpoch: number | null
+  ): RuntimeMobileSessionTabsResult {
+    return {
+      worktree: worktreeId,
+      publicationEpoch:
+        publishedEpoch === null
+          ? UNPUBLISHED_WORKTREE_PUBLICATION_EPOCH
+          : `empty:${publishedEpoch}`,
+      snapshotVersion: 0,
+      activeGroupId: null,
+      activeTabId: null,
+      activeTabType: null,
+      tabs: []
+    }
+  }
+
+  // Why: a publication only notifies worktrees it has entries for, so a client told "ask me later"
+  // about an empty worktree would otherwise never hear the answer.
+  protected notifyEmptyWorktreeOnPublication(worktreeId: string): void {
+    if (this.worktreesAwaitingSessionTabsPublication.has(worktreeId)) {
+      return
+    }
+    this.worktreesAwaitingSessionTabsPublication.add(worktreeId)
+    const onPublished = (): void => {
+      this.sessionTabsInventoryWaiters.delete(onPublished)
+      this.worktreesAwaitingSessionTabsPublication.delete(worktreeId)
+      const publishedEpoch = this.getAuthoritativeSessionTabsInventoryEpoch()
+      if (publishedEpoch === null || this.mobileSessionTabsByWorktree.has(worktreeId)) {
+        return
+      }
+      const result = this.emptyMobileSessionTabsResult(worktreeId, publishedEpoch)
+      const changeSequence = ++this.mobileSessionTabsChangeSequence
+      for (const subscription of this.mobileSessionTabListeners) {
+        subscription.listener(
+          this.projectMobileSessionTabsForClient(result, subscription.clientNavigationId),
+          changeSequence
+        )
+      }
+    }
+    this.sessionTabsInventoryWaiters.add(onPublished)
+  }
+
   protected emitMobileSessionTabsSnapshotToClient(
     projected: RuntimeMobileSessionTabsResult,
     clientNavigationId: string,
```

**File**: `src/main/runtime/session-tabs-empty-worktree-publication.test.ts` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+import { describe, expect, it, vi } from 'vitest'
+import type { RuntimeMobileSessionTabsResult } from '../../shared/runtime-types'
+import { OrcaRuntimeService } from './orca-runtime'
+
+const WORKTREE = 'repo::/never-opened'
+
+type WorktreeAnswerInternals = {
+  getMobileSessionTabsForWorktree: (
+    worktreeId: string,
+    clientNavigationId?: string
+  ) => RuntimeMobileSessionTabsResult
+}
+
+function createHeadedRuntime(): OrcaRuntimeService {
+  const runtime = new OrcaRuntimeService()
+  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these tests only reach listProcesses.
+  runtime.setPtyController({ listProcesses: vi.fn(async () => []) } as never)
+  runtime.attachWindow(1)
+  return runtime
+}
+
+function answerFor(runtime: OrcaRuntimeService, clientNavigationId?: string) {
+  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: reads the runtime's own per-worktree answer.
+  return (runtime as unknown as WorktreeAnswerInternals).getMobileSessionTabsForWorktree(
+    WORKTREE,
+    clientNavigationId
+  )
+}
+
+function recordAnswers(runtime: OrcaRuntimeService): RuntimeMobileSessionTabsResult[] {
+  const answers: RuntimeMobileSessionTabsResult[] = []
+  runtime.onMobileSessionTabsChanged((snapshot) => {
+    if (snapshot.worktree === WORKTREE) {
+      answers.push(snapshot)
+    }
+  }, 'device-1')
+  return answers
+}
+
+function publishGraphWithoutWorktree(runtime: OrcaRuntimeService): void {
+  runtime.syncWindowGraph(1, { tabs: [], leaves: [], mobileSessionTabs: [] })
+}
+
+describe('answering for a worktree the host has no tabs for', () => {
+  it('answers "ask me later" only until the renderer graph publishes', () => {
+    const runtime = createHeadedRuntime()
+    expect(answerFor(runtime)).toMatchObject({ publicationEpoch: 'none', tabs: [] })
+    expect(answerFor(runtime, 'device-1')).toMatchObject({
+      publicationEpoch: 'none:client-navigation',
+      tabs: []
+    })
+
+    publishGraphWithoutWorktree(runtime)
+
+    const published = answerFor(runtime, 'device-1')
+    expect(published.publicationEpoch).not.toMatch(/^none/)
+    expect(published.tabs).toEqual([])
+  })
+
+  it('tells a client that asked during startup once the graph publishes', () => {
+    const runtime = createHeadedRuntime()
+    const answers = recordAnswers(runtime)
+    answerFor(runtime, 'device-1')
+    answerFor(runtime, 'device-1')
+
+    publishGraphWithoutWorktree(runtime)
+
+    expect(answers).toHaveLength(1)
+    expect(answers[0].publicationEpoch).not.toMatch(/^none/)
+    expect(answers[0].tabs).toEqual([])
+  })
+
+  it('stays quiet when the publication carries the worktree itself', () => {
+    const runtime = createHeadedRuntime()
+    const answers = recordAnswers(runtime)
+    answerFor(runtime, 'device-1')
+
+    runtime.syncWindowGraph(1, {
+      tabs: [],
+      leaves: [],
+      mobileSessionTabs: [
+        {
+          worktree: WORKTREE,
+          publicationEpoch: 'renderer-epoch',
+          snapshotVersion: 1,
+          activeGroupId: null,
+          activeTabId: null,
+          activeTabType: null,
+          tabs: []
+        }
+      ]
+    })
+
+    expect(
+      answers.every((snapshot) => snapshot.publicationEpoch.startsWith('renderer-epoch'))
+    ).toBe(true)
+  })
+})
```

**File**: `src/renderer/src/components/terminal-pane/remote-runtime-pty-recovery-state.test.ts` (modified, +13/-0)
```diff
@@ -216,6 +216,19 @@ describe('RemoteRuntimePtyRecoveryState', () => {
     state.dispose()
   })
 
+  it('fires a parked retry while still recovering, in the same epoch', () => {
+    const state = new RemoteRuntimePtyRecoveryState()
+    const retry = vi.fn()
+    const epoch = state.begin()
+    expect(state.parkRetryForExternalTrigger(epoch, retry)).toBe(true)
+
+    expect(retryAllRemoteRuntimePtyRecoveriesNow()).toBe(1)
+    expect(retry).toHaveBeenCalledWith(epoch)
+    expect(state.currentPhase).toBe('recovering')
+    expect(state.retryNow()).toBe(false)
+    state.dispose()
+  })
+
   it('refuses to park over an armed backoff or a stale epoch', () => {
     vi.useFakeTimers()
     const state = new RemoteRuntimePtyRecoveryState()
```

**File**: `src/renderer/src/components/terminal-pane/remote-runtime-pty-recovery-state.ts` (modified, +3/-2)
```diff
@@ -157,12 +157,13 @@ export class RemoteRuntimePtyRecoveryState {
     this.clearRetryTimer()
   }
 
-  // Why: resume/online should fire an already-scheduled backoff immediately, not start a new epoch.
+  // Why: resume/online should fire a scheduled or parked retry immediately, not start a new epoch.
   retryNow(): boolean {
     if (this.pendingRetry === null || this.pendingEpoch === null) {
       return false
     }
-    if (this.phase !== 'backoff' && this.phase !== 'disconnected') {
+    // Why: a retry pending while 'recovering' is one parked for an external trigger, with nothing in flight.
+    if (this.phase === 'idle' || this.phase === 'disposed') {
       return false
     }
     const retry = this.pendingRetry
```

**File**: `src/renderer/src/components/terminal-pane/remote-runtime-pty-transport-unpublished-host-graph.test.ts` (added, +244/-0)
```diff
@@ -0,0 +1,244 @@
+import { beforeEach, describe, expect, it, vi } from 'vitest'
+import {
+  createRemoteRuntimeTransportMocks,
+  readyHostSessionInventoryResponse,
+  type MultiplexSubscriptionCallbacks
+} from './remote-runtime-pty-transport-test-harness'
+import type { RuntimeMobileSessionTabsResult } from '../../../../shared/runtime-types'
+
+let subscriptionCallbacks: MultiplexSubscriptionCallbacks = null
+let resolvedPaneHandle = 'terminal-1'
+
+const { runtimeCall, runtimeSubscribe, subscriptionSendBinary, resetRemoteRuntimeTransport } =
+  createRemoteRuntimeTransportMocks({
+    getCallbacks: () => subscriptionCallbacks,
+    setCallbacks: (callbacks) => {
+      subscriptionCallbacks = callbacks
+    },
+    getResolvedPaneHandle: () => resolvedPaneHandle,
+    setResolvedPaneHandle: (handle) => {
+      resolvedPaneHandle = handle
+    }
+  })
+
+// What a relaunched desktop host answers before its renderer has published a window graph.
+const UNPUBLISHED_HOST_GRAPH = {
+  ok: true,
+  result: {
+    worktree: 'wt-1',
+    publicationEpoch: 'none:client-navigation',
+    snapshotVersion: 0,
+    activeGroupId: null,
+    activeTabId: null,
+    activeTabType: null,
+    tabs: []
+  }
+}
+
+// Past the transport's 15s bounded inventory wait, well inside the auto-recovery deadline.
+const PAST_BOUNDED_INVENTORY_WAIT_MS = 20_000
+
+const PUBLISHED_HOST_GRAPH: RuntimeMobileSessionTabsResult = {
+  worktree: 'wt-1',
+  publicationEpoch: 'epoch-ready:client-navigation',
+  snapshotVersion: 1,
+  activeGroupId: null,
+  activeTabId: 'host-tab-1::pane:1',
+  activeTabType: 'terminal',
+  tabs: [
+    {
+      type: 'terminal',
+      id: 'host-tab-1::pane:1',
+      parentTabId: 'host-tab-1',
+      leafId: 'pane:1',
+      title: 'Terminal',
+      isActive: true,
+      status: 'ready',
+      terminal: 'terminal-1'
+    }
+  ]
+}
+
+let hostGraphPublished = false
+
+function publishHostGraph(): void {
+  hostGraphPublished = true
+}
+
+// The host app relaunched with its daemon PTY alive; its renderer has not published yet.
+async function connectThenLoseHostRenderer(options: { staleSend?: boolean } = {}) {
+  const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
+  const handleEvents = await import('../../runtime/web-session-terminal-handle-events')
+  const onPtyExit = vi.fn()
+  const transport = createRemoteRuntimePtyTransport('env-1', {
+    worktreeId: 'wt-1',
+    tabId: 'web-terminal-host-tab-1',
+    leafId: 'pane:1',
+    onPtyExit
+  })
+  await transport.connect({ url: '', callbacks: {} })
+  await vi.waitFor(() => expect(subscriptionSendBinary).toHaveBeenCalled())
+  hostGraphPublished = false
+  runtimeCall.mockImplementation(async (request: { method: string }) => {
+    if (request.method === 'terminal.send') {
+      return {
+        ok: false,
+        error: { code: 'terminal_handle_stale', message: 'terminal_handle_stale' }
+      }
+    }
+    if (request.method === 'session.tabs.list') {
+      return hostGraphPublished
+        ? { ok: true, result: PUBLISHED_HOST_GRAPH }
+        : UNPUBLISHED_HOST_GRAPH
+    }
+    return { ok: false, error: { code: 'runtime_error', message: 'tab_not_found' } }
+  })
+  if (options.staleSend) {
+    await expect(transport.sendInputAccepted?.('x', 'driving')).resolves.toBe(false)
+  } else {
+    subscriptionCallbacks?.onClose?.()
+  }
+  return { transport, onPtyExit, handleEvents }
+}
+
+describe('remote runtime pty transport against a relaunched host that has not published', () => {
+  beforeEach(() => {
+    resetRemoteRuntimeTransport()
+  })
+
+  it('keeps the pane attachable when the first post-restart inventory is an unpublished empty graph', async () => {
+    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
+    const onPtyExit = vi.fn()
+    const onExit = vi.fn()
+    const transport = createRemoteRuntimePtyTransport('env-1', {
+      worktreeId: 'wt-1',
+      tabId: 'web-terminal-host-tab-1',
+      leafId: 'pane:1',
+      onPtyExit
+    })
+    await transport.connect({ url: '', callbacks: { onExit } })
+    await vi.waitFor(() => expect(subscriptionSendBinary).toHaveBeenCalled())
+    const ptyId = transport.getPtyId()
+    expect(ptyId).toBe('remote:env-1@@terminal-1')
+
+    let published = false
+    runtimeCall.mockImplementation(async (request: { method: string }) => {
+      if (request.method === 'session.tabs.activate') {
+        return published
+          ? readyHostSessionInventoryResponse('terminal-1')
+          : { ok: false, error: { code: 'runtime_error', message: 'tab_not_found' } }
+      }
+      if (request.method === 'session.tabs.list') {
+        return published ? readyHostSessionInventoryResponse('terminal-1') : UNPUBLISHED_HOST_GRAPH
+      }
+      return { ok: true, result: {} }
+    })
+
+    // The host app quit and relaunched; its daemon PTY survived.
+    subscriptionCallbacks?.onClose?.()
+    await vi.waitFor(() =
```

---

### Incident Patch 2: `bfd1e9c5` (2026-10-06)
**Commit Message**: fix(codex): keep working status when Escape closes search or permissions (#25769)

* fix(codex): preserve working status when Escape dismisses a view

* test(codex): cover navigation Escape during terminal exit cleanup

**File**: `src/main/agent-hooks/server-codex-turn-interruption.test.ts` (modified, +16/-10)
```diff
@@ -85,16 +85,22 @@ describe('Codex recorded turn interruption', () => {
         expect(server.getStatusSnapshot()[0]).toEqual(beforeSide)
       }
       const baseline = server.getStatusSnapshot()[0]
-      expect(
-        server.inferInterrupt({
-          paneKey: PANE,
-          baselineUpdatedAt: baseline.receivedAt,
-          baselineStateStartedAt: baseline.stateStartedAt,
-          baselinePrompt: baseline.prompt,
-          baselineAgentType: 'codex',
-          intent: 'ctrl-c'
-        })
-      ).toBe(false)
+      for (const intent of ['ctrl-c', 'plain-escape'] as const) {
+        for (const inputCount of [1, 2]) {
+          expect(
+            server.inferInterrupt({
+              paneKey: PANE,
+              baselineUpdatedAt: baseline.receivedAt,
+              baselineStateStartedAt: baseline.stateStartedAt,
+              baselinePrompt: baseline.prompt,
+              baselineAgentType: 'codex',
+              intent,
+              inputCount
+            })
+          ).toBe(false)
+          expect(server.getStatusSnapshot()[0]).toEqual(baseline)
+        }
+      }
       await new Promise((resolve) => setTimeout(resolve, 600))
       expect(server.getStatusSnapshot()[0].state).toBe('working')
       appendFileSync(
```

**File**: `src/main/agent-hooks/server-interrupt-inference-guards.test.ts` (modified, +12/-12)
```diff
@@ -27,7 +27,7 @@ afterEach(() => {
 })
 
 describe('AgentHookServer listener replay', () => {
-  it('keeps Codex lead state terminal after an inferred interrupt', () => {
+  it('keeps Codex lead state terminal after a confirmed interrupt', () => {
     vi.useFakeTimers()
     vi.setSystemTime(1_000)
     try {
@@ -50,19 +50,19 @@ describe('AgentHookServer listener replay', () => {
         },
         'conn-1'
       )
-      const baseline = server.getStatusSnapshot()[0]
-
       vi.setSystemTime(1_500)
-      const applied = server.inferInterrupt({
-        paneKey: PANE,
-        baselineUpdatedAt: baseline.receivedAt,
-        baselineStateStartedAt: baseline.stateStartedAt,
-        baselinePrompt: 'long task',
-        baselineAgentType: 'codex',
-        intent: 'plain-escape'
-      })
+      server.ingestRemote(
+        {
+          paneKey: PANE,
+          tabId: 'tab-1',
+          worktreeId: 'wt-1',
+          providerSession: { key: 'session_id', id: 'codex-interrupt-session-1' },
+          hookEventName: 'Interrupt',
+          payload: { state: 'done', prompt: 'long task', agentType: 'codex', interrupted: true }
+        },
+        'conn-1'
+      )
 
-      expect(applied).toBe(true)
       expect(server.getStatusSnapshot()).toEqual([
         expect.objectContaining({
           paneKey: PANE,
```

**File**: `src/main/agent-hooks/server-interrupt-inference-resurrection.test.ts` (modified, +15/-12)
```diff
@@ -87,7 +87,7 @@ describe('AgentHookServer listener replay', () => {
     }
   })
 
-  it('does not let late Codex tool hooks with explicit prompt resurrect an inferred interrupt', () => {
+  it('does not let late Codex tool hooks with explicit prompt resurrect a confirmed interrupt', () => {
     vi.useFakeTimers()
     vi.setSystemTime(1_000)
     try {
@@ -107,19 +107,22 @@ describe('AgentHookServer listener replay', () => {
         },
         'conn-1'
       )
-      const baseline = server.getStatusSnapshot()[0]
-
       vi.setSystemTime(1_500)
-      expect(
-        server.inferInterrupt({
+      server.ingestRemote(
+        {
           paneKey: PANE,
-          baselineUpdatedAt: baseline.receivedAt,
-          baselineStateStartedAt: baseline.stateStartedAt,
-          baselinePrompt: 'Run sleep 30, then reply done.',
-          baselineAgentType: 'codex',
-          intent: 'plain-escape'
-        })
-      ).toBe(true)
+          tabId: 'tab-1',
+          worktreeId: 'wt-1',
+          hookEventName: 'Interrupt',
+          payload: {
+            state: 'done',
+            prompt: 'Run sleep 30, then reply done.',
+            agentType: 'codex',
+            interrupted: true
+          }
+        },
+        'conn-1'
+      )
 
       vi.setSystemTime(6_000)
       server.ingestRemote(
```

**File**: `src/main/agent-hooks/server/server-status-inference.ts` (modified, +2/-11)
```diff
@@ -2,7 +2,6 @@ import {
   markClaudeLeadTurnInterrupted,
   clearClaudeAnsweredQuestionWait
 } from '../../../shared/agent-hook-listener/providers/claude-roster-state'
-import { markCodexLeadTurnInterrupted } from '../../../shared/agent-hook-listener/providers/codex-state'
 import {
   isAgentInterruptInputIntent,
   isNavigationEscapeIntent,
@@ -81,13 +80,8 @@ export abstract class AgentHookServerStatusInference extends AgentHookServerRowO
           this.state.claudeActiveSessionCronPaneKeys.has(existing.paneKey)))
     // Why: a 'working' pane can be child-driven, and Ctrl+C at the idle prompt of a main agent that
     // child work holds open cancels nothing, so the main agent fact decides. A row from a host too
-    // old to publish `mainAgent` keeps the evidence guard, and so does Codex: its synthesized row is
-    // a plain done, which would retire the live children its combine keeps working.
-    if (
-      payload.mainAgent
-        ? payload.mainAgent.state !== 'working' || (agentType === 'codex' && childWorkEvidenced)
-        : childWorkEvidenced
-    ) {
+    // old to publish `mainAgent` keeps the evidence guard.
+    if (payload.mainAgent ? payload.mainAgent.state !== 'working' : childWorkEvidenced) {
       return false
     }
     // Why: whoever owns the provider records folds the cancel with the child work the turn left
@@ -101,9 +95,6 @@ export abstract class AgentHookServerStatusInference extends AgentHookServerRowO
       agentType === 'claude' && existing.connectionId
         ? foldMainAgentWithRowChildWork('done', existing)
         : undefined
-    if (agentType === 'codex') {
-      markCodexLeadTurnInterrupted(this.state, existing.paneKey)
-    }
     const state = local?.state ?? relayed?.stateName ?? 'done'
     const workingMode = local?.workingMode ?? relayed?.workingMode
     const inferred = this.applyNormalizedStatus({
```

**File**: `src/relay/agent-hook-server-codex-turn-interruption.test.ts` (modified, +16/-0)
```diff
@@ -56,6 +56,22 @@ it('forwards host-confirmed Codex interruption without requiring a local rollout
     expect(sideResponse.status).toBe(204)
     expect(forward).toHaveBeenCalledTimes(1)
 
+    const baseline = desktop.getStatusSnapshot()[0]
+    for (const inputCount of [1, 2]) {
+      expect(
+        desktop.inferInterrupt({
+          paneKey: PANE_KEY,
+          baselineUpdatedAt: baseline.receivedAt,
+          baselineStateStartedAt: baseline.stateStartedAt,
+          baselinePrompt: baseline.prompt,
+          baselineAgentType: 'codex',
+          intent: 'plain-escape',
+          inputCount
+        })
+      ).toBe(false)
+      expect(desktop.getStatusSnapshot()[0]).toEqual(baseline)
+    }
+
     appendFileSync(
       transcriptPath,
       line({ type: 'turn_aborted', turn_id: 'turn-1', reason: 'interrupted' })
```

**File**: `src/renderer/src/components/terminal-pane/agent-interrupt-inference.test.ts` (modified, +8/-7)
```diff
@@ -14,7 +14,7 @@ function makeEntry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry
     prompt: 'write tests',
     updatedAt: 1_000,
     stateStartedAt: 900,
-    agentType: 'codex',
+    agentType: 'custom-agent',
     paneKey: PANE_KEY,
     terminalTitle: 'Codex',
     stateHistory: [],
@@ -72,8 +72,7 @@ describe('agent interrupt inference', () => {
 
   it.each([
     ['plain-escape', 'gemini'],
-    ['ctrl-c', 'gemini'],
-    ['plain-escape', 'codex']
+    ['ctrl-c', 'gemini']
   ] as const)('emits a strict baseline request for %s from %s immediately', (intent, agentType) => {
     vi.useFakeTimers()
     let entry: AgentStatusEntry | undefined = makeEntry({ agentType })
@@ -321,8 +320,8 @@ describe('agent interrupt inference', () => {
     entry = undefined
   })
 
-  it.each([['claude'], ['omp'], ['pi'], ['prime-agent']] as const)(
-    'never asks main to interrupt %s on a single Escape while working',
+  it.each([['claude'], ['codex'], ['omp'], ['pi'], ['prime-agent']] as const)(
+    'never asks main to interrupt %s on repeated navigation Escape while working',
     (agentType) => {
       // Why: Escape is ambiguous at the source for these TUIs, so the renderer does not spend a
       // round-trip on it. main re-checks the same rule for requests that never came from here.
@@ -336,8 +335,10 @@ describe('agent interrupt inference', () => {
         now: () => 1_100
       })
 
+      tracker.observeInputIntent('plain-escape')
       tracker.observeInputIntent('plain-escape')
       vi.advanceTimersByTime(500)
+      expect(tracker.flushPending()).toBe(false)
 
       expect(inferInterrupt).not.toHaveBeenCalled()
       tracker.dispose()
@@ -493,7 +494,7 @@ describe('agent interrupt inference', () => {
       baselineUpdatedAt: 1_000,
       baselineStateStartedAt: 900,
       baselinePrompt: 'write tests',
-      baselineAgentType: 'codex',
+      baselineAgentType: 'custom-agent',
       intent: 'plain-escape'
     })
     tracker.dispose()
@@ -580,7 +581,7 @@ describe('agent interrupt inference', () => {
         baselineUpdatedAt: 2_000,
         baselineStateStartedAt: 1_900,
         baselinePrompt: 'newer task',
-        baselineAgentType: 'codex',
+        baselineAgentType: 'custom-agent',
         intent: 'plain-escape'
       })
     }
```

**File**: `src/renderer/src/components/terminal-pane/agent-interrupt-inference.ts` (modified, +1/-2)
```diff
@@ -46,8 +46,7 @@ function shouldFlushInterruptImmediately(
 ): boolean {
   return (
     requiresDoubleEscapeInterrupt(baseline.agentType, baseline.intent) ||
-    baseline.agentType === 'gemini' ||
-    (baseline.agentType === 'codex' && baseline.intent === 'plain-escape')
+    baseline.agentType === 'gemini'
   )
 }
 
```

**File**: `src/renderer/src/components/terminal-pane/pty-connection-command-finished-cleanup.test.ts` (modified, +92/-81)
```diff
@@ -747,96 +747,107 @@ describe('connectPanePty', () => {
     expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')
   })
 
-  it('pins interrupt inference before acknowledged input and command exit cleanup', async () => {
-    const { connectPanePty } = await import('./pty-connection')
+  it.each(['gemini', 'codex'] as const)(
+    'pins %s interrupt policy before acknowledged input and command exit cleanup',
+    async (agentType) => {
+      const { connectPanePty } = await import('./pty-connection')
 
-    const capturedDataCallback: { current: ((data: string) => void) | null } = { current: null }
-    const transport = createMockTransport()
-    const writeAccepted = createDeferred<boolean>()
-    transport.sendInputAccepted = vi.fn(() => writeAccepted.promise)
-    transport.connect.mockImplementation(async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
-      capturedDataCallback.current = callbacks.onData ?? null
-      return { id: 'tab-pty' }
-    })
-    transport.attach.mockImplementation(({ callbacks }: { callbacks: ConnectCallbacks }) => {
-      capturedDataCallback.current = callbacks.onData ?? null
-    })
-    transportFactoryQueue.push(transport)
-    vi.useFakeTimers()
-    vi.setSystemTime(1_100)
-    const paneKey = makePaneKey('tab-1', LEAF_1)
-    mockStoreState = {
-      ...mockStoreState,
-      agentStatusByPaneKey: {
-        [paneKey]: {
-          paneKey,
-          state: 'working',
-          prompt: 'stop quickly',
-          updatedAt: 1_000,
-          stateStartedAt: 900,
-          agentType: 'codex',
-          terminalTitle: 'Codex',
-          stateHistory: []
+      const capturedDataCallback: { current: ((data: string) => void) | null } = { current: null }
+      const transport = createMockTransport()
+      const writeAccepted = createDeferred<boolean>()
+      transport.sendInputAccepted = vi.fn(() => writeAccepted.promise)
+      transport.connect.mockImplementation(
+        async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
+          capturedDataCallback.current = callbacks.onData ?? null
+          return { id: 'tab-pty' }
         }
-      }
-    }
-    vi.mocked(window.api.agentStatus.inferInterrupt).mockImplementation(async () => {
-      mockStoreState.agentStatusByPaneKey[paneKey] = {
-        paneKey,
-        state: 'done',
-        prompt: 'stop quickly',
-        updatedAt: 1_100,
-        stateStartedAt: 1_100,
-        agentType: 'codex',
-        terminalTitle: 'Codex',
-        interrupted: true,
-        stateHistory: [
-          {
+      )
+      transport.attach.mockImplementation(({ callbacks }: { callbacks: ConnectCallbacks }) => {
+        capturedDataCallback.current = callbacks.onData ?? null
+      })
+      transportFactoryQueue.push(transport)
+      vi.useFakeTimers()
+      vi.setSystemTime(1_100)
+      const paneKey = makePaneKey('tab-1', LEAF_1)
+      mockStoreState = {
+        ...mockStoreState,
+        agentStatusByPaneKey: {
+          [paneKey]: {
+            paneKey,
             state: 'working',
             prompt: 'stop quickly',
-            startedAt: 900
+            updatedAt: 1_000,
+            stateStartedAt: 900,
+            agentType,
+            terminalTitle: agentType,
+            stateHistory: []
           }
-        ]
+        }
       }
-      return true
-    })
-    const terminalTarget = createKeyboardEventTarget()
-    const pane = createPane(1)
-    ;(pane.terminal as { element?: unknown }).element = terminalTarget.target
-    let onDataHandler: ((data: string) => void) | null = null
-    pane.terminal.onData = vi.fn(((handler: (data: string) => void) => {
-      onDataHandler = handler
-      return { dispose: vi.fn() }
-    }) as typeof pane.terminal.onData)
-
-    connectPanePty(pane as never, createManager(1) as never, createDeps() as never)
-    vi.advanceTimersByTime(1_000)
-    await flushAsyncTicks()
-    expect(capturedDataCallback.current).not.toBeNull()
-    if (!onDataHandler) {
-      throw new Error('expected onData handler to be registered')
-    }
-    terminalTarget.dispatch(keyEvent({ key: 'Escape' }))
-    ;(onDataHandler as unknown as (data: string) => void)('\x1b')
+      vi.mocked(window.api.agentStatus.inferInterrupt).mockImplementation(async () => {
+        mockStoreState.agentStatusByPaneKey[paneKey] = {
+          paneKey,
+          state: 'done',
+          prompt: 'stop quickly',
+          updatedAt: 1_100,
+          stateStartedAt: 1_100,
+          agentType,
+          terminalTitle: agentType,
+          interrupted: true,
+          stateHistory: [
+            {
+              state: 'working',
+              prompt: 'stop quickly',
+              startedAt: 900
+            }
+          ]
+        }
+        return true
+      })
+      const terminalTarget = createKeyboardEventTarget()
+      const pane = createPane(1)
+      ;(pane.terminal as { element?: unknown }).element = terminalTarget.targe
```

---

### Incident Patch 3: `3ee3a41b` (2026-10-06)
**Commit Message**: fix(markdown): strengthen dark table grid lines (#25653)

Strengthen only dark-mode table cell borders in Markdown Preview and the rich editor by mixing foreground into the existing border token. Keep light mode and table geometry unchanged.

Fixes #24982. Consolidates #24984, #25050, and #25653.

Co-authored-by: Paramon <[REDACTED_EMAIL]>
Co-authored-by: kana001-bit <[REDACTED_EMAIL]>
Co-authored-by: Neil <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `src/renderer/src/assets/markdown-preview.css` (modified, +7/-0)
```diff
@@ -836,6 +836,13 @@
   text-align: left;
 }
 
+/* Why: --border is ~7% white in dark mode, so table grid lines are nearly invisible;
+   mix in foreground (~15% total) while keeping the border token role. */
+.dark .markdown-body th,
+.dark .markdown-body td {
+  border-color: color-mix(in srgb, var(--foreground) 8%, var(--border));
+}
+
 .markdown-body th {
   font-weight: 600;
   font-size: 0.85em;
```

**File**: `src/renderer/src/assets/rich-markdown-editor.css` (modified, +7/-0)
```diff
@@ -819,6 +819,13 @@
   overflow-wrap: break-word;
 }
 
+/* Why: --border is ~7% white in dark mode, so table grid lines are nearly invisible;
+   mix in foreground (~15% total) while keeping the border token role. */
+.dark .rich-markdown-editor th,
+.dark .rich-markdown-editor td {
+  border-color: color-mix(in srgb, var(--foreground) 8%, var(--border));
+}
+
 .rich-markdown-editor th {
   font-weight: 600;
   background: color-mix(in srgb, var(--foreground) 4%, transparent);
```

---

### Incident Patch 4: `db078b65` (2026-10-06)
**Commit Message**: fix(claude): API-key Claude users are told they're not signed in (#25163)

* fix(claude): open native chat for API-key users instead of saying "not signed in"

Claude reports tokenSource "none" beside apiKeySource "ANTHROPIC_API_KEY" when it runs on
an API key (environment or settings env). The startup check read only tokenSource, so it
refused those chats as signed out. Refuse only when Claude reports no token source and no
API-key source.

Co-Authored-By: Claude <[REDACTED_EMAIL]>

* test(claude): cover a Console /login key at chat start

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `src/main/claude/claude-structured-init-proof.ts` (modified, +5/-2)
```diff
@@ -71,8 +71,11 @@ export function claudeInitializationAuthError(
   initialization: unknown
 ): AgentSessionAcquisitionRefusal | null {
   const account =
-    isRecord(initialization) && isRecord(initialization.account) ? initialization.account : null
-  return readClaudeFrameString(account ?? {}, 'tokenSource') === 'none'
+    isRecord(initialization) && isRecord(initialization.account) ? initialization.account : {}
+  // An API key (ANTHROPIC_API_KEY or a Console /login key) reports tokenSource "none".
+  const apiKeySource = readClaudeFrameString(account, 'apiKeySource')
+  return readClaudeFrameString(account, 'tokenSource') === 'none' &&
+    (apiKeySource === null || apiKeySource === 'none')
     ? new AgentSessionAcquisitionRefusal(
         'Claude is not signed in for the selected account. Sign in with the Claude CLI for this CLAUDE_CONFIG_DIR, then retry.',
         'notSignedIn'
```

**File**: `src/main/claude/claude-structured-session-startup.test.ts` (modified, +32/-0)
```diff
@@ -207,6 +207,38 @@ describe('Claude structured session publishes before the CLI answers initialize'
     })
   })
 
+  // Accounts as Claude 2.1.280 reports them at initialize; the /login key row is from its source.
+  it.each([
+    ['an ANTHROPIC_API_KEY', { tokenSource: 'none', apiKeySource: 'ANTHROPIC_API_KEY' }],
+    ['a Console /login key', { tokenSource: 'none', apiKeySource: '/login managed key' }],
+    ['an apiKeyHelper', { tokenSource: 'apiKeyHelper', apiKeySource: 'apiKeyHelper' }],
+    ['an ANTHROPIC_AUTH_TOKEN', { tokenSource: 'ANTHROPIC_AUTH_TOKEN' }],
+    ['a third-party provider', { apiProvider: 'bedrock' }]
+  ])('starts a session Claude authenticates with %s', async (_label, account) => {
+    const claude = fakeClaude({ initAccount: { apiProvider: 'firstParty', ...account } })
+    const { adapter, events } = startingAdapter(claude)
+    await adapter.acquire(ACQUIRE)
+    await adapter.awaitStarted('session-1')
+
+    expect(events.some((event) => event.type === 'started')).toBe(true)
+    expect(events.some((event) => event.type === 'ended')).toBe(false)
+    await adapter.closeAll()
+  })
+
+  it('still refuses a start whose API key source is reported as none', async () => {
+    const claude = fakeClaude({
+      initAccount: { apiProvider: 'firstParty', tokenSource: 'none', apiKeySource: 'none' }
+    })
+    const { adapter, events } = startingAdapter(claude)
+    await adapter.acquire(ACQUIRE)
+    await adapter.awaitStarted('session-1')
+    await adapter.drainObservedExits()
+
+    expect(events.find((event) => event.type === 'ended')).toMatchObject({
+      reason: expect.stringMatching(/not signed in/)
+    })
+  })
+
   // A Stop that closes a child still starting must end the wait the host's delivery loop is in,
   // though initialize never answers; otherwise every later send joins a loop that never moves.
   it('ends the wait on a start closed before init, without faulting it', async () => {
```

---

### Incident Patch 5: `9b7c9369` (2026-10-06)
**Commit Message**: fix(dock): clear stale workspace unread counts (#24877)

* fix(dock): count only the unread the app shows

Tab markers outlive the workspace unread flag, so the badge could
sit at 1 with no sidebar dot to find or clear.

Fixes #23363

* fix(dock): follow the sidebar's host filter in the unread count

Counting folder workspaces and per-host rows by flag put rows on the
Dock that a host-scoped sidebar does not show.

* fix(dock): preserve owned folder alerts without expanding unread counts

* fix(dock): honor the existing other-device worktree filter

---------

Co-authored-by: Neil <[REDACTED_EMAIL]>

**File**: `src/renderer/src/App.tsx` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ function App(): React.JSX.Element {
   const layout = useAppChromeLayout()
   const floatingWorkspace = useFloatingWorkspacePanel()
   const onboardingGate = useOnboardingAndFeatureTips()
-  const clearUnreadDockBadge = useUnreadDockBadge()
+  const clearUnreadDockBadge = useUnreadDockBadge(floatingWorkspace.open)
 
   // Why enabled && open: the overlay only renders while the feature is on, and its panel is
   // aria-hidden while closed — so that pair is what "on screen" means for the floating workspace.
```

**File**: `src/renderer/src/hooks/useUnreadDockBadge.test.ts` (modified, +100/-40)
```diff
@@ -3,7 +3,9 @@
 import { act, cleanup, renderHook } from '@testing-library/react'
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 import type * as UnreadBadgeCountModule from '@/lib/unread-badge-count'
+import { makeFolderWorkspace } from '@/store/slices/worktrees-slice-test-fixtures'
 import { makeTab, makeWorktree } from '@/store/slices/store-test-helpers'
+import { FLOATING_TERMINAL_WORKTREE_ID, getDefaultSettings } from '../../../shared/constants'
 
 const { getUnreadBadgeCount } = vi.hoisted(() => ({ getUnreadBadgeCount: vi.fn() }))
 
@@ -27,6 +29,7 @@ describe('useUnreadDockBadge', () => {
       {
         ...initialState,
         worktreesByRepo: {},
+        folderWorkspaces: [],
         tabsByWorktree: {},
         unreadTerminalTabs: {}
       },
@@ -71,20 +74,10 @@ describe('useUnreadDockBadge', () => {
 
   it('does not rescan workspaces for unrelated remote activity or parent renders', () => {
     const worktrees = Array.from({ length: 100 }, (_, index) =>
-      makeWorktree({ id: `repo::worktree-${index}`, repoId: 'repo' })
+      makeWorktree({ id: `repo::worktree-${index}`, repoId: 'repo', isUnread: index === 99 })
     )
-    const tabsByWorktree = Object.fromEntries(
-      worktrees.map((worktree, index) => [
-        worktree.id,
-        [makeTab({ id: `tab-${index}`, worktreeId: worktree.id })]
-      ])
-    )
-    useAppStore.setState({
-      worktreesByRepo: { repo: worktrees },
-      tabsByWorktree,
-      unreadTerminalTabs: { 'tab-99': true }
-    })
-    const hook = renderHook(() => useUnreadDockBadge())
+    useAppStore.setState({ worktreesByRepo: { repo: worktrees } })
+    const hook = renderHook(() => useUnreadDockBadge(false))
 
     expect(getUnreadBadgeCount).toHaveBeenCalledTimes(1)
     act(() => {
@@ -100,27 +93,30 @@ describe('useUnreadDockBadge', () => {
     expect(getUnreadBadgeCount).toHaveBeenCalledTimes(1)
   })
 
-  it('recounts when worktree, tab, or unread references change', () => {
-    renderHook(() => useUnreadDockBadge())
-    const worktree = makeWorktree({
-      id: 'repo::unread',
-      repoId: 'repo'
-    })
+  it('recounts when a workspace unread flag changes, not when a tab marker does', () => {
+    renderHook(() => useUnreadDockBadge(false))
+    const worktree = makeWorktree({ id: 'repo::unread', repoId: 'repo' })
     const tab = makeTab({ id: 'tab-unread', worktreeId: worktree.id })
 
     act(() => useAppStore.setState({ worktreesByRepo: { repo: [worktree] } }))
     expect(getUnreadBadgeCount).toHaveBeenCalledTimes(2)
     expect(setUnreadDockBadgeCount).toHaveBeenLastCalledWith(0)
 
-    act(() => useAppStore.setState({ tabsByWorktree: { [worktree.id]: [tab] } }))
-    expect(getUnreadBadgeCount).toHaveBeenCalledTimes(3)
+    act(() =>
+      useAppStore.setState({
+        tabsByWorktree: { [worktree.id]: [tab] },
+        unreadTerminalTabs: { [tab.id]: 'terminal-bell' }
+      })
+    )
+    expect(getUnreadBadgeCount).toHaveBeenCalledTimes(2)
+    expect(setUnreadDockBadgeCount).toHaveBeenLastCalledWith(0)
 
-    act(() => useAppStore.setState({ unreadTerminalTabs: { [tab.id]: true } }))
-    expect(getUnreadBadgeCount).toHaveBeenCalledTimes(4)
+    act(() => useAppStore.getState().markWorktreeUnread(worktree.id))
+    expect(getUnreadBadgeCount).toHaveBeenCalledTimes(3)
     expect(setUnreadDockBadgeCount).toHaveBeenLastCalledWith(1)
 
-    act(() => useAppStore.setState({ unreadTerminalTabs: {} }))
-    expect(getUnreadBadgeCount).toHaveBeenCalledTimes(5)
+    act(() => useAppStore.getState().clearWorktreeUnread(worktree.id))
+    expect(getUnreadBadgeCount).toHaveBeenCalledTimes(4)
     expect(setUnreadDockBadgeCount).toHaveBeenLastCalledWith(0)
   })
 
@@ -129,23 +125,19 @@ describe('useUnreadDockBadge', () => {
   // non-memoised overlay — for a badge integer that did not move.
   it('leaves the App root asleep through title frames and wakes it only on a badge change', () => {
     const worktrees = Array.from({ length: 20 }, (_, index) =>
-      makeWorktree({ id: `repo::worktree-${index}`, repoId: 'repo' })
+      makeWorktree({ id: `repo::worktree-${index}`, repoId: 'repo', isUnread: index === 19 })
     )
     const tabsByWorktree = Object.fromEntries(
       worktrees.map((worktree, index) => [
         worktree.id,
         [makeTab({ id: `tab-${index}`, worktreeId: worktree.id })]
       ])
     )
-    useAppStore.setState({
-      worktreesByRepo: { repo: worktrees },
-      tabsByWorktree,
-      unreadTerminalTabs: { 'tab-19': true }
-    })
+    useAppStore.setState({ worktreesByRepo: { repo: worktrees }, tabsByWorktree })
     let renders = 0
     renderHook(() => {
       renders += 1
-      return useUnreadDockBadge()
+      return useUnreadDockBadge(false)
     })
     const rendersAfterMount = renders
 
@@ -157,24 +149,92 @@ describe('useUnreadDockBadge', () => {
     expect(useAppStore.getState().tabsByWorktree).not.toBe(tabsByWorktree)
     expect(renders).toBe(rendersAfterMou
```

**File**: `src/renderer/src/hooks/useUnreadDockBadge.ts` (modified, +11/-2)
```diff
@@ -1,6 +1,7 @@
 import { useEffect, useMemo } from 'react'
 import { createUnreadBadgeCountSelector } from '@/lib/unread-badge-count-selector'
 import { useAppStore } from '@/store'
+import { selectFloatingWorkspaceHasUnread } from '@/store/selectors'
 
 function setUnreadDockBadgeCountBestEffort(count: number): void {
   const setBadge = window.api?.app?.setUnreadDockBadgeCount
@@ -16,12 +17,20 @@ export function clearUnreadDockBadgeCount(): void {
   setUnreadDockBadgeCountBestEffort(0)
 }
 
-export function useUnreadDockBadge(): typeof clearUnreadDockBadgeCount {
+export function useUnreadDockBadge(
+  floatingTerminalOpen: boolean
+): typeof clearUnreadDockBadgeCount {
   // Why a selector and not the raw maps: this hook is mounted on the App root, so subscribing to
   // `tabsByWorktree` re-rendered the entire shell on every title frame. The selector both skips the
   // rescan and keeps the subscription quiet unless the badge integer itself changes.
   const selectUnreadBadgeCount = useMemo(() => createUnreadBadgeCountSelector(), [])
-  const unreadCount = useAppStore(selectUnreadBadgeCount)
+  const unreadWorkspaceCount = useAppStore(selectUnreadBadgeCount)
+  // Why: the floating terminal has no workspace flag, so it counts exactly while its launcher shows the dot.
+  const floatingTerminalHasUnread = useAppStore(
+    (s) => s.settings?.floatingTerminalEnabled === true && selectFloatingWorkspaceHasUnread(s)
+  )
+  const unreadCount =
+    unreadWorkspaceCount + (floatingTerminalHasUnread && !floatingTerminalOpen ? 1 : 0)
 
   // oxlint-disable-next-line react-doctor/no-derived-state-effect -- Why: this syncs an external OS dock badge, not React render state.
   useEffect(() => {
```

**File**: `src/renderer/src/lib/unread-badge-count-migration.test.ts` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+import { describe, expect, it } from 'vitest'
+import { makeTab, makeWorktree, TEST_REPO } from '@/store/slices/store-test-helpers'
+import { makeFolderWorkspace } from '@/store/slices/worktrees-slice-test-fixtures'
+import type { ProjectGroup } from '../../../shared/project-group-types'
+import { getUnreadBadgeCount, type UnreadBadgeCountSources } from './unread-badge-count'
+
+const projectGroup = {
+  id: 'group-1',
+  name: 'platform',
+  parentPath: '/work',
+  parentGroupId: null,
+  createdFrom: 'manual',
+  tabOrder: 0,
+  isCollapsed: false,
+  color: null,
+  createdAt: 0,
+  updatedAt: 0
+} satisfies ProjectGroup
+
+const visibility = {
+  projectGroups: [projectGroup],
+  repoMap: new Map([[TEST_REPO.id, TEST_REPO]]),
+  visibleHostIds: null,
+  defaultHostId: 'local' as const,
+  hiddenOtherDevicePairings: null
+}
+
+// The old count is the compatibility ceiling, including its orphan-marker behavior.
+function baselineCount(sources: UnreadBadgeCountSources): number {
+  const workspaces = new Set<string>()
+  for (const rows of Object.values(sources.worktreesByRepo)) {
+    for (const row of rows) {
+      if (row.isUnread) {
+        workspaces.add(row.id)
+      }
+    }
+  }
+  const markers = new Set(Object.keys(sources.unreadTerminalTabs ?? {}))
+  for (const [key, tabs] of Object.entries(sources.tabsByWorktree ?? {})) {
+    for (const tab of tabs) {
+      if (markers.delete(tab.id)) {
+        workspaces.add(key)
+      }
+    }
+  }
+  return workspaces.size + markers.size
+}
+
+describe('Dock count migration does not introduce hidden notifications', () => {
+  it('never exceeds the old count across workspace, live-owner, and marker combinations', () => {
+    // Host/device/group membership can only subtract from the baseline count.
+    for (let bits = 0; bits < 256; bits += 1) {
+      const enabled = (bit: number): boolean => (bits & (1 << bit)) !== 0
+      const sources = {
+        ...visibility,
+        worktreesByRepo: {
+          repo: [
+            makeWorktree({
+              id: 'same-id',
+              repoId: TEST_REPO.id,
+              hostId: 'local',
+              isUnread: enabled(0),
+              isArchived: enabled(1)
+            }),
+            makeWorktree({
+              id: 'same-id',
+              repoId: TEST_REPO.id,
+              hostId: 'ssh:remote',
+              isUnread: enabled(2),
+              isArchived: false
+            })
+          ]
+        },
+        folderWorkspaces: [makeFolderWorkspace({ id: 'folder', isUnread: enabled(3) })],
+        tabsByWorktree: {
+          'folder:folder': enabled(4) ? [makeTab({ id: 'bell', worktreeId: 'folder:folder' })] : []
+        },
+        unifiedTabsByWorktree: {
+          'folder:folder': enabled(5) ? [{ id: 'chat', contentType: 'agent-session' }] : []
+        },
+        unreadTerminalTabs: {
+          ...(enabled(6) ? { bell: 'terminal-bell' as const } : {}),
+          ...(enabled(7) ? { chat: 'terminal-bell' as const } : {}),
+          orphan: 'terminal-bell' as const
+        }
+      } satisfies UnreadBadgeCountSources
+      const hostFilters: UnreadBadgeCountSources['visibleHostIds'][] = [
+        null,
+        new Set(['local']),
+        new Set(['ssh:remote']),
+        new Set()
+      ]
+      const groupStates = [
+        [projectGroup],
+        [{ ...projectGroup, isCollapsed: true }],
+        [{ ...projectGroup, parentPath: null }],
+        []
+      ]
+      for (const visibleHostIds of hostFilters) {
+        for (const projectGroups of groupStates) {
+          for (const hiddenOtherDevicePairings of [null, new Map<string, string>()]) {
+            expect(
+              getUnreadBadgeCount({
+                ...sources,
+                visibleHostIds,
+                projectGroups,
+                hiddenOtherDevicePairings
+              }),
+              `combination ${bits}`
+            ).toBeLessThanOrEqual(baselineCount(sources))
+          }
+        }
+      }
+    }
+  })
+
+  it('preserves legitimate folder terminal alerts, dedupes siblings, and clears with the workspace', () => {
+    const sources = {
+      ...visibility,
+      worktreesByRepo: {},
+      folderWorkspaces: [makeFolderWorkspace({ id: 'folder', isUnread: true })],
+      tabsByWorktree: {
+        'folder:folder': ['one', 'two'].map((id) => makeTab({ id, worktreeId: 'folder:folder' }))
+      },
+      unreadTerminalTabs: { one: 'terminal-bell', two: 'terminal-bell' }
+    } satisfies UnreadBadgeCountSources
+    expect(getUnreadBadgeCount(sources)).toBe(baselineCount(sources))
+    expect(getUnreadBadgeCount(sources)).toBe(1)
+    expect(
+      getUnreadBadgeCount({
+        ...sources,
+        folderWorkspaces: [makeFolderWorkspace({ id: 'folder', isUnread: false })]
+      })
+    ).toBe(0)
+  })
+})
```

**File**: `src/renderer/src/lib/unread-badge-count-selector.test.ts` (added, +271/-0)
```diff
@@ -0,0 +1,271 @@
+import { describe, expect, it, vi } from 'vitest'
+import { createTabsSliceMockApi } from '@/store/slices/tabs-slice-test-harness'
+import {
+  createTestStore,
+  makeTab,
+  makeWorktree,
+  TEST_REPO
+} from '@/store/slices/store-test-helpers'
+import { makeFolderWorkspace } from '@/store/slices/worktrees-slice-test-fixtures'
+import type { FolderWorkspace } from '../../../shared/folder-workspace-types'
+import type { ProjectGroup } from '../../../shared/project-group-types'
+import { folderWorkspaceKey } from '../../../shared/workspace-scope'
+import { createUnreadBadgeCountSelector } from './unread-badge-count-selector'
+
+// Why: marking a folder workspace unread persists through this API; echo the write back.
+Object.assign(createTabsSliceMockApi(), {
+  folderWorkspaces: {
+    update: vi.fn(async ({ updates }: { updates: Partial<FolderWorkspace> }) => ({
+      ...makeFolderWorkspace({ connectionId: 'ssh-1' }),
+      ...updates
+    }))
+  }
+})
+
+const BELL_WORKTREE = 'repo1::/path/bell'
+const OTHER_WORKTREE = 'repo1::/path/other'
+
+type TestStore = ReturnType<typeof createTestStore>
+
+function makeProjectGroup(overrides: Partial<ProjectGroup> = {}): ProjectGroup {
+  return {
+    id: 'group-1',
+    name: 'platform',
+    parentPath: '/work',
+    parentGroupId: null,
+    createdFrom: 'manual',
+    tabOrder: 0,
+    isCollapsed: false,
+    color: null,
+    createdAt: 0,
+    updatedAt: 0,
+    ...overrides
+  }
+}
+
+function createStoreOnOtherWorktree(): TestStore {
+  const store = createTestStore()
+  store.setState({
+    repos: [{ ...TEST_REPO, executionHostId: 'local' }],
+    worktreesByRepo: {
+      repo1: [
+        makeWorktree({ id: BELL_WORKTREE, repoId: 'repo1', path: '/path/bell' }),
+        makeWorktree({ id: OTHER_WORKTREE, repoId: 'repo1', path: '/path/other' })
+      ]
+    },
+    activeWorktreeId: OTHER_WORKTREE
+  })
+  return store
+}
+
+function addTerminalTab(store: TestStore, worktreeId: string): string {
+  const unifiedTab = store.getState().createUnifiedTab(worktreeId, 'terminal')
+  const tabs = store.getState().tabsByWorktree[worktreeId] ?? []
+  store.setState({
+    tabsByWorktree: {
+      ...store.getState().tabsByWorktree,
+      [worktreeId]: [...tabs, makeTab({ id: unifiedTab.entityId, worktreeId })]
+    }
+  })
+  return unifiedTab.entityId
+}
+
+// The two writes every bell and agent completion makes.
+function raiseAttention(store: TestStore, worktreeId: string, tabId: string): void {
+  store.getState().markWorktreeUnread(worktreeId)
+  store.getState().markTerminalTabUnread(tabId, 'terminal-bell')
+}
+
+function sidebarUnreadCount(store: TestStore): number {
+  return Object.values(store.getState().worktreesByRepo)
+    .flat()
+    .filter((worktree) => worktree.isUnread).length
+}
+
+function dockCount(store: TestStore): number {
+  return createUnreadBadgeCountSelector()(store.getState())
+}
+
+describe('Dock unread count against the sidebar (#23363)', () => {
+  it('follows the workspace dot when a bell is raised and the workspace is then visited', () => {
+    const store = createStoreOnOtherWorktree()
+    const tabId = addTerminalTab(store, BELL_WORKTREE)
+
+    raiseAttention(store, BELL_WORKTREE, tabId)
+    expect(dockCount(store)).toBe(1)
+
+    store.getState().setActiveWorktree(BELL_WORKTREE)
+    store.getState().setActiveWorktree(OTHER_WORKTREE)
+
+    expect(sidebarUnreadCount(store)).toBe(0)
+    expect(dockCount(store)).toBe(0)
+  })
+
+  it('clears with the workspace dot when the user types in a sibling tab', () => {
+    const store = createStoreOnOtherWorktree()
+    const typedTabId = addTerminalTab(store, BELL_WORKTREE)
+    const bellTabId = addTerminalTab(store, BELL_WORKTREE)
+    store.getState().setActiveWorktree(BELL_WORKTREE)
+    raiseAttention(store, BELL_WORKTREE, bellTabId)
+
+    store.getState().clearTerminalTabUnread(typedTabId)
+    store.getState().clearWorktreeUnread(BELL_WORKTREE)
+
+    expect(store.getState().unreadTerminalTabs[bellTabId]).toBe('terminal-bell')
+    expect(sidebarUnreadCount(store)).toBe(0)
+    expect(dockCount(store)).toBe(0)
+  })
+
+  it('counts a flagged workspace once when the marked tab is a chat tab', () => {
+    const store = createStoreOnOtherWorktree()
+    const chatTab = store
+      .getState()
+      .createUnifiedTab(BELL_WORKTREE, 'agent-session', { id: 'session-1' })
+
+    raiseAttention(store, BELL_WORKTREE, chatTab.id)
+
+    expect(store.getState().unreadTerminalTabs[chatTab.id]).toBe('terminal-bell')
+    expect(dockCount(store)).toBe(1)
+  })
+
+  // Why one selector across writes: the App root keeps a single instance, so its cache is under test.
+  it('preserves a folder bell only while its workspace flag and live tab marker remain', () => {
+    const store = createStoreOnOtherWorktree()
+    const selectCount = createUnreadBadgeCountSelector()
+    const folderWorkspace = makeFolderWorkspace()
+    store.setState({ projectGroups: [makeP
```

**File**: `src/renderer/src/lib/unread-badge-count-selector.ts` (modified, +102/-30)
```diff
@@ -1,50 +1,122 @@
+import { getVisibleWorkspaceHostIdSet } from '@/components/sidebar/visible-worktree-host-scope'
+import { getPairedDeviceIdsByEnvironment } from '@/components/sidebar/workspace-creator-visibility'
+import { getRepoMapFromState } from '@/store/selectors'
+import type { AppState } from '@/store/types'
+import { getSettingsFocusedExecutionHostId } from '../../../shared/execution-host'
+import type { Worktree } from '../../../shared/worktree/types'
 import { sameBucketRecords } from './bucket-record-equality'
-import {
-  type UnreadBadgeCountSources,
-  type UnreadBadgeTab,
-  type UnreadBadgeWorktree,
-  getUnreadBadgeCount
-} from './unread-badge-count'
+import { getUnreadBadgeCount, hasUnreadFolderTab } from './unread-badge-count'
+import { folderWorkspaceKey } from '../../../shared/workspace-scope'
 
-const EMPTY_BUCKETS = Object.freeze({})
+type UnreadBadgeCountState = Pick<
+  AppState,
+  | 'worktreesByRepo'
+  | 'folderWorkspaces'
+  | 'projectGroups'
+  | 'repos'
+  | 'settings'
+  | 'workspaceHostScope'
+  | 'visibleWorkspaceHostIds'
+  | 'hideWorkspacesFromOtherDevices'
+  | 'runtimeEnvironments'
+  | 'runtimeStatusByEnvironmentId'
+  | 'tabsByWorktree'
+  | 'unifiedTabsByWorktree'
+  | 'unreadTerminalTabs'
+>
 
-function sameBadgeWorktree(previous: UnreadBadgeWorktree, next: UnreadBadgeWorktree): boolean {
-  return previous.id === next.id && previous.isUnread === next.isUnread
+/** The worktree fields the count reads (`id` embeds `repoId`), so equality over them is a sound cache key. */
+function sameBadgeWorktree(previous: Worktree, next: Worktree): boolean {
+  const previousCreator = previous.creatorProvenance
+  const nextCreator = next.creatorProvenance
+  return (
+    previous.runtimeOwnerEnvironmentId === next.runtimeOwnerEnvironmentId &&
+    previousCreator?.kind === nextCreator?.kind &&
+    (previousCreator?.kind !== 'paired-device' ||
+      (nextCreator?.kind === 'paired-device' &&
+        previousCreator.deviceId === nextCreator.deviceId)) &&
+    previous.id === next.id &&
+    previous.hostId === next.hostId &&
+    previous.isUnread === next.isUnread &&
+    previous.isArchived === next.isArchived
+  )
 }
 
-function sameBadgeTab(previous: UnreadBadgeTab, next: UnreadBadgeTab): boolean {
-  return previous.id === next.id
+function sameFolderAttention(
+  previous: UnreadBadgeCountState,
+  next: UnreadBadgeCountState
+): boolean {
+  if (
+    previous.tabsByWorktree === next.tabsByWorktree &&
+    previous.unifiedTabsByWorktree === next.unifiedTabsByWorktree &&
+    previous.unreadTerminalTabs === next.unreadTerminalTabs
+  ) {
+    return true
+  }
+  for (const folder of next.folderWorkspaces) {
+    if (!folder.isUnread) {
+      continue
+    }
+    const key = folderWorkspaceKey(folder.id)
+    if (hasUnreadFolderTab(previous, key) !== hasUnreadFolderTab(next, key)) {
+      return false
+    }
+  }
+  return true
+}
+
+function sameCountInputs(previous: UnreadBadgeCountState, next: UnreadBadgeCountState): boolean {
+  return (
+    previous.folderWorkspaces === next.folderWorkspaces &&
+    previous.projectGroups === next.projectGroups &&
+    previous.repos === next.repos &&
+    previous.workspaceHostScope === next.workspaceHostScope &&
+    previous.visibleWorkspaceHostIds === next.visibleWorkspaceHostIds &&
+    previous.settings?.activeRuntimeEnvironmentId === next.settings?.activeRuntimeEnvironmentId &&
+    previous.hideWorkspacesFromOtherDevices === next.hideWorkspacesFromOtherDevices &&
+    // Why gated: runtime status reallocates on remote activity and only this filter reads it.
+    (!next.hideWorkspacesFromOtherDevices ||
+      (previous.runtimeEnvironments === next.runtimeEnvironments &&
+        previous.runtimeStatusByEnvironmentId === next.runtimeStatusByEnvironmentId)) &&
+    sameBucketRecords(previous.worktreesByRepo, next.worktreesByRepo, sameBadgeWorktree) &&
+    sameFolderAttention(previous, next)
+  )
 }
 
 /**
  * Why: the App root holds this subscription for a single integer. Returning the raw maps re-rendered
  * the whole shell on every agent title frame; selecting the count instead means the subscription
  * only notifies when the badge value can actually have moved.
  *
- * Why chaining against the immediately preceding state is enough: equality over the count's read set
- * — worktree `id`/`isUnread`, tab `id`, and the unread map identity — is transitive, so a run of
- * unchanged states is equivalent to comparing against the state that produced the cached count.
+ * Why chaining against the immediately preceding state is enough: equality over the count's read
+ * set is transitive, so a run of unchanged states is equivalent to comparing against the state
+ * that produced the cached count.
  */
-export function createUnreadBadgeCountSelector(): (state: UnreadBadgeCountSources) => number {
-  let previousWorktreesByRepo: UnreadBadgeCountSources['worktreesByRepo'] = EMPTY_BUCKETS
-  let previousTabsByWorktree: UnreadBadg
```

**File**: `src/renderer/src/lib/unread-badge-count.test.ts` (modified, +145/-20)
```diff
@@ -1,44 +1,169 @@
 import { describe, expect, it } from 'vitest'
-import type { TerminalTab } from '../../../shared/terminal-tab-types'
+import { makeTab, makeWorktree, TEST_REPO } from '@/store/slices/store-test-helpers'
+import { makeFolderWorkspace } from '@/store/slices/worktrees-slice-test-fixtures'
+import type { ProjectGroup } from '../../../shared/project-group-types'
 import type { Worktree } from '../../../shared/worktree/types'
-import { getUnreadBadgeCount } from './unread-badge-count'
+import { getUnreadBadgeCount, type UnreadBadgeCountSources } from './unread-badge-count'
 
-function worktree(id: string, isUnread: boolean): Worktree {
-  return { id, isUnread } as Worktree
+function worktree(id: string, overrides: Partial<Worktree> = {}): Worktree {
+  return makeWorktree({ id, repoId: TEST_REPO.id, isUnread: true, ...overrides })
 }
 
-function tab(id: string): TerminalTab {
-  return { id } as TerminalTab
+function projectGroup(overrides: Partial<ProjectGroup> = {}): ProjectGroup {
+  return {
+    id: 'group-1',
+    name: 'platform',
+    parentPath: '/work',
+    parentGroupId: null,
+    createdFrom: 'manual',
+    tabOrder: 0,
+    isCollapsed: false,
+    color: null,
+    createdAt: 0,
+    updatedAt: 0,
+    ...overrides
+  }
+}
+
+function count(overrides: Partial<UnreadBadgeCountSources>): number {
+  return getUnreadBadgeCount({
+    worktreesByRepo: {},
+    folderWorkspaces: [],
+    projectGroups: [projectGroup()],
+    repoMap: new Map([[TEST_REPO.id, TEST_REPO]]),
+    visibleHostIds: null,
+    defaultHostId: 'local',
+    hiddenOtherDevicePairings: null,
+    ...overrides,
+    // These visibility fixtures represent folder bells with live tab owners.
+    tabsByWorktree:
+      overrides.tabsByWorktree ??
+      Object.fromEntries(
+        (overrides.folderWorkspaces ?? []).map((folder) => [
+          `folder:${folder.id}`,
+          [makeTab({ id: `bell:${folder.id}`, worktreeId: `folder:${folder.id}` })]
+        ])
+      ),
+    unreadTerminalTabs:
+      overrides.unreadTerminalTabs ??
+      Object.fromEntries(
+        (overrides.folderWorkspaces ?? []).map((folder) => [
+          `bell:${folder.id}`,
+          'terminal-bell' as const
+        ])
+      )
+  })
 }
 
 describe('getUnreadBadgeCount', () => {
   it('counts unread worktrees', () => {
     expect(
-      getUnreadBadgeCount({
-        worktreesByRepo: { repo: [worktree('wt-1', true), worktree('wt-2', false)] },
-        tabsByWorktree: {},
-        unreadTerminalTabs: {}
+      count({
+        worktreesByRepo: { repo1: [worktree('wt-1'), worktree('wt-2', { isUnread: false })] }
       })
     ).toBe(1)
   })
 
-  it('dedupes unread terminal tabs against their worktree', () => {
+  it('skips archived worktrees, which the sidebar never shows', () => {
+    expect(count({ worktreesByRepo: { repo1: [worktree('wt-1', { isArchived: true })] } })).toBe(0)
+  })
+
+  it('preserves id-only deduplication across execution hosts', () => {
+    const rows = [worktree('wt-1', { hostId: 'local' }), worktree('wt-1', { hostId: 'ssh:remote' })]
+    expect(count({ worktreesByRepo: { repo1: rows } })).toBe(1)
+    expect(count({ worktreesByRepo: { repo1: rows }, visibleHostIds: new Set(['local']) })).toBe(1)
+  })
+
+  it('counts a row repeated across repo buckets once', () => {
     expect(
-      getUnreadBadgeCount({
-        worktreesByRepo: { repo: [worktree('wt-1', true)] },
-        tabsByWorktree: { 'wt-1': [tab('tab-1'), tab('tab-2')] },
-        unreadTerminalTabs: { 'tab-1': true, 'tab-2': true }
+      count({
+        worktreesByRepo: {
+          'repo-a': [worktree('wt-1', { hostId: 'local' })],
+          'repo-b': [worktree('wt-1', { hostId: 'local' })]
+        }
       })
     ).toBe(1)
   })
 
-  it('counts tab-only unread activity by owning worktree', () => {
+  it('counts unread folder workspaces alongside worktrees', () => {
     expect(
-      getUnreadBadgeCount({
-        worktreesByRepo: { repo: [worktree('wt-1', false), worktree('wt-2', false)] },
-        tabsByWorktree: { 'wt-1': [tab('tab-1')], 'wt-2': [tab('tab-2')] },
-        unreadTerminalTabs: { 'tab-1': true, 'tab-2': true }
+      count({
+        worktreesByRepo: { repo1: [worktree('wt-1')] },
+        folderWorkspaces: [
+          makeFolderWorkspace({ id: 'folder-1', isUnread: true }),
+          makeFolderWorkspace({ id: 'folder-2' })
+        ]
       })
     ).toBe(2)
   })
+
+  it('uses the same other-device policy for git worktrees as for folder rows', () => {
+    const foreign = worktree('foreign', {
+      creatorProvenance: { kind: 'paired-device', deviceId: 'phone' }
+    })
+    expect(count({ worktreesByRepo: { repo1: [foreign] } })).toBe(1)
+    expect(
+      count({ worktreesByRepo: { repo1: [foreign] }, hiddenOtherDevicePairings: new Map() })
+    ).toBe(0)
+    const runtimeOwned = { ...foreign, runtimeOwnerEnvironmentId: 'env' }
+    expect(
+      count({
+        worktreesByRepo: { repo1: [runtimeOwned] }
```

**File**: `src/renderer/src/lib/unread-badge-count.ts` (modified, +80/-32)
```diff
@@ -1,47 +1,95 @@
+import {
+  filterFolderWorkspacesForVisibleHosts,
+  filterProjectGroupsForVisibleHosts
+} from '@/components/sidebar/worktree-list/listing/host-filtering'
+import { getRenderableFolderWorkspaces } from '@/components/sidebar/worktree-list/grouping/folder-workspace-lanes'
+import { worktreeMatchesVisibleHost } from '@/components/sidebar/visible-worktree-host-scope'
+import {
+  filterFolderWorkspacesFromOtherDevices,
+  isWorkspaceFromOtherDevice
+} from '@/components/sidebar/workspace-creator-visibility'
+import type { ExecutionHostId } from '../../../shared/execution-host'
+import type { FolderWorkspace } from '../../../shared/folder-workspace-types'
+import type { ProjectGroup } from '../../../shared/project-group-types'
+import type { Repo } from '../../../shared/repo-types'
+import { folderWorkspaceKey } from '../../../shared/workspace-scope'
 import type { StoredAgentAttentionUnread } from '@/attention/agent-attention-contract'
 import type { TerminalTab } from '../../../shared/terminal-tab-types'
+import type { Tab } from '../../../shared/tab-types'
 import type { Worktree } from '../../../shared/worktree/types'
 
-/** The only fields the count reads, so a projection over them is a sound cache key. */
-export type UnreadBadgeWorktree = Pick<Worktree, 'id' | 'isUnread'>
-export type UnreadBadgeTab = Pick<TerminalTab, 'id'>
-
 export type UnreadBadgeCountSources = {
-  worktreesByRepo: Readonly<Record<string, readonly UnreadBadgeWorktree[]>>
-  tabsByWorktree: Readonly<Record<string, readonly UnreadBadgeTab[]>>
-  unreadTerminalTabs: Readonly<Record<string, StoredAgentAttentionUnread>>
+  worktreesByRepo: Readonly<Record<string, readonly Worktree[]>>
+  folderWorkspaces: readonly FolderWorkspace[]
+  projectGroups: readonly ProjectGroup[]
+  repoMap: Map<string, Repo>
+  /** null when the sidebar shows every host. */
+  visibleHostIds: ReadonlySet<ExecutionHostId> | null
+  defaultHostId: ExecutionHostId
+  /** null unless the sidebar hides workspaces created from other devices. */
+  hiddenOtherDevicePairings: ReadonlyMap<string, string> | null
+  tabsByWorktree?: Readonly<Record<string, readonly Pick<TerminalTab, 'id'>[]>>
+  unifiedTabsByWorktree?: Readonly<Record<string, readonly Pick<Tab, 'id' | 'contentType'>[]>>
+  unreadTerminalTabs?: Readonly<Record<string, StoredAgentAttentionUnread>>
 }
 
-export function getUnreadBadgeCount({
-  worktreesByRepo,
-  tabsByWorktree,
-  unreadTerminalTabs
-}: UnreadBadgeCountSources): number {
-  const unreadWorktreeIds = new Set<string>()
+export function hasUnreadFolderTab(
+  sources: Pick<
+    UnreadBadgeCountSources,
+    'tabsByWorktree' | 'unifiedTabsByWorktree' | 'unreadTerminalTabs'
+  >,
+  key: string
+): boolean {
+  return Boolean(
+    sources.tabsByWorktree?.[key]?.some((tab) => sources.unreadTerminalTabs?.[tab.id]) ||
+    sources.unifiedTabsByWorktree?.[key]?.some(
+      (tab) => tab.contentType === 'agent-session' && sources.unreadTerminalTabs?.[tab.id]
+    )
+  )
+}
 
-  for (const worktrees of Object.values(worktreesByRepo)) {
+/** Workspace flags clear on a visit; tab markers can outlive that visit or their owner. */
+export function getUnreadBadgeCount(sources: UnreadBadgeCountSources): number {
+  const { visibleHostIds, defaultHostId } = sources
+  // Preserve the existing id-only count while narrowing it to visible hosts.
+  const unreadWorktrees = new Set<string>()
+  for (const worktrees of Object.values(sources.worktreesByRepo)) {
     for (const worktree of worktrees) {
-      if (worktree.isUnread) {
-        unreadWorktreeIds.add(worktree.id)
+      // Why: the sidebar never renders an archived worktree, nor one on a host it is not showing.
+      if (
+        worktree.isUnread &&
+        !worktree.isArchived &&
+        (!sources.hiddenOtherDevicePairings ||
+          !isWorkspaceFromOtherDevice(worktree, sources.hiddenOtherDevicePairings)) &&
+        worktreeMatchesVisibleHost(worktree, visibleHostIds, sources.repoMap, defaultHostId)
+      ) {
+        unreadWorktrees.add(worktree.id)
       }
     }
   }
+  return unreadWorktrees.size + countUnreadFolderRows(sources)
+}
 
-  const unreadTabIds = new Set(Object.keys(unreadTerminalTabs))
-  if (unreadTabIds.size === 0) {
-    return unreadWorktreeIds.size
-  }
-
-  for (const [worktreeId, tabs] of Object.entries(tabsByWorktree)) {
-    for (const tab of tabs) {
-      if (!unreadTabIds.delete(tab.id)) {
-        continue
-      }
-      unreadWorktreeIds.add(worktreeId)
-    }
+/** Folder workspaces through the same membership steps the sidebar runs before building rows. */
+function countUnreadFolderRows(sources: UnreadBadgeCountSources): number {
+  const { projectGroups, visibleHostIds, defaultHostId, hiddenOtherDevicePairings } = sources
+  const unread = sources.folderWorkspaces.filter(
+    (folder) => folder.isUnread && hasUnreadFolderTab(sources, folderWorkspaceKey(folder.id))
+  )
+  if (unread.length === 0) {
+    return 0
   }
-
-  // Why: t
```

---

### Incident Patch 6: `0e9e273b` (2026-10-06)
**Commit Message**: fix(relay): deploy driver builds the checked commit, prompts on their own line, summarises progress (#25755)

* fix(relay): publish the reviewed commit before main can move, and quiet the deploy driver

The publish workflow builds main's head at dispatch. The driver checked main
at preflight but dispatched the publish about four minutes later, after the
inspects and the typed phrase, so a busy main stopped the first real deploy.
It now dispatches the publish seconds after the check, before anything else,
and a build of a moved main stops with the --commit/--publish-run command that
deploys it once reviewed. Typed prompts end in a newline, and runs are
summarised (status changes plus every 5 min) instead of streaming gh run watch.

* fix(relay): a main-moved stop prints only the command that reuses the build

The generic re-run line named the reviewed commit without --publish-run, which
would only build the moved main again.

**File**: `cloud/dev/scripts/drive-relay-director-deploy.mjs` (modified, +69/-44)
```diff
@@ -60,6 +60,9 @@ const DIRECTOR_5XX_FILTER = [
 const LOG_COUNT_LIMIT = 5_000
 const LOG_ATTEMPTS = 6
 const LOG_INTERVAL_MS = 10_000
+const WATCH_INTERVAL_MS = 10_000
+// A run still going is reported this often, so a long monitor never looks hung.
+const WATCH_REPORT_MS = 5 * 60_000
 const REHOME_HISTORY_RUNS = 5
 const RUN_ID = /^[1-9][0-9]*$/
 
@@ -118,6 +121,7 @@ export function createDriver(config, deps) {
   // A pause or enable this run cannot vouch for: `changing` while it may still apply on its own,
   // `unconfirmed` once it finished without a usable result. { kind, name, runId?, url? }
   let uncertain
+  let movedBuild // { commit, runId }: a publish that built a newer main than the reviewed commit
   let login
   const ownRunIds = new Set()
   let enabled = false
@@ -205,18 +209,24 @@ export function createDriver(config, deps) {
     )
   }
 
+  // One line per status change and one every WATCH_REPORT_MS, never a stream of job steps.
   async function waitForRun(run) {
+    const started = deps.now()
+    let reported
+    let reportedAt
     for (;;) {
-      deps.stream(
-        'gh',
-        words(`run watch ${run.runId} -R ${REPOSITORY} --exit-status --interval 10`)
-      )
       const view = viewRun(run.runId)
       if (view.status === 'completed') {
         log(`${run.name}: ${view.conclusion} ${run.url}`)
         return { ...run, conclusion: view.conclusion, attempt: view.attempt }
       }
-      await deps.sleep(LOG_INTERVAL_MS)
+      if (view.status !== reported || deps.now() - reportedAt >= WATCH_REPORT_MS) {
+        const minutes = Math.floor((deps.now() - started) / 60_000)
+        log(`${run.name}: ${view.status}, ${minutes} min`)
+        reported = view.status
+        reportedAt = deps.now()
+      }
+      await deps.sleep(WATCH_INTERVAL_MS)
     }
   }
 
@@ -298,7 +308,8 @@ export function createDriver(config, deps) {
 
   async function typed(phrase, meaning = '') {
     if (typedPhrases.has(phrase)) return phrase
-    const answer = (await deps.prompt(`Type ${phrase} to continue${meaning}: `)).trim()
+    // Ends in a newline, so the prompt is never left mid-line where it can be missed.
+    const answer = (await deps.prompt(`Type ${phrase} to continue${meaning}:\n`)).trim()
     if (answer !== phrase)
       throw new DriverStop(`expected ${phrase}; nothing further was dispatched`)
     typedPhrases.set(phrase, answer)
@@ -314,8 +325,9 @@ export function createDriver(config, deps) {
       throw new DriverStop(`${runUrl(runId)} is not a successful ${WORKFLOWS.publish.file} run`)
     }
     if (view.headSha !== config.commit) {
+      movedBuild = { commit: view.headSha, runId }
       throw new DriverStop(
-        `publish ${runUrl(runId)} built ${view.headSha}, not the reviewed ${config.commit}; do not deploy it`
+        `publish ${runUrl(runId)} built ${view.headSha}, not the reviewed ${config.commit}: main moved`
       )
     }
     const tag = `${IMAGE_REPOSITORY}:sha-${config.commit}`
@@ -488,24 +500,6 @@ export function createDriver(config, deps) {
     } else {
       requireQuietLane()
     }
-    if (published) {
-      published.digest = await publishedDigest(published.runId)
-    } else {
-      const main = gh(['api', `repos/${REPOSITORY}/commits/${WORKFLOW_REF}`, '--jq', '.sha']).trim()
-      if (main !== config.commit) {
-        throw new DriverStop(
-          `${WORKFLOW_REF} is at ${main}, not the reviewed ${config.commit}; review the difference and run with --commit ${main}`
-        )
-      }
-    }
-    known.director = readDirector()
-    if (known.director.servingDigest !== published?.digest) {
-      rollbackPoint = {
-        revision: known.director.servingRevision,
-        digest: known.director.servingDigest
-      }
-    }
-    log(describeDirector(known.director))
     let claim
     if (config.pauseRun) {
       // Only this operator's own rehome-control run can prove a pause belongs to this driver.
@@ -530,6 +524,27 @@ export function createDriver(config, deps) {
         )
       }
     }
+    if (published) {
+      published.digest = await publishedDigest(published.runId)
+    } else {
+      const main = gh(['api', `repos/${REPOSITORY}/commits/${WORKFLOW_REF}`, '--jq', '.sha']).trim()
+      if (main !== config.commit) {
+        throw new DriverStop(
+          `${WORKFLOW_REF} is at ${main}, not the reviewed ${config.commit}; review the difference and run with --commit ${main}`
+        )
+      }
+      // The workflow builds main's head at dispatch, so it is dispatched seconds after the check
+      // rather than after the inspects and the typed phrase; publishing changes nothing serving.
+      if (!config.dryRun) await publishStep.run(publishStep)
+    }
+    known.director = readDirector()
+    if (known.director.servingDigest !== published?.digest) {
+      rollbackPoint = {
+        revision: known.director.servingRevision,
+        digest: known.director.servingDigest
+      }
+    }
+    log(describeDirect
```

**File**: `cloud/dev/scripts/drive-relay-director-deploy.test.mjs` (modified, +71/-17)
```diff
@@ -264,6 +264,7 @@ function gh(world, args, input) {
       key: `${workflow.file}:${inputs.mode ?? 'deploy'}`,
       dispatched: true,
       headSha: world.main,
+      polls: world.polls?.[`${workflow.file}:${inputs.mode ?? 'deploy'}`] ?? 0,
       artifacts: {},
       log: ''
     }
@@ -284,9 +285,12 @@ function gh(world, args, input) {
     return world.unreadableLogs?.(run) ? { status: 1, stdout: '', stderr: 'HTTP 502' } : ok(run.log)
   }
   if (args[1] === 'view') {
+    world.onView?.(run)
+    const running = run.polls > 0
+    if (running) run.polls -= 1
     return ok({
-      status: 'completed',
-      conclusion: run.conclusion,
+      status: running ? 'in_progress' : 'completed',
+      conclusion: running ? '' : run.conclusion,
       attempt: 1,
       headSha: run.headSha,
       headBranch: 'main',
@@ -353,7 +357,6 @@ function dependencies(world) {
   return {
     run: (program, args, input) =>
       program === 'gh' ? gh(world, args, input) : gcloud(world, args),
-    stream: () => 0,
     now: () => world.now,
     sleep: async (ms) => {
       world.now += ms
@@ -418,13 +421,13 @@ const MONITOR = `${WORKFLOWS.monitor.file}:dry-run`
 const report = (world) => world.printed.join('\n')
 const live = (world) => [world.control.generation, world.control.enabled]
 
-test('publishes before pausing, types every phrase, and enables on the digests now serving', async () => {
+test('publishes first, types every phrase, and enables on the digests now serving', async () => {
   const world = fakeWorld()
   assert.equal((await start(world)).done, true)
   assert.deepEqual(keys(world), [
+    'publish-relay-production:publish',
     'operate-relay-asia-admission:inspect',
     'operate-relay-production-rehome:inspect',
-    'publish-relay-production:publish',
     'operate-relay-production-rehome:pause',
     'deploy-relay-production-director:deploy',
     'operate-relay-production-rehome:inspect',
@@ -436,6 +439,7 @@ test('publishes before pausing, types every phrase, and enables on the digests n
     'PAUSE_REGIONAL_REHOMING',
     'ENABLE_REGIONAL_REHOMING'
   ])
+  assert.ok(world.questions.every((question) => question.endsWith('\n')))
   assert.ok(
     world.questions.some((question) =>
       question.includes(
@@ -467,10 +471,11 @@ test('publishes before pausing, types every phrase, and enables on the digests n
   assert.deepEqual(live(world), [41, true])
 })
 
-test('a wrong phrase stops before the first mutation', async () => {
+test('a wrong phrase stops before rehome or the director is touched', async () => {
   const world = fakeWorld({ answer: () => 'yes' })
   assert.match((await stopped(start(world))).message, /expected DEPLOY aaaaaaaaaaaa/)
   assert.deepEqual(keys(world), [
+    'publish-relay-production:publish',
     'operate-relay-asia-admission:inspect',
     'operate-relay-production-rehome:inspect'
   ])
@@ -482,7 +487,9 @@ test('F2: rehome found paused is never adopted; --leave-rehome-paused deploys an
     (await stopped(start(world))).message,
     /did not pause it.*--pause-run.*--leave-rehome-paused/s
   )
-  assert.equal(dispatched(world, PUBLISH).length, 0)
+  assert.match(report(world), /drive-relay-director-deploy\.mjs .*--publish-run \d+/)
+  await rerun(world).catch(() => {})
+  assert.equal(dispatched(world, PUBLISH).length, 1)
   await start(world, ['--leave-rehome-paused'])
   assert.equal(
     dispatched(world, REHOME('pause')).length + dispatched(world, REHOME('enable')).length,
@@ -509,11 +516,60 @@ test('F2: main moving is caught before any rehome change, and after the pause it
   assert.deepEqual(live(world), [41, true])
 })
 
+test('ops-log 22:59Z: main moving during the inspects and the typed phrase no longer stops the deploy', async () => {
+  const world = fakeWorld()
+  const deps = dependencies(world)
+  const run = deps.run
+  deps.run = (program, args, input) => {
+    const result = run(program, args, input)
+    if (args[0] === 'workflow' && JSON.parse(input).mode === 'inspect') world.main = 'b'.repeat(40)
+    return result
+  }
+  assert.equal((await start(world, [], deps)).done, true)
+  assert.equal(dispatched(world, PUBLISH)[0].headSha, COMMIT)
+  assert.equal(dispatched(world, DEPLOY)[0].inputs['image-digest'], NEW)
+})
+
+test('main moving between the check and the publish stops untouched, naming the reuse command', async () => {
+  const world = fakeWorld()
+  const deps = dependencies(world)
+  const run = deps.run
+  deps.run = (program, args, input) => {
+    if (args[0] === 'workflow') world.main = 'b'.repeat(40)
+    return run(program, args, input)
+  }
+  assert.match((await stopped(start(world, [], deps))).message, /main moved/)
+  const publishRun = String(dispatched(world, PUBLISH)[0].id)
+  assert.deepEqual(keys(world), ['publish-relay-production:publish'])
+  // The only command printed is the one that reuses the build.
+  const commands = world.printed.filter((line) => line.includes('&& node dev/scripts/'))
+  assert.equ
```

**File**: `cloud/docs/relay-workflows.md` (modified, +8/-5)
```diff
@@ -720,11 +720,14 @@ do, so it never reports success over a pause it cannot explain.
 
 The sequence:
 
-1. **Preflight, read-only.** No `cloud-*` workflow is queued or running (all pages; the hourly
-   clock-skew monitor and `cloud-verify` excepted), and `main` is the reviewed commit.
-2. **Publish**, after the operator types `DEPLOY <commit prefix>`. It runs before rehome is touched,
-   so a moved `main` or a bad build needs no cleanup. The digest is the registry digest of
-   `relay:sha-<commit>`, and the run's own push line must name the same digest.
+1. **Publish.** No `cloud-*` workflow is queued or running (all pages; the hourly clock-skew
+   monitor and `cloud-verify` excepted), and `main` is the reviewed commit. The publish workflow
+   builds whatever `main` is when it is dispatched, so the driver dispatches it straight after that
+   check, before the inspects and the typed phrase. It changes nothing serving, so a bad build needs
+   no cleanup. The digest is the registry digest of `relay:sha-<commit>`, and the run's own push
+   line must name the same digest. If `main` still moved in those seconds, the driver stops and
+   names the `--commit <built> --publish-run <run>` that deploys that build once it is reviewed.
+2. **Preflight, read-only**, then the operator types `DEPLOY <commit prefix>`.
 3. **Pause**, only if rehome is enabled, after the operator types `PAUSE_REGIONAL_REHOMING`.
 4. **Deploy** with that digest, the paused generation, `preserve` for both regional inputs, no
    prune, and the old serving digest as predecessor.
```

---

### Incident Patch 7: `420447e0` (2026-10-06)
**Commit Message**: fix(agent-status): retire a removed worktree's hook-status rows (#23881)

* fix(agent-status): retire a removed worktree's hook-status rows

Rows whose terminal was never reattached had no teardown path, so they
outlived the worktree in last-status.json for up to 7 days.

Fixes #23068

* fix(agent-status): skip panes another owner has since reclaimed

* fix(agent-status): clear only the removed owner's claims on a shared pane

* fix(agent-status): retire hook-status rows a host scan proved removed

`worktrees:forgetRemovedForExecutionHost` is the only path that ever retires an
off-host WorktreeMeta row: gcStaleWorktreeMeta skips any row whose repo or
hostId is not local. It already prunes the cleanup and space-analysis snapshots
for a worktree a remote scan proved gone, but left that worktree's hook-status
rows behind in `last-status.json` — the same stranding this branch fixes for the
in-Orca delete, reached through the other trigger.

A scan the host answered is positive evidence of removal rather than loss of
contact, so it is the host evidence `ssh-execution-boundary.md` requires, and it
publishes no verdict. The drop is scoped to the scanned host's id, so a same-id
worktree on

**File**: `docs/reference/agent-status-store.md` (modified, +5/-5)
```diff
@@ -26,11 +26,11 @@ the structured-session mapping and nothing else.
 An audit on 2026-09-09 found six producers and three consumers, and three
 separate copies of the same row inside the main process alone:
 
-| Main-process copy                 | Keyed by  | Owned by                                                                          | Persisted          | Evicted                      |
-| --------------------------------- | --------- | --------------------------------------------------------------------------------- | ------------------ | ---------------------------- |
-| hook server `lastStatusByPaneKey` | paneKey   | `src/main/agent-hooks/server.ts`                                                  | `last-status.json` | tab close, pty exit, hydrate |
-| runtime `RuntimeAgentRowStore`    | paneKey   | `runtime-agent-row-store.ts` (deleted in PR 1b)                                   | no                 | pty exit only                |
-| structured feed `published`       | sessionId | `src/main/native-chat/agent-session-wire/structured-agent-session-status-feed.ts` | no                 | never (a broadcast cache)    |
+| Main-process copy                 | Keyed by  | Owned by                                                                          | Persisted          | Evicted                                        |
+| --------------------------------- | --------- | --------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------- |
+| hook server `lastStatusByPaneKey` | paneKey   | `src/main/agent-hooks/server.ts`                                                  | `last-status.json` | tab close, pty exit, hydrate, worktree removal |
+| runtime `RuntimeAgentRowStore`    | paneKey   | `runtime-agent-row-store.ts` (deleted in PR 1b)                                   | no                 | pty exit only                                  |
+| structured feed `published`       | sessionId | `src/main/native-chat/agent-session-wire/structured-agent-session-status-feed.ts` | no                 | never (a broadcast cache)                      |
 
 The second copy is a duplicate write: the OSC status parsed in main is
 forwarded to the hook server _and_ retained in the runtime store from the same
```

**File**: `src/main/agent-hooks/server-removed-worktree-foreign-authority.test.ts` (added, +283/-0)
```diff
@@ -0,0 +1,283 @@
+import { createHash } from 'node:crypto'
+import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { afterEach, beforeEach, describe, expect, it } from 'vitest'
+import { AgentHookServer, _internals } from './server'
+import { makePaneKey } from '../../shared/stable-pane-id'
+import { LEAF_1 } from './server.test-fixtures'
+
+const REMOVED = 'repo::/removed'
+const KEPT = 'repo::/kept'
+const PANE = makePaneKey('tab-foreign', LEAF_1)
+const TOKEN = 'foreign-launch'
+const HASH = createHash('sha256').update(TOKEN).digest('hex')
+const working = { state: 'working', prompt: 'live', agentType: 'codex' } as const
+
+describe('removed-worktree foreign authority', () => {
+  let userDataPath: string
+  beforeEach(() => {
+    _internals.resetCachesForTests()
+    userDataPath = mkdtempSync(join(tmpdir(), 'orca-foreign-authority-'))
+  })
+  afterEach(() => rmSync(userDataPath, { recursive: true, force: true }))
+
+  it('preserves ordinary tokenless OSC after a tokened new turn revives a pane', () => {
+    const server = new AgentHookServer()
+    server.retirePaneAuthority(PANE)
+    server.ingestRemote(
+      {
+        paneKey: PANE,
+        tabId: 'tab-foreign',
+        worktreeId: KEPT,
+        launchToken: TOKEN,
+        source: 'codex',
+        hookEventName: 'SessionStart',
+        payload: working
+      },
+      null
+    )
+    server.ingestTerminalStatus({
+      paneKey: PANE,
+      tabId: 'tab-foreign',
+      worktreeId: KEPT,
+      connectionId: null,
+      payload: { ...working, state: 'done' }
+    })
+    expect(server.getStatusSnapshot()).toMatchObject([{ worktreeId: KEPT, state: 'done' }])
+    server.stop()
+  })
+
+  it('keeps foreign hydrated evidence when a removed commitment outlives its row', async () => {
+    const seed = new AgentHookServer()
+    await seed.start({ env: 'production', userDataPath })
+    seed.ingestRemote(
+      {
+        paneKey: PANE,
+        tabId: 'tab-foreign',
+        worktreeId: KEPT,
+        launchToken: TOKEN,
+        payload: working
+      },
+      'user@box'
+    )
+    seed.flushStatusPersistSync()
+    seed.stop()
+    const server = new AgentHookServer()
+    await server.start({ env: 'production', userDataPath })
+    try {
+      server.ingestRemote(
+        {
+          paneKey: PANE,
+          tabId: 'tab-foreign',
+          worktreeId: REMOVED,
+          launchToken: 'removed-launch',
+          payload: working
+        },
+        null
+      )
+      server.ingestTerminalStatus({
+        paneKey: PANE,
+        tabId: 'tab-foreign',
+        worktreeId: KEPT,
+        connectionId: 'user@box',
+        payload: working
+      })
+      server.dropStatusEntriesForRemovedWorktree(REMOVED, 'local')
+      expect(server.getStatusSnapshot()).toMatchObject([
+        { worktreeId: KEPT, connectionId: 'user@box' }
+      ])
+      expect(
+        server.attestCompatibilityAuthority({
+          paneKey: PANE,
+          launchTokenHash: HASH,
+          connectionId: 'user@box',
+          terminalProvenance: 'restored'
+        })
+      ).toEqual({ paneKey: PANE, source: 'hydrated_commitment' })
+      expect(server.getCurrentAuthorityObservations()).toEqual([])
+      server.flushStatusPersistSync()
+      const file = JSON.parse(
+        readFileSync(join(userDataPath, 'agent-hooks', 'last-status.json'), 'utf8')
+      )
+      expect(file.authorityCommitments[PANE]).toBeUndefined()
+    } finally {
+      server.stop()
+    }
+  })
+
+  it.each([
+    { owner: REMOVED, connectionId: null },
+    { owner: KEPT, connectionId: 'user@box' },
+    { owner: REMOVED, connectionId: 'user@box' }
+  ])(
+    'revokes hydrated evidence only for removed $owner on $connectionId',
+    async ({ owner, connectionId }) => {
+      const token = connectionId === null ? 'removed-launch' : TOKEN
+      const hash = createHash('sha256').update(token).digest('hex')
+      const seed = new AgentHookServer()
+      await seed.start({ env: 'production', userDataPath })
+      seed.ingestRemote(
+        {
+          paneKey: PANE,
+          tabId: 'tab-foreign',
+          worktreeId: owner,
+          launchToken: token,
+          payload: working
+        },
+        connectionId
+      )
+      seed.flushStatusPersistSync()
+      seed.stop()
+
+      const server = new AgentHookServer()
+      await server.start({ env: 'production', userDataPath })
+      const attest = () =>
+        server.attestCompatibilityAuthority({
+          paneKey: PANE,
+          launchTokenHash: hash,
+          connectionId,
+          terminalProvenance: 'restored'
+        })
+      try {
+        expect(attest()).toEqual({ paneKey: PANE, source: 'hydrated_commitment' })
+        server.ingestRemote(
+          {
+            paneKey: PANE,
+            tabId: 'tab-foreign',
+            worktreeId: KEPT,
+            launchToken: TOKEN,
+            payload: w
```

**File**: `src/main/agent-hooks/server-removed-worktree-status.test.ts` (added, +175/-0)
```diff
@@ -0,0 +1,175 @@
+import { afterEach, beforeEach, describe, expect, it } from 'vitest'
+import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { AgentHookServer, _internals } from './server'
+import { makePaneKey } from '../../shared/stable-pane-id'
+import { LEAF_1, LEAF_2, LEAF_3, LEAF_4, LEAF_5, recentTs } from './server.test-fixtures'
+
+const REMOVED = 'repo-1::/workspace/removed'
+const KEPT = 'repo-1::/workspace/kept'
+const LOCAL_PANE = makePaneKey('tab-local', LEAF_1)
+const WSL_PANE = makePaneKey('tab-wsl', LEAF_2)
+const SSH_PANE = makePaneKey('tab-ssh', LEAF_3)
+const SSH_COMMITMENT_PANE = makePaneKey('tab-ssh-idle', LEAF_4)
+const OTHER_PANE = makePaneKey('tab-other', LEAF_5)
+
+function row(paneKey: string, worktreeId: string, connectionId: string | null) {
+  const receivedAt = recentTs()
+  return {
+    paneKey,
+    tabId: paneKey.split(':')[0],
+    worktreeId,
+    connectionId,
+    receivedAt,
+    stateStartedAt: receivedAt,
+    payload: { state: 'working', prompt: 'stranded', agentType: 'codex' }
+  }
+}
+
+describe('AgentHookServer removed-worktree retirement', () => {
+  let userDataPath: string
+  const lastStatusPath = () => join(userDataPath, 'agent-hooks', 'last-status.json')
+
+  beforeEach(() => {
+    _internals.resetCachesForTests()
+    userDataPath = mkdtempSync(join(tmpdir(), 'orca-removed-worktree-'))
+    mkdirSync(join(userDataPath, 'agent-hooks'), { recursive: true })
+    writeFileSync(
+      lastStatusPath(),
+      JSON.stringify({
+        version: 2,
+        entries: {
+          [LOCAL_PANE]: row(LOCAL_PANE, REMOVED, null),
+          [WSL_PANE]: row(WSL_PANE, REMOVED, 'wsl:Ubuntu'),
+          [SSH_PANE]: row(SSH_PANE, REMOVED, 'user@box'),
+          [OTHER_PANE]: row(OTHER_PANE, KEPT, null)
+        }
+      }),
+      'utf8'
+    )
+  })
+
+  afterEach(() => {
+    rmSync(userDataPath, { recursive: true, force: true })
+  })
+
+  it('retires only the removing host rows and commitments, then persists the pruned map', async () => {
+    const server = new AgentHookServer()
+    await server.start({ env: 'production', userDataPath })
+    try {
+      // An SSH commitment recorded this session outlives its row across a disconnect clear.
+      server.ingestRemote(
+        {
+          paneKey: SSH_COMMITMENT_PANE,
+          tabId: 'tab-ssh-idle',
+          worktreeId: REMOVED,
+          launchToken: 'idle-launch',
+          payload: { state: 'working', prompt: 'idle', agentType: 'codex' }
+        },
+        'idle@box'
+      )
+      server.clearStatusEntriesForConnection('idle@box')
+      const persisted = () => {
+        server.flushStatusPersistSync()
+        const file = JSON.parse(readFileSync(lastStatusPath(), 'utf8'))
+        return {
+          entries: Object.keys(file.entries).sort(),
+          commitments: Object.keys(file.authorityCommitments ?? {})
+        }
+      }
+
+      server.dropStatusEntriesForRemovedWorktree(REMOVED, 'runtime:env-1')
+      expect(persisted().entries).toHaveLength(4)
+
+      server.dropStatusEntriesForRemovedWorktree(REMOVED, 'local')
+      expect(persisted()).toEqual({
+        entries: [OTHER_PANE, SSH_PANE].sort(),
+        commitments: [SSH_COMMITMENT_PANE]
+      })
+
+      server.dropStatusEntriesForRemovedWorktree(REMOVED, 'ssh:user%40box')
+      expect(persisted()).toEqual({ entries: [OTHER_PANE], commitments: [SSH_COMMITMENT_PANE] })
+
+      server.dropStatusEntriesForRemovedWorktree(REMOVED, 'ssh:idle%40box')
+      expect(persisted().commitments).toEqual([])
+    } finally {
+      server.stop()
+    }
+  })
+
+  it('fences only the retired pane, so its kept tab still reports a new agent', async () => {
+    const server = new AgentHookServer()
+    await server.start({ env: 'production', userDataPath })
+    try {
+      server.dropStatusEntriesForRemovedWorktree(REMOVED, 'local')
+      const newPane = makePaneKey('tab-local', '66666666-6666-4666-8666-666666666666')
+      const done = { state: 'done', prompt: 'late', agentType: 'codex' } as const
+      server.ingestTerminalStatus({ paneKey: LOCAL_PANE, connectionId: null, payload: done })
+      server.ingestTerminalStatus({ paneKey: newPane, connectionId: null, payload: done })
+
+      const panes = server.getStatusSnapshot().map((entry) => entry.paneKey)
+      expect(panes).toContain(newPane)
+      expect(panes).not.toContain(LOCAL_PANE)
+    } finally {
+      server.stop()
+    }
+  })
+
+  it.each([
+    { occupant: 'the removed worktree', sshWorktree: KEPT, localWorktree: REMOVED, host: 'local' },
+    {
+      occupant: 'another owner',
+      sshWorktree: REMOVED,
+      localWorktree: KEPT,
+      host: 'ssh:user%40box'
+    }
+  ] as const)(
+    'decides a reused pane by its occupant: $occupant',
+    async ({ sshWorktree, localWorktree, host }) => {
+      const server = new AgentHookServer()
+      await server.st
```

**File**: `src/main/agent-hooks/server/server-cleanup.ts` (modified, +81/-0)
```diff
@@ -1,11 +1,19 @@
 import type { AgentProcessPresence } from '../../../shared/agent-process-presence'
 import {
   admitLegacyAgentStatus,
+  clearPaneCacheState,
   deleteLegacyAgentStatus,
   paneHasStateClaims
 } from '../../../shared/agent-hook-listener/listener-state'
 import { AGENT_STATUS_2A_CURRENT_PRODUCER_MODE } from '../../../shared/agent-status-legacy-adapter'
 import type { AgentStatusCacheIdentity } from '../../../shared/agent-status-types'
+import {
+  ALL_EXECUTION_HOSTS_SCOPE,
+  parseExecutionHostId,
+  type ExecutionHostScope
+} from '../../../shared/execution-host'
+import { worktreeIdsEqual } from '../../../shared/worktree/id'
+import { isWslHookRelayConnectionId } from '../../../shared/wsl-hook-relay-contract'
 import type { EnrichedAgentHookEventPayload } from './server-types'
 import { AgentHookServerAuthorityFences } from './server-authority-fences'
 
@@ -171,6 +179,79 @@ export abstract class AgentHookServerCleanup extends AgentHookServerAuthorityFen
     return Boolean(this.getTmuxSelectedStatus(paneKey)) || paneHasStateClaims(this.state, paneKey)
   }
 
+  /** Retire the panes a removed worktree occupied on `host`, and its leftover claim on any other pane. */
+  dropStatusEntriesForRemovedWorktree(worktreeId: string, host?: ExecutionHostScope): void {
+    const parsed = host === ALL_EXECUTION_HOSTS_SCOPE ? null : parseExecutionHostId(host ?? 'local')
+    // Why: a runtime host keeps its own store, so no row here is its to retire.
+    if (host !== ALL_EXECUTION_HOSTS_SCOPE && (!parsed || parsed.kind === 'runtime')) {
+      return
+    }
+    const ownedByRemoved = (claim: { connectionId: string | null; worktreeId?: string }): boolean =>
+      Boolean(claim.worktreeId && worktreeIdsEqual(claim.worktreeId, worktreeId)) &&
+      (!parsed ||
+        (parsed.kind === 'ssh'
+          ? claim.connectionId === parsed.targetId
+          : // Why: WSL panes are local; their relay only stamps transport provenance.
+            claim.connectionId === null || isWslHookRelayConnectionId(claim.connectionId)))
+    // The startup snapshot may outlive its replaced map entry; revoke only the removed owner.
+    for (const commitment of this.hydratedAuthorityCommitments) {
+      if (ownedByRemoved(commitment)) {
+        this.revokedHydratedAuthorityCommitments.add(commitment)
+      }
+    }
+    const paneKeys = new Set<string>()
+    for (const claim of [
+      ...this.state.lastStatusByPaneKey.values(),
+      ...this.persistedAuthorityCommitmentsByPaneKey.values()
+    ]) {
+      if (ownedByRemoved(claim)) {
+        paneKeys.add(claim.paneKey)
+      }
+    }
+    for (const paneKey of paneKeys) {
+      const row = this.state.lastStatusByPaneKey.get(paneKey)
+      const commitment = this.persistedAuthorityCommitmentsByPaneKey.get(paneKey)
+      if (row && ownedByRemoved(row) && commitment && !ownedByRemoved(commitment)) {
+        // A tokenless repaint cannot prove a foreign launch exited; retain it behind its token fence.
+        const observation = this.currentAuthorityObservations.get(paneKey)
+        const deleted = this.deleteStatusEntry(paneKey, { preserveAuthority: true })
+        clearPaneCacheState(this.state, paneKey)
+        if (observation && !ownedByRemoved(observation)) {
+          this.currentAuthorityObservations.set(paneKey, observation)
+        }
+        this.restartedStatusLaunchTokenHashByPaneKey.set(paneKey, {
+          hash: commitment.launchTokenHash,
+          allowRetainedOwner: true
+        })
+        this.observations.forget(paneKey)
+        this.commitStatusRowMutation(deleted, undefined)
+        this.scheduleStatusPersist()
+        this.notifyStatusChangeListeners()
+        this.emitPaneStatusCleared({ paneKey })
+        continue
+      }
+      const occupant = row ?? commitment
+      if (occupant && !ownedByRemoved(occupant)) {
+        // Another owner has the pane now; only our outlived commitment is left to clear.
+        if (commitment && ownedByRemoved(commitment)) {
+          this.persistedAuthorityCommitmentsByPaneKey.delete(paneKey)
+          this.hydratedLaunchTokenHashByPaneKey.delete(paneKey)
+          this.scheduleStatusPersist()
+        }
+        const observation = this.currentAuthorityObservations.get(paneKey)
+        if (observation && ownedByRemoved(observation)) {
+          this.currentAuthorityObservations.delete(paneKey)
+        }
+        continue
+      }
+      // Why a pane fence, not a tab one: a surviving same-id host keeps the shared tab.
+      this.retirePaneAuthority(paneKey)
+      if (row) {
+        this.emitPaneStatusCleared({ paneKey })
+      }
+    }
+  }
+
   /** Clear statuses proven to belong to one lost SSH transport. */
   clearStatusEntriesForConnection(connectionId: string): void {
     const normalizedConnectionId = connectionId.trim()
```

**File**: `src/main/agent-hooks/server/server-ingest-remote.ts` (modified, +12/-36)
```diff
@@ -21,45 +21,15 @@ import {
   olderPeerAgentStatusLegacyMode
 } from '../../../shared/agent-status-legacy-adapter'
 import { isValidPiProviderSessionOnly } from './server-status-identity'
-import { normalizeRemoteEnvelopeFields } from './server-remote-envelope-normalization'
+import {
+  normalizeRemoteEnvelopeFields,
+  type RemoteAgentStatusEnvelope
+} from './server-remote-envelope-normalization'
 import { AgentHookServerIngestStructuredChildren } from './server-ingest-structured-children'
 
 export abstract class AgentHookServerIngestRemote extends AgentHookServerIngestStructuredChildren {
   /** Ingest a payload from the relay JSON-RPC channel (not the local HTTP server); connectionId is stamped here. Main is still the SSH trust boundary, so re-run the canonical normalizer before caching. */
-  ingestRemote(
-    envelope: {
-      paneKey: string
-      tabId?: string
-      worktreeId?: string
-      env?: string
-      version?: string
-      launchToken?: string
-      hasExplicitPrompt?: boolean
-      promptInteractionKey?: string
-      agentPresence?: unknown
-      hookEventName?: string
-      source?: unknown
-      providerPromptId?: unknown
-      grokPromptBoundary?: unknown
-      compactTrigger?: unknown
-      toolUseId?: string
-      toolAgentId?: string
-      teammateName?: string
-      toolAgentType?: string
-      providerSession?: unknown
-      providerSessionOnly?: unknown
-      isReplay?: boolean
-      /** Payload fields the relay dropped to fit an oversized frame; validated below. */
-      shedFields?: unknown
-      claudeRunningNonAgentTask?: unknown
-      /** The producing peer's advertised run-capability set — a property of the peer/connection that built this envelope, not an orthogonal call parameter. Absent (older relay/HTTP paths) defaults to the unadvertised-legacy-peer set. */
-      advertisedAgentStatusCapabilities?: readonly string[]
-      statusUnavailable?: unknown
-      evidenceAgeMs?: unknown
-      payload: unknown
-    },
-    connectionId: string | null
-  ): void {
+  ingestRemote(envelope: RemoteAgentStatusEnvelope, connectionId: string | null): void {
     if (
       !canAdmitLegacyAgentStatus(
         'main-status-update',
@@ -194,7 +164,13 @@ export abstract class AgentHookServerIngestRemote extends AgentHookServerIngestS
       hookEventName,
       isReplay: envelope.isReplay === true,
       hasExplicitPrompt: envelope.hasExplicitPrompt === true,
-      launchToken: envelope.launchToken
+      launchToken: envelope.launchToken,
+      retainedLaunchTokenHash: envelope.launchToken?.trim()
+        ? undefined
+        : this.retainedOwnerLaunchTokenHash(paneKey, {
+            worktreeId,
+            connectionId: trimmedConnectionId
+          })
     })
     if (statusDisposition === 'suppress') {
       return
```

**File**: `src/main/agent-hooks/server/server-ingest-terminal.ts` (modified, +12/-9)
```diff
@@ -47,27 +47,30 @@ export abstract class AgentHookServerIngestTerminal extends AgentHookServerInges
       return
     }
     const tabId = paneKey !== physicalPaneKey ? parsedPaneKey?.tabId : reportedTabId
+    const worktreeId = event.worktreeId?.trim() || undefined
+    const connectionId =
+      typeof event.connectionId === 'string' && event.connectionId.trim().length > 0
+        ? event.connectionId.trim()
+        : null
+    const retainedLaunchTokenHash = this.retainedOwnerLaunchTokenHash(paneKey, {
+      worktreeId,
+      connectionId
+    })
     // Why: a verified process-lifetime Working proves a new agent run, as a hook new-turn event does.
     const disposition = this.getAgentStatusDisposition(
       paneKey,
       event.origin === 'process' && event.payload.state === 'working'
         ? { processNewTurn: true }
-        : undefined
+        : this.restartedStatusLaunchTokenHashByPaneKey.get(paneKey)?.allowRetainedOwner
+          ? { retainedLaunchTokenHash }
+          : undefined
     )
     if (disposition === 'suppress') {
       return
     }
     if (disposition === 'restart') {
       this.observations.rebind(paneKey)
     }
-    const worktreeId =
-      event.worktreeId !== undefined && event.worktreeId.trim().length > 0
-        ? event.worktreeId.trim()
-        : undefined
-    const connectionId =
-      typeof event.connectionId === 'string' && event.connectionId.trim().length > 0
-        ? event.connectionId.trim()
-        : null
     const terminalHandle =
       typeof event.terminalHandle === 'string' && event.terminalHandle.trim().length > 0
         ? event.terminalHandle.trim()
```

**File**: `src/main/agent-hooks/server/server-remote-envelope-normalization.ts` (modified, +32/-0)
```diff
@@ -5,6 +5,38 @@ import {
 } from '../../../shared/agent-hook-listener/listener-limits'
 import { isAgentHookSource, type AgentHookSource } from '../../../shared/agent-hook-relay'
 
+export type RemoteAgentStatusEnvelope = {
+  paneKey: string
+  tabId?: string
+  worktreeId?: string
+  env?: string
+  version?: string
+  launchToken?: string
+  hasExplicitPrompt?: boolean
+  promptInteractionKey?: string
+  agentPresence?: unknown
+  hookEventName?: string
+  source?: unknown
+  providerPromptId?: unknown
+  grokPromptBoundary?: unknown
+  compactTrigger?: unknown
+  toolUseId?: string
+  toolAgentId?: string
+  teammateName?: string
+  toolAgentType?: string
+  providerSession?: unknown
+  providerSessionOnly?: unknown
+  isReplay?: boolean
+  /** Payload fields the relay dropped to fit an oversized frame; validated below. */
+  shedFields?: unknown
+  claudeRunningNonAgentTask?: unknown
+  /** The producing peer's advertised run-capability set — a property of the peer/connection that built this envelope, not an orthogonal call parameter. Absent (older relay/HTTP paths) defaults to the unadvertised-legacy-peer set. */
+  advertisedAgentStatusCapabilities?: readonly string[]
+  statusUnavailable?: unknown
+  evidenceAgeMs?: unknown
+  payload: unknown
+}
+
 export type RemoteEnvelopeFields = {
   hookEventName?: string
   source?: AgentHookSource
```

**File**: `src/main/agent-hooks/server/server-row-ownership.ts` (modified, +15/-1)
```diff
@@ -79,7 +79,7 @@ export abstract class AgentHookServerRowOwnership extends AgentHookServerListene
   }
 
   protected sameTerminalOwner(
-    previous: EnrichedAgentHookEventPayload,
+    previous: Pick<AgentHookEventPayload, 'connectionId' | 'worktreeId'>,
     incoming: Pick<AgentHookEventPayload, 'connectionId' | 'worktreeId'>
   ): boolean {
     if (
@@ -112,6 +112,20 @@ export abstract class AgentHookServerRowOwnership extends AgentHookServerListene
     )
   }
 
+  protected retainedOwnerLaunchTokenHash(
+    paneKey: string,
+    incoming: Pick<AgentHookEventPayload, 'connectionId' | 'worktreeId'>
+  ): string | undefined {
+    const fence = this.restartedStatusLaunchTokenHashByPaneKey.get(paneKey)
+    const authority = this.persistedAuthorityCommitmentsByPaneKey.get(paneKey)
+    return fence?.allowRetainedOwner &&
+      authority?.worktreeId &&
+      incoming.worktreeId &&
+      this.sameTerminalOwner(authority, incoming)
+      ? authority.launchTokenHash
+      : undefined
+  }
+
   protected commitStatusRowMutation(
     before: EnrichedAgentHookEventPayload | null | undefined,
     after: EnrichedAgentHookEventPayload | null | undefined,
```

---

### Incident Patch 8: `1b52be62` (2026-10-06)
**Commit Message**: fix(claude-accounts): preserve shared MCP OAuth credentials across an account switch (#21931)

* fix(claude-accounts): preserve shared MCP OAuth credentials across an account switch

Orca's account switch writes the target managed account's own stored credential
verbatim to the global "Claude Code-credentials" Keychain item. That credential
never carries mcpOAuth/mcpOAuthClientConfig/mcpXaaIdp/mcpXaaIdpConfig/pluginSecrets
(they are machine-shared MCP connector state, not per-account), so every switch
silently drops any MCP connections the previous session had.

Merge the live credential's copy of these shared fields into the target credential
right before the Keychain write, live-wins (absence included), mirroring how the
third-party claude-swap tool already treats this exact shared Keychain item.

Fixes #16098

* fix(claude-accounts): skip reformatting shared credential merge when nothing changed

mergeSharedClaudeCredentialFields always re-serialized via JSON.stringify, even when
the shared-key set was identical on both sides. The reformatted-but-semantically-equal
JSON (e.g. missing the original trailing newline) then read as an external Claude Code
refresh to the read-back byt

**File**: `src/main/claude-accounts/claude-managed-auth-storage.ts` (modified, +4/-0)
```diff
@@ -3,6 +3,7 @@ import { join, relative, resolve, sep } from 'node:path'
 import { parseWslUncPath } from '../../shared/wsl-paths'
 import { toWindowsWslPath } from '../wsl'
 import { runWslProcess } from '../wsl/wsl-runner'
+import { stripSharedClaudeCredentialFields } from './shared-credential-fields'
 import {
   getClaudeManagedAccountsRoot,
   readClaudeManagedAuthFile,
@@ -74,6 +75,9 @@ export class ClaudeManagedAuthStorage {
     credentialsJson: string
   ): Promise<void> {
     const trustedPath = await this.assertOwned(managedAuthPath, accountId)
+    if (!parseWslUncPath(trustedPath)) {
+      credentialsJson = stripSharedClaudeCredentialFields(credentialsJson)
+    }
     if (process.platform === 'darwin') {
       await writeManagedClaudeKeychainCredentials(accountId, credentialsJson)
     } else {
```

**File**: `src/main/claude-accounts/runtime-auth-service-account-switching.test.ts` (modified, +4/-2)
```diff
@@ -41,7 +41,7 @@ describe('ClaudeRuntimeAuthService', () => {
     cleanupRuntimeAuthTestState()
   })
 
-  it('reads back refreshed file credentials when keychain reads fail', async () => {
+  it('saves a verified file refresh but refuses to overwrite unreadable keychain state', async () => {
     const runtimeCredentialsPath = join(testState.fakeHomeDir, '.claude', '.credentials.json')
     const originalCredentials = createClaudeCredentialsJson('user@example.com', 'original')
     const refreshedCredentials = createClaudeCredentialsJson('user@example.com', 'refreshed')
@@ -64,10 +64,12 @@ describe('ClaudeRuntimeAuthService', () => {
     writeFileSync(runtimeCredentialsPath, refreshedCredentials, 'utf-8')
     testState.throwScopedKeychainRead = true
     testState.throwLegacyKeychainRead = true
-    await service.syncForCurrentSelection()
+    await expect(service.syncForCurrentSelection()).rejects.toThrow('scoped keychain read failed')
 
     expect(readManagedCredentialsForTest('account-1', managedAuthPath)).toBe(refreshedCredentials)
     expect(readFileSync(runtimeCredentialsPath, 'utf-8')).toBe(refreshedCredentials)
+    expect(testState.scopedKeychainCredentials).toBe(originalCredentials)
+    expect(testState.legacyKeychainCredentials).toBe(originalCredentials)
     warn.mockRestore()
   })
 
```

**File**: `src/main/claude-accounts/runtime-auth-service-materialization.test.ts` (modified, +4/-3)
```diff
@@ -421,7 +421,7 @@ describe('ClaudeRuntimeAuthService', () => {
     }
   })
 
-  it('falls back to atomic write when the unchanged check cannot read the target', async () => {
+  it('preserves unreadable runtime credentials instead of overwriting unknown connector grants', async () => {
     if (hostPlatform === 'win32') {
       return
     }
@@ -449,15 +449,16 @@ describe('ClaudeRuntimeAuthService', () => {
     writeFileSync(join(managedAuthPath, '.credentials.json'), rotatedCredentials, 'utf-8')
     chmodSync(runtimeCredentialsPath, 0o000)
     try {
-      await service.syncForCurrentSelection()
+      await expect(service.syncForCurrentSelection()).rejects.toMatchObject({ code: 'EACCES' })
     } finally {
       if (existsSync(runtimeCredentialsPath)) {
         chmodSync(runtimeCredentialsPath, 0o600)
       }
       warn.mockRestore()
     }
 
-    expect(readFileSync(runtimeCredentialsPath, 'utf-8')).toBe(rotatedCredentials)
+    expect(readFileSync(runtimeCredentialsPath, 'utf-8')).toBe(managedCredentials)
+    expect(testState.scopedKeychainCredentials).toBe(managedCredentials)
   })
 
   it('tightens credential file permissions when unchanged content is already present', async () => {
```

**File**: `src/main/claude-accounts/runtime-auth-service-shared-credential-failures.test.ts` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+import {
+  cleanupRuntimeAuthTestState,
+  createElectronMock,
+  createKeychainMock,
+  createOauthRefreshMock,
+  resetRuntimeAuthTestState,
+  testState
+} from './runtime-auth-service-test-harness'
+import {
+  createSharedCredentialRuntime,
+  sharedFields,
+  withSharedFields
+} from './runtime-auth-shared-credentials-fixture'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { readFileSync, writeFileSync } from 'node:fs'
+
+vi.mock('electron', () => createElectronMock())
+vi.mock('./oauth-refresh', () => createOauthRefreshMock())
+vi.mock('./keychain', () => createKeychainMock())
+vi.mock('node:os', async () => {
+  const actual = await vi.importActual<typeof import('node:os')>('node:os') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
+  return { ...actual, homedir: () => testState.fakeHomeDir }
+})
+
+describe('shared connector credential write failures', () => {
+  beforeEach(resetRuntimeAuthTestState)
+  afterEach(cleanupRuntimeAuthTestState)
+
+  it('keeps the committed baseline across a partial rollback so a rotated grant can be retried', async () => {
+    const { service, settings, runtimePath, first } = await createSharedCredentialRuntime()
+    settings.activeClaudeManagedAccountId = 'first'
+    await service.syncForCurrentSelection()
+    const rotated = {
+      ...sharedFields,
+      mcpOAuth: { figma: { accessToken: 'new-access', refreshToken: 'new-refresh' } }
+    }
+    testState.scopedKeychainCredentials = withSharedFields(first, rotated)
+    settings.activeClaudeManagedAccountId = 'second'
+    testState.throwLegacyRuntimeKeychainWrite = true
+    await expect(service.syncForCurrentSelection()).rejects.toThrow(
+      'legacy runtime keychain write failed'
+    )
+    expect(JSON.parse(readFileSync(runtimePath, 'utf-8'))).toMatchObject(rotated)
+    testState.throwLegacyRuntimeKeychainWrite = false
+    settings.activeClaudeManagedAccountId = 'first'
+    await service.forceMaterializeCurrentSelectionForRollback()
+    expect(JSON.parse(readFileSync(runtimePath, 'utf-8'))).toMatchObject(rotated)
+    expect(JSON.parse(readFileSync(runtimePath, 'utf-8')).claudeAiOauth.accessToken).toBe('first')
+    expect(testState.scopedKeychainCredentials).toBe(readFileSync(runtimePath, 'utf-8'))
+    expect(testState.legacyKeychainCredentials).toBe(testState.scopedKeychainCredentials)
+  })
+
+  it('preserves disjoint live grants when the first switch fails after writing only the scoped item', async () => {
+    const { service, settings, runtimePath, system } = await createSharedCredentialRuntime()
+    const figma = sharedFields.mcpOAuth.figma
+    testState.scopedKeychainCredentials = withSharedFields(system, {
+      ...sharedFields,
+      mcpOAuth: { figma }
+    })
+    testState.legacyKeychainCredentials = withSharedFields(system, {
+      ...sharedFields,
+      mcpOAuth: { notion: { accessToken: 'notion-access', refreshToken: 'notion-refresh' } }
+    })
+    writeFileSync(runtimePath, system)
+    settings.activeClaudeManagedAccountId = 'first'
+    testState.throwLegacyRuntimeKeychainWrite = true
+    await expect(service.syncForCurrentSelection()).rejects.toThrow(
+      'legacy runtime keychain write failed'
+    )
+    expect(JSON.parse(readFileSync(runtimePath, 'utf-8')).mcpOAuth).toEqual({
+      figma,
+      notion: { accessToken: 'notion-access', refreshToken: 'notion-refresh' }
+    })
+    testState.throwLegacyRuntimeKeychainWrite = false
+    await service.syncForCurrentSelection()
+    const runtime = JSON.parse(readFileSync(runtimePath, 'utf-8'))
+    expect(runtime.mcpOAuth).toEqual({
+      figma,
+      notion: { accessToken: 'notion-access', refreshToken: 'notion-refresh' }
+    })
+    expect(runtime.claudeAiOauth.accessToken).toBe('first')
+    expect(testState.scopedKeychainCredentials).toBe(readFileSync(runtimePath, 'utf-8'))
+    expect(testState.legacyKeychainCredentials).toBe(testState.scopedKeychainCredentials)
+  })
+})
```

**File**: `src/main/claude-accounts/runtime-auth-service-shared-credentials.test.ts` (added, +292/-0)
```diff
@@ -0,0 +1,292 @@
+import {
+  cleanupRuntimeAuthTestState,
+  createClaudeCredentialsJson,
+  createElectronMock,
+  createKeychainMock,
+  createOauthRefreshMock,
+  createStore,
+  readManagedCredentialsForTest,
+  resetRuntimeAuthTestState,
+  testState
+} from './runtime-auth-service-test-harness'
+import {
+  createSharedCredentialRuntime,
+  sharedFields,
+  withSharedFields
+} from './runtime-auth-shared-credentials-fixture'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
+import { join } from 'node:path'
+
+vi.mock('electron', () => createElectronMock())
+vi.mock('./oauth-refresh', () => createOauthRefreshMock())
+vi.mock('./keychain', () => createKeychainMock())
+vi.mock('node:os', async () => {
+  const actual = await vi.importActual<typeof import('node:os')>('node:os') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
+  return { ...actual, homedir: () => testState.fakeHomeDir }
+})
+
+describe('shared Claude connector credentials', () => {
+  beforeEach(resetRuntimeAuthTestState)
+  afterEach(cleanupRuntimeAuthTestState)
+
+  it.each(['scoped', 'legacy', 'file'] as const)(
+    'preserves connector grants stored only in %s when there is no previous Orca write',
+    async (surface) => {
+      const { service, settings, runtimePath, system } = await createSharedCredentialRuntime()
+      testState.scopedKeychainCredentials = system
+      testState.legacyKeychainCredentials = system
+      writeFileSync(runtimePath, system)
+      if (surface === 'scoped') {
+        testState.scopedKeychainCredentials = withSharedFields(system)
+      } else if (surface === 'legacy') {
+        testState.legacyKeychainCredentials = withSharedFields(system)
+      } else {
+        writeFileSync(runtimePath, withSharedFields(system))
+      }
+      settings.activeClaudeManagedAccountId = 'first'
+      await service.syncForCurrentSelection()
+      expect(JSON.parse(readFileSync(runtimePath, 'utf-8'))).toMatchObject(sharedFields)
+    }
+  )
+
+  it.each(['darwin', 'linux', 'win32'] as const)(
+    'excludes connector secrets when capturing a managed account on %s',
+    async (platform) => {
+      const { firstPath, first } = await createSharedCredentialRuntime(platform)
+      const { ClaudeManagedAuthStorage } = await import('./claude-managed-auth-storage')
+      await new ClaudeManagedAuthStorage().writeCredentials(
+        'first',
+        firstPath,
+        withSharedFields(first)
+      )
+      expect(JSON.parse(readManagedCredentialsForTest('first', firstPath) ?? '')).toEqual(
+        JSON.parse(first)
+      )
+    }
+  )
+
+  it.each(['scoped', 'legacy', 'file'] as const)(
+    'propagates connector revocations from the %s surface and does not resurrect frozen account grants',
+    async (surface) => {
+      const { service, settings, runtimePath, first, secondPath, second } =
+        await createSharedCredentialRuntime()
+      settings.activeClaudeManagedAccountId = 'first'
+      await service.syncForCurrentSelection()
+      if (surface === 'scoped') {
+        testState.scopedKeychainCredentials = first
+      } else if (surface === 'legacy') {
+        testState.legacyKeychainCredentials = first
+      } else {
+        writeFileSync(runtimePath, first)
+      }
+      testState.managedKeychainCredentials.set('second', withSharedFields(second))
+      writeFileSync(join(secondPath, '.credentials.json'), withSharedFields(second))
+      settings.activeClaudeManagedAccountId = 'second'
+      await service.syncForCurrentSelection()
+      expect(JSON.parse(readFileSync(runtimePath, 'utf-8'))).toEqual(JSON.parse(second))
+      expect(JSON.parse(testState.scopedKeychainCredentials ?? '')).toEqual(JSON.parse(second))
+      expect(JSON.parse(testState.legacyKeychainCredentials ?? '')).toEqual(JSON.parse(second))
+    }
+  )
+
+  it('preserves grants refreshed only in the keychain when returning to the system default', async () => {
+    const { service, settings, runtimePath, first, system } = await createSharedCredentialRuntime()
+    settings.activeClaudeManagedAccountId = 'first'
+    await service.syncForCurrentSelection()
+    const rotated = {
+      ...sharedFields,
+      mcpOAuth: { figma: { accessToken: 'rotated', refreshToken: 'rotated' } }
+    }
+    testState.legacyKeychainCredentials = withSharedFields(first, rotated)
+    settings.activeClaudeManagedAccountId = null
+    await service.syncForCurrentSelection()
+    expect(JSON.parse(readFileSync(runtimePath, 'utf-8'))).toMatchObject(rotated)
+    expect(JSON.parse(testState.scopedKeychainCredentials ?? '')).toMatchObject(rotated)
+    expect(JSON.parse(testState.legacyKeychainCredentials ?? '')).toMatchObject(rotated)
+    const nextRotation = {
+      ...sharedFields,
+      mcpOAuth: { figma: { accessToken: 'rotated-again', refreshToken: 'rotated-again' } }
+    }
```

**File**: `src/main/claude-accounts/runtime-auth-shared-credentials-fixture.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import {
+  createClaudeAccount,
+  createClaudeCredentialsJson,
+  createManagedClaudeAuth,
+  createSettings,
+  createStore,
+  setPlatform,
+  testState
+} from './runtime-auth-service-test-harness'
+import { writeFileSync } from 'node:fs'
+import { join } from 'node:path'
+
+export const sharedFields = {
+  mcpOAuth: { figma: { accessToken: 'mcp-access', refreshToken: 'mcp-refresh' } },
+  mcpOAuthClientConfig: { figma: { clientId: 'figma-client' } },
+  mcpXaaIdp: { token: 'idp-token' },
+  mcpXaaIdpConfig: { issuer: 'idp-issuer' },
+  pluginSecrets: { plugin: 'secret' }
+}
+
+export function withSharedFields(
+  credentials: string,
+  fields: Record<string, unknown> = sharedFields
+): string {
+  return JSON.stringify({ ...JSON.parse(credentials), ...fields })
+}
+
+export async function createSharedCredentialRuntime(platform: NodeJS.Platform = 'darwin') {
+  setPlatform(platform)
+  const runtimePath = join(testState.fakeHomeDir, '.claude', '.credentials.json')
+  const system = createClaudeCredentialsJson('system@example.com', 'system')
+  const first = createClaudeCredentialsJson('first@example.com', 'first')
+  const second = createClaudeCredentialsJson('second@example.com', 'second')
+  const firstPath = createManagedClaudeAuth(testState.userDataDir, 'first', first)
+  const secondPath = createManagedClaudeAuth(testState.userDataDir, 'second', second)
+  writeFileSync(runtimePath, withSharedFields(system))
+  testState.scopedKeychainCredentials = withSharedFields(system)
+  testState.legacyKeychainCredentials = withSharedFields(system)
+  const settings = createSettings({
+    claudeManagedAccounts: [
+      createClaudeAccount('first', firstPath, { email: 'first@example.com' }),
+      createClaudeAccount('second', secondPath, { email: 'second@example.com' })
+    ]
+  })
+  const store = createStore(settings)
+  const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
+  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Runtime auth uses only getSettings/updateSettings from this store mock.
+  const service = new ClaudeRuntimeAuthService(store as never)
+  await service.syncForCurrentSelection()
+  return { service, settings, runtimePath, first, second, system, firstPath, secondPath }
+}
```

**File**: `src/main/claude-accounts/runtime-auth/runtime-auth-credential-identity.ts` (modified, +21/-0)
```diff
@@ -1,11 +1,32 @@
 import { ClaudeRuntimeAuthFileStorage } from './runtime-auth-file-storage'
+import { stripSharedClaudeCredentialFields } from '../shared-credential-fields'
 import type {
   ClaudeAuthIdentity,
   ClaudeReadBackMatch,
   ClaudeRefreshTokenComparison
 } from './runtime-auth-types'
 
 export class ClaudeRuntimeAuthCredentialIdentity extends ClaudeRuntimeAuthFileStorage {
+  protected accountCredentialFieldsEqual(left: string | null, right: string | null): boolean {
+    if (left === right) {
+      return true
+    }
+    if (left === null || right === null) {
+      return false
+    }
+    try {
+      const leftAccount = this.asRecord(JSON.parse(stripSharedClaudeCredentialFields(left)))
+      const rightAccount = this.asRecord(JSON.parse(stripSharedClaudeCredentialFields(right)))
+      return (
+        leftAccount !== null &&
+        rightAccount !== null &&
+        this.jsonValuesEqual(leftAccount, rightAccount)
+      )
+    } catch {
+      return false
+    }
+  }
+
   protected readIdentityFromCredentials(credentialsJson: string): ClaudeAuthIdentity | null {
     let parsed: Record<string, unknown>
     try {
```

**File**: `src/main/claude-accounts/runtime-auth/runtime-auth-keychain-snapshots.ts` (modified, +5/-1)
```diff
@@ -41,7 +41,11 @@ export class ClaudeRuntimeAuthKeychainSnapshots extends ClaudeRuntimeAuthManaged
     service: 'scoped' | 'legacy',
     managedCredentialsJson: string | undefined
   ): string | null {
-    if (managedCredentialsJson && credentialsJson === managedCredentialsJson && previousSnapshot) {
+    if (
+      managedCredentialsJson &&
+      this.accountCredentialFieldsEqual(credentialsJson, managedCredentialsJson) &&
+      previousSnapshot
+    ) {
       const previousValue = this.readKeychainSnapshotValue(previousSnapshot, service)
       if (previousValue.status === 'captured') {
         return previousValue.credentialsJson
```

---

### Incident Patch 9: `08a970a3` (2026-10-06)
**Commit Message**: fix(native-chat): show the message rail from the first user message (#25707)

* fix(native-chat): show the message rail from the first user message

The rail on the right of native chat stayed hidden until a conversation had
three user messages, so short chats had no rail at all. Show it whenever there
is at least one user message (still hidden in panes too narrow for it).

Co-Authored-By: Claude <[REDACTED_EMAIL]>

* fix(test): remove duplicate journal fixture handle import

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `src/renderer/src/components/native-chat/native-chat-message-rail-items.ts` (modified, +0/-3)
```diff
@@ -13,9 +13,6 @@ import type { NativeChatTranscriptSlot } from './native-chat-transcript-slots'
  *  read at a glance, which is the only thing the rail is for. */
 export const NATIVE_CHAT_RAIL_MAX_TICKS = 20
 
-/** Below this a rail is noise — two ticks say nothing a scrollbar doesn't. */
-export const NATIVE_CHAT_RAIL_MIN_ITEMS = 3
-
 export type NativeChatRailItem = {
   id: string
   /** Index into the slot list, i.e. the virtualizer's own index. Null while the
```

**File**: `src/renderer/src/components/native-chat/use-native-chat-message-rail.test.ts` (modified, +8/-4)
```diff
@@ -114,7 +114,7 @@ describe('message rail hook', () => {
     expect(scrollSubscriptions).toHaveLength(1)
   })
 
-  it('ticks every user message and hides below the minimum', () => {
+  it('ticks every user message and shows from the first one', () => {
     const element = document.createElement('div')
     const scrollRef = { current: element }
 
@@ -124,14 +124,19 @@ describe('message rail hook', () => {
     expect(result.current.items.map((item) => item.id)).toEqual(['u1', 'u2', 'u3'])
     expect(result.current.visible).toBe(true)
 
-    const { result: short } = renderHook(() =>
+    const { result: single } = renderHook(() =>
       useNativeChatMessageRail({
         scrollRef,
         slots: slotsOf([message('u1', 'user'), message('a1', 'assistant')]),
         virtualItems: []
       })
     )
-    expect(short.current.visible).toBe(false)
+    expect(single.current.visible).toBe(true)
+
+    const { result: empty } = renderHook(() =>
+      useNativeChatMessageRail({ scrollRef, slots: [], virtualItems: [] })
+    )
+    expect(empty.current.visible).toBe(false)
   })
 
   it('maps user messages above the loaded window from the outline, before the loaded ones', () => {
@@ -145,7 +150,6 @@ describe('message rail hook', () => {
     const { result } = renderHook(() =>
       useNativeChatMessageRail({ scrollRef, slots: slotsOf(loaded), virtualItems: [], outline })
     )
-    // One loaded prompt alone would hide the rail; the outline is what makes it a map.
     expect(result.current.visible).toBe(true)
     expect(result.current.items.map((item) => item.id)).toEqual([
       ...outline.map((entry) => entry.id),
```

**File**: `src/renderer/src/components/native-chat/use-native-chat-message-rail.ts` (modified, +1/-2)
```diff
@@ -11,7 +11,6 @@ import {
   buildNativeChatRailItems,
   mergeNativeChatRailOutline,
   selectNativeChatRailTicks,
-  NATIVE_CHAT_RAIL_MIN_ITEMS,
   type NativeChatRailItem,
   type NativeChatRailOutlineEntry
 } from './native-chat-message-rail-items'
@@ -135,7 +134,7 @@ export function useNativeChatMessageRail({
       ticks,
       items,
       activeId,
-      visible: wideEnough && items.length >= NATIVE_CHAT_RAIL_MIN_ITEMS
+      visible: wideEnough && items.length > 0
     }),
     [ticks, items, activeId, wideEnough]
   )
```

---

### Incident Patch 10: `a47e0f56` (2026-10-06)
**Commit Message**: fix(feedback): optimize oversized screenshots without losing detail (#23664)

* fix(feedback): shrink oversized screenshots instead of refusing them

Fixes #22776

* fix(feedback): release each shrink canvas and skip the PNG ladder for a JPEG

Two defects in the attach-time shrink ladder:

- Every step allocated a fresh full-size canvas and left it for the garbage
  collector, so a 32-megapixel source could keep six of them alive at once.
  Past the renderer's canvas memory budget Chromium hands back a blank canvas,
  which would upload as a blank screenshot with nothing to notice it. Each
  step's canvas is now released once toBlob has answered.
- A JPEG source ran two full-size PNG encodes first. A PNG of decoded JPEG
  noise is many times larger than the source it has to undercut, so those
  steps could only ever burn time and a large buffer before the first JPEG
  attempt. A lossy source now starts at the JPEG steps.

* fix(feedback): keep the image read queue usable after a settle callback throws

The queue tail is what the next batch awaits. A throw in either settle callback
left it rejected, so every later attach short-circuited into "Could not read the
attached images" with

**File**: `package.json` (modified, +1/-0)
```diff
@@ -216,6 +216,7 @@
     "@sanity/diff-match-patch": "^3.2.1",
     "@shadcn/lint": "~0.1.5",
     "@stablyai/playwright-test": "^2.1.16",
+    "@streamparser/json": "0.0.26",
     "@tailwindcss/vite": "^4.2.4",
     "@tanstack/react-virtual": "^3.14.13",
     "@testing-library/jest-dom": "^6.9.1",
```

**File**: `pnpm-lock.yaml` (modified, +8/-0)
```diff
@@ -293,6 +293,9 @@ importers:
       '@stablyai/playwright-test':
         specifier: ^2.1.16
         version: 2.1.16(@playwright/test@1.63.0)(zod@4.6.5)
+      '@streamparser/json':
+        specifier: 0.0.26
+        version: 0.0.26
       '@tailwindcss/vite':
         specifier: ^4.2.4
         version: 4.2.4(rolldown-vite@7.3.1(@emnapi/core@1.11.2)(@emnapi/runtime@1.11.2)(@types/node@25.9.5)(esbuild@0.28.2)(jiti@2.7.0)(yaml@2.9.1))
@@ -3188,6 +3191,9 @@ packages:
   '@standard-schema/spec@1.1.0':
     resolution: {integrity: sha512-l2aFy5jALhniG5HgqrD6jXLi/rUWrKvqN/qJx6yoJsgKhblVd+iqqU4RCXavm/jPityDo5TCvKMnpjKnOriy0w==}
 
+  '@streamparser/json@0.0.26':
+    resolution: {integrity: sha512-46597LNFI+MFdUnzX2QJWwmdTRdq0XVD+vVNJTtGVzIrnCuhG9pFo1OAzbNBqci8UJgk/X5KJZ6LcV+y7PTuDQ==}
+
   '@swc/core-darwin-arm64@1.15.46':
     resolution: {integrity: sha512-IsISIT22EfktVJrlvIpnAxG2u/A9aob9l99HMlx80x72WlFmFPk1V3UhkEzx86eJP8hw049KTFv/RISho2cq2Q==}
     engines: {node: '>=10'}
@@ -10214,6 +10220,8 @@ snapshots:
 
   '@standard-schema/spec@1.1.0': {}
 
+  '@streamparser/json@0.0.26': {}
+
   '@swc/core-darwin-arm64@1.15.46':
     optional: true
 
```

**File**: `src/renderer/src/components/sidebar/SidebarFeedbackDialog.test.tsx` (modified, +277/-23)
```diff
@@ -2,6 +2,8 @@
 
 import React, { act, type ReactNode } from 'react'
 import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
+import type * as FeedbackImageAttachments from '@/lib/feedback-image-attachments'
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 
 const mocks = vi.hoisted(() => ({
@@ -15,6 +17,7 @@ const mocks = vi.hoisted(() => ({
 vi.mock('sonner', () => ({
   toast: {
     error: vi.fn(),
+    info: vi.fn(),
     success: vi.fn(),
     warning: mocks.toastWarning
   }
@@ -194,6 +197,100 @@ describe('SidebarFeedbackDialog environment prefill', () => {
 })
 
 describe('SidebarFeedbackDialog image submission', () => {
+  it.each(['refused', 'shrunk'] as const)(
+    'preserves text and its caret when an oversized image is %s after paste',
+    async (result) => {
+      const user = userEvent.setup()
+      const bytes = new Uint8Array(53)
+      bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
+      const header = new DataView(bytes.buffer)
+      header.setUint32(8, 13)
+      bytes.set(new TextEncoder().encode('IHDR'), 12)
+      header.setUint32(16, 1)
+      header.setUint32(20, 1)
+      header.setUint32(33, 8)
+      bytes.set(new TextEncoder().encode(result === 'refused' ? 'acTL' : 'IDAT'), 37)
+      const file = new File([bytes], 'capture.png', { type: 'image/png' })
+      Object.defineProperty(file, 'size', { value: 6_000_000 })
+      let finishRead:
+        | ((
+            value: Awaited<ReturnType<typeof FeedbackImageAttachments.readFeedbackImageFiles>>
+          ) => void)
+        | undefined
+      mocks.readFeedbackImageFiles.mockReturnValue(
+        new Promise((resolve) => {
+          finishRead = resolve
+        })
+      )
+      render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
+      const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('What could we improve?')
+      await waitFor(() => expect(textarea.value).toContain('Orca:'))
+      fireEvent.change(textarea, { target: { value: 'before after' } })
+      textarea.focus()
+      textarea.setSelectionRange(7, 7)
+      const clipboard = new DataTransfer()
+      clipboard.setData('text/plain', 'report')
+      Object.defineProperty(clipboard, 'files', { value: [file] })
+
+      await user.paste(clipboard)
+      expect(textarea.value).toBe('before reportafter')
+      expect(textarea.selectionStart).toBe(13)
+      await user.keyboard('!')
+      expect(textarea.value).toBe('before report!after')
+      await waitFor(() => expect(mocks.readFeedbackImageFiles).toHaveBeenCalled())
+      const actual = await vi.importActual<typeof FeedbackImageAttachments>(
+        '@/lib/feedback-image-attachments'
+      )
+      const readResult =
+        result === 'refused'
+          ? await actual.readFeedbackImageFiles([file], 0)
+          : {
+              images: [
+                {
+                  id: 'shrunk',
+                  name: 'capture.png',
+                  contentType: 'image/png',
+                  bytes: 100,
+                  data: new Uint8Array([1]),
+                  previewUrl: 'blob:shrunk'
+                }
+              ],
+              errors: [],
+              notices: []
+            }
+      await act(async () => {
+        finishRead?.(readResult)
+      })
+      expect(textarea.value).toBe('before report!after')
+      expect(textarea.selectionStart).toBe(14)
+      if (result === 'refused') {
+        expect(mocks.toastWarning).toHaveBeenCalledWith('capture.png is larger than 4.0 MB.')
+        expect(screen.queryByRole('button', { name: 'Remove capture.png' })).toBeNull()
+      } else {
+        expect(screen.getByRole('button', { name: 'Remove capture.png' })).not.toBeNull()
+      }
+    }
+  )
+
+  it('still consumes mixed text when the image fits without shrinking', async () => {
+    const user = userEvent.setup()
+    mocks.readFeedbackImageFiles.mockResolvedValue({ images: [], errors: [], notices: [] })
+    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
+    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('What could we improve?')
+    await waitFor(() => expect(textarea.value).toContain('Orca:'))
+    fireEvent.change(textarea, { target: { value: 'report' } })
+    textarea.focus()
+    textarea.setSelectionRange(6, 6)
+    const clipboard = new DataTransfer()
+    clipboard.setData('text/plain', 'image metadata')
+    const file = new File(['image'], 'small.png', { type: 'image/png' })
+    Object.defineProperty(clipboard, 'files', { value: [file] })
+    await user.paste(clipboard)
+    expect(textarea.value).toBe('report')
+    expect(textarea.selectionStart).toBe(6)
+    await waitFor(() => expect(mocks.readFeedbackImageFiles).toHaveBeenCalledWith([file], 0, 0))
+  })
+
   it('keeps the dialog scrollable within short windows', () => {
     const { container } = render(<SidebarFeedbackDialog open on
```

**File**: `src/renderer/src/components/sidebar/SidebarFeedbackDialog.tsx` (modified, +7/-1)
```diff
@@ -263,7 +263,12 @@ export function SidebarFeedbackDialog({
           // An unsupported image still routes through for its rejection toast,
           // but preventing default there would silently eat co-pasted text.
           const reserved = getReservedImageCapacity()
-          if (hasAttachableFeedbackImage(pasted, reserved.count, reserved.bytes)) {
+          // An optimistic shrink may fail; let co-pasted text insert now rather than restore it later.
+          if (
+            hasAttachableFeedbackImage(pasted, reserved.count, reserved.bytes, {
+              allowShrinking: event.clipboardData.getData('text/plain').length === 0
+            })
+          ) {
             event.preventDefault()
           }
           handleAddFiles(pasted)
@@ -352,6 +357,7 @@ export function SidebarFeedbackDialog({
 
         <SidebarFeedbackImageAttachments
           images={images}
+          pendingCount={pendingImageReadCount}
           disabled={isSubmitting}
           isDragActive={isDragActive}
           onAddFiles={handleAddFiles}
```

**File**: `src/renderer/src/components/sidebar/SidebarFeedbackImageAttachments.tsx` (modified, +32/-8)
```diff
@@ -11,8 +11,13 @@ import {
   type FeedbackImageDraft
 } from '@/lib/feedback-image-attachments'
 
+// Why: an image that needs no shrink reads in a few ms, which would only flash the hint.
+const PREPARING_HINT_DELAY_MS = 250
+
 type SidebarFeedbackImageAttachmentsProps = {
   images: FeedbackImageDraft[]
+  /** Files picked but not yet read; a shrink keeps them pending long enough to show. */
+  pendingCount: number
   disabled: boolean
   isDragActive: boolean
   onAddFiles: (files: readonly File[]) => void
@@ -21,6 +26,7 @@ type SidebarFeedbackImageAttachmentsProps = {
 
 export function SidebarFeedbackImageAttachments({
   images,
+  pendingCount,
   disabled,
   isDragActive,
   onAddFiles,
@@ -33,6 +39,17 @@ export function SidebarFeedbackImageAttachments({
   const attachedBytes = images.reduce((total, image) => total + image.bytes, 0)
   const atCapacity =
     images.length >= MAX_FEEDBACK_IMAGE_COUNT || attachedBytes >= MAX_FEEDBACK_IMAGE_TOTAL_BYTES
+  const hasPendingReads = pendingCount > 0
+  const [showPreparing, setShowPreparing] = React.useState(false)
+  React.useEffect(() => {
+    if (!hasPendingReads) {
+      setShowPreparing(false)
+      return
+    }
+    const timer = window.setTimeout(() => setShowPreparing(true), PREPARING_HINT_DELAY_MS)
+    return () => window.clearTimeout(timer)
+  }, [hasPendingReads])
+  const isPreparing = hasPendingReads && showPreparing
 
   return (
     <div
@@ -43,14 +60,21 @@ export function SidebarFeedbackImageAttachments({
     >
       <div className="flex items-center justify-between gap-2">
         <span className="text-xs text-muted-foreground">
-          {translate(
-            'auto.components.sidebar.SidebarFeedbackImageAttachments.screenshotsHint',
-            'Attach up to {{count}} screenshots, {{maxSize}} total',
-            {
-              count: MAX_FEEDBACK_IMAGE_COUNT,
-              maxSize: formatFeedbackImageSize(MAX_FEEDBACK_IMAGE_TOTAL_BYTES)
-            }
-          )}
+          {/* Why: shrinking an oversized screenshot is slow enough that a silent gap
+              between the pick and the thumbnail reads as a dropped attachment. */}
+          {isPreparing
+            ? translate(
+                'auto.components.sidebar.SidebarFeedbackImageAttachments.preparing',
+                'Preparing attachments…'
+              )
+            : translate(
+                'auto.components.sidebar.SidebarFeedbackImageAttachments.screenshotsHint',
+                'Attach up to {{count}} screenshots, {{maxSize}} total',
+                {
+                  count: MAX_FEEDBACK_IMAGE_COUNT,
+                  maxSize: formatFeedbackImageSize(MAX_FEEDBACK_IMAGE_TOTAL_BYTES)
+                }
+              )}
         </span>
         <Button
           type="button"
```

**File**: `src/renderer/src/components/sidebar/use-sidebar-feedback-images.test.tsx` (modified, +74/-3)
```diff
@@ -4,6 +4,7 @@ import { act } from 'react'
 import { createRoot, type Root } from 'react-dom/client'
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 import type { FeedbackImageDraft } from '@/lib/feedback-image-attachments'
+import { toast } from 'sonner'
 import { useSidebarFeedbackImages } from './use-sidebar-feedback-images'
 
 const { readFeedbackImageFiles } = vi.hoisted(() => ({ readFeedbackImageFiles: vi.fn() }))
@@ -13,19 +14,20 @@ vi.mock('@/lib/feedback-image-attachments', async (importOriginal) => ({
   readFeedbackImageFiles
 }))
 
-vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn() } }))
+vi.mock('sonner', () => ({ toast: { info: vi.fn(), warning: vi.fn(), error: vi.fn() } }))
 
 type HookResult = ReturnType<typeof useSidebarFeedbackImages>
 
 let container: HTMLDivElement
 let root: Root
 let latest: HookResult | undefined
+let mountedRef: { current: boolean }
 
 function Harness(): null {
   latest = useSidebarFeedbackImages({
     open: false,
     isSubmitting: false,
-    mountedRef: { current: true }
+    mountedRef
   })
   return null
 }
@@ -44,6 +46,7 @@ function draft(id: string, bytes: number): FeedbackImageDraft {
 beforeEach(() => {
   readFeedbackImageFiles.mockReset()
   URL.revokeObjectURL = vi.fn()
+  mountedRef = { current: true }
   container = document.createElement('div')
   document.body.appendChild(container)
   root = createRoot(container)
@@ -80,7 +83,7 @@ describe('useSidebarFeedbackImages', () => {
     })
 
     await act(async () => {
-      finishFirstRead?.({ images: [draft('first', firstBytes)], errors: [] })
+      finishFirstRead?.({ images: [draft('first', firstBytes)], errors: [], notices: [] })
       await Promise.resolve()
       await Promise.resolve()
       // Still inside act: the first batch has committed to the ref, not to state.
@@ -90,4 +93,72 @@ describe('useSidebarFeedbackImages', () => {
 
     expect(readFeedbackImageFiles).toHaveBeenNthCalledWith(2, [second], 1, firstBytes)
   })
+
+  it('tells the user when an attachment was compressed to fit', async () => {
+    const notice = 'shot.png was compressed from 6.1 MB to 1.7 MB to fit the attachment limit.'
+    readFeedbackImageFiles.mockResolvedValue({
+      images: [draft('shot', 1_750_000)],
+      errors: [],
+      notices: [notice]
+    })
+
+    await act(async () => {
+      latest!.handleAddFiles([new File(['x'], 'shot.png', { type: 'image/png' })])
+    })
+
+    expect(toast.info).toHaveBeenCalledWith(notice)
+    expect(latest!.images.map((image) => image.bytes)).toEqual([1_750_000])
+  })
+
+  // Why: a batch still shrinking has no known size yet; reading the next one
+  // against its raw file size would refuse a screenshot even though room is left.
+  it('sizes a later add against the shrunk size, not the raw file size', async () => {
+    let finishShrink: ((value: unknown) => void) | undefined
+    readFeedbackImageFiles.mockReturnValueOnce(
+      new Promise((resolve) => {
+        finishShrink = resolve
+      })
+    )
+    readFeedbackImageFiles.mockReturnValue(new Promise(() => {}))
+    const retina = new File(['x'], 'retina.png', { type: 'image/png' })
+    Object.defineProperty(retina, 'size', { value: 6_400_000 })
+    const second = new File(['x'], 'second.png', { type: 'image/png' })
+
+    await act(async () => {
+      latest!.handleAddFiles([retina])
+      latest!.handleAddFiles([second])
+    })
+    expect(readFeedbackImageFiles).toHaveBeenCalledTimes(1)
+
+    await act(async () => {
+      finishShrink?.({ images: [draft('retina', 1_750_000)], errors: [], notices: [] })
+    })
+
+    expect(readFeedbackImageFiles).toHaveBeenNthCalledWith(2, [second], 1, 1_750_000)
+  })
+
+  // Why: a queued batch can hold several screenshots, each costing a decode and
+  // up to six re-encodes, all for drafts an unmounted dialog would only revoke.
+  it('skips batches still queued when the dialog unmounts', async () => {
+    let finishFirstRead: ((value: unknown) => void) | undefined
+    readFeedbackImageFiles.mockReturnValueOnce(
+      new Promise((resolve) => {
+        finishFirstRead = resolve
+      })
+    )
+    await act(async () => {
+      latest!.handleAddFiles([new File(['x'], 'first.png', { type: 'image/png' })])
+      latest!.handleAddFiles([new File(['x'], 'second.png', { type: 'image/png' })])
+    })
+    expect(readFeedbackImageFiles).toHaveBeenCalledTimes(1)
+
+    mountedRef.current = false
+    await act(async () => {
+      finishFirstRead?.({ images: [draft('first', 1000)], errors: [], notices: [] })
+    })
+
+    expect(readFeedbackImageFiles).toHaveBeenCalledTimes(1)
+    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first')
+    expect(latest!.hasPendingImageReads()).toBe(false)
+  })
 })
```

**File**: `src/renderer/src/components/sidebar/use-sidebar-feedback-images.ts` (modified, +32/-10)
```diff
@@ -2,12 +2,17 @@ import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
 import { toast } from 'sonner'
 import { translate } from '@/i18n/i18n'
 import {
+  maxFeedbackImageBatchBytes,
   readFeedbackImageFiles,
   releaseFeedbackImageDraft,
   type FeedbackImageDraft
 } from '@/lib/feedback-image-attachments'
 import { useFeedbackImageDrop } from './use-feedback-image-drop'
 
+function sumImageBytes(images: readonly FeedbackImageDraft[]): number {
+  return images.reduce((total, image) => total + image.bytes, 0)
+}
+
 export function useSidebarFeedbackImages(params: {
   open: boolean
   isSubmitting: boolean
@@ -22,15 +27,18 @@ export function useSidebarFeedbackImages(params: {
   handleRemoveImage: (id: string) => void
   clearImages: () => void
   hasPendingImageReads: () => boolean
-  /** Live committed+pending count and bytes, for the paste and attach gates. */
+  /** Live committed+pending count and bytes, for the synchronous paste gate. */
   getReservedImageCapacity: () => { count: number; bytes: number }
 } {
   const [images, setImages] = useState<FeedbackImageDraft[]>([])
   const [pendingImageReadCount, setPendingImageReadCount] = useState(0)
   const liveImageDraftsRef = useRef<FeedbackImageDraft[]>([])
-  // Why: committed state lags in-flight reads, so batches still being read count
-  // against capacity — otherwise two quick pastes both see room for four.
+  // Why: the paste gate answers synchronously, so batches still queued or being
+  // read count against it — otherwise two quick pastes both see room for four.
   const pendingImageReadsRef = useRef({ count: 0, bytes: 0 })
+  // Why: a shrunk image's size is unknown until it is read, so batches read one
+  // at a time, each sized against what the batches before it actually committed.
+  const readQueueRef = useRef<Promise<void> | null>(null)
 
   const clearImages = useCallback(() => {
     liveImageDraftsRef.current.forEach(releaseFeedbackImageDraft)
@@ -54,7 +62,7 @@ export function useSidebarFeedbackImages(params: {
     const pendingReads = pendingImageReadsRef.current
     return {
       count: liveDrafts.length + pendingReads.count,
-      bytes: liveDrafts.reduce((total, image) => total + image.bytes, 0) + pendingReads.bytes
+      bytes: sumImageBytes(liveDrafts) + pendingReads.bytes
     }
   }, [])
 
@@ -72,14 +80,22 @@ export function useSidebarFeedbackImages(params: {
         )
         return
       }
-      const { count: existingCount, bytes: existingBytes } = getReservedImageCapacity()
       const pendingReads = pendingImageReadsRef.current
-      const batchBytes = files.reduce((total, file) => total + file.size, 0)
+      // Why: earlier reads can fail and attached images can be removed before this reads.
+      const batchBytes = maxFeedbackImageBatchBytes(files, 0, 0)
       pendingReads.count += files.length
       pendingReads.bytes += batchBytes
       setPendingImageReadCount((current) => current + files.length)
-      void readFeedbackImageFiles(files, existingCount, existingBytes).then(
-        ({ images: added, errors }) => {
+      const read = (readQueueRef.current ?? Promise.resolve()).then(() => {
+        // Why: an unmounted dialog discards whatever this reads, so skip the decode and re-encodes.
+        if (!params.mountedRef.current) {
+          return { images: [], errors: [], notices: [] }
+        }
+        const committed = liveImageDraftsRef.current
+        return readFeedbackImageFiles(files, committed.length, sumImageBytes(committed))
+      })
+      const settled = read.then(
+        ({ images: added, errors, notices }) => {
           pendingReads.count -= files.length
           pendingReads.bytes -= batchBytes
           if (!params.mountedRef.current) {
@@ -91,7 +107,8 @@ export function useSidebarFeedbackImages(params: {
             liveImageDraftsRef.current = [...liveImageDraftsRef.current, ...added]
             setImages((existing) => [...existing, ...added])
           }
-          // Why: never drop an attachment without telling the user.
+          // Why: never drop or degrade an attachment without telling the user.
+          notices.forEach((notice) => toast.info(notice))
           errors.forEach((error) => toast.warning(error))
         },
         (error: unknown) => {
@@ -109,8 +126,13 @@ export function useSidebarFeedbackImages(params: {
           }
         }
       )
+      // Why: the tail is what the next batch waits on, so a throw inside either
+      // callback would leave it rejected and report every later attach as unreadable.
+      readQueueRef.current = settled.catch((error: unknown) => {
+        console.error('Failed to settle a feedback image batch:', error)
+      })
     },
-    [getReservedImageCapacity, params.isSubmitting, params.mountedRef]
+    [params.isSubmitting, params.mountedRef]
   )
 
   const handleRemoveImage = useCallback((id: string) => {
```

**File**: `src/renderer/src/i18n/locales/en.json` (modified, +3/-1)
```diff
@@ -1057,7 +1057,8 @@
             "totalTooLarge": "{{fileName}} would bring the attachments over {{maxSize}} in total.",
             "dimensionsTooLarge": "{{fileName}} has dimensions that are too large to preview safely.",
             "invalidImage": "{{fileName}} is not a valid supported image.",
-            "additionalErrors": "{{count}} additional images could not be attached."
+            "additionalErrors": "{{count}} additional images could not be attached.",
+            "compressed": "{{fileName}} was compressed from {{originalSize}} to {{size}} to fit the attachment limit."
           }
         }
       },
@@ -6424,6 +6425,7 @@
         "SidebarFeedbackImageAttachments": {
           "screenshotsHint": "Attach up to {{count}} screenshots, {{maxSize}} total",
           "attachImages": "Attach",
+          "preparing": "Preparing attachments…",
           "removeImage": "Remove {{fileName}}"
         },
         "WorkspaceKanbanSearchField": {
```

---

### Incident Patch 11: `4ccfc166` (2026-10-06)
**Commit Message**: fix(sidebar): preserve host filters across stale UI updates (#25737)

**File**: `src/renderer/src/app-shell/use-persisted-ui-writer.ts` (modified, +2/-0)
```diff
@@ -156,6 +156,8 @@ export function usePersistedUIWriter(): void {
       sortBy: s.sortBy,
       projectOrderBy: s.projectOrderBy,
       showSleepingWorkspaces: s.showSleepingWorkspaces,
+      workspaceHostScope: s.workspaceHostScope,
+      visibleWorkspaceHostIds: s.visibleWorkspaceHostIds,
       hideDefaultBranchWorkspace: s.hideDefaultBranchWorkspace,
       hideAutomationGeneratedWorkspaces: s.hideAutomationGeneratedWorkspaces,
       hideCliCreatedWorkspaces: s.hideCliCreatedWorkspaces,
```

**File**: `src/renderer/src/app-shell/workspace-view-cross-client-sync.test.tsx` (modified, +34/-0)
```diff
@@ -270,6 +270,40 @@ describe('workspace view preferences: cross-client persistence (STA-5781)', () =
     expect(after.hideCliCreatedWorkspaces).toBe(before.hideCliCreatedWorkspaces)
   })
 
+  it('saves a revealed remote host after an unrelated older broadcast', async () => {
+    act(() => {
+      authority.set({ workspaceHostScope: 'local', visibleWorkspaceHostIds: ['local'] })
+    })
+    deliverBroadcasts()
+    act(() => {
+      authority.set({ sidebarWidth: 320 })
+      store.getState().setVisibleWorkspaceHostIds(['local', 'runtime:m4air'])
+    })
+    pendingBroadcasts.reverse()
+    deliverBroadcasts()
+    expect(store.getState().visibleWorkspaceHostIds).toEqual(['local', 'runtime:m4air'])
+    await flushDesktopDebounce()
+    deliverBroadcasts()
+    expect(authority.get().visibleWorkspaceHostIds).toEqual(['local', 'runtime:m4air'])
+    expect(authority.get().sidebarWidth).toBe(320)
+  })
+
+  it('saves All hosts after flipping back during a host-selection write', async () => {
+    holdAcks = true
+    act(() => store.getState().setWorkspaceHostScope('local'))
+    await flushDesktopDebounce()
+    act(() => store.getState().setWorkspaceHostScope('all'))
+    deliverBroadcasts()
+    expect(store.getState().visibleWorkspaceHostIds).toBeNull()
+    expect(store.getState().workspaceHostScope).toBe('all')
+    await resolveAcks()
+    holdAcks = false
+    await flushDesktopDebounce()
+    deliverBroadcasts()
+    expect(authority.get().visibleWorkspaceHostIds).toBeNull()
+    expect(authority.get().workspaceHostScope).toBe('all')
+  })
+
   it('persists a left sidebar close across an unrelated sync and restores it on startup', async () => {
     act(() => {
       store.getState().toggleSidebar()
```

**File**: `src/renderer/src/store/slices/persisted-ui-write-baseline.test.ts` (modified, +13/-0)
```diff
@@ -21,6 +21,8 @@ function makeBaseline(overrides: Partial<PersistedUIWriteBaseline> = {}): Persis
     sortBy: 'recent',
     projectOrderBy: 'manual',
     showSleepingWorkspaces: true,
+    workspaceHostScope: 'all',
+    visibleWorkspaceHostIds: null,
     hideDefaultBranchWorkspace: false,
     hideAutomationGeneratedWorkspaces: false,
     hideCliCreatedWorkspaces: false,
@@ -58,18 +60,29 @@ describe('PERSISTED_UI_WRITE_BASELINE_FIELDS', () => {
 describe('diffPersistedUIWriteFields', () => {
   it('is empty when values are equal even across fresh array/record identities', () => {
     const a = makeBaseline({
+      visibleWorkspaceHostIds: ['local', 'runtime:m4air'],
       filterRepoIds: ['r1', 'r2'],
       showDotfilesByWorktree: { w1: true },
       acknowledgedAgentsByPaneKey: { p1: 5 }
     })
     const b = makeBaseline({
+      visibleWorkspaceHostIds: ['local', 'runtime:m4air'],
       filterRepoIds: ['r1', 'r2'],
       showDotfilesByWorktree: { w1: true },
       acknowledgedAgentsByPaneKey: { p1: 5 }
     })
     expect(diffPersistedUIWriteFields(a, b)).toEqual({})
   })
 
+  it('distinguishes All hosts from a selected host list', () => {
+    expect(
+      diffPersistedUIWriteFields(
+        makeBaseline({ visibleWorkspaceHostIds: null }),
+        makeBaseline({ visibleWorkspaceHostIds: ['local'] })
+      )
+    ).toEqual({ visibleWorkspaceHostIds: null })
+  })
+
   it('reports only the diverged fields, valued from the current mirror', () => {
     const baseline = makeBaseline()
     const current = makeBaseline({ showSleepingWorkspaces: false, filterRepoIds: ['r1'] })
```

**File**: `src/renderer/src/store/slices/persisted-ui-write-baseline.ts` (modified, +7/-0)
```diff
@@ -21,6 +21,8 @@ export type PersistedUIWriteBaseline = {
   sortBy: PersistedUIState['sortBy']
   projectOrderBy: PersistedUIState['projectOrderBy']
   showSleepingWorkspaces: boolean
+  workspaceHostScope: PersistedUIState['workspaceHostScope']
+  visibleWorkspaceHostIds: PersistedUIState['visibleWorkspaceHostIds']
   hideDefaultBranchWorkspace: boolean
   hideAutomationGeneratedWorkspaces: boolean
   hideCliCreatedWorkspaces: boolean
@@ -52,6 +54,8 @@ const PERSISTED_UI_WRITE_BASELINE_FIELD_SET = {
   sortBy: true,
   projectOrderBy: true,
   showSleepingWorkspaces: true,
+  workspaceHostScope: true,
+  visibleWorkspaceHostIds: true,
   hideDefaultBranchWorkspace: true,
   hideAutomationGeneratedWorkspaces: true,
   hideCliCreatedWorkspaces: true,
@@ -104,6 +108,9 @@ function writeFieldEqual(field: keyof PersistedUIWriteBaseline, a: unknown, b: u
   if (field === 'filterRepoIds') {
     return stringArrayEqual(a as readonly string[], b as readonly string[])
   }
+  if (field === 'visibleWorkspaceHostIds') {
+    return a === b || (Array.isArray(a) && Array.isArray(b) && stringArrayEqual(a, b))
+  }
   if (
     field === 'explorerDisplayRootByWorktree' ||
     field === 'showDotfilesByWorktree' ||
```

**File**: `src/renderer/src/store/slices/ui-host-filter-sync.test.ts` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { createUIStore, makePersistedUI } from './ui-slice-test-harness'
+
+beforeEach(() => {
+  vi.stubGlobal('window', { api: { ui: { set: vi.fn().mockResolvedValue(undefined) } } })
+})
+afterEach(() => vi.unstubAllGlobals())
+
+describe('host visibility across saved UI broadcasts', () => {
+  it('keeps a newly revealed remote host when an older UI snapshot arrives', () => {
+    const store = createUIStore()
+    const previous = makePersistedUI({
+      workspaceHostScope: 'local',
+      visibleWorkspaceHostIds: ['local']
+    })
+    store.getState().hydratePersistedUI(previous)
+
+    store.getState().setVisibleWorkspaceHostIds(['local', 'runtime:m4air'])
+    store.getState().hydratePersistedUI(previous, 'sync')
+
+    expect(store.getState().visibleWorkspaceHostIds).toEqual(['local', 'runtime:m4air'])
+  })
+
+  it('keeps All hosts while the prior selection is being saved', () => {
+    const store = createUIStore()
+    const previous = makePersistedUI({ workspaceHostScope: 'all', visibleWorkspaceHostIds: null })
+    store.getState().hydratePersistedUI(previous)
+    const fields = ['workspaceHostScope', 'visibleWorkspaceHostIds'] as const
+    store.getState().setWorkspaceHostScope('local')
+    store.getState().notePersistedUIWriteStarted(fields)
+    store.getState().setWorkspaceHostScope('all')
+
+    store
+      .getState()
+      .hydratePersistedUI(
+        makePersistedUI({ workspaceHostScope: 'local', visibleWorkspaceHostIds: ['local'] }),
+        'sync'
+      )
+
+    expect(store.getState().workspaceHostScope).toBe('all')
+    expect(store.getState().visibleWorkspaceHostIds).toBeNull()
+  })
+
+  it('accepts another client’s host selection when there is no local edit', () => {
+    const store = createUIStore()
+    store.getState().hydratePersistedUI(makePersistedUI())
+    store.getState().hydratePersistedUI(
+      makePersistedUI({
+        workspaceHostScope: 'runtime:m4air',
+        visibleWorkspaceHostIds: ['runtime:m4air']
+      }),
+      'sync'
+    )
+
+    expect(store.getState().workspaceHostScope).toBe('runtime:m4air')
+    expect(store.getState().visibleWorkspaceHostIds).toEqual(['runtime:m4air'])
+  })
+})
```

**File**: `src/renderer/src/store/slices/ui-hydration-view-layout.test.ts` (modified, +4/-10)
```diff
@@ -480,7 +480,7 @@ describe('createUISlice hydratePersistedUI', () => {
     expect(setUI).not.toHaveBeenCalled()
   })
 
-  it('persists workspace host scope changes', () => {
+  it('updates workspace host scope for the guarded UI writer', () => {
     const setUI = vi.fn(() => Promise.resolve())
     vi.stubGlobal('window', { api: { ui: { set: setUI } } })
     const store = createUIStore()
@@ -489,13 +489,10 @@ describe('createUISlice hydratePersistedUI', () => {
 
     expect(store.getState().workspaceHostScope).toBe('runtime:env-1')
     expect(store.getState().visibleWorkspaceHostIds).toEqual(['runtime:env-1'])
-    expect(setUI).toHaveBeenCalledWith({
-      workspaceHostScope: 'runtime:env-1',
-      visibleWorkspaceHostIds: ['runtime:env-1']
-    })
+    expect(setUI).not.toHaveBeenCalled()
   })
 
-  it('persists visible workspace host changes independently of focused host', () => {
+  it('updates host visibility independently of focused host for the guarded UI writer', () => {
     const setUI = vi.fn(() => Promise.resolve())
     vi.stubGlobal('window', { api: { ui: { set: setUI } } })
     const store = createUIStore()
@@ -505,10 +502,7 @@ describe('createUISlice hydratePersistedUI', () => {
 
     expect(store.getState().workspaceHostScope).toBe('runtime:env-1')
     expect(store.getState().visibleWorkspaceHostIds).toEqual(['local', 'runtime:env-1'])
-    expect(setUI).toHaveBeenLastCalledWith({
-      workspaceHostScope: 'runtime:env-1',
-      visibleWorkspaceHostIds: ['local', 'runtime:env-1']
-    })
+    expect(setUI).not.toHaveBeenCalled()
   })
 
   it('persists workspace host order changes', () => {
```

**File**: `src/renderer/src/store/slices/ui/ui-slice-preference-actions.ts` (modified, +0/-6)
```diff
@@ -67,9 +67,6 @@ export function createUiPreferenceActions(set: UISliceSet, get: UISliceGet): Par
       const normalized = normalizeExecutionHostScope(scope)
       const visibleWorkspaceHostIds = normalized === 'all' ? null : [normalized]
       set({ workspaceHostScope: normalized, visibleWorkspaceHostIds })
-      window.api.ui
-        .set({ workspaceHostScope: normalized, visibleWorkspaceHostIds })
-        .catch(console.error)
     },
     visibleWorkspaceHostIds: null,
     setVisibleWorkspaceHostIds: (ids) => {
@@ -82,9 +79,6 @@ export function createUiPreferenceActions(set: UISliceSet, get: UISliceGet): Par
         workspaceHostScope = normalized[0]
       }
       set({ visibleWorkspaceHostIds: normalized, workspaceHostScope })
-      window.api.ui
-        .set({ visibleWorkspaceHostIds: normalized, workspaceHostScope })
-        .catch(console.error)
     },
     workspaceHostOrder: [],
     setWorkspaceHostOrder: (ids) => {
```

---

### Incident Patch 12: `ea6c9d6f` (2026-10-06)
**Commit Message**: fix(test): restore the codexProviderHandle import the #25078 squash removed again (#25728)

**File**: `src/main/native-chat/agent-session-journal/journal-submission-positions.test.ts` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ import {
   type AgentJournalMessageItem,
   type AgentSessionJournalIdentity
 } from '../../../shared/agent-session-journal-types'
+import { codexProviderHandle } from '../../../shared/agent-session-provider-handle-encoding'
 import { readAgentSessionHydrationPage } from '../agent-session-wire/agent-session-history-page'
 import { createTrackedJournalOpener } from './journal-host-database-test-support'
 
```

---

### Incident Patch 13: `41f1103c` (2026-10-06)
**Commit Message**: fix(test): restore the codexProviderHandle import in the submission-positions test (#25722)

**File**: `src/main/native-chat/agent-session-journal/journal-submission-positions.test.ts` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ import {
   type AgentJournalMessageItem,
   type AgentSessionJournalIdentity
 } from '../../../shared/agent-session-journal-types'
+import { codexProviderHandle } from '../../../shared/agent-session-provider-handle-encoding'
 import { readAgentSessionHydrationPage } from '../agent-session-wire/agent-session-history-page'
 import { createTrackedJournalOpener } from './journal-host-database-test-support'
 
```

---

### Incident Patch 14: `9323443c` (2026-10-06)
**Commit Message**: fix(test): drop the duplicate codexProviderHandle import in the submission-positions test (#25713)

Two fixes for the same provider-handle change (#22682 and #25709) each added the import,
so main fails tc:node with TS2300 (duplicate identifier).



---

### Incident Patch 15: `135c92e0` (2026-10-06)
**Commit Message**: fix(native-chat): an unsent draft survives a reload or quit (#24905)

* fix(native-chat): an unsent draft survives a reload or quit

The composer's draft text, its editor document and settled image refs lived
only in module memory, so a reload, quit or crash lost whatever was typed,
including text a Stop had just given back. They are now saved per pane scope
in localStorage: typing is debounced and flushed when the window hides or
closes, text given back to the composer is saved at once, an emptied or sent
draft is removed at once, and only the newest drafts within the composer
caches' existing bound are kept.

* fix(native-chat): save draft images outside the state updater

* fix(native-chat): one store owns each unsent draft

The draft's text and its image chips were saved by two writers that each
rebuilt the stored record from what storage held, so a draft that once went
over the size cap, or one refused write, lost its images on the next save.

One store now holds each composer scope's whole draft in memory and writes
storage from it: typing is coalesced, returned text, chips and clears land at
once, a refused write stays pending for the next flush, and all drafts
together keep

**File**: `src/main/window/clipboard-dashboard-popout-access.test.ts` (modified, +3/-0)
```diff
@@ -109,6 +109,9 @@ describe('dashboard popout clipboard access', () => {
     expect(() => handlers.get('clipboard:readFilePaths')?.(popoutEvent)).toThrow(
       'Unauthorized clipboard IPC sender'
     )
+    expect(() =>
+      handlers.get('clipboard:restoreNativeChatPastes')?.(popoutEvent, ['/etc/passwd'])
+    ).toThrow('Unauthorized clipboard IPC sender')
     expect(() =>
       handlers.get('clipboard:writeFile')?.(popoutEvent, {
         filePath: '/tmp/copied-file.txt',
```

**File**: `src/main/window/clipboard-image-temp-file.test.ts` (modified, +27/-5)
```diff
@@ -1,12 +1,16 @@
+import { dirname, join } from 'node:path'
 import { beforeEach, describe, expect, it, vi } from 'vitest'
 
-const { writeFileMock, getPathMock, writeFileBase64Mock } = vi.hoisted(() => ({
+const { writeFileMock, mkdirMock, getPathMock, writeFileBase64Mock } = vi.hoisted(() => ({
   writeFileMock: vi.fn(),
-  getPathMock: vi.fn(() => '/var/folders/ab/T'),
+  mkdirMock: vi.fn(),
+  getPathMock: vi.fn((name: string) =>
+    name === 'temp' ? '/os/temp' : '/Users/me/Library/Application Support/orca'
+  ),
   writeFileBase64Mock: vi.fn()
 }))
 
-vi.mock('node:fs/promises', () => ({ default: { writeFile: writeFileMock } }))
+vi.mock('node:fs/promises', () => ({ default: { writeFile: writeFileMock, mkdir: mkdirMock } }))
 vi.mock('node:crypto', () => ({ randomUUID: () => 'uuid-1' }))
 vi.mock('../../shared/app-environment', () => ({
   getAppEnvironment: () => ({ getPath: getPathMock })
@@ -25,10 +29,28 @@ beforeEach(() => {
 })
 
 describe('saveClipboardImageBufferAsTempFile', () => {
-  it('writes the pasted image to the local temp folder', async () => {
+  it('keeps a terminal, editor or phone paste in OS temp, as before', async () => {
     const savedPath = await saveClipboardImageBufferAsTempFile(Buffer.from([1, 2, 3]))
 
-    expect(savedPath.startsWith('/var/folders/ab/T')).toBe(true)
+    expect(getPathMock).toHaveBeenCalledWith('temp')
+    expect(getPathMock).not.toHaveBeenCalledWith('userData')
+    expect(mkdirMock).not.toHaveBeenCalled()
+    expect(dirname(savedPath)).toBe('/os/temp')
+    expect(writeFileMock).toHaveBeenCalledWith(savedPath, Buffer.from([1, 2, 3]))
+  })
+
+  it('writes a native-chat composer paste into the paste folder, where its draft can find it', async () => {
+    const savedPath = await saveClipboardImageBufferAsTempFile(Buffer.from([1, 2, 3]), {
+      forNativeChatDraft: true
+    })
+
+    expect(mkdirMock).toHaveBeenCalledWith(
+      join('/Users/me/Library/Application Support/orca', 'native-chat-pastes'),
+      { recursive: true }
+    )
+    expect(dirname(savedPath)).toBe(
+      join('/Users/me/Library/Application Support/orca', 'native-chat-pastes')
+    )
     expect(writeFileMock).toHaveBeenCalledWith(savedPath, Buffer.from([1, 2, 3]))
   })
 
```

**File**: `src/main/window/clipboard-image-temp-file.ts` (modified, +12/-2)
```diff
@@ -2,14 +2,17 @@ import fs from 'node:fs/promises'
 import path from 'node:path'
 import { randomUUID } from 'node:crypto'
 
-import { getAppEnvironment } from '../../shared/app-environment'
 import { requireSshFilesystemProvider } from '../providers/ssh-filesystem-dispatch'
+import { getAppEnvironment } from '../../shared/app-environment'
 import { isWindowsAbsolutePathLike } from '../../shared/cross-platform-path'
 import { assertClipboardImageByteLengthWithinLimit } from '../../shared/clipboard-image'
+import { nativeChatPasteFolder } from './native-chat-paste-files'
 
 export type SaveClipboardImageAsTempFileArgs = {
   connectionId?: string | null
   runtimeEnvironmentId?: string | null
+  /** A native-chat composer paste: kept in Orca's paste folder so its draft can bring it back. */
+  forNativeChatDraft?: boolean
 }
 
 const REMOTE_CLIPBOARD_IMAGE_TEMP_DIR = '/tmp'
@@ -39,7 +42,14 @@ export async function saveClipboardImageBufferAsTempFile(
     return remotePath
   }
 
-  const tempPath = path.join(getAppEnvironment().getPath('temp'), fileName)
+  // Why only a composer paste goes to the paste folder: its draft can bring it back after a
+  // restart, while terminal, editor and phone pastes stay in OS temp, as they always have.
+  let folder = getAppEnvironment().getPath('temp')
+  if (args?.forNativeChatDraft === true) {
+    folder = nativeChatPasteFolder()
+    await fs.mkdir(folder, { recursive: true })
+  }
+  const tempPath = path.join(folder, fileName)
   await fs.writeFile(tempPath, buffer)
   return tempPath
 }
```

**File**: `src/main/window/clipboard-ipc-handlers.test.ts` (modified, +1/-3)
```diff
@@ -84,9 +84,7 @@ vi.mock('node:fs/promises', () => ({
   stat: fsStatMock,
   realpath: vi.fn(), // unused here; only satisfies filesystem-path-containment's named import
   writeFile: fsWriteFileMock,
-  default: {
-    writeFile: fsWriteFileMock
-  }
+  default: { writeFile: fsWriteFileMock, mkdir: fsMkdirMock }
 }))
 
 vi.mock('../ipc/filesystem-auth', () => ({
```

**File**: `src/main/window/clipboard-ipc-handlers.ts` (modified, +7/-0)
```diff
@@ -44,6 +44,7 @@ import { readClipboardCopiedFilePaths } from './clipboard-copied-file-paths'
 import { buildClipboardImageThumbnail } from './clipboard-image-thumbnail'
 import { writeClipboardTextAndVerify } from './clipboard-text-write-verify'
 import { isDashboardPopoutRenderer } from './dashboard-popout-window'
+import { restoreNativeChatPastes, sweepExpiredNativeChatPastes } from './native-chat-paste-files'
 
 let trustedClipboardRendererWebContentsId: number | null = null
 
@@ -101,8 +102,10 @@ export function registerClipboardHandlers(store: Store): void {
   ipcMain.removeHandler('clipboard:readImageThumbnail')
   ipcMain.removeHandler('clipboard:hasImage')
   ipcMain.removeHandler('clipboard:readFilePaths')
+  ipcMain.removeHandler('clipboard:restoreNativeChatPastes')
 
   void cleanupExpiredRemoteClipboardFiles()
+  void sweepExpiredNativeChatPastes()
   scheduleLegacyRemoteClipboardFileCleanup()
 
   ipcMain.handle('clipboard:readText', async (event, options?: ReadClipboardTextOptions) => {
@@ -116,6 +119,10 @@ export function registerClipboardHandlers(store: Store): void {
       return assertClipboardTextWithinLimitWithYield(clipboard.readText('selection'), options)
     }
   )
+  ipcMain.handle('clipboard:restoreNativeChatPastes', (event, paths: unknown) => {
+    assertTrustedClipboardSender(event)
+    return restoreNativeChatPastes(paths)
+  })
   // Why: an unanswered paste reads as a dropped paste, so the composer probes
   // the clipboard in memory before the (slower) save lands.
   ipcMain.handle('clipboard:readImageThumbnail', (event): ClipboardImageThumbnail | null => {
```

**File**: `src/main/window/clipboard-runtime-owned-ssh-paste.test.ts` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ vi.mock('node:fs/promises', () => ({
   stat: vi.fn(),
   realpath: vi.fn(),
   writeFile: fsWriteFileMock,
-  default: { writeFile: fsWriteFileMock }
+  default: { writeFile: fsWriteFileMock, mkdir: vi.fn() }
 }))
 vi.mock('../ipc/filesystem-auth', () => ({
   PATH_ACCESS_DENIED_MESSAGE: 'denied',
```

**File**: `src/main/window/native-chat-paste-files.test.ts` (added, +290/-0)
```diff
@@ -0,0 +1,290 @@
+import {
+  existsSync,
+  lutimesSync,
+  mkdirSync,
+  mkdtempSync,
+  realpathSync,
+  rmSync,
+  symlinkSync,
+  utimesSync,
+  writeFileSync
+} from 'node:fs'
+import { tmpdir } from 'node:os'
+import path from 'node:path'
+import { afterEach, beforeEach, describe, expect, it } from 'vitest'
+import { installFakeAppEnvironment } from '../../../config/scripts/vitest-host-ports-setup'
+import { AGENT_SESSION_MAX_NEW_OPERATION_AGE_MS } from '../../shared/agent-session-host-authority'
+
+import type { Store } from '../persistence'
+import { resolveLocalFileRequestPath } from '../ipc/local-file-access-resolution'
+import { readLocalFileContent } from '../ipc/filesystem/filesystem-file-content-inspection'
+import {
+  NATIVE_CHAT_PASTE_TTL_MS,
+  isInsideNativeChatPasteFolder,
+  restoreNativeChatPastes,
+  sweepExpiredNativeChatPastes
+} from './native-chat-paste-files'
+
+// A store with no projects: nothing but an access kind decides what a read may reach.
+const NO_PROJECTS: Store = Object.assign(Object.create(null), {
+  getRepos: () => [],
+  getProjects: () => [],
+  getProjectGroups: () => [],
+  getFolderWorkspaces: () => [],
+  getSettings: () => ({ nestWorkspaces: false, workspaceDir: '' })
+})
+
+/** Whether the composer preview's chat-image access can read `target`. */
+async function chatImageReadable(target: string): Promise<boolean> {
+  try {
+    await readLocalFileContent(
+      await resolveLocalFileRequestPath(target, { kind: 'chat-image' }, NO_PROJECTS)
+    )
+    return true
+  } catch {
+    return false
+  }
+}
+
+describe('isInsideNativeChatPasteFolder', () => {
+  const posixFolder = '/data/native-chat-pastes'
+  const winFolder = 'C:\\Users\\Me\\AppData\\Roaming\\Orca\\native-chat-pastes'
+
+  it.each([
+    ['a file inside', `${posixFolder}/orca-paste-1.png`, true],
+    ['a name that only starts with dots', `${posixFolder}/..orca-paste-1.png`, true],
+    ['the folder itself', posixFolder, false],
+    ['the parent', '/data', false],
+    ['a sibling reached through ..', `${posixFolder}/../secret.png`, false],
+    ['a sibling folder sharing the prefix', '/data/native-chat-pastes-evil/x.png', false],
+    ['an unrelated absolute path', '/etc/passwd', false]
+  ])('posix: %s', (_label, target, inside) => {
+    expect(isInsideNativeChatPasteFolder(posixFolder, target, path.posix, 'darwin')).toBe(inside)
+  })
+
+  it.each([
+    ['a file inside', `${winFolder}\\orca-paste-1.png`, true],
+    ['a file inside in other letter case', `${winFolder.toLowerCase()}\\ORCA-PASTE-1.PNG`, true],
+    ['a \\\\?\\ prefixed file inside', `\\\\?\\${winFolder}\\orca-paste-1.png`, true],
+    ['another drive', 'D:\\native-chat-pastes\\orca-paste-1.png', false],
+    ['a \\\\?\\UNC share', '\\\\?\\UNC\\server\\share\\orca-paste-1.png', false],
+    ['a sibling reached through ..', `${winFolder}\\..\\secret.png`, false],
+    ['the folder itself', winFolder, false]
+  ])('win32: %s', (_label, target, inside) => {
+    expect(isInsideNativeChatPasteFolder(winFolder, target, path.win32, 'win32')).toBe(inside)
+  })
+
+  it('compares a \\\\?\\ prefixed folder like its plain form', () => {
+    expect(
+      isInsideNativeChatPasteFolder(
+        `\\\\?\\${winFolder}`,
+        `${winFolder}\\orca-paste-1.png`,
+        path.win32,
+        'win32'
+      )
+    ).toBe(true)
+  })
+})
+
+describe('native-chat paste folder on disk', () => {
+  let root: string
+  let folder: string
+
+  beforeEach(() => {
+    root = mkdtempSync(path.join(tmpdir(), 'orca-native-chat-pastes-'))
+    folder = path.join(root, 'native-chat-pastes')
+    mkdirSync(folder)
+    installFakeAppEnvironment({ getPath: () => root })
+  })
+
+  afterEach(() => {
+    rmSync(root, { recursive: true, force: true })
+  })
+
+  it('keeps only files really inside the folder, and never throws on a bad path', async () => {
+    const kept = path.join(folder, 'orca-paste-1.png')
+    writeFileSync(kept, 'png')
+    const outside = path.join(root, 'outside.png')
+    writeFileSync(outside, 'png')
+    const linkOut = path.join(folder, 'orca-paste-2.png')
+    symlinkSync(outside, linkOut)
+    mkdirSync(path.join(folder, 'orca-paste-dir.png'))
+
+    const results = await restoreNativeChatPastes([
+      kept,
+      linkOut,
+      path.join(folder, '..', 'outside.png'),
+      path.join(folder, 'orca-paste-dir.png'),
+      path.join(folder, 'orca-paste-missing.png'),
+      'relative/orca-paste-3.png',
+      '',
+      42
+    ])
+
+    expect(results).toEqual([
+      { path: kept, kept: true, exists: true },
+      { path: linkOut, kept: false, exists: false },
+      { path: path.join(folder, '..', 'outside.png'), kept: false, exists: false },
+      { path: path.join(folder, 'orca-paste-dir.png'), kept: false, exists: false },
+      { path: path.join(folder, 'orca-paste-missing.png'), kept: false, exists: false },
+      { path: 'relative/orca-paste-3.png', kept: false, exists: false },
+      { path: '', kept
```

**File**: `src/main/window/native-chat-paste-files.ts` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+// Local native-chat pastes live in an Orca-owned folder, so a restored draft can show and send them:
+// a restore keeps only files that really are inside it, and old files expire.
+
+import { lstat, readdir, realpath, stat, unlink } from 'node:fs/promises'
+import path from 'node:path'
+import { getAppEnvironment } from '../../shared/app-environment'
+import { NATIVE_CHAT_PASTE_FOLDER } from '../../shared/native-chat-paste-folder'
+
+// Why 30 days: no age bounds what can still name a paste (a queued send is retried with a new id
+// after the host's 24 h id window), so this is a judgment. A draft or outbox entry kept longer meets
+// its image as a placeholder or a failed send, and a sent paste's file lingers until then.
+export const NATIVE_CHAT_PASTE_TTL_MS = 30 * 24 * 60 * 60 * 1000
+const PASTE_FILE_NAME = /^orca-paste-.+\.png$/i
+const MAX_RESTORED_PASTES = 256
+
+type PathApi = typeof path.posix
+
+export type RestoredNativeChatPaste = { path: string; kept: boolean; exists: boolean }
+
+export function nativeChatPasteFolder(): string {
+  return path.join(getAppEnvironment().getPath('userData'), NATIVE_CHAT_PASTE_FOLDER)
+}
+
+/** A path as compared for containment: no `\\?\` prefix, and case-folded where the platform is. */
+function comparablePath(value: string, pathApi: PathApi, platform: string): string {
+  const unprefixed = value.replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\/, '')
+  const normalized = pathApi.normalize(unprefixed)
+  return platform === 'win32' ? normalized.toLowerCase() : normalized
+}
+
+/** True when `target` names something strictly inside `folder`; both must already be real paths. */
+export function isInsideNativeChatPasteFolder(
+  folder: string,
+  target: string,
+  pathApi: PathApi = path,
+  platform: string = process.platform
+): boolean {
+  const relative = pathApi.relative(
+    comparablePath(folder, pathApi, platform),
+    comparablePath(target, pathApi, platform)
+  )
+  return (
+    relative !== '' &&
+    relative !== '..' &&
+    !relative.startsWith(`..${pathApi.sep}`) &&
+    !pathApi.isAbsolute(relative)
+  )
+}
+
+/**
+ * For each restored local paste: kept only when its real path is a file inside the real paste
+ * folder (symlinks and junctions resolved). Anything else comes back as a placeholder. Nothing is
+ * granted: the preview reads a paste with chat-image access. Never throws.
+ */
+export async function restoreNativeChatPastes(paths: unknown): Promise<RestoredNativeChatPaste[]> {
+  if (!Array.isArray(paths)) {
+    return []
+  }
+  const folders = await realPasteFolder()
+  return Promise.all(
+    paths
+      .slice(0, MAX_RESTORED_PASTES)
+      .flatMap((value) =>
+        typeof value === 'string' ? [restoreNativeChatPaste(folders, value)] : []
+      )
+  )
+}
+
+/** The paste folder as configured and as real path; null when missing or itself a link. */
+async function realPasteFolder(): Promise<{ named: string; real: string } | null> {
+  try {
+    const named = path.resolve(nativeChatPasteFolder())
+    const info = await lstat(named)
+    return info.isDirectory() && !info.isSymbolicLink()
+      ? { named, real: await realpath(named) }
+      : null
+  } catch {
+    return null
+  }
+}
+
+async function restoreNativeChatPaste(
+  folders: { named: string; real: string } | null,
+  restored: string
+): Promise<RestoredNativeChatPaste> {
+  const refused = { path: restored, kept: false, exists: false }
+  if (folders === null || restored === '' || !path.isAbsolute(restored)) {
+    return refused
+  }
+  // Why both: the text the draft stores and the file it really names must each be inside.
+  const named = path.resolve(restored)
+  if (
+    !isInsideNativeChatPasteFolder(folders.named, named) &&
+    !isInsideNativeChatPasteFolder(folders.real, named)
+  ) {
+    return refused
+  }
+  try {
+    const real = await realpath(restored)
+    if (!isInsideNativeChatPasteFolder(folders.real, real) || !(await stat(real)).isFile()) {
+      return refused
+    }
+    return { path: restored, kept: true, exists: true }
+  } catch {
+    // Missing or unreadable: not kept, and nothing about an outside path is reported.
+    return refused
+  }
+}
+
+/** Deletes pastes older than the TTL: only Orca's paste files, never a link, a folder, or anything
+ *  in a paste folder that is itself a link. Failures are logged and never block startup. */
+export async function sweepExpiredNativeChatPastes(now = Date.now()): Promise<void> {
+  const folders = await realPasteFolder()
+  if (!folders) {
+    return
+  }
+  const folder = folders.named
+  let entries
+  try {
+    entries = await readdir(folder, { withFileTypes: true })
+  } catch {
+    return
+  }
+  for (const entry of entries) {
+    if (!entry.isFile() || !PASTE_FILE_NAME.test(entry.name)) {
+      continue
+    }
+    const file = path.join(folder, entry.name)
+    try {
+      const info = await lstat(file)
+      if (info.isFile() && now - info.mti
```

#### Recent Merged Pull Requests:
- **PR #25769** (2026-10-06): fix(codex): keep working status when Escape closes search or permissions (@nwparker)
- **PR #25768** (2026-10-06): refactor(migration): keep a converted host's source rows instead of retiring them automatically (@OrcaWin)
- **PR #25767** (2026-10-06): chore(i18n): use 智能体 for Chinese Agent copy (@AmethystLiang)
- **PR #25760** (2026-10-06): Pause Pullfrog while the CI runner queue recovers (@nwparker)
- **PR #25757** (2026-10-06): feat(relay): give Asia cell c34 a promotion wave so it can become a general cell (@Jinwoo-H)
- **PR #25755** (2026-10-06): fix(relay): deploy driver builds the checked commit, prompts on their own line, summarises progress (@Jinwoo-H)
- **PR #25752** (2026-10-06): fix(runtime-env): a re-paired managed server's subscribers recover without a reload (@OrcaWin)
- **PR #25745** (closed): test: fix main's red win32 prompt-carry control after PowerShell one-line quoting (#23672 × #24257) (@brennanb2025)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
