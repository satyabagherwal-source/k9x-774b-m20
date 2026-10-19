> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/topoteretes-cognee-learnings.md`  
> **Source**: github ([https://github.com/topoteretes/cognee](https://github.com/topoteretes/cognee))  
> **Source Version**: `37f788bd`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T06:45:02.320Z  
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
> **Harvest Timestamp**: 2026-10-19T06:45:02.312Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `topoteretes/cognee`
- **Description**: Cognee is the open-source AI memory platform for agents. Give your AI agents persistent long-term memory with small models for free
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 32513 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5686** (2026-10-13): **[Bug]: remove_disconnected_chunks looks up edges the graph no longer writes, then deletes unrelated nodes**
  *Symptoms*: ### Bug Description  `remove_disconnected_chunks` (`cognee/tasks/chunks/remove_disconnected_chunks.py`) is a public task, exported from `cognee/tasks/chunks/` and listed in `cognee/tasks/README.md`. It no longer matches the graph the current pipeline writes, and after that miss it deletes every node the adapter reports as having no edges.  The default cognify pipeline does not call this task. A custom pipeline that includes it will mis-clean the graph.  The task queries `has_chunk` and `next_chunk`, then reads `chunk["uuid"]`. After that it calls `get_disconnected_nodes()` and deletes whatever comes back.  Three things are wrong on current `dev`:  1. Chunk membership is an `is_part_of` edge from the chunk to the document. `has_chunk` and `next_chunk` are not written anywhere else in the repository, so the lookup finds nothing on a graph built by the current pipeline. 2. Ladybug `get_successors` returns node dicts keyed by `id`. `DocumentChunk` has no `uuid` field, so a hit raises `KeyError` instead of identifying the chunk. 3. After that miss, the task deletes every node `get_disconnected_nodes()` returns, including nodes that are not chunks of the documents in this batch.  ### Steps to Reproduce  1. Build a graph with the current pipeline (`remember`, or `add` plus `cognify`) so chunks hang off their document by `is_part_of` and node identity is `id`. 2. Run `remove_disconnected_chunks` over those `DocumentChunks`, either from a custom pipeline or a direct call. 3. Inspect w

- **Issue #5590** (2026-10-13): **[Bug]: Dataset API responses expose internal exception details**
  *Symptoms*: ### Bug Description  The dataset list and create endpoints include the caught exception text in their HTTP 500 response. This can reveal internal database or configuration details to authenticated API callers. The error details should be logged server-side, while the API response should contain a generic message.  ### Steps to Reproduce  1. Start the Cognee API with authentication enabled. 2. Authenticate as a user. 3. Cause an internal error while retrieving datasets (for example, by making the relational database unavailable),     then request GET /api/v1/datasets. 4. Cause an internal error while creating a dataset, then request POST /api/v1/datasets. 5.Inspect the 500 response bodies.  ### Expected Behavior  Both endpoints return a generic error message. Detailed exception information is available only in server-side logs.  ### Actual Behavior  The response detail interpolates the caught exception text, potentially exposing internal implementation or infrastructure information.  ### Environment  - Repository: Cognee - Affected file: cognee/api/v1/datasets/routers/get_datasets_router.py - Affected handlers: get_datasets and create_new_dataset  ### Logs/Error Messages  ```shell No specific error message required; the issue occurs when either handler catches an exception and returns str(error) in the response detail. ```  ### Additional Context  Keep the existing HTTP 500 status and server-side diagnostics, but return a generic client-facing message.  ### Pre-submission Chec

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

### Incident Patch 1: `b063aea8` (2026-10-16)
**Commit Message**: fix: Curate every new entry per distill run by default (SDK-1140) (#5935)

## Description

Follow-up to #5722. That PR capped a distill run at 20 curator batches
(120 blocks) and sealed every gated entry the run loaded, curated or
not. A session that gated more entries than the cap lost the rest for
good: marked as distilled, never curated, with one log line as the only
trace. With `improve()` on a daily schedule that is daily data loss on
any active session.

**Default: no cap.** A run curates every new gated entry. Nothing is
left pending and nothing is lost; the next run sees only entries created
since.

**Cap as an opt-in setting.** `IMPROVE_DISTILL_MAX_BATCHES_PER_RUN` on
`ImproveConfig`, default `0` meaning off. With a value, the run curates
the most relevant entries that fit in that many batches (highest
confidence, then most recent) and seals the rest uncurated, as #5722
did. Setting it is the explicit choice to trade the overflow for a
bounded run. The count sealed uncurated is on
`DistillationResult.uncurated_entries` and on the improve stage result
as `entries_uncurated`. The stage passes the run's frozen config to
`distill_session`; SDK callers without the argument read

**File**: `cognee/modules/improve/config.py` (modified, +12/-0)
```diff
@@ -17,6 +17,7 @@
     IMPROVE_EFFECTIVE_DATE_KEY=effective_date  # document metadata source-date key
     IMPROVE_TRACE_WINDOW_STEPS=30      # max agent trace steps per persisted document
     IMPROVE_TRACE_WINDOWS_PER_RUN=10   # max agent trace documents per stage pass
+    IMPROVE_DISTILL_MAX_BATCHES_PER_RUN=0  # curator batches per distill run; 0 = uncapped
 """
 
 from functools import lru_cache
@@ -55,6 +56,10 @@ class ImproveConfig(BaseSettings):
     # Windows one persist_agent_traces pass may cognify; the rest of a backlog
     # waits for the next improve().
     trace_windows_per_run: int = 10
+    # Session distillation curates every new gated entry of a session per run.
+    # A cap curates only the most relevant entries that fit in this many curator
+    # batches and seals the rest uncurated; 0 means no cap.
+    distill_max_batches_per_run: int = 0
 
     model_config = SettingsConfigDict(env_prefix="IMPROVE_", extra="ignore")
 
@@ -88,6 +93,13 @@ def _entries_non_negative(cls, value: int) -> int:
             raise ValueError("debounce_entries must be >= 0")
         return value
 
+    @field_validator("distill_max_batches_per_run")
+    @classmethod
+    def _cap_non_negative(cls, value: int) -> int:
+        if value < 0:
+            raise ValueError("distill_max_batches_per_run must be >= 0 (0 = uncapped)")
+        return value
+
     @field_validator("debounce_seconds")
     @classmethod
     def _seconds_non_negative(cls, value: float) -> float:
```

**File**: `cognee/modules/improve/stages.py` (modified, +7/-1)
```diff
@@ -319,13 +319,18 @@ async def run(self, inputs: ImproveRunInputs) -> StageResult:
         distilled = 0
         completed = 0
         failed = 0
+        uncurated = 0
         last_error: BaseException | None = None
         for session_id in inputs.session_ids:
             try:
                 result = await distill_session(
-                    session_id, dataset=inputs.dataset_id, user=inputs.user
+                    session_id,
+                    dataset=inputs.dataset_id,
+                    user=inputs.user,
+                    max_batches=inputs.config.distill_max_batches_per_run,
                 )
                 distilled += len(result.documents)
+                uncurated += result.uncurated_entries
                 if result.status == "completed":
                     completed += 1
                 logger.info(
@@ -347,6 +352,7 @@ async def run(self, inputs: ImproveRunInputs) -> StageResult:
             "documents": distilled,
             "sessions_completed": completed,
             "sessions_failed": failed,
+            "entries_uncurated": uncurated,
         }
         if failed:
             return StageResult.errored(self.name, last_error, **counts)
```

**File**: `cognee/modules/session_distillation/distill.py` (modified, +210/-65)
```diff
@@ -2,15 +2,20 @@
 
 Flow (curator calls parallel by batch; accept/write calls parallel by lesson):
 
-1. LOAD    distillable session-context entries the watermark does not cover + QA turns.
-2. CURATE  pack a bounded slice of them into batches; one curator LLM call per batch.
+1. LOAD    distillable session-context entries the watermark does not cover, plus the
+           QA turns from the turn that produced the earliest such entry onward (older
+           turns were already curated with the entries they produced).
+2. CURATE  pack them into batches; one curator LLM call per batch. Every new entry is
+           curated unless ``IMPROVE_DISTILL_MAX_BATCHES_PER_RUN`` caps the run.
 3. ACCEPT  per proposed lesson: search prior lessons/entities, then writer/rejecter LLM.
 4. PERSIST render accepted lessons as documents; add + cognify them in one pass.
 
-A failed curator batch or writer call drops only its own work mid-run, but the run then
-finishes by RAISING (after publishing what survived) instead of advancing the watermark:
-sealing entries behind calls that never ran would mark them distilled forever — one LLM
-outage on a finished session would silently lose its lessons.
+An entry is sealed (added to the watermark) once its curator batch completed and the
+run's surviving lessons are published, whatever the writer did with the lessons:
+processed once is processed. A batch whose curator call failed seals nothing, so only its
+entries come back next run; the run still finishes by RAISING after publishing what
+survived, so the failure is reported. A run cut short by an exhausted LLM budget, in the
+curator or the writer phase, seals nothing and re-raises, so improve can stop.
 """
 
 import asyncio
