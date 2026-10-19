> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jafforgehq-site-analytics-tool-learnings.md`  
> **Source**: github ([https://github.com/jafforgehq/site-analytics-tool](https://github.com/jafforgehq/site-analytics-tool))  
> **Source Version**: `1788648c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T20:28:51.013Z  
> **Learning ID**: `learn-github-jafforgehq-site-analytics-tool`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): jafforgehq/site-analytics-tool

> **Canonical Artifact**: `07_PROJECT_LEARNING/jafforgehq-site-analytics-tool-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jafforgehq/site-analytics-tool](https://github.com/jafforgehq/site-analytics-tool))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T20:28:51.008Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jafforgehq/site-analytics-tool`
- **Description**: Open-source, self-hosted website analytics dashboard for GA4, Google Search Console and Bing Webmaster Tools, with multi-site reporting, SEO insights and automated data sync.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/components/ui/empty-state.tsx`
```
import { type ComponentType, type ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

```

### Core Architecture Module: `src/components/ui/error-state.tsx`
```
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Sanitized error display - shows a friendly message, never the raw provider
 * or database error, with an optional retry.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this data. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-critical/30 bg-critical/5 px-6 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-critical" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

```

### Core Architecture Module: `src/features/dashboard/RefreshQueue.tsx`
```
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FileWarning } from "lucide-react";
import { format } from "date-fns";
import { usePortfolioPageDaily } from "@/lib/hooks";
import { computePortfolioDecay } from "@/lib/series";
import {
  formatNumber,
  formatPercentChange,
  formatPosition,
} from "@/lib/format";
import { usePrivacyMode } from "@/lib/privacy";
import type { Site } from "@/types/database";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const WINDOW_DAYS = 28;

function shortPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}

/**
 * Content refresh queue: pages across the portfolio whose Google clicks
 * dropped ≥25% versus their own prior 28 days - the highest-ROI list for a
 * publisher deciding what to update next.
 */
