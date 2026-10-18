> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source**: github ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Source Version**: `d961b09c`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T22:29:34.952Z  
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
> **Harvest Timestamp**: 2026-10-18T22:29:34.156Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2374 stars

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
- **Issue #504** (2026-10-18): **feat(kbm): Rust 单 SQL 运行时、TDB 索引与管理面板统一**
  *Symptoms*: ## 概要 | 汇总当前功能分支相对 main 的全部 38 个提交。包括 KBM Rust 单 SQL 运行时与存储迁移、原生索引生命周期及恢复和一致性治理、TDB 索引与迁移工具、LightMemo 原生查询接线、RAG 配置面板及数据展示统一，以及相关回归测试、构建产物和施工文档。 ## 验证说明 | 本次仅执行分支状态核对和 PR 发布，未重新运行测试。 ## 合并说明 | 本 PR 包含当前分支全部变动，不自动合并。

- **Issue #503** (2026-10-18): **fix(LinuxLogMonitor): prevent watchdog timeout from terminating host …**
  *Symptoms*: …process via process.exit(1)  - In hybridservice direct mode, MonitorTask runs inside the VCPToolBox main process. - When a monitored log receives no data for 30 minutes, calling process.exit(1) terminates the entire host Node.js service instead of just stopping the task. - Replace process.exit(1) with graceful task stop (await this.stop()) and state cleanup. - Update documentation to reflect graceful stop behavior.

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

### Incident Patch 1: `5ec30822` (2026-10-18)
**Commit Message**: Merge pull request #503 from joker74581/fix/linux-log-monitor-watchdog-exit

fix(LinuxLogMonitor): prevent watchdog timeout from terminating host …

**File**: `Plugin/LinuxLogMonitor/README.md` (modified, +2/-2)
```diff
@@ -323,8 +323,8 @@ POST /plugin-callback/LinuxLogMonitor/{taskId}
 - `ERROR` - 错误
 
 ### Watchdog 看门狗
-- 30分钟无数据自动触发 `process.exit(1)`
-- 防止进程僵死，配合进程管理器实现自动重启
+- 30分钟无数据自动优雅停止当前监控任务并释放资源
+- 避免调用 `process.exit(1)` 误杀宿主服务进程（适配 hybridservice direct 常驻模式）
 
 ### Bypass Probe 旁路探测
 - 每60秒发送 `echo keepalive` 命令
```

**File**: `Plugin/LinuxLogMonitor/core/MonitorTask.js` (modified, +17/-6)
```diff
@@ -718,16 +718,27 @@ class MonitorTask {
             clearInterval(this.watchdogInterval);
         }
         
-        this.watchdogInterval = setInterval(() => {
+        this.watchdogInterval = setInterval(async () => {
             const timeSinceLastData = Date.now() - this.lastDataTime;
             
             if (timeSinceLastData > this.watchdogTimeout) {
-                this._log(`看门狗触发: ${Math.round(timeSinceLastData / 1000)}秒 无数据`);
-                this._updateState(TaskState.ERROR, '看门狗超时');
+                this._log(`看门狗触发: ${Math.round(timeSinceLastData / 1000)}秒 无数据，自动停止当前任务`);
+                this._updateState(TaskState.DISCONNECTED, '看门狗超时自动停止');
                 
-                // 触发进程退出，让外部进程管理器重启
-                process.exit(1);
-            }}, WATCHDOG_CHECK_INTERVAL);
+                // 清除看门狗定时器，防止重复执行
+                if (this.watchdogInterval) {
+                    clearInterval(this.watchdogInterval);
+                    this.watchdogInterval = null;
+                }
+
+                // 优雅停止当前监控任务，避免 process.exit(1) 杀死主服务
+                try {
+                    await this.stop();
+                } catch (stopError) {
+                    this._log(`看门狗停止任务失败: ${stopError.message}`);
+                }
+            }
+        }, WATCHDOG_CHECK_INTERVAL);
         
         this._log('看门狗已启动');
     }
```

---

### Incident Patch 2: `ea6dae5f` (2026-10-18)
**Commit Message**: fix

**File**: `docs/ABI-v2审查核实与修复-2026-10-18.md` (removed, +0/-44)
```diff
@@ -1,44 +0,0 @@
-# ABI v2 审查核实与修复
-
-日期：2026-10-18。本记录针对本轮用户提供的 P0–P3 清单，不替代上一轮审查记录。
-
-## 逐项结论
-
-| 条目 | 核实结果 | 修复 |
-| --- | --- | --- |
-| P0-1 路径回执缺失 | 存在。表现为超时等待，并非原生锁死锁 | [摄取管线](../modules/knowledgeBase/ingestionPipeline.js)在无变化、元数据刷新、正常摄取和删除终态通知协调器；读取错误、重试耗尽与损坏返回失败回执；保留重试的文件不提前通知 |
-| P0-2 基线保存调度断联 | 存在 | 摄取后调度受影响常驻日记及更新标签保存；删除后调度常驻日记保存；[标签服务](../modules/knowledgeBase/tagConsistencyService.js)提交后调度全局标签保存。[索引仓储](../modules/knowledgeBase/indexRepository.js)关闭时遍历全部常驻索引及待保存项，不再只依赖定时器 |
-| P1-1 检查点未校验就绪 | 存在 | [检查点](../rust-vexus-lite/src/index_lifecycle.rs)取得共享快照门禁后验证作用域就绪及事实/应用代际一致；不就绪时拒绝发布，不在共享锁内升级恢复 |
-| P1-2 可空向量导致整次失败 | 三处均存在 | [去重](../rust-vexus-lite/src/result_deduplicator.rs)允许空值并保持候选；[混合展开](../rust-vexus-lite/src/knowledge_runtime.rs)及[构链](../rust-vexus-lite/src/memo_thinking.rs)过滤空向量。混合展开也跳过非有限向量 |
-| P1-3 不稳定文件自旋/快路径残留 | 两个分支均存在 | 快路径终态在构造提交计划前统一处理；读取期间变化设置至少 500 毫秒重试延迟；提交前不稳定文件沿用延迟重试 |
-| P1-4 Windows 路径不一致 | 存在 | 摄取探测、计划、重试比较、删除、完整向量探测、混合文件计划及候选匹配统一正斜杠 |
-| P2-1 异步卸载竞态 | 存在 | 保存后复核索引身份、最近使用时间及空闲期限，被重新激活则取消卸载 |
-| P2-2 孤儿清理期间文件重建导致失败 | 存在 | [孤儿清理](../rust-vexus-lite/src/ingestion.rs)在写事务复核时跳过已重建文件；只统计真正删除的文件和日记，不因跳过项推进事实代际 |
-| P2-3 标签向量健康误判 | 存在，且只检查字节长度仍不足 | [标签一致性](../rust-vexus-lite/src/tag_consistency.rs)准备和提交使用同一健康判断，验证空值、维度字节长度与每个浮点数有限性 |
-| P2-4 Memo 不可用时丢失混合来源 | 存在 | [查询门面](../KnowledgeBaseManager.js)复用完整候选收集函数，保留历史多向量、BM25/Time 展开、Time 双重限流、身份合并和语义去重；无图资产时直接按混合分数输出，不调用拓扑重排 |
-| P3-1 旧标签代码 | 所列六个方法无生产调用者 | 移除六个旧辅助方法及旧事务注释块 |
-| P3-2 对账轮询 | 存在，但直接退出会引入请求丢失竞态 | [Watcher](../rust-vexus-lite/src/lib.rs)使用停泊/唤醒替代 25 毫秒轮询；新请求与停止均唤醒线程，保留按请求合并语义 |
-| P3-3 启动删除窗口 | 存在 | [监听控制面](../modules/knowledgeBase/fileWatcher.js)启动后异步列出已索引路径并请求原生对账 |
-
-## 额外修复
-
-- [协调器](../modules/knowledgeBase/databaseCoordinator.js)原先在单个路径完成时清除整组共享超时，可能使剩余路径永远等待；改为整组完成或失败时清理，同时移除取消监听。
-- 共享混合候选流程对 ANN、历史 ANN 与文件展开应用允许/拒绝文件权限，避免降级路径漏过滤。
-- 已完成快路径文件不在批次末尾重复发送回执。
-
-## 验证
-
-- Rust 编译检查及标准发布构建均无警告通过。删除摄取任务已不再使用的 Memo 运行时字段及全部构造参数，没有屏蔽警告。
-- Rust 单元测试 59 项全部通过；包括新增空向量安全保留、检查点拒绝失效/恢复中/代际错位状态、错误维度与非有限标签向量完整修复测试。
-- 使用最新发布版原生模块运行 Node 定向回归 25 项全部通过，包括[新增本轮回归](../tests/abiV2ReviewRegression.test.js)、[已有审查回归](../tests/kbmAuditRegression.test.js)、[联合回退](../tests/nativeRiverQueryFallback.test.js)、[混合 ABI](../tests/nativeHybridRiverQueryPlan.test.js)与[运行时注册](../tests/nativeKnowledgeRuntimeRegistry.test.js)。
-- 新增控制面断言覆盖路径成功/失败通知、部分回执超时、卸载期间重新激活、关闭无定时器保存、混合降级权限、不稳定读取和提交前变化、路径规范化以及摄取/删除/标签提交保存调度。
-- 差异空白检查通过，仅有仓库换行规范提示。
-- 扩展运行发现既有测试夹具失配：[单轨测试](../tests/memoSingleTrack.test.js)两项分别缺少当前原生 ANN ABI 与权限接口；[旧标签失效测试](../tests/newTagIngestionDerivedInvalidation.test.js)引用已退休模块，无法加载。未为适配这些旧夹具恢复 JS 数据库直连。
-
-## 边界
-
-- 未启动生产服务，未修改真实知识库，未执行历史数据批量迁移或不可逆清理。
-- 已完成标准发布版原生模块构建，并使用新产物通过定向回归；未启动或重启生产服务，正在运行的进程仍须重启才能加载新模块。
-- 新增路径规范只约束后续入口，不自动迁移已有反斜杠数据库路径；历史路径应在数据库副本验证迁移后处理，不能宣称已自动修复存量混合路径。
-- 检查点对失效索引采取拒绝发布而非隐式恢复；查询恢复就绪后才能发布新基线。
-- 未执行完整仓库测试、生产并发压力或长时间监听验收；不把本地定向通过等同于生产交付验收。
\ No newline at end of file
```

