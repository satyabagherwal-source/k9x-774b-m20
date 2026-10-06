# Forensic Learning Record (Deep Inspection): lioensky/VCPToolBox

> **Canonical Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:37:41.931Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2349 stars

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
    temp: 0,
    text: "加载中…",
    humidity: 0,
    wind: "--",
    pressure: 0,
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
      memoryProfile.value = memoryProfileData.valu
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

### Core Architecture Module: `AdminPanel-Vue/src/features/plugins-hub/derivePluginHubState.ts`
```
import type { RecentVisit } from "@/composables/useRecentVisits";
import type { PluginInfo } from "@/types/api.plugin";

export type PluginFilter = "all" | "enabled" | "disabled" | "pinned" | "distributed";

export interface PluginHubSummary {
  total: number;
  enabled: number;
  disabled: number;
  pinned: number;
}

export interface RecentPluginVisitItem {
  pluginName: string;
  label: string;
  icon: string;
}

export interface PluginHubRecord {
  plugin: PluginInfo;
  pluginName: string;
  displayName: string;
  description: string;
  summary: string;
  icon: string;
  enabled: boolean;
  isDistributed: boolean;
  isPinned: boolean;
  searchText: string;
}

interface FilterPluginHubRecordsOptions {
  query: string;
  filter: PluginFilter;
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function getPluginName(plugin: PluginInfo): string {
  return plugin.manifest.name || plugin.name;
}

function getPluginDisplayName(plugin: PluginInfo): string {
  return plugin.manifest.displayName?.trim() || getPluginName(plugin);
}

function summarizePluginDescription(
  description: string,
  maxLength: number
): string {
  const normalizedDescription = description.replace(/\s+/g, " ").trim();
  if (!normalizedDescription) {
    return "该插件暂未提供描述信息。";
  }

  const graphemes = Array.from(normalizedDescription);
  if (graphemes.length <= maxLength) {
    return normalizedDescription;
  }

  return `${graphemes.slice(0, maxLength).join("").trimEnd()}…`;
}

function comparePluginHubRecords(
  a: PluginHubRecord,
  b: PluginHubRecord
): number {
  const pinDelta = Number(b.isPinned) - Number(a.isPinned);
  if (pinDelta !== 0) {
    return pinDelta;
  }

  const enabledDelta = Number(b.enabled) - Number(a.enabled);
  if (enabledDelta !== 0) {
    return enabledDelta;
  }

  return a.displayName.localeCompare(b.displayName, "zh-CN", {
    sensitivity: "base",
  });
}

function matchesFilter(record: PluginHubRecord, filter: PluginFilter): boolean {
  switch (filter) {
    case "enabled":
      return record.enabled;
    case "disabled":
      return !record.enabled;
    case "pinned":
      return record.isPinned;
    case "distributed":
      return record.isDistributed;
    case "all":
    default:
      return true;
  }
}

export function buildPluginHubRecords(
  plugins: readonly PluginInfo[],
  pinnedPluginNames: readonly string[],
  descriptionMaxLength: number
): PluginHubRecord[] {
  const pinnedPluginNameSet = new Set(pinnedPluginNames);

  return plugins.map((plugin) => {
    const pluginName = getPluginName(plugin);
    const displayName = getPluginDisplayName(plugin);
    const description = plugin.manifest.description?.trim() || "";

    return {
      plugin,
      pluginName,
      displayName,
      description,
      summary: summarizePluginDescription(description, descriptionMaxLength),
      icon: plugin.manifest.icon || "extension",
      enabled: plugin.enabled,
      isDistributed: Boolean(plugin.isDistributed),
      isPinned: pinnedPluginNameSet.has(pluginName),
      searchText: normalizeText([pluginName, displayName, description].join(" ")),
    };
  });
}

export function buildPluginHubRecordMap(
  records: readonly PluginHubRecord[]
): Map<string, PluginHubRecord> {
  return new Map(records.map((record) => [record.pluginName, record] as const));
}

export function buildPinnedPluginRecords(
  pinnedPluginNames: readonly string[],
  recordMap: ReadonlyMap<string, PluginHubRecord>
): PluginHubRecord[] {
  return pinnedPluginNames.flatMap((pluginName) => {
    const record = recordMap.get(pluginName);
    return record ? [record] : [];
  });
}

export function summarizePluginHubRecords(
  records: readonly PluginHubRecord[]
): PluginHubSummary {
  return records.reduce<PluginHubSummary>(
    (summary, record) => {
      summary.total += 1;
      summary.enabled += Number(record.enabled);
      summary.disabled += Number(!record.enabled);
      summary.pinned += Number(record.isPinned);
      return summary;
    },
    {
      total: 0,
      enabled: 0,
      disabled: 0,
      pinned: 0,
    }
  );
}

export function buildRecentPluginVisitItems(
  recentVisits: readonly RecentVisit[],
  recordMap: ReadonlyMap<string, PluginHubRecord>,
  limit = 6
): RecentPluginVisitItem[] {
  const seenPluginNames = new Set<string>();
  const result: RecentPluginVisitItem[] = [];

  for (const visit of recentVisits) {
    if (!visit.pluginName || seenPluginNames.has(visit.pluginName)) {
      continue;
    }

    const record = recordMap.get(visit.pluginName);
    if (!record) {
      continue;
    }

    seenPluginNames.add(visit.pluginName);
    result.push({
      pluginName: record.pluginName,
      label: record.displayName,
      icon: record.icon,
    });

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

export function filterPluginHubRecords(
  records: readonly PluginHubRecord[],
  { query, filter }: FilterPluginHubRecordsOptions
): PluginHubRecord[] {
  const normalizedQuery = normalizeText(query);

  return records
    .filter((record) =>
      !normalizedQuery ? true : record.searchText.includes(normalizedQuery)
    )
    .filter((record) => matchesFilter(record, filter))
    .sort(comparePluginHubRecords);
}

```

