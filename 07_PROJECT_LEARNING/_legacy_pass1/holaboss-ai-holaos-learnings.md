# Forensic Learning Record (Deep Inspection): holaboss-ai/holaOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/holaboss-ai-holaos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/holaboss-ai/holaOS](https://github.com/holaboss-ai/holaOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:31:36.505Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `holaboss-ai/holaOS`
- **Description**: Open-source agentic workspace enterprises can make their own. Connect the systems you already run — 100+ integrations, MCP, chat tools, apps, browser, local files — with shared memory. Any agent (Claude Code, Codex), any model, or BYOK. Set up in clicks, not months. Local-first: your data never leaves your machines.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11454 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/desktop/electron/addressSuggestionsPopupPreload.ts`
```
import { contextBridge, ipcRenderer } from "electron";

interface AddressSuggestionPayload {
  id: string;
  url: string;
  title: string;
  faviconUrl?: string;
}

interface AddressSuggestionsStatePayload {
  suggestions: AddressSuggestionPayload[];
  selectedIndex: number;
}

contextBridge.exposeInMainWorld("addressSuggestions", {
  choose: (index: number) => ipcRenderer.invoke("browser:chooseAddressSuggestion", index) as Promise<void>,
  onSuggestionsChange: (listener: (payload: AddressSuggestionsStatePayload) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: AddressSuggestionsStatePayload) => listener(payload);
    ipcRenderer.on("addressSuggestions:update", wrapped);
    return () => ipcRenderer.removeListener("addressSuggestions:update", wrapped);
  }
});

```

### Core Architecture Module: `apps/desktop/electron/appSdkClient.ts`
```
import {
  createAppClient,
  type RequestConfig,
  type ResponseConfig,
} from "@holaboss/app-sdk/core";

/**
 * Main-process client factory for @holaboss/app-sdk. Built once and reused for
 * every call. The Cookie header is read fresh per request from the supplied
 * `getCookie` callback so rotated Better-Auth sessions work without a restart.
 * Mirrors the billingFetch pattern already used for the Better-Auth RPC.
 *
 * When `getCookie` returns an empty string the call still proceeds — some
 * marketplace endpoints are public (e.g. listing templates) and must work
 * before the user signs in. The server decides whether auth is required.
 */
export function buildAppSdkClient(options: {
  baseURL: string;
  getCookie: () => string;
  onUnauthorized?: () => void;
}) {
  const base = createAppClient({
    baseURL: options.baseURL,
    headers: undefined,
  });

  return async <TData, TError = unknown, TVariables = unknown>(
    config: RequestConfig<TVariables>
  ): Promise<ResponseConfig<TData>> => {
    const headers = new Headers();
    headers.set("Accept", "application/json");
    // Do NOT set credentials: "include" — we carry the cookie explicitly and
    // `credentials: include` would trigger Electron's fetch CORS preflight.
    const cookie = options.getCookie();
    if (cookie) {
      headers.set("Cookie", cookie);
    }
    for (const [key, value] of new Headers(
      (config.headers as HeadersInit | undefined) ?? undefined
    ).entries()) {
      headers.set(key, value);
    }

    try {
      return await base<TData, TError, TVariables>({
        ...config,
        headers,
      });
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status?: number }).status
          : undefined;
      if (status === 401 || status === 403) {
        options.onUnauthorized?.();
        // Re-throw with a diagnostic message so the caller can tell whether
        // the request was even carrying a cookie. This is the single biggest
        // source of "why am I 401" confusion on the desktop BFF path.
        const hadCookie = cookie.length > 0;
        const diagnostic = hadCookie
          ? `sent Cookie header (${cookie.length} bytes) but server rejected it`
          : "no Cookie header — Better-Auth session missing or expired. Sign in to desktop first.";
        // The SDK base client attaches the parsed response body to `.data`
        // on the error. Surface that so we can see Hono's actual reason.
        let bodyDump = "";
        const errData = (error as { data?: unknown }).data;
        if (errData !== undefined) {
          try {
            bodyDump = ` body=${JSON.stringify(errData)}`;
          } catch {
            bodyDump = ` body=<unserializable>`;
          }
        }
        // Cookie name hint — shows what names are in the cookie header so we
        // can tell whether Better-Auth's expected cookie (e.g. `better-auth.session_token`)
        // is present at all.
        const cookieNames = hadCookie
          ? cookie
              .split(/;\s*/)
              .map((kv) => kv.split("=")[0])
              .filter(Boolean)
              .join(",")
          : "";
        const cookieHint = cookieNames ? ` cookieNames=[${cookieNames}]` : "";
        const message = `Marketplace BFF returned ${status}: ${diagnostic}. Method=${config.method} URL=${config.url}${cookieHint}${bodyDump}`;
        const wrapped = new Error(message) as Error & {
          status?: number;
          originalError?: unknown;
        };
        wrapped.status = status;
        wrapped.originalError = error;
        throw wrapped;
      }
      throw error;
    }
  };
}

