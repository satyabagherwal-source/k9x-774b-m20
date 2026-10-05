# Forensic Learning Record (Deep Inspection): stablyai/orca

> **Canonical Artifact**: `07_PROJECT_LEARNING/stablyai-orca-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/stablyai/orca](https://github.com/stablyai/orca))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:02:49.966Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `stablyai/orca`
- **Description**: Orca is the ADE for working with a fleet of parallel agents. Run any coding agent with your own subscription. Available on desktop, mobile and remote runtime.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 82261 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cloud/apps/push/src/apns-authentication-token.ts`
```
import { createPrivateKey, type KeyObject, sign } from 'node:crypto'
import type { ApnsCredentials } from './config.js'

// Apple rejects a provider token older than an hour and throttles reissue
// under about 20 minutes, so 50 minutes is the safe rotation point.
export const APNS_TOKEN_ROTATION_MS = 50 * 60 * 1000

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

export class ApnsAuthenticationToken {
  private readonly privateKey: KeyObject
  private cached: { token: string; issuedAtMs: number } | null = null

  constructor(
    private readonly credentials: ApnsCredentials,
    private readonly now: () => number = Date.now,
    private readonly rotationMs: number = APNS_TOKEN_ROTATION_MS
  ) {
    this.privateKey = createPrivateKey(credentials.keyPem)
  }

  value(): string {
    const nowMs = this.now()
    if (this.cached && nowMs - this.cached.issuedAtMs < this.rotationMs) return this.cached.token
    const header = base64UrlJson({ alg: 'ES256', kid: this.credentials.keyId })
    const payload = base64UrlJson({
      iss: this.credentials.teamId,
      iat: Math.floor(nowMs / 1000)
    })
    const signingInput = `${header}.${payload}`
    // ES256 requires the raw r||s pair; Node emits DER unless asked otherwise.
    const signature = sign('sha256', Buffer.from(signingInput, 'utf8'), {
      key: this.privateKey,
      dsaEncoding: 'ieee-p1363'
    }).toString('base64url')
    const token = `${signingInput}.${signature}`
    this.cached = { token, issuedAtMs: nowMs }
    return token
  }
}

```

### Core Architecture Module: `cloud/apps/push/src/apns-client.ts`
```
import type { ApnsEnvironment } from '@orca-cloud/push-contract'
import { ApnsAuthenticationToken } from './apns-authentication-token.js'
import type { ApnsTransport } from './apns-http2-transport.js'
import type { ApnsCredentials } from './config.js'
import type { PushDelivery } from './push-delivery-message.js'
import type { PushProviderOutcome } from './push-provider-outcome.js'

const APNS_HOSTS: Record<ApnsEnvironment, string> = {
  production: 'api.push.apple.com',
  sandbox: 'api.sandbox.push.apple.com'
}

const DEAD_TOKEN_REASONS = new Set(['BadDeviceToken', 'Unregistered'])

export type ApnsClientOptions = {
  topic: string
  credentials: ApnsCredentials
  transport: ApnsTransport
  now?: () => number
}

function readReason(body: string): string {
  try {
    const parsed = JSON.parse(body) as { reason?: unknown }
    return typeof parsed.reason === 'string' ? parsed.reason : 'unknown'
  } catch {
    return 'unparseable'
  }
}

export function apnsBody(delivery: PushDelivery): string {
  return JSON.stringify({
    aps:
      delivery.orca.kind === 'dismiss'
        ? { 'content-available': 1 }
        : {
            alert: { title: delivery.title, body: delivery.body },
            ...(delivery.sound === false ? {} : { sound: 'default' }),
            'thread-id': delivery.hostFingerprint
          },
    orca: delivery.orca
  })
}

export class ApnsClient {
  private readonly authentication: ApnsAuthenticationToken
  private readonly now: () => number

  constructor(private readonly options: ApnsClientOptions) {
    this.now = options.now ?? Date.now
    this.authentication = new ApnsAuthenticationToken(options.credentials, this.now)
  }

  async send(
    delivery: PushDelivery,
    device: { token: string; apnsEnvironment: ApnsEnvironment }
  ): Promise<PushProviderOutcome> {
    const expiration = Math.floor(delivery.expiresAt / 1000)
    if (expiration * 1000 <= this.now()) return { status: 'error', reason: 'expired' }
    let response
    try {
      response = await this.options.transport({
        host: APNS_HOSTS[device.apnsEnvironment],
        path: `/3/device/${device.token}`,
        headers: {
          authorization: `bearer ${this.authentication.value()}`,
          'apns-topic': this.options.topic,
          'apns-push-type': delivery.orca.kind === 'dismiss' ? 'background' : 'alert',
          'apns-priority': delivery.orca.kind === 'dismiss' ? '5' : '10',
          'apns-expiration': String(expiration),
          ...(delivery.orca.kind === 'dismiss' ? {} : { 'apns-collapse-id': delivery.collapseId })
        },
        body: apnsBody(delivery)
      })
    } catch (error) {
      return {
        status: 'error',
        reason: error instanceof Error ? error.name : 'transport_failed',
        retryable: true
      }
    }
    if (response.status === 200) return { status: 'sent' }
    const reason = readReason(response.body)
    if (response.status === 410) return { status: 'dead', reason }
    if (response.status === 400 && DEAD_TOKEN_REASONS.has(reason)) {
      return { status: 'dead', reason }
    }
    return {
      status: 'error',
      reason,
      retryable: response.status === 429 || response.status >= 500,
      ...(response.retryAfterMs === undefined ? {} : { retryAfterMs: response.retryAfterMs })
    }
  }
}

```

### Core Architecture Module: `cloud/apps/push/src/apns-http2-transport.ts`
```
import { connect, constants, type ClientHttp2Session } from 'node:http2'
import { readApnsStreamResponse, type ApnsResponse } from './apns-stream-response.js'

export type ApnsRequest = {
  host: string
  path: string
  headers: Record<string, string>
  body: string
}

export type { ApnsResponse }
export type ApnsTransport = (request: ApnsRequest) => Promise<ApnsResponse>

// APNs requires HTTP/2 and rewards a long-lived session per host, so sessions
// are cached and only dropped when the socket itself goes away.
export function createApnsHttp2Transport(): ApnsTransport & { close(): void } {
  const sessions = new Map<string, ClientHttp2Session>()

  const sessionFor = (host: string): ClientHttp2Session => {
    const existing = sessions.get(host)
    if (existing && !existing.closed && !existing.destroyed) return existing
    const session = connect(`https://${host}`)
    const forget = (): void => {
      if (sessions.get(host) === session) sessions.delete(host)
    }
    session.on('error', forget)
    session.on('close', forget)
    sessions.set(host, session)
    return session
  }

  const transport = async (request: ApnsRequest): Promise<ApnsResponse> => {
    const stream = sessionFor(request.host).request({
      ...request.headers,
      [constants.HTTP2_HEADER_METHOD]: 'POST',
      [constants.HTTP2_HEADER_PATH]: request.path,
      [constants.HTTP2_HEADER_AUTHORITY]: request.host,
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(request.body))
    })
    return await readApnsStreamResponse(stream, request.body)
  }

  return Object.assign(transport, {
    close(): void {
      for (const session of sessions.values()) session.close()
      sessions.clear()
    }
  })
}

```

### Core Architecture Module: `cloud/apps/push/src/apns-stream-response.ts`
```
import type { EventEmitter } from 'node:events'
import { providerRetryAfter } from './provider-retry-delay.js'
import { constants } from 'node:http2'

export type ApnsResponse = { status: number; body: string; retryAfterMs?: number }

// The subset of ClientHttp2Stream this module drives, so a fake emitter can
// stand in for a real APNs stream in tests.
export type ApnsResponseStream = EventEmitter & {
  setTimeout(ms: number, callback: () => void): void
  destroy(error?: Error): void
  end(body: string): void
}

export const APNS_REQUEST_TIMEOUT_MS = 10_000

export function readApnsStreamResponse(
  stream: ApnsResponseStream,
  body: string,
  timeoutMs = APNS_REQUEST_TIMEOUT_MS
): Promise<ApnsResponse> {
  return new Promise<ApnsResponse>((resolve, reject) => {
    let settled = false
    const settle = (run: () => void): void => {
      if (settled) return
      settled = true
      run()
    }
    let status = 0
    let retryAfterMs: number | undefined
    const chunks: Buffer[] = []
    stream.setTimeout(timeoutMs, () => stream.destroy(new Error('apns_timeout')))
    stream.on('response', (headers: Record<string, unknown>) => {
      status = Number(headers[constants.HTTP2_HEADER_STATUS] ?? 0)
      retryAfterMs = providerRetryAfter(String(headers['retry-after'] ?? ''))
    })
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('error', (error: Error) => settle(() => reject(error)))
    stream.on('end', () =>
      settle(() =>
        resolve({
          status,
          body: Buffer.concat(chunks).toString('utf8'),
          ...(retryAfterMs === undefined ? {} : { retryAfterMs })
        })
      )
    )
    // A peer reset with NGHTTP2_NO_ERROR emits neither 'end' nor 'error', which
    // would leave the worker's delivery pending for the life of the process.
    stream.on('close', () => settle(() => reject(new Error('apns_stream_closed'))))
    stream.end(body)
  })
}

```

### Core Architecture Module: `cloud/apps/push/src/canonical-base64.ts`
```
// Rejects the many base64 spellings of the same bytes: a non-canonical
// encoding would change the transcript the host signs without changing the key.
export function decodeCanonicalBase64(value: string, expectedBytes: number): Buffer | null {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null
  const decoded = Buffer.from(value, 'base64')
  return decoded.byteLength === expectedBytes && decoded.toString('base64') === value
    ? decoded
    : null
}

```

### Core Architecture Module: `cloud/apps/push/src/client-ip-rate-limit.ts`
```
import { PUSH_LIMITS } from '@orca-cloud/push-contract'
import type { Context, MiddlewareHandler } from 'hono'

const REFILL_WINDOW_MS = 60_000
const MAX_TRACKED_IPS = 10_000
const UNKNOWN_CLIENT_IP = 'unknown'

export type ClientIpRateLimiterOptions = {
  capacity?: number
  windowMs?: number
  maxTrackedIps?: number
  now?: () => number
}

type Bucket = { tokens: number; updatedAt: number }

// Read x-forwarded-for from the right. Cloud Run appends the connecting peer,
// so the last value is the only one it wrote; everything to its left is
// whatever the caller sent and can be a fresh forgery on every request.
// trustedProxyHops is how many appenders sit between Cloud Run and the client
// (0 today, 1 once a load balancer fronts it). A header too short for that
// depth is not trusted at all and falls through to the shared bucket, which
// throttles rather than opens.
export function readClientIp(context: Context, trustedProxyHops = 0): string {
  const hops =
    context.req
      .header('x-forwarded-for')
      ?.split(',')
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0) ?? []
  const client = hops[hops.length - 1 - trustedProxyHops]
  return client ?? UNKNOWN_CLIENT_IP
}

// Per-instance admission avoids a database round trip; capacity scales with instance count.
export class ClientIpRateLimiter {
  private readonly buckets = new Map<string, Bucket>()
  private readonly capacity: number
  private readonly windowMs: number
  private readonly maxTrackedIps: number
  private readonly now: () => number

  constructor(options: ClientIpRateLimiterOptions = {}) {
    this.capacity = options.capacity ?? PUSH_LIMITS.unauthenticatedRequestsPerMinutePerIp
    this.windowMs = options.windowMs ?? REFILL_WINDOW_MS
    this.maxTrackedIps = options.maxTrackedIps ?? MAX_TRACKED_IPS
    this.now = options.now ?? Date.now
  }

  available(clientIp: string): boolean {
    return this.tokensAt(this.buckets.get(clientIp), this.now()) >= 1
  }

  allow(clientIp: string): boolean {
    const now = this.now()
    const tokens = this.tokensAt(this.buckets.get(clientIp), now)
    this.buckets.delete(clientIp)
    this.buckets.set(clientIp, { tokens: tokens < 1 ? tokens : tokens - 1, updatedAt: now })
    if (this.buckets.size > this.maxTrackedIps) {
      const oldest = this.buckets.keys().next().value
      if (oldest !== undefined) this.buckets.delete(oldest)
    }
    return tokens >= 1
  }

  trackedIpCount(): number {
    return this.buckets.size
  }

  private tokensAt(bucket: Bucket | undefined, now: number): number {
    if (!bucket) return this.capacity
    const refilled = ((now - bucket.updatedAt) * this.capacity) / this.windowMs
    return Math.min(this.capacity, bucket.tokens + Math.max(0, refilled))
  }
}

export type ClientIpRateLimitOptions = {
  trustedProxyHops?: number
  onLimited?: () => void
}

export function clientIpRateLimit(
  limiter: ClientIpRateLimiter,
  options: ClientIpRateLimitOptions = {}
): MiddlewareHandler {
  const trustedProxyHops = options.trustedProxyHops ?? 0
  return async (context, next) => {
    if (!limiter.allow(readClientIp(context, trustedProxyHops))) {
      options.onLimited?.()
      return context.json({ error: 'rate_limited' }, 429)
    }
    await next()
    return
  }
}

```

### Core Architecture Module: `cloud/apps/push/src/config.ts`
```
import { PUSH_DEFAULTS } from '@orca-cloud/push-contract'
import { z } from 'zod'

export const PUSH_DATABASE_POOL_MAX = 10

const OptionalTextSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional()
)

const EnvSchema = z.object({
  ORCA_PUSH_MODE: z.enum(['active', 'validation']).default('active'),
  PORT: z.coerce.number().int().positive().default(8080),
  ORCA_PUSH_PUBLIC_URL: z.string().url(),
  ORCA_PUSH_DATABASE_URL: OptionalTextSchema,
  ORCA_PUSH_DATA_DIR: z.string().min(1).default('./data/push'),
  ORCA_PUSH_DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).optional(),
  ORCA_PUSH_APNS_KEY: OptionalTextSchema,
  ORCA_PUSH_APNS_KEY_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .regex(/^[A-Z0-9]{10}$/)
      .optional()
  ),
  ORCA_PUSH_APPLE_TEAM_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .regex(/^[A-Z0-9]{10}$/)
      .optional()
  ),
  ORCA_PUSH_APNS_TOPIC: z.string().min(1).max(255).default(PUSH_DEFAULTS.apnsTopic),
  ORCA_PUSH_FCM_PROJECT_ID: z.string().regex(/^[a-z0-9-]{4,64}$/),
  // How many proxies append to x-forwarded-for after the client. 0 is Cloud Run
  // alone; raise it to 1 when a load balancer fronts the service.
  ORCA_PUSH_TRUSTED_PROXY_HOPS: z.coerce.number().int().nonnegative().max(8).default(0)
})

export type ApnsCredentials = { keyPem: string; keyId: string; teamId: string }

export type PushConfig = {
  mode: 'active' | 'validation'
  port: number
  publicUrl: string
  databaseUrl?: string
  dataDir: string
  databasePoolMax: number
  apns?: ApnsCredentials
  apnsTopic: string
  fcmProjectId: string
  trustedProxyHops: number
}

function canonicalOrigin(value: string, name: string): string {
  const url = new URL(value)
  if (url.origin !== value || url.pathname !== '/') throw new Error(`${name} must be an origin`)
  const loopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw new Error(`${name} must use HTTPS outside loopback development`)
  }
  return value
}

// The APNs key, key id, and team id are one credential; a partial set would
// pass startup and then fail every iOS send at runtime.
function readApnsCredentials(parsed: z.infer<typeof EnvSchema>): ApnsCredentials | undefined {
  const parts = [
    parsed.ORCA_PUSH_APNS_KEY,
    parsed.ORCA_PUSH_APNS_KEY_ID,
    parsed.ORCA_PUSH_APPLE_TEAM_ID
  ]
  const present = parts.filter((value) => value !== undefined).length
  if (present === 0) return undefined
  if (present !== parts.length) {
    throw new Error('APNs key, key id, and team id must be configured together')
  }
  const keyPem = parsed.ORCA_PUSH_APNS_KEY!
  if (!keyPem.includes('-----BEGIN')) throw new Error('ORCA_PUSH_APNS_KEY must be PEM text')
  return {
    keyPem,
    keyId: parsed.ORCA_PUSH_APNS_KEY_ID!,
    teamId: parsed.ORCA_PUSH_APPLE_TEAM_ID!
  }
}

export function loadPushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig {
  const parsed = EnvSchema.parse(
    Object.fromEntries(
      Object.entries(env).map(([key, value]) => [
        key,
        key !== 'ORCA_PUSH_MODE' && value?.trim() === '' ? undefined : value
      ])
    )
  )
  return {
    mode: parsed.ORCA_PUSH_MODE,
    port: parsed.PORT,
    publicUrl: canonicalOrigin(parsed.ORCA_PUSH_PUBLIC_URL, 'ORCA_PUSH_PUBLIC_URL'),
    databaseUrl: parsed.ORCA_PUSH_DATABASE_URL,
    dataDir: parsed.ORCA_PUSH_DATA_DIR,
    databasePoolMax: parsed.ORCA_PUSH_DATABASE_POOL_MAX ?? PUSH_DATABASE_POOL_MAX,
    apns: readApnsCredentials(parsed),
    apnsTopic: parsed.ORCA_PUSH_APNS_TOPIC,
    fcmProjectId: parsed.ORCA_PUSH_FCM_PROJECT_ID,
    trustedProxyHops: parsed.ORCA_PUSH_TRUSTED_PROXY_HOPS
  }
}

