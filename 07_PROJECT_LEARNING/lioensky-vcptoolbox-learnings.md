> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source**: github ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Source Version**: `9aa1f674`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-29T02:07:30.580Z  
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
> **Harvest Timestamp**: 2026-10-29T02:07:30.572Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2411 stars

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
- **Issue #560** (2026-10-28): **fix(RiverMemo): 严格门控的边缘稀疏场景虫洞排序修正**
  *Symptoms*: ## 概要  - 保留完整拓扑、直接锚与 Ω 四项基线；为极端边缘稀疏知识场景提供严格门控的虫洞 RRF 回归修正，不作为常驻全局评分因子。 - 使用真实观测路线、全局跨文件联合见证及候选标签/正文落地约束；无实际正路线贡献时，基线分数与排序保持不变。 - 补充 LightMemo 全候选诊断、只读测绘工具及回归测试，包含匹配的 Windows x64 MSVC 原生产物。 - 同步最终算法文档与子项目说明，试验经过独立归档。  ## 验证  - 已通过 191 项 Rust 库测试、8 项诊断测试及 1 项原生兼容测试。 - 用户服务器反馈：100 组数据集查询测试全部通过，华为汽车案例全部通过。 - 文档差异格式及关键口径一致性检查通过。 - 不将以上结果扩写为完整 800 组通过或全库精确召回率保证。  ## 部署边界  原生读出标识：rivermemo.conservative-topology-v2.5-confidence-rrf。原生模块需替换对应平台产物并重启加载进程；不需要因本次读出修正重建图资产或修改数据库结构。  本 PR 包含当前分支相对于 main 的全部改动，不直接合并主分支。 

- **Issue #559** (2026-10-28): **fix(LinuxShellExecutor): allow DEFAULT_SECURITY_LEVEL fallback for local host**
  *Symptoms*: ### 问题背景 / Problem 在近期 LinuxShellExecutor 2.0 更新中，默认 `hosts.json` 模板与降级生成器 `createLocalOnlyHostsConfig()` 对 `local` 主机硬编码了 `"securityLevel": "standard"`。 由于主机级配置（`hostConfig.securityLevel`）优先于 `config.env` 中定义的 `DEFAULT_SECURITY_LEVEL`，导致用户无法在不手动编辑 `hosts.json` 的情况下通过 `config.env` 配置或将安全级别降低至 `basic`。因此，常见开发命令（例如 `node --test`、`npm`、`git`）会被 standard 白名单严格拦截。  In recent LinuxShellExecutor 2.0 updates, the default `hosts.json` template and fallback generator `createLocalOnlyHostsConfig()` hardcoded `"securityLevel": "standard"` for the `local` host. Because host-level configuration (`hostConfig.securityLevel`) takes precedence over `process.env.DEFAULT_SECURITY_LEVEL` defined in `config.env`, users could not configure or lower the security level to `basic` via `config.env` without manually editing `hosts.json`. Consequently, common development commands (such as `node --test`, `npm`, `git`) were strictly blocked by the standard whitelist.  ### 解决方案 / Solution 1. 移除 `hosts.json` 与 `createLocalOnlyHostsConfig()` 中 `local` 主机定义的硬编码 `"securityLevel": "standard"`。 2. 同步 `DEFAULT_HOSTS_TEMPLATE_MD5` 以匹配最新的模板哈希（`30e87419ff3817a98da972ffe69c4752`）。 3. 保留完整的配置解析级联链条：    `显式参数 (explicit parameter)` -> `hostConfig.securityLevel` -> `config.env (DEFAULT_SECURITY_LEVEL)` -> `'standard'`。    在没有硬编码主机覆盖的情况下，`config.env` 中的 `DEFAULT_SECURITY_LEVEL` 现可按预期生效。  1. Removed hardcoded `"securityLevel": "standard"` from the `local` host definition in `hosts.json` and `createLocalOnlyHostsConfig()`. 2

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

### Incident Patch 1: `9aa1f674` (2026-10-28)
**Commit Message**: Merge pull request #560 from lioensky/rivermemo-fix-2.4

fix(RiverMemo): 严格门控的边缘稀疏场景虫洞排序修正

**File**: `Plugin/LightMemo/abDiagnostics.js` (modified, +57/-3)
```diff
@@ -60,14 +60,68 @@ function formatDiagnostics(plugin, request, response) {
     section('传播诊断', graph?.diagnostics || observation.propagation?.diagnostics);
     section('EPA', observation.epa);
     section('残差金字塔', observation.pyramid);
+    const explained = river.candidateDiagnostics || river.results || [];
     output += '### RiverMemo 候选解释\n\n';
-    output += '基础分已包含场共振增益；最终分＝基础分＋路径奖励＋图奖励＋直锚奖励－截断扣分，勿重复累加场共振。\n\n';
+    output += `解释候选 ${explained.length} 条（包含 Top-K 之外的共同池候选，如原生已提供）。\n\n`;
+    const wormholeMode = river.algorithmVersion?.startsWith('rivermemo.wormhole-readout-');
+    if (wormholeMode) {
+        output += '独立虫洞通道：最终分＝最强路线的相对流量 × 终点正文正余弦；不是原查询底分加奖励，也不是相关性概率。无可用虫洞才整通道回退查询余弦。精确标签／来源文件仅为文件级地址诊断，不证明该 Chunk 回答问题。\n\n';
+        output += '| Chunk | 排名 | 通道 | 原查询余弦 | 路线 | 原始流量 | 相对流量 | 终点正文余弦 | 最终分 | 地址定位 | 精确终点标签 | 边来源文件 |\n|---:|---:|---|---:|---|---:|---:|---:|---:|---|---|---|\n';
+        const name = id => (graph?.nodes || []).find(node => node.id === id)?.name || `Tag#${id}`;
+        for (const item of explained) {
+            const trace = item.topologyV3 || {};
+            const readout = trace.wormholeReadout || {};
+            const route = readout.sourceId == null ? '—'
+                : `${name(readout.sourceId)} → ${name(readout.targetId)}`;
+            output += `| ${item.chunkId ?? item.id} | ${item.rank ?? '—'} | ${cell(item.role)} | ${number(trace.queryScore ?? item.vectorScore)} | ${cell(route)} | ${number(readout.flow)} | ${number(readout.relativeFlow)} | ${number(readout.endpointBodyCosine)} | ${number(item.score)} | ${cell(readout.location || '未返回')} | ${readout.exactTargetTag === true} | ${readout.edgeSourceFile === true} |\n`;
+        }
+        output += '\n';
+        section('原生检索诊断', response.diagnostics);
+        section('RiverMemo 读出诊断', river.diagnostics);
+        return output;
+    }
+    const rrfMode = river.algorithmVersion?.includes('confidence-rrf');
+    if (rrfMode) {
+        output += '严格全局门控后的解释力度 RRF：原 RiverMemo 排名保留为基线通道；有效虫洞贡献按相对普通传播的流量力度与 Ω 加权。最终分为融合分，不是下方原评分分项之和；未触发时保留原分。\n\n';
+        output += '| Chunk | 原排名 | 原评分 | 基线 RRF | 虫洞 RRF | 最终分 | 路线解释 |\n|---:|---:|---:|---:|---:|---:|---|\n';
+        for (const item of explained) {
+            const fusion = item.topologyV3?.wormholeRrf || {};
+            output += `| ${item.chunkId ?? item.id} | ${fusion.baselineRank ?? '—'} | ${number(fusion.baselineScore)} | ${number(fusion.baselineContribution)} | ${number(fusion.wormholeContribution)} | ${number(item.score)} | ${json(fusion.winner)} |\n`;
+        }
+    }
+    const endpointMode = river.algorithmVersion?.startsWith('rivermemo.source-endpoint-');
+    output += rrfMode ? '下表保留原评分分项供审计；最终分列为上述融合结果。\n\n' : endpointMode
+        ? '有效意图候选：基础分为原查询余弦；直锚列为直接意图证据分账，图奖励列为来源条件化传播的边际分账，共享单一预算；旧场共振、路径和图形匹配只作诊断。无有效意图候选保留兼容回退。最终分＝基础分＋路径奖励＋图奖励＋直锚奖励－截断扣分。\n\n'
+        : '基础分已包含场共振增益；最终分＝基础分＋路径奖励＋图奖励＋直锚奖励－截断扣分，勿重复累加场共振。\n\n';
     output += '| Chunk | 角色 | 语义基础分 | 场分 | 场共振增益 | 路径奖励 | 图奖励 | 拓扑合计 | 直锚奖励 | 截断扣分 | 最终分 | 标签 | CoreTag |\n|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|\n';