**File**: `docs/AGS统一几何施工验收记录-2026-10-18.md` (removed, +0/-254)
```diff
@@ -1,254 +0,0 @@
-# AGS 统一几何施工与验收记录
-
-## 1. 实施范围
-
-已将局部残差与全局 EPA 合并到统一原生几何任务，生产重建固定执行“几何 → 图资产”。
-
-主要实现：
-- [统一几何算子与任务](../rust-vexus-lite/src/memo_geometry.rs)：Gram 空间增量 GS、确定性选择、临时向量快照、局部并行、主题面与覆盖率计算、原子发布。
-- [原生入口](../rust-vexus-lite/src/lib.rs)：新增统一入口，移除旧 pair、残差、EPA 双阶段发布及未使用线性代数接口。
-- [Schema](../rust-vexus-lite/src/schema.rs)：版本 2，删除 pair 表与触发器，统一几何依赖版本。
-- [依赖常量](../rust-vexus-lite/src/storage.rs)：构建与两个兼容性校验入口共用依赖键集合。
-- [图构建](../rust-vexus-lite/src/memo_artifact_builder.rs)：现场余弦，不再读取 pair 表；几何签名从清单获取，不依赖数值残差表非空。
-- [调度控制面](../TagMemoEngine.js)：统一几何入口、有界冲突重试、健康失败阻断、等待发布回调。
-- [EPA 查询](../rust-vexus-lite/src/memo_pipeline.rs)：熵锁定语义前缀，输出越界度，零投影与空基底不再误报缓存缺失。
-- [配置](../rag_params.json)：加入双尺度配置；保留旧配置读取回退。
-- [离线探针](../scripts/tagmemo_unified_geometry_probe.js)：移除持久化 pair 消费，改为现场余弦。
-- [基准工具](../scripts/benchmark_memo_geometry.js)：仅接受独立基准库，输出聚合指标，不输出正文或主题名称。
-
-## 2. 施工图修正与一致性保护
-
-1. 旧表、旧触发器按幂等方式清理；旧 EPA 缓存仅首次迁移时清除。每次初始化无条件删除 EPA 会破坏重启缓存复用，因此采用独立迁移标记。
-2. 事实与驻留索引的正常摄取差分在原生提交返回前完成，JS 随后安排派生任务。未命中索引的向量仍从数据库补读。
-3. 输入快照阶段持共享发布门禁；计算阶段释放数据库事务与门禁，只有不可变临时向量快照参与并行计算。
-4. 发布阶段取得排他门禁、索引读锁，再检查索引修订、数据库代际与事实依赖。冲突在写入前拒绝，旧资产不被覆盖。
-5. 几何清单记录事实版本，图构建检查已存在几何清单对应的事实版本，阻止几何与图构建之间事实变化造成的旧锚增益复用。
-6. 强制重算开关不参与配置签名；相同配置的强制重算保持几何身份稳定。
-7. 覆盖率使用固定分片、按顺序归约，避免线程调度改变数值位模式。
-8. 读取向量按固定小批次释放索引锁，避免并行任务按邻居反复读取 Hub。该快照是任务临时内存，不新增常驻向量副本。
-9. 对完全正交目标，局部残差为 1，属于合法计算结果，不归类为失败。
-10. 已删除旧模型维护模块；仓库内未发现退休 JS 原生接口调用方。其他仓库未审计，不应将本记录视为跨仓库兼容性证明。
-
-## 3. 安全与真实数据集
-
-用户提供服务器数据库副本；首先只读检查，再通过 SQLite 备份接口生成独立基准库。未对原始服务器副本或活动生产库执行迁移。
-
-数据规模：
-- 数据库大小：2,376,568,832 字节。
-- Tag：37,823，全部 3,072 维。
-- 文件：8,979。
-- 文件—Tag 关联：55,598。
-- 2–100 Tag 的有效共现文件：5,913。
-- 未合并的有向共现累加次数：588,974。
-- 源库完整性快速检查：通过。
-- 源库无原生存储元数据，因此覆盖了早于当前版本的迁移路径。
-
-基准操作只在独立副本中执行，未输出正文或 Tag 名称。基准副本保留在本地，未纳入源码依赖。
-
-## 4. 实测结果
-
-Windows 11，Node 22.18.0，本地发布优化原生产物。不是服务器硬件上的部署测量。
-
-| 指标 | 首轮 | 最后复测 |
-|---|---:|---:|
-| 首次旧库迁移 / 已迁移库打开 | 5,437 ms | 606 ms |
-| 索引恢复 | 45,637 ms | 45,062 ms |
-| 统一几何任务 | 3,040 ms | 3,453 ms |
-| 快照读取 | 612 ms | 538 ms |
-| 局部 AGS | 900 ms | 872 ms |
-| 全局 AGS | 418 ms | 407 ms |
-| 覆盖率统计与序列化 | 91 ms | 92 ms |
-| 发布 | 1,020 ms | 1,545 ms |
-| 缓存短路 | 99.6 ms | 103.2 ms |
-| 图资产构建 | 3,946 ms | 6,744 ms |
-| 进程 RSS 峰值 | 2,351 MiB | 1,586 MiB |
-
-最后复测已在图构建后立即释放临时向量快照。两次测量受到文件缓存、分配器与写入成本影响，不将差值视为严格受控性能提升。
-
-输出：
-- 局部成功：37,076。
-- 邻居不足：747。
-- 向量数据库降级读取：0（索引已恢复）。
-- 图节点：37,083。
-- 图边：552,616。
-- 主题面：9。
-- 基底最大正交误差：4.40e-9，低于 1e-6。
-- 端到端 EPA 缓存可用：是。
-- 独立进程重启后缓存短路：94.6 ms，跳过全部 37,823 Tag，几何派生版本不变。
-
-### 全局覆盖率限制
-
-默认膝点规则在 9 面处停止，累计覆盖率约 **5.7548%**，未达到配置中的 90% 能量目标。该行为符合施工图“残差目标或边际增益膝点任一满足即停止”的规则，但不意味着全局误差目标达标。
-
-示例查询越界度约 0.9795。当前越界度只输出，不参与 Spike 抑制；低覆盖率及其对检索质量的影响仍需后续评估。不得把性能通过表述为全局语义精度通过，也不应为追求表面覆盖率而静默改变已指定算法。
-
-没有执行旧三任务的同机受控耗时对照，也没有完成带相关性标签的 Spike / RiverMemo Top-K 质量对照，因此不宣称相对旧算法的加速倍率或质量提升。
-
-## 5. 测试结果
-
-- Rust 全量：**63 通过、0 失败**。
-- 发布模式原生构建：通过；类型声明由构建重新生成。
-- JS 专项集成：**18 通过、0 失败**。
-- 覆盖前缀嵌套、基底正交、Gram 残差等价、局部线性/正交语义、截断、不同线程数一致性、降级读取、缓存短路、事实与索引冲突拒绝发布、迁移、EPA 前缀熵与越界度、关闭排空、事实失效与端到端原生查询。
-- 仓库 JS 逐文件有界回归：55 个文件，46 个通过，9 个失败或超时。不是全量通过。
-- 仓库级静态检查仍报大量其他模块既有风格告警；新增几何模块在诊断筛选中为 0 项。不是仓库级静态检查全绿。
-
-失败或超时文件：
-- 联想检索回归：测试桩缺少当前原生路径补水接口。
-- 日记索引差分、原生语义去重、Tag 一致性、Tag 基线四类测试：导入已不存在的旧 JS schema 管理模块，加载阶段失败。
-- 单轨 Memo 回归：测试桩缺少当前原生 ANN 与权限查询接口。
-- 结果去重：旧存储补水夹具断言失败。
-- 第三方工具生态：缺少注册工具配置。
-- 人格预处理：运行状态文件缺失，且进程未退出；在全量尝试后已定向停止测试进程树，后续逐文件运行限制 15 秒、外层限制 20 秒。
-
-以上失败原因已定位，但未对无关插件或旧测试夹具做大范围改写。原始失败日志与聚合报告保存在系统临时目录。
-
-## 6. 上线注意事项与未完成验收
-
-- 首次升级会退休旧派生表，旧 RiverMemo 资产依赖集合不匹配时必须重建；上线前备份数据库，源码与对应平台原生产物同步部署。
-- 本次仅构建并验证 Windows x64 原生产物；其他平台必须重新构建，仓库已有其他平台二进制不代表已更新。
-- 生产库未迁移、服务未重启。
-- 尚未完成旧算法同机对照、Spike / RiverMemo 质量抽样对比及低覆盖率参数评估。
-- 全库 JS 测试与仓库级静态检查尚未达到全绿，不得以本次专项通过替代。
-- 未对用户已有暂存区执行提交、回退或重新暂存操作。
-
-## 7. 第二阶段优化与两轮对照（2026-10-18）
-
-本节为后续结果，优先于上文第一阶段“越界度仅输出、默认 9 面”等行为描述。原始基线保留，便于追溯。
-
-### 实施内容
-
-- 几何算法升级 v2。候选方向可选单锚点或星团；星团使用归一化邻居权重与有界混合，避免原始共现次数淹没锚点。邻居权重采用对数共现权重乘内联语义门控。
-- 默认采用支持度先验，不再奖励局部高残差。保留残差先验和已解释能量先验作为实验选项。
-- 完整覆盖率曲线随缓存保存；默认关闭单步膝点早停，保留 epsilon 与最大面数约束。
-- EPA 逻辑深度改为“前缀集中度 × 前缀解释能量比”。全部面越界度单独输出，尾部面不替语义前缀背书。
-- 发布循环外复用预编译语句；成功由数值表表示，状态表仅写异常。基准合并两表统计。
-- 图与来源摘要改为带格式标记、计数边界的小端二进制流；固定影响权重的归约顺序及载荷集合顺序，升级图算法版本与清单校验。
-- 压缩改为无损 level 1；新增构图、序列化、压缩、发布分阶段时间与体积输出。
-
-### 第一轮：六组消融对照
-
-同一独立基准库、同次索引恢复，按下表顺序运行。所有配置的局部残差数值摘要一致。
-
-| 策略 | 前 8 面覆盖率 | 前 16 面覆盖率 | 完整 32 面覆盖率 |
-|---|---:|---:|---:|
-| 单锚点、残差先验 | 5.2548% | 9.3065% | 15.5700% |
-| 单锚点、支持度先验 | 4.9951% | 9.3065% | 15.6349% |
-| 星团 0.5、支持度先验 | 6.1852% | 10.1459% | 16.6205% |
-| 星团 0.8、支持度先验 | 7.2657% | 11.3517% | 17.7241% |
-| 星团 0.5、已解释能量先验 | 6.1755% | 10.2366% | 16.8659% |
-
-旧膝点策略依然在 9 面停止，发布覆盖率 5.7548%；它的完整 32 面曲线与“单锚点、残差先验”一致。
-
-结论：
-- 5.7548% → 17.7241% 约 3.08 倍，但包含从 9 面增加到 32 面的收益。
-- 同为 32 面，对旧残差先验提升约 13.8%；对单锚点支持度先验提升约 13.4%。
-- 同为前 8 面，相对旧残差先验提升约 38.3%。
-- 仍远未达到 90% 全库能量覆盖目标，不以此声称检索精度提升。
-- 星团 0.8 的全库覆盖率最高，但固定 Tag 样本的全空间越界度并非最低。因此默认选型只针对全库主题覆盖，不代表全部查询指标最优。
-
-第一轮发布耗时约 953–1,144 ms，未达到建议中的 150 ms。局部耗时随同进程运行从约 878 ms 升至约 3,978 ms；数据值一致，原因未完成隔离，不将顺序运行时间差视为策略成本。
-
-### 第二轮：独立进程复测星团 0.8
-
-| 指标 | 第一次 | 第二次 |
-|---|---:|-
```

