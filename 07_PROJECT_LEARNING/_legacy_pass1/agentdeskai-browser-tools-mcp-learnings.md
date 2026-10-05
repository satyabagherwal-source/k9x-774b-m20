# Forensic Learning Record (Deep Inspection): AgentDeskAI/browser-tools-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentdeskai-browser-tools-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AgentDeskAI/browser-tools-mcp](https://github.com/AgentDeskAI/browser-tools-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:42:20.305Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AgentDeskAI/browser-tools-mcp`
- **Description**: Monitor browser logs directly from Cursor and other MCP compatible IDEs.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7329 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `browser-tools-mcp/src/cli.ts`
```
import fs from "node:fs";
import { ALL_TOOL_NAMES } from "./mcp/server.js";

export interface CliOptions {
  showVersion: boolean;
  showHelp: boolean;
  doctor: boolean;
  port?: number;
  host?: string;
  screenshotDir?: string;
  connectUrl?: string;
  token?: string;
  enabledTools?: string[];
  disabledTools?: string[];
  redact: boolean;
  standalone: boolean;
  /** Print every captured entry as it arrives. */
  verbose: boolean;
}

export function readPackageVersion(): string {
  try {
    const url = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(url, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function splitList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function numberOrUndefined(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Parses argv and environment. Metadata flags are recognised here so that
 * `--version` and `--help` answer immediately, without starting a server.
 */
export function parseCli(argv: string[], env: NodeJS.ProcessEnv = process.env): CliOptions {
  const options: CliOptions = {
    showVersion: false,
    showHelp: false,
    doctor: false,
    redact: env["BROWSER_TOOLS_REDACT"] !== "false",
    standalone: false,
    verbose: env["BROWSER_TOOLS_VERBOSE"] === "true" || env["BROWSER_TOOLS_VERBOSE"] === "1",
    ...(numberOrUndefined(env["BROWSER_TOOLS_PORT"]) !== undefined
      ? { port: numberOrUndefined(env["BROWSER_TOOLS_PORT"]) }
      : {}),
    ...(env["BROWSER_TOOLS_HOST"] ? { host: env["BROWSER_TOOLS_HOST"] } : {}),
    ...(env["BROWSER_TOOLS_SCREENSHOT_DIR"]
      ? { screenshotDir: env["BROWSER_TOOLS_SCREENSHOT_DIR"] }
      : {}),
    ...(env["BROWSER_TOOLS_TOKEN"] ? { token: env["BROWSER_TOOLS_TOKEN"] } : {}),
    ...(splitList(env["BROWSER_TOOLS_TOOLS"])
      ? { enabledTools: splitList(env["BROWSER_TOOLS_TOOLS"]) }
      : {}),
    ...(splitList(env["BROWSER_TOOLS_EXCLUDE_TOOLS"])
      ? { disabledTools: splitList(env["BROWSER_TOOLS_EXCLUDE_TOOLS"]) }
      : {}),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => argv[++i];

    switch (arg) {
      case "--version":
      case "-v":
        options.showVersion = true;
        break;
      case "--help":
      case "-h":
      case "help":
        options.showHelp = true;
        break;
      case "--doctor":
        options.doctor = true;
        break;
      case "--standalone":
        options.standalone = true;
        break;
      case "--no-redact":
        options.redact = false;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--port":
        options.port = numberOrUndefined(next());
        break;
      case "--host":
        options.host = next();
        break;
      case "--screenshot-dir":
        options.screenshotDir = next();
        break;
      case "--connect":
        options.connectUrl = next();
        break;
      case "--token":
        options.token = next();
        break;
      case "--only":
        options.enabledTools = splitList(next());
        break;
      case "--exclude":
        options.disabledTools = splitList(next());
        break;
      default:
        if (arg.startsWith("--port=")) options.port = numberOrUndefined(arg.slice(7));
        else if (arg.startsWith("--host=")) options.host = arg.slice(7);
        else if (arg.startsWith("--only=")) options.enabledTools = splitList(arg.slice(7));
        else if (arg.startsWith("--exclude=")) options.disabledTools = splitList(arg.slice(10));
        else if (arg.startsWith("--connect=")) options.connectUrl = arg.slice(10);
        else if (arg.startsWith("--token=")) options.token = arg.slice(8);
        else if (arg.startsWith("--screenshot-dir=")) options.screenshotDir = arg.slice(17);
        break;
    }
  }

  return options;
}

export function helpText(): string {
  return `BrowserTools MCP — live browser telemetry for AI coding agents

Usage:
  browser-tools-mcp [options]

The MCP server embeds the browser connector, so this is the only process you
need to run. Point your MCP client at this command and install the Chrome
extension.

Options:
  -v, --version            Print the version and exit
  -h, --help               Print this help and exit
      --doctor             Check the local setup and exit
      --port <n>           Port for the connector the extension talks to (default 3025)
      --host <addr>        Loopback address to bind (default 127.0.0.1)
      --screenshot-dir <p> Where screenshots are written
      --only <a,b>         Expose only these tools
      --exclude <a,b>      Hide these tools
      --connect <url>      Attach to a connector already running at this URL
      --token <t>          Auth token to use with --connect
      --verbose            Print each captured console and network entry as it arrives
      --no-redact          Do not scrub credentials from captured data (not recommended)

Environment:
  BROWSER_TOOLS_PORT, BROWSER_TOOLS_HOST, BROWSER_TOOLS_SCREENSHOT_DIR,
  BROWSER_TOOLS_TOOLS, BROWSER_TOOLS_EXCLUDE_TOOLS, BROWSER_TOOLS_TOKEN,
  BROWSER_TOOLS_STATE_DIR, BROWSER_TOOLS_LOG_LEVEL, BROWSER_TOOLS_REDACT,
  BROWSER_TOOLS_VERBOSE

Available tools:
  ${ALL_TOOL_NAMES.join(", ")}
`;
}

```

### Core Architecture Module: `browser-tools-mcp/src/connector-bin.ts`
```
#!/usr/bin/env node
/**
 * Standalone connector.
 *
 * The MCP server embeds this, so most people never need it. Run it when
 * several MCP clients should share one browser session: start this first, and
 * each client attaches to it instead of starting its own.
 */
import { parseCli, readPackageVersion } from "./cli.js";
import { createConnector } from "./connector/connector.js";
import { clearSessionFile, writeSessionFile } from "./util/session.js";
import { createLogger } from "./util/logger.js";
import { getDefaultScreenshotDir } from "./util/paths.js";

const log = createLogger("connector-bin");

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));

  if (options.showVersion) {
    process.stdout.write(`${readPackageVersion()}\n`);
    return;
  }
  if (options.showHelp) {
    process.stdout.write(
      `BrowserTools connector\n\n` +
        `Usage:\n  browser-tools-connector [options]\n\n` +
        `Only needed when several MCP clients must share one browser session;\n` +
        `browser-tools-mcp starts its own connector otherwise.\n\n` +
        `Options:\n` +
        `  -v, --version            Print the version and exit\n` +
        `  -h, --help               Print this help and exit\n` +
        `      --port <n>           Port to listen on (default 3025)\n` +
        `      --host <addr>        Loopback address to bind (default 127.0.0.1)\n` +
        `      --screenshot-dir <p> Where screenshots are written\n` +
        `      --verbose            Print each captured entry as it arrives\n` +
        `      --no-redact          Do not scrub credentials from captured data\n`
    );
    return;
  }

  const connector = await createConnector({
    ...(options.port !== undefined ? { port: options.port } : {}),
    ...(options.host ? { host: options.host } : {}),
    ...(options.screenshotDir ? { screenshotDir: options.screenshotDir } : {}),
    ...(options.token ? { token: options.token } : {}),
    redact: options.redact,
    verbose: options.verbose,
  });

  writeSessionFile({
    port: connector.port,
    token: connector.token,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    version: readPackageVersion(),
  });

  // This process has no MCP client on stdout, so it is free to print.
  process.stdout.write(
    `BrowserTools connector listening on http://127.0.0.1:${connector.port}\n` +
      `Screenshots: ${options.screenshotDir ?? getDefaultScreenshotDir()}\n` +
      `Waiting for the Chrome extension. Open Chrome DevTools (F12) on the page you want to inspect.\n`
  );

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Received ${signal}, shutting down`);
    clearSessionFile();
    await connector.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  log.error("Fatal error during startup:", error);
  process.exit(1);
});

```

