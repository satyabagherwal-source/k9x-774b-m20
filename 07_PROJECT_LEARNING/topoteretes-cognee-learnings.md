> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/topoteretes-cognee-learnings.md`  
> **Source**: github ([https://github.com/topoteretes/cognee](https://github.com/topoteretes/cognee))  
> **Source Version**: `525b1d11`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T13:28:46.255Z  
> **Learning ID**: `learn-github-topoteretes-cognee`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): topoteretes/cognee

> **Canonical Artifact**: `07_PROJECT_LEARNING/topoteretes-cognee-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/topoteretes/cognee](https://github.com/topoteretes/cognee))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-30T13:28:45.196Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `topoteretes/cognee`
- **Description**: Cognee is the open-source AI memory platform for agents. Give your AI agents persistent long-term memory with small models for free
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 32919 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useAwaitingDataset.ts`
```
"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useCogniInstance, useTenant } from "@/modules/tenant/TenantProvider";
import pollDatasetStatus, {
  DatasetProcessingError,
  InsufficientCreditsProcessingError,
} from "@/modules/datasets/pollDatasetStatus";
import { INSUFFICIENT_CREDITS_PROCESSING_MESSAGE } from "@/app/(app)/datasets/processingErrorMessage";
import { datasetStatusQueryKey } from "@/modules/datasets/useDatasetStatuses";
import { getAwaitingDataset, clearAwaitingDataset } from "@/utils/browserStorage";

/**
 * Returns true while a freshly-provisioned default dataset (handed off from
 * onboarding via sessionStorage) is still processing.
 *
 * Any error or a missing dataset resolves to false so the UI is never blocked
 * indefinitely. A 30s safety timeout also guards against a pod that's still
 * starting (cogniInstance null) when this hook first runs.
 */
export function useAwaitingDataset(): boolean {
  const { cogniInstance } = useCogniInstance();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [awaiting, setAwaiting] = useState<boolean>(() => getAwaitingDataset() !== null);

  useEffect(() => {
    const datasetId = getAwaitingDataset();
    if (!datasetId) return;

    let cancelled = false;
    // Set once the safety timeout gives up, so a slower pipeline rejection
    // that arrives afterward (pollDatasetStatus's own timeout is 10 minutes)
    // doesn't surface a "processing failed" toast for a wait the dashboard
    // already stopped tracking minutes earlier.
    let gaveUpEarly = false;
    const clear = () => {
      if (cancelled) return;
      clearAwaitingDataset();
      setAwaiting(false);
    };

    // Safety net: never block the dashboard longer than 30s regardless of pod
    // state. If cogniInstance is null (pod still starting), the poll below
    // never runs — this timeout prevents that deadlock.
    const safetyTimeout = setTimeout(() => {
      gaveUpEarly = true;
      clear();
    }, 30_000);

    if (!cogniInstance) {
      return () => {
        cancelled = true;
        clearTimeout(safetyTimeout);
      };
    }

    pollDatasetStatus(datasetId, cogniInstance, { intervalMs: 5000 })
      .finally(() => queryClient.invalidateQueries({ queryKey: datasetStatusQueryKey(tenant?.tenant_id) }))
      .then(clear, (err: unknown) => {
        // The dashboard must unblock either way, but a failed pipeline is not
        // a silent event — the user was told their dataset is being prepared.
        if (!cancelled && !gaveUpEarly) {
          notifications.show({
            color: "red",
            title: err instanceof InsufficientCreditsProcessingError ? "Out of LLM budget" : "Dataset processing failed",
            message:
              err instanceof InsufficientCreditsProcessingError
                ? INSUFFICIENT_CREDITS_PROCESSING_MESSAGE
                : err instanceof DatasetProcessingError
                ? "Your dataset could not be processed. Try uploading it again."
                : "We could not confirm your dataset finished processing. Check the Datasets page for its status.",
          });
        }
        clear();
      });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimeout);
    };
  }, [cogniInstance, tenant?.tenant_id, queryClient]);

  return awaiting;
}

```

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useChecklistCompletionTracking.ts`
```
"use client";

import { useEffect, useMemo, useRef } from "react";
import { trackEvent } from "@/modules/analytics";
import type { Agent } from "@/ui/layout/FilterContext";
import type { PipelineRun, SessionRow } from "@/modules/sessions/getSessions";

export interface ChecklistCompletion {
  upload_document: boolean;
  first_query: boolean;
  connect_agent: boolean;
}

interface ChecklistCompletionInput {
  runs: PipelineRun[];
  sessions: SessionRow[];
  agents: Agent[];
  /** True while telemetry (runs/sessions) has not yet produced a trustworthy
   *  answer — still loading, or errored. Gates `upload_document`/`first_query`
   *  only: those two never read the agent roster. */
  telemetryNotReady: boolean;
  /** Same idea for the agent roster. A pod that has not allowlisted
   *  `GET /v1/activity/agents` answers 404 forever — no retry, no poll — so
   *  this can stay true for the life of the page, and it must not also block
   *  the other two items. */
  agentsNotReady: boolean;
}

/**
 * Fires `checklist_item_completed` once per item, the moment it first
 * becomes true — never on a render where it is already true, and never for
 * an item whose own source has not actually answered yet.
 *
 * Each item is seeded and tracked independently rather than as one atomic
 * snapshot: `upload_document`/`first_query` read runs/sessions, `connect_agent`
 * reads the agent roster, and gating all three on whichever source is slowest
 * (or permanently erroring) either goes dark for events that had nothing to
 * do with the failure or seeds the wrong one off an empty array — a workspace
 * that finished an item long ago then fires a spurious completion on the next
 * successful poll of the OTHER source. See OverviewPage for the two concrete
 * failure modes this was written against.
 */
export function useChecklistCompletionTracking(input: ChecklistCompletionInput): void {
  const { runs, sessions, agents, telemetryNotReady, agentsNotReady } = input;

  const checklistDone: ChecklistCompletion = useMemo(() => ({
    // Only a real pipeline run (upload/cognify) counts here — operation rows
    // (recall/search/remember/etc., kind: "operation") mean the agent talked
    // to memory, not that anything was uploaded.
    upload_document: runs.some((r) => r.kind === "pipeline"),
    first_query: sessions.length > 0,
    connect_agent: agents.some((a) => a.is_agent && !a.is_default),
  }), [runs, sessions, agents]);

  const prev = useRef<Partial<ChecklistCompletion>>({});

  useEffect(() => {
    if (!telemetryNotReady) {
      if (prev.current.upload_document === undefined) {
        prev.current.upload_document = checklistDone.upload_document;
        prev.current.first_query = checklistDone.first_query;
      } else {
        if (checklistDone.upload_document && !prev.current.upload_document) {
          trackEvent({ pageName: "Dashboard", eventName: "checklist_item_completed", additionalProperties: { item: "upload_document" } });
        }
        if (checklistDone.first_query && !prev.current.first_query) {
          trackEvent({ pageName: "Dashboard", eventName: "checklist_item_completed", additionalProperties: { item: "first_query" } });
        }
        prev.current.upload_document = checklistDone.upload_document;
        prev.current.first_query = checklistDone.first_query;
      }
    }
    if (!agentsNotReady) {
      if (prev.current.connect_agent === undefined) {
        prev.current.connect_agent = checklistDone.connect_agent;
      } else {
        if (checklistDone.connect_agent && !prev.current.connect_agent) {
          trackEvent({ pageName: "Dashboard", eventName: "checklist_item_completed", additionalProperties: { item: "connect_agent" } });
        }
        prev.current.connect_agent = checklistDone.connect_agent;
      }
    }
  }, [checklistDone, telemetryNotReady, agentsNotReady]);
}

```

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useConnectedIntegrations.ts`
```
"use client";

import { useState, useEffect } from "react";
import { AGENT_CHANNEL_NAMES, channelForSessionId } from "@/modules/sessions/getSessions";
import type { SessionRow } from "@/modules/sessions/getSessions";
import {
  AGENT_INTEGRATION_BY_KEY,
  AGENT_INTEGRATION_DEFS,
  connectionIntegrationKey,
} from "@/modules/agents/getAgentConnections";
import type { AgentConnection } from "@/modules/agents/getAgentConnections";
import {
  getConnectedIntegrations,
  setConnectedIntegrations as persistConnectedIntegrations,
} from "@/utils/browserStorage";

/** The integration card keys this hook can report on. Cards keep their own
 *  slugs — AGENT_INTEGRATION_DEFS.key — because that is what is already
 *  persisted in users' browsers. */
export const INTEGRATION_KEYS: readonly string[] = AGENT_INTEGRATION_DEFS.map((def) => def.key);

// Stable reference for callers that don't have a connections list yet — a
// fresh `[]` on every render would re-run the effect below every render for
// no reason, since nothing in it depends on the array's identity otherwise.
const NO_CONNECTIONS: AgentConnection[] = [];

/**
 * Derives and persists which agents and integrations have ever reached this
 * tenant, keyed both by channel name (for the memory graph) and by integration
 * slug (for the Integrations cards).
 *
 * Sticky per tenant via localStorage, and that stickiness is load-bearing
 * rather than a nicety: the polled session page is scoped to the dashboard's
 * range toggle and capped at 50 rows, and the deployed pod caps it again on
 * its own side. A busy workspace pushes an agent's last session off that page
 * within the hour, and without a persisted answer the graph would then report
 * an installed agent as never connected.
 *
 * `connections` is optional and additive: a plugin registration alone (no
 * session or memory write yet) is real evidence a card should read
 * "Connected", ahead of what `sessions` can prove. Passing none keeps this
 * hook's session-only behavior for callers that haven't wired the endpoint up.
 */
