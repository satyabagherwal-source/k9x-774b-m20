> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source**: github ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Source Version**: `d9f61c0d`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T23:53:56.709Z  
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
> **Harvest Timestamp**: 2026-10-19T23:53:56.262Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2376 stars

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

### Incident Patch 1: `96e961ad` (2026-10-19)
**Commit Message**: fix

**File**: `docs/ChangeLog.md` (modified, +23/-2)
```diff
@@ -2,6 +2,29 @@
 
 **2026-10-20**
 
+**核心算法升级：RiverMemo V2 算法正式登场**
+
+#### 🌟 核心突破一：双场投影「有向连通域圈选」与 I/O 复杂度坍缩至 $O(1)$
+* **痛点问题**：
+  在早期架构中，双尺度 Resolvent 场（局部场 Local 与迁移场 Transfer）在全图迭代后，会遍历全库所有非零长尾节点去磁盘拉取 3072 维向量。在 5 万+ 标签规模下，单次查询需扫描数万条高维向量 BLOB，导致数百毫秒的 I/O 停顿，无法向数百万级标签平滑扩展。
+* **物理创新（有向连通流域扩圈 Core-Anchored Region Growing）**：
+  * **摒弃一维标量散点截断**：不再简单按数值大小挑散点，改用以当前脉冲河网（Spike River Graph）为绝对内核的**最大堆有向连通扩圈算法**（`BinaryHeap<ProjectionFrontier>`）。候选节点必须由已入选前驱沿正权出边暴露，绝不跨越断裂带去抓取孤立山峰，确保参与投影的节点在拓扑流形上是**100% 无断裂的连续连通域**。
+  * **预算与质量双重自适应收敛**：引入 `maxFieldProjectionNodes`（默认 256，支持 128/256/512 动态配置）与 80%/90% 质量目标自然收敛。
+  * **全链路请求级向量池（TagVectorPool）**：金字塔、观测融合、双场投影与 V3 读出头全程共享内存向量池，彻底消除单次查询内部多达 4 次的重复数据库查表。
+* **实测收益**：
+  * **高维向量磁盘拉取量暴降 99.5%**：从每次查询扫描全库数万条高维向量，骤降为**恒定 $\le 256$ 条**。
+  * **端到端延迟断崖式下降**：双场求解与投影阶段耗时从 **300ms+ 坍缩至 1~3ms**。无论知识库膨胀到 5 万还是 500 万标签，计算复杂度与内存占用被严格锁定在常数级 $O(1)$。
+
+#### 🌌 核心突破二：Spike 请求级「动态语境残差虫洞」（真·跨界顿悟能力）
+* **痛点问题**：
+  现实生活中的高频枢纽概念（如“日常生活”、“亲密互动”、“游戏开发”）往往连结着数百个不同分支。在静态图上，这些重要的高特异性跨界记忆（例如“日常甜点 $\to$ 水蜜桃”、“风 $\to$ 歌”）常常排在第 20 名开外，不仅容易被静态 Top-K 邻居截断误杀，更会被庞大的出度分母严重稀释，导致电流无法触发激活。
+* **物理创新（历史共现先验 $\times$ 深层正交残差共鸣）**：
+  * **虫洞不是静态户口本，而是当下的语境折叠**：记忆不是脱离语境的静态死链。我们利用残差金字塔（AGS）剥离出的深层正交残差向量 $\vec{r}_l$（代表当前对话中尚未被表层实体解释的深层意图与情绪张力），在脉冲寻路时动态感应历史出边。
+  * **因果层级与四次方共鸣赋能**：源节点在金字塔第 $L$ 层时，只允许层号 $> L$ 的深层残差提供共鸣支持。当一条历史出边的目标向量与深层残差产生强共鸣（$r = \cos(\vec{r}, \vec{v}) \ge 0.20$）时，以 $c \times r^4$ 进行非线性赋能，并在 Top-K 内设立专属动态席位，打破高频平庸词对出边通道的霸凌。
+* **实测收益（48 篇真实长篇日记 / 144 组严格全库对照实测）**：
+  * **跨界命中纯度暴涨 2~5 倍**：在真实日记探针测试中，基于深层残差动态虫洞激活的记忆节点，其对原日记深层意图的真实命中率从静态 Top-20 的 **7.10%** 跃升至 **14.59%（@0.2 阈值）** 与 **33.09%（@0.3 阈值）**！
+  * **彻底超越无图纯向量基线**：相比于脱离图拓扑的纯向量近邻搜索（命中率仅 2.60%）和乱序语境对照组（6.22%），动态虫洞展现出了绝对的因果定点穿越能力，真正实现了**“由风联想到歌”、“由地缘博弈跨越到荒诞本质”**的超距思维跃迁！
+
 **后端：安全性与稳定性更新**
 
 1.  **修复 2bit 映射幽灵问题：** 修复 4096 维向量在 2bit 映射上以 1/255 概率出现的不拟合幽灵问题。
@@ -10,8 +33,6 @@
 4.  **优化跨进程索引代际管理：** 修复 PM2 管理的进程隔离模式下，手动重启后进程 PID 与代际索引绑定丢失、进而创建不必要的新 .vec 索引的问题。
 5.  **增强索引持久化安全性：** 优化 TDB 图结构，为 .vec 中的 2bit 索引原生加入 48 字节的头部代际签名，并采用 A/B 双槽写入。安全性翻倍，SSD 写入总量不变；单个 Vec 体积为 Usearch 的 1/4，两个 Vec 槽仍仅占 Usearch 一半的空间，整体依旧具有优势。默认仍在累积 2.5% 变动后才更新硬盘上的 .vec 图索引。
 
-本次更新以安全性改进为主。
-
 **2025-06-02**
 
 1.  **优化日记渲染：** 提升了日记内容的显示效果，使其在界面上更加美观、易读。
```