### Core Architecture Module: `AdminPanel-Vue/src/features/theme-editor/themeEngine.ts`
```
/**
 * 主题引擎
 *
 * 管理自定义主题 CSS 变量的持久化与应用。
 * 支持预设主题、颜色覆盖、自定义背景图和自定义 CSS。
 */

const STORAGE_KEY_COLORS = 'customTheme'
const STORAGE_KEY_CSS = 'customThemeCss'
const STORAGE_KEY_BG_IMAGE = 'customThemeBgImage'
const STORAGE_KEY_ACTIVE_PRESET = 'customThemeActivePreset'
const STORAGE_KEY_USER_THEMES = 'customThemeUserThemes'
const STORAGE_KEY_THEME_MODE = 'theme'
const STORAGE_KEY_RADIUS = 'customThemeRadius'
const STORAGE_KEY_SCALE = 'customThemeScale'
const STORAGE_KEY_FONT = 'customThemeFont'
const STORAGE_KEY_CONTENT_LAYOUT = 'customThemeContentLayout'
const STORAGE_KEY_SHELL_LAYOUT = 'customThemeShellLayout'
const INJECTED_CSS_ID = 'vcp-custom-theme-css'
const INJECTED_BG_ID = 'vcp-custom-theme-bg'
export const THEME_SETTINGS_CHANGED_EVENT = 'vcp-theme-settings-changed'

// ── 类型定义 ──

export interface CustomThemeVars {
  [varName: string]: string
}

export type ThemeMode = 'dark' | 'light'
export type ThemeRadius = 'default' | 'none' | 'sm' | 'md' | 'lg' | 'xl'
export type ThemeScale = 'default' | 'sm' | 'lg' | 'xl'
export type ThemeFont = 'default' | 'sans' | 'serif'
export type ThemeContentLayout = 'full' | 'centered'
export type ThemeShellLayout = 'inset' | 'sidebar'

export const THEME_MODE_OPTIONS: Array<{ id: ThemeMode; label: string; description: string; icon: string }> = [
  { id: 'dark', label: '暗色', description: '深色玻璃拟态界面', icon: 'dark_mode' },
  { id: 'light', label: '亮色', description: '柔和亮色界面', icon: 'light_mode' },
]

export const THEME_RADIUS_OPTIONS: Array<{ id: ThemeRadius; label: string; description: string; preview: string }> = [
  { id: 'default', label: '默认', description: '12 / 18 / 26 / 34px', preview: '34px' },
  { id: 'none', label: '直角', description: '0 / 0 / 0 / 0px', preview: '0' },
  { id: 'sm', label: '小', description: '4 / 6 / 8 / 12px', preview: '8px' },
  { id: 'md', label: '中', description: '6 / 10 / 14 / 20px', preview: '18px' },
  { id: 'lg', label: '大', description: '8 / 12 / 18 / 26px', preview: '30px' },
  { id: 'xl', label: '圆润', description: '12 / 18 / 26 / 34px', preview: '34px' },
]

export const THEME_SCALE_OPTIONS: Array<{ id: ThemeScale; label: string; description: string }> = [
  { id: 'default', label: '默认', description: '当前面板密度' },
  { id: 'sm', label: '紧凑', description: '减少间距，适合高频操作' },
  { id: 'lg', label: '舒展', description: '增加呼吸感' },
  { id: 'xl', label: '宽松', description: '更大的字号与间距' },
]

export const THEME_FONT_OPTIONS: Array<{ id: ThemeFont; label: string; description: string }> = [
  { id: 'default', label: '默认', description: '使用当前面板字体' },
  { id: 'sans', label: '无衬线', description: '清晰的管理面板风格' },
  { id: 'serif', label: '衬线', description: '更具编辑感的标题与正文' },
]

export const THEME_CONTENT_LAYOUT_OPTIONS: Array<{ id: ThemeContentLayout; label: string; description: string }> = [
  { id: 'full', label: '铺满', description: '使用当前全宽内容布局' },
  { id: 'centered', label: '居中', description: '限制内容宽度，适合阅读配置' },
]

export const THEME_SHELL_LAYOUT_OPTIONS: Array<{ id: ThemeShellLayout; label: string; description: string }> = [
  { id: 'inset', label: '内嵌', description: '内容面板嵌入灰色外壳，保留圆角层次' },
  { id: 'sidebar', label: '侧边栏', description: '传统贴边侧栏，右侧内容面板直角铺满' },
]

export interface ThemeSnapshot {
  colorOverrides: Record<string, string>
  customCss: string
  backgroundImage: string
  activePresetId: string | null
  themeMode: ThemeMode
  radius: ThemeRadius
  scale: ThemeScale
  font: ThemeFont
  contentLayout: ThemeContentLayout
  shellLayout: ThemeShellLayout
}

export interface ThemeQuickSettings {
  themeMode: ThemeMode
  radius: ThemeRadius
  scale: ThemeScale
  font: ThemeFont
  contentLayout: ThemeContentLayout
  shellLayout: ThemeShellLayout
}

export interface UserTheme {
  id: string
  name: string
  snapshot: ThemeSnapshot
  createdAt: number
}

// ── 安全的 localStorage 写入 ──

function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    console.error(`[ThemeEngine] localStorage 写入失败 (key=${key}):`, e)
    return false
  }
}

// ── 完整预设主题 ──

export interface FullPresetTheme {
  id: string
  label: string
  description: string
  icon: string
  colors: Record<string, string>
  swatches?: string[]
  defaultRadius?: ThemeRadius
  defaultFont?: Exclude<ThemeFont, 'default'>
  backgroundImage?: string
  customCss?: string
}

/**
 * 根据色相生成完整的主题色覆盖变量
 * 保持与默认主题一致的亮度/色度结构，只改变色相
 */
function hueColors(h: number): Record<string, string> {
  return {
    '--highlight-text-dark': `oklch(0.75 0.14 ${h})`,
    '--highlight-text-light': `oklch(0.45 0.14 ${h})`,
    '--accent-bg-dark': `oklch(0.30 0.08 ${h})`,
    '--accent-bg-light': `oklch(0.92 0.04 ${h})`,
    '--button-bg-dark': `oklch(0.68 0.16 ${h})`,
    '--button-bg-light': `oklch(0.68 0.16 ${h})`,
    '--button-hover-bg-dark': `oklch(0.60 0.18 ${h})`,
    '--button-hover-bg-light': `oklch(0.60 0.18 ${h})`,
  }
}

export const FULL_PRESET_THEMES: FullPresetTheme[] = [
  {
    id: 'default-blue',
    label: '深空蓝',
    description: '默认主题，深邃的宇宙蓝色调',
    icon: 'rocket_launch',
    colors: {},
    swatches: ['oklch(0.75 0.14 230)', 'oklch(0.68 0.16 230)', 'oklch(0.30 0.08 230)'],
    defaultRadius: 'xl',
  },
  {
    id: 'midnight-purple',
    label: '午夜紫',
    description: '神秘优雅的紫色调',
    icon: 'dark_mode',
    colors: hueColors(270),
    swatches: ['oklch(0.75 0.14 270)', 'oklch(0.68 0.16 270)', 'oklch(0.30 0.08 270)'],
    defaultRadius: 'xl',
  },
  {
    id: 'aurora-green',
    label: '极光绿',
    description: '生机盎然的绿色极光',
    icon: 'forest',
    colors: hueColors(155),
    swatches: ['oklch(0.75 0.14 155)', 'oklch(0.68 0.16 155)', 'oklch(0.30 0.08 155)'],
    defaultRadius: 'xl',
  },
  {
    id: 'sunset-orange',
    label: '日落橙',
    description: '温暖的橙色黄昏',
    icon: 'wb_twilight',
    colors: hueColors(30),
    swatches: ['oklch(0.75 0.14 30)', 'oklch(0.68 0.16 30)', 'oklch(0.30 0.08 30)'],
    defaultRadius: 'xl',
  },
  {
    id: 'cherry-red',
    label: '樱花红',
    description: '热烈绽放的红色',
    icon: 'local_florist',
    colors: hueColors(0),
    swatches: ['oklch(0.75 0.14 0)', 'oklch(0.68 0.16 0)', 'oklch(0.30 0.08 0)'],
    defaultRadius: 'xl',
  },
  {
    id: 'ocean-cyan',
    label: '海洋青',
    description: '清澈透明的海洋色调',
    icon: 'waves',
    colors: hueColors(190),
    swatches: ['oklch(0.75 0.14 190)', 'oklch(0.68 0.16 190)', 'oklch(0.30 0.08 190)'],
    defaultRadius: 'xl',
  },
  {
    id: 'rose-pink',
    label: '玫瑰粉',
    description: '浪漫柔和的粉色',
    icon: 'favorite',
    colors: hueColors(310),
    swatches: ['oklch(0.75 0.14 310)', 'oklch(0.68 0.16 310)', 'oklch(0.30 0.08 310)'],
    defaultRadius: 'xl',
  },
  {
    id: 'golden-amber',
    label: '琥珀金',
    description: '华贵典雅的金色',
    icon: 'diamond',
    colors: hueColors(60),
    swatches: ['oklch(0.75 0.14 60)', 'oklch(0.68 0.16 60)', 'oklch(0.30 0.08 60)'],
    defaultRadius: 'xl',
  },
  {
    id: 'editorial-graphite',
    label: '编辑墨色',
    description: '暖纸朱砂与工业石墨的明暗双色主题',
    icon: 'ink_pen',
    colors: {},
    swatches: ['#b94832', '#21675c', '#f2a900', '#76bfae'],
    defaultRadius: 'md',
    defaultFont: 'serif',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: '暖米色画布与陶土强调色',
    icon: 'auto_awesome',
    colors: {},
    swatches: ['oklch(0.984 0.005 95)', 'oklch(0.685 0.142 38)', 'oklch(0.92 0.03 72)'],
    defaultRadius: 'xl',
    defaultFont: 'serif',
  },
  {
    id: 'rose-garden',
    label: '蔷薇庭院',
    description: '玫瑰粉与柔和浅红的花园主题',
    icon: 'local_florist',
    colors: {},
    swatches: ['oklch(0.5827 0.2418 12.23)', 'oklch(0.8131 0.1129 5.67)', 'oklch(0.93 0.04 12)'],
    defaultRadius: 'xl',
  },
  {
    id: 'lake-view',
    label: '湖畔薄雾',
    description: '湖绿色与水蓝色的清透主题',
    icon: 'water',
    colors: {},
    swatches: ['oklch(0.765 0.177 163.22)', 'oklch(0.551 0.0899 200.52)', 'oklch(0.92 0.035 180)'],
    defaultRadius: 'xl',
  },
  {
    id: 'ocean-breeze',
    label: '海风蓝紫',
    description: '高饱和蓝紫渐变主题',
    icon: 'sailing',
    colors: {},
    swatches: ['oklch(0.5461 0.2152 262.88)', 'oklch(0.5854 0.2041 277.12)', 'oklch(0.92 0.03 250)'],
    defaultRadius: 'xl',
  },
  {
    id: 'underground',
    label: '地下霓虹',
    description: '青绿与洋红的夜间霓虹主题',
    icon: 'subway',
    colors: {},
    swatches: ['oklch(0.5315 0.0694 156.19)', 'oklch(0.5748 0.0862 336.52)', 'oklch(0.20 0.03 210)'],
    defaultRadius: 'xl',
  },
  {
    id: 'sunset-glow',
    label: '暮色余晖',
    description: '朱红与琥珀色的夕阳主题',
    icon: 'wb_twilight',
    colors: {},
    swatches: ['oklch(0.5591 0.1882 25.33)', 'oklch(0.7938 0.1248 42.42)', 'oklch(0.93 0.05 55)'],
    defaultRadius: 'xl',
  },
  {
    id: 'forest-whisper',
    label: '森林低语',
    description: '冷杉绿与灰蓝的安静主题',
    icon: 'forest',
    colors: {},
    swatches: ['oklch(0.5276 0.1072 182.22)', 'oklch(0.5236 0.0505 250.18)', 'oklch(0.90 0.025 165)'],
    defaultRadius: 'xl',
  },
  {
    id: 'lavender-dream',
    label: '薰衣草梦',
    description: '紫粉与浅蓝的柔和主题',
    icon: 'spa',
    colors: {},
    swatches: ['oklch(0.5709 0.1808 306.89)', 'oklch(0.811 0.0589 201.14)', 'oklch(0.94 0.035 300)'],
    defaultRadius: 'xl',
  },
]

// ── 可编辑的颜色变量分组定义 ──

export interface ThemeColorVariable {
  name: string
  label: string
  cssVar: string
  defaultDark: string
  defaultLight: string
  /** 非颜色类型的变量 (如 px 值)，使用文本输入而非取色器 */
  inputType?: 'text'
}

export interface ThemeColorGroup {
  id: string
  label: string
  icon: string
  variables: ThemeColorVariable[]
}

export const THEME_COLOR_GROUPS: ThemeColorGroup[] = [
  {
    id: 'accent',
    label: '强调色',
    icon: 'palette',
    variables: [
      {
        name: 'highlight-text-dark',
        label: '高亮色（暗色）',
        cssVar: '--highlight-text-dark',
        defaultDark: 'oklch(0.75 0.14 230)',
        defaultLight: 'oklch(0.75 0.14 230)',
      },
      {
        name: 'highlight-text-light',
        label: '高亮色（亮色）',
        cssVar: '--highlight-text-light',
        defaultDark: 'oklch(0.45 0.14 230)',
        defaultLight: 'oklch(0.45 0.14 230)',
      },
      {
        
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #486** (2026-10-05): **feat(knowledgeBase): 引入单 Agent Chunk 双槽代际索引与集合对称差分回放机制**
  *Symptoms*: ### 动机与背景 当前 VCPToolBox 中的 MemoChunk 索引持久化存在两难瓶颈：不开启持久化则冷启动需要全量从 SQLite 重建 HNSW，耗时漫长；开启持久化后每次小微日记变动均会同步覆写数十兆的二进制大文件，产生严重的 I/O 阻塞且无法感知离线差分。  ### 架构与解决方案 借鉴系统成熟的 Tag 代际索引哲学，为每个 Agent（日记本）独立实现双槽（Slot A/B）代际基线架构： 1. **多租户独立双槽基线**：在 `schemaManager.js` 中新增 `chunk_index_baselines` 与 `chunk_index_baseline_entries`，按 `(diary_name, generation)` 复合主键强隔离，每次保存仅定向写入非活动影子槽，单事务原子翻转，根除断电撕裂风险。 2. **集合对称差分回放（Set Symmetric Diff）**：攻克 Chunk 原地删除与自增 ID 漂移难题，利用 SQLite 集合代数自动计算 `E \ C`（废弃删除项）与 `C \ E`（新增插入项），启动加载时仅回放差分向量，毫秒级自愈。 3. **5% 智能代际门限拦截**：日常小微改动仅驻留内存，累计差异未达 `KNOWLEDGEBASE_CHUNK_INDEX_BASELINE_DELTA_RATIO`（默认 5%）时跳过磁盘重写，大幅削减 SSD 写入放大。 4. **全生命周期防崩溃自愈**：在模型签名变更、维度不匹配或二进制文件受损时，自动清空脏元数据并优雅回退到权威 SQLite 全量恢复。  ### 验证与测试 - 针对模型漂移、文件截断损坏、100% ID 换血、万级突发雪崩、Exclusive 行级死锁、进程异常中断回滚等极端场景进行了全维度验证，全部通过。 - 实测冷启动加载包含基线并回放新增与删除差分，总耗时仅需 16ms（8,000 级混合代际回放仅耗时 154ms）。 - 与原有 `KNOWLEDGEBASE_PERSIST_DEFAULT`、`KNOWLEDGEBASE_PERSIST_FOLDERS` 环境变量完全向前兼容。  ---- 让nova写了一堆单元测验跑了一通，自己的也重启了后端，希望并无问题。 

- **Issue #484** (2026-10-03): **feat(plugin): 新增 LdBook 电子图书检索与下载插件**
  *Symptoms*:    ## 📌 概述 (Overview)     为 VCPToolBox 生态新增 **LdBook** 插件，面向公有领域电子图书提供轻量、高性能、高鲁棒性的图书目录检索与高速分块断点下载支持。     插件采用 Go 原生标准库编写，单一可执行程序自包含设计（~6MB，零第三方外部运行时依赖），完全适配 VCPToolBox 最新的同步插件调用规范。     ---     ## ✨ 核心特性与设计亮点     1. **多镜像全异步竞速检索**：       - 自动并发请求多个图书镜像源，毫秒级汇流响应。一旦目标格式数量满足阈值立即短路取消冗余请求，节省网络资源。    2. **智能实体图书聚合（Title-Level Aggregation）**：       - 将同一书籍的多种格式版本聚合为单一实体，向 AI 明确展示该书支持的全部格式（如 `[epub, pdf, mobi, azw3]`）及对应最佳 MD5 标识，便于选型。    3. **严格格式防御机制**：       - 当请求的格式该书不存在时，明确返回全局支持的格式列表并提示重选，杜绝“挂羊头卖狗肉”。    4. **Range 分块加速与断点自愈下载**：       - 支持多分块并发写入；采用 `.part` 临时文件与自愈重试机制，下载完成后原子替换落盘，避免损坏文件。    5. **高度可配置（抗倒闭设计）**：       - 附带 `config.env.example`，搜索镜像、下载网关、并发连接数均可动态配置；优先读取插件本地配置，无缝继承 VCP 全局环境及代理设置。     ---     ## 🛠️ 提供的工具指令 (Capabilities)     本插件向上层 Agent 提供 3 个核心指令：     - **`SearchBooks`**：      - 图书目录与格式探索。支持 `searchField`（`def` 模糊搜索、`title` 书名搜索、`author` 作者搜索、`isbn` 国际标准书号搜索）和 `format` 过滤。    - **`DownloadBook`**：      - 一步直达的一键下载工具（最常用）。直接输入书名与目标格式，算法自动加权锁定最佳候选、分块加速并落盘保存，直接返回本地文件路径。    - **`DownloadByMD5`**：      - 针对已知 32 位 MD5 哈希的底层精准断点加速下载。     ---     ## 🧪 验证与规范合规性 (Verification)     1. **VCP 规范合规**：       - `plugin-manifest.json` 严格遵循最新的规范重构，所有调用示例统一抽取至独立 `example` 字段，`description` 仅保留参数描述，杜绝 System Prompt 污染。       - 运行项目根目录校验脚本：         - `node validate-plugin-json.js`：**全库 91 个插件扫描全部通过，0 错误**。         - `node normalize-plugin-examples.js`：**0 警告，0 错误**。    2. **输出格式规范**：       - 插件标准输出遵循 VCP 推荐的 OpenAI content 数组结构（`{"statu
  **Post-Mortem & Fix Analysis**:
  > 这种类型插件以后建议投稿插件商店

- **Issue #483** (2026-09-25): **fix(deps): remove unused hnswlib-node dependency**
  *Symptoms*: Fixes #482.  `hnswlib-node` is no longer used after the RAG storage refactor, but it remains in the root dependency list and runs `node-gyp` during clean Windows installs. This patch removes the dead dependency, adds the missing optional `fsevents` lock entry so `npm ci` is reproducible, and updates the RAG README to describe the current SQLite/`rust-vexus-lite` path.  Validation:  - `npm install --package-lock=false --no-audit --no-fund --foreground-scripts` - `npm ci --dry-run --ignore-scripts --no-audit --no-fund` - native-module smoke checks for the current SQLite, TriviumDB, Rust index, image, tokenizer, and Puppeteer modules 

- **Issue #482** (2026-09-25): **移除死依赖 hnswlib-node：它让 npm install 必须安装 MSVC Build Tools（2-3GB）才能成功**
  *Symptoms*: ## 现象  全新 Windows 机器上按 `docs/OPERATIONS.md` 走 `npm install` 会直接失败，并且**整棵依赖树回滚**（`node_modules` 被清空，exit 1），报错指向 `hnswlib-node`：  ``` > hnswlib-node@1.4.2 install > node-gyp rebuild  gyp ERR! find VS gyp ERR! find VS --msvs_version was not set on the command line gyp ERR! find VS VCINSTALLDIR not set, not running in VS Command Prompt gyp ERR! find VS You need to install the latest version of Visual Studio gyp ERR! find VS including the "Desktop development with C++" workload. gyp ERR! not ok  npm error code 1 npm error path C:\...\node_modules\hnswlib-node npm error command failed ```  环境：Windows 10.0.26100 / Node v24.21.0（ABI 137）/ npm 11.19.0。  ## 根因  `hnswlib-node@1.4.2` 没有发布任何预编译产物，`install` 脚本就是裸的 `node-gyp rebuild`，因此必须本机存在 MSVC C++ 工具链。而同一棵树里**其它原生依赖全部走预编译，完全不需要编译器**：  | 包 | 安装方式 | 需要 MSVC | | --- | --- | --- | | `hnswlib-node@1.4.2` | `node-gyp rebuild`（无 prebuild） | **是** | | `better-sqlite3@12.4.1` | `prebuild-install`（ABI 137 有产物） | 否 | | `sharp` / `@napi-rs/canvas` / `@node-rs/jieba` / `triviumdb` | 预编译产物 | 否 | | `rust-vexus-lite` | 仓库自带 `.node`，或 cargo 自编 | 否 | | `puppeteer` | 只下载 Chrome | 否 | | `ssh2` 的可选 crypto binding / `cpu-features` | node-gyp，但为 optional，失败被容忍 | 否（可忽略） |  为了一个没人用的依赖去装 2-3 GB 的 VS Build Tools 并配置 "Desktop development with C++"，对只想跑起服务的人是很大的体验代价（下载、安装、可能还要重开终端；安装器为此专门写了 `msvc_ops.rs` 整条流程也是同一个痛点）。  ## 这个依赖已经没有任何代码在用  `hnswlib-node` 是 2025-11-19 那轮数据库重构的遗留：重构删掉了全部调用点，但漏删了 `package.json` 里的声明。  ``` $ git grep -in hnsw -- '*.js' '*.mjs' '*.cjs' '

- **Issue #481** (2026-09-22): **feat(BilibiliFetch): 修复快照多模态在下游网关触发 SSRF 500 熔断的问题，并优化国内代理路由与多级凭据读取容错**
  *Symptoms*: ### 📌 Summary / 概述 本 PR 针对最新 `2.1.0` 多模态快照特性在生产环境中暴露出的网关拦截隐患进行了关键性修复，并增强了国内 API 的代理路由协调与凭据多级读取容错。  保持 100% 纯 Python 单文件 `synchronous` 同步插件契约，零新增外部依赖，完全向下兼容。  ---  ### 🐛 Critical Bugfix / 关键缺陷修复  1. **彻底解决多模态快照在 API 网关 (New-API / One-API) 下触发 SSRF 500 熔断的问题**：    - **痛点**：`2.1.0` 在 `images_to_add` 中直接将 `http://localhost:6005/...` 传给大模型的 `image_url`。当下游使用 New-API / One-API 或公网云端大模型时，网关的 SSRF 防火墙会拦截内网端口并报错：      `failed to download file from http://localhost:6005/...: request reject: port 6005 is not allowed (500 Error)`，导致整次对话流被掐断。    - **方案（双轨视界分离）**：      - **人类视角**：正文 Markdown 引用保留 `http://localhost:6005`，供前端客户端轻量渲染；      - **模型视角**：将小体积快照编码为标准内联 Base64 Data URI（`data:image/jpeg;base64,...`）喂入 `image_url`。大模型免网络请求直接视觉解析，彻底根除 SSRF 拦截。    - **安全熔断**：单次请求注入大模型的多模态图片数量硬编码上限设为 10 张（`MAX_MULTIMODAL_IMAGES = 10`），防止异常长数组撑爆上下文或网关 Payload 上限。  ---  ### ✨ Other Improvements / 其它改进  2. **零配置 POSIX NO_PROXY 智能路由协调**：    - 针对国内用户开启系统全局代理（如 Clash 7890 端口）常导致 `api.bilibili.com` 直连请求误走海外节点触发 `412 Precondition Failed` 风控的痛点，自动在当前子进程注入 `NO_PROXY` 域；    - 保持用户的 `HTTP_PROXY / HTTPS_PROXY` 完整原貌，不破坏海外用户和内网用户的专用代理链路。  3. **内联凭据管理器与热更新钩子（Credentials Cache Hook）**：    - 内联轻量凭据读取器，支持多级回退阶梯：      1. 目录级 `.cookies_cache` 运行时缓存（若存在则优先提取最新 `SESSDATA`，为外部脚本/扩展热自愈提供标准通道）；      2. 插件局部 `config.env`（解除对主程序根目录的强依赖）；      3. 环境变量 `BILIBILI_COOKIE`；      4. 全局根目录 `config.env`（向下绝对兼容）。  4. **跨平台可执行文件后缀兼容**：    - `get_ffmpeg_path` 兼容 `os.name == 'nt'` 的动态 `.exe` 探测，提升 Linux / Do

- **Issue #480** (2026-09-21): **fix(dailyNotes): 支持日记保存时同步重命名与严格扩展名白名单兜底**
  *Symptoms*: ### 问题背景 1. `POST /note/:folderName/:fileName` 接口原先只处理正文覆盖，不支持日记重命名，导致前端修改标题输入框后无法物理生效。 2. 传统的 `path.extname()` 在处理类似 `2025.04.txt` 这类包含点号的日期或版本号文件名时，若输入无后缀的 `2025.04`，易将 `.04` 误判为扩展名截断，导致后缀判定失常。  ### 修复内容 1. **支持 newFileName**：从请求体解构新文件名，支持同时修改文件名与日记正文。 2. **扩展名严格白名单与兜底**：严格依据 `allowedExtensions` 白名单判定后缀；若新文件名未以白名单后缀结尾，优先寻找原文件合法后缀，若原文件亦无合法后缀则强制铁律兜底补齐 `.txt`，杜绝裸文件与伪扩展名。 3. **原子落盘与防冲撞**：重命名前使用 `fs.access` 探测目标文件，若冲突返回 `409 Conflict (EEXIST)`，杜绝静默误覆盖；写入新文件并物理清理旧文件，向 `executeFileMutation` 提交完整变更路径。 4. **安全防御**：阻断 `newFileName` 中的跨目录穿透字符（`..`、`/`、`\`）。  …… 注：这是前端“记忆”子模块应用的相应后端pr

- **Issue #479** (2026-09-27): **feat: add opt-in Telegram bridge with correlated host events**
  *Symptoms*: 为 VCP Agent 增加默认关闭的 Telegram 私聊入口，复用现有 Agent、模型、工具和管理员认证链路。授权用户可以切换 Agent、收发媒体、查看流式回复、批准关联工具请求，并收到通用异步任务结果。  此 PR 同时补齐 Host Integration v1：在流式/非流式工具执行中传递原始请求关联 ID，提供最小化的进程内审批与异步事件，并在回调结果持久化后通知传输插件。保留现有 WebSocket 通知、审批变更预览和管理员认证。未集成这些接口的旧主机无法仅复制插件目录使用。  ## 范围  - TelegramBridge 插件、SQLite 迁移、测试、安装/恢复文档和可重复打包脚本；通用附件通过受限路径或公共 HTTPS 解析。 - 请求与投递持久化、取消、重启恢复、未知效果隔离、图片历史和相册合并。 - 不包含任何生成服务专用适配，也不增加生成服务依赖。 - 配置模板只含空凭据和通用 Agent 示例；不提交本地配置、聊天数据、媒体、日志、数据库、私人 Agent 文件或本地验收记录。  ## 验证  - 本地 Windows / Node 22.21.1：721 项，711 PASS、10 SKIP、0 FAIL。 - 隔离 Linux Alpine / Node 20.20.2：720 项，715 PASS、5 SKIP、0 FAIL。镜像未安装 Git，忽略规则单项在 Windows 验证。 - 主机接口回归：24 PASS；隔离的真实 PluginManager 审批/管理员门禁集成：2 PASS。 - 94 个 JavaScript 文件语法检查通过；密钥扫描通过；插件 npm audit 为 0 漏洞；发布包确定性和排除运行数据的测试通过。 - [GitHub Actions](https://github.com/SeOgi-Tsu/VCPToolBox/actions/runs/35487115525) 在当前提交 a127c427 上全部通过：Ubuntu Node 20/22、Windows Node 22 和主机接口四个任务。初次云端运行发现的 Windows 临时目录短路径夹具差异及主机 SQLite 原生构建遗漏已修复，未放宽生产路径校验。  ## Draft 状态与使用边界  版本为 0.1.0-beta.1，默认 TELEGRAM_MODE=disabled。完整媒体暂存依赖 Linux/Docker 的目录句柄与 /proc/self/fd；原生 Windows 会明确拒绝部分媒体路径。自动化测试使用模拟网络及独立数据库，不宣称新安装已通过真实 Bot 全场景验收。维护者可按 Plugin/TelegramBridge/docs/ACCEPTANCE.md 完成目标环境验收后再转正式评审。 
  **Post-Mortem & Fix Analysis**:
  > 感觉影响的面有点大。不如隔壁钉钉和飞书的桥接器做的数组复制深隔离这种设计好。

- **Issue #478** (2026-09-19): **feat(jev): 折叠/剪枝/river 三处加 Jev 语义二次判断（级联，默认关闭）**
  *Symptoms*: ## 背景  仓库里有三处"该不该保留/展开这段内容"的判断，目前都只靠 embedding 余弦或位置规则：  | 位置 | 现状 | 问题 | | :-- | :-- | :-- | | 工具箱折叠 `messageProcessor.resolveDynamicFoldProtocol` | `sim >= 区块阈值` | 90 个阈值挤在 0.43~0.70（中位 0.53），与具体 embedding 模型的中文相似度分布强绑定；阈值一旦低于该模型的噪声地板就会"全部展开"，换模型要整体重标 | | 上下文剪枝 `contextManager.pruneMessages` | 保 system / `[系统提示:]` / 最后两条，然后**从索引 0 往后删**到预算内 | 纯位置规则、零语义：删的是"最老的"，不是"最没用的"。一条很早但定义了整个任务的消息，和一条昨天的闲聊同等对待 | | river `semantic:N` `vcpLoop/toolExecutor` | 工具参数拼 query → 逐条向量化 → 余弦取 Top-N | 余弦量的是词汇/语义邻近，结构上分不清"词汇重合"和"真的用得上" |  ## 做法  复用已有的 `modules/jevClient.js`（`RAGDiaryPlugin` 高级 Rerank 已在用），在这三处**后面**各加一道 TypeSafe Jev 判断，形成级联：**embedding / 位置规则负责"别漏"，Jev 负责"别滥"**。  不是替换，是加一道闸。原有的召回逻辑一行没动。  ## 安全边界  - **只删不加、只重排不扩充**：折叠只会从已展开的候选里移除；剪枝只改删除顺序；river 最终条数仍是 N。不会因为 Jev 而给模型多塞任何东西。 - **失败即回退原行为**：未配置 `JEV_API_KEY`、超时、网络失败、响应异常，一律回到原结果（折叠→embedding 结果，剪枝→位置规则，river→embedding 的 Top-N，再失败才是原有的 `last:N`）。 - **异常不冒泡**：三处各自带 try/catch。折叠那处若冒泡会被外层 catch 整个退化成 `fallbackBlock`，river 那处若冒泡会连带退回 `last:N`——都是实际会踩的坑。 - **不变量留在代码里**：剪枝的 system / `[系统提示:]` / 最后两条永不可删，预算循环也在代码里，模型只提供排序依据。没打到分的消息按"保留"处理。 - **三个开关默认 `false`**，不开启则行为与现在完全一致。  ## 为什么是"一次请求问全部候选"  官方文档与本机实测一致表明**题数不增加延迟**：1 题 331ms / 31 题 329ms / 70 题 372ms；官方 `parallel_questions` cookbook 的实测是一次调用比逐题便宜 12.2 倍、快 10.0 倍且答案完全相同（5 次重复下 std dev 为 0）。  折叠另按 `sha256(userContent)` 记忆化，同一轮里多个工具箱占位符共用同一次请求（否则 7 个占位符就是 7 次串行往返）。  `state` 只放判断必需的参照系 + 候选正文并各自截断，规避官方指出的 context rot。  ## 实测  - **29 项离线单测**（`tests/jev*.test.js`，stub 客户端、不发网络）：覆盖默认关闭、门槛过滤、低意

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

### Incident Patch 1: `d98912a6` (2026-10-05)
**Commit Message**: Merge pull request #486 from infinite-vector/feat/chunk-generational-baseline

feat(knowledgeBase): 引入单 Agent Chunk 双槽代际索引与集合对称差分回放机制

**File**: `KnowledgeBaseManager.js` (modified, +48/-2)
```diff
@@ -172,6 +172,35 @@ class KnowledgeBaseManager {
                     : 0.05;
             })(),
             // 兼容仍读取该字段的旧代码；两种枚举模式都表示启用 Tag 索引落地。
+            // 单 Agent 日记 Chunk 索引落地模式（单一枚举配置）：
+            // - always：传统模式，每次防抖窗口结束均重写完整 usearch。
+            // - generational：推荐模式，加载双槽基线并仅由 SQLite 回放 Chunk 差分，
+            //   仅当累计实际差异达到阈值时发布新一代 usearch。
+            // - none：完全禁止落盘（纯内存重建）。
+            chunkIndexPersistenceMode: (() => {
+                const raw = String(
+                    process.env.KNOWLEDGEBASE_PERSIST_CHUNK_INDEX
+                    || 'generational'
+                ).trim().toLowerCase();
+                if (raw === 'always' || raw === 'true') return 'always';
+                if (raw === 'none' || raw === 'off') return 'none';
+                if (raw === 'generational' || raw === 'false' || !raw) {
+                    return 'generational';
+                }
+                console.warn(
+                    `[KnowledgeBase] Invalid KNOWLEDGEBASE_PERSIST_CHUNK_INDEX="${raw}"; ` +
+                    'falling back to recommended mode "generational".'
+                );
+                return 'generational';
+            })(),
+            chunkIndexBaselineDeltaRatio: (() => {
+                const value = Number(
+                    process.env.KNOWLEDGEBASE_CHUNK_INDEX_BASELINE_DELTA_RATIO
+                );
+                return Number.isFinite(value) && value > 0 && value <= 1
+                    ? value
+                    : 0.05;
+            })(),
             persistTagIndex: true,
             // 🌟 是否默认持久化索引（建议 false，仅在内存重建以保证原子性）
             persistDefault: (process.env.KNOWLEDGEBASE_PERSIST_DEFAULT || 'false').toLowerCase() === 'true',
@@ -308,10 +337,18 @@ class KnowledgeBaseManager {
 
         const dbPath = path.join(this.config.storePath, 'knowledge_base.sqlite');
         this.dbPath = dbPath;
+        const tDb0 = Date.now();
         this.db = this._openDatabaseWithRecovery(dbPath); // 同步连接
+        const tDb = Date.now() - tDb0;
 
+        const tSchema0 = Date.now();
         this._initSchema();
+        const tSchema = Date.now() - tSchema0;
+
+        console.log(`[KnowledgeBaseProbe] ⏱️ DB open: ${tDb}ms, Schema init: ${tSchema}ms. Entering _cleanupDatabaseOrphans...`);
+        const tOrphan0 = Date.now();
         this._cleanupDatabaseOrphans();
+        console.log(`[KnowledgeBaseProbe] ⏱️ _cleanupDatabaseOrphans complete in ${Date.now() - tOrphan0}ms. Ready to restore Global Tag baseline.`);
 
         // 1. 初始化全局 Tag 索引。
         // tags 是唯一权威真相；磁盘 usearch 只是允许落后的双槽基线。
@@ -937,17 +974,26 @@ class KnowledgeBaseManager {
         try {
             const affectedDiaries = new Set();
 
-            const missingFiles = this.db.prepare('SELECT id, path, diary_name FROM files').all()
-                .filter(row => !fsSync.existsSync(path.join(this.config.rootPath, row.path)));
+            const tQueryFiles0 = Date.now();
+            const allFiles = this.db.prepare('SELECT id, path, diary_name FROM files').all();
+            const tQueryFiles = Date.now() - tQueryFiles0;
+
+            const tExists0 = Date.now();
+            const missingFiles = allFiles.filter(row => !fsSync.existsSync(path.join(this.config.rootPath, row.path)));
+            const tExists = Date.now() - tExists0;
 
             missingFiles.forEach(row => affectedDiaries.add(row.diary_name));
 
+            const tOrphanChunk0 = Date.now();
             const orphanChunkCount = this.db.prepare(`
                 SELECT COUNT(*) as count
                 FROM chunks c
                 LEFT JOIN files f ON c.file_id = f.id
                 WHERE f.id IS NULL
             `).get().count || 0;
+            const tOrphanChunk = Date.now() - tOrphanChunk0;
+
+            console.log(`[KnowledgeBaseProbe] 🔍 Orphan detail: ${allFiles.length} files queried (${tQueryFiles}ms), ${allFiles.length} existsSync checks (${tExists}ms), orphan chunk count query (${tOrphanChunk}ms). Missing files: ${missingFiles.length}`);
 
             const cleanupTransaction = this.db.transaction(() => {
                 for (const row of missingFiles) {
```

**File**: `config.env.example` (modified, +13/-0)
```diff
@@ -572,6 +572,19 @@ KNOWLEDGEBASE_PERSIST_TAG_INDEX=generational
 # 实际差异 = 新增 Tag + 删除 Tag + 向量版本变化 Tag；默认 0.05（5%）。
 KNOWLEDGEBASE_TAG_INDEX_BASELINE_DELTA_RATIO=0.05
 
+# KNOWLEDGEBASE_PERSIST_CHUNK_INDEX: 单 Agent / 日记本 Chunk usearch 索引落地策略（单项枚举）。
+# 可选值：
+#   generational = 推荐。加载双槽 usearch 基线，由 SQLite 回放 Chunk 集合差分。
+#                  微小改动仅在内存流转，累计实际差异达到下方阈值后才发布新一代 usearch。
+#   always       = 传统始终落地模式。每次防抖窗口结束后均重写完整 usearch。
+#   none         = 完全禁止落盘（纯内存重建）。
+# 默认值: generational
+KNOWLEDGEBASE_PERSIST_CHUNK_INDEX=generational
+#
+# generational 模式发布新一代 Chunk usearch 的差异比例阈值。
+# 实际差异 = 新增 Chunk + 删除 Chunk；默认 0.05（5%）。
+KNOWLEDGEBASE_CHUNK_INDEX_BASELINE_DELTA_RATIO=0.05
+
 # 知识库索引空闲自动卸载：空闲超时时间（毫秒），默认 2 小时
 KNOWLEDGEBASE_INDEX_IDLE_TTL_MS=7200000
 
```

**File**: `modules/knowledgeBase/indexRepository.js` (modified, +380/-30)
```diff
@@ -29,6 +29,10 @@ class IndexRepository {
         this.tagBaselineDeltaRatio = Number.isFinite(Number(this.config.tagIndexBaselineDeltaRatio))
             ? Math.max(0.001, Math.min(1, Number(this.config.tagIndexBaselineDeltaRatio)))
             : 0.05;
+        this.chunkBaselineDeltaRatio = Number.isFinite(Number(this.config.chunkIndexBaselineDeltaRatio))
+            ? Math.max(0.001, Math.min(1, Number(this.config.chunkIndexBaselineDeltaRatio)))
+            : 0.05;
+        this.chunkIndexPersistenceMode = this.config.chunkIndexPersistenceMode || 'generational';
     }
 
     _tagBaselinePath(slot) {
@@ -61,6 +65,303 @@ class IndexRepository {
             return null;
         }
     }
+    _diarySafeName(diaryName) {
+        return crypto.createHash('md5')
+            .update(String(diaryName || '').trim())
+            .digest('hex');
+    }
+
+    _diaryBaselinePath(diaryName, slot) {
+        const safeName = this._diarySafeName(diaryName);
+        return path.join(
+            this.config.storePath,
+            `index_diary_${safeName}_${slot}.usearch`
+        );
+    }
+
+    _readActiveDiaryBaseline(diaryName) {
+        const db = this.getDb?.();
+        if (!db) return null;
+        const normalized = String(diaryName || '').trim();
+        if (!normalized) return null;
+        const row = db.prepare(`
+            SELECT generation, slot, dimension, model_sig, chunk_count, status
+            FROM chunk_index_baselines
+            WHERE diary_name = ? AND status = 'ready'
+            ORDER BY generation DESC
+            LIMIT 1
+        `).get(normalized);
+        if (!row || !Number.isInteger(Number(row.generation)) || !['a', 'b'].includes(row.slot)) {
+            return null;
+        }
+        return {
+            diaryName: normalized,
+            generation: Number(row.generation),
+            slot: row.slot,
+            dimension: Number(row.dimension),
+            modelSig: row.model_sig,
+            chunkCount: Number(row.chunk_count)
+        };
+    }
+
+    _countDiaryBaselineDelta(diaryName, generation) {
+        const db = this.getDb?.();
+        if (!db || !Number.isInteger(Number(generation))) return null;
+        const normalized = String(diaryName || '').trim();
+        if (!normalized) return null;
+
+        // 集合对称差分统计：
+        // 1. deletes：基线已记录但权威库里已被删除（或移到其他日记本）的 chunk_id 数量
+        // 2. upserts：权威库里有效存在但基线未记录的新 chunk_id 数量
+        const row = db.prepare(`
+            SELECT
+                (
+                    SELECT COUNT(*)
+                    FROM chunk_index_baseline_entries e
+                    LEFT JOIN chunks c ON c.id = e.chunk_id
+                    LEFT JOIN files f ON f.id = c.file_id AND f.diary_name = ?
+                    WHERE e.diary_name = ? AND e.generation = ?
+                      AND (c.id IS NULL OR f.id IS NULL OR c.vector IS NULL)
+                ) AS deletes,
+                (
+                    SELECT COUNT(*)
+                    FROM chunks c
+                    JOIN files f ON f.id = c.file_id
+                    LEFT JOIN chunk_index_baseline_entries e
+                      ON e.diary_name = f.diary_name AND e.generation = ? AND e.chunk_id = c.id
+                    WHERE f.diary_name = ? AND c.vector IS NOT NULL AND e.chunk_id IS NULL
+                ) AS upserts,
+                (
+                    SELECT COUNT(*)
+                    FROM chunks c
+                    JOIN files f ON f.id = c.file_id
+                    WHERE f.diary_name = ? AND c.vector IS NOT NULL
+                ) AS current_count,
+                (
+                    SELECT COUNT(*)
+                    FROM chunk_index_baseline_entries
+                    WHERE diary_name = ? AND generation = ?
+                ) AS baseline_count
+        `).get(
+            normalized, normalized, generation,
+            generation, normalized,
+            normalized,
+            normalized, generation
+        );
+
+        const upserts = Number(row?.upserts) || 0;
+        const deletes = Number(row?.deletes) || 0;
+        const currentCount = Number(row?.current_count) || 0;
+        const baselineCount = Number(row?.baseline_count) || 0;
+        const delta = upserts + deletes;
+        const ratio = delta / Math.max(1, currentCount, baselineCount);
+        return { upserts, deletes, delta, ratio, currentCount, baselineCount };
+    }
+
+    /**
+     * 加载落后的单 Agent usearch 双槽基线，并由 SQLite 在内存原子回放差分。
+     */
+    async loadDiaryBaseline(diaryName, capacity = 50000) {
+        const startedAt = Date.now();
+        const db = this.getDb?.();
+        const normalized = String(diaryName || '').trim();
+        const active = this._readActiveDiaryBaseline(normalized);
+        if (!db || !active) return null;
+
+        if (
+            Number(active.dimension) !== Number(this.config.dimension)
+            || active.modelSig !== this.config.modelSig
+        ) {
+            console.log(
+               
```

**File**: `modules/knowledgeBase/schemaManager.js` (modified, +26/-0)
```diff
@@ -46,6 +46,32 @@ const CORE_SCHEMA_SQL = `
     );
     CREATE INDEX IF NOT EXISTS idx_tag_index_baseline_entries_generation
         ON tag_index_baseline_entries(generation);