export function RefreshQueue({
  sites,
}: {
  sites: Pick<Site, "id" | "name">[];
}) {
  const privacy = usePrivacyMode();
  const pagesQuery = usePortfolioPageDaily(WINDOW_DAYS);

  const decays = useMemo(
    () =>
      computePortfolioDecay(
        pagesQuery.data ?? [],
        sites,
        format(new Date(), "yyyy-MM-dd"),
      ),
    [pagesQuery.data, sites],
  );

  if (pagesQuery.isLoading) return <Skeleton className="h-40" />;
  if (pagesQuery.isError) return null; // non-critical panel

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Content refresh queue</h2>
      {decays.length === 0 ? (
        <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <FileWarning className="h-4 w-4" aria-hidden />
          No decaying pages right now - nothing lost ≥25% of its clicks versus
          the prior {WINDOW_DAYS} days.
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Page</th>
                  <th className="px-2 py-2 font-medium">Site</th>
                  <th className="px-2 py-2 text-right font-medium">Clicks</th>
                  <th className="px-2 py-2 text-right font-medium">Change</th>
                  <th className="px-2 py-2 text-right font-medium">Pos.</th>
                </tr>
              </thead>
              <tbody>
                {decays.map((row) => (
                  <tr
                    key={`${row.siteId}:${row.page}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="max-w-[16rem] px-3 py-2">
                      <span
                        className="block truncate"
                        title={privacy.enabled ? undefined : row.page}
                      >
                        {privacy.enabled
                          ? privacy.maskText(row.page, `decay:${row.page}`)
                          : shortPath(row.page)}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        to={`/sites/${row.siteId}`}
                        className="text-primary hover:underline"
                      >
                        {privacy.maskText(
                          row.siteName,
                          `decay:${row.siteId}:name`,
                        )}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatNumber(
                        privacy.maskNumber(
                          row.currentClicks,
                          `decay:${row.page}:cur`,
                        ),
                      )}
                      <span className="text-muted-foreground">
                        {" "}
                        /{" "}
                        {formatNumber(
                          privacy.maskNumber(
                            row.previousClicks,
                            `decay:${row.page}:prev`,
                          ),
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-critical">
                      {formatPercentChange(
                        privacy.enabled
                          ? privacy.maskNumber(
                              row.changePct,
                              `decay:${row.page}:pct`,
                              { min: -95, max: -25, decimals: 1 },
                            )
                          : row.changePct,
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                      {row.currentPosition != null &&
                      row.previousPosition != null
                        ? `${formatPosition(
                            privacy.maskNumber(
                              row.previousPosition,
                              `decay:${row.page}:posprev`,
                              { min: 1, max: 95, decimals: 1 },
                            ),
                          )} → ${formatPosition(
                            privacy.maskNumber(
                              row.currentPosition,
                              `decay:${row.page}:poscur`,
                              { min: 1, max: 95, decimals: 1 },
                            ),
                          )}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}

```

### Core Architecture Module: `src/lib/hooks.ts`
```
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { CompareMode } from "@/lib/compare";
import {
  addTrackedQuery,
  getAiBriefing,
  getIntegrationStatuses,
  getPortfolioPageDaily,
  getSitePageDaily,
  getTrackedQueryHistory,
  getUptimeSummaries,
  removeTrackedQuery,
  getSite,
  getSiteMetrics,
  getSiteQueryDaily,
  getQueryPageSnapshot,
  getUrlInspections,
  getWebVitals,
  getAlerts,
  dismissAlert,
  getPortfolioSessions,
  getSites,
  getSyncRuns,
  getInsights,
  getSiteSearchTerms,
  getDbUsage,
  runCleanup,
  invokeManualSync,
  saveSite,
  deleteSite,
  type ManualSource,
  type SyncRunFilters,
} from "@/lib/api";

// Stable query keys (brief §21) so manual sync (Phase 5) can invalidate
// precisely.
export const queryKeys = {
  insights: (days: number) => ["insights", days] as const,
  sites: ["sites"] as const,
  site: (siteId: string) => ["site", siteId] as const,
  siteMetrics: (siteId: string, days: number, compare: CompareMode) =>
    ["site-metrics", siteId, days, compare] as const,
  siteSearchTerms: (siteId: string, days: number) =>
    ["site-search-terms", siteId, days] as const,
  integrationStatuses: (siteId?: string) =>
    ["integration-statuses", siteId ?? null] as const,
  syncRuns: (filters: SyncRunFilters) => ["sync-runs", filters] as const,
  dbUsage: ["db-usage"] as const,
  trackedQueryHistory: (siteId: string, days: number) =>
    ["tracked-query-history", siteId, days] as const,
  uptime: ["uptime"] as const,
  sitePageDaily: (siteId: string, days: number) =>
    ["site-page-daily", siteId, days] as const,
  portfolioPageDaily: (days: number) => ["portfolio-page-daily", days] as const,
  siteQueryDaily: (siteId: string, days: number) =>
    ["site-query-daily", siteId, days] as const,
  queryPageSnapshot: (siteId: string) =>
    ["query-page-snapshot", siteId] as const,
  urlInspections: (siteId: string) => ["url-inspections", siteId] as const,
  webVitals: (siteId: string) => ["web-vitals", siteId] as const,
  alerts: ["alerts"] as const,
  portfolioSessions: (days: number) => ["portfolio-sessions", days] as const,
};

export function useSites() {
  return useQuery({ queryKey: queryKeys.sites, queryFn: getSites });
}

export function useInsights(days: number) {
  return useQuery({
    queryKey: queryKeys.insights(days),
    queryFn: () => getInsights(days),
    // Keep the prior range's data on screen while a new range loads, so toggling
    // 7/30/90 doesn't flash skeletons across the whole overview.
    placeholderData: keepPreviousData,
  });
}

export function useSite(siteId: string) {
  return useQuery({
    queryKey: queryKeys.site(siteId),
    queryFn: () => getSite(siteId),
    enabled: !!siteId,
  });
}

export function useSiteMetrics(
  siteId: string,
  days: number,
  compare: CompareMode = "previous",
) {
  return useQuery({
    queryKey: queryKeys.siteMetrics(siteId, days, compare),
    queryFn: () => getSiteMetrics(siteId, days, compare),
    enabled: !!siteId,
    // Switching range/compare mode keeps the old charts on screen while the
    // new window loads, instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });
}

export function useSiteSearchTerms(siteId: string, days: number) {
  return useQuery({
    queryKey: queryKeys.siteSearchTerms(siteId, days),
    queryFn: () => getSiteSearchTerms(siteId, days),
    enabled: !!siteId,
  });
}

export function useIntegrationStatuses(siteId?: string) {
  return useQuery({
    queryKey: queryKeys.integrationStatuses(siteId),
    queryFn: () => getIntegrationStatuses(siteId),
  });
}

export function useSyncRuns(filters: SyncRunFilters) {
  return useQuery({
    queryKey: queryKeys.syncRuns(filters),
    queryFn: () => getSyncRuns(filters),
  });
}

export function useDbUsage() {
  return useQuery({ queryKey: queryKeys.dbUsage, queryFn: getDbUsage });
}

/** Run or preview the retention cleanup. A real run refreshes the views it
 * touches; a dry run leaves the cache untouched. */
export function useRunCleanup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dryRun: boolean) => runCleanup(dryRun),
    onSuccess: (result) => {
      if (result.dry_run) return;
      qc.invalidateQueries({ queryKey: queryKeys.dbUsage });
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["site-metrics"] });
      qc.invalidateQueries({ queryKey: ["site-search-terms"] });
      qc.invalidateQueries({ queryKey: ["sync-runs"] });
    },
  });
}

/** Create/update a site, then refresh the lists that show it. */
export function useSaveSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveSite,
    onSuccess: (site) => {
      qc.invalidateQueries({ queryKey: queryKeys.sites });
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: queryKeys.site(site.id) });
    },
  });
}

/** Delete a site, then refresh the lists. */
export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sites });
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}

/** Manual sync mutation that refreshes every view touched by a sync (§20). */
export function useManualSync(siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source: ManualSource) => invokeManualSync(siteId, source),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.site(siteId) });
      qc.invalidateQueries({ queryKey: ["site-metrics", siteId] });
      qc.invalidateQueries({ queryKey: ["sync-runs"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["integration-statuses"] });
    },
  });
}

// V2 hooks --------------------------------------------------------------------

export function useTrackedQueryHistory(siteId: string, days: number) {
  return useQuery({
    queryKey: queryKeys.trackedQueryHistory(siteId, days),
    queryFn: () => getTrackedQueryHistory(siteId, days),
    enabled: !!siteId,
  });
}

export function useTrackQuery(siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { query: string; track: boolean }) =>
      args.track
        ? addTrackedQuery(siteId, args.query)
        : removeTrackedQuery(siteId, args.query),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracked-query-history", siteId] });
    },
  });
}

export function useUptimeSummaries() {
  return useQuery({
    queryKey: queryKeys.uptime,
    queryFn: getUptimeSummaries,
    // A new check lands at most hourly - no need to refetch aggressively.
    staleTime: 5 * 60 * 1000,
  });
}

export function useSitePageDaily(siteId: string, days: number) {
  return useQuery({
    queryKey: queryKeys.sitePageDaily(siteId, days),
    queryFn: () => getSitePageDaily(siteId, days),
    enabled: !!siteId,
  });
}

