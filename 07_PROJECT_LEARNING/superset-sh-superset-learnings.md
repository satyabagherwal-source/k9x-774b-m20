# Forensic Learning Record (Deep Inspection): superset-sh/superset

> **Canonical Artifact**: `07_PROJECT_LEARNING/superset-sh-superset-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/superset-sh/superset](https://github.com/superset-sh/superset))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:51:31.470Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `superset-sh/superset`
- **Description**: Superset is an agentic IDE to orchestrate 100+ coding agents in parallel. Run any agent with your own subscription.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 14907 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/admin/src/app/(dashboard)/growth/components/SearchEnginesTile/SearchEnginesTile.tsx`
```
"use client";

import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/react";

import { useGrowthRange } from "../../providers/GrowthRangeProvider";
import { WeeklyTile } from "../WeeklyTile";

const STALE_TIME_MS = 10 * 60 * 1000;

export function SearchEnginesTile() {
	const { t } = useLingui();
	const trpc = useTRPC();
	const { weeks } = useGrowthRange();
	const query = useQuery(
		trpc.growth.searchEngines.queryOptions(
			{ weeks },
			{ staleTime: STALE_TIME_MS },
		),
	);
	const series = (query.data?.series ?? []).map((s) => ({
		...s,
		label: s.key === "Other" ? t({ message: "Other" }) : s.key,
	}));

	return (
		<WeeklyTile
			title={t({ message: "Organic search by engine" })}
			description={t({
				message:
					"Weekly visitors arriving from a search results page. Search Console below says which queries they typed.",
			})}
			weeks={query.data?.weeks ?? []}
			series={series}
			query={query.data?.query}
			stacked
			isLoading={query.isLoading}
			error={query.error}
			onRefresh={() => query.refetch()}
			isRefreshing={query.isFetching}
		/>
	);
}

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/growth/components/SearchEnginesTile/index.ts`
```
export { SearchEnginesTile } from "./SearchEnginesTile";

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/growth/hooks/useGrowthLabels/index.ts`
```
export { useGrowthLabels } from "./useGrowthLabels";

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/growth/hooks/useGrowthLabels/useGrowthLabels.ts`
```
"use client";

import { useLingui } from "@lingui/react/macro";

// Series keys arrive from the server as stable identifiers; the labels people
// read are translated here so the router stays free of copy.
export function useGrowthLabels() {
	const { t } = useLingui();

	const channel: Record<string, string> = {
		organic_search: t({ message: "Organic search" }),
		direct: t({ message: "Direct" }),
		social: t({ message: "Social" }),
		referral: t({ message: "Referral" }),
		ai: t({ message: "AI assistants" }),
		email: t({ message: "Email" }),
		video: t({ message: "Video" }),
		paid_search: t({ message: "Paid search" }),
		other: t({ message: "Other" }),
	};

	const section: Record<string, string> = {
		home: t({ message: "Home" }),
		compare: t({ message: "Compare" }),
		docs: t({ message: "Docs" }),
		blog: t({ message: "Blog" }),
		changelog: t({ message: "Changelog" }),
		other: t({ message: "Other" }),
	};

	const labelFor = (map: Record<string, string>) => (key: string) =>
		map[key] ?? key;

	return { channel: labelFor(channel), section: labelFor(section) };
}

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/hooks/useElementWidth/index.ts`
```
export { useElementWidth } from "./useElementWidth";

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/hooks/useElementWidth/useElementWidth.ts`
```
"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

// Width of an element, kept current through ResizeObserver. Zero until the
// first measurement, so callers can hold off rendering width-dependent
// layout instead of drawing at a guessed size.
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
	const [width, setWidth] = useState(0);

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const measure = () => setWidth(element.getBoundingClientRect().width);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);

	return width;
}

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/hooks/useInsightResults/index.ts`
```
export { useInsightResults } from "./useInsightResults";

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/hooks/useInsightResults/useInsightResults.ts`
```
"use client";

import type { AdminInsightKey } from "@superset/trpc/insight-registry";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/react";

const STALE_TIME_MS = 10 * 60 * 1000;
const PENDING_POLL_MS = 3 * 1000;

// PostHog returns its cached result right away and recomputes stale insights in
// the background, so a cold insight comes back `pending` with no result yet.
// Poll until it lands instead of holding the request open for the recompute.
export function useInsightResults(insight: AdminInsightKey) {
	const trpc = useTRPC();
	return useQuery(
		trpc.analytics.getInsightResults.queryOptions(
			{ insight },
			{
				staleTime: STALE_TIME_MS,
				refetchInterval: (q) =>
					q.state.data?.pending ? PENDING_POLL_MS : false,
			},
		),
	);
}

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/hooks/useSigmaMetric/index.ts`
```
export { useSigmaMetric } from "./useSigmaMetric";

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/hooks/useSigmaMetric/useSigmaMetric.ts`
```
"use client";

import {
	type QueryKey,
	type UseMutationOptions,
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

/** Matches the server's reason for "a Sigma run is in flight". */
const COMPUTING_REASON = "computing";
const COMPUTING_POLL_MS = 10 * 1000;

type SigmaResult =
	| { available: true; dataLoadTime: string | null; dataThrough: string | null }
	| { available: false; reason: string };

// Holds the last landed result only across "computing": a refresh should not
// blank the tile, but a real failure should still surface.
export function useSigmaMetric<
	R extends SigmaResult,
	E extends { message: string },
	K extends QueryKey,
>({
	query,
	refresh,
}: {
	query: UseQueryOptions<R, E, R, K>;
	refresh: UseMutationOptions<R, E, void>;
}) {
	const queryClient = useQueryClient();
	const result = useQuery({
		...query,
		refetchInterval: (q) =>
			q.state.data && !q.state.data.available
				? q.state.data.reason === COMPUTING_REASON
					? COMPUTING_POLL_MS
					: false
				: false,
	});
	const mutation = useMutation({
		...refresh,
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: query.queryKey }),
	});

	const unavailableReason =
		result.data && !result.data.available ? result.data.reason : null;
	const isComputing = unavailableReason === COMPUTING_REASON;

	type Landed = Extract<R, { available: true }>;
	const [last, setLast] = useState<Landed | null>(null);
	if (result.data?.available && result.data !== last) {
		setLast(result.data as Landed);
	}

	return {
		data: result.data?.available || isComputing ? last : null,
		isLoading: result.isLoading,
		error: result.error,
		unavailableReason,
		isComputing,
		refresh: () => mutation.mutate(),
		isRefreshing: mutation.isPending || isComputing,
	};
}

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/utils/chartAxis/chartAxis.ts`
```
import { formatDate } from "@superset/i18n/format";

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
const MULTI_MONTH_SPAN_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

interface DateAxisConfig {
	ticks?: (string | number)[];
	tickFormatter: (value: string | number) => string;
}

// Analytics dates are calendar strings with no timezone meaning ("2026-02-01"
// is February everywhere), but `new Date("2026-02-01")` parses as UTC
// midnight and formats in local time — which renders it as January in the
// Americas. Every formatter here pins to UTC so labels match the data.
export function formatDay(value: string): string {
	return formatDate(new Date(`${value.slice(0, 10)}T00:00:00Z`), {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
}

export function formatMonth(value: string): string {
	const month = value.length === 7 ? `${value}-01` : value.slice(0, 10);
	return formatDate(new Date(`${month}T00:00:00Z`), {
		month: "long",
		timeZone: "UTC",
	});
}

// Shared x-axis rule for date-valued charts: multi-month ranges label one
// tick per month ("January"); shorter ranges label "Aug 8". Non-date axes
// (percentiles etc.) pass through unchanged.
export function makeDateAxis(values: (string | number)[]): DateAxisConfig {
	const dateValues = values.filter(
		(value): value is string =>
			typeof value === "string" && ISO_DATE_PREFIX.test(value),
	);
	if (dateValues.length < 2 || dateValues.length !== values.length) {
		return { tickFormatter: (value) => String(value) };
	}

	const times = dateValues.map((value) =>
		new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime(),
	);
	const spanDays = (Math.max(...times) - Math.min(...times)) / DAY_MS;

	if (spanDays > MULTI_MONTH_SPAN_DAYS) {
		const firstOfMonth = new Map<string, string>();
		for (const value of dateValues) {
			const month = value.slice(0, 7);
			if (!firstOfMonth.has(month)) firstOfMonth.set(month, value);
		}
		return {
			ticks: [...firstOfMonth.values()],
			tickFormatter: (value) => formatMonth(String(value)),
		};
	}

	return {
		tickFormatter: (value) => formatDay(String(value)),
	};
}

```

### Core Architecture Module: `apps/admin/src/app/(dashboard)/utils/chartAxis/index.ts`
```
export { formatDay, formatMonth, makeDateAxis } from "./chartAxis";

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7758** (2026-09-23): **Every workspace crashes with workspacePages.map is not a function**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.30.2  ### What happened?  Superset 1.30.2: opening any workspace crashes in `selectMenuPages.ts:43`, called by `WorkspacePagesMenu.tsx:66`. `workspacePages` contains `{ items: [], nextCursor: null }`, but the selector calls `workspacePages.map(...)`, expecting an array.  The stack trace:  ``` Content route error caught: TypeError: workspacePages.map is not a function     at selectMenuPages (selectMenuPages.ts:43:4)     at WorkspacePagesMenu.tsx:66:4     at Object.useMemo (react-dom-client.production.js:5518:23)     at react_production.useMemo (react.production.js:514:33)     at WorkspacePagesMenu (WorkspacePagesMenu.tsx:64:40) ```  ### Steps to reproduce  1. Open workspace 2. See failure  ### Logs, screenshots, or recordings  <img width="1359" height="322" alt="Image" src="https://github.com/user-attachments/assets/ba96c739-3a9e-422e-9701-c523b4df4ebc" />
  **Post-Mortem & Fix Analysis**:
  > This looks like the server-side regression that the latest commit on `main` already fixes: 4c56a68, "fix(pages): restore page.list's bare-array contract for released clients (#7756)". Nothing needs to change in the desktop app. Once the API with that commit is deployed, 1.30.2 should stop crashing.  ## Summary  Opening any workspace in desktop 1.30.2 crashes with `TypeError: workspacePages.map is not a function` in `selectMenuPages`. The value passed in is `{ items: [], nextCursor: null }`, which is a paginated response, but the 1.30.2 code expects a plain array. The cloud API's `page.list` procedure was changed to return `{ items, nextCursor }`, and released clients still call `page.list` expecting the plain array it used to return. A client that has already shipped can't be updated from the server side, so every workspace view that renders `WorkspacePagesMenu` hits the error and the route's error screen replaces the content.  ## Affected code  **Server (cloud tRPC API):** - `packages
  > This now should be resolved if you `cmd+R`, apologies for the issue! 