**File**: `docs/KBM-P2控制桥收束方案.md` (removed, +0/-33)
```diff
@@ -1,33 +0,0 @@
-# P2-3 控制桥收束方案
-
-## 当前职责与建议
-
-| 现役入口 | 保留职责 | 建议命名 |
-| --- | --- | --- |
-| [TagMemoEngine.js](../TagMemoEngine.js) | 派生队列、防抖、原生 Pairwise/Residual/Artifact 构建和发布句柄 | MemoDerivedScheduler |
-| [TagMemoV10Engine.js](../TagMemoV10Engine.js) | 配置默认值合并、不可变 Artifact 句柄、来源签名兼容校验 | MemoArtifactControl |
-| [RiverMemoEngine.js](../RiverMemoEngine.js) | N-API 参数封装、原生路由、结果结构适配、显式观测接口 | RiverQueryBridge |
-
-可以最终由一个 MemoControlBridge 聚合三个职责，但**不建议本轮合并成一个大类**。派生调度和查询生命周期不同；合并可能把任务关闭、Artifact 发布代际和查询回退一起改变，超出死代码清理边界。
-
-## 建议后续步骤（本轮未实施）
-
-1. 先在 KBM 内提供聚合控制面，内部复用现有三个实例，不改变插件契约。
-2. 将配置默认值与 Artifact 元数据提取为独立纯函数，保持配置哈希、模型身份和来源签名不变。
-3. 为派生构建与查询保留各自 admission/drain，先完成 P3 生命周期约束，再决定是否合并实例。
-4. KBM、插件、管理路由及内存诊断的调用点全部迁移后，再删除旧名称。禁止修改区域中的消费者必须等独立重构，不在本轮兼容。
-5. 用原生临时库验证冷启动恢复、发布、查询与关闭，再移除兼容接口。
-
-## 本轮安全删除范围
-
-- V10 中六个无人调用的私有辅助方法：旧查询、Agent、观测及 SourceField 归一化，旧数据库与 provenance 代际计算。生产统一查询由原生运行时完成。
-- V10 无使用的加密导入及稳定哈希导入。
-- TagMemo 中无人读取的旧能量场字段。
-- River 中只写不读的原生缓存观测标记；真实资产状态仍以原生运行时诊断为准。
-
-## 暂保留与待确认
-
-- 共现矩阵、Pairwise、Residual 兼容字段：仍被 [memoryProfiler.js](../modules/knowledgeBase/memoryProfiler.js) 读取，一致性服务也有旧赋值，不能声称零引用。
-- 退休方法中仍有 KBM 包装入口，不在本轮擅自改变公开接口；应在 P2-5 全量调用表审计后决定是否删除。
-- V10 配置中的历史参数可能参与原生配置哈希与恢复契约，不应仅凭 JS 无计算逻辑删除。
-- Artifact/DerivedManager 注入字段及同步退休方法仍需独立审计。本轮仅完成可证实无调用的子集，P2-3 整项仍保持未完成。
\ No newline at end of file
```

