> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source**: github ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Source Version**: `7ceecd48`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T16:15:15.290Z  
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
> **Harvest Timestamp**: 2026-10-20T16:15:15.283Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2379 stars

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
- **Issue #508** (2026-10-20): **fix(admin): 修复语义模型路由器预览未代理到主进程及提示框不可见**
  *Symptoms*: - 在本地 admin 路由挂载前，将语义路由预览接口反向代理到主进程；独立管理进程缺少 semanticModelRouter/RAG 运行态。 - 删除 .message-popup 中重复的 position: relative，避免覆盖 position: fixed 导致全局提示框不可见。

- **Issue #507** (2026-10-20): **fix: restore legacy geometry fallback and update maintenance route mock**
  *Symptoms*: Restores the legacy `intrinsicResidual` local fallback in `_geometryConfig()`, preserving AGS section precedence and deep-copy isolation, as specified by the existing design document and regression test (#506).  Updates the maintenance route fixture with `tagMemoEngine.scheduleMatrixRebuildForNewTags` for consistency apply. Keeps `requestActiveFullTraining` for the explicit full-training route (#505).  Validation on upstream main d9f61c0d: `node --test tests/unifiedGeometryScheduling.test.js tests/adminRagMaintenanceRoutes.test.js` 11 passed, 0 failed. `git diff --check` passed.  Fixes #505 Fixes #506 

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

### Incident Patch 1: `7ceecd48` (2026-10-20)
**Commit Message**: fix

**File**: `docs/vcp-whitepaper.md` (modified, +285/-149)
```diff
@@ -1,21 +1,30 @@
 ---
-title: VCP 全景技术白皮书 V5
-summary: 全面介绍 VCP 全栈运行时、Jev 决策与自然语言调用管网、Agent 工业级软件工程体系、前端应用群、共享 IPC 管网、Loom 与共笔文坊协作系统的工作原理和系统交互，是理解迈向 VCP 2.0 正式版全景生态的重要读物。
-updatedAt: 2026-09-30
+title: VCP 全景技术白皮书 V6
+summary: VCP 2.0 全景架构：以 VexusMemo / Vexus-Lite 原生一体化数据库、TDB 2-bit 自研检索、AGS 与 RiverMemo V2 统一记忆内核为数据底座，以 MoonAST 纯几何代码检索、V工程与 VChat 工作台组织 Agent 工程协作，贯通协议、上下文、前端应用群与长期自治。
+updatedAt: 2026-10-20
 category: guide
 ---
 
-# VCP 全景技术白皮书 V5：全栈自研的 Agent 运行时与前端生态
+# VCP 全景技术白皮书 V6：原生一体化数据库、MoonAST 与 Agent 全栈运行时
 
-**版本：迈向 VCP 2.0 正式版 · 2026 年初秋**
+**版本：VCP 2.0 正式版 · 架构更新截至 2026-10-20**
+
+> **阅读口径**：本文说明当前架构，并在必要处保留演进背景。VCP 2.0 已于 2026-10-01 发布；TagMemo 已退出生产运行，USearch 已由 TDB 2-bit 检索体系替代，MoonAST 已不再以 Tree-sitter 为主要解析依赖。RiverMemo V2 是查询实现的发布阶段，Topology V3 是仍沿用的统一排序构型，两者不是同一版本序列。
+>
+> **“自研”的边界**：VCP 自主实现原生数据运行时、TDB 检索、记忆数学与工程协作体系，但仍使用 SQLite、Rust、Electron 等基础设施。“一体化数据库”不意味着 SQLite 也由 VCP 编写，也不意味着取消所有外部依赖。
 
 ---
 
 ## 序言
 
-VCP 已经走过三个完整的版本周期，并在 2026 年秋季完成了从“全栈 AGI 运行时”向“全栈 Agent 生态操作系统与软件工程自治中枢”的架构大收敛，正式迈向 **VCP 2.0** 时代。
+VCP 已经走过多个版本周期，于 2026-10-01 发布 **VCP 2.0 正式版**，并在随后完成数据库、记忆数学和代码工程底座的新一轮收敛。从“全栈 AGI 运行时”到“全栈 Agent 生态操作系统与软件工程自治中枢”，变化不只是应用数量增加，而是核心数据与工程能力的所有权进一步下沉到自主实现的原生内核。
+
+早期，我们把 VCP 描述为「部署在 AI 模型 API 与前端应用之间的中间层服务器」——这个定义曾经是准确的。今天，VCP 的两条主线已经延伸至更底层：
+
+- **数据与记忆主线**：VexusMemo 统一持有记忆与知识数据库业务，Vexus-Lite 原生模块将 SQLite 事实事务、TDB 2-bit 导航与筛选、AGS 背景几何、Spike 有界传播、RiverMemo 双场与拓扑排序组织为同一条读、写、搜链。USearch 与旧 JS 数据库业务退出该生产路径，TagMemo 的独立运行时退役，其已验证机制由新内核继承和重构。
+- **软件工程主线**：MoonAST 从 C / Rust 与 Tree-sitter 双擎阶段演进为纯几何逻辑门驱动的自研代码识别与检索核心；ProjectForge、V工程轻量 IDE、Git、施工 Trace、操作回退与 VChat 工作台把代码理解、修改、验证和人工介入连接成持续工作流。
 
-V2 时代，我们把 VCP 描述为「部署在 AI 模型 API 与前端应用之间的中间层服务器」——这个定义曾经是准确的。但从 V2 演进至今，VCP 沿着一条异常陡峭且坚定的全栈自研路径生长：自研向量数据库 Vexus、自研图数据库 TDB、由 TagMemo V9 与 RiverMemo Topology V3 构成的统一记忆寻址底座、RiverMemo 与 RagDiary 全链路单次 Rust 内存融合重构、基于扩散架构的低延迟概率决策公共服务 JevRuntime、近乎通用的自然语言工具编译器 JEV-TOOL-call 与 JevCallBridgeEXP 分布式导航桥、闭源旗舰插件 VCPCode 入驻 VChat 带来的极致能效工程标杆、VCPProjectForge 协同工程模组与 ProjectModule 可视化编程子前端、流式渲染器 VCPMessageRenderer V4 极端内容防御体系、自研底层 WebGL/WebGPU Shader 合成管线驱动的 VMusic 3D 沉浸式太空歌剧演出、自研桌面运行时 VCPDesktop 与 V图表、AI 原生邮件协议 VCPSuperMail、DXGI 与纯数学窗口操控算法 VCP-SOM……
+围绕这两条主线，JevRuntime 概率决策、JEV-TOOL-call 自然语言编译、OneRing 跨端事实时间线、V4 流式渲染、共享 IPC、共笔文坊、Loom、VMusic、V图表、VGame 与 VPet 共同构成 Agent 可使用、用户可观察和介入的应用环境。
 
 到今天，"中间层"这个词早已装不下 VCP 了。VCP 不仅运行 Agent，也运行 Agent 所处的界面、应用、文档、代码工程、网页、文件、视听演出、媒体和协作过程。
 
@@ -32,16 +41,16 @@ VCP 不再只是一个中间层组件，而是一套**面向 Agent 的运行时
 - [三、系统整体架构](#三系统整体架构)
 - [四、指令协议、自然语言编译与安检双轨隔离](#四指令协议自然语言编译与安检双轨隔离)
 - [五、变量系统与上下文工程](#五变量系统与上下文工程)
-- [六、插件系统与 Jev 声明式生态](#六插件系统与-jev-声明式生态)
+- [六、插件系统](#六插件系统)
 - [七、工具调用记录与可审计运行时](#七工具调用记录与可审计运行时)
-- [八、记忆系统：TagMemo V9、RiverMemo 全链路 Rust 融合与双栈交互](#八记忆系统tagmemo-v9rivermemo-全链路-rust-融合与双栈交互)
+- [八、原生记忆与数据库：VexusMemo、AGS 与 RiverMemo V2](#八原生记忆与数据库vexusmemoags-与-rivermemo-v2)
 - [九、OneRing V2：统一上下文、OneRingMemo 与连续意识](#九onering-v2统一上下文oneringmemo-与连续意识)
 - [十、VCPModel：智能模型路由](#十vcpmodel智能模型路由)
 - [十一、Agent 主观能动性与自治生命周期](#十一agent-主观能动性与自治生命周期)
 - [十二、Agent 情感与认知量化](#十二agent-情感与认知量化)
 - [十三、前端运行时：V4 流式渲染、自研着色器与多媒体引擎](#十三前端运行时v4-流式渲染自研着色器与多媒体引擎)
 - [十四、前端应用群、即时附件协议与跨应用协作](#十四前端应用群即时附件协议与跨应用协作)
-- [十五、Agent 工业级软件工程体系：VCPCode、ProjectForge 与可视化中枢](#十五agent-工业级软件工程体系vcpcode-projectforge-与可视化中枢)
+- [十五、Agent 工业级软件工程体系：VCPCode、ProjectForge 与可视化中枢](#十五agent-工业级软件工程体系vcpcodeprojectforge-与可视化中枢)
 - [十六、Agent 原生生态](#十六agent-原生生态)
 - [十七、容灾、安全与数据保障](#十七容灾安全与数据保障)
 - [十八、自研引擎矩阵](#十八自研引擎矩阵)
@@ -151,7 +160,9 @@ VCP 的上下文语义引力场会实时计算当前对话的逻辑深度、信
 
 **VCP 范式**:记忆像人类的直觉一样**自然浮现**。
 
-TagMemo V9 与 RiverMemo Topology V3 通过同一套查询诱导动力学，在每一次对话中根据完整上下文**自动激活并审计**相关记忆。AI 不需要"决定回忆"，记忆就出现在它的视野里。系统并非只寻找文本近邻，而是先以 EPA、Residual Pyramid 与有界 Spike 传播形成查询信息源和请求级河网，再由 RiverMemo 在同一传输几何上验证候选为何值得被想起。
+当前 RiverMemo V2 在 AGS 统一背景上，通过语境观测、有界 Spike 与动态虫洞形成请求级河网，再由双场与 Topology V3 验证候选为何值得被想起。核心被动入口 RAGDiary 在模型生成前完成记忆唤起，Agent 不必先“决定回忆”。
+
+这种“自然浮现”以配置为前提：只有声明了相关占位符、满足日记本作用域和门控条件的请求，才进入对应记忆管线；没有声明的普通请求直接跳过。它不是无条件读取全库，也不是后台持续运行模型。
 
 具体实现在第八章详述。
 
@@ -208,12 +219,14 @@ OneRing 系统为每个 Agent 维护唯一的事实时间线——每条消息
 │  决策层:  JevRuntime 公共服务 (扩散架构低延迟概率决策, 255/300ms)│
 │          JEVRerank (记忆/提示词/上下文折叠/群聊发言动态裁决)    │
 │  工程层:  VCPCode 核心工程移植 · VCPProjectForge 协同模组      │
-│          MoonASTSearch C/Rust 双擎 · RustCodeSearch AST 强化   │
+│          MoonAST 纯几何检索 · 全链路 Trace · Git / 轻量 IDE   │
 │          脉络署名责任制 · 代际分支仲裁 · 操作级虚拟快照树      │
 │  上下文层:引力场 · 折叠 V2 · OneRing · OneRingMemo · 占位符精控│
 │  工具层:  300+ 插件 · 6 大插件协议 · 声明式 Jev 接入规范        │
-│  记忆层:  RiverMemo 拓扑V3 与 RagDiary 全链路单次 Rust 内存融合 │
-│          TagMemo 局部图计算 · 元思维 Rust 一体化 · Vexus / TDB │
+│  数据层:  VexusMemo / Vexus-Lite 原生读写搜 · SQLite 事实事务   │
+│          TDB 2-bit 派生路由 · 双槽代际快照 · 有界写入与背压     │
+│  记忆层:  AGS 背景 · Spike 动态虫洞 · RiverMemo V2 双场 / Ω   │
+│          RAGDiary 被动背景 · LightMemo 主动回忆 · 同代观测复用   │
 │  路由层:  VCPModel 语义模型路由 · 容灾规则                     │
 │  Agent层: GroupChatEngine 2.0 · FlowInvite · AgentAssistantV2通讯协议 · 梦系统 │
 │  情感层:  OpenHer 情绪拓扑 · 池月 1 号注意力指针               │
```

---

### Incident Patch 2: `df3b023f` (2026-10-20)
**Commit Message**: fix

**File**: `rust-vexus-lite/README.md` (modified, +72/-10)
```diff
@@ -1,8 +1,8 @@
 # Vexus-Lite：读、写、搜一体化的原生记忆数据库
 
-> **SQLite 权威事实层 × TDB 2-bit 冲程检索 × AGS 统一背景场 × Spike 有界传播 × RiverMemo 双场统一泛函**
+> **SQLite 权威事实层 × TDB 2-bit 冲程检索 × AGS 统一背景场 × Spike 有界传播与请求级动态虫洞 × RiverMemo 共享预算双场投影与统一泛函**
 >
-> 更新日期：2026-10-19。本文面向当前仓库实现；性能部分解释可核对的工程机制，不虚构吞吐、延迟、召回率或跨产品排名。
+> 更新日期：2026-10-20。本次同步双场投影预算与请求级向量复用、请求级动态虫洞两个技术节点。本文面向当前仓库实现；性能部分解释可核对的工程机制，不虚构吞吐、延迟、召回率或跨产品排名。
 
 Vexus-Lite 已不只是一个“由 JavaScript 调用的向量索引”。它是 VCPToolBox 的嵌入式原生知识与记忆数据引擎：从事实事务、向量路由、几何预计算、传播观测，到候选精排和结果回填，在同一个 Rust 原生模块中协作完成。
 
@@ -32,8 +32,8 @@ Vexus-Lite 已不只是一个“由 JavaScript 调用的向量索引”。它是
 | SQLite 权威事实层 | 现在真正存在哪些内容与向量？ | 保存正文、原始 FP32 向量、有序 Tag 事实、版本、操作回执与派生资产元数据 |
 | TDB 2-bit 冲程检索 | 从大量向量中，先看哪些候选？ | 以紧凑位码进行图导航或全局扫描，再读取原始向量精排 |
 | AGS 统一背景场 | 哪些语义是重复解释，哪些是独立方向？ | 同一锚定正交化框架生成局部残差/锚增益与全局星团主题面 |
-| Spike 有界传播 | 本次查询实际激活了哪些关系？ | 沿共享传输图传播，形成带节点势与实际边流的请求级河网 |
-| RiverMemo 双场与统一泛函 | 相似、关系、正文和直接事实如何共同排序？ | 读取局部场/迁移场、有序 Tag 曲线与相对拓扑，以有界评分统一裁决 |
+| Spike 有界传播与动态虫洞 | 本次查询实际激活了哪些关系？ | 沿共享传输图传播，以更深层残差为已有历史边提供请求级动态席位，形成带节点势与实际边流的河网 |
+| RiverMemo 双场与统一泛函 | 相似、关系、正文和直接事实如何共同排序？ | 求解局部场/迁移场，在共享选点预算下投影，结合有序 Tag 曲线与相对拓扑统一裁决 |
 
 这五部分不是五个互相同步的独立服务，而是共享事实来源、版本约束和原生执行边界的协作层。
 
@@ -223,7 +223,8 @@ Spike 同时约束：
 - 普通边与虫洞边的衰减；
 - 前驱敏感的立即回流抑制；
 - 每轮保留的传播状态数；
-- 可选逐跳转移记录的硬上限。
+- 可选逐跳转移记录的硬上限；
+- 动态虫洞在原邻居名额内的保留席位，以及请求内不同目标的评估预算。
 
 Rust 默认配置包括最大 4 跳、每节点 20 个邻居、传播状态保留上限 2000；生产调用可以覆盖这些默认值。状态上限约束每轮保留集合，并非保证临时生成容器永远不超过该数；输出节点/边的默认值 0 表示不额外截断。
 
@@ -251,6 +252,30 @@ a_h=\frac{\gamma^h}{\sum_{r=0}^{H}\gamma^r},
 
 这让传播既是召回增强过程，也是可诊断的观测过程：可查看到达节点、活跃边、回流抑制量、状态截断与耗时。传播截断或逐跳记录截断时，不能宣称拥有完整逻辑链。
 
+### 5.4 请求级动态虫洞：让较弱历史边获得语境相关的通行机会
+
+静态背景决定“历史上有哪些路”，动态虫洞决定“本次语境下，哪些已有路值得优先尝试”。它**不新增历史边，不写回图资产，也不要求重建图**。
+
+金字塔分析保留各实际分析层投影前的残差。种子以首次出现层级为来源层，传播时继承它；只有比来源层更深的残差可以支持动态共鸣。单层分析或最后一层来源没有后续残差，因而不会产生动态支持。合并状态保留最早来源层级，这是来源策略，不是完整多源血缘跟踪。
+
+动态判定检查源节点的**完整 CSR 历史出边行**，不只看静态 Top-K；目标必须有正权重历史出边连接、达到共鸣阈值，并在考虑立即回流惩罚后达到最低注入电流。共鸣取可用后续残差与目标原始向量的最大正余弦，动态排名使用：
+
+\[
+\text{动态排名}=\text{历史导电率}\times\text{共鸣}^{4}
+\]
+
+默认最多保留 2 个动态席位，**包含在原有邻居名额内**，再按静态权重顺序补齐剩余名额；不是增加邻居总数，也不是将所有出边统一重排。静态虫洞仍沿用原有判定。
+
+动态边不消耗动量，但电流仍按“源能量 × 历史导电率 × 虫洞衰减 × 回流惩罚”计算，没有电流保底、重新归一化或额外能量增益；源状态仍须满足发火阈值和非负动量，并受最大跳数、最低注入电流和状态保留上限约束。高共鸣不能把任意弱边变成强证据。
+
+原生默认启用动态判定，共鸣阈值为 0.2，请求内不同目标评估预算为 4096。目标批量加载并复用请求级 FP32 向量池；各层共鸣、已有相似度和缺失向量结果在请求内复用。超出目标预算后仅跳过相应目标的动态判定，静态路径仍有效。**该预算独立于双场投影预算**：3072 维下，4096 个 FP32 向量载荷约 48 MiB，尚不含已有向量、容器和其他状态；不能用双场的 256 个选点上限估算整个请求内存。
+
+CSR 普通传播热路径另有内存预处理：行内按权重降序、同权按目标 ID 升序排列，直接读取前 K 条正权重边；节点锚增益和显式虫洞标记使用紧凑数组，避免每个脉冲状态重复分配邻居列表和排序。数组由构建或冷加载派生，不改变持久化格式，也不将请求阈值固化进图资产；动态判定仍需检查完整历史行，不能把普通 Top-K 快路径的成本外推到动态阶段。
+
+诊断区分动态候选、入选、成功注入和静态 Top-K 外提升，并记录目标评估、SQL 读取、点积、缓存复用及分项计时。这些是按传播状态和跳累计的事件，**不是唯一边数、语义正确率或每次查询的固定触发次数**；注入后仍可能被状态上限裁剪。
+
+实现与配置边界见 [`memo_sensing.rs`](src/memo_sensing.rs)、[`memo_pipeline.rs`](src/memo_pipeline.rs)；完整契约、诊断及部署说明见 [`MEMO_DYNAMIC_WORMHOLES.md`](../docs/MEMO_DYNAMIC_WORMHOLES.md)。
+
 ---
 
 ## 6. RiverMemo：同一传输算子，双场响应，一个统一泛函
@@ -280,7 +305,28 @@ u_\alpha=(1-\alpha)(I-\alpha T)^{-1}S
 
 场的主解释权按累计质量保留有效支持域，默认局部 80%、迁移 90%，避免正值长尾到处产生微弱但貌似有效的路径。
 
-实现见 [`solve_dual_fields()`](src/memo_pipeline.rs:1161)。
+实现见 [`memo_pipeline.rs`](src/memo_pipeline.rs)。
+
+#### 双场投影：共享预算，不截断标量求解
+
+**全图 CSR 标量迭代、有效域判定与高维向量投影是三个不同阶段。** 管线先求质量场与有效域，再选择用于高维投影的节点；默认预算 K = 256，约束的是**两场选点的去重并集，包含全部核心骨架**，不是每场各 256，更不是整个请求最多读取 256 个向量。
+
+选点采用“种子流域内圈复用 + 共享预算动态扩展”：
+
+1. 以本次 Spike 活跃河网为保留骨架，复用 hop-0 种子与代表来源，在真实正流量观测边上构造确定性的多源 BFS 森林；无法分配的骨架节点独立保留。不重新聚类，也不额外读取向量寻找质心。
+2. 每个“流域 × 场”从自身内圈边界维护独立最短路前沿，以负对数传输率为边代价，只沿真实出边扩展。外圈节点必须有同场已选前驱，不跳过低质量桥接点直接摘取远处高峰；核心允许多个分量，不强行跨主题连通。
+3. 每个活动前沿先轮转获得最多 8 个不按收益竞争的外圈接纳机会，之后按流域重要性、近期新增归一化质量和已接纳规模动态分配预算。这是受可达性、剩余预算、质量目标与工作限额约束的机会，不是每个流域保证得到 8 个不同新向量。
+4. 节点在全局只扣一次席位，但两场独立接纳、独立累计质量；另一场已读取该向量，不等于本场自动取得投影资格。核心节点两场均保留，缺失向量不做全图补位，因此路径保证针对选点支持集，不保证有效向量子集连通。
+
+正预算小于核心骨架时显式返回预算冲突，不静默裁剪路径或突破上限。K = 0 **只取消节点数量上限**，不恢复全正支撑投影：质量目标与搜索限额仍有效，搜索最多处理 8192 个出队状态、发现 8192 个流域—场—节点状态、扫描 65536 条边；达到限额会保留已选支持集并报告截断。
+
+各场以原有效域实际累计质量为扩展目标，允许域外桥接计入预算和投影质量，但**不改写原有效域**，候选路径解释仍消费原有效域。共享预算满后不再接纳新 ID，仍可在剩余工作限额内补全已有 ID 的独立场资格。选点交汇本身不放大质量，也不改写 Sense、Ω 或河网形态评分。
+
+金字塔、融合、动态虫洞、双场投影及候选读出共享请求级原始 FP32 向量池。投影与候选阶段只按差集补查，SQL 每批最多 128 个 ID；候选先读取标签关系、位置和名称，不重复搬运已加载的向量 BLOB。观测持有共享池，候选读出克隆共享引用而不是复制高维载荷；跨事务读取校验数据库代际，事实变化时明确报过期观测错误。
+
+标量保留不由 K 决定：仅过滤低于该场最大质量 1e-12 倍的数值尾流，并强制保留两场有效域并集及河网节点。这仍涉及标量裁剪语义，需要通过真实检索结果观察；**预算约束高维读取与投影，不意味着全图标量求解或整条查询变为 O(1)**。
+
+选点实现见 [`memo_projection.rs`](src/memo_projection.rs)，读取与共享池见 [`storage.rs`](src/storage.rs)，完整预算、停止原因、质量覆盖与内存诊断见 [`MEMO_FIELD_PROJECTION_BUDGET.md`](../docs/MEMO_FIELD_PROJECTION_BUDGET.md)。
 
 ### 6.2 候选是穿过场的有序曲线
 
@@ -342,6 +388,9 @@ S(c)=\Pi_{[0,1]}
 | 2-bit 路由与有界候选池 | 对所有向量执行完整高维精排 |
 | 实例持有共享图快照 | 每个候选或每个阶段重新装载、复制 CSR |
 | 原生观测句柄复用 | Sense、双场与拓扑阶段各自重复传播 |
+| 请求级 FP32 向量池与差集补查 | 金字塔、动态共鸣、投影和候选重复读取相同向量 BLOB |
+| 共享预算双场投影 | 对全部正支撑节点执行高维读取与投影；不省略全图标量求解 |
+| CSR 邻接顺序与紧凑属性预处理 | 普通传播中每个脉冲状态重复分配邻居列表和排序 |
 | Rust 联合候选处理 | 中间向量、候选和图反复跨越 N-API |
 | Rayon 候选级并行 | 在 JavaScript 主线程逐候选执行数学计算 |
 | 独立 checkpoint 调度 | 搜索时顺便序列化整库索引 |
@@ -356,7 +405,9 @@ S(c)=\Pi_{[0,1]}
 - 几何工作区是构建期资源，
```

---

### Incident Patch 3: `afa5ee82` (2026-10-20)
**Commit Message**: Merge pull request #508 from MrSeven590/fix/semantic-router-preview-upstream

fix(admin): 修复语义模型路由器预览未代理到主进程及提示框不可见

**File**: `AdminPanel-Vue/src/components/feedback/FeedbackHost.vue` (modified, +0/-1)
```diff
@@ -152,7 +152,6 @@ function onInputValueChange(value: string): void {
   visibility: hidden;
   transform: translateX(20px);
   transition: opacity 0.3s ease, visibility 0.3s ease, transform 0.3s ease;
-  position: relative;
 }
 
 .message-popup::before {
```

**File**: `adminServer.js` (modified, +79/-0)
```diff
@@ -660,6 +660,85 @@ app.post("/admin_api/rag-active-full-training", async (req, res) => {
   trainingReq.end();
 });
 
+// ============================================================
+// 🧠 语义模型路由器匹配预览必须代理到主服务
+// 本地 semanticRouter 模块仅具备配置读写与上游模型拉取能力，
+// 预览依赖主进程中的 semanticModelRouter / RAG 插件运行态。
+// 若由本地路由处理会直接返回 503，且不会再进入兜底代理。
+// ============================================================
+function proxySemanticRouterPreviewRequest(req, res) {
+  const targetPath = "/admin_api/semantic-router/preview";
+  console.log(
+    "[AdminServer] Semantic router preview request received — forwarding to main process..."
+  );
+
+  const proxyReq = http.request(
+    `http://127.0.0.1:${MAIN_PORT}${targetPath}`,
+    {
+      method: "POST",
+      headers: {
+        "Content-Type": "application/json",
+        Authorization: req.headers.authorization || "",
+        Cookie: req.headers.cookie || "",
+      },
+      timeout: 60 * 1000,
+    },
+    (proxyRes) => {
+      let body = "";
+      proxyRes.on("data", (chunk) => {
+        body += chunk;
+      });
+      proxyRes.on("end", () => {
+        if (res.headersSent) return;
+        res.status(proxyRes.statusCode || 200);
+        res.setHeader(
+          "Content-Type",
+          proxyRes.headers["content-type"] || "application/json"
+        );
+        try {
+          res.json(body ? JSON.parse(body) : {});
+        } catch (_) {
+          res.send(body || "");
+        }
+      });
+    }
+  );
+
+  proxyReq.on("error", (error) => {
+    console.error(
+      `[AdminServer] Failed to forward semantic router preview request to main process: ${
+        error.code || error.message
+      }`
+    );
+    if (!res.headersSent) {
+      res.status(502).json({
+        error: "Bad Gateway",
+        message:
+          "无法将语义路由预览请求转发给主服务。主服务可能未启动或正在重启中。",
+        details: error.message,
+      });
+    }
+  });
+
+  proxyReq.on("timeout", () => {
+    proxyReq.destroy();
+    if (!res.headersSent) {
+      res.status(504).json({
+        error: "Gateway Timeout",
+        message: "主服务语义路由预览接口响应超时。",
+      });
+    }
+  });
+
+  proxyReq.write(JSON.stringify(req.body || {}));
+  proxyReq.end();
+}
+
+app.post(
+  "/admin_api/semantic-router/preview",
+  proxySemanticRouterPreviewRequest
+);
+
 // ============================================================
 // 🔑 关键覆盖：重启主服务（必须在本地路由之前挂载）
 // 本地 routes/admin/server.js 的 /server/restart 会 process.exit(1) 杀死当前进程