```

### Core Architecture Module: `cloud/apps/push/src/device-registry-store.ts`
```
import { randomUUID } from 'node:crypto'
import {
  PUSH_LIMITS,
  type ApnsEnvironment,
  type PushDeviceSummary,
  type PushPlatform
} from '@orca-cloud/push-contract'
import type { PushDatabase, SqlRow } from './push-database.js'

const DEVICE_CAP_LOCK_PREFIX = 'orca-push-device-cap:'

export type PushDeviceRegistration = {
  registrationId: string
  hostFingerprint: string
  deviceId: string
  platform: PushPlatform
  token: string
  apnsEnvironment?: ApnsEnvironment
  dead: boolean
}

export type PushDeviceUpsertResult =
  | { ok: true; registrationId: string }
  | { ok: false; reason: 'too_many_devices' }

export type PushDeviceUpsert = {
  hostFingerprint: string
  deviceId: string
  platform: PushPlatform
  token: string
  apnsEnvironment?: ApnsEnvironment
}

function toRegistration(row: SqlRow): PushDeviceRegistration {
  const apnsEnvironment = row.apns_environment
  return {
    registrationId: String(row.registration_id),
    hostFingerprint: String(row.host_fingerprint),
    deviceId: String(row.device_id),
    platform: String(row.platform) as PushPlatform,
    token: String(row.token),
    ...(apnsEnvironment === null || apnsEnvironment === undefined
      ? {}
      : { apnsEnvironment: String(apnsEnvironment) as ApnsEnvironment }),
    dead: row.dead_at !== null && row.dead_at !== undefined
  }
}

export class PushDeviceRegistryStore {
  constructor(
    private readonly database: PushDatabase,
    private readonly now: () => number = Date.now
  ) {}