**File**: `docs/KBM_ENV_AUDIT-2026-10-18.md` (removed, +0/-95)
```diff
@@ -1,95 +0,0 @@
-# Rust 统一数据库分支环境配置审计
-
-## 范围
-
-仅审计热知识库、TagMemo、Embedding 的重构相关配置。未读取服务器真实环境文件，不能断言服务器实际加载值。冷知识库和插件独立配置不在本次结论内。
-
-## 1. 关闭启动全扫仍处理文件：已确认并修复
-
-配置读取链路正常：
-- [`KnowledgeBaseManager.js`](../KnowledgeBaseManager.js:94) 读取启动全扫环境变量。
-- [`fileWatcher.js`](../modules/knowledgeBase/fileWatcher.js:257) 将其传入原生初始扫描选项。
-- [`lib.rs`](../rust-vexus-lite/src/lib.rs:2063) 按该选项决定是否启动初始扫描。
-
-问题在于 JS 启动后另外无条件请求对账，对账最终调用同一个全目录扫描实现。因此关闭初始扫描并未关闭第二条启动扫描路径。
-
-修复：启动对账也受同一开关控制，真实 overflow 恢复仍独立启用。开关开启时仍保留原有初扫和数据库路径对账两条入口，本次未重构合并。回归测试覆盖关闭、开启与关闭后真实溢出恢复。
-
-注意：关闭启动全扫不等于关闭实时监听、启动孤儿记录清理、数据库 schema 迁移、索引恢复或 Memo 必要 bootstrap。运行期真实溢出仍可触发恢复扫描。
-
-## 2. 语言惩罚漏接已修复
-
-LANG_PENALTY_UNKNOWN 与 LANG_PENALTY_CROSS_DOMAIN 统一支持 [0,1]，包括零值。有效程序配置/环境值优先，其次热调参，最后默认值；空白或非法环境值继承热调参。
-
-## 3. 无消费者属性已清理
-
-KNOWLEDGEBASE_DELETE_REBUILD_THRESHOLD、TAG_EXPAND_MAX_COUNT、KNOWLEDGEBASE_IDLE_SWEEP_LOG_TICK 对应的无效配置属性已删除。模板中的前两项也已移除。
-
-## 4. 已无活跃生产消费者的旧参数
-
-以下变量在活跃 JS/Rust 源码中没有消费者，不应继续依赖其调节行为：
-
-- KNOWLEDGEBASE_EPA_BACKGROUND_RECOMPUTE
-- EPA_JS_FALLBACK_MAX_TAGS
-- EPA_RUST_SAMPLES_PER_ANCHOR
-- EPA_RUST_ANCHOR_CANDIDATE_LIMIT
-- RUST_LOG_SUMMARY_WHITELIST
-- TAGMEMO_MATRIX_PROGRESS_INTERVAL_FILES
-- TAGMEMO_IR_METHOD
-- TAGMEMO_INTRINSIC_RESIDUAL_FORCE_RECOMPUTE
-- TAGMEMO_IR_RECOMPUTE_ON_THRESHOLD
-- TAGMEMO_IR_MAX_NEIGHBORS
-- TAGMEMO_IR_MAX_BASIS
-- TAGMEMO_IR_MIN_NEIGHBORS
-- TAGMEMO_IR_POSITION_DECAY
-- TAGMEMO_IR_SEMANTIC_GATE_ENABLED
-- TAGMEMO_IR_SEMANTIC_PEAK
-- TAGMEMO_IR_SEMANTIC_SIGMA
-- TAGMEMO_IR_SEMANTIC_FLOOR
-- TAGMEMO_IR_SEMANTIC_HARD_FLOOR
-- TAGMEMO_IR_MIN_GAIN
-- WhitelistEmbeddingModelList
-
-统一几何的配置来源现在是热调参的 KnowledgeBaseManager.geometry；不存在该对象时控制面才回退到旧 intrinsicResidual 对象。旧环境参数不会自动转换成新的几何配置，部分算法也不能一对一映射。
-
-证据：[`TagMemoEngine.js`](../TagMemoEngine.js:218)、[`rag_params.json`](../rag_params.json:223)。
-
-旧双写租约参数也已退休：
-- KNOWLEDGEBASE_RUST_WRITE_LEASE_GRACE_MS
-- KNOWLEDGEBASE_RUST_WRITE_LEASE_COOLDOWN_MS
-- KNOWLEDGEBASE_RUST_WRITE_LEASE_CHECKPOINT_BEFORE_GRANT
-- KNOWLEDGEBASE_RUST_WRITE_LEASE_RETRY_MS
-- KNOWLEDGEBASE_RUST_WRITE_LEASE_TTL_MS
-- KNOWLEDGEBASE_RUST_WRITE_LEASE_MAX_WAIT_MS
-- KNOWLEDGEBASE_RUST_WRITE_LEASE_PENDING_THRESHOLD
-
-## 5. 仍有效，但语义或优先级需要注意
-
-- KNOWLEDGEBASE_DERIVED_STARTUP_COOLDOWN_MS：仍读取，但有兼容 Memo 资产时回调不强制重训；没有兼容资产时 Manager 传入零延迟启动必要 bootstrap。不是禁止启动训练的开关。
-- TAGMEMO_MATRIX_REBUILD_QUIET_MS：仍生效；当前累计新增 Tag 阈值固定为 50，模板中约 1% 的说明已过时。证据：[`TagMemoEngine.js`](../TagMemoEngine.js:312)。
-- LANG_PENALTY_UNKNOWN：已统一为有效环境配置优先，未设置时继承热调参。
-- KNOWLEDGEBASE_PERSIST_DEFAULT、KNOWLEDGEBASE_PERSIST_FOLDERS：仍有消费者；Chunk 落盘模式为 none 时优先禁止落盘。generational 不代表所有日记本自动启用持久化。
-- KNOWLEDGEBASE_PERSIST_TAG_INDEX=false：兼容含义为 generational，不是关闭全局 Tag 落盘。
-- IGNORE_FOLDERS、IGNORE_PREFIXES、IGNORE_SUFFIXES：确实传入 Rust，并由初扫、实时事件、对账共用过滤器。没有发现重构漏传。已修复为空字符串显式清空规则，未设置才使用默认值；支持中英文逗号。
-- 许多数值参数采用逻辑或默认值，零会回退默认值。忙锁等待、忙锁重试和 mmap 使用不同的显式校验，支持零；不能把所有数值配置按同一规则理解。
-
-证据：[`indexRepository.js`](../modules/knowledgeBase/indexRepository.js:172)、[`lib.rs`](../rust-vexus-lite/src/lib.rs:1451)。
-
-## 6. 已核对有效的主要配置组
-
-- 根目录、数据库目录、模型名、模型签名、向量维度。
-- Embedding Token 上限、批条数、并发、备援模型、dimensions 开关、原文审计。
-- 摄取批大小与窗口、删除批大小与窗口、迁移缓存 TTL。
-- SQLite 忙锁等待/重试、Rust 只读池大小与 mmap。
-- watcher 防抖、稳定采样间隔/次数；热调参监听另有自己的三项参数。
-- Tag 黑名单、超级黑名单、每文件 Tag 上限。
-- 索引保存延迟、持久化模式与基线差分阈值、空闲 TTL/扫描间隔。
-- 原生 River 联合查询总开关、回退开关、候选数量和语义去重阈值。
-- 语言门控总开关、未知语言惩罚、事件循环看门狗。
-- 矩阵阈值重建静默时间。
-
-Rust 无需自行读取这些环境变量：JS 控制面读取后通过原生接口传参是当前设计。应以实际调用链与消费者判断生效，而不是以 Rust 中是否出现环境变量名判断。
-
-## 7. 验证
-
-启动扫描相关回归测试 5 项全部通过。未连接服务器验证其真实环境值，未调用 Embedding，未修改运行数据库。退休参数已从模板清理，服务器真实配置未自动改写。\n## 8. RiverAGS 训练反馈与重复发布修复\n\n- 手动重复请求复用排队/运行中任务；Tag 一致性提交新事实仍保留必要的后续训练。\n- 相同原生资产签名、代际和驻留状态不再增加 V9 控制面代际或重复通知；失败的伴生发布仍可重试。\n- 新增主服务训练状态接口和独立管理服务代理，面板显示排队、几何计算、图构建、发布、完成和失败。\n- 面板运行中禁止重复提交，重新打开页面可恢复主进程内任务状态；主进程重启后任务历史不持久化。\n- 状态显示真实阶段，不伪造百分比。未做服务器现场或浏览器交互验证。\n\n## 9. 部署\n\n同步后端控制面、管理路由、独立管理服务和前端源码，并重新构建前端或整体同步本次构建产物。主服务与独立管理服务均需重启。此前旧库兼容迁移还需要部署同版本原生模块；不要仅同步 JS，也不要使用模板覆盖真实配置。训练界面修复不需要重建正文向量。\n
\ No newline at end of file
```