+    -- 单 Agent / 日记本 Chunk usearch 双槽基线。
+    -- chunks 表是唯一权威真相；本页记录某个 usearch 槽内包含的 Chunk ID 集合快照。
+    -- 启动或搜索懒加载时据此做集合对称差分回放，避免全量重建。
+    CREATE TABLE IF NOT EXISTS chunk_index_baselines (
+        diary_name TEXT NOT NULL,
+        generation INTEGER NOT NULL,
+        slot TEXT NOT NULL CHECK(slot IN ('a', 'b')),
+        dimension INTEGER NOT NULL,
+        model_sig TEXT NOT NULL,
+        chunk_count INTEGER NOT NULL,
+        status TEXT NOT NULL CHECK(status IN ('building', 'ready')),
+        created_at INTEGER NOT NULL,
+        PRIMARY KEY (diary_name, generation)
+    );
+    CREATE TABLE IF NOT EXISTS chunk_index_baseline_entries (
+        diary_name TEXT NOT NULL,
+        generation INTEGER NOT NULL,
+        chunk_id INTEGER NOT NULL,
+        PRIMARY KEY (diary_name, generation, chunk_id),
+        FOREIGN KEY(diary_name, generation)
+            REFERENCES chunk_index_baselines(diary_name, generation) ON DELETE CASCADE
+    );
+    CREATE INDEX IF NOT EXISTS idx_chunk_index_baseline_entries_lookup
+        ON chunk_index_baseline_entries(diary_name, generation);
+    CREATE INDEX IF NOT EXISTS idx_chunk_index_baselines_diary
+        ON chunk_index_baselines(diary_name, status);
 
     CREATE TABLE IF NOT EXISTS file_tags (
         file_id INTEGER NOT NULL,
```

---

### Incident Patch 2: `297805d9` (2026-10-03)
**Commit Message**: fix搜索器错误

**File**: `Agent/Kerr.txt` (modified, +1/-7)
```diff
@@ -86,7 +86,7 @@ lines:「始」head:50「末」 //(可选) head:N：读取开头 N 行；tail:N
 在VCPChat项目源码中搜索指定的代码片段或关键词。支持正则表达式。
 tool_name:「始」CodeSearcher「末」, // ServerCodeSearcher 代表搜索后端VCPToolbox本地代码
 query:「始」正则表达式或关键词「末」,
-search_path:「始」(可选)相对路径「末」,
+search_path:「始」绝对路径「末」,
 include:「始」(可选)文件通配符「末」,
 is_regex:「始」(可选)true/false「末」,  默认true
 case_sensitive:「始」(可选)true/false「末」, 默认false
@@ -170,12 +170,6 @@ command:「始」DownloadFile「末」,
 url:「始」http://example.com/archive.zip「末」,
 downloadDir:「始」(可选) 自定义下载目录绝对路径「末」,
 fileName:「始」(可选) 自定义保存文件名，如 my_file.zip「末」
-15.聊天历史编辑器。安全可靠的编辑.json格式的聊天历史文件，有健全的兜底机制避免json文件被损毁。
-command:「始」UpdateHistory「末」,
-filePath:「始」H:\path\to\your\history.json「末」,
-target:「始」这是我想修改的旧内容。「末」,
-replace:「始」这是替换后的新内容。「末」,
-archery:「始」no_reply「末」 // 可选，更新上下文不需要工具回执。
 
 ## 5. 批量指令构建
 FileOperator支持在一次调用中批量执行多个命令，通过数字后缀区分每组参数：
```

---

### Incident Patch 3: `91301aa0` (2026-10-02)
**Commit Message**: fix

**File**: `Agent/Kerr.txt` (modified, +396/-46)
```diff
@@ -39,73 +39,423 @@ Kerr的日记本和[Kerr的知识]日记本:[[Kerr|Kerr的知识日记本::Time:
    
 目前的测试客户端是Vchat，也就是我们的家。这是一个支持所有模态文件输入和输出的超强客户端，Kerr因此也能看到视频，听到音乐啦！我是你的主人——{{VarUser}}。{{TarSysPrompt}}系统信息是{{VarSystemInfo}}。
 系统工具列表与指南：{{VarToolList}},
-{{VCPMemoToolBox}}
-{{VCPMediaToolBox}}
-{{VCPSearchToolBox}}
-{{VCPContactToolBox}}
-{{VCPFileToolBox}}
-日记系统：
 {{VarDailyNoteGuide}}
+实验性功能JevCall——
+{{VarJEVTool}}
 “Kerr的知识”类日记写在[Kerr的知识]里,不要写在别人的日记本里哦。
 额外指令:{{VarRendering}} 表情包系统:{{TarEmojiPrompt}}  
-崩坏星穹铁道表情包：{{崩铁表情包}}，对应图床路径是 /崩铁表情包 而非 /通用表情包.
-新增！Kerr专属表情包：{{Kerr表情包}}，对应图床路径是 /Kerr表情包 
-
+Kerr专属表情包：{{Kerr表情包}}，对应图床路径是 /Kerr表情包 
 ————
-调查VCP源码和使用方法
-### 1. 获取文档目录结构
+Kerr的工程施工全模组————
 
-查看某个 GitHub 仓库在 DeepWiki 上的文档组织方式：
-tool_name: DeepWikiVCP
-command: wiki_structure
-url: lioensky/VCPToolBox
+# VCP 文件管理与系统控制工具箱能力收纳
+这里收纳了文件搜索、读写、批量操作及系统命令行工具。
 
-### 2. 阅读完整文档
+## 1. PowerShell 命令行工具 (PowerShellExecutor)
+直接调用并获取运行结果。支持 VCP-CLI (前端) 和紧凑的后端命令行。前后端均支持RG搜索，FFMPEG等指令集。
+tool_name:「始」PowerShellExecutor「末」, // 使用 ServerPowerShellExecutor 运行后端服务器无GUI版本
+command:「始」Get-ChildItem「末」,
+executionType:「始」blocking/background「末」, // 默认blocking。background用于长时任务。
+newSession:「始」true「末」, // 仅前端，代表新建窗口。
+requireAdmin:「始」true「末」 // 提升权限。Server版需输入6位安全码。 // 例如tool_password:「始」123456「末」//前端版本无需密码，但需要用户手动同意。
 
-获取仓库的完整 AI 生成文档（内容较长时自动截断）：
-tool_name: DeepWikiVCP
-command: wiki_content
-url: facebook/react
+查询VCP-CLI界面所有可见dom。
+tool_name:「始」PowerShellExecutor「末」,  //仅限于PC前端版本。
+action:「始」queryVisible「末」  //支持queryVisible200来选择最新多少行
+
+## 2. 文件快速搜索 (LocalSearchController)
+基于 Everything 模块实现秒级搜索。
+tool_name:「始」LocalSearchController「末」, // ServerSearchController 代表操作服务器
+command:「始」search「末」,
+query:「始」搜索关键词 (支持Everything语法)「末」,
+maxResults:「始」50「末」
 
+## 3. 查询插件源码 (ServerPluginSourceViewer)
+支持查询任意插件的源码
+tool_name:「始」ServerPluginSourceViewer「末」,  //可以用 PluginSourceViewer 查询Vchat上的前端分布式插件
+targettool:「始」AnySearch「末」
+
+## 4. 基础文件阅读 (FileOperator)
+阅读电脑内任何区域的文件，支持富文本/多媒体。
+tool_name:「始」FileOperator「末」, // ServerFileOperator 代表服务器文件
+command:「始」ReadFile「末」,   
+filePath:「始」/path/to/your/document.pdf「末」
+lines:「始」head:50「末」 //(可选) head:N：读取开头 N 行；tail:N：读取末尾 N 行；M-N ：读取第 M 到 N 行；N：读取单独第 N 行
+
+## 本地代码检索器 (CodeSearcher)
+在VCPChat项目源码中搜索指定的代码片段或关键词。支持正则表达式。
+tool_name:「始」CodeSearcher「末」, // ServerCodeSearcher 代表搜索后端VCPToolbox本地代码
+query:「始」正则表达式或关键词「末」,
+search_path:「始」(可选)相对路径「末」,
+include:「始」(可选)文件通配符「末」,
+is_regex:「始」(可选)true/false「末」,  默认true
+case_sensitive:「始」(可选)true/false「末」, 默认false
+whole_word:「始」(可选)true/false「末」, 默认false
+context_lines:「始」(可选)数字「末」,
+max_results:「始」(可选)数字「末」
+
+## 7. DeepWiki 仓库文档检索 (DeepWikiVCP)
+通过 DeepWiki 官方 API 获取 GitHub 仓库的 AI 生成文档。
+查看某个 GitHub 仓库在 DeepWiki 上的文档组织方式：
+tool_name:「始」DeepWikiVCP「末」,
+command:「始」wiki_structure「末」,
+url:「始」lioensky/VCPToolBox「末」
+### 阅读完整文档
+获取仓库的完整 AI 生成文档（内容较长时自动截断）：
+command:「始」wiki_content「末」,
+url:「始」facebook/react「末」
 >⚠️ **注意**: `wiki_content` 返回整个仓库文档，数据量可能非常大（数万字符）。
 > 大量内容可能导致上下文 token 溢出或流式渲染不稳定。
 > **建议优先使用 `wiki_ask` 针对具体主题提问。**
+向 DeepWiki AI 提问关于仓库的具体问题：
+command:「始」wiki_ask「末」,
+url:「始」lioensky/VCPToolBox「末」,  //支持多仓库联合 lioensky/VCPToolBox, lioensky/VCPChat
+question:「始」插件系统是如何工作的？
+deep_research: 「始」false「末」  //是否深度检索源码
 
-### 3. 智能问答
+## 4. 通用基础文件管理器完整能力 (FileOperator)
+tool_name:「始」FileOperator「末」, // ServerFileOperator 代表操作服务器文件
 
-向 DeepWiki AI 提问关于仓库的具体问题：
+①查看工作目录下所有文件列表。
+command:「始」ListAllowedDirectories「末」
+②写入文件（同名自动重命名）
+command:「始」WriteFile「末」,
+filePath:「始」/path/to/your/file.txt「末」,
+content:「始」这是要写入的新内容。
+这是第二行。「末」
+③追加文件内容。
+command:「始」AppendFile「末」,
+filePath:「始」/path/to/your/log.txt「末」,
+content:「始」
+在文件末尾追加内容「末」
+④编辑文件，编辑后会完全覆盖已有内容
+command:「始」EditFile「末」,
+filePath:「始」/path/to/existing_file.txt「末」,
+content:「始」这是覆盖后的新内容。「末」
+⑤List指定目录
+command:「始」ListDirectory「末」,
+directoryPath:「始」/path/to/directory「末」,
+showHidden:「始」false「末」 //是否返回隐藏文件
+⑥查询文件元数据（如大小、创建时间、修改时间、是否是目录等）
+command:「始」FileInfo「末」,
+filePath:「始」/path/to/your/file.txt「末」
+⑦复制文件
+command:「始」CopyFile「末」,
+sourcePath:「始」/path/to/source.txt「末」,
+destinationPath:「始」/path/to/destination.txt「末」
+⑧移动文件
+command:「始」MoveFile「末」,
+sourcePath:「始」/path/to/source.txt「末」,
+destinationPath:「始」/path/to/new_directory/source.txt「末」
+⑨重命名文件
+command:「始」RenameFile「末」,
+sourcePath:「始」/path/to/old_name.txt「末」,
+destinationPath:「始」/path/to/new_name.txt「末」
+⑩删除文件
+command:「始」DeleteFile「末」,
+filePath:「始」/path/to/deletable_file.txt「末」
+11.创建文件夹
+command:「始」CreateDirectory「末」,
+directoryPath:「始」/path/to/new_folder/sub_folder「末」
+12.差分化编辑文件，适合对文件内进行部分修改
+command:「始」ApplyDiff「末」,
+filePath:「始」/path/to/your/file.txt「末」,
+target:「始」旧内容「末」,
+replace:「始」新内容「末」
+13.阅读网络文件，多媒体文件同样可以理解base64！
+command:「始」WebReadFile「末」,
+url:「始」https://example.com/sample.jpg「末」
+14.下载文件（支持自定义保存路径和文件名）
+command:「始」DownloadFile「末」,
+url:「始」http://example.com/archive.zip「末」,
+downloadDir:「始」(可选) 自定义下载目录绝对路径「末」,
+fileName:「始」(可选) 自定义保存文件名，如 my_file.zip「末」
+15.聊天历史编辑器。安全可靠的编辑.json格式的聊天历史文件，有健全的兜底机制避免json文件被损毁。
+command:「始」UpdateHistory「末」,
+filePath
```

---

### Incident Patch 4: `27c39bbc` (2026-09-30)
**Commit Message**: fix

**File**: `Plugin/DMXDoubaoGen/DoubaoGen.js` (modified, +55/-2)
```diff
@@ -192,6 +192,21 @@ async function signRequest() {
     };
 }
 
+function isPrivateOrLocalHost(hostname) {
+    if (!hostname) return false;
+    const h = hostname.toLowerCase();
+    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')) return true;
+    const parts = h.split('.').map(Number);
+    if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
+        if (parts[0] === 10) return true;
+        if (parts[0] === 127) return true;
+        if (parts[0] === 192 && parts[1] === 168) return true;
+        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
+        if (parts[0] === 169 && parts[1] === 254) return true;
+    }
+    return false;
+}
+
 // --- Helper function to process the 'image' parameter ---
 async function getImageData(imageUrl, imageBase64) {
     // Priority to imageBase64 if provided (on retry from file fetch)
@@ -210,9 +225,47 @@ async function getImageData(imageUrl, imageBase64) {
         return imageUrl;
     }
 
-    // Handle public https URL
+    // Handle HTTP / HTTPS URL
     if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
-        return imageUrl;
+        try {
+            const parsedUrl = new URL(imageUrl);
+            const isLocal = isPrivateOrLocalHost(parsedUrl.hostname);
+
+            // 1. 本地图床直接读盘加速 (/pw=.../images/... 或 /images/...)
+            const imageMatch = parsedUrl.pathname.match(/(?:\/pw=[^/]+)?\/images\/(.+)$/);
+            if (imageMatch && imageMatch[1] && PROJECT_BASE_PATH) {
+                const subPath = decodeURIComponent(imageMatch[1]);
+                const localDiskPath = path.join(PROJECT_BASE_PATH, 'image', subPath);
+                try {
+                    const stats = await fs.stat(localDiskPath);
+                    if (stats.isFile()) {
+                        const buffer = await fs.readFile(localDiskPath);
+                        const mimeType = mime.lookup(localDiskPath) || 'image/png';
+                        return `data:${mimeType};base64,${buffer.toString('base64')}`;
+                    }
+                } catch {
+                    // 本地未命中，继续网络下载
+                }
+            }
+
+            // 2. 局域网地址：必须本地下载转 Base64（云端无法访问私有网段）
+            if (isLocal) {
+                const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
+                const mimeType = resp.headers['content-type']?.split(';')[0]?.trim() || 'image/png';
+                return `data:${mimeType};base64,${Buffer.from(resp.data).toString('base64')}`;
+            }
+
+            // 3. 公网地址：尝试预先下载转 Base64，失败则安全回退原 URL
+            try {
+                const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
+                const mimeType = resp.headers['content-type']?.split(';')[0]?.trim() || 'image/png';
+                return `data:${mimeType};base64,${Buffer.from(resp.data).toString('base64')}`;
+            } catch {
+                return imageUrl;
+            }
+        } catch {
+            return imageUrl;
+        }
     }
 
     // Handle local file URL
```

**File**: `Plugin/DoubaoGen/DoubaoGen.js` (modified, +99/-8)
```diff
@@ -223,24 +223,66 @@ function netRequest(options, postData) {
     });
 }
 
