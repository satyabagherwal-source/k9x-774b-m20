# Forensic Learning Record (Deep Inspection): holaboss-ai/holaOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/holaboss-ai-holaos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/holaboss-ai/holaOS](https://github.com/holaboss-ai/holaOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:13:53.092Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `holaboss-ai/holaOS`
- **Description**: Open-source agentic workspace enterprises can make their own. Connect the systems you already run — 100+ integrations, MCP, chat tools, apps, browser, local files — with shared memory. Any agent (Claude Code, Codex), any model, or BYOK. Set up in clicks, not months. Local-first: your data never leaves your machines.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11443 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/desktop/electron/browser-pane/fingerprint-engine-installer.ts`
```
/**
 * One-click installer for the enterprise fingerprint engine (the runtime plugin
 * model — see `fingerprint-engine-seam.ts`). Downloads or takes a local
 * `fingerprint-ee-*.zip` (self-contained: `dist/` + `node_modules/`), unpacks it
 * into `<userData>/fingerprint-ee/`, strips the macOS quarantine so the native
 * deps load, and resets the seam cache so the feature activates WITHOUT a restart.
 *
 * OSS + macOS-only (the engine is macOS today). The download SOURCE is deliberately
 * a config point: `HOLABOSS_FINGERPRINT_ENGINE_URL` (a direct .zip URL) — wire it to
 * a licensed/gated backend endpoint for real distribution. Install-from-file needs
 * no source at all.
 */
import { app } from "electron";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

import { resetFingerprintEngineCache } from "./fingerprint-engine-seam.js";

const execFileP = promisify(execFile);

export interface InstallProgress {
  phase: "downloading" | "extracting" | "installing" | "done" | "error";
  /** 0–100 during download when the size is known. */
  pct?: number;
  message?: string;
}

export interface InstalledEngineInfo {
  present: boolean;
  version?: string;
  dir: string;
}

/** The plugin dir the seam loads from — keep in sync with the seam's resolver. */
function engineDir(): string {
  const override = process.env.HOLABOSS_FINGERPRINT_ENGINE_PATH?.trim();
  return override || path.join(app.getPath("userData"), "fingerprint-ee");
}

/** Which release asset matches this machine, or null off macOS. */
export function engineArch(): "macos-arm64" | "macos-x64" | null {
  if (process.platform !== "darwin") {
    return null;
  }
  return process.arch === "arm64" ? "macos-arm64" : "macos-x64";
}

/** A configured direct-download URL for the engine bundle, if any. */
export function resolveEngineDownloadUrl(): string | null {
  return process.env.HOLABOSS_FINGERPRINT_ENGINE_URL?.trim() || null;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function installedEngineInfo(): Promise<InstalledEngineInfo> {
  const dir = engineDir();
  try {
    if (!(await exists(path.join(dir, "dist", "index.js")))) {
      return { present: false, dir };
    }
    const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8")) as {
      version?: unknown;
    };
    return {
      present: true,
      version: typeof pkg.version === "string" ? pkg.version : undefined,
      dir,
    };
  } catch {
    return { present: false, dir };
  }
}