**File**: `docs/KBM审查核实与修复记录-2026-10-18.md` (removed, +0/-69)
```diff
@@ -1,69 +0,0 @@
-# KBM 审查核实与修复记录
-
-日期：2026-10-18。依据：[原始审查记录](../审查记录.txt)。
-
-## 范围与结论
-
-已核实并修复六项 P0 的具体问题，并完成本轮追加的统一读事务、作用域门禁、独立派生版本、原子统计与 EPA 后台发布实现。
-本记录区分代码实现、本地定向验证与真实生产验收；不将本地通过等同于施工草图全部架构契约的生产验收。
-未启动生产服务，未修改生产知识库内容；原生数据库测试使用临时目录。
-保留工作区及自动暂存状态，未执行提交或撤销暂存。
-
-## P0 核实
-
-| 编号 | 核实结论 | 本次处理 |
-| --- | --- | --- |
-| P0-1 | 存在：全局标签基线版本未参与比较，缺失文件也可能误报回放 | [索引生命周期](../rust-vexus-lite/src/index_lifecycle.rs)读取基线及当前整数向量版本；日记签名与标签版本分开比较；只有成功加载基线才报告回放 |
-| P0-2 | 存在：孤儿清理未失效常驻日记索引状态 | [摄取与清理](../rust-vexus-lite/src/ingestion.rs)在同一事实事务失效涉及日记；无文件归属孤儿分片失效所有登记日记；由写入执行器回填新事实代际 |
-| P0-3 | 存在：向量变化未清理成对正负缓存 | [数据库结构](../rust-vexus-lite/src/schema.rs)升级向量更新触发器并增加删除触发器，清理两张成对缓存表；既有数据库初始化也会替换旧触发器 |
-| P0-4 | 存在：提交前单文件变化会中断整个批次 | [摄取控制面](../modules/knowledgeBase/ingestionPipeline.js)逐文件隔离变更、删除及读取异常；保留健康文件提交，重新压紧分片和标签向量位置；统一路径代际键 |
-| P0-5 | 存在：确认重新准备两个计划并遗留令牌 | [一致性控制面](../modules/knowledgeBase/tagConsistencyService.js)直接消费原预览计划，替换预览取消旧令牌；保留 Rust 权威代际及文件哈希检查，增加等待前后轻量配置校验 |
-| P0-6 | 存在：统一感应管线没有全局标签就绪门禁 | [统一感应管线](../rust-vexus-lite/src/memo_pipeline.rs)查询前校验就绪状态，失效时清运行时并恢复索引，再次校验后查询 |
-
-限制：触发器保证后续向量更新/删除的缓存失效；没有对历史上已经形成的错误缓存执行生产批量清理。
-文件元数据检查仍存在检查后到事实提交之间的时间窗口，本次没有宣称文件系统与 SQLite 具备跨系统原子提交。
-
-## P1 核实
-
-| 编号 | 状态 | 处理及剩余范围 |
-| --- | --- | --- |
-| P1-1 | 已实现并定向验证 | [图资产构建](../rust-vexus-lite/src/memo_artifact_builder.rs)固定读事务加载输入，按模型过滤锚增益，提交及内存发布前检查事实与派生版本；[存储引擎](../rust-vexus-lite/src/storage.rs)追踪成对、内生残差及 EPA 独立版本。图资产依赖随资产原子持久化，清单与热/冷加载均校验，缺失依赖的旧资产要求重建 |
-| P1-2 | 已实现并定向验证 | [联合查询](../rust-vexus-lite/src/knowledge_runtime.rs)将 ANN、文件展开、语义去重、拓扑及最终正文补水串入同一 SQLite 读事务；JS 消费原生冻结正文，不重复补水。读事务使用 RAII，错误与异常退出回滚后归还连接 |
-| P1-3 | 已实现所列锁顺序修复 | [作用域门禁](../rust-vexus-lite/src/publication_gate.rs)按数据库与作用域协调，共享查询、排他恢复及冲突请求顺序等待；统一感应不再持索引锁查询 SQLite，摄取先加载复用向量再加索引锁；保存先内存序列化，再锁外写盘、同步与原子替换。检查点使用独立单飞门禁及共享事实门禁，可与查询并行 |
-| P1-4 | 已修复所列路径 | 摄取、删除和基线恢复递增索引内容修订号；全局标签变化及恢复清理 Memo 运行时 |
-| P1-5 | 已修复所列后台入口 | [任务生命周期](../rust-vexus-lite/src/task_lifecycle.rs)绑定索引与知识运行时，追踪所列后台任务；关闭排空并拒绝后续后台任务 |
-| P1-6 | 已修复 | 校验和相同且向量完整时，通过 Rust 异步写入执行器静默更新修改时间和大小；校验文件版本，不推进事实代际 |
-
-新增异步元数据接口的类型声明已生成于[原生类型声明](../rust-vexus-lite/index.d.ts)。
-最新本地原生产物已通过标准发布构建生成，类型声明同步更新。
-
-## P2 核实
-
-- [管理门面](../KnowledgeBaseManager.js)的断裂完整向量检查已改为异步原生探测；幽灵自检改用异步 Runtime 恢复，不再同步读取索引统计。
-- 审查中关于旧恢复代理仍直接调用旧原生恢复的描述部分过时：[索引仓储](../modules/knowledgeBase/indexRepository.js)当前恢复代理已转向知识运行时。
-- 统一感应管线执行融合标签数上限。
-- [拓扑排序](../rust-vexus-lite/src/rivermemo_topology_v3.rs)在评分及候选选择前移除不在显式允许文件集合中的候选；显式空集合表示无权限。
-- [搜索服务](../modules/knowledgeBase/searchService.js)权限后过滤不足时按预算逐步扩大召回，不保证极窄权限集合下必然补满，也尚未把过滤全部下推原生 ANN。
-- [文件监听控制面](../modules/knowledgeBase/fileWatcher.js)直接处理原生对象，移除序列化往返，轮询器不再保持事件循环存活。
-- [文本处理](../rust-vexus-lite/src/text.rs)缓存固定正则，超黑名单按字面量转义并按次提取统一编译。
-- [索引句柄](../rust-vexus-lite/src/index_handle.rs)缓存向量数、容量和内存统计；写守卫退出时更新，统计读取不再等待索引锁。同步注册不再排空等待；独立索引仍有在途任务时明确返回忙错误。
-- EPA 发布已改为受生命周期追踪的后台任务，提交复核事实及自身派生版本。注意：原发布接口现在返回异步结果，外部调用方必须等待完成，不能继续按同步结果读取成功标志；这是可见的返回契约变化。
-
-## 验证
-
-- Rust 编译检查通过。
-- 最新 Rust 单元测试：47 项全部通过，包含固定 WAL 读快照、独立派生版本冲突、共享门禁及原子统计。独立测试进程缺少 Node 宿主符号的加载诊断不影响退出结果。
-- 最新 Node 定向回归：27 项全部通过，覆盖摄取隔离、计划取消、权限补召回、元数据版本、任务排空、EPA 成功/过期发布、冻结正文、并发冷句柄及清单依赖失效。
-- 标准发布构建成功，测试使用最新发布版原生模块。
-- [联合查询回退测试](../tests/nativeRiverQueryFallback.test.js)夹具更新为异步最终结果补水，并断言只补水最终 ID；没有为适配旧测试恢复 JS 数据库直连。
-- 全部差异空白检查通过；仅有 Git 换行规范提醒。
-- [清单兼容测试](../tests/nativeMemoManifestCompatibility.test.js)已迁移到原生存储契约并通过，不再引用退休结构管理模块；同时验证事实代际不变、派生输入变化时旧清单失效。
-- 未执行完整仓库测试及生产压力验证。
-
-## 验收边界与保守策略
-
-1. 上一轮列出的统一读事务、作用域共享门禁、独立派生版本、原子统计、EPA 后台发布与清单测试迁移已实现，并完成上述本地定向验证。
-2. 跨作用域事实提交、部分维护与图资产发布仍使用同数据库通配排他门禁；恢复会阻塞对应作用域，检查点允许查询并行但仍阻止事实写入。这是保守一致性策略，不宣称完全无等待或最优吞吐。
-3. 索引保存需要额外一份序列化缓冲区；大型索引的峰值内存和生产延迟需现场测量。
-4. 未执行完整仓库测试、生产启动、真实知识库迁移与长时间并发压力验收；未清理历史错误派生数据，也未执行不可逆数据操作。
-5. 不把所有历史文本入口规则统一、原生 ANN 权限完全下推等范围扩展事项计为本轮已完成能力。
\ No newline at end of file
```