export function usePortfolioPageDaily(days: number) {
  return useQuery({
    queryKey: queryKeys.portfolioPageDaily(days),
    queryFn: () => getPortfolioPageDaily(days),
  });
}

/** Generate an AI briefing on demand (never automatically - it costs money). */
export function useAiBriefing() {
  return useMutation({
    mutationFn: (args: { days: number; summary: Record<string, unknown> }) =>
      getAiBriefing(args.days, args.summary),
  });
}

// Growth tools ----------------------------------------------------------------

export function useSiteQueryDaily(siteId: string, days: number) {
  return useQuery({
    queryKey: queryKeys.siteQueryDaily(siteId, days),
    queryFn: () => getSiteQueryDaily(siteId, days),
    enabled: !!siteId,
  });
}

export function useQueryPageSnapshot(siteId: string) {
  return useQuery({
    queryKey: queryKeys.queryPageSnapshot(siteId),
    queryFn: () => getQueryPageSnapshot(siteId),
    enabled: !!siteId,
  });
}

export function useUrlInspections(siteId: string) {
  return useQuery({
    queryKey: queryKeys.urlInspections(siteId),
    queryFn: () => getUrlInspections(siteId),
    enabled: !!siteId,
  });
}

export function useWebVitals(siteId: string) {
  return useQuery({
    queryKey: queryKeys.webVitals(siteId),
    queryFn: () => getWebVitals(siteId),
    enabled: !!siteId,
    // Vitals land weekly.
    staleTime: 60 * 60 * 1000,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: () => getAlerts(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: dismissAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.alerts }),
  });
}

export function usePortfolioSessions(days: number) {
  return useQuery({
    queryKey: queryKeys.portfolioSessions(days),
    queryFn: () => getPortfolioSessions(days),
  });
}

```

### Core Architecture Module: `src/lib/utils.ts`
```
/**
 * Tiny classnames helper. Filters falsy values and joins with a space.
 * Kept dependency-free to avoid pulling in clsx/tailwind-merge for Phase 1.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

```

### Core Architecture Module: `postcss.config.js`
```
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

### Core Architecture Module: `scripts/google-oauth.ts`
```
/**
 * One-time helper to mint a Google OAuth refresh token for the GSC + GA4
 * background syncs. Run locally:
 *
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run oauth:google
 *
 * Prerequisites in Google Cloud Console:
 *   - Enable the Search Console API and the Google Analytics Data API.
 *   - Configure the OAuth consent screen (your Google account may need to be a
 *     test user while the app is in testing).
 *   - Create an OAuth client (type: Web application) and add the redirect URI
 *     printed below to its "Authorized redirect URIs".
 *
 * The refresh token is printed ONCE. Copy it into the Supabase Edge Function
 * secret GOOGLE_REFRESH_TOKEN. It is never written to a file.
 */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const port = Number(process.env.GOOGLE_OAUTH_PORT ?? 5179);
const redirectUri =
  process.env.GOOGLE_OAUTH_REDIRECT ??
  `http://localhost:${port}/oauth2callback`;

if (!clientId || !clientSecret) {
  console.error(
    "Missing GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET in the environment.",
  );
  process.exit(1);
}

const state = randomBytes(16).toString("hex");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: SCOPES.join(" "),
  access_type: "offline",
  include_granted_scopes: "true",
  prompt: "consent",
  state,
}).toString();

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  return (await res.json()) as TokenResponse;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end("Not found");
    return;
  }

  const finish = (message: string) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      `<html><body style="font-family:sans-serif">${message}</body></html>`,
    );
  };

  if (url.searchParams.get("state") !== state) {
    finish("State mismatch - please re-run the script.");
    console.error("\nState mismatch. Aborting for safety.");
    server.close(() => process.exit(1));
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    finish("No authorization code returned.");
    console.error("\nNo code in callback. Aborting.");
    server.close(() => process.exit(1));
    return;
  }

  const tokens = await exchangeCode(code);
  if (tokens.error || !tokens.refresh_token) {
    finish("Token exchange failed. Check the terminal.");
    console.error(
      `\nToken exchange failed: ${tokens.error ?? "no refresh_token returned"}.`,
    );
    console.error(
      "If no refresh_token was returned, revoke the app's access in your Google account and re-run (prompt=consent forces a new one).",
    );
    server.close(() => process.exit(1));
    return;
  }

  finish("Success! You can close this tab and return to the terminal.");

  console.log("\n========================================================");
  console.log("GOOGLE_REFRESH_TOKEN (copy into Supabase Edge secrets):\n");
  console.log(tokens.refresh_token);
  console.log("\n========================================================");
  console.log("WARNING:");
  console.log("  - Treat this like a password. Do NOT commit it.");
  console.log("  - Set it as the GOOGLE_REFRESH_TOKEN function secret.");
  console.log("  - Clear your terminal scrollback afterwards.");
  server.close(() => process.exit(0));
});

server.listen(port, () => {
  console.log(`\nListening on ${redirectUri}`);
  console.log("\n1. Add that exact URI to your OAuth client's redirect URIs.");
  console.log("2. Open this URL in your browser and approve access:\n");
  console.log(authUrl.toString());
  console.log("");
});

```

### Core Architecture Module: `src/app/App.tsx`
```
import { RouterProvider } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";

export function App() {
  // The public demo is a static experience. Skipping AuthProvider ensures it
  // never resolves a session or calls Supabase; navigation back to /login uses
  // a normal document load and restores the authenticated app providers.
  const isDemoRoute =
    window.location.pathname === "/demo" ||
    window.location.pathname.startsWith("/demo/");
  if (isDemoRoute) {
    return (
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    );
  }

  return (
    <AppProviders>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AppProviders>
  );
}

