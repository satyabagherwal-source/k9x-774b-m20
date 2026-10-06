# Forensic Learning Record (Deep Inspection): HBAI-Ltd/Toonflow-app

> **Canonical Artifact**: `07_PROJECT_LEARNING/hbai-ltd-toonflow-app-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HBAI-Ltd/Toonflow-app](https://github.com/HBAI-Ltd/Toonflow-app))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:44:51.834Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HBAI-Ltd/Toonflow-app`
- **Description**: Toonflow 是开源 AI 创作平台，融合无限画布、AI Agent 与可视化工作流，支持图像生成、视频生成、智能分镜及短剧创作。支持本地部署、自由接入模型，提供跨平台桌面端，并可通过 MCP 与插件扩展创作能力。Open-source AI creative platform with an infinite canvas, AI agents and visual workflows for image generation, video generation and filmmaking, with a canvas-based approach similar to LibTV and TapNow.
- **Primary Language / Ecosystem**: Vue
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 16498 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/server/src/core.ts`
```
import fg from "fast-glob";
import path from "node:path";
import { readFile, writeAtomic } from "@toonflow/file";

function fileNameToRoutePath(fileName: string): string {
  let routePath = fileName.replace(/\.(ts)$/, "");
  routePath = routePath.split(path.sep).join("/");
  routePath = routePath.replace(/\[([^\]]+)\]/g, (_, p1: string) => (p1.startsWith("...") ? "*" : `:${p1}`));
  if (routePath === "index") return "/";
  routePath = routePath.replace(/\/index$/, "");
  routePath = "/" + routePath.replace(/\/+/g, "/").replace(/\/$/, "");
  return routePath;
}

export default async function generateRouter(): Promise<void> {
  const sourceRoot = import.meta.dirname;
  const routerPath = path.join(sourceRoot, "router.ts");
  const entries = (await fg(["routes/**/*.ts"], { cwd: sourceRoot })).sort((a, b) => a.localeCompare(b));

  const importLines: string[] = [];
  const routeLines: string[] = [];

  entries.forEach((entry: string, i: number) => {
    const varName = `route${i + 1}`;
    let importPath = entry.replace(/\\/g, "/");
    if (!importPath.startsWith(".")) importPath = "./" + importPath;
    importPath = importPath.replace(/\.ts$/, "");
    importLines.push(`import ${varName} from "${importPath}";`);
    const routeKey = path.relative("routes", entry).replace(/\\/g, "/");
    const routePath = fileNameToRoutePath(routeKey);
    routeLines.push(`  app.use("/api${routePath}", ${varName});`);
  });

  let content = `import type { Express } from "express";\n\n`;
  content += `${importLines.join("\n")}\n\n`;
  content += `export default (app: Express) => {\n${routeLines.join("\n")}\n`;
  content += `}\n`;

  const current = await readFile(routerPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  // ACT: 比较完整产物，路由模板变化时也重新生成。
  if (current !== content) await writeAtomic(routerPath, content, { mode: 0o666 });
}

if (import.meta.main) await generateRouter();

```

### Core Architecture Module: `apps/server/src/routes/mcp/control/state.ts`
```
import { Router } from "express";
import { z } from "zod";
import u from "@/utils";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";

export default Router().post("/", validateFields({ connectionId: z.uuid(), revision: z.number().int().positive(), state: u.mcpControl.controlStateSchema }), (req, res) => {
  u.mcpControl.assertControlRequest(req);
  u.mcpControl.updateControlState(req.body.connectionId, req.body.revision, u.mcpControl.controlStateSchema.parse(req.body.state));
  res.json(success());
});

```

### Core Architecture Module: `apps/server/src/routes/tools/renderers.ts`
```
import { Router } from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";

export default Router().get("/", async (_req, res) => {
  const tools = await u.plugins.listTools();
  // ACT: 复用本次读取的版本；界面请求仍检查当前启用状态和源码版本。
  const renderers = tools.filter(tool => tool.enabled && !tool.loadError && tool.components.length)
    .map(tool => ({ name: tool.name, tools: tool.components, url: `/api/tools/client?name=${tool.name}&version=${tool.revision}` }));
  res.set("Cache-Control", "no-cache").json(success(renderers));
});

```

### Core Architecture Module: `apps/server/src/utils.ts`
```
import * as assets from "@/utils/assets";
import * as desktop from "@/utils/desktop";
import * as providerDebug from "@/utils/media/debug";
import * as mediaGeneration from "@/utils/media/generation";
import * as mediaProvider from "@/utils/media/provider";
import * as ffmpeg from "@/utils/ffmpeg";
import * as pluginInstall from "@/utils/plugins/install";
import conf, { removeLegacySettings } from "@/utils/conf";
import * as ai from "@/utils/ai";
import * as plugins from "@/utils/plugins/tools";
import * as nodePlugins from "@/utils/plugins/nodes";
import * as extPlugins from "@/utils/plugins/ext";
import * as agent from "@/agent";
import * as canvas from "@/agent/bridge/canvas";
import * as question from "@/agent/bridge/question";
import * as workspace from "@/utils/workspace";
import * as workspaceFile from "@/utils/workspace/files";
import * as skillFile from "@/utils/skills/files";
import * as mcpControl from "@/utils/mcp/control";
import * as mcpRuntime from "@/utils/mcp/runtime";
import * as teams from "@/utils/teams";
import * as a2aSettings from "@/agent/a2a/settings";
import * as personalization from "@/utils/personalization";
import * as mentionFiles from "@/agent/mentionFiles";

export default {
  assets,
  desktop,
  providerDebug,
  mediaGeneration,
  mediaProvider,
  ffmpeg,
  pluginInstall,
  conf,
  removeLegacySettings,
  ai,
  plugins,
  nodePlugins,
  extPlugins,
  agent,
  canvas,
  question,
  workspace,
  workspaceFile,
  skillFile,
  mcpControl,
  mcpRuntime,
  teams,
  a2aSettings,
  personalization,
  mentionFiles,
};

```

### Core Architecture Module: `apps/server/src/utils/ai/index.ts`
```
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";
import { getBuiltinModels, getBuiltinProviders } from "@earendil-works/pi-ai/providers/all";
import type { Context, Model } from "@earendil-works/pi-ai";
import { z } from "zod";
import conf from "@/utils/conf";
import { readReference } from "@/utils/media/generation";
import modelContextLimits from "@/utils/ai/modelContextLimits";

export { fetchProviderModels } from "@/utils/ai/models";
export { refreshProviderModels } from "@/utils/ai/initialize";

export const providerSchema = z.object({
  apiUrl: z.url({ protocol: /^https?$/ }),
  apiKey: z.string(),
  protocol: z.enum(["openai-completions", "openai-responses", "anthropic-messages"]),
  models: z.array(z.object({
    id: z.string(), label: z.string(),
    contextWindow: z.number().int().positive().optional(),
    maxOutputTokens: z.number().int().positive().optional(),
  })),
});

const builtinModels = getBuiltinProviders().flatMap(provider => getBuiltinModels(provider));

export function getModelLimits(providerId: string, model: z.infer<typeof providerSchema>["models"][number]) {
  const limits = modelContextLimits.find(item => item.id === model.id)
    ?? modelContextLimits.find(item => item.id instanceof RegExp && model.id.search(item.id) !== -1);
  if (limits) return { contextWindow: limits.contextWindow, maxTokens: limits.maxTokens };
  if (model.contextWindow != null && model.maxOutputTokens != null) {
    return { contextWindow: model.contextWindow, maxTokens: model.maxOutputTokens };
  }
  const matches = builtinModels.filter(item => item.id === model.id);
  const exact = matches.find(item => item.provider === providerId);
  const candidates = exact ? [exact] : matches;
  // ACT: 只精确匹配 ID；跨供应商同名参数逐项一致才采用，不猜别名。
  const contextWindow = candidates.every(item => item.contextWindow === candidates[0]?.contextWindow) ? candidates[0]?.contextWindow : undefined;
  const maxTokens = candidates.every(item => item.maxTokens === candidates[0]?.maxTokens) ? candidates[0]?.maxTokens : undefined;
  return {
    contextWindow: model.contextWindow ?? contextWindow ?? 262144,
    maxTokens: model.maxOutputTokens ?? maxTokens ?? 32768,
  };
}

export function getConfiguredModel(providerId: string, modelId: string) {
  const providers = conf.get("settings", {}).customProviders;
  const parsed = providerSchema.safeParse(Array.isArray(providers) ? providers.find(item => item?.id === providerId) : undefined);
  if (!parsed.success) throw Object.assign(new Error("请先在设置中配置模型供应商"), { status: 400 });
  const provider = parsed.data;
  const model = provider.models.find(item => item.id === modelId);
  if (!model) throw Object.assign(new Error("所选模型不存在，请重新选择"), { status: 400 });
  const baseUrl = new URL(provider.apiUrl);
  if (baseUrl.pathname === "/") baseUrl.pathname = "/v1";
  const limits = getModelLimits(providerId, model);
  return { provider, model: { ...model, contextWindow: limits.contextWindow, maxOutputTokens: limits.maxTokens }, baseUrl: baseUrl.href.replace(/\/+$/, "") };
}

export function listAiModels() {
  const providers = conf.get("settings", {}).customProviders;
  if (!Array.isArray(providers)) return [];
  return providers.flatMap(item => {
    const parsed = providerSchema.extend({ id: z.string().min(1), label: z.string() }).safeParse(item);
    if (!parsed.success) return [];
    const provider = parsed.data;
    return provider.models.filter(model => model.id.trim()).map(model => {
      const limits = getModelLimits(provider.id, model);
      return {
        providerId: provider.id, providerLabel: provider.label, protocol: provider.protocol, modelId: model.id, label: model.label,
        contextWindow: limits.contextWindow, maxOutputTokens: limits.maxTokens,
      };
    });
  });
}

const aiApis = {
  "openai-completions": openAICompletionsApi(),
  "openai-responses": openAIResponsesApi(),
  "anthropic-messages": anthropicMessagesApi(),
};

export const aiReferenceSchema = z.discriminatedUnion("dataType", [
  z.object({ dataType: z.literal("STRING"), value: z.string().max(1000000) }),
  z.object({ dataType: z.literal("IMAGE"), value: z.object({ url: z.string().min(1).max(4096), mimeType: z.string().startsWith("image/") }) }),
  z.object({ dataType: z.literal("VIDEO"), value: z.object({ url: z.string().min(1).max(4096), mimeType: z.string().startsWith("video/") }) }),
]);

export async function readAiReferences(directory: string | undefined, references: z.infer<typeof aiReferenceSchema>[], signal?: AbortSignal) {
  return Promise.all(references.map(async (item) => {
    if (item.dataType === "STRING") return { dataType: item.dataType, value: item.value };
    if (!directory) throw Object.assign(new Error("媒体参考需要工作目录"), { status: 400 });
    const media = await readReference(directory, { path: item.value.url, mimeType: item.value.mimeType }, item.dataType.toLowerCase(), signal);
    return { dataType: item.dataType, value: `data:${media.mimeType};base64,${media.data}` };
  }));
}

export function referenceContent(protocol: string, prompt: string, references: Awaited<ReturnType<typeof readAiReferences>>) {
  const textPart = (text: string) => ({ type: protocol === "openai-responses" ? "input_text" : "text", text });
  const content: object[] = [textPart(prompt)];
  references.forEach((item, index) => {
    content.push(textPart(`{{ref ${index + 1}}}${item.dataType === "STRING" ? `\n${item.value}` : ""}`));
    if (item.dataType === "STRING") return;
    if (protocol === "openai-completions") {
      content.push(item.dataType === "IMAGE"
        ? { type: "image_url", image_url: { url: item.value } }
        : { type: "video_url", video_url: { url: item.value } });
    } else if (protocol === "openai-responses") {
      const extension = item.value.slice(11, item.value.indexOf(";")).replace("quicktime", "mov");
      content.push(item.dataType === "IMAGE"
        ? { type: "input_image", image_url: item.value, detail: "auto" }
        : { type: "input_file", filename: `reference${index + 1}.${extension}`, file_data: item.value });
    } else {
      const separator = item.value.indexOf(",");
      content.push({
        type: item.dataType === "IMAGE" ? "image" : "document",
        source: { type: "base64", media_type: item.value.slice(5, item.value.indexOf(";")), data: item.value.slice(separator + 1) },
      });
    }
  });
  return content;
}

export function streamAi(
  configured: ReturnType<typeof getConfiguredModel>,
  context: Context,
  signal: AbortSignal,
  references: Awaited<ReturnType<typeof readAiReferences>> = [],
) {
  const { provider, model: configuredModel, baseUrl } = configured;
  const model: Model<typeof provider.protocol> = {
    id: configuredModel.id, name: configuredModel.label, provider: "toonflow", api: provider.protocol, baseUrl,
    reasoning: false, input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: configuredModel.contextWindow,
    maxTokens: configuredModel.maxOutputTokens,
  };
  // ACT: 不按模型名预判附件能力；按供应商协议传递，是否支持由上游接口决定。
  return aiApis[provider.protocol].streamSimple(model, context, {
    apiKey: provider.apiKey,
    signal,
    onPayload: references.length ? (payload) => {
      const body = payload as Record<string, unknown>;
      const field = provider.protocol === "openai-responses" ? "input" : "messages";
      const messages = body[field] as { role: string; content: unknown }[];
      // ACT: 后续 Anthropic 工具结果也使用 user 角色，附件只补充到最初的输入。
      const firstUser = messages.findIndex(message => message.role === "user");
      const attachmentContent = referenceContent(provider.protocol, "", references).slice(1);
      return { ...body, [field]: messages.map((message, index) => index === firstUser
        ? { ...message, content: [
          ...(Array.isArray(message.content) ? message.content : referenceContent(provider.protocol, String(message.content ?? ""), [])),
          ...attachmentContent,
        ] }
        : message) };
    } : undefined,
  });
}

```

### Core Architecture Module: `apps/server/src/utils/ai/initialize.ts`
```
import tfRouter from "@toonflow/providers/language/tfRouter";
import tfRouterMedia from "@toonflow/providers/media/tfRouter";
import conf from "@/utils/conf";
import { fetchProviderModels } from "@/utils/ai/models";
import { getMediaProviderApiKey, refreshMediaProviderModels } from "@/utils/media/provider";

let initialization: Promise<void> | undefined;

function normalizeApiKey(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/^Bearer(?:\s+|$)/i, "").trim() : "";
}

