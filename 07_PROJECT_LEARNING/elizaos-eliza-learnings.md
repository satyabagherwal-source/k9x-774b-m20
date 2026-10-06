# Forensic Learning Record (Deep Inspection): elizaOS/eliza

> **Canonical Artifact**: `07_PROJECT_LEARNING/elizaos-eliza-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/elizaos/eliza](https://github.com/elizaos/eliza))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:36:13.010Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `elizaOS/eliza`
- **Description**: Open source agentic operating system
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 19543 stars

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

### Incident Patch 1: `7424bf88` (2026-10-06)
**Commit Message**: Merge pull request #34025 from elizaOS/codex/fix-cloud-eviction-fixture-20261006

test(cloud): release outbound reference before eviction

**File**: `packages/cloud/api/__tests__/shared-runtime-cutover-reminder.miniflare.test.ts` (modified, +4/-1)
```diff
@@ -158,7 +158,10 @@ const RUNTIME_STUBS = {
             async cancel() {
               options.historyStore.stagePending(agent.id, roomId, interrupted);
               options.executionCtx.waitUntil((async () => {
-                await fetch("https://finalization-gate.test/wait");
+                const response = await fetch("https://finalization-gate.test/wait");
+                // Drain the outbound body so the fixture does not retain a
+                // Workerd reference while the test evicts the Durable Object.
+                await response.text();
                 throw new Error("simulated off-queue finalization failure");
               })());
             },
```

---

### Incident Patch 2: `a766862a` (2026-10-06)
**Commit Message**: Merge pull request #34021 from elizaOS/dependabot/uv/packages/benchmarks/suites/OSWorld/uv-9233fb12f6

build(deps): bump the uv group across 3 directories with 3 updates

**File**: `packages/benchmarks/suites/OSWorld/uv.lock` (modified, +140/-101)
```diff
@@ -1448,11 +1448,11 @@ wheels = [
 
 [[package]]
 name = "fsspec"
-version = "2026.3.0"
+version = "2026.6.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/e1/cf/b50ddf667c15276a9ab15a70ef5f257564de271957933ffea49d2cdbcdfb/fsspec-2026.3.0.tar.gz", hash = "sha256:1ee6a0e28677557f8c2f994e3eea77db6392b4de9cd1f5d7a9e87a0ae9d01b41", size = 313547, upload-time = "2026-03-27T19:11:14.892Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/10/a1/ae4e3e5003468d6391d2c77b6fa1cd73bd5d13511d81c642d7b28ac90ed4/fsspec-2026.6.0.tar.gz", hash = "sha256:f5bac145310fe30e16e1471bd6840b2d990d609e872251d7e674241822abf01a", size = 313646, upload-time = "2026-06-16T01:57:28.105Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/d5/1f/5f4a3cd9e4440e9d9bc78ad0a91a1c8d46b4d429d5239ebe6793c9fe5c41/fsspec-2026.3.0-py3-none-any.whl", hash = "sha256:d2ceafaad1b3457968ed14efa28798162f1638dbb5d2a6868a2db002a5ee39a4", size = 202595, upload-time = "2026-03-27T19:11:13.595Z" },
+    { url = "https://files.pythonhosted.org/packages/e5/22/4222d7ddf3da30f363edaa98e329c2bce6c65497c9cb2810931c8b2c0fbc/fsspec-2026.6.0-py3-none-any.whl", hash = "sha256:02e0b71817df9b2169dc30a16832045764def1191b43dcff5bb85bdee212d2a1", size = 203949, upload-time = "2026-06-16T01:57:26.358Z" },
 ]
 
 [[package]]
@@ -2545,101 +2545,140 @@ wheels = [
 
 [[package]]
 name = "multidict"
-version = "6.7.1"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/1a/c2/c2d94cbe6ac1753f3fc980da97b3d930efe1da3af3c9f5125354436c073d/multidict-6.7.1.tar.gz", hash = "sha256:ec6652a1bee61c53a3e5776b6049172c53b6aaba34f18c9ad04f82712bac623d", size = 102010, upload-time = "2026-01-26T02:46:45.979Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/8d/9c/f20e0e2cf80e4b2e4b1c365bf5fe104ee633c751a724246262db8f1a0b13/multidict-6.7.1-cp312-cp312-macosx_10_13_universal2.whl", hash = "sha256:a90f75c956e32891a4eda3639ce6dd86e87105271f43d43442a3aedf3cddf172", size = 76893, upload-time = "2026-01-26T02:43:52.754Z" },
-    { url = "https://files.pythonhosted.org/packages/fe/cf/18ef143a81610136d3da8193da9d80bfe1cb548a1e2d1c775f26b23d024a/multidict-6.7.1-cp312-cp312-macosx_10_13_x86_64.whl", hash = "sha256:3fccb473e87eaa1382689053e4a4618e7ba7b9b9b8d6adf2027ee474597128cd", size = 45456, upload-time = "2026-01-26T02:43:53.893Z" },
-    { url = "https://files.pythonhosted.org/packages/a9/65/1caac9d4cd32e8433908683446eebc953e82d22b03d10d41a5f0fefe991b/multidict-6.7.1-cp312-cp312-macosx_11_0_arm64.whl", hash = "sha256:b0fa96985700739c4c7853a43c0b3e169360d6855780021bfc6d0f1ce7c123e7", size = 43872, upload-time = "2026-01-26T02:43:55.041Z" },
-    { url = "https://files.pythonhosted.org/packages/cf/3b/d6bd75dc4f3ff7c73766e04e705b00ed6dbbaccf670d9e05a12b006f5a21/multidict-6.7.1-cp312-cp312-manylinux1_i686.manylinux_2_28_i686.manylinux_2_5_i686.whl", hash = "sha256:cb2a55f408c3043e42b40cc8eecd575afa27b7e0b956dfb190de0f8499a57a53", size = 251018, upload-time = "2026-01-26T02:43:56.198Z" },
-    { url = "https://files.pythonhosted.org/packages/fd/80/c959c5933adedb9ac15152e4067c702a808ea183a8b64cf8f31af8ad3155/multidict-6.7.1-cp312-cp312-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:eb0ce7b2a32d09892b3dd6cc44877a0d02a33241fafca5f25c8b6b62374f8b75", size = 258883, upload-time = "2026-01-26T02:43:57.499Z" },
-    { url = "https://files.pythonhosted.org/packages/86/85/7ed40adafea3d4f1c8b916e3b5cc3a8e07dfcdcb9cd72800f4ed3ca1b387/multidict-6.7.1-cp312-cp312-manylinux2014_armv7l.manylinux_2_17_armv7l.manylinux_2_31_armv7l.whl", hash = "sha256:c3a32d23520ee37bf327d1e1a656fec76a2edd5c038bf43eddfa0572ec49c60b", size = 242413, upload-time = "2026-01-26T02:43:58.755Z" },
-    { url = "https://files.pythonhosted.org/packages/d2/57/b8565ff533e48595503c785f8361ff9a4fde4d67de25c207cd0ba3befd03/multidict-6.7.1-cp312-cp312-manylinux2014_ppc64le.manylinux_2_17_ppc64le.manylinux_2_28_ppc64le.whl", hash = "sha256:9c90fed18bffc0189ba814749fdcc102b536e83a9f738a9003e569acd540a733", size = 268404, upload-time = "2026-01-26T02:44:00.216Z" },
-    { url = "https://files.pythonhosted.org/packages/e0/50/9810c5c29350f7258180dfdcb2e52783a0632862eb334c4896ac717cebcb/multidict-6.7.1-cp312-cp312-manylinux2014_s390x.manylinux_2_17_s390x.manylinux_2_28_s390x.whl", hash = "sha256:da62917e6076f512daccfbbde27f46fed1c98fee202f0559adec8ee0de67f71a", size = 269456, upload-time = "2026-01-26T02:44:02.202Z" },
-    { url = "https://files.pythonhosted.org/packages/f3/8d/5e5be3ced1d12966fefb5c4ea3b2a5b480afcea36406559442c6e31d4a48/multidict-6.7.1-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl", hash = "sha256:bfde23ef6ed9db7eaee6c37dcec08524cb43903c60b285b172b6c094711b3961", size = 256322, upload-time = "2026-01-26T02:44:03.56Z" },
-    { url = "https://files.pythonhosted.org/packages/31/6e/d8a26d81ac166a5592782d208
```

**File**: `packages/benchmarks/suites/lifeops-bench/uv.lock` (modified, +184/-48)
```diff
@@ -137,6 +137,34 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/64/b4/17d4b0b2a2dc85a6df63d1157e028ed19f90d4cd97c36717afef2bc2f395/attrs-26.1.0-py3-none-any.whl", hash = "sha256:c647aa4a12dfbad9333ca4e71fe62ddc36f4e63b2d260a37a8b83d2f043ac309", size = 67548, upload-time = "2026-03-19T14:22:23.645Z" },
 ]
 
+[[package]]
+name = "boto3"
+version = "1.43.108"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "botocore" },
+    { name = "jmespath" },
+    { name = "s3transfer" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/48/59/fb93b6ebd9ad43eb9a58c7a6da51a0fe24ab0c04bc4d534a0bfc5eba7f59/boto3-1.43.108.tar.gz", hash = "sha256:03341f089158368acf83e921aca98b706095322ca52bc4c039a616940aa5ad41", size = 112682, upload-time = "2026-10-02T19:32:25.211Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/74/e4/7e88c40e9f61888e12dac0de41a5fddc2bcd1c3992d9b28e17d915cce0df/boto3-1.43.108-py3-none-any.whl", hash = "sha256:19e9da95ef0c494e27052049a42137550e66730509bb613e76eaa30ddf9a7170", size = 140045, upload-time = "2026-10-02T19:32:23.826Z" },
+]
+
+[[package]]
+name = "botocore"
+version = "1.43.108"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "jmespath" },
+    { name = "python-dateutil" },
+    { name = "urllib3" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/61/16/6b4477f433da2c11193802f538330ce080076c2f38d817ad437ed3cd1465/botocore-1.43.108.tar.gz", hash = "sha256:ee4f75cf3bdbb0da7912e089950e8112f692016539d939312c771499958e6cfd", size = 16312879, upload-time = "2026-10-02T19:32:20.797Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/7a/0b/4670b7e23914b5cc357be5ca45fae503b57d98ecff4b3eabea70412809fd/botocore-1.43.108-py3-none-any.whl", hash = "sha256:ab9d16c6b4350aaa54ed28202dfa2998b2d735fdbf3247eb60af469d8d48a5b8", size = 16008194, upload-time = "2026-10-02T19:32:15.086Z" },
+]
+
 [[package]]
 name = "certifi"
 version = "2026.4.22"
