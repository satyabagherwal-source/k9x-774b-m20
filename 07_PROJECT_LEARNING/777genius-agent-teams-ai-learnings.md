# Forensic Learning Record (Deep Inspection): 777genius/agent-teams-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/777genius-agent-teams-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/777genius/agent-teams-ai](https://github.com/777genius/agent-teams-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:09:26.575Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `777genius/agent-teams-ai`
- **Description**: You're the boss, agents are your team. They handle tasks on their own, message each other, and review each other's work. You just watch the kanban board and give high-level commands. Codex/Claude/OpenCode/Cursor/Grok/GitHub/Kiro/Z.AI/Xiaomi/MiniMax/Kimi(300+ models, 200+ LLM providers, free models no auth) Build your AI company with multiple teams
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2232 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent-teams-controller/src/internal/reviewState.js`
```
const REVIEW_STATES = new Set(['none', 'review', 'needsFix', 'approved']);
const REVIEW_COLUMNS = new Set(['review', 'approved']);
const REVIEW_LIFECYCLE_EVENTS = new Set([
  'review_requested',
  'review_changes_requested',
  'review_approved',
  'review_started',
]);
const REVIEW_RESET_STATUSES = new Set(['in_progress', 'deleted']);

function normalizeReviewState(value) {
  const normalized = typeof value === 'string' && value.trim() ? value.trim() : '';
  return REVIEW_STATES.has(normalized) ? normalized : 'none';
}

function eventReviewState(event) {
  if (!event || typeof event !== 'object' || !REVIEW_LIFECYCLE_EVENTS.has(event.type)) {
    return null;
  }
  return normalizeReviewState(event.to);
}

function derivePendingReviewState(events, startIndex) {
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || typeof event !== 'object') continue;

    const reviewState = eventReviewState(event);
    if (reviewState) {
      return reviewState === 'needsFix'
        ? { state: 'needsFix', source: 'history_pending_needs_fix' }
        : { state: 'none', source: 'history_pending_reset' };
    }

    if (
      event.type === 'task_created' ||
      (event.type === 'status_changed' &&
        (REVIEW_RESET_STATUSES.has(event.to) || event.to === 'pending'))
    ) {
      return { state: 'none', source: 'history_pending_reset' };
    }
  }

  return { state: 'none', source: 'history_pending_reset' };
}

function getReviewStateFromHistory(task) {
  const events = Array.isArray(task && task.historyEvents) ? task.historyEvents : [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || typeof event !== 'object') continue;

    const reviewState = eventReviewState(event);
    if (reviewState) {
      return {
        state: reviewState,
        source: `history_${event.type}`,
      };
    }

    if (event.type === 'status_changed') {
      if (REVIEW_RESET_STATUSES.has(event.to)) {
        return {
          state: 'none',
          source: 'history_status_reset',
        };
      }
      if (event.to === 'pending') {
        return derivePendingReviewState(events, index);
      }
    }
  }

  return null;
}

function getEffectiveReviewState(task, kanbanEntry) {
  const historyState = getReviewStateFromHistory(task);
  if (historyState) {
    return historyState;
  }

  const status = typeof task?.status === 'string' ? task.status.trim() : '';
  const normalizeFallback = (state, source) => {
    const normalized = normalizeReviewState(state);
    if (normalized === 'none') {
      return null;
    }

    if (status === 'in_progress' || status === 'deleted') {
      return {
        state: 'none',
        source: `${source}_status_reset`,
      };
    }

    if (status === 'pending') {
      return normalized === 'needsFix'
        ? { state: 'needsFix', source: `${source}_pending_needs_fix` }
        : { state: 'none', source: `${source}_pending_reset` };
    }

    if (status === 'completed') {
      return normalized === 'review' || normalized === 'approved'
        ? { state: normalized, source }
        : { state: 'none', source: `${source}_completed_reset` };
    }

    return { state: normalized, source };
  };

  const persisted = normalizeReviewState(task && task.reviewState);
  const persistedFallback = normalizeFallback(persisted, 'task_review_state');
  if (persistedFallback) {
    return persistedFallback;
  }

  if (kanbanEntry && REVIEW_COLUMNS.has(kanbanEntry.column)) {
    const kanbanFallback = normalizeFallback(kanbanEntry.column, 'kanban_column');
    if (kanbanFallback) {
      return kanbanFallback;
    }
  }

  return {
    state: 'none',
    source: 'none',
  };
}

module.exports = {
  REVIEW_COLUMNS,
  REVIEW_LIFECYCLE_EVENTS,
  REVIEW_RESET_STATUSES,
  REVIEW_STATES,
  getEffectiveReviewState,
  getReviewStateFromHistory,
  normalizeReviewState,
};

```

### Core Architecture Module: `agent-teams-controller/src/internal/taskLifecycle.js`
```
/**
 * The board's single definition of "this task is still open work".
 *
 * Two independent places decide whether a board is finished: the board's own
 * completion notice to the lead (`notifyLeadWhenBoardCompleted` in `tasks.js`)
 * and the post-completion guard that stops a memoryless turn from restating its
 * final message to the user (`readBoardCompletionEpoch` in `messageStore.js`).
 * They must agree, or the same board is "done" for one of them and "open" for
 * the other, which either lets a restated final message through or suppresses a
 * message while review work is still on the board.
 *
 * A completed task that is in review or waiting for a fix is NOT finished: the
 * reviewer can still send it back, so work remains. A deleted task is not live
 * work and is therefore never open; `taskStore.listTasks` already drops deleted
 * rows unless the caller asks for them, so that arm only matters to a caller
 * that passes `includeDeleted`.
 *
 * Callers keep their own guard against a malformed row; this predicate answers
 * only for the task object it was given.
 */
function isTaskOpen(task) {
  if (task.status === 'deleted') return false;
  if (task.status !== 'completed') return true;
  return task.reviewState === 'review' || task.reviewState === 'needsFix';
}

module.exports = {
  isTaskOpen,
};

```

### Core Architecture Module: `landing/utils/downloadSelection.mjs`
```
export const selectDetectedDownloadAssetId = (os) => {
  if (os === 'windows') return 'windows';
  if (os === 'macos') return 'macos';
  if (os === 'linux') return 'linux-appimage';
  return '';
};

```

### Core Architecture Module: `landing/utils/platform.ts`
```
import type { PlatformArch, PlatformOs } from "~/types/platform";

type NavigatorUADataLike = {
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{
    architecture?: string;
    bitness?: string;
    platform?: string;
  }>;
};

type PlatformDetectionInput = string | {
  maxTouchPoints?: number;
  platform?: string;
  userAgent?: string;
  userAgentData?: NavigatorUADataLike;
};

const toInputParts = (input: PlatformDetectionInput) => {
  if (typeof input === "string") {
    return {
      maxTouchPoints: 0,
      platform: "",
      userAgent: input,
      userAgentData: undefined as NavigatorUADataLike | undefined,
    };
  }

  return {
    maxTouchPoints: input.maxTouchPoints ?? 0,
    platform: input.platform ?? "",
    userAgent: input.userAgent ?? "",
    userAgentData: input.userAgentData,
  };
};

const normalizePlatform = (platform: string): PlatformOs => {
  const value = platform.toLowerCase();
  if (value.includes("mac")) return "macos";
  if (value.includes("win")) return "windows";
  if (value === "linux" || /\blinux\b/.test(value)) return "linux";
  return "unknown";
};

const isLikelyNonDesktopDownloadDevice = (
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
  userAgentData?: NavigatorUADataLike,
) => {
  const ua = userAgent.toLowerCase();
  const legacyPlatform = platform.toLowerCase();

  return (
    userAgentData?.mobile === true ||
    /\b(android|iphone|ipad|ipod|mobile|tablet|windows phone|iemobile|windows ce|blackberry|bb10|webos)\b/.test(ua) ||
    (ua.includes("macintosh") && ua.includes("mobile/")) ||
    (legacyPlatform.startsWith("mac") && maxTouchPoints > 1)
  );
};

export const detectPlatform = (input: PlatformDetectionInput): PlatformOs => {
  const { maxTouchPoints, platform, userAgent, userAgentData } = toInputParts(input);
  if (isLikelyNonDesktopDownloadDevice(userAgent, platform, maxTouchPoints, userAgentData)) {
    return "unknown";
  }

  const hintedPlatform = normalizePlatform(userAgentData?.platform ?? "");
  if (hintedPlatform !== "unknown") return hintedPlatform;

  const ua = userAgent.toLowerCase();
  if (ua.includes("cros") || ua.includes("chrome os")) return "unknown";

  const legacyPlatform = normalizePlatform(platform);
  if (legacyPlatform !== "unknown") return legacyPlatform;

  if (ua.includes("windows") || ua.includes("win64") || ua.includes("win32")) return "windows";
  if (ua.includes("macintosh") || ua.includes("mac os x")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "unknown";
};

const normalizeArch = (architecture?: string, bitness?: string): PlatformArch => {
  const arch = (architecture ?? "").toLowerCase();
  const bits = bitness ?? "";

  if (!arch) return "unknown";
  if (arch.includes("arm") || arch.includes("aarch64")) return "arm64";
  if (arch.includes("x64") || arch.includes("amd64") || arch.includes("x86_64")) return "x64";
  if (arch.includes("x86")) return bits === "64" ? "x64" : "unknown";

  return "unknown";
};

export const detectArch = (input: PlatformDetectionInput): PlatformArch => {
  const { userAgent } = toInputParts(input);
  const ua = userAgent.toLowerCase();

  if (/\b(arm64|aarch64)\b/.test(ua)) return "arm64";
  if (/\b(x86_64|x64|amd64|win64)\b/.test(ua)) return "x64";
  return "unknown";
};

export const detectMacArchFromRenderer = (renderer: string): PlatformArch => {
  if (/\bapple\s+(?:m\d|gpu)\b|angle metal renderer:\s*apple/i.test(renderer)) {
    return "arm64";
  }

  if (/\b(intel|amd|ati|radeon|nvidia|geforce|quadro)\b/i.test(renderer)) {
    return "x64";
  }

  return "unknown";
};

const detectMacArchFromWebGl = (): PlatformArch => {
  if (typeof document === "undefined") return "unknown";

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return "unknown";

    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (!dbg) return "unknown";

    return detectMacArchFromRenderer(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? ""));
  } catch {
    return "unknown";
  }
};

export const detectMacArch = (input: PlatformDetectionInput): PlatformArch => {
  const { userAgent } = toInputParts(input);
  const ua = userAgent.toLowerCase();
  if (/\b(arm64|aarch64)\b/.test(ua)) return "arm64";
  if (/\b(x86_64|x64|amd64)\b/.test(ua)) return "x64";

  return detectMacArchFromWebGl();
};

export const detectArchFromClientHints = async (
  userAgentData?: NavigatorUADataLike,
): Promise<PlatformArch> => {
  try {
    const values = await userAgentData?.getHighEntropyValues?.(["architecture", "bitness"]);
    return normalizeArch(values?.architecture, values?.bitness);
  } catch {
    return "unknown";
  }
};

export const detectMacArchFromClientHints = detectArchFromClientHints;

export const detectArchFromNavigator = async (
  input: PlatformDetectionInput,
): Promise<PlatformArch> => {
  const { userAgentData } = toInputParts(input);
  const hintedArch = await detectArchFromClientHints(userAgentData);
  if (hintedArch !== "unknown") return hintedArch;

  return detectArch(input);
};

export const detectMacArchFromNavigator = async (
  input: PlatformDetectionInput,
): Promise<PlatformArch> => {
  const hintedArch = await detectArchFromNavigator(input);
  if (hintedArch !== "unknown") return hintedArch;

  return detectMacArch(input);
};

```

### Core Architecture Module: `landing/utils/releaseDownloads.ts`
```
import type { DownloadArch, DownloadOs } from '../data/downloads';

export type ReleaseAsset = { name: string; browser_download_url: string; url?: string };
export type GitHubRelease = {
  tag_name: string;
  body: string | null;
  published_at: string | null;
  assets: ReleaseAsset[];
};
type Variant = {
  url: string | null;
  platformKey: string | null;
  version: string | null;
  pubDate: string | null;
};
export type DownloadsApiResponse = {
  ok: boolean;
  source: 'github-releases';
  fetchedAt: string;
  version: string | null;
  notes: string | null;
  pubDate: string | null;
  manifestValid: boolean;
  variants: {
    macos: { arm64: Variant; x64: Variant; universal: Variant };
    windows: { arm64: Variant; x64: Variant };
    linux: { appimage: Variant; deb: Variant };
  };
};
type Candidate = {
  asset: ReleaseAsset;
  os: DownloadOs;
  slot: string;
  version: string;
  rank: number;
};
type PlatformManifest = {
  versions: { windows: string; linux: string; mac: string };
  macDate: string | null;
};
export type ResolvedDownload = { url: string; version: string | null; pubDate: string | null };
const CACHE_SCHEMA = 2;
const CACHE_TTL = 10 * 60 * 1000;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const emptyVariant = (): Variant => ({
  url: null,
  platformKey: null,
  version: null,
  pubDate: null,
});

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function date(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function version(value: unknown): string | null {
  return typeof value === 'string' && VERSION.test(value) ? value : null;
}

export function readGitHubRelease(value: unknown, repository: string): GitHubRelease | null {
  const release = record(value);
  if (!release || typeof release.tag_name !== 'string' || !Array.isArray(release.assets))
    return null;
  const tagVersion = version(release.tag_name.replace(/^v/, ''));
  if (!tagVersion || !/^[\w.-]+\/[\w.-]+$/.test(repository)) return null;
  const prefix = `https://github.com/${repository}/releases/download/${encodeURIComponent(release.tag_name)}/`;
  const assets: ReleaseAsset[] = [];
  for (const value of release.assets) {
    const asset = record(value);
    if (!asset || typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string')
      continue;
    // Only links to this release in the configured repository are usable downloads.
    if (asset.browser_download_url !== `${prefix}${encodeURIComponent(asset.name)}`) continue;
    assets.push({
      name: asset.name,
      browser_download_url: asset.browser_download_url,
      ...(typeof asset.url === 'string' ? { url: asset.url } : {}),
    });
  }
  return {
    tag_name: release.tag_name,
    body: typeof release.body === 'string' ? release.body : null,
    published_at: date(release.published_at),
    assets,
  };
}

export function manifestAssetApiUrl(release: GitHubRelease, repository: string): string | null {
  const assets = release.assets.filter((asset) => asset.name === 'release-platform-manifest.json');
  const url = assets.length === 1 ? assets[0]?.url : null;
  const prefix = `https://api.github.com/repos/${repository}/releases/assets/`;
  return url?.startsWith(prefix) && /^\d+$/.test(url.slice(prefix.length)) ? url : null;
}

function candidate(asset: ReleaseAsset): Candidate | null {
  const patterns: { pattern: RegExp; os: DownloadOs; slot: string }[] = [
    {
      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)-(.+)-arm64\.dmg$/,
      os: 'macos',
      slot: 'arm64',
    },
    {
      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)-(.+)-x64\.dmg$/,
      os: 'macos',
      slot: 'x64',
    },
    { pattern: /^(Claude\.Agent\.Teams\.UI)-(.+)\.dmg$/, os: 'macos', slot: 'x64' },
    {
      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)-(.+)-(?:arm64|x64)-mac\.zip$/,
      os: 'macos',
      slot: 'zip',
    },
    { pattern: /^(Claude\.Agent\.Teams\.UI)-(.+)-mac\.zip$/, os: 'macos', slot: 'zip' },
    {
      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)\.Setup\.(.+)-arm64\.exe$/,
      os: 'windows',
      slot: 'arm64',
    },
    {
      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)\.Setup\.(.+)\.exe$/,
      os: 'windows',
      slot: 'x64',
    },
    {
      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)-(.+)\.AppImage$/,
      os: 'linux',
      slot: 'appimage',
    },
    {
      pattern: /^(agent-teams-ai|claude-agent-teams-ui)_(.+)_amd64\.deb$/,
      os: 'linux',
      slot: 'deb',
    },
    {
      pattern: /^(agent-teams-ai|claude-agent-teams-ui)-(.+)\.x86_64\.rpm$/,
      os: 'linux',
      slot: 'rpm',
    },
    {
      pattern: /^(agent-teams-ai|claude-agent-teams-ui)-(.+)\.pacman$/,
      os: 'linux',
      slot: 'pacman',
    },
  ];
  for (const { pattern, os, slot } of patterns) {
    const match = pattern.exec(asset.name);
    const parsedVersion = version(match?.[2]);
    if (match && parsedVersion)
      return {
        asset,
        os,
        slot,
        version: parsedVersion,
        rank: match[1] === 'Agent.Teams.AI' || match[1] === 'agent-teams-ai' ? 0 : 1,
      };
  }
  return null;
}

function readManifest(
  value: unknown,
  release: GitHubRelease,
  repository: string,
  candidates: Candidate[]
): PlatformManifest | null {
  const manifest = record(value);
  const input = record(manifest?.input);
  const target = record(input?.target);
  const versions = record(manifest?.versions);
  const windows = version(versions?.windows);
  const linux = version(versions?.linux);
  const mac = version(versions?.mac);
  const latest = release.tag_name.replace(/^v/, '');
  if (
    manifest?.schemaVersion !== 1 ||
    manifest.phase !== 'assembled' ||
    input?.repository !== repository ||
    target?.tag !== release.tag_name ||
    !windows ||
    !linux ||
    !mac ||
    windows !== latest ||
    linux !== latest
  )
    return null;
  if (input.mode !== 'full' && input.mode !== 'carry-mac') return null;
  if (input.mode === 'full' && mac !== latest) return null;
  let macDate = release.published_at;
  if (input.mode === 'carry-mac') {
    const source = record(record(input.macSource)?.release);
    if (mac === latest || source?.tag !== `v${mac}` || !date(source.createdAt)) return null;
    macDate = date(source.publishedAt);
  }
  const expected = [
    `Agent.Teams.AI.Setup.${windows}.exe`,
    `Agent.Teams.AI.Setup.${windows}-arm64.exe`,
    `Agent.Teams.AI-${linux}.AppImage`,
    `agent-teams-ai_${linux}_amd64.deb`,
    `agent-teams-ai-${linux}.x86_64.rpm`,
    `agent-teams-ai-${linux}.pacman`,
    `Agent.Teams.AI-${mac}-arm64.dmg`,
    `Agent.Teams.AI-${mac}-x64.dmg`,
    `Agent.Teams.AI-${mac}-arm64-mac.zip`,
    `Agent.Teams.AI-${mac}-x64-mac.zip`,
  ];
  if (!expected.every((name) => release.assets.filter((asset) => asset.name === name).length === 1))
    return null;
  if (
    candidates.some(
      (item) =>
        item.rank === 0 && item.version !== (item.os === 'macos' ? mac : versions?.[item.os])
    )
  )
    return null;
  return { versions: { windows, linux, mac }, macDate };
}

function selectVariant(
  candidates: Candidate[],
  release: GitHubRelease,
  manifest: PlatformManifest | null,
  os: DownloadOs,
  slot: string,
  aliases: string[]
): Variant {
  const matching = candidates
    .filter((item) => item.os === os && item.slot === slot)
    .sort((a, b) => a.rank - b.rank || a.asset.name.localeCompare(b.asset.name));
  const bestRank = matching[0]?.rank;
  const best = matching.filter((item) => item.rank === bestRank);
  if (best.length === 1) {
    const item = best[0];
    if (!item) return emptyVariant();
    const pubDate =
      os === 'macos' && manifest
        ? manifest.macDate
        : item.version === release.tag_name.replace(/^v/, '')
          ? release.published_at
          : null;
    return {
      url: item.asset.browser_download_url,
      platformKey: item.asset.name,
      version: item.version,
      pubDate,
    };
  }
  // Ambiguous canonical payloads cannot acquire a version from a generic alias.
  for (const name of aliases) {
    const assets = release.assets.filter((asset) => asset.name === name);
    const asset = assets.length === 1 ? assets[0] : null;
    if (asset)
      return { ...emptyVariant(), url: asset.browser_download_url, platformKey: asset.name };
  }
  return emptyVariant();
}