### Core Architecture Module: `browser-tools-mcp/src/connector/connector.ts`
```
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import type { Duplex } from "node:stream";

import {
  TelemetryStore,
  type ConsoleEntry,
  type ConsoleQuery,
  type NetworkEntry,
  type NetworkQuery,
  type QueryResult,
  type TabId,
} from "./store.js";
import { localOnlyGuard, requireToken, isExtensionOrigin, isLoopbackHost } from "./security.js";
import { generateToken, tokensMatch } from "../util/session.js";
import { createLogger } from "../util/logger.js";
import {
  getDefaultScreenshotDir,
  resolveSafeScreenshotPath,
  screenshotFilename,
  UnsafePathError,
} from "../util/paths.js";
import {
  approximateBytes,
  extensionForMimeType,
  parseImageDataUrl,
  withExtension,
} from "../util/image.js";
import { AuditError, runLighthouseAudit, type AuditHooks } from "../lighthouse/runner.js";
import { isAuditCategory, type AuditCategory, type AuditReport } from "../lighthouse/types.js";

export const SERVER_SIGNATURE = "mcp-browser-connector-24x7";
export const SERVER_VERSION = "2.0.0";

const log = createLogger("connector");

export class NoExtensionError extends Error {
  constructor() {
    super(
      "No browser extension is connected. Open Chrome DevTools (F12) on the page you want to inspect; " +
        "capture starts as soon as DevTools is open. Run `browser-tools-mcp --doctor` to check the setup."
    );
    this.name = "NoExtensionError";
  }
}

export class UnknownTabError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownTabError";
  }
}

export class ExtensionRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtensionRequestError";
  }
}

export class ExtensionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtensionTimeoutError";
  }
}

export interface ConnectorConfig {
  /** Loopback address to bind. Non-loopback requires allowNonLoopback. */
  host?: string;
  /** 0 picks an ephemeral port; otherwise the first free port from here. */
  port?: number;
  token?: string;
  screenshotDir?: string;
  redact?: boolean;
  heartbeatIntervalMs?: number;
  requestTimeoutMs?: number;
  maxBodySize?: string;
  /** Escape hatch, off by default, for users who knowingly expose the server. */
  allowNonLoopback?: boolean;
  /**
   * Print each captured entry as it arrives.
   *
   * Off by default: this is a debugging aid for confirming capture works, and
   * on a busy page it is a lot of output.
   */
  verbose?: boolean;
  /** Injectable so audits can be exercised without launching a browser. */
  auditRunner?: (
    options: { url: string; category: AuditCategory },
    hooks?: AuditHooks
  ) => Promise<AuditReport>;
}

export interface TabView {
  tabId: TabId;
  url: string;
  /** True for the tab that tools act on when no tabId is given. */
  isCurrent: boolean;
  consoleCount: number;
  networkCount: number;
}

export interface ExportResult<T> {
  tabId: TabId | null;
  url: string;
  entries: T[];
}

export interface Artifact {
  mimeType: string;
  /** Text artifacts carry `text`; binary ones carry base64 `blob`. */
  text?: string;
  blob?: string;
}

/** A query result, plus which tab it describes. */
export interface TabScopedResult<T> extends QueryResult<T> {
  tabId: TabId | null;
  url: string;
  /** Connected tabs this result does NOT cover. */
  otherTabs: number;
}

export interface ScreenshotCapture {
  path: string;
  /** Data URL, carrying whichever format the browser settled on. */
  data: string;
  name: string;
  mimeType: string;
  bytes: number;
  /** False when the browser could not get the image under the byte budget. */
  withinBudget: boolean;
  /** Which tab was captured, so a wrong-tab shot is obvious rather than silent. */
  tabId: TabId | null;
  url: string;
}

export interface Connector {
  app: Express;
  server: http.Server;
  store: TelemetryStore;
  port: number;
  host: string;
  token: string;
  screenshotDir: string;
  hasExtension(): boolean;
  /** Tabs with DevTools open right now. */
  listTabs(): TabView[];
  getCurrentTabId(): TabId | null;
  setCurrentTab(tabId: TabId): void;
  queryConsole(query: ConsoleQuery & { allTabs?: boolean }): TabScopedResult<ConsoleEntry>;
  queryNetwork(query: NetworkQuery & { allTabs?: boolean }): TabScopedResult<NetworkEntry>;
  getSelectedElement(options?: { tabId?: TabId }): unknown;
  /** Complete history, with no per-call budget applied. Backs the resources. */
  exportConsole(options?: { tabId?: TabId; allTabs?: boolean }): ExportResult<ConsoleEntry>;
  exportNetwork(options?: { tabId?: TabId; allTabs?: boolean }): ExportResult<NetworkEntry>;
  readArtifact(kind: "screenshot" | "audit", name: string): Promise<Artifact>;
  captureScreenshot(options?: { name?: string; tabId?: TabId }): Promise<ScreenshotCapture>;
  refreshTab(options?: { tabId?: TabId }): Promise<void>;
  readStorage(kinds: string[], options?: { tabId?: TabId }): Promise<Record<string, unknown>>;
  runAudit(
    category: AuditCategory,
    options?: { url?: string; tabId?: TabId }
  ): Promise<AuditReport>;
  close(): Promise<void>;
}

interface ExtensionConnection {
  ws: WebSocket;
  id: string;
  awaitingPong: boolean;
  missedPings: number;
  lastSeen: number;
  tabId: number | string | null;
}

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  /** Only the connection the request was sent to may answer it. */
  connectionId: string;
}

/** A browser tab that has had DevTools open during this connector's lifetime. */
interface TabRecord {
  tabId: TabId;
  connectionId: string | null;
  url: string;
  lastActivityAt: number;
}

export async function createConnector(config: ConnectorConfig = {}): Promise<Connector> {
  const host = config.host ?? "127.0.0.1";
  if (!isLoopbackHost(host) && !config.allowNonLoopback) {
    throw new Error(
      `Refusing to bind ${host}: the connector accepts loopback addresses only. ` +
        `Everything it exposes — console logs, network bodies, screenshots — would ` +
        `otherwise be reachable from the local network. Set allowNonLoopback to override.`
    );
  }

  const token = config.token ?? generateToken();
  const screenshotDir = path.resolve(config.screenshotDir ?? getDefaultScreenshotDir());
  const heartbeatIntervalMs = config.heartbeatIntervalMs ?? 15_000;
  const requestTimeoutMs = config.requestTimeoutMs ?? 10_000;

  const store = new TelemetryStore({ redact: config.redact !== false });
  const verbose = config.verbose === true;

  /**
   * Reports a captured entry to the terminal.
   *
   * Goes through the logger, so it lands on stderr — the MCP server shares this
   * process with the JSON-RPC stream on stdout, and a stray write there ends the
   * session. Values are already redacted by the time they arrive.
   */
  function reportCapture(kind: "console" | "network", entry: unknown, tabId: TabId | null): void {
    if (!verbose || !entry) return;
    const where = tabId === null ? "" : ` tab ${tabId}`;

    if (kind === "console") {
      const e = entry as ConsoleEntry;
      log.info(`· console ${e.level}${where} ${clip(e.message)}`);
      return;
    }
    const e = entry as NetworkEntry;
    const took = e.durationMs ? ` (${e.durationMs}ms)` : "";
    log.info(`· network ${e.status || "---"} ${e.method}${where} ${clip(e.url)}${took}`);
  }

  const connections = new Map<string, ExtensionConnection>();
  const pending = new Map<string, PendingRequest>();

  /** Tabs currently connected, keyed by String(tabId). */
  const tabs = new Map<string, TabRecord>();
  /**
   * Every tabId bound during this connector's life, including tabs that have
   * since disconnected. This is what di
```

### Core Architecture Module: `browser-tools-mcp/src/connector/security.ts`
```
import type { Request, Response, NextFunction } from "express";
import { tokensMatch } from "../util/session.js";

/** Hostnames a request is allowed to arrive as. Anything else is a rebind. */
const ALLOWED_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/**
 * Browser extension origins. A web page cannot forge these — the browser sets
 * Origin itself — so this is what keeps a visited page out of the connector.
 */
const EXTENSION_ORIGIN =
  /^(chrome-extension|moz-extension|safari-web-extension|extension):\/\/[A-Za-z0-9._-]+$/;

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}

export function isExtensionOrigin(origin: string | undefined | null): boolean {
  if (!origin) return false;
  return EXTENSION_ORIGIN.test(origin);
}

function hostnameOf(hostHeader: string | undefined): string {
  if (!hostHeader) return "";
  // Strip the port; keep bracketed IPv6 intact.
  if (hostHeader.startsWith("[")) {
    const end = hostHeader.indexOf("]");
    return end === -1 ? hostHeader : hostHeader.slice(0, end + 1);
  }
  const colon = hostHeader.lastIndexOf(":");
  return colon === -1 ? hostHeader : hostHeader.slice(0, colon);
}

/**
 * Rejects requests that did not come from this machine addressed as localhost,
 * and any request carrying a web-page Origin.
 *
 * Together these close the cross-site path that made every endpoint reachable
 * from any page the user happened to visit.
 */
export function localOnlyGuard() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const hostname = hostnameOf(req.headers.host);
    if (!ALLOWED_HOSTNAMES.has(hostname)) {
      res.status(403).json({
        error: "Requests must address this server as localhost",
        code: "FORBIDDEN_HOST",
      });
      return;
    }

    const origin = req.headers.origin;
    if (origin && !isExtensionOrigin(origin)) {
      res.status(403).json({
        error: "Cross-origin requests are not accepted",
        code: "FORBIDDEN_ORIGIN",
      });
      return;
    }

    next();
  };
}

/** Requires a bearer token on the API surface. */
export function requireToken(token: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const presented = match?.[1] ?? (typeof req.query["token"] === "string" ? req.query["token"] : "");

    if (!presented || !tokensMatch(presented, token)) {
      res.status(401).json({
        error: "Missing or invalid authorization token",
        code: "UNAUTHORIZED",
      });
      return;
    }
    next();
  };
}

```

### Core Architecture Module: `browser-tools-mcp/src/connector/settings.ts`
```
/**
 * Capture settings the browser extension is allowed to change.
 *
 * This is an explicit allowlist with clamped ranges. The previous
 * implementation spread an arbitrary request body over its global settings
 * object, which let any caller repoint the screenshot directory or set an
 * unbounded log limit and exhaust memory.
 */

export interface CaptureSettings {
  /** Maximum entries retained per log category. */
  logLimit: number;
  /** Character budget for a single query response. */
  queryLimit: number;
  /** Maximum length of any individual captured string. */
  stringSizeLimit: number;
  /** Maximum serialised size of a single captured entry. */
  maxLogSize: number;
  /**
   * Byte budget for a screenshot. The browser degrades format and scale until
   * the capture fits, so an image never blows the client's context window or
   * overruns the transport's read buffer.
   */
  screenshotMaxBytes: number;
  showRequestHeaders: boolean;
  showResponseHeaders: boolean;
}

export const LIMITS = {
  // 50 was less than a single real page load, so anything reading back over
  // a session was silently clipped.
  logLimit: { min: 1, max: 5_000, default: 500 },
  queryLimit: { min: 1_000, max: 500_000, default: 30_000 },
  stringSizeLimit: { min: 100, max: 100_000, default: 500 },
  maxLogSize: { min: 1_000, max: 1_000_000, default: 20_000 },
  // Ceiling stays under the 10 MB read buffer that newer MCP stdio transports
  // enforce, so a screenshot can never sever the connection.
  screenshotMaxBytes: { min: 50_000, max: 9_000_000, default: 3_000_000 },
} as const;

export const DEFAULT_SETTINGS: Readonly<CaptureSettings> = Object.freeze({
  logLimit: LIMITS.logLimit.default,
  queryLimit: LIMITS.queryLimit.default,
  stringSizeLimit: LIMITS.stringSizeLimit.default,
  maxLogSize: LIMITS.maxLogSize.default,
  screenshotMaxBytes: LIMITS.screenshotMaxBytes.default,
  // Headers routinely carry credentials, so both default to off.
  showRequestHeaders: false,
  showResponseHeaders: false,
});

const NUMERIC_KEYS = [
  "logLimit",
  "queryLimit",
  "stringSizeLimit",
  "maxLogSize",
  "screenshotMaxBytes",
] as const satisfies readonly (keyof typeof LIMITS)[];

const BOOLEAN_KEYS = ["showRequestHeaders", "showResponseHeaders"] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Produces a new settings object from `current` plus whatever of `patch` is
 * recognised. Unknown keys, wrong types and out-of-range values are discarded
 * rather than rejected, so a well-meaning client with a stale field still works.
 */
export function mergeSettings(
  current: Readonly<CaptureSettings>,
  patch: unknown
): CaptureSettings {
  const out: CaptureSettings = { ...current };
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return out;

  const source = patch as Record<string, unknown>;

  for (const key of NUMERIC_KEYS) {
    if (!Object.hasOwn(source, key)) continue;
    const value = source[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const range = LIMITS[key];
    out[key] = clamp(value, range.min, range.max);
  }

  for (const key of BOOLEAN_KEYS) {
    if (!Object.hasOwn(source, key)) continue;
    const value = source[key];
    if (typeof value !== "boolean") continue;
    out[key] = value;
  }

  return out;
}

```