export function useConnectedIntegrations(
  sessions: SessionRow[],
  tenantId: string | null,
  connections: AgentConnection[] = NO_CONNECTIONS,
): Record<string, boolean> {
  const [connectedIntegrations, setConnectedIntegrations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!tenantId) return;
    const persisted = getConnectedIntegrations(tenantId);
    const next = { ...persisted };
    const seen = new Set(sessions.map((s) => channelForSessionId(s.session_id)));
    for (const name of AGENT_CHANNEL_NAMES) {
      if (seen.has(name)) next[name] = true;
    }
    for (const def of AGENT_INTEGRATION_DEFS) {
      if (seen.has(def.channel)) next[def.key] = true;
    }
    for (const connection of connections) {
      const key = connectionIntegrationKey(connection);
      const def = key ? AGENT_INTEGRATION_BY_KEY.get(key) : undefined;
      if (!def) continue;
      next[def.key] = true;
      next[def.channel] = true;
    }
    if (JSON.stringify(next) !== JSON.stringify(persisted)) {
      persistConnectedIntegrations(tenantId, next);
    }
    setConnectedIntegrations((prev) =>
      JSON.stringify(prev) !== JSON.stringify(next) ? next : prev,
    );
  }, [sessions, connections, tenantId]);

  return connectedIntegrations;
}

```

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useCreditsBanner.ts`
```
"use client";

import { useState, useCallback } from "react";
import { useTenant } from "@/modules/tenant/TenantProvider";
import { useCreditsBalance, getTenantRemainingUsd } from "@/modules/billing/useCreditsBalance";
import { isCreditsBannerDismissed, dismissCreditsBanner } from "@/utils/browserStorage";

export interface CreditsBannerState {
  creditsRemainingUsd: number | null;
  /** True when balance < $5. */
  showLowBalanceBanner: boolean;
  /** True when the low-balance banner is not active. */
  showVoucherBanner: boolean;
  dismiss: () => void;
}

const LOW_BALANCE_THRESHOLD_USD = 5;

/**
 * Fetches credit usage and tracks banner visibility.
 *
 * Only one banner may show at a time — priority:
 *   1. Low-balance banner (< $5)
 *   2. Voucher banner (promotional)
 */
export function useCreditsBanner(): CreditsBannerState {
  const { tenant } = useTenant();
  const { data: overview } = useCreditsBalance(true);
  const [dismissed, setDismissed] = useState<boolean>(isCreditsBannerDismissed);

  const creditsRemainingUsd = getTenantRemainingUsd(overview, tenant?.tenant_id ?? null);

  const isLowBalance = creditsRemainingUsd !== null && creditsRemainingUsd < LOW_BALANCE_THRESHOLD_USD;
  const showLowBalanceBanner = !dismissed && isLowBalance;
  const showVoucherBanner = !isLowBalance;

  const dismiss = useCallback(() => {
    dismissCreditsBanner();
    setDismissed(true);
  }, []);

  return {
    creditsRemainingUsd,
    showLowBalanceBanner,
    showVoucherBanner,
    dismiss,
  };
}

```

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useDashboardTelemetry.ts`
```
"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useCogniInstance, useTenant } from "@/modules/tenant/TenantProvider";
import { useFilter } from "@/ui/layout/FilterContext";
import { listSessions, normalizeActivityRows } from "@/modules/sessions/getSessions";
import type { PipelineRun, SessionRow, TimeRange } from "@/modules/sessions/getSessions";
import getAgentConnections from "@/modules/agents/getAgentConnections";
import type { AgentConnection } from "@/modules/agents/getAgentConnections";
import { useCircuitBreaker } from "@/modules/query/useCircuitBreaker";

const TELEMETRY_POLL_INTERVAL_MS = 15_000;
// Background polls get extra headroom because local/loaded pods can take several
// seconds per request (COG-5722) — we don't want a slow pod surfacing as a false
// error while it's still working.
const BACKGROUND_POLL_TIMEOUT_MS = 25_000;
// CostPanel and the Analytics breakdown *aggregate* this feed across the whole
// selected range, so a page-size cap silently truncates their totals rather
// than just their lists, and operation rows now compete with pipeline runs for
// the same slots. 500 is the documented maximum.
//
// It is inert on every released cognee up to and including v1.5.3, which
// hardcodes LIMIT 50 with no `limit` parameter — FastAPI ignores an unknown
// query param, so today all three callers cap at 50. A range busier than 500
// would still need server-side aggregation, which the endpoint does not offer
// (it returns a bare array with no total).
const RUNS_LIMIT = 500;
const SESSIONS_LIMIT = 50;
// Same reasoning as RUNS_LIMIT: `connections` answers "has this agent EVER
// registered" for the sticky registry, and the endpoint's own default (50,
// `le=500`) silently truncated that to the newest 50 registrations. On a
// workspace with more churn than that, an agent's one-and-only registration
// falls off the page and useConnectedIntegrations reads it as never connected
// — the registry has no other way to find out. This is the endpoint's
// documented maximum, not a page we then loop past; see connectionsTruncated
// below for what happens on a tenant busy enough to still overflow it.
const CONNECTIONS_LIMIT = 500;
/** The widest window the endpoint understands. The page size is the real bound
 *  either way, so asking for less only narrows what the local slices can see. */
const SESSIONS_RANGE: TimeRange = "all";
/**
 * Page size every released cognee up to and including 1.5.3 hardcodes, ignoring
 * the `limit` we send. Verified against the router source: 1.5.3 does
 * `.limit(50)` with no `limit` parameter, and 1.5.4 is the first build to accept
 * `limit: int = Query(50, ge=1, le=500)`.
 *
 * Both numbers matter, because truncation has to be measured against the page
 * the pod actually returned rather than against what we asked for. Comparing
 * `runs.length` to RUNS_LIMIT alone made the flag permanently false on every pod
 * in production, and with it the Analytics "Partial totals" banner and the Cost
 * panel's "at least" qualifier — the two disclosures that exist for exactly this
 * cap. 1.5.4's own docstring states the rule: `len(results) == limit` means
 * another page may exist.
 */
const RUNS_POD_HARDCODED_LIMIT = 50;

export interface DashboardTelemetry {
  runs: PipelineRun[];
  sessions: SessionRow[];
  /** Plugin registrations, polled on the same cadence as runs/sessions so the
   *  sticky per-tenant registry (useConnectedIntegrations) never disagrees
   *  with a tutorial reading the same endpoint about whether an agent has
   *  ever registered. Registration only, not liveness: the pod's connection
   *  `status` sticks at "active" after a crash (nothing ever clears it but
   *  the plugin's own unregister call), so agentStatus's "live" state is
   *  session-only and does not read this. Empty on a failed fetch; there is
   *  no separate `connectionsFailed` flag because nothing here downgrades the
   *  page for it, the registry just falls back to sessions alone. */
  connections: AgentConnection[];
  /** The connections endpoint returned a full page (has_more), so a
   *  registration older than the newest CONNECTIONS_LIMIT may not be in
   *  `connections`. Absent evidence, not negative evidence: nothing here (or
   *  in useConnectedIntegrations, whose sticky registry answers the same
   *  question) infers "never connected" from a row's absence on a truncated
   *  page. Exposed for a caller that needs to say so rather than invent copy
   *  no design has asked for yet. */
  connectionsTruncated: boolean;
  loading: boolean;
  /** The fetch failed. Exposed because an empty runs/sessions after a failure
   *  is indistinguishable from an empty workspace, and every panel that reads
   *  this feed was reporting the second when it meant the first. */
  error: boolean;
  /** The sessions half was unreachable while the runs half answered.
   *
   *  Separate from `error` because listSessions never rejects — it swallows and
   *  flags — so `isError` is false on this path and a full /v1/sessions outage
   *  read as an empty workspace. That is the exact outcome FAILED_PAGE exists
   *  to prevent, and until now this hook was throwing the flag away. */
  sessionsFailed: boolean;
  /** The mirror image: sessions answered but the runs half did not. Both halves
   *  now degrade the same way — see useActivityFeed, which this now matches. A
   *  runs failure used to discard a perfectly good sessions half via
   *  Promise.all and report a total outage: every memory-graph agent read
   *  "disconnected" though /v1/sessions had just answered. */
  runsFailed: boolean;
  /** The runs endpoint returned a full page, so there is very likely more
   *  activity in this range than these totals account for.
   *
   *  Every consumer of this feed AGGREGATES it, so the page-size cap truncates
   *  their numbers and not just their lists — and until now nothing reported
   *  that, which made a capped total indistinguishable from a complete one. */
  runsTruncated: boolean;
  /** Rows the endpoint actually returned. What the notice should quote: the
   *  limit we request is ignored by every pod before 1.5.4. */
  runsReturned: number;
  /** Same for the sessions half. `sessionsTotal` is null when the pod did not
   *  say how many it holds — older images return a bare array. */
  sessionsTruncated: boolean;
  sessionsShown: number;
  sessionsTotal: number | null;
  /** Epoch ms of the last successful fetch, 0 before the first one. What an
   *  "Updated Xs ago" label reads, so a stale panel can be recognised as one. */
  updatedAt: number;
  /** A refetch over data already on screen. `loading` is only the first load,
   *  so without this a Refresh control can report nothing. */
  refreshing: boolean;
  refetch: () => void;
}

/**
 * The shared activity feed, always at its widest.
 *
 * It took a range, and that parameter was the whole of CLO-722: passing a
 * panel's toggle into it re-scoped every other consumer of the feed, and the
 * Analytics page then reintroduced the same mistake in a new shape, blanking
 * itself to a skeleton on each flip to refetch a payload that cannot differ
 * (the runs endpoint takes no time filter at all).
 *
 * So there is no range to pass. Every consumer slices this locally, one cache
 * entry per tenant serves the whole app, and a toggle flip costs nothing. That
 * is a stronger guarantee than any test of the old call sites could give,
 * because the mistake is no longer expressible.
 */