```

### Core Architecture Module: `apps/desktop/electron/appSurfacePreload.ts`
```
// Preload for the app-surface BrowserView (hosted HolaApp web pages).
//
// Exposes the versioned host bridge `window.__holabossHost`, which
// @holaboss/app-host wraps, so a hosted HolaApp page can request native
// desktop operations (e.g. open a chat with context).
//
// The hosted page is UNTRUSTED web content. This surface is intentionally
// small + allow-listed + versioned, and carries NO app/workspace identity —
// the main process derives that from the BrowserView that sent the message
// (it never trusts ids from the page). Channel/op names come from the shared
// protocol so the two sides cannot drift.
//
// See docs/plans/2026-06-23-holaapp-desktop-host-bridge.md.

import {
  BRIDGE_VERSION,
  HOST_COLOR_SCHEME_CHANGED,
  HOST_GLOBAL_KEY,
  HOST_IPC,
  type HostColorScheme,
  type HostOp,
} from "@holaboss/app-host/protocol";
import { contextBridge, ipcRenderer } from "electron";

// The desktop's light/dark scheme, mirrored to the hosted page so a surface
// doesn't sit in the app as a differently-themed website. Read synchronously at
// preload time (before any page script), so the page's boot script can set its
// theme class in the same tick and never paint a wrong-theme frame.
function readColorScheme(): HostColorScheme {
  try {
    return ipcRenderer.sendSync(HOST_IPC.colorScheme) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

let colorScheme = readColorScheme();
const colorSchemeListeners = new Set<(scheme: HostColorScheme) => void>();

ipcRenderer.on(HOST_COLOR_SCHEME_CHANGED, (_event, next: unknown) => {
  colorScheme = next === "dark" ? "dark" : "light";
  for (const listener of colorSchemeListeners) {
    try {
      listener(colorScheme);
    } catch {
      // A hosted page's listener must never break the others.
    }
  }
});

contextBridge.exposeInMainWorld(HOST_GLOBAL_KEY, {
  version: BRIDGE_VERSION,
  capabilities: (): Promise<HostOp[]> =>
    ipcRenderer.invoke(HOST_IPC.capabilities),
  invoke: (op: string, payload: unknown): Promise<unknown> =>
    ipcRenderer.invoke(HOST_IPC.invoke, { op, payload }),
  colorScheme: (): HostColorScheme => colorScheme,
  onColorSchemeChange: (listener: (scheme: HostColorScheme) => void): void => {
    colorSchemeListeners.add(listener);
  },
});

// Tell main the moment this page first paints content, so the surface is revealed
// at first-contentful-paint — like a browser — instead of staying hidden behind
// the "Opening…" spinner until did-finish-load (the whole page + every
// subresource). Re-runs per navigation (the preload re-executes on each document
// load); main scopes the signal to this BrowserView. Channel string is mirrored in
// main.ts (WEB_HOLAAPP_FIRST_PAINT_CHANNEL).
const FIRST_PAINT_CHANNEL = "appSurface:content-painted";
function reportFirstPaint(): void {
  try {
    ipcRenderer.send(FIRST_PAINT_CHANNEL);
  } catch {
    // Best-effort — main falls back to did-finish-load.
  }
}
try {
  const alreadyPainted = performance
    .getEntriesByType("paint")
    .some((entry) => entry.name === "first-contentful-paint");
  if (alreadyPainted) {
    reportFirstPaint();
  } else {
    const observer = new PerformanceObserver((list, obs) => {
      if (
        list.getEntries().some((e) => e.name === "first-contentful-paint")
      ) {
        obs.disconnect();
        reportFirstPaint();
      }
    });
    observer.observe({ type: "paint", buffered: true });
  }
} catch {
  // Paint-timing / PerformanceObserver unavailable in this context — main's
  // did-finish-load fallback still reveals the surface.
}

```

### Core Architecture Module: `apps/desktop/electron/attachment-staging.ts`
```
import path from "node:path";

const IMAGE_MIME_TYPES_BY_EXTENSION = new Map<string, string>([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".md", "text/markdown"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".pdf", "application/pdf"],
  [".txt", "text/plain"],
  [".json", "application/json"],
  [".csv", "text/csv"],
  [".ts", "text/typescript"],
  [".tsx", "text/tsx"],
  [".js", "text/javascript"],
  [".jsx", "text/jsx"],
  [".css", "text/css"],
  [".html", "text/html"],
]);

const PREVIEWABLE_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
]);