@@ -351,11 +379,11 @@ wheels = [
 
 [[package]]
 name = "fsspec"
-version = "2026.4.0"
+version = "2026.6.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/d5/8d/1c51c094345df128ca4a990d633fe1a0ff28726c9e6b3c41ba65087bba1d/fsspec-2026.4.0.tar.gz", hash = "sha256:301d8ac70ae90ef3ad05dcf94d6c3754a097f9b5fe4667d2787aa359ec7df7e4", size = 312760, upload-time = "2026-04-29T20:42:38.635Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/10/a1/ae4e3e5003468d6391d2c77b6fa1cd73bd5d13511d81c642d7b28ac90ed4/fsspec-2026.6.0.tar.gz", hash = "sha256:f5bac145310fe30e16e1471bd6840b2d990d609e872251d7e674241822abf01a", size = 313646, upload-time = "2026-06-16T01:57:28.105Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/d5/0c/043d5e551459da400957a1395e0febbf771446ff34291afcbe3d8be2a279/fsspec-2026.4.0-py3-none-any.whl", hash = "sha256:11ef7bb35dab8a394fde6e608221d5cf3e8499401c249bebaeaad760a1a8dec2", size = 203402, upload-time = "2026-04-29T20:42:36.842Z" },
+    { url = "https://files.pythonhosted.org/packages/e5/22/4222d7ddf3da30f363edaa98e329c2bce6c65497c9cb2810931c8b2c0fbc/fsspec-2026.6.0-py3-none-any.whl", hash = "sha256:02e0b71817df9b2169dc30a16832045764def1191b43dcff5bb85bdee212d2a1", size = 203949, upload-time = "2026-06-16T01:57:26.358Z" },
 ]
 
 [[package]]
@@ -367,6 +395,19 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/04/4b/29cac41a4d98d144bf5f6d33995617b185d14b22401f75ca86f384e87ff1/h11-0.16.0-py3-none-any.whl", hash = "sha256:63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86", size = 37515, upload-time = "2025-04-24T03:35:24.344Z" },
 ]
 
+[[package]]
+name = "h2"
+version = "4.4.1"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "hpack" },
+    { name = "hyperframe" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/e7/85/7c366e69d84c17bb778fe41419e1fbcce3033d5b7ce29bbffff0a98b859f/h2-4.4.1.tar.gz", hash = "sha256:4e866ffb1a869ae14dd9b5e6beb5c24a13da0495ad72b65925ded182521c1516", size = 2157281, upload-time = "2026-08-03T11:45:09.509Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/7e/22/e85faf23bd72a92d1921e37d674ca56eb298a3c8be31fdecef0ff2b3aaac/h2-4.4.1-py3-none-any.whl", hash = "sha256:0e25f1462b23c9cb82d9eb02e28bc706dac2a68cb457c6a0d74d63c8a2a5d0e6", size = 62636, upload-time = "2026-08-03T11:44:59.164Z" },
+]
+
 [[package]]
 name = "hf-xet"
 version = "1.5.0"
@@ -383,6 +424,15 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/62/94/3b66b148778ee100dcfd69c2ca22b57b41b44d3063ceec934f209e9184ce/hf_xet-1.5.0-cp37-abi3-win_arm64.whl", hash = "sha256:b6c9df403040248c76d808d3e047d64db2d923bae593eb244c41e425cf6cd7be", size = 3806916, upload-time = "2026-05-06T06:18:21.7Z" },
 ]
 