/** Install from a local `fingerprint-ee-*.zip` on disk. */
export async function installFromZip(
  zipPath: string,
  onProgress: (p: InstallProgress) => void,
): Promise<InstalledEngineInfo> {
  const dir = engineDir();
  const parent = path.dirname(dir);
  await mkdir(parent, { recursive: true });
  // Work in the SAME filesystem as the target so the final swap is an atomic rename.
  const work = await mkdtemp(path.join(parent, ".fpe-install-"));
  try {
    onProgress({ phase: "extracting", message: "Unpacking…" });
    await execFileP("/usr/bin/unzip", ["-oq", zipPath, "-d", work]);

    // The bundle root is the dir that contains dist/index.js (our zips wrap it in a
    // `fingerprint-ee/` folder; tolerate a flat zip too).
    let src = path.join(work, "fingerprint-ee");
    if (!(await exists(path.join(src, "dist", "index.js")))) {
      src = work;
    }
    if (!(await exists(path.join(src, "dist", "index.js")))) {
      throw new Error("That zip isn't a fingerprint-ee bundle (no dist/index.js).");
    }

    onProgress({ phase: "installing", message: "Installing…" });
    // Downloaded native files (better-sqlite3.node) are quarantined → the forked
    // service refuses to load them. Clear it (best-effort).
    await execFileP("/usr/bin/xattr", ["-dr", "com.apple.quarantine", src]).catch(() => {});

    // Atomic-ish swap: drop any old copy, move the new one into place.
    await rm(dir, { recursive: true, force: true });
    await rename(src, dir);

    // Re-resolve the engine on the next load — no app restart needed.
    resetFingerprintEngineCache();
    onProgress({ phase: "done", message: "Installed." });
    return await installedEngineInfo();
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

/** Download a bundle zip from `url`, then install it. */
export async function installFromUrl(
  url: string,
  onProgress: (p: InstallProgress) => void,
): Promise<InstalledEngineInfo> {
  const parent = path.dirname(engineDir());
  await mkdir(parent, { recursive: true });
  const work = await mkdtemp(path.join(parent, ".fpe-dl-"));
  const zipPath = path.join(work, "engine.zip");
  try {
    onProgress({ phase: "downloading", pct: 0, message: "Downloading…" });
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Download failed (HTTP ${res.status}).`);
    }
    const total = Number(res.headers.get("content-length") ?? 0);
    let got = 0;
    const body = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
    body.on("data", (chunk: Buffer) => {
      got += chunk.length;
      if (total > 0) {
        onProgress({ phase: "downloading", pct: Math.min(100, Math.round((got / total) * 100)) });
      }
    });
    await pipeline(body, createWriteStream(zipPath));
    return await installFromZip(zipPath, onProgress);
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

```

### Core Architecture Module: `apps/desktop/electron/browser-pane/fingerprint-engine-seam.ts`
```
/**
 * Open-core SEAM for the enterprise fingerprint (anti-detect) browser engine.
 *
 * This file is OSS (MIT) and ships in the public core. It defines the interface
 * an engine must satisfy and loads the LICENSED implementation
 * (`@holaboss/fingerprint-ee`, a separate/gitignored package) at RUNTIME. When the
 * package is absent — every plain OSS build — `loadFingerprintEngine()` returns
 * null and callers fall back to the Contact-Sales flow. Nothing here depends on the
 * enterprise package at build time.
 *
 * Two ways the engine attaches (both optional; absent → Contact Sales):
 *   1. BUILD-TIME — the package present in `node_modules` (bare specifier below).
 *   2. RUNTIME PLUGIN — a self-contained prebuilt engine bundle (its `dist/` plus
 *      its `node_modules/`) dropped into `<userData>/fingerprint-ee/` (or the dir
 *      named by `$HOLABOSS_FINGERPRINT_ENGINE_PATH`), loaded by ABSOLUTE PATH. This
 *      lets an already-released OSS app gain the feature with NO rebuild.
 *
 * Build note: the bare specifier is held in a variable so bundlers don't resolve it
 * statically (it's absent in OSS builds); treat `@holaboss/fingerprint-ee` as
 * external/optional.
 */
import { app } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { BrowserContext } from "playwright-core";

import type {
  ProfileFingerprint,
  ProfileProxy,
} from "../../shared/browser-pane-protocol.js";

/** A cookie in the engine-neutral shape (1:1 with Playwright `addCookies`). */
export interface EngineCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  expires?: number;
}

/** One external identity resolved from an import source (e.g. an AdsPower export). */
export interface ImportedProfile {
  name: string;
  group?: string;
  fingerprint: ProfileFingerprint;
  proxy?: ProfileProxy;
  cookies: EngineCookie[];
  startupUrls: string[];
  warnings: string[];
  source: "adspower";
}

export interface EngineBinaryStatus {
  available: boolean;
  version?: string;
  error?: string;
}

/**
 * Host-product branding for the shared browser bundle (dock name + app icon). The
 * OSS core supplies the identity; the engine stamps it onto the Camoufox.app so a
 * launched profile presents as the product, not "Camoufox". (Product owns the
 * brand policy; the engine owns the mechanism.)
 */
export interface BundleBranding {
  name?: string;
  icnsPath?: string;
}

export interface LaunchProfileInput {
  id: string;
  name: string;
  fingerprint: ProfileFingerprint;
  proxy?: ProfileProxy | null;
  headless?: boolean;
  userDataDir?: string;
  branding?: BundleBranding;
}

export interface LaunchedProfileBrowser {
  readonly browserType: "firefox" | "chromium";
  /** The live, in-process persistent context to drive (same playwright-core). */
  readonly context: BrowserContext;
  close(): Promise<void>;
}

/** The contract the enterprise package's `createCamoufoxEngine()` satisfies. */
export interface FingerprintBrowserEngine {
  readonly id: string;
  ensureBinary(): Promise<EngineBinaryStatus>;
  launch(input: LaunchProfileInput): Promise<LaunchedProfileBrowser>;
  importProfiles(fileBytes: Uint8Array): Promise<ImportedProfile[]>;
}

/** Shape of the enterprise package's default entry (a subset we call). */
interface EnterpriseModule {
  createCamoufoxEngine(): FingerprintBrowserEngine;
}

const ENTERPRISE_MODULE_ID = "@holaboss/fingerprint-ee";

// --- Runtime plugin path -----------------------------------------------------
//
// A drop-in engine bundle for an already-released app lives at:
//     <dir>/dist/index.js  +  <dir>/dist/service-client.js
// with the engine's own `node_modules/` beside `dist/` (self-contained, so the
// forked service child — a plain node process — resolves camoufox-js/etc. there).
// `dir` = $HOLABOSS_FINGERPRINT_ENGINE_PATH or `<userData>/fingerprint-ee`.

function pluginEngineDir(): string | null {
  const override = process.env.HOLABOSS_FINGERPRINT_ENGINE_PATH?.trim();
  if (override) {
    return override;
  }
  try {
    return path.join(app.getPath("userData"), "fingerprint-ee");
  } catch {
    return null; // Electron app not ready yet — no userData path
  }
}

/** Absolute path to a built entry in the plugin bundle, if the file exists. */
function pluginEntry(name: "index" | "service-client"): string | null {
  const dir = pluginEngineDir();
  if (!dir) {
    return null;
  }
  const abs = path.join(dir, "dist", `${name}.js`);
  return existsSync(abs) ? abs : null;
}

let cached: FingerprintBrowserEngine | null | undefined;

/**
 * Load the enterprise engine — from `node_modules` (build-time attach) OR a runtime
 * plugin drop-in — else null. Cached (incl. the null, so OSS builds don't retry).
 */
export async function loadFingerprintEngine(): Promise<FingerprintBrowserEngine | null> {
  if (cached !== undefined) {
    return cached;
  }
  cached = null;
  try {
    const mod = (await import(ENTERPRISE_MODULE_ID)) as EnterpriseModule; // build-time attach
    if (typeof mod.createCamoufoxEngine === "function") {
      cached = mod.createCamoufoxEngine();
      return cached;
    }
  } catch {
    // not in node_modules — fall through to the runtime plugin path
  }
  const entry = pluginEntry("index");
  if (entry) {
    try {
      const mod = (await import(pathToFileURL(entry).href)) as EnterpriseModule;
      if (typeof mod.createCamoufoxEngine === "function") {
        cached = mod.createCamoufoxEngine();
      }
    } catch {
      // a bundle is present but failed to load → leave the feature off
    }
  }
  return cached;
}

/** True when a licensed engine is loaded — gate main-process feature paths on this. */
export function isFingerprintEngineAvailable(): boolean {
  return Boolean(cached);
}

/**
 * Cheap synchronous check for the renderer's UI gate: is an engine ATTACHED —
 * already loaded, or a plugin drop-in present on disk? No heavy import. (A build-
 * time attach is surfaced instead by the build-time `FEATURES.fingerprintBrowser`.)
 */
export function isFingerprintEnginePresent(): boolean {
  return Boolean(cached) || pluginEntry("index") !== null;
}

// --- Standalone fingerprint SERVICE client ----------------------------------
//
// The full "fingerprint browser is its own app" surface: the enterprise engine
// runs in its OWN process (crash-isolated, off the Electron main thread) and the
// core drives it entirely over IPC through this client. Mirrors the enterprise
// `FingerprintServiceClient`; structural typing keeps the two sides compatible.

export interface ServicePageInfo {
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface ServiceCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  session: boolean;
  sameSite: string;
  expirationDate: number | null;
}

export interface ServiceKeyboardOpts {
  action: "press" | "insert_text";
  text?: string;
  key?: string;
  clear?: boolean;
  submit?: boolean;
}

export interface FingerprintServiceClient {
  /** `restoredTabs` = how many previous-session tabs the service reopened. */
  launch(input: LaunchProfileInput): Promise<{ ok: boolean; restoredTabs?: number }>;
  close(id: string): Promise<void>;
  running(): Promise<string[]>;
  isLive(id: string): Promise<boolean>;
  importProfiles(bytes: Uint8Array): Promise<ImportedProfile[]>;
  navigate(id: string, url: string, sessionId?: string | null): Promise<void>;
  evaluate(id: string, expression: string, sessionId?: string | null): Promise<unknown>;
  pageInfo(id: string, sessionId?: string | null): Promise<ServicePageInfo>;
  openTab(id: string, url: string, sessionId?: string | null): Promise<ServicePageInfo>;
  screenshot(
    id: string,
    options?: { fullPage?: boolean; format?: "png" | "jpeg"; quality?: number },
    sessionId?: string | null,
  ): Promise<Buffer>;
  mouse(
    id: string,
    x: number,
    y: number,
    action: "click" | "double_click" | "hover" | "context",
    sessionId?: string | null,
  ): Promise<void>;
  keyboard(id: string, opts: ServiceKeyboardOpts, sessionId?: string | null): Promise<void>;
  cookies(
    id: string,
    filter: { url?: string; name?: string; domain?: string },
    sessionId?: string | null,
  ): Promise<ServiceCookie[]>;
  setCookie(id: string, cookie: Record<string, unknown>): Promise<void>;
  addCookies(id: string, cookies: EngineCookie[]): Promise<{ added: number }>;
  onRunningChanged(cb: (ids: string[]) => void): void;
  dispose(): void;
}

interface EnterpriseServiceModule {
  createFingerprintServiceClient(): FingerprintServiceClient;
}

// A subpath into the enterprise package that pulls ONLY the lightweight service
// CLIENT (a `fork()` wrapper — ~2ms to load). We deliberately DON'T import the
// package barrel here: its `createCamoufoxEngine` re-export eagerly evaluates
// camoufox-js + exceljs + playwright (~0.5s) on the MAIN thread, which the main
// process never needs (all that runs in the forked service). Importing the barrel
// on a Launch click is what stalls the UI. Held in a variable so bundlers treat
// the optional package as an external runtime import.
const ENTERPRISE_SERVICE_MODULE_ID = "@holaboss/fingerprint-ee/service-client";

let cachedService: FingerprintServiceClient | null | undefined;

/**
 * Spawn (once) and return the enterprise fingerprint service, or null when the
 * licensed package is absent (OSS builds). Cached — the service process is a
 * singleton for the app's lifetime.
 */
export async function loadFingerprintService(): Promise<FingerprintServiceClient | null> {
  if (cachedService !== undefined) {
    return cachedService;
  }
  cachedService = null;
  try {
    const mod = (await import(ENTERPRISE_SERVICE_MODULE_ID)) as EnterpriseServiceModule; // build-time
   
```

### Core Architecture Module: `apps/desktop/electron/browser-pane/utils.ts`
```
/**
 * Pure utility helpers for the browser-pane subsystem.
 *
 * These functions are leaf-level: no module state, no cross-calls into other
 * browser-pane sub-modules, and no electron APIs that require dynamic
 * dependencies. They are safe to import directly anywhere.
 *
 * Extracted from main.ts as part of BP-P5 to begin separating the browser
 * subsystem's internals from main. See `index.ts` for the broader phasing
 * plan.
 */
import path from "node:path";
import { createHash } from "node:crypto";

import type { ContextMenuParams } from "electron";

import type {
  BrowserSpaceId,
  BrowserStatePayload,
  BrowserTabCountsPayload,
} from "../../shared/browser-pane-protocol.js";

// =============================================================================
// State payload constructors
// =============================================================================

/**
 * Concrete shape returned by `createBrowserState` — tighter than the wire
 * protocol's `BrowserStatePayload` because main.ts requires a non-null
 * `error` string. Compatible-by-assignment with the protocol type.
 */
export interface CreatedBrowserState extends BrowserStatePayload {
  error: string;
}

/**
 * Default human label used by `createBrowserState` when no title is provided.
 * Kept as a parameter so the caller (main.ts) can keep its `NEW_TAB_TITLE`
 * constant authoritative.
 */
export function createBrowserState(
  defaults: { newTabTitle: string },
  overrides?: Partial<BrowserStatePayload>,
): CreatedBrowserState {
  return {
    id: overrides?.id ?? "",
    url: overrides?.url ?? "",
    title: overrides?.title ?? defaults.newTabTitle,
    faviconUrl: overrides?.faviconUrl,
    canGoBack: overrides?.canGoBack ?? false,
    canGoForward: overrides?.canGoForward ?? false,
    loading: overrides?.loading ?? false,
    initialized: overrides?.initialized ?? false,
    error: overrides?.error ?? "",
  };
}

export function emptyBrowserTabCountsPayload(): BrowserTabCountsPayload {
  return {
    agent: 0,
  };
}

// =============================================================================
// BrowserSpaceId helpers
// =============================================================================

/**
 * Coerce an arbitrary string into a `BrowserSpaceId`, falling back to the
 * caller-supplied default for unrecognised values. main.ts threads the
 * currently-active space id as the fallback.
 */
export function browserSpaceId(
  _value: string | null | undefined,
  _fallback: BrowserSpaceId,
): BrowserSpaceId {
  return "agent";
}

// =============================================================================
// Session id normalization
// =============================================================================

/** Trim a possibly-null session id to a string. Empty string for falsy input. */
export function browserSessionId(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

// =============================================================================
// Workspace storage paths + partition naming
// =============================================================================

/**
 * Stable filesystem-friendly segment derived from a workspace id. Uses an
 * sha256 prefix to disambiguate collisions on the sanitised label.
 */
export function sanitizeBrowserWorkspaceSegment(workspaceId: string): string {
  const normalized =
    workspaceId
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "workspace";
  const digest = createHash("sha256")
    .update(workspaceId.trim(), "utf8")
    .digest("hex")
    .slice(0, 12);
  return `${normalized}-${digest}`;
}

/**
 * Resolves the on-disk directory used to persist a workspace's browser
 * state JSON. `userDataDir` is `app.getPath("userData")` from main.
 */
export function browserWorkspaceStorageDir(
  userDataDir: string,
  workspaceId: string,
): string {
  return path.join(
    userDataDir,
    "browser-workspaces",
    sanitizeBrowserWorkspaceSegment(workspaceId),
  );
}

export function browserWorkspaceStatePath(
  userDataDir: string,
  workspaceId: string,
): string {
  return path.join(
    browserWorkspaceStorageDir(userDataDir, workspaceId),
    "browser-state.json",
  );
}

/** Electron `partition:` value for the workspace's `Session` store. */
export function browserWorkspacePartition(workspaceId: string): string {
  return `persist:holaboss-browser-${sanitizeBrowserWorkspaceSegment(workspaceId)}`;
}

// =============================================================================
// Browser profile storage paths + partition naming
// =============================================================================
//
// A "browser profile" is a first-class, user-managed browsing identity with its
// own persistent Electron partition, decoupled from any workspace. Profile ids
// carry the `bprofile_` prefix so the shared browser-workspace lifecycle (see
// main.ts `createBrowserWorkspaceState` / `ensureBrowserWorkspace`) routes a
// profile id to these helpers transparently. The prefix also keeps them
// distinct from the unrelated `profileId`/`profile_id` meanings elsewhere (the
// *source* OS browser profile during import, and the user-identity profile).

/** Prefix that marks a browser-context id as a first-class Browser Profile. */
export const BROWSER_PROFILE_ID_PREFIX = "bprofile_";

/** True when `id` names a Browser Profile (vs. a workspace-scoped browser). */
export function isBrowserProfileId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(BROWSER_PROFILE_ID_PREFIX);
}

/** On-disk directory holding a profile's browser state JSON. */
export function browserProfileStorageDir(
  userDataDir: string,
  profileId: string,
): string {
  return path.join(
    userDataDir,
    "browser-profiles",
    sanitizeBrowserWorkspaceSegment(profileId),
  );
}

export function browserProfileStatePath(
  userDataDir: string,
  profileId: string,
): string {
  return path.join(
    browserProfileStorageDir(userDataDir, profileId),
    "browser-state.json",
  );
}

/** Electron `partition:` value for a profile's persistent `Session` store. */
export function browserProfilePartition(profileId: string): string {
  return `persist:holaboss-profile-${sanitizeBrowserWorkspaceSegment(profileId)}`;
}

// =============================================================================
// Aborted load detection
// =============================================================================

export function isAbortedBrowserLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    errno?: unknown;
    message?: unknown;
  };
  return (
    candidate.code === "ERR_ABORTED" ||
    candidate.errno === -3 ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("ERR_ABORTED"))
  );
}

export function isAbortedBrowserLoadFailure(
  errorCode: number,
  errorDescription: string,
): boolean {
  return (
    errorCode === -3 || errorDescription.trim().toUpperCase() === "ERR_ABORTED"
  );
}

// =============================================================================
// History tracking guard
// =============================================================================

/**
 * Filters non-http(s) URLs out of history persistence. about:, data:,
 * file:, chrome-extension:, etc. should never enter the history list.
 */
export function shouldTrackHistoryUrl(rawUrl: string): boolean {
  if (!rawUrl) {
    return false;
  }
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// =============================================================================
// Popup-window-open helpers
// =============================================================================

/**
 * Reduce a popup-window frame name (`window.open` second arg) to a stable
 * non-empty string, or empty string if it should be treated as anonymous.
 */
export function normalizeBrowserPopupFrameName(
  frameName?: string | null,
): string {
  const normalized = typeof frameName === "string" ? frameName.trim() : "";
  return normalized && normalized !== "_blank" ? normalized : "";
}

/**
 * Heuristic: should a `window.open` call be treated as an OAuth-style popup
 * vs a tab-like new window? A non-empty frame name or any positional /
 * sizing feature flag both flag the request as a popup.
 */
export function isBrowserPopupWindowRequest(
  frameName?: string | null,
  features?: string | null,
): boolean {
  if (normalizeBrowserPopupFrameName(frameName)) {
    return true;
  }
  const normalizedFeatures =
    typeof features === "string" ? features.trim().toLowerCase() : "";
  return (
    normalizedFeatures.includes("popup") ||
    normalizedFeatures.includes("width=") ||
    normalizedFeatures.includes("height=") ||
    normalizedFeatures.includes("left=") ||
    normalizedFeatures.includes("top=")
  );
}

// =============================================================================
// User agent / Accept-Language helpers (workspace browser identity)
// =============================================================================

/**
 * Picks a Chromium-like platform token mirroring the host OS. Used to keep
 * the user-agent string aligned with the user's actual platform when the
 * native `session.getUserAgent()` value is empty.
 */
export function browserChromeLikePlatformToken(
  platform: NodeJS.Platform = process.platform,
): string {
  switch (platform) {
    case "darwin":
      return "Macintosh; Intel Mac OS X 10_15_7";
    case "win32":
      return "Windows NT 10.0; Win64; x64";
    default:
      return "X11; Linux x86_64";
  }
}

/**
 * Constructs an Accept-Language header value derived from the host locale.
 * Falls back to `en-US,en` if the locale is empty.
 */
export 
```

### Core Architecture Module: `apps/desktop/electron/control-plane-owned-state.ts`
```
import Database from "better-sqlite3"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export type WorkspaceLocation = "local" | "cloud"

export interface WorkspaceRegistryRecord {
  id: string
  location: WorkspaceLocation
  name: string
  status: string
  harness: string | null
  error_message: string | null
  onboarding_status: string
  onboarding_session_id: string | null
  onboarding_completed_at: string | null
  onboarding_completion_summary: string | null
  onboarding_requested_at: string | null
  onboarding_requested_by: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at_utc: string | null
  workspace_path?: string | null
  folder_state?: "healthy" | "missing" | null
}

export interface WorkspaceRegistryListResponse {
  items: WorkspaceRegistryRecord[]
  total: number
  limit: number
  offset: number
}

export interface LocalWorkspaceRegistry {
  getWorkspaceRecord(workspaceId: string): WorkspaceRegistryRecord | null
  listCachedWorkspaces(): WorkspaceRegistryListResponse
}

export interface LocalWorkspaceRegistryOptions {
  controlPlaneDatabasePath: () => string
  location: WorkspaceLocation
}

export interface LocalControlPlaneDatabaseBootstrapOptions {
  controlPlaneDatabasePath: () => string
  runtimeDatabasePath: () => string
  workspaceRoot: () => string
}

export type RuntimeUserProfileNameSource = "manual" | "agent" | "authFallback"

export interface RuntimeUserProfileRecord {
  profileId: string
  name: string | null
  timezone: string | null
  nameSource: RuntimeUserProfileNameSource | null
  createdAt: string | null
  updatedAt: string | null
}

export interface RuntimeUserProfileUpdate {
  profileId?: string | null
  name?: string | null
  timezone?: string | null
  nameSource?: RuntimeUserProfileNameSource | null
}

export interface LocalRuntimeUserProfileStore {
  getProfile(): Promise<RuntimeUserProfileRecord>
  setProfile(payload: RuntimeUserProfileUpdate): Promise<RuntimeUserProfileRecord>
  applyAuthFallback(
    name: string,
    profileId?: string,
    timezone?: string | null,
  ): Promise<RuntimeUserProfileRecord>
}

export interface LocalRuntimeUserProfileStoreOptions {
  controlPlaneDatabasePath: () => string
}

export interface LocalIntegrationConnectionRecord {
  connection_id: string
  provider_id: string
  owner_user_id: string
  account_label: string
  account_external_id: string | null
  account_handle: string | null
  account_email: string | null
  context_cron_auto_fetch_enabled: boolean
  auth_mode: string
  granted_scopes: string[]
  status: string
  secret_ref: string | null
  created_at: string
  updated_at: string
}

export interface LocalIntegrationConnectionListResponse {
  connections: LocalIntegrationConnectionRecord[]
}

export interface LocalIntegrationConnectionCreatePayload {
  provider_id: string
  owner_user_id: string
  account_label: string
  auth_mode: string
  granted_scopes: string[]
  secret_ref?: string
  account_external_id?: string | null
  account_handle?: string | null
  account_email?: string | null
  context_cron_auto_fetch_enabled?: boolean
  status?: string
}

export interface LocalIntegrationConnectionUpdatePayload {
  status?: string
  secret_ref?: string | null
  account_label?: string
  granted_scopes?: string[]
  account_handle?: string | null
  account_email?: string | null
  context_cron_auto_fetch_enabled?: boolean
}

export interface LocalIntegrationMergeConnectionsResult {
  kept_connection_id: string
  removed_count: number
  repointed_bindings: number
}

export interface LocalOAuthAppConfigRecord {
  provider_id: string
  client_id: string
  client_secret: string
  authorize_url: string
  token_url: string
  scopes: string[]
  redirect_port: number
  created_at: string
  updated_at: string
}

export interface LocalOAuthAppConfigListResponse {
  configs: LocalOAuthAppConfigRecord[]
}

export interface LocalOAuthAppConfigUpsertPayload {
  client_id: string
  client_secret: string
  authorize_url: string
  token_url: string
  scopes: string[]
  redirect_port?: number
}

export interface LocalConnectionWorkspaceUsage {
  connection_id: string
  workspaces: Array<{
    workspace_id: string
    target_type: string
    target_id: string
    integration_key: string
  }>
}

export interface LocalIntegrationMetadataStore {
  listConnections(params?: {
    providerId?: string
    ownerUserId?: string
  }): Promise<LocalIntegrationConnectionListResponse>
  createConnection(
    payload: LocalIntegrationConnectionCreatePayload,
  ): Promise<LocalIntegrationConnectionRecord>
  updateConnection(
    connectionId: string,
    payload: LocalIntegrationConnectionUpdatePayload,
  ): Promise<LocalIntegrationConnectionRecord>
  deleteConnection(connectionId: string): Promise<{ deleted: boolean }>
  mergeConnections(
    keepConnectionId: string,
    removeConnectionIds: string[],
  ): Promise<LocalIntegrationMergeConnectionsResult>
  listConnectionWorkspaceUsage(): Promise<{
    usage: LocalConnectionWorkspaceUsage[]
  }>
  listOAuthConfigs(): Promise<LocalOAuthAppConfigListResponse>
  upsertOAuthConfig(
    providerId: string,
    payload: LocalOAuthAppConfigUpsertPayload,
  ): Promise<LocalOAuthAppConfigRecord>
  deleteOAuthConfig(providerId: string): Promise<{ deleted: boolean }>
}

export interface LocalIntegrationMetadataStoreOptions {
  controlPlaneDatabasePath: () => string
}

interface LocalIntegrationBindingRecord {
  binding_id: string
  workspace_id: string
  target_type: string
  target_id: string
  integration_key: string
  connection_id: string
  is_default: boolean
  created_at: string
  updated_at: string
}

function utcNowIso(): string {
  return new Date().toISOString()
}

function tableExists(database: Database.Database, tableName: string): boolean {
  const row = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    )
    .get(tableName)
  return Boolean(row)
}

function ensureControlPlaneDatabaseSchema(database: Database.Database): void {
  database.exec(`
    -- workspace-removal Piece 5.11: the desktop no longer creates the
    -- workspaces table. The runtime is single-tenant (synthetic root) and
    -- former workspaces are projects. A pre-existing table is folded into
    -- projects and dropped by the runtime; the desktop's remaining reads are
    -- table-exists guarded (getWorkspaceRecord / listCachedWorkspaces).
    CREATE TABLE IF NOT EXISTS runtime_user_profiles (
      profile_id TEXT PRIMARY KEY,
      name TEXT,
      timezone TEXT,
      name_source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integration_connections (
      connection_id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      account_label TEXT NOT NULL,
      account_external_id TEXT,
      account_handle TEXT,
      account_email TEXT,
      context_cron_auto_fetch_enabled INTEGER NOT NULL DEFAULT 1,
      auth_mode TEXT NOT NULL,
      granted_scopes TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      secret_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_integration_connections_provider_owner_updated
      ON integration_connections (provider_id, owner_user_id, updated_at DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS integration_bindings (
      binding_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      integration_key TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (workspace_id, target_type, target_id, integration_key),
      FOREIGN KEY (connection_id) REFERENCES integration_connections(connection_id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_integration_bindings_workspace_updated
      ON integration_bindings (workspace_id, is_default DESC, updated_at DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS oauth_app_configs (
      provider_id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      authorize_url TEXT NOT NULL,
      token_url TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '[]',
      redirect_port INTEGER NOT NULL DEFAULT 38765,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  const runtimeUserProfileColumns = new Set(
    (database
      .prepare("PRAGMA table_info(runtime_user_profiles)")
      .all() as Array<{ name: string }>)
      .map((row) => row.name),
  )
  if (!runtimeUserProfileColumns.has("timezone")) {
    database.exec("ALTER TABLE runtime_user_profiles ADD COLUMN timezone TEXT")
  }

  const integrationConnectionColumns = new Set(
    (database
      .prepare("PRAGMA table_info(integration_connections)")
      .all() as Array<{ name: string }>)
      .map((row) => row.name),
  )
  if (!integrationConnectionColumns.has("context_cron_auto_fetch_enabled")) {
    database.exec(
      "ALTER TABLE integration_connections ADD COLUMN context_cron_auto_fetch_enabled INTEGER NOT NULL DEFAULT 1",
    )
  }
}

function openControlPlaneDatabase(controlPlaneDatabasePath: string): Database.Database {
  fs.mkdirSync(path.dirname(controlPlaneDatabasePath), { recursive: true })
  const database = new Database(controlPlaneDatabasePath)
  database.pragma("journal_mode = WAL")
  database.pragma("busy_timeout = 5000")
  database.pragma("foreign_keys = ON")
  ensureControlPlaneDatabaseSchema(database)
  return database
}

function mapWorkspaceRegistryRow(
  row: Record<string, unknown>,
  location: WorkspaceLocation,
): WorkspaceRegistryRecord {
  return {
    id: String(row.id ?? ""),
    location,
    name: String(row.name ?? ""),
    status: String(row.status ?? "unknown"),
    harness: row.harness == null ? null : String(row.harnes
```

### Core Architecture Module: `apps/desktop/electron/json-state-file.ts`
```
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Durable read/write for the small JSON state files in userData — browser
 * profiles, fingerprint templates, file bookmarks, the model-catalogue cache.
 *
 * Both halves matter together. The write is atomic so a crash mid-write cannot
 * leave a truncated file; the read quarantines a file that does not parse
 * instead of silently discarding it. Every caller follows a failed read with a
 * write of the fallback, so without the quarantine a single bad parse
 * permanently destroyed the only copy of the user's data.
 */

/**
 * Read JSON, falling back when the file is missing or damaged.
 *
 * A missing file is the normal first-run case and is silent. A file that
 * exists but does not parse is damaged user data: it is renamed to
 * `<name>.corrupt-<timestamp>` before the fallback is returned, so the loss is
 * recoverable and leaves evidence.
 */
export async function readJsonStateFile<T>(
  filePath: string,
  fallback: T,
  options: { log?: (message: string) => void } = {},
): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch {
    return fallback; // absent (or unreadable) — nothing to preserve
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const quarantinePath = `${filePath}.corrupt-${Date.now()}`;
    await fs.rename(filePath, quarantinePath).catch(() => undefined);
    options.log?.(
      `[state] ${path.basename(filePath)} did not parse (${
        error instanceof Error ? error.message : String(error)
      }); preserved at ${path.basename(quarantinePath)}`,
    );
    return fallback;
  }
}

/**
 * Write JSON atomically (temp file + rename), matching the shape already used
 * by writeRuntimeConfigTextAtomically in main.ts.
 *
 * These files are rewritten on every mutation — each browser-profile create,
 * rename, delete, default-pin, fingerprint seed and debug-port assignment — so
 * the truncation window of a plain writeFile is hit far more often than it
 * looks.
 */
export async function writeJsonStateFileAtomically(
  filePath: string,
  payload: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  // randomUUID, not pid+timestamp: these files are rewritten on every mutation,
  // so two writes to the same path can easily land in the same millisecond of
  // the same process. Sharing a temp made the loser's rename fail with ENOENT
  // and fall into the replace path below — destroying the real file to install
  // a temp that no longer existed.
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf-8");
  let renamed = false;
  try {
    await fs.rename(tempPath, filePath);
    renamed = true;
  } catch {
    // Windows cannot always rename onto an existing file (an AV scanner or a
    // second process holding a handle). Move the current file aside rather than
    // deleting it: whatever blocks the first rename is unlikely to have cleared
    // microseconds later, and an `rm` + failed retry would leave NO copy at all
    // — the precise loss this function exists to prevent.
    const backupPath = `${filePath}.${randomUUID()}.bak`;
    const movedAside = await fs
      .rename(filePath, backupPath)
      .then(() => true)
      .catch(() => false);
    try {
      await fs.rename(tempPath, filePath);
      renamed = true;
      if (movedAside) {
        await fs.rm(backupPath, { force: true }).catch(() => undefined);
      }
    } catch (error) {
      // Put the original back before giving up, so a failed write is a no-op
      // rather than a deletion. If even that cannot land — whatever blocks
      // renames onto this path blocks all of them — the backup STAYS on disk
      // and the error names it. The one outcome that must never happen is
      // zero surviving copies.
      if (movedAside) {
        const restored = await fs
          .rename(backupPath, filePath)
          .then(() => true)
          .catch(() => false);
        if (!restored) {
          // `cause` is assigned rather than passed to the constructor: this
          // package's tsconfig lib predates the two-argument Error.
          const failure = new Error(
            `Failed to write ${path.basename(filePath)}; its previous contents are preserved at ${backupPath}`,
          );
          (failure as { cause?: unknown }).cause = error;
          throw failure;
        }
      }
      throw error;
    }
  } finally {
    // Only ever remove the temp we still own. After a successful rename the
    // path is the live file, and `force: true` would happily delete it if the
    // rename were ever reported as failed after the fact.
    if (!renamed) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
    }
  }
}

```

### Core Architecture Module: `apps/desktop/scripts/runtime-bundle-state.mjs`
```
import { existsSync } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  localRuntimePackagerFileNames,
  resolveRuntimePlatform,
  runtimeBundleDirName,
  runtimeBundleRequiredPathGroups,
} from "./runtime-bundle.mjs";

export function resolveRuntimeBundleState(desktopRoot = process.cwd()) {
  const repoRoot = path.resolve(desktopRoot, "..", "..");
  const runtimePlatform = resolveRuntimePlatform();
  const runtimeRoot = path.join(
    desktopRoot,
    "out",
    runtimeBundleDirName(runtimePlatform),
  );
  const requiredRuntimePathGroups = runtimeBundleRequiredPathGroups(
    runtimePlatform,
  ).map((relativePaths) =>
    relativePaths.map((relativePath) => path.join(runtimeRoot, relativePath)),
  );
  const localPackagerPath =
    localRuntimePackagerFileNames(runtimePlatform)
      .map((fileName) =>
        path.join(repoRoot, "runtime", "deploy", fileName),
      )
      .find((candidatePath) => existsSync(candidatePath)) ?? null;

  return {
    desktopRoot,
    repoRoot,
    runtimePlatform,
    runtimeRoot,
    requiredRuntimePathGroups,
    runtimeSourceInputs: [
      path.join(repoRoot, "runtime", "api-server", "src"),
      path.join(repoRoot, "runtime", "api-server", "package.json"),
      path.join(repoRoot, "runtime", "api-server", "package-lock.json"),
      path.join(repoRoot, "runtime", "api-server", "tsconfig.json"),
      path.join(repoRoot, "runtime", "api-server", "tsup.config.ts"),
      path.join(repoRoot, "runtime", "state-store", "src"),
      path.join(repoRoot, "runtime", "state-store", "package.json"),
      path.join(repoRoot, "runtime", "state-store", "package-lock.json"),
      path.join(repoRoot, "runtime", "state-store", "tsconfig.json"),
      path.join(repoRoot, "runtime", "state-store", "tsup.config.ts"),
      path.join(repoRoot, "runtime", "harness-host", "src"),
      path.join(repoRoot, "runtime", "harness-host", "package.json"),
      path.join(repoRoot, "runtime", "harness-host", "package-lock.json"),
      path.join(repoRoot, "runtime", "harness-host", "tsconfig.json"),
      path.join(repoRoot, "runtime", "harness-host", "tsup.config.ts"),
      path.join(repoRoot, "runtime", "harnesses", "src"),
      path.join(repoRoot, "runtime", "harnesses", "package.json"),
      path.join(repoRoot, "runtime", "deploy", "bootstrap"),
      path.join(repoRoot, "runtime", "deploy", "build_runtime_root.mjs"),
      path.join(repoRoot, "runtime", "deploy", "build_runtime_root.sh"),
      path.join(repoRoot, "runtime", "deploy", "prune_packaged_tree.mjs"),
      path.join(repoRoot, "runtime", "deploy", "prune_packaged_tree.sh"),
      path.join(repoRoot, "runtime", "deploy", "stage_python_runtime.mjs"),
      path.join(repoRoot, "shared"),
      localPackagerPath,
    ],
    canPrepareLocalRuntime: Boolean(localPackagerPath),
  };
}

export async function firstAccessiblePath(paths) {
  for (const targetPath of paths) {
    try {
      await access(targetPath);
      return targetPath;
    } catch {
      // Continue looking for a valid path in the requirement group.
    }
  }
  return null;
}

export async function runtimeBundleExists(requiredRuntimePathGroups) {
  for (const requiredPaths of requiredRuntimePathGroups) {
    if (!(await firstAccessiblePath(requiredPaths))) {
      return false;
    }
  }
  return true;
}

// Files that the staged runtime bundle does not consume at boot. Editing
// inert markdown/docs outside the embedded skill catalog should not trigger
// a runtime rebuild. Embedded skills are different: their SKILL.md and
// referenced sidecar content are loaded directly by the live runtime, so
// changes under embedded-skills/ must invalidate the staged bundle.
const RUNTIME_BUNDLE_IGNORED_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".markdown",
  ".txt",
  ".log",
  ".map",
  ".lock",
  ".DS_Store",
]);

const RUNTIME_BUNDLE_IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".turbo",
  ".cache",
  "dist",
  "out",
  "docs",
  "__pycache__",
]);

function shouldSkipFile(name) {
  if (name.startsWith(".")) return true;
  const lastDot = name.lastIndexOf(".");
  if (lastDot < 0) return false;
  return RUNTIME_BUNDLE_IGNORED_EXTENSIONS.has(name.slice(lastDot).toLowerCase());
}

function isEmbeddedSkillAsset(targetPath) {
  const normalized = targetPath.replace(/\\/g, "/");
  return normalized.includes("/embedded-skills/");
}

export async function newestMtime(targetPath) {
  const details = await stat(targetPath);
  if (!details.isDirectory()) {
    return details.mtimeMs;
  }
  const baseName = path.basename(targetPath);
  if (RUNTIME_BUNDLE_IGNORED_DIRS.has(baseName)) {
    return 0;
  }

  const entries = await readdir(targetPath, { withFileTypes: true });
  let newest = details.mtimeMs;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (RUNTIME_BUNDLE_IGNORED_DIRS.has(entry.name)) continue;
    } else if (entry.isFile()) {
      const entryPath = path.join(targetPath, entry.name);
      if (!isEmbeddedSkillAsset(entryPath) && shouldSkipFile(entry.name)) continue;
    }
    newest = Math.max(newest, await newestMtime(path.join(targetPath, entry.name)));
  }
  return newest;
}

export async function newestExistingMtime(paths) {
  let newest = 0;
  for (const targetPath of paths) {
    if (!targetPath) {
      continue;
    }
    try {
      newest = Math.max(newest, await newestMtime(targetPath));
    } catch {
      // Ignore optional or missing inputs.
    }
  }
  return newest;
}

export async function runtimeBundleIsStale(params) {
  const bundleStamp = await newestMtime(
    path.join(params.runtimeRoot, "package-metadata.json"),
  );
  const sourceStamp = await newestExistingMtime(params.runtimeSourceInputs);
  return sourceStamp > bundleStamp;
}

```

### Core Architecture Module: `apps/desktop/src/components/layout/shell/state/composerDrafts.ts`
```
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * Per-workspace draft text for the chat composer. Persists across session
 * unmounts and reloads so a half-typed message survives switching tabs,
 * closing/reopening the window, etc.
 *
 * Keyed by workspaceId only (not workspaceId + sessionId): the dominant
 * case is "I was typing in this workspace's chat, got distracted, came
 * back". Sub-session granularity would carry a refactor cost without
 * meaningful day-to-day payoff for current usage patterns.
 *
 * Empty entries are pruned on write so an idle workspace doesn't carry
 * an empty-string slot in localStorage forever.
 */
export const composerDraftsAtom = atomWithStorage<Record<string, string>>(
  "holaboss-shell-composer-drafts-v1",
  {},
);

export const composerDraftForWorkspaceAtom = atom((get) => {
  const all = get(composerDraftsAtom);
  return (workspaceId: string | null) => {
    if (!workspaceId) return "";
    return all[workspaceId] ?? "";
  };
});

export const setComposerDraftAtom = atom(
  null,
  (
    get,
    set,
    input: { workspaceId: string | null; text: string },
  ) => {
    if (!input.workspaceId) return;
    const all = get(composerDraftsAtom);
    const current = all[input.workspaceId] ?? "";
    if (current === input.text) return;
    if (!input.text) {
      // Drop empty drafts so cleared composers don't leave stale keys.
      if (!(input.workspaceId in all)) return;
      const { [input.workspaceId]: _omitted, ...rest } = all;
      set(composerDraftsAtom, rest);
      return;
    }
    set(composerDraftsAtom, { ...all, [input.workspaceId]: input.text });
  },
);

```

### Core Architecture Module: `apps/desktop/src/components/layout/shell/state/employees.ts`
```
import { atom } from "jotai";

// The HolaEmployee + thread currently open in the dedicated Employees chat pane.
// null = no employee selected (the normal ChatPanel is shown). threadId is the
// client-stable conversation id (a fresh uuid starts a new chat).
export interface SelectedEmployee {
  employeeId: string;
  name: string;
  threadId: string;
  /** True when this is a freshly-started chat (no server history to load) — lets
   *  the pane skip the history spinner and show the empty compose state at once. */
  isNew?: boolean;
}

export const selectedEmployeeAtom = atom<SelectedEmployee | null>(null);

```

### Core Architecture Module: `apps/desktop/src/components/layout/shell/state/favorites.ts`
```
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const MAX_ENTRIES = 200;

/**
 * User-curated "pinned" list. Complements recentFiles (auto, time-decayed)
 * with explicit signal: "I care about this thing and want it always at
 * hand". Renders as the top section of the sidebar.
 *
 * Three kinds:
 *  - issue : per-workspace; sidebar filters to current workspace
 *  - file  : per-workspace (or null for non-workspace files); same filter
 *  - url   : global; visible across all workspaces
 *
 * Stored as a single flat array; the workspace filter happens at render
 * time. Keeps the storage shape stable when users switch workspaces.
 */
export type FavoriteItem =
  | {
      kind: "issue";
      id: string;
      workspaceId: string;
      issueId: string;
      title: string;
      starredAt: string;
    }
  | {
      kind: "file";
      id: string;
      workspaceId: string | null;
      filePath: string;
      label: string;
      starredAt: string;
    }
  | {
      kind: "url";
      id: string;
      url: string;
      title: string;
      faviconUrl?: string;
      starredAt: string;
    }
  | {
      // Workspace artifact / output. We keep only the minimal pointer
      // (workspaceId + outputId + the title at star time) rather than the
      // full payload — the latter goes stale when the module renames a
      // route or when the producer republishes. At open time the sidebar
      // re-fetches the live payload via the outputs list and replays
      // openOutput, which keeps URL / file resolution honest.
      kind: "output";
      id: string;
      workspaceId: string;
      outputId: string;
      title: string;
      filePath?: string | null;
      starredAt: string;
    }
  | {
      // Installed module app. Pinning an app keeps a quick-launch entry; at
      // open time the workspace resolves the app's current web surface URL.
      kind: "app";
      id: string;
      workspaceId: string;
      appId: string;
      label: string;
      starredAt: string;
    };

// Stable composite key per kind. Used both as the React/Set key and as
// the dedupe predicate inside the toggle atom.
export function favoriteKey(
  input:
    | { kind: "issue"; workspaceId: string; issueId: string }
    | { kind: "file"; workspaceId: string | null; filePath: string }
    | { kind: "url"; url: string }
    | { kind: "output"; workspaceId: string; outputId: string }
    | { kind: "app"; workspaceId: string; appId: string },
): string {
  if (input.kind === "issue") {
    return `issue:${input.workspaceId}:${input.issueId}`;
  }
  if (input.kind === "file") {
    return `file:${input.workspaceId ?? "_"}:${input.filePath}`;
  }
  if (input.kind === "output") {
    return `output:${input.workspaceId}:${input.outputId}`;
  }
  if (input.kind === "app") {
    return `app:${input.workspaceId}:${input.appId}`;
  }
  return `url:${input.url}`;
}

export const favoritesAtom = atomWithStorage<FavoriteItem[]>(
  "holaboss-shell-favorites-v1",
  [],
);

/**
 * Toggle a favorite: add if absent, remove if present. Matches by
 * composite key so adding the "same" issue twice from different surfaces
 * (sidebar row vs board card) never duplicates.
 *
 * New entries land at the head so most-recently-starred items appear
 * first — same convention as recents.
 */
/** Descriptor accepted by toggleFavoriteAtom — also the prop shape any
 *  surface passes to the shared PinStarButton. */
export type FavoriteToggleInput =
  | {
      kind: "issue";
      workspaceId: string;
      issueId: string;
      title: string;
    }
  | {
      kind: "file";
      workspaceId: string | null;
      filePath: string;
      label: string;
    }
  | { kind: "url"; url: string; title: string; faviconUrl?: string }
  | {
      kind: "output";
      workspaceId: string;
      outputId: string;
      title: string;
      filePath?: string | null;
    }
  | {
      kind: "app";
      workspaceId: string;
      appId: string;
      label: string;
    };

export const toggleFavoriteAtom = atom(
  null,
  (get, set, input: FavoriteToggleInput) => {
    const key = favoriteKey(input);
    const prev = get(favoritesAtom);
    const existing = prev.find((entry) => entry.id === key);
    if (existing) {
      set(
        favoritesAtom,
        prev.filter((entry) => entry.id !== key),
      );
      return;
    }
    const now = new Date().toISOString();
    let next: FavoriteItem;
    if (input.kind === "issue") {
      next = {
        kind: "issue",
        id: key,
        workspaceId: input.workspaceId,
        issueId: input.issueId,
        title: input.title,
        starredAt: now,
      };
    } else if (input.kind === "file") {
      next = {
        kind: "file",
        id: key,
        workspaceId: input.workspaceId,
        filePath: input.filePath,
        label: input.label,
        starredAt: now,
      };
    } else if (input.kind === "output") {
      next = {
        kind: "output",
        id: key,
        workspaceId: input.workspaceId,
        outputId: input.outputId,
        title: input.title,
        filePath: input.filePath ?? null,
        starredAt: now,
      };
    } else if (input.kind === "app") {
      next = {
        kind: "app",
        id: key,
        workspaceId: input.workspaceId,
        appId: input.appId,
        label: input.label,
        starredAt: now,
      };
    } else {
      next = {
        kind: "url",
        id: key,
        url: input.url,
        title: input.title,
        faviconUrl: input.faviconUrl,
        starredAt: now,
      };
    }
    set(favoritesAtom, [next, ...prev].slice(0, MAX_ENTRIES));
  },
);

/**
 * Filtered view for the sidebar Favorites section. Returns:
 *  - all starred URLs (always visible across workspaces — a URL has no
 *    workspace affinity)
 *  - workspace-scoped issues + files matching the active workspace
 *
 * When no workspace is selected, falls back to URLs only so the section
 * still renders something useful instead of going empty.
 */
export const favoritesForWorkspaceAtom = atom((get) => {
  const all = get(favoritesAtom);
  return (workspaceId: string | null) =>
    all.filter((entry) => {
      // Drop legacy "folder" pins left in storage from the retired Files tree.
      if ((entry as { kind: string }).kind === "folder") return false;
      if (entry.kind === "url") return true;
      if (!workspaceId) return false;
      // issue / file / output / app all carry a workspaceId scope.
      return entry.workspaceId === workspaceId;
    });
});

/**
 * Reactive `isFavorite(key) → boolean` derived from the storage atom.
 * Components read this via useAtomValue and call the returned function
 * with a key from favoriteKey() to drive their star-on/off visual.
 */
export const isFavoriteAtom = atom((get) => {
  const all = get(favoritesAtom);
  const keys = new Set(all.map((entry) => entry.id));
  return (key: string) => keys.has(key);
});

/**
 * Manual reorder for drag-to-reorder in the sidebar. Moves `draggedId` to
 * sit before/after `targetId` within the flat storage array — which is the
 * display order. Reordering against a visible target in the global array
 * keeps items from other workspaces (and global URLs) in place.
 */
export const moveFavoriteAtom = atom(
  null,
  (
    get,
    set,
    input: { draggedId: string; targetId: string; place: "before" | "after" },
  ) => {
    const { draggedId, targetId, place } = input;
    if (draggedId === targetId) return;
    const prev = get(favoritesAtom);
    const fromIndex = prev.findIndex((entry) => entry.id === draggedId);
    if (fromIndex === -1) return;
    const dragged = prev[fromIndex];
    const without = prev.filter((entry) => entry.id !== draggedId);
    const targetIndex = without.findIndex((entry) => entry.id === targetId);
    if (targetIndex === -1) return;
    const insertAt = place === "before" ? targetIndex : targetIndex + 1;
    const next = [...without];
    next.splice(insertAt, 0, dragged);
    set(favoritesAtom, next);
  },
);

```

### Core Architecture Module: `apps/desktop/src/components/layout/shell/state/internalTabs.ts`
```
import { atom } from "jotai";

export type WorkspaceSurfaceTabKind = "automations" | "skills";

export type WorkspaceSurfaceInternalTab = {
  id: string;
  kind: WorkspaceSurfaceTabKind;
  workspaceId: string;
  label: string;
};

export type InternalTab =
  | {
      id: string;
      kind: "file";
      filePath: string;
      label: string;
    }
  | {
      id: string;
      kind: "image";
      dataUrl: string;
      label: string;
      revokeOnClose?: boolean;
    }
  | WorkspaceSurfaceInternalTab
  | {
      id: string;
      kind: "issue_detail";
      workspaceId: string;
      issueId: string;
      label: string;
    }
  | {
      // An empty in-app tab (the "New tab" landing). Not a browser tab — the
      // in-app browser was retired; browsing happens in profile windows.
      id: string;
      kind: "blank";
      label: string;
    };

// Open tabs are scoped to the active session (each chat keeps its own set).
// The session-aware read/write facade lives in ./ui alongside
// `selectedSessionIdAtom`; re-exported here so consumers keep importing from
// the tabs module. Defining them in ./ui avoids an import cycle (ui only
// needs InternalTab as a type).
export { internalTabsAtom, activeInternalTabIdAtom } from "./ui";

// One-shot signal: when an issue detail tab is opened via "Reply" on a
// blocked board card, its tab id lands here. The IssueDetailPane reads it
// on mount, removes itself from the set, and auto-focuses the composer.
// Re-clicking the same tab later does NOT re-trigger focus.
export const pendingIssueComposerFocusAtom = atom<Set<string>>(
  new Set<string>(),
);

let counter = 0;
export function makeInternalTabId(): string {
  counter += 1;
  return `int-${Date.now()}-${counter}`;
}

/** A fresh empty in-app tab (the New-tab landing). */
export function blankTab(): Extract<InternalTab, { kind: "blank" }> {
  return { id: makeInternalTabId(), kind: "blank", label: "New Tab" };
}

export function fileNameFromPath(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || trimmed;
}

export function makeWorkspaceSurfaceTabId(
  kind: WorkspaceSurfaceTabKind,
  workspaceId: string,
): string {
  return `surface:${kind}:${workspaceId.trim()}`;
}

export function workspaceSurfaceTab(
  kind: WorkspaceSurfaceTabKind,
  workspaceId: string,
): WorkspaceSurfaceInternalTab {
  return {
    id: makeWorkspaceSurfaceTabId(kind, workspaceId),
    kind,
    workspaceId: workspaceId.trim(),
    label: workspaceSurfaceLabel(kind),
  };
}

function workspaceSurfaceLabel(kind: WorkspaceSurfaceTabKind): string {
  switch (kind) {
    case "skills":
      return "Skills";
    case "automations":
    default:
      return "Automations";
  }
}

export function makeIssueDetailTabId(
  workspaceId: string,
  issueId: string,
): string {
  return `issue:${workspaceId.trim()}:${issueId.trim()}`;
}

export function issueDetailTab(params: {
  workspaceId: string;
  issueId: string;
  label?: string | null;
}): Extract<InternalTab, { kind: "issue_detail" }> {
  const normalizedIssueId = params.issueId.trim();
  return {
    id: makeIssueDetailTabId(params.workspaceId, normalizedIssueId),
    kind: "issue_detail",
    workspaceId: params.workspaceId.trim(),
    issueId: normalizedIssueId,
    label: params.label?.trim() || normalizedIssueId,
  };
}

export function upsertInternalTab(
  tabs: InternalTab[],
  tab: InternalTab,
): InternalTab[] {
  return tabs.some((entry) => entry.id === tab.id) ? tabs : [...tabs, tab];
}

```

### Core Architecture Module: `apps/desktop/src/components/layout/shell/state/recentFiles.ts`
```
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const MAX_ENTRIES = 50;

/**
 * Renderer-side parallel of browser history for internal file tabs.
 * Files don't navigate via the BrowserView so main never sees them;
 * we keep our own persistent list keyed by filePath. Browser history
 * (URLs) and these (files) merge into a single time-sorted Recents
 * list in the sidebar.
 */
export type RecentFile = {
  id: string;
  filePath: string;
  label: string;
  workspaceId: string | null;
  openedAt: string;
};

export const recentFilesAtom = atomWithStorage<RecentFile[]>(
  "holaboss-new-shell-recent-files-v1",
  [],
);

let counter = 0;
function nextId(): string {
  counter += 1;
  return `rf-${Date.now()}-${counter}`;
}

function sameEntry(
  entry: RecentFile,
  filePath: string,
  workspaceId: string | null,
): boolean {
  return entry.filePath === filePath && entry.workspaceId === workspaceId;
}

/**
 * Push a file as the most-recently-opened. Dedupes on (filePath,
 * workspaceId) — the same path under different workspaces gets distinct
 * entries so a switch doesn't collide their ids / openedAt. Existing
 * entry's id is preserved so React keys stay stable; caps the list at
 * MAX_ENTRIES.
 */
// OS-clutter filenames that should never enter Recents. Mirrors the same
// defensive list used in useWorkspaceLists for outputs.
const OS_CLUTTER_NAMES: ReadonlySet<string> = new Set([
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
]);

function isOsClutterPath(path: string): boolean {
  const lastSegment = path.split(/[\\/]/).pop() ?? "";
  return OS_CLUTTER_NAMES.has(lastSegment);
}

export const pushRecentFileAtom = atom(
  null,
  (
    get,
    set,
    input: { filePath: string; label: string; workspaceId: string | null },
  ) => {
    // Don't pollute Recents with platform clutter even if a caller hands
    // us one — defensive guard at the storage boundary.
    if (isOsClutterPath(input.filePath)) return;
    const now = new Date().toISOString();
    const prev = get(recentFilesAtom);
    const existing = prev.find((e) =>
      sameEntry(e, input.filePath, input.workspaceId),
    );
    const updated: RecentFile = {
      id: existing?.id ?? nextId(),
      filePath: input.filePath,
      label: input.label,
      workspaceId: input.workspaceId,
      openedAt: now,
    };
    const rest = prev.filter(
      (e) => !sameEntry(e, input.filePath, input.workspaceId),
    );
    set(recentFilesAtom, [updated, ...rest].slice(0, MAX_ENTRIES));
  },
);

export const removeRecentFileAtom = atom(null, (get, set, id: string) => {
  set(
    recentFilesAtom,
    get(recentFilesAtom).filter((e) => e.id !== id),
  );
});

export const removeRecentFileByPathAtom = atom(
  null,
  (
    get,
    set,
    input: { filePath: string; workspaceId: string | null },
  ) => {
    set(
      recentFilesAtom,
      get(recentFilesAtom).filter(
        (e) => !sameEntry(e, input.filePath, input.workspaceId),
      ),
    );
  },
);

```

### Core Architecture Module: `apps/desktop/src/components/layout/shell/state/recentOutputs.ts`
```
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const MAX_ENTRIES = 50;

/**
 * Recently-opened app/module outputs (twitter posts, linkedin drafts, …).
 * File-backed outputs already land in recentFilesAtom via the internal-tab
 * path; these are the module-backed ones that open as an app surface, which
 * have no on-disk path. Kept separate from recentFilesAtom so the file store
 * doesn't need a schema migration. The sidebar merges both, sorted by openedAt.
 */
export type RecentOutput = {
  id: string;
  outputId: string;
  workspaceId: string | null;
  label: string;
  moduleId: string | null;
  moduleResourceId: string | null;
  outputType: string;
  metadata: Record<string, unknown>;
  updatedAt: string;
  openedAt: string;
};

export const recentOutputsAtom = atomWithStorage<RecentOutput[]>(
  "holaboss-new-shell-recent-outputs-v1",
  [],
);

let counter = 0;
function nextId(): string {
  counter += 1;
  return `ro-${Date.now()}-${counter}`;
}

export const pushRecentOutputAtom = atom(
  null,
  (
    get,
    set,
    input: {
      outputId: string;
      workspaceId: string | null;
      label: string;
      moduleId: string | null;
      moduleResourceId: string | null;
      outputType: string;
      metadata: Record<string, unknown>;
      updatedAt: string;
    },
  ) => {
    if (!input.outputId.trim()) return;
    const now = new Date().toISOString();
    const prev = get(recentOutputsAtom);
    const existing = prev.find(
      (e) =>
        e.outputId === input.outputId && e.workspaceId === input.workspaceId,
    );
    const updated: RecentOutput = {
      id: existing?.id ?? nextId(),
      outputId: input.outputId,
      workspaceId: input.workspaceId,
      label: input.label,
      moduleId: input.moduleId,
      moduleResourceId: input.moduleResourceId,
      outputType: input.outputType,
      metadata: input.metadata,
      updatedAt: input.updatedAt,
      openedAt: now,
    };
    const next = [
      updated,
      ...prev.filter((e) => e.id !== updated.id),
    ].slice(0, MAX_ENTRIES);
    set(recentOutputsAtom, next);
  },
);

export const removeRecentOutputAtom = atom(null, (get, set, id: string) => {
  set(
    recentOutputsAtom,
    get(recentOutputsAtom).filter((e) => e.id !== id),
  );
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #468** (2026-08-15): **[Bug]: Can't attach files in a project composer (works in a standalone session)**
  *Symptoms*: ### Summary  In the desktop app, files can be attached in a standalone (non-project) chat session, but not in a project.  On the project landing page ("What do you want to make?"), the composer's attachment affordances do nothing: picking a file through the attach control, dragging a file in from Finder/Explorer, or dragging one in from the in-app File Explorer all leave the composer empty — no attachment chip appears, no error is shown, and the first message starts the project session with text only.  Looking at `main`, the project composer appears to be mounted with its attachment plumbing stubbed out. In `apps/desktop/src/components/projects/ProjectLanding.tsx` the shared `Composer` receives:  - `attachments={[]}` (hard-coded empty) - `onAttachmentInputChange={noop}` - `onAddDroppedFiles={noop}` - `onAddExplorerAttachments={noop}` - `onRemoveAttachment={noop}` / `onPreviewAttachment={noop}` - a `fileInputRef` that is never wired to any state  and `handleSubmit` calls `workspace.queueSessionInput({ ..., image_urls: null })` with no attachment payload, while the ChatPane/ChatPanel path wires the real handlers and stages files.  The likely underlying constraint: staging goes through `stageSessionAttachments` (`POST /api/v1/sessions/{sessionId}/attachments`), which needs an existing session id — and on the project landing page the session isn't created until the first message is submitted. So a fix probably needs to hold picked files as pending attachments in the renderer, the

- **Issue #156** (2026-04-14): **[Bug]: Artifacts Display Delay**
  *Symptoms*: ### Summary  Agent写完report 后 左边的output并没有直接刷新出来 有延时  ### Area  None  ### Host platform  _No response_  ### Reproduction  Agent写完report 后 左边的output并没有直接刷新出来 有延时  ### Logs  ```shell  ```

- **Issue #146** (2026-04-13): **[Bug]: marketplace templates fail through gateway with "Service not found"**
  *Symptoms*: ## Summary When the desktop app starts with `HOLABOSS_AUTH_BASE_URL` set to `https://api.holaboss.ai`, marketplace template requests are routed through `https://api.holaboss.ai/gateway/marketplace` and repeatedly fail with `{"error":"Service not found"}`.  The marketplace service itself is reachable directly on port `3037`, so the failure is caused by gateway routing rather than the service being down. Expected behavior is for marketplace template listing to succeed on startup without repeated IPC errors.  Origin: extracted from the diagnosis in PR #144.  ## Area desktop  ## Host platform Any desktop environment where `HOLABOSS_AUTH_BASE_URL` is set and no marketplace URL override is provided.  ## Reproduction 1. Start the desktop app with `HOLABOSS_AUTH_BASE_URL=https://api.holaboss.ai`. 2. Do not set `HOLABOSS_MARKETPLACE_URL`. 3. Trigger startup or any flow that calls `workspace:listMarketplaceTemplates`. 4. Observe repeated failures while the renderer retries the IPC call.  ## Logs ```shell Error occurred in handler for 'workspace:listMarketplaceTemplates': Error: {"error":"Service not found"}     at requestControlPlaneJson (…/main.cjs:4863:11) ```  ## Root Cause `marketplaceBaseUrl()` unconditionally routes marketplace traffic through the gateway whenever `AUTH_BASE_URL` is set. The gateway at `api.holaboss.ai` does not currently have a `marketplace` route registered, so requests that should reach the marketplace service at port `3037` instead return 404 `{"error":"Servi
  **Post-Mortem & Fix Analysis**:
  > Closing as resolved. The original gateway failure described here is no longer reproducible as of 2026-04-13: `https://api.holaboss.ai/gateway/marketplace/api/v1/marketplace/templates` now returns `401 {"error":"Authentication required"}`, while a bogus gateway service path still returns `404 {"error":"Service not found"}`. That indicates the `marketplace` gateway route is now registered and the specific misconfiguration tracked by this issue has been fixed.

- **Issue #140** (2026-04-12): **[Bug]: google oauth for other apps**
  *Symptoms*: ### Summary  Google Chrome can sign in successfully, but the internal browser cannot complete OAuth sign-in for other apps.  ### Area  None  ### Host platform  _No response_  ### Reproduction  Google Chrome can sign in successfully, but the internal browser cannot complete OAuth sign-in for other apps.  ### Logs  ```shell  ```

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

### Incident Patch 1: `4684714e` (2026-08-21)
**Commit Message**: fix(desktop): show a sentence, not raw JSON, when a run fails on credits (#547)

* fix(desktop): show a sentence, not raw JSON, when a run fails on credits

A run that fails on credits reaches the transcript as the raw upstream body. The
desktop renders a failed run's stored error directly (`Error: ${...}` in the
run-failed card), and only ONE of the several 402 paths is normalized upstream, so
in one production week the same condition surfaced four different ways:

  You're out of credits. Top up your plan to keep using your agent.   (2 runs)
  402 {"detail":{"code":"model_proxy_insufficient_quota",...}}        (2 runs)
  402 {"detail":{"code":"model_proxy_call_exceeds_balance",...}}      (1 run)
  OpenAI API error (402): 402 status code (no body)                   (2 runs)

Five of seven showed the user JSON or a meaningless provider string for a
condition that has a plain-English answer.

- `humanizeRunFailure` rewrites recognized payment conditions and passes
  everything else through untouched — an unfamiliar error still shows its real
  text rather than being flattened into something vague, which would be worse
  than the bug.
- "empty wallet" and "this prompt costs more than

**File**: `apps/desktop/src/components/panes/ChatPane.test.mjs` (modified, +7/-7)
```diff
@@ -800,17 +800,17 @@ test("chat pane filters managed catalog entries that are not chat-capable", asyn
   assert.match(source, /if \(!runtimeModelHasChatCapability\(model\)\) \{\s*return false;\s*\}/);
 });
 
-test("chat pane prefixes run failures with provider and model context", async () => {
+test("chat pane routes run failures through the shared failure-text module", async () => {
   const source = await readFile(sourcePath, "utf8");
 
-  assert.match(source, /function runFailedContextLabel\(payload: Record<string, unknown>\): string/);
-  assert.match(source, /function runFailedDetail\(payload: Record<string, unknown>\): string/);
-  assert.match(
-    source,
-    /return detail\.startsWith\(contextLabel\)\s*\?\s*detail\s*:\s*`\$\{contextLabel\}: \$\{detail\}`;/,
-  );
+  // The functions themselves moved to runFailureText.ts so they could be tested
+  // behaviourally (ChatPane's module graph cannot be imported by a test).
+  // runFailureText.test.ts owns the prefixing and wallet-block behaviour; this
+  // only pins that the pane still uses them at both entry points.
+  assert.match(source, /from "\.\/runFailureText"/);
   assert.match(source, /const errorText = runFailedDetail\(payload\);/);
   assert.match(source, /const detail = runFailedDetail\(eventPayload\);/);
+  assert.match(source, /runtimeStateErrorDetail\(currentState\.last_error\)/);
 });
 
 test("chat pane stops rebuilding assistant history after the first terminal output event", async () => {
```

**File**: `apps/desktop/src/components/panes/ChatPane/index.tsx` (modified, +5/-47)
```diff
@@ -220,6 +220,10 @@ import {
   turnInputIdsFromHistoryMessages,
 } from "./helpers";
 import { bareRuntimeToolName, effectiveToolName } from "./toolNames";
+import {
+  runFailedDetail,
+  runtimeStateErrorDetail,
+} from "./runFailureText";
 import {
   preserveCommittedAssistantTurns,
   settleCommittedAssistantTurns,
@@ -290,6 +294,7 @@ export type {
   ChatComposerMentionItem,
 };
 export {
+  runFailedDetail,
   inputIdFromMessageId,
   historyMessagesInDisplayOrder,
   turnInputIdsFromHistoryMessages,
@@ -1253,24 +1258,6 @@ function inspectableSessionLabel(
   return "Session";
 }
 
-function runtimeStateErrorDetail(value: unknown): string {
-  if (typeof value === "string") {
-    return value;
-  }
-  if (value && typeof value === "object") {
-    const payload = value as Record<string, unknown>;
-    const message = payload.message;
-    if (typeof message === "string" && message.trim()) {
-      return message;
-    }
-    const error = payload.error;
-    if (typeof error === "string" && error.trim()) {
-      return error;
-    }
-  }
-  return "The run failed.";
-}
-
 function startCase(value: string) {
   const normalized = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
 
@@ -1353,35 +1340,6 @@ function summarizeUnknown(value: unknown, maxLength = 140): string {
   return String(value);
 }
 
-function runFailedContextLabel(payload: Record<string, unknown>): string {
-  const provider =
-    typeof payload.provider === "string" ? payload.provider.trim() : "";
-  const model = typeof payload.model === "string" ? payload.model.trim() : "";
-  if (provider && model) {
-    return `${provider}/${model}`;
-  }
-  return provider || model;
-}
-
-export function runFailedDetail(payload: Record<string, unknown>): string {
-  const detail =
-    typeof payload.error === "string"
-      ? payload.error.trim()
-      : typeof payload.message === "string"
-        ? payload.message.trim()
-        : "";
-  const contextLabel = runFailedContextLabel(payload);
-  if (!contextLabel) {
-    return detail || "The run failed.";
-  }
-  if (!detail) {
-    return `${contextLabel} failed.`;
-  }
-  return detail.startsWith(contextLabel)
-    ? detail
-    : `${contextLabel}: ${detail}`;
-}
-
 function assistantMetaLabel(
   harness: string | null | undefined,
   model: string | null | undefined,
```

**File**: `apps/desktop/src/components/panes/ChatPane/runFailureText.test.ts` (added, +402/-0)
```diff
@@ -0,0 +1,402 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { runFailedDetail, runtimeStateErrorDetail } from "./runFailureText";
+
+const CREDITS = "You're out of credits. Top up your plan to keep using your agent.";
+
+/**
+ * Payloads below are the real `run_failed` shape (harness-host/src/pi.ts) unless
+ * marked constructed. The gate's body is `{"detail":{"code":…}}`; the harness
+ * attaches the captured raw response as `provider_http`.
+ *
+ * The bar is asymmetric. Failing to rewrite a wallet block leaves the user where
+ * they already are — reading JSON. Rewriting something that is NOT a wallet block
+ * is worse than the bug: it names the wrong problem and deletes the real message,
+ * including any link that would have fixed it. The negative half of this file is
+ * the load-bearing half.
+ */
+
+const walletCapture = (code: string) => ({
+  status: 402,
+  status_text: "Payment Required",
+  parsed_body: { detail: { code, message: "User does not have sufficient quota" } },
+});
+
+// ------------------------------------------------------------------ positives
+
+test("the default model's wire shape is recognized (the code is not in the message)", () => {
+  // openai/gpt-5.4 is the desktop default -> openai-compatible wire -> the SDK
+  // reads body.error, finds nothing in our {"detail":…} body, and reports
+  // "no body". A text matcher misses this entirely; the capture still has it.
+  assert.equal(
+    runFailedDetail({
+      type: "ProviderError",
+      message:
+        "402 status code (no body): User does not have sufficient quota for model proxy requests",
+      provider: "openai",
+      model: "openai/gpt-5.4",
+      provider_http: walletCapture("model_proxy_insufficient_quota"),
+    }),
+    CREDITS,
+  );
+});
+
+test("the anthropic wire shape is recognized too", () => {
+  assert.equal(
+    runFailedDetail({
+      message:
+        '402 {"detail":{"code":"model_proxy_insufficient_quota","message":"User does not have sufficient quota for model proxy requests"}}',
+      provider: "anthropic",
+      model: "claude-sonnet-4-6",
+      provider_http: walletCapture("model_proxy_insufficient_quota"),
+    }),
+    CREDITS,
+  );
+});
+
+test("a prompt too big to afford gets its own, actionable message", () => {
+  // Fixable by shortening the turn, so it must not collapse into "top up".
+  const detail = runFailedDetail({
+    message: "402 status code (no body)",
+    provider_http: walletCapture("model_proxy_call_exceeds_balance"),
+  });
+  assert.match(detail, /remaining balance/);
+  assert.doesNotMatch(detail, /out of credits/);
+});
+
+test("without a capture, the gate's nested body in the message still works", () => {
+  // Surfaces that carry no captured response (the runtime's last_error is
+  // {message} only, written from a thrown executor error).
+  assert.equal(
+    runFailedDetail({
+      message:
+        '402 {"detail":{"code":"model_proxy_insufficient_quota","message":"User does not have sufficient quota"}}',
+    }),
+    CREDITS,
+  );
+});
+
+test("the poller's path into the same transcript gets the same treatment", () => {
+  // Otherwise the bug reappears on the same screen by another route.
+  assert.equal(
+    runtimeStateErrorDetail({
+      message:
+        '402 {"detail":{"code":"model_proxy_insufficient_quota","message":"User does not have sufficient quota"}}',
+    }),
+    CREDITS,
+  );
+});
+
+// ------------------------------------------------------------------ negatives
+
+test("another model_proxy_* code is not a wallet block", () => {
+  // Seven other model_proxy_* codes exist; a `startsWith("model_proxy_")` or a
+  // bare includes("model_proxy_") would tell a user with a misconfigured proxy
+  // to go buy credits.
+  const detail = runFailedDetail({
+    message: "503 Model proxy is not configured",
+    provider: "openai",
+    model: "openai/gpt-5.4",
+    provider_http: {
+      status: 503,
+      parsed_body: { detail: { code: "model_proxy_not_configured" } },
+    },
+  });
+  assert.doesNotMatch(detail, /credits|balance/i);
+  assert.match(detail, /not configured/);
+});
+
+test("an OpenAI-style error code is not a wallet block", () => {
+  // A matcher keyed on the presence of a "code" field rewrites this into
+  // "you're out of credits" and deletes the actual cause.
+  const raw =
+    '401 {"error":{"message":"Incorrect API key provided: sk-***","code":"invalid_api_key"}}';
+  assert.match(runFailedDetail({ message: raw }), /invalid_api_key/);
+});
+
+test("a rate limit is not a wallet block", () => {
+  const raw = '429 {"error":{"message":"Rate limit reached","code":"rate_limit_exceeded"}}';
+  assert.match(runFailedDetail({ message: raw }), /rate_limit_exceeded/);
+});
+
+test("an agent DISCUSSING the error code keeps its own words", () => {
+  // run_failed's message falls back to the assistant's own prose when there is
+  // no error string (normalizeAssistantFailureMess
```

**File**: `apps/desktop/src/components/panes/ChatPane/runFailureText.ts` (added, +248/-0)
```diff
@@ -0,0 +1,248 @@
+/**
+ * Failure text for the transcript: what the user reads when a run dies.
+ *
+ * These live outside index.tsx because they are pure functions over an event
+ * payload, and because ChatPane's module graph cannot be imported by a test
+ * (`@/components/ui/icons` pulls a package whose exports map node's resolver
+ * rejects). Keeping them here is what makes the behaviour testable at all.
+ *
+ * ## The wallet case
+ *
+ * A run blocked on credits reaches the transcript as the raw upstream body,
+ * because the run's stored error is that body verbatim. In one production week
+ * the same condition surfaced four different ways, only one of them a sentence.
+ *
+ * The signal to match on is `provider_http.parsed_body.detail.code`, NOT the
+ * message text. The harness captures the raw upstream response into a ring
+ * buffer and attaches it to `run_failed` (`providerHttpPayloadFromCapture`,
+ * harness-host/src/pi.ts) precisely because the SDK destroys it: `payload.message`
+ * is built by `extractDeepProviderMessage`, which descends `detail` → `message`
+ * and returns only the human sentence, dropping `code`.
+ *
+ * That distinction decides whether this works at all. Which message shape you get
+ * depends on the wire (`harnesses/src/model-routing.ts` picks one of four), and
+ * the OpenAI-family wires destroy the code:
+ *
+ *   openai-responses / openai-completions  read `body.error`; our `{"detail":…}`
+ *                                          body has none, so the SDK reports
+ *                                          "402 status code (no body)"
+ *   anthropic-messages                     reads the whole body → JSON survives
+ *
+ * The desktop's effective default model comes from the control-plane binding
+ * (`runtimeConfig?.defaultModel`), falling back to `openai/gpt-5.4` — an
+ * OpenAI-family model either way, so it takes `openai-responses` and the code is
+ * destroyed. A text matcher would therefore only ever have fired for users who
+ * had switched to Claude. The captured response is present on every wire.
+ *
+ * ## Why not match "402", or the code as a bare substring
+ *
+ * An earlier version matched `/\b402\b/` plus "payment required" and
+ * "insufficient quota|credit". Measured against real inputs it was wrong in the
+ * expensive direction — rewriting a NON-wallet failure is worse than showing raw
+ * JSON, because it names the wrong problem and deletes the real message:
+ *
+ *  - the phrase rules caught zero real wallet blocks (all carry a leading 402)
+ *    while being the sole trigger for false positives;
+ *  - a bare 402 appears in stack traces (`agent.js:402:17`), durations, ports,
+ *    and `at position 402`;
+ *  - a BYO/custom-provider 402 means the USER'S OWN provider account is out of
+ *    credit — that send path returns before the quota gate — so "top up your
+ *    plan" names the wrong account and deletes the provider's remediation link;
+ *  - one false positive erased the string `parseModelError` matches on, killing
+ *    the "switch model and retry" card.
+ *
+ * Free-text matching is the whole false-positive surface, so it is used ONLY
+ * when no capture exists, and even then the WHOLE string must be a wire error.
+ * `run_failed`'s message falls back to the assistant's own prose when there is
+ * no error string, so an agent explaining this very error — quoting the gate's
+ * body, which is the natural way to explain it — would otherwise have its answer
+ * replaced by "you're out of credits".
+ */
+
+/**
+ * Codes our quota gate emits (model_proxy/quota.py). Emitted only by that gate,
+ * which the BYO path never reaches — so one of these is proof that the Holaboss
+ * wallet, not the user's own provider, blocked the run.
+ */
+const WALLET_BLOCK_MESSAGES = {
+  // Actionable WITHOUT topping up (send less), so it must not collapse into the
+  // generic message.
+  model_proxy_call_exceeds_balance:
+    "This request costs more than your remaining balance. Top up, or start a shorter conversation.",
+  model_proxy_insufficient_quota:
+    "You're out of credits. Top up your plan to keep using your agent.",
+} as const;
+
+type WalletBlockCode = keyof typeof WALLET_BLOCK_MESSAGES;
+
+function isRecord(value: unknown): value is Record<string, unknown> {
+  return typeof value === "object" && value !== null && !Array.isArray(value);
+}
+
+function isWalletBlockCode(value: unknown): value is WalletBlockCode {
+  // hasOwnProperty, not `in`: `in` walks the prototype chain, so an upstream
+  // body with `"code":"toString"` would return Object.prototype.toString — a
+  // FUNCTION out of a `: string` signature, into a React child. `detail.code`
+  // is untrusted 4xx content, including a user's own BYO provider's.
+  return (
+    typeof value === "string" &&
+    Object.prototype.hasOwnProperty.call(WALLET_BLOCK_MESSAGES, value)
+  );
+}
+
+/** The gate's body is `{"detail":{"code":…}}`. */
+function walletCodeFromBody(body: unknown): Wal
```

---

### Incident Patch 2: `dde20a5f` (2026-08-21)
**Commit Message**: fix(runtime): clip oversized embedding inputs so memory recall stops failing silently (#541)

* fix(runtime): clip oversized embedding inputs so memory recall stops failing silently

text-embedding-3-small rejects the WHOLE request over its 8192-token cap
("Invalid 'input': maximum context length is 8192 tokens") rather than
truncating. Recall queries are raw user turns passed straight through, so a long
pasted instruction 400s and queryMemoryModelEmbedding returns null.

Nothing surfaces that. The caller treats null as "no matches", the agent answers
the turn without its own memory, and the user is never told the recall failed —
it just looks like the assistant forgot. Production: 18 such 400s across 11 users
and 16 sessions between 2026-08-08 and 2026-08-20, still occurring.

The asymmetry that hid it: the INDEXED side is already bounded
(memory-embedding-index clips excerpts to MAX_EMBEDDING_EXCERPT_CHARS = 480),
so only the query side could overflow.

- clip to 6000 chars inside `queryMemoryModelEmbedding`. Chosen so the cap holds
  even for CJK text, where one character can cost a full token, while staying
  12x the length of the excerpts a query is compared against — no reali

**File**: `runtime/api-server/src/integration-memory.ts` (modified, +2/-0)
```diff
@@ -5021,6 +5021,7 @@ async function syncNodeEmbedding(params: {
     return;
   }
   const embedding = await queryMemoryModelEmbedding(params.embeddingClient, {
+    purpose: "document",
     input: embeddingText,
     timeoutMs: 7000,
   });
@@ -5533,6 +5534,7 @@ async function queryEmbeddingVector(params: {
     return null;
   }
   const embedding = await queryMemoryModelEmbedding(client, {
+    purpose: "query",
     input: params.query,
     timeoutMs: 7000,
   });
```

**File**: `runtime/api-server/src/interaction-memory.ts` (modified, +2/-0)
```diff
@@ -3873,6 +3873,7 @@ async function syncNodeEmbedding(params: {
     return;
   }
   const embedding = await queryMemoryModelEmbedding(params.embeddingClient, {
+    purpose: "document",
     input: embeddingText,
     timeoutMs: 7000,
     agentRole: "memory-embedding",
@@ -4363,6 +4364,7 @@ async function queryEmbeddingVector(params: {
     return null;
   }
   const embedding = await queryMemoryModelEmbedding(client, {
+    purpose: "query",
     input: params.query,
     timeoutMs: 7000,
     agentRole: "memory-embedding",
```

**File**: `runtime/api-server/src/memory-embedding-index.ts` (modified, +1/-0)
```diff
@@ -141,6 +141,7 @@ export async function syncDurableMemoryEmbedding(params: {
     return "skipped_unchanged";
   }
   const embedding = await queryMemoryModelEmbedding(params.embeddingClient, {
+    purpose: "document",
     input: buildMemoryEmbeddingText({
       title: params.entry.title,
       summary: params.entry.summary,
```

**File**: `runtime/api-server/src/memory-model-client.test.ts` (modified, +220/-0)
```diff
@@ -2,6 +2,9 @@ import assert from "node:assert/strict";
 import { afterEach, test } from "node:test";
 
 import {
+  MAX_EMBEDDING_QUERY_TOKENS,
+  clipToEmbeddingBudget,
+  estimateEmbeddingTokens,
   queryMemoryModelEmbedding,
   queryMemoryModelJson,
   queryMemoryModelVisionJson,
@@ -317,6 +320,7 @@ test("queryMemoryModelEmbedding uses OpenAI-compatible embeddings", async () =>
     },
     {
       input: "Remember this workspace fact.",
+      purpose: "document",
     },
   );
 
@@ -338,3 +342,219 @@ test("queryMemoryModelEmbedding uses OpenAI-compatible embeddings", async () =>
     encoding_format: "float",
   });
 });
+
+/**
+ * The cap is a TOKEN bound, so assert tokens. The first version of this test
+ * asserted `chars <= 6000` and passed on an input of 12,000 tokens — the shipped
+ * constant was safe for English and 2x too generous for CJK, and the assertion
+ * could not see the difference. `宇` costs 2 tokens; some scripts cost ~3.
+ */
+test("a query is clipped to a token budget, not a character count", async () => {
+  let call: RecordedCall | null = null;
+  globalThis.fetch = (async (_input, init) => {
+    call = {
+      url: String(_input),
+      headers: init?.headers,
+      body:
+        typeof init?.body === "string"
+          ? (JSON.parse(init.body) as Record<string, unknown>)
+          : null,
+    };
+    return new Response(JSON.stringify({ data: [{ embedding: [1] }] }), {
+      status: 200,
+      headers: { "content-type": "application/json" },
+    });
+  }) as typeof fetch;
+
+  // 40k CJK characters — the case the previous constant let through.
+  await queryMemoryModelEmbedding(
+    {
+      baseUrl: "https://runtime.example/api/v1/model-proxy/openai/v1",
+      apiKey: "token-embedding",
+      modelId: "text-embedding-3-small",
+      apiStyle: "openai_compatible",
+    },
+    { input: "宇".repeat(40_000), purpose: "query" },
+  );
+
+  const sent = (call as unknown as RecordedCall).body?.input as string;
+  // Assert CHARACTERS, not the estimator's own opinion. Checking the clip with
+  // the same function that performed it is a tautology — an earlier version of
+  // this test passed with the constants set 300x too low. Since every character
+  // now costs at least one token, a character bound is a real upper bound on
+  // tokens and is independent of the estimator.
+  assert.ok(
+    sent.length <= MAX_EMBEDDING_QUERY_TOKENS,
+    `sent ${sent.length} chars — over the ${MAX_EMBEDDING_QUERY_TOKENS} budget`,
+  );
+});
+
+/**
+ * The estimate must be an UPPER bound, so the per-character costs are measured
+ * ceilings rather than averages. These are the input classes that broke the
+ * previous "~4 chars per token" assumption — measured against cl100k_base, base64
+ * reached 2.45x the model cap, minified JS 1.44x, lockfile-shaped JSON 1.33x.
+ *
+ * Character-count assertions on purpose: independent of the estimator.
+ */
+test("dense inputs are clipped to the budget, not just prose", () => {
+  const cases: Array<[string, string]> = [
+    ["base64", "TWFuIGlzIGRpc3Rpbmd1aXNoZWQ".repeat(40_000)],
+    ["hex", "deadbeef0123456789abcdef".repeat(40_000)],
+    ["minified js", "function a(b,c){return b<c?b:c}".repeat(30_000)],
+    ["json", '{"name":"x","version":"1.0.0","resolved":"https://r"},'.repeat(20_000)],
+    ["random identifiers", "aX3kZ9qWm2 ".repeat(80_000)],
+    ["astral", "𐐀".repeat(60_000)],
+    ["cjk", "宇宙飛行士".repeat(40_000)],
+  ];
+  for (const [label, input] of cases) {
+    const clipped = clipToEmbeddingBudget(input);
+    assert.ok(
+      clipped.length <= MAX_EMBEDDING_QUERY_TOKENS,
+      `${label}: clipped to ${clipped.length} chars, over the ${MAX_EMBEDDING_QUERY_TOKENS} budget`,
+    );
+  }
+});
+
+test("an ordinary English query passes through untouched", () => {
+  // Comfortably inside the budget, so identity holds here. Note the budget is a
+  // CHARACTER-equivalent bound now: a query longer than ~7000 chars IS clipped,
+  // which an earlier test forbade. That requirement was wrong — it cannot coexist
+  // with a safe static bound, and a recall query is compared against 480-char
+  // excerpts, so trimming a very long one costs no real signal.
+  const english = "what did we decide about the pricing page? ".repeat(100);
+  assert.ok(english.length < MAX_EMBEDDING_QUERY_TOKENS);
+  assert.equal(clipToEmbeddingBudget(english), english);
+});
+
+test("the estimator never under-counts a mixed-script string", () => {
+  // Spot-check the ceiling property itself: ASCII >= 1/char, non-ASCII >= 1/char.
+  const mixed = "abc宇𐐀";
+  assert.ok(estimateEmbeddingTokens(mixed) >= mixed.length);
+});
+
+test("clipping never splits a surrogate pair", () => {
+  // Iterating by code point (for..of) makes a mid-pair cut structurally
+  // impossible; `.slice()` on code UNITS does not. A lone surrogate would show up
+  // here as a code point in the D800-DFFF range.
+  const clipped = clipToEmbeddingBudget("𠀀".repeat(20_000));
+  const l
```

**File**: `runtime/api-server/src/memory-model-client.ts` (modified, +106/-2)
```diff
@@ -27,6 +27,13 @@ export interface MemoryModelVisionJsonQuery extends MemoryModelJsonQuery {
 
 export interface MemoryModelEmbeddingQuery {
   input: string;
+  /**
+   * Whether this vector is a transient search key or gets persisted. Required —
+   * the two want opposite handling when the input exceeds the model's cap, and
+   * the default that "felt safe" (clip everything) silently corrupts the index.
+   * See MemoryEmbeddingPurpose.
+   */
+  purpose: MemoryEmbeddingPurpose;
   timeoutMs?: number;
   agentRole?: string | null;
 }
@@ -483,6 +490,91 @@ export async function queryMemoryModelVisionJson(
   }
 }
 
+/**
+ * Embedding inputs are hard-capped by the model — text-embedding-3-small rejects
+ * the WHOLE request over 8192 tokens ("Invalid 'input': maximum context length is
+ * 8192 tokens") rather than truncating.
+ *
+ * The two callers of this function want OPPOSITE things when that happens, and it
+ * cannot tell them apart on its own — which is why `purpose` is required:
+ *
+ *  - "query"    a transient search vector. Narrowing it costs a little recall
+ *               precision and nothing else, so clip and carry on. Failing here
+ *               means recall silently returns nothing and the agent answers
+ *               without its own memory.
+ *  - "document" a vector that gets PERSISTED, keyed by a content fingerprint that
+ *               suppresses recomputation. A truncated one is stored as if it were
+ *               the real thing and never revisited, so it must NOT be silently
+ *               clipped — better to fail loudly and leave the entry unindexed.
+ *
+ * Getting this backwards is not hypothetical: clipping at this choke point turned
+ * "an inline image is not indexed" into "an inline image is indexed as 6000 chars
+ * of base64, indistinguishable from every other image, permanently".
+ */
+export type MemoryEmbeddingPurpose = "query" | "document";
+
+/**
+ * Token budget, with headroom under the model's 8192.
+ *
+ * The per-character costs below are measured CEILINGS from cl100k_base (the
+ * encoding text-embedding-3-small uses), not averages — the whole point is that
+ * the estimate must be an UPPER bound, or the clip does not actually guarantee
+ * anything.
+ *
+ * An earlier version used 0.25 tokens per ASCII char ("~4 chars per token"),
+ * which is true of English prose and hand-written code and false of everything
+ * denser. Measured against a real tokenizer, that let 13 of 22 realistic input
+ * classes through over the cap: base64 reached 20,109 tokens (2.45x), minified
+ * JS 11,756, a lockfile-shaped JSON 10,933, stack traces 12,173. The failing
+ * inputs in production were pasted files, so the bug survived the "fix" for
+ * anything that wasn't prose.
+ *
+ * ASCII: scanning all 128 code points, the worst single character costs exactly
+ * 1 token (rare punctuation; dense text like base64/hex/minified JS approaches
+ * it). NON-ASCII: the BMP maxes at 3 (<=3 UTF-8 bytes), but astral planes reach
+ * 4 (4 bytes -> 4 byte-fallback tokens) — Deseret, Cuneiform, Tangut, CJK ext-G,
+ * plane-15/16 PUA, variation selectors.
+ *
+ * A consequence worth stating: since every character now costs at least one
+ * token, the clipped string can never be longer than the budget in CHARACTERS
+ * either. The tests assert that, which is a check independent of this estimator.
+ */
+export const MAX_EMBEDDING_QUERY_TOKENS = 7000;
+const TOKENS_PER_ASCII_CHAR = 1;
+const TOKENS_PER_NON_ASCII_CHAR = 4;
+
+/** Upper-bound token estimate. Deliberately pessimistic — over-clipping a query
+ *  is cheap, a rejected request is not. */
+export function estimateEmbeddingTokens(text: string): number {
+  let tokens = 0;
+  for (const char of text) {
+    tokens +=
+      char.codePointAt(0)! < 128
+        ? TOKENS_PER_ASCII_CHAR
+        : TOKENS_PER_NON_ASCII_CHAR;
+  }
+  return Math.ceil(tokens);
+}
+
+/** Clip to the token budget, cutting on a code-point boundary so the result can
+ *  never end in a lone surrogate. */
+export function clipToEmbeddingBudget(text: string): string {
+  if (estimateEmbeddingTokens(text) <= MAX_EMBEDDING_QUERY_TOKENS) {
+    return text;
+  }
+  let tokens = 0;
+  let out = "";
+  for (const char of text) {
+    tokens +=
+      char.codePointAt(0)! < 128
+        ? TOKENS_PER_ASCII_CHAR
+        : TOKENS_PER_NON_ASCII_CHAR;
+    if (tokens > MAX_EMBEDDING_QUERY_TOKENS) break;
+    out += char;
+  }
+  return out;
+}
+
 export async function queryMemoryModelEmbedding(
   config: MemoryModelClientConfig,
   query: MemoryModelEmbeddingQuery,
@@ -502,10 +594,14 @@ export async function queryMemoryModelEmbedding(
   if (!baseUrl || !modelId || apiStyle !== "openai_compatible") {
     return null;
   }
-  const normalizedInput = query.input.trim();
-  if (!normalizedInput) {
+  const trimmedInput = query.input.trim();
+  if (!trimmedInput) {
     return null;
   }
+  // Only a query may be narrowed; a document must reach the model whole or not

```

**File**: `runtime/api-server/src/memory-recall-manifest.ts` (modified, +1/-0)
```diff
@@ -486,6 +486,7 @@ async function planRecallFromVectorIndex(params: {
     return null;
   }
   const queryEmbedding = await queryMemoryModelEmbedding(params.embeddingClient, {
+    purpose: "query",
     input: params.query,
     timeoutMs: 5000,
   });
```

**File**: `runtime/api-server/src/workspace-attachment-memory.ts` (modified, +4/-0)
```diff
@@ -2242,6 +2242,7 @@ async function syncAttachmentNodeEmbedding(params: {
     return;
   }
   const embedding = await queryMemoryModelEmbedding(params.embeddingClient, {
+    purpose: "document",
     input: embeddingText,
     timeoutMs: 7000,
     agentRole: "memory-embedding",
@@ -2334,6 +2335,7 @@ async function syncToolResultNodeEmbedding(params: {
     return;
   }
   const embedding = await queryMemoryModelEmbedding(params.embeddingClient, {
+    purpose: "document",
     input: embeddingText,
     timeoutMs: 7000,
     agentRole: "memory-embedding",
@@ -2388,6 +2390,7 @@ async function syncImageUrlNodeEmbedding(params: {
     return;
   }
   const embedding = await queryMemoryModelEmbedding(params.embeddingClient, {
+    purpose: "document",
     input: embeddingText,
     timeoutMs: 7000,
     agentRole: "memory-embedding",
@@ -2461,6 +2464,7 @@ async function syncOutputNodeEmbedding(params: {
     return;
   }
   const embedding = await queryMemoryModelEmbedding(params.embeddingClient, {
+    purpose: "document",
     input: embeddingText,
     timeoutMs: 7000,
     agentRole: "memory-embedding",
```

**File**: `runtime/api-server/src/workspace-memory.ts` (modified, +1/-0)
```diff
@@ -1007,6 +1007,7 @@ async function queryWorkspaceEmbeddingVector(params: {
     return null;
   }
   const embedding = await queryMemoryModelEmbedding(client, {
+    purpose: "query",
     input: params.query,
     timeoutMs: 7000,
     agentRole: "memory-embedding",
```

---

### Incident Patch 3: `86499503` (2026-08-21)
**Commit Message**: fix(desktop): follow tools/list pagination so an app's later tools reach the agent (#543)

* fix(desktop): follow tools/list pagination so an app's later tools reach the agent

MCP `tools/list` is paginated — a server with more tools than fit in one response
returns a `nextCursor` and the rest are only reachable by asking again with it.
The desktop read `result.tools` and stopped, so any server whose tools spanned
more than one page had the remainder dropped.

That silently disables tools. The enumerated names are written into
`mcp_registry.allowlist.tool_ids`, and the pi harness filters the agent's tools to
that allowlist, so an un-enumerated tool is simply absent — no error is raised
anywhere. It is why an app could offer `upload_image` while `create_post` was
missing for the whole install: both discovery caches are keyed per app and cleared
only on uninstall, so the truncated list was pinned once written.

- `fetchAllMcpToolNames` follows the cursor, de-duplicates across pages, stops if a
  server repeats a cursor, and is bounded by a 20-page cap so a misbehaving server
  cannot spin discovery forever.
- it reports `complete`, and both call sites — the web-HolaApp and marketplac

**File**: `apps/desktop/electron/main.ts` (modified, +108/-62)
```diff
@@ -224,6 +224,10 @@ import {
   runtimeErrorFromBody,
 } from "@holaboss/runtime-client";
 import { installBffFetchHandler } from "./bff-fetch.js";
+import {
+  fetchAllMcpToolNames,
+  parseMcpToolsListResponse,
+} from "./mcp-tools-list.js";
 import {
   createComposioEventsBridge,
   type ComposioEventsBridge,
@@ -19259,51 +19263,67 @@ function asYamlRecord(value: unknown): Record<string, unknown> {
 // network round-trip on every per-turn re-attach; cleared on uninstall.
 const webHolaAppToolCache = new Map<string, string[]>();
 
-function parseMcpToolsListResponse(text: string): string[] {
-  const fromJson = (raw: string): string[] | null => {
-    try {
-      const obj = JSON.parse(raw) as {
-        result?: { tools?: Array<{ name?: unknown }> };
-      };
-      const tools = obj?.result?.tools;
-      if (Array.isArray(tools)) {
-        return tools
-          .map((tool) => tool?.name)
-          .filter((name): name is string => typeof name === "string");
-      }
-    } catch {
-      // not plain JSON — could be an SSE stream; fall through
-    }
+/**
+ * Short-lived cache for INCOMPLETE discoveries.
+ *
+ * Complete lists are cached until uninstall. Incomplete ones must not be — a
+ * truncated list cached that long is the bug this module exists to prevent — but
+ * refusing to cache them at all means a server that reliably fails page 2 is
+ * re-walked on EVERY turn (the attach loops run before each one), which is a
+ * worse trade on the hot path. Hold the partial result briefly instead: the agent
+ * still gets the tools we did read, the allowlist still unions rather than
+ * replaces, and the server is retried about once a minute rather than per turn.
+ */
+const INCOMPLETE_TOOL_CACHE_TTL_MS = 60_000;
+type IncompleteToolsEntry = { tools: string[]; expiresAt: number };
+const webHolaAppIncompleteToolCache = new Map<string, IncompleteToolsEntry>();
+const marketplaceIncompleteToolCache = new Map<string, IncompleteToolsEntry>();
+
+function readIncompleteToolCache(
+  cache: Map<string, IncompleteToolsEntry>,
+  key: string,
+): string[] | null {
+  const entry = cache.get(key);
+  if (!entry) return null;
+  if (Date.now() >= entry.expiresAt) {
+    cache.delete(key);
     return null;
-  };
-  const direct = fromJson(text);
-  if (direct) {
-    return direct;
-  }
-  // Streamable HTTP may answer with an SSE stream of `data:` events.
-  for (const line of text.split(/\r?\n/)) {
-    const match = line.match(/^data:\s*(.*)$/);
-    if (match) {
-      const parsed = fromJson(match[1]);
-      if (parsed) {
-        return parsed;
-      }
-    }
   }
-  return [];
+  return entry.tools;
+}
+
+function writeIncompleteToolCache(
+  cache: Map<string, IncompleteToolsEntry>,
+  key: string,
+  tools: string[],
+): void {
+  cache.set(key, {
+    tools,
+    expiresAt: Date.now() + INCOMPLETE_TOOL_CACHE_TTL_MS,
+  });
 }
 
+// `tools/list` enumeration (including pagination) lives in ./mcp-tools-list.ts so
+// it can be tested against a stubbed transport — see the import at the top.
+
 // Discover a web HolaApp's MCP tool names (cached) via the same initialize + tools/list the
 // runtime's MCP client does. Needed to enumerate the app's tools into the workspace.yaml
 // allowlist (see attachWebHolaAppMcp): the pi ("Hola") harness builds its tool allowlist
 // from those refs, so un-enumerated tools are silently filtered out of the agent.
-async function discoverWebHolaAppMcpTools(holaAppId: string): Promise<string[]> {
+async function discoverWebHolaAppMcpTools(
+  holaAppId: string,
+): Promise<{ tools: string[]; complete: boolean }> {
   const cached = webHolaAppToolCache.get(holaAppId);
   if (cached) {
-    return cached;
+    // Only complete lists are ever cached (below), so a hit is complete.
+    return { tools: cached, complete: true };
+  }
+  const partial = readIncompleteToolCache(webHolaAppIncompleteToolCache, holaAppId);
+  if (partial) {
+    return { tools: partial, complete: false };
   }
   if (!WEB_HOLAAPP_MCP_BASE_URL) {
-    return [];
+    return { tools: [], complete: false };
   }
   const url = `${WEB_HOLAAPP_MCP_BASE_URL}/mcp/${encodeURIComponent(holaAppId)}/mcp`;
   const bearer = authBearerToken();
@@ -19329,23 +19349,24 @@ async function discoverWebHolaAppMcpTools(holaAppId: string): Promise<string[]>
       }),
     }).catch(() => null);
     const sessionId = init?.headers.get("mcp-session-id") ?? undefined;
-    const resp = await fetch(url, {
-      method: "POST",
-      headers: { ...headers, ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}) },
-      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
+    const { tools, complete } = await fetchAllMcpToolNames({
+      url,
+      headers,
+      sessionId,
+      label: `[web-holaapp] ${holaAppId}`,
     });
-    if (!resp.ok) {
-      console.warn(`[web-holaapp] tools/list for ${holaAppId} → ${resp.status}`);
-      return [];
-    }
-    const tools = parseMcpToolsList
```

**File**: `apps/desktop/electron/mcp-tools-list.test.ts` (added, +276/-0)
```diff
@@ -0,0 +1,276 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+
+import {
+  MAX_MCP_TOOLS_LIST_PAGES,
+  MCP_TOOLS_LIST_PAGE_TIMEOUT_MS,
+  fetchAllMcpToolNames,
+  parseMcpToolsListPage,
+  parseMcpToolsListResponse,
+} from "./mcp-tools-list.js";
+
+/** A transport that answers each `tools/list` with the next scripted page. */
+function scriptedFetch(
+  pages: Array<{ tools: string[]; nextCursor?: string | null; status?: number }>,
+) {
+  const cursors: Array<string | undefined> = [];
+  let call = 0;
+  const impl = (async (_url: string, init?: RequestInit) => {
+    const body = JSON.parse(String(init?.body ?? "{}")) as {
+      params?: { cursor?: string };
+    };
+    cursors.push(body.params?.cursor);
+    const page = pages[Math.min(call, pages.length - 1)];
+    call += 1;
+    if (page.status && page.status >= 400) {
+      return { ok: false, status: page.status, text: async () => "" } as Response;
+    }
+    return {
+      ok: true,
+      status: 200,
+      text: async () =>
+        JSON.stringify({
+          jsonrpc: "2.0",
+          result: {
+            tools: page.tools.map((name) => ({ name })),
+            ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
+          },
+        }),
+    } as Response;
+  }) as unknown as typeof fetch;
+  return { impl, cursors, calls: () => call };
+}
+
+const BASE = { url: "https://app.example/mcp", headers: {}, label: "[test]" };
+
+test("parseMcpToolsListPage carries nextCursor out of the body", () => {
+  const page = parseMcpToolsListPage(
+    JSON.stringify({ result: { tools: [{ name: "a" }], nextCursor: "c1" } }),
+  );
+  assert.deepEqual(page, { tools: ["a"], nextCursor: "c1" });
+});
+
+test("parseMcpToolsListPage reads an SSE-framed body", () => {
+  const page = parseMcpToolsListPage(
+    `event: message\ndata: ${JSON.stringify({ result: { tools: [{ name: "b" }], nextCursor: "c2" } })}\n\n`,
+  );
+  assert.deepEqual(page, { tools: ["b"], nextCursor: "c2" });
+});
+
+test("parseMcpToolsListPage treats a missing/empty cursor as the end", () => {
+  assert.equal(
+    parseMcpToolsListPage(JSON.stringify({ result: { tools: [] } }))?.nextCursor,
+    null,
+  );
+  assert.equal(
+    parseMcpToolsListPage(
+      JSON.stringify({ result: { tools: [], nextCursor: "" } }),
+    )?.nextCursor,
+    null,
+  );
+});
+
+test("parseMcpToolsListPage returns null when there is no tools array to read", () => {
+  // Distinct from a page that legitimately has zero tools — see the callers.
+  assert.equal(parseMcpToolsListPage("not json at all"), null);
+  assert.equal(
+    parseMcpToolsListPage(JSON.stringify({ error: { code: -32601 } })),
+    null,
+  );
+});
+
+test("parseMcpToolsListResponse still returns just the names", () => {
+  assert.deepEqual(
+    parseMcpToolsListResponse(
+      JSON.stringify({ result: { tools: [{ name: "x" }, { name: "y" }] } }),
+    ),
+    ["x", "y"],
+  );
+});
+
+/**
+ * The regression: a server whose tools span two pages used to yield only page one,
+ * and the missing names were then filtered out of the agent's allowlist with no
+ * error anywhere — `upload_image` present, `create_post` simply absent.
+ */
+test("fetchAllMcpToolNames follows the cursor across pages", async () => {
+  const { impl, cursors } = scriptedFetch([
+    { tools: ["upload_image"], nextCursor: "page2" },
+    { tools: ["create_post"] },
+  ]);
+
+  const result = await fetchAllMcpToolNames({ ...BASE, fetchImpl: impl });
+
+  assert.deepEqual(result.tools, ["upload_image", "create_post"]);
+  assert.equal(result.complete, true);
+  // First request carries no cursor; the second echoes the server's.
+  assert.deepEqual(cursors, [undefined, "page2"]);
+});
+
+test("fetchAllMcpToolNames reports incomplete when a later page fails", async () => {
+  const { impl } = scriptedFetch([
+    { tools: ["first"], nextCursor: "page2" },
+    { tools: [], status: 500 },
+  ]);
+
+  const result = await fetchAllMcpToolNames({
+    ...BASE,
+    fetchImpl: impl,
+    log: () => {},
+  });
+
+  // The names we did get are still returned — but `complete` is false so the
+  // caller must not cache a truncated set.
+  assert.deepEqual(result.tools, ["first"]);
+  assert.equal(result.complete, false);
+});
+
+test("fetchAllMcpToolNames de-duplicates names repeated across pages", async () => {
+  const { impl } = scriptedFetch([
+    { tools: ["dup", "a"], nextCursor: "page2" },
+    { tools: ["dup", "b"] },
+  ]);
+
+  const result = await fetchAllMcpToolNames({ ...BASE, fetchImpl: impl });
+
+  assert.deepEqual(result.tools, ["dup", "a", "b"]);
+});
+
+test("a repeated cursor stops the loop AND reports incomplete", async () => {
+  // A server reusing a cursor is looping. Stopping is right; calling it complete
+  // is not — the remaining pages were never read, and a "complete" partial list
+  // gets cached until uninstall, which is the bug this module exists to prevent.
+  const { impl, calls } = scriptedF
```

**File**: `apps/desktop/electron/mcp-tools-list.ts` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+/**
+ * MCP `tools/list` enumeration, including pagination.
+ *
+ * Why this is its own module: the names returned here are written into
+ * `mcp_registry.allowlist.tool_ids`, and the pi harness filters the agent's tools
+ * to that allowlist — so a tool that never got enumerated is silently unavailable
+ * to the agent, with no error raised anywhere. `tools/list` is paginated (a server
+ * with more tools than fit in one response returns a `nextCursor`), and reading
+ * only the first page is why an app could offer `upload_image` while `create_post`
+ * was simply absent.
+ *
+ * Split out of main.ts so this can be tested against a stubbed transport rather
+ * than by pattern-matching source text.
+ */
+
+/** One page of a `tools/list` response. */
+export type McpToolsListPage = { tools: string[]; nextCursor: string | null };
+
+/**
+ * How many pages to follow before giving up. Bounded so a server that keeps
+ * handing back a cursor cannot spin discovery forever.
+ */
+export const MAX_MCP_TOOLS_LIST_PAGES = 20;
+
+/**
+ * Per-page request timeout. Discovery runs on the pre-turn hot path (every attach
+ * loop before a turn), and pagination multiplies any slowness by the page count —
+ * so an unbounded request could stall a turn behind a server that never answers.
+ */
+export const MCP_TOOLS_LIST_PAGE_TIMEOUT_MS = 10_000;
+
+/**
+ * Parse one `tools/list` response body, keeping the cursor.
+ *
+ * Handles both a plain JSON-RPC body and the Streamable-HTTP variant, where the
+ * server answers with an SSE stream of `data:` events.
+ */
+export function parseMcpToolsListPage(text: string): McpToolsListPage | null {
+  const fromJson = (raw: string): McpToolsListPage | null => {
+    try {
+      const obj = JSON.parse(raw) as {
+        result?: { tools?: Array<{ name?: unknown }>; nextCursor?: unknown };
+      };
+      const tools = obj?.result?.tools;
+      if (Array.isArray(tools)) {
+        const cursor = obj?.result?.nextCursor;
+        return {
+          tools: tools
+            .map((tool) => tool?.name)
+            .filter((name): name is string => typeof name === "string"),
+          nextCursor:
+            typeof cursor === "string" && cursor.length > 0 ? cursor : null,
+        };
+      }
+    } catch {
+      // not plain JSON — could be an SSE stream; fall through
+    }
+    return null;
+  };
+
+  const direct = fromJson(text);
+  if (direct) {
+    return direct;
+  }
+  for (const line of text.split(/\r?\n/)) {
+    const match = line.match(/^data:\s*(.*)$/);
+    if (match) {
+      const parsed = fromJson(match[1]);
+      if (parsed) {
+        return parsed;
+      }
+    }
+  }
+  // Nothing that looks like a tools/list result — an error body, a truncated
+  // stream, HTML from a proxy. NOT the same as "a page with no tools", and the
+  // difference matters: an empty page is a complete answer, an unparseable one
+  // means we never learned what this server exposes.
+  return null;
+}
+
+/** Tool names from a single response, for callers that don't paginate. */
+export function parseMcpToolsListResponse(text: string): string[] {
+  return parseMcpToolsListPage(text)?.tools ?? [];
+}
+
+export type FetchAllMcpToolNamesParams = {
+  url: string;
+  headers: Record<string, string>;
+  sessionId?: string;
+  /** Prefix for warnings, e.g. `[web-holaapp] <id>`. */
+  label: string;
+  fetchImpl?: typeof fetch;
+  log?: (message: string) => void;
+  /** Per-page timeout; see MCP_TOOLS_LIST_PAGE_TIMEOUT_MS. */
+  timeoutMs?: number;
+};
+
+/**
+ * Enumerate EVERY tool a server exposes, following `tools/list` pagination.
+ *
+ * `complete` reports whether the whole list was read. Callers MUST NOT cache a
+ * partial list: the desktop's tool caches are only cleared on uninstall, so a
+ * transient failure mid-pagination would otherwise pin the truncated tool set for
+ * the rest of the install.
+ */
+export async function fetchAllMcpToolNames(
+  params: FetchAllMcpToolNamesParams,
+): Promise<{ tools: string[]; complete: boolean }> {
+  const doFetch = params.fetchImpl ?? fetch;
+  const warn = params.log ?? ((message: string) => console.warn(message));
+  const names: string[] = [];
+  const seen = new Set<string>();
+  const seenCursors = new Set<string>();
+  let cursor: string | null = null;
+
+  for (let page = 0; page < MAX_MCP_TOOLS_LIST_PAGES; page += 1) {
+    // Every early exit below keeps the names gathered so far and reports
+    // complete:false. Returning what we have beats returning nothing — but it
+    // must never be mistaken for the whole list, or a caller caches a truncated
+    // set (these caches only clear on uninstall) and the missing tools stay
+    // invisible to the agent for the rest of the install.
+    let body: string;
+    try {
+      const resp = await doFetch(params.url, {
+        method: "POST",
+        // Bound each page independently: a 20-page walk must not become a
+        // 20x-unbounded stall in front of the 
```

---

### Incident Patch 4: `2f8ce70f` (2026-08-21)
**Commit Message**: fix(desktop): make the post-connect hook refresh tools instead of calling a deleted route (#542)

* fix(desktop): make the post-connect hook refresh tools instead of calling a deleted route

Connecting an integration from chat ran exactly one step to make its tools
reachable — `composioMcpEnsureRunning` — and that step had been dead for some
time. It POSTs to `/api/v1/composio-mcp/ensure-running`, a route the api-server
does not register (Composio tools moved inline; the runtime now deletes the
legacy `holaboss_composio` registry entry). Every call 404'd straight into the
callers' `catch {}`.

With that step silently doing nothing, the runtime kept serving its cached
Composio tool listing for the full 15 min TTL. Production transcripts show the
result: the user connects X, the agent says "publishing now", then "send me one
more message", then "the publish tool is still loading after the integration host
restarted" — and the post is never sent. There is no integration host to restart.

Delegate to `refreshWorkspaceMcpTools`, which posts the live
`/api/v1/capabilities/runtime-tools/mcp/refresh` capability — the same one the
agent's `mcp_refresh` tool uses. That drops the workspace's 

**File**: `apps/desktop/electron/composio-connect-refresh.test.mjs` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+import assert from "node:assert/strict";
+import { readFile } from "node:fs/promises";
+import test from "node:test";
+
+const MAIN_PATH = new URL("./main.ts", import.meta.url);
+
+/**
+ * The body of a top-level function, from its signature to the next one.
+ *
+ * Matching with an unbounded `[\s\S]*?` across a 30k-line file is not a guard:
+ * it happily spans unrelated code, so a function repointed at a dead route still
+ * "passes" as long as the live path is mentioned ANYWHERE later in the file.
+ * That was demonstrated against the first version of this test.
+ */
+async function functionBody(name) {
+  const lines = (await readFile(MAIN_PATH, "utf8")).split("\n");
+  const signature = new RegExp(`^(?:export\\s+)?(?:async\\s+)?function ${name}\\b`);
+  const start = lines.findIndex((line) => signature.test(line));
+  if (start === -1) return null;
+  let end = lines.length;
+  for (let i = start + 1; i < lines.length; i += 1) {
+    if (/^(?:export\s+)?(?:async\s+)?function [\w$]+/.test(lines[i])) {
+      end = i;
+      break;
+    }
+  }
+  return lines.slice(start, end).join("\n");
+}
+
+/**
+ * The post-connect hook has to target a capability the runtime actually serves.
+ *
+ * `/api/v1/composio-mcp/ensure-running` was removed when Composio tools moved
+ * inline (the runtime now deletes the legacy `holaboss_composio` registry
+ * entry), but the desktop kept POSTing to it. Every call 404'd into the callers'
+ * `catch {}`, so the only step that made a just-connected integration's tools
+ * reachable silently did nothing — the runtime went on serving its cached tool
+ * listing and the agent reported the publish tool as "still loading" turn after
+ * turn.
+ *
+ * A dead endpoint fails silently by construction, so pin the live one.
+ */
+test("the post-connect hook refreshes tools instead of calling the deleted composio-mcp host", async () => {
+
+  const body = await functionBody("composioMcpEnsureRunning");
+  assert.ok(body, "composioMcpEnsureRunning not found — did the signature change?");
+  // Pin the DELEGATION, not the signature: tightening the return type is a
+  // behaviour-preserving improvement and must not fail this guard.
+  assert.ok(
+    body.includes("return refreshWorkspaceMcpTools(workspaceId);"),
+    "composioMcpEnsureRunning must delegate to refreshWorkspaceMcpTools",
+  );
+});
+
+test("nothing in the main process posts to the deleted composio-mcp route", async () => {
+  const source = await readFile(MAIN_PATH, "utf8");
+  const offending = source
+    .split("\n")
+    .map((line, index) => ({ line, number: index + 1 }))
+    .filter(
+      ({ line }) =>
+        line.includes("composio-mcp/ensure-running") && !line.trimStart().startsWith("*"),
+    )
+    .map(({ number }) => `main.ts:${number}`);
+
+  assert.deepEqual(
+    offending,
+    [],
+    `these call a route the api-server does not register, so they 404 silently:\n${offending.join("\n")}`,
+  );
+});
+
+/**
+ * The refresh helper is what makes the hook above worth calling: it drops the
+ * workspace's MCP tool cache AND the cached Composio listing. If it ever stops
+ * pointing at that capability, the hook goes quiet again.
+ */
+test("refreshWorkspaceMcpTools targets the runtime-tools refresh capability", async () => {
+  const body = await functionBody("refreshWorkspaceMcpTools");
+
+  assert.ok(body, "refreshWorkspaceMcpTools not found — did the signature change?");
+  assert.ok(
+    body.includes('path: "/api/v1/capabilities/runtime-tools/mcp/refresh"'),
+    "the refresh helper no longer posts the live capability, so the post-connect hook is inert again",
+  );
+});
```

**File**: `apps/desktop/electron/main.ts` (modified, +21/-5)
```diff
@@ -11873,12 +11873,28 @@ async function composioDeleteUpstream(
   }
 }
 
+/**
+ * Post-connect / post-install hook: make newly available tools reachable.
+ *
+ * The composio-mcp host this used to start no longer exists. Composio tools are
+ * resolved inline now, and the runtime actively removes the legacy
+ * `holaboss_composio` registry entry — so `/api/v1/composio-mcp/ensure-running`
+ * has had no route for some time and every call here 404'd straight into the
+ * callers' `catch {}`.
+ *
+ * That silently removed the only step that made a just-connected integration's
+ * tools reachable: the runtime kept serving its cached tool listing (15 min TTL),
+ * so the agent reported the publish tool as "still loading" turn after turn and
+ * users abandoned the task.
+ *
+ * Refreshing is the live equivalent — it drops the workspace's MCP tool cache and
+ * the cached Composio listing, so the next turn re-resolves both. Kept under the
+ * original name so the three renderer call sites (chat connect proposal, add-app,
+ * marketplace install) keep working; the name is stale and worth retiring
+ * separately.
+ */
 async function composioMcpEnsureRunning(workspaceId: string): Promise<unknown> {
-  return requestRuntimeJson<unknown>({
-    method: "POST",
-    path: "/api/v1/composio-mcp/ensure-running",
-    payload: { workspace_id: workspaceId },
-  });
+  return refreshWorkspaceMcpTools(workspaceId);
 }
 
 /**
```

---

### Incident Patch 5: `aa5e3ebf` (2026-08-21)
**Commit Message**: fix(runtime): invalidate the Composio tool listing when the resolved tool set changes (#540)

* fix(runtime): invalidate the Composio tool listing when the resolved tool set changes

The inline Composio tool listing is cached per workspace with a 15 min TTL, and
that TTL was raised from 120 s on the stated assumption that "connection
mutations made through this runtime now invalidate explicitly". Three in-runtime
paths that change the resolved tool set never did, so each served a stale listing
for the whole window.

Why a stale listing is a correctness bug, not just latency: the inline tool binds
`connected_account_id` into its execute body (composio-inline-tools.ts), so a
listing that outlives a default-account change makes the agent act as the
PREVIOUS account.

- `mcp_refresh` (runtime-agent-tools) cleared ONLY the pi MCP tool cache. Composio
  integrations are not MCP servers — composio-tool-registry actively removes the
  legacy `holaboss_composio` registry entry, and tools arrive via
  resolveComposioInlineTools — so the tool was a no-op for exactly the case an
  agent reaches for it: a just-connected integration whose tools are missing. It
  sets requires_session_refresh (en

**File**: `runtime/api-server/src/app.ts` (modified, +5/-1)
```diff
@@ -8437,7 +8437,11 @@ export function buildRuntimeApiServer(options: BuildRuntimeApiServerOptions = {}
         return {
           provider_id: requiredString(body.provider_id, "provider_id").toLowerCase(),
           connection_id: result.connection_id,
-          note: "Workspace default updated. The composio-mcp host has restarted; the new account's tools become available to the agent starting from the next user turn.",
+          // This note is a TOOL RESULT — it lands in the transcript on every call
+          // and the model repeats it to the user, so it has to be true. There is
+          // no composio-mcp host to restart (Composio is resolved inline); what
+          // actually happens is the cached listing is dropped, above.
+          note: "Workspace default updated. The cached integration tool listing was dropped; the new account's tools resolve from your next turn.",
         };
       } catch (error) {
         return sendError(
```

**File**: `runtime/api-server/src/composio-cache-invalidation.test.ts` (modified, +174/-0)
```diff
@@ -7,6 +7,7 @@ import { afterEach, test } from "node:test";
 
 import { composioInlineCachePath } from "../../harnesses/src/composio-inline-cache.js";
 import { invalidateComposioInlineToolCache } from "./composio-cache-invalidation.js";
+import { WorkspaceIntegrationsService } from "./workspace-integrations.js";
 
 const here = path.dirname(fileURLToPath(import.meta.url));
 const tempDirs: string[] = [];
@@ -83,6 +84,106 @@ test("a store that cannot list workspaces is survivable", () => {
   assert.equal(invalidateComposioInlineToolCache(hostile), 0);
 });
 
+/**
+ * A class method's body, from its signature to the next sibling method. Scoping
+ * to the method (rather than a fixed line window) keeps these guards honest in
+ * two directions: a coarser-grained invalidation further down the same method
+ * still counts, and an invalidation belonging to a DIFFERENT method never does.
+ */
+function methodBody(file: string, name: string): string | null {
+  const lines = fs.readFileSync(path.join(here, file), "utf8").split("\n");
+  const signature = new RegExp(
+    `^\\s{2}(?:async\\s+|public\\s+|private\\s+|protected\\s+)*${name}\\s*\\(`,
+  );
+  const start = lines.findIndex((line) => signature.test(line));
+  if (start === -1) return null;
+
+  const sibling = /^\s{2}(?:async\s+|public\s+|private\s+|protected\s+|static\s+)*[\w$]+\s*[(<]/;
+  let end = lines.length;
+  for (let i = start + 1; i < lines.length; i += 1) {
+    if (sibling.test(lines[i]!)) {
+      end = i;
+      break;
+    }
+  }
+  return lines.slice(start, end).join("\n");
+}
+
+/**
+ * STRUCTURAL guard — the agent's own recovery action.
+ *
+ * `mcp_refresh` is what an agent reaches for when a just-connected integration's
+ * tools are missing. It used to clear ONLY the pi MCP cache, but Composio
+ * integrations are not MCP servers, so the stale inline listing survived and the
+ * next turn re-read it — the tool ended the turn ("send one more message") and
+ * changed nothing, once per turn, until the TTL expired.
+ */
+test("mcp_refresh also drops the Composio inline listing", () => {
+  const body = methodBody("runtime-agent-tools.ts", "refreshMcpTools");
+
+  assert.ok(body, "refreshMcpTools not found — did the signature change?");
+  assert.ok(
+    body.includes("invalidateComposioInlineToolCache("),
+    "mcp_refresh clears the pi cache without dropping the integration listing, so a newly connected integration stays invisible",
+  );
+});
+
+/**
+ * STRUCTURAL guard — the workspace-default account binding.
+ *
+ * The default binding decides which account the toolkit resolver picks, and the
+ * listing binds connected_account_id into each tool's execute body — so a stale
+ * one makes the agent act as the PREVIOUS account. Neither write goes through
+ * upsert/deleteIntegrationConnection, so the connection guard cannot see them.
+ *
+ * File-wide here (not method-scoped): this file exists only to manage the
+ * workspace default, so any binding write in it must invalidate.
+ */
+test("workspace-default binding writes invalidate the listing", () => {
+  const lines = fs
+    .readFileSync(path.join(here, "workspace-integrations.ts"), "utf8")
+    .split("\n");
+  const offenders: string[] = [];
+
+  for (let i = 0; i < lines.length; i += 1) {
+    if (!/\.(upsertIntegrationBinding|deleteIntegrationBinding)\(/.test(lines[i]!)) {
+      continue;
+    }
+    const window = lines.slice(i, i + 30).join("\n");
+    if (!window.includes("invalidateComposioInlineToolCache(")) {
+      offenders.push(`workspace-integrations.ts:${i + 1}`);
+    }
+  }
+
+  assert.deepEqual(
+    offenders,
+    [],
+    `these default-account writes leave a stale inline tool listing behind:\n${offenders.join("\n")}`,
+  );
+});
+
+/**
+ * STRUCTURAL guard — the generic binding routes.
+ *
+ * `PUT/DELETE /api/v1/integrations/bindings/…` accept targetType
+ * "workspace_default" (validateTargetType), so they can change the resolved
+ * account just like the dedicated service above.
+ *
+ * Method-scoped on purpose: a file-wide scan would flag `mergeConnections`,
+ * whose per-binding writes are correctly covered by ONE invalidation after the
+ * whole merge — further away than any fixed line window.
+ */
+test("the generic binding routes invalidate on workspace_default writes", () => {
+  for (const method of ["upsertBinding", "deleteBinding"]) {
+    const body = methodBody("integrations.ts", method);
+    assert.ok(body, `${method} not found — did the signature change?`);
+    assert.ok(
+      body.includes("invalidateComposioInlineToolCache("),
+      `integrations.${method} can write a workspace_default binding without dropping the stale listing`,
+    );
+  }
+});
+
 /**
  * STRUCTURAL guard, and the point of the whole change.
  *
@@ -119,3 +220,76 @@ test("every integration-connection write invalidates the cache", () => {
     `these connection writes leave a stale inline tool listing behind:\n${offenders.join("\n")}`,
   );
 });
+
+/**
+ * BEHAVI
```

**File**: `runtime/api-server/src/integrations.ts` (modified, +13/-0)
```diff
@@ -279,6 +279,14 @@ export class RuntimeIntegrationService {
       connectionId,
       isDefault
     });
+    // A workspace_default binding is what the composio toolkit resolver reads to
+    // choose an account, so writing one changes the listed tool set. The listing
+    // also binds connected_account_id into each tool's execute body, so serving a
+    // stale one makes the agent act as the PREVIOUS account. App bindings don't
+    // feed that listing, so they don't need the churn.
+    if (targetType === "workspace_default") {
+      invalidateComposioInlineToolCache(this.store);
+    }
 
     if (!existing) {
       try {
@@ -313,6 +321,11 @@ export class RuntimeIntegrationService {
     if (!deleted) {
       throw new IntegrationServiceError(404, "binding not found");
     }
+    // Dropping the workspace default falls resolution back to another account,
+    // so the cached listing (and the account bound into it) is now wrong.
+    if (binding.targetType === "workspace_default") {
+      invalidateComposioInlineToolCache(this.store);
+    }
     return { deleted: true };
   }
 
```

**File**: `runtime/api-server/src/runtime-agent-tools.ts` (modified, +15/-2)
```diff
@@ -39,6 +39,7 @@ import {
   writeMcpAuthRequiredMarker,
 } from "../../harnesses/src/index.js";
 import { buildAppSetupEnv } from "./app-setup-env.js";
+import { invalidateComposioInlineToolCache } from "./composio-cache-invalidation.js";
 import { listHarnessAvailability } from "./harness-availability.js";
 import { resolveRuntimeHarnessPlugin } from "./harness-registry.js";
 import {
@@ -7819,20 +7820,32 @@ export class RuntimeAgentToolsService {
    * so the fresh tools apply from the next message — note that
    * buildSessionRefreshFields is for NEW servers (empty here) and returns {}, so
    * the flag is set directly.
+   *
+   * This ALSO drops the Composio inline tool listing. Composio integrations are
+   * not MCP servers (composio-tool-registry removes any legacy entry), so they
+   * are cached separately; clearing only the pi cache made this tool a no-op for
+   * exactly the case an agent reaches for it — a just-connected integration whose
+   * tools are missing. The agent would end the turn, the next turn would re-read
+   * the same stale listing, and the loop repeated until the 15 min TTL expired.
    */
   refreshMcpTools(params: { workspaceId: string }): JsonObject {
     this.requireWorkspace(params.workspaceId);
     const workspaceDir = this.store.workspaceDir(params.workspaceId);
     const cacheCleared = clearPiMcpToolCache(workspaceDir);
+    const integrationsCleared = invalidateComposioInlineToolCache(this.store);
     const servers = [...readWorkspaceMcpRegistryServerNames(workspaceDir)];
     return {
       refreshed: true,
       cache_cleared: cacheCleared,
+      // Counts cache FILES removed, which is 0 when nothing had been cached yet —
+      // that is a no-op, not a failure. Named so the model doesn't read a 0 as
+      // "the refresh didn't work" and tell the user so.
+      integration_cache_files_removed: integrationsCleared,
       servers,
-      note: "MCP tool cache cleared for this workspace. All connected MCP servers are re-discovered on your NEXT turn — ask the user to send one more message.",
+      note: "MCP tool cache and integration tool listing cleared for this workspace. Connected MCP servers and integrations are re-discovered on your NEXT turn — ask the user to send one more message.",
       requires_session_refresh: true,
       session_refresh_note:
-        "The MCP tool cache was invalidated; re-discovered tools apply from the next user message. End this turn now.",
+        "The MCP tool and integration caches were invalidated; re-discovered tools apply from the next user message. End this turn now.",
     };
   }
 
```

**File**: `runtime/api-server/src/workspace-integrations.ts` (modified, +9/-0)
```diff
@@ -1,5 +1,6 @@
 import type { RuntimeStateStore } from "@holaboss/runtime-state-store";
 
+import { invalidateComposioInlineToolCache } from "./composio-cache-invalidation.js";
 import { resolveConnectionMerged } from "./integration-connections-merged.js";
 
 export class WorkspaceIntegrationsService {
@@ -67,6 +68,11 @@ export class WorkspaceIntegrationsService {
       connectionId: params.connectionId,
       isDefault: true,
     });
+    // The default binding decides WHICH account's tools the listing resolves
+    // (see the composio toolkit resolver's workspace_default lookup), so changing
+    // it changes the tool set just as much as connecting does — drop the cached
+    // listing or the previous account's tools stay in front of the agent.
+    invalidateComposioInlineToolCache(this.store);
     return { connection_id: params.connectionId };
   }
 
@@ -82,6 +88,9 @@ export class WorkspaceIntegrationsService {
     });
     if (!existing) return { deleted: false };
     this.store.deleteIntegrationBinding(existing.bindingId);
+    // Clearing the default falls resolution back to another account, so the
+    // listing changes here too.
+    invalidateComposioInlineToolCache(this.store);
     return { deleted: true };
   }
 }
```

**File**: `runtime/harnesses/src/runtime-agent-tools.ts` (modified, +2/-2)
```diff
@@ -277,7 +277,7 @@ export const RUNTIME_AGENT_TOOL_DEFINITIONS = [
   {
     id: "holaboss_workspace_integrations_set_default_account",
     description:
-      "Set the workspace's default account for a Composio provider when the user has multiple active accounts for the same toolkit (e.g. two Gmail accounts, three GitHub accounts). This binding persists across sessions and devices for the same workspace — it answers 'when this workspace makes a Gmail call, which of my Gmail accounts should it use?'. The composio-mcp host restarts after the change so the agent's next turn picks up the right account's tools. Use when (a) the user explicitly says 'use my work gmail / personal account / etc.' in a workspace that already has multiple active accounts for that provider, or (b) the user has multiple active accounts and no default is set and you would otherwise have to guess which one to call. Args: `provider_id` (lowercase Composio slug, e.g. 'gmail'), `connection_id` (the integration connection id; obtain from `workspace_integrations_list_catalog` which lists each provider's connected accounts).",
+      "Set the workspace's default account for a Composio provider when the user has multiple active accounts for the same toolkit (e.g. two Gmail accounts, three GitHub accounts). This binding persists across sessions and devices for the same workspace — it answers 'when this workspace makes a Gmail call, which of my Gmail accounts should it use?'. Setting it drops the cached integration tool listing, so your NEXT turn resolves the new account's tools; the current turn still holds the previous account's. Use when (a) the user explicitly says 'use my work gmail / personal account / etc.' in a workspace that already has multiple active accounts for that provider, or (b) the user has multiple active accounts and no default is set and you would otherwise have to guess which one to call. Args: `provider_id` (lowercase Composio slug, e.g. 'gmail'), `connection_id` (the integration connection id; obtain from `workspace_integrations_list_catalog` which lists each provider's connected accounts).",
     policy: "mutate"
   },
   {
@@ -295,7 +295,7 @@ export const RUNTIME_AGENT_TOOL_DEFINITIONS = [
   {
     id: "mcp_refresh",
     description:
-      "Force a re-discovery of the tools exposed by the MCP servers already connected to this workspace. This is the tool to use whenever the user asks to RECONNECT / reload / refresh / re-fetch an already-connected server or its tools (e.g. 'reconnect the adspower mcp', 'refresh the mcp tools') — reach for this, NOT `mcp_connect` (which only ADDS new servers). Also use it when a connected MCP server's tool set changed (the server was updated or restarted) but its tools look stale, or the user says an expected tool from an already-connected server is missing or returns 'not found'. This does NOT add a server (use `mcp_connect` for that) and takes NO arguments — it invalidates the whole-workspace MCP tool cache, so ALL connected servers are re-discovered on your NEXT turn. Tools are NOT refreshed on the current turn: end your turn and tell the user to send one more message.",
+      "Force a re-discovery of the tools exposed by the MCP servers AND the connected integrations (X/Twitter, Gmail, Reddit, …) already available to this workspace. This is the tool to use whenever the user asks to RECONNECT / reload / refresh / re-fetch an already-connected server, integration, or its tools (e.g. 'reconnect the adspower mcp', 'refresh the mcp tools') — reach for this, NOT `mcp_connect` (which only ADDS new servers). Also use it when a connected MCP server's tool set changed (the server was updated or restarted) but its tools look stale, or the user says an expected tool is missing or returns 'not found' — INCLUDING the case where an integration the user just connected has no tools yet (e.g. you cannot find the publish/post tool for an account they just authorized). This does NOT add a server (use `mcp_connect` for that) and takes NO arguments — it invalidates the whole-workspace MCP tool cache and the cached integration tool listing, so ALL connected servers and integrations are re-discovered on your NEXT turn. Tools are NOT refreshed on the current turn: end your turn and tell the user to send one more message.",
     policy: "mutate"
   },
   {
```

---

### Incident Patch 6: `51a58c3f` (2026-08-21)
**Commit Message**: fix(runtime): surface integration toolkits that failed to resolve (#544)

* fix(runtime): surface integration toolkits that failed to resolve

`resolveComposioInlineTools` has always returned which toolkits it could not
resolve, and nothing has ever consumed it — `unavailable` was computed, returned,
and dropped. So a toolkit whose schema fetch failed was indistinguishable from one
the user never connected: the tools were simply absent, with no event, no log line
and nothing in the prompt to say why.

That is how a connected integration gets explained to the user as "still loading".
The agent had no signal at all, so it guessed — and its guess is the thing users
read as the product's explanation of itself. The MCP path has surfaced exactly this
for a while (`mcp_server_unavailable`); integrations just never got the equivalent.

- carry `composioInline.unavailable` onto PiSessionHandle and emit
  `composio_toolkit_unavailable` alongside the MCP loop, same shape and same place.
- register the event in BOTH runner event unions. A type missing from either is
  dropped on the way to the client, silently — the exact failure mode this change
  exists to end, so a contract test now pins th

**File**: `apps/desktop/src/components/panes/ChatPane/index.tsx` (modified, +8/-1)
```diff
@@ -2219,13 +2219,20 @@ export function phaseTraceStepFromEvent(
     };
   }
 
-  if (eventType === "mcp_server_unavailable") {
+  if (
+    eventType === "mcp_server_unavailable" ||
+    eventType === "composio_toolkit_unavailable"
+  ) {
     // Don't surface this in the transcript at all. It's a recoverable notice —
     // the run continues without the server's tools (e.g. an OAuth connector never
     // signed into) — but rendering it every turn read as a failure and was pure
     // noise. The actionable paths live elsewhere: the inline authorize card
     // (mcpAuthorizations, collected in a separate pass) and Customize → MCPs →
     // Custom apps (sign in / remove). So emit no step.
+    //
+    // composio_toolkit_unavailable is the integration equivalent and gets the
+    // same treatment: it exists so a failed toolkit is diagnosable in the run
+    // trace, not so it becomes per-turn chrome.
     return null;
   }
 
```

**File**: `runtime/api-server/src/ts-runner-contracts.ts` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ export type TsRunnerEventType =
   | "auto_compaction_start"
   | "auto_compaction_end"
   | "mcp_server_unavailable"
+  | "composio_toolkit_unavailable"
   | "run_completed"
   | "run_failed";
 
```

**File**: `runtime/harness-host/src/contracts.test.ts` (modified, +57/-0)
```diff
@@ -1,4 +1,5 @@
 import assert from "node:assert/strict";
+import { readFileSync } from "node:fs";
 import test from "node:test";
 
 import {
@@ -309,3 +310,59 @@ test("decode workspace MCP sidecar request payloads", () => {
     }
   );
 });
+
+/**
+ * Both unions must list every event the runner emits.
+ *
+ * The first version of this test read only the RELAY source and compared it to a
+ * hardcoded array in the test body — so deleting the type from the runner union
+ * still passed, a comment counted as a match, and a future third type would be
+ * invisible. Parse both unions out of source and compare them as sets instead.
+ */
+function unionMembers(file: string, typeName: string): Set<string> {
+  const source = readFileSync(new URL(file, import.meta.url), "utf8");
+  const start = source.indexOf(`export type ${typeName} =`);
+  if (start === -1) throw new Error(`${typeName} not found in ${file}`);
+  const body = source.slice(start, source.indexOf(";", start));
+  // Strip comments so a mention in prose never counts as membership.
+  const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
+  return new Set([...code.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]));
+}
+
+/**
+ * Pre-existing drift, deliberately allowed rather than silently blessed:
+ * `auto_retry_start` is declared by the runner and absent from the relay. It is
+ * not this change's to fix, but a NEW type landing in only one union should
+ * still fail here.
+ */
+const KNOWN_UNION_DRIFT = new Set(["auto_retry_start"]);
+
+test("composio_toolkit_unavailable is declared by both the runner and the relay", () => {
+  const runner = unionMembers("./contracts.ts", "KnownRunnerEventType");
+  const relay = unionMembers(
+    "../../api-server/src/ts-runner-contracts.ts",
+    "TsRunnerEventType",
+  );
+
+  // Load-bearing: without this, pi.ts's emit does not compile.
+  assert.ok(
+    runner.has("composio_toolkit_unavailable"),
+    "the runner union lost composio_toolkit_unavailable",
+  );
+  // Contract hygiene: the relay declares what it forwards.
+  assert.ok(
+    relay.has("composio_toolkit_unavailable"),
+    "the relay union lost composio_toolkit_unavailable",
+  );
+
+  assert.deepEqual(
+    [...runner].filter((t) => !relay.has(t) && !KNOWN_UNION_DRIFT.has(t)).sort(),
+    [],
+    "a runner event type is missing from the relay union",
+  );
+  assert.deepEqual(
+    [...relay].filter((t) => !runner.has(t)).sort(),
+    [],
+    "the relay declares an event type the runner cannot emit",
+  );
+});
```

**File**: `runtime/harness-host/src/contracts.ts` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ export type KnownRunnerEventType =
   | "auto_compaction_end"
   | "auto_retry_start"
   | "mcp_server_unavailable"
+  | "composio_toolkit_unavailable"
   | "run_completed"
   | "run_failed";
 
```

**File**: `runtime/harness-host/src/pi.ts` (modified, +18/-0)
```diff
@@ -210,6 +210,10 @@ export interface PiSessionHandle {
   mcpToolMetadata: Map<string, PiMcpToolMetadata>;
   skillMetadataByAlias: Map<string, PiSkillMetadata>;
   unavailableMcpServers?: PiMcpServerUnavailableInfo[];
+  /** Toolkits whose inline Composio tools could not be resolved this turn. The
+   *  MCP path has surfaced its unavailable servers for a while; this is the
+   *  equivalent for integrations, which previously failed invisibly. */
+  unavailableComposioToolkits?: Array<{ toolkit_slug: string; reason: string }>;
   /** Per-step durations of the (currently serial) session-setup awaits —
    *  mcp_connect, composio_inline, runtime_tools, browser_tools, web_search,
    *  resource_reload, create_agent_session. Surfaced in run_started so the TTFT
@@ -3434,6 +3438,7 @@ async function defaultCreateSession(request: HarnessHostPiRequest): Promise<PiSe
     mcpToolMetadata: mcpToolset.mcpToolMetadata,
     skillMetadataByAlias,
     unavailableMcpServers: mcpToolset.unavailableServers,
+    unavailableComposioToolkits: composioInline.unavailable,
     setupTimingsMs,
     dispose: async () => {
       try {
@@ -4144,6 +4149,19 @@ export async function runPi(request: HarnessHostPiRequest, deps: PiDeps = defaul
     });
   }
 
+  // The integration equivalent of the loop above. resolveComposioInlineTools has
+  // always returned which toolkits it could not resolve, but nothing consumed it,
+  // so a failed toolkit was indistinguishable from one the user never connected:
+  // the tools were simply absent and no event, log or prompt line said why. That
+  // is how a connected integration ends up explained to the user as "still
+  // loading" — the agent had no signal and guessed.
+  for (const unavailable of handle.unavailableComposioToolkits ?? []) {
+    emitEvent(request, nextSequence(), "composio_toolkit_unavailable", {
+      toolkit_slug: unavailable.toolkit_slug,
+      reason: unavailable.reason,
+    });
+  }
+
   let timeoutHandle: NodeJS.Timeout | null = null;
   let timedOut = false;
   if (request.timeout_seconds > 0) {
```

---

### Incident Patch 7: `de16a058` (2026-08-19)
**Commit Message**: fix(runtime): follow session-cookie rotation instead of holding the spawn-time one (#534)

Composio search failed with `401 {"error":"unauthorized"}` while chat kept
working. The 401 was not Composio's and not the Notion connection's — it came
from the Hono gateway rejecting the runtime's session cookie.

The runtime reads that cookie once, from HOLABOSS_AUTH_COOKIE in its spawn
environment. Better-auth rotates it silently: the backend reissues it on
get-session and most auth-touching endpoints. The desktop already accounts for
this — authCookieHeader() deliberately stopped caching, and its comment
describes the same bug one layer up — but it hands the runtime a snapshot, so
the runtime kept presenting a pre-rotation cookie for as long as it lived.

Only cookie-authenticated paths break (Composio search, connections, proxy),
which is why this looks like "Composio is broken" rather than "signed out":
chat authenticates with the model-proxy key instead.

Three parts:

  - ComposioService reads the cookie through a getter rather than a readonly
    field captured in the constructor, so there is somewhere to put a newer
    one. Empty pushes are ignored — "" means the desktop does not 

**File**: `apps/desktop/electron/main.ts` (modified, +27/-0)
```diff
@@ -8429,6 +8429,26 @@ function setupDevRuntimeHotReload(): void {
   }
 }
 
+/**
+ * Forward a rotated session cookie to the running runtime.
+ *
+ * Best-effort and deliberately silent: the runtime may not be up yet (this can
+ * fire during startup, before the first spawn), and a failure here must never
+ * break the caller — authCookieHeader() is on the path of ordinary requests.
+ * A missed push self-corrects on the next rotation, and the spawn environment
+ * carries the current value for any runtime started afterwards.
+ */
+function pushAuthCookieToRuntime(cookie: string): Promise<void> {
+  return fetch(`${runtimeBaseUrl()}/api/v1/capabilities/auth-session`, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ cookie }),
+    signal: AbortSignal.timeout(5_000),
+  })
+    .then(() => undefined)
+    .catch(() => undefined);
+}
+
 function authCookieHeader() {
   if (!desktopAuthClient) {
     return "";
@@ -8466,6 +8486,13 @@ function authCookieHeader() {
     if (live !== cachedCookieHeader) {
       cachedCookieHeader = live;
       persistPlaintextAuthCache(live);
+      // The runtime holds its own copy, taken from HOLABOSS_AUTH_COOKIE at
+      // spawn. This function exists because that value rotates; the runtime had
+      // no way to hear about it, so its cookie-authenticated calls (Composio
+      // search / connections / proxy) eventually 401 while chat keeps working
+      // on the model-proxy key. Rotation is detected exactly here, so this is
+      // where it gets forwarded.
+      void pushAuthCookieToRuntime(live);
     }
     return live;
   }
```

**File**: `runtime/api-server/src/app.ts` (modified, +31/-0)
```diff
@@ -6190,6 +6190,37 @@ export function buildRuntimeApiServer(options: BuildRuntimeApiServerOptions = {}
     }
   });
 
+  // The desktop pushes a rotated session cookie here.
+  //
+  // HOLABOSS_AUTH_COOKIE is read once, from the spawn environment, so the
+  // runtime held whatever the session was when it started. Better-auth rotates
+  // that cookie silently (the backend reissues it on get-session and most
+  // auth-touching endpoints), and the desktop follows the rotation — its
+  // authCookieHeader() stopped caching for precisely this reason. The runtime
+  // did not, so every cookie-authenticated call eventually 401s: Composio
+  // search, connections and proxy all fail while chat keeps working, because
+  // chat authenticates with the model-proxy key instead.
+  //
+  // Nothing here is a new secret: it is the same session the desktop already
+  // holds, transported to the process that needs it.
+  app.post("/api/v1/capabilities/auth-session", async (request, reply) => {
+    if (!isRecord(request.body)) {
+      return sendError(reply, 400, "body must be an object");
+    }
+    const cookie =
+      typeof request.body.cookie === "string" ? request.body.cookie : "";
+    if (!cookie.trim()) {
+      return sendError(reply, 400, "cookie is required");
+    }
+    if (!composioService) {
+      // Not an error: the runtime can outlive a session it never had a service
+      // for, and the desktop should not have to know which services exist.
+      return { updated: false, reason: "composio service not configured" };
+    }
+    composioService.setAuthCookie(cookie);
+    return { updated: true };
+  });
+
   app.post("/api/v1/capabilities/composio-search", async (request, reply) => {
     try {
       if (!composioService) {
```

**File**: `runtime/api-server/src/auth-cookie-rotation.test.ts` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+import assert from "node:assert/strict";
+import { readFileSync } from "node:fs";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+import { test } from "node:test";
+
+import { ComposioService } from "./composio-service.js";
+
+/**
+ * The runtime's session cookie has to survive rotation.
+ *
+ * It arrives once, in HOLABOSS_AUTH_COOKIE, from the spawn environment.
+ * Better-auth reissues the cookie silently (the backend sends a fresh
+ * Set-Cookie on get-session and most auth-touching endpoints), and the desktop
+ * follows that — its authCookieHeader() deliberately stopped caching for this
+ * exact reason. The runtime did not, so its cookie-authenticated calls
+ * eventually 401 while chat keeps working on the model-proxy key. Observed
+ * live: a Composio search failing with 401 {"error":"unauthorized"}.
+ */
+
+function service(cookie: string) {
+  return new ComposioService({
+    honoBaseUrl: "https://example.test",
+    authCookie: cookie,
+    fetchImpl: (async () => new Response("{}")) as unknown as typeof fetch,
+  });
+}
+
+test("a rotated cookie replaces the one taken at startup", () => {
+  const composio = service("better-auth.session=old");
+  composio.setAuthCookie("better-auth.session=new");
+  assert.equal(composio.authCookie, "better-auth.session=new");
+});
+
+test("the cookie is read through a getter, not captured per call site", () => {
+  // Three call sites send Cookie: proxy, listConnections and searchTools. If
+  // any captured the constructor value, a rotation would fix some and not
+  // others — the confusing half-broken state.
+  const here = path.dirname(fileURLToPath(import.meta.url));
+  const text = readFileSync(path.join(here, "composio-service.ts"), "utf-8");
+  assert.match(text, /get authCookie\(\): string/);
+  assert.doesNotMatch(
+    text,
+    /readonly authCookie/,
+    "a readonly field cannot be rotated",
+  );
+});
+
+test("an empty push is ignored rather than signing the runtime out", () => {
+  // "" means "the desktop does not know yet" — during startup, or when
+  // better-auth storage is briefly unreadable. Adopting it would turn a
+  // transient gap into a hard 401 on every subsequent call.
+  const composio = service("better-auth.session=live");
+  composio.setAuthCookie("");
+  composio.setAuthCookie("   ");
+  assert.equal(composio.authCookie, "better-auth.session=live");
+});
+
+test("the leading '; ' from better-auth is stripped on both paths", () => {
+  // Passed verbatim, Hono on Workers sees an empty leading cookie pair and the
+  // session middleware crashes — a generic 500 instead of a clean 401. The
+  // constructor already handled this; the rotation path has to as well, or a
+  // refresh reintroduces the bug the constructor was fixing.
+  const composio = service("; better-auth.session=one");
+  assert.equal(composio.authCookie, "better-auth.session=one");
+  composio.setAuthCookie("; better-auth.session=two");
+  assert.equal(composio.authCookie, "better-auth.session=two");
+});
```

**File**: `runtime/api-server/src/composio-service.ts` (modified, +42/-2)
```diff
@@ -80,11 +80,51 @@ export interface ComposioConnectionSummary {
   createdAt: string;
 }
 
+/**
+ * Better Auth's Electron client returns the cookie header as `; name=value`
+ * (leading "; " — meant for splicing onto an existing Cookie header). Passed
+ * verbatim as a fresh `Cookie:` header, Hono on Cloudflare Workers sees a
+ * leading empty cookie pair and the session-auth middleware crashes → the
+ * Worker bubbles a generic 500 instead of a clean 401. Strip leading whitespace
+ * and semicolons so the header starts with a real `name=value` pair.
+ */
+function normalizeAuthCookie(raw: string): string {
+  return (raw ?? "").replace(/^[\s;]+/, "").trim();
+}
+
 export class ComposioService {
   readonly honoBaseUrl: string;
-  readonly authCookie: string;
+  private currentAuthCookie: string;
   private readonly fetchImpl: typeof fetch;
 
+  /**
+   * Read per request, never captured.
+   *
+   * The session cookie ROTATES: better-auth reissues it whenever the backend
+   * sends a fresh Set-Cookie, which happens silently on get-session and most
+   * auth-touching endpoints. The desktop already accounts for that — its
+   * authCookieHeader() deliberately stopped caching for exactly this reason —
+   * but it hands the runtime a value once, in the spawn environment, so the
+   * runtime kept presenting a pre-rotation cookie for as long as it lived.
+   *
+   * Every call went through `this.authCookie`, captured in the constructor, so
+   * there was nowhere to put a newer one even if we had it. Reading through a
+   * getter is what makes `setAuthCookie` possible at all.
+   */
+  get authCookie(): string {
+    return this.currentAuthCookie;
+  }
+
+  /** Adopt a rotated session cookie. Ignores empty values: an empty cookie is
+   *  "we don't know yet", not "sign the runtime out". */
+  setAuthCookie(next: string): void {
+    const normalized = normalizeAuthCookie(next);
+    if (!normalized || normalized === this.currentAuthCookie) {
+      return;
+    }
+    this.currentAuthCookie = normalized;
+  }
+
   constructor(config: ComposioServiceConfig) {
     this.honoBaseUrl = config.honoBaseUrl.replace(/\/+$/, "");
     // Better Auth's Electron client returns the cookie header as `; name=value`
@@ -94,7 +134,7 @@ export class ComposioService {
     // → the Worker bubbles a generic 500 "Internal Server Error" instead of a
     // clean 401. Strip the leading `; ` (and any other leading whitespace /
     // semicolons) so the header starts with the first real `name=value` pair.
-    this.authCookie = config.authCookie.replace(/^[\s;]+/, "");
+    this.currentAuthCookie = normalizeAuthCookie(config.authCookie);
     this.fetchImpl = config.fetchImpl ?? fetch;
   }
 
```

**File**: `runtime/harnesses/src/composio-inline-tools.ts` (modified, +17/-1)
```diff
@@ -259,12 +259,28 @@ function buildComposioMetaTools(ctx: {
           typeof payload.detail === "string" && payload.detail.trim()
             ? payload.detail.trim()
             : `composio-search failed (status ${response.status})`;
+        // A 401 here is the RUNTIME's session, not the integration's.
+        //
+        // The cookie only identifies whose connections to scope results to; the
+        // Composio credential lives server-side, past the gateway. But the
+        // failure surfaced as a bare `401 {"error":"unauthorized"}` next to a
+        // toolkit slug, and a model reading that concluded "the composio search
+        // tools are unauthorized" — then went looking for a workaround for a
+        // problem that had nothing to do with the toolkit. Observed live on a
+        // Notion search.
+        //
+        // Saying which credential expired costs one line and stops the next
+        // reader — human or model — drawing the same wrong conclusion.
+        const sessionExpired = /\b401\b|unauthorized/i.test(detail);
+        const cause = sessionExpired
+          ? "\nThis is the runtime's own sign-in session, NOT the integration's authorization: the toolkit's connection is unaffected. Restarting the app re-establishes it. Do not suggest reconnecting the integration."
+          : "";
         const scope = toolkitSlug ? `:${toolkitSlug}` : "";
         return {
           content: [
             {
               type: "text" as const,
-              text: `[composio_error:search_failed${scope}] ${detail}\nThe search did NOT run — this is not "no matching tools". Retry, or list the toolkit's catalogue with only toolkit_slug.`,
+              text: `[composio_error:search_failed${scope}] ${detail}${cause}\nThe search did NOT run — this is not "no matching tools". Retry, or list the toolkit's catalogue with only toolkit_slug.`,
             },
           ],
           details: { tool_id: "composio_search_tools", ok: false },
```

---

### Incident Patch 8: `f6013b57` (2026-08-19)
**Commit Message**: fix(harness): add Opus 5 and Sonnet 5 to the Claude Code model picker (#532)

* fix(harness): add Opus 5 and Sonnet 5 to the Claude Code model picker

The picker was missing the newest models while the CLI itself offered them, so
they could not be selected from the app at all — with nothing to explain why.

The cause is not the model-proxy catalogue I first went looking at. That is a
different harness: this session runs Claude Code, whose picker is fed by the
static supportedModels list in this file. Its comment calls that list a
"fallback catalogue", which overstates it — unlike codex, this harness sets no
dynamicModelDiscovery, so nothing ever reads a live catalogue and there is
nothing to fall back FROM. The list is the whole source, and it had drifted:
someone added Fable 5 and Opus 4.8 without Opus 5 or Sonnet 5.

Live discovery would be the real fix, and is deliberately not attempted here:
HARNESS_MODEL_DISCOVERERS dispatches per harness by spawning the CLI to read
its catalogue, and the claude CLI exposes no model-enumeration command —
`--model` takes an alias or a full name and that is all. There is nothing for a
discoverer to call, so inventing one would be guesswork.

The

**File**: `runtime/harnesses/src/claude-code-models.test.ts` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { claudeCodeHarnessDefinition } from "./claude-code.js";
+
+/**
+ * The Claude Code harness's model list is the ONLY thing its picker shows.
+ *
+ * Unlike codex, this harness sets no `dynamicModelDiscovery`, so nothing reads
+ * a live catalogue from the CLI — the static list is not a fallback, it is the
+ * whole source. It had already drifted: Opus 5 and Sonnet 5 were missing while
+ * the CLI itself offered them, so the newest models were unreachable from the
+ * app with no error to explain why.
+ *
+ * These guards cannot know which models exist tomorrow. They pin the things
+ * that made the drift silent and hard to spot.
+ */
+
+const adapter = claudeCodeHarnessDefinition.runtimeAdapter;
+const models = adapter.supportedModels;
+
+test("model ids are unique and non-empty", () => {
+  const ids = models.map((m) => m.id);
+  assert.deepEqual(
+    ids.filter((id) => !id.trim()),
+    [],
+    "an empty id would be forwarded as `claude --model ''`",
+  );
+  assert.equal(new Set(ids).size, ids.length, "duplicate model ids");
+});
+
+test("exactly one model is the default", () => {
+  // The desktop picker uses this when a session has no override. Zero defaults
+  // silently falls back to whatever the picker orders first; two is ambiguous.
+  const defaults = models.filter((m) => m.default);
+  assert.equal(defaults.length, 1, `expected one default, found ${defaults.length}`);
+});
+
+test("every model is labelled for the picker", () => {
+  // The picker renders labels, not ids. A missing label shows an empty row.
+  for (const model of models) {
+    assert.ok(model.label?.trim(), `model ${model.id} has no label`);
+  }
+});
+
+test("the list still carries the current generation", () => {
+  // The drift that prompted these tests. Not a claim about what is newest
+  // forever — a floor, so the list cannot silently lose the models it has been
+  // caught missing before.
+  const ids = new Set(models.map((m) => m.id));
+  for (const id of ["claude-opus-5", "claude-sonnet-5", "claude-fable-5"]) {
+    assert.ok(ids.has(id), `${id} missing from the Claude Code picker`);
+  }
+});
+
+test("the default is a current-generation model", () => {
+  // A default left on a retired model is the failure this replaced: every new
+  // session silently started on it, and it stayed the picker's preselection
+  // long after newer models shipped.
+  const fallback = models.find((m) => m.default);
+  assert.equal(fallback?.id, "claude-sonnet-5");
+});
+
+test("the retired 4.6 series is gone", () => {
+  // Deprecated deliberately, not dropped by accident. Safe for sessions already
+  // on them: the desktop adopts a session's stored model only while it is still
+  // a legal id for the harness, and otherwise runs the default-snap — so those
+  // sessions move to the default rather than showing an unofferable model.
+  const ids = new Set(models.map((m) => m.id));
+  for (const id of ["claude-sonnet-4-6", "claude-opus-4-6"]) {
+    assert.ok(!ids.has(id), `${id} was deprecated and should not be listed`);
+  }
+});
+
+test("this harness has no live discovery, which is why the list must be maintained", () => {
+  // If someone later adds dynamicModelDiscovery, the static list becomes a real
+  // fallback and the floor above stops being load-bearing. Fail here so that
+  // change is a deliberate one rather than a silent shift in what this file is.
+  assert.notEqual(
+    adapter.dynamicModelDiscovery,
+    true,
+    "claude-code now discovers models live — revisit the static list's role",
+  );
+});
```

**File**: `runtime/harnesses/src/claude-code.ts` (modified, +23/-4)
```diff
@@ -25,16 +25,35 @@ export const claudeCodeHarnessDefinition: HarnessDefinition = {
       supportsMcpTools: true,
     },
     // Forwarded as `claude --model <id>` by the host runner. List +
-    // labels are a static fallback catalogue. `default: true` on Sonnet 4.6 marks the
-    // harness's preferred pick — the desktop picker uses this when
+    // labels are a static fallback catalogue. `default: true` on Sonnet 5 marks
+    // the harness's preferred pick — the desktop picker uses this when
     // there's no per-session override.
+    //
+    // Dropping a model here is safe for sessions already committed to it: the
+    // desktop only adopts a session's stored model when it is still a legal id
+    // for the harness, and otherwise lets the default-snap run (see the
+    // harnessModelSeeded effect in ChatPane and the equivalent in
+    // ProjectLanding). Such a session moves to the default rather than showing
+    // a model the picker cannot offer.
+    //
+    // "Fallback" overstates it here: unlike codex, this harness sets no
+    // `dynamicModelDiscovery`, so there is no live catalogue to fall back FROM
+    // and this list is the only thing the picker ever shows. It therefore has
+    // to be updated by hand as models ship, and it had already drifted —
+    // Opus 5 and Sonnet 5 were missing while the CLI itself offered them, so
+    // the picker could not reach the newest models at all.
+    //
+    // Live discovery would be the real fix, but the claude CLI exposes no
+    // model-enumeration command (`--model` takes an alias or full name and
+    // that is all), so there is nothing for a discoverer to call. See
+    // HARNESS_MODEL_DISCOVERERS in harness-host/src/model-discovery.ts.
     supportedModels: [
-      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", default: true },
+      { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic", default: true },
+      { id: "claude-opus-5", label: "Claude Opus 5", provider: "anthropic" },
       { id: "claude-fable-5", label: "Claude Fable 5", provider: "anthropic" },
       { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic" },
       { id: "claude-opus-4-7", label: "Claude Opus 4.7", provider: "anthropic" },
       { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" },
-      { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
       { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "anthropic" },
     ],
     buildRunnerPrepPlan() {
```

---

### Incident Patch 9: `3ffd8429` (2026-08-19)
**Commit Message**: fix(runtime): surface end-of-turn compaction failures in runtime.log (#531)

I said this failure was "now visible in logs" after the earlier compaction work.
It was not, and this module says why in its own comment: the ts-runner stderr is
"buffered by us and only surfaced on failure, so a log there is invisible on
successful turns". A failed compaction does not fail the run, so pi's warning
went to a stream nobody could read.

Making the outcome a return value made it assertable in tests. It did nothing
for production, where the only signal was still that warning.

The cost of the silence is not cosmetic. A failed compaction leaves the session
uncompacted, so the next turn is larger, its summarization is larger, and it is
likelier to fail the same way. The first anyone learns of it is a turn that
blows the context window, with nothing in the logs connecting the two.

The failure is now scraped off the stderr stream as chunks arrive and appended
to the [ttft] line, which is the channel that does reach runtime.log on a
successful turn — the same reasoning that put the TTFT breakdown there.

Scraped rather than plumbed through an event because compaction runs AFTER the
terminal event,

**File**: `runtime/api-server/src/compaction-visibility.test.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import assert from "node:assert/strict";
+import fs from "node:fs";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+import { test } from "node:test";
+
+/**
+ * A failed end-of-turn compaction has to be readable somewhere.
+ *
+ * Compaction runs after the terminal event and its failure does not fail the
+ * run, so pi's warning went to the ts-runner stderr this module "buffers and
+ * only surfaces on failure" — written where nobody could read it. The cost is
+ * not cosmetic: a failed compaction leaves the session uncompacted, so the next
+ * turn is larger and likelier to fail the same way, and the first anyone learns
+ * of it is a turn that blows the context window.
+ *
+ * The [ttft] line is the channel that does reach runtime.log on a successful
+ * turn, which is why it carries this.
+ */
+
+const here = path.dirname(fileURLToPath(import.meta.url));
+const source = fs.readFileSync(path.join(here, "runner-worker.ts"), "utf-8");
+
+test("compaction failures are scraped from the live stderr stream", () => {
+  // Scraped as chunks arrive, not from the buffered result: that result is
+  // discarded on a successful run, which is exactly the case in question.
+  assert.match(
+    source,
+    /for await \(const chunk of stderr\)[\s\S]{0,600}?pi end-of-turn compaction failed/,
+    "the marker must be matched inside the stderr consumer loop",
+  );
+});
+
+test("the failure reaches the [ttft] line", () => {
+  assert.match(
+    source,
+    /compactionFailure \? ` compaction_failed=/,
+    "a compaction failure must appear on the line that lands in runtime.log",
+  );
+});
+
+test("a healthy turn stays quiet", () => {
+  // Only failures are reported. `compaction=ok` on every turn would be noise,
+  // and its absence is the normal case.
+  assert.doesNotMatch(
+    source,
+    /compaction_failed=\$\{[^}]*\}`\s*\)/,
+    "the field must be conditional, not unconditional",
+  );
+  assert.match(
+    source,
+    /let compactionFailure: string \| null = null;/,
+    "null means no failure was seen this turn",
+  );
+});
+
+test("the captured text is bounded", () => {
+  // pi's message embeds an upstream error that could be arbitrarily long; an
+  // unbounded slice of it would run away with the log line.
+  assert.match(source, /\.slice\(0, 200\)/);
+});
```

**File**: `runtime/api-server/src/runner-worker.ts` (modified, +28/-2)
```diff
@@ -787,11 +787,34 @@ export async function executeRunnerRequest(
   };
   options.signal?.addEventListener("abort", abortChild, { once: true });
 
+  // End-of-turn compaction failures are reported here, scraped from the stream
+  // as it arrives rather than from the buffered result.
+  //
+  // Compaction runs AFTER the terminal event and its failure does not fail the
+  // run, so pi's warning went to a stream that is "buffered by us and only
+  // surfaced on failure" (see above) — a signal written where nobody could read
+  // it. The consequence is not cosmetic: a failed compaction leaves the session
+  // uncompacted, so the next turn is larger and likelier to fail the same way,
+  // and the first anyone learns of it is a turn that blows the context window.
+  //
+  // Scraped rather than plumbed because the failure happens after the terminal
+  // event, by which point the event channel is closed and there is nothing left
+  // to attach it to.
+  let compactionFailure: string | null = null;
   const stderrPromise = (async () => {
     const chunks: Buffer[] = [];
     for await (const chunk of stderr) {
       resetIdleTimeout();
-      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
+      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
+      chunks.push(buffer);
+      if (compactionFailure === null) {
+        const match = /pi end-of-turn compaction failed[^\n]*/.exec(
+          buffer.toString("utf-8"),
+        );
+        if (match) {
+          compactionFailure = match[0].slice(0, 200);
+        }
+      }
     }
     return Buffer.concat(chunks).toString("utf-8").trim();
   })();
@@ -947,7 +970,10 @@ export async function executeRunnerRequest(
         (ttftInputTokens && ttftInputTokens > 0 && ttftCachedInputTokens !== null
           ? ` cache_hit=${Math.round((ttftCachedInputTokens / ttftInputTokens) * 100)}%`
           : "") +
-        (setupBreakdown ? ` setup=[${setupBreakdown}]` : ""),
+        (setupBreakdown ? ` setup=[${setupBreakdown}]` : "") +
+        // Only on failure: a compaction=ok on every line would be noise, and
+        // the absence of this is the normal case.
+        (compactionFailure ? ` compaction_failed=${JSON.stringify(compactionFailure)}` : ""),
     );
   }
 
```

---

### Incident Patch 10: `e0c64d5d` (2026-08-19)
**Commit Message**: fix(desktop): stop the chat flashing, nudging, and hiding new sessions (#529)

* fix(desktop): swap the conversation instead of blanking it when starting a chat

The last visible flash. Sending into a new session called clearSessionView()
— setMessages([]) — and only rebuilt the view after awaiting session creation,
so the canvas sat empty across an IPC round trip.

This also explains the reported coincidence that the blink lands exactly when
the new row appears in the sidebar: both hang off the same queue response. The
blank starts at the clear, ends when the optimistic user message is appended,
and the sidebar row arrives on the same tick. Two symptoms, one moment.

clearSessionView takes a keepMessages option, used only by the send path: the
outgoing conversation stays on screen and is replaced wholesale by this send's
own first message, in one step, so there is no empty frame. Every other caller
still blanks, because they genuinely have nothing to put in its place —
workspace switch, blank draft, session delete.

Two things the swap has to get right, both guarded:

  - the flag is consumed unconditionally, before the queueOntoActiveRun branch.
    That branch adds no message, a

**File**: `apps/desktop/electron/main.ts` (modified, +1/-0)
```diff
@@ -16334,6 +16334,7 @@ async function createAgentSession(
           session_id: payload.session_id ?? undefined,
           kind: payload.kind ?? undefined,
           title: payload.title ?? undefined,
+          first_user_text: payload.first_user_text ?? undefined,
           parent_session_id: payload.parent_session_id ?? undefined,
           project_id: payload.project_id ?? undefined,
           created_by: payload.created_by ?? undefined,
```

**File**: `apps/desktop/electron/preload.ts` (modified, +3/-0)
```diff
@@ -599,6 +599,9 @@ interface CreateAgentSessionPayload {
 	session_id?: string | null;
 	kind?: string | null;
 	title?: string | null;
+	/** The message about to be sent. Lets the runtime title the session at
+	 *  creation, so the sidebar can list it immediately. */
+	first_user_text?: string | null;
 	parent_session_id?: string | null;
 	created_by?: string | null;
 	/** Owning HolaApp — stamps owning_app_id on the created session. */
```

**File**: `apps/desktop/src/components/layout/shell/useWorkspaceLists.ts` (modified, +4/-0)
```diff
@@ -349,6 +349,10 @@ export function useWorkspaceMainSessions(
     void load();
     const timer = window.setInterval(load, POLL_INTERVAL_MS);
 
+    // One reload is enough: the session is titled at creation now, so it is
+    // listable by the time this fires. The staggered follow-ups that used to be
+    // here were bounding a delay whose real cause was the missing title, and
+    // kept nine list calls per send alive for nothing once that was fixed.
     const onChanged = () => {
       void load();
     };
```

**File**: `apps/desktop/src/components/panes/ChatPane.test.mjs` (modified, +8/-2)
```diff
@@ -1011,7 +1011,10 @@ test("chat pane routes immediate sends through the newer pending session request
   );
   assert.match(
     source,
-    /if \(pendingSessionTarget\) \{\s*consumeSessionOpenRequest\(pendingSessionTarget\.requestKey\);\s*clearSessionView\(\);[\s\S]*setActiveSession\(pendingSessionTarget\.sessionId\);[\s\S]*draftParentSessionIdRef\.current = pendingSessionTarget\.parentSessionId;\s*setActiveSession\(null\);/,
+    // clearSessionView now defers the blank here (keepMessages) so the canvas
+    // is not empty for the whole session-creation round trip; the conversation
+    // is swapped out when the send's own first message arrives.
+    /if \(pendingSessionTarget\) \{\s*consumeSessionOpenRequest\(pendingSessionTarget\.requestKey\);[\s\S]*clearSessionView\(\{ keepMessages: true \}\);[\s\S]*setActiveSession\(pendingSessionTarget\.sessionId\);[\s\S]*draftParentSessionIdRef\.current = pendingSessionTarget\.parentSessionId;\s*setActiveSession\(null\);/,
   );
   assert.match(
     source,
@@ -1496,9 +1499,12 @@ test("chat pane keeps the current stream attached while queueing a follow-up inp
     source,
     /const queueOntoActiveRun =[\s\S]*\(isResponding[\s\S]*Boolean\(activeStreamIdRef\.current\)[\s\S]*Boolean\(pendingInputIdRef\.current\)\)[\s\S]*targetSessionId === activeSessionIdRef\.current;/,
   );
+  // The optimistic user message now either appends or REPLACES: sending into a
+  // new session holds the outgoing conversation on screen (rather than blanking
+  // the canvas for the whole session-creation round trip) and swaps it out here.
   assert.match(
     source,
-    /if \(!queueOntoActiveRun\) \{[\s\S]*setMessages\(\(prev\) => \[\.\.\.prev, userMessage\]\);[\s\S]*\}/,
+    /if \(!queueOntoActiveRun\) \{[\s\S]*setMessages\(\(prev\) => \(swapping \? \[userMessage\] : \[\.\.\.prev, userMessage\]\)\);[\s\S]*\}/,
   );
   assert.doesNotMatch(source, /eventType: "stream_open_prequeue"/);
   assert.match(
```

**File**: `apps/desktop/src/components/panes/ChatPane/AssistantTurn/index.tsx` (modified, +13/-1)
```diff
@@ -426,7 +426,19 @@ function AssistantTurnComponent({
         ) : null}
       </div>
 
-      {showActionsMenu || (showAvatar && timeLabel) ? (
+      {/* Reserved while the turn is live. `showActionsMenu` is
+          `hasAnyContent && !live` and the timestamp only exists once the turn
+          is committed, so this whole 28px row (mt-1 + h-6) used to APPEAR at
+          completion — growing the turn the instant the agent stopped typing and
+          nudging the conversation. The row now occupies its space for the
+          turn's whole life and merely fills in, so nothing moves.
+
+          The condition mirrors the settled one: reserve exactly when the
+          settled turn will render this row, or the reservation would itself
+          become a shift in the other direction. */}
+      {showActionsMenu ||
+      (showAvatar && timeLabel) ||
+      (live && hasAnyContent) ? (
         <div className="mt-1 flex h-6 items-center gap-2">
           {showAvatar && timeLabel ? (
             <span className="select-none text-xs leading-none text-muted-foreground tabular-nums">
```

**File**: `apps/desktop/src/components/panes/ChatPane/AssistantTurn/turnFooterReservation.test.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import assert from "node:assert/strict";
+import { readFileSync } from "node:fs";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+import { test } from "node:test";
+
+/**
+ * The turn must not grow when it finishes.
+ *
+ * The footer row (timestamp + actions) is `mt-1 h-6` — 28px — and its two
+ * conditions are both false while streaming: `showActionsMenu` is
+ * `hasAnyContent && !live`, and the timestamp only exists once the turn is
+ * committed. So the row APPEARED at completion, growing the turn the instant
+ * the agent stopped typing and nudging the conversation.
+ *
+ * Same class as the "Worked for Ns" anchor removed alongside this: anything
+ * that exists in only one of the two states moves the layout on the transition.
+ * The anchor could simply go; the timestamp and actions are worth keeping, so
+ * the row is reserved instead and merely fills in.
+ */
+
+const here = path.dirname(fileURLToPath(import.meta.url));
+const source = readFileSync(path.join(here, "index.tsx"), "utf-8");
+
+test("the footer row is reserved while the turn is live", () => {
+  assert.match(
+    source,
+    /\{showActionsMenu \|\|\s*\(showAvatar && timeLabel\) \|\|\s*\(live && hasAnyContent\) \?/,
+    "a live turn with content must still render the footer row, or it appears at completion and grows the turn",
+  );
+});
+
+test("the reservation matches the settled condition", () => {
+  // showActionsMenu is `hasAnyContent && !live`, so a settled turn renders the
+  // row exactly when it has content. Reserving on `live && hasAnyContent` is
+  // the same predicate on the other side of the flip — reserving more widely
+  // would make the row VANISH at completion, a shift in the other direction.
+  assert.match(
+    source,
+    /const showActionsMenu = hasAnyContent && !live;/,
+    "the settled condition changed; the reservation above must be re-derived from it",
+  );
+});
+
+test("the row keeps a fixed height so filling it cannot resize the turn", () => {
+  assert.match(
+    source,
+    /\(live && hasAnyContent\) \? \(\s*<div className="mt-1 flex h-6 items-center gap-2">/,
+    "the reserved row must have an explicit height, or an empty row collapses",
+  );
+});
```

**File**: `apps/desktop/src/components/panes/ChatPane/ConversationTurns.tsx` (modified, +35/-9)
```diff
@@ -245,11 +245,40 @@ export function ConversationTurns<Message extends ChatMessage>({
   });
 
   if (liveAssistantTurn) {
+    const liveTurnKey = liveAssistantTurn.id ?? "__live_assistant_turn__";
+    // Mirrors the spacing the committed turn will carry. Getting this wrong is
+    // a shift of exactly one `mt-2` (8px) at completion — the residual nudge
+    // left after the remount was fixed, because the live wrapper had no spacing
+    // and the committed one does.
+    const livePrevious = messages[messages.length - 1];
+    const liveIsFirstInAssistantGroup =
+      messages.length === 0 || livePrevious?.role === "user";
+    const liveIsGroupedContinuation =
+      livePrevious?.role === "assistant" && !liveIsFirstInAssistantGroup;
+    const liveSpacingClassName =
+      messages.length > 0 && !liveIsGroupedContinuation ? "mt-2" : "";
     renderedTurns.push(
-      // Same key the turn will carry once committed, so React reconciles the
-      // live node into the committed one instead of unmount+remount (which
-      // replays the entrance animation — the completion "flicker").
-      <Fragment key={liveAssistantTurn.id ?? "__live_assistant_turn__"}>
+      // Same key AND the same wrapper element the turn will carry once
+      // committed, so React reconciles the live node into the committed one
+      // instead of unmount+remount.
+      //
+      // The key alone was not enough, which is why the completion flicker
+      // outlived the comment that used to sit here: a keyed Fragment and a
+      // keyed <div> are different element TYPES, and React tears down and
+      // rebuilds across a type change no matter what the key says. The remount
+      // replayed `animate-in fade-in-0 slide-in-from-bottom-1` on the turn —
+      // a fade and a slide, which is the "blink + nudge" at the end of a turn.
+      //
+      // Matching the wrapper is what makes the key do its job.
+      <div
+        key={liveTurnKey}
+        data-message-id={liveAssistantTurn.id ?? undefined}
+        // Spacing only. The per-message decorator (search highlight and
+        // friends) needs a full Message and does not apply to a live turn, but
+        // the SPACING must match what the committed turn will have or the turn
+        // moves by 8px the moment it settles.
+        className={liveSpacingClassName || undefined}
+      >
         <AssistantTurn
           label={assistantLabel}
           mode={assistantMode}
@@ -264,10 +293,7 @@ export function ConversationTurns<Message extends ChatMessage>({
           onToggleTraceStep={onToggleTraceStep}
           onLinkClick={onLinkClick}
           onLocalLinkClick={onLocalLinkClick}
-          showAvatar={
-            messages.length === 0 ||
-            messages[messages.length - 1]?.role === "user"
-          }
+          showAvatar={liveIsFirstInAssistantGroup}
           workspaceId={workspaceId ?? null}
           harnessId={harnessId}
           assistantAvatar={assistantAvatar}
@@ -277,7 +303,7 @@ export function ConversationTurns<Message extends ChatMessage>({
           status={liveAssistantTurn.status ?? ""}
           footerAccessory={liveAssistantTurn.footerAccessory ?? null}
         />
-      </Fragment>,
+      </div>,
     );
   }
 
```

**File**: `apps/desktop/src/components/panes/ChatPane/index.tsx` (modified, +55/-3)
```diff
@@ -3804,6 +3804,10 @@ export function ChatPane({
   /** Assistant turns committed locally that the server has not returned yet.
    *  The assistant-side counterpart of pendingOptimisticUserMessagesRef. */
   const pendingCommittedAssistantTurnsRef = useRef<ChatMessage[]>([]);
+  // Set when a send has deferred blanking the canvas because it intends to
+  // replace the conversation with its own first message. Cleared by that swap,
+  // or by settlePendingSessionSwap if the send never gets that far.
+  const pendingSessionSwapRef = useRef(false);
   const [sessionOutputs, setSessionOutputs] = useState<
     WorkspaceOutputRecordPayload[]
   >([]);
@@ -4428,8 +4432,30 @@ export function ChatPane({
     );
   }
 
-  function clearSessionView() {
+  /**
+   * `keepMessages` leaves the visible list alone while resetting everything
+   * else. Used when we are about to REPLACE the conversation rather than merely
+   * leave it: blanking here and then awaiting session creation left the canvas
+   * empty across an IPC round trip, which is the flash when you send into a new
+   * session. The caller swaps the list in one step instead, once it has the
+   * first message to show.
+   *
+   * Every other caller still blanks, because they genuinely have nothing to put
+   * in its place (workspace switch, blank draft, session delete).
+   */
+  /** Blank a conversation that was held over for a swap that never happened. */
+  function settlePendingSessionSwap() {
+    if (!pendingSessionSwapRef.current) {
+      return;
+    }
+    pendingSessionSwapRef.current = false;
     setMessages([]);
+  }
+
+  function clearSessionView(options: { keepMessages?: boolean } = {}) {
+    if (!options.keepMessages) {
+      setMessages([]);
+    }
     // Scoped to the session it was committed in — leaving it set would splice a
     // turn from the previous conversation into the next one.
     pendingCommittedAssistantTurnsRef.current = [];
@@ -4924,6 +4950,7 @@ export function ChatPane({
     parentSessionId?: string | null,
     projectId?: string | null,
     owningAppId?: string | null,
+    firstUserText?: string | null,
   ): Promise<string | null> {
     const created = await window.electronAPI.workspace.createAgentSession({
       workspace_id: workspaceId,
@@ -4932,6 +4959,13 @@ export function ChatPane({
       project_id: projectId ?? null,
       created_by: "workspace_user",
       app_id: owningAppId ?? null,
+      // Titles the session at creation. The sidebar hides titleless sessions as
+      // empty placeholders, and the title used to be written only when the
+      // input was queued — so the row appeared not when the session was created
+      // but whenever the send finished assembling, seconds later. The runtime
+      // derives it, so the rules for attachments and image-only sends stay in
+      // one place.
+      first_user_text: firstUserText?.trim() || null,
     });
     const sessionId = created.session.session_id.trim();
     if (sessionId) {
@@ -7259,7 +7293,12 @@ export function ChatPane({
 
     if (pendingSessionTarget) {
       consumeSessionOpenRequest(pendingSessionTarget.requestKey);
-      clearSessionView();
+      // Hold the outgoing conversation on screen until this send has its own
+      // first message to replace it with. Creating the session is an IPC round
+      // trip, and blanking before it leaves the canvas empty for the whole of
+      // it. The swap happens where the optimistic user message is appended.
+      pendingSessionSwapRef.current = true;
+      clearSessionView({ keepMessages: true });
       if (pendingSessionTarget.mode === "session") {
         setActiveSession(pendingSessionTarget.sessionId);
       } else {
@@ -7340,6 +7379,10 @@ export function ChatPane({
         }
       } catch (error) {
         setChatErrorMessage(normalizeErrorMessage(error));
+        // The swap never happened, so the held-over conversation belongs to a
+        // session we are no longer in. Blank it now rather than leave it under
+        // the wrong session.
+        settlePendingSessionSwap();
         return;
       }
     }
@@ -7355,6 +7398,7 @@ export function ChatPane({
         draftParentSessionId,
         selectedChatProjectId,
         owningAppId,
+        text,
       );
       if (targetSessionId) {
         draftParentSessionIdRef.current = null;
@@ -7388,6 +7432,7 @@ export function ChatPane({
     }
     if (!targetSessionId) {
       setChatErrorMessage("No active session found for this workspace.");
+      settlePendingSessionSwap();
       return;
     }
     blankDraftActiveRef.current = false;
@@ -7617,8 +7662,15 @@ export function ChatPane({
       };
 
       shouldAutoScrollRef.current = true;
+      // A pending swap means the list still holds the PREVIOUS session's
+      // conversation, kept there so the canvas never went blank. Consumed
+      // unconditionally: queueing onto an active run takes the branch below
+      // that adds no message
```

---

### Incident Patch 11: `2e8589fe` (2026-08-19)
**Commit Message**: fix(desktop): stop the end-of-turn flash, and show a new session in the sidebar immediately (#528)

* fix(desktop): show a newly created session in the sidebar immediately

Sending the first message of a new session created it server-side and selected
it in the pane, while the sidebar had no row for it — for up to a full 5s poll
interval. The session the user had just started existed nowhere on screen.

The main-session lists are poll-driven, which is right for change caused
elsewhere and wrong for change this client just made. Four components call
useWorkspaceMainSessions and each holds its own state, so creation now
broadcasts and every subscriber reloads at once.

The signal deliberately carries no session row. createAgentSession returns an
AgentSessionRecordPayload, which is not a MainSessionRecordPayload — it has no
is_active — so an optimistic insert would mean inventing that field and putting
a row on screen whose state was guessed rather than observed. A reload is one
local IPC, so the row still appears immediately; it is the server's row instead
of ours.

Both creation paths broadcast: the composer's first send and the app/main
session path. A guard pins that, that the lis

**File**: `apps/desktop/src/components/layout/shell/mainSessionsRefresh.test.ts` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import assert from "node:assert/strict";
+import { readFileSync } from "node:fs";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+import { test } from "node:test";
+
+/**
+ * A session created from the composer must appear in the sidebar immediately.
+ *
+ * The main-session lists are poll-driven at 5s. That is fine for change caused
+ * elsewhere, but wrong for change this client just made: after sending the
+ * first message of a new session, the session existed server-side and was
+ * selected in the pane, while the sidebar had no row for it for up to a full
+ * poll interval — the session the user had just started was on screen nowhere.
+ *
+ * Structural, in a `.test.ts` deliberately: `test:unit` globs `.test.ts` /
+ * `.test.tsx`, so a guard written as `.mjs` under src/ would never run.
+ */
+
+const here = path.dirname(fileURLToPath(import.meta.url));
+const listsSource = readFileSync(
+  path.join(here, "useWorkspaceLists.ts"),
+  "utf-8",
+);
+const chatPaneSource = readFileSync(
+  path.join(here, "..", "..", "panes", "ChatPane", "index.tsx"),
+  "utf-8",
+);
+
+test("the main-sessions hook refreshes on a broadcast, not only on its poll", () => {
+  assert.match(
+    listsSource,
+    /export function notifyMainSessionsChanged\(\): void/,
+    "the broadcast helper must exist and take no payload",
+  );
+  assert.match(
+    listsSource,
+    /addEventListener\(MAIN_SESSIONS_CHANGED/,
+    "useWorkspaceMainSessions must subscribe to it",
+  );
+  assert.match(
+    listsSource,
+    /removeEventListener\(MAIN_SESSIONS_CHANGED/,
+    "and unsubscribe on cleanup, or every remount leaks a listener that reloads forever",
+  );
+});
+
+test("the broadcast carries no fabricated session row", () => {
+  // createAgentSession returns an AgentSessionRecordPayload, which has no
+  // is_active and so is not a MainSessionRecordPayload. Inserting it
+  // optimistically would mean inventing that field — a row on screen whose
+  // state was guessed. A reload is one local IPC, so the row still appears
+  // immediately; it is just the server's row instead of ours.
+  const helper =
+    /export function notifyMainSessionsChanged\(\)[\s\S]*?\n}/.exec(listsSource)?.[0] ??
+    "";
+  assert.ok(helper.length > 0, "helper not found");
+  assert.doesNotMatch(
+    helper,
+    /is_active/,
+    "the signal must not carry a synthesized session record",
+  );
+});
+
+test("ChatPane broadcasts from every path that can make a session listable", () => {
+  // Three: the two creation paths, plus — critically — the point where the
+  // input is queued.
+  const calls = chatPaneSource.match(/notifyMainSessionsChanged\(\)/g) ?? [];
+  assert.equal(
+    calls.length,
+    3,
+    `expected creation paths plus the queue-accepted path, found ${calls.length}`,
+  );
+});
+
+test("the queue-accepted broadcast is the one that makes the row appear", () => {
+  // The sidebar hides titleless sessions (they are empty placeholders there),
+  // and the title is derived server-side from the first user message by the
+  // queue-input route. Broadcasting only at creation reloads a list in which
+  // the session is still untitled and therefore still filtered out — the row
+  // waits for the next 5s poll regardless. The broadcast has to happen after
+  // the queue call returns.
+  const afterAccept = /queueAccepted = true;[\s\S]{0,1200}?notifyMainSessionsChanged\(\)/.test(
+    chatPaneSource,
+  );
+  assert.ok(
+    afterAccept,
+    "expected a broadcast shortly after queueAccepted = true",
+  );
+});
```

**File**: `apps/desktop/src/components/layout/shell/useWorkspaceLists.ts` (modified, +34/-0)
```diff
@@ -281,6 +281,33 @@ function reconcileMainSessions(
 // `appId` scopes the list to one HolaApp's own sessions (the app session
 // dropdown). Omitted, the hook returns the workspace sidebar list, which the
 // runtime already strips of app-owned sessions.
+/**
+ * Immediate refresh signal for the main-session lists.
+ *
+ * The lists are poll-driven at POLL_INTERVAL_MS, which is fine for change that
+ * happens elsewhere but wrong for change this client just caused: creating a
+ * session from the composer left the sidebar without a row for it for up to a
+ * full poll interval, so the session the user had just started did not exist
+ * anywhere on screen.
+ *
+ * Four components call useWorkspaceMainSessions and each keeps its own state,
+ * so this is a broadcast rather than a shared cache: every subscriber reloads
+ * at once.
+ *
+ * It deliberately carries no payload. The creation call returns an
+ * AgentSessionRecordPayload, which is not a MainSessionRecordPayload — it has
+ * no is_active — and inventing that field to enable an optimistic insert would
+ * put a row on screen whose state was guessed rather than observed. A reload is
+ * one local IPC, so the row still appears immediately; it is simply the
+ * server's row rather than one we made up.
+ */
+const mainSessionsChanged = new EventTarget();
+const MAIN_SESSIONS_CHANGED = "main-sessions-changed";
+
+export function notifyMainSessionsChanged(): void {
+  mainSessionsChanged.dispatchEvent(new Event(MAIN_SESSIONS_CHANGED));
+}
+
 export function useWorkspaceMainSessions(
   workspaceId: string | null,
   appId?: string | null,
@@ -321,9 +348,16 @@ export function useWorkspaceMainSessions(
     };
     void load();
     const timer = window.setInterval(load, POLL_INTERVAL_MS);
+
+    const onChanged = () => {
+      void load();
+    };
+    mainSessionsChanged.addEventListener(MAIN_SESSIONS_CHANGED, onChanged);
+
     return () => {
       cancelled = true;
       window.clearInterval(timer);
+      mainSessionsChanged.removeEventListener(MAIN_SESSIONS_CHANGED, onChanged);
     };
   }, [workspaceId, appId, activeOrgId]);
 
```

**File**: `apps/desktop/src/components/panes/ChatPane/AssistantTurn/turnStatus.test.ts` (modified, +52/-4)
```diff
@@ -23,15 +23,30 @@ const exec = (steps: ChatTraceStep[]): ChatAssistantSegment => ({
   })),
 });
 
-test("interleaved completed turn yields one Worked-for anchor", () => {
+test("an interleaved turn that ends with its answer yields no anchor", () => {
+  // Was "yields one Worked-for anchor". The collapse-to-one-anchor intent is
+  // unchanged — it is pinned by the next test — but a turn that ends with its
+  // streamed answer now shows no anchor in EITHER state, so nothing appears
+  // when it settles and the layout stays put.
   const segments = [
     exec([step({ id: "a" })]),
     out("没找到你的 GitHub 用户名。"),
     exec([step({ id: "b" }), step({ id: "c" })]),
     out("GitHub 已连接。"),
   ];
-  const status = resolveTurnStatus(segments, { live: false, workedMs: 40_000 });
-  assert.deepEqual(status, {
+  assert.equal(resolveTurnStatus(segments, { live: false, workedMs: 40_000 }), null);
+});
+
+test("a turn that ends on an execution segment still gets exactly one anchor", () => {
+  // The original point of the test above: a turn interleaves tool phases with
+  // narration, and the anchor collapses that to one turn-wide fact rather than
+  // repeating per phase.
+  const segments = [
+    exec([step({ id: "a" })]),
+    out("没找到你的 GitHub 用户名。"),
+    exec([step({ id: "b" }), step({ id: "c" })]),
+  ];
+  assert.deepEqual(resolveTurnStatus(segments, { live: false, workedMs: 40_000 }), {
     label: "Worked for 40s",
     spinning: false,
     tone: "default",
@@ -60,9 +75,42 @@ test("live turn shows the active step, spinning, once", () => {
   });
 });
 
-test("live streaming of the final answer hides the top anchor", () => {
+test("a turn that ends with its answer shows no anchor, streaming or settled", () => {
+  // The end-of-turn drift. The anchor used to be absent while the answer
+  // streamed and present once the turn settled ("Worked for Ns"), so a row
+  // appeared the instant the agent stopped typing and pushed the answer, its
+  // timestamp and everything below it down.
   const segments = [exec([step({ id: "a" })]), out("后台已开始拉")];
   assert.equal(resolveTurnStatus(segments, { live: true }), null);
+  assert.equal(
+    resolveTurnStatus(segments, { live: false, workedMs: 9000 }),
+    null,
+    "the duration is not worth moving the layout for; the trace is still under Details",
+  );
+});
+
+test("anchor presence never changes when a turn settles", () => {
+  // The property that actually matters: whatever the anchor does, it must do
+  // the same thing on both sides of the live -> settled flip, or the layout
+  // shifts by a row at that exact moment.
+  const cases = [
+    ["ends with its answer", [exec([step({ id: "a" })]), out("done")]],
+    ["plain text reply", [out("hi there")]],
+    ["ends on an execution segment", [out("working"), exec([step({ id: "b" })])]],
+  ] as const;
+
+  for (const [name, segments] of cases) {
+    const streaming = resolveTurnStatus([...segments], { live: true });
+    const settled = resolveTurnStatus([...segments], {
+      live: false,
+      workedMs: 9000,
+    });
+    assert.equal(
+      streaming === null,
+      settled === null,
+      `${name}: anchor presence changed when the turn settled`,
+    );
+  }
 });
 
 test("terminal error wins over duration", () => {
```

**File**: `apps/desktop/src/components/panes/ChatPane/AssistantTurn/turnStatus.ts` (modified, +16/-0)
```diff
@@ -143,6 +143,22 @@ export function resolveTurnStatus(
       tone: "default",
     };
   }
+  // The same rule the live branch above uses: a turn that ends with its
+  // streamed answer gets no anchor.
+  //
+  // This is the fix for the end-of-turn drift, and it is a presence rule rather
+  // than a labelling one. The anchor was absent while the answer streamed and
+  // present once the turn settled, so a row appeared at the exact moment the
+  // agent stopped typing and pushed the answer, its timestamp and everything
+  // below it down. Anything that exists in only one of the two states moves the
+  // layout on the transition; the duration is not worth that, and the trace is
+  // still one click away under Details.
+  //
+  // A turn that ends on an execution segment keeps its anchor in BOTH states,
+  // so it does not move either.
+  if (lastSegment?.kind === "output") {
+    return null;
+  }
   // Only turns that actually ran tools get a "Worked for" anchor; a plain text
   // reply shouldn't sprout a duration line it never had.
   if (items.length === 0) {
```

**File**: `apps/desktop/src/components/panes/ChatPane/index.tsx` (modified, +18/-1)
```diff
@@ -276,7 +276,10 @@ import {
   parseModelError,
   type ParsedModelError,
 } from "./ModelErrorRecovery";
-import { useWorkspaceProjects } from "@/components/layout/shell/useWorkspaceLists";
+import {
+  notifyMainSessionsChanged,
+  useWorkspaceProjects,
+} from "@/components/layout/shell/useWorkspaceLists";
 import { useHolaAppCatalog } from "@/components/layout/shell/useHolaAppCatalog";
 import { useOpenIssueDetailTab } from "@/components/layout/shell/useOpenIssueDetailTab";
 import { AppLandingSuggestions } from "./AppLandingSuggestions";
@@ -4931,6 +4934,11 @@ export function ChatPane({
       app_id: owningAppId ?? null,
     });
     const sessionId = created.session.session_id.trim();
+    if (sessionId) {
+      // The sidebar lists poll every 5s. Without this the session the user just
+      // started has no row anywhere on screen until the next tick.
+      notifyMainSessionsChanged();
+    }
     return sessionId || null;
   }
 
@@ -7319,6 +7327,7 @@ export function ChatPane({
           if (!owningAppId) {
             setDesktopMainSession(created.session);
           }
+          notifyMainSessionsChanged();
           setActiveSession(targetSessionId);
           setSidebarSelectedSessionId(targetSessionId);
           setSelectedSessionForWorkspace(
@@ -7676,6 +7685,14 @@ export function ChatPane({
       queueAccepted = true;
       rememberSubmittedComposerInput(text, selectedWorkspace.id);
       setActiveSession(queued.session_id);
+      // The sidebar hides sessions with no title — a titleless session is an
+      // empty placeholder there — and the title is derived server-side from
+      // this first user message, by the queue-input route we just called. So
+      // broadcasting at creation was a step too early: the reload came back
+      // with the session still untitled and the sidebar rightly filtered it
+      // out, leaving the row to wait for the next 5s poll anyway. This is the
+      // first moment the row can actually render.
+      notifyMainSessionsChanged();
       appendStreamTelemetry({
         streamId: "-",
         transportType: "client",
```

**File**: `apps/desktop/src/components/panes/ChatPane/preserveCommittedAssistantTurns.test.ts` (modified, +77/-0)
```diff
@@ -100,3 +100,80 @@ test("several turns can be in flight at once", () => {
     "assistant-input-2",
   ]);
 });
+
+/**
+ * The turn came back present-but-bare.
+ *
+ * The history render rebuilds a turn's execution trace from its output events,
+ * and the conversation refresh does not wait for them. So the server's copy
+ * lands carrying the text but no trace, and the "Worked for Ns" anchor and
+ * Details disclosure blink out until a later rung fills them in — the flicker
+ * that survived preserving *absent* turns, because this turn was never absent.
+ */
+
+const withTrace = (id: string): ChatMessage => ({
+  id,
+  role: "assistant",
+  text: "Hey Jeff! What are we working on today?",
+  segments: [
+    { kind: "execution", items: [{ kind: "trace", id: "t1", label: "thinking" }] },
+    { kind: "output", text: "Hey Jeff! What are we working on today?" },
+  ] as ChatMessage["segments"],
+});
+
+const bare = (id: string): ChatMessage => ({
+  id,
+  role: "assistant",
+  text: "Hey Jeff! What are we working on today?",
+  segments: [{ kind: "output", text: "Hey Jeff! What are we working on today?" }],
+});
+
+test("a server copy without its trace does not replace the complete local one", () => {
+  const result = preserveCommittedAssistantTurns(
+    [{ id: "u1", role: "user", text: "hey" }, bare("a1")],
+    [withTrace("a1")],
+  );
+
+  assert.equal(result.length, 2, "must not duplicate the turn");
+  const assistant = result.find((message) => message.id === "a1");
+  assert.ok(
+    assistant?.segments?.some((segment) => segment.kind === "execution"),
+    "the execution trace must survive a refresh that arrived without it",
+  );
+});
+
+test("the server copy wins once it carries the trace", () => {
+  const server = withTrace("a1");
+  server.text = "server copy";
+  const result = preserveCommittedAssistantTurns([server], [withTrace("a1")]);
+  assert.equal(
+    result[0]?.text,
+    "server copy",
+    "the server's copy is authoritative once it is complete",
+  );
+});
+
+test("a turn that never had a trace is not held back", () => {
+  // A plain text reply runs no tools and gets no chrome; substituting for it
+  // would hold the local copy forever against a server copy that is correct.
+  const result = preserveCommittedAssistantTurns([bare("a1")], [bare("a1")]);
+  assert.equal(result.length, 1);
+  assert.equal(
+    settleCommittedAssistantTurns([bare("a1")], [bare("a1")]).length,
+    0,
+    "it must settle immediately",
+  );
+});
+
+test("settling waits for the trace, not just the id", () => {
+  assert.equal(
+    settleCommittedAssistantTurns([withTrace("a1")], [bare("a1")]).length,
+    1,
+    "present-but-bare is not caught up",
+  );
+  assert.equal(
+    settleCommittedAssistantTurns([withTrace("a1")], [withTrace("a1")]).length,
+    0,
+    "a complete server copy settles it",
+  );
+});
```

**File**: `apps/desktop/src/components/panes/ChatPane/preserveCommittedAssistantTurns.ts` (modified, +57/-4)
```diff
@@ -22,24 +22,67 @@ import type { ChatMessage } from "./types";
  * half of that symmetry: hold locally committed turns until the persisted turn
  * shows up, then let the server's copy win.
  */
+/**
+ * Does this turn carry the execution trace that renders its "Worked for Ns"
+ * anchor and Details disclosure?
+ *
+ * Mirrors the check the pane itself uses to decide a turn has execution
+ * content (index.tsx, hasExecutionOnlyContent). The trace lives in either
+ * shape: still-streaming turns accumulate `executionItems`, and a settled turn
+ * has them folded into an `execution` segment.
+ */
+function hasExecutionTrace(message: ChatMessage): boolean {
+  return (
+    (message.executionItems?.length ?? 0) > 0 ||
+    (message.segments?.some(
+      (segment) => segment.kind === "execution" && segment.items.length > 0,
+    ) ??
+      false)
+  );
+}
+
 export function preserveCommittedAssistantTurns(
   next: ChatMessage[],
   pending: ChatMessage[],
 ): ChatMessage[] {
   if (pending.length === 0) {
     return next;
   }
+  const pendingById = new Map(pending.map((message) => [message.id, message]));
+  // A turn can come back from the server PRESENT BUT BARE. The history render
+  // rebuilds the execution trace from that turn's output events, and the
+  // conversation refresh does not wait for them — so the server's copy arrives
+  // carrying the text but no trace, and the "Worked for Ns" anchor and Details
+  // disclosure disappear for a beat before the next rung fills them in. That is
+  // the flicker at the end of a turn that survived preserving absent turns:
+  // this one was never absent.
+  //
+  // While the server's copy is still missing a trace the local one has, the
+  // local copy is the more complete record and keeps rendering. Substituted
+  // whole rather than merged, so the trace keeps its original position relative
+  // to the text — a turn that interleaves tools and prose would be reordered by
+  // grafting segments back on.
+  let substituted = false;
+  const reconciled = next.map((message) => {
+    const local = pendingById.get(message.id);
+    if (!local || !hasExecutionTrace(local) || hasExecutionTrace(message)) {
+      return message;
+    }
+    substituted = true;
+    return local;
+  });
+
   const present = new Set(next.map((message) => message.id));
   // Anything the server now returns is authoritative — its copy carries
   // outputs, provenance and ids the local one never had, so a still-pending
   // turn is only appended while genuinely absent.
   const missing = pending.filter((message) => !present.has(message.id));
   if (missing.length === 0) {
-    return next;
+    return substituted ? reconciled : next;
   }
   // Appended, not spliced: these are always the newest turn in the session, and
   // the refresh that dropped them is by definition missing the tail.
-  return [...next, ...missing];
+  return [...reconciled, ...missing];
 }
 
 /**
@@ -54,6 +97,16 @@ export function settleCommittedAssistantTurns(
   if (pending.length === 0) {
     return pending;
   }
-  const present = new Set(rendered.map((message) => message.id));
-  return pending.filter((message) => !present.has(message.id));
+  const renderedById = new Map(rendered.map((message) => [message.id, message]));
+  return pending.filter((message) => {
+    const server = renderedById.get(message.id);
+    if (!server) {
+      return true;
+    }
+    // Present is not the same as caught up. Settling on id alone is what let
+    // the trace blink out: the local copy was dropped while the server's still
+    // had no execution events, leaving nothing to render the turn's chrome
+    // from. Hold it until the server's copy actually carries the trace.
+    return hasExecutionTrace(message) && !hasExecutionTrace(server);
+  });
 }
```

---

### Incident Patch 12: `84072335` (2026-08-19)
**Commit Message**: fix(runtime): let end-of-turn compaction finish — grace window (POSIX) and force-kill (Windows) (#526)

* fix(runtime): give end-of-turn compaction room to finish before the deferred kill

runner-worker SIGTERMs the runner ON the terminal event, and end-of-turn
compaction runs after that event — so compaction and the deferral's grace timer
start together. The grace was the entire budget compaction had, and it was
30 seconds.

Measured on a real session (claude-sonnet-5, 1M context window, so the
compaction threshold is 500k tokens):

  84k-token session    13.2s
  621k-token session   26.1s

Under four seconds of headroom on a session that had only just crossed the
threshold — and sessions above the threshold are the only ones that compact, so
that margin applied to every real compaction there is. Any larger session, or
any upstream slowness, and process.exit(0) killed the summarization mid-flight.

The cost of losing that race is not one missed compaction. A killed compaction
leaves the session uncompacted, so the next turn is larger, takes longer to
summarize, and is more likely to be killed again — the context ratchets up
until the model hard-fails.

Raised to 120s. This costs n

**File**: `.github/workflows/ci.yml` (modified, +36/-3)
```diff
@@ -47,6 +47,7 @@ env:
 jobs:
   desktop-typecheck:
     if: ${{ github.event_name != 'workflow_dispatch' }}
+    timeout-minutes: 20
     runs-on: ubuntu-latest
     env:
       ELECTRON_SKIP_BINARY_DOWNLOAD: "1"
@@ -118,6 +119,7 @@ jobs:
 
   runtime-tests:
     if: ${{ github.event_name != 'workflow_dispatch' }}
+    timeout-minutes: 20
     runs-on: ubuntu-latest
     steps:
       - name: Checkout
@@ -157,11 +159,39 @@ jobs:
       # pi already accepts Debian's `fdfind` as a system name for fd, so no
       # symlink is needed here.
       - name: Install search tools (rg, fd)
+        # rg and fd are real test dependencies here: pi-search-tool.ts and
+        # pi-find-tool.ts shell out to them, and pi.test.ts covers both.
+        #
+        # This step is what hung the job — twice, at 12+ minutes, never reaching
+        # the tests. It produced NO output before timing out, which rules out a
+        # slow mirror: apt was blocked before it made any request, waiting on
+        # the dpkg/apt lock that unattended-upgrades holds early in a runner's
+        # life. Acquire timeouts do not apply to a lock wait, which is why the
+        # first attempt at bounding this did not help.
+        #
+        # DPkg::Lock::Timeout is the setting that does apply. -qq is gone
+        # deliberately: it suppressed the "waiting for lock" line that would
+        # have identified this immediately.
+        timeout-minutes: 8
         run: |
-          if ! command -v rg >/dev/null || ! (command -v fd >/dev/null || command -v fdfind >/dev/null); then
-            sudo apt-get update -qq
-            sudo apt-get install -y -qq ripgrep fd-find
+          set -u
+          if command -v rg >/dev/null && (command -v fd >/dev/null || command -v fdfind >/dev/null); then
+            rg --version | head -1
+            exit 0
           fi
+          apt_opts="-o DPkg::Lock::Timeout=120 -o Acquire::Retries=2 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20"
+          for attempt in 1 2; do
+            echo "apt attempt ${attempt}"
+            if sudo apt-get ${apt_opts} update \
+               && sudo apt-get ${apt_opts} install -y ripgrep fd-find; then
+              break
+            fi
+            if [ "${attempt}" = "2" ]; then
+              echo "could not install search tools after 2 attempts" >&2
+              exit 1
+            fi
+            sleep 10
+          done
           rg --version | head -1
 
       # Covers every runtime package that isn't the api-server (which has its
@@ -188,6 +218,7 @@ jobs:
 
   sdk-app-sdk:
     if: ${{ github.event_name != 'workflow_dispatch' }}
+    timeout-minutes: 15
     runs-on: ubuntu-latest
     steps:
       - name: Checkout
@@ -218,6 +249,7 @@ jobs:
 
   runtime-api-server:
     if: ${{ github.event_name != 'workflow_dispatch' }}
+    timeout-minutes: 25
     runs-on: ubuntu-latest
     steps:
       - name: Checkout
@@ -250,6 +282,7 @@ jobs:
 
   packages:
     if: ${{ github.event_name != 'workflow_dispatch' }}
+    timeout-minutes: 15
     runs-on: ubuntu-latest
     steps:
       - name: Checkout
```

**File**: `runtime/api-server/src/in-process-termination.test.ts` (modified, +23/-0)
```diff
@@ -202,3 +202,26 @@ test("repeated signals during one turn do not stack grace timers", async () => {
     child.process.kill("SIGKILL");
   }
 });
+
+test("the deferral grace leaves real room for end-of-turn compaction", async () => {
+  // The grace timer's whole job is to outlast the slowest post-terminal work,
+  // and that is compaction. Because runner-worker signals ON the terminal
+  // event, compaction and this timer start together — the grace is the entire
+  // budget compaction gets.
+  //
+  // Measured on a real session (claude-sonnet-5, 1M context => 500k threshold):
+  // 13.2s to compact an 84k-token session, 26.1s for a 621k one. The old 30s
+  // default left under 4s of headroom on a session that had only just become
+  // eligible — and eligible sessions are the only ones that compact, so that
+  // margin applied to every real compaction there is.
+  //
+  // Pinned as a ratio rather than a literal so tightening the grace fails here
+  // instead of silently reintroducing the race.
+  const { IN_PROCESS_TERMINATION_GRACE_MS, MEASURED_MAX_COMPACTION_MS } =
+    await import("./ts-runner.js");
+
+  assert.ok(
+    IN_PROCESS_TERMINATION_GRACE_MS >= MEASURED_MAX_COMPACTION_MS * 3,
+    `grace ${IN_PROCESS_TERMINATION_GRACE_MS}ms leaves too little room for a ${MEASURED_MAX_COMPACTION_MS}ms compaction — a killed compaction leaves the session uncompacted, so the next turn is bigger and even likelier to be killed`,
+  );
+});
```

**File**: `runtime/api-server/src/runner-terminal-shutdown.test.ts` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { terminateRunnerAfterTerminalEvent } from "./runtime-shell.js";
+
+/**
+ * How the runner is terminated after its terminal event.
+ *
+ * End-of-turn compaction runs AFTER that event, and the event is what prompts
+ * the termination — so whatever happens here is compaction's entire budget. A
+ * 621k-token compaction was measured at 26.1s.
+ *
+ * The platform is injected because the bug being fixed is Windows-only and
+ * cannot be reproduced on this machine: `killChildProcess` ignores the
+ * requested signal on win32 and runs `taskkill /t /f`, a hard kill no handler
+ * can defer, so signalling there killed compaction outright on every turn.
+ */
+
+function fakeChild(): { killed: boolean; pid: number } {
+  return { killed: false, pid: 1234 };
+}
+
+function recordingKill() {
+  const calls: string[] = [];
+  return {
+    calls,
+    kill: (_child: unknown, signal: NodeJS.Signals) => {
+      calls.push(signal);
+    },
+  };
+}
+
+test("POSIX signals the runner so it can defer until the turn settles", () => {
+  const { calls, kill } = recordingKill();
+  const timer = terminateRunnerAfterTerminalEvent(fakeChild() as never, {
+    platform: "darwin",
+    kill: kill as never,
+  });
+
+  assert.deepEqual(calls, ["SIGTERM"], "SIGTERM is catchable on POSIX");
+  assert.equal(
+    timer,
+    null,
+    "no escalation timer: the runner's own grace is the bound, and a second one would cut compaction off at whichever fired first",
+  );
+});
+
+test("Windows does NOT signal, because any signal there is a hard kill", () => {
+  // The whole bug. `killChildProcess(child, "SIGTERM")` on win32 runs
+  // `taskkill /pid <pid> /t /f`. There is no catchable termination signal for a
+  // Node child on Windows, so sending one guarantees compaction is truncated.
+  const { calls, kill } = recordingKill();
+  const timer = terminateRunnerAfterTerminalEvent(fakeChild() as never, {
+    platform: "win32",
+    kill: kill as never,
+    forceAfterMs: 50,
+  });
+
+  assert.deepEqual(
+    calls,
+    [],
+    "signalling on Windows force-kills the process tree and truncates compaction",
+  );
+  assert.notEqual(timer, null, "but the wait must still be bounded");
+  if (timer) {
+    clearTimeout(timer);
+  }
+});
+
+test("Windows force-kills once the grace elapses", async () => {
+  // The runner normally exits on its own when the turn settles. This is the
+  // backstop for one that does not — the bound POSIX gets from the runner's own
+  // grace timer.
+  const { calls, kill } = recordingKill();
+  terminateRunnerAfterTerminalEvent(fakeChild() as never, {
+    platform: "win32",
+    kill: kill as never,
+    forceAfterMs: 20,
+  });
+
+  await new Promise((resolve) => setTimeout(resolve, 60));
+  assert.deepEqual(calls, ["SIGKILL"], "a wedged runner must still be reclaimed");
+});
+
+test("a runner that already exited is not killed again", async () => {
+  const { calls, kill } = recordingKill();
+  const child = fakeChild();
+  terminateRunnerAfterTerminalEvent(child as never, {
+    platform: "win32",
+    kill: kill as never,
+    forceAfterMs: 20,
+  });
+  // The normal case: the runner finishes compaction and exits by itself.
+  child.killed = true;
+
+  await new Promise((resolve) => setTimeout(resolve, 60));
+  assert.deepEqual(calls, [], "no gratuitous kill after a clean exit");
+});
+
+test("the Windows grace leaves room for a real compaction", () => {
+  // 26.1s measured for a 621k-token compaction. The default must clear it by a
+  // wide margin, since a truncated compaction leaves the session uncompacted
+  // and makes the next turn larger still.
+  const { calls, kill } = recordingKill();
+  const timer = terminateRunnerAfterTerminalEvent(fakeChild() as never, {
+    platform: "win32",
+    kill: kill as never,
+  });
+  assert.notEqual(timer, null);
+  assert.deepEqual(calls, [], "must not kill synchronously");
+  if (timer) {
+    // Node exposes the scheduled delay on the handle; assert the default is
+    // generous rather than trusting the constant by eye.
+    const delay = (timer as unknown as { _idleTimeout: number })._idleTimeout;
+    assert.ok(
+      delay >= 26_100 * 3,
+      `default grace ${delay}ms leaves too little room for a 26.1s compaction`,
+    );
+  }
+});
```

**File**: `runtime/api-server/src/runner-worker.ts` (modified, +4/-3)
```diff
@@ -9,6 +9,7 @@ import { fileURLToPath } from "node:url";
 
 import {
   killChildProcess,
+  terminateRunnerAfterTerminalEvent,
   quoteShellValue,
   runtimeShellKind,
   shellPathDelimiter,
@@ -839,7 +840,7 @@ export async function executeRunnerRequest(
         }
         if (TERMINAL_EVENT_TYPES.has(parsed.event_type as string)) {
           sawTerminal = true;
-          killChildProcess(child, "SIGTERM");
+          terminateRunnerAfterTerminalEvent(child);
         }
       }
     }
@@ -869,7 +870,7 @@ export async function executeRunnerRequest(
         }
         if (TERMINAL_EVENT_TYPES.has(parsed.event_type as string)) {
           sawTerminal = true;
-          killChildProcess(child, "SIGTERM");
+          terminateRunnerAfterTerminalEvent(child);
         }
       } else {
         appendSkippedLine(skippedLines, trailingLine);
@@ -1112,7 +1113,7 @@ export class NativeRunnerExecutor implements RunnerExecutorLike {
             clearTimeout(heartbeat);
           }
           clearWatchdogs();
-          killChildProcess(child, "SIGTERM");
+          terminateRunnerAfterTerminalEvent(child);
         }
       }
     });
```

**File**: `runtime/api-server/src/runtime-shell.ts` (modified, +63/-0)
```diff
@@ -111,6 +111,69 @@ export function killChildProcess(
   }
 }
 
+/**
+ * Bound on how long the runner may keep working after its terminal event
+ * before it is force-killed. Mirrors IN_PROCESS_TERMINATION_GRACE_MS in
+ * ts-runner (duplicated rather than imported — the dependency would be a cycle,
+ * and this file must stay free of runner internals).
+ */
+const RUNNER_POST_TERMINAL_GRACE_MS = 120_000;
+
+/**
+ * Terminate the runner after its terminal event — without cutting off the work
+ * that runs *after* that event.
+ *
+ * End-of-turn compaction runs after the terminal event, and the terminal event
+ * is exactly what prompts this call. A 621k-token compaction was measured at
+ * 26.1s, so anything that kills the runner promptly here truncates it, leaving
+ * the session uncompacted; the next turn is then larger and likelier to be
+ * truncated again.
+ *
+ * The two platforms need opposite treatment, which is the bug this fixes:
+ *
+ *  - POSIX: SIGTERM is catchable, so the runner defers it until the turn
+ *    settles and then leaves by draining its event loop. Unchanged.
+ *
+ *  - Windows: there is NO catchable termination signal for a Node child.
+ *    `child.kill("SIGTERM")` is an abrupt TerminateProcess, which is why
+ *    killChildProcess falls back to `taskkill /t /f` — a hard kill no handler
+ *    can defer. Signalling at all on Windows therefore guarantees compaction is
+ *    killed, every turn. So we send nothing and let the runner exit on its own,
+ *    with a force-kill as the backstop the POSIX side gets from the runner's
+ *    own grace timer.
+ *
+ * The Windows path predates the in-process harness: the spawned harness-host
+ * sat inside the same `/t` process tree, so it was killed just the same.
+ */
+export function terminateRunnerAfterTerminalEvent(
+  child: ChildLike,
+  options: {
+    platform?: NodeJS.Platform;
+    forceAfterMs?: number;
+    kill?: (child: ChildLike, signal: NodeJS.Signals) => void;
+  } = {},
+): NodeJS.Timeout | null {
+  const platform = options.platform ?? process.platform;
+  const kill = options.kill ?? killChildProcess;
+
+  if (platform !== "win32") {
+    kill(child, "SIGTERM");
+    // No escalation: the runner's own grace timer is the bound on POSIX, and
+    // adding a second one here would cut compaction off at whichever fires
+    // first — reintroducing the race from the other side.
+    return null;
+  }
+
+  const forceAfterMs = options.forceAfterMs ?? RUNNER_POST_TERMINAL_GRACE_MS;
+  const timer = setTimeout(() => {
+    if (!child.killed) {
+      kill(child, "SIGKILL");
+    }
+  }, forceAfterMs);
+  timer.unref?.();
+  return timer;
+}
+
 export function buildPortListenerKillCommand(
   ports: number[],
   platform: NodeJS.Platform = process.platform,
```

**File**: `runtime/api-server/src/ts-runner.ts` (modified, +36/-2)
```diff
@@ -1819,9 +1819,43 @@ function parseHarnessHostRunnerEvent(
  * signal indefinitely. With no turn in flight the signal behaves exactly as it
  * does today.
  */
-const IN_PROCESS_TERMINATION_GRACE_MS = Number(
+/**
+ * How long a deferred SIGTERM waits for the in-flight turn to settle.
+ *
+ * This has to cover END-OF-TURN COMPACTION, which is the slowest thing that
+ * runs after the terminal event — and the terminal event is exactly what makes
+ * runner-worker send the signal, so compaction and this timer start together.
+ *
+ * Measured against a real session (claude-sonnet-5, 1M context window, so the
+ * compaction threshold is 500k tokens):
+ *
+ *   84k-token session    13.2s
+ *   621k-token session   26.1s   <- a session that just crossed the threshold
+ *
+ * The previous 30s left under 4 seconds of margin on a compaction that had
+ * only just become eligible. Sessions above the threshold are the ONLY ones
+ * that compact, so that margin applied to every real compaction there is; a
+ * slightly larger session, or any upstream slowness, and the timer would kill
+ * the summarization mid-flight.
+ *
+ * The failure is self-reinforcing, which is what makes a tight bound expensive:
+ * a killed compaction leaves the session uncompacted, so the next turn is
+ * larger, takes longer to summarize, and is more likely to be killed again.
+ *
+ * Raising it costs little. The parent does not escalate to SIGKILL after the
+ * terminal event (runner-worker clears its watchdogs first), so this timer is
+ * the only bound — but it is a backstop, not the normal exit: the runner
+ * normally leaves by draining its event loop as soon as the turn settles. A
+ * longer grace delays nothing the user waits on, since the turn has already
+ * produced its result by the time the signal arrives.
+ */
+export const IN_PROCESS_TERMINATION_GRACE_MS = Number(
   process.env.HB_HARNESS_IN_PROCESS_GRACE_MS ?? "",
-) || 30_000;
+) || 120_000;
+
+/** Longest end-of-turn compaction measured on a real session, in ms. The grace
+ *  above must stay comfortably clear of this — see the note there. */
+export const MEASURED_MAX_COMPACTION_MS = 26_100;
 let inProcessTurnsActive = 0;
 let inProcessTerminationDeferred = false;
 let inProcessSignalGuardInstalled = false;
```

---

### Incident Patch 13: `e561ceed` (2026-08-19)
**Commit Message**: fix(release): stop packaging harness-host twice, and raise the open-file limit where it's used (#523)

* fix(release): stop packaging harness-host twice, and raise the limit where it's used

The macOS release failed with `EMFILE: too many open files` while signing,
on a path inside `api-server/node_modules`. Two independent causes.

First, the duplication, which I introduced. Wiring the in-process pi path
(14918ae) declared `@holaboss/runtime-harness-host` as an api-server
dependency, so runtime staging installed a full copy of harness-host inside
api-server — on top of the copy already staged as a sibling. Measured on the
staged tree: an exact 14,734-file / 473MB duplicate. Resolving the module by
PATH instead removes the dependency without changing behaviour, and staged
api-server drops 35,922 -> 17,279 files and 1.0G -> 183M.

Importing the sibling by path also strengthens the guarantee the dependency
was only satisfying by accident: there is now provably one harness-host build,
so the in-process path cannot drift from the spawned one or pick up an
unpatched copy of pi.

Second, the limit itself. Both workflows already raise `ulimit -n`, but they
do it in the *prepare* step, and

**File**: `apps/desktop/scripts/run-electron-builder.mjs` (modified, +57/-1)
```diff
@@ -83,7 +83,63 @@ if (
   );
 }
 
-const child = spawn(process.execPath, [electronBuilderCli, ...builderArgs], {
+/**
+ * Raise the open-file limit for electron-builder itself.
+ *
+ * Signing walks every file in the app bundle, and the staged runtime is tens of
+ * thousands of files; on macOS the default soft limit is 256, and exceeding it
+ * fails the build with `EMFILE: too many open files` on whichever file happened
+ * to be next — a misleading error that looks like a problem with that file.
+ *
+ * The workflows already raise the limit, but they do it in the *prepare* step,
+ * and `ulimit` does not survive into a later `run:` block — each step gets a
+ * fresh shell, so the electron-builder step has always run at the default. It
+ * belongs here instead: this wrapper is the one chokepoint every invocation
+ * goes through (CI and local packaging alike), so the limit cannot drift away
+ * from the command that needs it.
+ *
+ * `ulimit` is a shell builtin and Node exposes no setrlimit, so raising it means
+ * going through a shell. `"$@"` keeps argv intact rather than re-quoting it, and
+ * a failure to raise is non-fatal — the build then behaves exactly as it does
+ * today rather than not running at all.
+ *
+ * It raises only, never lowers: developer machines are commonly configured well
+ * above this floor (1048576 is typical on macOS), and setting the limit
+ * unconditionally would *reduce* it on exactly the machines that needed no help.
+ */
+const OPEN_FILE_LIMIT = 65536;
+// Moves the SOFT limit only, clamped to the hard limit. `ulimit -n` without a
+// flag sets soft *and* hard, and lowering the hard limit is irreversible for a
+// non-root process — so a plain `ulimit -n` here could leave the build worse off
+// than it started. Raising the soft limit toward hard is always permitted.
+const RAISE_OPEN_FILE_LIMIT = [
+  `soft="$(ulimit -Sn)"`,
+  `hard="$(ulimit -Hn)"`,
+  `target=${OPEN_FILE_LIMIT}`,
+  `if [ "$hard" != "unlimited" ] && [ "$hard" -lt "$target" ] 2>/dev/null; then`,
+  `  target="$hard"`,
+  `fi`,
+  `if [ "$soft" != "unlimited" ] && [ "$soft" -lt "$target" ] 2>/dev/null; then`,
+  `  ulimit -Sn "$target" 2>/dev/null || true`,
+  `fi`,
+  `exec "$@"`
+].join("\n");
+const useShellLimit = process.platform !== "win32";
+const [command, commandArgs] = useShellLimit
+  ? [
+      "/bin/sh",
+      [
+        "-c",
+        RAISE_OPEN_FILE_LIMIT,
+        "sh",
+        process.execPath,
+        electronBuilderCli,
+        ...builderArgs
+      ]
+    ]
+  : [process.execPath, [electronBuilderCli, ...builderArgs]];
+
+const child = spawn(command, commandArgs, {
   cwd: desktopRoot,
   env: {
     ...process.env,
```

**File**: `bun.lock` (modified, +0/-1)
```diff
@@ -406,7 +406,6 @@
         "@fastify/websocket": "^11.2.0",
         "@holaboss/remote-api": "workspace:*",
         "@holaboss/runtime-channel-gateway": "workspace:*",
-        "@holaboss/runtime-harness-host": "workspace:*",
         "@holaboss/runtime-state-store": "workspace:*",
         "@larksuiteoapi/node-sdk": "^1.67.0",
         "@modelcontextprotocol/sdk": "^1.28.0",
```

**File**: `runtime/api-server/package.json` (modified, +0/-1)
```diff
@@ -25,7 +25,6 @@
     "@fastify/websocket": "^11.2.0",
     "@holaboss/remote-api": "workspace:*",
     "@holaboss/runtime-channel-gateway": "workspace:*",
-    "@holaboss/runtime-harness-host": "workspace:*",
     "@holaboss/runtime-state-store": "workspace:*",
     "@larksuiteoapi/node-sdk": "^1.67.0",
     "@modelcontextprotocol/sdk": "^1.28.0",
```

**File**: `runtime/api-server/src/harness-in-process-boundary.test.ts` (added, +122/-0)
```diff
@@ -0,0 +1,122 @@
+import assert from "node:assert/strict";
+import fs from "node:fs";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+import { test } from "node:test";
+
+/**
+ * The api-server ↔ harness-host boundary, pinned from the api-server side.
+ *
+ * ts-runner runs pi in-process by importing harness-host's built entry point
+ * BY PATH and casting the result to a locally-declared interface. That cast is
+ * necessary — declaring the package as a dependency is what caused the failure
+ * below — but it also means TypeScript can no longer check that the two sides
+ * agree. These tests are what replaces that lost checking.
+ */
+
+const here = path.dirname(fileURLToPath(import.meta.url));
+const apiServerRoot = path.resolve(here, "..");
+const runtimeRoot = path.resolve(apiServerRoot, "..");
+
+test("api-server must not depend on harness-host", () => {
+  // Declaring this dependency made bun copy harness-host's entire tree into
+  // api-server/node_modules during runtime staging — a 14,734-file / 473MB
+  // duplicate of a package already staged as a sibling. It doubled the packaged
+  // file count and broke the signed macOS release with EMFILE, electron-builder
+  // exhausting its file descriptors partway through signing.
+  //
+  // The dependency also runs the wrong way round: harness-host is downstream of
+  // api-server's contracts, not upstream of them.
+  const manifest = JSON.parse(
+    fs.readFileSync(path.join(apiServerRoot, "package.json"), "utf8"),
+  ) as Record<string, Record<string, string> | undefined>;
+
+  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
+    assert.equal(
+      manifest[field]?.["@holaboss/runtime-harness-host"],
+      undefined,
+      `@holaboss/runtime-harness-host must not be in ${field} — it is staged as a sibling and duplicating it broke the macOS release with EMFILE`,
+    );
+  }
+});
+
+test("the staging rewrite table does not reintroduce the duplicate", () => {
+  // The rewrite table is what turns `workspace:*` into a real install during
+  // runtime staging, so an entry here recreates the duplication even if
+  // package.json is clean.
+  const staging = fs.readFileSync(
+    path.join(runtimeRoot, "deploy", "build_runtime_root.mjs"),
+    "utf8",
+  );
+  const rewrites = staging.slice(
+    staging.indexOf("WORKSPACE_SIBLING_REWRITES"),
+    staging.indexOf("WORKSPACE_SIBLING_REWRITES") + 2000,
+  );
+  assert.ok(
+    !rewrites.includes("@holaboss/runtime-harness-host"),
+    "harness-host must not be rewritten into api-server's install",
+  );
+});
+
+test("harness-host still exports the in-process contract ts-runner casts to", async () => {
+  // ts-runner declares this shape locally (HarnessHostInProcessModule) and casts
+  // the dynamic import to it. If harness-host renames the export or a result
+  // field, the cast keeps compiling and the failure only shows up at runtime as
+  // a turn that silently falls back to spawning — losing the whole in-process
+  // win with nothing but a warning to say so. This asserts the two agree.
+  const entry = path.join(runtimeRoot, "harness-host", "src", "index.ts");
+  assert.ok(fs.existsSync(entry), `harness-host entry missing at ${entry}`);
+
+  const module = (await import(entry)) as {
+    runPiInProcess?: (params: Record<string, unknown>) => Promise<unknown>;
+  };
+  const runPiInProcess = module.runPiInProcess;
+  assert.equal(
+    typeof runPiInProcess,
+    "function",
+    "ts-runner destructures runPiInProcess from this module",
+  );
+  assert.ok(runPiInProcess);
+
+  // Drive it with a stubbed pi, then assert every field ts-runner reads off the
+  // result is actually present — the fields, not just the function name.
+  const result = (await runPiInProcess({
+    requestPayload: { session_id: "s", input_id: "i" },
+    emitEvent: async () => {},
+    deps: {
+      runPi: async (
+        request: unknown,
+        deps: {
+          emitEvent?: (
+            request: unknown,
+            sequence: number,
+            eventType: string,
+            payload: Record<string, unknown>,
+          ) => void;
+        },
+      ) => {
+        deps.emitEvent?.(request, 1, "output_delta", {});
+        deps.emitEvent?.(request, 2, "run_completed", {});
+        return 0;
+      },
+      defaultPiDeps: () => ({}),
+    },
+  })) as Record<string, unknown>;
+
+  for (const field of [
+    "exitCode",
+    "stderr",
+    "sawEvent",
+    "terminalEmitted",
+    "lastSequence",
+    "harnessSpawnToFirstEventMs",
+    "harnessSpawnToFirstTokenMs",
+  ]) {
+    assert.ok(
+      field in result,
+      `ts-runner reads result.${field}; harness-host no longer returns it`,
+    );
+  }
+  assert.equal(result.terminalEmitted, true);
+  assert.equal(result.exitCode, 0);
+});
```

**File**: `runtime/api-server/src/ts-runner.ts` (modified, +57/-1)
```diff
@@ -1913,7 +1913,23 @@ const inProcessRunHarnessHost: TsRunnerExecutionDeps["runHarnessHost"] = async (
   installInProcessTerminationGuard(logger);
   inProcessTurnsActive += 1;
   try {
-    const { runPiInProcess } = await import("@holaboss/runtime-harness-host");
+    // Imported by PATH from the sibling harness-host build — the exact file the
+    // spawn path would have executed — rather than as a package dependency.
+    //
+    // Declaring the dependency made bun copy harness-host's whole tree into
+    // api-server/node_modules during runtime staging: a second 473MB / 14,734
+    // file copy of something already staged as a sibling. That bloated the app
+    // bundle and broke the signed macOS release with EMFILE, electron-builder
+    // running out of file descriptors while signing.
+    //
+    // Resolving by path also strengthens Blocker 0's guarantee instead of
+    // merely satisfying it: there is now provably ONE harness-host build, so
+    // the in-process path cannot drift from the spawned one or pick up an
+    // unpatched copy of pi.
+    const { entryPath } = harnessHostEntryPath();
+    const { runPiInProcess } = (await import(
+      pathToFileURL(entryPath).href
+    )) as HarnessHostInProcessModule;
     const result = await runPiInProcess({
       requestPayload: params.requestPayload,
       emitEvent: async (event) => {
@@ -1945,6 +1961,46 @@ const inProcessRunHarnessHost: TsRunnerExecutionDeps["runHarnessHost"] = async (
   }
 };
 
+/**
+ * The slice of harness-host's in-process entry point this module calls.
+ *
+ * Declared structurally rather than imported as
+ * `typeof import("@holaboss/runtime-harness-host")`, because that import is a
+ * real resolution even though it is type-only: it needs the package present in
+ * api-server's node_modules, which is exactly the duplication being removed
+ * above. The staged build catches this where the dev workspace does not — the
+ * workspace symlink makes it resolve locally, and it fails only in packaging.
+ *
+ * The duplication runs the same direction as `TERMINAL_EVENT_TYPES` in
+ * harness-host's in-process.ts: a small contract copied across the boundary
+ * rather than a dependency edge, because api-server must not depend on
+ * harness-host (the dependency runs the other way).
+ */
+interface HarnessHostInProcessModule {
+  runPiInProcess(params: {
+    requestPayload: unknown;
+    emitEvent: (event: {
+      session_id: string;
+      input_id: string;
+      sequence: number;
+      event_type: string;
+      timestamp: string;
+      payload: Record<string, unknown>;
+    }) => Promise<void>;
+    firstEventTimeoutMs?: number;
+    logger?: LoggerLike;
+  }): Promise<{
+    exitCode: number;
+    stderr: string;
+    sawEvent: boolean;
+    terminalEmitted: boolean;
+    lastSequence: number;
+    harnessSpawnToFirstEventMs?: number;
+    harnessSpawnToFirstTokenMs?: number;
+    postTerminalError?: string | null;
+  }>;
+}
+
 function harnessHostEntryPath(): { entryPath: string; argsPrefix: string[] } {
   const currentFile = fileURLToPath(import.meta.url);
   const runtimeRoot = runtimeRootDir();
```

**File**: `runtime/deploy/build_runtime_root.mjs` (modified, +0/-4)
```diff
@@ -162,10 +162,6 @@ const WORKSPACE_SIBLING_REWRITES = {
   "@holaboss/runtime-state-store": "file:../state-store",
   "@holaboss/remote-api": "file:../remote-api",
   "@holaboss/runtime-channel-gateway": "file:../channel-gateway",
-  // api-server calls into harness-host for the in-process pi path
-  // (HB_HARNESS_IN_PROCESS). harness-host is staged above api-server, so the
-  // sibling dir exists by the time api-server's install runs.
-  "@holaboss/runtime-harness-host": "file:../harness-host",
 };
 
 // Postinstall lifecycle scripts only run for packages listed here
```

---

### Incident Patch 14: `79b2a10c` (2026-08-19)
**Commit Message**: fix(runtime): reclaim dead sessions before truncating live ones

Retention was time-aware but not recency-aware, and that made it pick the wrong
victim. Every phase pruned by ROW age:

  phase 1  WHERE created_at < ?                    ORDER BY id ASC
  phase 2  GROUP BY session_id ORDER BY COUNT(*) DESC
  phase 3                                          ORDER BY id ASC

The oldest rows in the table are the early history of your longest-running
conversations, so a session used daily got its first months truncated while one
abandoned three weeks ago kept everything. Phase 2 was worse still: ordering by
COUNT(*) DESC goes after the biggest — and therefore most-used — sessions first.
Correct as a size bound, close to inverted as a choice of what to lose.

A new phase 0 reclaims whole sessions that have gone quiet, oldest-inactive
first, before any live session is touched. The signal already existed
(agent_sessions.updated_at, indexed); nothing new is tracked.

This costs the user little, which is what makes it the right trade: conversation
TEXT lives in session_messages and is never pruned, so a reclaimed chat still
opens and reads normally. What goes is the execution trace — 6,219 of

**File**: `runtime/api-server/src/db-maintenance.test.ts` (modified, +95/-0)
```diff
@@ -34,6 +34,37 @@ class FakeStore implements DbMaintenanceStore {
     }
   }
 
+  // sessionId -> last-activity ISO. Absent = treated as active, so the existing
+  // cases keep measuring exactly what they measured before.
+  sessionActivity = new Map<string, string>();
+  liveSessions = new Set<string>();
+
+  listRootInactiveSessionsWithOutputEvents(params: {
+    inactiveBeforeIso: string;
+    limit: number;
+  }): Array<{ sessionId: string; count: number; updatedAt: string }> {
+    const rows: Array<{ sessionId: string; count: number; updatedAt: string }> = [];
+    for (const [sessionId, arr] of this.events) {
+      const updatedAt = this.sessionActivity.get(sessionId);
+      if (!updatedAt || updatedAt >= params.inactiveBeforeIso) continue;
+      if (this.liveSessions.has(sessionId)) continue;
+      rows.push({ sessionId, count: arr.length, updatedAt });
+    }
+    rows.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
+    return rows.slice(0, params.limit);
+  }
+
+  pruneSessionOutputEventsWholesale(params: {
+    sessionId: string;
+    limit: number;
+  }): number {
+    const arr = this.events.get(params.sessionId);
+    if (!arr || arr.length === 0) return 0;
+    const removed = arr.splice(0, Math.min(params.limit, arr.length));
+    if (arr.length === 0) this.events.delete(params.sessionId);
+    return removed.length;
+  }
+
   countRootTurnRequestSnapshots(): number {
     return this.snapshots.length;
   }
@@ -554,3 +585,67 @@ test("snapshot retention is off when the policy is zeroed", () => {
     assert.equal(store.countRootTurnRequestSnapshots(), 50);
   });
 });
+
+
+test("dead sessions are reclaimed before a live one is touched", () => {
+  // The phases that existed before pruned by ROW age, which picks the wrong
+  // victim: the oldest rows belong to your longest-running conversations. A
+  // session used daily got truncated while one abandoned last month was left
+  // alone, and the per-session phase went after the BIGGEST sessions first.
+  const store = new FakeStore();
+  const old = new Date(Date.now() - 90 * 86_400_000).toISOString();
+  const recent = new Date().toISOString();
+
+  store.seed("dead", 30, recent);   // rows are NEW; the SESSION is old
+  store.sessionActivity.set("dead", old);
+  store.seed("alive", 30, old);     // rows are OLD; the session is in use
+  store.sessionActivity.set("alive", recent);
+
+  return runRuntimeDbMaintenance({ store, batchSize: 10 }).then((result) => {
+    assert.equal(result.deletedByInactiveSession, 30, "the dead session goes");
+    assert.equal(store.events.has("dead"), false);
+    assert.equal(
+      store.events.get("alive")?.length,
+      0,
+      "the live session's ancient rows still age out — but only after",
+    );
+  });
+});
+
+test("a session with a live run is never reclaimed, however old its timestamp", () => {
+  // A run paused mid-turn can carry an old updated_at. Pulling its trace out
+  // from under it is the one case where this would be visible to a user.
+  const store = new FakeStore();
+  const old = new Date(Date.now() - 90 * 86_400_000).toISOString();
+  store.seed("paused", 20, new Date().toISOString());
+  store.sessionActivity.set("paused", old);
+  store.liveSessions.add("paused");
+
+  return runRuntimeDbMaintenance({ store, batchSize: 10 }).then((result) => {
+    assert.equal(result.deletedByInactiveSession, 0);
+    assert.equal(store.events.get("paused")?.length, 20);
+  });
+});
+
+test("oldest-inactive sessions are reclaimed first", () => {
+  const store = new FakeStore();
+  const recent = new Date().toISOString();
+  const ages = [200, 120, 60];
+  ages.forEach((days, i) => {
+    store.seed(`s${i}`, 10, recent);
+    store.sessionActivity.set(
+      `s${i}`,
+      new Date(Date.now() - days * 86_400_000).toISOString(),
+    );
+  });
+
+  const scanned = store.listRootInactiveSessionsWithOutputEvents({
+    inactiveBeforeIso: new Date(Date.now() - 30 * 86_400_000).toISOString(),
+    limit: 10,
+  });
+  assert.deepEqual(
+    scanned.map((row) => row.sessionId),
+    ["s0", "s1", "s2"],
+    "most-dead first",
+  );
+});
```

**File**: `runtime/api-server/src/db-maintenance.ts` (modified, +80/-0)
```diff
@@ -36,6 +36,14 @@ export interface DbMaintenanceStore {
   // turn_request_snapshots — ~204KB/row, the largest row class in the DB, and
   // INSERT-only until this sweep learned to prune it.
   readonly turnRequestSnapshotRetentionPolicy: TurnRequestSnapshotRetentionPolicy;
+  listRootInactiveSessionsWithOutputEvents(params: {
+    inactiveBeforeIso: string;
+    limit: number;
+  }): Array<{ sessionId: string; count: number; updatedAt: string }>;
+  pruneSessionOutputEventsWholesale(params: {
+    sessionId: string;
+    limit: number;
+  }): number;
   countRootTurnRequestSnapshots(): number;
   pruneRootTurnRequestSnapshotsByAge(params: {
     cutoffIso: string;
@@ -136,6 +144,8 @@ export interface DbMaintenanceResult {
   deletedByAge: number;
   deletedByCap: number;
   /** Rows removed by the global ceiling, after the age + per-session phases. */
+  /** Events reclaimed from whole sessions that had gone inactive. */
+  deletedByInactiveSession: number;
   deletedByTotalCap: number;
   /** turn_request_snapshots removed by age or the global ceiling. */
   deletedSnapshots: number;
@@ -178,6 +188,7 @@ export async function runRuntimeDbMaintenance(
     aborted: false,
     deletedByAge: 0,
     deletedByCap: 0,
+    deletedByInactiveSession: 0,
     deletedByTotalCap: 0,
     deletedSnapshots: 0,
     compactionRequested: false,
@@ -260,6 +271,73 @@ export async function runRuntimeDbMaintenance(
     return result;
   }
 
+  // Phase 0 — reclaim whole sessions that have gone quiet.
+  //
+  // Runs FIRST because the phases below choose the wrong victim. They prune by
+  // ROW age, and the oldest rows in the table are the early history of your
+  // longest-running conversations — so a session used daily gets truncated
+  // while one abandoned last month is untouched. The per-session phase is worse
+  // still: it orders by COUNT(*) DESC, going after the biggest and therefore
+  // most-used sessions first.
+  //
+  // Reclaiming a dead session costs the user very little: conversation TEXT
+  // lives in session_messages and is never pruned, so the chat still opens and
+  // reads normally. What goes is the execution trace — ~99% of the rows and
+  // effectively all of the bytes. Sessions with a live runtime state are
+  // excluded by the query regardless of their timestamp.
+  if (policy.maxAgeDays > 0 && !signal?.aborted) {
+    const inactiveBeforeIso = new Date(
+      Date.now() - policy.maxAgeDays * 24 * 60 * 60 * 1000,
+    ).toISOString();
+    let inactive: Array<{ sessionId: string; count: number }> = [];
+    try {
+      inactive = store.listRootInactiveSessionsWithOutputEvents({
+        inactiveBeforeIso,
+        limit: 200,
+      });
+    } catch (error) {
+      logger?.error?.("db maintenance: inactive-session scan failed", {
+        error: error instanceof Error ? error.message : String(error),
+      });
+    }
+    for (const { sessionId } of inactive) {
+      if (signal?.aborted) {
+        break;
+      }
+      let consecutiveErrors = 0;
+      while (!signal?.aborted) {
+        let deleted = 0;
+        try {
+          deleted = store.pruneSessionOutputEventsWholesale({
+            sessionId,
+            limit: batchSize,
+          });
+          consecutiveErrors = 0;
+        } catch (error) {
+          if (!isTransientLock(error) || ++consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
+            logger?.error?.("db maintenance: inactive-session prune aborted", {
+              sessionId,
+              error: error instanceof Error ? error.message : String(error),
+            });
+            break;
+          }
+          if (!(await wait(pauseMs * consecutiveErrors))) {
+            break;
+          }
+          continue;
+        }
+        if (deleted === 0) {
+          break;
+        }
+        result.deletedByInactiveSession += deleted;
+        emitProgress("pruning", false);
+        if (!(await wait(pauseMs))) {
+          break;
+        }
+      }
+    }
+  }
+
   // Phase 1 — age-based pruning (oldest events first, batched).
   if (ageCutoffIso) {
     const cutoffIso = ageCutoffIso;
@@ -467,12 +545,14 @@ export async function runRuntimeDbMaintenance(
   result.aborted = Boolean(signal?.aborted);
 
   const totalDeleted =
+    result.deletedByInactiveSession +
     result.deletedByAge +
     result.deletedByCap +
     result.deletedByTotalCap +
     result.deletedSnapshots;
   if (totalDeleted > 0) {
     logger?.info?.("db maintenance: output-event retention sweep complete", {
+      deletedByInactiveSession: result.deletedByInactiveSession,
       deletedByAge: result.deletedByAge,
       deletedByCap: result.deletedByCap,
       deletedByTotalCap: result.deletedByTotalCap,
```

**File**: `runtime/state-store/src/store.ts` (modified, +71/-0)
```diff
@@ -6090,6 +6090,77 @@ export class RuntimeStateStore {
     return result.changes ?? 0;
   }
 
+  /**
+   * Sessions that have gone quiet, oldest-inactive first, that still hold
+   * output events.
+   *
+   * The retention phases below prune by ROW age, which picks the wrong victim:
+   * the oldest rows in the table are the early history of your longest-running
+   * conversations, so a session you use daily gets truncated while one you
+   * abandoned last month is untouched. The per-session phase is worse still —
+   * it orders by COUNT(*) DESC, so it goes after your biggest, most-used
+   * sessions first.
+   *
+   * This gives the sweep a targeted first pass: reclaim whole dead sessions
+   * before touching a live one at all. Conversation TEXT lives in
+   * session_messages and is never pruned, so a reclaimed session still opens
+   * and reads normally — what it loses is the execution trace, which is ~99% of
+   * the rows and all of the bytes.
+   *
+   * A session with a live runtime state is excluded regardless of its
+   * timestamp: a run paused mid-turn can have an old `updated_at`, and pulling
+   * its trace out from under it would be the one case where this is visible.
+   */
+  listRootInactiveSessionsWithOutputEvents(params: {
+    inactiveBeforeIso: string;
+    limit: number;
+  }): Array<{ sessionId: string; count: number; updatedAt: string }> {
+    if (params.limit <= 0) {
+      return [];
+    }
+    return this.rootRuntimeDb()
+      .prepare<
+        [string, number],
+        { sessionId: string; count: number; updatedAt: string }
+      >(`
+        SELECT e.session_id AS sessionId,
+               COUNT(*) AS count,
+               s.updated_at AS updatedAt
+        FROM session_output_events e
+        JOIN agent_sessions s ON s.session_id = e.session_id
+        LEFT JOIN session_runtime_state r ON r.session_id = e.session_id
+        WHERE s.updated_at < ?
+          AND COALESCE(r.status, 'IDLE') NOT IN ('BUSY', 'QUEUED')
+        GROUP BY e.session_id
+        ORDER BY s.updated_at ASC
+        LIMIT ?
+      `)
+      .all(params.inactiveBeforeIso, params.limit);
+  }
+
+  /** Delete a session's output events wholesale, up to `limit` this call.
+   *  Batched so the sweep never holds the write lock. */
+  pruneSessionOutputEventsWholesale(params: {
+    sessionId: string;
+    limit: number;
+  }): number {
+    if (params.limit <= 0) {
+      return 0;
+    }
+    const result = this.rootRuntimeDb()
+      .prepare(`
+        DELETE FROM session_output_events
+        WHERE id IN (
+          SELECT id FROM session_output_events
+          WHERE session_id = ?
+          ORDER BY id ASC
+          LIMIT ?
+        )
+      `)
+      .run(params.sessionId, params.limit);
+    return result.changes ?? 0;
+  }
+
   countRootTurnRequestSnapshots(): number {
     const row = this.rootRuntimeDb()
       .prepare(`SELECT COUNT(*) AS n FROM turn_request_snapshots`)
```

---

### Incident Patch 15: `5823f270` (2026-08-18)
**Commit Message**: fix(runtime): bound turn_request_snapshots, the last unpruned table

turn_request_snapshots was INSERT-only — nothing in the runtime ever deleted a
row. At a measured ~204KB each it is the largest row class in the DB, so it was
the one unbounded growth axis left after output-event retention landed. A stress
run put 3,000 turns at 1,826MB with ~612MB of snapshots that nothing would ever
reclaim: a second door into the same size that made PRAGMA quick_check take 80s
and livelock boot.

The sweep gains a fourth phase, same two shapes as the event phases — age, then
a global ceiling — batched and yielding exactly like the others so it never
holds the write lock. Defaults: 30 days (matching events) and 1,000 snapshots,
about 200MB, the same order as the event cap.

Deliberately NOT capped per session, and deliberately oldest-first. These rows
are not inert: reusableTurnRequestSnapshotTemplate scans a session's recent
snapshots to reuse an already-built request instead of rebuilding it, so
trimming newest-first would quietly cost a rebuild every turn. An oldest-first
global trim leaves an active session's reuse window intact and reclaims turns
that could never serve as a template again.


**File**: `runtime/api-server/src/db-maintenance.test.ts` (modified, +102/-0)
```diff
@@ -16,11 +16,57 @@ class FakeStore implements DbMaintenanceStore {
     // exactly what they measured before.
     maxTotalEvents: 0,
   };
+  // Off unless a test opts in, same reasoning as maxTotalEvents above.
+  turnRequestSnapshotRetentionPolicy = {
+    maxAgeDays: 0,
+    maxTotalSnapshots: 0,
+  };
   // sessionId -> array of event createdAt ISO strings (id order == array order).
   events = new Map<string, string[]>();
+  // Snapshot createdAt strings, oldest first — one entry per turn.
+  snapshots: string[] = [];
   compactionRequests = 0;
   failNextTrim = 0;
 
+  seedSnapshots(count: number, createdAt: string): void {
+    for (let i = 0; i < count; i++) {
+      this.snapshots.push(createdAt);
+    }
+  }
+
+  countRootTurnRequestSnapshots(): number {
+    return this.snapshots.length;
+  }
+
+  pruneRootTurnRequestSnapshotsByAge(params: {
+    cutoffIso: string;
+    limit: number;
+  }): number {
+    let deleted = 0;
+    while (
+      deleted < params.limit &&
+      this.snapshots.length > 0 &&
+      this.snapshots[0]! < params.cutoffIso
+    ) {
+      this.snapshots.shift();
+      deleted += 1;
+    }
+    return deleted;
+  }
+
+  trimRootTurnRequestSnapshotsToTotal(params: {
+    keep: number;
+    limit: number;
+  }): number {
+    const excess = this.snapshots.length - params.keep;
+    if (excess <= 0) {
+      return 0;
+    }
+    const batch = Math.min(excess, params.limit);
+    this.snapshots.splice(0, batch);
+    return batch;
+  }
+
   seed(sessionId: string, count: number, createdAt: string): void {
     const arr = this.events.get(sessionId) ?? [];
     for (let i = 0; i < count; i++) {
@@ -452,3 +498,59 @@ test("the ceiling trims oldest-first, so a quiet session keeps its recent histor
     "the older session absorbs the whole trim",
   );
 });
+
+
+test("the sweep prunes turn_request_snapshots by age", () => {
+  // This table was INSERT-only. At ~204KB a row it was the largest row class in
+  // the DB and the one unbounded axis left after output-event retention landed —
+  // a stress run put 3,000 turns at 1.8GB, ~612MB of it snapshots that nothing
+  // would ever reclaim.
+  const store = new FakeStore();
+  store.turnRequestSnapshotRetentionPolicy = {
+    maxAgeDays: 30,
+    maxTotalSnapshots: 0,
+  };
+  store.seedSnapshots(40, "2000-01-01T00:00:00.000Z");
+  store.seedSnapshots(10, new Date().toISOString());
+
+  return runRuntimeDbMaintenance({ store, batchSize: 7 }).then((result) => {
+    assert.equal(result.deletedSnapshots, 40);
+    assert.equal(store.countRootTurnRequestSnapshots(), 10, "recent ones stay");
+  });
+});
+
+test("the sweep enforces a global snapshot ceiling, oldest first", () => {
+  // Oldest-first matters: reusableTurnRequestSnapshotTemplate reuses a session's
+  // RECENT snapshots to skip rebuilding a request, so trimming newest-first
+  // would quietly cost a rebuild on every turn.
+  const store = new FakeStore();
+  store.turnRequestSnapshotRetentionPolicy = {
+    maxAgeDays: 0,
+    maxTotalSnapshots: 25,
+  };
+  const stamps = Array.from({ length: 60 }, (_, i) =>
+    new Date(Date.UTC(2030, 0, 1) + i * 86_400_000).toISOString(),
+  );
+  for (const stamp of stamps) {
+    store.seedSnapshots(1, stamp);
+  }
+
+  return runRuntimeDbMaintenance({ store, batchSize: 10 }).then((result) => {
+    assert.equal(result.deletedSnapshots, 35);
+    assert.equal(store.countRootTurnRequestSnapshots(), 25);
+    assert.deepEqual(
+      store.snapshots,
+      stamps.slice(35),
+      "the newest 25 survive, in order",
+    );
+  });
+});
+
+test("snapshot retention is off when the policy is zeroed", () => {
+  const store = new FakeStore();
+  store.seedSnapshots(50, "2000-01-01T00:00:00.000Z");
+  return runRuntimeDbMaintenance({ store }).then((result) => {
+    assert.equal(result.deletedSnapshots, 0);
+    assert.equal(store.countRootTurnRequestSnapshots(), 50);
+  });
+});
```

**File**: `runtime/api-server/src/db-maintenance.ts` (modified, +102/-2)
```diff
@@ -1,5 +1,8 @@
 import { setTimeout as sleep } from "node:timers/promises";
-import type { OutputEventRetentionPolicy } from "@holaboss/runtime-state-store";
+import type {
+  OutputEventRetentionPolicy,
+  TurnRequestSnapshotRetentionPolicy,
+} from "@holaboss/runtime-state-store";
 
 /**
  * Background maintenance for the runtime DB (`data.db`).
@@ -30,6 +33,18 @@ export interface DbMaintenanceStore {
     maxEvents: number;
     limit?: number;
   }): number;
+  // turn_request_snapshots — ~204KB/row, the largest row class in the DB, and
+  // INSERT-only until this sweep learned to prune it.
+  readonly turnRequestSnapshotRetentionPolicy: TurnRequestSnapshotRetentionPolicy;
+  countRootTurnRequestSnapshots(): number;
+  pruneRootTurnRequestSnapshotsByAge(params: {
+    cutoffIso: string;
+    limit: number;
+  }): number;
+  trimRootTurnRequestSnapshotsToTotal(params: {
+    keep: number;
+    limit: number;
+  }): number;
   requestRootDbCompaction(): void;
 }
 
@@ -122,6 +137,8 @@ export interface DbMaintenanceResult {
   deletedByCap: number;
   /** Rows removed by the global ceiling, after the age + per-session phases. */
   deletedByTotalCap: number;
+  /** turn_request_snapshots removed by age or the global ceiling. */
+  deletedSnapshots: number;
   compactionRequested: boolean;
 }
 
@@ -162,6 +179,7 @@ export async function runRuntimeDbMaintenance(
     deletedByAge: 0,
     deletedByCap: 0,
     deletedByTotalCap: 0,
+    deletedSnapshots: 0,
     compactionRequested: false,
   };
 
@@ -368,15 +386,97 @@ export async function runRuntimeDbMaintenance(
     }
   }
 
+  // Phase 4 — turn_request_snapshots. Same two shapes as the event phases (age,
+  // then a global ceiling), on the table that had no retention at all.
+  //
+  // Deliberately NOT capped per session: `reusableTurnRequestSnapshotTemplate`
+  // scans a session's recent snapshots to reuse an already-built request, and
+  // the oldest-first global trim leaves an active session's window intact while
+  // reclaiming turns that could never serve as a template again.
+  const snapshotPolicy = store.turnRequestSnapshotRetentionPolicy;
+  if (snapshotPolicy && !signal?.aborted) {
+    if (snapshotPolicy.maxAgeDays > 0) {
+      const cutoffIso = new Date(
+        Date.now() - snapshotPolicy.maxAgeDays * 24 * 60 * 60 * 1000,
+      ).toISOString();
+      let consecutiveErrors = 0;
+      while (!signal?.aborted) {
+        let deleted = 0;
+        try {
+          deleted = store.pruneRootTurnRequestSnapshotsByAge({
+            cutoffIso,
+            limit: batchSize,
+          });
+          consecutiveErrors = 0;
+        } catch (error) {
+          if (!isTransientLock(error) || ++consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
+            logger?.error?.("db maintenance: snapshot age prune aborted", {
+              error: error instanceof Error ? error.message : String(error),
+            });
+            break;
+          }
+          if (!(await wait(pauseMs * consecutiveErrors))) {
+            break;
+          }
+          continue;
+        }
+        if (deleted === 0) {
+          break;
+        }
+        result.deletedSnapshots += deleted;
+        emitProgress("pruning", false);
+        if (!(await wait(pauseMs))) {
+          break;
+        }
+      }
+    }
+    if (snapshotPolicy.maxTotalSnapshots > 0 && !signal?.aborted) {
+      let consecutiveErrors = 0;
+      while (!signal?.aborted) {
+        let deleted = 0;
+        try {
+          deleted = store.trimRootTurnRequestSnapshotsToTotal({
+            keep: snapshotPolicy.maxTotalSnapshots,
+            limit: batchSize,
+          });
+          consecutiveErrors = 0;
+        } catch (error) {
+          if (!isTransientLock(error) || ++consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
+            logger?.error?.("db maintenance: snapshot cap trim aborted", {
+              error: error instanceof Error ? error.message : String(error),
+            });
+            break;
+          }
+          if (!(await wait(pauseMs * consecutiveErrors))) {
+            break;
+          }
+          continue;
+        }
+        if (deleted === 0) {
+          break;
+        }
+        result.deletedSnapshots += deleted;
+        emitProgress("pruning", false);
+        if (!(await wait(pauseMs))) {
+          break;
+        }
+      }
+    }
+  }
+
   result.aborted = Boolean(signal?.aborted);
 
   const totalDeleted =
-    result.deletedByAge + result.deletedByCap + result.deletedByTotalCap;
+    result.deletedByAge +
+    result.deletedByCap +
+    result.deletedByTotalCap +
+    result.deletedSnapshots;
   if (totalDeleted > 0) {
     logger?.info?.("db maintenance: output-event retention sweep complete", {
       deletedByAge: result.deletedByAge,
       deletedByCap: result.deletedByCap,
       deletedByTotalCap: result.deletedByTotalCap,
+      deletedSnapshots: result.deletedSnapshots,
       aborted: result.aborted,
     });
   }
```

**File**: `runtime/state-store/scripts/stress-growth.mts` (modified, +17/-1)
```diff
@@ -164,6 +164,20 @@ const sweepStarted = process.hrtime.bigint();
 const pruned = reopened.trimRootOutputEventsToTotal({ keep: 250_000, limit: 5_000 });
 const sweepMs = ms(sweepStarted);
 
+// 4. Snapshot retention — the axis that had none until now.
+const snapshotsBefore = reopened.countRootTurnRequestSnapshots();
+const snapStarted = process.hrtime.bigint();
+let snapPruned = 0;
+for (;;) {
+  const deleted = reopened.trimRootTurnRequestSnapshotsToTotal({
+    keep: 1_000,
+    limit: 5_000,
+  });
+  if (deleted === 0) break;
+  snapPruned += deleted;
+}
+const snapMs = ms(snapStarted);
+
 const counted = reopened.countRootOutputEvents();
 reopened.close();
 
@@ -172,7 +186,9 @@ console.log("------------------------------------");
 console.log(`PRAGMA quick_check          ${quickCheckMs.toFixed(0).padStart(7)} ms   <- boot, after an unclean exit`);
 console.log(`load one session's events   ${readMs.toFixed(0).padStart(7)} ms   <- every conversation paint`);
 console.log(`retention sweep, 1 batch    ${sweepMs.toFixed(0).padStart(7)} ms   <- background`);
-console.log(`\nevents now: ${counted.toLocaleString()} (sweep removed ${pruned.toLocaleString()}), read ${events.length} rows`);
+console.log(`snapshot trim to 1,000      ${snapMs.toFixed(0).padStart(7)} ms   <- was unbounded before`);
+console.log(`\nsnapshots: ${snapshotsBefore.toLocaleString()} -> ${(snapshotsBefore - snapPruned).toLocaleString()}`);
+console.log(`events now: ${counted.toLocaleString()} (sweep removed ${pruned.toLocaleString()}), read ${events.length} rows`);
 console.log(
   `\nper-turn cost: ${((sizeBytes / (SESSIONS * TURNS_PER_SESSION)) / 1024).toFixed(0)} KB/turn`,
 );
```

**File**: `runtime/state-store/src/index.ts` (modified, +2/-0)
```diff
@@ -50,6 +50,8 @@ export {
   type MemoryVerificationPolicy,
   type RuntimeStateStoreOptions,
   type OutputEventRetentionPolicy,
+  type TurnRequestSnapshotRetentionPolicy,
+  DEFAULT_TURN_REQUEST_SNAPSHOT_RETENTION,
   DEFAULT_OUTPUT_EVENT_RETENTION,
   type OutputEventRecord,
   type OutputFolderRecord,
```

**File**: `runtime/state-store/src/store.ts` (modified, +106/-0)
```diff
@@ -1110,6 +1110,7 @@ export interface RuntimeStateStoreOptions {
    * {@link DEFAULT_OUTPUT_EVENT_RETENTION}; tests override with tiny values.
    */
   outputEventRetention?: Partial<OutputEventRetentionPolicy>;
+  turnRequestSnapshotRetention?: Partial<TurnRequestSnapshotRetentionPolicy>;
 }
 
 /**
@@ -1141,6 +1142,40 @@ export interface OutputEventRetentionPolicy {
  * sessions). Chosen with the product owner over the aggressive/conservative
  * alternatives.
  */
+/**
+ * Retention for `turn_request_snapshots`.
+ *
+ * That table was INSERT-only: nothing in the runtime ever deleted a row. At a
+ * measured ~204KB per turn it is the single largest row class there is, and it
+ * grew without bound — a stress run put 3,000 turns at 1,826MB, of which ~612MB
+ * was snapshots that would never be reclaimed. The output-event retention added
+ * earlier bounds events but not these, so a long-lived workspace would still
+ * walk into the size that made `PRAGMA quick_check` take 80s and livelock boot,
+ * just through a different door.
+ *
+ * These are not inert debug rows. `reusableTurnRequestSnapshotTemplate` scans a
+ * session's most recent snapshots to reuse an already-built request instead of
+ * rebuilding it, so the retention has to leave that window intact. The trims are
+ * therefore NEWEST-first-preserving: an active session keeps its recent
+ * snapshots, and what ages out belongs to turns that will never be reused as a
+ * template anyway.
+ */
+export interface TurnRequestSnapshotRetentionPolicy {
+  maxAgeDays: number;
+  maxTotalSnapshots: number;
+}
+
+export const DEFAULT_TURN_REQUEST_SNAPSHOT_RETENTION: TurnRequestSnapshotRetentionPolicy =
+  {
+    // Matches the event policy. A month-old snapshot cannot serve as a template
+    // for a live turn — its session is long finished.
+    maxAgeDays: 30,
+    // ~204KB/row, so 1,000 rows is ~200MB: the same order as the event cap, and
+    // far above the reuse window (that scan looks at 100 for ONE session). Only
+    // bites the runaway case it exists for.
+    maxTotalSnapshots: 1_000,
+  };
+
 export const DEFAULT_OUTPUT_EVENT_RETENTION: OutputEventRetentionPolicy = {
   maxAgeDays: 30,
   maxEventsPerSession: 25_000,
@@ -1599,6 +1634,7 @@ export class RuntimeStateStore {
   readonly sandboxAgentHarness: string | null;
   readonly #onMigrationEvent: ((event: MigrationLogEvent) => void) | undefined;
   readonly #outputEventRetention: OutputEventRetentionPolicy;
+  readonly #turnRequestSnapshotRetention: TurnRequestSnapshotRetentionPolicy;
   readonly #portInUseProbe: (port: number) => boolean;
   // In-process signal fired after each session_output_event insert, so the SSE
   // stream can wake on write instead of polling on a fixed interval — the
@@ -1638,6 +1674,10 @@ export class RuntimeStateStore {
       ...DEFAULT_OUTPUT_EVENT_RETENTION,
       ...(options.outputEventRetention ?? {}),
     };
+    this.#turnRequestSnapshotRetention = {
+      ...DEFAULT_TURN_REQUEST_SNAPSHOT_RETENTION,
+      ...(options.turnRequestSnapshotRetention ?? {}),
+    };
     this.sandboxAgentHarness = (options.sandboxAgentHarness ?? process.env.SANDBOX_AGENT_HARNESS ?? "").trim() || null;
     this.#portInUseProbe = options.portInUseProbe ?? defaultPortInUseProbe;
   }
@@ -5886,6 +5926,10 @@ export class RuntimeStateStore {
     return this.#outputEventRetention;
   }
 
+  get turnRequestSnapshotRetentionPolicy(): TurnRequestSnapshotRetentionPolicy {
+    return this.#turnRequestSnapshotRetention;
+  }
+
   /**
    * Enforce the per-session retention cap: keep the newest `maxEvents` rows for
    * `sessionId`, deleting older ones. Optionally bound the number deleted this
@@ -6046,6 +6090,68 @@ export class RuntimeStateStore {
     return result.changes ?? 0;
   }
 
+  countRootTurnRequestSnapshots(): number {
+    const row = this.rootRuntimeDb()
+      .prepare(`SELECT COUNT(*) AS n FROM turn_request_snapshots`)
+      .get() as { n?: number } | undefined;
+    return row?.n ?? 0;
+  }
+
+  /** Background-sweep primitive: delete snapshots older than `cutoffIso`, up to
+   *  `limit`. Batched so the sweep never holds the write lock. */
+  pruneRootTurnRequestSnapshotsByAge(params: {
+    cutoffIso: string;
+    limit: number;
+  }): number {
+    if (params.limit <= 0) {
+      return 0;
+    }
+    const result = this.rootRuntimeDb()
+      .prepare(`
+        DELETE FROM turn_request_snapshots
+        WHERE rowid IN (
+          SELECT rowid FROM turn_request_snapshots
+          WHERE COALESCE(updated_at, created_at) < ?
+          ORDER BY rowid ASC
+          LIMIT ?
+        )
+      `)
+      .run(params.cutoffIso, params.limit);
+    return result.changes ?? 0;
+  }
+
+  /**
+   * Background-sweep primitive: delete the OLDEST snapshots, keeping the table
+   * at or under `keep` rows total.
+   *
+   * Oldest-first for the same reason as the event trim: a global cap means
+   * "keep the newest N overall", and evicting by session size would let a 
```

#### Recent Merged Pull Requests:
- **PR #549** (closed): fix(harness-host): let Anthropic turns use the 1h prompt cache, not the 5m default (@jeffreyliimerch)
- **PR #548** (closed): fix(harnesses): clamp max_tokens to the model's own cap instead of stamping 128k (@jeffreyliimerch)
- **PR #547** (2026-08-21): fix(desktop): show a sentence, not raw JSON, when a run fails on credits (@jeffreyliimerch)
- **PR #544** (2026-08-21): fix(runtime): surface integration toolkits that failed to resolve (@jeffreyliimerch)
- **PR #543** (2026-08-21): fix(desktop): follow tools/list pagination so an app's later tools reach the agent (@jeffreyliimerch)
- **PR #542** (2026-08-21): fix(desktop): make the post-connect hook refresh tools instead of calling a deleted route (@jeffreyliimerch)
- **PR #541** (2026-08-21): fix(runtime): clip oversized embedding inputs so memory recall stops failing silently (@jeffreyliimerch)
- **PR #540** (2026-08-21): fix(runtime): invalidate the Composio tool listing when the resolved tool set changes (@jeffreyliimerch)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