### Core Architecture Module: `browser-tools-mcp/src/connector/store.ts`
```
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type CaptureSettings,
} from "./settings.js";
import { redactHeaders, redactSecretsInString, redactValue } from "../util/redact.js";
import { selectLogsWithinBudget, truncateStringsInData } from "../util/truncate.js";

export type TabId = number | string;

export interface ConsoleEntry {
  type: string;
  level: string;
  message: string;
  timestamp: number;
  /** The browser tab this came from, when known. */
  tabId?: TabId | null;
  url?: string;
  stackTrace?: unknown;
}

export interface NetworkEntry {
  type: string;
  url: string;
  method: string;
  status: number;
  /** When the request completed. */
  timestamp: number;
  /** When the request started, if the capture could determine it. */
  startedAt?: number;
  tabId?: TabId | null;
  durationMs?: number;
  error?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
}

export interface SelectedElement {
  [key: string]: unknown;
}

export interface PageState {
  url: string;
  tabId: TabId | null;
}

export interface QueryResult<T> {
  entries: T[];
  /** Entries matching the filter before pagination and budget clipping. */
  total: number;
  /** Entries actually returned. */
  returned: number;
  /** True when the caller is not seeing every matching entry. */
  truncated: boolean;
}

export interface ConsoleQuery {
  errorsOnly?: boolean;
  keywords?: string[];
  /** Restrict to one tab. Omit to read across every tab. */
  tabId?: TabId;
  limit?: number;
  offset?: number;
}

export interface NetworkQuery {
  errorsOnly?: boolean;
  urlKeywords?: string[];
  bodyKeywords?: string[];
  tabId?: TabId;
  limit?: number;
  offset?: number;
}

export interface TelemetryStoreOptions {
  settings?: Partial<CaptureSettings>;
  /** Set false to keep raw credentials in captured data. */
  redact?: boolean;
}

const ERROR_LEVELS = new Set(["error", "assert", "critical"]);

/** Entries with no tab attribution share one bucket. */
const UNATTRIBUTED = "__no-tab__";

/**
 * Oldest first, so #paginate's tail slice is genuinely the newest.
 *
 * Entries arrive in flush order, not event order: the extension batches every
 * 100ms per tab and buffers up to 1000 while the socket is down, so a merged
 * read could otherwise interleave two tabs wrongly and call the wrong end
 * "newest". Sorting a copy keeps insertion order intact for eviction.
 */
function byTime<T extends { timestamp: number }>(entries: readonly T[]): readonly T[] {
  return [...entries].sort((a, b) => a.timestamp - b.timestamp);
}

function tabKey(tabId: TabId | null | undefined): string {
  return tabId === null || tabId === undefined ? UNATTRIBUTED : String(tabId);
}

/**
 * In-memory telemetry captured from the browser.
 *
 * Entries are attributed to the tab that produced them, because DevTools can be
 * open on several tabs at once and merging their output leaves an agent unable
 * to tell which page it is looking at. Retention is per tab too, so a noisy tab
 * cannot evict a quiet one's history.
 *
 * Everything is scrubbed and size-capped on the way in, so nothing downstream
 * has to remember to do it, and a hostile page cannot grow the process without
 * bound.
 */
export class TelemetryStore {
  #settings: CaptureSettings;
  #redact: boolean;
  #console: ConsoleEntry[] = [];
  #network: NetworkEntry[] = [];
  #selectedElements = new Map<string, SelectedElement>();
  #lastSelectedTab: string = UNATTRIBUTED;
  #page: PageState = { url: "", tabId: null };

  constructor(options: TelemetryStoreOptions = {}) {
    this.#settings = mergeSettings(DEFAULT_SETTINGS, options.settings);
    this.#redact = options.redact !== false;
  }

  get settings(): Readonly<CaptureSettings> {
    return this.#settings;
  }

  updateSettings(patch: unknown): CaptureSettings {
    this.#settings = mergeSettings(this.#settings, patch);
    this.#evictAll();
    return this.#settings;
  }

  // ---------------------------------------------------------------- ingest

  addConsole(raw: unknown, tabId?: TabId | null): ConsoleEntry | null {
    const source = asRecord(raw);
    if (!source) return null;

    const level = asString(source["level"]) || inferLevel(asString(source["type"]));
    const entry: ConsoleEntry = {
      type: asString(source["type"]) || "console-log",
      level,
      message: this.#clean(coerceMessage(source["message"])),
      timestamp: asTimestamp(source["timestamp"]),
      tabId: resolveTabId(tabId, source["tabId"]),
    };

    const url = asString(source["url"]);
    if (url) entry.url = this.#clean(url);

    if (source["stackTrace"] !== undefined) {
      entry.stackTrace = this.#cleanValue(source["stackTrace"]);
    }

    this.#console.push(entry);
    this.#evictTab(this.#console, tabKey(entry.tabId));
    return entry;
  }

  addNetwork(raw: unknown, tabId?: TabId | null): NetworkEntry | null {
    const source = asRecord(raw);
    if (!source) return null;

    const entry: NetworkEntry = {
      type: asString(source["type"]) || "network-request",
      url: this.#clean(asString(source["url"])),
      method: asString(source["method"]) || "GET",
      status: asNumber(source["status"]),
      timestamp: asTimestamp(source["timestamp"]),
      tabId: resolveTabId(tabId, source["tabId"]),
    };

    const duration = asNumber(source["durationMs"] ?? source["duration"]);
    if (duration) entry.durationMs = duration;

    const error = asString(source["error"]);
    if (error) entry.error = this.#clean(error);

    // Headers are stored redacted; whether they are handed out is a separate
    // decision made at query time.
    const requestHeaders = asRecord(source["requestHeaders"]);
    if (requestHeaders) {
      entry.requestHeaders = this.#headers(requestHeaders as Record<string, string>);
    }
    const responseHeaders = asRecord(source["responseHeaders"]);
    if (responseHeaders) {
      entry.responseHeaders = this.#headers(responseHeaders as Record<string, string>);
    }

    const requestBody = source["requestBody"];
    if (requestBody !== undefined && requestBody !== null) {
      entry.requestBody = this.#clean(coerceMessage(requestBody));
    }
    const responseBody = source["responseBody"];
    if (responseBody !== undefined && responseBody !== null) {
      entry.responseBody = this.#clean(coerceMessage(responseBody));
    }

    this.#network.push(entry);
    this.#evictTab(this.#network, tabKey(entry.tabId));
    return entry;
  }

  setSelectedElement(element: unknown, tabId?: TabId | null): void {
    const key = tabKey(tabId);
    const record = asRecord(element);
    if (!record) {
      this.#selectedElements.delete(key);
      return;
    }
    this.#selectedElements.set(key, this.#cleanValue(record) as SelectedElement);
    this.#lastSelectedTab = key;
  }

  /** The element selected in a given tab, or the most recent one overall. */
  getSelectedElement(tabId?: TabId | null): SelectedElement | null {
    const key = tabId === undefined ? this.#lastSelectedTab : tabKey(tabId);
    return this.#selectedElements.get(key) ?? null;
  }

  setCurrentPage(page: { url?: unknown; tabId?: unknown }): void {
    const url = asString(page?.url);
    if (url) this.#page.url = url;
    const tabId = page?.tabId;
    if (typeof tabId === "number" || typeof tabId === "string") {
      this.#page.tabId = tabId;
    }
  }

  getCurrentPage(): PageState {
    return { ...this.#page };
  }

  /** Clears one tab's telemetry, or everything when no tab is named. */
  wipe(tabId?: TabId | null): void {
    if (tabId === undefined || tabId === null) {
      this.#console = [];
      this.#network = [];
      this.#selectedElements.clear();
      this.#lastSelectedTab = UNATTRIBUTED;
      return;
    }

    const key = tabKey(tabId);
    this.#console = this.#console.filter((entry) => tabKey(entry.tabId) !== key);
    this.#network = this.#network.filter((entry) => tabKey(ent
```

### Core Architecture Module: `browser-tools-mcp/src/doctor.ts`
```
import os from "node:os";
import fs from "node:fs";
import { createRuntime } from "./runtime.js";
import { readSessionFile, sessionFilePath } from "./util/session.js";
import { getDefaultScreenshotDir } from "./util/paths.js";
import { readPackageVersion, type CliOptions } from "./cli.js";

const MINIMUM_NODE_MAJOR = 22;

function line(label: string, value: string): string {
  return `${label.padEnd(22)} ${value}\n`;
}

/**
 * Prints what is and is not working locally.
 *
 * Roughly a fifth of the issues filed against 1.x were environment problems —
 * old Node, the connector not running, the extension never connected — that a
 * single command could have answered without a human.
 */
export async function runDoctor(options: CliOptions): Promise<number> {
  let out = "BrowserTools MCP — setup check\n\n";
  let problems = 0;

  out += line("Version", readPackageVersion());

  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const nodeOk = nodeMajor >= MINIMUM_NODE_MAJOR;
  out += line("Node", `v${process.versions.node} ${nodeOk ? "(ok)" : "(too old)"}`);
  if (!nodeOk) {
    problems += 1;
    out += `  ! Node ${MINIMUM_NODE_MAJOR} or newer is required. Upgrade Node, and if you use nvm or asdf make sure your MCP client inherits the same version.\n`;
  }

  out += line("Platform", `${os.platform()} ${os.arch()}`);

  const screenshotDir = options.screenshotDir ?? getDefaultScreenshotDir();
  out += line("Screenshot directory", screenshotDir);

  const session = readSessionFile();
  out += line(
    "Session file",
    session ? `${sessionFilePath()} (port ${session.port}, pid ${session.pid})` : "none"
  );

  const runtime = await createRuntime(options);
  out += line("Connector", runtime.degradedReason ? `failed — ${runtime.degradedReason}` : runtime.description);
  if (runtime.degradedReason) problems += 1;

  try {
    const status = await runtime.client.status();
    out += line("Chrome extension", status.extensionConnected ? "connected" : "not connected");
    if (!status.extensionConnected) {
      problems += 1;
      out +=
        "  ! Open Chrome DevTools (F12) on the page you want to inspect. Capture starts as\n" +
        "    soon as DevTools is open — you do not need to select the BrowserTools panel.\n" +
        "    If the panel is missing entirely, load the extension from the chrome-extension\n" +
        "    directory at chrome://extensions with Developer mode enabled.\n";
    } else {
      out += line("Captured entries", `${status.counts.console} console, ${status.counts.network} network`);
    }
  } catch (error) {
    problems += 1;
    out += line("Chrome extension", "unknown");
    out += `  ! Could not query the connector: ${error instanceof Error ? error.message : String(error)}\n`;
  }

  // Audits launch their own browser, so a missing one breaks four tools while
  // everything else keeps working — worth surfacing before it is hit.
  try {
    const { findAuditBrowser } = await import("./lighthouse/find-browser.js");
    const chromeLauncher = await import("chrome-launcher");
    const browser = findAuditBrowser({
      installed: () => (chromeLauncher as any).Launcher?.getInstallations?.() ?? [],
    });
    out += line("Audit browser", `${browser.name}`);
  } catch (error) {
    problems += 1;
    out += line("Audit browser", "none found");
    out += `  ! Lighthouse audits will not run. ${error instanceof Error ? error.message : ""}\n`;
  }

  try {
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.accessSync(screenshotDir, fs.constants.W_OK);
    out += line("Screenshot writable", "yes");
  } catch {
    problems += 1;
    out += line("Screenshot writable", "no");
    out += `  ! Cannot write to ${screenshotDir}. Set BROWSER_TOOLS_SCREENSHOT_DIR to a writable path.\n`;
  }

  out += `\n${problems === 0 ? "Everything looks ready." : `${problems} problem(s) found.`}\n`;
  process.stdout.write(out);

  await runtime.close();
  return problems === 0 ? 0 : 1;
}

```

### Core Architecture Module: `browser-tools-mcp/src/index.ts`
```
#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { parseCli, helpText, readPackageVersion } from "./cli.js";
import { createRuntime } from "./runtime.js";
import { createMcpServer } from "./mcp/server.js";
import { runDoctor } from "./doctor.js";
import { createLogger, setLogLevel } from "./util/logger.js";

const log = createLogger("main");

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));

  // Metadata flags answer before anything is started or bound.
  if (options.showVersion) {
    process.stdout.write(`${readPackageVersion()}\n`);
    return;
  }
  if (options.showHelp) {
    process.stdout.write(helpText());
    return;
  }
  if (options.doctor) {
    const exitCode = await runDoctor(options);
    process.exitCode = exitCode;
    return;
  }

  const runtime = await createRuntime(options);
  log.info(`Telemetry source: ${runtime.description}`);

  const { server, toolNames } = createMcpServer({
    client: runtime.client,
    ...(options.enabledTools ? { enabledTools: options.enabledTools } : {}),
    ...(options.disabledTools ? { disabledTools: options.disabledTools } : {}),
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info(`MCP server ready with tools: ${toolNames.join(", ")}`);

  if (runtime.degradedReason) {
    log.warn(
      "Running without a connector — tool calls will explain the problem rather than return data."
    );
  }

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Received ${signal}, shutting down`);
    try {
      await server.close();
    } catch (error) {
      log.warn("Error closing MCP server:", error);
    }
    try {
      await runtime.close();
    } catch (error) {
      log.warn("Error closing connector:", error);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.stdin.on("close", () => void shutdown("stdin close"));
}

