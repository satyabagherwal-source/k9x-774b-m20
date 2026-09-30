# Forensic Learning Record (Deep Inspection): limecloud/lime

> **Canonical Artifact**: `07_PROJECT_LEARNING/limecloud-lime-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/limecloud/lime](https://github.com/limecloud/lime))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:58:18.325Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `limecloud/lime`
- **Description**: Full-stack AI agent for coding, files, terminals, tools, research, content, multimodal work, and multi-agent workflows.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1481 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `electron/appDataPaths.ts`
```
import os from "node:os";
import path from "node:path";

export const LIME_COMPANY_DATA_DIR_NAME = "LimeCloud";
export const LIME_APP_DATA_DIR_NAME = "lime";
export const LIME_HOST_DATA_DIR_NAME = "lime";
export const LIME_AGENT_ROOT_DIR_NAME = "app-server";
export const LIME_HOST_SESSION_DIR_NAME = "host-session";
export const WINDOWS_SQUIRREL_INSTALL_DIR_NAME = "lime";

export type AppDataRootOptions = {
  platform: NodeJS.Platform | string;
  hostUserData: string;
  appDataRootOverride?: string;
  localAppData?: string;
  home?: string;
};

export type AgentRootOptions = AppDataRootOptions & {
  agentRootOverride?: string;
};

export type DesktopStorageRootOptions = AgentRootOptions & {
  e2eMode: boolean;
  e2eUserDataDir?: string;
};

export type DesktopStorageRoots = {
  appDataRoot: string;
  agentRoot: string;
  hostSessionData: string;
};

/** Windows roaming data 只保存 host profile，不能成为 durable Agent root。 */
export function resolveAppDataRoot(options: AppDataRootOptions): string {
  const pathApi = pathForPlatform(options.platform);
  const override = nonEmptyPath(options.appDataRootOverride);
  if (override) {
    return assertOutsideWindowsInstallRoot(pathApi.resolve(override), options);
  }

  if (options.platform !== "win32") {
    return pathApi.resolve(options.hostUserData);
  }

  const localAppData = nonEmptyPath(options.localAppData);
  if (localAppData) {
    return assertOutsideWindowsInstallRoot(
      pathApi.resolve(
        localAppData,
        LIME_COMPANY_DATA_DIR_NAME,
        LIME_APP_DATA_DIR_NAME,
      ),
      options,
    );
  }

  const home = nonEmptyPath(options.home);
  if (home) {
    return assertOutsideWindowsInstallRoot(
      pathApi.resolve(
        home,
        "AppData",
        "Local",
        LIME_COMPANY_DATA_DIR_NAME,
        LIME_APP_DATA_DIR_NAME,
      ),
      options,
    );
  }

  throw new Error(
    "无法解析 Windows AppDataRoot：LOCALAPPDATA 或 Electron home 路径缺失",
  );
}

export function resolveAgentRoot(options: AgentRootOptions): string {
  const pathApi = pathForPlatform(options.platform);
  const override = nonEmptyPath(options.agentRootOverride);
  if (override) {
    return assertOutsideWindowsInstallRoot(pathApi.resolve(override), options);
  }

  return pathApi.join(resolveAppDataRoot(options), LIME_AGENT_ROOT_DIR_NAME);
}

/**
 * Chromium cookies/storage/network state 与 cache 的唯一根。
 * macOS 与 host profile 物理同根；Windows 必须离开 roaming `%APPDATA%`，
 * 落在 `<AppDataRoot>\host-session`。
 */
export function resolveHostSessionData(options: AppDataRootOptions): string {
  const pathApi = pathForPlatform(options.platform);
  if (options.platform !== "win32") {
    return pathApi.resolve(options.hostUserData);
  }

  return pathApi.join(
    resolveAppDataRoot(options),
    LIME_HOST_SESSION_DIR_NAME,
  );
}

export function resolveDesktopStorageRoots(
  options: DesktopStorageRootOptions,
): DesktopStorageRoots {
  const pathApi = pathForPlatform(options.platform);
  const e2eRoot = nonEmptyPath(options.e2eUserDataDir);
  if (options.e2eMode && !e2eRoot) {
    throw new Error(
      "E2E 模式缺少 ELECTRON_E2E_USER_DATA_DIR，拒绝解析真实数据根",
    );
  }

  const appDataRoot = resolveAppDataRoot({
    ...options,
    appDataRootOverride: options.e2eMode
      ? e2eRoot
      : options.appDataRootOverride,
  });
  const agentRoot = options.e2eMode
    ? pathApi.join(appDataRoot, LIME_AGENT_ROOT_DIR_NAME)
    : resolveAgentRoot({
        ...options,
        appDataRootOverride: appDataRoot,
      });
  // E2E 下 host profile 就是隔离根，不能让 sessionData 回到真实 userData。
  const hostSessionData = resolveHostSessionData({
    ...options,
    hostUserData: options.e2eMode ? appDataRoot : options.hostUserData,
    appDataRootOverride: appDataRoot,
  });

  return { appDataRoot, agentRoot, hostSessionData };
}

export function resolveCurrentDesktopStorageRoots(
  hostUserData: string,
): DesktopStorageRoots {
  return resolveDesktopStorageRoots({
    platform: process.platform,
    hostUserData,
    localAppData: process.env.LOCALAPPDATA,
    home: os.homedir(),
    e2eMode: process.env.LIME_ELECTRON_E2E === "1",
    e2eUserDataDir: process.env.ELECTRON_E2E_USER_DATA_DIR,
    agentRootOverride: process.env.LIME_AGENT_RUNTIME_ROOT,
  });
}

function pathForPlatform(platform: NodeJS.Platform | string): typeof path {
  return platform === "win32" ? path.win32 : path.posix;
}