const HEIF_BRANDS = new Set([
  "heif",
  "mif1",
  "msf1",
]);

const AVIF_BRANDS = new Set([
  "avif",
  "avis",
]);

export function fallbackAttachmentMimeType(
  name: string,
  mimeType?: string | null,
): string {
  const normalized = (mimeType ?? "").trim().toLowerCase();
  if (normalized && normalized !== "application/octet-stream") {
    return normalized;
  }
  return (
    IMAGE_MIME_TYPES_BY_EXTENSION.get(path.extname(name).toLowerCase()) ??
    "application/octet-stream"
  );
}

export function detectAttachmentMimeTypeFromBytes(
  bytes: Uint8Array,
): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 2 &&
    bytes[0] === 0x42 &&
    bytes[1] === 0x4d
  ) {
    return "image/bmp";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
      .trim()
      .toLowerCase();
    if (HEIC_BRANDS.has(brand)) {
      return "image/heic";
    }
    if (HEIF_BRANDS.has(brand)) {
      return "image/heif";
    }
    if (AVIF_BRANDS.has(brand)) {
      return "image/avif";
    }
  }
  return null;
}

export function resolveStagedAttachmentMimeType(params: {
  name: string;
  declaredMimeType?: string | null;
  bytes: Uint8Array;
}): string {
  const normalized = (params.declaredMimeType ?? "").trim().toLowerCase();
  const detected = detectAttachmentMimeTypeFromBytes(params.bytes);
  if (detected) {
    return detected;
  }
  const fallback = fallbackAttachmentMimeType(params.name, params.declaredMimeType);
  if (
    normalized.startsWith("image/") &&
    normalized !== "image/svg+xml" &&
    !PREVIEWABLE_IMAGE_MIME_TYPES.has(normalized)
  ) {
    return "application/octet-stream";
  }
  if (
    fallback.startsWith("image/") &&
    fallback !== "image/svg+xml" &&
    !PREVIEWABLE_IMAGE_MIME_TYPES.has(fallback)
  ) {
    return "application/octet-stream";
  }
  if (normalized.startsWith("image/") && normalized !== "image/svg+xml") {
    return "application/octet-stream";
  }
  if (fallback.startsWith("image/") && fallback !== "image/svg+xml") {
    return "application/octet-stream";
  }
  return fallback;
}

export function stagedAttachmentKind(
  mimeType: string,
): "image" | "file" {
  return PREVIEWABLE_IMAGE_MIME_TYPES.has(mimeType.trim().toLowerCase())
    ? "image"
    : "file";
}

```

### Core Architecture Module: `apps/desktop/electron/authPopupPreload.ts`
```
import { contextBridge, ipcRenderer } from "electron";

import { loadDesktopEnv } from "./desktopEnv";

loadDesktopEnv();

interface AuthUserPayload {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  timezone?: string | null;
  [key: string]: unknown;
}

interface AuthErrorPayload {
  message?: string;
  status: number;
  statusText: string;
  path: string;
}

interface RuntimeConfigPayload {
  configPath: string | null;
  loadedFromFile: boolean;
  authTokenPresent: boolean;
  userId: string | null;
  sandboxId: string | null;
  modelProxyBaseUrl: string | null;
  defaultModel: string | null;
  subagentModel: string | null;
  defaultBackgroundModel: string | null;
  defaultImageModel: string | null;
  controlPlaneBaseUrl: string | null;
}

