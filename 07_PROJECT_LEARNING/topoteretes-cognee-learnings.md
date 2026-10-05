# Forensic Learning Record (Deep Inspection): topoteretes/cognee

> **Canonical Artifact**: `07_PROJECT_LEARNING/topoteretes-cognee-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/topoteretes/cognee](https://github.com/topoteretes/cognee))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:23:10.716Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `topoteretes/cognee`
- **Description**: Cognee is the open-source AI memory platform for agents. Give your AI agents persistent long-term memory with small models for free
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 31393 stars

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
import pollDatasetStatus, { DatasetProcessingError } from "@/modules/datasets/pollDatasetStatus";
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
        // a silent event — the user was told their brain is being prepared.
        if (!cancelled && !gaveUpEarly) {
          notifications.show({
            color: "red",
            title: "Brain processing failed",
            message:
              err instanceof DatasetProcessingError
                ? "Your brain could not be processed. Try uploading it again."
                : "We could not confirm your brain finished processing. Check the Brain page for its status.",
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

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useConnectedIntegrations.ts`
```
"use client";

import { useState, useEffect } from "react";
import type { SessionRow } from "@/modules/sessions/getSessions";
import {
  getConnectedIntegrations,
  setConnectedIntegrations as persistConnectedIntegrations,
} from "@/utils/browserStorage";

// Per-integration session_id prefix. Detection is coarse on purpose — any session
// whose id starts with the prefix counts as connected. Keep these in sync with
// the shipped integrations (claude-code → "cc_", codex → "codex_" as emitted by
// the plugins' _generate_session_id). Openclaw and API/MCP have no fixed prefix.
export const INTEGRATION_SESSION_PREFIX: Record<string, string> = {
  "claude-code": "cc_",
  codex: "codex_",
};

/**
 * Derives and persists per-integration "Connected" state from the session_id
 * prefixes. Sticky per tenant via localStorage so a card stays "Connected" after
 * its session ages out of the polled window.
 */
export function useConnectedIntegrations(
  sessions: SessionRow[],
  tenantId: string | null,
): Record<string, boolean> {
  const [connectedIntegrations, setConnectedIntegrations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!tenantId) return;
    const persisted = getConnectedIntegrations(tenantId);
    const next = { ...persisted };
    for (const [key, prefix] of Object.entries(INTEGRATION_SESSION_PREFIX)) {
      if (sessions.some((s) => s.session_id.startsWith(prefix))) next[key] = true;
    }
    if (JSON.stringify(next) !== JSON.stringify(persisted)) {
      persistConnectedIntegrations(tenantId, next);
    }
    setConnectedIntegrations((prev) =>
      JSON.stringify(prev) !== JSON.stringify(next) ? next : prev,
    );
  }, [sessions, tenantId]);

  return connectedIntegrations;
}

```

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useCreditsBanner.ts`
```
"use client";

import { useState, useCallback } from "react";
import { useTenant } from "@/modules/tenant/TenantProvider";
import { useCreditsBalance, getTenantRow } from "@/modules/billing/useCreditsBalance";
import { isCreditsBannerDismissed, dismissCreditsBanner } from "@/utils/browserStorage";

export interface CreditsBannerState {
  creditsSpentPct: number | null;
  creditsRemainingUsd: number | null;
  /** True when ≥ 90 % of credits are spent. Wins over all other banners. */
  showCreditPctBanner: boolean;
  /** True when balance < $1 and credit-pct banner is not showing. */
  showLowBalanceBanner: boolean;
  /** True when neither warning banner is active. */
  showVoucherBanner: boolean;
  dismiss: () => void;
}

/**
 * Fetches credit usage and tracks banner visibility.
 *
 * Only one banner may show at a time — priority:
 *   1. Credit-percentage banner (≥ 90 %)
 *   2. Low-balance banner (< $1)
 *   3. Voucher banner (promotional)
 */
export function useCreditsBanner(): CreditsBannerState {
  const { tenant } = useTenant();
  const { data: overview } = useCreditsBalance(true);
  const [dismissed, setDismissed] = useState<boolean>(isCreditsBannerDismissed);

  const row = getTenantRow(overview, tenant?.tenant_id ?? null);
  const creditsSpentPct =
    row?.spentUsd != null && row.maxBudgetUsd ? Math.round((row.spentUsd / row.maxBudgetUsd) * 100) : null;
  const creditsRemainingUsd = row?.remainingUsd ?? null;

  const showCreditPctBanner = !dismissed && creditsSpentPct !== null && creditsSpentPct >= 90;
  const showLowBalanceBanner = !showCreditPctBanner && creditsRemainingUsd !== null && creditsRemainingUsd < 1;
  const showVoucherBanner = !showCreditPctBanner && !showLowBalanceBanner;

  const dismiss = useCallback(() => {
    dismissCreditsBanner();
    setDismissed(true);
  }, []);

  return {
    creditsSpentPct,
    creditsRemainingUsd,
    showCreditPctBanner,
    showLowBalanceBanner,
    showVoucherBanner,
    dismiss,
  };
}

```

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useDashboardTelemetry.ts`
```
"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useCogniInstance, useTenant } from "@/modules/tenant/TenantProvider";
import { useFilter } from "@/ui/layout/FilterContext";
import { listSessions } from "@/modules/sessions/getSessions";
import type { SessionRow } from "@/modules/sessions/getSessions";
import { useCircuitBreaker } from "@/modules/query/useCircuitBreaker";
import type { PipelineRun, Range } from "@/ui/elements/AgentActivityTerminal";

const TELEMETRY_POLL_INTERVAL_MS = 15_000;
// Background polls get extra headroom because local/loaded pods can take several
// seconds per request (COG-5722) — we don't want a slow pod surfacing as a false
// error while it's still working.
const BACKGROUND_POLL_TIMEOUT_MS = 25_000;

export interface DashboardTelemetry {
  runs: PipelineRun[];
  sessions: SessionRow[];
  loading: boolean;
}

export function useDashboardTelemetry(range: Range): DashboardTelemetry {
  const { cogniInstance, isInitializing } = useCogniInstance();
  const { tenant, tenantReady } = useTenant();
  const { loading: filterLoading } = useFilter();

  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const telemetryBreaker = useCircuitBreaker(TELEMETRY_POLL_INTERVAL_MS);

  const telemetryQuery = useQuery({
    queryKey: ["dashboard-telemetry", tenant?.tenant_id ?? null, range],
    queryFn: async ({ signal }) => {
      if (!cogniInstance) throw new Error("cogniInstance unavailable");
      const init: RequestInit & { timeoutMs?: number } = { signal, timeoutMs: BACKGROUND_POLL_TIMEOUT_MS };
      // Let genuine failures (timeout/network/5xx) reject the query so the circuit
      // breaker sees them. listSessions still swallows internally (shared with pages
      // that want that leniency), but a dead pod fails pipeline-runs first anyway.
      const [runData, sessionsPage] = await Promise.all([
        cogniInstance.fetch("/v1/activity/pipeline-runs", init).then((r) => r.json()),
        listSessions(cogniInstance, { range, limit: 50 }, { signal, timeoutMs: BACKGROUND_POLL_TIMEOUT_MS }),
      ]);
      return {
        // Operation rows (kind: "operation") legitimately carry pipeline_name:
        // null (recall/search/remember/... aren't named pipelines) — only
        // reject rows missing the kind discriminator itself, which is the
        // actual signal of a malformed row (see AgentActivityTerminal.tsx).
        runs: (Array.isArray(runData) ? runData : []).filter(
          (r): r is PipelineRun =>
            (r as { kind?: unknown } | null)?.kind === "pipeline" ||
            (r as { kind?: unknown } | null)?.kind === "operation",
        ),
        sessions: sessionsPage?.sessions ?? [],
      };
    },
    // tenantReady, not just cogniInstance: a freshly-created workspace gets a
    // cogniInstance immediately (optimistic), but the pod itself can take up
    // to a minute to actually answer — firing this against it early just
    // produces a burst of failed requests (dashboard now mounts before the
    // pod is ready, since it's excluded from TenantProvider's isInitializing
    // wait; see TenantProvider.tsx).
    enabled: !!cogniInstance && !isInitializing && !filterLoading && tenantReady,
    refetchInterval: telemetryBreaker.refetchInterval,
    refetchIntervalInBackground: false,
    // No per-fetch retry: this is a poll, so the next tick IS the retry, and
    // the circuit breaker above already tracks consecutive tick failures —
    // an extra retry here would just delay that signal.
    retry: false,
  });

  useEffect(() => {
    telemetryBreaker.report(telemetryQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetryQuery.isError, telemetryQuery.isSuccess, telemetryQuery.dataUpdatedAt, telemetryQuery.errorUpdatedAt]);

  // Surface the breaker opening once per episode — not on every failed tick.
  useEffect(() => {
    if (!telemetryBreaker.isOpen) return;
    notifications.show({
      title: "Workspace is having trouble responding",
      message: "We'll keep trying in the background — some data may be out of date.",
      color: "orange",
      autoClose: 8000,
    });
  }, [telemetryBreaker.isOpen]);

  useEffect(() => {
    if (!telemetryQuery.data) return;
    setRuns(telemetryQuery.data.runs);
    setSessions(telemetryQuery.data.sessions);
  }, [telemetryQuery.data]);

  // isPending (not isLoading) so `loading` stays true while the query is disabled
  // (no cogniInstance yet) — matching previous behavior where the fetch effect
  // simply never ran without an instance.
  useEffect(() => {
    if (!telemetryQuery.isPending) setLoading(false);
  }, [telemetryQuery.isPending]);

  return { runs, sessions, loading };
}

```

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useDataSourceStatuses.ts`
```
"use client";

import { useEffect, useState } from "react";
import getConnectionStatus from "@/modules/integrations/getConnectionStatus";
import type { NodeStatus } from "@/app/(app)/dashboard/partials/redesign/MemoryFlowDiagram";

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
 */