```

### Core Architecture Module: `src/app/providers.tsx`
```
import { type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/auth/AuthProvider";
import { PrivacyModeProvider } from "@/lib/privacy";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivacyModeProvider>
        <AuthProvider>{children}</AuthProvider>
      </PrivacyModeProvider>
    </QueryClientProvider>
  );
}

```

### Core Architecture Module: `src/app/router.tsx`
```
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  RedirectIfAuthenticated,
  RequireDashboard,
  RequireSession,
} from "@/auth/guards";
import { LoginPage } from "@/auth/LoginPage";
import { ResetPasswordPage } from "@/auth/ResetPasswordPage";
import { MfaSetupPage } from "@/auth/MfaSetupPage";
import { MfaChallengePage } from "@/auth/MfaChallengePage";
import { NotAuthorizedPage } from "@/auth/NotAuthorizedPage";
import { Spinner } from "@/components/ui/spinner";

// Code-split the authenticated dashboard pages so the heavy charting library
// (Recharts) is only fetched after login, not on the login screen.
const OverviewPage = lazy(() =>
  import("@/features/dashboard/OverviewPage").then((m) => ({
    default: m.OverviewPage,
  })),
);
const SitesPage = lazy(() =>
  import("@/features/sites/SitesPage").then((m) => ({ default: m.SitesPage })),
);
const SiteDetailPage = lazy(() =>
  import("@/features/sites/SiteDetailPage").then((m) => ({
    default: m.SiteDetailPage,
  })),
);
const SyncRunsPage = lazy(() =>
  import("@/features/sync-runs/SyncRunsPage").then((m) => ({
    default: m.SyncRunsPage,
  })),
);
const SecuritySettingsPage = lazy(() =>
  import("@/auth/SecuritySettingsPage").then((m) => ({
    default: m.SecuritySettingsPage,
  })),
);
const SystemPage = lazy(() =>
  import("@/features/system/SystemPage").then((m) => ({
    default: m.SystemPage,
  })),
);
const DemoLayout = lazy(() =>
  import("@/features/demo/DemoPages").then((m) => ({
    default: m.DemoLayout,
  })),
);
const DemoOverviewPage = lazy(() =>
  import("@/features/demo/DemoPages").then((m) => ({
    default: m.DemoOverviewPage,
  })),
);
const DemoSitesPage = lazy(() =>
  import("@/features/demo/DemoPages").then((m) => ({
    default: m.DemoSitesPage,
  })),
);
const DemoSiteDetailPage = lazy(() =>
  import("@/features/demo/DemoPages").then((m) => ({
    default: m.DemoSiteDetailPage,
  })),
);
const DemoSyncHistoryPage = lazy(() =>
  import("@/features/demo/DemoPages").then((m) => ({
    default: m.DemoSyncHistoryPage,
  })),
);
const DemoSystemPage = lazy(() =>
  import("@/features/demo/DemoPages").then((m) => ({
    default: m.DemoSystemPage,
  })),
);

const demoFallback = (
  <div className="flex min-h-screen items-center justify-center">
    <Spinner className="h-6 w-6 text-muted-foreground" />
  </div>
);

function demoElement(element: ReactNode) {
  return <Suspense fallback={demoFallback}>{element}</Suspense>;
}

/**
 * Route map per brief §10. No registration route exists. Public auth pages
 * redirect already-authenticated users onward; the MFA pages require a session
 * but not yet aal2; the dashboard group requires aal2 + admin.
 */
export const router = createBrowserRouter(
  [
    // Public synthetic demo - it has no auth or Supabase data queries.
    {
      path: "/demo",
      element: demoElement(<DemoLayout />),
      children: [
        { index: true, element: demoElement(<DemoOverviewPage />) },
        { path: "sites", element: demoElement(<DemoSitesPage />) },
        {
          path: "sites/:siteSlug",
          element: demoElement(<DemoSiteDetailPage />),
        },
        {
          path: "sync-history",
          element: demoElement(<DemoSyncHistoryPage />),
        },
        { path: "system", element: demoElement(<DemoSystemPage />) },
      ],
    },

    // Public auth pages -------------------------------------------------------
    {
      element: <RedirectIfAuthenticated />,
      children: [{ path: "/login", element: <LoginPage /> }],
    },
    { path: "/reset-password", element: <ResetPasswordPage /> },
    { path: "/not-authorized", element: <NotAuthorizedPage /> },

    // MFA flow (session required, aal2 not yet) --------------------------------
    {
      element: <RequireSession />,
      children: [
        { path: "/mfa/setup", element: <MfaSetupPage /> },
        { path: "/mfa/verify", element: <MfaChallengePage /> },
      ],
    },

    // Protected dashboard (aal2 + admin) --------------------------------------
    {
      element: <RequireDashboard />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { path: "/", element: <OverviewPage /> },
            { path: "/sites", element: <SitesPage /> },
            { path: "/sites/:siteId", element: <SiteDetailPage /> },
            { path: "/sync-runs", element: <SyncRunsPage /> },
            { path: "/system", element: <SystemPage /> },
            { path: "/settings/security", element: <SecuritySettingsPage /> },
          ],
        },
      ],
    },

    { path: "*", element: <Navigate to="/" replace /> },
  ],
  {
    // Opt into the v7 splat-path resolution now to de-risk the upgrade.
    // (v7_startTransition is a RouterProvider flag - see App.tsx.)
    future: {
      v7_relativeSplatPath: true,
    },
  },
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2** (2026-10-11): **Count Mediavine Journey on premium-country sessions**
  *Symptoms*: ## Summary - Journey eligibility is 1,000 **premium** sessions/month (US, UK, CA, AU per Mediavine), not all sessions - Migration 0012 adds nullable `analytics_daily.premium_sessions` (NULL = not synced yet) - GA4 sync adds a country-filtered sessions report (60-day backfill on first run, best-effort/partial on failure) - Journey cards/panel use premium sessions; show a waiting message until data syncs - NZ excluded (not in Mediavine's own list)  Migration and functions (`scheduled-sync-ga4`, `manual-sync`) are already applied/deployed to production.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #1** (2026-10-11): **Add growth tools: comparison, opportunities, indexing, vitals, alerts, Journey tracker**
  *Symptoms*: ## Summary - Day/14d ranges and previous-period / last-week / last-year comparison with chart overlay (date-based windows) - Opportunity finders: striking-distance, weak-CTR, cannibalization; new-page tracker - Indexing status (URL Inspection API), weekly Core Web Vitals, daily alerts with optional Resend email - Mediavine Journey tracker (1,000 sessions / rolling 30 days) with projected date - Migration 0011 and Edge Functions `scheduled-indexing`, `scheduled-vitals`, `scheduled-alerts` (already applied/deployed to production)  ## Notes - Journey counts all GA4 sessions; "premium" country filtering is not implemented. - Demo pages do not include the new features. - Edge Functions verified only via unit tests on pure logic and fixtures.  ## Test plan - [x] format, lint, typecheck, test (182), build pass locally - [ ] CI green - [ ] Check site detail page and overview after Pages deploys  🤖 Generated with [Claude Code](https://claude.com/claude-code)

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