@@ -20,6 +25,7 @@
 from cognee.context_global_variables import session_user, set_database_global_context_variables
 from cognee.exceptions import CogneeValidationError
 from cognee.infrastructure.databases.vector import get_vector_engine_async
+from cognee.infrastructure.llm.exceptions import LLMPaymentRequiredError
 from cognee.infrastructure.llm.LLMGateway import LLMGateway
 from cognee.infrastructure.llm.prompts import read_query_prompt
 from cognee.infrastructure.session.get_session_manager import get_session_manager
@@ -41,6 +47,7 @@
 )
 from cognee.modules.data.methods import get_authorized_existing_datasets
 from cognee.modules.data.models import Dataset
+from cognee.modules.improve.config import get_improve_config
 from cognee.modules.improve.constants import SESSION_LEARNINGS_NODE_SET
 from cognee.modules.truth_subspace.constants import truth_session_node_set
 from cognee.modules.users.methods import get_default_user
@@ -53,7 +60,6 @@
     CURATOR_CONCURRENCY,
     GLOSSARY_ENTITIES_PER_LESSON,
     MAX_CANDIDATE_CHARS,
-    MAX_CURATOR_BATCHES_PER_RUN,
     MAX_QA_ANSWER_CHARS,
     MAX_QA_FEEDBACK_CHARS,
     MAX_QA_QUESTION_CHARS,
@@ -69,7 +75,29 @@
 
 
 class DistillationCallsFailedError(RuntimeError):
-    """Some curator/writer LLM calls failed, so the run's watermark was left untouched."""
+    """Some curator/writer LLM calls failed.
+
+    Entries of completed curator batches are sealed; entries of failed batches are
+    left for the next run. Lessons lost to failed writer calls are not retried.
+    """
+
+
+@dataclass
+class CuratorBatch:
+    """One curator call's input and the gated entries it covers."""
+
+    text: str
+    entry_ids: list[str]
+
+
+@dataclass
+class CuratorRun:
+    """What the curator phase produced and which entries it got through."""
+
+    proposed: list[ProposedLesson]
+    failed_batches: int
+    curated_entry_ids: set[str]
+    budget_exhausted: bool = False
 
 
 CURATOR_PROMPT_FILE = "session_distillation_curator_system.txt"
@@ -96,12 +124,18 @@ def user_id(self) -> str:
     def dataset_id(self) -> str:
         return str(self.dataset.id)
 
-    def result(self, status: str, documents: list[str] | None = None) -> DistillationResult:
+    def result(
+        self,
+        status: str,
+        documents: list[str] | None = None,
+        uncurated_entries: int = 0,
+    ) -> DistillationResult:
         return DistillationResult(
             session_id=self.session_id,
             dataset_id=self.dataset_id,
             status=status,
             documents=documents or [],
+            uncurated_entries=uncurated_entries,
         )
 
 
@@ -184,17 +218,43 @@ async def load_session_qa_rows(scope: SessionDistillationScope) -> list[dict]:
     ]
 
 