function nonEmptyPath(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function assertOutsideWindowsInstallRoot(
  candidate: string,
  options: AppDataRootOptions,
): string {
  if (options.platform !== "win32") {
    return candidate;
  }

  const home = nonEmptyPath(options.home);
  const localAppData =
    nonEmptyPath(options.localAppData) ??
    (home ? path.win32.join(home, "AppData", "Local") : undefined);
  if (!localAppData) {
    return candidate;
  }

  const installRoot = path.win32.resolve(
    localAppData,
    WINDOWS_SQUIRREL_INSTALL_DIR_NAME,
  );
  if (isSameOrDescendantWindowsPath(candidate, installRoot)) {
    throw new Error(`Windows 数据根不能位于 Squirrel 安装根 ${installRoot}`);
  }
  return candidate;
}

function isSameOrDescendantWindowsPath(
  candidate: string,
  root: string,
): boolean {
  const normalizedCandidate = path.win32.resolve(candidate).toLowerCase();
  const normalizedRoot = path.win32.resolve(root).toLowerCase();
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}\\`)
  );
}

```

### Core Architecture Module: `electron/appServerCurrentTimeHost.ts`
```
import {
  ERROR_CODES,
  isJsonRpcRequest,
  METHOD_CURRENT_TIME_READ,
  type AppServerConnection,
  type CurrentTimeReadResponse,
  type JsonRpcMessage,
} from "@limecloud/app-server-client";

type CurrentTimeConnection = Pick<
  AppServerConnection,
  "respondServerRequest" | "rejectServerRequest"
>;

export function tryHandleCurrentTimeRead(
  connection: CurrentTimeConnection,
  message: JsonRpcMessage,
  now: () => number = Date.now,
): boolean {
  if (
    !isJsonRpcRequest(message) ||
    message.method !== METHOD_CURRENT_TIME_READ
  ) {
    return false;
  }

  const params = asRecord(message.params);
  if (
    typeof params?.threadId !== "string" ||
    params.threadId.trim().length === 0
  ) {
    connection.rejectServerRequest(message.id, {
      code: ERROR_CODES.invalidParams,
      message: "currentTime/read requires a non-empty threadId",
    });
    return true;
  }

  const currentTimeAt = Math.floor(now() / 1_000);
  if (!Number.isSafeInteger(currentTimeAt)) {
    connection.rejectServerRequest(message.id, {
      code: ERROR_CODES.runtimeError,
      message: "host clock is outside the supported Unix time range",
    });
    return true;
  }

  connection.respondServerRequest<CurrentTimeReadResponse>(message.id, {
    currentTimeAt,
  });
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

```

### Core Architecture Module: `electron/appServerDynamicToolHost.ts`
```
import {
  ERROR_CODES,
  isJsonRpcNotification,
  isJsonRpcRequest,
  METHOD_ITEM_TOOL_CALL,
  METHOD_TURN_COMPLETED,
  type AppServerConnection,
  type DynamicToolCallParams,
  type DynamicToolCallPhase,
  type DynamicToolCallResponse,
  type JsonRpcMessage,
  type JsonRpcRequest,
} from "@limecloud/app-server-client";
import { app } from "./electronRuntime";
import type {
  BrowserToolCall,
  BrowserToolResult,
  ElectronBrowserTabHost,
} from "./browserTabHost";
import process from "node:process";

const THREAD_START_METHOD = "thread/start";
const THREAD_RESUME_METHOD = "thread/resume";
const DESKTOP_NAMESPACE = "desktop";
const APP_INFO_TOOL = "appInfo";
const BROWSER_NAMESPACE = "browser";
const TERMINAL_TURN_STATUSES = new Set([
  "completed",
  "failed",
  "interrupted",
  "canceled",
  "cancelled",
]);

type DynamicToolConnection = Pick<
  AppServerConnection,
  "respondServerRequest" | "rejectServerRequest"
>;

export interface DynamicToolOwnerContext {
  ownerWebContentsId: number;
}

type AppInfo = {
  locale: string;
  name: string;
  platform: string;
  version: string;
};

type DynamicToolBinding = {
  namespace: string;
  runtimeName: string;
  tool: string;
};

type ThreadHostBinding = {
  ownerWebContentsId: number;
  tools: Map<string, DynamicToolBinding>;
};

type DynamicToolCallState = "awaitingApproval" | "completed";

const APP_INFO_BINDING = Object.freeze<DynamicToolBinding>({
  namespace: DESKTOP_NAMESPACE,
  runtimeName: `${DESKTOP_NAMESPACE}__${APP_INFO_TOOL}`,
  tool: APP_INFO_TOOL,
});

const BROWSER_TOOL_DEFINITIONS = Object.freeze([
  tool("openTabs", "List Browser tabs available to this conversation.", {}),
  tool(
    "newTab",
    "Open a new Agent-controlled tab in the visible Browser workspace.",
    { url: stringProperty("Initial http or https URL.") },
    ["url"],
  ),
  tool(
    "claimTab",
    "Claim an existing visible tab for the current turn.",
    {
      pageRevision: nonNegativeIntegerProperty(
        "Page revision returned by openTabs.",
      ),
      tabId: stringProperty("Tab id returned by openTabs."),
      title: stringProperty("Title returned by openTabs.", { allowEmpty: true }),
      url: stringProperty("URL returned by openTabs."),
    },
    ["tabId", "title", "url", "pageRevision"],
  ),
  tool(
    "releaseTab",
    "Release Agent control while keeping a user tab visible.",
    { tabId: stringProperty("Tab id to release.") },
    ["tabId"],
  ),
  tool(
    "goto",
    "Navigate the claimed tab to an http or https URL.",
    {
      tabId: stringProperty("Claimed tab id; defaults to the selected tab."),
      url: stringProperty("Destination URL."),
    },
    ["url"],
  ),
  tool(
    "observe",
    "Read the claimed tab URL, title, navigation state, and accessibility tree.",
    { tabId: stringProperty("Claimed tab id; defaults to the selected tab.") },
  ),
  tool("screenshot", "Capture the claimed tab as a PNG image.", {
    tabId: stringProperty("Claimed tab id; defaults to the selected tab."),
  }),
  tool(
    "click",
    "Click an actionable node from the latest observe result. Sensitive targets hand control to the user.",
    {
      backendNodeId: integerProperty("backendNodeId from observe."),
      snapshotId: stringProperty("snapshotId from observe."),
      tabId: stringProperty("Claimed tab id; defaults to the selected tab."),
    },
    ["backendNodeId", "snapshotId"],
  ),
  tool(
    "fill",
    "Replace text in an actionable field. Password or secret fields hand control to the user.",
    {
      backendNodeId: integerProperty("backendNodeId from observe."),
      snapshotId: stringProperty("snapshotId from observe."),
      tabId: stringProperty("Claimed tab id; defaults to the selected tab."),
      text: stringProperty("Text to enter."),
    },
    ["backendNodeId", "snapshotId", "text"],
  ),
  tool(
    "press",
    "Press a non-submitting key in the claimed tab. Enter hands control to the user.",
    {
      key: stringProperty("DOM key value such as Escape or ArrowDown."),
      snapshotId: stringProperty("snapshotId from observe."),
      tabId: stringProperty("Claimed tab id; defaults to the selected tab."),
    },
    ["key", "snapshotId"],
  ),
  tool(
    "markHandoff",
    "Keep the claimed tab for a later turn and release control when this turn ends.",
    { tabId: stringProperty("Claimed tab id; defaults to the selected tab.") },
  ),
  tool(
    "markDeliverable",
    "Keep the claimed tab as a user-visible deliverable when this turn ends.",
    { tabId: stringProperty("Claimed tab id; defaults to the selected tab.") },
  ),
  tool(
    "openArtifact",
    "Open a completed Browser download by its controlled artifact ref.",
    { artifactRef: stringProperty("Artifact ref returned by a completed download.") },
    ["artifactRef"],
  ),
  tool(
    "revealArtifact",
    "Reveal a completed Browser download in the system file manager.",
    { artifactRef: stringProperty("Artifact ref returned by a completed download.") },
    ["artifactRef"],
  ),
  tool(
    "copyArtifactRef",
    "Copy a controlled artifact ref to the system clipboard.",
    { artifactRef: stringProperty("Artifact ref returned by a completed download.") },
    ["artifactRef"],
  ),
  tool(
    "readClipboard",
    "Read the system clipboard after turn-scoped approval.",
    {},
  ),
  tool(
    "writeClipboard",
    "Write text to the system clipboard after turn-scoped approval.",
    { text: stringProperty("Text to write to the clipboard.") },
    ["text"],
  ),
  tool(
    "grantPermission",
    "Grant a pending Browser permission for this turn after explicit approval.",
    {
      permission: stringProperty("Permission name from browser-tab-permission-request."),
      requestId: stringProperty("Permission request id."),
    },
    ["permission", "requestId"],
  ),
  tool(
    "uploadArtifact",
    "Upload a completed Browser artifact into the current file input after approval.",
    {
      artifactRef: stringProperty("Artifact ref returned by a completed download."),
      backendNodeId: integerProperty("File input backendNodeId from observe."),
      snapshotId: stringProperty("snapshotId from observe."),
      tabId: stringProperty("Claimed tab id; defaults to the selected tab."),
    },
    ["artifactRef", "backendNodeId", "snapshotId"],
  ),
]);

const DESKTOP_DYNAMIC_TOOLS = Object.freeze([
  Object.freeze({
    type: "namespace",
    name: DESKTOP_NAMESPACE,
    description: "Read information exposed by the Lime desktop host.",
    tools: Object.freeze([
      tool(
        APP_INFO_TOOL,
        "Read the desktop application name, version, locale, and platform.",
        {},
      ),
    ]),
  }),
  Object.freeze({
    type: "namespace",
    name: BROWSER_NAMESPACE,
    description:
      "Operate the same Browser workspace tab that is visible to the user.",
    tools: BROWSER_TOOL_DEFINITIONS,
  }),
]);

const BROWSER_BINDINGS = new Map<string, DynamicToolBinding>(
  BROWSER_TOOL_DEFINITIONS.map((definition) => {
    const binding = {
      namespace: BROWSER_NAMESPACE,
      runtimeName: `${BROWSER_NAMESPACE}__${definition.name}`,
      tool: definition.name,
    };
    return [binding.runtimeName, binding];
  }),
);

export class AppServerDynamicToolHost {
  readonly #bindingsByThread = new Map<string, ThreadHostBinding>();
  readonly #browserHost: ElectronBrowserTabHost | null;
  readonly #callStates = new Map<string, DynamicToolCallState>();
  readonly #readAppInfo: () => AppInfo;

  constructor(
    readAppInfo: () => AppInfo = () => ({
      locale: app.getLocale(),
      name: app.getName(),
      platform: process.platform,
      version: app.getVersion(),
    }),
    browserHost: ElectronBrowserTabHost | null = null,
  ) {
    this.#readAppInfo = readAppInfo;
    this.#browserHost = browserHost;
  }

  prepareClientRequest(message: JsonRpcRequest): JsonRpcRequest {
    if (message.method !== THREAD_START_METHOD) {
      return message;
    }
    const params = a
```

### Core Architecture Module: `electron/appServerHost.ts`
```
import {
  AppServerRequestError,
  AppServerSidecarLifecycle,
  cancelRequest,
  decodeMessage,
  defaultReleaseManifestPath,
  encodeMessage,
  isJsonRpcNotification,
  isJsonRpcResponse,
  isJsonRpcErrorResponse,
  METHOD_AGENT_MESSAGE_DELTA,
  METHOD_INITIALIZE,
  METHOD_INITIALIZED,
  METHOD_ITEM_COMPLETED,
  METHOD_ITEM_STARTED,
  METHOD_MCP_TOOL_CALL_PROGRESS,
  METHOD_MODEL_LIST_UPDATED,
  METHOD_THREAD_STARTED,
  METHOD_THREAD_TOKEN_USAGE_UPDATED,
  METHOD_TURN_COMPLETED,
  METHOD_TURN_STARTED,
  METHOD_WORKSPACE_RIGHT_SURFACE_PENDING_CHANGED,
  readReleaseManifest,
  resolveSidecarFromReleaseManifest,
  stdioSidecar,
  type AppServerRequestOptions,
  type AppServerRequestResult,
  type ConnectedAppServerSidecar,
  type InitializeResponse,
  type InitializeParams,
  type JsonRpcRequest,
  type JsonRpcMessage,
  type RequestId,
  type SidecarLaunchConfig,
} from "@limecloud/app-server-client";
import { app, session } from "./electronRuntime";
import { resolveCurrentDesktopStorageRoots } from "./appDataPaths";
import { appendFileSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { tryHandleCurrentTimeRead } from "./appServerCurrentTimeHost";
import {
  AppServerDynamicToolHost,
  type DynamicToolOwnerContext,
} from "./appServerDynamicToolHost";
import type { ElectronBrowserTabHost } from "./browserTabHost";

const DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS = 30_000;
const APP_SERVER_BACKEND_TIMEOUT_GRACE_MS = 30_000;
const APP_SERVER_TURN_START_METHOD = "turn/start";
const APP_SERVER_CONVERSATION_IMPORT_THREAD_COMMIT_METHOD =
  "conversationImport/thread/commit";
const APP_SERVER_CONVERSATION_IMPORT_JOB_READ_METHOD =
  "conversationImport/job/read";
const APP_SERVER_CONVERSATION_IMPORT_THREAD_COMMIT_TIMEOUT_MS = 180_000;
const APP_SERVER_CONVERSATION_IMPORT_SCAN_TIMEOUT_MS = 120_000;
const APP_SERVER_CONVERSATION_IMPORT_PREVIEW_TIMEOUT_MS = 120_000;
const APP_SERVER_REQUEST_TIMEOUT_OVERRIDE_CEILING_MS = 600_000;
const APP_SERVER_PROXY_REQUEST_ID_PREFIX = "electron-host";
const APP_SERVER_CANCEL_REQUEST_METHOD = "$/cancelRequest";
const APP_SERVER_CONFIG_FILE_NAME = "config.yaml";
const APP_SERVER_RECENT_NOTIFICATION_LIMIT = 500;
const APP_SERVER_SERVER_REQUEST_TOKEN_LIMIT = 500;
const APP_SERVER_SERVER_REQUEST_TOKEN_PREFIX = "electron-action:";
const APP_SERVER_DRAIN_FIRST_MESSAGE_WAIT_MS = 25;
const APP_SERVER_DRAIN_BUFFERED_MESSAGE_WAIT_MS = 0;
const APP_SERVER_RESTART_MAX_ATTEMPTS = 3;
const APP_SERVER_PROXY_PROBE_URL = "https://llm.limeai.run/v1/models";
const APP_SERVER_PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
] as const;
const APP_SERVER_NO_PROXY_ENV_KEYS = ["NO_PROXY", "no_proxy"] as const;
const APP_SERVER_LOOPBACK_NO_PROXY_HOSTS = ["127.0.0.1", "localhost", "::1"];

type ElectronAppServerLaunchConfig = {
  config: SidecarLaunchConfig;
  verifySha256?: boolean;
};

type HandleJsonLinesRequest = {
  lines: string[];
  timeoutMs?: number;
};

type DrainEventsRequest = {
  includeRecent?: boolean;
  limit?: number;
};

export type AppServerSidecarTermination = {
  pid: number | null;
  requested: boolean;
  signal: "SIGTERM";
};

type AppServerRestartWaiter = {
  lifecycle: AppServerSidecarLifecycle;
  promise: Promise<ConnectedAppServerSidecar>;
  reject: (error: Error) => void;
  resolve: (connected: ConnectedAppServerSidecar) => void;
};

type AppServerHostStage =
  | "idle"
  | "resolving"
  | "starting"
  | "initializing"
  | "ready"
  | "recovering"
  | "restarting"
  | "failed"
  | "stopping"
  | "stopped";

type AppServerHostFailure = {
  stage: AppServerHostStage;
  message: string;
  occurred_at: string;
  exit_code: number | null;
  signal: string | null;
  stderr_tail: string[];
};

export type AppServerHostDiagnostics = {
  schema_version: 1;
  stage: AppServerHostStage;
  connected: boolean;
  connection_generation: number;
  restart_pending: boolean;
  resume_recovery_pending: boolean;
  sidecar: {
    pid: number | null;
    running: boolean;
    exit_code: number | null;
    signal: string | null;
    stderr_line_count: number;
    stderr_tail: string[];
  } | null;
  last_failure: AppServerHostFailure | null;
};

const APP_SERVER_HOST_DIAGNOSTIC_SCHEMA_VERSION = 1 as const;
const APP_SERVER_HOST_STDERR_TAIL_LIMIT = 20;
const APP_SERVER_HOST_STDERR_LINE_LIMIT = 240;
const APP_SERVER_HOST_ERROR_LIMIT = 320;
const DIAGNOSTIC_SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._-]+\b/gi, "Bearer ***"],
  [
    /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token)\s*[:=]\s*["']?[A-Za-z0-9._-]{6,}["']?/gi,
    "credential=***",
  ],
  [/\bsk-[A-Za-z0-9]{12,}\b/g, "sk-***"],
];
const DIAGNOSTIC_ABSOLUTE_PATH_PATTERN =
  /(?:[A-Za-z]:[\\/]|\/(?:Users|home|private|tmp|var|opt|workspace|Volumes|Applications|Library)(?:\/|\\))[^\s"'`),;]+/g;

