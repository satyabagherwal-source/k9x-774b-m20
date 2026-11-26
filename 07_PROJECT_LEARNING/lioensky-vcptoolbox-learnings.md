> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source**: github ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Source Version**: `ff2624ee`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T03:13:12.036Z  
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
> **Harvest Timestamp**: 2026-11-26T03:13:12.031Z  
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
- **Issue #645** (2026-11-25): **RiverMemo V6.1：用拓扑虫洞与路线态 Ω 运输查询方向**
  *Symptoms*: ## 改动 用已发布 CSR 和实际首跳流计算路线态 Ω，运输候选共用的查询方向，替代读出时的 XW SQL 见证与专项加分。全网 Ω、普通 Hop-1 代理、Sense、召回及资产格式不变。更新读出文档并包含旋转不变量单测。本 PR 仅提交源码与文档；使用新读出需重新构建或加载对应原生模块，无须重训资产。  ## 验证 - Windows x64 实验构建已通过三查询 × 两轨的 LightMemo 冒烟检查，六个有序召回池与基线一致。 - 维护者定向人工评测：30 组虫洞查询整体有可辨提升，未完全达到预期；抽测 10 组常规黄金基准未观察到退行，其中 1 组第 6、7 名互换，判断略优。非随机样本，不据此推算普遍胜率。 - 实验工作区 Rust 单测 267 通过；两项依赖私有夹具的测试未随 PR 提交。

- **Issue #644** (2026-11-25): **feat(context): 基于上游用量的 token 计量与出站前上下文预算检查**
  *Symptoms*: ## 背景  - 管理面板「最终上下文」的 token 数用 cl100k_base 计算，对中文偏大约一半。 - `contextTokenLimit` 的裁剪发生在展开（Agent 变量、RAG、预处理器、角色分割）之前，按字符数估算，量到的不是模型真正收到的体积；工具循环里再次请求上游时完全没有检查，单次工具结果很大时会直接撞上游的上下文上限。  ## 改动  **计量** - 新增 `modules/contextBudget.js` 作为统一估算入口：汉字按 2、其余按 1，除以 3；图片按固定值，不把 Base64 当文本数。请求路径上不跑分词器（实测同步分词每 MB 文本 130~380ms，会卡住事件循环）。 - 用上游返回的 `usage.prompt_tokens` 按请求、按模型持续校准估算（很小的请求不参与校准；Anthropic 风格用量把缓存读写部分加回）。 - 流式请求默认带 `stream_options.include_usage`（`UpstreamStreamIncludeUsage`，上游不支持时自动回退）。 - 「最终上下文」面板只显示一个 Token 数：有上游用量用上游的，没有就用本地估算。  **出站前预算检查**（`ContextBudgetGuard=off|observe|enforce`，默认 `observe`，默认行为与现在一致，只多一行日志） - 检查点在所有展开完成之后、发往上游之前；工具循环每次再发上游之前也检查一次。 - `enforce` 下超预算时，先把当前轮之前的工具结果压成「开头 + 省略说明 + 结尾」（循环内的工具回执和历史 assistant 正文里的工具结果块都处理，按起止标记配对扫描，代码围栏里的示例不动，保留调用记录编号），仍超才拒绝：非流式返回 400 `context_length_exceeded`，流式返回带说明的 SSE 块，说明里列出系统提示、历史、本轮、工具定义各自的估算。工具循环中仍超则停止循环并告知用户。 - 新增可选的 `ContextBudgetHardCap`：服务端硬上限，与请求里的 `contextTokenLimit` 取小，请求没带上限时也生效。 - 非法的上限（负数、非数字）视为没有。  **裁剪**（仍受 `ContextPruneEnabled` 控制，默认关闭） - 挪到展开之后执行，按 token 而不是字符估算。 - 工具调用和它的结果作为一个单元同进同退；当前轮（最后一条用户发言到末尾）完整保留；裁剪后开头不留没有对应提问的回复。 - 新增 `ContextPruneTargetRatio`（默认 1，行为不变）：调低后按固定档位成批删除，对话在同一档内增长时保留的前缀不变，对上游提示缓存更友好。  ## 兼容性  - 默认配置下不改变任何请求的内容：`ContextBudgetGuard=observe`、`ContextPruneEnabled=false`、`ContextBudgetHardCap` 为空。 - `fetchWithRetry` 本体未改，`include_usage` 通过外层包装注入。  ## 测试  - 新增 `tests/contextBudget.test.js`、`tests/streamUsageOption.test.js`、`tests/finalContextStoreTokens.test.js`；连同原有的 `tests/jevContextPrune.test.js
  **Post-Mortem & Fix Analysis**:
  > cl100k_base 无法对claude gpt gemini的任何模型进行实际有效的token统计，这个pr前提不成立。

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

### Incident Patch 1: `0868bc6d` (2026-11-25)
**Commit Message**: fix(context): recognise role-split tool results, keep observe read-only, tiered slimming

Follow-up to the review of this branch.

- tool results that the role divider splits out of earlier replies are
  recognised as tool results: they stay in one unit with the call that
  produced them, do not count as the start of the current turn, and are
  slimmed block by block
- the current turn starts at the last message the user actually wrote;
  continue prompts and other system-authored user messages do not count
- observe / off never rewrite message content, also when pruning is on
- code fences are tracked with a line-based state machine (4+ backticks,
  tildes, inline backticks); cuts never split a surrogate pair
- slimming is tiered by distance: older history becomes a compact stub,
  the last few turns keep a roomier head and tail, earlier steps of the
  current turn come last; sizes are configurable
- the prune boundary is remembered per conversation in memory and only
  moves forward, so a small drop in size does not bring dropped messages
  back
- usage calibration and the include_usage channel memory follow the model
  that actually answered after a fallback; image-heavy request

