> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source**: github ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Source Version**: `e2dc7bf0`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T15:16:11.192Z  
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
> **Harvest Timestamp**: 2026-10-25T15:16:11.186Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2403 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #548** (2026-10-25): **fix: archery 审核反馈优先回传改造**
  *Symptoms*: 人工审核拒绝时，用户在审核框填写的反馈必须回传给 AI；无反馈则保持静默。 本次改动把两个原始提交与其后续修复压缩为单一提交。  - Plugin.js：静默拒绝分支不再无条件返回 undefined。有用户反馈时走与普通拒绝 同构的抛错路径，让上游既有错误链产出 isError=true；无反馈时维持静默语义。 handleApprovalResponse 在 notifyAiOnReject=false 且带原因时，把 userFeedback 随 resolve 一并带出。修正注释中的 archey 拼写。 - toolExecutor._createErrorResult：剥掉真实调用链 catch 前缀「执行错误: 」后再 解析 JSON。原实现直接对 message 判断 startsWith('{')，因前缀污染恒为 false， 解析分支从未生效，AI 实际收到的是转义串噪声。可读文本拼接由字面量 \\n 改为 真实换行。 - toolExecutor.executeAll：finishRecord 的 success 由硬编码 true 改为取 processedResult.success，与 _processResult 的 innerFailed 判定保持一致， 插件显式返回 { success: false } 不再被记为成功。 - tests：新增 approvalFeedbackPassthrough 覆盖审核反馈透传与错误还原。 方法体抽取改用 acorn AST——原手写词法扫描无法处理模板字符串与转义序列， 且文件内含语法错误，自初始提交起从未实际执行过。