+[[package]]
+name = "hpack"
+version = "4.2.0"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.python
```

**File**: `packages/benchmarks/suites/swe_bench/pyproject.toml` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@ classifiers = [
 dependencies = [
     "elizaos-benchmark-support==0.1.0",
     "eliza-adapter",
-    "datasets==3.6.0",
-    "gitpython==3.1.62",
+    "datasets==5.1.0",
+    "gitpython==3.2.0",
     "unidiff==0.7.5",
     "docker==7.1.0",
     "swebench==4.1.0",
```

**File**: `packages/training/pyproject.toml` (modified, +2/-2)
```diff
@@ -116,7 +116,7 @@ rl = [
   # without serving don't have to install the full `serve` extra. The 0.27
   # line includes the auth, request-fanout, ReDoS, and media-input fixes that
   # are absent from the old 0.8 rollout server.
-  "vllm>=0.27.1,<0.31.0",
+  "vllm>=0.27.1,<0.32.0",
   # verl's dashboard dependency otherwise floats to historical Ray releases.
   # Keep the resolved dashboard past the published RCE and unauthenticated
   # destructive-endpoint advisory ranges.
@@ -161,7 +161,7 @@ serve = [
   # Pin a minor floor that captures all of these. See
   # scripts/inference/serve_vllm.py for the canonical flag set per model +
   # GPU target.
-  "vllm>=0.27.1,<0.31.0",
+  "vllm>=0.27.1,<0.32.0",
   # `vllm-flash-attn` is bundled with vLLM 0.20+; add explicitly so the
   # constraint solver doesn't pull a stale wheel from a transitive dep.
   "transformers>=4.46.0",
```

---

### Incident Patch 3: `6e38d11e` (2026-10-06)
**Commit Message**: style(mcp): format timeout assertions for root verification

**File**: `plugins/plugin-mcp/src/__tests__/service.call-timeout.test.ts` (modified, +6/-10)
```diff
@@ -25,11 +25,9 @@ describe("McpService tool-call timeout", () => {
 
     await service.callTool("example", "lookup");
 
-    expect(callTool).toHaveBeenCalledWith(
-      { name: "lookup", arguments: undefined },
-      undefined,
-      { timeout: 2500 },
-    );
+    expect(callTool).toHaveBeenCalledWith({ name: "lookup", arguments: undefined }, undefined, {
+      timeout: 2500,
+    });
   });
 
   it("keeps the configured timeout for stdio servers", async () => {
@@ -41,10 +39,8 @@ describe("McpService tool-call timeout", () => {
 
     await service.callTool("example", "lookup");
 
-    expect(callTool).toHaveBeenCalledWith(
-      { name: "lookup", arguments: undefined },
-      undefined,
-      { timeout: 3500 },
-    );
+    expect(callTool).toHaveBeenCalledWith({ name: "lookup", arguments: undefined }, undefined, {
+      timeout: 3500,
+    });
   });
 });
```

---

### Incident Patch 4: `0563318d` (2026-10-06)
**Commit Message**: Merge pull request #34024 from elizaOS/codex/fix-mcp-test-format-20261006

test(mcp): format discovered timeout regression

**File**: `plugins/plugin-mcp/src/__tests__/service.call-timeout.test.ts` (modified, +6/-10)
```diff
@@ -25,11 +25,9 @@ describe("McpService tool-call timeout", () => {
 
     await service.callTool("example", "lookup");
 
-    expect(callTool).toHaveBeenCalledWith(
-      { name: "lookup", arguments: undefined },
-      undefined,
-      { timeout: 2500 },
-    );
+    expect(callTool).toHaveBeenCalledWith({ name: "lookup", arguments: undefined }, undefined, {
+      timeout: 2500,
+    });
   });
 
   it("keeps the configured timeout for stdio servers", async () => {
@@ -41,10 +39,8 @@ describe("McpService tool-call timeout", () => {
 
     await service.callTool("example", "lookup");
 
-    expect(callTool).toHaveBeenCalledWith(
-      { name: "lookup", arguments: undefined },
-      undefined,
-      { timeout: 3500 },
-    );
+    expect(callTool).toHaveBeenCalledWith({ name: "lookup", arguments: undefined }, undefined, {
+      timeout: 3500,
+    });
   });
 });
```

---

### Incident Patch 5: `f332ef37` (2026-10-06)
**Commit Message**: Merge pull request #34022 from Chihyunpark1/fix/telegram-access-policy-docs-20261006

docs(telegram): clarify chat access configuration

**File**: `plugins/plugin-telegram/README.md` (modified, +21/-0)
```diff
@@ -8,6 +8,27 @@ may own a bot token. DMs default to pairing; configure `TELEGRAM_DM_POLICY` and
 `TELEGRAM_ALLOWED_CHATS` deliberately. Attachment references must never expose bot
 tokens.
 
+## Chat access
+
+`TELEGRAM_DM_POLICY` accepts `pairing` (the default), `open`, `allowlist`, or
+`disabled`. With no chat allowlist, pairing holds unknown DM senders for approval;
+`open` allows any sender to DM the bot. Choose it only when that access is intended.
+
+To restrict the bot, set `TELEGRAM_ALLOWED_CHATS` to a JSON array of chat ID
+strings:
+
+```sh
+TELEGRAM_ALLOWED_CHATS='["123456789", "-1001234567890"]'
+```
+
+In the full bot service, a non-empty per-account `allowedChats` list takes
+precedence over `TELEGRAM_ALLOWED_CHATS`. Otherwise, the global allowlist is
+authoritative for DMs, groups, channels, and topics.
+A malformed value blocks all chats until corrected. An unset or empty string
+leaves non-private chats open and applies `TELEGRAM_DM_POLICY` to private chats;
+the valid JSON value `[]` instead denies every chat. Set `TELEGRAM_DM_POLICY`
+to `allowlist` only when an allowlist is configured.
+
 ## Development
 
 Install dependencies with `bun install` at the repository root. Run from that root:
```

---

### Incident Patch 6: `fea694a4` (2026-10-06)
**Commit Message**: test(mcp): format discovered timeout regression

**File**: `plugins/plugin-mcp/src/__tests__/service.call-timeout.test.ts` (modified, +6/-10)
```diff
@@ -25,11 +25,9 @@ describe("McpService tool-call timeout", () => {
 
     await service.callTool("example", "lookup");
 
-    expect(callTool).toHaveBeenCalledWith(
-      { name: "lookup", arguments: undefined },
-      undefined,
-      { timeout: 2500 },
-    );
+    expect(callTool).toHaveBeenCalledWith({ name: "lookup", arguments: undefined }, undefined, {
+      timeout: 2500,
+    });
   });
 
   it("keeps the configured timeout for stdio servers", async () => {
@@ -41,10 +39,8 @@ describe("McpService tool-call timeout", () => {
 
     await service.callTool("example", "lookup");
 
-    expect(callTool).toHaveBeenCalledWith(
-      { name: "lookup", arguments: undefined },
-      undefined,
-      { timeout: 3500 },
-    );
+    expect(callTool).toHaveBeenCalledWith({ name: "lookup", arguments: undefined }, undefined, {
+      timeout: 3500,
+    });
   });
 });
```

---

### Incident Patch 7: `d679de34` (2026-10-06)
**Commit Message**: fix(cloud): require invoice identity for paid allowance grants