function getLanguageProvider(settings: Record<string, unknown>) {
  const providers = settings.customProviders;
  if (!Array.isArray(providers)) return;
  return providers.find(item => typeof item?.id === "string" && item.id.toLowerCase() === tfRouter.id.toLowerCase()
    && typeof item.apiUrl === "string" && URL.canParse(item.apiUrl) && new URL(item.apiUrl).origin === new URL(tfRouter.apiUrl).origin);
}

async function refreshLanguageModels(previousSettings?: Record<string, unknown>) {
  const provider = getLanguageProvider(conf.get("settings", {}));
  const apiKey = normalizeApiKey(provider?.apiKey);
  if (!apiKey || (previousSettings && apiKey === normalizeApiKey(getLanguageProvider(previousSettings)?.apiKey))) return;
  const models = await fetchProviderModels({ apiUrl: provider.apiUrl, protocol: provider.protocol, apiKey });
  if (!models.length) throw new Error("未获取到文本模型，保留原有列表");
  const current = conf.get("settings.customProviders");
  if (!Array.isArray(current)) return;
  const index = current.findIndex(item => item?.id === provider.id && item.apiUrl === provider.apiUrl
    && item.protocol === provider.protocol && item.apiKey === provider.apiKey);
  if (index === -1) return;
  const providers = current.map((item, itemIndex) => itemIndex === index ? { ...item, models } : item);
  conf.set("settings.customProviders", providers);
  return providers;
}

