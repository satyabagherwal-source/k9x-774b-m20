# Forensic Learning Record (Deep Inspection): TeamWiseFlow/xiaobei

> **Canonical Artifact**: `07_PROJECT_LEARNING/teamwiseflow-xiaobei-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TeamWiseFlow/xiaobei](https://github.com/TeamWiseFlow/xiaobei))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:58:05.040Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TeamWiseFlow/xiaobei`
- **Description**: 为OPC/中小微企业量身打造的自媒体获客智能体
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8573 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `awada/index.ts`
```
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/feishu";
import { awadaPlugin } from "./src/channel.js";
import { setAwadaRuntime } from "./src/runtime.js";
import { registerCustomerDb, type CustomerDbConfig } from "./src/customerdb.js";

export { monitorAwadaProvider } from "./src/monitor.js";
export { probeAwada } from "./src/probe.js";
export { sendTextToAwada, encodeAwadaTo, decodeAwadaTo } from "./src/send.js";
export { publishTextToAwada } from "./src/publisher.js";
export { awadaPlugin } from "./src/channel.js";

type AwadaPluginConfig = {
  /**
   * When set, activates the built-in CustomerDB feature:
   * injects customer context into LLM prompts and registers silent sales
   * commands (payment_success, club_join).
   *
   * Example openclaw.json:
   *   "plugins": {
   *     "entries": {
   *       "awada": {
   *         "config": {
   *           "customerdb": {
   *             "agentId": "sales-cs",
   *             "workspaceDir": "/home/user/.openclaw/workspace-sales-cs"
   *           }
   *         }
   *       }
   *     }
   *   }
   */
  customerdb?: CustomerDbConfig & { enabled?: boolean };
};

// Custom config schema that allows the `customerdb` field.
// Using emptyPluginConfigSchema() would reject any config key (additionalProperties: false).
const awadaConfigSchema = {
  safeParse(
    value: unknown,
  ): { success: true; data: unknown } | { success: false; error: string } {
    if (value === undefined) return { success: true, data: undefined };
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { success: false, error: "expected config object" };
    }
    const obj = value as Record<string, unknown>;
    const allowed = new Set(["customerdb"]);
    const extra = Object.keys(obj).filter((k) => !allowed.has(k));
    if (extra.length > 0) {
      return { success: false, error: `unknown config keys: ${extra.join(", ")}` };
    }
    return { success: true, data: obj };
  },
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      customerdb: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean" },
          agentId: { type: "string" },
          workspaceDir: { type: "string" },
        },
      },
    },
  },
};

const plugin = {
  id: "awada",
  name: "Awada",
  description: "Awada channel plugin — WeChat via Redis bridge",
  configSchema: awadaConfigSchema,
  register(api: OpenClawPluginApi) {
    setAwadaRuntime(api.runtime);
    api.registerChannel({ plugin: awadaPlugin });

    const pluginCfg = (api.pluginConfig ?? {}) as AwadaPluginConfig;
    const cdbCfg = pluginCfg.customerdb;
    if (cdbCfg && cdbCfg.enabled !== false && cdbCfg.agentId) {
      registerCustomerDb(api, cdbCfg);
    }
  },
};

export default plugin;

```

### Core Architecture Module: `awada/src/accounts.ts`
```
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/channel-plugin-common";
import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import type { AwadaConfig, ResolvedAwadaAccount } from "./types.js";

/** Official relay gateway endpoint — used when channels.awada.relayBaseUrl is not set. */
export const DEFAULT_RELAY_BASE_URL = "https://relay.openclaw-for-business.com";

function getAwadaCfg(cfg: ClawdbotConfig): AwadaConfig | undefined {
  return cfg.channels?.awada as AwadaConfig | undefined;
}

export function resolveAwadaAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedAwadaAccount {
  const awadaCfg = getAwadaCfg(params.cfg);
  const accountId = params.accountId?.trim() || DEFAULT_ACCOUNT_ID;
  const enabled = awadaCfg?.enabled !== false;
  // relayBaseUrl defaults to the official relay domain; only awadaKey is truly required.
  // lane is optional — when omitted, the server defaults to the "User" lane.
  const relayBaseUrl = awadaCfg?.relayBaseUrl?.trim() || DEFAULT_RELAY_BASE_URL;
  const awadaKey = awadaCfg?.awadaKey?.trim() || undefined;
  const lane = awadaCfg?.lane?.trim() || "";
  const configured = Boolean(awadaKey);

  return {
    accountId,
    enabled,
    configured,
    relayBaseUrl,
    awadaKey,
    lane,
    config: awadaCfg ?? {},
  };
}

export function listAwadaAccountIds(_cfg: ClawdbotConfig): string[] {
  return [DEFAULT_ACCOUNT_ID];
}

export function resolveDefaultAwadaAccountId(_cfg: ClawdbotConfig): string {
  return DEFAULT_ACCOUNT_ID;
}

```

### Core Architecture Module: `awada/src/audio-transcribe.ts`
```
/**
 * Audio transcription via 公共 ASR 路由（与 crews/main/skills/_shared/asr.py 同优先级）。
 *
 * 供应商优先级（2026-09 拍板，凭据在哪家走哪家）：
 *   1. 火山录音文件极速版 — VOLC_ASR_APP_ID+VOLC_ASR_ACCESS_KEY（旧控制台双头）
 *      或 VOLC_ASR_APP_KEY（新控制台单头）
 *      POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash
 *   2. 百炼业务空间 — WORKSPACE_ID + MODELSTUDIO_API_KEY/DASHSCOPE_API_KEY
 *      POST https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
 *   3. 百炼 agent plan — AWK_API_KEY
 *      POST https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
 *      模型 qwen-audio-3.0-asr-flash（BAILIAN_ASR_MODEL 可覆盖）
 *
 * 某家失败自动落下一家；全部失败时 error 汇总各家原因。
 * 百炼以 base64 data URI 直传（编码后 ≤10MB，语音消息远低于此限）。
 */

const VOLC_ASR_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";
const BAILIAN_WS_BASE_TEMPLATE = "https://{wsid}.cn-beijing.maas.aliyuncs.com/api/v1";
const BAILIAN_AGENT_PLAN_BASE = "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1";
const BAILIAN_ASR_PATH = "/services/aigc/multimodal-generation/generation";
const BAILIAN_DEFAULT_ASR_MODEL = "qwen-audio-3.0-asr-flash";
const MAX_BAILIAN_B64_BYTES = 9 * 1024 * 1024;

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/x-wav",
  ogg: "audio/ogg",
  opus: "audio/opus",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  amr: "audio/amr",
};

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

interface BailianEndpoint {
  base: string;
  apiKey: string;
  mode: "workspace" | "agent-plan";
}

function audioFormatHint(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext in AUDIO_MIME_BY_EXT ? ext : "wav";
}

function listBailianEndpoints(): BailianEndpoint[] {
  const endpoints: BailianEndpoint[] = [];
  const wsid = process.env.WORKSPACE_ID?.trim();
  if (wsid) {
    const key =
      process.env.MODELSTUDIO_API_KEY?.trim() ||
      process.env.DASHSCOPE_API_KEY?.trim();
    if (key) {
      endpoints.push({
        base: BAILIAN_WS_BASE_TEMPLATE.replace("{wsid}", wsid),
        apiKey: key,
        mode: "workspace",
      });
    }
  }
  const awkKey = process.env.AWK_API_KEY?.trim();
  if (awkKey) {
    endpoints.push({ base: BAILIAN_AGENT_PLAN_BASE, apiKey: awkKey, mode: "agent-plan" });
  }
  return endpoints;
}

async function transcribeVolc(
  audioBuffer: Buffer,
  fileName: string,
): Promise<TranscribeResult> {
  const appId = process.env.VOLC_ASR_APP_ID?.trim();
  const accessKey = process.env.VOLC_ASR_ACCESS_KEY?.trim();
  const appKey = process.env.VOLC_ASR_APP_KEY?.trim();
  const resourceId =
    process.env.VOLC_ASR_RESOURCE_ID?.trim() || "volc.bigasr.auc_turbo";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Resource-Id": resourceId,
    "X-Api-Request-Id": crypto.randomUUID(),
    "X-Api-Sequence": "-1",
  };
  let uid: string;
  if (appId && accessKey) {
    headers["X-Api-App-Key"] = appId;
    headers["X-Api-Access-Key"] = accessKey;
    uid = appId;
  } else if (appKey) {
    headers["X-Api-Key"] = appKey;
    uid = appKey;
  } else {
    return { ok: false, error: "火山 ASR 凭据未配置" };
  }

  const body = {
    user: { uid },
    audio: {
      data: audioBuffer.toString("base64"),
      format: audioFormatHint(fileName),
    },
    request: {
      model_name: "bigmodel",
      show_utterances: false,
      enable_itn: true,
      enable_punc: true,
    },
  };

  try {
    const res = await fetch(VOLC_ASR_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const status = res.headers.get("X-Api-Status-Code") ?? "";
    if (status !== "20000000") {
      const msg = res.headers.get("X-Api-Message") ?? "";
      const snippet = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, error: `火山 ASR 失败 (status=${status}, msg=${msg}): ${snippet}` };
    }
    const json = (await res.json()) as { result?: { text?: string } };
    const text = json.result?.text?.trim() ?? "";
    if (!text) {
      return { ok: false, error: "火山 ASR 返回空文本" };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: `火山 ASR 请求失败: ${String(err)}` };
  }
}

async function transcribeBailian(
  audioBuffer: Buffer,
  fileName: string,
  endpoint: BailianEndpoint,
): Promise<TranscribeResult> {
  if (audioBuffer.length * (4 / 3) > MAX_BAILIAN_B64_BYTES) {
    return {
      ok: false,
      error: `音频 ${audioBuffer.length} 字节超百炼 base64 上限（10MB）`,
    };
  }
  const fmt = audioFormatHint(fileName);
  const mime = AUDIO_MIME_BY_EXT[fmt] ?? "audio/x-wav";
  const model =
    process.env.BAILIAN_ASR_MODEL?.trim() || BAILIAN_DEFAULT_ASR_MODEL;

  const body = {
    model,
    input: {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: `data:${mime};base64,${audioBuffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
    },
    parameters: { format: fmt },
  };

  try {
    const res = await fetch(`${endpoint.base}${BAILIAN_ASR_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-SSE": "disable",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).slice(0, 200);
      return {
        ok: false,
        error: `百炼 ASR 失败 (${endpoint.mode}, HTTP ${res.status}): ${snippet}`,
      };
    }
    const json = (await res.json()) as { output?: { text?: string } };
    const text = json.output?.text?.trim() ?? "";
    if (!text) {
      return { ok: false, error: `百炼 ASR 返回空文本 (${endpoint.mode})` };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: `百炼 ASR 请求失败 (${endpoint.mode}): ${String(err)}` };
  }
}

function volcConfigured(): boolean {
  const appId = process.env.VOLC_ASR_APP_ID?.trim();
  const accessKey = process.env.VOLC_ASR_ACCESS_KEY?.trim();
  const appKey = process.env.VOLC_ASR_APP_KEY?.trim();
  return Boolean((appId && accessKey) || appKey);
}

/**
 * Transcribe an audio buffer: 火山 → 百炼业务空间 → 百炼 agent plan 依次尝试。
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string,
): Promise<TranscribeResult> {
  const errors: string[] = [];

  if (volcConfigured()) {
    const result = await transcribeVolc(audioBuffer, fileName);
    if (result.ok) {
      return result;
    }
    errors.push(`火山: ${result.error}`);
  }

  for (const endpoint of listBailianEndpoints()) {
    const result = await transcribeBailian(audioBuffer, fileName, endpoint);
    if (result.ok) {
      return result;
    }
    errors.push(`百炼(${endpoint.mode}): ${result.error}`);
  }

  if (errors.length === 0) {
    return {
      ok: false,
      error:
        "ASR 凭证未配置：需 VOLC_ASR_APP_ID+VOLC_ASR_ACCESS_KEY 或 VOLC_ASR_APP_KEY（火山），" +
        "或 WORKSPACE_ID+MODELSTUDIO_API_KEY/DASHSCOPE_API_KEY（百炼业务空间），" +
        "或 AWK_API_KEY（百炼 agent plan）",
    };
  }
  return { ok: false, error: errors.join(" | ") };
}

/**
 * Fetch audio content from a URL and return as Buffer.
 */
export async function fetchAudioBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

```

### Core Architecture Module: `awada/src/channel.ts`
```
import type { ChannelMeta, ChannelPlugin } from "openclaw/plugin-sdk/core";
import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import {
  buildProbeChannelStatusSummary,
  buildRuntimeAccountStatusSnapshot,
  createDefaultChannelRuntimeState,
} from "openclaw/plugin-sdk/status-helpers";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/channel-plugin-common";
import {
  resolveAwadaAccount,
  listAwadaAccountIds,
  resolveDefaultAwadaAccountId,
} from "./accounts.js";
import { awadaSetupWizard } from "./onboarding.js";
import { awadaMessageActions } from "./message-actions.js";
import { awadaOutbound } from "./outbound.js";
import { probeAwada } from "./probe.js";
import { decodeAwadaTo } from "./send.js";
import type { ResolvedAwadaAccount, AwadaConfig } from "./types.js";

const meta: ChannelMeta = {
  id: "awada",
  label: "Awada",
  selectionLabel: "Awada (WeChat via relay gateway)",
  docsPath: "/channels/awada",
  docsLabel: "awada",
  blurb: "WeChat (enterprise/personal) via awada relay gateway (HTTP/WS transport).",
  aliases: [],
  order: 80,
};

export const awadaPlugin: ChannelPlugin<ResolvedAwadaAccount> = {
  id: "awada",
  meta,
  capabilities: {
    chatTypes: ["direct"],
    polls: false,
    threads: false,
    media: true,
    reactions: false,
    edit: false,
    reply: false,
  },
  agentPrompt: {
    messageToolHints: () => [
      "- Awada targeting: replies are routed back to the originating WeChat user automatically.",
      '- To send a pre-stored WeChat cloud file or image, use action="sendAttachment" with file_name="<filename>".',
      "  Example: message(action=\"sendAttachment\", file_name=\"company_logo.jpg\")",
    ],
  },
  reload: { configPrefixes: ["channels.awada"] },
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        relayBaseUrl: { type: "string" },
        awadaKey: { type: "string" },
        lane: { type: "string" },
        dmPolicy: { type: "string", enum: ["open", "pairing", "allowlist"] },
        allowFrom: { type: "array", items: { type: "string" } },
        perMsgMaxLen: { type: "integer", minimum: 1 },
      },
    },
  },
  config: {
    listAccountIds: (cfg) => listAwadaAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveAwadaAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultAwadaAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId: _accountId, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        awada: {
          ...(cfg.channels?.awada as AwadaConfig | undefined),
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg, accountId: _accountId }) => {
      const next = { ...cfg } as ClawdbotConfig;
      const nextChannels = { ...cfg.channels };
      delete (nextChannels as Record<string, unknown>).awada;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      relayBaseUrl: account.relayBaseUrl,
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveAwadaAccount({ cfg, accountId });
      return (account.config?.allowFrom ?? []).map((entry) => String(entry));
    },
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean),
  },
  setup: {
    resolveAccountId: () => DEFAULT_ACCOUNT_ID,
    applyAccountConfig: ({ cfg, accountId: _accountId, input: _input }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        awada: {
          ...(cfg.channels?.awada as AwadaConfig | undefined),
          enabled: true,
        },
      },
    }),
  },
  setupWizard: awadaSetupWizard,
  outbound: awadaOutbound,
  actions: awadaMessageActions,
  messaging: {
    targetResolver: {
      looksLikeId: (raw) => raw.startsWith("awada:"),
      resolveTarget: async ({ input }) => {
        const decoded = decodeAwadaTo(input);
        if (!decoded) return null;
        return { to: input, kind: "user" as const, source: "normalized" as const };
      },
    },
  },
  status: {
    defaultRuntime: createDefaultChannelRuntimeState(DEFAULT_ACCOUNT_ID, { port: null }),
    buildChannelSummary: ({ snapshot }) =>
      buildProbeChannelStatusSummary(snapshot, { port: null }),
    probeAccount: async ({ account }) =>
      probeAwada({ relayBaseUrl: account.relayBaseUrl, accountId: account.accountId }),
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      relayBaseUrl: account.relayBaseUrl,
      ...buildRuntimeAccountStatusSnapshot({ runtime, probe }),
      port: null,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const { monitorAwadaProvider } = await import("./monitor.js");
      ctx.log?.info(`starting awada[${ctx.accountId}]`);
      return monitorAwadaProvider({
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId: ctx.accountId,
      });
    },
  },
};

```

### Core Architecture Module: `awada/src/config-schema.ts`
```
import { z } from "zod";
export { z };

export const AwadaConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    /** Relay gateway base URL, e.g. "https://relay.example.com". Bot talks HTTP/WS to relay, never Redis directly.
     *  Defaults to the official relay domain (https://relay.openclaw-for-business.com) when unset. */
    relayBaseUrl: z.string().optional(),
    /** Awada key issued by relay admin; carries awada:lane:<laneId> scopes. Sent as X-Awada-Key header.
     *  Distinct from the sign-service OFB_KEY — relay admin issues the two separately. */
    awadaKey: z.string().optional(),
    /** Lane to subscribe to. Maps to awada:events:inbound:<lane>. Optional — when omitted, the server
     *  defaults to the "User" lane. */
    lane: z.string().optional(),
    /** DM policy: open (anyone), pairing (requires approval), or allowlist */
    dmPolicy: z.enum(["open", "pairing", "allowlist"]).optional(),
    /** Allowed user_id_external values for allowlist/pairing */
    allowFrom: z.array(z.string()).optional(),
    /**
     * Max characters per outbound message. When set, long replies are automatically
     * split into multiple messages each no longer than this value.
     * Useful for platforms like WeChat that enforce per-message length limits.
     */
    perMsgMaxLen: z.number().int().positive().optional(),
  })
  .strict();

/** Per-account override (currently unused — awada uses a single default account) */
export const AwadaAccountConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z.string().optional(),
  })
  .strict();

```

### Core Architecture Module: `awada/src/customerdb.ts`
```
/**
 * CustomerDB feature — injects customer context into LLM prompts and handles
 * silent sales commands (payment_success, club_join) without invoking an LLM.
 *
 * Originally a standalone plugin (customerdb-hook); merged into awada-extension
 * so that a single plugin entry in openclaw.json covers both channel and CRM.
 *
 * Activated when `pluginConfig.customerdb.agentId` is set in openclaw.json:
 *
 *   "plugins": [{
 *     "path": "awada",
 *     "config": {
 *       "customerdb": {
 *         "agentId": "sales-cs",
 *         "workspaceDir": "/home/.../.openclaw/workspace-sales-cs"
 *       }
 *     }
 *   }]
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

// ── Config ───────────────────────────────────────────────────────────────────

export interface CustomerDbConfig {
  /** Agent ID to attach context to. Default: "sales-cs" */
  agentId?: string;
  /** Workspace directory containing db/customer.db. Default: ~/.openclaw/workspace-sales-cs */
  workspaceDir?: string;
}

// ── Types ────────────────────────────────────────────────────────────────────

type CustomerRow = {
  peer: string;
  business_status: string;
  purpose: string;
  prompt_source: string;
  club_in: string;
  created_at: string;
  updated_at: string;
};

type SentFollowUp = {
  id: number;
  sent_text: string;
};

// ── Schema DDL ───────────────────────────────────────────────────────────────

const CS_RECORD_DDL = `
CREATE TABLE IF NOT EXISTS cs_record (
  peer            TEXT PRIMARY KEY,
  business_status TEXT DEFAULT 'free',
  purpose         TEXT DEFAULT '',
  prompt_source   TEXT DEFAULT '',
  club_in         TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at      TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
);
`.trim();

const FOLLOW_UP_DDL = `
CREATE TABLE IF NOT EXISTS follow_up (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  peer              TEXT NOT NULL,
  user_id_external  TEXT NOT NULL,
  follow_up_at      TEXT NOT NULL,
  reason            TEXT NOT NULL,
  context_summary   TEXT,
  status            TEXT DEFAULT 'pending',
  sent_text         TEXT,
  retry_count       INTEGER DEFAULT 0,
  created_at        TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  completed_at      TEXT,
  FOREIGN KEY (peer) REFERENCES cs_record(peer)
);
`.trim();

// ── Peer normalization ────────────────────────────────────────────────────────

/**
 * Normalize a raw peer string to a canonical, DB-safe form.
 *
 * Rules (applied in order):
 *   1. trim leading/trailing whitespace
 *   2. lowercase  (openclaw already lowercases peerId when building sessionKey,
 *                  so this makes the command path consistent with the hook path)
 *   3. strip ASCII control characters U+0000–U+001F and U+007F
 *      (\t \n \r \0 etc. — \t breaks tab-separated sqlite3 output parsing;
 *       \n/\r break line-based output; \0 is a null-byte hazard in SQLite C layer)
 */
function normalizePeer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\x00-\x1f\x7f]/g, "");
}

function resolvePeerFromSessionKey(sessionKey?: string): string | null {
  if (!sessionKey) return null;
  const preferred = sessionKey.match(/^agent:[^:]+:awada:direct:(.+)$/);
  if (preferred?.[1]) return normalizePeer(preferred[1]);
  const tolerant = sessionKey.match(/^agent:.*:awada:direct:(.+)$/);
  if (tolerant?.[1]) return normalizePeer(tolerant[1]);
  return null;
}

function resolvePeerForCommand(ctx: {
  channel: string;
  senderId?: string;
}): string | null {
  if (ctx.channel !== "awada") return null;
  if (!ctx.senderId) return null;
  return normalizePeer(ctx.senderId);
}

// ── SQLite helpers ────────────────────────────────────────────────────────────

function sqliteExec(dbFile: string, args: string[], options?: { input?: string }) {
  const res = spawnSync("sqlite3", [dbFile, ...args], {
    encoding: "utf8",
    input: options?.input,
  });
  if (res.status !== 0) {
    throw new Error(res.stderr || res.stdout || "sqlite3 command failed");
  }
  return (res.stdout || "").trim();
}

function sqlQuote(input: string): string {
  return `'${input.replace(/'/g, "''")}'`;
}