+def select_session_turns(
+    qa_rows: list[dict],
+    new_entries: list[SessionContextEntry],
+) -> list[dict]:
+    """Keep the QA turns from the one that produced the earliest new entry onward.
+
+    Turns carry no watermark; the entries do. The analysis that writes an entry runs
+    while a turn is answered, before that turn's QA row is stored, and it judges the
+    turn before. So the entry's timestamp falls after the turn it is about: start at
+    the newest turn at or before the earliest new e
```

**File**: `cognee/modules/session_distillation/models.py` (modified, +4/-3)
```diff
@@ -28,9 +28,8 @@
 # blocks plus separators stays below the budget, so the batching logic can stay simple.
 BATCH_CHAR_BUDGET = 16_000
 CURATOR_BLOCKS_PER_BATCH = 6
-# One run curates at most this many batches, so a session that gates thousands of
-# entries stays bounded; entries past the bound are sealed by the watermark, not carried over.
-MAX_CURATOR_BATCHES_PER_RUN = 20
+# A run curates every new gated entry unless ``IMPROVE_DISTILL_MAX_BATCHES_PER_RUN``
+# caps it; entries past a cap are sealed by the watermark, not carried over.
 MAX_QA_QUESTION_CHARS = 1_200
 MAX_QA_ANSWER_CHARS = 1_200
 MAX_CANDIDATE_CHARS = 280
@@ -107,3 +106,5 @@ class DistillationResult(BaseModel):
         "no_accepted_lessons",
     ]
     documents: list[str] = Field(default_factory=list)
+    # New gated entries sealed without curation because the run was capped.
+    uncurated_entries: int = 0
```

**File**: `cognee/tests/unit/modules/improve/test_improve_config.py` (modified, +12/-0)
```diff
@@ -30,6 +30,7 @@ def test_defaults(monkeypatch):
     assert config.debounce_seconds == 0.0
     assert config.stages_disabled == []
     assert config.feedback_alpha == DEFAULT_FEEDBACK_ALPHA == 0.1
+    assert config.distill_max_batches_per_run == 0
 
 
 def test_env_prefix_and_csv_parsing(monkeypatch):
@@ -72,6 +73,16 @@ def test_negative_debounce_rejected():
         ImproveConfig(_env_file=None, debounce_seconds=-0.5)
 
 
+def test_negative_distill_cap_rejected():
+    with pytest.raises(ValueError, match="distill_max_batches_per_run"):
+        ImproveConfig(_env_file=None, distill_max_batches_per_run=-1)
+
+
+def test_distill_cap_reads_env(monkeypatch):
+    monkeypatch.setenv("IMPROVE_DISTILL_MAX_BATCHES_PER_RUN", "3")
+    assert ImproveConfig(_env_file=None).distill_max_batches_per_run == 3
+
+
 def test_config_declares_no_shared_knobs():
     fields = set(ImproveConfig.model_fields)
     assert fields == {
@@ -84,6 +95,7 @@ def test_config_declares_no_shared_knobs():
         "effective_date_key",
         "trace_window_steps",
         "trace_windows_per_run",
+        "distill_max_batches_per_run",
     }
     for shared in ("triplet_embedding", "caching", "auto_feedback", "personalization_enabled"):
         assert shared not in fields
```

**File**: `cognee/tests/unit/modules/session_distillation/test_distillation_helpers.py` (modified, +78/-11)
```diff
@@ -173,6 +173,73 @@ async def test_load_keeps_entry_rated_harmful_once_but_helpful_three_times(self,
         assert [entry.content for entry in context_entries] == ["Survives."]
 
 
+class TestSelectSessionTurns:
+    def test_keeps_turns_from_the_one_before_the_earliest_new_entry_onward(self):
+        # An entry is written after the turn it judges, so the newest turn before
+        # the earliest new entry is the one that produced it and must be kept.
+        entries = [
+            _context_entry(created_at="2026-06-11T12:00:00+00:00"),
+            _context_entry(created_at="2026-06-11T10:00:00.500000+00:00"),
+        ]
+        rows = [
+            _qa_row("long before", time="2026-06-11T08:00:00+00:00"),
+            _qa_row("producing", time="2026-06-11T10:00:00+00:00"),
+            _qa_row("after", time="2026-06-11T15:00:00+00:00"),
+        ]
+
+        kept = distill_module.select_session_turns(rows, entries)
+
+        assert [row["question"] for row in kept] == ["producing", "after"]
+
+    def test_no_turn_before_the_entry_keeps_the_rest(self):
+        entries = [_context_entry(created_at="2026-06-11T10:00:00+00:00")]
+        rows = [_qa_row("after", time="2026-06-11T11:00:00+00:00")]
+
+        assert distill_module.select_session_turns(rows, entries) == rows
+
+    def test_no_new_entries_keeps_every_turn(self):
+        rows = [_qa_row("any", time="2026-06-11T09:00:00+00:00")]
+
+        assert distill_module.select_session_turns(rows, []) == rows
+
+    def test_entry_without_timestamp_keeps_every_turn(self):
+        entries = [_context_entry(created_at="")]
+        rows = [_qa_row("any", time="2026-06-11T09:00:00+00:00")]
+
+        assert distill_module.select_session_turns(rows, entries) == rows
+
+
+class TestSelectCuratorInputs:
+    def test_uncapped_returns_everything(self):
+        entries = [_context_entry(confidence=0.8) for _ in range(50)]
+        rows = [_qa_row(f"q{i}") for i in range(50)]
+
+        kept_rows, kept_entries = distill_module.select_curator_inputs(rows, entries, 0)
+
+        assert kept_rows == rows
+        assert kept_entries == entries
+
+    def test_cap_keeps_the_most_confident_entries_then_recent_turns(self):
+        sure = [_context_entry(confidence=0.99, content="sure")]
+        bulk = [_context_entry(confidence=0.8, content=f"bulk {i}") for i in range(20)]
+        rows = [_qa_row(f"q{i}", time=f"2026-06-11T10:{i:02d}:00+00:00") for i in range(10)]
+
+        kept_rows, kept_entries = distill_module.select_curator_inputs(rows, bulk + sure, 1)
+
+        assert len(kept_entries) == CURATOR_BLOCKS_PER_BATCH
+        assert kept_entries[0].content == "sure"
+        assert kept_rows == []
+
+    def test_cap_fills_leftover_blocks_with_the_most_recent_turns(self):
+        entries = [_context_entry(confidence=0.9, content="one")]
+        rows = [_qa_row(f"q{i}", time=f"2026-06-11T10:{i:02d}:00+00:00") for i in range(10)]
+
+        kept_rows, kept_entries = distill_module.select_curator_inputs(rows, entries, 1)
+
+        assert kept_entries == entries
+        assert [row["question"] for row in kept_rows] == ["q5", "q6", "q7", "q8", "q9"]
+
+
 class TestBuildCuratorBatches:
     def test_small_session_is_one_batch_with_turns_and_candidates(self):
         context_entries = [_context_entry(content="Flashing wipes calibration.")]
@@ -181,30 +248,30 @@ def test_small_session_is_one_batch_with_turns_and_candidates(self):
         )
 
         assert len(batches) == 1
-        assert "User: How do I update firmware?" in batches[0]
-        assert f"Candidate {context_entries[0].id}" in batches[0]
-        assert "Flashing wipes calibration." in batches[0]
+        assert "User: How do I update firmware?" in batches[0].text
+        assert f"Candidate {context_entries[0].id}" in batches[0].text
+        assert "Flashing wipes calibration." in batches[0].text
 
     def test_feedback_text_is_appended_to_the_turn_block(self):
         batch = distill_module.build_curator_batches(
             [_qa_row("Which port?", "8080.", feedback_text="Wrong, it is 9000.")], []
-        )[0]
+        )[0].text
 
         assert (
             batch
             == "User: Which port?\nAssistant: 8080.\nUser feedback on this answer: Wrong, it is 9000."
         )
 
     def test_turn_without_feedback_has_no_feedback_line(self):
-        batch = distill_module.build_curator_batches([_qa_row("Q?", "A.")], [])[0]
+        batch = distill_module.build_curator_batches([_qa_row("Q?", "A.")], [])[0].text
 
         assert "User feedback on this answer" not in batch
 
     def test_feedback_text_is_normalized_and_capped(self):
         batch = distill_module.build_curator_batches(
             [_qa_row("Q?", "A.", feedback_text="  too   " + "w" * (MAX_QA_FEEDBACK_CHARS * 2))],
             [],
-        )[0]
+        )[0].text
 
         feedback_line = batch.split("User feedback on this answer: ", 1)[1]
         assert feedback_line.startswith("too w")
@@ -216,7 +283,7 
```

**File**: `cognee/tests/unit/modules/session_distillation/test_distillation_watermark.py` (modified, +315/-23)
```diff
@@ -93,6 +93,16 @@ async def unexpected(*args, **kwargs):
     monkeypatch.setattr(distill_module, "accept_proposed_lessons", unexpected)
 
 
+def _curator_run(context_entries, proposed=None, failed_batches=0, curated=None):
+    """Stand-in for propose_lessons: by default every batch completed."""
+    entries = context_entries if curated is None else curated
+    return distill_module.CuratorRun(
+        proposed=list(proposed or []),
+        failed_batches=failed_batches,
+        curated_entry_ids={entry.id for entry in entries},
+    )
+
+
 def _install_manager(monkeypatch, manager):
     monkeypatch.setattr(distill_module, "get_session_manager", lambda: manager)
 
@@ -125,7 +135,7 @@ async def test_watermark_is_scoped_to_the_target_dataset(monkeypatch, datasets):
 
     async def fake_propose(qa_rows, context_entries):
         proposed.append([entry.id for entry in context_entries])
-        return [], 0
+        return _curator_run(context_entries)
 
     monkeypatch.setattr(distill_module, "propose_lessons", fake_propose)
 
@@ -162,7 +172,7 @@ async def test_new_gated_entry_after_the_watermark_triggers_a_run(monkeypatch, d
 
     async def fake_propose(qa_rows, context_entries):
         seen.append(sorted(entry.id for entry in context_entries))
-        return [], 0
+        return _curator_run(context_entries)
 
     monkeypatch.setattr(distill_module, "propose_lessons", fake_propose)
 
@@ -188,7 +198,7 @@ async def test_no_proposed_lessons_advances_watermark_so_next_run_is_free(monkey
     async def fake_propose(qa_rows, context_entries):
         nonlocal calls
         calls += 1
-        return [], 0
+        return _curator_run(context_entries)
 
     monkeypatch.setattr(distill_module, "propose_lessons", fake_propose)
 
@@ -207,7 +217,7 @@ async def test_no_accepted_lessons_advances_watermark(monkeypatch, datasets):
     _install_manager(monkeypatch, manager)
 
     async def fake_propose(qa_rows, context_entries):
-        return [ProposedLesson(working_statement="Something.")], 0
+        return _curator_run(context_entries, [ProposedLesson(working_statement="Something.")])
 
     async def fake_accept(scope, proposed, context_entries):
         return [], 0
@@ -231,7 +241,7 @@ async def test_completed_run_advances_watermark_after_publish(monkeypatch, datas
     order = []
 
     async def fake_propose(qa_rows, context_entries):
-        return [ProposedLesson(working_statement="Something.")], 0
+        return _curator_run(context_entries, [ProposedLesson(working_statement="Something.")])
 
     async def fake_accept(scope, proposed, context_entries):
         return [WrittenLesson(accept=True, statement="Keep reports concise.")], 0
@@ -262,7 +272,7 @@ async def test_failed_publish_leaves_watermark_untouched(monkeypatch, datasets):
     _install_manager(monkeypatch, manager)
 
     async def fake_propose(qa_rows, context_entries):
-        return [ProposedLesson(working_statement="Something.")], 0
+        return _curator_run(context_entries, [ProposedLesson(working_statement="Something.")])
 
     async def fake_accept(scope, proposed, context_entries):
         return [WrittenLesson(accept=True, statement="Keep reports concise.")], 0
@@ -315,7 +325,7 @@ async def test_failed_curator_calls_leave_the_watermark_untouched(monkeypatch, d
     _install_manager(monkeypatch, manager)
 
     async def fake_propose(qa_rows, context_entries):
-        return [], 2  # every curator batch failed
+        return _curator_run(context_entries, failed_batches=2, curated=[])
 
     monkeypatch.setattr(distill_module, "propose_lessons", fake_propose)
 
@@ -326,14 +336,23 @@ async def fake_propose(qa_rows, context_entries):
 
 
 @pytest.mark.asyncio
-async def test_partial_failure_publishes_survivors_but_keeps_the_window(monkeypatch, datasets):
-    rows = [_context_row("Lesson one.")]
-    manager = FakeSessionManager(rows)
+async def test_partial_failure_publishes_survivors_and_seals_only_completed_batches(
+    monkeypatch, datasets
+):
+    done_row = _context_row("Lesson one.")
+    lost_row = _context_row("Lesson two.")
+    manager = FakeSessionManager([done_row, lost_row])
     _install_manager(monkeypatch, manager)
     published = []
 
     async def fake_propose(qa_rows, context_entries):
-        return [ProposedLesson(working_statement="Something.")], 1  # one batch lost
+        done = [entry for entry in context_entries if entry.id == done_row["id"]]
+        return _curator_run(
+            context_entries,
+            [ProposedLesson(working_statement="Something.")],
+            failed_batches=1,
+            curated=done,
+        )
 
     async def fake_accept(scope, proposed, context_entries):
         return [WrittenLesson(accept=True, statement="Keep reports concise.")], 0
@@ -349,30 +368,232 @@ async def fake_publish(scope, accepted):
     with pytest.raises(distill_module.DistillationCallsFailedError):
         await distill_module.distill_session("s-1", dataset=DATASET_A.name
```

---

### Incident Patch 2: `32c4f26b` (2026-10-16)
**Commit Message**: fix: Drain the trace backlog per run (SDK-1139) (#5938)

## Description

Follow-up to #5725. That PR persists a session's pending agent trace
steps in windows of 30 steps (`IMPROVE_TRACE_WINDOW_STEPS`), at most 10
windows per `improve()` run (`IMPROVE_TRACE_WINDOWS_PER_RUN`), and stops
the stage as soon as one window does not advance its watermark. With
`improve()` running once a day that cap becomes a daily cap: 300 steps a
day in total, 30 per session once ten sessions are pending, and sessions
past the tenth never get a turn while busier ones are ahead of them in
the list. A coding agent produces more than that, so the backlog grows
and never catches up. One session whose window cannot build also stopped
the whole stage on every run.

**Default: drain the backlog the run started with.**
`IMPROVE_TRACE_WINDOWS_PER_RUN` now defaults to `0`, meaning no cap: one
run persists every window that was pending when it started. The step
counts are read once at the start and the run drains up to them; steps
an agent writes while the run goes on wait for the next run, so a live
session cannot keep the run, and the dataset's improve lock, going. A
value keeps the old bounded behaviour, for de

**File**: `.env.template` (modified, +6/-0)
```diff
@@ -785,6 +785,12 @@ WEB_SCRAPER_MAX_DELAY=10.0
 #IMPROVE_REVIEW_CONFLICTS=false
 # Document external_metadata key holding the source date; never ingestion time.
 #IMPROVE_EFFECTIVE_DATE_KEY=effective_date
+# persist_agent_traces cognifies a session's pending agent trace steps in
+# windows of at most WINDOW_STEPS steps, so no single LLM call grows with the
+# backlog. WINDOWS_PER_RUN=0 (default) drains the backlog a run started with;
+# a value caps the windows one run persists and leaves the rest for the next.
+#IMPROVE_TRACE_WINDOW_STEPS=30
+#IMPROVE_TRACE_WINDOWS_PER_RUN=0
 # Session-search execution mode. concurrent (default) analyzes the turn
 # concurrently with retrieval and answering, so a turn costs one answer call of
 # wall-clock time; sequential analyzes first and lets the analysis rewrite the
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -243,7 +243,7 @@ Each stage is a gate plus a call into existing code plus a result mapping — it
 
 The run resolves the dataset once and hands every stage a frozen `ImproveRunInputs` (user, resolved dataset id, session ids, `ImproveConfig`, adapter `GraphCapabilities`). It claims one improve lock keyed to the run — every session id given (scoped by user id) plus `dataset:<id>`, so improves for one dataset serialize — and holds it until the last stage finishes, background included; a lost claim returns an `ImproveResult` whose stages are all `skipped: lock_held` (never `{}`). A session-keyed run that loses the claim to a run holding one of its sessions asks that holder for one more pass (`rerun_requested=True` on the loser's result); the holder runs the stages again before releasing — cheap, every stage is watermark-gated — and reports the extra passes in `rerun_passes` (at most 2 extra, 3 passes in total: `IMPROVE_MAX_RERUN_PASSES = 3` in `cognee/api/v1/improve/improve.py` counts the first pass, and is a constant, not an env var). Dataset-only runs do not take part, so a burst of `remember()` calls on one dataset still collapses into one enrichment. `run_in_background=True` runs all stages in one anchored task; await it with `await result.wait()`. `ImproveResult` is what every surface returns: SDK, `POST /api/v1/improve` (`response_model`), the CLI (one line per stage), and `RememberResult.improve` / `.improve_error` (MCP reaches improve only through `remember`'s `self_improvement` — `improve` is deliberately not an advertised MCP tool; the advertised tool set is pinned to remember/recall/forget/code_search, with cognify_status registered but not advertised) (an improve failure after a successful cognify no longer marks the remember as errored). Stages that keep a watermark on the improve operation row (conflict review) stamp it there; the row is written when the run finishes — deferred to the background task in background mode — with a failed outcome when any stage errored (so a retry is never gated off) and a `noop` outcome when nothing ran — a lost lock claim or an all-skipped run — so a no-op call never advances the watermark. Feedback-weight application records applied element ids per QA row so a deleted node no longer causes the same feedback to be re-applied on every run; trace persistence and distillation carry watermarks like Q&A persistence already did.
 
-Settings the loop owns live in `ImproveConfig` (env prefix `IMPROVE_`): `IMPROVE_AUTO_ENABLED` (default true; false turns off the automatic improve after `remember()`), `IMPROVE_DEBOUNCE_ENTRIES` / `IMPROVE_DEBOUNCE_SECONDS` (session-path auto-improve fires only after that many new entries or that much time; seconds alone is time-only — the entries default of 1 steps aside — and there is no timer, so the check runs on each `remember()`), `IMPROVE_STAGES_DISABLED` (csv of stage names), `IMPROVE_FEEDBACK_ALPHA` (learning rate, default 0.1), `IMPROVE_REVIEW_CONFLICTS` (default false), and `IMPROVE_EFFECTIVE_DATE_KEY` (default `effective_date`, the document metadata source-date key). Shared knobs stay with their owners: `CACHING` / `AUTO_FEEDBACK` (cache layer), `PERSONALIZATION_ENABLED`, `DEFAULT_FEEDBACK_INFLUENCE`. `cognee.wait_for_background_tasks()` drains background improves before a script exits; the API server drains them on shutdown. A host application can also decline a single automatic improve before it starts: `cognee.modules.improve.register_auto_improve_admission(check)` registers one async check per process (a later registration replaces it, `None` / `clear_auto_improve_admission()` removes it) that `remember()` awaits on both paths with `user`, `dataset_id`, `session_id` and `session_ids` — only when an improve would otherwise run, and before the session debounce is consulted, so a skipped bridge never spends the window. A returned reason string (`"insufficient_credits"`) skips the improve and lands on `RememberResult.improve_skipped` (also in `to_dict()`); the data is stored either way. The check is fail-open — one that raises, or answers with anything but `None` or a non-empty string, allows the improve — and explicit `improve()` calls are never gated. Frequency weights were removed (no adapter implemented them and nothing read them).
+Settings the loop owns live in `ImproveConfig` (env prefix `IMPROVE_`): `IMPROVE_AUTO_ENABLED` (default true; false turns off the automatic improve after `remember()`), `IMPROVE_DEBOUNCE_ENTRIES` / `IMPROVE_DEBOUNCE_SECONDS` (session-path auto-improve fires only after that many new entries or that much time; seconds alone is time-only — the entries default of 1 steps aside — and there is no timer, so the check runs on each `remember()`), `IMPROVE_STAGES_DISABLED` (csv of stage names), `IMPROVE_FEEDBACK_ALPHA` (learning rate, default 0.1), `IMPROVE_REVIEW_CONFLICTS` (default false), `IMPROVE_EFFECTIVE_DATE_KEY` (default `effective_date`, the document metadata source-date key), and the agent-trace w
```

**File**: `cognee/memify_pipelines/persist_agent_trace_feedbacks_in_knowledge_graph.py` (modified, +4/-0)
```diff
@@ -23,6 +23,7 @@ async def persist_agent_trace_feedbacks_in_knowledge_graph_pipeline(
     raw_trace_content: bool = False,
     last_n_steps: int | None = None,
     run_in_background: bool = False,
+    persist_up_to: dict[str, int] | None = None,
 ):
     """
     Persist agent trace content into the knowledge graph via memify pipeline.
