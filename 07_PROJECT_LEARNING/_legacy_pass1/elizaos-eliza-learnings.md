# Forensic Learning Record (Deep Inspection): elizaOS/eliza

> **Canonical Artifact**: `07_PROJECT_LEARNING/elizaos-eliza-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/elizaos/eliza](https://github.com/elizaos/eliza))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T17:44:29.589Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `elizaOS/eliza`
- **Description**: Open source agentic operating system
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 19541 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/agent/native-host/account-state.mjs`
```
import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
/** A credential rotation intentionally starts a fresh private memory namespace. */
export function runtimeAccountState(root, credential, profile) {
  if (profile && !/^[a-z][a-z0-9-]{0,47}$/.test(profile))
    throw new Error("Invalid runtime profile");
  const fingerprint = credential
    ? createHash("sha256").update(credential).digest("hex")
    : null;
  const account = join(
    root,
    "agent",
    "accounts",
    fingerprint ? `cloud-${fingerprint}` : "local",
  );
  return {
    fingerprint,
    state: profile ? join(account, "profiles", profile) : account,
  };
}
export async function prepareRuntimeAccountState(root, credential, profile) {
  const selected = runtimeAccountState(root, credential, profile);
  await mkdir(selected.state, { recursive: true, mode: 0o700 });
  await chmod(selected.state, 0o700);
  return selected;
}

export async function scrubRuntimeCredentialConfigs(root, credential) {
  if (!credential) return;
  const accounts = join(root, "agent", "accounts");
  let entries;
  try {
    entries = await readdir(accounts, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const scrub = (value) =>
    typeof value === "string" && value === credential
      ? undefined
      : Array.isArray(value)
        ? value.map(scrub)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).flatMap(([key, item]) => {
                const next = scrub(item);
                return next === undefined ? [] : [[key, next]];
              }),
            )
          : value;
  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      !/^(?:local|cloud-[0-9a-f]{64})$/.test(entry.name)
    )
      continue;
    const directories = [join(accounts, entry.name)];
    try {
      for (const profile of await readdir(
        join(accounts, entry.name, "profiles"),
        { withFileTypes: true },
      )) {
        if (
          profile.isDirectory() &&
          /^[a-z][a-z0-9-]{0,47}$/.test(profile.name)
        )
          directories.push(
            join(accounts, entry.name, "profiles", profile.name),
          );
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    for (const directory of directories)
      for (const name of [
        "config.json",
        "launch-config.json",
        "eliza.config-overlay.json",
      ]) {
        const file = join(directory, name);
        let stat;
        try {
          stat = await lstat(file);
        } catch (error) {
          if (error.code === "ENOENT") continue;
          throw error;
        }
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024)
          throw new Error("Cannot safely migrate account configuration");
        const previous = JSON.parse(await readFile(file, "utf8"));
        const clean = scrub(previous);
        if (JSON.stringify(previous) === JSON.stringify(clean)) continue;
        const temporary =
          file + ".credential-migration-" + randomBytes(8).toString("hex");
        await writeFile(temporary, JSON.stringify(clean, null, 2), {
          mode: 0o600,
          flag: "wx",
        });
        await rename(temporary, file);
      }
  }
}

```

### Core Architecture Module: `packages/agent/src/api/agent-lifecycle-routes.ts`
```
/**
 * Mounts the agent lifecycle HTTP routes on the shared route state: POST
 * /api/agent/{start,stop,pause,resume} drive the reported agent-state machine
 * (running/paused/stopped) and its uptime/startedAt, while GET /api/agent/autonomy
 * reads and POST /api/agent/autonomy toggles the autonomy loop — the POST
 * validates its body, calls enable/disableAutonomy on the AUTONOMY_SERVICE_TYPE
 * service when present, and always syncs runtime.enableAutonomy. Sits behind the
 * authenticated dashboard gate; not public.
 *
 * With no live runtime, POST /api/agent/start is a real boot request, not a
 * flag flip: it boots through the host's injected `onRestart` — the same
 * closure POST /api/agent/restart uses, which app's fresh-install
 * deferral funnels into a single-flight boot. Reporting "running" with a null
 * runtime would be fake-ready: a host that cannot boot answers 503, and a
 * failed boot answers 500 with the reported state flipped to "error".
 */

import { PostAgentAutonomyRequestSchema } from "@elizaos/contracts";
import type { AgentRuntime } from "@elizaos/core";
import type { RouteHelpers, RouteRequestMeta } from "@elizaos/host/protocol";

import { AUTONOMY_SERVICE_TYPE } from "@elizaos/plugin-assistant";
import { detectRuntimeModel } from "./agent-model.ts";

type AgentStateStatus =
  | "not_started"
  | "starting"
  | "running"
  | "paused"
  | "stopped"
  | "restarting"
  | "error";

export interface AgentLifecycleRouteState {
  runtime: AgentRuntime | null;
  agentState: AgentStateStatus;
  agentName: string;
  model: string | undefined;
  startedAt: number | undefined;
}

export interface AgentLifecycleRouteContext
  extends RouteRequestMeta,
    Pick<RouteHelpers, "error" | "json" | "readJsonBody"> {
  state: AgentLifecycleRouteState;
  /**
   * Boots (or reboots) a runtime in-process. Injected by hosts that own a
   * boot path (server-only startEliza, dev supervisor); absent on hosts that
   * cannot boot, where a start request with no runtime must fail honestly.
   */
  onRestart?: (() => Promise<AgentRuntime | null>) | undefined;
  /** Post-swap rewiring (streams, model broadcast) — mirrors the restart route. */
  onRuntimeSwapped?: (() => void) | undefined;
  onRuntimeActivated?:
    | ((
        previousRuntime: AgentRuntime | null,
        activeRuntime: AgentRuntime,
      ) => void | Promise<void>)
    | undefined;
}

type AutonomyToggleService = {
  enableAutonomy(): Promise<void>;
  disableAutonomy(): Promise<void>;
};

function isAutonomyToggleService(
  service: unknown,
): service is AutonomyToggleService {
  return (
    typeof service === "object" &&
    service !== null &&
    typeof (service as { enableAutonomy?: unknown }).enableAutonomy ===
      "function" &&
    typeof (service as { disableAutonomy?: unknown }).disableAutonomy ===
      "function"
  );
}

export async function handleAgentLifecycleRoutes(
  ctx: AgentLifecycleRouteContext,
): Promise<boolean> {
  const { req, res, method, pathname, state, error, json, readJsonBody } = ctx;
  const runtime = state.runtime as
    | (AgentRuntime & { enableAutonomy?: boolean })
    | null;

  if (method === "POST" && pathname === "/api/agent/start") {
    if (!state.runtime) {
      // A boot is already underway (parallel-bind warming window, an
      // in-flight restart, or the deferred fresh-install boot): starting is
      // idempotent — report the in-progress state and let the client poll
      // /api/status instead of racing a second boot.
      if (
        state.agentState === "starting" ||
        state.agentState === "restarting"
      ) {
        json(res, {
          ok: true,
          status: {
            state: state.agentState,
            agentName: state.agentName,
            model: state.model,
            startedAt: state.startedAt,
          },
        });
        return true;
      }
      if (!ctx.onRestart) {
        error(
          res,
          "Agent runtime is not available and this server cannot boot one on demand",
          503,
        );
        return true;
      }
      state.agentState = "starting";
      state.startedAt = Date.now();
      try {
        const previousRuntime = state.runtime;
        const booted = await ctx.onRestart();
        if (!booted) {
          state.agentState = "error";
          state.startedAt = undefined;
          error(res, "Agent start failed — runtime did not initialize", 500);
          return true;
        }
        state.runtime = booted;
        state.agentState = "running";
        state.agentName = booted.character.name ?? state.agentName;
        state.model = detectRuntimeModel(booted);
        state.startedAt = Date.now();
        ctx.onRuntimeSwapped?.();
        await ctx.onRuntimeActivated?.(previousRuntime, booted);
      } catch (err) {
        // error-policy:J1 boundary translation — the boot failure becomes a
        // structured 500 + reported state "error"; never a fake "running".
        state.agentState = "error";
        state.startedAt = undefined;
        error(
          res,
          `Agent start failed: ${err instanceof Error ? err.message : String(err)}`,
          500,
        );
        return true;
      }
    } else {
      state.agentState = "running";
      state.startedAt = Date.now();
      state.model = detectRuntimeModel(state.runtime);
    }

    json(res, {
      ok: true,
      status: {
        state: state.agentState,
        agentName: state.agentName,
        model: state.model,
        uptime: 0,
        startedAt: state.startedAt,
      },
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/agent/stop") {
    state.agentState = "stopped";
    state.startedAt = undefined;
    state.model = undefined;
    json(res, {
      ok: true,
      status: { state: state.agentState, agentName: state.agentName },
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/agent/pause") {
    state.agentState = "paused";
    json(res, {
      ok: true,
      status: {
        state: state.agentState,
        agentName: state.agentName,
        model: state.model,
        uptime: state.startedAt ? Date.now() - state.startedAt : undefined,
        startedAt: state.startedAt,
      },
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/agent/resume") {
    state.agentState = "running";
    json(res, {
      ok: true,
      status: {
        state: state.agentState,
        agentName: state.agentName,
        model: state.model,
        uptime: state.startedAt ? Date.now() - state.startedAt : undefined,
        startedAt: state.startedAt,
      },
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/agent/autonomy") {
    json(res, { enabled: runtime?.enableAutonomy === true });
    return true;
  }

  if (method === "POST" && pathname === "/api/agent/autonomy") {
    const rawAuto = await readJsonBody<Record<string, unknown>>(req, res);
    if (rawAuto === null) return true;
    const parsedAuto = PostAgentAutonomyRequestSchema.safeParse(rawAuto);
    if (!parsedAuto.success) {
      error(
        res,
        parsedAuto.error.issues[0]?.message ?? "enabled must be a boolean",
        400,
      );
      return true;
    }
    const enabled = parsedAuto.data.enabled;

    if (!runtime) {
      error(res, "Agent runtime is not available", 503);
      return true;
    }

    // Set the property AND call the service method so the batcher
    // section is actually registered/unregistered.
    const autonomySvc = runtime.getService(AUTONOMY_SERVICE_TYPE);
    if (isAutonomyToggleService(autonomySvc)) {
      if (enabled) {
        await autonomySvc.enableAutonomy();
      } else {
        await autonomySvc.disableAutonomy();
      }
    }
    // Always sync the property — enableAutonomy()/disableAutonomy() set it
    // internally, but if the service path wasn't taken, set it directly.
    runtime.enableAutonomy = enabled;
    json(res, { enabled: runtime.enableAutonomy === true });
    return true;
  }

  return false;
}

```

### Core Architecture Module: `packages/agent/src/api/compat-utils.ts`
```
/**
 * Pure helpers for the OpenAI- and Anthropic-compatible chat endpoints: flatten
 * a message `content` field (string, part arrays, or `{ text }` objects) to
 * plain text, collapse a request's `messages` to the joined system/developer
 * prompt plus the last user turn (so stateless clients that resend full history
 * do not duplicate server-side room memory), and resolve a stable room key from
 * whichever conversation identifier the client supplied. No I/O — the compat
 * route modules call these to normalize inbound bodies.
 */
import { createHash } from "node:crypto";
import { asObjectRecord as asRecord } from "@elizaos/core";

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Extract a best-effort text string from OpenAI/Anthropic "content" fields.
 * Supports:
 * - string
 * - array of parts: [{ type: "text", text: "..." }, ...]
 * - objects with a `text` string field
 */
export function extractCompatTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const chunks: string[] = [];
    for (const item of content) {
      const obj = asRecord(item);
      if (!obj) continue;
      const type = readString(obj.type);
      if (type && type !== "text") continue;
      const text = readString(obj.text);
      if (text) chunks.push(text);
    }
    return chunks.join("");
  }
  const obj = asRecord(content);
  if (obj) return readString(obj.text);
  return "";
}

export type OpenAiChatRole =
  | "system"
  | "developer"
  | "user"
  | "assistant"
  | "tool"
  | "function";

export interface OpenAiChatMessage {
  role: OpenAiChatRole;
  content?: unknown;
}

/**
 * For OpenAI-compatible requests, we intentionally reduce "messages" to:
 * - all system/developer messages (joined)
 * - the last user message
 *
 * This keeps the server-side room memory coherent (so stateless clients that
 * resend full history do not cause runaway duplication).
 */
export function extractOpenAiSystemAndLastUser(
  messages: unknown,
): { system: string; user: string } | null {
  if (!Array.isArray(messages)) return null;

  let system = "";
  let user = "";

  for (const item of messages) {
    const msg = asRecord(item);
    if (!msg) continue;
    const role = readString(msg.role) as OpenAiChatRole;
    const contentText = extractCompatTextContent(msg.content);
    if (!contentText.trim()) continue;

    if (role === "system" || role === "developer") {
      system = system
        ? `${system}\n\n${contentText.trim()}`
        : contentText.trim();
      continue;
    }
    if (role === "user") {
      user = contentText.trim();
    }
  }

  if (!user) return null;
  return { system, user };
}

export type AnthropicRole = "user" | "assistant";

export interface AnthropicMessage {
  role: AnthropicRole;
  content?: unknown;
}

export function extractAnthropicSystemAndLastUser(args: {
  system?: unknown;
  messages: unknown;
}): { system: string; user: string } | null {
  if (!Array.isArray(args.messages)) return null;

  const system = readString(args.system).trim();
  let user = "";

  for (const item of args.messages) {
    const msg = asRecord(item);
    if (!msg) continue;
    const role = readString(msg.role) as AnthropicRole;
    if (role !== "user") continue;
    const contentText = extractCompatTextContent(msg.content);
    if (!contentText.trim()) continue;
    user = contentText.trim();
  }

  if (!user) return null;
  return { system, user };
}

function readNestedString(
  obj: Record<string, unknown>,
  key: string,
): string | null {
  const raw = obj[key];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

/**
 * Resolve a stable room key for compatibility endpoints so manual testing can
 * keep conversation memory when the client provides an identifier.
 *
 * We accept a few common fields without requiring any one client:
 * - OpenAI: body.user (string)
 * - OpenAI: body.metadata.conversation_id
 * - Anthropic: body.metadata.user_id
 * - Anthropic: body.metadata.conversation_id
 */
export function resolveCompatRoomKey(
  body: Record<string, unknown>,
  fallback = "default",
): string {
  const direct = readNestedString(body, "user");
  if (direct) return direct;

  const metadata = asRecord(body.metadata);
  if (metadata) {
    const conv =
      readNestedString(metadata, "conversation_id") ??
      readNestedString(metadata, "conversationId");
    if (conv) return conv;
    const userId = readNestedString(metadata, "user_id");
    if (userId) return userId;
  }

  return fallback;
}

/**
 * Maximum client-supplied conversation-key length embedded verbatim in the
 * room-UUID derivation.
 */
export const COMPAT_ROOM_KEY_MAX_LENGTH = 120;

/**
 * Scope a resolved conversation key for the room-UUID derivation without
 * aliasing distinct conversations onto one room.
 *
 * The derivation hashes whatever string it receives, so truncating a longer
 * key to {@link COMPAT_ROOM_KEY_MAX_LENGTH} made any two identifiers sharing a
 * 120-char prefix — JWT-style ids, path-like conversation keys — derive the
 * same roomId and silently share one conversation's memory. Keys within the
 * limit keep their exact historical derivation; longer keys are prefixed with
 * the complete SHA-256 digest of the full key, giving the room derivation a
 * collision-resistant scope. Rooms created before this fix from a >120-char
 * key are not reachable under the new derivation by design: they were already
 * merged with any prefix-sharing sibling.
 */
export function scopeCompatRoomKey(rawKey: string): string {
  if (rawKey.length <= COMPAT_ROOM_KEY_MAX_LENGTH) return rawKey;
  const digest = createHash("sha256").update(rawKey, "utf8").digest("hex");
  return `sha256:${digest}`;
}

```

### Core Architecture Module: `packages/agent/src/api/config-state.ts`
```
/** Keeps live configuration references aligned with committed durable state. */
import type { ElizaConfig } from "@elizaos/host/protocol";

/** Replace a live config in place so references held by callers stay valid. */
export function replaceConfigInPlace(
  state: ElizaConfig,
  next: ElizaConfig,
): void {
  const stateRecord = state as ElizaConfig & Record<string, unknown>;
  const nextRecord = next as ElizaConfig & Record<string, unknown>;
  for (const key of Object.keys(stateRecord)) {
    if (!(key in nextRecord)) {
      delete stateRecord[key];
    }
  }
  for (const [key, value] of Object.entries(nextRecord)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    stateRecord[key] = value;
  }
}

```

### Core Architecture Module: `packages/agent/src/api/loopback-trust.ts`
```
/** Agent host environment policy for strict same-machine request classification. */

import { isTrustedLocalRequest as classifyLocalRequest } from "@elizaos/core";
import { readAliasedEnv } from "@elizaos/host/protocol";

import { isCloudProvisionedContainer } from "@elizaos/plugin-elizacloud/cloud-config/cloud-provisioning";

export {
  isLoopbackRemoteAddress,
  isRemoteAddressInCidrList,
  proxyClientHeaderBlocksLocalTrust,
} from "@elizaos/core";
export interface LoopbackTrustOptions {
  /**
   * When true, deny local trust if `ELIZA_REQUIRE_LOCAL_AUTH === "1"`. On-device
   * local agents (Android) set this flag alongside a per-boot API token because
   * the loopback interface is shared with every other app on the device, so
   * loopback alone is NOT a trust signal there.
   */
  requireLocalAuthEnv: boolean;
  /**
   * When true, `ELIZA_DEV_AUTH_BYPASS === "1"` in a development `NODE_ENV`
   * overrides {@link requireLocalAuthEnv}, restoring local trust for the dev
   * dashboard. Only app honours this; the agent never does.
   */
  devAuthBypassEnv: boolean;
  /**
   * Cloud-container detection strategy. `"env"` trusts the raw
   * `ELIZA_CLOUD_PROVISIONED` flag; `"container"` requires the flag AND a
   * provisioning token (see {@link isCloudProvisionedContainer}). These are
   * DIFFERENT semantics — do not swap them between consumers.
   */
  cloudCheck: "env" | "container";
}

function cloudBlocksLocalTrust(cloudCheck: "env" | "container"): boolean {
  if (cloudCheck === "container") return isCloudProvisionedContainer();
  return readAliasedEnv("ELIZA_CLOUD_PROVISIONED") === "1";
}

function localAuthRequired(options: LoopbackTrustOptions): boolean {
  if (!options.requireLocalAuthEnv) return false;
  if (
    options.devAuthBypassEnv &&
    process.env.ELIZA_DEV_AUTH_BYPASS === "1" &&
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev")
  ) {
    return false;
  }
  return process.env.ELIZA_REQUIRE_LOCAL_AUTH === "1";
}

export function isTrustedLocalRequest(
  req: Parameters<typeof classifyLocalRequest>[0],
  options: LoopbackTrustOptions,
): boolean {
  return classifyLocalRequest(req, {
    localAuthRequired: localAuthRequired(options),
    cloudProvisioned: cloudBlocksLocalTrust(options.cloudCheck),
  });
}

```

### Core Architecture Module: `packages/agent/src/api/server-state.ts`
```
/**
 * Constructs the mutable state shared by agent API route adapters. Keeping the
 * initialization contract separate from the HTTP listener makes first-run,
 * runtime-backed, and stopped-server states deterministic and testable.
 */
import type { AgentAutomationMode, AgentRuntime } from "@elizaos/core";
import type { ElizaConfig } from "@elizaos/host/protocol";
import type { PluginEntry, ServerState } from "./server-types.ts";

export type InitialAgentState = Extract<
  ServerState["agentState"],
  "not_started" | "starting" | "stopped" | "error"
>;

export interface CreateServerStateOptions {
  config: ElizaConfig;
  runtime?: AgentRuntime;
  initialAgentState?: InitialAgentState;
  plugins: PluginEntry[];
  deletedConversationIds: Set<string>;
  resolveAgentName(config: ElizaConfig): string;
  detectRuntimeModel(
    runtime: AgentRuntime | null,
    config: ElizaConfig,
  ): string | undefined;
  resolveAgentAutomationMode(config: ElizaConfig): AgentAutomationMode;
  resolveTradePermissionMode(
    config: ElizaConfig,
  ): ServerState["tradePermissionMode"];
}

export function createServerState(
  options: CreateServerStateOptions,
): ServerState {
  const runtime = options.runtime ?? null;
  const hasRuntime = runtime !== null;
  const agentState = hasRuntime
    ? "running"
    : (options.initialAgentState ?? "not_started");
  const startup =
    agentState === "running"
      ? { phase: "running", attempt: 0 }
      : agentState === "starting"
        ? { phase: "starting", attempt: 0 }
        : { phase: "idle", attempt: 0 };

  return {
    runtime,
    config: options.config,
    agentState,
    agentName: hasRuntime
      ? (runtime.character.name ?? options.resolveAgentName(options.config))
      : options.resolveAgentName(options.config),
    model: hasRuntime
      ? options.detectRuntimeModel(runtime, options.config)
      : undefined,
    startedAt: hasRuntime || agentState === "starting" ? Date.now() : undefined,
    startup,
    plugins: options.plugins,
    skills: [],
    logBuffer: [],
    eventBuffer: [],
    nextEventId: 1,
    chatRoomId: null,
    chatUserId: null,
    chatConnectionReady: null,
    chatConnectionPromise: null,
    adminEntityId: null,
    conversations: new Map(),
    activeChatTurnCount: 0,
    conversationRestorePromise: null,
    deletedConversationIds: options.deletedConversationIds,
    cloudManager: null,
    sandboxManager: null,
    appManager: null,
    shareIngestQueue: [],
    broadcastStatus: null,
    broadcastWs: null,
    broadcastWsToClientId: null,
    broadcastWsToConversation: null,
    activeConversationId: null,
    permissionStates: {},
    shellEnabled: options.config.features?.shellEnabled !== false,
    agentAutomationMode: options.resolveAgentAutomationMode(options.config),
    tradePermissionMode: options.resolveTradePermissionMode(options.config),
    pendingRestartReasons: [],
    connectorRouteHandlers: [],
    connectorHealthMonitor: null,
    whatsappPairingSessions: new Map(),
  };
}

```

### Core Architecture Module: `packages/agent/src/api/zip-utils.ts`
```
/**
 * Minimal dependency-free ZIP archive writer. Packs entries with the STORE method
 * (no compression), computing a CRC32 and DOS date/time per entry and emitting
 * local file headers, the central directory, and the end-of-central-directory
 * record. Entry names are normalized and path-traversal, null-byte, and absolute
 * paths are rejected. Used to bundle files (e.g. VFS/plugin exports) into a
 * downloadable ZIP.
 */
interface ZipEntryInput {
  name: string;
  data: Buffer | Uint8Array | string;
  mtime?: Date;
}

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let crc = i;
  for (let j = 0; j < 8; j += 1) {
    if ((crc & 1) === 1) {
      crc = (crc >>> 1) ^ 0xedb88320;
    } else {
      crc >>>= 1;
    }
  }
  CRC32_TABLE[i] = crc >>> 0;
}

function normalizeZipEntryName(name: string): string {
  const normalized = name.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized) throw new Error("ZIP entry name cannot be empty");
  if (normalized.includes("\0")) {
    throw new Error("ZIP entry name contains invalid null byte");
  }
  const parts = normalized.split("/");
  for (const part of parts) {
    if (part === "." || part === "..") {
      throw new Error(`ZIP entry name is not safe: ${name}`);
    }
  }
  return normalized;
}

function toBuffer(data: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data, "utf-8");
  return Buffer.from(data);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    const index = (crc ^ byte) & 0xff;
    crc = (crc >>> 8) ^ (CRC32_TABLE[index] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date): { date: number; time: number } {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  const month = Math.min(Math.max(date.getMonth() + 1, 1), 12);
  const day = Math.min(Math.max(date.getDate(), 1), 31);
  const hours = Math.min(Math.max(date.getHours(), 0), 23);
  const minutes = Math.min(Math.max(date.getMinutes(), 0), 59);
  const seconds = Math.min(Math.max(Math.floor(date.getSeconds() / 2), 0), 29);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  return { date: dosDate & 0xffff, time: dosTime & 0xffff };
}

export function createZipArchive(entries: ZipEntryInput[]): Buffer {
  if (entries.length > 0xffff) {
    throw new Error("ZIP export supports up to 65535 files");
  }

  const fileParts: Buffer[] = [];
  const centralDirectoryParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = normalizeZipEntryName(entry.name);
    const nameBuffer = Buffer.from(name, "utf-8");
    const dataBuffer = toBuffer(entry.data);
    const checksum = crc32(dataBuffer);
    const { date, time } = toDosDateTime(entry.mtime ?? new Date());

    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4); // version needed to extract
    localHeader.writeUInt16LE(0, 6); // general purpose bit flag
    localHeader.writeUInt16LE(0, 8); // compression method: store
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18); // compressed size
    localHeader.writeUInt32LE(dataBuffer.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length
    nameBuffer.copy(localHeader, 30);

    const centralHeader = Buffer.alloc(46 + nameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central file header signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed to extract
    centralHeader.writeUInt16LE(0, 8); // general purpose bit flag
    centralHeader.writeUInt16LE(0, 10); // compression method: store
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20); // compressed size
    centralHeader.writeUInt32LE(dataBuffer.length, 24); // uncompressed size
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // file comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attrs
    centralHeader.writeUInt32LE(0, 38); // external file attrs
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header
    nameBuffer.copy(centralHeader, 46);

    fileParts.push(localHeader, dataBuffer);
    centralDirectoryParts.push(centralHeader);
    offset += localHeader.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralDirectoryParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0); // EOCD signature
  endOfCentralDirectory.writeUInt16LE(0, 4); // number of this disk
  endOfCentralDirectory.writeUInt16LE(0, 6); // disk where central directory starts
  endOfCentralDirectory.writeUInt16LE(entries.length, 8); // number of central dir records on this disk
  endOfCentralDirectory.writeUInt16LE(entries.length, 10); // total number of records
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16); // offset of central directory
  endOfCentralDirectory.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...fileParts, centralDirectory, endOfCentralDirectory]);
}

```