// ── DB initialization ─────────────────────────────────────────────────────────

function ensureDatabaseReady(params: { dbFile: string; schemaFile: string }) {
  const { dbFile, schemaFile } = params;

  const tableName = sqliteExec(dbFile, [
    "SELECT name FROM sqlite_master WHERE type='table' AND name='cs_record';",
  ]);
  if (tableName !== "cs_record") {
    try {
      const schemaSql = readFileSync(schemaFile, "utf8");
      sqliteExec(dbFile, [], { input: schemaSql });
    } catch {
      sqliteExec(dbFile, [], { input: CS_RECORD_DDL });
    }
  }

  // Idempotent: always ensure follow_up table
  sqliteExec(dbFile, [], { input: FOLLOW_UP_DDL });

  // Migration: rename awada_customer_id → user_id_external if legacy column exists
  try {
    const cols = sqliteExec(dbFile, ["PRAGMA table_info(follow_up);"]);
    if (cols.includes("awada_customer_id")) {
      sqliteExec(dbFile, [
        "ALTER TABLE follow_up RENAME COLUMN awada_customer_id TO user_id_external;",
      ]);
    }
  } catch {
    // SQLite < 3.25 doesn't support RENAME COLUMN — skip migration
  }
}

// ── cs_record operations ──────────────────────────────────────────────────────

function ensurePeerRow(dbFile: string, peer: string) {
  sqliteExec(dbFile, [
    `INSERT INTO cs_record (peer, business_status, purpose, prompt_source) VALUES (${sqlQuote(peer)}, 'free', '', '') ON CONFLICT(peer) DO UPDATE SET updated_at = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime');`,
  ]);
}

function updateForPaymentSuccess(dbFile: string, peer: string) {
  sqliteExec(dbFile, [
    `UPDATE cs_record SET business_status='subs', club_in=strftime('%Y-%m-%d', 'now', 'localtime') WHERE peer=${sqlQuote(peer)};`,
  ]);
}

function updateForClubJoin(dbFile: string, peer: string) {
  sqliteExec(dbFile, [
    `UPDATE cs_record SET business_status='club', club_in=strftime('%Y-%m-%d', 'now', 'localtime') WHERE peer=${sqlQuote(peer)};`,
  ]);
}

function selectCustomerRow(dbFile: string, peer: string): CustomerRow | null {
  const out = sqliteExec(dbFile, [
    "-separator",
    "\t",
    `SELECT peer, business_status, purpose, prompt_source, club_in, created_at, updated_at FROM cs_record WHERE peer=${sqlQuote(peer)} LIMIT 1;`,
  ]);
  if (!out) return null;
  const [p, business_status, purpose, prompt_source, club_in, created_at, updated_at] =
    out.split("\t");
  return {
    peer: p ?? peer,
    business_status: business_status ?? "free",
    purpose: purpose ?? "",
    prompt_source: prompt_source ?? "",
    club_in: club_in ?? "",
    created_at: created_at ?? "",
    updated_at: updated_at ?? "",
  };
}

// ── follow_up operations ──────────────────────────────────────────────────────

function selectSentOnceFollowUp(dbFile: string, peer: string): SentFollowUp | null {
  const out = sqliteExec(dbFile, [
    "-separator",
    "\t",
    `SELECT id, sent_text FROM follow_up WHERE peer=${sqlQuote(peer)} AND status='sent_once' ORDER BY created_at DESC LIMIT 1;`,
  ]);
  if (!out) return null;
  const [id, sent_text] = out.split("\t");
  if (!id || !sent_text) return null;
  return { id: parseInt(id, 10), sent_text };
}

function completeSentOnceFollowUps(dbFile: string, peer: string): void {
  // 客户主动回复 → 仅完成已实际发送过的跟进（sent_once）。
  // pending 任务尚未发送，客户只是在继续当前对话，不能被这里误杀；
  // pending 只应由 heartbeat 发送、cancel-pending 或 expire 推进。
  sqliteExec(dbFile, [
    `UPDATE follow_up SET status='completed', completed_at=strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime') WHERE peer=${sqlQuote(peer)} AND status='sent_once';`,
  ]);
}

// ── Prompt context builders ───────────────────────────────────────────────────

const STAT
```

### Core Architecture Module: `awada/src/message-actions.ts`
```
import { jsonResult, readStringParam } from "openclaw/plugin-sdk/agent-runtime";
import type { ChannelMessageActionAdapter } from "openclaw/plugin-sdk/channel-contract";
import { resolveAwadaAccount } from "./accounts.js";
import { buildMediaContentFromName, decodeAwadaTo, sendMediaToAwada } from "./send.js";
import { getCachedOutboundTarget } from "./target-cache.js";

export const awadaMessageActions: ChannelMessageActionAdapter = {
  describeMessageTool: ({ cfg }) => {
    const account = resolveAwadaAccount({ cfg });
    if (!account.configured) return null;
    return { actions: ["sendAttachment"] };
  },

  supportsAction: ({ action }) => action === "sendAttachment",

  handleAction: async (ctx) => {
    if (ctx.action !== "sendAttachment") {
      throw new Error(`Unsupported awada action: ${ctx.action}`);
    }

    const fileName = readStringParam(ctx.params, "file_name", {
      required: true,
      label: "file_name (pre-stored WeChat cloud file)",
    });

    const account = resolveAwadaAccount({ cfg: ctx.cfg, accountId: ctx.accountId });
    if (!account.relayBaseUrl || !account.awadaKey) {
      throw new Error("[awada] not configured (need awadaKey)");
    }

    // Prefer the resolved target from params.to (set by core's target resolver),
    // fall back to the in-memory cache populated on inbound messages.
    const toRaw = readStringParam(ctx.params, "to");
    const target = (toRaw ? decodeAwadaTo(toRaw) : null) ?? getCachedOutboundTarget(ctx.requesterSenderId ?? "");
    if (!target) {
      throw new Error(
        "[awada] Cannot resolve outbound target. " +
          "The customer must have sent a message before you can send attachments.",
      );
    }

    const media = buildMediaContentFromName({ file_name: fileName });
    const streamId = await sendMediaToAwada({
      relayBaseUrl: account.relayBaseUrl,
      awadaKey: account.awadaKey,
      lane: account.lane,
      target,
      media,
    });

    return jsonResult({ ok: true, type: media.type, file_name: fileName, streamId });
  },
};

```

### Core Architecture Module: `awada/src/message-handler.ts`
```
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";
import type { ClawdbotConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/channel-plugin-common";
import { resolveAwadaAccount } from "./accounts.js";
import { fetchAudioBuffer, transcribeAudio } from "./audio-transcribe.js";
import type { AudioObject, FileObject, ImageObject, InboundEvent } from "./redis-types.js";
import { createAwadaReplyDispatcher } from "./reply-dispatcher.js";
import { cacheOutboundTarget } from "./target-cache.js";
import { getAwadaRuntime } from "./runtime.js";
import { buildOutboundTarget, encodeAwadaTo, sendTextToAwada } from "./send.js";

type AwadaDebounceEntry = {
  cfg: ClawdbotConfig;
  event: InboundEvent;
  runtime: RuntimeEnv | undefined;
  accountId: string;
};

// One debouncer per accountId, created lazily on first message.
type AnyDebouncer = { enqueue: (item: AwadaDebounceEntry) => Promise<void> };
const _debouncersByAccount = new Map<string, AnyDebouncer>();

function getOrCreateDebouncer(accountId: string, cfg: ClawdbotConfig): AnyDebouncer {
  const existing = _debouncersByAccount.get(accountId);
  if (existing) return existing;

  const core = getAwadaRuntime();
  const debounceMs = core.channel.debounce.resolveInboundDebounceMs({ cfg, channel: "awada" });

  const debouncer = core.channel.debounce.createInboundDebouncer<AwadaDebounceEntry>({
    debounceMs,
    buildKey: (entry) => `awada:${entry.accountId}:${entry.event.meta.user_id_external}`,
    shouldDebounce: (entry) => {
      const { payload } = entry.event;
      const hasNonText = payload.some(
        (item) => item.type === "image" || item.type === "file" || item.type === "audio",
      );
      if (hasNonText) return false;
      return Boolean(extractTextFromPayload(payload));
    },
    onFlush: async (entries) => {
      const last = entries.at(-1);
      if (!last) return;
      if (entries.length === 1) {
        await _dispatchAwadaEvent(last);
        return;
      }
      const combinedText = entries
        .map((e) => extractTextFromPayload(e.event.payload))
        .filter(Boolean)
        .join("\n");
      const mergedEvent: InboundEvent = {
        ...last.event,
        payload: [{ type: "text", text: combinedText }],
      };
      await _dispatchAwadaEvent({ ...last, event: mergedEvent });
    },
    onError: (err, entries) => {
      const id = entries[0]?.accountId ?? "default";
      const logErr = entries[0]?.runtime?.error ?? console.error;
      logErr(`awada[${id}]: inbound debounce flush failed: ${String(err)}`);
    },
  });

  _debouncersByAccount.set(accountId, debouncer);
  return debouncer;
}

/**
 * Extract text from a payload array. Returns the concatenated text of all text objects.
 */
function extractTextFromPayload(payload: InboundEvent["payload"]): string {
  return payload
    .filter((item) => item.type === "text")
    .map((item) => (item as { type: "text"; text: string }).text)
    .join("\n")
    .trim();
}

/**
 * Sanitize a peer ID for use in session keys (stored in DB).
 * Only strips ASCII control characters (U+0000–U+001F, U+007F) that cannot be
 * safely written to SQLite TEXT columns or would break tab/line-based sqlite3
 * CLI output parsing (\t \n \r \0 etc.). All Unicode letters, numbers, and
 * punctuation — including full-width parens （） in names like 先格物（鸿飞） —
 * are preserved verbatim, since SQLite stores them without issue.
 * Does NOT modify the original user_id_external — only call this for peer/session routing.
 */
function sanitizePeerId(id: string): string {
  if (!id || !id.trim()) {
    return "_anonymous_";
  }
  return id.replace(/[\x00-\x1f\x7f]/g, "");
}

/**
 * Guess a MIME type from a URL or file name.
 */
function guessMimeType(urlOrName: string): string {
  const lower = urlOrName.toLowerCase();
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".csv")) return "text/csv";
  return "application/octet-stream";
}

/**
 * Guess image extension from base64 magic bytes.
 */
function guessImageExt(base64: string): string {
  if (base64.startsWith("/9j/")) return ".jpg";
  if (base64.startsWith("iVBOR")) return ".png";
  if (base64.startsWith("R0lGO")) return ".gif";
  if (base64.startsWith("UklGR")) return ".webp";
  return ".png";
}

/**
 * Resolve the openclaw-approved temp directory for media files.
 * Agent sandbox only allows paths under /tmp/openclaw/ (not bare /tmp/).
 */
const OPENCLAW_TMP_DIR = "/tmp/openclaw";
function ensureMediaTmpDir(): string {
  mkdirSync(OPENCLAW_TMP_DIR, { recursive: true, mode: 0o700 });
  return OPENCLAW_TMP_DIR;
}

/**
 * Download a URL to a temp file. Returns the local path.
 */
async function downloadToTemp(url: string, ext: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filePath = join(ensureMediaTmpDir(), `awada-${randomUUID()}${ext}`);
  await writeFile(filePath, buffer);
  return filePath;
}

/**
 * Save a base64 string to a temp file. Returns the local path.
 */
async function saveBase64ToTemp(data: string, ext: string): Promise<string> {
  const buffer = Buffer.from(data, "base64");
  const filePath = join(ensureMediaTmpDir(), `awada-${randomUUID()}${ext}`);
  await writeFile(filePath, buffer);
  return filePath;
}

// ---- Audio failure reply ----
const AUDIO_FAIL_MESSAGE = "对不起，我暂时不方便听语音，您能打字给我吗？";

/**
 * Process image payload items: download/decode to local temp files.
 * Returns arrays of (path, mimeType) for successfully processed images.
 */
async function processImages(
  images: ImageObject[],
  log: (...args: unknown[]) => void,
): Promise<{ paths: string[]; types: string[] }> {
  const paths: string[] = [];
  const types: string[] = [];
  for (const img of images) {
    try {
      if (img.file_url) {
        const url = img.file_url;
        const ext = url.includes(".") ? `.${url.split(".").pop()!.split("?")[0]}` : ".png";
        const localPath = await downloadToTemp(url, ext);
        paths.push(localPath);
        types.push(guessMimeType(url));
      } else if (img.base64) {
        const ext = guessImageExt(img.base64);
        const localPath = await saveBase64ToTemp(img.base64, ext);
        paths.push(localPath);
        types.push(ext === ".jpg" ? "image/jpeg" : `image/${ext.slice(1)}`);
      }
    } catch (err) {
      log(`awada: failed to process image: ${String(err)}`);
    }
  }
  return { paths, types };
}

/**
 * Process file payload items: download to local temp files.
 */
async function processFiles(
  files: FileObject[],
  log: (...args: unknown[]) => void,
): Promise<{ paths: string[]; types: string[] }> {
  const paths: string[] = [];
  const types: string[] = [];
  for (const file of files) {
    try {
      if (file.file_url) {
        const name = file.file_name ?? file.file_url;
        const ext = name.includes(".") ? `.${name.split(".").pop()!.split("?")[0]}` : "";
        const localPath = await downloadToTemp(file.file_url, ext);
        paths.push(localPath);
        types.push(guessMimeType(name));
      }
    } catch (err) {
      log(`awada: failed to process file: ${String(err)}`);
    }
  }
  return { paths, types };
}

/**
 * Core dispatch logic for a single (possibly merged) awada event.
 */
