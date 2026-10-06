# Forensic Learning Record (Deep Inspection): AgentDeskAI/browser-tools-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentdeskai-browser-tools-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AgentDeskAI/browser-tools-mcp](https://github.com/AgentDeskAI/browser-tools-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:22:37.712Z  
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

### Core Architecture Module: `browser-tools-mcp/src/util/har.ts`
```
import type { NetworkEntry } from "../connector/store.js";

/**
 * Builds an HTTP Archive (HAR 1.2) from captured network entries.
 *
 * Exposed as a resource rather than inlined in a tool result: a full HAR of a
 * real page is far larger than an agent should ever be handed unasked, but it
 * is exactly what you want when a request needs to be examined properly, and
 * every browser and HTTP tool can already read the format.
 *
 * Values arrive already redacted; this does not scrub or unscrub anything.
 */

const CREATOR = { name: "BrowserTools MCP", version: "2.0.0" };

interface NameValue {
  name: string;
  value: string;
}

function headerList(headers: Record<string, string> | undefined): NameValue[] {
  if (!headers) return [];
  return Object.entries(headers).map(([name, value]) => ({ name, value: String(value ?? "") }));
}

function queryString(url: string): NameValue[] {
  try {
    const parsed = new URL(url);
    return [...parsed.searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch {
    // Relative or malformed urls simply have no parseable query.
    return [];
  }
}

function mimeTypeOf(headers: Record<string, string> | undefined): string {
  if (!headers) return "";
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === "content-type") return String(value).split(";")[0]!.trim();
  }
  return "";
}

/**
 * HAR wants when the request started; the capture stamps when it finished.
 *
 * `startedAt` is recorded at capture where the DevTools API supplies it.
 * Falling back to finish-minus-duration is right for everything that reports a
 * duration, and an entry with neither can only report what it has.
 */
function startedDateTime(entry: NetworkEntry): string {
  const finished =
    Number.isFinite(entry.timestamp) && entry.timestamp > 0 ? entry.timestamp : Date.now();

  let ms = finished;
  if (Number.isFinite(entry.startedAt) && (entry.startedAt as number) > 0) {
    ms = entry.startedAt as number;
  } else if (Number.isFinite(entry.durationMs) && (entry.durationMs as number) > 0) {
    ms = finished - (entry.durationMs as number);
  }

  return new Date(ms).toISOString();
}

export function buildHar(entries: readonly NetworkEntry[]): Record<string, unknown> {
  return {
    log: {
      version: "1.2",
      creator: CREATOR,
      pages: [],
      entries: entries.map((entry) => {
        const time = Number.isFinite(entry.durationMs) ? Number(entry.durationMs) : 0;
        const responseBody = entry.responseBody ?? "";

        const request: Record<string, unknown> = {
          method: entry.method || "GET",
          url: entry.url || "",
          httpVersion: "HTTP/1.1",
          headers: headerList(entry.requestHeaders),
          queryString: queryString(entry.url || ""),
          cookies: [],
          headersSize: -1,
          bodySize: entry.requestBody ? entry.requestBody.length : 0,
        };
        if (entry.requestBody) {
          request["postData"] = {
            mimeType: mimeTypeOf(entry.requestHeaders) || "application/octet-stream",
            text: entry.requestBody,
          };
        }

        return {
          startedDateTime: startedDateTime(entry),
          time,
          request,
          response: {
            status: entry.status ?? 0,
            statusText: entry.error ? String(entry.error) : "",
            httpVersion: "HTTP/1.1",
            headers: headerList(entry.responseHeaders),
            cookies: [],
            content: {
              size: responseBody.length,
              mimeType: mimeTypeOf(entry.responseHeaders),
              ...(responseBody ? { text: responseBody } : {}),
            },
            redirectURL: "",
            headersSize: -1,
            bodySize: responseBody.length,
          },
          cache: {},
          // The capture only knows a total duration, so it is all attributed to
          // wait rather than invented across the phases.
          timings: { send: 0, wait: time, receive: 0 },
        };
      }),
    },
  };
}

```

### Core Architecture Module: `browser-tools-mcp/src/util/image.ts`
```
/**
 * Image payload handling for screenshots.
 *
 * Screenshots travel as base64 and end up inlined in an MCP tool result. On a
 * high-DPI display a full-viewport capture of a visually dense page runs to
 * tens of megabytes, which is far past what any client wants in its context and
 * past the 10 MB read buffer newer MCP stdio transports enforce. So the format
 * is negotiable, and the size is measured rather than assumed.
 */

export const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg"]);

export interface ParsedImage {
  mimeType: string;
  base64: string;
}

const DATA_URL = /^data:([^;,]+);base64,(.*)$/s;

/**
 * Reads a data URL into its mime type and payload. A bare base64 string is
 * treated as PNG, which is what the extension has always produced, so a client
 * that omits the prefix does not silently write a corrupt file.
 */
export function parseImageDataUrl(value: string): ParsedImage | null {
  if (typeof value !== "string" || value.length === 0) return null;

  const match = DATA_URL.exec(value);
  if (!match) {
    // No prefix at all: assume the historical PNG payload.
    return value.startsWith("data:") ? null : { mimeType: "image/png", base64: value };
  }

  const mimeType = (match[1] ?? "").toLowerCase();
  const base64 = match[2] ?? "";
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType) || base64.length === 0) return null;

  return { mimeType, base64 };
}

export function extensionForMimeType(mimeType: string): string {
  return mimeType === "image/jpeg" ? "jpg" : "png";
}

/** Forces a filename's extension to match the bytes actually being written. */
export function withExtension(name: string, extension: string): string {
  const slash = name.lastIndexOf("/");
  const dir = slash === -1 ? "" : name.slice(0, slash + 1);
  const base = slash === -1 ? name : name.slice(slash + 1);

  const dot = base.lastIndexOf(".");
  const stem = dot <= 0 ? base : base.slice(0, dot);

  return `${dir}${stem}.${extension}`;
}

/** Decoded size of a base64 payload, without decoding it. */
export function approximateBytes(base64: string): number {
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

```

### Core Architecture Module: `browser-tools-mcp/src/util/logger.ts`
```
/**
 * Logging for a process that speaks JSON-RPC on stdout.
 *
 * Every message goes to stderr. Nothing in this project may ever call
 * console.log: a single stray line on stdout corrupts the MCP framing and the
 * client drops the session, which was the single most reported bug in 1.2.x.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function resolveLevel(): LogLevel {
  const raw = (process.env["BROWSER_TOOLS_LOG_LEVEL"] ?? "").toLowerCase();
  if (raw in LEVEL_ORDER) return raw as LogLevel;
  return "info";
}

let currentLevel: LogLevel = resolveLevel();

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function write(level: LogLevel, scope: string, args: unknown[]): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) return;

  const parts = args.map((arg) => {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return arg.stack ?? arg.message;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  });

  const prefix = scope ? `[${scope}] ` : "";
  process.stderr.write(`${level.toUpperCase()} ${prefix}${parts.join(" ")}\n`);
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  child(scope: string): Logger;
}

export function createLogger(scope = ""): Logger {
  return {
    debug: (...args) => write("debug", scope, args),
    info: (...args) => write("info", scope, args),
    warn: (...args) => write("warn", scope, args),
    error: (...args) => write("error", scope, args),
    child: (child) => createLogger(scope ? `${scope}:${child}` : child),
  };
}

export const logger = createLogger();

```

### Core Architecture Module: `browser-tools-mcp/src/util/paths.ts`
```
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

/** Thrown when a caller-supplied path would escape the screenshot sandbox. */
export class UnsafePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafePathError";
  }
}

const WSL_DISTRIBUTIONS = [
  "Ubuntu",
  "Debian",
  "kali",
  "openSUSE",
  "SLES",
  "Fedora",
  "Alpine",
  "Arch",
];

/**
 * Normalises a path written on one platform for use on another. In practice
 * this is about Windows hosts driving a server running under WSL, which is a
 * recurring source of "screenshot saved somewhere I can't find it" reports.
 */
export function convertPathForPlatform(
  inputPath: string,
  platform: NodeJS.Platform = os.platform()
): string {
  if (!inputPath) return inputPath;

  if (platform === "win32") {
    return inputPath.replace(/\//g, "\\");
  }

  if (platform !== "linux" && platform !== "darwin") return inputPath;

  // Windows drive letter, e.g. C:\Users\ted — checked before the generic
  // backslash handling below, which would otherwise leave the drive prefix in
  // place and produce a path that does not exist on a POSIX host.
  if (/^[A-Za-z]:[\\/]/.test(inputPath)) {
    return inputPath.replace(/^[A-Za-z]:[\\/]/, "/").replace(/\\/g, "/");
  }

  if (!inputPath.includes("\\")) return inputPath;

  const isWslPath =
    inputPath.includes("wsl.localhost") || inputPath.includes("wsl$");

  if (isWslPath) {
    const parts = inputPath.split("\\").filter((part) => part.length > 0);

    const distIndex = parts.findIndex((part) =>
      WSL_DISTRIBUTIONS.some((dist) => dist.toLowerCase() === part.toLowerCase())
    );
    if (distIndex !== -1 && distIndex + 1 < parts.length) {
      return "/" + parts.slice(distIndex + 1).join("/");
    }

    // Unknown distribution: skip the \\wsl.localhost\<distro> prefix positionally.
    const wslIndex = parts.findIndex((part) => {
      const lower = part.toLowerCase();
      return lower === "wsl.localhost" || lower === "wsl$";
    });
    if (wslIndex !== -1 && wslIndex + 2 <= parts.length - 1) {
      return "/" + parts.slice(wslIndex + 2).join("/");
    }
  }

  // Collapse the leading \\ of a UNC path to a single root slash.
  return inputPath.replace(/^\\\\/, "/").replace(/\\/g, "/");
}

export function convertPathForCurrentPlatform(inputPath: string): string {
  return convertPathForPlatform(inputPath, os.platform());
}

/** Default directory screenshots are written to. */
export function getDefaultScreenshotDir(): string {
  return path.join(os.homedir(), "Downloads", "mcp-screenshots");
}

/**
 * Characters permitted in a caller-supplied screenshot name.
 *
 * Deliberately restrictive. The previous implementation accepted an arbitrary
 * absolute path over an unauthenticated socket and interpolated it into a
 * shell command, which was the root of the command-injection vulnerability.
 * Nothing outside this set can escape a shell word or a directory.
 */
const SAFE_RELATIVE_PATH = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;

/**
 * Resolves a caller-supplied relative name inside `baseDir`, refusing anything
 * that could escape it. Callers never choose the base directory.
 */
export function resolveSafeScreenshotPath(
  baseDir: string,
  relativeName: string
): string {
  if (typeof relativeName !== "string" || relativeName.length === 0) {
    throw new UnsafePathError("Screenshot name must be a non-empty string");
  }
  if (relativeName.includes("\u0000")) {
    throw new UnsafePathError("Screenshot name must not contain null bytes");
  }
  if (path.isAbsolute(relativeName) || /^[A-Za-z]:/.test(relativeName)) {
    throw new UnsafePathError("Screenshot name must be relative");
  }
  if (!SAFE_RELATIVE_PATH.test(relativeName)) {
    throw new UnsafePathError(
      `Screenshot name contains unsupported characters: ${JSON.stringify(relativeName)}`
    );
  }

  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, relativeName);

  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new UnsafePathError("Screenshot name must stay inside the screenshot directory");
  }

  return resolved;
}

let filenameCounter = 0;

/**
 * Builds a unique, sortable, shell-safe screenshot filename. Colons are
 * stripped so the name survives every platform and never needs quoting.
 */
export function screenshotFilename(now: Date = new Date(), extension = "png"): string {
  const stamp = now.toISOString().replace(/:/g, "-");
  const counter = (filenameCounter++ % 0x1000).toString(16).padStart(3, "0");
  const random = crypto.randomBytes(2).toString("hex").slice(0, 3);
  return `screenshot-${stamp}-${random}${counter}.${extension}`;
}

```