export function useDashboardTelemetry(): DashboardTelemetry {
  const { cogniInstance, isInitializing } = useCogniInstance();
  const { tenant, tenantReady } = useTenant();
  const { loading: filterLoading } = useFilter();

  const telemetryBreaker = useCircuitBreaker(TELEMETRY_POLL_INTERVAL_MS);

  const telemetryQuery = useQuery({
    queryKey: ["dashboard-telemetry", tenant?.tenant_id ?? null],
    queryFn: async ({ signal }) => {
      if (!cogniInstance) throw new Error("cogniInstance unavailable");
      const init: RequestInit & { timeoutMs?: number } = { signal, timeoutMs: BACKGROUND_POLL_TIMEOUT_MS };
      // allSettled, not all — matching useActivityFeed. A rejected runs half
      // used to take the whole query down via Promise.all and throw away a
      // sessions half that had already answered.
      const [runsResult, sessionsResult, connectionsResult] = await Promise.allSettled([
        // The client rejects on any non-ok status before this resolves; the
        // failure left to guard is a 200 carrying an error envelope, which
        // normalizeActivityRows throws on rather than coercing to [].
        cogniInstance.fetch(`/v1/activity/pipeline-runs?limit=${RUNS_LIMIT}`, init).then((r) => r.json() as Promise<unknown>),
        listSessions(cogniInstance, { range: SESSIONS_RANGE, limit: SESSIONS_LIMIT }, { signal, timeoutMs: BACKGROUND_POLL_TIMEOUT_MS }),
        // range "all" and activeOnly false, not a freshness window: this feed
        // only ever answers "has this agent EVER registered" (for the sticky
        // registry, see the `connections` field above), so a connection that
        // is old or already unregistered still has to count. A narrower range
        // or active-only filter would suit "is it live right now", which is
        // exactly the question this feed does not answer.
        getAgentConnections(
          cogniInstance,
          { range: "all", activeOnly: false, includeSources: false, limit: CONNECTIONS_LIMIT },
          { signal, timeoutMs: BACKGROUND_POLL_TIMEOUT_MS },
        ),
      ]);

      signal.throwIfAborted();

      // Read rather than discarded. normalizeActivityRows throws a named
      // diagnostic for a 200 carrying an error envelope, and react-query holds
      // that rejection in state nothing reads — so the one failure the shared
      // client logs as a SUCCESS was inv
```

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useDataSourceStatuses.ts`
```
"use client";

import { useEffect, useState } from "react";
import getConnectionStatus from "@/modules/integrations/getConnectionStatus";
import getConnectorCatalog from "@/modules/integrations/getConnectorCatalog";
import { DATA_SOURCE_CARDS } from "@/modules/integrations/dataSourceCards";
import { isOffered } from "@/modules/integrations/connectorAvailability";
import type { NodeStatus } from "@/app/(app)/dashboard/partials/redesign/MemoryFlowDiagram";

/**
 * The graph's own statuses plus one it never draws: "absent" is a framework
 * connector this deployment does not ship, which the graph leaves out rather
 * than showing as disconnected forever.
 */
export type DataSourceNodeStatus = NodeStatus | "absent";

async function readNodeStatus(provider: string, tenantId: string): Promise<NodeStatus> {
  try {
    const status = await getConnectionStatus(provider, tenantId);
    return status.connected || status.viaRouting ? "connected" : "disconnected";
  } catch (e: unknown) {
    console.warn(`[dashboard] connection status failed for ${provider}:`, e);
    return "disconnected";
  }
}

/**
 * Connection status per data-source provider, from the control-plane's
 * connection records — the same source the Integrations page reads. Providers
 * come from DATA_SOURCE_CARDS, so a connector added there appears in the
 * memory graph without touching this hook.
 *
 * A tenant that only receives channels routed from another workspace's install
 * still counts as connected: memory is flowing in either way. A failed read
 * stays "disconnected" — the graph has no third state, and the Integrations
 * page is where a degraded connection gets explained properly.
 *
 * The catalog is read first, and a framework provider it does not list is
 * never asked for: the backend has no routes for it, so the read could only
 * 404 into a node nobody here can connect (review-reported). A failed
 * catalog read asks for everything, as before — a failed read must not hide
 * a live connector.
 */
export function useDataSourceStatuses(providers: string[], tenantId: string | null): Record<string, DataSourceNodeStatus> {
  const [statuses, setStatuses] = useState<Record<string, DataSourceNodeStatus>>({});
  // Providers is a fresh array each render; the joined key keeps the effect from
  // refiring on identity alone.
  const providerKey = providers.join(",");

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) {
      setStatuses({});
      return;
    }
    const list = providerKey === "" ? [] : providerKey.split(",");
    void getConnectorCatalog()
      .then((catalog) =>
        Promise.all(
          list.map(async (provider): Promise<[string, DataSourceNodeStatus]> => {
            const cfg = DATA_SOURCE_CARDS.find((card) => card.key === provider);
            if (cfg && isOffered(cfg, catalog) === false) return [provider, "absent"];
            return [provider, await readNodeStatus(provider, tenantId)];
          }),
        ),
      )
      .then((entries) => {
        if (!cancelled) setStatuses(Object.fromEntries(entries));
      });
    return () => { cancelled = true; };
  }, [providerKey, tenantId]);

  return statuses;
}

```

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useDatasetUpload.ts`
```
"use client";

import { useState, useCallback } from "react";
import { notifications } from "@mantine/notifications";
import { useCogniInstance } from "@/modules/tenant/TenantProvider";
import { useFilter } from "@/ui/layout/FilterContext";
import type { Dataset } from "@/ui/layout/FilterContext";
import { trackEvent } from "@/modules/analytics";
import { MAX_FILES_PER_UPLOAD } from "@/modules/ingestion/uploadLimits";
import { useBrainUpload } from "@/modules/ingestion/useBrainUpload";
import createDataset from "@/modules/datasets/createDataset";
import { describeProcessingError } from "@/app/(app)/datasets/processingErrorMessage";
import { loadGraphModelsConfig } from "@/modules/configuration/userConfiguration";
import buildCognifyOptions from "@/modules/configuration/buildCognifyOptions";

export interface UploadDoneState {
  datasetName: string;
  datasetId: string;
}

export interface DatasetUploadState {
  isUploading: boolean;
  showDatasetPicker: boolean;
  pendingFiles: File[];
  showUploadDoneModal: UploadDoneState | null;
  setShowDatasetPicker: (open: boolean) => void;
  setPendingFiles: (files: File[]) => void;
  setShowUploadDoneModal: (state: UploadDoneState | null) => void;
  handleDashboardUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePickDataset: (ds: Dataset) => Promise<void>;
}

export function useDatasetUpload(): DatasetUploadState {
  const { cogniInstance } = useCogniInstance();
  const { datasets, setSelectedDataset, refreshDatasets } = useFilter();
  const { isUploading, upload } = useBrainUpload(cogniInstance);

  const [showDatasetPicker, setShowDatasetPicker] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showUploadDoneModal, setShowUploadDoneModal] = useState<UploadDoneState | null>(null);

  async function uploadToDataset(ds: Dataset, files: File[]): Promise<void> {
    if (!cogniInstance) return;

    const showUploadFailed = (error: unknown): void => {
      console.error("Dashboard upload failed:", error);
      notifications.show({
        title: "Upload failed",
        message: error instanceof Error ? error.message : String(error),
        color: "red",
      });
    };

    // Graph-model / prompt / ontology assignments are best-effort enrichment;
    // if the config can't be read, fail the upload the same way the old inline
    // flow did (it ran this inside the upload try/catch).
    let options;
    try {
      options = buildCognifyOptions(await loadGraphModelsConfig(cogniInstance), ds.id);
    } catch (error) {
      showUploadFailed(error);
      return;
    }

    await upload({
      datasetId: ds.id,
      files,
      options,
      onLimitExceeded: (selected) =>
        notifications.show({
          title: "Too many files",
          message: `You selected ${selected.length} files. Please upload ${MAX_FILES_PER_UPLOAD} or fewer at a time.`,
          color: "red",
        }),
      onUploadError: showUploadFailed,
      onUploaded: () => {
        trackEvent({
          pageName: "Dashboard",
          eventName: "dashboard_files_uploaded",
          additionalProperties: {
            dataset_id: ds.id,
            dataset_name: ds.name,
            file_count: String(files.length),
          },
        });
        notifications.show({
          title: `Files uploaded to "${ds.name}"`,
          message: `${files.length} file(s) added. Cognify running.`,
          color: "blue",
          autoClose: 5000,
        });
      },
      onProcessed: () => {
        refreshDatasets();
        setShowUploadDoneModal({ datasetName: ds.name, datasetId: ds.id });
      },
      onProcessingError: (error) => {
        console.error("Dataset processing failed:", error);
        refreshDatasets();
        const { title, message, isTimeout } = describeProcessingError(error);
        notifications.show({ title, message, color: isTimeout ? "yellow" : "red" });
      },
    });
  }

  const handleDashboardUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!cogniInstance || !e.target.files?.length) return;
      const files = Array.from(e.target.files);
      e.target.value = "";

      if (datasets.length === 1) {
        await uploadToDataset(datasets[0], files);
        return;
      }
      if (datasets.length === 0) {
        const ds = await createDataset({ name: "default_dataset" }, cogniInstance);
        refreshDatasets();
        await uploadToDataset(ds, files);
        return;
      }
      // Multiple datasets, none selected — let the user pick.
      setPendingFiles(files);
      setShowDatasetPicker(true);
    },
    // uploadToDataset is stable within the render; cogniInstance/datasets/refreshDatasets
    // are the real reactive inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cogniInstance, datasets, refreshDatasets],
  );

  const handlePickDataset = useCallback(
    async (ds: Dataset) => {
      setShowDatasetPicker(false);
      setSelectedDataset(ds);
      trackEvent({
        pageName: "Dashboard",
        eventName: "dashboard_dataset_picked",
        additionalProperties: { dataset_id: ds.id, dataset_name: ds.name },
      });
      await uploadToDataset(ds, pendingFiles);
      setPendingFiles([]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingFiles, setSelectedDataset],
  );

  return {
    isUploading,
    showDatasetPicker,
    pendingFiles,
    showUploadDoneModal,
    setShowDatasetPicker,
    setPendingFiles,
    setShowUploadDoneModal,
    handleDashboardUpload,
    handlePickDataset,
  };
}

```

### Core Architecture Module: `cognee-frontend/src/app/(app)/memory-gap-analysis/hooks/useCoverageRuns.ts`
```
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { trackEvent } from "@/modules/analytics";
import { HttpError } from "@/services/http/errors";
import { useCogniInstance, useTenant } from "@/modules/tenant/TenantProvider";
import { useFilter } from "@/ui/layout/FilterContext";
import isCloudEnvironment from "@/utils/isCloudEnvironment";
import type { Brain, BrainLoadState, CoverageResult } from "@/app/(app)/memory-gap-analysis/types";

/** Why a "Run analysis" click never became a run, and which brain it was for. */
export interface RunStartFailure {
  brainId: string;
  message: string;
}

export interface CoverageRunsOptions {
  /**
   * Caps the fetch to the first `limit` datasets, in the order `useFilter`
   * returns them, and confines `brains` to the same set. Omitted, the hook
   * fetches and tracks every dataset. That is what Memory Gap Analysis needs:
   * the full fan-out, one query per dataset, and it has to keep getting it.
   * The dashboard passes this because its coverage panel only ever renders a
   * handful of rows, so the rest of the workspace's datasets were requests it
   * paid for and never showed.
   */
  limit?: number;
}

interface CoverageRuns {
  /** The workspace's brains, each with its latest run and its own fetch state. */
  brains: Brain[];
  /** True while the workspace's dataset list itself is still loading. */
  loading: boolean;
  /** True when the dataset list could not be fetched at all. */
  unavailable: boolean;
  /** Re-fetches the latest run per brain — the retry behind every error state. */
  refresh: () => void;
  /** Starts a replay-and-judge run for one brain and begins polling it. */
  startRun: (brainId: string) => Promise<void>;
  /** The brain whose POST is in flight right now, if any. */
  startingBrainId: string | null;
  /** Set when the last start attempt was rejected; cleared once it is stale. */
  runError: RunStartFailure | null;
}

// A run replays every distinct question the brain was ever asked, so it takes
// minutes. The backend answers the POST immediately with a pending row and
// does the work in the background; this is how often we ask whether it landed.
const RUN_POLL_INTERVAL_MS = 4_000;
// A cold or loaded pod can be slow to answer (see COG-5722); a background poll
// should not report failure just because the pod took its time.
const COVERAGE_FETCH_TIMEOUT_MS = 25_000;

/**
 * What to tell the user per status, instead of the server's own words.
 *
 * A 401 is not a failed run, it is a session that ended, and rendering the
 * pod's "Not authenticated" under "Couldn't start the run" sends the user
 * looking for a problem with their dataset.
 */
const START_FAILURE_MESSAGE: Record<number, string> = {
  401: "Your session has expired. Reload the page and sign in again.",
  403: "You do not have permission to run analysis on this dataset.",
  404: "This dataset no longer exists.",
  409: "A run is already in progress for this dataset.",
};
// A gateway answers with an HTML page, not a sentence; its markup is never the
// reason we show, and even a plain-text body has to stay one line.
const MAX_SERVER_MESSAGE_LENGTH = 160;

/** Only this page starts runs, so its name is the one on the events. */
const RUN_PAGE_NAME = "MemoryGapAnalysis";

type CoverageQuery = UseQueryResult<CoverageResult | null, Error>;

/** One brain's query, reduced to what the page reads off it. */
interface BrainState {
  result: CoverageResult | null;
  state: BrainLoadState;
  isRunning: boolean;
}

function isInFlight(result: CoverageResult | null | undefined): boolean {
  return result?.run.status === "pending" || result?.run.status === "running";
}

/**
 * One brain's own fetch state — never the page's. A retry after a failure keeps
 * react-query's status on "error" for as long as the refetch runs, so a failed
 * query that is fetching again reads as loading: that is what makes a Retry
 * click visibly do something.
 */
function loadStateFor(query: CoverageQuery | undefined): BrainLoadState {
  if (query === undefined || query.isPending) return "loading";
  if (query.isError) return query.isFetching ? "loading" : "error";
  return "loaded";
}

function startFailureMessage(error: unknown): string {
  if (error instanceof HttpError) {
    const mapped = START_FAILURE_MESSAGE[error.status];
    if (mapped !== undefined) return mapped;
    const body = error.message.trim();
    const usable = body !== "" && !body.startsWith("<") && body.length <= MAX_SERVER_MESSAGE_LENGTH;
    return usable ? body : `The workspace could not start the run (${error.status}).`;
  }
  if (error instanceof Error && error.message.length <= MAX_SERVER_MESSAGE_LENGTH) return error.message;
  return "The workspace could not start the run.";
}

/**
 * Latest coverage run per brain, for the Memory Gap Analysis page and the
 * dashboard's Memory Coverage panel. The dashboard passes `limit` to bound it
 * to the rows it actually shows, so opening it does not fetch one query per
 * dataset in the whole workspace.
 *
 * Both halves are real: the brain list is the tenant's datasets, and each
 * brain's result comes from `GET /v1/datasets/{id}/coverage` on the tenant
 * pod. A brain that has never been scored returns null rather than an error,
 * which is what the page's empty state reads.
 *
 * While a run is pending or running the query polls, so the page fills in on
 * its own once the backend finishes — the user does not have to reload.
 *
 * Everything per-brain stays per-brain: one dataset's failed fetch or running
 * run says nothing about the others, and reporting either page-wide is what
 * let a partial outage read as healthy (CLO-726).
 */
export function useCoverageRuns(options: CoverageRunsOptions = {}): CoverageRuns {
  const { limit } = options;
  const { datasets, loading, datasetsUnavailable, refreshDatasets } = useFilter();
  const { cogniInstance, isInitializing } = useCogniInstance();
  const { tenantReady } = useTenant();
  const queryClient = useQueryClient();
  const [runError, setRunError] = useState<RunStartFailure | null>(null);
  const [startingBrainId, setStartingBrainId] = useState<string | null>(null);
  // State lands a render late, so a second click inside the same tick would
  // still see `startingBrainId === null`. The ref is what actually guards the
  // POST, and a duplicate run is minutes of replay against the LLM.
  const startingRef = useRef<string | null>(null);

  // The local SDK does not serve the Cloud coverage endpoints.
  const ready = isCloudEnvironment() && !!cogniInstance && !isInitializing && tenantReady;

  // Sliced once and reused below for both the query list and `brains`, rather
  // than calling `.slice(0, limit)` again at each site: two calls in the same
  // render return equal but distinct arrays, which would give `brains`'s own
  // memo below a new dependency every render for no reason. Equal to
  // `datasets` itself, not a copy of it, when `limit` is omitted, so the
  // unbounded call this hook always supported stays on the exact array
  // identity it always had.
  const activeDatasets = useMemo(
    () => (limit === undefined ? datasets : datasets.slice(0, limit)),
    [datasets, limit],
  );

  const brainStates = useQueries({
    queries: activeDatasets.map((dataset) => ({
      queryKey: ["coverage-run", dataset.id],
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<CoverageResult | null> => {
        if (!cogniInstance) throw new Error("cogniInstance unavailable");
        const init: RequestInit & { timeoutMs?: number } = { signal, timeoutMs: COVERAGE_FETCH_TIMEOUT_MS };
        // The pod client rejects on any non-2xx (services/http/client), so a
        // failed fetch is already this query's error — there is no non-ok
        // Response to check for here.
        const response = await cogniInstance.fetch(`/v1/datasets/${dataset.id}/coverage`, init);
        // The endpoint returns null for a brain that has never been scored,
        // which is a valid answer rather than a missing one.
        return (await response.json()) as CoverageResult | null;
      },
      enabled: ready,
      // Poll only while something is actually in flight, so an idle page
      // costs one request per brain rather than one every few seconds.
      refetchInterval: (query: { state: { data?: CoverageResult | null } }) =>
        isInFlight(query.state.data) ? RUN_POLL_INTERVAL_MS : false,
      staleTime: 15_000,
      retry: false,
    })),
    // `useQueries` hands back a new array on every render, which defeated every
    // memo downstream. The combined value is structurally shared, so the
    // derivations below only recompute when a query actually changed.
    combine: (results): BrainState[] =>
      results.map((query) => ({
        result: query.data ?? null,
        state: loadStateFor(query),
        isRunning: isInFlight(query.data),
      })),
  });

  const brains: Brain[] = useMemo(
    () =>
      activeDatasets.map((dataset, index) => ({
        id: dataset.id,
        name: dataset.name,
        result: brainStates[index]?.result ?? null,
        state: brainStates[index]?.state ?? "loading",
        isRunning: brainStates[index]?.isRunning ?? false,
      })),
    [activeDatasets, brainStates],
  );

  // A start failure describes one click on one brain. Once that brain reports a
  // run in flight the POST evidently landed (a slow gateway can reject the
  // response after the pod queued the work), and once the brain is gone the
  // message belongs to nothing at all — a workspace switch used to bring a
  // minutes-old failure back on screen.
  useEffect(() => {
    if (runError === null) return;
    // Existence is asked of the workspace's dataset list, not of `brains`: with
    // `limit` set, `brains` is only the fetched window, and a failure for a
    // dataset outside 
```

### Core Architecture Module: `cognee-frontend/src/app/(setup)/onboarding/hooks/useAgentConnectionDetection.ts`
```
"use client";

import { useCallback, useEffect, useState } from "react";
import type { CogneeInstance } from "@/modules/instances/types";
import { listSessions, SEARCH_SESSION_PREFIX } from "@/modules/sessions/getSessions";
import type { SessionRow } from "@/modules/sessions/getSessions";
import { sessionIntegrationKey } from "@/modules/agents/getAgentConnections";
import type { AgentIntegrationKey } from "@/modules/agents/getAgentConnections";
import { useBoundedPoll } from "@/utils/useBoundedPoll";

// Detects agent activity while either the Upload or Recall step is active,
// by watching for a NEW session (a session_id proves an agent conversation).
// Baselined when the step opens so only activity AFTER that counts.
//
// Used to also watch dataset doc counts, as graph-direct uploads carry no
// session_id. Dropped (CLO-989): GET /v1/datasets/{id}/data/count 405s on at
// least one live pod, and the fallback it triggers (getDatasetDataCount's own
// "list up to 1000 rows and count them" path) ran every poll on top of it,
// twice the pod load of the sessions check for a signal the plugin's own
// SessionStart hook makes redundant anyway, it always opens a session, so
// "first memory saved" never needed the docs path to be reachable.
const POLL_INTERVAL_MS = 7000;
const MAX_POLLS = 85; // ~10 min at 7s

function realSessionIds(rows: { session_id: string }[]): string[] {
  return rows.map((s) => s.session_id).filter((id) => !id.startsWith(SEARCH_SESSION_PREFIX));
}

/** `realSessionIds`, narrowed to sessions this agent's own plugin opened.
 *  Without this, a Codex session opened while the Claude Code tutorial step
 *  is on screen (or a Cursor/Search session with no agent at all) satisfied
 *  the "a new session appeared" check and confirmed the wrong tutorial. */
function ownAgentSessionIds(rows: { session_id: string }[], agent: AgentIntegrationKey): string[] {
  return realSessionIds(rows).filter((id) => sessionIntegrationKey(id) === agent);
}

/** Which signal proved the agent is talking to Cognee. A plain boolean until
 *  there is a second signal worth telling apart in analytics again. */
export type AgentActivitySignal = "session" | null;

export interface AgentActivityState {
  signal: AgentActivitySignal;
  /** Sessions from this hook's own poll, exposed so a caller that also wants
   *  "last seen" or "is it running" (see useAgentConnectionState) doesn't
   *  have to stand up a second sessions poll next to this one. Empty until
   *  the first poll resolves. Keeps refreshing after `signal` is set, until
   *  the poll's bound runs out. */
  sessions: SessionRow[];
  /** True once the bounded poll has run out: `sessions` is then the last
   *  answer, no longer a live one, so nothing should present it as "now". */
  stale: boolean;
}

export function useAgentConnectionDetection(
  cogniInstance: CogneeInstance | null,
  active: boolean,
  agent: AgentIntegrationKey,
  attempt = 0,
): AgentActivityState {
  const [signal, setSignal] = useState<AgentActivitySignal>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const runKey = `${cogniInstance?.instanceId ?? ""}:${agent}:${attempt}`;

  useEffect(() => {
    setSignal(null);
    setSessions([]);
  }, [active, runKey]);

  // A fresh baseline per run, held in a plain closure the way a hand-written
  // poll loop would, useBoundedPoll calls this once when a run starts and
  // reuses the function it returns for every poll in that run.
  const makeCheck = useCallback(() => {
    // Baselined off the first (and, thanks to useBoundedPoll never
    // overlapping checks, only ever one in flight at a time) response for
    // this run. A session that starts after that request left the pod but
    // before it answered is not in this baseline, it becomes "new" on the
    // very next poll instead, which is a bounded, known delay rather than a
    // coin flip between two concurrent requests answering out of order.
    let primed = false;
    const baselineSessionIds = new Set<string>();

    return async (isStopped: () => boolean) => {
      if (!cogniInstance) return;
      const page = await listSessions(cogniInstance, { range: "24h", limit: 50 }).catch((err) => {
        console.warn("Onboarding progress check: sessions fetch failed", err);
        return null;
      });
      if (isStopped() || !page) return;
      // A swallowed failure (see FAILED_PAGE) answers with an empty list, not
      // "there really is nothing here" — priming the baseline off it would
      // baseline as empty, and the very next successful poll would then read
      // every pre-existing session as brand new. Nor may it replace the last
      // good `sessions`, which running/lastSeenAt still read while this poll
      // keeps trying: swapping them for [] would blank both over one blip.
      if (page.failed) return;

      setSessions(page.sessions);
      const ids = ownAgentSessionIds(page.sessions, agent);
      if (!primed) {
        ids.forEach((id) => baselineSessionIds.add(id));
        primed = true;
        return;
      }
      if (ids.some((id) => !baselineSessionIds.has(id))) setSignal("session");
    };
  }, [cogniInstance, agent]);

  // Bounded, not gated on `signal`: the sessions it keeps refreshing are what
  // "running" and "last seen" read while the step stays open, so stopping at
  // the first session would freeze both at that moment. ~10 minutes at 7s
  // still caps the load for a tab nobody closes; `stale` says when it ran out.
  const stale = useBoundedPoll(active && !!cogniInstance, runKey, makeCheck, POLL_INTERVAL_MS, MAX_POLLS);

  return { signal, sessions, stale };
}

```

### Core Architecture Module: `cognee-frontend/src/modules/business/computeBrainState.ts`
```
import { hsl } from "d3-color";
import type { BusinessGraphNode, BusinessGraphLink } from "./types";
import type { BusinessEntity, SemanticLink, TypeNode, TypeLink, BrainState } from "./sceneTypes";
import { topImportanceCut } from "./canvas/businessEntityLayer";
import { computeConnectedIds } from "./canvas/businessGraphFocus";
import { isCodeNode, normalizeCodeNodes } from "./codeGraph";
import { endId } from "./linkEndpoint";
import { normalizeStructuredNodes, structuredTypeName } from "./structuredGraph";
import { groupStructuredSources } from "./structuredSources";
import { assignTypeColors, createSourceEncoding, createTypeEncoding } from "./colorEncoding";
import { resolveLayoutGroups } from "./layoutGroups";
import { buildLayoutAnchors } from "./layoutAnchors";

// A synthetic source for content ingested with no node_set at all — the
// product's own manual-upload path (rememberData.ts) never sends node_set,
// so a directly-uploaded file's entities/documents used to have NO source
// at all: no Sources tile, no hull, no anchor (they defaulted to world
// origin, per buildLayoutAnchors), invisible to a focus lens. Attributing them here
// instead of returning [] means every downstream consumer of setsOf —
// coloring, hulls, filaments, plumbing, the hub metric, the focus lens —
// picks this up for free, without each needing its own "no source" branch
// (COG-6233).
export const UNCATEGORIZED_SOURCE = "uncategorized";

// A node's source(s) — the true source dimension when node_sets exist
// (Slack stamps "slack", the demo stamps crm/marketing/…), falling back to
// UNCATEGORIZED_SOURCE for content ingested without one.
export function setsOf(node: BusinessGraphNode): string[] {
  const belongs = node.belongs_to_set;
  if (Array.isArray(belongs) && belongs.length) return belongs;
  const raw = node.source_node_set;
  if (raw) {
    const parsed = String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length) return parsed;
  }
  return [UNCATEGORIZED_SOURCE];
}

const SESSION_SET_RE = /^(session_learnings|user_sessions_from_cache|agent_trace_feedbacks)/;
export function isSessionSetName(name: string): boolean {
  return SESSION_SET_RE.test(name);
}

const SESSION_SET_BASE_LABELS: Record<string, string> = {
  session_learnings: "session learnings",
  user_sessions_from_cache: "user sessions",
  agent_trace_feedbacks: "agent feedback",
};

// A session set's raw name is machine-assembled — base, agent, then a full
// UUID ("session_learnings:claude_d868a78b-8dff-…") — and reads as noise in
// every UI spot that shows sources. This derives the human version ("session
// learnings · claude · d868a7"): base label, agent, and just enough of the
// id to tell two of the same agent's sessions apart. The RAW name stays the
// key everywhere (focus lens, anchors, colors all key by it) — this is
// display only. Non-session sources pass through untouched.
export function sourceLabel(name: string): string {
  const base = Object.keys(SESSION_SET_BASE_LABELS).find((k) => name.startsWith(k));
  if (!base) return name;
  const rest = name.slice(base.length).replace(/^[:_\-\s]+/, "");
  if (!rest) return SESSION_SET_BASE_LABELS[base];
  const agent = rest.split(/[:_]/)[0];
  const id = rest.slice(agent.length).replace(/^[:_\-\s]+/, "").replace(/-/g, "");
  const shortId = id.slice(0, 6);
  return shortId
    ? `${SESSION_SET_BASE_LABELS[base]} · ${agent} · ${shortId}`
    : `${SESSION_SET_BASE_LABELS[base]} · ${agent}`;
}

// What a source's tooltip should say. sourceLabel truncates a session set's
// uuid to six characters to fit the rail, so using it for BOTH the visible
// text and the tooltip made hovering repeat what was already on screen and
// left the full identifier unreachable anywhere in the UI — the readable
// label leads, the raw name follows it when the two differ.
export function sourceTooltipLabel(name: string): string {
  const label = sourceLabel(name);
  return label === name ? name : `${label} · ${name}`;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Guards the answer-amber encoding: nudges any source color too close to
// amber's hue so "amber = live signal" stays unambiguous.
export function colorForSet(name: string, i: number, colorsMap?: Record<string, string>): string {
  let hex = (colorsMap || {})[name];
  if (!hex) {
    const hue = (i * 137.508 + 200) % 360;
    return hsl(hue, 0.55, 0.62).formatHex();
  }
  const color = hsl(hex);
  if (!isNaN(color.h) && hueDistance(color.h, 35) < 15) {
    color.h = (color.h + 40) % 360;
    hex = color.formatHex();
  }
  return hex;
}

interface SplitSets {
  sets: BusinessGraphNode[];
  sessionSetNodes: BusinessGraphNode[];
}

function splitNodeSets(nodesArr: BusinessGraphNode[]): SplitSets {
  const nodeSets = nodesArr.filter((n) => n.type === "NodeSet" && n.name);
  return {
    sets: nodeSets.filter((n) => !isSessionSetName(n.name as string)),
    sessionSetNodes: nodeSets.filter((n) => isSessionSetName(n.name as string)),
  };
}

// Union, not either/or: a node_set with no explicit NodeSet node (backend
// didn't create one for it) must still surface via its entities' own tags —
// otherwise it silently disappears the moment ANY other node_set in the same
// graph does have a NodeSet node (COG-6233).
export function deriveSourceNames(nodesArr: BusinessGraphNode[], entities: BusinessGraphNode[]): string[] {
  const { sets } = splitNodeSets(nodesArr);
  return [...new Set([...sets.map((n) => n.name as string), ...entities.flatMap(setsOf)])];
}

function buildSourceColors(
  srcNames: string[],
  sessionSetNodes: BusinessGraphNode[],
  colorsMap?: Record<string, string>,
): Record<string, string> {
  const colors: Record<string, string> = {};
  srcNames.forEach((s, i) => {
    colors[s] = colorForSet(s, i, colorsMap);
  });
  // A session set no entity is tagged with yet still needs a color of its own.
  // It gets one like any other source: amber is kept for what is live now.
  sessionSetNodes.forEach((n, i) => {
    const name = n.name as string;
    if (!colors[name]) colors[name] = colorForSet(name, srcNames.length + i, colorsMap);
  });
  return colors;
}

function countBySet(nodes: BusinessGraphNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  nodes.forEach((n) => setsOf(n).forEach((s) => { counts[s] = (counts[s] || 0) + 1; }));
  return counts;
}

// How many of `links` touch the entity, for the panel and tooltip counts.
export function countLinksTouching(links: SemanticLink[], id: string): number {
  return links.filter((l) => l._sid === id || l._tid === id).length;
}

function withEndpointIds<T extends BusinessGraphLink>(links: T[]): (T & { _sid: string; _tid: string })[] {
  return links.map((l) => ({ ...l, _sid: endId(l.source), _tid: endId(l.target) }));
}

// The business-model (L0) layer: entity TYPES and how they relate —
// "campaign generates customer", not individual campaigns. Types float at
// the centroid of their members, computed each draw frame by the canvas.
// `typeEdges` is the drawn graph (graphLinks), not insight links: for a
// structured dataset the schema (rows belong to a table) is the model, so
// those edges are kept here on purpose even though insights exclude them.
function buildTypeLayer(
  entities: BusinessEntity[],
  links: (BusinessGraphLink & { _sid: string; _tid: string })[],
  byId: Record<string, BusinessGraphNode>,
  typeEdges: SemanticLink[],
): { typeNodes: TypeNode[]; typeLinks: TypeLink[]; entityType: Record<string, string> } {
  const typeName: Record<string, string> = {};
  links.forEach((l) => {
    const s = byId[l._sid], t = byId[l._tid];
    if (s && t && s.stage === "entity" && t.stage === "type" &&
      (l.relation === "is_a" || l.relation === "instance_of")) {
      typeName[s.id] = t.name as string;
    }
  });

  // entity_type is present on EVERY node since cognee 1.6.1 (falling back to
  // the node's own class name — "Entity" — when no is_a edge resolved a real
  // type), not only on code nodes. Trusting it for an ordinary entity would
  // surface that literal "Entity" as its own Types-rail tile on every graph;
  // a code node has no such ambiguity, entity_type there always carries its
  // actual class (CodeSymbol, CodeModule, …), so this only reads it there.
  function typeOf(id: string): string {
    if (typeName[id]) return typeName[id];
    const node = byId[id];
    const structuredType = node && structuredTypeName(node);
    if (structuredType) return structuredType;
    if (node && isCodeNode(node) && node.entity_type) return node.entity_type;
    return "other";
  }

  const buckets: Record<string, TypeNode> = {};
  const entityType: Record<string, string> = {};
  entities.forEach((n) => {
    const tn = typeOf(n.id);
    entityType[n.id] = tn;
    const bucket = (buckets[tn] = buckets[tn] || { name: tn, members: [], sets: {} });
    bucket.members.push(n);
    setsOf(n).forEach((s) => { bucket.sets[s] = (bucket.sets[s] || 0) + 1; });
  });

  const links2: Record<string, TypeLink> = {};
  typeEdges.forEach((l) => {
    const a = typeOf(l._sid), b = typeOf(l._tid);
    if (a === b) return;
    const relation = l.relation || "related";
    const key = `${a}→${b}|${relation}`;
    const slot = (links2[key] = links2[key] || { a, b, relation, count: 0 });
    slot.count += 1;
  });

  return { typeNodes: Object.values(buckets), typeLinks: Object.values(links2), entityType };
}

const HUB_MIN_DEGREE = 2;

// The graph-dashboard "single point of failure" callout: whichever entity
// carries the most connections, and how many distinct sources those
// connections span. Below HUB_MIN_DEGREE the number is noise (any entity
// with one link "wins" by default on a sparse graph), so this returns null
// rather than surface a meaningless hub.
function computeHubInsight(
  semanticLinks: SemanticLink[],
  byId: Record<string, Busines
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6301** (2026-10-29): **[Bug]: S3FileStorage.list_files() hides backend failures as an empty result**
  *Symptoms*: ### Bug Description  `S3FileStorage.list_files()` catches every exception raised by `s3.glob()` or `s3.isfile()` and returns `[]`. This makes permission errors, transient network failures, and endpoint problems indistinguishable from a genuinely empty directory. Callers that use the listing as a source-of-truth inventory can silently proceed with incomplete or missing data instead of surfacing the storage failure.  ### Steps to Reproduce  1. Configure S3FileStorage with a bucket/prefix. 2. Make the listing call fail (for example, use mocked s3.glob() that raises PermissionError or a connection exception). 3. Call await storage.list_files("some-prefix"). 4. Observe that the call returns [] instead of propagating the backend error.  ### Expected Behavior  Return an empty list only when the requested directory/prefix is confirmed to contain no files. Propagate permission, transport, and other backend errors so callers can fail or retry instead of treating the data source as empty.  ### Actual Behavior  The exception is logged only at debug level and list_files() returns an empty list, hiding the reason the listing failed.  ### Environment  Current main checkout, cognee/infrastructure/files/storage/S3FileStorage.py, S3FileStorage.list_files().  ### Logs/Error Messages  ```shell  ```  ### Additional Context  The blanket except Exception around self.s3.glob() and self.s3.isfile() at the end of list_files_sync() swallows all backend failures. This differs from a confirmed empty pref

- **Issue #6235** (2026-10-29): **[Bug]: Google Drive connector never saves its cursor while one file fails to extract, so every sync re-downloads the whole folder**
  *Symptoms*: ### Bug Description  In <i>**cognee/tasks/ingestion/connectors/google_drive.py**</i>, **_iter_rows** only saves page_token when the run had no failed file, on lines 296 and 355. That is meant to retry a transient extraction failure, but it cannot tell a transient failure from a permanent one, and some files never extract:  - a password protected PDF: pypdf raises **FileNotDecryptedError** - a Google Doc over Drive's 10 MB export limit: Drive answers 403 exportSizeLimitExceeded every time - a corrupt PDF  One such file in a folder pins the sync forever:  - **First sync never finishes.** page_token stays unset, so every later run is again a full listing that downloads and parses every file in the folder. - **Incremental sync never moves.** Once a changed file fails, page_token stays at the old value, so every run re-reads the change feed since then and downloads every file that changed since then. That backlog only grows.  The only sign is a warning on each run that the file was skipped, which reads as harmless: the sync finishes successfully, and nothing says the cursor was not saved or that the next run starts over. Rows still arrive and content hashes match, so nothing is cognified again. The cost is silent: Drive quota, bandwidth and run time on every sync, growing with folder size, and on a large folder it runs into Drive's rate limits.  ### Steps to Reproduce  1. Install cognee from dev with the google-drive extra. 2. In Google Drive, make a folder with two small text fil

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

### Incident Patch 1: `95ff9cfd` (2026-10-29)
**Commit Message**: fix(conflicts): Retire choices a chunk edit loses (SDK-1328) (#6437)

## Description

Stacked on #6401 (`feat/resolve-fact-conflicts`, at `b9e9b7770`, which
includes #6434).

**Problem.** #6434 retires a user decision when `forget(data_id=...)` or
a connector's orphan cleanup deletes the document behind its chosen
fact. `update()`'s chunk-level path removes facts without deleting the
document. An edit that removes the sentence behind the chosen fact
deletes that fact with the chunk, and the decision stayed. Retrieval
then kept saying "Accepted by user: X; ignore competing claims" with X
gone, and the `superseded` marks kept hiding the competing facts that
remain (review thread r57).

**Fix.** `_run_incremental_update` calls the new
`retire_decisions_after_edit` once `_write_and_publish` has written the
edit:
- It runs under the dataset lock and inside the run's error handling, so
a failure is logged against the update run and raised.
- It is skipped when the document is unchanged or the write failed.
- It runs after the new chunks are extracted, so a fact the edit keeps,
or states again, still exists and its decision stays.

The function calls #6434's `retire_forgotten_decisions` (

**File**: `cognee/api/v1/update/incremental.py` (modified, +5/-0)
```diff
@@ -77,6 +77,7 @@
 from cognee.modules.chunking.TextChunker import TextChunker
 from cognee.modules.cognify.config import GLINER_DEMO_EXTRACTOR, LLM_EXTRACTOR, get_cognify_config
 from cognee.modules.cognify.routing import CognifyRoute, cognify_route_for
+from cognee.modules.conflicts.methods import retire_decisions_after_edit
 from cognee.modules.data.exceptions.exceptions import UnauthorizedDataAccessError
 from cognee.modules.data.methods import (
     StagedContent,
@@ -767,6 +768,10 @@ async def _run_incremental_update(
                 chunker=chunker,
                 extractor=extractor,
             )
+            # An edit can remove the fact a user chose, or restate it under another
+            # relationship; its decision must not outlive it. Read once the new
+            # chunks' facts are written, so a fact the edit kept is still found.
+            await retire_decisions_after_edit(dataset, user)
     except Exception as error:
         await log_pipeline_run_error(
             pipeline_run.pipeline_run_id,
```

**File**: `cognee/modules/conflicts/methods.py` (modified, +22/-4)
```diff
@@ -268,10 +268,12 @@ async def resolve_conflict(
 async def retire_forgotten_decisions(dataset, user: User) -> set[str]:
     """Delete the user decisions whose chosen fact no longer exists, and return their ids.
 
-    Run after a document is deleted, inside the dataset's lock and database context.
-    A fact supported by several documents stays in the graph until the last of them
-    is deleted, so its decision stays until then too. The check reads what the graph
-    holds now rather than what one delete removed, so a retried delete still finds it.
+    Run after a document is deleted, inside the dataset's lock and database context;
+    ``update()``'s chunk-level path runs it once the edit is written instead (see
+    ``retire_decisions_after_edit``). A fact supported by several documents stays in
+    the graph until the last of them is deleted, so its decision stays until then too.
+    The check reads what the graph holds now rather than what one delete removed, so a
+    retried delete still finds it.
     """
     graph = await get_graph_engine()
     rows, _ = await graph.get_filtered_graph_data([{"type": ["FactConflict"]}], include_edges=False)
@@ -300,3 +302,19 @@ async def retire_forgotten_decisions(dataset, user: User) -> set[str]:
         await write_conflicts([ConflictsToWrite(scope, dropped_conflict_ids=list(forgotten))], ctx)
         await write_conflicts([ConflictsToFinalize(dropped_conflict_ids=list(forgotten))], ctx)
     return set(forgotten)
+
+
+async def retire_decisions_after_edit(dataset, user: User) -> set[str]:
+    """Retire the decisions an edit left without their chosen fact, and invalidate sessions.
+
+    ``update()``'s chunk-level path drops the facts of the chunks an edit touched and
+    extracts the new chunks. A decision whose fact the new extraction does not restore,
+    because the text changed or the fact came back under another relationship, would go
+    on presenting it as accepted and hiding its competitors. Run inside the dataset's
+    lock and database context, after the edit was written: a failed write may only not
+    have restored the fact yet. A failed session invalidation fails the update.
+    """
+    retired = await retire_forgotten_decisions(dataset, user)
+    if retired:
+        await invalidate_sessions_for_deleted_data(dataset.id, retired, set(), user_id=user.id)
+    return retired
```

**File**: `cognee/tests/unit/api/test_incremental_retires_decisions.py` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+"""An incremental update retires the conflict decisions an edit took the chosen fact from."""
+
+from types import SimpleNamespace
+from unittest.mock import AsyncMock
+from uuid import uuid4
+
+import pytest
+
+from cognee.api.v1.update import incremental
+
+
+def _patch_run(monkeypatch, bundle, write):
+    order = []
+
+    async def record_write(*args, **kwargs):
+        order.append("write")
+        return await write(*args, **kwargs)
+
+    async def retire(dataset, user):
+        order.append(("retire", dataset, user))
+        return set()
+
+    monkeypatch.setattr(incremental, "_stage_and_plan", AsyncMock(return_value=bundle))
+    monkeypatch.setattr(incremental, "generate_pipeline_id", lambda *args: uuid4())
+    monkeypatch.setattr(
+        incremental,
+        "log_pipeline_run_start",
+        AsyncMock(return_value=SimpleNamespace(pipeline_run_id=uuid4())),
+    )
+    monkeypatch.setattr(incremental, "log_pipeline_run_complete", AsyncMock())
+    monkeypatch.setattr(incremental, "log_pipeline_run_error", AsyncMock())
+    monkeypatch.setattr(incremental, "send_telemetry", lambda *args, **kwargs: None)
+    monkeypatch.setattr(incremental, "_write_and_publish", record_write)
+    monkeypatch.setattr(incremental, "retire_decisions_after_edit", retire)
+    return order
+
+
+async def _run(dataset, user):
+    return await incremental._run_incremental_update(
+        uuid4(), "new text", dataset, user, None, None, None, None, None, None, None, "llm"
+    )
+
+
+@pytest.mark.asyncio
+async def test_decisions_are_retired_once_the_edit_is_written(monkeypatch):
+    dataset, user = SimpleNamespace(id=uuid4()), SimpleNamespace(id=uuid4())
+    order = _patch_run(monkeypatch, {"status": "changed"}, AsyncMock(return_value={}))
+
+    await _run(dataset, user)
+
+    assert order == ["write", ("retire", dataset, user)]
+
+
+@pytest.mark.asyncio
+async def test_a_failed_write_retires_nothing(monkeypatch):
+    dataset, user = SimpleNamespace(id=uuid4()), SimpleNamespace(id=uuid4())
+    order = _patch_run(
+        monkeypatch, {"status": "changed"}, AsyncMock(side_effect=RuntimeError("write failed"))
+    )
+
+    with pytest.raises(RuntimeError, match="write failed"):
+        await _run(dataset, user)
+
+    assert order == ["write"]
```

**File**: `cognee/tests/unit/modules/conflicts/test_retire_decisions_after_edit.py` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+"""Sessions that cited a retired decision are invalidated with it (SDK-1328)."""
+
+import importlib
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, patch
+from uuid import uuid4
+
+import pytest
+
+methods = importlib.import_module("cognee.modules.conflicts.methods")
+
+
+@pytest.mark.asyncio
+async def test_retired_decisions_reach_session_invalidation():
+    dataset, user = SimpleNamespace(id=uuid4()), SimpleNamespace(id=uuid4())
+    invalidate = AsyncMock()
+    with (
+        patch.object(methods, "retire_forgotten_decisions", AsyncMock(return_value={"c1"})),
+        patch.object(methods, "invalidate_sessions_for_deleted_data", invalidate),
+    ):
+        assert await methods.retire_decisions_after_edit(dataset, user) == {"c1"}
+
+    invalidate.assert_awaited_once_with(dataset.id, {"c1"}, set(), user_id=user.id)
```

---

### Incident Patch 2: `95857f26` (2026-10-29)
**Commit Message**: fix(conflicts): Retire choices on connector deletes

A row removed upstream is deleted by the connector's orphan cleanup, which
bypassed datasets.delete_data and so kept the user decision whose chosen
fact went with the row, presenting the deleted fact as accepted. The
cleanup now retires such decisions before the Data row goes, under the
dataset lock, and invalidates sessions that cited them.

Refs SDK-1328

**File**: `cognee/tasks/ingestion/resolve_dlt_sources.py` (modified, +14/-3)
```diff
@@ -976,6 +976,8 @@ async def _delete_dlt_orphans(
     proved, and deleting another source's data is worse than retaining residue.
     """
     from cognee.context_global_variables import set_database_global_context_variables
+    from cognee.infrastructure.locks import dataset_lock
+    from cognee.modules.conflicts.methods import retire_forgotten_decisions
     from cognee.modules.data.methods import get_authorized_existing_datasets
     from cognee.modules.data.methods.delete_data import delete_data
     from cognee.modules.data.methods.get_dataset_data import get_dataset_data
@@ -1031,15 +1033,24 @@ async def _delete_dlt_orphans(
     # engines — the background-ingest path invokes orphan_cleanup before any
     # pipeline establishes the context — so the graph + vector purge silently
     # targets the wrong DB and leaves the forgotten row's chunks/entities
-    # searchable under ENABLE_BACKEND_ACCESS_CONTROL.
-    async with set_database_global_context_variables(dataset.id, dataset.owner_id):
+    # searchable under ENABLE_BACKEND_ACCESS_CONTROL. The dataset lock comes
+    # first, as in datasets.delete_data: retiring conflict decisions rewrites
+    # conflict nodes that a pipeline or a resolve_conflict call may be writing.
+    async with (
+        dataset_lock(dataset.id),
+        set_database_global_context_variables(dataset.id, dataset.owner_id),
+    ):
         for orphan in orphans:
             try:
                 # Called unconditionally: gating on has_data_related_nodes would
                 # skip graphs whose provenance is stamped in-graph instead of the
                 # relational ledger (the function handles both paths and no-ops
                 # when nothing is related).
                 deleted_elements = await delete_data_nodes_and_edges(dataset.id, orphan.id, user.id)
+                # A row removed upstream is forgotten like forget(data_id=...): a user
+                # decision whose chosen fact went with it is retired before the Data
+                # row goes, so a failure keeps the row for the next ingest's retry.
+                retired = await retire_forgotten_decisions(dataset, user)
                 await delete_data(orphan, dataset.id)
                 # Invalidate session answers that used the orphan's graph
                 # elements (best-effort; must not fail the cleanup).
@@ -1050,7 +1061,7 @@ async def _delete_dlt_orphans(
 
                     await invalidate_sessions_for_deleted_data(
                         dataset.id,
-                        deleted_elements.node_ids,
+                        set(deleted_elements.node_ids) | retired,
                         deleted_elements.edge_ids,
                         user_id=user.id,
                     )
```

**File**: `cognee/tests/unit/tasks/test_dlt_document_cleanup_scope.py` (modified, +4/-0)
```diff
@@ -81,6 +81,10 @@ async def context(*args):
             "delete_data_nodes_and_edges",
             new=AsyncMock(return_value=SimpleNamespace(node_ids=[], edge_ids=[])),
         ),
+        patch(
+            "cognee.modules.conflicts.methods.retire_forgotten_decisions",
+            new=AsyncMock(return_value=set()),
+        ),
         patch.object(
             importlib.import_module("cognee.modules.data.methods.delete_data"),
             "delete_data",
```

**File**: `cognee/tests/unit/tasks/test_dlt_orphan_retires_decisions.py` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+"""A connector row removed upstream retires the user decisions its facts backed."""
+
+import importlib
+from contextlib import asynccontextmanager, contextmanager
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, patch
+from uuid import uuid4
+
+import pytest
+
+from cognee.infrastructure.locks import held_datasets
+
+resolve = importlib.import_module("cognee.tasks.ingestion.resolve_dlt_sources")
+
+
+@contextmanager
+def _patches(dataset, orphan, retire, delete, invalidate):
+    @asynccontextmanager
+    async def context(*args):
+        yield
+
+    with (
+        patch(
+            "cognee.modules.data.methods.get_authorized_existing_datasets",
+            new=AsyncMock(return_value=[dataset]),
+        ),
+        patch.object(
+            importlib.import_module("cognee.modules.data.methods.get_dataset_data"),
+            "get_dataset_data",
+            new=AsyncMock(return_value=[orphan]),
+        ),
+        patch("cognee.context_global_variables.set_database_global_context_variables", context),
+        patch.object(
+            importlib.import_module("cognee.modules.graph.methods.delete_data_nodes_and_edges"),
+            "delete_data_nodes_and_edges",
+            new=AsyncMock(return_value=SimpleNamespace(node_ids={"n1"}, edge_ids={"e1"})),
+        ),
+        patch("cognee.modules.conflicts.methods.retire_forgotten_decisions", new=retire),
+        patch.object(
+            importlib.import_module("cognee.modules.data.methods.delete_data"),
+            "delete_data",
+            new=delete,
+        ),
+        patch.object(
+            importlib.import_module("cognee.modules.session_lifecycle.invalidate_sessions"),
+            "invalidate_sessions_for_deleted_data",
+            new=invalidate,
+        ),
+    ):
+        yield
+
+
+def _fixture():
+    dataset = SimpleNamespace(id=uuid4(), owner_id=uuid4())
+    user = SimpleNamespace(id=uuid4())
+    orphan = SimpleNamespace(
+        id=uuid4(), system_metadata={"source": "notion", "table_name": "pages"}
+    )
+    return dataset, user, orphan
+
+
+async def _cleanup(user):
+    await resolve._delete_dlt_orphans(
+        "dataset", user, set(), sources=("notion",), document_scopes={("notion", "pages")}
+    )
+
+
+@pytest.mark.asyncio
+async def test_orphan_cleanup_retires_decisions_under_the_dataset_lock():
+    dataset, user, orphan = _fixture()
+
+    async def retire(retire_dataset, retire_user):
+        assert dataset.id in held_datasets.get()
+        assert (retire_dataset, retire_user) == (dataset, user)
+        return {"conflict"}
+
+    delete, invalidate = AsyncMock(), AsyncMock()
+    with _patches(dataset, orphan, AsyncMock(side_effect=retire), delete, invalidate):
+        await _cleanup(user)
+
+    delete.assert_awaited_once_with(orphan, dataset.id)
+    assert invalidate.await_args.args[1:] == ({"n1", "conflict"}, {"e1"})
+
+
+@pytest.mark.asyncio
+async def test_a_failed_retirement_keeps_the_row_for_the_next_ingest():
+    dataset, user, orphan = _fixture()
+    delete = AsyncMock()
+    retire = AsyncMock(side_effect=RuntimeError("graph read failed"))
+    with _patches(dataset, orphan, retire, delete, AsyncMock()):
+        await _cleanup(user)
+
+    delete.assert_not_awaited()
```

---

### Incident Patch 3: `962e4c13` (2026-10-29)
**Commit Message**: fix: Fail on malformed DLT key hints instead of skipping them (COG-7007)

Reading a resource's table hints caught every exception at debug level
and moved on, so a resource that failed for any reason silently lost
its keys. Only a resource naming its tables per item has no static
hints; that case is now an explicit check with a warning, and anything
else raises. A foreign key hint missing its column, table or referenced
column was skipped or guessed; hints are cognee's own output, so it now
raises. BROAD reads a table node's name directly instead of defaulting.

**File**: `cognee/modules/retrieval/broad_retriever.py` (modified, +1/-1)
```diff
@@ -317,7 +317,7 @@ async def dlt_foreign_keys(self, graph_engine) -> dict[str, list[str]]:
                 f"{fk['column']} references {fk['ref_table']}.{fk['ref_column']}"
                 for fk in json.loads(props["foreign_keys"])
             ]
-            listed = foreign_keys.setdefault(str(props.get("name")), [])
+            listed = foreign_keys.setdefault(str(props["name"]), [])
             listed.extend(line for line in lines if line not in listed)
         return foreign_keys
 
```

**File**: `cognee/tasks/ingestion/ingest_dlt_source.py` (modified, +9/-7)
```diff
@@ -292,7 +292,8 @@ def _source_tables(pipeline, dlt_source) -> list:
 
     Resource hints carry the source's own spelling; the loaded schema's naming
     convention gives the names the staging tables and columns were created with.
-    A resource whose table name depends on its items has no static hints.
+    A resource whose table name depends on its items has no static hints, so its
+    tables get no keys; that is said once per resource.
     """
     from dlt.common.schema.utils import normalize_table_identifiers
     from dlt.extract.source import DltSource
@@ -305,13 +306,14 @@ def _source_tables(pipeline, dlt_source) -> list:
 
     tables = []
     for resource in resources:
-        try:
-            table = resource.compute_table_schema()
-        except Exception:
-            logger.debug("No static table hints for resource %r", resource.name, exc_info=True)
+        if resource.has_dynamic_table_name:
+            logger.warning(
+                "Resource %r names its tables per item, so dlt has no key hints for them: "
+                "its rows get no foreign key edges.",
+                resource.name,
+            )
             continue
-        if table.get("name"):
-            tables.append(normalize_table_identifiers(table, naming))
+        tables.append(normalize_table_identifiers(resource.compute_table_schema(), naming))
     return tables
 
 
```

**File**: `cognee/tasks/ingestion/resolve_dlt_sources.py` (modified, +6/-7)
```diff
@@ -1040,16 +1040,15 @@ def close(groups, ref_table):
             yield ref_table, pairs, None
 
     for fk in foreign_keys:
-        column = fk.get("column", "")
-        ref_table = fk.get("ref_table", "")
-        if not column or not ref_table:
-            continue
+        # Hints are written by _dlt_key_hints with all three fields; one without
+        # them is a bug, not a key to skip.
+        column, ref_table, ref_column = fk["column"], fk["ref_table"], fk["ref_column"]
+        if not column or not ref_table or not ref_column:
+            raise ValueError(f"Foreign key hint {fk!r} does not name its column, table and target")
         key = key_columns.get(ref_table)
         if key is None:
-            yield ref_table, [(column, fk.get("ref_column", ""))], [fk.get("ref_column", "")]
+            yield ref_table, [(column, ref_column)], [ref_column]
             continue
-        # A reflected FK without a referenced column names its table's single key.
-        ref_column = fk.get("ref_column") or (key[0] if len(key) == 1 else "")
         if ref_column not in key:
             yield from close(open_keys, ref_table)
             if any(ref_column == taken for _, taken in open_columns.get(ref_table, [])):
```

**File**: `cognee/tests/unit/tasks/ingestion/test_dlt_fk_resolution.py` (modified, +13/-0)
```diff
@@ -193,3 +193,16 @@ def test_a_key_to_a_table_this_add_did_not_load_gets_its_own_warning(monkeypatch
     assert "only within one add()" in unloaded.args[0]
     assert unresolved.args[1:] == (1, "shipments.order_id, line_no -> order_lines:9:1")
     assert "max_rows_per_table" in unresolved.args[0]
+
+
+def test_a_hint_missing_a_field_raises():
+    """Hints are cognee's own output, so an incomplete one is a bug, not a key to skip."""
+    import pytest
+
+    row = _row("badges", [{"column": "owner_id", "ref_table": "people"}], {"owner_id": 1})
+    with pytest.raises(KeyError):
+        _resolve_fk_references(row, {}, [], {"people": ["id"]})
+
+    row = _row("badges", [_fk("owner_id", "people", "")], {"owner_id": 1})
+    with pytest.raises(ValueError):
+        _resolve_fk_references(row, {}, [], {"people": ["id", "org"]})
```

**File**: `cognee/tests/unit/tasks/ingestion/test_dlt_key_hints.py` (modified, +22/-0)
```diff
@@ -153,3 +153,25 @@ def test_hints_come_from_the_schema_the_source_loaded_into():
 
     assert _loaded_schema(pipeline, sql_source) is sql_schema
     assert _loaded_schema(pipeline, SimpleNamespace(name="a bare resource")) is csv_schema
+
+
+def test_a_resource_naming_its_tables_per_item_is_skipped_with_a_warning(caplog):
+    """Such a resource has no static hints; any other failure to read hints raises."""
+    import logging
+
+    import dlt
+    from dlt.common.schema import Schema
+
+    @dlt.source(name="sql_database")
+    def shop():
+        yield dlt.resource([{"Id": 1}], name="Users", primary_key="Id")
+        yield dlt.resource([{"kind": "a", "Id": 1}], name="events", table_name=lambda i: i["kind"])
+
+    schema = Schema("sql_database")
+    pipeline = SimpleNamespace(default_schema=schema, schemas={"sql_database": schema})
+
+    with caplog.at_level(logging.WARNING):
+        tables = _source_tables(pipeline, shop())
+
+    assert [table["name"] for table in tables] == ["users"]
+    assert "events" in caplog.text and "no key hints" in caplog.text
```

#### Recent Merged Pull Requests:
- **PR #6456** (closed): docs: Sync router docstrings with handlers (RES-14) (@siillee)
- **PR #6448** (2026-10-29): chore: Sync cognee-mcp lock to cognee 1.6.6 [release] (@dexters1)
- **PR #6447** (2026-10-29): chore: Sync cognee-mcp lock to cognee 1.6.6 [release] (@dexters1)
- **PR #6444** (2026-10-29): chore: Release v1.6.6 (@dexters1)
- **PR #6443** (2026-10-29): chore: Release v1.6.6 (@dexters1)
- **PR #6441** (2026-10-29): feat: Make every DLT column a value node by default (SDK-1344) (@dexters1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. conflicts): Retire choices a chunk edit loses (SDK-1328) (#6437)

**RULE**:
When implementing operations in `cognee/api/v1/update/incremental.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in topoteretes/cognee. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `95ff9cfd`: conflicts): Retire choices a chunk edit loses (SDK-1328) (#6437). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `cognee/api/v1/update/incremental.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
from cognee.modules.conflicts.methods import retire_decisions_after_edit
            # An edit can remove the fact a user chose, or restate it under another
            # relationship; its decision must not outlive it. Read once the new
            # chunks' facts are written, so a fact the edit kept is still found.
            await retire_decisions_after_edit(dataset, user)
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `95ff9cfd` are properly handled with clean fallback behavior.