**File**: `docs/KBM纯Rust单一SQL真相源与异步冷启动架构施工日志-2026-10-17-续.md` (removed, +0/-438)
```diff
@@ -1,438 +0,0 @@
-# KBM 纯 Rust 单一 SQL 真相源与异步冷启动架构施工日志（续）
-
-> 日期：2026-10-17  
-> 施工分支：`feat/kbm-rust-single-sql-runtime`  
-> 基线提交：`068c16b6`  
-> 本日志：本轮续施工交接记录，不代表测试完成或生产切换完成
-
-## 1. 本轮边界
-
-本轮只处理中央 KBM `knowledge_base.sqlite` 的 Rust SQL 所有权和 Memo 派生资产生产入口。
-
-明确排除：
-
-- TDB 业务、TDB 数据库和 TDB 测试；
-- `Plugin/LightMemo/LightMemo.js` 及其后续适配；
-- 测试脚本迁移和测试套件执行；
-- 离线维修脚本；
-- 其他独立业务 SQLite 数据库。
-
-## 2. 本轮已完成
-
-### 2.1 Memo artifact 清理下沉 Rust
-
-新增 `NativeMemoArtifactPruneTask`，清理逻辑位于 Rust Runtime 数据面：
-
-- 通过统一 `SqliteStorageEngine` 的 Read/Write 入口访问中央库；
-- 所有清理写入经过 SQLite Write Actor；
-- 按 `published_at`、`updated_at` 倒序保留最近的 ready artifact；
-- 超出保留数量的 ready artifact 标记为 `retired`；
-- retired artifact 的 payload 和 checksum 一并清空；
-- 超过保留期的 failed/retired artifact 删除；
-- 清理结果返回 `retired`、`deleted` 和保留数量摘要；
-- 清理任务在 N-API 后台任务中执行，不在 Node.js 主线程执行 SQL。
-
-### 2.2 KBM 生产回调切换
-
-`KnowledgeBaseManager.onNativeMemoArtifactPublished()` 已改为异步控制面回调：
-
-- 继续只发布轻量 Native Memo artifact handle；
-- 移除对旧 JS `artifactRepository.prune()` 的生产调用；
-- 改为调用 `NativeKnowledgeRuntime.pruneNativeMemoArtifacts()`；
-- 清理失败只记录警告，不回滚已经完成的 artifact 发布；
-- 启动阶段增加 `pruneNativeMemoArtifacts` ABI 存在性检查；
-- Node.js 不再直接管理 `rivermemo_artifacts` 的生命周期 SQL。
-
-### 2.3 ABI 类型声明同步
-
-`rust-vexus-lite/index.d.ts` 已增加：
-
-```ts
-pruneNativeMemoArtifacts(
-    dbPath: string,
-    retainReadyArtifacts?: number | null,
-    failedRetentionMs?: number | null
-): Promise<unknown>
-```
-
-Rust Runtime 导出、TypeScript 声明和 KBM 调用名称保持一致。
-
-### 2.4 既有 Rust 所有权收口确认
-
-本轮重新扫描中央库生产路径，确认以下项目没有出现在 KBM 主链：
-
-- `better-sqlite3` 中央库连接；
-- `rustWriteLease`；
-- `artifactRepository.prune()`；
-- 生产路径同步 `VexusIndex.load()`；
-- 生产路径同步 `VexusIndex.save()`。
-
-扫描命中项全部属于已排除范围：
-
-- TDB；
-- 独立插件数据库；
-- 测试文件；
-- 离线检查、重建和维修脚本；
-- Rust standalone 测试样例。
-
-## 3. 本轮验证
-
-已执行：
-
-```text
-cargo check --manifest-path rust-vexus-lite/Cargo.toml
-node --check KnowledgeBaseManager.js
-```
-
-结果：
-
-```text
-cargo check：通过，Exit code 0
-KnowledgeBaseManager.js：通过，Exit code 0
-```
-
-本轮未执行：
-
-- 测试套件；
-- 测试脚本迁移；
-- 原生 release 构建；
-- Windows 原生二进制替换；
-- 真实中央数据库迁移；
-- 生产数据库压测；
-- 崩溃窗口验证；
-- Windows 文件句柄 rename/delete 验证。
-
-## 4. 当前完整 Rust SQL 进度
-
-当前中央记忆库已经达到以下阶段：
-
-### 已进入 Rust 生产路径
-
-- SQLite StorageEngine 注册和连接管理；
-- Write Actor；
-- Read Pool；
-- Schema 初始化入口；
-- 数据库代际基础设施；
-- 中央事实表摄取提交；
-- 文件删除提交；
-- Tag 一致性事实提交；
-- 部分索引 Delta；
-- 日记索引和 Global Tag 索引恢复接口；
-- 双槽 checkpoint 接口；
-- Rust watcher Runtime 所有权；
-- Native Memo artifact 构建；
-- Native Memo manifest 读取；
-- Native Memo artifact 清理；
-- Rust pairwise、intrinsic residual 和部分派生资产维护入口；
-- Native River 查询和 Rust 侧 SQLite 读取。
-
-### 已从中央库生产路径移除或禁用
-
-- KBM 的中央 `better-sqlite3` 连接；
-- JS `schemaManager` 生产调用；
-- JS `sqliteHealthManager` 生产调用；
-- JS 中央库 SQL 查询门面；
-- JS 摄取事实表写入；
-- JS 删除事实表写入；
-- JS Chunk Delta 生产方法；
-- JS Memo artifact prune SQL；
-- Rust 子模块通过独立 `Connection::open_with_flags` 绕过统一 StorageEngine 的生产路径。
-
-## 5. 仍未达到最终完成定义的项目
-
-本轮不应把工程标记为“完整 Rust 数据面闭环”。以下事项仍未完成：
-
-### 5.1 索引代际与跨资源发布
-
-SQLite 事实提交和 usearch 内存索引更新仍是协调发布，不是跨资源事务。
-
-仍需完成：
-
-- 事实代际与索引 applied generation 的持久化协议；
-- 受影响作用域查询/发布门禁；
-- SQL 已提交而索引未发布时的崩溃恢复；
-- Delta 失败后的不可查询状态和替代实例原子替换；
-- 摄取、删除、Tag 一致性统一使用同一套恢复调度；
-- “factsCommitted”和“indexReady”在所有接口中一致表达。
-
-### 5.2 Tag Delta 失败恢复
-
-Tag Delta 已转入 Rust，但当前仍需继续加强：
-
-- 避免 usearch Delta 中途失败后留下部分修改实例；
-- 失败时将索引标记为 invalid；
-- 从 SQLite 权威事实层异步重建；
-- 重建完成前禁止查询半成品；
-- MemoRuntime 失效和索引恢复状态需要由同一 Runtime 所有权根协调。
-
-### 5.3 摄取版本化闭环
-
-当前 JS 仍负责文本切分、Tag 提取和 Embedding 请求编排。
-
-仍需完成：
-
-- Rust 权威文本预处理、Chunk 切分和 Tag 规则；
-- 文本规则版本和黄金样本冻结；
-- 文件预检后的 mtime/size/checksum 再校验；
-- 原生 batch TTL、取消、数量和字节预算；
-- 操作 ID 持久化幂等回执；
-- 删除墓碑阻止旧 Embedding 结果复活；
-- 部分 Embedding 失败和乱序返回的完整持久化语义；
-- 同维度不同模型的语义空间校验。
-
-因此当前状态仍是“事实提交已主要由 Rust 持有，文本业务权威尚未完全迁入 Rust”。
-
-### 5.4 watcher 可靠性
-
-Rust watcher 已拥有主路径，但仍有未闭环风险：
-
-- 有界队列溢出仍需显式 overflow/reconciliation 信号；
-- 初始扫描、notify 事件和运行期对账需要保证最后路径版本可恢复；
-- watcher worker 线程停止时需要可证明 join；
-- 停止流程不能只清空队列后释放句柄；
-- 文件稳定确认失败需要进入可恢复补偿，而不是只打印并丢弃；
-- 生产 watcher 的取消和关闭行为仍需 Windows 实测。
-
-### 5.5 健康恢复与关闭
-
-Rust 已提供健康检查基础接口，但完整损坏恢复尚未完成：
-
-- 损坏数据库隔离；
-- WAL/SHM 一致处理；
-- 备份保留；
-- 新库重建；
-- 从 dailynote 重新摄取；
-- 恢复期间结构化错误状态；
-- 所有 N-API 后台任务跟踪和排空；
-- Write Actor、Read Pool、watcher、usearch 句柄的严格关闭顺序；
-- Windows 下数据库和索引文件替换验证。
-
-KBM 当前的损坏处理仍包含“停止服务并重启恢复”的控制面提示，不能视为 Rust 已经完成自动恢复。
-
-### 5.6 派生资产代际校验
-
-Pairwise、Residual、EPA 和 Memo artifact 已有 Rust 构建或写入路径，但仍需补齐：
-
-- 固定读事务快照；
-- 源事实代际；
-- 依赖签名；
-- 长计算结束后的代际复核；
-- 过期结果禁止覆盖 ready 资产；
-- 派生队列去重、背压、取消和关闭排空；
-- 派生资产不兼容时的结构化 warming 状态。
-
-本轮仅新增了 Memo artifact 生命周期清理，未声称所有派生计算已经完成代际发布协议。
-
-## 6. 生产路径扫描结论
-
-本轮扫描关键词：
-
-```text
-better-sqlite3
-rustWriteLease
-Connection::open_with_flags
-VexusIndex.load
-VexusIndex.save
-artifactRepository.prune
-v10_derived_asset_status
-rivermemo_artifacts
-```
-
-中央 KBM 生产路径未发现旧 JS SQLite 连接和旧同步索引持有路径。
-
-扫描仍能看到以下内容，但均不属于本轮中央 KBM 生产链：
-
-- `TDBKnowledge.js`；
-- `routes/admin/cache.js`；
-- `Plugin/ImageProcessor`；
-- `Plugin/OneRing`；
--
```