export function parseReleaseDownloads(
  release: GitHubRelease,
  repository: string,
  manifestValue: unknown = null,
  now = Date.now()
): DownloadsApiResponse {
  const candidates = release.assets
    .map(candidate)
    .filter((item): item is Candidate => item !== null);
  const manifest = readManifest(manifestValue, release, repository, candidates);
  const select = (os: DownloadOs, slot: string, aliases: string[]) =>
    selectVariant(candidates, release, manifest, os, slot, aliases);
  return {
    ok: release.assets.length > 0,
    source: 'github-releases',
    fetchedAt: new Date(now).toISOString(),
    version: release.tag_name.replace(/^v/, ''),
    notes: release.body,
    pubDate: release.published_at,
    manifestValid: manifest !== null,
    variants: {
      macos: {
        arm64: select('macos', 'arm64', [
          'Agent.Teams.AI-arm64.dmg',
          'Claude-Agent-Teams-UI-arm64.dmg',
        ]),
        x64: select('macos', 'x64', ['Agent.Teams.AI-x64.dmg', 'Claude-Agent-Teams-UI-x64.dmg']),
        universal: emptyVariant(),
      },
      windows: {
        arm64: select('windows', 'arm64', ['Agent.Teams.AI.Setup-arm64.exe']),
        x64: select('windows', 'x64', [
          'Agent.Teams.AI.Setup.exe',
          'Claude-Agent-Teams-UI-Setup.exe',
        ]),
      },
      linux: {
        appimage: select('linux', 'appimage', [
          'Agent.Teams.A
```

### Core Architecture Module: `landing/utils/windowsReleaseDownloads.mjs`
```
const emptyVariant = { url: null, platformKey: null, version: null };

function toVariant(asset, version) {
  if (!asset) return { ...emptyVariant };
  return { url: asset.browser_download_url, platformKey: asset.name, version };
}

export function parseWindowsReleaseVariants(assets, version) {
  const arm64 = assets.find((asset) => /-arm64\.(?:exe|msi)$/i.test(asset.name)) || null;
  const x64 =
    assets.find(
      (asset) => /\.(?:exe|msi)$/i.test(asset.name) && !/-arm64\.(?:exe|msi)$/i.test(asset.name),
    ) || null;

  return {
    arm64: toVariant(arm64, version),
    x64: toVariant(x64, version),
  };
}

export function resolveWindowsReleaseDownload(variants, releaseVersion, arch) {
  if (arch !== 'arm64' && arch !== 'x64') return null;
  const variant = arch === 'arm64' ? variants.arm64 : variants.x64;
  return variant?.url ? { url: variant.url, version: variant.version || releaseVersion } : null;
}

```

### Core Architecture Module: `mcp-server/src/utils/format.ts`
```
export function jsonTextContent(value: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

/**
 * Strips heavy fields (comments, historyEvents, workIntervals) from a full task
 * object to produce a lightweight summary suitable for MCP tool results of
 * write operations. This prevents context bloat — a task with 14 comments can
 * be 25 KB; the summary is < 1 KB.
 *
 * Only strip from the top-level `task` field; leave other fields intact.
 */
export function taskWriteResult(result: Record<string, unknown>): Record<string, unknown> {
  const task = result.task;
  if (task == null || typeof task !== 'object') return result;

  return { ...result, task: slimTask(task as Record<string, unknown>) };
}

/**
 * Minimal task confirmation for write operations (status changes, owner
 * assignment, comments, etc.). Uses an allowlist — only fields the caller
 * needs to verify the mutation succeeded. Agents already know what they
 * modified, so description/prompt/timestamps are unnecessary here.
 */
export function slimTask(full: Record<string, unknown>): Record<string, unknown> {
  return {
    id: full.id,
    displayId: full.displayId,
    subject: full.subject,
    status: full.status,
    owner: full.owner,
    reviewState: full.reviewState,
    needsClarification: full.needsClarification,
    blockedBy: full.blockedBy,
    blocks: full.blocks,
    commentCount: Array.isArray(full.comments) ? full.comments.length : 0,
  };
}

/**
 * Fields that grow unboundedly and dominate context usage.
 * Everything else passes through — new task fields are included by default.
 */
const HEAVY_TASK_FIELDS = new Set(['comments', 'historyEvents', 'workIntervals']);

/**
 * Lightweight task representation for task_list.
 *
 * Uses a BLOCKLIST approach: strips only known heavy array fields and replaces
 * `comments` with `commentCount`. All other fields (including any future ones)
 * pass through automatically. This avoids silently dropping new fields when
 * the task schema evolves.
 */
export function slimTaskForList(full: Record<string, unknown>): Record<string, unknown> {
  const slim: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(full)) {
    if (!HEAVY_TASK_FIELDS.has(key)) {
      slim[key] = value;
    }
  }

  if (Array.isArray(full.comments)) {
    slim.commentCount = full.comments.length;
  } else {
    slim.commentCount = 0;
  }

  return slim;
}

```

### Core Architecture Module: `mcp-server/src/utils/schemas.ts`
```
import { z } from 'zod';

export const taskRefSchema = z.object({
  taskId: z.string().min(1),
  displayId: z.string().min(1),
  teamName: z.string().min(1),
});

export const teamMemberMcpPolicySchema = z.object({
  mode: z.enum(['inheritLead', 'inheritScopes', 'strictAllowlist', 'appOnly']),
  scopes: z
    .object({
      user: z.boolean().optional(),
      project: z.boolean().optional(),
      local: z.boolean().optional(),
    })
    .optional(),
  serverNames: z.array(z.string().min(1).max(128)).optional(),
});

```

### Core Architecture Module: `mcp-server/src/utils/taskCreationIdempotency.ts`
```
import { createHash } from 'node:crypto';

const MCP_TASK_CREATION_NAMESPACE = 'agent-teams-mcp';
export const CANONICAL_TASK_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface TaskCreationBoard {
  createTask(input: Record<string, unknown>): unknown;
  reconcileTaskCreation(input: Record<string, unknown>): unknown;
}

export interface OptionalTaskCreateIdentity {
  teamName: string;
  commandId?: string;
  idempotencyKey?: string;
}

export function resolveOptionalTaskCreateCommandId(
  identity: OptionalTaskCreateIdentity
): string | undefined {
  const commandId = normalizeOptionalValue(identity.commandId);
  const idempotencyKey = normalizeOptionalValue(identity.idempotencyKey);
  if (!commandId && !idempotencyKey) {
    return undefined;
  }

  if (commandId && !CANONICAL_TASK_UUID_PATTERN.test(commandId)) {
    throw new Error('task_create commandId must be a canonical task UUID (version 1-5)');
  }
  const idempotencyCommandId = idempotencyKey
    ? CANONICAL_TASK_UUID_PATTERN.test(idempotencyKey)
      ? idempotencyKey.toLowerCase()
      : deriveUuid(['task_create', identity.teamName, idempotencyKey])
    : undefined;

  if (commandId && idempotencyCommandId && commandId.toLowerCase() !== idempotencyCommandId) {
    throw new Error('task_create commandId and idempotencyKey identify different requests');
  }
  return commandId?.toLowerCase() ?? idempotencyCommandId;
}

export function resolveMessageTaskCommandId(input: {
  teamName: string;
  messageId: string;
  requestKey?: string;
}): string | undefined {
  const requestKey = normalizeOptionalValue(input.requestKey);
  if (!requestKey) {
    return undefined;
  }
  return deriveUuid(['task_create_from_message', input.teamName, input.messageId, requestKey]);
}

export function createTaskWithOptionalIdempotency(input: {
  taskBoard: TaskCreationBoard;
  teamName: string;
  operation: 'task.create' | 'task.create_from_message';
  payload: Record<string, unknown>;
  commandId?: string;
}): unknown {
  if (!input.commandId) {
    return input.taskBoard.createTask(input.payload);
  }

  const commandPayload = {
    ...input.payload,
    id: input.commandId,
    // MCP callers may choose their command id, so an unrelated legacy task
    // at that UUID must never be adopted as a retry of this request.
    allowLegacyAdoption: false,
    creationCommand: {
      namespace: MCP_TASK_CREATION_NAMESPACE,
      scopeKey: input.teamName,
      operation: input.operation,
      commandId: input.commandId,
      payloadHash: hashPayload(input.payload),
    },
  };

  try {
    return withoutCreationCommand(input.taskBoard.createTask(commandPayload));
  } catch (error) {
    if (!isExistingCommandTaskError(error, input.commandId)) {
      throw error;
    }
    return withoutCreationCommand(input.taskBoard.reconcileTaskCreation(commandPayload));
  }
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function deriveUuid(parts: string[]): string {
  const hex = createHash('sha256').update(parts.join('\0')).digest('hex');
  const versioned = `${hex.slice(0, 12)}5${hex.slice(13, 16)}`;
  const variant = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const normalized = `${versioned}${variant}${hex.slice(17, 32)}`;
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;
}

function hashPayload(payload: Record<string, unknown>): string {
  return `sha256:${createHash('sha256').update(stableJson(payload)).digest('hex')}`;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Task creation payload must contain only finite numbers');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  throw new TypeError(`Task creation payload contains unsupported ${typeof value} value`);
}

function isExistingCommandTaskError(error: unknown, commandId: string): boolean {
  return error instanceof Error && error.message === `Task already exists: ${commandId}`;
}

function withoutCreationCommand(value: unknown): unknown {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return value;
  }
  const { creationCommand: _creationCommand, ...task } = value as Record<string, unknown>;
  return task;
}

```

### Core Architecture Module: `mcp-server/src/utils/teamConfig.ts`
```
import fs from 'node:fs';
import path from 'node:path';

import { getController } from '../controller';

function unknownTeamMessage(teamName: string): string {
  return `Unknown team "${teamName}". Board tools require an existing configured team with config.json. Use the real board teamName from durable team context - never use a member or lead name as teamName.`;
}

function resolveTeamPaths(
  teamName: string,
  claudeDir?: string
): {
  configPath: string;
  membersMetaPath: string;
  metaPath: string;
} {
  const controller = getController(teamName, claudeDir) as {
    context?: { paths?: { teamDir?: string } };
  };
  const teamDir = controller.context?.paths?.teamDir;
  if (typeof teamDir !== 'string' || teamDir.trim().length === 0) {
    throw new Error(unknownTeamMessage(teamName));
  }
  return {
    configPath: path.join(teamDir, 'config.json'),
    membersMetaPath: path.join(teamDir, 'members.meta.json'),
    metaPath: path.join(teamDir, 'team.meta.json'),
  };
}

function readJsonObject(filePath: string): Record<string, unknown> | null {
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isConfiguredTeamConfig(value: Record<string, unknown> | null): boolean {
  return typeof value?.name === 'string' && value.name.trim().length > 0;
}

function isDraftTeamMeta(value: Record<string, unknown> | null): boolean {
  return value?.version === 1 && typeof value.cwd === 'string' && value.cwd.trim().length > 0;
}

export function assertConfiguredTeam(teamName: string, claudeDir?: string): void {
  const { configPath } = resolveTeamPaths(teamName, claudeDir);
  const parsed = readJsonObject(configPath);
  if (!parsed || !isConfiguredTeamConfig(parsed)) {
    throw new Error(unknownTeamMessage(teamName));
  }
}

export function assertConfiguredTaskActor(
  teamName: string,
  actor: string,
  claudeDir?: string
): string {
  const normalizedActor = actor.trim();
  if (normalizedActor.toLowerCase() === 'user') {
    return 'user';
  }

  const { configPath, membersMetaPath } = resolveTeamPaths(teamName, claudeDir);
  const parsed = readJsonObject(configPath);
  if (!parsed || !isConfiguredTeamConfig(parsed)) {
    throw new Error(unknownTeamMessage(teamName));
  }

  const memberNamesByKey = new Map<string, string>();
  const applyMember = (member: unknown, fromMeta: boolean): void => {
    if (!member || typeof member !== 'object') {
      return;
    }
    const record = member as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) {
      return;
    }
    const key = name.toLowerCase();
    if (fromMeta && typeof record.removedAt === 'number') {
      memberNamesByKey.delete(key);
      return;
    }
    memberNamesByKey.set(key, name);
  };

  if (Array.isArray(parsed.members)) {
    for (const member of parsed.members) {
      applyMember(member, false);
    }
  }

  const membersMeta = readJsonObject(membersMetaPath);
  if (Array.isArray(membersMeta?.members)) {
    for (const member of membersMeta.members) {
      applyMember(member, true);
    }
  }

  const configuredMemberName = memberNamesByKey.get(normalizedActor.toLowerCase());
  if (configuredMemberName) {
    return configuredMemberName;
  }

  throw new Error(
    `Unknown task actor "${normalizedActor}". Use "user" or a configured team member name.`
  );
}

export function assertConfiguredOrDraftTeam(teamName: string, claudeDir?: string): void {
  const { configPath, metaPath } = resolveTeamPaths(teamName, claudeDir);
  if (isConfiguredTeamConfig(readJsonObject(configPath))) {
    return;
  }

  if (isDraftTeamMeta(readJsonObject(metaPath))) {
    return;
  }

  throw new Error(unknownTeamMessage(teamName));
}

```

### Core Architecture Module: `packages/agent-graph/src/canvas/bloom-renderer.ts`
```
/**
 * Post-processing bloom effect.
 * Adapted from agent-flow's bloom-renderer.ts (Apache 2.0).
 * Zero imports — pure Canvas 2D.
 */

export class BloomRenderer {
  #bloomCanvas: HTMLCanvasElement;
  #bloomCtx: CanvasRenderingContext2D;
  #tempCanvas: HTMLCanvasElement;
  #tempCtx: CanvasRenderingContext2D;
  #intensity: number;
  #w = 0;
  #h = 0;

  constructor(intensity = 0.6) {
    this.#intensity = intensity;
    this.#bloomCanvas = document.createElement('canvas');
    this.#bloomCtx = this.#bloomCanvas.getContext('2d')!;
    this.#tempCanvas = document.createElement('canvas');
    this.#tempCtx = this.#tempCanvas.getContext('2d')!;
  }

  resize(w: number, h: number): void {
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    if (this.#w === hw && this.#h === hh) return;
    this.#w = hw;
    this.#h = hh;
    this.#bloomCanvas.width = hw;
    this.#bloomCanvas.height = hh;
    this.#tempCanvas.width = hw;
    this.#tempCanvas.height = hh;
  }

  setIntensity(v: number): void {
    this.#intensity = Math.max(0, Math.min(1, v));
  }

  apply(source: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D): void {
    if (this.#intensity <= 0 || this.#w === 0) return;

    this.#bloomCtx.clearRect(0, 0, this.#w, this.#h);
    this.#bloomCtx.drawImage(source, 0, 0, this.#w, this.#h);

    const radii = [8, 6, 4];
    for (const r of radii) {
      this.#tempCtx.clearRect(0, 0, this.#w, this.#h);
      this.#tempCtx.filter = `blur(${r}px)`;
      this.#tempCtx.drawImage(this.#bloomCanvas, 0, 0);
      this.#tempCtx.filter = 'none';

      this.#bloomCtx.clearRect(0, 0, this.#w, this.#h);
      this.#bloomCtx.drawImage(this.#tempCanvas, 0, 0);
    }

    const prevOp = targetCtx.globalCompositeOperation;
    const prevAlpha = targetCtx.globalAlpha;
    targetCtx.globalCompositeOperation = 'lighter';
    targetCtx.globalAlpha = this.#intensity;
    targetCtx.drawImage(this.#bloomCanvas, 0, 0, source.width, source.height);
    targetCtx.globalCompositeOperation = prevOp;
    targetCtx.globalAlpha = prevAlpha;
  }

  [Symbol.dispose](): void {
    this.#w = 0;
    this.#h = 0;
  }
}

```

### Core Architecture Module: `packages/agent-graph/src/canvas/render-cache.ts`
```
/**
 * Pre-rendered sprite cache for Canvas 2D glow effects.
 * Adapted from agent-flow (Apache 2.0).
 */

const glowCache = new Map<string, HTMLCanvasElement>();
const textCache = new Map<string, number>();
const TEXT_CACHE_LIMIT = 2000;

// ─── Color resolution: named colors → hex ───────────────────────────────────

let _resolverCtx: CanvasRenderingContext2D | null = null;
const _hexCache = new Map<string, string>();

/**
 * Ensure a color string is in #rrggbb hex format.
 * Resolves CSS named colors (purple → #800080), shorthand (#abc → #aabbcc).
 */
function ensureHex(color: string): string {
  if (color.startsWith('#') && color.length === 7) return color;

  let hex = _hexCache.get(color);
  if (hex) return hex;

  if (color.startsWith('#') && color.length === 4) {
    hex = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  } else {
    // Resolve named/rgb/hsl colors via canvas
    _resolverCtx ??= document.createElement('canvas').getContext('2d')!;
    _resolverCtx.fillStyle = '#000000';
    _resolverCtx.fillStyle = color;
    hex = _resolverCtx.fillStyle; // always returns #rrggbb
  }

  _hexCache.set(color, hex);
  return hex;
}

/** Build a hex color with alpha: "#rrggbbaa" — cached for repeated calls */
const _hexAlphaCache = new Map<string, string>();
function hexWithAlpha(color: string, alpha: number): string {
  // Quantize alpha to 1/255 steps for cache hit rate
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  const key = `${color}|${a}`;
  let result = _hexAlphaCache.get(key);
  if (result) return result;
  result = ensureHex(color) + alphaHex(a / 255);
  _hexAlphaCache.set(key, result);
  if (_hexAlphaCache.size > 500) _hexAlphaCache.clear(); // prevent unbounded growth
  return result;
}

// Reuse alpha hex LUT from colors.ts (DRY — single source)
import { alphaHex } from '../constants/colors';

// ─── Glow Sprite Cache ──────────────────────────────────────────────────────

/**
 * Get or create a pre-rendered radial gradient glow sprite.
 */
export function getGlowSprite(
  color: string,
  radius: number,
  innerAlpha: number,
  outerAlpha: number,
): HTMLCanvasElement {
  const hex = ensureHex(color);
  const key = `${hex}|${radius}|${innerAlpha}|${outerAlpha}`;
  let canvas = glowCache.get(key);
  if (canvas) return canvas;

  const size = Math.ceil(radius * 2);
  canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;

  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, radius);
  grad.addColorStop(0, hexWithAlpha(hex, innerAlpha));
  grad.addColorStop(1, hexWithAlpha(hex, outerAlpha));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  glowCache.set(key, canvas);
  return canvas;
}

/**
 * Get or create a pre-rendered agent glow sprite (inner + outer radius).
 */
export function getAgentGlowSprite(
  color: string,
  innerRadius: number,
  outerRadius: number,
): HTMLCanvasElement {
  const hex = ensureHex(color);
  const key = `agent|${hex}|${innerRadius}|${outerRadius}`;
  let canvas = glowCache.get(key);
  if (canvas) return canvas;

  const size = Math.ceil(outerRadius * 2);
  canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;

  const grad = ctx.createRadialGradient(cx, cx, innerRadius, cx, cx, outerRadius);
  grad.addColorStop(0, hexWithAlpha(hex, 0.25));
  grad.addColorStop(0.5, hexWithAlpha(hex, 0.08));
  grad.addColorStop(1, hexWithAlpha(hex, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  glowCache.set(key, canvas);
  return canvas;
}

/**
 * Cached text width measurement.
 */
export function measureTextCached(ctx: CanvasRenderingContext2D, font: string, text: string): number {
  const key = `${font}|${text}`;
  let w = textCache.get(key);
  if (w !== undefined) return w;

  if (textCache.size > TEXT_CACHE_LIMIT) textCache.clear();

  const prevFont = ctx.font;
  ctx.font = font;
  w = ctx.measureText(text).width;
  ctx.font = prevFont;
  textCache.set(key, w);
  return w;
}

/** Exported for use by draw functions that need hex+alpha colors */
export { ensureHex, hexWithAlpha };

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #765** (2026-09-28): **[BUG] OpenCode provider diagnostics fails because disabled Managed Cursor requires an absolute native executable.**
  *Symptoms*: ## Summary  OpenCode provider diagnostics fail because Agent Teams attempts to initialize the disabled Managed Cursor provider. This prevents OpenCode provider/model diagnostics from completing.  ## Area  - Provider runtime (OpenCode) - Settings / authentication  ## Steps to reproduce  1. Open Agent Teams AI. 2. Open **Providers & Plans** or **Provider Settings**. 3. Leave Cursor disabled; do not install or connect it. 4. Configure or select the OpenCode provider. 5. Run OpenCode provider diagnostics/model discovery. 6. See the error: `Managed Cursor requires an absolute native executable`.  ## Frequency  Always.  ## Regression  Unknown. First encountered on the current installation.  ## Actual behavior  OpenCode diagnostics fail with:      Runtime provider management command failed unexpectedly:     Managed Cursor requires an absolute native executable  The failure occurs even though Cursor is not enabled or connected.  ## Expected behavior  Disabled providers should not be initialized or required for OpenCode diagnostics. OpenCode provider discovery should run independently of Cursor Agent availability.  ## Environment  - OS and version: macOS, Apple Silicon - App version: 2.15.0 - Install type: GitHub release - Provider/runtime involved: OpenCode - Desktop app mode: Electron - Intended model provider: OpenRouter  ## Logs and diagnostics  ```     Error code: runtime-unhealthy     Summary: Runtime provider management command failed unexpectedly:     Managed Cursor requires a
  **Post-Mortem & Fix Analysis**:
  > Fixed and released in v2.17.1: https://github.com/777genius/agent-teams-ai/releases/tag/v2.17.1  The OpenCode runtime fix is in https://github.com/777genius/agent_teams_orchestrator/pull/102. The missing-Cursor end-to-end coverage is in https://github.com/777genius/agent-teams-ai/pull/770. Provider Settings now lets users select non-Cursor models without Cursor CLI installed.
  > @chrisyoungbrighte Hi! You’ve found a critical bug - thank you so much for that. It’s extremely useful that I found out about this.  Please test this if possible 🙏🏼

- **Issue #509** (2026-08-31): **[BUG] Team launch fails immediately with no UI error**
  *Symptoms*: **Summary** A team that used to launch fine now dies on Launch. The button goes to Starting and immediately back to Launch. Nothing shows in the UI. A copy of the team on the same repo launches. The log says one member worktree is on branch `m0merge` instead of the branch the app expected.  **Area** Which part of the app is affected? - Agent teams / teammate launch - Built-in editor / Git - Provider runtime (Claude, Codex, OpenCode)  **Steps to reproduce** 1. Use a team that already has per-member worktrees under `~/Library/Application Support/agent-teams-ai/data/team-worktrees/<team-id>/<team>/<member>/`. 2. Launch that team at least once so those worktrees exist. 3. In one member worktree, check out another branch. Mine was on `m0merge`. The app expected `agent-teams/<team>/<member>-<suffix>`. 4. Stop the team. 5. Click Launch.  **Frequency** Always, as long as that worktree stays on the wrong branch.  **Regression** Yes. This team launched on 2.12.0, then it stopped. I do not have an older app version to compare. A copy of the team on the same repo launched because it got new worktrees.  **Actual behavior** Starting flashes, then Launch comes back. No error notification.  `~/Library/Logs/agent-teams-ai/app-errors.ndjson` has:  `[teams:launch] Worktree path is checked out on "m0merge", expected "agent-teams/<team>/<member>-<suffix>": .../Application Support/agent-teams-ai/data/team-worktrees/<team-id>/<team>/<member>`   **Expected behavior** If launch cannot start because a
  **Post-Mortem & Fix Analysis**:
  > Hi! Thanks for the information! This has been fixed and will be in the next release! 🚀 

- **Issue #443** (2026-09-03): **[BUG] OpenCode command timed out**
  *Symptoms*: **Summary** Failed to query OpenCode agents: OpenCode command timed out after 10000ms  **Area** Which part of the app is affected? - Agent teams / teammate launch  **Steps to reproduce** Try to start the project  **Frequency** Always  **Environment** macOS 15.8  **Logs and diagnostics**  **Screenshots or recording**  <img width="807" height="322" alt="Image" src="https://github.com/user-attachments/assets/c6ed3f0b-efc0-4755-bcaa-a7f543af60bb" />  **Additional context** # Team provisioning diagnostics  ## Quick triage - User-visible title: Launch failed - User-visible message: Failed to query OpenCode models: OpenCode command timed out after 10000ms Failed to query OpenCode agents: OpenCode command timed out after 10000ms OpenCode request timed out after 15000ms for /config - Tone: error - Started at: 2026-08-14T21:24:34.422Z; elapsed: 14:10; pid: (none) - Step index: current=-1; error=0 - Classification: (none); confidence=(unknown) - Bootstrap transport: submitted=(unknown); rejected=(unknown); noStdinWarning=(unknown); lastStage=(none) - Counts: warnings=0; launchDiagnostics=0; memberSnapshots=6; artifactFiles=4 - Manifest counts: expectedMembers=(none); effectiveMembers=(none); spawnStatuses=(none) - Manifest progress: state=(none); message=(none); error=(none) - Raw CLI logs present: yes; live output present: yes  ## Summary Title: Launch failed Message: Failed to query OpenCode models: OpenCode command timed out after 10000ms Failed to query OpenCode agents: OpenCode com
  **Post-Mortem & Fix Analysis**:
  > Resolved on dev with the minimal #443 core:  - Orchestrator #49 enforces a strict launch attempt. - Orchestrator #50 adds the fake-only issue #443 E2E coverage. - Desktop #507 enforces passive status authority. - Desktop #508 binds launch authorization to the exact behavior fingerprint.  The regression path is covered with a fake runtime: hung status or catalog work cannot authorize launch, launch requires fresh exact proof, and member sessions are not created before that proof. Exact-head CI, both test shards, CodeQL, lint, and Windows smoke are green. Verification used only sandbox and fake runtime fixtures - no real user project, provider, team, or agent launch was used.  Hosted work remains preserved as separate Draft follow-ups and is not part of this fix.
  > Reopening: the earlier closure overstated the production catalog coverage.  The Desktop catalog hydration path still calls non-summary `runtime status`, which can enter full OpenCode inventory. The previous fake child-process test accepted that command and therefore did not prove the production route was provider-scoped. A narrow Desktop follow-up is now in progress to use the existing selected-provider models API and test the actual route.  The separate bounded cancellation follow-up is 777genius/agent_teams_orchestrator#51. It is a P2 session-store lock gap, not evidence that locks caused the original models timeout. Hosted contract work and the large WIP branches remain outside these fixes.  This issue will not be considered resolved merely because the adapter-level tests or unrelated CI checks pass. 
  > Resolved by the merged production changes:  - Orchestrator PR #51 merged at `db7f3aee99838556aa66fa3a69bb19f17f01ca3c`. - Desktop PR #530 merged at `497747e0617421f4ed0fb1918f57713ae85995a5`. - Fake-only production-route E2E passed with a disposable sandbox; the trace stayed provider-scoped and did not invoke `models --verbose`, `agent list`, or unrelated managed plugins. - Desktop exact-head focused regression suite: 168/168 passed, plus typecheck, fast lint, source-size guard, and `git diff --check`. - Functional GitHub CI checks passed, including both test shards, lint, CodeQL, Windows smoke, and static analysis.  The hosted no-fast review pool was unavailable for final model verdicts because of external provider capacity/turn-start failures; no worker changed either PR. The unrelated transitive `fast-uri` audit remains tracked separately. 

- **Issue #440** (2026-10-04): **OpenCode quota error**
  *Symptoms*: **Summary** The app stops responding and keeps showing OpenCode quota error even I hava OpenCode Zen balance.  **Area** Which part of the app is affected? Agent teams / teammate launch  **Steps to reproduce** After assigning opencode models, the teams stop working  **Frequency** Often  **Regression** It sometimes works  **Actual behavior** What happened instead?  **Expected behavior** What did you expect to happen?  **Environment** - OS and version: macOS 15.7.8  **Logs and diagnostics** If relevant, include redacted logs or diagnostics. - Do not paste API keys, access tokens, private repository contents, or other secrets. - For team launch hangs or missing teammate replies, check the newest artifact pack under `~/.claude/teams/<team>/launch-failure-artifacts/latest.json` and include the redacted `manifest.json` summary if you can. - For UI errors, include the Electron DevTools console error if one is shown.  **Screenshots or recording** If applicable, add screenshots or a short recording.  **Additional context** Anything else that might help debug this. 
  **Post-Mortem & Fix Analysis**:
  > Fixed in the [v2.13.0](https://github.com/777genius/agent-teams-ai/releases/tag/v2.13.0) 🚀  Please, test

- **Issue #400** (2026-08-22): **Windows: Cursor ACP (cursor-acp/auto) readiness probe exits immediately; team launch hangs on OpenCode readiness gate**
  *Symptoms*: ## Summary  On Windows 11, launching a team that uses **Cursor App → `auto`** (`providerId: opencode`, `model: cursor-acp/auto`) hangs forever (or until timeout) at:  `Starting OpenCode sessions through runtime adapter`  OpenCode itself starts successfully. The hang is specifically the **readiness execution probe** for `cursor-acp/auto`.  ## Environment  - **OS:** Windows 11 (10.0.22000) - **Agent Teams AI:** 2.11.0 (installed under `C:\Program Files\AgentTeamsAI\`) - **Bundled runtime:** claude-multimodel `0.0.71` (`f1fd20be86fe7755af0f54cca03cb4a4188221ae`) - **OpenCode:** 1.18.5 (app-managed + npm global) - **Cursor Agent CLI:** 2026.07.23-e383d2b (`agent status` = logged in) - **Developer Mode:** enabled (`AllowDevelopmentWithoutDevLicense=1`) - Reinstalling the desktop app does **not** fix it  ## Expected  Team launch with Cursor App models should pass OpenCode readiness (including `requireExecutionProbe`) and start teammates.  ## Actual  1. OpenCode hosts come up healthy (`GET /global/health` → `{"healthy":true,"version":"1.18.5"}`). 2. Bridge runs `opencode.readiness` with body like:  ```json {   "projectPath": "C:\\DEVS",   "selectedModel": "cursor-acp/auto",   "requireExecutionProbe": true } ```  (`timeoutMs`: 300000)  3. OpenCode creates a probe session `probe:cursor-acp/auto`, selects `cursor-acp/auto`, then **exits the loop in ~0.2s with no ERROR**:  ```text stream providerID=cursor-acp modelID=auto ... agent=teammate-model-
  **Post-Mortem & Fix Analysis**:
  > Additional context: this is blocking production use of Cursor App teams on Windows. Cursor Agent CLI works directly (\gent -p\ returns OK), OpenCode serve is healthy, but the managed \cursor-acp/auto\ readiness probe exits the loop in ~200ms with no ERROR and the launch gate hangs on \execution_poll\.  Related ecosystem reports of Cursor/OpenCode ACP hanging or failing on Windows (not Agent Teams specific, but same surface area): - https://github.com/anomalyco/opencode/pull/13222 (ACP hang on Windows thinking state) - https://github.com/zed-industries/zed/issues/57856 (Cursor ACP hangs without clear error)  Happy to run any diagnostic build / collect more traces.
  > Follow-up: same hang happens with \opencode/big-pickle\ (not only Cursor). Probe session starts and exits loop quickly; bridge diagnostics show \stdoutBytes: 0\, \outputSource: none\, \outputReadError: ENOENT\, \stderrBytes: ~442\. So this looks like a Windows OpenCode readiness bridge output-contract failure, not just Cursor ACP.
  > **Root cause found on this machine:** OpenCode readiness returns \hostHealthy=false\ / \ppMcpConnected=false\ with:  \Unable to resolve the agent-teams MCP entrypoint for OpenCode dynamic attach. Set CLAUDE_MULTIMODEL_AGENT_TEAMS_MCP_ENTRY to override...\  When \CLAUDE_MULTIMODEL_AGENT_TEAMS_MCP_ENTRY\ is set to \%APPDATA%\\agent-teams-ai\\mcp-server\\2.11.0\\index.js\, readiness for \opencode/big-pickle\ becomes \state=ready\ / \launchAllowed=true\.  Cursor still reports needing execution verification / auth separately, but the MCP entrypoint miss appears to be the primary Windows launch-gate failure for OpenCode teams.

- **Issue #290** (2026-07-30): **[BUG] Request for a private security reporting channel**
  *Symptoms*: Hello maintainers, I identified a potential security issue affecting the current desktop workflow. At a high level, it concerns the flow where a user selects a repository to create or start a Claude team: the application may change Claude's workspace trust state before the user receives a separate trust confirmation. Your `SECURITY.md` asks researchers not to disclose undisclosed vulnerabilities in public issues, so I am intentionally omitting configuration details, impact analysis, and reproduction steps here. Could you provide a private reporting contact or enable GitHub private vulnerability reporting? I can share the affected commit, source-level evidence, and a minimal non-destructive reproduction privately. 
  **Post-Mortem & Fix Analysis**:
  > Hi @glmgbj233, thanks for taking the time to review the project and for reporting this responsibly. We really appreciate it.  We have now enabled GitHub Private Vulnerability Reporting for this repository. You can submit the full report through Security > Advisories > Report a vulnerability.  Our initial assumption is that you may be referring to the workspace trust preflight used when a user explicitly selects a project and creates or launches a team. The agents run non-interactively, so without handling the provider trust prompt the launch would remain blocked. Other agent orchestrators use a similar approach. For example, Gas Town automatically accepts Claude and Codex workspace trust dialogs for non-interactive sessions: https://github.com/gastownhall/gastown/blob/main/internal/tmux/tmux.go#L1897-L1964  At first glance, we consider the general behavior intentional after an explicit Create/Launch action. That said, we are very interested in your analysis, especially if your concern 
  > Thank you for the clarification. I understand why a non-interactive launch cannot wait for Claude's native trust prompt. My concern is not that the launch must remain blocked. It is that Create/Launch currently appears to be treated as implicit acceptance of all repository-controlled executable configuration, including project hooks and MCP, without a separate in-app disclosure or choice. There are alternatives that preserve non-interactive operation: - Launching untrusted projects in Claude safe mode; - Loading only user-level settings until the user opts in; - Or presenting an Agent Teams-owned confirmation that identifies project hooks/MCP and distinguishes one-time execution from persistent Git-root trust.  My testing confirms that project SessionStart hooks can run during the non-interactive launch. I agree that this may be intentional behavior, but I believe the consent boundary and the persistent trust scope warrant review. 
  > Thanks, this distinction is clear, and the SessionStart hook result is useful.  Our Gas Town comparison was about the need to unblock non-interactive startup, but we agree that this is separate from how Agent Teams communicates and scopes repository-controlled executable configuration. The persistence scope and the difference between a safe one-time launch and permanently trusting the Git root are worth reviewing.  Please submit the reproduction and exact affected configuration through GitHub Private Vulnerability Reporting: https://github.com/777genius/agent-teams-ai/security/advisories/new  We will review the current project hooks and MCP loading path, as well as the feasibility of a safe launch mode or an Agent Teams-owned confirmation while preserving non-interactive operation.  Thanks again for testing this carefully and for the constructive follow-up.

- **Issue #288** (2026-07-21): **[BUG] Phase-2 readiness `blocking_metrics` suppresses nudges on any active team — maxFingerprintChangesPerMemberHour: 1 is unreachable in normal use**
  *Symptoms*: ### Summary  On any team that is actually doing work, member work-sync nudges are permanently suppressed by the Phase-2 readiness `blocking_metrics` gate. The system correctly detects that a member needs waking, then declines to wake it. The member sits idle indefinitely with actionable work assigned.  The core problem: **`maxFingerprintChangesPerMemberHour: 1` is below the rate that normal operation produces.** In my deployment, every single active member exceeds it, so the safety net is effectively off exactly when it is needed.  ### Observed behavior  Members stop working while their process is still alive, holding `in_progress` tasks that are not blocked. Journal entries from `members/<member>/.member-work-sync/journal.jsonl`:  ```json {   "event": "nudge_skipped",   "source": "nudge_planner",   "state": "needs_sync",   "actionableCount": 1,   "reason": "blocking_metrics",   "providerId": "codex" } ```  The decision layer got it right — `state: needs_sync`, `actionableCount: 1` — and the nudge was then dropped.  ### Why this is structural, not a tuning issue  Measured board-mutation rate per member over a 3-hour window (5 teams, ~28 members, all `providerId: codex`), using task `historyEvents` as a proxy for agenda changes:  | member | events/hour | |---|---| | busiest | 3.7 | | median  | ~2.3 | | quietest active member | 1.0 |  `maxFingerprintChangesPerMemberHour` is **1**. Every active member is at or above the limit; most are 2–4x over. There is no realistic level of "
  **Post-Mortem & Fix Analysis**:
  > Follow-up with sharper data — my original report understated this. It is not "active teams get gated"; it is **every team, all the time**, and the gate is self-reinforcing.  ### 1. The blocking metric is `would_nudge`, and it is 5–21x over threshold on every team  Measured over a 1-hour window across 5 teams (`nudge_skipped` + `nudge_planned` + `runtime_stall_observed` as the observable proxy for `would_nudge`), divided by live member count:  | team | members | events/member-hour | threshold | |---|---|---|---| | A | 4 | 10.0 | 2 | | B | 3 | 27.7 | 2 | | C | 9 | 24.9 | 2 | | D | 12 | 24.2 | 2 | | E | 5 | 42.6 | 2 |  Every team, including the ones that are still making progress. So `blocking_metrics` is not an occasional degraded state — it is the steady state.  ### 2. It is a positive feedback loop  A stalled member emits a would-nudge every reconcile cycle. That inflates `wouldNudgesPerMemberHour`, which trips `blocking_metrics`, which suppresses the nudge that would have unstuck it, 
  > Update: we built an external compensator and it worked. Sharing the numbers in case they help calibrate the fix — **no code, just the mechanism and the measurements.**  ### Context  5 teams, 38 teammates (excluding leads), all Codex on `codex-native`, `skipPermissions: true`, per-member `isolation: worktree`. Single human operator.  ### What we observed before intervening  Members were alive but idle: process running, holding an assigned card, no turns for hours. Leads were the only reliably-woken agents, because messages and task comments kept reaching them while the nudge path stayed suppressed by `blocking_metrics`.  The decisive measurement was separating two things that look identical from outside:  | | count | |---|---| | members holding a card but not turning | 3 | | **members with no card assigned at all** | **30** |  Only 3 were actually stalled. **30 had nothing to do.** Poking those 30 would have burned a turn each and changed nothing — they would wake, see an empty agenda, 
  > Hi! Thanks, this is a major bug! I'm taking a closer look.

- **Issue #276** (2026-07-20): **[BUG] fail to load model**
  *Symptoms*: after update tool, all teams and new team unavailable .   <img width="1094" height="866" alt="Image" src="https://github.com/user-attachments/assets/22bfd02e-777a-4742-9c64-f6c0dcf1a218" />  <img width="1802" height="610" alt="Image" src="https://github.com/user-attachments/assets/e0050393-ce36-4bdc-8e7a-8ed88e2e9ef2" />
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. We checked the diagnostics in your screenshot and found two separate authentication issues:  - The models shown as `via OpenCode` are actually using OpenCode Zen. Zen is rejecting the saved credential with `Invalid API key`, so the OpenCode Zen API key needs to be replaced. - The models shown as `via OpenRouter` are returning `Forbidden: Access denied by security policy`. This means OpenRouter accepted the credential format, but the request was blocked by the key, account, or security restrictions.  These authentication failures are why the selected teammates could not start.  We have also improved this system for the next release. It will:  - Clearly label the provider as `OpenCode Zen` instead of the ambiguous `OpenCode` - Verify credentials with a minimal real model request when connecting - Prefer a free model for verification when available - Show exactly which provider and credential failed - Preserve the previous working credential if a replacement fails v
  > We also found bug on our side - fixing it.
  > Fixed in the v2.10.0. Thanks for the info!

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

### Incident Patch 1: `90625bee` (2026-10-06)
**Commit Message**: fix(sentry): inventory build artifacts and validate identity (#815)

Preserve the producer checkpoint and active dependent PR #817 ancestry.

Validated final artifact inventories and normalized build identity; backend symbolication and consumer acceptance continue separately.

Refs #815
Related https://quant-jump-pro.sentry.io/issues/138326339/

**File**: `electron.vite.config.ts` (modified, +29/-41)
```diff
@@ -10,6 +10,8 @@ import {
   resolvePostHogBuildKey,
 } from './src/shared/utils/posthogBuildPolicy'
 import { resolveSentryBuildEnvironment } from './src/shared/utils/sentryBuildPolicy'
+import { sentryArtifactInventoryPlugin } from './scripts/build/sentryArtifactInventory'
+import { resolveSentryBuildIdentity } from './scripts/build/sentryBuildIdentity'
 
 // Read all production dependencies from package.json
 // so they get bundled into the main process output.
@@ -20,8 +22,17 @@ const terminalPlatformLocalRoot = resolveTerminalPlatformLocalRoot()
 const terminalPlatformSdkAliases = createTerminalPlatformSdkAliases()
 const rendererDependencyEsbuildTarget = 'esnext'
 const localEnv = loadEnv(process.env.NODE_ENV ?? 'development', __dirname, '')
-const buildGitSha = resolveBuildGitSha()
-const buildId = resolveBuildId(buildGitSha)
+const sentryBuildCovered = Boolean(process.env.SENTRY_AUTH_TOKEN)
+const { gitSha: buildGitSha, buildId } = resolveSentryBuildIdentity({
+  env: process.env,
+  localEnv,
+  covered: sentryBuildCovered,
+  readGitSha: () => execSync('git rev-parse HEAD', {
+    cwd: __dirname,
+    encoding: 'utf8',
+    stdio: ['ignore', 'pipe', 'ignore'],
+  }),
+})
 const sentryEnvironment = resolveSentryBuildEnvironment(process.env)
 const releaseChannel = resolveReleaseChannel()
 const officialPostHogBuild = isOfficialPostHogReleaseBuild(process.env)
@@ -53,41 +64,6 @@ function firstNonEmptyEnv(...values: Array<string | undefined>): string {
   return values.map(value => value?.trim() ?? '').find(Boolean) ?? ''
 }
 
-function resolveBuildGitSha(): string {
-  const fromEnv = firstNonEmptyEnv(
-    process.env.GIT_SHA,
-    localEnv.GIT_SHA,
-    process.env.GITHUB_SHA,
-    localEnv.GITHUB_SHA,
-    process.env.VERCEL_GIT_COMMIT_SHA,
-    localEnv.VERCEL_GIT_COMMIT_SHA,
-    process.env.COMMIT_SHA,
-    localEnv.COMMIT_SHA
-  )
-  if (fromEnv) return fromEnv
-
-  try {
-    return execSync('git rev-parse HEAD', {
-      cwd: __dirname,
-      encoding: 'utf8',
-      stdio: ['ignore', 'pipe', 'ignore'],
-    }).trim()
-  } catch {
-    return ''
-  }
-}
-
-function resolveBuildId(gitSha: string): string {
-  return (
-    firstNonEmptyEnv(
-      process.env.BUILD_ID,
-      localEnv.BUILD_ID,
-      process.env.VITE_BUILD_ID,
-      localEnv.VITE_BUILD_ID
-    ) || gitSha.slice(0, 12)
-  )
-}
-
 function resolveReleaseChannel(): string {
   return (
     firstNonEmptyEnv(
@@ -136,17 +112,29 @@ const sourceMapSetting = process.env.AGENT_TEAMS_DISABLE_SOURCEMAPS === '1' ? fa
 
 // Sentry source map upload - only active in CI when SENTRY_AUTH_TOKEN is set.
 function createSentryPlugins(target: keyof typeof sentrySourceMapTargets): Plugin[] {
-  if (!process.env.SENTRY_AUTH_TOKEN) return []
-
+  const covered = sentryBuildCovered
   return [
-    sentryVitePlugin({
+    ...(covered ? [sentryVitePlugin({
       org: process.env.SENTRY_ORG ?? 'quant-jump-pro',
       project: process.env.SENTRY_PROJECT ?? 'electron',
       authToken: process.env.SENTRY_AUTH_TOKEN,
       telemetry: false,
       release: { name: `agent-teams-ai@${pkg.version}` },
       sourcemaps: sentrySourceMapTargets[target],
-    }) as Plugin,
+    }) as Plugin] : []),
+    sentryArtifactInventoryPlugin({
+      target,
+      covered,
+      release: `agent-teams-ai@${pkg.version}`,
+      buildId,
+      gitSha: buildGitSha,
+      evidenceDirectory: resolve(
+        __dirname,
+        '.artifacts/sentry',
+        buildGitSha || 'unknown',
+        buildId || 'unknown'
+      ),
+    }),
   ]
 }
 
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -92,6 +92,7 @@
     "guard:runtime-artifacts": "node ./scripts/ci/forbid-runtime-artifacts.cjs",
     "guard:source-file-size": "node ./scripts/ci/check-source-file-size.mjs",
     "guard:team-provisioning-architecture": "node ./scripts/ci/check-team-provisioning-architecture.mjs",
+    "test:sentry-inventory": "vitest run test/scripts/sentryArtifactInventory.test.ts test/scripts/sentryArtifactInventory.integration.test.ts",
     "test:chunks": "tsx test/test-chunk-building.ts",
     "test:semantic": "tsx test/test-semantic-steps.ts",
     "test:noise": "tsx test/test-noise-filtering.ts",
```

**File**: `scripts/build/sentryArtifactInventory.ts` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+import { createHash } from 'node:crypto';
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { basename, join } from 'node:path';
+import type { Plugin, Rollup } from 'vite';
+import {
+  isSentryArtifactFile,
+  parseSentryArtifactInventory,
+  SENTRY_DEBUG_ID_PATTERN,
+  SENTRY_INVENTORY_FILE,
+  SENTRY_INVENTORY_MAX_ARTIFACTS,
+  SENTRY_INVENTORY_MAX_BYTES,
+  SENTRY_INVENTORY_PAYLOAD_ID,
+  SENTRY_TARGET_PREFIXES,
+  type SentryBuildIdentity,
+  type SentryRuntimeInventory,
+} from '../../src/shared/utils/sentryArtifactInventory.js';
+
+type OutputBundle = Rollup.OutputBundle;
+type OutputChunk = Rollup.OutputChunk;
+
+const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
+const MAX_MAP_BYTES = 256 * 1024 * 1024;
+const MAX_HTML_BYTES = 4 * 1024 * 1024;
+export type SentryCoveredTarget = 'main' | 'renderer';
+export type SentryArtifactEvidence = Readonly<{
+  relativeFile: string;
+  debugId: string;
+  source: Readonly<{ sha256: string; bytes: number }>;
+  originalMap: Readonly<{ relativeFile: string; sha256: string; bytes: number }>;
+}>;
+export type SentryInventoryEvidence = Readonly<{
+  schemaVersion: 1;
+  target: SentryCoveredTarget;
+  runtime: SentryRuntimeInventory;
+  runtimeSha256: string;
+  mapStage: 'original-before-sentry-upload-preparation';
+  uploadVerified: false;
+  artifacts: readonly SentryArtifactEvidence[];
+}>;
+export type SentryInventoryOptions = SentryBuildIdentity &
+  Readonly<{
+    target: SentryCoveredTarget;
+    covered: boolean;
+    evidenceDirectory: string;
+  }>;
+
+function digest(value: string): { sha256: string; bytes: number } {
+  return {
+    sha256: createHash('sha256').update(value).digest('hex'),
+    bytes: Buffer.byteLength(value),
+  };
+}
+function bounded(value: string, limit: number, name: string): void {
+  if (Buffer.byteLength(value) > limit) throw new Error(`Sentry inventory: oversized ${name}`);
+}
+function sourceOf(value: string | Uint8Array): string {
+  return typeof value === 'string' ? value : Buffer.from(value).toString('utf8');
+}
+function debugId(code: string): string {
+  const markers = [...code.matchAll(/sentry-dbid-([^"'`\s;]+)/g)];
+  if (markers.length !== 1 || !SENTRY_DEBUG_ID_PATTERN.test(markers[0]?.[1] ?? '')) {
+    throw new Error('Sentry inventory: expected exactly one canonical injected debug ID');
+  }
+  return markers[0]![1]!;
+}
+function verifyMap(json: string, chunk: OutputChunk, id: string): void {
+  let map: unknown;
+  try {
+    map = JSON.parse(json);
+  } catch {
+    throw new Error('Sentry inventory: malformed source map');
+  }
+  if (!map || typeof map !== 'object' || Array.isArray(map))
+    throw new Error('Sentry inventory: invalid v3 source map');
+  const value = map as Record<string, unknown>;
+  if (
+    value.version !== 3 ||
+    typeof value.mappings !== 'string' ||
+    !/^[A-Za-z0-9+/,;]*$/.test(value.mappings) ||
+    !Array.isArray(value.sources) ||
+    !value.sources.length ||
+    !value.sources.every((source) => typeof source === 'string') ||
+    !Array.isArray(value.names) ||
+    !value.names.every((name) => typeof name === 'string') ||
+    (value.file !== undefined &&
+      value.file !== chunk.fileName &&
+      value.file !== basename(chunk.fileName)) ||
+    (value.sourcesContent !== undefined &&
+      (!Array.isArray(value.sourcesContent) ||
+        value.sourcesContent.length !== value.sources.length ||
+        !value.sourcesContent.every(
+          (content) => content === null || typeof content === 'string'
+        ))) ||
+    ['debugId', 'debug_id'].some((key) => value[key] !== undefined && value[key] !== id)
+  ) {
+    throw new Error('Sentry inventory: invalid or mismatched v3 source map');
+  }
+  // Rollup owns the original chunk/map association. Do not admit an unrelated asset by filename alone.
+  if (!chunk.map || JSON.stringify(JSON.parse(chunk.map.toString())) !== JSON.stringify(map)) {
+    throw new Error('Sentry inventory: emitted source map differs from chunk map');
+  }
+}
+
+/** Uses only this build's emitted chunks; never scans stale files in an output directory. */
+export function collectSentryArtifactInventory(
+  bundle: OutputBundle,
+  options: SentryInventoryOptions
+): SentryInventoryEvidence {
+  if (
+    options.covered &&
+    Object.values(bundle).some(
+      (item) => item.type === 'asset' && /\.(?:js|cjs|mjs)$/.test(item.fileName)
+    )
+  ) {
+    throw new Error('Sentry inventory: JavaScript asset lacks a Rollup chunk/map association');
+  }
+  const chunks = Object.values(bundle).filter((item): item is OutputChunk => item.type === 'chunk');
+  if (chunks.length > SENTRY_INVENTORY_MAX_ARTIFACTS)
+    throw new Error('Sentry inventory: too many emitted chunks');
+  const artifacts: SentryArtifactEvidence[] = [];
+  const rows: SentryRuntimeInventory['artifacts'][number][] = [];
+  if (options.covered && !chunks.length)
+    throw new Error('Sentry inventory: covered target has no chunks');
+  for (co
```

**File**: `scripts/build/sentryBuildIdentity.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import type { SentryBuildIdentity } from '../../src/shared/utils/sentryArtifactInventory.js';
+
+type BuildEnvironment = Readonly<Record<string, string | undefined>>;
+type BuildIdentityOptions = Readonly<{
+  env: BuildEnvironment;
+  localEnv: BuildEnvironment;
+  readGitSha: () => string;
+  covered: boolean;
+}>;
+
+function canonicalGitSha(value: string | undefined): string {
+  const trimmed = value?.trim() ?? '';
+  return /^[0-9a-f]{40}$/i.test(trimmed) ? trimmed.toLowerCase() : '';
+}
+
+function validBuildId(value: string | undefined): string {
+  const trimmed = value?.trim() ?? '';
+  return /^[A-Za-z0-9][A-Za-z0-9._@+-]{0,159}$/.test(trimmed) ? trimmed : '';
+}
+
+/** Resolve before plugin registration so malformed optional env never reaches inventory admission. */
+export function resolveSentryBuildIdentity({
+  env,
+  localEnv,
+  readGitSha,
+  covered,
+}: BuildIdentityOptions): Readonly<Pick<SentryBuildIdentity, 'gitSha' | 'buildId'>> {
+  let gitSha = ['GIT_SHA', 'GITHUB_SHA', 'VERCEL_GIT_COMMIT_SHA', 'COMMIT_SHA']
+    .flatMap((name) => [env[name], localEnv[name]])
+    .map(canonicalGitSha)
+    .find(Boolean) ?? '';
+
+  if (!gitSha) {
+    try {
+      gitSha = canonicalGitSha(readGitSha());
+    } catch {
+      // Self-builds without Git can remain uncovered with empty identity.
+    }
+  }
+
+  const buildId = ['BUILD_ID', 'VITE_BUILD_ID']
+    .flatMap((name) => [env[name], localEnv[name]])
+    .map(validBuildId)
+    .find(Boolean) ?? gitSha.slice(0, 12);
+
+  if (covered && (!gitSha || !buildId)) {
+    throw new Error('Sentry upload requires a valid 40-character Git SHA and build ID');
+  }
+
+  return Object.freeze({ gitSha, buildId });
+}
```

**File**: `scripts/build/verifySentryArtifactInventory.ts` (added, +279/-0)
```diff
@@ -0,0 +1,279 @@
+/** Disposable real locked-plugin build. Run only on the validation host, without inherited Sentry auth. */
+import { sentryVitePlugin } from '@sentry/vite-plugin';
+import { resolveConfig as resolveElectronConfig } from 'electron-vite';
+import { createHash } from 'node:crypto';
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { join, resolve } from 'node:path';
+import {
+  build,
+  resolveConfig as resolveViteConfig,
+  version as viteVersion,
+  type Plugin,
+  type Rollup,
+} from 'vite';
+import {
+  sentryArtifactInventoryPlugin,
+  type SentryCoveredTarget,
+} from './sentryArtifactInventory.js';
+import {
+  parseSentryArtifactInventory,
+  SENTRY_INVENTORY_FILE,
+  SENTRY_INVENTORY_PAYLOAD_ID,
+} from '../../src/shared/utils/sentryArtifactInventory.js';
+
+const identity = {
+  release: 'agent-teams-ai@inventory-sandbox',
+  buildId: 'inventory-sandbox',
+  gitSha: '1234567890abcdef1234567890abcdef12345678',
+};
+const root = process.argv[2];
+if (!root) throw new Error('Supply a disposable synthetic build directory');
+if (Object.keys(process.env).some((key) => key.startsWith('SENTRY_')))
+  throw new Error('Sentry environment must be isolated');
+const directory = resolve(root);
+await mkdir(directory, { recursive: true });
+// Never inherit a tsconfig from a shared temporary parent or another validation job.
+await writeFile(
+  join(directory, 'tsconfig.json'),
+  JSON.stringify({
+    compilerOptions: {
+      target: 'ES2023',
+      module: 'ESNext',
+      moduleResolution: 'Bundler',
+      strict: true,
+    },
+  })
+);
+await writeFile(
+  join(directory, 'main.ts'),
+  'export function syntheticMain() { throw new Error("synthetic-main"); }\n'
+);
+await writeFile(
+  join(directory, 'worker.ts'),
+  'export function syntheticWorker() { throw new Error("synthetic-worker"); }\n'
+);
+await writeFile(
+  join(directory, 'renderer.ts'),
+  'globalThis.addEventListener("synthetic", async () => (await import("./dynamic.ts")).syntheticDynamic());\n'
+);
+await writeFile(
+  join(directory, 'dynamic.ts'),
+  'export function syntheticDynamic() { throw new Error("synthetic-dynamic"); }\n'
+);
+await writeFile(
+  join(directory, 'index.html'),
+  '<html><head></head><body><script type="module" src="/renderer.ts"></script></body></html>\n'
+);
+// Resolve the installed Electron preset, rather than using Vite's browser compatibility defaults.
+const electronConfigFile = join(directory, 'electron.synthetic.config.ts');
+await writeFile(electronConfigFile, 'export default { renderer: {} };\n');
+const electronConfig = await resolveElectronConfig(
+  {
+    root: directory,
+    configFile: electronConfigFile,
+    ignoreConfigWarning: true,
+    logLevel: 'silent',
+  },
+  'build',
+  'production'
+);
+if (!electronConfig.config?.renderer) throw new Error('Synthetic Electron renderer preset missing');
+const rendererConfig = await resolveViteConfig(
+  {
+    ...electronConfig.config.renderer,
+    configFile: false,
+    root: directory,
+    envDir: directory,
+    base: './',
+    logLevel: 'silent',
+    build: {
+      outDir: join(directory, 'renderer'),
+      rollupOptions: { input: join(directory, 'index.html') },
+    },
+  },
+  'build',
+  'production'
+);
+const rendererBuildTarget = rendererConfig.build.target;
+const observations: unknown[] = [];
+function hash(code: string): string {
+  return createHash('sha256').update(code).digest('hex');
+}
+for (const target of ['main', 'renderer'] as const) {
+  const outDir = join(directory, target);
+  const evidenceDirectory = join(directory, 'host-evidence');
+  const early = new Map<string, string>();
+  const before = new Map<string, { source: string; map: string }>();
+  const hookOrder: string[] = [];
+  const earlyObserver: Plugin = {
+    name: 'synthetic-inventory-early-vite-observer',
+    generateBundle: {
+      order: 'pre',
+      handler(_options, bundle) {
+        hookOrder.push('generateBundle-before-vite-finalizers');
+        for (const item of Object.values(bundle))
+          if (item.type === 'chunk') early.set(item.fileName, hash(item.code));
+      },
+    },
+  };
+  const observer: Plugin = {
+    name: 'synthetic-inventory-order-observer',
+    enforce: 'post',
+    generateBundle: {
+      order: 'post',
+      handler(_options, bundle) {
+        hookOrder.push('generateBundle-before-inventory');
+        for (const item of Object.values(bundle)) {
+          if (item.type !== 'chunk') continue;
+          const map = bundle[`${item.fileName}.map`];
+          if (!map || map.type !== 'asset') throw new Error('Finalizer observer missing map');
+          before.set(item.fileName, {
+            source: hash(item.code),
+            map: hash(
+              typeof map.source === 'string' ? map.source : Buffer.from(map.source).toString('utf8')
+            ),
+          });
+        }
+      },
+    },
+    writeBundle: {
+      order: 'post',
+      async handler(_opt
```

**File**: `src/shared/utils/sentryArtifactInventory.ts` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+/** Application-owned build contract. These records never contain filesystem roots or map content. */
+export const SENTRY_INVENTORY_FILE = 'sentry-artifact-inventory.json';
+export const SENTRY_INVENTORY_PAYLOAD_ID = 'sentry-artifact-inventory';
+export const SENTRY_INVENTORY_MAX_BYTES = 256 * 1024;
+export const SENTRY_INVENTORY_MAX_ARTIFACTS = 1024;
+export const SENTRY_DEBUG_ID_PATTERN =
+  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
+export const SENTRY_TARGET_PREFIXES = {
+  main: 'dist-electron/main/',
+  renderer: 'out/renderer/',
+  preload: 'dist-electron/preload/',
+} as const;
+
+export type SentryArtifactTarget = keyof typeof SENTRY_TARGET_PREFIXES;
+export type SentryBuildIdentity = Readonly<{ release: string; buildId: string; gitSha: string }>;
+export type SentryRuntimeArtifact = Readonly<{
+  target: SentryArtifactTarget;
+  relativeFile: string;
+  locator: string;
+  debugId: string;
+}>;
+export type SentryRuntimeInventory = SentryBuildIdentity &
+  Readonly<{
+    schemaVersion: 1;
+    artifacts: readonly SentryRuntimeArtifact[];
+    coverage: Readonly<Record<SentryArtifactTarget, 'covered' | 'uncovered'>>;
+  }>;
+
+export function isSentryArtifactFile(value: string): boolean {
+  return (
+    value.length <= 512 &&
+    /^[A-Za-z0-9_./-]+\.(?:js|cjs|mjs)$/.test(value) &&
+    value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
+  );
+}
+
+function object(value: unknown): value is Record<string, unknown> {
+  return typeof value === 'object' && value !== null && !Array.isArray(value);
+}
+function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
+  return (
+    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
+  );
+}
+function identityToken(value: unknown, allowEmpty: boolean): value is string {
+  return (
+    typeof value === 'string' &&
+    ((allowEmpty && value === '') || /^[A-Za-z0-9][A-Za-z0-9._@+-]{0,159}$/.test(value))
+  );
+}
+
+/** Bounded, strict and fail-closed. Copy/freeze admitted data rather than retaining untrusted objects. */
+export function parseSentryArtifactInventory(
+  json: string,
+  expected: SentryBuildIdentity
+): SentryRuntimeInventory | null {
+  if (
+    json.length > SENTRY_INVENTORY_MAX_BYTES ||
+    new TextEncoder().encode(json).length > SENTRY_INVENTORY_MAX_BYTES
+  )
+    return null;
+  try {
+    const value: unknown = JSON.parse(json);
+    if (
+      !object(value) ||
+      !exactKeys(value, [
+        'schemaVersion',
+        'release',
+        'buildId',
+        'gitSha',
+        'artifacts',
+        'coverage',
+      ]) ||
+      value.schemaVersion !== 1 ||
+      !identityToken(value.release, false) ||
+      !identityToken(value.buildId, true) ||
+      typeof value.gitSha !== 'string' ||
+      (value.gitSha !== '' && !/^[0-9a-f]{40}$/.test(value.gitSha)) ||
+      value.release !== expected.release ||
+      value.buildId !== expected.buildId ||
+      value.gitSha !== expected.gitSha ||
+      !object(value.coverage) ||
+      !exactKeys(value.coverage, ['main', 'renderer', 'preload']) ||
+      !Array.isArray(value.artifacts) ||
+      value.artifacts.length > SENTRY_INVENTORY_MAX_ARTIFACTS
+    )
+      return null;
+    const coverage = value.coverage;
+    if (Object.values(coverage).some((status) => status !== 'covered' && status !== 'uncovered'))
+      return null;
+    if (Object.values(coverage).includes('covered') && (!value.buildId || !value.gitSha))
+      return null;
+    const artifacts: SentryRuntimeArtifact[] = [];
+    let previous = '';
+    for (const row of value.artifacts) {
+      if (
+        !object(row) ||
+        !exactKeys(row, ['target', 'relativeFile', 'locator', 'debugId']) ||
+        typeof row.target !== 'string' ||
+        !Object.hasOwn(SENTRY_TARGET_PREFIXES, row.target) ||
+        typeof row.relativeFile !== 'string' ||
+        !isSentryArtifactFile(row.relativeFile) ||
+        typeof row.locator !== 'string' ||
+        row.locator !== `app:///${row.relativeFile}` ||
+        typeof row.debugId !== 'string' ||
+        !SENTRY_DEBUG_ID_PATTERN.test(row.debugId)
+      )
+        return null;
+      const target = row.target as SentryArtifactTarget;
+      if (
+        coverage[target] !== 'covered' ||
+        !row.relativeFile.startsWith(SENTRY_TARGET_PREFIXES[target]) ||
+        row.locator <= previous
+      )
+        return null;
+      previous = row.locator;
+      artifacts.push(
+        Object.freeze({
+          target,
+          relativeFile: row.relativeFile,
+          locator: row.locator,
+          debugId: row.debugId,
+        })
+      );
+    }
+    if (
+      Object.keys(SENTRY_TARGET_PREFIXES).some(
+        (target) =>
+          coverage[target] === 'covered' && !artifacts.some((row) => row.target === target)
+      )
+    )
+      return null;
+    return Object.freeze({
+      schemaVersio
```

**File**: `test/scripts/sentryArtifactInventory.integration.test.ts` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+// @vitest-environment node
+import { execFile } from 'node:child_process';
+import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
+import { createRequire } from 'node:module';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+import { promisify } from 'node:util';
+
+import { expect, it } from 'vitest';
+
+it('observes real locked Sentry injection, worker/dynamic inventory and final Vite HTML before writeBundle', async () => {
+  const directory = await mkdtemp(join(tmpdir(), 'sentry-inventory-build-'));
+  let passed = false;
+  try {
+    const tsconfig = join(directory, 'tsconfig.json');
+    await writeFile(
+      tsconfig,
+      JSON.stringify({
+        compilerOptions: {
+          target: 'ES2023',
+          module: 'ESNext',
+          moduleResolution: 'Bundler',
+          strict: true,
+        },
+      })
+    );
+    const harness = fileURLToPath(
+      new URL('../../scripts/build/verifySentryArtifactInventory.ts', import.meta.url)
+    );
+    const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
+    await promisify(execFile)(process.execPath, ['--import', tsxLoader, harness, directory], {
+      cwd: directory,
+      // No SENTRY_* vars, env files, real HOME or upload credentials reach the child.
+      env: {
+        PATH: process.env.PATH,
+        HOME: directory,
+        USERPROFILE: directory,
+        NODE_ENV: 'production',
+        TSX_TSCONFIG_PATH: tsconfig,
+      },
+      timeout: 60_000,
+      maxBuffer: 1024 * 1024,
+    });
+    const report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'));
+    expect(report.uploadDisabled).toBe(true);
+    expect(report.rendererBuildTarget).toMatch(/^chrome[0-9]+$/);
+    expect(report.observations).toHaveLength(2);
+    expect(report.observations[0].artifactFiles).toEqual([
+      'dist-electron/main/main.cjs',
+      'dist-electron/main/worker.cjs',
+    ]);
+    expect(report.observations[1].artifactFiles).toHaveLength(2);
+    expect(
+      report.observations[1].artifactFiles.some((file: string) =>
+        /^out\/renderer\/assets\/dynamic-.*\.js$/.test(file)
+      )
+    ).toBe(true);
+    for (const observation of report.observations) {
+      expect(observation.hookOrder).toEqual([
+        'generateBundle-before-vite-finalizers',
+        'generateBundle-before-inventory',
+        'writeBundle-after-inventory',
+      ]);
+      expect(observation.jsUnchanged).toBe(true);
+      expect(observation.originalMapsMatched).toBe(true);
+      expect(observation.runtime.coverage.preload).toBe('uncovered');
+    }
+    expect(report.observations[1].viteFinalizerChangedFiles.length).toBeGreaterThan(0);
+    passed = true;
+  } finally {
+    if (passed) await rm(directory, { recursive: true, force: true });
+    else console.error(`Synthetic Sentry failure evidence retained at ${directory}`);
+  }
+}, 75_000);
```

**File**: `test/scripts/sentryArtifactInventory.test.ts` (added, +275/-0)
```diff
@@ -0,0 +1,275 @@
+// @vitest-environment node
+import { createHash } from 'node:crypto';
+
+import { describe, expect, it } from 'vitest';
+
+import {
+  collectSentryArtifactInventory,
+  insertSentryInventoryPayload,
+  type SentryInventoryOptions,
+} from '../../scripts/build/sentryArtifactInventory.js';
+import {
+  parseSentryArtifactInventory,
+  SENTRY_INVENTORY_MAX_ARTIFACTS,
+  SENTRY_INVENTORY_MAX_BYTES,
+  SENTRY_INVENTORY_PAYLOAD_ID,
+} from '../../src/shared/utils/sentryArtifactInventory.js';
+
+import type { Rollup } from 'vite';
+
+type OutputAsset = Rollup.OutputAsset;
+type OutputBundle = Rollup.OutputBundle;
+type OutputChunk = Rollup.OutputChunk;
+type SourceMap = Rollup.SourceMap;
+
+// Independent literals exercise admission boundaries. The integration suite generates real SDK IDs.
+const ID = '91b28a5c-d347-4c18-9a26-b9cf378e52d1';
+const OTHER_ID = 'dcce018b-46a1-4f04-809c-9edda3b3feb4';
+const identity = {
+  release: 'agent-teams-ai@2.17.1',
+  buildId: 'sandbox-1',
+  gitSha: '1234567890abcdef1234567890abcdef12345678',
+};
+const options: SentryInventoryOptions = {
+  ...identity,
+  target: 'main',
+  covered: true,
+  evidenceDirectory: '/unused-test-directory',
+};
+function fixture(fileName = 'index.cjs', id = ID): OutputBundle {
+  const raw = {
+    version: 3,
+    file: fileName,
+    names: [],
+    sources: ['sandbox-entry.ts'],
+    mappings: 'AAAA',
+    sourcesContent: ['throw new Error("sandbox")'],
+  };
+  const map: SourceMap = { ...raw, toString: () => JSON.stringify(raw), toUrl: () => '' };
+  const chunk: OutputChunk = {
+    type: 'chunk',
+    fileName,
+    name: fileName,
+    code: `globalThis._sentryDebugIdIdentifier="sentry-dbid-${id}";throw new Error("sandbox");`,
+    map,
+    sourcemapFileName: `${fileName}.map`,
+    preliminaryFileName: fileName,
+    isEntry: true,
+    isDynamicEntry: false,
+    isImplicitEntry: false,
+    facadeModuleId: null,
+    moduleIds: [],
+    exports: [],
+    imports: [],
+    dynamicImports: [],
+    implicitlyLoadedBefore: [],
+    importedBindings: {},
+    modules: {},
+    referencedFiles: [],
+  };
+  const asset: OutputAsset = {
+    type: 'asset',
+    fileName: `${fileName}.map`,
+    names: [],
+    originalFileNames: [],
+    source: JSON.stringify(raw),
+    name: undefined,
+    originalFileName: null,
+    needsCodeReference: false,
+  };
+  return { [fileName]: chunk, [`${fileName}.map`]: asset };
+}
+function chunk(bundle: OutputBundle): OutputChunk {
+  return Object.values(bundle).find((row): row is OutputChunk => row.type === 'chunk')!;
+}
+function runtime() {
+  return collectSentryArtifactInventory(fixture(), options).runtime;
+}
+function parse(value: unknown) {
+  return parseSentryArtifactInventory(JSON.stringify(value), identity);
+}
+
+describe('emitted Sentry artifact inventory', () => {
+  it('includes workers and dynamic chunks deterministically; hashes original bytes and keeps roots/content out of runtime', () => {
+    const bundle = { ...fixture('worker.cjs', OTHER_ID), ...fixture('index.cjs') };
+    const first = collectSentryArtifactInventory(bundle, options);
+    const indexChunk = bundle['index.cjs'] as OutputChunk;
+    const second = collectSentryArtifactInventory(
+      Object.fromEntries(Object.entries(bundle).reverse()),
+      options
+    );
+    expect(first).toEqual(second);
+    expect(first.runtime.artifacts.map((row) => row.relativeFile)).toEqual([
+      'dist-electron/main/index.cjs',
+      'dist-electron/main/worker.cjs',
+    ]);
+    expect(first.runtime.coverage).toEqual({
+      main: 'covered',
+      renderer: 'uncovered',
+      preload: 'uncovered',
+    });
+    expect(first.artifacts[0]?.source).toEqual({
+      sha256: createHash('sha256').update(indexChunk.code).digest('hex'),
+      bytes: Buffer.byteLength(indexChunk.code),
+    });
+    const original = bundle['index.cjs.map'] as OutputAsset;
+    expect(first.artifacts[0]?.originalMap).toEqual({
+      relativeFile: 'dist-electron/main/index.cjs.map',
+      sha256: createHash('sha256').update(original.source).digest('hex'),
+      bytes: Buffer.byteLength(original.source),
+    });
+    expect(first.mapStage).toBe('original-before-sentry-upload-preparation');
+    expect(first.uploadVerified).toBe(false);
+    expect(JSON.stringify(first.runtime)).not.toContain('sandbox-entry.ts');
+    expect(JSON.stringify(first.runtime)).not.toContain('/unused-test-directory');
+    expect(Object.isFrozen(first.runtime.artifacts[0])).toBe(true);
+  });
+  it('permits one debug ID at distinct locators and rejects conflicting/duplicate markers', () => {
+    expect(
+      collectSentryArtifactInventory({ ...fixture(), ...fixture('worker.cjs') }, options).runtime
+        .artifacts
+    ).toHaveLength(2);
+    for (const suffix of [
+      `;"sentry-dbid-${OTHER_ID}"`,
+      `;"sentry-dbid-${ID}"`,
+      ';"sentry-dbid-invalid"',
+    ]) {
+      const bundle = fixture();
+      chunk(bundle).code += suffix;
```

---

### Incident Patch 2: `77d6cfbe` (2026-10-05)
**Commit Message**: fix(renderer): fence session requests by tab lifetime (#812)

Fence session detail, refresh and project configuration publications by tab lifetime and request ownership. Normalize restored tabs before loading, preserving inactive caches.

Validated with 71 focused tests, six actual Electron IPC cases and a failing old-code ABA reproduction. Independent technical review and current-head CI passed.

Refs #812

**File**: `package.json` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@
     "dist:linux": "pnpm build && node ./scripts/stage-runtime.mjs --platform linux-x64 && node ./scripts/stage-terminal-platform-runtime.mjs --platform linux-x64 && node ./scripts/electron-builder/dist.mjs --linux",
     "smoke:packaged": "node ./scripts/electron-builder/smokePackagedApp.cjs",
     "preview": "electron-vite preview",
-    "typecheck": "node ./node_modules/@typescript/native/bin/tsc --noEmit && node ./node_modules/@typescript/native/bin/tsc --noEmit -p tsconfig.updater-e2e.json && node ./node_modules/@typescript/native/bin/tsc --noEmit -p tsconfig.release-tooling.json",
+    "typecheck": "node ./node_modules/@typescript/native/bin/tsc --noEmit && node ./node_modules/@typescript/native/bin/tsc --noEmit -p tsconfig.updater-e2e.json && node ./node_modules/@typescript/native/bin/tsc --noEmit -p tsconfig.release-tooling.json && node ./node_modules/@typescript/native/bin/tsc --noEmit -p tsconfig.sentry-e2e.json",
     "typecheck:legacy": "node ./node_modules/typescript/bin/tsc --noEmit",
     "typecheck:workspace": "pnpm typecheck && pnpm --filter agent-teams-mcp typecheck && pnpm --filter agent-teams-mcp typecheck:test",
     "lint": "node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js src/ --cache --cache-location .eslintcache --cache-strategy content",
```

**File**: `scripts/e2e/sentry-tab-identity/renderer.mts` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+import type { ElectronAPI } from '../../../src/shared/types/api.ts';
+import type { ClaudeMdStats } from '../../../src/renderer/types/claudeMd.ts';
+import type { ContextStats } from '../../../src/renderer/types/contextInjection.ts';
+import type { OpenTabOptions, Tab, TabInput } from '../../../src/renderer/types/tabs.ts';
+
+type Detail = Awaited<ReturnType<ElectronAPI['getSessionDetail']>>;
+interface SessionData {
+  sessionDetail: Detail;
+  sessionDetailLoading: boolean;
+  sessionDetailError: string | null;
+  conversationLoading: boolean;
+  sessionClaudeMdStats: Map<string, ClaudeMdStats> | null;
+  sessionContextStats: Map<string, ContextStats> | null;
+}
+interface State extends SessionData {
+  activeTabId: string | null;
+  selectedProjectId: string | null;
+  selectedSessionId: string | null;
+  projects: Awaited<ReturnType<ElectronAPI['getProjects']>>;
+  projectsLoading: boolean;
+  appConfig: unknown;
+  openTabs: Tab[];
+  tabSessionData: Record<string, SessionData>;
+  fetchProjects(): Promise<void>;
+  selectProject(project: string): void;
+  closeAllTabs(): void;
+  openTab(input: TabInput, options?: OpenTabOptions): void;
+  setActiveTab(id: string): void;
+}
+export type Boundary = 'getSessionDetail' | 'readDirectoryClaudeMd' | 'readMentionedFile';
+interface Gate {
+  originalGet: typeof Reflect.get;
+  release(): void;
+  waiting: number;
+  pending: number;
+  calls: { method: Boundary | 'readClaudeMdFiles'; args: unknown[]; fulfilled: boolean }[];
+}
+interface HarnessWindow {
+  electronAPI: ElectronAPI;
+  __agentTeamsDevStore: { getState(): State };
+  __sentryIdentityGate?: Gate;
+}
+export interface RendererInput {
+  project: string;
+  session: string;
+  directory: string;
+  mentioned: string;
+  boundary: Boundary;
+  tab?: string;
+}
+
+// Serialized into the owned renderer. It uses real preload APIs; only delivery
+// timing of a fulfilled test-session response changes. No production hooks.
+export async function renderer(action: string, input: RendererInput) {
+  const w = window as unknown as HarnessWindow;
+  const store = w.__agentTeamsDevStore;
+  if (action === 'ready') return Boolean(store?.getState().appConfig && w.electronAPI && navigator.userAgent.includes('Electron/'));
+  if (action === 'reset') {
+    w.__sentryIdentityGate?.release();
+    if (w.__sentryIdentityGate) Reflect.get = w.__sentryIdentityGate.originalGet;
+    delete w.__sentryIdentityGate;
+    store.getState().closeAllTabs();
+    await store.getState().fetchProjects();
+    const deadline = Date.now() + 10_000;
+    while (store.getState().projectsLoading) {
+      if (Date.now() > deadline) throw new Error('Synthetic project discovery did not finish');
+      await new Promise(resolve => setTimeout(resolve, 50));
+    }
+    if (!store.getState().projects.some(project => project.id === input.project)) throw new Error('Synthetic project missing from actual IPC');
+    store.getState().selectProject(input.project);
+    return true;
+  }
+  if (action === 'install') {
+    if (w.__sentryIdentityGate) throw new Error('Previous gate was not restored');
+    const originalGet = Reflect.get;
+    let release = () => {};
+    const held = new Promise<void>(resolve => { release = resolve; });
+    const gate: Gate = { originalGet, release, waiting: 0, pending: 0, calls: [] };
+    w.__sentryIdentityGate = gate;
+    const intercept = function(target: object, prop: PropertyKey, receiver?: unknown): unknown {
+      const value: unknown = originalGet(target, prop, receiver);
+      if (target !== w.electronAPI || typeof value !== 'function' ||
+          !['getSessionDetail', 'readClaudeMdFiles', 'readDirectoryClaudeMd', 'readMentionedFile'].includes(String(prop))) return value;
+      return async (...args: unknown[]) => {
+        const method = prop as Boundary | 'readClaudeMdFiles';
+        const call = { method, args, fulfilled: false };
+        gate.calls.push(call);
+        gate.pending++;
+        try {
+          const result: unknown = await (value as (...args: unknown[]) => Promise<unknown>).apply(w.electronAPI, args);
+          call.fulfilled = true;
+          const matches = method === input.boundary && (
+            method === 'getSessionDetail' ? args[1] === input.session :
+            method === 'readDirectoryClaudeMd' ? args[0] === input.directory : args[0] === input.mentioned
+          );
+          if (matches) { gate.waiting++; await held; gate.waiting--; }
+          return result;
+        } finally { gate.pending--; }
+      };
+    };
+    Reflect.get = intercept as typeof Reflect.get;
+    return true;
+  }
+  if (action === 'open' || action === 'replace') {
+    store.getState().openTab({ type: 'session', label: `Synthetic ${input.session}`, projectId: input.project, sessionId: input.session }, action === 'replace' ? { replaceActiveTab: true } : undefined);
+    const id = store.getState().activeTabId;
+    if (!id) throw new Error('No session tab o
```

**File**: `scripts/e2e/sentry-tab-identity/run.mts` (added, +287/-0)
```diff
@@ -0,0 +1,287 @@
+import assert from 'node:assert/strict';
+import { spawn } from 'node:child_process';
+import { createHash, randomUUID } from 'node:crypto';
+import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
+import { createServer } from 'node:net';
+import { tmpdir } from 'node:os';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { Cdp, waitFor } from '../release-updater/cdp.mts';
+import { captureNativeWindow, processIdentity, stopOwnedGroup } from '../release-updater/native-window.mts';
+import { renderer } from './renderer.mts';
+
+import type { RendererInput, Snapshot } from './renderer.mts';
+
+const repo = fileURLToPath(new URL('../../../', import.meta.url));
+const argumentsList = process.argv.slice(2);
+let outputArgument: string | undefined;
+let scenarioArgument = 'all';
+for (let index = 0; index < argumentsList.length; index += 2) {
+  const option = argumentsList[index], value = argumentsList[index + 1];
+  assert(value && (option === '--output' || option === '--scenario'), 'Usage: node run.mts [--output NEW_ABSOLUTE_DIRECTORY] [--scenario cache|aba|all]');
+  if (option === '--output') outputArgument = value;
+  else scenarioArgument = value;
+}
+assert(['cache', 'aba', 'all'].includes(scenarioArgument), 'Unknown scenario');
+const scenarios = scenarioArgument === 'all' ? ['cache', 'aba'] : [scenarioArgument];
+assert.equal(process.platform, 'linux', 'Native desktop E2E requires Linux hosted validation checkout');
+assert(process.env.DISPLAY, 'Start an isolated Xvfb display before running desktop E2E');
+assert(Number(process.versions.node.split('.')[0]) >= 24, 'Node 24+ is required for typed harness and native WebSocket');
+for (const file of ['/usr/bin/xwininfo', '/usr/bin/xprop', '/usr/bin/import', path.join(repo, 'node_modules/electron-vite/bin/electron-vite.js')]) {
+  await access(file).catch(() => { throw new Error(`Missing native prerequisite: ${file}`); });
+}
+const output = outputArgument ? path.resolve(outputArgument) : await mkdtemp(path.join(tmpdir(), 'sentry-tab-evidence-'));
+if (outputArgument) { assert(path.isAbsolute(outputArgument)); await mkdir(output); }
+const root = await mkdtemp(path.join(tmpdir(), 'sentry-tab-fixture-'));
+const rootIdentity = await stat(root);
+const claude = path.join(root, 'claude');
+const project = path.join(root, 'synthetic-project');
+const projectId = project.replace(/[^a-zA-Z0-9]/g, '-');
+const sessions = { A: randomUUID(), B: randomUUID() };
+const directories = { A: path.join(project, 'a'), B: path.join(project, 'b') };
+const mentions = { A: path.join(directories.A, 'mentioned.txt'), B: path.join(directories.B, 'mentioned.txt') };
+const evidence: Record<string, unknown> = {
+  started: new Date().toISOString(), node: process.versions.node, repo, output, scenarios,
+  isolation: { root, claude, project, projectId, sessions, userData: path.join(root, 'user-data') },
+  boundary: 'actual Electron desktop dev window / contextBridge preload IPC / synthetic JSONL and files',
+  cases: [],
+};
+let cdp: Cdp | undefined;
+let owner: Awaited<ReturnType<typeof processIdentity>> = null;
+let ownershipProbe: Promise<Awaited<ReturnType<typeof processIdentity>>> | undefined;
+let launchLog: Buffer = Buffer.alloc(0);
+let launchLogDroppedBytes = 0;
+let eventsDropped = 0;
+let rendererErrorCount = 0;
+const rendererErrors: Cdp['events'] = [];
+let signal: string | null = null;
+const interrupted = (received: NodeJS.Signals) => { signal = received; };
+process.once('SIGINT', interrupted);
+process.once('SIGTERM', interrupted);
+
+function appendLog(chunk: Buffer) {
+  const combined = Buffer.concat([launchLog, chunk]);
+  const excess = Math.max(0, combined.length - 1_048_576);
+  launchLogDroppedBytes += excess;
+  launchLog = combined.subarray(excess);
+}
+function isRendererError(event: Cdp['events'][number]) {
+  return event.method === 'Runtime.exceptionThrown' ||
+    (event.method === 'Runtime.consoleAPICalled' && (event.params as { type?: string })?.type === 'error') ||
+    (event.method === 'Log.entryAdded' && (event.params as { entry?: { level?: string } })?.entry?.level === 'error');
+}
+
+async function freePort() {
+  const server = createServer();
+  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
+  const address = server.address();
+  assert(address && typeof address !== 'string');
+  const port = address.port;
+  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
+  return port;
+}
+async function evaluate<T>(expression: string) {
+  assert(!signal, `Interrupted by ${signal}`);
+  assert(cdp, 'Desktop CDP must be connected');
+  const result = await cdp.send<{ result: { value: T }; exceptionDetails?: { text: string; exception?: { description: string } } }>('Runtime.evaluate', {
+    expression, returnByValue: true, awaitPromise: true
```

**File**: `src/renderer/store/session/sessionRequestIdentity.ts` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+import {
+  captureContextScopedRequestEpoch,
+  isContextScopedRequestEpochCurrent,
+} from '../utils/contextScopedRequestEpoch';
+import { getAllTabs } from '../utils/paneHelpers';
+
+import type { AppState } from '../types';
+
+function connectionScope(state: AppState): string {
+  // SessionAPI currently reads Claude transcripts only. Include its configurable
+  // provider root as well as the transport identity, including reconnect epochs.
+  return JSON.stringify([
+    'claude',
+    state.appConfig?.general?.claudeRootPath ?? null,
+    state.activeContextId,
+    state.connectionMode,
+    state.connectionState,
+    state.connectedHost,
+  ]);
+}
+
+function tabScope(state: AppState, tabId: string): string | null {
+  const tab = getAllTabs(state.paneLayout).find((candidate) => candidate.id === tabId);
+  return tab
+    ? JSON.stringify([tab.type, tab.createdAt, tab.projectId, tab.sessionId, tab.teamName])
+    : null;
+}
+
+export function createSessionRequestIdentity(get: () => AppState) {
+  const requests = new Map<string, symbol>();
+  const lifetimes = new Map<string, symbol>();
+  function captureScope(projectId: string, sessionId?: string, tabId?: string) {
+    const state = get();
+    const epoch = captureContextScopedRequestEpoch();
+    const connection = connectionScope(state);
+    const ownerTab = tabId ? getAllTabs(state.paneLayout).find((tab) => tab.id === tabId) : null;
+    const owner = tabId ? tabScope(state, tabId) : null;
+    const requestMatchesOwner =
+      ownerTab?.type !== 'session' ||
+      (ownerTab.projectId === projectId && ownerTab.sessionId === sessionId);
+    const lifetime = tabId ? (lifetimes.get(tabId) ?? Symbol('tab-instance')) : null;
+    if (tabId && lifetime) lifetimes.set(tabId, lifetime);
+    return () => {
+      const latest = get();
+      if (!isContextScopedRequestEpochCurrent(epoch) || connectionScope(latest) !== connection) {
+        return false;
+      }
+      // Inactive tabs remain valid. A missing or replaced owner never does.
+      if (tabId)
+        return (
+          requestMatchesOwner &&
+          owner !== null &&
+          lifetimes.get(tabId) === lifetime &&
+          tabScope(latest, tabId) === owner
+        );
+      return (
+        latest.selectedProjectId === projectId &&
+        (sessionId === undefined || latest.selectedSessionId === sessionId)
+      );
+    };
+  }
+  return {
+    captureScope,
+    captureLatestFetchScope(projectId: string, sessionId: string, tabId?: string) {
+      const key = tabId ?? '__global__';
+      const fetchToken = requests.get(key);
+      const scopeCurrent = captureScope(projectId, sessionId, tabId);
+      return () => requests.get(key) === fetchToken && scopeCurrent();
+    },
+    contextKey: () => JSON.stringify([captureContextScopedRequestEpoch(), connectionScope(get())]),
+    begin(projectId: string, sessionId: string, tabId?: string) {
+      const key = tabId ?? '__global__';
+      const token = Symbol('session-request');
+      const scopeCurrent = captureScope(projectId, sessionId, tabId);
+      if (!scopeCurrent()) return () => false;
+      requests.set(key, token);
+      return () => requests.get(key) === token && scopeCurrent();
+    },
+    invalidate(tabId: string) {
+      requests.delete(tabId);
+      lifetimes.delete(tabId);
+    },
+    viewing(projectId: string, sessionId: string, tabId?: string) {
+      const state = get();
+      const active = state.getActiveTab();
+      if (tabId && active?.id !== tabId) return false;
+      return active?.type === 'session'
+        ? active.projectId === projectId && active.sessionId === sessionId
+        : state.selectedProjectId === projectId && state.selectedSessionId === sessionId;
+    },
+  };
+}
```

**File**: `src/renderer/store/slices/sessionDetailSlice.ts` (modified, +591/-553)
```diff
@@ -4,7 +4,7 @@
 
 import { api } from '@renderer/api';
 import { asEnhancedChunkArray } from '@renderer/types/data';
-import { findTabBySession, truncateLabel } from '@renderer/types/tabs';
+import { truncateLabel } from '@renderer/types/tabs';
 import { processSessionClaudeMd } from '@renderer/utils/claudeMdTracker';
 import { processSessionContextWithPhases } from '@renderer/utils/contextTracker';
 import {
@@ -13,37 +13,12 @@ import {
 } from '@renderer/utils/groupTransformer';
 import { createLogger } from '@shared/utils/logger';
 
+import { createSessionRequestIdentity } from '../session/sessionRequestIdentity';
+import { getAllTabs } from '../utils/paneHelpers';
 import { resolveFilePath } from '../utils/pathResolution';
 
 const logger = createLogger('Store:sessionDetail');
 
-/**
- * Tracks latest refresh generation per session to avoid stale overwrites when
- * many file-change events trigger concurrent in-place refreshes.
- */
-const sessionRefreshGeneration = new Map<string, number>();
-const sessionRefreshInFlight = new Set<string>();
-const sessionRefreshQueued = new Set<string>();
-/**
- * Per-tab fetch generation counters. Prevents concurrent fetches from different
- * tabs from cancelling each other (only same-tab re-fetches are cancelled).
- */
-const tabFetchGeneration = new Map<string, number>();
-
-function incrementTabGeneration(tabId?: string): number {
-  const key = tabId ?? '__global__';
-  const gen = (tabFetchGeneration.get(key) ?? 0) + 1;
-  tabFetchGeneration.set(key, gen);
-  return gen;
-}
-
-function isCurrentTabGeneration(gen: number, tabId?: string): boolean {
-  return tabFetchGeneration.get(tabId ?? '__global__') === gen;
-}
-let agentConfigsCachedForProject = '';
-
-import { getAllTabs } from '../utils/paneHelpers';
-
 import type { AppState } from '../types';
 import type { ClaudeMdStats } from '@renderer/types/claudeMd';
 import type {
@@ -142,614 +117,677 @@ export interface SessionDetailSlice {
 export const createSessionDetailSlice: StateCreator<AppState, [], [], SessionDetailSlice> = (
   set,
   get
-) => ({
-  // Initial state
-  sessionDetail: null,
-  sessionDetailLoading: false,
-  sessionDetailError: null,
-
-  conversation: null,
-  conversationLoading: false,
-
-  // CLAUDE.md stats (injection tracking per AI group)
-  sessionClaudeMdStats: null,
-  // Unified context stats (CLAUDE.md + mentioned files + tool outputs)
-  sessionContextStats: null,
-  // Context phase info (compaction boundaries)
-  sessionPhaseInfo: null,
+) => {
+  const requests = createSessionRequestIdentity(get);
+  const sessionRefreshGeneration = new Map<string, symbol>();
+  const sessionRefreshInFlight = new Set<string>();
+  const sessionRefreshQueued = new Set<string>();
+  let agentConfigsCachedForProject = '';
+  let agentConfigRequest: symbol | null = null;
+  let agentConfigScopeCurrent = () => false;
+  return {
+    // Initial state
+    sessionDetail: null,
+    sessionDetailLoading: false,
+    sessionDetailError: null,
 
-  agentConfigs: {},
+    conversation: null,
+    conversationLoading: false,
 
-  visibleAIGroupId: null,
-  selectedAIGroup: null,
+    // CLAUDE.md stats (injection tracking per AI group)
+    sessionClaudeMdStats: null,
+    // Unified context stats (CLAUDE.md + mentioned files + tool outputs)
+    sessionContextStats: null,
+    // Context phase info (compaction boundaries)
+    sessionPhaseInfo: null,
 
-  // Per-tab session data
-  tabSessionData: {},
+    agentConfigs: {},
 
-  // Fetch full session detail with chunks and subagents
-  fetchSessionDetail: async (
-    projectId: string,
-    sessionId: string,
-    tabId?: string,
-    options?: { silent?: boolean }
-  ) => {
-    const requestGeneration = incrementTabGeneration(tabId);
-    if (!options?.silent) {
-      set({
-        sessionDetailLoading: true,
-        sessionDetailError: null,
-        conversationLoading: true,
-      });
-    }
+    visibleAIGroupId: null,
+    selectedAIGroup: null,
 
-    // Also set per-tab loading state
-    if (tabId && !options?.silent) {
-      const prev = get().tabSessionData;
-      set({
-        tabSessionData: {
-          ...prev,
-          [tabId]: {
-            ...(prev[tabId] ?? createEmptyTabSessionData()),
-            sessionDetailLoading: true,
-            sessionDetailError: null,
-            conversationLoading: true,
-          },
-        },
-      });
-    }
-    try {
-      const detail = await api.getSessionDetail(projectId, sessionId);
-      if (!isCurrentTabGeneration(requestGeneration, tabId)) {
-        return;
+    // Per-tab session data
+    tabSessionData: {},
+
+    // Fetch full session detail with chunks and subagents
+    fetchSessionDetail: async (
+      projectId: string,
+      sessionId: string,
+      tabId?: string,
+      options?: { silent?: boolean }
+    ) => {
+      const isCurrent = requests.begin(projectId, sessionId, tabId);
+      if (!isCurrent()) return;
+      if (!options?.silent && request
```

**File**: `src/renderer/store/slices/tabSlice.ts` (modified, +8/-10)
```diff
@@ -162,10 +162,10 @@ export const createTabSlice: StateCreator<AppState, [], [], TabSlice> = (set, ge
         ) {
           return;
         }
-        // Cleanup old tab's state if it was a session tab
+        // Invalidate the previous owner before reusing its ID (including team lead data).
+        state.cleanupTabSessionData(activeTab.id);
         if (activeTab.type === 'session') {
           state.cleanupTabUIState(activeTab.id);
-          state.cleanupTabSessionData(activeTab.id);
         }
 
         const replacementTab: Tab = {
@@ -266,42 +266,34 @@ export const createTabSlice: StateCreator<AppState, [], [], TabSlice> = (set, ge
   setActiveTab: (tabId: string) => {
     const state = get();
     const { paneLayout } = state;
-
     // Sentry breadcrumb for tab navigation
     const prevTab = state.getActiveTab();
     const targetPane = findPaneByTabId(paneLayout, tabId);
     const targetTab = targetPane?.tabs.find((t) => t.id === tabId);
     if (prevTab?.id !== tabId) {
       addNavigationBreadcrumb(prevTab?.label ?? 'none', targetTab?.label ?? tabId);
     }
-
     // Find which pane contains this tab
     const pane = findPaneByTabId(paneLayout, tabId);
     if (!pane) return;
-
     const tab = pane.tabs.find((t) => t.id === tabId);
     if (!tab) return;
-
     // Update pane's activeTabId and focus the pane
     const updatedPane = { ...pane, activeTabId: tabId };
     let newLayout = updatePane(paneLayout, updatedPane);
     newLayout = { ...newLayout, focusedPaneId: pane.id };
     set(syncFromLayout(newLayout));
-
     // For session tabs, sync sidebar state to match
     if (tab.type === 'session' && tab.sessionId && tab.projectId) {
       const sessionId = tab.sessionId;
       const projectId = tab.projectId;
       const sessionChanged = state.selectedSessionId !== sessionId;
-
       // Check if per-tab data is already cached
       const cachedTabData = state.tabSessionData[tabId];
       const hasCachedData = cachedTabData?.conversation != null;
-
       // Find the repository and worktree containing this session
       let foundRepo: string | null = null;
       let foundWorktree: string | null = null;
-
       for (const repo of state.repositoryGroups) {
         for (const wt of repo.worktrees) {
           if (wt.id === projectId) {
@@ -352,8 +344,14 @@ export const createTabSlice: StateCreator<AppState, [], [], TabSlice> = (set, ge
         (p) => p.id === projectId || p.sessions.includes(sessionId)
       );
       if (project) {
+        if (get().getActiveTab()?.id !== tabId) return;
         const projectChanged = state.selectedProjectId !== project.id;
+        const resolvedLayout = updateTabInLayout(get().paneLayout, tabId, (ownerTab) => ({
+          ...ownerTab,
+          projectId: project.id,
+        }));
         set({
+          ...syncFromLayout(resolvedLayout),
           activeProjectId: project.id,
           selectedProjectId: project.id,
           selectedSessionId: sessionId,
```

**File**: `test/renderer/store/sessionDetailIdentity.test.ts` (added, +395/-0)
```diff
@@ -0,0 +1,395 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+import { invalidateContextScopedRequestEpoch } from '../../../src/renderer/store/utils/contextScopedRequestEpoch';
+import { installMockElectronAPI } from '../../mocks/electronAPI';
+
+import { createTestStore } from './storeTestUtils';
+
+import type { SessionDetail } from '../../../src/renderer/types/data';
+import type { AgentConfig } from '../../../src/shared/types/api';
+
+function deferred<T>() {
+  let resolve!: (value: T) => void;
+  let reject!: (error: Error) => void;
+  const promise = new Promise<T>((res, rej) => {
+    resolve = res;
+    reject = rej;
+  });
+  return { promise, resolve, reject };
+}
+
+function detail(sessionId: string, projectId = 'sandbox-a'): SessionDetail {
+  return {
+    session: {
+      id: sessionId,
+      projectId,
+      projectPath: `/synthetic-test/${projectId}`,
+      createdAt: 1,
+      firstMessage: sessionId,
+      hasSubagents: false,
+      messageCount: 0,
+    },
+    messages: [],
+    chunks: [],
+    processes: [],
+    metrics: {
+      durationMs: 0,
+      totalTokens: 0,
+      inputTokens: 0,
+      outputTokens: 0,
+      cacheReadTokens: 0,
+      cacheCreationTokens: 0,
+      messageCount: 0,
+    },
+  };
+}
+
+describe('session detail owner identity', () => {
+  let store: ReturnType<typeof createTestStore>;
+  let mock: ReturnType<typeof installMockElectronAPI>;
+  let configs: ReturnType<typeof vi.fn<(root: string) => Promise<Record<string, AgentConfig>>>>;
+
+  beforeEach(() => {
+    mock = installMockElectronAPI();
+    configs = vi.fn().mockResolvedValue({});
+    Object.assign(mock, { readAgentConfigs: configs });
+    store = createTestStore();
+    let counter = 0;
+    vi.stubGlobal('crypto', { randomUUID: () => `sandbox-tab-${++counter}` });
+  });
+  afterEach(() => {
+    vi.unstubAllGlobals();
+    vi.restoreAllMocks();
+  });
+
+  function open(sessionId: string, projectId = 'sandbox-a', replaceActiveTab = false) {
+    store
+      .getState()
+      .openTab({ type: 'session', sessionId, projectId, label: sessionId }, { replaceActiveTab });
+    store.setState({ selectedProjectId: projectId, selectedSessionId: sessionId });
+    return store.getState().activeTabId!;
+  }
+
+  function transcriptSnapshot() {
+    const state = store.getState();
+    return {
+      sessionDetail: state.sessionDetail,
+      conversation: state.conversation,
+      sessionDetailLoading: state.sessionDetailLoading,
+      conversationLoading: state.conversationLoading,
+      sessionDetailError: state.sessionDetailError,
+      sessionClaudeMdStats: state.sessionClaudeMdStats,
+      sessionContextStats: state.sessionContextStats,
+      sessionPhaseInfo: state.sessionPhaseInfo,
+      visibleAIGroupId: state.visibleAIGroupId,
+      selectedAIGroup: state.selectedAIGroup,
+      tabSessionData: state.tabSessionData,
+      tabs: state.openTabs,
+    };
+  }
+
+  it('aligns a restored tab with the flat project resolved by session membership', async () => {
+    const id = open('A', 'missing-restored-project');
+    store.setState({
+      selectedProjectId: null,
+      selectedSessionId: null,
+      projects: [
+        {
+          id: 'sandbox-resolved',
+          name: 'Resolved sandbox',
+          path: '/synthetic-test/sandbox-resolved',
+          sessions: ['A'],
+          createdAt: 1,
+        },
+      ],
+    });
+    mock.getSessionDetail.mockResolvedValueOnce(detail('A', 'sandbox-resolved'));
+    store.getState().setActiveTab(id);
+    await vi.waitFor(() => {
+      expect(store.getState().tabSessionData[id]?.sessionDetail?.session.id).toBe('A');
+    });
+    expect(mock.getSessionDetail).toHaveBeenCalledExactlyOnceWith('sandbox-resolved', 'A');
+    expect(store.getState().getActiveTab()?.projectId).toBe('sandbox-resolved');
+    expect(store.getState().selectedProjectId).toBe('sandbox-resolved');
+    expect(store.getState().activeProjectId).toBe('sandbox-resolved');
+    expect(store.getState().selectedSessionId).toBe('A');
+    expect(store.getState().sessionDetail?.session.projectId).toBe('sandbox-resolved');
+    expect(store.getState().sessionDetailLoading).toBe(false);
+  });
+
+  it('aligns a restored tab before reusing its already loaded session cache', async () => {
+    const id = open('A', 'missing-restored-project');
+    mock.getSessionDetail.mockResolvedValueOnce(detail('A', 'sandbox-resolved'));
+    await store.getState().fetchSessionDetail('missing-restored-project', 'A', id);
+    const cached = store.getState().tabSessionData[id];
+    store.setState({
+      selectedProjectId: null,
+      selectedSessionId: null,
+      sessionDetail: null,
+      projects: [
+        {
+          id: 'sandbox-resolved',
+          name: 'Resolved sandbox',
+          path: '/synthetic-test/sandbox-resolved',
+          sessions: ['A'],
+          createdAt: 1,
+        },
+      ],
+    });
+    mock.getSessionDetail
```

**File**: `test/renderer/store/sessionSlice.test.ts` (modified, +3/-1)
```diff
@@ -304,7 +304,8 @@ describe('sessionSlice', () => {
   describe('fetchSessionDetail', () => {
     it('should ignore stale responses and keep the latest session detail', async () => {
       store.setState({
-        selectedSessionId: 'session-2',
+        selectedProjectId: 'project-1',
+        selectedSessionId: 'session-1',
       });
 
       let resolveFirst: ((value: unknown) => void) | undefined;
@@ -325,6 +326,7 @@ describe('sessionSlice', () => {
         );
 
       const first = store.getState().fetchSessionDetail('project-1', 'session-1');
+      store.setState({ selectedSessionId: 'session-2' });
       const second = store.getState().fetchSessionDetail('project-1', 'session-2');
 
       resolveSecond?.({
```

---

### Incident Patch 3: `4704ff06` (2026-10-05)
**Commit Message**: fix(build): validate Sentry identity before bundling

Canonicalize configured Git SHAs, skip malformed identity candidates and validate Git fallback. Reject incomplete covered builds before registering upload plugins while keeping no-auth builds admissible.

Refs #815

**File**: `electron.vite.config.ts` (modified, +13/-38)
```diff
@@ -11,6 +11,7 @@ import {
 } from './src/shared/utils/posthogBuildPolicy'
 import { resolveSentryBuildEnvironment } from './src/shared/utils/sentryBuildPolicy'
 import { sentryArtifactInventoryPlugin } from './scripts/build/sentryArtifactInventory'
+import { resolveSentryBuildIdentity } from './scripts/build/sentryBuildIdentity'
 
 // Read all production dependencies from package.json
 // so they get bundled into the main process output.
@@ -21,8 +22,17 @@ const terminalPlatformLocalRoot = resolveTerminalPlatformLocalRoot()
 const terminalPlatformSdkAliases = createTerminalPlatformSdkAliases()
 const rendererDependencyEsbuildTarget = 'esnext'
 const localEnv = loadEnv(process.env.NODE_ENV ?? 'development', __dirname, '')
-const buildGitSha = resolveBuildGitSha()
-const buildId = resolveBuildId(buildGitSha)
+const sentryBuildCovered = Boolean(process.env.SENTRY_AUTH_TOKEN)
+const { gitSha: buildGitSha, buildId } = resolveSentryBuildIdentity({
+  env: process.env,
+  localEnv,
+  covered: sentryBuildCovered,
+  readGitSha: () => execSync('git rev-parse HEAD', {
+    cwd: __dirname,
+    encoding: 'utf8',
+    stdio: ['ignore', 'pipe', 'ignore'],
+  }),
+})
 const sentryEnvironment = resolveSentryBuildEnvironment(process.env)
 const releaseChannel = resolveReleaseChannel()
 const officialPostHogBuild = isOfficialPostHogReleaseBuild(process.env)
@@ -54,41 +64,6 @@ function firstNonEmptyEnv(...values: Array<string | undefined>): string {
   return values.map(value => value?.trim() ?? '').find(Boolean) ?? ''
 }
 
-function resolveBuildGitSha(): string {
-  const fromEnv = firstNonEmptyEnv(
-    process.env.GIT_SHA,
-    localEnv.GIT_SHA,
-    process.env.GITHUB_SHA,
-    localEnv.GITHUB_SHA,
-    process.env.VERCEL_GIT_COMMIT_SHA,
-    localEnv.VERCEL_GIT_COMMIT_SHA,
-    process.env.COMMIT_SHA,
-    localEnv.COMMIT_SHA
-  )
-  if (fromEnv) return fromEnv
-
-  try {
-    return execSync('git rev-parse HEAD', {
-      cwd: __dirname,
-      encoding: 'utf8',
-      stdio: ['ignore', 'pipe', 'ignore'],
-    }).trim()
-  } catch {
-    return ''
-  }
-}
-
-function resolveBuildId(gitSha: string): string {
-  return (
-    firstNonEmptyEnv(
-      process.env.BUILD_ID,
-      localEnv.BUILD_ID,
-      process.env.VITE_BUILD_ID,
-      localEnv.VITE_BUILD_ID
-    ) || gitSha.slice(0, 12)
-  )
-}
-
 function resolveReleaseChannel(): string {
   return (
     firstNonEmptyEnv(
@@ -137,7 +112,7 @@ const sourceMapSetting = process.env.AGENT_TEAMS_DISABLE_SOURCEMAPS === '1' ? fa
 
 // Sentry source map upload - only active in CI when SENTRY_AUTH_TOKEN is set.
 function createSentryPlugins(target: keyof typeof sentrySourceMapTargets): Plugin[] {
-  const covered = Boolean(process.env.SENTRY_AUTH_TOKEN)
+  const covered = sentryBuildCovered
   return [
     ...(covered ? [sentryVitePlugin({
       org: process.env.SENTRY_ORG ?? 'quant-jump-pro',
```

**File**: `scripts/build/sentryBuildIdentity.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import type { SentryBuildIdentity } from '../../src/shared/utils/sentryArtifactInventory.js';
+
+type BuildEnvironment = Readonly<Record<string, string | undefined>>;
+type BuildIdentityOptions = Readonly<{
+  env: BuildEnvironment;
+  localEnv: BuildEnvironment;
+  readGitSha: () => string;
+  covered: boolean;
+}>;
+
+function canonicalGitSha(value: string | undefined): string {
+  const trimmed = value?.trim() ?? '';
+  return /^[0-9a-f]{40}$/i.test(trimmed) ? trimmed.toLowerCase() : '';
+}
+
+function validBuildId(value: string | undefined): string {
+  const trimmed = value?.trim() ?? '';
+  return /^[A-Za-z0-9][A-Za-z0-9._@+-]{0,159}$/.test(trimmed) ? trimmed : '';
+}
+
+/** Resolve before plugin registration so malformed optional env never reaches inventory admission. */
+export function resolveSentryBuildIdentity({
+  env,
+  localEnv,
+  readGitSha,
+  covered,
+}: BuildIdentityOptions): Readonly<Pick<SentryBuildIdentity, 'gitSha' | 'buildId'>> {
+  let gitSha = ['GIT_SHA', 'GITHUB_SHA', 'VERCEL_GIT_COMMIT_SHA', 'COMMIT_SHA']
+    .flatMap((name) => [env[name], localEnv[name]])
+    .map(canonicalGitSha)
+    .find(Boolean) ?? '';
+
+  if (!gitSha) {
+    try {
+      gitSha = canonicalGitSha(readGitSha());
+    } catch {
+      // Self-builds without Git can remain uncovered with empty identity.
+    }
+  }
+
+  const buildId = ['BUILD_ID', 'VITE_BUILD_ID']
+    .flatMap((name) => [env[name], localEnv[name]])
+    .map(validBuildId)
+    .find(Boolean) ?? gitSha.slice(0, 12);
+
+  if (covered && (!gitSha || !buildId)) {
+    throw new Error('Sentry upload requires a valid 40-character Git SHA and build ID');
+  }
+
+  return Object.freeze({ gitSha, buildId });
+}
```

**File**: `test/scripts/sentryBuildIdentity.test.ts` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+// @vitest-environment node
+import { describe, expect, it, vi } from 'vitest';
+
+import { resolveSentryBuildIdentity } from '../../scripts/build/sentryBuildIdentity.js';
+import { parseSentryArtifactInventory } from '../../src/shared/utils/sentryArtifactInventory.js';
+
+const SHA = '6e0036ec004c85c49c6da6d9ca0b80d8793bac63';
+const OTHER_SHA = '1234567890abcdef1234567890abcdef12345678';
+
+function acceptedUncoveredIdentity(identity: { gitSha: string; buildId: string }) {
+  const expected = { release: 'agent-teams-ai@2.17.1', ...identity };
+  return parseSentryArtifactInventory(JSON.stringify({
+    schemaVersion: 1,
+    ...expected,
+    artifacts: [],
+    coverage: { main: 'uncovered', renderer: 'uncovered', preload: 'uncovered' },
+  }), expected);
+}
+
+describe('build identity before inventory plugin registration', () => {
+  it('canonicalizes a valid uppercase SHA and preserves valid environment precedence', () => {
+    const readGitSha = vi.fn(() => OTHER_SHA);
+    const identity = resolveSentryBuildIdentity({
+      env: { GIT_SHA: ` ${SHA.toUpperCase()} `, BUILD_ID: ' official-build.1 ' },
+      localEnv: { GIT_SHA: OTHER_SHA, BUILD_ID: 'local-build' },
+      readGitSha,
+      covered: true,
+    });
+    expect(identity).toEqual({ gitSha: SHA, buildId: 'official-build.1' });
+    expect(readGitSha).not.toHaveBeenCalled();
+    expect(acceptedUncoveredIdentity(identity)).not.toBeNull();
+  });
+
+  it('skips malformed candidates in favor of the next valid configured values', () => {
+    const identity = resolveSentryBuildIdentity({
+      env: { GIT_SHA: 'not-a-sha', BUILD_ID: 'private/path', VITE_BUILD_ID: 'next-build' },
+      localEnv: { GIT_SHA: ` ${OTHER_SHA.toUpperCase()} `, BUILD_ID: 'also invalid' },
+      readGitSha: () => SHA,
+      covered: false,
+    });
+    expect(identity).toEqual({ gitSha: OTHER_SHA, buildId: 'next-build' });
+    expect(acceptedUncoveredIdentity(identity)).not.toBeNull();
+  });
+
+  it('uses actual Git fallback and its short SHA when optional identity env is malformed', () => {
+    const identity = resolveSentryBuildIdentity({
+      env: { GIT_SHA: 'short-sha', GITHUB_SHA: '../private', BUILD_ID: 'release/private' },
+      localEnv: { COMMIT_SHA: 'not-hex', VITE_BUILD_ID: 'x'.repeat(161) },
+      readGitSha: () => `${SHA.toUpperCase()}\n`,
+      covered: true,
+    });
+    expect(identity).toEqual({ gitSha: SHA, buildId: '6e0036ec004c' });
+    expect(acceptedUncoveredIdentity(identity)).not.toBeNull();
+  });
+
+  it.each(['missing', 'invalid'] as const)('keeps no-auth builds admissible when Git is %s', (git) => {
+    const identity = resolveSentryBuildIdentity({
+      env: { GIT_SHA: 'malformed', BUILD_ID: 'private/path' },
+      localEnv: {},
+      readGitSha: () => {
+        if (git === 'missing') throw new Error('Git unavailable');
+        return 'invalid-git-output';
+      },
+      covered: false,
+    });
+    expect(identity).toEqual({ gitSha: '', buildId: '' });
+    expect(acceptedUncoveredIdentity(identity)).not.toBeNull();
+  });
+
+  it('retains a valid build ID without Git for an uncovered build only', () => {
+    const options = {
+      env: { GIT_SHA: 'invalid', BUILD_ID: 'valid-build' },
+      localEnv: {},
+      readGitSha: () => '',
+    };
+    const identity = resolveSentryBuildIdentity({ ...options, covered: false });
+    expect(identity).toEqual({ gitSha: '', buildId: 'valid-build' });
+    expect(acceptedUncoveredIdentity(identity)).not.toBeNull();
+    expect(() => resolveSentryBuildIdentity({ ...options, covered: true })).toThrow(
+      'Sentry upload requires a valid 40-character Git SHA and build ID'
+    );
+  });
+
+  it('rejects incomplete covered identity synchronously without exposing malformed values', () => {
+    expect(() => resolveSentryBuildIdentity({
+      env: { GIT_SHA: '/private/git-secret', BUILD_ID: '/private/build-secret' },
+      localEnv: {},
+      readGitSha: () => { throw new Error('private-git-error'); },
+      covered: true,
+    })).toThrow(new Error('Sentry upload requires a valid 40-character Git SHA and build ID'));
+  });
+});
```

---

### Incident Patch 4: `124c9e43` (2026-10-05)
**Commit Message**: docs(release): document Linux and Windows 2.17.3 draft

Document the Linux and Windows 2.17.3 draft with the accepted product notes and downloads. Preserve signed macOS 2.17.1, its macOS 12 floor and all 19 historical release bodies.

Independent technical review approved the exact documentation patch. Announcements Content 37364842823 passed on head 367a3be29b989e2a6dc48805a7e5ed5d5ae584db; the isolated server reproduced all three workflow commands with 13 publishing invariants passing. Publication and final native release E2E remain pending.

**File**: `docs/RELEASE.md` (modified, +50/-0)
```diff
@@ -29,6 +29,56 @@ Before publishing:
 - Confirm the GitHub release title is exactly the tag (`v2.15.0`), not `Agent Teams v2.15.0`.
 - Keep the body in this document identical to the GitHub release body.
 
+## v2.17.3 (Draft)
+
+Application target (frozen): `acda6e3a0990aec3cd37b9bd696f36e78aaa4322`.
+
+Platform versions:
+
+- Windows x64/ARM64 and Linux x64: `2.17.3`.
+- macOS Apple Silicon/Intel: existing signed `2.17.1` builds, requiring macOS 12 or later.
+
+macOS source: `v2.17.1`, application commit `395572f9ff2a261cb28224754883a39d2c3c8827`.
+
+Release body source for GitHub release:
+
+<!-- RELEASE_BODY_START v2.17.3 -->
+Windows and Linux 2.17.3 introduce monthly usage budgets for teams and projects. macOS downloads remain the existing signed 2.17.1 builds.
+
+### What's New
+
+- Set monthly token and estimated API cost budgets for all teams, individual teams, or projects.
+- Choose custom budget thresholds for notifications.
+- Explore model breakdowns and activity calendars in the updated Usage dashboard.
+
+Cost figures are estimates, not provider invoices.
+
+### Fixes
+
+- Keep task Changes available after app restarts, including renamed files and interrupted recovery.
+- Retry failed update downloads or use manual download guidance when an update cannot finish.
+- Stop provider cards getting stuck loading and ignore stale Claude CLI settings that blocked sign-in.
+- Keep Linux maximize and restore controls aligned with the actual window state.
+- Install the Arch Linux package without requiring the obsolete http-parser dependency.
+- Include security updates for bundled dependencies.
+
+### Downloads
+
+| Platform | Version | Download |
+| --- | --- | --- |
+| Windows x64 | 2.17.3 | [Installer](https://github.com/777genius/agent-teams-ai/releases/download/v2.17.3/Agent.Teams.AI.Setup.2.17.3.exe) |
+| Windows ARM64 | 2.17.3 | [Installer](https://github.com/777genius/agent-teams-ai/releases/download/v2.17.3/Agent.Teams.AI.Setup.2.17.3-arm64.exe) |
+| Linux x64 | 2.17.3 | [AppImage](https://github.com/777genius/agent-teams-ai/releases/download/v2.17.3/Agent.Teams.AI-2.17.3.AppImage), [DEB](https://github.com/777genius/agent-teams-ai/releases/download/v2.17.3/agent-teams-ai_2.17.3_amd64.deb), [RPM](https://github.com/777genius/agent-teams-ai/releases/download/v2.17.3/agent-teams-ai-2.17.3.x86_64.rpm), [Arch Linux](https://github.com/777genius/agent-teams-ai/releases/download/v2.17.3/agent-teams-ai-2.17.3.pacman) |
+| macOS Apple Silicon | 2.17.1 | [DMG](https://github.com/777genius/agent-teams-ai/releases/download/v2.17.1/Agent.Teams.AI-2.17.1-arm64.dmg) |
+| macOS Intel | 2.17.1 | [DMG](https://github.com/777genius/agent-teams-ai/releases/download/v2.17.1/Agent.Teams.AI-2.17.1-x64.dmg) |
+
+macOS downloads require macOS 12 or later. The What's New and Fixes sections apply to Windows and Linux 2.17.3.
+
+Windows installers may trigger SmartScreen - click "More info" then "Run anyway".
+
+Run normally. Administrator mode may be needed only if the app reports a specific OpenCode symlink or permission error.
+<!-- RELEASE_BODY_END v2.17.3 -->
+
 ## v2.17.2 (2026-10-01)
 
 Target branch: `main`.
```

---

### Incident Patch 5: `6e0036ec` (2026-10-05)
**Commit Message**: build: record verified Sentry artifact inventories

**File**: `electron.vite.config.ts` (modified, +17/-4)
```diff
@@ -10,6 +10,7 @@ import {
   resolvePostHogBuildKey,
 } from './src/shared/utils/posthogBuildPolicy'
 import { resolveSentryBuildEnvironment } from './src/shared/utils/sentryBuildPolicy'
+import { sentryArtifactInventoryPlugin } from './scripts/build/sentryArtifactInventory'
 
 // Read all production dependencies from package.json
 // so they get bundled into the main process output.
@@ -136,17 +137,29 @@ const sourceMapSetting = process.env.AGENT_TEAMS_DISABLE_SOURCEMAPS === '1' ? fa
 
 // Sentry source map upload - only active in CI when SENTRY_AUTH_TOKEN is set.
 function createSentryPlugins(target: keyof typeof sentrySourceMapTargets): Plugin[] {
-  if (!process.env.SENTRY_AUTH_TOKEN) return []
-
+  const covered = Boolean(process.env.SENTRY_AUTH_TOKEN)
   return [
-    sentryVitePlugin({
+    ...(covered ? [sentryVitePlugin({
       org: process.env.SENTRY_ORG ?? 'quant-jump-pro',
       project: process.env.SENTRY_PROJECT ?? 'electron',
       authToken: process.env.SENTRY_AUTH_TOKEN,
       telemetry: false,
       release: { name: `agent-teams-ai@${pkg.version}` },
       sourcemaps: sentrySourceMapTargets[target],
-    }) as Plugin,
+    }) as Plugin] : []),
+    sentryArtifactInventoryPlugin({
+      target,
+      covered,
+      release: `agent-teams-ai@${pkg.version}`,
+      buildId,
+      gitSha: buildGitSha,
+      evidenceDirectory: resolve(
+        __dirname,
+        '.artifacts/sentry',
+        buildGitSha || 'unknown',
+        buildId || 'unknown'
+      ),
+    }),
   ]
 }
 
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -92,6 +92,7 @@
     "guard:runtime-artifacts": "node ./scripts/ci/forbid-runtime-artifacts.cjs",
     "guard:source-file-size": "node ./scripts/ci/check-source-file-size.mjs",
     "guard:team-provisioning-architecture": "node ./scripts/ci/check-team-provisioning-architecture.mjs",
+    "test:sentry-inventory": "vitest run test/scripts/sentryArtifactInventory.test.ts test/scripts/sentryArtifactInventory.integration.test.ts",
     "test:chunks": "tsx test/test-chunk-building.ts",
     "test:semantic": "tsx test/test-semantic-steps.ts",
     "test:noise": "tsx test/test-noise-filtering.ts",
```

**File**: `scripts/build/sentryArtifactInventory.ts` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+import { createHash } from 'node:crypto';
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { basename, join } from 'node:path';
+import type { Plugin, Rollup } from 'vite';
+import {
+  isSentryArtifactFile,
+  parseSentryArtifactInventory,
+  SENTRY_DEBUG_ID_PATTERN,
+  SENTRY_INVENTORY_FILE,
+  SENTRY_INVENTORY_MAX_ARTIFACTS,
+  SENTRY_INVENTORY_MAX_BYTES,
+  SENTRY_INVENTORY_PAYLOAD_ID,
+  SENTRY_TARGET_PREFIXES,
+  type SentryBuildIdentity,
+  type SentryRuntimeInventory,
+} from '../../src/shared/utils/sentryArtifactInventory.js';
+
+type OutputBundle = Rollup.OutputBundle;
+type OutputChunk = Rollup.OutputChunk;
+
+const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
+const MAX_MAP_BYTES = 256 * 1024 * 1024;
+const MAX_HTML_BYTES = 4 * 1024 * 1024;
+export type SentryCoveredTarget = 'main' | 'renderer';
+export type SentryArtifactEvidence = Readonly<{
+  relativeFile: string;
+  debugId: string;
+  source: Readonly<{ sha256: string; bytes: number }>;
+  originalMap: Readonly<{ relativeFile: string; sha256: string; bytes: number }>;
+}>;
+export type SentryInventoryEvidence = Readonly<{
+  schemaVersion: 1;
+  target: SentryCoveredTarget;
+  runtime: SentryRuntimeInventory;
+  runtimeSha256: string;
+  mapStage: 'original-before-sentry-upload-preparation';
+  uploadVerified: false;
+  artifacts: readonly SentryArtifactEvidence[];
+}>;
+export type SentryInventoryOptions = SentryBuildIdentity &
+  Readonly<{
+    target: SentryCoveredTarget;
+    covered: boolean;
+    evidenceDirectory: string;
+  }>;
+
+function digest(value: string): { sha256: string; bytes: number } {
+  return {
+    sha256: createHash('sha256').update(value).digest('hex'),
+    bytes: Buffer.byteLength(value),
+  };
+}
+function bounded(value: string, limit: number, name: string): void {
+  if (Buffer.byteLength(value) > limit) throw new Error(`Sentry inventory: oversized ${name}`);
+}
+function sourceOf(value: string | Uint8Array): string {
+  return typeof value === 'string' ? value : Buffer.from(value).toString('utf8');
+}
+function debugId(code: string): string {
+  const markers = [...code.matchAll(/sentry-dbid-([^"'`\s;]+)/g)];
+  if (markers.length !== 1 || !SENTRY_DEBUG_ID_PATTERN.test(markers[0]?.[1] ?? '')) {
+    throw new Error('Sentry inventory: expected exactly one canonical injected debug ID');
+  }
+  return markers[0]![1]!;
+}
+function verifyMap(json: string, chunk: OutputChunk, id: string): void {
+  let map: unknown;
+  try {
+    map = JSON.parse(json);
+  } catch {
+    throw new Error('Sentry inventory: malformed source map');
+  }
+  if (!map || typeof map !== 'object' || Array.isArray(map))
+    throw new Error('Sentry inventory: invalid v3 source map');
+  const value = map as Record<string, unknown>;
+  if (
+    value.version !== 3 ||
+    typeof value.mappings !== 'string' ||
+    !/^[A-Za-z0-9+/,;]*$/.test(value.mappings) ||
+    !Array.isArray(value.sources) ||
+    !value.sources.length ||
+    !value.sources.every((source) => typeof source === 'string') ||
+    !Array.isArray(value.names) ||
+    !value.names.every((name) => typeof name === 'string') ||
+    (value.file !== undefined &&
+      value.file !== chunk.fileName &&
+      value.file !== basename(chunk.fileName)) ||
+    (value.sourcesContent !== undefined &&
+      (!Array.isArray(value.sourcesContent) ||
+        value.sourcesContent.length !== value.sources.length ||
+        !value.sourcesContent.every(
+          (content) => content === null || typeof content === 'string'
+        ))) ||
+    ['debugId', 'debug_id'].some((key) => value[key] !== undefined && value[key] !== id)
+  ) {
+    throw new Error('Sentry inventory: invalid or mismatched v3 source map');
+  }
+  // Rollup owns the original chunk/map association. Do not admit an unrelated asset by filename alone.
+  if (!chunk.map || JSON.stringify(JSON.parse(chunk.map.toString())) !== JSON.stringify(map)) {
+    throw new Error('Sentry inventory: emitted source map differs from chunk map');
+  }
+}
+
+/** Uses only this build's emitted chunks; never scans stale files in an output directory. */
+export function collectSentryArtifactInventory(
+  bundle: OutputBundle,
+  options: SentryInventoryOptions
+): SentryInventoryEvidence {
+  if (
+    options.covered &&
+    Object.values(bundle).some(
+      (item) => item.type === 'asset' && /\.(?:js|cjs|mjs)$/.test(item.fileName)
+    )
+  ) {
+    throw new Error('Sentry inventory: JavaScript asset lacks a Rollup chunk/map association');
+  }
+  const chunks = Object.values(bundle).filter((item): item is OutputChunk => item.type === 'chunk');
+  if (chunks.length > SENTRY_INVENTORY_MAX_ARTIFACTS)
+    throw new Error('Sentry inventory: too many emitted chunks');
+  const artifacts: SentryArtifactEvidence[] = [];
+  const rows: SentryRuntimeInventory['artifacts'][number][] = [];
+  if (options.covered && !chunks.length)
+    throw new Error('Sentry inventory: covered target has no chunks');
+  for (co
```

**File**: `scripts/build/verifySentryArtifactInventory.ts` (added, +279/-0)
```diff
@@ -0,0 +1,279 @@
+/** Disposable real locked-plugin build. Run only on the validation host, without inherited Sentry auth. */
+import { sentryVitePlugin } from '@sentry/vite-plugin';
+import { resolveConfig as resolveElectronConfig } from 'electron-vite';
+import { createHash } from 'node:crypto';
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { join, resolve } from 'node:path';
+import {
+  build,
+  resolveConfig as resolveViteConfig,
+  version as viteVersion,
+  type Plugin,
+  type Rollup,
+} from 'vite';
+import {
+  sentryArtifactInventoryPlugin,
+  type SentryCoveredTarget,
+} from './sentryArtifactInventory.js';
+import {
+  parseSentryArtifactInventory,
+  SENTRY_INVENTORY_FILE,
+  SENTRY_INVENTORY_PAYLOAD_ID,
+} from '../../src/shared/utils/sentryArtifactInventory.js';
+
+const identity = {
+  release: 'agent-teams-ai@inventory-sandbox',
+  buildId: 'inventory-sandbox',
+  gitSha: '1234567890abcdef1234567890abcdef12345678',
+};
+const root = process.argv[2];
+if (!root) throw new Error('Supply a disposable synthetic build directory');
+if (Object.keys(process.env).some((key) => key.startsWith('SENTRY_')))
+  throw new Error('Sentry environment must be isolated');
+const directory = resolve(root);
+await mkdir(directory, { recursive: true });
+// Never inherit a tsconfig from a shared temporary parent or another validation job.
+await writeFile(
+  join(directory, 'tsconfig.json'),
+  JSON.stringify({
+    compilerOptions: {
+      target: 'ES2023',
+      module: 'ESNext',
+      moduleResolution: 'Bundler',
+      strict: true,
+    },
+  })
+);
+await writeFile(
+  join(directory, 'main.ts'),
+  'export function syntheticMain() { throw new Error("synthetic-main"); }\n'
+);
+await writeFile(
+  join(directory, 'worker.ts'),
+  'export function syntheticWorker() { throw new Error("synthetic-worker"); }\n'
+);
+await writeFile(
+  join(directory, 'renderer.ts'),
+  'globalThis.addEventListener("synthetic", async () => (await import("./dynamic.ts")).syntheticDynamic());\n'
+);
+await writeFile(
+  join(directory, 'dynamic.ts'),
+  'export function syntheticDynamic() { throw new Error("synthetic-dynamic"); }\n'
+);
+await writeFile(
+  join(directory, 'index.html'),
+  '<html><head></head><body><script type="module" src="/renderer.ts"></script></body></html>\n'
+);
+// Resolve the installed Electron preset, rather than using Vite's browser compatibility defaults.
+const electronConfigFile = join(directory, 'electron.synthetic.config.ts');
+await writeFile(electronConfigFile, 'export default { renderer: {} };\n');
+const electronConfig = await resolveElectronConfig(
+  {
+    root: directory,
+    configFile: electronConfigFile,
+    ignoreConfigWarning: true,
+    logLevel: 'silent',
+  },
+  'build',
+  'production'
+);
+if (!electronConfig.config?.renderer) throw new Error('Synthetic Electron renderer preset missing');
+const rendererConfig = await resolveViteConfig(
+  {
+    ...electronConfig.config.renderer,
+    configFile: false,
+    root: directory,
+    envDir: directory,
+    base: './',
+    logLevel: 'silent',
+    build: {
+      outDir: join(directory, 'renderer'),
+      rollupOptions: { input: join(directory, 'index.html') },
+    },
+  },
+  'build',
+  'production'
+);
+const rendererBuildTarget = rendererConfig.build.target;
+const observations: unknown[] = [];
+function hash(code: string): string {
+  return createHash('sha256').update(code).digest('hex');
+}
+for (const target of ['main', 'renderer'] as const) {
+  const outDir = join(directory, target);
+  const evidenceDirectory = join(directory, 'host-evidence');
+  const early = new Map<string, string>();
+  const before = new Map<string, { source: string; map: string }>();
+  const hookOrder: string[] = [];
+  const earlyObserver: Plugin = {
+    name: 'synthetic-inventory-early-vite-observer',
+    generateBundle: {
+      order: 'pre',
+      handler(_options, bundle) {
+        hookOrder.push('generateBundle-before-vite-finalizers');
+        for (const item of Object.values(bundle))
+          if (item.type === 'chunk') early.set(item.fileName, hash(item.code));
+      },
+    },
+  };
+  const observer: Plugin = {
+    name: 'synthetic-inventory-order-observer',
+    enforce: 'post',
+    generateBundle: {
+      order: 'post',
+      handler(_options, bundle) {
+        hookOrder.push('generateBundle-before-inventory');
+        for (const item of Object.values(bundle)) {
+          if (item.type !== 'chunk') continue;
+          const map = bundle[`${item.fileName}.map`];
+          if (!map || map.type !== 'asset') throw new Error('Finalizer observer missing map');
+          before.set(item.fileName, {
+            source: hash(item.code),
+            map: hash(
+              typeof map.source === 'string' ? map.source : Buffer.from(map.source).toString('utf8')
+            ),
+          });
+        }
+      },
+    },
+    writeBundle: {
+      order: 'post',
+      async handler(_opt
```

**File**: `src/shared/utils/sentryArtifactInventory.ts` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+/** Application-owned build contract. These records never contain filesystem roots or map content. */
+export const SENTRY_INVENTORY_FILE = 'sentry-artifact-inventory.json';
+export const SENTRY_INVENTORY_PAYLOAD_ID = 'sentry-artifact-inventory';
+export const SENTRY_INVENTORY_MAX_BYTES = 256 * 1024;
+export const SENTRY_INVENTORY_MAX_ARTIFACTS = 1024;
+export const SENTRY_DEBUG_ID_PATTERN =
+  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
+export const SENTRY_TARGET_PREFIXES = {
+  main: 'dist-electron/main/',
+  renderer: 'out/renderer/',
+  preload: 'dist-electron/preload/',
+} as const;
+
+export type SentryArtifactTarget = keyof typeof SENTRY_TARGET_PREFIXES;
+export type SentryBuildIdentity = Readonly<{ release: string; buildId: string; gitSha: string }>;
+export type SentryRuntimeArtifact = Readonly<{
+  target: SentryArtifactTarget;
+  relativeFile: string;
+  locator: string;
+  debugId: string;
+}>;
+export type SentryRuntimeInventory = SentryBuildIdentity &
+  Readonly<{
+    schemaVersion: 1;
+    artifacts: readonly SentryRuntimeArtifact[];
+    coverage: Readonly<Record<SentryArtifactTarget, 'covered' | 'uncovered'>>;
+  }>;
+
+export function isSentryArtifactFile(value: string): boolean {
+  return (
+    value.length <= 512 &&
+    /^[A-Za-z0-9_./-]+\.(?:js|cjs|mjs)$/.test(value) &&
+    value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
+  );
+}
+
+function object(value: unknown): value is Record<string, unknown> {
+  return typeof value === 'object' && value !== null && !Array.isArray(value);
+}
+function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
+  return (
+    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
+  );
+}
+function identityToken(value: unknown, allowEmpty: boolean): value is string {
+  return (
+    typeof value === 'string' &&
+    ((allowEmpty && value === '') || /^[A-Za-z0-9][A-Za-z0-9._@+-]{0,159}$/.test(value))
+  );
+}
+
+/** Bounded, strict and fail-closed. Copy/freeze admitted data rather than retaining untrusted objects. */
+export function parseSentryArtifactInventory(
+  json: string,
+  expected: SentryBuildIdentity
+): SentryRuntimeInventory | null {
+  if (
+    json.length > SENTRY_INVENTORY_MAX_BYTES ||
+    new TextEncoder().encode(json).length > SENTRY_INVENTORY_MAX_BYTES
+  )
+    return null;
+  try {
+    const value: unknown = JSON.parse(json);
+    if (
+      !object(value) ||
+      !exactKeys(value, [
+        'schemaVersion',
+        'release',
+        'buildId',
+        'gitSha',
+        'artifacts',
+        'coverage',
+      ]) ||
+      value.schemaVersion !== 1 ||
+      !identityToken(value.release, false) ||
+      !identityToken(value.buildId, true) ||
+      typeof value.gitSha !== 'string' ||
+      (value.gitSha !== '' && !/^[0-9a-f]{40}$/.test(value.gitSha)) ||
+      value.release !== expected.release ||
+      value.buildId !== expected.buildId ||
+      value.gitSha !== expected.gitSha ||
+      !object(value.coverage) ||
+      !exactKeys(value.coverage, ['main', 'renderer', 'preload']) ||
+      !Array.isArray(value.artifacts) ||
+      value.artifacts.length > SENTRY_INVENTORY_MAX_ARTIFACTS
+    )
+      return null;
+    const coverage = value.coverage;
+    if (Object.values(coverage).some((status) => status !== 'covered' && status !== 'uncovered'))
+      return null;
+    if (Object.values(coverage).includes('covered') && (!value.buildId || !value.gitSha))
+      return null;
+    const artifacts: SentryRuntimeArtifact[] = [];
+    let previous = '';
+    for (const row of value.artifacts) {
+      if (
+        !object(row) ||
+        !exactKeys(row, ['target', 'relativeFile', 'locator', 'debugId']) ||
+        typeof row.target !== 'string' ||
+        !Object.hasOwn(SENTRY_TARGET_PREFIXES, row.target) ||
+        typeof row.relativeFile !== 'string' ||
+        !isSentryArtifactFile(row.relativeFile) ||
+        typeof row.locator !== 'string' ||
+        row.locator !== `app:///${row.relativeFile}` ||
+        typeof row.debugId !== 'string' ||
+        !SENTRY_DEBUG_ID_PATTERN.test(row.debugId)
+      )
+        return null;
+      const target = row.target as SentryArtifactTarget;
+      if (
+        coverage[target] !== 'covered' ||
+        !row.relativeFile.startsWith(SENTRY_TARGET_PREFIXES[target]) ||
+        row.locator <= previous
+      )
+        return null;
+      previous = row.locator;
+      artifacts.push(
+        Object.freeze({
+          target,
+          relativeFile: row.relativeFile,
+          locator: row.locator,
+          debugId: row.debugId,
+        })
+      );
+    }
+    if (
+      Object.keys(SENTRY_TARGET_PREFIXES).some(
+        (target) =>
+          coverage[target] === 'covered' && !artifacts.some((row) => row.target === target)
+      )
+    )
+      return null;
+    return Object.freeze({
+      schemaVersio
```

**File**: `test/scripts/sentryArtifactInventory.integration.test.ts` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+// @vitest-environment node
+import { execFile } from 'node:child_process';
+import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
+import { createRequire } from 'node:module';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+import { promisify } from 'node:util';
+
+import { expect, it } from 'vitest';
+
+it('observes real locked Sentry injection, worker/dynamic inventory and final Vite HTML before writeBundle', async () => {
+  const directory = await mkdtemp(join(tmpdir(), 'sentry-inventory-build-'));
+  let passed = false;
+  try {
+    const tsconfig = join(directory, 'tsconfig.json');
+    await writeFile(
+      tsconfig,
+      JSON.stringify({
+        compilerOptions: {
+          target: 'ES2023',
+          module: 'ESNext',
+          moduleResolution: 'Bundler',
+          strict: true,
+        },
+      })
+    );
+    const harness = fileURLToPath(
+      new URL('../../scripts/build/verifySentryArtifactInventory.ts', import.meta.url)
+    );
+    const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
+    await promisify(execFile)(process.execPath, ['--import', tsxLoader, harness, directory], {
+      cwd: directory,
+      // No SENTRY_* vars, env files, real HOME or upload credentials reach the child.
+      env: {
+        PATH: process.env.PATH,
+        HOME: directory,
+        USERPROFILE: directory,
+        NODE_ENV: 'production',
+        TSX_TSCONFIG_PATH: tsconfig,
+      },
+      timeout: 60_000,
+      maxBuffer: 1024 * 1024,
+    });
+    const report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'));
+    expect(report.uploadDisabled).toBe(true);
+    expect(report.rendererBuildTarget).toMatch(/^chrome[0-9]+$/);
+    expect(report.observations).toHaveLength(2);
+    expect(report.observations[0].artifactFiles).toEqual([
+      'dist-electron/main/main.cjs',
+      'dist-electron/main/worker.cjs',
+    ]);
+    expect(report.observations[1].artifactFiles).toHaveLength(2);
+    expect(
+      report.observations[1].artifactFiles.some((file: string) =>
+        /^out\/renderer\/assets\/dynamic-.*\.js$/.test(file)
+      )
+    ).toBe(true);
+    for (const observation of report.observations) {
+      expect(observation.hookOrder).toEqual([
+        'generateBundle-before-vite-finalizers',
+        'generateBundle-before-inventory',
+        'writeBundle-after-inventory',
+      ]);
+      expect(observation.jsUnchanged).toBe(true);
+      expect(observation.originalMapsMatched).toBe(true);
+      expect(observation.runtime.coverage.preload).toBe('uncovered');
+    }
+    expect(report.observations[1].viteFinalizerChangedFiles.length).toBeGreaterThan(0);
+    passed = true;
+  } finally {
+    if (passed) await rm(directory, { recursive: true, force: true });
+    else console.error(`Synthetic Sentry failure evidence retained at ${directory}`);
+  }
+}, 75_000);
```

**File**: `test/scripts/sentryArtifactInventory.test.ts` (added, +275/-0)
```diff
@@ -0,0 +1,275 @@
+// @vitest-environment node
+import { createHash } from 'node:crypto';
+
+import { describe, expect, it } from 'vitest';
+
+import {
+  collectSentryArtifactInventory,
+  insertSentryInventoryPayload,
+  type SentryInventoryOptions,
+} from '../../scripts/build/sentryArtifactInventory.js';
+import {
+  parseSentryArtifactInventory,
+  SENTRY_INVENTORY_MAX_ARTIFACTS,
+  SENTRY_INVENTORY_MAX_BYTES,
+  SENTRY_INVENTORY_PAYLOAD_ID,
+} from '../../src/shared/utils/sentryArtifactInventory.js';
+
+import type { Rollup } from 'vite';
+
+type OutputAsset = Rollup.OutputAsset;
+type OutputBundle = Rollup.OutputBundle;
+type OutputChunk = Rollup.OutputChunk;
+type SourceMap = Rollup.SourceMap;
+
+// Independent literals exercise admission boundaries. The integration suite generates real SDK IDs.
+const ID = '91b28a5c-d347-4c18-9a26-b9cf378e52d1';
+const OTHER_ID = 'dcce018b-46a1-4f04-809c-9edda3b3feb4';
+const identity = {
+  release: 'agent-teams-ai@2.17.1',
+  buildId: 'sandbox-1',
+  gitSha: '1234567890abcdef1234567890abcdef12345678',
+};
+const options: SentryInventoryOptions = {
+  ...identity,
+  target: 'main',
+  covered: true,
+  evidenceDirectory: '/unused-test-directory',
+};
+function fixture(fileName = 'index.cjs', id = ID): OutputBundle {
+  const raw = {
+    version: 3,
+    file: fileName,
+    names: [],
+    sources: ['sandbox-entry.ts'],
+    mappings: 'AAAA',
+    sourcesContent: ['throw new Error("sandbox")'],
+  };
+  const map: SourceMap = { ...raw, toString: () => JSON.stringify(raw), toUrl: () => '' };
+  const chunk: OutputChunk = {
+    type: 'chunk',
+    fileName,
+    name: fileName,
+    code: `globalThis._sentryDebugIdIdentifier="sentry-dbid-${id}";throw new Error("sandbox");`,
+    map,
+    sourcemapFileName: `${fileName}.map`,
+    preliminaryFileName: fileName,
+    isEntry: true,
+    isDynamicEntry: false,
+    isImplicitEntry: false,
+    facadeModuleId: null,
+    moduleIds: [],
+    exports: [],
+    imports: [],
+    dynamicImports: [],
+    implicitlyLoadedBefore: [],
+    importedBindings: {},
+    modules: {},
+    referencedFiles: [],
+  };
+  const asset: OutputAsset = {
+    type: 'asset',
+    fileName: `${fileName}.map`,
+    names: [],
+    originalFileNames: [],
+    source: JSON.stringify(raw),
+    name: undefined,
+    originalFileName: null,
+    needsCodeReference: false,
+  };
+  return { [fileName]: chunk, [`${fileName}.map`]: asset };
+}
+function chunk(bundle: OutputBundle): OutputChunk {
+  return Object.values(bundle).find((row): row is OutputChunk => row.type === 'chunk')!;
+}
+function runtime() {
+  return collectSentryArtifactInventory(fixture(), options).runtime;
+}
+function parse(value: unknown) {
+  return parseSentryArtifactInventory(JSON.stringify(value), identity);
+}
+
+describe('emitted Sentry artifact inventory', () => {
+  it('includes workers and dynamic chunks deterministically; hashes original bytes and keeps roots/content out of runtime', () => {
+    const bundle = { ...fixture('worker.cjs', OTHER_ID), ...fixture('index.cjs') };
+    const first = collectSentryArtifactInventory(bundle, options);
+    const indexChunk = bundle['index.cjs'] as OutputChunk;
+    const second = collectSentryArtifactInventory(
+      Object.fromEntries(Object.entries(bundle).reverse()),
+      options
+    );
+    expect(first).toEqual(second);
+    expect(first.runtime.artifacts.map((row) => row.relativeFile)).toEqual([
+      'dist-electron/main/index.cjs',
+      'dist-electron/main/worker.cjs',
+    ]);
+    expect(first.runtime.coverage).toEqual({
+      main: 'covered',
+      renderer: 'uncovered',
+      preload: 'uncovered',
+    });
+    expect(first.artifacts[0]?.source).toEqual({
+      sha256: createHash('sha256').update(indexChunk.code).digest('hex'),
+      bytes: Buffer.byteLength(indexChunk.code),
+    });
+    const original = bundle['index.cjs.map'] as OutputAsset;
+    expect(first.artifacts[0]?.originalMap).toEqual({
+      relativeFile: 'dist-electron/main/index.cjs.map',
+      sha256: createHash('sha256').update(original.source).digest('hex'),
+      bytes: Buffer.byteLength(original.source),
+    });
+    expect(first.mapStage).toBe('original-before-sentry-upload-preparation');
+    expect(first.uploadVerified).toBe(false);
+    expect(JSON.stringify(first.runtime)).not.toContain('sandbox-entry.ts');
+    expect(JSON.stringify(first.runtime)).not.toContain('/unused-test-directory');
+    expect(Object.isFrozen(first.runtime.artifacts[0])).toBe(true);
+  });
+  it('permits one debug ID at distinct locators and rejects conflicting/duplicate markers', () => {
+    expect(
+      collectSentryArtifactInventory({ ...fixture(), ...fixture('worker.cjs') }, options).runtime
+        .artifacts
+    ).toHaveLength(2);
+    for (const suffix of [
+      `;"sentry-dbid-${OTHER_ID}"`,
+      `;"sentry-dbid-${ID}"`,
+      ';"sentry-dbid-invalid"',
+    ]) {
+      const bundle = fixture();
+      chunk(bundle).code += suffix;
```

**File**: `tsconfig.release-tooling.json` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@
   },
   "include": [
     "scripts/ci/release/**/*.ts",
+    "scripts/build/**/*.ts",
+    "test/scripts/sentryArtifactInventory*.ts",
     "scripts/ci/*existing-draft.ts",
     "scripts/ci/verify-updater-release.ts",
     "test/scripts/partialReleaseStaging.test.ts"
```

---

### Incident Patch 6: `f895fc77` (2026-10-05)
**Commit Message**: fix(landing): show platform-specific release versions

Download versions and links follow each platform payload, preserving signed macOS 2.17.1 when Linux and Windows advance. Preserve the independently reviewed checkpoint history and release graph ancestry. Validation: exact-head CI 37342561535, 31 focused tests, Nuxt build, lint, source-size guard and four fixture viewports passed. Final staged release UI and native update validation remain pending.

**File**: `landing/components/sections/DownloadSection.vue` (modified, +29/-29)
```diff
@@ -1,15 +1,17 @@
 <script setup lang="ts">
 import { mdiApple, mdiMicrosoftWindows, mdiPenguin, mdiDownload, mdiCheckCircle } from '@mdi/js';
 import robotAvatarSeatedMagenta from '~/assets/images/hero/robots/robot-avatar-seated-magenta-v1.webp';
-import type { DownloadOs, DownloadArch } from '~/data/downloads';
+import type { PresentedDownloadAsset } from '~/composables/useDownloadAssetPresentation';
+
+type DownloadAsset = Pick<PresentedDownloadAsset, 'id' | 'os' | 'arch' | 'fileName'>;
 
 const { content } = useLandingContent();
 const { t, locale } = useI18n();
 const downloadStore = useDownloadStore();
-const { data: releaseData, resolve } = useReleaseDownloads();
+const { data: releaseData, resolve, platformInfo } = useReleaseDownloads();
 const { trackDownloadClick } = useAnalytics();
 const { releaseDownloadUrl } = useGithubRepo();
-const { getDownloadArch, requiresArchitectureSelection, visibleDownloadAssets: visibleAssets } = useDownloadAssetPresentation();
+const { getDownloadArch, requiresArchitectureSelection, selectedDownloadAsset, visibleDownloadAssets: visibleAssets } = useDownloadAssetPresentation();
 const isMounted = ref(false);
 const showLinuxRobotMessage = ref(false);
 const showFallingLinuxRobot = ref(false);
@@ -157,12 +159,7 @@ function updateLinuxRobotFall() {
     return;
   }
 
-  if (currentScrollY < startScroll) {
-    resetLinuxRobotFall({ keepSourceHidden: hasLinuxRobotDeparted.value });
-    return;
-  }
-
-  if (scrollingUp) {
+  if (currentScrollY < startScroll || scrollingUp) {
     resetLinuxRobotFall({ keepSourceHidden: hasLinuxRobotDeparted.value });
     return;
   }
@@ -224,35 +221,36 @@ onUnmounted(() => {
   window.visualViewport?.removeEventListener('resize', scheduleLinuxRobotFallUpdate);
 });
 
-const platformIcons: Record<string, string> = {
-  macos: mdiApple,
-  windows: mdiMicrosoftWindows,
-  linux: mdiPenguin,
-};
-
-const platformColors: Record<string, string> = {
-  macos: '#00f0ff',
-  windows: '#39ff14',
-  linux: '#ffd700',
+const platformPresentation: Record<string, { icon: string; color: string }> = {
+  macos: { icon: mdiApple, color: '#00f0ff' },
+  windows: { icon: mdiMicrosoftWindows, color: '#39ff14' },
+  linux: { icon: mdiPenguin, color: '#ffd700' },
 };
 
-const getDownloadUrl = (asset: { os: DownloadOs; arch: DownloadArch; fileName: string }) => {
+const getDownloadUrl = (asset: DownloadAsset) => {
   if (!isMounted.value) return releaseDownloadUrl(asset.fileName);
   const arch = getDownloadArch(asset);
   return resolve(asset.os, arch)?.url || releaseDownloadUrl(asset.fileName);
 };
 
-const handleDownloadClick = (asset: { id: string; os: DownloadOs; arch: DownloadArch; fileName: string }) => {
+const handleDownloadClick = (asset: DownloadAsset) => {
   if (requiresArchitectureSelection(asset)) return;
   trackDownloadClick({ os: asset.os, arch: getDownloadArch(asset),
-    version: releaseVersion.value, source: 'download_section' });
+    version: resolve(asset.os, getDownloadArch(asset))?.version ?? null, source: 'download_section' });
   downloadStore.setSelected(asset.id);
 };
 
-const releaseVersion = computed(() => releaseData.value?.version || null);
+const getDownloadVersion = (asset: Pick<DownloadAsset, 'os' | 'arch'>) =>
+  platformInfo(asset.os, getDownloadArch(asset)).version;
+const selectedRelease = computed(() => {
+  const asset = selectedDownloadAsset.value;
+  return asset ? platformInfo(asset.os, asset.resolvedArch) : releaseData.value;
+});
+const releaseLabel = computed(() => selectedDownloadAsset.value?.label || 'GitHub Release');
+const releaseVersion = computed(() => selectedRelease.value?.version || null);
 const releaseDate = computed(() => {
-  if (!releaseData.value?.pubDate) return '';
-  return new Date(releaseData.value.pubDate).toLocaleDateString(locale.value, {
+  if (!selectedRelease.value?.pubDate) return '';
+  return new Date(selectedRelease.value.pubDate).toLocaleDateString(locale.value, {
     year: 'numeric',
     month: 'short',
     day: 'numeric',
@@ -284,7 +282,7 @@ const linuxRobotBubble = computed(() => t('download.readyToStart'));
           }"
           :style="{
             '--delay': `${index * 0.1}s`,
-            '--accent': platformColors[asset.os] || '#00f0ff',
+            '--accent': platformPresentation[asset.os]?.color || '#00f0ff',
           }"
           :data-download-os="asset.os"
           @click="downloadStore.setSelected(asset.id)"
@@ -321,14 +319,16 @@ const linuxRobotBubble = computed(() => t('download.readyToStart'));
             <v-icon
               size="28"
               class="download-section__card-icon"
-              :icon="platformIcons[asset.os] || mdiDownload"
+              :icon="platformPresentation[asset.os]?.icon || mdiDownload"
             />
           </div>
 
           <!-- Platform info -->
           <div class="download-section__card-info">
             <h3 class="download-section__card-label">{{ asset.label }}</h3>
-            <span clas
```

**File**: `landing/components/sections/HeroSection.vue` (modified, +21/-6)
```diff
@@ -20,16 +20,22 @@ let heroMessageObserver: IntersectionObserver | null = null;
 let heroMotionQuery: MediaQueryList | null = null;
 
 const downloadStore = useDownloadStore();
-const { resolve, data: releaseData } = useReleaseDownloads();
+const { resolve, platformInfo, data: releaseData } = useReleaseDownloads();
+const { trackDownloadClick } = useAnalytics();
 const { latestReleaseUrl, releaseDownloadUrl } = useGithubRepo();
 const { selectedDownloadAsset } = useDownloadAssetPresentation();
 
 useCyberHeroParallax(heroRef);
 
-const releaseVersion = computed(() => releaseData.value?.version || null);
+const selectedRelease = computed(() => {
+  const asset = selectedDownloadAsset.value;
+  return asset ? platformInfo(asset.os, asset.resolvedArch) : releaseData.value;
+});
+const releaseLabel = computed(() => selectedDownloadAsset.value?.label || 'GitHub Release');
+const releaseVersion = computed(() => selectedRelease.value?.version || null);
 const releaseDate = computed(() => {
-  if (!releaseData.value?.pubDate) return "";
-  return new Date(releaseData.value.pubDate).toLocaleDateString(locale.value, {
+  if (!selectedRelease.value?.pubDate) return "";
+  return new Date(selectedRelease.value.pubDate).toLocaleDateString(locale.value, {
     year: "numeric",
     month: "short",
     day: "numeric",
@@ -142,6 +148,13 @@ const heroDownloadTarget = computed(() => (
     : "_blank"
 ));
 
+function handleHeroDownloadClick() {
+  const asset = selectedDownloadAsset.value;
+  if (!asset || ((asset.os === 'windows' || asset.os === 'macos') && asset.resolvedArch === 'unknown')) return;
+  trackDownloadClick({ os: asset.os, arch: asset.resolvedArch,
+    version: resolve(asset.os, asset.resolvedArch)?.version ?? null, source: 'hero' });
+}
+
 const docsHref = computed(() => buildDocsHref({
   locale: locale.value,
   docsSiteUrl: runtimeConfig.public.docsSiteUrl,
@@ -152,7 +165,8 @@ const downloadActionSubtitle = computed(() => {
     return t("hero.platformDefault");
   }
 
-  return selectedDownloadAsset.value.actionSubtitle;
+  const asset = selectedDownloadAsset.value;
+  return asset.os === 'macos' ? `macOS · ${asset.archLabel}` : asset.actionSubtitle;
 });
 const docsActionSubtitle = computed(() => (
   t("hero.guidesSetup")
@@ -302,6 +316,7 @@ onUnmounted(() => {
               tone="primary"
               :icon="mdiDownload"
               :subtitle="downloadActionSubtitle"
+              @click="handleHeroDownloadClick"
             >
               {{ t("hero.downloadNow") }}
             </CyberHeroActionButton>
@@ -320,7 +335,7 @@ onUnmounted(() => {
             class="cyber-hero__terminal-note cyber-panel"
           >
             <span class="cyber-hero__release">
-              v{{ releaseVersion }}
+              {{ releaseLabel }} · v{{ releaseVersion }}
               <span v-if="releaseDate" class="cyber-hero__release-date">
                 · {{ releaseDate }}
               </span>
```

**File**: `landing/composables/useReleaseDownloads.ts` (modified, +65/-164)
```diff
@@ -1,174 +1,75 @@
-import type { DownloadArch, DownloadOs } from "~/data/downloads";
+import type { DownloadArch, DownloadOs } from '~/data/downloads';
 import {
-  parseWindowsReleaseVariants,
-  resolveWindowsReleaseDownload,
-  type WindowsReleaseVariants,
-} from "~/utils/windowsReleaseDownloads.mjs";
-
-// --- Типы GitHub API ---
-
-type ReleaseAsset = {
-  name: string;
-  browser_download_url: string;
-  size: number;
-};
-
-type GitHubRelease = {
-  tag_name: string;
-  name: string;
-  body: string;
-  published_at: string;
-  assets: ReleaseAsset[];
-};
-
-// --- Типы нашего API ---
-
-type Variant = { url: string | null; platformKey: string | null; version: string | null };
-
-type DownloadsApiResponse = {
-  ok: boolean;
-  source: "github-releases";
-  fetchedAt: string;
-  version: string | null;
-  notes: string | null;
-  pubDate: string | null;
-  variants: {
-    macos: { arm64: Variant; x64: Variant; universal: Variant };
-    windows: WindowsReleaseVariants;
-    linux: { appimage: Variant; deb: Variant };
-  };
-};
-
-type ResolveResult = { url: string; version: string | null } | null;
-
-// --- Парсинг GitHub Release → наш формат ---
-
-const CACHE_KEY = "cat_releases";
-const CACHE_TTL = 10 * 60 * 1000; // 10 минут
-
-const emptyVariant: Variant = { url: null, platformKey: null, version: null };
-
-function findAsset(assets: ReleaseAsset[], pattern: RegExp): ReleaseAsset | null {
-  return assets.find((a) => pattern.test(a.name)) || null;
-}
-
-function toVariant(asset: ReleaseAsset | null, version: string | null): Variant {
-  if (!asset) return { ...emptyVariant };
-  return { url: asset.browser_download_url, platformKey: asset.name, version };
-}
-
-function parseGitHubRelease(release: GitHubRelease): DownloadsApiResponse {
-  const version = release.tag_name?.replace(/^v/, "") || null;
-  const assets = (release.assets || []).filter(
-    (a) => !a.name.endsWith(".sig") && !a.name.endsWith(".json") && !a.name.endsWith(".tar.gz")
-  );
-
-  return {
-    ok: assets.length > 0,
-    source: "github-releases",
-    fetchedAt: new Date().toISOString(),
-    version,
-    notes: release.body || null,
-    pubDate: release.published_at || null,
-    variants: {
-      macos: {
-        arm64: toVariant(findAsset(assets, /[-_]arm64\.dmg$/i), version),
-        x64: toVariant(findAsset(assets, /[-_]x64\.dmg$/i), version),
-        universal: { ...emptyVariant },
-      },
-      windows: parseWindowsReleaseVariants(assets, version),
-      linux: {
-        appimage: toVariant(findAsset(assets, /\.AppImage$/i), version),
-        deb: toVariant(findAsset(assets, /\.deb$/i), version),
-      },
-    },
-  };
-}
-
-// --- sessionStorage кеш ---
-
-function readCache(): DownloadsApiResponse | null {
-  try {
-    const raw = sessionStorage.getItem(CACHE_KEY);
-    if (!raw) return null;
-    const { ts, data } = JSON.parse(raw);
-    if (Date.now() - ts > CACHE_TTL) return null;
-    return data;
-  } catch {
-    return null;
-  }
-}
-
-function writeCache(data: DownloadsApiResponse): void {
-  try {
-    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
-  } catch {
-    // sessionStorage может быть недоступен (private mode и т.д.)
-  }
-}
-
-// --- Composable ---
+  encodeReleaseCache,
+  manifestAssetApiUrl,
+  parseReleaseDownloads,
+  platformReleaseInfo,
+  readGitHubRelease,
+  readReleaseCache,
+  releaseCacheKey,
+  resolveReleaseDownload,
+  type DownloadsApiResponse,
+} from '~/utils/releaseDownloads';
 
 export const useReleaseDownloads = () => {
   const config = useRuntimeConfig();
-  const githubRepo = (config.public.githubRepo as string) || "777genius/agent-teams-ai";
-
+  const githubRepo = (config.public.githubRepo as string) || '777genius/agent-teams-ai';
+  const cacheKey = releaseCacheKey(githubRepo);
   const fallbackUrl =
-    (config.public.githubReleasesUrl as string) ||
-    `https://github.com/${githubRepo}/releases`;
-
-  // useAsyncData дедуплицирует запросы по ключу — все компоненты шарят один результат
-  const { data, pending, error } = useAsyncData<DownloadsApiResponse>("releases", async () => {
-    const cached = readCache();
-    if (cached) return cached;
-
-    const release = await $fetch<GitHubRelease>(
-      `https://api.github.com/repos/${githubRepo}/releases/latest`,
-      {
-        headers: { Accept: "application/vnd.github+json" },
+    (config.public.githubReleasesUrl as string) || `https://github.com/${githubRepo}/releases`;
+
+  // Repository and schema are part of both keys; all consumers share this request.
+  const { data, pending, error } = useAsyncData<DownloadsApiResponse>(
+    cacheKey,
+    async () => {
+      try {
+        const cached = readReleaseCache(sessionStorage.getItem(cacheKey), githubRepo);
+        if (cached) return cached;
+      } catch {
+        // Storage may be unavailable in private browsing.
       }
-    );
-
-    const parsed = parseGitHubRelease(release);
-    writeCache(parsed)
```

**File**: `landing/utils/releaseDownloads.test.ts` (added, +294/-0)
```diff
@@ -0,0 +1,294 @@
+import { describe, expect, it } from 'vitest';
+import {
+  encodeReleaseCache,
+  manifestAssetApiUrl,
+  parseReleaseDownloads,
+  platformReleaseInfo,
+  readGitHubRelease,
+  readReleaseCache,
+  releaseCacheKey,
+  resolveReleaseDownload,
+  type GitHubRelease,
+} from './releaseDownloads';
+
+const repository = '777genius/agent-teams-ai';
+const now = Date.parse('2026-10-05T12:00:00Z');
+const macDate = '2026-09-20T10:00:00Z';
+const publishedAt = '2026-10-04T11:00:00Z';
+const canonicalNames = [
+  'Agent.Teams.AI.Setup.2.17.2.exe',
+  'Agent.Teams.AI.Setup.2.17.2-arm64.exe',
+  'Agent.Teams.AI-2.17.2.AppImage',
+  'agent-teams-ai_2.17.2_amd64.deb',
+  'agent-teams-ai-2.17.2.x86_64.rpm',
+  'agent-teams-ai-2.17.2.pacman',
+  'Agent.Teams.AI-2.17.1-arm64.dmg',
+  'Agent.Teams.AI-2.17.1-x64.dmg',
+  'Agent.Teams.AI-2.17.1-arm64-mac.zip',
+  'Agent.Teams.AI-2.17.1-x64-mac.zip',
+];
+
+function release(names = canonicalNames, tag = 'v2.17.2'): GitHubRelease {
+  return {
+    tag_name: tag,
+    body: 'Release notes',
+    published_at: publishedAt,
+    assets: names.map((name) => ({
+      name,
+      browser_download_url: `https://github.com/${repository}/releases/download/${tag}/${name}`,
+    })),
+  };
+}
+
+function manifest() {
+  return {
+    schemaVersion: 1,
+    phase: 'assembled',
+    input: {
+      repository,
+      mode: 'carry-mac',
+      target: { tag: 'v2.17.2' },
+      macSource: { release: { tag: 'v2.17.1', createdAt: macDate } },
+    },
+    versions: { windows: '2.17.2', linux: '2.17.2', mac: '2.17.1' },
+  };
+}
+
+describe('release download versions', () => {
+  it('resolves carried Mac payloads and both new Windows architectures independently of asset order', () => {
+    const names = [
+      'Agent.Teams.AI-arm64.dmg',
+      'Agent.Teams.AI-x64.dmg',
+      'Claude.Agent.Teams.UI-2.17.1.dmg',
+      ...canonicalNames.toReversed(),
+    ];
+    const data = parseReleaseDownloads(release(names), repository, manifest(), now);
+    expect(data.manifestValid).toBe(true);
+    expect(data.version).toBe('2.17.2');
+    for (const arch of ['arm64', 'x64'] as const) {
+      expect(resolveReleaseDownload(data, 'macos', arch)).toEqual({
+        url: `https://github.com/${repository}/releases/download/v2.17.2/Agent.Teams.AI-2.17.1-${arch}.dmg`,
+        version: '2.17.1',
+        pubDate: null,
+      });
+      expect(resolveReleaseDownload(data, 'windows', arch)).toEqual({
+        url: `https://github.com/${repository}/releases/download/v2.17.2/Agent.Teams.AI.Setup.2.17.2${arch === 'arm64' ? '-arm64' : ''}.exe`,
+        version: '2.17.2',
+        pubDate: publishedAt,
+      });
+    }
+    expect(resolveReleaseDownload(data, 'linux', 'x64')).toMatchObject({
+      version: '2.17.2',
+      pubDate: publishedAt,
+    });
+    expect(data.variants.linux.deb.version).toBe('2.17.2');
+    expect(platformReleaseInfo(data, 'macos')).toEqual({ version: '2.17.1', pubDate: null });
+    expect(resolveReleaseDownload(data, 'macos', 'unknown')).toBeNull();
+    expect(resolveReleaseDownload(data, 'windows', 'unknown')).toBeNull();
+  });
+
+  it('shows a carried Mac date only when its source has a publication timestamp', () => {
+    const value = manifest();
+    const withPublication = {
+      ...value,
+      input: {
+        ...value.input,
+        macSource: {
+          release: { ...value.input.macSource.release, publishedAt: macDate },
+        },
+      },
+    };
+    const data = parseReleaseDownloads(release(), repository, withPublication, now);
+    expect(data.manifestValid).toBe(true);
+    expect(resolveReleaseDownload(data, 'macos', 'arm64')?.pubDate).toBe(macDate);
+    const invalidPublication = {
+      ...value,
+      input: {
+        ...value.input,
+        macSource: {
+          release: { ...value.input.macSource.release, publishedAt: 'unavailable' },
+        },
+      },
+    };
+    expect(
+      resolveReleaseDownload(
+        parseReleaseDownloads(release(), repository, invalidPublication, now),
+        'macos',
+        'arm64'
+      )?.pubDate
+    ).toBeNull();
+  });
+
+  it.each([
+    null,
+    {},
+    'not JSON',
+    { ...manifest(), phase: 'ready' },
+    { ...manifest(), schemaVersion: 2 },
+    { ...manifest(), versions: { windows: '2.17.2', linux: '2.17.2', mac: '2.17.2' } },
+    { ...manifest(), input: { ...manifest().input, repository: 'someone/else' } },
+    { ...manifest(), input: { ...manifest().input, target: { tag: 'v2.17.3' } } },
+  ])('uses canonical versions when manifest is missing or invalid (%j)', (value) => {
+    const data = parseReleaseDownloads(release(), repository, value, now);
+    expect(data.manifestValid).toBe(false);
+    expect(resolveReleaseDownload(data, 'macos', 'arm64')).toMatchObject({
+      version: '2.17.1',
+      pubDate: null,
+    });
+    expect(resolveReleaseDownload(data, 'windows', 'x64')?.version).toBe('2.17.2');
+  });
+
+  it('rejects a manifest whose claimed pla
```

**File**: `landing/utils/releaseDownloads.ts` (added, +382/-0)
```diff
@@ -0,0 +1,382 @@
+import type { DownloadArch, DownloadOs } from '../data/downloads';
+
+export type ReleaseAsset = { name: string; browser_download_url: string; url?: string };
+export type GitHubRelease = {
+  tag_name: string;
+  body: string | null;
+  published_at: string | null;
+  assets: ReleaseAsset[];
+};
+type Variant = {
+  url: string | null;
+  platformKey: string | null;
+  version: string | null;
+  pubDate: string | null;
+};
+export type DownloadsApiResponse = {
+  ok: boolean;
+  source: 'github-releases';
+  fetchedAt: string;
+  version: string | null;
+  notes: string | null;
+  pubDate: string | null;
+  manifestValid: boolean;
+  variants: {
+    macos: { arm64: Variant; x64: Variant; universal: Variant };
+    windows: { arm64: Variant; x64: Variant };
+    linux: { appimage: Variant; deb: Variant };
+  };
+};
+type Candidate = {
+  asset: ReleaseAsset;
+  os: DownloadOs;
+  slot: string;
+  version: string;
+  rank: number;
+};
+type PlatformManifest = {
+  versions: { windows: string; linux: string; mac: string };
+  macDate: string | null;
+};
+export type ResolvedDownload = { url: string; version: string | null; pubDate: string | null };
+const CACHE_SCHEMA = 2;
+const CACHE_TTL = 10 * 60 * 1000;
+const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
+const emptyVariant = (): Variant => ({
+  url: null,
+  platformKey: null,
+  version: null,
+  pubDate: null,
+});
+
+function record(value: unknown): Record<string, unknown> | null {
+  return typeof value === 'object' && value !== null && !Array.isArray(value)
+    ? (value as Record<string, unknown>)
+    : null;
+}
+
+function date(value: unknown): string | null {
+  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
+}
+
+function version(value: unknown): string | null {
+  return typeof value === 'string' && VERSION.test(value) ? value : null;
+}
+
+export function readGitHubRelease(value: unknown, repository: string): GitHubRelease | null {
+  const release = record(value);
+  if (!release || typeof release.tag_name !== 'string' || !Array.isArray(release.assets))
+    return null;
+  const tagVersion = version(release.tag_name.replace(/^v/, ''));
+  if (!tagVersion || !/^[\w.-]+\/[\w.-]+$/.test(repository)) return null;
+  const prefix = `https://github.com/${repository}/releases/download/${encodeURIComponent(release.tag_name)}/`;
+  const assets: ReleaseAsset[] = [];
+  for (const value of release.assets) {
+    const asset = record(value);
+    if (!asset || typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string')
+      continue;
+    // Only links to this release in the configured repository are usable downloads.
+    if (asset.browser_download_url !== `${prefix}${encodeURIComponent(asset.name)}`) continue;
+    assets.push({
+      name: asset.name,
+      browser_download_url: asset.browser_download_url,
+      ...(typeof asset.url === 'string' ? { url: asset.url } : {}),
+    });
+  }
+  return {
+    tag_name: release.tag_name,
+    body: typeof release.body === 'string' ? release.body : null,
+    published_at: date(release.published_at),
+    assets,
+  };
+}
+
+export function manifestAssetApiUrl(release: GitHubRelease, repository: string): string | null {
+  const assets = release.assets.filter((asset) => asset.name === 'release-platform-manifest.json');
+  const url = assets.length === 1 ? assets[0]?.url : null;
+  const prefix = `https://api.github.com/repos/${repository}/releases/assets/`;
+  return url?.startsWith(prefix) && /^\d+$/.test(url.slice(prefix.length)) ? url : null;
+}
+
+function candidate(asset: ReleaseAsset): Candidate | null {
+  const patterns: { pattern: RegExp; os: DownloadOs; slot: string }[] = [
+    {
+      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)-(.+)-arm64\.dmg$/,
+      os: 'macos',
+      slot: 'arm64',
+    },
+    {
+      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)-(.+)-x64\.dmg$/,
+      os: 'macos',
+      slot: 'x64',
+    },
+    { pattern: /^(Claude\.Agent\.Teams\.UI)-(.+)\.dmg$/, os: 'macos', slot: 'x64' },
+    {
+      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)-(.+)-(?:arm64|x64)-mac\.zip$/,
+      os: 'macos',
+      slot: 'zip',
+    },
+    { pattern: /^(Claude\.Agent\.Teams\.UI)-(.+)-mac\.zip$/, os: 'macos', slot: 'zip' },
+    {
+      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)\.Setup\.(.+)-arm64\.exe$/,
+      os: 'windows',
+      slot: 'arm64',
+    },
+    {
+      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)\.Setup\.(.+)\.exe$/,
+      os: 'windows',
+      slot: 'x64',
+    },
+    {
+      pattern: /^(Agent\.Teams\.AI|Claude\.Agent\.Teams\.UI)-(.+)\.AppImage$/,
+      os: 'linux',
+      slot: 'appimage',
+    },
+    {
+      pattern: /^(agent-teams-ai|claude-agent-teams-ui)_(.+)_amd64\.deb$/,
+      os: 'linux',
+      slot: 'deb',
+    },
+    {
+      pattern: /^(agent-teams-ai|claude-agent-teams-ui)-(.+)\.x86_64\.rpm$/,
+      os: 'linu
```

---

### Incident Patch 7: `0aa8d0a5` (2026-10-05)
**Commit Message**: fix: harden process failures and renderer recovery (#802)

Fix terminal Codex pipe failures, best-effort output EPIPE, startup cancellation and bounded renderer recovery.

Independent gpt-6.1-sol xhigh review accepted on 5e289043ec1105148fa446b4ac7150fed5e8ac24; exact-head code CI passed. GitHub Codex review unavailable due to account review usage limit. Native renderer crash root cause remains unknown.

Related Sentry issues:
https://quant-jump-pro.sentry.io/issues/138326339/
https://quant-jump-pro.sentry.io/issues/138803016/
https://quant-jump-pro.sentry.io/issues/138706541/
https://quant-jump-pro.sentry.io/issues/149939897/
https://quant-jump-pro.sentry.io/issues/150687504/
https://quant-jump-pro.sentry.io/issues/148297000/
https://quant-jump-pro.sentry.io/issues/142409412/

**File**: `src/main/bootstrapStandardOutput.ts` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+import { installStandardOutputGuard } from './utils/standardOutputGuard';
+
+installStandardOutputGuard(process.stdout);
+installStandardOutputGuard(process.stderr);
```

**File**: `src/main/index.ts` (modified, +100/-100)
```diff
@@ -19,12 +19,18 @@ process.env.UV_THREADPOOL_SIZE ??= '16';
 // Keep userData stable before any integration can initialize Electron storage.
 // Sentry must stay near the top to capture early errors after storage migration.
 // eslint-disable-next-line simple-import-sort/imports -- userData migration must run before Sentry initializes Electron storage.
+import './bootstrapStandardOutput';
 import {
   earlyElectronDevPathOverrideResult,
   earlyElectronUserDataMigrationResult,
 } from './bootstrapUserDataMigration';
 import { earlyAnnouncementsProfile } from './bootstrapAnnouncementsProfile';
 import './sentryBootstrap';
+import {
+  assertStartupActive,
+  createStartupStage,
+  StartupCancelledError,
+} from './utils/startupCancellation';
 
 import type {
   AppCloseReadinessResult,
@@ -191,6 +197,7 @@ import { killTrackedCliProcesses } from '@main/utils/childProcess';
 import { buildMergedCliPath } from '@main/utils/cliPathMerge';
 import { extractNotificationContent } from '@main/utils/inboxNotificationContent';
 import { createBudgetNotificationSink } from '@features/token-usage/main';
+import { RendererRecoveryController } from '@main/utils/RendererRecoveryController';
 import { getWindowsElevationStatus } from '@main/utils/windowsElevation';
 import {
   APP_GET_WINDOWS_ELEVATION_STATUS,
@@ -325,7 +332,12 @@ import {
   captureStartupMemorySnapshot,
   formatStartupMemorySnapshot,
 } from './utils/startupTelemetry';
-import { captureMainException, getMainSentryStatus, syncTelemetryFlag } from './sentry';
+import {
+  captureMainException,
+  captureRendererProcessGone,
+  getMainSentryStatus,
+  syncTelemetryFlag,
+} from './sentry';
 import { setCodexRuntimeMainWindow } from './ipc/codexRuntime';
 import {
   ActiveTeamRegistry,
@@ -482,9 +494,11 @@ const suppressedSources = new Set(['user_sent']);
 async function createOpenCodeRuntimeAdapterRegistry(
   reportProgress: (phase: string, message: string) => void = () => undefined
 ): Promise<TeamRuntimeAdapterRegistry> {
-  const binaryPath = await ClaudeBinaryResolver.resolve({
-    onProgress: ({ phase, message }) => reportProgress(`runtime-${phase}`, message),
-  });
+  const binaryPath = await startupStage(() =>
+    ClaudeBinaryResolver.resolve({
+      onProgress: ({ phase, message }) => reportProgress(`runtime-${phase}`, message),
+    })
+  );
   if (!binaryPath) {
     logger.warn('[OpenCode] Runtime adapter bridge disabled: orchestrator CLI binary not resolved');
     reportProgress(
@@ -515,7 +529,9 @@ async function createOpenCodeRuntimeAdapterRegistry(
   // Where the runtime records the agent processes it starts, for the sweeps that
   // may only reap a tree they can prove this app owns - read back under this
   // same scope, however the Claude root moves later.
-  await applyCursorAgentAttributionEnv(bridgeEnv, { appProfileScope: profileScope });
+  await startupStage(() =>
+    applyCursorAgentAttributionEnv(bridgeEnv, { appProfileScope: profileScope })
+  );
   bridgeEnv.CLAUDE_TEAM_APP_PROFILE_SCOPE = profileScope;
   bridgeEnv.CLAUDE_TEAM_APP_INSTANCE_ID = openCodeManagedHostInstanceId;
   mergeOpenCodeLocalMcpChildEnvironment(bridgeEnv, {
@@ -524,7 +540,7 @@ async function createOpenCodeRuntimeAdapterRegistry(
   });
   bridgeEnv.AGENT_TEAMS_MCP_CLAUDE_DIR = getClaudeBasePath();
   const useHttpMcpBridge = isOpenCodeMcpHttpBridgeEnabled(bridgeEnv);
-  if (isShutdownStarted()) throw new Error('Host MCP composition cancelled during shutdown');
+  assertStartupActive(isShutdownStarted);
   revokeMcpAppContext = agentTeamsMcpHttpServer.appContext.bind(bridgeEnv, useHttpMcpBridge);
   const explicitLocalMcpLaunchEnv = snapshotOpenCodeLocalMcpLaunchEnv(bridgeEnv);
   delete bridgeEnv.ELECTRON_RUN_AS_NODE;
@@ -597,14 +613,17 @@ async function createOpenCodeRuntimeAdapterRegistry(
   };
   try {
     reportProgress('runtime-work-sync', 'Preparing runtime work sync hooks...');
-    const turnSettledEnv = await buildMemberWorkSyncRuntimeTurnSettledEnvironment({
-      teamsBasePath: getTeamsBasePath(),
-      provider: 'opencode',
-    });
+    const turnSettledEnv = await startupStage(() =>
+      buildMemberWorkSyncRuntimeTurnSettledEnvironment({
+        teamsBasePath: getTeamsBasePath(),
+        provider: 'opencode',
+      })
+    );
     if (turnSettledEnv) {
       Object.assign(bridgeEnv, turnSettledEnv);
     }
   } catch (error) {
+    assertStartupActive(isShutdownStarted);
     logger.warn(
       `[OpenCode] Runtime adapter bridge turn-settled spool unavailable: ${
         error instanceof Error ? error.message : String(error)
@@ -614,7 +633,10 @@ async function createOpenCodeRuntimeAdapterRegistry(
   if (useHttpMcpBridge) {
     try {
       reportProgress('runtime-mcp-http', 'Starting Agent Teams MCP server...');
-      const mcpHttpServer = await agentTeamsMcpHttpServer.ensureStarted();
+      const mcpHttpServer = await startupStage(
+        () => agentTeamsMcpHttpServer.ensureStarted(),
+        () => agentTeamsMcpHt
```

**File**: `src/main/sentry.ts` (modified, +29/-1)
```diff
@@ -123,7 +123,7 @@ interface SentryMainApi {
   init?: (options: SentryInitOptions) => void;
   captureException?: (
     error: unknown,
-    context?: { tags?: Record<string, string> }
+    context?: { tags?: Record<string, string>; contexts?: Record<string, Record<string, number>> }
   ) => string | undefined;
   setUser?: (user: { id: string } | null) => void;
   setTags?: (tags: Record<string, string>) => void;
@@ -384,6 +384,34 @@ export function captureMainException(error: unknown, operation: string): string
   });
 }
 
+/** Preserve crash evidence without accepting arbitrary renderer or project metadata. */
+export function captureRendererProcessGone(
+  details: { reason: string; exitCode: number },
+  recoveryAttempts: number
+): string | undefined {
+  if (!initialized || !telemetryAllowed || !Sentry?.captureException) return undefined;
+  const reasons = [
+    'clean-exit',
+    'abnormal-exit',
+    'killed',
+    'crashed',
+    'oom',
+    'launch-failed',
+    'integrity-failure',
+    'memory-eviction',
+  ];
+  const reason = reasons.includes(details.reason) ? details.reason : 'unknown';
+  const diagnostics: Record<string, number> = {};
+  if (Number.isSafeInteger(details.exitCode)) diagnostics.exit_code = details.exitCode;
+  if (Number.isInteger(recoveryAttempts) && recoveryAttempts >= 0 && recoveryAttempts <= 2) {
+    diagnostics.recovery_attempts = recoveryAttempts;
+  }
+  return Sentry.captureException(new Error(`Renderer process terminated: ${reason}`), {
+    tags: { 'error.operation': 'renderer_process_gone', 'renderer.reason': reason },
+    contexts: { renderer_crash: diagnostics },
+  });
+}
+
 /**
  * Wrap a synchronous or async function in a Sentry performance span.
  * Returns the function's return value transparently.
```

**File**: `src/main/services/infrastructure/codexAppServer/JsonRpcStdioClient.ts` (modified, +43/-26)
```diff
@@ -131,15 +131,27 @@ export class JsonRpcStdioClient {
 
     let nextRequestId = 1;
     let closed = false;
+    let transportError: Error | null = null;
+    const pendingNotifications = new Set<(error: Error) => void>();
 
     const rejectAll = (error: Error): void => {
       for (const [id, entry] of pending) {
         clearTimeout(entry.timeoutId);
         entry.reject(error);
         pending.delete(id);
       }
+      for (const reject of pendingNotifications) reject(error);
+      pendingNotifications.clear();
     };
 
+    const failTransport = (error: Error): void => {
+      transportError ??= error;
+      rejectAll(transportError);
+    };
+    // A failed write invokes its callback and then emits 'error'. Keep this
+    // listener for the stream's lifetime, including errors arriving after close.
+    child.stdin?.on('error', failTransport);
+
     const handleNotification = (message: JsonRpcNotificationMessage): void => {
       if (typeof message.method !== 'string' || message.method.length === 0) {
         return;
@@ -190,15 +202,11 @@ export class JsonRpcStdioClient {
     });
 
     child.once('error', (error) => {
-      rejectAll(error instanceof Error ? error : new Error(String(error)));
+      failTransport(error);
     });
 
     child.once('exit', (code, signal) => {
-      if (pending.size === 0) {
-        return;
-      }
-
-      rejectAll(
+      failTransport(
         new Error(
           `JSON-RPC process exited unexpectedly (code=${code ?? 'null'} signal=${signal ?? 'null'})`
         )
@@ -263,7 +271,7 @@ export class JsonRpcStdioClient {
       }
       closed = true;
 
-      rejectAll(new Error('JSON-RPC session closed'));
+      failTransport(new Error('JSON-RPC session closed'));
       notificationListeners.clear();
       lineReader.close();
 
@@ -297,12 +305,18 @@ export class JsonRpcStdioClient {
         timeoutMs = requestTimeoutMs
       ): Promise<TResult> =>
         new Promise<TResult>((resolve, reject) => {
+          if (transportError) {
+            reject(transportError);
+            return;
+          }
           if (!child.stdin || child.stdin.destroyed || child.stdin.writableEnded) {
             reject(new Error('JSON-RPC stdin is not available'));
             return;
           }
 
           const id = nextRequestId++;
+          // Serialization can throw without indicating a transport failure.
+          const line = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;
           const timeoutId = setTimeout(() => {
             pending.delete(id);
             reject(new Error(`JSON-RPC request timed out: ${method}`));
@@ -315,33 +329,36 @@ export class JsonRpcStdioClient {
             timeoutId,
           });
 
-          child.stdin.write(
-            `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
-            (error) => {
-              if (!error) {
-                return;
-              }
-
-              clearTimeout(timeoutId);
-              pending.delete(id);
-              reject(error instanceof Error ? error : new Error(String(error)));
-            }
-          );
+          try {
+            child.stdin.write(line, (error) => {
+              if (error) failTransport(error);
+            });
+          } catch (error) {
+            failTransport(error instanceof Error ? error : new Error(String(error)));
+          }
         }),
 
       notify: async (method: string, params?: unknown): Promise<void> => {
+        if (transportError) throw transportError;
         if (!child.stdin || child.stdin.destroyed || child.stdin.writableEnded) {
           throw new Error('JSON-RPC stdin is not available');
         }
 
+        const line = `${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`;
         await new Promise<void>((resolve, reject) => {
-          child.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`, (error) => {
-            if (error) {
-              reject(error instanceof Error ? error : new Error(String(error)));
-              return;
-            }
-            resolve();
-          });
+          pendingNotifications.add(reject);
+          try {
+            child.stdin!.write(line, (error) => {
+              if (error) {
+                failTransport(error);
+                return;
+              }
+              pendingNotifications.delete(reject);
+              resolve();
+            });
+          } catch (error) {
+            failTransport(error instanceof Error ? error : new Error(String(error)));
+          }
         });
       },
 
```

**File**: `src/main/startMemberWorkSyncFeature.ts` (modified, +11/-0)
```diff
@@ -2,6 +2,7 @@ import {
   getMemberWorkSyncAcceptedReport,
   type MemberWorkSyncFeatureFacade,
 } from '@features/member-work-sync/main';
+import { assertStartupActive, StartupCancelledError } from '@main/utils/startupCancellation';
 import { createLogger } from '@shared/utils/logger';
 
 import type { TeamTaskStallObservationPort } from '@main/services/team/stallMonitor/TeamTaskStallNotifier';
@@ -211,16 +212,26 @@ export async function startPreparedMemberWorkSyncFeature(input: {
   prepared: MemberWorkSyncFeatureFacade;
   stallObservation: { attach(feature: MemberWorkSyncFeatureFacade): void };
   onRestoreProgress?: (progress: { current: number; total: number }) => void;
+  isShutdownStarted?: () => boolean;
+  onStarted?: (feature: MemberWorkSyncFeatureFacade) => void;
 }): Promise<MemberWorkSyncFeatureFacade | null> {
+  const isShutdownStarted = input.isShutdownStarted ?? (() => false);
   try {
+    assertStartupActive(isShutdownStarted);
     await input.backup.initialize(input.onRestoreProgress);
+    assertStartupActive(isShutdownStarted);
   } catch (error) {
+    if (isShutdownStarted() || error instanceof StartupCancelledError) {
+      await input.prepared.dispose();
+      throw new StartupCancelledError();
+    }
     startupLogger.warn(`[Init] Team backup initialization failed: ${String(error)}`);
     await input.prepared.dispose();
     return null;
   }
   input.prepared.startBackground();
   input.stallObservation.attach(input.prepared);
+  input.onStarted?.(input.prepared);
   return input.prepared;
 }
 
```

**File**: `src/main/utils/RendererRecoveryController.ts` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+interface RendererRecoveryPorts {
+  canRecover: () => boolean;
+  reload: () => void;
+  onScheduled: (attempt: number, delayMs: number) => void;
+  onLimitReached: () => void;
+  onReloadError: (error: unknown) => void;
+}
+
+const MAX_RECOVERY_ATTEMPTS = 2;
+const STABLE_RENDERER_MS = 60_000;
+
+/** A window owns its retry budget until its renderer stays healthy for a full minute. */
+export class RendererRecoveryController {
+  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
+  private stabilityTimer: ReturnType<typeof setTimeout> | null = null;
+  private attempts = 0;
+  private disposed = false;
+
+  constructor(private readonly ports: RendererRecoveryPorts) {}
+
+  get recoveryAttempts(): number {
+    return this.attempts;
+  }
+
+  loadStarted(): void {
+    this.clearTimers();
+  }
+
+  loadFinished(): void {
+    this.clearTimers();
+    if (!this.canRecover()) return;
+    this.stabilityTimer = setTimeout(() => {
+      this.stabilityTimer = null;
+      if (this.canRecover()) this.attempts = 0;
+    }, STABLE_RENDERER_MS);
+    this.stabilityTimer.unref?.();
+  }
+
+  processGone(): void {
+    if (this.stabilityTimer) {
+      clearTimeout(this.stabilityTimer);
+      this.stabilityTimer = null;
+    }
+    if (!this.canRecover() || this.recoveryTimer) return;
+    if (this.attempts >= MAX_RECOVERY_ATTEMPTS) {
+      this.ports.onLimitReached();
+      return;
+    }
+    const delayMs = ++this.attempts * 1000;
+    this.ports.onScheduled(this.attempts, delayMs);
+    this.recoveryTimer = setTimeout(() => {
+      this.recoveryTimer = null;
+      if (!this.canRecover()) return;
+      try {
+        this.ports.reload();
+      } catch (error) {
+        this.ports.onReloadError(error);
+      }
+    }, delayMs);
+    this.recoveryTimer.unref?.();
+  }
+
+  dispose(): void {
+    this.disposed = true;
+    this.clearTimers();
+  }
+
+  private canRecover(): boolean {
+    return !this.disposed && this.ports.canRecover();
+  }
+
+  private clearTimers(): void {
+    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
+    if (this.stabilityTimer) clearTimeout(this.stabilityTimer);
+    this.recoveryTimer = null;
+    this.stabilityTimer = null;
+  }
+}
```

**File**: `src/main/utils/standardOutputGuard.ts` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+import type { Writable } from 'node:stream';
+
+const installedGuards = new WeakMap<Writable, () => void>();
+type WriteCallback = (error: Error | null | undefined) => void;
+type WriteArguments =
+  | [chunk: unknown, callback?: WriteCallback]
+  | [chunk: unknown, encoding: BufferEncoding, callback?: WriteCallback];
+
+function isBrokenPipe(error: unknown): boolean {
+  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EPIPE';
+}
+
+/** Only best-effort stdout/stderr output can be abandoned when its reader exits. */
+export function installStandardOutputGuard(stream: Writable): () => void {
+  const installed = installedGuards.get(stream);
+  if (installed) return installed;
+  // eslint-disable-next-line @typescript-eslint/unbound-method -- Reflect.apply preserves the write receiver.
+  const originalWrite = stream.write;
+  let broken = false;
+  const onError = (error: Error): void => {
+    if (isBrokenPipe(error)) {
+      broken = true;
+      return;
+    }
+    // Preserve observers (including Sentry) and EventEmitter's unhandled-error contract.
+    if (stream.listenerCount('error') === 1) throw error;
+  };
+  const guardedWrite: Writable['write'] = function (
+    this: Writable,
+    ...args: WriteArguments
+  ): boolean {
+    if (!broken) {
+      try {
+        return Reflect.apply(originalWrite, this, args) as boolean;
+      } catch (error) {
+        if (!isBrokenPipe(error)) throw error;
+        broken = true;
+      }
+    }
+    const callback = typeof args[1] === 'function' ? args[1] : args[2];
+    // Deliberately discarded output is complete; no drain will follow it.
+    if (callback) process.nextTick(callback);
+    return true;
+  };
+  stream.on('error', onError);
+  stream.write = guardedWrite;
+  let disposed = false;
+  const dispose = (): void => {
+    if (disposed) return;
+    disposed = true;
+    if (stream.write === guardedWrite) stream.write = originalWrite;
+    stream.off('error', onError);
+    if (installedGuards.get(stream) === dispose) installedGuards.delete(stream);
+  };
+  installedGuards.set(stream, dispose);
+  return dispose;
+}
```

**File**: `src/main/utils/startupCancellation.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+/** A shutdown interrupting startup is an expected lifecycle outcome. */
+export class StartupCancelledError extends Error {
+  constructor() {
+    super('Application startup cancelled during shutdown');
+    this.name = 'StartupCancelledError';
+  }
+}
+
+export function assertStartupActive(isShutdownStarted: () => boolean): void {
+  if (isShutdownStarted()) throw new StartupCancelledError();
+}
+
+type StartupStage = <T>(
+  stage: () => Promise<T>,
+  disposeCancelledResult?: (result: T) => void | Promise<void>
+) => Promise<T>;
+
+export function createStartupStage(isShutdownStarted: () => boolean): StartupStage {
+  return <T>(
+    stage: () => Promise<T>,
+    disposeCancelledResult?: (result: T) => void | Promise<void>
+  ): Promise<T> => runStartupStage(isShutdownStarted, stage, disposeCancelledResult);
+}
+
+/** Admit a stage only while active and never publish its result after shutdown. */
+export async function runStartupStage<T>(
+  isShutdownStarted: () => boolean,
+  stage: () => Promise<T>,
+  disposeCancelledResult?: (result: T) => void | Promise<void>
+): Promise<T> {
+  assertStartupActive(isShutdownStarted);
+  let result: T;
+  try {
+    result = await stage();
+  } catch (error) {
+    assertStartupActive(isShutdownStarted);
+    throw error;
+  }
+  if (isShutdownStarted()) {
+    await disposeCancelledResult?.(result);
+    throw new StartupCancelledError();
+  }
+  return result;
+}
```

---

### Incident Patch 8: `64ffe40d` (2026-10-05)
**Commit Message**: fix(ci): disable shared cache in Windows input producer

**File**: `.github/workflows/prepare-updater-native-inputs.yml` (modified, +2/-2)
```diff
@@ -36,7 +36,7 @@ jobs:
       - uses: actions/setup-node@v6
         with:
           node-version: '26.10.0'
-          cache: pnpm
+          package-manager-cache: false
       - run: pnpm install --frozen-lockfile --ignore-scripts
       - run: pnpm typecheck
       - run: pnpm lint:ci:files -- scripts/e2e/release-updater/windows-plan-download.mts scripts/e2e/release-updater/windows-plan-inputs.mts scripts/e2e/release-updater/windows-plan-inputs.test.mts scripts/e2e/release-updater/windows-plan-producer.mts scripts/e2e/release-updater/windows-plan-producer.test.mts
@@ -111,7 +111,7 @@ jobs:
       - uses: actions/setup-node@v6
         with:
           node-version: '26.10.0'
-          cache: pnpm
+          package-manager-cache: false
       - run: pnpm install --frozen-lockfile --ignore-scripts
       - name: Require canonical typecheck and typed immutable-input tooling lint
         run: |
```

---

### Incident Patch 9: `acda6e3a` (2026-10-05)
**Commit Message**: fix(release): prepare Linux and Windows 2.17.3 without obsolete Arch dependency

Build an append-only Linux and Windows draft from the exact application commit, without macOS signing or publication. Remove only the obsolete Arch http-parser dependency and verify actual package metadata and ELF dependencies.

**File**: `.github/workflows/build-linux-windows-draft.yml` (added, +333/-0)
```diff
@@ -0,0 +1,333 @@
+name: Build Linux and Windows Draft
+
+on:
+  workflow_dispatch:
+    inputs:
+      release_tag:
+        description: New Linux/Windows draft tag
+        type: string
+        required: true
+        default: v2.17.3
+      application_sha:
+        description: Reviewed immutable application and workflow commit (40 hex characters)
+        type: string
+        required: true
+
+permissions:
+  contents: read
+  actions: read
+
+concurrency:
+  group: release-${{ inputs.release_tag }}
+  cancel-in-progress: false
+
+env:
+  RELEASE_TAG: ${{ inputs.release_tag }}
+  APPLICATION_SHA: ${{ inputs.application_sha }}
+
+jobs:
+  package:
+    name: ${{ matrix.job_name }}
+    strategy:
+      fail-fast: false
+      matrix:
+        include:
+          - job_name: release-linux x64
+            runner: ubuntu-latest
+            platform: linux
+            arch: x64
+            runtime: linux-x64
+            bundle: linux-unpacked
+            command: pnpm pack:linux
+          - job_name: release-win x64
+            runner: windows-latest
+            platform: win32
+            arch: x64
+            runtime: win32-x64
+            bundle: win-unpacked
+            command: pnpm pack:win:x64
+          - job_name: release-win arm64
+            runner: windows-11-arm
+            platform: win32
+            arch: arm64
+            runtime: win32-arm64
+            bundle: win-arm64-unpacked
+            command: pnpm pack:win:arm64
+    runs-on: ${{ matrix.runner }}
+    timeout-minutes: 90
+    defaults:
+      run:
+        shell: bash
+    steps:
+      - name: Require immutable reviewed workflow and source
+        run: |
+          set -euo pipefail
+          [[ "$APPLICATION_SHA" =~ ^[a-f0-9]{40}$ && "$APPLICATION_SHA" == "$GITHUB_SHA" ]]
+          [[ "$RELEASE_TAG" == 'v2.17.3' ]]
+      - uses: actions/checkout@v6
+        with:
+          ref: ${{ inputs.application_sha }}
+          persist-credentials: false
+      - name: Verify source, version and existing tag
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: |
+          set -euo pipefail
+          [[ "$(git rev-parse HEAD)" == "$APPLICATION_SHA" ]]
+          [[ "$(jq -r .version package.json)" == "${RELEASE_TAG#v}" ]]
+          gh api "repos/$GITHUB_REPOSITORY/git/matching-refs/tags/$RELEASE_TAG" > "$RUNNER_TEMP/tag-refs.json"
+          if jq -e --arg ref "refs/tags/$RELEASE_TAG" 'any(.[]; .ref == $ref)' "$RUNNER_TEMP/tag-refs.json" >/dev/null; then
+            [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/$RELEASE_TAG" --jq .sha)" == "$APPLICATION_SHA" ]]
+          fi
+      - uses: pnpm/action-setup@v6
+      - uses: actions/setup-node@v6
+        with:
+          node-version-file: .node-version
+          cache: pnpm
+      - uses: actions/setup-python@v6
+        with:
+          python-version: '3.11'
+      - name: Install Linux packaging dependencies
+        if: ${{ matrix.platform == 'linux' }}
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y libarchive-tools rpm xvfb binutils
+      - name: Restore pnpm node-gyp executable bit
+        run: |
+          PNPM_STORE="$(pnpm store path)"
+          PNPM_BIN_DIR="$(dirname "$(command -v pnpm)")"
+          for path in "$PNPM_STORE" "${PNPM_HOME:-}" "$PNPM_BIN_DIR"; do
+            if [ -d "$path" ]; then
+              find "$path" -path '*/node-gyp/gyp/gyp_main.py' -exec chmod +x {} \; 2>/dev/null || true
+            fi
+          done
+      - name: Install frozen dependencies
+        run: node ./scripts/ci/install-dependencies-with-retry.mjs
+      - name: Stage bundled runtime
+        env:
+          GH_TOKEN: ${{ secrets.RUNTIME_BUILD_DISPATCH_TOKEN }}
+        run: node ./scripts/stage-runtime.mjs --platform ${{ matrix.runtime }}
+      - name: Stage terminal-platform runtime
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: node ./scripts/stage-terminal-platform-runtime.mjs --platform ${{ matrix.runtime }}
+      - name: Verify Sentry release env
+        env:
+          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
+          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
+          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
+          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
+        run: node ./scripts/ci/verify-sentry-release.cjs prebuild
+      - name: Verify PostHog release env
+        env:
+          POSTHOG_KEY: ${{ secrets.POSTHOG_KEY }}
+          POSTHOG_HOST: https://eu.i.posthog.com
+        run: node ./scripts/ci/verify-posthog-release.cjs prebuild
+      - name: Build app
+        env:
+          NODE_OPTIONS: '--max-old-space-size=8192'
+          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
+          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
+          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
+          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
+          POSTHOG_KEY: ${{ secrets.POSTHOG_KEY }}
+          POSTHOG_HOST: https://eu.i.pos
```

**File**: `package.json` (modified, +16/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "agent-teams-ai",
   "type": "module",
-  "version": "2.1.2",
+  "version": "2.17.3",
   "dynamicFlags": {
     "showSponsorFluxion": true
   },
@@ -422,6 +422,21 @@
       "afterInstall": "resources/afterInstall.sh",
       "fpm": [
         "resources/linux/bin/agent-teams-ai=/usr/bin/agent-teams-ai"
+      ],
+      "depends": [
+        "c-ares",
+        "ffmpeg",
+        "gtk3",
+        "libevent",
+        "libvpx",
+        "libxslt",
+        "libxss",
+        "minizip",
+        "nss",
+        "re2",
+        "snappy",
+        "libnotify",
+        "libappindicator-gtk3"
       ]
     },
     "nsis": {
```

---

### Incident Patch 10: `5ad1500e` (2026-10-05)
**Commit Message**: fix(release): permit isolated Windows producer to read draft assets

**File**: `.github/workflows/prepare-updater-native-inputs.yml` (modified, +23/-5)
```diff
@@ -50,6 +50,7 @@ jobs:
           receipt="$RUNNER_TEMP/TEST-windows-readonly-draft-visibility.json"
           outcome=unavailable
           http_status=0
+          command_exit=0
           actual=null
           if timeout 30s gh api repos/777genius/agent-teams-ai/releases/401358336 --jq '{id,tag_name,draft}' > "$metadata" 2> "$stderr"; then
             http_status=200
@@ -59,12 +60,24 @@ jobs:
             else
               outcome=identity-mismatch
             fi
-          elif [[ "$(cat "$stderr")" == *'(HTTP 404)'* ]]; then
-            http_status=404
-            outcome=not-visible
+          else
+            command_exit=$?
+            if [[ "$(cat "$stderr")" =~ \(HTTP[[:space:]]([1-5][0-9]{2})\) ]]; then
+              http_status="${BASH_REMATCH[1]}"
+            fi
+            case "$http_status" in
+              401) outcome=unauthorized ;;
+              403) outcome=forbidden ;;
+              404) outcome=not-visible ;;
+              429) outcome=rate-limited ;;
+              0)
+                if [[ "$command_exit" == 124 ]]; then outcome=timed-out; else outcome=process-error; fi
+                ;;
+              *) outcome=http-error ;;
+            esac
           fi
-          jq -n --arg outcome "$outcome" --argjson status "$http_status" --argjson actual "$actual" \
-            '{schemaVersion:1,scope:"contents:read",nativeEvidence:false,endpoint:"repos/777genius/agent-teams-ai/releases/401358336",expected:{id:401358336,tag_name:"v2.17.2",draft:true},outcome:$outcome,httpStatus:$status,actual:$actual}' > "$receipt"
+          jq -n --arg outcome "$outcome" --argjson status "$http_status" --argjson commandExit "$command_exit" --argjson actual "$actual" \
+            '{schemaVersion:1,scope:"contents:read",nativeEvidence:false,endpoint:"repos/777genius/agent-teams-ai/releases/401358336",expected:{id:401358336,tag_name:"v2.17.2",draft:true},outcome:$outcome,httpStatus:$status,commandExit:$commandExit,actual:$actual}' > "$receipt"
           jq -r '"Read-only draft visibility: \(.outcome), HTTP \(.httpStatus), nativeEvidence=false"' "$receipt"
       - name: Preserve the filtered read-only permission diagnostic
         if: always()
@@ -79,6 +92,11 @@ jobs:
     if: github.repository == '777genius/agent-teams-ai' && github.event_name == 'workflow_dispatch'
     runs-on: ubuntu-24.04
     timeout-minutes: 25
+    # GitHub exposes drafts only with repository push access. This trusted
+    # dispatch downloads bytes; it performs no release mutations.
+    permissions:
+      contents: write
+      actions: read
     steps:
       - name: Require the reviewed immutable producer tooling SHA
         env:
```

---

### Incident Patch 11: `d7aa8b97` (2026-10-05)
**Commit Message**: fix(release): retry GitHub rate limit responses during verification

**File**: `scripts/ci/release/cli.ts` (modified, +3/-1)
```diff
@@ -93,7 +93,9 @@ export function releaseMain(operation: 'prepare' | 'stage-draft' | 'verify'): vo
     process.stderr.write(`${details}\n`);
     const transient =
       error instanceof ReleaseHttpError && error.httpStatus !== null
-        ? error.httpStatus === 408 || (error.httpStatus >= 500 && error.httpStatus <= 599)
+        ? error.httpStatus === 408 ||
+          error.httpStatus === 429 ||
+          (error.httpStatus >= 500 && error.httpStatus <= 599)
         : /HTTP 5\d\d|ECONN|ETIMEDOUT|fetch failed|timed out/i.test(details);
     process.exitCode = transient ? 75 : 1;
   });
```

**File**: `test/scripts/partialReleaseStaging.test.ts` (modified, +13/-2)
```diff
@@ -765,14 +765,20 @@ describe.skipIf(process.platform === 'win32')('authenticated draft release trans
   });
 
   it.each([401, 403, 429, 500])(
-    'propagates HTTP %s without treating auth/rate/transport failure as draft absence',
+    'propagates HTTP %s without draft discovery and classifies its actual CLI failure',
     async (status) => {
       const draft = await new TestReleaseStorage().release(repository, 'v2.17.2');
       await releaseTransport(
         { tagStatus: status, listed: [[draft]], byId: draft, assetPages: [draft.assets] },
         async (port, calls) => {
           await expect(port.release(repository, 'v2.17.2')).rejects.toThrow(`HTTP ${status}`);
           expect(await calls()).toEqual([`repos/${repository}/releases/tags/v2.17.2`]);
+          await verifyCommandExit(
+            draft.tag_name,
+            status === 429 || status >= 500 ? 75 : 1,
+            new RegExp(`HTTP ${status}`)
+          );
+          expect(await calls()).toEqual(Array(2).fill(`repos/${repository}/releases/tags/v2.17.2`));
         }
       );
     }
@@ -925,7 +931,12 @@ describe.skipIf(process.platform === 'win32')(
             () =>
               verifyCommandExit(
                 target.tag_name,
-                status >= 500 || status === 408 || (kind === 'release' && status === 404) ? 75 : 1
+                status >= 500 ||
+                  status === 408 ||
+                  status === 429 ||
+                  (kind === 'release' && status === 404)
+                  ? 75
+                  : 1
               )
           );
           const port = new GitHubReleasePort();
```

---

### Incident Patch 12: `6a14ed19` (2026-10-05)
**Commit Message**: fix(release): bound public checks and retry verified propagation delays

**File**: `scripts/ci/release/cli.ts` (modified, +3/-5)
```diff
@@ -92,11 +92,9 @@ export function releaseMain(operation: 'prepare' | 'stage-draft' | 'verify'): vo
     const details = error instanceof Error ? (error.stack ?? error.message) : String(error);
     process.stderr.write(`${details}\n`);
     const transient =
-      (error instanceof ReleaseHttpError &&
-        error.httpStatus !== null &&
-        error.httpStatus >= 500 &&
-        error.httpStatus <= 599) ||
-      /HTTP 5\d\d|ECONN|ETIMEDOUT|fetch failed|timed out/i.test(details);
+      error instanceof ReleaseHttpError && error.httpStatus !== null
+        ? error.httpStatus === 408 || (error.httpStatus >= 500 && error.httpStatus <= 599)
+        : /HTTP 5\d\d|ECONN|ETIMEDOUT|fetch failed|timed out/i.test(details);
     process.exitCode = transient ? 75 : 1;
   });
 }
```

**File**: `scripts/ci/release/contract.ts` (modified, +11/-2)
```diff
@@ -121,13 +121,22 @@ export interface ReleasePort {
   verifyNative(reference: NativeEvidenceReference): Promise<NativeProbeArtifact>;
   publicAsset(repository: string, tag: string, name: string): Promise<void>;
   publicLatestAsset(repository: string, name: string): Promise<void>;
-  publicRelease(repository: string, tag: string): Promise<void>;
-  publicLatest(repository: string, tag: string): Promise<void>;
+  publicRelease(repository: string, tag: string, expectedTarget?: boolean): Promise<void>;
+  publicLatest(repository: string, tag: string, previous?: StageInput['latest']): Promise<void>;
 }
 
 export function requireThat(condition: unknown, message: string): asserts condition {
   if (!condition) throw new Error(message);
 }
+export function isPreviousRelease(release: Release, previous?: StageInput['latest']): boolean {
+  if (!previous) return false;
+  return (
+    release.id === previous.id &&
+    release.tag_name === previous.tag &&
+    release.draft === false &&
+    release.prerelease === false
+  );
+}
 export function basename(name: unknown): asserts name is string {
   requireThat(
     typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name),
```

**File**: `scripts/ci/release/github.ts` (modified, +50/-23)
```diff
@@ -5,7 +5,7 @@ import { tmpdir } from 'node:os';
 import path from 'node:path';
 import { pipeline } from 'node:stream/promises';
 
-import { digest, requireThat } from './contract.js';
+import { digest, isPreviousRelease, requireThat } from './contract.js';
 import type {
   Asset,
   BuildProof,
@@ -14,6 +14,7 @@ import type {
   NativeProbeArtifact,
   Release,
   ReleasePort,
+  StageInput,
 } from './contract.js';
 
 export class ReleaseHttpError extends Error {
@@ -84,14 +85,29 @@ async function command(
 async function api<T>(endpoint: string): Promise<T> {
   return JSON.parse(await command(['api', endpoint])) as T;
 }
-async function anonymous(url: string, options?: RequestInit): Promise<Response> {
-  const response = await fetch(url, options);
-  if (!response.ok)
-    throw new ReleaseHttpError(
-      `Anonymous request unavailable: ${url} (HTTP ${response.status})`,
-      response.status
-    );
-  return response;
+async function anonymous(url: string, options?: RequestInit): Promise<Release | undefined> {
+  const signal = AbortSignal.timeout(30_000);
+  try {
+    const response = await fetch(url, { ...options, signal });
+    if (!response.ok)
+      throw new ReleaseHttpError(
+        `Anonymous request unavailable: ${url} (HTTP ${response.status})`,
+        response.status
+      );
+    // Keep GET body consumption inside the deadline: headers alone do not prove
+    // that GitHub completed the response. HEAD proofs do not consume a body.
+    return options?.method === 'HEAD' ? undefined : ((await response.json()) as Release);
+  } catch (error) {
+    if (
+      signal.aborted &&
+      signal.reason instanceof Error &&
+      signal.reason.name === 'TimeoutError' &&
+      error instanceof Error &&
+      (error.name === 'TimeoutError' || error.name === 'AbortError')
+    )
+      throw new ReleaseHttpError(`Anonymous request timed out: ${url}`, 408);
+    throw error;
+  }
 }
 export interface NativeProducerMetadata {
   run: { head_sha: string; run_attempt: number; status: string; path: string };
@@ -359,26 +375,37 @@ export class GitHubReleasePort implements ReleasePort {
       redirect: 'follow',
     });
   }
-  async publicRelease(repository: string, tag: string): Promise<void> {
-    const response = await anonymous(
-      `https://api.github.com/repos/${repository}/releases/tags/${tag}`,
-      { headers: { Accept: 'application/vnd.github+json' } }
-    );
-    const release = (await response.json()) as Release;
+  async publicRelease(repository: string, tag: string, expectedTarget = false): Promise<void> {
+    let release: Release | undefined;
+    try {
+      release = await anonymous(`https://api.github.com/repos/${repository}/releases/tags/${tag}`, {
+        headers: { Accept: 'application/vnd.github+json' },
+      });
+    } catch (error) {
+      if (expectedTarget && error instanceof ReleaseHttpError && error.httpStatus === 404)
+        throw new ReleaseHttpError(
+          `Expected published target is not anonymously visible: ${tag}`,
+          408
+        );
+      throw error;
+    }
     requireThat(
-      !release.draft && !release.prerelease && release.tag_name === tag,
+      release && !release.draft && !release.prerelease && release.tag_name === tag,
       'Anonymous release visibility mismatch'
     );
   }
-  async publicLatest(repository: string, tag: string): Promise<void> {
-    const response = await anonymous(`https://api.github.com/repos/${repository}/releases/latest`, {
+  async publicLatest(
+    repository: string,
+    tag: string,
+    previous?: StageInput['latest']
+  ): Promise<void> {
+    const release = await anonymous(`https://api.github.com/repos/${repository}/releases/latest`, {
       headers: { Accept: 'application/vnd.github+json' },
     });
-    const release = (await response.json()) as Release;
-    requireThat(
-      !release.draft && !release.prerelease && release.tag_name === tag,
-      'Anonymous latest tag mismatch'
-    );
+    if (release && !release.draft && !release.prerelease && release.tag_name === tag) return;
+    if (release && isPreviousRelease(release, previous))
+      throw new ReleaseHttpError('Anonymous latest still exposes the frozen previous release', 408);
+    throw new Error('Anonymous latest tag mismatch');
   }
   async verifyNative(ref: NativeEvidenceReference): Promise<NativeProbeArtifact> {
     requireThat(
```

**File**: `scripts/ci/release/validation.ts` (modified, +30/-19)
```diff
@@ -14,6 +14,7 @@ import {
   checkRelease,
   digest,
   fileProof,
+  isPreviousRelease,
   manifestFor,
   older,
   platformNames,
@@ -32,6 +33,7 @@ import type {
   ReleasePort,
   StagePlan,
 } from './contract.js';
+import { ReleaseHttpError } from './github.js';
 
 async function downloadedProof(
   port: ReleasePort,
@@ -196,35 +198,43 @@ export async function verifyPublished(
     audited.set(name, result.proof);
     return result;
   };
-  const finish = async () => {
-    const final = await port.release(repository, tag);
+  const finish = async (plan?: StagePlan) => {
+    const previous = plan?.input.latest;
+    const checkLatest = async () => {
+      const latest = await port.latest(repository);
+      const current =
+        latest.id === target.id && latest.tag_name === tag && !latest.draft && !latest.prerelease;
+      if (!current && isPreviousRelease(latest, previous))
+        throw new ReleaseHttpError('GitHub latest still exposes the frozen previous release', 408);
+      requireThat(current, 'Published release is not GitHub latest');
+    };
+    await checkLatest();
+    await port.publicRelease(repository, tag, true);
+    await port.publicLatest(repository, tag, previous);
+    for (const name of ['latest.yml', 'latest-linux.yml', 'latest-mac.yml']) {
+      await port.publicAsset(repository, tag, name);
+      await port.publicLatestAsset(repository, name);
+    }
+    // Public requests can take time; retain the final snapshot check after them,
+    // including plan aliases whose source bytes were proven independently.
+    const final = plan
+      ? await validateOrigins(port, plan, false)
+      : await port.release(repository, tag);
     checkRelease(final, releaseSnapshot(target, applicationSha), false);
     requireThat(
       (await port.tagSha(repository, tag)) === applicationSha,
       'Published tag changed during audit'
     );
-    for (const proof of audited.values()) checkMetadata(assetByName(final, proof.name), proof);
-    const latest = await port.latest(repository);
-    requireThat(
-      latest.id === target.id && latest.tag_name === tag,
-      'Latest changed during publication audit'
-    );
-    await port.publicLatest(repository, tag);
+    for (const proof of [...audited.values(), ...(plan?.outputs ?? [])])
+      checkMetadata(assetByName(final, proof.name), proof);
+    await checkLatest();
+    await port.publicLatest(repository, tag, previous);
   };
   requireThat(!releaseId || target.id === releaseId, 'Release ID/tag mismatch');
-  const latest = await port.latest(repository);
-  requireThat(
-    latest.id === target.id && latest.tag_name === tag && !latest.draft && !latest.prerelease,
-    'Published release is not GitHub latest'
-  );
-  await port.publicRelease(repository, tag);
-  await port.publicLatest(repository, tag);
   const found = target.assets.some((a) => a.name === MANIFEST);
   const feeds: Record<string, string> = {};
   for (const name of ['latest.yml', 'latest-linux.yml', 'latest-mac.yml']) {
     feeds[name] = (await audit(name)).raw.toString();
-    await port.publicAsset(repository, tag, name);
-    await port.publicLatestAsset(repository, name);
   }
   if (!found) {
     const productMinimum = older(tag, 'v2.17.2')
@@ -281,6 +291,7 @@ export async function verifyPublished(
   // Changes during the audit invalidate the evidence; never silently accept a mixed snapshot.
   const final = await validateOrigins(port, plan, false);
   for (const proof of manifest.outputs) checkMetadata(assetByName(final, proof.name), proof);
-  await finish();
+  // Only a fully audited manifest can authorize retry for its frozen predecessor.
+  await finish(plan);
   return { mode: manifest.input.mode, tag };
 }
```

**File**: `test/scripts/partialReleaseStaging.test.ts` (modified, +296/-7)
```diff
@@ -35,6 +35,7 @@ import type {
   NativeEvidence,
   NativeEvidenceReference,
   NativeProbeArtifact,
+  PlatformManifest,
   Release,
   ReleasePort,
 } from '../../scripts/ci/release/contract.js';
@@ -325,7 +326,15 @@ describe('append-only partial release assembly', () => {
     const { store, plan } = await prepared();
     await stageDraft(store, plan);
     store.releases.get('v2.17.2')!.draft = false;
-    await expect(verifyPublished(store, repository, 'v2.17.2')).rejects.toThrow(MAC_EVIDENCE);
+    const previousLatest = vi
+      .spyOn(store, 'latest')
+      .mockResolvedValue(await store.release(repository, 'v2.17.1'));
+    try {
+      // A lagging latest must not turn missing native proof into a retryable result.
+      await expect(verifyPublished(store, repository, 'v2.17.2')).rejects.toThrow(MAC_EVIDENCE);
+    } finally {
+      previousLatest.mockRestore();
+    }
     const manifest = manifestFor(plan);
     const evidence: NativeEvidence = {
       schemaVersion: 1,
@@ -612,6 +621,8 @@ interface ReleaseTransportFixture {
   byId: Release;
   assetPages: Asset[][];
   assetBytes?: Map<number, Buffer>;
+  latestResponse?: Release;
+  productMinimum?: string;
 }
 function requirePosixGhFixture(): void {
   if (process.platform === 'win32')
@@ -640,7 +651,10 @@ case "$2" in
       exit 1
     fi ;;
   */commits/*) cat "$fixture_dir/commit.json" ;;
-  */releases/latest) cat "$fixture_dir/id.json" ;;
+  */releases/latest) cat "$fixture_dir/latest.json" ;;
+  */contents/package.json\\?ref=*) cat "$fixture_dir/package.json" ;;
+  */actions/runs/10) cat "$fixture_dir/build-run.json" ;;
+  */actions/runs/10/attempts/1/jobs\\?per_page=100) cat "$fixture_dir/build-jobs.json" ;;
   */releases/assets/*) cat "$fixture_dir/asset-\${2##*/}.bin" ;;
   */releases\\?per_page=100) cat "$fixture_dir/list.json" ;;
   */releases/*/assets\\?per_page=100) cat "$fixture_dir/assets.json" ;;
@@ -659,6 +673,43 @@ esac
   await writeFile(path.join(directory, 'list.json'), JSON.stringify(fixture.listed));
   await writeFile(path.join(directory, 'id.json'), JSON.stringify(fixture.byId));
   await writeFile(path.join(directory, 'assets.json'), JSON.stringify(fixture.assetPages));
+  await writeFile(
+    path.join(directory, 'latest.json'),
+    JSON.stringify(fixture.latestResponse ?? fixture.byId)
+  );
+  await writeFile(
+    path.join(directory, 'package.json'),
+    JSON.stringify({
+      content: Buffer.from(
+        JSON.stringify({
+          build: { mac: { minimumSystemVersion: fixture.productMinimum ?? '13.0' } },
+        })
+      ).toString('base64'),
+    })
+  );
+  await writeFile(
+    path.join(directory, 'build-run.json'),
+    JSON.stringify({
+      head_sha: fixture.byId.target_commitish,
+      run_attempt: 1,
+      path: '.github/workflows/release.yml',
+      event: 'push',
+    })
+  );
+  await writeFile(
+    path.join(directory, 'build-jobs.json'),
+    JSON.stringify([
+      {
+        jobs: [
+          { id: 11, run_id: 10, conclusion: 'success', name: 'release-win x64' },
+          { id: 12, run_id: 10, conclusion: 'success', name: 'release-win arm64' },
+          { id: 13, run_id: 10, conclusion: 'success', name: 'release-linux x64' },
+          { id: 14, run_id: 10, conclusion: 'success', name: 'release-mac x64' },
+          { id: 15, run_id: 10, conclusion: 'success', name: 'release-mac arm64' },
+        ],
+      },
+    ])
+  );
   await writeFile(
     path.join(directory, 'commit.json'),
     JSON.stringify({ sha: fixture.byId.target_commitish })
@@ -762,7 +813,8 @@ async function anonymousHttp(
   status: number,
   test: (
     requests: { path: string; method: string | undefined; authorization?: string }[]
-  ) => Promise<void>
+  ) => Promise<void>,
+  routes: ReadonlyMap<string, { release?: Release; stall?: 'headers' | 'body' }> = new Map()
 ): Promise<void> {
   const requests: { path: string; method: string | undefined; authorization?: string }[] = [];
   const server = createServer((request, response) => {
@@ -772,6 +824,8 @@ async function anonymousHttp(
       method: request.method,
       authorization: request.headers.authorization,
     });
+    const route = routes.get(pathname);
+    if (route?.stall === 'headers') return;
     if (pathname !== failurePath && pathname.includes('/releases/latest/download/')) {
       response.writeHead(302, {
         Location: pathname.replace('/releases/latest/download/', '/releases/download/v2.17.2/'),
@@ -782,7 +836,11 @@ async function anonymousHttp(
     response.writeHead(pathname === failurePath ? status : 200, {
       'Content-Type': 'application/json',
     });
-    response.end(JSON.stringify(release));
+    if (route?.stall === 'body') {
+      response.write('{"id":');
+      return;
+    }
+    response.end(JSON.stringify(route?.release ?? release));
   });
   server.listen(0, '127.0.0.1');
   await once(server, 'listening');
@@ -808,7 +866,7 @@ async function anonymousHttp(
   }
 }
 
-async function veri
```

---

### Incident Patch 13: `692fb610` (2026-10-05)
**Commit Message**: fix(release): prepare Linux and Windows 2.17.3 without obsolete Arch dependency

**File**: `.github/workflows/build-linux-windows-draft.yml` (added, +333/-0)
```diff
@@ -0,0 +1,333 @@
+name: Build Linux and Windows Draft
+
+on:
+  workflow_dispatch:
+    inputs:
+      release_tag:
+        description: New Linux/Windows draft tag
+        type: string
+        required: true
+        default: v2.17.3
+      application_sha:
+        description: Reviewed immutable application and workflow commit (40 hex characters)
+        type: string
+        required: true
+
+permissions:
+  contents: read
+  actions: read
+
+concurrency:
+  group: release-${{ inputs.release_tag }}
+  cancel-in-progress: false
+
+env:
+  RELEASE_TAG: ${{ inputs.release_tag }}
+  APPLICATION_SHA: ${{ inputs.application_sha }}
+
+jobs:
+  package:
+    name: ${{ matrix.job_name }}
+    strategy:
+      fail-fast: false
+      matrix:
+        include:
+          - job_name: release-linux x64
+            runner: ubuntu-latest
+            platform: linux
+            arch: x64
+            runtime: linux-x64
+            bundle: linux-unpacked
+            command: pnpm pack:linux
+          - job_name: release-win x64
+            runner: windows-latest
+            platform: win32
+            arch: x64
+            runtime: win32-x64
+            bundle: win-unpacked
+            command: pnpm pack:win:x64
+          - job_name: release-win arm64
+            runner: windows-11-arm
+            platform: win32
+            arch: arm64
+            runtime: win32-arm64
+            bundle: win-arm64-unpacked
+            command: pnpm pack:win:arm64
+    runs-on: ${{ matrix.runner }}
+    timeout-minutes: 90
+    defaults:
+      run:
+        shell: bash
+    steps:
+      - name: Require immutable reviewed workflow and source
+        run: |
+          set -euo pipefail
+          [[ "$APPLICATION_SHA" =~ ^[a-f0-9]{40}$ && "$APPLICATION_SHA" == "$GITHUB_SHA" ]]
+          [[ "$RELEASE_TAG" == 'v2.17.3' ]]
+      - uses: actions/checkout@v6
+        with:
+          ref: ${{ inputs.application_sha }}
+          persist-credentials: false
+      - name: Verify source, version and existing tag
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: |
+          set -euo pipefail
+          [[ "$(git rev-parse HEAD)" == "$APPLICATION_SHA" ]]
+          [[ "$(jq -r .version package.json)" == "${RELEASE_TAG#v}" ]]
+          gh api "repos/$GITHUB_REPOSITORY/git/matching-refs/tags/$RELEASE_TAG" > "$RUNNER_TEMP/tag-refs.json"
+          if jq -e --arg ref "refs/tags/$RELEASE_TAG" 'any(.[]; .ref == $ref)' "$RUNNER_TEMP/tag-refs.json" >/dev/null; then
+            [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/$RELEASE_TAG" --jq .sha)" == "$APPLICATION_SHA" ]]
+          fi
+      - uses: pnpm/action-setup@v6
+      - uses: actions/setup-node@v6
+        with:
+          node-version-file: .node-version
+          cache: pnpm
+      - uses: actions/setup-python@v6
+        with:
+          python-version: '3.11'
+      - name: Install Linux packaging dependencies
+        if: ${{ matrix.platform == 'linux' }}
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y libarchive-tools rpm xvfb binutils
+      - name: Restore pnpm node-gyp executable bit
+        run: |
+          PNPM_STORE="$(pnpm store path)"
+          PNPM_BIN_DIR="$(dirname "$(command -v pnpm)")"
+          for path in "$PNPM_STORE" "${PNPM_HOME:-}" "$PNPM_BIN_DIR"; do
+            if [ -d "$path" ]; then
+              find "$path" -path '*/node-gyp/gyp/gyp_main.py' -exec chmod +x {} \; 2>/dev/null || true
+            fi
+          done
+      - name: Install frozen dependencies
+        run: node ./scripts/ci/install-dependencies-with-retry.mjs
+      - name: Stage bundled runtime
+        env:
+          GH_TOKEN: ${{ secrets.RUNTIME_BUILD_DISPATCH_TOKEN }}
+        run: node ./scripts/stage-runtime.mjs --platform ${{ matrix.runtime }}
+      - name: Stage terminal-platform runtime
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: node ./scripts/stage-terminal-platform-runtime.mjs --platform ${{ matrix.runtime }}
+      - name: Verify Sentry release env
+        env:
+          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
+          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
+          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
+          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
+        run: node ./scripts/ci/verify-sentry-release.cjs prebuild
+      - name: Verify PostHog release env
+        env:
+          POSTHOG_KEY: ${{ secrets.POSTHOG_KEY }}
+          POSTHOG_HOST: https://eu.i.posthog.com
+        run: node ./scripts/ci/verify-posthog-release.cjs prebuild
+      - name: Build app
+        env:
+          NODE_OPTIONS: '--max-old-space-size=8192'
+          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
+          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
+          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
+          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
+          POSTHOG_KEY: ${{ secrets.POSTHOG_KEY }}
+          POSTHOG_HOST: https://eu.i.pos
```

**File**: `package.json` (modified, +16/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "agent-teams-ai",
   "type": "module",
-  "version": "2.1.2",
+  "version": "2.17.3",
   "dynamicFlags": {
     "showSponsorFluxion": true
   },
@@ -422,6 +422,21 @@
       "afterInstall": "resources/afterInstall.sh",
       "fpm": [
         "resources/linux/bin/agent-teams-ai=/usr/bin/agent-teams-ai"
+      ],
+      "depends": [
+        "c-ares",
+        "ffmpeg",
+        "gtk3",
+        "libevent",
+        "libvpx",
+        "libxslt",
+        "libxss",
+        "minizip",
+        "nss",
+        "re2",
+        "snappy",
+        "libnotify",
+        "libappindicator-gtk3"
       ]
     },
     "nsis": {
```

---

### Incident Patch 14: `303f7581` (2026-10-05)
**Commit Message**: fix(release): validate trusted draft build workflow provenance

**File**: `scripts/ci/release/github.ts` (modified, +21/-3)
```diff
@@ -119,6 +119,22 @@ export interface NativeProducerMetadata {
     workflow_run: { id: number; head_sha: string };
   };
 }
+export interface GitHubBuildRun {
+  head_sha: string;
+  run_attempt: number;
+  path: string;
+  event: string;
+}
+function trustedBuildProducer(run: GitHubBuildRun, mode: Mode): boolean {
+  switch (run.path) {
+    case '.github/workflows/release.yml':
+      return run.event === 'push' || run.event === 'workflow_dispatch';
+    case '.github/workflows/build-linux-windows-draft.yml':
+      return mode === 'carry-mac' && run.event === 'workflow_dispatch';
+    default:
+      return false;
+  }
+}
 export function validateNativeProducer(
   ref: NativeEvidenceReference,
   metadata: NativeProducerMetadata
@@ -290,13 +306,15 @@ export class GitHubReleasePort implements ReleasePort {
         new Set(proof.jobIds).size === proof.jobIds.length,
       'Explicit build run/attempt/jobs required'
     );
-    const run = await api<{ head_sha: string; run_attempt: number; event: string }>(
-      `repos/${repository}/actions/runs/${proof.runId}`
-    );
+    const run = await api<GitHubBuildRun>(`repos/${repository}/actions/runs/${proof.runId}`);
     requireThat(
       run.head_sha === sha && run.run_attempt === proof.attempt,
       'Build run application SHA/attempt mismatch'
     );
+    requireThat(
+      trustedBuildProducer(run, mode),
+      'Build producer workflow/event/mode is not trusted'
+    );
     const pages = JSON.parse(
       await command([
         'api',
```

**File**: `test/scripts/partialReleaseStaging.test.ts` (modified, +129/-1)
```diff
@@ -31,14 +31,15 @@ import {
 import type {
   Asset,
   BuildProof,
+  Mode,
   NativeEvidence,
   NativeEvidenceReference,
   NativeProbeArtifact,
   Release,
   ReleasePort,
 } from '../../scripts/ci/release/contract.js';
 import { GitHubReleasePort, validateNativeProducer } from '../../scripts/ci/release/github.js';
-import type { NativeProducerMetadata } from '../../scripts/ci/release/github.js';
+import type { GitHubBuildRun, NativeProducerMetadata } from '../../scripts/ci/release/github.js';
 import { verifyPublished } from '../../scripts/ci/release/validation.js';
 
 const repository = '777genius/agent-teams-ai';
@@ -978,3 +979,130 @@ it('follows the latest download redirect and preserves failure from its destinat
     ]);
   });
 });
+
+async function buildProducerTransport(
+  run: GitHubBuildRun,
+  mode: Mode,
+  test: (verify: () => Promise<void>, calls: () => Promise<string[]>) => Promise<void>
+): Promise<void> {
+  requirePosixGhFixture();
+  const directory = await mkdtemp(path.join(tmpdir(), 'TEST-build-producer-'));
+  directories.push(directory);
+  const jobs = [
+    { id: 11, run_id: 10, conclusion: 'success', name: 'release-win x64' },
+    { id: 12, run_id: 10, conclusion: 'success', name: 'release-win arm64' },
+    { id: 13, run_id: 10, conclusion: 'success', name: 'release-linux x64' },
+  ];
+  if (mode === 'full')
+    jobs.push(
+      { id: 14, run_id: 10, conclusion: 'success', name: 'release-mac x64' },
+      { id: 15, run_id: 10, conclusion: 'success', name: 'release-mac arm64' }
+    );
+  await writeFile(
+    path.join(directory, 'gh'),
+    `#!/bin/sh
+set -eu
+fixture_dir=$(dirname "$0")
+[ "$1" = api ]
+printf '%s\\n' "$2" >> "$fixture_dir/calls.txt"
+case "$2" in
+  */actions/runs/10) cat "$fixture_dir/run.json" ;;
+  */actions/runs/10/attempts/1/jobs\\?per_page=100) cat "$fixture_dir/jobs.json" ;;
+  *) exit 2 ;;
+esac
+`
+  );
+  await chmod(path.join(directory, 'gh'), 0o755);
+  await writeFile(path.join(directory, 'run.json'), JSON.stringify(run));
+  await writeFile(path.join(directory, 'jobs.json'), JSON.stringify([{ jobs }]));
+  const proof: BuildProof = { runId: 10, attempt: 1, jobIds: jobs.map((job) => job.id) };
+  vi.stubEnv('PATH', `${directory}${path.delimiter}${process.env.PATH ?? ''}`);
+  try {
+    await test(
+      () => new GitHubReleasePort().verifyBuild(repository, targetSha, proof, mode),
+      async () => (await readFile(path.join(directory, 'calls.txt'), 'utf8')).trim().split('\n')
+    );
+  } finally {
+    vi.unstubAllEnvs();
+  }
+}
+
+describe.skipIf(process.platform === 'win32')('trusted build workflow producer transport', () => {
+  const releaseWorkflow = '.github/workflows/release.yml';
+  const partialWorkflow = '.github/workflows/build-linux-windows-draft.yml';
+  const run = { head_sha: targetSha, run_attempt: 1 };
+  it.each<{ path: string; event: string; mode: Mode }>([
+    { path: releaseWorkflow, event: 'push', mode: 'carry-mac' },
+    { path: releaseWorkflow, event: 'workflow_dispatch', mode: 'full' },
+    { path: partialWorkflow, event: 'workflow_dispatch', mode: 'carry-mac' },
+  ])(
+    'accepts reviewed $path / $event for $mode with successful exact-attempt jobs',
+    async ({ path: workflow, event, mode }) => {
+      await buildProducerTransport(
+        { ...run, path: workflow, event },
+        mode,
+        async (verify, calls) => {
+          await expect(verify()).resolves.toBeUndefined();
+          expect(await calls()).toEqual([
+            `repos/${repository}/actions/runs/10`,
+            `repos/${repository}/actions/runs/10/attempts/1/jobs?per_page=100`,
+          ]);
+        }
+      );
+    }
+  );
+  it.each<{ failure: string; path: string; event: string; mode: Mode }>([
+    {
+      failure: 'unrelated workflow',
+      path: '.github/workflows/spoof-build.yml',
+      event: 'workflow_dispatch',
+      mode: 'carry-mac',
+    },
+    { failure: 'missing path', path: '', event: 'workflow_dispatch', mode: 'carry-mac' },
+    {
+      failure: 'noncanonical path suffix',
+      path: `${releaseWorkflow}@refs/heads/main`,
+      event: 'workflow_dispatch',
+      mode: 'carry-mac',
+    },
+    {
+      failure: 'pull request release producer',
+      path: releaseWorkflow,
+      event: 'pull_request',
+      mode: 'carry-mac',
+    },
+    {
+      failure: 'nested workflow release producer',
+      path: releaseWorkflow,
+      event: 'workflow_run',
+      mode: 'carry-mac',
+    },
+    { failure: 'push partial producer', path: partialWorkflow, event: 'push', mode: 'carry-mac' },
+    {
+      failure: 'pull request partial producer',
+      path: partialWorkflow,
+      event: 'pull_request',
+      mode: 'carry-mac',
+    },
+    {
+      failure: 'partial producer used for full release',
+      path: partialWorkflow,
+      event: 'workflow_dispatch',
+      mode: 'full',
+    },
+  ])(
+    'rejects $failure before reading/accepting successful similarly named platform jobs',
+    a
```

---

### Incident Patch 15: `151e2ad9` (2026-10-05)
**Commit Message**: fix(release): bind draft uploads and verify public updater transport

**File**: `scripts/ci/release/assembly.ts` (modified, +1/-1)
```diff
@@ -426,7 +426,7 @@ async function reconcileOutput(
     try {
       await port.upload(
         plan.input.repository,
-        plan.input.target.tag,
+        plan.input.target.id,
         path.join(directory, proof.name)
       );
     } catch (error) {
```

**File**: `scripts/ci/release/cli.ts` (modified, +8/-2)
```diff
@@ -2,7 +2,7 @@ import { parseArgs } from 'node:util';
 
 import { loadPlan, prepareDraft, stageDraft, verifyDraftBytes } from './assembly.js';
 import { canonical, digest, requireThat } from './contract.js';
-import { GitHubReleasePort } from './github.js';
+import { GitHubReleasePort, ReleaseHttpError } from './github.js';
 import { verifyPublished } from './validation.js';
 
 export async function runReleaseCommand(
@@ -91,6 +91,12 @@ export function releaseMain(operation: 'prepare' | 'stage-draft' | 'verify'): vo
   runReleaseCommand(operation).catch((error: unknown) => {
     const details = error instanceof Error ? (error.stack ?? error.message) : String(error);
     process.stderr.write(`${details}\n`);
-    process.exitCode = /HTTP 5\d\d|ECONN|ETIMEDOUT|fetch failed|timed out/i.test(details) ? 75 : 1;
+    const transient =
+      (error instanceof ReleaseHttpError &&
+        error.httpStatus !== null &&
+        error.httpStatus >= 500 &&
+        error.httpStatus <= 599) ||
+      /HTTP 5\d\d|ECONN|ETIMEDOUT|fetch failed|timed out/i.test(details);
+    process.exitCode = transient ? 75 : 1;
   });
 }
```

**File**: `scripts/ci/release/contract.ts` (modified, +2/-1)
```diff
@@ -116,10 +116,11 @@ export interface ReleasePort {
   latest(repository: string): Promise<Release>;
   minimum(repository: string, sha: string): Promise<string>;
   download(repository: string, asset: Asset, destination: string): Promise<void>;
-  upload(repository: string, tag: string, file: string): Promise<void>;
+  upload(repository: string, releaseId: number, file: string): Promise<void>;
   verifyBuild(repository: string, sha: string, proof: BuildProof, mode: Mode): Promise<void>;
   verifyNative(reference: NativeEvidenceReference): Promise<NativeProbeArtifact>;
   publicAsset(repository: string, tag: string, name: string): Promise<void>;
+  publicLatestAsset(repository: string, name: string): Promise<void>;
   publicRelease(repository: string, tag: string): Promise<void>;
   publicLatest(repository: string, tag: string): Promise<void>;
 }
```

**File**: `scripts/ci/release/github.ts` (modified, +49/-14)
```diff
@@ -16,17 +16,25 @@ import type {
   ReleasePort,
 } from './contract.js';
 
-class CliError extends Error {
+export class ReleaseHttpError extends Error {
   readonly httpStatus: number | null;
+  constructor(message: string, httpStatus: number | null) {
+    super(message);
+    this.httpStatus = httpStatus;
+  }
+}
+class CliError extends ReleaseHttpError {
   constructor(
     executable: string,
     operation: string | undefined,
     code: number | null,
     stderr: string
   ) {
-    super(`${executable} ${operation} failed (${code}): ${stderr}`);
     const status = /\(HTTP (\d{3})\)/.exec(stderr)?.[1];
-    this.httpStatus = executable === 'gh' && status ? Number(status) : null;
+    super(
+      `${executable} ${operation} failed (${code}): ${stderr}`,
+      executable === 'gh' && status ? Number(status) : null
+    );
   }
 }
 async function executablePath(name: 'gh' | 'unzip'): Promise<string> {
@@ -76,6 +84,15 @@ async function command(
 async function api<T>(endpoint: string): Promise<T> {
   return JSON.parse(await command(['api', endpoint])) as T;
 }
+async function anonymous(url: string, options?: RequestInit): Promise<Response> {
+  const response = await fetch(url, options);
+  if (!response.ok)
+    throw new ReleaseHttpError(
+      `Anonymous request unavailable: ${url} (HTTP ${response.status})`,
+      response.status
+    );
+  return response;
+}
 export interface NativeProducerMetadata {
   run: { head_sha: string; run_attempt: number; status: string; path: string };
   job: {
@@ -245,8 +262,23 @@ export class GitHubReleasePort implements ReleasePort {
       destination
     );
   }
-  async upload(repository: string, tag: string, file: string): Promise<void> {
-    await command(['release', 'upload', tag, file, '--repo', repository]);
+  async upload(repository: string, releaseId: number, file: string): Promise<void> {
+    requireThat(
+      Number.isSafeInteger(releaseId) && releaseId > 0,
+      'Numeric draft release ID required'
+    );
+    await command([
+      'api',
+      `https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=${encodeURIComponent(path.basename(file))}`,
+      '--hostname',
+      'github.com',
+      '--method',
+      'POST',
+      '-H',
+      'Content-Type: application/octet-stream',
+      '--input',
+      file,
+    ]);
   }
   async verifyBuild(repository: string, sha: string, proof: BuildProof, mode: Mode): Promise<void> {
     requireThat(
@@ -298,29 +330,32 @@ export class GitHubReleasePort implements ReleasePort {
       );
   }
   async publicAsset(repository: string, tag: string, name: string): Promise<void> {
-    const response = await fetch(
-      `https://github.com/${repository}/releases/download/${tag}/${name}`,
-      { method: 'HEAD', redirect: 'follow' }
-    );
-    requireThat(response.ok, `Anonymous asset unavailable: ${tag}/${name}`);
+    await anonymous(`https://github.com/${repository}/releases/download/${tag}/${name}`, {
+      method: 'HEAD',
+      redirect: 'follow',
+    });
+  }
+  async publicLatestAsset(repository: string, name: string): Promise<void> {
+    await anonymous(`https://github.com/${repository}/releases/latest/download/${name}`, {
+      method: 'HEAD',
+      redirect: 'follow',
+    });
   }
   async publicRelease(repository: string, tag: string): Promise<void> {
-    const response = await fetch(
+    const response = await anonymous(
       `https://api.github.com/repos/${repository}/releases/tags/${tag}`,
       { headers: { Accept: 'application/vnd.github+json' } }
     );
-    requireThat(response.ok, `Anonymous release unavailable: ${tag}`);
     const release = (await response.json()) as Release;
     requireThat(
       !release.draft && !release.prerelease && release.tag_name === tag,
       'Anonymous release visibility mismatch'
     );
   }
   async publicLatest(repository: string, tag: string): Promise<void> {
-    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
+    const response = await anonymous(`https://api.github.com/repos/${repository}/releases/latest`, {
       headers: { Accept: 'application/vnd.github+json' },
     });
-    requireThat(response.ok, 'Anonymous latest release unavailable');
     const release = (await response.json()) as Release;
     requireThat(
       !release.draft && !release.prerelease && release.tag_name === tag,
```

**File**: `scripts/ci/release/validation.ts` (modified, +1/-0)
```diff
@@ -224,6 +224,7 @@ export async function verifyPublished(
   for (const name of ['latest.yml', 'latest-linux.yml', 'latest-mac.yml']) {
     feeds[name] = (await audit(name)).raw.toString();
     await port.publicAsset(repository, tag, name);
+    await port.publicLatestAsset(repository, name);
   }
   if (!found) {
     const productMinimum = older(tag, 'v2.17.2')
```

**File**: `test/scripts/partialReleaseStaging.test.ts` (modified, +285/-2)
```diff
@@ -1,5 +1,8 @@
+// @vitest-environment node
 import { createHash } from 'node:crypto';
+import { once } from 'node:events';
 import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
+import { createServer } from 'node:http';
 import { tmpdir } from 'node:os';
 import path from 'node:path';
 
@@ -13,6 +16,7 @@ import {
   stageDraft,
   verifyDraftBytes,
 } from '../../scripts/ci/release/assembly.js';
+import { releaseMain } from '../../scripts/ci/release/cli.js';
 import {
   MAC_EVIDENCE,
   MANIFEST,
@@ -58,6 +62,8 @@ class TestReleaseStorage implements ReleasePort {
   failName: string | null = null;
   nativeArtifact: NativeProbeArtifact | null = null;
   targetMinimum = '12.0';
+  missingLatestFeed: string | null = null;
+  beforeUpload: (() => void) | null = null;
   constructor() {
     this.releases.set('v2.17.2', {
       id: 2,
@@ -122,7 +128,16 @@ class TestReleaseStorage implements ReleasePort {
   async download(_repo: string, asset: Asset, destination: string): Promise<void> {
     await writeFile(destination, this.bytes.get(asset.id)!);
   }
-  async upload(_repo: string, tag: string, file: string): Promise<void> {
+  async upload(_repo: string, target: number | string, file: string): Promise<void> {
+    this.beforeUpload?.();
+    // Model both API identities: a tag resolves the current release, whereas an
+    // immutable ID can never select a replacement. This catches the old adapter.
+    const release =
+      typeof target === 'string'
+        ? this.releases.get(target)
+        : [...this.releases.values()].find((r) => r.id === target);
+    if (!release) throw new Error('Upload release ID no longer exists');
+    const tag = release.tag_name;
     const name = path.basename(file);
     this.uploads.push(name);
     if (this.failName === name) throw new Error('Interrupted transport');
@@ -159,6 +174,11 @@ class TestReleaseStorage implements ReleasePort {
     const latest = await this.latest();
     if (tag !== latest.tag_name || latest.draft) throw new Error('Not public latest');
   }
+  async publicLatestAsset(repo: string, name: string): Promise<void> {
+    if (name === this.missingLatestFeed) throw new Error('Latest download unavailable');
+    const latest = await this.latest();
+    await this.publicAsset(repo, latest.tag_name, name);
+  }
 }
 async function prepared(store = new TestReleaseStorage()) {
   const output = await mkdtemp(path.join(tmpdir(), 'TEST-partial-release-'));
@@ -249,6 +269,17 @@ describe('append-only partial release assembly', () => {
     for (const [name, id] of acceptedIds)
       expect(store.releases.get('v2.17.2')!.assets.find((a) => a.name === name)?.id).toBe(id);
   });
+  it('never appends to a replacement release created after the final pre-upload identity read', async () => {
+    const { store, plan } = await prepared();
+    const original = await store.release(repository, 'v2.17.2');
+    store.beforeUpload = () => {
+      store.beforeUpload = null;
+      store.releases.set('v2.17.2', { ...structuredClone(original), id: 999 });
+    };
+    await expect(stageDraft(store, plan)).rejects.toThrow(/identity|snapshot|changed/i);
+    expect(await store.release(repository, 'v2.17.2')).toEqual({ ...original, id: 999 });
+    expect(store.uploads).toEqual([]);
+  });
   it.each([
     'foreign collision',
     'source replacement',
@@ -475,6 +506,19 @@ describe('manifestless new full release macOS minimum', () => {
   );
 });
 
+describe('published latest updater download contract', () => {
+  it.each(['latest.yml', 'latest-linux.yml', 'latest-mac.yml'])(
+    'rejects unavailable latest redirect for %s even when tag assets and latest API are valid',
+    async (feed) => {
+      const store = manifestlessFull('13.0', '22.0.0');
+      store.missingLatestFeed = feed;
+      await expect(verifyPublished(store, repository, 'v2.17.2')).rejects.toThrow(
+        'Latest download unavailable'
+      );
+    }
+  );
+});
+
 function nativeProducer(): { ref: NativeEvidenceReference; metadata: NativeProducerMetadata } {
   return {
     ref: {
@@ -566,11 +610,17 @@ interface ReleaseTransportFixture {
   listed: Release[][];
   byId: Release;
   assetPages: Asset[][];
+  assetBytes?: Map<number, Buffer>;
+}
+function requirePosixGhFixture(): void {
+  if (process.platform === 'win32')
+    throw new Error('POSIX gh fixtures must not resolve real gh.exe on Windows');
 }
 async function releaseTransport(
   fixture: ReleaseTransportFixture,
   test: (port: GitHubReleasePort, calls: () => Promise<string[]>) => Promise<void>
 ): Promise<void> {
+  requirePosixGhFixture();
   const directory = await mkdtemp(path.join(tmpdir(), 'TEST-release-transport-'));
   directories.push(directory);
   // Exercise actual CLI routing, exit/error classification, discovery, ID read
@@ -588,6 +638,9 @@ case "$2" in
       cat "$fixture_dir/error.txt" >&2
       exit 1
     fi ;;
+  */commits/*) cat "$fixture_dir/commit.json" ;;
+  */releases/latest) cat "$
```

#### Recent Merged Pull Requests:
- **PR #815** (2026-10-06): build: inventory final Sentry artifacts before upload (@777genius)
- **PR #813** (2026-10-05): docs(release): document Linux and Windows 2.17.3 draft (@777genius)
- **PR #812** (2026-10-05): fix(renderer): fence session requests by tab lifetime (@777genius)
- **PR #804** (2026-10-05): test(release): verify staged Linux AppImage updates and fresh installs (@777genius)
- **PR #803** (2026-10-05): test(release): bind Windows native inputs to staged draft provenance (@777genius)
- **PR #802** (2026-10-05): fix(electron): prevent pipe crashes and startup shutdown races (@777genius)
- **PR #800** (2026-10-05): fix(release): prepare Linux and Windows 2.17.3 without obsolete Arch dependency (@777genius)
- **PR #798** (2026-10-05): fix(landing): show platform-specific release downloads (@777genius)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