function redactDiagnosticText(value: unknown, limit: number): string {
  let text = value instanceof Error ? value.message : String(value ?? "");
  for (const [pattern, replacement] of DIAGNOSTIC_SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(DIAGNOSTIC_ABSOLUTE_PATH_PATTERN, "<path>");
  text = text.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function redactDiagnosticStderrTail(lines: readonly string[]): string[] {
  return lines
    .slice(-APP_SERVER_HOST_STDERR_TAIL_LIMIT)
    .map((line) =>
      redactDiagnosticText(line, APP_SERVER_HOST_STDERR_LINE_LIMIT),
    )
    .filter(Boolean);
}

function buildHostFailure(params: {
  stage: AppServerHostStage;
  error?: unknown;
  exitCode?: number | null;
  signal?: string | null;
  stderrLines?: readonly string[];
}): AppServerHostFailure {
  const stderrTail = redactDiagnosticStderrTail(params.stderrLines ?? []);
  return {
    stage: params.stage,
    message: redactDiagnosticText(params.error, APP_SERVER_HOST_ERROR_LIMIT),
    occurred_at: new Date().toISOString(),
    exit_code: params.exitCode ?? null,
    signal: params.signal ?? null,
    stderr_tail: stderrTail,
  };
}

function readDiagnosticStderrLines(error: unknown): readonly string[] {
  if (!error || typeof error !== "object") {
    return [];
  }
  const lines = (error as { stderrLines?: unknown }).stderrLines;
  return Array.isArray(lines)
    ? lines.filter((line): line is string => typeof line === "string")
    : [];
}

export class ElectronAppServerHost {
  #lifecycle: AppServerSidecarLifecycle | null = null;
  #connected: ConnectedAppServerSidecar | null = null;
  #connectPromise: Promise<ConnectedAppServerSidecar> | null = null;
  #nextProxyRequestId = 1;
  #activeProxyRequestIds = new Map<RequestId, RequestId>();
  #consumedServerRequestTokens = new Set<string>();
  #recentNotifications: JsonRpcMessage[] = [];
  #restartWaiter: AppServerRestartWaiter | null = null;
  #serverRequestRawIdsByToken = new Map<string, RequestId>();
  #serverRequestTokensByRawId = new Map<string, string>();
  #connectionGeneration = 0;
  #resumeRecoveryPromise: Promise<void> | null = null;
  #stage: AppServerHostStage = "idle";
  #lastFailure: AppServerHostFailure | null = null;
  #stopping = false;
  readonly #dynamicToolHost: AppServerDynamicToolHost;

  constructor(browserHost: ElectronBrowserTabHost | null = null) {
    this.#dynamicToolHost = new AppServerDynamicToolHost(
      undefined,
      browserHost,
    );
  }

  async warmup(): Promise<InitializeResponse> {
    const connected = await this.#connect();
    return connected.initializeResponse;
  }

  getDiagnostics(): AppServerHostDiagnostics {
    const connected = this.#connected;
    const sidecar = connected?.sidecar;
    const child = sidecar?.child;
    const stderrLines = sidecar?.stderrLines ?? [];
    const running = Boolean(
      child && child.exitCode === null && child.signalCode === null,
    );
    return {
      schema_version: APP_SERVER_HOST_DIAGNOSTIC_SC
```

### Core Architecture Module: `electron/browserTabHost.ts`
```
import { randomUUID } from "node:crypto";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { statSync } from "node:fs";
import type { WebContents } from "electron";
import type { BrowserWindow, Rectangle } from "./electronRuntime";
import { clipboard, shell } from "./electronRuntime";
import {
  browserNodeCenter,
  describeBrowserNode,
  observeBrowserPage,
} from "./browserTabObservation";
import {
  observeBrowserTabUserControl,
  type BrowserTabUserControlObserver,
} from "./browserTabUserControl";
import {
  ElectronEmbeddedBrowserHost,
  type EmbeddedBrowserViewState,
} from "./embeddedBrowserHost";

type HostArgs = Record<string, unknown> | null | undefined;
type HostEventEmitter = (event: string, payload?: unknown) => void;
type BrowserTurnInterruptHandler = (
  threadId: string,
  turnId: string,
) => Promise<void>;
type BrowserArtifactWriter = (
  params: Record<string, unknown>,
) => Promise<unknown>;

export const BROWSER_TAB_COMMANDS = [
  "browser_tab_mount",
  "browser_tab_set_bounds",
  "browser_tab_navigate",
  "browser_tab_reload",
  "browser_tab_stop",
  "browser_tab_find_in_page",
  "browser_tab_stop_find_in_page",
  "browser_tab_set_zoom",
  "browser_tab_go_back",
  "browser_tab_go_forward",
  "browser_tab_select",
  "browser_tab_close",
] as const;

export type BrowserTabCommand = (typeof BROWSER_TAB_COMMANDS)[number];
export type BrowserTabOrigin = "agent" | "user";
export type BrowserTabControlOwner =
  | "agent"
  | "human_takeover"
  | "released"
  | "user";
export type BrowserTabMark = "deliverable" | "handoff";

export interface BrowserTabState extends EmbeddedBrowserViewState {
  activeTurnId: string | null;
  browserSessionId: string;
  controlOwner: BrowserTabControlOwner;
  humanReason: string | null;
  mark: BrowserTabMark | null;
  origin: BrowserTabOrigin;
  ownerWebContentsId: number;
  pageRevision: number;
  selected: boolean;
  tabId: string;
  threadId: string;
  webContentsId: number;
  windowId: number;
}

export interface BrowserToolCall {
  approvalToken?: string;
  arguments: Record<string, unknown>;
  callId: string;
  ownerWebContentsId: number;
  phase: "preflight" | "approvedExecute";
  threadId: string;
  tool: string;
  turnId: string;
}

export interface BrowserToolApproval {
  actionKind: string;
  approvalToken: string;
  backendNodeId?: number;
  browserSessionId: string;
  reason: string;
  riskClass: string;
  /** Dynamic-tool protocol requires a non-empty value even for non-DOM actions. */
  snapshotId: string;
  tabId: string;
  viewId: string;
  webContentsId: number;
}

export interface BrowserToolResult {
  approval?: BrowserToolApproval;
  data?: unknown;
  imageBase64?: string;
  state?: BrowserTabState;
  status: "approval_required" | "completed" | "human_takeover";
}

interface PendingBrowserApproval {
  actionKind: string;
  approvalToken: string;
  arguments: Record<string, unknown>;
  backendNodeId: number | null;
  browserSessionId: string;
  callId: string;
  ownerWebContentsId: number;
  snapshotId: string | null;
  tabId: string;
  targetDescription: string | null;
  threadId: string;
  tool: string;
  turnId: string;
  viewId: string;
  webContentsId: number;
  windowId: number;
}

interface BrowserArtifactRecord {
  artifactRef: string;
  filename: string;
  mimeType: string | null;
  path: string;
  threadId: string;
  turnId: string | null;
  browserSessionId: string;
  ownerWebContentsId: number;
  tabId: string;
  viewId: string;
  createdAt: string;
  persistedAt: string | null;
  sidecarRelativePath: string | null;
  contentStatus: string | null;
}

interface PendingBrowserPermission {
  browserSessionId: string;
  ownerWebContentsId: number;
  permission: string;
  requestId: string;
  tabId: string;
  threadId: string;
  turnId: string;
  viewId: string;
  webContentsId: number;
  windowId: number;
}

interface BrowserRoute {
  activeTurnId: string | null;
  browserSessionId: string;
  controlOwner: BrowserTabControlOwner;
  humanReason: string | null;
  mark: BrowserTabMark | null;
  origin: BrowserTabOrigin;
  ownerWebContentsId: number;
  pageRevision: number;
  latestSnapshotId: string | null;
  latestSnapshotNodeIds: Set<number>;
  lastPageStateKey: string | null;
  selected: boolean;
  tabId: string;
  threadId: string;
  viewId: string;
  windowId: number;
}

interface NativeUserControlObserver {
  observer: BrowserTabUserControlObserver;
  webContentsId: number;
}

const NAVIGATION_TIMEOUT_MS = 30_000;
const DANGEROUS_ACTION_PATTERN =
  /\b(delete|remove|submit|publish|purchase|pay|checkout|authorize|login|sign in|send)\b|删除|移除|提交|发布|购买|支付|授权|登录|发送/i;

export function isBrowserTabCommand(
  command: string,
): command is BrowserTabCommand {
  return BROWSER_TAB_COMMANDS.includes(command as BrowserTabCommand);
}

export class ElectronBrowserTabHost {
  readonly #embeddedHost: ElectronEmbeddedBrowserHost;
  readonly #emit: HostEventEmitter;
  readonly #routesByTabId = new Map<string, BrowserRoute>();
  readonly #tabIdsByViewId = new Map<string, string>();
  readonly #pendingApprovals = new Map<string, PendingBrowserApproval>();
  readonly #pendingPermissions = new Map<string, PendingBrowserPermission>();
  readonly #artifactsByRef = new Map<string, BrowserArtifactRecord>();
  readonly #userControlObserversByViewId = new Map<
    string,
    NativeUserControlObserver
  >();
  #interruptTurn: BrowserTurnInterruptHandler | null = null;
  #artifactWriter: BrowserArtifactWriter | null = null;

  constructor(
    embeddedHost: ElectronEmbeddedBrowserHost,
    emit: HostEventEmitter = () => undefined,
  ) {
    this.#embeddedHost = embeddedHost;
    this.#emit = emit;
  }

  setTurnInterruptHandler(handler: BrowserTurnInterruptHandler | null): void {
    this.#interruptTurn = handler;
  }

  setArtifactWriter(writer: BrowserArtifactWriter | null): void {
    this.#artifactWriter = writer;
  }

  async invoke(
    window: BrowserWindow | null,
    command: BrowserTabCommand,
    args?: HostArgs,
  ): Promise<unknown> {
    if (command === "browser_tab_close") {
      return this.#closeFromRenderer(window, args);
    }
    if (!window || window.isDestroyed()) {
      throw new Error("Browser tab owner window is unavailable");
    }
    switch (command) {
      case "browser_tab_mount":
        return await this.#mount(window, args);
      case "browser_tab_set_bounds":
        return await this.#invokeForRenderer(
          window,
          args,
          "embedded_browser_view_set_bounds",
        );
      case "browser_tab_navigate":
        return await this.#invokeForRenderer(
          window,
          args,
          "embedded_browser_view_navigate",
          true,
        );
      case "browser_tab_reload":
        return await this.#invokeForRenderer(
          window,
          args,
          "embedded_browser_view_reload",
          true,
        );
      case "browser_tab_stop":
        return await this.#invokeForRenderer(
          window,
          args,
          "embedded_browser_view_stop",
          true,
        );
      case "browser_tab_find_in_page":
        return await this.#invokeForRenderer(
          window,
          args,
          "embedded_browser_view_find_in_page",
        );
      case "browser_tab_stop_find_in_page":
        return await this.#invokeForRenderer(
          window,
          args,
          "embedded_browser_view_stop_find_in_page",
        );
      case "browser_tab_set_zoom":
        return await this.#invokeForRenderer(
          window,
          args,
          "embedded_browser_view_set_zoom",
        );
      case "browser_tab_go_back":
        return await this.#invokeForRenderer(
          window,
          args,
          "embedded_browser_view_go_back",
          true,
        );
      case "browser_tab_go_forward":
        return await this.#invokeForRenderer(
          window,
          args,
          "embedded_browser_view_go_forward",
          true,
        )
```

### Core Architecture Module: `electron/browserTabObservation.ts`
```
import type { WebContents } from "electron";

const MAX_AX_NODES = 250;

export interface BrowserObservationNode {
  backendNodeId: unknown;
  childIds: unknown[];
  ignored: boolean;
  name: unknown;
  nodeId: unknown;
  role: unknown;
  value: unknown;
}

export interface BrowserPageObservation {
  currentIndex: unknown;
  nodes: BrowserObservationNode[];
  pageRevision: number;
  snapshotId: string;
  title: string;
  truncated: boolean;
  url: string;
}