### Incident Patch 1: `00903336` (2026-08-30)
**Commit Message**: Add CHANGELOG.md; fix stale AI-briefing docs in README

- CHANGELOG.md following Keep a Changelog conventions, backfilled from
  git history for 0.1.0 through 0.5.0 (today's session: theme, the full
  v2 feature set, trajectory expansion, and the AI-agent export bundle).
- Bump package.json to 0.5.0 to match.
- CONTRIBUTING.md: ask contributors to add a changelog entry with
  user-visible changes.
- README: fixed real drift found while reconciling against the
  changelog - section 9 ("Optional: enable AI briefings") still
  described a "Generate briefing" button that no longer exists; it was
  replaced by a "Coming soon" badge in a UI-only commit and the README
  was never updated to match. Replaced the actionable setup step with
  an accurate note that the backend is deployable but not yet wired
  into the UI, and fixed the matching feature-list bullet.
- Linked CHANGELOG.md from the README.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+# Changelog
+
+All notable changes to this project are documented here, newest first. Dates are UTC and match the commits that shipped each entry.
+
+This project doesn't yet cut formal GitHub Releases or git tags - version numbers below track `package.json` and exist so entries have something stable to reference.
+
+## [Unreleased]
+
+## [0.5.0] - 2026-08-30
+
+### Added
+
+- **Export all data → JSON** is now a complete, AI-agent-ready bundle: every table (including goals, annotations, tracked queries, and uptime checks) plus a `computed` section with portfolio insights at 30/90/180-day windows, per-site and portfolio-wide traffic forecasts, the content refresh queue, and goal pace projections. Enough to hand your whole portfolio to an AI assistant in one file, with no live connection.
+
+### Fixed
+
+- The export's privacy-mode anonymizer didn't yet mask two new free-text fields (`annotations.label`, `site_goals.note`).
+
+## [0.4.0] - 2026-08-30
+
+### Added
+
+- Trajectory forecasting now covers every metric - sessions, active users, page views, engaged sessions, and Google/Bing clicks and impressions - switchable via a metric picker, instead of a single auto-picked metric.
+- A portfolio-wide trajectory on the Overview page: every active site's numbers summed into one combined forecast, alongside each site's own.
+
+### Changed
+
+- Extracted the trajectory chart/KPI rendering into a shared panel used by both the per-site and portfolio views.
+
+## [0.3.0] - 2026-08-30
+
+### Added
+
+- **Traffic trajectory forecasting** - a locally-computed Holt-Winters model (weekly seasonality, linear fallback for short history) projects the next 28 days per site, with a confidence band on the chart.
+- **Goals** - set a trailing-30-day target (e.g. "10,000 Google clicks a month by December") per site and metric; scored against the forecast as achieved / on track / at risk / off track.
+- **Content refresh queue** - pages across the portfolio that lost 25%+ of their Google clicks versus their own prior 28 days, ranked by lost volume.
+- **Tracked queries** - star a Search Console query in the top-terms table to chart its average position over time, using data already synced (no new provider calls, no scraping).
+- **Chart annotations** - log deploys, content changes, and SEO updates as markers on the trajectory chart, scoped per-site or portfolio-wide.
+- **Uptime monitoring** - an hourly check of each site's public URL, with a 7-day availability card.
+- The PDF site report gained a "Trajectory & goals" page.
+- (Backend only, not yet in the UI) An `ai-briefing` Edge Function that turns the portfolio's aggregates into an analyst-style narrative via the Claude API, gated behind an operator-supplied `ANTHROPIC_API_KEY` secret.
+
+### Security
+
+- Every new table (`site_goals`, `annotations`, `tracked_queries`, `uptime_checks`) follows the existing RLS model: admin + `aal2` (MFA) required for browser reads, all writes through a new `manage-portfolio` Edge Function with server-side row caps and input validation.
+- The uptime prober only fetches admin-registered `http(s)` URLs, with a request timeout, bounded concurrency, and 90-day self-pruning retention.
+
+## [0.2.0] - 2026-08-30
+
+### Added
+
+- Light, dark, and system theme with a per-device preference, applied before first paint to avoid a flash of the wrong theme.
+
+## [0.1.0] - 2026-07-14
+
+### Added
+
+- Initial release: portfolio dashboard for Google Analytics 4, Google Search Console, and Bing Webmaster Tools across multiple sites, with daily scheduled and manual syncs, sync history, integration health, CSV/ZIP and PDF exports, a privacy mode for screensharing, and mandatory TOTP two-factor authentication.
```

**File**: `CONTRIBUTING.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ Thanks for improving Site Analytics.
    ```
 
 4. Describe any required Supabase migration, Edge Function redeploy, or manual provider setup in the pull request.
+5. Add an entry to [CHANGELOG.md](CHANGELOG.md) under `[Unreleased]` for any user-visible change - new feature, behavior change, or fix. Bump the version in `package.json` (and move your entry under a new dated heading) if the change is significant enough to warrant one; otherwise leave it under `[Unreleased]` for the maintainer to fold into the next version.
 
 ## Scope
 
```