interface RuntimeConfigUpdatePayload {
  authToken?: string | null;
  modelProxyApiKey?: string | null;
  userId?: string | null;
  sandboxId?: string | null;
  modelProxyBaseUrl?: string | null;
  defaultModel?: string | null;
  subagentModel?: string | null;
  defaultBackgroundModel?: string | null;
  defaultImageModel?: string | null;
  controlPlaneBaseUrl?: string | null;
}

interface RuntimeStatusPayload {
  status: "disabled" | "missing" | "starting" | "running" | "stopped" | "error";
  available: boolean;
  runtimeRoot: string | null;
  sandboxRoot: string | null;
  executablePath: string | null;
  url: string | null;
  pid: number | null;
  harness: string | null;
  desktopBrowserReady: boolean;
  desktopBrowserUrl: string | null;
  startupMessage: string | null;
  lastError: string;
}

interface WorkspaceRecordPayload {
  id: string;
  name: string;
  status: string;
  harness: string | null;
  error_message: string | null;
  onboarding_status: string;
  onboarding_session_id: string | null;
  onboarding_completed_at: string | null;
  onboarding_completion_summary: string | null;
  onboarding_requested_at: string | null;
  onboarding_requested_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at_utc: string | null;
}

interface WorkspaceListResponsePayload {
  items: WorkspaceRecordPayload[];
  total: number;
  limit: number;
  offset: number;
}

// Sections the settings screen can actually render (SettingsScreenRoot's
// SETTINGS_NAV + its submissions branch). Kept identical in main.ts,
// preload.ts, authPopupPreload.ts and electron.d.ts.
//
// These four had drifted to four different lists, and three of the values they
// carried between them — "providers", "integrations", "about" — matched no
// render branch at all, so passing one opened Settings with a blank pane and
// no nav item selected.
type UiSettingsPaneSection =
  | "account"
  | "agents"
  | "billing"
  | "byok"
  | "channels"
  | "experimental"
  | "memory"
  | "settings"
  | "submissions";

const INTERNAL_DEV_BACKEND_OVERRIDES_ENABLED =
  Boolean(process.env.VITE_DEV_SERVER_URL) || process.env.HOLABOSS_INTERNAL_DEV?.trim() === "1";
const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, "");
const configuredRemoteBaseUrl = (...envNames: string[]): string => {
  for (const envName of envNames) {
    const value = normalizeBaseUrl(
      (INTERNAL_DEV_BACKEND_OVERRIDES_ENABLED ? process.env[envName]?.trim() || "" : "") || process.env[envName]?.trim() || ""
    );
    if (value) {
      return value;
    }
  }
  return "";
};
const serviceBaseUrlFromHost = (baseUrl: string, port: number): string => {
  try {
    const parsed = new URL(baseUrl);
    const protocol = parsed.protocol || "http:";
    const hostname = parsed.hostname;
    if (!hostname) {
      return "";
    }
    return `${protocol}//${hostname}:${port}`;
  } catch {
    return "";
  }
};
const BACKEND_BASE_URL = configuredRemoteBaseUrl("HOLABOSS_BACKEND_BASE_URL");
const CONTROL_PLANE_BASE_URL =
  configuredRemoteBaseUrl("HOLABOSS_DESKTOP_CONTROL_PLANE_BASE_URL") ||
  serviceBaseUrlFromHost(BACKEND_BASE_URL, 3060);
const DEFAULT_MODEL_PROXY_BASE_URL = CONTROL_PLANE_BASE_URL ? `${CONTROL_PLANE_BASE_URL}/api/v1/model-proxy` : "";
const DEFAULT_RUNTIME_MODEL = "openai/gpt-5.4";