export async function observeBrowserPage(
  webContents: WebContents,
  identity: { pageRevision: number; snapshotId: string },
): Promise<BrowserPageObservation> {
  const [history, accessibility] = await Promise.all([
    webContents.debugger.sendCommand("Page.getNavigationHistory"),
    webContents.debugger.sendCommand("Accessibility.getFullAXTree"),
  ]);
  const historyRecord = asRecord(history);
  const accessibilityRecord = asRecord(accessibility);
  const nodes = Array.isArray(accessibilityRecord?.nodes)
    ? accessibilityRecord.nodes.slice(0, MAX_AX_NODES).map(normalizeAxNode)
    : [];
  return {
    title: webContents.getTitle(),
    url: webContents.getURL(),
    currentIndex: historyRecord?.currentIndex ?? null,
    nodes,
    pageRevision: identity.pageRevision,
    snapshotId: identity.snapshotId,
    truncated:
      Array.isArray(accessibilityRecord?.nodes) &&
      accessibilityRecord.nodes.length > MAX_AX_NODES,
  };
}

export async function describeBrowserNode(
  webContents: WebContents,
  backendNodeId: number,
): Promise<string> {
  const response = asRecord(
    await webContents.debugger.sendCommand("DOM.describeNode", {
      backendNodeId,
      depth: 0,
    }),
  );
  const node = asRecord(response?.node);
  const attributes = Array.isArray(node?.attributes)
    ? node.attributes.map(String).join(" ")
    : "";
  return [node?.nodeName, node?.localName, attributes]
    .filter(Boolean)
    .join(" ")
    .slice(0, 500);
}

export async function browserNodeCenter(
  webContents: WebContents,
  backendNodeId: number,
): Promise<{ x: number; y: number }> {
  const response = asRecord(
    await webContents.debugger.sendCommand("DOM.getBoxModel", {
      backendNodeId,
    }),
  );
  const model = asRecord(response?.model);
  const content = Array.isArray(model?.content)
    ? model.content.map(Number).filter(Number.isFinite)
    : [];
  if (content.length < 8) {
    throw new Error("Browser target is not actionable");
  }
  const xs = [content[0], content[2], content[4], content[6]];
  const ys = [content[1], content[3], content[5], content[7]];
  return {
    x: xs.reduce((sum, value) => sum + value, 0) / xs.length,
    y: ys.reduce((sum, value) => sum + value, 0) / ys.length,
  };
}

function normalizeAxNode(value: unknown): BrowserObservationNode {
  const node = asRecord(value) ?? {};
  return {
    backendNodeId: node.backendDOMNodeId ?? null,
    childIds: Array.isArray(node.childIds) ? node.childIds : [],
    ignored: node.ignored === true,
    name: axValue(node.name),
    nodeId: node.nodeId ?? null,
    role: axValue(node.role),
    value: axValue(node.value),
  };
}