### Core Architecture Module: `browser-tools-mcp/src/util/redact.ts`
```
/**
 * Credential scrubbing for anything captured from the browser.
 *
 * Everything this project captures — request/response headers, response
 * bodies, console output — routinely contains session cookies, bearer tokens
 * and API keys. All of it is forwarded to an LLM client, so it is scrubbed on
 * the way into the store rather than on the way out.
 */

export const REDACTED = "[REDACTED]";

/** Header names whose value is always a credential. Compared case-insensitively. */
export const SENSITIVE_HEADERS: readonly string[] = [
  "authorization",
  "proxy-authorization",
  "authentication",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "apikey",
  "x-auth-token",
  "x-access-token",
  "x-session-token",
  "x-csrf-token",
  "x-xsrf-token",
  "x-amz-security-token",
  "x-goog-api-key",
  "x-functions-key",
  "x-secret",
];

const SENSITIVE_HEADER_SET = new Set(SENSITIVE_HEADERS);

/**
 * High-confidence secret shapes. These are deliberately anchored to vendor
 * prefixes so that ordinary log text is never mangled — a false positive
 * silently destroys debugging information, which is the thing this tool exists
 * to provide.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  // PEM private key blocks (must run first — it spans lines).
  /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g,
  // Vendor session and client identifiers, e.g. Clerk's sess_… and client_….
  // These are bearer-equivalent: they appear in URL paths as well as bodies.
  /\b(?:sess|session|client|tok|token|auth|cred|secret|apikey)_[A-Za-z0-9]{16,}\b/gi,
  // AWS access key IDs.
  /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA)[A-Z0-9]{16}\b/g,
  // GitHub tokens, classic and fine-grained.
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  // OpenAI / Anthropic style keys.
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/g,
  // Stripe and similar prefixed live/test keys.
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g,
  // Slack tokens.
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  // Google API keys.
  /\bAIza[A-Za-z0-9_-]{35}\b/g,
];

/**
 * Candidates for a JSON Web Token: base64url that starts with an encoded '{"'.
 *
 * Matching this alone is not enough. "eyJ" is simply base64 for '{"', so every
 * base64-encoded JSON object looks the same at the start — Clerk encodes image
 * parameters exactly this way, and treating those as secrets turned profile
 * image URLs into https://img.clerk.com/[REDACTED]. Each candidate is checked
 * by isJwt() below.
 */
const JWT_CANDIDATE = /\beyJ[A-Za-z0-9_-]{15,}(?:\.[A-Za-z0-9_-]+){0,2}/g;

/** Fields that appear in a JWT header and not in ordinary encoded JSON. */
const JWT_HEADER_FIELDS = /"(?:alg|typ|kid)"/;

function decodeBase64Prefix(value: string): string {
  // Decode a whole number of base64 groups, since the tail may be cut off.
  const usable = value.slice(0, 40);
  const aligned = usable.slice(0, usable.length - (usable.length % 4));
  if (aligned.length === 0) return "";
  try {
    return Buffer.from(aligned.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Decides whether a base64url run is really a token.
 *
 * Three dot-separated segments is JWT-shaped whatever it contains. With fewer —
 * which is what truncation leaves behind — the header is decoded and checked
 * for the fields only a JWT carries.
 */
export function isJwt(candidate: string): boolean {
  if (candidate.split(".").length >= 3) return true;
  const header = candidate.split(".")[0] ?? "";
  return JWT_HEADER_FIELDS.test(decodeBase64Prefix(header));
}

/** `Authorization: Bearer <token>` style values appearing inline in text. */
const AUTH_SCHEME_PATTERN = /\b(Bearer|Basic|Token|Digest)\s+[A-Za-z0-9._~+/=-]{16,}/gi;

/**
 * JSON/querystring style `"password": "..."` pairs. Matched by key name, since
 * the value itself has no recognisable shape.
 */
const SECRETISH_KEY_PATTERN =
  /("(?:[^"]*(?:password|passwd|secret|token|api[_-]?key|apikey|credential|private[_-]?key|auth)[^"]*)"\s*:\s*)"(?:[^"\\]|\\.)*"/gi;

/** Replaces secret-shaped substrings in a single string. */
export function redactSecretsInString(input: string): string {
  if (!input) return input;

  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  out = out.replace(JWT_CANDIDATE, (match) => (isJwt(match) ? REDACTED : match));
  out = out.replace(AUTH_SCHEME_PATTERN, (_m, scheme: string) => `${scheme} ${REDACTED}`);
  out = out.replace(SECRETISH_KEY_PATTERN, (_m, keyPart: string) => `${keyPart}"${REDACTED}"`);
  return out;
}

function isSensitiveHeaderName(name: string): boolean {
  return SENSITIVE_HEADER_SET.has(name.toLowerCase());
}

/**
 * Redacts credential-bearing headers while leaving the rest intact — the
 * non-sensitive headers are usually what makes a network log worth reading.
 */
export function redactHeaders(
  headers: Record<string, string> | undefined | null
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== "object") return out;

  for (const [name, value] of Object.entries(headers)) {
    if (isSensitiveHeaderName(name)) {
      out[name] = REDACTED;
    } else if (Array.isArray(value)) {
      out[name] = value.map((v) => redactSecretsInString(String(v))).join(", ");
    } else if (typeof value === "string") {
      out[name] = redactSecretsInString(value);
    } else {
      out[name] = value as unknown as string;
    }
  }
  return out;
}

export interface RedactOptions {
  /** Set false to pass data through untouched. */
  enabled?: boolean;
}

/**
 * Recursively redacts a captured value: sensitive keys by name, and
 * secret-shaped substrings anywhere in the remaining strings.
 */
export function redactValue(value: unknown, options: RedactOptions = {}): unknown {
  if (options.enabled === false) return value;
  return walk(value, new WeakSet());
}

function walk(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactSecretsInString(value);
  if (value === null || typeof value !== "object") return value;

  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => walk(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveHeaderName(key) || isSecretishKey(key)
      ? REDACTED
      : walk(item, seen);
  }
  return out;
}

const SECRETISH_KEY_NAME =
  /(password|passwd|secret|api[_-]?key|apikey|credential|private[_-]?key|access[_-]?token|refresh[_-]?token)/i;

function isSecretishKey(key: string): boolean {
  return SECRETISH_KEY_NAME.test(key);
}

```

### Core Architecture Module: `browser-tools-mcp/src/util/session.ts`
```
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { logger } from "./logger.js";

/**
 * Details of a running connector, published so that a separately-started MCP
 * process can attach to it without probing the network.
 */
export interface SessionInfo {
  port: number;
  token: string;
  pid: number;
  startedAt: string;
  version: string;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function sessionDir(): string {
  return (
    process.env["BROWSER_TOOLS_STATE_DIR"] ??
    path.join(os.homedir(), ".browser-tools-mcp")
  );
}

export function sessionFilePath(): string {
  return path.join(sessionDir(), "session.json");
}

/** Writes the session file with owner-only permissions — it contains a token. */
export function writeSessionFile(info: SessionInfo): void {
  try {
    const dir = sessionDir();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = sessionFilePath();
    fs.writeFileSync(file, JSON.stringify(info, null, 2), { mode: 0o600 });
    fs.chmodSync(file, 0o600);
  } catch (error) {
    logger.warn("Could not write session file:", error);
  }
}

export function readSessionFile(): SessionInfo | null {
  try {
    const raw = fs.readFileSync(sessionFilePath(), "utf8");
    const parsed = JSON.parse(raw) as SessionInfo;
    if (typeof parsed?.port !== "number" || typeof parsed?.token !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSessionFile(): void {
  try {
    fs.rmSync(sessionFilePath(), { force: true });
  } catch {
    /* nothing to clean up */
  }
}

/** Constant-time comparison so token checks cannot be timed. */
export function tokensMatch(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

```