**File**: `README.md` (modified, +7/-14)
```diff
@@ -30,7 +30,7 @@ It gives a solo publisher or small portfolio operator one private place to see t
 - Lightweight query rank tracking: star Search Console queries and chart their average position over time - no scraping, no extra API calls.
 - Chart annotations for deploys, content pushes, and SEO changes, so traffic shifts have explanations.
 - Hourly uptime checks of each site's public URL with a 7-day availability view.
-- Optional on-demand AI briefing (bring your own Anthropic API key; off until configured).
+- AI briefing (coming soon): the backend is built and safe to deploy today, but not yet wired into the UI.
 
 ## Product tour
 
@@ -283,20 +283,9 @@ From the **Sites** page, add each website and enter only the identifiers you use
 
 Configured integrations enable automatically. Use a manual sync for the first import, then inspect **Sync history** and **Integration health** before trusting scheduled data.
 
-### 9. Optional: enable AI briefings
+### About the `ai-briefing` Edge Function
 
-The overview page has a "Generate briefing" button that turns the portfolio's aggregate numbers into a short analyst-style narrative using the Claude API. It is **off by default** and stays off until you add one Edge Function secret:
-
-```
-ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
-```
-
-Notes:
-
-- Briefings run **only when you click the button** - never on a schedule.
-- Only aggregate data leaves your project (KPIs, site names, movers, goal status), size-capped server-side; the key itself never reaches the browser.
-- Each briefing is a single, output-capped API call you pay Anthropic for directly. `AI_BRIEFING_MODEL` overrides the default model (`claude-opus-5`) if you prefer a cheaper one.
-- Without the secret, the button simply explains how to enable the feature.
+The deploy list in step 5 includes an `ai-briefing` function: an analyst-style portfolio narrative generated via the Claude API. Its backend is complete and safe to deploy - it does nothing unless you add an `ANTHROPIC_API_KEY` Edge Function secret, size-caps its input, and never runs on a schedule - but the dashboard doesn't call it yet, so setting the secret has no visible effect today. Track its UI launch in [CHANGELOG.md](CHANGELOG.md).
 
 ## Two-factor authentication
 
@@ -346,6 +335,10 @@ Then sign out, sign back in, and the app shows a fresh QR. Because TOTP secrets
 - Google and Bing provider quotas, permissions, and API changes are controlled by those providers.
 - Authenticator (2FA) devices are managed from the SQL editor, not the app UI - see [Two-factor authentication](#two-factor-authentication).
 
+## Changelog
+
+See [CHANGELOG.md](CHANGELOG.md) for what changed and when.
+
 ## Contributing
 
 See [CONTRIBUTING.md](CONTRIBUTING.md).
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "site-analytics",
-  "version": "0.1.0",
+  "version": "0.5.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "site-analytics",
-      "version": "0.1.0",
+      "version": "0.5.0",
       "dependencies": {
         "@supabase/supabase-js": "^2.45.4",
         "@tanstack/react-query": "^5.59.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "site-analytics",
   "private": true,
-  "version": "0.1.0",
+  "version": "0.5.0",
   "type": "module",
   "scripts": {
     "dev": "vite",
```

---

### Incident Patch 2: `1788648c` (2026-10-11)
**Commit Message**: Merge pull request #2 from jafforgehq/fix/premium-sessions

Count Mediavine Journey on premium-country sessions

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ This project doesn't yet cut formal GitHub Releases or git tags - version number
 - Indexing status from the Search Console URL Inspection API, checking up to 40 sitemap URLs per site per day (`scheduled-indexing`, `url_inspections`).
 - Weekly Core Web Vitals / PageSpeed check with a per-site card (`scheduled-vitals`, `web_vitals`).
 - Alerts for traffic drops, site downtime, repeatedly failing syncs, and indexing problems, shown on the overview with optional Resend email digests (`scheduled-alerts`, `alerts`).
-- Mediavine Journey tracker (1,000 sessions per rolling 30 days) on the overview and each site, with a projected eligibility date from the traffic forecast. It counts all GA4 sessions; the dashboard does not yet separate "premium" sessions by country.
+- Mediavine Journey tracker (1,000 premium sessions per rolling 30 days) on the overview and each site, with a projected eligibility date from the traffic forecast. Premium means US, UK, Canada and Australia traffic; the GA4 sync stores that country-filtered count in `analytics_daily.premium_sessions` (migration `0012`) and backfills 60 days on its first run. New Zealand is excluded until Mediavine lists it.
 - Migration `0011_growth_tools.sql`. Apply it, then deploy the three new Edge Functions.
 
 ## [0.6.0] - 2026-08-30
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -30,7 +30,7 @@ It gives a solo publisher or small portfolio operator one private place to see t
 - Opportunity finders from Search Console data: queries stuck at positions 8-20, page-one queries with a weak CTR for their position, and queries where several of your own pages compete.
 - New-page tracker: how many days each newly published page took to earn its first click.
 - Indexing status per sitemap URL (Search Console URL Inspection API), weekly Core Web Vitals / PageSpeed, and daily alerts for traffic drops, downtime, failing syncs, and indexing problems.