function axValue(value: unknown): unknown {
  return asRecord(value)?.value ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

```

### Core Architecture Module: `electron/browserTabUserControl.ts`
```
import type {
  Event as ElectronEvent,
  Input,
  MouseInputEvent,
  WebContents,
} from "electron";

export interface BrowserTabUserControlObserver {
  dispose(): void;
  runAgentInput<T>(action: () => Promise<T>): Promise<T>;
}

const USER_MOUSE_INPUT_TYPES = new Set<MouseInputEvent["type"]>([
  "contextMenu",
  "mouseDown",
  "mouseWheel",
]);

export function observeBrowserTabUserControl(
  webContents: WebContents,
  onUserInput: () => void,
): BrowserTabUserControlObserver {
  let agentInputDepth = 0;
  const handleKeyboardInput = (_event: ElectronEvent, input: Input) => {
    if (agentInputDepth === 0 && input.type === "keyDown") {
      onUserInput();
    }
  };
  const handleMouseInput = (_event: ElectronEvent, input: MouseInputEvent) => {
    if (agentInputDepth === 0 && USER_MOUSE_INPUT_TYPES.has(input.type)) {
      onUserInput();
    }
  };

  webContents.on("before-input-event", handleKeyboardInput);
  webContents.on("before-mouse-event", handleMouseInput);

  return {
    dispose() {
      webContents.off("before-input-event", handleKeyboardInput);
      webContents.off("before-mouse-event", handleMouseInput);
    },
    async runAgentInput<T>(action: () => Promise<T>): Promise<T> {
      agentInputDepth += 1;
      try {
        return await action();
      } finally {
        agentInputDepth -= 1;
      }
    },
  };
}

```

### Core Architecture Module: `electron/desktopNotificationHost.ts`
```
import { Notification } from "./electronRuntime";
import type { NotificationConstructorOptions } from "./electronRuntime";

type HostArgs = Record<string, unknown> | null | undefined;

export type DesktopNotificationStatus = "failed" | "sent" | "unsupported";

export interface DesktopNotificationResult {
  reason?: string;
  status: DesktopNotificationStatus;
}

const DESKTOP_NOTIFICATION_ALLOWED_FIELDS = new Set([
  "body",
  "silent",
  "tag",
  "title",
]);
const DESKTOP_NOTIFICATION_TITLE_LIMIT = 120;
const DESKTOP_NOTIFICATION_BODY_LIMIT = 320;
const DESKTOP_NOTIFICATION_TAG_LIMIT = 120;

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readRequest(value: unknown): Record<string, unknown> {
  const record = toRecord(value);
  const request = toRecord(record?.request);
  return request ?? record ?? {};
}

function normalizeText(value: unknown, field: string, limit: number): string {
  if (typeof value !== "string") {
    throw new Error(`桌面通知缺少 ${field}`);
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error(`桌面通知缺少 ${field}`);
  }
  return normalized.slice(0, limit);
}

function normalizeTag(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value
    .replace(/[^a-zA-Z0-9:_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, DESKTOP_NOTIFICATION_TAG_LIMIT);
  return normalized || undefined;
}

function normalizeSilent(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function assertAllowedFields(request: Record<string, unknown>): void {
  const extraFields = Object.keys(request).filter(
    (key) => !DESKTOP_NOTIFICATION_ALLOWED_FIELDS.has(key),
  );
  if (extraFields.length > 0) {
    throw new Error(
      `桌面通知请求包含不支持字段: ${extraFields.sort().join(", ")}`,
    );
  }
}

function normalizeDesktopNotificationOptions(
  args: HostArgs,
): NotificationConstructorOptions {
  const request = readRequest(args);
  assertAllowedFields(request);
  const title = normalizeText(
    request.title,
    "title",
    DESKTOP_NOTIFICATION_TITLE_LIMIT,
  );
  const body = normalizeText(
    request.body,
    "body",
    DESKTOP_NOTIFICATION_BODY_LIMIT,
  );
  const id = normalizeTag(request.tag);
  return {
    body,
    ...(id ? { id } : {}),
    silent: normalizeSilent(request.silent),
    title,
  };
}

export function showDesktopNotification(
  args: HostArgs,
): DesktopNotificationResult {
  if (!Notification.isSupported()) {
    return {
      reason: "electron_notification_unsupported",
      status: "unsupported",
    };
  }

  const options = normalizeDesktopNotificationOptions(args);
  try {
    new Notification(options).show();
    return { status: "sent" };
  } catch (error) {
    return {
      reason: error instanceof Error ? error.message : String(error),
      status: "failed",
    };
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #98** (2026-01-10): **fix: 优化 API 测试页面 URL 选择和状态管理**
  *Symptoms*: ## 问题描述  用户在 API 测试页面遇到以下问题： 1. curl 命令使用错误的 IP 地址（使用配置的局域网 IP 而不是本机地址） 2. 切换监听地址时，curl 命令不会实时更新 3. 切换 Provider 后，旧的测试结果仍然显示  ## 修复内容  ### 1. 智能 URL 选择 根据监听地址自动选择合适的测试 URL： - `127.0.0.1` → 使用 `127.0.0.1`（仅本机） - `0.0.0.0` → 使用 `127.0.0.1`（本机访问所有接口） - 局域网 IP → 使用该 IP（允许局域网测试）  ### 2. 实时更新测试 URL 使用 `editHost` 而不是 `status.host`，确保切换监听地址时 curl 命令立即更新  ### 3. 优化测试状态管理 - 切换 Provider 时保留测试结果（允许用户对比不同 Provider） - 切换功能 Tab 时才重置测试状态（保持界面整洁）  ## 测试结果  ✅ TypeScript 类型检查通过   ✅ ESLint 检查通过   ✅ 前端构建成功   ✅ Prettier 格式化通过   ✅ Rust 编译通过    ## 相关 Issue  修复用户反馈的 API 测试页面 URL 选择问题  ## 修改文件  - `src/components/api-server/ApiServerPage.tsx` 

- **Issue #97** (2026-01-10): **fix: 修复 Flow Monitor 响应内容显示和提供商显示问题 (#75)**
  *Symptoms*: # 修复 Flow Monitor 响应内容显示和提供商显示问题  ## 问题描述  修复 Issue #75：Flow Monitor 界面无法正确显示响应内容和提供商信息  ### 主要问题  1. **响应内容未显示**：在凭证池模式下，非流式响应的 `content` 和 `body` 字段没有被正确保存到 Flow Monitor 2. **提供商显示错误**：Flow Monitor 显示提供商为 "openai" 而不是实际的提供商名称（如 "DeepSeek"）  ## 修复内容  ### 1. 修复响应内容保存问题  **文件**: `src-tauri/src/server/handlers/api.rs`  - 在凭证池模式下正确提取响应体内容（第 1040-1210 行） - 解析 JSON 响应，提取 `content`、`tool_calls` 和 `usage` 信息 - 优先从 `content` 字段提取，如果为空则从 `tool_calls` 提取 - 提取并设置响应头到 `LLMResponse.headers` - 使用实际的 token 使用量而不是默认值  **根本原因**: - `build_llm_response` 被调用时传入空字符串 - `body` 字段被硬编码为 `serde_json::Value::Null` - 当响应包含 `tool_calls` 时，`content` 字段为空，实际内容在 `tool_calls[0].function.arguments` 中  ### 2. 修复提供商显示问题  **文件**:  - `src-tauri/src/flow_monitor/models.rs` - `src-tauri/src/server/handlers/api.rs` - `src/lib/api/flowMonitor.ts` - `src/components/flow-monitor/FlowDetail.tsx`  **修改内容**: - 在 `FlowMetadata` 结构体中添加 `provider_id: Option<String>` 字段 - 修改 `build_flow_metadata` 函数签名，添加 `provider_id` 参数 - 更新所有调用 `build_flow_metadata` 的地方，传入实际的 provider ID - 修改前端显示逻辑，优先显示 `provider_id` - 从凭证的 `name` 字段中提取 Provider 显示名称（去掉 "[降级] " 前缀）  **根本原因**: - `FlowMetadata.provider` 是 `ProviderType` 枚举，不包含具体的提供商 ID - "deepseek" 等提供商被解析为 `ProviderType::OpenAI`  ### 3. UI 优化  **清理完成弹窗** (`src/components/flow-monitor/CleanupDialog.tsx`): - 创建自定义成功提示 Modal 组件 - 添加动画成功图标（带圆环动画效果） - 使用渐变背景和图标卡片展示统计信息 - 区分不同类型信息（蓝色：删除记录，紫色：清理文件，绿色：释放空间） - 支持深色模式  **排序下拉框** (`src/components/flow-monitor/FlowList.tsx`): - 将原生 `<select>` 替换为 Radix 
  **Post-Mortem & Fix Analysis**:
  > ## 可能同时修复了 Issue #34  这个 PR 修复了凭证池模式下响应内容提取的问题，可能同时解决了 #34（88code 无法使用）的问题。  **修复内容**： - ✅ 正确从 JSON 响应中提取 `content` 字段 - ✅ 支持从 `tool_calls` 中提取内容 - ✅ 修复了 `body` 字段为 `null` 的问题 - ✅ 添加了 `provider_id` 字段用于正确识别提供商  如果 88code 服务通过 ProxyCast 代理请求时遇到响应内容丢失或格式问题，这个修复应该能够解决。  建议在合并后测试 88code 是否恢复正常，如果确认修复，可以关闭 #34。
  > 此 PR 同时修复了以下 Issues：  - Closes #75 - Flow Monitor 响应内容显示和提供商显示问题 - Closes #55 - 测试显示一切正常，但系统日志会显示空凭证，客户端返回的是空内容  两个问题的根本原因相同：在凭证池模式下，非流式响应的 `content` 和 `body` 字段没有被正确提取和保存。

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

### Incident Patch 1: `faa8be40` (2026-09-30)
**Commit Message**: fix(governance): register TUI history test fixture

**File**: `internal/exec-plans/release-v1.147.0-plan.md` (modified, +11/-3)
```diff
@@ -1,6 +1,6 @@
 # Lime v1.147.0 发布执行计划
 
-状态：全部候选已获递交授权，本机门禁通过，执行发布提交与远端流水线
+状态：183 文件发布提交和 main/tag 推送完成；远端打包与分发进行中
 日期：2026-09-30
 目标：将全部当前未提交/未跟踪候选发布为 `v1.147.0`，完成 commit、tag、main/tag 推送与远端 Actions/Release/npm 复核。
 
@@ -39,8 +39,10 @@
 - [x] 最终完整 TUI PTY Gate B：thread `01a0f2df-7413-7be1-9157-fcb9b2aa8e7d`、turn `turn_5f90cbe039074ccc862a38d09dee5f9a`；complete/approval/user-input/interrupt/failure/queue-edit/agents-overview、focus-palette/resize-reflow/reconnect 和 terminal restore 通过。
 - [x] workspace fmt 与 `git diff --check`；新增 PTY suggestions 文件格式已修复。
 - [x] git 写操作和全部候选递交授权。
-- [ ] `Release v1.147.0` commit、`v1.147.0` tag、main/tag 推送及远端引用复核。
-- [ ] GitHub Actions、Release 资产、npm registry 复核。
+- [x] `Release v1.147.0` commit `1cbc94e5f7f00b58f0580fafab1b202fdf4e9d0c`，183 文件；轻量 tag `v1.147.0` 与 main 已分别推送，远端两引用一致；提交 hook `182` 通过、`0` 失败。
+- [x] Release run `36735313925` 已启动，GitHub draft 已创建，三个 Electron 平台构建中；Docs run `36735269856` 成功。
+- [ ] GitHub Release 公开资产、updater 和 npm registry 最终复核。
+- [ ] Quality run `36735269701`：Frontend Full 在批次 `56/119` 因既有 fixture 未登记失败，Rust/GUI/Windows job 尚在运行，不能声明全量 CI 通过。
 
 ## 修复与限制
 
@@ -50,6 +52,12 @@
 
 Rust 构建使用仓库 rusty-v8 artifact resolver 的已校验缓存，未修改系统环境变量或依赖。App Server 保留既有两处 dead-code warning；本轮不宣称全量 lint/Vitest/Cargo/Clippy 矩阵通过。跨平台 Forge、Windows 真机、签名/公证与 npm 分发由 GitHub runner 验证。
 
+## 发布后的定向修复
+
+远端 Frontend Full 的唯一已知失败为 `scripts/app-server/tui-history-pagination-fixture.mjs` 未登记在 ExternalBackend 测试夹具允许清单。该 fixture、测试与 support 在 `v1.146.0..v1.147.0` diff 为空，是既有守卫漏登记。检查确认 fixture 使用隔离临时 app data、受控 backend 和真实 CLI/App Server，不属于生产默认入口。
+
+本轮补 `src/lib/governance/appServerRuntimeBoundary.testSupport.ts` 的精确允许路径，保留全目录扫描与生产 Runtime 默认断言；失败守卫定向 `2/2` 和 `npm run typecheck` 通过。作为 main 的独立测试修复提交，保持发布 tag 原提交，不宣称旧 tag 的 Quality run 已通过。推送后并发会话开始的下一项 request-user-input 改造属于发布后工作，保留其工作树，不覆盖、不并入本次标签。
+
 ## 架构与分类
 
 主链保持 `Desktop Host / CLI-TUI Host -> App Server JSON-RPC -> RuntimeCore -> canonical Thread/Turn/Item -> GUI/terminal projection`。MCP OAuth 扩展仍归既有 protocol/App Server/MCP credential owner；新增 TUI helper 是 presentation 内部分工，没有平行 runtime/history store 或新的 public boundary。本次无重大架构变更。
```

**File**: `src/lib/governance/appServerRuntimeBoundary.testSupport.ts` (modified, +1/-0)
```diff
@@ -197,6 +197,7 @@ export const ALLOWED_EXTERNAL_BACKEND_LAUNCH_FILES = new Set([
   "scripts/agent-runtime/tool-execution-smoke.test.mjs",
   "scripts/app-server/external-backend-smoke.mjs",
   "scripts/app-server/packaged-external-backend-failure-smoke.mjs",
+  "scripts/app-server/tui-history-pagination-fixture.mjs",
   "scripts/check-app-server-client-contract.mjs",
   "scripts/check-command-contracts.mjs",
   "scripts/electron/codex-import-click-through-fixture-smoke.mjs",
```

---

### Incident Patch 2: `a123afaf` (2026-09-26)
**Commit Message**: fix(release): make Windows Squirrel app stop idempotent

**File**: `scripts/electron/lib/windows-squirrel-n-minus-one.mjs` (modified, +33/-8)
```diff
@@ -195,26 +195,51 @@ export async function findReadyElectronUpdaterPage(pages) {
   return null;
 }
 
-export async function stopInstalledApp(executable) {
-  const script = [
+export function buildStopInstalledAppScript() {
+  const matchingProcesses =
+    "@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and [String]::Equals([System.IO.Path]::GetFullPath($_.ExecutablePath), $target, [StringComparison]::OrdinalIgnoreCase) })";
+  return [
+    "$ErrorActionPreference = 'Stop'",
     "$target = [System.IO.Path]::GetFullPath($env:LIME_TARGET_EXECUTABLE)",
-    "$processes = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and [String]::Equals([System.IO.Path]::GetFullPath($_.ExecutablePath), $target, [StringComparison]::OrdinalIgnoreCase) })",
-    "$processes | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop }",
+    `$processes = ${matchingProcesses}`,
+    "$processes | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch { if ($_.FullyQualifiedErrorId -notmatch '^NoProcessFoundForGivenId(?:,|$)') { throw } } }",
     'Write-Output "stopped=$($processes.Count)"',
   ].join("; ");
-  const result = await runProcess(
+}
+
+export async function stopInstalledApp(
+  executable,
+  {
+    runProcessImpl = runProcess,
+    waitForProcessExitImpl = waitForWindowsProcessExit,
+    timeoutMs = 30_000,
+  } = {},
+) {
+  const result = await runProcessImpl(
     "powershell.exe",
-    ["-NoProfile", "-NonInteractive", "-Command", script],
+    [
+      "-NoProfile",
+      "-NonInteractive",
+      "-Command",
+      buildStopInstalledAppScript(),
+    ],
     {
-      env: { ...process.env, LIME_TARGET_EXECUTABLE: executable },
-      timeoutMs: 30_000,
+      env: {
+        ...process.env,
+        LIME_TARGET_EXECUTABLE: executable,
+      },
+      timeoutMs,
     },
   );
   if (result.exitCode !== 0) {
     throw new Error(
       `failed to stop installed app at ${executable}: exit ${result.exitCode}`,
     );
   }
+  await waitForProcessExitImpl(executable, {
+    runProcessImpl,
+    timeoutMs,
+  });
   return { executable, exitCode: result.exitCode };
 }
 
```

**File**: `scripts/electron/windows-squirrel-rc-smoke.mjs` (modified, +3/-0)
```diff
@@ -18,6 +18,7 @@ import process from "node:process";
 import { fileURLToPath } from "node:url";
 import {
   buildNMinusOneLaunchEnv,
+  buildStopInstalledAppScript,
   buildWaitForWindowsProcessExitScript,
   classifySquirrelUninstallResult,
   compareVersions,
@@ -39,6 +40,7 @@ import {
 
 export {
   buildNMinusOneLaunchEnv,
+  buildStopInstalledAppScript,
   buildWaitForWindowsProcessExitScript,
   classifySquirrelUninstallResult,
   compareVersions,
@@ -48,6 +50,7 @@ export {
   resolveInstalledSquirrelPaths,
   resolveSquirrelFeed,
   selectNMinusOneVersion,
+  stopInstalledApp,
   uninstallInstalledSquirrel,
   waitForWindowsProcessExit,
 };
```

**File**: `scripts/electron/windows-squirrel-rc-smoke.test.mjs` (modified, +45/-0)
```diff
@@ -7,6 +7,7 @@ import YAML from "yaml";
 
 import {
   buildNMinusOneLaunchEnv,
+  buildStopInstalledAppScript,
   buildWaitForWindowsProcessExitScript,
   buildWindowsRcSummary,
   cleanupFromSummary,
@@ -19,6 +20,7 @@ import {
   resolveSquirrelFeed,
   selectNMinusOneVersion,
   selectSquirrelInstaller,
+  stopInstalledApp,
   uninstallInstalledSquirrel,
   waitForWindowsProcessExit,
 } from "./windows-squirrel-rc-smoke.mjs";
@@ -160,6 +162,49 @@ describe("Windows Squirrel RC smoke", () => {
     );
   });
 
+  it("停止已退出的应用时忽略 PID 竞态，但保留其他 Stop-Process 错误", async () => {
+    const script = buildStopInstalledAppScript();
+    expect(script).toContain("NoProcessFoundForGivenId");
+    expect(script).toContain("FullyQualifiedErrorId");
+    expect(script).toContain("throw");
+
+    const runProcessImpl = vi.fn().mockResolvedValue({ exitCode: 0 });
+    const waitForProcessExitImpl = vi.fn().mockResolvedValue({
+      executable: "C:\\runner\\Lime.exe",
+      exitCode: 0,
+      timeoutMs: 30_000,
+    });
+
+    await expect(
+      stopInstalledApp("C:\\runner\\Lime.exe", {
+        runProcessImpl,
+        waitForProcessExitImpl,
+      }),
+    ).resolves.toEqual({
+      executable: "C:\\runner\\Lime.exe",
+      exitCode: 0,
+    });
+    expect(runProcessImpl).toHaveBeenCalledWith(
+      "powershell.exe",
+      [
+        "-NoProfile",
+        "-NonInteractive",
+        "-Command",
+        script,
+      ],
+      expect.objectContaining({
+        env: expect.objectContaining({
+          LIME_TARGET_EXECUTABLE: "C:\\runner\\Lime.exe",
+        }),
+        timeoutMs: 30_000,
+      }),
+    );
+    expect(waitForProcessExitImpl).toHaveBeenCalledWith(
+      "C:\\runner\\Lime.exe",
+      { runProcessImpl, timeoutMs: 30_000 },
+    );
+  });
+
   it("卸载只操作候选 Update.exe，并等待安装目录与快捷方式消失", async () => {
     const updateExecutable =
       "C:\\Users\\runner\\AppData\\Local\\lime\\Update.exe";
```

---

### Incident Patch 3: `2a0a30de` (2026-09-14)
**Commit Message**: fix(release): pass npm token to publish job

**File**: `.github/workflows/release.yml` (modified, +2/-0)
```diff
@@ -1022,6 +1022,8 @@ jobs:
     needs: publish_cli_assets
     if: needs.publish_cli_assets.result == 'success'
     runs-on: ubuntu-22.04
+    env:
+      NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
     permissions:
       contents: write
       id-token: write
```

---

### Incident Patch 4: `454da1ac` (2026-09-14)
**Commit Message**: fix(cli): resolve npm platform packages directly

**File**: `packages/cli/scripts/build_npm_package.py` (modified, +4/-4)
```diff
@@ -13,8 +13,8 @@
 CLI_ROOT = SCRIPT_DIR.parent
 NPM_NAME = "@limecloud/lime"
 
-# Alias names are resolved by bin/lime.js. Every platform tarball is published
-# under NPM_NAME with a unique version suffix, matching the Codex npm layout.
+# Platform package names are resolved by bin/lime.js. Every platform tarball is
+# published under its own name with a unique version suffix.
 PLATFORM_PACKAGES: dict[str, dict[str, str]] = {
     "lime-linux-x64": {
         "npm_name": "@limecloud/lime-linux-x64",
@@ -122,8 +122,8 @@ def stage_sources(staging_dir: Path, version: str, package: str) -> None:
         package_json["files"] = ["bin/lime.js"]
         package_json.pop("scripts", None)
         package_json["optionalDependencies"] = {
-            config["npm_name"]: (
-                f"npm:{NPM_NAME}@{compute_platform_package_version(version, config['npm_tag'])}"
+            config["npm_name"]: compute_platform_package_version(
+                version, config["npm_tag"]
             )
             for config in PLATFORM_PACKAGES.values()
         }
```

**File**: `packages/cli/tests/npm-package.test.mjs` (modified, +5/-5)
```diff
@@ -233,7 +233,7 @@ test(
   },
 );
 
-test("staging creates Lime root aliases and a real npm tarball", (t) => {
+test("staging creates Lime root platform dependencies and a real npm tarball", (t) => {
   const root = mkdtempSync(path.join(os.tmpdir(), "lime-npm-stage-test-"));
   t.after(() => rmSync(root, { recursive: true, force: true }));
   const staging = path.join(root, "root-package");
@@ -262,10 +262,10 @@ test("staging creates Lime root aliases and a real npm tarball", (t) => {
   assert.equal(packageJson.packageManager, "pnpm@9.15.9");
   assert.equal(packageJson.scripts, undefined);
   assert.deepEqual(packageJson.optionalDependencies, {
-    "@limecloud/lime-linux-x64": "npm:@limecloud/lime@1.2.3-linux-x64",
-    "@limecloud/lime-darwin-x64": "npm:@limecloud/lime@1.2.3-darwin-x64",
-    "@limecloud/lime-darwin-arm64": "npm:@limecloud/lime@1.2.3-darwin-arm64",
-    "@limecloud/lime-win32-x64": "npm:@limecloud/lime@1.2.3-win32-x64",
+    "@limecloud/lime-linux-x64": "1.2.3-linux-x64",
+    "@limecloud/lime-darwin-x64": "1.2.3-darwin-x64",
+    "@limecloud/lime-darwin-arm64": "1.2.3-darwin-arm64",
+    "@limecloud/lime-win32-x64": "1.2.3-win32-x64",
   });
   assert.ok(existsSync(tarball));
 });
```

**File**: `scripts/governance/cli-boundary.mjs` (modified, +2/-2)
```diff
@@ -119,7 +119,7 @@ export function checkCliBoundary(repoRoot = process.cwd()) {
   }
   if (npmPackage.os || npmPackage.cpu) {
     failures.push(
-      "CLI npm root package must delegate platform filters to aliases",
+      "CLI npm root package must delegate platform filters to optional dependencies",
     );
   }
   if (
@@ -172,7 +172,7 @@ export function checkCliBoundary(repoRoot = process.cwd()) {
     '"lime-darwin-x64"',
     '"lime-darwin-arm64"',
     '"lime-win32-x64"',
-    'f"npm:{NPM_NAME}@{compute_platform_package_version',
+    'config["npm_name"]: compute_platform_package_version',
     'f"app-server{suffix}"',
     'f"code-mode-host{suffix}"',
     '"windows-sandbox-setup.exe"',
```

---

### Incident Patch 5: `0f135a72` (2026-09-14)
**Commit Message**: fix(cli): publish platform packages under distinct names

**File**: `packages/cli/scripts/build_npm_package.py` (modified, +1/-1)
```diff
@@ -130,7 +130,7 @@ def stage_sources(staging_dir: Path, version: str, package: str) -> None:
     else:
         platform = PLATFORM_PACKAGES[package]
         package_json = {
-            "name": NPM_NAME,
+            "name": platform["npm_name"],
             "version": compute_platform_package_version(version, platform["npm_tag"]),
             "description": root_package_json.get("description"),
             "license": root_package_json.get("license", "MIT"),
```

**File**: `packages/cli/tests/npm-package.test.mjs` (modified, +1/-1)
```diff
@@ -309,7 +309,7 @@ test("platform staging requires the complete App Server runtime payload", (t) =>
   const packageJson = JSON.parse(
     readFileSync(path.join(staging, "package.json"), "utf8"),
   );
-  assert.equal(packageJson.name, "@limecloud/lime");
+  assert.equal(packageJson.name, "@limecloud/lime-darwin-arm64");
   assert.equal(packageJson.version, "1.2.3-darwin-arm64");
   assert.deepEqual(packageJson.os, ["darwin"]);
   assert.deepEqual(packageJson.cpu, ["arm64"]);
```

---

### Incident Patch 6: `580022b5` (2026-09-14)
**Commit Message**: fix(release): stabilize CLI V8 and Linux dependencies

**File**: `.github/workflows/release.yml` (modified, +10/-2)
```diff
@@ -866,7 +866,7 @@ jobs:
         shell: bash
         run: |
           sudo apt-get update
-          sudo apt-get install -y pkg-config libasound2-dev
+          sudo apt-get install -y pkg-config libasound2-dev libxdo-dev
 
       - name: Setup Rust
         uses: dtolnay/rust-toolchain@e081816240890017053eacbb1bdf337761dc5582 # 1.95.0
@@ -894,7 +894,15 @@ jobs:
         shell: bash
         run: |
           node scripts/lib/rusty-v8-artifacts.mjs --github-env
-          cargo clean --manifest-path lime-rs/Cargo.toml -p v8
+          # The CLI payload is built with the release profile. Clear the matching
+          # target-specific V8 fingerprint so cached build-script output cannot
+          # reference a missing gn_out static archive.
+          CARGO_TARGET_DIR="${{ github.workspace }}/lime-rs/target" \
+            cargo clean \
+              --manifest-path lime-rs/Cargo.toml \
+              --package v8 \
+              --release \
+              --target "${{ matrix.target }}"
 
       - name: Prepare CLI sherpa-onnx runtime
         if: matrix.target != 'x86_64-unknown-linux-gnu'
```

---

### Incident Patch 7: `933fbfa6` (2026-09-06)
**Commit Message**: fix(ci): allow Rust full matrix to finish

**File**: `.github/workflows/quality.yml` (modified, +1/-1)
```diff
@@ -280,7 +280,7 @@ jobs:
   rust_full:
     name: Rust Full
     runs-on: macos-latest
-    timeout-minutes: 30
+    timeout-minutes: 60
     needs: changed
     if: ${{ (github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.changed.outputs.docs_only != 'true') || github.event_name == 'workflow_dispatch' }}
     steps:
```

**File**: `internal/exec-plans/release-v1.141.0-plan.md` (modified, +15/-0)
```diff
@@ -168,3 +168,18 @@ timeout、目录创建与 Agent Plugin MCP parity；该 run 仍因修复前的 F
 
 现有 `v1.141.0` 本地与远端 tag 均继续指向 `5a7fe5af9`；本轮只追加 main 修复，不删除、覆盖
 或重建既有 tag。退出条件仍为新修复提交推送后 Quality 全绿，并完成远端 main 状态复核。
+
+### 第四轮 Quality 门禁超时修复
+
+修复提交 `9714bb18d` 推送后，延迟触发的 push run `34014522753` 与手动 dispatch run
+`34014175236` 均确认 Frontend Full、GUI Smoke 和 Integrity 通过，手动 run 还确认 Bridge &
+Contracts 通过。两个独立 runner 的 Rust Full 都没有测试失败，而是在 job 启动满 `30m` 时由
+GitHub Actions 取消 `Test Rust workspace`，annotation 明确为
+`The job has exceeded the maximum execution time of 30m0s`。这说明 workspace 全量规模已超过旧
+超时预算，继续重跑同一配置无法得到真实测试终态。
+
+本轮将 Rust Full job 上限从 `30m` 调整为 `60m`，与 Windows Shell Runtime 的完整矩阵预算
+一致；不改变测试命令、测试选择或失败语义。现有 workflow contract 已保护 Rust Full 的 V8
+artifact 准备顺序，本次无需扩展协议或 bridge surface。退出条件仍是新提交触发的 Rust Full
+取得真实成功终态，并与 Frontend Full、GUI Smoke、Integrity、Windows Shell Runtime 汇总为
+Quality 全绿。
```

---

### Incident Patch 8: `9714bb18` (2026-09-06)
**Commit Message**: fix(release): stabilize v1.141.0 quality gates

**File**: `internal/exec-plans/release-v1.141.0-plan.md` (modified, +31/-0)
```diff
@@ -137,3 +137,34 @@ process owner 后才检查同连接重复 `processId`，因此先返回 `RUNTIME
 直接执行 typecheck 只被未跟踪的并行 remote WebSocket 实现缺少 `ws` 类型声明阻断，该文件不
 进入本轮修复提交。退出条件仍为 Quality 跨平台全绿；Windows 平台必须取得 current 八项矩阵
 `8/8`，不能用历史 `7/7` 或本机非 Windows 测试替代。
+
+### 第三轮 Quality 修复
+
+Quality run `34009678395` 已确认 Windows restricted execution `8/8`、GUI Smoke、Integrity、
+Frontend lint/typecheck/test-layer budget 通过；Frontend Full 在批次 57 命中治理测试的过期
+路线图文案，Rust Full 在 `config_jsonrpc` 命中无外部写入的 `configVersionConflict`。修复批次
+57 后继续续跑，又在批次 118 暴露 File Manager watcher 的默认 mock 返回同步 `void`，违反
+`FileSystemWatchStop = () => Promise<void>` 契约并在卸载时触发 `.catch` 读取错误。
+
+本轮修复口径：
+
+- 治理测试改断言当前 README 中仍受保护的 P8 收口与 Windows unelevated runner 事实，不恢复
+  已删除的旧路线图文案。
+- File Manager 测试 fixture 返回真实异步 stop 函数，生产 watcher 契约和清理实现不降级。
+- 配置版本摘要先递归规范化 JSON 对象键顺序再做 SHA-256；数组顺序、配置响应、持久化格式和
+  乐观锁冲突语义保持不变。该修复消除 workspace 中 TUI 启用 `serde_json/preserve_order` 后，
+  `Config` 内 `HashMap` 迭代顺序导致等价配置产生不同摘要的问题。
+
+验证证据：Frontend 批次 57-117 在隔离候选中通过，修复 watcher fixture 后批次 118-119
+`145/145` 通过；两个改动测试文件合并定向验证 `241/241` 通过，隔离候选的
+`npm run typecheck` 通过，相关 ESLint、rustfmt 与 `git diff --check` 通过。Rust 已用同一
+`cargo test --workspace` 场景在未修复隔离候选中精确复现 CI 冲突；修复后新增配置版本单测
+`1/1` 通过，同一 workspace 特性统一场景中的
+`config_control_plane_uses_the_single_desktop_yaml_layer` 通过且命令退出码为 `0`。共享工作树的
+workspace 复验曾被并行 TUI 未完成模块写入阻断，因此不把该结果归因到本轮修复。Quality run
+`34009678395` 的 Windows Shell Runtime 已最终通过，包括 restricted execution `8/8`、command
+timeout、目录创建与 Agent Plugin MCP parity；该 run 仍因修复前的 Frontend Full 与 Rust Full
+失败而保持失败结论。
+
+现有 `v1.141.0` 本地与远端 tag 均继续指向 `5a7fe5af9`；本轮只追加 main 修复，不删除、覆盖
+或重建既有 tag。退出条件仍为新修复提交推送后 Quality 全绿，并完成远端 main 状态复核。
```

**File**: `lime-rs/crates/app-server/src/processor/config.rs` (modified, +46/-2)
```diff
@@ -153,8 +153,7 @@ fn read_snapshot() -> Result<ConfigSnapshot, JsonRpcError> {
 
 fn snapshot_from_config(config: Config) -> Result<ConfigSnapshot, JsonRpcError> {
     let config = serde_json::to_value(config).map_err(config_runtime_error)?;
-    let bytes = serde_json::to_vec(&config).map_err(config_runtime_error)?;
-    let version = hex::encode(Sha256::digest(bytes));
+    let version = config_version(&config)?;
     let file_path = ConfigManager::default_config_path();
     Ok(ConfigSnapshot {
         config,
@@ -163,6 +162,28 @@ fn snapshot_from_config(config: Config) -> Result<ConfigSnapshot, JsonRpcError>
     })
 }
 
+fn config_version(config: &Value) -> Result<String, JsonRpcError> {
+    let canonical = canonicalize_json(config);
+    let bytes = serde_json::to_vec(&canonical).map_err(config_runtime_error)?;
+    Ok(hex::encode(Sha256::digest(bytes)))
+}
+
+fn canonicalize_json(value: &Value) -> Value {
+    match value {
+        Value::Object(object) => {
+            let mut keys = object.keys().collect::<Vec<_>>();
+            keys.sort();
+            let mut sorted = Map::with_capacity(object.len());
+            for key in keys {
+                sorted.insert(key.clone(), canonicalize_json(&object[key]));
+            }
+            Value::Object(sorted)
+        }
+        Value::Array(array) => Value::Array(array.iter().map(canonicalize_json).collect()),
+        other => other.clone(),
+    }
+}
+
 fn write_edits(
     file_path: Option<String>,
     expected_version: Option<String>,
@@ -381,6 +402,29 @@ fn config_write_error(code: ConfigWriteErrorCode, message: impl Into<String>) ->
 mod tests {
     use super::*;
 
+    #[test]
+    fn config_version_is_independent_of_object_insertion_order() {
+        let mut reversed_nested = Map::new();
+        reversed_nested.insert("beta".to_string(), json!(2));
+        reversed_nested.insert("alpha".to_string(), json!(1));
+        let mut reversed = Map::new();
+        reversed.insert("zeta".to_string(), json!(3));
+        reversed.insert("nested".to_string(), Value::Object(reversed_nested));
+
+        let canonical = json!({
+            "nested": {
+                "alpha": 1,
+                "beta": 2
+            },
+            "zeta": 3
+        });
+
+        assert_eq!(
+            config_version(&Value::Object(reversed)).expect("reversed config version"),
+            config_version(&canonical).expect("canonical config version")
+        );
+    }
+
     #[test]
     fn orchestrator_config_is_writable_through_current_control_plane() {
         assert!(CONFIG_ROOT_KEYS.contains(&"orchestrator"));
```

**File**: `src/components/agent/chat/components/FileManager/FileManagerSidebar.test.tsx` (modified, +3/-1)
```diff
@@ -245,7 +245,9 @@ beforeEach(() => {
   );
   vi.mocked(openPathWithDefaultApp).mockResolvedValue(undefined);
   vi.mocked(revealPathInFinder).mockResolvedValue(undefined);
-  vi.mocked(startFileSystemWatch).mockResolvedValue(vi.fn());
+  vi.mocked(startFileSystemWatch).mockResolvedValue(
+    vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
+  );
   window.localStorage.clear();
 });
 
```

**File**: `src/lib/governance/legacySurfaceCatalog.test.ts` (modified, +2/-2)
```diff
@@ -4763,10 +4763,10 @@ describe("legacySurfaceCatalog", () => {
 
     expect(offenders).toEqual([]);
     expect(readmeSource).toContain(
-      "P1/P2/P3/P4/P5/P7/P8 的骨架闭环已经具备 current facts、projection、GUI smoke、evidence export 与生产 mock / legacy command 防回流守卫",
+      "P8 骨架阶段已经收口，不再重复做旧字符串 inventory",
     );
     expect(readmeSource).toContain(
-      "Windows 机器上先在 `tool-runtime` current owner 实现 restricted-token runner",
+      "unelevated current-user restricted-token runner",
     );
     expect(implementationSource).toContain(
       "P8 residual 盘点结论：生产 `src / packages / electron` 主路径未发现 `agent_runtime_*` 直接命令调用",
```

---

### Incident Patch 9: `a89be1a6` (2026-09-06)
**Commit Message**: fix(release): close v1.141.0 quality failures

**File**: `internal/aiprompts/quality-workflow.md` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ npm run test:rust:integration -- -p <crate> --test <target>
 
 Agent/runtime 核心行为需要跨 owner 时，不把所有 case 堆进实现文件的 inline unit tests；使用专用测试模块或 integration target。`cargo nextest` 只在工具链、archive 和 CI shard 稳定后作为执行加速器，不改变本地 related-first 规则。
 
-Windows restricted execution 改动必须把 `windows-sandbox-runner.exe` 与 `app-server.exe`、`code-mode-host.exe`、`windows-sandbox-setup.exe` 成组构建。Electron Windows resources 和 `app-server.release.json` 必须包含 runner 及其 `windowsSandboxRunnerSha256`，`verify-package-resources` 对缺失或 digest 漂移 fail closed。源码/静态门禁不替代 `windows-restricted-execution-evidence-v3` 七项真实 Windows/MSVC 矩阵；Quality run `32975574520` 已在 SHA `19e08daa2` 取得 `7/7`，后续 Windows sandbox 改动必须保持该矩阵和 packaged resource 守卫全绿，否则 readiness 回退为 fail closed。
+Windows restricted execution 改动必须把 `windows-sandbox-runner.exe` 与 `app-server.exe`、`code-mode-host.exe`、`windows-sandbox-setup.exe` 成组构建。Electron Windows resources 和 `app-server.release.json` 必须包含 runner 及其 `windowsSandboxRunnerSha256`，`verify-package-resources` 对缺失或 digest 漂移 fail closed。源码/静态门禁不替代 `windows-restricted-execution-evidence-v3` 八项真实 Windows/MSVC 矩阵；Quality run `32975574520` 已在 SHA `19e08daa2` 取得当时七项矩阵的 `7/7` 历史基线，当前矩阵另含 unelevated managed-network preflight 拒绝，后续 Windows sandbox 改动必须保持 current matrix 和 packaged resource 守卫全绿，否则 readiness 回退为 fail closed。
 
 ## Gate A 与 Gate B
 
```

**File**: `internal/exec-plans/release-v1.141.0-plan.md` (modified, +26/-0)
```diff
@@ -111,3 +111,29 @@ v1.141.0 首次质量与 Electron 发布 workflow 暴露了三类问题：CLI/TU
 本地修复验证：`cargo check -p code-mode-protocol`、inventory/Windows Squirrel/release
 workflow 共 75 项 Vitest、`npm run test:contracts` 均通过。待提交推送后复跑 Quality 与
 Release workflows，确认跨平台构建及 Windows restricted execution setup 通过。
+
+### 第二轮 Quality 修复
+
+Quality run `33999878194` 在首轮修复后继续暴露三个独立问题：Windows restricted
+execution 已执行 8 个测试，但 evidence collector 的 required matrix 仍只有 7 项；
+Codex method product-scope fixture 引用了只在 Windows job 运行时生成、不会进入前端独立
+checkout 的 `.lime/qc/windows-restricted-execution/summary.json`；App Server 在注册共享
+process owner 后才检查同连接重复 `processId`，因此先返回 `RUNTIME_ERROR`，而不是协议要求的
+`INVALID_REQUEST`。
+
+当前修复口径：
+
+- 将 `unelevated_mode_rejects_managed_network_before_setup` 纳入八项 required matrix，并由脚本
+  单测自动比对 Rust integration target 的全部 `#[test]` / `#[tokio::test]`，防止测试清单再次
+  漂移。
+- 静态 product-scope fixture 只引用仓库内可追踪的 collector 与 Rust integration test；真实
+  `.lime/qc/**` 继续只作为平台运行 artifact，不伪造、不提交。
+- App Server 以 connection-scoped owner id 注册共享进程，在 spawn 前拒绝同连接 active 重复，
+  并允许不同连接或同连接终态后复用公开 `processId`。
+
+本地定向验证已通过：Windows evidence 与 Codex product-scope Vitest `19/19`；App Server
+`command_exec` 相关 Rust 单测 `12/12`；真实工作树 `npm run test:contracts` 通过；只叠加本轮
+候选文件的隔离 `HEAD` 快照中，`npm run typecheck` 与同一组 App Server 单测通过。当前工作树
+直接执行 typecheck 只被未跟踪的并行 remote WebSocket 实现缺少 `ws` 类型声明阻断，该文件不
+进入本轮修复提交。退出条件仍为 Quality 跨平台全绿；Windows 平台必须取得 current 八项矩阵
+`8/8`，不能用历史 `7/7` 或本机非 Windows 测试替代。
```

**File**: `internal/refactor/v1/fixtures/codex-method-product-scope.v0.1.json` (modified, +3/-2)
```diff
@@ -995,7 +995,8 @@
         "lime-rs/crates/app-server/src/processor/windows_sandbox.rs",
         "src/lib/api/windowsSandbox.ts",
         "src/components/settings-v2/system/execution-policy/WindowsSandboxReadinessStatus.tsx",
-        ".lime/qc/windows-restricted-execution/summary.json"
+        "scripts/lib/windows-restricted-execution-evidence.mjs",
+        "lime-rs/crates/tool-runtime/tests/windows_restricted_execution.rs"
       ],
       "methods": ["windowsSandbox/setupStart"]
     },
@@ -1502,7 +1503,7 @@
         "src/lib/api/windowsSandbox.ts",
         "src/components/settings-v2/system/execution-policy/WindowsSandboxReadinessStatus.tsx",
         "scripts/lib/windows-restricted-execution-evidence.mjs",
-        ".lime/qc/windows-restricted-execution/summary.json"
+        "lime-rs/crates/tool-runtime/tests/windows_restricted_execution.rs"
       ],
       "methods": [
         "windows/worldWritableWarning",
```

**File**: `lime-rs/crates/app-server/src/command_exec.rs` (modified, +40/-27)
```diff
@@ -84,6 +84,7 @@ impl CommandExecServer {
             connection_id,
             process_id: process_id.clone(),
         };
+        let owner_base_id = owner_process_id(connection_id, &process_id);
         let cwd = params
             .cwd
             .clone()
@@ -142,9 +143,20 @@ impl CommandExecServer {
         } else {
             parse_timeout(params.timeout_ms)?
         };
+        let mut sessions = self.sessions.lock().await;
+        if sessions.contains_key(&key) {
+            return Err(invalid_request(format!(
+                "duplicate active command/exec process id: {process_id}"
+            )));
+        }
+        let owner_id = if self.process_server.status(&owner_base_id).is_ok() {
+            format!("{owner_base_id}-{}", uuid::Uuid::new_v4())
+        } else {
+            owner_base_id
+        };
         let request = LocalExecutionRequest {
-            process_id: process_id.clone(),
-            tool_id: process_id.clone(),
+            process_id: owner_id.clone(),
+            tool_id: owner_id.clone(),
             tool_name: "command/exec".to_string(),
             command: params.command.clone(),
             cwd: Some(cwd),
@@ -158,34 +170,31 @@ impl CommandExecServer {
         let mut handle = start_local_execution_process(request)
             .map_err(|error| invalid_runtime(format!("failed to spawn command/exec: {error}")))?;
         if let Some(size) = params.size {
-            handle
-                .resize(size.rows, size.cols)
-                .map_err(|error| invalid_runtime(error.to_string()))?;
+            if let Err(error) = handle.resize(size.rows, size.cols) {
+                let _ = handle.terminate();
+                return Err(invalid_runtime(error.to_string()));
+            }
         }
-        self.process_server
+        if let Err(error) = self
+            .process_server
             .register_process_handle(handle.control_handle(), handle.status())
-            .map_err(|error| {
-                invalid_runtime(format!("failed to register command/exec process: {error}"))
-            })?;
         {
-            let mut sessions = self.sessions.lock().await;
-            if sessions.contains_key(&key) {
-                let _ = handle.terminate();
-                return Err(invalid_request(format!(
-                    "duplicate active command/exec process id: {process_id}"
-                )));
-            }
-            sessions.insert(
-                key.clone(),
-                CommandExecSession {
-                    process_id: process_id.clone(),
-                    control: handle.control_handle(),
-                    stream_stdin,
-                    tty: params.tty,
-                    stdin_open: Arc::new(Mutex::new(stream_stdin)),
-                },
-            );
+            let _ = handle.terminate();
+            return Err(invalid_runtime(format!(
+                "failed to register command/exec process: {error}"
+            )));
         }
+        sessions.insert(
+            key.clone(),
+            CommandExecSession {
+                process_id: owner_id.clone(),
+                control: handle.control_handle(),
+                stream_stdin,
+                tty: params.tty,
+                stdin_open: Arc::new(Mutex::new(stream_stdin)),
+            },
+        );
+        drop(sessions);
 
         let mut stdout = Capture::new(output_cap);
         let mut stderr = Capture::new(output_cap);
@@ -239,7 +248,7 @@ impl CommandExecServer {
                 }
                 _ = async { if let Some(sleep) = timeout_sleep.as_mut() { sleep.await } }, if timeout_sleep.is_some() => {
                     timed_out = true;
-                    let _ = self.process_server.terminate(&process_id);
+                    let _ = self.process_server.terminate(&owner_id);
                     timeout_sleep = None;
                 }
             }
@@ -511,6 +520,10 @@ fn key(connection_id: ConnectionId, process_id: &str)
```

**File**: `lime-rs/crates/app-server/src/command_exec/tests.rs` (modified, +67/-0)
```diff
@@ -1,8 +1,12 @@
 use super::*;
 #[cfg(unix)]
+use crate::execution_process::ExecutionProcessServer;
+#[cfg(unix)]
 use app_server_protocol::protocol::v2::CommandExecTerminalSize;
 #[cfg(unix)]
 use tokio::sync::mpsc;
+#[cfg(unix)]
+use tool_runtime::execution_process::live::LiveExecutionOutputQuery;
 
 #[cfg(unix)]
 fn server_with_notifications() -> (
@@ -107,6 +111,69 @@ async fn one_off_command_captures_stdout_stderr_and_exit_code() {
     assert_eq!(response.stderr, "stderr");
 }
 
+#[cfg(unix)]
+#[tokio::test]
+async fn command_exec_registers_output_and_terminal_status_with_shared_owner() {
+    let process_server = ExecutionProcessServer::default();
+    let server = CommandExecServer::default().with_process_server(process_server.clone());
+    let connection_id = ConnectionId(11);
+    let public_process_id = "shared-owner";
+    let response = server
+        .exec(
+            connection_id,
+            exec_params(Some(public_process_id), "printf shared-owner-output"),
+            None,
+        )
+        .await
+        .expect("execute command");
+
+    assert_eq!(response.exit_code, 0);
+    let owner_id = owner_process_id(connection_id, public_process_id);
+    let status = process_server.status(&owner_id).expect("shared status");
+    assert!(status.status.is_terminal());
+    assert_eq!(status.exit_code, Some(0));
+    assert_eq!(status.process_id, owner_id);
+
+    let output = process_server
+        .drain_output(LiveExecutionOutputQuery {
+            process_id: Some(owner_id),
+            ..LiveExecutionOutputQuery::default()
+        })
+        .expect("shared output");
+    assert!(output
+        .deltas
+        .iter()
+        .any(|delta| delta.delta.contains("shared-owner-output")));
+}
+
+#[cfg(unix)]
+#[tokio::test]
+async fn completed_process_id_can_be_reused_after_terminal_cleanup() {
+    let process_server = ExecutionProcessServer::default();
+    let server = CommandExecServer::default().with_process_server(process_server);
+    let connection_id = ConnectionId(12);
+
+    let first = server
+        .exec(
+            connection_id,
+            exec_params(Some("reusable"), "printf first"),
+            None,
+        )
+        .await
+        .expect("first command");
+    assert_eq!(first.stdout, "first");
+
+    let second = server
+        .exec(
+            connection_id,
+            exec_params(Some("reusable"), "printf second"),
+            None,
+        )
+        .await
+        .expect("terminal process id should be reusable");
+    assert_eq!(second.stdout, "second");
+}
+
 #[cfg(unix)]
 #[tokio::test]
 async fn explicit_read_only_policy_fails_closed_for_mutating_command() {
```

---

### Incident Patch 10: `4969a8cd` (2026-09-05)
**Commit Message**: fix(release): unblock v1.141.0 CI

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -63,6 +63,9 @@ internal/exec-plans/*
 !internal/exec-plans/tui-codex-snapshot-inventory.json
 !internal/exec-plans/tui-codex-snapshot-inventory.md
 !internal/exec-plans/tui-cli-surfaces-plan.md
+!internal/exec-plans/cli-codex-test-inventory.json
+!internal/exec-plans/cli-structure-inventory.json
+!internal/exec-plans/tui-structure-inventory.json
 !internal/exec-plans/documentation-convergence-plan.md
 !internal/exec-plans/scheduled-tasks-implementation.md
 !internal/exec-plans/release-v*-plan.md
```

**File**: `internal/exec-plans/release-v1.141.0-plan.md` (modified, +18/-0)
```diff
@@ -93,3 +93,21 @@ V8 预构建 archive 在本机 Darwin/aarch64 若仍返回 404，改用仓库已
 - `dead / deleted`：旧 Code Mode process/V8 物理实现及已退役 CLI 入口。
 
 当前完成度：验证与候选整理 95%；待用户确认后执行 release commit、tag、推送及远端复核。
+
+## 2026-09-06 发布后 CI 修复
+
+v1.141.0 首次质量与 Electron 发布 workflow 暴露了三类问题：CLI/TUI inventory JSON
+被根 `.gitignore` 忽略而未进入 CI checkout；`code-mode-protocol` 的 `tonic-build`
+依赖系统 `protoc`，导致 Linux/macOS/Windows Rust、GUI 和 Electron 构建均在代码生成阶段
+失败；Windows 构建失败后仍执行 Squirrel cleanup，因 summary 尚未生成而产生二次 `ENOENT`
+失败。修复如下：
+
+- 将三份生成账本加入 `.gitignore` 例外，保留为静态治理事实源。
+- 在 workspace 中加入 `protoc-bin-vendored`，由 `code-mode-protocol/build.rs` 设置
+  `PROTOC`，消除平台工具链前置条件并同步 `Cargo.lock`。
+- 导出并保护 `cleanupFromSummary`：summary 不存在时记录明确 no-op，不覆盖原始构建错误；
+  增加缺失 summary 回归测试。
+
+本地修复验证：`cargo check -p code-mode-protocol`、inventory/Windows Squirrel/release
+workflow 共 75 项 Vitest、`npm run test:contracts` 均通过。待提交推送后复跑 Quality 与
+Release workflows，确认跨平台构建及 Windows restricted execution setup 通过。
```

**File**: `lime-rs/Cargo.lock` (modified, +65/-0)
```diff
@@ -1068,6 +1068,7 @@ name = "code-mode-protocol"
 version = "1.141.0"
 dependencies = [
  "prost",
+ "protoc-bin-vendored",
  "serde",
  "serde_json",
  "tokio",
@@ -5399,6 +5400,70 @@ dependencies = [
  "prost",
 ]
 
+[[package]]
+name = "protoc-bin-vendored"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "d1c381df33c98266b5f08186583660090a4ffa0889e76c7e9a5e175f645a67fa"
+dependencies = [
+ "protoc-bin-vendored-linux-aarch_64",
+ "protoc-bin-vendored-linux-ppcle_64",
+ "protoc-bin-vendored-linux-s390_64",
+ "protoc-bin-vendored-linux-x86_32",
+ "protoc-bin-vendored-linux-x86_64",
+ "protoc-bin-vendored-macos-aarch_64",
+ "protoc-bin-vendored-macos-x86_64",
+ "protoc-bin-vendored-win32",
+]
+
+[[package]]
+name = "protoc-bin-vendored-linux-aarch_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c350df4d49b5b9e3ca79f7e646fde2377b199e13cfa87320308397e1f37e1a4c"
+
+[[package]]
+name = "protoc-bin-vendored-linux-ppcle_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "a55a63e6c7244f19b5c6393f025017eb5d793fd5467823a099740a7a4222440c"
+
+[[package]]
+name = "protoc-bin-vendored-linux-s390_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "1dba5565db4288e935d5330a07c264a4ee8e4a5b4a4e6f4e83fad824cc32f3b0"
+
+[[package]]
+name = "protoc-bin-vendored-linux-x86_32"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8854774b24ee28b7868cd71dccaae8e02a2365e67a4a87a6cd11ee6cdbdf9cf5"
+
+[[package]]
+name = "protoc-bin-vendored-linux-x86_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b38b07546580df720fa464ce124c4b03630a6fb83e05c336fea2a241df7e5d78"
+
+[[package]]
+name = "protoc-bin-vendored-macos-aarch_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "89278a9926ce312e51f1d999fee8825d324d603213344a9a706daa009f1d8092"
+
+[[package]]
+name = "protoc-bin-vendored-macos-x86_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "81745feda7ccfb9471d7a4de888f0652e806d5795b61480605d4943176299756"
+
+[[package]]
+name = "protoc-bin-vendored-win32"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "95067976aca6421a523e491fce939a3e65249bac4b977adee0ee9771568e8aa3"
+
 [[package]]
 name = "pulldown-cmark"
 version = "0.10.3"
```

**File**: `lime-rs/Cargo.toml` (modified, +1/-0)
```diff
@@ -158,6 +158,7 @@ cpal = "0.15"
 prost = "0.13.5"
 tonic = { version = "0.12.3", features = ["transport"] }
 tonic-build = "0.12.3"
+protoc-bin-vendored = "3.2.0"
 
 # TLS
 rustls-pemfile = "2"
```

**File**: `lime-rs/crates/code-mode-protocol/Cargo.toml` (modified, +1/-0)
```diff
@@ -20,3 +20,4 @@ tonic.workspace = true
 
 [build-dependencies]
 tonic-build.workspace = true
+protoc-bin-vendored.workspace = true
```

#### Recent Merged Pull Requests:
- **PR #142** (2026-04-15): fix: serialize release asset publishing (@wutongci)
- **PR #138** (2026-03-19): feat: add Novita AI provider (OpenAI-compatible) (@Alex-yang00)
- **PR #121** (2026-01-13): fix(ui): 修复自定义模型无法在模型选择器中显示的问题 (@Chiron-Brahm)
- **PR #120** (2026-01-13): fix(server): 修复监听地址配置不生效的问题 (#110) (@Chiron-Brahm)
- **PR #111** (2026-01-12): feat(i18n): add additional disctionary for english language (@tjengbudi)
- **PR #109** (2026-01-12): fix: 修复凭证代理设置无法清空的问题 (@Chiron-Brahm)
- **PR #108** (2026-01-12): feat: 动态检测 IP 地址变化并自动更新 (@Chiron-Brahm)
- **PR #105** (2026-01-11): feat: 添加开发模式 HTTP 桥接，支持浏览器 dev server 与 Tauri 后端通信 (@lwmacct)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