- **Issue #547** (2026-10-25): **fix(rust-vexus-lite): 稀疏排除有限补找、预算隔离与选项透传**
  *Symptoms*: 本次只新增一笔提交 [964c7974](https://github.com/CI-IISATO/VCPToolBox/commit/964c7974b7e192faf183d1ceaaf826def1f073d5)，修改 4 个文件；没有重新打包 #544，也没有提交预编译二进制。  [仅本次四文件补修的差异](https://github.com/CI-IISATO/VCPToolBox/compare/08b77c62427ecde030cf036bd3f9882778b46f05...964c7974b7e192faf183d1ceaaf826def1f073d5)。当前 main 回退后暂不含 #544，因此本 PR 的总 diff 会显示前置依赖；请以该提交链接审阅补修，在 #544 恢复并同步本 PR 基线后再合并，或只挑选这一笔补修提交。  修复 #544 评审指出的稀疏补充遗漏：先截取 512 条再排除 ID，会让第 513 条及后续可用记录失去补入机会。这里操作的是 Chunk ID；调用方需显式提供 annSearch.excludeIds。  比较口径：原始上游 c603f136 的 ANN 候选池没有原生 ID 排除。#544 新增排除谓词下推；本补修直接以 #544 源码提交 08b77c62 为父提交，只有下述四文件补修。性能探针还原的是 #544 后的稀疏规则（开发起点 9941cd82 在这四个文件上与 08b77c62 一致），不能作为整套方案相对最初上游的端到端收益。  补找规则：  - 保留每个文件候选最多追加 512 个未被 ID 排除的记录。没有 ID 排除时仍沿原正文查询，不启用深查。 - 有排除时先在同一查询中补找，最多额外查看 min(64, 排除集大小) 条。先检查 ID，再将未排除的正文解码成字符串和 JSON。 - 未补满且窗口未确认到达 EOF 时，才读取后备 ID 索引，再批量读取选中正文。后备跳过窗口已见 ID，并恢复选中 ID 的顺序。 - 后备每个文件候选最多读取 4,608 个 ID，整个查询共享 16,384 个 ID 的预算。预算耗尽后，后续文件仍执行基础窗口；候选池不会被清空，仍按原规则排序和重排。  调用链与预算隔离：  - KnowledgeBaseManager 的 executeExternalRerank、executeParallelRerank 转发 options.annSearch。显式提供选项时检查原生 index.query-options.v1 能力，旧模块明确返回重编译错误，避免静默忽略排除。 - 在同一读事务内，先从文件元数据核对日记作用域，再读取 Chunk；范围外文件不会消耗后备 ID 预算。 - 对输入前 255 个文件候选按规范化路径去重，保留最高归一化分及首次位置，避免重复路径反复消耗预算。原有事务与发布门禁保留。 - diagnostics.nativeRerank.sparseScan 分别报告文件元数据、窗口、ID 后备、批量正文、正文解码及重复候选计数，以及预算和 filesStoppedAtScanLimit。诊断可传到插件广播，但不会自动重试。  验证：  - 8 项实际 SQL 回归测试：513/514 后继、完整连续 ID 序列、100 个文件长度与排除模式组合、预算边界、全局预算耗尽后后续文件仍返回结果、反序与两处解码错误传播。 - 新增预算污染反例：4 个范围外文件

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

### Incident Patch 1: `aab375a1` (2026-10-25)
**Commit Message**: fix: archery 审核反馈优先回传改造

人工审核拒绝时，用户在审核框填写的反馈必须回传给 AI；无反馈则保持静默。
本次改动把两个原始提交与其后续修复压缩为单一提交。

- Plugin.js：静默拒绝分支不再无条件返回 undefined。有用户反馈时走与普通拒绝
  同构的抛错路径，让上游既有错误链产出 isError=true；无反馈时维持静默语义。
  handleApprovalResponse 在 notifyAiOnReject=false 且带原因时，把 userFeedback
  随 resolve 一并带出。修正注释中的 archey 拼写。
- toolExecutor._createErrorResult：剥掉真实调用链 catch 前缀「执行错误: 」后再
  解析 JSON。原实现直接对 message 判断 startsWith('{')，因前缀污染恒为 false，
  解析分支从未生效，AI 实际收到的是转义串噪声。可读文本拼接由字面量 \\n 改为
  真实换行。
- toolExecutor.executeAll：finishRecord 的 success 由硬编码 true 改为取
  processedResult.success，与 _processResult 的 innerFailed 判定保持一致，
  插件显式返回 { success: false } 不再被记为成功。
- tests：新增 approvalFeedbackPassthrough 覆盖审核反馈透传与错误还原。
  方法体抽取改用 acorn AST——原手写词法扫描无法处理模板字符串与转义序列，
  且文件内含语法错误，自初始提交起从未实际执行过。

**File**: `Plugin.js` (modified, +39/-8)
```diff
@@ -1399,23 +1399,46 @@ class PluginManager extends EventEmitter {
             try {
                 const approvalResult = await approvalPromise;
                 if (approvalResult && approvalResult.silentRejected === true) {
-                    if (this.debugMode) {
-                        console.log(`[PluginManager] Tool call for "${toolName}" (ID: ${requestId}) was rejected silently. Returning empty result to AI.`);
-                    }
+                    const userFeedback = typeof approvalResult.userFeedback === 'string'
+                        ? approvalResult.userFeedback.trim()
+                        : '';
                     const silentRejectionRecord = {
                         status: 'rejected',
                         success: false,
                         silentRejected: true,
                         error_type: 'approval_rejected',
                         rejected_by_user: true,
-                        message: `Tool call "${toolName}" was rejected silently by manual approval.`
+                        message: userFeedback
+                            ? `Tool call "${toolName}" was rejected by manual approval with user feedback.`
+                            : `Tool call "${toolName}" was rejected silently by manual approval.`,
+                        ...(userFeedback ? { user_feedback: userFeedback } : {})
                     };
                     toolCallRecordStore.finishRecord(managedToolCallRecord, {
                         success: false,
                         result: silentRejectionRecord,
                         error: silentRejectionRecord.message
                     });
-                    return undefined;
+
+                    // 无用户输入：archery 语义生效，静默吞掉回执，AI 完全无感。
+                    if (!userFeedback) {
+                        if (this.debugMode) {
+                            console.log(`[PluginManager] Tool call for "${toolName}" (ID: ${requestId}) was rejected silently. Returning empty result to AI.`);
+                        }
+                        return undefined;
+                    }
+
+                    // 有用户输入：优先传递用户反馈。
+                    // 走与普通拒绝完全同构的抛错路径，让上层既有错误链产出 isError=true，
+                    // archery 分支才能把内容写回对话而不是静默终止。
+                    if (this.debugMode) {
+                        console.log(`[PluginManager] Tool call for "${toolName}" (ID: ${requestId}) was rejected with user feedback; raising rejection to surface feedback to AI.`);
+                    }
+                    throw new Error(JSON.stringify({
+                        plugin_error: `Tool call "${toolName}" was REJECTED by manual approval. User feedback: ${userFeedback}`,
+                        error_type: 'approval_rejected',
+                        rejected_by_user: true,
+                        user_feedback: userFeedback
+                    }));
                 }
                 if (this.debugMode) console.log(`[PluginManager] Tool call for "${toolName}" (ID: ${requestId}) approved.`);
             } catch (error) {
@@ -1913,10 +1936,18 @@ class PluginManager extends EventEmitter {
                 }
                 approval.resolve();
             } else if (approval.notifyAiOnReject === false) {
-                if (this.debugMode && normalizedReason) {
-                    console.log(`[PluginManager] Silent manual rejection for ${requestId} included user note hidden from AI: ${normalizedReason.substring(0, 300)}`);
+                // 静默拒绝只屏蔽“无用户输入”的回执；用户在审核框中填写的反馈必须优先回传给 AI。
+                if (normalizedReason) {
+                    if (this.debugMode) {
+                        console.log(`[PluginManager] Silent manual rejection for ${requestId} carries user feedback to AI: ${normalizedReason.substring(0, 300)}`);
+                    }
+                    approval.resolve({ silentRejected: true, userFeedback: normalizedReason });
+                } else {
+                    if (this.debugMode) {
+                        console.log(`[PluginManager] Silent manual rejection for ${requestId} without user note; nothing returned to AI.`);
+                    }
+                    approval.resolve({ silentRejected: true });
                 }
-                approval.resolve({ silentRejected: true });
             } else {
                 const rejectionMessage = normalizedReason
                     ? `Manual approval was REJECTED by user. User reason: ${normalizedReason}`
```

**File**: `modules/vcpLoop/toolExecutor.js` (modified, +38/-4)
```diff
@@ -434,9 +434,12 @@ class ToolExecutor {
         toolCallRecordHandle: recordHandle
       });
       const processedResult = this._processResult(name, result);
+      // 与 _processResult 的 success 判定保持一致：
+      // 插件若显式返回 { success: false }，记录必须落为失败，不能硬编码成功。
       toolCallRecordStore.finishRecord(recordHandle, {
-        success: true,
-        result
+        success: processedResult.success,
+        result,
+        error: processedResult.error || null
       });
       return this._attachRecordIdToResult(processedResult, recordHandle);
     } catch (error) {
@@ -498,8 +501,13 @@ class ToolExecutor {
       }
     }
     
+    // 内层显式声明 success:false 时必须透传：审核带用户反馈的拒绝依赖该标志，
+    // 否则 archery 循环的 isError 判定会把反馈当作成功结果静默丢弃。
+    const innerFailed = !!(result && typeof result === 'object' && result.success === false);
+
     return {
-      success: true,
+      success: !innerFailed,
+      error: innerFailed ? (result.error || formatted.text) : undefined,
       content: formatted.content,
       raw: result
     };
@@ -534,10 +542,36 @@ class ToolExecutor {
 
   _createErrorResult(toolName, message) {
     this._broadcast(toolName, 'error', message);
+
+    // 上层抛出的业务错误通常是 JSON 字符串（plugin_error / error_type / user_feedback…）。
+    // 直接把转义串喂给 AI 会变成噪声，这里解出可读文本，并保留结构化原文到 raw。
+    //
+    // 注意：真实调用链里 ToolExecutor 的 catch 会给 error.message 套上 `执行错误: ` 前缀，
+    // 若直接对 message 做 startsWith('{') 判断将恒为 false，JSON 解析分支永不生效。
+    // 因此先剥掉已知的包装前缀，再对剩余部分尝试解析。
+    const rawMessage = typeof message === 'string' ? message : String(message);
+    const jsonCandidate = rawMessage.replace(/^执行错误:\s*/, '');
+    let displayText = rawMessage;
+    let parsedPayload = null;
+    if (jsonCandidate.trim().startsWith('{')) {
+      try {
+        parsedPayload = JSON.parse(jsonCandidate);
+        const readableParts = [];
+        if (parsedPayload.plugin_error) readableParts.push(parsedPayload.plugin_error);
+        if (parsedPayload.user_feedback && !String(parsedPayload.plugin_error || '').includes(parsedPayload.user_feedback)) {
+          readableParts.push('用户反馈: ' + parsedPayload.user_feedback);
+        }
+        if (readableParts.length > 0) displayText = readableParts.join('\n');
+      } catch (_parseError) {
+        // 不是合法 JSON，保持原字符串。
+      }
+    }
+
     return {
       success: false,
       error: message,
-      content: [{ type: 'text', text: `[错误] ${message}` }]
+      content: [{ type: 'text', text: `[错误] ${displayText}` }],
+      ...(parsedPayload ? { raw: parsedPayload } : {})
     };
   }
 
```

**File**: `tests/approvalFeedbackPassthrough.test.js` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+// tests/approvalFeedbackPassthrough.test.js
+// 覆盖需求：工具审核带 archery 时，用户填写的反馈必须优先回传给 AI；无反馈则保持静默。
+//
+// 说明：Plugin.js 顶层 require 会拉起 express / chokidar watcher，无法在测试进程内自由加载。
+// 因此这里用 acorn AST 从源码中定位方法体，在 vm 沙箱中以独立函数上下文编译执行——
+// 测的仍是磁盘上的真实实现，而非复制品。
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const vm = require('node:vm');
+const acorn = require('acorn');
+
+const PLUGIN_SOURCE = fs.readFileSync(
+    path.join(__dirname, '..', 'Plugin.js'),
+    'utf8'
+);
+const EXECUTOR_SOURCE = fs.readFileSync(
+    path.join(__dirname, '..', 'modules', 'vcpLoop', 'toolExecutor.js'),
+    'utf8'
+);
+
+const PLUGIN_AST = acorn.parse(PLUGIN_SOURCE, {
+    ecmaVersion: 'latest',
+    sourceType: 'script'
+});
+const EXECUTOR_AST = acorn.parse(EXECUTOR_SOURCE, {
+    ecmaVersion: 'latest',
+    sourceType: 'script'
+});
+
+// 按 AST 定位方法与函数体：手写词法扫描在模板字符串、转义引号、正则字面量上必然错位。
+function findFunctionNode(root, name) {
+    let found = null;
+    (function walk(node) {
+        if (!node || typeof node !== 'object' || found) return;
+        if (node.type === 'MethodDefinition' && node.key && node.key.name === name) {
+            found = node.value;
+            return;
+        }
+        if (node.type === 'FunctionDeclaration' && node.id && node.id.name === name) {
+            found = node;
+            return;
+        }
+        for (const key in node) {
+            if (key === 'loc' || key === 'start' || key === 'end') continue;
+            const value = node[key];
+            if (Array.isArray(value)) value.forEach(walk);
+            else if (value && typeof value === 'object') walk(value);
+        }
+    })(root);
+    return found;
+}
+
+function extractMethodBody(ast, source, methodName) {
+    const fn = findFunctionNode(ast, methodName);
+    assert.ok(fn && fn.body, `未在源码 AST 中找到 ${methodName}`);
+    return source.slice(fn.body.start + 1, fn.body.end - 1);
+}
+
+const HANDLE_APPROVAL_BODY = extractMethodBody(PLUGIN_AST, PLUGIN_SOURCE, 'handleApprovalResponse');
+const handleApprovalResponse = vm.runInNewContext(
+    `(function handleApprovalResponse(requestId, approved, reason) {${HANDLE_APPROVAL_BODY}})`,
+    { console, clearTimeout, setTimeout }
+);
+
+function makeContext(pending) {
+    return {
+        pendingApprovals: pending || new Map(),
+        webSocketServer: null,
+        debugMode: false
+    };
+}
+
+function makePendingEntry(notifyAiOnReject) {
+    let resolveFn;
+    const promise = new Promise(resolve => {
+        resolveFn = resolve;
+    });
+    const entry = {
+        resolve: resolveFn,
+        reject: error => { throw error; },
+        timeoutId: null,
+        notifyAiOnReject
+    };
+    return { entry, promise };
+}
+
+test('静默拒绝：用户填写反馈时，反馈随 resolve 一并带出', async () => {
+    const { entry, promise } = makePendingEntry(false);
+    const pending = new Map([['req-1', entry]]);
+    const ctx = makeContext(pending);
+
+    const handled = handleApprovalResponse.call(ctx, 'req-1', false, '  文件名写错了  ');
+    assert.equal(handled, true);
+    assert.equal(pending.has('req-1'), false);
+
+    const resolved = await promise;
+    assert.equal(resolved.silentRejected, true);
+    assert.equal(resolved.userFeedback, '文件名写错了');
+});
+
+test('静默拒绝：用户未填写反馈时，不携带 userFeedback', async () => {
+    const { entry, promise } = makePendingEntry(false);
+    const pending = new Map([['req-2', entry]]);
+    const ctx = makeContext(pending);
+
+    handleApprovalResponse.call(ctx, 'req-2', false, '   ');
+    const resolved = await promise;
+    assert.equal(resolved.silentRejected, true);
+    assert.equal(resolved.userFeedback, undefined);
+});
+
+test('非静默规则：拒绝时走 reject 并携带理由', () => {
+    const { entry } = makePendingEntry(true);
+    let captured = null;
+    entry.reject = error => {
+        captured = JSON.parse(error.message);
+    };
+    const pending = new Map([['req-3', entry]]);
+    const ctx = makeContext(pending);
+
+    assert.equal(handleApprovalResponse.call(ctx, 'req-3', false, '用户不同意'), true);
+    assert.ok(captured, '应触发 reject');
+    assert.equal(captured.error_type, 'approval_rejected');
+    assert.equal(captured.rejected_by_user, true);
+    assert.match(captured.plugin_error, /用户不同意/);
+});
+
+// toolExecutor.js 顶部 require 了 EmbeddingUtils 等重依赖，同样改为源码抽取编译。
+const PROCESS_RESULT_BODY = extractMethodBody(EXECUTOR_AST, EXECUTOR_SOURCE, '_processResult');
+const FORMAT_RESULT_BODY = extractMethodBody(EXECUTOR_AST, EXECUTOR_SOURCE, '_formatResult');
+const BROADCAST_BODY = extractMethodBody(EXECUTOR_AST, EXECUTOR_SOURCE, '_broadcast');
+
+function makeExecutorStub(webSocketServer) {
+    const stub = {
+        webSocketServer: webSocketServer || { broadcast: () => {} },
+        debugMode: false,
+        pluginManager: null
+    };
+    stub._formatResult = vm.runInNewContext(
+        `(function _formatResult(result) {${FORMAT_RESULT_BODY}})
```

---

### Incident Patch 2: `204641ca` (2026-10-25)
**Commit Message**: Merge pull request #547 from CI-IISATO/fix/rerank-sparse-exclusion-window

fix(rust-vexus-lite): 稀疏排除有限补找、预算隔离与选项透传

**File**: `KnowledgeBaseManager.js` (modified, +17/-1)
```diff
@@ -2622,6 +2622,13 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
         if (typeof runtime?.executeExternalRerank !== 'function') {
             throw new Error('NATIVE_PARALLEL_RERANK_ABI_UNAVAILABLE: rebuild rust-vexus-lite');
         }
+        if (options.annSearch !== undefined) {
+            const features = typeof runtime.capabilities === 'function'
+                ? runtime.capabilities()?.capabilities : [];
+            if (!Array.isArray(features) || !features.includes('index.query-options.v1')) {
+                throw new Error('NATIVE_ANN_SEARCH_OPTIONS_UNAVAILABLE: rebuild rust-vexus-lite');
+            }
+        }
         const diaryNames = [...new Set(
             (Array.isArray(options.diaryNames) ? options.diaryNames : [options.diaryNames])
                 .map(name => String(name || '').trim()).filter(Boolean)
@@ -2632,6 +2639,7 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
             externalOnly: true, diaryNames,
             queryText: String(query.text || ''),
             topK: options.topK, candidateK: options.candidateK,
+            annSearch: options.annSearch,
             externalK: options.externalK, useJev: options.useJev,
             jevPrompt: options.jevPrompt,
             fileCandidates: options.fileCandidates || [],
@@ -2649,6 +2657,13 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
         if (typeof runtime?.executeParallelRerank !== 'function') {
             throw new Error('NATIVE_PARALLEL_RERANK_ABI_UNAVAILABLE: rebuild rust-vexus-lite');
         }
+        if (options.annSearch !== undefined) {
+            const features = typeof runtime.capabilities === 'function'
+                ? runtime.capabilities()?.capabilities : [];
+            if (!Array.isArray(features) || !features.includes('index.query-options.v1')) {
+                throw new Error('NATIVE_ANN_SEARCH_OPTIONS_UNAVAILABLE: rebuild rust-vexus-lite');
+            }
+        }
         const diaryNames = [...new Set(
             (Array.isArray(options.diaryNames) ? options.diaryNames : [options.diaryNames])
                 .map(name => String(name || '').trim()).filter(Boolean)
@@ -2664,6 +2679,7 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
             riverConfig: this.riverMemoEngine._nativeConfig(prepared.artifact, options),
             queryText: String(query.text || ''), topK: options.topK,
             candidateK: options.candidateK, externalK: options.externalK,
+            annSearch: options.annSearch,
             alpha: options.alpha ?? 0.5, useJev: options.useJev,
             autoRrfAlpha: options.autoRrfAlpha === true,
             jevPrompt: options.jevPrompt,
@@ -3902,4 +3918,4 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
     }
 }
 
-module.exports = new KnowledgeBaseManager();
\ No newline at end of file
+module.exports = new KnowledgeBaseManager();
```

**File**: `docs/RUST_VECTOR_ENGINE.md` (modified, +37/-0)
```diff
@@ -887,6 +887,43 @@ export declare class VexusIndex {
 
 ---
 
+## 查询排除谓词下推
+
+原有查询入口和默认参数保持兼容：默认搜索宽度为 `max(128, k)`，精排预算为 `max(64, k)`。新增入口支持按外部 ID 排除候选，并可显式指定搜索宽度：
+
+```js
+const options = JSON.stringify({ excludeIds: [12, 34] });
+index.searchWithOptions(query, 10, options);
+await runtime.searchGlobalTagsWithOptions(query, 10, options);
+await runtime.searchDiaryIndicesWithOptions(diaryNames, query, 64, 100, options);
+```
+
+`excludeIds` 使用当前索引的外部 ID。被排除的节点仍可作为图导航跳板，但不会占据结果候选池。通用 SM、768 维 SM 和旧 BQ 路径执行同样的过滤规则。SQL 查询继续使用原有读事务和发布门禁；不以原始向量读取失败代替候选池过滤。显式校正模式的锚点仍可用于评分校准，但不会作为结果返回。
+
+当前查询与历史补充查询使用同一组选项。文件和时间候选在消耗配额前执行排除，融合后再次过滤。外部 rerank 通道的稀疏追加及最终候选选择也检查排除集，避免已排除 ID 经其他通道回流。
+
+`KnowledgeBaseManager.executeExternalRerank` 和 `executeParallelRerank` 通过 `options.annSearch` 透传调用者显式提供的选项；插件不会自行从文本前缀推导排除 ID。显式传入选项时要求原生模块声明 `index.query-options.v1`，不支持时返回重编译错误，避免旧模块静默忽略排除。
+
+外部 rerank 的稀疏补充仍只检查输入前 255 个文件候选，先归并规范化后的重复路径并保留最高分，再在同一读事务内按文件元数据核对日记作用域，避免无关或重复文件占用补找预算。每条保留候选最多追加 512 个未被 ID 排除的记录。无排除集时沿原正文查询；有排除集时先在同一查询中有限补找，最多额外查看 64 条。需要更深补找时才读取 ID 索引，再批量获取选中记录的正文。索引补找每条文件候选最多查看 4,608 个 ID，整个查询共享 16,384 个 ID 的预算；预算耗尽后，后续文件仍执行基础窗口。
+
+`diagnostics.nativeRerank.sparseScan` 提供元数据、窗口、索引、批量正文的行数，以及正文解码数、重复候选数、预算值和 `filesStoppedAtScanLimit`。最后一项表示触及预算且未补满，文件恰好在边界结束时也可能计数，因此只说明可能还有未检查记录。诊断会保留到插件广播，但不会自动重试。合法早到文件可能耗尽共享预算；极端排除集不保证补满候选，也不会无上限扫描整个大文件。正文前缀过滤和去重仍在最终选择阶段执行，512 不是最终结果数量保证。行数是 SQL 返回/处理计数，不是物理磁盘读取量或固定耗时保证。
+
+混合查询计划可通过 `annSearch` 字段传入同一组选项，例如 `{"annSearch":{"excludeIds":[12,34]}}`。可选 `efSearch` 用于显式控制导航宽度；更宽搜索会增加计算，不能把其召回收益归因于排除下推。本次没有修改默认值或推荐加宽。
+
+### SQL 读取对照
+
+`rust-vexus-lite/benchmarks/sm-search` 是独立 Cargo 基准，直接编译生产 `index_source.rs` 和 `retrieval_index.rs`，不会复制搜索循环。它使用磁盘 SQLite 和显式读事务，通过 SQL trace 统计完整向量查询次数，包含宿主返回前的向量复读。
+
+输入由 `BENCH_LIB`（前 97,464 行库向量）、`BENCH_QUERIES`（500 行查询）、`BENCH_REAL_TRUTH`（每查询 300 个 uint64 ID）提供。向量为无头的 3,072 维 little-endian float32；ID 从 1 开始。`BENCH_DB` 必须指向不存在的新文件，`BENCH_OUT` 指定 JSON 输出。
+
+```sh
+RAYON_NUM_THREADS=1 cargo run --release --offline --manifest-path rust-vexus-lite/benchmarks/sm-search/Cargo.toml
+```
+
+对照采用排除真实前 M 个近邻的压力场景。后置过滤会先请求 64 或 `64+M` 条结果，再过滤并取十条；下推方案直接请求十条，保留原精排预算。两种搜索宽度分别报告，256 仅作为额外计算对照。聚合数据与输入 SHA-256 见 `results-summary.json`，运行输出提供逐题排名、真值和完整 SQL 读取计数。即使宽度不变，过滤后也可能增加图遍历量，读取减少不代表总 CPU 或延迟降低。该基准不作生产端到端延迟或全库精确 Top-K 保证。
+
+---
+
 ## 更新日志
 
 | 版本 | 日期 | 变更 |
```

**File**: `rust-vexus-lite/benchmarks/sm-search/.gitignore` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+/target/
```

**File**: `rust-vexus-lite/benchmarks/sm-search/Cargo.toml` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+[package]
+name = "filtered-search-sqlite-bench"
+version = "0.1.0"
+edition = "2024"
+rust-version = "1.89"
+publish = false
+
+[dependencies]
+vcp-tdb-index = { path = "../../crates/vcp-tdb-index" }
+rusqlite = { version = "0.29", features = ["bundled", "trace"] }
+serde = { version = "1", features = ["derive"] }
+serde_json = "1"
+sha2 = "0.10"
+rayon = "1"
+
+[workspace]
```

**File**: `rust-vexus-lite/benchmarks/sm-search/results-summary.json` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+{
+  "dimension": 3072,
+  "library_rows": 97464,
+  "post_filter_contract": "request 64 (or 64+M) results, filter IDs, take ten; pushdown requests ten with the unchanged max(64,k) rerank budget",
+  "queries": 500,
+  "rayon_threads": 1,
+  "scope": "actual SQL function; counts include final vector rereads; adversarial true-top-M exclusions; no latency claim",
+  "sqlite_version": "3.41.2",
+  "baseline_commit": "c603f13692b212db371223ff6d91fb71b0b3b39e",
+  "embedding_model": "gemini-embedding-2-preview",
+  "dataset": "LongMemEval cached public benchmark embeddings",
+  "truth": "Exhaustive FP64 cosine top-300 over the library; IDs are one-based",
+  "results": [
+    {
+      "ef": 128,
+      "excluded_top": 0,
+      "mean_sql_vector_reads": 128.0,
+      "mode": "post_filter_128",
+      "recall10": 0.9646,
+      "requested_k": 64
+    },
+    {
+      "ef": 128,
+      "excluded_top": 0,
+      "mean_sql_vector_reads": 128.0,
+      "mode": "expanded_post_filter",
+      "recall10": 0.9646,
+      "requested_k": 64
+    },
+    {
+      "ef": 128,
+      "excluded_top": 0,
+      "mean_sql_vector_reads": 74.0,
+      "mode": "pushdown_128",
+      "recall10": 0.9646,
+      "requested_k": 10
+    },
+    {
+      "ef": 256,
+      "excluded_top": 0,
+      "mean_sql_vector_reads": 74.0,
+      "mode": "pushdown_256",
+      "recall10": 0.9822,
+      "requested_k": 10
+    },
+    {
+      "ef": 128,
+      "excluded_top": 32,
+      "mean_sql_vector_reads": 128.0,
+      "mode": "post_filter_128",
+      "recall10": 0.9176,
+      "requested_k": 64
+    },
+    {
+      "ef": 160,
+      "excluded_top": 32,
+      "mean_sql_vector_reads": 192.0,
+      "mode": "expanded_post_filter",
+      "recall10": 0.94,
+      "requested_k": 96
+    },
+    {
+      "ef": 128,
+      "excluded_top": 32,
+      "mean_sql_vector_reads": 74.0,
+      "mode": "pushdown_128",
+      "recall10": 0.9378,
+      "requested_k": 10
+    },
+    {
+      "ef": 256,
+      "excluded_top": 32,
+      "mean_sql_vector_reads": 74.0,
+      "mode": "pushdown_256",
+      "recall10": 0.9664,
+      "requested_k": 10
+    },
+    {
+      "ef": 128,
+      "excluded_top": 64,
+      "mean_sql_vector_reads": 128.0,
+      "mode": "post_filter_128",
+      "recall10": 0.3578,
+      "requested_k": 64
+    },
+    {
+      "ef": 192,
+      "excluded_top": 64,
+      "mean_sql_vector_reads": 256.0,
+      "mode": "expanded_post_filter",
+      "recall10": 0.9204,
+      "requested_k": 128
+    },
+    {
+      "ef": 128,
+      "excluded_top": 64,
+      "mean_sql_vector_reads": 74.0,
+      "mode": "pushdown_128",
+      "recall10": 0.9132,
+      "requested_k": 10
+    },
+    {
+      "ef": 256,
+      "excluded_top": 64,
+      "mean_sql_vector_reads": 74.0,
+      "mode": "pushdown_256",
+      "recall10": 0.944,
+      "requested_k": 10
+    },
+    {
+      "ef": 128,
+      "excluded_top": 128,
+      "mean_sql_vector_reads": 128.0,
+      "mode": "post_filter_128",
+      "recall10": 0.01,
+      "requested_k": 64
+    },
+    {
+      "ef": 256,
+      "excluded_top": 128,
+      "mean_sql_vector_reads": 384.0,
+      "mode": "expanded_post_filter",
+      "recall10": 0.8694,
+      "requested_k": 192
+    },
+    {
+      "ef": 128,
+      "excluded_top": 128,
+      "mean_sql_vector_reads": 74.0,
+      "mode": "pushdown_128",
+      "recall10": 0.853,
+      "requested_k": 10
+    },
+    {
+      "ef": 256,
+      "excluded_top": 128,
+      "mean_sql_vector_reads": 74.0,
+      "mode": "pushdown_256",
+      "recall10": 0.8752,
+      "requested_k": 10
+    }
+  ],
+  "input_sha256": {
+    "library_first_97464_rows_f32le": "fcbe0049718a9863588da943f2c03c701bae79ae0011d0b380275dcf337f97d1",
+    "queries_500_rows_f32le": "cce5697156435bf2e642787b61857c30bb8c03cbafbd948a9dbe297b6250288d",
+    "truth_500_by_300_u64le": "4bfc083d89094d01c470405949b2be874698e2babe0f6a03982ee8dad9390159"
+  }
+}
```

**File**: `rust-vexus-lite/benchmarks/sm-search/src/main.rs` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+// Run production SQL-host code without loading a Node-API test host.
+#![allow(dead_code)]
+#[path = "../../../src/index_source.rs"]
+mod index_source;
+#[path = "../../../src/retrieval_index.rs"]
+mod retrieval_index;
+use retrieval_index::{RetrievalIndex, RetrievalSearchOptions};
+use std::collections::HashSet;
+use std::sync::atomic::{AtomicUsize, Ordering};
+static READS: AtomicUsize = AtomicUsize::new(0);
+fn env(name: &str) -> String { std::env::var(name).unwrap() }
+fn trace(sql: &str) {
+    if sql.starts_with("SELECT vector FROM tags WHERE id=") { READS.fetch_add(1, Ordering::Relaxed); }
+}
+fn rows(path: &str, count: usize) -> Vec<Vec<f32>> {
+    std::fs::read(path).unwrap().chunks_exact(3072 * 4).take(count).map(|row|
+        row.chunks_exact(4).map(|v| f32::from_le_bytes(v.try_into().unwrap())).collect()).collect()
+}
+fn main() {
+    let db = env("BENCH_DB");
+    assert!(!std::path::Path::new(&db).exists(), "BENCH_DB must be a new file");
+    let mut connection = rusqlite::Connection::open(&db).unwrap();
+    connection.execute_batch("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA cache_size=-65536; PRAGMA mmap_size=0; CREATE TABLE tags(id INTEGER PRIMARY KEY,vector BLOB); BEGIN;").unwrap();
+    let library = rows(&env("BENCH_LIB"), 97464);
+    {
+        let mut statement = connection.prepare("INSERT INTO tags VALUES (?1,?2)").unwrap();
+        for (i, row) in library.iter().enumerate() {
+            let bytes: Vec<u8> = row.iter().flat_map(|v| v.to_le_bytes()).collect();
+            statement.execute(rusqlite::params![(i + 1) as i64, bytes]).unwrap();
+        }
+    }
+    connection.execute_batch("COMMIT; BEGIN;").unwrap();
+    let index = RetrievalIndex::from_sql(index_source::build_memory_from_connection(
+        &connection, None, 3072, "gemini-embedding-2-preview").unwrap());
+    eprintln!("Built {} rows", index.size());
+    let queries = rows(&env("BENCH_QUERIES"), 500);
+    let truth_bytes = std::fs::read(env("BENCH_REAL_TRUTH")).unwrap();
+    let truth: Vec<Vec<u64>> = truth_bytes.chunks_exact(300 * 8).map(|row|
+        row.chunks_exact(8).map(|v| u64::from_le_bytes(v.try_into().unwrap())).collect()).collect();
+    assert_eq!(truth.len(), queries.len());
+    connection.trace(Some(trace));
+    let mut results = Vec::new();
+    for excluded_top in [0usize, 32, 64, 128] {
+        for (mode, ef, requested_k, pushdown) in [
+            ("post_filter_128", 128, 64, false),
+            ("expanded_post_filter", 128 + excluded_top, 64 + excluded_top, false),
+            ("pushdown_128", 128, 10, true),
+            ("pushdown_256", 256, 10, true),
+        ] {
+            let mut records = Vec::new();
+            let mut total_reads = 0usize;
+            let mut total_hits = 0usize;
+            for (qi, query) in queries.iter().enumerate() {
+                let excluded: HashSet<_> = truth[qi][..excluded_top].iter().copied().collect();
+                let options = RetrievalSearchOptions {
+                    ef_search: Some(ef), exclude_ids: if pushdown { excluded.clone() } else { HashSet::new() },
+                };
+                READS.store(0, Ordering::Relaxed);
+                let found = index.search_sql_options(&connection, None, query, requested_k, &options).unwrap();
+                let valid: Vec<_> = found.iter().map(|p| p.0).filter(|id| !excluded.contains(id)).take(10).collect();
+                let expected = &truth[qi][excluded_top..excluded_top + 10];
+                let hits = expected.iter().filter(|id| valid.contains(id)).count();
+                let reads = READS.load(Ordering::Relaxed);
+                total_hits += hits; total_reads += reads;
+                assert!(valid.iter().all(|id| !excluded.contains(id)));
+                records.push(serde_json::json!({"query":qi,"found":valid,"truth":expected,"sql_reads":reads}));
+            }
+            eprintln!("M={excluded_top} {mode}: recall10={:.4}, sql_reads={:.2}", total_hits as f64/(queries.len()*10) as f64, total_reads as f64/queries.len() as f64);
+            results.push(serde_json::json!({"excluded_top":excluded_top,"mode":mode,"ef":ef,
+                "requested_k":requested_k,"recall10":total_hits as f64/(queries.len()*10) as f64,
+                "mean_sql_vector_reads":total_reads as f64/queries.len() as f64,"query_records":records}));
+        }
+    }
+    connection.trace(None);
+    let output = serde_json::json!({"library_rows":index.size(),"queries":queries.len(),"dimension":3072,
+        "rayon_threads":rayon::current_num_threads(),"sqlite_version":rusqlite::version(),"results":results,
+        "scope":"actual SQL function; counts include final vector rereads; adversarial true-top-M exclusions; no latency claim",
+        "post_filter_contract":"request 64 (or 64+M) results, filter IDs, take ten; pushdown requests ten with the unchanged max(64,k) rerank budget"});
+    std::fs::write(env("BENCH_OUT"), serde_json::to_vec_pretty(
```

**File**: `rust-vexus-lite/crates/vcp-tdb-index/src/engine.rs` (modified, +28/-6)
```diff
@@ -15,6 +15,12 @@ fn invalid(message: &str) -> io::Error {
     io::Error::new(io::ErrorKind::InvalidInput, message)
 }
 
+/// Per-query navigation controls; reranking retains its fixed budget.
+#[derive(Clone, Copy, Debug, Default)]
+pub struct SearchOptions {
+    pub ef_search: Option<usize>,
+}
+
 pub struct TdbIndex {
     dimension: usize,
     base: Option<VectorAsset>,
@@ -245,10 +251,26 @@ impl TdbIndex {
     /// Query routing using authoritative host originals, not snapshot vectors.
     /// The caller must freeze the source for the duration of this query.
     pub fn search_with_source<F>(
-        &self, query: &[f32], k: usize, ef: Option<usize>, mut fill: F,
+        &self, query: &[f32], k: usize, ef: Option<usize>, fill: F,
     ) -> io::Result<Vec<(u64, f32)>>
     where
         F: FnMut(u64, &mut Vec<f32>) -> bool,
+    {
+        self.search_with_source_options(query, k, &SearchOptions { ef_search: ef }, &|_| false, fill)
+    }
+
+    pub fn search_with_options<E: Fn(u64) -> bool>(
+        &self, query: &[f32], k: usize, options: &SearchOptions, exclude: &E,
+    ) -> io::Result<Vec<(u64, f32)>> {
+        self.search_with_source_options(query, k, options, exclude, |id, output| {
+            self.positions.get(&id).is_some_and(|slot| self.fill_slot(*slot, output))
+        })
+    }
+
+    pub fn search_with_source_options<F, E>(
+        &self, query: &[f32], k: usize, options: &SearchOptions, exclude: &E, mut fill: F,
+    ) -> io::Result<Vec<(u64, f32)>>
+    where F: FnMut(u64, &mut Vec<f32>) -> bool, E: Fn(u64) -> bool,
     {
         if query.len() != self.dimension || query.iter().any(|v| !v.is_finite()) {
             return Err(invalid("invalid search vector"));
@@ -257,15 +279,15 @@ impl TdbIndex {
         if k == 0 { return Ok(Vec::new()); }
         let mut output: Vec<(u64, f32)> = if let Some(graph) = &self.graph {
             let config = QuIVerSearchConfig {
-                top_k: k, ef_search: ef.unwrap_or(128).max(k),
+                top_k: k, ef_search: options.ef_search.unwrap_or(128).max(k),
                 rerank_limit: Some(64_usize.max(k)),
             };
-            let candidates = graph.search(query, |slot, output| {
+            let candidates = graph.search_with_options(query, |slot, output| {
                 self.ids.get(slot).is_some_and(|id| *id != 0 && fill(*id, output))
-            }, &config);
+            }, &config, exclude);
             let mut row = Vec::with_capacity(self.dimension);
             candidates.into_iter().filter_map(|(id, _)| {
-                if !self.contains(id) { return None; }
+                if !self.contains(id) || exclude(id) { return None; }
                 row.clear();
                 fill(id, &mut row).then(|| (id, cosine(query, &row)))
             }).collect()
@@ -275,7 +297,7 @@ impl TdbIndex {
             let mut row = Vec::with_capacity(self.dimension);
             for &id in &self.ids {
                 row.clear();
-                if id != 0 && fill(id, &mut row) {
+                if id != 0 && !exclude(id) && fill(id, &mut row) {
                     let candidate = RankedRow { id, score: cosine(query, &row) };
                     if heap.len() < k {
                         heap.push(candidate);
```

**File**: `rust-vexus-lite/crates/vcp-tdb-index/src/index/quiver.rs` (modified, +51/-11)
```diff
@@ -1306,7 +1306,7 @@ impl QuIVer {
         let d = NonNanF32(scorer.score(self.ids[entry as usize], cheap_distance(entry)) as f32);
         visited.set(entry as usize);
         candidates.push(Reverse((d, entry)));
-        results.push((d, entry));
+        if scorer.accept_result(self.ids[entry as usize]) { results.push((d, entry)); }
 
         while let Some(Reverse((cd, cur))) = candidates.pop() {
             if results.len() >= ef && cd > results.peek().unwrap().0 {
@@ -1330,9 +1330,9 @@ impl QuIVer {
                 let nd = NonNanF32(scorer.score(self.ids[nb as usize], cheap_distance(nb)) as f32);
                 if results.len() < ef || nd < results.peek().unwrap().0 {
                     candidates.push(Reverse((nd, nb)));
-                    results.push((nd, nb));
-                    if results.len() > ef {
-                        results.pop();
+                    if scorer.accept_result(self.ids[nb as usize]) {
+                        results.push((nd, nb));
+                        if results.len() > ef { results.pop(); }
                     }
                 }
             }
@@ -1543,7 +1543,9 @@ impl QuIVer {
         let initial_distance = distance(scorer, entry);
         scratch.visited.set(entry as usize);
         scratch.candidates.push(Reverse((initial_distance, entry)));
-        scratch.results.push((initial_distance, entry));
+        if scorer.accept_result(self.ids[entry as usize]) {
+            scratch.results.push((initial_distance, entry));
+        }
 
         while let Some(Reverse((candidate_distance, current))) = scratch.candidates.pop() {
             if scratch.results.len() >= ef && candidate_distance > scratch.results.peek().unwrap().0
@@ -1568,9 +1570,9 @@ impl QuIVer {
                     scratch
                         .candidates
                         .push(Reverse((neighbor_distance, neighbor)));
-                    scratch.results.push((neighbor_distance, neighbor));
-                    if scratch.results.len() > ef {
-                        scratch.results.pop();
+                    if scorer.accept_result(self.ids[neighbor as usize]) {
+                        scratch.results.push((neighbor_distance, neighbor));
+                        if scratch.results.len() > ef { scratch.results.pop(); }
                     }
                 }
             }
@@ -1707,13 +1709,27 @@ impl QuIVer {
     /// 成功返回 `true`。调用方按需从向量池或mmap冷层读取，
     /// 默认查询无需传入或常驻第二份全量f32数组。
     pub fn search<F>(
+        &self,
+        query: &[f32],
+        get_vec_f32: F,
+        config: &QuIVerSearchConfig,
+    ) -> Vec<(u64, f32)>
+    where
+        F: FnMut(usize, &mut Vec<f32>) -> bool,
+    {
+        self.search_with_options(query, get_vec_f32, config, &|_| false)
+    }
+
+    pub fn search_with_options<F, E>(
         &self,
         query: &[f32],
         mut get_vec_f32: F,
         config: &QuIVerSearchConfig,
+        exclude: &E,
     ) -> Vec<(u64, f32)>
     where
         F: FnMut(usize, &mut Vec<f32>) -> bool,
+        E: Fn(u64) -> bool,
     {
         if query.len() != self.dim
             || query.iter().any(|x| !x.is_finite())
@@ -1748,15 +1764,15 @@ impl QuIVer {
             let mut fill = |internal: usize, buffer: &mut Vec<f32>| {
                 !self.tombstones[internal] && get_vec_f32(self.slot_indices[internal], buffer)
             };
-            let mut output = model.search_routed(sm_query, &self.layer0, &sm_config, &mut fill);
+            let mut output = model.search_routed_filtered(sm_query, &self.layer0, &sm_config, exclude, &mut fill);
             if output
                 .as_ref()
                 .is_err_and(|e| e.kind() == std::io::ErrorKind::NotFound)
                 && self.corrected_sm_enabled()
                 && let Some(default) = &self.default_sm
             {
                 // 属性过滤屏蔽显式校正锚点时，使用无锚点默认SM，仍保持余弦精排。
-                output = default.search_routed(sm_query, &self.layer0, &sm_config, &mut fill);
+                output = default.search_routed_filtered(sm_query, &self.layer0, &sm_config, exclude, &mut fill);
             }
             return match output {
                 Ok(output) => output.neighbors,
@@ -1767,7 +1783,12 @@ impl QuIVer {
             };
         }
         // 仅缺少原始向量的独立旧sidecar仍使用BQ；数据库加载时会流式补齐SM。
-        let mut scorer = BqNavigationScorer;
+        struct FilteredBq<'a, E>(&'a E);
+        impl<E: Fn(u64) -> bool> NavigationScorer for FilteredBq<'_, E> {
+            fn score(&mut self, _: u64, distance: u32) -> u32 { distance }
+            fn accept_result(&mut self, id: u64) -> bool { !(self.0)(id) }
+        }
+        let mut scorer = FilteredBq(exclude);
         self.search_with_scorer(query, get_vec_f32, config, &mut scorer)
     }
 
@@ -3713,6 +3734,25 @@ mod tests {
         }));
     }
 
+    #[test]
+    fn filtered_legacy_bq_does_not_spend_the_result_pool_on_excluded_hubs() {
+        for dim in [65,384] {
+            let mut index = QuIVer::new(dim,&QuIVe
```

---

### Incident Patch 3: `964c7974` (2026-10-25)
**Commit Message**: fix(rust-vexus-lite): 稀疏排除有限补找、预算隔离与选项透传

**File**: `KnowledgeBaseManager.js` (modified, +17/-1)
```diff
@@ -2622,6 +2622,13 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
         if (typeof runtime?.executeExternalRerank !== 'function') {
             throw new Error('NATIVE_PARALLEL_RERANK_ABI_UNAVAILABLE: rebuild rust-vexus-lite');
         }
+        if (options.annSearch !== undefined) {
+            const features = typeof runtime.capabilities === 'function'
+                ? runtime.capabilities()?.capabilities : [];
+            if (!Array.isArray(features) || !features.includes('index.query-options.v1')) {
+                throw new Error('NATIVE_ANN_SEARCH_OPTIONS_UNAVAILABLE: rebuild rust-vexus-lite');
+            }
+        }
         const diaryNames = [...new Set(
             (Array.isArray(options.diaryNames) ? options.diaryNames : [options.diaryNames])
                 .map(name => String(name || '').trim()).filter(Boolean)
@@ -2632,6 +2639,7 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
             externalOnly: true, diaryNames,
             queryText: String(query.text || ''),
             topK: options.topK, candidateK: options.candidateK,
+            annSearch: options.annSearch,
             externalK: options.externalK, useJev: options.useJev,
             jevPrompt: options.jevPrompt,
             fileCandidates: options.fileCandidates || [],
@@ -2649,6 +2657,13 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
         if (typeof runtime?.executeParallelRerank !== 'function') {
             throw new Error('NATIVE_PARALLEL_RERANK_ABI_UNAVAILABLE: rebuild rust-vexus-lite');
         }
+        if (options.annSearch !== undefined) {
+            const features = typeof runtime.capabilities === 'function'
+                ? runtime.capabilities()?.capabilities : [];
+            if (!Array.isArray(features) || !features.includes('index.query-options.v1')) {
+                throw new Error('NATIVE_ANN_SEARCH_OPTIONS_UNAVAILABLE: rebuild rust-vexus-lite');
+            }
+        }
         const diaryNames = [...new Set(
             (Array.isArray(options.diaryNames) ? options.diaryNames : [options.diaryNames])
                 .map(name => String(name || '').trim()).filter(Boolean)
@@ -2664,6 +2679,7 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
             riverConfig: this.riverMemoEngine._nativeConfig(prepared.artifact, options),
             queryText: String(query.text || ''), topK: options.topK,
             candidateK: options.candidateK, externalK: options.externalK,
+            annSearch: options.annSearch,
             alpha: options.alpha ?? 0.5, useJev: options.useJev,
             autoRrfAlpha: options.autoRrfAlpha === true,
             jevPrompt: options.jevPrompt,
@@ -3902,4 +3918,4 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
     }
 }
 
-module.exports = new KnowledgeBaseManager();
\ No newline at end of file
+module.exports = new KnowledgeBaseManager();
```

**File**: `docs/RUST_VECTOR_ENGINE.md` (modified, +6/-0)
```diff
@@ -902,6 +902,12 @@ await runtime.searchDiaryIndicesWithOptions(diaryNames, query, 64, 100, options)
 
 当前查询与历史补充查询使用同一组选项。文件和时间候选在消耗配额前执行排除，融合后再次过滤。外部 rerank 通道的稀疏追加及最终候选选择也检查排除集，避免已排除 ID 经其他通道回流。
 
+`KnowledgeBaseManager.executeExternalRerank` 和 `executeParallelRerank` 通过 `options.annSearch` 透传调用者显式提供的选项；插件不会自行从文本前缀推导排除 ID。显式传入选项时要求原生模块声明 `index.query-options.v1`，不支持时返回重编译错误，避免旧模块静默忽略排除。
+
+外部 rerank 的稀疏补充仍只检查输入前 255 个文件候选，先归并规范化后的重复路径并保留最高分，再在同一读事务内按文件元数据核对日记作用域，避免无关或重复文件占用补找预算。每条保留候选最多追加 512 个未被 ID 排除的记录。无排除集时沿原正文查询；有排除集时先在同一查询中有限补找，最多额外查看 64 条。需要更深补找时才读取 ID 索引，再批量获取选中记录的正文。索引补找每条文件候选最多查看 4,608 个 ID，整个查询共享 16,384 个 ID 的预算；预算耗尽后，后续文件仍执行基础窗口。
+
+`diagnostics.nativeRerank.sparseScan` 提供元数据、窗口、索引、批量正文的行数，以及正文解码数、重复候选数、预算值和 `filesStoppedAtScanLimit`。最后一项表示触及预算且未补满，文件恰好在边界结束时也可能计数，因此只说明可能还有未检查记录。诊断会保留到插件广播，但不会自动重试。合法早到文件可能耗尽共享预算；极端排除集不保证补满候选，也不会无上限扫描整个大文件。正文前缀过滤和去重仍在最终选择阶段执行，512 不是最终结果数量保证。行数是 SQL 返回/处理计数，不是物理磁盘读取量或固定耗时保证。
+
 混合查询计划可通过 `annSearch` 字段传入同一组选项，例如 `{"annSearch":{"excludeIds":[12,34]}}`。可选 `efSearch` 用于显式控制导航宽度；更宽搜索会增加计算，不能把其召回收益归因于排除下推。本次没有修改默认值或推荐加宽。
 
 ### SQL 读取对照
```

**File**: `rust-vexus-lite/src/knowledge_runtime.rs` (modified, +410/-25)
```diff
@@ -272,6 +272,188 @@ fn select_external_candidates(
     }).collect()
 }
 
+const SPARSE_FILE_CANDIDATE_LIMIT: usize = 512;
+const SPARSE_INLINE_EXTRA_LIMIT: usize = 64;
+const SPARSE_FILE_INDEX_ID_LIMIT: usize = 4608;
+const SPARSE_QUERY_INDEX_ID_LIMIT: usize = 16384;
+
+#[derive(Serialize)]
+#[serde(rename_all = "camelCase")]
+struct SparseCandidateStats {
+    file_candidates_visited: usize,
+    duplicate_file_candidates_skipped: usize,
+    file_metadata_rows_read: usize,
+    window_rows_read: usize,
+    index_id_rows_read: usize,
+    batch_rows_read: usize,
+    content_rows_decoded: usize,
+    files_stopped_at_scan_limit: usize,
+    inline_extra_row_limit: usize,
+    per_file_index_id_limit: usize,
+    query_index_id_limit: usize,
+}
+
+impl Default for SparseCandidateStats {
+    fn default() -> Self {
+        Self { file_candidates_visited:0, duplicate_file_candidates_skipped:0, file_metadata_rows_read:0,
+            window_rows_read:0, index_id_rows_read:0,
+            batch_rows_read:0, content_rows_decoded:0, files_stopped_at_scan_limit:0,
+            inline_extra_row_limit:SPARSE_INLINE_EXTRA_LIMIT,
+            per_file_index_id_limit:SPARSE_FILE_INDEX_ID_LIMIT,
+            query_index_id_limit:SPARSE_QUERY_INDEX_ID_LIMIT }
+    }
+}
+
+fn normalized_sparse_files(files: &[NativeFileCandidate]) -> Vec<(String, &NativeFileCandidate)> {
+    let mut positions = HashMap::new();
+    let mut output: Vec<(String, &NativeFileCandidate)> = Vec::new();
+    for file in files.iter().take(255) {
+        let path = file.path.replace('\\', "/");
+        if let Some(&position) = positions.get(&path) {
+            let (_, existing): &mut (String, &NativeFileCandidate) = &mut output[position];
+            if file.normalized_bm25_score.clamp(0.0,1.0) > existing.normalized_bm25_score.clamp(0.0,1.0) {
+                *existing = file;
+            }
+        } else {
+            positions.insert(path.clone(), output.len());
+            output.push((path, file));
+        }
+    }
+    output
+}
+
+fn external_sparse_row(row: &rusqlite::Row<'_>, score: f64) -> rusqlite::Result<(i64, serde_json::Value)> {
+    let id = row.get::<_, i64>(0)?;
+    Ok((id, serde_json::json!({
+        "id":id, "chunkId":id, "text":row.get::<_,String>(1)?,
+        "sourceFile":row.get::<_,String>(2)?, "diaryName":row.get::<_,String>(3)?,
+        "fileId":row.get::<_,i64>(4)?, "score":score
+    })))
+}
+
+fn append_external_sparse_candidates(
+    connection: &rusqlite::Connection,
+    files: &[NativeFileCandidate],
+    diary_names: &[String],
+    exclude_ids: &HashSet<u64>,
+    sparse_weight: f64,
+    rows: &mut Vec<serde_json::Value>,
+) -> Result<SparseCandidateStats> {
+    let mut stats = SparseCandidateStats::default();
+    if diary_names.is_empty() { return Ok(stats); }
+    let normalized = normalized_sparse_files(files);
+    stats.duplicate_file_candidates_skipped = files.len().min(255) - normalized.len();
+    let allowed: HashSet<&str> = diary_names.iter().map(String::as_str).collect();
+    let mut metadata = connection.prepare("SELECT diary_name FROM files WHERE path=?1")
+        .map_err(|_| Error::from_reason("NATIVE_RERANK_BM25_HYDRATE"))?;
+    let mut scoped = Vec::with_capacity(normalized.len());
+    for (path, file) in normalized {
+        let diary: Option<String> = metadata.query_row([&path], |row|row.get(0)).optional()
+            .map_err(|_| Error::from_reason("NATIVE_RERANK_BM25_HYDRATE"))?;
+        if let Some(diary) = diary {
+            stats.file_metadata_rows_read += 1;
+            if allowed.contains(diary.as_str()) { scoped.push((path, file)); }
+        }
+    }
+    // Scope lookup and body reads share the caller's immutable SQL read transaction.
+    let window_sql = "SELECT c.id,c.content,f.path,f.diary_name,f.id FROM chunks c
+         JOIN files f ON f.id=c.file_id WHERE f.path=?1";
+    if exclude_ids.is_empty() {
+        let mut statement = connection.prepare(window_sql)
+            .map_err(|_| Error::from_reason("NATIVE_RERANK_BM25_HYDRATE"))?;
+        for (path, file) in &scoped {
+            stats.file_candidates_visited += 1;
+            let score = file.normalized_bm25_score.clamp(0.0,1.0)*sparse_weight;
+            let found = statement.query_map([path], |row|
+                external_sparse_row(row, score))
+                .map_err(|_| Error::from_reason("NATIVE_RERANK_BM25_HYDRATE"))?;
+            for row in found.take(SPARSE_FILE_CANDIDATE_LIMIT) {
+                let (_, row) = row.map_err(|_| Error::from_reason("NATIVE_RERANK_BM25_HYDRATE"))?;
+                stats.window_rows_read += 1;
+                stats.content_rows_decoded += 1;
+                rows.push(row);
+            }
+        }
+        return Ok(stats);
+    }
+
+    let mut window = connection.prepare(window_sql)
+        .map_err(|_| Error::from_reason("NATIVE_RERANK_BM25_HYDRATE"))?;
+    let lookup_sql = "SELECT c.id FROM chunks c JOIN files f ON f.id=c.file_id WH
```

**File**: `tests/nativeRerankSearchOptions.test.js` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+'use strict';
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const vm = require('node:vm');
+
+// Exercise the real serialization methods without starting the manager singleton.
+function loadMethod(name, nextName) {
+    const filename = path.join(__dirname, '..', 'KnowledgeBaseManager.js');
+    const source = fs.readFileSync(filename, 'utf8');
+    const start = source.indexOf(`    async ${name}(`);
+    const end = source.indexOf(`    async ${nextName}(`, start + 1);
+    assert(start >= 0 && end > start);
+    return vm.runInNewContext(`({${source.slice(start, end)}})`, {
+        path, __dirname: path.dirname(filename), Float32Array
+    })[name];
+}
+
+for (const [name, nextName] of [
+    ['executeExternalRerank', 'executeParallelRerank'],
+    ['executeParallelRerank', 'executeNativeRiverQuery']
+]) {
+    test(`${name} forwards ANN exclusions and preserves sparse diagnostics`, async () => {
+        const query = { text: 'fixture', vector: new Float32Array([1, 0]) };
+        let captured;
+        const owner = {
+            async _getOrLoadDiaryIndex() {},
+            async prepareUnifiedMemoObservation() {
+                return { artifact: { artifactSig: 'fixture' }, pipeline: {},
+                    queryVector: query.vector, ghostVectors: new Float32Array() };
+            },
+            riverMemoEngine: { _nativeConfig: () => ({}) },
+            nativeKnowledgeRuntime: {
+                capabilities() { return { capabilities: ['index.query-options.v1'] }; },
+                async [name](plan, vector) {
+                    captured = JSON.parse(plan);
+                    assert.equal(vector, query.vector);
+                    return JSON.stringify({ results: [], diagnostics: { nativeRerank: {
+                        sparseScan: { filesStoppedAtScanLimit: 1 }
+                    } } });
+                }
+            }
+        };
+        const run = loadMethod(name, nextName);
+        const annSearch = { excludeIds: [17, 34], efSearch: 128 };
+        const result = await run.call(owner, query, { diaryNames: ['fixture'], annSearch });
+        assert.deepEqual(captured.annSearch, annSearch);
+        assert.equal(result.diagnostics.nativeRerank.sparseScan.filesStoppedAtScanLimit, 1);
+        await run.call(owner, query, { diaryNames: ['fixture'] });
+        assert.equal(captured.annSearch, undefined);
+        owner.nativeKnowledgeRuntime.capabilities = () => ({ capabilities: [] });
+        captured = undefined;
+        await assert.rejects(run.call(owner, query, { diaryNames: ['fixture'], annSearch }),
+            /NATIVE_ANN_SEARCH_OPTIONS_UNAVAILABLE/);
+        assert.equal(captured, undefined);
+        delete owner.nativeKnowledgeRuntime.capabilities;
+        await assert.rejects(run.call(owner, query, { diaryNames: ['fixture'], annSearch }),
+            /NATIVE_ANN_SEARCH_OPTIONS_UNAVAILABLE/);
+        await run.call(owner, query, { diaryNames: ['fixture'] });
+        assert.equal(captured.annSearch, undefined);
+    });
+}
```

#### Recent Merged Pull Requests:
- **PR #548** (2026-10-25): fix: archery 审核反馈优先回传改造 (@Wooden-Gear)
- **PR #547** (2026-10-25): fix(rust-vexus-lite): 稀疏排除有限补找、预算隔离与选项透传 (@CI-IISATO)
- **PR #546** (closed): fix: archery审核反馈优先回传改造 (@Wooden-Gear)
- **PR #545** (2026-10-25): archery 审核反馈优先回传改造 (@Wooden-Gear)
- **PR #544** (2026-10-25): fix(rust-vexus-lite): 将排除谓词下推至候选池并贯通原生检索通道 (@CI-IISATO)
- **PR #542** (2026-10-25): perf(rag): 重构TextChunker零回溯线性切分与TextSanitizer有界LRU记忆化，消除长文本Event Loop阻塞 (@infinite-vector)

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

## X. archery 审核反馈优先回传改造

**RULE**:
When implementing operations in `Plugin.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `aab375a1`: archery 审核反馈优先回传改造. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `Plugin.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
                    const userFeedback = typeof approvalResult.userFeedback === 'string'
                        ? approvalResult.userFeedback.trim()
                        : '';
                        message: userFeedback
                            ? `Tool call "${toolName}" was rejected by manual approval with user feedback.`
                            : `Tool call "${toolName}" was rejected silently by manual approval.`,
                        ...(userFeedback ? { user_feedback: userFeedback } : {})

                    // 无用户输入：archery 语义生效，静默吞掉回执，AI 完全无感。
                    if (!userFeedback) {
                        if (this.debugMode) {
                            console.log(`[PluginManager] Tool call for "${toolName}" (ID: ${requestId}) was rejected silently. Returning empty result to AI.`);
                        }
                        return undefined;
                    }

                    // 有用户输入：优先传递用户反馈。
                    // 走与普通拒绝完全同构的抛错路径，让上层既有错误链产出 isError=true，
                    // archery 分支才能把内容写回对话而不是静默终止。
                    if (this.debugMode) {
                        console.log(`[PluginManager] Tool call for "${too
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
                    if (this.debugMode) {
                        console.log(`[PluginManager] Tool call for "${toolName}" (ID: ${requestId}) was rejected silently. Returning empty result to AI.`);
                    }
                        message: `Tool call "${toolName}" was rejected silently by manual approval.`
                    return undefined;
                if (this.debugMode && normalizedReason) {
                    console.log(`[PluginManager] Silent manual rejection for ${requestId} included user note hidden from AI: ${normalizedReason.substring(0, 300)}`);
                approval.resolve({ silentRejected: true });
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `aab375a1` are properly handled with clean fallback behavior.