contextBridge.exposeInMainWorld("authPopup", {
  getDefaults: () => ({
    modelProxyBaseUrl: DEFAULT_MODEL_PROXY_BASE_URL,
    defaultModel: DEFAULT_RUNTIME_MODEL
  }),
  getUser: () => ipcRenderer.invoke("auth:getUser") as Promise<AuthUserPayload | null>,
  requestAuth: () => ipcRenderer.invoke("auth:requestAuth") as Promise<void>,
  signOut: () => ipcRenderer.invoke("auth:signOut") as Promise<void>,
  setTheme: (theme: string) => ipcRenderer.invoke("ui:setTheme", theme) as Promise<void>,
  getRuntimeConfig: () => ipcRenderer.invoke("runtime:getConfig") as Promise<RuntimeConfigPayload>,
  getRuntimeStatus: () => ipcRenderer.invoke("runtime:getStatus") as Promise<RuntimeStatusPayload>,
  setRuntimeConfig: (payload: RuntimeConfigUpdatePayload) =>
    ipcRenderer.invoke("runtime:setConfig", payload) as Promise<RuntimeConfigPayload>,
  exchangeBinding: (sandboxId: string) => ipcRenderer.invoke("runtime:exchangeBinding", sandboxId) as Promise<RuntimeConfigPayload>,
  listWorkspaces: () => ipcRenderer.invoke("workspace:listWorkspaces") as Promise<WorkspaceListResponsePayload>,
  openSettingsPane: (section?: UiSettingsPaneSection) => ipcRenderer.invoke("ui:openSettingsPane", section) as Promise<void>,
  openExternalUrl: (url: string) => ipcRenderer.invoke("ui:openExternalUrl", url) as Promise<void>,
  scheduleClose: (delayMs?: number) => ipcRenderer.invoke("auth:scheduleClosePopup", delayMs) as Promise<void>,
  cancelClose: () => ipcRenderer.invoke("auth:cancelClosePopup") as Promise<void>,
  close: () => ipcRenderer.invoke("auth:closePopup") as Promise<void>,
  onAuthenticated: (listener: (user: AuthUserPayload) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, user: AuthUserPayload) => listener(user);
    ipcRenderer.on("auth:authenticated", wrapped);
    return () => ipcRenderer.removeListener("auth:authenticated", wrapped);
  },
  onUserUpdated: (listener: (user: AuthUserPayload | null) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, user: AuthUserPayload | null) => listener(user);
    ipcRenderer.on("auth:userUpdated", wrapped);
    return () => ipcRenderer.removeListener("auth:userUpdated", wrapped);
  },
  onError: (listener: (payload: AuthErrorPayload) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: AuthErrorPayload) => listener(payload);
    ipcRenderer.on("auth:error", wrapped);
    return () => ipcRenderer.removeListener("auth:error", wrapped);
  },
  onRuntimeConfigChange: (listener: (payload: RuntimeConfigPayload) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: RuntimeConfigPayload) => listener(payload);
    ipcRenderer.on("runtime:config", wrapped);
    return () => ipcRenderer.removeListener("runtime:config", wrapped);
  },
  onRuntimeStateChange: (listener: (payload: RuntimeStatusPayload) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: RuntimeStatusPayload) => listener(payload);
    ipcRenderer.on("runtime:state", wrapped);
    return () => ipcRenderer.removeListener("runtime:state", wrapped);
  },
  onOpened: (listener: () => void) => {
    const wrapped = () => listener();
    ipcRenderer.on("auth:opened", wrapped);
    return () => ipcRenderer.removeListener("auth:opened", wrapped);
  }
});

```

### Core Architecture Module: `apps/desktop/electron/bff-fetch.ts`
```
import { ipcMain, type IpcMainInvokeEvent } from "electron";

import {
  BFF_FETCH_CHANNEL,
  BFF_FETCH_FORBIDDEN_HEADERS,
  type BffFetchRequest,
  type BffFetchResponse,
} from "../shared/bff-fetch-protocol.js";

export type BffFetchHandlerDeps = {
  /**
   * Sync — current Better-Auth Cookie header. Empty string means no session.
   * Renderer never sees this value.
   */
  getCookieHeader: () => string;

  /**
   * Hosts the renderer may target. Hostnames only (e.g.
   * `api.holaboss.ai`), no scheme/port. Re-evaluated per request so config
   * reloads land without restart.
   */
  allowedHosts: () => readonly string[];

  /**
   * Registers the IPC handler. Pass `handleTrustedIpc` from main to apply
   * the project's standard sender-scope assertion; default registers via
   * `ipcMain.handle` directly.
   */
  register?: (
    channel: string,
    handler: (
      event: IpcMainInvokeEvent,
      req: BffFetchRequest
    ) => Promise<BffFetchResponse>
  ) => void;

  /**
   * Optional structured logger. Receives one of:
   *   { event: "bff_fetch.start", url, method }
   *   { event: "bff_fetch.success", url, status, durationMs }
   *   { event: "bff_fetch.error", url, error, durationMs }
   * Wire to Sentry/pino in main.
   */
  log?: (event: BffFetchLogEvent) => void;

  /** Per-request timeout (ms). Default 30000. */
  timeoutMs?: number;

  /** Delay before the single transient-error retry (ms). Default 200. */
  retryDelayMs?: number;
};