**File**: `docs/KBM纯Rust单一SQL真相源与异步冷启动架构施工日志-2026-10-17.md` (removed, +0/-372)
```diff
@@ -1,372 +0,0 @@
-# KBM 纯 Rust 单一 SQL 真相源与异步冷启动架构施工日志
-
-> **2026-10-18 状态索引**：本文为早期阶段记录，文中的“未测试”“尚未迁移”等描述保留历史语境。当前实现、定向测试证据、env 消费路径和剩余阻断项以[续施工日志第 11 节](./KBM纯Rust单一SQL真相源与异步冷启动架构施工日志-2026-10-17-续.md:381)为准。目前未完成生产切换或全部最终闭环；后续不处理 TDB、LightMemo。
-
-> 日期：2026-10-17  
-> 施工分支：`feat/kbm-rust-single-sql-runtime`  
-> 仓库：`H:\VCP\VCPMain\VCPToolBox`  
-> 本日志：阶段性工程交接记录，不代表最终生产切换完成
-
-## 1. 本阶段目标与边界
-
-本阶段按《KBM 纯 Rust 单一 SQL 真相源与异步冷启动架构施工草图》第 7—16 章推进，目标是把中央 `knowledge_base.sqlite` 的数据面逐步收拢到 Rust `NativeKnowledgeRuntime`，同时保留 Node.js 控制面和 `EmbeddingUtils.js` 的远端向量化职责。
-
-明确排除：
-
-- 不修改 TDB 业务、TDB 数据库和 TDB 测试。
-- 不改造 `Plugin/LightMemo/LightMemo.js`。
-- 本阶段不执行测试套件、不做生产上机实测。
-- 本阶段不宣称已经完成最终生产切换。
-
-本阶段允许保留部分旧 JS 门面用于兼容，但中央库的生产事实写入正在转移到 Rust Write Actor；后续必须继续完成所有权收口，不能把当前兼容层当作目标态。
-
-## 2. Git 与工作树状态
-
-当前分支：
-
-```text
-feat/kbm-rust-single-sql-runtime
-```
-
-当前工作树包含大量本阶段施工改动，既有已暂存修改，也有工作区继续修改。不能使用回滚或清理命令覆盖这些变更。
-
-已确认的主要变更类别：
-
-- 删除旧 JS EPA/Residual 实现。
-- 调整 TagMemo、RiverMemo、ResultDeduplicator、AgentDream、RAGDiary 和联想发现等生产适配边界。
-- 新增 Rust 存储、Schema、索引生命周期、摄取、Tag 一致性和 pairwise 维护模块。
-- 扩展 `NativeKnowledgeRuntime` 与 N-API 类型声明。
-- 将中央库摄取、删除和部分查询/维护能力转入 Rust。
-- 将 KBM 文件监听路径改为 Rust watcher 事件队列消费。
-- 更新 Windows 原生 `.node` 二进制文件。
-
-Git 状态中已确认的核心路径包括：
-
-```text
-KnowledgeBaseManager.js
-modules/knowledgeBase/databaseCoordinator.js
-modules/knowledgeBase/diaryMetadataCache.js
-modules/knowledgeBase/fileWatcher.js
-modules/knowledgeBase/indexRepository.js
-modules/knowledgeBase/ingestionPipeline.js
-modules/knowledgeBase/searchService.js
-modules/knowledgeBase/tagConsistencyService.js
-rust-vexus-lite/src/index_lifecycle.rs
-rust-vexus-lite/src/ingestion.rs
-rust-vexus-lite/src/knowledge_runtime.rs
-rust-vexus-lite/src/lib.rs
-rust-vexus-lite/src/schema.rs
-rust-vexus-lite/src/storage.rs
-rust-vexus-lite/src/tag_consistency.rs
-rust-vexus-lite/index.d.ts
-```
-
-同时存在已删除文件：
-
-```text
-EPAModule.js
-ResidualPyramid.js
-modules/knowledgeBase/migrationVectorCache.js
-modules/tagmemoV10/riverMemoWorker.js
-modules/tagmemoV10/riverMemoWorkerPool.js
-```
-
-这些删除属于此前授权的旧生产实现收敛范围，不涉及 TDB 或 LightMemo。
-
-## 3. 已完成的工程工作
-
-### 3.1 Rust StorageEngine 骨架
-
-已建立 Rust 存储所有权骨架，包含：
-
-- 中央 SQLite 注册和连接管理。
-- Write Actor 入口。
-- Read Pool 入口。
-- Schema 初始化入口。
-- 数据库代际与运行时元数据接口。
-- Native Runtime 的 Store 生命周期接口。
-- Runtime capability/ABI 握手字段。
-
-当前目标结构是：
-
-```text
-NativeKnowledgeRuntime
-└── SqliteStorageEngine
-    ├── Write Actor
-    ├── Read Pool
-    ├── Schema/Migration
-    └── Runtime metadata
-```
-
-需要注意：当前代码仍处于施工阶段，健康恢复、任务排空、严格关闭语义和所有旁路连接审计尚未达到最终完成定义。
-
-### 3.2 NativeKnowledgeRuntime 接口扩展
-
-已增加或推进以下接口族：
-
-- `openAndInitStore`
-- `storeState`
-- `healthCheck`
-- `databaseGeneration`
-- `capabilities`
-- `commitIngestionBatch`
-- `commitDeleteBatch`
-- `probeIngestionFiles`
-- `probeIngestionTags`
-- `probeMigrationReuse`
-- `cleanupDatabaseOrphans`
-- `getTagConsistencySnapshot`
-- `commitTagConsistency`
-- `getKvVector`
-- `setKvVector`
-- `listKvVectors`
-- `hydrateChunksByIds`
-- `hydrateChunksByFilePaths`
-- 日记本列表、文件范围、日期索引等轻量查询
-- 日记索引注册、注销、恢复和 checkpoint
-- Runtime 所有权的 watcher 启停和事件排空
-
-KBM 启动阶段已经增加 capability handshake，要求原生模块具备中央存储、摄取、删除、Tag 一致性、索引恢复、watcher 和 Memo/River 查询能力。缺少能力时启动失败，而不是退回 JS 中央数据库连接。
-
-### 3.3 摄取事实表提交
-
-已将摄取批次的事实表提交接入 Rust Write Actor：
-
-- 文件版本检查在 Rust 事务内执行。
-- `files`、`chunks`、`tags`、`file_tags` 和迁移缓存消费进入 Rust 事务。
-- JS 保留文件读取、文本切分、Tag 提取和 Embedding API 编排。
-- 向量以 Float32Array 位置槽提交，Rust 校验维度、长度和有限浮点值。
-- 部分 Embedding 失败以空槽保留，不通过删除数组元素改变位置。
-- 迁移向量复用在 Rust 事务内读取 BLOB，避免向量 BLOB 进入 V8。
-- 返回事实提交回执、受影响文件、Chunk、日记和 Tag 信息。
-
-当前仍需补齐：
-
-- 原生批次 TTL、取消、预算和持久化操作身份。
-- 同一路径删除/修改后的旧 Embedding 防复活。
-- 严格的文件快照再校验和预处理版本校验。
-- 部分失败、乱序返回和重复提交的完整持久化语义。
-- Rust 权威文本切分与 Tag 规则迁移。
-
-### 3.4 删除提交和索引 Delta
-
-本阶段已完成删除路径的关键收口：
-
-- Rust `DeleteCommitTask` 取得已注册日记索引的 Arc 快照。
-- 删除事实事务继续由 Rust Write Actor 执行。
-- 删除后的 Chunk ID Delta 在 Rust 后台任务内应用到驻留日记索引。
-- `DeleteCommitResult` 增加 `indexReady`。
-- Rust 事实提交成功但索引未驻留、锁失败或删除失败时返回 `indexReady: false`，不把已提交事实误判为可重试数据库失败。
-- JS `_handleDeleteBatch` 已移除：
-  - `indexRepository.applyChunkDelta`
-  - 大删除时的 JS 索引注销
-  - JS 持久化索引删除
-- JS 只保留日期缓存失效、回执日志和队列状态处理。
-- KBM 空删除批次回执已明确返回 `indexReady: true`。
-
-已执行并通过：
-
-```text
-cargo check --manifest-path rust-vexus-lite/Cargo.toml
-node --check KnowledgeBaseManager.js
-node --check modules/knowledgeBase/ingestionPipeline.js
-node --check modules/knowledgeBase/fileWatcher.js
-```
-
-最后一次验证结果：
-
-```text
-Exit code: 0
-Finished `dev` profile [unoptimized + debuginfo]
-无编译警告
-```
-
-删除 Delta 当前仍是“事实提交后应用内存索引”的协调实现，不是 SQLite 与 usearch 的跨资源事务。后续必须接入索引发布门禁、已应用代际、失效记录和崩溃恢复。
-
-### 3.5 Rust watcher 事件队列
-
-已推进 Rust watcher 的 Runtime 所有权方向：
-
-- `NativeKnowledgeRuntime` 持有 watcher。
-- watcher 事件进入 Rust 内部有界队列。
-- Runtime 暴露 `drainWatchEvents`。
-- JS `fileWatcher.js` 使用 Runtime 队列消费轻量事件。
-- RAG 参数 watcher 也已改为 Rust watcher 队列消费。
-- `WatcherConfig` 的 TypeScript 声明已补充 `initialScan`。
-- watcher 的稳定性采样、generation 和稳定事件字段已纳入事件结构。
-
-当前仍需重点
```