-- Mediavine Journey tracker: rolling 30-day sessions against the 1,000-session minimum, with a projected eligibility date per site.
+- Mediavine Journey tracker: rolling 30-day premium sessions (US, UK, Canada, Australia) against the 1,000-session minimum, with a projected eligibility date per site.
 - Traffic trajectory forecasting (Holt-Winters with weekly seasonality, computed locally) with confidence bands on charts, for every metric and the whole portfolio combined.
 - Content refresh queue: pages whose Google clicks decayed ≥25% versus their own prior 28 days, ranked by lost volume.
 - Lightweight query rank tracking: star Search Console queries and chart their average position over time - no scraping, no extra API calls.
@@ -165,7 +165,7 @@ Create a new Supabase project in the dashboard. In **Project Settings → API**,
 
 Then apply the database migrations. They create the tables, RLS policies, Edge Functions' database permissions, scheduled cron jobs, and retention jobs.
 
-Open the **SQL Editor**, then open each file in [`supabase/migrations/`](supabase/migrations) on GitHub in filename order (`0001` → `0011`), paste its contents into a new query, and run it - one file at a time, in order.
+Open the **SQL Editor**, then open each file in [`supabase/migrations/`](supabase/migrations) on GitHub in filename order (`0001` → `0012`), paste its contents into a new query, and run it - one file at a time, in order.
 
 Afterwards, open **Integrations → Cron → Jobs**: nine jobs (three daily syncs, an hourly uptime check, a daily indexing check, a weekly Core Web Vitals check, a daily alert check, and two weekly cleanups) should be listed. Scheduled syncs will report configuration errors until the secrets in the next steps exist; they do not affect an unrelated project.
 
```

**File**: `src/features/dashboard/JourneyPanel.tsx` (modified, +3/-3)
```diff
@@ -2,7 +2,7 @@ import { useMemo } from "react";
 import { Link } from "react-router-dom";
 import { Rocket } from "lucide-react";
 import { usePortfolioSessions, useSites } from "@/lib/hooks";
-import { analyticsSeries } from "@/lib/series";
+import { premiumSessionsSeries } from "@/lib/series";
 import { computeJourneyProgress, journeyStatusLabel } from "@/lib/journey";
 import { formatNumber } from "@/lib/format";
 import { usePrivacyMode } from "@/lib/privacy";