### Core Architecture Module: `packages/agent/src/config/zod-schema.core.ts`
```
/**
 * Shared zod schema building blocks composed by the other config schemas.
 * Covers the model layer (provider/model definitions, API dialects, per-model
 * cost and context-window shapes), group/DM policy enums, identity, TTS, media
 * understanding and media generation (image/video/audio/vision), CLI-backend
 * definitions, message queue/debounce/retry, markdown rendering, and shared
 * refinement helpers (`requireOpenAllowFrom`, `normalizeAllowFrom`) reused to
 * gate an "open" DM policy behind an explicit `allowFrom: ["*"]`.
 */

import { isSafeExecutableValue } from "@elizaos/core";
import {
  ModelDefinitionInputSchema,
  ModelApiSchema as SharedModelApiSchema,
  ModelCompatSchema as SharedModelCompatSchema,
} from "@elizaos/host/protocol";

import * as zod from "zod";
import { DEFAULT_MODEL_CONTEXT_WINDOW } from "./model-metadata.ts";

const z = (zod as typeof zod & { z?: typeof zod }).z ?? zod;

export const ModelApiSchema = SharedModelApiSchema;
export const ModelCompatSchema = SharedModelCompatSchema;

type ValidatedModelDefinition = zod.infer<typeof ModelDefinitionInputSchema>;

/** Apply agent-runtime defaults only after shared input validation succeeds. */
export function materializeRuntimeModelDefinition(
  input: ValidatedModelDefinition,
) {
  return {
    ...input,
    reasoning: input.reasoning ?? false,
    input: input.input ?? ["text"],
    cost: {
      input: input.cost?.input ?? 0,
      output: input.cost?.output ?? 0,
      cacheRead: input.cost?.cacheRead ?? 0,
      cacheWrite: input.cost?.cacheWrite ?? 0,
    },
    contextWindow: input.contextWindow ?? DEFAULT_MODEL_CONTEXT_WINDOW,
  };
}

export const ModelDefinitionSchema = ModelDefinitionInputSchema.transform(
  materializeRuntimeModelDefinition,
);

export const ModelProviderSchema = z
  .object({
    baseUrl: z.string().min(1),
    apiKey: z.string().optional(),
    auth: z
      .union([
        z.literal("api-key"),
        z.literal("aws-sdk"),
        z.literal("oauth"),
        z.literal("token"),
      ])
      .optional(),
    api: ModelApiSchema.optional(),
    headers: z.record(z.string(), z.string()).optional(),
    authHeader: z.boolean().optional(),
    models: z.array(ModelDefinitionSchema),
  })
  .strict();

export const BedrockDiscoverySchema = z
  .object({
    enabled: z.boolean().optional(),
    region: z.string().optional(),
    providerFilter: z.array(z.string()).optional(),
    refreshInterval: z.number().int().nonnegative().optional(),
    defaultContextWindow: z.number().int().positive().optional(),
    defaultMaxTokens: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

export const ModelsConfigSchema = z
  .object({
    mode: z.union([z.literal("merge"), z.literal("replace")]).optional(),
    providers: z.record(z.string(), ModelProviderSchema).optional(),
    bedrockDiscovery: BedrockDiscoverySchema,
  })
  .strict()
  .optional();

export const GroupChatSchema = z
  .object({
    mentionPatterns: z.array(z.string()).optional(),
    historyLimit: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

export const DmConfigSchema = z
  .object({
    historyLimit: z.number().int().min(0).optional(),
  })
  .strict();

export const IdentitySchema = z
  .object({
    name: z.string().optional(),
    theme: z.string().optional(),
    emoji: z.string().optional(),
    avatar: z.string().optional(),
  })
  .strict()
  .optional();

export const QueueModeSchema = z.union([
  z.literal("steer"),
  z.literal("followup"),
  z.literal("collect"),
  z.literal("steer-backlog"),
  z.literal("steer+backlog"),
  z.literal("queue"),
  z.literal("interrupt"),
]);
export const QueueDropSchema = z.union([
  z.literal("old"),
  z.literal("new"),
  z.literal("summarize"),
]);
export const ReplyToModeSchema = z.union([
  z.literal("off"),
  z.literal("first"),
  z.literal("all"),
]);

// GroupPolicySchema: controls how group messages are handled
// Used with .default("allowlist").optional() pattern:
//   - .optional() allows field omission in input config
//   - .default("allowlist") ensures runtime always resolves to "allowlist" if not provided
export const GroupPolicySchema = z.enum(["open", "disabled", "allowlist"]);

export const DmPolicySchema = z.enum([
  "pairing",
  "allowlist",
  "open",
  "disabled",
]);

export const BlockStreamingCoalesceSchema = z
  .object({
    minChars: z.number().int().positive().optional(),
    maxChars: z.number().int().positive().optional(),
    idleMs: z.number().int().nonnegative().optional(),
  })
  .strict();

export const BlockStreamingChunkSchema = z
  .object({
    minChars: z.number().int().positive().optional(),
    maxChars: z.number().int().positive().optional(),
    breakPreference: z
      .union([
        z.literal("paragraph"),
        z.literal("newline"),
        z.literal("sentence"),
      ])
      .optional(),
  })
  .strict();

export const MarkdownTableModeSchema = z.enum(["off", "bullets", "code"]);

export const MarkdownConfigSchema = z
  .object({
    tables: MarkdownTableModeSchema.optional(),
  })
  .strict()
  .optional();

export const TtsProviderSchema = z.enum(["elevenlabs", "openai", "edge"]);
export const TtsModeSchema = z.enum(["final", "all"]);
export const TtsAutoSchema = z.enum(["off", "always", "inbound", "tagged"]);
export const TtsConfigSchema = z
  .object({
    auto: TtsAutoSchema.optional(),
    enabled: z.boolean().optional(),
    mode: TtsModeSchema.optional(),
    provider: TtsProviderSchema.optional(),
    summaryModel: z.string().optional(),
    modelOverrides: z
      .object({
        enabled: z.boolean().optional(),
        allowText: z.boolean().optional(),
        allowProvider: z.boolean().optional(),
        allowVoice: z.boolean().optional(),
        allowModelId: z.boolean().optional(),
        allowVoiceSettings: z.boolean().optional(),
        allowNormalization: z.boolean().optional(),
        allowSeed: z.boolean().optional(),
      })
      .strict()
      .optional(),
    elevenlabs: z
      .object({
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
        voiceId: z.string().optional(),
        modelId: z.string().optional(),
        seed: z.number().int().min(0).max(4294967295).optional(),
        applyTextNormalization: z.enum(["auto", "on", "off"]).optional(),
        languageCode: z.string().optional(),
        voiceSettings: z
          .object({
            stability: z.number().min(0).max(1).optional(),
            similarityBoost: z.number().min(0).max(1).optional(),
            style: z.number().min(0).max(1).optional(),
            useSpeakerBoost: z.boolean().optional(),
            speed: z.number().min(0.5).max(2).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    openai: z
      .object({
        apiKey: z.string().optional(),
        model: z.string().optional(),
        voice: z.string().optional(),
      })
      .strict()
      .optional(),
    edge: z
      .object({
        enabled: z.boolean().optional(),
        voice: z.string().optional(),
        lang: z.string().optional(),
        outputFormat: z.string().optional(),
        pitch: z.string().optional(),
        rate: z.string().optional(),
        volume: z.string().optional(),
        saveSubtitles: z.boolean().optional(),
        proxy: z.string().optional(),
        timeoutMs: z.number().int().min(1000).max(120000).optional(),
      })
      .strict()
      .optional(),
    prefsPath: z.string().optional(),
    maxTextLength: z.number().int().min(1).optional(),
    timeoutMs: z.number().int().min(1000).max(120000).optional(),
  })
  .strict()
  .optional();

export const HumanDelaySchema = z
  .object({
    mode: z
      .union([z.literal("off"), z.literal("natural"), z.literal("custom")])
      .optional(),
    minMs: z.number().int().nonnegative().optional(),
    maxMs: z.number().int().nonnegative().optional(),
  })
  .strict();

export const CliBackendSchema = z
  .object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    output: z
      .union([z.literal("json"), z.literal("text"), z.literal("jsonl")])
      .optional(),
    resumeOutput: z
      .union([z.literal("json"), z.literal("text"), z.literal("jsonl")])
      .optional(),
    input: z.union([z.literal("arg"), z.literal("stdin")]).optional(),
    maxPromptArgChars: z.number().int().positive().optional(),
    env: z.record(z.string(), z.string()).optional(),
    clearEnv: z.array(z.string()).optional(),
    modelArg: z.string().optional(),
    modelAliases: z.record(z.string(), z.string()).optional(),
    sessionArg: z.string().optional(),
    sessionArgs: z.array(z.string()).optional(),
    resumeArgs: z.array(z.string()).optional(),
    sessionMode: z
      .union([z.literal("always"), z.literal("existing"), z.literal("none")])
      .optional(),
    sessionIdFields: z.array(z.string()).optional(),
    systemPromptArg: z.string().optional(),
    systemPromptMode: z
      .union([z.literal("append"), z.literal("replace")])
      .optional(),
    systemPromptWhen: z
      .union([z.literal("first"), z.literal("always"), z.literal("never")])
      .optional(),
    imageArg: z.string().optional(),
    imageMode: z.union([z.literal("repeat"), z.literal("list")]).optional(),
    serialize: z.boolean().optional(),
  })
  .strict();

export const normalizeAllowFrom = (values?: Array<string | number>): string[] =>
  (values ?? []).map((v) => String(v).trim()).filter(Boolean);

export const requireOpenAllowFrom = (params: {
  policy?: string;
  allowFrom?: Array<string | number>;
  ctx: zod.RefinementCtx;
  path: Array<string | number>;
  message: string;
}) => {
  if (params.policy !== "open") {
    return;
  }
  const allow = normalizeAllowFrom(params.allowFrom);
  if (allow.includes("*")) {
    return;
  }
  params.ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: params.path,
    message: params.message,
  });
};

expo
```

### Core Architecture Module: `packages/agent/src/config/zod-schema.hooks.ts`
```
/**
 * Zod schemas for the workspace hooks config surface. Validates external hook
 * mappings (path/source matchers that wake the agent or dispatch a message,
 * with delivery channel, message/text templating, and an optional transform
 * module), the internal hook handler/entry registry and install records, and
 * the Gmail push-hook config (label/topic/subscription plus local or tailscale
 * serve/funnel exposure). `allowUnsafeExternalContent` gates whether hook
 * payloads are treated as trusted input.
 */
import * as zod from "zod";

const z = (zod as typeof zod & { z?: typeof zod }).z ?? zod;

export const HookMappingSchema = z
  .object({
    id: z.string().optional(),
    match: z
      .object({
        path: z.string().optional(),
        source: z.string().optional(),
      })
      .optional(),
    action: z.union([z.literal("wake"), z.literal("agent")]).optional(),
    wakeMode: z
      .union([z.literal("now"), z.literal("next-heartbeat")])
      .optional(),
    name: z.string().optional(),
    sessionKey: z.string().optional(),
    messageTemplate: z.string().optional(),
    textTemplate: z.string().optional(),
    deliver: z.boolean().optional(),
    allowUnsafeExternalContent: z.boolean().optional(),
    channel: z
      .union([
        z.literal("last"),
        z.literal("whatsapp"),
        z.literal("telegram"),
        z.literal("discord"),
        z.literal("googlechat"),
        z.literal("slack"),
        z.literal("imessage"),
        z.literal("msteams"),
      ])
      .optional(),
    to: z.string().optional(),
    model: z.string().optional(),
    thinking: z.string().optional(),
    timeoutSeconds: z.number().int().positive().optional(),
    transform: z
      .object({
        module: z.string(),
        export: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

const HookConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const InstallRecordSchema = z
  .object({
    source: z.union([
      z.literal("npm"),
      z.literal("archive"),
      z.literal("path"),
    ]),
    spec: z.string().optional(),
    sourcePath: z.string().optional(),
    installPath: z.string().optional(),
    version: z.string().optional(),
    installedAt: z.string().optional(),
    hooks: z.array(z.string()).optional(),
  })
  .strict();

export const InternalHooksSchema = z
  .object({
    enabled: z.boolean().optional(),
    entries: z.record(z.string(), HookConfigSchema).optional(),
    load: z
      .object({
        extraDirs: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    installs: z.record(z.string(), InstallRecordSchema).optional(),
  })
  .strict()
  .optional();

export const HooksGmailSchema = z
  .object({
    account: z.string().optional(),
    label: z.string().optional(),
    topic: z.string().optional(),
    subscription: z.string().optional(),
    pushToken: z.string().optional(),
    hookUrl: z.string().optional(),
    includeBody: z.boolean().optional(),
    maxBytes: z.number().int().positive().optional(),
    renewEveryMinutes: z.number().int().positive().optional(),
    allowUnsafeExternalContent: z.boolean().optional(),
    serve: z
      .object({
        bind: z.string().optional(),
        port: z.number().int().positive().optional(),
        path: z.string().optional(),
      })
      .strict()
      .optional(),
    tailscale: z
      .object({
        mode: z
          .union([z.literal("off"), z.literal("serve"), z.literal("funnel")])
          .optional(),
        path: z.string().optional(),
        target: z.string().optional(),
      })
      .strict()
      .optional(),
    model: z.string().optional(),
    thinking: z
      .union([
        z.literal("off"),
        z.literal("minimal"),
        z.literal("low"),
        z.literal("medium"),
        z.literal("high"),
      ])
      .optional(),
  })
  .strict()
  .optional();

```

### Core Architecture Module: `packages/agent/src/config/zod-schema.providers-core.ts`
```
/**
 * Zod schemas validating the messaging-connector (`channels.*`) config for each
 * supported platform: Telegram, Discord, Google Chat, Slack, iMessage,
 * MS Teams, WhatsApp, Twitter/X, Twitch, and the live-streaming destinations
 * (Twitch/YouTube/custom-RTMP/Pumpfun/X). Each connector carries account,
 * group/channel, DM/group policy, per-scope tool policy, and delivery/streaming
 * knobs; refinements enforce that an "open" DM policy includes `allowFrom: ["*"]`
 * and that HTTP webhooks declare a signing secret.
 */
import * as zod from "zod";
import {
  normalizeTelegramCommandDescription,
  normalizeTelegramCommandName,
  resolveTelegramCustomCommands,
} from "./telegram-custom-commands.ts";
import { ToolPolicySchema } from "./zod-schema.agent-runtime.ts";
import {
  BlockStreamingChunkSchema,
  BlockStreamingCoalesceSchema,
  ChannelHeartbeatVisibilitySchema,
  DmConfigSchema,
  DmPolicySchema,
  ExecutableTokenSchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  MSTeamsReplyStyleSchema,
  ProviderCommandsSchema,
  ReplyToModeSchema,
  RetryConfigSchema,
  requireOpenAllowFrom,
} from "./zod-schema.core.ts";

const z = (zod as typeof zod & { z?: typeof zod }).z ?? zod;

const ToolPolicyBySenderSchema = z
  .record(z.string(), ToolPolicySchema)
  .optional();

const TelegramInlineButtonsScopeSchema = z.enum([
  "off",
  "dm",
  "group",
  "all",
  "allowlist",
]);

const TelegramCapabilitiesSchema = z.union([
  z.array(z.string()),
  z
    .object({
      inlineButtons: TelegramInlineButtonsScopeSchema.optional(),
    })
    .strict(),
]);

export const TelegramTopicSchema = z
  .object({
    requireMention: z.boolean().optional(),
    skills: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    systemPrompt: z.string().optional(),
  })
  .strict();

export const TelegramGroupSchema = z
  .object({
    requireMention: z.boolean().optional(),
    tools: ToolPolicySchema,
    toolsBySender: ToolPolicyBySenderSchema,
    skills: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    systemPrompt: z.string().optional(),
    topics: z.record(z.string(), TelegramTopicSchema.optional()).optional(),
  })
  .strict();

const TelegramCustomCommandSchema = z
  .object({
    command: z.string().transform(normalizeTelegramCommandName),
    description: z.string().transform(normalizeTelegramCommandDescription),
  })
  .strict();

const validateTelegramCustomCommands = (
  value: { customCommands?: Array<{ command?: string; description?: string }> },
  ctx: zod.RefinementCtx,
) => {
  if (!value.customCommands || value.customCommands.length === 0) {
    return;
  }
  const { issues } = resolveTelegramCustomCommands({
    commands: value.customCommands,
    checkReserved: false,
    checkDuplicates: false,
  });
  for (const issue of issues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customCommands", issue.index, issue.field],
      message: issue.message,
    });
  }
};

export const TelegramAccountSchemaBase = z
  .object({
    name: z.string().optional(),
    capabilities: TelegramCapabilitiesSchema.optional(),
    markdown: MarkdownConfigSchema,
    enabled: z.boolean().optional(),
    commands: ProviderCommandsSchema,
    customCommands: z.array(TelegramCustomCommandSchema).optional(),
    configWrites: z.boolean().optional(),
    dmPolicy: DmPolicySchema.optional().default("pairing"),
    botToken: z.string().optional(),
    tokenFile: z.string().optional(),
    replyToMode: ReplyToModeSchema.optional(),
    groups: z.record(z.string(), TelegramGroupSchema.optional()).optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    groupPolicy: GroupPolicySchema.optional().default("allowlist"),
    historyLimit: z.number().int().min(0).optional(),
    dmHistoryLimit: z.number().int().min(0).optional(),
    dms: z.record(z.string(), DmConfigSchema.optional()).optional(),
    textChunkLimit: z.number().int().positive().optional(),
    chunkMode: z.enum(["length", "newline"]).optional(),
    blockStreaming: z.boolean().optional(),
    draftChunk: BlockStreamingChunkSchema.optional(),
    blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
    streamMode: z
      .enum(["off", "partial", "block"])
      .optional()
      .default("partial"),
    mediaMaxMb: z.number().positive().optional(),
    timeoutSeconds: z.number().int().positive().optional(),
    retry: RetryConfigSchema,
    network: z
      .object({
        autoSelectFamily: z.boolean().optional(),
      })
      .strict()
      .optional(),
    proxy: z.string().optional(),
    webhookUrl: z.string().optional(),
    webhookSecret: z.string().optional(),
    webhookPath: z.string().optional(),
    actions: z
      .object({
        reactions: z.boolean().optional(),
        sendMessage: z.boolean().optional(),
        deleteMessage: z.boolean().optional(),
        sticker: z.boolean().optional(),
      })
      .strict()
      .optional(),
    reactionNotifications: z.enum(["off", "own", "all"]).optional(),
    reactionLevel: z.enum(["off", "ack", "minimal", "extensive"]).optional(),
    heartbeat: ChannelHeartbeatVisibilitySchema,
    linkPreview: z.boolean().optional(),
  })
  .strict();

export const TelegramAccountSchema = TelegramAccountSchemaBase.superRefine(
  (value, ctx) => {
    requireOpenAllowFrom({
      policy: value.dmPolicy,
      allowFrom: value.allowFrom,
      ctx,
      path: ["allowFrom"],
      message:
        'channels.telegram.dmPolicy="open" requires channels.telegram.allowFrom to include "*"',
    });
    validateTelegramCustomCommands(value, ctx);
  },
);

export const TelegramConfigSchema = TelegramAccountSchemaBase.extend({
  accounts: z.record(z.string(), TelegramAccountSchema.optional()).optional(),
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message:
      'channels.telegram.dmPolicy="open" requires channels.telegram.allowFrom to include "*"',
  });
  validateTelegramCustomCommands(value, ctx);

  const baseWebhookUrl =
    typeof value.webhookUrl === "string" ? value.webhookUrl.trim() : "";
  const baseWebhookSecret =
    typeof value.webhookSecret === "string" ? value.webhookSecret.trim() : "";
  if (baseWebhookUrl && !baseWebhookSecret) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "channels.telegram.webhookUrl requires channels.telegram.webhookSecret",
      path: ["webhookSecret"],
    });
  }
  if (!value.accounts) {
    return;
  }
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) {
      continue;
    }
    if (account.enabled === false) {
      continue;
    }
    const accountWebhookUrl =
      typeof account.webhookUrl === "string" ? account.webhookUrl.trim() : "";
    if (!accountWebhookUrl) {
      continue;
    }
    const accountSecret =
      typeof account.webhookSecret === "string"
        ? account.webhookSecret.trim()
        : "";
    if (!accountSecret && !baseWebhookSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "channels.telegram.accounts.*.webhookUrl requires channels.telegram.webhookSecret or channels.telegram.accounts.*.webhookSecret",
        path: ["accounts", accountId, "webhookSecret"],
      });
    }
  }
});

export const TelegramAccountConnectorSchema = z
  .object({
    enabled: z.boolean().optional(),
    phone: z.string().optional(),
    appId: z.union([z.string(), z.number().int()]).optional(),
    appHash: z.string().optional(),
    deviceModel: z.string().optional(),
    systemVersion: z.string().optional(),
  })
  .strict();

export const DiscordDmSchema = z
  .object({
    enabled: z.boolean().optional(),
    policy: DmPolicySchema.optional().default("pairing"),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    groupEnabled: z.boolean().optional(),
    groupChannels: z.array(z.union([z.string(), z.number()])).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    requireOpenAllowFrom({
      policy: value.policy,
      allowFrom: value.allowFrom,
      ctx,
      path: ["allowFrom"],
      message:
        'channels.discord.dm.policy="open" requires channels.discord.dm.allowFrom to include "*"',
    });
  });

export const DiscordGuildChannelSchema = z
  .object({
    allow: z.boolean().optional(),
    requireMention: z.boolean().optional(),
    tools: ToolPolicySchema,
    toolsBySender: ToolPolicyBySenderSchema,
    skills: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    users: z.array(z.union([z.string(), z.number()])).optional(),
    systemPrompt: z.string().optional(),
    autoThread: z.boolean().optional(),
  })
  .strict();

export const DiscordGuildSchema = z
  .object({
    slug: z.string().optional(),
    requireMention: z.boolean().optional(),
    tools: ToolPolicySchema,
    toolsBySender: ToolPolicyBySenderSchema,
    reactionNotifications: z
      .enum(["off", "own", "all", "allowlist"])
      .optional(),
    users: z.array(z.union([z.string(), z.number()])).optional(),
    channels: z
      .record(z.string(), DiscordGuildChannelSchema.optional())
      .optional(),
  })
  .strict();

export const DiscordAccountSchema = z
  .object({
    name: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
    markdown: MarkdownConfigSchema,
    enabled: z.boolean().optional(),
    commands: ProviderCommandsSchema,
    configWrites: z.boolean().optional(),
    token: z.string().optional(),
    syncProfile: z.boolean().optional(),
    profileName: z.string().optional(),
    profileAvatar: z.string().optional(),
    allowBots: z.boolean().optional(),
    grou
```

### Core Architecture Module: `packages/agent/src/hooks/discovery.ts`
```
/**
 * Discover hooks from workspace, managed state-dir hooks, and bundled dirs.
 * Later sources win on name conflicts.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  logger,
  parseFrontmatterDocument,
  resolveStateDir,
} from "@elizaos/core";
import type {
  ElizaHookMetadata,
  Hook,
  HookEntry,
  HookSource,
  ParsedHookFrontmatter,
} from "./types.ts";

const HOOK_MD = "HOOK.md";
const HANDLER_NAMES = [
  "handler.ts",
  "handler.mjs",
  "handler",
  "index.ts",
  "index.mjs",
  "index",
];

function parseFrontmatter(content: string): ParsedHookFrontmatter | null {
  const parsed = parseFrontmatterDocument(content);
  if (parsed.kind !== "parsed") return null;
  const { name, description, homepage, metadata } = parsed.frontmatter;
  if (typeof name !== "string" || !name.trim()) return null;
  if (typeof description !== "string") return null;
  const result: ParsedHookFrontmatter = {
    name: name.trim(),
    description: description.trim(),
  };
  if (typeof homepage === "string") result.homepage = homepage.trim();
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata)
  ) {
    result.metadata = metadata as ParsedHookFrontmatter["metadata"];
  }
  return result;
}

function extractMetadata(
  frontmatter: ParsedHookFrontmatter,
): ElizaHookMetadata | undefined {
  const meta = frontmatter.metadata?.eliza;
  if (!meta) return undefined;

  return {
    always: meta.always,
    hookKey: meta.hookKey,
    emoji: meta.emoji,
    homepage: meta.homepage ?? frontmatter.homepage,
    events: Array.isArray(meta.events) ? meta.events : [],
    export: meta.export,
    os: meta.os,
    requires: meta.requires,
    install: meta.install,
  };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function findHandlerPath(dir: string): Promise<string | null> {
  for (const name of HANDLER_NAMES) {
    const p = join(dir, name);
    if (await fileExists(p)) return p;
  }
  return null;
}

async function loadHookFromDir(
  dir: string,
  source: HookSource,
  pluginId?: string,
): Promise<HookEntry | null> {
  const hookMdPath = join(dir, HOOK_MD);

  if (!(await fileExists(hookMdPath))) return null;

  const handlerPath = await findHandlerPath(dir);
  if (!handlerPath) {
    logger.warn(`[hooks] Hook at ${dir} has HOOK.md but no handler`);
    return null;
  }

  try {
    const content = await readFile(hookMdPath, "utf-8");
    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      logger.warn(`[hooks] Invalid frontmatter in ${hookMdPath}`);
      return null;
    }

    const metadata = extractMetadata(frontmatter);

    const hook: Hook = {
      name: frontmatter.name,
      description: frontmatter.description,
      source,
      pluginId,
      filePath: hookMdPath,
      baseDir: dir,
      handlerPath,
    };

    return { hook, frontmatter, metadata };
  } catch (err) {
    const msg = String(err);
    logger.warn(`[hooks] Error loading hook from ${dir}: ${msg}`);
    return null;
  }
}

async function scanHooksDir(
  dir: string,
  source: HookSource,
): Promise<HookEntry[]> {
  if (!(await isDirectory(dir))) return [];

  const entries: HookEntry[] = [];

  try {
    const items = await readdir(dir);
    for (const item of items) {
      const itemPath = join(dir, item);
      if (!(await isDirectory(itemPath))) continue;

      const entry = await loadHookFromDir(itemPath, source);
      if (entry) {
        entries.push(entry);
      }
    }
  } catch (err) {
    const msg = String(err);
    logger.warn(`[hooks] Error scanning ${dir}: ${msg}`);
  }

  return entries;
}

export interface DiscoveryOptions {
  workspacePath?: string;
  bundledDir?: string;
  extraDirs?: string[];
}

/** Precedence: extra (lowest) -> bundled -> managed -> workspace (highest). */
export async function discoverHooks(
  options: DiscoveryOptions = {},
): Promise<HookEntry[]> {
  const seen = new Map<string, HookEntry>();

  if (options.extraDirs) {
    for (const dir of options.extraDirs) {
      const resolved = resolve(dir.replace(/^~/, homedir()));
      for (const entry of await scanHooksDir(resolved, "eliza-managed")) {
        seen.set(entry.hook.name, entry);
      }
    }
  }

  if (options.bundledDir) {
    for (const entry of await scanHooksDir(
      options.bundledDir,
      "eliza-bundled",
    )) {
      seen.set(entry.hook.name, entry);
    }
  }

  const managedDir = join(resolveStateDir(), "hooks");
  for (const entry of await scanHooksDir(managedDir, "eliza-managed")) {
    seen.set(entry.hook.name, entry);
  }

  if (options.workspacePath) {
    const wsHooksDir = join(
      options.workspacePath.replace(/^~/, homedir()),
      "hooks",
    );
    for (const entry of await scanHooksDir(wsHooksDir, "eliza-workspace")) {
      seen.set(entry.hook.name, entry);
    }
  }

  const all = Array.from(seen.values());
  logger.info(`[hooks] Discovered ${all.length} hooks`);
  return all;
}

```