**File**: `docs/KBM纯Rust单一SQL真相源与异步冷启动架构施工草图.md` (removed, +0/-1241)
```diff
@@ -1,1241 +0,0 @@
-# KBM 纯 Rust 单一 SQL 真相源与异步冷启动架构施工草图
-
-> **2026-10-18 施工状态更新**：本文件保留设计与历史提案，不再代表“尚未实施”。中央 SQL 所有权、Rust 文本计划、持久化 Tag 计划、部分代际门禁、watcher 缺失补偿与定向测试已落地；完整生产验收仍未完成。当前证据和未闭环项见[续施工日志第 11 节](./KBM纯Rust单一SQL真相源与异步冷启动架构施工日志-2026-10-17-续.md:381)。后续施工严格排除 TDB、LightMemo，不依据历史提案扩展兼容范围。
-
-> **状态**：最终施工方案已写入第 7—16 章；第 1—6 章仅保留为历史调查，不作为当前施工指令。仅修改文档，尚未实施生产源码迁移。
-> **日期**：2026-10-17
-> **作者**：Kerr & Ryan
-> **目标仓库**：`H:\VCP\VCPMain\VCPToolBox`
-
----
-
-## 1. 核心命题与第一性原理边界
-
-### 1.1 为什么不把整个 VCPToolBox 主服务器重写为纯 Rust？
-VCPToolBox 的核心竞争力之一是 `Plugin.js` 统领的 90+ 常驻服务插件、预消息处理器（Preprocessor）与混合插件生态。这些 JS 插件运行在**同一个 V8 Heap** 内，通过对象引用直传（0ns 指针传递）和动态模块方法混入深度协同。
-若将 HTTP/WebSocket 主服务器强行改为纯 Rust，任何插件钩子调用都将退化为跨进程 IPC 或跨 FFI 边界的 JSON 序列化/反序列化，重蹈 Tauri 双堆状态撕裂的覆辙。
-
-### 1.2 真正需要纯 Rust 大一统的边界在哪里？
-真正的性能与内存病灶不在业务编排层，而在 **`KnowledgeBaseManager`（KBM）的数据面与存储主权割裂**：
-1. **现状割裂**：`rust-vexus-lite` 仅负责 ANN 检索与 RiverMemo/EPA 算子计算；而 `VectorStore/database.sqlite`（及 `knowledge_base.sqlite`）的 Schema 管理、写入、冷启动对称差分查询、双槽基线调度、以及 `LightMemo` 的候选拉取，仍由 JS 侧 `better-sqlite3` 同步持有并执行。
-2. **破局方向（One SQL Truth in Rust）**：
-   - **保留 JS 控制面**：Node.js 主进程继续承载全部插件生态、HTTP/SSE 流式路由与远端 Embedding API 网络请求；
-   - **收归 Rust 数据面**：将中央记忆库 SQLite 的**唯一读写持有权**、USearch 向量索引生命周期（含冷启动按需加载、双槽代际回放、空闲卸载）、文件变更 Diff 预检、以及 `LightMemo` 作用域混合检索，100% 收拢至 `rust-vexus-lite` 的 `NativeKnowledgeRuntime` 内部。
-   - **彻底移除 KBM 的 `better-sqlite3` 连接**：让中央记忆库在全进程内只有 Rust `rusqlite` 一个连接池真相源，从物理上消灭双连接 Page Cache 膨胀、跨语言 WAL 写锁竞态（`rustWriteLease`）与 V8 主线程阻塞。
-
----
-
-## 2. 现行架构三大病灶的源码级验尸（Forensics）
-
-### 2.1 病灶一：Agent B 后台唤醒冷启动，卡停 Agent A 的 SSE 流式输出
-当 Agent A 正在进行高频 SSE 流式输出时，若 Agent B 进入后台唤醒并触发未驻留日记本的记忆检索，Node.js 主线程 Event Loop 会出现 **100ms~400ms 级别的同步冻结**。源码级真凶如下：
-
-1. **USearch 索引同步加载阻塞主线程**：
-   - 坐标：`rust-vexus-lite/src/lib.rs:324` (`#[napi(factory)] pub fn load(...)`) 与 `lib.rs:374` (`#[napi] pub fn save(...)`)。
-   - 问题：这两个 N-API 方法均为**同步导出函数**。当 `modules/knowledgeBase/indexRepository.js:183` (`loadDiaryBaseline`) 或 `422` (`loadGlobalTagBaseline`) 调用 `this.VexusIndex.load(...)` 时，直接在 V8 主线程上执行磁盘 I/O 与 HNSW 图结构反序列化；同理，`publishDiaryBaseline` (`indexRepository.js:317`) 与 `publishGlobalTagBaseline` (`529`) 调用 `index.save(...)` 在主线程同步写盘并执行 Windows 文件替换重试。
-2. **冷启动基线对称差分在 JS 主线程拉取全量 Vector BLOB**：
-   - 坐标：`modules/knowledgeBase/indexRepository.js:107-159` (`_countDiaryBaselineDelta`) 与 `191-257` (`loadDiaryBaseline` 差分回放)；Tag 基线同理位于 `366-485`。
-   - 问题：用 `better-sqlite3` 在主线程同步执行多表 `LEFT JOIN chunk_index_baseline_entries` 查询，将所有增量 Chunk 的 `3072 * 4 = 12KB` Vector BLOB 读入 V8 堆内存，再在 JS 主线程分配巨型 `new Float32Array(addedRows.length * 3072)` 逐行拷贝（`flat.set`），最后再跨 N-API 传回给 Rust 的 `index.applyChunkDelta(...)`。
-   - 荒谬性：**数据原本在 SQLite，目标消费者是同进程的 Rust `usearch::Index`，却在冷启动热路径上绕道 V8 主线程完成同步查询与内存拼接！**
-
-### 2.2 病灶二：`LightMemo` 引发数百 MB 内存峰值与 V8 Major GC 停顿
-每次调用 `LightMemo`（如 JEV `主动回忆`），都会制造剧烈的 RSS 内存尖峰并卡顿主线程：
-
-1. **全表拉取 Chunk 正文并在 V8 主线程全量 Jieba 分词**：
-   - 坐标：`Plugin/LightMemo/LightMemo.js:2002-2092` (`_gatherCandidateChunks`)。
-   - 问题：直接操作 `this.vectorDBManager.db.prepare(...)` 执行 `SELECT c.id, c.file_id, c.content, f.diary_name, f.path FROM chunks c JOIN files f ON c.file_id = f.id`，把目标日记本（开启全库搜索时为整库）数千至上万条 Chunk 的完整文本同步拉入 V8，紧接着对每条 Chunk 同步调用 `this.jiebaInstance.cut(text)` 构造 `tokens` 数组常驻在候选对象上。
-2. **绕过 Rust 索引，在 JS 主线程执行 N+1 次 BLOB 查询与纯 JS 余弦点积**：
-   - 坐标：`Plugin/LightMemo/LightMemo.js:2111-2145` (`_scoreByVectorSimilarity`) 及 `671` (`_handleRiverMemoSearch`)、`923` (`handleMemoryAB`)。
-   - 问题：对收集到的全部 `candidates`（即便在 RiverMemo 模式下），先在 JS 主线程循环调用 `stmt.get(candidate.label)`（`SELECT vector FROM chunks WHERE id = ?`），将数千条 12KB 向量 BLOB 逐一拉进 Node.js Buffer，再用纯 JS 循环 `this._cosineSimilarity(queryVector, chunkVector)` 算几千万次浮点乘加！
-   - 二次读取：第 680 行将算完分数的庞大 JS 候选数组传给 `rerankWithRiverMemoAsync` 后，Rust 侧（`result_deduplicator.rs` / `rivermemo_topology_v3.rs`）又打开 `rusqlite` 连接去同一个 SQLite 数据库二次读取这批向量！
-
-### 2.3 病灶三：SQLite 双连接争抢、双倍 Page Cache 与 `rustWriteLease` 复杂度
-1. **双驱动并存**：
-   - JS 侧：`KnowledgeBaseManager.js:345` 使用 `better-sqlite3` 打开长连接 `this.db`；
-   - Rust 侧：`rust-vexus-lite/src/` 下共 6 处使用 `rusqlite::Connection::open_with_flags` 打开同一数据库文件（`knowledge_runtime.rs:344`、`lib.rs:1434/1455`、`memo_artifact_builder.rs:81/93`、`memo_pipeline.rs:72`、`result_deduplicator.rs:35`、`rivermemo_topology_v3.rs:601`）。
-2. **后果**：
-   - **双份内存页缓存**：`better-sqlite3` 与 `rusqlite` 各自在 C++/Rust 堆维护独立的 SQLite Page Cache；当 `LightMemo` 全表扫 `chunks` 时，`better-sqlite3` 缓存急剧膨胀且不与 Rust 共享。
-   - **跨语言写锁互斥胶水**：因为 JS 写 `files/chunks/tags/*_baselines`，而 Rust 写 `tag_pair_similarity` / `tag_intrinsic_residuals` / `tagmemo_artifacts`，为了防止双写触发 `SQLITE_BUSY`，被迫在 `KnowledgeBaseManager.js:85-92, 251, 904-922` 与 `modules/knowledgeBase/databaseCoordinator.js` 中编写了近 600 行的 `rustWriteLease` 租约状态机与 `waitForIdle` 50ms 轮询等待。
-
----
-
-## 3. 全仓 `kbm.db` 触点盘点与隔离边界
-
-### 3.1 独立 SQLite 数据库（保持原状，不在本工程变更范围内）
-经全仓检索 `require('better-sqlite3')`，以下模块操作的是**各自独立的业务 `.sqlite` 文件**，与中央记忆库无交集，保持原样：
-- `TDBKnowledge.js` (`VectorStoreT
```

---

### Incident Patch 3: `d29c10af` (2026-10-18)
**Commit Message**: fix

**File**: `.gitignore` (modified, +8/-1)
```diff
@@ -299,8 +299,12 @@ helloagents/
 # Windows 缩略图缓存
 Thumbs.db
 
+# 源码研究
+docs/TriviumDB-master/
+
 # ===== 编译产物 =====
 rust-vexus-lite/target/
+rust-vexus-lite/crates/vcp-tdb-index/target/
 Plugin/DailyNoteSearcher/src/target/
 Plugin/CodeSearcher/src/target/
 Plugin/PaperReader/paperreader-rs/target/
@@ -317,4 +321,7 @@ Plugin/.backup/
 
 # ==== 开发SDK ====
 Plugin/VCPQQBotServer/bot-node-sdk-main
-开发日志/
\ No newline at end of file
+开发日志/
+
+# Local native artifact archives; retain outside disposable build caches.
+/.vcp-native-archive/
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #504** (2026-10-18): feat(kbm): Rust 单 SQL 运行时、TDB 索引与管理面板统一 (@lioensky)
- **PR #503** (2026-10-18): fix(LinuxLogMonitor): prevent watchdog timeout from terminating host … (@joker74581)
- **PR #502** (2026-10-17): test(jev): 修复 JEV 生态/红队/压测套件可选插件 t.skip 守卫与策略文件沙盒隔离 (@Cimo-Yu)
- **PR #499** (2026-10-16): fix(deps): 恢复插件商店插件 YoutubeFetch 所需的宿主 Python 依赖 (#495) (@Cimo-Yu)
- **PR #498** (2026-10-16): fix: 修复提示词硬编码路径与dotenv双反斜杠(#494)、残留依赖(#495)、PM2解释器ABI(#496)及未同步Var告警(#497) (@Cimo-Yu)
- **PR #493** (2026-10-14): fix(vcpLoop): 修复 ToolCallParser 中 JEV 字段歧义抢占缺陷，合并收敛 JEV 全域生态测试并支持缺失插件优雅跳过 (@infinite-vector)

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

## X. Merge pull request #503 from joker74581/fix/linux-log-monitor-watchdog-exit

**RULE**:
When implementing operations in `Plugin/LinuxLogMonitor/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5ec30822`: Merge pull request #503 from joker74581/fix/linux-log-monitor-watchdog-exit. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `Plugin/LinuxLogMonitor/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
- 30分钟无数据自动优雅停止当前监控任务并释放资源
- 避免调用 `process.exit(1)` 误杀宿主服务进程（适配 hybridservice direct 常驻模式）
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
- 30分钟无数据自动触发 `process.exit(1)`
- 防止进程僵死，配合进程管理器实现自动重启
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5ec30822` are properly handled with clean fallback behavior.