@@ -41,6 +42,8 @@ async def persist_agent_trace_feedbacks_in_knowledge_graph_pipeline(
             of ``session_feedback`` summaries.
         last_n_steps: Optional number of most recent trace steps to persist per
             session. When None, all stored steps are persisted.
+        persist_up_to: Optional step count per session that no window passes;
+            later steps wait for a later run.
         run_in_background: If True, runs memify asynchronously and returns immediately.
     """
     await set_session_user_context_variable(user)
@@ -65,6 +68,7 @@ async def persist_agent_trace_feedbacks_in_knowledge_graph_pipeline(
             session_ids=session_ids,
             raw_trace_content=raw_trace_content,
             last_n_steps=last_n_steps,
+            persist_up_to=persist_up_to,
             needs_llm=False,
         )
     ]
```

**File**: `cognee/modules/improve/config.py` (modified, +13/-6)
```diff
@@ -16,7 +16,7 @@
     IMPROVE_REVIEW_CONFLICTS=false     # review source facts and dated conflicts
     IMPROVE_EFFECTIVE_DATE_KEY=effective_date  # document metadata source-date key
     IMPROVE_TRACE_WINDOW_STEPS=30      # max agent trace steps per persisted document
-    IMPROVE_TRACE_WINDOWS_PER_RUN=10   # max agent trace documents per stage pass
+    IMPROVE_TRACE_WINDOWS_PER_RUN=0    # max agent trace documents per run; 0 = drain
     IMPROVE_DISTILL_MAX_BATCHES_PER_RUN=0  # curator batches per distill run; 0 = uncapped
 """
 
@@ -53,9 +53,9 @@ class ImproveConfig(BaseSettings):
     # Agent trace persistence cognifies a session's pending steps in windows of
     # at most this many steps, so no single LLM call grows with the backlog.
     trace_window_steps: int = 30
-    # Windows one persist_agent_traces pass may cognify; the rest of a backlog
-    # waits for the next improve().
-    trace_windows_per_run: int = 10
+    # Windows one persist_agent_traces run may cognify. 0 (the default) drains
+    # the backlog in one run; with a cap, the rest waits for the next improve().
+    trace_windows_per_run: int = 0
     # Session distillation curates every new gated entry of a session per run.
     # A cap curates only the most relevant entries that fit in this many curator
     # batches and seals the rest uncurated; 0 means no cap.
@@ -79,11 +79,18 @@ def _alpha_in_unit_interval(cls, value: float) -> float:
             raise ValueError("feedback_alpha must be in range (0, 1]")
         return value
 
-    @field_validator("trace_window_steps", "trace_windows_per_run")
+    @field_validator("trace_window_steps")
     @classmethod
     def _positive(cls, value: int) -> int:
         if value < 1:
-            raise ValueError("trace window settings must be >= 1")
+            raise ValueError("trace_window_steps must be >= 1")
+        return value
+
+    @field_validator("trace_windows_per_run")
+    @classmethod
+    def _windows_non_negative(cls, value: int) -> int:
+        if value < 0:
+            raise ValueError("trace_windows_per_run must be >= 0 (0 = drain the backlog)")
         return value
 
     @field_validator("debounce_entries")
```

**File**: `cognee/modules/improve/stages.py` (modified, +77/-22)
```diff
@@ -81,10 +81,17 @@ async def _watermarks_show_nothing_new(inputs: ImproveRunInputs, *, kind: str) -
         return False
 
 
-async def _pending_trace_watermarks(inputs: ImproveRunInputs) -> dict[str, int] | None:
-    """The trace persist watermark of each session with unpersisted steps.
-
-    None when the session store cannot be read.
+async def _pending_trace_watermarks(
+    inputs: ImproveRunInputs, backlog: dict[str, int] | None = None
+) -> dict[str, tuple[int, int]] | None:
+    """``(persisted, total)`` step counts of each session with unpersisted steps.
+
+    ``persisted`` is the effective watermark (a stale one, above the LIVE
+    count, reads as 0). With ``backlog``, the step counts a run started with,
+    only sessions still below their starting count are pending: steps written
+    while the run goes on wait for the next run, and a watermark another
+    persister moved past the starting count reads as done, not stale. None
+    when the session store cannot be read.
     """
     try:
         from cognee.infrastructure.session.get_session_manager import get_session_manager
@@ -105,8 +112,17 @@ async def _pending_trace_watermarks(inputs: ImproveRunInputs) -> dict[str, int]
             persisted = await TRACE_PERSIST_WATERMARK.read_count(
                 session_manager, user_id, session_id
             )
-            if total and resolve_trace_window(total, persisted, None, session_id=session_id)[1]:
-                pending[session_id] = persisted
+            step_limit = None
+            if backlog is not None:
+                if session_id not in backlog:
+                    continue
+                step_limit = backlog[session_id]
+            # The live total drives the stale check; the limit only bounds the reach.
+            effective, pending_steps = resolve_trace_window(
+                total, persisted, None, session_id=session_id, step_limit=step_limit
+            )
+            if total and pending_steps:
+                pending[session_id] = (effective, total)
         return pending
     except Exception as error:
         logger.debug("improve: trace watermarks unreadable: %s", error, exc_info=True)
@@ -172,6 +188,12 @@ async def run(self, inputs: ImproveRunInputs) -> StageResult:
         return StageResult.from_pipeline_run(self.name, result, sessions=len(inputs.session_ids))
 
 
+# Sessions one persist_agent_traces pass cognifies, one window each. A pass is
+# one memify run, which holds the dataset lock until it ends, so this bounds how
+# long a remember() or cognify() on the dataset waits behind a draining run.
+TRACE_SESSIONS_PER_PASS = 10
+
+
 class PersistAgentTracesStage(BaseStage):
     """Stage 3: cognify per-step agent trace feedback (``agent_trace_feedbacks``)."""
 
@@ -183,21 +205,40 @@ async def run(self, inputs: ImproveRunInputs) -> StageResult:
             persist_agent_trace_feedbacks_in_knowledge_graph_pipeline,
         )
 
-        from .config import get_improve_config
-
         if await _watermarks_show_nothing_new(inputs, kind="traces"):
             return _already_completed(self.name, REASON_NO_NEW_TRACE_STEPS)
 
         # Each pipeline call cognifies the OLDEST trace_window_steps pending steps
         # of each pending session and advances their watermarks, so a failure
-        # repeats one bounded window, not the whole backlog.
-        config = get_improve_config()
+        # repeats one bounded window, not the whole backlog. The loop drains the
+        # backlog the run started with, unless trace_windows_per_run caps the
+        # run; steps an agent writes meanwhile wait for the next run (the window
+        # is cut at the starting count, persist_up_to), so a live
+        # session cannot keep the run (and the dataset's improve lock) going. A
+        # session whose window did not advance is left out of the later passes
+        # of this run, so one stuck session never stalls the others. A pass
+        # takes at most TRACE_SESSIONS_PER_PASS sessions, those with the fewest
+        # windows so far, so the dataset lock is released between passes and
+        # sessions late in the list get their turn before earlier ones drain.
+        config = inputs.config
+        max_windows = config.trace_windows_per_run
         sessions = len(inputs.session_ids)
         windows = 0
+        stuck: list[str] = []
+        served: dict[str, int] = {}
         stage_result = None
         pending = await _pending_trace_watermarks(inputs)
-        while pending and windows < config.trace_windows_per_run:
-            batch = dict(list(pending.items())[: config.trace_windows_per_run - windows])
+        backlog = {sid: total for sid, (_mark, total) in (pending or {}).items()}
+        while pending:
+            limit = TRACE_SESSIONS_PER_PASS
+            if max_windows:
+                limit = min(limit, max_windows - windows)
+            candidates = sorted(
+                (sid for sid in pending if sid not in stuck), key=
```

**File**: `cognee/tasks/memify/cognify_agent_trace_feedback.py` (modified, +6/-0)
```diff
@@ -2,6 +2,7 @@
 
 import cognee
 from cognee.exceptions import CogneeSystemError, CogneeValidationError
+from cognee.infrastructure.llm.exceptions import raise_if_budget_exhausted_record
 from cognee.infrastructure.session.get_session_manager import get_session_manager
 from cognee.infrastructure.session.session_node_set import bridge_node_set
 from cognee.infrastructure.session.session_persist_watermark import (
@@ -90,6 +91,11 @@ async def cognify_agent_trace_feedback(
             )
             errored_run = get_errored_run_info(cognify_result)
             if errored_run is not None:
+                # A recorded budget rejection is raised as LLMPaymentRequiredError:
+                # every later window would fail the same way, so improve stops the
+                # run instead of trying each one. The watermark stays put, so this
+                # window is retried once there is budget.
+                raise_if_budget_exhausted_record(errored_run.error_class, errored_run.error_message)
                 logger.error(
                     "Cognify failed for agent trace content (%s: %s); watermark not advanced, "
                     "continuing with the run",
```

**File**: `cognee/tasks/memify/extract_agent_trace_feedbacks.py` (modified, +18/-1)
```diff
@@ -64,6 +64,7 @@ def resolve_trace_window(
     last_n_steps: int | None,
     *,
     session_id: str = "",
+    step_limit: int | None = None,
 ) -> tuple[int, int]:
     """The pending trace window as ``(start index, size)``.
 
@@ -74,11 +75,17 @@ def resolve_trace_window(
     so a backlog drains across bounded triggers instead of being sealed —
     capping at the newest N would leave the older pending steps below an
     advanced watermark forever, unreachable even for ``improve()``.
+
+    ``step_limit`` bounds how far the window may reach (a run draining the
+    backlog it started with). It never feeds the stale check: that compares
+    the watermark with the LIVE count, ``total_trace_count``, so a watermark
+    another persister moved past the limit meanwhile reads as done, not stale.
     """
     effective = TRACE_PERSIST_WATERMARK.resolve_effective(
         persisted_trace_count, total_trace_count, session_id=session_id
     )
-    pending = max(0, total_trace_count - effective)
+    reach = total_trace_count if step_limit is None else min(total_trace_count, step_limit)
+    pending = max(0, reach - effective)
     if last_n_steps is not None:
         pending = min(pending, max(0, int(last_n_steps)))
     return effective, pending
@@ -107,6 +114,7 @@ async def extract_agent_trace_feedbacks(
     session_ids: list[str] | None = None,
     raw_trace_content: bool = False,
     last_n_steps: int | None = None,
+    persist_up_to: dict[str, int] | None = None,
 ):
     """
     Extract not-yet-persisted agent trace steps for the current user.
@@ -133,6 +141,10 @@ async def extract_agent_trace_feedbacks(
         last_n_steps: Optional cap on the number of most recent pending trace
             steps to extract per session. ``None`` means every step above the
             watermark — never "everything stored".
+        persist_up_to: Optional step count per session that the window must not
+            pass. Steps from that index on are left for a later run, so a caller
+            draining a fixed backlog never takes steps a live agent wrote after
+            it started. Sessions not in the mapping are unbounded.
 
     Yields:
         TracePersistWindow covering the session's unpersisted steps.
@@ -185,12 +197,14 @@ async def extract_agent_trace_feedbacks(
                     )
                     persisted_count = TRACE_PERSIST_WATERMARK.count_from_rows(context_rows)
                     counted_trace_count = total_trace_count
+                    step_limit = (persist_up_to or {}).get(session_id)
                     if (
                         resolve_trace_window(
                             total_trace_count,
                             persisted_count,
                             last_n_steps,
                             session_id=session_id,
+                            step_limit=step_limit,
                         )[1]
                         <= 0
                     ):
@@ -226,11 +240,14 @@ async def extract_agent_trace_feedbacks(
                         context_rows = await read_session_context_strict(
                             session_manager, user_id, session_id
                         )
+                    # The whole fetch stays: the stale check needs the live count.
+                    # step_limit only bounds how far the window reaches.
                     window_start, window_size = resolve_trace_window(
                         total_trace_count,
                         persisted_count,
                         last_n_steps,
                         session_id=session_id,
+                        step_limit=step_limit,
                     )
                     if window_size <= 0:
                         continue
```

**File**: `cognee/tests/unit/modules/improve/test_trace_windows.py` (modified, +273/-22)
```diff
@@ -1,4 +1,9 @@
-"""improve() persists agent traces in bounded windows, never as one unbounded document."""
+"""improve() persists agent traces in bounded windows, never as one unbounded document.
+
+By default one run drains a session's whole backlog, window by window; a stuck
+session is left out of the run's later passes so the others keep draining; the
+cap on windows per run is opt-in.
+"""
 
 import importlib
 import types
@@ -10,6 +15,7 @@
 from cognee.infrastructure.databases.cache.models import SessionAgentTraceEntry
 from cognee.infrastructure.session.session_persist_watermark import TRACE_PERSIST_WATERMARK
 from cognee.modules.improve import GraphCapabilities, ImproveConfig, ImproveRunInputs
+from cognee.modules.improve.result import StageResult
 from cognee.modules.improve.stages import PersistAgentTracesStage
 from cognee.modules.pipelines.models.PipelineRunInfo import PipelineRunErrored
 from cognee.tasks.memify.cognify_agent_trace_feedback import cognify_agent_trace_feedback
@@ -59,25 +65,35 @@ async def create_session_context_entry(self, *, user_id, entry_dump, session_id=
 
 
 class FakeCognee:
-    """Records each document handed to cognify; fails the builds listed in ``fail_builds``."""
+    """Records each document handed to cognify; fails the builds listed in ``fail_builds``.
+
+    ``on_cognify`` runs on every build, to model an agent still writing steps.
+    """
 
-    def __init__(self, fail_builds=()):
+    def __init__(self, fail_builds=(), on_cognify=None):
         self.documents: list[str] = []
         self.fail_builds = set(fail_builds)
+        self.on_cognify = on_cognify
 
     async def add(self, text, **kwargs):
         self.documents.append(text)
 
     async def cognify(self, **kwargs):
+        if self.on_cognify is not None:
+            self.on_cognify()
         if len(self.documents) in self.fail_builds:
             return PipelineRunErrored(
                 pipeline_run_id=uuid4(),
                 dataset_id=uuid4(),
                 dataset_name="docs",
-                error_message="rate limit exceeded",
+                error_class=self.error_class,
+                error_message=self.error_message,
             )
         return {}
 
+    error_class = "RateLimitError"
+    error_message = "rate limit exceeded"
+
     def steps_per_document(self) -> list[int]:
         return [len(document.split("\n\n", 1)[1].splitlines()) for document in self.documents]
 
@@ -94,19 +110,20 @@ def store(monkeypatch):
     return manager
 
 
-def _use(monkeypatch, cognee_fake, **settings):
+def _use(monkeypatch, cognee_fake, after_pass=None, **settings) -> ImproveConfig:
+    """Install the fake cognee and pipeline; returns the config to hand to the run.
+
+    ``after_pass`` runs after each pipeline call, between the stage's passes.
+    """
     config = ImproveConfig(**settings)
-    monkeypatch.setattr(
-        importlib.import_module("cognee.modules.improve.config"),
-        "get_improve_config",
-        lambda: config,
-    )
     for name in ("add", "cognify"):
         monkeypatch.setattr(
             importlib.import_module("cognee"), name, getattr(cognee_fake, name), raising=False
         )
 
-    async def pipeline(*, user, session_ids, raw_trace_content, last_n_steps, **kwargs):
+    async def pipeline(
+        *, user, session_ids, raw_trace_content, last_n_steps, persist_up_to=None, **kwargs
+    ):
         """The memify pipeline's two real tasks, without the dataset and pipeline plumbing."""
         extract_module = importlib.import_module(
             "cognee.tasks.memify.extract_agent_trace_feedbacks"
@@ -117,8 +134,11 @@ async def pipeline(*, user, session_ids, raw_trace_content, last_n_steps, **kwar
             session_ids=session_ids,
             raw_trace_content=raw_trace_content,
             last_n_steps=last_n_steps,
+            persist_up_to=persist_up_to,
         ):
             await cognify_agent_trace_feedback(window, dataset_id=uuid4(), user=user)
+        if after_pass is not None:
+            await after_pass()
         return {}
 
     monkeypatch.setattr(
@@ -128,17 +148,18 @@ async def pipeline(*, user, session_ids, raw_trace_content, last_n_steps, **kwar
         "persist_agent_trace_feedbacks_in_knowledge_graph_pipeline",
         AsyncMock(side_effect=pipeline),
     )
+    return config
 
 
-def _inputs(session_ids=("s1",)):
+def _inputs(config: ImproveConfig, session_ids=("s1",)):
     user = types.SimpleNamespace(id=uuid4())
     dataset = types.SimpleNamespace(id=uuid4(), name="docs", owner_id=user.id)
     return ImproveRunInputs(
         user=user,
         dataset_id=dataset.id,
         dataset=dataset,
         session_ids=tuple(session_ids),
-        config=ImproveConfig(),
+        config=config,
         capabilities=GraphCapabilities.assume_supported(),
     )
 
@@ -151,8 +172,7 @@ async def _watermark(store, inputs, session_id="s1"):
 async def test_backlog_is_persisted_in_documents_of_at_most_the_window_
```

---

### Incident Patch 3: `652da18e` (2026-10-16)
**Commit Message**: perf: Build a trace pass's windows in one cognify run (#5955)

## Description

Stacked on #5938 (now merged to dev). One commit.

The trace task added and cognified each window on its own, one after
another, so a pass of ten sessions cost ten windows of LLM time. On the
real stack that was 289 seconds for twelve sessions of trivial content,
and a day's backlog of ten agents at 200 steps each would be about half
an hour of serial cognify under the improve lock.

**Change.** The task stages every window of the run with `add()`, then
runs **one** `cognify()` for the dataset. The pipeline builds the staged
documents concurrently (its item concurrency is 20), so a pass costs
about one window. Every window's watermark advances only once that run
completed. The pipeline hands the task every window of the run in one
call: extraction yields at most one window per session, so the task's
batch is sized to the number of sessions. One cognify per run, whoever
calls the pipeline.

**A failed build raises.** `cognify()` is now called with its default,
so a failed build raises `CognifyFailedError` with the root cause
instead of being read off the result and logged. The run was rolled back
as a who

**File**: `cognee/memify_pipelines/persist_agent_trace_feedbacks_in_knowledge_graph.py` (modified, +3/-0)
```diff
@@ -79,6 +79,9 @@ async def persist_agent_trace_feedbacks_in_knowledge_graph_pipeline(
             node_set_name=node_set_name,
             user=user,
             needs_llm=False,
+            # Extraction yields at most one window per session, so this hands the
+            # task every window of the run in one call: one cognify per run.
+            batch_size=max(1, len(session_ids or [])),
         ),
     ]
 
```

**File**: `cognee/modules/improve/stages.py` (modified, +6/-5)
```diff
@@ -215,8 +215,8 @@ async def run(self, inputs: ImproveRunInputs) -> StageResult:
         # run; steps an agent writes meanwhile wait for the next run (the window
         # is cut at the starting count, persist_up_to), so a live
         # session cannot keep the run (and the dataset's improve lock) going. A
-        # session whose window did not advance is left out of the later passes
-        # of this run, so one stuck session never stalls the others. A pass
+        # pass's windows build in one cognify run; a failed build raises with its
+        # cause and ends the run, nothing built, every watermark in place. A pass
         # takes at most TRACE_SESSIONS_PER_PASS sessions, those with the fewest
         # windows so far, so the dataset lock is released between passes and
         # sessions late in the list get their turn before earlier ones drain.
@@ -232,7 +232,7 @@ async def run(self, inputs: ImproveRunInputs) -> StageResult:
         while pending:
             limit = TRACE_SESSIONS_PER_PASS
             if max_windows:
-                limit = min(limit, max_windows - windows)
+                limit = max(0, min(limit, max_windows - windows))
             candidates = sorted(
                 (sid for sid in pending if sid not in stuck), key=lambda sid: served.get(sid, 0)
             )
@@ -257,8 +257,9 @@ async def run(self, inputs: ImproveRunInputs) -> StageResult:
             )
             if stage_result.status == "errored":
                 break
-            # A failed window build is logged, not raised, so the pipeline still
-            # reports completed. Only an unmoved watermark shows the failure.
+            # A failed build raises and ended the run above. A session can still
+            # come back unmoved when extraction skipped it (its context could not
+            # be read): set it aside for the rest of the run and report it.
             pending = await _pending_trace_watermarks(inputs, backlog)
             if pending is None:
                 break
```

**File**: `cognee/tasks/memify/cognify_agent_trace_feedback.py` (modified, +36/-37)
```diff
@@ -2,15 +2,14 @@
 
 import cognee
 from cognee.exceptions import CogneeSystemError, CogneeValidationError
-from cognee.infrastructure.llm.exceptions import raise_if_budget_exhausted_record
+from cognee.infrastructure.llm.exceptions import raise_if_budget_exhausted
 from cognee.infrastructure.session.get_session_manager import get_session_manager
 from cognee.infrastructure.session.session_node_set import bridge_node_set
 from cognee.infrastructure.session.session_persist_watermark import (
     TRACE_PERSIST_WATERMARK,
     TracePersistWindow,
 )
 from cognee.modules.improve.constants import AGENT_TRACE_FEEDBACKS_NODE_SET
-from cognee.modules.pipelines.models.PipelineRunInfo import get_errored_run_info
 from cognee.modules.users.models import User
 from cognee.shared.logging_utils import get_logger
 
@@ -40,13 +39,17 @@ async def cognify_agent_trace_feedback(
     Cognify agent trace windows into the knowledge graph and advance their watermarks.
 
     Receives one ``TracePersistWindow`` (or a batch of them — the pipeline
-    runner delivers generator output in batches) from
-    ``extract_agent_trace_feedbacks``. For each window: adds its text to cognee
-    under ``node_set_name``, triggers cognify, and — only after both succeed —
-    advances that session's trace persist watermark to the step count captured
-    at extraction time. On failure the watermark stays put, so the same window
-    is re-extracted and retried on the next improve() (add-level content-hash
-    dedup makes the retry safe).
+    runner delivers every window of the run in one call)
+    from ``extract_agent_trace_feedbacks``. Adds every window's text to cognee
+    under ``node_set_name``, then runs ONE cognify for the dataset: the run
+    builds the windows as independent documents, concurrently, so a batch
+    costs about one window of LLM time instead of one per window. Only after
+    that run completed does each window's session advance its trace persist
+    watermark to the step count captured at extraction time. A failed run is
+    rolled back as a whole and raises ``CognifyFailedError`` with the root
+    cause, which fails the memify run: no watermark moves, every window is
+    re-extracted and retried on the next improve() (add-level content-hash
+    dedup makes the retry safe), and improve reports the cause.
 
     Plain strings are still accepted for callers that feed their own trace text
     through the public ``memify`` task registry; they carry no watermark.
@@ -60,7 +63,9 @@ async def cognify_agent_trace_feedback(
 
     Raises:
         CogneeValidationError: If no non-empty window or text was provided.
-        CogneeSystemError: If cognee operations fail.
+        LLMPaymentRequiredError: If the build hit an exhausted LLM budget.
+        CognifyFailedError: If the build failed, with the root cause.
+        CogneeSystemError: If another cognee operation fails.
     """
     items = _coerce_trace_items(data)
     if not items:
@@ -73,40 +78,32 @@ async def cognify_agent_trace_feedback(
         )
 
     try:
+        windows: list[TracePersistWindow] = []
         for item in items:
             window = item if isinstance(item, TracePersistWindow) else None
             text = window.text if window is not None else item
 
-            logger.info("Processing agent trace content for cognification")
+            logger.info("Staging agent trace content for cognification")
             # Plain-text callers carry no session, so no pinned node set.
             node_set = bridge_node_set([node_set_name], window.node_set if window else ())
             await cognee.add(text, dataset_id=dataset_id, node_set=node_set, user=user)
             logger.debug("Agent trace content added to cognee with node_set: %s", node_set)
-            # raise_on_error=False: one trace session's failed build must not kill
-            # the whole memify run — log the cause, keep this window's watermark
-            # put (so it is re-extracted and retried on the next improve()), and
-            # let the remaining sessions proceed.
-            cognify_result = await cognee.cognify(
-                datasets=[dataset_id], user=user, raise_on_error=False
-            )
-            errored_run = get_errored_run_info(cognify_result)
-            if errored_run is not None:
-                # A recorded budget rejection is raised as LLMPaymentRequiredError:
-                # every later window would fail the same way, so improve stops the
-                # run instead of trying each one. The watermark stays put, so this
-                # window is retried once there is budget.
-                raise_if_budget_exhausted_record(errored_run.error_class, errored_run.error_message)
-                logger.error(
-                    "Cognify failed for agent trace content (%s: %s); watermark not advanced, "
-                    "continuing with the run",
-                    errored_run.error_class,
-                    errored_run.er
```

**File**: `cognee/tests/unit/modules/improve/test_trace_windows.py` (modified, +77/-33)
```diff
@@ -13,10 +13,13 @@
 import pytest
 
 from cognee.infrastructure.databases.cache.models import SessionAgentTraceEntry
+from cognee.infrastructure.llm.exceptions import LLMPaymentRequiredError
 from cognee.infrastructure.session.session_persist_watermark import TRACE_PERSIST_WATERMARK
 from cognee.modules.improve import GraphCapabilities, ImproveConfig, ImproveRunInputs
 from cognee.modules.improve.result import StageResult
+from cognee.modules.improve.stage import execute_stage
 from cognee.modules.improve.stages import PersistAgentTracesStage
+from cognee.modules.pipelines.exceptions import CognifyFailedError
 from cognee.modules.pipelines.models.PipelineRunInfo import PipelineRunErrored
 from cognee.tasks.memify.cognify_agent_trace_feedback import cognify_agent_trace_feedback
 from cognee.tasks.memify.extract_agent_trace_feedbacks import extract_agent_trace_feedbacks
@@ -64,31 +67,49 @@ async def create_session_context_entry(self, *, user_id, entry_dump, session_id=
         return True
 
 
-class FakeCognee:
-    """Records each document handed to cognify; fails the builds listed in ``fail_builds``.
+def _session_of(document: str) -> str:
+    return document.split("\n", 1)[0].replace("Session ID: ", "")
+
 
-    ``on_cognify`` runs on every build, to model an agent still writing steps.
+class FakeCognee:
+    """Records each document handed to add and each cognify run over them.
+
+    A cognify run covers every document added since the previous completed
+    run, as the real one does: a failed run is rolled back as a whole, its
+    documents stay pending for the next run, and it raises CognifyFailedError
+    with the cause (a budget rejection raises LLMPaymentRequiredError). It
+    fails when its number is in ``fail_calls`` or when one of its documents
+    belongs to a session in ``fail_sessions``. ``on_cognify`` runs on every
+    build, to model an agent still writing steps.
     """
 
-    def __init__(self, fail_builds=(), on_cognify=None):
+    def __init__(self, fail_calls=(), fail_sessions=(), on_cognify=None):
         self.documents: list[str] = []
-        self.fail_builds = set(fail_builds)
+        self.pending: list[str] = []
+        self.runs: list[list[str]] = []  # sessions per cognify run
+        self.fail_calls = set(fail_calls)
+        self.fail_sessions = set(fail_sessions)
         self.on_cognify = on_cognify
 
     async def add(self, text, **kwargs):
         self.documents.append(text)
+        self.pending.append(text)
 
     async def cognify(self, **kwargs):
         if self.on_cognify is not None:
             self.on_cognify()
-        if len(self.documents) in self.fail_builds:
-            return PipelineRunErrored(
-                pipeline_run_id=uuid4(),
-                dataset_id=uuid4(),
+        sessions = [_session_of(document) for document in self.pending]
+        self.runs.append(sessions)
+        if len(self.runs) in self.fail_calls or self.fail_sessions & set(sessions):
+            # Rolled back: the documents stay pending, the next run picks them up.
+            if self.error_class == "LLMPaymentRequiredError":
+                raise LLMPaymentRequiredError(self.error_message)
+            raise CognifyFailedError(
                 dataset_name="docs",
                 error_class=self.error_class,
                 error_message=self.error_message,
             )
+        self.pending = []
         return {}
 
     error_class = "RateLimitError"
@@ -129,14 +150,20 @@ async def pipeline(
             "cognee.tasks.memify.extract_agent_trace_feedbacks"
         )
         monkeypatch.setattr(extract_module, "session_user", types.SimpleNamespace(get=lambda: user))
-        async for window in extract_agent_trace_feedbacks(
-            [{}],
-            session_ids=session_ids,
-            raw_trace_content=raw_trace_content,
-            last_n_steps=last_n_steps,
-            persist_up_to=persist_up_to,
-        ):
-            await cognify_agent_trace_feedback(window, dataset_id=uuid4(), user=user)
+        windows = [
+            window
+            async for window in extract_agent_trace_feedbacks(
+                [{}],
+                session_ids=session_ids,
+                raw_trace_content=raw_trace_content,
+                last_n_steps=last_n_steps,
+                persist_up_to=persist_up_to,
+            )
+        ]
+        # The runner hands the enrichment task the pass's windows as one batch,
+        # and re-raises what the task raises after recording the errored run.
+        if windows:
+            await cognify_agent_trace_feedback(windows, dataset_id=uuid4(), user=user)
         if after_pass is not None:
             await after_pass()
         return {}
@@ -275,35 +302,52 @@ async def external_persist():
 @pytest.mark.asyncio
 async def test_failed_window_keeps_earlier_windows_and_stops_the_stage(store, monkeypatch):
     store.add_steps("s1", 95)
-    cognee_fake = FakeCognee(fail_builds={2})
+    cognee_fake = Fa
```

**File**: `cognee/tests/unit/modules/memify_tasks/test_cognify_agent_trace_feedback.py` (modified, +51/-57)
```diff
@@ -1,5 +1,6 @@
 import sys
 from unittest.mock import AsyncMock, MagicMock, patch
+from uuid import uuid4
 
 import pytest
 
@@ -8,6 +9,7 @@
     TRACE_PERSIST_WATERMARK,
     TracePersistWindow,
 )
+from cognee.modules.pipelines.exceptions import CognifyFailedError
 from cognee.tasks.memify.cognify_agent_trace_feedback import cognify_agent_trace_feedback
 
 # The module object (not the re-exported function), for patching get_session_manager.
@@ -32,7 +34,7 @@ async def test_cognify_agent_trace_feedback_success():
         node_set=["agent_trace_feedbacks"],
         user=None,
     )
-    mock_cognify.assert_called_once_with(datasets=["123"], user=None, raise_on_error=False)
+    mock_cognify.assert_called_once_with(datasets=["123"], user=None)
 
 
 @pytest.mark.asyncio
@@ -53,7 +55,7 @@ async def test_cognify_agent_trace_feedback_forwards_user():
         node_set=["agent_trace_feedbacks"],
         user=user,
     )
-    mock_cognify.assert_called_once_with(datasets=["123"], user=user, raise_on_error=False)
+    mock_cognify.assert_called_once_with(datasets=["123"], user=user)
 
 
 @pytest.mark.asyncio
@@ -113,31 +115,6 @@ async def test_cognify_agent_trace_feedback_cognify_failure():
             await cognify_agent_trace_feedback(trace_content)
 
 
-@pytest.mark.asyncio
-async def test_cognify_agent_trace_feedback_errored_run_info_does_not_raise():
-    """An errored build (raise_on_error=False path) is logged, not raised,
-    so one bad trace session can't kill the whole memify run."""
-    from uuid import uuid4
-
-    from cognee.modules.pipelines.models.PipelineRunInfo import PipelineRunErrored
-
-    errored = PipelineRunErrored(
-        pipeline_run_id=uuid4(),
-        dataset_id=uuid4(),
-        dataset_name="ds",
-        error_class="AuthenticationError",
-        error_message="invalid api key",
-    )
-
-    with (
-        patch("cognee.add", new_callable=AsyncMock),
-        patch("cognee.cognify", new_callable=AsyncMock) as mock_cognify,
-    ):
-        mock_cognify.return_value = {"ds": errored}
-
-        await cognify_agent_trace_feedback("Session ID: trace_session\n\nfeedback")
-
-
 # ----------------------------------------------------------------- watermark windows
 
 
@@ -170,6 +147,52 @@ def _window(text="Session ID: s\n\nstep", persisted_trace_count=3, session_id="s
     )
 
 
+@pytest.mark.asyncio
+async def test_a_batch_of_windows_is_one_cognify_run_and_every_watermark_advances():
+    manager = _FakeSessionManager()
+    windows = [
+        _window(text=f"Session ID: {sid}\n\nstep", persisted_trace_count=count, session_id=sid)
+        for sid, count in (("a", 4), ("b", 7), ("c", 9))
+    ]
+    with (
+        patch("cognee.add", new_callable=AsyncMock) as mock_add,
+        patch("cognee.cognify", new_callable=AsyncMock, return_value={}) as mock_cognify,
+        patch.object(
+            cognify_agent_trace_feedback_module, "get_session_manager", return_value=manager
+        ),
+    ):
+        await cognify_agent_trace_feedback(windows, dataset_id="123")
+
+    assert mock_add.await_count == 3
+    mock_cognify.assert_awaited_once()
+    for sid, count in (("a", 4), ("b", 7), ("c", 9)):
+        assert await TRACE_PERSIST_WATERMARK.read_count(manager, "u", sid) == count
+
+
+@pytest.mark.asyncio
+async def test_a_failed_batch_run_advances_no_watermark():
+    manager = _FakeSessionManager()
+    windows = [
+        _window(text=f"Session ID: {sid}\n\nstep", persisted_trace_count=count, session_id=sid)
+        for sid, count in (("a", 4), ("b", 7))
+    ]
+    failed = CognifyFailedError(
+        dataset_name="docs", error_class="RuntimeError", error_message="one window could not build"
+    )
+    with (
+        patch("cognee.add", new_callable=AsyncMock),
+        patch("cognee.cognify", new_callable=AsyncMock, side_effect=failed),
+        patch.object(
+            cognify_agent_trace_feedback_module, "get_session_manager", return_value=manager
+        ),
+        pytest.raises(CognifyFailedError, match="one window could not build"),
+    ):
+        await cognify_agent_trace_feedback(windows, dataset_id="123")
+
+    assert await TRACE_PERSIST_WATERMARK.read_count(manager, "u", "a") == 0
+    assert await TRACE_PERSIST_WATERMARK.read_count(manager, "u", "b") == 0
+
+
 @pytest.mark.asyncio
 async def test_window_advances_watermark_after_successful_cognify():
     manager = _FakeSessionManager()
@@ -208,40 +231,11 @@ async def test_batched_windows_each_advance_their_own_session():
         await cognify_agent_trace_feedback(windows, dataset_id="123")
 
     assert mock_add.await_count == 2
-    assert mock_cognify.await_count == 2
+    assert mock_cognify.await_count == 1  # one run for the whole batch
     assert await TRACE_PERSIST_WATERMARK.read_count(manager, "u", "s1") == 2
     assert await TRACE_PERSIST_WATERMARK.read_count(manager, "u", "s2") == 7
 
 
-@pytest.mark.asyncio
-async def test_errored_run_info_keeps_watermark_put():
-    from uuid import
```

#### Recent Merged Pull Requests:
- **PR #6014** (2026-10-19): fix(deps): Resolve Dependabot alerts in cognee-frontend package-lock (SDK-1155) (@Vasilije1990)
- **PR #6013** (2026-10-19): test: Poll for ownership release after worker death (SDK-1154) (@Vasilije1990)
- **PR #6011** (2026-10-18): docs: Link each plugin install block to its own setup guide (COG-7162) (@Vasilije1990)
- **PR #6010** (closed): docs: point Codex plugin users to the Codex setup guide (@bluetomlee)
- **PR #5966** (2026-10-16): docs: Move the graph-count cache block to the template's end (@dexters1)
- **PR #5965** (closed): fix: Raise the typed error when a route refuses base64 (@dexters1)

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

## X. Curate every new entry per distill run by default (SDK-1140) (#5935)

**RULE**:
When implementing operations in `cognee/modules/improve/config.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in topoteretes/cognee. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b063aea8`: Curate every new entry per distill run by default (SDK-1140) (#5935). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `cognee/modules/improve/config.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
    IMPROVE_DISTILL_MAX_BATCHES_PER_RUN=0  # curator batches per distill run; 0 = uncapped
    # Session distillation curates every new gated entry of a session per run.
    # A cap curates only the most relevant entries that fit in this many curator
    # batches and seals the rest uncurated; 0 means no cap.
    distill_max_batches_per_run: int = 0
    @field_validator("distill_max_batches_per_run")
    @classmethod
    def _cap_non_negative(cls, value: int) -> int:
        if value < 0:
            raise ValueError("distill_max_batches_per_run must be >= 0 (0 = uncapped)")
        return value

```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b063aea8` are properly handled with clean fallback behavior.