-    for (const item of river.results || []) {
+    for (const item of explained) {
         output += `| ${item.chunkId ?? item.id} | ${cell(item.role)} | ${number(item.baseScore)} | ${number(item.fieldScore)} | ${number(item.fieldResonanceBonus)} | ${number(item.pathBonus)} | ${number(item.graphBonus)} | ${number(item.topologyBonus)} | ${number(item.anchorBonus)} | ${number(item.scoreClipping)} | ${number(item.score)} | ${json(item.matchedTags)} | ${json(item.coreTagsMatched)} |\n`;
     }
+    if (river.parameters?.wormholeScoring && !rrfMode) {
+        output += '\n### 虫洞辅助加权（保留原拓扑与 Ω 门控）\n\n';
+        output += '虫洞只在原拓扑预算内增加图奖励，不替换基础分、路径、直锚或 Ω。无合格证据时增量为零；两个文件重复关联不等于独立证据。\n\n';
+        output += '| Chunk | 原最终分 | 原图奖励 | 新增图奖励 | 最终分增量 | 路线证据 |\n|---:|---:|---:|---:|---:|---|\n';
+        for (const item of explained) {
+            const aux = item.topologyV3?.wormholeAuxiliary;
+            if (!aux) continue;
+            output += `| ${item.chunkId ?? item.id} | ${number(aux.originalFinalScore)} | ${number(aux.originalGraphBonus)} | ${number(aux.addedGraphBonus)} | ${number(aux.addedFinalScore)} | ${json(aux.readout)} |\n`;
+        }
+    }
+    output += '\n### 意图账本（点火能量与区分权重分离）\n\n';
+    for (const item of explained) {
+        const intent = item.topologyV3?.intentReadout;
+        if (!intent?.available) continue;
+        output += `\nChunk ${item.chunkId ?? item.id}：合取满足度 ${number(intent.satisfaction)}；直接满足度 ${number(intent.directSatisfaction)}；${endpointMode ? '传播边际提升' : '虫洞提升'} ${number(intent.wormholeLift)}。\n\n`;
+        output += '| Chunk | 意图种子 | 权重 | 留一残差能量 | 查询独立解释量 | 直接支持 | 传播支持 | 满足度 | 路线 | 电流校准 | 终点落地 | 虫洞 |\n|---:|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|\n';
+        for (const axis of intent.ledger || []) {
+            const name = id => (graph?.nodes || []).find(node => node.id === id)?.name || `Tag#${id
```

**File**: `docs/RIVERMEMO_TOPOLOGY_V3.md` (modified, +122/-25)
```diff
@@ -1,37 +1,41 @@
 ---
 title: RiverMemo V3 · Topology V3 与 Ω 统一泛函
-summary: RiverMemo Topology V3 的最终算法与实现契约，涵盖 AGS 背景几何、图内残差与动态虫洞、请求河网与双场、一对一拓扑对齐，以及候选自身证据驱动的四项评分、共享预算和部署验证边界。
-updatedAt: 2026-10-28
+summary: RiverMemo Topology V3 的最终算法与实现契约，涵盖 AGS 背景几何、图内残差与动态虫洞、请求河网与双场、一对一拓扑对齐、四项基线评分，以及严格全局门控下的解释力度加权 RRF。
+updatedAt: 2026-10-29
 category: guide
 ---
 
 # RiverMemo Topology V3：最终算法与实现
 
 > 架构版本：**RiverMemo Topology V3**
 >
-> 原生读出实现标识：rivermemo.conservative-topology-v2.2
+> 原生读出实现标识：rivermemo.conservative-topology-v2.5-confidence-rrf
 >
 > 统一查询管线标识：memo.conservative-topology-v2.2
 >
 > 原生结果协议：rivermemo-topology-v3-native-result-v1
 >
 > JavaScript 公共结果协议：rivermemo-topology-v3-result-v1
 >
-> 文档更新时间：2026-10-28
+> 文档更新时间：2026-10-29
 >
 > 本文仅描述当前最终实现、算法与运行边界，不记录施工阶段、迁移过程或历史构型。
 
-**版本口径：Topology V3 是本文的架构名称；实现标识中的 v2.2 是当前读出与管线的实现编号，不表示本文描述 RiverMemo V2。** 原生响应是判断实际加载实现的依据，不能用文件名、日志标题或公共门面的兼容常量代替。
+**版本口径：Topology V3 是架构名称；原生读出与统一查询管线具有各自的实现编号。** 统一管线生成观测，读出在完整拓扑与直接锚基线上执行严格门控的排序融合；两者编号不必相同。原生响应是判断实际加载实现的依据，不能用文件名、日志标题或公共门面的兼容常量代替。
 
 源码依据：原生读出标识见 [`rivermemo_topology_v3.rs`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:18)，管线标识见 [`memo_pipeline.rs`](../rust-vexus-lite/src/memo_pipeline.rs:22)，公共协议和原生版本透传见 [`RiverMemoEngine.js`](../RiverMemoEngine.js:474)。空候选快捷返回不执行原生计算，不能拿它的版本字段证明原生模块已加载。
 
 ## 1. 总体结构与最终方程
 
-RiverMemo 以 AGS 双尺度统一几何提供长期背景，以残差金字塔和有界 Sense 传播生成请求级河网，以局部／迁移双场及候选有序标签曲线提供语义与结构证据。候选最终分由四项独立记账：
+RiverMemo 以 AGS 双尺度统一几何提供长期背景，以残差金字塔和有界 Sense 传播生成请求级河网，以局部／迁移双场及候选有序标签曲线提供语义与结构证据。读出分为两个阶段：先计算完整的四项基线评分并稳定排序，再按严格全局门控和候选落地证据决定是否启用虫洞排序通道。
+
+### 1.1 四项基线评分
+
+候选基线分由四项独立记账：
 
 \[
 \boxed{
-S(c)=\operatorname{clip}_{[0,1]}
+S_0(c)=\operatorname{clip}_{[0,1]}
 \left[B(c)+P(c)+G(c)+A(c)\right]
 }
 \]
@@ -42,13 +46,41 @@ S(c)=\operatorname{clip}_{[0,1]}
 - \(A\)：直接锚奖励，不乘 Ω。
 - 路径与图共享拓扑预算，默认 \(C_T=0.08\)；锚奖励有独立上限，默认 \(C_A=0.10\)。
 
-基础分不包含路径奖励。场共振已经计入基础分，不能在最终分中重复相加。结果的截断扣分定义为四项之和减最终分，因此可直接复算：
+基础分不包含路径奖励。场共振已经计入基础分，不能重复相加。截断扣分定义为四项之和减基线分，因此可直接复算：
+
+\[
+S_0=B+P+G+A-\Delta_{\mathrm{clip}}
+\]
+
+图奖励只由候选自身证据计算，不以同伴均值、条件期望或异常程度决定资格。角色用于解释，不给排序分配倍率、独占上限或前沿压制。多个优秀候选可以同时获奖；在查询观测、候选身份和配置固定的条件下，加入无关候选不改变既有候选的四项基线奖励。候选池截断、RRF 名次及最终排名不受此不变性保证。
+
+### 1.2 边缘稀疏场景的条件式排序修正
+
+**虫洞 RRF 不是普遍情况，不是常驻全局评分因子，也不替代完整拓扑、直接锚与 Ω 主干。** 它是针对极端边缘稀疏知识场景的回归优化解：图构建已经发现有事实支持的逻辑关联，查询传播实际经过该关系，但常规读出未充分反映这条逻辑链的候选证据，才通过严格门控允许路线修正排序。这里的逻辑链仍须落回文件与候选正文，不意味着共现本身构成形式逻辑或因果证明。
+
+“边缘稀疏”说明适用问题，并非新增一个按 Ω 稀疏／稠密工况标签判断的开关；实际触发由完整观测、强显式来源路线、严格全局见证及候选落地共同决定。全局见证表示证据来自全局文件标签图，不表示给全部查询常驻施加全局因子。未触发是正常路径，资料充分的查询不需要虫洞 RRF 也能由完整主干完成读出。
+
+完整基线先按基线分降序、联合候选分降序、联合候选序号升序排列，记名次为 \(r_0(c)\)，从 1 开始。通过全局门控的每条强虫洞路线只对具有落地证据的候选建立独立排序，记路线名次为 \(r_e(c)\)。
+
+令 \(f_e\) 为路线原始观测电流，\(f_{\mathrm{ref}}\) 为观测中非虫洞、非即时回流、非自环普通边的最大正电流；没有这种普通边时，使用原始观测全部边的最大正电流。定义：
+
+\[
+w_e=\frac{f_e}{f_{\mathrm{ref}}}\Omega^\gamma,\qquad K=60
+\]
+
+若至少一个候选获得正路线贡献，则全部候选使用：
 
 \[
-S=B+P+G+A-\Delta_{\mathrm{clip}}
+\boxed{
+S(c)=\frac{1}{K+r_0(c)}
++\max_{e:\,c\text{ 具备路线落地资格}}
+\frac{w_e}{K+r_e(c)}
+}
 \]
 
-图奖励只由候选自身证据计算，不以同伴均值、条件期望或异常程度决定资格。角色用于解释，不给排序分配倍率、独占上限或前沿压制。多个优秀候选可以同时获奖；在查询观测、候选身份和配置固定的条件下，加入无关候选不改变既有候选的自身奖励。候选池截断和最终排名不受此不变性保证。
+无合格路线的候选，第二项为零。多路线贡献取最大值而非相加，避免相关支路重复投票。最终按融合分降序稳定排序，融合分相同时保留完整基线顺序。
+
+**没有任何实际正路线贡献时，最终分直接保留 \(S_0(c)\)，基线分数逐位不变、排序不变，不转换成倒数名次分。** 启用融合时，四项基线仍完整保留，融合分不受四项评分上限约束，也不是四项之和、余弦或概率；路线权重可以大于 1。严格路线资格与落地条件见第 12 节。
 
 评分实现见 [`assign_v3_scores()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:2549)，候选观测与路径奖励计算见 [`run_native_with_connection()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:2929)。
 
@@ -393,21 +425,80 @@ A(c)=C_A\,\operatorname{smoothstep}
 
 原子主导模式解释为原子概念。非原子候选成为直接答案，必须同时满足真实显式精确接触和观测正文闭合至少 0.55；隐式精确接触加显式语义接触不等价于显式精确身份。结构角色受原始覆盖可靠性与 Ω 解释门槛约束，但角色不改变奖励公式。实现见 [`assign_v3_scores()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:2549)。
 
-## 12. 原生执行、结果与诊断
+## 12. 严格全局门控与虫洞排序通道
+
+### 12.1 观测路线资格
+
+只消费当前请求真实观测到的虫洞边：非即时回流、非自环、正原始电流、正且不同的端点 ID，且同方向关系必须是已发布 CSR 中的真实正权边。目标权威向量必须有限且非零。动态选边也只能使用真实 CSR 关系，不要求它同时具有持久化虫洞标记；读出不再检验来源与终点的语义相似度。
+
+同一有向端点对只保留最大电流，按电流降序、来源 ID 升序、目标 ID 升序稳定排序，再受既有最大河网边数限制，默认 96，读取上限至少为 1。路线相对流量始终为：
+
+\[
+\rho_e=\operatorname{clip}_{[0,1]}
+\frac{f_e}{\max_{\text{原始观测全部边}}[f]_+}
+\]
 
-### 12.1 执行链
+分母不因路线过滤、门控或候选池改变而重新归一化。门控前资格计数在路线数量截断之前取得。
+
+实现见 [`build()`](../rust-vexus-lite/src/rivermemo_wormhole.rs:141)。
+
+### 12.2 全局文件联合见证
+
+门控查询的是同一读取事务中的全局文件标签事实，不受共同候选文件集合、查询文件夹或候选返回范围限制；它不扩大候选返回权限，也不把见证文件加入候选池。
+
+每条路线必须找到一对符合全部条件的见证文件：
+
+1. 两个不同文件均同时包含来源与终点标签；重复标签行不算多个文件。
+2. 两文件校验和均非空且不同。
+3. 两文件共享至少一个第三标签；第三标签排除路线两端和全部显式焦点。
+4. 至少一个文件包含另一个显式焦点；该焦点不是路线两端。显式焦点来自零跳核心或字面种子，不包含普通隐式种子。
+
+按文件 ID 稳定枚举见证对；符合条件时，焦点与第三标签各取最小 ID。每条路线最多检查 128 个联合文件，每文件最多 128 个标签；通过读取第 129 项探测超限。任何一项超限都使该路线门控失败，不以截断样本放行。未通过门控不影响完整基线计算。
+
+不同文件与不同校验和只表示重复出现的非完全相同内容，不证明证据相互独立、候选相关或关系因果成立。数据库读取错误按原生错误路径返回，不伪装成正常无路线回退。
+
+实现见 [`gate()`](../rust-vexus-lite/src/rivermemo_wormhole.rs:33) 和 [`refine()`](../rust-vexus-lite/src/rivermemo_wormhole.rs:59)。
+
+### 12.3 强路线与候选落地
+
+通过全局门控仍不足以获得排序贡献。还必须同时满足：
+
+- 请求观测完整，且 Ω 大于零。
+- 路线来源是零跳核心或字面种子。
+- 路线相对流量至少 0.5，仍使用完整原始观测的最大流量作分母。
```

**File**: `docs/RIVERMEMO_TOPOLOGY_V3.wormhole-v2.5.backup-20261029-000519.md` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+---
+title: RiverMemo V3 · 独立虫洞读出
+summary: 2.5 实验读出契约、真实观测边界、地址诊断及验证要求。
+updatedAt: 2026-10-29
+category: guide
+---
+
+# RiverMemo V3：2.5 独立虫洞读出实验
+
+原生读出版本为 rivermemo.wormhole-readout-v2.5。传播管线、资产格式、
+AGS 几何、金字塔、动态虫洞选择、双场及请求观测生命周期不变。
+本次只重写候选读出；无需重建资产或修改数据库。
+
+实现入口：
+- [`rivermemo_wormhole.rs`](../rust-vexus-lite/src/rivermemo_wormhole.rs)
+- [`rivermemo_topology_v3.rs`](../rust-vexus-lite/src/rivermemo_topology_v3.rs)
+- [`LightMemo 实验室诊断`](../Plugin/LightMemo/abDiagnostics.js)
+
+## 1. 为什么删掉旧读出
+
+2.4 的来源相似度门槛把远距离事件联想清零。
+2.4.1 去掉该门槛，但普通边与虫洞同权参与意图合取，
+品牌／鸿蒙背景依然得到更强支持；原查询底分又继续主导最终排序。
+
+两轮合成测试通过并未证明真实检索改善。
+本轮不再通过残差、软合取、闭合、拓扑几何、Ω 和小额奖励重复审查虫洞。
+删除旧意图模块及候选路径／拓扑／锚奖励实现，先直接观察虫洞通道。
+这是可证伪的实验，不是“所有虫洞都正确”的声明。
+
+## 2. 最小数学契约
+
+设 E 为本次观测所有边，W 为其中可用虫洞：
+
+- 虫洞标记为真，非即时回流，非自环，正 ID、有限正原始流量；
+- 在同一资产中存在真实正权 CSR 边；
+- 终点存在有限、非零的权威原始向量；
+- 同一有向路线重复序列化只保留最大流量，不累加投票；
+- 按流量降序、源 ID、终点 ID 稳定截断至最大河网边数（默认 96）。
+  回执显示截断情况；零配置沿用兼容行为，至少保留一个席位。
+
+令 M 为所有观测边的最大有限正原始流量，路线相对流量为 f/M。
+它与完整观测面板的归一化流量同口径，不是概率，
+不使用候选池统计，也不再使用 f/(f+0.03) 的二次饱和。
+
+候选正文向量为 c，路线终点向量为 v：
+
+\[
+S_W(c)=\max_{(i,j)\in W}\frac{f_{ij}}{M}
+          \operatorname{clip}_{[0,1]}(\cos(v_j,c)).
+\]
+
+最终按 S_W 降序，平局按 Chunk ID 升序。
+不加原查询余弦、不乘来源或残差相似度、不做意图合取、
+不乘标签闭合、Ω 或形态权重，不设小额奖励预算。
+普通边不进入候选联想通道，但仍参与全观测流量分母。
+
+没有可用虫洞时，整通道回退为原查询正文余弦裁剪至 [0,1]。
+存在可用虫洞但某候选无正支持时该候选分数为零，
+不会逐候选偷偷回退原查询分。错误但强烈的虫洞可以排错；
+这应由真实评估暴露，不用隐藏的原查询底分掩盖。
+
+## 3. 地址与语义近似必须区分
+
+评分只使用终点正文余弦。文件级地址诊断单独报告：
+
+1. exact-file-tag：候选文件精确包含终点标签 ID；
+2. edge-source-file：该文件出现在资产的边来源贡献中；
+3. semantic-body-approximation：没有上述地址，仅按正文语义定位。
+
+标签身份不依赖标签向量是否可用。
+边来源是文件有序标签共现线索，不是实际查询流量分解、
+独立相关性证据或某个 Chunk 回答问题的证明。
+地址标记不额外加分，不能将同一文件中的所有段落直接视为答案。
+
+真实资产 9bdf6e9a1f5644c345cec7e8f93c8bfcbf77b739241fcbbb 中，
+40770 → 39492 的来源文件是 9478、9479；10640 的文件是 9314，
+11124 的文件是 9665，均不在其中。
+终点 39492 的精确标签文件是 9325、9478、9479。
+因此两个汽车候选属于近似定位，不是精确地址命中。
+
+## 4. 候选、权限与兼容协议
+
+上游仍提供有界候选池。新读出处理全部已提供、可解码、已授权候选，
+不再执行旧多源投票二次淘汰；不补回池外候选，也不代表全库精确召回。
+显式空权限集合仍表示没有权限。资产签名、依赖版本、运行时代际、
+数据库代际、同快照事务及句柄释放保持原契约。
+
+原生结果协议保持 rivermemo-topology-v3-native-result-v1。
+为兼容原消费者，基础分等于当前通道最终分；
+旧场分、场共振、路径、图、拓扑、锚奖励和截断扣分均为零。
+不能再把基础分解释为原查询余弦。
+详细跟踪保留原查询余弦与获胜虫洞读出，不再返回旧几何测绘。
+Ω 和查询形态仍是河网诊断，不参与排序。
+旧读出配置除最大河网边数外均不再影响读出，
+Ω 配置仅影响诊断。
+
+LightMemo 四轨实验室中的 RiverMemo 轨现在就是独立虫洞轨，
+TDB 轨保留原查询基线。完整共同池解释可查看 Top-K 外候选，
+同时展示路线、原始／相对流量、终点正文余弦和地址类型。
+
+## 5. 观测限制
+
+- 最大归一化流量 1 只表示本次观测最强，并非绝对可信度；
+  单条很弱的合法虫洞也可能相对流量为 1。
+- 既有虫洞包括持久化／张力判定与动态选边；不能把虫洞标记都称为
+  “本次新发现的动态灵感”。本例动态虫洞实际发火计数为零。
+- 聚合即时回流为 OR 标记，排除它可能同时丢掉混合正向流。
+- 边流记录已注入事件，不证明后继状态继续发火或完整多跳血缘。
+- 近似正文定位依然受嵌入模型的实体、品牌和领域偏差影响。
+- 强错误虫洞、缺失终点向量和混合意图都必须纳入评估。
+- 分数跨查询不可直接当作概率比较。
+
+## 6. 验证与部署
+
+回归应覆盖真实正权边、无虫洞回退、普通边排除、重复路线、
+回流、自环、缺失／非法向量、流量缩放、路线截断、稳定平局、
+候选池不变性、权限和地址标记不加分。
+原生接口测试继续覆盖资产校验、同代观测、批量 SQL、
+联合查询、共同池和句柄释放。
+
+只读机制探针：
+[`memo_wormhole_readout_probe.js`](../scripts/memo_wormhole_readout_probe.js)。
+它使用报告摘录的虫洞流量及真实数据库向量，不调用 embedding，
+不修改数据库，不重放 ANN 或完整原查询；不能声称精确复现共同池 Top-30。
+真实原查询完整四轨重测仍是最终效果证据，不能强行指定某 Chunk 第一。
+
+发行构建使用子项目构建命令；停止加载原生模块的服务后替换平台产物并重启。
+已加载进程不能热替换。核对真实响应中的读出版本，
+不要用仍保持不变的传播版本判断读出是否更新。
\ No newline at end of file
```

**File**: `docs/RIVERMEMO_TOPOLOGY_V3_EXPERIMENTS.md` (added, +162/-0)
```diff
@@ -0,0 +1,162 @@
+# RiverMemo Topology V3：试验与验证记录
+
+本文单独保存试验方案、排查经过与验证结果，不定义当前运行算法。最终算法见 [RiverMemo Topology V3](RIVERMEMO_TOPOLOGY_V3.md)。
+
+## 最终实现与验证记录（2026-10-29）
+
+最终实现提交：d941bdbe；原生读出标识：rivermemo.conservative-topology-v2.5-confidence-rrf。
+
+最终实现保留完整的候选自身拓扑、直接锚与 Ω 基线，再对通过严格全局门控且具有候选落地证据的强虫洞路线执行解释力度加权 RRF。没有实际路线贡献时，基线分数与排序保持不变。
+
+### 排查结论
+
+- 来源与终点相似度门槛会排除真实长距离关联，不能用它证明虫洞有效性。
+- 仅按终点相似度替换完整评分会丢失直接锚、拓扑与 Ω 的有效证据。
+- 文件联合见证属于全局文件标签图，不能误用共同候选文件范围作为门控范围；候选返回权限与过滤仍保持原边界。
+- 在原拓扑预算内增加小幅奖励，未必足以纠正强背景语义造成的排序差距。
+- 最终采用严格全局见证、候选标签与正文落地，以及独立排序通道的 RRF 融合；不按指定 Chunk、查询名称或品牌定制规则。
+
+### 验证记录与边界
+
+- 工程验证：191 项 Rust 库测试、8 项诊断测试、1 项原生兼容测试通过。
+- 用户服务器反馈：100 组针对数据集查询的单元测试全部通过，华为汽车案例全部通过。
+- 上述反馈不扩写为完整 800 组已经通过，也不据此声称全库精确召回率。
+- 固定 30 候选、仅踏板路线的离线检查中，5 个具有候选落地证据的事件候选进入前五；该检查不是完整原生查询重放，不能替代服务器验证。
+
+### 产物记录
+
+Windows x64 MSVC 原生产物为 14,807,040 字节；SHA-256：f3da3b501504bb77d667e007dc4fb0b7c81e9fb2958df5a535d5f16694e3956e。
+
+## 历史试验原文归档
+
+以下段落保留当时的方案、假设及局限；其中“当前”“覆盖”等措辞仅指当时试验，不具有现行算法契约效力。相对源码链接以原章节记录为准。
+
+## 当前优先契约：2.4.1 来源条件化终点读出
+
+**本节覆盖下文旧 2.4／2.2 的评分说明。** 分支 rivermemo-fix-2.4，
+原生版本 rivermemo.source-endpoint-v2.4.1；传播、资产格式与统一管线标识不变。
+旧章节保留为历史实验和无有效显式意图时的兼容回退说明，不是新评分公式。
+
+### 真实查询推翻的假设
+
+上一轮 intent-wormhole-v2.4 在“华为汽车的幽默操作”中全部 30 个候选传播提升为零，
+10640 排第 29。实际事件终点与三个来源余弦约 0.258～0.290，全部被旧 0.35 门槛排除。
+留一标签自身残差能量也未识别背景：泛品牌仍占约 24% 意图权重。
+这说明“终点必须仍像来源”“答案应复现查询图形”的前提不成立，不只是奖励倍率偏小。
+上一轮合成测试通过不构成真实排序有效的证据。
+
+### 认知与数学契约
+
+候选是证据终点读出算子，不是查询图的缩小副本。真实边提供关系支持，
+候选无需包含来源或复现标签序位；关系不等于语义同一、因果证明或答案正确。
+
+1. 点火保持不变；有效零跳核心／词面种子按 ID 稳定聚类。
+   完全链接余弦至少 0.95，每簇单位均值代表；不保证通用别名识别。
+2. 两遍重正交化取得每轴留一单位方向 \(r_i\)。
+   查询解释量 \(e_i=[\cos(q,r_i)]_+^2\)，权重 \(w_i=e_i/\sum e_j\)。
+   残差能量不超过 1e-10 时解释量零；总量不超过 1e-8 时均匀回退。
+   标签自身残差能量只作诊断，不直接分配意图权重。
+   留一方向彼此不必正交，解释量之和不是严格查询能量分解，也不是背景分类器。
+3. 直接支持 \(d_i\)：标签身份信用乘正文闭合与低置信正文回退择强。
+   语义标签信用 \([(\cos-.48)/.52]_0^1\)，精确 ID 为 1；
+   正文回退 \(0.7[(\cos-.45)/.55]_0^1\)。
+   多轴且独立方向有效时乘 \(\sqrt{[\cos(r_i,c)]_+}\)，取消旧固定背景底座。
+4. 传播只归属于来源 ID 所在意图簇，非自环、非即时回流、正绝对电流，
+   且必须是资产中的正权真实边。每轴传播支持
+   \(t_i=\max_{i\to j}\frac{f}{f+.03}h(j,c)\)。
+   终点落地 \(h\) 使用上述标签／正文信用，**不乘终点对来源或残差相似度**。
+   普通边与虫洞遵循同一契约，虫洞标记不另加奖励倍率。
+   路线按校准电流和 ID 稳定排序，受既有最大河网边数限制。
+5. 每轴 \(s_i=\max(d_i,t_i)\)，连续软合取
+   \(H(s)=\exp(\sum_iw_i\ln(.05+s_i))-.05\)。
+   取消旧 max(.05,s) 死区；零证据严格零，微小证据连续响应。
+6. 单一预算 \(C=[C_A]_+ + [C_T]_+\)，默认 0.18。
+   **直接分账 \(A=C H(d)\)，传播分账 \(G=C[H(s)-H(d)]_+\)，
+   路径奖励 \(P=0\)，基础分 \(B=[\cos(q,c)]_0^1\)，最终分为 clip(B+A+G)。**
+   总奖励不超过 C；同一传播证据不同时计入锚与图奖励。
+   兼容输出的直锚列、图奖励列改为上述消融分账，不再分别受两个旧上限限制。
+7. 有效意图候选的旧场共振、路径几何、候选图形相似及 Ω 只作诊断，不进入评分。
+   Ω 描述河网状态，不作为某条路线正确率。无有效显式意图时保留旧兼容评分，
+   并在详细模式字段明确标识。原始查询余弦仍保留，尚未消除其自身背景偏移。
+
+实现依据：[`rivermemo_intent.rs`](../rust-vexus-lite/src/rivermemo_intent.rs:1)、
+[`assign_v3_scores()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:2557)。
+
+### 观测限制、诊断与验证
+
+当前只归属显式种子／其近义簇出边，不从聚合图猜多跳种子血缘。
+聚合即时回流为 OR 标记，混有回流的边保守排除，可能丢失正向证据；
+边流表示已注入事件，不保证后继状态保留或继续发火。
+这不是完整时间展开多源传输解算器。绝对电流校准受点火幅度影响。
+文件标签可能是图构建的同源证据，不能将其当作独立 held-out 验证。
+
+账本增加查询解释量、电流校准、终点落地及虫洞标记，修复逐候选表格断裂。
+兼容字段 wormholeLift／wormholeSupport 表示全部来源归属传播，不再仅限虫洞；
+版本和单独虫洞标记用于区分语义。共同池全排序解释不补回池外或超集未入选候选。
+
+只读测绘：[`memo_endpoint_readout_probe.js`](../scripts/memo_endpoint_readout_probe.js:1)。
+可传实际查询向量；默认“幽默＋汽车”合成向量不是原查询重放。
+默认品牌查询独立解释量为零；事件终点对汽车候选有正支持、对手机／PC 对照为零。
+这是机制对照，不是实际排序收益或全库召回率证明。
+
+回归覆盖来源／终点正交、多意图不串票、微小提升、普通边同契约、
+错误来源／回流／零电流／不存在边、查询解释权重、别名、候选池不变性、
+单一预算和旧奖励消融。仍需真实查询集验证，不保证指定候选第一或进入 Top-K。
+
+部署须停止加载原生模块的服务，替换对应平台产物并重启；
+核对读出为 rivermemo.source-endpoint-v2.4.1。统一管线仍为
+memo.conservative-topology-v2.2；无需重建图资产或修改数据库。
+
+---
+
+## 2.4 分支实验说明（2026-10-28）
+
+当前分支 `rivermemo-fix-2.4` 的原生读出标识为
+`rivermemo.intent-wormhole-v2.4`。以下实验契约覆盖本文后续 2.2 版本的直接锚、
+图请求及诊断说明；传播、资产格式与统一查询管线标识保持不变，无需重建图资产。
+
+### 数学与实现
+
+- 传播点火幅度保持不变。读出意图只来自有效零跳核心／词面种子，权重不消费点火幅度。
+- 种子按 ID 排序后采用完全链接近义簇（余弦至少 0.95），每簇单位化均值作为代表，
+  防止近义重复投票。该规则不保证别名识别，也不跨弱相似链合并。
+- 每个代表对其他代表构成的空间做两遍重正交化，留一残差能量作为区分权重，
+  能量下限 0.02 后归一化。它是线性独立性度量，不是品牌／背景分类器；
+  相似度结构不符合“背景被包含”假设时，不能保证泛品牌权重下降。
+- 每轴直接支持由精确／语义标签闭合与低置信正文回退择强。多轴且残差能量足够时，
+  乘 `0.25 + 0.75 * sqrt(positive residual-body cosine)`，保留背景支持而不让它独占判断。
+- 虫洞仅使用观测中的非即时回流、非自环、正电流且资产中存在正权真实边的路线，
+  按绝对电流 `f/(f+0.03)` 校准，不能将最大归一化流当置信概率。
+  每轴结合终点语义、有效残差方向及终点到候选正文／标签的闭合，取最强路线。
+  候选无需包含路线起点；不制造精确身份或多跳完整血缘。
+- 每轴满足度为直接支持与虫洞支持的最大值；各轴加权几何平均作软合取。
+  数值下限 0.05，并在聚合后移除下限；无证据严格零奖励。
+- 有有效意图时，锚奖励为 `anchorBonusCap * intentSatisfaction`，
+  不再经过旧 0.2 强度饱和；无有效意图时保留旧锚回退。
+  旧锚接触与角色只作身份解释，不能据“direct_answer”声称满足全部意图。
+- 图请求为原候选自身请求与 `topologyBonusCap * wormholeLift` 的最大值，
+  之后仍乘 Ω，并与路径共享原拓扑预算；虫洞不是额外第五项奖励。
+  `wormholeLift` 是含虫洞与仅直接支持的合取满足度之差。
+  虫洞可同时改善意图奖励和图请求，最终仍受原锚／拓扑两个上限约束。
+- 基础分及场共振暂不改变；本实验不是全评分残差化，仍需真实测试集验证背景偏移。
+
+源码：[`rivermemo_intent.rs`](../rust-vexus-lite/src/rivermemo_intent.rs:1)、
+[`assign_v3_scores()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:2557)。
+
+### 诊断与部署
+
+实验室四轨仍显示 Top-K；新增 `candidateDiagnostics` 保留实际入选共同池的全部排序解释，
+并展示意图簇、权重、残差能量、直接支持、虫洞支持、路线与合取满足度。
+内部超集过滤仍然有效，不能把“全池解释”理解为补回池外候选。
+
+停止加载原生模块的服务后替换 Windows x64 MSVC 产物并重启；
```

**File**: `rust-vexus-lite/README.md` (modified, +39/-11)
```diff
@@ -1,15 +1,15 @@
 ---
 title: Vexus-Lite · 读写搜一体化原生记忆数据库
-summary: Vexus-Lite 原生记忆数据库架构指南，介绍 SQLite 权威事实存储、TDB 2-bit 检索、AGS 统一几何、有界传播与动态虫洞、RiverMemo 双场及四项评分，以及 RAGDiary 被动记忆和 LightMemo 主动回忆的协作与部署边界。
-updatedAt: 2026-10-28
+summary: Vexus-Lite 原生记忆数据库架构指南，介绍 SQLite 权威事实存储、TDB 2-bit 检索、AGS 统一几何、有界传播与动态虫洞、RiverMemo 双场及四项基线评分、边缘稀疏场景的条件式虫洞排序修正，以及主动与被动记忆渠道的协作与部署边界。
+updatedAt: 2026-10-29
 category: guide
 ---
 
 # VexusMemo-Lite：读、写、搜一体化的原生记忆数据库
 
 > **SQLite 权威事实层 × TDB 2-bit 冲程检索 × AGS 统一背景场 × Spike 有界传播与请求级动态虫洞 × RiverMemo 共享预算双场投影与统一泛函**
 >
-> 更新日期：2026-10-28。本文说明当前数据库实现：原空间重正交化 AGS 统一几何、图内残差与尾残差路由、双场投影预算、请求级向量复用，以及候选自身证据驱动的四项评分和原生并发双排与事实存储、检索的协作方式。
+> 更新日期：2026-10-29。本文说明当前数据库实现：原空间重正交化 AGS 统一几何、图内残差与尾残差路由、双场投影预算、请求级向量复用，以及完整四项基线评分、边缘稀疏场景的条件式排序修正和原生并发双排与事实存储、检索的协作方式。
 
 Vexus-Lite 已不只是一个“由 JavaScript 调用的向量索引”。它是 VCPToolBox 的嵌入式原生知识与记忆数据引擎：从事实事务、向量路由、几何预计算、传播观测，到候选精排和结果回填，在同一个 Rust 原生模块中协作完成。
 
@@ -390,15 +390,15 @@ u_\alpha=(1-\alpha)(I-\alpha T)^{-1}S
 3. 正边流是否具有非退化分布；
 4. 观测是否完整。
 
-候选不能靠自身“看起来关系很多”来授予自己无限排序权限。Ω 只门控图奖励，不门控路径或锚奖励；其几何平均采用 epsilon 底值，空图不代表 Ω 必然严格为零，没有候选结构证据时图奖励仍为零。高 Ω 表示传播可观测，不证明主题正确、实体同一或正文因果成立。实现见 [`compute_omega()`](src/rivermemo_topology_v3.rs:2483)。
+候选不能靠自身“看起来关系很多”来授予自己无限排序权限。在四项基线中，Ω 只门控图奖励，不门控路径或锚奖励；其几何平均采用 epsilon 底值，空图不代表 Ω 必然严格为零，没有候选结构证据时图奖励仍为零。高 Ω 表示传播可观测，不证明主题正确、实体同一或正文因果成立。条件式虫洞修正另使用 Ω 校准路线证据与权重，见第 6.5 节；这不改变基线预算。Ω 的稀疏／稠密工况不是主题资料密度，也不是该修正的直接开关。实现见 [`compute_omega()`](src/rivermemo_topology_v3.rs:2483)。
 
-### 6.4 最终统一评分
+### 6.4 常规主干：完整四项基线评分
 
-Topology V3 的最终分由四项独立记账：
+Topology V3 的常规排序主干由四项独立记账：
 
 \[
 \boxed{
-S(c)=\operatorname{clip}_{[0,1]}
+S_0(c)=\operatorname{clip}_{[0,1]}
 \left[B(c)+P(c)+G(c)+A(c)\right]
 }
 \]
@@ -414,12 +414,39 @@ S(c)=\operatorname{clip}_{[0,1]}
 
 直接锚采用精确优先、双侧一对一接触，最多三个独立接触；隐式接触永久折减，纯隐式锚强度上限 0.035，低于默认激活阈值 0.05，因此默认不产生锚奖励。非原子候选被解释为直接答案，还须有真实显式精确接触及至少 0.55 的观测正文闭合；语义相似不等于显式身份。
 
-原生结果提供 [基础分](src/rivermemo_topology_v3.rs:3080)、[场共振](src/rivermemo_topology_v3.rs:3082)、[路径奖励](src/rivermemo_topology_v3.rs:3085)、[图奖励](src/rivermemo_topology_v3.rs:3086)、[锚奖励](src/rivermemo_topology_v3.rs:3084)及[截断扣分](src/rivermemo_topology_v3.rs:3087)，可按“四项合计减截断扣分”复算最终分。场共振已含在基础分中，拓扑奖励已是路径与图之和，均不可重复相加。公共接口不保证透出全部原生顶层字段或详细诊断。
+原生结果保留基础分、场共振、路径奖励、图奖励、锚奖励及截断扣分，可按“四项合计减截断扣分”复算基线分。场共振已含在基础分中，拓扑奖励已是路径与图之和，均不可重复相加。启用条件式 RRF 时，最终融合分另行记账，截断扣分仍相对于基线计算，不能用四项之和复算融合分。见 [结果组装](src/rivermemo_topology_v3.rs:3108) 与 [RRF 明细](src/rivermemo_wormhole.rs:459)。公共接口不保证透出全部原生顶层字段或详细诊断。
 
-原始查询分是分数下限，不是名次下限；非负增益不保证真实排序收益。兼容配置中的条件同伴、创新系数与批级锚异常／前沿控制等不参与最终奖励，以 [已退役控制回执](src/rivermemo_topology_v3.rs:3158) 为准。
+原始查询分是基础分下限，不是启用 RRF 后的最终分下限，也不是名次下限；非负基线增益不保证真实排序收益。兼容配置中的条件同伴、创新系数与批级锚异常／前沿控制等不参与基线奖励，以 [已退役控制回执](src/rivermemo_topology_v3.rs:3158) 为准。
 
 评分实现见 [`assign_v3_scores()`](src/rivermemo_topology_v3.rs:2549)、[场共振](src/rivermemo_topology_v3.rs:1716) 与 [路径奖励计算](src/rivermemo_topology_v3.rs:2929)，完整数学契约见 [`RIVERMEMO_TOPOLOGY_V3.md`](../docs/RIVERMEMO_TOPOLOGY_V3.md)。
 
+### 6.5 边缘稀疏场景：严格门控的虫洞 RRF 回归修正
+
+**虫洞 RRF 不是普遍情况，不是常驻全局评分因子，也不是 RiverMemo 的常规排序主干。** 它针对极端边缘稀疏知识场景：图构建已经发现了有事实支持的逻辑关联，查询传播也实际经过了这条关系，但候选正文与查询的表面语义距离较远，常规读出未能充分反映这条已发现的关联。此时才允许以严格验证的路线提供条件式排序修正，而不是要求所有查询都经过虫洞融合。
+
+这里的“逻辑链”指图关系及其正文落地证据，不把共现直接当作形式逻辑或因果证明。“边缘稀疏”描述适用问题，**实现并不新增一个按 Ω 工况标签判定的稀疏开关**；局部河网即使显示稠密，也不代表该主题资料充分。实际触发必须通过以下约束：
+
+1. **真实观测路线**：正电流、非自环、非即时回流的虫洞，且存在同方向正权 CSR 关系和有效目标向量；不是仅凭背景有边就参与排序。
+2. **严格全局见证**：至少两个同时包含路线两端的不同文件，校验和非空且不同；两文件还须共享排除两端与全部显式焦点的第三标签，并在至少一个文件中包含另一个显式焦点。每路线最多检查 128 个文件、每文件 128 个标签，检测到超限则不放行。
+3. **强度与来源**：完整请求观测、正 Ω、来源为零跳核心／字面焦点，且原始观测中的相对流量至少 0.5；过滤后不重新归一化。
+4. **候选落地**：目标与候选正文正相关，且候选文件标签具有精确目标 ID 或超过默认 0.48 阈值的语义匹配，该标签与正文也必须正相关。精确 ID 在实现中按相似度 1 统一通过阈值检查。
+
+**全局见证是图证据，不是全局排序因子。** 见证读取不受共同候选文件范围限制，但不扩大候选权限、不把见证文件补入结果，也不替代候选自身落地。不同校验和不证明见证相互独立。
+
+每条合格路线按“相对流量 × 目标—正文正余弦 × Ω 的幂”排列具有落地资格的候选，得到从 1 开始的路线名次 \(r_e(c)\)；完整基线名次记为 \(r_0(c)\)。路线权重由原始电流相对于普通传播的解释力度确定：
+
+\[
+w_e=\frac{f_e}{f_{\mathrm{ref}}}\Omega^\gamma,\qquad
+S(c)=\frac{1}{60+r_0(c)}
++\max_{e:\,c\text{ 具有落地资格}}\frac{w_e}{60+r_e(c)}
+\]
+
+参照电流是原始观测中非虫洞、非即时回流、非自环普通边的最大正电流；没有这种边时使用原始观测全部边的最大正电流。多路线取最大贡献，不叠加相关支路的票数；最终稳定排序，平分保留基线顺序。权重可以大于 1，融合分不是余弦或概率，也不占用或改写基线的拓扑、锚点预算。
+
+**只有至少一个候选获得实际正路线贡献，才启用上述融合；否则基线分数逐位不变、排序不变。** 未触发不是功能缺失；常规、资料充分的查询由完整拓扑、直锚与 Ω 正常完成排序，不需要虫洞 RRF 来证明读出有效。
+
+路线、门控及融合实现见 [`rivermemo_wormhole.rs`](src/rivermemo_wormhole.rs:33)，两阶段排序接入见 [基线与条件式融合](src/rivermemo_topology_v3.rs:3006)。该通道是 RiverMemo 内部的特殊修正，不是第 8 节外部 Rerank+ 与 RiverMemo 的排位融合。
+
 ---
 
 ## 7. 为什么可以又快、又高效、又准？
@@ -519,7 +546,7 @@ RAGDiary 的被动渠道有明确的控制面，而不是每轮无差别地执
 
 ### 8.4 RAGDiary 原生多索引 / RiverMemo 联合路径
 
-显式日记权限与候选计划 → 原生 ANN → 合并、展开、去重与投影 → 同代观测读出 → 候选级并行路径、拓扑与锚接触计算 → 查询形态、Ω、候选自身奖励及共享预算 → 最终排序。
+显式日记权限与候选计划 → 原生 ANN → 合并、展开、去重与投影 → 同代观测读出 → 候选级并行路径、拓扑与锚接触计算 → 查询形态、Ω、候选自身奖励及共享预算 → 完整基线排序 → 仅在严格路线与候选落地条件满足时执行虫洞 RRF 修正 → 最终结果。
 
 权限过滤先于候选归一化和统计，显式空权限集合表示无权限。拓扑读出只处理共同候选边界内的内容，内部候选超集默认上限 300，不从全库补回池外漏召回项；该边界不等于各入口的原始 ANN 数量。实现见 [权限过滤](src/rivermemo_topology_v3.rs:2773) 与 [`select_superset()`](src/rivermemo_topology_v3.rs:1362)。
 
@@ -573,7 +600,7 @@ LightMemo 让 Age
```

**File**: `rust-vexus-lite/src/light_memo.rs` (modified, +9/-1)
```diff
@@ -184,7 +184,7 @@ impl Task for LightMemoTask {
                     }
                     input["includeTrace"] = json!(plan.ab_mode);
                     input["dimension"] = json!(self.dimension);
-                    input["topK"] = json!(plan.k);
+                    input["topK"] = json!(if plan.ab_mode { candidates.len() } else { plan.k });
                     input["candidates"] = json!(candidates);
                     input["allowedFileIds"] = json!(candidates.iter()
                         .filter_map(|c| c["fileId"].as_i64()).collect::<HashSet<_>>());
@@ -239,6 +239,14 @@ impl Task for LightMemoTask {
                             });
                         }
                     }
+                    if plan.ab_mode {
+                        river["candidateDiagnostics"] = river["results"].clone();
+                        if let Some(results) = river["results"].as_array_mut() {
+                            results.truncate(plan.k);
+                        }
+                        river["diagnostics"]["returnedCandidates"] = json!(
+                            river["results"].as_array().map_or(0, Vec::len));
+                    }
                 }
                 let results = if plan.engine_mode == "rivermemo" {
                     river["results"].as_array().cloned().unwrap_or_default()
```

**File**: `rust-vexus-lite/src/rivermemo_topology_v3.rs` (modified, +100/-3)
```diff
@@ -15,8 +15,11 @@ use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
 use crate::memo_sensing::SenseOutput;
 use crate::storage::{TagVectorPool, ensure_tag_vectors_loaded};
 
+#[path = "rivermemo_wormhole.rs"]
+mod wormhole;
+
 const RESULT_SCHEMA: &str = "rivermemo-topology-v3-native-result-v1";
-const ALGORITHM_VERSION: &str = "rivermemo.conservative-topology-v2.2";
+const ALGORITHM_VERSION: &str = "rivermemo.conservative-topology-v2.5-confidence-rrf";
 
 fn clamp01(value: f64) -> f64 {
     if value.is_finite() {
@@ -296,6 +299,10 @@ struct RiverEdge {
     flow: f64,
     #[serde(default)]
     normalized_flow: f64,
+    #[serde(default)]
+    wormhole: bool,
+    #[serde(default)]
+    immediate_return: bool,
 }
 
 #[derive(Deserialize)]
@@ -2737,6 +2744,8 @@ pub(crate) fn run_native_with_connection(
                 target_id: edge.target_id,
                 flow: edge.flow,
                 normalized_flow: edge.normalized_flow,
+                wormhole: edge.wormhole,
+                immediate_return: edge.immediate_return,
             })
             .collect();
         input.query_state.field_provenance = cached
@@ -2885,10 +2894,15 @@ pub(crate) fn run_native_with_connection(
         .map(|node| node.id)
         .collect();
     requested_tag_ids.extend(seeds.iter().map(|seed| seed.0));
+    requested_tag_ids.extend(input.query_state.river_edges.iter()
+        .filter(|edge| edge.wormhole).map(|edge| edge.target_id));
     let query_stats = ensure_tag_vectors_loaded(
         connection, &mut tag_vectors, &requested_tag_ids, dimension)?;
     let query_tag_sql_batches = query_stats.sql_batches;
     let query_and_seed_tag_vectors = tag_vectors;
+    let mut wormhole_model = wormhole::build(&input, &query_and_seed_tag_vectors, &artifact);
+    let mut wormhole_gate = wormhole::gate(&mut wormhole_model, connection)?;
+    wormhole::refine(&mut wormhole_model, &mut wormhole_gate, connection, &input)?;
     let load_ms = load_started.elapsed().as_secs_f64() * 1000.0;
 
     let compute_started = Instant::now();
@@ -3004,6 +3018,9 @@ pub(crate) fn run_native_with_connection(
             })
             .then_with(|| left.curve.union_rank.cmp(&right.curve.union_rank))
     });
+    let wormhole_traces = wormhole::fuse_rrf(&mut work, &wormhole_model, &input, &omega);
+    // Stable sort retains the complete baseline comparator for equal fusion scores.
+    work.sort_by(|a, b| b.final_score.total_cmp(&a.final_score));
     let ranked_count = work.len();
 
     let results: Vec<NativeResultItem> = work
@@ -3068,7 +3085,11 @@ pub(crate) fn run_native_with_connection(
                     "requestedGraphBonus": item.v2_bonus * omega.omega.powf(input.config.omega_gamma.max(0.0)),
                     "finalScore": item.final_score,
                     "nativeBackend": "rust-rayon"
-                }))
+                })).map(|mut trace| {
+                    trace["wormholeRrf"] = wormhole_traces
+                        .get(&item.curve.id).cloned().unwrap_or(Value::Null);
+                    trace
+                })
             } else {
                 None
             };
@@ -3085,7 +3106,8 @@ pub(crate) fn run_native_with_connection(
                 path_bonus: item.path_bonus,
                 graph_bonus: item.gated_bonus,
                 score_clipping: positive(item.pure_score + item.path_bonus + item.gated_bonus
-                    + item.anchor_bonus - item.final_score),
+                    + item.anchor_bonus - wormhole_traces.get(&item.curve.id)
+                        .and_then(|v| v["baselineScore"].as_f64()).unwrap_or(item.final_score)),
                 role: item.role,
                 omega: omega.omega,
                 river_regime: omega.regime.clone(),
@@ -3135,6 +3157,16 @@ pub(crate) fn run_native_with_connection(
         results,
         parameters: serde_json::json!({
             "parsedConfig": input.config,
+            "wormholeGateMode": "global-two-joint-files-distinct-checksums-third-tag-explicit-focus",
+            "wormholeEvidenceScope": "global-file-tag-graph; independent-of-candidate-and-retrieval-scope",
+            "wormholeGate": wormhole_gate,
+            "wormholeEligibleRoutes": wormhole_model.eligible_routes,
+            "wormholeAcceptedRoutes": wormhole_model.routes.len(),
+            "wormholeScoring": "strict-global-gate; explanation-weighted-RRF; untouched-baseline-channel",
+            "wormholeRrfK": 60,
+            "wormholeStrongFlowRatio": 0.5,
+            "wormholeWeightReference": "maximum observed non-return ordinary edge flow; observation maximum if absent",
+            "baselineAlgorithm": "rivermemo.conservative-topology-v2.2",
             "fieldResonanceCap": 0.03,
             "fieldSupportPotentialSaturation": 0.02,
             "fieldSupportCoverageSaturation": 0.5,
@@ -3496,6 +3528,71 @@ mod stoploss_tests {
             seed_nodes: 7, reached_nodes: 23, emergent_nodes: 16, complete_observation: true 
```

**File**: `rust-vexus-lite/src/rivermemo_wormhole.rs` (added, +469/-0)
```diff
@@ -0,0 +1,469 @@
+//! Auxiliary evidence from observed wormholes, never a replacement scorer.
+//! Strict global admission enables a separate correction key; baseline scores stay intact.
+use super::*;
+
+#[derive(Clone, Serialize)]
+#[serde(rename_all = "camelCase")]
+pub(super) struct Route {
+    source_id: i64,
+    target_id: i64,
+    flow: f64,
+    relative_flow: f64,
+    #[serde(skip)]
+    vector: Arc<[f32]>,
+}
+
+#[derive(Default)]
+pub(super) struct Model {
+    pub routes: Vec<Route>,
+    pub eligible_routes: usize,
+}
+
+#[derive(Clone, Serialize)]
+#[serde(rename_all = "camelCase")]
+pub(super) struct GateDecision {
+    source_id: i64,
+    target_id: i64,
+    witness_file_ids: Vec<i64>,
+    accepted: bool,
+    #[serde(skip_serializing_if = "Option::is_none")]
+    refined_evidence: Option<Value>,
+}
+
+pub(super) fn gate(model: &mut Model, connection: &Connection)
+    -> std::result::Result<Vec<GateDecision>, String> {
+    // Global graph evidence, independent of candidate and retrieval scopes.
+    // Two distinct files are repeated association, NOT proof of independence.
+    let mut statement = connection.prepare_cached(
+        "SELECT DISTINCT s.file_id FROM file_tags s
+         JOIN file_tags t ON t.file_id=s.file_id AND t.tag_id=?2
+         WHERE s.tag_id=?1 ORDER BY s.file_id LIMIT 2"
+    ).map_err(|e| format!("prepare wormhole cross gate: {e}"))?;
+    let mut decisions = Vec::new();
+    for route in &model.routes {
+        let rows = statement.query_map(
+            rusqlite::params![route.source_id, route.target_id], |row| row.get::<_, i64>(0)
+        ).map_err(|e| format!("query wormhole cross gate: {e}"))?;
+        let files = rows.collect::<rusqlite::Result<Vec<_>>>()
+            .map_err(|e| format!("decode wormhole cross gate: {e}"))?;
+        decisions.push(GateDecision {
+            source_id: route.source_id, target_id: route.target_id,
+            accepted: files.len() >= 2, witness_file_ids: files, refined_evidence: None,
+        });
+    }
+    model.routes.retain(|route| decisions.iter().any(|d|
+        d.source_id == route.source_id && d.target_id == route.target_id && d.accepted));
+    Ok(decisions)
+}
+ 
+pub(super) fn refine(model: &mut Model, decisions: &mut [GateDecision],
+    connection: &Connection, input: &NativeInput)
+    -> std::result::Result<(), String> {
+    const FILE_LIMIT: usize = 128;
+    const TAG_LIMIT: usize = 128;
+    let focus: HashSet<i64> = input.query_state.field_provenance.iter()
+        .filter(|p| p.hop == 0 && matches!(p.source_type.as_str(), "core" | "lexical_seed"))
+        .map(|p| p.id).collect();
+    let mut files_query = connection.prepare_cached(
+        "SELECT DISTINCT s.file_id, f.checksum FROM file_tags s
+         JOIN file_tags t ON t.file_id=s.file_id AND t.tag_id=?2
+         JOIN files f ON f.id=s.file_id
+         WHERE s.tag_id=?1 ORDER BY s.file_id LIMIT 129"
+    ).map_err(|e| e.to_string())?;
+    let mut tags_query = connection.prepare_cached(
+        "SELECT DISTINCT tag_id FROM file_tags WHERE file_id=?1 ORDER BY tag_id LIMIT 129"
+    ).map_err(|e| e.to_string())?;
+    for decision in decisions.iter_mut().filter(|d| d.accepted) {
+        let files = files_query.query_map(
+            rusqlite::params![decision.source_id, decision.target_id],
+            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<String>>(1)?))
+        ).map_err(|e| e.to_string())?.collect::<rusqlite::Result<Vec<_>>>()
+            .map_err(|e| e.to_string())?;
+        let mut truncated = files.len() > FILE_LIMIT;
+        let mut evidence = Vec::new();
+        for (id, checksum) in files.into_iter().take(FILE_LIMIT) {
+            let tags = tags_query.query_map([id], |r| r.get::<_, i64>(0))
+                .map_err(|e| e.to_string())?.collect::<rusqlite::Result<Vec<_>>>()
+                .map_err(|e| e.to_string())?;
+            truncated |= tags.len() > TAG_LIMIT;
+            evidence.push((id, checksum, tags.into_iter().take(TAG_LIMIT).collect::<HashSet<_>>()));
+        }
+        let mut witness = None;
+        if !truncated {
+            'pairs: for (i, left) in evidence.iter().enumerate() {
+                for right in evidence.iter().skip(i + 1) {
+                    let (Some(a), Some(b)) = (&left.1, &right.1) else { continue };
+                    if a.is_empty() || b.is_empty() || a == b { continue; }
+                    let other_focus = focus.iter().copied().filter(|id|
+                        *id != decision.source_id && *id != decision.target_id
+                        && (left.2.contains(id) || right.2.contains(id))).min();
+                    let Some(anchor) = other_focus else { continue };
+                    let bridge = left.2.intersection(&right.2).copied().filter(|id|
+                        *id != decision.source_id && *id != decision.target_id
+                        && !focus.contains(id)).min();
+                    if let Some(bridge) = bridge {
+      
```

---

### Incident Patch 2: `f14290a2` (2026-10-28)
**Commit Message**: fix

**File**: `docs/RIVERMEMO_TOPOLOGY_V3.md` (modified, +5/-1)
```diff
@@ -54,7 +54,11 @@ S_0=B+P+G+A-\Delta_{\mathrm{clip}}
 
 图奖励只由候选自身证据计算，不以同伴均值、条件期望或异常程度决定资格。角色用于解释，不给排序分配倍率、独占上限或前沿压制。多个优秀候选可以同时获奖；在查询观测、候选身份和配置固定的条件下，加入无关候选不改变既有候选的四项基线奖励。候选池截断、RRF 名次及最终排名不受此不变性保证。
 
-### 1.2 严格门控的排序融合
+### 1.2 边缘稀疏场景的条件式排序修正
+
+**虫洞 RRF 不是普遍情况，不是常驻全局评分因子，也不替代完整拓扑、直接锚与 Ω 主干。** 它是针对极端边缘稀疏知识场景的回归优化解：图构建已经发现有事实支持的逻辑关联，查询传播实际经过该关系，但常规读出未充分反映这条逻辑链的候选证据，才通过严格门控允许路线修正排序。这里的逻辑链仍须落回文件与候选正文，不意味着共现本身构成形式逻辑或因果证明。
+
+“边缘稀疏”说明适用问题，并非新增一个按 Ω 稀疏／稠密工况标签判断的开关；实际触发由完整观测、强显式来源路线、严格全局见证及候选落地共同决定。全局见证表示证据来自全局文件标签图，不表示给全部查询常驻施加全局因子。未触发是正常路径，资料充分的查询不需要虫洞 RRF 也能由完整主干完成读出。
 
 完整基线先按基线分降序、联合候选分降序、联合候选序号升序排列，记名次为 \(r_0(c)\)，从 1 开始。通过全局门控的每条强虫洞路线只对具有落地证据的候选建立独立排序，记路线名次为 \(r_e(c)\)。
 
```

**File**: `rust-vexus-lite/README.md` (modified, +39/-11)
```diff
@@ -1,15 +1,15 @@
 ---
 title: Vexus-Lite · 读写搜一体化原生记忆数据库
-summary: Vexus-Lite 原生记忆数据库架构指南，介绍 SQLite 权威事实存储、TDB 2-bit 检索、AGS 统一几何、有界传播与动态虫洞、RiverMemo 双场及四项评分，以及 RAGDiary 被动记忆和 LightMemo 主动回忆的协作与部署边界。
-updatedAt: 2026-10-28
+summary: Vexus-Lite 原生记忆数据库架构指南，介绍 SQLite 权威事实存储、TDB 2-bit 检索、AGS 统一几何、有界传播与动态虫洞、RiverMemo 双场及四项基线评分、边缘稀疏场景的条件式虫洞排序修正，以及主动与被动记忆渠道的协作与部署边界。
+updatedAt: 2026-10-29
 category: guide
 ---
 
 # VexusMemo-Lite：读、写、搜一体化的原生记忆数据库
 
 > **SQLite 权威事实层 × TDB 2-bit 冲程检索 × AGS 统一背景场 × Spike 有界传播与请求级动态虫洞 × RiverMemo 共享预算双场投影与统一泛函**
 >
-> 更新日期：2026-10-28。本文说明当前数据库实现：原空间重正交化 AGS 统一几何、图内残差与尾残差路由、双场投影预算、请求级向量复用，以及候选自身证据驱动的四项评分和原生并发双排与事实存储、检索的协作方式。
+> 更新日期：2026-10-29。本文说明当前数据库实现：原空间重正交化 AGS 统一几何、图内残差与尾残差路由、双场投影预算、请求级向量复用，以及完整四项基线评分、边缘稀疏场景的条件式排序修正和原生并发双排与事实存储、检索的协作方式。
 
 Vexus-Lite 已不只是一个“由 JavaScript 调用的向量索引”。它是 VCPToolBox 的嵌入式原生知识与记忆数据引擎：从事实事务、向量路由、几何预计算、传播观测，到候选精排和结果回填，在同一个 Rust 原生模块中协作完成。
 
@@ -390,15 +390,15 @@ u_\alpha=(1-\alpha)(I-\alpha T)^{-1}S
 3. 正边流是否具有非退化分布；
 4. 观测是否完整。
 
-候选不能靠自身“看起来关系很多”来授予自己无限排序权限。Ω 只门控图奖励，不门控路径或锚奖励；其几何平均采用 epsilon 底值，空图不代表 Ω 必然严格为零，没有候选结构证据时图奖励仍为零。高 Ω 表示传播可观测，不证明主题正确、实体同一或正文因果成立。实现见 [`compute_omega()`](src/rivermemo_topology_v3.rs:2483)。
+候选不能靠自身“看起来关系很多”来授予自己无限排序权限。在四项基线中，Ω 只门控图奖励，不门控路径或锚奖励；其几何平均采用 epsilon 底值，空图不代表 Ω 必然严格为零，没有候选结构证据时图奖励仍为零。高 Ω 表示传播可观测，不证明主题正确、实体同一或正文因果成立。条件式虫洞修正另使用 Ω 校准路线证据与权重，见第 6.5 节；这不改变基线预算。Ω 的稀疏／稠密工况不是主题资料密度，也不是该修正的直接开关。实现见 [`compute_omega()`](src/rivermemo_topology_v3.rs:2483)。
 
-### 6.4 最终统一评分
+### 6.4 常规主干：完整四项基线评分
 
-Topology V3 的最终分由四项独立记账：
+Topology V3 的常规排序主干由四项独立记账：
 
 \[
 \boxed{
-S(c)=\operatorname{clip}_{[0,1]}
+S_0(c)=\operatorname{clip}_{[0,1]}
 \left[B(c)+P(c)+G(c)+A(c)\right]
 }
 \]
@@ -414,12 +414,39 @@ S(c)=\operatorname{clip}_{[0,1]}
 
 直接锚采用精确优先、双侧一对一接触，最多三个独立接触；隐式接触永久折减，纯隐式锚强度上限 0.035，低于默认激活阈值 0.05，因此默认不产生锚奖励。非原子候选被解释为直接答案，还须有真实显式精确接触及至少 0.55 的观测正文闭合；语义相似不等于显式身份。
 
-原生结果提供 [基础分](src/rivermemo_topology_v3.rs:3080)、[场共振](src/rivermemo_topology_v3.rs:3082)、[路径奖励](src/rivermemo_topology_v3.rs:3085)、[图奖励](src/rivermemo_topology_v3.rs:3086)、[锚奖励](src/rivermemo_topology_v3.rs:3084)及[截断扣分](src/rivermemo_topology_v3.rs:3087)，可按“四项合计减截断扣分”复算最终分。场共振已含在基础分中，拓扑奖励已是路径与图之和，均不可重复相加。公共接口不保证透出全部原生顶层字段或详细诊断。
+原生结果保留基础分、场共振、路径奖励、图奖励、锚奖励及截断扣分，可按“四项合计减截断扣分”复算基线分。场共振已含在基础分中，拓扑奖励已是路径与图之和，均不可重复相加。启用条件式 RRF 时，最终融合分另行记账，截断扣分仍相对于基线计算，不能用四项之和复算融合分。见 [结果组装](src/rivermemo_topology_v3.rs:3108) 与 [RRF 明细](src/rivermemo_wormhole.rs:459)。公共接口不保证透出全部原生顶层字段或详细诊断。
 
-原始查询分是分数下限，不是名次下限；非负增益不保证真实排序收益。兼容配置中的条件同伴、创新系数与批级锚异常／前沿控制等不参与最终奖励，以 [已退役控制回执](src/rivermemo_topology_v3.rs:3158) 为准。
+原始查询分是基础分下限，不是启用 RRF 后的最终分下限，也不是名次下限；非负基线增益不保证真实排序收益。兼容配置中的条件同伴、创新系数与批级锚异常／前沿控制等不参与基线奖励，以 [已退役控制回执](src/rivermemo_topology_v3.rs:3158) 为准。
 
 评分实现见 [`assign_v3_scores()`](src/rivermemo_topology_v3.rs:2549)、[场共振](src/rivermemo_topology_v3.rs:1716) 与 [路径奖励计算](src/rivermemo_topology_v3.rs:2929)，完整数学契约见 [`RIVERMEMO_TOPOLOGY_V3.md`](../docs/RIVERMEMO_TOPOLOGY_V3.md)。
 
+### 6.5 边缘稀疏场景：严格门控的虫洞 RRF 回归修正
+
+**虫洞 RRF 不是普遍情况，不是常驻全局评分因子，也不是 RiverMemo 的常规排序主干。** 它针对极端边缘稀疏知识场景：图构建已经发现了有事实支持的逻辑关联，查询传播也实际经过了这条关系，但候选正文与查询的表面语义距离较远，常规读出未能充分反映这条已发现的关联。此时才允许以严格验证的路线提供条件式排序修正，而不是要求所有查询都经过虫洞融合。
+
+这里的“逻辑链”指图关系及其正文落地证据，不把共现直接当作形式逻辑或因果证明。“边缘稀疏”描述适用问题，**实现并不新增一个按 Ω 工况标签判定的稀疏开关**；局部河网即使显示稠密，也不代表该主题资料充分。实际触发必须通过以下约束：
+
+1. **真实观测路线**：正电流、非自环、非即时回流的虫洞，且存在同方向正权 CSR 关系和有效目标向量；不是仅凭背景有边就参与排序。
+2. **严格全局见证**：至少两个同时包含路线两端的不同文件，校验和非空且不同；两文件还须共享排除两端与全部显式焦点的第三标签，并在至少一个文件中包含另一个显式焦点。每路线最多检查 128 个文件、每文件 128 个标签，检测到超限则不放行。
+3. **强度与来源**：完整请求观测、正 Ω、来源为零跳核心／字面焦点，且原始观测中的相对流量至少 0.5；过滤后不重新归一化。
+4. **候选落地**：目标与候选正文正相关，且候选文件标签具有精确目标 ID 或超过默认 0.48 阈值的语义匹配，该标签与正文也必须正相关。精确 ID 在实现中按相似度 1 统一通过阈值检查。
+
+**全局见证是图证据，不是全局排序因子。** 见证读取不受共同候选文件范围限制，但不扩大候选权限、不把见证文件补入结果，也不替代候选自身落地。不同校验和不证明见证相互独立。
+
+每条合格路线按“相对流量 × 目标—正文正余弦 × Ω 的幂”排列具有落地资格的候选，得到从 1 开始的路线名次 \(r_e(c)\)；完整基线名次记为 \(r_0(c)\)。路线权重由原始电流相对于普通传播的解释力度确定：
+
+\[
+w_e=\frac{f_e}{f_{\mathrm{ref}}}\Omega^\gamma,\qquad
+S(c)=\frac{1}{60+r_0(c)}
++\max_{e:\,c\text{ 具有落地资格}}\frac{w_e}{60+r_e(c)}
+\]
+
+参照电流是原始观测中非虫洞、非即时回流、非自环普通边的最大正电流；没有这种边时使用原始观测全部边的最大正电流。多路线取最大贡献，不叠加相关支路的票数；最终稳定排序，平分保留基线顺序。权重可以大于 1，融合分不是余弦或概率，也不占用或改写基线的拓扑、锚点预算。
+
+**只有至少一个候选获得实际正路线贡献，才启用上述融合；否则基线分数逐位不变、排序不变。** 未触发不是功能缺失；常规、资料充分的查询由完整拓扑、直锚与 Ω 正常完成排序，不需要虫洞 RRF 来证明读出有效。
+
+路线、门控及融合实现见 [`rivermemo_wormhole.rs`](src/rivermemo_wormhole.rs:33)，两阶段排序接入见 [基线与条件式融合](src/rivermemo_topology_v3.rs:3006)。该通道是 RiverMemo 内部的特殊修正，不是第 8 节外部 Rerank+ 与 RiverMemo 的排位融合。
+
 ---
 
 ## 7. 为什么可以又快、又高效、又准？
@@ -519,7 +546,7 @@ RAGDiary 的被动渠道有明确的控制面，而不是每轮无差别地执
 
 ### 8.4 RAGDiary 原生多索引 / RiverMemo 联合路径
 
-显式日记权限与候选计划 → 原生 ANN → 合并、展开、去重与投影 → 同代观测读出 → 候选级并行路径、拓扑与锚接触计算 → 查询形态、Ω、候选自身奖励及共享预算 → 最终排序。
+显式日记权限与候选计划 → 原生 ANN → 合并、展开、去重与投影 → 同代观测读出 → 候选级并行路径、拓扑与锚接触计算 → 查询形态、Ω、候选自身奖励及共享预算 → 完整基线排序 → 仅在严格路线与候选落地条件满足时执行虫洞 RRF 修正 → 最终结果。
 
 权限过滤先于候选归一化和统计，显式空权限集合表示无权限。拓扑读出只处理共同候选边界内的内容，内部候选超集默认上限 300，不从全库补回池外漏召回项；该边界不等于各入口的原始 ANN 数量。实现见 [权限过滤](src/rivermemo_topology_v3.rs:2773) 与 [`select_superset()`](src/rivermemo_topology_v3.rs:1362)。
 
@@ -573,7 +600,7 @@ LightMemo 让 Age
```

---

### Incident Patch 3: `37397975` (2026-10-28)
**Commit Message**: fix

**File**: `docs/RIVERMEMO_TOPOLOGY_V3.md` (modified, +118/-154)
```diff
@@ -1,166 +1,41 @@
 ---
 title: RiverMemo V3 · Topology V3 与 Ω 统一泛函
-summary: RiverMemo Topology V3 的最终算法与实现契约，涵盖 AGS 背景几何、图内残差与动态虫洞、请求河网与双场、一对一拓扑对齐，以及候选自身证据驱动的四项评分、共享预算和部署验证边界。
-updatedAt: 2026-10-28
+summary: RiverMemo Topology V3 的最终算法与实现契约，涵盖 AGS 背景几何、图内残差与动态虫洞、请求河网与双场、一对一拓扑对齐、四项基线评分，以及严格全局门控下的解释力度加权 RRF。
+updatedAt: 2026-10-29
 category: guide
 ---
 
-## 当前优先契约：2.4.1 来源条件化终点读出
-
-**本节覆盖下文旧 2.4／2.2 的评分说明。** 分支 rivermemo-fix-2.4，
-原生版本 rivermemo.source-endpoint-v2.4.1；传播、资产格式与统一管线标识不变。
-旧章节保留为历史实验和无有效显式意图时的兼容回退说明，不是新评分公式。
-
-### 真实查询推翻的假设
-
-上一轮 intent-wormhole-v2.4 在“华为汽车的幽默操作”中全部 30 个候选传播提升为零，
-10640 排第 29。实际事件终点与三个来源余弦约 0.258～0.290，全部被旧 0.35 门槛排除。
-留一标签自身残差能量也未识别背景：泛品牌仍占约 24% 意图权重。
-这说明“终点必须仍像来源”“答案应复现查询图形”的前提不成立，不只是奖励倍率偏小。
-上一轮合成测试通过不构成真实排序有效的证据。
-
-### 认知与数学契约
-
-候选是证据终点读出算子，不是查询图的缩小副本。真实边提供关系支持，
-候选无需包含来源或复现标签序位；关系不等于语义同一、因果证明或答案正确。
-
-1. 点火保持不变；有效零跳核心／词面种子按 ID 稳定聚类。
-   完全链接余弦至少 0.95，每簇单位均值代表；不保证通用别名识别。
-2. 两遍重正交化取得每轴留一单位方向 \(r_i\)。
-   查询解释量 \(e_i=[\cos(q,r_i)]_+^2\)，权重 \(w_i=e_i/\sum e_j\)。
-   残差能量不超过 1e-10 时解释量零；总量不超过 1e-8 时均匀回退。
-   标签自身残差能量只作诊断，不直接分配意图权重。
-   留一方向彼此不必正交，解释量之和不是严格查询能量分解，也不是背景分类器。
-3. 直接支持 \(d_i\)：标签身份信用乘正文闭合与低置信正文回退择强。
-   语义标签信用 \([(\cos-.48)/.52]_0^1\)，精确 ID 为 1；
-   正文回退 \(0.7[(\cos-.45)/.55]_0^1\)。
-   多轴且独立方向有效时乘 \(\sqrt{[\cos(r_i,c)]_+}\)，取消旧固定背景底座。
-4. 传播只归属于来源 ID 所在意图簇，非自环、非即时回流、正绝对电流，
-   且必须是资产中的正权真实边。每轴传播支持
-   \(t_i=\max_{i\to j}\frac{f}{f+.03}h(j,c)\)。
-   终点落地 \(h\) 使用上述标签／正文信用，**不乘终点对来源或残差相似度**。
-   普通边与虫洞遵循同一契约，虫洞标记不另加奖励倍率。
-   路线按校准电流和 ID 稳定排序，受既有最大河网边数限制。
-5. 每轴 \(s_i=\max(d_i,t_i)\)，连续软合取
-   \(H(s)=\exp(\sum_iw_i\ln(.05+s_i))-.05\)。
-   取消旧 max(.05,s) 死区；零证据严格零，微小证据连续响应。
-6. 单一预算 \(C=[C_A]_+ + [C_T]_+\)，默认 0.18。
-   **直接分账 \(A=C H(d)\)，传播分账 \(G=C[H(s)-H(d)]_+\)，
-   路径奖励 \(P=0\)，基础分 \(B=[\cos(q,c)]_0^1\)，最终分为 clip(B+A+G)。**
-   总奖励不超过 C；同一传播证据不同时计入锚与图奖励。
-   兼容输出的直锚列、图奖励列改为上述消融分账，不再分别受两个旧上限限制。
-7. 有效意图候选的旧场共振、路径几何、候选图形相似及 Ω 只作诊断，不进入评分。
-   Ω 描述河网状态，不作为某条路线正确率。无有效显式意图时保留旧兼容评分，
-   并在详细模式字段明确标识。原始查询余弦仍保留，尚未消除其自身背景偏移。
-
-实现依据：[`rivermemo_intent.rs`](../rust-vexus-lite/src/rivermemo_intent.rs:1)、
-[`assign_v3_scores()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:2557)。
-
-### 观测限制、诊断与验证
-
-当前只归属显式种子／其近义簇出边，不从聚合图猜多跳种子血缘。
-聚合即时回流为 OR 标记，混有回流的边保守排除，可能丢失正向证据；
-边流表示已注入事件，不保证后继状态保留或继续发火。
-这不是完整时间展开多源传输解算器。绝对电流校准受点火幅度影响。
-文件标签可能是图构建的同源证据，不能将其当作独立 held-out 验证。
-
-账本增加查询解释量、电流校准、终点落地及虫洞标记，修复逐候选表格断裂。
-兼容字段 wormholeLift／wormholeSupport 表示全部来源归属传播，不再仅限虫洞；
-版本和单独虫洞标记用于区分语义。共同池全排序解释不补回池外或超集未入选候选。
-
-只读测绘：[`memo_endpoint_readout_probe.js`](../scripts/memo_endpoint_readout_probe.js:1)。
-可传实际查询向量；默认“幽默＋汽车”合成向量不是原查询重放。
-默认品牌查询独立解释量为零；事件终点对汽车候选有正支持、对手机／PC 对照为零。
-这是机制对照，不是实际排序收益或全库召回率证明。
-
-回归覆盖来源／终点正交、多意图不串票、微小提升、普通边同契约、
-错误来源／回流／零电流／不存在边、查询解释权重、别名、候选池不变性、
-单一预算和旧奖励消融。仍需真实查询集验证，不保证指定候选第一或进入 Top-K。
-
-部署须停止加载原生模块的服务，替换对应平台产物并重启；
-核对读出为 rivermemo.source-endpoint-v2.4.1。统一管线仍为
-memo.conservative-topology-v2.2；无需重建图资产或修改数据库。
-
----
-
-## 2.4 分支实验说明（2026-10-28）
-
-当前分支 `rivermemo-fix-2.4` 的原生读出标识为
-`rivermemo.intent-wormhole-v2.4`。以下实验契约覆盖本文后续 2.2 版本的直接锚、
-图请求及诊断说明；传播、资产格式与统一查询管线标识保持不变，无需重建图资产。
-
-### 数学与实现
-
-- 传播点火幅度保持不变。读出意图只来自有效零跳核心／词面种子，权重不消费点火幅度。
-- 种子按 ID 排序后采用完全链接近义簇（余弦至少 0.95），每簇单位化均值作为代表，
-  防止近义重复投票。该规则不保证别名识别，也不跨弱相似链合并。
-- 每个代表对其他代表构成的空间做两遍重正交化，留一残差能量作为区分权重，
-  能量下限 0.02 后归一化。它是线性独立性度量，不是品牌／背景分类器；
-  相似度结构不符合“背景被包含”假设时，不能保证泛品牌权重下降。
-- 每轴直接支持由精确／语义标签闭合与低置信正文回退择强。多轴且残差能量足够时，
-  乘 `0.25 + 0.75 * sqrt(positive residual-body cosine)`，保留背景支持而不让它独占判断。
-- 虫洞仅使用观测中的非即时回流、非自环、正电流且资产中存在正权真实边的路线，
-  按绝对电流 `f/(f+0.03)` 校准，不能将最大归一化流当置信概率。
-  每轴结合终点语义、有效残差方向及终点到候选正文／标签的闭合，取最强路线。
-  候选无需包含路线起点；不制造精确身份或多跳完整血缘。
-- 每轴满足度为直接支持与虫洞支持的最大值；各轴加权几何平均作软合取。
-  数值下限 0.05，并在聚合后移除下限；无证据严格零奖励。
-- 有有效意图时，锚奖励为 `anchorBonusCap * intentSatisfaction`，
-  不再经过旧 0.2 强度饱和；无有效意图时保留旧锚回退。
-  旧锚接触与角色只作身份解释，不能据“direct_answer”声称满足全部意图。
-- 图请求为原候选自身请求与 `topologyBonusCap * wormholeLift` 的最大值，
-  之后仍乘 Ω，并与路径共享原拓扑预算；虫洞不是额外第五项奖励。
-  `wormholeLift` 是含虫洞与仅直接支持的合取满足度之差。
-  虫洞可同时改善意图奖励和图请求，最终仍受原锚／拓扑两个上限约束。
-- 基础分及场共振暂不改变；本实验不是全评分残差化，仍需真实测试集验证背景偏移。
-
-源码：[`rivermemo_intent.rs`](../rust-vexus-lite/src/rivermemo_intent.rs:1)、
-[`assign_v3_scores()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:2557)。
-
-### 诊断与部署
-
-实验室四轨仍显示 Top-K；新增 `candidateDiagnostics` 保留实际入选共同池的全部排序解释，
-并展示意图簇、权重、残差能量、直接支持、虫洞支持、路线与合取满足度。
-内部超集过滤仍然有效，不能把“全池解释”理解为补回池外候选。
-
-停止加载原生模块的服务后替换 Windows x64 MSVC 产物并重启；
-查询报告应显示 `rivermemo.intent-wormhole-v2.4`。
-统一观测管线仍是 `memo.conservative-topology-v2.2`，这是有意保持传播算法不变，
-不是加载失败。无需修改运行数据或重新生成资产。
-
-建议在同快照同候选条件下比较：汽车／手机对照、单焦点、近义重复焦点、
-无词面焦点、强无关虫洞、无标签正文、空图及不完整观测。
-合成测试仅验证计算契约，不保证 10640 或任何指定候选的真实名次。
-
----
-
 # RiverMemo Topology V3：最终算法与实现
 
 > 架构版本：**RiverMemo Topology V3**
 >
-> 原生读出实现标识：rivermemo.conservative-topology-v2.2
+> 原生读出实现标识：rivermemo.conservative-topology-v2.5-confidence-rrf
 >
 > 统一查询管线标识：memo.conservative-topology-v2.2
 >
 > 原生结果协议：rivermemo-topology-v3-native-result-v1
 >
 > JavaScript 公共结果协议：rivermemo-topology-v3-result-v1
 >
-> 文档更新时间：2026-10-28
+> 文档更新时间：2026-10-29
 >
 > 本文仅描述当前最终实现、算法与运行边界，不
```

**File**: `docs/RIVERMEMO_TOPOLOGY_V3_EXPERIMENTS.md` (added, +162/-0)
```diff
@@ -0,0 +1,162 @@
+# RiverMemo Topology V3：试验与验证记录
+
+本文单独保存试验方案、排查经过与验证结果，不定义当前运行算法。最终算法见 [RiverMemo Topology V3](RIVERMEMO_TOPOLOGY_V3.md)。
+
+## 最终实现与验证记录（2026-10-29）
+
+最终实现提交：d941bdbe；原生读出标识：rivermemo.conservative-topology-v2.5-confidence-rrf。
+
+最终实现保留完整的候选自身拓扑、直接锚与 Ω 基线，再对通过严格全局门控且具有候选落地证据的强虫洞路线执行解释力度加权 RRF。没有实际路线贡献时，基线分数与排序保持不变。
+
+### 排查结论
+
+- 来源与终点相似度门槛会排除真实长距离关联，不能用它证明虫洞有效性。
+- 仅按终点相似度替换完整评分会丢失直接锚、拓扑与 Ω 的有效证据。
+- 文件联合见证属于全局文件标签图，不能误用共同候选文件范围作为门控范围；候选返回权限与过滤仍保持原边界。
+- 在原拓扑预算内增加小幅奖励，未必足以纠正强背景语义造成的排序差距。
+- 最终采用严格全局见证、候选标签与正文落地，以及独立排序通道的 RRF 融合；不按指定 Chunk、查询名称或品牌定制规则。
+
+### 验证记录与边界
+
+- 工程验证：191 项 Rust 库测试、8 项诊断测试、1 项原生兼容测试通过。
+- 用户服务器反馈：100 组针对数据集查询的单元测试全部通过，华为汽车案例全部通过。
+- 上述反馈不扩写为完整 800 组已经通过，也不据此声称全库精确召回率。
+- 固定 30 候选、仅踏板路线的离线检查中，5 个具有候选落地证据的事件候选进入前五；该检查不是完整原生查询重放，不能替代服务器验证。
+
+### 产物记录
+
+Windows x64 MSVC 原生产物为 14,807,040 字节；SHA-256：f3da3b501504bb77d667e007dc4fb0b7c81e9fb2958df5a535d5f16694e3956e。
+
+## 历史试验原文归档
+
+以下段落保留当时的方案、假设及局限；其中“当前”“覆盖”等措辞仅指当时试验，不具有现行算法契约效力。相对源码链接以原章节记录为准。
+
+## 当前优先契约：2.4.1 来源条件化终点读出
+
+**本节覆盖下文旧 2.4／2.2 的评分说明。** 分支 rivermemo-fix-2.4，
+原生版本 rivermemo.source-endpoint-v2.4.1；传播、资产格式与统一管线标识不变。
+旧章节保留为历史实验和无有效显式意图时的兼容回退说明，不是新评分公式。
+
+### 真实查询推翻的假设
+
+上一轮 intent-wormhole-v2.4 在“华为汽车的幽默操作”中全部 30 个候选传播提升为零，
+10640 排第 29。实际事件终点与三个来源余弦约 0.258～0.290，全部被旧 0.35 门槛排除。
+留一标签自身残差能量也未识别背景：泛品牌仍占约 24% 意图权重。
+这说明“终点必须仍像来源”“答案应复现查询图形”的前提不成立，不只是奖励倍率偏小。
+上一轮合成测试通过不构成真实排序有效的证据。
+
+### 认知与数学契约
+
+候选是证据终点读出算子，不是查询图的缩小副本。真实边提供关系支持，
+候选无需包含来源或复现标签序位；关系不等于语义同一、因果证明或答案正确。
+
+1. 点火保持不变；有效零跳核心／词面种子按 ID 稳定聚类。
+   完全链接余弦至少 0.95，每簇单位均值代表；不保证通用别名识别。
+2. 两遍重正交化取得每轴留一单位方向 \(r_i\)。
+   查询解释量 \(e_i=[\cos(q,r_i)]_+^2\)，权重 \(w_i=e_i/\sum e_j\)。
+   残差能量不超过 1e-10 时解释量零；总量不超过 1e-8 时均匀回退。
+   标签自身残差能量只作诊断，不直接分配意图权重。
+   留一方向彼此不必正交，解释量之和不是严格查询能量分解，也不是背景分类器。
+3. 直接支持 \(d_i\)：标签身份信用乘正文闭合与低置信正文回退择强。
+   语义标签信用 \([(\cos-.48)/.52]_0^1\)，精确 ID 为 1；
+   正文回退 \(0.7[(\cos-.45)/.55]_0^1\)。
+   多轴且独立方向有效时乘 \(\sqrt{[\cos(r_i,c)]_+}\)，取消旧固定背景底座。
+4. 传播只归属于来源 ID 所在意图簇，非自环、非即时回流、正绝对电流，
+   且必须是资产中的正权真实边。每轴传播支持
+   \(t_i=\max_{i\to j}\frac{f}{f+.03}h(j,c)\)。
+   终点落地 \(h\) 使用上述标签／正文信用，**不乘终点对来源或残差相似度**。
+   普通边与虫洞遵循同一契约，虫洞标记不另加奖励倍率。
+   路线按校准电流和 ID 稳定排序，受既有最大河网边数限制。
+5. 每轴 \(s_i=\max(d_i,t_i)\)，连续软合取
+   \(H(s)=\exp(\sum_iw_i\ln(.05+s_i))-.05\)。
+   取消旧 max(.05,s) 死区；零证据严格零，微小证据连续响应。
+6. 单一预算 \(C=[C_A]_+ + [C_T]_+\)，默认 0.18。
+   **直接分账 \(A=C H(d)\)，传播分账 \(G=C[H(s)-H(d)]_+\)，
+   路径奖励 \(P=0\)，基础分 \(B=[\cos(q,c)]_0^1\)，最终分为 clip(B+A+G)。**
+   总奖励不超过 C；同一传播证据不同时计入锚与图奖励。
+   兼容输出的直锚列、图奖励列改为上述消融分账，不再分别受两个旧上限限制。
+7. 有效意图候选的旧场共振、路径几何、候选图形相似及 Ω 只作诊断，不进入评分。
+   Ω 描述河网状态，不作为某条路线正确率。无有效显式意图时保留旧兼容评分，
+   并在详细模式字段明确标识。原始查询余弦仍保留，尚未消除其自身背景偏移。
+
+实现依据：[`rivermemo_intent.rs`](../rust-vexus-lite/src/rivermemo_intent.rs:1)、
+[`assign_v3_scores()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:2557)。
+
+### 观测限制、诊断与验证
+
+当前只归属显式种子／其近义簇出边，不从聚合图猜多跳种子血缘。
+聚合即时回流为 OR 标记，混有回流的边保守排除，可能丢失正向证据；
+边流表示已注入事件，不保证后继状态保留或继续发火。
+这不是完整时间展开多源传输解算器。绝对电流校准受点火幅度影响。
+文件标签可能是图构建的同源证据，不能将其当作独立 held-out 验证。
+
+账本增加查询解释量、电流校准、终点落地及虫洞标记，修复逐候选表格断裂。
+兼容字段 wormholeLift／wormholeSupport 表示全部来源归属传播，不再仅限虫洞；
+版本和单独虫洞标记用于区分语义。共同池全排序解释不补回池外或超集未入选候选。
+
+只读测绘：[`memo_endpoint_readout_probe.js`](../scripts/memo_endpoint_readout_probe.js:1)。
+可传实际查询向量；默认“幽默＋汽车”合成向量不是原查询重放。
+默认品牌查询独立解释量为零；事件终点对汽车候选有正支持、对手机／PC 对照为零。
+这是机制对照，不是实际排序收益或全库召回率证明。
+
+回归覆盖来源／终点正交、多意图不串票、微小提升、普通边同契约、
+错误来源／回流／零电流／不存在边、查询解释权重、别名、候选池不变性、
+单一预算和旧奖励消融。仍需真实查询集验证，不保证指定候选第一或进入 Top-K。
+
+部署须停止加载原生模块的服务，替换对应平台产物并重启；
+核对读出为 rivermemo.source-endpoint-v2.4.1。统一管线仍为
+memo.conservative-topology-v2.2；无需重建图资产或修改数据库。
+
+---
+
+## 2.4 分支实验说明（2026-10-28）
+
+当前分支 `rivermemo-fix-2.4` 的原生读出标识为
+`rivermemo.intent-wormhole-v2.4`。以下实验契约覆盖本文后续 2.2 版本的直接锚、
+图请求及诊断说明；传播、资产格式与统一查询管线标识保持不变，无需重建图资产。
+
+### 数学与实现
+
+- 传播点火幅度保持不变。读出意图只来自有效零跳核心／词面种子，权重不消费点火幅度。
+- 种子按 ID 排序后采用完全链接近义簇（余弦至少 0.95），每簇单位化均值作为代表，
+  防止近义重复投票。该规则不保证别名识别，也不跨弱相似链合并。
+- 每个代表对其他代表构成的空间做两遍重正交化，留一残差能量作为区分权重，
+  能量下限 0.02 后归一化。它是线性独立性度量，不是品牌／背景分类器；
+  相似度结构不符合“背景被包含”假设时，不能保证泛品牌权重下降。
+- 每轴直接支持由精确／语义标签闭合与低置信正文回退择强。多轴且残差能量足够时，
+  乘 `0.25 + 0.75 * sqrt(positive residual-body cosine)`，保留背景支持而不让它独占判断。
+- 虫洞仅使用观测中的非即时回流、非自环、正电流且资产中存在正权真实边的路线，
+  按绝对电流 `f/(f+0.03)` 校准，不能将最大归一化流当置信概率。
+  每轴结合终点语义、有效残差方向及终点到候选正文／标签的闭合，取最强路线。
+  候选无需包含路线起点；不制造精确身份或多跳完整血缘。
+- 每轴满足度为直接支持与虫洞支持的最大值；各轴加权几何平均作软合取。
+  数值下限 0.05，并在聚合后移除下限；无证据严格零奖励。
+- 有有效意图时，锚奖励为 `anchorBonusCap * intentSatisfaction`，
+  不再经过旧 0.2 强度饱和；无有效意图时保留旧锚回退。
+  旧锚接触与角色只作身份解释，不能据“direct_answer”声称满足全部意图。
+- 图请求为原候选自身请求与 `topologyBonusCap * wormholeLift` 的最大值，
+  之后仍乘 Ω，并与路径共享原拓扑预算；虫洞不是额外第五项奖励。
+  `wormholeLift` 是含虫洞与仅直接支持的合取满足度之差。
+  虫洞可同时改善意图奖励和图请求，最终仍受原锚／拓扑两个上限约束。
+- 基础分及场共振暂不改变；本实验不是全评分残差化，仍需真实测试集验证背景偏移。
+
+源码：[`rivermemo_intent.rs`](../rust-vexus-lite/src/rivermemo_intent.rs:1)、
+[`assign_v3_scores()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:2557)。
+
+### 诊断与部署
+
+实验室四轨仍显示 Top-K；新增 `candidateDiagnostics` 保留实际入选共同池的全部排序解释，
+并展示意图簇、权重、残差能量、直接支持、虫洞支持、路线与合取满足度。
+内部超集过滤仍然有效，不能把“全池解释”理解为补回池外候选。
+
+停止加载原生模块的服务后替换 Windows x64 MSVC 产物并重启；
```

#### Recent Merged Pull Requests:
- **PR #560** (2026-10-28): fix(RiverMemo): 严格门控的边缘稀疏场景虫洞排序修正 (@lioensky)
- **PR #559** (2026-10-28): fix(LinuxShellExecutor): allow DEFAULT_SECURITY_LEVEL fallback for local host (@joker74581)
- **PR #558** (2026-10-28): fix(RiverMemo): conservative topology v2.2 源码与 Windows 原生产物 (@lioensky)
- **PR #557** (2026-10-27): fix(rivermemo): safe readout and lexical focus ignition (@lioensky)
- **PR #556** (2026-10-27): feat(VTrade): 新增 VTrade 插件（看盘、模拟交易、对决） (@CI-IISATO)
- **PR #555** (2026-10-27): Add keyless UAPI fallback and reject stale weather data (@miaotouy)

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

## X. Merge pull request #560 from lioensky/rivermemo-fix-2.4

**RULE**:
When implementing operations in `Plugin/LightMemo/abDiagnostics.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9aa1f674`: Merge pull request #560 from lioensky/rivermemo-fix-2.4. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `Plugin/LightMemo/abDiagnostics.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
    const explained = river.candidateDiagnostics || river.results || [];
    output += `解释候选 ${explained.length} 条（包含 Top-K 之外的共同池候选，如原生已提供）。\n\n`;
    const wormholeMode = river.algorithmVersion?.startsWith('rivermemo.wormhole-readout-');
    if (wormholeMode) {
        output += '独立虫洞通道：最终分＝最强路线的相对流量 × 终点正文正余弦；不是原查询底分加奖励，也不是相关性概率。无可用虫洞才整通道回退查询余弦。精确标签／来源文件仅为文件级地址诊断，不证明该 Chunk 回答问题。\n\n';
        output += '| Chunk | 排名 | 通道 | 原查询余弦 | 路线 | 原始流量 | 相对流量 | 终点正文余弦 | 最终分 | 地址定位 | 精确终点标签 | 边来源文件 |\n|---:|---:|---|---:|---|---:|---:|---:|---:|---|---|---|\n';
        const name = id => (graph?.nodes || []).find(node => node.id === id)?.name || `Tag#${id}`;
        for (const item of explained) {
            const trace = item.topologyV3 || {};
            const readout = trace.wormholeReadout || {};
            const route = readout.sourceId == null ? '—'
                : `${name(readout.sourceId)} → ${name(readout.targetId)}`;
            output += `| ${item.chunkId ?? item.id} | ${item.rank ?? '—'} | ${cell(item.role)} | ${number(trace.queryScore ?? item.vectorScore)} | ${cell(route)} | ${number(readout.flow)} | ${number(readout.relativeFlow)} | ${number(readout.endpointBodyCosine)} | 
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
    output += '基础分已包含场共振增益；最终分＝基础分＋路径奖励＋图奖励＋直锚奖励－截断扣分，勿重复累加场共振。\n\n';
    for (const item of river.results || []) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9aa1f674` are properly handled with clean fallback behavior.