- **Issue #7757** (2026-09-23): **Bug: View crashes with "workspacePages.map is not a function" when opening workspace**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.30.2 (1.30.2)  ### What happened?  Navigating to or selecting a workspace triggers a crash caught by the error boundary, rendering the main view unusable. The error message displayed is ``` This view hit an error workspacePages.map is not a function ```   ### Steps to reproduce  ### Steps to reproduce* 1. Open Superset desktop client v1.30.2 on macOS[cite: 1]. 2. Click on any existing workspace from the sidebar list (e.g., selecting a workspace item)[cite: 1]. 3. Observe the center view crashing into the error boundary displaying `workspacePages.map is not a function`.  ### Logs, screenshots, or recordings  _No response_
  **Post-Mortem & Fix Analysis**:
  > The cause looks like a server API change that broke released desktop builds, not a bug in the current client code. It should already be fixed on `main` by #7756, the latest commit (`4c56a68`). I'm writing up the findings now.  ## Summary  In desktop v1.30.2 on macOS, opening or selecting any workspace crashes the center view into the error boundary with `workspacePages.map is not a function`. The code points to a mismatch between the tRPC API and older released clients. The `page.list` procedure used to return a bare array of pages. A pagination change made it return `{ items, nextCursor }` instead. v1.30.2 still calls `page.list` and runs `.map(...)` on the result, and `.map` doesn't exist on that object. The call happens in the workspace header's Pages menu, which mounts on every workspace view, so every workspace crashes.  This is inferred from reading the code. I couldn't run anything, and I don't have the v1.30.2 source to confirm its exact call site.  ## Affected code  - **Server
  > Just got the error too :( 
  > Same crash issue in v1.30.1

- **Issue #7755** (2026-09-23): **workspaces stopped working**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.30.2  ### What happened?  workspaces stopped working - hitting "workspacePages.map is not a function" when opening any workspace   any idea why? :)  ### Steps to reproduce  1. Open any workspace  ### Logs, screenshots, or recordings  <img width="698" height="439" alt="Image" src="https://github.com/user-attachments/assets/94d48c00-7f68-4d58-857b-8ee92032d2da" />
  **Post-Mortem & Fix Analysis**:
  > **Summary**  On desktop v1.30.2 (macOS), opening any workspace crashes with `workspacePages.map is not a function`. The most likely cause is a mismatch between the installed desktop app and the cloud API. The latest commit on `main`, 03af397 ("perf(pages): paginate page.list…", #7726), changed what the `page.list` tRPC procedure returns: it used to return an array of pages and now returns an object, `{ items, nextCursor }`. Older desktop builds still treat the response as an array. The crash happens in the workspace header's Pages menu, which renders whenever a workspace opens, so every workspace is affected.  **Affected code**  - Server: `packages/trpc/src/router/page/page.ts:296-455`. `page.list` now ends with `return { items, nextCursor };` (`page.ts:454`). - Desktop code on `main`, already updated for the new shape:   - `apps/desktop/src/renderer/routes/_authenticated/_dashboard/hooks/usePagesList/usePagesList.ts:17-60` uses `useInfiniteQuery`, reads `lastPage.nextCursor`, and buil
  > +1 cannot use the app right now
  > It's back

- **Issue #7706** (2026-09-25): **Long session names overflow outside the session hover card**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.30.0  ### What happened?  When hovering over a session with a very long name, the session name overflows the hover card instead of staying within its bounds. The text extends into the surrounding UI and can overlap other elements.  ### Steps to reproduce  1. Create or open a session with a very long name. 2. Hover over the session. 3. Observe the session name in the hover card. 4. The text extends beyond the card boundaries.  ### Logs, screenshots, or recordings  <img width="732" height="179" alt="Long session name overflowing outside the hover card" src="https://github.com/user-attachments/assets/ef9f470a-b8dd-40d5-9dfa-731669a1e887" />  ### Expected behavior  The session name should remain within the hover card boundaries. For long names, the UI could either:  - Wrap the text onto multiple lines, or - Truncate it with an ellipsis (`...`).  ### Actual behavior  The session name is rendered on a single line and overflows outside the hover card, causing it to overlap with the surrounding UI.  ### Additional context  This appears to happen specifically with unusually long session names. Shorter names are displayed as expected.
  **Post-Mortem & Fix Analysis**:
  > ## Summary  Hovering a session opens the sidebar hover card, and a long session name rendered at the top of that card is not constrained in any way — no wrapping, no clamping, no overflow hiding — so a name that can't fit the card's fixed 288px width spills out past the card's border and paints over whatever is behind it. Everything else in the card (branch, PR title, linked task) *is* constrained, which is why only the name misbehaves. The report is plausible and I believe I've found the exact line.  ## Affected code  The session rows in the Sessions section render `DashboardSidebarWorkspaceItem` (`DashboardSidebarSessionsSection.tsx:67`, and via `DashboardSidebarExpandedProjectContent` for the expanded list), which feeds the hover payload into the shared overlay:  - `apps/desktop/src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarHoverCardOverlay/DashboardSidebarHoverCardOverlay.tsx:79-96` — one `PopoverContent className="w-72"` rende

- **Issue #7417** (2026-09-19): **Sidebar workspace loading indicator does not appear when Codex is processing**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.28.0  ### What happened?  When Claude Code is actively processing a prompt, a loading/spinner icon appears next to the workspace name in the workspace list (sidebar) to indicate that it is in progress (WIP state).  However, when Codex is processing a task in a workspace, no loading indicator is shown next to the workspace name. It looks as if nothing is running until the generation finishes.  **Expected behavior**  The loading/WIP icon next to the workspace name should appear when Codex is running, consistent with Claude Code.  ### Steps to reproduce  1. Open a workspace configured with Codex. 2. Submit a prompt or task for Codex to process. 3. Observe the workspace item/name in the sidebar/workspace list while it is processing. 4. Notice that no loading indicator appears next to the workspace name (unlike with Claude Code, which displays a WIP spinner).  ### Logs, screenshots, or recordings  _No response_
  **Post-Mortem & Fix Analysis**:
  > ## Summary  The sidebar "WIP" spinner is not agent-aware anywhere in the UI — it renders iff the workspace's aggregated status is `"working"`, which is a pure function of the host-side terminal-agent binding's `lastEventType === "Start"`. So a missing Codex spinner is not a rendering bug; it means no `Start` event is live on the binding for that terminal while Codex works. Comparing Claude's and Codex's registered hook sets shows a real asymmetry that explains this: Claude re-asserts `Start` on **every tool call**, while Codex emits `Start` essentially **once per turn** (at prompt submit) — so for Codex, a single lost or overwritten `Start` blanks the indicator for the whole turn with nothing to self-heal it.  ## Affected code  The UI path (agent-agnostic, ruled out as the cause):  - `apps/desktop/src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarWorkspaceIcon/DashboardSidebarWorkspaceIcon.tsx:1

- **Issue #7416** (2026-09-19): **Commits list remains stale after switching agents and creating new commits**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.28.0  ### What happened?  When working across multiple agents, new commits made by an agent are not reflected in the commits list after switching to or continuing the session with another agent. The commits view continues to display a stale commit history instead of automatically refreshing or syncing with the latest repository state.  Expected behavior: The commit history should refresh automatically or reflect the latest HEAD/commits whenever an agent creates new commits, even when continuing across different agents.  ### Steps to reproduce  1. Open a workspace and start a session with an agent. 2. Have the agent create one or more commits (or let another agent make new commits on the branch). 3. Continue the workflow with another agent via the "Continue with another agent" option 4. Make additional commits using the new agent. 5. Inspect the commits list in the UI. 6. Observe that the list remains stale and does not show the newly created commits.  ### Logs, screenshots, or recordings  _No response_
  **Post-Mortem & Fix Analysis**:
  > ## Summary  The report is plausible and I can point at a concrete gap in the desktop renderer. New commits made *outside* the app's own commit button — i.e. by an agent in a terminal, which is exactly what the "have the agent commit / continue with another agent / commit again" flow does — do refresh the changed-files list and status badge, but not the commits list. The server side is fine (`git.listCommits` shells out to `git log` on every call with no caching), and the host-side `git:changed` event does fire on an agent commit. The renderer just never invalidates the `git.listCommits` query when that event arrives, so the cached commit list sits there until something unrelated happens to refetch it. Switching agents is incidental to the cause — it's a reliable way to generate commits from outside the UI while the app window never loses focus.  ## Affected code  - `apps/desktop/src/renderer/hooks/host-service/useGitStatus/useGitStatus.ts:65-87` — the single owner of the `git:changed` 

- **Issue #7415** (2026-09-11): **Language setting reverts to OS default after reload (CMD+R)**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.28.0  ### What happened?  When the application language is manually set to English, reloading the app via the CMD+R shortcut causes it to forget this preference. The UI reverts to the operating system's default language instead of remaining in English. The language setting should persist across app reloads.  ### Steps to reproduce  1. Open the app and change the language setting to English. 2. Press CMD+R to reload the application. 3. Observe that the application language has reverted to the OS default language.  ### Logs, screenshots, or recordings  _No response_
  **Post-Mortem & Fix Analysis**:
  > ## Summary  The report is that an explicit **Language = English** choice survives in the running app but is gone after `CMD+R`, with the UI falling back to the macOS system language. I could not find a code path that *deletes* the stored setting, and the local persistence itself looks sound (`settings.language` column, written by `setLanguage`, read by `getLanguage`). What I did find is that the renderer has exactly **one** way to end up in the OS language, and it is reached whenever the `getLanguage` IPC query yields no data *without* being pending — most plausibly an errored query right after `webContents.reload()`. A cold start can't hit it (the main process resolves the locale itself), which matches the report being specific to `CMD+R`.  ## Affected code  - `apps/desktop/src/renderer/components/LanguageAwareI18nProvider/LanguageAwareI18nProvider.tsx:12-20` — the only locale source for the renderer. - `packages/i18n/src/react.tsx:57-71` — `initI18nAsync(locale ?? inferLocale())`. - 

- **Issue #7414** (2026-09-11): **Language setting reverts to OS default after reload (CMD+R)**
  *Symptoms*: ### Where did this happen?  Desktop app (macOS)  ### Version  1.28.0  ### What happened?  When the application language is manually set to English, reloading the app via the CMD+R shortcut causes it to forget this preference. The UI reverts to the operating system's default language instead of remaining in English. The language setting should persist across app reloads.  ### Steps to reproduce  1. Open the app and change the language setting to English. 2. Press CMD+R to reload the application. 3. Observe that the application language has reverted to the OS default language.  ### Logs, screenshots, or recordings  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report — here's what I found reading the code.  ## Summary  The app's display language lives in one place: the `settings.language` column of the desktop's local SQLite DB (`packages/local-db/src/schema/schema.ts:206`). Choosing a language and *reading it back* are two different code paths: the choice is pushed to the live renderer in memory, while a page load has to re-read it from the DB. A CMD+R reload is the first moment that read-back path runs, which is exactly why the setting looks like it applied and then "forgets" itself. So the reported behaviour is plausible, and the loss is in the read-back, not in the picker.  ## Affected code  - `apps/desktop/src/renderer/components/LanguageAwareI18nProvider/LanguageAwareI18nProvider.tsx:12-20` — the renderer gate that turns the stored setting into an active locale on every page load. - `apps/desktop/src/lib/trpc/routers/settings/index.ts:623-666` — `getLanguage` / `onLanguageChange` / `setLanguage`, plus `getSettings()` at 

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

### Incident Patch 1: `f4fb1790` (2026-10-06)
**Commit Message**: fix(plugins): stop a user's Superset MCP entry from blocking every plugin (#8189)

* fix(plugins): stop a user's Superset MCP entry from blocking every plugin

Proxied plugin entries all point at api.superset.sh, and the external
match compared hostnames only. A user who added the Superset MCP server
(as mcp-server.mdx tells them to) therefore matched every plugin, so no
plugin entry was ever written for that agent and its tools never
appeared. On the proxy host, require the same path instead.

* fix(plugins): match proxy entries by full endpoint and keep legacy Superset URL matching

- Compare a plugin proxy URL against the user's entry including the query,
  so an entry pinned to one account no longer suppresses the others.
- Apply the strict check only to /mcp/plugins/ URLs, so a user's entry on
  the legacy Superset MCP URL still covers the superset server.
- Remove getMatchingExternalServers and isPluginExternallyConfigured, which
  had no callers.
- Build test configs inline and add tests for the two-account and legacy-URL
  cases.

**File**: `packages/shared/src/plugins/index.test.ts` (modified, +65/-1)
```diff
@@ -1,5 +1,9 @@
 import { describe, expect, test } from "bun:test";
-import { getPluginByName, PLUGIN_CATALOG } from "./index";
+import {
+	getPluginByName,
+	isServerSatisfiedExternally,
+	PLUGIN_CATALOG,
+} from "./index";
 import { FIRST_PARTY_MANIFESTS } from "./manifests.generated";
 
 describe("PLUGIN_CATALOG", () => {
@@ -23,3 +27,63 @@ describe("PLUGIN_CATALOG", () => {
 		expect(names).toEqual([...new Set(names)]);
 	});
 });
+
+describe("isServerSatisfiedExternally", () => {
+	const proxy = "https://api.superset.sh/mcp/plugins/superset/linear";
+	const linear = { type: "http", url: proxy } as const;
+
+	test("a user's Superset MCP entry does not satisfy a proxied plugin", () => {
+		expect(
+			isServerSatisfiedExternally("linear", linear, [
+				{ name: "superset", url: "https://api.superset.sh/mcp" },
+			]),
+		).toBe(false);
+	});
+
+	test("an entry for the same proxy path satisfies it", () => {
+		expect(
+			isServerSatisfiedExternally("linear", linear, [
+				{ name: "my-linear", url: `${proxy}/` },
+			]),
+		).toBe(true);
+	});
+
+	test("an entry pinned to one account satisfies only that account", () => {
+		const external = [
+			{ name: "my-linear", url: `${proxy}?connection=conn-work` },
+		];
+		const pinned = (connection: string) =>
+			({ type: "http", url: `${proxy}?connection=${connection}` }) as const;
+		expect(
+			isServerSatisfiedExternally("linear-work", pinned("conn-work"), external),
+		).toBe(true);
+		expect(
+			isServerSatisfiedExternally("linear-side", pinned("conn-side"), external),
+		).toBe(false);
+	});
+
+	test("a legacy Superset MCP URL still satisfies the superset server", () => {
+		expect(
+			isServerSatisfiedExternally(
+				"superset",
+				{ type: "http", url: "https://api.superset.sh/mcp" },
+				[
+					{
+						name: "superset-mcp",
+						url: "https://api.superset.sh/api/v2/agent/mcp",
+					},
+				],
+			),
+		).toBe(true);
+	});
+
+	test("a vendor URL still matches by hostname", () => {
+		expect(
+			isServerSatisfiedExternally(
+				"playwright",
+				{ type: "http", url: "https://mcp.example.com/mcp" },
+				[{ name: "pw", url: "https://mcp.example.com/sse" }],
+			),
+		).toBe(true);
+	});
+});
```

**File**: `packages/shared/src/plugins/index.ts` (modified, +22/-25)
```diff
@@ -139,16 +139,33 @@ function packageFromArgs(args: readonly string[] | undefined): string | null {
 	return null;
 }
 
+function isPluginProxyUrl(value: string): boolean {
+	return value.startsWith(`${SUPERSET_API_URL}/mcp/plugins/`);
+}
+
+function sameEndpoint(a: string, b: string): boolean {
+	try {
+		const [x, y] = [new URL(a), new URL(b)];
+		const path = (url: URL) => url.pathname.replace(/\/+$/, "");
+		return x.host === y.host && path(x) === path(y) && x.search === y.search;
+	} catch {
+		return false;
+	}
+}
+
 function externalMatchesConfig(
 	server: ExternalMcpServer,
 	catalogName: string,
 	config: PluginMcpServerConfig,
 ): boolean {
 	if (server.name === catalogName) return true;
 	if ("url" in config && server.url) {
-		const catalogHost = urlHost(config.url);
-		if (catalogHost !== null && catalogHost === urlHost(server.url)) {
-			return true;
+		if (isPluginProxyUrl(config.url)) {
+			if (sameEndpoint(config.url, server.url)) return true;
+		} else {
+			const catalogHost = urlHost(config.url);
+			if (catalogHost !== null && catalogHost === urlHost(server.url))
+				return true;
 		}
 	}
 	if ("command" in config) {
@@ -163,7 +180,8 @@ function externalMatchesConfig(
 
 /**
  * Whether one catalog server is already covered by an entry the user wrote
- * themselves — matched by name, remote URL hostname, or the npm package a
+ * themselves — matched by name, remote URL hostname (the full endpoint for a
+ * plugin proxy URL, which all share one host), or the npm package a
  * stdio server runs (people name servers freely, e.g. "linear-server").
  * The materializer skips satisfied servers so installing never duplicates.
  */
@@ -177,27 +195,6 @@ export function isServerSatisfiedExternally(
 	);
 }
 
-/** The user's own config entries that correspond to this plugin. */
-export function getMatchingExternalServers(
-	plugin: PluginCatalogEntry,
-	external: readonly ExternalMcpServer[],
-): ExternalMcpServer[] {
-	const entries = Object.entries(plugin.mcpServers);
-	return external.filter((server) =>
-		entries.some(([name, config]) =>
-			externalMatchesConfig(server, name, config),
-		),
-	);
-}
-
-/** Whether the user already has any of this plugin's servers configured themselves. */
-export function isPluginExternallyConfigured(
-	plugin: PluginCatalogEntry,
-	external: readonly ExternalMcpServer[],
-): boolean {
-	return getMatchingExternalServers(plugin, external).length > 0;
-}
-
 /** What a plugin puts on your machine, for at-a-glance labeling in the UI. */
 export type PluginComponentKind = "mcp" | "cli" | "skills";
 
```

---

### Incident Patch 2: `3bf1f2ab` (2026-10-06)
**Commit Message**: fix(plugins): dev builds stop writing plugin MCP entries into agent configs (#8202)

* fix(agent-setup): dev instances write the production headersHelper

Plugin MCP entries go into the user's shared ~/.claude.json and
~/.codex/config.toml, and their URL is always production's API. A dev
instance wrote its own ~/.superset-<workspace>/bin/superset as the
headersHelper, so a dev boot and a production boot rewrote the entry
back and forth, and while the dev path was in place the helper sent the
dev CLI's credential to the production API, which rejects it.

A dev instance (SUPERSET_ENV or NODE_ENV is "development", the same check
the hook templates use) now names the production shim at
~/.superset/bin/superset, so both write the same entry. Production keeps
resolving through SUPERSET_HOME_DIR.

* fix(plugins): dev builds stop writing plugin MCP entries into agent configs

Replaces the previous commit. Naming production's shim from a dev build
was not enough: the helper runs in the agent's environment, and an agent
in a dev terminal carries the dev SUPERSET_HOME_DIR, so the CLI still read
the dev credential.

Dev builds now leave ~/.claude.json and ~/.codex/config.toml to
production. Th

**File**: `apps/desktop/src/main/lib/plugin-installs.ts` (modified, +2/-0)
```diff
@@ -21,6 +21,7 @@ import {
 	SUPERSET_MANAGED_SKILLS,
 } from "@superset/shared/plugins";
 import log from "electron-log/main";
+import { env } from "main/env.main";
 import { resolveBundledCliPath } from "main/lib/bundled-cli";
 import { localDb } from "main/lib/local-db";
 import { createSerialQueue } from "main/lib/serial-queue";
@@ -82,6 +83,7 @@ export function syncInstalledPluginMcpServers(
 	connections?: readonly PluginConnectionRef[],
 ): void {
 	if (connections) writePluginConnections(connections);
+	if (env.NODE_ENV === "development") return;
 	syncManagedMcpServers(
 		desiredPluginMcpServers(getInstalledPlugins(), {
 			connections: connections ?? readPluginConnections(),
```

**File**: `packages/cli/src/lib/plugins/mcp-servers.ts` (modified, +2/-0)
```diff
@@ -21,6 +21,8 @@ export function syncPluginMcpServers(
 	servers: number;
 	error: string | null;
 } {
+	if (process.env.NODE_ENV === "development")
+		return { servers: 0, error: null };
 	const enabled = readEnabledPlugins();
 	// An unreadable ledger is not an empty one; syncing an empty desired set
 	// would reap every managed server.
```

**File**: `packages/host-service/src/runtime/agent-provisioning.ts` (modified, +5/-1)
```diff
@@ -68,7 +68,11 @@ export async function provisionAgentIntegrations(): Promise<void> {
 		// An unreadable ledger is not an empty one, and reconciling reaps
 		// whatever is absent from the desired set: a torn write would take the
 		// agent's managed servers with it.
-		const enabled = readEnabledPlugins();
+		const enabled =
+			process.env.NODE_ENV === "development" ||
+			process.env.SUPERSET_ENV === "development"
+				? null
+				: readEnabledPlugins();
 		const reports = enabled
 			? reconcileMcpServers(
 					desiredPluginMcpServers(enabled, {
```

---

### Incident Patch 3: `3487a61f` (2026-10-06)
**Commit Message**: fix(plugins): list Slack app cards with their title and link (#8203)

A message an app posts as a card (the GitHub app's pull request message)
has no text, so list_messages returned an empty line for it and an agent
could not tell which message belongs to which pull request. Search is not
available to a bot token, so listing is the only way to find it.

**File**: `packages/trpc/src/router/plugins/servers/slack/tools.test.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import { expect, test } from "bun:test";
+import { describeMessage } from "./tools";
+
+test("a card posted by an app lists with its title and link", () => {
+	expect(
+		describeMessage({
+			ts: "1.2",
+			bot_id: "B1",
+			text: "",
+			attachments: [
+				{
+					title: "#8195 docs(agents): assign new PRs",
+					title_link: "https://github.com/superset-sh/superset/pull/8195",
+				},
+			],
+		}),
+	).toBe(
+		"[1.2] B1: #8195 docs(agents): assign new PRs https://github.com/superset-sh/superset/pull/8195",
+	);
+});
```

**File**: `packages/trpc/src/router/plugins/servers/slack/tools.ts` (modified, +18/-2)
```diff
@@ -63,6 +63,7 @@ interface SlackMessage {
 	permalink?: string;
 	channel?: { id?: string; name?: string } | string;
 	reactions?: { name?: string; count?: number; users?: string[] }[];
+	attachments?: { title?: string; title_link?: string; fallback?: string }[];
 }
 
 interface SlackChannel {
@@ -96,8 +97,23 @@ function sender(message: SlackMessage): string {
 	return message.username ?? message.bot_id ?? message.app_id ?? "Unknown";
 }
 
-function describeMessage(message: SlackMessage): string {
-	let line = `[${message.ts}] ${sender(message)}: ${message.text ?? ""}`;
+// Apps such as GitHub post a card with no text; without this the message lists as empty.
+function attachmentText(message: SlackMessage): string {
+	return (message.attachments ?? [])
+		.map((attachment) =>
+			attachment.title
+				? [attachment.title, attachment.title_link].filter(Boolean).join(" ")
+				: (attachment.fallback ?? ""),
+		)
+		.filter(Boolean)
+		.join(" | ");
+}
+
+export function describeMessage(message: SlackMessage): string {
+	const text = [message.text, attachmentText(message)]
+		.filter(Boolean)
+		.join(" ");
+	let line = `[${message.ts}] ${sender(message)}: ${text}`;
 	if (message.reply_count && message.reply_count > 0) {
 		line += ` 💬 ${message.reply_count} ${message.reply_count === 1 ? "reply" : "replies"}`;
 	} else if (message.thread_ts && message.thread_ts !== message.ts) {
```

---

### Incident Patch 4: `7cf1d721` (2026-10-06)
**Commit Message**: fix(relay): forward HTTP to a host's chat-v3 tRPC endpoint (#8159)

* fix(relay): forward HTTP to a host's chat-v3 tRPC endpoint

The relay proxied HTTP only for /hosts/:id/trpc/*, so a client reaching a
host through the relay could open a chat stream (WebSocket paths already
pass) but could not call any chat command. Route /hosts/:id/chat-v3/trpc/*
through the same handler; the host tunnel already forwards any path.

* fix(relay): answer chat-v3 tRPC errors in the shape its client reads

Errors the relay writes itself were superjson-encoded for every tRPC path,
but the host's chat router has no transformer, so a chat client could not
read them. An auth denial on /chat-v3/trpc also came back as plain JSON
because isTrpcPath only knew /trpc.

Also reject a forwarded path that does not start with a single slash, as
the WebSocket route already does.

* test(relay): route chat-v3 tRPC through the relay in a test, run relay tests in CI

- index.test.ts sends POST and GET chat-v3 tRPC calls through the relay's
  fetch handler and checks they reach the host tunnel, that /trpc/* still
  forwards, that other HTTP host paths are refused, and that an
  unauthenticated chat call gets a plain-J

**File**: `apps/relay/bunfig.toml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+[test]
+preload = ["./test-setup.ts"]
```

**File**: `apps/relay/package.json` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 	"scripts": {
 		"dev": "wrangler dev",
 		"deploy": "wrangler deploy",
+		"test": "bun test --isolate",
 		"typecheck": "tsc --noEmit --emitDeclarationOnly false"
 	},
 	"dependencies": {
```

**File**: `apps/relay/src/index.test.ts` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+/// <reference types="bun" />
+import { afterAll, beforeEach, expect, test } from "bun:test";
+import relay from "./index";
+
+type ProxiedRequest = { method: string; pathWithQuery: string };
+
+const proxied: ProxiedRequest[] = [];
+
+const tunnel = {
+	setName: async () => {},
+	proxyHttp: async (_caller: unknown, request: ProxiedRequest) => {
+		proxied.push({
+			method: request.method,
+			pathWithQuery: request.pathWithQuery,
+		});
+		return {
+			ok: true,
+			status: 200,
+			headers: { "content-type": "application/json" },
+			body: new TextEncoder().encode("{}"),
+		};
+	},
+};
+
+const keyPair = await crypto.subtle.generateKey(
+	{
+		name: "RSASSA-PKCS1-v1_5",
+		modulusLength: 2048,
+		publicExponent: new Uint8Array([1, 0, 1]),
+		hash: "SHA-256",
+	},
+	true,
+	["sign", "verify"],
+);
+const jwk = {
+	...(await crypto.subtle.exportKey("jwk", keyPair.publicKey)),
+	kid: "test",
+	alg: "RS256",
+};
+const jwks = Bun.serve({
+	port: 0,
+	fetch: () => Response.json({ keys: [jwk] }),
+});
+const apiUrl = `http://localhost:${jwks.port}`;
+
+afterAll(() => jwks.stop(true));
+
+beforeEach(() => {
+	proxied.length = 0;
+});
+
+const hostId = "org-1:machine-1";
+const env = {
+	NEXT_PUBLIC_API_URL: apiUrl,
+	HostTunnel: {
+		idFromName: (name: string) => name,
+		get: () => tunnel,
+	},
+	PLACEMENT: {
+		get: async () => ({
+			name: `${hostId}#1`,
+			generation: 1,
+			continent: "EU",
+			colo: "AMS",
+		}),
+	},
+};
+const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
+
+function base64url(data: string | ArrayBuffer): string {
+	return Buffer.from(
+		typeof data === "string" ? data : new Uint8Array(data),
+	).toString("base64url");
+}
+
+async function token(): Promise<string> {
+	const header = base64url(JSON.stringify({ alg: "RS256", kid: "test" }));
+	const payload = base64url(
+		JSON.stringify({
+			sub: "user-1",
+			organizationIds: ["org-1"],
+			iss: apiUrl,
+			aud: apiUrl,
+			exp: Math.floor(Date.now() / 1000) + 300,
+		}),
+	);
+	const signature = await crypto.subtle.sign(
+		"RSASSA-PKCS1-v1_5",
+		keyPair.privateKey,
+		new TextEncoder().encode(`${header}.${payload}`),
+	);
+	return `${header}.${payload}.${base64url(signature)}`;
+}
+
+const handler = relay as unknown as {
+	fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response>;
+};
+
+async function call(
+	path: string,
+	init: Omit<RequestInit, "headers"> & {
+		authorized?: boolean;
+		host?: string;
+		headers?: Record<string, string>;
+	} = {},
+) {
+	const { authorized = true, host = hostId, ...requestInit } = init;
+	const headers = authorized
+		? { ...requestInit.headers, Authorization: `Bearer ${await token()}` }
+		: requestInit.headers;
+	return handler.fetch(
+		new Request(`https://relay.test/hosts/${host}${path}`, {
+			...requestInit,
+			headers,
+		}),
+		env,
+		ctx,
+	);
+}
+
+test("forwards chat-v3 tRPC POST and GET calls to the host", async () => {
+	const post = await call("/chat-v3/trpc/prompt", {
+		method: "POST",
+		body: JSON.stringify({ sessionId: "s1" }),
+	});
+	const get = await call("/chat-v3/trpc/listSessions?input=%7B%7D");
+
+	expect(post.status).toBe(200);
+	expect(get.status).toBe(200);
+	expect(proxied).toEqual([
+		{ method: "POST", pathWithQuery: "/chat-v3/trpc/prompt" },
+		{ method: "GET", pathWithQuery: "/chat-v3/trpc/listSessions?input=%7B%7D" },
+	]);
+});
+
+test("still forwards the host tRPC router", async () => {
+	const response = await call("/trpc/workspace.list", { method: "POST" });
+
+	expect(response.status).toBe(200);
+	expect(proxied).toEqual([
+		{ method: "POST", pathWithQuery: "/trpc/workspace.list" },
+	]);
+});
+
+test("does not forward HTTP to host paths outside the tRPC routers", async () => {
+	const post = await call("/chat-v3/sessions/s1/stream", { method: "POST" });
+	const get = await call("/chat-v3/sessions/s1/stream");
+
+	expect(post.status).toBe(404);
+	expect(get.status).toBe(426);
+	expect(proxied).toEqual([]);
+});
+
+test("rejects an unauthenticated chat-v3 call with a plain-JSON tRPC error", async () => {
+	const response = await call("/chat-v3/trpc/prompt", {
+		method: "POST",
+		authorized: false,
+	});
+
+	expect(response.status).toBe(401);
+	expect(await response.json()).toEqual({
+		error: {
+			message: "Unauthorized",
+			code: -32001,
+			data: { code: "UNAUTHORIZED", httpStatus: 401 },
+		},
+	});
+	expect(proxied).toEqual([]);
+});
+
+test("rejects a stream path that a percent-encoded host id leaks into", async () => {
+	const response = await call("/chat-v3/sessions/s1/stream", {
+		host: encodeURIComponent(hostId),
+		headers: { Upgrade: "websocket" },
+	});
+
+	expect(response.status).toBe(400);
+});
```

**File**: `apps/relay/src/index.ts` (modified, +38/-9)
```diff
@@ -20,7 +20,12 @@ import {
 } from "./access";
 import { HostTunnel } from "./host-tunnel";
 import { placeHost, readPlacement } from "./placement";
-import { isTrpcPath, trpcErrorResponse } from "./trpc-error";
+import {
+	HOST_TRPC_ROUTERS,
+	type HostTrpcRouter,
+	hostTrpcRouter,
+	trpcErrorResponse,
+} from "./trpc-error";
 import type { RelayEnv } from "./types";
 
 type AppContext = {
@@ -240,11 +245,17 @@ app.get("/hosts/:hostId/_whoowns", async (c) => {
 const authMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
 	const hostId = c.req.param("hostId");
 	if (!hostId) return c.json({ error: "Missing hostId" }, 400);
+	const path = pathAfterHost(c);
+	if (path !== "" && (!path.startsWith("/") || path.startsWith("//"))) {
+		return c.json({ error: "Invalid path" }, 400);
+	}
 	const result = await authenticate(c, hostId, "reach");
 	if (isDenial(result)) {
-		if (isTrpcPath(pathAfterHost(c))) {
+		const router = hostTrpcRouter(path);
+		if (router) {
 			return trpcErrorResponse(
 				c,
+				router,
 				result.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED",
 				result.message,
 			);
@@ -259,17 +270,25 @@ const authMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
 
 app.use("/hosts/:hostId/*", authMiddleware);
 
-app.all("/hosts/:hostId/trpc/*", async (c) => {
+const proxyHostHttp = async (
+	c: Context<AppContext>,
+	router: HostTrpcRouter,
+) => {
 	const hostId = c.get("hostId");
 	const url = new URL(c.req.url);
-	const path = pathAfterHost(c) || "/";
+	const path = pathAfterHost(c);
 	const query = url.search.slice(1);
 
 	const headers = buildUpstreamHeaders(c.req.raw.headers, c.get("auth").sub);
 
 	const stub = await tunnelStub(c, hostId);
 	if (!stub) {
-		return trpcErrorResponse(c, "SERVICE_UNAVAILABLE", "Host is not online");
+		return trpcErrorResponse(
+			c,
+			router,
+			"SERVICE_UNAVAILABLE",
+			"Host is not online",
+		);
 	}
 	const caller = c.get("caller");
 	const result = await stub.proxyHttp(caller, {
@@ -285,27 +304,38 @@ app.all("/hosts/:hostId/trpc/*", async (c) => {
 			);
 			return trpcErrorResponse(
 				c,
+				router,
 				refused.status === 403 ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
 				refused.message,
 			);
 		}
 		if (result.reason === "dial-failed") {
 			return trpcErrorResponse(
 				c,
+				router,
 				"BAD_GATEWAY",
 				"Host could not reach the relay",
 			);
 		}
 		const connected = await stub.isConnected(caller);
 		return connected.access === "allowed" && connected.connected
-			? trpcErrorResponse(c, "BAD_GATEWAY", "Request timed out")
-			: trpcErrorResponse(c, "SERVICE_UNAVAILABLE", "Host is not online");
+			? trpcErrorResponse(c, router, "BAD_GATEWAY", "Request timed out")
+			: trpcErrorResponse(
+					c,
+					router,
+					"SERVICE_UNAVAILABLE",
+					"Host is not online",
+				);
 	}
 	return new Response(result.body.byteLength > 0 ? result.body : null, {
 		status: result.status,
 		headers: result.headers,
 	});
-});
+};
+
+for (const router of HOST_TRPC_ROUTERS) {
+	app.all(`/hosts/:hostId${router.prefix}/*`, (c) => proxyHostHttp(c, router));
+}
 
 app.get("/hosts/:hostId/*", async (c) => {
 	if (!isWsUpgrade(c)) {
@@ -314,7 +344,6 @@ app.get("/hosts/:hostId/*", async (c) => {
 	const hostId = c.get("hostId");
 	const url = new URL(c.req.url);
 	const path = pathAfterHost(c) || "/";
-	if (path.startsWith("//")) return c.json({ error: "Invalid path" }, 400);
 	const query = url.search.slice(1);
 	const ticket = crypto.randomUUID();
 
```

**File**: `apps/relay/src/trpc-error.test.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { expect, test } from "bun:test";
+import { Hono } from "hono";
+import superjson, { type SuperJSONResult } from "superjson";
+import { hostTrpcRouter, trpcErrorResponse } from "./trpc-error";
+
+test("the main router's errors are superjson-encoded", async () => {
+	const router = hostTrpcRouter("/trpc/workspace.list");
+	if (!router) throw new Error("no router for /trpc");
+	const app = new Hono();
+	app.get("*", (c) =>
+		trpcErrorResponse(c, router, "SERVICE_UNAVAILABLE", "Host is not online"),
+	);
+	const body = (await (await app.request("/")).json()) as {
+		error: SuperJSONResult;
+	};
+	expect(superjson.deserialize(body.error)).toMatchObject({
+		message: "Host is not online",
+	});
+});
```

**File**: `apps/relay/src/trpc-error.ts` (modified, +26/-8)
```diff
@@ -25,20 +25,38 @@ const HTTP_STATUS: Record<TrpcErrorCode, ContentfulStatusCode> = {
 	BAD_GATEWAY: 502,
 };
 
-export function isTrpcPath(pathAfterHost: string): boolean {
-	return pathAfterHost.startsWith("/trpc");
+type ErrorShape = {
+	message: string;
+	code: number;
+	data: { code: TrpcErrorCode; httpStatus: ContentfulStatusCode };
+};
+
+export type HostTrpcRouter = {
+	prefix: string;
+	encode: (shape: ErrorShape) => unknown;
+};
+
+/** The host's main router uses superjson; its chat router has no transformer. */
+export const HOST_TRPC_ROUTERS: readonly HostTrpcRouter[] = [
+	{ prefix: "/trpc", encode: (shape) => superjson.serialize(shape) },
+	{ prefix: "/chat-v3/trpc", encode: (shape) => shape },
+];
+
+export function hostTrpcRouter(
+	pathAfterHost: string,
+): HostTrpcRouter | undefined {
+	return HOST_TRPC_ROUTERS.find(({ prefix }) =>
+		pathAfterHost.startsWith(`${prefix}/`),
+	);
 }
 
 export function trpcErrorResponse(
 	c: Context,
+	router: HostTrpcRouter,
 	code: TrpcErrorCode,
 	message: string,
 ) {
 	const httpStatus = HTTP_STATUS[code];
-	const error = superjson.serialize({
-		message,
-		code: RPC_CODE[code],
-		data: { code, httpStatus },
-	});
-	return c.json({ error }, httpStatus);
+	const shape = { message, code: RPC_CODE[code], data: { code, httpStatus } };
+	return c.json({ error: router.encode(shape) }, httpStatus);
 }
```

**File**: `apps/relay/test-setup.ts` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import { plugin } from "bun";
+
+plugin({
+	name: "cloudflare-workers",
+	setup(build) {
+		build.module("cloudflare:workers", () => ({
+			loader: "object",
+			exports: { DurableObject: class {}, env: {} },
+		}));
+	},
+});
```

**File**: `plans/chat-v3-pane-mount.md` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ packages/host-service/src/chat-v3/          # thin mount only; "runtime/chat/" n
   - tRPC: mount `createChatRouter(runtime, { resolveCwd })` at `POST/GET /chat-v3/trpc/*` via `@trpc/server` fetch adapter on the existing Hono app (second tRPC endpoint — the established per-domain pattern; host auth middleware applied at the route).
   - Stream: `GET /chat-v3/sessions/:id/stream?since=&deltas=` — upgrade exactly like `/acp-sessions/:id/stream` does today, wrap the socket in `createWsSink`, call `runtime.subscribe(...)`, dispose subscription on close.
 - Lifecycle: build the runtime lazily on first chat request; `runtime.dispose()` in host-service shutdown hooks.
-- Relay compatibility: both routes ride the existing tunnel as-is (buffered HTTP for tRPC, WS upgrade for the stream) — nothing new relay-side.
+- Relay compatibility: the stream rides the relay's WebSocket catch-all as-is, but the relay forwards HTTP only on routes it names, so `/hosts/:hostId/chat-v3/trpc/*` needs its own route next to `/trpc/*` (added in #8159). Relay-written errors on that path are plain JSON, because the chat router has no transformer.
 
 ## B. `packages/chat` client + react entries (~2–3 days — the unbuilt M2 half)
 
```

---

### Incident Patch 5: `1f2e6835` (2026-10-06)
**Commit Message**: chore(sandbox): pin the box CLI to a build with `workspaces sleep` (#8196)

Boxes ran superset 1.29.0, which has neither `workspaces sleep` (#8191)
nor `workspaces description set`. The asset is rebuilt from main.

**File**: `packages/sandbox/bundle/assets.json` (modified, +3/-3)
```diff
@@ -16,11 +16,11 @@
 		"version": "2.1.280"
 	},
 	"cli": {
-		"sha256": "66be5ff609582623dc943c2a6405553268c9b57d8ad215d2056cde9f746186ab",
+		"sha256": "5e49a1f3c2198662209bf97fd9ce991b6b140adece2b176710fca48482ead055",
 		"suffix": "",
-		"dest": "/usr/local/share/superset/media/superset-1.29.0",
+		"dest": "/usr/local/share/superset/media/superset-1.35.0",
 		"mode": "0755",
-		"version": "1.29.0"
+		"version": "1.35.0"
 	},
 	"codex": {
 		"sha256": "9e2d29a713b94478b240dec2f10e11324cd05fad76dc43e7c639bdf8a1337a6b",
```

---

### Incident Patch 6: `3dafdf32` (2026-10-06)
**Commit Message**: fix(skills): connect Browser Use without "Allow remote debugging?" on every action (#8192)

Agents drove the user's own browser with a one-shot CDP script per action.
In chrome://inspect toggle mode, Chromium 144+ asks the user to allow each new
connection made while no other is open, so the dialog came back every action.

The browser skill now has agents run the browser on a debug port and point
Browser Use at it with BU_CDP_URL, which never prompts:

- ask before restarting a browser that runs without the port
- Google Chrome 136+ ignores the port on its own profile, so it gets a
  separate agent profile
- Arc hides its tabs from CDP and crashes when one is opened, so skip it
- if the user declines a restart, hold one daemon connection (approve once)
- ignore upstream's chrome://inspect toggle and mac-approve steps, never
  click Allow for the user, never use a one-shot script per action
- the raw CDP snippet in SKILL.md is for in-app panes only

Verified on Aside, Comet, Dia, and Chrome with an agent profile: no dialog
across repeated Browser Use calls, checked with Cua Driver.

**File**: `plugins/superset/skills/browser/SKILL.md` (modified, +2/-1)
```diff
@@ -119,7 +119,8 @@ Keychain prompt was denied; ask them to allow it and retry.
 ## Full interaction over raw CDP
 
 For clicking, typing, scrolling, waiting on selectors, or any Playwright-class
-flow, get the pane's CDP WebSocket endpoint:
+flow, get the pane's CDP WebSocket endpoint. This pattern is for panes only;
+for the user's own browser, follow `references/browser-use.md`:
 
 ```bash
 superset browser cdp --workspace <id> --pane <paneId> --json
```

**File**: `plugins/superset/skills/browser/references/browser-use.md` (modified, +45/-10)
```diff
@@ -24,21 +24,56 @@ the offer for a delegated goal, a long multi-step flow, or a recording.
 
 3. Read the engine's own instructions before driving: `browser-use skill`
    prints the upstream skill text with the current helper reference and
-   workflow. Follow it for the details; this file covers only routing, consent,
-   and cleanup. `browser-use --doctor` diagnoses install, daemon, and
-   browser-connection problems.
+   workflow. Follow it for the details, except how to connect: ignore its
+   `chrome://inspect` toggle and `mac-approve` steps and connect as below.
+   `browser-use --doctor` diagnoses install, daemon, and browser-connection
+   problems.
 
 ## Connect to a browser (consent first)
 
-By default the CLI attaches to the user's running Chrome/Chromium over CDP,
-which is their real, signed-in profile, and if Chrome lacks remote debugging it
-prompts to enable it. Never take that path without the user's explicit consent
-for this task; "use my browser/session" from the user is consent, silence is
-not. Without it, use one of:
+Never rely on the CLI's default attach: it targets a browser in
+`chrome://inspect` toggle mode, where Chromium 144+ asks the user to "Allow
+remote debugging?" for each new connection.
+
+The user's own browser is their real, signed-in profile. Use it only with
+explicit consent for this task; "use my browser/session" is consent, silence
+is not. With consent, run it on a debug port, which never prompts, and point
+Browser Use at it with `BU_CDP_URL`. Pick one port per browser and one
+`BU_NAME`, and reuse both for every call:
+
+```bash
+curl -s http://127.0.0.1:9333/json/version || open -a "<App>" --args --remote-debugging-port=9333
+export BU_CDP_URL=http://127.0.0.1:9333 BU_NAME=<app>
+```
+
+- If the browser already runs without that port (toggle mode or plain), the
+  flag does nothing. Ask the user before you quit it
+  (`osascript -e 'quit app "<App>"'`), then run the `open` line again. Its tabs
+  return if it restores sessions.
+- Google Chrome 136+ ignores the port on its own profile. Add
+  `--user-data-dir=$HOME/.superset/browser-profiles/chrome` and open it with
+  `open -na`: a separate agent profile that runs beside the user's Chrome. The
+  user signs in there once.
+- Arc hides its tabs from CDP and crashes when a client opens one. Do not
+  drive it; use an in-app pane or another browser.
+- The flag lasts until the browser quits. After a relaunch from the Dock, ask
+  again before you restart it.
+
+If the user declines the restart, connect once and hold that connection: set
+`BU_CDP_WS=ws://127.0.0.1:<port><path>` from the two lines of
+`~/Library/Application Support/<Browser>/DevToolsActivePort`. They approve
+once, until the daemon stops. The first call waits only about 10 seconds for
+Allow, so warn them first. On "timed out during opening handshake", ask them
+to cancel the leftover dialog, then retry.
+
+Never click Allow for the user (`mac-approve`, a GUI driver): the dialog is
+their consent. Never drive their browser with a one-shot script per action
+(`node x.mjs`, a fresh `websockets.connect`): each run brings the dialog back.
+
+Without consent for their browser, use one of:
 
 - A scratch browser you launch yourself (Chromium with a throwaway
-  `--user-data-dir` and a debug port), pointed at via the `BU_CDP_URL` or
-  `BU_CDP_WS` environment variables.
+  `--user-data-dir` and a debug port), pointed at via `BU_CDP_URL`.
 - A Browser Use cloud browser: `browser-use auth login`, then
   `start_remote_daemon("<name>")` and prefix later calls with
   `BU_NAME=<name>`. Cloud browsers bill until stopped; ask before starting one
```

---

### Incident Patch 7: `f94a5781` (2026-10-05)
**Commit Message**: fix(chat): match reply text colour to the user message (#8186)

Reply text in the chat transcript was dimmed to 78% of the foreground
colour, with only bold and italic at full strength. It now uses the full
foreground colour, the same as the user message and the composer.

**File**: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/v2-workspace/$workspaceId/hooks/usePaneRegistry/components/ChatSession/components/Transcript/components/AgentMessageRow/AgentMessageRow.tsx` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ export function AgentMessageRow({
 		// reachable by keyboard regardless.
 		<div className="group/message flex flex-col gap-1">
 			<MarkdownView
-				className="text-foreground/[0.78] [&_em]:text-foreground [&_strong]:text-foreground"
+				className="text-foreground"
 				fading={fading}
 				text={paced.text}
 			/>
```

---

### Incident Patch 8: `9343d965` (2026-10-05)
**Commit Message**: fix(marketing): refresh the social preview image (#8171)

* fix(marketing): redesign the social preview image in the multi-window style

* fix(marketing): show one large app window in the social preview

* fix(marketing): use the app screenshot as the single demo in the social preview

* fix(marketing): add the "Your agent's favorite IDE" tagline to the social preview

* fix(marketing): set the social preview tagline in the site's Inter Display style

* fix(marketing): enlarge the social preview wordmark and tagline

* fix(marketing): enlarge the social preview tagline

* fix(marketing): match the social preview tagline to the wordmark height

* fix(marketing): brighten the social preview tagline

* fix(marketing): set the social preview tagline to 59px

**File**: `apps/marketing/scripts/og-image/og-image.html` (modified, +10/-27)
```diff
@@ -3,35 +3,18 @@
 <title>Superset social preview</title>
 <link rel="preconnect" href="https://fonts.googleapis.com">
 <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
-<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..600&display=block" rel="stylesheet">
+<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..600&display=block" rel="stylesheet">
 <style>
-  html,body{margin:0;background:#0a0a0a}
-  body{width:1200px;height:630px;overflow:hidden;position:relative;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-feature-settings:"cv01","ss03";color:#fff;-webkit-font-smoothing:antialiased}
-  /* Brand-orange light streaks, Raycast-style */
-  .streaks{position:absolute;inset:-200px;overflow:hidden;pointer-events:none}
-  .streak{position:absolute;top:-40%;height:180%;width:220px;transform:rotate(-34deg);filter:blur(9px);background:linear-gradient(90deg,rgba(210,86,17,0),rgba(158,64,10,.35) 18%,rgba(210,86,17,.75) 42%,rgba(232,128,74,.95) 50%,rgba(210,86,17,.75) 58%,rgba(158,64,10,.35) 82%,rgba(210,86,17,0));opacity:.9}
-  .s1{left:60px;width:140px;opacity:.5}
-  .s2{left:520px;width:90px;opacity:.55}
-  .s3{left:1040px;width:300px;opacity:.95}
-  .s4{left:1400px;width:120px;opacity:.7}
-  .vignette{position:absolute;inset:0;background:radial-gradient(ellipse 70% 80% at 50% 45%,rgba(10,10,10,0) 30%,rgba(10,10,10,.55) 70%,#0a0a0a 100%)}
-  .darken{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,10,.25),rgba(10,10,10,.1) 40%,rgba(10,10,10,.5))}
-  .grain{position:absolute;inset:0;opacity:.3;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");background-size:220px 220px}
-  .top{position:absolute;left:0;right:0;top:54px;display:flex;flex-direction:column;align-items:center;gap:26px}
-  h1{margin:0;font-size:50px;font-weight:600;letter-spacing:-0.03em;line-height:1.1;word-spacing:.08em;text-align:center;white-space:nowrap;background:linear-gradient(180deg,#ffffff 20%,#c9c9c9);-webkit-background-clip:text;background-clip:text;color:transparent}
-  h1 .br{padding:.04em .22em;background-image:linear-gradient(#e8804a,#e8804a),linear-gradient(#e8804a,#e8804a),linear-gradient(#e8804a,#e8804a),linear-gradient(#e8804a,#e8804a),linear-gradient(#e8804a,#e8804a),linear-gradient(#e8804a,#e8804a),linear-gradient(#e8804a,#e8804a),linear-gradient(#e8804a,#e8804a);background-repeat:no-repeat;background-size:.15em 4px,4px .15em,.15em 4px,4px .15em,.15em 4px,4px .15em,.15em 4px,4px .15em;background-position:0 0,0 0,100% 0,100% 0,0 100%,0 100%,100% 100%,100% 100%}
-  .win{position:absolute;left:50%;top:286px;transform:translateX(-50%);width:1080px;height:420px;border-radius:12px;background:#0f0f0f;border:1px solid rgba(232,128,74,.55);box-shadow:0 0 0 1px rgba(0,0,0,.7),0 0 60px rgba(210,86,17,.28),0 30px 90px rgba(0,0,0,.65);overflow:hidden}
+  html,body{margin:0;background:#08090a}
+  body{width:1200px;height:630px;overflow:hidden;position:relative}
+  .head{position:absolute;left:64px;top:40px;display:flex;align-items:center;gap:30px}
+  .wm{height:44px;width:283px;display:block}
+  .head p{margin:0;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-feature-settings:"cv01","ss03";font-size:59px;font-weight:500;letter-spacing:-0.025em;word-spacing:.08em;color:#d4d2cf;-webkit-font-smoothing:antialiased}
+  .win{position:absolute;left:64px;top:146px;width:1160px;border-radius:12px 0 0 0;border:1px solid #2a2b2d;box-shadow:0 0 0 1px rgba(0,0,0,.7),0 30px 80px rgba(0,0,0,.7);overflow:hidden}
   .win img{display:block;width:100%;height:auto}
-  .fade{position:absolute;left:0;right:0;bottom:0;height:140px;background:linear-gradient(180deg,rgba(10,10,10,0),rgba(10,10,10,.9) 70%,#0a0a0a)}
+  .fade{position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(180deg,rgba(8,9,10,0),rgba(8,9,10,.85) 75%,#08090a)}
 </style></head><body>
-<div class="streaks"><div class="streak s1"></div><div class="streak s2"></div><div class="streak s3"></div><div class="streak s4"></div></div>
-<div class="vignette"></div>
-<div class="darken"></div>
-<div class="grain"></div>
-<div class="top">
-  <img src="../../public/title.svg" alt="Superset" style="height:70px">
-  <h1>Bring Any Agent. <span class="br">Orchestrate Them All.</span></h1>
-</div>
-<div class="win"><img src="screenshot.png" alt="Superset workspace with Claude and Codex tabs"></div>
+<div class="head"><svg class="wm" viewBox="149 75 412 64" aria-label="Superset"><path fill="#EAE8E6" d="M174.599 75H187.4V87.7999H174.599V75ZM161.8 75H174.599V87.7999H161.8V75ZM149 87.7999H161.8V100.6H149V87.7999ZM149 100.6H161.8V113.4H149V100.6ZM161.8 100.6H174.599V113.
```

**File**: `apps/marketing/scripts/og-image/render.sh` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ LOG="$PROFILE/chrome.log"
 # Chrome writes the screenshot within a few seconds but its updater/crash-handler
 # helpers can keep the process alive indefinitely, so wait for the file, then stop it.
 "$CHROME_BIN" --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
-  --user-data-dir="$PROFILE" --window-size=1200,630 --force-device-scale-factor=2 --timeout=10000 \
+  --user-data-dir="$PROFILE" --window-size=1200,630 --force-device-scale-factor=2 --timeout=10000 --virtual-time-budget=8000 \
   --screenshot="$TMP_OUT" "file://$PWD/og-image.html" >"$LOG" 2>&1 &
 CHROME_PID=$!
 for _ in $(seq 1 60); do
```

---

### Incident Patch 9: `dbeb48bc` (2026-10-05)
**Commit Message**: fix(host-service): revalidate PR polling with ETags so sweeps cost no rate limit (#8164)

* fix(host-service): revalidate pull request responses

* fix(host-service): guard pending PR cache writes

* fix(host-service): say why the PR cache stays shorter than the sweep

The 5-minute project sweep outlives the 60s repo PR cache, so every sweep
went back to GitHub (#7929). With ConditionalGh those sweeps revalidate with
If-None-Match and unchanged data comes back 304, which costs no rate limit.
Raising the TTL past the sweep, as #7929 did, would leave PR state up to
~10 minutes stale for no quota gain, so the comment now records that.

Co-authored-by: gertjanleemans <[REDACTED_EMAIL]>

* fix(host-service): keep a newer ETag when an older 200 finishes last

A sweep and a bypass-cache refresh can request the same endpoint at once.
The 304 and error paths already skip their write when another request has
replaced the entry; the 200 path now does the same, so an older response
cannot overwrite a newer validator.

* test(host-service): cover ConditionalGh edge cases seen in gh and GitHub Desktop

* docs(host-service): note which gh GETs ConditionalGh cannot parse

---------

Co-authored-by

**File**: `packages/host-service/src/runtime/pull-requests/pull-requests.test.ts` (modified, +63/-0)
```diff
@@ -2033,6 +2033,69 @@ function projectRefresher(manager: PullRequestRuntimeManager) {
 	return accessible.refreshProject.bind(accessible);
 }
 
+test("revalidates unchanged PRs after the polling cache expires without falling back", async () => {
+	const db = createRealDb();
+	seedProject(db);
+	seedWorkspace(db, {
+		id: "ws-conditional",
+		branch: "feature",
+		upstreamOwner: REPO.owner,
+		upstreamRepo: REPO.name,
+		upstreamBranch: "feature",
+	});
+	const node = makePrNode({ number: 42, headRef: "feature", headSha: "sha" });
+	let requests = 0;
+	let notModified = 0;
+	let fallbacks = 0;
+	const manager = createManager(db, {
+		git: defaultBranchGit("main"),
+		execGh: async (args) => {
+			if (args.includes("graphql")) return {};
+			requests += 1;
+			if (args.includes('If-None-Match: "unchanged"')) {
+				notModified += 1;
+				throw Object.assign(new Error("gh: HTTP 304"), {
+					code: 1,
+					stdout: 'HTTP/2.0 304 Not Modified\r\nEtag: "unchanged"\r\n\r\n',
+				});
+			}
+			const endpoint = args.find((arg) => arg.startsWith("repos/"));
+			const body = endpoint?.endsWith("/pulls")
+				? [node]
+				: endpoint?.endsWith("/check-runs")
+					? { check_runs: [] }
+					: [];
+			return args.includes("--include")
+				? `HTTP/2.0 200 OK\r\nEtag: "unchanged"\r\n\r\n${JSON.stringify(body)}`
+				: body;
+		},
+		github: async () => {
+			fallbacks += 1;
+			throw new Error("304 must not reach Octokit");
+		},
+	});
+	try {
+		setSystemTime(new Date("2026-10-04T12:00:00Z"));
+		await projectRefresher(manager)(PROJECT_ID);
+		const initialRequests = requests;
+		expect(initialRequests).toBeGreaterThan(0);
+		setSystemTime(new Date("2026-10-04T12:05:01Z"));
+		await projectRefresher(manager)(PROJECT_ID);
+		expect(notModified).toBe(initialRequests);
+		expect(requests).toBe(initialRequests * 2);
+		expect(fallbacks).toBe(0);
+		const [snapshot] = await manager.getPullRequestsByWorkspaces([
+			"ws-conditional",
+		]);
+		expect(snapshot?.pullRequest?.number).toBe(42);
+		expect(snapshot?.error).toBeNull();
+	} finally {
+		setSystemTime();
+		manager.stop();
+		db.$client.close();
+	}
+});
+
 // gh answers for one open PR: the head lookup / open sweep return the node,
 // and the four detail calls return empty but well-formed payloads.
 function ghAnsweringPr(
```

**File**: `packages/host-service/src/runtime/pull-requests/pull-requests.ts` (modified, +7/-4)
```diff
@@ -14,6 +14,7 @@ import type { EventBus } from "../../events/event-bus";
 import type { GitWatcher } from "../../events/git-watcher";
 import type { ExecGh } from "../../trpc/router/workspace-creation/utils/exec-gh";
 import { type GitFactory, resolveDefaultBranchName } from "../git";
+import { ConditionalGh } from "./utils/conditional-gh";
 import {
 	GitHubAvailabilityGate,
 	type GitHubAvailabilityStatus,
@@ -68,9 +69,8 @@ const SAFETY_NET_INTERVAL_MS = 5 * 60_000;
 // branch/HEAD/upstream changes. The 60s repo-PR cache deduplicates across
 // concurrent triggers.
 const PROJECT_REFRESH_INTERVAL_MS = 5 * 60_000;
-// Must exceed every polling interval that hits this cache (SAFETY_NET and
-// PROJECT_REFRESH). Otherwise the cache is always stale at poll time and
-// each tick fires fresh GitHub calls for the same upstream branch.
+// Sweeps outlive this cache on purpose: they revalidate through ConditionalGh,
+// and a 304 costs no rate limit. Raising it past the sweep only makes PRs staler.
 const REPO_PULL_REQUEST_CACHE_TTL_MS = 60_000;
 // A fetch that keeps failing (payload over maxBuffer, revoked auth, …) must
 // not respawn `gh` at full cadence forever: each consecutive failure doubles
@@ -220,6 +220,7 @@ interface PullRequestDetails {
 export class PullRequestRuntimeManager {
 	private readonly db: HostDb;
 	private readonly execGh: ExecGh;
+	private readonly conditionalGh: ConditionalGh;
 	private readonly git: GitFactory;
 	private readonly github: () => Promise<Octokit>;
 	private readonly gitWatcher: GitWatcher;
@@ -282,7 +283,8 @@ export class PullRequestRuntimeManager {
 
 	constructor(options: PullRequestRuntimeManagerOptions) {
 		this.db = options.db;
-		this.execGh = options.execGh;
+		this.conditionalGh = new ConditionalGh(options.execGh);
+		this.execGh = this.conditionalGh.exec;
 		this.git = options.git;
 		this.github = options.github;
 		this.gitWatcher = options.gitWatcher;
@@ -358,6 +360,7 @@ export class PullRequestRuntimeManager {
 	}
 
 	stop() {
+		this.conditionalGh.clear();
 		if (this.safetyNetTimer) clearInterval(this.safetyNetTimer);
 		if (this.projectRefreshTimer) clearInterval(this.projectRefreshTimer);
 		if (this.missingWorktreeProbeTimer)
```

**File**: `packages/host-service/src/runtime/pull-requests/utils/conditional-gh/conditional-gh.test.ts` (added, +387/-0)
```diff
@@ -0,0 +1,387 @@
+import { describe, expect, test } from "bun:test";
+import type { ExecGh } from "../../../../trpc/router/workspace-creation/utils/exec-gh";
+import { ConditionalGh } from "./conditional-gh";
+
+const GET = ["api", "--method", "GET", "repos/owner/repo/pulls"];
+
+function response(body: unknown, etag?: string, newline = "\r\n") {
+	return [
+		"HTTP/2.0 200 OK",
+		...(etag ? [`Etag: ${etag}`] : []),
+		"",
+		JSON.stringify(body),
+	].join(newline);
+}
+
+function notModified() {
+	return Object.assign(new Error("gh: HTTP 304"), {
+		code: 1,
+		stdout: "HTTP/2.0 304 Not Modified\r\n\r\n",
+	});
+}
+
+function createRunner(responses: unknown[]) {
+	const calls: { args: string[]; options: Parameters<ExecGh>[1] }[] = [];
+	const run: ExecGh = async (args, options) => {
+		calls.push({ args, options });
+		const result = responses.shift();
+		if (result instanceof Error) throw result;
+		return result;
+	};
+	return { run, calls };
+}
+
+describe("conditional GitHub REST requests", () => {
+	test.each([
+		200, 304,
+	])("keeps a newer response when an older %i revalidation finishes last", async (status) => {
+		const pending = Promise.withResolvers<unknown>();
+		const { run, calls } = createRunner([
+			response([], '"first"'),
+			pending.promise,
+			response([{ number: 42 }], '"second"'),
+			notModified(),
+		]);
+		const gh = new ConditionalGh(run);
+		await gh.exec(GET);
+		const older = gh.exec(GET);
+		await gh.exec(GET);
+		if (status === 304) pending.reject(notModified());
+		else pending.resolve(response([], '"older"'));
+		await older;
+		expect(await gh.exec(GET)).toEqual([{ number: 42 }]);
+		expect(calls[3]?.args).toContain('If-None-Match: "second"');
+	});
+
+	test.each([
+		200, 304,
+	])("does not restore responses cleared during a pending %i request", async (status) => {
+		const pending = Promise.withResolvers<unknown>();
+		const { run, calls } = createRunner([
+			response([], '"first"'),
+			pending.promise,
+			response([]),
+		]);
+		const gh = new ConditionalGh(run);
+		await gh.exec(GET);
+		const request = gh.exec(GET);
+		gh.clear();
+		if (status === 304) pending.reject(notModified());
+		else pending.resolve(response([], '"second"'));
+		await request;
+		await gh.exec(GET);
+		expect(calls[2]?.args).not.toContain("--header");
+	});
+
+	test("revalidates with weak ETags and handles gh's nonzero 304 exit", async () => {
+		const body = [{ number: 42 }];
+		const { run, calls } = createRunner([
+			response(body, 'W/"first"'),
+			notModified(),
+		]);
+		const gh = new ConditionalGh(run);
+		expect(await gh.exec(GET)).toEqual(body);
+		expect(await gh.exec(GET)).toEqual(body);
+		expect(calls[0]?.args).toEqual([...GET, "--include"]);
+		expect(calls[1]?.args).toEqual([
+			...GET,
+			"--include",
+			"--header",
+			'If-None-Match: W/"first"',
+		]);
+	});
+
+	test("replaces both the validator and body when the resource changes", async () => {
+		const { run, calls } = createRunner([
+			response([], '"first"', "\n"),
+			response([{ number: 42 }], '"second"', "\n"),
+			notModified(),
+		]);
+		const gh = new ConditionalGh(run);
+		await gh.exec(GET);
+		expect(await gh.exec(GET)).toEqual([{ number: 42 }]);
+		expect(await gh.exec(GET)).toEqual([{ number: 42 }]);
+		expect(calls[2]?.args).toContain('If-None-Match: "second"');
+	});
+
+	test("removes an old validator when the server stops sending ETags", async () => {
+		const { run, calls } = createRunner([
+			response([], '"first"'),
+			response([{ number: 42 }]),
+			response([]),
+		]);
+		const gh = new ConditionalGh(run);
+		await gh.exec(GET);
+		expect(await gh.exec(GET)).toEqual([{ number: 42 }]);
+		await gh.exec(GET);
+		expect(calls[2]?.args).not.toContain("--header");
+	});
+
+	test("keeps query fields, projections and working directories isolated", async () => {
+		const { run, calls } = createRunner(
+			Array.from({ length: 5 }, () => response([], '"etag"')),
+		);
+		const gh = new ConditionalGh(run);
+		await gh.exec([...GET, "-f", "head=owner:Feature"]);
+		await gh.exec([...GET, "-f", "head=owner:feature"]);
+		await gh.exec([...GET, "--jq", "[.[] | {number}]"]);
+		await gh.exec(GET, { cwd: "/first", timeout: 123, maxBuffer: 456 });
+		await gh.exec(GET, { cwd: "/second" });
+		expect(calls.every(({ args }) => !args.includes("--header"))).toBe(true);
+		expect(calls[3]?.options).toEqual({
+			cwd: "/first",
+			timeout: 123,
+			maxBuffer: 456,
+		});
+	});
+
+	test("leaves GraphQL and mutations unchanged", async () => {
+		const { run, calls } = createRunner([{ data: {} }, { number: 42 }]);
+		const gh = new ConditionalGh(run);
+		const graphql = [
+			"api",
+			"graphql",
+			"-f",
+			"query=query { viewer { login } }",
+		];
+		const mutation = ["api", "--method", "PATCH", "repos/owner/repo/pulls/42"];
+		expect(await gh.exec(graphql)).toEqual({ data: {} });
+		expect(await gh.exec(mutation)).toEqual({ number: 42 });
+		expect(calls.map(({ args }) => args)).toEqual([graphql, mutati
```

**File**: `packages/host-service/src/runtime/pull-requests/utils/conditional-gh/conditional-gh.ts` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+import type { ExecGh } from "../../../../trpc/router/workspace-creation/utils/exec-gh";
+
+interface CachedResponse {
+	etag: string;
+	body: string;
+	bytes: number;
+}
+
+function parseResponse(stdout: unknown) {
+	if (typeof stdout !== "string") return null;
+	const status = /^HTTP\/\S+ (\d{3})\b/.exec(stdout)?.[1];
+	if (!status) return null;
+	const separator = /\r?\n\r?\n/.exec(stdout);
+	const headers = separator ? stdout.slice(0, separator.index) : stdout;
+	return {
+		status: Number(status),
+		etag: /^etag:[ \t]*(.+)$/im.exec(headers)?.[1]?.trim(),
+		body: separator
+			? stdout.slice(separator.index + separator[0].length).trim()
+			: "",
+	};
+}
+
+export class ConditionalGh {
+	private readonly cache = new Map<string, CachedResponse>();
+	private bytes = 0;
+	private generation = 0;
+
+	constructor(
+		private readonly run: ExecGh,
+		private readonly limits = {
+			maxEntries: 512,
+			maxBytes: 16 * 1024 * 1024,
+		},
+	) {}
+
+	clear() {
+		this.generation++;
+		this.cache.clear();
+		this.bytes = 0;
+	}
+
+	private remove(key: string) {
+		const entry = this.cache.get(key);
+		if (entry) this.bytes -= entry.bytes;
+		this.cache.delete(key);
+	}
+
+	private store(key: string, entry: CachedResponse) {
+		this.remove(key);
+		if (entry.bytes > this.limits.maxBytes || this.limits.maxEntries <= 0) {
+			return;
+		}
+		this.cache.set(key, entry);
+		this.bytes += entry.bytes;
+		while (
+			this.cache.size > this.limits.maxEntries ||
+			this.bytes > this.limits.maxBytes
+		) {
+			const oldest = this.cache.keys().next().value;
+			if (oldest === undefined) break;
+			this.remove(oldest);
+		}
+	}
+
+	exec: ExecGh = async (args, options) => {
+		// Expects one header block and a single JSON body. A GET with --paginate,
+		// or a --jq filter that prints non-JSON, cannot be parsed here: pass it through.
+		if (args[0] !== "api" || args[args.indexOf("--method") + 1] !== "GET") {
+			return this.run(args, options);
+		}
+		const key = JSON.stringify([args, options?.cwd]);
+		const generation = this.generation;
+		const cached = this.cache.get(key);
+		const request = [...args, "--include"];
+		if (cached) request.push("--header", `If-None-Match: ${cached.etag}`);
+
+		let raw: unknown;
+		try {
+			raw = await this.run(request, options);
+		} catch (error) {
+			// gh exits 1 for HTTP 304 and leaves its response headers on stdout.
+			if (
+				cached &&
+				error instanceof Error &&
+				"code" in error &&
+				error.code === 1 &&
+				"stdout" in error &&
+				parseResponse(error.stdout)?.status === 304
+			) {
+				raw = error.stdout;
+			} else {
+				if (generation === this.generation && this.cache.get(key) === cached) {
+					this.remove(key);
+				}
+				throw error;
+			}
+		}
+
+		const response = parseResponse(raw);
+		if (!response) return raw;
+		if (response.status === 304 && cached) {
+			if (generation === this.generation && this.cache.get(key) === cached) {
+				this.store(key, cached);
+			}
+			return JSON.parse(cached.body);
+		}
+		if (response.status !== 200) {
+			throw new Error(`Unexpected GitHub response: HTTP ${response.status}`);
+		}
+		const result: unknown = JSON.parse(response.body);
+		if (generation !== this.generation || this.cache.get(key) !== cached) {
+			return result;
+		}
+		this.remove(key);
+		if (response.etag) {
+			this.store(key, {
+				etag: response.etag,
+				body: response.body,
+				bytes: Buffer.byteLength(key + response.etag + response.body),
+			});
+		}
+		return result;
+	};
+}
```

**File**: `packages/host-service/src/runtime/pull-requests/utils/conditional-gh/index.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export { ConditionalGh } from "./conditional-gh";
```

---

### Incident Patch 10: `15cc5510` (2026-10-05)
**Commit Message**: fix(workspace-fs): drive the pathTypes LRU cap test with a scripted backend (#8160)

The cap test wrote 70 real files and waited until the last one was
tracked, assuming the watcher sees events in write order. On Linux the
manager uses chokidar, which emits one event per file after async stats
and adds late `change` events. The last file often arrived in an early
flush while ~26 events were still pending, so the eviction assertion ran
before eviction happened (CI run 37226271068).

The test now injects a backend that delivers creates in a known order and
waits for the listener to receive all of them, then asserts the exact set
of survivors. Product code is unchanged.

**File**: `packages/workspace-fs/src/watch-pathtypes-growth.test.ts` (modified, +37/-29)
```diff
@@ -3,6 +3,7 @@ import fs from "node:fs/promises";
 import os from "node:os";
 import path from "node:path";
 import { FsWatcherManager, type FsWatcherManagerOptions } from "./watch";
+import type { NativeWatchBackend, NativeWatchEvent } from "./watch-backend";
 
 /**
  * INTEGRATION reproduction of finding #3 in
@@ -216,42 +217,49 @@ describe("FsWatcherManager.pathTypes — monotonic growth", () => {
 		const rootPath = await createTempRoot();
 		tempRoots.push(rootPath);
 
-		const FILE_PATHS_MAX = 50;
+		// A real backend does not deliver events in write order (chokidar on
+		// Linux emits per file after async stats, and adds late `change`s), so
+		// the LRU order is driven here instead.
+		let emitNative: ((events: NativeWatchEvent[]) => void) | undefined;
+		const backend: NativeWatchBackend = {
+			name: "scripted",
+			async subscribe({ onEvents }) {
+				emitNative = onEvents;
+				return { unsubscribe: async () => {} };
+			},
+		};
+
+		const FILE_PATHS_MAX = 5;
 		const manager = createManager({
-			debounceMs: 50,
+			debounceMs: 10,
 			filePathsMax: FILE_PATHS_MAX,
+			backend,
+		});
+		let createCount = 0;
+		await manager.subscribe({ absolutePath: rootPath }, (batch) => {
+			for (const event of batch.events) {
+				if (event.kind === "create") createCount++;
+			}
 		});
-		await manager.subscribe({ absolutePath: rootPath }, () => {});
-
-		const total = FILE_PATHS_MAX + 20;
 
-		for (let i = 0; i < total; i++) {
-			await fs.writeFile(path.join(rootPath, `cap-${i}.tmp`), `${i}`);
+		const total = FILE_PATHS_MAX + 3;
+		const filePaths = Array.from({ length: total }, (_, i) =>
+			path.join(rootPath, `cap-${i}.tmp`),
+		);
+		await Promise.all(
+			filePaths.map((filePath, i) => fs.writeFile(filePath, `${i}`)),
+		);
+		for (const filePath of filePaths) {
+			emitNative?.([{ type: "create", path: filePath }]);
 		}
+		await waitForCondition(() => createCount >= total);
 
-		// Wait for the last write to land — that guarantees both the eviction
-		// has fired (we're well past the cap) and the most-recent path is
-		// tracked. The original 10k+ test relied on sheer scale to flush in
-		// time; with a small cap we need an explicit settle.
-		const firstPath = path.join(rootPath, "cap-0.tmp");
-		const lastPath = path.join(rootPath, `cap-${total - 1}.tmp`);
-		await waitForCondition(
-			() => getPathTypes(manager, rootPath).has(lastPath),
-			30_000,
+		expect(getFilePathsSize(manager, rootPath)).toBe(FILE_PATHS_MAX);
+		const tracked = getPathTypes(manager, rootPath);
+		expect(filePaths.filter((filePath) => tracked.has(filePath))).toEqual(
+			filePaths.slice(total - FILE_PATHS_MAX),
 		);
-
-		// File entries are the LRU-capped axis; directories are tracked
-		// separately and aren't counted toward the cap.
-		const cappedFileSize = getFilePathsSize(manager, rootPath);
-		expect(cappedFileSize).toBeLessThanOrEqual(FILE_PATHS_MAX);
-
-		// Earliest paths should have been evicted.
-		expect(getPathTypes(manager, rootPath).has(firstPath)).toBe(false);
-
-		// Most-recent paths should still be in the map (already verified by
-		// waitForCondition above, but assert for clarity).
-		expect(getPathTypes(manager, rootPath).has(lastPath)).toBe(true);
-	}, 60_000);
+	});
 
 	it("repeated create/delete with unique names grows pathTypes monotonically until delete catches up", async () => {
 		// The most realistic leak scenario: a process keeps creating files
```

---

### Incident Patch 11: `952fec8f` (2026-10-05)
**Commit Message**: fix(sandbox): make ACP chat work on cloud boxes (#8158)

* fix(sandbox): install ACP adapters in the host-service runtime tarball

host-service locates each ACP harness's adapter (@agentclientprotocol/
claude-agent-acp, codex-acp, pi-acp) with require.resolve at runtime, so the
bundle cannot inline it. The runtime bake installed only the native modules,
so on a cloud box the harness registry came up empty and ACP chat failed with
`unknown harness claude-acp`.

Install each adapter at host-service's pinned version, and fail the bake if
an adapter's entry is missing.

* fix(sandbox): drop the adapters' bundled agent binaries, pin codex 0.160.0

The ACP adapters pull in their own Claude Code and Codex binaries
(@anthropic-ai/claude-agent-sdk-linux-*, @openai/codex-linux-*, ~650 MB
unpacked), which took the runtime tarball from 13 MB to 290 MB. host-service
launches the adapters with CLAUDE_CODE_EXECUTABLE / CODEX_PATH set to the
box's pinned CLIs, so remove them after install. The tarball is now 22 MB.

codex-acp and the codex harness need codex 0.160.0, and the box pinned
0.159.2, so every Codex chat on a box failed with "codex 0.160.0 or newer is
needed for chat".

* revert(sandbox)

**File**: `docs/cloud-sandbox-mismatches.md` (modified, +8/-0)
```diff
@@ -282,6 +282,14 @@ tarball (and the CLI bundle, same gap) ships `chat-migrations/` next to
 `host-service.js`, which looks there when the env is unset. Reaches a box only
 through a host-service runtime release.
 
+**Packages host-service resolves at runtime have to be installed in the
+tarball.** The ACP harnesses find their adapter (`@agentclientprotocol/*-acp`,
+`pi-acp`) with `require.resolve`, so the bundle cannot inline it, and the
+tarball installed only the natives. The harness registry came up empty and ACP
+chat on a box failed with `unknown harness claude-acp`. Fixed: the runtime bake
+installs each adapter at host-service's pinned version and fails if one is
+missing. The CLI bundle has the same gap.
+
 ## Lifecycle
 
 **Delete was not wired.** The generic delete routed to the owning host, which
```

**File**: `packages/sandbox/src/assets/produce.ts` (modified, +16/-4)
```diff
@@ -272,7 +272,7 @@ async function wallpapers(): Promise<void> {
 // --- host-service runtime -------------------------------------------------
 /**
  * The runtime tarball: host-service's bundle, its and chat.db's migrations, the agent
- * templates, pty-daemon, the native modules installed for linux/amd64 against
+ * templates, pty-daemon, the ACP adapters, the native modules installed for linux/amd64 against
  * the image's Node, and a pre-migrated host.db template so first boot copies
  * a file instead of running migrations. Built in the image's own Node so the
  * natives match.
@@ -284,11 +284,17 @@ function hostService(): void {
 			"utf8",
 		),
 	) as { version: string; dependencies: Record<string, string> };
-	const natives = ["better-sqlite3", "node-pty"].map((dep) => {
+	const pinned = (dep: string) => {
 		const version = pkg.dependencies[dep];
 		if (!version) throw new Error(`${dep} is not a host-service dependency`);
 		return `${dep}@${version}`;
-	});
+	};
+	const natives = ["better-sqlite3", "node-pty"].map(pinned);
+	const acpAdapters = [
+		"@agentclientprotocol/claude-agent-acp",
+		"@agentclientprotocol/codex-acp",
+		"pi-acp",
+	];
 	for (const [dir, script] of [
 		["packages/host-service", "build:host"],
 		["packages/pty-daemon", "build:daemon"],
@@ -326,8 +332,14 @@ function hostService(): void {
 			// host-service resolves the daemon side by side with itself, the way the desktop ships it.
 			"cp /out/stage/pty-daemon/pty-daemon.js /rt/pty-daemon.js",
 			"cd /rt && npm init -y >/dev/null && npm pkg set type=module >/dev/null",
-			`npm install ${natives.join(" ")} @parcel/watcher @xterm/headless --no-audit --no-fund >/dev/null`,
+			`npm install ${[...natives, ...acpAdapters.map(pinned)].join(" ")} @parcel/watcher @xterm/headless --no-audit --no-fund >/dev/null`,
+			// The adapters bring their own claude and codex binaries (~650 MB); host-service points them at the box's pinned CLIs instead.
+			"rm -rf node_modules/@anthropic-ai/claude-agent-sdk-linux-* node_modules/@openai/codex-linux-*",
 			"test -d node_modules/node-pty/prebuilds/linux-x64 || (echo 'node-pty prebuild missing' && exit 1)",
+			...acpAdapters.map(
+				(adapter) =>
+					`test -f node_modules/${adapter}/dist/index.js || (echo '${adapter} missing' && exit 1)`,
+			),
 			// chat.db migrates on the first /chat-v3 request, after release: apply every journaled migration here.
 			'cd /rt && node -e \'const fs=require("node:fs");const D=require("better-sqlite3");const d=new D(":memory:");for(const e of JSON.parse(fs.readFileSync("/rt/chat-migrations/meta/_journal.json","utf8")).entries)d.exec(fs.readFileSync("/rt/chat-migrations/"+e.tag+".sql","utf8").replaceAll("--> statement-breakpoint",""));d.close()\'',
 			// The schema, baked: run host-service once against a throwaway path so the template carries every migration.
```

---

### Incident Patch 12: `8d2575b0` (2026-10-05)
**Commit Message**: fix(api): always send a code for YC deal redemptions (#8156)

The webhook used to add Pro straight to the org owned by the account
that matched the Bookface email. Founders often use a different email
or org for Superset, so now every redemption gets a single-use code
they can apply to any account and org at checkout.

**File**: `apps/api/src/app/api/integrations/yc-deals/webhook/route.ts` (modified, +3/-138)
```diff
@@ -1,15 +1,8 @@
 import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
 import { db } from "@superset/db/client";
-import {
-	dealRedemptions,
-	members,
-	organizations,
-	subscriptions,
-	users,
-} from "@superset/db/schema";
+import { dealRedemptions } from "@superset/db/schema";
 import { YcDealCodeEmail } from "@superset/email/emails/billing/yc-deal-code";
-import { ACTIVE_SUBSCRIPTION_STATUSES } from "@superset/shared/billing";
-import { and, eq, inArray, sql } from "drizzle-orm";
+import { and, eq } from "drizzle-orm";
 import { Resend } from "resend";
 import Stripe from "stripe";
 import { z } from "zod";
@@ -59,95 +52,10 @@ function generateCode(): string {
 }
 
 type Outcome = {
-	status: "granted" | "code_sent" | "pending";
-	organizationId?: string;
-	stripeSubscriptionId?: string;
+	status: "code_sent" | "pending";
 	promotionCode?: string;
 };
 
-/**
- * Rejecting the redemption makes Bookface show `message` to the founder and
- * not count the redemption, so they can retry after fixing the problem.
- */
-class RejectRedemption extends Error {
-	constructor(
-		message: string,
-		readonly httpStatus: number,
-	) {
-		super(message);
-	}
-}
-
-async function grantSubscription(
-	organizationId: string,
-	payload: Payload,
-): Promise<Outcome> {
-	const org = await db.query.organizations.findFirst({
-		where: eq(organizations.id, organizationId),
-	});
-	if (!org) throw new Error(`Organization ${organizationId} not found`);
-
-	let customerId = org.stripeCustomerId;
-	if (!customerId) {
-		const customer = await stripeClient.customers.create({
-			name: org.name,
-			email: payload.email ?? undefined,
-			metadata: { organizationId: org.id, organizationSlug: org.slug ?? "" },
-		});
-		customerId = customer.id;
-		await db
-			.update(organizations)
-			.set({ stripeCustomerId: customerId })
-			.where(eq(organizations.id, org.id));
-	}
-
-	const seatCount = await db.$count(
-		members,
-		eq(members.organizationId, org.id),
-	);
-
-	const subscription = await stripeClient.subscriptions.create({
-		customer: customerId,
-		items: [
-			{
-				price: env.STRIPE_PRO_MONTHLY_PRICE_ID,
-				quantity: Math.max(seatCount, 1),
-			},
-		],
-		discounts: [{ coupon: env.YC_BOOKFACE_COUPON_ID }],
-		metadata: {
-			source: SOURCE,
-			organizationId: org.id,
-			ycRedemptionId: String(payload.id),
-		},
-	});
-
-	// The better-auth Stripe plugin's customer.subscription.created handler
-	// cannot resolve an org from a customer id (it only does that when the
-	// plugin is configured with `organization.enabled`, which we don't set), so
-	// a subscription created through the API never reaches our table. Write the
-	// row here. Later updates and cancels do reconcile through the plugin,
-	// which finds this row by stripeSubscriptionId.
-	const item = subscription.items.data[0];
-	await db.insert(subscriptions).values({
-		plan: "pro",
-		referenceId: org.id,
-		stripeCustomerId: customerId,
-		stripeSubscriptionId: subscription.id,
-		status: subscription.status,
-		periodStart: item ? new Date(item.current_period_start * 1000) : null,
-		periodEnd: item ? new Date(item.current_period_end * 1000) : null,
-		seats: item?.quantity ?? Math.max(seatCount, 1),
-		billingInterval: item?.price.recurring?.interval ?? "month",
-	});
-
-	return {
-		status: "granted",
-		organizationId: org.id,
-		stripeSubscriptionId: subscription.id,
-	};
-}
-
 async function sendCode(email: string, payload: Payload): Promise<Outcome> {
 	const promotionCode = await stripeClient.promotionCodes.create({
 		promotion: { type: "coupon", coupon: env.YC_BOOKFACE_COUPON_ID },
@@ -180,41 +88,6 @@ async function sendCode(email: string, payload: Payload): Promise<Outcome> {
 async function resolveOutcome(payload: Payload): Promise<Outcome> {
 	const email = payload.email?.trim().toLowerCase();
 	if (!email) return { status: "pending" };
-
-	const user = await db.query.users.findFirst({
-		where: sql`lower(${users.email}) = ${email}`,
-	});
-
-	if (user) {
-		const ownerships = await db.query.members.findMany({
-			where: and(eq(members.userId, user.id), eq(members.role, "owner")),
-		});
-		const orgIds = ownerships.map((m) => m.organizationId);
-
-		if (orgIds.length > 0) {
-			const activeSubs = await db.query.subscriptions.findMany({
-				where: and(
-					inArray(subscriptions.referenceId, orgIds),
-					inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES),
-				),
-			});
-			const subscribed = new Set(activeSubs.map((s) => s.referenceId));
-			const eligible = orgIds.filter((id) => !subscribed.has(id));
-
-			if (eligible.length === 1 && eligible[0]) {
-				return grantSubscription(eligible[0], payload);
-			}
-			if (eligible.length === 0) {
-				throw new RejectRedemption(
-					"Looks like your org is already on a paid plan. Email kiet@superset.sh and we'll apply the 6 free months.",
-					409,
-				);
-			}
-			// More than one eligible org: we can't pick for them, so fall
-			// through to the code path
```

---

### Incident Patch 13: `e5ecb289` (2026-10-05)
**Commit Message**: fix(desktop): stop disabling GPU acceleration on Linux (#7880)

* test(desktop): Linux launch must not disable GPU acceleration

Regression test for #5948. It fails on this commit, which still has the
Linux-only app.disableHardwareAcceleration() call in setup.ts, and passes
once the call is gone.

It checks setup.ts's source instead of importing the module. In the full
desktop suite, an earlier test file's mock.module("electron") can leave
the linked electron mock without BrowserWindow. Bun can't add that export
back, so importing setup.ts fails or passes depending on file order.

Claude-Session: https://claude.ai/code/session_016aUgGd6VofcWXGBKaYYdAg

* fix(desktop): stop disabling GPU acceleration on Linux

setup.ts called app.disableHardwareAcceleration() on every Linux launch.
The line came over verbatim from the electron-app boilerplate in e53d01c86,
and nothing ever justified it for this app. It pushes Chromium's
compositing, raster and every xterm WebGL context (one per pane, parked
panes included) onto the SwiftShader software renderer. On Linux laptops
that means a constant CPU load: the fan ramps and the idle temperature
rises (#5948).

Linux now does what macOS and Windo

**File**: `apps/desktop/src/lib/electron-app/factories/app/setup.test.ts` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+// Reads setup.ts as source rather than importing it: importing links its named
+// electron imports against whichever `mock.module("electron")` an earlier test
+// file installed, and Bun cannot add an export the linked mock lacks.
+
+import { describe, expect, test } from "bun:test";
+import { readFileSync } from "node:fs";
+import { join } from "node:path";
+
+const setupSource = readFileSync(join(import.meta.dirname, "setup.ts"), "utf8");
+
+describe("app setup GPU policy", () => {
+	test("leaves GPU acceleration to Chromium's blocklist (#5948)", () => {
+		expect(setupSource).not.toMatch(/disableHardwareAcceleration\s*\(/);
+		expect(setupSource).not.toMatch(/appendSwitch\(\s*["']disable-gpu/);
+	});
+});
```

**File**: `apps/desktop/src/lib/electron-app/factories/app/setup.ts` (modified, +0/-2)
```diff
@@ -82,8 +82,6 @@ export async function makeAppSetup(
 	return window;
 }
 
-PLATFORM.IS_LINUX && app.disableHardwareAcceleration();
-
 // macOS Sequoia+: occluded window throttling can corrupt GPU compositor layers
 if (PLATFORM.IS_MAC) {
 	app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
```

---

### Incident Patch 14: `d7606e40` (2026-10-05)
**Commit Message**: fix(desktop): load PR diffs without a matching workspace repository (#8125)

* fix(desktop): load PR diffs without a matching workspace repository

* refactor(desktop): share repository-based PR readers and diff cache

* refactor(desktop): reuse PR detail tabs and colocate diff viewer

* fix(desktop): preserve legacy PR reads before repository fallbacks

* fix(desktop): load oversized PR diffs through git

Keep legacy reads first, reuse repository-based summary loading, preserve meaningful fallback errors, and generate size-limited PR diffs from pinned Git commits. Preserve workspace-scoped project lookup for cloud PR panes.

* fix(pr): try validated GitHub file patches before fetching Git

* fix(pr): bound retained diff cache memory

**File**: `apps/desktop/src/renderer/components/OpenBrowserPageInAppButton/OpenBrowserPageInAppButton.tsx` (modified, +6/-6)
```diff
@@ -22,10 +22,7 @@ export function OpenBrowserPageInAppButton({
 	const { projects } = useHostProjects();
 	const target = getPullRequestTarget(currentUrl, projects);
 	const pageSlug = parseSupersetPageUrl(currentUrl, env.NEXT_PUBLIC_WEB_URL);
-	const canOpen =
-		pageSlug !== null ||
-		(target !== null &&
-			(onOpenInPane !== undefined || target.projectId !== null));
+	const canOpen = pageSlug !== null || target !== null;
 	if (!canOpen) return null;
 
 	return (
@@ -50,12 +47,15 @@ export function OpenBrowserPageInAppButton({
 							});
 							return;
 						}
-						if (!target?.projectId) return;
+						if (!target) return;
 						usePullRequestsSplitViewStore.getState().expandDetail();
 						void navigate({
 							to: "/pull-requests/$prNumber",
 							params: { prNumber: String(target.ref.number) },
-							search: { project: target.projectId },
+							search: {
+								project: target.projectId ?? undefined,
+								repo: target.ref.repoFullName,
+							},
 						});
 					}}
 				>
```

**File**: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/hooks/useOpenPullRequestInApp/useOpenPullRequestInApp.ts` (modified, +5/-3)
```diff
@@ -4,19 +4,21 @@ import { electronTrpc } from "renderer/lib/electron-trpc";
 import { getPullRequestTarget } from "renderer/lib/github/getPullRequestTarget";
 import { usePullRequestsSplitViewStore } from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/pullRequestsSplitViewStore";
 
-/** Opens a pull request on its in-app page when one of your projects has the repo, else on GitHub. */
 export function useOpenPullRequestInApp() {
 	const navigate = useNavigate();
 	const { projects } = useHostProjects();
 	const openUrl = electronTrpc.external.openUrl.useMutation();
 	return (url: string) => {
 		const target = getPullRequestTarget(url, projects);
-		if (target?.projectId) {
+		if (target) {
 			usePullRequestsSplitViewStore.getState().expandDetail();
 			void navigate({
 				to: "/pull-requests/$prNumber",
 				params: { prNumber: String(target.ref.number) },
-				search: { project: target.projectId },
+				search: {
+					project: target.projectId ?? undefined,
+					repo: target.ref.repoFullName,
+				},
 			});
 			return;
 		}
```

**File**: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/pull-requests/$prNumber/fixtures/checks.tsx` (added, +139/-0)
```diff
@@ -0,0 +1,139 @@
+import { afterEach, expect, mock, test } from "bun:test";
+import { GlobalRegistrator } from "@happy-dom/global-registrator";
+import type { ReactNode } from "react";
+
+if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
+const { cleanup, fireEvent, render } = await import("@testing-library/react");
+afterEach(cleanup);
+const root = "renderer/routes/_authenticated/_dashboard";
+let search: { repo?: string; project?: string } = { repo: "other/repo" };
+let detail = {
+	projectId: null as string | null,
+	repoFullName: "other/repo" as string | null,
+	isResolvingProject: false,
+	data: undefined as undefined | { url: string },
+	isLoading: false,
+	error: new Error("Summary unavailable"),
+	refetch: mock(),
+};
+mock.module("@tanstack/react-router", () => ({
+	createFileRoute: () => (options: unknown) => ({
+		options,
+		useParams: () => ({ prNumber: "12" }),
+	}),
+}));
+mock.module(`${root}/pull-requests/layout`, () => ({
+	Route: { useSearch: () => search },
+}));
+mock.module(`${root}/hooks/useProjectHost`, () => ({
+	useProjectHost: () => ({ hostId: null }),
+}));
+mock.module("renderer/hooks/host-service/useHostTargetUrl", () => ({
+	useHostUrl: () => "http://host.test",
+}));
+const read = mock(() => detail);
+mock.module(`${root}/pull-requests/hooks/usePullRequestDetail`, () => ({
+	usePullRequestDetail: read,
+}));
+mock.module(`${root}/components/PageHeader`, () => ({
+	PageHeader: ({ start }: { start: ReactNode }) => <div>{start}</div>,
+}));
+mock.module(`${root}/pull-requests/components/PullRequestListToggle`, () => ({
+	PullRequestListToggle: () => null,
+}));
+mock.module(`${root}/pull-requests/components/PullRequestDetailHeader`, () => ({
+	PullRequestDetailHeader: ({ projectId }: { projectId: string | null }) => (
+		<div data-testid="header" data-project={projectId ?? ""} />
+	),
+}));
+mock.module(
+	`${root}/pull-requests/components/PullRequestSummaryContent`,
+	() => ({ PullRequestSummaryContent: () => <div data-testid="summary" /> }),
+);
+mock.module(`${root}/components/WorkItemDetailState`, () => ({
+	WorkItemDetailState: ({ message }: { message: string }) => (
+		<div>{message}</div>
+	),
+}));
+mock.module(`${root}/pull-requests/components/PullRequestCodeTab`, () => ({
+	PullRequestCodeTab: ({
+		prUrl,
+		projectId,
+	}: {
+		prUrl: string;
+		projectId: string | null;
+	}) => (
+		<div data-testid="code" data-project={projectId ?? ""}>
+			{prUrl}
+		</div>
+	),
+}));
+const { Route } = await import("../page");
+const Page = Route.options.component as () => ReactNode;
+for (const project of [undefined, "unrelated", "removed"]) {
+	test(`Code loads without relying on project ${project}`, () => {
+		search = { repo: "other/repo", project };
+		const view = render(<Page />);
+		expect(read).toHaveBeenLastCalledWith({
+			projectId: project ?? null,
+			repoFullName: "other/repo",
+			hostUrl: "http://host.test",
+			prNumber: 12,
+		});
+		fireEvent.click(view.getByRole("button", { name: "Code" }));
+		expect(view.getByTestId("code").textContent).toBe(
+			"https://github.com/other/repo/pull/12",
+		);
+		expect(view.getByTestId("code").getAttribute("data-project")).toBe("");
+		expect(view.getByTestId("header").getAttribute("data-project")).toBe("");
+		fireEvent.click(view.getByRole("button", { name: "Summary" }));
+		expect(view.queryByTestId("code")).toBeNull();
+		fireEvent.click(view.getByRole("button", { name: "Code" }));
+		expect(view.getByTestId("code")).toBeTruthy();
+	});
+}
+test("keeps the canonical URL and Summary mounted across tab changes", () => {
+	detail = {
+		...detail,
+		data: { url: "https://github.com/canonical/repo/pull/12" },
+	};
+	const view = render(<Page />);
+	const summary = view.getByTestId("summary");
+	fireEvent.click(view.getByRole("button", { name: "Code" }));
+	expect(view.getByTestId("code").textContent).toBe(detail.data?.url ?? "");
+	expect(view.getByTestId("summary")).toBe(summary);
+});
+
+test("Code waits for project discovery before choosing a fallback", () => {
+	detail = {
+		...detail,
+		data: undefined,
+		projectId: null,
+		repoFullName: "other/repo",
+		isLoading: true,
+		isResolvingProject: true,
+	};
+	const view = render(<Page />);
+	fireEvent.click(view.getByRole("button", { name: "Code" }));
+	expect(view.queryByTestId("code")).toBeNull();
+	expect(view.getByText("Loading pull request…")).toBeTruthy();
+	detail = { ...detail, projectId: "project", isResolvingProject: false };
+	view.rerender(<Page />);
+	expect(view.getByTestId("code").getAttribute("data-project")).toBe("project");
+});
+test("legacy project-only loading and errors are not mistaken for invalid links", () => {
+	detail = {
+		...detail,
+		projectId: "project",
+		repoFullName: null,
+		data: undefined,
+		isResolvingProject: false,
+		isLoading: true,
+	};
+	const view = render(<Page />);
+	expect(view.queryByText("This pull request link is invalid.")).toBeNull();
+	detail = { ...detail, isLoading: false };
+	view.rerende
```

**File**: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/pull-requests/$prNumber/page.test.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+import { expect, test } from "bun:test";
+
+test("standalone PR detail without a project", () => {
+	const result = Bun.spawnSync({
+		cmd: [process.execPath, "test", `${import.meta.dir}/fixtures/checks.tsx`],
+		env: { ...process.env, NODE_ENV: "test" },
+	});
+	expect(
+		result.exitCode,
+		result.stdout.toString() + result.stderr.toString(),
+	).toBe(0);
+});
```

**File**: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/pull-requests/$prNumber/page.tsx` (modified, +27/-101)
```diff
@@ -1,61 +1,39 @@
-import { useLingui } from "@lingui/react/macro";
-import { cn } from "@superset/ui/utils";
 import { createFileRoute } from "@tanstack/react-router";
 import { useState } from "react";
 import { useHostUrl } from "renderer/hooks/host-service/useHostTargetUrl";
 import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
-import { WorkItemDetailState } from "renderer/routes/_authenticated/_dashboard/components/WorkItemDetailState";
 import { useProjectHost } from "renderer/routes/_authenticated/_dashboard/hooks/useProjectHost";
+import { PullRequestDetailContent } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestDetailContent";
 import { PullRequestDetailHeader } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestDetailHeader";
+import {
+	type PullRequestDetailTab,
+	PullRequestDetailTabs,
+} from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestDetailTabs";
 import { PullRequestListToggle } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestListToggle";
-import { PullRequestSummaryContent } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestSummaryContent";
 import { usePullRequestDetail } from "renderer/routes/_authenticated/_dashboard/pull-requests/hooks/usePullRequestDetail";
-import { resolvePullRequestDetail } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/resolvePullRequestDetail";
 import { parsePositiveIntegerParam } from "renderer/routes/_authenticated/_dashboard/utils/parsePositiveIntegerParam";
 import { Route as PullRequestsLayoutRoute } from "../layout";
-import { PullRequestCodeTab } from "./components/PullRequestCodeTab";
 
 export const Route = createFileRoute(
 	"/_authenticated/_dashboard/pull-requests/$prNumber/",
 )({
 	component: PullRequestDetailPage,
 });
 
-type DetailTab = "summary" | "code";
-
 function PullRequestDetailPage() {
-	const { t } = useLingui();
-	const detailTabs: ReadonlyArray<{ value: DetailTab; label: string }> = [
-		{
-			value: "summary",
-			label: t({
-				message: "Summary",
-			}),
-		},
-		{
-			value: "code",
-			label: t({
-				message: "Code",
-			}),
-		},
-	];
 	const { prNumber: prNumberRaw } = Route.useParams();
 	const prNumber = parsePositiveIntegerParam(prNumberRaw);
 	const search = PullRequestsLayoutRoute.useSearch();
 	const projectId = search.project ?? null;
-	const {
-		hostId,
-		isReady: areProjectsReady,
-		project,
-	} = useProjectHost(projectId);
-	const hostUrl = useHostUrl(hostId ?? undefined);
-	const [activeTab, setActiveTab] = useState<DetailTab>("summary");
+	const { hostId } = useProjectHost(projectId);
+	const hostUrl = useHostUrl(hostId);
+	const [activeTab, setActiveTab] = useState<PullRequestDetailTab>("summary");
 
-	const { data, isLoading, error, refetch } = usePullRequestDetail({
+	const detail = usePullRequestDetail({
 		projectId,
 		hostUrl,
 		prNumber,
-		enabled: !!project,
+		repoFullName: search.repo,
 	});
 
 	// The list pane is always visible in the split view (or reachable via the
@@ -68,89 +46,37 @@ function PullRequestDetailPage() {
 				start={
 					<>
 						<PullRequestListToggle />
-						<div className="ml-2 flex items-center gap-1">
-							{detailTabs.map(({ value, label }) => (
-								<button
-									key={value}
-									type="button"
-									onClick={() => setActiveTab(value)}
-									aria-current={activeTab === value ? "true" : undefined}
-									className={cn(
-										"rounded-md px-2 py-1 text-xs font-medium transition-colors",
-										activeTab === value
-											? "bg-accent text-foreground"
-											: "text-muted-foreground hover:text-foreground",
-									)}
-								>
-									{label}
-								</button>
-							))}
-						</div>
+						<PullRequestDetailTabs
+							activeTab={activeTab}
+							onTabChange={setActiveTab}
+							className="ml-2"
+						/>
 					</>
 				}
 			/>
 			<PullRequestDetailHeader
-				projectId={projectId}
+				projectId={detail.projectId}
 				hostId={hostId}
 				hostUrl={hostUrl}
 				prNumber={prNumber}
-				data={data}
-				isLoading={isLoading}
+				data={detail.data}
+				isLoading={detail.isLoading}
 			/>
 		</div>
 	);
 
-	const resolved = resolvePullRequestDetail({
-		prNumber,
-		projectId,
-		areProjectsReady,
-		hasProject: !!project,
-		hostUrl,
-		isLoading,
-		error,
-		data,
-		refetch: () => void refetch(),
-	});
-
-	if (resolved.status === "fallback") {
-		return (
-			<div className="flex min-h-0 flex-1 flex-col">
-				{header}
-				<WorkItemDetailState
-					message={resolved.message}
-					isLoading={resolved.isLoading}
-					isError={resolved.isError}
-					onRetry={resolved.onRetry}
-				/>
-			</div>
-		);
-	}
-
 	return (
 		<div className="@container flex min-h-0 flex-1 flex-col">
 			{header}
-			{/* Kept mounted (hidden via CSS, not unmounted) so Radix's
-			 *  ScrollArea i
```

**File**: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestCodeTab/PullRequestCodeTab.tsx` (renamed, +58/-36)
```diff
@@ -5,18 +5,20 @@ import type {
 	DiffLineAnnotation,
 	SelectedLineRange,
 } from "@pierre/diffs";
-import { parsePatchFiles } from "@pierre/diffs";
 import { CodeView, type CodeViewHandle } from "@pierre/diffs/react";
 import { FileTree as PierreFileTree, useFileTree } from "@pierre/trees/react";
 import { errorMessage } from "@superset/i18n/errors";
 import { sanitizePromptForPty } from "@superset/shared/agent-prompt-launch";
+import type { PullRequestDiff } from "@superset/shared/pull-request-diff";
 import { toast } from "@superset/ui/sonner";
 import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
 import { useCallback, useEffect, useMemo, useRef, useState } from "react";
 import {
 	type AgentPromptFileSide,
 	formatAgentPromptWithFileContext,
 } from "renderer/hooks/host-service/useSendToTerminalAgent";
+import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
+import { pullRequestRefFromUrl } from "renderer/lib/github/pullRequestRef";
 import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
 import {
 	createPierreTreeStyle,
@@ -32,11 +34,14 @@ import { DiffFileHeaderName } from "renderer/screens/main/components/DiffFileHea
 import { DiffViewToolbar } from "renderer/screens/main/components/DiffViewToolbar";
 import { ResizablePanel } from "renderer/screens/main/components/ResizablePanel";
 import { useWorkspaceCreates } from "renderer/stores/workspace-creates/useWorkspaceCreates";
-import { PullRequestCommentComposer } from "../PullRequestCommentComposer";
-import { PullRequestCommentThread } from "../PullRequestCommentThread";
+import { pullRequestReadErrorMessage } from "../../utils/combinePullRequestReadErrors";
+import { PullRequestCommentComposer } from "./components/PullRequestCommentComposer";
+import { PullRequestCommentThread } from "./components/PullRequestCommentThread";
+import { fetchPullRequestDiff } from "./utils/fetchPullRequestDiff";
+import { parsePullRequestPatch } from "./utils/parsePullRequestPatch";
 
 interface PullRequestCodeTabProps {
-	projectId: string;
+	projectId: string | null;
 	prNumber: number;
 	prUrl: string;
 	hostUrl: string;
@@ -141,25 +146,22 @@ interface ParsedFileDiff {
 // Left to throw on a malformed patch instead of swallowing the error —
 // callers need to tell "the PR genuinely has no changes" apart from "the
 // patch failed to parse", which look identical if this just returns [].
-function parseFileDiffs(patch: string): ParsedFileDiff[] {
-	if (!patch.trim()) return [];
-	return parsePatchFiles(patch, undefined, false).flatMap((parsedPatch) =>
-		parsedPatch.files.map((fileDiff, index) => {
-			let additions = 0;
-			let deletions = 0;
-			for (const hunk of fileDiff.hunks) {
-				additions += hunk.additionLines;
-				deletions += hunk.deletionLines;
-			}
-			return {
-				item: { id: `${fileDiff.name}-${index}`, type: "diff", fileDiff },
-				path: fileDiff.name,
-				status: CHANGE_TYPE_TO_PIERRE_STATUS[fileDiff.type] ?? "modified",
-				additions,
-				deletions,
-			};
-		}),
-	);
+function parseFileDiffs(diff: PullRequestDiff): ParsedFileDiff[] {
+	return parsePullRequestPatch(diff).map((fileDiff, index) => {
+		let additions = 0;
+		let deletions = 0;
+		for (const hunk of fileDiff.hunks) {
+			additions += hunk.additionLines;
+			deletions += hunk.deletionLines;
+		}
+		return {
+			item: { id: `${fileDiff.name}-${index}`, type: "diff", fileDiff },
+			path: fileDiff.name,
+			status: CHANGE_TYPE_TO_PIERRE_STATUS[fileDiff.type] ?? "modified",
+			additions,
+			deletions,
+		};
+	});
 }
 
 // Matches DiffPane's useDiffCommentComposer: a range spanning both an
@@ -282,13 +284,27 @@ export function PullRequestCodeTab({
 		[],
 	);
 	const queryClient = useQueryClient();
+	const organizationId = useActiveOrganizationId();
+	const repoFullName = pullRequestRefFromUrl(prUrl)?.repoFullName ?? null;
+	const canUseProject = !!projectId && !!hostUrl;
 
 	const { data, isLoading, error, refetch } = useQuery({
-		queryKey: ["pull-request-diff", projectId, hostUrl, prNumber],
-		queryFn: async () => {
-			const client = getHostServiceClientByUrl(hostUrl);
-			return client.pullRequests.getDiff.query({ projectId, prNumber });
-		},
+		queryKey: [
+			"pull-request-diff",
+			organizationId,
+			repoFullName,
+			projectId,
+			hostUrl,
+			prNumber,
+		],
+		queryFn: () =>
+			fetchPullRequestDiff({
+				projectId,
+				hostUrl,
+				prNumber,
+				repoFullName,
+				organizationId,
+			}),
 		staleTime: 30_000,
 		gcTime: 10 * 60_000,
 	});
@@ -301,7 +317,9 @@ export function PullRequestCodeTab({
 	];
 	const { data: threadsData, dataUpdatedAt: threadsUpdatedAt } = useQuery({
 		queryKey: threadsQueryKey,
+		enabled: canUseProject,
 		queryFn: async () => {
+			if (!projectId) return { reviewThreads: [], fetchFailed: false };
 			const client = getHostServiceClientByUrl(hostUrl);
 			return client.pullRequests.getThreads.query({ projectId, prNumber });
 		},
@@ -384,6 +402,8 @@ export
```

**File**: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestCodeTab/utils/fetchPullRequestDiff/fetchPullRequestDiff.test.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+import { expect, test } from "bun:test";
+
+test("pull request diff routing with isolated module mocks", () => {
+	const result = Bun.spawnSync({
+		cmd: [process.execPath, "test", `${import.meta.dir}/fixtures/checks.ts`],
+		env: { ...process.env, NODE_ENV: "test" },
+	});
+	expect(
+		result.exitCode,
+		result.stdout.toString() + result.stderr.toString(),
+	).toBe(0);
+});
```

**File**: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestCodeTab/utils/fetchPullRequestDiff/fetchPullRequestDiff.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import type { PullRequestDiff } from "@superset/shared/pull-request-diff";
+import { cloudTrpcClient } from "renderer/lib/cloud-trpc";
+import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
+import { combinePullRequestReadErrors } from "../../../../utils/combinePullRequestReadErrors";
+
+interface PullRequestDiffInput {
+	projectId: string | null;
+	hostUrl: string | null;
+	repoFullName: string | null;
+	prNumber: number;
+	organizationId: string | null;
+}
+
+export async function fetchPullRequestDiff({
+	projectId,
+	hostUrl,
+	repoFullName,
+	prNumber,
+	organizationId,
+}: PullRequestDiffInput): Promise<PullRequestDiff> {
+	let repositoryError: unknown;
+	if (hostUrl) {
+		if (projectId) {
+			try {
+				const client = getHostServiceClientByUrl(hostUrl);
+				return await client.pullRequests.getDiff.query({ projectId, prNumber });
+			} catch (error) {
+				if (!repoFullName) throw error;
+			}
+		}
+		if (repoFullName) {
+			try {
+				const client = getHostServiceClientByUrl(hostUrl);
+				return await client.pullRequests.getDiffByRepo.query({
+					repoFullName,
+					prNumber,
+				});
+			} catch (error) {
+				if (!organizationId) throw error;
+				repositoryError = error;
+			}
+		}
+	}
+	if (!organizationId || !repoFullName) {
+		throw new Error("No GitHub repository available to fetch the diff");
+	}
+	try {
+		return await cloudTrpcClient.integration.github.getPullRequestDiff.query({
+			organizationId,
+			repoFullName,
+			number: prNumber,
+		});
+	} catch (error) {
+		throw combinePullRequestReadErrors(repositoryError, error);
+	}
+}
```

---

### Incident Patch 15: `f03bcb3a` (2026-10-05)
**Commit Message**: fix(terminal): forward display server env to the PTY (#6013)

Terminal agents shell out to xclip/xsel/wl-paste to read images from the
clipboard, which needs DISPLAY plus XAUTHORITY on X11 or WAYLAND_DISPLAY on
Wayland. Neither reached the PTY: SHELL_BOOTSTRAP_KEYS omits them, so they are
absent from the shell snapshot the terminal env is built from, and
ALLOWED_ENV_VARS carried DISPLAY but not the auth cookie or the Wayland socket.

Image paste into Claude Code and Codex failed with "no image found on
clipboard" on every Linux session as a result.

Closes #5003

**File**: `apps/desktop/src/main/lib/terminal/env.test.ts` (modified, +13/-0)
```diff
@@ -298,6 +298,19 @@ describe("env", () => {
 				expect(result.BASH_ENV).toBe("/Users/test/.superset-dev/bash/rcfile");
 			});
 
+			it("should include X11/Wayland display vars (clipboard image paste, #5003)", () => {
+				const env = {
+					DISPLAY: ":0",
+					XAUTHORITY: "/tmp/xauth_abc123",
+					WAYLAND_DISPLAY: "wayland-0",
+					PATH: "/usr/bin",
+				};
+				const result = buildSafeEnv(env);
+				expect(result.DISPLAY).toBe(":0");
+				expect(result.XAUTHORITY).toBe("/tmp/xauth_abc123");
+				expect(result.WAYLAND_DISPLAY).toBe("wayland-0");
+			});
+
 			it("should include proxy vars (both cases)", () => {
 				const env = {
 					HTTP_PROXY: "http://proxy:8080",
```

**File**: `apps/desktop/src/main/lib/terminal/env.ts` (modified, +4/-0)
```diff
@@ -213,6 +213,10 @@ const ALLOWED_ENV_VARS = new Set([
 
 	// Terminal/display
 	"DISPLAY",
+	// X11 auth cookie and Wayland socket. Needed alongside DISPLAY so
+	// clipboard tools (xclip/xsel/wl-paste) can reach the display server. (#5003)
+	"XAUTHORITY",
+	"WAYLAND_DISPLAY",
 	"COLORTERM",
 	"TERM_PROGRAM",
 	"TERM_PROGRAM_VERSION",
```

**File**: `packages/host-service/src/terminal/clean-shell-env.test.ts` (modified, +17/-0)
```diff
@@ -25,6 +25,9 @@ describe("buildMinimalEnv", () => {
 		"HOME",
 		"PATH",
 		"SHELL",
+		"DISPLAY",
+		"XAUTHORITY",
+		"WAYLAND_DISPLAY",
 	];
 	const original: Record<string, string | undefined> = {};
 
@@ -57,6 +60,20 @@ describe("buildMinimalEnv", () => {
 		const env = buildMinimalEnv();
 		expect(env.SSH_AGENT_PID).toBe("12345");
 	});
+
+	test("propagates DISPLAY and XAUTHORITY so X11 clipboard reads work (#5003)", () => {
+		process.env.DISPLAY = ":0";
+		process.env.XAUTHORITY = "/tmp/xauth_abc123";
+		const env = buildMinimalEnv();
+		expect(env.DISPLAY).toBe(":0");
+		expect(env.XAUTHORITY).toBe("/tmp/xauth_abc123");
+	});
+
+	test("propagates WAYLAND_DISPLAY so Wayland clipboard reads work (#5003)", () => {
+		process.env.WAYLAND_DISPLAY = "wayland-0";
+		const env = buildMinimalEnv();
+		expect(env.WAYLAND_DISPLAY).toBe("wayland-0");
+	});
 });
 
 describe("augmentPathForMacOS", () => {
```

**File**: `packages/host-service/src/terminal/clean-shell-env.ts` (modified, +9/-0)
```diff
@@ -47,6 +47,15 @@ const SHELL_BOOTSTRAP_KEYS = [
 	"REQUESTS_CA_BUNDLE",
 	// System-level timezone override.
 	"TZ",
+	// Linux display server connection. Set by the display manager or session
+	// script, not by rc files. The bootstrap shell only sees what we pass here,
+	// so omitting these strips them from the snapshot that becomes the PTY env.
+	// Terminal agents shell out to xclip/xsel/wl-paste to read images from the
+	// clipboard; without a reachable display server those reads fail and image
+	// paste reports "no image in the clipboard". (#5003)
+	"DISPLAY",
+	"XAUTHORITY",
+	"WAYLAND_DISPLAY",
 ];
 
 const COMMON_MACOS_PATHS = [
```

#### Recent Merged Pull Requests:
- **PR #8204** (closed): test(desktop): larger hero on the new workspace screen (do not merge) (@saddlepaddle)
- **PR #8203** (2026-10-06): fix(plugins): list Slack app cards with their title and link (@saddlepaddle)
- **PR #8202** (2026-10-06): fix(plugins): dev builds stop writing plugin MCP entries into agent configs (@harshithmullapudi)
- **PR #8199** (2026-10-06): feat(acp-chat): sidebar parity, background work menu and subagents for ACP chat (@harshithmullapudi)
- **PR #8196** (2026-10-06): chore(sandbox): pin the box CLI to a build with `workspaces sleep` (@saddlepaddle)
- **PR #8195** (2026-10-06): docs(agents): assign new PRs to superset-home for a cloud review (@saddlepaddle)
- **PR #8194** (2026-10-06): feat(desktop): right pane area behind the right-pane-area flag (@harshithmullapudi)
- **PR #8192** (2026-10-06): fix(skills): connect Browser Use without "Allow remote debugging?" on every action (@Kitenite)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
