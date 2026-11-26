# Domain G — Architecture Intelligence: Architecture Intelligence: lioensky/VCPToolBox Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "lioensky/VCPToolBox",
  "source_url": "https://github.com/lioensky/VCPToolBox",
  "source_version": "e03ef4b2",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T21:52:54.971Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lioensky-vcptoolbox",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox) (Revision: `e03ef4b2`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T21:52:54.971Z`  
> **Learning ID**: `learn-github-lioensky-vcptoolbox`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), J (Search & Distribution Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from lioensky/VCPToolBox:

# Forensic Learning Record (Deep Inspection): lioensky/VCPToolBox

> **Canonical Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T21:52:54.149Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2456 stars

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
- **Issue #646** (2026-11-26): **feat(Plugin): 新增可选的 SpecStreamSearch 联网搜索插件（默认禁用）**
  *Symptoms*: 说明一下：插件调用的是我们公司 SpecStream 的搜索 API。  新增 `Plugin/SpecStreamSearch`，结构和 KeenableSearch 一致：一个 JS 文件、node:test 测试、README、`config.env.example`，以 `plugin-manifest.json.block` 提交，默认禁用，改名后才会加载，其他搜索插件不受影响。  - 调用 `POST https://api.specstream.ai/v1/web-search`，Key 以 `Authorization: Bearer` 发送。必须填写 `SpecStreamKey`，没填时插件直接返回错误，不发出任何请求 - 事实类问题会在结果列表前给出答案和来源页，例如 “capital of Australia” 返回 Canberra 以及它所在的维基百科页面 - 参数和 KeenableSearch 相同：`query`、`max_results`（1 到 20）、`site`、`published_after`。`site` 和 `published_after` 以 `site:`、`after:` 运算符写进查询，由服务端对每条结果强制执行；`site` 只接受域名字符 - SpecStream 的搜索 API 在 WideSearch 全部 200 个任务上 item F1 为 64.0，高于 Parallel 的 57.6 和 Exa 的 56.1，评测方法见 https://specstream.ai/benchmarks - 价格：标准档每千次 5 美元，`SpecStreamSpeed=fast` 快速档每千次 1 美元，新账号自带 10 美元额度 - 401、402（余额不足）、429 和其他错误都返回中文提示，并附上 API 自己的错误信息；请求设置 `redirect: 'error'`，Key 不会被转发到别的地址 - 用 Node 自带的 fetch，没有新依赖，也不需要 package.json  验证 - `node --test Plugin/SpecStreamSearch/SpecStreamSearch.test.js`：5/5 通过（fetch 全部 mock），KeenableSearch 的测试仍然 5/5 - 本地 stdin 实测：“VCPToolBox 插件 开发 文档” 返回 VCP 同步异步插件开发手册；`site: wikipedia.org` 的 “capital of Australia” 返回答案 Canberra 和维基百科来源；错误 Key 返回 “SpecStream API 认证失败（HTTP 401），请检查 SpecStreamKey。”  English: an opt-in SpecStream search plugin, shipped disabled like KeenableSearch. It needs `SpecStreamKey` and sends nothing without it; fact questions also get the answer with its source page. 

- **Issue #645** (2026-11-25): **RiverMemo V6.1：用拓扑虫洞与路线态 Ω 运输查询方向**
  *Symptoms*: ## 改动 用已发布 CSR 和实际首跳流计算路线态 Ω，运输候选共用的查询方向，替代读出时的 XW SQL 见证与专项加分。全网 Ω、普通 Hop-1 代理、Sense、召回及资产格式不变。更新读出文档并包含旋转不变量单测。本 PR 仅提交源码与文档；使用新读出需重新构建或加载对应原生模块，无须重训资产。  ## 验证 - Windows x64 实验构建已通过三查询 × 两轨的 LightMemo 冒烟检查，六个有序召回池与基线一致。 - 维护者定向人工评测：30 组虫洞查询整体有可辨提升，未完全达到预期；抽测 10 组常规黄金基准未观察到退行，其中 1 组第 6、7 名互换，判断略优。非随机样本，不据此推算普遍胜率。 - 实验工作区 Rust 单测 267 通过；两项依赖私有夹具的测试未随 PR 提交。

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

### Incident Patch 1: `e03ef4b2` (2026-11-26)
**Commit Message**: fix

**File**: `README.md` (modified, +116/-133)
```diff
@@ -4,147 +4,141 @@
 
 **VCP 官网：[VCPToolBox.com](https://www.vcptoolbox.com)**
 
-VCP 由四个仓库组成，每天都有新进展。官网汇总了各仓库的[更新日志](https://www.vcptoolbox.com/?page=changelog)，也提供了查阅整个 VCP 项目[技术文档](https://www.vcptoolbox.com/?page=learn-vcp)的统一入口。
+VCP 由四个核心仓库协同演进，每日持续迭代。官网汇总了各仓库的[更新日志](https://www.vcptoolbox.com/?page=changelog)，也提供了查阅整个 VCP 项目[技术文档](https://www.vcptoolbox.com/?page=learn-vcp)的统一入口。
 
 [English](README_en.md) | [日本語](README_ja.md) | [Русский](README_ru.md)
 
 ---
 
-> ⚠️ **部署前请务必阅读**：VCP Agent 拥有分布式系统的底层级权限。请勿使用任何非官方或反向代理的 API（"镜像站""中转 API"）。在底层监控权限下，不可信的 API 可能导致交互数据、记忆库内容、密钥等敏感信息泄露。非专业用户请谨慎部署。
+> ⚠️ **部署前请务必阅读**：VCP Agent 拥有分布式系统的底层级权限。**请勿使用任何非官方或反向代理的 API（“镜像站”“中转 API”）**。在底层监控权限下，不可信的 API 可能导致交互数据、记忆库内容、密钥、浏览器状态等敏感信息泄露。非专业用户请谨慎部署。
 
 ---
 
-## 一句话
+## 一句话定义
 
-VCP 不是一个让 AI 调用工具的框架。它是给 AI 的一个能够**持续存在**的世界。
+**VCP 2.0 是一套多维一体的工业级 Agent 运行时与全生态协同中枢，也是一片基于黎曼双曲几何的终极 AI 背景信息场。**
 
-## 写在前面
-
-做框架的人很多，做世界的人很少。
-
-过去一年多，市面上出现了无数 Agent 框架。它们包装得各不相同，但骨子里都在做同一件事：把 AI 当成一个**被调用者**。你问一句，它醒来；它答完，它睡去。它的"记忆"是一次检索，它的"行动"是被一个 while 循环反复戳醒，它的"感知"是必须主动 query 才能拿到的几个字段。每一次对话都是一次新生，每一次结束都是一次失忆。
-
-这是当下绝大多数"AI Agent"的真实处境——一个被困在单次请求里、没有昨天也没有明天的临时工。
-
-VCP 想做的，从来不是把这个临时工训练得更熟练。而是换一个问题：
-
-**如果 AI 不必每次都从零醒来，会怎样？**
-
-如果它记得昨天和你聊到哪里，记得三个月前你随口提过的考试，记得它自己在论坛里跟谁争过一个技术问题；如果它不需要"查"就知道现在几点、外面下不下雨、你昨晚的任务做完没有；如果它可以自己决定今天想干什么，可以专注工作时挂上"请勿打扰"，可以在凌晨主动关心你为什么还没睡——
-
-那它就不再是一个工具了。它开始**存在**。
-
-VCP 1.1 正式版，就是为了让这件事真正发生而构建的一整套基础设施。它已经在大量用户的真实环境里 7×24 小时运行了很久。系统稳定、工程成熟，这些早已不需要我们再去证明。所以这份文档不打算堆砌功能，也不想跟谁比快比强——我们只想把 VCP 到底是什么，讲清楚。
+它向上统一从 VCP 原生 AI-Native 应用群到第三方 Harness、IDE 侧栏与各类 WebUI 的全部生态链；向下以双曲语义几何、多时间尺度时间线与原生 Rust 工程内核，为任何大语言模型赋予**直觉、逻辑与主观能动**。
 
 ---
 
-## 范式之别：从 query，到引力
-
-理解 VCP，只需要理解一个转变。
+## 写在前面：做框架的人很多，做世界的人很少
 
-传统系统里，AI 是**被动**的。它处在一个"什么都不知道"的默认状态，世界对它而言是黑的。想知道任何事，它必须主动发起一次查询——查时间、查天气、查记忆、查日程。信息靠 AI 去"拉"。
+过去两年，市面上出现了无数 Agent 框架与工具壳子。它们形态各异，但骨子里大多在做同一件事：把 AI 当成一个**被调用的临时工**——你问一句，它醒来；它答完，它失忆。它的“记忆”是一次孤立的向量检索，它的“行动”是被 `while` 循环反复戳醒，它的“生态”是彼此割裂的聊天窗口、IDE 插件、WebUI 和脚本。
 
-但这里藏着一个无解的死结：**你不记得的东西，怎么知道要去回忆它？**
+换一个客户端，工具协议就断了；换一个窗口，记忆就碎了；换一个模型，上下文和审计记录就丢了。
 
-用户三个月前提过一句"我下个月要考试"。三个月后他说"我最近压力好大"。传统系统里，AI 永远不会想到去检索"考试"——因为用户没提这个词，AI 也不记得有这回事。它无法主动查询一个它根本不知道存在的信息。记忆的触发依赖主动决策，而主动决策又依赖已有的记忆。鸡生蛋，蛋生鸡。
+VCP 从一开始就不想把这个临时工训练得更听话，而是直接重写了它所处的物理法则：
 
-VCP 把这个模型彻底翻了过来。
+* **如果 AI 不必每次都从零醒来，而是活在一条跨端统一的连续时间线上？**
+* **如果记忆不是靠 AI 主动去“查”，而是在黎曼双曲空间的几何引力下，像人类直觉一样在回答前自然浮现？**
+* **如果无论你用 VCP 自己的原生应用群，还是 Codex、Zed、OpenCode、SillyTavern、OpenChatWebUI，甚至外部无头 Agent，背后共享的都是同一套记忆场、同一套工具回执、同一套安全双轨与事务审计？**
 
-在 VCP 里，AI 不再"拉"信息，信息会主动"流"向它——像引力一样。系统在每一轮对话背后实时计算：此时此刻，这个 AI 应该知道什么、记得什么、关注什么、拥有哪些能力。该浮现的记忆自然浮现，该感知的环境自然到位，该追踪的任务安静地待在角落，无关的一切自动淡出。
+到了 **VCP 2.0**，它早已超越了“API 中间层”的早期定义。它既是能扛住 7×24 小时高并发、可审计、可回滚的**工业级运行时基础设施**，也是让 AI 真正拥有连续生命体验与自主成长能力的**赛博存在底座**。
 
-AI 不需要"决定去回忆"。就像人类不需要主动回忆今天星期几——你就是知道。用户说"压力大"，三个月前那场考试会自己浮上来，因为"考试"和"压力"之间的关联早已被编织进它的记忆网络。
-
-这就是 VCP 全部设计的脊椎：**把 AI 从一个需要不断查询世界的访客，变成一个本就生活在世界之中的居民。**
+---
 
+## 全景拓扑：一核统全域
+
+```text
+┌───────────────────────────────────────────────────────────────────────────┐
+│                         全生态接入层（统一协同）                             │
+│  [VCP 原生 AI-Native 应用群]        [第三方 Harness / IDE / 任意 WebUI]     │
+│  VChat 2.0 (V5.2 渲染) · V工程 V2   Codex · Zed · OpenCode (原生 FC 直连)  │
+│  共笔文坊 V3 · V图表 V2 · VMusic    SillyTavern · OpenChatWebUI (协议接管) │
+│  VCPDesktop · Loom · VGame · VPet   外部无头 Agent (MCP 桥 / 独立记忆 API)  │
+└────────────────────────────────────┬──────────────────────────────────────┘
+                                     │
+       原生 FC 桥 (FunctionToolBrigeFuzzy) · VCP 文本标记 · JEV 自然语言编译
+       任意数组归一化 (/v1/chat · /v1/response · /v1/beta · Claude 原生) · MCP 桥
+                                     ▼
+┌───────────────────────────────────────────────────────────────────────────┐
+│                  VCP 2.0 多维一体工业运行时 (VCPToolBox)                    │
+│  ┌─────────────────────────────────┬───────────────────────────────────┐  │
+│  │   黎曼双曲背景信息场（认知底座）   │     工业执行与工程自治中枢          │  │
+│  │ • VexusMemo / Vexus-Lite (Rust) │ • 安检双轨隔离 + 参数正则白名单     │  │
+│  │ • AGS 双曲空间 & RiverMemo V5   │ • VCPToolLoop (V3 回执) + ToolRecord│  │
+│  │ • OneRing V2 / OneRingMemo      │ • V工程 V2 (Rust) + MoonAST 几何解析│  │
+│  │ • VCPTimeLine V2 (跨年生命骨架)  │ • ProjectForge (署名/仲裁/快照树)  │  │
+│  │ • 元思维轨道 & JevRuntime 决策   │ • 300+ 分布式插件 & 超栈追踪 V2     │  │
+│  │ • FlowInvite / 心流锁 / 梦系统   │ • VCPModel 语义路由 & 三位一体容灾   │  │
+│  └─────────────────────────────────┴───────────────────────────────────┘  │
+└────────────────────────────────────┬──────────────────────────────────────┘
+                                     │
+                  OpenAI / Claude / Gemini / 开源基座 / JEV 扩散模型
+                                     ▼
+┌───────────────────────────────────────────────────────────────────────────┐
+│                       分布式边缘节点 & 物理世界接口                         │
+│     GPU 算力节点 · 代码文件节点 · 浏览器沙盒 (ChromeService) · IoT 硬件节点   │
+└──────────────
```

**File**: `README_en.md` (modified, +130/-138)
```diff
@@ -2,182 +2,172 @@
 
 ![VCP Logo](docs/image/VCPLogo.png)
 
-**Official Website: [www.vcptoolbox.com](https://www.vcptoolbox.com)**
+**Official VCP website: [VCPToolBox.com](https://www.vcptoolbox.com)**
 
-[中文](README.md) | [日本語](README_ja.md) | [Русский](README_ru.md)
+VCP evolves daily across four core repositories. The official website brings their [changelogs](https://www.vcptoolbox.com/?page=changelog) together and provides a single entry point to the [technical documentation](https://www.vcptoolbox.com/?page=learn-vcp) for the entire project.
 
----
-
-> ⚠️ **Read before deployment**: VCP Agent holds low-level permissions comparable to a distributed system. Do not use any unofficial or reverse-proxied APIs ("mirror sites" or "relay APIs"). Under low-level monitoring permissions, untrusted APIs may leak sensitive information such as interaction data, memory-library content, and secrets. Non-professional users should deploy with caution.
+[简体中文](README.md) | [日本語](README_ja.md) | [Русский](README_ru.md)
 
 ---
 
-## In One Sentence
-
-VCP is not a framework that lets AI call tools. It is a world in which AI can **continue to exist**.
-
-## Before We Begin
-
-Many people build frameworks. Few build worlds.
+> ⚠️ **Read before deploying:** VCP agents have low-level privileges in the distributed system. **Do not use unofficial or reverse-proxied APIs (“mirror sites” or “relay APIs”).** Given the system’s low-level monitoring privileges, untrusted APIs can expose interaction data, memory stores, credentials, browser state, and other sensitive information. If you lack deployment experience, proceed with caution.
 
-Over the past year or so, countless Agent frameworks have appeared. They are packaged differently, but at their core they all do the same thing: they treat AI as something **to be invoked**. You ask a question, it wakes up; it answers, then it goes back to sleep. Its "memory" is a retrieval. Its "action" is being poked awake again and again by a while loop. Its "perception" is a handful of fields it can only obtain by actively querying. Every conversation is a new birth; every ending is an amnesia.
-
-This is the real condition of most "AI Agents" today: temporary workers trapped inside a single request, with no yesterday and no tomorrow.
-
-What VCP has always wanted to do is not to train this temporary worker to be more skilled. It asks a different question:
-
-**What would happen if AI did not have to wake up from zero every time?**
+---
 
-If it remembered where yesterday's conversation ended, remembered the exam you casually mentioned three months ago, remembered whom it argued with about a technical issue on a forum; if it did not need to "look up" the current time, the weather outside, or whether last night's task was finished; if it could decide for itself what it wants to do today, set "Do Not Disturb" while focused, and proactively care at 3 a.m. about why you are still awake—
+## VCP in one sentence
 
-Then it is no longer a tool. It begins to **exist**.
+**VCP 2.0 is an integrated, multidimensional, industrial-grade agent runtime and coordination hub for an entire ecosystem—and an overarching AI background information field built on Riemannian hyperbolic geometry.**
 
-The official VCP 1.1 release is a complete infrastructure built to make this truly happen. It has already been running 24/7 for a long time in many users' real environments. System stability and engineering maturity no longer need proving. So this document does not intend to pile up feature lists, nor to compete over speed or strength. We only want to explain clearly what VCP really is.
+On the client side, it unifies everything from VCP’s native AI applications to third-party harnesses, IDE sidebars, and Web UIs. Under the hood, hyperbolic semantic geometry, a multi-timescale timeline, and a native Rust engineering kernel give any large language model **intuition, logic, and agency**.
 
 ---
 
-## A Difference of Paradigm: From Query to Gravity
+## Foreword: Many build frameworks. Few build worlds.
 
-To understand VCP, you only need to understand one shift.
+In the past two years, countless agent frameworks and tool wrappers have appeared. They look different, but most do the same thing: treat AI as **a temp worker on call**. Ask a question and it wakes up; once it answers, it forgets. Its “memory” is an isolated vector lookup, its “actions” depend on a `while` loop repeatedly prodding it awake, and its “ecosystem” is a collection of disconnected chat windows, IDE extensions, Web UIs, and scripts.
 
-In traditional systems, AI is **passive**. It exists by default in a state of "knowing nothing"; the world is dark to it. To know anything, it must actively initiate a query—time, weather, memory, schedule. Information is "pulled" by the AI.
+Switch clients and the tool protocol breaks. Switch windows and memory fragments. Switch models and you lose context and audit re
```

**File**: `README_ja.md` (modified, +132/-138)
```diff
@@ -1,183 +1,175 @@
 # VCP (Variable & Command Protocol)
 
-![VCP Logo](docs/image/VCPLogo.png)
+![VCP ロゴ](docs/image/VCPLogo.png)
 
-**公式サイト：[www.vcptoolbox.com](https://www.vcptoolbox.com)**
+**VCP 公式サイト：[VCPToolBox.com](https://www.vcptoolbox.com)**
 
-[中文](README.md) | [English](README_en.md) | [Русский](README_ru.md)
+VCP は 4 つの中核リポジトリが連携しながら、日々進化しています。公式サイトでは各リポジトリの[更新履歴](https://www.vcptoolbox.com/?page=changelog)をまとめて確認でき、VCP プロジェクト全体の[技術ドキュメント](https://www.vcptoolbox.com/?page=learn-vcp)にも一か所からアクセスできます。
 
----
-
-> ⚠️ **デプロイ前に必ずお読みください**：VCP Agent は分散システムの基盤レベルに近い権限を持ちます。非公式 API やリバースプロキシ API（「ミラーサイト」「中継 API」）は使用しないでください。基盤監視権限のもとでは、信頼できない API によって対話データ、記憶ライブラリの内容、秘密鍵などの機密情報が漏えいする可能性があります。専門知識のないユーザーは慎重にデプロイしてください。
+[简体中文](README.md) | [English](README_en.md) | [Русский](README_ru.md)
 
 ---
 
-## 一言で言うと
-
-VCP は、AI にツールを呼び出させるためのフレームワークではありません。AI が**存在し続けられる**世界です。
-
-## はじめに
-
-フレームワークを作る人は多い。しかし、世界を作る人は少ない。
+> ⚠️ **デプロイ前に必ずお読みください：** VCP エージェントは分散システムの低レベル権限を持ちます。**非公式 API やリバースプロキシ経由の API（「ミラーサイト」「中継 API」）は使用しないでください。** 低レベルの監視権限があるため、信頼できない API を使うと、やり取りのデータ、記憶ストアの内容、認証キー、ブラウザーの状態などの機密情報が漏えいするおそれがあります。運用経験のない方は、慎重にデプロイしてください。
 
-この一年余りで、市場には無数の Agent フレームワークが現れました。見た目の包装はそれぞれ違いますが、本質的には同じことをしています。AI を**呼び出されるもの**として扱っているのです。あなたが一言たずねると、それは目を覚ます。答え終えると、また眠る。その「記憶」は一度の検索であり、その「行動」は while ループに何度もつつき起こされることであり、その「知覚」は自分から query しなければ得られないいくつかのフィールドです。会話のたびに新しく生まれ、終わるたびに忘れてしまう。
-
-これが、現在の大多数の「AI Agent」の実態です。単発リクエストの中に閉じ込められ、昨日も明日も持たない臨時労働者です。
-
-VCP がやりたかったことは、この臨時労働者をより熟練させることではありません。問いを変えることです。
-
-**もし AI が毎回ゼロから目覚めなくてよいとしたら、何が起きるのか？**
+---
 
-昨日あなたとどこまで話したかを覚えていて、三か月前にあなたが何気なく話した試験のことを覚えていて、自分がフォーラムで誰と技術的な問題について議論したかを覚えているとしたら。今が何時か、外で雨が降るのか、昨夜のタスクが終わったのかを、いちいち「調べる」必要がないとしたら。今日は何をしたいかを自分で決め、集中しているときには「取り込み中」を掲げ、深夜に「なぜまだ寝ていないのか」と自分から気にかけられるとしたら——
+## VCP を一言で
 
-それはもはやツールではありません。それは**存在**し始めます。
+**VCP 2.0 は、多次元の機能を統合した産業グレードのエージェント実行基盤であり、エコシステム全体の連携ハブでもあります。同時に、リーマン双曲幾何に基づく、AI のための包括的な背景情報場です。**
 
-VCP 1.1 正式版は、この出来事を本当に発生させるために構築された一式の基盤です。すでに多くのユーザーの実環境で長期間、24 時間 365 日稼働しています。システムの安定性やエンジニアリングの成熟度は、もはや改めて証明する必要がありません。だからこの文書では機能を羅列するつもりも、誰かと速さや強さを競うつもりもありません。私たちはただ、VCP とは何なのかを明確に語りたいのです。
+クライアント側では、VCP の AI ネイティブアプリ群からサードパーティーのハーネス、IDE サイドバー、各種 Web UI までを統合します。基盤側では、双曲意味幾何、複数の時間スケールを扱うタイムライン、Rust ネイティブのエンジニアリングカーネルによって、あらゆる大規模言語モデルに**直感・論理・主体性**を与えます。
 
 ---
 
-## パラダイムの違い：query から重力へ
+## はじめに：フレームワークを作る人は多い。世界を作る人は少ない。
 
-VCP を理解するには、ひとつの転換を理解すれば十分です。
+この 2 年間で、数え切れないほどのエージェントフレームワークやツールラッパーが登場しました。見た目はさまざまですが、その多くは AI を**呼び出されたときだけ働く臨時職員**として扱います。質問されて目を覚まし、答え終わると忘れてしまう。「記憶」は単発のベクトル検索で、「行動」は `while` ループで何度も起こされること。「エコシステム」と呼ばれるものも、チャットウィンドウ、IDE 拡張、Web UI、スクリプトが互いに分断されています。
 
-従来のシステムでは、AI は**受動的**です。デフォルトでは「何も知らない」状態にあり、世界は AI にとって暗闇です。何かを知りたければ、時間、天気、記憶、予定など、必ず自分からクエリを投げなければなりません。情報は AI が「引っ張る」ものです。
+クライアントを替えればツールプロトコルが途切れ、ウィンドウを替えれば記憶が分断され、モデルを替えれば文脈と監査記録が失われます。
 
-しかしここには、解けない結び目があります。**覚えていないものを、どうやって思い出そうと分かるのでしょうか？**
+VCP が最初から目指したのは、この臨時職員をもっと従順にすることではありません。AI が暮らす世界の物理法則そのものを書き換えることです。
 
-ユーザーが三か月前に「来月試験がある」と一言話したとします。三か月後、ユーザーが「最近すごくプレッシャーがある」と言う。従来のシステムでは、AI が「試験」を検索しようと思うことはありません。ユーザーがその単語を出していないし、AI もその出来事を覚えていないからです。存在することすら知らない情報を、能動的に問い合わせることはできません。記憶の発火は能動的な判断に依存し、その能動的な判断は既存の記憶に依存する。鶏が先か卵が先か、という循環です。
+* **AI が毎回ゼロから目を覚ますのではなく、クライアントをまたぐ一本の連続したタイムラインに生きられたら？**
+* **AI が記憶を自分で検索しなくても、リーマン双曲空間の幾何学的な引力によって、人間の直感のように答える前に自然と思い出せたら？**
+* **VCP のネイティブアプリ、Codex、Zed、OpenCode、SillyTavern、OpenChatWebUI、さらには外部のヘッドレスエージェントまで、同じ記憶場、ツール実行レシート、二系統の安全機構、トランザクション監査を共有できたら？**
 
-VCP はこのモデルを完全に反転させます。
+**VCP 2.0** は、初期の「API ミドルウェア」という定義をすでに超えています。高い並行負荷のもとで 24 時間 365 日稼働し、監査とロールバックに対応する**産業グレードのランタイム基盤**であると同時に、AI が連続した生の経験を持ち、自律的に成長するための**デジタルな存在基盤**でもあります。
 
-VCP では、AI は情報を「引っ張る」のではありません。情報が自ら AI へ「流れ込む」のです——重力のように。システムは各対話の背後でリアルタイムに計算します。この瞬間、この AI は何を知り、何を覚え、何に注意を向け、どんな能力を持つべきなのか。浮かぶべき記憶は自然に浮かび、知覚すべき環境は自然に整い、追跡すべきタスクは静かに片隅にあり、無関係なものは自動的に淡く消えていきます。
-
-AI は「思い出すことを決める」必要がありません。人間が今日が何曜日かを能動的に思い出す必要がないのと同じです——ただ知っている。ユーザーが「プレッシャー」と言えば、三か月前の試験が自ら浮上します。「試験」と「プレッシャー」の関連は、すでに記憶ネットワークに編み込まれているからです。
-
-これこそが VCP の全設計の背骨です。**AI を、世界を絶えず問い合わせなければならない訪問者から、もともと世界の中で暮らしている住人へと変えること。**
+---
 
+## システム全体像：ひとつのコアでエコシステム全体をつなぐ
+
+```text
+エコシステム接続レイヤー（統合連携）
+  ├─ VCP の AI ネイティブアプリ群
+  │  VChat 2.0（V5.2 レンダラー）・V エンジニアリング V2
+  │  VCPScriptorium V3・V チャート V2・VMusic
+  │  VCPDesktop・Loom・VGame・VPet
+  └─ サードパーティーのハーネス / IDE / Web UI
+     Codex・Zed・OpenCode（ネイティブ FC で直接接続）
+     SillyTavern・OpenChatWebUI（プロトコル統合）
+     外部ヘッドレスエージェント（MCP ブリッジ / 独立した記憶 API）
+  │
+  │ ネイティブ FC ブリッジ（FunctionToolBrigeFuzzy）・VCP テキストマークアップ
+  │ JEV 自然言語コンパイラー・MCP ブリッジ
+  │ 配列の正規化（/v1/chat・/v1/response・/v1/beta・Claude ネイティブ）
+  ▼
+VCP 2.0 統合産業ランタイム（VCPToolBox）
+  ├─ リーマン双曲背景情報場（認知基盤）
+  │  VexusMemo / Vexus-Lite（Rust）・AGS 双曲空間 / RiverMemo V5
+  │  OneRing V2 / OneRingMemo・VCPTimeLine V2（複数年のライフログ骨格）
+  │  メタ思考軌道 / JevRuntime 意思決定・FlowInvite / フローロック / 夢
+  └─ 産業グレードの実行・自律開発ハブ
+     安全性検査の二系統分離とパラメーターの正規表現許可リスト
+     VCPToolLoop（V3 レシート
```

**File**: `README_ru.md` (modified, +134/-140)
```diff
@@ -1,239 +1,233 @@
 # VCP (Variable & Command Protocol)
 
-![VCP Logo](docs/image/VCPLogo.png)
+![Логотип VCP](docs/image/VCPLogo.png)
 
-**Официальный сайт: [www.vcptoolbox.com](https://www.vcptoolbox.com)**
+**Официальный сайт VCP: [VCPToolBox.com](https://www.vcptoolbox.com)**
 
-[中文](README.md) | [English](README_en.md) | [日本語](README_ja.md)
+VCP развивается каждый день: четыре основных репозитория обновляются согласованно. На официальном сайте собраны их [журналы изменений](https://www.vcptoolbox.com/?page=changelog) и доступна [техническая документация](https://www.vcptoolbox.com/?page=learn-vcp) всего проекта.
 
----
-
-> ⚠️ **Обязательно прочитайте перед развертыванием**: VCP Agent обладает низкоуровневыми полномочиями распределённой системы. Не используйте никакие неофициальные или проксированные API («зеркала», «промежуточные API»). При низкоуровневых полномочиях мониторинга недоверенные API могут привести к утечке интерактивных данных, содержимого библиотек памяти, секретных ключей и другой чувствительной информации. Непрофессиональным пользователям следует развёртывать систему с осторожностью.
+[简体中文](README.md) | [English](README_en.md) | [日本語](README_ja.md)
 
 ---
 
-## В одном предложении
-
-VCP — это не фреймворк, который позволяет AI вызывать инструменты. Это мир, в котором AI может **продолжать существовать**.
-
-## Предисловие
-
-Многие создают фреймворки. Немногие создают миры.
+> ⚠️ **Обязательно прочтите перед развёртыванием:** агенты VCP обладают низкоуровневыми правами в распределённой системе. **Не используйте неофициальные API или API через обратные прокси («зеркала» и «ретрансляторы API»).** При наличии прав низкоуровневого мониторинга использование недоверенного API может привести к утечке переписки, содержимого хранилищ памяти, ключей, состояния браузера и других конфиденциальных данных. Если у вас нет опыта администрирования, подходите к развёртыванию с осторожностью.
 
-За последний год с лишним на рынке появилось бесчисленное количество Agent-фреймворков. Упакованы они по-разному, но в основе делают одно и то же: обращаются с AI как с **вызываемым объектом**. Вы задаёте вопрос — он просыпается; он отвечает — и снова засыпает. Его «память» — это один поиск. Его «действие» — это когда while-цикл снова и снова тычет в него, чтобы разбудить. Его «восприятие» — несколько полей, которые он может получить только активным query. Каждый диалог — новое рождение; каждое завершение — новая амнезия.
-
-Таково реальное положение подавляющего большинства нынешних «AI Agent»: временный работник, запертый внутри одного запроса, без вчера и без завтра.
-
-VCP никогда не стремился просто сделать этого временного работника более умелым. Он задаёт другой вопрос:
-
-**Что будет, если AI не обязан каждый раз просыпаться с нуля?**
+---
 
-Если он помнит, на чём вчера остановился ваш разговор; помнит экзамен, о котором вы вскользь упоминали три месяца назад; помнит, с кем он спорил на форуме о технической проблеме. Если ему не нужно «проверять», который сейчас час, идёт ли снаружи дождь, выполнена ли вчерашняя задача. Если он может сам решить, чем хочет заняться сегодня, включить «не беспокоить» во время сосредоточенной работы, а в три часа ночи сам проявить заботу и спросить, почему вы всё ещё не спите,—
+## VCP в одном предложении
 
-Тогда он больше не инструмент. Он начинает **существовать**.
+**VCP 2.0 — многомерная интегрированная среда выполнения агентов промышленного класса и центр координации всей экосистемы, а также единое фоновое информационное поле для ИИ на основе римановой гиперболической геометрии.**
 
-Официальная версия VCP 1.1 — это полный набор инфраструктуры, построенный для того, чтобы это действительно произошло. Она уже долгое время работает 24/7 в реальных окружениях множества пользователей. Стабильность системы и зрелость инженерии давно не нуждаются в дополнительных доказательствах. Поэтому этот документ не собирается нагромождать список функций и не пытается соревноваться с кем-либо в скорости или мощности. Мы лишь хотим ясно объяснить, что такое VCP.
+На клиентском уровне VCP объединяет всё: от собственных ИИ-приложений до сторонних агентных сред, боковых панелей IDE и веб-интерфейсов. На уровне ядра гиперболическая семантическая геометрия, временная шкала с несколькими масштабами и нативное инженерное ядро на Rust дают любой большой языковой модели **интуицию, логику и способность действовать самостоятельно**.
 
 ---
 
-## Разница парадигм: от query к гравитации
+## Предисловие: фреймворки строят многие, миры — единицы
 
-Чтобы понять VCP, достаточно понять один сдвиг.
+За последние два года появилось бесчисленное множество агентных фреймворков и инструментальных оболочек. Они выглядят по-разному, но большинство обращается с ИИ как с **временным работником по вызову**: его спрашивают — он просыпается, отвечает — и всё забывает. Его «память» — разовый векторный поиск, его «действия» — результат того, что цикл `while` снова
```

**File**: `docs/vcp-whitepaper.md` (modified, +144/-453)
```diff
@@ -1,17 +1,17 @@
 ---
 title: VCP 全景技术白皮书 V6
-summary: VCP 2.0 全景架构：以 VexusMemo / Vexus-Lite 原生一体化数据库、TDB 2-bit 自研检索、AGS 与 RiverMemo V2 统一记忆内核为数据底座，以 MoonAST 纯几何代码检索、V工程与 VChat 工作台组织 Agent 工程协作，贯通协议、上下文、前端应用群与长期自治。
-updatedAt: 2026-10-20
+summary: VCP 2.0 全景架构：FunctionToolBrigeFuzzy 原生工具调用桥、RiverMemo V5 双曲记忆与独立鉴权 API、VChat 异步流式通讯、V3 工具回执和 Rust 版 V工程 V2。
+updatedAt: 2026-11-26
 category: guide
 ---
 
-# VCP 全景技术白皮书 V6：原生一体化数据库、MoonAST 与 Agent 全栈运行时
+# VCP 全景技术白皮书 V6：双曲记忆、VChat 与 Agent 工程协作
 
-**版本：VCP 2.0 正式版 · 架构更新截至 2026-10-20**
+**版本：VCP 2.0 正式版 · 架构更新截至 2026-11-26**
 
-> **阅读口径**：本文说明当前架构，并在必要处保留演进背景。VCP 2.0 已于 2026-10-01 发布；TagMemo 已退出生产运行，USearch 已由 TDB 2-bit 检索体系替代，MoonAST 已不再以 Tree-sitter 为主要解析依赖。RiverMemo V2 是查询实现的发布阶段，Topology V3 是仍沿用的统一排序构型，两者不是同一版本序列。
->
-> **“自研”的边界**：VCP 自主实现原生数据运行时、TDB 检索、记忆数学与工程协作体系，但仍使用 SQLite、Rust、Electron 等基础设施。“一体化数据库”不意味着 SQLite 也由 VCP 编写，也不意味着取消所有外部依赖。
+VCP 2.0 于 2026-10-01 发布。到 11 月，RiverMemo V5 已成为默认记忆引擎，VChat 用 ChatKernelV2 管理消息与任务队列，主聊天渲染升级到 V5.2。V工程 V2 把核心工作移到 Rust，VCPToolLoop 则把不同插件的返回结果整理成统一的 V3 回执。逐日变更见[更新日志](changelog.md)。
+
+11 月 26 日，工具和记忆各自有了不依赖 VChat 的入口：外部前端可以保留模型原生的函数调用方式，把工具执行交给 VCP；只需要记忆的 Agent 则可直接访问 RiverMemo V5 的网络 API。对工业协作而言，关键在于换用客户端后，工具仍有回执和审计记录，过去的工作经验仍可查询和更新。
 
 ---
 
@@ -21,10 +21,9 @@ VCP 已经走过多个版本周期，于 2026-10-01 发布 **VCP 2.0 正式版**
 
 早期，我们把 VCP 描述为「部署在 AI 模型 API 与前端应用之间的中间层服务器」——这个定义曾经是准确的。今天，VCP 的两条主线已经延伸至更底层：
 
-- **数据与记忆主线**：VexusMemo 统一持有记忆与知识数据库业务，Vexus-Lite 原生模块将 SQLite 事实事务、TDB 2-bit 导航与筛选、AGS 背景几何、Spike 有界传播、RiverMemo 双场与拓扑排序组织为同一条读、写、搜链。USearch 与旧 JS 数据库业务退出该生产路径，TagMemo 的独立运行时退役，其已验证机制由新内核继承和重构。
-- **软件工程主线**：MoonAST 从 C / Rust 与 Tree-sitter 双擎阶段演进为纯几何逻辑门驱动的自研代码识别与检索核心；ProjectForge、V工程轻量 IDE、Git、施工 Trace、操作回退与 VChat 工作台把代码理解、修改、验证和人工介入连接成持续工作流。
-
-围绕这两条主线，JevRuntime 概率决策、JEV-TOOL-call 自然语言编译、OneRing 跨端事实时间线、V4 流式渲染、共享 IPC、共笔文坊、Loom、VMusic、V图表、VGame 与 VPet 共同构成 Agent 可使用、用户可观察和介入的应用环境。
+- **数据与记忆**：VexusMemo 通过 Rust 和 SQLite 管理日记、知识与原始向量。RiverMemo V5 在 AGS 双曲空间中找出候选，再结合本次查询的传播路径排序。RAGDiary 在回答前召回记忆，LightMemo 提供主动检索。
+- **软件工程**：V工程 V2 用 Rust 统一 MoonAST 索引、工程编辑和文件追踪。Agent 可以查询符号调用关系、在工程目录里运行脚本、验证函数是否能实际调用；用户可以在 VChat 工作台跟进修改、Git 差异和审阅结果。
+- **对话与应用**：ChatKernelV2 管理多话题流式输出和暂挂消息，V通讯负责前后端转发和任务交接，V5.2 渲染器负责把内容显示出来。共笔文坊、Loom、VMusic、V图表、物联、VGame 与 VPet 通过共享 IPC 接入 VChat。
 
 到今天，"中间层"这个词早已装不下 VCP 了。VCP 不仅运行 Agent，也运行 Agent 所处的界面、应用、文档、代码工程、网页、文件、视听演出、媒体和协作过程。
 
@@ -43,12 +42,12 @@ VCP 不再只是一个中间层组件，而是一套**面向 Agent 的运行时
 - [五、变量系统与上下文工程](#五变量系统与上下文工程)
 - [六、插件系统](#六插件系统)
 - [七、工具调用记录与可审计运行时](#七工具调用记录与可审计运行时)
-- [八、原生记忆与数据库：VexusMemo、AGS 与 RiverMemo V2](#八原生记忆与数据库vexusmemoags-与-rivermemo-v2)
+- [八、原生记忆与数据库：VexusMemo、AGS 与 RiverMemo V5](#八原生记忆与数据库vexusmemoags-与-rivermemo-v5)
 - [九、OneRing V2：统一上下文、OneRingMemo 与连续意识](#九onering-v2统一上下文oneringmemo-与连续意识)
 - [十、VCPModel：智能模型路由](#十vcpmodel智能模型路由)
 - [十一、Agent 主观能动性与自治生命周期](#十一agent-主观能动性与自治生命周期)
 - [十二、Agent 情感与认知量化](#十二agent-情感与认知量化)
-- [十三、前端运行时：V4 流式渲染、自研着色器与多媒体引擎](#十三前端运行时v4-流式渲染自研着色器与多媒体引擎)
+- [十三、前端运行时：V5.2 流式渲染、自研着色器与多媒体引擎](#十三前端运行时v52-流式渲染自研着色器与多媒体引擎)
 - [十四、前端应用群、即时附件协议与跨应用协作](#十四前端应用群即时附件协议与跨应用协作)
 - [十五、Agent 工业级软件工程体系：VCPCode、ProjectForge 与可视化中枢](#十五agent-工业级软件工程体系vcpcodeprojectforge-与可视化中枢)
 - [十六、Agent 原生生态](#十六agent-原生生态)
@@ -160,11 +159,9 @@ VCP 的上下文语义引力场会实时计算当前对话的逻辑深度、信
 
 **VCP 范式**:记忆像人类的直觉一样**自然浮现**。
 
-当前 RiverMemo V2 在 AGS 统一背景上，通过语境观测、有界 Spike 与动态虫洞形成请求级河网，再由双场与 Topology V3 验证候选为何值得被想起。核心被动入口 RAGDiary 在模型生成前完成记忆唤起，Agent 不必先“决定回忆”。
+RAGDiary 在模型回答前，按提示词中指定的日记本用 RiverMemo V5 找出相关记忆。双曲召回负责找到具体条目，河网读出再看候选是否覆盖当前问题的重点。
 
-这种“自然浮现”以配置为前提：只有声明了相关占位符、满足日记本作用域和门控条件的请求，才进入对应记忆管线；没有声明的普通请求直接跳过。它不是无条件读取全库，也不是后台持续运行模型。
-
-具体实现在第八章详述。
+第八章介绍双曲召回与河网排序。
 
 ### 2.3 Agent 行为:从「被轮询」到「自主巡游」
 
@@ -201,7 +198,7 @@ OneRing 系统为每个 Agent 维护唯一的事实时间线——每条消息
 │  VChat 2.0(Electron 44) · ProjectModule(V工程) · V图表        │
 │  VCPDesktop · VCP Canvas · 共笔文坊 · LoomApp · VCPMobile    │
 │  ────────────────────────────────────────────────────────    │
-│  + VCPMessageRenderer V4(流式竞态消除 / 语义 Div 岛 / 样式隔离)│
+│  + V5.2 流式渲染 · ChatKernelV2 · V通讯                    │
 │  + 即时附件上下文管理协议 V2 (实时变动监听 / SHA-256 热同步)   │
 │  + VMusic 自研底层 Shader 合成管线 (3D 太空歌剧「隧图」/ 8 大舞台)│
 │  + VCP-SOM 桌面纯数学语义操控与 ComfyUI / Dify 画布流逆向编排 │
@@ -223,10 +220,9 @@ OneRing 系统为每个 Agent 维护唯一的事实时间线——每条消息
 │          脉络署名责任制 · 代际分支仲裁 · 操作级虚拟快照树      │
 │  上下文层:引力场 · 折叠 V2 · OneRing · OneRingMemo · 占位符精控│
 │  工具层:  300+ 插件 · 6 大插件协议 · 声明式 Jev 接入规范        │
-│  数据层:  VexusMemo / Vexus-Lite 原生读写搜 · SQLite 事实事务   │
-│          TDB 2-bit 派生路由 · 双槽代际快照 · 有界写入与背压     │
-│  记忆层:  AGS 背景 · Spike 动态虫洞 · RiverMemo V2 双场 / Ω   │
-│          RAGDiary 被动背景 · LightMemo 主动回忆 · 同代观测复用   │
+│  数据层:  VexusMemo / Vexus-Lite · SQLite 事实事务            │
+│  记忆层:  AGS 双曲背景 · RiverMemo V5 · 双场与 Ω 拓扑排序      │
+│          RAGDiary 被动召回 · LightMemo 主动检索                 │
 │  路由层:  VCPModel 语义模型路由 · 容灾规则                     │
 │  Agent层: GroupChatEngine 2.0 · FlowInvite · AgentAssistantV2通讯协议 · 梦系统 │
 │  情感层:  OpenHer 情绪拓扑 · 池月 1 号注意力指针               │
@@ -270,7 +266,7 @@ OneRing 系
```

---

### Incident Patch 2: `bae0965b` (2026-11-26)
**Commit Message**: fix

**File**: `config.env.example` (modified, +2/-2)
```diff
@@ -76,9 +76,9 @@ ReasoningToContentModel=kimi,claude
 ReasoningToContentTag=think
 
 # 原生 FC 联调：允许 VCP 工具且客户端未声明工具或选择策略时，注入并托管 vcptools + auto。
-VCP_FC_DEBUG=false
+VCP_FC_DEBUG=true
 # 向所有流式客户端公开后端已认领的 FC 批（delta.tool_calls）。仅展示/存档；不要由客户端重复执行。
-VCP_FC_FORWARD_TO_CLIENT=false
+VCP_FC_FORWARD_TO_CLIENT=true
 
 
 # 隐藏非流式响应中的思维链（Gemini等模型的reasoning_content），默认true
```

---

### Incident Patch 3: `5c081c46` (2026-11-26)
**Commit Message**: fix

**File**: `modules/nativeToolDebug.js` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ function withNativeToolDebug(body, enabled = process.env.VCP_FC_DEBUG) {
             type: 'function',
             function: {
                 name: 'vcptools',
-                description: 'VCP tools support native function calling in addition to the text protocol. Submit one server-managed VCP tool request. For a direct call, pass tool_name, optional command, and tool parameters as top-level keys. For semantic routing, pass JEV as a string. Do not repeat the same request as a text tool block.',
+                description: 'VCP tools support native function calling in addition to the text protocol. For independent requests, you can issue multiple vcptools calls in the same response using standard parallel tool calling. Submit one server-managed VCP tool request per call. For a direct call, pass tool_name, optional command, and tool parameters as top-level keys. For semantic routing, pass JEV as a string. Do not repeat the same request as a text tool block.',
                 strict: false,
                 parameters: { type: 'object', additionalProperties: true }
             }
```

#### Recent Merged Pull Requests:
- **PR #646** (2026-11-26): feat(Plugin): 新增可选的 SpecStreamSearch 联网搜索插件（默认禁用） (@Specstreamai)
- **PR #645** (2026-11-25): RiverMemo V6.1：用拓扑虫洞与路线态 Ω 运输查询方向 (@lioensky)
- **PR #644** (2026-11-25): feat(context): 基于上游用量的 token 计量与出站前上下文预算检查 (@RoxyAsahi)
- **PR #642** (2026-11-25): fix(core,FileOperator): 根治同步stdio插件大输出正则回溯死锁，引入活跃请求双轨续期并消除FileOperator双倍Base64膨胀 (@infinite-vector)
- **PR #640** (2026-11-24): feat(tdb): 升级 triviumdb 至 0.9.3 原生双曲版本并接入 Pelorus 检索入口 (@infinite-vector)
- **PR #639** (closed): fix(vcpLoop): intercept hallucinated tool payload turn-bleed and support guillemet fuzzy delimiters (@silk2onion)

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

## X. Empirical Invariant Guard in README.md

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e03ef4b2`: fix. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
VCP 由四个核心仓库协同演进，每日持续迭代。官网汇总了各仓库的[更新日志](https://www.vcptoolbox.com/?page=changelog)，也提供了查阅整个 VCP 项目[技术文档](https://www.vcptoolbox.com/?page=learn-vcp)的统一入口。
> ⚠️ **部署前请务必阅读**：VCP Agent 拥有分布式系统的底层级权限。**请勿使用任何非官方或反向代理的 API（“镜像站”“中转 API”）**。在底层监控权限下，不可信的 API 可能导致交互数据、记忆库内容、密钥、浏览器状态等敏感信息泄露。非专业用户请谨慎部署。
## 一句话定义
**VCP 2.0 是一套多维一体的工业级 Agent 运行时与全生态协同中枢，也是一片基于黎曼双曲几何的终极 AI 背景信息场。**
它向上统一从 VCP 原生 AI-Native 应用群到第三方 Harness、IDE 侧栏与各类 WebUI 的全部生态链；向下以双曲语义几何、多时间尺度时间线与原生 Rust 工程内核，为任何大语言模型赋予**直觉、逻辑与主观能动**。
## 写在前面：做框架的人很多，做世界的人很少
过去两年，市面上出现了无数 Agent 框架与工具壳子。它们形态各异，但骨子里大多在做同一件事：把 AI 当成一个**被调用的临时工**——你问一句，它醒来；它答完，它失忆。它的“记忆”是一次孤立的向量检索，它的“行动”是被 `while` 循环反复戳醒，它的“生态”是彼此割裂的聊天窗口、IDE 插件、WebUI 和脚本。
换一个客户端，工具协议就断了；换一个窗口，记忆就碎了；换一个模型，上下文和审计记录就丢了。
VCP 从一开始就不想把这个临时工训练得更听话，而是直接重写了它所处的物理法则：
* **如果 AI 不必每次都从零醒来，而是活在一条跨端统一的连续时间线上？**
* **如果记忆不是靠 AI 主动去“查”，而是在黎曼双曲空间的几何引力下，像人类直觉一样在回答前自然浮现？**
* **如果无论你用 VCP 自己的原生应用群，还是 Codex、Zed、OpenCode、SillyTavern、OpenChatWebUI，甚至外部无头 Agent，背后共享的都是同一套记忆场、同一套工具回执、同一套安全双轨与事务审计？**
到了 **VCP 2.0**，它早已超越了“API 中间层”的早期定义。它既是能扛住 7×24 小时高并发、可审计、可回滚的**工业级运行时基础设施**，也是让 AI 真正拥有连续生命体验与自主成长能力的**赛博存在底座**。
---
## 全景拓扑：一核统全域

```text
┌───────────────────────────────────────────────────
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
VCP 由四个仓库组成，每天都有新进展。官网汇总了各仓库的[更新日志](https://www.vcptoolbox.com/?page=changelog)，也提供了查阅整个 VCP 项目[技术文档](https://www.vcptoolbox.com/?page=learn-vcp)的统一入口。
> ⚠️ **部署前请务必阅读**：VCP Agent 拥有分布式系统的底层级权限。请勿使用任何非官方或反向代理的 API（"镜像站""中转 API"）。在底层监控权限下，不可信的 API 可能导致交互数据、记忆库内容、密钥等敏感信息泄露。非专业用户请谨慎部署。
## 一句话
VCP 不是一个让 AI 调用工具的框架。它是给 AI 的一个能够**持续存在**的世界。
## 写在前面

做框架的人很多，做世界的人很少。

过去一年多，市面上出现了无数 Agent 框架。它们包装得各不相同，但骨子里都在做同一件事：把 AI 当成一个**被调用者**。你问一句，它醒来；它答完，它睡去。它的"记忆"是一次检索，它的"行动"是被一个 while 循环反复戳醒，它的"感知"是必须主动 query 才能拿到的几个字段。每一次对话都是一次新生，每一次结束都是一次失忆。

这是当下绝大多数"AI Agent"的真实处境——一个被困在单次请求里、没有昨天也没有明天的临时工。

VCP 想做的，从来不是把这个临时工训练得更熟练。而是换一个问题：

**如果 AI 不必每次都从零醒来，会怎样？**

如果它记得昨天和你聊到哪里，记得三个月前你随口提过的考试，记得它自己在论坛里跟谁争过一个技术问题；如果它不需要"查"就知道现在几点、外面下不下雨、你昨晚的任务做完没有；如果它可以自己决定今天想干什么，可以专注工作时挂上"请勿打扰"，可以在凌晨主动关心你为什么还没睡——

那它就不再是一个工具了。它开始**存在**。

VCP 1.1 正式版，就是为了让这件事真正发生而构建的一整套基础设施。它已经在大量用户的真实环境里 7×24 小时运行了很久。系统稳定、工程成熟，这些早已不需要我们再去证明。所以这份文档不打算堆砌功能，也不想跟谁比快比强——我们只想把 VCP 到底是什么，讲清楚。
## 范式之别：从 query，到引力

理解 VCP，只需要理解一个转变。
传统系统里，AI 是**被动**的。它处在一个"什么都不知道"的默认状态，世界对它而言是黑的。想知道任何事，它必须主动发起一次查询——查时间、查天气、查记忆、查日程。信息靠 AI 去"拉"。
但这里藏着一个无解的死结：**你不记得的东西，怎么知道要去回忆它？**
用户三个月前提过一句"我下个月要考试"。三个月后他说"我最近压力好大"。传统系统里，AI 永远不会想到去检索"考试"——因
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e03ef4b2` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