**File**: `packages/cloud/shared/src/db/migrations/0534_subscription_allowance_invoice_authority.sql` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+-- The trial variant makes invoice IDs nullable. CHECK(NULL) otherwise admits a
+-- paid-invoice grant without its invoice identity. Preserve existing rows and
+-- fail migration on invalid historical data rather than inventing provenance.
+ALTER TABLE subscription_allowance_periods
+  DROP CONSTRAINT subscription_allowance_periods_invoice_id_check,
+  ADD CONSTRAINT subscription_allowance_periods_invoice_id_check CHECK (
+    provider = 'stripe' AND provider_environment IN ('test', 'live') AND (
+      (grant_source = 'paid_invoice' AND stripe_invoice_id IS NOT NULL
+        AND stripe_invoice_id ~ '^in_[A-Za-z0-9]+$' AND trial_claim_id IS NULL)
+      OR (grant_source = 'trial_claim' AND billing_scope_id IS NOT NULL
+        AND stripe_invoice_id IS NULL AND trial_claim_id IS NOT NULL)
+    )
+  );
```

**File**: `packages/cloud/shared/src/db/migrations/meta/_journal.json` (modified, +7/-0)
```diff
@@ -3529,6 +3529,13 @@
       "when": 1796083200151,
       "tag": "0533_subscription_invoice_debt_observations",
       "breakpoints": true
+    },
+    {
+      "idx": 504,
+      "version": "7",
+      "when": 1796083200152,
+      "tag": "0534_subscription_allowance_invoice_authority",
+      "breakpoints": true
     }
   ]
 }
```

**File**: `packages/cloud/shared/src/db/repositories/app-subscription-authority.pglite.test.ts` (modified, +102/-0)
```diff
@@ -6,6 +6,7 @@ import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "
 import { randomUUID } from "node:crypto";
 import { readFile } from "node:fs/promises";
 import { Client } from "pg";
+import { loadCanonicalMigrations } from "../../../../scripts/admin/canonical-migration-ledger";
 import { installBillingCommandEvidenceTestColumns } from "../../testing";
 
 const postgresUrl = process.env.APP_BILLING_TEST_POSTGRES_URL;
@@ -32,6 +33,7 @@ const appB = randomUUID();
 const planA = randomUUID();
 const planB = randomUUID();
 const digest = "a".repeat(64);