export function useDataSourceStatuses(providers: string[], tenantId: string | null): Record<string, NodeStatus> {
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({});
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
    Promise.all(
      list.map(async (provider): Promise<[string, NodeStatus]> => {
        try {
          const status = await getConnectionStatus(provider, tenantId);
          return [provider, status.connected || status.viaRouting ? "connected" : "disconnected"];
        } catch (e: unknown) {
          console.warn(`[dashboard] connection status failed for ${provider}:`, e);
          return [provider, "disconnected"];
        }
      }),
    ).then((entries) => {
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
        notifications.show({
          title: "Knowledge graph build failed",
          message: `Files were added, but building the knowledge graph failed: ${error instanceof Error ? error.message : String(error)}`,
          color: "red",
        });
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

### Core Architecture Module: `cognee-frontend/src/app/(app)/dashboard/hooks/useOnboardingRedirect.ts`
```
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCogniInstance, useTenant } from "@/modules/tenant/TenantProvider";
import { useUser } from "@/modules/users/UserContext";

/**
 * Side-effect-only hook. Onboarding is shown exactly once per user, ever —
 * right after welcome, never re-forced based on activity, and never reset
 * by creating or switching workspaces. onboardingCompletedAt (from /me) is
 * the only signal; there is no local fallback, so it survives sign-out and
 * follows the user across devices.
 */
export function useOnboardingRedirect(): void {
  const { isInitializing } = useCogniInstance();
  const { tenant } = useTenant();
  const { userMe } = useUser();
  const router = useRouter();

  useEffect(() => {
    // tenant === null means a new user is in the provisioning flow —
    // TenantProvider redirects to /welcome; don't race it here.
    if (isInitializing || !tenant) return;
    // userMe === null means /me hasn't resolved yet — an unknown, not an
    // answer; redirecting on it would send an already-onboarded user into
    // onboarding on every transient fetch delay.
    if (userMe === null || userMe.onboardingCompletedAt) return;
    router.replace("/onboarding");
  }, [isInitializing, tenant, userMe, router]);
}

```

### Core Architecture Module: `cognee-frontend/src/app/(setup)/onboarding/hooks/useAgentConnectionDetection.ts`
```
"use client";

import { useState, useEffect } from "react";
import type { CogneeInstance } from "@/modules/instances/types";
import getDatasets from "@/modules/datasets/getDatasets";
import { getDatasetDataCount } from "@/modules/datasets/getDatasetData";
import { listSessions, SEARCH_SESSION_PREFIX } from "@/modules/sessions/getSessions";

// Detects agent activity while either the Upload or Recall step is active.
// There is NO generic "did we get an API call" endpoint, so we watch two
// concrete signals and flip on whichever appears first:
//   • a NEW session  → recall / session-scoped calls (carry a session_id)
//   • NEW data docs  → graph-direct uploads (no session_id, so no session)
// Both are baselined when the step opens so only activity AFTER that counts.
export function useAgentConnectionDetection(
  cogniInstance: CogneeInstance | null,
  active: boolean,
): boolean {
  const [connectVerified, setConnectVerified] = useState(false);

  useEffect(() => {
    if (!active || !cogniInstance || connectVerified) return;
    let cancelled = false;
    let primed = false;
    const baselineSessions = new Set<string>();
    let baselineDocs = -1;

    const realSessionIds = (rows: { session_id: string }[]) =>
      rows.map((s) => s.session_id).filter((id) => !id.startsWith(SEARCH_SESSION_PREFIX));

    // Doc count of the default dataset (the onboarding target). -1 = unknown.
    async function docCount(): Promise<number> {
      try {
        const datasets = await getDatasets(cogniInstance!);
        if (!Array.isArray(datasets) || datasets.length === 0) return 0;
        const target = datasets.find((d: { name?: string }) => d.name === "default_dataset") ?? datasets[0];
        if (!target?.id) return 0;
        return await getDatasetDataCount(target.id, cogniInstance!);
      } catch {
        return -1;
      }
    }

    async function check() {
      const [page, docs] = await Promise.all([
        listSessions(cogniInstance!, { range: "24h", limit: 50 }).catch((err) => {
          console.warn("Onboarding progress check: sessions fetch failed", err);
          return null;
        }),
        docCount(),
      ]);
      if (cancelled) return;
      const ids = page ? realSessionIds(page.sessions) : [];
      if (!primed) {
        ids.forEach((id) => baselineSessions.add(id));
        baselineDocs = docs;
        primed = true;
        return;
      }
      const newSession = ids.some((id) => !baselineSessions.has(id));
      const newDocs = docs >= 0 && baselineDocs >= 0 && docs > baselineDocs;
      if (newSession || newDocs) setConnectVerified(true);
    }

    check();
    const id = setInterval(check, 7000);
    return () => { cancelled = true; clearInterval(id); };
  }, [active, cogniInstance, connectVerified]);

  return connectVerified;
}

```

### Core Architecture Module: `cognee-frontend/src/modules/business/computeBrainState.ts`
```
import { hsl } from "d3-color";
import type { BusinessGraphNode, BusinessGraphLink } from "./types";
import type { BusinessEntity, SemanticLink, TypeNode, TypeLink, Anchor, BrainState } from "./sceneTypes";
import { topImportanceCut } from "./canvas/businessEntityLayer";
import { computeConnectedIds } from "./canvas/businessGraphFocus";

// A synthetic source for content ingested with no node_set at all — the
// product's own manual-upload path (rememberData.ts) never sends node_set,
// so a directly-uploaded file's entities/documents used to have NO source
// at all: no Sources tile, no hull, no anchor (they defaulted to world
// origin, per anchorOf), invisible to a focus lens. Attributing them here
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

// Session-memory sets wear the AGENT color family (amber): this memory
// exists because agents talked. Shades keep the three layers apart.
const AGENT_SET_SHADES: Record<string, string> = {
  session_learnings: "#F5A83C",
  user_sessions_from_cache: "#E08E1B",
  agent_trace_feedbacks: "#FFC46B",
};

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
  sessionSetNodes.forEach((n) => {
    const name = n.name as string;
    const base = Object.keys(AGENT_SET_SHADES).find((k) => name.indexOf(k) === 0);
    colors[name] = (base && AGENT_SET_SHADES[base]) || "#F5A83C";
  });
  return colors;
}

function countBySet(nodes: BusinessGraphNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  nodes.forEach((n) => setsOf(n).forEach((s) => { counts[s] = (counts[s] || 0) + 1; }));
  return counts;
}

// Circular layout for sources; session-memory sets get their own arc BELOW
// the sources — without an anchor those entities all pull to (0,0) and bury
// the center.
function buildAnchors(srcNames: string[], sessionNames: string[]): Record<string, Anchor> {
  const anchors: Record<string, Anchor> = {};
  srcNames.forEach((s, i) => {
    const angle = (i / Math.max(srcNames.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const r = srcNames.length > 1 ? 300 : 0;
    anchors[s] = { x: Math.cos(angle) * r * 1.25, y: Math.sin(angle) * r * 0.6 };
  });
  sessionNames.forEach((name, i) => {
    const spread = (i - (sessionNames.length - 1) / 2) * 0.55;
    anchors[name] = { x: Math.sin(spread) * 480, y: 430 + Math.abs(spread) * 60 };
  });
  return anchors;
}

function endId(v: unknown): string {
  return typeof v === "object" && v !== null ? String((v as { id: string }).id) : String(v);
}

function withEndpointIds<T extends BusinessGraphLink>(links: T[]): (T & { _sid: string; _tid: string })[] {
  return links.map((l) => ({ ...l, _sid: endId(l.source), _tid: endId(l.target) }));
}

// The business-model (L0) layer: entity TYPES and how they relate —
// "campaign generates customer", not individual campaigns. Types float at
// the centroid of their members, computed each draw frame by the canvas.
function buildTypeLayer(
  entities: BusinessEntity[],
  links: (BusinessGraphLink & { _sid: string; _tid: string })[],
  byId: Record<string, BusinessGraphNode>,
  semanticLinks: SemanticLink[],
): { typeNodes: TypeNode[]; typeLinks: TypeLink[] } {
  const typeName: Record<string, string> = {};
  links.forEach((l) => {
    const s = byId[l._sid], t = byId[l._tid];
    if (s && t && s.stage === "entity" && t.stage === "type" &&
      (l.relation === "is_a" || l.relation === "instance_of")) {
      typeName[s.id] = t.name as string;
    }
  });

  const buckets: Record<string, TypeNode> = {};
  entities.forEach((n) => {
    const tn = typeName[n.id] || "other";
    const bucket = (buckets[tn] = buckets[tn] || { name: tn, members: [], sets: {} });
    bucket.members.push(n);
    setsOf(n).forEach((s) => { bucket.sets[s] = (bucket.sets[s] || 0) + 1; });
  });

  const links2: Record<string, TypeLink> = {};
  semanticLinks.forEach((l) => {
    const a = typeName[l._sid] || "other", b = typeName[l._tid] || "other";
    if (a === b) return;
    const relation = l.relation || "related";
    const key = `${a}→${b}|${relation}`;
    const slot = (links2[key] = links2[key] || { a, b, relation, count: 0 });
    slot.count += 1;
  });

  return { typeNodes: Object.values(buckets), typeLinks: Object.values(links2) };
}

const HUB_MIN_DEGREE = 2;

// The graph-dashboard "single point of failure" callout: whichever entity
// carries the most connections, and how many distinct sources those
// connections span. Below HUB_MIN_DEGREE the number is noise (any entity
// with one link "wins" by default on a sparse graph), so this returns null
// rather than surface a meaningless hub.
function computeHubInsight(
  semanticLinks: SemanticLink[],
  byId: Record<string, BusinessGraphNode>,
): BrainState["hub"] {
  const degree: Record<string, number> = {};
  const touchedSets: Record<string, Set<string>> = {};
  semanticLinks.forEach((l) => {
    const sSets = setsOf(byId[l._sid] || ({} as BusinessGraphNode));
    const tSets = setsOf(byId[l._tid] || ({} as BusinessGraphNode));
    [l._sid, l._tid].forEach((id) => {
      degree[id] = (degree[id] || 0) + 1;
      const bucket = (touchedSets[id] = touchedSets[id] || new Set());
      sSets.forEach((s) => bucket.add(s));
      tSets.forEach((s) => bucket.add(s));
    });
  });
  let bestId: string | null = null;
  let bestDegree = 0;
  Object.entries(degree).forEach(([id, d]) => 
```

### Core Architecture Module: `cognee-frontend/src/modules/business/panels/BusinessEmptyState.tsx`
```
"use client";

import { usePrefersReducedMotion } from "@/modules/business/usePrefersReducedMotion";

// The sad counterpart to BusinessLoading's breathing, converging graph: two
// nodes reaching for each other over a dashed line that never resolves into
// a real edge, with a third drooping below as if it gave up. Sits over
// BusinessCanvas's ambient starfield, which keeps rendering underneath
// regardless of this state.
export default function BusinessEmptyState({ label }: { label: string }): React.JSX.Element {
  const reducedMotion = usePrefersReducedMotion();
  const driftClass = reducedMotion ? "" : "animate-pulse";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden="true">
        <line x1="26" y1="28" x2="60" y2="32" stroke="#7E8CA6" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="3 5" />
        <line x1="26" y1="28" x2="34" y2="62" stroke="#7E8CA6" strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="2 6" />
        <circle cx="26" cy="28" r="5" fill="#7E8CA6" fillOpacity="0.55" className={driftClass} />
        <circle cx="60" cy="32" r="4" fill="#7E8CA6" fillOpacity="0.35" className={`${driftClass} delay-300`} />
        <circle cx="34" cy="62" r="3.5" fill="#7E8CA6" fillOpacity="0.25" className={`${driftClass} delay-150`} />
      </svg>
      <span className="max-w-[280px] text-sm text-[#7E8CA6]">{label}</span>
    </div>
  );
}

```

### Core Architecture Module: `cognee-frontend/src/modules/business/textUtils.ts`
```
// Shared by anything capping a string with an ellipsis — the Q&A list in
// NodePanel and SessionMemoryCard, the live-events quiet chip and narration
// in BusinessView. businessDraw.ts's truncateLabel is intentionally separate
// (fixed cap, no `max` param) — it caps canvas labels, a different shape of
// problem than truncating a line of UI text.
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

```

### Core Architecture Module: `cognee-frontend/src/modules/chat/hooks/useChat.ts`
```
import { v4 } from "uuid";
import { useCallback, useState } from "react";
import { useBoolean } from "@/utils";
import { Dataset } from "@/modules/ingestion/useDatasets";
import { CogneeInstance } from "@/modules/instances/types";

interface ChatMessage {
  id: string;
  user: "user" | "system";
  text: string;
}

const fetchMessages = (instance: CogneeInstance) => {
  return instance.fetch("/v1/search")
    .then(response => response.json());
};

const sendMessage = (message: string, searchType: string, topK: number, instance: CogneeInstance) => {
  return instance.fetch("/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: message,
      searchType,
      datasets: ["main_dataset"],
      top_k: topK,
    }),
  })
    .then(response => response.json());
};

export default function useChat(dataset: Dataset, instance: CogneeInstance) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const {
    value: isSearchRunning,
    setTrue: disableSearchRun,
    setFalse: enableSearchRun,
  } = useBoolean(false);

  const refreshChat = useCallback(async () => {
    const data = await fetchMessages(instance);
    return setMessages(data);
  }, [instance]);

  const handleMessageSending = useCallback((message: string, searchType: string, topK: number) => {
    const sentMessageId = v4();

    setMessages((messages) => [
      ...messages,
      {
        id: sentMessageId,
        user: "user",
        text: message,
      },
    ]);

    disableSearchRun();

    return sendMessage(message, searchType, topK, instance)
      .then(newMessages => {
        setMessages((messages) => [
          ...messages,
          ...newMessages.map((newMessage: string | []) => ({
            id: v4(),
            user: "system",
            text: convertToSearchTypeOutput(newMessage, searchType),
          })),
        ]);
      })
      .catch(() => {
        setMessages(
          (messages) => messages.filter(message => message.id !== sentMessageId),
        );
        throw new Error("Failed to send message. Please try again. If the issue persists, please contact support.")
      })
      .finally(() => enableSearchRun());
  }, [disableSearchRun, enableSearchRun, instance]);

  return {
    messages,
    refreshChat,
    sendMessage: handleMessageSending,
    isSearchRunning,
  };
}


interface Node {
  name: string;
}

interface Relationship {
  relationship_name: string;
}

type InsightMessage = [Node, Relationship, Node];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertToSearchTypeOutput(systemMessage: any[] | any, searchType: string): string {
  if (Array.isArray(systemMessage) && systemMessage.length === 1 && typeof(systemMessage[0]) === "string") {
    return systemMessage[0];
  }

  switch (searchType) {
    case "INSIGHTS":
      return systemMessage.map((message: InsightMessage) => {
        const [node1, relationship, node2] = message;
        if (node1.name && node2.name) {
          return `${node1.name} ${relationship.relationship_name} ${node2.name}.`;
        }
        return "";
      }).join("\n");
    case "SUMMARIES":
      return systemMessage.map((message: { text: string }) => message.text).join("\n");
    case "CHUNKS":
      return systemMessage.map((message: { text: string }) => message.text).join("\n");
    default:
      return systemMessage;
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5154** (2026-09-21): **[Bug]: PreCompact Hook Aborts Compaction on MacOS When CLAUDE_PLUGIN_ROOT has a space**
  *Symptoms*: ### Bug Description  On the Mac, the Claude plugin root is often in ~/Library/Application Support/Claude/...  Note the space in the directory name. The commands in the hooks.json file have the form "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/pre-compact.py"  When that expands, it results in a broken command because of the space in the directory name.  The command strings would work if they were given as:  "python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/pre-compact.py\""    ### Steps to Reproduce  1. Install Cognee with its skills on Claude on MacOS 2. Attempt to compact any session with /compact 3. Witness the error 4.   ### Expected Behavior  Compaction should run as expected  ### Actual Behavior  An attempt to compact in another session returned this error:  Compaction blocked by PreCompact hook: [python3 ${CLAUDE_PLUGIN_ROOT}/scripts/pre-compact.py]: /opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python: can't open file '/Users/eli/Library/Application': [Errno 2] No such file or directory  ### Environment  MacOS Tahao 26.6.2 Claude (latest) Cognee (latest)   ### Logs/Error Messages  ```shell  ```  ### Additional Context  _No response_  ### Pre-submission Checklist  - [x] I have searched existing issues to ensure this bug hasn't been reported already - [x] I have provided a clear and detailed description of the bug - [x] I have included steps to reproduce the issue - [x] I have included my environment det
  **Post-Mortem & Fix Analysis**:
  > Hey @eliasisrael, thanks for raising this issue, good catch! This has been fixed in the newest version of the plugin, now the root is quoted correctly. Closing this issue, if you have any other issues/comments, do not hesitate to raise them here or on our [integrations repo](https://github.com/topoteretes/cognee-integrations).

- **Issue #5145** (2026-09-24): **[Bug]: cognee-mcp: entrypoint.sh overrides runtime --transport and Dockerfile healthcheck ignores HTTP_PORT**
  *Symptoms*: ### Bug Description  Two related defects in the cognee-mcp container packaging (cognee-mcp/entrypoint.sh and cognee-mcp/Dockerfile), both about the container not honouring the configuration it is given.  1. The entrypoint says it forwards any args passed to the container at runtime, but it builds the argument list as user args first, then appends --transport $TRANSPORT_MODE (and --host/--port/--api-url/--api-token) after them. argparse takes the last occurrence, so any --transport the user passes on the docker run command line is silently replaced by the env-derived default (stdio when TRANSPORT_MODE is unset). Because --host 0.0.0.0 --port are only added when TRANSPORT_MODE is not stdio, the user's HTTP transport also ends up with no bind args. 2. The HEALTHCHECK probes the literal URL http://localhost:8000/health. The entrypoint honours an HTTP_PORT env var and passes it as --port, so a container started with HTTP_PORT=9000 serves on 9000 while the health probe keeps hitting 8000 and the container is marked unhealthy.  ### Steps to Reproduce  1 (transport override): ``` docker run --rm cognee/cognee-mcp:main --transport http ``` or, with a stub on PATH that echoes its argv, run `bash entrypoint.sh --transport http` and inspect the argv passed to `cognee-mcp`.  2 (healthcheck): ``` docker run -d --name mcp -e TRANSPORT_MODE=http -e HTTP_PORT=9000 -p 9000:9000 cognee/cognee-mcp:main sleep 90 docker inspect --format '{{.State.Health.Status}}' mcp curl -s http://localhost:9000/
  **Post-Mortem & Fix Analysis**:
  > Confirmed both defects against `cognee-mcp/entrypoint.sh` + `Dockerfile` — the env-derived flags are appended after `"$@"` (argparse keeps the last occurrence, so the runtime `--transport` is silently replaced), and the HEALTHCHECK probes the hardcoded 8000 while the entrypoint binds `HTTP_PORT`.  Taking this: reorder in `entrypoint.sh` so env defaults come first and `"$@"` is appended last (and skip appending flags the user already supplied), and make the Dockerfile healthcheck target `${HTTP_PORT:-8000}`. Will follow up with a PR shortly.
  > cc @dexters1 @Vasilije1990 
  > Thanks for flagging this - it's been seen and noted. It's on us to address now - we'll let you know how it goes.

- **Issue #5144** (2026-09-24): **[Bug]: Embedding request payload is not exposed in OpenTelemetry traces**
  *Symptoms*: ### Bug Description  When OTEL is activated, i can see completion request (thanks to `observe` decorator). But i can't see any traces for embedding.  ### Steps to Reproduce  1. Enable Cognee tracing with COGNEE_TRACING_ENABLED=true. 2. Configure OTEL_EXPORTER_OTLP_ENDPOINT and, if necessary, OTEL_EXPORTER_OTLP_HEADERS. 3. Configure a remote embedding provider, such as LiteLLM/OpenAI-compatible or Ollama. 4. Run a Cognee operation that triggers embedding generation (add, cognify, or an equivalent operation). 5. Check the spans exported to the OTEL backend.6. Look for spans corresponding to embedding requests and their input payload.  ### Expected Behavior  OTEL traces should allow identifying embedding calls and viewing, at a minimum, their request metadata: provider, model, endpoint, batch size, number and size of inputs, and specific parameters like dimensions or input_type. The complete textual payload should be available via an explicit and secure option for diagnostic purposes.  ### Actual Behavior  No span of genai for embedding action  ### Environment  local / docker compose / otel collector + langfuse  ### Logs/Error Messages  <img width="674" height="375" alt="Image" src="https://github.com/user-attachments/assets/d9a4fbeb-8e1a-446c-9bc5-50b42e8c203e" />  ### Additional Context  _No response_  ### Pre-submission Checklist  - [x] I have searched existing issues to ensure this bug hasn't been reported already - [x] I have provided a clear and detailed description of the
  **Post-Mortem & Fix Analysis**:
  > Hi, I’d like to work on this issue. Could a maintainer please assign it to me?  I traced the missing spans to the embedding engines: completion adapters use `@observe(as_type="generation")`, while embedding requests currently bypass the observation layer.  My proposed implementation is:  - add first-class `as_type="embedding"` support to the existing observer; - instrument LiteLLM, OpenAI-compatible, Ollama and FastEmbed engines; - emit OpenTelemetry GenAI attributes for operation, provider, model, dimensions and endpoint; - include safe request metadata such as input count, total/max input size, batch size and `input_type`; - mark the span as `langfuse.observation.type = "embedding"`; - keep textual inputs disabled by default and expose them only through an explicit opt-in, with secret redaction, configurable truncation and no credentials or authorization headers; - keep retries and recursive context-window splitting inside one logical embedding span; - add unit tests for metadata, pa
  > Thanks for flagging this - it's been noted. It's a smaller one, so it may be a while before it's addressed, but we'll update you here.
  > I'm investigating this - will audit existing gen_ai spans (observe/tracing) and what the embedding adapters actually return first, then share findings before opening a PR.

- **Issue #5083** (2026-09-16): **[Bug]: Deadlock from shared Kuzu/ Ladybug lock**
  *Symptoms*: ### Bug Description  Due to misconfiguration in embedding model name, a lock acquired as postgres advisory lock to process embedding got left dangling when client tried to store into memory. Since there's no release mechanism in place for this specific codepath, it will acummulate in idle state.  Given enough time, or sufficient memory store call, this would cause server to fail silently while MCP still return OK on store with error in during search.  ### Steps to Reproduce  1. configure cognee to use nonexistent embedding model. 2. start the docker compose stack. 3. from client with mcp configured, send instruction to store something to memory. optionally ask client to inform return status.  ### Expected Behavior  either:  - memory stored correctly - the lock is released within reasonable time  ### Actual Behavior  - when asked to confirm delivery, client show the following status      ```     [cognee-remember] cognify ERRORED for dataset 6b23b270-c5c8-52fa-b705-ee3d856bb56c     [cognee-search] {"ok": true, "dataset_id": "6b23b270-c5c8-52fa-b705-ee3d856bb56c", "status": "running", "wait_outcome": "errored", "queryable": false}     ```  - observing docker log shows the advisory lock never released and. - with repeated attempt: `Exception caught while processing data: QueuePool limit of size 2 overflow 10 reached, connection timed out, timeout 30.00`  ### Environment  - OS: Linux host, docker based on reference compose file - Cognee: Pinned to `v1.5.3` - LLM Provider: Deepseek
  **Post-Mortem & Fix Analysis**:
  > @bangbambang if you are on v1.5.3 of Cognee update to v1.5.4 the issue is resolved there

- **Issue #5012** (2026-09-17): **[Bug]: cognify_status is unreliable in API mode**
  *Symptoms*: ### Bug Description  `cognee-mcp/src/server.py:1537-1549` (cognify_status) passes the requested pipeline name to `CogneeClient.get_pipeline_status()`, but the API-mode branch of the method (cognee-mcp/src/cognee_client.py:477-485) only sends ``dataset=<id>`` to ``GET /api/v1/datasets/status`` and never the pipeline name. The server endpoint (`cognee/api/v1/datasets/routers/get_datasets_router.py: 448-451`, `StatusPipelineNamesQuery alias="pipeline"`) defaults to `cognify_pipeline` the param is omitted. So ``cognify_status(pipelines=["add_pipeline"])`` or ``code_graph_pipeline"]`` returns cognify_pipeline's status, and the multi-pipeline branch labels that same value under every requested pipeline name.  ### Steps to Reproduce  ```python import sys import pathlib  # Resolve the cognee-mcp package root relative to this file (cognee-mcp/tests/). MCP_ROOT = pathlib.Path(__file__).resolve().parent.parent sys.path.insert(0, str(MCP_ROOT))  import asyncio  # noqa: E402  import httpx  # noqa: E402 import pytest  # noqa: E402  import src.server as server  # noqa: E402 from src.cognee_client import CogneeClient  # noqa: E402  DATASET_ID = "11111111-1111-1111-1111-111111111111"   def _api_client(calls):     def handler(request):         calls.append(request)         if request.url.path == "/api/v1/datasets/":             return httpx.Response(200, json=[{"id": DATASET_ID, "name": "main_dataset"}])         if request.url.path == "/api/v1/datasets/status":             return httpx.Respons
  **Post-Mortem & Fix Analysis**:
  > @Vasilije1990 @dexters1  Hii guys, may i know how to esclate work on this one ? could someone review the issue, so I could know the next steps?

- **Issue #4959** (2026-09-17): **[Bug]: cognee-cli -ui aborts when optional MCP port 8001 is occupied**
  *Symptoms*: ### Description  `cognee-cli -ui` starts the frontend, backend, and optional MCP server together. Its initial port preflight currently treats all three ports as mandatory. If the optional MCP port (8001 by default) is occupied, `start_ui` returns before starting the otherwise available frontend and backend.  This differs from the existing Docker preflight behavior, which skips MCP and continues launching the UI/backend when Docker is unavailable.  ### Steps to reproduce  1. Leave ports 3000 and 8000 free. 2. Bind another local process to port 8001. 3. Run `uv run cognee-cli -ui`.  ### Actual behavior  Startup aborts with messages similar to:  ```text Port 8001 is already in use for MCP Server Cannot start cognee UI: The following services have ports already in use: MCP Server (port 8001) Error: Failed to start UI server ```  Neither the frontend nor backend starts.  ### Expected behavior  Frontend/backend port conflicts should remain fatal. An occupied MCP port should emit a warning, skip the optional MCP server, and continue starting the UI/backend, matching the current Docker-unavailable fallback.  ### Environment  - Cognee runtime: 1.5.3 - macOS, local CLI/UI  I reproduced this with another local service bound to `127.0.0.1:8001` and confirmed the same preflight logic is present on `dev`. 

- **Issue #4879** (2026-09-04): **[Bug]: Operation records make an unbuilt graph look warm**
  *Symptoms*: ### Bug Description  `graph_warmup` uses the `pipeline_runs` table to decide whether a dataset's graph is ready. `record_operation()` also writes rows to this table for operations such as `remember()`. These rows have `pipeline_name = NULL` and `status = NULL` because they are not pipeline runs.  The probe's fallback checks only whether any row exists for the dataset. A session-only `remember(..., session_id=..., self_improvement=False)` can therefore make a dataset with no graph-building pipeline appear `warm`.  The false `warm` result skips the `memory_warming_up` safeguard and enters graph retrieval for an unbuilt dataset. No exception is raised, and the incorrect verdict may remain cached for the warm-up TTL.  ### Steps to Reproduce  ```python import cognee from cognee import SearchType   async def reproduce():     await cognee.remember(         "temporary session context",         dataset_name="warmup_repro",         session_id="session-1",         self_improvement=False,     )      return await cognee.recall(         "temporary session context",         datasets=["warmup_repro"],         query_type=SearchType.GRAPH_COMPLETION,     ) ```  The `remember()` call creates an operation row like:  ```text dataset_id     = <warmup_repro id> operation_name = "remember" pipeline_name  = NULL status         = NULL ```  ### Expected Behavior  An operation row should not count as graph-readiness evidence. With no graph build, the probe should return `never_built` and recall should r
  **Post-Mortem & Fix Analysis**:
  > Working on this.
  > > Working on this.  Thanks for your effort on this PR! My apologies for forgetting to close the issue after merging the fix. Note that PRs to this project should target the `dev` branch. This is why there was no conflict detected between our two PRs.   Wish you well in your future work!

- **Issue #4673** (2026-09-03): **[Bug]:  Cloud tenant — POST /api/v1/add and POST /api/v1/search hang forever while all other routes answer in <1.2 s**
  *Symptoms*: ### Bug Description  <html> <body> <!--StartFragment--><p dir="ltr">On a Cognee Cloud tenant (app version 1.5.0), exactly two routes accept the TCP connection and then never respond: <code>POST /api/v1/add</code> and <code>POST /api/v1/search</code>. No HTTP status, no body, zero bytes — the client just times out. Every other route on the same host, with the same API key, over the same connection, responds in under 1.2 seconds, and <code>/health</code> reports all components healthy.</p>  <p dir="ltr">The tenant has been unable to read or write memory for <strong>56 hours</strong> and counting. <code>uptime</code> in <code>/health</code> shows the instance has not restarted in that time.</p>  <ul dir="ltr"> <li>Tenant ID: <code>d47b2513-b790-4438-8824-622e9f028f21</code></li> <li>Version: 1.5.0 (from <code>/health</code>)</li> <li>Outage start: <strong>2026-08-23 07:21:32 UTC</strong> (last successful write; last successful search 07:19:22 UTC)</li> <li>Still reproducing: 2026-08-25 15:36 UTC, <code>uptime</code> 356,367 s</li> </ul>  <h2 dir="ltr">The most useful detail: it hangs <em>before</em> request validation</h2>  <p dir="ltr">The same malformed body <code>{"unsinn":1}</code> sent to three POST routes:</p>  <div dir="ltr"> Request | Result -- | -- POST /api/v1/datasets/ | 422 in 0.67 s — Field required: name POST /api/v1/cognify | 400 in 0.73 s — No datasets or dataset_ids provided POST /api/v1/search | no response after 40 s  </div>  <p dir="ltr">Independent of <code>
  **Post-Mortem & Fix Analysis**:
  > Thank you very much for the report. You pointed out a valid edge case. We are currently testing a fix for it, and it will be rolled out as soon as possible.
  > <html> <body> <!--StartFragment--><p dir="ltr">Update after ~35 hours, in case it helps whoever is testing the fix.</p>  <p dir="ltr"><strong>The instance was restarted, and the defect survived it.</strong> Measured from our side:</p>  <div dir="ltr"> Time (UTC) | /health uptime | Meaning -- | -- | -- 2026-08-25 15:50:49 | 357,223 s | no restart for 4d 3h 2026-08-25 17:59:58 | 1,023 s | restarted ≈ 17:43 2026-08-26 04:58:29 | 40,540 s | same instance since ≈ 17:43, no further restart  </div>  <p dir="ltr">Right after that restart, one of four datasets briefly reached <code>DATASET_PROCESSING_COMPLETED</code> — the first movement in 58 hours. By 20:01 UTC it had fallen back to <code>DATASET_PROCESSING_INITIATED</code>, and all four have stayed <code>INITIATED</code> since.</p>  <p dir="ltr"><strong>Current state, 2026-08-26 04:58 UTC</strong> — unchanged from the original report:</p>  <div role="group" aria-label="Code" tabindex="0"><div><div></div></div><div><pre style="color: rgb(234,
  > Status update, and a concrete request.  Nothing has changed in 40 hours. Measured 2026-08-27 10:00 UTC:  POST /api/v1/search → http=000 after 20 s, 0 bytes POST /api/v1/add → http=000 after 20 s, 0 bytes GET /health → 200, version 1.5.0, uptime 145,061 s — same process since the restart on 2026-08-25 ≈17:43 UTC, no further restart since GET /api/v1/datasets/status → all four datasets still DATASET_PROCESSING_INITIATED  Watchdog totals since 2026-08-24 16:25 UTC: 257 probes of POST /api/v1/search, 257 × http=000, zero successes. Total outage 98 h 39 min.  I understand a root-cause fix takes time, and I am not asking you to rush it. But we have now been without a usable tenant for four days, so I would like to ask a different question:  Can this tenant be reset or re-provisioned, without waiting for the fix?  To make that easy to say yes to:  No data recovery needed. Every document in this tenant exists in our own local ledger. If you reset it to empty, or give us a fresh tenant, we simp

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

### Incident Patch 1: `b32d8afc` (2026-10-01)
**Commit Message**: fix(ci): Publish cognee-mcp with a token (SDK-898) (#5310)

## Summary

`release_mcp.yml` cannot publish as written. The `cognee-mcp` project
has no trusted publisher on PyPI, so its first run
([36839510671](https://github.com/topoteretes/cognee/actions/runs/36839510671),
1 Oct) built and attested fine and then died at the upload:

```
Trusted publishing exchange failure:
* `invalid-publisher`: valid token, but no corresponding publisher
```

0.5.6 went out by hand instead, with the library's old `PYPI_TOKEN`.
This PR makes the workflow use that same token, so the next MCP release
runs through CI again instead of from a laptop.

## Why a token and not the publisher

Registering a trusted publisher needs the owner of the PyPI project, and
`cognee-mcp` has exactly one role holder. There never was a publisher to
reuse either: 0.5.4 and 0.5.5 carry no provenance on PyPI and no release
workflow ran at either upload time. Both were manual, as #4178 says in
its own release note.

The token is known to work for this project: it is what published 0.5.6
today.

## What changes

- **Publish step:** passes `password: ${{ secrets.PYPI_TOKEN }}`. The
pinned action treats a non-empty password as 

**File**: `.github/workflows/release_mcp.yml` (modified, +30/-8)
```diff
@@ -8,11 +8,18 @@ name: release_mcp.yml
 # hand, which is how the package sat at 0.5.5 for seven weeks while ~40 commits
 # (the whole FastMCP 3 migration) went unpublished.
 #
-# Same supply-chain posture as release.yml: PyPI Trusted Publishing over OIDC
-# (no API token), PEP 740 attestations on the uploaded files, and a SLSA build
-# provenance attestation hosted by GitHub. One-time PyPI setup is described in
-# docs/supply_chain_provenance.md — the `cognee-mcp` project needs its own
-# trusted publisher entry; the one registered for `cognee` does not cover it.
+# Auth: unlike release.yml, this uploads with the PYPI_TOKEN secret. The
+# `cognee-mcp` project has no trusted publisher on PyPI — the one registered for
+# `cognee` does not cover it, and only the project owner can add one — so the
+# first OIDC run (2026-10-01) died at the upload with `invalid-publisher` and
+# 0.5.6 went out by hand with this same token. The token costs the PEP 740
+# attestations on PyPI, which only Trusted Publishing produces; the SLSA build
+# provenance attestation hosted by GitHub is unaffected.
+#
+# The way back is built in: with no PYPI_TOKEN secret the publish step uses
+# Trusted Publishing on its own. Register the publisher, delete the secret, and
+# nothing in this file has to change — docs/supply_chain_provenance.md has the
+# fields.
 on:
   workflow_dispatch:
 
@@ -26,7 +33,7 @@ jobs:
     name: Release cognee-mcp to PyPI from ${{ github.ref_name }}
     permissions:
       contents: write       # push the cognee-mcp-v* tag
-      id-token: write       # OIDC: Trusted Publishing + signing attestations
+      id-token: write       # OIDC: signing attestations (+ Trusted Publishing once the token is gone)
       attestations: write   # Persist the SLSA build provenance attestation
     runs-on: ubuntu-latest
     env:
@@ -135,12 +142,27 @@ jobs:
         with:
           subject-path: "cognee-mcp/dist/*"
 
+      - name: Report how the upload will authenticate
+        # Says which path the next step takes before it takes it. The two fail
+        # differently (a rejected token is a 403, a missing publisher is
+        # `invalid-publisher`) and neither message names the cause.
+        env:
+          HAS_PYPI_TOKEN: ${{ secrets.PYPI_TOKEN != '' }}
+        run: |
+          if [ "${HAS_PYPI_TOKEN}" = "true" ]; then
+            echo "::notice::Uploading with the PYPI_TOKEN secret (no PEP 740 attestations)."
+          else
+            echo "::notice::No PYPI_TOKEN secret: uploading via Trusted Publishing, which needs the cognee-mcp publisher registered on PyPI."
+          fi
+
       - name: Publish cognee-mcp ${{ steps.meta.outputs.version }} to PyPI
-        # Trusted Publishing (OIDC) — no API token. The action generates and
-        # uploads PEP 740 digital attestations by default.
+        # The action picks its path from `password`. Non-empty: token auth, and
+        # it warns and skips attestations, which need OIDC. Empty: Trusted
+        # Publishing, with PEP 740 attestations uploaded by default.
         uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33  # v1.14.2 (twine 7.0.0: accepts Metadata-Version 2.5)
         with:
           packages-dir: cognee-mcp/dist/
+          password: ${{ secrets.PYPI_TOKEN }}
 
       - name: Tag the released commit
         # After the upload, not before: a tag that points at an unpublished
```

**File**: `docs/supply_chain_provenance.md` (modified, +33/-10)
```diff
@@ -22,10 +22,11 @@ The relevant workflows are `.github/workflows/release.yml` (tagged library relea
 ## One-time setup: PyPI Trusted Publishing
 
 PyPI only accepts and displays PEP 740 attestations when a package is uploaded
-through **Trusted Publishing** (OpenID Connect), not an API token. The release
+through **Trusted Publishing** (OpenID Connect), not an API token. The library
 workflows have already been switched to OIDC (`id-token: write`, no
 `UV_PUBLISH_TOKEN`), but a project owner must register the trusted publishers
-on PyPI **once**:
+on PyPI **once**. `release_mcp.yml` is the exception until its publisher exists:
+see [cognee-mcp still uploads with a token](#cognee-mcp-still-uploads-with-a-token).
 
 PyPI scopes trusted publishers per project. Register **three** publishers, one
 per workflow: two on `cognee` and one on the separate `cognee-mcp` project.
@@ -60,16 +61,38 @@ per workflow: two on `cognee` and one on the separate `cognee-mcp` project.
 Release MCP by running `release_mcp.yml` from the `main` branch in the Actions
 tab. Other refs fail explicitly. The workflow reads the version from
 `cognee-mcp/pyproject.toml`, refuses to run if that version is already on PyPI,
-publishes over OIDC, and tags the commit `cognee-mcp-v<version>` (its own
-namespace, since cognee-mcp versions independently of the library).
+uploads it, and tags the commit `cognee-mcp-v<version>` (its own namespace,
+since cognee-mcp versions independently of the library).
 
-After the publishers are registered, the next release uploads with provenance
-automatically. The legacy `PYPI_TOKEN` secret can be removed once a release has
-succeeded via Trusted Publishing.
+After the publishers are registered, the next library release uploads with
+provenance automatically.
 
-> ⚠️ **Do not run a release before the publishers are registered** — the publish
-> step will fail OIDC auth. The release workflow is `workflow_dispatch`-only, so
-> you control the timing.
+> ⚠️ **Do not run a library release before its publishers are registered** — the
+> publish step will fail OIDC auth. The release workflow is
+> `workflow_dispatch`-only, so you control the timing.
+
+### cognee-mcp still uploads with a token
+
+The `cognee-mcp` publisher in the table above has not been registered, and only
+the owner of that PyPI project can add it. Until then `release_mcp.yml` uploads
+with the `PYPI_TOKEN` repository secret, the account-wide token the library used
+before it moved to OIDC. Two consequences:
+
+- `cognee-mcp` files on PyPI carry no PEP 740 attestations. That includes 0.5.6,
+  which was uploaded by hand with the same token on 2026-10-01 after the first
+  OIDC run failed with `invalid-publisher`. The SLSA build provenance on GitHub
+  is still produced for every workflow release.
+- The token can publish every project its account owns, `cognee` included, so
+  it is a broader credential than this workflow needs.
+
+Moving over needs no workflow change, because the publish step uses Trusted
+Publishing whenever the secret is absent. Do it in this order:
+
+1. Register the `cognee-mcp` publisher from the table above.
+2. Delete the `PYPI_TOKEN` secret.
+
+The order matters. Deleting the secret first leaves MCP releases with no way to
+authenticate.
 
 ---
 
```

---

### Incident Patch 2: `ac0d43f3` (2026-10-01)
**Commit Message**: fix(ci): Gate MCP re-lock on PyPI's simple index (SDK-898) (#5301)

## Summary

`bump-mcp-lock` has failed on **every** release since it shipped —
1.6.0, 1.6.1, 1.6.2. Because `release-mcp-docker-image` has `needs:
[release-github, bump-mcp-lock]`, it was skipped on all three, so **the
versioned `cognee/cognee-mcp:1.6.x` images were never published** — the
newest versioned MCP image on Docker Hub is `1.5.0`, from Aug 15.
`:latest` and `:main` do keep updating on every push to main via
`dockerhub-mcp.yml`, but they're built from `cognee-mcp/uv.lock`, which
is still pinned to cognee **1.5.4** while the SDK is at **1.6.2** — so
`cognee/cognee-mcp:latest` currently ships cognee 1.5.4, the exact
tag/library mismatch from #4360.

This PR fixes the job and does the overdue re-lock. Two commits,
independently revertible.

## Root cause: a CDN race, not a dependency conflict

The failure looks like a resolver conflict:

```
error: No solution found when resolving dependencies for split
       (markers: python_full_version == '3.13.*' and sys_platform == 'linux')
  cause: Because your project depends on cognee[postgres-binary]>=1.5.0 and cognee==1.6.2,
         we can conclude that your proj

**File**: `.github/workflows/release.yml` (modified, +28/-5)
```diff
@@ -310,26 +310,49 @@ jobs:
         uses: astral-sh/setup-uv@37802adc94f370d6bfd71619e3f0bf239e1f3b78  # v7.6.0
 
       - name: Wait for cognee ${{ needs.release-github.outputs.version }} on PyPI
+        # Poll the simple index, not the JSON API. uv resolves through
+        # /simple/cognee/, which PyPI serves through Fastly with max-age=600 and
+        # which is hot enough to be cached almost always. The per-version JSON
+        # URL is brand new at release time, so it misses the cache and reports
+        # the release ~26s after upload while /simple/ can trail it by up to 10
+        # minutes. Gating on the JSON API let this job race the CDN and fail on
+        # 1.6.0, 1.6.1 and 1.6.2 with a resolver error that looked like a
+        # dependency conflict (SDK-898).
         env:
           VERSION: ${{ needs.release-github.outputs.version }}
         run: |
           for attempt in $(seq 1 60); do
-            if curl -sf "https://pypi.org/pypi/cognee/${VERSION}/json" > /dev/null; then
-              echo "cognee ${VERSION} is live on PyPI."
+            if curl -sf -H "Accept: application/vnd.pypi.simple.v1+json" \
+                "https://pypi.org/simple/cognee/" \
+                | python3 -c 'import json, os, sys; sys.exit(os.environ["VERSION"] not in json.load(sys.stdin)["versions"])'; then
+              echo "cognee ${VERSION} is in PyPI's simple index."
               exit 0
             fi
-            echo "Attempt ${attempt}/60: cognee ${VERSION} not on PyPI yet; retrying in 15s..."
+            echo "Attempt ${attempt}/60: cognee ${VERSION} not in the simple index yet; retrying in 15s..."
             sleep 15
           done
-          echo "::error::cognee ${VERSION} did not appear on PyPI within 15 minutes."
+          echo "::error::cognee ${VERSION} did not appear in PyPI's simple index within 15 minutes."
           exit 1
 
       - name: Re-lock cognee-mcp to the released version
         env:
           VERSION: ${{ needs.release-github.outputs.version }}
         working-directory: cognee-mcp
         run: |
-          uv lock --upgrade-package "cognee==${VERSION}"
+          # --refresh-package bypasses any uv cache setup-uv restored, and the
+          # retry covers the CDN edge uv lands on still trailing the one the
+          # wait step's curl saw. Bounded, so a genuine conflict still fails.
+          for attempt in $(seq 1 10); do
+            if uv lock --upgrade-package "cognee==${VERSION}" --refresh-package cognee; then
+              break
+            fi
+            if [ "${attempt}" -eq 10 ]; then
+              echo "::error::uv lock could not resolve cognee ${VERSION} after 10 attempts."
+              exit 1
+            fi
+            echo "Attempt ${attempt}/10: uv lock could not resolve cognee ${VERSION} yet; retrying in 30s..."
+            sleep 30
+          done
           LOCKED_VERSION="$(python3 - <<'PY'
           import tomllib
 
```

---

### Incident Patch 3: `5f415643` (2026-10-01)
**Commit Message**: fix(ci): Publish cognee-mcp with a token (SDK-898)

release_mcp.yml could not publish. The cognee-mcp project has no trusted
publisher on PyPI, so its first run failed at the upload with
`invalid-publisher`, and 0.5.6 was uploaded by hand with the library's old
PYPI_TOKEN instead. Only the project owner can register a publisher, so
until that happens the workflow needs the same token or every MCP release
stays a manual one.

The publish step now passes PYPI_TOKEN as the password. The action treats a
non-empty password as token auth and an empty one as Trusted Publishing, so
the workflow returns to OIDC by itself once the publisher is registered and
the secret is deleted. A step before the upload reports which of the two it
is about to use, because their failures (403 and invalid-publisher) do not
say.

Token uploads carry no PEP 740 attestations; the GitHub build provenance is
unchanged. docs/supply_chain_provenance.md records the state and the order
to migrate in: register the publisher first, delete the secret second.

Signed-off-by: Nikola Živković <[REDACTED_EMAIL]>
Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01D37C1w9uu4im

**File**: `.github/workflows/release_mcp.yml` (modified, +30/-8)
```diff
@@ -8,11 +8,18 @@ name: release_mcp.yml
 # hand, which is how the package sat at 0.5.5 for seven weeks while ~40 commits
 # (the whole FastMCP 3 migration) went unpublished.
 #
-# Same supply-chain posture as release.yml: PyPI Trusted Publishing over OIDC
-# (no API token), PEP 740 attestations on the uploaded files, and a SLSA build
-# provenance attestation hosted by GitHub. One-time PyPI setup is described in
-# docs/supply_chain_provenance.md — the `cognee-mcp` project needs its own
-# trusted publisher entry; the one registered for `cognee` does not cover it.
+# Auth: unlike release.yml, this uploads with the PYPI_TOKEN secret. The
+# `cognee-mcp` project has no trusted publisher on PyPI — the one registered for
+# `cognee` does not cover it, and only the project owner can add one — so the
+# first OIDC run (2026-10-01) died at the upload with `invalid-publisher` and
+# 0.5.6 went out by hand with this same token. The token costs the PEP 740
+# attestations on PyPI, which only Trusted Publishing produces; the SLSA build
+# provenance attestation hosted by GitHub is unaffected.
+#
+# The way back is built in: with no PYPI_TOKEN secret the publish step uses
+# Trusted Publishing on its own. Register the publisher, delete the secret, and
+# nothing in this file has to change — docs/supply_chain_provenance.md has the
+# fields.
 on:
   workflow_dispatch:
 
@@ -26,7 +33,7 @@ jobs:
     name: Release cognee-mcp to PyPI from ${{ github.ref_name }}
     permissions:
       contents: write       # push the cognee-mcp-v* tag
-      id-token: write       # OIDC: Trusted Publishing + signing attestations
+      id-token: write       # OIDC: signing attestations (+ Trusted Publishing once the token is gone)
       attestations: write   # Persist the SLSA build provenance attestation
     runs-on: ubuntu-latest
     env:
@@ -135,12 +142,27 @@ jobs:
         with:
           subject-path: "cognee-mcp/dist/*"
 
+      - name: Report how the upload will authenticate
+        # Says which path the next step takes before it takes it. The two fail
+        # differently (a rejected token is a 403, a missing publisher is
+        # `invalid-publisher`) and neither message names the cause.
+        env:
+          HAS_PYPI_TOKEN: ${{ secrets.PYPI_TOKEN != '' }}
+        run: |
+          if [ "${HAS_PYPI_TOKEN}" = "true" ]; then
+            echo "::notice::Uploading with the PYPI_TOKEN secret (no PEP 740 attestations)."
+          else
+            echo "::notice::No PYPI_TOKEN secret: uploading via Trusted Publishing, which needs the cognee-mcp publisher registered on PyPI."
+          fi
+
       - name: Publish cognee-mcp ${{ steps.meta.outputs.version }} to PyPI
-        # Trusted Publishing (OIDC) — no API token. The action generates and
-        # uploads PEP 740 digital attestations by default.
+        # The action picks its path from `password`. Non-empty: token auth, and
+        # it warns and skips attestations, which need OIDC. Empty: Trusted
+        # Publishing, with PEP 740 attestations uploaded by default.
         uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33  # v1.14.2 (twine 7.0.0: accepts Metadata-Version 2.5)
         with:
           packages-dir: cognee-mcp/dist/
+          password: ${{ secrets.PYPI_TOKEN }}
 
       - name: Tag the released commit
         # After the upload, not before: a tag that points at an unpublished
```

**File**: `docs/supply_chain_provenance.md` (modified, +33/-10)
```diff
@@ -22,10 +22,11 @@ The relevant workflows are `.github/workflows/release.yml` (tagged library relea
 ## One-time setup: PyPI Trusted Publishing
 
 PyPI only accepts and displays PEP 740 attestations when a package is uploaded
-through **Trusted Publishing** (OpenID Connect), not an API token. The release
+through **Trusted Publishing** (OpenID Connect), not an API token. The library
 workflows have already been switched to OIDC (`id-token: write`, no
 `UV_PUBLISH_TOKEN`), but a project owner must register the trusted publishers
-on PyPI **once**:
+on PyPI **once**. `release_mcp.yml` is the exception until its publisher exists:
+see [cognee-mcp still uploads with a token](#cognee-mcp-still-uploads-with-a-token).
 
 PyPI scopes trusted publishers per project. Register **three** publishers, one
 per workflow: two on `cognee` and one on the separate `cognee-mcp` project.
@@ -60,16 +61,38 @@ per workflow: two on `cognee` and one on the separate `cognee-mcp` project.
 Release MCP by running `release_mcp.yml` from the `main` branch in the Actions
 tab. Other refs fail explicitly. The workflow reads the version from
 `cognee-mcp/pyproject.toml`, refuses to run if that version is already on PyPI,
-publishes over OIDC, and tags the commit `cognee-mcp-v<version>` (its own
-namespace, since cognee-mcp versions independently of the library).
+uploads it, and tags the commit `cognee-mcp-v<version>` (its own namespace,
+since cognee-mcp versions independently of the library).
 
-After the publishers are registered, the next release uploads with provenance
-automatically. The legacy `PYPI_TOKEN` secret can be removed once a release has
-succeeded via Trusted Publishing.
+After the publishers are registered, the next library release uploads with
+provenance automatically.
 
-> ⚠️ **Do not run a release before the publishers are registered** — the publish
-> step will fail OIDC auth. The release workflow is `workflow_dispatch`-only, so
-> you control the timing.
+> ⚠️ **Do not run a library release before its publishers are registered** — the
+> publish step will fail OIDC auth. The release workflow is
+> `workflow_dispatch`-only, so you control the timing.
+
+### cognee-mcp still uploads with a token
+
+The `cognee-mcp` publisher in the table above has not been registered, and only
+the owner of that PyPI project can add it. Until then `release_mcp.yml` uploads
+with the `PYPI_TOKEN` repository secret, the account-wide token the library used
+before it moved to OIDC. Two consequences:
+
+- `cognee-mcp` files on PyPI carry no PEP 740 attestations. That includes 0.5.6,
+  which was uploaded by hand with the same token on 2026-10-01 after the first
+  OIDC run failed with `invalid-publisher`. The SLSA build provenance on GitHub
+  is still produced for every workflow release.
+- The token can publish every project its account owns, `cognee` included, so
+  it is a broader credential than this workflow needs.
+
+Moving over needs no workflow change, because the publish step uses Trusted
+Publishing whenever the secret is absent. Do it in this order:
+
+1. Register the `cognee-mcp` publisher from the table above.
+2. Delete the `PYPI_TOKEN` secret.
+
+The order matters. Deleting the secret first leaves MCP releases with no way to
+authenticate.
 
 ---
 
```

---

### Incident Patch 4: `bfb03c63` (2026-10-01)
**Commit Message**: fix(ci): Gate MCP re-lock on PyPI's simple index (SDK-898)

bump-mcp-lock has failed on every release since it shipped (1.6.0,
1.6.1, 1.6.2), and because release-mcp-docker-image needs it, no MCP
image has shipped since Sep 15.

The resolver error looked like a dependency conflict but was a race.
The wait step polled the per-version JSON API, which is brand new at
release time, misses the CDN and reports the release ~26s after upload.
uv lock then started ~100ms later against /simple/cognee/, which PyPI
serves through Fastly with max-age=600 and which is hot enough to be
cached almost always -- so it did not list the new version yet. The
timing was identical to the second on all three releases, and the same
command on the same inputs resolves cleanly everywhere when run later.

Wait on the simple index instead, since that is what uv reads. Re-lock
with --refresh-package so a cache restored by setup-uv cannot serve a
stale page, and retry a bounded number of times because curl and uv can
land on different CDN edges. The bound keeps a genuine conflict failing.

Signed-off-by: Nikola Živković <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +28/-5)
```diff
@@ -310,26 +310,49 @@ jobs:
         uses: astral-sh/setup-uv@37802adc94f370d6bfd71619e3f0bf239e1f3b78  # v7.6.0
 
       - name: Wait for cognee ${{ needs.release-github.outputs.version }} on PyPI
+        # Poll the simple index, not the JSON API. uv resolves through
+        # /simple/cognee/, which PyPI serves through Fastly with max-age=600 and
+        # which is hot enough to be cached almost always. The per-version JSON
+        # URL is brand new at release time, so it misses the cache and reports
+        # the release ~26s after upload while /simple/ can trail it by up to 10
+        # minutes. Gating on the JSON API let this job race the CDN and fail on
+        # 1.6.0, 1.6.1 and 1.6.2 with a resolver error that looked like a
+        # dependency conflict (SDK-898).
         env:
           VERSION: ${{ needs.release-github.outputs.version }}
         run: |
           for attempt in $(seq 1 60); do
-            if curl -sf "https://pypi.org/pypi/cognee/${VERSION}/json" > /dev/null; then
-              echo "cognee ${VERSION} is live on PyPI."
+            if curl -sf -H "Accept: application/vnd.pypi.simple.v1+json" \
+                "https://pypi.org/simple/cognee/" \
+                | python3 -c 'import json, os, sys; sys.exit(os.environ["VERSION"] not in json.load(sys.stdin)["versions"])'; then
+              echo "cognee ${VERSION} is in PyPI's simple index."
               exit 0
             fi
-            echo "Attempt ${attempt}/60: cognee ${VERSION} not on PyPI yet; retrying in 15s..."
+            echo "Attempt ${attempt}/60: cognee ${VERSION} not in the simple index yet; retrying in 15s..."
             sleep 15
           done
-          echo "::error::cognee ${VERSION} did not appear on PyPI within 15 minutes."
+          echo "::error::cognee ${VERSION} did not appear in PyPI's simple index within 15 minutes."
           exit 1
 
       - name: Re-lock cognee-mcp to the released version
         env:
           VERSION: ${{ needs.release-github.outputs.version }}
         working-directory: cognee-mcp
         run: |
-          uv lock --upgrade-package "cognee==${VERSION}"
+          # --refresh-package bypasses any uv cache setup-uv restored, and the
+          # retry covers the CDN edge uv lands on still trailing the one the
+          # wait step's curl saw. Bounded, so a genuine conflict still fails.
+          for attempt in $(seq 1 10); do
+            if uv lock --upgrade-package "cognee==${VERSION}" --refresh-package cognee; then
+              break
+            fi
+            if [ "${attempt}" -eq 10 ]; then
+              echo "::error::uv lock could not resolve cognee ${VERSION} after 10 attempts."
+              exit 1
+            fi
+            echo "Attempt ${attempt}/10: uv lock could not resolve cognee ${VERSION} yet; retrying in 30s..."
+            sleep 30
+          done
           LOCKED_VERSION="$(python3 - <<'PY'
           import tomllib
 
```

---

### Incident Patch 5: `527a7405` (2026-09-29)
**Commit Message**: fix(tokenizer): Mark the optional transformers import for ty

Description: transformers is an optional dependency (huggingface, ollama
and gliner extras), so it is absent from the Code Quality environment and
ty failed with unresolved-import on the adapter's lazy AutoTokenizer
import, which only runs when transformers is installed. Mark it the way
the repo marks its other optional imports.

**File**: `cognee/infrastructure/llm/tokenizer/HuggingFace/adapter.py` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ def _load(model: str) -> tuple[Callable[[str], list[str]], int]:
                 "which can build the tokenizer from the repo's other files, is not installed",
                 name="transformers",
             ) from error
-        from transformers import AutoTokenizer
+        from transformers import AutoTokenizer  # ty: ignore[unresolved-import]
 
         auto = AutoTokenizer.from_pretrained(model)
         return auto.tokenize, auto.num_special_tokens_to_add(pair=False)
```

---

### Incident Patch 6: `48b7c517` (2026-09-29)
**Commit Message**: fix(tokenizer): Count HF tokens with tokenizers (SDK-810) (#5271)

## Description

Replaces #5258 (closed). That PR made `transformers` a core dependency
so the fastembed / `HUGGINGFACE_TOKENIZER` path could count tokens with
the model's own tokenizer instead of falling back to TikToken. Its
keyless e2e job then failed with `BoundaryExtractor requires the PyTorch
library but it was not found`: the fastembed tokenizer imported
`transformers` during `add()`, before cognify's GLiNER auto-installer
added torch, and `transformers` decides once at import whether torch
exists, so gliner2 could not load its model afterwards in the same
process. The same sequence hits any fresh keyless install on first use.

**`HuggingFaceTokenizer` loads the repo's `tokenizer.json` with the
`tokenizers` library** (`huggingface_hub.hf_hub_download` +
`Tokenizer.from_file`; both already core dependencies — it is what
fastembed itself does). Every embedding repo checked (BGE small/base/m3,
MiniLM, mpnet, nomic, mxbai, arctic, e5, gte, Qwen3-Embedding, jina,
embeddinggemma, granite) ships the file, and counts are identical to
`AutoTokenizer.tokenize`. `AutoTokenizer` is tried only when
`tokenizer.json` cannot 

**File**: `.github/workflows/e2e_tests.yml` (modified, +10/-0)
```diff
@@ -166,6 +166,16 @@ jobs:
       - name: Run keyless e2e
         run: uv run python ./cognee/tests/e2e/keyless/keyless_ingest_check.py
 
+      # Every stored chunk must fit the embedding model's window and be embedded
+      # whole: with the default model, with a model whose tokenizer.json stores a
+      # truncation length, and with one that stores a fixed padding length (SDK-810).
+      - name: Run chunk token budget check (default model)
+        run: uv run python ./cognee/tests/e2e/keyless/chunk_token_budget_check.py
+      - name: Run chunk token budget check (snowflake-arctic-embed-xs)
+        run: uv run python ./cognee/tests/e2e/keyless/chunk_token_budget_check.py snowflake/snowflake-arctic-embed-xs
+      - name: Run chunk token budget check (all-MiniLM-L6-v2)
+        run: uv run python ./cognee/tests/e2e/keyless/chunk_token_budget_check.py sentence-transformers/all-MiniLM-L6-v2
+
       # A cognify run SIGKILLed after two documents, a second run, then startup
       # recovery: the two completed documents must survive and the run must be
       # closed as abandoned. Same keyless GLiNER stack, so it lives here.
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -226,4 +226,5 @@ pr_body.md
 
 # Scratch data/system dirs written by the keyless e2e script
 cognee/tests/e2e/keyless/.keyless_run/
+cognee/tests/e2e/keyless/.chunk_budget_run/
 cognee/tests/e2e/keyless/.crash_run/
```

**File**: `cognee/infrastructure/databases/vector/embeddings/FastembedEmbeddingEngine.py` (modified, +23/-0)
```diff
@@ -74,6 +74,28 @@ def fastembed_model_cached(model: str) -> tuple[bool, str, str | None]:
     return any(path.exists() for path in candidates), str(cache_dir), size_hint
 
 
+def pad_to_batch_longest(embedding_model) -> None:
+    """Make the loaded model pad every batch to its longest text, as fastembed does
+    for models whose tokenizer.json stores no padding.
+
+    Some repos store a fixed-length padding in tokenizer.json (all-MiniLM-L6-v2 and
+    gte-base: 128), and fastembed keeps it: texts below the length are padded to it,
+    longer ones (up to the model's window) are left as they are, so a batch mixing
+    the two is a ragged array and fastembed fails on it. Padding is masked by the
+    model, so the embeddings do not change. Truncation is left as fastembed set it.
+    """
+    tokenizer = getattr(getattr(embedding_model, "model", None), "tokenizer", None)
+    padding = getattr(tokenizer, "padding", None)
+    if not isinstance(padding, dict) or padding.get("length") is None:
+        return
+    tokenizer.enable_padding(
+        direction=padding["direction"],
+        pad_id=padding["pad_id"],
+        pad_type_id=padding["pad_type_id"],
+        pad_token=padding["pad_token"],
+    )
+
+
 class FastembedEmbeddingEngine(EmbeddingEngine):
     """
     Manages the embedding process using a specified model to generate text embeddings.
@@ -115,6 +137,7 @@ def __init__(
             location_var="FASTEMBED_CACHE_PATH",
         )
         self.embedding_model = TextEmbedding(model_name=model)
+        pad_to_batch_longest(self.embedding_model)
         # fastembed truncates input at the model's own limit without an error, so
         # chunks must never be sized past it: see input_limit().
         init_input_limit(self, max_completion_tokens)
```

**File**: `cognee/infrastructure/llm/tokenizer/HuggingFace/adapter.py` (modified, +72/-17)
```diff
@@ -1,11 +1,73 @@
+import importlib.util
+import json
+from collections.abc import Callable
+from pathlib import Path
 from typing import Any
 
 from ..tokenizer_interface import TokenizerInterface
 
 
+def _load(model: str) -> tuple[Callable[[str], list[str]], int]:
+    """Return ``(tokenize, special_tokens)`` for a HuggingFace repo: ``text -> tokens``
+    without special tokens, and how many special tokens the model adds around one
+    text (counted text excludes them, the model's input limit includes them).
+
+    The repo's ``tokenizer.json`` (the fast tokenizer every current embedding model
+    ships) is loaded with the ``tokenizers`` library. A repo without one needs
+    ``transformers.AutoTokenizer`` to build the tokenizer from its slow files, which
+    is tried only when transformers is already installed. It is never imported
+    otherwise: transformers decides once, at import, whether PyTorch is present, so
+    importing it before the GLiNER auto-installer adds torch leaves gliner2 unable to
+    load its model in this process (SDK-810).
+    """
+    from huggingface_hub import hf_hub_download
+    from tokenizers import Tokenizer
+
+    try:
+        tokenizer = Tokenizer.from_file(hf_hub_download(model, "tokenizer.json"))
+    except Exception as error:
+        if importlib.util.find_spec("transformers") is None:
+            # name="transformers": the resolver's fallback warning then names the extra.
+            raise ImportError(
+                f"could not load tokenizer.json for {model!r} ({error}), and transformers, "
+                "which can build the tokenizer from the repo's other files, is not installed",
+                name="transformers",
+            ) from error
+        from transformers import AutoTokenizer
+
+        auto = AutoTokenizer.from_pretrained(model)
+        return auto.tokenize, auto.num_special_tokens_to_add(pair=False)
+    # Some repos store truncation and fixed-length padding in tokenizer.json
+    # (sentence-transformers/all-MiniLM-L6-v2: both at 128), which encode() then
+    # applies, so every text would count as 128 tokens. AutoTokenizer.tokenize
+    # never applied them; counting must see the whole text, unpadded.
+    tokenizer.no_truncation()
+    tokenizer.no_padding()
+    return (
+        lambda text: tokenizer.encode(text, add_special_tokens=False).tokens,
+        tokenizer.num_special_tokens_to_add(is_pair=False),
+    )
+
+
+def _declared_input_limit(model: str) -> int | None:
+    """``model_max_length`` from the repo's ``tokenizer_config.json``, or None when the
+    repo has no such file or declares no positive integer limit."""
+    from huggingface_hub import hf_hub_download
+    from huggingface_hub.errors import EntryNotFoundError
+
+    try:
+        path = hf_hub_download(model, "tokenizer_config.json")
+    except EntryNotFoundError:
+        return None
+    limit = json.loads(Path(path).read_text(encoding="utf-8")).get("model_max_length")
+    if isinstance(limit, bool) or not isinstance(limit, int) or limit <= 0:
+        return None
+    return limit
+
+
 class HuggingFaceTokenizer(TokenizerInterface):
     """
-    Implements a tokenizer using the Hugging Face Transformers library.
+    Counts tokens with a HuggingFace repo's own tokenizer (see ``_load``).
 
     Public methods include:
     - extract_tokens
@@ -15,7 +77,6 @@ class HuggingFaceTokenizer(TokenizerInterface):
     Instance variables include:
     - model: str
     - max_completion_tokens: int
-    - tokenizer: AutoTokenizer
     """
 
     def __init__(
@@ -25,11 +86,8 @@ def __init__(
     ) -> None:
         self.model = model
         self.max_completion_tokens = max_completion_tokens
-
-        # Import here to make it an optional dependency
-        from transformers import AutoTokenizer  # ty:ignore[unresolved-import]
-
-        self.tokenizer = AutoTokenizer.from_pretrained(model)
+        self._tokenize, self._special_tokens = _load(model)
+        self._declared_limit = _declared_input_limit(model)
 
     def extract_tokens(self, text: str) -> list[Any]:
         """
@@ -45,8 +103,7 @@ def extract_tokens(self, text: str) -> list[Any]:
 
             - List[Any]: A list of tokens extracted from the input text.
         """
-        tokens = self.tokenizer.tokenize(text)
-        return tokens
+        return self._tokenize(text)
 
     def count_tokens(self, text: str) -> int:
         """
@@ -62,19 +119,17 @@ def count_tokens(self, text: str) -> int:
 
             - int: The total number of tokens in the input text.
         """
-        return len(self.tokenizer.tokenize(text))
+        return len(self._tokenize(text))
 
     @property
     def model_input_limit(self) -> int | None:
-        """The input limit the model's repo declares (``model_max_length``), less the
-        special tokens the model adds itself, since text is counted without them.
-        None when the repo declares no limit (transformers then substitutes a
-        place
```

**File**: `cognee/infrastructure/llm/tokenizer/resolver.py` (modified, +3/-0)
```diff
@@ -17,6 +17,9 @@
 * ``mistral``           -> ``MistralTokenizer`` for the model.
 * ``fastembed``         -> the model's own HuggingFace tokenizer (BGE/MiniLM are
   wordpiece), instead of the old hardcoded ``gpt-4o`` BPE tokenizer.
+  ``HuggingFaceTokenizer`` loads it with the ``tokenizers`` library (a core
+  dependency); transformers is optional and only used for repos with no
+  ``tokenizer.json``.
 * ollama / openai-compatible / custom / other -> an explicit
   ``HUGGINGFACE_TOKENIZER`` override if set, otherwise the embedding model's own
   HuggingFace repo.
```

**File**: `cognee/tests/e2e/keyless/chunk_token_budget_check.py` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+"""Keyless end to end: every stored chunk fits the embedding model's window (SDK-810).
+
+Chunk sizing counts tokens with the embedding model's own tokenizer and cuts at
+``resolve_chunk_size()``. Two things can silently truncate what gets embedded: a
+budget larger than the model's window (fastembed truncates without a word; SDK-868
+lowers the budget to the model's input limit), and a tokenizer that mis-counts (a
+``tokenizer.json`` with stored truncation or fixed padding makes every text count
+as 128 tokens, or caps long ones; SDK-810 switches them off). This check
+ingests a long text through the default pipeline and then verifies, chunk by
+chunk, against two oracles: ``transformers.AutoTokenizer`` (independent counts;
+installed with the GLiNER runtime) and fastembed's own tokenizer (what the ONNX
+model actually sees, truncation enabled at its window).
+
+Run: ``python cognee/tests/e2e/keyless/chunk_token_budget_check.py [fastembed model]``
+
+With no argument the keyless default (BAAI/bge-small-en-v1.5) is used. The CI job
+also runs it with ``snowflake/snowflake-arctic-embed-xs``, whose tokenizer.json
+stores truncation at 512 (a counter that honoured it would report at most 512
+tokens for any document), and with ``sentence-transformers/all-MiniLM-L6-v2``,
+whose tokenizer.json stores truncation and a fixed padding length of 128 (every
+text would count as 128 tokens, and fastembed, left with that padding, fails on
+a batch mixing texts above and below it).
+"""
+
+import asyncio
+import logging
+import os
+import sys
+from pathlib import Path
+
+for key in list(os.environ):
+    if key.startswith(("LLM_", "EMBEDDING_", "OPENAI_", "GRAPH_EXTRACTOR", "BAML_")):
+        os.environ.pop(key)
+for key in ("COGNEE_SKIP_PREFLIGHT", "COGNEE_SKIP_CONNECTION_TEST", "MOCK_EMBEDDING"):
+    os.environ.pop(key, None)
+if len(sys.argv) > 1:
+    os.environ["EMBEDDING_PROVIDER"] = "fastembed"
+    os.environ["EMBEDDING_MODEL"] = sys.argv[1]
+
+ROOT = Path(__file__).resolve().parent / ".chunk_budget_run"
+ROOT.mkdir(exist_ok=True)
+os.chdir(ROOT)  # pydantic-settings reads a cwd-relative .env; there is none here
+os.environ["DATA_ROOT_DIRECTORY"] = str(ROOT / "data")
+os.environ["SYSTEM_ROOT_DIRECTORY"] = str(ROOT / "system")
+os.environ["TELEMETRY_DISABLED"] = "1"
+
+import dotenv  # noqa: E402
+
+dotenv.load_dotenv = lambda *args, **kwargs: False  # cognee/__init__.py would load the repo .env
+
+import cognee  # noqa: E402
+
+TEXT_PATH = Path(__file__).resolve().parents[2] / "test_data" / "alice_in_wonderland.txt"
+WORDS = 8000  # ~10k tokens: dozens of chunks at a 512 budget, without a long GLiNER run
+
+logging.getLogger().setLevel(logging.WARNING)
+
+
+async def main() -> None:
+    from cognee.infrastructure.databases.graph import get_graph_engine
+    from cognee.infrastructure.databases.vector.embeddings.get_embedding_engine import (
+        get_embedding_engine,
+    )
+    from cognee.infrastructure.llm.utils import resolve_chunk_size
+
+    text = " ".join(TEXT_PATH.read_text(encoding="utf-8").split()[:WORDS])
+    await cognee.prune.prune_data()
+    await cognee.prune.prune_system(metadata=True)
+    await cognee.add(text, dataset_name="chunk_budget")
+    # The embedding tokenizer must not import transformers: it caches "no torch" at
+    # import, and cognify's GLiNER auto-installer adds torch only after add() (#5258).
+    assert "transformers" not in sys.modules, (
+        "transformers was imported before cognify; the GLiNER runtime install would then "
+        "fail with 'PyTorch not found' in this process"
+    )
+    await cognee.cognify(datasets=["chunk_budget"])
+
+    engine = get_embedding_engine()
+    budget = await resolve_chunk_size(None)  # what cognify sized the chunks by
+    # What the ONNX model sees: fastembed's tokenizer, truncation enabled at the window.
+    model_tokenizer = engine.embedding_model.model.tokenizer
+    window = model_tokenizer.truncation["max_length"]
+    specials = model_tokenizer.num_special_tokens_to_add(is_pair=False)
+    print(f"model={engine.model} window={window} specials={specials} chunk_budget={budget}")
+    problems = []
+    if budget + specials > window:
+        problems.append(
+            f"chunk budget {budget} + {specials} special tokens exceeds the model window "
+            f"{window}: fastembed would truncate full chunks"
+        )
+
+    # Independent oracle for counts (installed with the GLiNER runtime, imported after torch).
+    from transformers import AutoTokenizer
+
+    oracle = AutoTokenizer.from_pretrained(engine.model)
+    # Whole-document counting, as the --dry-run estimate and whole-chunk counters use it:
+    # a tokenizer.json with stored truncation would cap this at the stored length.
+    total = len(oracle.tokenize(text))
+    counted = engine.tokenizer.count_tokens(text)
+    if counted != total:
+        problems.append(
+            f"the engine tokenizer counts the document as {counted} 
```

**File**: `cognee/tests/e2e/keyless/keyless_ingest_check.py` (modified, +7/-0)
```diff
@@ -92,6 +92,13 @@ async def main() -> None:
     await cognee.prune.prune_system(metadata=True)
 
     await cognee.add(TEXT, dataset_name="keyless")
+    # The embedding tokenizer must not import transformers: it caches "no torch" at
+    # import, and cognify's GLiNER auto-installer adds torch only after add() (#5258).
+    assert "transformers" not in sys.modules, (
+        "transformers was imported before cognify; the GLiNER runtime install would then "
+        "fail with 'PyTorch not found' in this process"
+    )
+
     await cognee.cognify(["keyless"])
 
     chunks = await cognee.search(
```

**File**: `cognee/tests/unit/infrastructure/llm/test_huggingface_tokenizer.py` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+"""HuggingFaceTokenizer counts with a repo's fast tokenizer, without transformers (SDK-810).
+
+transformers decides at import whether PyTorch is present, so importing it before
+the GLiNER auto-installer adds torch breaks that install. The adapter therefore
+counts with the ``tokenizers`` library, reads the model's declared input limit
+from ``tokenizer_config.json`` itself, and reaches for ``AutoTokenizer`` only when
+``tokenizer.json`` cannot be loaded and transformers is already installed.
+
+The repo files come from a fake ``hf_hub_download``; the tokenizer itself is real.
+"""
+
+import json
+import sys
+from types import SimpleNamespace
+from unittest.mock import patch
+
+import pytest
+from huggingface_hub.errors import EntryNotFoundError
+
+from cognee.infrastructure.llm.tokenizer.HuggingFace import adapter
+from cognee.infrastructure.llm.tokenizer.HuggingFace.adapter import HuggingFaceTokenizer
+
+TWELVE_WORDS = " ".join(f"w{i}" for i in range(12))
+
+
+@pytest.fixture
+def tokenizer_json(tmp_path):
+    """A real tokenizer.json: [CLS] $A [SEP] around the text (2 special tokens) and,
+    like sentence-transformers/all-MiniLM-L6-v2, stored truncation and fixed padding."""
+    from tokenizers import Tokenizer
+    from tokenizers.models import WordLevel
+    from tokenizers.pre_tokenizers import Whitespace
+    from tokenizers.processors import TemplateProcessing
+
+    words = ["[UNK]", "[PAD]", "[CLS]", "[SEP]", *[f"w{i}" for i in range(20)]]
+    tokenizer = Tokenizer(WordLevel({word: i for i, word in enumerate(words)}, unk_token="[UNK]"))
+    tokenizer.pre_tokenizer = Whitespace()
+    tokenizer.post_processor = TemplateProcessing(
+        single="[CLS] $A [SEP]", special_tokens=[("[CLS]", 2), ("[SEP]", 3)]
+    )
+    tokenizer.enable_truncation(max_length=4)
+    tokenizer.enable_padding(length=4, pad_id=1, pad_token="[PAD]")
+    path = tmp_path / "tokenizer.json"
+    tokenizer.save(str(path))
+    assert len(Tokenizer.from_file(str(path)).encode("w1").ids) == 4, "fixture must pad"
+    return str(path)
+
+
+@pytest.fixture
+def tokenizer_config(tmp_path):
+    def write(config: dict | None):
+        if config is None:
+            return None
+        path = tmp_path / "tokenizer_config.json"
+        path.write_text(json.dumps(config))
+        return str(path)
+
+    return write
+
+
+def _hub(tokenizer_json=None, tokenizer_config=None):
+    """Fake hf_hub_download for the two files the adapter asks for; None = missing."""
+
+    def download(repo, filename):
+        if filename == "tokenizer.json":
+            if tokenizer_json is None:
+                raise OSError("no tokenizer.json")
+            return tokenizer_json
+        if filename == "tokenizer_config.json":
+            if tokenizer_config is None:
+                raise EntryNotFoundError("no tokenizer_config.json")
+            return tokenizer_config
+        raise AssertionError(f"unexpected file {filename}")
+
+    return patch("huggingface_hub.hf_hub_download", side_effect=download)
+
+
+def _no_transformers():
+    """Make ``import transformers`` fail, so a stray import shows up as an error."""
+    return patch.dict(sys.modules, {"transformers": None, "transformers.utils": None})
+
+
+def test_counts_with_tokenizers_and_never_imports_transformers(tokenizer_json, tokenizer_config):
+    with _no_transformers(), _hub(tokenizer_json, tokenizer_config({"model_max_length": 512})):
+        tokenizer = HuggingFaceTokenizer(model="org/model")
+    assert tokenizer.count_tokens("w1 w2 w3") == 3  # no [CLS]/[SEP] in the count
+    assert tokenizer.extract_tokens("w1 w2") == ["w1", "w2"]
+
+
+def test_counts_ignore_truncation_and_padding_stored_in_tokenizer_json(
+    tokenizer_json, tokenizer_config
+):
+    with _no_transformers(), _hub(tokenizer_json, tokenizer_config(None)):
+        tokenizer = HuggingFaceTokenizer(model="org/minilm-like")
+    assert tokenizer.count_tokens("w1") == 1, "fixed padding must not inflate short texts"
+    assert tokenizer.count_tokens(TWELVE_WORDS) == 12, "stored truncation must not cap long texts"
+
+
+def test_model_input_limit_is_the_declared_limit_less_the_models_special_tokens(
+    tokenizer_json, tokenizer_config
+):
+    with _no_transformers(), _hub(tokenizer_json, tokenizer_config({"model_max_length": 512})):
+        assert HuggingFaceTokenizer(model="org/model").model_input_limit == 510
+
+
+@pytest.mark.parametrize(
+    "config",
+    [None, {}, {"model_max_length": 1e30}, {"model_max_length": True}, {"model_max_length": 0}],
+    ids=["no tokenizer_config.json", "no key", "float placeholder", "bool", "zero"],
+)
+def test_model_input_limit_is_none_when_the_repo_declares_no_usable_limit(
+    tokenizer_json, tokenizer_config, config
+):
+    with _no_transformers(), _hub(tokenizer_json, tokenizer_config(config)):
+        assert HuggingFaceTokenizer(model="org/model").model_input_limit is None
+
+
+def test_falls_back_to_auto_tokenizer_when_transformer
```

---

### Incident Patch 7: `f5994a5b` (2026-09-29)
**Commit Message**: fix(pgvector): refuse unsafe shared-database prune (COG-6550, #4956) (#5161)

## Summary

- refuse vector-only PGVector pruning when the adapter borrows the
relational PostgreSQL engine
- let `prune_system(metadata=True)` perform the single authoritative
relational database deletion
- honor a `VECTOR_DB_URL` with a different database name as a dedicated,
independently prunable vector database
- avoid ownership markers and table-shape inference

Alternative, fail-closed fix for #4956 and #4977.

## Behavior

- **Dedicated PGVector database:** `prune()` keeps its existing
whole-database behavior.
- **Shared relational/PGVector database, `metadata=False`:** raises
`SharedDatabasePruneError` before clearing metadata or dropping any
table.
- **Shared database, `metadata=True`:** the expected refusal is handled
and relational metadata pruning deletes the shared database once.

## ⚠️ Upgrade note (behavior change)

This affects PGVector deployments with
`ENABLE_BACKEND_ACCESS_CONTROL=false` that set
`VECTOR_DB_NAME` to a different database than `DB_NAME`.

Until now, that setting was silently ignored: vectors were written into
the relational
database. From this release, cognee uses the da

**File**: `cognee/infrastructure/databases/vector/exceptions/__init__.py` (modified, +10/-2)
```diff
@@ -1,3 +1,11 @@
-from .exceptions import CollectionNotFoundError, EmbeddingDimensionMismatchError
+from .exceptions import (
+    CollectionNotFoundError,
+    EmbeddingDimensionMismatchError,
+    SharedDatabasePruneError,
+)
 
-__all__ = ["CollectionNotFoundError", "EmbeddingDimensionMismatchError"]
+__all__ = [
+    "CollectionNotFoundError",
+    "EmbeddingDimensionMismatchError",
+    "SharedDatabasePruneError",
+]
```

**File**: `cognee/infrastructure/databases/vector/exceptions/exceptions.py` (modified, +4/-0)
```diff
@@ -3,6 +3,10 @@
 from cognee.exceptions import CogneeValidationError
 
 
+class SharedDatabasePruneError(RuntimeError):
+    """Raised when vector-only pruning cannot be isolated from relational data."""
+
+
 class EmbeddingDimensionMismatchError(CogneeValidationError):
     """The configured embedding model produces a different vector width than the one that built a dataset."""
 
```

**File**: `cognee/infrastructure/databases/vector/pgvector/PGVectorAdapter.py` (modified, +13/-4)
```diff
@@ -24,7 +24,7 @@
 from ...relational.ModelBase import Base
 from ...relational.sqlalchemy.SqlAlchemyAdapter import SQLAlchemyAdapter
 from ..embeddings.EmbeddingEngine import EmbeddingEngine
-from ..exceptions import CollectionNotFoundError
+from ..exceptions import CollectionNotFoundError, SharedDatabasePruneError
 from ..models.ScoredResult import ScoredResult
 from ..stored_vector_size import choose_stored_vector_size
 from ..vector_db_interface import VectorDBInterface
@@ -151,16 +151,17 @@ def __init__(
                 pool_args=effective_pool_args,
             )
             self._owns_engine = True
-        elif backend_access_control_enabled() and (db_name1 != db_name2):
-            # If backend access control create new instances of engine and sessionmaker
+        elif db_name1 != db_name2:
+            # A different database name is sufficient isolation regardless of access-control
+            # mode, so honor VECTOR_DB_NAME instead of borrowing the relational engine.
             super().__init__(
                 connection_string=self.db_uri,
                 connect_args=effective_connect_args,
                 pool_args=effective_pool_args,
             )
             self._owns_engine = True
         elif relational_db.engine.dialect.name == "postgresql":
-            # If postgreSQL is used and not backend access control we must use the same engine and sessionmaker
+            # Same PostgreSQL database as the relational engine: reuse its engine and sessionmaker
             self.engine = relational_db.engine
             self.sessionmaker = relational_db.sessionmaker
         else:
@@ -921,6 +922,14 @@ def _table_only(name: str) -> str:
 
     async def prune(self):
         """Drop all vector collection tables and reset cached reflection metadata."""
+        if not self._owns_engine:
+            raise SharedDatabasePruneError(
+                "PGVector cannot be pruned independently while it shares the relational "
+                "PostgreSQL database. Use prune_system(metadata=True) to delete the shared "
+                "database (this also deletes users, datasets and permissions), or set "
+                "VECTOR_DB_NAME to a different, dedicated database."
+            )
+
         self._metadata.clear()
         await self.delete_database()
 
```

**File**: `cognee/modules/data/deletion/prune_system.py` (modified, +17/-6)
```diff
@@ -21,6 +21,7 @@
 )
 from cognee.infrastructure.databases.vector import get_vector_engine_async
 from cognee.infrastructure.databases.vector.create_vector_engine import _create_vector_engine
+from cognee.infrastructure.databases.vector.exceptions import SharedDatabasePruneError
 from cognee.modules.operations import record_operation
 from cognee.modules.users.models import DatasetDatabase
 from cognee.shared.cache import delete_cache
@@ -69,18 +70,28 @@ async def prune_system(graph=True, vector=True, metadata=True, cache=True):
     #       delete all graph and vector databases if called. It should only be used in development or testing environments.
 
     async def _prune():
+        if vector and not backend_access_control_enabled():
+            vector_engine = await get_vector_engine_async()
+            try:
+                await vector_engine.prune()
+            except SharedDatabasePruneError:
+                if not metadata:
+                    raise
+                logger.info(
+                    "Skipping separate PGVector prune because the relational database "
+                    "will be deleted by metadata pruning."
+                )
+        elif vector and backend_access_control_enabled():
+            await prune_vector_databases()
+
+        # Graph runs after vector: a refused vector prune (shared PGVector database)
+        # must raise before anything irreversible has been deleted.
         if graph and not backend_access_control_enabled():
             graph_engine = await get_graph_engine()
             await graph_engine.delete_graph()
         elif graph and backend_access_control_enabled():
             await prune_graph_databases()
 
-        if vector and not backend_access_control_enabled():
-            vector_engine = await get_vector_engine_async()
-            await vector_engine.prune()
-        elif vector and backend_access_control_enabled():
-            await prune_vector_databases()
-
         if graph:
             _create_graph_engine.cache_clear()
 
```

**File**: `cognee/tests/unit/infrastructure/databases/vector/test_pgvector_prune.py` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, Mock, patch
+
+import pytest
+
+from cognee.infrastructure.databases.vector.exceptions import SharedDatabasePruneError
+
+
+class _Embedder:
+    def get_vector_size(self):
+        return 4
+
+
+def _relational_database(database_name: str):
+    return SimpleNamespace(
+        db_uri=f"postgresql+asyncpg://cognee:cognee@localhost:5432/{database_name}",
+        engine=SimpleNamespace(dialect=SimpleNamespace(name="postgresql")),
+        sessionmaker=Mock(),
+    )
+
+
+def _adapter_configs():
+    return (
+        SimpleNamespace(pool_args=(), database_connect_args={}),
+        SimpleNamespace(vector_pool_args=None),
+    )
+
+
+@pytest.mark.asyncio
+async def test_distinct_vector_database_owns_its_engine():
+    pytest.importorskip("asyncpg")
+    pytest.importorskip("pgvector")
+    from cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter import PGVectorAdapter
+
+    relational_config, vector_config = _adapter_configs()
+    with (
+        patch(
+            "cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter.get_relational_engine",
+            return_value=_relational_database("cognee"),
+        ),
+        patch(
+            "cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter.get_relational_config",
+            return_value=relational_config,
+        ),
+        patch(
+            "cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter.get_vectordb_config",
+            return_value=vector_config,
+        ),
+        patch(
+            "cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter.backend_access_control_enabled",
+            return_value=False,
+        ),
+    ):
+        adapter = PGVectorAdapter(
+            "postgresql+asyncpg://cognee:cognee@localhost:5432/cognee_vectors",
+            None,
+            _Embedder(),
+        )
+
+    assert adapter._owns_engine is True
+    await adapter.close()
+
+
+def test_same_database_borrows_the_relational_engine():
+    pytest.importorskip("asyncpg")
+    pytest.importorskip("pgvector")
+    from cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter import PGVectorAdapter
+
+    relational = _relational_database("cognee")
+    relational_config, vector_config = _adapter_configs()
+    with (
+        patch(
+            "cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter.get_relational_engine",
+            return_value=relational,
+        ),
+        patch(
+            "cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter.get_relational_config",
+            return_value=relational_config,
+        ),
+        patch(
+            "cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter.get_vectordb_config",
+            return_value=vector_config,
+        ),
+        patch(
+            "cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter.backend_access_control_enabled",
+            return_value=False,
+        ),
+    ):
+        adapter = PGVectorAdapter(relational.db_uri, None, _Embedder())
+
+    assert adapter._owns_engine is False
+    assert adapter.engine is relational.engine
+    assert adapter.sessionmaker is relational.sessionmaker
+
+
+@pytest.mark.asyncio
+async def test_prune_refuses_to_drop_a_shared_relational_database():
+    pytest.importorskip("asyncpg")
+    pytest.importorskip("pgvector")
+    from cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter import PGVectorAdapter
+
+    adapter = object.__new__(PGVectorAdapter)
+    adapter._owns_engine = False
+    adapter._metadata = Mock()
+    adapter.delete_database = AsyncMock()
+
+    with pytest.raises(SharedDatabasePruneError, match="shares the relational"):
+        await adapter.prune()
+
+    adapter._metadata.clear.assert_not_called()
+    adapter.delete_database.assert_not_awaited()
+
+
+@pytest.mark.asyncio
+async def test_prune_still_drops_a_dedicated_vector_database():
+    pytest.importorskip("asyncpg")
+    pytest.importorskip("pgvector")
+    from cognee.infrastructure.databases.vector.pgvector.PGVectorAdapter import PGVectorAdapter
+
+    adapter = object.__new__(PGVectorAdapter)
+    adapter._owns_engine = True
+    adapter._metadata = Mock()
+    adapter.delete_database = AsyncMock()
+
+    await adapter.prune()
+
+    adapter._metadata.clear.assert_called_once_with()
+    adapter.delete_database.assert_awaited_once_with()
```

**File**: `cognee/tests/unit/modules/data/deletion/test_prune_system.py` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+import importlib
+from contextlib import asynccontextmanager
+from unittest.mock import AsyncMock, Mock
+
+import pytest
+
+from cognee.infrastructure.databases.vector.exceptions import SharedDatabasePruneError
+
+prune_system_module = importlib.import_module("cognee.modules.data.deletion.prune_system")
+
+
+@asynccontextmanager
+async def _record_operation(_operation_name):
+    yield
+
+
+@pytest.mark.asyncio
+async def test_full_prune_uses_relational_delete_for_shared_pgvector(monkeypatch):
+    vector_engine = Mock()
+    vector_engine.prune = AsyncMock(side_effect=SharedDatabasePruneError)
+    relational_engine = Mock()
+    relational_engine.delete_database = AsyncMock()
+
+    monkeypatch.setattr(prune_system_module, "backend_access_control_enabled", lambda: False)
+    monkeypatch.setattr(
+        prune_system_module,
+        "get_vector_engine_async",
+        AsyncMock(return_value=vector_engine),
+    )
+    monkeypatch.setattr(
+        prune_system_module,
+        "get_relational_engine",
+        Mock(return_value=relational_engine),
+    )
+    monkeypatch.setattr(prune_system_module._create_vector_engine, "cache_clear", Mock())
+
+    await prune_system_module.prune_system(
+        graph=False,
+        vector=True,
+        metadata=True,
+        cache=False,
+    )
+
+    vector_engine.prune.assert_awaited_once_with()
+    relational_engine.delete_database.assert_awaited_once_with()
+
+
+@pytest.mark.asyncio
+async def test_vector_only_prune_propagates_shared_database_refusal(monkeypatch):
+    vector_engine = Mock()
+    vector_engine.prune = AsyncMock(side_effect=SharedDatabasePruneError)
+
+    monkeypatch.setattr(prune_system_module, "backend_access_control_enabled", lambda: False)
+    monkeypatch.setattr(
+        prune_system_module,
+        "get_vector_engine_async",
+        AsyncMock(return_value=vector_engine),
+    )
+    monkeypatch.setattr(prune_system_module, "record_operation", _record_operation)
+
+    with pytest.raises(SharedDatabasePruneError):
+        await prune_system_module.prune_system(
+            graph=False,
+            vector=True,
+            metadata=False,
+            cache=False,
+        )
+
+
+@pytest.mark.asyncio
+async def test_shared_database_refusal_leaves_graph_untouched(monkeypatch):
+    vector_engine = Mock()
+    vector_engine.prune = AsyncMock(side_effect=SharedDatabasePruneError)
+    graph_engine = Mock()
+    graph_engine.delete_graph = AsyncMock()
+
+    monkeypatch.setattr(prune_system_module, "backend_access_control_enabled", lambda: False)
+    monkeypatch.setattr(
+        prune_system_module,
+        "get_vector_engine_async",
+        AsyncMock(return_value=vector_engine),
+    )
+    monkeypatch.setattr(
+        prune_system_module,
+        "get_graph_engine",
+        AsyncMock(return_value=graph_engine),
+    )
+    monkeypatch.setattr(prune_system_module, "record_operation", _record_operation)
+
+    with pytest.raises(SharedDatabasePruneError):
+        await prune_system_module.prune_system(
+            graph=True,
+            vector=True,
+            metadata=False,
+            cache=False,
+        )
+
+    graph_engine.delete_graph.assert_not_awaited()
```

---

### Incident Patch 8: `1ebeb28b` (2026-09-29)
**Commit Message**: test: Guard the import order and the padding switch against regressions (SDK-810)

Description: Both keyless e2e scripts now assert that transformers is not
imported before cognify, naming the consequence (the GLiNER runtime install
would leave gliner2 unable to load its model), instead of letting a future
early import surface as "PyTorch not found". The fastembed padding test now
also checks that the engine applies the switch when it loads the model.

**File**: `cognee/tests/e2e/keyless/chunk_token_budget_check.py` (modified, +6/-0)
```diff
@@ -67,6 +67,12 @@ async def main() -> None:
     await cognee.prune.prune_data()
     await cognee.prune.prune_system(metadata=True)
     await cognee.add(text, dataset_name="chunk_budget")
+    # The embedding tokenizer must not import transformers: it caches "no torch" at
+    # import, and cognify's GLiNER auto-installer adds torch only after add() (#5258).
+    assert "transformers" not in sys.modules, (
+        "transformers was imported before cognify; the GLiNER runtime install would then "
+        "fail with 'PyTorch not found' in this process"
+    )
     await cognee.cognify(datasets=["chunk_budget"])
 
     engine = get_embedding_engine()
```

**File**: `cognee/tests/e2e/keyless/keyless_ingest_check.py` (modified, +7/-0)
```diff
@@ -92,6 +92,13 @@ async def main() -> None:
     await cognee.prune.prune_system(metadata=True)
 
     await cognee.add(TEXT, dataset_name="keyless")
+    # The embedding tokenizer must not import transformers: it caches "no torch" at
+    # import, and cognify's GLiNER auto-installer adds torch only after add() (#5258).
+    assert "transformers" not in sys.modules, (
+        "transformers was imported before cognify; the GLiNER runtime install would then "
+        "fail with 'PyTorch not found' in this process"
+    )
+
     await cognee.cognify(["keyless"])
 
     chunks = await cognee.search(
```

**File**: `cognee/tests/unit/infrastructure/test_fastembed_padding.py` (modified, +26/-1)
```diff
@@ -6,9 +6,11 @@
 switches such a tokenizer to fastembed's own default: pad to the batch's longest.
 """
 
-from unittest.mock import MagicMock
+from unittest.mock import MagicMock, patch
 
+from cognee.infrastructure.databases.vector.embeddings import FastembedEmbeddingEngine as module
 from cognee.infrastructure.databases.vector.embeddings.FastembedEmbeddingEngine import (
+    FastembedEmbeddingEngine,
     pad_to_batch_longest,
 )
 
@@ -49,3 +51,26 @@ def test_no_padding_or_no_tokenizer_is_left_alone():
     pad_to_batch_longest(model)
     model.model.tokenizer.enable_padding.assert_not_called()
     pad_to_batch_longest(MagicMock(model=None))  # nothing to adjust, nothing raised
+
+
+def test_the_engine_switches_a_loaded_models_fixed_padding_on_init():
+    text_embedding = MagicMock()
+    tokenizer = text_embedding.return_value.model.tokenizer
+    tokenizer.padding = {
+        "length": 128,
+        "pad_id": 0,
+        "pad_token": "[PAD]",
+        "pad_type_id": 0,
+        "direction": "right",
+    }
+    tokenizer.truncation = {"max_length": 256}
+    tokenizer.num_special_tokens_to_add.return_value = 2
+    with (
+        patch.object(module, "TextEmbedding", text_embedding),
+        patch.object(module, "fastembed_model_cached", return_value=(True, "/cache", "90 MB")),
+        patch.object(FastembedEmbeddingEngine, "get_tokenizer", return_value=MagicMock()),
+    ):
+        FastembedEmbeddingEngine(model="sentence-transformers/all-MiniLM-L6-v2", dimensions=384)
+    tokenizer.enable_padding.assert_called_once_with(
+        direction="right", pad_id=0, pad_type_id=0, pad_token="[PAD]"
+    )
```

---

### Incident Patch 9: `5cbb3699` (2026-09-29)
**Commit Message**: fix(tokenizer): Read the model's input limit without transformers (SDK-810)

Description: The dev merge brought in model_input_limit (SDK-868), written
against the AutoTokenizer object the adapter no longer keeps, so the
property raised AttributeError for every Ollama and OpenAI-compatible
setup with a HuggingFace tokenizer; the two edits touched different lines
and merged without a conflict. The adapter now reads model_max_length from
the repo's tokenizer_config.json itself and keeps the special-token count
from whichever tokenizer it loaded. The tests build the tokenizer through
its constructor, with real repo files, so a broken attribute cannot hide
behind a hand-assembled object again.

**File**: `cognee/infrastructure/llm/tokenizer/HuggingFace/adapter.py` (modified, +37/-14)
```diff
@@ -1,12 +1,16 @@
 import importlib.util
+import json
 from collections.abc import Callable
+from pathlib import Path
 from typing import Any
 
 from ..tokenizer_interface import TokenizerInterface
 
 
-def _load_tokenize(model: str) -> Callable[[str], list[str]]:
-    """Return ``text -> tokens`` for a HuggingFace repo, without special tokens.
+def _load(model: str) -> tuple[Callable[[str], list[str]], int]:
+    """Return ``(tokenize, special_tokens)`` for a HuggingFace repo: ``text -> tokens``
+    without special tokens, and how many special tokens the model adds around one
+    text (counted text excludes them, the model's input limit includes them).
 
     The repo's ``tokenizer.json`` (the fast tokenizer every current embedding model
     ships) is loaded with the ``tokenizers`` library. A repo without one needs
@@ -31,19 +35,39 @@ def _load_tokenize(model: str) -> Callable[[str], list[str]]:
             ) from error
         from transformers import AutoTokenizer
 
-        return AutoTokenizer.from_pretrained(model).tokenize
-    # Some repos save truncation and fixed-length padding in tokenizer.json
+        auto = AutoTokenizer.from_pretrained(model)
+        return auto.tokenize, auto.num_special_tokens_to_add(pair=False)
+    # Some repos store truncation and fixed-length padding in tokenizer.json
     # (sentence-transformers/all-MiniLM-L6-v2: both at 128), which encode() then
     # applies, so every text would count as 128 tokens. AutoTokenizer.tokenize
     # never applied them; counting must see the whole text, unpadded.
     tokenizer.no_truncation()
     tokenizer.no_padding()
-    return lambda text: tokenizer.encode(text, add_special_tokens=False).tokens
+    return (
+        lambda text: tokenizer.encode(text, add_special_tokens=False).tokens,
+        tokenizer.num_special_tokens_to_add(is_pair=False),
+    )
+
+
+def _declared_input_limit(model: str) -> int | None:
+    """``model_max_length`` from the repo's ``tokenizer_config.json``, or None when the
+    repo has no such file or declares no positive integer limit."""
+    from huggingface_hub import hf_hub_download
+    from huggingface_hub.errors import EntryNotFoundError
+
+    try:
+        path = hf_hub_download(model, "tokenizer_config.json")
+    except EntryNotFoundError:
+        return None
+    limit = json.loads(Path(path).read_text(encoding="utf-8")).get("model_max_length")
+    if isinstance(limit, bool) or not isinstance(limit, int) or limit <= 0:
+        return None
+    return limit
 
 
 class HuggingFaceTokenizer(TokenizerInterface):
     """
-    Counts tokens with a HuggingFace repo's own tokenizer (see ``_load_tokenize``).
+    Counts tokens with a HuggingFace repo's own tokenizer (see ``_load``).
 
     Public methods include:
     - extract_tokens
@@ -62,7 +86,8 @@ def __init__(
     ) -> None:
         self.model = model
         self.max_completion_tokens = max_completion_tokens
-        self._tokenize = _load_tokenize(model)
+        self._tokenize, self._special_tokens = _load(model)
+        self._declared_limit = _declared_input_limit(model)
 
     def extract_tokens(self, text: str) -> list[Any]:
         """
@@ -98,15 +123,13 @@ def count_tokens(self, text: str) -> int:
 
     @property
     def model_input_limit(self) -> int | None:
-        """The input limit the model's repo declares (``model_max_length``), less the
-        special tokens the model adds itself, since text is counted without them.
-        None when the repo declares no limit (transformers then substitutes a
-        placeholder, so the declared value is read from ``init_kwargs``).
+        """The input limit the model's repo declares (``model_max_length`` in its
+        ``tokenizer_config.json``), less the special tokens the model adds itself,
+        since text is counted without them. None when the repo declares no limit.
         """
-        limit = self.tokenizer.init_kwargs.get("model_max_length")
-        if not isinstance(limit, int) or limit <= 0:
+        if self._declared_limit is None:
             return None
-        return limit - self.tokenizer.num_special_tokens_to_add(pair=False)
+        return self._declared_limit - self._special_tokens
 
     def decode_single_token(self, token: int) -> str:
         """
```

**File**: `cognee/tests/unit/infrastructure/llm/test_huggingface_tokenizer.py` (modified, +96/-54)
```diff
@@ -1,93 +1,141 @@
-"""HuggingFaceTokenizer loads a repo's fast tokenizer without transformers (SDK-810).
+"""HuggingFaceTokenizer counts with a repo's fast tokenizer, without transformers (SDK-810).
 
 transformers decides at import whether PyTorch is present, so importing it before
 the GLiNER auto-installer adds torch breaks that install. The adapter therefore
-counts with the ``tokenizers`` library and reaches for ``AutoTokenizer`` only when
+counts with the ``tokenizers`` library, reads the model's declared input limit
+from ``tokenizer_config.json`` itself, and reaches for ``AutoTokenizer`` only when
 ``tokenizer.json`` cannot be loaded and transformers is already installed.
+
+The repo files come from a fake ``hf_hub_download``; the tokenizer itself is real.
 """
 
-import importlib.util
+import json
 import sys
 from types import SimpleNamespace
 from unittest.mock import patch
 
 import pytest
+from huggingface_hub.errors import EntryNotFoundError
 
 from cognee.infrastructure.llm.tokenizer.HuggingFace import adapter
 from cognee.infrastructure.llm.tokenizer.HuggingFace.adapter import HuggingFaceTokenizer
 
-_TOKENS = ["hel", "##lo", "world"]
+TWELVE_WORDS = " ".join(f"w{i}" for i in range(12))
+
 
+@pytest.fixture
+def tokenizer_json(tmp_path):
+    """A real tokenizer.json: [CLS] $A [SEP] around the text (2 special tokens) and,
+    like sentence-transformers/all-MiniLM-L6-v2, stored truncation and fixed padding."""
+    from tokenizers import Tokenizer
+    from tokenizers.models import WordLevel
+    from tokenizers.pre_tokenizers import Whitespace
+    from tokenizers.processors import TemplateProcessing
+
+    words = ["[UNK]", "[PAD]", "[CLS]", "[SEP]", *[f"w{i}" for i in range(20)]]
+    tokenizer = Tokenizer(WordLevel({word: i for i, word in enumerate(words)}, unk_token="[UNK]"))
+    tokenizer.pre_tokenizer = Whitespace()
+    tokenizer.post_processor = TemplateProcessing(
+        single="[CLS] $A [SEP]", special_tokens=[("[CLS]", 2), ("[SEP]", 3)]
+    )
+    tokenizer.enable_truncation(max_length=4)
+    tokenizer.enable_padding(length=4, pad_id=1, pad_token="[PAD]")
+    path = tmp_path / "tokenizer.json"
+    tokenizer.save(str(path))
+    assert len(Tokenizer.from_file(str(path)).encode("w1").ids) == 4, "fixture must pad"
+    return str(path)
 
-class _FastTokenizer:
-    def encode(self, text, add_special_tokens=True):
-        assert add_special_tokens is False, "counts must not include CLS/SEP"
-        return SimpleNamespace(tokens=_TOKENS)
 
-    def no_truncation(self):
-        pass
+@pytest.fixture
+def tokenizer_config(tmp_path):
+    def write(config: dict | None):
+        if config is None:
+            return None
+        path = tmp_path / "tokenizer_config.json"
+        path.write_text(json.dumps(config))
+        return str(path)
 
-    def no_padding(self):
-        pass
+    return write
+
+
+def _hub(tokenizer_json=None, tokenizer_config=None):
+    """Fake hf_hub_download for the two files the adapter asks for; None = missing."""
+
+    def download(repo, filename):
+        if filename == "tokenizer.json":
+            if tokenizer_json is None:
+                raise OSError("no tokenizer.json")
+            return tokenizer_json
+        if filename == "tokenizer_config.json":
+            if tokenizer_config is None:
+                raise EntryNotFoundError("no tokenizer_config.json")
+            return tokenizer_config
+        raise AssertionError(f"unexpected file {filename}")
+
+    return patch("huggingface_hub.hf_hub_download", side_effect=download)
 
 
 def _no_transformers():
     """Make ``import transformers`` fail, so a stray import shows up as an error."""
     return patch.dict(sys.modules, {"transformers": None, "transformers.utils": None})
 
 
-def test_counts_with_tokenizers_and_never_imports_transformers():
-    with (
-        _no_transformers(),
-        patch("huggingface_hub.hf_hub_download", return_value="/cache/tokenizer.json") as dl,
-        patch("tokenizers.Tokenizer.from_file", return_value=_FastTokenizer()) as load,
-    ):
-        tokenizer = HuggingFaceTokenizer(model="BAAI/bge-small-en-v1.5")
-        assert tokenizer.count_tokens("hello world") == 3
-        assert tokenizer.extract_tokens("hello world") == _TOKENS
-    dl.assert_called_once_with("BAAI/bge-small-en-v1.5", "tokenizer.json")
-    load.assert_called_once_with("/cache/tokenizer.json")
+def test_counts_with_tokenizers_and_never_imports_transformers(tokenizer_json, tokenizer_config):
+    with _no_transformers(), _hub(tokenizer_json, tokenizer_config({"model_max_length": 512})):
+        tokenizer = HuggingFaceTokenizer(model="org/model")
+    assert tokenizer.count_tokens("w1 w2 w3") == 3  # no [CLS]/[SEP] in the count
+    assert tokenizer.extract_tokens("w1 w2") == ["w1", "w2"]
 
 
-def test_ignores_truncation_and_padding_saved_in_tokenizer_json():
-    # sentence-transformers/all-MiniLM-L6-v2 ships tokenizer.json with truncation
-    # and fixed padding at 
```

**File**: `cognee/tests/unit/infrastructure/test_embedding_input_limit.py` (modified, +14/-8)
```diff
@@ -29,6 +29,7 @@
     OllamaEmbeddingEngine,
 )
 from cognee.infrastructure.llm.tokenizer.HuggingFace import HuggingFaceTokenizer
+from cognee.infrastructure.llm.tokenizer.HuggingFace import adapter as hf_adapter
 from cognee.infrastructure.llm.tokenizer.TikToken import TikTokenTokenizer
 
 
@@ -63,14 +64,19 @@ def test_litellm_input_limit_is_none_for_unknown_models():
 
 
 def test_huggingface_tokenizer_knows_its_models_limit_less_special_tokens():
-    tokenizer = HuggingFaceTokenizer.__new__(HuggingFaceTokenizer)
-    tokenizer.tokenizer = MagicMock(init_kwargs={"model_max_length": 512})
-    tokenizer.tokenizer.num_special_tokens_to_add.return_value = 2  # [CLS] and [SEP]
-    assert tokenizer.model_input_limit == 510
-
-    # A repo that declares no limit (transformers substitutes a placeholder).
-    tokenizer.tokenizer = MagicMock(init_kwargs={})
-    assert tokenizer.model_input_limit is None
+    # The repo declares 512 and the model adds [CLS] and [SEP] itself.
+    with (
+        patch.object(hf_adapter, "_load", return_value=(lambda text: text.split(), 2)),
+        patch.object(hf_adapter, "_declared_input_limit", return_value=512),
+    ):
+        assert HuggingFaceTokenizer(model="org/model").model_input_limit == 510
+
+    # A repo that declares no limit.
+    with (
+        patch.object(hf_adapter, "_load", return_value=(lambda text: text.split(), 2)),
+        patch.object(hf_adapter, "_declared_input_limit", return_value=None),
+    ):
+        assert HuggingFaceTokenizer(model="org/model").model_input_limit is None
 
     # A TikToken fallback says nothing about the embedding model.
     assert TikTokenTokenizer(model=None).model_input_limit is None
```

**File**: `cognee/tests/unit/infrastructure/test_embedding_input_limit_engines.py` (modified, +6/-4)
```diff
@@ -40,6 +40,7 @@
 )
 from cognee.infrastructure.llm import utils as llm_utils
 from cognee.infrastructure.llm.tokenizer.HuggingFace import HuggingFaceTokenizer
+from cognee.infrastructure.llm.tokenizer.HuggingFace import adapter as hf_adapter
 from cognee.infrastructure.llm.tokenizer.TikToken import TikTokenTokenizer
 
 BGE = "BAAI/bge-small-en-v1.5"
@@ -48,10 +49,11 @@
 def _hf_tokenizer(model_max_length: int) -> HuggingFaceTokenizer:
     """A resolved HuggingFace tokenizer whose repo declares ``model_max_length``
     and whose model adds no special tokens (so the limit is used as is)."""
-    tokenizer = HuggingFaceTokenizer.__new__(HuggingFaceTokenizer)
-    tokenizer.tokenizer = MagicMock(init_kwargs={"model_max_length": model_max_length})
-    tokenizer.tokenizer.num_special_tokens_to_add.return_value = 0
-    return tokenizer
+    with (
+        patch.object(hf_adapter, "_load", return_value=(lambda text: text.split(), 0)),
+        patch.object(hf_adapter, "_declared_input_limit", return_value=model_max_length),
+    ):
+        return HuggingFaceTokenizer(model="org/model")
 
 
 # ---------------------------------------------------------------------------
```

---

### Incident Patch 10: `b36eca0d` (2026-09-29)
**Commit Message**: Merge branch 'dev' into fix/pgvector-shared-prune-safety

**File**: `.agents/skills/cognee-cli/SKILL.md` (renamed, +32/-11)
```diff
@@ -7,8 +7,9 @@ description: Use when the user wants to drive cognee from the terminal with cogn
 
 `cognee-cli` ships with the package (entry point in `cognee/cli/_cognee.py`;
 each command lives in `cognee/cli/commands/`). Every command has
-`--help` for its flags, but only a few (`memify`, `eval`, `serve`, `push`,
-`migrate`) include usage examples — for the memory commands use the examples
+`--help` for its flags, but only a few (`demo`, `memify`, `eval`, `serve`,
+`push`, `upgrade`, `downgrade`, `stamp`, and `search` with one CODE example)
+include usage examples — for the memory commands use the examples
 in this file. Needs `LLM_API_KEY` configured, same as the SDK.
 
 ## Core flow
@@ -29,8 +30,9 @@ hood); `--background`/`-b` runs the cognify stage in the background, and
 `--datasets`/`-d`, `--top-k`/`-k` (default 10), and `--session-id`/`-s`.
 
 `forget` targets `--dataset`, `--dataset-id`, `--data-id` (needs a dataset), or
-`--everything`/`--all` — one unified command covering what `delete`, `prune`,
-and `empty_dataset` used to do separately.
+`--everything`/`--all` — one unified command replacing the older `delete` and
+empty-dataset paths. `--memory-only` (with a dataset) drops the graph and
+vectors but keeps the raw files, so the data can be rebuilt.
 
 > **`forget --all` does not ask for confirmation.** It deletes every dataset
 > immediately, even on a non-interactive stdin. The legacy `delete --all`
@@ -96,17 +98,36 @@ cognee-cli -ui                               # launch API server + UI (see cogne
 cognee-cli serve --url http://localhost:8000 # connect CLI/SDK to a running instance
 ```
 
-## Relational DB migrations (Alembic)
+## Database migrations
+
+cognee has two migration chains: the relational schema (Alembic, in
+`cognee/alembic/`) and the graph/vector data chain (slugs registered in
+`cognee/modules/migrations/registry.py`). Both run automatically — at API
+server startup and on the first write (`remember`, `add`, `cognify`,
+`improve`, …) in an SDK/CLI process — unless `ENABLE_AUTO_MIGRATIONS=false`.
+So you rarely need these commands; they are for inspecting state, disabled
+auto-migration, and rollbacks. There is no `migrate` command.
 
 ```bash
-cognee-cli upgrade        # apply migrations
-cognee-cli downgrade
-cognee-cli history
-cognee-cli current
+cognee-cli current                    # stamped revision per database (per dataset
+                                      # with access control on)
+cognee-cli history                    # the data-migration chain, newest first
+cognee-cli upgrade                    # relational to head, then data chain to head
+cognee-cli upgrade <slug>             # data chain up to and including <slug>
+cognee-cli upgrade --alembic <rev>    # pin the relational (Alembic) target
+cognee-cli downgrade <slug|base>      # REWRITES DATA; revision is required,
+                                      # prompts unless --force; --dataset <uuid>
+                                      # (repeatable) limits it
+cognee-cli stamp <head|base|slug>     # set the stored revision WITHOUT running
+                                      # anything; prompts unless --force;
+                                      # --dataset <uuid> (repeatable) limits it
 ```
 
-Typically needed after version upgrades when the server refuses to start on
-an old schema.
+The positional revision is always a **data-chain slug**; the relational
+target goes through `--alembic`. `downgrade` leaves the relational schema
+alone unless you pass `--alembic`. `upgrade` runs even when
+`ENABLE_AUTO_MIGRATIONS=false`. `--alembic-path` (or `COGNEE_ALEMBIC_PATH`)
+points at a custom Alembic scripts directory.
 
 ## Gotchas
 
```

**File**: `.agents/skills/cognee-custom-graph-models/SKILL.md` (added, +201/-0)
```diff
@@ -0,0 +1,201 @@
+---
+name: cognee-custom-graph-models
+description: Use when defining the shape of cognee's knowledge graph with graph_model= — writing DataPoint node classes, choosing identity and index fields so nodes merge and are searchable, declaring typed Edge fields and FromIdentity references, building a model from a JSON schema, or debugging duplicated nodes, missing edges, or InvalidReferenceTypeError.
+---
+
+# Custom graph models
+
+By default cognee extracts a generic `KnowledgeGraph` of entities and
+relationships. Pass your own model with `graph_model=` and the LLM fills
+your node and edge types instead.
+
+```python
+from typing import Annotated, Literal
+import cognee
+from cognee.low_level import DataPoint, Edge, FromIdentity
+
+
+class Role(DataPoint):
+    name: str
+    metadata: dict = {"index_fields": ["name"], "identity_fields": ["name"]}
+
+
+class Person(DataPoint):
+    name: str
+    is_a: Annotated[Role, FromIdentity()] | None = None  # reference by name
+    reports_to: list[Edge["Person", "Person"]] = []  # edge owned by Person
+    metadata: dict = {"index_fields": ["name"], "identity_fields": ["name"]}
+
+
+class PeopleGraph(DataPoint):  # the root the LLM fills
+    people: list[Person]
+    friends_with: list[Edge[Person, Person]] = []
+    family: list[Edge[Person, Person, Literal["married_to", "sibling_of"]]] = []
+    metadata: dict = {"index_fields": [], "transparent": True}
+
+
+await cognee.remember(text, graph_model=PeopleGraph, custom_prompt="Extract every person...")
+```
+
+Full example: `examples/guides/custom_graph_model.py`.
+
+## Use it
+
+### Nodes: DataPoint classes
+
+Every node type subclasses `DataPoint` (`from cognee.low_level import
+DataPoint`). Its fields become:
+
+- **Node properties:** scalars, strings, dicts, and anything that is not a
+  DataPoint.
+- **Edges named after the field:** a field holding a DataPoint or a list of
+  DataPoints. `members: list[Person]` becomes `members` edges.
+
+`dict[str, Person]`, sets and plain tuples are stored as properties, not
+edges.
+
+### Identity and search: `metadata`
+
+| Key | What it does |
+|---|---|
+| `identity_fields` | The node id is derived from these field values (normalized: lowercased, spaces to `_`, apostrophes removed). The same entity from two chunks or two runs becomes **one node**. |
+| `index_fields` | Each field gets a vector collection named `<ClassName>_<field>`, so recall can find the node. |
+| `transparent` | The node is not stored; its children take its place. Use it for a root container like `PeopleGraph`. |
+
+**Without `identity_fields` every node gets a random id, so the same person
+is duplicated in every chunk and every run.** Set it on every node type that
+represents a real-world entity.
+
+**Write `metadata` explicitly**, as in the examples above. There is also an
+annotation shortcut (`from cognee.infrastructure.engine import Dedup,
+Embeddable`; `name: Annotated[str, Embeddable(), Dedup()]`), but today only
+half of it works:
+
+- `Dedup()` works: ids are derived from the marked fields.
+- `Embeddable()` does not index. The markers update the class-level
+  default, but each instance still carries `{"index_fields": []}`, and
+  indexing reads the instance, so no vector collection is created and
+  recall cannot find the node.
+
+Markers are also ignored entirely when the class declares `metadata`
+itself.
+
+### Typed edges: `list[Edge[Source, Target, Name]]`
+
+The LLM answers edges as flat rows of identity strings (`source`, `target`),
+and cognee resolves them to the extracted nodes. The third parameter
+controls the relationship name:
+
+| Declaration | Relationship name |
+|---|---|
+| `list[Edge[Person, Person]]` | The field name (`friends_with`) |
+| `list[Edge[Person, Person, Literal["a", "b"]]]` | The LLM picks one value |
+| `list[Edge[Person, Person, str]]` | Free-form from the LLM, normalized |
+
+- **Where to declare:** on the root model for relationships with no obvious
+  owner, or on the owning node. On the owner, endpoints of the owner's own
+  type must be strings (`Edge["Person", "Person"]`), because the class is
+  not defined yet inside its own body.
+- **Always a list:** `Edge[...]` or `Edge[...] | None` on its own raises.
+- **Both endpoint types need exactly one `identity_fields` entry.**
+
+### References: `Annotated[Target, FromIdentity()]`
+
+Instead of a nested object, the LLM answers the identity string of a node
+(`is_a: "engineer"`), and cognee links to that node. Supported spellings:
+`Target`, `Target | None`, `list[Target]`, `list[Target] | None`.
+Anything else raises `InvalidReferenceTypeError`. The target needs exactly
+one identity field, and its other required fields need defaults.
+
+### Edge values you build by hand
+
+`Edge(source=..., target=..., relationship_type=..., weight=...,
+properties={...})`. An omitted `source` falls back to the node declaring the
+field; on a parametrized field that node must be the declared `Sour
```

**File**: `.agents/skills/cognee-custom-pipelines/SKILL.md` (added, +229/-0)
```diff
@@ -0,0 +1,229 @@
+---
+name: cognee-custom-pipelines
+description: Use when building your own cognee processing — writing custom tasks, chaining them into a pipeline with run_custom_pipeline or the lightweight run_pipeline (from cognee.pipelines import run_pipeline), storing custom DataPoints with add_data_points, running custom extraction/enrichment over the existing graph with memify, checking pipeline run status, or debugging how data flows between tasks (batch_size, data_per_batch, ctx, Drop, enriches).
+---
+
+# Custom tasks and pipelines
+
+Everything cognee does runs as a **pipeline**: an ordered list of **tasks**,
+each a plain Python function whose output feeds the next one. `remember()`
+is the right tool for ordinary ingestion. Build a pipeline when you need
+processing cognee does not ship: your own extraction, your own node types,
+or a post-processing step over the graph.
+
+```python
+import cognee
+from cognee.modules.pipelines import Task
+from cognee.tasks.storage import add_data_points
+from cognee.low_level import DataPoint
+
+
+class Person(DataPoint):
+    name: str
+    metadata: dict = {"index_fields": ["name"], "identity_fields": ["name"]}
+
+
+async def extract_people(data_items: list) -> list[Person]:
+    people = []
+    for item in data_items:  # always a list, see below
+        text = item if isinstance(item, str) else ""
+        people += [Person(name=n.strip()) for n in text.split(",") if n.strip()]
+    return people
+
+
+result = await cognee.run_custom_pipeline(
+    tasks=[
+        Task(extract_people, needs_llm=False),
+        Task(add_data_points, needs_llm=False),  # store in graph + vector DBs
+    ],
+    data=["Ada Lovelace, Alan Turing"],
+    dataset="people",
+)
+```
+
+## Use it
+
+### Pick the runner
+
+There are three, and two share the name `run_pipeline`:
+
+| Runner | Import | Use it for |
+|---|---|---|
+| `cognee.run_custom_pipeline(...)` | `cognee` | The normal choice: runs your tasks against a dataset with permissions, a per-dataset lock, run records, and status |
+| Full orchestrator `run_pipeline(tasks=..., data=..., datasets=...)` | `cognee.modules.pipelines` | What `run_custom_pipeline` and `cognify` call; yields `PipelineRunInfo` |
+| Lightweight `run_pipeline([...], data=...)` | `from cognee.pipelines import run_pipeline` (after `import cognee`, the attribute `cognee.pipelines.run_pipeline` is the orchestrator) | Quick chains of `task()` specs with no permissions, locks, run rows, or migrations; returns the last step's outputs |
+
+`cognee.run_custom_pipeline(tasks, data=None, dataset="main_dataset",
+user=None, incremental_loading=False, data_per_batch=20,
+run_in_background=False, pipeline_name="custom_pipeline", data_cache=False,
+...)` returns `{dataset_id: PipelineRunInfo}` (the started run when
+`run_in_background=True`). With `data=None` it runs over the dataset's
+existing documents (`Data` rows).
+
+### Write a task
+
+```python
+from cognee.modules.pipelines import Task
+from cognee.modules.pipelines.models import PipelineContext
+from cognee.modules.pipelines.tasks.task import task_summary
+from cognee.pipelines import Drop
+
+
+@task_summary("Tagged {n} chunk(s)")
+async def tag_chunks(chunks: list, ctx: PipelineContext = None, label: str = "x"):
+    for chunk in chunks:
+        chunk.metadata["label"] = label
+    return chunks  # or yield per item; return/yield Drop to discard
+
+
+tag = Task(tag_chunks, label="reviewed", batch_size=10, needs_llm=False)
+```
+
+- A task is an `async def`, a generator, an async generator, or a plain
+  `def`. Extra `Task(fn, *args, **kwargs)` arguments are passed after the
+  pipeline data.
+- `needs_llm=False` on tasks that never call an LLM lets an LLM-free
+  pipeline skip the LLM connection check.
+- `ctx` (injected by the parameter **name** `ctx`) carries `user`,
+  `data_item`, `dataset`, `pipeline_run_id`, `pipeline_name`, and `extras`.
+- `task.with_config(batch_size=..., **kwargs)` returns a modified copy.
+
+### How data flows
+
+- **Each document runs the whole chain on its own** with `run_custom_pipeline`
+  or the orchestrator, and the first task receives it as a **one-element
+  list** (`[data_item]`), not the bare item. The lightweight `run_pipeline`
+  passes `data` to the first task unchanged.
+- **`data_per_batch`** (default 20) is how many documents run at the same
+  time. It is a concurrency limit, not a batch size.
+- **`batch_size` belongs to the consumer.** A task's `batch_size` decides how
+  the *previous* task's generator output is grouped before it is passed in.
+  Generator tasks always hand over lists; a coroutine or function hands over
+  its single return value.
+- **Streaming:** each upstream result goes down the chain immediately, so a
+  downstream task can run many times per document.
+- **`enriches=True`:** if the task returns `None`, its input is passed on
+  unchanged (coroutines and functions only, not generators).
+- **`Drop`:** returning or yielding it
```

**File**: `.agents/skills/cognee-forget/SKILL.md` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+---
+name: cognee-forget
+description: Use when removing data from cognee memory with forget() in the SDK, HTTP API, or CLI — finding which dataset and document hold the content to delete (listing datasets and data items, reading raw content), choosing between deleting one document, a whole dataset, or only the graph/vector memory, and doing it safely.
+---
+
+# Remove data with forget()
+
+`forget()` is cognee's one deletion API. It removes one document, a whole
+dataset, or only the derived memory (graph + vectors) while keeping the raw
+files. Deletion cannot be undone, so the workflow is always **find, read,
+confirm, then delete**.
+
+> **Hard limits for agents**
+> - Delete only what the user asked to forget. Identify it by reading the
+>   content first; never guess from a file name alone.
+> - Confirm the exact items with the user before deleting, unless they
+>   already named exact ids.
+> - The widest deletion you may run is `forget(everything=True)`, and only
+>   when the user explicitly asks to wipe all of their memory. Never use any
+>   other reset or wipe mechanism to delete data.
+
+## Use it
+
+### 1. Find the dataset
+
+```python
+import cognee
+
+datasets = await cognee.datasets.list_datasets()  # datasets the user can read
+for ds in datasets:
+    print(ds.id, ds.name)
+```
+
+HTTP: `GET /api/v1/datasets`. CLI: `cognee-cli datasets list`.
+
+### 2. List its documents
+
+```python
+items = await cognee.datasets.list_data(dataset_id)  # all Data rows, oldest first
+for item in items:
+    print(item.id, item.name, item.extension, item.created_at)
+```
+
+HTTP: `GET /api/v1/datasets/{dataset_id}/data?limit=100&offset=0` (limit up
+to 1000; `GET .../data/count` for the total; example:
+`examples/python/dataset_data_pagination.py`). CLI:
+`cognee-cli datasets data <dataset_uuid>`.
+
+Each item has `id`, `name`, `created_at`, `extension`, `mime_type`,
+`raw_data_location`, `dataset_id`, `label`, `external_metadata` (including
+any `node_set`), and `data_size`.
+
+### 3. Read the content before deciding
+
+Names are often `text_<hash>.txt`, so read the content to find what the user
+means.
+
+- HTTP: `GET /api/v1/datasets/{dataset_id}/data/{data_id}/raw` returns the
+  stored file (404 if it is gone).
+- SDK: there is no "get raw" helper; open the stored location:
+
+```python
+from cognee.infrastructure.files.utils.open_data_file import open_data_file
+
+async with open_data_file(item.raw_data_location, mode="rb") as f:
+    preview = f.read(2000).decode("utf-8", errors="replace")
+```
+
+Judge matches by meaning, not only by keywords, and show the user the
+candidates (name + a short preview) before deleting.
+
+### 4. Delete
+
+| Goal | Call | What remains |
+|---|---|---|
+| One document | `forget(data_id=..., dataset_id=...)` (or `dataset="name"`) | Nothing of that document; shared entities stay while another document still references them |
+| A whole dataset | `forget(dataset="name")` or `forget(dataset_id=...)` | The dataset is deleted outright: the record, its data rows, graph and vector stores, and attributed sessions |
+| Rebuild a dataset's graph later | `forget(dataset="name", memory_only=True)` | Raw files and data rows; graph, vectors, sessions and pipeline status are reset, so the data can be re-processed |
+| One document's memory only | `forget(dataset="name", data_id=..., memory_only=True)` | That document's raw file and row |
+| Every dataset the user can delete | `forget(everything=True)` | Nothing, in any dataset the user has `delete` on in the current tenant (shared ones included). Only on explicit request (see the hard limits) |
+
+Return values: `{"data_id", "dataset_id", "status"}` for a document,
+`{"dataset_id", "status"}` for a dataset (plus `data_records_reset` with
+`memory_only`), `{"datasets_removed", "status"}` for everything
+(`datasets_removed` counts the datasets the user can *read*, not the delete
+set).
+
+**HTTP:** `POST /api/v1/forget` with a JSON body; camelCase and snake_case
+keys both work: `{"datasetId": "...", "dataId": "..."}`,
+`{"dataset": "name", "memoryOnly": true}`, `{"everything": true}`. Invalid
+combinations return 422.
+
+**CLI:** `cognee-cli forget --dataset NAME | --dataset-id UUID
+[--data-id UUID] [--memory-only]`, or `--everything` / `--all`. The CLI
+**does not ask for confirmation**; confirm with the user first.
+
+## Pitfalls
+
+- **A `data_id` that is not in the dataset returns success and deletes
+  nothing.** The delete path treats an unknown id as a custom-graph-model
+  delete. Always take the id from `list_data` for that same dataset, and
+  check it is still listed afterwards if it matters.
+- **Pass either `dataset` or `dataset_id`, not both** (`ValueError`).
+  `data_id` and `memory_only` both need a dataset.
+- **`memory_only` is ignored when `everything=True`** in the SDK (the CLI
+  rejects the combination). `everything=True` always deletes everything.
+- **Not found and not allowed look the same.
```

**File**: `.agents/skills/cognee-improve-sessions/SKILL.md` (added, +222/-0)
```diff
@@ -0,0 +1,222 @@
+---
+name: cognee-improve-sessions
+description: Use when working with cognee's session memory or improve() — storing conversation turns, agent traces and feedback with session_id, bridging sessions into the permanent graph, reading an ImproveResult, understanding why an improve stage was skipped, already_completed or lock_held, or tuning the IMPROVE_* settings.
+---
+
+# Session memory and improve()
+
+cognee has two kinds of memory:
+
+- **Session memory**: a fast cache of conversation turns, agent traces, and
+  feedback, keyed by `session_id`. Writing is instant, with no LLM
+  extraction.
+- **The permanent graph**: what `remember()` builds without a session.
+
+`improve()` connects them. It bridges session content into the graph and
+enriches the graph itself. `remember()` calls it automatically, so most
+users never call it directly.
+
+```python
+import cognee
+
+# Session write: returns immediately; improve() bridges it in the background
+await cognee.remember("User prefers dark mode.", session_id="chat_1")
+
+# Session-aware query: session cache first, then the graph
+results = await cognee.recall("What does the user prefer?", session_id="chat_1")
+
+# Bridge sessions into a dataset's graph explicitly
+result = await cognee.improve(dataset="main_dataset", session_ids=["chat_1"])
+print(result.status, result.stage_summary())
+
+await cognee.wait_for_background_tasks()  # before a script exits
+```
+
+## Use it
+
+### Writing session memory
+
+| What | How |
+|---|---|
+| A fact or note | `remember(text, session_id=...)` (stored as a Q&A entry with the text as the answer) |
+| A Q&A turn | `recall(query, session_id=...)` with a completion search type saves the turn itself; or `remember(cognee.QAEntry(question=..., answer=...), session_id=...)` |
+| An agent step | `remember(cognee.TraceEntry(origin_function=..., status="success", ...), session_id=...)`, or the `@cognee.agent_memory(save_session_traces=True)` decorator |
+| Feedback on an answer | `remember(cognee.FeedbackEntry(qa_id=..., feedback_score=...), session_id=...)` or `cognee.session.add_feedback(session_id, qa_id, feedback_text=..., feedback_score=...)` |
+| Read a session | `cognee.session.get_session(session_id, last_n=...)` |
+
+Requirements: `CACHING=true` (default). The cache backend is
+`CACHE_BACKEND`, one of `sqlite` (default), `postgres`, `redis`, `fs`,
+`tapes`. Sessions expire after `SESSION_TTL_SECONDS` (default 7 days).
+
+### What improve() does: nine stages, in order
+
+Every run goes through the same ordered stages
+(`cognee/modules/improve/registry.py`). Each stage checks a gate before it
+spends any LLM or embedding cost, and reports one `StageResult`.
+
+| # | Stage | What it does | Runs when |
+|---|---|---|---|
+| 1 | `feedback_weights` | Adjusts the weight of graph elements that rated answers used | `session_ids` given; adapter supports feedback weights |
+| 2 | `persist_session_qa` | Turns session Q&A into graph content (node set `user_sessions_from_cache`) | `session_ids` given. **The only fatal stage** |
+| 3 | `persist_agent_traces` | Turns agent-trace feedback into graph content | `session_ids` given |
+| 4 | `extract_agent_context` | Drafts agent-profile lessons from traces | `session_ids`, `CACHING` + `AUTO_FEEDBACK`, an LLM |
+| 5 | `distill_sessions` | Distills session learnings into the graph | `session_ids`, an LLM |
+| 6 | `update_user_preferences` | Folds rated turns into per-user preferences | `session_ids`, `PERSONALIZATION_ENABLED=true` (default false) |
+| 7 | `build_truth_subspace` | Builds the truth subspace from distilled learnings | `session_ids`, `build_truth_subspace=True`, a Ladybug graph |
+| 8 | `triplet_enrichment` | Triplet embeddings over the graph (memify) | `TRIPLET_EMBEDDING=true` (**default false**), or custom tasks/data passed |
+| 9 | `global_context_index` | Bucket and root summaries for global questions | `build_global_context_index=True`, an LLM |
+
+Stages 1–7 need `session_ids`; 8 and 9 work on the graph alone. The order
+matters: 4 feeds 5, 5 feeds 7, and 7 runs before 8.
+
+### Reading the result
+
+`improve()` returns an `ImproveResult`, and so do `POST /api/v1/improve`, the
+CLI, and `RememberResult.improve`.
+
+- `result.status`: `completed`, `errored` (any stage errored), `skipped`
+  (every stage skipped), or `running` (background, not finished).
+- `result.stages`: one `StageResult` per stage, with `stage`, `status`
+  (`completed` / `already_completed` / `skipped` / `errored`), `reason`,
+  `error`, `counts`, `duration_ms`.
+- `result.stage("distill_sessions")`, `result.stage_summary()`,
+  `result.lock_held`, `result.rerun_requested`, `result.rerun_passes`.
+- `await result.wait()` finishes a background run (no-op otherwise).
+
+**Skip and no-op reasons:**
+
+| Reason | Meaning / fix |
+|---|---|
+| `no_session_ids` | Session stage, no `session_ids` passed |
+| `disabled_by_config` | Listed in `IMPROVE_STAGES_DISABLED` |
+| `triplet_embedding_disabl
```

**File**: `.agents/skills/cognee-ingestion/SKILL.md` (added, +210/-0)
```diff
@@ -0,0 +1,210 @@
+---
+name: cognee-ingestion
+description: Use when putting data into cognee memory with remember() — choosing inputs (text, files, folders, URLs, repos, databases), datasets and node_sets, loaders, ontologies, the graph extractor (LLM or GLiNER), chunking, dry-run cost estimates, temporal graphs, or when remember() raises on a keyword argument.
+---
+
+# Ingest data with remember()
+
+`remember()` is cognee's ingestion API. One call stores the data, builds the
+knowledge graph, and enriches it. Use it for all ingestion; every option in
+this skill is a `remember()` argument unless it says otherwise.
+
+```python
+import cognee
+
+result = await cognee.remember("Einstein was born in Ulm.")  # text
+result = await cognee.remember(
+    ["./notes.md", "./report.pdf"],  # files
+    dataset_name="research",
+)
+print(result.status, result.dataset_id)  # "completed", UUID
+```
+
+All cognee functions are async. Without `dataset_name` data goes to
+`main_dataset`. Needs `LLM_API_KEY` unless you use the GLiNER extractor
+(below).
+
+## Use it
+
+### Inputs
+
+`data` accepts a string, a list of strings, file paths (absolute, `file://`,
+`s3://`), http(s) URLs, binary streams, or a list mixing them.
+
+- **URLs** are fetched and scraped (needs `ALLOW_HTTP_REQUESTS=true`, the
+  default).
+- **Folders** are ingested file by file. A folder that looks like a code
+  project, or a GitHub/GitLab URL, becomes one code repository (needs `git`
+  on PATH).
+- **Code files** (`.py`, `.ts`, `.go`, …) go down the code-graph route: a
+  deterministic graph, no LLM calls, searchable only with
+  `SearchType.CODE`. To index a whole repository explicitly, pass
+  `content_type="code"`.
+- **Databases and dlt sources**: a SQL connection string, a dlt
+  `DltResource` / `DltSource`, or a CSV. dlt is a core dependency, so no
+  extra is needed (`cognee[dlt]` is an empty compatibility extra). Options: `primary_key` (default `"id"`),
+  `write_disposition` (`"replace"` default, or `"append"`), `query`,
+  `max_rows_per_table`.
+- **Skill playbooks** (`SKILL.md` files): `content_type="skills"`; ingests
+  into the target dataset (default `main_dataset`), so pass `dataset_name`
+  to keep skills in their own dataset.
+
+### Where the data goes
+
+| Argument | What it does |
+|---|---|
+| `dataset_name` / `dataset_id` | Target dataset. `dataset_id` wins. A dataset is the unit of permissions and isolation. |
+| `node_set=["AI", "FinTech"]` | Tags the data so recall can filter to it later with `recall(..., node_name=["AI"])`. |
+| `session_id="chat_1"` | Writes to the fast session cache instead of the graph; `improve()` bridges it into the graph in the background. See the `cognee-improve-sessions` skill. Requires `CACHING=true`. |
+
+### How the graph is built
+
+| Argument | What it does |
+|---|---|
+| `extractor` | `"llm"` or `"gliner_demo"` (alias `"gliner"`). Default is `GRAPH_EXTRACTOR=auto`: the LLM when an API key is configured, otherwise GLiNER. |
+| `graph_model=MyModel` | Extract into your own DataPoint model instead of the generic `KnowledgeGraph`. See the `cognee-custom-graph-models` skill. |
+| `custom_prompt` | Replaces the entity-extraction prompt (ignored by GLiNER). |
+| `config={"ontology_config": {...}}` | Ground entities in an OWL ontology (below). |
+| `temporal_cognify=True` | Builds an event/timestamp graph for `SearchType.TEMPORAL`. |
+| `chunk_size`, `chunker` | Max tokens per chunk (default: derived from the embedding and LLM limits) and the chunker class (default `TextChunker`). |
+| `preferred_loaders` | Choose a loader per file type (below). |
+| `self_improvement` | Default `True`: runs `improve()` after the graph is built. Its outcome is on `result.improve` / `result.improve_error`; a failed improve never fails the remember. |
+| `run_in_background=True` | Returns immediately with `status="running"`; `await result` to wait. |
+
+### Ontologies
+
+```python
+from cognee.modules.ontology.rdf_xml.RDFLibOntologyResolver import RDFLibOntologyResolver
+
+config = {
+    "ontology_config": {
+        "ontology_resolver": RDFLibOntologyResolver(ontology_file="./my.owl"),
+        # "ontology_mode": "strict",   # drop entities with no ontology match
+    }
+}
+await cognee.remember(texts, config=config)
+```
+
+Or set `ONTOLOGY_FILE_PATH` (plus `ONTOLOGY_MODE`, `MATCHING_STRATEGY`) in
+`.env`. `annotate` (default) only enriches; `strict` drops entities that
+match no ontology class or individual. It prunes only the graph, chunk text
+is still stored. Strict mode with an empty or missing ontology file is a hard
+error. Over HTTP, upload the ontology to `/api/v1/ontologies` and pass its
+`ontology_key` to `POST /api/v1/remember`. Example:
+`examples/guides/ontology_quickstart.py`.
+
+### Loaders
+
+Each file is claimed by the first loader that accepts it. Default order:
+code, text, pypdf, image, audio, video, dlt_csv, csv, unstructured,
+advanced_pdf, docling. Names: `text_loader`, `code_loader`, `cs
```

**File**: `.agents/skills/cognee-install/SKILL.md` (renamed, +1/-1)
```diff
@@ -82,7 +82,7 @@ The `add()` / `cognify()` / `search()` / `memify()` primitives still exist and
 are what `remember`/`recall`/`improve` call underneath — reach for them when you
 need to drive a stage in isolation (e.g. custom pipeline tasks), not for
 ordinary ingestion. `cognee.delete` is formally deprecated (since 0.3.9);
-`forget()` is the v1 replacement, unifying the old delete/prune/empty_dataset
+`forget()` is the v1 replacement, unifying the old delete/empty_dataset
 paths behind one call. When to use `recall()` versus the low-level `search()`
 is covered in `docs/recall-vs-search.md`.
 
```

**File**: `.agents/skills/cognee-migrations/SKILL.md` (added, +200/-0)
```diff
@@ -0,0 +1,200 @@
+---
+name: cognee-migrations
+description: Use when dealing with cognee database migrations — understanding when they run automatically, checking or repairing migration state with cognee-cli upgrade/downgrade/stamp/current, a write blocked by a failed migration, authoring a new Alembic (relational schema) revision or a graph/vector data migration, or moving data between systems (relational DB import, memory export/import).
+---
+
+# Database migrations
+
+cognee has **two migration chains**, run together:
+
+| Chain | Changes | Lives in | Revision stored in |
+|---|---|---|---|
+| **Relational schema** (Alembic) | Tables and columns of the relational DB (users, datasets, ACLs, pipeline runs, …) | `cognee/alembic/` (`alembic.ini` is in `cognee/`) | `alembic_version` table |
+| **Graph/vector data** | Cross-store data rewrites (re-keying node ids, adding graph columns) across graph DB, vector DB and relational ledger | `cognee/modules/migrations/` (`registry.py`, `versions/`) | Per dataset: `dataset_database.migration_revision` (access control on). Globally: `global_database_version.global_migration_revision` (access control off) |
+
+## Use it
+
+### They run by themselves
+
+`run_migrations()` applies the relational chain first, then the data chain.
+It runs:
+
+- at API server startup (and in the Docker `entrypoint.sh` before gunicorn);
+- on the first write in an SDK or CLI process (`remember`, `add`, `cognify`,
+  `improve`, `memify`, memory imports), once per process;
+- when you call `await cognee.run_migrations()`.
+
+A fresh database is built by running the whole chain (no stamping). At
+head, the first run in each process still does a no-op Alembic upgrade plus
+a scan of the per-database revision rows; later calls in the same process
+are skipped by an in-memory flag. `ENABLE_AUTO_MIGRATIONS=false`
+turns off all automatic runs; then run `cognee-cli upgrade` yourself.
+
+Concurrent processes are serialized by a migration lock: a Postgres advisory
+lock (works across hosts) or a file lock next to the SQLite DB (one host
+only).
+
+### Check and repair
+
+```bash
+cognee-cli current                   # stamped revision per database, and the last failure
+cognee-cli history                   # the data chain, newest first
+cognee-cli upgrade                   # relational to head, then data chain to head
+cognee-cli upgrade <slug>            # data chain up to and including <slug>
+cognee-cli upgrade --alembic <rev>   # pin the relational target
+cognee-cli downgrade <slug|base> [--dataset UUID ...] [--alembic REV] [--force]
+cognee-cli stamp <head|base|slug> [--dataset UUID ...] [--force]
+```
+
+- The positional revision is always a **data-chain slug**; relational
+  targets go through `--alembic`.
+- `downgrade` rewrites data and asks for confirmation. It only reverts
+  spans where every migration defines a `down()`, and leaves the relational
+  schema alone unless you pass `--alembic`.
+- `stamp` changes only the stored data-chain revision, without running
+  anything. Use `stamp base --dataset <id>` and then `upgrade` when a
+  database's data drifted from its stamp (for example after restoring a
+  backup); the chain is idempotent and converges it.
+- `upgrade` runs even with `ENABLE_AUTO_MIGRATIONS=false`.
+
+### A write is blocked
+
+If a dataset's data migration failed, writes to that dataset are refused
+until it succeeds (with access control off, any failure blocks all writes).
+The server still starts. Run `cognee-cli current` to see the error, fix the
+cause, then `cognee-cli upgrade`. A failed run is retried on the next start
+or write.
+
+### Moving data between systems (not schema migrations)
+
+| Goal | Use |
+|---|---|
+| Turn an existing relational database into a graph | `migrate_relational_database(graph_db, schema)` (`cognee/tasks/ingestion/migrate_relational_database.py`), with the source DB set by `MIGRATION_DB_PROVIDER` / `_PATH` / `_NAME` / `_HOST` / `_PORT` / `_USERNAME` / `_PASSWORD`. Examples: `examples/demos/ingestion_and_migration/` |
+| Back up a dataset, or move it to another cognee instance | A COGX archive, see below |
+| Export a dataset's graph for other tools | `await cognee.export(dataset, format=...)`: `"json"`, `"graphml"` or `"cypher"` write a file (one way: cognee can't import them back); `"pydantic"` (default) returns typed DataPoint objects in memory |
+| Import from another memory system (Mem0, Zep/Graphiti, Letta, LangMem) | Build a `MemorySource` (`cognee/modules/migration/sources/`) and pass it to `await cognee.remember(source, dataset_name=...)` |
+
+There is no tool that moves a whole deployment from one database backend to
+another.
+
+#### COGX archives
+
+COGX (Cognee eXchange, `cognee/modules/migration/cogx.py`) is cognee's
+portable memory format and the only export format cognee can import back.
+An archive is a directory with a `manifest.json` (COGX version, source
+system, the dataset's data-migration revision) and one JSON
```

---

### Incident Patch 11: `20fb5c80` (2026-09-29)
**Commit Message**: fix(embed): Pad fastembed batches to their longest text (SDK-810)

Description: fastembed keeps a fixed padding length stored in a model's
tokenizer.json (all-MiniLM-L6-v2, gte-base: 128) and pads only the texts
below it, so a batch mixing texts above and below that length is a ragged
array and embedding fails. Correctly sized chunks (SDK-868) exposed it: the
old oversize chunks were all cut to one length by accident. The engine now
switches such a tokenizer to fastembed's own default, pad to the batch's
longest. Padding is masked by the model, so embeddings are unchanged.

The chunk budget e2e now also checks that every stored chunk has an
embedding in the vector store, and runs for all-MiniLM-L6-v2 as well.

**File**: `.github/workflows/e2e_tests.yml` (modified, +5/-3)
```diff
@@ -166,13 +166,15 @@ jobs:
       - name: Run keyless e2e
         run: uv run python ./cognee/tests/e2e/keyless/keyless_ingest_check.py
 
-      # Every stored chunk must fit the embedding model's window, so nothing is
-      # embedded truncated: once with the default model, once with a model whose
-      # tokenizer.json stores a truncation length (SDK-810).
+      # Every stored chunk must fit the embedding model's window and be embedded
+      # whole: with the default model, with a model whose tokenizer.json stores a
+      # truncation length, and with one that stores a fixed padding length (SDK-810).
       - name: Run chunk token budget check (default model)
         run: uv run python ./cognee/tests/e2e/keyless/chunk_token_budget_check.py
       - name: Run chunk token budget check (snowflake-arctic-embed-xs)
         run: uv run python ./cognee/tests/e2e/keyless/chunk_token_budget_check.py snowflake/snowflake-arctic-embed-xs
+      - name: Run chunk token budget check (all-MiniLM-L6-v2)
+        run: uv run python ./cognee/tests/e2e/keyless/chunk_token_budget_check.py sentence-transformers/all-MiniLM-L6-v2
 
       # A cognify run SIGKILLed after two documents, a second run, then startup
       # recovery: the two completed documents must survive and the run must be
```

**File**: `cognee/infrastructure/databases/vector/embeddings/FastembedEmbeddingEngine.py` (modified, +23/-0)
```diff
@@ -74,6 +74,28 @@ def fastembed_model_cached(model: str) -> tuple[bool, str, str | None]:
     return any(path.exists() for path in candidates), str(cache_dir), size_hint
 
 
+def pad_to_batch_longest(embedding_model) -> None:
+    """Make the loaded model pad every batch to its longest text, as fastembed does
+    for models whose tokenizer.json stores no padding.
+
+    Some repos store a fixed-length padding in tokenizer.json (all-MiniLM-L6-v2 and
+    gte-base: 128), and fastembed keeps it: texts below the length are padded to it,
+    longer ones (up to the model's window) are left as they are, so a batch mixing
+    the two is a ragged array and fastembed fails on it. Padding is masked by the
+    model, so the embeddings do not change. Truncation is left as fastembed set it.
+    """
+    tokenizer = getattr(getattr(embedding_model, "model", None), "tokenizer", None)
+    padding = getattr(tokenizer, "padding", None)
+    if not isinstance(padding, dict) or padding.get("length") is None:
+        return
+    tokenizer.enable_padding(
+        direction=padding["direction"],
+        pad_id=padding["pad_id"],
+        pad_type_id=padding["pad_type_id"],
+        pad_token=padding["pad_token"],
+    )
+
+
 class FastembedEmbeddingEngine(EmbeddingEngine):
     """
     Manages the embedding process using a specified model to generate text embeddings.
@@ -115,6 +137,7 @@ def __init__(
             location_var="FASTEMBED_CACHE_PATH",
         )
         self.embedding_model = TextEmbedding(model_name=model)
+        pad_to_batch_longest(self.embedding_model)
         # fastembed truncates input at the model's own limit without an error, so
         # chunks must never be sized past it: see input_limit().
         init_input_limit(self, max_completion_tokens)
```

**File**: `cognee/tests/e2e/keyless/chunk_token_budget_check.py` (modified, +18/-5)
```diff
@@ -13,12 +13,13 @@
 
 Run: ``python cognee/tests/e2e/keyless/chunk_token_budget_check.py [fastembed model]``
 
-With no argument the keyless default (BAAI/bge-small-en-v1.5) is used; the CI job
+With no argument the keyless default (BAAI/bge-small-en-v1.5) is used. The CI job
 also runs it with ``snowflake/snowflake-arctic-embed-xs``, whose tokenizer.json
-stores truncation at 512, so a counter that honoured it would report at most 512
-tokens for any document. (Models with fixed-length padding stored, such as
-all-MiniLM-L6-v2 and gte-base, cannot serve here: fastembed keeps that padding
-and fails on a batch mixing texts above and below its length.)
+stores truncation at 512 (a counter that honoured it would report at most 512
+tokens for any document), and with ``sentence-transformers/all-MiniLM-L6-v2``,
+whose tokenizer.json stores truncation and a fixed padding length of 128 (every
+text would count as 128 tokens, and fastembed, left with that padding, fails on
+a batch mixing texts above and below it).
 """
 
 import asyncio
@@ -97,6 +98,7 @@ async def main() -> None:
 
     nodes, _ = await (await get_graph_engine()).get_graph_data()
     chunks = [props for _, props in nodes if props.get("type") == "DocumentChunk"]
+    chunk_ids = {str(node_id) for node_id, props in nodes if props.get("type") == "DocumentChunk"}
     if len(chunks) < 5:
         problems.append(f"expected a multi-chunk document, got {len(chunks)} chunks")
 
@@ -118,6 +120,17 @@ async def main() -> None:
             problems.append(
                 f"chunk {chunk['chunk_index']}: chunker counted {believed}, tokenizer says {truth}"
             )
+
+    # Every chunk must have been embedded: its id must come back from the vector store.
+    from cognee.infrastructure.databases.vector import get_vector_engine_async
+
+    vector_engine = await get_vector_engine_async()
+    hits = await vector_engine.search(
+        collection_name="DocumentChunk_text", query_text="Alice", limit=len(chunks) + 5
+    )
+    missing = chunk_ids - {str(hit.id) for hit in hits}
+    if missing:
+        problems.append(f"{len(missing)} of {len(chunks)} chunks have no stored embedding")
     assert not problems, "\n".join(problems)
 
     stored = sum(len(oracle.tokenize(chunk["text"])) for chunk in chunks)
```

**File**: `cognee/tests/unit/infrastructure/test_fastembed_padding.py` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+"""fastembed pads every batch to its longest text (SDK-810).
+
+fastembed keeps a fixed padding length stored in a model's tokenizer.json
+(all-MiniLM-L6-v2, gte-base: 128) and pads only the texts below it, so a batch
+mixing texts above and below that length is a ragged array and fails. The engine
+switches such a tokenizer to fastembed's own default: pad to the batch's longest.
+"""
+
+from unittest.mock import MagicMock
+
+from cognee.infrastructure.databases.vector.embeddings.FastembedEmbeddingEngine import (
+    pad_to_batch_longest,
+)
+
+
+def _model(padding):
+    embedding_model = MagicMock()
+    embedding_model.model.tokenizer.padding = padding
+    return embedding_model
+
+
+def test_a_stored_fixed_length_becomes_batch_longest_with_the_same_pad_token():
+    model = _model(
+        {
+            "length": 128,
+            "pad_to_multiple_of": None,
+            "pad_id": 0,
+            "pad_token": "[PAD]",
+            "pad_type_id": 0,
+            "direction": "right",
+        }
+    )
+    pad_to_batch_longest(model)
+    model.model.tokenizer.enable_padding.assert_called_once_with(
+        direction="right", pad_id=0, pad_type_id=0, pad_token="[PAD]"
+    )
+
+
+def test_batch_longest_padding_is_left_alone():
+    model = _model(
+        {"length": None, "pad_id": 0, "pad_token": "[PAD]", "pad_type_id": 0, "direction": "right"}
+    )
+    pad_to_batch_longest(model)
+    model.model.tokenizer.enable_padding.assert_not_called()
+
+
+def test_no_padding_or_no_tokenizer_is_left_alone():
+    model = _model(None)
+    pad_to_batch_longest(model)
+    model.model.tokenizer.enable_padding.assert_not_called()
+    pad_to_batch_longest(MagicMock(model=None))  # nothing to adjust, nothing raised
```

---

### Incident Patch 12: `9f3de308` (2026-09-29)
**Commit Message**: Merge remote-tracking branch 'origin/dev' into fix/sdk-810-tokenizers-embedding-tokenizer

**File**: `.agents/skills/cognee-cli/SKILL.md` (renamed, +32/-11)
```diff
@@ -7,8 +7,9 @@ description: Use when the user wants to drive cognee from the terminal with cogn
 
 `cognee-cli` ships with the package (entry point in `cognee/cli/_cognee.py`;
 each command lives in `cognee/cli/commands/`). Every command has
-`--help` for its flags, but only a few (`memify`, `eval`, `serve`, `push`,
-`migrate`) include usage examples — for the memory commands use the examples
+`--help` for its flags, but only a few (`demo`, `memify`, `eval`, `serve`,
+`push`, `upgrade`, `downgrade`, `stamp`, and `search` with one CODE example)
+include usage examples — for the memory commands use the examples
 in this file. Needs `LLM_API_KEY` configured, same as the SDK.
 
 ## Core flow
@@ -29,8 +30,9 @@ hood); `--background`/`-b` runs the cognify stage in the background, and
 `--datasets`/`-d`, `--top-k`/`-k` (default 10), and `--session-id`/`-s`.
 
 `forget` targets `--dataset`, `--dataset-id`, `--data-id` (needs a dataset), or
-`--everything`/`--all` — one unified command covering what `delete`, `prune`,
-and `empty_dataset` used to do separately.
+`--everything`/`--all` — one unified command replacing the older `delete` and
+empty-dataset paths. `--memory-only` (with a dataset) drops the graph and
+vectors but keeps the raw files, so the data can be rebuilt.
 
 > **`forget --all` does not ask for confirmation.** It deletes every dataset
 > immediately, even on a non-interactive stdin. The legacy `delete --all`
@@ -96,17 +98,36 @@ cognee-cli -ui                               # launch API server + UI (see cogne
 cognee-cli serve --url http://localhost:8000 # connect CLI/SDK to a running instance
 ```
 
-## Relational DB migrations (Alembic)
+## Database migrations
+
+cognee has two migration chains: the relational schema (Alembic, in
+`cognee/alembic/`) and the graph/vector data chain (slugs registered in
+`cognee/modules/migrations/registry.py`). Both run automatically — at API
+server startup and on the first write (`remember`, `add`, `cognify`,
+`improve`, …) in an SDK/CLI process — unless `ENABLE_AUTO_MIGRATIONS=false`.
+So you rarely need these commands; they are for inspecting state, disabled
+auto-migration, and rollbacks. There is no `migrate` command.
 
 ```bash
-cognee-cli upgrade        # apply migrations
-cognee-cli downgrade
-cognee-cli history
-cognee-cli current
+cognee-cli current                    # stamped revision per database (per dataset
+                                      # with access control on)
+cognee-cli history                    # the data-migration chain, newest first
+cognee-cli upgrade                    # relational to head, then data chain to head
+cognee-cli upgrade <slug>             # data chain up to and including <slug>
+cognee-cli upgrade --alembic <rev>    # pin the relational (Alembic) target
+cognee-cli downgrade <slug|base>      # REWRITES DATA; revision is required,
+                                      # prompts unless --force; --dataset <uuid>
+                                      # (repeatable) limits it
+cognee-cli stamp <head|base|slug>     # set the stored revision WITHOUT running
+                                      # anything; prompts unless --force;
+                                      # --dataset <uuid> (repeatable) limits it
 ```
 
-Typically needed after version upgrades when the server refuses to start on
-an old schema.
+The positional revision is always a **data-chain slug**; the relational
+target goes through `--alembic`. `downgrade` leaves the relational schema
+alone unless you pass `--alembic`. `upgrade` runs even when
+`ENABLE_AUTO_MIGRATIONS=false`. `--alembic-path` (or `COGNEE_ALEMBIC_PATH`)
+points at a custom Alembic scripts directory.
 
 ## Gotchas
 
```

**File**: `.agents/skills/cognee-custom-graph-models/SKILL.md` (added, +201/-0)
```diff
@@ -0,0 +1,201 @@
+---
+name: cognee-custom-graph-models
+description: Use when defining the shape of cognee's knowledge graph with graph_model= — writing DataPoint node classes, choosing identity and index fields so nodes merge and are searchable, declaring typed Edge fields and FromIdentity references, building a model from a JSON schema, or debugging duplicated nodes, missing edges, or InvalidReferenceTypeError.
+---
+
+# Custom graph models
+
+By default cognee extracts a generic `KnowledgeGraph` of entities and
+relationships. Pass your own model with `graph_model=` and the LLM fills
+your node and edge types instead.
+
+```python
+from typing import Annotated, Literal
+import cognee
+from cognee.low_level import DataPoint, Edge, FromIdentity
+
+
+class Role(DataPoint):
+    name: str
+    metadata: dict = {"index_fields": ["name"], "identity_fields": ["name"]}
+
+
+class Person(DataPoint):
+    name: str
+    is_a: Annotated[Role, FromIdentity()] | None = None  # reference by name
+    reports_to: list[Edge["Person", "Person"]] = []  # edge owned by Person
+    metadata: dict = {"index_fields": ["name"], "identity_fields": ["name"]}
+
+
+class PeopleGraph(DataPoint):  # the root the LLM fills
+    people: list[Person]
+    friends_with: list[Edge[Person, Person]] = []
+    family: list[Edge[Person, Person, Literal["married_to", "sibling_of"]]] = []
+    metadata: dict = {"index_fields": [], "transparent": True}
+
+
+await cognee.remember(text, graph_model=PeopleGraph, custom_prompt="Extract every person...")
+```
+
+Full example: `examples/guides/custom_graph_model.py`.
+
+## Use it
+
+### Nodes: DataPoint classes
+
+Every node type subclasses `DataPoint` (`from cognee.low_level import
+DataPoint`). Its fields become:
+
+- **Node properties:** scalars, strings, dicts, and anything that is not a
+  DataPoint.
+- **Edges named after the field:** a field holding a DataPoint or a list of
+  DataPoints. `members: list[Person]` becomes `members` edges.
+
+`dict[str, Person]`, sets and plain tuples are stored as properties, not
+edges.
+
+### Identity and search: `metadata`
+
+| Key | What it does |
+|---|---|
+| `identity_fields` | The node id is derived from these field values (normalized: lowercased, spaces to `_`, apostrophes removed). The same entity from two chunks or two runs becomes **one node**. |
+| `index_fields` | Each field gets a vector collection named `<ClassName>_<field>`, so recall can find the node. |
+| `transparent` | The node is not stored; its children take its place. Use it for a root container like `PeopleGraph`. |
+
+**Without `identity_fields` every node gets a random id, so the same person
+is duplicated in every chunk and every run.** Set it on every node type that
+represents a real-world entity.
+
+**Write `metadata` explicitly**, as in the examples above. There is also an
+annotation shortcut (`from cognee.infrastructure.engine import Dedup,
+Embeddable`; `name: Annotated[str, Embeddable(), Dedup()]`), but today only
+half of it works:
+
+- `Dedup()` works: ids are derived from the marked fields.
+- `Embeddable()` does not index. The markers update the class-level
+  default, but each instance still carries `{"index_fields": []}`, and
+  indexing reads the instance, so no vector collection is created and
+  recall cannot find the node.
+
+Markers are also ignored entirely when the class declares `metadata`
+itself.
+
+### Typed edges: `list[Edge[Source, Target, Name]]`
+
+The LLM answers edges as flat rows of identity strings (`source`, `target`),
+and cognee resolves them to the extracted nodes. The third parameter
+controls the relationship name:
+
+| Declaration | Relationship name |
+|---|---|
+| `list[Edge[Person, Person]]` | The field name (`friends_with`) |
+| `list[Edge[Person, Person, Literal["a", "b"]]]` | The LLM picks one value |
+| `list[Edge[Person, Person, str]]` | Free-form from the LLM, normalized |
+
+- **Where to declare:** on the root model for relationships with no obvious
+  owner, or on the owning node. On the owner, endpoints of the owner's own
+  type must be strings (`Edge["Person", "Person"]`), because the class is
+  not defined yet inside its own body.
+- **Always a list:** `Edge[...]` or `Edge[...] | None` on its own raises.
+- **Both endpoint types need exactly one `identity_fields` entry.**
+
+### References: `Annotated[Target, FromIdentity()]`
+
+Instead of a nested object, the LLM answers the identity string of a node
+(`is_a: "engineer"`), and cognee links to that node. Supported spellings:
+`Target`, `Target | None`, `list[Target]`, `list[Target] | None`.
+Anything else raises `InvalidReferenceTypeError`. The target needs exactly
+one identity field, and its other required fields need defaults.
+
+### Edge values you build by hand
+
+`Edge(source=..., target=..., relationship_type=..., weight=...,
+properties={...})`. An omitted `source` falls back to the node declaring the
+field; on a parametrized field that node must be the declared `Sour
```

**File**: `.agents/skills/cognee-custom-pipelines/SKILL.md` (added, +229/-0)
```diff
@@ -0,0 +1,229 @@
+---
+name: cognee-custom-pipelines
+description: Use when building your own cognee processing — writing custom tasks, chaining them into a pipeline with run_custom_pipeline or the lightweight run_pipeline (from cognee.pipelines import run_pipeline), storing custom DataPoints with add_data_points, running custom extraction/enrichment over the existing graph with memify, checking pipeline run status, or debugging how data flows between tasks (batch_size, data_per_batch, ctx, Drop, enriches).
+---
+
+# Custom tasks and pipelines
+
+Everything cognee does runs as a **pipeline**: an ordered list of **tasks**,
+each a plain Python function whose output feeds the next one. `remember()`
+is the right tool for ordinary ingestion. Build a pipeline when you need
+processing cognee does not ship: your own extraction, your own node types,
+or a post-processing step over the graph.
+
+```python
+import cognee
+from cognee.modules.pipelines import Task
+from cognee.tasks.storage import add_data_points
+from cognee.low_level import DataPoint
+
+
+class Person(DataPoint):
+    name: str
+    metadata: dict = {"index_fields": ["name"], "identity_fields": ["name"]}
+
+
+async def extract_people(data_items: list) -> list[Person]:
+    people = []
+    for item in data_items:  # always a list, see below
+        text = item if isinstance(item, str) else ""
+        people += [Person(name=n.strip()) for n in text.split(",") if n.strip()]
+    return people
+
+
+result = await cognee.run_custom_pipeline(
+    tasks=[
+        Task(extract_people, needs_llm=False),
+        Task(add_data_points, needs_llm=False),  # store in graph + vector DBs
+    ],
+    data=["Ada Lovelace, Alan Turing"],
+    dataset="people",
+)
+```
+
+## Use it
+
+### Pick the runner
+
+There are three, and two share the name `run_pipeline`:
+
+| Runner | Import | Use it for |
+|---|---|---|
+| `cognee.run_custom_pipeline(...)` | `cognee` | The normal choice: runs your tasks against a dataset with permissions, a per-dataset lock, run records, and status |
+| Full orchestrator `run_pipeline(tasks=..., data=..., datasets=...)` | `cognee.modules.pipelines` | What `run_custom_pipeline` and `cognify` call; yields `PipelineRunInfo` |
+| Lightweight `run_pipeline([...], data=...)` | `from cognee.pipelines import run_pipeline` (after `import cognee`, the attribute `cognee.pipelines.run_pipeline` is the orchestrator) | Quick chains of `task()` specs with no permissions, locks, run rows, or migrations; returns the last step's outputs |
+
+`cognee.run_custom_pipeline(tasks, data=None, dataset="main_dataset",
+user=None, incremental_loading=False, data_per_batch=20,
+run_in_background=False, pipeline_name="custom_pipeline", data_cache=False,
+...)` returns `{dataset_id: PipelineRunInfo}` (the started run when
+`run_in_background=True`). With `data=None` it runs over the dataset's
+existing documents (`Data` rows).
+
+### Write a task
+
+```python
+from cognee.modules.pipelines import Task
+from cognee.modules.pipelines.models import PipelineContext
+from cognee.modules.pipelines.tasks.task import task_summary
+from cognee.pipelines import Drop
+
+
+@task_summary("Tagged {n} chunk(s)")
+async def tag_chunks(chunks: list, ctx: PipelineContext = None, label: str = "x"):
+    for chunk in chunks:
+        chunk.metadata["label"] = label
+    return chunks  # or yield per item; return/yield Drop to discard
+
+
+tag = Task(tag_chunks, label="reviewed", batch_size=10, needs_llm=False)
+```
+
+- A task is an `async def`, a generator, an async generator, or a plain
+  `def`. Extra `Task(fn, *args, **kwargs)` arguments are passed after the
+  pipeline data.
+- `needs_llm=False` on tasks that never call an LLM lets an LLM-free
+  pipeline skip the LLM connection check.
+- `ctx` (injected by the parameter **name** `ctx`) carries `user`,
+  `data_item`, `dataset`, `pipeline_run_id`, `pipeline_name`, and `extras`.
+- `task.with_config(batch_size=..., **kwargs)` returns a modified copy.
+
+### How data flows
+
+- **Each document runs the whole chain on its own** with `run_custom_pipeline`
+  or the orchestrator, and the first task receives it as a **one-element
+  list** (`[data_item]`), not the bare item. The lightweight `run_pipeline`
+  passes `data` to the first task unchanged.
+- **`data_per_batch`** (default 20) is how many documents run at the same
+  time. It is a concurrency limit, not a batch size.
+- **`batch_size` belongs to the consumer.** A task's `batch_size` decides how
+  the *previous* task's generator output is grouped before it is passed in.
+  Generator tasks always hand over lists; a coroutine or function hands over
+  its single return value.
+- **Streaming:** each upstream result goes down the chain immediately, so a
+  downstream task can run many times per document.
+- **`enriches=True`:** if the task returns `None`, its input is passed on
+  unchanged (coroutines and functions only, not generators).
+- **`Drop`:** returning or yielding it
```

**File**: `.agents/skills/cognee-forget/SKILL.md` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+---
+name: cognee-forget
+description: Use when removing data from cognee memory with forget() in the SDK, HTTP API, or CLI — finding which dataset and document hold the content to delete (listing datasets and data items, reading raw content), choosing between deleting one document, a whole dataset, or only the graph/vector memory, and doing it safely.
+---
+
+# Remove data with forget()
+
+`forget()` is cognee's one deletion API. It removes one document, a whole
+dataset, or only the derived memory (graph + vectors) while keeping the raw
+files. Deletion cannot be undone, so the workflow is always **find, read,
+confirm, then delete**.
+
+> **Hard limits for agents**
+> - Delete only what the user asked to forget. Identify it by reading the
+>   content first; never guess from a file name alone.
+> - Confirm the exact items with the user before deleting, unless they
+>   already named exact ids.
+> - The widest deletion you may run is `forget(everything=True)`, and only
+>   when the user explicitly asks to wipe all of their memory. Never use any
+>   other reset or wipe mechanism to delete data.
+
+## Use it
+
+### 1. Find the dataset
+
+```python
+import cognee
+
+datasets = await cognee.datasets.list_datasets()  # datasets the user can read
+for ds in datasets:
+    print(ds.id, ds.name)
+```
+
+HTTP: `GET /api/v1/datasets`. CLI: `cognee-cli datasets list`.
+
+### 2. List its documents
+
+```python
+items = await cognee.datasets.list_data(dataset_id)  # all Data rows, oldest first
+for item in items:
+    print(item.id, item.name, item.extension, item.created_at)
+```
+
+HTTP: `GET /api/v1/datasets/{dataset_id}/data?limit=100&offset=0` (limit up
+to 1000; `GET .../data/count` for the total; example:
+`examples/python/dataset_data_pagination.py`). CLI:
+`cognee-cli datasets data <dataset_uuid>`.
+
+Each item has `id`, `name`, `created_at`, `extension`, `mime_type`,
+`raw_data_location`, `dataset_id`, `label`, `external_metadata` (including
+any `node_set`), and `data_size`.
+
+### 3. Read the content before deciding
+
+Names are often `text_<hash>.txt`, so read the content to find what the user
+means.
+
+- HTTP: `GET /api/v1/datasets/{dataset_id}/data/{data_id}/raw` returns the
+  stored file (404 if it is gone).
+- SDK: there is no "get raw" helper; open the stored location:
+
+```python
+from cognee.infrastructure.files.utils.open_data_file import open_data_file
+
+async with open_data_file(item.raw_data_location, mode="rb") as f:
+    preview = f.read(2000).decode("utf-8", errors="replace")
+```
+
+Judge matches by meaning, not only by keywords, and show the user the
+candidates (name + a short preview) before deleting.
+
+### 4. Delete
+
+| Goal | Call | What remains |
+|---|---|---|
+| One document | `forget(data_id=..., dataset_id=...)` (or `dataset="name"`) | Nothing of that document; shared entities stay while another document still references them |
+| A whole dataset | `forget(dataset="name")` or `forget(dataset_id=...)` | The dataset is deleted outright: the record, its data rows, graph and vector stores, and attributed sessions |
+| Rebuild a dataset's graph later | `forget(dataset="name", memory_only=True)` | Raw files and data rows; graph, vectors, sessions and pipeline status are reset, so the data can be re-processed |
+| One document's memory only | `forget(dataset="name", data_id=..., memory_only=True)` | That document's raw file and row |
+| Every dataset the user can delete | `forget(everything=True)` | Nothing, in any dataset the user has `delete` on in the current tenant (shared ones included). Only on explicit request (see the hard limits) |
+
+Return values: `{"data_id", "dataset_id", "status"}` for a document,
+`{"dataset_id", "status"}` for a dataset (plus `data_records_reset` with
+`memory_only`), `{"datasets_removed", "status"}` for everything
+(`datasets_removed` counts the datasets the user can *read*, not the delete
+set).
+
+**HTTP:** `POST /api/v1/forget` with a JSON body; camelCase and snake_case
+keys both work: `{"datasetId": "...", "dataId": "..."}`,
+`{"dataset": "name", "memoryOnly": true}`, `{"everything": true}`. Invalid
+combinations return 422.
+
+**CLI:** `cognee-cli forget --dataset NAME | --dataset-id UUID
+[--data-id UUID] [--memory-only]`, or `--everything` / `--all`. The CLI
+**does not ask for confirmation**; confirm with the user first.
+
+## Pitfalls
+
+- **A `data_id` that is not in the dataset returns success and deletes
+  nothing.** The delete path treats an unknown id as a custom-graph-model
+  delete. Always take the id from `list_data` for that same dataset, and
+  check it is still listed afterwards if it matters.
+- **Pass either `dataset` or `dataset_id`, not both** (`ValueError`).
+  `data_id` and `memory_only` both need a dataset.
+- **`memory_only` is ignored when `everything=True`** in the SDK (the CLI
+  rejects the combination). `everything=True` always deletes everything.
+- **Not found and not allowed look the same.
```

**File**: `.agents/skills/cognee-improve-sessions/SKILL.md` (added, +222/-0)
```diff
@@ -0,0 +1,222 @@
+---
+name: cognee-improve-sessions
+description: Use when working with cognee's session memory or improve() — storing conversation turns, agent traces and feedback with session_id, bridging sessions into the permanent graph, reading an ImproveResult, understanding why an improve stage was skipped, already_completed or lock_held, or tuning the IMPROVE_* settings.
+---
+
+# Session memory and improve()
+
+cognee has two kinds of memory:
+
+- **Session memory**: a fast cache of conversation turns, agent traces, and
+  feedback, keyed by `session_id`. Writing is instant, with no LLM
+  extraction.
+- **The permanent graph**: what `remember()` builds without a session.
+
+`improve()` connects them. It bridges session content into the graph and
+enriches the graph itself. `remember()` calls it automatically, so most
+users never call it directly.
+
+```python
+import cognee
+
+# Session write: returns immediately; improve() bridges it in the background
+await cognee.remember("User prefers dark mode.", session_id="chat_1")
+
+# Session-aware query: session cache first, then the graph
+results = await cognee.recall("What does the user prefer?", session_id="chat_1")
+
+# Bridge sessions into a dataset's graph explicitly
+result = await cognee.improve(dataset="main_dataset", session_ids=["chat_1"])
+print(result.status, result.stage_summary())
+
+await cognee.wait_for_background_tasks()  # before a script exits
+```
+
+## Use it
+
+### Writing session memory
+
+| What | How |
+|---|---|
+| A fact or note | `remember(text, session_id=...)` (stored as a Q&A entry with the text as the answer) |
+| A Q&A turn | `recall(query, session_id=...)` with a completion search type saves the turn itself; or `remember(cognee.QAEntry(question=..., answer=...), session_id=...)` |
+| An agent step | `remember(cognee.TraceEntry(origin_function=..., status="success", ...), session_id=...)`, or the `@cognee.agent_memory(save_session_traces=True)` decorator |
+| Feedback on an answer | `remember(cognee.FeedbackEntry(qa_id=..., feedback_score=...), session_id=...)` or `cognee.session.add_feedback(session_id, qa_id, feedback_text=..., feedback_score=...)` |
+| Read a session | `cognee.session.get_session(session_id, last_n=...)` |
+
+Requirements: `CACHING=true` (default). The cache backend is
+`CACHE_BACKEND`, one of `sqlite` (default), `postgres`, `redis`, `fs`,
+`tapes`. Sessions expire after `SESSION_TTL_SECONDS` (default 7 days).
+
+### What improve() does: nine stages, in order
+
+Every run goes through the same ordered stages
+(`cognee/modules/improve/registry.py`). Each stage checks a gate before it
+spends any LLM or embedding cost, and reports one `StageResult`.
+
+| # | Stage | What it does | Runs when |
+|---|---|---|---|
+| 1 | `feedback_weights` | Adjusts the weight of graph elements that rated answers used | `session_ids` given; adapter supports feedback weights |
+| 2 | `persist_session_qa` | Turns session Q&A into graph content (node set `user_sessions_from_cache`) | `session_ids` given. **The only fatal stage** |
+| 3 | `persist_agent_traces` | Turns agent-trace feedback into graph content | `session_ids` given |
+| 4 | `extract_agent_context` | Drafts agent-profile lessons from traces | `session_ids`, `CACHING` + `AUTO_FEEDBACK`, an LLM |
+| 5 | `distill_sessions` | Distills session learnings into the graph | `session_ids`, an LLM |
+| 6 | `update_user_preferences` | Folds rated turns into per-user preferences | `session_ids`, `PERSONALIZATION_ENABLED=true` (default false) |
+| 7 | `build_truth_subspace` | Builds the truth subspace from distilled learnings | `session_ids`, `build_truth_subspace=True`, a Ladybug graph |
+| 8 | `triplet_enrichment` | Triplet embeddings over the graph (memify) | `TRIPLET_EMBEDDING=true` (**default false**), or custom tasks/data passed |
+| 9 | `global_context_index` | Bucket and root summaries for global questions | `build_global_context_index=True`, an LLM |
+
+Stages 1–7 need `session_ids`; 8 and 9 work on the graph alone. The order
+matters: 4 feeds 5, 5 feeds 7, and 7 runs before 8.
+
+### Reading the result
+
+`improve()` returns an `ImproveResult`, and so do `POST /api/v1/improve`, the
+CLI, and `RememberResult.improve`.
+
+- `result.status`: `completed`, `errored` (any stage errored), `skipped`
+  (every stage skipped), or `running` (background, not finished).
+- `result.stages`: one `StageResult` per stage, with `stage`, `status`
+  (`completed` / `already_completed` / `skipped` / `errored`), `reason`,
+  `error`, `counts`, `duration_ms`.
+- `result.stage("distill_sessions")`, `result.stage_summary()`,
+  `result.lock_held`, `result.rerun_requested`, `result.rerun_passes`.
+- `await result.wait()` finishes a background run (no-op otherwise).
+
+**Skip and no-op reasons:**
+
+| Reason | Meaning / fix |
+|---|---|
+| `no_session_ids` | Session stage, no `session_ids` passed |
+| `disabled_by_config` | Listed in `IMPROVE_STAGES_DISABLED` |
+| `triplet_embedding_disabl
```

**File**: `.agents/skills/cognee-ingestion/SKILL.md` (added, +210/-0)
```diff
@@ -0,0 +1,210 @@
+---
+name: cognee-ingestion
+description: Use when putting data into cognee memory with remember() — choosing inputs (text, files, folders, URLs, repos, databases), datasets and node_sets, loaders, ontologies, the graph extractor (LLM or GLiNER), chunking, dry-run cost estimates, temporal graphs, or when remember() raises on a keyword argument.
+---
+
+# Ingest data with remember()
+
+`remember()` is cognee's ingestion API. One call stores the data, builds the
+knowledge graph, and enriches it. Use it for all ingestion; every option in
+this skill is a `remember()` argument unless it says otherwise.
+
+```python
+import cognee
+
+result = await cognee.remember("Einstein was born in Ulm.")  # text
+result = await cognee.remember(
+    ["./notes.md", "./report.pdf"],  # files
+    dataset_name="research",
+)
+print(result.status, result.dataset_id)  # "completed", UUID
+```
+
+All cognee functions are async. Without `dataset_name` data goes to
+`main_dataset`. Needs `LLM_API_KEY` unless you use the GLiNER extractor
+(below).
+
+## Use it
+
+### Inputs
+
+`data` accepts a string, a list of strings, file paths (absolute, `file://`,
+`s3://`), http(s) URLs, binary streams, or a list mixing them.
+
+- **URLs** are fetched and scraped (needs `ALLOW_HTTP_REQUESTS=true`, the
+  default).
+- **Folders** are ingested file by file. A folder that looks like a code
+  project, or a GitHub/GitLab URL, becomes one code repository (needs `git`
+  on PATH).
+- **Code files** (`.py`, `.ts`, `.go`, …) go down the code-graph route: a
+  deterministic graph, no LLM calls, searchable only with
+  `SearchType.CODE`. To index a whole repository explicitly, pass
+  `content_type="code"`.
+- **Databases and dlt sources**: a SQL connection string, a dlt
+  `DltResource` / `DltSource`, or a CSV. dlt is a core dependency, so no
+  extra is needed (`cognee[dlt]` is an empty compatibility extra). Options: `primary_key` (default `"id"`),
+  `write_disposition` (`"replace"` default, or `"append"`), `query`,
+  `max_rows_per_table`.
+- **Skill playbooks** (`SKILL.md` files): `content_type="skills"`; ingests
+  into the target dataset (default `main_dataset`), so pass `dataset_name`
+  to keep skills in their own dataset.
+
+### Where the data goes
+
+| Argument | What it does |
+|---|---|
+| `dataset_name` / `dataset_id` | Target dataset. `dataset_id` wins. A dataset is the unit of permissions and isolation. |
+| `node_set=["AI", "FinTech"]` | Tags the data so recall can filter to it later with `recall(..., node_name=["AI"])`. |
+| `session_id="chat_1"` | Writes to the fast session cache instead of the graph; `improve()` bridges it into the graph in the background. See the `cognee-improve-sessions` skill. Requires `CACHING=true`. |
+
+### How the graph is built
+
+| Argument | What it does |
+|---|---|
+| `extractor` | `"llm"` or `"gliner_demo"` (alias `"gliner"`). Default is `GRAPH_EXTRACTOR=auto`: the LLM when an API key is configured, otherwise GLiNER. |
+| `graph_model=MyModel` | Extract into your own DataPoint model instead of the generic `KnowledgeGraph`. See the `cognee-custom-graph-models` skill. |
+| `custom_prompt` | Replaces the entity-extraction prompt (ignored by GLiNER). |
+| `config={"ontology_config": {...}}` | Ground entities in an OWL ontology (below). |
+| `temporal_cognify=True` | Builds an event/timestamp graph for `SearchType.TEMPORAL`. |
+| `chunk_size`, `chunker` | Max tokens per chunk (default: derived from the embedding and LLM limits) and the chunker class (default `TextChunker`). |
+| `preferred_loaders` | Choose a loader per file type (below). |
+| `self_improvement` | Default `True`: runs `improve()` after the graph is built. Its outcome is on `result.improve` / `result.improve_error`; a failed improve never fails the remember. |
+| `run_in_background=True` | Returns immediately with `status="running"`; `await result` to wait. |
+
+### Ontologies
+
+```python
+from cognee.modules.ontology.rdf_xml.RDFLibOntologyResolver import RDFLibOntologyResolver
+
+config = {
+    "ontology_config": {
+        "ontology_resolver": RDFLibOntologyResolver(ontology_file="./my.owl"),
+        # "ontology_mode": "strict",   # drop entities with no ontology match
+    }
+}
+await cognee.remember(texts, config=config)
+```
+
+Or set `ONTOLOGY_FILE_PATH` (plus `ONTOLOGY_MODE`, `MATCHING_STRATEGY`) in
+`.env`. `annotate` (default) only enriches; `strict` drops entities that
+match no ontology class or individual. It prunes only the graph, chunk text
+is still stored. Strict mode with an empty or missing ontology file is a hard
+error. Over HTTP, upload the ontology to `/api/v1/ontologies` and pass its
+`ontology_key` to `POST /api/v1/remember`. Example:
+`examples/guides/ontology_quickstart.py`.
+
+### Loaders
+
+Each file is claimed by the first loader that accepts it. Default order:
+code, text, pypdf, image, audio, video, dlt_csv, csv, unstructured,
+advanced_pdf, docling. Names: `text_loader`, `code_loader`, `cs
```

**File**: `.agents/skills/cognee-install/SKILL.md` (renamed, +1/-1)
```diff
@@ -82,7 +82,7 @@ The `add()` / `cognify()` / `search()` / `memify()` primitives still exist and
 are what `remember`/`recall`/`improve` call underneath — reach for them when you
 need to drive a stage in isolation (e.g. custom pipeline tasks), not for
 ordinary ingestion. `cognee.delete` is formally deprecated (since 0.3.9);
-`forget()` is the v1 replacement, unifying the old delete/prune/empty_dataset
+`forget()` is the v1 replacement, unifying the old delete/empty_dataset
 paths behind one call. When to use `recall()` versus the low-level `search()`
 is covered in `docs/recall-vs-search.md`.
 
```

**File**: `.agents/skills/cognee-migrations/SKILL.md` (added, +200/-0)
```diff
@@ -0,0 +1,200 @@
+---
+name: cognee-migrations
+description: Use when dealing with cognee database migrations — understanding when they run automatically, checking or repairing migration state with cognee-cli upgrade/downgrade/stamp/current, a write blocked by a failed migration, authoring a new Alembic (relational schema) revision or a graph/vector data migration, or moving data between systems (relational DB import, memory export/import).
+---
+
+# Database migrations
+
+cognee has **two migration chains**, run together:
+
+| Chain | Changes | Lives in | Revision stored in |
+|---|---|---|---|
+| **Relational schema** (Alembic) | Tables and columns of the relational DB (users, datasets, ACLs, pipeline runs, …) | `cognee/alembic/` (`alembic.ini` is in `cognee/`) | `alembic_version` table |
+| **Graph/vector data** | Cross-store data rewrites (re-keying node ids, adding graph columns) across graph DB, vector DB and relational ledger | `cognee/modules/migrations/` (`registry.py`, `versions/`) | Per dataset: `dataset_database.migration_revision` (access control on). Globally: `global_database_version.global_migration_revision` (access control off) |
+
+## Use it
+
+### They run by themselves
+
+`run_migrations()` applies the relational chain first, then the data chain.
+It runs:
+
+- at API server startup (and in the Docker `entrypoint.sh` before gunicorn);
+- on the first write in an SDK or CLI process (`remember`, `add`, `cognify`,
+  `improve`, `memify`, memory imports), once per process;
+- when you call `await cognee.run_migrations()`.
+
+A fresh database is built by running the whole chain (no stamping). At
+head, the first run in each process still does a no-op Alembic upgrade plus
+a scan of the per-database revision rows; later calls in the same process
+are skipped by an in-memory flag. `ENABLE_AUTO_MIGRATIONS=false`
+turns off all automatic runs; then run `cognee-cli upgrade` yourself.
+
+Concurrent processes are serialized by a migration lock: a Postgres advisory
+lock (works across hosts) or a file lock next to the SQLite DB (one host
+only).
+
+### Check and repair
+
+```bash
+cognee-cli current                   # stamped revision per database, and the last failure
+cognee-cli history                   # the data chain, newest first
+cognee-cli upgrade                   # relational to head, then data chain to head
+cognee-cli upgrade <slug>            # data chain up to and including <slug>
+cognee-cli upgrade --alembic <rev>   # pin the relational target
+cognee-cli downgrade <slug|base> [--dataset UUID ...] [--alembic REV] [--force]
+cognee-cli stamp <head|base|slug> [--dataset UUID ...] [--force]
+```
+
+- The positional revision is always a **data-chain slug**; relational
+  targets go through `--alembic`.
+- `downgrade` rewrites data and asks for confirmation. It only reverts
+  spans where every migration defines a `down()`, and leaves the relational
+  schema alone unless you pass `--alembic`.
+- `stamp` changes only the stored data-chain revision, without running
+  anything. Use `stamp base --dataset <id>` and then `upgrade` when a
+  database's data drifted from its stamp (for example after restoring a
+  backup); the chain is idempotent and converges it.
+- `upgrade` runs even with `ENABLE_AUTO_MIGRATIONS=false`.
+
+### A write is blocked
+
+If a dataset's data migration failed, writes to that dataset are refused
+until it succeeds (with access control off, any failure blocks all writes).
+The server still starts. Run `cognee-cli current` to see the error, fix the
+cause, then `cognee-cli upgrade`. A failed run is retried on the next start
+or write.
+
+### Moving data between systems (not schema migrations)
+
+| Goal | Use |
+|---|---|
+| Turn an existing relational database into a graph | `migrate_relational_database(graph_db, schema)` (`cognee/tasks/ingestion/migrate_relational_database.py`), with the source DB set by `MIGRATION_DB_PROVIDER` / `_PATH` / `_NAME` / `_HOST` / `_PORT` / `_USERNAME` / `_PASSWORD`. Examples: `examples/demos/ingestion_and_migration/` |
+| Back up a dataset, or move it to another cognee instance | A COGX archive, see below |
+| Export a dataset's graph for other tools | `await cognee.export(dataset, format=...)`: `"json"`, `"graphml"` or `"cypher"` write a file (one way: cognee can't import them back); `"pydantic"` (default) returns typed DataPoint objects in memory |
+| Import from another memory system (Mem0, Zep/Graphiti, Letta, LangMem) | Build a `MemorySource` (`cognee/modules/migration/sources/`) and pass it to `await cognee.remember(source, dataset_name=...)` |
+
+There is no tool that moves a whole deployment from one database backend to
+another.
+
+#### COGX archives
+
+COGX (Cognee eXchange, `cognee/modules/migration/cogx.py`) is cognee's
+portable memory format and the only export format cognee can import back.
+An archive is a directory with a `manifest.json` (COGX version, source
+system, the dataset's data-migration revision) and one JSON
```

---

### Incident Patch 13: `0a28a99c` (2026-09-29)
**Commit Message**: fix(embed): Show real causes in errors (#5280)

<!-- .github/pull_request_template.md -->

## Description
<!--
Please provide a clear, human-generated description of the changes in
this PR.
DO NOT use AI-generated descriptions. We want to understand your thought
process and reasoning.
-->
Follow-up to #5255 for SDK-810. #5255 stopped the retry loop on terminal
embedding errors and put the provider's error into the
`EmbeddingException`
message. It also re-raises litellm's `NotFoundError` unwrapped. This PR
fixes
what is left of the "fake 422" symptom, plus the part of SDK-810 that
was in
#5258, which was closed without merging.

It replaces what #5243 still had to offer. The rest of #5243 is either
already
on `dev` via #5255 or conflicts with it.

## Problem

1. **The error log line leaves out the cause.** `CogneeApiError` logs a
line
   every time a cognee error is raised, and it said only
`EmbeddingException raised (Status code: 422)`. The 422 is a hardcoded
default on `EmbeddingException`, not a provider response, but that line
is
   what users read as one.
2. **No Fix: hint for the two most common setup mistakes.** A mis-typed
model
   (`litellm.NotFoundError`, now unwrapped by 

**File**: `cognee/exceptions/exceptions.py` (modified, +12/-4)
```diff
@@ -41,13 +41,21 @@ def __init__(
 
         # Automatically log the exception details
         if log and (log_level == "ERROR"):
-            logger.error("%s raised (Status code: %s)", self.name, self.status_code)
+            logger.error(
+                "%s raised (Status code: %s): %s", self.name, self.status_code, self.message
+            )
         elif log and (log_level == "WARNING"):
-            logger.warning("%s raised (Status code: %s)", self.name, self.status_code)
+            logger.warning(
+                "%s raised (Status code: %s): %s", self.name, self.status_code, self.message
+            )
         elif log and (log_level == "INFO"):
-            logger.info("%s raised (Status code: %s)", self.name, self.status_code)
+            logger.info(
+                "%s raised (Status code: %s): %s", self.name, self.status_code, self.message
+            )
         elif log and (log_level == "DEBUG"):
-            logger.debug("%s raised (Status code: %s)", self.name, self.status_code)
+            logger.debug(
+                "%s raised (Status code: %s): %s", self.name, self.status_code, self.message
+            )
 
         super().__init__(self.message, self.name)
 
```

**File**: `cognee/exceptions/remediation.py` (modified, +19/-0)
```diff
@@ -20,6 +20,10 @@
 4. **Unreachable custom endpoint** — user pointed ``EMBEDDING_ENDPOINT`` or
    ``LLM_ENDPOINT`` at a URL that resolves but does not respond.
 5. **Wrong ontology path** — ``--ontology-file`` argument does not exist.
+6. **Unknown model** — a mis-typed ``EMBEDDING_MODEL`` / ``LLM_MODEL`` the
+   provider does not serve (404).
+7. **Missing ``transformers``** — a HuggingFace tokenizer or engine without
+   the ``cognee[huggingface]`` extra installed.
 
 Each of these otherwise triggers a raw stack trace from deep in the pipeline.
 This module lifts a short, prescriptive hint next to the error so the user
@@ -88,6 +92,21 @@
             "Unset EMBEDDING_ENDPOINT to fall back to the provider default."
         ),
     ),
+    (
+        # Real error: litellm.NotFoundError, re-raised unwrapped by the embedding
+        # engine ("litellm.NotFoundError: The model `x` does not exist"). Kept to
+        # litellm's spelling so cognee's own *NotFoundError classes never match.
+        ("litellm.notfounderror", "model_not_found"),
+        (
+            "The provider does not serve the configured model. Check the spelling "
+            "of EMBEDDING_MODEL (or LLM_MODEL) and that the model is available on "
+            "the configured provider and endpoint."
+        ),
+    ),
+    (
+        ("no module named 'transformers'",),
+        ('transformers is not installed. Install it with: pip install "cognee[huggingface]"'),
+    ),
     (
         ("ontology file not found",),
         (
```

**File**: `cognee/infrastructure/llm/tokenizer/resolver.py` (modified, +6/-1)
```diff
@@ -42,6 +42,10 @@
     "that does not match the embedding model will mis-size chunks. Set "
     "HUGGINGFACE_TOKENIZER to a tokenizer matching your embedding model to fix this."
 )
+# HUGGINGFACE_TOKENIZER cannot help when the library that loads it is missing.
+_TRANSFORMERS_HINT = (
+    'transformers is not installed. Install it with: pip install "cognee[huggingface]"'
+)
 
 
 def _bare_model(model: str | None) -> str | None:
@@ -103,12 +107,13 @@ def _load_or_tiktoken_fallback(
     try:
         return build()
     except Exception as error:
+        missing = isinstance(error, ImportError) and (error.name or "").startswith("transformers")
         logger.warning(
             "Could not load a matching tokenizer for %s (%s). Falling back to "
             "TikToken, so token counts are approximate. %s",
             context,
             error,
-            _MISMATCH_HINT,
+            _TRANSFORMERS_HINT if missing else _MISMATCH_HINT,
             exc_info=True,
         )
         return TikTokenTokenizer(model=None, max_completion_tokens=max_completion_tokens)
```

**File**: `cognee/tests/unit/exceptions/test_remediation_field.py` (modified, +27/-0)
```diff
@@ -109,3 +109,30 @@ async def test_rest_handler_adds_remediation_key_only_when_known():
 
     without = await exception_handler(None, CogneeApiError("plain", "Plain"))
     assert set(json.loads(without.body)) == {"detail"}
+
+
+@pytest.mark.parametrize(
+    "message,anchor",
+    [
+        (
+            "litellm.NotFoundError: The model `text-embeding-3-small` does not exist",
+            "EMBEDDING_MODEL",
+        ),
+        ("No module named 'transformers'", "cognee[huggingface]"),
+    ],
+)
+def test_embedding_misconfiguration_rows(message, anchor):
+    assert anchor in find_remediation(message)
+
+
+def test_cognee_not_found_errors_do_not_match_the_model_row():
+    hint = find_remediation("EntityNotFoundError: Entity not found. (Status code: 404)")
+    assert hint is None or "EMBEDDING_MODEL" not in hint
+
+
+def test_auto_log_line_includes_the_message(caplog):
+    import logging
+
+    with caplog.at_level(logging.ERROR):
+        CogneeApiError("the real cause", "Boom", status_code=422)
+    assert any("the real cause" in r.getMessage() for r in caplog.records)
```

**File**: `cognee/tests/unit/infrastructure/llm/test_tokenizer_resolver.py` (modified, +19/-0)
```diff
@@ -179,6 +179,25 @@ def test_mistral_missing_dependency_falls_back_without_raising(caplog):
     assert any("Falling back" in r.message for r in caplog.records)
 
 
+def test_missing_transformers_names_the_extra(caplog):
+    # Without transformers, HUGGINGFACE_TOKENIZER cannot help; the warning must
+    # name the extra to install instead.
+    tik = patch(
+        f"{_MODULE}.TikTokenTokenizer", side_effect=lambda **kw: _FakeTokenizer("tiktoken", **kw)
+    )
+    hf = patch(
+        f"{_MODULE}.HuggingFaceTokenizer",
+        side_effect=ModuleNotFoundError("No module named 'transformers'", name="transformers"),
+    )
+    mis = patch(f"{_MODULE}.MistralTokenizer")
+    with caplog.at_level(logging.WARNING), tik, hf, mis:
+        tok = resolve_embedding_tokenizer(provider="openai_compatible", model="BAAI/bge-m3")
+    assert tok.kind == "tiktoken"
+    messages = [r.getMessage() for r in caplog.records]
+    assert any("cognee[huggingface]" in m for m in messages)
+    assert not any("Set HUGGINGFACE_TOKENIZER" in m for m in messages)
+
+
 def test_bare_model_strips_one_provider_tag():
     assert resolver._bare_model("openai/text-embedding-3-large") == "text-embedding-3-large"
     # Splits once, so a multi-segment repo after the provider tag survives.
```

---

### Incident Patch 14: `06235d8e` (2026-09-29)
**Commit Message**: Merge branch 'dev' into fix/pgvector-shared-prune-safety

**File**: `.env.template` (modified, +3/-3)
```diff
@@ -107,7 +107,7 @@ STRUCTURED_OUTPUT_FRAMEWORK="litellm_native"
 
 #EMBEDDING_ENDPOINT=""   # EMBEDDING_API_BASE is accepted as an alias
 #EMBEDDING_API_VERSION=""
-#EMBEDDING_MAX_COMPLETION_TOKENS=8191
+#EMBEDDING_MAX_COMPLETION_TOKENS=4096   # chunk-token cap; lowered automatically to the embedding model's own input limit
 #EMBEDDING_BATCH_SIZE=36
 # If not provided, LLM_API_KEY is used for embeddings too.
 #EMBEDDING_API_KEY="your_api_key"
@@ -999,7 +999,7 @@ WEB_SCRAPER_MAX_DELAY=10.0
 #EMBEDDING_API_KEY="your-azure-api-key"
 #EMBEDDING_API_VERSION="2024-12-01-preview"
 #EMBEDDING_DIMENSIONS=3072
-#EMBEDDING_MAX_COMPLETION_TOKENS=8191
+#EMBEDDING_MAX_COMPLETION_TOKENS=4096   # chunk-token cap; lowered automatically to the embedding model's own input limit
 
 ########## Local LLM via Ollama ###############################################
 # LLM_ENDPOINT is the Ollama host without a path. The default framework
@@ -1055,7 +1055,7 @@ WEB_SCRAPER_MAX_DELAY=10.0
 #EMBEDDING_ENDPOINT=""
 #EMBEDDING_API_VERSION=""
 #EMBEDDING_DIMENSIONS=3072
-#EMBEDDING_MAX_COMPLETION_TOKENS=8191
+#EMBEDDING_MAX_COMPLETION_TOKENS=4096   # chunk-token cap; lowered automatically to the embedding model's own input limit
 
 ########## MCP sampling (reuse the host harness LLM, no API key) ##############
 # Only for running cognee AS an MCP server (cognee-mcp) inside a host that
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -317,7 +317,7 @@ Support for PDF, DOCX, CSV, images, audio, code files in `cognee/infrastructure/
 ## Important Configuration
 
 ### Environment Setup
-Copy `.env.template` to `.env` and configure:
+Copy `.env.template` to `.env` and configure. Cognee finds the file once per process, at import, searching the working directory and its parents first, then the cognee package directory and its parents (`cognee/shared/env_file.py`). Each search stops at the project root, the nearest directory with a `.git` or `pyproject.toml`, so a `.env` above a project is never loaded; with no such marker (a plain folder of scripts) it continues up to the filesystem root. `COGNEE_ENV_FILE=/path/to/file` skips the search and loads that file (a path that is not a file raises at import). Values from the file take precedence over variables already set in the shell, for settings classes and `os.getenv` reads alike, so a project `.env` is the single source of truth wherever the environment happens to be installed. The path that was loaded (or "No .env file found") is logged at info on import.
 
 ```bash
 # Minimal setup (defaults to OpenAI + local file-based databases)
```

**File**: `cognee-mcp/pyproject.toml` (modified, +3/-1)
```diff
@@ -92,7 +92,9 @@ exclude-newer = "2 days"
 # third-party packages; applying it to our own package meant a release-day
 # `uv lock` silently resolved cognee to the *previous* release, which is how
 # the lock drifted to 1.2.2 while the image was tagged 1.4.1 (issue #4360).
-exclude-newer-package = { cognee = "0 days" }
+# enola-cli is exempt for the same reason as in the root pyproject.toml: cognee
+# pins an exact, validated release, often one published the same day.
+exclude-newer-package = { cognee = "0 days", enola-cli = "0 days" }
 
 [project.scripts]
 cognee = "src:main"
```

**File**: `cognee/__init__.py` (modified, +6/-3)
```diff
@@ -21,15 +21,18 @@
 #       there will be circular import issues
 __version__ = get_cognee_version()
 
-# Load environment variable settings has to be before setting up logging for LOG_LEVEL value
-import dotenv
+# The .env must be loaded before logging is configured, because LOG_LEVEL comes
+# from it. One resolver for the whole process — see cognee.shared.env_file for
+# the search order (working directory first, then the package's own tree).
+from cognee.shared.env_file import load_env_file, describe_resolution
 
-dotenv.load_dotenv(override=True)
+_env_file = load_env_file()
 
 # NOTE: Log level can be set with the LOG_LEVEL env variable
 from cognee.shared.logging_utils import setup_logging
 
 logger = setup_logging()
+logger.info(describe_resolution(_env_file))
 
 # ---------------------------------------------------------------------------
 # V1 API
```

**File**: `cognee/api/v1/cognify/cognify.py` (modified, +7/-6)
```diff
@@ -7,7 +7,7 @@
 
 from cognee.infrastructure.databases.vector.embeddings.config import EmbeddingConfig
 from cognee.infrastructure.engine import DataPoint
-from cognee.infrastructure.llm import get_max_chunk_tokens
+from cognee.infrastructure.llm import resolve_chunk_size
 from cognee.infrastructure.llm.config import LLMConfig
 from cognee.modules.chunking.TextChunker import TextChunker
 from cognee.modules.cognify.config import (
@@ -186,7 +186,8 @@ async def cognify(
         ontology_file_path: Optional path, or comma-separated paths, to the ontology
                     used for both extraction schema planning and graph integration.
         chunk_size: Maximum tokens per chunk. Auto-calculated based on LLM if None.
-                   Formula: min(embedding_max_completion_tokens, llm_max_completion_tokens // 2)
+                   Formula: min(embedding token limit, llm_max_completion_tokens // 2). A value
+                   above what the embedding model accepts is lowered to that limit with a warning.
                    Default limits: ~512-8192 tokens depending on models.
                    Smaller chunks = more granular but potentially fragmented knowledge.
         chunks_per_batch: Number of chunks to be processed in a single batch in Cognify tasks.
@@ -419,7 +420,7 @@ class ScientificPaper(DataPoint):
                 user=user,
                 graph_model=graph_model,
                 chunker=chunker,
-                chunk_size=chunk_size or await get_max_chunk_tokens(),
+                chunk_size=await resolve_chunk_size(chunk_size),
                 custom_prompt=custom_prompt,
             )
 
@@ -583,7 +584,7 @@ async def get_default_tasks(  # TODO: Find out a better way to do this (Boris's
             cognify_config.chunks_per_batch if cognify_config.chunks_per_batch is not None else 2000
         )
 
-    max_chunk_size = chunk_size or await get_max_chunk_tokens()
+    max_chunk_size = await resolve_chunk_size(chunk_size)
     tasks = [
         # needs_llm=False marks the tasks that never call the LLM; the run's
         # need is the union over the tasks, so the LLM connection probe runs
@@ -673,7 +674,7 @@ async def get_dlt_tasks(
         # EXTRACT: one DocumentChunk per manifest row (no text chunking)
         Task(
             extract_chunks_from_documents,
-            max_chunk_size=chunk_size or await get_max_chunk_tokens(),
+            max_chunk_size=await resolve_chunk_size(chunk_size),
             chunker=TextChunker,
             needs_llm=False,
         ),
@@ -726,7 +727,7 @@ async def get_temporal_tasks(
         # EXTRACT: split Documents into semantic text chunks
         Task(
             extract_chunks_from_documents,
-            max_chunk_size=chunk_size or await get_max_chunk_tokens(),
+            max_chunk_size=await resolve_chunk_size(chunk_size),
             chunker=chunker,
         ),
         # COGNIFY: extract temporal events and timestamps from chunks
```

**File**: `cognee/api/v1/config/config.py` (modified, +11/-8)
```diff
@@ -91,17 +91,20 @@ def _mask_secret(value: str) -> str:
 
 
 def _persist_env_var(env_var_name: str, value) -> tuple[str, bool]:
-    """Write ``env_var_name=value`` into the ``.env`` file in the current
-    working directory, creating it if it doesn't exist yet.
-
-    This is the same file every config class resolves via
-    ``SettingsConfigDict(env_file=".env")``, so a value persisted here is
-    picked up by the next process (CLI invocation or script) started from
-    the same directory. Returns ``(path, created)``.
+    """Write ``env_var_name=value`` into the ``.env`` this process loaded, or
+    into ``.env`` in the current working directory when none was loaded,
+    creating it if it doesn't exist yet.
+
+    Writing to the loaded file (``cognee.shared.env_file``) means a value
+    persisted here is picked up by the next process that resolves the same
+    file, including a pinned ``COGNEE_ENV_FILE`` or a ``.env`` found in a
+    parent directory. Returns ``(path, created)``.
     """
     import dotenv
 
-    path = os.path.join(os.getcwd(), ".env")
+    from cognee.shared.env_file import load_env_file
+
+    path = load_env_file() or os.path.join(os.getcwd(), ".env")
     created = not os.path.exists(path)
     if created:
         open(path, "a").close()
```

**File**: `cognee/api/v1/remember/remember.py` (modified, +2/-2)
```diff
@@ -1244,15 +1244,15 @@ async def remember(
                 "Call cognee.disconnect() to estimate locally."
             )
 
-        from cognee.infrastructure.llm import get_max_chunk_tokens
+        from cognee.infrastructure.llm import resolve_chunk_size
         from cognee.modules.chunking.TextChunker import TextChunker
         from cognee.modules.cognify.estimator import estimate_remember_dry_run
         from cognee.shared.data_models import KnowledgeGraph
 
         return await estimate_remember_dry_run(
             data,
             chunker=chunker or TextChunker,
-            chunk_size=chunk_size or await get_max_chunk_tokens(),
+            chunk_size=await resolve_chunk_size(chunk_size),
             graph_model=kwargs.get("graph_model") or KnowledgeGraph,
             custom_prompt=custom_prompt,
         )
```

**File**: `cognee/base_config.py` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ def validate_paths(self):
     langfuse_secret_key: str | None = None
     langfuse_host: str | None = None
 
-    model_config = SettingsConfigDict(env_file=".env", extra="allow")
+    model_config = SettingsConfigDict(extra="allow")
 
     def to_dict(self) -> dict:
         return {
```

---

### Incident Patch 15: `55d68f5f` (2026-09-29)
**Commit Message**: fix(config): Resolve .env from the working directory first, once, for every reader (SDK-781) (#5172)

Fixes
[SDK-781](https://linear.app/cognee/issue/SDK-781/env-is-resolved-from-the-installed-package-location-so-a-project-env).
From a user report: "Cognee's docs say setting
`ENABLE_BACKEND_ACCESS_CONTROL=false` in your `.env` disables access
control. On a standard pip install, it doesn't." Verified on `dev`.

## What was wrong

`cognee/__init__.py` and `cognee/shared/__init__.py` each called
`dotenv.load_dotenv(override=True)` with no path. python-dotenv then
searches upward from the **calling frame's file**, which is the
installed package, not the user's project. Whether the project `.env`
was found depended on where the environment lived:

| layout | project `.env` found |
| -- | -- |
| `python -m venv .venv` at the project root | yes, walking up from
site-packages reaches the project |
| conda, pipx, Homebrew python, a venv kept elsewhere | **no** |
| REPL, notebook, `python -c`, under a debugger | yes, dotenv switches
to the working directory |

Two things made it worse than a missed file:

1. **The file was half-read.** The settings classes (`BaseSettings` with
`env_file=".en

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -317,7 +317,7 @@ Support for PDF, DOCX, CSV, images, audio, code files in `cognee/infrastructure/
 ## Important Configuration
 
 ### Environment Setup
-Copy `.env.template` to `.env` and configure:
+Copy `.env.template` to `.env` and configure. Cognee finds the file once per process, at import, searching the working directory and its parents first, then the cognee package directory and its parents (`cognee/shared/env_file.py`). Each search stops at the project root, the nearest directory with a `.git` or `pyproject.toml`, so a `.env` above a project is never loaded; with no such marker (a plain folder of scripts) it continues up to the filesystem root. `COGNEE_ENV_FILE=/path/to/file` skips the search and loads that file (a path that is not a file raises at import). Values from the file take precedence over variables already set in the shell, for settings classes and `os.getenv` reads alike, so a project `.env` is the single source of truth wherever the environment happens to be installed. The path that was loaded (or "No .env file found") is logged at info on import.
 
 ```bash
 # Minimal setup (defaults to OpenAI + local file-based databases)
```

**File**: `cognee/__init__.py` (modified, +6/-3)
```diff
@@ -21,15 +21,18 @@
 #       there will be circular import issues
 __version__ = get_cognee_version()
 
-# Load environment variable settings has to be before setting up logging for LOG_LEVEL value
-import dotenv
+# The .env must be loaded before logging is configured, because LOG_LEVEL comes
+# from it. One resolver for the whole process — see cognee.shared.env_file for
+# the search order (working directory first, then the package's own tree).
+from cognee.shared.env_file import load_env_file, describe_resolution
 
-dotenv.load_dotenv(override=True)
+_env_file = load_env_file()
 
 # NOTE: Log level can be set with the LOG_LEVEL env variable
 from cognee.shared.logging_utils import setup_logging
 
 logger = setup_logging()
+logger.info(describe_resolution(_env_file))
 
 # ---------------------------------------------------------------------------
 # V1 API
```

**File**: `cognee/api/v1/config/config.py` (modified, +11/-8)
```diff
@@ -91,17 +91,20 @@ def _mask_secret(value: str) -> str:
 
 
 def _persist_env_var(env_var_name: str, value) -> tuple[str, bool]:
-    """Write ``env_var_name=value`` into the ``.env`` file in the current
-    working directory, creating it if it doesn't exist yet.
-
-    This is the same file every config class resolves via
-    ``SettingsConfigDict(env_file=".env")``, so a value persisted here is
-    picked up by the next process (CLI invocation or script) started from
-    the same directory. Returns ``(path, created)``.
+    """Write ``env_var_name=value`` into the ``.env`` this process loaded, or
+    into ``.env`` in the current working directory when none was loaded,
+    creating it if it doesn't exist yet.
+
+    Writing to the loaded file (``cognee.shared.env_file``) means a value
+    persisted here is picked up by the next process that resolves the same
+    file, including a pinned ``COGNEE_ENV_FILE`` or a ``.env`` found in a
+    parent directory. Returns ``(path, created)``.
     """
     import dotenv
 
-    path = os.path.join(os.getcwd(), ".env")
+    from cognee.shared.env_file import load_env_file
+
+    path = load_env_file() or os.path.join(os.getcwd(), ".env")
     created = not os.path.exists(path)
     if created:
         open(path, "a").close()
```

**File**: `cognee/base_config.py` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ def validate_paths(self):
     langfuse_secret_key: str | None = None
     langfuse_host: str | None = None
 
-    model_config = SettingsConfigDict(env_file=".env", extra="allow")
+    model_config = SettingsConfigDict(extra="allow")
 
     def to_dict(self) -> dict:
         return {
```

**File**: `cognee/eval_framework/eval_config.py` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ class EvalConfig(BaseSettings):
     direct_llm_eval_prompt: str = "direct_llm_eval_prompt.txt"
     instance_filter: list[str] | None = None
 
-    model_config = SettingsConfigDict(env_file=".env", extra="allow")
+    model_config = SettingsConfigDict(extra="allow")
 
     def to_dict(self) -> dict:
         return {
```

**File**: `cognee/infrastructure/data/chunking/config.py` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ class ChunkConfig(BaseSettings):
     chunk_strategy: ChunkStrategy = ChunkStrategy.PARAGRAPH
     chunk_engine: ChunkEngine = ChunkEngine.DEFAULT_ENGINE
 
-    model_config = SettingsConfigDict(env_file=".env", extra="allow")
+    model_config = SettingsConfigDict(extra="allow")
 
     def to_dict(self) -> dict[str, Any]:
         """
```

**File**: `cognee/infrastructure/databases/cache/config.py` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ class CacheConfig(BaseSettings):
     tapes_model: str = "cognee-session"
     tapes_request_timeout: float = 5.0
 
-    model_config = SettingsConfigDict(env_file=".env", extra="allow")
+    model_config = SettingsConfigDict(extra="allow")
 
     @pydantic.model_validator(mode="after")
     def sync_legacy_ladybug_lock(self):
```

**File**: `cognee/infrastructure/databases/graph/config.py` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ class GraphConfig(BaseSettings):
     kuzu_buffer_pool_size: int = Field(DEFAULT_KUZU_BUFFER_POOL_SIZE, env="KUZU_BUFFER_POOL_SIZE")
     kuzu_max_db_size: int = Field(DEFAULT_KUZU_MAX_DB_SIZE, env="KUZU_MAX_DB_SIZE")
 
-    model_config = SettingsConfigDict(env_file=".env", extra="allow", populate_by_name=True)
+    model_config = SettingsConfigDict(extra="allow", populate_by_name=True)
 
     # Model validator updates graph_filename and path dynamically after class creation based on current database provider
     # If no specific graph_filename or path are provided
```

#### Recent Merged Pull Requests:
- **PR #5392** (2026-10-05): fix(update): Report redated_chunks in the update result (SDK-821) (@dexters1)
- **PR #5383** (2026-10-05): fix(temporal): Re-date kept chunks on incremental update (SDK-821) (@dexters1)
- **PR #5365** (closed): feat(linear): Sync the Linear agent through the DLT source (SDK-907) (@goran-radonic)
- **PR #5361** (2026-10-05): fix(ci): report the tenant's cognify error in the cloud benchmark (@NMZivkovic)
- **PR #5356** (2026-10-04): fix(ci): add extension to PR lint workflow (@Sswastik60)
- **PR #5345** (closed): fix(ingestion): Gate local paths before probing them (SDK-793) (@ArmagedonFlamer)
- **PR #5343** (2026-10-02): fix(remember): Restore the code-ingest HTTP checks (SDK-793) (@ArmagedonFlamer)
- **PR #5342** (2026-10-02): fix(remember): Restore repo spec handling and item identity (SDK-793) (@ArmagedonFlamer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