export type BffFetchLogEvent =
  | { event: "bff_fetch.start"; url: string; method: string }
  | {
      event: "bff_fetch.success";
      url: string;
      method: string;
      status: number;
      durationMs: number;
    }
  | {
      event: "bff_fetch.error";
      url: string;
      method: string;
      durationMs: number;
      error: string;
      /** Underlying undici cause (e.g. `EAI_AGAIN`, `ECONNRESET`) — empty when none. */
      cause?: string;
      /** Number of fetch attempts made (1 = no retry, 2 = retried once). */
      attempts: number;
    };

export class BffFetchAllowlistError extends Error {
  readonly url: string;
  constructor(url: string) {
    super(
      `bff:fetch refused — host not in allowlist for ${url}. Add it to allowedHosts() in main.`
    );
    this.name = "BffFetchAllowlistError";
    this.url = url;
  }
}

function isHostAllowed(url: string, allowedHosts: readonly string[]): boolean {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return false;
  }
  return allowedHosts.includes(host);
}

function sanitizeHeaders(input: Record<string, string>): Headers {
  const out = new Headers();
  for (const [key, value] of Object.entries(input)) {
    if (BFF_FETCH_FORBIDDEN_HEADERS.has(key.toLowerCase())) {
      // Drop silently — protocol comment documents this.
      continue;
    }
    out.set(key, value);
  }
  return out;
}

function serializeResponseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`bff:fetch timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Mirrors the main-process `fetchWithNetworkRetry` allow-set: a single transient
// DNS/socket blip (notably `EAI_AGAIN` from MagicDNS-style resolvers) otherwise
// surfaces to the renderer as an opaque `TypeError: fetch failed`.
const TRANSIENT_NETWORK_CODES: ReadonlySet<string> = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

type FetchErrorCause = { code?: string; name?: string; message?: string };

function fetchErrorCause(err: unknown): FetchErrorCause | undefined {
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    return cause as FetchErrorCause;
  }
  return undefined;
}

function isTransientFetchError(err: unknown): boolean {
  if (!(err instanceof TypeError)) {
    return false;
  }
  const cause = fetchErrorCause(err);
  if (!cause) {
    return false;
  }
  if (cause.code && TRANSIENT_NETWORK_CODES.has(cause.code)) {
    return true;
  }
  return cause.name === "SocketError";
}

/** Stable identifier for the failure: undici cause code/name, else message. */
function fetchErrorCode(err: unknown): string {
  const cause = fetchErrorCause(err);
  return cause?.code ?? cause?.name ?? (err instanceof Error ? err.message : String(err));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retryDelayMs: number
): Promise<{ response: Response; attempts: number }> {
  try {
    return { response: await fetchWithTimeout(url, init, timeoutMs), attempts: 1 };
  } catch (error) {
    if (!isTransientFetchError(error)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return { response: await fetchWithTimeout(url, init, timeoutMs), attempts: 2 };
  }
}

/**
 * Installs the `bff:fetch` IPC handler. Call once from main during boot.
 *
 * The handler:
 *   1. Validates the request URL is in the allowlist.
 *   2. Injects the current auth cookie (renderer never touches it).
 *   3. Forwards via Node fetch — server-side, no browser cookie policy.
 *   4. Serializes the response into JSON-safe shape and returns.
 */
export function installBffFetchHandler(deps: BffFetchHandlerDeps): void {
  const register = deps.register ?? defaultRegister;
  const timeoutMs = deps.timeoutMs ?? 30_000;
  const retryDelayMs = deps.retryDelayMs ?? 200;

  register(BFF_FETCH_CHANNEL, async (_event, req) => {
    const startedAt = Date.now();
    deps.log?.({
      event: "bff_fetch.start",
      url: req.url,
      method: req.method,
    });

    if (!isHostAllowed(req.url, deps.allowedHosts())) {
      throw new BffFetchAllowlistError(req.url);
    }

    const headers = sanitizeHeaders(req.headers);
    const cookie = deps.getCookieHeader();
    if (cookie) {
      headers.set("Cookie", cookie);
    }

    let response: Response;
    try {
      ({ response } = await fetchWithRetry(
        req.url,
        {
          method: req.method,
          headers,
          body: req.body,
          // The BFF doesn't redirect under normal flow; surface 3xx as-is so
          // the renderer can decide rather than silently following.
          redirect: "manual",
        },
        timeoutMs,
        retryDelayMs
      ));
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      const cause = fetchErrorCause(error);
      const causeCode = cause?.code ?? cause?.name;
      deps.log?.({
        event: "bff_fetch.error",
        url: req.url,
        method: req.method,
        durationMs,
        error: message,
        cause: causeCode,
        attempts: isTransientFetchError(error) ? 2 : 1,
      });
      // Re-throw with the cause folded into the message: undici's bare
      // `fetch failed` reaches the renderer over IPC with no detail, leaving
      // it undiagnosable.
      throw new Error(
        `bff:fetch ${req.method} ${req.url} failed: ${message} (${fetchErrorCode(error)})`
      );
    }

    const body = await response.text();
    const durationMs = Date.now() - startedAt;
    deps.log?.({
      event: "bff_fetch.success",
      url: req.url,
      method: req.method,
      status: response.status,
      durationMs,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: serializeResponseHeaders(response.headers),
      body,
    };
  });
}

functio
```