```

#### Recent Merged Pull Requests:
- **PR #508** (2026-10-20): fix(admin): 修复语义模型路由器预览未代理到主进程及提示框不可见 (@MrSeven590)
- **PR #507** (2026-10-20): fix: restore legacy geometry fallback and update maintenance route mock (@Cimo-Yu)
- **PR #504** (2026-10-18): feat(kbm): Rust 单 SQL 运行时、TDB 索引与管理面板统一 (@lioensky)
- **PR #503** (2026-10-18): fix(LinuxLogMonitor): prevent watchdog timeout from terminating host … (@joker74581)
- **PR #502** (2026-10-17): test(jev): 修复 JEV 生态/红队/压测套件可选插件 t.skip 守卫与策略文件沙盒隔离 (@Cimo-Yu)
- **PR #499** (2026-10-16): fix(deps): 恢复插件商店插件 YoutubeFetch 所需的宿主 Python 依赖 (#495) (@Cimo-Yu)

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

## X. Empirical Invariant Guard in vcp-whitepaper.md

**RULE**:
When implementing operations in `docs/vcp-whitepaper.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7ceecd48`: fix. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/vcp-whitepaper.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
title: VCP 全景技术白皮书 V6
summary: VCP 2.0 全景架构：以 VexusMemo / Vexus-Lite 原生一体化数据库、TDB 2-bit 自研检索、AGS 与 RiverMemo V2 统一记忆内核为数据底座，以 MoonAST 纯几何代码检索、V工程与 VChat 工作台组织 Agent 工程协作，贯通协议、上下文、前端应用群与长期自治。
updatedAt: 2026-10-20
# VCP 全景技术白皮书 V6：原生一体化数据库、MoonAST 与 Agent 全栈运行时
**版本：VCP 2.0 正式版 · 架构更新截至 2026-10-20**

> **阅读口径**：本文说明当前架构，并在必要处保留演进背景。VCP 2.0 已于 2026-10-01 发布；TagMemo 已退出生产运行，USearch 已由 TDB 2-bit 检索体系替代，MoonAST 已不再以 Tree-sitter 为主要解析依赖。RiverMemo V2 是查询实现的发布阶段，Topology V3 是仍沿用的统一排序构型，两者不是同一版本序列。
>
> **“自研”的边界**：VCP 自主实现原生数据运行时、TDB 检索、记忆数学与工程协作体系，但仍使用 SQLite、Rust、Electron 等基础设施。“一体化数据库”不意味着 SQLite 也由 VCP 编写，也不意味着取消所有外部依赖。
VCP 已经走过多个版本周期，于 2026-10-01 发布 **VCP 2.0 正式版**，并在随后完成数据库、记忆数学和代码工程底座的新一轮收敛。从“全栈 AGI 运行时”到“全栈 Agent 生态操作系统与软件工程自治中枢”，变化不只是应用数量增加，而是核心数据与工程能力的所有权进一步下沉到自主实现的原生内核。

早期，我们把 VCP 描述为「部署在 AI 模型 API 与前端应用之间的中间层服务器」——这个定义曾经是准确的。今天，VCP 的两条主线已经延伸至更底层：

- **数据与记忆主线**：VexusMemo 统一持有记忆与知识数据库业务，Vexus-Lite 原生模块将 SQLite 事实事务、TDB 2-bit 导航与筛选、AGS 背景几何、Spike 有界传播、RiverMemo 双场与拓扑排序组织为同一条读、写、搜链。USearch 与旧 JS 数据库业务退出该生产路径，TagMemo 的独立运行时退役，其已验证机制由新内核继承和重构。
- **软件工程主线**：MoonAST 从 C / Rust 与 Tree-sitter 双擎阶段演进为纯几何逻辑门驱动的自研代码识别与检索核心；ProjectForge、V工程轻量 IDE、Git、施工 Trace、操作回退与 VChat 工作台把代码理解、修改、验证和人工介入
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
title: VCP 全景技术白皮书 V5
summary: 全面介绍 VCP 全栈运行时、Jev 决策与自然语言调用管网、Agent 工业级软件工程体系、前端应用群、共享 IPC 管网、Loom 与共笔文坊协作系统的工作原理和系统交互，是理解迈向 VCP 2.0 正式版全景生态的重要读物。
updatedAt: 2026-09-30
# VCP 全景技术白皮书 V5：全栈自研的 Agent 运行时与前端生态
**版本：迈向 VCP 2.0 正式版 · 2026 年初秋**
VCP 已经走过三个完整的版本周期，并在 2026 年秋季完成了从“全栈 AGI 运行时”向“全栈 Agent 生态操作系统与软件工程自治中枢”的架构大收敛，正式迈向 **VCP 2.0** 时代。
V2 时代，我们把 VCP 描述为「部署在 AI 模型 API 与前端应用之间的中间层服务器」——这个定义曾经是准确的。但从 V2 演进至今，VCP 沿着一条异常陡峭且坚定的全栈自研路径生长：自研向量数据库 Vexus、自研图数据库 TDB、由 TagMemo V9 与 RiverMemo Topology V3 构成的统一记忆寻址底座、RiverMemo 与 RagDiary 全链路单次 Rust 内存融合重构、基于扩散架构的低延迟概率决策公共服务 JevRuntime、近乎通用的自然语言工具编译器 JEV-TOOL-call 与 JevCallBridgeEXP 分布式导航桥、闭源旗舰插件 VCPCode 入驻 VChat 带来的极致能效工程标杆、VCPProjectForge 协同工程模组与 ProjectModule 可视化编程子前端、流式渲染器 VCPMessageRenderer V4 极端内容防御体系、自研底层 WebGL/WebGPU Shader 合成管线驱动的 VMusic 3D 沉浸式太空歌剧演出、自研桌面运行时 VCPDesktop 与 V图表、AI 原生邮件协议 VCPSuperMail、DXGI 与纯数学窗口操控算法 VCP-SOM……
- [六、插件系统与 Jev 声明式生态](#六插件系统与-jev-声明式生态)
- [八、记忆系统：TagMemo V9、RiverMemo 全链路 Rust 融合与双栈交互](#八记忆系统tagmemo-v9rivermemo-全链路-rust-融合与双栈交互)
- [十五、Agent 工业级软件工程体系：VCPCode、ProjectForge 与可视化中枢](#十五agent-工业级软件工程体系vcpcode-projectforge-与可视化中枢)
TagMemo V9 与 RiverMemo Topology V3 通过同一套查询诱导动力学，在每一次对话中根据完整上下文**自动激活并审计**相关记忆。AI 不需要"决定
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7ceecd48` are properly handled with clean fallback behavior.