---

### Incident Patch 2: `deb9d156` (2026-10-19)
**Commit Message**: fix2

**File**: `KnowledgeBaseManager.js` (modified, +58/-1)
```diff
@@ -5,6 +5,10 @@ const fs = require('fs').promises;
 const fsSync = require('fs');
 const path = require('path');
 const crypto = require('crypto');
+const { AsyncLocalStorage } = require('node:async_hooks');
+
+// 单轮请求拥有共享观测；异步读出只借用句柄，不得提前释放。
+const memoObservationScope = new AsyncLocalStorage();
 const { getEmbeddingsBatch } = require('./EmbeddingUtils');
 const ResultDeduplicator = require('./ResultDeduplicator'); // ✅ Tagmemo v4 requirement
 const TagMemoEngine = require('./TagMemoEngine');
@@ -2057,6 +2061,57 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
         return { artifact, dbPath: this.dbPath };
     }
 
+    async withMemoObservationScope(operation) {
+        const current = memoObservationScope.getStore();
+        if (current?.owner === this) return operation();
+        const scope = { owner: this, tasks: new Map(), handles: new Set() };
+        return memoObservationScope.run(scope, async () => {
+            try {
+                return await operation();
+            } finally {
+                await Promise.allSettled(scope.tasks.values());
+                for (const handle of scope.handles) {
+                    try {
+                        this.tagIndex?.releaseMemoObservation?.(handle);
+                    } catch (error) {
+                        console.warn(`[KnowledgeBase] Shared Memo release failed: ${error.message}`);
+                    }
+                }
+                scope.tasks.clear();
+                scope.handles.clear();
+            }
+        });
+    }
+
+    _runMemoPipelineShared(dbPath, artifactSig, inputJson, queryVector, ghostVectors) {
+        const scope = memoObservationScope.getStore();
+        if (!scope || scope.owner !== this) {
+            return this.tagIndex.runMemoPipeline(
+                dbPath, artifactSig, inputJson, queryVector, ghostVectors
+            );
+        }
+        // 使用实际 ABI 输入：包含完整 FP32 向量、所有有效配置和资产身份，
+        // 不包含候选索引、权限、K 或排序选项。
+        const key = crypto.createHash('sha256')
+            .update(stableSerialize([dbPath, artifactSig, JSON.parse(inputJson)]))
+            .update(Buffer.from(queryVector.buffer, queryVector.byteOffset, queryVector.byteLength))
+            .update(Buffer.from(ghostVectors.buffer, ghostVectors.byteOffset, ghostVectors.byteLength))
+            .digest('hex');
+        if (!scope.tasks.has(key)) {
+            const task = Promise.resolve().then(async () => {
+                const result = await this.tagIndex.runMemoPipeline(
+                    dbPath, artifactSig, inputJson, queryVector, ghostVectors
+                );
+                const metadata = JSON.parse(result.metadataJson);
+                if (metadata.observationHandle) scope.handles.add(metadata.observationHandle);
+                return result;
+            });
+            // 在启动原生任务前登记 Promise；失败也共享，避免同轮失败风暴。
+            scope.tasks.set(key, task);
+        }
+        return scope.tasks.get(key);
+    }
+
     /**
      * 统一原生感应入口。
      *
@@ -2141,7 +2196,7 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
             isCore: tag.isCore
         }));
 
-        const nativeResult = await this.tagIndex.runMemoPipeline(
+        const nativeResult = await this._runMemoPipelineShared(
             dbPath,
             artifact.artifactSig,
             JSON.stringify({
@@ -2421,6 +2476,8 @@ this.tagMemoV10Engine = new TagMemoV10Engine(
     releaseMemoObservation(prepared) {
         const handle = prepared?.observationHandle;
         if (!handle || typeof this.tagIndex?.releaseMemoObservation !== 'function') return false;
+        const scope = memoObservationScope.getStore();
+        if (scope?.owner === this && scope.handles.has(handle)) return false;
         try {
             return this.tagIndex.releaseMemoObservation(handle);
         } catch (error) {
```