### Core Architecture Module: `packages/agent/src/hooks/eligibility.ts`
```
/**
 * Hook eligibility: checks OS, binary, env, and config requirements.
 */

import { existsSync } from "node:fs";
import { platform } from "node:os";
import { delimiter, dirname, extname, isAbsolute, join } from "node:path";
import type { HookConfig, InternalHooksConfig } from "@elizaos/host/protocol";
import type { ElizaHookMetadata } from "./types.ts";

function binaryExists(name: string): boolean {
  const pathExts =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .map((ext) => ext.trim().toLowerCase())
          .filter(Boolean)
      : [];
  const baseCandidates =
    process.platform === "win32" && extname(name) === ""
      ? [name, ...pathExts.map((ext) => `${name}${ext}`)]
      : [name];

  if (
    isAbsolute(name) &&
    baseCandidates.some((candidate) => existsSync(candidate))
  ) {
    return true;
  }

  const pathDirs = [
    ...new Set(
      [
        (process.env.PATH ?? "").split(delimiter),
        dirname(process.execPath),
      ].flat(),
    ),
  ].filter(Boolean);
  for (const dir of pathDirs) {
    for (const candidate of baseCandidates) {
      if (existsSync(join(dir, candidate))) return true;
    }
  }
  return false;
}

function resolveConfigPath(
  config: Record<string, unknown>,
  pathStr: string,
): unknown {
  const parts = pathStr.split(".");
  let current: unknown = config;
  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isConfigPathTruthy(
  config: Record<string, unknown>,
  pathStr: string,
): boolean {
  const value = resolveConfigPath(config, pathStr);
  return (
    value !== undefined &&
    value !== null &&
    value !== false &&
    value !== "" &&
    value !== 0
  );
}

export interface EligibilityResult {
  eligible: boolean;
  missing: string[];
}

export function checkEligibility(
  metadata: ElizaHookMetadata | undefined,
  hookConfig: HookConfig | undefined,
  elizaConfig: Record<string, unknown> = {},
): EligibilityResult {
  const missing: string[] = [];

  if (!metadata) {
    return { eligible: true, missing: [] };
  }

  // Note: hookConfig.enabled is intentionally NOT checked here.
  // "Disabled" (user choice) vs "ineligible" (missing requirements) are
  // separate concerns — the loader handles the enabled flag.

  if (metadata.os && metadata.os.length > 0) {
    if (!metadata.os.includes(platform())) {
      missing.push(
        `OS: requires ${metadata.os.join("|")}, current: ${platform()}`,
      );
    }
  }

  if (metadata.always) {
    return { eligible: missing.length === 0, missing };
  }

  if (metadata.requires?.bins) {
    for (const bin of metadata.requires.bins) {
      if (!binaryExists(bin)) {
        missing.push(`Binary missing: ${bin}`);
      }
    }
  }

  if (metadata.requires?.anyBins && metadata.requires.anyBins.length > 0) {
    const hasAny = metadata.requires.anyBins.some(binaryExists);
    if (!hasAny) {
      missing.push(`None of: ${metadata.requires.anyBins.join(", ")}`);
    }
  }

  if (metadata.requires?.env) {
    for (const envVar of metadata.requires.env) {
      const hasInProcess = Boolean(process.env[envVar]);
      const hasInHookConfig = Boolean(hookConfig?.env?.[envVar]);
      if (!hasInProcess && !hasInHookConfig) {
        missing.push(`Env missing: ${envVar}`);
      }
    }
  }

  if (metadata.requires?.config) {
    for (const configPath of metadata.requires.config) {
      if (!isConfigPathTruthy(elizaConfig, configPath)) {
        missing.push(`Config missing: ${configPath}`);
      }
    }
  }

  return { eligible: missing.length === 0, missing };
}

export function resolveHookConfig(
  internalConfig: InternalHooksConfig | undefined,
  hookKey: string,
): HookConfig | undefined {
  return internalConfig?.entries?.[hookKey];
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #33036** (2026-10-04): **[Security] Desktop: DNS rebinding through the renderer proxy gives any website credential-free OWNER-level reads of the agent API (including plaintext stored API keys)**
  *Symptoms*: ## Summary  Two locally-trusting servers started by the desktop app combine into a **DNS rebinding** bypass of the same-origin policy:  1. The **renderer server** (Electrobun main process, `Bun.serve`, `127.0.0.1:5174`) reverse-proxies `/api/*`, `/ws`, `/music-player` to the agent API it spawned on `127.0.0.1:31337`. Before forwarding, it **strips the request's `Host` header** (treated as hop-by-hop) and rewrites it to the loopback target, while passing `Origin` / `Sec-Fetch-*` through. The proxy itself does not validate where a request comes from. 2. The **agent API** treats every loopback peer as **OWNER, unconditionally** (`isTrustedLocalRequest`).  An attacker serves a page from a rebinding domain — e.g. `7f000001.<attacker-ip-hex>.rbndr.us`, which alternates A records between the attacker's IP and `127.0.0.1` (TTL 1s). Once the domain resolves to `127.0.0.1`, the attacker's page is **same-origin with the renderer server**, and its GETs flow through the proxy into the agent API: `Host` has been rewritten to loopback, a same-origin GET carries **no `Origin` header**, and `Sec-Fetch-Site` is `same-origin` — every loopback-trust condition is satisfied *legitimately*, so the request is authorized as **OWNER with zero credentials**.  Result: any website can read **all GET endpoints** of the agent API, including:  - `GET /api/secrets/inventory` — enumerates every stored secret (key / label / category / lastModified) - `GET /api/secrets/inventory/:key` — returns the secret's **c
  **Post-Mortem & Fix Analysis**:
  > Resolved on develop by #33169. Verified the current request boundary and passed its real HTTP regression test together with the desktop proxy regressions. Closing as completed.
  > @lalalune Thank you for fixing and merging the patch. Would you kindly assist me in requesting a CVE ID for this vulnerability? I would be happy to provide any additional information needed.

- **Issue #33034** (2026-10-04): **[Security] Desktop: any website can steal the OWNER-level agent API token — renderer serves CORS `*` and embeds the token in the index HTML**
  *Symptoms*: ## Summary  The ElizaOS desktop app starts a local **renderer HTTP server** (Electrobun main process, `Bun.serve`, default `127.0.0.1:5174`, incrementing if taken). Two flaws on this server combine:  1. **Every static response is served with `Access-Control-Allow-Origin: *`** — JavaScript on any website can read the response bodies cross-origin. 2. **The built-in index page embeds the app's boot config in plaintext**, including the agent API's **OWNER-level Bearer token (`apiToken`)** and its base URL (`apiBase`).  So if the victim simply opens any attacker-controlled web page while the desktop app is running, that page performs one plain cross-origin GET (a simple request, **no preflight**) to `http://127.0.0.1:5174/`, reads the full HTML, and extracts the OWNER token with a regex. Zero interaction, no dialogs, completely silent — the app's highest-privilege credential is handed to an arbitrary website.  ## Environment  - `@elizaos/app` 2.0.3-beta.7 (commit `876317fb`), Windows 11, default local configuration (no special settings)  ## Root cause  `packages/app/platforms/electrobun/src/index.ts` — static-file handling of the renderer server:  ```ts // index.ts:915-933 — HTML branch if (mimeExt === ".html" || filePath.endsWith("index.html")) {     const html = apiBaseOwner.injectIntoHtml(content.toString("utf8"));  // :925 — injects apiToken + apiBase into the page     return new Response(html, {         headers: {             "Content-Type": "text/html; charset=utf-8",       
  **Post-Mortem & Fix Analysis**:
  > Resolved on develop by #33142. Verified the current implementation and passed the desktop static-response, API proxy, and API-base owner regression suites (12 tests). Closing as completed.
  > @lalalune Thank you for fixing and merging the patch. Would you kindly assist me in requesting a CVE ID for this vulnerability? I would be happy to provide any additional information needed.

- **Issue #32577** (2026-09-26): **TTS sanitizer: NFKC changes numero sign №4 to No4 before speech**
  *Symptoms*: Description:  I found a source-confirmed TTS normalization issue in:  packages/shared/src/spoken-text.ts  `sanitizeSpeechText()` currently starts with:  const normalized = input.normalize("NFKC");  Unicode NFKC normalization changes the numero sign before speech-specific semantic handling:  "№4".normalize("NFKC") === "No4"  So a phrase like:  Заметка №4 создана.  can reach the TTS layer with `№4` already changed to `No4`.  Depending on the downstream TTS provider or language-routing logic, `No4` can then be interpreted as English-like text, for example "number four", instead of the intended localized reading of the numero sign.  I encountered this exact failure mode in another local voice-assistant project and fixed it by handling the numero pattern before NFKC.  Why this matters:  NFKC is useful for compatibility normalization, but some compatibility characters carry speech semantics that should be interpreted before NFKC removes their original form.  Examples:  №1 №4 №12 №21  After NFKC, a later speech normalizer can no longer reliably distinguish an original numero sign from literal user text such as:  No4  Suggested direction:  For the TTS reading copy only:  1. Handle recognized speech-semantic patterns such as `№<integer>` before NFKC. 2. Convert them using the locale/language-aware number verbalizer already used by the voice path, if one exists. 3. Then run NFKC and the existing markup/direction/punctuation sanitizer. 4. Preserve genuine literal Latin text such as `No4
  **Post-Mortem & Fix Analysis**:
  > <!-- backlog-triage-20260926:32577 --> Closing as completed: merged PR #32754 addresses this reported defect and is included in `develop@4b9a1c3eadc0594b03f9b86b91738e08a82adbd8`. I checked the retained implementation in current source.  Source checked: `packages/core/src/spoken-text.ts`.  This is code-level closure; it does not claim a new production rollout or physical-device acceptance run.

- **Issue #31091** (2026-09-26): **isUnusableStage1Reply replaces correct replies containing any 5+ character run, including ordinary prose and currency amounts**
  *Symptoms*: `isUnusableStage1Reply` in `@elizaos/core@2.0.3-beta.7` marks a reply unusable if any character repeats five or more times anywhere in it. At the `final_reply` branch that reply is replaced with `"I'm not sure how to answer that."`, so correct model output is discarded and the user sees the agent fail.  Beta-only. Neither the function nor the regex exists in `1.7.2`.  ## The rule  ```js if (/(.)\1{4,}/u.test(trimmed)) return true; ```  Unanchored, so the run can be anywhere in the reply.  ## Why this rule and not the others  `isTerseReplyWorthKeeping` exists to rescue replies the first function rejects, and it carries an exact counterpart for the `/^\d+$/` rule:  ```js if (/^\d+$/.test(trimmed)) return true; ```  So a pure-digit reply is rejected and then deliberately rescued. There is no counterpart for the repeated-character rule, which leaves it the one rejection with no escape hatch.  ## What gets replaced  Verified end to end on `2.0.3-beta.7`. A real `AgentRuntime` driven through `DefaultMessageService.handleMessage`, with a stub model whose reply is the text below, recording what reaches the response callback.  | Model produced | User received | |---|---| | `The balance is 100.000 XRP.` | delivered | | `The balance is 100.0000 XRP.` | delivered | | `The balance is 100.00000 XRP.` | `I'm not sure how to answer that.` | | `The balance is 100.000000 XRP.` | `I'm not sure how to answer that.` | | `The balance is 56774.133566 XRP.` | delivered | | `Loading..... done.` | `I'
  **Post-Mortem & Fix Analysis**:
  > ## Verified disposition: source fixed; published beta still affected  I reproduced the report's decision boundary against current `develop` at `61446bb82c9bf974965e767793c2333781306560`.  - With the issue's three exact replies added to the existing Stage-1 runtime regression case, current source delivered all three unchanged. - Replacing only the current whole-reply repeat check with the reported `/(.)\1{4,}/u` heuristic made the same runtime test reject `The balance is 100.00000 XRP.` and return the generic apology. Restoring current source returned the test to green. - The complete `packages/core/src/__tests__/message-runtime-stage1.test.ts` file then passed: **230/230 tests**.  The source repair is already present through #11555 (`c532e3b565e92d895cb314f35c63a0c7cb4abb69`) and its focused regression follow-up #11579 (`c3ed995f78e34ef91ab73e4469167a24be7b19ba`); both commits are ancestors of current `develop`. A second source patch for this report would therefore duplicate merged wor
  > Closing during backlog triage (done): isUnusableStage1Reply and its unanchored repeated-character rule no longer exist in packages/core/src on current develop.

- **Issue #30563** (2026-09-14): **fix(auth): reject malformed Anthropic OAuth token responses**
  *Symptoms*: ## Describe the bug  The Anthropic authorization-code exchange casts every successful HTTP response directly to its expected token shape. A `200` response can therefore return credentials whose `access` and `refresh` values are `undefined`, or whose expiry is invalid. The refresh path performs only truthiness/type checks after the same unchecked cast, so it can also accept non-string tokens and non-finite or negative lifetimes.  These values cross the shared auth boundary and can reach subscription login, credential persistence, and later refresh logic as if the exchange succeeded.  ## Reproduction  On current `origin/develop` (`f3017932d3501c1e13b78fa248c6f074dd5e5c88`), stub the successful token response and call the real exported exchange:  ```bash bun -e 'globalThis.fetch = async () => new Response(JSON.stringify({ expires_in: "3600" }), { status: 200, headers: { "content-type": "application/json" } }); const { exchangeAnthropicAuthorizationCode } = await import("./packages/auth/src/vendor/pi-oauth/anthropic-login.ts"); const credentials = await exchangeAnthropicAuthorizationCode("code#state"); console.log(JSON.stringify(credentials)); console.log(`access=${String(credentials.access)} refresh=${String(credentials.refresh)} expiresFinite=${Number.isFinite(credentials.expires)}`);' ```  Observed:  ```text {"expires":1788566348021} access=undefined refresh=undefined expiresFinite=true ```  The string lifetime is silently coerced, while both required secrets are absent. Simil
  **Post-Mortem & Fix Analysis**:
  > CLAIMING: validate successful Anthropic OAuth token responses as unknown data at the auth boundary, preserve RFC 6749 refresh-token rotation behavior, and prove malformed responses cannot produce or persist partial credentials. I will work from an isolated branch based on current origin/develop.
  > Implemented in #30566 at exact head `4deb3d1cdc6642bc94e24cff69f7324e1e83e82e`.  Verified after rebasing onto current `origin/develop`: - root `bun run verify` passed - auth package: 230/230 tests, typecheck, lint, format, and build passed - PR evidence gate passed - two independent adversarial reviews returned zero findings after an expiry-overflow regression was added and fixed  Hosted checks are now running. I will not merge or self-approve the PR.
  > PR #30566 was updated after review at exact head `01654ee7e6f0e229c415d65119f965a5e1402a06`.  The explicit `refresh_token: null` compatibility regression was reproduced red, fixed to preserve the existing token in refresh mode, and independently re-reviewed with zero findings. Exchange remains strict and malformed present values remain rejected.  Current proof: 231/231 auth tests, focused 30/30, helper + wrapper 32/32, auth typecheck/lint/format/build, post-sync root `bun run verify`, and PR evidence gate all pass. Hosted checks are restarting on the new exact head; I will not merge or self-approve.

- **Issue #30550** (2026-09-15): **fix(app-core): reject malformed Anthropic usage response shapes**
  *Symptoms*: **Describe the bug**  `pollAnthropicUsage` casts the authenticated provider JSON directly to `AnthropicUsagePayload`. Explicitly malformed `five_hour`, `seven_day`, or `limits` values can therefore be treated like absent optional fields and produce a fresh, healthy-looking snapshot instead of a failed probe. `AccountPool.refreshUsage()` persists that snapshot, marks the account `ok`, and replaces previously known limit/reset data.  **To Reproduce**  From the repository root on current `develop`:  ```bash bun -e 'import { pollAnthropicUsage } from "./packages/app-core/src/services/account-usage.ts"; const payload={five_hour:7,seven_day:[],limits:{kind:"weekly_all"}}; const fetchImpl=async()=>new Response(JSON.stringify(payload),{status:200,headers:{"content-type":"application/json"}}); console.log(JSON.stringify(await pollAnthropicUsage("redacted",fetchImpl)));'\n```\n\nActual result:\n\n```json\n{"refreshedAt":1788557670038}\n```\n\n**Expected behavior**\n\nReject any present malformed root, window, limit-array, limit-entry, or nested scope/model shape before producing a `UsageSnapshot`. Valid legacy flat, current nested, and current `limits[]` response shapes must remain supported. A failed probe must not be represented as a successful empty snapshot.\n\n**Screenshots / recording of the wrong behavior (required for anything visible)**\n\n- N/A - server-side provider parsing defect with no direct rendered UI.\n\n**Evidence / reproduction proof**\n\n- N/A - no visual behavior.
  **Post-Mortem & Fix Analysis**:
  > CLAIMING: validate Anthropic usage JSON at the provider boundary, preserve all established response variants, and prove failed parsing cannot overwrite account health or usage. I will work from an isolated branch based on the current develop head.
  > PR opened: https://github.com/elizaOS/eliza/pull/30551  Exact head `464f3e88c40d7259f080e190f322b647686abfc4` is based on current `origin/develop` `d04078cd890ea25dff7297434c7c447cdc399d38`.  Verified locally with the pinned Node 24.15.0 / Bun 1.3.14 toolchain: - focused parser, pool, and public-route regressions: 98/98 passing - app-core and agent typechecks: passing - Biome and diff hygiene: passing - full `bun run verify`: passing - PR evidence gate: passing  Two independent adversarial reviews found three boundary gaps during development (route fallback behavior, malformed-JSON typing, and null containers); all were fixed and both final reviews reported zero findings. Hosted exact-head checks are now running. 
  > Final exact-head status for https://github.com/elizaOS/eliza/pull/30551:  - head: `464f3e88c40d7259f080e190f322b647686abfc4` - independent GitHub review: approved at this exact head - mergeability: mergeable - hosted checks: all green  The first Source static smoke attempt passed 131/132 build tasks, then Electrobun's Linux packaging step lost its socket while downloading the upstream `electrobun-core-linux-x64.tar.gz`. I reran only failed jobs without changing the branch. The retry passed Source static smoke and the aggregate All Tests Passed gate, confirming the failure was transient infrastructure rather than this patch.  No merge or self-approval performed. 

- **Issue #30387** (2026-09-03): **Cloud inference rate limiter returns 503 on cold Durable Object admission**
  *Symptoms*: **Describe the bug**  The raw Cloud inference path can return HTTP 503 with `code: rate_limit_unavailable` when the per-organization `InferenceAdmissionGate` Durable Object is cold or its first acknowledgement is lost. `consumeInferenceRateLimit` currently gives the `/rate-limit` call one 1.5-second attempt, while the following balance-lease admission already has a bounded idempotent retry.  This affects authenticated Cloud inference callers before provider dispatch. The rate-only Durable Object uses synchronous SQLite and does no external I/O, so a cold-start or transport-tail failure should be recoverable without weakening the authoritative quota decision.  **To Reproduce**  1. Call the Worker inference path for an organization whose `rate-limit:v2:<organizationId>` Durable Object is cold. 2. Make the first internal `/rate-limit` attempt return a transient 503 or lose its response acknowledgement after committing the counter. 3. Observe that the Worker immediately translates the failure to `rate_limit_unavailable` because there is no internal retry. 4. Observe that a naive retry would double-consume the fixed-window counter when the first attempt committed but its acknowledgement was lost.  **Expected behavior**  Transient transport failures and 5xx responses receive one bounded internal retry. Both attempts carry the same idempotency identity and fixed-window identity, so an acknowledgement-ambiguous retry returns the original decision without consuming the quota twice. De
  **Post-Mortem & Fix Analysis**:
  > CLAIMING: bounded idempotent internal retry for transient inference rate-limit Durable Object admission failures, with lost-acknowledgement and Miniflare regression coverage.
  > Resolved by merged PR #30400 at develop commit 3ce7195c8bf56d2dc37d94306115183af49b9fcc.

- **Issue #30102** (2026-09-26): **test(scripts): make verified-manifest evidence review deterministic under CI load**
  *Symptoms*: Develop Full 33326368904 on exact 6bf1bc1c35da50bb1746981a82b701ceb3b90cfd exposes one deterministic script-lane failure family in scripts/evidence-review/evidence-review.test.mjs. The verified-manifest test generates 904 artifacts and synchronously runs the real reviewer, but inherits the Bun default 5s test timeout. Under the Linux script lane it crosses that boundary, Bun kills the child as dangling, result.status becomes null, and the late assertion is misattributed to the next test. The canonical lane can pass the 18 assertions but still return the evidence child exit 1 depending on runner load. Acceptance: preserve the >900-artifact non-truncation boundary; give the real subprocess test an explicit bounded timeout large enough for hosted contention; prove repeated focused runs, exact script inventory/JUnit validity, Biome/diff, and fresh hosted Linux + canonical script gates. Test-only; no reviewer behavior or artifact cap weakening. N/A UI/device/live evidence because this is a CI test-harness determinism repair.
  **Post-Mortem & Fix Analysis**:
  > CLAIMING: exact evidence-review CI timeout/process-isolation test repair; one writer, one test path, no production or live mutation.
  > Correction after exact artifact review: this local timing weakness is real under loaded developer hosts, but it is **not** the current Develop Full script-lane root. Run `33326368904` completed the evidence-review assertions and failed with missing/invalid JUnit evidence; exact-current run `33327312933` reproduced the same aggregate family. Canonical owner is #29787, now repinned exact-current. The one-file local timing hardening remains preserved and unpublished; HOLD it unless a future run identifies this file as the nonzero child. No duplicate PR.
  > Closing during backlog triage (superseded): Test-harness timeout for scripts/evidence-review under CI load; the reporter confirmed it was not the Develop Full root cause, and test-only harness tuning is superseded by the E2E-only policy.

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

### Incident Patch 1: `393a3f06` (2026-10-05)
**Commit Message**: Merge pull request #33946 from greatcodeeer/fix/meetings-self-intro-adjective

fix(plugin-meetings): take only capitalized words as a self-introduced name

**File**: `plugins/plugin-meetings/src/pipeline/__tests__/pipeline.test.ts` (modified, +72/-0)
```diff
@@ -389,6 +389,78 @@ describe("createMeetingTranscriptionPipeline", () => {
     });
   });
 
+  it("does not read a lowercase word after I'm or This is as a name", async () => {
+    for (const text of [
+      "Sorry, I'm late.",
+      "I'm back.",
+      "This is great.",
+      "I'm here.",
+      "I'm fine, thanks.",
+      "I'm OK.",
+    ]) {
+      const backend = new ScriptedBackend();
+      backend.enqueue({ text }, { text });
+      const pipeline = createMeetingTranscriptionPipeline(options(), backend);
+
+      pipeline.pushSpeakerAudio("track-1", seconds(2));
+      await tick(2000);
+      pipeline.pushSpeakerAudio("track-1", seconds(2));
+      await tick(2000);
+
+      const [segment] = await pipeline.finalize();
+      expect(segment?.text).toBe(text);
+      expect(segment?.speakerLabel).toBe("Speaker 1");
+      expect(segment?.speakerNameAttribution).toBeUndefined();
+    }
+  });
+
+  it("keeps a roster-only name reviewable when the speaker says I'm late", async () => {
+    const backend = new ScriptedBackend();
+    backend.enqueue({ text: "Sorry, I'm late." }, { text: "Sorry, I'm late." });
+    const pipeline = createMeetingTranscriptionPipeline(options(), backend);
+    pipeline.setSpeakerName("track-1", "Taylor Owner");
+
+    pipeline.pushSpeakerAudio("track-1", seconds(2));
+    await tick(2000);
+    pipeline.pushSpeakerAudio("track-1", seconds(2));
+    await tick(2000);
+
+    const [segment] = await pipeline.finalize();
+    expect(segment?.speakerNameAttribution).toMatchObject({
+      resolution: "needs_confirmation",
+      candidateNames: [
+        expect.objectContaining({
+          name: "Taylor Owner",
+          sources: ["platform_roster"],
+        }),
+      ],
+    });
+  });
+
+  it("takes only the capitalized name words after I'm or This is", async () => {
+    for (const [text, name] of [
+      ["Sorry, I'm late, this is Mina.", "Mina"],
+      ["This is Mina speaking.", "Mina"],
+      ["Hi, I'm Mina Chen.", "Mina Chen"],
+    ]) {
+      const backend = new ScriptedBackend();
+      backend.enqueue({ text }, { text });
+      const pipeline = createMeetingTranscriptionPipeline(options(), backend);
+
+      pipeline.pushSpeakerAudio("track-1", seconds(2));
+      await tick(2000);
+      pipeline.pushSpeakerAudio("track-1", seconds(2));
+      await tick(2000);
+
+      const [segment] = await pipeline.finalize();
+      expect(segment?.speakerNameAttribution).toMatchObject({
+        resolution: "confirmed",
+        displayName: name,
+      });
+      expect(segment?.speakerLabel).toBe(name);
+    }
+  });
+
   it("withholds same-first-name calendar candidates", async () => {
     const backend = new ScriptedBackend();
     backend.enqueue(
```

**File**: `plugins/plugin-meetings/src/pipeline/pipeline.ts` (modified, +10/-2)
```diff
@@ -57,6 +57,7 @@ const SELF_INTRODUCTION_STOP_WORDS = new Set([
   "looking",
   "not",
   "of",
+  "ok",
   "on",
   "ready",
   "sorry",
@@ -71,7 +72,10 @@ const SELF_INTRODUCTION_STOP_WORDS = new Set([
 
 const SELF_INTRODUCTION_PATTERNS = [
   /\bmy name is\s+([a-z][a-z'’.-]*(?:\s+[a-z][a-z'’.-]*){0,2})(?=[,.!?]|$|\s+(?:and|from|with|here|speaking|joining)\b)/i,
-  /\b(?:i am|i['’]?m|this is)\s+([a-z][a-z'’.-]*(?:\s+[a-z][a-z'’.-]*)?)(?=[,.!?]|$|\s+(?:and|from|with|here|speaking|joining)\b)/i,
+  // Case-sensitive: after "I'm" / "This is" only capitalized words form a name
+  // ("I'm Mina Chen"), not ordinary speech ("Sorry, I'm late.") or a trailing
+  // cue word ("This is Mina speaking.").
+  /\b(?:[Ii] am|[Ii]['’]?m|[Tt]his is)\s+([A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)?)(?=[,.!?]|$|\s+(?:and|from|with|here|speaking|joining)\b)/,
 ] as const;
 
 interface RetainedChunk {
@@ -377,7 +381,11 @@ class MeetingPipeline implements MeetingTranscriptionPipeline {
     for (const pattern of SELF_INTRODUCTION_PATTERNS) {
       const name = pattern.exec(text)?.[1]?.trim();
       if (!name) continue;
-      const words = name.toLocaleLowerCase().split(/\s+/);
+      // The capture keeps a sentence-final period ("OK."); compare without it.
+      const words = name
+        .toLocaleLowerCase()
+        .split(/\s+/)
+        .map((word) => word.replace(/\.+$/, ""));
       if (words.some((word) => SELF_INTRODUCTION_STOP_WORDS.has(word))) {
         continue;
       }
```

---

### Incident Patch 2: `c867c14f` (2026-10-05)
**Commit Message**: Merge pull request #33943 from hermesagent270-commits/fix/22552-first-attempt-warming

fix(app): require Shared first-attempt launch proof

**File**: `.github/workflows/staging-launch-gate.yml` (modified, +3/-0)
```diff
@@ -223,6 +223,9 @@ jobs:
           ELIZAOS_CLOUD_BASE_URL: https://api-staging.eliza.app
           ELIZA_UI_SMOKE_DEPLOYED_RENDERER: "1"
           ELIZA_UI_SMOKE_DEPLOYED_SOURCE_SHA: ${{ needs.preflight.outputs.source_sha }}
+          # #22552: this lane must prove the first Shared HTTP attempt itself
+          # succeeds. A recovered client retry is not first-turn evidence.
+          ELIZA_UI_SMOKE_REQUIRE_SHARED_FIRST_ATTEMPT: "1"
           ELIZAOS_CLOUD_API_KEY: ${{ secrets.ELIZAOS_CLOUD_API_KEY }}
           PLAYWRIGHT_NO_COPY_PROMPT: "1"
         shell: bash
```

**File**: `packages/app/test/cloud-live-optional-action.ts` (modified, +52/-5)
```diff
@@ -239,6 +239,11 @@ interface WaitForCloudLivePersonalIdentityOptions<T> {
     performConfirmation: (
       confirmation: Locator,
     ) => Promise<Exclude<CloudLiveDedicatedConfirmationKind, "none">>;
+    /**
+     * Selects the rendered non-billable path when confirmation was not
+     * explicitly approved. Omit this to retain the fail-closed diagnostic.
+     */
+    performCancellation?: (cancellation: Locator) => Promise<void>;
   };
   timeoutMs: number;
   runtimeCloudGraceMs: number;