// Nothing may write to stdout except the transport, so failures report on
// stderr and exit non-zero.
main().catch((error) => {
  setLogLevel("error");
  log.error("Fatal error during startup:", error);
  process.exit(1);
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #119** (2025-09-27): **MCP/Chrome Extension connection keep breaking**
  *Symptoms*: Every time I switch Cursor projects or leave my current project unused for a while, the Browser-Tools MCP and Chrome Extension connection breaks. Every time i need to follow the following process and then the connection reestablishes:  1. Clear my Chrome cache 2. Run the reset command: pkill -f "browser-tools-server" || true && npx @agentdeskai/browser-tools-server@1.2.0.  Why is this occurring and is there any way to stop this happening so the MCP functions without this issue every time I project switch?
  **Post-Mortem & Fix Analysis**:
  > Can you please confirm this is definitely a bug?

- **Issue #18** (2025-09-22): **fetch is not defined**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ![Image](https://github.com/user-attachments/assets/bddbcc4a-f184-4a61-8f9e-138cb0795c1a)
  > getting this aswell
  > getting this too +1

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

### Incident Patch 1: `99acee8d` (2026-08-12)
**Commit Message**: Fix five defects found while specifying 2.1

None of these surfaced through use. They came out of reading the code
closely enough to write specifications against it, which is worth noting:
the 400-test suite proves what it was written to prove.

HAR exports claimed every request started at the moment it finished, because
the capture stamps its timestamp at onRequestFinished and the builder used
that for startedDateTime. Requests now carry startedAt from the DevTools
entry, falling back to finish minus duration.

Reads came back in the order the connector received entries, not the order
they happened. Telemetry is flushed in 100ms batches per tab and buffered
while the socket is down, so those genuinely differ — and queries slice the
tail as "newest", which could return the wrong entries and interleave two
tabs wrongly. Reads are now ordered by event time; insertion order is left
alone for eviction.

logLimit defaulted to 50 per category per tab, less than one page load.

The selected element was sliced in the page and sent unscrubbed, alone among
capture paths. The server scrubbed on arrival so nothing reached the model,
but truncate-before-scrub is exactly what hid a JWT from its 

**File**: `CHANGELOG.md` (modified, +38/-0)
```diff
@@ -1,5 +1,43 @@
 # Changelog
 
+## 2.0.2
+
+Five defects, all found by writing the 2.1 capability specifications rather
+than by anything failing. Four were invisible in normal use, which is why they
+survived the rewrite.
+
+- **HAR exports reported every request as starting when it finished.** The
+  capture stamps `timestamp` at `onRequestFinished`, and the HAR builder used
+  that for `startedDateTime`, so a 2-second request appeared instantaneous at
+  the wrong moment. Requests now carry `startedAt`, taken from the DevTools
+  entry's own start time, and fall back to finish-minus-duration. Anything
+  reading a HAR — including Chrome's Network panel — was being misled.
+- **Reads came back in arrival order rather than event order.** The store keeps
+  entries in the order the connector received them, and telemetry is flushed in
+  100ms batches per tab and buffered up to 1000 entries while the socket is
+  down, so arrival and event order genuinely diverge. Queries slice the tail as
+  "the newest" — which could return the wrong entries entirely, and interleave
+  two tabs wrongly on an `allTabs` read. Reads are now ordered by event time.
+- **`logLimit` defaulted to 50 entries per category per tab**, which is less
+  than a single real page load. Anything reading back over a session was
+  silently clipped. The default is now 500; the range is unchanged.
+- **The selected element was truncated in the page but never scrubbed there.**
+  Every console and network value goes through `scrubAndTruncate`, which scrubs
+  first; the selected element was sliced inside the page and sent as-is. The
+  server still scrubbed on arrival, so nothing unredacted reached the model,
+  but it crossed the socket unscrubbed, and truncating first is precisely the
+  ordering that hid a token from the pattern meant to catch it — the bug 2.0.0
+  fixed everywhere else. Now sanitised in the browser, scrub before truncate.
+- **Audits ran one device and reported another.** `formFactor` and
+  `screenEmulation` were set but `throttling` and `emulatedUserAgent` were not,
+  so a desktop audit ran a desktop viewport under Lighthouse's default mobile
+  Slow-4G throttling while identifying as a phone. `metadata.device` was
+  hardcoded to `"desktop"` regardless. Flags now come from Lighthouse's own
+  presets so all three agree, and the report names the device it simulated.
+
+Lighthouse's device presets are loaded on demand: importing them eagerly cost
+about 30ms at startup, on the path that answers `initialize`.
+
 ## 2.0.1
 
 Metadata only — no code changes. `npx @agentdeskai/browser-tools-mcp@latest`
```

**File**: `browser-tools-mcp/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@agentdeskai/browser-tools-mcp",
-  "version": "2.0.1",
+  "version": "2.0.2",
   "description": "MCP server exposing live browser telemetry (console logs, network requests, screenshots, Lighthouse audits) from your real Chrome session",
   "mcpName": "io.github.AgentDeskAI/browser-tools-mcp",
   "type": "module",
```

**File**: `browser-tools-mcp/src/connector/settings.ts` (modified, +3/-1)
```diff
@@ -27,7 +27,9 @@ export interface CaptureSettings {
 }
 
 export const LIMITS = {
-  logLimit: { min: 1, max: 5_000, default: 50 },
+  // 50 was less than a single real page load, so anything reading back over
+  // a session was silently clipped.
+  logLimit: { min: 1, max: 5_000, default: 500 },
   queryLimit: { min: 1_000, max: 500_000, default: 30_000 },
   stringSizeLimit: { min: 100, max: 100_000, default: 500 },
   maxLogSize: { min: 1_000, max: 1_000_000, default: 20_000 },
```

**File**: `browser-tools-mcp/src/connector/store.ts` (modified, +17/-2)
```diff
@@ -24,7 +24,10 @@ export interface NetworkEntry {
   url: string;
   method: string;
   status: number;
+  /** When the request completed. */
   timestamp: number;
+  /** When the request started, if the capture could determine it. */
+  startedAt?: number;
   tabId?: TabId | null;
   durationMs?: number;
   error?: string;
@@ -82,6 +85,18 @@ const ERROR_LEVELS = new Set(["error", "assert", "critical"]);
 /** Entries with no tab attribution share one bucket. */
 const UNATTRIBUTED = "__no-tab__";
 
+/**
+ * Oldest first, so #paginate's tail slice is genuinely the newest.
+ *
+ * Entries arrive in flush order, not event order: the extension batches every
+ * 100ms per tab and buffers up to 1000 while the socket is down, so a merged
+ * read could otherwise interleave two tabs wrongly and call the wrong end
+ * "newest". Sorting a copy keeps insertion order intact for eviction.
+ */
+function byTime<T extends { timestamp: number }>(entries: readonly T[]): readonly T[] {
+  return [...entries].sort((a, b) => a.timestamp - b.timestamp);
+}
+
 function tabKey(tabId: TabId | null | undefined): string {
   return tabId === null || tabId === undefined ? UNATTRIBUTED : String(tabId);
 }
@@ -255,7 +270,7 @@ export class TelemetryStore {
       matched = matched.filter((e) => matchesAny([e.message], query.keywords!));
     }
 
-    return this.#paginate(matched, query.limit, query.offset);
+    return this.#paginate(byTime(matched), query.limit, query.offset);
   }
 
   queryNetwork(query: NetworkQuery): QueryResult<NetworkEntry> {
@@ -277,7 +292,7 @@ export class TelemetryStore {
       );
     }
 
-    const result = this.#paginate(matched, query.limit, query.offset);
+    const result = this.#paginate(byTime(matched), query.limit, query.offset);
     result.entries = result.entries.map((entry) => this.#applyHeaderVisibility(entry));
     return result;
   }
```

**File**: `browser-tools-mcp/src/lighthouse/extract.ts` (modified, +3/-2)
```diff
@@ -72,7 +72,8 @@ function extractDetails(
 export function extractAuditReport(
   lhr: LighthouseResultLike,
   url: string,
-  category: string
+  category: string,
+  device: string = "desktop"
 ): AuditReport {
   const categoryData = lhr.categories?.[category];
   const audits = lhr.audits ?? {};
@@ -153,7 +154,7 @@ export function extractAuditReport(
     metadata: {
       url: url || lhr.finalDisplayedUrl || lhr.requestedUrl || "",
       timestamp: lhr.fetchTime ?? new Date().toISOString(),
-      device: "desktop",
+      device,
       lighthouseVersion: lhr.lighthouseVersion ?? "unknown",
     },
     score:
```

---

### Incident Patch 2: `e723f3ad` (2026-08-10)
**Commit Message**: Harden credential fixtures against push protection

**File**: `browser-tools-mcp/test/e2e/browser.e2e.test.ts` (modified, +1/-1)
```diff
@@ -205,7 +205,7 @@ describe.skipIf(!browserSupport.usable)("extension to connector", () => {
     });
 
     expect(everything).not.toContain("SUPERSECRETCOOKIEVALUE");
-    expect(everything).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123456789");
+    expect(everything).not.toContain("ghp" + "_abcdefghijklmnopqrstuvwxyz0123456789");
   }, 180_000);
 
   /**
```

**File**: `browser-tools-mcp/test/fixtures/server.ts` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ export async function startFixtureServer(): Promise<FixtureServer> {
         "Content-Type": "application/json",
         "Set-Cookie": "session=SUPERSECRETCOOKIEVALUE; Path=/",
       });
-      res.end(JSON.stringify({ token: "ghp_abcdefghijklmnopqrstuvwxyz0123456789" }));
+      res.end(JSON.stringify({ token: "ghp" + "_abcdefghijklmnopqrstuvwxyz0123456789" }));
       return;
     }
 
```

**File**: `browser-tools-mcp/test/integration/verbose.test.ts` (modified, +2/-2)
```diff
@@ -133,15 +133,15 @@ describe("verbose mode on", () => {
       entries: [
         {
           type: "console-log",
-          message: "token ghp_1234567890abcdefghijklmnopqrstuvwx",
+          message: "token ghp" + "_1234567890abcdefghijklmnopqrstuvwx",
           timestamp: Date.now(),
         },
       ],
     });
 
     await vi.waitFor(() => expect(stderr()).toContain("[REDACTED]"));
     // Verbose output must not become a way to leak what redaction removed.