+let invoiceAuthorityMigration: string[];
 
 beforeAll(async () => {
   const module = await import("../client");
@@ -96,6 +98,14 @@ beforeAll(async () => {
     for (const statement of migration.split("--> statement-breakpoint"))
       if (statement.trim()) await client.exec(statement.replaceAll('"public".', ""));
   }
+  const canonical = await loadCanonicalMigrations();
+  const authority = canonical.find(
+    (migration) => migration.entry.tag === "0534_subscription_allowance_invoice_authority",
+  );
+  if (!authority)
+    throw new Error("Invoice authority migration is absent from the canonical ledger");
+  invoiceAuthorityMigration = authority.statements;
+  for (const statement of invoiceAuthorityMigration) await client.exec(statement);
   await installBillingCommandEvidenceTestColumns((statement) => client.exec(statement));
 
   await client.query(
@@ -562,6 +572,98 @@ describe("atomic app subscription finalization", () => {
       ).rows,
     ).toEqual([{ credit_balance: "42", stripe_customer_id: "cus_infrastructure" }]);
   });
+  test("paid allowance cannot use a null invoice as a substitute for financial authority", async () => {
+    const { appSubscriptionFinalizer } = await import("./app-subscription-finalizer");
+    const { input } = await providerTrialFixture();
+    const result = await appSubscriptionFinalizer.applyObservation(input);
+    expect(result.allowance?.grant_source).toBe("trial_claim");
+    expect(result.allowance?.stripe_invoice_id).toBeNull();
+    const insertPaid = (invoice: string | null) =>
+      client.query(
+        `INSERT INTO subscription_allowance_periods
+        (billing_scope_id, merchant_key, organization_id, subscription_id, subscription_revision,
+         provider, provider_environment, stripe_invoice_id, grant_source, trial_claim_id,
+         plan_key, catalog_version, period_start, period_end, expires_at,
+         granted_amount, available_amount)
+       SELECT billing_scope_id, merchant_key, organization_id, subscription_id, subscription_revision,
+         provider, provider_environment, $2, 'paid_invoice', NULL,
+         plan_key, catalog_version, period_start + interval '2 months',
+         period_end + interval '2 months', expires_at + interval '2 months',
+         granted_amount, granted_amount
+       FROM subscription_allowance_periods WHERE id=$1 RETURNING id, stripe_invoice_id`,
+        [result.allowance!.id, invoice],
+      );
+    await expect(insertPaid(null)).rejects.toMatchObject({
+      code: "23514",
+      constraint: "subscription_allowance_periods_invoice_id_check",
+    });
+    await expect(insertPaid("")).rejects.toMatchObject({
+      code: "23514",
+      constraint: "subscription_allowance_periods_invoice_id_check",
+    });
+    await expect(insertPaid("pi_notAnInvoice")).rejects.toMatchObject({
+      code: "23514",
+      constraint: "subscription_allowance_periods_invoice_id_check",
+    });
+    const invoice = `in_${randomUUID().replaceAll("-", "")}`;
+    const paid = (await insertPaid(invoice)).rows as { id: string; stripe_invoice_id: string }[];
+    expect(paid).toHaveLength(1);
+    expect(paid[0]!.stripe_invoice_id).toBe(invoice);
+    await expect(
+      client.query("UPDATE subscription_allowance_periods SET stripe_invoice_id=NULL WHERE id=$1", [
+        paid[0]!.id,
+      ]),
+    ).rejects.toMatchObject({
+      code: "23514",
+      constraint: "subscription_allowance_periods_invoice_id_check",
+    });
+    expect(
+      (
+        await client.query(
+          "SELECT stripe_invoice_id FROM subscription_allowance_periods WHERE id=$1",
+          [paid[0]!.id],
+        )
+      ).rows,
+    ).toEqual([{ stripe_invoice_id: invoice }]);
+    // Validate existing data during rollout; never fabricate invoice provenance to
+    // get a dirty historical database through the new migration.
+    const predecessor = (
+      await readFile(
+        new URL("../migrations/0405_subscription_app_scope_guards.sql", import.meta.url),
+        "utf8",
+      )
+    )
+      .split("--> statement-breakpoint")
+      .find((statement) =>
+        statement.includes('ADD CONSTRAINT "subscription_allowance_periods_invoice_id_check"'),
+      );
+    if (!predecessor) throw new Error("Historical invoice constraint is missing");
+    await client.exec("BEGIN");
+    try {
+      await client.exec(
+        "ALTER TABLE subscriptio
```

**File**: `packages/cloud/shared/src/db/schemas/subscription-allowance-periods.ts` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ export const subscriptionAllowancePeriods = pgTable(
     ),
     invoice_id_check: check(
       "subscription_allowance_periods_invoice_id_check",
-      sql`${table.provider} = 'stripe' AND ${table.provider_environment} IN ('test','live') AND ((${table.grant_source} = 'paid_invoice' AND ${table.stripe_invoice_id} ~ '^in_[A-Za-z0-9]+$' AND ${table.trial_claim_id} IS NULL) OR (${table.grant_source} = 'trial_claim' AND ${table.billing_scope_id} IS NOT NULL AND ${table.stripe_invoice_id} IS NULL AND ${table.trial_claim_id} IS NOT NULL))`,
+      sql`${table.provider} = 'stripe' AND ${table.provider_environment} IN ('test','live') AND ((${table.grant_source} = 'paid_invoice' AND ${table.stripe_invoice_id} IS NOT NULL AND ${table.stripe_invoice_id} ~ '^in_[A-Za-z0-9]+$' AND ${table.trial_claim_id} IS NULL) OR (${table.grant_source} = 'trial_claim' AND ${table.billing_scope_id} IS NOT NULL AND ${table.stripe_invoice_id} IS NULL AND ${table.trial_claim_id} IS NOT NULL))`,
     ),
     period_check: check(
       "subscription_allowance_periods_period_check",
```

---

### Incident Patch 8: `af329bcd` (2026-10-06)
**Commit Message**: Merge pull request #34023 from Chihyunpark1/fix/google-workspace-oauth-callback-docs-20261006

docs(google-workspace): clarify OAuth callback setup

**File**: `plugins/plugin-google-workspace/README.md` (modified, +10/-0)
```diff
@@ -9,6 +9,16 @@ Node-only integration. Enable the relevant Google APIs and configure `GOOGLE_CLI
 can be injected without starting OAuth. Keep account scopes and token isolation intact;
 Google Chat uses its separate service-account transport.
 
+## OAuth callback setup
+
+The connector callback path is `/api/connectors/google/oauth/callback`. Set
+`GOOGLE_REDIRECT_URI` to the exact URL served by the Eliza API at that path, then
+add that same URL to the Google OAuth client's authorized redirect URIs. The
+scheme, hostname, port, and path must match; for a public host, use HTTPS and
+route the callback path to the connector API. Plain HTTP callbacks are accepted
+only on loopback addresses. A mismatch in host, port, or path prevents account
+authorization from completing.
+
 ## Development
 
 Install dependencies with `bun install` at the repository root. Run from that root:
```

---

### Incident Patch 9: `c8e35207` (2026-10-06)
**Commit Message**: Merge pull request #34020 from Chihyunpark1/fix/agent-orchestrator-setup-docs-20261006

docs(agent-orchestrator): clarify ACP setup

**File**: `plugins/plugin-agent-orchestrator/README.md` (modified, +23/-4)
```diff
@@ -4,10 +4,29 @@ Canonical elizaOS plugin for spawning and orchestrating coding sub-agents via th
 Client Protocol (ACP), with workspace lifecycle, GitHub integration, task history, and
 runtime-driven sub-agent routing.
 
-The default ACP transport is native; `ELIZA_ACP_TRANSPORT=cli` selects the acpx wrapper.
-Configure the chosen coding-agent executable and credentials. Child session identities
-and credential environments are spawn-managed; do not reuse one child’s authority for
-another.
+## Configure a coding agent
+
+The plugin starts coding-agent processes on the host running Eliza. Install the
+chosen ACP executable there. For adapters that use a local CLI login,
+authenticate the operating-system account that runs Eliza. Installing this
+package does not install or authenticate Claude Code, Codex, or another agent
+for you.
+
+The native ACP transport is the default. Set `ELIZA_ACP_DEFAULT_AGENT` to
+`elizaos`, `pi-agent`, `claude`, `codex`, `kimi`, or `grok` to choose the
+default adapter when a task does not name one. For example:
+
+```sh
+ELIZA_ACP_TRANSPORT=native
+ELIZA_ACP_DEFAULT_AGENT=codex
+```
+
+Each adapter has a default executable command in the package manifest. If it
+is not on the host's `PATH`, set that adapter's `ELIZA_*_ACP_COMMAND` to an
+installed command. `ELIZA_ACP_TRANSPORT=cli` selects the legacy `acpx` wrapper
+and requires `acpx` on `PATH` or an `ELIZA_ACP_CLI` command. Child session
+identities and credential environments are spawn-managed; do not copy one
+child's credentials into another child's environment.
 
 ## Development
 
```

---

### Incident Patch 10: `dcc990f5` (2026-10-06)
**Commit Message**: Merge pull request #34019 from Chihyunpark1/fix/health-host-integration-docs-20261006

docs(health): clarify host integration requirements

**File**: `plugins/plugin-health/README.md` (modified, +13/-0)
```diff
@@ -2,6 +2,19 @@
 
 Health, sleep, circadian-regularity, and screen-time domain plugin for elizaOS.
 
+## Host integration
+
+Loading this plugin registers health connectors, anchors, activity signal
+families, default packs, the health view, and typed health contracts. It does
+not register `OWNER_HEALTH` or `OWNER_SCREENTIME` actions or their routes:
+those require host-owned permissions and storage, and are currently provided by
+`plugin-personal-assistant`. A host that loads only `plugin-health` will expose
+the shared health domain but will not make those owner actions available.
+
+Connector data also comes from the host. Configure and authorize a supported
+provider through the host's connector setup; adding this package alone does
+not request mobile permissions, connect an account, or import health records.
+
 ## Development
 
 Install dependencies with `bun install` at the repository root. Run from that root:
```

---

### Incident Patch 11: `ea3a4eb1` (2026-10-06)
**Commit Message**: Merge branch 'fix/agent-orchestrator-setup-docs-20261006' of https://github.com/Chihyunpark1/eliza into codex/review-acp34020-batch243



---

### Incident Patch 12: `2cae22ef` (2026-10-06)
**Commit Message**: docs(health): clarify host integration requirements

**File**: `plugins/plugin-health/README.md` (modified, +13/-0)
```diff
@@ -2,6 +2,19 @@
 
 Health, sleep, circadian-regularity, and screen-time domain plugin for elizaOS.
 
+## Host integration
+
+Loading this plugin registers health connectors, anchors, activity signal
+families, default packs, the health view, and typed health contracts. It does
+not register `OWNER_HEALTH` or `OWNER_SCREENTIME` actions or their routes:
+those require host-owned permissions and storage, and are currently provided by
+`plugin-personal-assistant`. A host that loads only `plugin-health` will expose
+the shared health domain but will not make those owner actions available.
+
+Connector data also comes from the host. Configure and authorize a supported
+provider through the host's connector setup; adding this package alone does
+not request mobile permissions, connect an account, or import health records.
+
 ## Development
 
 Install dependencies with `bun install` at the repository root. Run from that root:
```

---

### Incident Patch 13: `d1bba1d4` (2026-10-06)
**Commit Message**: build(deps): bump the uv group across 3 directories with 3 updates

Bumps the uv group with 3 updates in the /packages/benchmarks/suites/OSWorld directory: [fsspec](https://github.com/fsspec/filesystem_spec), [multidict](https://github.com/aio-libs/multidict) and [werkzeug](https://github.com/pallets/werkzeug).
Bumps the uv group with 2 updates in the /packages/benchmarks/suites/lifeops-bench directory: [fsspec](https://github.com/fsspec/filesystem_spec) and [multidict](https://github.com/aio-libs/multidict).
Bumps the uv group with 3 updates in the /packages/training directory: [fsspec](https://github.com/fsspec/filesystem_spec), [multidict](https://github.com/aio-libs/multidict) and [werkzeug](https://github.com/pallets/werkzeug).


Updates `fsspec` from 2026.3.0 to 2026.6.0
- [Commits](https://github.com/fsspec/filesystem_spec/compare/2026.3.0...2026.6.0)

Updates `multidict` from 6.7.1 to 6.9.1
- [Release notes](https://github.com/aio-libs/multidict/releases)
- [Changelog](https://github.com/aio-libs/multidict/blob/master/CHANGES.rst)
- [Commits](https://github.com/aio-libs/multidict/compare/v6.7.1...v6.9.1)

Updates `werkzeug` from 3.1.8 to 3.1.9
- [Release notes](https://gith

**File**: `packages/benchmarks/suites/OSWorld/uv.lock` (modified, +140/-101)
```diff
@@ -1448,11 +1448,11 @@ wheels = [
 
 [[package]]
 name = "fsspec"
-version = "2026.3.0"
+version = "2026.6.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/e1/cf/b50ddf667c15276a9ab15a70ef5f257564de271957933ffea49d2cdbcdfb/fsspec-2026.3.0.tar.gz", hash = "sha256:1ee6a0e28677557f8c2f994e3eea77db6392b4de9cd1f5d7a9e87a0ae9d01b41", size = 313547, upload-time = "2026-03-27T19:11:14.892Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/10/a1/ae4e3e5003468d6391d2c77b6fa1cd73bd5d13511d81c642d7b28ac90ed4/fsspec-2026.6.0.tar.gz", hash = "sha256:f5bac145310fe30e16e1471bd6840b2d990d609e872251d7e674241822abf01a", size = 313646, upload-time = "2026-06-16T01:57:28.105Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/d5/1f/5f4a3cd9e4440e9d9bc78ad0a91a1c8d46b4d429d5239ebe6793c9fe5c41/fsspec-2026.3.0-py3-none-any.whl", hash = "sha256:d2ceafaad1b3457968ed14efa28798162f1638dbb5d2a6868a2db002a5ee39a4", size = 202595, upload-time = "2026-03-27T19:11:13.595Z" },
+    { url = "https://files.pythonhosted.org/packages/e5/22/4222d7ddf3da30f363edaa98e329c2bce6c65497c9cb2810931c8b2c0fbc/fsspec-2026.6.0-py3-none-any.whl", hash = "sha256:02e0b71817df9b2169dc30a16832045764def1191b43dcff5bb85bdee212d2a1", size = 203949, upload-time = "2026-06-16T01:57:26.358Z" },
 ]
 
 [[package]]
@@ -2545,101 +2545,140 @@ wheels = [
 
 [[package]]
 name = "multidict"
-version = "6.7.1"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/1a/c2/c2d94cbe6ac1753f3fc980da97b3d930efe1da3af3c9f5125354436c073d/multidict-6.7.1.tar.gz", hash = "sha256:ec6652a1bee61c53a3e5776b6049172c53b6aaba34f18c9ad04f82712bac623d", size = 102010, upload-time = "2026-01-26T02:46:45.979Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/8d/9c/f20e0e2cf80e4b2e4b1c365bf5fe104ee633c751a724246262db8f1a0b13/multidict-6.7.1-cp312-cp312-macosx_10_13_universal2.whl", hash = "sha256:a90f75c956e32891a4eda3639ce6dd86e87105271f43d43442a3aedf3cddf172", size = 76893, upload-time = "2026-01-26T02:43:52.754Z" },
-    { url = "https://files.pythonhosted.org/packages/fe/cf/18ef143a81610136d3da8193da9d80bfe1cb548a1e2d1c775f26b23d024a/multidict-6.7.1-cp312-cp312-macosx_10_13_x86_64.whl", hash = "sha256:3fccb473e87eaa1382689053e4a4618e7ba7b9b9b8d6adf2027ee474597128cd", size = 45456, upload-time = "2026-01-26T02:43:53.893Z" },
-    { url = "https://files.pythonhosted.org/packages/a9/65/1caac9d4cd32e8433908683446eebc953e82d22b03d10d41a5f0fefe991b/multidict-6.7.1-cp312-cp312-macosx_11_0_arm64.whl", hash = "sha256:b0fa96985700739c4c7853a43c0b3e169360d6855780021bfc6d0f1ce7c123e7", size = 43872, upload-time = "2026-01-26T02:43:55.041Z" },
-    { url = "https://files.pythonhosted.org/packages/cf/3b/d6bd75dc4f3ff7c73766e04e705b00ed6dbbaccf670d9e05a12b006f5a21/multidict-6.7.1-cp312-cp312-manylinux1_i686.manylinux_2_28_i686.manylinux_2_5_i686.whl", hash = "sha256:cb2a55f408c3043e42b40cc8eecd575afa27b7e0b956dfb190de0f8499a57a53", size = 251018, upload-time = "2026-01-26T02:43:56.198Z" },
-    { url = "https://files.pythonhosted.org/packages/fd/80/c959c5933adedb9ac15152e4067c702a808ea183a8b64cf8f31af8ad3155/multidict-6.7.1-cp312-cp312-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:eb0ce7b2a32d09892b3dd6cc44877a0d02a33241fafca5f25c8b6b62374f8b75", size = 258883, upload-time = "2026-01-26T02:43:57.499Z" },
-    { url = "https://files.pythonhosted.org/packages/86/85/7ed40adafea3d4f1c8b916e3b5cc3a8e07dfcdcb9cd72800f4ed3ca1b387/multidict-6.7.1-cp312-cp312-manylinux2014_armv7l.manylinux_2_17_armv7l.manylinux_2_31_armv7l.whl", hash = "sha256:c3a32d23520ee37bf327d1e1a656fec76a2edd5c038bf43eddfa0572ec49c60b", size = 242413, upload-time = "2026-01-26T02:43:58.755Z" },
-    { url = "https://files.pythonhosted.org/packages/d2/57/b8565ff533e48595503c785f8361ff9a4fde4d67de25c207cd0ba3befd03/multidict-6.7.1-cp312-cp312-manylinux2014_ppc64le.manylinux_2_17_ppc64le.manylinux_2_28_ppc64le.whl", hash = "sha256:9c90fed18bffc0189ba814749fdcc102b536e83a9f738a9003e569acd540a733", size = 268404, upload-time = "2026-01-26T02:44:00.216Z" },
-    { url = "https://files.pythonhosted.org/packages/e0/50/9810c5c29350f7258180dfdcb2e52783a0632862eb334c4896ac717cebcb/multidict-6.7.1-cp312-cp312-manylinux2014_s390x.manylinux_2_17_s390x.manylinux_2_28_s390x.whl", hash = "sha256:da62917e6076f512daccfbbde27f46fed1c98fee202f0559adec8ee0de67f71a", size = 269456, upload-time = "2026-01-26T02:44:02.202Z" },
-    { url = "https://files.pythonhosted.org/packages/f3/8d/5e5be3ced1d12966fefb5c4ea3b2a5b480afcea36406559442c6e31d4a48/multidict-6.7.1-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl", hash = "sha256:bfde23ef6ed9db7eaee6c37dcec08524cb43903c60b285b172b6c094711b3961", size = 256322, upload-time = "2026-01-26T02:44:03.56Z" },
-    { url = "https://files.pythonhosted.org/packages/31/6e/d8a26d81ac166a5592782d208
```

**File**: `packages/benchmarks/suites/lifeops-bench/uv.lock` (modified, +184/-48)
```diff
@@ -137,6 +137,34 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/64/b4/17d4b0b2a2dc85a6df63d1157e028ed19f90d4cd97c36717afef2bc2f395/attrs-26.1.0-py3-none-any.whl", hash = "sha256:c647aa4a12dfbad9333ca4e71fe62ddc36f4e63b2d260a37a8b83d2f043ac309", size = 67548, upload-time = "2026-03-19T14:22:23.645Z" },
 ]
 
+[[package]]
+name = "boto3"
+version = "1.43.108"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "botocore" },
+    { name = "jmespath" },
+    { name = "s3transfer" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/48/59/fb93b6ebd9ad43eb9a58c7a6da51a0fe24ab0c04bc4d534a0bfc5eba7f59/boto3-1.43.108.tar.gz", hash = "sha256:03341f089158368acf83e921aca98b706095322ca52bc4c039a616940aa5ad41", size = 112682, upload-time = "2026-10-02T19:32:25.211Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/74/e4/7e88c40e9f61888e12dac0de41a5fddc2bcd1c3992d9b28e17d915cce0df/boto3-1.43.108-py3-none-any.whl", hash = "sha256:19e9da95ef0c494e27052049a42137550e66730509bb613e76eaa30ddf9a7170", size = 140045, upload-time = "2026-10-02T19:32:23.826Z" },
+]
+
+[[package]]
+name = "botocore"
+version = "1.43.108"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "jmespath" },
+    { name = "python-dateutil" },
+    { name = "urllib3" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/61/16/6b4477f433da2c11193802f538330ce080076c2f38d817ad437ed3cd1465/botocore-1.43.108.tar.gz", hash = "sha256:ee4f75cf3bdbb0da7912e089950e8112f692016539d939312c771499958e6cfd", size = 16312879, upload-time = "2026-10-02T19:32:20.797Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/7a/0b/4670b7e23914b5cc357be5ca45fae503b57d98ecff4b3eabea70412809fd/botocore-1.43.108-py3-none-any.whl", hash = "sha256:ab9d16c6b4350aaa54ed28202dfa2998b2d735fdbf3247eb60af469d8d48a5b8", size = 16008194, upload-time = "2026-10-02T19:32:15.086Z" },
+]
+
 [[package]]
 name = "certifi"
 version = "2026.4.22"
@@ -351,11 +379,11 @@ wheels = [
 
 [[package]]
 name = "fsspec"
-version = "2026.4.0"
+version = "2026.6.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/d5/8d/1c51c094345df128ca4a990d633fe1a0ff28726c9e6b3c41ba65087bba1d/fsspec-2026.4.0.tar.gz", hash = "sha256:301d8ac70ae90ef3ad05dcf94d6c3754a097f9b5fe4667d2787aa359ec7df7e4", size = 312760, upload-time = "2026-04-29T20:42:38.635Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/10/a1/ae4e3e5003468d6391d2c77b6fa1cd73bd5d13511d81c642d7b28ac90ed4/fsspec-2026.6.0.tar.gz", hash = "sha256:f5bac145310fe30e16e1471bd6840b2d990d609e872251d7e674241822abf01a", size = 313646, upload-time = "2026-06-16T01:57:28.105Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/d5/0c/043d5e551459da400957a1395e0febbf771446ff34291afcbe3d8be2a279/fsspec-2026.4.0-py3-none-any.whl", hash = "sha256:11ef7bb35dab8a394fde6e608221d5cf3e8499401c249bebaeaad760a1a8dec2", size = 203402, upload-time = "2026-04-29T20:42:36.842Z" },
+    { url = "https://files.pythonhosted.org/packages/e5/22/4222d7ddf3da30f363edaa98e329c2bce6c65497c9cb2810931c8b2c0fbc/fsspec-2026.6.0-py3-none-any.whl", hash = "sha256:02e0b71817df9b2169dc30a16832045764def1191b43dcff5bb85bdee212d2a1", size = 203949, upload-time = "2026-06-16T01:57:26.358Z" },
 ]
 
 [[package]]
@@ -367,6 +395,19 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/04/4b/29cac41a4d98d144bf5f6d33995617b185d14b22401f75ca86f384e87ff1/h11-0.16.0-py3-none-any.whl", hash = "sha256:63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86", size = 37515, upload-time = "2025-04-24T03:35:24.344Z" },
 ]
 
+[[package]]
+name = "h2"
+version = "4.4.1"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "hpack" },
+    { name = "hyperframe" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/e7/85/7c366e69d84c17bb778fe41419e1fbcce3033d5b7ce29bbffff0a98b859f/h2-4.4.1.tar.gz", hash = "sha256:4e866ffb1a869ae14dd9b5e6beb5c24a13da0495ad72b65925ded182521c1516", size = 2157281, upload-time = "2026-08-03T11:45:09.509Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/7e/22/e85faf23bd72a92d1921e37d674ca56eb298a3c8be31fdecef0ff2b3aaac/h2-4.4.1-py3-none-any.whl", hash = "sha256:0e25f1462b23c9cb82d9eb02e28bc706dac2a68cb457c6a0d74d63c8a2a5d0e6", size = 62636, upload-time = "2026-08-03T11:44:59.164Z" },
+]
+
 [[package]]
 name = "hf-xet"
 version = "1.5.0"
@@ -383,6 +424,15 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/62/94/3b66b148778ee100dcfd69c2ca22b57b41b44d3063ceec934f209e9184ce/hf_xet-1.5.0-cp37-abi3-win_arm64.whl", hash = "sha256:b6c9df403040248c76d808d3e047d64db2d923bae593eb244c41e425cf6cd7be", size = 3806916, upload-time = "2026-05-06T06:18:21.7Z" },
 ]
 