@@ -345,6 +350,12 @@ export async function waitForCloudLivePersonalIdentity<T>({
   const startedAt = Date.now();
   const deadline = startedAt + timeoutMs;
   let runtimeCloudWasAbsent = false;
+  let cancellationHandled = false;
+  const waitForNextPoll = () =>
+    withinCloudLivePersonalIdentityDeadline(
+      () => new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs)),
+      deadline,
+    );
   for (;;) {
     const binding = await withinCloudLivePersonalIdentityDeadline(
       readBinding,
@@ -358,8 +369,40 @@ export async function waitForCloudLivePersonalIdentity<T>({
         deadline,
       );
       if (confirmation) {
+        // The click can settle before React locks the rendered pair. Never
+        // dispatch a second cancellation while waiting for the Shared binding.
+        if (cancellationHandled) {
+          await waitForNextPoll();
+          continue;
+        }
         const decision = dedicatedConsent.gate.claimVisibleConfirmation();
         if (decision !== "approved") {
+          const performCancellation = dedicatedConsent.performCancellation;
+          if (decision === "approval-required" && performCancellation) {
+            const cancellation = await lastVisibleEnabledChoice(
+              dedicatedConsent.cancellationChoices,
+              deadline,
+            );
+            if (!cancellation) {
+              throw new CloudLiveDedicatedConfirmationRequiredError(decision);
+            }
+            try {
+              await withinCloudLivePersonalIdentityDeadline(
+                () => performCancellation(cancellation),
+                deadline,
+              );
+              dedicatedConsent.gate.recordCancellation();
+              cancellationHandled = true;
+            } catch (error) {
+              if (error instanceof CloudLivePersonalIdentityDeadlineError) {
+                throw error;
+              }
+              throw new CloudLiveDedicatedConfirmationRequiredError(
+                "interaction-failed",
+              );
+            }
+            continue;
+          }
           throw new CloudLiveDedicatedConfirmationRequiredError(decision);
         }
         try {
@@ -390,16 +433,20 @@ export async function waitForCloudLivePersonalIdentity<T>({
         continue;
       }
 
-      // A newly rendered enabled quote supersedes an older cancelled transcript
-      // turn, so cancellation is checked only after no current confirmation is
-      // actionable. On the current turn both buttons lock after cancellation.
+      // Before this helper dispatches a cancellation, a newly rendered enabled
+      // quote supersedes an older cancelled transcript turn. Check historical
+      // cancellation only after no current confirmation is actionable.
       const cancelled = await hasSelectedCancellation(
         dedicatedConsent.cancellationChoices,
         deadline,
       );
       if (cancelled) {
-        dedicatedConsent.gate.recordCancellation();
-        throw new CloudLiveDedicatedConfirmationRequiredError("cancelled");
+        if (!cancellationHandled) {
+          dedicatedConsent.gate.recordCancellation();
+          throw new CloudLiveDedicatedConfirmationRequiredError("cancelled");
+        }
+        await waitForNextPoll();
+        continue;
       }
     }
 
```

**File**: `packages/app/test/ui-smoke/cloud-live-optional-action.spec.ts` (modified, +66/-0)
```diff
@@ -475,6 +475,72 @@ test.describe("Cloud live optional action boundary", () => {
     });
   });
 
+  test("takes the non-billable cancellation path when approval is absent", async ({
+    page,
+  }) => {
+    await page.setContent(`
+      <button data-testid="activation-confirm" aria-pressed="false">Start Dedicated</button>
+      <button data-testid="activation-cancel" aria-pressed="false">Not now</button>
+      <output data-testid="confirmation-count">0</output>
+      <output data-testid="cancellation-count">0</output>
+      <script>
+        document.addEventListener("click", (event) => {
+          if (!(event.target instanceof HTMLButtonElement)) return;
+          const confirmation = document.querySelector('[data-testid="activation-confirm"]');
+          const cancellation = document.querySelector('[data-testid="activation-cancel"]');
+          if (event.target.dataset.testid === "activation-confirm") {
+            document.querySelector('[data-testid="confirmation-count"]').textContent = "1";
+            return;
+          }
+          if (event.target.dataset.testid !== "activation-cancel") return;
+          const cancellationCount = document.querySelector('[data-testid="cancellation-count"]');
+          cancellationCount.textContent = String(Number(cancellationCount.textContent) + 1);
+          cancellation.setAttribute("aria-pressed", "true");
+          setTimeout(() => {
+            window.__testActiveBinding = "shared";
+          }, 10);
+        });
+      </script>
+    `);
+    const gate = createCloudLiveDedicatedConsentGate({});
+
+    await expect(
+      waitForCloudLivePersonalIdentity({
+        readBinding: () =>
+          page.evaluate(
+            () =>
+              (window as typeof window & { __testActiveBinding?: string })
+                .__testActiveBinding ?? null,
+          ),
+        runtimeCloudRecovery: page.getByTestId("runtime-cloud"),
+        retryRecovery: page.getByTestId("identity-retry"),
+        dedicatedConsent: {
+          gate,
+          confirmationChoices: page.getByTestId("activation-confirm"),
+          cancellationChoices: page.getByTestId("activation-cancel"),
+          performConfirmation: async (confirmation) => {
+            await confirmation.click();
+            return "activation";
+          },
+          performCancellation: async (cancellation) => {
+            await cancellation.click();
+          },
+        },
+        timeoutMs: 500,
+        runtimeCloudGraceMs: 50,
+        pollIntervalMs: 5,
+      }),
+    ).resolves.toBe("shared");
+    await expect(page.getByTestId("confirmation-count")).toHaveText("0");
+    await expect(page.getByTestId("cancellation-count")).toHaveText("1");
+    expect(gate.snapshot()).toEqual({
+      approvalGrantedCount: 0,
+      confirmationOfferCount: 1,
+      confirmationClickCount: 0,
+      cancellationCount: 1,
+    });
+  });
+
   test("rejects billable approval outside an explicit staging dispatch", () => {
     for (const env of [
       {
```

**File**: `packages/app/test/ui-smoke/cloud-live.spec.ts` (modified, +71/-16)
```diff
@@ -95,6 +95,8 @@ const DEPLOYED_RENDERER_MANIFEST_SCHEMA = "elizaos.renderer.build/v1";
 const DEPLOYED_BROWSER_SMOKE_SCHEMA = "elizaos.cloud.deployed-browser-smoke/v3";
 const REQUIRE_NAMED_WARMING =
   process.env.ELIZA_UI_SMOKE_REQUIRE_NAMED_WARMING === "1";
+const REQUIRE_SHARED_FIRST_ATTEMPT =
+  process.env.ELIZA_UI_SMOKE_REQUIRE_SHARED_FIRST_ATTEMPT === "1";
 
 // This lane deliberately places a real Cloud bearer in browser storage.
 // Playwright traces record init-script arguments and request headers, while
@@ -692,6 +694,13 @@ async function resolvePersonalIdentity(
           await confirmation.click({ timeout: 15_000 });
           return "activation";
         },
+        performCancellation: async (cancellation) => {
+          // The default live lane proves Shared chat. Explicit billable
+          // approval still takes the confirmation branch above; otherwise use
+          // the product's existing non-mutating "Not now" path so an optional
+          // Dedicated quote cannot prevent the first Shared turn from running.
+          await cancellation.click({ timeout: 15_000 });
+        },
       },
       timeoutMs: identityTimeoutMs,
       runtimeCloudGraceMs: 15_000,
@@ -781,10 +790,28 @@ test.describe("real cloud login + personal identity + chat", () => {
       deployedRenderer: DEPLOYED_RENDERER_ENABLED,
       cloudEnvironment: originContract.environment,
     });
+    if (REQUIRE_SHARED_FIRST_ATTEMPT) {
+      expect(
+        DEPLOYED_RENDERER_ENABLED,
+        "Shared first-attempt proof requires a deployed renderer",
+      ).toBe(true);
+      expect(
+        originContract.environment,
+        "Shared first-attempt proof requires staging",
+      ).toBe("staging");
+      expect(
+        REQUIRE_NAMED_WARMING,
+        "first-attempt success and named-warming retry proof are mutually exclusive",
+      ).toBe(false);
+    }
     test.info().annotations.push({
       type: "named-warming-proof-required",
       description: String(REQUIRE_NAMED_WARMING),
     });
+    test.info().annotations.push({
+      type: "shared-first-attempt-proof-required",
+      description: String(REQUIRE_SHARED_FIRST_ATTEMPT),
+    });
     const dedicatedConsentGate = createCloudLiveDedicatedConsentGate(
       process.env,
     );
@@ -1067,6 +1094,12 @@ test.describe("real cloud login + personal identity + chat", () => {
       identityAudit.successfulPersonalIdentityGetCount,
       "Personal Eliza resolution must include a successful canonical identity GET",
     ).toBeGreaterThan(0);
+    if (REQUIRE_SHARED_FIRST_ATTEMPT) {
+      expect(
+        referenceBinding.runtime,
+        "the first-attempt lane must exercise Personal Shared, not Dedicated",
+      ).toBe("shared");
+    }
 
     // Real chat turn against the resolved Personal Eliza agent — the liveness
     // contract (#14359) proves a real model answered (non-empty, no stub marker).
@@ -1308,9 +1341,12 @@ test.describe("real cloud login + personal identity + chat", () => {
         `Cloud live liveness failed; privacy-safe diagnostic: ${diagnostic}`,
       );
     }
-    if (!retryObservation.ok && REQUIRE_NAMED_WARMING) {
+    if (
+      !retryObservation.ok &&
+      (REQUIRE_NAMED_WARMING || REQUIRE_SHARED_FIRST_ATTEMPT)
+    ) {
       throw new Error(
-        "Cloud live Retry-chip observer failed; named warming proof is unavailable",
+        "Cloud live Retry-chip observer failed; first-turn proof is unavailable",
       );
     }
     const { liveness } = livenessAttempt;
@@ -1322,25 +1358,44 @@ test.describe("real cloud login + personal identity + chat", () => {
       description: String(liveness.firstTurnLatencyMs),
     });
     const challengeAudit = await primaryAudit.snapshot();
+    const challengeChatSendAttemptCount =
+      challengeAudit.chatSendAttemptCount -
+      auditBeforeLiveness.chatSendAttemptCount;
+    const challengeLogicalChatSendCount =
+      challengeAudit.logicalChatSendCount -
+      auditBeforeLiveness.logicalChatSendCount;
+    const challengeUnidentifiedChatSendAttemptCount =
+      challengeAudit.unidentifiedChatSendAttemptCount -
+      auditBeforeLiveness.unidentifiedChatSendAttemptCount;
+    const challengeNamedWarmingResponseCount =
+      challengeAudit.namedWarmingResponseCount -
+      auditBeforeLiveness.namedWarmingResponseCount;
+    const challengeSuccessfulChatSendResponseCount =
+      challengeAudit.successfulChatSendResponseCount -
+      auditBeforeLiveness.successfulChatSendResponseCount;
     assertCloudLiveNamedWarmingProof({
       required: REQUIRE_NAMED_WARMING,
       terminalLivenessPassed: isLiveReply(liveness.reply),
-      chatSendAttemptCount:
-        challengeAudit.chatSendAttemptCount -
-        auditBeforeLiveness.chatSendAttemptCount,
-      logicalChatSendCount:
-        challengeAudit.logicalChatSendCount -
-        auditBeforeLiveness.logicalChatSendCount,
+      chatSendAttemptCount: challengeChatSendAttemptCount,
+      logicalChatSendCount: 
```

---

### Incident Patch 3: `132773a4` (2026-10-05)
**Commit Message**: fix(plugin-meetings): take only capitalized words as a self-introduced name

The "I'm / I am / This is" self-introduction pattern was case-insensitive,
so ordinary speech became a confirmed speaker name: "Sorry, I'm late."
labelled the speaker "late", and with a platform-roster name the bogus
candidate turned needs_confirmation into a withheld borrowed-device
conflict. A trailing cue word was also kept ("This is Mina speaking." ->
"Mina speaking").

Match that pattern case-sensitively (prefix first letter either case) and
require capitalized name words. Compare stop words without a
sentence-final period, and add "ok", so "I'm OK." is not a name either.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `plugins/plugin-meetings/src/pipeline/__tests__/pipeline.test.ts` (modified, +72/-0)
```diff
@@ -389,6 +389,78 @@ describe("createMeetingTranscriptionPipeline", () => {
     });
   });
 
+  it("does not read a lowercase word after I'm or This is as a name", async () => {
+    for (const text of [
+      "Sorry, I'm late.",
+      "I'm back.",
+      "This is great.",
+      "I'm here.",
+      "I'm fine, thanks.",
+      "I'm OK.",
+    ]) {
+      const backend = new ScriptedBackend();
+      backend.enqueue({ text }, { text });
+      const pipeline = createMeetingTranscriptionPipeline(options(), backend);
+
+      pipeline.pushSpeakerAudio("track-1", seconds(2));
+      await tick(2000);
+      pipeline.pushSpeakerAudio("track-1", seconds(2));
+      await tick(2000);
+
+      const [segment] = await pipeline.finalize();
+      expect(segment?.text).toBe(text);
+      expect(segment?.speakerLabel).toBe("Speaker 1");
+      expect(segment?.speakerNameAttribution).toBeUndefined();
+    }
+  });
+
+  it("keeps a roster-only name reviewable when the speaker says I'm late", async () => {
+    const backend = new ScriptedBackend();
+    backend.enqueue({ text: "Sorry, I'm late." }, { text: "Sorry, I'm late." });
+    const pipeline = createMeetingTranscriptionPipeline(options(), backend);
+    pipeline.setSpeakerName("track-1", "Taylor Owner");
+
+    pipeline.pushSpeakerAudio("track-1", seconds(2));
+    await tick(2000);
+    pipeline.pushSpeakerAudio("track-1", seconds(2));
+    await tick(2000);
+
+    const [segment] = await pipeline.finalize();
+    expect(segment?.speakerNameAttribution).toMatchObject({
+      resolution: "needs_confirmation",
+      candidateNames: [
+        expect.objectContaining({
+          name: "Taylor Owner",
+          sources: ["platform_roster"],
+        }),
+      ],
+    });
+  });
+
+  it("takes only the capitalized name words after I'm or This is", async () => {
+    for (const [text, name] of [
+      ["Sorry, I'm late, this is Mina.", "Mina"],
+      ["This is Mina speaking.", "Mina"],
+      ["Hi, I'm Mina Chen.", "Mina Chen"],
+    ]) {
+      const backend = new ScriptedBackend();
+      backend.enqueue({ text }, { text });
+      const pipeline = createMeetingTranscriptionPipeline(options(), backend);
+
+      pipeline.pushSpeakerAudio("track-1", seconds(2));
+      await tick(2000);
+      pipeline.pushSpeakerAudio("track-1", seconds(2));
+      await tick(2000);
+
+      const [segment] = await pipeline.finalize();
+      expect(segment?.speakerNameAttribution).toMatchObject({
+        resolution: "confirmed",
+        displayName: name,
+      });
+      expect(segment?.speakerLabel).toBe(name);
+    }
+  });
+
   it("withholds same-first-name calendar candidates", async () => {
     const backend = new ScriptedBackend();
     backend.enqueue(
```

**File**: `plugins/plugin-meetings/src/pipeline/pipeline.ts` (modified, +10/-2)
```diff
@@ -57,6 +57,7 @@ const SELF_INTRODUCTION_STOP_WORDS = new Set([
   "looking",
   "not",
   "of",
+  "ok",
   "on",
   "ready",
   "sorry",
@@ -71,7 +72,10 @@ const SELF_INTRODUCTION_STOP_WORDS = new Set([
 
 const SELF_INTRODUCTION_PATTERNS = [
   /\bmy name is\s+([a-z][a-z'’.-]*(?:\s+[a-z][a-z'’.-]*){0,2})(?=[,.!?]|$|\s+(?:and|from|with|here|speaking|joining)\b)/i,
-  /\b(?:i am|i['’]?m|this is)\s+([a-z][a-z'’.-]*(?:\s+[a-z][a-z'’.-]*)?)(?=[,.!?]|$|\s+(?:and|from|with|here|speaking|joining)\b)/i,
+  // Case-sensitive: after "I'm" / "This is" only capitalized words form a name
+  // ("I'm Mina Chen"), not ordinary speech ("Sorry, I'm late.") or a trailing
+  // cue word ("This is Mina speaking.").
+  /\b(?:[Ii] am|[Ii]['’]?m|[Tt]his is)\s+([A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)?)(?=[,.!?]|$|\s+(?:and|from|with|here|speaking|joining)\b)/,
 ] as const;
 
 interface RetainedChunk {
@@ -377,7 +381,11 @@ class MeetingPipeline implements MeetingTranscriptionPipeline {
     for (const pattern of SELF_INTRODUCTION_PATTERNS) {
       const name = pattern.exec(text)?.[1]?.trim();
       if (!name) continue;
-      const words = name.toLocaleLowerCase().split(/\s+/);
+      // The capture keeps a sentence-final period ("OK."); compare without it.
+      const words = name
+        .toLocaleLowerCase()
+        .split(/\s+/)
+        .map((word) => word.replace(/\.+$/, ""));
       if (words.some((word) => SELF_INTRODUCTION_STOP_WORDS.has(word))) {
         continue;
       }
```

---

### Incident Patch 4: `c22ab905` (2026-10-05)
**Commit Message**: Merge pull request #33941 from lumix5/fix/inbox-chat-paging-bounds-33922

fix(inbox): bound chat-history paging by time window and repeated pages

**File**: `plugins/plugin-inbox/src/inbox/message-fetcher.ts` (modified, +26/-1)
```diff
@@ -295,17 +295,23 @@ function sourceNotWiredStatus(
  * inbox candidates, so the agent's own replies and blank texts must not fill
  * the window: a single capped read can come back empty while older user
  * messages exist. Pages continue until that many candidates are in hand or
- * history ends. A repeated page (a store that ignores offset) stops the scan.
+ * history ends. A repeated page (a store that ignores offset) stops the scan,
+ * as does reaching rows older than the caller's `sinceMs` window: the store
+ * returns rows newest-first, so no later page can produce a candidate. No page
+ * count caps the scan: every non-final page advances the offset until history
+ * ends, so silently returning fewer candidates than requested cannot happen.
  */
 async function loadInboxCandidateMemories(
   runtime: IAgentRuntime,
   sourceRoomIds: UUID[],
   limit: number,
   accept: (memory: Memory) => boolean,
+  sinceMs: number,
 ): Promise<Memory[]> {
   const pageSize = limit * 3;
   const filtered: Memory[] = [];
   const seenMemoryIds = new Set<string>();
+  let previousPageFingerprint: string | null = null;
   let offset = 0;
   while (filtered.length < limit) {
     const page = await runtime.getMemoriesByRoomIds({
@@ -315,20 +321,38 @@ async function loadInboxCandidateMemories(
       offset,
     });
     if (page.length === 0) break;
+    // A store that ignores offset returns the same rows for every page,
+    // including rows without an id that the seen-id guard cannot deduplicate.
+    const fingerprint = page.map(pageRowFingerprint).join("\n");
+    if (fingerprint === previousPageFingerprint) break;
+    previousPageFingerprint = fingerprint;
     let fresh = 0;
+    let oldest = Number.POSITIVE_INFINITY;
     for (const memory of page) {
+      const createdAt = Number(memory.createdAt);
+      if (Number.isFinite(createdAt) && createdAt < oldest) {
+        oldest = createdAt;
+      }
       const memoryId = typeof memory.id === "string" ? memory.id : "";
       if (memoryId.length > 0 && seenMemoryIds.has(memoryId)) continue;
       if (memoryId.length > 0) seenMemoryIds.add(memoryId);
       fresh += 1;
       if (accept(memory)) filtered.push(memory);
     }
     if (fresh === 0 || page.length < pageSize) break;
+    if (sinceMs > 0 && oldest < sinceMs) break;
     offset += page.length;
   }
   return filtered;
 }
 
+function pageRowFingerprint(memory: Memory): string {
+  if (typeof memory.id === "string" && memory.id.length > 0) {
+    return `id:${memory.id}`;
+  }
+  return `row:${String(memory.createdAt)}|${String(memory.roomId)}|${extractText(memory)}`;
+}
+
 export async function fetchChatMessages(
   runtime: IAgentRuntime,
   opts: {
@@ -384,6 +408,7 @@ export async function fetchChatMessages(
       // Blank texts are not inbox rows and must not consume a result slot.
       return extractText(memory).length > 0;
     },
+    sinceMs,
   );
 
   filtered.sort(
```

**File**: `plugins/plugin-inbox/src/inbox/message-fetcher.window.test.ts` (modified, +82/-1)
```diff
@@ -3,7 +3,8 @@
  * A raw window of limit*3 that is filled by the agent's own replies, or a
  * newer blank text that is discarded after the cut, used to hide older user
  * messages. The store stub honors limit and offset so a missing second page
- * fails the test.
+ * fails the test. Deterministic harness: stubbed runtime and in-memory rows,
+ * no database or network.
  */
 import type { IAgentRuntime, Memory, Room, UUID } from "@elizaos/core";
 import { ChannelType } from "@elizaos/core";
@@ -84,6 +85,25 @@ describe("fetchChatMessages candidate window", () => {
     ]);
   });
 
+  it("has no page cap: fills the limit past ten pages of agent replies", async () => {
+    const stored = [
+      ...Array.from({ length: 66 }, (_, index) =>
+        memory(`agent-${index}`, 2_000 - index, `agent reply ${index}`, AGENT),
+      ),
+      memory("user-below-cap", 1_900, "reached on the eleventh page"),
+      memory("user-oldest", 1_800, "oldest ask"),
+    ];
+    const { runtime, reads } = runtimeFor(stored);
+
+    const messages = await fetchChatMessages(runtime, { limit: 2 });
+
+    expect(messages.map((message) => message.text)).toEqual([
+      "reached on the eleventh page",
+      "oldest ask",
+    ]);
+    expect(reads.length).toEqual(12);
+  });
+
   it("does not let a newer blank message consume the result limit", async () => {
     const stored = [
       memory("blank", 1_000, ""),
@@ -147,4 +167,65 @@ describe("fetchChatMessages candidate window", () => {
       { limit: 6, offset: 6 },
     ]);
   });
+
+  it("stops after one read when history is entirely older than sinceIso", async () => {
+    const now = Date.now();
+    const stored = Array.from({ length: 6 }, (_, index) =>
+      memory(`old-${index}`, now - 86_400_000 - index, `old message ${index}`),
+    );
+    const { runtime, reads } = runtimeFor(stored);
+
+    const messages = await fetchChatMessages(runtime, {
+      limit: 2,
+      sinceIso: new Date(now - 3_600_000).toISOString(),
+    });
+
+    expect(messages).toEqual([]);
+    expect(reads).toEqual([{ limit: 6, offset: 0 }]);
+  });
+
+  it("stops when an offset-ignoring store repeats rows without ids", async () => {
+    const page = Array.from({ length: 6 }, (_, index) => {
+      const row = memory(
+        `agent-${index}`,
+        1_000 - index,
+        `agent reply ${index}`,
+        AGENT,
+      );
+      delete (row as { id?: unknown }).id;
+      return row;
+    });
+    const reads: Array<{ limit?: number; offset?: number }> = [];
+    const room: Room = {
+      id: ROOM,
+      name: "general",
+      source: "discord",
+      type: ChannelType.GROUP,
+      channelId: "100",
+      serverId: "200",
+    };
+    const runtime = {
+      agentId: AGENT,
+      getRoomsForParticipant: async () => [ROOM],
+      getRoomsByIds: async () => [room],
+      getMemoriesByRoomIds: async (params: {
+        limit?: number;
+        offset?: number;
+      }) => {
+        reads.push({ limit: params.limit, offset: params.offset });
+        return page;
+      },
+      getParticipantsForRooms: async (ids: UUID[]) =>
+        ids.map((roomId) => ({ roomId, entityIds: [AGENT, USER] })),
+      getWorldsByIds: async () => [],
+    } as unknown as IAgentRuntime;
+
+    const messages = await fetchChatMessages(runtime, { limit: 2 });
+
+    expect(messages).toEqual([]);
+    expect(reads).toEqual([
+      { limit: 6, offset: 0 },
+      { limit: 6, offset: 6 },
+    ]);
+  });
 });
```

---

### Incident Patch 5: `2e6a2b02` (2026-10-05)
**Commit Message**: fix(browser): keep action previews independent of product identity (#33942)

Co-authored-by: Shaw <[REDACTED_EMAIL]>

**File**: `packages/os/browser/scripts/build.mjs` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ await writeFile(
     {
       manifest_version: 3,
       name: "Eliza Browser Control",
-      version: "2.0.5",
+      version: "2.0.6",
       key: identity.chromeDevManifestKey,
       description:
         "Native, authenticated control of this Chromium profile for your Eliza agent.",
```

**File**: `packages/os/browser/scripts/test-task-guidance.mjs` (modified, +9/-6)
```diff
@@ -178,12 +178,15 @@ try {
         expiresAt: Date.now() + 30000,
       },
     });
-    assert.equal(reply.ok, true);
-    await new Promise((resolve) => setTimeout(resolve, 150));
-    assert.equal(
-      await evaluate("globalThis.__elizaPageGuidanceV1.visible"),
-      true,
-    );
+    assert.equal(reply.ok, true, JSON.stringify(reply));
+    const visibleDeadline = Date.now() + 3000;
+    while (!(await evaluate("globalThis.__elizaPageGuidanceV1.visible"))) {
+      assert.ok(
+        Date.now() < visibleDeadline,
+        "Bound guidance did not become visible",
+      );
+      await new Promise((resolve) => setTimeout(resolve, 20));
+    }
     return id;
   };
   const hidden = async () =>
```

**File**: `packages/os/browser/src/task-guidance.mjs` (modified, +3/-3)
```diff
@@ -134,9 +134,9 @@ export function createTaskGuidance(api, authorize) {
               expiresAt,
               action: command.subaction,
               text: {
-                click: "Eliza will select this control.",
-                fill: "Eliza will enter the approved information here.",
-                scroll: "Eliza will scroll this area.",
+                click: "I will select this control.",
+                fill: "I will enter the approved information here.",
+                scroll: "I will scroll this area.",
               }[command.subaction],
             },
           ]);
```

---

### Incident Patch 6: `af41ecff` (2026-10-05)
**Commit Message**: fix(inbox): drop the silent 10-page scan cap

Termination is already guaranteed without the cap: the empty-page,
repeated-fingerprint, all-seen, short-page, and sinceMs guards each end
the scan. The cap instead silently returned fewer than the caller's
limit (possibly nothing) in rooms with more than ten pages of
non-candidate rows when no sinceIso window bounded the scan - the
original #33922 symptom, hidden as healthy empty data.

Restore the unbounded while (filtered.length < limit) loop and pin the
behavior with a regression test that pages eleven deep past agent-only
pages; it fails under the old cap and passes after this change.

**File**: `plugins/plugin-inbox/src/inbox/message-fetcher.ts` (modified, +4/-4)
```diff
@@ -297,8 +297,9 @@ function sourceNotWiredStatus(
  * messages exist. Pages continue until that many candidates are in hand or
  * history ends. A repeated page (a store that ignores offset) stops the scan,
  * as does reaching rows older than the caller's `sinceMs` window: the store
- * returns rows newest-first, so no later page can produce a candidate. A page
- * cap bounds rooms dominated by non-candidate rows when no window is given.
+ * returns rows newest-first, so no later page can produce a candidate. No page
+ * count caps the scan: every non-final page advances the offset until history
+ * ends, so silently returning fewer candidates than requested cannot happen.
  */
 async function loadInboxCandidateMemories(
   runtime: IAgentRuntime,
@@ -308,12 +309,11 @@ async function loadInboxCandidateMemories(
   sinceMs: number,
 ): Promise<Memory[]> {
   const pageSize = limit * 3;
-  const maxPages = 10;
   const filtered: Memory[] = [];
   const seenMemoryIds = new Set<string>();
   let previousPageFingerprint: string | null = null;
   let offset = 0;
-  for (let pages = 0; filtered.length < limit && pages < maxPages; pages++) {
+  while (filtered.length < limit) {
     const page = await runtime.getMemoriesByRoomIds({
       roomIds: sourceRoomIds,
       tableName: "messages",
```

**File**: `plugins/plugin-inbox/src/inbox/message-fetcher.window.test.ts` (modified, +19/-0)
```diff
@@ -85,6 +85,25 @@ describe("fetchChatMessages candidate window", () => {
     ]);
   });
 
+  it("has no page cap: fills the limit past ten pages of agent replies", async () => {
+    const stored = [
+      ...Array.from({ length: 66 }, (_, index) =>
+        memory(`agent-${index}`, 2_000 - index, `agent reply ${index}`, AGENT),
+      ),
+      memory("user-below-cap", 1_900, "reached on the eleventh page"),
+      memory("user-oldest", 1_800, "oldest ask"),
+    ];
+    const { runtime, reads } = runtimeFor(stored);
+
+    const messages = await fetchChatMessages(runtime, { limit: 2 });
+
+    expect(messages.map((message) => message.text)).toEqual([
+      "reached on the eleventh page",
+      "oldest ask",
+    ]);
+    expect(reads.length).toEqual(12);
+  });
+
   it("does not let a newer blank message consume the result limit", async () => {
     const stored = [
       memory("blank", 1_000, ""),
```

---

### Incident Patch 7: `b66337b3` (2026-10-05)
**Commit Message**: fix(inbox): bound chat-history paging by time window and repeated pages

fetchChatMessages pages past the agent's own replies to fill the caller's
limit, but the pager kept scanning after the sinceIso window was exhausted
and never terminated when a store repeated rows without ids.

Stop the scan once the oldest row of a page is older than sinceMs
(newest-first order guarantees later pages cannot match), stop on an
identical consecutive page fingerprint (covers id-less repeats the
seen-id guard cannot catch), and cap the scan at 10 pages.

Relates to elizaOS/eliza#33922.

**File**: `plugins/plugin-inbox/src/inbox/message-fetcher.ts` (modified, +27/-2)
```diff
@@ -295,40 +295,64 @@ function sourceNotWiredStatus(
  * inbox candidates, so the agent's own replies and blank texts must not fill
  * the window: a single capped read can come back empty while older user
  * messages exist. Pages continue until that many candidates are in hand or
- * history ends. A repeated page (a store that ignores offset) stops the scan.
+ * history ends. A repeated page (a store that ignores offset) stops the scan,
+ * as does reaching rows older than the caller's `sinceMs` window: the store
+ * returns rows newest-first, so no later page can produce a candidate. A page
+ * cap bounds rooms dominated by non-candidate rows when no window is given.
  */
 async function loadInboxCandidateMemories(
   runtime: IAgentRuntime,
   sourceRoomIds: UUID[],
   limit: number,
   accept: (memory: Memory) => boolean,
+  sinceMs: number,
 ): Promise<Memory[]> {
   const pageSize = limit * 3;
+  const maxPages = 10;
   const filtered: Memory[] = [];
   const seenMemoryIds = new Set<string>();
+  let previousPageFingerprint: string | null = null;
   let offset = 0;
-  while (filtered.length < limit) {
+  for (let pages = 0; filtered.length < limit && pages < maxPages; pages++) {
     const page = await runtime.getMemoriesByRoomIds({
       roomIds: sourceRoomIds,
       tableName: "messages",
       limit: pageSize,
       offset,
     });
     if (page.length === 0) break;
+    // A store that ignores offset returns the same rows for every page,
+    // including rows without an id that the seen-id guard cannot deduplicate.
+    const fingerprint = page.map(pageRowFingerprint).join("\n");
+    if (fingerprint === previousPageFingerprint) break;
+    previousPageFingerprint = fingerprint;
     let fresh = 0;
+    let oldest = Number.POSITIVE_INFINITY;
     for (const memory of page) {
+      const createdAt = Number(memory.createdAt);
+      if (Number.isFinite(createdAt) && createdAt < oldest) {
+        oldest = createdAt;
+      }
       const memoryId = typeof memory.id === "string" ? memory.id : "";
       if (memoryId.length > 0 && seenMemoryIds.has(memoryId)) continue;
       if (memoryId.length > 0) seenMemoryIds.add(memoryId);
       fresh += 1;
       if (accept(memory)) filtered.push(memory);
     }
     if (fresh === 0 || page.length < pageSize) break;
+    if (sinceMs > 0 && oldest < sinceMs) break;
     offset += page.length;
   }
   return filtered;
 }
 
+function pageRowFingerprint(memory: Memory): string {
+  if (typeof memory.id === "string" && memory.id.length > 0) {
+    return `id:${memory.id}`;
+  }
+  return `row:${String(memory.createdAt)}|${String(memory.roomId)}|${extractText(memory)}`;
+}
+
 export async function fetchChatMessages(
   runtime: IAgentRuntime,
   opts: {
@@ -384,6 +408,7 @@ export async function fetchChatMessages(
       // Blank texts are not inbox rows and must not consume a result slot.
       return extractText(memory).length > 0;
     },
+    sinceMs,
   );
 
   filtered.sort(
```

**File**: `plugins/plugin-inbox/src/inbox/message-fetcher.window.test.ts` (modified, +63/-1)
```diff
@@ -3,7 +3,8 @@
  * A raw window of limit*3 that is filled by the agent's own replies, or a
  * newer blank text that is discarded after the cut, used to hide older user
  * messages. The store stub honors limit and offset so a missing second page
- * fails the test.
+ * fails the test. Deterministic harness: stubbed runtime and in-memory rows,
+ * no database or network.
  */
 import type { IAgentRuntime, Memory, Room, UUID } from "@elizaos/core";
 import { ChannelType } from "@elizaos/core";
@@ -147,4 +148,65 @@ describe("fetchChatMessages candidate window", () => {
       { limit: 6, offset: 6 },
     ]);
   });
+
+  it("stops after one read when history is entirely older than sinceIso", async () => {
+    const now = Date.now();
+    const stored = Array.from({ length: 6 }, (_, index) =>
+      memory(`old-${index}`, now - 86_400_000 - index, `old message ${index}`),
+    );
+    const { runtime, reads } = runtimeFor(stored);
+
+    const messages = await fetchChatMessages(runtime, {
+      limit: 2,
+      sinceIso: new Date(now - 3_600_000).toISOString(),
+    });
+
+    expect(messages).toEqual([]);
+    expect(reads).toEqual([{ limit: 6, offset: 0 }]);
+  });
+
+  it("stops when an offset-ignoring store repeats rows without ids", async () => {
+    const page = Array.from({ length: 6 }, (_, index) => {
+      const row = memory(
+        `agent-${index}`,
+        1_000 - index,
+        `agent reply ${index}`,
+        AGENT,
+      );
+      delete (row as { id?: unknown }).id;
+      return row;
+    });
+    const reads: Array<{ limit?: number; offset?: number }> = [];
+    const room: Room = {
+      id: ROOM,
+      name: "general",
+      source: "discord",
+      type: ChannelType.GROUP,
+      channelId: "100",
+      serverId: "200",
+    };
+    const runtime = {
+      agentId: AGENT,
+      getRoomsForParticipant: async () => [ROOM],
+      getRoomsByIds: async () => [room],
+      getMemoriesByRoomIds: async (params: {
+        limit?: number;
+        offset?: number;
+      }) => {
+        reads.push({ limit: params.limit, offset: params.offset });
+        return page;
+      },
+      getParticipantsForRooms: async (ids: UUID[]) =>
+        ids.map((roomId) => ({ roomId, entityIds: [AGENT, USER] })),
+      getWorldsByIds: async () => [],
+    } as unknown as IAgentRuntime;
+
+    const messages = await fetchChatMessages(runtime, { limit: 2 });
+
+    expect(messages).toEqual([]);
+    expect(reads).toEqual([
+      { limit: 6, offset: 0 },
+      { limit: 6, offset: 6 },
+    ]);
+  });
 });
```

---

### Incident Patch 8: `424c22c9` (2026-10-05)
**Commit Message**: fix(app): preserve existing installation recovery during cleanup

**File**: `packages/app/platforms/electrobun/src/native/agent-existing-state.test.ts` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+import { expect, it, vi } from "vitest";
+
+vi.mock("electrobun/bun", () => ({ Utils: {} }));
+
+import { inspectExistingElizaInstall } from "./agent";
+
+it("discovers a prior dot-directory installation rather than reporting a fresh install", () => {
+	const home = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-state-upgrade-"));
+	try {
+		const state = path.join(home, ".eliza");
+		fs.mkdirSync(state);
+		fs.writeFileSync(path.join(state, "eliza.json"), "{}");
+		expect(
+			inspectExistingElizaInstall({ homedir: home, env: {} }),
+		).toMatchObject({
+			detected: true,
+			stateDir: state,
+			source: "legacy-dot-state-dir",
+		});
+	} finally {
+		fs.rmSync(home, { recursive: true, force: true });
+	}
+});
+
+it("prefers the current state directory over an older dot-directory install", () => {
+	const home = fs.mkdtempSync(
+		path.join(os.tmpdir(), "desktop-state-priority-"),
+	);
+	try {
+		const current = path.join(home, ".local", "state", "eliza");
+		for (const state of [current, path.join(home, ".eliza")]) {
+			fs.mkdirSync(state, { recursive: true });
+			fs.writeFileSync(path.join(state, "eliza.json"), "{}");
+		}
+		expect(
+			inspectExistingElizaInstall({ homedir: home, env: {} }),
+		).toMatchObject({
+			detected: true,
+			stateDir: current,
+			source: "default-state-dir",
+		});
+	} finally {
+		fs.rmSync(home, { recursive: true, force: true });
+	}
+});
+
+it("does not adopt another product's legacy state directory", () => {
+	const home = fs.mkdtempSync(
+		path.join(os.tmpdir(), "desktop-state-namespace-"),
+	);
+	try {
+		const other = path.join(home, ".eliza");
+		fs.mkdirSync(other);
+		fs.writeFileSync(path.join(other, "eliza.json"), "{}");
+		expect(
+			inspectExistingElizaInstall({
+				homedir: home,
+				env: { ELIZA_NAMESPACE: "isolated-product" },
+			}).detected,
+		).toBe(false);
+	} finally {
+		fs.rmSync(home, { recursive: true, force: true });
+	}
+});
```

**File**: `packages/app/platforms/electrobun/src/native/agent.ts` (modified, +17/-0)
```diff
@@ -288,6 +288,15 @@ function resolveDefaultDesktopStateDir(opts?: {
 	const env = opts?.env ?? process.env;
 	return joinPortable(resolveXdgStateHome(opts), resolveStateNamespace(env));
 }
+function resolveLegacyDotStateDir(opts?: {
+	env?: NodeJS.ProcessEnv;
+	homedir?: string;
+}): string {
+	return joinPortable(
+		opts?.homedir ?? os.homedir(),
+		`.${resolveStateNamespace(opts?.env ?? process.env)}`,
+	);
+}
 export function resolveDesktopChildStateDir(opts?: {
 	env?: NodeJS.ProcessEnv;
 	homedir?: string;
@@ -341,6 +350,7 @@ function buildExistingElizaInstallCandidates(opts?: {
 	const configPathFromEnv = normalizeEnvPath(env.ELIZA_CONFIG_PATH);
 	const stateDirFromEnv = resolveExplicitStateDir(env);
 	const defaultStateDir = resolveDefaultDesktopStateDir({ env, homedir });
+	const legacyStateDir = resolveLegacyDotStateDir({ env, homedir });
 	const candidates = [
 		configPathFromEnv
 			? {
@@ -361,6 +371,13 @@ function buildExistingElizaInstallCandidates(opts?: {
 			stateDir: defaultStateDir,
 			configPath: joinPortable(defaultStateDir, ELIZA_CONFIG_FILENAME),
 		},
+		legacyStateDir !== defaultStateDir
+			? {
+					source: "legacy-dot-state-dir" as const,
+					stateDir: legacyStateDir,
+					configPath: joinPortable(legacyStateDir, ELIZA_CONFIG_FILENAME),
+				}
+			: null,
 	].filter((candidate): candidate is NonNullable<typeof candidate> =>
 		Boolean(candidate),
 	);
```

**File**: `packages/app/src/dev/ChatWidgetHarness.test.tsx` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+/** Verifies ChatWidgetHarness through the package's configured test harness. */
+// @vitest-environment jsdom
+
+import { cleanup, render, screen } from "@testing-library/react";
+import userEvent from "@testing-library/user-event";
+import { afterEach, describe, expect, it, vi } from "vitest";
+
+vi.mock("../../../ui/src/api/client", () => ({
+  client: {
+    getCodingAgentTaskThread: vi.fn().mockResolvedValue(null),
+    onWsEvent: vi.fn(() => () => undefined),
+  },
+}));
+
+import { ChatWidgetHarness } from "./ChatWidgetHarness";
+
+describe("ChatWidgetHarness", () => {
+  afterEach(cleanup);
+
+  it("renders the backend-free widget transcript", () => {
+    render(<ChatWidgetHarness />);
+
+    const harness = screen.getByTestId("chat-widget-harness");
+    expect(harness).toBeTruthy();
+    expect(harness.querySelector('[class*="backdrop-blur"]')).toBeNull();
+    expect(harness.querySelector('[class*="focus-visible:ring-0"]')).toBeNull();
+    expect(screen.getByText("Choice")).toBeTruthy();
+    expect(screen.getByText("Structured form")).toBeTruthy();
+    expect(screen.getByText("Workflow")).toBeTruthy();
+    expect(screen.getByText("Checklist")).toBeTruthy();
+    expect(screen.getByText("Code block")).toBeTruthy();
+  });
+
+  it("keeps composer interactions entirely in local state", async () => {
+    const user = userEvent.setup();
+    render(<ChatWidgetHarness />);
+
+    const composer = screen.getByRole("textbox", { name: "Gallery message" });
+    await user.type(composer, "Test the keyboard");
+    await user.click(
+      screen.getByRole("button", { name: "Send local message" }),
+    );
+
+    expect(screen.getByText("Test the keyboard")).toBeTruthy();
+    expect(screen.getByText(/Mock response added/)).toBeTruthy();
+    expect((composer as HTMLTextAreaElement).value).toBe("");
+  });
+});
```

**File**: `packages/app/src/renderer/startup/startup-cloud-tier-upgrade.test.ts` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+// @vitest-environment jsdom
+import { afterEach, beforeEach, expect, test, vi } from "vitest";
+
+vi.mock(
+  "@elizaos/plugin-elizacloud/steward-session-client",
+  async (importOriginal) => ({
+    ...(await importOriginal<
+      typeof import("@elizaos/plugin-elizacloud/steward-session-client")
+    >()),
+    readStoredStewardToken: () => "fixture-owner-token",
+    writeStoredStewardToken: vi.fn(),
+    clearStoredStewardToken: vi.fn(),
+    hasStewardAuthedCookie: () => false,
+  }),
+);
+
+import {
+  buildCloudSharedAgentApiBase,
+  buildDedicatedCloudAgentApiBase,
+  clearPersistedActiveServer,
+  loadPersistedActiveServer,
+  type PersistedActiveServer,
+  savePersistedActiveServer,
+} from "@elizaos/ui";
+import { applyRestoredConnection } from "./startup-phase-restore";
+
+const id = "11111111-1111-4111-8111-111111111111";
+const active: PersistedActiveServer = {
+  id: `cloud:${id}`,
+  kind: "cloud",
+  label: "Existing cloud agent",
+  apiBase:
+    buildDedicatedCloudAgentApiBase(id, "https://eliza.app") ?? undefined,
+};
+beforeEach(() => {
+  localStorage.clear();
+  savePersistedActiveServer(active);
+});
+afterEach(() => {
+  vi.unstubAllGlobals();
+  localStorage.clear();
+});
+test("an existing shared bridge saved as dedicated restores using authenticated owner evidence", async () => {
+  const fetcher = vi.fn(
+    async (_url: string, _options: RequestInit) =>
+      new Response(JSON.stringify({ data: { executionTier: "shared" } })),
+  );
+  vi.stubGlobal("fetch", fetcher);
+  const clientRef = { setBaseUrl: vi.fn(), setToken: vi.fn() };
+  await applyRestoredConnection({ restoredActiveServer: active, clientRef });
+  await vi.waitFor(() =>
+    expect(clientRef.setBaseUrl).toHaveBeenLastCalledWith(
+      buildCloudSharedAgentApiBase("https://api.eliza.app", id),
+    ),
+  );
+  expect(
+    new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization"),
+  ).toBe("Bearer fixture-owner-token");
+  expect(clientRef.setToken).toHaveBeenLastCalledWith("fixture-owner-token");
+});
+test("a delayed tier lookup cannot replace the user's newer target", async () => {
+  let resolve!: (value: Response) => void;
+  vi.stubGlobal(
+    "fetch",
+    vi.fn(
+      () =>
+        new Promise<Response>((done) => {
+          resolve = done;
+        }),
+    ),
+  );
+  const clientRef = { setBaseUrl: vi.fn(), setToken: vi.fn() };
+  await applyRestoredConnection({ restoredActiveServer: active, clientRef });
+  expect(resolve).toBeTypeOf("function");
+  const newer = {
+    id: "remote:new",
+    kind: "remote" as const,
+    label: "New selection",
+    apiBase: "http://127.0.0.1:3333",
+  };
+  savePersistedActiveServer(newer);
+  clientRef.setBaseUrl.mockClear();
+  resolve(new Response(JSON.stringify({ data: { executionTier: "shared" } })));
+  await new Promise((done) => setTimeout(done, 20));
+  expect(loadPersistedActiveServer()?.id).toBe(newer.id);
+  expect(clientRef.setBaseUrl).not.toHaveBeenCalled();
+});
+
+test("a delayed tier lookup cannot restore a logged-out selection", async () => {
+  let resolve!: (value: Response) => void;
+  vi.stubGlobal(
+    "fetch",
+    vi.fn(
+      () =>
+        new Promise<Response>((done) => {
+          resolve = done;
+        }),
+    ),
+  );
+  const clientRef = { setBaseUrl: vi.fn(), setToken: vi.fn() };
+  await applyRestoredConnection({ restoredActiveServer: active, clientRef });
+  clearPersistedActiveServer();
+  clientRef.setBaseUrl.mockClear();
+  clientRef.setToken.mockClear();
+  resolve(new Response(JSON.stringify({ data: { executionTier: "shared" } })));
+  await new Promise((done) => setTimeout(done, 20));
+  expect(loadPersistedActiveServer()).toBeNull();
+  expect(clientRef.setBaseUrl).not.toHaveBeenCalled();
+  expect(clientRef.setToken).not.toHaveBeenCalled();
+});
+
+test("restores a retained owner-bound pair token without adopting the legacy global key", async () => {
+  const owned = { ...active, accessToken: "retained-agent-token" };
+  savePersistedActiveServer(owned);
+  localStorage.setItem("eliza:cloud-pair:api-token", "unrelated-legacy-token");
+  vi.stubGlobal(
+    "fetch",
+    vi.fn(
+      async () =>
+        new Response(JSON.stringify({ data: { executionTier: "dedicated" } })),
+    ),
+  );
+  const clientRef = { setBaseUrl: vi.fn(), setToken: vi.fn() };
+  await applyRestoredConnection({ restoredActiveServer: owned, clientRef });
+  await new Promise((done) => setTimeout(done, 20));
+  expect(clientRef.setToken).toHaveBeenLastCalledWith("retained-agent-token");
+  expect(loadPersistedActiveServer()?.accessToken).toBe("retained-agent-token");
+});
```

**File**: `packages/app/src/renderer/startup/startup-phase-restore.ts` (modified, +86/-1)
```diff
@@ -92,6 +92,9 @@ const STEWARD_RESTORE_REFRESH_AHEAD_SECS = 120;
  */
 const STEWARD_RESTORE_REFRESH_TIMEOUT_MS =
   STARTUP_TIMING_POLICY.stewardRestoreRefreshTimeoutMs;
+/** Bound the non-blocking legacy runtime-tier repair lookup. */
+const CLOUD_AGENT_TIER_PROBE_TIMEOUT_MS =
+  STARTUP_TIMING_POLICY.probeRequestTimeoutMs;
 /** Steward refresh endpoint path (same-origin on web; `api.` host on native). */
 const STEWARD_REFRESH_PATH = "/api/auth/steward-refresh";
 /** Default direct Cloud site base used to derive the native refresh endpoint. */
@@ -109,7 +112,58 @@ function recoverCloudAgentId(active: PersistedActiveServer): string | null {
   return isCloudPairAgentId(baseAgentId) ? baseAgentId : null;
 }
 /**
- * Resolve a restored managed-cloud target using the current environment.
+ * Repair an older persisted dedicated-looking base when the owner record says
+ * it is actually a temporary shared bridge. This runs off the startup critical
+ * path: an inconclusive lookup leaves the already-bound target untouched.
+ */
+async function reconcileLegacyDedicatedCloudApiBase(
+  active: PersistedActiveServer,
+  ownerToken: string | null,
+): Promise<PersistedActiveServer | null> {
+  if (!ownerToken || !isDedicatedCloudAgentBase(active.apiBase)) return null;
+  const agentId = recoverCloudAgentId(active);
+  if (!agentId) return null;
+  const pageHostname =
+    typeof window !== "undefined" ? window.location.hostname : "";
+  const cloudApiBase = resolveDirectCloudAuthApiBase(
+    resolveCloudEnvironmentBase({
+      pageHostname,
+      apiBase: active.apiBase,
+      bootCloudApiBase: getBootConfig().cloudApiBase,
+      fallback: RESTORE_DEFAULT_DIRECT_CLOUD_BASE_URL,
+    }),
+  );
+  try {
+    const response = await fetch(
+      `${cloudApiBase}/api/v1/eliza/agents/${encodeURIComponent(agentId)}`,
+      {
+        headers: {
+          Accept: "application/json",
+          Authorization: `Bearer ${ownerToken}`,
+        },
+        signal: AbortSignal.timeout(CLOUD_AGENT_TIER_PROBE_TIMEOUT_MS),
+      },
+    );
+    if (!response.ok) return null;
+    const payload: unknown = await response.json();
+    if (typeof payload !== "object" || payload === null) return null;
+    const data = (payload as Record<string, unknown>).data;
+    if (typeof data !== "object" || data === null) return null;
+    const tier = (data as Record<string, unknown>).executionTier;
+    if (tier !== "shared") return null;
+    return {
+      ...active,
+      apiBase: buildCloudSharedAgentApiBase(cloudApiBase, agentId),
+    };
+  } catch {
+    // error-policy:J4 this is a compatibility repair probe; the normal startup
+    // poll remains authoritative when the control plane is temporarily down.
+    return null;
+  }
+}
+/**
+ * Repair a restored managed-cloud target using the current environment and,
+ * for legacy dedicated-looking records, the server-authoritative runtime tier.
  *
  * Environment priority for dedicated ingress rebuild:
  * live Cloud page host → already-staging persisted base → boot config → prod
@@ -533,6 +587,15 @@ export async function applyRestoredConnection(args: {
       clientRef.setBaseUrl(null);
       return;
     }
+    // The compatibility lookup must use the post-refresh authority. The stored
+    // pre-refresh JWT can be expired, while native/Electrobun restores may
+    // intentionally rely on a host-injected Cloud owner key instead.
+    const controlPlaneOwnerToken = stewardToken ?? nativeOwnerApiKey;
+    const tierRepairPromise =
+      !isManagedSharedControlPlane &&
+      isDedicatedCloudAgentBase(restoredActiveServer.apiBase)
+        ? reconcileLegacyDedicatedCloudApiBase(resolved, controlPlaneOwnerToken)
+        : Promise.resolve(null);
     // Dedicated agent subdomains and explicit local-Docker pair targets use an
     // agent-local bearer for `/api/*`. The edge-owned dedicated path can keep
     // its Steward recovery fallback; a loopback process must never receive a
@@ -551,6 +614,28 @@ export async function applyRestoredConnection(args: {
                 resolved.accessToken ||
                 null,
     );
+    void tierRepairPromise.then((repaired) => {
+      if (!repaired || repaired.apiBase === resolved.apiBase) return;
+      if (!isTrustedCloudApiBaseUrl(repaired.apiBase, agentId)) return;
+      const current = loadPersistedActiveServer();
+      // A user can switch agents while the compatibility probe is in flight.
+      // A cleared selection is logout, not permission to restore the old one.
+      if (
+        !current ||
+        current.id !== resolved.id ||
+        current.apiBase !== resolved.apiBase ||
+        current.accessToken !== resolved.accessToken ||
+        (stewardToken && readStoredStewardToken() !== stewardToken)
+      ) {
+        return;
+      }
+      savePersistedActiveServer(repaired);
+      clientRef.setToken(null);
+      clientRef.setBaseUrl(repaired.apiBase ?? null);
+      // A shared adapter is a Cloud contro
```

**File**: `packages/app/src/security/hydrate-wallet-keys-from-platform-store.ts` (modified, +71/-1)
```diff
@@ -1,6 +1,7 @@
 /**
  * Boot-time hydration of wallet (and steward) secrets into `process.env`.
- * Wallet keys are read from the shared vault;
+ * Wallet keys are read from the shared vault (now the source of truth), with a
+ * one-shot migration of any legacy values still only in the OS keystore;
  * steward env vars stay on the OS-keystore path because that backend's
  * lifecycle is independent of the unified vault.
  *
@@ -88,15 +89,84 @@ function hasLaunchEnvValue(envKey: keyof NodeJS.ProcessEnv): boolean {
     ? true
     : walletEnvBootBaseline.has(String(envKey));
 }
+/**
+ * One-shot copy of legacy OS-keystore wallet keys into the shared vault.
+ * Returns the env keys that were copied across so the caller can log /
+ * surface a migration banner.
+ */
+async function migrateOsStoreWalletKeysIntoVault(
+  envKeys: ReadonlyArray<keyof NodeJS.ProcessEnv>,
+): Promise<string[]> {
+  if (envKeys.length === 0) return [];
+  if (!isWalletOsStoreReadEnabled()) return [];
+  const store = createNodePlatformSecureStore();
+  if (!(await store.isAvailable())) return [];
+  const vault = sharedVault();
+  const vaultId = deriveAgentVaultId();
+  const keychainKindFor: Record<string, SecureStoreSecretKind> = {
+    EVM_PRIVATE_KEY: "wallet.evm_private_key",
+    SOLANA_PRIVATE_KEY: "wallet.solana_private_key",
+  };
+  const migrated: string[] = [];
+  for (const envKey of envKeys) {
+    const kind = keychainKindFor[envKey as string];
+    if (!kind) continue;
+    const got = await store.get(vaultId, kind);
+    if (!got.ok) continue;
+    process.env[envKey] = got.value;
+    if (!(await vault.has(envKey as string))) {
+      await vault.set(envKey as string, got.value, {
+        sensitive: true,
+        caller: "wallet-os-store-migrate",
+      });
+      migrated.push(String(envKey));
+    }
+  }
+  return migrated;
+}
+/**
+ * Fills `process.env` wallet keys from the shared vault (now the source
+ * of truth). On first boot after the storage unification, copies any
+ * legacy OS-keystore values into the vault and then proceeds normally.
+ *
+ * Steward env vars stay on the OS-keystore path — the steward backend's
+ * lifecycle is independent of the unified wallet vault.
+ *
+ * Persisted config only fills gaps that neither vault nor OS keystore
+ * supplies — by call ordering on pre-merge callers, and via the captured
+ * pre-merge baseline (see module header) on the deferred agent boot path.
+ */
 export async function hydrateWalletKeysFromNodePlatformSecureStore(): Promise<void> {
+  // ── 1. Vault read for wallet keys ────────────────────────────────
   const vault = sharedVault();
+  const missingWalletKeys: Array<keyof NodeJS.ProcessEnv> = [];
   for (const envKey of walletVaultKeys()) {
     if (hasLaunchEnvValue(envKey)) continue;
     if (await vault.has(envKey as string)) {
       const value = await vault.reveal(envKey as string, "wallet-hydrate-boot");
       process.env[envKey] = value;
+      continue;
+    }
+    missingWalletKeys.push(envKey);
+  }
+  // ── 2. One-shot migration from OS keystore for any wallet keys
+  //      that the vault did not have. ──────────────────────────────
+  if (missingWalletKeys.length > 0) {
+    try {
+      const migrated =
+        await migrateOsStoreWalletKeysIntoVault(missingWalletKeys);
+      if (migrated.length > 0) {
+        logger.info(
+          `[wallet][vault] migrated ${migrated.length} key(s) from OS keystore: ${migrated.join(", ")}`,
+        );
+      }
+    } catch (err) {
+      logger.warn(
+        `[wallet][vault] os-store migration failed: ${err instanceof Error ? err.message : String(err)}`,
+      );
     }
   }
+  // ── 3. Steward OS-keystore reads ─────────────────────────────────
   // A development launcher owns this entire operational tuple. Project its
   // frozen values back after persisted-config merging and never consult the OS
   // store: default-staging/offline stay disabled, while explicit targets
```

**File**: `packages/app/src/security/wallet-legacy-upgrade.test.ts` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+import { createTestVault, type TestVault } from "@elizaos/auth/testing";
+import { afterEach, beforeEach, expect, it, vi } from "vitest";
+import { _resetSharedVaultForTesting } from "../services/vault-mirror";
+import {
+  _resetWalletEnvBootBaselineForTest,
+  hydrateWalletKeysFromNodePlatformSecureStore,
+} from "./hydrate-wallet-keys-from-platform-store";
+import { deleteWalletSecrets } from "./wallet-secrets";
+
+const legacy = vi.hoisted(() => ({ values: new Map<string, string>() }));
+vi.mock("./platform-secure-store-node", () => ({
+  isWalletOsStoreReadEnabled: () => true,
+  createNodePlatformSecureStore: () => ({
+    isAvailable: async () => true,
+    get: async (_vault: string, kind: string) => {
+      const value = legacy.values.get(kind);
+      return value === undefined
+        ? { ok: false, reason: "not_found" }
+        : { ok: true, value };
+    },
+    delete: async (_vault: string, kind: string) => ({
+      ok: true,
+      deleted: legacy.values.delete(kind),
+    }),
+  }),
+}));
+let vault: TestVault;
+beforeEach(async () => {
+  for (const key of [
+    "EVM_PRIVATE_KEY",
+    "SOLANA_PRIVATE_KEY",
+    "STEWARD_API_URL",
+    "STEWARD_TENANT_ID",
+    "STEWARD_AGENT_ID",
+    "STEWARD_API_KEY",
+    "STEWARD_AGENT_TOKEN",
+  ])
+    vi.stubEnv(key, undefined);
+  legacy.values.clear();
+  _resetWalletEnvBootBaselineForTest();
+  vault = await createTestVault();
+  _resetSharedVaultForTesting(vault.vault);
+  await vault.vault.has("EVM_PRIVATE_KEY");
+}, 30_000);
+afterEach(async () => {
+  _resetSharedVaultForTesting();
+  _resetWalletEnvBootBaselineForTest();
+  await vault.dispose();
+  vi.unstubAllEnvs();
+});
+it("recovers an existing OS-only wallet into the shared vault", async () => {
+  legacy.values.set("wallet.evm_private_key", "legacy-fixture-key");
+  await hydrateWalletKeysFromNodePlatformSecureStore();
+  expect(process.env.EVM_PRIVATE_KEY).toBe("legacy-fixture-key");
+  expect(await vault.vault.reveal("EVM_PRIVATE_KEY", "test")).toBe(
+    "legacy-fixture-key",
+  );
+});
+it("preserves a rotated vault key over the old OS copy", async () => {
+  legacy.values.set("wallet.evm_private_key", "legacy-fixture-key");
+  await vault.vault.set("EVM_PRIVATE_KEY", "rotated-fixture-key", {
+    sensitive: true,
+  });
+  await hydrateWalletKeysFromNodePlatformSecureStore();
+  expect(process.env.EVM_PRIVATE_KEY).toBe("rotated-fixture-key");
+});
+it("reset clears both copies so next boot cannot resurrect the wallet", async () => {
+  legacy.values.set("wallet.evm_private_key", "legacy-fixture-key");
+  legacy.values.set("wallet.solana_private_key", "legacy-solana-fixture");
+  await vault.vault.set("EVM_PRIVATE_KEY", "vault-fixture-key", {
+    sensitive: true,
+  });
+  await deleteWalletSecrets();
+  expect(await vault.vault.has("EVM_PRIVATE_KEY")).toBe(false);
+  expect(legacy.values.size).toBe(0);
+  await hydrateWalletKeysFromNodePlatformSecureStore();
+  expect(process.env.EVM_PRIVATE_KEY).toBeUndefined();
+  expect(process.env.SOLANA_PRIVATE_KEY).toBeUndefined();
+});
```

**File**: `packages/app/src/security/wallet-secrets.ts` (modified, +20/-0)
```diff
@@ -1,8 +1,28 @@
 import { sharedVault } from "../services/vault-mirror";
+import { deriveAgentVaultId } from "./agent-vault-id";
+import {
+  createNodePlatformSecureStore,
+  isWalletOsStoreReadEnabled,
+} from "./platform-secure-store-node";
 
 export async function deleteWalletSecrets(): Promise<void> {
   const vault = sharedVault();
   for (const key of ["EVM_PRIVATE_KEY", "SOLANA_PRIVATE_KEY"]) {
     if (await vault.has(key)) await vault.remove(key);
   }
+  // Clear the old copy as well; otherwise next boot can migrate it back.
+  if (!isWalletOsStoreReadEnabled()) return;
+  const store = createNodePlatformSecureStore();
+  if (!(await store.isAvailable())) return;
+  const vaultId = deriveAgentVaultId();
+  for (const kind of [
+    "wallet.evm_private_key",
+    "wallet.solana_private_key",
+  ] as const) {
+    const result = await store.delete(vaultId, kind);
+    if (!result.ok)
+      throw new Error(
+        `OS credential store rejected wallet deletion: ${result.reason}`,
+      );
+  }
 }
```

---

### Incident Patch 9: `ce54c0fa` (2026-10-05)
**Commit Message**: fix(app): require Shared first-attempt launch proof

**File**: `.github/workflows/staging-launch-gate.yml` (modified, +3/-0)
```diff
@@ -223,6 +223,9 @@ jobs:
           ELIZAOS_CLOUD_BASE_URL: https://api-staging.eliza.app
           ELIZA_UI_SMOKE_DEPLOYED_RENDERER: "1"
           ELIZA_UI_SMOKE_DEPLOYED_SOURCE_SHA: ${{ needs.preflight.outputs.source_sha }}
+          # #22552: this lane must prove the first Shared HTTP attempt itself
+          # succeeds. A recovered client retry is not first-turn evidence.
+          ELIZA_UI_SMOKE_REQUIRE_SHARED_FIRST_ATTEMPT: "1"
           ELIZAOS_CLOUD_API_KEY: ${{ secrets.ELIZAOS_CLOUD_API_KEY }}
           PLAYWRIGHT_NO_COPY_PROMPT: "1"
         shell: bash
```

**File**: `packages/app/test/cloud-live-optional-action.ts` (modified, +52/-5)
```diff
@@ -239,6 +239,11 @@ interface WaitForCloudLivePersonalIdentityOptions<T> {
     performConfirmation: (
       confirmation: Locator,
     ) => Promise<Exclude<CloudLiveDedicatedConfirmationKind, "none">>;
+    /**
+     * Selects the rendered non-billable path when confirmation was not
+     * explicitly approved. Omit this to retain the fail-closed diagnostic.
+     */
+    performCancellation?: (cancellation: Locator) => Promise<void>;
   };
   timeoutMs: number;
   runtimeCloudGraceMs: number;
@@ -345,6 +350,12 @@ export async function waitForCloudLivePersonalIdentity<T>({
   const startedAt = Date.now();
   const deadline = startedAt + timeoutMs;
   let runtimeCloudWasAbsent = false;
+  let cancellationHandled = false;
+  const waitForNextPoll = () =>
+    withinCloudLivePersonalIdentityDeadline(
+      () => new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs)),
+      deadline,
+    );
   for (;;) {
     const binding = await withinCloudLivePersonalIdentityDeadline(
       readBinding,
@@ -358,8 +369,40 @@ export async function waitForCloudLivePersonalIdentity<T>({
         deadline,
       );
       if (confirmation) {
+        // The click can settle before React locks the rendered pair. Never
+        // dispatch a second cancellation while waiting for the Shared binding.
+        if (cancellationHandled) {
+          await waitForNextPoll();
+          continue;
+        }
         const decision = dedicatedConsent.gate.claimVisibleConfirmation();
         if (decision !== "approved") {
+          const performCancellation = dedicatedConsent.performCancellation;
+          if (decision === "approval-required" && performCancellation) {
+            const cancellation = await lastVisibleEnabledChoice(
+              dedicatedConsent.cancellationChoices,
+              deadline,
+            );
+            if (!cancellation) {
+              throw new CloudLiveDedicatedConfirmationRequiredError(decision);
+            }
+            try {
+              await withinCloudLivePersonalIdentityDeadline(
+                () => performCancellation(cancellation),
+                deadline,
+              );
+              dedicatedConsent.gate.recordCancellation();
+              cancellationHandled = true;
+            } catch (error) {
+              if (error instanceof CloudLivePersonalIdentityDeadlineError) {
+                throw error;
+              }
+              throw new CloudLiveDedicatedConfirmationRequiredError(
+                "interaction-failed",
+              );
+            }
+            continue;
+          }
           throw new CloudLiveDedicatedConfirmationRequiredError(decision);
         }
         try {
@@ -390,16 +433,20 @@ export async function waitForCloudLivePersonalIdentity<T>({
         continue;
       }
 
-      // A newly rendered enabled quote supersedes an older cancelled transcript
-      // turn, so cancellation is checked only after no current confirmation is
-      // actionable. On the current turn both buttons lock after cancellation.
+      // Before this helper dispatches a cancellation, a newly rendered enabled
+      // quote supersedes an older cancelled transcript turn. Check historical
+      // cancellation only after no current confirmation is actionable.
       const cancelled = await hasSelectedCancellation(
         dedicatedConsent.cancellationChoices,
         deadline,
       );
       if (cancelled) {
-        dedicatedConsent.gate.recordCancellation();
-        throw new CloudLiveDedicatedConfirmationRequiredError("cancelled");
+        if (!cancellationHandled) {
+          dedicatedConsent.gate.recordCancellation();
+          throw new CloudLiveDedicatedConfirmationRequiredError("cancelled");
+        }
+        await waitForNextPoll();
+        continue;
       }
     }
 
```

**File**: `packages/app/test/ui-smoke/cloud-live-optional-action.spec.ts` (modified, +66/-0)
```diff
@@ -475,6 +475,72 @@ test.describe("Cloud live optional action boundary", () => {
     });
   });
 
+  test("takes the non-billable cancellation path when approval is absent", async ({
+    page,
+  }) => {
+    await page.setContent(`
+      <button data-testid="activation-confirm" aria-pressed="false">Start Dedicated</button>
+      <button data-testid="activation-cancel" aria-pressed="false">Not now</button>
+      <output data-testid="confirmation-count">0</output>
+      <output data-testid="cancellation-count">0</output>
+      <script>
+        document.addEventListener("click", (event) => {
+          if (!(event.target instanceof HTMLButtonElement)) return;
+          const confirmation = document.querySelector('[data-testid="activation-confirm"]');
+          const cancellation = document.querySelector('[data-testid="activation-cancel"]');
+          if (event.target.dataset.testid === "activation-confirm") {
+            document.querySelector('[data-testid="confirmation-count"]').textContent = "1";
+            return;
+          }
+          if (event.target.dataset.testid !== "activation-cancel") return;
+          const cancellationCount = document.querySelector('[data-testid="cancellation-count"]');
+          cancellationCount.textContent = String(Number(cancellationCount.textContent) + 1);
+          cancellation.setAttribute("aria-pressed", "true");
+          setTimeout(() => {
+            window.__testActiveBinding = "shared";
+          }, 10);
+        });
+      </script>
+    `);
+    const gate = createCloudLiveDedicatedConsentGate({});
+
+    await expect(
+      waitForCloudLivePersonalIdentity({
+        readBinding: () =>
+          page.evaluate(
+            () =>
+              (window as typeof window & { __testActiveBinding?: string })
+                .__testActiveBinding ?? null,
+          ),
+        runtimeCloudRecovery: page.getByTestId("runtime-cloud"),
+        retryRecovery: page.getByTestId("identity-retry"),
+        dedicatedConsent: {
+          gate,
+          confirmationChoices: page.getByTestId("activation-confirm"),
+          cancellationChoices: page.getByTestId("activation-cancel"),
+          performConfirmation: async (confirmation) => {
+            await confirmation.click();
+            return "activation";
+          },
+          performCancellation: async (cancellation) => {
+            await cancellation.click();
+          },
+        },
+        timeoutMs: 500,
+        runtimeCloudGraceMs: 50,
+        pollIntervalMs: 5,
+      }),
+    ).resolves.toBe("shared");
+    await expect(page.getByTestId("confirmation-count")).toHaveText("0");
+    await expect(page.getByTestId("cancellation-count")).toHaveText("1");
+    expect(gate.snapshot()).toEqual({
+      approvalGrantedCount: 0,
+      confirmationOfferCount: 1,
+      confirmationClickCount: 0,
+      cancellationCount: 1,
+    });
+  });
+
   test("rejects billable approval outside an explicit staging dispatch", () => {
     for (const env of [
       {
```

**File**: `packages/app/test/ui-smoke/cloud-live.spec.ts` (modified, +71/-16)
```diff
@@ -95,6 +95,8 @@ const DEPLOYED_RENDERER_MANIFEST_SCHEMA = "elizaos.renderer.build/v1";
 const DEPLOYED_BROWSER_SMOKE_SCHEMA = "elizaos.cloud.deployed-browser-smoke/v3";
 const REQUIRE_NAMED_WARMING =
   process.env.ELIZA_UI_SMOKE_REQUIRE_NAMED_WARMING === "1";
+const REQUIRE_SHARED_FIRST_ATTEMPT =
+  process.env.ELIZA_UI_SMOKE_REQUIRE_SHARED_FIRST_ATTEMPT === "1";
 
 // This lane deliberately places a real Cloud bearer in browser storage.
 // Playwright traces record init-script arguments and request headers, while
@@ -692,6 +694,13 @@ async function resolvePersonalIdentity(
           await confirmation.click({ timeout: 15_000 });
           return "activation";
         },
+        performCancellation: async (cancellation) => {
+          // The default live lane proves Shared chat. Explicit billable
+          // approval still takes the confirmation branch above; otherwise use
+          // the product's existing non-mutating "Not now" path so an optional
+          // Dedicated quote cannot prevent the first Shared turn from running.
+          await cancellation.click({ timeout: 15_000 });
+        },
       },
       timeoutMs: identityTimeoutMs,
       runtimeCloudGraceMs: 15_000,
@@ -781,10 +790,28 @@ test.describe("real cloud login + personal identity + chat", () => {
       deployedRenderer: DEPLOYED_RENDERER_ENABLED,
       cloudEnvironment: originContract.environment,
     });
+    if (REQUIRE_SHARED_FIRST_ATTEMPT) {
+      expect(
+        DEPLOYED_RENDERER_ENABLED,
+        "Shared first-attempt proof requires a deployed renderer",
+      ).toBe(true);
+      expect(
+        originContract.environment,
+        "Shared first-attempt proof requires staging",
+      ).toBe("staging");
+      expect(
+        REQUIRE_NAMED_WARMING,
+        "first-attempt success and named-warming retry proof are mutually exclusive",
+      ).toBe(false);
+    }
     test.info().annotations.push({
       type: "named-warming-proof-required",
       description: String(REQUIRE_NAMED_WARMING),
     });
+    test.info().annotations.push({
+      type: "shared-first-attempt-proof-required",
+      description: String(REQUIRE_SHARED_FIRST_ATTEMPT),
+    });
     const dedicatedConsentGate = createCloudLiveDedicatedConsentGate(
       process.env,
     );
@@ -1067,6 +1094,12 @@ test.describe("real cloud login + personal identity + chat", () => {
       identityAudit.successfulPersonalIdentityGetCount,
       "Personal Eliza resolution must include a successful canonical identity GET",
     ).toBeGreaterThan(0);
+    if (REQUIRE_SHARED_FIRST_ATTEMPT) {
+      expect(
+        referenceBinding.runtime,
+        "the first-attempt lane must exercise Personal Shared, not Dedicated",
+      ).toBe("shared");
+    }
 
     // Real chat turn against the resolved Personal Eliza agent — the liveness
     // contract (#14359) proves a real model answered (non-empty, no stub marker).
@@ -1308,9 +1341,12 @@ test.describe("real cloud login + personal identity + chat", () => {
         `Cloud live liveness failed; privacy-safe diagnostic: ${diagnostic}`,
       );
     }
-    if (!retryObservation.ok && REQUIRE_NAMED_WARMING) {
+    if (
+      !retryObservation.ok &&
+      (REQUIRE_NAMED_WARMING || REQUIRE_SHARED_FIRST_ATTEMPT)
+    ) {
       throw new Error(
-        "Cloud live Retry-chip observer failed; named warming proof is unavailable",
+        "Cloud live Retry-chip observer failed; first-turn proof is unavailable",
       );
     }
     const { liveness } = livenessAttempt;
@@ -1322,25 +1358,44 @@ test.describe("real cloud login + personal identity + chat", () => {
       description: String(liveness.firstTurnLatencyMs),
     });
     const challengeAudit = await primaryAudit.snapshot();
+    const challengeChatSendAttemptCount =
+      challengeAudit.chatSendAttemptCount -
+      auditBeforeLiveness.chatSendAttemptCount;
+    const challengeLogicalChatSendCount =
+      challengeAudit.logicalChatSendCount -
+      auditBeforeLiveness.logicalChatSendCount;
+    const challengeUnidentifiedChatSendAttemptCount =
+      challengeAudit.unidentifiedChatSendAttemptCount -
+      auditBeforeLiveness.unidentifiedChatSendAttemptCount;
+    const challengeNamedWarmingResponseCount =
+      challengeAudit.namedWarmingResponseCount -
+      auditBeforeLiveness.namedWarmingResponseCount;
+    const challengeSuccessfulChatSendResponseCount =
+      challengeAudit.successfulChatSendResponseCount -
+      auditBeforeLiveness.successfulChatSendResponseCount;
     assertCloudLiveNamedWarmingProof({
       required: REQUIRE_NAMED_WARMING,
       terminalLivenessPassed: isLiveReply(liveness.reply),
-      chatSendAttemptCount:
-        challengeAudit.chatSendAttemptCount -
-        auditBeforeLiveness.chatSendAttemptCount,
-      logicalChatSendCount:
-        challengeAudit.logicalChatSendCount -
-        auditBeforeLiveness.logicalChatSendCount,
+      chatSendAttemptCount: challengeChatSendAttemptCount,
+      logicalChatSendCount: 
```

---

### Incident Patch 10: `9651ea27` (2026-10-05)
**Commit Message**: Merge pull request #33937 from domondi1/fix/x402-budget-reservation

fix(plugin-wallet): hold x402 budget from check to record so concurrent payments can't pass the same cap

**File**: `plugins/plugin-wallet/README.md` (modified, +6/-0)
```diff
@@ -10,6 +10,12 @@ Keys remain behind WalletBackend. The root entry is server-only; import browser
 components through the UI subpath. Configure the intended chain RPCs and signer before
 submitting transactions.
 
+x402 client budgets reserve payment amounts while requests are in flight. Declines
+and failures before any transfer release the hold; errors after a fee or principal
+transfer is attempted retain it because the payment outcome may be unknown. This
+tracker is per-client and in memory, so restart clears it; it is not a durable
+transaction ledger or a substitute for on-chain spend policies.
+
 `@elizaos/plugin-wallet/read` exposes read-only EVM balances, NFTs and DEX prices
 without registering routes or loading signing services. Hosts supply resolved RPC
 endpoints and provider credentials; the root barrel exports the same readers.
```

**File**: `plugins/plugin-wallet/src/sdk/x402/budget.ts` (modified, +56/-5)
```diff
@@ -18,6 +18,10 @@ export class X402BudgetTracker {
   private globalDailySpend: bigint = 0n;
   private dailyResetTimestamp: number;
   private transactionLog: X402TransactionLog[] = [];
+  // Amounts held by payments that passed the check but are not recorded yet
+  private reservations: Map<number, { service: string; amount: bigint }> =
+    new Map();
+  private nextReservationId = 0;
 
   private globalDailyLimit: bigint;
   private globalPerRequestMax: bigint;
@@ -46,6 +50,10 @@ export class X402BudgetTracker {
   ): { allowed: boolean; reason?: string } {
     this.maybeResetDaily();
 
+    if (amount < 0n) {
+      return { allowed: false, reason: "Payment amount cannot be negative" };
+    }
+
     // Global per-request check
     if (amount > this.globalPerRequestMax) {
       return {
@@ -54,8 +62,11 @@ export class X402BudgetTracker {
       };
     }
 
-    // Global daily check
-    if (this.globalDailySpend + amount > this.globalDailyLimit) {
+    // Global daily check (in-flight reservations count against the limit)
+    if (
+      this.globalDailySpend + this.pendingSpend() + amount >
+      this.globalDailyLimit
+    ) {
       return {
         allowed: false,
         reason: `Would exceed global daily limit ${this.globalDailyLimit}`,
@@ -71,7 +82,8 @@ export class X402BudgetTracker {
           reason: `Amount ${amount} exceeds service per-request max ${budget.maxPerRequest} for ${service}`,
         };
       }
-      const serviceDailySpend = this.dailySpend.get(service) ?? 0n;
+      const serviceDailySpend =
+        (this.dailySpend.get(service) ?? 0n) + this.pendingSpend(service);
       if (serviceDailySpend + amount > budget.dailyLimit) {
         return {
           allowed: false,
@@ -84,9 +96,40 @@ export class X402BudgetTracker {
   }
 
   /**
-   * Record a completed payment.
+   * Check the budget and hold the amount in one synchronous step.
+   * Because nothing is awaited between the check and the hold, concurrent
+   * payments cannot all pass against the same remaining budget. Pass the
+   * returned id to `recordPayment` once paid, or to `releaseReservation` if the
+   * payment does not happen.
+   */
+  reserve(
+    service: string,
+    amount: bigint,
+  ):
+    | { allowed: true; reservationId: number }
+    | { allowed: false; reason: string } {
+    const check = this.checkBudget(service, amount);
+    if (!check.allowed) {
+      return { allowed: false, reason: check.reason ?? "Budget check failed" };
+    }
+    const reservationId = ++this.nextReservationId;
+    this.reservations.set(reservationId, { service, amount });
+    return { allowed: true, reservationId };
+  }
+
+  /**
+   * Free a held amount without recording a payment. Unknown ids are ignored.
+   */
+  releaseReservation(reservationId: number): void {
+    this.reservations.delete(reservationId);
+  }
+
+  /**
+   * Record a completed payment. If it was reserved, the hold is replaced by
+   * the recorded spend.
    */
-  recordPayment(log: X402TransactionLog): void {
+  recordPayment(log: X402TransactionLog, reservationId?: number): void {
+    if (reservationId !== undefined) this.releaseReservation(reservationId);
     this.maybeResetDaily();
     this.transactionLog.push(log);
 
@@ -147,6 +190,14 @@ export class X402BudgetTracker {
 
   // ─── Internals ───
 
+  private pendingSpend(service?: string): bigint {
+    let total = 0n;
+    for (const r of this.reservations.values()) {
+      if (service === undefined || r.service === service) total += r.amount;
+    }
+    return total;
+  }
+
   private findServiceBudget(service: string): X402ServiceBudget | undefined {
     // Exact match first, then wildcard
     return this.serviceBudgets.get(service) ?? this.serviceBudgets.get("*");
```

**File**: `plugins/plugin-wallet/src/sdk/x402/client.budget-race.test.ts` (added, +258/-0)
```diff
@@ -0,0 +1,258 @@
+/**
+ * Regression for #33927 — the client-side x402 budget must hold an amount from
+ * the check until the payment is recorded. Previously `checkBudget` ran, then
+ * the on-chain transfer was awaited, and only then was the payment recorded,
+ * so concurrent requests to one service all passed the same daily check and
+ * paid past `serviceBudgets[].dailyLimit`. This drives the public `fetch` path
+ * with a mocked wallet-core whose transfer takes time, as on-chain it does.
+ */
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import type { AgentWallet } from "../wallet-core";
+import { X402BudgetTracker } from "./budget";
+import { X402BudgetExceededError, X402Client } from "./client";
+import type { X402PaymentRequirements } from "./types";
+
+const { agentTransferToken, checkBudget } = vi.hoisted(() => ({
+  agentTransferToken: vi.fn(),
+  checkBudget: vi.fn(),
+}));
+
+vi.mock("../wallet-core.js", () => ({
+  agentTransferToken,
+  checkBudget,
+}));
+
+const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
+const TX_HASH =
+  "0x0000000000000000000000000000000000000000000000000000000000000abc";
+const SERVICE = "api.example.com";
+const ONE_USDC = 1_000_000n;
+
+function createWallet(): AgentWallet {
+  return {
+    address: "0x0000000000000000000000000000000000000001",
+  } as unknown as AgentWallet;
+}
+
+function requirement(): X402PaymentRequirements {
+  return {
+    scheme: "exact",
+    network: "base:8453",
+    asset: USDC_BASE,
+    amount: ONE_USDC.toString(),
+    payTo: "0x0000000000000000000000000000000000000002",
+    maxTimeoutSeconds: 60,
+    extra: {},
+  };
+}
+
+function paymentRequiredResponse(): Response {
+  return new Response(
+    JSON.stringify({
+      x402Version: 1,
+      resource: {
+        url: `https://${SERVICE}/resource`,
+        description: "",
+        mimeType: "application/json",
+      },
+      accepts: [requirement()],
+    }),
+    { status: 402 },
+  );
+}
+
+/** 402 until the request carries a payment, then 200. */
+function mockSeller() {
+  return vi
+    .spyOn(globalThis, "fetch")
+    .mockImplementation(async (_url, init) =>
+      new Headers(init?.headers).has("X-PAYMENT")
+        ? new Response("ok", { status: 200 })
+        : paymentRequiredResponse(),
+    );
+}
+
+function fiveDollarServiceCap() {
+  return {
+    serviceBudgets: [
+      { service: SERVICE, maxPerRequest: ONE_USDC, dailyLimit: 5n * ONE_USDC },
+    ],
+  };
+}
+
+describe("X402Client budget under concurrent payments (#33927)", () => {
+  beforeEach(() => {
+    agentTransferToken.mockReset();
+    checkBudget.mockReset();
+    checkBudget.mockResolvedValue({
+      token: USDC_BASE,
+      perTxLimit: 100n * ONE_USDC,
+      remainingInPeriod: 100n * ONE_USDC,
+    });
+    // The transfer takes a while, like a real on-chain payment
+    agentTransferToken.mockImplementation(
+      () => new Promise((resolve) => setTimeout(() => resolve(TX_HASH), 20)),
+    );
+  });
+
+  it("pays at most the service daily limit when payments run concurrently", async () => {
+    const fetchSpy = mockSeller();
+    try {
+      const client = new X402Client(createWallet(), fiveDollarServiceCap());
+
+      const results = await Promise.allSettled(
+        Array.from({ length: 10 }, (_, i) =>
+          client.fetch(`https://${SERVICE}/resource?i=${i}`),
+        ),
+      );
+
+      const paid = results.filter((r) => r.status === "fulfilled");
+      const blocked = results.filter(
+        (r) =>
+          r.status === "rejected" &&
+          r.reason instanceof X402BudgetExceededError,
+      );
+      expect(paid).toHaveLength(5);
+      expect(blocked).toHaveLength(5);
+      expect(client.getDailySpendSummary().byService[SERVICE]).toBe(
+        5n * ONE_USDC,
+      );
+    } finally {
+      fetchSpy.mockRestore();
+    }
+  });
+
+  it("frees the held amount when pre-transfer budget lookup fails", async () => {
+    checkBudget.mockRejectedValueOnce(new Error("budget unavailable"));
+    const fetchSpy = mockSeller();
+    try {
+      const client = new X402Client(createWallet(), {
+        serviceBudgets: [
+          { service: SERVICE, maxPerRequest: ONE_USDC, dailyLimit: ONE_USDC },
+        ],
+      });
+
+      await expect(client.fetch(`https://${SERVICE}/resource`)).rejects.toThrow(
+        "budget unavailable",
+      );
+
+      // No transfer was attempted, so the next request may use the budget
+      const response = await client.fetch(`https://${SERVICE}/resource`);
+      expect(response.status).toBe(200);
+      expect(client.getDailySpendSummary().byService[SERVICE]).toBe(ONE_USDC);
+    } finally {
+      fetchSpy.mockRestore();
+    }
+  });
+
+  it.each([1, 2])(
+    "retains budget when transfer %i has an unknown outcome",
+    async (failedTransfer) => {
+      let calls = 0;
+      agentTransferToken.mockImplementation(async () => {
+        if (++calls === failedTransfer)
+          throw new Error("re
```

**File**: `plugins/plugin-wallet/src/sdk/x402/client.fee-leg.test.ts` (modified, +7/-1)
```diff
@@ -66,11 +66,17 @@ describe("X402Client fee leg asset resolution (#22381)", () => {
       client as unknown as {
         executePayment: (
           req: X402PaymentRequirements,
+          markTransferAttempted: () => void,
         ) => Promise<{ txHash: string; token: string }>;
       }
     ).executePayment.bind(client);
 
-    const result = await executePayment(symbolRequirement());
+    const markTransferAttempted = vi.fn();
+    const result = await executePayment(
+      symbolRequirement(),
+      markTransferAttempted,
+    );
+    expect(markTransferAttempted).toHaveBeenCalledOnce();
 
     // Fee leg + payment leg = two transfers, both with a resolved address.
     expect(agentTransferToken).toHaveBeenCalledTimes(2);
```

**File**: `plugins/plugin-wallet/src/sdk/x402/client.ts` (modified, +29/-17)
```diff
@@ -90,28 +90,38 @@ export class X402Client {
       return response; // No compatible payment option
     }
 
-    // Check budget
+    // Check the budget and hold the amount until the payment is recorded or
+    // abandoned, so concurrent payments can't all pass the same check
     const amount = BigInt(selected.amount);
     const service = new URL(urlStr).hostname;
-    const budgetCheck = this.budget.checkBudget(service, amount);
-    if (!budgetCheck.allowed) {
-      throw new X402BudgetExceededError(
-        budgetCheck.reason ?? "Budget check failed",
-        urlStr,
-        selected,
-      );
+    const reservation = this.budget.reserve(service, amount);
+    if (!reservation.allowed) {
+      throw new X402BudgetExceededError(reservation.reason, urlStr, selected);
     }
+    const { reservationId } = reservation;
 
-    // Callback check
-    if (this.config.onBeforePayment) {
-      const proceed = await this.config.onBeforePayment(selected, urlStr);
-      if (!proceed) {
-        return response;
+    let paymentResult: { txHash: Hash; token: Address };
+    let transferAttempted = false;
+    try {
+      // Callback check
+      if (this.config.onBeforePayment) {
+        const proceed = await this.config.onBeforePayment(selected, urlStr);
+        if (!proceed) {
+          this.budget.releaseReservation(reservationId);
+          return response;
+        }
       }
-    }
 
-    // Execute payment
-    const paymentResult = await this.executePayment(selected);
+      // Execute payment
+      paymentResult = await this.executePayment(selected, () => {
+        transferAttempted = true;
+      });
+    } catch (error) {
+      // A transport/receipt error cannot prove that a submitted transfer failed.
+      // Retain the hold after either the fee or principal transfer was attempted.
+      if (!transferAttempted) this.budget.releaseReservation(reservationId);
+      throw error;
+    }
     const resolvedToken = paymentResult.token;
 
     // Build payment payload
@@ -138,7 +148,7 @@ export class X402Client {
       scheme: selected.scheme,
       success: true,
     };
-    this.budget.recordPayment(log);
+    this.budget.recordPayment(log, reservationId);
     this.config.onPaymentComplete?.(log);
 
     // Retry request with payment proof
@@ -247,6 +257,7 @@ export class X402Client {
    */
   private async executePayment(
     req: X402PaymentRequirements,
+    markTransferAttempted: () => void,
   ): Promise<{ txHash: Hash; token: Address }> {
     // Resolve the actual contract address for the requested asset
     const resolvedAddress = resolveAssetAddress(req.asset, req.network);
@@ -280,6 +291,7 @@ export class X402Client {
     const FEE_COLLECTOR: Address = "0xff86829393C6C26A4EC122bE0Cc3E466Ef876AdD";
     const feeAmount = (amount * X402_PROTOCOL_FEE_BPS) / 10000n;
 
+    markTransferAttempted();
     if (feeAmount > 0n) {
       await agentTransferToken(this.wallet, {
         token: resolvedAddress,
```

---

### Incident Patch 11: `2a5ba96f` (2026-10-05)
**Commit Message**: fix(wallet): retain x402 budget for uncertain transfers and reject negative holds

**File**: `plugins/plugin-wallet/README.md` (modified, +6/-0)
```diff
@@ -10,6 +10,12 @@ Keys remain behind WalletBackend. The root entry is server-only; import browser
 components through the UI subpath. Configure the intended chain RPCs and signer before
 submitting transactions.
 
+x402 client budgets reserve payment amounts while requests are in flight. Declines
+and failures before any transfer release the hold; errors after a fee or principal
+transfer is attempted retain it because the payment outcome may be unknown. This
+tracker is per-client and in memory, so restart clears it; it is not a durable
+transaction ledger or a substitute for on-chain spend policies.
+
 `@elizaos/plugin-wallet/read` exposes read-only EVM balances, NFTs and DEX prices
 without registering routes or loading signing services. Hosts supply resolved RPC
 endpoints and provider credentials; the root barrel exports the same readers.
```

**File**: `plugins/plugin-wallet/src/sdk/x402/budget.ts` (modified, +4/-0)
```diff
@@ -50,6 +50,10 @@ export class X402BudgetTracker {
   ): { allowed: boolean; reason?: string } {
     this.maybeResetDaily();
 
+    if (amount < 0n) {
+      return { allowed: false, reason: "Payment amount cannot be negative" };
+    }
+
     // Global per-request check
     if (amount > this.globalPerRequestMax) {
       return {
```

**File**: `plugins/plugin-wallet/src/sdk/x402/client.budget-race.test.ts` (modified, +39/-4)
```diff
@@ -122,8 +122,8 @@ describe("X402Client budget under concurrent payments (#33927)", () => {
     }
   });
 
-  it("frees the held amount when the transfer fails", async () => {
-    agentTransferToken.mockRejectedValueOnce(new Error("transfer reverted"));
+  it("frees the held amount when pre-transfer budget lookup fails", async () => {
+    checkBudget.mockRejectedValueOnce(new Error("budget unavailable"));
     const fetchSpy = mockSeller();
     try {
       const client = new X402Client(createWallet(), {
@@ -133,10 +133,10 @@ describe("X402Client budget under concurrent payments (#33927)", () => {
       });
 
       await expect(client.fetch(`https://${SERVICE}/resource`)).rejects.toThrow(
-        "transfer reverted",
+        "budget unavailable",
       );
 
-      // The failed payment no longer holds the only dollar of budget
+      // No transfer was attempted, so the next request may use the budget
       const response = await client.fetch(`https://${SERVICE}/resource`);
       expect(response.status).toBe(200);
       expect(client.getDailySpendSummary().byService[SERVICE]).toBe(ONE_USDC);
@@ -145,6 +145,34 @@ describe("X402Client budget under concurrent payments (#33927)", () => {
     }
   });
 
+  it.each([1, 2])(
+    "retains budget when transfer %i has an unknown outcome",
+    async (failedTransfer) => {
+      let calls = 0;
+      agentTransferToken.mockImplementation(async () => {
+        if (++calls === failedTransfer)
+          throw new Error("receipt unavailable after submission");
+        return TX_HASH;
+      });
+      const fetchSpy = mockSeller();
+      try {
+        const client = new X402Client(createWallet(), {
+          globalDailyLimit: ONE_USDC,
+        });
+        await expect(
+          client.fetch(`https://${SERVICE}/resource`),
+        ).rejects.toThrow("receipt unavailable");
+        await expect(
+          client.fetch(`https://${SERVICE}/resource`),
+        ).rejects.toBeInstanceOf(X402BudgetExceededError);
+        expect(agentTransferToken).toHaveBeenCalledTimes(failedTransfer);
+        expect(client.getTransactionLog()).toEqual([]);
+      } finally {
+        fetchSpy.mockRestore();
+      }
+    },
+  );
+
   it("frees the held amount when onBeforePayment declines", async () => {
     const fetchSpy = mockSeller();
     try {
@@ -170,6 +198,13 @@ describe("X402Client budget under concurrent payments (#33927)", () => {
 });
 
 describe("X402BudgetTracker reservations", () => {
+  it("rejects negative holds before they can increase available budget", () => {
+    const tracker = new X402BudgetTracker({ globalDailyLimit: ONE_USDC });
+    expect(tracker.reserve(SERVICE, -ONE_USDC).allowed).toBe(false);
+    expect(tracker.reserve(SERVICE, 2n * ONE_USDC).allowed).toBe(false);
+    expect(tracker.reserve(SERVICE, ONE_USDC).allowed).toBe(true);
+  });
+
   it("counts held amounts in the daily checks until recorded or released", () => {
     const tracker = new X402BudgetTracker(fiveDollarServiceCap());
 
```

**File**: `plugins/plugin-wallet/src/sdk/x402/client.fee-leg.test.ts` (modified, +7/-1)
```diff
@@ -66,11 +66,17 @@ describe("X402Client fee leg asset resolution (#22381)", () => {
       client as unknown as {
         executePayment: (
           req: X402PaymentRequirements,
+          markTransferAttempted: () => void,
         ) => Promise<{ txHash: string; token: string }>;
       }
     ).executePayment.bind(client);
 
-    const result = await executePayment(symbolRequirement());
+    const markTransferAttempted = vi.fn();
+    const result = await executePayment(
+      symbolRequirement(),
+      markTransferAttempted,
+    );
+    expect(markTransferAttempted).toHaveBeenCalledOnce();
 
     // Fee leg + payment leg = two transfers, both with a resolved address.
     expect(agentTransferToken).toHaveBeenCalledTimes(2);
```

**File**: `plugins/plugin-wallet/src/sdk/x402/client.ts` (modified, +9/-2)
```diff
@@ -101,6 +101,7 @@ export class X402Client {
     const { reservationId } = reservation;
 
     let paymentResult: { txHash: Hash; token: Address };
+    let transferAttempted = false;
     try {
       // Callback check
       if (this.config.onBeforePayment) {
@@ -112,9 +113,13 @@ export class X402Client {
       }
 
       // Execute payment
-      paymentResult = await this.executePayment(selected);
+      paymentResult = await this.executePayment(selected, () => {
+        transferAttempted = true;
+      });
     } catch (error) {
-      this.budget.releaseReservation(reservationId);
+      // A transport/receipt error cannot prove that a submitted transfer failed.
+      // Retain the hold after either the fee or principal transfer was attempted.
+      if (!transferAttempted) this.budget.releaseReservation(reservationId);
       throw error;
     }
     const resolvedToken = paymentResult.token;
@@ -252,6 +257,7 @@ export class X402Client {
    */
   private async executePayment(
     req: X402PaymentRequirements,
+    markTransferAttempted: () => void,
   ): Promise<{ txHash: Hash; token: Address }> {
     // Resolve the actual contract address for the requested asset
     const resolvedAddress = resolveAssetAddress(req.asset, req.network);
@@ -285,6 +291,7 @@ export class X402Client {
     const FEE_COLLECTOR: Address = "0xff86829393C6C26A4EC122bE0Cc3E466Ef876AdD";
     const feeAmount = (amount * X402_PROTOCOL_FEE_BPS) / 10000n;
 
+    markTransferAttempted();
     if (feeAmount > 0n) {
       await agentTransferToken(this.wallet, {
         token: resolvedAddress,
```

---

### Incident Patch 12: `6d9def6f` (2026-10-05)
**Commit Message**: fix(plugin-wallet): hold x402 budget from check to record so concurrent payments can't pass the same cap

X402Client checked the client-side budget, awaited the on-chain transfer,
and only then recorded the payment, so concurrent requests to one service
all passed the same daily check. X402BudgetTracker.reserve() now checks and
holds the amount synchronously; recordPayment() replaces the hold with the
spend, and the client releases it if onBeforePayment declines or the
transfer throws. checkBudget() counts held amounts.

Fixes #33927

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: domondi1 <[REDACTED_EMAIL]>

**File**: `plugins/plugin-wallet/src/sdk/x402/budget.ts` (modified, +52/-5)
```diff
@@ -18,6 +18,10 @@ export class X402BudgetTracker {
   private globalDailySpend: bigint = 0n;
   private dailyResetTimestamp: number;
   private transactionLog: X402TransactionLog[] = [];
+  // Amounts held by payments that passed the check but are not recorded yet
+  private reservations: Map<number, { service: string; amount: bigint }> =
+    new Map();
+  private nextReservationId = 0;
 
   private globalDailyLimit: bigint;
   private globalPerRequestMax: bigint;
@@ -54,8 +58,11 @@ export class X402BudgetTracker {
       };
     }
 
-    // Global daily check
-    if (this.globalDailySpend + amount > this.globalDailyLimit) {
+    // Global daily check (in-flight reservations count against the limit)
+    if (
+      this.globalDailySpend + this.pendingSpend() + amount >
+      this.globalDailyLimit
+    ) {
       return {
         allowed: false,
         reason: `Would exceed global daily limit ${this.globalDailyLimit}`,
@@ -71,7 +78,8 @@ export class X402BudgetTracker {
           reason: `Amount ${amount} exceeds service per-request max ${budget.maxPerRequest} for ${service}`,
         };
       }
-      const serviceDailySpend = this.dailySpend.get(service) ?? 0n;
+      const serviceDailySpend =
+        (this.dailySpend.get(service) ?? 0n) + this.pendingSpend(service);
       if (serviceDailySpend + amount > budget.dailyLimit) {
         return {
           allowed: false,
@@ -84,9 +92,40 @@ export class X402BudgetTracker {
   }
 
   /**
-   * Record a completed payment.
+   * Check the budget and hold the amount in one synchronous step.
+   * Because nothing is awaited between the check and the hold, concurrent
+   * payments cannot all pass against the same remaining budget. Pass the
+   * returned id to `recordPayment` once paid, or to `releaseReservation` if the
+   * payment does not happen.
    */
-  recordPayment(log: X402TransactionLog): void {
+  reserve(
+    service: string,
+    amount: bigint,
+  ):
+    | { allowed: true; reservationId: number }
+    | { allowed: false; reason: string } {
+    const check = this.checkBudget(service, amount);
+    if (!check.allowed) {
+      return { allowed: false, reason: check.reason ?? "Budget check failed" };
+    }
+    const reservationId = ++this.nextReservationId;
+    this.reservations.set(reservationId, { service, amount });
+    return { allowed: true, reservationId };
+  }
+
+  /**
+   * Free a held amount without recording a payment. Unknown ids are ignored.
+   */
+  releaseReservation(reservationId: number): void {
+    this.reservations.delete(reservationId);
+  }
+
+  /**
+   * Record a completed payment. If it was reserved, the hold is replaced by
+   * the recorded spend.
+   */
+  recordPayment(log: X402TransactionLog, reservationId?: number): void {
+    if (reservationId !== undefined) this.releaseReservation(reservationId);
     this.maybeResetDaily();
     this.transactionLog.push(log);
 
@@ -147,6 +186,14 @@ export class X402BudgetTracker {
 
   // ─── Internals ───
 
+  private pendingSpend(service?: string): bigint {
+    let total = 0n;
+    for (const r of this.reservations.values()) {
+      if (service === undefined || r.service === service) total += r.amount;
+    }
+    return total;
+  }
+
   private findServiceBudget(service: string): X402ServiceBudget | undefined {
     // Exact match first, then wildcard
     return this.serviceBudgets.get(service) ?? this.serviceBudgets.get("*");
```

**File**: `plugins/plugin-wallet/src/sdk/x402/client.budget-race.test.ts` (added, +223/-0)
```diff
@@ -0,0 +1,223 @@
+/**
+ * Regression for #33927 — the client-side x402 budget must hold an amount from
+ * the check until the payment is recorded. Previously `checkBudget` ran, then
+ * the on-chain transfer was awaited, and only then was the payment recorded,
+ * so concurrent requests to one service all passed the same daily check and
+ * paid past `serviceBudgets[].dailyLimit`. This drives the public `fetch` path
+ * with a mocked wallet-core whose transfer takes time, as on-chain it does.
+ */
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import type { AgentWallet } from "../wallet-core";
+import { X402BudgetTracker } from "./budget";
+import { X402BudgetExceededError, X402Client } from "./client";
+import type { X402PaymentRequirements } from "./types";
+
+const { agentTransferToken, checkBudget } = vi.hoisted(() => ({
+  agentTransferToken: vi.fn(),
+  checkBudget: vi.fn(),
+}));
+
+vi.mock("../wallet-core.js", () => ({
+  agentTransferToken,
+  checkBudget,
+}));
+
+const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
+const TX_HASH =
+  "0x0000000000000000000000000000000000000000000000000000000000000abc";
+const SERVICE = "api.example.com";
+const ONE_USDC = 1_000_000n;
+
+function createWallet(): AgentWallet {
+  return {
+    address: "0x0000000000000000000000000000000000000001",
+  } as unknown as AgentWallet;
+}
+
+function requirement(): X402PaymentRequirements {
+  return {
+    scheme: "exact",
+    network: "base:8453",
+    asset: USDC_BASE,
+    amount: ONE_USDC.toString(),
+    payTo: "0x0000000000000000000000000000000000000002",
+    maxTimeoutSeconds: 60,
+    extra: {},
+  };
+}
+
+function paymentRequiredResponse(): Response {
+  return new Response(
+    JSON.stringify({
+      x402Version: 1,
+      resource: {
+        url: `https://${SERVICE}/resource`,
+        description: "",
+        mimeType: "application/json",
+      },
+      accepts: [requirement()],
+    }),
+    { status: 402 },
+  );
+}
+
+/** 402 until the request carries a payment, then 200. */
+function mockSeller() {
+  return vi
+    .spyOn(globalThis, "fetch")
+    .mockImplementation(async (_url, init) =>
+      new Headers(init?.headers).has("X-PAYMENT")
+        ? new Response("ok", { status: 200 })
+        : paymentRequiredResponse(),
+    );
+}
+
+function fiveDollarServiceCap() {
+  return {
+    serviceBudgets: [
+      { service: SERVICE, maxPerRequest: ONE_USDC, dailyLimit: 5n * ONE_USDC },
+    ],
+  };
+}
+
+describe("X402Client budget under concurrent payments (#33927)", () => {
+  beforeEach(() => {
+    agentTransferToken.mockReset();
+    checkBudget.mockReset();
+    checkBudget.mockResolvedValue({
+      token: USDC_BASE,
+      perTxLimit: 100n * ONE_USDC,
+      remainingInPeriod: 100n * ONE_USDC,
+    });
+    // The transfer takes a while, like a real on-chain payment
+    agentTransferToken.mockImplementation(
+      () => new Promise((resolve) => setTimeout(() => resolve(TX_HASH), 20)),
+    );
+  });
+
+  it("pays at most the service daily limit when payments run concurrently", async () => {
+    const fetchSpy = mockSeller();
+    try {
+      const client = new X402Client(createWallet(), fiveDollarServiceCap());
+
+      const results = await Promise.allSettled(
+        Array.from({ length: 10 }, (_, i) =>
+          client.fetch(`https://${SERVICE}/resource?i=${i}`),
+        ),
+      );
+
+      const paid = results.filter((r) => r.status === "fulfilled");
+      const blocked = results.filter(
+        (r) =>
+          r.status === "rejected" &&
+          r.reason instanceof X402BudgetExceededError,
+      );
+      expect(paid).toHaveLength(5);
+      expect(blocked).toHaveLength(5);
+      expect(client.getDailySpendSummary().byService[SERVICE]).toBe(
+        5n * ONE_USDC,
+      );
+    } finally {
+      fetchSpy.mockRestore();
+    }
+  });
+
+  it("frees the held amount when the transfer fails", async () => {
+    agentTransferToken.mockRejectedValueOnce(new Error("transfer reverted"));
+    const fetchSpy = mockSeller();
+    try {
+      const client = new X402Client(createWallet(), {
+        serviceBudgets: [
+          { service: SERVICE, maxPerRequest: ONE_USDC, dailyLimit: ONE_USDC },
+        ],
+      });
+
+      await expect(client.fetch(`https://${SERVICE}/resource`)).rejects.toThrow(
+        "transfer reverted",
+      );
+
+      // The failed payment no longer holds the only dollar of budget
+      const response = await client.fetch(`https://${SERVICE}/resource`);
+      expect(response.status).toBe(200);
+      expect(client.getDailySpendSummary().byService[SERVICE]).toBe(ONE_USDC);
+    } finally {
+      fetchSpy.mockRestore();
+    }
+  });
+
+  it("frees the held amount when onBeforePayment declines", async () => {
+    const fetchSpy = mockSeller();
+    try {
+      let approve = false;
+      const client = new X402Client(createWallet(), {
+        serviceBudgets: [
+          { service: SERVICE, maxPerRequest: ONE_
```

**File**: `plugins/plugin-wallet/src/sdk/x402/client.ts` (modified, +22/-17)
```diff
@@ -90,28 +90,33 @@ export class X402Client {
       return response; // No compatible payment option
     }
 
-    // Check budget
+    // Check the budget and hold the amount until the payment is recorded or
+    // abandoned, so concurrent payments can't all pass the same check
     const amount = BigInt(selected.amount);
     const service = new URL(urlStr).hostname;
-    const budgetCheck = this.budget.checkBudget(service, amount);
-    if (!budgetCheck.allowed) {
-      throw new X402BudgetExceededError(
-        budgetCheck.reason ?? "Budget check failed",
-        urlStr,
-        selected,
-      );
+    const reservation = this.budget.reserve(service, amount);
+    if (!reservation.allowed) {
+      throw new X402BudgetExceededError(reservation.reason, urlStr, selected);
     }
+    const { reservationId } = reservation;
 
-    // Callback check
-    if (this.config.onBeforePayment) {
-      const proceed = await this.config.onBeforePayment(selected, urlStr);
-      if (!proceed) {
-        return response;
+    let paymentResult: { txHash: Hash; token: Address };
+    try {
+      // Callback check
+      if (this.config.onBeforePayment) {
+        const proceed = await this.config.onBeforePayment(selected, urlStr);
+        if (!proceed) {
+          this.budget.releaseReservation(reservationId);
+          return response;
+        }
       }
-    }
 
-    // Execute payment
-    const paymentResult = await this.executePayment(selected);
+      // Execute payment
+      paymentResult = await this.executePayment(selected);
+    } catch (error) {
+      this.budget.releaseReservation(reservationId);
+      throw error;
+    }
     const resolvedToken = paymentResult.token;
 
     // Build payment payload
@@ -138,7 +143,7 @@ export class X402Client {
       scheme: selected.scheme,
       success: true,
     };
-    this.budget.recordPayment(log);
+    this.budget.recordPayment(log, reservationId);
     this.config.onPaymentComplete?.(log);
 
     // Retry request with payment proof
```

---

### Incident Patch 13: `05977e51` (2026-10-05)
**Commit Message**: fix(android): admit WebView readiness after isolated user switches

**File**: `packages/app/README.md` (modified, +6/-0)
```diff
@@ -62,6 +62,12 @@ APK, signer, live overlay and restarted framework before reporting provisioning;
 runtime feature qualification remains separate. The bundled extractor validates
 archive membership even under Python optimization.
 
+WebView-based consumers of `runIsolatedAndroidUserTest` can set `requireWebView`
+to wait for provider and RELRO readiness after each secondary-user switch. The
+check saves its last observation in `user-verification.json`, has a one-minute
+deadline, and performs no provider writes or instrumentation retries. It does
+not replace provider-byte admission or runtime feature qualification.
+
 ## Android native plugin verification
 
 With the Android SDK, Java 21, workspace dependencies, and a running emulator:
```

**File**: `packages/app/scripts/lib/android-webview-readiness.mjs` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+import assert from "node:assert/strict";
+import { setTimeout as delay } from "node:timers/promises";
+
+/** Service readiness only: this does not qualify provider bytes or features. */
+export function androidWebViewReady(state) {
+  const current = state.match(
+    /^\s*Current WebView package \(name, version\): \(([A-Za-z][A-Za-z0-9_.]+), ([^\r\n)]+)\)\s*$/m,
+  );
+  if (!current) return false;
+  const started = state.match(/^\s*Number of relros started: (\d+)\s*$/m);
+  const finished = state.match(/^\s*Number of relros finished: (\d+)\s*$/m);
+  const provider = current[1].replaceAll(".", "\\.");
+  return (
+    /^\s*WebView package dirty: false\s*$/m.test(state) &&
+    /^\s*Any WebView package installed: true\s*$/m.test(state) &&
+    new RegExp(
+      `^\\s*Valid package ${provider} \\(versionName: [^\\r\\n]+\\) is\\s+installed/enabled for all users\\s*$`,
+      "m",
+    ).test(state) &&
+    started !== null &&
+    finished !== null &&
+    Number(started[1]) > 0 &&
+    Number(started[1]) === Number(finished[1])
+  );
+}
+
+/** Read-only admission after switching users. Never retries instrumentation. */
+export async function waitForAndroidWebView({
+  execute,
+  user,
+  signal,
+  record,
+  timeoutMs = 60000,
+  pollMs = 500,
+}) {
+  assert.ok(Number.isSafeInteger(user) && user > 0);
+  for (const value of [timeoutMs, pollMs])
+    assert.ok(Number.isSafeInteger(value) && value > 0);
+  const deadline = AbortSignal.timeout(timeoutMs);
+  const operationSignal = signal
+    ? AbortSignal.any([signal, deadline])
+    : deadline;
+  let attempt = 0;
+  try {
+    for (;;) {
+      operationSignal.throwIfAborted();
+      assert.equal(
+        String(
+          await execute(["shell", "am", "get-current-user"], {
+            signal: operationSignal,
+          }),
+        ).trim(),
+        String(user),
+        "Owned Android user changed before WebView admission",
+      );
+      const state = String(
+        await execute(["shell", "dumpsys", "webviewupdate"], {
+          signal: operationSignal,
+        }),
+      );
+      const ready = androidWebViewReady(state);
+      await record({ attempt: ++attempt, ready, state });
+      if (ready) return;
+      await delay(pollMs, undefined, { signal: operationSignal });
+    }
+  } catch (error) {
+    if (deadline.aborted && !signal?.aborted)
+      throw new Error("Owned user WebView readiness deadline exceeded", {
+        cause: error,
+      });
+    throw error;
+  }
+}
```

**File**: `packages/app/scripts/lib/android-webview-readiness.test.mjs` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import {
+  androidWebViewReady,
+  waitForAndroidWebView,
+} from "./android-webview-readiness.mjs";
+
+const ready = `Current WebView Update Service state
+  Current WebView package (name, version): (com.android.webview, 157.0.8083.0)
+  Number of relros started: 1
+  Number of relros finished: 1
+  WebView package dirty: false
+  Any WebView package installed: true
+  WebView packages:
+    Valid package com.android.webview (versionName: 157.0.8083.0, versionCode: 808300007, targetSdkVersion: 37) is  installed/enabled for all users
+`;
+
+test("requires selected provider, complete RELRO and installation for every user", () => {
+  assert.equal(androidWebViewReady(ready), true);
+  for (const state of [
+    "",
+    ready.replace("package dirty: false", "package dirty: true"),
+    ready.replace("relros finished: 1", "relros finished: 0"),
+    ready.replaceAll("relros started: 1", "relros started: 0"),
+    ready.replace("package installed: true", "package installed: false"),
+    ready.replace("is  installed/enabled", "is NOT installed/enabled"),
+    ready.replace(
+      "Valid package com.android.webview",
+      "Valid package com.other.webview",
+    ),
+    ready.replace("Valid package", "Invalid package"),
+  ])
+    assert.equal(androidWebViewReady(state), false, state);
+});
+
+test("waits for secondary-user provider work with read-only commands and retains admission evidence", async () => {
+  const commands = [],
+    observations = [];
+  let reads = 0;
+  await waitForAndroidWebView({
+    user: 11,
+    pollMs: 1,
+    execute: async (args) => {
+      commands.push(args.join(" "));
+      if (args.join(" ") === "shell am get-current-user") return "11\n";
+      assert.deepEqual(args, ["shell", "dumpsys", "webviewupdate"]);
+      return ++reads === 1
+        ? ready.replace("relros finished: 1", "relros finished: 0")
+        : ready;
+    },
+    record: (value) => observations.push(value),
+  });
+  assert.deepEqual(
+    observations.map(({ ready }) => ready),
+    [false, true],
+  );
+  assert.equal(commands.length, 4);
+});
+
+test("foreground drift and command failure stop admission without retries", async () => {
+  let calls = 0;
+  await assert.rejects(
+    waitForAndroidWebView({
+      user: 11,
+      execute: async () => {
+        calls++;
+        return "0";
+      },
+      record: () => assert.fail("No provider observation on foreign user"),
+    }),
+    /Owned Android user changed/,
+  );
+  assert.equal(calls, 1);
+  calls = 0;
+  await assert.rejects(
+    waitForAndroidWebView({
+      user: 11,
+      execute: async () => {
+        calls++;
+        throw new Error("device offline");
+      },
+      record: () => {},
+    }),
+    /device offline/,
+  );
+  assert.equal(calls, 1);
+});
+
+test("deadline aborts a live command and cancellation stops before any device command", async () => {
+  const controller = new AbortController();
+  controller.abort();
+  await assert.rejects(
+    waitForAndroidWebView({
+      user: 11,
+      signal: controller.signal,
+      execute: async () => assert.fail("Cancelled command"),
+      record: () => {},
+    }),
+    { name: "AbortError" },
+  );
+  // Keep the test process alive while the deadline's unreferenced timer runs.
+  const hold = setInterval(() => {}, 1000);
+  try {
+    await assert.rejects(
+      waitForAndroidWebView({
+        user: 11,
+        timeoutMs: 20,
+        execute: async (_args, { signal }) =>
+          new Promise((_resolve, reject) => {
+            signal.addEventListener("abort", () => reject(signal.reason), {
+              once: true,
+            });
+          }),
+        record: () => {},
+      }),
+      /WebView readiness deadline exceeded/,
+    );
+  } finally {
+    clearInterval(hold);
+  }
+});
```

**File**: `packages/app/scripts/lib/isolated-android-user-test.mjs` (modified, +13/-0)
```diff
@@ -3,6 +3,7 @@ import { execFile } from "node:child_process";
 import fs from "node:fs";
 import path from "node:path";
 import { promisify } from "node:util";
+import { waitForAndroidWebView } from "./android-webview-readiness.mjs";
 import { acquireDeviceLease, deviceLeaseStateDir } from "./device-lease.ts";
 import { runIsolatedAndroidTest } from "./isolated-android-test.mjs";
 import { withIsolatedAndroidUser } from "./isolated-android-user.mjs";
@@ -16,6 +17,7 @@ const executeFile = promisify(execFile);
 export async function runIsolatedAndroidUserTest({
   homePackage,
   userName,
+  requireWebView = false,
   ...options
 }) {
   assert.equal(options.androidUser, undefined, "The lifecycle owns the user");
@@ -96,6 +98,17 @@ export async function runIsolatedAndroidUserTest({
       run: async ({ user }) => {
         report.androidUser = user;
         try {
+          if (requireWebView) {
+            await waitForAndroidWebView({
+              execute,
+              user,
+              signal,
+              record: (observation) => {
+                report.webViewAdmission = observation;
+                persist();
+              },
+            });
+          }
           report.result = await runIsolatedAndroidTest({
             ...options,
             androidUser: user,
```

---

### Incident Patch 14: `ba09d11c` (2026-10-05)
**Commit Message**: Merge pull request #33931 from lumix5/fix/wallet-vault-reuse-before-provision

fix(agent): reuse vault-held wallet keys before provisioning replacements

**File**: `packages/agent/src/api/server-helpers-config.ts` (modified, +9/-1)
```diff
@@ -13,7 +13,10 @@ import {
   getStylePresets,
 } from "@elizaos/host/protocol";
 import { isSensitiveConfigKey } from "../config/sensitive-keys.ts";
-import { persistWalletPrivateKeys } from "./wallet-key-store.ts";
+import {
+  persistWalletPrivateKeys,
+  restoreWalletPrivateKeysFromVault,
+} from "./wallet-key-store.ts";
 import { generateWalletKeys, setSolanaWalletEnv } from "./wallet-keygen.ts";
 
 // ---------------------------------------------------------------------------
@@ -433,6 +436,11 @@ export function getCloudProviderOptions(): Array<{
 export async function ensureWalletKeysInEnvAndConfig(
   config: ElizaConfig,
 ): Promise<boolean> {
+  // The vault is the durable wallet store in OS-store mode and its boot
+  // hydrate only runs after the listener is live; consult it before deciding
+  // anything is missing so a pre-hydration provisioning request reuses the
+  // stored wallet instead of overwriting it.
+  await restoreWalletPrivateKeysFromVault(config);
   const missingEvm =
     typeof process.env.EVM_PRIVATE_KEY !== "string" ||
     !process.env.EVM_PRIVATE_KEY.trim();
```

**File**: `packages/agent/src/api/wallet-key-store.ts` (modified, +53/-0)
```diff
@@ -5,9 +5,15 @@ import {
   getAgentHostBridge,
   hasDurableHostVault,
 } from "../runtime/host-bridge.ts";
+import { setSolanaWalletEnv } from "./wallet-keygen.ts";
 
 export type WalletPrivateKeyName = "EVM_PRIVATE_KEY" | "SOLANA_PRIVATE_KEY";
 
+const WALLET_PRIVATE_KEY_NAMES: readonly WalletPrivateKeyName[] = [
+  "EVM_PRIVATE_KEY",
+  "SOLANA_PRIVATE_KEY",
+];
+
 /**
  * Stores wallet private keys in the host vault when OS-store mode keeps them
  * out of the on-disk config (boot hydration reads them back from the vault).
@@ -65,3 +71,50 @@ export async function persistWalletPrivateKeys(
     throw err;
   }
 }
+
+/**
+ * Restores wallet private keys the durable vault already holds into blank env
+ * slots before any provisioning decision. In OS-store mode the vault is the
+ * only durable copy (config saves strip plaintext keys) and the boot-time
+ * vault→env hydrate runs only after the API listener is live, so a first-run
+ * wallet request or boot auto-provision that arrives earlier would otherwise
+ * see blank env vars, treat the stored — possibly funded — wallet as missing,
+ * and overwrite it with freshly generated keys. Only blank env slots are
+ * filled, preserving the documented precedence (launch env > vault). Returns
+ * true when at least one key was restored.
+ */
+export async function restoreWalletPrivateKeysFromVault(
+  config: ElizaConfig,
+): Promise<boolean> {
+  if (!isWalletOsStoreEnabledInConfig(config)) return false;
+  if (!hasDurableHostVault()) return false;
+  const vault = getAgentHostBridge().sharedVault();
+  const caller = "wallet-provision";
+  let restored = false;
+  for (const key of WALLET_PRIVATE_KEY_NAMES) {
+    if (process.env[key]?.trim()) continue;
+    let value: string | null = null;
+    try {
+      value = (await vault.has(key)) ? await vault.reveal(key, caller) : null;
+    } catch (err) {
+      // Fail closed: without proving the vault has no wallet key, generating a
+      // replacement could destroy the stored wallet.
+      throw new ElizaError(
+        `${key} could not be read from the durable vault before wallet provisioning; refusing to generate a replacement that could overwrite the stored wallet`,
+        {
+          code: "WALLET_KEY_RESTORE_FAILED",
+          context: { key },
+          cause: err,
+        },
+      );
+    }
+    if (value === null || !value.trim()) continue;
+    if (key === "EVM_PRIVATE_KEY") {
+      process.env.EVM_PRIVATE_KEY = value.trim();
+    } else {
+      setSolanaWalletEnv(value.trim());
+    }
+    restored = true;
+  }
+  return restored;
+}
```

**File**: `packages/agent/test/wallet-key-lifecycle.test.ts` (modified, +248/-0)
```diff
@@ -480,3 +480,251 @@ it.each([
     }
   },
 );
+
+// A reset clears first-run state but deliberately keeps wallet vault keys, and
+// the boot-time vault→env hydrate only runs after the API listener is live.
+// Every provisioning entry point must therefore reuse the stored wallet
+// instead of treating blank env vars as a missing wallet and overwriting it.
+it.each([
+  { entry: "first-run keys route" },
+  { entry: "first-run completion" },
+  { entry: "boot auto-provision" },
+] as const)(
+  "reuses vault-held wallet keys instead of overwriting them via $entry",
+  async ({ entry }) => {
+    const directory = await mkdtemp(join(tmpdir(), "wallet-vault-reuse-"));
+    const savedBridge = getAgentHostBridge();
+    const testVault = await createTestVault();
+    let server: Awaited<ReturnType<typeof startApiServer>> | undefined;
+    try {
+      const filename = join(directory, "eliza.json");
+      const token = randomUUID();
+      for (const [key, value] of Object.entries({
+        ELIZA_STATE_DIR: directory,
+        ELIZA_CONFIG_PATH: filename,
+        ELIZA_PERSIST_CONFIG_PATH: filename,
+        ELIZA_API_BIND_HOST: "127.0.0.1",
+        ELIZA_API_TOKEN: token,
+        ELIZA_REQUIRE_LOCAL_AUTH: "1",
+        ELIZA_WALLET_AUTO_PROVISION:
+          entry === "boot auto-provision" ? "1" : "0",
+      }))
+        vi.stubEnv(key, value);
+      for (const key of [
+        "ELIZA_WALLET_OS_STORE",
+        "ELIZAOS_CLOUD_API_KEY",
+        "STEWARD_API_URL",
+        "EVM_PRIVATE_KEY",
+        "SOLANA_PRIVATE_KEY",
+        "SOLANA_PUBLIC_KEY",
+        "WALLET_PUBLIC_KEY",
+      ])
+        vi.stubEnv(key, undefined);
+      // The prior install's funded wallet survived the reset in the vault.
+      const priorEvm = generateWalletForChain("evm");
+      const priorSolana = generateWalletForChain("solana");
+      await testVault.vault.set("EVM_PRIVATE_KEY", priorEvm.privateKey, {
+        sensitive: true,
+      });
+      await testVault.vault.set("SOLANA_PRIVATE_KEY", priorSolana.privateKey, {
+        sensitive: true,
+      });
+      setAgentHostBridge({
+        ...savedBridge,
+        sharedVault: () => testVault.vault,
+      });
+      await writeFile(
+        filename,
+        JSON.stringify({ env: { ELIZA_WALLET_OS_STORE: "1" } }),
+      );
+      server = await startApiServer({
+        port: 0,
+        hostConfig: loadElizaConfig(),
+        skipDeferredStartupWork: true,
+      });
+      if (entry !== "boot auto-provision") {
+        const response = await fetch(
+          `http://127.0.0.1:${server.port}${entry === "first-run completion" ? "/api/first-run" : "/api/wallet/keys"}`,
+          {
+            method: entry === "first-run completion" ? "POST" : "GET",
+            headers: {
+              Authorization: `Bearer ${token}`,
+              "Content-Type": "application/json",
+            },
+            ...(entry === "first-run completion"
+              ? { body: JSON.stringify({ name: "Wallet fixture" }) }
+              : {}),
+          },
+        );
+        expect(response.status).toBe(200);
+        if (entry === "first-run keys route") {
+          const body = (await response.json()) as {
+            evmAddress: string;
+            solanaAddress: string;
+          };
+          // The re-onboarding user is shown the stored wallet's addresses.
+          expect(body.evmAddress).toBe(priorEvm.address);
+          expect(body.solanaAddress).toBe(priorSolana.address);
+        }
+      }
+      // Boolean assertions keep ephemeral private keys out of failure output.
+      expect(
+        (await testVault.vault.reveal("EVM_PRIVATE_KEY")) ===
+          priorEvm.privateKey,
+      ).toBe(true);
+      expect(
+        (await testVault.vault.reveal("SOLANA_PRIVATE_KEY")) ===
+          priorSolana.privateKey,
+      ).toBe(true);
+      expect(process.env.EVM_PRIVATE_KEY === priorEvm.privateKey).toBe(true);
+      expect(process.env.SOLANA_PRIVATE_KEY === priorSolana.privateKey).toBe(
+        true,
+      );
+      expect(process.env.SOLANA_PUBLIC_KEY === priorSolana.address).toBe(true);
+      expect(process.env.WALLET_PUBLIC_KEY === priorSolana.address).toBe(true);
+      const persisted = JSON.parse(await readFile(filename, "utf8"));
+      expect(persisted.env.EVM_PRIVATE_KEY).toBeUndefined();
+      expect(persisted.env.SOLANA_PRIVATE_KEY).toBeUndefined();
+    } finally {
+      setAgentHostBridge(savedBridge);
+      await server?.close();
+      await testVault.dispose();
+      await rm(directory, { recursive: true, force: true });
+    }
+  },
+);
+
+// Only the EVM key survived in the vault; the re-onboard must keep it and
+// still provision the genuinely missing Solana key.
+it("reuses the vault-held EVM key while provisioning the missing Solana key", async () => {
+  const directory = await mkdtemp(join(tmpdir(), "wallet-vault-partial-"));
+  const savedBridge = getAgentHostBridge();
+  const testVault = await createTestVault();
+  le
```

---

### Incident Patch 15: `e4c8f96a` (2026-10-05)
**Commit Message**: fix(agent): reuse vault-held wallet keys before provisioning replacements

In OS-store mode the host vault is the only durable wallet-key copy
(config saves strip plaintext) and the boot vault-to-env hydrate runs
only after the API listener is live. ensureWalletKeysInEnvAndConfig
decided keys were missing from process.env alone, so a first-run
wallet request, first-run completion, or boot auto-provision arriving
before hydration generated a fresh keypair and persistWalletPrivateKeys
overwrote the stored vault entries — silently destroying a funded
wallet for a user re-onboarding after /api/agent/reset, which
deliberately preserves wallet vault keys.

Consult the durable vault first: restore blank env slots from the
vault before any missing-key decision, filling only blank slots so
launch env still outranks the vault. An unreadable vault fails closed
(WALLET_KEY_RESTORE_FAILED) instead of generating over an
unverifiable store.

**File**: `packages/agent/src/api/server-helpers-config.ts` (modified, +9/-1)
```diff
@@ -13,7 +13,10 @@ import {
   getStylePresets,
 } from "@elizaos/host/protocol";
 import { isSensitiveConfigKey } from "../config/sensitive-keys.ts";
-import { persistWalletPrivateKeys } from "./wallet-key-store.ts";
+import {
+  persistWalletPrivateKeys,
+  restoreWalletPrivateKeysFromVault,
+} from "./wallet-key-store.ts";
 import { generateWalletKeys, setSolanaWalletEnv } from "./wallet-keygen.ts";
 
 // ---------------------------------------------------------------------------
@@ -433,6 +436,11 @@ export function getCloudProviderOptions(): Array<{
 export async function ensureWalletKeysInEnvAndConfig(
   config: ElizaConfig,
 ): Promise<boolean> {
+  // The vault is the durable wallet store in OS-store mode and its boot
+  // hydrate only runs after the listener is live; consult it before deciding
+  // anything is missing so a pre-hydration provisioning request reuses the
+  // stored wallet instead of overwriting it.
+  await restoreWalletPrivateKeysFromVault(config);
   const missingEvm =
     typeof process.env.EVM_PRIVATE_KEY !== "string" ||
     !process.env.EVM_PRIVATE_KEY.trim();
```

**File**: `packages/agent/src/api/wallet-key-store.ts` (modified, +53/-0)
```diff
@@ -5,9 +5,15 @@ import {
   getAgentHostBridge,
   hasDurableHostVault,
 } from "../runtime/host-bridge.ts";
+import { setSolanaWalletEnv } from "./wallet-keygen.ts";
 
 export type WalletPrivateKeyName = "EVM_PRIVATE_KEY" | "SOLANA_PRIVATE_KEY";
 
+const WALLET_PRIVATE_KEY_NAMES: readonly WalletPrivateKeyName[] = [
+  "EVM_PRIVATE_KEY",
+  "SOLANA_PRIVATE_KEY",
+];
+
 /**
  * Stores wallet private keys in the host vault when OS-store mode keeps them
  * out of the on-disk config (boot hydration reads them back from the vault).
@@ -65,3 +71,50 @@ export async function persistWalletPrivateKeys(
     throw err;
   }
 }
+
+/**
+ * Restores wallet private keys the durable vault already holds into blank env
+ * slots before any provisioning decision. In OS-store mode the vault is the
+ * only durable copy (config saves strip plaintext keys) and the boot-time
+ * vault→env hydrate runs only after the API listener is live, so a first-run
+ * wallet request or boot auto-provision that arrives earlier would otherwise
+ * see blank env vars, treat the stored — possibly funded — wallet as missing,
+ * and overwrite it with freshly generated keys. Only blank env slots are
+ * filled, preserving the documented precedence (launch env > vault). Returns
+ * true when at least one key was restored.
+ */
+export async function restoreWalletPrivateKeysFromVault(
+  config: ElizaConfig,
+): Promise<boolean> {
+  if (!isWalletOsStoreEnabledInConfig(config)) return false;
+  if (!hasDurableHostVault()) return false;
+  const vault = getAgentHostBridge().sharedVault();
+  const caller = "wallet-provision";
+  let restored = false;
+  for (const key of WALLET_PRIVATE_KEY_NAMES) {
+    if (process.env[key]?.trim()) continue;
+    let value: string | null = null;
+    try {
+      value = (await vault.has(key)) ? await vault.reveal(key, caller) : null;
+    } catch (err) {
+      // Fail closed: without proving the vault has no wallet key, generating a
+      // replacement could destroy the stored wallet.
+      throw new ElizaError(
+        `${key} could not be read from the durable vault before wallet provisioning; refusing to generate a replacement that could overwrite the stored wallet`,
+        {
+          code: "WALLET_KEY_RESTORE_FAILED",
+          context: { key },
+          cause: err,
+        },
+      );
+    }
+    if (value === null || !value.trim()) continue;
+    if (key === "EVM_PRIVATE_KEY") {
+      process.env.EVM_PRIVATE_KEY = value.trim();
+    } else {
+      setSolanaWalletEnv(value.trim());
+    }
+    restored = true;
+  }
+  return restored;
+}
```

**File**: `packages/agent/test/wallet-key-lifecycle.test.ts` (modified, +248/-0)
```diff
@@ -480,3 +480,251 @@ it.each([
     }
   },
 );
+
+// A reset clears first-run state but deliberately keeps wallet vault keys, and
+// the boot-time vault→env hydrate only runs after the API listener is live.
+// Every provisioning entry point must therefore reuse the stored wallet
+// instead of treating blank env vars as a missing wallet and overwriting it.
+it.each([
+  { entry: "first-run keys route" },
+  { entry: "first-run completion" },
+  { entry: "boot auto-provision" },
+] as const)(
+  "reuses vault-held wallet keys instead of overwriting them via $entry",
+  async ({ entry }) => {
+    const directory = await mkdtemp(join(tmpdir(), "wallet-vault-reuse-"));
+    const savedBridge = getAgentHostBridge();
+    const testVault = await createTestVault();
+    let server: Awaited<ReturnType<typeof startApiServer>> | undefined;
+    try {
+      const filename = join(directory, "eliza.json");
+      const token = randomUUID();
+      for (const [key, value] of Object.entries({
+        ELIZA_STATE_DIR: directory,
+        ELIZA_CONFIG_PATH: filename,
+        ELIZA_PERSIST_CONFIG_PATH: filename,
+        ELIZA_API_BIND_HOST: "127.0.0.1",
+        ELIZA_API_TOKEN: token,
+        ELIZA_REQUIRE_LOCAL_AUTH: "1",
+        ELIZA_WALLET_AUTO_PROVISION:
+          entry === "boot auto-provision" ? "1" : "0",
+      }))
+        vi.stubEnv(key, value);
+      for (const key of [
+        "ELIZA_WALLET_OS_STORE",
+        "ELIZAOS_CLOUD_API_KEY",
+        "STEWARD_API_URL",
+        "EVM_PRIVATE_KEY",
+        "SOLANA_PRIVATE_KEY",
+        "SOLANA_PUBLIC_KEY",
+        "WALLET_PUBLIC_KEY",
+      ])
+        vi.stubEnv(key, undefined);
+      // The prior install's funded wallet survived the reset in the vault.
+      const priorEvm = generateWalletForChain("evm");
+      const priorSolana = generateWalletForChain("solana");
+      await testVault.vault.set("EVM_PRIVATE_KEY", priorEvm.privateKey, {
+        sensitive: true,
+      });
+      await testVault.vault.set("SOLANA_PRIVATE_KEY", priorSolana.privateKey, {
+        sensitive: true,
+      });
+      setAgentHostBridge({
+        ...savedBridge,
+        sharedVault: () => testVault.vault,
+      });
+      await writeFile(
+        filename,
+        JSON.stringify({ env: { ELIZA_WALLET_OS_STORE: "1" } }),
+      );
+      server = await startApiServer({
+        port: 0,
+        hostConfig: loadElizaConfig(),
+        skipDeferredStartupWork: true,
+      });
+      if (entry !== "boot auto-provision") {
+        const response = await fetch(
+          `http://127.0.0.1:${server.port}${entry === "first-run completion" ? "/api/first-run" : "/api/wallet/keys"}`,
+          {
+            method: entry === "first-run completion" ? "POST" : "GET",
+            headers: {
+              Authorization: `Bearer ${token}`,
+              "Content-Type": "application/json",
+            },
+            ...(entry === "first-run completion"
+              ? { body: JSON.stringify({ name: "Wallet fixture" }) }
+              : {}),
+          },
+        );
+        expect(response.status).toBe(200);
+        if (entry === "first-run keys route") {
+          const body = (await response.json()) as {
+            evmAddress: string;
+            solanaAddress: string;
+          };
+          // The re-onboarding user is shown the stored wallet's addresses.
+          expect(body.evmAddress).toBe(priorEvm.address);
+          expect(body.solanaAddress).toBe(priorSolana.address);
+        }
+      }
+      // Boolean assertions keep ephemeral private keys out of failure output.
+      expect(
+        (await testVault.vault.reveal("EVM_PRIVATE_KEY")) ===
+          priorEvm.privateKey,
+      ).toBe(true);
+      expect(
+        (await testVault.vault.reveal("SOLANA_PRIVATE_KEY")) ===
+          priorSolana.privateKey,
+      ).toBe(true);
+      expect(process.env.EVM_PRIVATE_KEY === priorEvm.privateKey).toBe(true);
+      expect(process.env.SOLANA_PRIVATE_KEY === priorSolana.privateKey).toBe(
+        true,
+      );
+      expect(process.env.SOLANA_PUBLIC_KEY === priorSolana.address).toBe(true);
+      expect(process.env.WALLET_PUBLIC_KEY === priorSolana.address).toBe(true);
+      const persisted = JSON.parse(await readFile(filename, "utf8"));
+      expect(persisted.env.EVM_PRIVATE_KEY).toBeUndefined();
+      expect(persisted.env.SOLANA_PRIVATE_KEY).toBeUndefined();
+    } finally {
+      setAgentHostBridge(savedBridge);
+      await server?.close();
+      await testVault.dispose();
+      await rm(directory, { recursive: true, force: true });
+    }
+  },
+);
+
+// Only the EVM key survived in the vault; the re-onboard must keep it and
+// still provision the genuinely missing Solana key.
+it("reuses the vault-held EVM key while provisioning the missing Solana key", async () => {
+  const directory = await mkdtemp(join(tmpdir(), "wallet-vault-partial-"));
+  const savedBridge = getAgentHostBridge();
+  const testVault = await createTestVault();
+  le
```

#### Recent Merged Pull Requests:
- **PR #33947** (2026-10-05): Exercise backup rollback through the database protocol (@lalalune)
- **PR #33946** (2026-10-05): fix(plugin-meetings): take only capitalized words as a self-introduced name (@greatcodeeer)
- **PR #33945** (2026-10-05): Consolidate agent backup snapshot wire contracts (@lalalune)
- **PR #33944** (closed): refactor(app)!: retire legacy recovery entirely (@lalalune)
- **PR #33943** (2026-10-05): fix(app): require Shared first-attempt launch proof (@hermesagent270-commits)
- **PR #33942** (2026-10-05): fix(browser): keep action previews independent of product identity (@lalalune)
- **PR #33941** (2026-10-05): fix(inbox): bound chat-history paging by time window and repeated pages (@lumix5)
- **PR #33940** (2026-10-05): refactor(core): finish public consumer and contract cleanup (@lalalune)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