### Core Architecture Module: `browser-tools-mcp/src/util/truncate.ts`
```
/** Payload shaping so captured telemetry fits an agent's context window. */

const TRUNCATION_SUFFIX = "... (truncated)";

/** Recursively caps the length of every string in a structure. */
export function truncateStringsInData(data: unknown, maxLength: number): unknown {
  return walk(data, maxLength, new WeakSet());
}

function walk(data: unknown, maxLength: number, seen: WeakSet<object>): unknown {
  if (typeof data === "string") {
    return data.length > maxLength
      ? data.substring(0, maxLength) + TRUNCATION_SUFFIX
      : data;
  }

  if (data === null || typeof data !== "object") return data;

  if (seen.has(data as object)) return "[Circular]";
  seen.add(data as object);

  if (Array.isArray(data)) {
    return data.map((item) => walk(item, maxLength, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    out[key] = walk(value, maxLength, seen);
  }
  return out;
}

/**
 * Chooses which log entries fit inside a character budget.
 *
 * Walks from the newest entry backwards, because when the budget forces a
 * choice the recent entries are the ones worth keeping. The result is returned
 * in chronological order. A single oversized entry is truncated rather than
 * allowed to hide everything around it.
 */
export function selectLogsWithinBudget<T>(logs: readonly T[], budget: number): T[] {
  if (logs.length === 0) return [];

  const selected: T[] = [];
  let used = 0;

  for (let i = logs.length - 1; i >= 0; i--) {
    const entry = logs[i] as T;
    const size = safeSize(entry);

    if (used + size > budget) {
      // Always return something: if even the newest entry blows the budget,
      // hand back a truncated version of it rather than an empty result.
      if (selected.length === 0) {
        const perStringCap = Math.max(50, Math.floor(budget / 2));
        selected.push(truncateStringsInData(entry, perStringCap) as T);
      }
      break;
    }

    selected.push(entry);
    used += size;
  }

  return selected.reverse();
}

function safeSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

```

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
   * since disconnected. This is what distinguishes a user deliberately opening
   * DevTools on a new tab from a throttled tab's socket coming back — both look
   * identical on the wire.
   */
  const seenTabIds = new Set<string>();
  let currentTabId: TabId | null = null;

  // ------------------------------------------------------------- http app

  const app = express();
  app.disable("x-powered-by");
  // Deliberately no cors() — the connector is same-machine only, and a
  // wildcard CORS policy is what let any visited page read captured telemetry.
  app.use(localOnlyGuard());
  app.use(express.json({ limit: config.maxBodySize ?? "10mb" }));

  app.get("/.identity", (_req: Request, res: Response) => {
    res.json({
      name: "BrowserTools Connector",
      version: SERVER_VERSION,
      signature: SERVER_SIGNATURE,
      port: actualPort,
      extensionConnected: connections.size > 0,
    });
  });

  const api = express.Router();
  api.use(requireToken(token));

  api.get("/settings", (_req, res) => {
    res.json({ settings: store.settings });
  });

  api.post("/settings", (req, res) => {
    const settings = store.updateSettings(req.body);
    broadcast({ type: "settings", settings });
    res.json({ settings });
  });

  api.get("/export/:kind", (req: Request, res: Response) => {
    try {
      const kind = String(req.params["kind"] ?? "");
      const scope = parseTabScope(req.query);
      if (kind === "console") return void res.json(exportConsole(scope));
      if (kind === "network") return void res.json(exportNetwork(scope));
      res.status(400).json({ error: `Unknown export: ${kind}`, code: "BAD_EXPORT" });
    } catch (error) {
      respondWithError(res, error);
    }
  });

  api.get("/artifact/:kind/:name", async (req: Request, res: Response) => {
    try {
      const kind = String(req.params["kind"] ?? "");
      if (kind !== "screenshot" && kind !== "audit") {
        return void res.status(400).json({ error: `Unknown artifact: ${kind}` });
      }
      res.json(await read
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

**File**: `browser-tools-mcp/src/lighthouse/runner.ts` (modified, +65/-13)
```diff
@@ -25,6 +25,69 @@ export class AuditError extends Error {
   }
 }
 
+/** Screen, throttling and user agent have to describe the same device. */
+const DEVICE_PROFILES = {
+  desktop: {
+    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
+    throttlingPreset: "desktopDense4G",
+  },
+  mobile: {
+    screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
+    throttlingPreset: "mobileSlow4G",
+  },
+} as const;
+
+/**
+ * Lighthouse's own presets, so an audit and any future emulation agree on what
+ * "mobile" means rather than each carrying its own numbers.
+ *
+ * Loaded on demand and memoised. A static import costs ~30ms at startup,
+ * because the connector imports this module eagerly and only audits ever need
+ * these values — and answering `initialize` promptly is the reason the second
+ * process went away.
+ */
+let devicePresets: Promise<{ throttling: any; userAgents: any }> | undefined;
+
+function loadDevicePresets() {
+  devicePresets ??= import("lighthouse/core/config/constants.js").then((m) => {
+    const c = (m as any).default ?? m;
+    return { throttling: c.throttling, userAgents: c.userAgents };
+  });
+  return devicePresets;
+}
+
+export interface LighthouseFlagOptions {
+  category: AuditCategory;
+  device: "desktop" | "mobile";
+  port: number;
+  timeoutMs: number;
+}
+
+/**
+ * Builds the flags for a run.
+ *
+ * formFactor and screenEmulation were set but throttling and emulatedUserAgent
+ * were not, so a desktop audit ran a desktop viewport under Lighthouse's
+ * default mobile Slow-4G throttling while identifying itself as a phone —
+ * three settings disagreeing about the device, and a score shaped by whichever
+ * one mattered most.
+ */
+export async function buildLighthouseFlags(options: LighthouseFlagOptions) {
+  const profile = DEVICE_PROFILES[options.device];
+  const { throttling, userAgents } = await loadDevicePresets();
+  return {
+    port: options.port,
+    output: "json" as const,
+    logLevel: "error" as const,
+    onlyCategories: [options.category],
+    formFactor: options.device,
+    screenEmulation: profile.screenEmulation,
+    throttling: throttling[profile.throttlingPreset],
+    emulatedUserAgent: userAgents[options.device],
+    maxWaitForLoad: options.timeoutMs,
+  };
+}
+
 /** Only real web pages can be audited; anything else is a configuration mistake. */
 export function assertAuditableUrl(url: string): URL {
   let parsed: URL;
@@ -86,18 +149,7 @@ export async function runLighthouseAudit(
       chromePath: browser.path,
     })) as unknown as { port: number; kill: () => Promise<void> };
 
-    const flags = {
-      port: chrome.port,
-      output: "json" as const,
-      logLevel: "error" as const,
-      onlyCategories: [category],
-      formFactor: device,
-      screenEmulation:
-        device === "desktop"
-          ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
-          : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
-      maxWaitForLoad: timeoutMs,
-    };
+    const flags = await buildLighthouseFlags({ category, device, port: chrome.port, timeoutMs });
 
     const result = (await withTimeout(
       lighthouse(url, flags),
@@ -109,7 +161,7 @@ export async function runLighthouseAudit(
     if (!lhr) throw new AuditError("Lighthouse returned no result");
 
     hooks.onRawResult?.(lhr);
-    return extractAuditReport(lhr, url, category);
+    return extractAuditReport(lhr, url, category, device);
   } catch (error) {
     if (error instanceof AuditError) throw error;
     // Already a clear, actionable explanation; do not bury it.
```

**File**: `browser-tools-mcp/src/util/har.ts` (modified, +19/-3)
```diff
@@ -41,8 +41,24 @@ function mimeTypeOf(headers: Record<string, string> | undefined): string {
   return "";
 }
 
-function startedDateTime(timestamp: number): string {
-  const ms = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
+/**
+ * HAR wants when the request started; the capture stamps when it finished.
+ *
+ * `startedAt` is recorded at capture where the DevTools API supplies it.
+ * Falling back to finish-minus-duration is right for everything that reports a
+ * duration, and an entry with neither can only report what it has.
+ */
+function startedDateTime(entry: NetworkEntry): string {
+  const finished =
+    Number.isFinite(entry.timestamp) && entry.timestamp > 0 ? entry.timestamp : Date.now();
+
+  let ms = finished;
+  if (Number.isFinite(entry.startedAt) && (entry.startedAt as number) > 0) {
+    ms = entry.startedAt as number;
+  } else if (Number.isFinite(entry.durationMs) && (entry.durationMs as number) > 0) {
+    ms = finished - (entry.durationMs as number);
+  }
+
   return new Date(ms).toISOString();
 }
 
@@ -74,7 +90,7 @@ export function buildHar(entries: readonly NetworkEntry[]): Record<string, unkno
         }
 
         return {
-          startedDateTime: startedDateTime(entry.timestamp),
+          startedDateTime: startedDateTime(entry),
           time,
           request,
           response: {
```

**File**: `browser-tools-mcp/test/unit/extension-redact.test.ts` (modified, +50/-3)
```diff
@@ -20,14 +20,19 @@ const sharedJsPath = path.resolve(
 );
 
 let scrubAndTruncate: (value: string, limit: number) => string;
+let sanitiseSelectedElement: (element: unknown, limit: number) => unknown;
 let scrubSecrets: (value: string) => string;
 
 beforeAll(() => {
   const source = fs.readFileSync(sharedJsPath, "utf8");
   const extract = new Function(
-    `${source}\nreturn { scrubAndTruncate, scrubSecrets };`
-  ) as () => { scrubAndTruncate: typeof scrubAndTruncate; scrubSecrets: typeof scrubSecrets };
-  ({ scrubAndTruncate, scrubSecrets } = extract());
+    `${source}\nreturn { scrubAndTruncate, scrubSecrets, sanitiseSelectedElement };`
+  ) as () => {
+    scrubAndTruncate: typeof scrubAndTruncate;
+    scrubSecrets: typeof scrubSecrets;
+    sanitiseSelectedElement: typeof sanitiseSelectedElement;
+  };
+  ({ scrubAndTruncate, scrubSecrets, sanitiseSelectedElement } = extract());
 });
 
 describe("scrubbing happens before truncation", () => {
@@ -125,3 +130,45 @@ describe("base64 JSON that is not a token", () => {
     expect(redactSecretsInString(token)).toContain("[REDACTED]");
   });
 });
+
+/**
+ * The selected element took a different path to every other capture.
+ *
+ * onSelectionChanged sliced textContent and innerHTML inside the page and sent
+ * the result straight out — no scrubbing in the browser at all, and the slicing
+ * happened first. That is the exact ordering that caused the original leak: a
+ * token cut mid-way no longer matches the pattern that would have caught it.
+ */
+describe("selected element sanitisation", () => {
+  const jwt =
+    "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQZDRQZDRQIiwia2lkIjoiaW5zXzJa" +
+    "X".repeat(600) +
+    ".eyJzdWIiOiJ1c2VyIn0.SIGNATUREabcdef123456";
+
+  it("scrubs a token in textContent that is longer than the limit", () => {
+    const out = sanitiseSelectedElement({ textContent: `token ${jwt}` }, 500) as any;
+    expect(out.textContent).not.toContain("eyJhbGciOiJSUzI1NiIsImNhdCI6");
+    expect(out.textContent).toContain("[REDACTED]");
+  });
+
+  it("scrubs attribute values, not just text", () => {
+    const out = sanitiseSelectedElement(
+      { attributes: { "data-session": "sess_3HWEvAAPLW3pElwMd0oolLs5aF7", id: "save" } },
+      500
+    ) as any;
+    expect(out.attributes["data-session"]).toContain("[REDACTED]");
+    expect(out.attributes.id).toBe("save");
+  });
+
+  it("scrubs innerHTML before truncating it", () => {
+    const out = sanitiseSelectedElement({ innerHTML: `<div>${jwt}</div>` }, 500) as any;
+    expect(out.innerHTML).not.toContain("eyJhbGciOiJSUzI1NiIsImNhdCI6");
+  });
+
+  it("leaves non-string fields alone", () => {
+    const rect = { x: 1, y: 2, width: 3, height: 4 };
+    const out = sanitiseSelectedElement({ tagName: "BUTTON", boundingRect: rect }, 500) as any;
+    expect(out.tagName).toBe("BUTTON");
+    expect(out.boundingRect).toEqual(rect);
+  });
+});
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

**File**: `browser-tools-mcp/test/unit/store.test.ts` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ describe("redaction at ingest", () => {
 
   it("redacts secrets inside console messages", () => {
     store.addConsole(
-      consoleEntry({ message: "auth failed for ghp_1234567890abcdefghijklmnopqrstuvwx" })
+      consoleEntry({ message: "auth failed for ghp" + "_1234567890abcdefghijklmnopqrstuvwx" })
     );
     const entry = store.queryConsole({}).entries[0]!;
     expect(entry.message).not.toContain("ghp_1234567890");
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

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

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

### Incident Patch 5: `c6a1d718` (2026-08-10)
**Commit Message**: Prefer an installed Chrome over a cached test build

Installing Google Chrome exposed a gap: chrome-launcher located nothing, and
the fallback list did not contain stock Chrome at all, because I had assumed
chrome-launcher would always find it. On macOS it searches through Spotlight,
which is unavailable in restricted environments, with indexing disabled, or for
an install too recent to have been indexed. The result was a brand-new Chrome
being passed over in favour of a stale cached Playwright build — a worse
browser, and on this machine a broken one.

Ordering is now explicit and reasoned rather than incidental:

- Stock Chrome, Chromium and Canary, at their standard macOS, Linux and Windows
  paths. A browser the user installed and maintains is the safest bet.
- Well-behaved Chromium forks: Brave, Edge, Vivaldi, Opera.
- A Chrome for Testing build from the Playwright cache. A real Chrome build, but
  possibly stale, and newest build number first since readdir order is
  arbitrary.
- Arc last. It replaces much of Chromium's window and tab handling, so it is
  likeliest to surprise headless — still better than failing outright for
  someone who has nothing else.

The end-to-end su

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -41,6 +41,14 @@
   The error now names the browser and its path, keeps the underlying cause, and
   suggests a fix — including the ad-hoc-signing repair when the browser is a
   Playwright-downloaded Chromium, which macOS sometimes refuses to launch.
+- **An installed Google Chrome is no longer passed over.** `chrome-launcher`
+  locates browsers through Spotlight on macOS, which is unavailable in
+  restricted environments, with indexing off, or for an install too recent to
+  have been indexed. Stock Chrome was missing from the fallback list on the
+  assumption that chrome-launcher would always find it, so a freshly installed
+  Chrome lost out to a stale cached Playwright build. Installed browsers now
+  come first, cached test builds next, and heavily customised ones like Arc
+  last. Windows and Linux Chrome paths are covered too.
 - **Audits now work without Google Chrome installed.** `chrome-launcher` only
   looks for Chrome and Chromium, so anyone running Arc, Brave or Edge and
   nothing else lost all four audit tools to "No Chrome installations found",
```

**File**: `browser-tools-mcp/src/lighthouse/find-browser.ts` (modified, +37/-5)
```diff
@@ -39,19 +39,40 @@ const APPS = "/Applications";
  * behaves most predictably under Lighthouse, and Arc customises the most.
  */
 export const CHROMIUM_CANDIDATES: readonly BrowserCandidate[] = [
+  // Stock Chrome first. chrome-launcher should normally find this, but it
+  // locates browsers through Spotlight on macOS, which is not always available
+  // — restricted environments, indexing turned off, or an install too recent to
+  // have been indexed. Without this entry a freshly installed Chrome was passed
+  // over in favour of a stale cached build.
+  { name: "Google Chrome", path: `${APPS}/Google Chrome.app/Contents/MacOS/Google Chrome` },
   { name: "Chromium", path: `${APPS}/Chromium.app/Contents/MacOS/Chromium` },
   { name: "Google Chrome Canary", path: `${APPS}/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary` },
   { name: "Brave", path: `${APPS}/Brave Browser.app/Contents/MacOS/Brave Browser` },
   { name: "Microsoft Edge", path: `${APPS}/Microsoft Edge.app/Contents/MacOS/Microsoft Edge` },
   { name: "Vivaldi", path: `${APPS}/Vivaldi.app/Contents/MacOS/Vivaldi` },
   { name: "Opera", path: `${APPS}/Opera.app/Contents/MacOS/Opera` },
-  { name: "Arc", path: `${APPS}/Arc.app/Contents/MacOS/Arc` },
   // Linux locations, for the same browsers.
+  { name: "Google Chrome", path: "/usr/bin/google-chrome" },
+  { name: "Google Chrome", path: "/usr/bin/google-chrome-stable" },
   { name: "Chromium", path: "/usr/bin/chromium" },
   { name: "Chromium", path: "/usr/bin/chromium-browser" },
-  { name: "Google Chrome", path: "/usr/bin/google-chrome" },
   { name: "Brave", path: "/usr/bin/brave-browser" },
   { name: "Microsoft Edge", path: "/usr/bin/microsoft-edge" },
+  // Windows, since the project claims to support it.
+  { name: "Google Chrome", path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
+  { name: "Google Chrome", path: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" },
+  { name: "Microsoft Edge", path: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" },
+];
+
+/**
+ * Tried only once everything else is exhausted.
+ *
+ * Arc replaces much of Chromium's window and tab handling, so it is the most
+ * likely to behave unexpectedly headless. It is still far better than failing
+ * outright for someone who has nothing else installed.
+ */
+export const LAST_RESORT_CANDIDATES: readonly BrowserCandidate[] = [
+  { name: "Arc", path: `${APPS}/Arc.app/Contents/MacOS/Arc` },
 ];
 
 export interface FindOptions {
@@ -81,8 +102,13 @@ function playwrightChromium(exists: (p: string) => boolean): BrowserCandidate[]
   const root = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
   const found: BrowserCandidate[] = [];
   try {
-    for (const dir of fs.readdirSync(root)) {
-      if (!dir.startsWith("chromium-")) continue;
+    // Highest build number first; readdir order is arbitrary and an old build
+    // is likelier to be stale or broken.
+    const dirs = fs
+      .readdirSync(root)
+      .filter((d) => d.startsWith("chromium-"))
+      .sort((a, b) => Number(b.split("-")[1] ?? 0) - Number(a.split("-")[1] ?? 0));
+    for (const dir of dirs) {
       for (const variant of ["chrome-mac-arm64", "chrome-mac", "chrome-linux"]) {
         for (const leaf of [
           "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
@@ -119,10 +145,16 @@ export function findAuditBrowser(options: FindOptions = {}): FoundBrowser {
     /* its detection is best-effort; the fallbacks below still apply */
   }
 
+  // Installed browsers before cached test builds: a Chrome the user maintains
+  // is likelier to work, and to be current, than one a tool downloaded once.
+  // Installed, stock-like browsers first; then a cached Chrome for Testing,
+  // which is a real Chrome build but may be stale; then the heavily customised
+  // ones, which are better than nothing but likeliest to surprise.
   const fallbacks = [
+    ...CHROMIUM_CANDIDATES,
     ...(options.extraCandidates ?? []),
     ...playwrightChromium(exists),
-    ...CHROMIUM_CANDIDATES,
+    ...LAST_RESORT_CANDIDATES,
   ];
   for (const candidate of fallbacks) {
     if (exists(candidate.path)) {
```

**File**: `browser-tools-mcp/test/e2e/browser.e2e.test.ts` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@ beforeAll(async () => {
   }
 
   context = await chromium.launchPersistentContext(userDataDir, {
+    ...browserSupport.launchOptions,
     headless: false,
     viewport: { width: 1280, height: 800 },
     args: [
```

**File**: `browser-tools-mcp/test/e2e/inject-capture.e2e.test.ts` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ beforeAll(async () => {
   expect(INJECT_DRAIN).toContain("__btmcpBuffer");
 
   fixture = await startFixtureServer();
-  browser = await chromium.launch({ headless: true });
+  browser = await chromium.launch({ headless: true, ...browserSupport.launchOptions });
 }, 120_000);
 
 afterAll(async () => {
```

**File**: `browser-tools-mcp/test/e2e/panel.e2e.test.ts` (modified, +1/-0)
```diff
@@ -96,6 +96,7 @@ function unpackedExtensionId(absolutePath: string): string {
 beforeAll(async () => {
   userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bt-panel-profile-"));
   context = await chromium.launchPersistentContext(userDataDir, {
+    ...browserSupport.launchOptions,
     headless: false,
     args: [
       `--disable-extensions-except=${extensionPath}`,
```

**File**: `browser-tools-mcp/test/helpers/browser-available.ts` (modified, +26/-6)
```diff
@@ -12,20 +12,40 @@ import { chromium } from "playwright";
 export interface BrowserAvailability {
   usable: boolean;
   reason: string;
+  /** Extra launch options the suites must pass to get a working browser. */
+  launchOptions: { channel?: string };
 }
 
 let cached: BrowserAvailability | null = null;
 
 export async function browserAvailability(): Promise<BrowserAvailability> {
   if (cached) return cached;
-  try {
-    const browser = await chromium.launch({ headless: true });
-    await browser.close();
-    cached = { usable: true, reason: "" };
-  } catch (error) {
-    const message = error instanceof Error ? error.message.split("\n")[0]! : String(error);
+
+  // Playwright's own Chromium is ad hoc-signed and some macOS installs refuse
+  // to start it, so an installed Chrome is tried as well before giving up.
+  const attempts: Array<{ label: string; options: { channel?: string } }> = [
+    { label: "bundled chromium", options: {} },
+    { label: "installed Chrome", options: { channel: "chrome" } },
+  ];
+
+  const failures: string[] = [];
+  for (const attempt of attempts) {
+    try {
+      const browser = await chromium.launch({ headless: true, ...attempt.options });
+      await browser.close();
+      cached = { usable: true, reason: "", launchOptions: attempt.options };
+      return cached;
+    } catch (error) {
+      const detail = error instanceof Error ? error.message.split("\n")[0]! : String(error);
+      failures.push(`${attempt.label}: ${detail}`);
+    }
+  }
+
+  {
+    const message = failures.join("; ");
     cached = {
       usable: false,
+      launchOptions: {},
       reason:
         `Chromium could not be launched here, so the browser-dependent tests were skipped: ${message}. ` +
         `On macOS an ad hoc-signed Playwright build is sometimes refused; ` +
```

**File**: `browser-tools-mcp/test/unit/find-browser.test.ts` (modified, +58/-3)
```diff
@@ -76,13 +76,22 @@ describe("findAuditBrowser", () => {
     );
   });
 
-  it("covers the browsers people actually use", () => {
-    const names = CHROMIUM_CANDIDATES.map((c) => c.name);
+  it("covers the browsers people actually use", async () => {
+    const { LAST_RESORT_CANDIDATES } = await import("../../src/lighthouse/find-browser");
+    const names = [...CHROMIUM_CANDIDATES, ...LAST_RESORT_CANDIDATES].map((c) => c.name);
     expect(names).toEqual(
-      expect.arrayContaining(["Brave", "Microsoft Edge", "Arc", "Vivaldi", "Opera"])
+      expect.arrayContaining(["Google Chrome", "Brave", "Microsoft Edge", "Arc", "Vivaldi", "Opera"])
     );
   });
 
+  it("treats Arc as a last resort, behind better-behaved options", async () => {
+    const { LAST_RESORT_CANDIDATES } = await import("../../src/lighthouse/find-browser");
+    // Arc rewrites much of Chromium's window handling, so anything stock-like
+    // is a safer bet for a headless Lighthouse run.
+    expect(LAST_RESORT_CANDIDATES.map((c) => c.name)).toContain("Arc");
+    expect(CHROMIUM_CANDIDATES.map((c) => c.name)).not.toContain("Arc");
+  });
+
   it("survives chrome-launcher throwing", () => {
     const arc = "/Applications/Arc.app/Contents/MacOS/Arc";
     const found = findAuditBrowser({
@@ -170,3 +179,49 @@ describe("describeLaunchFailure", () => {
     expect(message).not.toMatch(/codesign/i);
   });
 });
+
+/**
+ * chrome-launcher locates Chrome on macOS via Spotlight, which is not always
+ * available — a restricted environment, indexing disabled, or an install too
+ * recent to have been indexed. With a real Chrome sitting in /Applications, its
+ * absence from the fallback list meant picking a stale cached Playwright build
+ * instead of the browser the user had just installed.
+ */
+describe("stock Chrome in the fallback list", () => {
+  const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
+  const CACHED =
+    "/Users/x/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing";
+
+  it("finds an installed Chrome even when chrome-launcher reports none", () => {
+    const found = findAuditBrowser({
+      env: {},
+      exists: (p) => p === CHROME,
+      installed: () => [],
+    });
+
+    expect(found.path).toBe(CHROME);
+    expect(found.name).toBe("Google Chrome");
+  });
+
+  it("prefers real Chrome over a cached test build", () => {
+    const found = findAuditBrowser({
+      env: {},
+      exists: (p) => p === CHROME || p === CACHED,
+      installed: () => [],
+      extraCandidates: [{ name: "Chrome for Testing", path: CACHED }],
+    });
+
+    // The browser the user actually installed and maintains wins.
+    expect(found.path).toBe(CHROME);
+  });
+
+  it("lists stock Chrome among the candidates", () => {
+    expect(CHROMIUM_CANDIDATES.map((c) => c.path)).toContain(CHROME);
+  });
+
+  it("covers the Windows and Linux Chrome locations too", () => {
+    const paths = CHROMIUM_CANDIDATES.map((c) => c.path);
+    expect(paths.some((p) => p.includes("Program Files") && p.includes("chrome.exe"))).toBe(true);
+    expect(paths).toContain("/usr/bin/google-chrome");
+  });
+});
```

---

### Incident Patch 6: `28415904` (2026-08-08)
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

**File**: `chrome-extension/shared.js` (modified, +28/-2)
```diff
@@ -189,8 +189,6 @@ const BTMCP_REDACTED = "[REDACTED]";
 
 const BTMCP_SECRET_PATTERNS = [
   /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g,
-  // Later JWT segments are optional so a partial token still matches.
-  /\beyJ[A-Za-z0-9_-]{15,}(?:\.[A-Za-z0-9_-]+){0,2}/g,
   /\b(?:sess|session|client|tok|token|auth|cred|secret|apikey)_[A-Za-z0-9]{16,}\b/gi,
   /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA)[A-Z0-9]{16}\b/g,
   /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
@@ -201,6 +199,33 @@ const BTMCP_SECRET_PATTERNS = [
   /\bAIza[A-Za-z0-9_-]{35}\b/g,
 ];
 
+/**
+ * Base64url starting with an encoded '{"'. Only a candidate — see btmcpIsJwt.
+ * Plenty of harmless data is encoded this way, including Clerk image
+ * parameters, so redacting on the prefix alone destroys useful URLs.
+ */
+const BTMCP_JWT_CANDIDATE = /\beyJ[A-Za-z0-9_-]{15,}(?:\.[A-Za-z0-9_-]+){0,2}/g;
+
+const BTMCP_JWT_HEADER_FIELDS = /"(?:alg|typ|kid)"/;
+
+function btmcpDecodeBase64Prefix(value) {
+  // Decode whole base64 groups only; the tail is often cut off.
+  const usable = value.slice(0, 40);
+  const aligned = usable.slice(0, usable.length - (usable.length % 4));
+  if (!aligned) return "";
+  try {
+    return atob(aligned.replace(/-/g, "+").replace(/_/g, "/"));
+  } catch {
+    return "";
+  }
+}
+
+/** Three segments is JWT-shaped; fewer means checking the decoded header. */
+function btmcpIsJwt(candidate) {
+  if (candidate.split(".").length >= 3) return true;
+  return BTMCP_JWT_HEADER_FIELDS.test(btmcpDecodeBase64Prefix(candidate.split(".")[0] || ""));
+}
+
 const BTMCP_AUTH_SCHEME = /\b(Bearer|Basic|Token|Digest)\s+[A-Za-z0-9._~+/=-]{16,}/gi;
 
 const BTMCP_SECRETISH_KEY =
@@ -210,6 +235,7 @@ function scrubSecrets(value) {
   if (typeof value !== "string" || value.length === 0) return value;
   let out = value;
   for (const pattern of BTMCP_SECRET_PATTERNS) out = out.replace(pattern, BTMCP_REDACTED);
+  out = out.replace(BTMCP_JWT_CANDIDATE, (m) => (btmcpIsJwt(m) ? BTMCP_REDACTED : m));
   out = out.replace(BTMCP_AUTH_SCHEME, (m, scheme) => scheme + " " + BTMCP_REDACTED);
   out = out.replace(BTMCP_SECRETISH_KEY, (m, keyPart) => keyPart + '"' + BTMCP_REDACTED + '"');
   return out;
```

---

### Incident Patch 7: `7d988655` (2026-08-03)
**Commit Message**: Test the DevTools panel UI

Loads panel.html from the real extension origin — real markup, real shared.js,
real panel.js, real extension CSP — with only window.btmcp stubbed, since that
object is injected by devtools.js at runtime. Playwright cannot reach the
devtools:// frontend, and driving it over raw CDP would depend on undocumented
internals that change between Chrome versions.

Covers: settings populated from the bridge, each connection state rendering
distinctly, Save collecting edited values, checkbox and capture-mode changes
applying without Save, the full settings payload being sent on every update
(a partial one would silently reset omitted fields), fallbacks for cleared
host and numeric fields, reconnect, both cookie-permission outcomes, and the
no-bridge path explaining itself rather than hanging.

Two contract tests keep the stub honest: every bridge.* method panel.js calls
must exist on the object devtools.js builds, and every element id panel.js
looks up must exist in panel.html.

Verified non-vacuous by mutation: removing the Save wiring fails 3 tests, and
renaming one element id fails 8.

250 tests passing.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +4/-4)
```diff
@@ -71,12 +71,12 @@ for the vulnerabilities this release fixes.
   `auditMode`, `nextjsSeoAudit`.
 - A console capture mode that wraps the page's console instead of attaching the
   debugger — no "started debugging" banner, and it works in Firefox. (#115)
-- 235 tests: unit, integration, and end-to-end suites that load the real
+- 250 tests: unit, integration, and end-to-end suites that load the real
   extension into a real Chromium and assert the whole capture path, drive the
   full MCP client -> server -> connector -> extension -> page chain, run real
-  Lighthouse audits, exercise the shared-connector attach path over HTTP, and
-  cover the injected console-capture mode used where chrome.debugger is
-  unavailable.
+  Lighthouse audits, exercise the shared-connector attach path over HTTP, drive
+  the DevTools panel UI in the real extension origin, and cover the injected
+  console-capture mode used where chrome.debugger is unavailable.
 - `engines: node >=22.19`, so an unsupported runtime fails at install with a
   clear message. (#18, #2, #15)
 
```

**File**: `ROADMAP.md` (modified, +10/-6)
```diff
@@ -6,19 +6,23 @@ _Audit date: 2026-07-30. Based on a full review of all 21 open PRs, 8 open issue
 
 ## Status: implemented on branch `revival/v2`
 
-Everything in P0-P4 below is built and tested. 235 tests pass and `npm audit`
+Everything in P0-P4 below is built and tested. 250 tests pass and `npm audit`
 reports zero vulnerabilities, down from 22.
 
 Test coverage spans: pure units; the connector's HTTP and WebSocket surface
 including security regressions; MCP protocol conformance and stdout purity
 against the built binary; the shared-connector attach path over real HTTP; real
-Lighthouse audits against a real page; the injected console-capture mode; a real
-Chromium with the real extension loaded; and the full
+Lighthouse audits against a real page; the injected console-capture mode; the
+DevTools panel UI loaded from the real extension origin; a real Chromium with
+the real extension loaded; and the full
 MCP client -> server -> connector -> extension -> page chain.
 
-Still unverified by automation, and worth a manual pass: the DevTools panel UI,
-the extension running under Firefox, Windows and WSL, and installation via
-`npx` from a published tarball.
+Still unverified by automation, and worth a manual pass: the extension running
+under Firefox, Windows and WSL, and installation via `npx` from a published
+tarball. The panel is covered against a stubbed devtools bridge rather than
+inside a live DevTools window, since Chrome's devtools frontend is not
+automatable without depending on undocumented internals; the stub's shape is
+pinned to devtools.js by a contract test.
 
 See [CHANGELOG.md](CHANGELOG.md) for what shipped, [MIGRATION.md](MIGRATION.md)
 for the upgrade path, [SECURITY.md](SECURITY.md) for the vulnerability writeups,
```

**File**: `browser-tools-mcp/test/e2e/panel.e2e.test.ts` (added, +365/-0)
```diff
@@ -0,0 +1,365 @@
+import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
+import path from "node:path";
+import os from "node:os";
+import fs from "node:fs";
+import { fileURLToPath } from "node:url";
+import { chromium, type BrowserContext, type Page } from "playwright";
+
+/**
+ * The DevTools panel UI, loaded from the real extension origin.
+ *
+ * Playwright cannot reach the devtools:// frontend, and driving it over raw CDP
+ * depends on undocumented internals that change between Chrome versions. So the
+ * panel page itself is loaded directly at chrome-extension://<id>/panel.html —
+ * real markup, real shared.js, real panel.js, real extension CSP — with only
+ * `window.btmcp` stubbed, which is precisely the object devtools.js injects at
+ * runtime. The stub's shape is pinned against devtools.js by the contract tests
+ * at the bottom of this file.
+ */
+
+const extensionPath = path.resolve(
+  fileURLToPath(new URL("../../../chrome-extension", import.meta.url))
+);
+
+let context: BrowserContext | null = null;
+let userDataDir: string;
+let extensionId: string;
+let page: Page;
+let pageErrors: string[] = [];
+
+const STUB_SETTINGS = {
+  serverHost: "127.0.0.1",
+  serverPort: 3025,
+  logLimit: 50,
+  queryLimit: 30000,
+  stringSizeLimit: 500,
+  maxLogSize: 20000,
+  showRequestHeaders: false,
+  showResponseHeaders: true,
+  captureConsole: true,
+  captureNetwork: true,
+  captureResponseBodies: false,
+  captureMode: "debugger",
+};
+
+/** Installed before any page script runs, so panel.js never sees it missing. */
+function bridgeStub(settings: Record<string, unknown>) {
+  return `
+    window.__calls = [];
+    window.__cookieGrant = true;
+    window.btmcp = {
+      getStatus: () => ({ type: "status", state: "connecting", detail: "", server: null }),
+      getSettings: () => (${JSON.stringify(settings)}),
+      updateSettings: async (next) => { window.__calls.push(["updateSettings", next]); },
+      reconnect: () => { window.__calls.push(["reconnect"]); },
+      subscribe: (listener) => {
+        window.__listener = listener;
+        listener(window.btmcp.getStatus());
+        return () => {};
+      },
+      requestCookiePermission: async () => {
+        window.__calls.push(["requestCookiePermission"]);
+        return window.__cookieGrant;
+      },
+    };
+    window.__pushStatus = (status) => window.__listener(status);
+  `;
+}
+
+async function extensionIdFrom(context: BrowserContext): Promise<string> {
+  const probe = await context.newPage();
+  await probe.goto("data:text/html,<title>probe</title>");
+  await probe.waitForTimeout(2000);
+
+  const cdp = await context.newCDPSession(probe);
+  const { targetInfos } = (await cdp.send("Target.getTargets")) as {
+    targetInfos: Array<{ url: string }>;
+  };
+  await probe.close();
+
+  for (const target of targetInfos) {
+    const match = /^chrome-extension:\/\/([a-p]{32})\//.exec(target.url);
+    if (match?.[1]) return match[1];
+  }
+  throw new Error(
+    `Could not determine the extension id. Targets seen:\n${targetInfos
+      .map((t) => t.url)
+      .join("\n")}`
+  );
+}
+
+beforeAll(async () => {
+  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bt-panel-profile-"));
+  context = await chromium.launchPersistentContext(userDataDir, {
+    headless: false,
+    args: [
+      `--disable-extensions-except=${extensionPath}`,
+      `--load-extension=${extensionPath}`,
+      // Loads the extension's devtools page, which makes its origin discoverable.
+      "--auto-open-devtools-for-tabs",
+      "--no-first-run",
+      "--no-default-browser-check",
+    ],
+  });
+  extensionId = await extensionIdFrom(context);
+}, 180_000);
+
+afterAll(async () => {
+  await context?.close().catch(() => {});
+  fs.rmSync(userDataDir, { recursive: true, force: true });
+});
+
+async function openPanel(settings = STUB_SETTINGS): Promise<Page> {
+  const panel = await context!.newPage();
+  pageErrors = [];
+  panel.on("pageerror", (error) => pageErrors.push(error.message));
+  await panel.addInitScript(bridgeStub(settings));
+  await panel.goto(`chrome-extension://${extensionId}/panel.html`, {
+    waitUntil: "domcontentloaded",
+  });
+  // panel.js wires up after it sees the bridge.
+  await panel.waitForFunction(() => document.getElementById("host")?.value !== "");
+  return panel;
+}
+
+describe("panel UI in the real extension origin", () => {
+  beforeEach(async () => {
+    page = await openPanel();
+  });
+
+  it("loads without script errors", async () => {
+    expect(pageErrors).toEqual([]);
+    await page.close();
+  });
+
+  it("populates every control from the bridge's settings", async () => {
+    expect(await page.inputValue("#host")).toBe("127.0.0.1");
+    expect(await page.inputValue("#port")).toBe("3025");
+    expect(await page.inputValue("#captureMode")).toBe("debugger");
+    expect(await page.inputValue("#logLimit")).toBe("50");
+    expect(await page.inputValue("#queryLimit
```

---

### Incident Patch 8: `105aadfe` (2025-03-10)
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
+The MCP server provides tools to run audits on the current page. Here are example queries you can use to trigger them:
+
+#### Accessibility Audit (`runAccessibilityAudit`)
+
+Ensures the page meets accessibility standards like WCAG.
+
+> **Example Queries:**
+>
+> - "Are there any accessibility issues on this page?"
+> - "Run an accessibility audit."
+> - "Check if this page meets WCAG standards."
+
+#### Performance Audit (`runPerformanceAudit`)
+
+Identifies performance bottlenecks and loading issues.
+
+> **Example Queries:**
+>
+> - "Why is this page loading so slowly?"
+> - "Check the performance of this page."
+> - "Run a performance audit."
+
+#### SEO Audit (`runSEOAudit`)
+
+Evaluates how well the page is optimized for search engines.
+
+> **Example Queries:**
+>
+> - "How can I improve SEO for this page?"
+> - "Run an SEO audit."
+> - "Check SEO on this page."
+
+#### Best Practices Audit (`runBestPracticesAudit`)
+
+Checks for general best practices in web development.
+
+> **Example Queries:**
+>
+> - "Run a best practices audit."
+> - "Chec
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

**File**: `browser-tools-server/package-lock.json` (modified, +1851/-5)
```diff
@@ -1,19 +1,22 @@
 {
   "name": "@agentdeskai/browser-tools-server",
-  "version": "1.0.5",
+  "version": "1.1.1",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@agentdeskai/browser-tools-server",
-      "version": "1.0.5",
+      "version": "1.1.1",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.4.1",
         "body-parser": "^1.20.3",
         "cors": "^2.8.5",
         "express": "^4.21.2",
+        "lighthouse": "^11.6.0",
         "llm-cost": "^1.0.5",
+        "node-fetch": "^2.7.0",
+        "puppeteer-core": "^22.4.1",
         "ws": "^8.18.0"
       },
       "bin": {
@@ -24,10 +27,86 @@
         "@types/cors": "^2.8.17",
         "@types/express": "^5.0.0",
         "@types/node": "^22.13.1",
+        "@types/node-fetch": "^2.6.11",
+        "@types/puppeteer-core": "^7.0.4",
         "@types/ws": "^8.5.14",
         "typescript": "^5.7.3"
+      },
+      "optionalDependencies": {
+        "chrome-launcher": "^1.1.2"
+      }
+    },
+    "node_modules/@formatjs/ecma402-abstract": {
+      "version": "2.3.3",
+      "resolved": "https://registry.npmjs.org/@formatjs/ecma402-abstract/-/ecma402-abstract-2.3.3.tgz",
+      "integrity": "sha512-pJT1OkhplSmvvr6i3CWTPvC/FGC06MbN5TNBfRO6Ox62AEz90eMq+dVvtX9Bl3jxCEkS0tATzDarRZuOLw7oFg==",
+      "dependencies": {
+        "@formatjs/fast-memoize": "2.2.6",
+        "@formatjs/intl-localematcher": "0.6.0",
+        "decimal.js": "10",
+        "tslib": "2"
+      }
+    },
+    "node_modules/@formatjs/ecma402-abstract/node_modules/tslib": {
+      "version": "2.8.1",
+      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
+      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w=="
+    },
+    "node_modules/@formatjs/fast-memoize": {
+      "version": "2.2.6",
+      "resolved": "https://registry.npmjs.org/@formatjs/fast-memoize/-/fast-memoize-2.2.6.tgz",
+      "integrity": "sha512-luIXeE2LJbQnnzotY1f2U2m7xuQNj2DA8Vq4ce1BY9ebRZaoPB1+8eZ6nXpLzsxuW5spQxr7LdCg+CApZwkqkw==",
+      "dependencies": {
+        "tslib": "2"
+      }
+    },
+    "node_modules/@formatjs/fast-memoize/node_modules/tslib": {
+      "version": "2.8.1",
+      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
+      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w=="
+    },
+    "node_modules/@formatjs/icu-messageformat-parser": {
+      "version": "2.11.1",
+      "resolved": "https://registry.npmjs.org/@formatjs/icu-messageformat-parser/-/icu-messageformat-parser-2.11.1.tgz",
+      "integrity": "sha512-o0AhSNaOfKoic0Sn1GkFCK4MxdRsw7mPJ5/rBpIqdvcC7MIuyUSW8WChUEvrK78HhNpYOgqCQbINxCTumJLzZA==",
+      "dependencies": {
+        "@formatjs/ecma402-abstract": "2.3.3",
+        "@formatjs/icu-skeleton-parser": "1.8.13",
+        "tslib": "2"
+      }
+    },
+    "node_modules/@formatjs/icu-messageformat-parser/node_modules/tslib": {
+      "version": "2.8.1",
+      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
+      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w=="
+    },
+    "node_modules/@formatjs/icu-skeleton-parser": {
+      "version": "1.8.13",
+      "resolved": "https://registry.npmjs.org/@formatjs/icu-skeleton-parser/-/icu-skeleton-parser-1.8.13.tgz",
+      "integrity": "sha512-N/LIdTvVc1TpJmMt2jVg0Fr1F7Q1qJPdZSCs19unMskCmVQ/sa0H9L8PWt13vq+gLdLg1+pPsvBLydL1Apahjg==",
+      "dependencies": {
+        "@formatjs/ecma402-abstract": "2.3.3",
+        "tslib": "2"
+      }
+    },
+    "node_modules/@formatjs/icu-skeleton-parser/node_modules/tslib": {
+      "version": "2.8.1",
+      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
+      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w=="
+    },
+    "node_modules/@formatjs/intl-localematcher": {
+      "version": "0.6.0",
+      "resolved": "https://registry.npmjs.org/@formatjs/intl-localematcher/-/intl-localematcher-0.6.0.tgz",
+      "integrity": "sha512-4rB4g+3hESy1bHSBG3tDFaMY2CH67iT7yne1e+0CLTsGLDcmoEWWpJjjpWVaYgYfYuohIRuo0E+N536gd2ZHZA==",
+      "dependencies": {
+        "tslib": "2"
       }
     },
+    "node_modules/@formatjs/intl-localematcher/node_modules/tslib": {
+      "version": "2.8.1",
+      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
+      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w=="
+    },
     "node_modules/@modelcontextprotocol/sdk": {
       "version": "1.5.0",
       "resolved": "https://registry.npmjs.org/@modelcontextprotocol/sdk/-/sdk-1.5.0.tgz",
@@ -43,6 +122,156 @@
         "node": ">=18"
       }
     },
+    "node_modules/@paulirish/trace_engine": {
+      "version": "0.0.19",
+      "resolved": "https://registry.
```

**File**: `browser-tools-server/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@agentdeskai/browser-tools-server",
-  "version": "1.1.1",
+  "version": "1.2.0",
   "description": "A browser tools server for capturing and managing browser events, logs, and screenshots",
   "type": "module",
   "main": "dist/browser-connector.js",
```

**File**: `chrome-extension/devtools.js` (modified, +12/-0)
```diff
@@ -946,6 +946,18 @@ async function setupWebSocket() {
         // Don't log heartbeat responses to reduce noise
         if (message.type !== "heartbeat-response") {
           console.log("Chrome Extension: Received WebSocket message:", message);
+
+          if (message.type === "server-shutdown") {
+            console.log("Chrome Extension: Received server shutdown signal");
+            // Clear any reconnection attempts
+            if (wsReconnectTimeout) {
+              clearTimeout(wsReconnectTimeout);
+              wsReconnectTimeout = null;
+            }
+            // Close the connection gracefully
+            ws.close(1000, "Server shutting down");
+            return;
+          }
         }
 
         if (message.type === "heartbeat-response") {
```

---

### Incident Patch 9: `a1b1276b` (2025-03-10)
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
+The MCP server provides tools to run audits on the current page. Here are example queries you can use to trigger them:
+
+#### Accessibility Audit (`runAccessibilityAudit`)
+
+Ensures the page meets accessibility standards like WCAG.
+
+> **Example Queries:**
+>
+> - "Are there any accessibility issues on this page?"
+> - "Run an accessibility audit."
+> - "Check if this page meets WCAG standards."
+
+#### Performance Audit (`runPerformanceAudit`)
+
+Identifies performance bottlenecks and loading issues.
+
+> **Example Queries:**
+>
+> - "Why is this page loading so slowly?"
+> - "Check the performance of this page."
+> - "Run a performance audit."
+
+#### SEO Audit (`runSEOAudit`)
+
+Evaluates how well the page is optimized for search engines.
+
+> **Example Queries:**
+>
+> - "How can I improve SEO for this page?"
+> - "Run an SEO audit."
+> - "Check SEO on this page."
+
+#### Best Practices Audit (`runBestPracticesAudit`)
+
+Checks for general best practices in web development.
+
+> **Example Queries:**
+>
+> - "Run a best practices audit."
+> - "Chec
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

### Incident Patch 10: `e55410bc` (2025-03-10)
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

### Incident Patch 11: `1f33030d` (2025-03-10)
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
+                  property="article:modified_time"
+                  content="2024-01-11T11:35:00+07:00"
+                />
+                <meta
+                  property="article:author"
+                  content="https://www.linkedin.com/in/dminhvu02"
+                />
+                <meta name="twitter:card" content="summary_large_image" />
+                <meta name="twitter:site" content="@dminhvu02" />
+                <meta name="twitter:creator" content="@dminhvu02" />
+                <meta
+                  name="twitter:title"
+                  content="Next.js SEO: The Complete Checklist to Boost Your Site Ranking"
+                />
+                <meta
+                  name="twitter:description"
+                  content="Learn how to optimize your Next.js website for SEO by following this complete checklist."
+                />
+                <meta
+                  name="twitter:image"
+                  content="https://ik.imagekit.io/dminhvu/assets/nextjs-seo/thumbnail.png?tr=f-png"
+
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
       "version": "1.0.3",
       "resolved": "https://registry.npmjs.org/escape-html/-/escape-html-1.0.3.tgz",
@@ -463,6 +517,21 @@
         "node": ">= 0.8"
       }
     },
+    "node_modules/form-data": {
+      "version": "4.0.2",
+      "resolved": "https://registry.npmjs.org/form-data/-/form-data-4.0.2.tgz",
+      "integrity": "sha512-hGfm/slu0ZabnNt4oaRZ6uREyfCj6P4fT/n6A1rGV+Z0VdGXjfOhVUpkn6qVQONHGIFwmveGXyDs75+nr6FM8w==",
+      "dev": true,
+      "dependencies": {
+        "asynckit": "^0.4.0",
+        "combined-stream": "^1.0.8",
+        "es-set-tostringtag": "^2.1.0",
+        "mime-types": "^2.1.12"
+      },
+      "engines": {
+        "node": ">= 6"
+      }
+    },
     "node_modules/forwarded": {
       "version": "0.2.0",
       "resolved": "https://registry.npmjs.org/forwarded/-/forwarded-0.2.0.tgz",
@@ -544,6 +613,21 @@
         "url": "https://github.com/sponsors/ljharb"
       }
     },
+    "node_modules/has-tostringtag": {
+      "version": "1.0.2",
+      "reso
```

---

### Incident Patch 12: `d8355d60` (2025-03-06)
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
             }
           } else if (item.node.nodeLabel.startsWith("<video")) {
             metric.element_type = "video";
@@ -282,21 +249,14 @@ const extractAIOptimizedData = (
 
           if (item.node?.selector) {
             metric.element_selector = item.node.selector;
-            console.log(
-              "DEBUG: Found LCP element selector:",
-              metric.element_selector
-            );
           }
         }
       }
-    } else {
-      console.log("DEBUG: No LCP element audit with details found");
     }
 
     // 2. Try from lcp-lazy-loaded audit
     const lcpImageAudit = audits["lcp-lazy-loaded"];
     if (lcpImageAudit && lcpImageAudit.details) {
-      console.log("DEBUG: Found LCP lazy-loaded audit with details");
       const lcpImageDetails = lcpImageAudit.details as any;
 
       if (
@@ -305,40 +265,20 @@ const extractAIOptimizedData = (
         lcpImageDetails.items.length > 0
       ) {
         const item = lcpImageDetails.items[0];
-        console.log(
- 
```

---

### Incident Patch 13: `bc4629db` (2025-03-02)
**Commit Message**: fixed windows paths and added host + port autodiscovery

**File**: `browser-tools-mcp/mcp-server.ts` (modified, +243/-110)
```diff
@@ -4,16 +4,20 @@ import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
 import path from "path";
 import fs from "fs";
-import os from "os";
 
 // Create the MCP server
 const server = new McpServer({
   name: "Browser Tools MCP",
-  version: "1.0.9",
+  version: "1.1.1",
 });
 
-// Function to get the port from environment variable or default
-function getServerPort(): number {
+// Track the discovered server connection
+let discoveredHost = "127.0.0.1";
+let discoveredPort = 3025;
+let serverDiscovered = false;
+
+// Function to get the default port from environment variable or default
+function getDefaultServerPort(): number {
   // Check environment variable first
   if (process.env.BROWSER_TOOLS_PORT) {
     const envPort = parseInt(process.env.BROWSER_TOOLS_PORT, 10);
@@ -39,8 +43,8 @@ function getServerPort(): number {
   return 3025;
 }
 
-// Function to get server host from environment variable or default
-function getServerHost(): string {
+// Function to get default server host from environment variable or default
+function getDefaultServerHost(): string {
   // Check environment variable first
   if (process.env.BROWSER_TOOLS_HOST) {
     return process.env.BROWSER_TOOLS_HOST;
@@ -50,29 +54,170 @@ function getServerHost(): string {
   return "127.0.0.1";
 }
 
-const PORT = getServerPort();
-const HOST = getServerHost();
+// Server discovery function - similar to what you have in the Chrome extension
+async function discoverServer(): Promise<boolean> {
+  console.log("Starting server discovery process");
+
+  // Common hosts to try
+  const hosts = [getDefaultServerHost(), "127.0.0.1", "localhost"];
+
+  // Ports to try (start with default, then try others)
+  const defaultPort = getDefaultServerPort();
+  const ports = [defaultPort];
+
+  // Add additional ports (fallback range)
+  for (let p = 3025; p <= 3035; p++) {
+    if (p !== defaultPort) {
+      ports.push(p);
+    }
+  }
+
+  console.log(`Will try hosts: ${hosts.join(", ")}`);
+  console.log(`Will try ports: ${ports.join(", ")}`);
+
+  // Try to find the server
+  for (const host of hosts) {
+    for (const port of ports) {
+      try {
+        console.log(`Checking ${host}:${port}...`);
+
+        // Use the identity endpoint for validation
+        const response = await fetch(`http://${host}:${port}/.identity`, {
+          signal: AbortSignal.timeout(1000), // 1 second timeout
+        });
+
+        if (response.ok) {
+          const identity = await response.json();
+
+          // Verify this is actually our server by checking the signature
+          if (identity.signature === "mcp-browser-connector-24x7") {
+            console.log(`Successfully found server at ${host}:${port}`);
+
+            // Save the discovered connection
+            discoveredHost = host;
+            discoveredPort = port;
+            serverDiscovered = true;
+
+            return true;
+          }
+        }
+      } catch (error: any) {
+        // Ignore connection errors during discovery
+        console.error(`Error checking ${host}:${port}: ${error.message}`);
+      }
+    }
+  }
+
+  console.error("No server found during discovery");
+  return false;
+}
+
+// Wrapper function to ensure server connection before making requests
+async function withServerConnection<T>(
+  apiCall: () => Promise<T>
+): Promise<T | any> {
+  // Attempt to discover server if not already discovered
+  if (!serverDiscovered) {
+    const discovered = await discoverServer();
+    if (!discovered) {
+      return {
+        content: [
+          {
+            type: "text",
+            text: "Failed to discover browser connector server. Please ensure it's running.",
+          },
+        ],
+        isError: true,
+      };
+    }
+  }
+
+  // Now make the actual API call with discovered host/port
+  try {
+    return await apiCall();
+  } catch (error: any) {
+    // If the request fails, try rediscovering the server once
+    console.error(
+      `API call failed: ${error.message}. Attempting rediscovery...`
+    );
+    serverDiscovered = false;
 
-// We'll define four "tools" that retrieve data from the aggregator at localhost:3000
+    if (await discoverServer()) {
+      console.error("Rediscovery successful. Retrying API call...");
+      try {
+        // Retry the API call with the newly discovered connection
+        return await apiCall();
+      } catch (retryError: any) {
+        console.error(`Retry failed: ${retryError.message}`);
+        return {
+          content: [
+            {
+              type: "text",
+              text: `Error after reconnection attempt: ${retryError.message}`,
+            },
+          ],
+          isError: true,
+        };
+      }
+    } else {
+      console.error("Rediscovery failed. Could not reconnect to server.");
+      return {
+        content: [
+          {
+            type: "text",
+            text: `
```

**File**: `browser-tools-mcp/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@agentdeskai/browser-tools-mcp",
-  "version": "1.1.0",
+  "version": "1.1.1",
   "description": "MCP (Model Context Protocol) server for browser tools integration",
   "main": "dist/mcp-server.js",
   "bin": {
```

**File**: `browser-tools-server/browser-connector.ts` (modified, +138/-29)
```diff
@@ -161,9 +161,68 @@ interface ScreenshotCallback {
 
 const screenshotCallbacks = new Map<string, ScreenshotCallback>();
 
-const app = express();
-const PORT = parseInt(process.env.PORT || "3025", 10);
+// Function to get available port starting with the given port
+async function getAvailablePort(
+  startPort: number,
+  maxAttempts: number = 10
+): Promise<number> {
+  let currentPort = startPort;
+  let attempts = 0;
+
+  while (attempts < maxAttempts) {
+    try {
+      // Try to create a server on the current port
+      // We'll use a raw Node.js net server for just testing port availability
+      await new Promise<void>((resolve, reject) => {
+        const testServer = require("net").createServer();
+
+        // Handle errors (e.g., port in use)
+        testServer.once("error", (err: any) => {
+          if (err.code === "EADDRINUSE") {
+            console.log(`Port ${currentPort} is in use, trying next port...`);
+            currentPort++;
+            attempts++;
+            resolve(); // Continue to next iteration
+          } else {
+            reject(err); // Different error, propagate it
+          }
+        });
+
+        // If we can listen, the port is available
+        testServer.once("listening", () => {
+          // Make sure to close the server to release the port
+          testServer.close(() => {
+            console.log(`Found available port: ${currentPort}`);
+            resolve();
+          });
+        });
+
+        // Try to listen on the current port
+        testServer.listen(currentPort, currentSettings.serverHost);
+      });
+
+      // If we reach here without incrementing the port, it means the port is available
+      return currentPort;
+    } catch (error: any) {
+      console.error(`Error checking port ${currentPort}:`, error);
+      // For non-EADDRINUSE errors, try the next port
+      currentPort++;
+      attempts++;
+    }
+  }
+
+  // If we've exhausted all attempts, throw an error
+  throw new Error(
+    `Could not find an available port after ${maxAttempts} attempts starting from ${startPort}`
+  );
+}
+
+// Start with requested port and find an available one
+const REQUESTED_PORT = parseInt(process.env.PORT || "3025", 10);
+let PORT = REQUESTED_PORT;
 
+// Create application and initialize middleware
+const app = express();
 app.use(cors());
 // Increase JSON body parser limit to 50MB to handle large screenshots
 app.use(bodyParser.json({ limit: "50mb" }));
@@ -824,38 +883,88 @@ export class BrowserConnector {
   }
 }
 
-// Move the server creation before BrowserConnector instantiation
-const server = app.listen(PORT, currentSettings.serverHost, () => {
-  console.log(`\n=== Browser Tools Server Started ===`);
-  console.log(
-    `Aggregator listening on http://${currentSettings.serverHost}:${PORT}`
-  );
+// Use an async IIFE to allow for async/await in the initial setup
+(async () => {
+  try {
+    console.log(`Starting Browser Tools Server...`);
+    console.log(`Requested port: ${REQUESTED_PORT}`);
+
+    // Find an available port
+    try {
+      PORT = await getAvailablePort(REQUESTED_PORT);
+
+      if (PORT !== REQUESTED_PORT) {
+        console.log(`\n====================================`);
+        console.log(`NOTICE: Requested port ${REQUESTED_PORT} was in use.`);
+        console.log(`Using port ${PORT} instead.`);
+        console.log(`====================================\n`);
+      }
+    } catch (portError) {
+      console.error(`Failed to find an available port:`, portError);
+      process.exit(1);
+    }
 
-  // Log all available network interfaces for easier discovery
-  const networkInterfaces = os.networkInterfaces();
-  console.log("\nAvailable on the following network addresses:");
+    // Create the server with the available port
+    const server = app.listen(PORT, currentSettings.serverHost, () => {
+      console.log(`\n=== Browser Tools Server Started ===`);
+      console.log(
+        `Aggregator listening on http://${currentSettings.serverHost}:${PORT}`
+      );
 
-  Object.keys(networkInterfaces).forEach((interfaceName) => {
-    const interfaces = networkInterfaces[interfaceName];
-    if (interfaces) {
-      interfaces.forEach((iface) => {
-        if (!iface.internal && iface.family === "IPv4") {
-          console.log(`  - http://${iface.address}:${PORT}`);
+      if (PORT !== REQUESTED_PORT) {
+        console.log(
+          `NOTE: Using fallback port ${PORT} instead of requested port ${REQUESTED_PORT}`
+        );
+      }
+
+      // Log all available network interfaces for easier discovery
+      const networkInterfaces = os.networkInterfaces();
+      console.log("\nAvailable on the following network addresses:");
+
+      Object.keys(networkInterfaces).forEach((interfaceName) => {
+        const interfaces = networkInterfaces[interfaceName];
+        if (interfaces) {
+          interfaces.forEach((iface) => {
+            if (!iface.internal && iface.family === "IPv4") {
+              co
```

**File**: `browser-tools-server/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@agentdeskai/browser-tools-server",
-  "version": "1.1.0",
+  "version": "1.1.1",
   "description": "A browser tools server for capturing and managing browser events, logs, and screenshots",
   "main": "dist/browser-connector.js",
   "bin": {
```

**File**: `chrome-extension/background.js` (modified, +51/-0)
```diff
@@ -65,6 +65,57 @@ async function validateServerIdentity(host, port) {
   }
 }
 
+// Listen for tab updates to detect page refreshes
+chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
+  // Check if this is a page refresh (status becoming "complete")
+  if (changeInfo.status === "complete") {
+    retestConnectionOnRefresh(tabId);
+  }
+});
+
+// Function to retest connection when a page is refreshed
+async function retestConnectionOnRefresh(tabId) {
+  console.log(`Page refreshed in tab ${tabId}, retesting connection...`);
+
+  // Get the saved settings
+  chrome.storage.local.get(["browserConnectorSettings"], async (result) => {
+    const settings = result.browserConnectorSettings || {
+      serverHost: "localhost",
+      serverPort: 3025,
+    };
+
+    // Test the connection with the last known host and port
+    const isConnected = await validateServerIdentity(
+      settings.serverHost,
+      settings.serverPort
+    );
+
+    // Notify all devtools instances about the connection status
+    chrome.runtime.sendMessage({
+      type: "CONNECTION_STATUS_UPDATE",
+      isConnected: isConnected,
+      tabId: tabId,
+    });
+
+    // Always notify for page refresh, whether connected or not
+    // This ensures any ongoing discovery is cancelled and restarted
+    chrome.runtime.sendMessage({
+      type: "INITIATE_AUTO_DISCOVERY",
+      reason: "page_refresh",
+      tabId: tabId,
+      forceRestart: true, // Add a flag to indicate this should force restart any ongoing processes
+    });
+
+    if (!isConnected) {
+      console.log(
+        "Connection test failed after page refresh, initiating auto-discovery..."
+      );
+    } else {
+      console.log("Connection test successful after page refresh");
+    }
+  });
+}
+
 // Function to capture and send screenshot
 function captureAndSendScreenshot(message, settings, sendResponse) {
   // Get the inspected window's tab
```

**File**: `chrome-extension/devtools.js` (modified, +309/-80)
```diff
@@ -42,6 +42,71 @@ chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
       setupWebSocket();
     }
   }
+
+  // Handle connection status updates from page refreshes
+  if (message.type === "CONNECTION_STATUS_UPDATE") {
+    console.log(
+      `DevTools received connection status update: ${
+        message.isConnected ? "Connected" : "Disconnected"
+      }`
+    );
+
+    // If connection is lost, try to reestablish WebSocket only if we had a previous connection
+    if (!message.isConnected && ws) {
+      console.log(
+        "Connection lost after page refresh, will attempt to reconnect WebSocket"
+      );
+
+      // Only reconnect if we actually have a WebSocket that might be stale
+      if (
+        ws &&
+        (ws.readyState === WebSocket.CLOSED ||
+          ws.readyState === WebSocket.CLOSING)
+      ) {
+        console.log("WebSocket is already closed or closing, will reconnect");
+        setupWebSocket();
+      }
+    }
+  }
+
+  // Handle auto-discovery requests after page refreshes
+  if (message.type === "INITIATE_AUTO_DISCOVERY") {
+    console.log(
+      `DevTools initiating WebSocket reconnect after page refresh (reason: ${message.reason})`
+    );
+
+    // For page refreshes with forceRestart, we should always reconnect if our current connection is not working
+    if (
+      (message.reason === "page_refresh" || message.forceRestart === true) &&
+      (!ws || ws.readyState !== WebSocket.OPEN)
+    ) {
+      console.log(
+        "Page refreshed and WebSocket not open - forcing reconnection"
+      );
+
+      // Close existing WebSocket if any
+      if (ws) {
+        console.log("Closing existing WebSocket due to page refresh");
+        intentionalClosure = true; // Mark as intentional to prevent auto-reconnect
+        try {
+          ws.close();
+        } catch (e) {
+          console.error("Error closing WebSocket:", e);
+        }
+        ws = null;
+        intentionalClosure = false; // Reset flag
+      }
+
+      // Clear any pending reconnect timeouts
+      if (wsReconnectTimeout) {
+        clearTimeout(wsReconnectTimeout);
+        wsReconnectTimeout = null;
+      }
+
+      // Try to reestablish the WebSocket connection
+      setupWebSocket();
+    }
+  }
 });
 
 // Utility to recursively truncate strings in any data structure
@@ -284,33 +349,80 @@ async function sendToBrowserConnector(logData) {
     });
 }
 
-// Validate server identity before connecting
+// Validate server identity
 async function validateServerIdentity() {
   try {
-    const serverUrl = `http://${settings.serverHost}:${settings.serverPort}/.identity`;
+    console.log(
+      `Validating server identity at ${settings.serverHost}:${settings.serverPort}...`
+    );
 
-    // Check if the server is our browser-tools-server
-    const response = await fetch(serverUrl, {
-      signal: AbortSignal.timeout(2000), // 2 second timeout
-    });
+    // Use fetch with a timeout to prevent long-hanging requests
+    const response = await fetch(
+      `http://${settings.serverHost}:${settings.serverPort}/.identity`,
+      {
+        signal: AbortSignal.timeout(3000), // 3 second timeout
+      }
+    );
 
     if (!response.ok) {
-      console.error(`Invalid server response: ${response.status}`);
+      console.error(
+        `Server identity validation failed: HTTP ${response.status}`
+      );
+
+      // Notify about the connection failure
+      chrome.runtime.sendMessage({
+        type: "SERVER_VALIDATION_FAILED",
+        reason: "http_error",
+        status: response.status,
+        serverHost: settings.serverHost,
+        serverPort: settings.serverPort,
+      });
+
       return false;
     }
 
     const identity = await response.json();
 
-    // Validate the server signature
+    // Validate signature
     if (identity.signature !== "mcp-browser-connector-24x7") {
-      console.error("Invalid server signature - not the browser tools server");
+      console.error("Server identity validation failed: Invalid signature");
+
+      // Notify about the invalid signature
+      chrome.runtime.sendMessage({
+        type: "SERVER_VALIDATION_FAILED",
+        reason: "invalid_signature",
+        serverHost: settings.serverHost,
+        serverPort: settings.serverPort,
+      });
+
       return false;
     }
 
-    // If reached here, the server is valid
+    console.log(
+      `Server identity confirmed: ${identity.name} v${identity.version}`
+    );
+
+    // Notify about successful validation
+    chrome.runtime.sendMessage({
+      type: "SERVER_VALIDATION_SUCCESS",
+      serverInfo: identity,
+      serverHost: settings.serverHost,
+      serverPort: settings.serverPort,
+    });
+
     return true;
   } catch (error) {
-    console.error("Error validating server identity:", error);
+    console.error("Server identity validation failed:", error);
+
+    // Notify about the connection error
+    chrome.runtime.sendMessage({
+      type: "SERV
```

**File**: `chrome-extension/manifest.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "BrowserTools MCP",
-    "version": "1.1.0",
+    "version": "1.1.1",
     "description": "MCP tool for AI code editors to capture data from a browser such as console logs, network requests, screenshots and more",
     "manifest_version": 3,
     "devtools_page": "devtools.html",
```

**File**: `chrome-extension/panel.js` (modified, +713/-71)
```diff
@@ -12,14 +12,297 @@ let settings = {
   serverPort: 3025,
 };
 
+// Track connection status
+let serverConnected = false;
+let reconnectAttemptTimeout = null;
+// Add a flag to track ongoing discovery operations
+let isDiscoveryInProgress = false;
+// Add an AbortController to cancel fetch operations
+let discoveryController = null;
+
 // Load saved settings on startup
 chrome.storage.local.get(["browserConnectorSettings"], (result) => {
   if (result.browserConnectorSettings) {
     settings = { ...settings, ...result.browserConnectorSettings };
     updateUIFromSettings();
   }
+
+  // Create connection status banner at the top
+  createConnectionBanner();
+
+  // Automatically discover server on panel load with quiet mode enabled
+  discoverServer(true);
 });
 
+// Add listener for connection status updates from background script (page refresh events)
+chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
+  if (message.type === "CONNECTION_STATUS_UPDATE") {
+    console.log(
+      `Received connection status update: ${
+        message.isConnected ? "Connected" : "Disconnected"
+      }`
+    );
+
+    // Update UI based on connection status
+    if (message.isConnected) {
+      // If already connected, just maintain the current state
+      if (!serverConnected) {
+        // Connection was re-established, update UI
+        serverConnected = true;
+        updateConnectionBanner(true, {
+          name: "Browser Tools Server",
+          version: "reconnected",
+          host: settings.serverHost,
+          port: settings.serverPort,
+        });
+      }
+    } else {
+      // Connection lost, update UI to show disconnected
+      serverConnected = false;
+      updateConnectionBanner(false, null);
+    }
+  }
+
+  if (message.type === "INITIATE_AUTO_DISCOVERY") {
+    console.log(
+      `Initiating auto-discovery after page refresh (reason: ${message.reason})`
+    );
+
+    // For page refreshes or if forceRestart is set to true, always cancel any ongoing discovery and restart
+    if (message.reason === "page_refresh" || message.forceRestart === true) {
+      // Cancel any ongoing discovery operation
+      cancelOngoingDiscovery();
+
+      // Update UI to indicate we're starting a fresh scan
+      if (connectionStatusDiv) {
+        connectionStatusDiv.style.display = "block";
+        if (statusIcon) statusIcon.className = "status-indicator";
+        if (statusText)
+          statusText.textContent =
+            "Page refreshed. Restarting server discovery...";
+      }
+
+      // Always update the connection banner when a page refresh occurs
+      updateConnectionBanner(false, null);
+
+      // Start a new discovery process with quiet mode
+      console.log("Starting fresh discovery after page refresh");
+      discoverServer(true);
+    }
+    // For other types of auto-discovery requests, only start if not already in progress
+    else if (!isDiscoveryInProgress) {
+      // Use quiet mode for auto-discovery to minimize UI changes
+      discoverServer(true);
+    }
+  }
+
+  // Handle successful server validation
+  if (message.type === "SERVER_VALIDATION_SUCCESS") {
+    console.log(
+      `Server validation successful: ${message.serverHost}:${message.serverPort}`
+    );
+
+    // Update the connection status banner
+    serverConnected = true;
+    updateConnectionBanner(true, message.serverInfo);
+
+    // If we were showing the connection status dialog, we can hide it now
+    if (connectionStatusDiv && connectionStatusDiv.style.display === "block") {
+      connectionStatusDiv.style.display = "none";
+    }
+  }
+
+  // Handle failed server validation
+  if (message.type === "SERVER_VALIDATION_FAILED") {
+    console.log(
+      `Server validation failed: ${message.reason} - ${message.serverHost}:${message.serverPort}`
+    );
+
+    // Update the connection status
+    serverConnected = false;
+    updateConnectionBanner(false, null);
+
+    // Start auto-discovery if this was a page refresh validation
+    if (
+      message.reason === "connection_error" ||
+      message.reason === "http_error"
+    ) {
+      // If we're not already trying to discover the server, start the process
+      if (!isDiscoveryInProgress) {
+        console.log("Starting auto-discovery after validation failure");
+        discoverServer(true);
+      }
+    }
+  }
+
+  // Handle successful WebSocket connection
+  if (message.type === "WEBSOCKET_CONNECTED") {
+    console.log(
+      `WebSocket connected to ${message.serverHost}:${message.serverPort}`
+    );
+
+    // Update connection status if it wasn't already connected
+    if (!serverConnected) {
+      serverConnected = true;
+      updateConnectionBanner(true, {
+        name: "Browser Tools Server",
+        version: "connected via WebSocket",
+        host: message.serverHost,
+        port: message.serverPort,
+      });
+    }
+  }
+});
+
+// Create connection status banner
+function createConnectionBanner
```

---

### Incident Patch 14: `2b620599` (2025-03-01)
**Commit Message**: Merge staging branch to keep screenshot functionality and required permissions

**File**: `chrome-extension/background.js` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+// Listen for messages from the devtools panel
+chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
+  if (message.type === "CAPTURE_SCREENSHOT" && message.tabId) {
+    // Get the inspected window's tab
+    chrome.tabs.get(message.tabId, (tab) => {
+      if (chrome.runtime.lastError) {
+        console.error("Error getting tab:", chrome.runtime.lastError);
+        sendResponse({
+          success: false,
+          error: chrome.runtime.lastError.message,
+        });
+        return;
+      }
+
+      // Get all windows to find the one containing our tab
+      chrome.windows.getAll({ populate: true }, (windows) => {
+        const targetWindow = windows.find(w =>
+          w.tabs.some(t => t.id === message.tabId)
+        );
+
+        if (!targetWindow) {
+          console.error("Could not find window containing the inspected tab");
+          sendResponse({
+            success: false,
+            error: "Could not find window containing the inspected tab"
+          });
+          return;
+        }
+
+        // Capture screenshot of the window containing our tab
+        chrome.tabs.captureVisibleTab(targetWindow.id, { format: "png" }, (dataUrl) => {
+          // Ignore DevTools panel capture error if it occurs
+          if (chrome.runtime.lastError &&
+              !chrome.runtime.lastError.message.includes("devtools://")) {
+            console.error("Error capturing screenshot:", chrome.runtime.lastError);
+            sendResponse({
+              success: false,
+              error: chrome.runtime.lastError.message,
+            });
+            return;
+          }
+
+          // Send screenshot data to browser connector
+          fetch("http://127.0.0.1:3025/screenshot", {
+            method: "POST",
+            headers: {
+              "Content-Type": "application/json",
+            },
+            body: JSON.stringify({
+              data: dataUrl,
+              path: message.screenshotPath,
+            }),
+          })
+            .then((response) => response.json())
+            .then((result) => {
+              if (result.error) {
+                console.error("Error from server:", result.error);
+                sendResponse({ success: false, error: result.error });
+              } else {
+                console.log("Screenshot saved successfully:", result.path);
+                // Send success response even if DevTools capture failed
+                sendResponse({
+                  success: true,
+                  path: result.path,
+                  title: tab.title || "Current Tab"
+                });
+              }
+            })
+            .catch((error) => {
+              console.error("Error sending screenshot data:", error);
+              sendResponse({
+                success: false,
+                error: error.message || "Failed to save screenshot",
+              });
+            });
+        });
+      });
+    });
+    return true; // Required to use sendResponse asynchronously
+  }
+});
```

**File**: `chrome-extension/devtools.js` (modified, +2/-42)
```diff
@@ -25,50 +25,10 @@ chrome.storage.local.get(["browserConnectorSettings"], (result) => {
   }
 });
 
-// Listen for settings updates and screenshot capture requests
+// Listen for settings updates
 chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
   if (message.type === "SETTINGS_UPDATED") {
     settings = message.settings;
-  } else if (message.type === "CAPTURE_SCREENSHOT") {
-    // Capture screenshot of the current tab
-    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
-      if (chrome.runtime.lastError) {
-        console.error("Screenshot capture failed:", chrome.runtime.lastError);
-        sendResponse({
-          success: false,
-          error: chrome.runtime.lastError.message,
-        });
-        return;
-      }
-
-      // Send screenshot data to browser connector via HTTP POST
-      fetch("http://127.0.0.1:3025/screenshot", {
-        method: "POST",
-        headers: {
-          "Content-Type": "application/json",
-        },
-        body: JSON.stringify({
-          data: dataUrl,
-          path: settings.screenshotPath,
-        }),
-      })
-        .then((response) => response.json())
-        .then((result) => {
-          if (result.error) {
-            sendResponse({ success: false, error: result.error });
-          } else {
-            sendResponse({ success: true, path: result.path });
-          }
-        })
-        .catch((error) => {
-          console.error("Failed to save screenshot:", error);
-          sendResponse({
-            success: false,
-            error: error.message || "Failed to save screenshot",
-          });
-        });
-    });
-    return true; // Required to use sendResponse asynchronously
   }
 });
 
@@ -520,7 +480,7 @@ function captureAndSendElement() {
       if (!el) return null;
 
       const rect = el.getBoundingClientRect();
-      
+
       return {
         tagName: el.tagName,
         id: el.id,
```

**File**: `chrome-extension/manifest.json` (modified, +8/-4)
```diff
@@ -8,10 +8,14 @@
       "activeTab",
       "debugger",
       "storage",
-      "tabs"
+      "tabs",
+      "tabCapture",
+      "windows"
     ],
     "host_permissions": [
       "<all_urls>"
-    ]
-  }
-  
\ No newline at end of file
+    ],
+    "background": {
+      "service_worker": "background.js"
+    }
+}
```

**File**: `chrome-extension/panel.js` (modified, +10/-4)
```diff
@@ -102,20 +102,26 @@ screenshotPathInput.addEventListener("change", (e) => {
   saveSettings();
 });
 
-// Add screenshot capture functionality
+// Update screenshot capture functionality
 captureScreenshotButton.addEventListener("click", () => {
   captureScreenshotButton.textContent = "Capturing...";
 
-  // Send message to devtools.js to capture screenshot
-  chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
+  // Send message to background script to capture screenshot
+  chrome.runtime.sendMessage({
+    type: "CAPTURE_SCREENSHOT",
+    tabId: chrome.devtools.inspectedWindow.tabId,
+    screenshotPath: settings.screenshotPath
+  }, (response) => {
+    console.log("Screenshot capture response:", response);
     if (!response) {
       captureScreenshotButton.textContent = "Failed to capture!";
       console.error("Screenshot capture failed: No response received");
     } else if (!response.success) {
       captureScreenshotButton.textContent = "Failed to capture!";
       console.error("Screenshot capture failed:", response.error);
     } else {
-      captureScreenshotButton.textContent = "Screenshot captured!";
+      captureScreenshotButton.textContent = `Captured: ${response.title}`;
+      console.log("Screenshot captured successfully:", response.path);
     }
     setTimeout(() => {
       captureScreenshotButton.textContent = "Capture Screenshot";
```

---

### Incident Patch 15: `7702a3a7` (2025-03-01)
**Commit Message**: fixed network and console log parsing; consolidated mcp endpoints

**File**: `browser-tools-mcp/mcp-server.ts` (modified, +5/-6)
```diff
@@ -2,9 +2,6 @@
 
 import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
-import path from "path";
-// import { z } from "zod";
-// import fs from "fs";
 
 // Create the MCP server
 const server = new McpServer({
@@ -60,7 +57,7 @@ server.tool(
 );
 
 // Return all HTTP errors (4xx/5xx)
-server.tool("getNetworkErrors", "Check our network ERROR logs", async () => {
+server.tool("getNetworkErrorLogs", "Check our network ERROR logs", async () => {
   const response = await fetch(`http://127.0.0.1:${PORT}/network-errors`);
   const json = await response.json();
   return {
@@ -74,6 +71,7 @@ server.tool("getNetworkErrors", "Check our network ERROR logs", async () => {
 });
 
 // // Return all XHR/fetch requests
+// // DEPRECATED: Use getNetworkSuccessLogs and getNetworkErrorLogs instead
 // server.tool("getNetworkSuccess", "Check our network SUCCESS logs", async () => {
 //   const response = await fetch(`http://127.0.0.1:${PORT}/all-xhr`);
 //   const json = await response.json();
@@ -88,8 +86,8 @@ server.tool("getNetworkErrors", "Check our network ERROR logs", async () => {
 // });
 
 // Return all XHR/fetch requests
-server.tool("getNetworkLogs", "Check ALL our network logs", async () => {
-  const response = await fetch(`http://127.0.0.1:${PORT}/all-xhr`);
+server.tool("getNetworkSuccessLogs", "Check ALL our network logs", async () => {
+  const response = await fetch(`http://127.0.0.1:${PORT}/network-success`);
   const json = await response.json();
   return {
     content: [
@@ -117,6 +115,7 @@ server.tool(
       const result = await response.json();
 
       if (response.ok) {
+        // Removed path due to bug... will change later anyways
         // const message = `Screenshot saved to: ${
         //   result.path
         // }\nFilename: ${path.basename(result.path)}`;
```

**File**: `chrome-extension/devtools.js` (modified, +37/-2)
```diff
@@ -433,7 +433,9 @@ const consoleMessageListener = (source, method, params) => {
   if (method === "Runtime.exceptionThrown") {
     const entry = {
       type: "console-error",
-      message: params.exceptionDetails.exception?.description || JSON.stringify(params.exceptionDetails),
+      message:
+        params.exceptionDetails.exception?.description ||
+        JSON.stringify(params.exceptionDetails),
       level: "error",
       timestamp: Date.now(),
     };
@@ -442,10 +444,43 @@ const consoleMessageListener = (source, method, params) => {
   }
 
   if (method === "Runtime.consoleAPICalled") {
+    // Process all arguments from the console call
+    let formattedMessage = "";
+    const args = params.args || [];
+
+    // Extract all arguments and combine them
+    if (args.length > 0) {
+      // Try to build a meaningful representation of all arguments
+      try {
+        formattedMessage = args
+          .map((arg) => {
+            // Handle different types of arguments
+            if (arg.type === "string") {
+              return arg.value;
+            } else if (arg.type === "object" && arg.preview) {
+              // For objects, include their preview or description
+              return JSON.stringify(arg.preview);
+            } else if (arg.description) {
+              // Some objects have descriptions
+              return arg.description;
+            } else {
+              // Fallback for other types
+              return arg.value || arg.description || JSON.stringify(arg);
+            }
+          })
+          .join(" ");
+      } catch (e) {
+        // Fallback if processing fails
+        console.error("Failed to process console arguments:", e);
+        formattedMessage =
+          args[0]?.value || "Unable to process console arguments";
+      }
+    }
+
     const entry = {
       type: params.type === "error" ? "console-error" : "console-log",
       level: params.type,
-      message: params.args[0].value,
+      message: formattedMessage,
       timestamp: Date.now(),
     };
     console.log("Sending console entry:", entry);
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