+[[package]]
+name = "hpack"
+version = "4.2.0"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.python
```

**File**: `packages/benchmarks/suites/swe_bench/pyproject.toml` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@ classifiers = [
 dependencies = [
     "elizaos-benchmark-support==0.1.0",
     "eliza-adapter",
-    "datasets==3.6.0",
-    "gitpython==3.1.62",
+    "datasets==5.1.0",
+    "gitpython==3.2.0",
     "unidiff==0.7.5",
     "docker==7.1.0",
     "swebench==4.1.0",
```

**File**: `packages/training/pyproject.toml` (modified, +2/-2)
```diff
@@ -116,7 +116,7 @@ rl = [
   # without serving don't have to install the full `serve` extra. The 0.27
   # line includes the auth, request-fanout, ReDoS, and media-input fixes that
   # are absent from the old 0.8 rollout server.
-  "vllm>=0.27.1,<0.31.0",
+  "vllm>=0.27.1,<0.32.0",
   # verl's dashboard dependency otherwise floats to historical Ray releases.
   # Keep the resolved dashboard past the published RCE and unauthenticated
   # destructive-endpoint advisory ranges.
@@ -161,7 +161,7 @@ serve = [
   # Pin a minor floor that captures all of these. See
   # scripts/inference/serve_vllm.py for the canonical flag set per model +
   # GPU target.
-  "vllm>=0.27.1,<0.31.0",
+  "vllm>=0.27.1,<0.32.0",
   # `vllm-flash-attn` is bundled with vLLM 0.20+; add explicitly so the
   # constraint solver doesn't pull a stale wheel from a transitive dep.
   "transformers>=4.46.0",
```