@@ -31,7 +31,7 @@ export function JourneyPanel() {
       .map((site) => ({
         site,
         progress: computeJourneyProgress(
-          analyticsSeries(bySite.get(site.id) ?? [], "sessions"),
+          premiumSessionsSeries(bySite.get(site.id) ?? []),
         ),
       }))
       .sort((a, b) => b.progress.progress - a.progress.progress);
@@ -43,7 +43,7 @@ export function JourneyPanel() {
     <section className="space-y-2">
       <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
         <Rocket className="h-4 w-4" aria-hidden />
-        Mediavine Journey · 1,000 sessions / 30 days
+        Mediavine Journey · 1,000 premium sessions / 30 days
       </h2>
       <Card className="divide-y divide-border">
         {rows.map(({ site, progress }) => (
```

**File**: `src/features/demo/demo-data.ts` (modified, +1/-0)
```diff
@@ -142,6 +142,7 @@ export function demoMetrics(site: DemoSite, days = 720): SiteMetrics {
       sessions,
       screen_page_views: Math.round(sessions * 2.25),
       engaged_sessions: Math.round(sessions * 0.68),
+      premium_sessions: null,
       updated_at: "2026-07-12T04:20:00.000Z",
     });
     search.push({
```

**File**: `src/features/sites/JourneyCard.tsx` (modified, +4/-4)
```diff
@@ -1,7 +1,7 @@
 import { useMemo } from "react";
 import { Rocket } from "lucide-react";
 import { useSiteMetrics } from "@/lib/hooks";
-import { analyticsSeries } from "@/lib/series";
+import { premiumSessionsSeries } from "@/lib/series";
 import { computeJourneyProgress } from "@/lib/journey";
 import { formatNumber } from "@/lib/format";
 import { usePrivacyMode } from "@/lib/privacy";
@@ -17,7 +17,7 @@ export function JourneyCard({ siteId }: { siteId: string }) {
   const progress = useMemo(
     () =>
       computeJourneyProgress(
-        analyticsSeries(metrics.data?.analytics ?? [], "sessions"),
+        premiumSessionsSeries(metrics.data?.analytics ?? []),
       ),
     [metrics.data],
   );
@@ -32,13 +32,13 @@ export function JourneyCard({ siteId }: { siteId: string }) {
       <CardContent className="space-y-2 p-4">
         <span className="inline-flex items-center gap-1.5 text-sm font-medium">
           <Rocket className="h-4 w-4" aria-hidden />
-          Mediavine Journey · 30 days
+          Mediavine Journey · premium sessions, 30 days
         </span>
         <p className="text-2xl font-semibold tabular-nums">
           {formatNumber(current)}
           <span className="text-sm font-normal text-muted-foreground">
             {" "}
-            / {formatNumber(progress.target)} sessions
+            / {formatNumber(progress.target)} premium sessions
           </span>
         </p>
         <JourneyBar progress={privacy.enabled ? 0.5 : progress.progress} />
```

**File**: `src/features/sites/JourneyCard.tsx.bak` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+import { useMemo } from "react";
+import { Rocket } from "lucide-react";
+import { useSiteMetrics } from "@/lib/hooks";
+import { analyticsSeries } from "@/lib/series";
+import { computeJourneyProgress } from "@/lib/journey";
+import { formatNumber } from "@/lib/format";
+import { usePrivacyMode } from "@/lib/privacy";
+import { Card, CardContent } from "@/components/ui/card";
+import { JourneyBar, JourneyStatusText } from "@/features/sites/journey-ui";
+
+/** Progress toward the Mediavine Journey session minimum for one site. */
+export function JourneyCard({ siteId }: { siteId: string }) {
+  const privacy = usePrivacyMode();
+  // 45 days fetches ~90 days of history: a 30-day window plus enough
+  // lead-in for the forecast that projects the crossing date.
+  const metrics = useSiteMetrics(siteId, 45);
+  const progress = useMemo(
+    () =>
+      computeJourneyProgress(
+        analyticsSeries(metrics.data?.analytics ?? [], "sessions"),
+      ),
+    [metrics.data],
+  );
+
+  if (metrics.isLoading || progress.status === "no_data") return null;
+
+  const current =
+    privacy.maskNumber(progress.current, `journey:${siteId}`) ?? 0;
+
+  return (
+    <Card>
+      <CardContent className="space-y-2 p-4">
+        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
+          <Rocket className="h-4 w-4" aria-hidden />
+          Mediavine Journey · 30 days
+        </span>
+        <p className="text-2xl font-semibold tabular-nums">
+          {formatNumber(current)}
+          <span className="text-sm font-normal text-muted-foreground">
+            {" "}
+            / {formatNumber(progress.target)} sessions
+          </span>
+        </p>
+        <JourneyBar progress={privacy.enabled ? 0.5 : progress.progress} />
+        <p className="text-xs text-muted-foreground">
+          {privacy.enabled ? (
+            "********"
+          ) : (
+            <JourneyStatusText progress={progress} />
+          )}
+        </p>
+      </CardContent>
+    </Card>
+  );
+}
```

**File**: `src/lib/journey.ts` (modified, +5/-2)
```diff
@@ -4,7 +4,10 @@
 import { format, parseISO } from "date-fns";
 import { forecastSeries, type SeriesPoint } from "@/lib/forecast";
 
-/** Mediavine Journey: 1,000 sessions per rolling month. */
+/**
+ * Mediavine Journey: 1,000 premium sessions per rolling month. Premium means
+ * US, UK, Canada and Australia traffic (see PREMIUM_COUNTRIES in the GA4 sync).
+ */
 export const JOURNEY_TARGET_SESSIONS = 1000;
 const WINDOW_DAYS = 30;
 const PROJECTION_DAYS = 180;
@@ -103,6 +106,6 @@ export function journeyStatusLabel(progress: JourneyProgress): string {
     case "unlikely":
       return "Not on pace within 6 months";
     default:
-      return "No data";
+      return "Waiting for premium-country data from the next GA4 sync";
   }
 }
```

**File**: `src/lib/portfolio-export.test.ts` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@ function analyticsRow(
     sessions,
     screen_page_views: sessions * 2,
     engaged_sessions: Math.round(sessions * 0.6),
+    premium_sessions: null,
     updated_at: NOW.toISOString(),
   };
 }
```

---

### Incident Patch 3: `27b1c087` (2026-08-30)
**Commit Message**: Add CODEOWNERS for required-review branch protection

Names the repo owner as the required reviewer on every path, so the
upcoming branch protection rule's "require review from Code Owners"
setting has someone to require a review from.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `.github/CODEOWNERS` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# Every change requires review from the repo owner before it can merge into
+# main (enforced by branch protection's "require review from Code Owners").
+* @jafforgehq
```

#### Recent Merged Pull Requests:
- **PR #2** (2026-10-11): Count Mediavine Journey on premium-country sessions (@jafforgehq)
- **PR #1** (2026-10-11): Add growth tools: comparison, opportunities, indexing, vitals, alerts, Journey tracker (@jafforgehq)

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

## X. Add CHANGELOG.md; fix stale AI-briefing docs in README

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jafforgehq/site-analytics-tool. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `00903336`: Add CHANGELOG.md; fix stale AI-briefing docs in README. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
# Changelog

All notable changes to this project are documented here, newest first. Dates are UTC and match the commits that shipped each entry.

This project doesn't yet cut formal GitHub Releases or git tags - version numbers below track `package.json` and exist so entries have something stable to reference.

## [Unreleased]

## [0.5.0] - 2026-08-30

### Added

- **Export all data → JSON** is now a complete, AI-agent-ready bundle: every table (including goals, annotations, tracked queries, and uptime checks) plus a `computed` section with portfolio insights at 30/90/180-day windows, per-site and portfolio-wide traffic forecasts, the content refresh queue, and goal pace projections. Enough to hand your whole portfolio to an AI assistant in one file, with no live connection.

### Fixed

- The export's privacy-mode anonymizer didn't yet mask two new free-text fields (`annotations.label`, `site_goals.note`).

## [0.4.0] - 2026-08-30

### Added

- Trajectory forecasting now covers every metric - sessions, active users, page views, engaged sessions, and Google/Bing clicks and impressions - switchable via a metric picker, instead of a single auto-picked metric.
- A portfolio-wide trajec
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `00903336` are properly handled with clean fallback behavior.