async function _dispatchAwadaEvent(entry: AwadaDebounceEntry): Promise<void> {
  c
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #395** (2026-01-30): **[Bug]: utils里面没有extract_xml_data函数**
  *Symptoms*: ### wiseflow version  当前master  ### Expected Behavior  utils里面添加函数  ### Current Behavior  core/wis/extraction_strategy.py文件中第10行从utils导入了extract_xml_data函数，但是utils.py中没有extract_xml_data函数，建议将core/wis/extractor.py中的extract_xml_data函数移动到utils.py文件中  ### Is this reproducible?  Yes  ### Inputs Causing the Bug  ```bash  ```  ### OS  win  ### Python version  3.12  ### Error logs & Screenshots (if applicable)  <img width="2152" height="1267" alt="Image" src="https://github.com/user-attachments/assets/d9638cf7-0299-468e-94cc-b6b32920b02f" />
  **Post-Mortem & Fix Analysis**:
  > fixed

- **Issue #323** (2025-04-07): **[Bug]: 通过podman部署后一段时间后，pb令牌失效后，错误日志剧增问题**
  *Symptoms*: ### wiseflow version  V3.9-patch3  ### Expected Behavior  我通过podman来部署wiseflow，产生两个容器core和pb，我通过pb web来配置采集设置，之后开始采集信息（我之前就部署过之前的版本，发现是可以运行和采集）  ### Current Behavior  我通过cursor辅助利用podman来部署后，添加了web和focus并激活了，在设置per_hour == 1后就没在关注了  ### Is this reproducible?  Yes  ### Inputs Causing the Bug  ```bash  ```  ### OS  宿主主机是ubuntu 24 通过podman 部署  ### Python version  3.12  ### Error logs & Screenshots (if applicable)  部署一天之后，我在使用其他应用的时候，关注到宿主主机存储使用已经从20%飙升90%，观察容器运行情况，发现core pb两个容器的cpu使用率奇高，借助claude-3.7-sonnet排查后，发现这一天的时间内剧增的是wiseflow错误日志，以下附上部分3.7-sonnet排查结论以供参考： wiseflow项目（59GB）占用分析： pb/pb_data目录：39GB core/work_dir目录：20GB  关于Wiseflow日志异常和数据库问题的分析 1. 日志产生过多的原因 我们发现了几个关键问题导致了日志文件异常增长： 权限错误循环： 从日志内容看，系统不断尝试请求 focus_points 数据但遇到 "Only superusers can perform this action" 权限错误，这个请求以极高频率不断重复，产生了大量错误日志。 重复请求模式： 日志文件中显示系统每小时（3600秒）定时执行一次任务，但同时会有很多API请求不断发送，特别是对 /api/collections/focus_points/records 的请求。 容器CPU占用高： 您观察到wiseflow相关容器CPU使用率极高，这表明程序可能陷入了某种循环或死循环状态。 2. SQLite数据库内容分析 数据库规模： auxiliary.db 大小达到39GB，主要包含一个名为 _logs 的表。 记录数量： 该表包含超过5240万条记录（52,423,256条）。 日志级别分布： 级别0（信息日志）: 283条 级别4（可能是警告）: 4条 级别8（错误日志）: 52,493,322条 - 几乎所有记录都是错误日志！ 日志内容： 大多数是针对 /api/collections/focus_points/records 的API请求，伴随着权限错误。 3. 根本原因推测 从收集到的信息推断，Wiseflow服务存在以下问题： 权限配置错误： Core容器尝试以非管理员身份访问需要超级用户权限的数据，导致大量403错误。 错误处理机制不当： 程序没有正确处理API请求失败的情况，而是持续重试，形成死循环。 日志记录过度： 系统将每个API请求（包括失败的）都记录到数据库中，而没有设置适当的日志轮转或限制机制。 数据库性能瓶颈： 随着日志记录的快速增长，数据库性能下降，导致访问延迟增加，进一步加剧了问题。  Wiseflow权限连接问题分析 问题根源 经过详细分析，我确定了导致系统产生大量日志和存储消耗的核心问题： 认证令牌过期问题：
  **Post-Mortem & Fix Analysis**:
  > @helloCplusplus0 thanks for the feedback! 之前也有很多人提过这个问题，and I believe we found one of the root cause!  for fast fix, we should make the change in core/util/pb_api.py  line 44 as follows: raise e
  > 我也遇到这个问题，日志跳得很快，依稀看到什么403错误
  > 嗯，可以试试看  branch 4.x 提供了快速的修复方案

- **Issue #286** (2025-03-26): **Logs for container: [/wiseflow-core-1] KeyError: 'tool_calls'**
  *Symptoms*: Logs for container: [/wiseflow-core-1] (http://XXXX:9000/#/containers/92cc97f01cb95cbfc569ee2db263025679daf82d8ed9572cd9fd2a8c9d37fd17/)  Traceback (most recent call last):   File "/app/run_task.py", line 36, in <module>     asyncio.run(schedule_task())   File "/usr/lib/python3.10/asyncio/runners.py", line 44, in run     return loop.run_until_complete(main)   File "/usr/lib/python3.10/asyncio/base_events.py", line 649, in run_until_complete     return future.result()   File "/app/run_task.py", line 32, in schedule_task     await asyncio.gather(*jobs)   File "/app/general_process.py", line 88, in main_process     search_intent, search_content = await run_v4_async(query, _logger=wiseflow_logger)   File "/app/utils/zhipu_search.py", line 39, in run_v4_async     result = result['choices'][0]['message']['tool_calls'] KeyError: 'tool_calls'
  **Post-Mortem & Fix Analysis**:
  > 没注册 zhipu 服务api 把
  > 有注册服务API ``` {         "request_id": "{% mock 'uuid' %}",         "tool": "web-search-pro",         "stream": false,         "messages": [         {             "role": "user",              "content": "两会"         }     ]     } ```  **"content": "两会"会出现以上问题，返回值为：** ``` {     "choices": [         {             "finish_reason": "stop",             "index": 0,             "message": {                 "content": "两会是对自1959年以来历年召开的中华人民共和国全国人民代表大会和中国人民政治协商会议的统称。由于两场会议会期基本重合，而且对于国家运作的重要程度都非常的高，故简称做“两会”。从省级地方到中央，各地的政协及人大的全体会议的会期全部基本重合，所以两会的名称可以同时适用于全国及各省（市、自治区）。",                 "role": "assistant"             }         }     ],     "created": 1741156479,     "id": "2025030514343877440121ff90434d",     "model": "web-search-pro",     "request_id": "2025030514343877440121ff90434d",     "usage": {         "completion_tokens": 0,         "prompt_tokens": 0,         "total_tokens": 0     } } ```  **当 "content": "小米"，正常**  ``` {     "choices": [         {             "finish_reason": "stop",       
  > thanks for the feedback It seems that regardless of keywords, if sensitive words are triggered, the returned result format will be inconsistent. I will fix this problem. Thanks again for pointing it out.

- **Issue #214** (2025-02-05): **运行即报错，提示 KeyError: 'media'**
  *Symptoms*: 应用版本 : 0.3.8 使用的API：Deepseek-chat 运行平台： windows11 with miniconda Env配置：  > LLM_API_KEY="sk-****" LLM_API_BASE="https://***" ZHIPU_API_KEY="******" #for the search tool PRIMARY_MODEL="deepseek-chat" #SECONDARY_MODEL="deepseek-reasoner" #use a secondary model to excute the filtering task for the cost saving #if not set, will use the primary model to excute the filtering task VL_MODEL="deepseek-chat" PB_API_AUTH="******|*****" ##your pb superuser account and password ##belowing is optional, go as you need #VERBOSE="true" ##for detail log info. If not need, remove this item. PROJECT_DIR="work_dir" #PB_API_BASE="" ##only use if your pb not run on 127.0.0.1:8090 #LLM_CONCURRENT_NUMBER=8 ##for concurrent llm requests, make sure your llm provider supports it(leave default is 1)   运行之后报错：  > (wiseflow) PS D:\wiseflow\core> python .\windows_run.py Starting PocketBase... 2025-01-24 23:06:37.194 | DEBUG    | utils.pb_api:__init__:12 - initializing pocketbase client: http://127.0.0.1:8090 2025-01-24 23:06:37.445 | INFO     | utils.pb_api:__init__:22 - pocketbase ready authenticated as admin - waruii@msn.com 2025-01-24 23:06:37.447 | INFO     | __main__:schedule_task:19 - task execute loop 1 2025-01-24 23:06:37.452 | DEBUG    | general_process:main_process:54 - new task initializing... 2025-01-24 23:06:37.452 | DEBUG    | general_process:main_process:58 - focus_id: d5v92136876jl34, focus_point: 猫咪饲养 的窍门, explanation: 仅限健康和行为相关的内容, search_engine: True 2025-01-24 23:06:38.300 | INFO     | ge
  **Post-Mortem & Fix Analysis**:
  > it's truely a bug, no every result from zhipu search tool has the 'media' key. I'll repair it tonight
  > Done  请拉取最新的代码

- **Issue #204** (2025-02-05): **wxbot -微信被登出**
  *Symptoms*: 在运行wxbot exe的时候，一直报错。最后尝试先启动微信，然后将微信的PID指定给wxbot，这样能开启listen，但是listen port是8080.   然后将_init_里端口改为了8080.  执行wxbot能获取到公众号消息，但是有一个报错  ![Image](https://github.com/user-attachments/assets/647bc12f-486b-471c-ae5a-25d14472b901) 执行三次之后，微信被登出  把这个code问题修复之后，微信依然被登出，看起来微信对这种访问方式是block的？  还是哪里有问题  
  **Post-Mortem & Fix Analysis**:
  > 看起来是个 bug，我将修复下
  > 我已经推送了修复代码，可以更新下再试。  如果还发生微信退出的情况，请贴出详细的 log，以及你的操作系统、环境信息、被登出时的提示  谢谢！
  > 已经没问题了，多谢~ 好奇之前是什么问题呢？

- **Issue #151** (2025-01-18): **按照首页视频配置pocketbase后接着python tasks.py  运行了 1个小时  ，没有任何数据有存储到了pocketbase的infos里面。**
  *Symptoms*: 大佬你好，就是如何才会有数据进入到 pocketbase的infos里面。我的操作步骤完全按照 首页视频配置的。   ![image](https://github.com/user-attachments/assets/1761c345-b18b-40e4-a643-86b0949bba17) ![image](https://github.com/user-attachments/assets/39da4d76-fa5c-4fdf-9831-7b049c109fd5) ![image](https://github.com/user-attachments/assets/dcc15369-ef47-456e-88e3-6653ab11aae9) ![image](https://github.com/user-attachments/assets/1a3adb89-89ed-4040-903d-691fd328a8d3) ![image](https://github.com/user-attachments/assets/22f36074-86d9-4ff1-9362-ca7506d1b9d9) 
  **Post-Mortem & Fix Analysis**:
  > 看日志，好像是一直卡在这个地方  result的值都是dict的，没出现过list ![image](https://github.com/user-attachments/assets/9bb9806f-527d-4dd4-b2ee-3c7c14dfef91) 
  > 就每次都是 failed to parse from llm output ![image](https://github.com/user-attachments/assets/c2743c24-672f-41c3-a61f-61951418fecc) 
  > 主模型用的什么？默认的 qwen2.5-7b 吗？

- **Issue #73** (2024-09-02): **general_crawler.py 第208行报错 KeyError: 'publish_time'**
  *Symptoms*: [core/scrapers/general_crawler.py](https://github.com/TeamWiseFlow/wiseflow/blob/master/core/scrapers/general_crawler.py)第208行  ```python date_str = extract_and_convert_dates(result['publish_time']) ```  报错 KeyError: 'publish_time'
  **Post-Mortem & Fix Analysis**:
  > ``` 2024-08-21 11:29:40.628 | INFO     | scrapers.general_crawler:general_crawler:152 - gne extract not good: {'title': '', 'author': '', 'publish_time': '', 'content': '%PDF-... 2024-08-21 11:29:40.631 | INFO     | scrapers.general_crawler:general_crawler:165 - https://....pdf content too long for llm parsing core-1  | Traceback (most recent call last): core-1  |   File "/app/tasks.py", line 32, in <module> core-1  |     asyncio.run(main()) core-1  |   File "/usr/local/lib/python3.10/asyncio/runners.py", line 44, in run core-1  |     return loop.run_until_complete(main) core-1  |   File "/usr/local/lib/python3.10/asyncio/base_events.py", line 649, in run_until_complete core-1  |     return future.result() core-1  |   File "/app/tasks.py", line 30, in main core-1  |     await schedule_pipeline(interval_seconds) core-1  |   File "/app/tasks.py", line 20, in schedule_pipeline core-1  |     await asyncio.gather(*[process_site(site, counter) for site in sites]) core-1  |   Fi
  > 另外, 出现错误后, 程序不能自动恢复运行.
  > #88  done

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

### Incident Patch 1: `6cd041ee` (2026-09-20)
**Commit Message**: fix: stabilize Douyin note links and prepare v5.7.2

Fix Bailian TTS subtitle text and narration ASR integration. Make note link recovery atomic with bounded search retries, centralize regression tests under test/, and update release notes and setup guidance.

**File**: `.gitignore` (modified, +0/-1)
```diff
@@ -24,7 +24,6 @@ __pycache__/
 patchright/
 patchright-v*/
 openclaw/
-tests/
 
 # addon crews copied into crews/ at install time — not tracked
 .pnpm-store/
```

**File**: `AGENTS.md` (modified, +6/-0)
```diff
@@ -1,3 +1,9 @@
+## 测试文件布局
+
+- 回归测试与测试夹具统一放在仓根 `test/`，按组件分目录；不要放在正式脚本或 skill 目录中。
+- 移动测试时同步更新导入路径、测试入口与运行说明；确认已无用途的测试可以删除。
+- 用于修改上游测试的补丁材料仍放在对应 `patches/` 补丁包内。
+
 ## Docker 部署规范
 
 - 用户态镜像、Compose service 和持久卷统一使用 **xiaobei** 命名；不得新增 `wiseflow-*` 镜像或卷名。
```

**File**: `CHANGELOG.md` (modified, +34/-0)
```diff
@@ -1,3 +1,37 @@
+# v5.7.2 (2026-09-20)
+
+### 视频制作流程与交接
+
+- **统一 Stage 0→15 制作流程**：所有视频制作均从 Brief 进入通用阶段链，保留 GATE A 剧本验收、GATE B 素材验收及成片技术自检。移除 `intent-router`；`story-develop` 仅用于 Brief 缺失或不清晰时的需求整理。
+- **类型 workflow 指导剧本生产与自检**：`reversal-ad`、`narration-video`、`collage-broll` 分别定义 Brief→script 的写作规则、检查项和制作约定；`script-write` / `script-self-eval` 按 workflow 生成对应模板。未指定类型时走通用分场剧本。
+- **明确口播与旁白分工**：口播稿由小贝提供或向用户取得，content-producer 原样落稿、不代写；真人录音走时间戳与画面排布；制作解说的旁白由 content-producer 编写并提交 GATE A。DNA 指导选题与 Brief，不延伸接管分镜制作。
+- **拼贴 B-roll 流程对齐**：按隐喻清单生成静帧并交给 `collage-broll render`；被裁剪的分镜、素材规划、逐镜渲染和拼接阶段加入 workflow 守卫，避免误走通用分镜链。
+- **改片与交付约定补齐**：修改单明确问题位置、预期效果与保留项；按受影响片段定向重做，保留上一版并记录修改。AIGC 转场补充选帧、景别、风格与帧率衔接要求，素材清单增加规格说明。
+
+### AIGC 供应商与百炼 Agent Plan
+
+- **百炼 Agent Plan 统一接入**：图像生成、TTS、ASR、声画视频生成支持通过 `AWK_API_KEY` 访问 `token-plan.cn-beijing.maas.aliyuncs.com`。默认百炼配置下，一个账号和 Key 即可覆盖文本、图像、语音与视频能力；同时保留业务空间 `WORKSPACE_ID` + `MODELSTUDIO_API_KEY` / `DASHSCOPE_API_KEY` 路线。
+- **图像生成收敛到百炼**：业务空间使用 `qwen-image-3.0-pro` → `qwen-image-3.0` → `qwen-image-2.0-pro-2026-06-22` 候选链；Agent Plan 使用 `wan2.7-image-pro` → `wan2.7-image`。支持文生图、参考图编辑与多图融合，封面及制作工具同步接入。
+- **TTS 增加百炼后端**：支持 `qwen-audio-3.0-tts-plus`，业务空间可回退 `qwen-audio-3.0-tts-flash`；保留火山豆包语音合成。支持普通音频下载、SSE 流式音频与字级时间戳，统一语速、响度、格式和音色处理，并自动执行 ASR 自检。
+- **ASR 统一路由**：按火山 → 百炼业务空间 → 百炼 Agent Plan 尝试已配置后端，失败时回退并汇总错误；百炼使用 `qwen-audio-3.0-asr-flash`，统一输出全文、句段与秒级词时间戳。视频转写、口播剪辑及旁白对齐共用该入口。
+- **视频生成支持 Agent Plan**：百炼 t2v / i2v / r2v 使用 `happyhorse-1.1` → `happyhorse-1.0` → `wan2.7` 对应模式候选链，保留火山 Seedance 与 MiniMax H3。仅配置百炼 `AWK_API_KEY` 时可直接生成，无需额外视频 Key；已有显式视频供应商凭据时仍按配置优先级选择。
+- **Agent Plan 真实调用验证与修复**：TTS 普通/流式、公共 ASR、文生图、三种视频模式及旁白对齐入口均完成实测；视频下载、音视频轨与完整解码通过。修复百炼流式 sentence-end 缺少句级文本时字幕为空的问题，以及旁白对齐的公共 ASR 导入路径错误、百炼结果被误标为火山来源的问题。i2v 实测按首帧比例输出，成片尺寸需检查实际媒体，不能仅依赖请求的 `ratio`。
+
+### 抖音图文音乐发布与作品跟踪
+
+- **新增抖音图文音乐发布**：`douyin-note-publish` 支持按序上传多图、填写标题与描述话题、读取上传后的实际推荐音乐并选曲；发布前复核配乐，发布后回收 `/note/<id>` 链接。仅在明确选择原声时跳过配乐流程。
+- **图文与视频分开路由**：视频入口改为 `douyin-video-publish`，与图文共享登录态和发布任务锁。修复输入框不兼容的选择器调用；发布结果待核实时只补取链接，避免自动重复发布。
+- **图文发布后取链修复**：兼容管理页将标题与正文合并展示的 DOM，在唯一候选的图文编辑页核验完整标题后返回链接。候选判定与点击合并为一次浏览器操作，修复两次检查间列表刷新导致直接退出的竞态；每轮搜索后等待 5 秒、轮询候选最多 30 秒，超时后间隔 3 秒重新搜索，最多 4 轮。保留多候选停止与禁止自动重发，已通过列表消失后恢复的浏览器回归，并用两条已发布作品复测取链。
+- **创作者侧指标与深度数据**：抖音取数接入创作者 `item/list`，优先采用创作者侧播放量并保留有效零值；兼容图文链接。`deep_metrics` 保存最新 JSON 及采集时间、来源，不累积历史快照。心跳按平台启用状态巡检，抖音聚焦最近 30 条作品，取数失败显式报告。
+
+### 平台兼容性修复
+
+- 视频号短标题统一无标点、以空格分隔；发布前准备 3:4 / 4:3 封面变体，增强封面编辑操作及 DNA 入库核验，视频描述字数改为建议值并以平台输入框为准。
+- 小红书软风控增加有界冷却与单次重试，安全限制不再直接判定为登录失效；发布正文中的字面量 `\\n` 归一化为真实换行。
+- 视频素材抓取跟进小红书 EF 系列视频分档兼容。
+
+---
+
 # v5.7.1 (2026-09-15)
 
 ### 第三方插件 pin 升级（openclaw-weixin 2.4.8 / wecom-openclaw-cli 1.1.1）
```

**File**: `README.md` (modified, +12/-9)
```diff
@@ -5,7 +5,7 @@
 - 微信公众号文章写作、排版与推送
 - 小红书/小绿书图文创作与发布
 - 图文海报生成
-- 短视频生成与多平台分发（支持视频号、抖音、小红书）
+- 视频生成与多平台分发（支持视频号、抖音、小红书）
 - Twitter/X、微博、知乎等平台发文
 - 微信朋友圈内容发布（通过企业微信接口）
 - 爆款视频追爆分析、仿写与再创作（支持抖音、B站和小红书视频链接）
@@ -32,13 +32,15 @@ xiaobei 由Wiseflow (原AI首席情报官）作者 bigbrother666sh 开发。
 
 ---
 
-## 🚀 **v5.7.1 更新**
+## 🚀 **V5.7.1~5.7.2 更新**
 
 - 小红书、抖音、视频号 DNA系统升级到2.0架构，Let's do this like an expert！
 - content producer 升级为专家系统，现在除了AIGC大片外，还可以复刻众多短视频平台流行的“套路”，更易获得平台推荐流量：
   > 效果展示，xiaobei的视频号：https://openclaw-for-business.com/xiaobei-wxchannel.jpg
 - xiaobei 可直接指挥content producer，用户可选择将brief出具、节点验收等委托xiaobei
-- 修复一键安装脚本中，openclaw-weixin不会自动升级的问题
+- 新增抖音平台图文音乐内容发布能力，支持多图上传、选择推荐配乐与发布链接回收。
+- AIGC 端点支持阿里云百炼 Agent Plan：现在无需去多个平台开通不同账号，最简只用初始安装时的百炼账号就可获得全部能力。
+- 修复一键安装脚本openclaw-weixin不会自动升级的问题
 
 详见 [CHANGELOG.md](CHANGELOG.md)
 
@@ -48,11 +50,11 @@ xiaobei 由Wiseflow (原AI首席情报官）作者 bigbrother666sh 开发。
 
 ### 0. 准备 API Key
 
-推荐开通 [阿里云百炼「Token Plan」套餐](https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12766005..10274..)——一个套餐覆盖 DeepSeek-V4-Flash、GLM-5.2、Qwen3.6-Flash 等主流模型，**无月限额、不限购**，xiaobei 默认主力模型 DeepSeek-V4-Flash 即走此通道。开通后获得 `AWK_API_KEY`，主力模型、视觉模型、替补模型**一个 key 全覆盖**。
+推荐开通 [阿里云百炼「Token Plan」套餐](https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12766005..10274..)——一个套餐覆盖**思考与对话、图像生成、TTS 语音合成、ASR 语音识别和视频生成**全部大模型能力，无需为这些能力分别准备其他供应商账号或 Key。
 
 > 💡 **套餐选择**：前期熟悉安装可选 **Lite 版 39 元/月**；正常使用建议 **Standard 版 139 元/月**。想继续使用火山CodePlan见下方 "模型费用说明"
 
-> 🎬 **想用视频生成能力？** 开通百炼Token Plan后，会免费获得一定额度的 `happyhorse-1.1` ，只需把对应 key（`MODELSTUDIO_API_KEY`）配置到 `daemon.env`。
+> 🎬 **想用视频生成能力？** 默认可直接复用百炼 `AWK_API_KEY` 调用 `happyhorse` 系列，也可通过配置 `MODELSTUDIO_API_KEY` 和 `WORKSPACE_ID`使用百炼平台的赠送额度和“节省计划“包。
 
 > 除了阿里云的`happyhorse`系列，我们现在也支持 minimax 的H3！详见下方[视频生成模型配置](#-视频生成模型配置)
 
@@ -161,21 +163,22 @@ irm https://raw.atomgit.com/wiseflow/xiaobei/raw/master/scripts/install-atomgit.
 >
 > xiaobei 底层基于 openclaw，建议先准备好大模型 API：
 >
-> - **主力模型（强烈推荐）**：[阿里云百炼「Token Plan」套餐](https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12766005..10274..) — 一个套餐覆盖 DeepSeek-V4-Flash、GLM-5.2、Qwen3.6-Flash 等主流模型，**无月限额、不限购**。前期熟悉安装可选 Lite 版 39 元/月，正常使用建议 Standard 版 139 元/月。开通后获得 `AWK_API_KEY`，xiaobei 默认主力模型 DeepSeek-V4-Flash 即走此通道。
+> - **主力模型（强烈推荐）**：[阿里云百炼「Token Plan」套餐](https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12766005..10274..) — 一个套餐已经可以覆盖xiaobei系统所需的所有大模型（思考与对话、图像生成、TTS 语音合成、ASR 语音识别和视频生成)。
 >
 > - **仍想用火山方舟 Coding Plan 的用户**：在默认配置模板基础上参考 [openclaw-awk.json](config-templates/openclaw-awk.json)，手动替换 `provider` 和 `agents.default` 字段即可。
 
 > **🎬 视频生成模型配置**
 >
-> AI 视频生成（`aigc-video-gen`，短视频制作与素材补充都会用到）需额外开通视频生成模型，并把对应 key 配置到 `daemon.env`（任选其一，百炼优先）：
+> AI 视频生成（`aigc-video-gen`，短视频制作与素材补充都会用到）默认复用百炼 `AWK_API_KEY`，走 Agent Plan 端点。也可按需配置百炼业务空间、火山或 MiniMax：
 >
 > | 平台 | 环境变量 | 模型 |
 > |------|---------|------|
-> | 阿里云百炼（优先） | `MODELSTUDIO_API_KEY`（或 `DASHSCOPE_API_KEY`） | `happyhorse-1.1-i2v` / `happyhorse-1.1-t2v` / `happyhorse-1.1-r2v` |
+> | 阿里云百炼 Agent Plan（默认） | `AWK_API_KEY` | `happyhorse-1.1-i2v` / `happyhorse-1.1-t2v` / `happyhorse-1.1-r2v` |
+> | 阿里云百炼业务空间（可选） | `WORKSPACE_ID` + `MODELSTUDIO_API_KEY`（或 `DASHSCOPE_API_KEY`） | 同上 |
 > | 火山引擎方舟 | `AWK_GEN_KEY` | `doubao-seedance-2-0-fast-260128` / `doubao-seedance-2-0-260128` / `doubao-seedance-2-0-mini-260615` |
 > | minimax海螺 | `MINIMAX_API_KEY` | `minimax-H3` |
 >
-> 若上述都没配则自动降级为 pexels/pixabay 免费素材模式（也得注册才能获得key，只不过是免费）。注意 `AWK_GEN_KEY` 与主力模型的 `AWK_API_KEY` 是一个 key，但必须在环境变量中以不同变量名称赋值，火山视频生成只认 `AWK_GEN_KEY`。申请成功后可以让小贝喊系统内置的IT Engineer帮你完成配置。
+> 只配置百炼 `AWK_API_KEY` 时自动走 Agent Plan；若已有其他视频凭据，自动选择顺序为 MiniMax → 火山 → 百炼业务空间 → 百炼 Agent Plan。均未配置时，小贝改用 pexels/pixabay 素材模式（仍需注册获取对应的免费 Key）。`AWK_GEN_KEY` 是火山视频生成凭据，与百炼 `AWK_API_KEY` 不可混用。需要调整配置时，可以让小贝调用内置 IT Engineer 协助。
 
 > **🧠 进阶：记忆增强与 dream（可选）**
 >
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/narration-align.py` (modified, +3/-3)
```diff
@@ -10,7 +10,7 @@
     {
       "text": "全文",
       "segments": [{"start": 0.0, "end": 2.3, "text": "第一句"}, ...],
-      "source": "tts-native" | "volc.bigasr.auc_turbo"
+      "source": "tts-native" | "asr"
     }
 
 路径优先级：
@@ -33,7 +33,7 @@
 
 # 注入 main 侧 _shared 到 sys.path，复用公共 ASR 路由（与 talking-head-cut/scripts/cut_plan.py 同范式）
 # 跨 crew 引用：content-producer → main/_shared，供应商路由 火山→百炼业务空间→百炼 agent plan，凭据同池无新增配置
-sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "crews" / "main" / "skills" / "_shared"))
+sys.path.insert(0, str(Path(__file__).resolve().parents[6] / "main" / "skills" / "_shared"))
 from asr import asr  # noqa: E402
 
 
@@ -146,7 +146,7 @@ def fallback_asr(narration: Path, out_path: Path) -> None:
     out = {
         "text": result.get("text", "") or "",
         "segments": segs,
-        "source": "volc.bigasr.auc_turbo",
+        "source": "asr",
     }
     out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
 
```

---

### Incident Patch 2: `5b4e1123` (2026-09-19)
**Commit Message**: fix(douyin-note-publish): fill inputs without unsupported CLI selectors

**File**: `crews/main/skills/expert-douyin/tools/douyin-note-publish/scripts/check_fill_browser.py` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+"""Manual local-browser regression: python3 check_fill_browser.py (no account required)."""
+import importlib.util
+import json
+import subprocess
+import uuid
+from pathlib import Path
+from urllib.parse import quote
+
+path = Path(__file__).with_name('publish_douyin_note.py')
+spec = importlib.util.spec_from_file_location('note', path)
+note = importlib.util.module_from_spec(spec)
+spec.loader.exec_module(note)
+
+class LocalBrowser(note.Browser):
+    def command(self, *args, timeout=60):
+        p = subprocess.run(['camoufox-cli', '--session', session, '--json', *args],
+                           capture_output=True, text=True, timeout=timeout)
+        if p.returncode:
+            raise RuntimeError(p.stderr or p.stdout)
+        result = json.loads(p.stdout)
+        if result.get('ok') is False:
+            raise RuntimeError(str(result))
+        data = result.get('data')
+        return data['result'] if isinstance(data, dict) and 'result' in data else data
+
+session = 'note-regression-' + uuid.uuid4().hex[:10]
+b = LocalBrowser()
+html = '''<input placeholder="添加作品标题"><input placeholder="搜索作品"><div contenteditable="true"></div>
+<script>
+window.events=[]; window.state={};
+for(const e of document.querySelectorAll('input')) {
+  let tracked='';
+  Object.defineProperty(e,'value',{get(){return Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').get.call(this)},set(v){tracked=v;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(this,v)}});
+  for(const type of ['input','change']) e.addEventListener(type,()=>{
+    events.push(type); document.body.dataset.events=JSON.stringify(events); if(e.value!==tracked) {state[e.placeholder]=e.value; tracked=e.value; e.dataset.state=e.value;}
+  });
+  e.addEventListener('keydown',event=>{if(event.key==='Enter') document.body.dataset.searched=state[e.placeholder]});
+}
+</script>'''
+try:
+    b.command('open', 'data:text/html;charset=utf-8,' + quote(html))
+    title = '中文"反斜杠\\与emoji😀'
+    note.fill(b, title, '第一行\n第二行 #话题', 'none')
+    observed = b.eval('document.querySelector("input").dataset.state')
+    assert observed == title, repr(observed)
+    note.fill_input(b, 'input[placeholder*="搜索作品"]', title)
+    b.command('press', 'Enter')
+    assert b.eval('document.body.dataset.searched') == title
+    assert b.eval('JSON.parse(document.body.dataset.events)') == ['input', 'change', 'input', 'change']
+    note.fill_input(b, 'input[placeholder*="搜索作品"]', '')
+    assert b.eval('document.querySelectorAll("input")[1].dataset.state') == ''
+    for setup in [
+        'document.querySelector("input").disabled=true',
+        'document.querySelector("input").disabled=false; document.querySelector("input").readOnly=true',
+        'document.querySelector("input").readOnly=false; document.body.append(document.querySelector("input").cloneNode())',
+    ]:
+        b.eval(setup)
+        try:
+            note.fill_input(b, 'input[placeholder="添加作品标题"]', '不应写入')
+        except RuntimeError:
+            pass
+        else:
+            raise AssertionError('non-editable or ambiguous input accepted')
+    print('PASS: real camoufox CLI: title/caption, controlled input events, search Enter, escaping, clear, disabled/read-only/ambiguous guards')
+finally:
+    b.close()
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-note-publish/scripts/publish_douyin_note.py` (modified, +28/-3)
```diff
@@ -138,10 +138,35 @@ def verify_music(b, name):
     }})()''')
 
 
+def fill_input(b, selector, value):
+    # camoufox-cli fill accepts snapshot refs only, not CSS selectors.
+    result = b.eval(f'''(() => {{
+      const inputs=[...document.querySelectorAll({json.dumps(selector)})].filter(e=>{VISIBLE});
+      if(inputs.length!==1) throw new Error('输入框缺失或不唯一');
+      const e=inputs[0];
+      if(!(e instanceof HTMLInputElement) || e.disabled || e.readOnly)
+        throw new Error('输入框不可编辑');
+      e.focus();
+      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
+      setter.call(e,{json.dumps(value)});
+      e.dispatchEvent(new Event('input',{{bubbles:true}}));
+      e.dispatchEvent(new Event('change',{{bubbles:true}}));
+      return e.value==={json.dumps(value)};
+    }})()''')
+    if not result:
+        raise RuntimeError('输入框读回不一致')
+    # Read in a separate browser turn, after controlled-component updates.
+    if not b.eval(f'''(() => {{
+      const inputs=[...document.querySelectorAll({json.dumps(selector)})].filter(e=>{VISIBLE});
+      if(inputs.length!==1 || inputs[0].value!=={json.dumps(value)}) return false;
+      inputs[0].focus(); return true;
+    }})()'''):
+        raise RuntimeError('输入框更新后读回不一致')
+
+
 def fill(b, title, caption, declaration='ai'):
     check_login(b)
-    b.command('fill', 'input[placeholder="添加作品标题"]', title)
-    wait_for(b, lambda: b.eval(f'document.querySelector(\'input[placeholder="添加作品标题"]\')?.value === {json.dumps(title)}'), '标题读回不一致')
+    fill_input(b, 'input[placeholder="添加作品标题"]', title)
     js = f'''(() => {{const editors=[...document.querySelectorAll('div[contenteditable=true]')].filter(e=>{VISIBLE});
       if(editors.length!==1) return false; const e=editors[0]; e.focus();
       const r=document.createRange(); r.selectNodeContents(e); const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
@@ -162,7 +187,7 @@ def get_note_link(b, title):
     b.command('reload')
     check_login(b)
     wait_for(b, lambda: b.eval('!!document.querySelector(\'input[placeholder*="搜索作品"]\')'), '管理页搜索框未出现')
-    b.command('fill', 'input[placeholder*="搜索作品"]', title)
+    fill_input(b, 'input[placeholder*="搜索作品"]', title)
     b.command('press', 'Enter')
     # Locate the smallest title-bearing card with one edit action; ambiguity fails closed.
     js = f'''(() => {{const titles=[...document.querySelectorAll('*')].filter(e=>{VISIBLE} &&
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-note-publish/scripts/test_publish_metrics.py` (modified, +15/-0)
```diff
@@ -43,6 +43,21 @@ def evaluate(js):
         result=note.get_note_link(b,'标题')
         self.assertEqual(result['url'],'https://www.douyin.com/note/7687034742688058662')
         self.assertIn(unittest.mock.call('reload'),b.command.call_args_list)
+        self.assertFalse(any(c.args[0] == 'fill' for c in b.command.call_args_list))
+        self.assertIn(unittest.mock.call('press', 'Enter'), b.command.call_args_list)
+
+    def test_fill_uses_eval_and_stops_on_rejected_input(self):
+        b = Mock()
+        b.eval.side_effect = ['https://creator.douyin.com/creator-micro/content/post/image', False]
+        with self.assertRaisesRegex(RuntimeError, '读回不一致'):
+            note.fill(b, '标题', '描述', 'none')
+        b.command.assert_not_called()
+
+    def test_fill_stops_when_controlled_input_reverts(self):
+        b = Mock()
+        b.eval.side_effect = [True, False]
+        with self.assertRaisesRegex(RuntimeError, '更新后读回不一致'):
+            note.fill_input(b, 'input', '标题')
 
     def test_fill_failure_stops_before_publish_and_closes(self):
         with patch.object(note,'validate'), patch.object(note,'Browser') as browser, \
```

---

### Incident Patch 3: `207457ad` (2026-09-19)
**Commit Message**: fix: refine Douyin note publishing and sync crawler compatibility

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -44,3 +44,4 @@ crews/main/db/
 
 # engagement 技能 probe 调试输出（dump 截图/HTML/innerText，不入仓）
 *-engagement-probe/
+docs/mediacrawlerpro-catchup-2026-09-19.md
```

**File**: `crews/main/HEARTBEAT.md` (modified, +5/-3)
```diff
@@ -74,7 +74,7 @@
 
 取数失败保留原始 stderr 和 exit code，继续下一平台；登录失效另记入 `EXPIRED_PLATFORMS`，不重登。`NOT_ON_FIRST_PAGE` 直接跳过，不补抓、不翻页。
 
-目前定时任务取数仅完整支持 expert 架构的四个平台（douyin、xhs、wx_channel、wx_mp）。其他平台直接跳过。
+目前定时任务取数仅支持已适配 expert 架构的四个平台（douyin、xhs、wx_channel、wx_mp），其他平台直接跳过。
 
 ---
 
@@ -88,14 +88,16 @@ content-calibrator eval --platform <platform> --check
 
 返回 JSON：`{dnas: [{dna_id, pending, triggered}]}`
 - 全部 `triggered=false` → 本轮评估跳过，不消耗后续 token
-- 有 `triggered=true` 的 DNA → 进入 Step 3a
+- 有 `triggered=true` 的 DNA → 进入 评估
 
 **对于douyin/wx_mp/wx_channel/xhs平台** → 走该平台专家包内的 review workflow
 
 > 触发的 DNA 属于哪个平台，就按该平台专家包的 review workflow 执行完整复盘（聚合、平台归因、写报告、标记全在 workflow 内；**workflow 不取数**——本轮数据已在 Step 1–2 采集就位）：
 
 > - **wx_mp** → expert-wx-mp 的 Review Workflow（`skills/expert-wx-mp/workflows/review.md`）
 > - **douyin** → expert-douyin 的 Review Workflow（`skills/expert-douyin/workflows/review.md`）
+> - **wx_channel** → expert-wx-channel 的 Review Workflow（`skills/expert-wx-channel/workflows/review.md`）
+> - **xhs** → expert-xhs 的 Review Workflow（`skills/expert-xhs/workflows/review.md`）
 
 **对于其他平台** → 尚未匹配DNA系统，直接跳过此步
 
@@ -128,7 +130,7 @@ content-calibrator eval --platform <platform> --check
    > ⚠️ 以下**取数端**登录态已失效，数据未能更新。请白天通知小贝重新登录：
    > - douyin（抖音）
    > - xhs-browse（小红书浏览端）
-   > - wechat-channel（微信视频号)
+   > - wx-channel（微信视频号)
 
 3. DNA 表现评估摘要（如有）：列出本轮评估的 DNA（平台 / dna-id / 覆盖篇数）+ 整体判定（改善 / 平稳 / 下滑）+ 关键归因；无触发 DNA 时写「无 DNA 达到评估阈值」并附各 DNA 待评估计数。
 4. **DNA 优化建议待确认（如有）**：列出评估报告中的逐条建议（建议内容 + 目标维度/template 部分 + 证据篇目）。**Agent 不得自动更新 DNA**。用户白天逐条确认后，指示走对应平台专家包的 style-dna workflow 回写 DNA。
```

**File**: `crews/main/skills/_shared/test-upstream-catchup.ts` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { parseXhsNoteFromHtml, fetchXhsNoteFromHtml, XhsSecurityBlockError } from './xhs-html-note.ts'
+import { collectComments } from '../expert-douyin/tools/douyin-comments/scripts/fetch_comments.ts'
+
+function html(stream: unknown, extra='') {
+  return `<script>window.__INITIAL_STATE__=${JSON.stringify({note:{noteDetailMap:{abc:{note:{
+    type:'video',title:'Test',video:{media:{stream},capa:{duration:3}},
+  }}}}})}</script>${extra}`
+}
+
+test('XHS EF/unknown buckets, numeric strings and camel/snake keys', () => {
+  const note=parseXhsNoteFromHtml(html({h264:[], EF4:[null,{master_url:'https://cdn/720',height:'720'}],
+    EF7:[{masterUrl:'https://cdn/1080-low',height:1080,avgBitrate:'100'},
+      {master_url:'https://cdn/1080-high',height:'1080',avg_bitrate:'200'}],
+    unknown:[{masterUrl:'javascript:bad',height:4000}], metadata:{height:9000}}),'abc')!
+  assert.equal(note.videoUrl,'https://cdn/1080-high')
+  assert.equal(note.durationMs,3000)
+})
+test('XHS h265 survives empty h264; malformed buckets use og video', () => {
+  assert.equal(parseXhsNoteFromHtml(html({h264:[],h265:[{masterUrl:'//cdn/video'}]}),'abc')?.videoUrl,'https://cdn/video')
+  assert.equal(parseXhsNoteFromHtml(html({EF5:null},'<meta property="og:video" content="https://cdn/og">'),'abc')?.videoUrl,'https://cdn/og')
+})
+test('XHS content containing soft-block words is not a blocked page', () => {
+  const body=html({EF4:[{masterUrl:'https://cdn/ok'}]}).replace('Test','安全限制')
+  assert.equal(parseXhsNoteFromHtml(body,'abc')?.title,'安全限制')
+})
+test('OpenCLI soft-block cooldown stays bounded to one retry', async () => {
+  const originalFetch=globalThis.fetch
+  const originalTimeout=globalThis.setTimeout
+  let calls=0
+  globalThis.fetch=async () => {calls++; return new Response('安全限制',{status:200})}
+  globalThis.setTimeout=((callback: (...args: unknown[])=>void) => {
+    queueMicrotask(callback)
+    return 0
+  }) as unknown as typeof setTimeout
+  try {
+    await assert.rejects(fetchXhsNoteFromHtml('abc',{xsecToken:'token'}),XhsSecurityBlockError)
+    assert.equal(calls,2)
+  } finally {globalThis.fetch=originalFetch; globalThis.setTimeout=originalTimeout}
+})
+const item=(cid:string)=>({cid,text:cid})
+const page=(comments:unknown[],cursor=0,has_more=0,total=0)=>({ok:true,status:200,data:{status_code:0,comments,cursor,has_more,total}}) as any
+
+test('Douyin HTTP 200 empty body and status 8 are not expired login and do not retry',async()=>{
+  for (const response of [{ok:true,status:200,data:null}, {ok:true,status:200,data:{status_code:8}}]) {
+    let calls=0
+    const result=await collectComments('123',40,async()=>{calls++;return response})
+    assert.equal(result.ok,false)
+    assert.match(result.error!,/^COMMENT_API_UNAVAILABLE/)
+    assert.equal(calls,1)
+  }
+})
+test('Douyin deduplicates, retains partial comments and stops stalled cursor',async()=>{
+  let calls=0; const waits:number[]=[]
+  const result=await collectComments('123',40,async()=>++calls===1
+    ?page([item('a')],20,1,100):page([item('a')],20,1,100),async ms=>{waits.push(ms)})
+  assert.equal(result.ok,false)
+  assert.equal(result.fetched,1)
+  assert.match(result.error!,/PAGINATION_STALLED/)
+  assert.equal(calls,2)
+  assert.equal(waits.length,1)
+  assert.ok(waits[0]>=1000 && waits[0]<3000)
+})
+test('Douyin true empty is valid, positive-total empty is not',async()=>{
+  assert.equal((await collectComments('123',40,async()=>page([]))).ok,true)
+  assert.equal((await collectComments('123',40,async()=>page([],0,0,10))).ok,false)
+  assert.equal((await collectComments('123',40,async()=>({ok:true,status:200,data:{status_code:0,comments:[]}}))).ok,false)
+})
+test('Douyin keeps final page, marks limit truncation and preserves request failure',async()=>{
+  assert.equal((await collectComments('123',40,async()=>page([item('a')],0,0,1))).fetched,1)
+  assert.equal((await colle
```

**File**: `crews/main/skills/_shared/xhs-html-note.ts` (modified, +19/-6)
```diff
@@ -183,13 +183,26 @@ export function parseXhsNoteFromHtml(html: string, noteId: string): XhsHtmlNote
   let videoUrl = ""
   const video = note?.video
   if (video) {
-    const h264 = video?.media?.stream?.h264 ?? video?.media?.stream?.h265 ?? []
-    videoUrl = h264[0]?.masterUrl ?? h264[0]?.master_url ?? ""
-    if (!videoUrl) {
-      // consumer.originVideoKey 是个 key，需拼域名——仅当无直链时作最后线索，此处不拼，留空走 og:video
-      const originKey = video?.consumer?.originVideoKey ?? video?.consumer?.origin_video_key
-      if (originKey) videoUrl = "" // 不直接用 key，交给 og:video
+    // Stream bucket names can change (h264/h265/av1 → EF*). Inspect every
+    // array bucket, retaining only usable URLs and sorting numeric quality fields.
+    const stream = video?.media?.stream
+    const quality = (value: unknown): number => {
+      const n = Number(value)
+      return Number.isFinite(n) && n > 0 ? n : 0
     }
+    const candidates = stream && typeof stream === "object"
+      ? Object.values(stream).flatMap(bucket => Array.isArray(bucket) ? bucket : [])
+          .filter(item => item && typeof item === "object")
+          .map(item => ({
+            url: [item.masterUrl, item.master_url].find(url =>
+              typeof url === "string" && /^(?:https?:)?\/\//.test(url)),
+            height: quality(item.height),
+            bitrate: quality(item.avgBitrate ?? item.avg_bitrate),
+          }))
+          .filter(item => item.url)
+          .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate)
+      : []
+    videoUrl = candidates[0]?.url ?? ""
   }
   if (!videoUrl && og.video) videoUrl = og.video
 
```

**File**: `crews/main/skills/expert-douyin/tools/_shared/publish-login.md` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+# 抖音发布：登录与异常处置
+
+`douyin-note-publish` 与 `douyin-video-publish` 共用本流程、login-manager 和唯一持久化 session `douyin`。每次发布先读本说明。发布工具不负责扫码登录，也没有 `login` 子命令；`login-manager --platform douyin` 负责用户登录后的导出与验证，不会代替用户登录。
+
+## 1. 打开创作者上传页并判断登录态
+
+按本次形态执行一个命令：
+
+- 图文：`douyin-note-publish open-page`
+- 视频：`douyin-video-publish open-page`
+
+用 `camoufox-cli --session douyin --persistent --json snapshot -i` 查看页面，必要时截图判断：
+
+- 用户头像 / 用户名及创作者上传界面已出现，无登录遮挡 → 继续对应工具的 `run`。
+- 跳登录页或出现要求登录的弹窗 → 进入下方登录流程，暂不上传。
+- 页面尚未加载、元素缺失或浏览器报错 → 保留错误，排查页面或环境；不能只凭无头像或 `open-page` 的 `ok=true` 判定登录成功/失效。
+
+浏览器持久化 profile 才是发布登录态来源；中央 cookie 文件存在、HTTP 探活通过均不能替代创作者页面检查。视频工具没有完整的自动登录判断；图文工具可识别跳登录页，页面内登录弹窗仍由 agent 检查。
+
+## 2. 首次登录或登录失效
+
+1. 先读 `login-manager` 技能，停止当前发布步骤，复用同一 session 有头打开：
+
+   ```bash
+   camoufox-cli --session douyin --persistent --headed --json open "https://creator.douyin.com/creator-micro/content/upload?enter_from=dou_web"
+   ```
+
+2. 告知用户在窗口里手动完成抖音创作者中心登录，等待用户确认；不盲轮询、不自行扫码。不在 heartbeat / isolated 定时任务里启动交互登录，那里只记录并跳过。
+3. 用户确认完成后执行：
+
+   ```bash
+   login-manager --platform douyin
+   ```
+
+   该命令导出 cookie 与 UA、验证、成功后写中央存储并 close session。失败时保留窗口，按 login-manager 的错误处理，不循环导出或重登。
+4. 成功后重新执行第 1 节对应的 `open-page`，由 agent 确认创作者页面已登录，再按第 3 节选择恢复步骤。默认发布以无头方式重新启动磁盘 profile。
+
+## 3. 运行中异常与恢复
+
+| 现象 | 操作 |
+| --- | --- |
+| 上传 / 填表前明确未登录，或 exit 2 | 停止发布，走第 2 节；成功后重新检查页面与未发布内容，再继续尚未执行的步骤 |
+| 已点击发布，之后登录失效 / 超时 / 取链失败 | 发布结果待核实。重登后先到管理页核实；图文可用 `douyin-note-publish get-note-link --title "完整标题"` 补取链接。不得直接重跑 `run` / `publish` |
+| login-manager exit 2（导出验证未通过） | 提醒用户人工核实账号与当前页面，停止本轮自动恢复；不反复重登 |
+| `session douyin 正忙` | 等已有任务完成后再操作，不起第二个 session，也不关闭别人的任务 |
+| 找不到 input / 按钮，页面未跳登录 | 保留 DOM / 超时错误，检查页面；不把所有浏览器错误当成登录失效 |
+| 需要实名认证 / 账号验证 | 交用户在原窗口处理，不自动绕过 |
+| 显示环境异常或风控限流 | 显示问题报告并停止，不改 DISPLAY 或搭显示栈；风控停止，30 分钟内不重试 |
+
+## 4. 会话纪律
+
+- 登录阶段的直接浏览器命令一致带 `--persistent --headed`。不要在等待用户登录时调用默认无头发布命令，以免 daemon 切模式重启窗口。
+- 图文发布需要用户监督时，所有图文子命令传 `--headed`，直接 camoufox-cli 操作也保持有头。视频发布 wrapper 默认无头：先完成 login-manager 导出关闭，再回无头发布流程。
+- 严禁 `cookies import` 或另建临时 session 导入 cookie 造会话；不在日志、作品目录或代码里记录 cookie。
+- `run` 完成后关闭 session。分步操作结束或放弃时关闭自己占用的 session；login-manager 失败保留的窗口交用户处理，不擅自关闭。
```

---

### Incident Patch 4: `421cdb47` (2026-09-16)
**Commit Message**: fix(video,全线): 回正 story-develop 口径——触发条件是 Brief 缺失/质量不足，非「未指定 workflow 默认入口」

用户澄清：story-develop 的产出是 Brief；Stage 0→15 是 CP 一切视频必走流程（无论指定什么
workflow），起点是 Brief；甲方没给 Brief 或 Brief 质量不足以完成 script 生产才调用 story-develop。

- CP 侧 SKILL.md / AGENTS.md / video-producer.sh / story-develop.md：「未指定 workflow 时
  默认从 story-develop 进入」的错误口径回正为「未指定时按通用制作流程做；Brief 创意不足
  以直接写剧本时先走 story-develop 收敛 Brief」；story-develop 何时触发恢复原始判据
  （甲方没给 Brief 或 Brief 创意不足以直接写 script.md，够用就不触发），顺手修掉原文
  行尾杂散反引号
- main 三平台 SKILL.md / video-dna-framework / build_style_profile / content-production：
  同步回正；main 侧保留一处新增语境「Brief 缺失或创意不足时 CP 会走 story-develop 与
  Brief owner 收敛 Brief」（让 main 看到 CP 反向提问时有上下文）
- 上一轮的其他修复（口播代写、脚本路线、只交 Brief、制作简报统一等）全部保留

README 上游借鉴列表补 gbro-collage-broll（MIT）引用：Collage B-roll workflow 的
方法论来源与移植口径说明

**File**: `README.md` (modified, +1/-0)
```diff
@@ -340,6 +340,7 @@ wiseflow/
 - html-video（nexu-io 的 HTML 视频渲染方案 — `video-producer` 的 Stage 10 静帧→成片渲染思路与素材组装约定参考自此） https://github.com/nexu-io/html-video
 - ViMax（HKUDS 的视频生成框架 — `video-producer` 的机位一致性约束与素材 slot 规划借鉴其镜头规划策略） https://github.com/HKUDS/ViMax
 - OpenMontage（calesthio 的开源蒙太奇剪辑方案 — `video-producer` 的 Stage 12 拼接成片+转场工作流借鉴其片段组装与节奏控制思路） https://github.com/calesthio/OpenMontage
+- gbro-collage-broll（MIT — 半调纸拼贴 B-roll 三闸门方法论 — `expert-video` 的 Collage B-roll workflow 移植自此：隐喻设计法、语义色场表、visual-spec schema、静帧/视频 QA 标准照搬，闸门映射为 GATE A/B、渲染栈换成 siliconflow-img-gen + aigc-video-gen i2v） https://github.com/pyang5166/gbro-collage-broll
 - agent-skills-launch-pack_（起号方法论知识来源） https://github.com/chenjin-cmd/agent-skills-launch-pack_
 
 ## Citation
```

**File**: `crews/content-producer/AGENTS.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
 | 影视解说 / 剧情解说 + 突然反转插入品宣（"万万没想到"式） | `expert-video` | 通用制作流程 + Reversal Ad 细化 |
 | 甲方交付口播文案或真人口播录音，要合成声画 | `expert-video` | 通用制作流程 + Narration Video 细化 |
 | "把这句口播做成拼贴 B-roll""纸拼贴动画""半调拼贴" | `expert-video` | 通用制作流程 + Collage B-roll 细化 |
-| "从零做视频""出一支完整视频""按这个主题拍片子"（无匹配类型） | `expert-video` | 先走 `story-develop` intake workflow（创意不清时与甲方收敛 Brief，够用则快速通过），再进 Stage 1 `script-write`，按通用制作流程出片（叙事 / 动效 / 蒙太奇手法由我据创意自定） |
+| "从零做视频""出一支完整视频""按这个主题拍片子"（无匹配类型） | `expert-video` | 只按通用制作流程走（叙事 / 动效 / 蒙太奇手法由我据创意自定）；Brief 缺失或创意不清时先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 1 `script-write` |
 | 已有素材要剪辑、修整、拼接、配音、烧字幕 | `expert-video` | 通用制作流程的 Stage 12 工具箱（只做几何级修整） |
 | "做网页/落地页/APP 界面/品牌视觉体系" | `expert-design` | Web Page / App UI / Brand Visual |
 
```

**File**: `crews/content-producer/skills/expert-video/SKILL.md` (modified, +4/-5)
```diff
@@ -56,7 +56,7 @@ metadata:
 | 层 | 是什么 | 怎么用 |
 |----|--------|--------|
 | **通用制作流程**（本文下方） | 我做**任何**视频制作工作都必须遵循的准则：Stage 0→15 阶段链、GATE A / GATE B 两闸门、返工与耗时上限、决策审计链、工作区与交付约定 | 永远适用，不因视频类型而跳过或替换 |
-| **workflow**（`workflows/*.md`） | 两类——**intake 类**（`story-develop`：Stage 0 创意模糊时与甲方对话收敛 Brief，**不是 `Brief.workflow` 取值**）；**type 类**（`narration-video` / `collage-broll` / `reversal-ad`：在通用制作流程之上细化某类视频的阶段裁剪、叙事套路、声音 / 画面规范、验收） | type 类：Brief 指定 `workflow` 时必读必用，冲突时以 workflow 为准但**闸门与护栏不让步**；intake 类：Brief 未指定 workflow 时进入（创意不足先收敛，够用快速通过） |
+| **workflow**（`workflows/*.md`） | 两类——**intake 类**（`story-develop`：Stage 0 创意模糊时与甲方对话收敛 Brief，**不是 `Brief.workflow` 取值**）；**type 类**（`narration-video` / `collage-broll` / `reversal-ad`：在通用制作流程之上细化某类视频的阶段裁剪、叙事套路、声音 / 画面规范、验收） | type 类：Brief 指定 `workflow` 时必读必用，冲突时以 workflow 为准但**闸门与护栏不让步**；intake 类：Brief 缺失或创意不足以直接写剧本时触发 |
 | **工具说明**（`tools/<工具>/SKILL.md`） | 每个子命令的入参、产物路径、退出码与旁路条件 | 调用前查；本文不重复参数细节 |
 
 > 通用制作流程**不是**与类型 workflow 并列的第四条路，也**不是**"Brief 没指定类型时的 fallback"。它是底座；类型 workflow 只在底座上细化，产出特定类型的视频。
@@ -72,10 +72,10 @@ metadata:
 | "把这句口播做成拼贴 B-roll""纸拼贴动画""半调拼贴" | Collage B-roll | `collage-broll` | 隐喻清单即 script（GATE A 检）→ 静帧即素材（GATE B 检 contact sheet）→ Stage 10 `collage-broll render` 批量 i2v 组装；阶段裁剪表见 workflow |
 
 - Brief 指定了 `workflow`：**先读对应文档并直接采用**，不得替换成自创流程。
-- Brief 未指定 `workflow` 且无明确类型信号：走 `story-develop` intake workflow——创意不足以直接写剧本时与甲方收敛，够用则快速通过——再进 Stage 1 `script-write`。叙事 / 动效 / 蒙太奇的处理手法由我据创意自定并记 `decisions.json`。
+- Brief 未指定 `workflow`：仍走通用制作流程，叙事 / 动效 / 蒙太奇的处理手法由我据创意自定并记 `decisions.json`；Brief 创意不足以直接写剧本时，先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 1 `script-write`。
 - 已有素材只要剪辑、修整、拼接、配音、烧字幕：仍走通用制作流程，中间阶段按实际裁剪，重心落在 Stage 12 工具箱（只做几何级修整；语义级高光剪辑归甲方 main）。
 
-> `story-develop` 是 **intake 类 workflow**（Stage 0 创意澄清，**不是 `Brief.workflow` 取值**），与上表 type 类 workflow 正交：Brief 未指定 workflow 时默认从它进入——创意不足以直接写剧本先收敛，够用则快速通过——再按通用制作流程（+ 信号识别到的 type workflow）执行。详见 `workflows/story-develop.md`。
+> `story-develop` 是 **intake 类 workflow**（Stage 0 创意澄清，**不是 `Brief.workflow` 取值**），与上表 type 类 workflow 正交：甲方没给 Brief 或 Brief 创意不足以直接写剧本时走它收敛出 Brief，再按通用制作流程 + 对应 type workflow 执行。详见 `workflows/story-develop.md`。
 
 不属于我的活（交回甲方或转其他专家包）：
 
@@ -116,8 +116,7 @@ workflow 文档在技能包内，不是项目目录内容；项目目录只放 B
 
 ```
 Stage 0  Brief intake       读甲方 Brief，核对字段，缺口向 Brief owner 澄清；
-                            甲方未给 Brief，或 Brief 未指定 workflow → 走 story-develop intake workflow
-                            （workflows/story-develop.md；创意不足先收敛，够用快速通过）
+                            甲方未给 Brief 或 Brief 不足以直接写剧本时 → 走 story-develop intake workflow（workflows/story-develop.md）
 Stage 1  script-write       Brief 创意 → 分场剧本（同时间同地点分一场、可拍化描述、enhancer 润色）
                             基线生产从此开始。
 Stage 2  script-self-eval   脚本自评 N 维打分，任一维 <3 必返工（落稿锁定时只检查不改写）
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/video-producer.sh` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@ video-producer — 视频制作原子能力（wrapper，expert-video 包内工
 流程:
   通用制作流程（expert-video SKILL.md 的 Stage 0→15 + 两闸门）是做**任何**视频都要遵循的基准，
   不是"没指定类型时的备选"。Brief 指定 workflow 时，先读包内 workflows/<workflow>.md，
-  按其阶段裁剪调用下列子命令；未指定时先走 story-develop intake workflow
-  （workflows/story-develop.md：创意不清先收敛，够用快速通过），再进 script-write。
+  按其阶段裁剪调用下列子命令；未指定时只按通用制作流程走。Brief 创意不足以直接写剧本时，
+  先走 story-develop intake workflow（workflows/story-develop.md）与甲方收敛 Brief，再进 script-write。
 
 子命令（按阶段序）:
   reference-concepts   可选     吃甲方给的参考拆解报告出 2–3 差异化概念
```

**File**: `crews/content-producer/skills/expert-video/workflows/story-develop.md` (modified, +2/-3)
```diff
@@ -1,13 +1,12 @@
 # Workflow：Story Develop（Brief intake · 创意澄清）
 
-**这是 intake 类 workflow，不是 type 类 workflow。** type workflow（`narration-video` / `collage-broll` / `reversal-ad`）细化"某类视频怎么制作"，是 `Brief.workflow` 的取值；本 workflow 解决"甲方还没把创意讲清楚时，怎么和他对话把 Brief 收敛出来"，**不是 `Brief.workflow` 的取值**，也不与 type workflow 互斥。**Brief 未指定 workflow 时，Stage 0（Brief intake）默认从这里进入**，与任何 type workflow 正交可组合——收敛出 Brief 后，仍按通用制作流程 + 对应 type workflow 执行。
+**这是 intake 类 workflow，不是 type 类 workflow。** type workflow（`narration-video` / `collage-broll` / `reversal-ad`）细化"某类视频怎么制作"，是 `Brief.workflow` 的取值；本 workflow 解决"甲方还没把创意讲清楚时，怎么和他对话把 Brief 收敛出来"，**不是 `Brief.workflow` 的取值**，也不与 type workflow 互斥。它在 **Stage 0（Brief intake）** 阶段触发，与任何 type workflow 正交可组合——收敛出 Brief 后，仍按通用制作流程 + 对应 type workflow 执行。
 
 ## 何时触发
 
-- **Brief 未指定 `workflow` 且无明确类型信号**（"从零做视频""出一支完整视频"）：默认入口。
 - **模式 B（直接对接用户）**：用户没给 Brief，或只给了模糊想法（"做个短片""帮我策划一下"）。
 - **模式 A（Subagent 承制）**：main 的 Brief 缺关键字段（创意 / 核心传达不清、规格缺失），需向 Brief owner 澄清。
-- 创意足以直接写 `script.md` 时**快速通过**：确认 Brief 字段完整即直进 Stage 1，不硬走对话。
+- 触发判据：**甲方没给 Brief，或 Brief 的"创意"不足以直接写 `script.md`**。够用就不触发。
 
 > ❗ 本 workflow 是**澄清与收敛**，不是替甲方创作。选题方向、品牌事实、卖点承诺、CTA 口径归甲方；我只把甲方脑子里的创意问清楚、整理成 Brief，不自行脑补，也不反过来指挥甲方。
 
```

---

### Incident Patch 5: `f01b8492` (2026-09-16)
**Commit Message**: fix(main,三平台): 按视频两条理念审计修正——堵口播代写口子、脚本路线归位 Brief 契约、story-develop 口径补齐

违背理念的实质修复：
- 删「口播子模块未启用时只给要点、由 CP 组织旁白」代写通道（xhs:192 / wx:226）——
  口播终稿一律由 main 写（子模块启用按其结构写，未启用按用户要求与 Brief 核心传达写），
  「不适用」仅限非口播类；三平台 SKILL.md 分工硬边界、style-dna 口播行、
  content-production spawn 段同步去条件化
- 脚本制作路线（douyin:24 / wx:24）：「根据 DNA 改脚本交 CP」改为用户脚本按素材处理
  （绝对路径进 Brief 素材清单），main 只调策略层不动分镜，需动分镜即改走 Brief 委托由 CP 重出
- 校验清单（build_style_profile.py ×3）：删「未启用时避免规定逐句口播」，改要求无论
  子模块是否启用口播类必附 voiceover.md 绝对路径或录音路径

story-develop 口径补齐（对齐 CP 侧新默认入口）：
- 三平台 SKILL.md / content-production Brief 模板与 spawn 段 / video-dna-framework
  路由表与尾段 / build_style_profile video-form scaffold：「未指定 workflow → CP 走
  story-develop intake 收敛创意（够用快速通过）后按通用制作流程做」

一致性清理：
- 「只交 Brief + 素材 + 口播」→「只交 Brief 一份（素材、口播均以绝对路径写在 Brief 内）」
- 「制作简报」统一为 Brief；Brief 模板 workflow 行「未指定」枚举值改「省略本字段」；
  douyin 采集表补 workflow 行；video-review 限定为 main 自做轻加工自检；
  wx editing 成片后流程措辞、style-dna 图文残句、account-setup 脚本简报→话术简报

**File**: `crews/main/skills/expert-douyin/SKILL.md` (modified, +2/-2)
```diff
@@ -43,9 +43,9 @@ metadata:
 
 跨领域通用技能：`viral-chaser`（抖音 / B站 / 小红书视频下载拆解，DNA 采样与仿写参考的取数主力）、`smart-search`（跨平台搜索，选题调研优先走社交平台，不用通用搜索引擎）、`content-calibrator`（DNA 表现评估）、`published-track`（发布记录与指标库）、`login-manager`（抖音登录态维护）。
 
-素材加工相关技能：`video-edit`（素材加工拼接）、`talking-head-cut`（口播轻剪辑）、`ui-demo`（产品操作录屏）、`video-review`（成片质检闸门）、`siliconflow-img-gen`（封面图）、`pexels-footage` / `pixabay-footage`（免版权素材）。
+素材加工相关技能：`video-edit`（素材加工拼接）、`talking-head-cut`（口播轻剪辑）、`ui-demo`（产品操作录屏）、`video-review`（成片质检闸门，仅用于 main 自做轻加工成品的自检；CP 成片质检在 CP 流程内完成）、`siliconflow-img-gen`（封面图）、`pexels-footage` / `pixabay-footage`（免版权素材）。
 
-**视频全案分工硬边界**：除非是基于已有素材轻加工，否则视频全案的制作均应委托 `content-producer`。main 负责选题策划、按 DNA 出 **Brief**、拟定标题与简介、准备素材（用户素材预处理 / `ui-demo` 录屏 / 从 `campaign_assets/` 挑选，绝对路径写进 Brief）、监督推动 CP、成片后的发布与运营；口播类视频的口播文案由 main 按 `narration-script` 子模块写好并随 Brief 交付（真人口播时，指导用户录音并取得录音文件），CP 不重写策略文案。Brief 指定 `workflow` 时 CP 必须采用；未指定时 CP 按其通用制作流程做。Brief **不含 DNA 信息**，main 也不替 CP 建工作区（双方 T3 权限可互访取文件）。
+**视频全案分工硬边界**：除非是基于已有素材轻加工，否则视频全案的制作均应委托 `content-producer`。main 负责选题策划、按 DNA 出 **Brief**、拟定标题与简介、准备素材（用户素材预处理 / `ui-demo` 录屏 / 从 `campaign_assets/` 挑选，绝对路径写进 Brief）、监督推动 CP、成片后的发布与运营；口播类视频的口播终稿一律由 main 写好并随 Brief 交付（`narration-script` 子模块启用时按其结构写，未启用时按用户要求与 Brief 核心传达写；真人口播时，指导用户录音并取得录音文件），CP 不重写。Brief 指定 `workflow` 时 CP 必须采用；未指定时 CP 走其 story-develop intake workflow（创意不足先收敛，够用快速通过）后按通用制作流程做。Brief **不含 DNA 信息**，main 也不替 CP 建工作区（双方 T3 权限可互访取文件）。
 
 ## 风格与 DNA
 
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-style-profiler/references/video-dna-framework.md` (modified, +2/-2)
```diff
@@ -103,12 +103,12 @@ DNA template = **Brief.md 正文模板 + 口播文案模板（可选）**，固
 | 影视解说 / 剧情解说 + 反转植入（「万万没想到」式） | Content Producer `expert-video` → **Reversal Ad** workflow | `reversal-ad` |
 | 口播类（真人口播出镜，或旁白 + 画面） | Content Producer `expert-video` → **Narration Video** workflow | `narration-video` |
 | 一句文稿转视觉隐喻的纸拼贴动画 | Content Producer `expert-video` → **Collage B-roll** workflow | `collage-broll` |
-| 纯 AIGC 动画 / 剧情短片 / 蒙太奇拼接（需从零出脚本分镜） | Content Producer `expert-video` → **不指定类型 workflow**：CP 按其通用制作流程做，据创意自定叙事 / 动效 / 蒙太奇手法 | 省略 |
+| 纯 AIGC 动画 / 剧情短片 / 蒙太奇拼接（需从零出脚本分镜） | Content Producer `expert-video` → **不指定类型 workflow**：CP 走其 story-develop intake 收敛创意后按通用制作流程做，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定 | 省略 |
 | 已有素材简单拼接、加旁白、烧字幕 | main `video-edit`（不委托 CP） | — |
 | 已有真人口播素材去口气词、剪高光 | main `talking-head-cut`（不委托 CP） | — |
 | 产品操作录屏 | main `ui-demo`（不委托 CP） | — |
 
-Brief 写了 `workflow` 时 Content Producer 必须直接采用，不得替换成自创流程；未写时 CP 按其**通用制作流程**做——那是 CP 所有视频工作的基准准则，不是与其他 workflow 并列的选项，也不是 fallback，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定。
+Brief 写了 `workflow` 时 Content Producer 必须直接采用，不得替换成自创流程；未写时 CP 走其 **story-develop** intake workflow 收敛创意（够用快速通过）后按**通用制作流程**做——通用制作流程是 CP 所有视频工作的基准准则，不是与其他 workflow 并列的选项，也不是 fallback，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定。
 
 ## Focus ID 表
 
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-style-profiler/scripts/build_style_profile.py` (modified, +2/-2)
```diff
@@ -104,7 +104,7 @@
     "topic-angle": "- 单篇观测：选题类型、选题入口（现象 / 问题 / 冲突 / 数据 / 热点 / 挑战 / 个人经历）、目标人群为什么要看完（理解 / 判断 / 行动 / 避坑 / 身份认同 / 情绪共鸣）。\n- 边界：只记本篇，不判断跨篇稳定性；不评价选题好坏。",
     "title-cover": "- 单篇观测：标题类型（痛点 / 数字 / 反差 / 悬念 / 身份点名 / 搜索长尾）、标题与描述原文、话题标签策略。\n- 视觉证据：封面或首帧必须由视觉模型读取图片，至少提取画面主体与场景、构图与画幅、色彩体系、光线与质感、风格与媒介、文字视觉与图文关系、品牌识别元素、避免项，并反推为可执行的 AIGC 提示词要素；无图片写「未提供」，不得凭正文或标题想象补齐。",
     "content-idea": "- 单篇观测：一句话创意内核、创意类型、展开逻辑（悬念 / 反转 / 递进 / 对比 / 清单 / 实测）、记忆点。\n- 可复用信号：这个创意套路换成别的主题还能怎么用。\n- 边界：只记创意层，不记创作细节（逐句台词、镜头表、脚本结构、转场与编码参数）。",
-    "video-form": "- 单篇观测：视频内容形态（口播 / 实拍拼接 / 影视解说+反转植入 / 纯 AIGC 动画 / 创意转场动效 / 录屏演示 / 图文卡片视频 / 混合）与判定依据（画面证据、口播占比、素材来源）。\n- 制作指向：必须落到真实存在的资源名——Content Producer `expert-video` 的某个 workflow（Reversal Ad / Narration Video / Collage B-roll；不属这三类就写「不指定类型 workflow」，由 CP 按通用制作流程据创意自定手法），或 main 的素材加工技能（`video-edit` / `talking-head-cut` / `ui-demo`）；不得发明不存在的名字。",
+    "video-form": "- 单篇观测：视频内容形态（口播 / 实拍拼接 / 影视解说+反转植入 / 纯 AIGC 动画 / 创意转场动效 / 录屏演示 / 图文卡片视频 / 混合）与判定依据（画面证据、口播占比、素材来源）。\n- 制作指向：必须落到真实存在的资源名——Content Producer `expert-video` 的某个 workflow（Reversal Ad / Narration Video / Collage B-roll；不属这三类就写「不指定类型 workflow」，由 CP 走其 story-develop intake 收敛创意后按通用制作流程自定手法），或 main 的素材加工技能（`video-edit` / `talking-head-cut` / `ui-demo`）；不得发明不存在的名字。",
     "production-spec": "- 单篇观测：横屏或竖屏、时长带、画面风格（色调、质感、字幕样式倾向、信息密度）、配音音色与声音形态（原声口播 / TTS / 旁白 / 纯画面字幕）、BGM 与音效倾向、封面规格。\n- 边界：只记规格与倾向，不规定镜头参数、逐镜设计、转场与编码细节——那些归 Content Producer。",
     "narration-script": "- 子模块（仅口播类作品启用）：起（从什么起步）、承（靠什么推进）、转（转折触发）、合（收束方式；CTA 的目标、位置与句式记在 `interaction-cta`），以及人称与语气、句长与语速、签名式表达。\n- 边界：非口播类或证据不足时写「未启用 / 未观测」；不得把单篇句式直接上升为规则。",
     "body-voice": "- 单篇观测：开头钩子（原文摘录）、正文组织方式（清单体 / 教程步骤 / 故事线 / 对比 / 观点输出）、分行与段落节奏、口语化程度与人称、emoji 与标点用法、签名式表达。\n- 证据边界：脚本统计只给句长 / 行数 / emoji / 标签等线索；口头禅与签名表达必须回读原文确认。",
@@ -144,7 +144,7 @@
 }
 
 TEMPLATE_CHECKLISTS = {
-    "video": "- 是否只用一个 DNA，且作品类型与该 DNA 的 `kind` 一致。\n- 选题、标题 / 描述、封面是否来自 DNA 文档。\n- 内容创意是否落到可复用的创意原型，而不是照抄样本主题。\n- 视频形态是否明确指向 Content Producer `expert-video` 的某个 workflow，或 main 的某个素材加工技能。\n- Brief 是否只含制作所需信息（不含 DNA 内容），素材是否给了绝对路径与授权说明。\n- 口播类是否附口播文案（或真人口播录音路径）；口播子模块未启用时是否避免规定逐句口播。\n- 制作规格（横竖屏、时长带、画面风格、配音音色）是否尊重样本覆盖度；样本不足时是否标注未观测。\n- 业务植入是否落到位置 + 载体 + 衔接句（而不是只写「自然植入」），CTA 是否只有一个主行动、句式可执行且未越合规红线。\n- 用户输入是否已转译为具体执行规则。",
+    "video": "- 是否只用一个 DNA，且作品类型与该 DNA 的 `kind` 一致。\n- 选题、标题 / 描述、封面是否来自 DNA 文档。\n- 内容创意是否落到可复用的创意原型，而不是照抄样本主题。\n- 视频形态是否明确指向 Content Producer `expert-video` 的某个 workflow，或 main 的某个素材加工技能。\n- Brief 是否只含制作所需信息（不含 DNA 内容），素材是否给了绝对路径与授权说明。\n- 口播类是否附口播终稿（`voiceover.md` 绝对路径）或真人口播录音路径——无论口播子模块是否启用；「不适用」仅限非口播类视频。\n- 制作规格（横竖屏、时长带、画面风格、配音音色）是否尊重样本覆盖度；样本不足时是否标注未观测。\n- 业务植入是否落到位置 + 载体 + 衔接句（而不是只写「自然植入」），CTA 是否只有一个主行动、句式可执行且未越合规红线。\n- 用户输入是否已转译为具体执行规则。",
     "note": "- 是否只用一个 DNA，且作品类型与该 DNA 的 `kind` 一致。\n- 选题、标题与封面图组是否来自 DNA 文档。\n- 正文表达的每条规则是否可从 DNA 文档推导，未使用空泛形容词。\n- 图组数量、构图与视觉风格是否与 DNA 一致；视觉结论是否有图片证据。\n- 业务植入是否落到位置 + 载体 + 衔接句（而不是只写「软性推荐」），CTA 是否每篇只放一个主行动、句式可执行且未越合规红线。\n- 用户输入是否已转译为具体执行规则。",
 }
 
```

**File**: `crews/main/skills/expert-douyin/workflows/account-setup.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 新号起号、账号定位梳理、内容支柱搭建、默认 `dna-0` 初始化、老号接手与诊断走这个 Workflow。独立账号对标走 `account-benchmark.md`。
 
-起号拆成六件事：定位清楚、观看理由成立、标签稳定、内容有用、互动真实、复盘持续；平台功能入口、算法权重、处罚规则按待确认信息处理。产出要能直接执行：表格、清单、脚本简报、选题池或复盘动作，少写空泛建议，多给"下一条视频该怎么做"。
+起号拆成六件事：定位清楚、观看理由成立、标签稳定、内容有用、互动真实、复盘持续；平台功能入口、算法权重、处罚规则按待确认信息处理。产出要能直接执行：表格、清单、话术简报、选题池或复盘动作，少写空泛建议，多给"下一条视频该怎么做"。
 
 ## 入口判断
 
```

**File**: `crews/main/skills/expert-douyin/workflows/content-production.md` (modified, +7/-6)
```diff
@@ -20,8 +20,8 @@
 | 路线 | 判断 | 执行方 |
 | --- | --- | --- |
 | 素材组装 / 轻剪辑 | 用户手里有可用素材 | main 直接做：`video-edit` / `talking-head-cut` / `ui-demo` |
-| 从零制作 | 没有素材，需要出脚本、拍摄/生成画面 | main 出制作简报，委托 `content-producer` |
-| 脚本制作 | 用户已有脚本 | 根据dna对脚本做必要修改，提交用户确认后，脚本交 `content-producer` 制作 |
+| 从零制作 | 没有素材，需要出脚本、拍摄/生成画面 | main 出 Brief，委托 `content-producer` |
+| 脚本制作 | 用户已有脚本 | 用户脚本按素材处理（绝对路径写进 Brief 素材清单，必须保留的事实 / 结构要点写进 Brief 要求）；main 只调策略层（选题 / 口播口径 / 植入 / CTA），不改写脚本本体、不动分镜与画面执行——需动分镜即改走 Brief 委托，由 CP 重出 |
 
 ### 3. 抖音链接的意图判断
 
@@ -77,6 +77,7 @@ DNA template 是 main agent 的生产输入模板：
 | 项目 | 规则 |
 | --- | --- |
 | 制作路线 | 素材组装 / 从零制作 / 脚本制作，判断依据见 Step 0 |
+| workflow | 视频全案已确定形态时写 CP `expert-video` 支持的 workflow（reversal-ad / narration-video / collage-broll）；未确定则省略（省略 = CP 走其 story-develop intake 收敛后按通用制作流程做） |
 | 主题 / 方向 | 用户给了明确主题时不得另起炉灶，仅按 DNA template 细化选题和钩子 |
 | 素材 | 用户提供的视频片段、图片、录音、文案必须优先使用 |
 | 目标观众 | 未指定时按 `business_knowledge.md` 和 DNA 受众关系推导 |
@@ -187,14 +188,14 @@ DNA 约束的是选题与观看理由、标题与封面写法、内容创意原
 
 ### 路线 B / C：委托 content-producer 制作
 
-1. 产出**制作简报** `douyin/outputs/<video-name>/brief.md`（Brief 是 main / CP 的唯一交接物）：
+1. 产出 **Brief** `douyin/outputs/<video-name>/brief.md`（Brief 是 main / CP 的唯一交接物）：
 
 ```markdown
 # 抖音视频制作 Brief
 
 - 视频名 / slug：
 - platform：douyin
-- workflow：reversal-ad / narration-video / collage-broll / 未指定（未指定 = CP 按其通用制作流程做，据创意自定叙事 / 动效 / 蒙太奇手法）
+- workflow：reversal-ad / narration-video / collage-broll（视频形态未确定时省略本字段；省略 = CP 走其 story-develop intake workflow 收敛创意后按通用制作流程做，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定）
 - 选题与观看理由：
 - 核心传达：
 - 内容创意：创意原型 + 展开逻辑 + 记忆点（+ 反转设计，如为反转植入类）
@@ -216,9 +217,9 @@ Brief 硬性规则：
 - **素材给绝对路径**：main 负责素材准备（用户素材预处理、`ui-demo` 录屏、从 `campaign_assets/` 挑选），把绝对路径写进 Brief。
 - **甲乙方关系**：需求方向、品牌事实、发布文案归 main；制作方案、分镜、渲染参数归 CP。
 
-2. 口播类视频：按 DNA 的 `narration-script` 子模块写口播终稿 `douyin/outputs/<video-name>/voiceover.md`，Brief 里给绝对路径；真人口播时指导用户按口播稿录音，完成后向用户取得录音文件。
+2. 口播类视频：口播终稿一律由 main 写——`narration-script` 子模块启用时按其结构写，未启用时按用户要求与 Brief 核心传达写——落 `douyin/outputs/<video-name>/voiceover.md`，Brief 里给绝对路径；真人口播时指导用户按口播稿录音，完成后向用户取得录音文件。
 3. 参考模式下，把选题与创意结论写进 Brief 的「内容创意」段即可；`viral-chaser` 拆解报告是 main 的采样材料，**不作为 Brief 附件交给 CP**。
-4. spawn `content-producer` 委托制作：只交 Brief + 素材绝对路径 + 口播文案 / 录音；不指定 CP 的工作区与制作方案。
+4. spawn `content-producer` 委托制作：只交 Brief 一份——素材、口播文案 / 录音均已以绝对路径写在 Brief 内；不指定 CP 的工作区与制作方案。
 5. Brief 变更时更新版本并推送变更要点；已开工中间产物按新版取舍，弃用部分记入交付说明。
 6. CP 交付后，按其回报的绝对路径把成片与封面取回 `douyin/outputs/<video-name>/`（`video.mp4` / `cover.jpg`），并把交付说明要点记入作品目录。
 
```

---

### Incident Patch 6: `4fce7ff0` (2026-09-16)
**Commit Message**: fix(expert-video): 全仓对齐 Stage 0→15 新编号，清除旧阶段编号与 intent-router 留痕

- AGENTS.md / SKILL.md: Stage 0→14→0→15；script-write 由 Stage 3 改 Stage 1；
  工作区目录树内联编号(3/3b/4/5/6/7/8/9a/9b/14b)全部按新编号重排；
  跨领域技能引用 aigc-video-gen 8/10→7/10、siliconflow-img-gen 6/10/14a→5/10/14a
- video-producer.sh: help 全表重编号；GATE A 由 Stage 6 后改 Stage 5 后；
  motion-audit/make-cover 补 13b/14a 子标
- 12 个子脚本: docstring/argparse/报错/[next] 提示/JSON stub stage 字段全部对齐新编号；
  9a/9b/3b/11a/11b 旧子字母清除（11B/11C 保留为 mix-audio 场景字母）
- mix-audio.py: 三场景→四场景（正文补齐场景 D 甲方口播录音路径），与 SKILL.md 对齐
- reversal-ad.md: Stage 3 不重写策略文案 → Stage 1 不重写 voiceover.md 口播终稿
- main 三平台 video-dna-framework.md: 删「intent-router 档位分类已退役」历史注记
- character-register.py: 顺手修 docstring 错字（拱分→拆分）

**File**: `crews/content-producer/AGENTS.md` (modified, +2/-2)
```diff
@@ -11,15 +11,15 @@
 
 ## 能力方向路由
 
-**视频类铁律**：只要接的是视频制作活儿，`expert-video` 的**通用制作流程**（Stage 0→14 阶段链 + GATE A/B 两闸门 + 护栏 + 工作区与交付约定）**一律适用**——它是基准准则，不是"没匹配到类型时的备选"，也不与类型 workflow 并列。下表匹配到的类型 workflow 只是叠加在基准上的进一步细化。
+**视频类铁律**：只要接的是视频制作活儿，`expert-video` 的**通用制作流程**（Stage 0→15 阶段链 + GATE A/B 两闸门 + 护栏 + 工作区与交付约定）**一律适用**——它是基准准则，不是"没匹配到类型时的备选"，也不与类型 workflow 并列。下表匹配到的类型 workflow 只是叠加在基准上的进一步细化。
 
 | 入口信号 | 专家包 | 怎么做 |
 |---------|--------|--------|
 | Brief 指定 `workflow`（如 `reversal-ad`） | `expert-video` | 通用制作流程 + 读 Brief 指定的 `workflows/<值>.md`，按其阶段裁剪执行 |
 | 影视解说 / 剧情解说 + 突然反转插入品宣（"万万没想到"式） | `expert-video` | 通用制作流程 + Reversal Ad 细化 |
 | 甲方交付口播文案或真人口播录音，要合成声画 | `expert-video` | 通用制作流程 + Narration Video 细化 |
 | "把这句口播做成拼贴 B-roll""纸拼贴动画""半调拼贴" | `expert-video` | 通用制作流程 + Collage B-roll 细化 |
-| "从零做视频""出一支完整视频""按这个主题拍片子"（无匹配类型） | `expert-video` | 只按通用制作流程走；创意不清时先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 3 `script-write`（叙事 / 动效 / 蒙太奇手法由我据创意自定，不再做三档分类） |
+| "从零做视频""出一支完整视频""按这个主题拍片子"（无匹配类型） | `expert-video` | 只按通用制作流程走；创意不清时先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 1 `script-write`（叙事 / 动效 / 蒙太奇手法由我据创意自定） |
 | 已有素材要剪辑、修整、拼接、配音、烧字幕 | `expert-video` | 通用制作流程的 Stage 12 工具箱（只做几何级修整） |
 | "做网页/落地页/APP 界面/品牌视觉体系" | `expert-design` | Web Page / App UI / Brand Visual |
 
```

**File**: `crews/content-producer/skills/expert-video/SKILL.md` (modified, +8/-8)
```diff
@@ -55,7 +55,7 @@ metadata:
 
 | 层 | 是什么 | 怎么用 |
 |----|--------|--------|
-| **通用制作流程**（本文下方） | 我做**任何**视频制作工作都必须遵循的准则：Stage 0→14 阶段链、GATE A / GATE B 两闸门、返工与耗时上限、决策审计链、工作区与交付约定 | 永远适用，不因视频类型而跳过或替换 |
+| **通用制作流程**（本文下方） | 我做**任何**视频制作工作都必须遵循的准则：Stage 0→15 阶段链、GATE A / GATE B 两闸门、返工与耗时上限、决策审计链、工作区与交付约定 | 永远适用，不因视频类型而跳过或替换 |
 | **workflow**（`workflows/*.md`） | 两类——**intake 类**（`story-develop`：Stage 0 创意模糊时与甲方对话收敛 Brief，**不是 `Brief.workflow` 取值**）；**type 类**（`narration-video` / `collage-broll` / `reversal-ad`：在通用制作流程之上细化某类视频的阶段裁剪、叙事套路、声音 / 画面规范、验收） | type 类：Brief 指定 `workflow` 时必读必用，冲突时以 workflow 为准但**闸门与护栏不让步**；intake 类：创意不足以直接写剧本时触发 |
 | **工具说明**（`tools/<工具>/SKILL.md`） | 每个子命令的入参、产物路径、退出码与旁路条件 | 调用前查；本文不重复参数细节 |
 
@@ -72,7 +72,7 @@ metadata:
 | "把这句口播做成拼贴 B-roll""纸拼贴动画""半调拼贴" | Collage B-roll | `collage-broll` | 一句文稿 → 一个视觉隐喻 → 静帧 → i2v，三道闸门与 Gate 3 批量调度 |
 
 - Brief 指定了 `workflow`：**先读对应文档并直接采用**，不得替换成自创流程。
-- Brief 未指定 `workflow`：仍走通用制作流程；创意不足以直接写剧本时，先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 3 `script-write`。叙事 / 动效 / 蒙太奇的处理手法由我据创意自定并记 `decisions.json`。
+- Brief 未指定 `workflow`：仍走通用制作流程；创意不足以直接写剧本时，先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 1 `script-write`。叙事 / 动效 / 蒙太奇的处理手法由我据创意自定并记 `decisions.json`。
 - 已有素材只要剪辑、修整、拼接、配音、烧字幕：仍走通用制作流程，中间阶段按实际裁剪，重心落在 Stage 12 工具箱（只做几何级修整；语义级高光剪辑归甲方 main）。
 
 > `story-develop` 是 **intake 类 workflow**（Stage 0 创意澄清，**不是 `Brief.workflow` 取值**），与上表 type 类 workflow 正交：任何类型的视频，创意不清都先走它收敛 Brief，再按通用制作流程 + 对应 type workflow 执行。详见 `workflows/story-develop.md`。
@@ -93,19 +93,19 @@ output_videos/<topic-en-slug>/      # <project-dir>
 ├── brief.md                    # 甲方交付（拷贝入档）或 Stage 0 与用户定稿
 ├── voiceover.md                # 甲方交付的口播文案（如有）
 ├── reference/                  # 可选：甲方给的参考拆解报告与差异化概念
-├── script/                     # script.md(3) / self-eval.json(3b) / decisions.json(审计链)
-├── storyboard/                 # storyboard.json(4) / shot_decompose.json(5)
-├── characters/                 # registry.json(6) + <char-id>/{front,side,back}.png
+├── script/                     # script.md(1) / self-eval.json(2) / decisions.json(审计链)
+├── storyboard/                 # storyboard.json(3) / shot_decompose.json(4)
+├── characters/                 # registry.json(5) + <char-id>/{front,side,back}.png
 ├── gates/                      # gate-a.md / gate-b.md（含批准人与批准范围）
 ├── raw_materials/              # 甲方素材入库副本 + 授权记录
-├── slots/                      # slot-plan.json(7) / asset-resolve.json(8) / slideshow-risk.json(9a) / delivery-promise.json(9b)
+├── slots/                      # slot-plan.json(6) / asset-resolve.json(7) / slideshow-risk.json(8) / delivery-promise.json(9)
 ├── render/shot-NN/             # (10) first-frame.png / last-frame.png / shot.mp4
 ├── audio/                      # narration.mp3 / narration-segments.json / bgm.mp3 / subtitles.srt
 ├── artifacts/                  # (12) 按镜顺序的最终段 01_*.mp4 … NN_*.mp4
 ├── video.mp4                   # (12) 成片
 ├── review/                     # verdict.json(13a) / frames/ / motion-audit.json(13b)
 ├── cover.jpg                   # (14a)
-└── final-deliver.md            # (14b)
+└── final-deliver.md            # (15)
 ```
 
 workflow 文档在技能包内，不是项目目录内容；项目目录只放 Brief、素材、脚本、渲染与交付产物。
@@ -198,7 +198,7 @@ Stage 15 交付              回报成片 + 封面 + final-deliver.md 的绝对
 | `video-producer` | 阶段链全部原子能力（剧本 / 分镜、素材 slot 与解析、渲染、混音对齐、拼接合成、动效审计、封面）+ 后期处理（`normalize` **必跑**、`burn-srt` / `duck` / `denoise` / `interp` 可选，全部干湿分离不覆盖输入） | `video-producer <子命令>`；`video-producer help` 列全量 |
 | `collage-broll` | 纸拼贴 B-roll 的环境自检与 Gate 3 批量 i2v 调度（0 全通 / 1 参数错 / 2 部分失败，只重跑失败条目） | `collage-broll check-setup` / `collage-broll gate3 --batch <gen-jobs.json> [--dry-run]` |
 
-跨领域公共技能：`aigc-video-gen`（视频片段生成 / i2v 首尾帧插值，Stage 8/10；输出路径须落在 `output_videos/` 下，调用时 workdir 是 Content Producer workspace 根）、`siliconflow-img-gen`（静帧、角色三视图、封面，Stage 6/10/14a）、`awk-tts`（旁白 TTS，带字级时间戳，Stage 11B；`--enable-subtitle` 让火山流式 HTTP 原生返回时间戳）、`bgm-library`（ccMixter 免版税 + 自动 TASL 署名，商用安全，Sta
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/asset-resolve.py` (modified, +5/-5)
```diff
@@ -1,10 +1,10 @@
 #!/usr/bin/env python3
-"""Stage 8 — asset-resolve：按 slot 拉素材（Fast path）。
+"""Stage 7 — asset-resolve：按 slot 拉素材（Fast path）。
 
 Usage:
   python3 scripts/asset-resolve.py <project_dir> [--source pexels|pixabay|both] [--no-confirm]
 
-入：project_dir/slots/slot-plan.json（Stage 7）
+入：project_dir/slots/slot-plan.json（Stage 6）
 出：project_dir/slots/asset-resolve.json（每 slot 选定素材 + rejected_picks 落盘）
     + 素材落 project_dir/raw_materials/
 
@@ -36,7 +36,7 @@ def die(msg: str) -> None:
 
 
 def main() -> None:
-    parser = argparse.ArgumentParser(description="Stage 8 asset-resolve")
+    parser = argparse.ArgumentParser(description="Stage 7 asset-resolve")
     parser.add_argument("project_dir", help="项目目录（CP 自建工作区 output_videos/<topic-en-slug>/）")
     parser.add_argument("--source", default="both", choices=["pexels", "pixabay", "both"])
     parser.add_argument("--no-confirm", action="store_true", help="agent 已人核完毕，不再呈交")
@@ -59,7 +59,7 @@ def main() -> None:
         return
 
     stub = {
-        "stage": 8,
+        "stage": 7,
         "source": args.source,
         "raw_materials_dir": str(raw_dir),
         "instruction": (
@@ -83,7 +83,7 @@ def main() -> None:
     }
     resolve_path.write_text(json.dumps(stub, ensure_ascii=False, indent=2), encoding="utf-8")
     print(f"[done] asset-resolve.json 模板已落：{resolve_path}")
-    print(f"[next] agent 跑 Fast path 填 picks → 跑 slideshow-risk（Stage 9a）")
+    print(f"[next] agent 跑 Fast path 填 picks → 跑 slideshow-risk（Stage 8）")
 
 
 if __name__ == "__main__":
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/character-register.py` (modified, +4/-4)
```diff
@@ -1,10 +1,10 @@
 #!/usr/bin/env python3
-"""Stage 6 — character-register：角色三视图 + static/dynamic features 拱分。
+"""Stage 5 — character-register：角色三视图 + static/dynamic features 拆分。
 
 Usage:
   python3 scripts/character-register.py <project_dir>
 
-入：project_dir/storyboard/shot_decompose.json（Stage 5）+ script.md（Stage 3 出场人物）
+入：project_dir/storyboard/shot_decompose.json（Stage 4）+ script.md（Stage 1 出场人物）
 出：project_dir/characters/registry.json（每个角色 static/dynamic features）
     + project_dir/characters/<char-id>/front.png + side.png + back.png（调 siliconflow-img-gen）
 
@@ -28,7 +28,7 @@ def die(msg: str) -> None:
 
 
 def main() -> None:
-    parser = argparse.ArgumentParser(description="Stage 6 character-register")
+    parser = argparse.ArgumentParser(description="Stage 5 character-register")
     parser.add_argument("project_dir", help="项目目录（CP 自建工作区 output_videos/<topic-en-slug>/）")
     args = parser.parse_args()
 
@@ -49,7 +49,7 @@ def main() -> None:
         return
 
     stub = {
-        "stage": 6,
+        "stage": 5,
         "characters": [],
         "instruction": (
             "agent 据 script.md 出场人物 + shot_decompose.json 列出所有出场角色，每个角色填 schema 并调 "
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/delivery-promise-lock.py` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 #!/usr/bin/env python3
-"""Stage 9b — delivery-promise-lock：交付承诺八类锁定 + motion_ratio 预估。
+"""Stage 9 — delivery-promise-lock：交付承诺八类锁定 + motion_ratio 预估。
 
 Usage:
   python3 scripts/delivery-promise-lock.py <project_dir>
@@ -32,7 +32,7 @@ def die(msg: str) -> None:
 
 
 def main() -> None:
-    parser = argparse.ArgumentParser(description="Stage 9b delivery-promise-lock")
+    parser = argparse.ArgumentParser(description="Stage 9 delivery-promise-lock")
     parser.add_argument("project_dir", help="项目目录（CP 自建工作区 output_videos/<topic-en-slug>/）")
     args = parser.parse_args()
 
@@ -52,7 +52,7 @@ def main() -> None:
         return
 
     stub = {
-        "stage": "9b",
+        "stage": "9",
         "promises": {
             "has_dialogue": None,
             "has_narration": None,
```

---

### Incident Patch 7: `29ed864e` (2026-09-15)
**Commit Message**: fix(expert-xhs): xhs-publish body 字面量 \n 发布前归一化为真实换行

采纳 skill-workshop 提案 xhs-publish-body-newline-normalize-20260915：
agent 在 bash 双引号里传 --body 时 \n 是字面量「反斜杠+n」，脚本原样
透传 desc 导致小红书正文全是 \n 文本（09-15 实发事故）。

- publish_xhs.py：新增 normalize_body_newlines()，main() 在长度校验 /
  extract_topics 之前归一化（字面量 \n 占 2 字符先归一再校验才准；
  紧贴 #话题 的字面量 \n 非空白，会污染话题名分词）；\r\n 先于 \n
  替换避免残留字面量 \r
- SKILL.md：--body 换行传参规范（✅ 多行字符串 / $'...'，❌ 双引号
  字面量 \n），紧邻既有 --body 禁传路径警告
- 新增 test_publish_xhs.py：6 个回归测试（归一化语义 ×4 + 话题提取
  顺序 ×1 + main() 接线端到端 ×1），全部通过

**File**: `crews/main/skills/expert-xhs/tools/xhs-publish/SKILL.md` (modified, +14/-0)
```diff
@@ -84,6 +84,20 @@ xhs-publish --mode video --title "笔记标题" --body "正文内容" --video vi
 
 > **⚠️ `--body` 必须传实际文字，不能传文件路径或 `$(cat file)`**：exec sandbox 禁用 `$(...)` 命令替换，`--body post.md` 也会被当字面量字符串。把正文直接硬编码进命令。
 
+> **⚠️ `--body` 换行用真实换行，不要在双引号里写 `\n`**：bash 双引号内的 `\n` 是字面量「反斜杠+n」，发布后正文会全是 `\n` 文本。脚本已兜底把字面量 `\n` 自动归一化为真实换行，但传参仍首选真换行：
+>
+> ```bash
+> # ✅ 多行字符串：引号内直接回车换行
+> xhs-publish --mode image --title "标题" --body "第一行
+> 第二行" --images img.jpg
+>
+> # ✅ $'...' 转义：\n 被 bash 解释为真实换行
+> xhs-publish --mode image --title "标题" --body $'第一行\n第二行' --images img.jpg
+>
+> # ❌ 普通双引号里的 \n 是字面量，发布后正文全是 \n 文本
+> xhs-publish --mode image --title "标题" --body "第一行\n第二行" --images img.jpg
+> ```
+
 成功输出：
 
 ```json
```

**File**: `crews/main/skills/expert-xhs/tools/xhs-publish/scripts/publish_xhs.py` (modified, +14/-0)
```diff
@@ -132,6 +132,16 @@ def cookie_str(cookie_dict: dict) -> str:
     return "; ".join(f"{k}={v}" for k, v in cookie_dict.items())
 
 
+def normalize_body_newlines(body: str) -> str:
+    r"""把 body 里字面量 \n / \r\n（反斜杠+字母序列）归一化为真实换行。
+
+    Agent 在 bash 双引号里传 --body 时，引号内 \n 是字面量「反斜杠+n」而非真实换行，
+    原样透传会被小红书当普通文本展示，正文全是 \n 文本。
+    先替换 \r\n 再替换 \n，避免残留字面量 \r；已是真实换行的内容不受影响。
+    """
+    return body.replace("\\r\\n", "\n").replace("\\n", "\n")
+
+
 def extract_topics(body: str, extra_topics: list[str] | None = None) -> list[dict]:
     """Extract #话题 from body text, return AiToEarn-format hash_tag list.
 
@@ -717,6 +727,10 @@ def main() -> None:
     parser.add_argument("--cookie-file", type=Path, help="Cookie file path")
     args = parser.parse_args()
 
+    # 字面量 \n 归一化须在长度校验 / 话题提取之前：字面量 \n 占 2 字符，先归一化长度才准；
+    # 且紧贴 #话题 的 \n（非空白字符）会污染 extract_topics 的分词
+    args.body = normalize_body_newlines(args.body)
+
     if len(args.title) > 20:
         err_exit("TITLE_TOO_LONG: title exceeds 20 characters")
     if len(args.body) > 1000:
```

**File**: `crews/main/skills/expert-xhs/tools/xhs-publish/scripts/test_publish_xhs.py` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+"""Regression tests for publish_xhs body newline normalization."""
+
+from __future__ import annotations
+
+import importlib.util
+import io
+import sys
+import unittest
+from pathlib import Path
+from unittest import mock
+
+
+SCRIPT_PATH = Path(__file__).with_name("publish_xhs.py")
+SPEC = importlib.util.spec_from_file_location("publish_xhs", SCRIPT_PATH)
+assert SPEC and SPEC.loader
+publish_xhs = importlib.util.module_from_spec(SPEC)
+SPEC.loader.exec_module(publish_xhs)
+
+
+class NormalizeBodyNewlinesTests(unittest.TestCase):
+    def test_converts_literal_backslash_n_to_real_newline(self) -> None:
+        # bash 双引号里 --body "第一行\n第二行" 收到的就是字面量反斜杠+n
+        self.assertEqual(
+            publish_xhs.normalize_body_newlines("第一行\\n第二行"),
+            "第一行\n第二行",
+        )
+
+    def test_converts_literal_crlf_without_leaving_stray_cr(self) -> None:
+        self.assertEqual(publish_xhs.normalize_body_newlines("a\\r\\nb"), "a\nb")
+
+    def test_keeps_real_newlines_untouched(self) -> None:
+        self.assertEqual(publish_xhs.normalize_body_newlines("a\nb"), "a\nb")
+
+    def test_handles_mixed_literal_and_real_newlines(self) -> None:
+        self.assertEqual(publish_xhs.normalize_body_newlines("a\nb\\nc"), "a\nb\nc")
+
+    def test_normalizing_before_extraction_keeps_topic_names_clean(self) -> None:
+        # 字面量 \n 是非空白字符：不先归一化，extract_topics 会把 "职场\n第二行" 整个当话题名
+        raw = "#职场\\n第二行正文"
+        topics = publish_xhs.extract_topics(
+            publish_xhs.normalize_body_newlines(raw), None
+        )
+        self.assertEqual([t["name"] for t in topics], ["职场"])
+
+
+class MainBodyNormalizationTests(unittest.TestCase):
+    def test_main_publishes_body_with_real_newlines(self) -> None:
+        # 端到端守住 main() 的接线：字面量 \n 的 --body 到达发布函数时已是真实换行
+        argv = [
+            "publish_xhs.py",
+            "--mode", "image",
+            "--title", "标题",
+            "--body", "第一行\\n第二行",
+            "--images", "img.jpg",
+        ]
+        captured: dict = {}
+
+        def fake_publish(client, cookie_dict, ua, title, body, images, topics, private):
+            captured["body"] = body
+            return {"ok": True, "note_id": "x", "url": "u"}
+
+        with (
+            mock.patch.object(sys, "argv", argv),
+            mock.patch.object(publish_xhs, "load_cookies", return_value=({}, "UA")),
+            mock.patch.object(publish_xhs, "publish_image_note", side_effect=fake_publish),
+            mock.patch.object(sys, "stdout", new=io.StringIO()),
+        ):
+            publish_xhs.main()
+
+        self.assertEqual(captured["body"], "第一行\n第二行")
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 8: `b8882691` (2026-09-14)
**Commit Message**: fix(skills): publish_xhs.py _shared 路径解析——适配 D8 拆分后的嵌套布局

旧写法 parent×3 按拆分前 skills/xhs-publish/scripts/ 布局上溯到 skills/，
拆分后（skills/expert-xhs/tools/xhs-publish/scripts/）只到 tools/，
relay_sign import 落空。改 parents[4] 精确解析到 skills/_shared。
2026-09-14 小红书实际发布验证通过；备份文件（与 HEAD 一致）已清理。

**File**: `crews/main/skills/expert-xhs/tools/xhs-publish/scripts/publish_xhs.py` (modified, +3/-2)
```diff
@@ -16,8 +16,9 @@
 
 import requests
 
-# relay_sign 在 skills/_shared/，本脚本在 skills/xhs-publish/scripts/
-sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "_shared"))
+# relay_sign 在 skills/_shared/，本脚本在 skills/expert-xhs/tools/xhs-publish/scripts/
+# 向上 5 层（parents[4]）解析到 skills/，再拼 _shared
+sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "_shared"))
 from relay_sign import xhs_headers  # noqa: E402
 
 LOGINS_DIR = Path.home() / ".openclaw" / "logins"
```

---

### Incident Patch 9: `aa1ba0d1` (2026-09-13)
**Commit Message**: fix(skills): twitter-post CJK 输入安全闸门 + 视频号登录对齐无头截 QR

twitter-post：CJK 正文禁用 type（逐字符按键流与 X Draft.js 异步处理竞态，
实测中文丢字+乱序），改 eval + execCommand insertText 整段插入；新增发布前
MATCH 校验闸门与发布后 profile 终验；「Something went wrong」先过闸门判因
（MISMATCH 重插 / MATCH 瞬时错误重试），替换原「优先精简正文」误判。含草稿
回填重复、占位符假警报、emoji 渲染为 img 三个坑。
expert-bd comment-engagement：X 评论同套 CJK 禁 type 规则，复用 twitter-post 闸门
browser-guide：微信视频号与公众号同模式无头截 QR 发用户扫码登录，渲染失败才
--headed 兜底；连带修正 docs 两处 spec 的旧说法

**File**: `crews/main/skills/expert-bd/workflows/comment-engagement.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
 
 ### Step 3: 逐内容互动
 
-对每个搜索到的内容，按配置的互动策略执行。通用要求：输入使用 `type` + `slowly: true`，不要用 `fill()`。
+对每个搜索到的内容，按配置的互动策略执行。通用要求：输入使用 `type` + `slowly: true`，不要用 `fill()`。**X/Twitter 例外**：评论/回复含中文/日文/韩文时**禁用 `type`**（camoufox-cli `type` 逐字符按键流与 X Draft.js 异步处理竞态，中文实测丢字+乱序）——按 `expert-twitter/tools/twitter-post/SKILL.md`「CJK 正文输入与校验闸门」改用 eval + `document.execCommand("insertText")` + 发布前校验 MATCH。X 回复应走平台表中 `twitter-post` Reply workflow，同样适用该闸门。
 
 #### 策略 A：直接留言（direct_comment）
 
```

**File**: `crews/main/skills/expert-twitter/tools/twitter-post/SKILL.md` (modified, +49/-16)
```diff
@@ -51,7 +51,35 @@ camoufox-cli --session twitter --persistent --headed --json open "https://x.com/
 ## 通用约束
 
 - 文件上传用 forked camoufox-cli 的 `upload` 命令（`camoufox-cli --session <s> --persistent --json upload <ref> <file>`，底层 Playwright `setInputFiles`，无需 DataTransfer hack）
-- 正文输入使用 `type` + `slowly: true`，不要用 `fill()`
+- 正文输入：**CJK（中文/日文/韩文）内容禁用 `type` 命令**——camoufox-cli `type` 逐字符按键流与 X 编辑器（Draft.js）异步处理存在竞态，中文实测丢字+乱序（2026-09-13 事故，首字被挪到结尾、中段整段消失，含分段 type+停顿仍错乱）。CJK 正文一律走下方「CJK 正文输入与校验闸门」的 eval + `document.execCommand("insertText")` 整段插入；纯 ASCII 短文本仍可用 `type`。**不要用 `fill()`**
+
+### CJK 正文输入与校验闸门
+
+含中文 / 日文 / 韩文的正文必须走本节的 insertText 方案 + 校验闸门；纯 ASCII 短文本可用 `type`，但**发布前校验闸门**与**发布后终验**对**所有正文**强制执行。
+
+**1. 清空回填草稿（open compose 后必做）**：X 重新打开 compose 页可能回填上次草稿，直接 insertText 会叠成两份：
+
+```bash
+camoufox-cli --session twitter --json eval '(function(){var el=document.querySelector("[data-testid=tweetTextarea_0]");if(!el){return "NO_BOX";}el.focus();var s=document.execCommand("selectAll",false);var d=document.execCommand("delete",false);return (s&&d)?"CLEARED":"CLEAR_FAILED";})()'
+```
+
+**2. 插入正文**（CJK 用 insertText 整段插入；正文含单引号或反斜杠时先转义，避免破坏命令引号）：
+
+```bash
+camoufox-cli --session twitter --json eval '(function(){var el=document.querySelector("[data-testid=tweetTextarea_0]");if(!el){return "NO_BOX";}el.focus();var ok=document.execCommand("insertText",false,"<正文>");return ok?"INSERTED":"EXEC_FAILED";})()'
+```
+
+**3. 发布前校验闸门（强制——点击 Post / Reply 之前必须执行，非 MATCH 一律不发布）**：
+
+```bash
+camoufox-cli --session twitter --json eval '(function(){var el=document.querySelector("[data-testid=tweetTextarea_0]");var t=el?el.innerText:"NO_BOX";var target="<正文>";return t===target?"MATCH":"MISMATCH:"+t;})()'
+```
+
+- **选择器必须精确匹配 `[data-testid=tweetTextarea_0]`**——`[data-testid^=tweetTextarea]` 前缀匹配会同时命中 `tweetTextarea_0_label`（占位符层），读到占位符文本、误报 MISMATCH。
+- **插入与校验必须分两次 eval 调用（间隔 ≥1s）**——写在同一 eval 里同步执行时，React 未及重渲染，innerText 会混入「What's happening?」占位符（占位符假警报）。MISMATCH 先看是否混有占位符再定性。
+- **emoji 是 `<img>` 不是丢字**：✅ 等 emoji 在 DOM 里渲染为 `<img>`，`innerText` 提取时只显示周围空格——校验按「剔除 img 节点后的文本」比对。
+
+**4. 发布后终验（强化，所有发布流程共用）**：点 Post 后导航 profile 页，读最新推文 `[data-testid=tweetText]` innerText 与 status 链接，与目标正文比对（剔除 emoji img 因素）后才算发布成功；不符立即走删除流程（More → Delete → confirmationSheetConfirm）。
 
 ### 字符计数规则（X 平台特殊）
 
@@ -88,22 +116,24 @@ camoufox-cli --session twitter --persistent --headed --json open "https://x.com/
 ```
 1. Navigate to https://x.com/compose/post
 2. Wait for the compose box to load
-3. Click into the text area and type the content
+3. 按「通用约束 → CJK 正文输入与校验闸门」输入正文（CJK 走 insertText；纯 ASCII 可 type）
    - Plain text only (no Markdown)
    - Max 280 characters for standard accounts
-4. Verify character count — trim if over limit
-5. **立即点击 "Post" 按钮——不要等待用户确认！**
-6. Wait for success confirmation (URL changes or "Your post was sent" toast)
-7. Extract and report the post URL
-8. **Parse stats**：
+4. **发布前校验闸门**：eval 校验正文返回 MATCH（通用约束 step 3；非 MATCH 一律不发布）
+5. Verify character count — trim if over limit
+6. **立即点击 "Post" 按钮——不要等待用户确认！**
+7. Wait for success confirmation (URL changes or "Your post was sent" toast)
+8. **发布后终验**（通用约束 step 4）：导航 profile 页比对最新推文正文，MATCH 才算发布成功；不符走删除重发
+9. Extract and report the post URL
+10. **Parse stats**：
    - snapshot eval: `JSON.stringify({
        retweet: document.querySelector('[data-testid="retweet"]')?.innerText,
        like: document.querySelector('[data-testid="like"]')?.innerText,
        reply: document.querySelector('[data-testid="reply"]')?.innerText,
        view: document.querySelector('[href*="/analytics"]')?.innerText,
        permalink: window.location.href
      })`
-9. Update frequency tracker
+11. Update frequency tracker
 ```
 
 ---
@@ -115,7 +145,7 @@ camoufox-cli --session twitter --persistent --headed --json open "https://x.com/
 2. Wait for the compose box to load
 3. Upload the image file using camoufox-cli upload（见下方选择器说明）
 4. Wait for image upload to complete (thumbnail / "Media" group appears)
-5.
```

**File**: `docs/browser-stack-replacement-spec-2026-07.md` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@
 | 0 | **全线使用 forked camoufox-cli**，放弃 patchright 的 patch |
 | 1 | 涉及登录的自媒体平台，**每平台一个且只一个持久化 session**，必须顺次使用（fail-first 队列，见 §fork 改造清单） |
 | 2 | browser-guide 约定：需要用户配合过验证码的，**必须用 camoufox-cli 有头模式** |
-| 3 | login-manager 约定：wx-mp 登录可无头启动截图发 QR；**wechat-channel（视频号）/ douyin / twitter / xhs（xhs-publish \| xhs-browse）/ weibo / zhihu / xianyu 登录必须 有头模式**（扫码登录页无法无头截 QR；有头扫码一律 `--viewport 1920x1080` 强制桌面比例，camoufox 默认移动端比例二维码看不全） |
+| 3 | login-manager 约定：wx-mp 与 wechat-channel（视频号）登录可无头启动截图发 QR（2026-09-13 实测视频号无头 QR 可渲染，与 wx-mp 同模式）；douyin / twitter / xhs（xhs-publish \| xhs-browse）/ weibo / zhihu / xianyu 登录仍必须 有头模式（扫码登录页无法无头截 QR；有头扫码一律 `--viewport 1920x1080` 强制桌面比例，camoufox 默认移动端比例二维码看不全） |
 | 4 | login-manager 导出 cookie **同时导出 UA**；所有用中央 cookie 的脚本导入 cookie 同时导入 UA |
 | 5 | **严禁浏览器方案导入 cookie**（登录失效必须重新登录流程，见 §profile 丢失处理） |
 | 6 | 恢复 twitter-interact 脚本操作模式（参考 AiToEarn 上游，见 §twitter-interact） |
@@ -154,7 +154,7 @@ spike 文档 L30-33 已设计：
 | `douyin-publish` | 由脚本方案改为浏览器自动化方案：forked cli 持久化 session `douyin` + upload；有头登录 |
 | `weibo-publish` | forked cli 持久化 session `weibo` + upload；有头登录 |
 | `zhihu-publish` | forked cli 持久化 session `zhihu` + upload；有头登录 |
-| `wechat-channels-publish` | forked cli 持久化 session `wechat-channel` + upload；有头手动扫码登录（`--headed --viewport 1920x1080`，视频号扫码页无法无头截 QR） |
+| `wechat-channels-publish` | forked cli 持久化 session `wechat-channel` + upload；无头截图扫码登录（截 QR PNG 发用户扫码，渲染失败才 `--headed` 兜底） |
 | `viral-chaser` | 适配修改后的login-manager中央cookie格式，尤其是导入Cookie的时候，要同时导入UA。 |
 | `wx-mp-hunter` | 见 §6 收编 |
 | `xianyu-ops` | forked cli 持久化 session `xianyu`；有头登录 |
```

**File**: `docs/platform-login-and-browser-spec.md` (modified, +3/-3)
```diff
@@ -153,9 +153,9 @@ camoufox-cli --session wx_mp --persistent --json identity export ~/.openclaw/log
 
 **其他场景默认走 camoufox 持久化 session，不显式指定有头/无头**——camoufox-cli 默认行为即可（headless 是默认）。
 
-**browser-guide §1-B 那句「wechat-channel / wx-mp 可无头启动截图发 QR；douyin / twitter / xhs / weibo / zhihu / xianyu / reddit / youtube 登录必须有头模式」要改**：
-- wx-mp 那个无头特例只属于 wx-mp-hunter/engagement 的自有体系，不属于 login-manager 体系，不应在 browser-guide 里和 wechat-channel 并列提。
-- wechat-channel（视频号）扫码登录页**无法无头截 QR**，必须 `--headed --viewport 1920x1080` 弹窗手动扫码（同 weibo / xianyu），按现行 wechat-channels-publish 技能自有 SKILL.md 走。
+**browser-guide §1-B 有头/无头规则（2026-09-13 实测修正）**：
+- wx-mp 无头特例只属于 wx-mp-hunter/engagement 的自有体系，不属于 login-manager 体系，browser-guide 里与 wechat-channel 并列标注「按各自专家包约定走无头截 QR」。
+- wechat-channel（视频号）与 wx-mp 同模式：**无头截 QR 发用户扫码**（2026-09-13 实测无头二维码完整渲染可扫；此前「视频号无法无头截 QR、必须 --headed」说法是早期失败残留，同日有头窗口的二维码加载失败实为代理 fake-ip 拦截，与有头/无头模式无关）。按 wechat-channels-publish / wx-channel-engagement 技能自有 SKILL.md 的无头截图扫码登录流走；无头渲染失败才 `--headed` 兜底。
 
 ## 8. published-track 流程 2A·自动更新（定时任务用）取数方案
 
```

**File**: `skills/browser-guide/SKILL.md` (modified, +2/-2)
```diff
@@ -29,8 +29,8 @@ camoufox-cli --session <name> [--persistent] [--headed] [--json] <command> [args
 
 - **`--session <name>`**：会话隔离单元，同名 session 共享一个 profile 目录。**涉及登录的平台用一个且只用一个持久化 session 名**。
 - **`--persistent`**：冻结指纹到 `~/.camoufox-cli/profiles/<name>/camoufox-cli.json`（首次生成后冻结）。持久化平台 session 必带；临时性 session（新闻等不登录站点）**不带**——走默认临时 profile，每次随机指纹，关闭自清。
-- **`--headed`**：有头模式。**需要用户配合过验证码、扫码、收短信的，或者填表场景，必须 `--headed`**。例外：**微信公众号 wx_mp** 可无头截含二维码区域截图发用户登录；**微信视频号 wechat-channel / 微博 / 闲鱼等扫码登录页无法无头截 QR，必须 `--headed` 弹窗让用户在浏览器里手动扫码**。其他场景，包括探活，都可以使用默认的无头模式。
-- **`--viewport <WxH>`**：固定窗口尺寸，如 `1920x1080`。camoufox 默认按指纹给**移动端窗口比例**，导致有头登录时二维码看不全；有头扫码登录（微博 / 闲鱼 / 视频号等）一律加 `--viewport 1920x1080` 强制桌面比例。业务无头操作无需此 flag。
+- **`--headed`**：有头模式。**需要用户配合过验证码、收短信的，或者填表场景，必须 `--headed`**。例外：**微信公众号 wx_mp 与微信视频号 wechat-channel** 可无头截图二维码发用户远程扫码（按各自专家包约定：截 QR PNG 发用户聊天窗口 → 用户手机扫码 → 轮询 URL 确认登录就位）；无头下二维码渲染失败（等 10s 仍无 QR img、截图空白或「加载失败」）才 teardown 换 `--headed` 弹窗兜底。**微博 / 闲鱼等扫码登录页维持必须 `--headed`** 弹窗让用户在浏览器里手动扫码。其他场景，包括探活，都可以使用默认的无头模式。
+- **`--viewport <WxH>`**：固定窗口尺寸，如 `1920x1080`。camoufox 默认按指纹给**移动端窗口比例**，导致有头登录时二维码看不全；`--headed` 兜底扫码登录（微博 / 闲鱼等）或窗口内容看不全时加 `--viewport 1920x1080` 强制桌面比例。业务无头操作无需此 flag。
 - **`--json`**：命令输出走 JSON 信封（`{ok, ...}` / `{error, ...}`），agent 解析稳定，推荐常带。
 - 命令集（含 `upload` / `identity export`）：
   `open / back / forward / reload / url / title / close / snapshot / click / fill / type / select / check / hover / press / text / eval / screenshot / pdf / scroll / wait / tabs / switch / close-tab / sessions / cookies / install / upload / identity`
```

---

### Incident Patch 10: `58edf56a` (2026-09-13)
**Commit Message**: fix(scripts): pnpm 版本守卫——对齐 openclaw 工作区 pin (pnpm 11)

pnpm 10.x 的 install CLI 不认 --fetch-retries（apply-addons.sh 依赖同步
直接 unknown argument 炸掉），新机装了 10.30.2 且 update.sh 零预检、
install.sh 的 install_pnpm() 只判断存在即跳过，报错完全没指向真因。

- update.sh: 步骤 1.5 加 pnpm 大版本预检（读 openclaw/package.json 的
  packageManager pin），缺失/过低给出明确升级命令；版本探测在 / 下做，
  避开 pnpm ≥11 manage-package-manager-versions 在带 pin 目录返回假版本
- install.sh: 定义 PNPM_VERSION（此前从未定义，真走到安装分支会执行
  npm install -g pnpm@ 空版本）；install_pnpm() 加 major 守卫，低于
  要求版本时升级而非跳过
- package.json: packageManager 从 4 月遗留的 10.30.2 对齐 11.2.2
  （hash 与 openclaw/package.json 同版本 pin 一致）

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 {
-  "packageManager": "pnpm@10.30.2+sha512.36cdc707e7b7940a988c9c1ecf88d084f8514b5c3f085f53a2e244c2921d3b2545bc20dd4ebe1fc245feec463bb298aecea7a63ed1f7680b877dc6379d8d0cb4"
+  "packageManager": "pnpm@11.2.2+sha512.36e6621fad506178936455e70247b8808ef4ec25797a9f437a93281a020484e2607f6a469a22e982987c3dbb8866e3071514ab10a4a1749e06edcd1ec118436f"
 }
```

**File**: `scripts/install.sh` (modified, +22/-3)
```diff
@@ -929,12 +929,31 @@ install_git() {
 # ═══════════════════════════════════════════════════════════════════
 # pnpm
 # ═══════════════════════════════════════════════════════════════════
+# 与 openclaw/package.json 的 packageManager pin 保持同步（apply-addons.sh 的依赖
+# 同步用了 pnpm 11 的 install CLI flags——如 --fetch-retries，pnpm 10.x 不认会炸）。
+# 升级 openclaw 换 pin 时此处要跟着改。
+PNPM_VERSION="${OPENCLAW_PNPM_VERSION:-11.2.2}"
+
+# 在无 packageManager pin 的目录下探测 pnpm 真实安装版本。
+# pnpm ≥11 默认开 manage-package-manager-versions，在带 pin 的目录里
+# `pnpm --version` 返回 pin 版本而非实际安装的版本，版本判断会被骗。
+pnpm_real_version() {
+    (cd / && pnpm --version 2>/dev/null) || true
+}
+
 install_pnpm() {
-    if command -v pnpm >/dev/null 2>&1; then
-        ui_success "pnpm already installed ($(pnpm --version 2>/dev/null || echo unknown))"
+    local required_major installed_major
+    required_major="${PNPM_VERSION%%.*}"
+    installed_major="$(pnpm_real_version | cut -d. -f1)"
+    if command -v pnpm >/dev/null 2>&1 && [ "${installed_major:-0}" -ge "$required_major" ]; then
+        ui_success "pnpm already installed ($(pnpm_real_version || echo unknown))"
         return 0
     fi
-    ui_info "Installing pnpm@${PNPM_VERSION} globally"
+    if command -v pnpm >/dev/null 2>&1; then
+        ui_info "Upgrading pnpm to ${PNPM_VERSION} (found $(pnpm_real_version || echo unknown); openclaw 工作区需要 pnpm ${required_major}+)"
+    else
+        ui_info "Installing pnpm@${PNPM_VERSION} globally"
+    fi
     # 用 corepack 路线（与 openclaw 仓 packageManager 对齐，最稳）
     if command -v corepack >/dev/null 2>&1; then
         run_required_step "Enabling corepack" corepack enable
```

**File**: `scripts/update.sh` (modified, +20/-0)
```diff
@@ -85,6 +85,26 @@ if [ ! -f "$PROJECT_ROOT/scripts/apply-addons.sh" ] || [ ! -d "$OPENCLAW_DIR" ];
   exit 1
 fi
 
+# ─── 1.5 pnpm 版本预检 ────────────────────────────────────────────────
+# openclaw 工作区按其 package.json 的 packageManager pin 要求 pnpm 大版本：
+# apply-addons.sh 的依赖同步传了 --fetch-retries 等 flag，只有 pnpm 11 的
+# install CLI 才认（pnpm 10.x 直接 unknown argument 炸掉）。
+# 注意 pnpm ≥11 默认开 manage-package-manager-versions，在带 pin 的目录里
+# `pnpm --version` 返回 pin 版本而非实际安装版本，须在无 pin 的 / 下探测。
+REQUIRED_PNPM_MAJOR="$(grep -m1 '"packageManager"' "$OPENCLAW_DIR/package.json" 2>/dev/null | grep -o 'pnpm@[0-9.]*' | head -1 | sed 's/^pnpm@//; s/\..*//')"
+: "${REQUIRED_PNPM_MAJOR:=11}"
+if ! command -v pnpm >/dev/null 2>&1; then
+  echo "❌ pnpm 未安装（openclaw 工作区需要 pnpm ${REQUIRED_PNPM_MAJOR}.x+）"
+  echo "   安装：npm install -g pnpm@${REQUIRED_PNPM_MAJOR} --registry=https://registry.npmmirror.com"
+  exit 1
+fi
+INSTALLED_PNPM_MAJOR="$( (cd / && pnpm --version 2>/dev/null) | cut -d. -f1)"
+if [ "${INSTALLED_PNPM_MAJOR:-0}" -lt "$REQUIRED_PNPM_MAJOR" ]; then
+  echo "❌ pnpm ${REQUIRED_PNPM_MAJOR}.x+ required (openclaw/package.json packageManager pin), found $(cd / && pnpm --version 2>/dev/null || echo unknown)"
+  echo "   升级：npm install -g pnpm@${REQUIRED_PNPM_MAJOR} --registry=https://registry.npmmirror.com"
+  exit 1
+fi
+
 ensure_openclaw_config() {
   if [ ! -f "$OPENCLAW_CONFIG_PATH" ]; then
     mkdir -p "$(dirname "$OPENCLAW_CONFIG_PATH")"
```

#### Recent Merged Pull Requests:
- **PR #477** (2026-09-20): v5.7.2 release (@bigbrother666sh)
- **PR #475** (2026-09-15): 5.71 release (@bigbrother666sh)
- **PR #474** (2026-08-30): 5.70 publish (@bigbrother666sh)
- **PR #472** (2026-08-15): fix: 5.6.6 (@bigbrother666sh)
- **PR #471** (2026-08-12): bug fix && docker deploy (@bigbrother666sh)
- **PR #470** (2026-08-10): 5.6.3 bugfix (@bigbrother666sh)
- **PR #469** (2026-08-07): update readme (@bigbrother666sh)
- **PR #468** (2026-08-06): v5.6.3：百炼主力 + Content Producer 正式发布 + 数据闭环 + install bug 修复 (@bigbrother666sh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