### Core Architecture Module: `apps/desktop/electron/browser-pane/cdp-cookie-transfer.ts`
```
/**
 * Windows-safe cookie transfer for imported Chrome profiles.
 *
 * WHY THIS EXISTS
 * Chrome on Windows (127+) protects its cookie key with **App-Bound Encryption**
 * (v20 cookies), unwrappable only by Chrome running on its ORIGINAL user-data-dir
 * via the elevation service. A raw file copy of the profile (see
 * import-chrome-profile.ts) therefore launches logged-OUT: the relocated Chrome
 * can't unwrap the app-bound key and drops the cookies. macOS has no such thing
 * (its key lives in the Keychain, portable across profile paths), so the copy is
 * enough there.
 *
 * THE FIX (this file)
 * Transfer DECRYPTED cookies over CDP instead of carrying encrypted blobs:
 *   1. Briefly launch the SOURCE Chrome on its own user-data-dir + profile with a
 *      debug port — the one context that CAN decrypt its app-bound cookies — and
 *      read them via Playwright (plaintext).  [captureCookiesFromChromeProfile]
 *   2. Stash them next to the target profile.   [writePendingImportedCookies]
 *   3. On the target profile's next launch, inject them over CDP; the target
 *      Chrome re-encrypts with ITS own key.     [see profileCdpAddCookies + main.ts]
 *
 * Best-effort: any failure (source Chrome open, binary missing, timeout) returns
 * an error string and the caller falls back to the plain copy + a warning. Google
 * specifically also uses device-bound sessions (DBSC) that may still re-challenge;
 * this fixes the general case (Reddit, most sites).
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import { chromium } from "playwright-core";

/** A cookie in the shape Playwright's `context.addCookies` accepts. */
export interface TransferableCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  /** Unix seconds; omitted for session cookies. */
  expires?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/** The subset of Playwright's cookie shape we read. */
export interface PlaywrightCookieLike {
  name?: string;
  value?: string;
  domain?: string;
  path?: string;
  /** Playwright uses -1 for a session cookie. */
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Map Playwright cookies onto the transfer shape, dropping already-expired ones
 * (session cookies are KEPT — they carry the live login). Pure + unit-testable.
 */
export function toTransferableCookies(
  cookies: PlaywrightCookieLike[],
  nowUnixSeconds: number,
): TransferableCookie[] {
  const out: TransferableCookie[] = [];
  for (const cookie of cookies) {
    const name = typeof cookie.name === "string" ? cookie.name : "";
    const domain = typeof cookie.domain === "string" ? cookie.domain : "";
    if (!name || !domain) {
      continue;
    }
    const isSession =
      typeof cookie.expires !== "number" || cookie.expires === -1;
    if (
      !isSession &&
      typeof cookie.expires === "number" &&
      cookie.expires <= nowUnixSeconds
    ) {
      continue; // already expired — nothing to carry
    }
    out.push({
      name,
      value: typeof cookie.value === "string" ? cookie.value : "",
      domain,
      path: cookie.path && cookie.path.trim() ? cookie.path : "/",
      httpOnly: Boolean(cookie.httpOnly),
      secure: Boolean(cookie.secure),
      ...(cookie.sameSite ? { sameSite: cookie.sameSite } : {}),
      ...(isSession ? {} : { expires: cookie.expires }),
    });
  }
  return out;
}

const CAPTURE_CONNECT_TIMEOUT_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** An OS-assigned free TCP port on loopback. */
async function findFreeLoopbackPort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        address && typeof address === "object" ? address.port : 0;
      server.close(() => {
        port ? resolve(port) : reject(new Error("could not allocate a port"));
      });
    });
  });
}

/** Force-kill a spawned Chrome and its child processes (renderers). */
function killChromeTree(child: ChildProcess): void {
  const pid = child.pid;
  if (!pid) {
    return;
  }
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // Best-effort; a stray temporary Chrome is harmless and exits on its own.
  }
}

export interface CaptureCookiesResult {
  cookies: TransferableCookie[];
  /** null on success; a human-readable reason when nothing was captured. */
  error: string | null;
}

/**
 * Launch the SOURCE Chrome on its own profile with a debug port and read its
 * decrypted cookies. Off-screen + non-headless: headless can skip the elevation
 * service that decrypts app-bound (v20) cookies, so we use a real (but off-screen,
 * 1×1) window and tear it down within seconds.
 *
 * Only works when the source Chrome is CLOSED — a second Chrome on a live
 * user-data-dir forwards to the running instance and exits, so the debug port
 * never opens and we time out (returned as an error for the caller to surface).
 */
export async function captureCookiesFromChromeProfile(opts: {
  /** Absolute path to the source browser's chrome/chromium executable. */
  chromeBinary: string;
  /** The source browser's user-data-dir (parent of the profile dir). */
  sourceUserDataDir: string;
  /** The profile directory NAME under the user-data-dir, e.g. "Default". */
  sourceProfileDirName: string;
  nowUnixSeconds?: number;
  /** Injectable for tests. */
  spawnImpl?: typeof spawn;
}): Promise<CaptureCookiesResult> {
  if (!existsSync(opts.chromeBinary)) {
    return { cookies: [], error: "Source browser executable was not found." };
  }
  if (!existsSync(opts.sourceUserDataDir)) {
    return { cookies: [], error: "Source browser profile folder no longer exists." };
  }

  let port: number;
  try {
    port = await findFreeLoopbackPort();
  } catch (error) {
    return {
      cookies: [],
      error: error instanceof Error ? error.message : "no free debug port",
    };
  }

  const spawnImpl = opts.spawnImpl ?? spawn;
  let child: ChildProcess | null = null;
  try {
    child = spawnImpl(
      opts.chromeBinary,
      [
        `--user-data-dir=${opts.sourceUserDataDir}`,
        `--profile-directory=${opts.sourceProfileDirName}`,
        `--remote-debugging-port=${port}`,
        "--remote-allow-origins=*",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-sync",
        "--disable-component-update",
        "--window-position=-32000,-32000",
        "--window-size=1,1",
        "about:blank",
      ],
      { detached: false, stdio: "ignore", windowsHide: true },
    );

    const deadline = Date.now() + CAPTURE_CONNECT_TIMEOUT_MS;
    let lastError: unknown;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        // Chrome exited immediately — almost always because the source Chrome is
        // already running and this launch forwarded to it, so no port opened.
        return {
          cookies: [],
          error:
            "The source browser is still open. Close it completely and re-import so its signed-in sessions can be carried over.",
        };
      }
      try {
        const browser = await chromium.connectOverCDP(
          `http://127.0.0.1:${port}`,
          { timeout: 1500 },
        );
        try {
          const context = browser.contexts()[0];
          const raw = context ? await context.cookies() : [];
          const now =
      
```

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
+      parse
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
+    "This request costs more than your remaining bala
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
+  // which an earlier
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
+ *  ne
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
   if
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
+  const result = await fetchAllMcpToolNames
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
+  params: FetchAllMcpToolNamesParam
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
+ * account just like the dedicated servic
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