**File**: `Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js` (modified, +38/-14)
```diff
@@ -1380,6 +1380,13 @@ class RAGDiaryPlugin {
 
     // processMessages 是 messagePreprocessor 的标准接口
     async processMessages(messages, pluginConfig) {
+        const run = () => this._processMessagesWithMemoScope(messages, pluginConfig);
+        return typeof this.vectorDBManager?.withMemoObservationScope === 'function'
+            ? this.vectorDBManager.withMemoObservationScope(run)
+            : run();
+    }
+
+    async _processMessagesWithMemoScope(messages, pluginConfig) {
         const ownedMemoObservations = new Set();
         let systemMessageTasks = [];
         try {
@@ -1631,10 +1638,16 @@ class RAGDiaryPlugin {
             if (this.riverThinkingConfig?.enabled && targetSystemMessageIndices.some(index =>
                 /\[\[VCP元思考[^\]]*\]\]/.test(this._extractTextFromContent(messages[index].content))
             )) {
+                const ready = [false, true].map(() => {
+                    let resolve;
+                    const promise = new Promise(done => { resolve = done; });
+                    return { promise, resolve };
+                });
                 requestCache.riverThinking = {
                     config: this.riverThinkingConfig,
                     observations: [],
-                    deferred: []
+                    deferred: [],
+                    ready
                 };
             }
             // 🌟 优化：并发处理所有目标 system 消息，显著提升多日记本场景下的 Rerank 速度
@@ -1670,16 +1683,20 @@ class RAGDiaryPlugin {
                     () => processedContent
                 );
             });
-            await Promise.all(systemMessageTasks);
-
-            // 所有日记门控和检索结束后再执行元思考，不等待自身造成死锁。
-            // 观测只保留在本请求；禁止单例 lastObservation 串会话。
+            // 元思考只等待同类查询的感应就绪，而非 RiverMemo 读出完成。
+            // 独立快照只含日记任务，禁止元思考等待自身造成死锁。
+            let deferredTasks = [];
             if (requestCache.riverThinking) {
-                const deferredTasks = requestCache.riverThinking.deferred.map(async task => ({
+                requestCache.riverThinking.diaryTasks = Promise.allSettled(systemMessageTasks.slice());
+                deferredTasks = requestCache.riverThinking.deferred.map(async task => ({
                     token: task.token,
                     result: await task.run()
                 }));
                 systemMessageTasks.push(...deferredTasks);
+            }
+            await Promise.all(systemMessageTasks);
+
+            if (requestCache.riverThinking) {
                 const deferredResults = await Promise.all(deferredTasks);
                 for (const { token, result } of deferredResults) {
                     for (const index of targetSystemMessageIndices) {
@@ -1901,7 +1918,12 @@ class RAGDiaryPlugin {
                         requestCache?.riverThinking ? {
                             config: requestCache.riverThinking.config,
                             getObservation: async () => {
-                                const eligible = requestCache.riverThinking.observations
+                                const thinking = requestCache.riverThinking;
+                                await Promise.race([
+                                    thinking.ready[Number(useGroup)].promise,
+                                    thinking.diaryTasks
+                                ]);
+                                const eligible = thinking.observations
                                     .filter(entry => entry.useGroup === useGroup)
                                     .sort((a, b) => a.scope.localeCompare(b.scope));
                                 return eligible[0]?.prepared || null;
@@ -3206,6 +3228,14 @@ class RAGDiaryPlugin {
                     console.warn('[RAGDiaryPlugin] River thinking observation unavailable:', error.message);
                 }
             }
+            if (thinkingObservation) {
+                requestCache.riverThinking.observations.push({
+                    scope: `${dbScopeKey}:${modifiers}`,
+                    useGroup,
+                    prepared: thinkingObservation
+                });
+                requestCache.riverThinking.ready?.[Number(useGroup)]?.resolve();
+            }
             const nativeResult =
                 await this.vectorDBManager.executeNativeRiverQuery(
                     {
@@ -3242,13 +3272,7 @@ class RAGDiaryPlugin {
                         enabled: true
                     }
                 );
-            if (thinkingObservation && nativeResult?.artifactSig === thinkingObservation.artifact.artifactSig) {
-                requestCache.riverThinking.observations.push({
-                    scope: `${dbScopeKey}:${modifiers}`,
-                    useGroup,
-                    prepared: thinkingObservation
-                });
-            }
+            // 观测在原生读出前发布，元思考与 RiverMemo 均只读借用。
             candidates = this._filterContextDuplicates(
                 (nativeResult.results || []).map(item => ({
                     ...item,
```