  // The registration id is stable for a (host, device) pair so a re-registered
  // phone keeps the id the desktop already persisted; only the token rotates.
  async upsert(input: PushDeviceUpsert): Promise<PushDeviceUpsertResult> {
    const now = this.now()
    return await this.database.transaction<PushDeviceUpsertResult>(async (transaction) => {
      // deviceId is caller-chosen, so counting and inserting must not interleave
      // or a burst of new ids would walk straight past the cap.
      await transaction.lockQuotaScope(`${DEVICE_CAP_LOCK_PREFIX}${input.hostFingerprint}`)
      const [existing] = await transaction.query(
        'SELECT registration_id FROM push_devices WHERE host_fingerprint = ? AND device_id = ?',
        [input.hostFingerprint, input.deviceId]
      )
      if (existing) {
        const registrationId = String(existing.registration_id)
        await transaction.query(
          `UPDATE push_devices
           SET platform = ?, token = ?, apns_environment = ?,
               dead_at = NULL, updated_at = ?
           WHERE registration_id = ?`,
          [input.platform, input.token, input.apnsEnvironment ?? null, now, registrationId]
        )
        return { ok: true, registrationId }
      }
      const [countRow] = await transaction.query(
        'SELECT COUNT(*) AS devices FROM push_devices WHERE host_fingerprint = ?',
        [input.hostFingerprint]
      )
      if (Number(countRow?.devices ?? 0) >= PUSH_LIMITS.maxDevicesPerHost) {
        return { ok: false, reason: 'too_many_devices' }
      }
      const registrationId = randomUUID()
      await transaction.query(
        `INSERT INTO push_devices
         (registration_id, host_fingerprint, device_id, platform, token, apns_environment,
          dead_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          registrationId,
          input.hostFingerprint,
          input.deviceId,
          input.platform,
          input.token,
          input.apnsEnvironment ?? null,
          now,
          now
        ]
      )
      return { ok: true, registrationId }
    })
  }

  async deleteOwned(hostFingerprint: string, registrationId: string): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      await transaction.lockQuotaScope(`${DEVICE_CAP_LOCK_PREFIX}${hostFingerprint}`)
      const [result] = await transaction.query(
        'DELETE FROM push_devices WHERE registration_id = ? AND host_fingerprint = ?',
        [registrationId, hostFingerprint]
      )
      return Number(result?.changes ?? 0) > 0
    })
  }

  async list(hostFingerprint: string): Promise<PushDeviceSummary[]> {
    const rows = await this.database.query(
      // Bounded by the device-list response limit, so an
      // oversized table degrades to a truncated list instead of a 500.
      `SELECT registration_id, device_id, platform, dead_at
       FROM push_devices WHERE host_fingerprint = ? ORDER BY created_at ASC LIMIT ?`,
      [hostFingerprint, PUSH_LIMITS.maxDevicesPerHost]
    )
    return rows.map((row) => ({
      registrationId: String(row.registration_id),
      deviceId: String(row.device_id),
      platform: String(row.platform) as PushPlatform,
      dead: row.dead_at !== null && row.dead_at !== undefined
    }))
  }

  async findOwned(
    hostFingerprint: string,
    registrationIds: readonly string[]
  ): Promise<Map<string, PushDeviceRegistration>> {
    if (registrationIds.length === 0) return new Map()
    const placeholders = registrationIds.map(() => '?').join(', ')
    const rows = await this.database.query(
      `SELECT registration_id, host_fingerprint, device_id, platform, token, apns_environment,
              dead_at
       FROM push_devices
       WHERE host_fingerprint = ? AND registration_id IN (${placeholders})`,
      [hostFingerprint, ...registrationIds]
    )
    return new Map(
      rows.map((row) => {
        const registration = toRegistration(row)
        return [registration.registrationId, registration]
      })
    )
  }

  async findById(registrationId: string): Promise<PushDeviceRegistration | null> {
    const [row] = await this.database.query(
      `SELECT registration_id, host_fingerprint, device_id, platform, token, apns_environment,
              dead_at
       FROM push_devices WHERE registration_id = ?`,
      [registrationId]
    )
    return row ? toRegistration(row) : null
  }

  async markDead(observed: PushDeviceRegistration): Promise<void> {
    await this.database.query(
      `UPDATE push_devices SET dead_at = ?, updated_at = ? WHERE registration_id = ? AND token = ? AND platform = ? AND COALESCE(apns_environment, '') = ?`,
      [
        this.now(),
        this.now(),
        observed.registrationId,
        observed.token,
        observed.platform,
        observed.apnsEnvironment ?? ''
      ]
    )
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24102** (2026-09-30): **[Bug]: Update Error**
  *Symptoms*: ### Operating system  Windows  ### Orca version  Current version: 1.4.216  ### Details  When trying to update Orca via the popup, I get this error:  <img width="266" height="212" alt="Image" src="https://github.com/user-attachments/assets/a9f860fb-d6ed-4529-a67d-874c575e56ce" />
  **Post-Mortem & Fix Analysis**:
  > Nevermind, retry fixed it

- **Issue #23901** (2026-09-29): **[Bug]: Codex repeatedly disconnects and loops on “Reconnecting to app-server”**
  *Symptoms*: ## Summary  Codex frequently disconnects in the latest Orca + Codex version and repeatedly shows `Reconnecting to app-server` instead of remaining connected.  ## Steps to reproduce  1. Open the latest Orca version with Codex. 2. Start or continue a Codex session. 3. Wait for the connection to drop.  ## Expected behavior  The Codex session remains connected, or recovers automatically without getting stuck in a reconnect loop.  ## Actual behavior  The session disconnects frequently and repeatedly displays `Reconnecting to app-server`.  ## Environment  - Orca + Codex latest version (exact versions not provided) - macOS  ## Evidence  ![Screenshot.2026-09-29.at.9.27.33.AM.png](https://github.com/user-attachments/assets/8d3eb160-7874-467c-984a-4958f03bded3) 

- **Issue #23818** (2026-09-30): **[Bug]: Mobile touch-scroll in Codex types mouse-wheel escape sequences into the input instead of scrolling**
  *Symptoms*: ### Summary  On the mobile app, swiping up/down in a Codex terminal does not scroll. Instead, mouse-wheel escape sequences show up as literal text in the Codex input box.  ### What the screenshot shows  - Host is a Windows machine (paths like `C:\data\deploy`, `C:/Users/...`), viewed from the mobile app; the agent is Codex (medium model), mid-turn with "Queued follow-up inputs". - The Codex composer contains repeated fragments like `[M`D9[M`D:[M`D;[M`D<[M`E=[M`E=...`. That is the legacy X10 mouse-report format (`ESC [ M` + button byte `` ` `` = wheel-up + column/row bytes), so touch-scroll is being turned into mouse-wheel reports that Codex does not consume as scroll and echoes as text. - Nothing scrolled.  ### Expected  Vertical swipes scroll the scrollback, or are ignored; no escape sequences reach the agent's input.  ### Actual  No scroll, and wheel reports are typed into the agent's composer.  ### Not confirmed  - Whether a recent Codex CLI update triggered it (the reporter suspects so). - Phone OS, mobile app version, Orca desktop version, Codex version.  ### Related (same class, different encoding or trigger)  - #20983: scrolling writes malformed SGR wheel reports (`NaN` coordinates) into the PTY of a mouse-enabled TUI - #18957: iOS terminal scrolling opens the keyboard and feels coarse - #8563: mouse wheel sends arrow keys to a CLI without mouse reporting 
  **Post-Mortem & Fix Analysis**:
  > Additional info from the reporter: mobile app version 0.0.51 (1); the same session looks normal on the desktop, so this appears to be mobile-specific.

- **Issue #23809** (2026-09-29): **[Bug]: Closing one Codex 0.157 session makes all other running Codex sessions fail with the same error**
  *Symptoms*: ### Summary  With several Codex sessions open at once, closing one of them makes every other running Codex session show the same error at the same moment. A brand-new Codex session started afterwards works normally.  ### Steps  1. Open several Codex sessions in separate terminal panes (Codex CLI 0.157+, which runs a shared background app-server by default). 2. Close one of the panes. 3. Look at the other Codex panes.  ### Expected  Closing one session leaves the other sessions running.  ### Actual  All remaining Codex sessions fail together with the same error. Only a newly opened session recovers.  ### Suspected area (unverified)  Codex 0.157's shared app-server may be tied to the pane/PTY that first started it, so tearing that pane down could take the shared server away from the other sessions. Related, but different symptoms: #23643 and #22873 (status attributed to the first session's pane), #23590 (row cleanup when the TUI exits while the server keeps working).  ### Info to collect  OS, Orca version, Codex CLI version, the exact error text, and which pane was closed (the first-started one or a later one). 

- **Issue #23766** (2026-09-29): **[Bug]: Codex readiness check fails on fullscreen TUI (0.157+)**
  *Symptoms*: ### Operating system  macOS  ### Orca version  1.4.216  ### Details  **Title:** `worker-start --agent codex` always fails with `agent_readiness: timeout` on Codex CLI 0.157+ (fullscreen TUI): readiness matcher no longer recognizes the startup screen  **Environment** - Orca: <version>, macOS 14 (Darwin 23.3.0) - Codex CLI: 0.158.0 (Codex 0.155.1 worked with the same setup) - Command: `orca orchestration worker-start --task <id> --worktree current --agent codex [--model … --effort …] --timeout-ms 120000`  **What happens** - Orca opens a new agent terminal and Codex starts normally: the first frame is drawn about 3 s after launch and the TUI shows "OpenAI Codex" and "permissions: YOLO mode". - Orca never considers the terminal ready. After exactly `timeoutMs`, the worker fails with `agent_readiness: timeout`, and the task prompt is never injected. - Reproduced 5 times:   - with and without `--model`/`--effort`;   - with `codex --no-alt-screen` configured as the agent command in Orca settings;   - with `--terminal <existing Codex terminal>`. - Workaround: `orca orchestration dispatch --task <id> --to <terminal> --inject` into an already running Codex terminal. This bypasses readiness, but the worker is unsupervised.  **Root cause (from inspecting the installed app bundle)** - In `app.asar` → `out/main/index.js` (~line 7987, the Codex positive-evidence function, and the readiness combination around line 7991), the Codex "ready" check requires both `model:` and `directory:` to appe
  **Post-Mortem & Fix Analysis**:
  > Additional current reproduction from kazooooo-ma/settings #3387 (2026-09-29 JST):  - macOS Orca 1.4.215, Codex CLI 0.158.0, official `orchestration worker-start --agent codex --model gpt-5.6-terra --effort high`, existing managed worktree. - Dispatches `ctx_4ed2a0709534` (120 s) and `ctx_7e7c96d7f297` (300 s) both failed at `agent_readiness/timeout` before `dispatch_input`. The visible Codex TUI reached its compact composer. Both exact terminals were subsequently released through `worker-release`. - Installed app.asar (1.4.215) still checks for both `model:` and `directory:` after `openai codex`; the 0.158.0 compact screen showed neither label. The source in the local Orca checkout has the same condition. This is a source-and-screen causal inference; the actual OSC idle signal was not separately instrumented. - The same settings worktree succeeded with an official OpenCode terminal worker, so work continued without replaying either failed Codex spec.  Related #23475 reportedly landed a
  > Additional data point from macOS (Darwin 25.6), **Orca 1.4.215**, same repo/worktree, including a version A/B and one safety concern about the upcoming fix.  **1. Codex 0.158.0 (native `worker-start --agent codex --model gpt-6-sol --effort high`)** - 2/2 failed at `agent_readiness` / `timeout` (60 s, then `--timeout-ms 240000`). TUI idle at `› Ask Codex to do anything`, prompt never injected. Both residual terminals released via `worker-release`. - `terminal create --command "codex …"` + `terminal wait --for tui-idle --timeout-ms 60000–90000`: **satisfied 4/8, timeout 4/8** on fresh 0.158.0 terminals (plus a 20 s wait on a failed native worker terminal: timeout). So on this machine it is intermittent rather than never (the satisfied runs showed the same compact composer, no `model:`/`directory:` labels). - Supervised workaround that worked: pre-create the Codex terminal, wait until `tui-idle` is satisfied (recreate the terminal otherwise), then adopt it with `worker-start --task <id> -
  > Another confirmed reproduction, this time on **Linux** (Orca **1.4.211**, codex-cli **0.158.0**), including the "adopt an already-ready terminal" path, which some comments above report as a workaround.  **Why it matters to us:** we run a two-vendor review pair (one Claude Code, one Codex) as supervised Orca workers. Claude starts fine in the same pattern; the Codex half cannot become a supervised worker at all, so the pair only works through the unsupervised `dispatch --inject` fallback.  | Attempt | Result | |---|---| | `terminal create --command "codex -m gpt-5.6-sol -c model_reasoning_effort=high"`, then accept the trust dialog, then `worker-start --task <id> --worktree id:<repo>::<path> --terminal <handle>` | `failed`, `stage: agent_readiness`, `lastError: timeout`; the composer stayed untouched | | `worker-start --task <id> --retry-of <failed> --worktree id:<repo>::<path> --agent codex --model gpt-5.6-sol --effort high` | same `agent_readiness` / `timeout`; the new terminal also c

- **Issue #23711** (2026-09-29): **[Bug]: Working Codex row is missing with two Codex panes in the same worktree (shared daemon; v1.4.216)**
  *Symptoms*: ### Operating system  macOS  ### Orca version  1.4.216 (also observed on 1.4.215)  ### Details  ## Summary  A Codex session can be visibly working in its terminal while its sidebar agent row and yellow working indicator are absent. This report tracks the **same-worktree, two-Codex-pane case**, including the coverage gap in the proposed shared-daemon attribution fix.  The original visible failure was observed on Orca 1.4.215. After updating, the running app was confirmed as **1.4.216**; an installed-code replay and a live status-cache mismatch confirmed that the underlying cross-worktree attribution bug still exists. PR #23411 is currently unmerged.  ## Related issue and proposed fix  - Root-cause report: #22873 — shared Codex daemon hooks inherit the starter pane's environment. - Proposed fix: #23411 — this issue tracks its documented unresolved case where multiple Codex panes share the target worktree; it is **not a regression introduced by that PR**. - Detailed evidence already reported on the PR: https://github.com/stablyai/orca/pull/23411#issuecomment-5876883606 - Prior title fallback: #9646 / #9647. The affected resumed tab had no `launchAgent`, so that fallback could not supply the missing row. - Different from #23590: the affected TUI here remained open and working; it did not exit or choose "Run in background".  ## Observed configuration / reproduction shape  1. On one macOS host, a Codex 0.158.0 shared `app-server --managed-daemon` carries worktree A's Orca pane/work

- **Issue #23688** (2026-09-30): **Choosing Save in the unsaved-changes prompt deletes a new untitled note**
  *Symptoms*: ## What happens  1. Create a new untitled markdown note and type some text. 2. Close its tab without saving. 3. In the unsaved-changes prompt, choose **Save**.  **Actual:** the note's file is deleted from disk and the typed text is lost. **Expected:** the note is saved and kept.  The opposite choice is inverted too: **Don't Save** on the same kind of note leaves an empty `untitled.md` behind.  Reproduced in the main window of a folder workspace and in the floating panel on a dev build. The same code path is on current `main` (verified by reading it), but it has not yet been reproduced on a release build.  ## Why  - `handleSaveAndClose` in `src/renderer/src/components/editor/editor-autosave-controller.ts` saves the draft, which clears the draft and the dirty flag, and then calls `closeFile`. - `closeFile` runs the untitled-note cleanup. `shouldDeleteUntouchedUntitledFile` in `src/renderer/src/store/slices/editor/tabs/untitled-file-cleanup.ts` deletes any file that is untitled, not dirty, has no draft, and does not have `deleteUntouchedOnClose: false`. - A note that was just saved matches all of those. Nothing on the save path clears `isUntitled` or sets `deleteUntouchedOnClose: false`. Only renaming the note clears `isUntitled`, and only notes created from a template set the flag. - **Don't Save** keeps the draft, so the cleanup skips the note and the empty file survives.  ## Suggested direction  Fix it in the untitled-note lifecycle rather than in one close path: once a note 

- **Issue #23644** (2026-09-28): **[Bug]: Pi Agent stops working when the model is running on a private network.**
  *Symptoms*: ### Operating system  macOS  ### Orca version  latest version as of today  ### Details  I have configured orca with pi agent and model is running in private network. But it always says connection error. When I run pi agent from cmux or mac default terminal it works perfectly. I am running local model with llama.cpp into my local server.  <img width="1113" height="152" alt="Image" src="https://github.com/user-attachments/assets/5f8cc711-fb73-46d4-ae69-5aeda4a06a66" />
  **Post-Mortem & Fix Analysis**:
  > After reboot the issue fixed :) 

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

### Incident Patch 1: `95e8725b` (2026-09-30)
**Commit Message**: fix(claude): stop Orca making a WSL user's ~/.claude.json world-readable (#23973)

* fix(claude): keep a WSL guest's ~/.claude.json mode when Orca writes folder trust

* test(claude): assert a skipped trust write leaves no replacement file behind

The replacement file is now created before Claude's lock is taken, so the
locked path must remove it.

**File**: `src/main/claude/claude-folder-trust-file-wsl-guest.test.ts` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+import type * as NodeFs from 'node:fs'
+import {
+  chmodSync,
+  mkdirSync,
+  mkdtempSync,
+  readdirSync,
+  readFileSync,
+  realpathSync,
+  rmSync,
+  statSync,
+  writeFileSync
+} from 'node:fs'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import type { WslResult, WslSpec } from '../wsl/wsl-runner'
+import { grantClaudeFolderTrust } from './claude-folder-trust-file'
+
+const { DISTRO, GUEST_PREFIX, guest } = vi.hoisted(() => ({
+  DISTRO: 'Ubuntu-24.04',
+  GUEST_PREFIX: '//wsl.localhost/Ubuntu-24.04',
+  guest: { root: '' }
+}))
+
+function toGuestDisk(path: string): string {
+  return path.startsWith(GUEST_PREFIX) ? `${guest.root}${path.slice(GUEST_PREFIX.length)}` : path
+}
+
+// Why: models Windows Node over \\wsl.localhost: a synthetic 0o666 mode, chmod that cannot reach
+// the guest bits, and new files at the guest's default 0644 whatever mode was requested.
+vi.mock('node:fs', async (importOriginal) => {
+  const actual = await importOriginal<typeof NodeFs>()
+  const onGuest = (path: unknown): path is string =>
+    typeof path === 'string' && path.startsWith(GUEST_PREFIX)
+  const disk = (path: string): string => `${guest.root}${path.slice(GUEST_PREFIX.length)}`
+  const windowsView = (stats: NodeFs.Stats): NodeFs.Stats =>
+    Object.assign(stats, { mode: (stats.mode & ~0o777) | 0o666 })
+  return {
+    ...actual,
+    existsSync: (path: string) => actual.existsSync(onGuest(path) ? disk(path) : path),
+    lstatSync: (path: string) =>
+      onGuest(path) ? windowsView(actual.lstatSync(disk(path))) : actual.lstatSync(path),
+    statSync: (path: string) =>
+      onGuest(path) ? windowsView(actual.statSync(disk(path))) : actual.statSync(path),
+    realpathSync: (path: string) =>
+      onGuest(path)
+        ? `${GUEST_PREFIX}${actual.realpathSync(disk(path)).slice(guest.root.length)}`
+        : actual.realpathSync(path),
+    readFileSync: (path: string, options: BufferEncoding) =>
+      actual.readFileSync(onGuest(path) ? disk(path) : path, options),
+    writeFileSync: (path: string, data: string, options?: NodeFs.WriteFileOptions) => {
+      if (!onGuest(path)) {
+        return actual.writeFileSync(path, data, options)
+      }
+      const created = !actual.existsSync(disk(path))
+      const flag = typeof options === 'object' && options ? options.flag : undefined
+      actual.writeFileSync(disk(path), data, { flag })
+      if (created) {
+        actual.chmodSync(disk(path), 0o644)
+      }
+    },
+    chmodSync: (path: string, mode: number) =>
+      onGuest(path) ? undefined : actual.chmodSync(path, mode),
+    renameSync: (from: string, to: string) =>
+      actual.renameSync(onGuest(from) ? disk(from) : from, onGuest(to) ? disk(to) : to),
+    rmSync: (path: string, options?: NodeFs.RmOptions) =>
+      actual.rmSync(onGuest(path) ? disk(path) : path, options)
+  }
+})
+
+vi.mock('proper-lockfile', () => ({
+  lock: vi.fn(async () => async () => {})
+}))
+
+const runWslProcess = vi.hoisted(() => vi.fn<(spec: WslSpec) => Promise<WslResult>>())
+vi.mock('../wsl/wsl-runner', () => ({ runWslProcess }))
+
+/** Runs `chmod --reference=<from> -- <to>` as the guest would. */
+async function guestChmod(spec: WslSpec): Promise<WslResult> {
+  const [reference, separator, target] = spec.args ?? []
+  expect(spec).toMatchObject({ distro: DISTRO, loginPath: 'none', program: 'chmod' })
+  expect(separator).toBe('--')
+  const from = `${guest.root}${reference.replace(/^--reference=/, '')}`
+  chmodSync(`${guest.root}${target}`, statSync(from).mode & 0o7777)
+  return { environmentResolved: true, code: 0, stdout: '', stderr: '', timedOut: false }
+}
+
+const originalPlatform = process.platform
+
+describe.skipIf(originalPlatform === 'win32')('grantClaudeFolderTrust on a WSL guest file', () => {
+  const guestFile = `${GUEST_PREFIX}/home/u/.claude.json`
+
+  beforeEach(() => {
+    guest.root
```

**File**: `src/main/claude/claude-folder-trust-file.test.ts` (modified, +3/-0)
```diff
@@ -4,6 +4,7 @@ import {
   lstatSync,
   mkdirSync,
   mkdtempSync,
+  readdirSync,
   readFileSync,
   realpathSync,
   rmSync,
@@ -178,6 +179,8 @@ describe('grantClaudeFolderTrust', () => {
     )
     expect(readConfig(file)).toEqual({})
     expect(existsSync(lockDir)).toBe(true)
+    // Why: the replacement file is created before the lock, so a skipped write must remove it.
+    expect(readdirSync(root).sort()).toEqual(['.claude.json', '.claude.json.lock'])
   })
 
   it('updates a symlinked config through its target and keeps the link', async () => {
```

**File**: `src/main/claude/claude-folder-trust-file.ts` (modified, +81/-36)
```diff
@@ -15,6 +15,7 @@ import { lock } from 'proper-lockfile'
 import { renameFileWithWindowsRetry } from '../codex-accounts/fs-utils'
 import { runKeyedSerializedOperation } from '../cli/keyed-promise-queue'
 import { parseWslUncPath } from '../../shared/wsl-paths'
+import { runWslProcess } from '../wsl/wsl-runner'
 import type { ClaudeRuntimeAuthPreparation } from '../claude-accounts/runtime-auth/runtime-auth-types'
 
 export type ClaudeTrustPathStyle = 'posix' | 'win32'
@@ -144,20 +145,52 @@ function readConfigObject(target: string): Record<string, unknown> | null {
   }
 }
 
-function writeConfigAtomically(target: string, config: Record<string, unknown>): void {
-  const mode = statSync(target).mode & 0o777
-  const tmpPath = `${target}.orca-trust-${randomUUID()}.tmp`
+type ReplacementFile = { target: string; path: string }
+
+/**
+ * Creates an empty file beside `target` that already has `target`'s permission bits, so
+ * renaming it over `target` can never widen them.
+ */
+async function createReplacementFile(target: string): Promise<ReplacementFile> {
+  const suffix = `.orca-trust-${randomUUID()}.tmp`
+  const path = `${target}${suffix}`
+  const guestFile = parseWslUncPath(target)
   try {
-    writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf-8', mode })
-    if (process.platform !== 'win32') {
-      // Why: umask may narrow the requested mode; the replacement must match the original exactly.
-      chmodSync(tmpPath, mode)
+    if (guestFile) {
+      // Why: Windows sees a synthetic 0o666 for a guest file and cannot set its bits, and the
+      // guest gives a file made through \\wsl.localhost its default 0644; only the guest can copy them.
+      writeFileSync(path, '', { flag: 'wx' })
+      const copied = await runWslProcess({
+        distro: guestFile.distro,
+        loginPath: 'none',
+        program: 'chmod',
+        args: [`--reference=${guestFile.linuxPath}`, '--', `${guestFile.linuxPath}${suffix}`]
+      })
+      if (copied.code !== 0) {
+        throw new Error(`could not copy the guest mode of ${target}: ${copied.stderr.trim()}`)
+      }
+    } else {
+      const mode = statSync(target).mode & 0o777
+      writeFileSync(path, '', { flag: 'wx', mode })
+      if (process.platform !== 'win32') {
+        // Why: umask may narrow the requested mode; the replacement must match the original exactly.
+        chmodSync(path, mode)
+      }
     }
-    renameFileWithWindowsRetry(tmpPath, target)
   } catch (error) {
-    rmSync(tmpPath, { force: true })
+    rmSync(path, { force: true })
     throw error
   }
+  return { target, path }
+}
+
+function replaceConfig(replacement: ReplacementFile, config: Record<string, unknown>): void {
+  // Why r+: reopening without create/truncate keeps the mode the replacement was given.
+  writeFileSync(replacement.path, `${JSON.stringify(config, null, 2)}\n`, {
+    encoding: 'utf-8',
+    flag: 'r+'
+  })
+  renameFileWithWindowsRetry(replacement.path, replacement.target)
 }
 
 /**
@@ -188,37 +221,49 @@ async function grantClaudeFolderTrustNow(args: {
     return planned === 'refuse' ? 'unreadable' : 'unchanged'
   }
 
-  let release: () => Promise<void>
+  // Why before the lock: a WSL guest's mode takes a guest process to copy, and Claude's
+  // lock should stay held only for the synchronous read → rename below.
+  const replacement = await createReplacementFile(probe.path)
   try {
-    release = await lock(args.configFile, {
-      // Why: Claude locks the literal `<file>.lock`, not a realpath'd one.
-      lockfilePath: `${args.configFile}.lock`,
-      realpath: false,
-      stale: NEVER_STALE_MS,
-      retries: LOCK_RETRIES,
-      onCompromised: () => {}
-    })
-  } catch {
-    return 'locked'
-  }
-  try {
-    // Why: read → rename stays synchronous so Orca's own synchronous auth writer to
-    // this file cannot interleave and lose an update.
-    const current = readConfigAt(resolveConfigTarget(args.configFile))
-    if 
```

---

### Incident Patch 2: `cfe4c633` (2026-09-30)
**Commit Message**: fix(mobile): publish the Android APK's size and checksum with the release (#24037)

An APK that fails to install with a missing certificate or a package-parse error
is usually a download that died near the end: the signature block sits in the
last ~100 KB of a 133 MB file, so a truncated APK looks complete and carries no
signature at all. The release published neither a size nor a digest, so there
was no way to tell that apart from a bad build without deriving both from the
asset by hand.

The release now uploads app-release.apk.sha256 next to the APK in
`sha256sum -c` format (binary marker, so Git Bash cannot translate line endings
while hashing) and puts the exact byte size and digest in the release body,
naming `shasum -a 256 -c` for readers on macOS.

The upload path rewrites the body too: --clobber replaces the APK, so a digest
left over from the previous build would describe a file nobody can download,
and a reader comparing against it would reject a good APK. Both paths reserve
the section's own length out of the release-body cap before truncating, so the
section always survives and the body always fits; MAX_RELEASE_BODY_LENGTH is
exported from the desktop release script rat

**File**: `.github/workflows/mobile-android-release.yml` (modified, +83/-15)
```diff
@@ -85,11 +85,44 @@ jobs:
           echo "Mobile shell: $EXPO_PUBLIC_MOBILE_SHELL"
           cd android && ./gradlew assembleRelease
 
+      # Why: an install that fails with a missing certificate or a package-parse error is
+      # usually a download that died near the end, and the signature block sits in the last
+      # ~100 KB. Publishing the size and digest is what lets a reporter tell a truncated
+      # download apart from a bad build without anyone re-deriving them from the asset.
+      - name: Checksum the APK
+        id: apk
+        run: |
+          set -euo pipefail
+          shopt -s nullglob
+          apks=(android/app/build/outputs/apk/release/*.apk)
+          if [ "${#apks[@]}" -ne 1 ]; then
+            echo "Expected exactly one release APK, found ${#apks[@]}" >&2
+            exit 1
+          fi
+
+          apk="${apks[0]}"
+          bytes="$(wc -c < "$apk" | tr -d ' ')"
+          sha256="$(sha256sum "$apk" | cut -d ' ' -f 1)"
+          # A sibling file in `sha256sum -c` format, so verifying a download is one command
+          # and no retyped digest. The asset globs below match *.apk and skip it. The ` *`
+          # marker is binary mode: Git Bash's sha256sum reads text mode as a licence to
+          # translate line endings while hashing, which would fail on a valid APK.
+          printf '%s *%s\n' "$sha256" "$(basename "$apk")" > "$apk.sha256"
+
+          {
+            echo "checksum=$apk.sha256"
+            echo "bytes=$bytes"
+            echo "sha256=$sha256"
+          } >> "$GITHUB_OUTPUT"
+          echo "APK is $bytes bytes, sha256 $sha256"
+
       - name: Upload APK artifact
         uses: actions/upload-artifact@v7
         with:
           name: orca-mobile-apk
-          path: mobile/android/app/build/outputs/apk/release/*.apk
+          path: |
+            mobile/android/app/build/outputs/apk/release/*.apk
+            mobile/android/app/build/outputs/apk/release/*.apk.sha256
 
       - name: Ensure GitHub release tag
         if: steps.release.outputs.publish_release == 'true' && !startsWith(github.ref, 'refs/tags/mobile-android-v')
@@ -112,18 +145,62 @@ jobs:
         run: |
           set -euo pipefail
           tag="${{ steps.release.outputs.tag }}"
+          notes_file="$RUNNER_TEMP/android-release-notes.md"
+
+          # printf rather than a heredoc: YAML block indentation would leak into the Markdown.
+          # Both platforms' commands are named because a reader on macOS has no sha256sum.
+          verification_section() {
+            printf '\n### Verify your download\n\n- Size: `%s` bytes\n- SHA-256: `%s`\n\nA "no certificate" or "problem parsing the package" install failure is usually a truncated download — check the size first, then `sha256sum -c app-release.apk.sha256` (`shasum -a 256 -c` on macOS).\n' \
+              '${{ steps.apk.outputs.bytes }}' '${{ steps.apk.outputs.sha256 }}'
+          }
+
+          # The section is always last, so dropping from its heading to EOF leaves the
+          # generated notes intact. \r* because a body round-tripped through the API has CRLFs.
+          drop_verification_section() {
+            sed '/^### Verify your download\r*$/,$d'
+          }
+
+          # Why: reuse the desktop release path's character-safe truncation so a multi-byte
+          # character cannot be split at the cap. The section's own length is reserved out of
+          # that cap, because appending after truncating would push a near-limit body past
+          # GitHub's API limit and fail the call — on the upload path, after --clobber has
+          # already replaced the assets. `wc -c` counts bytes, so the section's multi-byte
+          # characters over-reserve, which errs toward a shorter body.
+          write_notes_with_verification() {
+            NOTES_FILE="$notes_file" \
+            NOTES_RESERVE="$(verification_section | wc -c | tr -d ' ')" \
+            NOTES_MODULE="$GITHUB_WORKSPACE/config/scripts/create-draft-rele
```

**File**: `config/scripts/create-draft-release.mjs` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { execFileSync } from 'node:child_process'
 import { pathToFileURL } from 'node:url'
 
 const API_VERSION = '2022-11-28'
-const MAX_RELEASE_BODY_LENGTH = 120_000
+export const MAX_RELEASE_BODY_LENGTH = 120_000
 const TRUNCATION_NOTICE =
   '\n\n---\nRelease notes were truncated because GitHub release bodies are limited to 125,000 characters.'
 const DESKTOP_RELEASE_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/
```

---

### Incident Patch 3: `2caa79e0` (2026-09-30)
**Commit Message**: fix(source-control): drop reasoning model think blocks from generated messages (#24005)

* fix(source-control): drop reasoning model think blocks from generated messages

Custom commit-message commands that run a reasoning model print the
reasoning before the answer, either as a <think>...</think> block or,
when the chat template prefills <think>, as text ending in a lone
</think>. The cleaner kept all of it, so the first reasoning line became
the commit subject.

Strip everything through the first </think> when the output starts with
<think> or has no <think> before the close tag. Output that quotes both
tags is left unchanged.

Fixes #24004

Signed-off-by: FenjuFu <fufenjupku@gmail.com>

* fix(source-control): scope lone </think> stripping to custom commands and add Kimi-VL tags

A lone closing tag is only stripped for custom commands, so a built-in
agent's message that mentions </think> is kept. PR fields parse the raw JSON
first and strip reasoning only when that fails, so a body quoting the tag
still parses. Adds Kimi-VL-Thinking's ◁think▷ tags.

---------

Signed-off-by: FenjuFu <fufenjupku@gmail.com>
Co-authored-by: Jinjing <6427696+AmethystLiang@users.noreply.github.com>

**File**: `src/main/text-generation/commit-message-text-generation-generated-output.test.ts` (modified, +80/-0)
```diff
@@ -54,6 +54,52 @@ describe('generateCommitMessageFromContext', () => {
     })
   })
 
+  it('drops prefilled reasoning from a custom command but not from a built-in agent', async () => {
+    const stdout =
+      "We need the message only.\r\nLet's final.</think>Fix typo in README.md\r\n\r\n- Correct spelling\r\n"
+    const generate = (params: { agentId: 'custom' | 'claude'; model: string }) =>
+      generateCommitMessageFromContext(
+        { branch: 'main', stagedSummary: 'M\tREADME.md', stagedPatch: '+hello' },
+        { ...params, customAgentCommand: 'llama-completion' },
+        {
+          kind: 'remote',
+          cwd: '/repo',
+          missingBinaryLocation: 'remote PATH',
+          execute: async () => ({ stdout, stderr: '', exitCode: 0, timedOut: false })
+        }
+      )
+
+    await expect(generate({ agentId: 'custom', model: '' })).resolves.toEqual({
+      success: true,
+      message: 'Fix typo in README.md\n\n- Correct spelling',
+      agentLabel: 'llama-completion'
+    })
+    await expect(generate({ agentId: 'claude', model: 'sonnet' })).resolves.toMatchObject({
+      success: true,
+      message: expect.stringContaining("Let's final.</think>Fix typo in README.md")
+    })
+  })
+
+  it('reports a custom command that printed only reasoning as an empty message', async () => {
+    const result = await generateCommitMessageFromContext(
+      { branch: 'main', stagedSummary: 'M\tREADME.md', stagedPatch: '+hello' },
+      { agentId: 'custom', model: '', customAgentCommand: 'agent' },
+      {
+        kind: 'remote',
+        cwd: '/repo',
+        missingBinaryLocation: 'remote PATH',
+        execute: async () => ({
+          stdout: 'Still reasoning.</think>\n',
+          stderr: '',
+          exitCode: 0,
+          timedOut: false
+        })
+      }
+    )
+
+    expect(result).toEqual({ success: false, error: 'agent returned an empty message.' })
+  })
+
   it('reports empty remote commit-message output as an empty message', async () => {
     let operation = ''
     const result = await generateCommitMessageFromContext(
@@ -90,6 +136,40 @@ describe('generateCommitMessageFromContext', () => {
     })
   })
 
+  it('keeps custom-command PR JSON that quotes a lone closing tag, and strips reasoning otherwise', async () => {
+    const generate = (stdout: string) =>
+      generatePullRequestFieldsFromContext(
+        {
+          branch: 'feature/pr-fields',
+          base: 'main',
+          branchChangedByPreparation: false,
+          currentTitle: '',
+          currentBody: '',
+          currentDraft: false,
+          commitSummary: '- feat: update README',
+          changeSummary: 'M\tREADME.md',
+          patch: '+hello'
+        },
+        { agentId: 'custom', model: '', customAgentCommand: 'agent' },
+        {
+          kind: 'remote',
+          cwd: '/repo',
+          missingBinaryLocation: 'remote PATH',
+          execute: async () => ({ stdout, stderr: '', exitCode: 0, timedOut: false })
+        }
+      )
+    const json = '{"title":"Strip </think> from output","body":"Drops reasoning.","draft":false}'
+
+    await expect(generate(json)).resolves.toMatchObject({
+      success: true,
+      fields: { title: 'Strip </think> from output', body: 'Drops reasoning.' }
+    })
+    await expect(generate(`Need JSON only.</think>\n${json}`)).resolves.toMatchObject({
+      success: true,
+      fields: { title: 'Strip </think> from output' }
+    })
+  })
+
   it('reports empty remote pull-request field output as empty details', async () => {
     let operation = ''
     const result = await generatePullRequestFieldsFromContext(
```

**File**: `src/main/text-generation/source-control-text-generation-requests.ts` (modified, +45/-4)
```diff
@@ -14,7 +14,12 @@ import {
   sanitizeBranchSlug,
   type BranchNameWorkContext
 } from '../../shared/branch-name-from-work'
-import type { CommandTemplateBackslash } from '../../shared/commit-message-prompt'
+import {
+  cleanGeneratedCommitMessage,
+  stripPrefilledReasoningPreamble,
+  type CommandTemplateBackslash
+} from '../../shared/commit-message-prompt'
+import { isCustomAgentId } from '../../shared/commit-message-agent-spec'
 import {
   planCommitMessageGeneration,
   type CommitMessagePlan
@@ -56,7 +61,7 @@ async function executeGenerationPlan(input: {
   operation: TextGenerationOperation
   spawnAgent: SpawnSourceControlAgent
 }): Promise<InternalTextGenerationResult> {
-  return input.target.kind === 'remote'
+  const result = await (input.target.kind === 'remote'
     ? runRemoteSourceControlPlan({
         plan: input.plan,
         target: input.target,
@@ -70,7 +75,25 @@ async function executeGenerationPlan(input: {
         emptyResultName: input.emptyResultName,
         operation: input.operation,
         spawnAgent: input.spawnAgent
-      })
+      }))
+  // Why: only a custom command runs a raw model whose chat template can swallow
+  // the opening think tag; a built-in agent's message may just mention the tag.
+  // PR fields are JSON, so they strip only when parsing fails instead.
+  if (
+    !result.success ||
+    !isCustomAgentId(input.params.agentId) ||
+    input.operation === 'pull-request-fields'
+  ) {
+    return result
+  }
+  const answer = stripPrefilledReasoningPreamble(result.rawOutput)
+  if (answer === result.rawOutput) {
+    return result
+  }
+  const rawOutput = cleanGeneratedCommitMessage(answer)
+  return rawOutput
+    ? { ...result, rawOutput }
+    : { success: false, error: `${input.plan.label} returned an empty ${input.emptyResultName}.` }
 }
 
 export async function generateCommitMessage(input: {
@@ -168,7 +191,7 @@ export async function generatePullRequestFields(input: {
   try {
     return {
       success: true,
-      fields: parseGeneratedPullRequestFields(result.rawOutput, context),
+      fields: parsePullRequestFieldsOutput(result.rawOutput, context, params.agentId),
       agentLabel: result.agentLabel,
       branchChangedByPreparation: context.branchChangedByPreparation
     }
@@ -181,6 +204,24 @@ export async function generatePullRequestFields(input: {
   }
 }
 
+// Why: a body may quote a lone closing tag inside valid JSON, so reasoning is
+// stripped only when the untouched output does not parse.
+function parsePullRequestFieldsOutput(
+  raw: string,
+  context: PullRequestDraftContext,
+  agentId: GenerateParams['agentId']
+): GeneratedPullRequestFields {
+  try {
+    return parseGeneratedPullRequestFields(raw, context)
+  } catch (error) {
+    const answer = isCustomAgentId(agentId) ? stripPrefilledReasoningPreamble(raw) : raw
+    if (answer === raw) {
+      throw error
+    }
+    return parseGeneratedPullRequestFields(cleanGeneratedCommitMessage(answer), context)
+  }
+}
+
 export async function generateBranchName(input: {
   context: BranchNameWorkContext
   params: GenerateParams
```

**File**: `src/shared/commit-message-agent-output.ts` (modified, +36/-2)
```diff
@@ -1,6 +1,6 @@
 /** Strips noise around the agent's output: surrounding whitespace, a single
- *  enclosing fenced code block, and lone "Generating…" preamble lines some
- *  CLIs print before the real answer. */
+ *  enclosing fenced code block, lone "Generating…" preamble lines some CLIs
+ *  print before the real answer, and a reasoning block the output opens with. */
 export function cleanGeneratedCommitMessage(raw: string): string {
   // Why: agent output can include very large generated bodies; normalize and
   // unwrap by scanning boundaries instead of building newline-sized arrays.
@@ -17,6 +17,8 @@ export function cleanGeneratedCommitMessage(raw: string): string {
     }
   }
 
+  text = stripLeadingReasoningBlock(text)
+
   const fenced = findEnclosingCommitMessageFenceBody(text)
   if (fenced !== null) {
     text = fenced.trim()
@@ -29,6 +31,38 @@ export function cleanGeneratedCommitMessage(raw: string): string {
   return text
 }
 
+// Why: reasoning models print their chain of thought before the answer.
+// DeepSeek-R1, Qwen3 and Kimi K2 use <think>; Kimi-VL-Thinking uses ◁think▷.
+const REASONING_TAGS = [
+  { open: '<think>', close: '</think>' },
+  { open: '◁think▷', close: '◁/think▷' }
+] as const
+
+function stripLeadingReasoningBlock(text: string): string {
+  for (const { open, close } of REASONING_TAGS) {
+    if (!text.startsWith(open)) {
+      continue
+    }
+    const closeIndex = text.indexOf(close, open.length)
+    return closeIndex === -1 ? text : text.slice(closeIndex + close.length).trim()
+  }
+  return text
+}
+
+/** Drops reasoning that ends in a closing tag with no opening tag before it.
+ *  Chat templates that prefill the opening tag in the prompt (Qwen3-Thinking,
+ *  DeepSeek-R1-0528, Kimi K2.5) keep it out of stdout. Only custom commands
+ *  should use this: any other message may legitimately mention the closing tag. */
+export function stripPrefilledReasoningPreamble(text: string): string {
+  for (const { open, close } of REASONING_TAGS) {
+    const closeIndex = text.indexOf(close)
+    if (closeIndex !== -1 && text.lastIndexOf(open, closeIndex) === -1) {
+      return text.slice(closeIndex + close.length).trim()
+    }
+  }
+  return text
+}
+
 function normalizeGeneratedCommitMessageLineFeeds(value: string): string {
   let crlfStart = value.indexOf('\r\n')
   if (crlfStart === -1) {
```

**File**: `src/shared/commit-message-prompt.test.ts` (modified, +39/-0)
```diff
@@ -5,6 +5,7 @@ import {
   excerptAgentFailureOutput,
   planCustomCommand,
   STAGED_DIFF_BYTE_BUDGET,
+  stripPrefilledReasoningPreamble,
   tokenizeCustomCommandTemplate,
   truncateDiffForPrompt
 } from './commit-message-prompt'
@@ -134,6 +135,44 @@ describe('cleanGeneratedCommitMessage', () => {
   it('returns empty string when input is whitespace', () => {
     expect(cleanGeneratedCommitMessage('   \n\t')).toBe('')
   })
+
+  it('drops a leading <think> reasoning block and unwraps the answer', () => {
+    expect(
+      cleanGeneratedCommitMessage('<think>\nThe diff fixes a typo.\n</think>\n\nFix typo\n\n- Why')
+    ).toBe('Fix typo\n\n- Why')
+    expect(cleanGeneratedCommitMessage('<think>short</think>\n```\nfeat: add parser\n```')).toBe(
+      'feat: add parser'
+    )
+  })
+
+  it('drops a leading Kimi-VL ◁think▷ reasoning block', () => {
+    expect(cleanGeneratedCommitMessage('◁think▷Typo in README.◁/think▷Fix typo in README')).toBe(
+      'Fix typo in README'
+    )
+  })
+
+  it('keeps think tags that are not a leading reasoning block', () => {
+    const quoted = 'Strip <think>…</think> blocks from generated messages'
+    expect(cleanGeneratedCommitMessage(quoted)).toBe(quoted)
+    expect(cleanGeneratedCommitMessage('fix: handle stray </think> in stream')).toBe(
+      'fix: handle stray </think> in stream'
+    )
+    expect(cleanGeneratedCommitMessage('<think>still reasoning')).toBe('<think>still reasoning')
+  })
+})
+
+describe('stripPrefilledReasoningPreamble', () => {
+  it('drops reasoning that ends in a closing tag whose opening tag was prefilled', () => {
+    expect(
+      stripPrefilledReasoningPreamble("We need the message only.\nLet's final.</think>Fix typo")
+    ).toBe('Fix typo')
+    expect(stripPrefilledReasoningPreamble('Reasoning.◁/think▷\nFix typo')).toBe('Fix typo')
+  })
+
+  it('keeps a closing tag that follows its own opening tag', () => {
+    const quoted = 'Strip <think>…</think> blocks'
+    expect(stripPrefilledReasoningPreamble(quoted)).toBe(quoted)
+  })
 })
 
 describe('excerptAgentFailureOutput', () => {
```

**File**: `src/shared/commit-message-prompt.ts` (modified, +2/-1)
```diff
@@ -21,7 +21,8 @@ Staged diff:
 export {
   cleanGeneratedCommitMessage,
   excerptAgentFailureOutput,
-  sanitizeAgentFailureDetail
+  sanitizeAgentFailureDetail,
+  stripPrefilledReasoningPreamble
 } from './commit-message-agent-output'
 
 /** Builds the final prompt sent to the agent. The custom suffix is appended verbatim
```

---

### Incident Patch 4: `373d951b` (2026-09-30)
**Commit Message**: fix(editor): highlight shell startup dotfiles (#24066)

* fix(editor): highlight shell startup dotfiles

Opening ~/.zshrc, ~/.bashrc or ~/.profile rendered as plaintext because
extname() treats a leading-dot name as having no extension, and Monaco's
shell association only lists .sh/.bash.

Map the common bash/zsh/POSIX startup filenames to the shell language in
FILENAME_TO_LANGUAGE so both the editor and diffs highlight them.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* test(editor): cover every mapped shell dotfile

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* fix(editor): match exact filenames case-insensitively

Shell dotfiles (.ZSHRC, .BASHRC) on case-insensitive filesystems
still fell to plaintext. Exact match wins; lowercase fallback covers
the rest without touching extension/Monaco order.

---------

Co-authored-by: djlee <djlee@woowahan.com>
Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Co-authored-by: Jinjing <6427696+AmethystLiang@users.noreply.github.com>

**File**: `src/renderer/src/lib/language-detect.test.ts` (modified, +31/-0)
```diff
@@ -177,4 +177,35 @@ describe('detectLanguage', () => {
   ])('detects dotenv names without overriding specific mappings: %s', (filePath, expected) => {
     expect(detectLanguage(filePath)).toBe(expected)
   })
+
+  it.each([
+    ['/Users/me/.zshrc', 'shell'],
+    ['/home/me/.bashrc', 'shell'],
+    ['C:\\Users\\me\\.bash_profile', 'shell'],
+    ['/home/me/.bash_login', 'shell'],
+    ['/home/me/.bash_logout', 'shell'],
+    ['/home/me/.profile', 'shell'],
+    ['/home/me/.zshenv', 'shell'],
+    ['/home/me/.zprofile', 'shell'],
+    ['/home/me/.zlogin', 'shell'],
+    ['/home/me/.zlogout', 'shell']
+  ])('maps shell startup dotfiles to shell: %s', (filePath, expected) => {
+    expect(detectLanguage(filePath)).toBe(expected)
+  })
+
+  it.each([
+    ['/Users/me/.ZSHRC', 'shell'],
+    ['C:\\Users\\me\\.BASHRC', 'shell'],
+    ['/home/me/.Bash_Profile', 'shell'],
+    ['/home/me/.PROFILE', 'shell'],
+    ['/home/me/.ZPROFILE', 'shell'],
+    ['C:\\repo\\DOCKERFILE', 'dockerfile'],
+    ['C:\\repo\\dockerfile', 'dockerfile'],
+    ['C:\\repo\\MAKEFILE', 'makefile'],
+    ['C:\\repo\\makefile', 'makefile'],
+    ['C:\\repo\\CMAKELISTS.TXT', 'cmake'],
+    ['C:\\repo\\.GITIGNORE', 'ini']
+  ])('maps exact filenames case-insensitively: %s', (filePath, expected) => {
+    expect(detectLanguage(filePath)).toBe(expected)
+  })
 })
```

**File**: `src/renderer/src/lib/language-detect.ts` (modified, +20/-1)
```diff
@@ -126,16 +126,35 @@ const FILENAME_TO_LANGUAGE: Record<string, string> = {
   '.env': 'ini',
   '.env.local': 'ini',
   '.env.development': 'ini',
-  '.env.production': 'ini'
+  '.env.production': 'ini',
+  '.bashrc': 'shell',
+  '.bash_profile': 'shell',
+  '.bash_login': 'shell',
+  '.bash_logout': 'shell',
+  '.profile': 'shell',
+  '.zshrc': 'shell',
+  '.zshenv': 'shell',
+  '.zprofile': 'shell',
+  '.zlogin': 'shell',
+  '.zlogout': 'shell'
 }
 
+// Exact match wins; lowercase map covers case-insensitive filesystems.
+const FILENAME_LOWER_TO_LANGUAGE: Record<string, string> = Object.fromEntries(
+  Object.entries(FILENAME_TO_LANGUAGE).map(([name, language]) => [name.toLowerCase(), language])
+)
+
 export function detectLanguage(filePath: string): string {
   // Check exact filename first
   const parts = filePath.split(/[\\/]/)
   const filename = parts.at(-1)!
   if (Object.hasOwn(FILENAME_TO_LANGUAGE, filename)) {
     return FILENAME_TO_LANGUAGE[filename]
   }
+  const lowerFilename = filename.toLowerCase()
+  if (Object.hasOwn(FILENAME_LOWER_TO_LANGUAGE, lowerFilename)) {
+    return FILENAME_LOWER_TO_LANGUAGE[lowerFilename]
+  }
 
   // Check extension
   const ext = extname(filename).toLowerCase()
```

---

### Incident Patch 5: `ba39c6d5` (2026-09-30)
**Commit Message**: fix(native-chat): a failed startup chat-lease save no longer puts the app into "Session restore failed" (#23964)

* fix(native-chat): report a failed startup chat reconcile instead of failing app startup

At startup the chat host re-checks every saved chat's lease and writes the
result to agent-sessions.json. If that write failed (the file lock gave up,
the file could not be written, or the file was written by a newer Orca and
is read-only here), reconcileRestartLeases rejected, the startup IPC call
rejected, and the renderer fell into its degraded "Session restore failed.
Changes won't be saved until restart" mode.

The reconcile is bookkeeping: a lease left unreconciled grants no writer,
and every attach, send and read of a chat reconciles its own lease again.
So the startup reconcile now reports its failure through a new optional
host dependency, onStartupReconcileFailure, and resolves. The runtime
routes it to its onError sink under the scope
structured-agent-session-startup-reconcile, or logs it when no sink is
installed (the desktop installs none).

* fix(native-chat): read restored chats without waiting on lease bookkeeping

With native chat on and a chat tab open at quit, t

**File**: `src/main/native-chat/agent-session-wire/structured-agent-session-host-types.ts` (modified, +4/-0)
```diff
@@ -120,6 +120,10 @@ export type StructuredAgentSessionHostDeps = {
   /** Whether an orchestration dispatch still owns this session's worker; absent answers no. */
   hasOpenDispatch?: (record: AgentSessionRecord) => boolean
   onEventSinkError?: (input: { sessionId: string; error: unknown }) => void
+  /** Lease bookkeeping run for startup or a read (the reconcile, or resolving a chat's recovery)
+   *  that refused or threw, once per distinct failure. Startup and the read carry on: the next
+   *  attach or send reconciles and resolves recovery again before it acts. */
+  onLeaseReconcileFailure?: (failure: unknown) => void
   /** Every status projection this host publishes. `replay` marks a re-projection of state the host
    *  already knew (restore, an arriving subscriber) rather than a fresh journal edge. */
   onSessionStatusChanged?: (
```

**File**: `src/main/native-chat/agent-session-wire/structured-agent-session-host.ts` (modified, +3/-7)
```diff
@@ -135,7 +135,7 @@ export class StructuredAgentSessionHost {
       flushStreamedEvents: (sessionId) => this.flushStreamedEvents(sessionId)
     })
     this.restore = createStructuredAgentSessionHostRestore(deps, {
-      reconcile: this.reconcileLeases,
+      reconcileLeases: this.reconcileLeases,
       resolveRecovery: (sessionId) => this.runtimeState.resolveRecovery(sessionId),
       serialize: (sessionId, task) => this.serialize(sessionId, task),
       hasSession: this.hasSession,
@@ -215,6 +215,7 @@ export class StructuredAgentSessionHost {
   listSessionTabs = () => sessionTabs.listStructuredAgentSessionTabs(this.sessions)
   getPersistedVisibleSessionTabIndex = () => this.deps.store.getVisibleSessionTabIndex()
   getSessionTabId = (sessionId: string): string | null => this.deps.store.getSessionTabId(sessionId)
+  showSessionTabs = (sessionIds: readonly string[]) => this.deps.store.showSessionTabs(sessionIds)
 
   setSessionTabVisibility = async (
     sessionId: string,
@@ -228,12 +229,7 @@ export class StructuredAgentSessionHost {
     }
   }
 
-  reconcileRestartLeases = async (): Promise<void> => {
-    const refusal = await this.reconcileLeases('startup')
-    if (refusal) {
-      throw new Error(refusal.code)
-    }
-  }
+  reconcileRestartLeases = (): Promise<void> => this.restore.reconcileRestartLeases()
 
   restoreReadableSessions = (sessionIds?: readonly string[]): Promise<void> =>
     this.restore.restoreReadableSessions(sessionIds)
```

**File**: `src/main/native-chat/agent-session-wire/structured-agent-session-readable-restorer.test.ts` (modified, +2/-2)
```diff
@@ -39,8 +39,8 @@ describe('StructuredAgentSessionReadableRestorer', () => {
         adapter: {}
       },
       supportsRecord: () => true,
-      reconcile: async () => null,
-      resolveRecovery: async () => undefined,
+      reconcile: async () => true,
+      resolveRecovery: async () => true,
       serialize: async (_sessionId, task) => task(),
       hasSession: () => false,
       onReadable: () => undefined
```

**File**: `src/main/native-chat/agent-session-wire/structured-agent-session-restart-reconcile.ts` (modified, +70/-0)
```diff
@@ -45,6 +45,76 @@ export function createRestartReconciler(deps: {
   }
 }
 
+/** Reports each distinct failure once, until `clear` says the bookkeeping settled again: the
+ *  startup check, the restore pass and a restore retried after a failed journal open would each
+ *  log the same store failure. */
+export type ReaderBookkeepingFailures = {
+  report: (failure: unknown) => void
+  clear: () => void
+}
+
+export function reportEachFailureOnce(
+  onFailure: ((failure: unknown) => void) | undefined
+): ReaderBookkeepingFailures {
+  let reported: string | null = null
+  return {
+    report: (failure) => {
+      const key = failureKey(failure)
+      if (key !== reported) {
+        reported = key
+        try {
+          onFailure?.(failure)
+        } catch (sinkError) {
+          // A throwing sink must not turn the reported failure back into a failed read.
+          console.warn('[structured-agent-session] reporting a lease bookkeeping failure failed', {
+            failure,
+            sinkError
+          })
+        }
+      }
+    },
+    clear: () => {
+      reported = null
+    }
+  }
+}
+
+/** The reconcile a reader runs, at startup and before each restored read: it never throws, since
+ *  an unreconciled lease grants no writer and the next send reconciles again before it acts.
+ *  Answers whether every lease is settled. */
+export function createReaderReconcile(
+  reconcile: (sessionId: string) => Promise<AgentSessionWireRefusal | null>,
+  failures: ReaderBookkeepingFailures
+): (sessionId: string) => Promise<boolean> {
+  return async (sessionId) => {
+    let failure: unknown
+    try {
+      const refusal = await reconcile(sessionId)
+      if (!refusal) {
+        failures.clear()
+        return true
+      }
+      failure = refusal
+    } catch (error) {
+      failure = error
+    }
+    failures.report(failure)
+    return false
+  }
+}
+
+function failureKey(failure: unknown): string {
+  if (typeof failure === 'object' && failure !== null) {
+    if ('code' in failure && failure.code) {
+      return String(failure.code)
+    }
+    if ('message' in failure) {
+      return String(failure.message)
+    }
+  }
+  return String(failure)
+}
+
 async function reconcileCurrentLeases(deps: {
   store: AgentSessionRecordStore
   probe: (record: AgentSessionRecord) => Promise<AgentSessionOwnerProbe>
```

**File**: `src/main/native-chat/agent-session-wire/structured-agent-session-restart-restore.test.ts` (modified, +60/-7)
```diff
@@ -62,8 +62,8 @@ describe('restart journal restoration', () => {
     const restoration = restoreStructuredAgentSessionsOnRestart({
       openDeps: NO_OPEN_DEPS,
       records,
-      reconcile: async () => null,
-      resolveRecovery: async () => undefined,
+      reconcile: async () => true,
+      resolveRecovery: async () => true,
       serialize: async (_sessionId, task) => task(),
       hasSession: () => false,
       onReadable: () => undefined
@@ -103,8 +103,8 @@ describe('restart journal restoration', () => {
     await restoreStructuredAgentSessionsOnRestart({
       openDeps: NO_OPEN_DEPS,
       records,
-      reconcile: async () => null,
-      resolveRecovery: async () => undefined,
+      reconcile: async () => true,
+      resolveRecovery: async () => true,
       serialize: async (_sessionId, task) => task(),
       hasSession: () => false,
       onReadable: () => undefined
@@ -150,9 +150,10 @@ describe('restart journal restoration', () => {
       // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the restore reads only the record's session id here.
       records: [{ sessionId: 'session-1' } as AgentSessionRecord],
       openDeps: NO_OPEN_DEPS,
-      reconcile: async () => null,
+      reconcile: async () => true,
       resolveRecovery: async () => {
         calls.push('resolveRecovery')
+        return true
       },
       serialize: async (_sessionId, task) => task(),
       hasSession: () => false,
@@ -164,6 +165,58 @@ describe('restart journal restoration', () => {
     expect(calls).toEqual(['resolveRecovery', 'open', 'onReadable:restored'])
   })
 
+  // Each failed bookkeeping call stands for one wait on a held store lock.
+  describe('once lease bookkeeping fails in a pass', () => {
+    const records = Array.from(
+      { length: 8 },
+      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the restore reads only the record's session id here.
+      (_, index) => ({ sessionId: `session-${index}` }) as AgentSessionRecord
+    )
+    const restore = (
+      bookkeeping: Pick<
+        Parameters<typeof restoreStructuredAgentSessionsOnRestart>[0],
+        'reconcile' | 'resolveRecovery'
+      >
+    ) =>
+      restoreStructuredAgentSessionsOnRestart({
+        openDeps: NO_OPEN_DEPS,
+        records,
+        ...bookkeeping,
+        serialize: async (_sessionId, task) => task(),
+        hasSession: () => false,
+        onReadable: () => undefined
+      })
+
+    /** A failure that takes a while, as a lock wait does, so the chats open at once overlap it. */
+    const slowFailure = async (): Promise<boolean> => {
+      await new Promise((resolve) => setTimeout(resolve, 5))
+      return false
+    }
+
+    beforeEach(() => restoreRead.mockResolvedValue(null))
+
+    it('skips it for every chat when the pass check fails, and still opens them all', async () => {
+      const reconcile = vi.fn(slowFailure)
+      const resolveRecovery = vi.fn(async () => true)
+
+      await restore({ reconcile, resolveRecovery })
+
+      expect(reconcile).toHaveBeenCalledOnce()
+      expect(resolveRecovery).not.toHaveBeenCalled()
+      expect(restoreRead).toHaveBeenCalledTimes(records.length)
+    })
+
+    it('starts no more after the first failed recovery, and still opens every chat', async () => {
+      const resolveRecovery = vi.fn(slowFailure)
+
+      await restore({ reconcile: async () => true, resolveRecovery })
+
+      // Only those already started when the first failed: at most one per chat open at once.
+      expect(resolveRecovery.mock.calls.length).toBeLessThanOrEqual(4)
+      expect(restoreRead).toHaveBeenCalledTimes(records.length)
+    })
+  })
+
   it('does not settle again when a second restore finds the session already open', async () => {
     restoreRead.mockResolvedValue({
       session: { journal: {}, params: {}, child: null },
@@ -174,8 +227,8 @@ describe('restart journal restoration', () => {
       // oxlint-disa
```

---

### Incident Patch 6: `30473530` (2026-09-30)
**Commit Message**: fix(orchestration): worker-abandon settles a stuck worker and records who did it (#23983)

* fix(orchestration): worker-abandon settles a stuck worker and records who abandoned it

worker-abandon refused or no-oped in the states it exists to escape: a stop
stranded by a dead runtime, an active attempt that was no longer the Task's
latest, and settled workers whose terminal release was stuck at requested or
unknown. It now settles every non-terminal worker except this runtime's own
in-flight stop, records who abandoned it, and retains (never closes) an owned
terminal whose release is not already in flight.

Part of STA-8833.

* refactor(orchestration): abandon retains through worker-retain's rule; record cancellations

- One retain helper serves worker-retain and worker-abandon. A committed release (releasing, unknown) keeps its state and archive, since the tab may already be closed; a retained terminal drops its stale archive.
- worker-abandon keeps the published stale field (this attempt was not the Task's current one) on the worker path.
- task-list shows a failed Task's reason, whitespace-collapsed; task-update help and the recovery guide document cancel = failed + --result canc

**File**: `skill-guides/orchestration/references/recovery-and-cleanup.md` (modified, +12/-1)
```diff
@@ -131,7 +131,18 @@ ORCA orchestration worker-abandon --dispatch <dispatch_id> --json
 `worker-stop` closes only the exact proven supervised agent terminal. It never
 deletes the worktree, setup terminal, configured tabs, or unrelated processes.
 `worker-abandon` fences orchestration while accepting that resources may remain
-live; it performs no remote, process, or filesystem action.
+live; it performs no remote, process, or filesystem action. When it settles a
+worker, it retains an owned terminal by the same rule as `worker-retain`, so Orca
+stops owing its release; a release already committed (`releasing`,
+`release_unknown`) is left as it is. An already-settled worker is left untouched.
+
+To cancel a Task, settle its worker with `worker-stop` or `worker-abandon`, then
+record the reason. A cancelled Task is `failed`, so its dependents stay blocked
+until a `--retry-of` replacement completes it:
+
+```text
+ORCA orchestration task-update --id <task_id> --status failed --result cancelled --json
+```
 
 ## Retain and release
 
```

**File**: `src/cli/specs/orchestration.ts` (modified, +5/-2)
```diff
@@ -167,10 +167,13 @@ export const ORCHESTRATION_COMMAND_SPECS: CommandSpec[] = [
     path: ['orchestration', 'task-update'],
     summary: 'Update a task status',
     usage:
-      'orca orchestration task-update --id <task_id> --status <status> [--result <json>] [--run <run_id>] [--from <handle>] [--retry-request <id>] [--json]',
+      'orca orchestration task-update --id <task_id> --status <status> [--result <text>] [--run <run_id>] [--from <handle>] [--retry-request <id>] [--json]',
     allowedFlags: [...GLOBAL_FLAGS, 'id', 'status', 'result', 'run', 'from', 'retry-request'],
     identityFlagRoles: { from: 'caller' },
-    notes: ['Valid --status values: pending, ready, dispatched, completed, failed, blocked.']
+    notes: [
+      'Valid --status values: pending, ready, dispatched, completed, failed, blocked.',
+      'To cancel a Task, stop or abandon its worker, then set --status failed --result cancelled; a later worker-start --retry-of reopens it.'
+    ]
   },
   ...ORCHESTRATION_WORKER_COMMAND_SPECS,
   {
```

**File**: `src/main/runtime/orchestration/db-stopping-worker-task-guard.test.ts` (modified, +3/-1)
```diff
@@ -93,7 +93,9 @@ describe('a Task whose supervised worker is stopping', () => {
       expect(db.getWorkerDispatch(dispatch.id)?.runtime_epoch).toBe('epoch_new_runtime')
 
       db.markWorkerStopUnknown(dispatch.id, 'the execution host did not answer')
-      expect(db.abandonWorkerDispatch(dispatch.id)).toMatchObject({ disposition: 'abandoned' })
+      expect(db.abandonWorkerDispatch(dispatch.id, 'epoch_test')).toMatchObject({
+        disposition: 'abandoned'
+      })
       expect(db.getTask(task.id)?.status).toBe('blocked')
     })
 
```

**File**: `src/main/runtime/orchestration/db-task-dispatch-lifecycle-guards.test.ts` (modified, +11/-7)
```diff
@@ -112,7 +112,7 @@ describe('Task/Dispatch lifecycle guards', () => {
   })
 
   it.each(['failed', 'stopped'] as const)(
-    'treats abandon of an already %s worker as stale without a lifecycle conflict',
+    'treats abandon of an already %s worker as settled without a lifecycle conflict',
     (state) => {
       const database = createDatabase()
       const task = database.createTask({
@@ -127,8 +127,8 @@ describe('Task/Dispatch lifecycle guards', () => {
         database.settleWorkerStop(worker.dispatchId)
       }
 
-      expect(database.abandonWorkerDispatch(worker.dispatchId)).toMatchObject({
-        disposition: 'stale',
+      expect(database.abandonWorkerDispatch(worker.dispatchId, 'epoch_test')).toMatchObject({
+        disposition: 'already_settled',
         worker: { state }
       })
     }
@@ -420,7 +420,7 @@ describe('Task/Dispatch lifecycle guards', () => {
       const released =
         operation === 'stop'
           ? database.beginWorkerStop(contextOnly.id, 'runtime_test')
-          : database.abandonWorkerDispatch(contextOnly.id)
+          : database.abandonWorkerDispatch(contextOnly.id, 'epoch_test')
       expect(released).toMatchObject({
         disposition: 'context_only',
         alreadySettled: false,
@@ -455,7 +455,7 @@ describe('Task/Dispatch lifecycle guards', () => {
       const released =
         operation === 'stop'
           ? database.beginWorkerStop(contextOnly.id, 'runtime_test')
-          : database.abandonWorkerDispatch(contextOnly.id)
+          : database.abandonWorkerDispatch(contextOnly.id, 'epoch_test')
 
       expect(released).toMatchObject({
         disposition: 'context_only',
@@ -514,7 +514,9 @@ describe('Task/Dispatch lifecycle guards', () => {
         )
         expect(database.settleWorkerStop(released.dispatchId).state).toBe('stopped')
       } else {
-        expect(database.abandonWorkerDispatch(released.dispatchId).disposition).toBe('abandoned')
+        expect(database.abandonWorkerDispatch(released.dispatchId, 'epoch_test').disposition).toBe(
+          'abandoned'
+        )
       }
 
       expect(database.getTask(task.id)?.status).toBe('dispatched')
@@ -545,7 +547,9 @@ describe('Task/Dispatch lifecycle guards', () => {
     expect(database.beginWorkerStop(stopping.dispatchId, 'runtime_test').disposition).toBe(
       'stopping'
     )
-    expect(database.abandonWorkerDispatch(abandoned.dispatchId).disposition).toBe('abandoned')
+    expect(database.abandonWorkerDispatch(abandoned.dispatchId, 'epoch_test').disposition).toBe(
+      'abandoned'
+    )
     expect(database.getTask(task.id)?.status).toBe('dispatched')
 
     expect(database.settleWorkerStop(stopping.dispatchId).state).toBe('stopped')
```

**File**: `src/main/runtime/orchestration/db/worker-dispatch/worker-dispatch-abandon.test.ts` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+import { afterEach, beforeEach, describe, expect, it } from 'vitest'
+import { OrchestrationDb } from '../orchestration-db'
+
+const THIS_RUNTIME = 'epoch_this_runtime'
+
+describe('worker-abandon settles a stuck worker', () => {
+  let db: OrchestrationDb
+  beforeEach(() => {
+    db = new OrchestrationDb(':memory:')
+  })
+  afterEach(() => db.close())
+
+  function startWorker(taskId?: string, name = 'w') {
+    const task = taskId
+      ? db.getTask(taskId)!
+      : db.createTask({ runId: 'run_legacy_local', spec: 'abandon work' })
+    const { dispatch } = db.createStartingWorkerDispatch({
+      taskId: task.id,
+      startOptions: {},
+      creator: { kind: 'system' },
+      maxDepth: 9
+    })
+    db.prepareStartingWorkerAuthority({
+      dispatchId: dispatch.id,
+      handle: `term_${name}`,
+      paneKey: `tab_${name}:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${name.length}`,
+      processIncarnation: `inc_${name}`,
+      worktreeId: 'wt',
+      effects: [],
+      setupState: 'not_configured',
+      terminalOwnership: 'created'
+    })
+    return { task, dispatch }
+  }
+
+  function readyWorker(taskId?: string, name?: string) {
+    const started = startWorker(taskId, name)
+    db.markWorkerDispatchReady(started.dispatch.id)
+    return started
+  }
+
+  function setReleaseState(dispatchId: string, releaseState: string) {
+    db.db
+      .prepare('UPDATE worker_terminal_resources SET release_state = ? WHERE owner_dispatch_id = ?')
+      .run(releaseState, dispatchId)
+  }
+
+  function storeArchive(dispatchId: string) {
+    const resource = db.getWorkerTerminalResourceByOwner(dispatchId)!
+    db.db
+      .prepare(
+        "INSERT INTO worker_terminal_archives (dispatch_id, resource_id, kind, content) VALUES (?, ?, 'terminal_tail', '{}')"
+      )
+      .run(dispatchId, resource.id)
+  }
+
+  function expectAbandoned(dispatchId: string, taskId: string, priorError?: string) {
+    expect(db.getWorkerDispatch(dispatchId)).toMatchObject({
+      state: 'abandoned',
+      stage: 'abandoned',
+      last_error: [priorError, 'Abandoned by term_coordinator.'].filter(Boolean).join(' ')
+    })
+    expect(db.getDispatchContextById(dispatchId)).toMatchObject({
+      status: 'failed',
+      last_failure: 'abandoned',
+      capability_revoked_at: expect.any(String)
+    })
+    expect(db.getTask(taskId)?.status).toBe('blocked')
+  }
+
+  it('settles a stop another runtime left stranded in stopping', () => {
+    const { task, dispatch } = readyWorker()
+    db.beginWorkerStop(dispatch.id, 'epoch_dead_runtime')
+
+    expect(db.abandonWorkerDispatch(dispatch.id, THIS_RUNTIME, 'term_coordinator')).toMatchObject({
+      disposition: 'abandoned'
+    })
+    expectAbandoned(dispatch.id, task.id)
+  })
+
+  it.each([
+    [
+      'stop_unknown',
+      'the terminal is external',
+      (id: string) => {
+        db.beginWorkerStop(id, THIS_RUNTIME)
+        db.markWorkerStopUnknown(id, 'the terminal is external')
+      }
+    ],
+    [
+      'start_unknown',
+      'lost contact',
+      (id: string) => db.markWorkerStartUnknown(id, 'prompt', 'lost contact')
+    ]
+  ] as const)('settles a %s worker and records who abandoned it', (state, priorError, reach) => {
+    const { task, dispatch } = startWorker()
+    if (state === 'stop_unknown') {
+      db.markWorkerDispatchReady(dispatch.id)
+    }
+    reach(dispatch.id)
+
+    expect(db.abandonWorkerDispatch(dispatch.id, THIS_RUNTIME, 'term_coordinator')).toMatchObject({
+      disposition: 'abandoned'
+    })
+    expectAbandoned(dispatch.id, task.id, priorError)
+  })
+
+  it('says so when it cannot tell who abandoned the worker', () => {
+    const { dispatch } = readyWorker()
+    db.abandonWorkerDispatch(dispatch.id, THIS_RUNTIME)
+
+    expect(db.getWorkerDispatch(dispatch.id)?.last_error).toBe(
+      'Abandoned by an unidentified caller.'
+    )
+  })
+
+  it('settles an active attempt that is no longer the Task latest without to
```

---

### Incident Patch 7: `9afd1101` (2026-09-30)
**Commit Message**: fix(orchestration): stop minting and printing the dispatch capability (#23994)

* fix(orchestration): authorize worker reports without the dispatch capability

Worker lifecycle reports and questions no longer depend on the per-dispatch
capability token that lives only in the agent's conversation. The host now:

- ignores capability_hash/capability_revoked_at for authorization on every
  row and checks the exact worker process instead (ask gains that check);
- refuses a report whose calling terminal is provably another orchestration
  party (a Run coordinator or another Dispatch's worker), treating env that
  names no live pane here as absent;
- applies one worker-state rule locally and remotely: a stop in flight
  refuses, while stop_unknown and start_unknown accept and settle.

Minting and printing the flag are unchanged, so an older host and older
preambles keep working.

* fix(orchestration): stop minting the dispatch capability

Dispatches no longer mint a per-Dispatch token, and preambles, the bundled
skill guide and the ask resume hint stop printing --dispatch-capability. The
consumer-generation bump and delivery fence that minting carried stay, now
as setDispatchConsumer. Re

**File**: `config/scripts/orchestration-skill-guidance.test.mjs` (modified, +2/-2)
```diff
@@ -318,15 +318,15 @@ describe('owned orchestration references', () => {
     expect(squash(reference)).toContain('An empty `check` never means you were replaced')
   })
 
-  it('keeps heartbeat and worker_done recipes bound to the injected capability', () => {
+  it('keeps heartbeat and worker_done recipes bound to the injected Dispatch', () => {
     const reference = readReference('worker-contract.md')
     const recipes = [...reference.matchAll(/```text\n([\s\S]*?)```/gu)].map((match) => match[1])
     const heartbeat = recipes.find((recipe) => recipe.includes('--type heartbeat'))
     const workerDone = recipes.find((recipe) => recipe.includes('--type worker_done'))
 
     for (const recipe of [heartbeat, workerDone]) {
       expect(recipe).toContain('--from <worker_handle>')
-      expect(recipe).toContain('--dispatch-capability <capability>')
+      expect(recipe).not.toContain('--dispatch-capability')
       expect(recipe).toContain('--task-id <task_id> --dispatch-id <dispatch_id>')
     }
     expect(workerDone).not.toContain('--files-modified')
```

**File**: `skill-guides/orchestration.md` (modified, +3/-2)
```diff
@@ -49,8 +49,9 @@ non-Orca subagent tool when Orca orchestration provenance was requested.
   place workers. A Task is work. A Dispatch is one authoritative Task attempt.
 - Lifecycle authority comes from the active Dispatch, not a terminal title,
   copied ID, old database row, provider transcript, or visible pane.
-- Workers use the exact executable, handle, capability, Task ID, and Dispatch ID
-  in the live preamble. Never reconstruct, translate, or broaden those arguments.
+- Workers use the exact executable, handle, Task ID, and Dispatch ID in the live
+  preamble, plus any other flag it carries. Never reconstruct, translate, or
+  broaden those arguments.
 - After remote start, address the worker by Dispatch ID. The execution host owns
   process, filesystem, transcript, stop, and cleanup facts. Preserve the verdicts
   `live` / `unverifiable` / `exited`; contact loss is not process death.
```

**File**: `skill-guides/orchestration/references/messaging-and-gates.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ ORCA orchestration send --to dispatch:<dispatch_id> --subject "Follow-up" --body
 
 Do not substitute a remote terminal handle. Omit `--from` for ordinary
 coordinator calls; a dispatched worker instead copies the exact `--from` and
-capability arguments in its preamble. `check` is the exception: it identifies
+other arguments in its preamble. `check` is the exception: it identifies
 its caller with `--terminal`, never `--from`.
 
 Group addresses include `@all`, `@idle`, `@claude`, `@codex`, `@opencode`,
```

**File**: `skill-guides/orchestration/references/worker-contract.md` (modified, +7/-6)
```diff
@@ -2,15 +2,16 @@
 
 The injected preamble is authoritative. Copy its command rather than
 reconstructing flags. In particular, preserve the exact executable, worker
-handle, Dispatch capability, Task ID, and Dispatch ID.
+handle, Task ID, and Dispatch ID, and keep any other flag it carries (an older
+Orca host adds `--dispatch-capability`).
 
 ## Heartbeat
 
 Send heartbeats only at the cadence required by the live preamble. Skip them
 while blocked inside `ask` or `check --wait`; those calls are liveness signals.
 
 ```text
-ORCA orchestration send --from <worker_handle> --dispatch-capability <capability> --type heartbeat --subject "alive" --task-id <task_id> --dispatch-id <dispatch_id> --phase "<investigating|implementing|reviewing|waiting>"
+ORCA orchestration send --from <worker_handle> --type heartbeat --subject "alive" --task-id <task_id> --dispatch-id <dispatch_id> --phase "<investigating|implementing|reviewing|waiting>"
 ```
 
 Use typed lifecycle flags, not a hand-written JSON payload. A heartbeat proves
@@ -22,9 +23,9 @@ Use Orca `ask` whenever the coordinator must answer. Never open a local question
 TUI the coordinator cannot answer.
 
 ```text
-ORCA orchestration ask --from <worker_handle> --dispatch-capability <capability> --question "<question>" --options "<choice-a>,<choice-b>" --timeout-ms 600000
+ORCA orchestration ask --from <worker_handle> --question "<question>" --options "<choice-a>,<choice-b>" --timeout-ms 600000
 
-ORCA orchestration ask --from <worker_handle> --dispatch-capability <capability> --resume <message_id> --timeout-ms 600000
+ORCA orchestration ask --from <worker_handle> --resume <message_id> --timeout-ms 600000
 ```
 
 A timeout or disconnect leaves the original question pending. Resume its
@@ -57,7 +58,7 @@ party's terminal (a coordinator or another worker); run it from your own termina
 Escalate only before completion and only when the coordinator must intervene:
 
 ```text
-ORCA orchestration send --from <worker_handle> --dispatch-capability <capability> --type escalation --subject "Blocked: <reason>" --body "<details>" --task-id <task_id> --dispatch-id <dispatch_id>
+ORCA orchestration send --from <worker_handle> --type escalation --subject "Blocked: <reason>" --body "<details>" --task-id <task_id> --dispatch-id <dispatch_id>
 ```
 
 ## Completion
@@ -70,7 +71,7 @@ Append `--files-modified` or `--report-path` only when applicable, using actual
 paths. Do not send documentation placeholders as metadata.
 
 ```text
-ORCA orchestration send --from <worker_handle> --dispatch-capability <capability> --type worker_done --subject "<short status>" --body "<three sentences: work, findings, remaining>" --task-id <task_id> --dispatch-id <dispatch_id> --outcome succeeded
+ORCA orchestration send --from <worker_handle> --type worker_done --subject "<short status>" --body "<three sentences: work, findings, remaining>" --task-id <task_id> --dispatch-id <dispatch_id> --outcome succeeded
 ```
 
 After `worker_done`, end the dispatched turn and idle. Do not poll, close your
```

**File**: `src/cli/orchestration-mutation-recovery.test.ts` (modified, +2/-2)
```diff
@@ -46,7 +46,7 @@ describe('orchestration mutation recovery', () => {
     )
     expect((result.data as { nextSteps?: string[] }).nextSteps).toEqual([
       'Run orca orchestration worker-show --dispatch dispatch_1 --json before retrying.',
-      'After inspecting the Dispatch, if keyed recovery is still needed, run orca orchestration worker-start --task task_1 --retry-request request_1. --retry-request reuses the same operation identity so Orca can replay, join, or safely recover it without starting a separate duplicate.'
+      'After inspecting the Dispatch, if keyed recovery is still needed, run orca orchestration worker-start --task task_1 --retry-request request_1 from this same terminal. --retry-request reuses the same operation identity so Orca can replay, join, or safely recover it without starting a separate duplicate.'
     ])
   })
 
@@ -122,7 +122,7 @@ describe('orchestration mutation recovery', () => {
 
     expect((result.data as { nextSteps?: string[] }).nextSteps).toEqual([
       'Run orca-dev orchestration worker-show --dispatch dispatch_3 --json before retrying.',
-      "After inspecting the Dispatch, if keyed recovery is still needed, run orca-dev orchestration worker-start --task 'task 3' --comment 'literal $(do-not-run)' --retry-request request_3. --retry-request reuses the same operation identity so Orca can replay, join, or safely recover it without starting a separate duplicate."
+      "After inspecting the Dispatch, if keyed recovery is still needed, run orca-dev orchestration worker-start --task 'task 3' --comment 'literal $(do-not-run)' --retry-request request_3 from this same terminal. --retry-request reuses the same operation identity so Orca can replay, join, or safely recover it without starting a separate duplicate."
     ])
     expect(result.message).toContain("'literal $(do-not-run)'")
   })
```

---

### Incident Patch 8: `46d6b76a` (2026-09-30)
**Commit Message**: fix(orchestration): retry worker_done while the Orca runtime is briefly unreachable (#23984)

* fix(orchestration): retry worker_done while the Orca runtime is briefly unreachable

A worker reports worker_done once and ends its turn, so a few-minute app
outage silently stranded finished work at dispatched. The CLI now retries
worker_done on runtime_unavailable for about two minutes with backoff,
reusing one request id so the host's mutation ledger replays rather than
double-applies it, then prints the existing recovery command.

The contract probe no longer caches a failed status.get, which otherwise
made every retry fail without reaching the app.

Part of STA-8833.

* refactor(cli): pass the worker_done retry window in the mutation options bag

* Revert "refactor(cli): pass the worker_done retry window in the mutation options bag"

The options bag is forwarded to client.call as-is; the retry window is not a client.call option, and folding it in needed a value scan to keep the no-options call shape.

* test(cli): fold the explicit retry-request case and drop a vacuous timing assert

* fix(cli): keep worker_done recovery when the last retry fails before sending

Also skip the Unix-s

**File**: `src/cli/handlers/orchestration-migration.test.ts` (modified, +21/-14)
```diff
@@ -1,6 +1,9 @@
 import { afterEach, describe, expect, it, vi } from 'vitest'
 import { ORCHESTRATION_HANDLERS } from './orchestration'
 
+// worker_done carries a CLI-minted request id so its runtime_unavailable retries replay one mutation.
+const WORKER_DONE_REQUEST = { orchestrationRequestId: expect.any(String) }
+
 const originalPaneKey = process.env.ORCA_PANE_KEY
 
 afterEach(() => {
@@ -34,20 +37,24 @@ describe('orchestration CLI migration recovery', () => {
         json: true
       } as never)
 
-      expect(call).toHaveBeenCalledWith('orchestration.send', {
-        from: 'term_worker',
-        to: undefined,
-        run: undefined,
-        subject: 'Done',
-        body: undefined,
-        type: 'worker_done',
-        priority: undefined,
-        threadId: undefined,
-        payload: undefined,
-        senderPaneKey: 'tab-worker:leaf-worker',
-        waitForLifecycleSettlement: true,
-        devMode: false
-      })
+      expect(call).toHaveBeenCalledWith(
+        'orchestration.send',
+        {
+          from: 'term_worker',
+          to: undefined,
+          run: undefined,
+          subject: 'Done',
+          body: undefined,
+          type: 'worker_done',
+          priority: undefined,
+          threadId: undefined,
+          payload: undefined,
+          senderPaneKey: 'tab-worker:leaf-worker',
+          waitForLifecycleSettlement: true,
+          devMode: false
+        },
+        WORKER_DONE_REQUEST
+      )
       expect(call).toHaveBeenCalledOnce()
     }
   )
```

**File**: `src/cli/handlers/orchestration.test.ts` (modified, +60/-44)
```diff
@@ -1,6 +1,8 @@
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 
 const callMock = vi.fn()
+// worker_done carries a CLI-minted request id so its runtime_unavailable retries replay one mutation.
+const WORKER_DONE_REQUEST = { orchestrationRequestId: expect.any(String) }
 const getTerminalHandleMock = vi.hoisted(() => vi.fn())
 const originalTerminalHandle = process.env.ORCA_TERMINAL_HANDLE
 const originalPaneKey = process.env.ORCA_PANE_KEY
@@ -79,24 +81,28 @@ describe('orchestration send structured payload flags', () => {
       ])
     )
 
-    expect(callMock).toHaveBeenCalledWith('orchestration.send', {
-      from: 'term_worker',
-      to: 'term_coord',
-      subject: 'done',
-      body: undefined,
-      type: 'worker_done',
-      priority: undefined,
-      threadId: undefined,
-      payload: JSON.stringify({
-        taskId: 'task_1',
-        dispatchId: 'ctx_1',
-        outcome: 'succeeded',
-        filesModified: ['src/a.ts', 'src/b.ts'],
-        reportPath: 'reports/done.md'
-      }),
-      waitForLifecycleSettlement: true,
-      devMode: false
-    })
+    expect(callMock).toHaveBeenCalledWith(
+      'orchestration.send',
+      {
+        from: 'term_worker',
+        to: 'term_coord',
+        subject: 'done',
+        body: undefined,
+        type: 'worker_done',
+        priority: undefined,
+        threadId: undefined,
+        payload: JSON.stringify({
+          taskId: 'task_1',
+          dispatchId: 'ctx_1',
+          outcome: 'succeeded',
+          filesModified: ['src/a.ts', 'src/b.ts'],
+          reportPath: 'reports/done.md'
+        }),
+        waitForLifecycleSettlement: true,
+        devMode: false
+      },
+      WORKER_DONE_REQUEST
+    )
   })
 
   it('forwards multiline message bodies without normalization', async () => {
@@ -202,18 +208,22 @@ describe('orchestration send structured payload flags', () => {
       ])
     )
 
-    expect(callMock).toHaveBeenCalledWith('orchestration.send', {
-      from: 'term_worker',
-      to: 'term_coord',
-      subject: 'done',
-      body: undefined,
-      type: 'worker_done',
-      priority: undefined,
-      threadId: undefined,
-      payload: JSON.stringify({ outcome: 'succeeded' }),
-      waitForLifecycleSettlement: true,
-      devMode: false
-    })
+    expect(callMock).toHaveBeenCalledWith(
+      'orchestration.send',
+      {
+        from: 'term_worker',
+        to: 'term_coord',
+        subject: 'done',
+        body: undefined,
+        type: 'worker_done',
+        priority: undefined,
+        threadId: undefined,
+        payload: JSON.stringify({ outcome: 'succeeded' }),
+        waitForLifecycleSettlement: true,
+        devMode: false
+      },
+      WORKER_DONE_REQUEST
+    )
   })
 
   it('sends lifecycle messages from ORCA_TERMINAL_HANDLE without a liveness probe', async () => {
@@ -229,18 +239,22 @@ describe('orchestration send structured payload flags', () => {
     )
 
     expect(callMock).toHaveBeenCalledTimes(1)
-    expect(callMock).toHaveBeenCalledWith('orchestration.send', {
-      from: 'term_worker_env',
-      to: 'term_coord',
-      subject: 'done',
-      body: undefined,
-      type: 'worker_done',
-      priority: undefined,
-      threadId: undefined,
-      payload: JSON.stringify({ outcome: 'succeeded' }),
-      waitForLifecycleSettlement: true,
-      devMode: false
-    })
+    expect(callMock).toHaveBeenCalledWith(
+      'orchestration.send',
+      {
+        from: 'term_worker_env',
+        to: 'term_coord',
+        subject: 'done',
+        body: undefined,
+        type: 'worker_done',
+        priority: undefined,
+        threadId: undefined,
+        payload: JSON.stringify({ outcome: 'succeeded' }),
+        waitForLifecycleSettlement: true,
+        devMode: false
+      },
+      WORKER_DONE_REQUEST
+    )
   })
 
   it.each(['worker_done', 'heartbeat'] as const)(
@@ -265,7 +279,8 @@ describe('orchestration send structured payload flags', () =>
```

**File**: `src/cli/handlers/orchestration/message-send-handler.ts` (modified, +5/-1)
```diff
@@ -12,6 +12,8 @@ import {
   throwNoActiveSenderTerminal
 } from './terminal-identity'
 
+const WORKER_DONE_UNAVAILABLE_RETRY_MS = 120_000
+
 type LifecycleSendResult =
   | {
       action: 'completed' | 'failed'
@@ -110,7 +112,9 @@ export const ORCHESTRATION_SEND_HANDLER: Record<string, CommandHandler> = {
       flags,
       'orchestration.send',
       sendParams,
-      dispatchCapability ? { orchestrationCapability: dispatchCapability } : undefined
+      dispatchCapability ? { orchestrationCapability: dispatchCapability } : undefined,
+      // Why: a worker reports once and ends its turn, so a brief app outage must delay worker_done, not drop it.
+      type === 'worker_done' ? WORKER_DONE_UNAVAILABLE_RETRY_MS : 0
     )
     await requireWorkerDoneSettlement(client, type, sendParams.payload, result.result)
     if ('lifecycle' in result.result && result.result.lifecycle?.action === 'rejected') {
```

**File**: `src/cli/handlers/orchestration/mutation-request.test.ts` (added, +240/-0)
```diff
@@ -0,0 +1,240 @@
+import { createServer, type Server } from 'node:net'
+import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { afterEach, describe, expect, it, vi } from 'vitest'
+import { z } from 'zod'
+import { ORCHESTRATION_CONTRACT_RUNTIME_CAPABILITY } from '../../../shared/protocol-version'
+import { RuntimeClient, RuntimeClientError } from '../../runtime-client'
+import { callOrchestrationMutation } from './mutation-request'
+
+const RETRY_MS = 120_000
+const WORKER_DONE = {
+  from: 'term_worker',
+  subject: 'done',
+  type: 'worker_done',
+  payload: '{"taskId":"task_1","dispatchId":"ctx_1","outcome":"succeeded"}'
+}
+
+const RuntimeRequest = z.object({
+  id: z.string(),
+  method: z.string(),
+  orchestrationRequestId: z.string().optional()
+})
+
+const servers = new Set<Server>()
+const tempDirs = new Set<string>()
+
+afterEach(async () => {
+  vi.useRealTimers()
+  await Promise.all([...servers].map((server) => new Promise((resolve) => server.close(resolve))))
+  servers.clear()
+  for (const dir of tempDirs) {
+    rmSync(dir, { recursive: true, force: true })
+  }
+  tempDirs.clear()
+})
+
+type CallOptions = { orchestrationRequestId?: string }
+
+function fakeClient(respond: (attempt: number, options?: CallOptions) => unknown): {
+  client: RuntimeClient
+  requestIds: (string | undefined)[]
+} {
+  const requestIds: (string | undefined)[] = []
+  const call = vi.fn(async (_method: string, _params: unknown, options?: CallOptions) => {
+    requestIds.push(options?.orchestrationRequestId)
+    return respond(requestIds.length, options)
+  })
+  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: callOrchestrationMutation only uses client.call.
+  return { client: { call } as unknown as RuntimeClient, requestIds }
+}
+
+function unavailable(options?: CallOptions): RuntimeClientError {
+  return new RuntimeClientError(
+    'runtime_unavailable',
+    'Could not connect to the running Orca app.',
+    {
+      orchestrationRequestId: options?.orchestrationRequestId,
+      originalCommand: ['orca', 'orchestration', 'send', '--type', 'worker_done']
+    }
+  )
+}
+
+describe('callOrchestrationMutation runtime_unavailable retry', () => {
+  it.each([
+    ['a fresh', new Map<string, string | boolean>(), expect.stringMatching(/^[0-9a-f-]{36}$/)],
+    [
+      'an explicit --retry-request',
+      new Map([['retry-request', '11111111-2222-4333-8444-555555555555']]),
+      '11111111-2222-4333-8444-555555555555'
+    ]
+  ])('retries with %s request id until the runtime answers', async (_case, flags, requestId) => {
+    vi.useFakeTimers()
+    const { client, requestIds } = fakeClient((attempt, options) => {
+      if (attempt < 3) {
+        throw unavailable(options)
+      }
+      return { ok: true, result: 'sent' }
+    })
+    const call = callOrchestrationMutation(
+      client,
+      flags,
+      'orchestration.send',
+      WORKER_DONE,
+      undefined,
+      RETRY_MS
+    )
+    await vi.advanceTimersByTimeAsync(3_000)
+    await expect(call).resolves.toEqual({ ok: true, result: 'sent' })
+    expect(requestIds).toHaveLength(3)
+    expect(new Set(requestIds).size).toBe(1)
+    expect(requestIds[0]).toEqual(requestId)
+  })
+
+  it('does not retry an error other than runtime_unavailable', async () => {
+    const { client, requestIds } = fakeClient(() => {
+      throw new RuntimeClientError('runtime_timeout', 'Timed out.')
+    })
+    await expect(
+      callOrchestrationMutation(
+        client,
+        new Map(),
+        'orchestration.send',
+        WORKER_DONE,
+        undefined,
+        RETRY_MS
+      )
+    ).rejects.toMatchObject({ code: 'runtime_timeout' })
+    expect(requestIds).toHaveLength(1)
+  })
+
+  it('does not retry mutations that did not opt in', async () => {
+    const { client, requestIds } = fakeClient((_attempt, options) => {
+      throw unavailable(options)

```

**File**: `src/cli/handlers/orchestration/mutation-request.ts` (modified, +47/-12)
```diff
@@ -1,21 +1,56 @@
-import type { RuntimeClient } from '../../runtime-client'
+import { randomUUID } from 'node:crypto'
+import { RuntimeClientError, type RuntimeClient } from '../../runtime-client'
 import { readRetryRequestFlag } from '../../retry-request-flag'
 import { orchestrationMutationRecoveryError } from '../../orchestration-mutation-recovery'
 
-export function callOrchestrationMutation<TResult>(
+const MAX_UNAVAILABLE_RETRY_DELAY_MS = 15_000
+
+export async function callOrchestrationMutation<TResult>(
   client: RuntimeClient,
   flags: Map<string, string | boolean>,
   method: string,
   params: unknown,
-  options?: { timeoutMs?: number; orchestrationCapability?: string }
+  options?: { timeoutMs?: number; orchestrationCapability?: string },
+  unavailableRetryMs = 0
 ) {
-  const requestId = readRetryRequestFlag(flags)
-  const result = requestId
-    ? client.call<TResult>(method, params, { ...options, orchestrationRequestId: requestId })
-    : options
-      ? client.call<TResult>(method, params, options)
-      : client.call<TResult>(method, params)
-  return result.catch((error) => {
-    throw orchestrationMutationRecoveryError(error)
-  })
+  // Why: every retry reuses one request id, so the host replays instead of applying the mutation twice.
+  const requestId =
+    readRetryRequestFlag(flags) ?? (unavailableRetryMs > 0 ? randomUUID() : undefined)
+  const deadline = Date.now() + unavailableRetryMs
+  let sentError: RuntimeClientError | undefined
+  for (let delayMs = 1_000; ; delayMs = Math.min(delayMs * 2, MAX_UNAVAILABLE_RETRY_DELAY_MS)) {
+    try {
+      return requestId
+        ? await client.call<TResult>(method, params, {
+            ...options,
+            orchestrationRequestId: requestId
+          })
+        : options
+          ? await client.call<TResult>(method, params, options)
+          : await client.call<TResult>(method, params)
+    } catch (error) {
+      const unavailable =
+        error instanceof RuntimeClientError && error.code === 'runtime_unavailable'
+      if (carriesRequestId(error)) {
+        sentError = error
+      }
+      if (!unavailable || Date.now() + delayMs > deadline) {
+        // Why: a later attempt can fail before its request id is attached, though an earlier one may have landed.
+        throw orchestrationMutationRecoveryError(
+          carriesRequestId(error) ? error : (sentError ?? error)
+        )
+      }
+      await new Promise((resolve) => setTimeout(resolve, delayMs))
+    }
+  }
+}
+
+function carriesRequestId(error: unknown): error is RuntimeClientError {
+  const data: unknown = error instanceof RuntimeClientError ? error.data : undefined
+  return (
+    typeof data === 'object' &&
+    data !== null &&
+    'orchestrationRequestId' in data &&
+    typeof data.orchestrationRequestId === 'string'
+  )
 }
```

---

### Incident Patch 9: `e0387040` (2026-09-30)
**Commit Message**: fix(orchestration): accept worker reports without the dispatch capability (#23982)

* fix(orchestration): authorize worker reports without the dispatch capability

Worker lifecycle reports and questions no longer depend on the per-dispatch
capability token that lives only in the agent's conversation. The host now:

- ignores capability_hash/capability_revoked_at for authorization on every
  row and checks the exact worker process instead (ask gains that check);
- refuses a report whose calling terminal is provably another orchestration
  party (a Run coordinator or another Dispatch's worker), treating env that
  names no live pane here as absent;
- applies one worker-state rule locally and remotely: a stop in flight
  refuses, while stop_unknown and start_unknown accept and settle.

Minting and printing the flag are unchanged, so an older host and older
preambles keep working.

* fix(orchestration): name the fenced party without implying which Dispatch it owns

* refactor(orchestration): one worker report rule, fence only a different party

- One module owns the unproven/settleable worker states and the refusal rule; local send records it, ask and remote throw it. A stale process i

**File**: `skill-guides/orchestration/references/worker-contract.md` (modified, +2/-0)
```diff
@@ -49,6 +49,8 @@ If `check` returns `consumer_fenced`, this process no longer owns its Dispatch:
 the Attempt was re-attached to another worker or settled without you. Stop, do
 not send `worker_done`, and do not retry the check. An empty `check` never means
 you were replaced; `consumer_fenced` is the only way you learn that.
+If `send` or `ask` returns `consumer_fenced`, the command ran from another
+party's terminal (a coordinator or another worker); run it from your own terminal.
 
 ## Escalation
 
```

**File**: `src/main/runtime/orchestration/coordinator-dispatch-unobserved-prompt.test.ts` (modified, +1/-9)
```diff
@@ -91,20 +91,12 @@ describe('coordinator dispatch with an unobserved prompt', () => {
     const task = db.createTask({ runId: 'run_legacy_local', spec: 'do the work' })
     await dispatch(createRuntime(new Error('agent_prompt_stalled')), task.id, [])
     const dispatchId = db.getDispatchContext(task.id)!.id
-    const minted = db.mintDispatchCapability({
+    db.mintDispatchCapability({
       dispatchId,
       paneKey: WORKER_PANE_KEY,
       processIncarnation: 'incarnation-1'
     })
 
-    expect(
-      db.verifyDispatchCapability({
-        dispatchId,
-        capability: minted,
-        paneKey: WORKER_PANE_KEY,
-        processIncarnation: 'incarnation-1'
-      })
-    ).toEqual({ valid: true })
     expect(
       db.settleWorkerReport({
         taskId: task.id,
```

**File**: `src/main/runtime/orchestration/db-task-dispatch-invariant.test.ts` (modified, +2/-18)
```diff
@@ -82,7 +82,7 @@ describe('Task/Dispatch invariant transactions', () => {
         deps: [task.id]
       })
       const dispatch = createRootDispatch(db, task.id, 'term_worker')
-      const capability = db.mintDispatchCapability({
+      db.mintDispatchCapability({
         dispatchId: dispatch.id,
         paneKey: 'tab_worker:leaf_worker',
         processIncarnation: 'worker:1'
@@ -109,14 +109,6 @@ describe('Task/Dispatch invariant transactions', () => {
         completed_at: null,
         capability_revoked_at: null
       })
-      expect(
-        db.verifyDispatchCapability({
-          dispatchId: dispatch.id,
-          capability,
-          paneKey: 'tab_worker:leaf_worker',
-          processIncarnation: 'worker:1'
-        })
-      ).toEqual({ valid: true })
       expect(db.getTask(dependent.id)?.status).toBe('pending')
     }
   )
@@ -415,7 +407,7 @@ describe('Task/Dispatch invariant transactions', () => {
         taskId: task.id,
         startOptions: {}
       })
-      const capability = db.prepareStartingWorkerAuthority({
+      db.prepareStartingWorkerAuthority({
         dispatchId: started.dispatch.id,
         handle: 'term_worker',
         paneKey: 'tab_worker:dddddddd-dddd-4ddd-8ddd-dddddddddddd',
@@ -443,14 +435,6 @@ describe('Task/Dispatch invariant transactions', () => {
         capability_revoked_at: null
       })
       expect(db.getWorkerDispatch(started.dispatch.id)?.state).toBe('starting')
-      expect(
-        db.verifyDispatchCapability({
-          dispatchId: started.dispatch.id,
-          capability,
-          paneKey: 'tab_worker:dddddddd-dddd-4ddd-8ddd-dddddddddddd',
-          processIncarnation: 'worker:1'
-        })
-      ).toEqual({ valid: true })
     }
   )
 
```

**File**: `src/main/runtime/orchestration/db-task-dispatch-lifecycle-guards.test.ts` (modified, +2/-23)
```diff
@@ -47,8 +47,6 @@ describe('Task/Dispatch lifecycle guards', () => {
     expect(database.getDispatchContextById(second.dispatchId)?.status).toBe('dispatched')
     expect(database.getWorkerDispatch(first.dispatchId)?.state).toBe('ready')
     expect(database.getWorkerDispatch(second.dispatchId)?.state).toBe('ready')
-    expectCapability(database, first, true)
-    expectCapability(database, second, true)
   })
 
   it.each(['succeeded', 'failed'] as const)(
@@ -158,7 +156,6 @@ describe('Task/Dispatch lifecycle guards', () => {
       capability_revoked_at: null
     })
     expect(database.getWorkerDispatch(worker.dispatchId)?.state).toBe('ready')
-    expectCapability(database, worker, true)
   })
 
   it('atomically settles worker state when a proven process exit fails its Dispatch', () => {
@@ -178,7 +175,6 @@ describe('Task/Dispatch lifecycle guards', () => {
       stage: 'process_exited',
       last_error: 'process exited'
     })
-    expectCapability(database, worker, false)
   })
 
   it('settles a stop-unknown worker when a positive PTY exit arrives', () => {
@@ -211,7 +207,6 @@ describe('Task/Dispatch lifecycle guards', () => {
       stage: 'process_exited',
       last_error: 'process exited'
     })
-    expectCapability(database, worker, false)
   })
 
   it('keeps a Task dispatched when missing-terminal recovery leaves another worker active', () => {
@@ -234,12 +229,10 @@ describe('Task/Dispatch lifecycle guards', () => {
     expect(database.getWorkerDispatch(missing.dispatchId)?.state).toBe('abandoned')
     expect(database.getDispatchContextById(live.dispatchId)?.status).toBe('dispatched')
     expect(database.getWorkerDispatch(live.dispatchId)?.state).toBe('ready')
-    expectCapability(database, missing, false)
-    expectCapability(database, live, true)
 
     database.reconcileMissingWorkerTerminal(live.dispatchId, 'second terminal missing')
     expect(database.getTask(task.id)?.status).toBe('ready')
-    expectCapability(database, live, false)
+    expect(database.getDispatchContextById(live.dispatchId)?.status).toBe('failed')
   })
 
   it.each(['local', 'federated'] as const)(
@@ -288,7 +281,6 @@ describe('Task/Dispatch lifecycle guards', () => {
       expect(database.getWorkerDispatch(failed.dispatch.id)?.state).toBe('failed')
       expect(database.getDispatchContextById(live.dispatchId)?.status).toBe('dispatched')
       expect(database.getWorkerDispatch(live.dispatchId)?.state).toBe('ready')
-      expectCapability(database, live, true)
     }
   )
 
@@ -528,7 +520,6 @@ describe('Task/Dispatch lifecycle guards', () => {
 
       expect(database.getTask(task.id)?.status).toBe('dispatched')
       expect(database.getDispatchContextById(live.dispatchId)?.status).toBe('dispatched')
-      expectCapability(database, live, true)
       expect(
         database.settleWorkerReport({
           taskId: task.id,
@@ -538,7 +529,7 @@ describe('Task/Dispatch lifecycle guards', () => {
         })
       ).toEqual({ action: 'settled', outcome: 'succeeded', duplicate: false })
       expect(database.getTask(task.id)?.status).toBe('completed')
-      expectCapability(database, live, false)
+      expect(database.getDispatchContextById(live.dispatchId)?.status).toBe('completed')
     }
   )
 
@@ -656,7 +647,6 @@ describe('Task/Dispatch lifecycle guards', () => {
     expect(database.getTask(task.id)?.status).toBe('dispatched')
     expect(database.getDispatchContextById(worker.dispatchId)?.status).toBe('dispatched')
     expect(database.getWorkerDispatch(worker.dispatchId)?.state).toBe('ready')
-    expectCapability(database, worker, true)
   })
 
   it('rolls back gate resolution when an active Dispatch blocks readiness', () => {
@@ -714,17 +704,6 @@ function startWorker(database: OrchestrationDb, taskId: string, name: string): W
   return { dispatchId: started.dispatch.id, capability, handle, paneKey, processIncarnation }
 }
 
-function expectCapability(database: OrchestrationDb, worker: WorkerFixture, val
```

**File**: `src/main/runtime/orchestration/db-task-dispatch-races.test.ts` (modified, +1/-9)
```diff
@@ -126,7 +126,7 @@ describe('Task/Dispatch concurrency', () => {
       taskId: task.id,
       startOptions: {}
     })
-    const capability = first.db.prepareStartingWorkerAuthority({
+    first.db.prepareStartingWorkerAuthority({
       dispatchId: started.dispatch.id,
       handle: 'term_worker',
       paneKey: 'tab_worker:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
@@ -171,14 +171,6 @@ describe('Task/Dispatch concurrency', () => {
       status: 'completed',
       last_failure: null
     })
-    expect(
-      first.db.verifyDispatchCapability({
-        dispatchId: started.dispatch.id,
-        capability,
-        paneKey: 'tab_worker:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
-        processIncarnation: 'worker:1'
-      })
-    ).toMatchObject({ valid: false })
   })
 
   it('keeps nested dispatch failure atomic with its caller transaction', () => {
```

---

### Incident Patch 10: `fa3710df` (2026-09-30)
**Commit Message**: test: retire cases whose fixture decides the outcome it asserts (#24144)

Backlog chunks 12-17: sidebar, hooks and four renderer/lib chunks, six auditors at 84 files
each. 38 case declarations removed across 27 files (56 executed cases, one deletion was a
13-entry `it.each`), 1 test file deleted, 710 lines gone. No production code touched.

The theme this wave is a test whose own scaffolding makes the decision it claims to check:

- `useAutoAckViewedAgent.test.ts` — its `runAutoAckScan` helper reassembles the hook's scan
  loop, calling `resolveAutoAckTabTargets`, `createTerminalAttentionSurface`,
  `resolveViewedUnreadSubjectKey`, `shouldClearWorkspaceAttention` and
  `applyAgentAttentionAcknowledgement` in production's order. The test, not the hook, decides
  the outcome. Owner drives the real hook through `renderHook`/`rerender`.
- `WorktreeList.lineage-agent-expansion-coupling.test.tsx` — a CONTROL case that was green
  both before AND after the fix it brackets. Expansion now lives in a module-level cache
  (`worktree-card-agents-expansion-state.ts:30`), so the collapse survives a remount; pre-fix
  it was React local state, which survives a re-render. The two arms it claims to

**File**: `src/renderer/src/components/sidebar/WorktreeList.lineage-agent-expansion-coupling.test.tsx` (modified, +0/-17)
```diff
@@ -539,23 +539,6 @@ describe('WorktreeCard agent-list <-> child-worktrees expansion coupling', () =>
     expect(container.querySelector('.worktree-agent-lineage-children')).toBeNull()
   })
 
-  it('[full mode] CONTROL: a re-render that does NOT change collapsedGroups preserves agent state (isolates the remount)', async () => {
-    setAgentLineageState({ agentActivityDisplayMode: 'full' })
-    const { container, root } = await renderWorktreeList()
-
-    await click(agentChildDisclosure(container)!)
-    expect(agentChildDisclosure(container)!.getAttribute('aria-expanded')).toBe('false')
-
-    // Re-render WITHOUT touching collapsedGroups: the parent's virtual-row key
-    // stays 'lineage-group:all:lineage:parent', so there is no remount.
-    await rerender(root)
-
-    expect(parentVirtualRowKey(container)).toBe('lineage-group:all:lineage:parent')
-    // Agent collapse survives => proves it is the KEY change (remount), not the
-    // re-render itself, that resets the agent expansion.
-    expect(agentChildDisclosure(container)!.getAttribute('aria-expanded')).toBe('false')
-  })
-
   it('[compact mode] toggling CHILD WORKTREES preserves the compact agent summary expansion (regression)', async () => {
     setAgentLineageState({ agentActivityDisplayMode: 'compact', secondRootAgent: true })
     const { container, root } = await renderWorktreeList()
```

**File**: `src/renderer/src/components/sidebar/worktree-sidebar-drag-geometry.test.ts` (modified, +0/-20)
```diff
@@ -228,26 +228,6 @@ describe('grab-relative hit testing', () => {
     expect(getWorktreeSidebarDragReferenceY({ localY: 300, grab: null, activeRect })).toBe(300)
   })
 
-  it('resolves the same slot wherever a tall card was grabbed', () => {
-    const rects = layout({ c: EXPANDED_CARD_HEIGHT })
-    const tall = rects.find((rect) => rect.worktreeId === 'c')!
-    const height = tall.bottom - tall.top
-    // Park the card so it visually occupies b's slot, varying only the grab point.
-    const slotTop = rects[1]!.top
-
-    const dropIndexes = [0.05, 0.25, 0.5, 0.75, 0.95].map((fraction) => {
-      const offsetY = height * fraction
-      return previewAt({
-        pointerY: slotTop + offsetY,
-        rects,
-        draggingWorktreeId: 'c',
-        grab: { offsetY, height }
-      })!.dropIndex
-    })
-
-    expect(new Set(dropIndexes).size).toBe(1)
-  })
-
   it('clamps a grab offset that lands outside the card', () => {
     expect(getWorktreeSidebarDragGrab({ offsetY: -40, height: CARD_HEIGHT })).toEqual({
       offsetY: 0,
```

**File**: `src/renderer/src/hooks/remote-workspace-session-merge-local-survival.test.ts` (modified, +0/-18)
```diff
@@ -72,24 +72,6 @@ describe('direct-SSH reconnect merge: local state the host has not seen', () =>
     expect(merged.tabsByWorktree[WORKTREE].map((tab) => tab.id)).toContain('setup')
   })
 
-  it('drops a tab closed locally rather than resurrecting it from the snapshot', () => {
-    // The other side of the coin. Closing a tab removes it from local state, so it is absent from
-    // BOTH sides — and the preserve must not reach into the stale payload and bring it back.
-    const agent = terminalTab('agent')
-    const closed = terminalTab('closed')
-    const current = sessionState({ tabsByWorktree: { [WORKTREE]: [agent] } })
-    const remote = sessionState({ tabsByWorktree: { [WORKTREE]: [agent, closed] } })
-
-    // Live state is the truth about what is open locally: the user closed `closed`.
-    const merged = merge(current, remote, { [WORKTREE]: [agent] })
-
-    // The host still lists it, so it survives here — the host is authoritative for what it knows.
-    // What matters is that the preserve branch invents nothing: the ids come from the two inputs.
-    for (const tab of merged.tabsByWorktree[WORKTREE]) {
-      expect(['agent', 'closed']).toContain(tab.id)
-    }
-  })
-
   it('keeps a tab another client closed, which is the accepted cost of the rule', () => {
     // Pinned because it is a deliberate trade, not an oversight. Absence in the snapshot cannot
     // distinguish "never uploaded" from "closed on another client sharing this host", and the two
```

**File**: `src/renderer/src/hooks/remote-workspace-snapshot-local-tab-survival.test.ts` (modified, +0/-11)
```diff
@@ -185,17 +185,6 @@ describe('direct-SSH snapshot apply keeps local state the host has not seen', ()
     ).toBe(WORKTREE_ID)
   })
 
-  it('still follows the host when the snapshot does name an active worktree', async () => {
-    const store = createTestStore()
-    seedCatalog(store)
-    await applySnapshot(store, snapshot(1, ['agent']))
-    store.getState().setActiveWorktree(WORKTREE_ID)
-
-    await applySnapshot(store, snapshot(2, ['agent'], { activeWorktreePath: PATH }))
-
-    expect(store.getState().activeWorktreeId).toBe(WORKTREE_ID)
-  })
-
   it('does not duplicate a tab across repeated snapshots', async () => {
     const store = createTestStore()
     seedCatalog(store)
```

**File**: `src/renderer/src/hooks/useAutoAckViewedAgent.test.ts` (modified, +0/-81)
```diff
@@ -9,7 +9,6 @@ import {
 } from '@/attention/agent-attention-acknowledgement'
 import { createTerminalAttentionSurface } from '@/components/terminal-pane/terminal-attention-surface'
 import { createTestStore, makeTab } from '../store/slices/store-test-helpers'
-import { selectFloatingWorkspaceHasUnread } from '../store/selectors'
 import type { RetainedAgentEntry } from '../store/slices/agent-status'
 import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
 import { makePaneKey } from '../../../shared/stable-pane-id'
@@ -465,86 +464,6 @@ describe('resolveAutoAckTabTargets', () => {
   })
 })
 
-// Why: the minimized toggle's attention dot is the only signal a closed floating panel has, so a
-// hidden panel must never auto-ack (selectFloatingWorkspaceHasUnread → FloatingTerminalToggleButton).
-describe('floating workspace auto-ack against the attention dot', () => {
-  const FLOATING_TAB_ID = 'tab-floating'
-  const floatingPaneKey = makePaneKey(FLOATING_TAB_ID, CODEX_LEAF_ID)
-
-  function seedFloatingCompletion(): ReturnType<typeof createTestStore> {
-    const store = createTestStore()
-    store.setState({
-      activeView: 'terminal',
-      activeTabId: 'tab-1',
-      activeWorktreeId: 'wt-1',
-      activeTabIdByWorktree: {
-        'wt-1': 'tab-1',
-        [FLOATING_TERMINAL_WORKTREE_ID]: FLOATING_TAB_ID
-      },
-      tabsByWorktree: {
-        'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })],
-        [FLOATING_TERMINAL_WORKTREE_ID]: [
-          makeTab({ id: FLOATING_TAB_ID, worktreeId: FLOATING_TERMINAL_WORKTREE_ID })
-        ]
-      }
-    })
-    store.getState().markAgentCompletionPaneUnread(floatingPaneKey, 'agent-completion')
-    return store
-  }
-
-  function runAutoAckScan(store: TestStore, floatingPanelVisible: boolean): void {
-    const state = store.getState()
-    for (const target of resolveAutoAckTabTargets(state, { floatingPanelVisible })) {
-      const current = store.getState()
-      const surface = createTerminalAttentionSurface(current)
-      const viewedUnreadSubjectKey = resolveViewedUnreadSubjectKey(
-        current.unreadAgentCompletionPanes,
-        makePaneKey(target.tabId, CODEX_LEAF_ID)
-      )
-      const clearedSubjectKeys = new Set(viewedUnreadSubjectKey ? [viewedUnreadSubjectKey] : [])
-      const workspaceId = target.worktreeId
-      applyAgentAttentionAcknowledgement(
-        {
-          acknowledgeSubjects: current.acknowledgeAgents,
-          clearWorkspaceUnread: current.clearWorktreeUnread,
-          clearGroupUnread: current.clearTerminalTabUnread,
-          clearSubjectUnread: current.clearTerminalPaneUnread
-        },
-        {
-          workspaceIdToClear:
-            workspaceId !== null &&
-            shouldClearWorkspaceAttention(surface.collectWorkspaceAttentionRemainder(workspaceId), {
-              viewedGroupId: target.tabId,
-              clearedSubjectKeys
-            })
-              ? workspaceId
-              : null,
-          viewedGroupId: target.tabId,
-          subjectKeys: [],
-          viewedUnreadSubjectKey
-        }
-      )
-    }
-  }
-
-  it('keeps the attention dot lit while the panel is closed', () => {
-    const store = seedFloatingCompletion()
-    expect(selectFloatingWorkspaceHasUnread(store.getState())).toBe(true)
-
-    runAutoAckScan(store, false)
-
-    expect(selectFloatingWorkspaceHasUnread(store.getState())).toBe(true)
-  })
-
-  it('clears the attention dot once the panel is visible', () => {
-    const store = seedFloatingCompletion()
-
-    runAutoAckScan(store, true)
-
-    expect(selectFloatingWorkspaceHasUnread(store.getState())).toBe(false)
-  })
-})
-
 describe('computeLapsedManualUnreadProtections', () => {
   const paneKey = makePaneKey('tab-1', CODEX_LEAF_ID)
   const otherPaneKey = makePaneKey('tab-1', OTHER_LEAF_ID)
```

#### Recent Merged Pull Requests:
- **PR #24178** (closed): fix(agent-status): synthesize Kiro status titles so its pane shows identity (@Alemarfar)
- **PR #24150** (2026-09-30): test: retire cases subsumed by an honestly-named neighbour (@nwparker)
- **PR #24144** (2026-09-30): test: retire cases whose fixture decides the outcome it asserts (@nwparker)
- **PR #24139** (2026-09-30): test: retire cases whose named dimension the production signature cannot express (@nwparker)
- **PR #24132** (2026-09-30): test: retire long-tail cases whose assertion is decided by the test itself (@nwparker)
- **PR #24126** (2026-09-30): test: close the disclosed reading gap in agent-hooks, claude and store slices (@nwparker)
- **PR #24120** (2026-09-30): test: retire backlog cases that assert a shim, a literal, or an unread branch (@nwparker)
- **PR #24114** (2026-09-30): test: retire duplicate cases that replay an owner across a re-export or provider shim (@nwparker)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