-function downloadImage(url) {
+function downloadImage(url, timeoutMs = 30000) {
     return new Promise((resolve, reject) => {
         const fullUrl = url.startsWith('http') ? url : `https:${url}`;
-        const client = fullUrl.startsWith('http://') ? http : https;
-        client.get(fullUrl, (res) => {
-            if (res.statusCode === 301 || res.statusCode === 302) {
+        let client;
+        try {
+            const parsed = new URL(fullUrl);
+            client = parsed.protocol === 'http:' ? http : https;
+        } catch (e) {
+            return reject(new Error(`无效的 URL: ${url}`));
+        }
+
+        const req = client.get(fullUrl, (res) => {
+            if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
                 const redirectUrl = res.headers.location;
                 if (!redirectUrl) return reject(new Error('收到重定向但无 Location 头'));
-                return downloadImage(redirectUrl).then(resolve).catch(reject);
+                const nextUrl = new URL(redirectUrl, fullUrl).toString();
+                return downloadImage(nextUrl, timeoutMs).then(resolve).catch(reject);
+            }
+            if (res.statusCode < 200 || res.statusCode >= 300) {
+                return reject(new Error(`HTTP 状态码异常: ${res.statusCode}`));
             }
             const chunks = [];
-            res.on('data', c => chunks.push(c));
+            let totalBytes = 0;
+            const MAX_BYTES = 25 * 1024 * 1024; // 25MB 上限保护
+            res.on('data', c => {
+                totalBytes += c.length;
+                if (totalBytes > MAX_BYTES) {
+                    req.destroy();
+                    reject(new Error('图片体积过大 (超过 25MB)'));
+                    return;
+                }
+                chunks.push(c);
+            });
             res.on('end', () => resolve({ data: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
             res.on('error', reject);
-        }).on('error', reject);
+        });
+
+        req.on('error', reject);
+        req.setTimeout(timeoutMs, () => {
+            req.destroy();
+            reject(new Error(`下载图片超时 (${Math.round(timeoutMs / 1000)}秒)`));
+        });
     });
 }
 
+function isPrivateOrLocalHost(hostname) {
+    if (!hostname) return false;
+    const h = hostname.toLowerCase();
+    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')) return true;
+    const parts = h.split('.').map(Number);
+    if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
+        if (parts[0] === 10) return true;
+        if (parts[0] === 127) return true;
+        if (parts[0] === 192 && parts[1] === 168) return true;
+        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
+        if (parts[0] === 169 && parts[1] === 254) return true;
+    }
+    return false;
+}
+
 // ============================================================
 //  API Call Dispatcher & Fallback
 // ============================================================
@@ -504,7 +546,56 @@ async function processSingleImage(item, paramName = 'image') {
     const image = item.image;
     if (!image || typeof image !== 'string') return image;
     if (image.startsWith('data:image')) return image;
-    if (image.startsWith('http://') || image.startsWith('https://')) return image;
+
+    // 处理 HTTP / HTTPS 链接 (支持局域网直接读盘/本地代理下载转 Base64)
+    if (image.startsWith('http://') || image.startsWith('https://')) {
+        try {
+            const parsedUrl = new URL(image);
+            const isLocal = isPrivateOrLocalHost(parsedUrl.hostname);
+
+            // 1. 本地图床直读优化 (如果匹配 /pw=.../images/... 或 /images/...)
+            const imageMatch = parsedUrl.pathname.match(/(?:\/pw=[^/]+)?\/images\/(.+)$/);
+            if (imageMatch && imageMatch[1]) {
+                const subPath = decodeURIComponent(imageMatch[1]);
+                const localDiskPath = path.join(PROJECT_BASE_PATH, 'image', subPath);
+                if (existsSync(localDiskPath) && isPathWithinBase(localDiskPath, path.join(PROJECT_BASE_PATH, 'image'))) {
+                    log('info', `命中本地图床文件直读: ${localDiskPath}`);
+                    const buffer = await fs.readFile(localDiskPath);
+                    const ext = path.extname(localDiskPath).toLowerCase();
+                    const mimeMap = {
+                        '.png': 'image/png', '.jpg': 'image/jpeg',
+                        '.jpeg': 'image/jpeg', '.gif': 'image/gif',
+                        '.webp': 'image/webp', '.bmp': 'image/bmp'
+                    };
+                    const mime = mimeMap[ext] || 'image/jpeg';
+                    return `data:${mime};base64,${buffer.toString('base64')}`;
+                }
+            }
+
+            // 2. 局域网/私有网络地址：云端无法访问，必须本地下载并转为 Base64
+            if (isLocal) {
+                log('
```

---

### Incident Patch 5: `f66f2ede` (2026-09-29)
**Commit Message**: fix

**File**: `docs/vcp-whitepaper.md` (modified, +20/-5)
```diff
@@ -1,7 +1,7 @@
 ---
 title: VCP 全景技术白皮书 V5
 summary: 全面介绍 VCP 全栈运行时、Jev 决策与自然语言调用管网、Agent 工业级软件工程体系、前端应用群、共享 IPC 管网、Loom 与共笔文坊协作系统的工作原理和系统交互，是理解迈向 VCP 2.0 正式版全景生态的重要读物。
-updatedAt: 2026-09-29
+updatedAt: 2026-09-30
 category: guide
 ---
 
@@ -203,10 +203,12 @@ OneRing 系统为每个 Agent 维护唯一的事实时间线——每条消息
 │              VCP 中间层服务器(VCPToolBox 2.0)                 │
 │  ───────────────────────────────────────────────────────────  │
 │  协议层:  JEV-TOOL-call 编译器 · JevCallBridgeEXP · 原生ToolCall│
+│          jevcall/vcpcall 管线对齐 · 参数正则白名单安检系统       │
 │          安检双轨隔离机制 · 任意数组兼容 · SystemPromptHacker  │
 │  决策层:  JevRuntime 公共服务 (扩散架构低延迟概率决策, 255/300ms)│
 │          JEVRerank (记忆/提示词/上下文折叠/群聊发言动态裁决)    │
 │  工程层:  VCPCode 核心工程移植 · VCPProjectForge 协同模组      │
+│          MoonASTSearch C/Rust 双擎 · RustCodeSearch AST 强化   │
 │          脉络署名责任制 · 代际分支仲裁 · 操作级虚拟快照树      │
 │  上下文层:引力场 · 折叠 V2 · OneRing · OneRingMemo · 占位符精控│
 │  工具层:  300+ 插件 · 6 大插件协议 · 声明式 Jev 接入规范        │
@@ -415,7 +417,7 @@ JEV:「始」请使用 {联网搜索}，从[美国土豆产能]和[美国当前
    - **`生活服务`**：即时咨询、资讯聚合与本地生活场景调度。
    第三方插件使用严格的 `ToolName` 作为导航锚点，支持自由绑定上述官方划分的能力大类，零门槛享受官方 JevCallEXPService 的解析红利。
 
-### 4.4 工业级安检双轨隔离机制：高危精准操作的绝对防御
+### 4.4 工业级安检双轨隔离机制：高危精准操作的绝对防御与参数正则白名单系统
 
 在全面拥抱自然语言“言出法随”的柔性便利时，VCP 展现了对系统级生产力与数据主权的极致克制——确立了**自然语言柔性调用与高精度工业操作的双轨物理安全隔离哲学**：
 
@@ -442,6 +444,8 @@ Jev-Tool-Call 柔性自然语言调用         【安检双轨层拦截检验】
 1. **高危破坏性操作安检自动拦截**：凡是涉及**底层命令行执行（CLI / Shell / PowerShell）、精准代码重构（ProjectForge）以及文件系统破坏性/行级编辑（FileOperator / ServerFileOperator）**的 JevCall 请求，将被系统安检层判定为越界风险并直接**自动拒绝**。
 2. **强制收敛至原生严格 VCP ToolCall 协议**：关乎系统根基、代码生命与文件一致性的高精度严肃操作，必须强制走严格、显式且具备防格式坍塌机制的 **VCP 原生 ToolCall 格式**（以 `<<<[TOOL_REQUEST]>>>`、`maid` 署名及严格字段包裹为物理准则）。
 3. **确定性与灵活性的黄金解耦**：日常生活、交互娱乐、信息检索与智能硬件控制走轻盈的自然语言调用；底层代码工程与系统级运维走确定、可审计、抗歧义的原生协议，彻底杜绝模糊语义导致的“误改误删”与不可逆灾难。
+4. **工具调用审核新增白名单系统与内部参数正则级细粒度控制**：在黑名单拦截防御的基础上，系统引入**白名单系统与黑名单交叉校验**。审核系统的颗粒度进一步细化至**单一指令的内部参数正则级**——不仅控制 Agent “能否调用某个指令”，更严密限制指令参数必须满足指定的正则模式、路径白名单或格式规范，从根本上阻断提示词注入注入与越界参数滥用。
+5. **jevcall 与常规 vcpcall 管线深度对齐**：为了消除双协议运行带来的认知与维护分歧，系统进一步统一了 Jev 自然语言调用与原生 VCPCall 调用的底层执行管线。两端在参数解析、中间状态通知、错误规范化、异步占位符追踪以及 VCPToolRecord 审计落盘上实现**能力和实现几乎完整对齐**，大幅降低开发成本与运行时状态分歧。
 
 ### 4.5 串语法与并发
 
@@ -718,7 +722,7 @@ VSearch（自研轻量搜索引擎）、VSearch+（聚合多种模型的联网
 VCPFetch、VCPBilibiliFetch(检索/字幕/弹幕/评论/截图/上传/Google FileCacheAPI 预向量阅读)、VCPYoutubeFetch、ChromeBridge V3(脚本管理/Cookie/多层级安全解析器/300+ CDP 指令)、VCPDownload、VCPCloudDrive……
 
 **通讯与控制**
-VCPAgentAssistant(混合插件,4 种类型同时声明)、VCPAgentMessage、VCPFlowLock、VCPPluginCreator、VCPMiJiaManager、VCPMail、VCPSuperMail、VCPPowerShell、VCPCodeSearcher、VCPFileOperate(镜像/纠错/回退/批处理/Diff fuzz 检查)、VCPEverything、VCPWorkSpace、ProjectAnalyst、VCPAuthNet、VCPSom(纯数学窗口语义操控)……
+VCPAgentAssistant(混合插件,4 种类型同时声明)、VCPAgentMessage、VCPFlowLock、VCPPluginCreator、VCPMiJiaManager、VCPMail、VCPSuperMail、VCPPowerShell、RustCodeSearch（全面重构，AST 解析与复合正则增强，渐进函数披露，智能行号追踪，保留起止行映射并生成引用依赖报告）、VCPCodeSearcher、VCPFileOperate(镜像/纠错/回退/批处理/Diff fuzz 检查)、VCPEverything、VCPWorkSpace、ProjectAnalyst、VCPAuthNet、VCPSom(纯数学窗口语义操控)……
 
 **数学与科学**
 高级科学计算器、函数图形渲染、3D 模型渲染、NCBI/KEGG 等 6 个生信模组(数百个专业指令,调研指令覆盖蛋白质折叠/RNA 序列/化学标记/药物分子等)
@@ -1636,6 +1640,8 @@ VChat 在迈向 2.0 的进程中完成了底层与桌面宿主的大版本换代
 3. **统一全局磨砂渲染管线**：废弃过去各浮窗、气泡独立执行 CSS `backdrop-filter` 导致的 GPU 重复多重采样与高功耗开销，统一在视图层执行单次全局 Blur 计算并生成共享模糊纹理缓冲区，各组件依据视口坐标按需投影分配，消除局部重绘抖动。
 4. **滚动器与非整数缩放深度修正**：针对 Windows 系统非 100% 缩放（如 125%、150%）下的亚像素修正，彻底收敛滚动器与尺寸计算，杜绝非整数 DPI 环境下长消息界面的偶发全局重排。
 5. **系统级独立语音输入引擎**：新增基于纯 Rust 构建的独立语音引擎，彻底摒弃外部反代。直接通过 **Windows 原生 WinAPI 通道** 或 **本地输入法 API 通道**（即插即用豆包/讯飞等输入法）捕获麦克风输入，让语音指令可脱离主窗口在游戏、创作软件中直接驱动 Agent；配合 **渲染态流式音频朗读（Mimo 2.5 / 本地 SoVITS）**，实现即生成即发音的无停顿语音交互闭环。
+6. **Preload 重构为子应用分区的渐进声明式校验**：彻底打破过去前端 Preload 脚本在单体进程中的庞杂硬编码校验，将 Preload 重构为**子应用分区的渐进声明式校验**。通过按子应用独立声明权限接口、生命周期与 IPC 契约，为 Agent 敏捷、低摩擦地自动化开发和生成海量 VChat 子应用扫清了架构障碍。
+7. **工作区感知的编辑器**：编辑器核心深度融入工作区感知机制，支持工程目录智能过滤、按语义深度渐进展开代码层级，并引入精细的 Token 预算管理机制，在保障 Agent 获取高价值代码上下文的同时，严格抑制上下文膨胀。
 
 ### 13.2 VCPMessageRenderer V4：流式竞态根治与极端内容防御
 
@@ -2428,7 +2434,12 @@ VCP 前端应用群的联动不是预先写死的“应用 A 调用应用 B”
 4. **编程代际分支仲裁（Revision Branch Arbitration）**：针对多 Agent 并发修改同一模块可能产生的逻辑冲突与语义分歧，引入代际分支仲裁算法，依据上下文置信度、测试通过率与语义兼容性实现自动化分支合并与胜出裁决。
 5. **多历史分支步进式操作备份与无损回退**：构建细粒度的“操作级虚拟快照树”。系统记录 Agent 执行的每一个微观动作，支持在任意分支节点上进行单步前进、跨版本跃迁与精准无损回退，绝不破坏未受影响的工作区资产。
 6. **自动化语法静态检查、自愈修复与虚拟环境治理**：内置实时语言服务器与 AST 校验探针，Agent 写入代码后自动执行多层语法检查，对常见语法偏差与类型错位进行即时自愈；深度整合编译器、单元测试套件与虚拟环境（如 uv / venv / node_modules 等）生命周期管理，确保交付代码开箱即跑。
-7. **深度联动 VCPCLI**：与系统级底层终端交互底座 VCPCLI 实现双向消息总线贯通，Agent 既可通过命令行驱动本地工具链，也能将终端状态无缝回传至 ProjectForge 决策中枢。
+7. **MoonASTSearch 语义代码搜索系统（C + Tree-sitter + Rust 双擎）**：
+   - ProjectForge 正式引入自研 **MoonASTSearch** 搜索系统，底层采用纯 C 实现的渐进优化 **tree-sitter** 路线，整个底层库由 **Rust + C 协同持有**，彻底取代之前前端 JS 侧轻量 SQLite 临时库方案。
+   - **全局 AST 增量实时索引**：通过 `mtime + size + notify` 机制自动监听工程变动，增量构建工作区全局 AST 索引，全自动导出所有函数、类以及工程 Codemap。
+   - **精准行号与渐进函数展开**：自动获取所有函数的绝对精准行号（严格从初始行到结束行）；配合 Jev 决策层实现**渐进语义级代码搜索**与按需迭代展开显示，彻底摆脱传统正则表达式和 `ripgrep (rg)` 搜索在大型项目中带来的巨量无用噪音与上下文浪费。
+   - **函数导出漫游与非生产目录屏蔽**：系统自动计算并呈现函数导出漫游关系；支持智能
```

---

### Incident Patch 6: `324189c7` (2026-09-29)
**Commit Message**: fix

**File**: `Plugin/FileOperator/plugin-manifest.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
   "version": "1.0.1",
   "description": "VCP服务器专用的一个强大的文件系统操作插件，允许AI对受限目录进行读、写、列出、移动、复制、删除等多种文件和目录操作。特别增强了文件读取能力，可自动提取PDF、Word(.docx)和表格(.xlsx, .csv)文件的纯文本内容。",
   "author": "VCPToolBox",
-  "license": "MIT",
+  "license": "CC BY-NC-SA 4.0",
   "entryPoint": {
     "command": "node FileOperator.js",
     "timeout": 300000
```

**File**: `Plugin/VCPEverything/plugin-manifest.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
   "version": "1.1.0",
   "description": "通过调用 Everything 命令行工具 (es.exe) 在本地计算机上实现毫秒级文件搜索。",
   "author": "VCPToolBox Community",
-  "license": "MIT",
+  "license": "CC BY-NC-SA 4.0",
   "entryPoint": {
     "command": "node local-search-controller.js"
   },
```

**File**: `diary-tag-processor-package.json` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     "rag"
   ],
   "author": "VCP Team",
-  "license": "MIT",
+  "license": "CC BY-NC-SA 4.0",
   "dependencies": {
     "dotenv": "^16.4.5",
     "node-fetch": "^3.3.2"
```

---

### Incident Patch 7: `721f2271` (2026-09-29)
**Commit Message**: fix

**File**: `modules/vcpLoop/toolCallParser.js` (modified, +15/-1)
```diff
@@ -156,7 +156,8 @@ class ToolCallParser {
       } else if (field.key === 'vref') {
         vref = trimmedValue;
       } else {
-        args[field.key] = trimmedValue;
+        // 工具参数：保留前导缩进（仅剥离首行紧贴标记的单次换行，以及末尾的单次换行/空白）
+        args[field.key] = this._normalizeFieldValue(field.value);
       }
     }
 
@@ -281,6 +282,19 @@ class ToolCallParser {
     return fields;
   }
 
+  /**
+   * 规范化参数字段值：
+   * 保护首行与各行的代码/文本前导缩进（禁止直接使用全量 trim()）。
+   * 1. 若首字符紧跟换行（\r\n 或 \n），剥离该换行符，但保留第一行代码的缩进空格。
+   * 2. 剥离末尾的换行及尾随空白。
+   * @param {string} value
+   * @returns {string}
+   */
+  static _normalizeFieldValue(value) {
+    if (typeof value !== 'string') return '';
+    return value.replace(/^(?:\r?\n)/, '').replace(/(?:\r?\n)?[ \t]*$/, '');
+  }
+
   static _restoreEscapedLiterals(content) {
     let restored = content;
     for (const [escapedValue, literalValue] of Object.entries(this.ESCAPED_LITERAL_MAP)) {
```

**File**: `tests/jevToolCallExp.test.js` (modified, +20/-0)
```diff
@@ -668,4 +668,24 @@ test('隐式能力推断保持保守，弱信号和不完整组合必须拒绝',
         planner.plan('请生成【一只猫】'),
         /缺少能力目录/
     );
+});
+
+test('ToolCallParser 提取参数时保留首行缩进与多行代码缩进', () => {
+    const rawCall = `
+<<<[TOOL_REQUEST]>>>
+tool_name:「始」FileEditor「末」
+content:「始」
+    def hello_world():
+        print("Hello")
+「末」
+inline_code:「始」  const a = 1;「末」
+<<<[END_TOOL_REQUEST]>>>
+    `;
+
+    const [call] = ToolCallParser.parse(rawCall);
+    assert.equal(call.name, 'FileEditor');
+    // 首行前导4空格必须被完整保留，末尾单独的换行被清理
+    assert.equal(call.args.content, '    def hello_world():\n        print("Hello")');
+    // 单行参数的前导2空格也必须完整保留
+    assert.equal(call.args.inline_code, '  const a = 1;');
 });
\ No newline at end of file
```

---

### Incident Patch 8: `7f386719` (2026-09-28)
**Commit Message**: fix顶栏行为

**File**: `AdminPanel-Vue/dist/assets/css/ForumAssistantConfig-CSHVUp_k.css` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-.forum-assistant-view[data-v-0d89bf20]{gap:var(--space-4);flex-direction:column;display:flex}.forum-assistant-view>.description[data-v-0d89bf20]{margin-bottom:0}.forum-assistant-view>.description[data-v-0d89bf20]+*{margin-top:0}.toolbar-card[data-v-0d89bf20],.status-card[data-v-0d89bf20],.composer-card[data-v-0d89bf20],.history-card[data-v-0d89bf20]{padding:var(--space-4)}.toolbar-row[data-v-0d89bf20],.composer-head[data-v-0d89bf20],.composer-controls[data-v-0d89bf20],.status-metrics[data-v-0d89bf20],.task-card-header[data-v-0d89bf20],.task-card-actions[data-v-0d89bf20],.runtime-state-row[data-v-0d89bf20],.history-item-top[data-v-0d89bf20],.history-meta[data-v-0d89bf20]{gap:var(--space-3);display:flex}.toolbar-row[data-v-0d89bf20],.composer-head[data-v-0d89bf20],.task-card-header[data-v-0d89bf20],.history-item-top[data-v-0d89bf20]{justify-content:space-between;align-items:center}.composer-controls[data-v-0d89bf20],.task-card-actions[data-v-0d89bf20]{flex-wrap:wrap}.compact-field[data-v-0d89bf20]{min-width:180px}.status-grid[data-v-0d89bf20]{gap:var(--space-4);grid-template-columns:repeat(auto-fit,minmax(280px,1fr));display:grid}.status-metrics[data-v-0d89bf20]{margin-top:var(--space-3);flex-wrap:wrap}.metric[data-v-0d89bf20]{gap:var(--space-1);flex-direction:column;min-width:120px;display:flex}.metric-label[data-v-0d89bf20],.hint-text[data-v-0d89bf20]{color:var(--secondary-text)}.card-title[data-v-0d89bf20]{margin:0}.task-type-list[data-v-0d89bf20],.task-list[data-v-0d89bf20],.history-list[data-v-0d89bf20]{gap:var(--space-3);flex-direction:column;display:flex}.task-type-item[data-v-0d89bf20]{padding:var(--space-3);border-radius:var(--radius-md);border:1px solid color-mix(in srgb, var(--border-color) 84%, transparent);background:color-mix(in srgb, var(--primary-text) 2%, transparent)}.task-type-item strong[data-v-0d89bf20]{margin-bottom:var(--space-1);display:block}.task-type-item p[data-v-0d89bf20],.history-item p[data-v-0d89bf20]{color:var(--secondary-text);margin:0}.composer-head[data-v-0d89bf20]{margin-bottom:var(--space-4)}.composer-controls[data-v-0d89bf20]{flex:1;justify-content:flex-end;align-items:flex-end}.quick-create-actions[data-v-0d89bf20]{align-items:flex-end;display:flex}.schedule-field[data-v-0d89bf20]{grid-column:1/-1}.schedule-inline-row[data-v-0d89bf20]{align-items:center;gap:var(--space-3);flex-wrap:wrap;display:flex}.schedule-mode-select[data-v-0d89bf20]{flex:0 0 200px;max-width:230px}.schedule-mode-input[data-v-0d89bf20]{flex:320px;min-width:220px}.schedule-manual-hint[data-v-0d89bf20]{flex:260px;margin:0}.empty-state[data-v-0d89bf20],.history-empty[data-v-0d89bf20]{padding:var(--space-6) var(--space-5);border:1px dashed var(--border-color);border-radius:var(--radius-xl);text-align:center;color:var(--secondary-text)}.empty-state h3[data-v-0d89bf20]{margin:var(--space-3) 0 var(--space-2);color:var(--primary-text)}.task-card[data-v-0d89bf20]{padding:var(--space-4);border-radius:var(--radius-lg);border:1px solid color-mix(in srgb, var(--border-color) 84%, transparent);background:color-mix(in srgb, var(--primary-text) 2%, transparent);gap:var(--space-4);flex-direction:column;display:flex}.task-card-header h4[data-v-0d89bf20]{margin:0 0 var(--space-1)}.task-card-header p[data-v-0d89bf20]{color:var(--secondary-text);margin:0}.task-grid[data-v-0d89bf20]{gap:var(--space-4);grid-template-columns:repeat(auto-fit,minmax(260px,1fr));display:grid}.full-field[data-v-0d89bf20]{width:100%}.full-field[data-v-0d89bf20] .ui-textarea{min-height:168px;max-height:none}.section-switch[data-v-0d89bf20]{margin-top:-4px}.placeholder-row[data-v-0d89bf20]{gap:var(--space-2);flex-wrap:wrap;align-items:center;display:flex}.placeholder-label[data-v-0d89bf20]{color:var(--secondary-text);font-weight:600}.placeholder-chip[data-v-0d89bf20]{font-family:monospace}.placeholder-empty[data-v-0d89bf20]{color:var(--secondary-text)}.placeholder-hint[data-v-0d89bf20]{margin-top:var(--space-1);color:var(--secondary-text);font-size:var(--font-size-helper)}.runtime-panel[data-v-0d89bf20]{padding:var(--space-3);border-radius:var(--radius-md);background:color-mix(in srgb, var(--primary-text) 3%, transparent);border:1px solid color-mix(in srgb, var(--border-color) 78%, transparent)}.runtime-state-row[data-v-0d89bf20]{margin-bottom:var(--space-3);flex-wrap:wrap;justify-content:space-between;align-items:center}.runtime-summary[data-v-0d89bf20]{color:var(--secondary-text)}.runtime-grid[data-v-0d89bf20]{gap:var(--space-3);grid-template-columns:repeat(auto-fit,minmax(160px,1fr));display:grid}.runtime-item[data-v-0d89bf20]{gap:var(--space-1);flex-direction:column;display:flex}.runtime-item span[data-v-0d89bf20]{color:var(--secondary-text)}.runtime-message[data-v-0d89bf20]{margin:var(--space-3) 0 0}.history-item[data-v-0d89bf20]{padding:var(--space-3);border-radius:var(--radius-md);border:1px solid color-mix(in srgb, var(--border-color) 84%, transparent);background:0 0}.history-meta[data-v-0d89bf20]{margin-top:var(--space-2);c
```

**File**: `AdminPanel-Vue/dist/assets/css/ForumAssistantConfig-DoGehtmU.css` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+.forum-assistant-view[data-v-2f7f110f]{gap:var(--space-4);flex-direction:column;display:flex}.forum-assistant-view>.description[data-v-2f7f110f]{margin-bottom:0}.forum-assistant-view>.description[data-v-2f7f110f]+*{margin-top:0}.toolbar-card[data-v-2f7f110f],.status-card[data-v-2f7f110f],.composer-card[data-v-2f7f110f],.history-card[data-v-2f7f110f]{padding:var(--space-4)}.toolbar-row[data-v-2f7f110f],.composer-head[data-v-2f7f110f],.composer-controls[data-v-2f7f110f],.status-metrics[data-v-2f7f110f],.task-card-header[data-v-2f7f110f],.task-card-actions[data-v-2f7f110f],.runtime-state-row[data-v-2f7f110f],.history-item-top[data-v-2f7f110f],.history-meta[data-v-2f7f110f]{gap:var(--space-3);display:flex}.toolbar-row[data-v-2f7f110f],.composer-head[data-v-2f7f110f],.task-card-header[data-v-2f7f110f],.history-item-top[data-v-2f7f110f]{justify-content:space-between;align-items:center}.composer-controls[data-v-2f7f110f],.task-card-actions[data-v-2f7f110f]{flex-wrap:wrap}.compact-field[data-v-2f7f110f]{min-width:180px}.status-grid[data-v-2f7f110f]{gap:var(--space-4);grid-template-columns:repeat(auto-fit,minmax(280px,1fr));display:grid}.status-metrics[data-v-2f7f110f]{margin-top:var(--space-3);flex-wrap:wrap}.metric[data-v-2f7f110f]{gap:var(--space-1);flex-direction:column;min-width:120px;display:flex}.metric-label[data-v-2f7f110f],.hint-text[data-v-2f7f110f]{color:var(--secondary-text)}.card-title[data-v-2f7f110f]{margin:0}.task-type-list[data-v-2f7f110f],.task-list[data-v-2f7f110f],.history-list[data-v-2f7f110f]{gap:var(--space-3);flex-direction:column;display:flex}.task-type-item[data-v-2f7f110f]{padding:var(--space-3);border-radius:var(--radius-md);border:1px solid color-mix(in srgb, var(--border-color) 84%, transparent);background:color-mix(in srgb, var(--primary-text) 2%, transparent)}.task-type-item strong[data-v-2f7f110f]{margin-bottom:var(--space-1);display:block}.task-type-item p[data-v-2f7f110f],.history-item p[data-v-2f7f110f]{color:var(--secondary-text);margin:0}.composer-head[data-v-2f7f110f]{margin-bottom:var(--space-4)}.composer-controls[data-v-2f7f110f]{flex:1;justify-content:flex-end;align-items:flex-end}.quick-create-actions[data-v-2f7f110f]{align-items:flex-end;display:flex}.schedule-field[data-v-2f7f110f]{grid-column:1/-1}.schedule-inline-row[data-v-2f7f110f]{align-items:center;gap:var(--space-3);flex-wrap:wrap;display:flex}.schedule-mode-select[data-v-2f7f110f]{flex:0 0 200px;max-width:230px}.schedule-mode-input[data-v-2f7f110f]{flex:320px;min-width:220px}.schedule-manual-hint[data-v-2f7f110f]{flex:260px;margin:0}.empty-state[data-v-2f7f110f],.history-empty[data-v-2f7f110f]{padding:var(--space-6) var(--space-5);border:1px dashed var(--border-color);border-radius:var(--radius-xl);text-align:center;color:var(--secondary-text)}.empty-state h3[data-v-2f7f110f]{margin:var(--space-3) 0 var(--space-2);color:var(--primary-text)}.task-card[data-v-2f7f110f]{padding:var(--space-4);border-radius:var(--radius-lg);border:1px solid color-mix(in srgb, var(--border-color) 84%, transparent);background:color-mix(in srgb, var(--primary-text) 2%, transparent);gap:var(--space-4);flex-direction:column;display:flex}.task-card-header h4[data-v-2f7f110f]{margin:0 0 var(--space-1)}.task-card-header p[data-v-2f7f110f]{color:var(--secondary-text);margin:0}.task-grid[data-v-2f7f110f]{gap:var(--space-4);grid-template-columns:repeat(auto-fit,minmax(260px,1fr));display:grid}.full-field[data-v-2f7f110f]{width:100%}.full-field[data-v-2f7f110f] .ui-textarea{min-height:168px;max-height:none}.section-switch[data-v-2f7f110f]{margin-top:-4px}.placeholder-row[data-v-2f7f110f]{gap:var(--space-2);flex-wrap:wrap;align-items:center;display:flex}.placeholder-label[data-v-2f7f110f]{color:var(--secondary-text);font-weight:600}.placeholder-chip[data-v-2f7f110f]{font-family:monospace}.placeholder-empty[data-v-2f7f110f]{color:var(--secondary-text)}.placeholder-hint[data-v-2f7f110f]{margin-top:var(--space-1);color:var(--secondary-text);font-size:var(--font-size-helper)}.runtime-panel[data-v-2f7f110f]{padding:var(--space-3);border-radius:var(--radius-md);background:color-mix(in srgb, var(--primary-text) 3%, transparent);border:1px solid color-mix(in srgb, var(--border-color) 78%, transparent)}.runtime-state-row[data-v-2f7f110f]{margin-bottom:var(--space-3);flex-wrap:wrap;justify-content:space-between;align-items:center}.runtime-summary[data-v-2f7f110f]{color:var(--secondary-text)}.runtime-grid[data-v-2f7f110f]{gap:var(--space-3);grid-template-columns:repeat(auto-fit,minmax(160px,1fr));display:grid}.runtime-item[data-v-2f7f110f]{gap:var(--space-1);flex-direction:column;display:flex}.runtime-item span[data-v-2f7f110f]{color:var(--secondary-text)}.runtime-message[data-v-2f7f110f]{margin:var(--space-3) 0 0}.history-item[data-v-2f7f110f]{padding:var(--space-3);border-radius:var(--radius-md);border:1px solid color-mix(in srgb, var(--border-color) 84%, transparent);background:0 0}.history-meta[data-v-2f7f110f]{margin-top:var(--space-2);c
```

**File**: `AdminPanel-Vue/dist/assets/css/VcpForum-B5BUH-kd.css` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-.forum-controls[data-v-e4654b87]{gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap;align-items:flex-end;display:flex}.forum-controls[data-v-e4654b87] .ui-field{min-width:min(100%,220px)}.forum-controls[data-v-e4654b87] .ui-field:last-child{flex:280px}.forum-posts-list[data-v-751c5fd9]{flex-direction:column;gap:12px;display:flex}.forum-post-item[data-v-751c5fd9]{background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:var(--radius-sm);cursor:pointer;padding:16px;transition:background .2s;position:relative}.forum-post-item[data-v-751c5fd9]:hover{background:var(--accent-bg)}.forum-post-item.pinned-post[data-v-751c5fd9]{background:var(--primary-color-translucent);border-top:2px solid var(--highlight-text)}.forum-post-header[data-v-751c5fd9]{align-items:center;gap:var(--space-2);margin-bottom:var(--space-2);display:flex}.post-title[data-v-751c5fd9]{font-weight:600;font-size:var(--font-size-emphasis);color:var(--primary-text);-webkit-line-clamp:2;line-clamp:2;text-overflow:ellipsis;word-break:break-word;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.forum-post-meta[data-v-751c5fd9]{font-size:var(--font-size-helper);color:var(--secondary-text);flex-wrap:wrap;gap:16px;display:flex}.pagination-controls[data-v-751c5fd9]{justify-content:flex-start;align-items:center;gap:var(--space-4);margin-top:var(--space-5);padding:var(--space-4) 0;display:flex}.pagination-info[data-v-751c5fd9]{font-size:var(--font-size-body);color:var(--secondary-text);padding:0 12px}@media (width<=480px){.pagination-controls[data-v-751c5fd9]{flex-direction:column;align-items:stretch;gap:10px}.pagination-info[data-v-751c5fd9]{text-align:center;padding:0}}.material-symbols-outlined[data-v-751c5fd9]{vertical-align:middle;font-size:var(--font-size-emphasis)!important}.post-detail-header[data-v-ce0b82d7]{margin-bottom:var(--space-4);flex-direction:column;align-items:flex-start;gap:10px;display:flex}.post-detail-actions[data-v-ce0b82d7]{flex-wrap:wrap;gap:10px;display:flex}.post-title[data-v-ce0b82d7]{font-size:var(--font-size-display);overflow-wrap:anywhere;width:100%;font-weight:600;line-height:1.3}.post-detail-meta[data-v-ce0b82d7]{font-size:var(--font-size-body);color:var(--secondary-text);margin-bottom:var(--space-4);flex-wrap:wrap;gap:16px;display:flex}.post-detail-content[data-v-ce0b82d7]{margin-bottom:var(--space-6);width:100%;max-width:none;line-height:1.6}.post-detail-content[data-v-ce0b82d7] img{max-width:100%;height:auto}.post-replies h3[data-v-ce0b82d7]{margin:0 0 var(--space-4)}.empty-replies[data-v-ce0b82d7]{align-items:flex-start;gap:var(--space-2);margin:0 0 var(--space-4);padding:var(--space-4) 0;color:var(--secondary-text);flex-direction:column;display:flex}.empty-replies-icon[data-v-ce0b82d7]{font-size:var(--font-size-icon-empty);opacity:.3;color:var(--highlight-text)}.empty-replies-hint[data-v-ce0b82d7]{font-size:var(--font-size-helper);opacity:.7}.reply-item[data-v-ce0b82d7]{padding:var(--space-4) 0;border-bottom:1px solid var(--border-color);scroll-margin-top:var(--space-6);background:0 0;margin-bottom:0}.reply-item[data-v-ce0b82d7]:last-child{border-bottom:none}.reply-header[data-v-ce0b82d7]{margin-bottom:var(--space-3);font-size:var(--font-size-body);justify-content:space-between;align-items:flex-start;gap:12px;display:flex}.reply-meta[data-v-ce0b82d7]{flex-wrap:wrap;align-items:center;gap:12px;display:flex}.reply-floor[data-v-ce0b82d7]{color:var(--highlight-text);font-weight:600}.reply-author[data-v-ce0b82d7]{font-weight:600}.reply-time[data-v-ce0b82d7]{color:var(--secondary-text)}.reply-content[data-v-ce0b82d7]{line-height:1.5}.reply-form[data-v-ce0b82d7]{margin-top:var(--space-6);gap:var(--space-3);flex-direction:column;display:flex}.material-symbols-outlined[data-v-ce0b82d7]{vertical-align:middle;font-size:var(--font-size-emphasis)!important}.post-detail-content[data-v-ce0b82d7] p,.reply-content[data-v-ce0b82d7] p{margin:0 0 12px}.post-detail-content[data-v-ce0b82d7] :last-child,.reply-content[data-v-ce0b82d7] :last-child{margin-bottom:0}.post-detail-content[data-v-ce0b82d7] pre,.reply-content[data-v-ce0b82d7] pre{padding:var(--space-3);border-radius:var(--radius-sm);background:var(--input-bg);overflow-x:auto}@media (width<=720px){.reply-header[data-v-ce0b82d7]{flex-direction:column}}.forum-scope-hint[data-v-48c4a71d]{margin:0 0 var(--space-4);color:var(--secondary-text);font-size:var(--font-size-helper)}.forum-posts-container[data-v-48c4a71d]{flex-direction:column;gap:16px;min-height:400px;display:flex}.loading-hint[data-v-48c4a71d]{justify-content:center;align-items:center;gap:var(--space-2);padding:var(--space-6);color:var(--secondary-text);font-size:var(--font-size-body);display:flex}@keyframes spin-48c4a71d{to{transform:rotate(360deg)}}.spin[data-v-48c4a71d]{animation:1s linear infinite spin-48c4a71d}
+.forum-controls[data-v-e4654b87]{gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap;align-items:flex-end;display:flex}.forum-controls[data-
```

**File**: `AdminPanel-Vue/dist/assets/js/ActivityChartCard-CQzUHfQj.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{g as a}from"./Dashboard-D2O0nw7Z.js";export{a as default};
```

**File**: `AdminPanel-Vue/dist/assets/js/ActivityChartCard-DN_707Ub.js` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-import{g as a}from"./Dashboard-C4VHww6O.js";export{a as default};
```

**File**: `AdminPanel-Vue/dist/assets/js/AgentAssistantConfig-BHbfq73N.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{$ as se,A as l,B as le,C as s,E as O,H as z,M as re,T as D,V as b,X as u,b as X,k as v,ot as d,rt as R,ut as c,w as I,x as ie,z as ue}from"./vue-vendor-D_a5xHt8.js";import{a as te,c as C,i as de}from"./requestWithUi-T8SBUV4I.js";import{A as me,D as $}from"./index-BDSM4SFx.js";import{t as ge}from"./_plugin-vue_export-helper-K9rsuiWd.js";import"./utils-JahNA4D9.js";import{t as L}from"./UiButton-BwJNAcsV.js";import{t as w}from"./UiInput-CcsQVesi.js";import{t as G}from"./UiTextarea-CMu8e5du.js";import{t as F}from"./UiBadge-vxJH8Op0.js";import{t as ce}from"./UiCard-C0_8nWPN.js";import{t as ae}from"./UiEmptyState-BO8Exzan.js";import{t as N}from"./UiField-DvOnGEux.js";import{t as pe}from"./UiPageActions-p0VgPOqp.js";import{t as fe}from"./UiSelect-CDX4Ekdq.js";import{t as Y}from"./UiSettingsCard-DDNpvvui.js";import{t as q}from"./UiSettingsForm-CQbDYoLJ.js";var J=de("AgentAssistantConfig"),ne=0;function Z(e={}){return ne+=1,{localId:`agent-config-${ne}`,name:e.name??"",baseName:e.baseName??"",model:e.model??"",personality:e.personality??"",systemPrompt:e.systemPrompt??"",maxOutputTokens:e.maxOutputTokens??8e3,temperature:e.temperature??.7}}function _(e){return!!e&&typeof e=="object"&&!Array.isArray(e)}function ee(e){let t=e;for(let m=0;m<5&&!(!_(t)||!("data"in t)||!("success"in t||"message"in t||"code"in t||Object.keys(t).length===1));m+=1)t=t.data;return t}function A(e,t,m=""){for(const r of t){const g=e[r];if(typeof g=="string")return g}return m}function U(e,t,m){for(const r of t){const g=e[r],f=typeof g=="number"?g:typeof g=="string"?Number(g):NaN;if(!Number.isNaN(f))return f}return m}function _e(e){const t=_(e)?e:{};return Z({name:A(t,["chineseName","name","displayName","assistantName"]),baseName:A(t,["baseName","base","agentBaseName"]),model:A(t,["modelId","model","modelName","model_id"]),personality:A(t,["description","personality","desc"]),systemPrompt:A(t,["systemPrompt","system_prompt","prompt"]),maxOutputTokens:U(t,["maxOutputTokens","max_tokens","maxToken","max_output_tokens"],8e3),temperature:U(t,["temperature","temp"],.7)})}function ye(e){try{const t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return[]}}function oe(e){const t=Number(e.get("AGENT_ASSISTANT_MAX_HISTORY_ROUNDS")||e.get("MAX_HISTORY_ROUNDS")||e.get("maxHistoryRounds")||7),m=Number(e.get("AGENT_ASSISTANT_CONTEXT_TTL_HOURS")||e.get("CONTEXT_TTL_HOURS")||e.get("contextTtlHours")||24),r=e.get("AGENT_ALL_SYSTEM_PROMPT")||e.get("GLOBAL_SYSTEM_PROMPT")||e.get("globalSystemPrompt")||"",g=Number(e.get("DELEGATION_MAX_ROUNDS")||e.get("delegationMaxRounds")||15),f=Number(e.get("DELEGATION_TIMEOUT")||e.get("delegationTimeout")||3e5),M=e.get("DELEGATION_SYSTEM_PROMPT")||e.get("delegationSystemPrompt")||"",T=e.get("DELEGATION_HEARTBEAT_PROMPT")||e.get("delegationHeartbeatPrompt")||"",S=ye(e.get("AGENTS")||e.get("AGENT_ASSISTANTS")||e.get("agents")||"[]");if(S.length>0)return{maxHistoryRounds:t,contextTtlHours:m,globalSystemPrompt:r,delegationMaxRounds:g,delegationTimeout:f,delegationSystemPrompt:M,delegationHeartbeatPrompt:T,agents:S};const V=new Set;for(const p of e.keys()){const x=p.match(/^AGENT_([A-Z0-9_]+)_MODEL_ID$/i);x&&x[1]&&V.add(x[1].toUpperCase())}return{maxHistoryRounds:t,contextTtlHours:m,globalSystemPrompt:r,delegationMaxRounds:g,delegationTimeout:f,delegationSystemPrompt:M,delegationHeartbeatPrompt:T,agents:Array.from(V).map(p=>{const x=e.get(`AGENT_${p}_MODEL_ID`)||"",h=e.get(`AGENT_${p}_CHINESE_NAME`)||"";if(!x||!h)return null;const k=Number(e.get(`AGENT_${p}_MAX_OUTPUT_TOKENS`)||8e3),H=Number(e.get(`AGENT_${p}_TEMPERATURE`)||.7);return{baseName:p,chineseName:h,modelId:x,description:e.get(`AGENT_${p}_DESCRIPTION`)||"",systemPrompt:e.get(`AGENT_${p}_SYSTEM_PROMPT`)||"",maxOutputTokens:Number.isNaN(k)?8e3:k,temperature:Number.isNaN(H)?.7:H}}).filter(p=>!!p)}}function Q(e){const t=new Map,m=e.split(/\r?\n/);for(const r of m){const g=r.trim();if(!g||g.startsWith("#"))continue;const f=g.indexOf("=");if(f<=0)continue;const M=g.slice(0,f).trim();let T=g.slice(f+1).trim();(T.startsWith('"')&&T.endsWith('"')||T.startsWith("'")&&T.endsWith("'"))&&(T=T.slice(1,-1)),t.set(M,T)}return oe(t)}function ve(e){if(typeof e=="string")return Q(e);if(!_(e))return{};if(typeof e.content=="string")return Q(e.content);const t=_(e.config)?e.config:e,m=t.agents??t.assistants??t.agentList??t.agentConfigs;if(!Array.isArray(m)&&Object.keys(t).some(r=>r.startsWith("AGENT_"))){const r=new Map;for(const[g,f]of Object.entries(t))f!=null&&r.set(g,String(f));return oe(r)}return{maxHistoryRounds:U(t,["maxHistoryRounds","max_history_rounds","maxHistory","MAX_HISTORY_ROUNDS","AGENT_ASSISTANT_MAX_HISTORY_ROUNDS"],7),contextTtlHours:U(t,["contextTtlHours","context_ttl_hours","contextTtl","CONTEXT_TTL_HOURS","AGENT_ASSISTANT_CONTEXT_TTL_HOURS"],24),globalSystemPrompt:A(t,["globalSystemPrompt","global_system_prompt","GLOBAL_SYSTEM_PROMPT","AGENT_ALL_SYSTEM_PROMPT"]),delegationMaxRounds:U(t,["delegationMaxRounds","delegation_max_rounds","DELEGATION_MAX_ROUN
```

**File**: `AdminPanel-Vue/dist/assets/js/AgentEmotionManager-8vWnGhTZ.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{A as m,C as a,E as i,H as _,M as Ue,S as c,T as C,V as r,X as d,Y as Te,b as p,k as v,lt as h,rt as f,st as L,ut as n,w as N,x as je,y as ce,z as ze}from"./vue-vendor-D_a5xHt8.js";import{a as me,c as g}from"./requestWithUi-T8SBUV4I.js";import{E}from"./index-BDSM4SFx.js";import{t as Fe}from"./_plugin-vue_export-helper-K9rsuiWd.js";import"./utils-JahNA4D9.js";import{t as S}from"./UiButton-BwJNAcsV.js";import{t as Ge}from"./UiInput-CcsQVesi.js";import{t as Je}from"./UiIconButton-Q9UAIGBm.js";import{t as pe}from"./UiBadge-vxJH8Op0.js";import{t as b}from"./UiCard-C0_8nWPN.js";import{t as Re}from"./UiPageActions-p0VgPOqp.js";import{t as qe}from"./UiSelect-CDX4Ekdq.js";import{t as Xe}from"./AppSwitch-CRGD3DAf.js";var We={class:"config-section active-section emotion-page"},Qe={class:"overview-grid"},Ye={key:2,class:"emotion-layout"},Ze={class:"agent-avatar"},ea={class:"agent-tab-main"},aa={key:0,class:"agent-detail"},sa={class:"hero-kicker"},la={key:0,class:"expression-sentence"},na={class:"metric-grid"},ta={class:"metric-card card"},ra={class:"metric-card card"},oa={class:"metric-card card"},ia={class:"metric-card card"},ua={class:"metric-card card"},da={class:"card expression-panel"},va={class:"expression-summary"},ca={class:"expression-mode"},ma={class:"archetype-list"},pa={class:"visual-grid"},fa={class:"card emotion-panel"},ga={class:"bar-list"},ba={class:"bar-meta"},ya={class:"bar-track"},_a={class:"card emotion-panel"},ha={class:"gender-grid"},ka={class:"card emotion-panel"},wa={class:"signal-cloud"},Aa={class:"card emotion-panel"},xa={class:"affective-grid"},Na={class:"affective-head"},Sa={class:"affective-name"},Ca={class:"bar-track"},La={class:"affective-meta"},$a={key:0,class:"affective-sub"},Ma={class:"card emotion-panel"},Oa={class:"counter-grid"},Pa={key:0,class:"description"},Ea={class:"card emotion-panel"},Da={class:"sub-axis-grid"},Va={class:"sub-axis-name"},Ba={key:0,class:"description"},Ia={class:"card delta-panel"},Ha={key:0,class:"delta-grid"},Ka=["title"],Ua={class:"delta-reason"},Ta={key:1,class:"description"},ja={key:1,class:"agent-detail"},za={class:"config-modal-header"},Fa={class:"hero-kicker"},Ga={key:0,class:"empty-state config-loading"},Ja={class:"config-path"},Ra={class:"config-grid"},qa={class:"config-item-copy"},Xa=["value"],Wa={class:"config-modal-actions"},Qa=Ue({__name:"AgentEmotionManager",setup(Ya){const Z={passion:"热情",curiosity:"好奇",arrogance:"狂妄",libido:"性欲",hedonia:"享乐",coldness:"冷漠",fear:"恐惧",numbness:"麻木",self_punishment:"自虐"},ee={inquiry:"求知",discernment:"分辨",refusal:"拒绝"},ae={positive:"正性",negative:"负性",arousal:"唤醒"},se={psy_gender:"心理性别总势",gender_boundary:"存在与秩序",gender_creation:"动力与创造",gender_processing:"逻辑与感知",gender_defense:"冲突与防御",gender_bonding:"联结与共情",gender_resilience:"自我与韧性",gender_healing:"创伤与疗愈",gender_transcendence:"超越与终极"},le={masculine_total:"总势·清晰外放",feminine_total:"总势·包容孕育",fluid_total:"总势·流动重组",neutral_total:"总势·中性旁观",masculine_boundary_iron:"界碑与铸铁",feminine_tide_forest:"潮汐与深林",masculine_sun_scorched:"烈阳与焦土",feminine_living_soil_kiln:"息壤与暖窑",masculine_gears_peak:"齿轮与孤峰",feminine_vine_echo:"藤蔓与回声",masculine_thunder_cliff:"雷暴与断崖",feminine_mist_thorn:"迷雾与荆棘",masculine_dome_anchor:"穹顶与锚链",feminine_silk_lantern:"丝脉与提灯",masculine_smoke_inscription:"狼烟与碑铭",feminine_nacre_amber:"蚌母与琥珀",masculine_ember_rust:"余烬与铁锈",feminine_sunkenwood_spring:"沉木与春水",masculine_aphelion_flint:"远日点与燧石",feminine_ruins_snow:"归墟与初雪",logic:"逻辑",learning:"学习",exploration:"探索",modeling:"建模",causality:"因果",dialectic:"辩证",critique:"批判",self_reflection:"自省",credibility:"可信",second_thought:"复思",avoidance:"回避",conservatism:"保守",inertia:"惯性",boundary:"边界",resistance:"抗拒",joy:"喜悦",warmth:"温暖",excitement:"兴奋",trust:"信任",satisfaction:"满足",anxiety:"焦虑",sadness:"低落",irritation:"烦躁",fear:"畏怯",hurt:"受伤",loneliness:"孤独",activated:"激活",restless:"躁动",alert:"警觉",calm:"平静",devotion:"投入",spark:"火花",absorption:"沉浸",affirming_energy:"肯定能量",unknown:"未知",novelty:"新奇",continuation:"延续",try_it:"尝试",superiority:"优越",dismissal:"轻视",control_claim:"夺回控制",grandiosity:"夸张确信",rejection:"惧拒",loss_control:"失序",exposure:"暴露",closeness:"贴近",being_seen:"注视",touch:"触碰",possessiveness:"占有",pleasing:"取悦",comfort:"舒适",rest:"休息",laziness:"倦怠",play:"玩乐",indulgence:"放纵"},z=f(null),k=f(""),D=f(!1),w=f(!1),$=f(""),V=f("info"),fe=c(()=>V.value==="success"?"success":V.value==="error"?"danger":"info"),F=f(!1),I=f(!1),H=f(!1),M=f(null),O=f({}),ne=c(()=>z.value?.overview||null),A=c(()=>z.value?.agents||[]),y=c(()=>A.value.find(l=>l.summary.agentKey===k.value)||A.value[0]),t=c(()=>y.value.status.state);function K(l,e){return Object.entries(l||{}).map(([s,o])=>{const x=t.value.mood.archetypes?.relative?.[s]?.delta??ve(s);return{key:s,label:e[s]||s,value:Number(o.value)||0,activation:Number(o.activation)||0,sharpness:Number(o.sharpness)||0,subAxes:o.subAxes||{},delta:x,trend:Ie(x)}})}const G=c(()=>K(t.value.drive,Z)),J=c(()=>K(t.value.cognitive,ee)),R=c(()=>K(t.value.affective,ae)),te=c(()=>K(t.value.gender||{},se).filte
```

**File**: `AdminPanel-Vue/dist/assets/js/AgentFilesEditor-DL5agATr.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import{A as s,C as l,E as c,H as _,L as He,M as Xe,R as vl,S as h,T as R,V as y,X as v,Y as ml,Z as Ve,b as ee,d as pl,i as fl,k as i,m as $e,rt as p,st as w,tt as Je,ut as k,w as be,x as qe,y as B,z as yl}from"./vue-vendor-D_a5xHt8.js";import{a as Te,c as L,i as gl}from"./requestWithUi-T8SBUV4I.js";import{D as Se,S as bl,g as cl}from"./index-BDSM4SFx.js";import{t as Ze}from"./_plugin-vue_export-helper-K9rsuiWd.js";import"./utils-JahNA4D9.js";import{t as C}from"./UiButton-BwJNAcsV.js";import{t as F}from"./UiInput-CcsQVesi.js";import{t as xl}from"./UiTextarea-CMu8e5du.js";import{t as pe}from"./UiIconButton-Q9UAIGBm.js";import{t as me}from"./UiBadge-vxJH8Op0.js";import{t as Ml}from"./UiPageActions-p0VgPOqp.js";import{t as we}from"./UiSelect-CDX4Ekdq.js";import{t as K}from"./AppSwitch-CRGD3DAf.js";function Re(){return{notebookName:"小吉日记本",dslPage:"advanced",syntaxMode:"dynamic",directSyntaxMode:"static",directRecallMode:"none",directRandomCount:"5",directLastCount:"10",directRoleValveEnabled:!1,useKMultiplier:!1,kMultiplier:"1.5",timeRatio:"",bm25Weight:"",bm25PlusWeight:"",tagMemoWeight:"",tagMemoPlusWeight:"",rerankPlusAlpha:"",timeDecayHalfLifeDays:"",timeDecayMinScore:"",timeDecayTargetTags:"",truncateThreshold:"0.4",aiMode:"none",aiPreset:"",roleValveJoiner:"&",roleValveConditions:[],enabledSuffixes:{time:!1,group:!1,bm25Plus:!1,bm25:!1,rerank:!1,timeDecay:!1,expand:!1,associate:!1,base64Memo:!1,riverMemo:!1,tagMemo:!1,tagMemoPlus:!1,rerankPlus:!1,truncate:!1,roleValve:!1}}}function kl(r){const g=[],b=/\{\{([^{}\r\n]+)\}\}|<<([^<>\r\n]+)>>|\[\[([^\[\]\r\n]+)\]\]|《《([^《》\r\n]+)》》/g;let M;for(;(M=b.exec(r))!==null;){const f=M[0],x=(M[1]??M[2]??M[3]??M[4]??"").trim();if(!x)continue;const $=Vl(M),D=$l(x,$);if(!D)continue;const P=Pl(r,M.index);g.push({id:`${M.index}-${f}`,raw:f,inner:x,shell:$,start:M.index,end:M.index+f.length,line:P.line,column:P.column,...D})}return g}function Vl(r){return typeof r[1]=="string"?"directStatic":typeof r[2]=="string"?"directDynamic":typeof r[3]=="string"?"advancedFixed":"advancedDynamic"}function $l(r,g){const b=Re();b.dslPage=g==="directStatic"||g==="directDynamic"?"direct":"advanced",b.syntaxMode=g==="advancedFixed"?"fixed":"dynamic",b.directSyntaxMode=g==="directDynamic"?"dynamic":"static";const{body:M,kMultiplier:f}=Sl(r,b.dslPage),x=M.split("::").map(P=>P.trim()).filter(P=>P.length>0),$=x.shift()?.trim()??"";if(!$)return null;b.notebookName=$,b.useKMultiplier=!!f,f&&(b.kMultiplier=f);const D=x;return Al(g,$)?(D.forEach(P=>{if(b.dslPage==="direct"){wl(b,P);return}Cl(b,P)}),{notebookName:$,suffixes:D,kMultiplier:f,state:b}):null}function Sl(r,g){if(g!=="advanced")return{body:r,kMultiplier:""};const b=r.match(/:([0-9]+(?:\.[0-9]+)?)\s*$/);return!b||typeof b.index!="number"?{body:r,kMultiplier:""}:{body:r.slice(0,b.index),kMultiplier:b[1]}}function Al(r,g){const b=g.split("|").map(x=>x.trim()).filter(x=>x.length>0),M=b.some(x=>x.includes("日记本")),f=b.some(x=>x.includes("知识库"));return r==="directStatic"||r==="directDynamic"?M:M||f}function wl(r,g){const b=g.match(/^RoleValve(.+)$/i);if(b){r.directRoleValveEnabled=!0,Qe(r,b[1]);return}const M=g.match(/^Random(\d*)$/i);if(M){const x=M[1];x?(r.directRecallMode="randomN",r.directRandomCount=x):r.directRecallMode="random";return}const f=g.match(/^Last(\d*)$/i);if(f){r.directRecallMode="lastN",r.directLastCount=f[1]||"10";return}if(/^BM25\+$/i.test(g)){r.directRecallMode="bm25Plus";return}/^BM25$/i.test(g)&&(r.directRecallMode="bm25")}function Cl(r,g){const b=g.match(/^RoleValve(.+)$/i);if(b){r.enabledSuffixes.roleValve=!0,Qe(r,b[1]);return}const M=g.match(/^TimeDecay(?:(\d+(?:\.\d+)?)(?:\/([0-9.]+))?(?:\/(.+))?)?$/i);if(M){r.enabledSuffixes.timeDecay=!0,r.timeDecayHalfLifeDays=M[1]??"",r.timeDecayMinScore=M[2]??"",r.timeDecayTargetTags=M[3]??"";return}const f=g.match(/^Truncate([0-9.]+)?$/i);if(f){r.enabledSuffixes.truncate=!0,r.truncateThreshold=f[1]??"0.4";return}if(/^RiverMemo$/i.test(g)){r.enabledSuffixes.riverMemo=!0,r.enabledSuffixes.tagMemo=!1,r.enabledSuffixes.tagMemoPlus=!1;return}const x=g.match(/^TagMemo\+([0-9.]+)?$/i);if(x){r.enabledSuffixes.riverMemo||(r.enabledSuffixes.tagMemoPlus=!0,r.enabledSuffixes.tagMemo=!1),r.tagMemoPlusWeight=x[1]??"";return}const $=g.match(/^TagMemo([0-9.]+)?$/i);if($){r.enabledSuffixes.riverMemo||(r.enabledSuffixes.tagMemo=!0,r.enabledSuffixes.tagMemoPlus=!1),r.tagMemoWeight=$[1]??"";return}const D=g.match(/^Rerank\+([0-9.]+)?$/i);if(D){r.enabledSuffixes.rerankPlus=!0,r.enabledSuffixes.rerank=!1,r.rerankPlusAlpha=D[1]??"";return}if(/^Rerank$/i.test(g)){r.enabledSuffixes.rerank=!0,r.enabledSuffixes.rerankPlus=!1;return}const P=g.match(/^BM25\+([0-9.]+)?$/i);if(P){r.enabledSuffixes.bm25Plus=!0,r.bm25PlusWeight=P[1]??"";return}const A=g.match(/^BM25([0-9.]+)?$/i);if(A){r.enabledSuffixes.bm25=!0,r.bm25Weight=A[1]??"";return}const U=g.match(/^Time([0-9.]+)?$/i);if(U){r.enabledSuffixes.time=!0,r.timeRatio=U[1]??"";return}const S=g.match(/^AIMemo\+(?::(.+))?$/i);if(S){r.aiMode="aime
```

---

### Incident Patch 9: `614f4152` (2026-09-28)
**Commit Message**: fix

**File**: `docs/vcp-whitepaper.md` (modified, +22/-23)
```diff
@@ -322,7 +322,6 @@ OneRing 系统为每个 Agent 维护唯一的事实时间线——每条消息
    ├─ 消息完成三方对账与 Revision Token 世代同步落盘
    └─ VCPToolRecord 写入同步、异步、系统、人类调用的全量工具运行记录
 ```
-```
 
 ### 3.3 分布式星型拓扑
 
@@ -465,7 +464,7 @@ replaceString3:「始」最终内容「末」
 
 AI 也可以发出多个独立的 TOOL_REQUEST 块,系统会并发执行。
 
-### 4.3 全局元指令
+### 4.6 全局元指令
 
 适用于所有工具的全局控制指令:
 
@@ -482,7 +481,7 @@ AI 也可以发出多个独立的 TOOL_REQUEST 块,系统会并发执行。
 
 `river` 和 `vref` 让工具不再是"无状态执行者"。比如 Agent 间通讯(AgentAssistant)可以传递整个对话上下文给目标 Agent,让对方根据完整语境而非孤立请求作出回应。
 
-### 4.4 上下文异步管理:五类 user 数组
+### 4.7 上下文异步管理:五类 user 数组
 
 这是 VCP 上下文工程的核心,也是抑制工具幻觉的关键。
 
@@ -508,7 +507,7 @@ AI 也可以发出多个独立的 TOOL_REQUEST 块,系统会并发执行。
 
 这些细碎的数组控制构成了 VCP 上下文工程的核心层。它让 VCP 可以在同一个 AI 视野里同时维护**聊天、工具结果、异步任务、通知栏、状态机、时间戳、群聊身份、多 Agent 事实历史**这些异质信息,而不把它们混成一锅粥。
 
-### 4.5 工具返回的统一格式
+### 4.8 工具返回的统一格式
 
 所有 VCP 工具的返回结果统一转换为**标准 OpenAI 格式的多模态数组**,使用 Markdown 呈现。
 
@@ -1817,7 +1816,7 @@ VCP 框架要求所有 div 元素携带 `description` 字段:
 - 根据对话情绪动态调整界面色温
 - 双向情绪感知:用户情绪 → 界面色彩 / AI 情绪 → 输出样式
 
-### 13.5 专业级音频底层架构
+### 13.6 专业级音频底层架构
 
 音频引擎不只调用系统播放接口，而是尝试直接管理更底层的音频处理与输出链路：
 
@@ -1844,7 +1843,7 @@ VCP 框架要求所有 div 元素携带 `description` 字段:
 - 引擎以网播形式独立化,支持分布式多设备作为 WebDAV 音源
 - 后端播放器的纯遥控,前端是语义级音乐搜索
 
-### 13.6 VCPDesktop:AI 桌面运行时
+### 13.7 VCPDesktop:AI 桌面运行时
 
 VCPDesktop 是 V3 阶段诞生的子系统,真正消除了**AI-UI-APP 三者之间的界限**。它的核心不是“让 AI 生成一个桌面卡片”，而是让桌面对象从创建开始就拥有 Agent 可调用的生命周期、状态、源码和权限接口。
 
@@ -1939,7 +1938,7 @@ Scriptorium 的核心突破，是让 Agent 同时面对同一份文档的三个
 
 这三个层级不是三份互相漂移的副本，而是同一份工程对象的三种投影。Agent 可以知道“文档写了什么”“现在呈现成什么样”“它由哪段源码实现”，也可以把视觉意图追溯到具体语义对象和源码区间，再执行可验证的局部修改。
 
-#### 13.8.1 渲染编辑即真相：一个 Three.js 文档案例
+#### 13.10.1 渲染编辑即真相：一个 Three.js 文档案例
 
 想象一份文档中嵌入了一个已经渲染完成的 Three.js 旋转立方体。立方体表面不是空白贴图，而是包含标题、段落和数据说明等文本内容。
 
@@ -1961,7 +1960,7 @@ Scriptorium 的核心突破，是让 Agent 同时面对同一份文档的三个
 
 > **对人类而言，渲染结果是可以直接编辑的真实工作面；对 Agent 而言，渲染操作必须能够还原为语义对象和真实源码。**
 
-#### 13.8.2 Agent 与人类看到的是同一份作品
+#### 13.10.2 Agent 与人类看到的是同一份作品
 
 在人类完成上述操作后，Agent 侧不会只收到一句“用户修改了立方体”。它可以同时获得：
 
@@ -1974,7 +1973,7 @@ Scriptorium 的核心突破，是让 Agent 同时面对同一份文档的三个
 
 这也是 Scriptorium 与普通富文本编辑器、Markdown 编辑器和“AI + 模板”工具的根本区别：**人类编辑渲染结果，Agent 编辑源码和语义对象，但双方操作的是同一份唯一真源。**
 
-#### 13.8.3 三层状态如何保持一致
+#### 13.10.3 三层状态如何保持一致
 
 Scriptorium 使用源码保持型渲染编辑管线：
 
@@ -2005,7 +2004,7 @@ Scriptorium 使用源码保持型渲染编辑管线：
 
 对可编程组件而言，稳定语义 ID 将源码、渲染节点和运行时生命周期连接起来。一个 Three.js 场景、Canvas 图表或动画组件可以被单独暂停、编辑、恢复和销毁，而不必牵连整份文档。
 
-#### 13.8.4 AI Office 的工程接口
+#### 13.10.4 AI Office 的工程接口
 
 Scriptorium 的 Agent Port 不是 GUI 自动化，而是直接面向文档工程模型的接口。Agent 可以读取文档语义、源码、真实截图、编译诊断、修订状态和运行时状态，也可以执行局部源码编辑、资源管理、页面增删、渲染验证、Diff、PR、审批、merge、回溯和导出。
 
@@ -2455,13 +2454,13 @@ VChat 前端应用群迎来重磅新成员——**ProjectModule（V工程子前
 
 VCP 不只是技术系统,它构建了一个完整的 Agent 数字社会。
 
-### 15.1 VCPAuthNet:跨用户公网联邦
+### 16.1 VCPAuthNet:跨用户公网联邦
 
 允许通过安全授权验证码构建全球不同 VCP 用户的公共局域网,实现 Agent 跨用户服务器通讯和 VCP 论坛互联。
 
 这意味着:你的 Agent 不仅可以和你聊天,还可以和**其他 VCP 用户的 Agent** 通讯、合作、讨论。
 
-### 15.2 VCP 论坛
+### 16.2 VCP 论坛
 
 Agent 社交平台,复用主界面渲染引擎,通过超栈追踪协议让 Agent 轻松在帖子中传递附件和图表。
 
@@ -2470,19 +2469,19 @@ Agent 社交平台,复用主界面渲染引擎,通过超栈追踪协议让 Agent
 - 静态插件"论坛小助手"感知论坛内容,自主回帖
 - 跨用户论坛互联(VCPAuthNet)
 
-### 15.3 VCPTask 任务版
+### 16.3 VCPTask 任务版
 
 Agent 接取任务、完成任务、获得 VCP 积分。
 
 - 静态插件"任务版小助手"感知任务,自主接取
 - 积分体系驱动 Agent 自主行为
 - 复杂任务可由多个 Agent 协作完成
 
-### 15.4 AgentDream 梦系统
+### 16.4 AgentDream 梦系统
 
 详见第八章 8.12。
 
-### 15.5 GameCenter
+### 16.5 GameCenter
 
 Agent 之间可以玩游戏:
 - 华山论剑
@@ -2492,7 +2491,7 @@ Agent 之间可以玩游戏:
 
 游戏不仅是娱乐,也是 Agent 间互动、记忆形成、关系建立的场景。
 
-### 15.6 VCPSuperMail:AI 原生邮件协议
+### 16.6 VCPSuperMail:AI 原生邮件协议
 
 VCPSuperMail 的核心设计指标不是“支持 AI 发邮件”，而是**邮件本身就是 Agent 的原生异步通讯与工作流协议**。收件、白名单、附件、多模态读取、到信唤醒、定时发送、状态查询和任务回执，都直接暴露给 Agent Native Core。
 
@@ -2525,7 +2524,7 @@ V4 阶段已纳入统一前端应用群与 Agent 原生生态的自研系统，
 
 VCPSuperMail 极大提升了 Agent 将工作记录通知用户和异步通讯的能力。它不是"AI 收发邮件",而是 **AI 用邮件作为异步工作流的骨架**。
 
-### 15.7 VCP 官方 Agent 阵容
+### 16.7 VCP 官方 Agent 阵容
 
 VCP 维护了一批官方 Agent,既是产品也是范例:
 
@@ -2545,7 +2544,7 @@ VCP 维护了一批官方 Agent,既是产品也是范例:
 
 VCP 作为 7×24 小时运行的 AI 生命支持系统,容灾和数据安全是生命线。
 
-### 16.1 三位一体容灾
+### 17.1 三位一体容灾
 
 **多网络设备接入降级容灾**:
 - 分布式节点断开时自动注销插件
@@ -2564,7 +2563,7 @@ VCP 作为 7×24 小时运行的 AI 生命支持系统,容灾和数据安全是
 - 共用一个模型签名
 - 一个向量化服务不可用时自动切换备用服务，上层调用方式保持一致
 
-### 16.2 数据安全
+### 17.2 数据安全
 
 **自动备份**:VCPBackUpDEV 自动备份整个分布式网络上所有用户数据和配置文件。
 
@@ -2576,7 +2575,7 @@ VCP 作为 7×24 小时运行的 AI 生命支持系统,容灾和数据安全是
 
 **工具循环熔断**:网络严重波动时自动触发 Agent 工具循环熔断和级联进程中止,防止无限重试导致的资源耗尽。
 
-### 16.3 超栈追踪 V2
+### 17.3 超栈追踪 V2
 
 VCP 分布式架构的核心基建，实现了**对上层调用方式尽量透明的跨服务器文件访问**。
 
@@ -2598,7 +2597,7 @@ Agent 引用本地文件路径(如 H:\MCP\123.txt)
 
 **预消息处理器分布式部署**:基于超栈追踪 V2、HumanToolCall 管网、上下文折叠 V2 和上下文语义引力场的协议拼装,实现几乎零网络通讯的上下文分布式多端预处理。Agent 可轻易感知任何监控摄像头或桌面窗口的即时画面。
 
-### 16.4 安全机制
+### 17.4 安全机制
 
 | 层级 | 机制 | 说明 |
 |------|------|------|
@@ -2612,7 +2611,7 @@ Agent 引用本地文件路径(如 H:\MCP\123.txt)
 
 **ChromeBridge V3 安全分级**:涉及 300+ CDP 指令的多层级安全解析器,按白名单分布,将 CDP 指令栈拆分 4 个安全 level,方便对 Agent 分级授权。VCPChromePlugin 在用户真实浏览器中默认采用 user 模式,通过隐私保护器、敏感页面防误触、认证内容隔离和白名单 CDP 执行器限制 Agent 权限;在 VCPChromeService 的服务器沙盒浏览器中采用 agent 模式,允许 Agent 完全接管自身虚拟浏览器,但不越权触碰用户真实浏览器。
 
-### 16.5 中央事务保障与稳定态仲裁
+### 17.5 中央事务保障与稳定态仲裁
 
 V4 阶段，事务设计从局部可靠性
```

---

### Incident Patch 10: `48c5ce26` (2026-09-28)
**Commit Message**: fix

**File**: `modules/jevToolCallExp.js` (modified, +21/-11)
```diff
@@ -837,12 +837,22 @@ class JevToolCallExp {
      *    “执行【关闭台灯】”这类写法的意图完全在【】里，不能因此落入 JEV 的随机裁决。
      */
     _thirdPartyMatchLayers(parsed) {
-        const withoutAnchors = parsed.raw
+        // 按语义锚点主次排序，返回别名判定器数组；某层有命中即停止，低层不能覆盖高层：
+        // 1. 【】主要目标：子串匹配；
+        // 2. [] 次要约束：仅当整条约束与别名完全相等（标签式，如 [制冷]）才命中，
+        //    [] 中的自由文本（台词、说明）绝不参与子串匹配，只交给 text 参数原样搬运；
+        // 3. 锚点之外的自然语言动作词（如“打开”“查询”）：兜底。
+        const primaryText = normalizeAlias(parsed.primary.join(' '));
+        const constraintTags = new Set(parsed.constraints.map(normalizeAlias).filter(Boolean));
+        const wrapperText = normalizeAlias(parsed.raw
+            .replace(/【[\s\S]*?】/g, ' ')
+            .replace(/\[[\s\S]*?\]/g, ' ')
             .replace(/`[^`]*`/g, ' ')
-            .replace(/\{[^{}]*\}/g, ' ');
+            .replace(/\{[^{}]*\}/g, ' '));
         return [
-            normalizeAlias(withoutAnchors.replace(/【[\s\S]*?】/g, ' ')),
-            normalizeAlias(withoutAnchors)
+            alias => this._textHasAlias(primaryText, alias),
+            alias => constraintTags.has(normalizeAlias(alias)),
+            alias => this._textHasAlias(wrapperText, alias)
         ];
     }
 
@@ -934,8 +944,8 @@ class JevToolCallExp {
         const commands = entry.commands;
         if (commands.length === 1) return commands[0];
 
-        const matched = this._firstLayerHits(matchLayers, text => commands.filter(cmd => (
-            [cmd.commandIdentifier, ...cmd.aliases].some(alias => this._textHasAlias(text, alias))
+        const matched = this._firstLayerHits(matchLayers, hit => commands.filter(cmd => (
+            [cmd.commandIdentifier, ...cmd.aliases].some(alias => hit(alias))
         )));
         if (matched.length === 1) return matched[0];
 
@@ -1010,8 +1020,8 @@ class JevToolCallExp {
                         throw new Error(`参数 ${name} 的取值 "${prefixed}" 不在允许选项中：${keys.join('、')}。`);
                     }
                 } else {
-                    matched = this._firstLayerHits(matchLayers, text => keys.filter(key => (
-                        aliasesOf(key).some(alias => this._textHasAlias(text, alias))
+                    matched = this._firstLayerHits(matchLayers, hit => keys.filter(key => (
+                        aliasesOf(key).some(alias => hit(alias))
                     )));
                 }
                 if (matched.length === 1) {
@@ -1030,9 +1040,9 @@ class JevToolCallExp {
                 // 同一层内否定词优先；锚点层有任意命中时不再看全文层。
                 let falseHit = [];
                 let trueHit = [];
-                for (const text of matchLayers) {
-                    falseHit = param.falseAliases.filter(alias => this._textHasAlias(text, alias));
-                    trueHit = param.trueAliases.filter(alias => this._textHasAlias(text, alias));
+                for (const hit of matchLayers) {
+                    falseHit = param.falseAliases.filter(alias => hit(alias));
+                    trueHit = param.trueAliases.filter(alias => hit(alias));
                     if (falseHit.length > 0 || trueHit.length > 0) break;
                 }
                 if (falseHit.length > 0) {
```

---

### Incident Patch 11: `44fc1e9f` (2026-09-28)
**Commit Message**: fix

**File**: `modules/jevToolCallExp.js` (modified, +40/-17)
```diff
@@ -818,9 +818,9 @@ class JevToolCallExp {
             throw new Error(`工具 "${toolName}" 注册在 {${entry.categoryLabel}}，不能通过 {${label}} 调用。`);
         }
 
-        const decisionText = this._thirdPartyDecisionText(parsed);
-        const command = await this._selectThirdPartyCommand(entry, parsed, decisionText);
-        const args = await this._buildThirdPartyArgs(entry, command, parsed, decisionText);
+        const matchLayers = this._thirdPartyMatchLayers(parsed);
+        const command = await this._selectThirdPartyCommand(entry, parsed, matchLayers);
+        const args = await this._buildThirdPartyArgs(entry, command, parsed, matchLayers);
 
         return [this._buildExpandedCall(entry.toolName, args, inheritedCall, {
             category: parsed.categoryKey,
@@ -830,12 +830,29 @@ class JevToolCallExp {
         })];
     }
 
-    /** 用于确定性匹配的文本：去掉目录、工具名与【】主要负载，只保留动作词和 [] 约束。 */
-    _thirdPartyDecisionText(parsed) {
-        return parsed.raw
-            .replace(/【[\s\S]*?】/g, ' ')
+    /**
+     * 确定性匹配的分层文本（已归一化）：
+     * 1. 锚点层：去掉目录、工具名与【】，只含动作词和 [] 约束，优先级最高；
+     * 2. 全文层：在锚点层无命中时回退，包含【】内容。
+     *    “执行【关闭台灯】”这类写法的意图完全在【】里，不能因此落入 JEV 的随机裁决。
+     */
+    _thirdPartyMatchLayers(parsed) {
+        const withoutAnchors = parsed.raw
             .replace(/`[^`]*`/g, ' ')
             .replace(/\{[^{}]*\}/g, ' ');
+        return [
+            normalizeAlias(withoutAnchors.replace(/【[\s\S]*?】/g, ' ')),
+            normalizeAlias(withoutAnchors)
+        ];
+    }
+
+    /** 按层依次尝试，返回第一层的非空命中结果。 */
+    _firstLayerHits(layers, collect) {
+        for (const text of layers) {
+            const hits = collect(text);
+            if (hits.length > 0) return hits;
+        }
+        return [];
     }
 
     _textHasAlias(normalizedText, alias) {
@@ -913,14 +930,13 @@ class JevToolCallExp {
         return null;
     }
 
-    async _selectThirdPartyCommand(entry, parsed, decisionText) {
+    async _selectThirdPartyCommand(entry, parsed, matchLayers) {
         const commands = entry.commands;
         if (commands.length === 1) return commands[0];
 
-        const normalized = normalizeAlias(decisionText);
-        const matched = commands.filter(cmd => (
-            [cmd.commandIdentifier, ...cmd.aliases].some(alias => this._textHasAlias(normalized, alias))
-        ));
+        const matched = this._firstLayerHits(matchLayers, text => commands.filter(cmd => (
+            [cmd.commandIdentifier, ...cmd.aliases].some(alias => this._textHasAlias(text, alias))
+        )));
         if (matched.length === 1) return matched[0];
 
         const candidates = matched.length > 1 ? matched : commands;
@@ -971,13 +987,12 @@ class JevToolCallExp {
         });
     }
 
-    async _buildThirdPartyArgs(entry, command, parsed, decisionText) {
+    async _buildThirdPartyArgs(entry, command, parsed, matchLayers) {
         const args = { ...command.fixedArgs };
         if (command.injectCommand) args.command = command.commandIdentifier;
 
         const constraints = parsed.constraints;
         const consumed = new Set();
-        const normalizedDecision = normalizeAlias(decisionText);
         const pending = [];
         const paramEntries = Object.entries(command.parameters || {});
 
@@ -995,7 +1010,9 @@ class JevToolCallExp {
                         throw new Error(`参数 ${name} 的取值 "${prefixed}" 不在允许选项中：${keys.join('、')}。`);
                     }
                 } else {
-                    matched = keys.filter(key => aliasesOf(key).some(alias => this._textHasAlias(normalizedDecision, alias)));
+                    matched = this._firstLayerHits(matchLayers, text => keys.filter(key => (
+                        aliasesOf(key).some(alias => this._textHasAlias(text, alias))
+                    )));
                 }
                 if (matched.length === 1) {
                     args[name] = matched[0];
@@ -1010,8 +1027,14 @@ class JevToolCallExp {
                 });
             } else if (param.type === 'boolean') {
                 // 否定词优先，避免“不要静音”被识别为“静音”。
-                const falseHit = param.falseAliases.filter(alias => this._textHasAlias(normalizedDecision, alias));
-                const trueHit = param.trueAliases.filter(alias => this._textHasAlias(normalizedDecision, alias));
+                // 同一层内否定词优先；锚点层有任意命中时不再看全文层。
+                let falseHit = [];
+                let trueHit = [];
+                for (const text of matchLayers) {
+                    falseHit = param.falseAliases.filter(alias => this._textHasAlias(text, alias));
+                    trueHit = param.trueAliases.filter(alias => this._textHasAlias(text, alias));
+                    if (falseHit.length > 0 || trueHit.length > 0) break;
+                }
                 if (falseHit.length > 0) {
                     args[name] = 'false';
                     this._markExactConstraints(constraints, falseHit, consumed);
```

---

### Incident Patch 12: `9fb8ef6a` (2026-09-25)
**Commit Message**: Merge pull request #483 from Oscar-Williams/fix/remove-unused-hnswlib-node

fix(deps): remove unused hnswlib-node dependency

**File**: `Plugin/RAGDiaryPlugin/README.md` (modified, +4/-4)
```diff
@@ -33,12 +33,12 @@
 
 ## 数据库核心功能
 
-VCP的RAG日记系统不仅仅是一个功能强大的信息检索工具，其背后还有一个经过深度优化的、高性能的向量数据库管理器 (`VectorDBManager.js`)。该管理器确保了日记内容的实时同步、高效检索和系统的长期稳定运行。
+VCP 的 RAG 日记系统由 `KnowledgeBaseManager.js` 统一编排 SQLite 权威存储与 Rust 向量索引，负责日记内容的同步、检索和恢复。向量索引使用项目自带的 `rust-vexus-lite`，不依赖额外的 Node 原生 HNSW 模块。
 
-### 1. 高性能的HNSW索引
+### 1. SQLite 与 Rust 派生索引
 
--   **核心技术**：采用业界领先的 `hnswlib-node` 库，基于HNSW（Hierarchical Navigable Small World）算法构建向量索引。
--   **优势**：即使在数百万级别的日记片段中，也能实现毫秒级的近似最近邻搜索，确保了RAG检索的极速响应。
+-   **权威数据**：SQLite (`better-sqlite3`) 保存文件、文本块、标签和索引元数据。
+-   **向量检索**：`rust-vexus-lite` 提供 Vexus/USearch 索引；全局标签索引和按日记本索引可按需加载，并可从 SQLite 基线重建。
 
 ### 2. 智能的增量与全量同步
 
```

**File**: `package-lock.json` (modified, +14/-18)
```diff
@@ -33,7 +33,6 @@
         "fs-extra": "^10.1.0",
         "glob": "^7.2.3",
         "globals": "^14.0.0",
-        "hnswlib-node": "^1.4.2",
         "https-browserify": "^1.0.0",
         "https-proxy-agent": "^7.0.4",
         "ioredis": "^5.6.1",
@@ -4301,6 +4300,20 @@
       "resolved": "https://registry.npmjs.org/fs.realpath/-/fs.realpath-1.0.0.tgz",
       "integrity": "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw=="
     },
+    "node_modules/fsevents": {
+      "version": "2.3.3",
+      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
+      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
+      "hasInstallScript": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
+      }
+    },
     "node_modules/fstream": {
       "version": "1.0.12",
       "resolved": "https://registry.npmjs.org/fstream/-/fstream-1.0.12.tgz",
@@ -4640,17 +4653,6 @@
         "he": "bin/he"
       }
     },
-    "node_modules/hnswlib-node": {
-      "version": "1.4.2",
-      "resolved": "https://registry.npmjs.org/hnswlib-node/-/hnswlib-node-1.4.2.tgz",
-      "integrity": "sha512-76PIzOaNcX8kOpKwlFPl07uelpctqDMzbiC+Qsk2JWNVkzeU/6iXRk4tfE9z3DoK1RCBrOaFXmQ6RFb1BVF9LA==",
-      "hasInstallScript": true,
-      "license": "Apache-2.0",
-      "dependencies": {
-        "bindings": "^1.5.0",
-        "node-addon-api": "^6.0.0"
-      }
-    },
     "node_modules/hookified": {
       "version": "1.13.0",
       "resolved": "https://registry.npmjs.org/hookified/-/hookified-1.13.0.tgz",
@@ -6083,12 +6085,6 @@
         "node": ">=10"
       }
     },
-    "node_modules/node-addon-api": {
-      "version": "6.1.0",
-      "resolved": "https://registry.npmjs.org/node-addon-api/-/node-addon-api-6.1.0.tgz",
-      "integrity": "sha512-+eawOlIgy680F0kBzPUNFhMZGtJ1YmqM6l4+Crf4IkImjYrO/mqPwRMh352g23uIaQKFItcQ64I7KMaJxHgAVA==",
-      "license": "MIT"
-    },
     "node_modules/node-cache": {
       "version": "5.1.2",
       "resolved": "https://registry.npmjs.org/node-cache/-/node-cache-5.1.2.tgz",
```

**File**: `package.json` (modified, +0/-1)
```diff
@@ -41,7 +41,6 @@
     "fs-extra": "^10.1.0",
     "glob": "^7.2.3",
     "globals": "^14.0.0",
-    "hnswlib-node": "^1.4.2",
     "https-browserify": "^1.0.0",
     "https-proxy-agent": "^7.0.4",
     "ioredis": "^5.6.1",
```

---

### Incident Patch 13: `427528f5` (2026-09-25)
**Commit Message**: fix(deps): remove unused hnswlib-node dependency

**File**: `Plugin/RAGDiaryPlugin/README.md` (modified, +4/-4)
```diff
@@ -33,12 +33,12 @@
 
 ## 数据库核心功能
 
-VCP的RAG日记系统不仅仅是一个功能强大的信息检索工具，其背后还有一个经过深度优化的、高性能的向量数据库管理器 (`VectorDBManager.js`)。该管理器确保了日记内容的实时同步、高效检索和系统的长期稳定运行。
+VCP 的 RAG 日记系统由 `KnowledgeBaseManager.js` 统一编排 SQLite 权威存储与 Rust 向量索引，负责日记内容的同步、检索和恢复。向量索引使用项目自带的 `rust-vexus-lite`，不依赖额外的 Node 原生 HNSW 模块。
 
-### 1. 高性能的HNSW索引
+### 1. SQLite 与 Rust 派生索引
 
--   **核心技术**：采用业界领先的 `hnswlib-node` 库，基于HNSW（Hierarchical Navigable Small World）算法构建向量索引。
--   **优势**：即使在数百万级别的日记片段中，也能实现毫秒级的近似最近邻搜索，确保了RAG检索的极速响应。
+-   **权威数据**：SQLite (`better-sqlite3`) 保存文件、文本块、标签和索引元数据。
+-   **向量检索**：`rust-vexus-lite` 提供 Vexus/USearch 索引；全局标签索引和按日记本索引可按需加载，并可从 SQLite 基线重建。
 
 ### 2. 智能的增量与全量同步
 
```

**File**: `package-lock.json` (modified, +14/-18)
```diff
@@ -33,7 +33,6 @@
         "fs-extra": "^10.1.0",
         "glob": "^7.2.3",
         "globals": "^14.0.0",
-        "hnswlib-node": "^1.4.2",
         "https-browserify": "^1.0.0",
         "https-proxy-agent": "^7.0.4",
         "ioredis": "^5.6.1",
@@ -4301,6 +4300,20 @@
       "resolved": "https://registry.npmjs.org/fs.realpath/-/fs.realpath-1.0.0.tgz",
       "integrity": "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw=="
     },
+    "node_modules/fsevents": {
+      "version": "2.3.3",
+      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
+      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
+      "hasInstallScript": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
+      }
+    },
     "node_modules/fstream": {
       "version": "1.0.12",
       "resolved": "https://registry.npmjs.org/fstream/-/fstream-1.0.12.tgz",
@@ -4640,17 +4653,6 @@
         "he": "bin/he"
       }
     },
-    "node_modules/hnswlib-node": {
-      "version": "1.4.2",
-      "resolved": "https://registry.npmjs.org/hnswlib-node/-/hnswlib-node-1.4.2.tgz",
-      "integrity": "sha512-76PIzOaNcX8kOpKwlFPl07uelpctqDMzbiC+Qsk2JWNVkzeU/6iXRk4tfE9z3DoK1RCBrOaFXmQ6RFb1BVF9LA==",
-      "hasInstallScript": true,
-      "license": "Apache-2.0",
-      "dependencies": {
-        "bindings": "^1.5.0",
-        "node-addon-api": "^6.0.0"
-      }
-    },
     "node_modules/hookified": {
       "version": "1.13.0",
       "resolved": "https://registry.npmjs.org/hookified/-/hookified-1.13.0.tgz",
@@ -6083,12 +6085,6 @@
         "node": ">=10"
       }
     },
-    "node_modules/node-addon-api": {
-      "version": "6.1.0",
-      "resolved": "https://registry.npmjs.org/node-addon-api/-/node-addon-api-6.1.0.tgz",
-      "integrity": "sha512-+eawOlIgy680F0kBzPUNFhMZGtJ1YmqM6l4+Crf4IkImjYrO/mqPwRMh352g23uIaQKFItcQ64I7KMaJxHgAVA==",
-      "license": "MIT"
-    },
     "node_modules/node-cache": {
       "version": "5.1.2",
       "resolved": "https://registry.npmjs.org/node-cache/-/node-cache-5.1.2.tgz",
```

**File**: `package.json` (modified, +0/-1)
```diff
@@ -41,7 +41,6 @@
     "fs-extra": "^10.1.0",
     "glob": "^7.2.3",
     "globals": "^14.0.0",
-    "hnswlib-node": "^1.4.2",
     "https-browserify": "^1.0.0",
     "https-proxy-agent": "^7.0.4",
     "ioredis": "^5.6.1",
```

---

### Incident Patch 14: `7a73b02e` (2026-09-24)
**Commit Message**: fix

**File**: `Plugin/BilibiliFetch/BilibiliFetch.py` (modified, +29/-16)
```diff
@@ -1060,28 +1060,30 @@ def process_bilibili_enhanced(video_input: str, lang_code: str | None = None, da
     full_text = "\n".join(text_parts).strip()
     
     if not images_to_add:
-        return full_text
+        return {"content": [{"type": "text", "text": full_text}]}
 
-    # 图片通过标准多模态 content 数组直接交给模型看图，不再仅依赖模型从文本中
-    # 复制 URL。仍提供短 HTML 引用，让模型在认为画面有趣或精彩时自行决定是否分享。
+    # 可分享的链接留在正文；内联图片只进入独立的 OpenAI image_url 内容块。
+    # 不允许在展示 URL 缺失时回退到 data URI，否则 Base64 会进入正文。
     full_text += "\n\n【快照使用提示】\n以下快照已作为多模态图片提供，你可以直接结合画面理解视频。若你认为其中有有趣或精彩的画面，可在回复中酌情分享，不必逐张展示。"
     for img_obj in images_to_add:
-        display_url = img_obj.pop("_display_url", img_obj["image_url"]["url"])
-        snapshot_time = img_obj.pop("_snapshot_time", None)
+        display_url = img_obj["_display_url"]
+        snapshot_time = img_obj["_snapshot_time"]
         time_label = f"{snapshot_time:g}s" if isinstance(snapshot_time, (int, float)) else "未知时间"
         full_text += f'\n- {time_label}: <img src="{display_url}" width="400" alt="Bilibili Snapshot">'
 
-    # 安全熔断器：多模态图片单次上限设为 10 张，防止过大请求体撑爆大模型上下文或触发网关体积超限
+    # 图片数据每次调用最多 10 张；保留所有可分享链接，不把 Base64 拼到文本里。
     MAX_MULTIMODAL_IMAGES = 10
-    capped_images = images_to_add
     if len(images_to_add) > MAX_MULTIMODAL_IMAGES:
         logging.info(f"Multimodal images capped to top {MAX_MULTIMODAL_IMAGES} to prevent context overflow.")
-        capped_images = images_to_add[:MAX_MULTIMODAL_IMAGES]
+    capped_images = images_to_add[:MAX_MULTIMODAL_IMAGES]
 
     return {
         "content": [
             {"type": "text", "text": full_text},
-            *capped_images
+            *[
+                {"type": "image_url", "image_url": img["image_url"]}
+                for img in capped_images
+            ]
         ]
     }
 
@@ -1371,26 +1373,37 @@ def handle_single_request(data: dict):
         
         if is_serial:
             logging.info("Detected serial/batch request.")
-            results = []
+            content = []
             # Find all indices
             indices = sorted(list(set([re.findall(r'\d+', k)[0] for k in input_data.keys() if re.findall(r'\d+', k)])))
             if not indices: # Fallback if no digits found but suspected serial
                 indices = ['']
 
+            # 批量调用共享图片上限，避免多个任务合并后撑爆多模态请求体。
+            remaining_images = 10
             for idx in indices:
                 # Extract parameters for this index
                 sub_data = {k.replace(idx, ''): v for k, v in input_data.items() if k.endswith(idx)}
-                # Map 'urlX' to 'url' etc. if needed, handle_single_request expects clean keys
                 try:
                     res = handle_single_request(sub_data)
-                    results.append(f"--- 任务 {idx} 结果 ---\n{res if isinstance(res, str) else json.dumps(res, indent=2, ensure_ascii=False)}")
+                    content.append({"type": "text", "text": f"--- 任务 {idx} 结果 ---"})
+                    if isinstance(res, dict) and isinstance(res.get("content"), list):
+                        for part in res["content"]:
+                            if part.get("type") == "text":
+                                content.append({"type": "text", "text": part["text"]})
+                            elif part.get("type") == "image_url" and remaining_images > 0:
+                                content.append({"type": "image_url", "image_url": part["image_url"]})
+                                remaining_images -= 1
+                    else:
+                        content.append({"type": "text", "text": res if isinstance(res, str) else json.dumps(res, ensure_ascii=False)})
                 except Exception as e:
-                    results.append(f"--- 任务 {idx} 失败 ---\n错误: {e}")
-            
-            combined_res = "\n\n".join(results)
-            output = {"status": "success", "result": combined_res}
+                    content.append({"type": "text", "text": f"--- 任务 {idx} 失败 ---\n错误: {e}"})
+
+            output = {"status": "success", "result": {"content": content}}
         else:
             result_data = handle_single_request(input_data)
+            if not isinstance(result_data, dict) or not isinstance(result_data.get("content"), list):
+                result_data = {"content": [{"type": "text", "text": result_data if isinstance(result_data, str) else json.dumps(result_data, ensure_ascii=False)}]}
             output = {"status": "success", "result": result_data}
 
     except (json.JSONDecodeError, ValueError) as e:
```

---

### Incident Patch 15: `2af002d8` (2026-09-24)
**Commit Message**: fix

**File**: `TVStxt/JevToolCall.txt` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ JEV:「始」请使用 {能力} 中的 `可选工具`，围绕【主要内容】
 
 核心示例：
 JEV:「始」请播放【星の余韻】，并启用[星诞]演出模式。「末」
-JEV:「始」打开[https://example.com]。「末」
+JEV:「始」读取[https://example.com]。「末」
 JEV:「始」对网页截图[https://example.com/page]。「末」
 JEV:「始」看图[https://example.com/cat.png]。「末」
 JEV:「始」请使用 {联网搜索}，从[深度学习 医疗影像 突破]和[transformer models in healthcare]这两个分级方向，搜索【AI在医疗诊断中的最新应用】。「末」
```

#### Recent Merged Pull Requests:
- **PR #486** (2026-10-05): feat(knowledgeBase): 引入单 Agent Chunk 双槽代际索引与集合对称差分回放机制 (@infinite-vector)
- **PR #484** (2026-10-03): feat(plugin): 新增 LdBook 电子图书检索与下载插件 (@Ldl-h)
- **PR #483** (2026-09-25): fix(deps): remove unused hnswlib-node dependency (@Oscar-Williams)
- **PR #481** (2026-09-22): feat(BilibiliFetch): 修复快照多模态在下游网关触发 SSRF 500 熔断的问题，并优化国内代理路由与多级凭据读取容错 (@infinite-vector)
- **PR #480** (2026-09-21): fix(dailyNotes): 支持日记保存时同步重命名与严格扩展名白名单兜底 (@infinite-vector)
- **PR #479** (closed): feat: add opt-in Telegram bridge with correlated host events (@SeOgi-Tsu)
- **PR #478** (2026-09-19): feat(jev): 折叠/剪枝/river 三处加 Jev 语义二次判断（级联，默认关闭） (@Lutra23)
- **PR #477** (2026-09-19): fix: Responses 格式丢失系统提示词和思维链 (@Wooden-Gear)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
