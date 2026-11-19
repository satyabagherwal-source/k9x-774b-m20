# Domain G — Architecture Intelligence: Architecture Intelligence: lioensky-vcptoolbox-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "lioensky-vcptoolbox-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T21:24:16.575Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lioensky-vcptoolbox-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky-vcptoolbox-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T21:24:16.575Z`  
> **Learning ID**: `LEARN-EVO-lioensky-vcptoolbox-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), J (Search & Distribution Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from lioensky-vcptoolbox-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source**: github ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Source Version**: `a2c33d06`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T21:24:10.237Z  
> **Learning ID**: `learn-github-lioensky-vcptoolbox`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): lioensky/VCPToolBox

> **Canonical Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T21:24:10.231Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2453 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `AdminPanel-Vue/src/composables/useDashboardState.ts`
```
import {
  ref,
  onMounted,
  onUnmounted,
  computed,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import {
  newApiMonitorApi,
  newsApi,
  systemApi,
  weatherApi,
  type NewApiMonitorModelItem,
  type NewApiMonitorSummary,
  type NewApiMonitorTrendItem,
  type ServerLogResponse,
} from "@/api";
import { useAppStore } from "@/stores/app";
import { useRequest } from "@/composables/useRequest";
import { usePolling } from "@/composables/usePolling";
import type { DashboardWeatherDisplay, NewsItem } from "@/dashboard/types";
import { createLogger } from "@/utils/logger";
import { sanitizeExternalUrl } from "@/utils/url";
import type { MemoryProfile, NodeProcessInfo, SystemCpuTemperatureInfo } from "@/types/api.system";

interface PollingController {
  start: () => void;
  stop: () => void;
}

const logger = createLogger("Dashboard");

const MONITOR_INTERVAL = 5000;
const LOG_ACTIVITY_REFRESH_INTERVAL = 30 * 1000;
const WEATHER_REFRESH_INTERVAL = 30 * 60 * 1000;
const NEWS_REFRESH_INTERVAL = 10 * 60 * 1000;
const NEWAPI_REFRESH_INTERVAL = 60 * 1000;
const MAX_ACTIVITY_DATA_POINTS = 60;
const LOG_RETRY_POLICY = {
  maxRetries: 2,
  retryDelayMs: 500,
} as const;
const SYSTEM_MONITOR_COMPONENT_KEYS = ["cpu", "memory", "process", "node-info", "memory-profile"] as const;
const AUTH_CODE_COMPONENT_KEYS = ["process"] as const;
const WEATHER_COMPONENT_KEYS = ["weather"] as const;
const NEWS_COMPONENT_KEYS = ["news"] as const;
const NEWAPI_COMPONENT_KEYS = ["newapi-monitor"] as const;
const ACTIVITY_CHART_COMPONENT_KEYS = ["activity-chart"] as const;

const WEATHER_ICON_MAP: Record<string, string> = {
  "100": "sunny",
  "101": "cloudy",
  "102": "cloudy",
  "103": "partly_cloudy_day",
  "104": "cloud",
  "150": "clear_night",
  "151": "nights_stay",
  "152": "nights_stay",
  "153": "nights_stay",
  "154": "cloud",
  "300": "rainy",
  "301": "rainy",
  "302": "rainy_heavy",
  "303": "rainy_heavy",
  "304": "rainy_heavy",
  "305": "rainy",
  "306": "rainy",
  "307": "rainy_heavy",
  "308": "rainy_heavy",
  "309": "rainy",
  "310": "rainy_heavy",
  "311": "rainy_heavy",
  "312": "rainy_heavy",
  "313": "rainy_heavy",
  "314": "rainy",
  "315": "rainy_heavy",
  "316": "rainy_heavy",
  "317": "rainy_heavy",
  "318": "rainy_heavy",
  "350": "rainy",
  "351": "rainy_heavy",
  "399": "rainy",
  晴: "clear_day",
  多云: "partly_cloudy_day",
  阴: "cloud",
  小雨: "rainy",
  中雨: "rainy",
  大雨: "rainy",
  暴雨: "thunderstorm",
  雷阵雨: "thunderstorm",
  雪: "snowing",
  雾: "foggy",
  霾: "haze",
};

const DEFAULT_WEATHER_ICON = "wb_sunny";

function normalizeLogContent(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function splitLogChunk(content: string, carry = ""): {
  completeLines: string[];
  displayedLines: string[];
  trailingFragment: string;
} {
  const normalized = normalizeLogContent(content);
  const combined = `${carry}${normalized}`;
  const segments = combined.split("\n");
  const endsWithNewline = combined.endsWith("\n");

  if (endsWithNewline && segments[segments.length - 1] === "") {
    segments.pop();
  }

  const trailingFragment = endsWithNewline ? "" : (segments.pop() ?? "");
  const displayedLines = trailingFragment
    ? [...segments, trailingFragment]
    : segments;

  return {
    completeLines: segments,
    displayedLines,
    trailingFragment,
  };
}

function hasActiveBuiltinComponent(
  activeComponentKeys: ReadonlySet<string>,
  candidateKeys: readonly string[]
) {
  return candidateKeys.some((componentKey) =>
    activeComponentKeys.has(componentKey)
  );
}

export function useDashboardState(
  activeComponentKeys: MaybeRefOrGetter<readonly string[]> = []
) {
  const appStore = useAppStore();
  const animationsEnabled = computed(() => appStore.animationsEnabled);
  const theme = computed(() => appStore.theme);

  const activityCanvas = ref<HTMLCanvasElement | null>(null);

  const { data: systemData, execute: fetchSystemData } =
    useRequest<Awaited<ReturnType<typeof systemApi.getSystemResources>>>(
      (context) =>
        systemApi.getSystemResources(
          {
            signal: context?.signal,
            timeoutMs: 10000,
          },
          { showLoader: false }
        ),
      {
        globalLoadingKey: "dashboard.system-monitor",
      }
    );

  const { data: pm2Data, execute: fetchPM2Data } = useRequest<
    Awaited<ReturnType<typeof systemApi.getPM2Processes>>
  >(
    (context) =>
      systemApi.getPM2Processes(
        {
          signal: context?.signal,
          timeoutMs: 10000,
        },
        { showLoader: false }
      ),
    {
      globalLoadingKey: "dashboard.pm2-processes",
    }
  );

  const { data: memoryProfileData, execute: fetchMemoryProfile } =
    useRequest<Awaited<ReturnType<typeof systemApi.getMemoryProfile>>>(
      (context) =>
        systemApi.getMemoryProfile(
          {
            signal: context?.signal,
            timeoutMs: 10000,
          },
          { showLoader: false }
        ),
      {
        globalLoadingKey: "dashboard.memory-profile",
      }
    );

  const { data: authCodeData, execute: fetchAuthCode } =
    useRequest<Awaited<ReturnType<typeof systemApi.getUserAuthCode>>>(
      (context) =>
        systemApi.getUserAuthCode(
          {
            signal: context?.signal,
            timeoutMs: 10000,
          },
          { showLoader: false }
        ),
      {
        globalLoadingKey: "dashboard.auth-code",
      }
    );

  const cpuUsage = ref(0);
  const cpuPlatform = ref("");
  const cpuArch = ref("");
  const cpuTemperature = ref<SystemCpuTemperatureInfo | null>(null);
  const memUsage = ref(0);
  const memInfo = ref("加载中…");
  const memTotal = ref(0);
  const memUsed = ref(0);
  const vcpMemUsage = ref(0);
  const vcpMemBytes = ref(0);
  const pm2Processes = ref<Awaited<ReturnType<typeof systemApi.getPM2Processes>>>([]);
  const nodeInfo = ref<Partial<NodeProcessInfo>>({});
  const memoryProfile = ref<MemoryProfile | null>(null);
  const userAuthCode = ref("加载中…");
  const weather = ref<DashboardWeatherDisplay>({
    icon: "--",
    temp: null,
    text: "加载中…",
    humidity: null,
    wind: "--",
    pressure: null,
    forecast: [],
  });
  const newsItems = ref<NewsItem[]>([]);
  const newApiMonitorSummary = ref<NewApiMonitorSummary | null>(null);
  const newApiMonitorTrend = ref<NewApiMonitorTrendItem[]>([]);
  const newApiMonitorModels = ref<NewApiMonitorModelItem[]>([]);
  const newApiMonitorStatus = ref<"loading" | "ready" | "unavailable" | "error">("loading");
  const newApiMonitorError = ref("");
  const activityDataPoints = ref<number[]>(new Array(60).fill(0));
  const lastLogCheckTime = ref<Date | null>(null);
  const lastLogOffset = ref(0);
  const pendingLogFragment = ref("");
  const isPageVisible = ref(
    typeof document === "undefined"
      ? true
      : document.visibilityState === "visible"
  );
  const activeBuiltinComponentKeySet = computed(
    () => new Set(toValue(activeComponentKeys))
  );
  const shouldPollSystemMonitor = computed(() =>
    hasActiveBuiltinComponent(
      activeBuiltinComponentKeySet.value,
      SYSTEM_MONITOR_COMPONENT_KEYS
    )
  );
  const shouldLoadAuthCode = computed(() =>
    hasActiveBuiltinComponent(
      activeBuiltinComponentKeySet.value,
      AUTH_CODE_COMPONENT_KEYS
    )
  );
  const shouldPollWeather = computed(() =>
    hasActiveBuiltinComponent(
      activeBuiltinComponentKeySet.value,
      WEATHER_COMPONENT_KEYS
    )
  );
  const shouldPollNews = computed(() =>
    hasActiveBuiltinComponent(
      activeBuiltinComponentKeySet.value,
      NEWS_COMPONENT_KEYS
    )
  );
  const shouldPollNewApiMonitor = computed(() =>
    hasActiveBuiltinComponent(
      activeBuiltinComponentKeySet.value,
      NEWAPI_COMPONENT_KEYS
    )
  );
  const shouldPollActivityChart = computed(() =>
    hasActiveBuiltinComponent(
      activeBuiltinComponentKeySet.value,
      ACTIVITY_CHART_COMPONENT_KEYS
    )
  );

  let activityChartCtx: CanvasRenderingContext2D | null = null;
  let hasMounted = false;
  let authCodeLoadPromise: Promise<void> | null = null;

  async function monitorSystemResources() {
    await Promise.all([fetchSystemData(), fetchPM2Data(), fetchMemoryProfile()]);

    if (systemData.value?.cpu?.usage !== undefined) {
      cpuUsage.value = systemData.value.cpu.usage;
      cpuPlatform.value = systemData.value.nodeProcess?.platform || "";
      cpuArch.value = systemData.value.nodeProcess?.arch || "";
      cpuTemperature.value = systemData.value.cpu.temperature ?? null;
    }

    if (
      systemData.value?.memory?.used !== undefined &&
      systemData.value?.memory?.total !== undefined
    ) {
      const usedGB = systemData.value.memory.used / 1024 / 1024 / 1024;
      const totalGB = systemData.value.memory.total / 1024 / 1024 / 1024;
      memUsage.value = systemData.value.memory.usage;
      memInfo.value = `已用：${usedGB.toFixed(2)} GB / 总共：${totalGB.toFixed(
        2
      )} GB`;
      memTotal.value = systemData.value.memory.total;
      memUsed.value = systemData.value.memory.used;
    }

    if (pm2Data.value) {
      pm2Processes.value = pm2Data.value;
      // VCP 内存 = vcp-main + vcp-admin 两个 PM2 进程的内存总和
      const vcpProcessNames = ["vcp-main", "vcp-admin"];
      const vcpTotalBytes = pm2Data.value
        .filter((proc) => vcpProcessNames.includes(proc.name))
        .reduce((sum, proc) => sum + (proc.memory || 0), 0);
      vcpMemBytes.value = vcpTotalBytes;
      if (systemData.value?.memory?.total && vcpTotalBytes > 0) {
        vcpMemUsage.value =
          (vcpTotalBytes / systemData.value.memory.total) * 100;
      }
    }

    if (systemData.value?.nodeProcess) {
      nodeInfo.value = {
        pid: systemData.value.nodeProcess.pid,
        version: systemData.value.nodeProcess.version,
        memory: systemData.value.nodeProcess.memory,
        uptime: systemData.value.nodeProcess.uptime,
      };
    }

    if (memoryProfileData.value) {
      memoryProfile.value = memoryProfile
```

### Core Architecture Module: `AdminPanel-Vue/src/composables/useMainLayoutState.ts`
```
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMainLayoutControls } from "@/composables/main-layout/useMainLayoutControls";
import { useMainLayoutDomEffects } from "@/composables/main-layout/useMainLayoutDomEffects";
import { useMainLayoutNavigation } from "@/composables/main-layout/useMainLayoutNavigation";
import { useAppStore } from "@/stores/app";

export function useMainLayoutState() {
  const router = useRouter();
  const route = useRoute();
  const appStore = useAppStore();
  const controls = useMainLayoutControls();
  const contentRef = ref<HTMLElement | null>(null);

  const navigation = useMainLayoutNavigation({
    router,
    route,
    appStore,
    closeTransientUi: controls.closeTransientUi,
  });
  const domEffects = useMainLayoutDomEffects({
    route,
    appStore,
    contentRef,
    controls,
  });

  return {
    ...controls,
    ...navigation,
    ...domEffects,
    contentRef,
  };
}

```

### Core Architecture Module: `AdminPanel-Vue/src/composables/useMarkdownRenderer.ts`
```
import { ref, computed } from "vue";
import type * as DOMPurifyModule from "dompurify";
import type * as Marked from "marked";
import type HLJS from "highlight.js";

const MARKDOWN_SANITIZE_OPTIONS: DOMPurifyModule.Config = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
    "style",
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "textarea",
    "select",
  ],
  FORBID_ATTR: ["style"],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ["class"],
};

const PLAIN_TEXT_CODE_LANGUAGES = new Set([
  "",
  "text",
  "txt",
  "plain",
  "plaintext",
  "none",
]);

const VCP_TOOL_PROTOCOL_PATTERN =
  /<<<\[(?:END_)?TOOL_REQUEST(?:_EXP)?\]>>>|「始(?:exp)?」|「末(?:exp)?」/;

export function escapeMarkdownCodeHtml(content: string): string {
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface MarkdownCodeHighlighter {
  getLanguage(languageName: string): unknown;
  highlight(
    code: string,
    options: { language: string; ignoreIllegals: boolean }
  ): { value: string };
}

export function renderMarkdownCodeBlock(
  code: string,
  language: string,
  highlighter: MarkdownCodeHighlighter | null
): string {
  const safeLanguage = (language || "").trim().split(/\s+/)[0].toLowerCase();

  if (
    !highlighter ||
    PLAIN_TEXT_CODE_LANGUAGES.has(safeLanguage) ||
    VCP_TOOL_PROTOCOL_PATTERN.test(code) ||
    !highlighter.getLanguage(safeLanguage)
  ) {
    return escapeMarkdownCodeHtml(code);
  }

  try {
    return highlighter.highlight(code, {
      language: safeLanguage,
      ignoreIllegals: true,
    }).value;
  } catch (error) {
    console.warn("[useMarkdownRenderer] highlight 失败，回退原文:", error);
    return escapeMarkdownCodeHtml(code);
  }
}

/**
 * Markdown 渲染 Composable
 * 
 * 提供统一的 Markdown 解析和 HTML 消毒功能。
 * 使用懒加载策略，按需导入 marked 和 DOMPurify。
 * 
 * @example
 * ```typescript
 * const { renderedMarkdown, isReady, renderMarkdown } = useMarkdownRenderer();
 * 
 * // 渲染 Markdown（异步）
 * const html = await renderMarkdown('# Hello World');
 * 
 * // 渲染 Markdown（同步，库已加载时）
 * const html = renderMarkdown('# Hello World');
 * ```
 */
export function useMarkdownRenderer() {
  let markedModule: typeof Marked | null = null;
  let dompurifyModule: typeof DOMPurifyModule | null = null;
  let hljsModule: typeof HLJS | null = null;
  const isReady = ref(false);
  const lastRenderedContent = ref("");

  /**
   * 初始化 Markdown 渲染引擎
   * 懒加载 marked、DOMPurify 与 highlight.js（代码块高亮），减少初始包体积
   */
  async function initializeRenderer(): Promise<void> {
    if (isReady.value) {
      return;
    }

    try {
      const [marked, DOMPurify, hljs, markedHighlight] = await Promise.all([
        import("marked"),
        import("dompurify"),
        import("highlight.js"),
        import("marked-highlight"),
      ]);

      markedModule = marked;
      dompurifyModule = DOMPurify;
      hljsModule = (hljs.default ?? hljs) as typeof HLJS;

      // 通过官方 marked-highlight 适配器接入 highlight.js
      // 该适配器会在生成的 <code> 上自动加 hljs / language-xxx class，
      // 内部 token 也都带上 .hljs-keyword / .hljs-string 等类。
      const mh = (markedHighlight as { markedHighlight?: typeof markedHighlight.markedHighlight }).markedHighlight
        ?? (markedHighlight as unknown as { default: typeof markedHighlight.markedHighlight }).default;

      if (typeof mh === "function") {
        markedModule.marked.use(
          mh({
            langPrefix: "hljs language-",
            highlight(code: string, lang: string): string {
              // 围栏代码块首先是“原文展示”区域。纯文本、未标注语言、
              // 未知语言及 VCP 工具协议均不做自动语言猜测，避免 highlight.js
              // 将 <<<[TOOL_REQUEST]>>> 等内容误判成 XML 并拆成额外 span。
              return renderMarkdownCodeBlock(code, lang, hljsModule);
            },
          })
        );
      } else {
        console.warn("[useMarkdownRenderer] marked-highlight 适配器加载失败，代码块将不会高亮");
      }

      isReady.value = true;
    } catch (error) {
      console.error("[useMarkdownRenderer] 初始化失败:", error);
      throw error;
    }
  }

  /**
   * 同步渲染 Markdown 内容为安全的 HTML
   * 要求库已预先加载（isReady 为 true）
   * 
   * @param content - 原始 Markdown 字符串
   * @returns 消毒后的 HTML 字符串
   */
  function renderMarkdownSync(content: string): string {
    if (!content) {
      return "";
    }

    if (!markedModule || !dompurifyModule) {
      console.warn("[useMarkdownRenderer] 渲染引擎未就绪，降级为文本转义输出");
      const escapedHtml = escapeMarkdownCodeHtml(content);
      lastRenderedContent.value = escapedHtml;
      return escapedHtml;
    }

    // 解析 Markdown
    const parsed = markedModule.marked.parse(content);
    const html = typeof parsed === "string" ? parsed : content;
    
    // 消毒 HTML
    const sanitizedHtml = dompurifyModule.default.sanitize(
      html,
      MARKDOWN_SANITIZE_OPTIONS
    );
    
    // 缓存最后渲染结果
    lastRenderedContent.value = sanitizedHtml;
    
    return sanitizedHtml;
  }

  /**
   * 异步渲染 Markdown 内容为安全的 HTML
   * 自动按需加载库，无需预先初始化
   * 
   * @param content - 原始 Markdown 字符串
   * @returns 消毒后的 HTML 字符串
   */
  async function renderMarkdown(content: string): Promise<string> {
    if (!content) {
      return "";
    }

    if (!isReady.value) {
      await initializeRenderer();
    }

    return renderMarkdownSync(content);
  }

  /**
   * 响应式渲染结果
   * 可通过设置 lastRenderedContent.value 触发重新渲染
   */
  const renderedMarkdown = computed(() => lastRenderedContent.value);

  return {
    /** 渲染引擎是否已就绪 */
    isReady,
    /** 最后渲染的 HTML 内容 */
    renderedMarkdown,
    /** 同步渲染 Markdown（要求库已加载） */
    renderMarkdownSync,
    /** 异步渲染 Markdown（自动加载库） */
    renderMarkdown,
    /** 初始化渲染引擎 */
    initializeRenderer,
  };
}

```

### Core Architecture Module: `AdminPanel-Vue/src/dashboard/core/builtinCards.ts`
```
import type { BuiltinDashboardCardContribution } from "@/dashboard/core/types";
import type { useDashboardState } from "@/composables/useDashboardState";
import { discoveredCards } from "@/dashboard/core/builtinComponentMap";

export type DashboardBuiltinState = ReturnType<typeof useDashboardState>;

/**
 * 仪表盘官方核心卡片 + 第三方贡献卡片合并入口。
 *
 * 两类卡片：
 *   1) 官方核心卡（legacy 段）：依赖 `useDashboardState` 注入响应式数据，
 *      在下方 `legacyCards` 数组里手动声明 buildProps；
 *   2) 第三方贡献卡（auto 段）：放在 `components/dashboard/contrib/` 下，
 *      自描述 `cardMeta` 元信息，并通过 `_sdk.ts` 自取数据。
 *
 * 自描述卡片由 [`builtinComponentMap.ts`](./builtinComponentMap.ts) 的
 * `import.meta.glob` 自动发现，零配置即可纳入"管理卡片"目录。
 *
 * 详见：docs/DASHBOARD_CONTRIB_GUIDE.md
 */
export function getBuiltinDashboardCards(
  state: DashboardBuiltinState
): BuiltinDashboardCardContribution[] {
  const legacyCards: BuiltinDashboardCardContribution[] = [
    {
      typeId: "builtin.weather",
      title: "天气预报",
      description: "显示近期天气与简要趋势。",
      source: "builtin",
      singleton: true,
      defaultEnabled: true,
      legacyId: "weather",
      defaultSize: { desktopCols: 6, tabletCols: 6, rows: 14 },
      minSize: { desktopCols: 4, tabletCols: 4, rows: 9 },
      maxSize: { desktopCols: 8, tabletCols: 6, rows: 18 },
      renderer: {
        kind: "builtin",
        componentKey: "weather",
        buildProps: () => ({
          data: state.weather.value,
        }),
      },
    },
    {
      typeId: "builtin.newapi-monitor",
      title: "NewAPI 监控",
      description: "显示模型调用与健康状态。",
      source: "builtin",
      singleton: true,
      defaultEnabled: true,
      legacyId: "newapi-monitor",
      defaultSize: { desktopCols: 6, tabletCols: 6, rows: 20 },
      minSize: { desktopCols: 4, tabletCols: 3, rows: 10 },
      maxSize: { desktopCols: 12, tabletCols: 6, rows: 20 },
      renderer: {
        kind: "builtin",
        componentKey: "newapi-monitor",
        buildProps: () => ({
          summary: state.newApiMonitorSummary.value,
          trendItems: state.newApiMonitorTrend.value,
          models: state.newApiMonitorModels.value,
          status: state.newApiMonitorStatus.value,
          errorMessage: state.newApiMonitorError.value,
        }),
      },
    },
    {
      typeId: "builtin.cpu",
      title: "CPU",
      description: "显示 CPU 使用率与架构信息。",
      source: "builtin",
      singleton: true,
      defaultEnabled: true,
      legacyId: "cpu",
      defaultSize: { desktopCols: 3, tabletCols: 3, rows: 11 },
      minSize: { desktopCols: 3, tabletCols: 3, rows: 7 },
      maxSize: { desktopCols: 6, tabletCols: 6, rows: 16 },
      renderer: {
        kind: "builtin",
        componentKey: "cpu",
        buildProps: () => ({
          usage: state.cpuUsage.value,
          info: "",
          platform: state.cpuPlatform.value,
          arch: state.cpuArch.value,
          temperature: state.cpuTemperature.value,
        }),
      },
    },
    {
      typeId: "builtin.memory",
      title: "内存",
      description: "显示系统内存与 VCP 进程占用。",
      source: "builtin",
      singleton: true,
      defaultEnabled: true,
      legacyId: "memory",
      defaultSize: { desktopCols: 3, tabletCols: 3, rows: 11 },
      minSize: { desktopCols: 3, tabletCols: 3, rows: 7 },
      maxSize: { desktopCols: 6, tabletCols: 6, rows: 16 },
      renderer: {
        kind: "builtin",
        componentKey: "memory",
        buildProps: () => ({
          usage: state.memUsage.value,
          info: state.memInfo.value,
          vcpUsage: state.vcpMemUsage.value,
          memTotal: state.memTotal.value,
          memUsed: state.memUsed.value,
          vcpMemBytes: state.vcpMemBytes.value,
        }),
      },
    },
    {
      typeId: "builtin.memory-profile",
      title: "记忆库内存",
      description: "显示热记忆、TagMemo 矩阵与冷知识库索引的估算内存。",
      source: "builtin",
      singleton: true,
      defaultEnabled: true,
      legacyId: null,
      defaultSize: { desktopCols: 6, tabletCols: 6, rows: 16 },
      minSize: { desktopCols: 4, tabletCols: 3, rows: 10 },
      maxSize: { desktopCols: 12, tabletCols: 6, rows: 24 },
      renderer: {
        kind: "builtin",
        componentKey: "memory-profile",
        buildProps: () => ({
          profile: state.memoryProfile.value,
        }),
      },
    },
    {
      typeId: "builtin.process",
      title: "PM2 进程",
      description: "显示 PM2 进程状态。",
      source: "builtin",
      singleton: true,
      defaultEnabled: true,
      legacyId: "process",
      defaultSize: { desktopCols: 6, tabletCols: 6, rows: 9 },
      minSize: { desktopCols: 4, tabletCols: 3, rows: 9 },
      maxSize: { desktopCols: 12, tabletCols: 6, rows: 20 },
      renderer: {
        kind: "builtin",
        componentKey: "process",
        buildProps: () => ({
          processes: state.pm2Processes.value,
          authCode: state.userAuthCode.value,
          maxDisplay: 20,
        }),
      },
    },
    {
      typeId: "builtin.news",
      title: "新闻",
      description: "显示精选热点新闻。",
      source: "builtin",
      singleton: true,
      defaultEnabled: true,
      legacyId: "news",
      defaultSize: { desktopCols: 6, tabletCols: 5, rows: 20 },
      minSize: { desktopCols: 4, tabletCols: 3, rows: 9 },
      maxSize: { desktopCols: 12, tabletCols: 6, rows: 20 },
      renderer: {
        kind: "builtin",
        componentKey: "news",
        buildProps: () => ({
          items: state.newsItems.value,
        }),
      },
    },
    {
      typeId: "builtin.node-info",
      title: "Node 信息",
      description: "显示当前 Node 进程与运行时信息。",
      source: "builtin",
      singleton: true,
      defaultEnabled: true,
      legacyId: "node-info",
      defaultSize: { desktopCols: 3, tabletCols: 3, rows: 16 },
      minSize: { desktopCols: 3, tabletCols: 3, rows: 7 },
      maxSize: { desktopCols: 6, tabletCols: 6, rows: 16 },
      renderer: {
        kind: "builtin",
        componentKey: "node-info",
        buildProps: () => ({
          info: state.nodeInfo.value,
        }),
      },
    },
    {
      typeId: "builtin.calendar",
      title: "日程",
      description: "显示即将开始的日程。",
      source: "builtin",
      singleton: true,
      defaultEnabled: true,
      legacyId: "calendar",
      defaultSize: { desktopCols: 3, tabletCols: 3, rows: 12 },
      minSize: { desktopCols: 3, tabletCols: 3, rows: 6 },
      maxSize: { desktopCols: 6, tabletCols: 6, rows: 16 },
      renderer: {
        kind: "builtin",
        componentKey: "calendar",
        buildProps: () => ({}),
      },
    },
    {
      typeId: "builtin.activity-chart",
      title: "服务器活跃度",
      description: "展示日志活跃度趋势图。",
      source: "builtin",
      singleton: true,
      defaultEnabled: true,
      legacyId: null,
      defaultSize: { desktopCols: 12, tabletCols: 6, rows: 16 },
      minSize: { desktopCols: 4, tabletCols: 3, rows: 12 },
      maxSize: { desktopCols: 12, tabletCols: 6, rows: 24 },
      renderer: {
        kind: "builtin",
        componentKey: "activity-chart",
        buildProps: () => ({
          setCanvasRef: (element: HTMLCanvasElement | null) => {
            state.activityCanvas.value = element;
          },
        }),
      },
    },
    {
      typeId: "builtin.dream-review",
      title: "梦境监督",
      description: "显示待审核的梦操作。",
      source: "builtin",
      singleton: true,
      defaultEnabled: false,
      legacyId: null,
      defaultSize: { desktopCols: 4, tabletCols: 3, rows: 14 },
      minSize: { desktopCols: 3, tabletCols: 3, rows: 10 },
      maxSize: { desktopCols: 6, tabletCols: 6, rows: 18 },
      renderer: {
        kind: "builtin",
        componentKey: "dream-review",
        buildProps: () => ({}),
      },
    },
    {
      typeId: "builtin.vcp-forum",
      title: "VCP 论坛",
      description: "显示最近有回复或修改的论坛帖子。",
      source: "builtin",
      singleton: true,
      defaultEnabled: false,
      legacyId: null,
      defaultSize: { desktopCols: 4, tabletCols: 3, rows: 14 },
      minSize: { desktopCols: 3, tabletCols: 3, rows: 10 },
      maxSize: { desktopCols: 6, tabletCols: 6, rows: 18 },
      renderer: {
        kind: "builtin",
        componentKey: "vcp-forum",
        buildProps: () => ({}),
      },
    },
  ];

  // ─── 自描述卡片（第三方贡献区 + 任何带有 cardMeta 的官方卡片）──────────
  // 这些卡片不依赖 useDashboardState 注入，自行通过 contrib/_sdk.ts 取数。
  const legacyComponentKeys = new Set(
    legacyCards.map((card) => card.renderer.componentKey)
  );

  const autoCards: BuiltinDashboardCardContribution[] = discoveredCards
    .filter((card) => {
      // 必须有自描述 meta，并且没有被 legacy 段占用相同的 componentKey
      if (!card.meta) {
        return false;
      }
      if (legacyComponentKeys.has(card.componentKey)) {
        // 同名时优先以 legacy 段为准（保持向下兼容）
        return false;
      }
      return true;
    })
    .map((card) => {
      const meta = card.meta!;
      return {
        typeId: meta.typeId,
        title: meta.title,
        description: meta.description,
        source: "builtin",
        singleton: meta.singleton ?? true,
        defaultEnabled: meta.defaultEnabled ?? false,
        legacyId: null,
        defaultSize: meta.defaultSize,
        minSize: meta.minSize,
        maxSize: meta.maxSize,
        renderer: {
          kind: "builtin",
          componentKey: card.componentKey,
          // 第三方/自描述卡片自行管理状态，无需注入 props
          buildProps: () => ({}),
        },
      } satisfies BuiltinDashboardCardContribution;
    });

  return [...legacyCards, ...autoCards];
}

```

### Core Architecture Module: `AdminPanel-Vue/src/dashboard/core/builtinComponentMap.ts`
```
import { defineAsyncComponent, type Component } from "vue";
import type { CardMeta } from "@/components/dashboard/contrib/_types";

/**
 * 仪表盘卡片自动发现机制（基于 Vite import.meta.glob）
 *
 * 扫描两个目录：
 *   - @/components/dashboard/*Card.vue          → 官方核心卡片
 *   - @/components/dashboard/contrib/*Card.vue  → 第三方贡献卡片
 *
 * 文件命名约定：
 *   - 必须以 `Card.vue` 结尾
 *   - componentKey 由文件名前缀自动派生，转小写（如 `CpuCard.vue` → "cpu"）
 *
 * 自描述协议（仅第三方贡献卡片需要）：
 *   - 在 .vue 顶部用普通 `<script lang="ts">`（与 `<script setup>` 共存）
 *     导出名为 `cardMeta` 的常量（类型见 contrib/_types.ts）
 *   - eager glob 在构建期解析 cardMeta，无运行时开销
 *
 * 详见：docs/DASHBOARD_CONTRIB_GUIDE.md
 */

// 异步组件加载器（按需 code-splitting）
const componentLoaders = import.meta.glob<{ default: Component }>([
  "@/components/dashboard/*Card.vue",
  "@/components/dashboard/contrib/*Card.vue",
]);

// 同步抓取每个模块的可选 cardMeta。
// 注意：不能使用 `{ import: "cardMeta" }`，因为官方 legacy 卡片未导出 cardMeta，
// Rolldown/Vite 在生产构建时会把缺失命名导出视为构建错误。
const metaModules = import.meta.glob<{ cardMeta?: CardMeta }>(
  [
    "@/components/dashboard/*Card.vue",
    "@/components/dashboard/contrib/*Card.vue",
  ],
  { eager: true }
);

export interface DiscoveredCard {
  /** 派生自文件名前缀的小写键，例如 CpuCard.vue → "cpu" */
  componentKey: string;
  /** 异步组件，仅在卡片实际渲染时加载 */
  component: Component;
  /** 第三方卡片必须导出的元信息；官方核心卡片可不导出（沿用 builtinCards.ts 集中维护） */
  meta: CardMeta | null;
  /** 来源类别 */
  source: "official" | "contrib";
  /** 原始文件路径，便于调试与"管理卡片"面板展示 */
  path: string;
}

function deriveComponentKey(path: string): string {
  const matched = path.match(/\/([A-Za-z0-9]+)Card\.vue$/);
  if (!matched) {
    return path;
  }
  // 把 PascalCase 文件名转成 kebab-case，例如 NewApiMonitorCard → "newapi-monitor"（保持与官方现有键一致需手工映射）
  // 这里取最简单的"全部小写"策略，保留原大小写区分用 alias 表
  return matched[1].toLowerCase();
}

/**
 * 官方核心卡片的 componentKey 仍然由 builtinCards.ts 显式声明（如 "newapi-monitor"），
 * 此处提供一个手工别名表，把文件名派生的 key 映射到 builtinCards.ts 中使用的官方 key。
 *
 * 第三方贡献卡片不需要写在此表里——它们的 componentKey 直接来自文件名小写形式。
 */
const OFFICIAL_KEY_ALIASES: Record<string, string> = {
  weathercard: "weather",
  newapimonitorcard: "newapi-monitor",
  cpucard: "cpu",
  memorycard: "memory",
  memoryprofilecard: "memory-profile",
  processcard: "process",
  newscard: "news",
  nodeinfocard: "node-info",
  calendarcard: "calendar",
  activitychartcard: "activity-chart",
  dreamreviewcard: "dream-review",
  vcpforumcard: "vcp-forum",
};

function resolveComponentKey(path: string): string {
  const matched = path.match(/\/([A-Za-z0-9]+Card)\.vue$/);
  if (!matched) {
    return deriveComponentKey(path);
  }
  const filenameLower = matched[1].toLowerCase();
  return OFFICIAL_KEY_ALIASES[filenameLower] ?? deriveComponentKey(path);
}

export const discoveredCards: DiscoveredCard[] = Object.entries(componentLoaders).map(
  ([path, loader]) => {
    const componentKey = resolveComponentKey(path);
    const meta = metaModules[path]?.cardMeta ?? null;
    return {
      componentKey,
      component: defineAsyncComponent(loader),
      meta,
      source: path.includes("/contrib/") ? "contrib" : "official",
      path,
    };
  }
);

/**
 * 兼容旧版用法：BuiltinCardHost.vue 仍然按 componentKey 查表渲染。
 * 该映射表由发现结果自动构建，新增官方卡或贡献卡都会自动加入。
 */
export const builtinComponentMap: Record<string, Component> = Object.fromEntries(
  discoveredCards.map((card) => [card.componentKey, card.component])
);

```

### Core Architecture Module: `AdminPanel-Vue/src/dashboard/core/cardRegistry.ts`
```
import type { DashboardCardContribution } from "@/dashboard/core/types";

export class CardRegistry {
  private readonly contributions = new Map<string, DashboardCardContribution>();

  register(card: DashboardCardContribution): void {
    this.contributions.set(card.typeId, card);
  }

  registerMany(cards: readonly DashboardCardContribution[]): void {
    cards.forEach((card) => {
      this.register(card);
    });
  }

  get(typeId: string): DashboardCardContribution | undefined {
    return this.contributions.get(typeId);
  }

  getAll(): DashboardCardContribution[] {
    return [...this.contributions.values()];
  }
}

```

### Core Architecture Module: `AdminPanel-Vue/src/dashboard/core/pluginAssetLoader.ts`
```
const assetPromises = new Map<string, Promise<void>>();

/**
 * 校验插件资源 URL 必须是同源来源：
 *   - 相对路径（不含 scheme/authority），或
 *   - 与当前页面同 origin 的绝对 URL
 * 拒绝任何跨域 URL，避免恶意/被篡改的插件 manifest 通过 publicPath 注入外部脚本。
 */
function assertSameOriginAsset(url: string): void {
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("Plugin asset URL is empty.");
  }

  // 禁止 protocol-relative URL（如 //evil.com/x.js）
  if (url.startsWith("//")) {
    throw new Error(`Refused cross-origin plugin asset: ${url}`);
  }

  // 纯相对或根相对路径：同源
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return;
  }

  if (typeof window === "undefined") {
    throw new Error(`Refused plugin asset with absolute URL in non-browser env: ${url}`);
  }

  const resolved = new URL(url, window.location.href);
  if (resolved.origin !== window.location.origin) {
    throw new Error(`Refused cross-origin plugin asset: ${url}`);
  }
}

function createScriptLoader(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[data-plugin-asset-url="${CSS.escape(url)}"]`
    );

    if (existingScript?.dataset.loaded === "true") {
      resolve();
      return;
    }

    const handleLoad = () => {
      existingScript?.setAttribute("data-loaded", "true");
      resolve();
    };
    const handleError = () => {
      reject(new Error(`Failed to load plugin asset: ${url}`));
    };

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.pluginAssetUrl = url;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => {
      reject(new Error(`Failed to load plugin asset: ${url}`));
    }, { once: true });
    document.head.appendChild(script);
  });
}

export function loadPluginAsset(url: string): Promise<void> {
  try {
    assertSameOriginAsset(url);
  } catch (error) {
    return Promise.reject(error);
  }

  const existingPromise = assetPromises.get(url);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = createScriptLoader(url).catch((error: unknown) => {
    assetPromises.delete(url);
    throw error;
  });
  assetPromises.set(url, promise);
  return promise;
}

```

### Core Architecture Module: `AdminPanel-Vue/src/dashboard/core/types.ts`
```
export interface DashboardCardSize {
  desktopCols: number;
  tabletCols: number;
  rows: number;
}

export interface DashboardCardContributionBase {
  typeId: string;
  title: string;
  description: string;
  source: "builtin" | "plugin";
  pluginName?: string;
  singleton: boolean;
  defaultEnabled: boolean;
  legacyId?: string | null;
  defaultSize: DashboardCardSize;
  minSize: DashboardCardSize;
  maxSize: DashboardCardSize;
}

export interface BuiltinCardRenderer {
  kind: "builtin";
  componentKey: string;
  buildProps: (state: Record<string, unknown>) => Record<string, unknown>;
}

export interface BuiltinDashboardCardContribution extends DashboardCardContributionBase {
  source: "builtin";
  renderer: BuiltinCardRenderer;
}

export interface PluginBuiltinDashboardCardContribution extends DashboardCardContributionBase {
  source: "plugin";
  pluginName: string;
  renderer: BuiltinCardRenderer;
}

export interface WebComponentDashboardCardContribution extends DashboardCardContributionBase {
  source: "plugin";
  pluginName: string;
  renderer: {
    kind: "web-component";
    tagName: string;
    publicPath: string;
  };
}

export type DashboardCardContribution =
  | BuiltinDashboardCardContribution
  | PluginBuiltinDashboardCardContribution
  | WebComponentDashboardCardContribution;

export interface DashboardCardInstance {
  instanceId: string;
  typeId: string;
  enabled: boolean;
  order: number;
  size: DashboardCardSize;
  config: Record<string, unknown>;
}

export interface DashboardLayoutStateV2 {
  version: 2;
  instances: DashboardCardInstance[];
  dismissedTypeIds: string[];
}

export type DashboardDropPlacement = "before" | "after";

export const DASHBOARD_LAYOUT_V2_STORAGE_KEY = "dashboard.layout.v2";
export const DASHBOARD_LEGACY_ORDER_STORAGE_KEY = "dashboard.card-order";
export const DASHBOARD_LEGACY_SIZES_STORAGE_KEY = "dashboard.card-sizes";

export const GENERIC_DASHBOARD_CARD_MIN_SIZE: DashboardCardSize = {
  desktopCols: 1,
  tabletCols: 1,
  rows: 4,
};

export const GENERIC_DASHBOARD_CARD_MAX_SIZE: DashboardCardSize = {
  desktopCols: 12,
  tabletCols: 6,
  rows: 60,
};

export function clampDashboardCardSize(
  size: Partial<DashboardCardSize> | undefined,
  fallback: DashboardCardSize,
  minSize: DashboardCardSize,
  maxSize: DashboardCardSize
): DashboardCardSize {
  const desktopCols = clampInteger(
    size?.desktopCols,
    fallback.desktopCols,
    minSize.desktopCols,
    maxSize.desktopCols
  );
  const tabletCols = clampInteger(
    size?.tabletCols,
    Math.min(fallback.tabletCols, desktopCols),
    minSize.tabletCols,
    Math.min(maxSize.tabletCols, desktopCols)
  );
  const rows = clampInteger(size?.rows, fallback.rows, minSize.rows, maxSize.rows);

  return {
    desktopCols,
    tabletCols,
    rows,
  };
}

export function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(numericValue)));
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

```

### Core Architecture Module: `AdminPanel-Vue/src/dashboard/core/useDashboardCatalog.ts`
```
import { computed, type ComputedRef } from "vue";
import type {
  PluginDashboardCardContribution,
  PluginInfo,
} from "@/types/api.plugin";
import { useAppStore } from "@/stores/app";
import { CardRegistry } from "@/dashboard/core/cardRegistry";
import type {
  BuiltinDashboardCardContribution,
  DashboardCardContribution,
} from "@/dashboard/core/types";

function toDashboardContribution(
  card: PluginDashboardCardContribution,
  pluginName: string
): DashboardCardContribution {
  if (card.renderer.kind === "builtin") {
    return {
      ...card,
      source: "plugin",
      pluginName,
      renderer: {
        kind: "builtin",
        componentKey: card.renderer.componentKey,
        buildProps: () => ({}),
      },
    };
  }

  return {
    ...card,
    source: "plugin",
    pluginName,
    renderer: {
      kind: "web-component",
      tagName: card.renderer.tagName,
      publicPath: card.renderer.publicPath,
    },
  };
}

function normalizePluginCards(plugin: PluginInfo): DashboardCardContribution[] {
  if (!plugin.enabled || !Array.isArray(plugin.dashboardCards)) {
    return [];
  }

  return plugin.dashboardCards
    .filter((card): card is PluginDashboardCardContribution => Boolean(card))
    .map((card) => toDashboardContribution(card, card.pluginName || plugin.manifest.name));
}

export function useDashboardCatalog(
  builtinCards: ComputedRef<BuiltinDashboardCardContribution[]>
) {
  const appStore = useAppStore();

  const plugins = computed(() => appStore.plugins as PluginInfo[]);
  const pluginCards = computed<DashboardCardContribution[]>(() =>
    plugins.value.flatMap((plugin) => normalizePluginCards(plugin))
  );
  const cards = computed<DashboardCardContribution[]>(() => [
    ...builtinCards.value,
    ...pluginCards.value,
  ]);
  const registry = computed(() => {
    const nextRegistry = new CardRegistry();
    nextRegistry.registerMany(cards.value);
    return nextRegistry;
  });
  const contributionMap = computed(() => {
    return new Map(cards.value.map((card) => [card.typeId, card] as const));
  });
  const legacyIdMap = computed(() => {
    return new Map(
      cards.value
        .filter((card) => card.legacyId)
        .map((card) => [card.legacyId as string, card] as const)
    );
  });
  const catalogReady = computed(() => appStore.pluginsLoaded);

  return {
    cards,
    catalogReady,
    contributionMap,
    legacyIdMap,
    pluginCards,
    registry,
  };
}

```

### Core Architecture Module: `AdminPanel-Vue/src/dashboard/core/useDashboardLayoutV2.ts`
```
import { computed, watch, type ComputedRef } from "vue";
import { useLocalStorage } from "@/composables/useLocalStorage";
import type { DashboardCardContribution, DashboardCardInstance, DashboardLayoutStateV2 } from "@/dashboard/core/types";
import {
  clampDashboardCardSize,
  DASHBOARD_LAYOUT_V2_STORAGE_KEY,
  DASHBOARD_LEGACY_ORDER_STORAGE_KEY,
  DASHBOARD_LEGACY_SIZES_STORAGE_KEY,
  GENERIC_DASHBOARD_CARD_MAX_SIZE,
  GENERIC_DASHBOARD_CARD_MIN_SIZE,
  isPlainObject,
  type DashboardCardSize,
} from "@/dashboard/core/types";

interface LegacyLayoutSnapshot {
  order: string[];
  sizes: Record<string, Partial<DashboardCardSize>>;
}

interface DashboardResolvedLayout {
  instances: DashboardCardInstance[];
  dismissedTypeIds: string[];
}

function serializeLayout(layout: DashboardLayoutStateV2): string {
  return JSON.stringify(layout);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function generateInstanceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createCardInstance(
  contribution: DashboardCardContribution,
  order: number,
  sizeOverride?: Partial<DashboardCardSize>
): DashboardCardInstance {
  return {
    instanceId: generateInstanceId(),
    typeId: contribution.typeId,
    enabled: true,
    order,
    size: clampDashboardCardSize(
      sizeOverride,
      contribution.defaultSize,
      contribution.minSize,
      contribution.maxSize
    ),
    config: {},
  };
}

function normalizeInstanceOrder(instances: readonly DashboardCardInstance[]): DashboardCardInstance[] {
  return [...instances]
    .sort((left, right) => left.order - right.order)
    .map((instance, index) => ({
      ...instance,
      order: index,
    }));
}

function sanitizeGenericInstance(rawInstance: unknown): DashboardCardInstance | null {
  if (!isPlainObject(rawInstance)) {
    return null;
  }

  const instanceId =
    typeof rawInstance.instanceId === "string" && rawInstance.instanceId.trim().length > 0
      ? rawInstance.instanceId
      : generateInstanceId();
  const typeId =
    typeof rawInstance.typeId === "string" && rawInstance.typeId.trim().length > 0
      ? rawInstance.typeId
      : null;

  if (!typeId) {
    return null;
  }

  const fallbackSize: DashboardCardSize = {
    desktopCols: 6,
    tabletCols: 6,
    rows: 16,
  };

  return {
    instanceId,
    typeId,
    enabled: rawInstance.enabled !== false,
    order: typeof rawInstance.order === "number" ? rawInstance.order : 0,
    size: clampDashboardCardSize(
      isPlainObject(rawInstance.size) ? rawInstance.size : undefined,
      fallbackSize,
      GENERIC_DASHBOARD_CARD_MIN_SIZE,
      GENERIC_DASHBOARD_CARD_MAX_SIZE
    ),
    config: isPlainObject(rawInstance.config) ? rawInstance.config : {},
  };
}

function sanitizeStoredLayoutValue(rawLayout: unknown): DashboardLayoutStateV2 | null {
  if (!isPlainObject(rawLayout)) {
    return null;
  }

  const instances = Array.isArray(rawLayout.instances)
    ? rawLayout.instances
        .map((instance) => sanitizeGenericInstance(instance))
        .filter((instance): instance is DashboardCardInstance => instance !== null)
    : [];
  const dismissedTypeIds = Array.isArray(rawLayout.dismissedTypeIds)
    ? uniqueStrings(rawLayout.dismissedTypeIds)
    : [];

  return {
    version: 2,
    instances: normalizeInstanceOrder(instances),
    dismissedTypeIds,
  };
}

function readLegacyLayoutSnapshot(): LegacyLayoutSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedOrder = window.localStorage.getItem(DASHBOARD_LEGACY_ORDER_STORAGE_KEY);
    const storedSizes = window.localStorage.getItem(DASHBOARD_LEGACY_SIZES_STORAGE_KEY);
    const parsedOrder = storedOrder ? JSON.parse(storedOrder) : [];
    const parsedSizes = storedSizes ? JSON.parse(storedSizes) : {};

    return {
      order: Array.isArray(parsedOrder)
        ? parsedOrder.filter((item): item is string => typeof item === "string")
        : [],
      sizes: isPlainObject(parsedSizes)
        ? (parsedSizes as Record<string, Partial<DashboardCardSize>>)
        : {},
    };
  } catch {
    return null;
  }
}

function buildDefaultInstances(
  contributions: readonly DashboardCardContribution[],
  dismissedTypeIds: readonly string[]
): DashboardCardInstance[] {
  return contributions
    .filter(
      (contribution) =>
        contribution.defaultEnabled && !dismissedTypeIds.includes(contribution.typeId)
    )
    .map((contribution, index) => createCardInstance(contribution, index));
}

function buildInstancesFromLegacy(
  legacySnapshot: LegacyLayoutSnapshot,
  contributions: readonly DashboardCardContribution[]
): DashboardCardInstance[] {
  const legacyMap = new Map(
    contributions
      .filter((contribution) => contribution.legacyId)
      .map((contribution) => [contribution.legacyId as string, contribution] as const)
  );

  return legacySnapshot.order.flatMap((legacyId, index) => {
    const contribution = legacyMap.get(legacyId);
    if (!contribution) {
      return [];
    }

    return [
      createCardInstance(
        contribution,
        index,
        legacySnapshot.sizes[legacyId]
      ),
    ];
  });
}

function hydrateInstancesWithCatalog(
  instances: readonly DashboardCardInstance[],
  contributions: readonly DashboardCardContribution[]
): DashboardCardInstance[] {
  const contributionMap = new Map(
    contributions.map((contribution) => [contribution.typeId, contribution] as const)
  );
  const seenSingletonTypes = new Set<string>();

  return normalizeInstanceOrder(
    instances.flatMap((instance) => {
      const contribution = contributionMap.get(instance.typeId);
      if (contribution?.singleton) {
        if (seenSingletonTypes.has(instance.typeId)) {
          return [];
        }

        seenSingletonTypes.add(instance.typeId);
      }

      const size = contribution
        ? clampDashboardCardSize(
            instance.size,
            contribution.defaultSize,
            contribution.minSize,
            contribution.maxSize
          )
        : clampDashboardCardSize(
            instance.size,
            instance.size,
            GENERIC_DASHBOARD_CARD_MIN_SIZE,
            GENERIC_DASHBOARD_CARD_MAX_SIZE
          );

      return [
        {
          ...instance,
          size,
          config: isPlainObject(instance.config) ? instance.config : {},
        },
      ];
    })
  );
}

function resolveLayout(
  rawLayout: DashboardLayoutStateV2 | null,
  contributions: readonly DashboardCardContribution[],
  catalogReady: boolean
): DashboardResolvedLayout {
  const storedLayout = sanitizeStoredLayoutValue(rawLayout);
  const dismissedTypeIds = storedLayout?.dismissedTypeIds ?? [];

  let nextInstances = storedLayout?.instances ?? [];

  if (nextInstances.length === 0) {
    if (catalogReady) {
      const legacySnapshot = readLegacyLayoutSnapshot();
      nextInstances =
        legacySnapshot && legacySnapshot.order.length > 0
          ? buildInstancesFromLegacy(legacySnapshot, contributions)
          : buildDefaultInstances(contributions, dismissedTypeIds);
    } else {
      nextInstances = buildDefaultInstances(contributions, dismissedTypeIds);
    }
  }

  const hydratedInstances = hydrateInstancesWithCatalog(nextInstances, contributions);
  const existingTypeIds = new Set(hydratedInstances.map((instance) => instance.typeId));
  const appendedInstances = catalogReady
    ? contributions
        .filter(
          (contribution) =>
            contribution.defaultEnabled &&
            contribution.singleton &&
            !dismissedTypeIds.includes(contribution.typeId) &&
            !existingTypeIds.has(contribution.typeId)
        )
        .map((contribution, index) =>
          createCardInstance(contribution, hydratedInstances.length + index)
        )
    : [];

  return {
    instances: normalizeInstanceOrder([...hydratedInstances, ...appendedInstances]),
    dismissedTypeIds,
  };
}

export function useDashboardLayoutV2(
  contributions: ComputedRef<DashboardCardContribution[]>,
  catalogReady: ComputedRef<boolean>
) {
  const rawLayout = useLocalStorage<DashboardLayoutStateV2 | null>(
    DASHBOARD_LAYOUT_V2_STORAGE_KEY,
    null,
    {
      parser: (value) => sanitizeStoredLayoutValue(JSON.parse(value) as unknown),
      serializer: (value) =>
        value === null
          ? "null"
          : serializeLayout({
              version: 2,
              instances: normalizeInstanceOrder(value.instances),
              dismissedTypeIds: uniqueStrings(value.dismissedTypeIds),
            }),
    }
  );

  const resolvedLayout = computed<DashboardResolvedLayout>(() =>
    resolveLayout(rawLayout.value, contributions.value, catalogReady.value)
  );
  const instances = computed<DashboardCardInstance[]>({
    get: () => resolvedLayout.value.instances,
    set: (nextInstances) => {
      rawLayout.value = {
        version: 2,
        instances: normalizeInstanceOrder(nextInstances),
        dismissedTypeIds: resolvedLayout.value.dismissedTypeIds,
      };
    },
  });

  watch(
    resolvedLayout,
    (nextLayout) => {
      if (!catalogReady.value && rawLayout.value === null) {
        return;
      }

      const normalizedNextLayout: DashboardLayoutStateV2 = {
        version: 2,
        instances: nextLayout.instances,
        dismissedTypeIds: nextLayout.dismissedTypeIds,
      };
      const currentLayout = sanitizeStoredLayoutValue(rawLayout.value);

      if (
        !currentLayout ||
        serializeLayout(currentLayout) !== serializeLayout(normalizedNextLayout)
      ) {
        rawLayout.value = normalizedNextLayout;
      }
    },
    { immediate: true }
  );

  function addCard(typeId: string): string | null {
    con
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #619** (2026-11-19): **fix(vexus-lite,server): 统一GlobalChunks与ReadPool单向锁序DAG根治并发死锁，并修复关机Phase2/Phase8阻塞**
  *Symptoms*: ## 一、动机与背景（问题现象）  在升级至 RiverMemo V5 原生双曲检索链路后，高并发会话场景下偶发两类相互关联的严重阻塞现象： 1. **RAG 浪潮召回静默挂起**：`RAGDiaryPlugin` 在完成外部 BM25 预筛并打印 `[RAGDiaryPlugin] BM25 file plan: mode=body, files=...`（标志进入 `canUseNativeRiverFullPath` 原生分支）后，后续检索无响应、无报错日志输出，且后台预设的 30 分钟超时清理器未触发。 2. **管理面板（AdminPanel）触发重启时卡死在 Phase 2 或 Phase 8**：    - 若在请求挂起期间直接点击网页端重启，主进程日志停留在 `Phase 2/10 - Preparing to close HTTP server. trackedSockets=10, activeHttpRequests=5`（`activeRequests=0`），等待满 60 秒后才触发 `forceShutdownTimer` 强制退出；    - 若先在前端点击停止（调用 `/v1/interrupt` 断开 SSE 流）再点击重启，则关机流程可越过 Phase 2，但会挂起在 `Phase 8/10 - pluginManager.shutdownAllPlugins start` 之后，且进程调用 `process.exit(1)` 后仍可能因底层原生线程锁死而驻留。  ---  ## 二、全链路排障与根因溯源过程（Root-Cause Trace）  为在不破坏现场的前提下定位本质原因，我们通过静态源码审计与非侵入式线程级 Lease 飞行记录仪（追踪每个线程持有的 `ReadPoolConn`、`GlobalChunksLock`、`PublicationGate` 与 `NapiTask` 时间戳）还原了 **25 毫秒内形成的跨线程池死锁现场**：  ### 1. 核心根因：`LightMemo` 与 `RiverMemo V5` 的锁序反转（Lock Order Inversion Deadlock） 在同一个 `NativeKnowledgeRuntime` 实例中，全局块表 `self.global_chunks`（`Arc<Mutex<Option<GlobalChunks>>>`）与容量为 `4` 的 SQLite 只读连接池 `read_pool` 被两类检索路径以**相反顺序**获取： - **正向路径（`NativeRiverQueryTask` 及 `execute_parallel_rerank`）**：   在 `knowledge_runtime.rs:2437, 2913` 中，先调用 `with_registered_read_transaction_napi` **从 `read_pool` 借出 1 条 SQLite 读连接（Level 2）**，开启读事务固定 WAL 快照后，再在 `knowledge_runtime.rs:648` 申请 **`source.table.lock()` 全局块表互斥锁（Level 3）**。 - **反向路径（`light_memo.rs` 中的 `LightMemoTask`、`GlobalChunkCheckpointTask`、`WarpedChunkPreparationTask`）**：   在 `light_memo.rs:21

- **Issue #618** (2026-11-18): **# feat(WarpedFieldAtlas): 读取 Tag 和 Chunk 双曲场训练快照，支持按节点或对话消息查询近邻**
  *Symptoms*:   ## 变更内容  - 新增 `Plugin/WarpedFieldAtlas/`。从知识库目录读取 Tag 训练快照 `.vcpwf`、Chunk（文本片段）训练快照 `.vcpwc` 和 SQLite 数据，返回场图、节点详情和查询结果。 - `/api/plugins/WarpedFieldAtlas/` 下的 `/status` 返回可用场和节点数，`/field/tag`、`/field/chunk` 返回场图。可从已有节点查询近邻，也可选取已有消息向量，查看同一条消息在两个场中的结果。 - 加载快照时，用快照自带的距离表逐项核对 JS 距离函数；不一致时停用查询视图。计算在工作线程中执行，十分钟无请求后释放。  ## 对现有功能的影响  新增 18 个文件，不修改后端核心文件、训练流程或原生检索。接口沿用后端认证，不调用模型或嵌入服务，不写知识库；布局等缓存只写入插件自己的 `state/`。  ## 验证  - 基于 `e22aeded` 运行 `node --test Plugin/WarpedFieldAtlas/geometry.test.js Plugin/WarpedFieldAtlas/layout.test.js Plugin/WarpedFieldAtlas/compact.test.js`，10 项通过。 - 在此前的上游基线 `5adb12bb` 上实际启动后端：无密钥请求返回 401；带密钥读取到 4292 个 Tag 节点、407 个片段节点，并完成查询。 - 同一基线上，用真实库副本中的 40 条消息对照原生检索。Tag 结果的先后次序检查通过 40/40，候选重合率 99.5%；打乱半径后的反向对照为 0/40。Chunk 场比较了 400 个分数，最大绝对差为 8.9e-16。更新基线后未在新的原生二进制上重跑这组对照。  ## 不在本次范围  多份快照并存时，插件选取的 Tag 预设或 Chunk 模型可能与原生检索不同。目前只展示训练快照，不读取训练后追加节点的 `.vcpwi` 文件，因此场图不是实时索引的完整视图。该限制不影响原生检索。

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

### Incident Patch 1: `a2c33d06` (2026-11-19)
**Commit Message**: Merge pull request #619 from infinite-vector/fix/vexus-lite-lock-order-dag-and-shutdown-drain

fix(vexus-lite,server): 统一GlobalChunks与ReadPool单向锁序DAG根治并发死锁，并修复关机Phase2/Phase8阻塞

**File**: `rust-vexus-lite/src/global_chunks.rs` (modified, +103/-59)
```diff
@@ -341,71 +341,92 @@ impl GlobalChunks {
         }
     }
 
-    /// Caller holds the Runtime table mutex and shared facts gate. Publication
-    /// is separate from queries; SQL member versions survive eviction/restart.
-    pub fn checkpoint(&mut self, db_path: &str, directory: &Path, database_generation: u64,
-        threshold: f64, allow_initial: bool) -> Result<bool, String> {
-        if !self.legacy_enabled { return Ok(false); }
+    pub(crate) fn prepare_checkpoint_in_tx(
+        &self,
+        connection: &Connection,
+        directory: &Path,
+        threshold: f64,
+        allow_initial: bool,
+    ) -> Result<Option<(i64, &'static str, Vec<u8>, String, Vec<ChunkHeader>)>, String> {
+        if !self.legacy_enabled { return Ok(None); }
         if !threshold.is_finite() || !(0.0..=1.0).contains(&threshold) {
             return Err("Invalid global Chunk checkpoint threshold".into());
         }
-        let (generation, active, allowed) =
-            crate::storage::with_registered_read_transaction(db_path, |connection| {
-                if facts(connection)? != self.facts {
-                    return Err("LIGHTMEMO_CHECKPOINT_GENERATION_CONFLICT".into());
-                }
-                let manifest: Option<(i64, String, i64, String, i64)> = connection.query_row(
-                    "SELECT generation,slot,dimension,model_sig,member_versions
-                     FROM global_chunk_index_baselines ORDER BY generation DESC LIMIT 1", [],
-                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
-                ).optional().map_err(|e| e.to_string())?;
-                let Some((generation, slot, dimension, model, versions)) = manifest else {
-                    let mut has_file = false;
-                    for slot in ["a", "b"] {
-                        match std::fs::metadata(slot_path(directory, slot)) {
-                            Ok(_) => has_file = true,
-                            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
-                            Err(error) => return Err(error.to_string()),
-                        }
+        let (generation, active, allowed) = (|| -> Result<(i64, String, bool), String> {
+            if facts(connection)? != self.facts {
+                return Err("LIGHTMEMO_CHECKPOINT_GENERATION_CONFLICT".into());
+            }
+            let manifest: Option<(i64, String, i64, String, i64)> = connection.query_row(
+                "SELECT generation,slot,dimension,model_sig,member_versions
+                 FROM global_chunk_index_baselines ORDER BY generation DESC LIMIT 1", [],
+                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
+            ).optional().map_err(|e| e.to_string())?;
+            let Some((generation, slot, dimension, model, versions)) = manifest else {
+                let mut has_file = false;
+                for slot in ["a", "b"] {
+                    match std::fs::metadata(slot_path(directory, slot)) {
+                        Ok(_) => has_file = true,
+                        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
+                        Err(error) => return Err(error.to_string()),
                     }
-                    return Ok((0, String::new(), allow_initial && !has_file));
-                };
-                if dimension != self.dimension as i64 || model != self.model {
-                    return Err("Global Chunk baseline model/dimension mismatch".into());
                 }
-                if !matches!(slot.as_str(), "a" | "b") {
-                    return Err("Invalid global Chunk baseline slot".into());
-                }
-                if versions != 1 {
-                    eprintln!("[LightMemo] Legacy Chunk baseline has no member versions; publication skipped");
-                    return Ok((generation, slot, false));
-                }
-                let mut statement = connection.prepare(
-                    "SELECT chunk_id,vector_version,metadata_version,file_version
-                     FROM global_chunk_index_baseline_entries WHERE generation=?1"
-                ).map_err(|e| e.to_string())?;
-                let baseline = statement.query_map([generation], |row| Ok((
-                    row.get::<_, i64>(0)?,
-                    (row.get::<_, i64>(1)?,row.get::<_, i64>(2)?,row.get::<_, i64>(3)?),
-                ))).map_err(|e| e.to_string())?
-                    .collect::<rusqlite::Result<HashMap<_,_>>>().map_err(|e| e.to_string())?;
-                let removed = baseline.keys().filter(|id| !self.rows.contains_key(id)).count();
-                let upserts = self.rows.values().filter(|row|
-                    baseline.get(&row.id) != Some(&(
-                        row.vector_version, row.metadata_version, row.file_version
-                    ))
-                ).count();
-                let delta = removed + upserts;
-                le
```

**File**: `rust-vexus-lite/src/light_memo.rs` (modified, +158/-31)
```diff
@@ -207,12 +207,14 @@ impl Task for LightMemoTask {
         }
         let _gate = crate::publication_gate::acquire_read(&self.db_path, &["*".into()])
             .map_err(Error::from_reason)?;
-        let mut resident = self.table.lock()
-            .map_err(|_| Error::from_reason("Global Chunk table lock poisoned"))?;
         let directory = std::path::Path::new(&self.db_path).parent().unwrap();
+        // Strictly enforce L1 (PublicationGate) -> L2 (ReadPoolConn) -> L3 (GlobalChunksLock)
+        // so LightMemo and RiverMemo V5 never invert lock acquisition order.
         let mut output = crate::storage::with_registered_read_transaction(
             &self.db_path, |connection| {
                 let generation = crate::storage::read_generation(connection)?;
+                let mut resident = self.table.lock()
+                    .map_err(|_| "Global Chunk table lock poisoned".to_string())?;
                 if resident.as_ref().is_some_and(|table|
                     !table.matches_model(self.dimension, &plan.model_sig)) {
                     *resident = None;
@@ -427,7 +429,7 @@ impl Task for LightMemoTask {
                 let results = if plan.engine_mode == "rivermemo" && !degraded {
                     river["results"].as_array().cloned().unwrap_or_default()
                 } else if plan.ab_mode { tdb.clone() } else { warped_top_k.clone() };
-                Ok(json!({
+                let out = json!({
                     "schema":"vcp-lightmemo-result-v1","results":results,
                     "tdbTopK":tdb,"river":river,
                     "warpedTopK":warped_top_k,"warpedRiver":warped_river,
@@ -454,12 +456,13 @@ impl Task for LightMemoTask {
                             "sketchRejected":routing_stats.sketch_rejected,
                             "peakPool":routing_stats.peak_pool,
                             "statisticalSketchFilter":plan.pelorus_sketch_margin.is_some()}}
-                }))
+                });
+                // TDB snapshot publication remains independently scheduled and policy-gated.
+                // Explicit warped AB may publish its separate rebuildable derived sidecar.
+                table.last_used = std::time::Instant::now();
+                Ok(out)
             },
         ).map_err(Error::from_reason)?;
-        // TDB snapshot publication remains independently scheduled and policy-gated.
-        // Explicit warped AB may publish its separate rebuildable derived sidecar.
-        resident.as_mut().unwrap().last_used = std::time::Instant::now();
         output["diagnostics"]["totalMs"] = json!(started.elapsed().as_secs_f64()*1000.);
         Ok(output.to_string())
     }
@@ -483,30 +486,61 @@ impl Task for GlobalChunkCheckpointTask {
     fn compute(&mut self) -> Result<String> {
         let _gate = crate::publication_gate::acquire_read(&self.db_path, &["*".into()])
             .map_err(Error::from_reason)?;
-        let mut resident = self.table.lock()
-            .map_err(|_| Error::from_reason("Global Chunk table lock poisoned"))?;
-        // Do not rebuild an evicted table just to persist it.
-        let Some(table) = resident.as_mut() else {
-            return Ok(json!({"published":false,"factsCommitted":false}).to_string());
-        };
-        if !table.matches_model(self.dimension, &self.model) {
-            return Err(Error::from_reason("Global Chunk checkpoint model mismatch"));
-        }
-        let last_used = table.last_used;
-        let synchronized = crate::storage::with_registered_read_transaction(&self.db_path, |connection| {
-            let generation = crate::storage::read_generation(connection)?;
-            table.synchronize(connection)?;
-            table.compact_if_needed(connection)?;
-            Ok(generation)
-        });
-        // Background checkpoint work is not retrieval activity, including
-        // failed synchronization and memory compaction.
-        table.last_used = last_used;
-        let generation = synchronized.map_err(Error::from_reason)?;
         let directory = std::path::Path::new(&self.db_path).parent()
             .ok_or_else(|| Error::from_reason("Invalid global Chunk database directory"))?;
-        let published = table.checkpoint(&self.db_path, directory, generation,
-            self.threshold, self.allow_initial).map_err(Error::from_reason)?;
+        // Acquire L2 (ReadPoolConn) before L3 (GlobalChunksLock), and complete
+        // baseline delta inspection on the same connection without re-entering read_pool.
+        let prepared = crate::storage::with_registered_read_transaction(&self.db_path, |connection| {
+            let mut resident = self.table.lock()
+                .map_err(|_| "Global Chunk table lock poisoned".to_string())?;
+            // Do not rebuild an evicted table just to persist it.
+            let Some(table) = resident.as_mut() else {
+                return Ok(None);
+            };
+            if !table.matches_model(self.dimension, &
```

**File**: `server.js` (modified, +42/-4)
```diff
@@ -249,7 +249,7 @@ function destroyIdleSockets() {
     console.log(`[Server] Destroyed ${destroyedCount} idle socket(s).`);
 }
 
-async function closeHttpServerGracefully() {
+async function closeHttpServerGracefully(maxWaitMs = 5000) {
     if (!server || typeof server.close !== 'function') {
         return;
     }
@@ -259,18 +259,31 @@ async function closeHttpServerGracefully() {
     destroyIdleSockets();
 
     await new Promise((resolve) => {
+        let settled = false;
+        const finish = () => {
+            if (settled) return;
+            settled = true;
+            clearTimeout(timer);
+            resolve();
+        };
+        const timer = setTimeout(() => {
+            console.warn(`[Server] server.close() still waiting on ${activeHttpRequests.size} active HTTP socket(s) after ${maxWaitMs}ms; proceeding to request drain/abort phase.`);
+            finish();
+        }, maxWaitMs);
+        if (typeof timer.unref === 'function') timer.unref();
+
         try {
             server.close((error) => {
                 if (error) {
                     console.error('[Server] Error while closing HTTP server:', error);
                 } else {
                     console.log('[Server] HTTP server stopped accepting new connections.');
                 }
-                resolve();
+                finish();
             });
         } catch (error) {
             console.error('[Server] Failed to invoke server.close():', error);
-            resolve();
+            finish();
         }
     });
 }
@@ -1645,6 +1658,19 @@ async function gracefulShutdown(exitCode = 0, reason = 'signal') {
                 console.log(`[Server][ShutdownTrace] Phase 4/10 - abort skipped, no remaining active requests`);
             }
 
+            if (activeHttpRequests.size > 0) {
+                console.warn(`[Server] Destroying ${activeHttpRequests.size} remaining active HTTP socket(s) after drain phase.`);
+                for (const socket of activeHttpRequests) {
+                    try {
+                        if (!socket.destroyed) socket.destroy();
+                    } catch (err) {
+                        console.error('[Server] Failed to destroy remaining socket:', err.message);
+                    }
+                }
+                activeHttpRequests.clear();
+            }
+            destroyIdleSockets();
+
             serverLifecycleState = SERVER_LIFECYCLE.SHUTTING_DOWN;
             console.log(`[Server][ShutdownTrace] Phase 5/10 - lifecycle switched to SHUTTING_DOWN`);
 
@@ -1667,7 +1693,19 @@ async function gracefulShutdown(exitCode = 0, reason = 'signal') {
 
             if (pluginManager) {
                 console.log(`[Server][ShutdownTrace] Phase 8/10 - pluginManager.shutdownAllPlugins start`);
-                await pluginManager.shutdownAllPlugins();
+                let pluginShutdownTimer = null;
+                await Promise.race([
+                    pluginManager.shutdownAllPlugins(),
+                    new Promise((resolve) => {
+                        pluginShutdownTimer = setTimeout(() => {
+                            console.warn('[Server] pluginManager.shutdownAllPlugins timed out after 10000ms; continuing to Phase 9.');
+                            resolve();
+                        }, 10000);
+                        if (typeof pluginShutdownTimer.unref === 'function') pluginShutdownTimer.unref();
+                    })
+                ]).finally(() => {
+                    if (pluginShutdownTimer) clearTimeout(pluginShutdownTimer);
+                });
                 console.log(`[Server][ShutdownTrace] Phase 8/10 - pluginManager.shutdownAllPlugins done`);
             } else {
                 console.log(`[Server][ShutdownTrace] Phase 8/10 - pluginManager shutdown skipped`);
```

---

### Incident Patch 2: `448ec0e4` (2026-11-19)
**Commit Message**: fix(vexus-lite,server): 统一GlobalChunks与ReadPool单向锁序DAG根治并发死锁，并修复关机Phase2/Phase8阻塞

**File**: `rust-vexus-lite/src/global_chunks.rs` (modified, +103/-59)
```diff
@@ -341,71 +341,92 @@ impl GlobalChunks {
         }
     }
 
-    /// Caller holds the Runtime table mutex and shared facts gate. Publication
-    /// is separate from queries; SQL member versions survive eviction/restart.
-    pub fn checkpoint(&mut self, db_path: &str, directory: &Path, database_generation: u64,
-        threshold: f64, allow_initial: bool) -> Result<bool, String> {
-        if !self.legacy_enabled { return Ok(false); }
+    pub(crate) fn prepare_checkpoint_in_tx(
+        &self,
+        connection: &Connection,
+        directory: &Path,
+        threshold: f64,
+        allow_initial: bool,
+    ) -> Result<Option<(i64, &'static str, Vec<u8>, String, Vec<ChunkHeader>)>, String> {
+        if !self.legacy_enabled { return Ok(None); }
         if !threshold.is_finite() || !(0.0..=1.0).contains(&threshold) {
             return Err("Invalid global Chunk checkpoint threshold".into());
         }
-        let (generation, active, allowed) =
-            crate::storage::with_registered_read_transaction(db_path, |connection| {
-                if facts(connection)? != self.facts {
-                    return Err("LIGHTMEMO_CHECKPOINT_GENERATION_CONFLICT".into());
-                }
-                let manifest: Option<(i64, String, i64, String, i64)> = connection.query_row(
-                    "SELECT generation,slot,dimension,model_sig,member_versions
-                     FROM global_chunk_index_baselines ORDER BY generation DESC LIMIT 1", [],
-                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
-                ).optional().map_err(|e| e.to_string())?;
-                let Some((generation, slot, dimension, model, versions)) = manifest else {
-                    let mut has_file = false;
-                    for slot in ["a", "b"] {
-                        match std::fs::metadata(slot_path(directory, slot)) {
-                            Ok(_) => has_file = true,
-                            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
-                            Err(error) => return Err(error.to_string()),
-                        }
+        let (generation, active, allowed) = (|| -> Result<(i64, String, bool), String> {
+            if facts(connection)? != self.facts {
+                return Err("LIGHTMEMO_CHECKPOINT_GENERATION_CONFLICT".into());
+            }
+            let manifest: Option<(i64, String, i64, String, i64)> = connection.query_row(
+                "SELECT generation,slot,dimension,model_sig,member_versions
+                 FROM global_chunk_index_baselines ORDER BY generation DESC LIMIT 1", [],
+                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
+            ).optional().map_err(|e| e.to_string())?;
+            let Some((generation, slot, dimension, model, versions)) = manifest else {
+                let mut has_file = false;
+                for slot in ["a", "b"] {
+                    match std::fs::metadata(slot_path(directory, slot)) {
+                        Ok(_) => has_file = true,
+                        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
+                        Err(error) => return Err(error.to_string()),
                     }
-                    return Ok((0, String::new(), allow_initial && !has_file));
-                };
-                if dimension != self.dimension as i64 || model != self.model {
-                    return Err("Global Chunk baseline model/dimension mismatch".into());
                 }
-                if !matches!(slot.as_str(), "a" | "b") {
-                    return Err("Invalid global Chunk baseline slot".into());
-                }
-                if versions != 1 {
-                    eprintln!("[LightMemo] Legacy Chunk baseline has no member versions; publication skipped");
-                    return Ok((generation, slot, false));
-                }
-                let mut statement = connection.prepare(
-                    "SELECT chunk_id,vector_version,metadata_version,file_version
-                     FROM global_chunk_index_baseline_entries WHERE generation=?1"
-                ).map_err(|e| e.to_string())?;
-                let baseline = statement.query_map([generation], |row| Ok((
-                    row.get::<_, i64>(0)?,
-                    (row.get::<_, i64>(1)?,row.get::<_, i64>(2)?,row.get::<_, i64>(3)?),
-                ))).map_err(|e| e.to_string())?
-                    .collect::<rusqlite::Result<HashMap<_,_>>>().map_err(|e| e.to_string())?;
-                let removed = baseline.keys().filter(|id| !self.rows.contains_key(id)).count();
-                let upserts = self.rows.values().filter(|row|
-                    baseline.get(&row.id) != Some(&(
-                        row.vector_version, row.metadata_version, row.file_version
-                    ))
-                ).count();
-                let delta = removed + upserts;
-                le
```

**File**: `rust-vexus-lite/src/light_memo.rs` (modified, +158/-31)
```diff
@@ -207,12 +207,14 @@ impl Task for LightMemoTask {
         }
         let _gate = crate::publication_gate::acquire_read(&self.db_path, &["*".into()])
             .map_err(Error::from_reason)?;
-        let mut resident = self.table.lock()
-            .map_err(|_| Error::from_reason("Global Chunk table lock poisoned"))?;
         let directory = std::path::Path::new(&self.db_path).parent().unwrap();
+        // Strictly enforce L1 (PublicationGate) -> L2 (ReadPoolConn) -> L3 (GlobalChunksLock)
+        // so LightMemo and RiverMemo V5 never invert lock acquisition order.
         let mut output = crate::storage::with_registered_read_transaction(
             &self.db_path, |connection| {
                 let generation = crate::storage::read_generation(connection)?;
+                let mut resident = self.table.lock()
+                    .map_err(|_| "Global Chunk table lock poisoned".to_string())?;
                 if resident.as_ref().is_some_and(|table|
                     !table.matches_model(self.dimension, &plan.model_sig)) {
                     *resident = None;
@@ -427,7 +429,7 @@ impl Task for LightMemoTask {
                 let results = if plan.engine_mode == "rivermemo" && !degraded {
                     river["results"].as_array().cloned().unwrap_or_default()
                 } else if plan.ab_mode { tdb.clone() } else { warped_top_k.clone() };
-                Ok(json!({
+                let out = json!({
                     "schema":"vcp-lightmemo-result-v1","results":results,
                     "tdbTopK":tdb,"river":river,
                     "warpedTopK":warped_top_k,"warpedRiver":warped_river,
@@ -454,12 +456,13 @@ impl Task for LightMemoTask {
                             "sketchRejected":routing_stats.sketch_rejected,
                             "peakPool":routing_stats.peak_pool,
                             "statisticalSketchFilter":plan.pelorus_sketch_margin.is_some()}}
-                }))
+                });
+                // TDB snapshot publication remains independently scheduled and policy-gated.
+                // Explicit warped AB may publish its separate rebuildable derived sidecar.
+                table.last_used = std::time::Instant::now();
+                Ok(out)
             },
         ).map_err(Error::from_reason)?;
-        // TDB snapshot publication remains independently scheduled and policy-gated.
-        // Explicit warped AB may publish its separate rebuildable derived sidecar.
-        resident.as_mut().unwrap().last_used = std::time::Instant::now();
         output["diagnostics"]["totalMs"] = json!(started.elapsed().as_secs_f64()*1000.);
         Ok(output.to_string())
     }
@@ -483,30 +486,61 @@ impl Task for GlobalChunkCheckpointTask {
     fn compute(&mut self) -> Result<String> {
         let _gate = crate::publication_gate::acquire_read(&self.db_path, &["*".into()])
             .map_err(Error::from_reason)?;
-        let mut resident = self.table.lock()
-            .map_err(|_| Error::from_reason("Global Chunk table lock poisoned"))?;
-        // Do not rebuild an evicted table just to persist it.
-        let Some(table) = resident.as_mut() else {
-            return Ok(json!({"published":false,"factsCommitted":false}).to_string());
-        };
-        if !table.matches_model(self.dimension, &self.model) {
-            return Err(Error::from_reason("Global Chunk checkpoint model mismatch"));
-        }
-        let last_used = table.last_used;
-        let synchronized = crate::storage::with_registered_read_transaction(&self.db_path, |connection| {
-            let generation = crate::storage::read_generation(connection)?;
-            table.synchronize(connection)?;
-            table.compact_if_needed(connection)?;
-            Ok(generation)
-        });
-        // Background checkpoint work is not retrieval activity, including
-        // failed synchronization and memory compaction.
-        table.last_used = last_used;
-        let generation = synchronized.map_err(Error::from_reason)?;
         let directory = std::path::Path::new(&self.db_path).parent()
             .ok_or_else(|| Error::from_reason("Invalid global Chunk database directory"))?;
-        let published = table.checkpoint(&self.db_path, directory, generation,
-            self.threshold, self.allow_initial).map_err(Error::from_reason)?;
+        // Acquire L2 (ReadPoolConn) before L3 (GlobalChunksLock), and complete
+        // baseline delta inspection on the same connection without re-entering read_pool.
+        let prepared = crate::storage::with_registered_read_transaction(&self.db_path, |connection| {
+            let mut resident = self.table.lock()
+                .map_err(|_| "Global Chunk table lock poisoned".to_string())?;
+            // Do not rebuild an evicted table just to persist it.
+            let Some(table) = resident.as_mut() else {
+                return Ok(None);
+            };
+            if !table.matches_model(self.dimension, &
```

**File**: `server.js` (modified, +42/-4)
```diff
@@ -249,7 +249,7 @@ function destroyIdleSockets() {
     console.log(`[Server] Destroyed ${destroyedCount} idle socket(s).`);
 }
 
-async function closeHttpServerGracefully() {
+async function closeHttpServerGracefully(maxWaitMs = 5000) {
     if (!server || typeof server.close !== 'function') {
         return;
     }
@@ -259,18 +259,31 @@ async function closeHttpServerGracefully() {
     destroyIdleSockets();
 
     await new Promise((resolve) => {
+        let settled = false;
+        const finish = () => {
+            if (settled) return;
+            settled = true;
+            clearTimeout(timer);
+            resolve();
+        };
+        const timer = setTimeout(() => {
+            console.warn(`[Server] server.close() still waiting on ${activeHttpRequests.size} active HTTP socket(s) after ${maxWaitMs}ms; proceeding to request drain/abort phase.`);
+            finish();
+        }, maxWaitMs);
+        if (typeof timer.unref === 'function') timer.unref();
+
         try {
             server.close((error) => {
                 if (error) {
                     console.error('[Server] Error while closing HTTP server:', error);
                 } else {
                     console.log('[Server] HTTP server stopped accepting new connections.');
                 }
-                resolve();
+                finish();
             });
         } catch (error) {
             console.error('[Server] Failed to invoke server.close():', error);
-            resolve();
+            finish();
         }
     });
 }
@@ -1645,6 +1658,19 @@ async function gracefulShutdown(exitCode = 0, reason = 'signal') {
                 console.log(`[Server][ShutdownTrace] Phase 4/10 - abort skipped, no remaining active requests`);
             }
 
+            if (activeHttpRequests.size > 0) {
+                console.warn(`[Server] Destroying ${activeHttpRequests.size} remaining active HTTP socket(s) after drain phase.`);
+                for (const socket of activeHttpRequests) {
+                    try {
+                        if (!socket.destroyed) socket.destroy();
+                    } catch (err) {
+                        console.error('[Server] Failed to destroy remaining socket:', err.message);
+                    }
+                }
+                activeHttpRequests.clear();
+            }
+            destroyIdleSockets();
+
             serverLifecycleState = SERVER_LIFECYCLE.SHUTTING_DOWN;
             console.log(`[Server][ShutdownTrace] Phase 5/10 - lifecycle switched to SHUTTING_DOWN`);
 
@@ -1667,7 +1693,19 @@ async function gracefulShutdown(exitCode = 0, reason = 'signal') {
 
             if (pluginManager) {
                 console.log(`[Server][ShutdownTrace] Phase 8/10 - pluginManager.shutdownAllPlugins start`);
-                await pluginManager.shutdownAllPlugins();
+                let pluginShutdownTimer = null;
+                await Promise.race([
+                    pluginManager.shutdownAllPlugins(),
+                    new Promise((resolve) => {
+                        pluginShutdownTimer = setTimeout(() => {
+                            console.warn('[Server] pluginManager.shutdownAllPlugins timed out after 10000ms; continuing to Phase 9.');
+                            resolve();
+                        }, 10000);
+                        if (typeof pluginShutdownTimer.unref === 'function') pluginShutdownTimer.unref();
+                    })
+                ]).finally(() => {
+                    if (pluginShutdownTimer) clearTimeout(pluginShutdownTimer);
+                });
                 console.log(`[Server][ShutdownTrace] Phase 8/10 - pluginManager.shutdownAllPlugins done`);
             } else {
                 console.log(`[Server][ShutdownTrace] Phase 8/10 - pluginManager shutdown skipped`);
```

#### Recent Merged Pull Requests:
- **PR #619** (2026-11-19): fix(vexus-lite,server): 统一GlobalChunks与ReadPool单向锁序DAG根治并发死锁，并修复关机Phase2/Phase8阻塞 (@infinite-vector)
- **PR #618** (2026-11-18): # feat(WarpedFieldAtlas): 读取 Tag 和 Chunk 双曲场训练快照，支持按节点或对话消息查询近邻 (@CI-IISATO)
- **PR #617** (2026-11-18): fix: 出站请求中降级无法投递的 Markdown data: 图片（避免上游 415/500） (@RoxyAsahi)
- **PR #616** (2026-11-18): feat(memo): 1% 阈值训练对纯追加窗口按依赖复用 Tag 局部残差 (@CI-IISATO)
- **PR #615** (closed): 驱动兼容性版本更新 (@TaoCultivator)
- **PR #614** (2026-11-18): RiverMemo V5.2：以属概念门控校准种差，移除独立直锚加分 (@lioensky)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Empirical Invariant Guard in global_chunks.rs

**RULE**:
When implementing operations in `rust-vexus-lite/src/global_chunks.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a2c33d06`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust-vexus-lite/src/global_chunks.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
    pub(crate) fn prepare_checkpoint_in_tx(
        &self,
        connection: &Connection,
        directory: &Path,
        threshold: f64,
        allow_initial: bool,
    ) -> Result<Option<(i64, &'static str, Vec<u8>, String, Vec<ChunkHeader>)>, String> {
        if !self.legacy_enabled { return Ok(None); }
        let (generation, active, allowed) = (|| -> Result<(i64, String, bool), String> {
            if facts(connection)? != self.facts {
                return Err("LIGHTMEMO_CHECKPOINT_GENERATION_CONFLICT".into());
            }
            let manifest: Option<(i64, String, i64, String, i64)> = connection.query_row(
                "SELECT generation,slot,dimension,model_sig,member_versions
                 FROM global_chunk_index_baselines ORDER BY generation DESC LIMIT 1", [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            ).optional().map_err(|e| e.to_string())?;
            let Some((generation, slot, dimension, model, versions)) = manifest else {
                let mut has_file = false;
                for slot in ["a", "b"] {
                    match std::fs::metadata(slot_path(directory, slot)) {
       
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
    /// Caller holds the Runtime table mutex and shared facts gate. Publication
    /// is separate from queries; SQL member versions survive eviction/restart.
    pub fn checkpoint(&mut self, db_path: &str, directory: &Path, database_generation: u64,
        threshold: f64, allow_initial: bool) -> Result<bool, String> {
        if !self.legacy_enabled { return Ok(false); }
        let (generation, active, allowed) =
            crate::storage::with_registered_read_transaction(db_path, |connection| {
                if facts(connection)? != self.facts {
                    return Err("LIGHTMEMO_CHECKPOINT_GENERATION_CONFLICT".into());
                }
                let manifest: Option<(i64, String, i64, String, i64)> = connection.query_row(
                    "SELECT generation,slot,dimension,model_sig,member_versions
                     FROM global_chunk_index_baselines ORDER BY generation DESC LIMIT 1", [],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
                ).optional().map_err(|e| e.to_string())?;
                let Some((generation, slot, dimension, model, versions)) = manifest else {
                    let m
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a2c33d06` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