async function refreshMediaModels(previousSettings: Record<string, unknown> | undefined, errors: string[]) {
  const apiKey = getMediaProviderApiKey(tfRouterMedia.id);
  const configs = previousSettings?.mediaProviderConfigs as Record<string, { apiKey?: unknown }> | undefined;
  if (!apiKey || (previousSettings && apiKey === normalizeApiKey(configs?.[tfRouterMedia.id]?.apiKey))) return;
  let provider: Awaited<ReturnType<typeof refreshMediaProviderModels>> | undefined;
  // ACT: 同一供应商文件按类型串行保存，避免两个刷新读取相同版本后互相冲突。
  for (const type of ["video", "audio"] as const) {
    if (getMediaProviderApiKey(tfRouterMedia.id) !== apiKey) break;
    try { provider = await refreshMediaProviderModels(`${tfRouterMedia.id}.ts`, undefined, type, apiKey); }
    catch (error) {
      if (getMediaProviderApiKey(tfRouterMedia.id) !== apiKey) break;
      errors.push(`TF-Router ${type === "video" ? "视频" : "音频"}模型更新失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }
  return provider;
}

export async function refreshProviderModels(previousSettings?: Record<string, unknown>) {
  const errors: string[] = [];
  const [language, media] = await Promise.allSettled([refreshLanguageModels(previousSettings), refreshMediaModels(previousSettings, errors)]);
  for (const [result, label] of [[language, "文本"], [media, "媒体"]] as const) {
    if (result.status === "rejected") errors.push(`TF-Router ${label}模型更新失败：${result.reason instanceof Error ? result.reason.message : "未知错误"}`);
  }
  return {
    ...(language.status === "fulfilled" && language.value ? { customProviders: conf.get("settings.customProviders") as typeof language.value } : {}),
    ...(media.status === "fulfilled" && media.value ? { mediaProvider: media.value } : {}),
    ...(errors.length ? { modelRefreshErrors: errors } : {}),
  };
}

export default function initializeProviderModels() {
  // ACT: 每个进程启动时仅尝试一次；失败保留已有模型，下次启动再更新。
  return initialization ??= refreshProviderModels().then(result => {
    result.modelRefreshErrors?.forEach(error => console.warn(error));
  });
}

```

### Core Architecture Module: `apps/server/src/utils/ai/modelContextLimits.ts`
```
// ACT: 字符串优先精确匹配，正则按列表顺序匹配；两项上限均优先于用户配置和 Pi 内置模型目录。
// 单位为 token；2026-09-20 核对官方标准 API 上限，不采用批处理或 Beta 专属上限。
const modelContextLimits: { id: string | RegExp; contextWindow: number; maxTokens: number }[] = [
  // TF-Router
  { id: "deepseek-v4.1-flash", contextWindow: 1048576, maxTokens: 393216 },
  { id: /^deepseek-v4\.1-flash-[0-9]+$/, contextWindow: 1048576, maxTokens: 393216 },
  // DeepSeek：旧的 deepseek-chat / deepseek-reasoner 已停用，不覆盖中转站的同名模型。
  // https://api-docs.deepseek.com/quick_start/pricing/
  // https://api-docs.deepseek.com/api/create-chat-completion/
  // https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813/blob/main/config.json
  { id: "deepseek-flash", contextWindow: 1048576, maxTokens: 393216 },
  { id: "deepseek-v4-flash", contextWindow: 1048576, maxTokens: 393216 },
  { id: "deepseek-v4-pro", contextWindow: 1048576, maxTokens: 393216 },

  // OpenAI：各型号页面 https://developers.openai.com/api/docs/models/{模型 ID}
  { id: "gpt-5.5", contextWindow: 1050000, maxTokens: 128000 },
  { id: "gpt-5.4", contextWindow: 1050000, maxTokens: 128000 },
  { id: "gpt-5.4-pro", contextWindow: 1050000, maxTokens: 128000 },
  { id: "gpt-5.4-mini", contextWindow: 400000, maxTokens: 128000 },
  { id: "gpt-5.4-nano", contextWindow: 400000, maxTokens: 128000 },
  { id: "gpt-5.2", contextWindow: 400000, maxTokens: 128000 },
  { id: "gpt-5.1", contextWindow: 400000, maxTokens: 128000 },
  { id: "gpt-5", contextWindow: 400000, maxTokens: 128000 },
  { id: "gpt-5-mini", contextWindow: 400000, maxTokens: 128000 },
  { id: "gpt-4.1", contextWindow: 1047576, maxTokens: 32768 },
  { id: "gpt-4.1-mini", contextWindow: 1047576, maxTokens: 32768 },
  { id: "gpt-4.1-nano", contextWindow: 1047576, maxTokens: 32768 },
  { id: "gpt-4o", contextWindow: 128000, maxTokens: 16384 },

  // Claude：标准 Messages API，未采用 Batch API 的 300K 输出上限。
  // https://platform.claude.com/docs/en/models/overview
  // https://platform.claude.com/docs/en/build-with-claude/context-windows
  // https://platform.claude.com/docs/en/models/sonnet-4-6/overview
  // https://platform.claude.com/docs/es/models/sonnet-4-5/overview
  { id: "claude-fable-5-1", contextWindow: 1000000, maxTokens: 128000 },
  { id: "claude-opus-5", contextWindow: 1000000, maxTokens: 128000 },
  { id: "claude-sonnet-5", contextWindow: 1000000, maxTokens: 128000 },
  { id: "claude-opus-4-6", contextWindow: 1000000, maxTokens: 128000 },
  { id: "claude-sonnet-4-6", contextWindow: 1000000, maxTokens: 128000 },
  { id: "claude-sonnet-4-5", contextWindow: 200000, maxTokens: 64000 },
  { id: "claude-sonnet-4-5-20250929", contextWindow: 200000, maxTokens: 64000 },
  { id: "claude-haiku-4-5", contextWindow: 200000, maxTokens: 64000 },
  { id: "claude-haiku-4-5-20251001", contextWindow: 200000, maxTokens: 64000 },

  // 通义千问：文档区分了总上下文、最大输入和最大输出，取总上下文及最大输出。
  // https://help.aliyun.com/zh/model-studio/qwen3-5-plus
  // https://help.aliyun.com/zh/model-studio/qwen3-5-397b-a17b
  // https://help.aliyun.com/zh/model-studio/qwen3-5-35b-a3b
  // https://help.aliyun.com/zh/model-studio/qwen3-5-27b
  { id: "qwen3.5-plus", contextWindow: 1000000, maxTokens: 65536 },
  { id: "qwen3.5-plus-2026-04-20", contextWindow: 1000000, maxTokens: 65536 },
  { id: "qwen3.5-397b-a17b", contextWindow: 262144, maxTokens: 65536 },
  { id: "qwen3.5-35b-a3b", contextWindow: 262144, maxTokens: 65536 },
  { id: "qwen3.5-27b", contextWindow: 262144, maxTokens: 65536 },

  // GLM：https://docs.z.ai/guides/llm/glm-5 、https://docs.z.ai/guides/llm/glm-4.7
  { id: "glm-5", contextWindow: 200000, maxTokens: 128000 },
  { id: "glm-4.7", contextWindow: 200000, maxTokens: 128000 },

  // Kimi：当前在售型号；输入与输出共用窗口，实际输出上限需扣除 prompt_tokens。
  // https://platform.kimi.ai/docs/models
  // https://platform.kimi.ai/docs/api/models-overview
  // https://www.kimi.ai/help/kimi-api/api-troubleshooting
  { id: "kimi-k3", contextWindow: 1048576, maxTokens: 1048576 },
  { id: "kimi-k2.7-code", contextWindow: 262144, maxTokens: 262144 },
  { id: "kimi-k2.7-code-highspeed", contextWindow: 262144, maxTokens: 262144 },
  { id: "kimi-k2.6", contextWindow: 262144, maxTokens: 262144 },

  // 火山方舟：按规格表的上下文窗口和最大回答填写，k 按 1024 换算，不叠加思维链。
  // https://docs.volcengine.com/docs/ark/model-list?lang=zh
  { id: "doubao-seed-evolving", contextWindow: 1048576, maxTokens: 262144 },
  { id: "doubao-seed-2-1-pro-260915", contextWindow: 1048576, maxTokens: 262144 },
  { id: "doubao-seed-2-1-pro-260628", contextWindow: 262144, maxTokens: 262144 },
  { id: "doubao-seed-2-1-turbo-260628", contextWindow: 262144, maxTokens: 262144 },
  { id: "doubao-seed-2-0-lite-260428", contextWindow: 262144, maxTokens: 131072 },
  { id: "doubao-seed-2-0-mini-260428", contextWindow: 262144, maxTokens: 131072 },
  { id: "doubao-seed-2-0-pro-260215", contextWindow: 262144, maxTokens: 131072 },
  { id: "doubao-seed-2-0-lite-260215", contextWindow: 262144, maxTokens: 131072 },
  { id: "doubao-seed-2-0-mini-260215", contextWindow: 262144, maxTokens: 131072 },
  { id: "doubao-seed-2-0-code-preview-260215", contextWindow: 262144, maxTokens: 131072 },
  { id: "doubao-seed-character-260628", contextWindow: 131072, maxTokens: 32768 },
  { id: "doubao-seed-1-8-251228", contextWindow: 262144, maxTokens: 32768 },
  { id: "doubao-seed-code-preview-251028", contextWindow: 262144, maxTokens: 32768 },
  { id: "doubao-seed-character-251128", contextWindow: 131072, maxTokens: 32768 },
  { id: "doubao-seed-1-6-flash-250828", contextWindow: 262144, maxTokens: 32768 },
  { id: "doubao-seed-translation-250915", contextWindow: 4096, maxTokens: 3072 },
  { id: "doubao-seed-1-6-vision-250815", contextWindow: 262144, maxTokens: 32768 },
  { id: "doubao-seed-1-6-250615", contextWindow: 262144, maxTokens: 32768 },
  { id: "doubao-seed-1-6-251015", contextWindow: 262144, maxTokens: 32768 },
  { id: "doubao-seed-1-6-flash-250615", contextWindow: 262144, maxTokens: 32768 },
  { id: "doubao-1-5-pro-32k-250115", contextWindow: 131072, maxTokens: 16384 },
  { id: "doubao-1-5-pro-32k-character-250715", contextWindow: 32768, maxTokens: 12288 },
  { id: "doubao-1-5-lite-32k-250115", contextWindow: 32768, maxTokens: 12288 },
  { id: "glm-5-3-flash-260828", contextWindow: 1048576, maxTokens: 131072 },
  { id: "glm-5-2-260617", contextWindow: 1048576, maxTokens: 131072 },
  { id: "glm-4-7-251222", contextWindow: 204800, maxTokens: 131072 },
  { id: "deepseek-v4-1-flash-260910", contextWindow: 1048576, maxTokens: 393216 },
  { id: "deepseek-v4-pro-ga-260813", contextWindow: 1048576, maxTokens: 393216 },
  { id: "deepseek-v4-flash-ga-260731", contextWindow: 1048576, maxTokens: 393216 },
  { id: "deepseek-v4-pro-260425", contextWindow: 1048576, maxTokens: 393216 },
  { id: "deepseek-v4-flash-260425", contextWindow: 1048576, maxTokens: 393216 },

  // Agnes：当前正式版 API；512K / 1M 分别按 512 / 1024 个 1024 token 换算。
  // https://www.agnes-ai.com/zh-Hans/docs/agnes-30-flash
  // https://www.agnes-ai.com/zh-Hans/docs/agnes-25-flash
  // https://www.agnes-ai.com/zh-Hans/docs/agnes-25-pro
  { id: "agnes-3.0-flash", contextWindow: 524288, maxTokens: 65536 },
  { id: "agnes-2.5-flash", contextWindow: 524288, maxTokens: 65536 },
  { id: "agnes-2.5-pro", contextWindow: 1048576, maxTokens: 65536 },
];

export default modelContextLimits;

```

### Core Architecture Module: `apps/server/src/utils/ai/models.ts`
```
import { t } from "@/lib/i18n";
import { z } from "zod";

const modelSchema = z.object({
  id: z.string().optional(), name: z.string().optional(),
  display_name: z.string().optional(), displayName: z.string().optional(),
  inputTokenLimit: z.number().int().positive().optional(),
  outputTokenLimit: z.number().int().positive().optional(),
});

export async function fetchProviderModels({ apiUrl, protocol, apiKey }: { apiUrl: string; protocol: string; apiKey: string }) {
  const url = new URL(apiUrl);
  if (url.pathname === "/") url.pathname = "/v1";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/models`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (protocol === "anthropic-messages") {
    headers["anthropic-version"] = "2023-06-01";
    headers["x-api-key"] = apiKey;
    url.searchParams.set("limit", "1000");
  } else if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const models = new Map<string, { id: string; label: string; contextWindow?: number; maxOutputTokens?: number }>();
  const cursors = new Set<string>();
  const signal = AbortSignal.timeout(30000);
  while (true) {
    const response = await fetch(url, { headers, signal, redirect: "error" });
    if (!response.ok) throw new Error(t`获取模型列表失败（HTTP ${response.status}），请检查 API 地址、协议和密钥`);
    const result = z.object({
      data: z.array(modelSchema),
      has_more: z.boolean().optional(), last_id: z.string().nullable().optional(),
    }).parse(await response.json());
    const items = result.data;
    for (const item of items) {
      const id = item.id?.trim();
      if (!id) throw new Error("模型列表包含无效的模型 ID");
      models.set(id, { id, label: item.display_name || item.displayName || id, contextWindow: item.inputTokenLimit, maxOutputTokens: item.outputTokenLimit });
    }
    const cursor = protocol === "anthropic-messages" && result.has_more ? result.last_id : undefined;
    if (protocol === "anthropic-messages" && result.has_more && !cursor) throw new Error("模型列表缺少分页游标");
    if (!cursor) break;
    if (cursors.has(cursor)) throw new Error("模型列表分页游标重复");
    cursors.add(cursor);
    url.searchParams.set("after_id", cursor);
  }
  return [...models.values()];
}

```

### Core Architecture Module: `apps/server/src/utils/assets/index.ts`
```
import { mkdir, realpath } from "@toonflow/file";
import { dirname, join } from "node:path";
import conf from "@/utils/conf";

export async function getAssetsDirectory() {
  const directory = join(dirname(conf.path), "assets");
  await mkdir(directory, { recursive: true });
  return realpath(directory);
}

```

### Core Architecture Module: `apps/server/src/utils/conf/index.ts`
```
import conf from "conf";
import { mkdirSync, realpathSync } from "@toonflow/file";
import { resolve } from "node:path";
import tfRouter from "@toonflow/providers/language/tfRouter";
import type { RemoteTeam } from "@/utils/teams";
import type { A2aSettings } from "@/agent/a2a/settings";
import type { desktopUpdateAttempt } from "@/types/desktop";

const autoInstallProviders = [tfRouter];
const dataDirectory = process.env.TOONFLOW_DATA_DIR ?? resolve(import.meta.dirname, "../../../../../data");
mkdirSync(dataDirectory, { recursive: true });
const configDirectory = realpathSync(dataDirectory);
process.env.TOONFLOW_DATA_DIR = configDirectory;

const config = new conf<{ settings: Record<string, unknown>; toolConfigs: Record<string, Record<string, unknown>>; nodeConfigs: Record<string, Record<string, unknown>>; extConfigs: Record<string, Record<string, unknown>>; remoteConnections: Record<string, RemoteTeam>; a2a: A2aSettings; desktopUpdateAttempt: desktopUpdateAttempt }>({
  cwd: configDirectory,
  configName: "settings",
  configFileMode: 0o600,
  watch: true,
});

export function removeLegacySettings(settings: Record<string, unknown>) {
  let changed = false;
  // ACT: 只清理已废弃字段，保留其他设置和插件配置。
  for (const [record, key] of [[settings, "developerConfirmed"], [settings.general, "systemPrompt"], [settings.stores, "toonflow.developer"]] as const) {
    if (record && typeof record === "object" && !Array.isArray(record) && Object.hasOwn(record, key)) {
      Reflect.deleteProperty(record, key);
      changed = true;
    }
  }
  return changed;
}

const settings = config.get("settings", {});
if (removeLegacySettings(settings)) config.set("settings", settings);

// ACT: 仅初始化尚未配置的文本供应商；已有列表（包括用户清空的列表）保持原样。
if (!config.has("settings.customProviders")) {
  config.set("settings.customProviders", autoInstallProviders.map(({ id, label, version, apiUrl, protocol, models }) =>
    ({ id, label, version, apiUrl, protocol, models, apiKey: "" })));
}

export default config;

```

### Core Architecture Module: `apps/server/src/utils/desktop/index.ts`
```
import { basename } from "node:path";
import { file } from "@toonflow/file/bun";
import type { Request } from "express";
import conf from "@/utils/conf";
import type { DesktopRuntime, desktopUpdateAttempt, updateSnapshot } from "@/types/desktop";

const updateBaseUrls = {
  official: "https://api.toonflow.net/web/version/desktopUpdates",
  github: "https://github.com/HBAI-Ltd/Toonflow-app/releases/latest/download",
};
const updateRuntimeId = crypto.randomUUID();
let cancelledUpdateAttempt: string | undefined;

function getInstallFailure(local: Awaited<ReturnType<DesktopRuntime["updater"]["getLocalInfo"]>>, applyError?: string): updateSnapshot["installFailure"] {
  if (local.channel === "dev") return;
  const attempt = conf.get("desktopUpdateAttempt");
  if (!attempt) return;
  if (typeof attempt !== "object" || ![attempt.attemptId, attempt.runtimeId, attempt.channel, attempt.targetVersion, attempt.targetHash]
    .every(value => typeof value === "string" && value.length > 0 && value.length <= 512)
    || (attempt.failure !== undefined && typeof attempt.failure !== "string")) {
    try { conf.delete("desktopUpdateAttempt"); }
    catch (error) { console.error("清理无效更新核验记录失败：", error); }
    return;
  }
  if (attempt.attemptId === cancelledUpdateAttempt) {
    // 取消时可能遇到短暂写锁；后续只读回查继续清理，不能误报为安装失败。
    try { conf.delete("desktopUpdateAttempt"); }
    catch (error) { console.error("清理已取消更新核验记录失败：", error); }
    return;
  }
  // ACT: 页面刷新不算重启；由进程内标识区分交接中与下一次实际启动。
  if (attempt.runtimeId === updateRuntimeId && !attempt.failure && !applyError) return;
  try {
    Bun.semver.order(attempt.targetVersion, attempt.targetVersion);
  } catch {
    try { conf.delete("desktopUpdateAttempt"); }
    catch (error) { console.error("清理无效更新核验记录失败：", error); }
    return;
  }
  let installedNewerVersion = false;
  try { installedNewerVersion = Bun.semver.order(local.version, attempt.targetVersion) > 0; }
  catch { /* 本地版本异常也属于核验失败，保留合法的更新目标。 */ }
  if (local.channel === attempt.channel && (local.version === attempt.targetVersion && local.hash === attempt.targetHash
    || installedNewerVersion)) {
    try { conf.delete("desktopUpdateAttempt"); }
    catch (error) { console.error("清理已完成更新核验记录失败：", error); }
    return;
  }
  const message = attempt.failure || applyError || "更新重启后的版本或构建号与目标不一致，请下载完整安装包重新安装。";
  if (!attempt.failure) {
    // ACT: 磁盘满或权限异常时，已有目标仍足以显示完整安装指引，补记失败不能阻断状态查询。
    try { conf.set("desktopUpdateAttempt", { ...attempt, failure: message }); }
    catch (error) { console.error("保存更新核验失败信息失败：", error); }
  }
  return {
    attemptId: attempt.attemptId,
    targetVersion: attempt.targetVersion,
    targetHash: attempt.targetHash,
    currentVersion: local.version,
    currentHash: local.hash,
    message,
    downloadUrl: "https://github.com/HBAI-Ltd/Toonflow-app/releases/latest",
  };
}

interface DesktopState {
  selectedProviderFile?: { token: string; path: string };
  checkingUpdate: boolean;
  downloadingUpdate: boolean;
  applyingUpdate: boolean;
  updateHandoffComplete?: boolean;
  updateError: string;
  checkedBaseUrl?: string;
  lastBaseUrl?: string;
}

export function isValidUpdateUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 2048 || value.trim() !== value || !URL.canParse(value)) return false;
  const url = new URL(value);
  return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password && !url.search && !url.hash;
}

function getUpdateBaseUrl(): string {
  const settings = conf.get("settings", {});
  if (settings.desktopUpdateSource === "github") return updateBaseUrls.github;
  if (settings.desktopUpdateSource === "custom" && isValidUpdateUrl(settings.desktopUpdateCustomUrl)) return settings.desktopUpdateCustomUrl;
  return updateBaseUrls.official;
}

async function withUpdateSource<T>(updater: DesktopRuntime["updater"], updateBaseUrl: string, run: () => Promise<T>) {
  // ACT: 两版 Mac SDK 和 Windows 更新器均返回缓存对象；只在互斥的更新操作期间覆盖地址。
  const info = await updater.getLocalInfo();
  const baseUrl = info.baseUrl;
  info.baseUrl = updateBaseUrl;
  try {
    return await run();
  } finally {
    info.baseUrl = baseUrl;
  }
}

async function assertUpdateVersion(updater: DesktopRuntime["updater"], state: DesktopState) {
  const version = updater.updateInfo()?.version;
  if (!version) return;
  const local = await updater.getLocalInfo();
  if (Bun.semver.order(version, local.version) >= 0) return;
  state.checkedBaseUrl = undefined;
  throw new Error(`更新源版本 ${version} 早于当前版本 ${local.version}，已阻止降级`);
}

function getDesktopState(req: Request): DesktopState {
  return req.app.locals.desktopState ??= { checkingUpdate: false, downloadingUpdate: false, applyingUpdate: false, updateError: "" };
}

export function getDesktopRuntime(req: Request): DesktopRuntime {
  return req.app.locals.desktop;
}

export async function selectProviderFile(req: Request) {
  const path = await getDesktopRuntime(req).selectProviderFile();
  if (!path) return null;
  if (!/\.ts$/i.test(path)) throw Object.assign(new Error("请选择 .ts 供应商文件"), { status: 400 });
  const selected = { token: crypto.randomUUID(), path };
  getDesktopState(req).selectedProviderFile = selected;
  return { token: selected.token, name: basename(path) };
}

export async function readProviderFile(req: Request, token: string) {
  const selected = getDesktopState(req).selectedProviderFile;
  if (!selected || token !== selected.token) throw Object.assign(new Error("请重新选择并授权供应商文件"), { status: 403 });
  const providerFile = file(selected.path);
  if (!(await providerFile.exists())) throw Object.assign(new Error("供应商文件已被移动或删除，请重新选择"), { status: 404 });
  if (providerFile.size > 2 * 1024 * 1024) throw Object.assign(new Error("供应商文件不能超过 2 MB"), { status: 400 });
  return { name: basename(selected.path), source: await providerFile.text(), lastModified: providerFile.lastModified };
}

export async function getDesktopUpdate(req: Request): Promise<updateSnapshot> {
  const { updater } = getDesktopRuntime(req);
  const state = getDesktopState(req);
  const local = await updater.getLocalInfo();
  const { version, channel, hash } = local;
  // ACT: Intel 1.18.1 首次检查前没有状态，旧清单也可能缺少状态字段。
  const update = updater.updateInfo();
  const updateBaseUrl = getUpdateBaseUrl();
  const validUpdate = state.checkedBaseUrl === updateBaseUrl;
  const applyError = state.applyingUpdate && state.updateHandoffComplete ? update?.error : undefined;
  const installFailure = getInstallFailure(local, applyError);
  if (applyError) state.applyingUpdate = false;
  // ACT: 安装失败跨重启保留，不被切换更新源或普通联网错误覆盖。
  const error = installFailure?.message || (state.lastBaseUrl === updateBaseUrl ? state.updateError || (validUpdate ? update?.error || "" : "") : "") || update?.installError || "";
  return {
    version, channel, hash,
    latestVersion: validUpdate ? update?.version || "" : "",
    latestHash: validUpdate ? update?.hash || "" : "",
    error,
    installFailure,
    updateAvailable: !installFailure && validUpdate && (update?.updateAvailable ?? false),
    updateReady: !installFailure && validUpdate && (update?.updateReady ?? false),
    updating: state.downloadingUpdate || state.applyingUpdate,
    canUpdate: typeof updater.downloadUpdate === "function" && typeof updater.applyUpdate === "function",
  };
}

export async function checkDesktopUpdate(req: Request): Promise<void> {
  const { updater } = getDesktopRuntime(req);
  const state = getDesktopState(req);
  if (state.checkingUpdate || state.downloadingUpdate || state.applyingUpdate)
    throw Object.assign(new Error("更新操作正在执行，请稍后再试。"), { status: 409 });
  state.checkingUpdate = true;
  state.updateError = "";
  const updateBaseUrl = getUpdateBaseUrl();
  state.checkedBaseUrl = undefined;
  state.lastBaseUrl = updateBaseUrl;
  try {
    state.updateError = (await withUpdateSource(updater, updateBaseUrl, () => updater.checkForUpdate())).error || "";
    if (!state.updateError) {
      await assertUpdateVersion(updater, state);
      state.checkedBaseUrl = updateBaseUrl;
    }
  } catch (error) {
    state.updateError = String(error);
  } finally {
    state.checkingUpdate = false;
  }
}

export async function downloadDesktopUpdate(req: Request): Promise<void> {
  const { updater } = getDesktopRuntime(req);
  const state = getDesktopState(req);
  if (!updater.downloadUpdate || !updater.applyUpdate)
    throw Object.assign(new Error("当前客户端不支持应用内更新，请下载安装包。"), { status: 400 });
  if (state.checkingUpdate || state.downloadingUpdate || state.applyingUpdate)
    throw Object.assign(new Error("更新操作正在执行，请稍后再试。"), { status: 409 });
  const updateBaseUrl = getUpdateBaseUrl();
  if (state.checkedBaseUrl !== updateBaseUrl)
    throw Object.assign(new Error("更新源已切换，请重新检查更新。"), { status: 400 });
  if (!updater.updateInfo()?.updateAvailable)
    throw Object.assign(new Error("请先检查并确认有可用更新。"), { status: 400 });
  state.downloadingUpdate = true;
  state.updateError = "";
  try {
    await withUpdateSource(updater, updateBaseUrl, () => updater.downloadUpdate!());
    const update = updater.updateInfo();
    if (update?.error || !update?.updateReady) throw new Error(update?.error || "更新包尚未准备完成，请重试。");
    await assertUpdateVersion(updater, state);
  } catch (error) {
    state.updateError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    state.downloadingUpdate = false;
  }
}

export async function applyDesktopUpdate(req: Request): Promise<void> {
  const { updater } = getDesktopRuntime(req);
  const state = getDesktopState(req);
  if (!updater.downloadUpdate || !updater.applyUpdate)
    throw Object.assign(new Error("当前客户端不支持应用内更新，请下载安装包。"), { status: 400 });
  if (state.checkingUpdate || state.downloadingUpdate || state.applyingUpdate)
    throw Object.assign(new Error("更新操作正在执行，请稍后再试。"), { status: 409 });
  const updateBaseUrl = getUpdateBaseUrl();
  if (state.checkedBaseUrl !== updateBaseUrl)
    throw Object.assign(new Error("更新源已切换，请重新检查更新。"), { status: 40
```

### Core Architecture Module: `apps/server/src/utils/ffmpeg/index.ts`
```
import { t, translateError, translateMessage } from "@/lib/i18n";
import { dirname, join } from "node:path";
import { build, createFfmpeg, downloadSources, getToolStatus, installFfmpeg, target } from "@toonflow/ffmpeg";
import type { DownloadState, FfmpegMode, SourceId } from "@toonflow/ffmpeg";
import conf from "@/utils/conf";

export { executeRemoteFfmpeg } from "@toonflow/ffmpeg";

const directory = join(dirname(conf.path), "ffmpeg", target);
let download: DownloadState = { phase: "idle", received: 0 };
let downloadError: unknown;
// ACT: 沿用 server 单进程模型，每次只下载一套程序；不持久化运行中的任务。
let controller: AbortController | undefined;
const requiredListeners = new Set<() => void>();

export function onRequired(listener: () => void) {
  requiredListeners.add(listener);
  return () => { requiredListeners.delete(listener); };
}

export async function createWorkspaceFfmpeg(cwd: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { tools } = await getStatus();
  signal?.throwIfAborted();
  if (!tools.ffmpeg.path || tools.ffmpeg.error || !tools.ffprobe.path || tools.ffprobe.error) {
    for (const listener of requiredListeners) listener();
    throw Object.assign(new Error("当前操作需要 FFmpeg，请在插件市场下载安装或配置可用版本后重试。"), {
      name: "FfmpegRequiredError", code: "FFMPEG_REQUIRED", status: 424,
    });
  }
  const ffmpeg = createFfmpeg(cwd);
  ffmpeg.setFfmpegPath(tools.ffmpeg.path);
  ffmpeg.setFfprobePath(tools.ffprobe.path);
  return ffmpeg;
}

export function getProgress() {
  return download.error ? { ...download, error: translateError(downloadError ?? download.error) } : download;
}

export async function getStatus() {
  const raw = conf.get("settings", {}).ffmpeg;
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const mode: FfmpegMode = value.mode === "download" || value.mode === "system" ? value.mode : "auto";
  const source = downloadSources.find(item => item.id === value.source)?.id ?? "npmmirror";
  const tools = await getToolStatus(directory, mode, translateError);
  return {
    platform: process.platform,
    arch: process.arch,
    target,
    supported: Boolean(build),
    directory,
    version: build?.version ?? "",
    sources: downloadSources.map(({ id, label, description, available, homepage }) => ({ id, label: translateMessage(label), description: translateMessage(description), available, homepage })),
    config: { mode, source },
    tools: { ffmpeg: { ...tools.ffmpeg, error: tools.ffmpeg.error ? translateMessage(tools.ffmpeg.error) : null },
      ffprobe: { ...tools.ffprobe, error: tools.ffprobe.error ? translateMessage(tools.ffprobe.error) : null } },
    download: getProgress(),
  };
}

export function startDownload(source: SourceId) {
  if (controller) throw Object.assign(new Error("正在下载，请等待完成或取消后再试"), { status: 409 });
  if (!downloadSources.some(item => item.id === source && item.available)) throw Object.assign(new Error("此下载源暂不可用，请选择其他下载源"), { status: 400 });
  if (!build) throw Object.assign(new Error(t`暂不支持自动下载 ${target} 版本`), { status: 400 });
  const active = new AbortController();
  controller = active;
  download = { phase: "downloading", received: 0 };
  downloadError = undefined;
  void installFfmpeg(directory, source, active.signal, state => { download = state; }).then(() => {
    download = { phase: "completed", received: 0 };
  }).catch((error: unknown) => {
    downloadError = error;
    download = active.signal.aborted
      ? { phase: "cancelled", received: 0 }
      : { phase: "error", received: 0, error: error instanceof Error ? error.message : String(error) };
  }).finally(() => { controller = undefined; });
  return getProgress();
}

export function cancelDownload() {
  if (download.phase !== "installing") controller?.abort();
  return getProgress();
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #295** (2026-10-02): **Featured on OpenMicroDrama (English write-up of this project)**
  *Symptoms*: 你好！我们做了一个英文的 AI 短剧开源项目导航 OpenMicroDrama，把 HBAI-Ltd/Toonflow-app 收录了，并写了一份英文介绍和快速上手：  https://openmicrodrama.com/projects/hbai-ltd-toonflow-app  很多海外创作者看不懂中文 README，这页可以帮他们找到并用上你的项目。如果介绍有写错的地方（功能、协议、安装步骤），回复这个 issue 或发邮件到 support@openmicrodrama.com，我们马上改。  如果你愿意，可以把这个徽章加到 README 里（完全可选）：  ```markdown [![Featured on OpenMicroDrama](https://openmicrodrama.com/badges/featured.svg)](https://openmicrodrama.com/projects/hbai-ltd-toonflow-app) ```  不需要的话直接关掉这个 issue 就好，打扰了。  ---  Hi! We run OpenMicroDrama, an English directory of open-source tools for AI micro dramas. We've added HBAI-Ltd/Toonflow-app with an English write-up and quickstart: https://openmicrodrama.com/projects/hbai-ltd-toonflow-app  If anything is wrong (features, license, install steps), reply here and we'll fix it. If you'd like, you can add the badge above to your README. It's completely optional. Feel free to close this issue if you're not interested.

- **Issue #294** (2026-10-01): **完善素材高度超限错误提示**
  *Symptoms*: ## 问题与关联  图片/视频生成时，如果参考图高度不在供应商要求的 300–6000px 范围内，统一错误弹窗只会显示供应商返回的“素材高度不在要求范围300到6000内”，未说明涉及哪个素材、实际尺寸是多少，也没有给出可执行的调整建议。  ## 改动结果  - 读取参考图时解析 PNG、JPEG、GIF、WebP、BMP 的宽高信息。 - 捕获供应商高度范围错误后，补充以下信息：   - 当前供应商与模型   - 具体参考图路径   - 实际宽高   - 保持宽高比时建议调整到的尺寸   - 需要将图片高度调整到 300–6000px 的处理建议 - 普通参考图、视频首帧和尾帧都会参与该错误信息补全。 - 不修改用户原始素材，也不在 Toonflow 内擅自压缩或放大图片。  ## 验证方式  - Server `tsc --noEmit -p tsconfig.json`：通过。 - 未调用真实供应商复现该错误，未执行桌面打包。  ## 验证边界  - 目前只增强错误信息，不会自动修改素材尺寸。 - AVIF、TIFF 等未解析尺寸的格式会退回到通用提示。
  **Post-Mortem & Fix Analysis**:
  > 素材处理应该统一内聚到供应商代码里面 而不是在业务代码里面代替处理

- **Issue #293** (2026-10-01): **新增主体库并支持生成提示词 @ 引用**
  *Symptoms*: ## 问题与关联  现有素材库以文件和文件夹为中心，缺少可复用的“主体”概念，也没有把角色参考图和音色样本关联起来。图片/视频生成节点虽然支持 `@` 提及已连接节点，但不能直接选择主体库素材。  ## 改动结果  - 新增主体库面板和主体 CRUD：主体包含参考图、音色样本和首张图片封面。 - 支持从本机文件夹导入图片/音色，也支持从节点菜单直接保存图片或音频输出到主体库。 - 图片和视频生成节点的提示词输入框支持通过 `@` 选择主体库素材：   - 图片生成只展示主体图片。   - 视频生成展示主体图片和音色音频。   - 只有当前提示词中引用的主体素材才会进入生成请求。 - 主体库存储于 `assets/subjects/<主体名>`，复用现有素材读取和写入接口。 - 素材库删除接口增加受工作区根目录保护的递归删除选项，用于删除主体目录。  ## 验证方式  - Web 源码 `vue-tsc --noEmit`：通过。 - Server `tsc --noEmit -p tsconfig.json`：通过。 - `@toonflow/nodes-scaffold` 类型检查：通过。 - 图片生成、视频生成节点源码类型检查：通过。 - 未执行桌面完整打包和真实供应商生成调用。  ## 验证边界  - 未在 Windows/macOS 安装包中手动验证主体文件选择和生成节点 `@` 交互。 - 未验证真实模型对主体参考图/音色音频的供应商参数支持；节点仍按现有图片、音频引用格式传入。
  **Post-Mortem & Fix Analysis**:
  > 主体库设计超出预期，请先微信联系我进行计划同步

- **Issue #292** (2026-10-01): **修复画布无法粘贴剪贴板图片**
  *Symptoms*: ## 问题与关联  修复画布无法将从其他网页或应用复制的图片通过 `Ctrl+V` 或“从剪贴板粘贴”导入的问题。原有逻辑只处理 Toonflow 节点命令文本，不会读取剪贴板图片。  ## 改动结果  - 画布 `paste` 事件在节点命令不匹配时读取剪贴板图片，并复用现有文件导入流程。 - 部分 WebView 未向 `paste` 事件暴露图片文件时，桌面端回退到 Electrobun 原生 `clipboardReadImage()`。 - 右键菜单“从剪贴板粘贴”在节点命令不可用时支持导入图片。 - 桌面剪贴板接口增加 `format=image` 分支，返回 PNG Base64 数据。 - 快捷键说明更新为“粘贴节点或图片”。  ## 验证方式  - Web 源码 `vue-tsc --noEmit`：通过。 - Server `tsc --noEmit -p tsconfig.json`：通过。 - Desktop 完整类型检查：本机未准备 Electrobun SDK，仅出现第三方类型声明缺失，新增代码未报告类型错误。 - 未在真实桌面安装包中手动验证跨应用图片粘贴。  ## 验证边界  - 未执行桌面打包。 - 未覆盖超大图片、多个图片同时粘贴等场景，建议合并前在 Windows WebView2 和 macOS 中实际验证。
  **Post-Mortem & Fix Analysis**:
  >  该问题已在修复计划，与更新计划冲突。提交代码请提交在开发分支

- **Issue #291** (2026-09-29): **2.0版本不支持macos 14的版本**
  *Symptoms*: 从1.18之后就不支持macos 14的版本了，请问有后续支持计划吗
  **Post-Mortem & Fix Analysis**:
  > 目前发布的 macOS 安装包是在 macOS 15 环境下打包的，macOS 14 暂时没有完整验证，可能无法正常运行。另外，macOS 14 较早的小版本自带的 WebKit 内核比较旧，也可能有兼容问题。  底层 Electrobun 框架本身支持 macOS 14，可以把源码下载下来，在自己的系统上尝试编译。搭建编译环境和排查报错时，可以借助 Codex、WorkBuddy、DeepSeek 等工具辅助，不过自行编译也不一定能解决所有内核兼容问题。

- **Issue #290** (2026-09-28): **feat(i18n): add English UI with Simplified Chinese support**
  *Symptoms*: Related to #288.  @1340145680 Thanks for the update about i18n being planned for around mid-October. I had already been working on this English/Simplified Chinese implementation for 2.x, so I'm sharing it for review. Even if you continue with a different architecture, could you take a look? The catalogs or parts of the implementation may still be useful.  ## What changed  Adds an English UI while keeping Simplified Chinese as the default. The language can be changed in Settings > Appearance and is saved with the existing settings.  - A small `@toonflow/i18n` package shares the host's reactive locale with separately loaded node/tool bundles. It supports named placeholders, Chinese fallback, and unchanged unknown keys. - Localizes onboarding, workspaces, assistant controls, settings, canvas controls, built-in nodes, Director 3D, and client-rendered tools. Element Plus and the document language follow the selection without remounting the app. - Keeps settings panel instances and drafts alive across language changes, shows a persistent retry notice after a failed settings save, and updates owned error display text reactively. - Adds English and Simplified Chinese macOS bundle resources and contributor guidance in `docs/localization.md`.  The app uses committed catalogs. This does not add Lingo, a hosted translation dependency, or translation CI.  ## Compatibility  Saved node names, filenames, document text, provider IDs, tool schemas, prompts, and external/provider messages are n
  **Post-Mortem & Fix Analysis**:
  > @guglxni Thank you for the time and effort you've put into multilingual support for Toonflow, and for providing detailed implementation notes and test results!  As we discussed in #288, multilingual support is already on our roadmap. Our team will handle its design and implementation internally, and we currently expect to complete it before mid-October.  This PR targets `master` and changes 167 files. Its broad scope would require substantial review and integration work. Given the overlap with our planned development, we have decided to proceed with our internal plan for multilingual support, so we will not be merging this PR and are closing it.  Thank you again for your contribution and support for Toonflow. We hope you understand our decision!

- **Issue #289** (2026-09-29): **node:setConfig 工具传 duration 字段始终报错"expected number, received string"，无法动态控制视频时长**
  *Symptoms*:  **标题**：`node:setConfig` 工具传 `duration` 字段始终报错"expected number, received string"，无法动态控制视频时长  **环境**： - Toonflow (commit 不详) - 本地 ComfyUI v0.37.2 (RTX PRO 5000) - Provider: `comfyuiMiniMaxH3 / minimaxH3Ref2Video` - 节点类型：`remote-videoGenerationNode`  **复现步骤**： 1. 创建 `remote-videoGenerationNode`，配置 provider `comfyuiMiniMaxH3`、model `minimaxH3Ref2Video` 2. 节点连线图片（reference 模式） 3. 通过任何调用方（AI Agent / API / CLI）调用 `node:setConfig` 工具 4. 在 args 中传 `duration: 6`（number 类型） 5. 同样测试以下写法均失败：    - `{"duration": 6}` → "received string"    - `{"duration": 6.0}` → "received string"    - `{"duration": "6"}` → "received string"（违反 schema 类型）    - 只传 `{"duration": 6}` → "received string"  **期望行为**： `duration` 字段为 number 类型（schema: `{type: "number", exclusiveMinimum: 0}`），应能正常接收 number 6 并保存到节点 `data.duration`。  **实际行为**： 工具返回 Zod schema 校验错误： ``` {   "expected": "number",   "code": "invalid_type",   "path": ["duration"],   "message": "expected number, received string" } ``` 无论 number 怎么传，工具都把它转成 string 再校验，导致永远无法设置 duration。**手动在 Toonflow UI 上设置 duration 是有效的**（节点 data 会写入新值），说明后端/工作流支持，问题仅出在工具入参处理层。  **绕过方案**： 只能让用户在 UI 上手动改 duration，无法通过任何调用方（含 AI Agent）动态控制视频时长，限制了"按分镜动态规划时长"等合理用例。  **附加上下文**： - 同样的字符串化问题也影响 `generateAudio` 字段（boolean） - 之前工作流 ComfyUI 端数学计算确认 `length = max(5, round(duration * 24))`，duration 真的会影响最终视频时长 - AI Agent 排查确认是工具层 Zod schema 缺 `.coerce.number()` / `.coerce.boolean()`  ---  
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈。我们在当前代码（`d86cce6`）上检查并验证了内置 Agent 和 MCP 的参数调用链，暂未复现数字、布尔值被自动转成字符串的情况：  - `duration: 6` 和 `generateAudio: false/true` 均保持原始类型，并通过节点参数校验。 - 传入 `duration: "6"` 或 `generateAudio: "false"` 时，会出现你描述的错误。  目前尚未验证你使用的自定义 ComfyUI provider。麻烦补充以下信息，以便继续定位：  1. Toonflow 版本或 commit。 2. 实际发送的完整工具调用 JSON，以及对应错误日志。 3. `comfyuiMiniMaxH3` 的 provider 定义和模型配置，请移除密钥等敏感信息。  现有证据还不足以判断是缺少 `.coerce` 导致，需要先确认参数在哪一层变成了字符串。
  > 回答： 1：版本：v2.0.1 stable，构建标识：19sf7kz9bq3no  2：实际发送的完整工具调用 JSON，以及对应错误日志。,参考附件：[bug-Toonflow.md](https://github.com/user-attachments/files/32752922/bug-Toonflow.md)  3：comfyuiMiniMaxH3 的 provider 定义参考附件：  [video_minimax_h3_r2vA_turbo_8_steps.json](https://github.com/user-attachments/files/32753176/video_minimax_h3_r2vA_turbo_8_steps.json)        ComfyUI截图：  <img width="1970" height="889" alt="Image" src="https://github.com/user-attachments/assets/816588c1-b103-43c0-ac9e-a8e418ac8cc7" />  4：Toonflow连接本地ComfyUI的自定义配置：媒体模型>添加自定义供应商>文件导入，对应导入文件如下（原始.ts文件上传不了，只能压缩后再上传到这个评论区了）  [deepseek_typescript_20260928_0c3a49.zip](https://github.com/user-attachments/files/32753588/deepseek_typescript_20260928_0c3a49.zip)  <img width="1481" height="772" alt="Image" src="https://github.com/user-attachments/assets/54c291a4-eff5-4502-90f9-f5fee58b3a45" />  5：以下是结合添加在自定义供应商的导入文件（.ts文件）和在Toonflow中给出的报错信息，让DeepSeek排查bug给出的回复（希望对您有帮助）:  #DeepSeek的回答如下：# 原因链是这样的：  你导入的文件里声明了 durationResolutionMap，Toonflow 据此在节点上生成
  > 附件看过了，构建标识对得上官方 v2.0.1。  我用你提供的模型配置试了下，`duration: 6`、`duration: 15` 都能正常写入节点，`generateAudio: false` 也能通过。目前还没复现你遇到的报错，这次只验证了配置写入，没跑 ComfyUI 生成。  这份 md 里主要是 AI 的对话内容，看不到失败时实际发出的参数。还需要你补充两项信息：  - Agent 用的是哪个对话模型、哪家供应商？ - 工作区 `.agent/sessions/` 下对应的 `.jsonl` 文件里，失败那次 `nodeTools` 的调用参数和返回错误（`toolCall`、`toolResult`）。贴相关几行就行，注意去掉敏感信息。  拿到原始记录，才能看出传进来的到底是数字 `6` 还是字符串 `"6"`。  另外，你这个工作流固定生成声音，模型配置里建议补上 `audio: true`。现在漏了这个声明，界面上的声音配置会和实际能力对不上，不过它不是这次字符串报错的原因。

- **Issue #288** (2026-09-27): **English UI for the 2.x canvas (optional Lingo.dev catalogs)**
  *Symptoms*: I'm using the 2.0.1 canvas on macOS and would like an English UI without going back to the older application. Is anyone already working on this? I'd like to contribute a PR.  ### What I found  This concerns v2.0.1 at `d86cce6b689916ab73f75bc4c1f42a2a7424516c`, running the Web/Server app on macOS arm64.  The workspace, Settings and assistant UI show Chinese labels. In the tagged source, `apps/web/src/App.vue` selects Element Plus's `zhCn` locale, and custom strings are hardcoded across `apps/web` and the built-in nodes. I couldn't find a language selector for this version.  I checked #173, HBAI-Ltd/Toonflow-web#22 and #269. Those cover the older application/frontend, rather than the current 2.x canvas. The `solo` branch also has localization code, but its package version is 1.2.0 and its layout differs from 2.x.  ### Proposed change  Add Chinese and English catalogs with a saved language choice. Keep Chinese as the fallback and preserve the current experience for Chinese users. For new installations, we could detect the system/browser language if that's your preference.  I'd cover the canvas menus, Settings, assistant UI and built-in node/tool controls, including their display names and messages. Vue I18n seems reasonable, but the dynamically loaded plugins need a shared way to read the locale. I'd rather agree on that boundary before spreading translation calls through the code.  The change should leave node IDs, connection handles, API values and saved canvas formats alone. 
  **Post-Mortem & Fix Analysis**:
  > Thank you for your feedback. The I18n multilingual feature is still in the planning stage and is expected to be ready around mid-October.
  > @1340145680 Thanks for the update. I've opened #290 with an English/Simplified Chinese implementation for the 2.x interface, including the shared locale runtime, catalogs, screenshots, and verification notes.  I understand you already have i18n planned for around mid-October. Regardless of which approach you decide to use, could you take a look at the PR? You may be able to use the implementation or parts of it in your planned work.  The macOS native checks and Chromium checks are documented in the PR, along with the platforms and flows that haven't been tested. Simplified Chinese remains supported, and user-authored content and model-facing prompts aren't translated. 
  > @guglxni Thank you for your work on multilingual support for Toonflow and for providing the implementation details and test results. Our internal multilingual implementation was completed on October 1 and currently supports 21 languages. We will continue to use and maintain this implementation, so we will not be merging PR #290.  We welcome specific suggestions or focused PRs to review and correct the existing English translations. The English catalogs you have prepared could also serve as a reference for that work. Thank you for your understanding and support.

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

### Incident Patch 1: `f590babf` (2026-09-23)
**Commit Message**: 新增更新渠道选择，新增媒体模型模型获取功能，调整关于页UI

**File**: `.github/workflows/debug.yml` (modified, +1/-12)
```diff
@@ -54,7 +54,6 @@ jobs:
     outputs:
       version: ${{ steps.config.outputs.version }}
       matrix: ${{ steps.config.outputs.matrix }}
-      updateBaseUrl: ${{ steps.config.outputs.updateBaseUrl }}
       commit: ${{ steps.checkout.outputs.commit }}
     steps:
       - uses: actions/checkout@v7
@@ -71,8 +70,6 @@ jobs:
           buildTarget: ${{ inputs.target }}
           buildRef: ${{ inputs.ref || github.ref_name }}
           buildVersion: ${{ inputs.version }}
-          generatePatch: ${{ inputs.generatePatch }}
-          configuredUpdateUrl: ${{ vars.UPDATE_BASE_URL }}
         run: |
           bun -e '
           import { appendFileSync } from "node:fs";
@@ -88,14 +85,7 @@ jobs:
           const refVersion = /^v\d+\.\d+\.\d+$/.test(process.env.buildRef ?? "") ? process.env.buildRef : "";
           const version = (process.env.buildVersion?.trim() || refVersion || config.app.version).replace(/^v/, "");
           if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("版本号必须为 X.Y.Z，与 release:desktop 保持一致");
-          const updateBaseUrl = process.env.configuredUpdateUrl?.trim() || (process.env.generatePatch === "true"
-            ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/releases/latest/download`
-            : config.release.baseUrl);
-          const url = new URL(updateBaseUrl);
-          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /[\r\n]/.test(updateBaseUrl)) {
-            throw new Error("UPDATE_BASE_URL 必须为不含账号密码的 HTTP(S) 地址");
-          }
-          appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nmatrix=${JSON.stringify({ include })}\nupdateBaseUrl=${updateBaseUrl}\n`);
+          appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nmatrix=${JSON.stringify({ include })}\n`);
           '
 
   build:
@@ -108,7 +98,6 @@ jobs:
       matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}
     env:
       appVersion: ${{ needs.prepare.outputs.version }}
-      updateBaseUrl: ${{ needs.prepare.outputs.updateBaseUrl }}
       releaseMode: ${{ inputs.generatePatch && '--auto' || '--initial' }}
     steps:
       - uses: actions/checkout@v7
```

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -88,15 +88,15 @@ jobs:
             "",
             "| 你的电脑 | 下载 |",
             "| --- | --- |",
-            `| 🪟 Windows（64 位） | [⬇️ 下载 Windows 安装包](${download(windows)}) |`,
+            `| 💻 Windows（64 位） | [⬇️ 下载 Windows 安装包](${download(windows)}) |`,
             `| 🍎 Mac（M 系列芯片） | [⬇️ 下载 M 系列 Mac 安装包](${download(macArm)}) |`,
             `| 🍎 Mac（Intel 芯片） | [⬇️ 下载 Intel Mac 安装包](${download(macIntel)}) |`,
             "",
             "> 💡 手动安装请选择上表中的链接。下方其他文件供软件自动更新使用。",
             "",
             "## 🚀 安装说明",
             "",
-            "- 🪟 **Windows**：双击下载的安装包，按提示完成安装。",
+            "- 💻 **Windows**：双击下载的安装包，按提示完成安装。",
             "- 🍎 **Mac**：打开下载的安装包，将 `toonflow.app` 拖入“应用程序”，再从“应用程序”打开。",
             "",
             "**🍎 M 系列 Mac 如果安装或打开失败**，先确认已将应用拖入“应用程序”，然后打开“终端”，粘贴以下命令并按回车，再重试：",
```

**File**: `apps/server/src/app.ts` (modified, +2/-0)
```diff
@@ -52,6 +52,8 @@ export async function createApp({
   app.use(express.urlencoded({ extended: true, limit: "100mb" }));
   app.use("/api/desktop", desktopRequest);
 
+  const { default: initializeProviderModels } = await import("@/utils/ai/initialize");
+  await initializeProviderModels();
   const router = await import("@/router");
   router.default(app);
   const [{ createMcpRouter }, { getMcpTools }, { authorizeMcp }, { skillResources }] = await Promise.all([
```

**File**: `apps/server/src/router.ts` (modified, +66/-64)
```diff
@@ -65,38 +65,39 @@ import route62 from "./routes/providers/debug/run";
 import route63 from "./routes/providers/media/add";
 import route64 from "./routes/providers/media/delete";
 import route65 from "./routes/providers/media/list";
-import route66 from "./routes/providers/media/save";
-import route67 from "./routes/providers/models";
-import route68 from "./routes/settings/get";
-import route69 from "./routes/settings/personalization/get";
-import route70 from "./routes/settings/personalization/save";
-import route71 from "./routes/settings/save";
-import route72 from "./routes/settings/systemPrompt";
-import route73 from "./routes/skills/create";
-import route74 from "./routes/skills/get";
-import route75 from "./routes/skills/install";
-import route76 from "./routes/skills/list";
-import route77 from "./routes/skills/move";
-import route78 from "./routes/skills/order";
-import route79 from "./routes/skills/read";
-import route80 from "./routes/skills/save";
-import route81 from "./routes/skills/uninstall";
-import route82 from "./routes/tools/client";
-import route83 from "./routes/tools/get";
-import route84 from "./routes/tools/install";
-import route85 from "./routes/tools/renderers";
-import route86 from "./routes/tools/save";
-import route87 from "./routes/tools/setEnabled";
-import route88 from "./routes/tools/uninstall";
-import route89 from "./routes/workspaces/check";
-import route90 from "./routes/workspaces/files/list";
-import route91 from "./routes/workspaces/files/mkdir";
-import route92 from "./routes/workspaces/files/read";
-import route93 from "./routes/workspaces/files/remove";
-import route94 from "./routes/workspaces/files/rename";
-import route95 from "./routes/workspaces/files/write";
-import route96 from "./routes/workspaces/list";
-import route97 from "./routes/workspaces/selectDirectory";
+import route66 from "./routes/providers/media/models";
+import route67 from "./routes/providers/media/save";
+import route68 from "./routes/providers/models";
+import route69 from "./routes/settings/get";
+import route70 from "./routes/settings/personalization/get";
+import route71 from "./routes/settings/personalization/save";
+import route72 from "./routes/settings/save";
+import route73 from "./routes/settings/systemPrompt";
+import route74 from "./routes/skills/create";
+import route75 from "./routes/skills/get";
+import route76 from "./routes/skills/install";
+import route77 from "./routes/skills/list";
+import route78 from "./routes/skills/move";
+import route79 from "./routes/skills/order";
+import route80 from "./routes/skills/read";
+import route81 from "./routes/skills/save";
+import route82 from "./routes/skills/uninstall";
+import route83 from "./routes/tools/client";
+import route84 from "./routes/tools/get";
+import route85 from "./routes/tools/install";
+import route86 from "./routes/tools/renderers";
+import route87 from "./routes/tools/save";
+import route88 from "./routes/tools/setEnabled";
+import route89 from "./routes/tools/uninstall";
+import route90 from "./routes/workspaces/check";
+import route91 from "./routes/workspaces/files/list";
+import route92 from "./routes/workspaces/files/mkdir";
+import route93 from "./routes/workspaces/files/read";
+import route94 from "./routes/workspaces/files/remove";
+import route95 from "./routes/workspaces/files/rename";
+import route96 from "./routes/workspaces/files/write";
+import route97 from "./routes/workspaces/list";
+import route98 from "./routes/workspaces/selectDirectory";
 
 export default (app: Express) => {
   app.use("/api/agent", route1);
@@ -164,36 +165,37 @@ export default (app: Express) => {
   app.use("/api/providers/media/add", route63);
   app.use("/api/providers/media/delete", route64);
   app.use("/api/providers/media/list", route65);
-  app.use("/api/providers/media/save", route66);
-  app.use("/api/providers/models", route67);
-  app.use("/api/settings/get", route68);
-  app.use("/api/settings/personalization/get", route69);
-  app.use("/api/settings/personalization/save", route70);
-  app.use("/api/settings/save", route71);
-  app.use("/api/settings/systemPrompt", route72);
-  app.use("/api/skills/create", route73);
-  app.use("/api/skills/get", route74);
-  app.use("/api/skills/install", route75);
-  app.use("/api/skills/list", route76);
-  app.use("/api/skills/move", route77);
-  app.use("/api/skills/order", route78);
-  app.use("/api/skills/read", route79);
-  app.use("/api/skills/save", route80);
-  app.use("/api/skills/uninstall", route81);
-  app.use("/api/tools/client", route82);
-  app.use("/api/tools/get", route83);
-  app.use("/api/tools/install", route84);
-  app.use("/api/tools/renderers", route85);
-  app.use("/api/tools/save", route86);
-  app.use("/api/tools/setEnabled", route87);
-  app.use("/api/tools/uninstall", route88);
-  app.use("/api/workspaces/check", route89);
-  app.use("/api/workspaces/files/list", route90);
-  app.use("/api/workspaces/files/mkdir", route91);
-  app.use("/api/works
```

**File**: `apps/server/src/routes/providers/media/models.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+import { Router } from "express";
+import { z } from "zod";
+import u from "@/utils";
+import { validateFields } from "@/lib/middleware";
+import { success } from "@/lib/responseFormat";
+
+export default Router().post("/", validateFields({
+  fileName: u.mediaProvider.mediaProviderFileSchema,
+  revision: z.string().regex(/^[a-f0-9]{64}$/),
+}), async (req, res) => {
+  res.json(success(await u.mediaProvider.refreshMediaProviderModels(req.body.fileName, req.body.revision)));
+});
```

**File**: `apps/server/src/routes/providers/models.ts` (modified, +2/-40)
```diff
@@ -2,14 +2,9 @@ import { Router } from "express";
 import { z } from "zod";
 import { validateFields } from "@/lib/middleware";
 import { success } from "@/lib/responseFormat";
+import u from "@/utils";
 
 const router = Router();
-const modelSchema = z.object({
-  id: z.string().optional(), name: z.string().optional(),
-  display_name: z.string().optional(), displayName: z.string().optional(),
-  inputTokenLimit: z.number().int().positive().optional(),
-  outputTokenLimit: z.number().int().positive().optional(),
-});
 
 export default router.post("/", validateFields({
   apiUrl: z.url().refine(value => {
@@ -20,38 +15,5 @@ export default router.post("/", validateFields({
   apiKey: z.string().max(8192),
 }), async (req, res) => {
   const { apiUrl, protocol, apiKey } = req.body as { apiUrl: string; protocol: string; apiKey: string };
-  const url = new URL(apiUrl);
-  if (url.pathname === "/") url.pathname = "/v1";
-  url.pathname = `${url.pathname.replace(/\/+$/, "")}/models`;
-  const headers: Record<string, string> = { Accept: "application/json" };
-  if (protocol === "anthropic-messages") {
-    headers["anthropic-version"] = "2023-06-01";
-    headers["x-api-key"] = apiKey;
-    url.searchParams.set("limit", "1000");
-  } else if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
-
-  const models = new Map<string, { id: string; label: string; contextWindow?: number; maxOutputTokens?: number }>();
-  const cursors = new Set<string>();
-  const signal = AbortSignal.timeout(30000);
-  while (true) {
-    const response = await fetch(url, { headers, signal, redirect: "error" });
-    if (!response.ok) throw new Error(`获取模型列表失败（HTTP ${response.status}），请检查 API 地址、协议和密钥`);
-    const result = z.object({
-      data: z.array(modelSchema),
-      has_more: z.boolean().optional(), last_id: z.string().nullable().optional(),
-    }).parse(await response.json());
-    const items = result.data;
-    for (const item of items) {
-      const id = item.id?.trim();
-      if (!id) throw new Error("模型列表包含无效的模型 ID");
-      models.set(id, { id, label: item.display_name || item.displayName || id, contextWindow: item.inputTokenLimit, maxOutputTokens: item.outputTokenLimit });
-    }
-    const cursor = protocol === "anthropic-messages" && result.has_more ? result.last_id : undefined;
-    if (protocol === "anthropic-messages" && result.has_more && !cursor) throw new Error("模型列表缺少分页游标");
-    if (!cursor) break;
-    if (cursors.has(cursor)) throw new Error("模型列表分页游标重复");
-    cursors.add(cursor);
-    url.searchParams.set("after_id", cursor);
-  }
-  res.json(success([...models.values()]));
+  res.json(success(await u.ai.fetchProviderModels({ apiUrl, protocol, apiKey })));
 });
```

**File**: `apps/server/src/routes/settings/save.ts` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ const router = Router();
 
 export default router.put("/", validateFields({ settings: z.record(z.string(), z.json()).and(z.object({
   agentSystemPrompt: z.string().max(maxSystemPromptLength, `系统提示词不能超过 ${maxSystemPromptLength} 个字符`).optional(),
+  desktopUpdateSource: z.enum(["official", "github"]).optional(),
   mcp: z.object({ enabled: z.boolean().optional(), token: z.string().optional(), port: z.number().int().min(1).max(65535).optional() }).optional(),
 })) }), async (req, res) => {
   u.mcpControl.assertAppRequest(req);
```

**File**: `apps/server/src/types/desktop.ts` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ export interface DesktopRuntime {
   ready(failed?: boolean): Promise<void>;
   openDevTools(): void;
   updater: {
-    getLocalInfo(): Promise<{ version: string; channel: string; hash: string }>;
+    getLocalInfo(): Promise<{ version: string; channel: string; hash: string; baseUrl: string }>;
     updateInfo(): { version?: string; hash?: string; error?: string; updateAvailable?: boolean; updateReady?: boolean } | undefined;
     checkForUpdate(): Promise<{ error?: string }>;
     downloadUpdate?(): Promise<void>;
```

---

### Incident Patch 2: `37bc1b70` (2026-09-21)
**Commit Message**: 修正debug打包错误

**File**: `.github/workflows/debug.yml` (modified, +7/-1)
```diff
@@ -132,7 +132,13 @@ jobs:
           }
           if (!(Test-Path -LiteralPath $nsisPath)) { throw '找不到 makensis.exe' }
           "NSIS_PATH=$nsisPath" >> $env:GITHUB_ENV
-      - name: 构建安装包及完整更新文件
+      - name: 构建 Windows 安装包及完整更新文件
+        if: runner.os == 'Windows'
+        # ACT: 使用原生环境，避免 Git Bash 的 GNU tar 将 Windows 盘符识别为远程主机。
+        shell: pwsh
+        run: bun run release:desktop "$env:appVersion" --initial
+      - name: 构建 macOS 安装包及完整更新文件
+        if: runner.os == 'macOS'
         # ACT: CI 构建完整包，不依赖更新服务器已有版本，也不向更新服务器发布。
         run: bun run release:desktop "$appVersion" --initial
       - name: 上传构建产物
```

#### Recent Merged Pull Requests:
- **PR #294** (closed): 完善素材高度超限错误提示 (@Clearlove275)
- **PR #293** (closed): 新增主体库并支持生成提示词 @ 引用 (@Clearlove275)
- **PR #292** (closed): 修复画布无法粘贴剪贴板图片 (@Clearlove275)
- **PR #290** (closed): feat(i18n): add English UI with Simplified Chinese support (@guglxni)
- **PR #287** (closed): fix(skills): 强制画布首动作（剧本文本节点）与场景/道具资产强制生成边界 (@Jahu-bob)
- **PR #282** (closed): fix: 保持图生视频参考图、时长与提示词一致 (@linjie2008)
- **PR #278** (closed): feat(vendor): add API Route AI vendor integration (@DennyHo0917)
- **PR #276** (closed): 修复：生成视频提示词时读取当前轨道分镜 (@nzy0510)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