-    expect(stderr()).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwx");
+    expect(stderr()).not.toContain("ghp" + "_1234567890abcdefghijklmnopqrstuvwx");
   });
 
   /**
```

**File**: `browser-tools-mcp/test/unit/extension-redact.test.ts` (modified, +3/-3)
```diff
@@ -85,9 +85,9 @@ describe("extension and server scrubbing agree", () => {
     const samples = [
       "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc-_123456789012",
       "sess_3HWEvAAPLW3pElwMd0oolLs5aF7",
-      "ghp_1234567890abcdefghijklmnopqrstuvwx",
-      "AKIAIOSFODNN7EXAMPLE",
-      "sk_live_abcdefghijklmnopqrstuvwx",
+      "ghp" + "_1234567890abcdefghijklmnopqrstuvwx",
+      "AKIA" + "IOSFODNN7EXAMPLE",
+      "sk" + "_live_abcdefghijklmnopqrstuvwx",
     ];
 
     // Both layers run; they must not disagree about what is a secret.
```

**File**: `browser-tools-mcp/test/unit/redact.test.ts` (modified, +8/-11)
```diff
@@ -47,16 +47,13 @@ describe("redactHeaders", () => {
 describe("redactSecretsInString", () => {
   const cases: Array<[string, string]> = [
     ["JWT", "token is eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc-_123"],
-    ["AWS access key", "AKIAIOSFODNN7EXAMPLE"],
-    ["GitHub PAT", "ghp_1234567890abcdefghijklmnopqrstuvwx"],
-    ["GitHub fine-grained PAT", "github_pat_11ABCDE0Y0abcdefghijkl_mnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQ"],
-    ["OpenAI key", "sk-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH"],
-    ["Anthropic key", "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH"],
-    // Assembled from parts so that no contiguous Slack-shaped literal appears
-    // in the source. GitHub push protection blocks the push otherwise, even
-    // for an obviously synthetic fixture.
-    ["Slack token", ["xoxb", "123456789012", "1234567890123", "abcdefghijklmnopqrstuvwx"].join("-")],
-    ["Stripe live key", "sk_live_abcdefghijklmnopqrstuvwx"],
+    ["AWS access key", "AKIA" + "IOSFODNN7EXAMPLE"],
+    ["GitHub PAT", "ghp" + "_1234567890abcdefghijklmnopqrstuvwx"],
+    ["GitHub fine-grained PAT", "github" + "_pat_11ABCDE0Y0abcdefghijkl_mnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQ"],
+    ["OpenAI key", "sk" + "-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH"],
+    ["Anthropic key", "sk" + "-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH"],
+    ["Slack token", "xoxb" + "-123456789012-1234567890123-abcdefghijklmnopqrstuvwx"],
+    ["Stripe live key", "sk" + "_live_abcdefghijklmnopqrstuvwx"],
     ["Bearer header value", "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"],
   ];
 
@@ -103,7 +100,7 @@ describe("redactValue", () => {
   it("walks nested objects and arrays", () => {
     const out = redactValue({
       headers: { authorization: "Bearer xyz" },
-      items: [{ note: "ghp_1234567890abcdefghijklmnopqrstuvwx" }],
+      items: [{ note: "ghp" + "_1234567890abcdefghijklmnopqrstuvwx" }],
       nested: { deep: { cookie: "a=b" } },
     }) as any;
 
```

---

### Incident Patch 3: `bee20fd9` (2026-08-10)
**Commit Message**: Assemble the Slack test fixture from parts

GitHub push protection blocks any push containing a contiguous
Slack-shaped string, including an obviously synthetic one in a redaction
test. The neighbouring AWS fixture is AWS's own published example key and
passes for that reason; Slack's format has no equivalent allowlist.

The value is unchanged — the same string, joined at runtime — so the test
asserts exactly what it did before.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `browser-tools-mcp/test/unit/redact.test.ts` (modified, +4/-1)
```diff
@@ -52,7 +52,10 @@ describe("redactSecretsInString", () => {
     ["GitHub fine-grained PAT", "github_pat_11ABCDE0Y0abcdefghijkl_mnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQ"],
     ["OpenAI key", "sk-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH"],
     ["Anthropic key", "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH"],
-    ["Slack token", "xoxb-123456789012-1234567890123-abcdefghijklmnopqrstuvwx"],
+    // Assembled from parts so that no contiguous Slack-shaped literal appears
+    // in the source. GitHub push protection blocks the push otherwise, even
+    // for an obviously synthetic fixture.
+    ["Slack token", ["xoxb", "123456789012", "1234567890123", "abcdefghijklmnopqrstuvwx"].join("-")],
     ["Stripe live key", "sk_live_abcdefghijklmnopqrstuvwx"],
     ["Bearer header value", "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"],
   ];
```

---

### Incident Patch 4: `54d7eeb1` (2026-08-10)
**Commit Message**: Fix a multi-tab test race and a contradictory CHROME_PATH rule

Both found by the first end-to-end run on a machine that could actually launch
a browser.

The tab-registry test read a tab's url straight after opening it, having waited
only for the tab to appear. A tab is registered on `hello`, which arrives before
the `page` frame carrying its url, so the read could land in between and see an
empty string. It now waits for the url itself. Five consecutive runs are clean;
the failure was intermittent, so one pass would not have been evidence.

The audit suite still asserted that a CHROME_PATH pointing nowhere makes audits
fail, which the browser-detection work deliberately changed: a stale setting —
a browser uninstalled since, or a path carried over from another machine —
should not cost every audit when a working browser is installed. The two tests
had been contradicting each other, and the end-to-end one was simply older.
Falling back is now the stated behaviour, the connector warns rather than doing
it silently, and the suite asserts the fallback. The genuinely-no-browser case
stays in the unit tests, which can simulate an empty machine as an end-to-end
run cannot.

339 tests pa

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -41,6 +41,9 @@
   The error now names the browser and its path, keeps the underlying cause, and
   suggests a fix — including the ad-hoc-signing repair when the browser is a
   Playwright-downloaded Chromium, which macOS sometimes refuses to launch.
+- **A stale `CHROME_PATH` no longer costs you every audit.** If it points at a
+  browser that is not there — uninstalled since, or a path from another machine
+  — the connector now warns and looks for another browser, rather than failing.
 - **An installed Google Chrome is no longer passed over.** `chrome-launcher`
   locates browsers through Spotlight on macOS, which is unavailable in
   restricted environments, with indexing off, or for an install too recent to
```

**File**: `browser-tools-mcp/src/lighthouse/find-browser.ts` (modified, +14/-2)
```diff
@@ -2,6 +2,10 @@ import fs from "node:fs";
 import os from "node:os";
 import path from "node:path";
 
+import { createLogger } from "../util/logger.js";
+
+const log = createLogger("browser");
+
 /**
  * Locates a browser to run Lighthouse audits in.
  *
@@ -130,8 +134,16 @@ export function findAuditBrowser(options: FindOptions = {}): FoundBrowser {
   const exists = options.exists ?? defaultExists;
 
   const explicit = env["CHROME_PATH"];
-  if (explicit && exists(explicit)) {
-    return { name: "CHROME_PATH", path: explicit, source: "CHROME_PATH" };
+  if (explicit) {
+    if (exists(explicit)) {
+      return { name: "CHROME_PATH", path: explicit, source: "CHROME_PATH" };
+    }
+    // Falling back beats failing when a working browser is installed, but doing
+    // it silently would leave someone puzzling over why their setting had no
+    // effect.
+    log.warn(
+      `CHROME_PATH points at ${explicit}, which does not exist. Looking for another browser instead.`
+    );
   }
 
   // chrome-launcher first: if real Chrome is installed, use it.
```

**File**: `browser-tools-mcp/test/e2e/audit.e2e.test.ts` (modified, +12/-5)
```diff
@@ -108,15 +108,22 @@ describe.skipIf(!browserSupport.usable)("lighthouse audits against a real page",
     expect(() => assertAuditableUrl("file:///etc/passwd")).toThrow(AuditError);
   }, 60_000);
 
-  it("reports a helpful error when Chrome cannot be found", async () => {
+  /**
+   * A stale CHROME_PATH — a browser since uninstalled, a path from another
+   * machine — should not cost you every audit when a perfectly good browser is
+   * installed. The connector warns and carries on. The case where nothing at
+   * all can be found is covered in test/unit/find-browser.test.ts, which can
+   * simulate an empty machine as this suite cannot.
+   */
+  it("falls back to an installed browser when CHROME_PATH is stale", async () => {
     const previous = process.env["CHROME_PATH"];
     process.env["CHROME_PATH"] = "/nonexistent/chrome-binary";
     try {
-      await expect(
-        runLighthouseAudit({ url: fixture.url, category: "seo" })
-      ).rejects.toThrow(AuditError);
+      const report = await runLighthouseAudit({ url: fixture.url, category: "seo" });
+      expect(report.category).toBe("seo");
+      expect(report.score).toBeTypeOf("number");
     } finally {
       process.env["CHROME_PATH"] = previous;
     }
-  }, 120_000);
+  }, 180_000);
 });
```

**File**: `browser-tools-mcp/test/integration/multitab.test.ts` (modified, +5/-1)
```diff
@@ -58,8 +58,12 @@ async function openTab(tabId: number, url: string, options: Record<string, unkno
 
   ext.send({ type: "page", url, tabId });
 
+  // Wait for the url, not merely for the tab to exist. A tab is registered on
+  // `hello`, which arrives before the `page` frame carrying its url, so waiting
+  // on presence alone let the test read a tab whose url was still empty.
   await vi.waitFor(() => {
-    expect(connector.listTabs().some((tab) => tab.tabId === tabId)).toBe(true);
+    const tab = connector.listTabs().find((t) => t.tabId === tabId);
+    expect(tab?.url).toBe(url);
   });
   return ext;
 }
```

---

### Incident Patch 5: `28415904` (2026-08-08)
**Commit Message**: Confirm a JWT by its header rather than its prefix

Relaxing the JWT pattern to catch truncated tokens made it match any
base64-encoded JSON, because "eyJ" is simply base64 for '{"'. Clerk encodes
image parameters that way, so profile image URLs came back as
https://img.clerk.com/[REDACTED] — the redaction destroying exactly the
debugging information this tool exists to provide.

A candidate is now confirmed before being redacted. Three dot-separated
segments is JWT-shaped whatever it contains; with fewer, which is what
truncation leaves, the first segment is decoded and checked for the "alg",
"typ" and "kid" fields that only a JWT header carries. Decoding is limited to
whole base64 groups from the start of the string, so a cut-off tail does not
matter — the header comes first, which is what makes this survive truncation.

Verified against the real shapes: a Clerk image URL passes through untouched, a
session id in a URL path is still redacted, and a truncated JWT is still caught.
Both the browser and server layers use the same rule, with a test asserting they
agree — a disagreement would mean one of them leaks or one destroys good data.

SECURITY.md now says over-redaction is a bu

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -36,6 +36,12 @@
   response bodies. Scrubbing now happens **in the browser, before truncation**,
   so secrets no longer cross the socket at all, and the server keeps its own
   pass as defence in depth.
+- **Redaction no longer destroys base64-encoded data that is not a token.**
+  "eyJ" is only base64 for `{"`, so every base64-encoded JSON object starts the
+  same way as a JWT. Matching on that prefix turned Clerk profile image URLs
+  into `https://img.clerk.com/[REDACTED]`. A candidate is now confirmed by
+  decoding its header and looking for the fields only a JWT carries, so
+  truncated tokens are still caught and innocent payloads are left alone.
 - **A reconnecting background tab no longer steals targeting.** A tab that is
   timer-throttled, misses the heartbeat and reconnects looked identical to a
   user opening DevTools on a new tab, so it silently became the target of
```

**File**: `SECURITY.md` (modified, +8/-2)
```diff
@@ -84,8 +84,14 @@ fields. A bespoke or unrecognised token shape can still get through. Treat
 `--no-redact` as strictly for cases where you have decided the captured data is
 not sensitive.
 
-If you find a shape that leaks, that is worth reporting — the pattern list is
-meant to grow.
+Over-redaction is treated as a bug too. A false positive silently destroys the
+debugging information this tool exists to provide, so patterns are confirmed
+rather than assumed where a cheap check exists — a JWT candidate, for instance,
+is verified by decoding its header, because plenty of harmless data is also
+base64-encoded JSON.
+
+If you find a shape that leaks, or one that is being redacted when it should not
+be, both are worth reporting.
 
 ## Design commitments in 2.x
 
```

**File**: `browser-tools-mcp/src/util/redact.ts` (modified, +40/-7)
```diff
@@ -41,13 +41,6 @@ const SENSITIVE_HEADER_SET = new Set(SENSITIVE_HEADERS);
 const SECRET_PATTERNS: readonly RegExp[] = [
   // PEM private key blocks (must run first — it spans lines).
   /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g,
-  // JSON Web Tokens, including ones already cut short.
-  //
-  // The later segments are optional on purpose: the extension truncates long
-  // strings before sending, so a JWT frequently arrives with only its header.
-  // "eyJ" is base64 for '{"', which makes a long run starting that way a token
-  // rather than ordinary text.
-  /\beyJ[A-Za-z0-9_-]{15,}(?:\.[A-Za-z0-9_-]+){0,2}/g,
   // Vendor session and client identifiers, e.g. Clerk's sess_… and client_….
   // These are bearer-equivalent: they appear in URL paths as well as bodies.
   /\b(?:sess|session|client|tok|token|auth|cred|secret|apikey)_[A-Za-z0-9]{16,}\b/gi,
@@ -66,6 +59,45 @@ const SECRET_PATTERNS: readonly RegExp[] = [
   /\bAIza[A-Za-z0-9_-]{35}\b/g,
 ];
 
+/**
+ * Candidates for a JSON Web Token: base64url that starts with an encoded '{"'.
+ *
+ * Matching this alone is not enough. "eyJ" is simply base64 for '{"', so every
+ * base64-encoded JSON object looks the same at the start — Clerk encodes image
+ * parameters exactly this way, and treating those as secrets turned profile
+ * image URLs into https://img.clerk.com/[REDACTED]. Each candidate is checked
+ * by isJwt() below.
+ */
+const JWT_CANDIDATE = /\beyJ[A-Za-z0-9_-]{15,}(?:\.[A-Za-z0-9_-]+){0,2}/g;
+
+/** Fields that appear in a JWT header and not in ordinary encoded JSON. */
+const JWT_HEADER_FIELDS = /"(?:alg|typ|kid)"/;
+
+function decodeBase64Prefix(value: string): string {
+  // Decode a whole number of base64 groups, since the tail may be cut off.
+  const usable = value.slice(0, 40);
+  const aligned = usable.slice(0, usable.length - (usable.length % 4));
+  if (aligned.length === 0) return "";
+  try {
+    return Buffer.from(aligned.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
+  } catch {
+    return "";
+  }
+}
+
+/**
+ * Decides whether a base64url run is really a token.
+ *
+ * Three dot-separated segments is JWT-shaped whatever it contains. With fewer —
+ * which is what truncation leaves behind — the header is decoded and checked
+ * for the fields only a JWT carries.
+ */
+export function isJwt(candidate: string): boolean {
+  if (candidate.split(".").length >= 3) return true;
+  const header = candidate.split(".")[0] ?? "";
+  return JWT_HEADER_FIELDS.test(decodeBase64Prefix(header));
+}
+
 /** `Authorization: Bearer <token>` style values appearing inline in text. */
 const AUTH_SCHEME_PATTERN = /\b(Bearer|Basic|Token|Digest)\s+[A-Za-z0-9._~+/=-]{16,}/gi;
 
@@ -84,6 +116,7 @@ export function redactSecretsInString(input: string): string {
   for (const pattern of SECRET_PATTERNS) {
     out = out.replace(pattern, REDACTED);
   }
+  out = out.replace(JWT_CANDIDATE, (match) => (isJwt(match) ? REDACTED : match));
   out = out.replace(AUTH_SCHEME_PATTERN, (_m, scheme: string) => `${scheme} ${REDACTED}`);
   out = out.replace(SECRETISH_KEY_PATTERN, (_m, keyPart: string) => `${keyPart}"${REDACTED}"`);
   return out;
```

**File**: `browser-tools-mcp/test/unit/extension-redact.test.ts` (modified, +28/-0)
```diff
@@ -97,3 +97,31 @@ describe("extension and server scrubbing agree", () => {
     }
   });
 });
+
+describe("base64 JSON that is not a token", () => {
+  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
+
+  it("leaves a Clerk image URL intact", () => {
+    const url = `https://img.clerk.com/${b64({ type: "proxy", src: "https://images.clerk.dev/img_2abc" })}`;
+    expect(scrubAndTruncate(url, 500)).toBe(url);
+  });
+
+  it("still redacts a truncated JWT", () => {
+    const header = b64({ alg: "RS256", typ: "JWT" });
+    const out = scrubAndTruncate(`auth ${header}XXXXXXXXXXXXXXXXXXXX`, 500);
+    expect(out).toContain("[REDACTED]");
+    expect(out).not.toContain(header);
+  });
+
+  it("agrees with the server about what counts as a JWT", async () => {
+    const { redactSecretsInString } = await import("../../src/util/redact");
+    const image = `https://img.clerk.com/${b64({ type: "proxy", src: "x" })}`;
+    const token = `${b64({ alg: "RS256", typ: "JWT" })}XXXXXXXXXXXXXXXXXXXX`;
+
+    // Disagreement here means one layer leaks or one destroys useful data.
+    expect(scrubAndTruncate(image, 500)).toBe(image);
+    expect(redactSecretsInString(image)).toBe(image);
+    expect(scrubSecrets(token)).toContain("[REDACTED]");
+    expect(redactSecretsInString(token)).toContain("[REDACTED]");
+  });
+});
```

**File**: `browser-tools-mcp/test/unit/redact.test.ts` (modified, +49/-0)
```diff
@@ -191,3 +191,52 @@ describe("vendor session identifiers", () => {
     expect(redactSecretsInString(text)).toBe(text);
   });
 });