---

### Incident Patch 14: `57bb7322` (2026-10-06)
**Commit Message**: Merge pull request #34018 from Chihyunpark1/fix/mcp-http-tool-timeout-20261006

fix(mcp): honor configured HTTP tool-call timeout

**File**: `plugins/plugin-mcp/src/__tests__/service.call-timeout.test.ts` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import { describe, expect, it, vi } from "vitest";
+import { McpService } from "../service";
+import type { McpConnection, McpServerConfig } from "../types";
+
+function serviceFor(config: McpServerConfig) {
+  const callTool = vi.fn().mockResolvedValue({ content: [] });
+  const connection = {
+    client: { callTool },
+    server: { config: JSON.stringify(config), disabled: false },
+  } as unknown as McpConnection;
+  const service = new McpService();
+  Object.defineProperty(service, "connections", {
+    value: new Map([["example", connection]]),
+  });
+  return { service, callTool };
+}
+
+describe("McpService tool-call timeout", () => {
+  it("uses the configured timeout for HTTP servers", async () => {
+    const { service, callTool } = serviceFor({
+      type: "streamable-http",
+      url: "https://mcp.example.test",
+      timeout: 2500,
+    });
+
+    await service.callTool("example", "lookup");
+
+    expect(callTool).toHaveBeenCalledWith(
+      { name: "lookup", arguments: undefined },
+      undefined,
+      { timeout: 2500 },
+    );
+  });
+
+  it("keeps the configured timeout for stdio servers", async () => {
+    const { service, callTool } = serviceFor({
+      type: "stdio",
+      command: "mcp-server",
+      timeoutInMillis: 3500,
+    });
+
+    await service.callTool("example", "lookup");
+
+    expect(callTool).toHaveBeenCalledWith(
+      { name: "lookup", arguments: undefined },
+      undefined,
+      { timeout: 3500 },
+    );
+  });
+});
```

**File**: `plugins/plugin-mcp/src/service.ts` (modified, +5/-5)
```diff
@@ -47,7 +47,7 @@ import {
 import {
   BACKOFF_MULTIPLIER,
   type ConnectionState,
-  DEFAULT_MCP_TIMEOUT_SECONDS,
+  DEFAULT_MCP_TIMEOUT_MS,
   DEFAULT_PING_CONFIG,
   type HttpMcpServerConfig,
   INITIAL_RETRY_DELAY,
@@ -568,11 +568,11 @@ export class McpService extends Service {
     if (connection.server.disabled) {
       throw new Error(`Server "${serverName}" is disabled`);
     }
-    let timeout = DEFAULT_MCP_TIMEOUT_SECONDS;
     const config = JSON.parse(connection.server.config) as McpServerConfig;
-    if (config.type === "stdio" && config.timeoutInMillis) {
-      timeout = config.timeoutInMillis;
-    }
+    const timeout =
+      config.type === "stdio"
+        ? (config.timeoutInMillis ?? DEFAULT_MCP_TIMEOUT_MS)
+        : (config.timeout ?? DEFAULT_MCP_TIMEOUT_MS);
     const result = await connection.client.callTool(
       {
         name: toolName,
```

**File**: `plugins/plugin-mcp/src/types.ts` (modified, +2/-2)
```diff
@@ -20,8 +20,8 @@ import type {
 } from "@modelcontextprotocol/sdk/types.js";
 
 export const MCP_SERVICE_NAME = "mcp" as const;
-export const DEFAULT_MCP_TIMEOUT_SECONDS = 60000;
-export const MIN_MCP_TIMEOUT_SECONDS = 1;
+export const DEFAULT_MCP_TIMEOUT_MS = 60000;
+export const MIN_MCP_TIMEOUT_MS = 1;
 export const DEFAULT_MAX_RETRIES = 2;
 
 export interface PingConfig {
```

---

### Incident Patch 15: `8333e177` (2026-10-06)
**Commit Message**: Merge branch 'fix/mcp-http-tool-timeout-20261006' of https://github.com/Chihyunpark1/eliza into codex/review-mcp34018-batch242

**File**: `plugins/plugin-mcp/src/service.call-timeout.test.ts` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import { describe, expect, it, vi } from "vitest";
+import { McpService } from "./service";
+import type { McpConnection, McpServerConfig } from "./types";
+
+function serviceFor(config: McpServerConfig) {
+  const callTool = vi.fn().mockResolvedValue({ content: [] });
+  const connection = {
+    client: { callTool },
+    server: { config: JSON.stringify(config), disabled: false },
+  } as unknown as McpConnection;
+  const service = new McpService();
+  Object.defineProperty(service, "connections", {
+    value: new Map([["example", connection]]),
+  });
+  return { service, callTool };
+}
+
+describe("McpService tool-call timeout", () => {
+  it("uses the configured timeout for HTTP servers", async () => {
+    const { service, callTool } = serviceFor({
+      type: "streamable-http",
+      url: "https://mcp.example.test",
+      timeout: 2500,
+    });
+
+    await service.callTool("example", "lookup");
+
+    expect(callTool).toHaveBeenCalledWith(
+      { name: "lookup", arguments: undefined },
+      undefined,
+      { timeout: 2500 },
+    );
+  });
+
+  it("keeps the configured timeout for stdio servers", async () => {
+    const { service, callTool } = serviceFor({
+      type: "stdio",
+      command: "mcp-server",
+      timeoutInMillis: 3500,
+    });
+
+    await service.callTool("example", "lookup");
+
+    expect(callTool).toHaveBeenCalledWith(
+      { name: "lookup", arguments: undefined },
+      undefined,
+      { timeout: 3500 },
+    );
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #34068** (closed): fix(inbox): page GET /api/inbox/messages until limit messages survive (@hermesagent270-commits)
- **PR #34029** (closed): fix(inbox): apply X DM sinceIso before the result limit (@lumix5)
- **PR #34026** (2026-10-06): fix(cloud): require invoice identity for paid allowance grants (@lalalune)
- **PR #34025** (2026-10-06): test(cloud): release outbound reference before eviction (@lalalune)
- **PR #34024** (2026-10-06): test(mcp): format discovered timeout regression (@lalalune)
- **PR #34023** (2026-10-06): docs(google-workspace): clarify OAuth callback setup (@Chihyunpark1)
- **PR #34022** (2026-10-06): docs(telegram): clarify chat access configuration (@Chihyunpark1)
- **PR #34021** (2026-10-06): build(deps): bump the uv group across 3 directories with 3 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