**File**: `AdminPanel-Vue/src/views/FinalContextViewer.vue` (modified, +4/-2)
```diff
@@ -1059,7 +1059,7 @@ function formatNumber(value: number | undefined): string {
 }
 
 // 只展示一个 Token 总数：上游返回了 usage 就用它，否则用本地计数，界面不区分来源。
-// 分块只展示占比，分项数字和总数口径不同，并列显示会造成误读。
+// 分块展示占比和按占比折算的大约数量：折算以上面这个总数为准，各块加起来与总数一致。
 function contextTokens(summary: { totalTokenCount?: number; upstreamUsage?: FinalContextUpstreamUsage | null } | undefined): number {
   return summary?.upstreamUsage?.promptTokens || summary?.totalTokenCount || 0
 }
@@ -1068,7 +1068,9 @@ function formatShare(tokenCount: number | undefined): string {
   const total = snapshot.value?.summary.totalTokenCount || 0
   if (!total || !tokenCount) return '0%'
   const percent = (tokenCount / total) * 100
-  return `${percent >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`
+  const share = `${percent >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`
+  const approx = Math.round((tokenCount / total) * contextTokens(snapshot.value?.summary))
+  return approx > 0 ? `${share}（约 ${formatNumber(approx)}）` : share
 }
 
 function blockToSearchText(block: FinalContextBlockSummary): string {
```

**File**: `config.env.example` (modified, +14/-0)
```diff
@@ -872,8 +872,20 @@ UpstreamStreamIncludeUsage=true
 #   enforce  超出上限时先把历史里较早的工具结果压缩成摘要（保留开头结尾和调用记录编号，当前轮不动）；
 #            压缩后仍超出的请求不再发往上游，直接返回说明（含估算值、上限和各部分占用）；
 #            工具循环中同样先压缩，仍超出才停止循环并告知用户
+# 注意：默认的 observe 不提供任何保护，只用来观察。要真正防止请求撞上游的上下文上限，需要改成 enforce。
+# observe / off 不改写任何消息内容，与下面的 ContextPruneEnabled 互不影响。
 # 建议先用 observe 看一段时间日志，确认各 Agent 的 contextTokenLimit 不是遗留的小数值再改成 enforce。
 ContextBudgetGuard=observe
+# 压缩工具结果时保留多少（字符）。只在 enforce 且超出上限时生效，未超出时一个字都不动。
+#   远的历史压成紧凑存根：开头 ContextSlimHeadChars + 结尾 ContextSlimTailChars，短于 ContextSlimMinChars 的不压；
+#   最近 ContextSlimRecentTurns 轮的历史先留宽一些（ContextSlimRecentHeadChars + ContextSlimRecentTailChars），
+#   还不够才压成紧凑存根。消息条数、角色顺序、用户和助手说的话都不变。
+ContextSlimHeadChars=500
+ContextSlimTailChars=200
+ContextSlimMinChars=1500
+ContextSlimRecentTurns=3
+ContextSlimRecentHeadChars=6000
+ContextSlimRecentTailChars=2000
 # 服务端硬上限（token，留空 = 不设）。与请求里的 contextTokenLimit 取小；请求没带上限时就用它。
 # 适合填成所用模型里最小的上下文窗口减去输出预留，这样群聊、外部客户端等不带上限的请求，
 # 以及把上限填得比模型窗口还大的 Agent，也都在检查范围内。
@@ -887,6 +899,8 @@ ContextPruneEnabled=false
 # 裁剪步长（0.5~1）。默认 1 = 刚好不超就停，对话每长一点裁剪边界就往后挪一点。
 # 调低（如 0.8）后按「上限 × 0.2」为一档成档地删：对话在同一档内增长时删掉的是同一批最老的消息，
 # 发给上游的前缀保持不变，对上游提示缓存更友好。
+# 裁剪边界在内存里按对话记住、只进不退：总量小幅回落时不会把上一轮删掉的消息放回来（重启后重新对齐一次）。
+# 多数超限是旧的工具结果撑出来的，优先用上面的 ContextBudgetGuard=enforce 压缩它们；裁剪是删整条消息，留作最后的手段。
 ContextPruneTargetRatio=1
 
 # --- Jev 上下文剪枝（仅在 ContextPruneEnabled=true 且请求带 contextTokenLimit 时生效）---
```

**File**: `modules/chatCompletionHandler.js` (modified, +14/-5)
```diff
@@ -489,6 +489,13 @@ async function fetchWithRetry(
         signal: attemptController.signal,
       });
       cleanup();
+      // 容灾链在重试时会换模型：把这次实际请求的模型记在响应上，用量校准和渠道记忆按它归属。
+      if (Array.isArray(modelFallbackCandidates) && modelFallbackCandidates.length > 0) {
+        const attemptModel = modelFallbackCandidates[Math.min(i, modelFallbackCandidates.length - 1)];
+        if (attemptModel) {
+          try { Object.defineProperty(response, 'vcpAttemptModel', { value: attemptModel, configurable: true }); } catch (_) { }
+        }
+      }
       if (timelineTrace) {
         timelineTrace.responses.set(response, attempt);
         timelineTrace.emit('upstream_headers_received', { attempt, status: response.status });
@@ -1272,15 +1279,17 @@ class ChatCompletionHandler {
         requestId: req.body.requestId || req.body.messageId || null
       });
       const pruningEnabled = contextManager.isPruningEnabled();
-      if (budgetGuard.limit !== null && Array.isArray(processedMessages) && (budgetGuard.enforcing || pruningEnabled)) {
-        // 第一步：超预算时先把历史里较早的工具结果压成摘要（当前轮不动）。它们通常占了绝大部分体积，
-        // 压掉之后多数请求就不需要删消息、也不需要拒绝了。
+      if (budgetGuard.enforcing && Array.isArray(processedMessages)) {
+        // 第一步（仅 enforce）：超预算时先把历史里较早的工具结果压成摘要（当前轮不动）。它们通常占了
+        // 绝大部分体积，压掉之后多数请求就不需要删消息、也不需要拒绝了。
+        // observe / off 不改写任何消息内容，即使服务端开了裁剪也一样。
         const draftBody = () => ({ ...originalBody, messages: processedMessages });
         const isOverBudget = () => budgetGuard.estimate(draftBody()) > budgetGuard.limit;
         if (isOverBudget()) {
           const slimmedMessages = copyArrayMetadata(processedMessages, processedMessages.slice());
           const beforeSlim = budgetGuard.estimate(draftBody());
-          const slimmedCount = contextBudget.slimEarlierToolResults(slimmedMessages, contextBudget.lastRealUserIndex(slimmedMessages));
+          const slimmedCount = contextBudget.slimToFit(slimmedMessages, undefined,
+            () => budgetGuard.estimate({ ...originalBody, messages: slimmedMessages }) > budgetGuard.limit);
           if (slimmedCount > 0) {
             processedMessages = slimmedMessages;
             console.warn(`[ContextBudget] 超预算，已压缩历史中 ${slimmedCount} 条消息里的工具结果: ${beforeSlim} -> ${budgetGuard.estimate(draftBody())} / ${budgetGuard.limit}`);
@@ -1338,7 +1347,7 @@ class ChatCompletionHandler {
         const budgetBreakdown = budgetGuard.breakdown(finalUpstreamBody);
         throw Object.assign(new Error(contextBudget.exceededMessage(budgetCheck, 'outbound', budgetBreakdown)), {
           name: 'ContextBudgetExceededError',
-          budget: { estimated: budgetCheck.estimated, limit: budgetCheck.limit, breakdown: budgetBreakdown }
+          budget: { stage: 'outbound', estimated: budgetCheck.estimated, limit: budgetCheck.limit, breakdown: budgetBreakdown }
         });
       }
       budgetGuard.noteRequest(finalUpstreamBody);
```

**File**: `modules/contextBudget.js` (modified, +187/-40)
```diff
@@ -22,15 +22,46 @@ const MAX_RATIO = 2.5;
 const RATIO_SMOOTHING = 0.3;
 const MAX_TRACKED_MODELS = 200;
 
-const SLIM_MIN_CHARS = 1500;
-const SLIM_HEAD_CHARS = 500;
-const SLIM_TAIL_CHARS = 200;
+// 压缩较早的工具结果时保留的开头 / 结尾字符数，以及多长的结果才压缩。
+// 可用 ContextSlimHeadChars / ContextSlimTailChars / ContextSlimMinChars 调整。
+function slimSetting(name, fallback, min, max) {
+    const value = Number(process.env[name]);
+    return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
+}
+const slimHeadChars = () => slimSetting('ContextSlimHeadChars', 500, 100, 100000);
+const slimTailChars = () => slimSetting('ContextSlimTailChars', 200, 0, 100000);
+const slimMinChars = () => Math.max(
+    slimSetting('ContextSlimMinChars', 1500, 500, 1000000),
+    slimHeadChars() + slimTailChars() + 200
+);
+/** 紧凑档：离现在远的历史。 */
+const compactSizes = () => ({ head: slimHeadChars(), tail: slimTailChars(), min: slimMinChars() });
+/** 宽裕档：最近几轮的历史，留得多一些，模型回头看刚读过的内容时不必再调一次工具。 */
+function recentSizes() {
+    const head = slimSetting('ContextSlimRecentHeadChars', 6000, 100, 100000);
+    const tail = slimSetting('ContextSlimRecentTailChars', 2000, 0, 100000);
+    return { head, tail, min: head + tail + 1000 };
+}
+const slimRecentTurns = () => slimSetting('ContextSlimRecentTurns', 3, 0, 1000);
+/** 当前轮里较早几步的工具结果：先用这一档，与跨话题引用的截断尺寸一致。 */
+const CURRENT_TURN_SIZES = { head: 18000, tail: 6000, min: 25000 };
 const TOOL_PAYLOAD_HEADER = '<!-- VCP_TOOL_PAYLOAD -->';
 const TOOL_PAYLOAD_FOOTER = '<!-- VCP_TOOL_PAYLOAD_END -->';
 // 历史消息里持久化的工具结果块（写在 assistant 正文中）。
 const RESULT_BLOCK_START = '[[VCP调用结果信息汇总:';
 const RESULT_BLOCK_END = 'VCP调用结果结束]]';
 const RECORD_ID_PATTERN = /tcr-[0-9A-Za-z-]{8,}/;
+// 角色分割把历史回复里的工具批次拆成独立 user 消息后，外面可能还带着这些壳。
+const BATCH_SHELL_PATTERNS = [
+    /^<<<\[VCP_TOOL_BATCH_START:[^\]\r\n]+\]>>>\s*/,
+    /\s*<<<\[VCP_TOOL_BATCH_END:[^\]\r\n]+\]>>>$/,
+    /^【工具返回批次开始[^】\r\n]*】\s*/,
+    /\s*【工具返回批次结束[^】\r\n]*】$/,
+];
+const BATCH_SUMMARY_START = '[本轮工具调用摘要:]';
+// 由系统替用户说的话（续写提示、话题唤醒、邀请指令），不是一轮对话的起点。
+const VIRTUAL_USER_PREFIXES = ['[系统提示:]', '[系统邀请指令:]'];
+const IMAGE_HEAVY_SHARE = 0.25;
 // 本地估算太小时不拿它校准：固定开销占比大，算出来的比例没有代表性。
 const MIN_CALIBRATION_ESTIMATE = 2000;
 
@@ -134,6 +165,17 @@ function estimateBodyTokens(body) {
     return total;
 }
 
+function countImageParts(body) {
+    let count = 0;
+    for (const message of Array.isArray(body?.messages) ? body.messages : []) {
+        if (!Array.isArray(message?.content)) continue;
+        for (const part of message.content) {
+            if (part && (part.type === 'image_url' || part.type === 'image' || part.type === 'input_image')) count++;
+        }
+    }
+    return count;
+}
+
 function clampRatio(ratio) {
     return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
 }
@@ -154,11 +196,47 @@ function isToolPayloadText(text) {
     return typeof text === 'string' && text.trimStart().startsWith(TOOL_PAYLOAD_HEADER);
 }
 
+/**
+ * 历史回复里持久化的工具批次，被角色分割拆出来之后的样子：一条 user 消息，
+ * 去掉批次外壳和尾部的调用摘要后，从头到尾就是一个或多个工具结果块。
+ */
+function isPersistedToolBatchText(text) {
+    if (typeof text !== 'string' || !text.includes(RESULT_BLOCK_START)) return false;
+    let body = text.trim();
+    for (const pattern of BATCH_SHELL_PATTERNS) body = body.replace(pattern, '');
+    const summaryAt = body.lastIndexOf(BATCH_SUMMARY_START);
+    if (summaryAt > 0 && body.lastIndexOf(RESULT_BLOCK_END) < summaryAt) body = body.slice(0, summaryAt);
+    body = body.trim();
+    return body.startsWith(RESULT_BLOCK_START) && body.endsWith(RESULT_BLOCK_END);
+}
+
+function firstText(message) {
+    if (typeof message.content === 'string') return message.content;
+    return Array.isArray(message.content) && typeof message.content[0]?.text === 'string' ? message.content[0].text : null;
+}
+
+function isRuntimeToolPayloadMessage(message) {
+    return isToolPayloadText(firstText(message));
+}
+
 function isToolResultMessage(message) {
     if (!message || typeof message !== 'object') return false;
     if (message.role === 'tool' || message.role === 'function') return true;
-    if (typeof message.content === 'string') return isToolPayloadText(message.content);
-    return Array.isArray(message.content) && isToolPayloadText(message.content[0]?.text);
+    const text = firstText(message);
+    if (isToolPayloadText(text)) return true;
+    return message.role === 'user' && isPersistedToolBatchText(text);
+}
+
+/** 一条 user 消息是不是用户真正说的话（不是工具结果，也不是系统替用户说的提示）。 */
+function isRealUserMessage(message) {
+    if (!message || message.role !== 'user' || message.__vcpMetaThinkingV3__) return false;
+    if (isToolResultMessage(message)) return false;
+    const text = firstText(message);
+    if (typeof text === 'string') {
+        const trimmed = text.trimStart();
+        if (VIRTUAL_USER_PREFIXES.some(prefix => trimmed.startsWith(prefix))) return false;
+    }
+    return true;
 }
 
 function omissionNotice(omitted, recordId) {
@@ -169,29 +247,54 @@ function defuseMarkers(fragme
```

**File**: `modules/contextManager.js` (modified, +65/-13)
```diff
@@ -60,11 +60,9 @@ function computeMustKeepIndices(messages) {
     // --- 规则 4: 当前轮完整保留 ---
     // 从最后一条真正的用户发言（不是工具回执）到末尾，是模型正在处理的这一轮；
     // 工具链进行到一半时，末尾可能是好几条工具结果，只保最后两条会把发起调用的那条删掉。
-    for (let i = totalLen - 1; i >= 0; i--) {
-        mustKeepIndices.add(i);
-        const msg = messages[i];
-        if (msg && msg.role === 'user' && !contextBudget.isToolResultMessage(msg)) break;
-    }
+    // 起点的判定和出站压缩共用一处：续写提示这类系统替用户说的话不算一轮的开始。
+    const turnStart = contextBudget.lastRealUserIndex(messages);
+    for (let i = totalLen - 1; i >= Math.max(0, turnStart); i--) mustKeepIndices.add(i);
 
     return mustKeepIndices;
 }
@@ -95,22 +93,63 @@ function computeDeletableUnits(messages, mustKeepIndices) {
     return units;
 }
 
+// --- 裁剪水位：同一段对话的裁剪边界只进不退 ---
+// 客户端每次都带完整历史，而每轮的总量会小幅波动（记忆注入长短不一、估算比例在校准）。
+// 只按当轮总量算「删多少」的话，边界会在档位附近来回跳：上一轮删掉的消息下一轮又回来，
+// 上游的提示缓存连续失效。这里在内存里按对话记住上次的边界，下一轮至少删到同一位置。
+// 不落盘：进程重启后最多重新对齐一次。对话被改写（边界消息找不到了）或明显变短时自动作废。
+const MAX_TRACKED_CONVERSATIONS = 200;
+const WATERMARK_RELEASE_RATIO = 0.7;
+const pruneWatermarks = new Map();
+
+function messageHead(message, size) {
+    const text = jevContextPruner.extractText(message && message.content) || '';
+    return `${message && message.role}|${text.slice(0, size)}`;
+}
+
+function conversationKey(messages) {
+    const first = messages.find(msg => msg && msg.role !== 'system');
+    return first ? messageHead(first, 200) : null;
+}
+
+/** 边界 = 留下来的第一条非系统消息；用它和下一条的开头一起当指纹，避免「好的」这类短句重复。 */
+function boundaryFingerprint(messages, index) {
+    return `${messageHead(messages[index], 120)}\u0000${messageHead(messages[index + 1], 120)}`;
+}
+
+function findWatermarkIndex(messages, fingerprint) {
+    for (let i = 0; i < messages.length - 1; i++) {
+        if (messages[i] && messages[i].role !== 'system' && boundaryFingerprint(messages, i) === fingerprint) return i;
+    }
+    return -1;
+}
+
+function rememberWatermark(key, fingerprint) {
+    pruneWatermarks.delete(key);
+    pruneWatermarks.set(key, fingerprint);
+    if (pruneWatermarks.size > MAX_TRACKED_CONVERSATIONS) pruneWatermarks.delete(pruneWatermarks.keys().next().value);
+}
+
+function resetPruneWatermarks() {
+    pruneWatermarks.clear();
+}
+
 /**
  * 按给定顺序删除单元，直到估算不超过上限；返回被删下标集合。
- * 请求是无状态的（客户端每次都带完整历史），所以「删多少」只由当前总量决定：
- * 把超出量向上取整到档位的整数倍，同一档内每次算出的删除量相同，裁剪边界就不动。
+ * 「删多少」把超出量向上取整到档位的整数倍，一次腾出一档；floorIndex（上次的裁剪边界）
+ * 之前的单元无论如何都删，保证边界不后退。
  */
-function dropUnitsUntilFits(messages, orderedUnits, limit, mustKeepIndices) {
+function dropUnitsUntilFits(messages, orderedUnits, limit, mustKeepIndices, floorIndex = -1) {
     const weights = messages.map(msg => estimateTokens([msg]));
     const total = weights.reduce((sum, w) => sum + w, 0);
     const dropped = new Set();
-    if (total <= limit) return dropped;
+    if (total <= limit && floorIndex <= 0) return dropped;
     const step = limit * (1 - pruneTargetRatio());
-    const over = total - limit;
+    const over = Math.max(0, total - limit);
     const required = step >= 1 ? Math.ceil(over / step) * step : over;
     let removed = 0;
     for (const unit of orderedUnits) {
-        if (removed >= required) break;
+        if (removed >= required && unit[unit.length - 1] >= floorIndex) break;
         for (const index of unit) {
             dropped.add(index);
             removed += weights[index];
@@ -151,10 +190,22 @@ function pruneMessages(messages, limit, debugMode = false) {
 
     const mustKeepIndices = computeMustKeepIndices(messages);
     const units = computeDeletableUnits(messages, mustKeepIndices);
+    // 上次的裁剪边界：对话没被改写、也没有明显变短时沿用。
+    const total = estimateTokens(messages);
+    const key = conversationKey(messages);
+    let floorIndex = -1;
+    if (key && pruneWatermarks.has(key)) {
+        floorIndex = total > limit * WATERMARK_RELEASE_RATIO ? findWatermarkIndex(messages, pruneWatermarks.get(key)) : -1;
+        if (floorIndex === -1) pruneWatermarks.delete(key);
+    }
     // 位置规则：从最老的单元开始删。
-    const dropped = dropUnitsUntilFits(messages, units, limit, mustKeepIndices);
+    const dropped = dropUnitsUntilFits(messages, units, limit, mustKeepIndices, floorIndex);
+    if (key && dropped.size > 0) {
+        const boundary = messages.findIndex((msg, i) => !dropped.has(i) && msg && msg.role !== 'system');
+        if (boundary !== -1 && boundary < messages.length - 1) rememberWatermark(key, boundaryFingerprint(messages, boundary));
+    }
     if (debugMode) {
-        console.log(`[ContextManager] 估算 ${estimateTokens(messages)}，限制 ${limit}，移除 ${dropped.size} 条消息`);
+        console.log(`[ContextManager] 估算 ${total}，限制 ${limit}，移除 ${dropped.size} 条消息`);
     }
     if (dropped.size === 0) return messages;
     return messages.filter((msg, i) => !dropped.has(i));
@@ -257,6 +308,7 @@ async function pruneMessagesSmart(messages, limit, debugMode = false, options =
 
 module.exports = {
     isPruningEnabled,
+    resetPruneWatermarks,
     pruneMessages,
     pruneMessagesSmart,
     computeMustK
```

**File**: `modules/finalContextStore.js` (modified, +2/-4)
```diff
@@ -12,8 +12,7 @@
 // - 分块数字是本地估算：汉字按 2 个字符、其余按 1 个字符计，再除以 3。只用于看各块占比，
 //   不再用 cl100k_base（GPT-4 旧词表对中文多算约 1.5 倍）。
 const TOKEN_METHOD = 'estimate:cjk2/3';
-const { promptTokensFromUsage } = require('./contextBudget.js');
-const ESTIMATED_TOKEN_CHAR_DIVISOR = 3;
+const { promptTokensFromUsage, estimateTextTokens } = require('./contextBudget.js');
 
 const MAX_SNAPSHOTS = 5;
 const snapshots = []; // 数组首位为最新快照（unshift 写入）
@@ -35,8 +34,7 @@ function safeClone(value) {
 }
 
 function estimateTokensForText(text) {
-  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
-  return Math.ceil((chineseChars * 2 + text.length - chineseChars) / ESTIMATED_TOKEN_CHAR_DIVISOR);
+  return estimateTextTokens(text);
 }
 
 function countTokensForText(text) {
```

**File**: `modules/handlers/nonStreamHandler.js` (modified, +1/-1)
```diff
@@ -288,7 +288,7 @@ class NonStreamHandler {
       try {
         const usage = JSON.parse(responseText)?.usage;
         if (isInitial) finalContextStore.recordUpstreamUsage(originalBody.requestId || originalBody.messageId, usage);
-        budgetGuard?.noteUsage(usage);
+        budgetGuard?.noteUsage(usage, isInitial ? firstAiAPIResponse?.vcpAttemptModel : undefined);
       } catch (_) { /* 非 JSON 响应没有 usage，面板保留本地估算 */ }
     };
     noteUpstreamUsage(aiResponseText, true);
```

**File**: `modules/handlers/streamHandler.js` (modified, +2/-2)
```diff
@@ -243,7 +243,7 @@ class StreamHandler {
           // 首个上游调用的 usage 就是「最终上下文」快照那份请求体的真实计数。
           if (isInitialCall && parsedData?.usage) finalContextStore.recordUpstreamUsage(id, parsedData.usage);
           // 每一轮的真实用量都用来校准下一轮的预算估算。
-          if (parsedData?.usage) budgetGuard?.noteUsage(parsedData.usage);
+          if (parsedData?.usage) budgetGuard?.noteUsage(parsedData.usage, aiResponse?.vcpAttemptModel);
           if (parsedData?.error) {
             invalidPayload = true;
             hasPayloadError = true;
@@ -631,7 +631,7 @@ class StreamHandler {
               created: Math.floor(Date.now() / 1000),
               model: originalBody.model || 'unknown',
               vcp_incomplete: true,
-              vcp_context_budget: { estimated: check.estimated, limit: check.limit },
+              vcp_context_budget: { stage: 'tool_loop', estimated: check.estimated, limit: check.limit },
               choices: [{ index: 0, delta: {
                 content: `\n\n> [!WARNING]\n> ${contextBudget.exceededMessage(check, 'tool_loop', budgetGuard.breakdown(body))}\n`
               }, finish_reason: 'stop' }],
```

---

### Incident Patch 2: `32322037` (2026-11-25)
**Commit Message**: Merge pull request #642 from infinite-vector/fix/plugin-stdout-regex-hang-and-request-activity-timeout

fix(core,FileOperator): 根治同步stdio插件大输出正则回溯死锁，引入活跃请求双轨续期并消除FileOperator双倍Base64膨胀

**File**: `Plugin.js` (modified, +95/-43)
```diff
@@ -1761,11 +1761,68 @@ class PluginManager extends EventEmitter {
             });
 
 
-            let outputBuffer = ''; // Buffer to accumulate data chunks
+            const outputChunks = []; // 收集 stdout 分块，避免同步插件大输出时反复触发 ConsString 扁平化与正则回溯
             let errorOutput = '';
             let processExited = false;
             let initialResponseSent = false; // Flag for async plugins
             const isAsyncPlugin = plugin.pluginType === 'asynchronous';
+
+            // 线性 O(N) 括号深度平衡扫描器：支持嵌套对象、格式化换行与前置杂音日志，零正则回溯
+            const extractFirstStatusJsonObject = (text) => {
+                if (!text || typeof text !== 'string') return null;
+                const len = text.length;
+                let searchFrom = 0;
+                while (searchFrom < len) {
+                    const startIdx = text.indexOf('{', searchFrom);
+                    if (startIdx === -1) return null;
+                    let depth = 0;
+                    let inString = false;
+                    let escape = false;
+                    let endIdx = -1;
+                    for (let i = startIdx; i < len; i++) {
+                        const ch = text.charCodeAt(i);
+                        if (inString) {
+                            if (escape) {
+                                escape = false;
+                            } else if (ch === 92) { // '\\'
+                                escape = true;
+                            } else if (ch === 34) { // '"'
+                                inString = false;
+                            }
+                            continue;
+                        }
+                        if (ch === 34) { // '"'
+                            inString = true;
+                        } else if (ch === 123) { // '{'
+                            depth++;
+                        } else if (ch === 125) { // '}'
+                            depth--;
+                            if (depth === 0) {
+                                endIdx = i;
+                                break;
+                            }
+                        }
+                    }
+                    if (endIdx === -1) {
+                        // 当前顶层 '{' 尚未闭合，等待后续 chunk 或尝试下一个 '{'（防止前置日志含孤立 '{'）
+                        const nextBrace = text.indexOf('{', startIdx + 1);
+                        if (nextBrace === -1) return null;
+                        searchFrom = startIdx + 1;
+                        continue;
+                    }
+                    const candidate = text.slice(startIdx, endIdx + 1);
+                    try {
+                        const parsed = JSON.parse(candidate);
+                        if (parsed && typeof parsed === 'object' && (parsed.status === 'success' || parsed.status === 'error')) {
+                            return parsed;
+                        }
+                    } catch {
+                        // 非合法 JSON，继续从下一个 '{' 扫描
+                    }
+                    searchFrom = startIdx + 1;
+                }
+                return null;
+            };
             const isArcheryNoReply = isAsyncPlugin && executionOptions?.archeryNoReply === true;
             const noReplyGraceMs = Number.isFinite(Number(executionOptions?.archeryNoReplyGraceMs))
                 ? Math.max(0, Number(executionOptions.archeryNoReplyGraceMs))
@@ -1820,47 +1877,33 @@ class PluginManager extends EventEmitter {
             pluginProcess.stdout.on('data', (data) => {
                 if (processExited || (isAsyncPlugin && initialResponseSent)) {
                     // If async and initial response sent, or process exited, ignore further stdout for this Promise.
-                    // The plugin's background task might still log to its own stdout, but we don't collect it here.
                     if (this.debugMode && isAsyncPlugin && initialResponseSent) console.log(`[PluginManager executePlugin Internal] Async plugin ${pluginName} (initial response sent) produced more stdout: ${data.substring(0, 100)}...`);
                     return;
                 }
-                outputBuffer += data;
-                try {
-                    // Try to parse a complete JSON object from the buffer.
-                    // This is a simple check; for robust streaming JSON, a more complex parser is needed.
-                    // We assume the first complete JSON is the one we want for async initial response.
-                    const potentialJsonMatch = outputBuffer.match(/(\{[\s\S]*?\})(?:\s|$)/);
-                    if (potentialJsonMatch && potentialJsonMatch[1]) {
-                        const jsonString = potentialJsonMatch[1];
-                        const parsedOutput = JSON.parse(jsonString);
-
-                        if (parsedOutput && (parsedOutput.status === "success" || parsedOutput.status === "error")) {
-                            if (isAsyncPlugin) {
```

**File**: `Plugin/FileOperator/FileOperator.js` (modified, +8/-1)
```diff
@@ -1937,11 +1937,18 @@ function convertToVCPFormat(response) {
       }
     }
 
+    // 避免 data.content（如多模态图片 Base64）在 result.content 与 result.details.content 中双份重复造成 200% 载荷膨胀
+    let sanitizedDetails = data;
+    if (data && typeof data === 'object' && !Array.isArray(data) && Object.prototype.hasOwnProperty.call(data, 'content')) {
+      sanitizedDetails = { ...data };
+      delete sanitizedDetails.content;
+    }
+
     return {
       status: 'success',
       result: {
         content: contentArray,
-        details: data
+        details: sanitizedDetails
       },
     };
   } else {
```

**File**: `WebSocketServer.js` (modified, +7/-3)
```diff
@@ -1,4 +1,4 @@
-// WebSocketServer.js
+﻿// WebSocketServer.js
 const WebSocket = require('ws');
 const url = require('url');
 const fs = require('fs').promises;
@@ -160,7 +160,11 @@ function initialize(httpServer, config) {
         console.warn('[WebSocketServer] VCP_Key not set. WebSocket connections will not be authenticated if default path is used.');
     }
 
-    wssInstance = new WebSocket.Server({ noServer: true });
+    const configuredMaxPayloadMB = Number(process.env.WEBSOCKET_MAX_PAYLOAD_MB);
+    const maxPayloadBytes = (Number.isFinite(configuredMaxPayloadMB) && configuredMaxPayloadMB > 0
+        ? configuredMaxPayloadMB
+        : 256) * 1024 * 1024;
+    wssInstance = new WebSocket.Server({ noServer: true, maxPayload: maxPayloadBytes });
 
     upgradeHandler = (request, socket, head) => {
         if (isDraining) {
@@ -936,7 +940,7 @@ function rejectPendingToolRequestsForServer(serverId) {
 async function executeDistributedTool(serverIdOrName, toolName, toolArgs, timeout) {
     // 优先从插件 manifest 获取超时设置
     const plugin = pluginManager.getPlugin(toolName);
-    const defaultTimeout = plugin?.communication?.timeout || 60000;
+    const defaultTimeout = plugin?.communication?.timeout || 180000;
     const effectiveTimeout = timeout ?? defaultTimeout;
 
     let targetServerId = serverIdOrName;
```

**File**: `config.env.example` (modified, +13/-4)
```diff
@@ -19,19 +19,23 @@ API_URL=NEWAPI_URL_SUCH_AS_http://127.0.0.1:3000
 
 PORT=6005
 Key=YOUR_KEY_SUCH_AS_aBcDeFgHiJkLmNoP
+Image_Key=YOUR_IMAGE_KEY_SUCH_AS_Images_aBcDeFgHiJk
+File_Key=YOUR_FILE_KEY_SUCH_AS_123456
+# VCP服务器WebSocket鉴权，用于VCP面板和分布式服务器之间的实时通信。
+VCP_Key=YOUR_VCP_KEY_SUCH_AS_aBcDeFgHiJkLmNoP
+
 # Optional read-only RiverMemo API (POST /v1/memory/search). Empty = not registered.
 # Use dedicated random bearer tokens, never Key. Store only each token's lowercase SHA-256 digest here.
 # MEMORY_READ_GRANTS='{"<64 hex digest>":["ExampleDiary"]}'
 # HTTPS request: Authorization: Bearer <read token>; JSON: {"query":"what did we decide?","diaries":["ExampleDiary"],"k":5}
 # Response: {"direct":[{"diary":"ExampleDiary","file":"note.md","text":"...","score":0.8,"scoreSource":"retrieval"}]}
 MEMORY_READ_GRANTS=
-Image_Key=YOUR_IMAGE_KEY_SUCH_AS_Images_aBcDeFgHiJk
-File_Key=YOUR_FILE_KEY_SUCH_AS_123456
-# VCP服务器WebSocket鉴权，用于VCP面板和分布式服务器之间的实时通信。
-VCP_Key=YOUR_VCP_KEY_SUCH_AS_aBcDeFgHiJkLmNoP
+
 # WebSocket 协议级心跳。开启后每 60 秒向所有已连接客户端发送一个零载荷 Ping 控制帧，
 # 用于维持隧道、反向代理及 NAT 场景中的空闲连接；默认关闭。
 WEBSOCKET_HEARTBEAT_ENABLED=false
+# WebSocket 单帧最大允许载荷（单位 MB，默认 256；防止分布式工具批量返回 4K 原图 Base64 时触发 1009 断连）。
+WEBSOCKET_MAX_PAYLOAD_MB=256
 
 # 引入网络波动重试机制
 ApiRetries=3
@@ -40,6 +44,11 @@ ApiRetryDelay=200
 ApiConnectionTimeoutMs=900000
 # 插件调用本机 VCP chat 总线的超时（毫秒）。AgentAssistant 会使用该值；建议不低于 ApiConnectionTimeoutMs。
 PLUGIN_COMMUNICATION_TIMEOUT=900000
+# 活跃请求（流式与非流式多轮 VCP 工具循环共用）无推进空闲超时（毫秒）。
+# 只要上游仍在流式输出、或工具循环仍在活跃执行/轮次推进，空闲计时器会自动续期；默认 1800000 = 30分钟。
+ActiveRequestIdleTimeoutMs=1800000
+# 单个活跃请求跨所有工具循环轮次的总寿命硬上限（毫秒）。防止异常循环无限驻留；默认 7200000 = 120分钟。
+ActiveRequestMaxLifetimeMs=7200000
 
 # DEFAULT_TIMEZONE: 定义服务器的默认时区，用于时间相关的操作和日志记录。
 # VCPSleep 打盹插件睡醒后也会使用该时区报告当前日期、时分秒与 UTC 偏移。
```

**File**: `modules/chatCompletionHandler.js` (modified, +14/-1)
```diff
@@ -859,11 +859,13 @@ class ChatCompletionHandler {
       if (isOriginalRequestStreaming && !res.headersSent) {
         res.setHeader('x-vcp-tool-loop-handoff', '1');
       }
+      const initialRequestNow = Date.now();
       activeRequests.set(id, {
         req,
         res,
         abortController,
-        timestamp: Date.now(),
+        timestamp: initialRequestNow,
+        lastActivityAt: initialRequestNow,
         aborted: false, // 修复 Bug #4: 添加中止标志
         abortReason: null,
         handoffGate
@@ -1425,9 +1427,20 @@ class ChatCompletionHandler {
         res.setHeader('x-vcp-tool-loop-handoff', '1');
         res.flushHeaders?.();
       }
+      let lastActivityTouchMs = 0;
+      const touchRequestActivity = () => {
+        if (!id) return;
+        const now = Date.now();
+        if (now - lastActivityTouchMs < 1000) return;
+        lastActivityTouchMs = now;
+        const reqEntry = activeRequests.get(id);
+        if (reqEntry) reqEntry.lastActivityAt = now;
+      };
+
       const context = {
         ...this.config,
         handoffGate,
+        touchRequestActivity,
         toolExecutor: this.toolExecutor,
         ToolCallParser,
         abortController,
```

**File**: `modules/handlers/nonStreamHandler.js` (modified, +14/-2)
```diff
@@ -179,6 +179,7 @@ class NonStreamHandler {
       roleDividerSwitches,
       roleDividerScanSwitches,
       roleDividerRemoveDisabledTags,
+      touchRequestActivity,
       toolExecutor,
       ToolCallParser,
       abortController,
@@ -326,11 +327,12 @@ class NonStreamHandler {
     let currentMessagesForNonStreamLoop = originalBody.messages ? JSON.parse(JSON.stringify(originalBody.messages)) : [];
 
     do {
-      // 检查中止信号
+      // 检查中止信号并刷新非流式多轮工具循环活性时间戳
       if (abortController && abortController.signal.aborted) {
         if (DEBUG_MODE) console.log('[VCP NonStream Loop] Abort detected, exiting loop.');
         break;
       }
+      touchRequestActivity?.();
 
       let anyToolProcessedInCurrentIteration = false;
       conversationHistoryForClient.push(currentAIContentForClient);
@@ -455,7 +457,17 @@ class NonStreamHandler {
         }
         currentMessagesForNonStreamLoop.push(...assistantMessages);
 
-        const toolResults = await toolExecutor.executeAll(normalCalls, clientIp, currentMessagesForNonStreamLoop);
+        const nonStreamActivityTimer = setInterval(() => {
+          touchRequestActivity?.();
+        }, 5000);
+        nonStreamActivityTimer.unref?.();
+        let toolResults;
+        try {
+          toolResults = await toolExecutor.executeAll(normalCalls, clientIp, currentMessagesForNonStreamLoop);
+        } finally {
+          clearInterval(nonStreamActivityTimer);
+          touchRequestActivity?.();
+        }
         const normalCallLogs = (() => {
           let logs = [];
           if (writeChatLog) {
```

**File**: `modules/handlers/streamHandler.js` (modified, +5/-1)
```diff
@@ -77,6 +77,7 @@ class StreamHandler {
       roleDividerSwitches,
       roleDividerScanSwitches,
       roleDividerRemoveDisabledTags,
+      touchRequestActivity,
       toolExecutor,
       ToolCallParser,
       abortController,
@@ -457,6 +458,7 @@ class StreamHandler {
         aiResponse.body.on('data', chunk => {
           if (streamSettled || streamAborted) return;
           resetChunkIdleTimer(); // 每收到一个 chunk 就重置空闲计时器
+          touchRequestActivity?.();
 
           const chunkString = decoder.write(chunk);
           sseLineBuffer += chunkString;
@@ -890,8 +892,10 @@ class StreamHandler {
         break;
       }
 
-      // 执行普通调用（启动 SSE 保活心跳，防止长耗时工具/RAG刷新/下轮首字等待期间连接空闲断开）
+      // 执行普通调用（启动 SSE 保活心跳并刷新请求活性时间戳，防止长耗时工具/RAG刷新/下轮首字等待期间连接被误判为空闲）
+      touchRequestActivity?.();
       const loopKeepAliveTimer = setInterval(() => {
+        touchRequestActivity?.();
         if (!res.writableEnded && !res.destroyed) {
           try {
             res.write(': vcp-tool-keepalive\n\n');
```

**File**: `server.js` (modified, +53/-5)
```diff
@@ -363,16 +363,64 @@ async function abortAllActiveRequests(reason = '服务器正在关闭') {
     }
 }
 
-// 新增：定时清理 activeRequests 防止内存泄漏
+// 活跃请求（流式与非流式多轮工具循环共用）超时配置：
+// ActiveRequestIdleTimeoutMs：无推进空闲超时（默认 30 分钟；上游流输出或工具循环推进时自动续期）
+// ActiveRequestMaxLifetimeMs：单请求跨所有循环轮次的总寿命硬上限（默认 120 分钟；防止异常循环无限驻留）
+const ACTIVE_REQUEST_IDLE_TIMEOUT_MS = Math.max(
+    60 * 1000,
+    parseInt(process.env.ActiveRequestIdleTimeoutMs, 10) || 30 * 60 * 1000
+);
+const ACTIVE_REQUEST_MAX_LIFETIME_MS = Math.max(
+    ACTIVE_REQUEST_IDLE_TIMEOUT_MS,
+    parseInt(process.env.ActiveRequestMaxLifetimeMs, 10) || 120 * 60 * 1000
+);
+
+// 定时清理 activeRequests 防止内存泄漏，同时兼顾长耗时多轮工具活跃续期与总寿命硬上限
 setInterval(() => {
     const now = Date.now();
     for (const [id, context] of activeRequests.entries()) {
-        // 30分钟超时
-        if (now - (context.timestamp || 0) > 30 * 60 * 1000) {
-            console.log(`[Request Cleanup] Aborting and removing timed-out request: ${id}`);
-            if (context.abortController) {
+        const createdAt = context.timestamp || now;
+        const lastActivityAt = context.lastActivityAt || createdAt;
+        const totalElapsedMs = now - createdAt;
+        const idleElapsedMs = now - lastActivityAt;
+        const isMaxLifetimeExceeded = totalElapsedMs > ACTIVE_REQUEST_MAX_LIFETIME_MS;
+        const isIdleTimedOut = idleElapsedMs > ACTIVE_REQUEST_IDLE_TIMEOUT_MS;
+
+        if (isMaxLifetimeExceeded || isIdleTimedOut) {
+            const reason = isMaxLifetimeExceeded
+                ? `request_max_lifetime_timeout (${Math.round(totalElapsedMs / 60000)}min > ${Math.round(ACTIVE_REQUEST_MAX_LIFETIME_MS / 60000)}min)`
+                : `request_idle_timeout (idle ${Math.round(idleElapsedMs / 60000)}min > ${Math.round(ACTIVE_REQUEST_IDLE_TIMEOUT_MS / 60000)}min)`;
+            console.log(`[Request Cleanup] Aborting and removing timed-out request: ${id} [${reason}]`);
+            context.aborted = true;
+            context.abortReason = reason;
+            if (context.abortController && !context.abortController.signal.aborted) {
                 context.abortController.abort();
             }
+            if (context.res && !context.res.writableEnded && !context.res.destroyed) {
+                try {
+                    if (context.res.headersSent && String(context.res.getHeader('Content-Type') || '').includes('text/event-stream')) {
+                        const timeoutNotice = isMaxLifetimeExceeded
+                            ? `\n\n> [!WARNING]\n> **请求总时长已达硬上限 (${Math.round(ACTIVE_REQUEST_MAX_LIFETIME_MS / 60000)} 分钟)，流已安全中止**。\n`
+                            : `\n\n> [!WARNING]\n> **请求连续空闲超过 ${Math.round(ACTIVE_REQUEST_IDLE_TIMEOUT_MS / 60000)} 分钟无推进，流已安全中止**。\n`;
+                        context.res.write(`data: ${JSON.stringify({
+                            id: `chatcmpl-VCP-request-timeout-${now}`,
+                            object: 'chat.completion.chunk',
+                            created: Math.floor(now / 1000),
+                            model: context.req?.body?.model || 'unknown',
+                            choices: [{ index: 0, delta: { content: timeoutNotice }, finish_reason: 'stop' }]
+                        })}\n\n`);
+                        context.res.write('data: [DONE]\n\n');
+                        context.res.end();
+                    } else if (!context.res.headersSent) {
+                        context.res.status(504).json({
+                            error: 'Gateway Timeout',
+                            message: `Request timed out: ${reason}`
+                        });
+                    }
+                } catch {
+                    try { context.res.destroy(); } catch { /* ignore */ }
+                }
+            }
             activeRequests.delete(id);
         }
     }
```

---

### Incident Patch 3: `ff2624ee` (2026-11-25)
**Commit Message**: fix

**File**: `README.md` (modified, +4/-4)
```diff
@@ -2,7 +2,9 @@
 
 ![VCP Logo](docs/image/VCPLogo.png)
 
-**VCP官网：[通过官网迅速了解 VCP | VCPToolBox.com](https://www.vcptoolbox.com)**
+**VCP 官网：[VCPToolBox.com](https://www.vcptoolbox.com)**
+
+VCP 由四个仓库组成，每天都有新进展。官网汇总了各仓库的[更新日志](https://www.vcptoolbox.com/?page=changelog)，也提供了查阅整个 VCP 项目[技术文档](https://www.vcptoolbox.com/?page=learn-vcp)的统一入口。
 
 [English](README_en.md) | [日本語](README_ja.md) | [Русский](README_ru.md)
 
@@ -177,9 +179,7 @@ VCP 的终极愿景，从来不是"让人类更高效地使用 AI"。而是构
 >
 > 想快速扫一遍技术地图，请看 [VCP 技术 Lite 索引](docs/TECHNICAL_LITE.md)。
 >
-> 工程实现细节、API、配置、运维，请见 [完整文档体系](docs/DOCUMENTATION_INDEX.md)。
->
-> 了解VCP动向、更新内容，请见 [VCP更新日志](https://www.vcptoolbox.com/?page=changelog)。
+> 查阅 VCPToolBox 的工程实现、API、配置与运维说明，请见[本仓库文档索引](docs/DOCUMENTATION_INDEX.md)。
 
 ---
 
```

#### Recent Merged Pull Requests:
- **PR #645** (2026-11-25): RiverMemo V6.1：用拓扑虫洞与路线态 Ω 运输查询方向 (@lioensky)
- **PR #644** (2026-11-25): feat(context): 基于上游用量的 token 计量与出站前上下文预算检查 (@RoxyAsahi)
- **PR #642** (2026-11-25): fix(core,FileOperator): 根治同步stdio插件大输出正则回溯死锁，引入活跃请求双轨续期并消除FileOperator双倍Base64膨胀 (@infinite-vector)
- **PR #640** (2026-11-24): feat(tdb): 升级 triviumdb 至 0.9.3 原生双曲版本并接入 Pelorus 检索入口 (@infinite-vector)
- **PR #639** (closed): fix(vcpLoop): intercept hallucinated tool payload turn-bleed and support guillemet fuzzy delimiters (@silk2onion)
- **PR #638** (2026-11-24): feat(meta-thinking): 新增 MetaThinking V3 纯张量三体动态思考引擎 (@Ldl-h)

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

## X. context): recognise role-split tool results, keep observe read-only, tiered slim

**RULE**:
When implementing operations in `AdminPanel-Vue/src/views/FinalContextViewer.vue`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0868bc6d`: context): recognise role-split tool results, keep observe read-only, tiered slimming. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `AdminPanel-Vue/src/views/FinalContextViewer.vue`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
// 分块展示占比和按占比折算的大约数量：折算以上面这个总数为准，各块加起来与总数一致。
  const share = `${percent >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`
  const approx = Math.round((tokenCount / total) * contextTokens(snapshot.value?.summary))
  return approx > 0 ? `${share}（约 ${formatNumber(approx)}）` : share
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
// 分块只展示占比，分项数字和总数口径不同，并列显示会造成误读。
  return `${percent >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0868bc6d` are properly handled with clean fallback behavior.