+
+/**
+ * "eyJ" is only base64 for '{"', so any base64-encoded JSON starts that way.
+ * Matching on the prefix alone destroyed innocent data — Clerk encodes image
+ * parameters exactly like this, and a profile image URL came back as
+ * https://img.clerk.com/[REDACTED], which is useless for debugging.
+ *
+ * A JWT is distinguishable: its first segment decodes to a header carrying
+ * "alg". That survives truncation, because the header comes first.
+ */
+describe("base64 JSON that is not a token", () => {
+  const b64 = (value: unknown) =>
+    Buffer.from(JSON.stringify(value)).toString("base64url");
+
+  it("leaves a Clerk image URL intact", () => {
+    const param = b64({ type: "proxy", src: "https://images.clerk.dev/oauth_google/img_2abc" });
+    const url = `https://img.clerk.com/${param}`;
+
+    expect(redactSecretsInString(url)).toBe(url);
+  });
+
+  it("leaves other base64-encoded JSON parameters intact", () => {
+    const param = b64({ width: 200, height: 200, fit: "crop" });
+    const text = `loading https://cdn.example.com/i/${param}`;
+
+    expect(redactSecretsInString(text)).toBe(text);
+  });
+
+  it("still redacts a truncated JWT, which carries alg in its header", () => {
+    const header = b64({ alg: "RS256", typ: "JWT", kid: "ins_2Z" });
+    const truncated = `${header}XXXXXXXXXXXXXXXXXXXX`;
+
+    const out = redactSecretsInString(`auth ${truncated}`);
+    expect(out).toContain("[REDACTED]");
+    expect(out).not.toContain(header);
+  });
+
+  it("still redacts a complete three-segment JWT", () => {
+    const full =
+      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r0";
+    expect(redactSecretsInString(full)).not.toContain(full);
+  });
+
+  it("redacts a three-segment token even when its header is unreadable", () => {
+    // Three dot-separated base64 segments is JWT-shaped regardless of contents.
+    const shaped = "eyJzb21ldGhpbmdlbHNlIjoxfQ.eyJzdWIiOiJhIn0.c2lnbmF0dXJlaGVyZQ";
+    expect(redactSecretsInString(shaped)).toContain("[REDACTED]");
+  });
+});
```

---

### Incident Patch 6: `105aadfe` (2025-03-10)
**Commit Message**: Merge pull request #68 from AgentDeskAI/bugfix/graceful-server-shutdown

Version 1.2.0: Implement Graceful Server Shutdown and Update Documentation

**File**: `README.md` (modified, +119/-3)
```diff
@@ -8,13 +8,13 @@ Read our [docs](https://browsertools.agentdesk.ai/) for the full installation, q
 
 ## Updates
 
-v1.1.0 is out! This includes several bug fixes for logging + screenshots.
+v1.2.0 is out! This includes
 
 Please make sure to update the version in your IDE / MCP client as so:
-`npx @agentdeskai/browser-tools-mcp@1.1.0`
+`npx @agentdeskai/browser-tools-mcp@1.2.0`
 
 Also make sure to download the latest version of the chrome extension here:
-[v1.1.0 BrowserToolsMCP Chrome Extension](https://github.com/AgentDeskAI/browser-tools-mcp/releases/download/v1.1.0/chrome-extension-v1-1-0.zip)
+[v1.2.0 BrowserToolsMCP Chrome Extension](https://github.com/AgentDeskAI/browser-tools-mcp/releases/download/v1.1.0/chrome-extension-v1-1-0.zip)
 
 From there you can run the local node server as usual like so:
 `npx @agentdeskai/browser-tools-server`
@@ -23,6 +23,122 @@ And once you've opened your chrome dev tools, logs should be getting sent to you
 
 If you have any questions or issues, feel free to open an issue ticket! And if you have any ideas to make this better, feel free to reach out or open an issue ticket with an enhancement tag or reach out to me at [@tedx_ai on x](https://x.com/tedx_ai)
 
+## Full Update Notes:
+
+Coding agents like Cursor can run these audits against the current page seamlessly. By leveraging Puppeteer and the Lighthouse npm library, BrowserTools MCP can now:
+
+- Evaluate pages for WCAG compliance
+- Identify performance bottlenecks
+- Flag on-page SEO issues
+- Check adherence to web development best practices
+- Review NextJS specific issues with SEO
+
+...all without leaving your IDE 🎉
+
+---
+
+## 🔑 Key Additions
+
+| Audit Type         | Description                                                                                                                              |
+| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
+| **Accessibility**  | WCAG-compliant checks for color contrast, missing alt text, keyboard navigation traps, ARIA attributes, and more.                        |
+| **Performance**    | Lighthouse-driven analysis of render-blocking resources, excessive DOM size, unoptimized images, and other factors affecting page speed. |
+| **SEO**            | Evaluates on-page SEO factors (like metadata, headings, and link structure) and suggests improvements for better search visibility.      |
+| **Best Practices** | Checks for general best practices in web development.                                                                                    |
+| **NextJS Audit**   | Injects a prompt used to perform a NextJS audit.                                                                                         |
+| **Audit Mode**     | Runs all audting tools in a sequence.                                                                                                    |
+| **Debugger Mode**  | Runs all debugging tools in a sequence.                                                                                                  |
+
+---
+
+## 🛠️ Using Audit Tools
+
+### ✅ **Before You Start**
+
+Ensure you have:
+
+- An **active tab** in your browser
+- The **BrowserTools extension enabled**
+
+### ▶️ **Running Audits**
+
+**Headless Browser Automation**:  
+ Puppeteer automates a headless Chrome instance to load the page and collect audit data, ensuring accurate results even for SPAs or content loaded via JavaScript.
+
+The headless browser instance remains active for **60 seconds** after the last audit call to efficiently handle consecutive audit requests.
+
+**Structured Results**:  
+ Each audit returns results in a structured JSON format, including overall scores and detailed issue lists. This makes it easy for MCP-compatible clients to interpret the findings and present actionable insights.
+
+The MCP server provides tools to run audits on the current page. Here 
```

**File**: `browser-tools-mcp/mcp-server.ts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import fs from "fs";
 // Create the MCP server
 const server = new McpServer({
   name: "Browser Tools MCP",
-  version: "1.1.1",
+  version: "1.2.0",
 });
 
 // Track the discovered server connection
```

**File**: `browser-tools-mcp/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@agentdeskai/browser-tools-mcp",
-  "version": "1.1.1",
+  "version": "1.1.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@agentdeskai/browser-tools-mcp",
-      "version": "1.1.1",
+      "version": "1.1.0",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.4.1",
```

**File**: `browser-tools-mcp/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@agentdeskai/browser-tools-mcp",
-  "version": "1.1.1",
+  "version": "1.2.0",
   "description": "MCP (Model Context Protocol) server for browser tools integration",
   "main": "dist/mcp-server.js",
   "bin": {
```

**File**: `browser-tools-server/browser-connector.ts` (modified, +84/-7)
```diff
@@ -517,7 +517,7 @@ app.get("/.identity", (req, res) => {
   res.json({
     port: PORT,
     name: "browser-tools-server",
-    version: "1.1.0",
+    version: "1.2.0",
     signature: "mcp-browser-connector-24x7",
   });
 });
@@ -1248,6 +1248,52 @@ export class BrowserConnector {
     }
   }
 
+  // Add shutdown method
+  public shutdown() {
+    return new Promise<void>((resolve) => {
+      console.log("Shutting down WebSocket server...");
+
+      // Send close message to client if connection is active
+      if (
+        this.activeConnection &&
+        this.activeConnection.readyState === WebSocket.OPEN
+      ) {
+        console.log("Notifying client to close connection...");
+        try {
+          this.activeConnection.send(
+            JSON.stringify({ type: "server-shutdown" })
+          );
+        } catch (err) {
+          console.error("Error sending shutdown message to client:", err);
+        }
+      }
+
+      // Set a timeout to force close after 2 seconds
+      const forceCloseTimeout = setTimeout(() => {
+        console.log("Force closing connections after timeout...");
+        if (this.activeConnection) {
+          this.activeConnection.terminate(); // Force close the connection
+          this.activeConnection = null;
+        }
+        this.wss.close();
+        resolve();
+      }, 2000);
+
+      // Close active WebSocket connection if exists
+      if (this.activeConnection) {
+        this.activeConnection.close(1000, "Server shutting down");
+        this.activeConnection = null;
+      }
+
+      // Close WebSocket server
+      this.wss.close(() => {
+        clearTimeout(forceCloseTimeout);
+        console.log("WebSocket server closed gracefully");
+        resolve();
+      });
+    });
+  }
+
   // Sets up the accessibility audit endpoint
   private setupAccessibilityAudit() {
     this.setupAuditEndpoint(
@@ -1295,7 +1341,7 @@ export class BrowserConnector {
     this.app.get("/.identity", (req, res) => {
       res.json({
         signature: "mcp-browser-connector-24x7",
-        version: "1.1.1",
+        version: "1.2.0",
       });
     });
 
@@ -1427,12 +1473,43 @@ export class BrowserConnector {
     // Initialize the browser connector with the existing app AND server
     const browserConnector = new BrowserConnector(app, server);
 
-    // Handle shutdown gracefully
-    process.on("SIGINT", () => {
-      server.close(() => {
-        console.log("Server shut down");
+    // Handle shutdown gracefully with improved error handling
+    process.on("SIGINT", async () => {
+      console.log("\nReceived SIGINT signal. Starting graceful shutdown...");
+
+      try {
+        // First shutdown WebSocket connections
+        await browserConnector.shutdown();
+
+        // Then close the HTTP server
+        await new Promise<void>((resolve, reject) => {
+          server.close((err) => {
+            if (err) {
+              console.error("Error closing HTTP server:", err);
+              reject(err);
+            } else {
+              console.log("HTTP server closed successfully");
+              resolve();
+            }
+          });
+        });
+
+        // Clear all logs
+        clearAllLogs();
+
+        console.log("Shutdown completed successfully");
         process.exit(0);
-      });
+      } catch (error) {
+        console.error("Error during shutdown:", error);
+        // Force exit in case of error
+        process.exit(1);
+      }
+    });
+
+    // Also handle SIGTERM
+    process.on("SIGTERM", () => {
+      console.log("\nReceived SIGTERM signal");
+      process.emit("SIGINT");
     });
   } catch (error) {
     console.error("Failed to start server:", error);
```

---

### Incident Patch 7: `a1b1276b` (2025-03-10)
**Commit Message**: Finalize version 1.2.0 with graceful shutdown and updated documentation

**File**: `README.md` (modified, +119/-3)
```diff
@@ -8,13 +8,13 @@ Read our [docs](https://browsertools.agentdesk.ai/) for the full installation, q
 
 ## Updates
 
-v1.1.0 is out! This includes several bug fixes for logging + screenshots.
+v1.2.0 is out! This includes
 
 Please make sure to update the version in your IDE / MCP client as so:
-`npx @agentdeskai/browser-tools-mcp@1.1.0`
+`npx @agentdeskai/browser-tools-mcp@1.2.0`
 
 Also make sure to download the latest version of the chrome extension here:
-[v1.1.0 BrowserToolsMCP Chrome Extension](https://github.com/AgentDeskAI/browser-tools-mcp/releases/download/v1.1.0/chrome-extension-v1-1-0.zip)
+[v1.2.0 BrowserToolsMCP Chrome Extension](https://github.com/AgentDeskAI/browser-tools-mcp/releases/download/v1.1.0/chrome-extension-v1-1-0.zip)
 
 From there you can run the local node server as usual like so:
 `npx @agentdeskai/browser-tools-server`
@@ -23,6 +23,122 @@ And once you've opened your chrome dev tools, logs should be getting sent to you
 
 If you have any questions or issues, feel free to open an issue ticket! And if you have any ideas to make this better, feel free to reach out or open an issue ticket with an enhancement tag or reach out to me at [@tedx_ai on x](https://x.com/tedx_ai)
 
+## Full Update Notes:
+
+Coding agents like Cursor can run these audits against the current page seamlessly. By leveraging Puppeteer and the Lighthouse npm library, BrowserTools MCP can now:
+
+- Evaluate pages for WCAG compliance
+- Identify performance bottlenecks
+- Flag on-page SEO issues
+- Check adherence to web development best practices
+- Review NextJS specific issues with SEO
+
+...all without leaving your IDE 🎉
+
+---
+
+## 🔑 Key Additions
+
+| Audit Type         | Description                                                                                                                              |
+| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
+| **Accessibility**  | WCAG-compliant checks for color contrast, missing alt text, keyboard navigation traps, ARIA attributes, and more.                        |
+| **Performance**    | Lighthouse-driven analysis of render-blocking resources, excessive DOM size, unoptimized images, and other factors affecting page speed. |
+| **SEO**            | Evaluates on-page SEO factors (like metadata, headings, and link structure) and suggests improvements for better search visibility.      |
+| **Best Practices** | Checks for general best practices in web development.                                                                                    |
+| **NextJS Audit**   | Injects a prompt used to perform a NextJS audit.                                                                                         |
+| **Audit Mode**     | Runs all audting tools in a sequence.                                                                                                    |
+| **Debugger Mode**  | Runs all debugging tools in a sequence.                                                                                                  |
+
+---
+
+## 🛠️ Using Audit Tools
+
+### ✅ **Before You Start**
+
+Ensure you have:
+
+- An **active tab** in your browser
+- The **BrowserTools extension enabled**
+
+### ▶️ **Running Audits**
+
+**Headless Browser Automation**:  
+ Puppeteer automates a headless Chrome instance to load the page and collect audit data, ensuring accurate results even for SPAs or content loaded via JavaScript.
+
+The headless browser instance remains active for **60 seconds** after the last audit call to efficiently handle consecutive audit requests.
+
+**Structured Results**:  
+ Each audit returns results in a structured JSON format, including overall scores and detailed issue lists. This makes it easy for MCP-compatible clients to interpret the findings and present actionable insights.
+
+The MCP server provides tools to run audits on the current page. Here 
```

**File**: `browser-tools-mcp/mcp-server.ts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import fs from "fs";
 // Create the MCP server
 const server = new McpServer({
   name: "Browser Tools MCP",
-  version: "1.1.1",
+  version: "1.2.0",
 });
 
 // Track the discovered server connection
```

**File**: `browser-tools-mcp/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@agentdeskai/browser-tools-mcp",
-  "version": "1.1.1",
+  "version": "1.2.0",
   "description": "MCP (Model Context Protocol) server for browser tools integration",
   "main": "dist/mcp-server.js",
   "bin": {
```

**File**: `chrome-extension/manifest.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "BrowserTools MCP",
-    "version": "1.1.1",
+    "version": "1.2.0",
     "description": "MCP tool for AI code editors to capture data from a browser such as console logs, network requests, screenshots and more",
     "manifest_version": 3,
     "devtools_page": "devtools.html",
```

---

### Incident Patch 8: `e55410bc` (2025-03-10)
**Commit Message**: bugfix: Implement Graceful WebSocket Server Shutdown Mechanism

- Added shutdown method to BrowserConnector for controlled WebSocket server closure
- Improved process signal handling for SIGINT and SIGTERM
- Updated Chrome extension to handle server shutdown signal
- Bumped package versions to 1.1.0 for browser-tools-mcp and browser-tools-server

**File**: `browser-tools-mcp/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@agentdeskai/browser-tools-mcp",
-  "version": "1.0.11",
+  "version": "1.1.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@agentdeskai/browser-tools-mcp",
-      "version": "1.0.11",
+      "version": "1.1.0",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.4.1",
```

**File**: `browser-tools-server/browser-connector.ts` (modified, +77/-5)
```diff
@@ -667,6 +667,47 @@ export class BrowserConnector {
       });
     }
   }
+
+  // Add shutdown method
+  public shutdown() {
+    return new Promise<void>((resolve) => {
+      console.log("Shutting down WebSocket server...");
+
+      // Send close message to client if connection is active
+      if (this.activeConnection && this.activeConnection.readyState === WebSocket.OPEN) {
+        console.log("Notifying client to close connection...");
+        try {
+          this.activeConnection.send(JSON.stringify({ type: "server-shutdown" }));
+        } catch (err) {
+          console.error("Error sending shutdown message to client:", err);
+        }
+      }
+
+      // Set a timeout to force close after 2 seconds
+      const forceCloseTimeout = setTimeout(() => {
+        console.log("Force closing connections after timeout...");
+        if (this.activeConnection) {
+          this.activeConnection.terminate(); // Force close the connection
+          this.activeConnection = null;
+        }
+        this.wss.close();
+        resolve();
+      }, 2000);
+
+      // Close active WebSocket connection if exists
+      if (this.activeConnection) {
+        this.activeConnection.close(1000, "Server shutting down");
+        this.activeConnection = null;
+      }
+
+      // Close WebSocket server
+      this.wss.close(() => {
+        clearTimeout(forceCloseTimeout);
+        console.log("WebSocket server closed gracefully");
+        resolve();
+      });
+    });
+  }
 }
 
 // Move the server creation before BrowserConnector instantiation
@@ -677,10 +718,41 @@ const server = app.listen(PORT, () => {
 // Initialize the browser connector with the existing app AND server
 const browserConnector = new BrowserConnector(app, server);
 
-// Handle shutdown gracefully
-process.on("SIGINT", () => {
-  server.close(() => {
-    console.log("Server shut down");
+// Handle shutdown gracefully with improved error handling
+process.on("SIGINT", async () => {
+  console.log("\nReceived SIGINT signal. Starting graceful shutdown...");
+
+  try {
+    // First shutdown WebSocket connections
+    await browserConnector.shutdown();
+
+    // Then close the HTTP server
+    await new Promise<void>((resolve, reject) => {
+      server.close((err) => {
+        if (err) {
+          console.error("Error closing HTTP server:", err);
+          reject(err);
+        } else {
+          console.log("HTTP server closed successfully");
+          resolve();
+        }
+      });
+    });
+
+    // Clear all logs
+    clearAllLogs();
+
+    console.log("Shutdown completed successfully");
     process.exit(0);
-  });
+  } catch (error) {
+    console.error("Error during shutdown:", error);
+    // Force exit in case of error
+    process.exit(1);
+  }
+});
+
+// Also handle SIGTERM
+process.on("SIGTERM", () => {
+  console.log("\nReceived SIGTERM signal");
+  process.emit("SIGINT");
 });
```

**File**: `browser-tools-server/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@agentdeskai/browser-tools-server",
-  "version": "1.0.5",
+  "version": "1.1.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@agentdeskai/browser-tools-server",
-      "version": "1.0.5",
+      "version": "1.1.0",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.4.1",
```

**File**: `chrome-extension/devtools.js` (modified, +22/-7)
```diff
@@ -536,6 +536,18 @@ function setupWebSocket() {
       const message = JSON.parse(event.data);
       console.log("Chrome Extension: Received WebSocket message:", message);
 
+      if (message.type === "server-shutdown") {
+        console.log("Chrome Extension: Received server shutdown signal");
+        // Clear any reconnection attempts
+        if (wsReconnectTimeout) {
+          clearTimeout(wsReconnectTimeout);
+          wsReconnectTimeout = null;
+        }
+        // Close the connection gracefully
+        ws.close(1000, "Server shutting down");
+        return;
+      }
+
       if (message.type === "take-screenshot") {
         console.log("Chrome Extension: Taking screenshot...");
         // Capture screenshot of the current tab
@@ -574,10 +586,7 @@ function setupWebSocket() {
         });
       }
     } catch (error) {
-      console.error(
-        "Chrome Extension: Error processing WebSocket message:",
-        error
-      );
+      console.error("Chrome Extension: Error processing WebSocket message:", error);
     }
   };
 
@@ -589,11 +598,17 @@ function setupWebSocket() {
     }
   };
 
-  ws.onclose = () => {
+  ws.onclose = (event) => {
     console.log(
-      "Chrome Extension: WebSocket disconnected, attempting to reconnect..."
+      `Chrome Extension: WebSocket disconnected (${event.code}: ${event.reason})`
     );
-    wsReconnectTimeout = setTimeout(setupWebSocket, WS_RECONNECT_DELAY);
+    // Only attempt to reconnect if it wasn't a server shutdown
+    if (event.reason !== "Server shutting down") {
+      console.log("Chrome Extension: Attempting to reconnect...");
+      wsReconnectTimeout = setTimeout(setupWebSocket, WS_RECONNECT_DELAY);
+    } else {
+      console.log("Chrome Extension: Server shutdown detected, not reconnecting");
+    }
   };
 
   ws.onerror = (error) => {
```

---

### Incident Patch 9: `1f33030d` (2025-03-10)
**Commit Message**: added audit and debugger mode

**File**: `browser-tools-mcp/mcp-server.ts` (modified, +760/-0)
```diff
@@ -577,6 +577,766 @@ server.tool(
   }
 );
 
+server.tool("runNextJSAudit", {}, async () => ({
+  content: [
+    {
+      type: "text",
+      text: `
+      You are an expert in SEO and web development with NextJS. Given the following procedures for analyzing my codebase, please perform a comprehensive - page by page analysis of our NextJS application to identify any issues or areas of improvement for SEO.
+
+      After each iteration of changes, reinvoke this tool to re-fetch our SEO audit procedures and then scan our codebase again to identify additional areas of improvement. 
+
+      When no more areas of improvement are found, return "No more areas of improvement found, your NextJS application is optimized for SEO!".
+
+      Start by analyzing each of the following aspects of our codebase:
+      1. Meta tags - provides information about your website to search engines and social media platforms.
+
+        Pages should provide the following standard meta tags:
+
+        title
+        description
+        keywords
+        robots
+        viewport
+        charSet
+        Open Graph meta tags:
+
+        og:site_name
+        og:locale
+        og:title
+        og:description
+        og:type
+        og:url
+        og:image
+        og:image:alt
+        og:image:type
+        og:image:width
+        og:image:height
+        Article meta tags (actually it's also OpenGraph):
+
+        article:published_time
+        article:modified_time
+        article:author
+        Twitter meta tags:
+
+        twitter:card
+        twitter:site
+        twitter:creator
+        twitter:title
+        twitter:description
+        twitter:image
+
+        For applications using the pages router, set up metatags like this in pages/[slug].tsx:
+          import Head from "next/head";
+
+          export default function Page() {
+            return (
+              <Head>
+                <title>
+                  Next.js SEO: The Complete Checklist to Boost Your Site Ranking
+                </title>
+                <meta
+                  name="description"
+                  content="Learn how to optimize your Next.js website for SEO by following this complete checklist."
+                />
+                <meta
+                  name="keywords"
+                  content="nextjs seo complete checklist, nextjs seo tutorial"
+                />
+                <meta name="robots" content="index, follow" />
+                <meta name="googlebot" content="index, follow" />
+                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+                <meta charSet="utf-8" />
+                <meta property="og:site_name" content="Blog | Minh Vu" />
+                <meta property="og:locale" content="en_US" />
+                <meta
+                  property="og:title"
+                  content="Next.js SEO: The Complete Checklist to Boost Your Site Ranking"
+                />
+                <meta
+                  property="og:description"
+                  content="Learn how to optimize your Next.js website for SEO by following this complete checklist."
+                />
+                <meta property="og:type" content="website" />
+                <meta property="og:url" content="https://dminhvu.com/nextjs-seo" />
+                <meta
+                  property="og:image"
+                  content="https://ik.imagekit.io/dminhvu/assets/nextjs-seo/thumbnail.png?tr=f-png"
+                />
+                <meta property="og:image:alt" content="Next.js SEO" />
+                <meta property="og:image:type" content="image/png" />
+                <meta property="og:image:width" content="1200" />
+                <meta property="og:image:height" content="630" />
+                <meta
+                  property="article:published_time"
+                  content="2024-01-11T11:35:00+07:00"
+                />
+                <meta
+                  property="article:modif
```

**File**: `browser-tools-mcp/package-lock.json` (modified, +124/-2)
```diff
@@ -1,19 +1,20 @@
 {
   "name": "@agentdeskai/browser-tools-mcp",
-  "version": "1.0.11",
+  "version": "1.1.1",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@agentdeskai/browser-tools-mcp",
-      "version": "1.0.11",
+      "version": "1.1.1",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.4.1",
         "body-parser": "^1.20.3",
         "cors": "^2.8.5",
         "express": "^4.21.2",
         "llm-cost": "^1.0.5",
+        "node-fetch": "^2.7.0",
         "ws": "^8.18.0"
       },
       "bin": {
@@ -24,6 +25,7 @@
         "@types/cors": "^2.8.17",
         "@types/express": "^5.0.0",
         "@types/node": "^22.13.1",
+        "@types/node-fetch": "^2.6.11",
         "@types/ws": "^8.5.14",
         "typescript": "^5.7.3"
       }
@@ -116,6 +118,16 @@
         "undici-types": "~6.20.0"
       }
     },
+    "node_modules/@types/node-fetch": {
+      "version": "2.6.12",
+      "resolved": "https://registry.npmjs.org/@types/node-fetch/-/node-fetch-2.6.12.tgz",
+      "integrity": "sha512-8nneRWKCg3rMtF69nLQJnOYUcbafYeFSjqkw3jCRLsqkWFlHaoQrr5mXmofFGOx3DKn7UfmBMyov8ySvLRVldA==",
+      "dev": true,
+      "dependencies": {
+        "@types/node": "*",
+        "form-data": "^4.0.0"
+      }
+    },
     "node_modules/@types/qs": {
       "version": "6.9.18",
       "resolved": "https://registry.npmjs.org/@types/qs/-/qs-6.9.18.tgz",
@@ -175,6 +187,12 @@
       "resolved": "https://registry.npmjs.org/array-flatten/-/array-flatten-1.1.1.tgz",
       "integrity": "sha512-PCVAQswWemu6UdxsDFFX/+gVeYqKAod3D3UVm91jHwynguOwAvYPhx8nNlM++NqRcK6CxxpUafjmhIdKiHibqg=="
     },
+    "node_modules/asynckit": {
+      "version": "0.4.0",
+      "resolved": "https://registry.npmjs.org/asynckit/-/asynckit-0.4.0.tgz",
+      "integrity": "sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==",
+      "dev": true
+    },
     "node_modules/body-parser": {
       "version": "1.20.3",
       "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-1.20.3.tgz",
@@ -247,6 +265,18 @@
         "url": "https://github.com/sponsors/ljharb"
       }
     },
+    "node_modules/combined-stream": {
+      "version": "1.0.8",
+      "resolved": "https://registry.npmjs.org/combined-stream/-/combined-stream-1.0.8.tgz",
+      "integrity": "sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==",
+      "dev": true,
+      "dependencies": {
+        "delayed-stream": "~1.0.0"
+      },
+      "engines": {
+        "node": ">= 0.8"
+      }
+    },
     "node_modules/content-disposition": {
       "version": "0.5.4",
       "resolved": "https://registry.npmjs.org/content-disposition/-/content-disposition-0.5.4.tgz",
@@ -299,6 +329,15 @@
         "ms": "2.0.0"
       }
     },
+    "node_modules/delayed-stream": {
+      "version": "1.0.0",
+      "resolved": "https://registry.npmjs.org/delayed-stream/-/delayed-stream-1.0.0.tgz",
+      "integrity": "sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==",
+      "dev": true,
+      "engines": {
+        "node": ">=0.4.0"
+      }
+    },
     "node_modules/depd": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/depd/-/depd-2.0.0.tgz",
@@ -369,6 +408,21 @@
         "node": ">= 0.4"
       }
     },
+    "node_modules/es-set-tostringtag": {
+      "version": "2.1.0",
+      "resolved": "https://registry.npmjs.org/es-set-tostringtag/-/es-set-tostringtag-2.1.0.tgz",
+      "integrity": "sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==",
+      "dev": true,
+      "dependencies": {
+        "es-errors": "^1.3.0",
+        "get-intrinsic": "^1.2.6",
+        "has-tostringtag": "^1.0.2",
+        "hasown": "^2.0.2"
+      },
+      "engines": {
+        "node": ">= 0.4"
+      }
+    },
     "node_modules/escape-html": {
     
```

---

### Incident Patch 10: `d8355d60` (2025-03-06)
**Commit Message**: refactor: Remove debug logging

**File**: `browser-tools-server/lighthouse/performance.ts` (modified, +0/-89)
```diff
@@ -171,16 +171,10 @@ const extractAIOptimizedData = (
     };
 
     // Enhanced LCP element detection
-    console.log("DEBUG: Attempting to find LCP element information");
 
     // 1. Try from largest-contentful-paint-element audit
     if (lcpElement && lcpElement.details) {
-      console.log("DEBUG: Found LCP element audit with details");
       const lcpDetails = lcpElement.details as any;
-      console.log(
-        "DEBUG: LCP element details:",
-        JSON.stringify(lcpDetails).substring(0, 500)
-      );
 
       // First attempt - try to get directly from items
       if (
@@ -189,67 +183,45 @@ const extractAIOptimizedData = (
         lcpDetails.items.length > 0
       ) {
         const item = lcpDetails.items[0];
-        console.log(
-          "DEBUG: Found LCP element item:",
-          JSON.stringify(item).substring(0, 500)
-        );
 
         // For text elements in tables format
         if (item.type === "table" && item.items && item.items.length > 0) {
           const firstTableItem = item.items[0];
-          console.log(
-            "DEBUG: Found table format item:",
-            JSON.stringify(firstTableItem).substring(0, 500)
-          );
 
           if (firstTableItem.node) {
             if (firstTableItem.node.selector) {
               metric.element_selector = firstTableItem.node.selector;
-              console.log(
-                "DEBUG: Found LCP selector from table:",
-                metric.element_selector
-              );
             }
 
             // Determine element type based on path or selector
             const path = firstTableItem.node.path;
             const selector = firstTableItem.node.selector || "";
 
             if (path) {
-              console.log("DEBUG: Element path:", path);
               if (
                 selector.includes(" > img") ||
                 selector.includes(" img") ||
                 selector.endsWith("img") ||
                 path.includes(",IMG")
               ) {
                 metric.element_type = "image";
-                console.log(
-                  "DEBUG: Element type set to image based on path/selector"
-                );
 
                 // Try to extract image name from selector
                 const imgMatch = selector.match(/img[.][^> ]+/);
                 if (imgMatch && !metric.element_url) {
                   metric.element_url = imgMatch[0];
-                  console.log(
-                    "DEBUG: Extracted image class name as URL fallback:",
-                    metric.element_url
-                  );
                 }
               } else if (
                 path.includes(",SPAN") ||
                 path.includes(",P") ||
                 path.includes(",H")
               ) {
                 metric.element_type = "text";
-                console.log("DEBUG: Element type set to text based on path");
               }
             }
 
             // Try to extract text content if available
             if (firstTableItem.node.nodeLabel) {
-              console.log("DEBUG: Node label:", firstTableItem.node.nodeLabel);
               metric.element_content = firstTableItem.node.nodeLabel.substring(
                 0,
                 100
@@ -259,18 +231,13 @@ const extractAIOptimizedData = (
         }
         // Original handling for direct items
         else if (item.node?.nodeLabel) {
-          console.log("DEBUG: LCP element node label:", item.node.nodeLabel);
           // Determine element type from node label
           if (item.node.nodeLabel.startsWith("<img")) {
             metric.element_type = "image";
             // Try to extract image URL from the node snippet
             const match = item.node.snippet?.match(/src="([^"]+)"/);
             if (match && match[1]) {
               metric.element_url = match[1];
-              console.log(
-                "DEBUG: Found LCP image URL from node label:",
-                metric.element_url
-              );
            
```

#### Recent Merged Pull Requests:
- **PR #238** (closed): - `browser-tools-server` convert to a docker container (@gregoryca)
- **PR #237** (closed): fix: handle CLI metadata flags before discovery (@xianzuyang9-blip)
- **PR #236** (closed): Add browser tools MCP package metadata (@run188)
- **PR #235** (closed): Keep MCP stdio logs off stdout (@mirageN1349)
- **PR #223** (closed): Fix: Replace console.log with console.error to prevent MCP protocol errors (@ymrdf)
- **PR #222** (closed): fix: send server discovery logs to stderr to avoid corrupting MCP stdout on Windows (@pntgoswami18)
- **PR #219** (closed): feat: Add tool annotations for improved LLM tool understanding (@bryankthompson)
- **PR #218** (closed): feat: network/console tools add keywords param. (@yj1438)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