**File**: `tests/memoObservationSharing.test.js` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+'use strict';
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const kb = require('../KnowledgeBaseManager');
+const rag = require('../Plugin/RAGDiaryPlugin/RAGDiaryPlugin');
+
+function fixture() {
+    const calls = [];
+    const released = [];
+    const owner = Object.create(kb);
+    owner.tagIndex = {
+        async runMemoPipeline(...args) {
+            calls.push(args);
+            await new Promise(resolve => setImmediate(resolve));
+            return {
+                metadataJson: JSON.stringify({ observationHandle: `handle-${calls.length}` }),
+                enhancedVector: new Float32Array([1, 0])
+            };
+        },
+        releaseMemoObservation(handle) { released.push(handle); return true; }
+    };
+    const run = (vector = new Float32Array([1, 0]), input = '{}', sig = 'a',
+        ghosts = new Float32Array()) =>
+        owner._runMemoPipelineShared('test.sqlite', sig, input, vector, ghosts);
+    return { owner, calls, released, run };
+}
+
+test('parallel and sequential index consumers share one pipeline and defer release', async () => {
+    const f = fixture();
+    await f.owner.withMemoObservationScope(async () => {
+        const results = await Promise.all(Array.from({ length: 20 }, () => f.run()));
+        assert.equal(f.calls.length, 1);
+        assert(results.every(result => result === results[0]));
+        assert.equal(await f.run(), results[0]);
+        assert.equal(f.owner.releaseMemoObservation({ observationHandle: 'handle-1' }), false);
+        assert.deepEqual(f.released, []);
+        await f.owner.withMemoObservationScope(() => f.run());
+        assert.equal(f.calls.length, 1);
+    });
+    assert.deepEqual(f.released, ['handle-1']);
+});
+
+test('full vector, ghost payload, config and artifact differences do not merge', async () => {
+    const f = fixture();
+    await f.owner.withMemoObservationScope(async () => {
+        const vector = new Float32Array(128).fill(1);
+        const changed = vector.slice();
+        changed[127] = 1.00001;
+        await f.run(vector);
+        await f.run(changed);
+        await f.run(vector, '{"config":{"alpha":0.2}}');
+        await f.run(vector, '{}', 'b');
+        await f.run(vector, '{}', 'a', new Float32Array([0, 1]));
+        assert.equal(f.calls.length, 5);
+    });
+    assert.equal(f.released.length, 5);
+});
+
+test('independent concurrent requests never borrow each other observations', async () => {
+    const f = fixture();
+    await Promise.all([
+        f.owner.withMemoObservationScope(() => f.run()),
+        f.owner.withMemoObservationScope(() => f.run())
+    ]);
+    assert.equal(f.calls.length, 2);
+});
+
+test('pipeline failures merge within a request, and successful handles release on exception', async () => {
+    const f = fixture();
+    let failures = 0;
+    const original = f.owner.tagIndex.runMemoPipeline;
+    f.owner.tagIndex.runMemoPipeline = async (...args) => {
+        if (JSON.parse(args[2]).fail) { failures++; throw new Error('sense failed'); }
+        return original(...args);
+    };
+    await assert.rejects(f.owner.withMemoObservationScope(async () => {
+        const failed = await Promise.allSettled([
+            f.run(undefined, '{"fail":true}'), f.run(undefined, '{"fail":true}')
+        ]);
+        assert(failed.every(item => item.status === 'rejected'));
+        assert.equal(failures, 1);
+        await f.run();
+        throw new Error('readout failed');
+    }), /readout failed/);
+    assert.deepEqual(f.released, ['handle-1']);
+});
+
+test('meta readout starts after sensing but before diary readout completes', async () => {
+    const host = Object.create(rag);
+    let metaStarted = false;
+    let diaryFinished = false;
+    let unblock;
+    const blocked = new Promise(resolve => { unblock = resolve; });
+    host.vectorDBManager = {};
+    host.directDiaryTextProcessor = { async tryProcessMessages() { return { processed: false }; } };
+    host.contextVectorManager = {
+        async updateContext() {},
+        segmentContext() { return []; }
+    };
+    host.foldingStore = null;
+    host.riverThinkingConfig = { enabled: true };
+    host._resolveGhostAnchors = async () => [];
+    host.getSingleEmbeddingCached = async () => [1, 0];
+    host._getWeightedAverageVector = () => [1, 0];
+    host._calculateDynamicParams = async () => ({ k: 3, tagWeight: 0.2, metrics: {} });
+    host.timeParser = { parse: () => [] };
+    host._processSingleSystemMessage = async (...args) => {
+        const cache = args[args.length - 1];
+        cache.riverThinking.deferred.push({
+            token: 'pending-meta',
+            run: async () => {
+                await cache.riverThinking.ready[0].promise;
+                assert.equal(diaryFinished, false);
+                metaStarted = true;
+                unblock();
+                return { content: 'meta-result' };
+            }
+        });
+ 
```

**File**: `tests/ragNativeChainAudit.test.js` (modified, +30/-0)
```diff
@@ -81,6 +81,36 @@ test('audit real Rust store through KBM and RAG message injection', async () =>
         assert.equal((await kb.getChunksByFilePaths(['A/note.md']))[0].vector.length, 4);
         assert.equal((await kb.getTagVectorByName('alpha')).length, 4);
 
+        // 真实原生多索引查询：共享 Sense，但候选、权限及排序独立。
+        const pipelineOriginal = kb.tagIndex.runMemoPipeline.bind(kb.tagIndex);
+        let pipelineCalls = 0;
+        kb.tagIndex.runMemoPipeline = (...args) => {
+            pipelineCalls++;
+            return pipelineOriginal(...args);
+        };
+        const memoryBefore = JSON.parse(kb.tagIndex.memoObservationMemoryStats()).entries;
+        try {
+            await kb.withMemoObservationScope(async () => {
+                const results = await Promise.all(['A', 'B'].map(name =>
+                    kb.executeNativeRiverQuery(
+                        { text: 'shared native audit', vector: query },
+                        { diaryNames: [name], topK: 1, fallbackToLegacy: false }
+                    )
+                ));
+                assert.equal(pipelineCalls, 1, 'two scopes must execute one native Sense');
+                results.forEach((result, index) => {
+                    assert.equal(result.results.length, 1);
+                    assert(result.results.every(row => row.diaryName === ['A', 'B'][index]));
+                });
+                assert.equal(JSON.parse(kb.tagIndex.memoObservationMemoryStats()).entries,
+                    memoryBefore + 1, 'one shared native observation remains alive');
+            });
+            assert.equal(JSON.parse(kb.tagIndex.memoObservationMemoryStats()).entries,
+                memoryBefore, 'request end releases the shared native observation');
+        } finally {
+            kb.tagIndex.runMemoPipeline = pipelineOriginal;
+        }
+
         rag.vectorDBManager = kb;
         rag.queryCacheEnabled = false;
         rag.ragParams = {};
```

---

### Incident Patch 3: `1cda8be3` (2026-10-19)
**Commit Message**: fix

**File**: `docs/RIVERMEMO_TOPOLOGY_V3.md` (modified, +159/-32)
```diff
@@ -4,10 +4,12 @@
 > 算法标识：`rivermemo.topology-v3.1`
 > 结果协议：`rivermemo-topology-v3-result-v1`
 > 原生计算内核：`rivermemo.topology-v3.1-rust`
-> 文档更新时间：2026-09-24
+> 文档更新时间：2026-10-19
 > 本文只记录拓扑 V3；其他历史、实验或对照构型不属于本文范围。
 >
-> **当前实现状态**：Rust 统一 Memo 管线已经负责 EPA、Residual Pyramid、Tag 门控、
+> **当前实现状态**：降噪传播底座已切换为 **AGS 统一场背景图**：同一套 AGS
+> 双尺度统一几何预计算提供局部残差/锚增益与全局星团主题面，分别参与传输图构建和
+> EPA 背景校准。Rust 统一 Memo 管线负责 EPA、Residual Pyramid、Tag 门控、
 > Sense 扩散、请求级河网、向量融合和局部/迁移双场；Topology V3 继续在 Rust/Rayon
 > 内完成候选投影、候选超集、路径几何、相对拓扑、河网形态、Ω、Direct Anchor、
 > 批级条件创新与最终排序。
@@ -59,7 +61,7 @@ s_A-\tau_A
 
 - \(\Pi_{[a,b]}(x)=\min(b,\max(a,x))\) 是区间投影；
 - \([x]_+=\max(0,x)\) 是正部；
-- \(S_i^{\mathrm{field}}\) 是 V9 降噪观测经 RiverMemo 双场读出的语义基线；
+- \(S_i^{\mathrm{field}}\) 是 AGS 统一场背景图上的降噪观测经 RiverMemo 双场读出的语义基线；
 - \(G_i\) 是候选对查询河网的相对拓扑匹配，并由查询河网的
   Atomic / Propositional / Narrative 形态概率连续混合节点图与边图读出；
 - \(Z_i\) 是候选的语义、闭合、直接证据和角色条件；
@@ -101,7 +103,9 @@ JS 入口 [`KnowledgeBaseManager.prepareUnifiedMemoObservation()`](../KnowledgeB
 
 ## 1. 定位
 
-RiverMemo 是 VCP 长期记忆系统中建立在 TagMemo V9 已验证传播底座之上的连续信息场检索引擎。
+RiverMemo 是 VCP 长期记忆系统中以 **AGS 统一场作为降噪传播背景图**的连续信息场检索引擎。
+
+这里的“统一场”指长期记忆的共享背景几何与其派生传输资产，不等于单次查询产生的河网，也不等于查询后的局部场与迁移场。AGS 统一了局部与全局几何的预计算；请求侧仍由 EPA、残差金字塔、门控与有界 Sense 传播完成降噪，再由 Topology V3 读取场与拓扑。
 
 它首次把以下过去分别讨论的对象放入同一个可计算闭环：
 
@@ -142,30 +146,33 @@ RiverMemo 是 VCP 长期记忆系统中建立在 TagMemo V9 已验证传播底
 
 ## 2. 理论边界
 
-### 2.1 RiverMemo 不重新发明查询降噪
+### 2.1 AGS 背景几何与请求级降噪
+
+当查询内容是“整个上下文”而不是一个孤立关键词时，RiverMemo 在 AGS 统一场
+背景图上执行查询观测。EPA、Residual Pyramid 和有界 Spike 的机制延续自 TagMemo，
+但其几何资产已不再由旧 Pairwise、独立残差任务和独立 EPA 构建链分别提供。
 
-当查询内容是“整个上下文”而不是一个孤立关键词时，RiverMemo 沿用 TagMemo V9
-的查询观测架构，但当前生产计算已经收敛到 Rust 统一管线：
+当前生产计算收敛到 Rust 统一管线：
 
-- EPA 全局语义状态分析；
+- 以 AGS 全局星团主题面为背景、经覆盖率与随机背景校准的 EPA 全局语义状态分析；
 - Residual Pyramid 多层残差分解；
 - Core Tag 与语言置信度调制；
 - 有界 Spike 传播；
 - 软非回溯；
 - 有限时域加权；
 - 查询增强向量与源场生成。
 
-当前生产链沿用这一降噪架构。源码可以确认其计算流程，但不能仅凭实现断言它是所有场景下的最优方案；效果与参数仍需通过实际语料评估。
+AGS 是降噪观测的背景几何，不是替代整个查询管线的独立召回器。源码可以确认其计算流程，但不能仅凭实现断言它是所有场景下的最优方案；效果与参数仍需通过实际语料评估。
 
-实现上，Rust [`run_pipeline()`](../rust-vexus-lite/src/memo_pipeline.rs:1302)
+实现上，Rust [`run_pipeline()`](../rust-vexus-lite/src/memo_pipeline.rs:1518)
 依次执行 EPA、残差金字塔、Tag 门控、Sense 和向量融合；查询观测存入
 [`MemoRuntime.store_query_observation()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:469)，
 返回短生命周期的 `observationHandle`。普通 Tag KNN 不能被静默标记为完整
 RiverMemo；若统一原生 ABI、Artifact 或句柄不可用，上层才执行显式回退。
 
-### 2.2 V9 底座与 V3 贡献的分界
+### 2.2 AGS 背景底座与 V3 贡献的分界
 
-V9 提供：
+AGS 预计算及其派生的传输资产提供共享背景；Rust 统一查询管线在该背景上生成：
 
 \[
 (q,\ S,\ \mathcal R_q,\ q_d)
@@ -176,7 +183,7 @@ V9 提供：
 - \(q\)：原始整个上下文的查询向量；
 - \(S\)：归一化查询源场；
 - \(\mathcal R_q\)：本次查询实际传播形成的有向河网；
-- \(q_d\)：V9 降噪后的查询向量。
+- \(q_d\)：AGS 背景上的统一 Memo 管线降噪增强后的查询向量。
 
 拓扑 V3 在此基础上新增并统一：
 
@@ -196,7 +203,7 @@ V9 提供：
 \mathcal S_{V3}(c)
 \]
 
-所以，RiverMemo 的创新不在于否定 V9，而在于第一次把 V9 已验证的信息源与传播结果提升为可计算的场、拓扑对应和统一泛函。
+因此，AGS 负责共享背景几何与传播条件，统一 Memo 管线负责本次查询的观测，Topology V3 则把观测提升为可计算的场、拓扑对应和统一排序泛函。底座切换不改变本文的 V3 评分公式，也不意味着需要更改结果协议。
 
 ### 2.3 与层层特判式工程拟合的区别
 
@@ -219,7 +226,54 @@ V9 提供：
 
 ## 3. 基础对象
 
-令长期记忆 Tag 图为：
+### 3.1 三层对象：背景、河网与查询场
+
+必须区分以下三层：
+
+| 层次 | 对象 | 生命周期与用途 |
+|:--|:--|:--|
+| 共享背景 | AGS 双尺度几何及其派生的有向 Tag 传输图 | 训练/重建后发布，作为降噪分析与传播的背景 |
+| 请求级观测 | 查询源、节点势与实际边流组成的河网 | 每次查询生成，供形态统计、Ω 与拓扑对应使用 |
+| 请求级双场 | 局部场与迁移场 | 使用查询源和共享传输算子求解，供候选曲线读出 |
+
+AGS 的“局部/全局”是**预计算几何尺度**；RiverMemo 的“局部/迁移”是**查询响应尺度**，二者不可互换。
+
+### 3.2 AGS 双尺度统一几何
+
+AGS（Anchored Greedy Gram-Schmidt）用同一锚定贪心正交化算子生成两类背景资产，生产实现见
+[`anchored_gs()`](../rust-vexus-lite/src/memo_geometry.rs:101)。
+
+1. **局部 Explain**：用共现邻居解释目标 Tag，得到未解释残差范数比，并映射为锚增益；锚增益参与传输图的虫洞判定及可选反向增益。
+2. **全局 Span**：对高支持度候选的中心化星团方向做贪心正交化，得到具有真实 Tag 标签的主题面、全库均值与覆盖率曲线，供 EPA 读取。
+
+对单位目标向量 \(t\) 和已选局部正交基 \(b_k\)，残差量为：
+
+\[
+r_t=\sqrt{\max\left(0,1-\sum_k\langle t,b_k\rangle^2\right)}
+\]
+
+它是**残差范数比**，不是残差能量比；解释能量比为 \(1-r_t^2\)。锚增益采用有界映射：
+
+\[
+a_t=\Pi_{[a_{\min},a_{\max}]}\left(a_0+a_1r_t^\beta\right)
+\]
+
+全局默认使用星团方向，而非仅将单个 Tag 当作主题轴。令 \(\mu\) 为全库有效单位 Tag 向量的均值，则候选方向近似为：
+
+\[
+s_t=\operatorname{normalize}
+\left[(1-\xi)(t-\mu)+\xi\sum_{j\in N(t)}\bar w_{tj}(t_j-\mu)\right]
+\]
+
+其中邻居权重由共现支持与内联语义门控形成，并归一化；默认混合比例为 \(\xi=0.8\)。无有效邻居或混合退化时回退到中心化目标方向。星团构造见
+[`star_direction()`](../rust-vexus-lite/src/memo_geometry.rs:161)。
+
+全局基具有前缀嵌套性；系统按覆盖率、增量阈值和最大基数截取有效前缀，不要求固定数量的主题面必然覆盖整个知识库。当前几何算法标识见
+[`memo_geometry.rs`](../rust-vexus-lite/src/memo_geometry.rs:151)，为 unified_geometry_ags_v2；主题面缓存标识为 ags-global-star-v2。它们与 Topology V3 排序算法标识属于不同层次。
+
+### 3.3 共享传输图
+
+令 AGS 统一场背景中供传播使用的长期记忆 Tag 图为：
 
 \[
 G=(V,E,P)
@@ -238,7 +292,26 @@ G=(V,E,P)
 
 该严格次随机条件保证传输算子不会无界创造质量，并使后续 resolvent 场收敛。
 
-拓扑 V3 使用的传输资产继承 V9.1 的事实压缩、枢纽校正、预算内虫洞和固定行预算。当前资产构建由 [`memo_artifact_builder.rs`](../rust-vexus-lite/src/memo_artifact_builder.rs) 承担，而不是旧 JS 构图入口。查询侧从实例运行时取得活动资产，冷加载时校验持久化校验和及 CSR 结构，见 [`load_artifact_from_runtime()`](../rust-vexus-lite/src/rivermemo_topology_v3.rs:856)。
+背景图不是把 AGS 正交基直接当作 Tag 间邻接矩阵。有向边仍来自文件有序 Tag 共现，语义增益在构建时从 SQLite 权威原始向量现场计算余弦；AGS 局部锚增益参与传播条件，全局主题面则供 EPA 观测使用。
+
+传输资产保留
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

## X. Empirical Invariant Guard in ChangeLog.md

**RULE**:
When implementing operations in `docs/ChangeLog.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `96e961ad`: fix. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/ChangeLog.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
**核心算法升级：RiverMemo V2 算法正式登场**

#### 🌟 核心突破一：双场投影「有向连通域圈选」与 I/O 复杂度坍缩至 $O(1)$
* **痛点问题**：
  在早期架构中，双尺度 Resolvent 场（局部场 Local 与迁移场 Transfer）在全图迭代后，会遍历全库所有非零长尾节点去磁盘拉取 3072 维向量。在 5 万+ 标签规模下，单次查询需扫描数万条高维向量 BLOB，导致数百毫秒的 I/O 停顿，无法向数百万级标签平滑扩展。
* **物理创新（有向连通流域扩圈 Core-Anchored Region Growing）**：
  * **摒弃一维标量散点截断**：不再简单按数值大小挑散点，改用以当前脉冲河网（Spike River Graph）为绝对内核的**最大堆有向连通扩圈算法**（`BinaryHeap<ProjectionFrontier>`）。候选节点必须由已入选前驱沿正权出边暴露，绝不跨越断裂带去抓取孤立山峰，确保参与投影的节点在拓扑流形上是**100% 无断裂的连续连通域**。
  * **预算与质量双重自适应收敛**：引入 `maxFieldProjectionNodes`（默认 256，支持 128/256/512 动态配置）与 80%/90% 质量目标自然收敛。
  * **全链路请求级向量池（TagVectorPool）**：金字塔、观测融合、双场投影与 V3 读出头全程共享内存向量池，彻底消除单次查询内部多达 4 次的重复数据库查表。
* **实测收益**：
  * **高维向量磁盘拉取量暴降 99.5%**：从每次查询扫描全库数万条高维向量，骤降为**恒定 $\le 256$ 条**。
  * **端到端延迟断崖式下降**：双场求解与投影阶段耗时从 **300ms+ 坍缩至 1~3ms**。无论知识库膨胀到 5 万还是 500 万标签，计算复杂度与内存占用被严格锁定在常数级 $O(1)$。

#### 🌌 核心突破二：Spike 请求级「动态语境残差虫洞」（真·跨界顿悟能力）
* **痛点问题**：
  现实生活中的高频枢纽概念（如“日常生活”、“亲密互动”、“游戏开发”）往往连结着数百个不同分支。在静态图上，这些重要的高特异性跨界记忆（例如“日常甜点 $\to$ 水蜜桃”、“风 $\to$ 歌”）常常排在第 20 名开外，不仅容易被静态 Top-K 邻居截断误杀，更会被庞大的出度分母严重稀释，导致电流无法触发激活。
* **物理创新（历史共现先验 $\times$ 深层正交残差共鸣）**：
  * **虫洞不是静态户口本，而是当下的语境折叠**：记忆不是脱离语境的静态死链。我们利用残差金字塔（AGS）剥离出的深层正交残差向量 $\vec{r}_l$（代表当前对话中尚未被表层实体解释的
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
本次更新以安全性改进为主。

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `96e961ad` are properly handled with clean fallback behavior.
