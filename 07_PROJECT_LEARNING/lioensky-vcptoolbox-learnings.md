> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source**: github ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Source Version**: `eff29b1f`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T15:37:37.903Z  
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
> **Harvest Timestamp**: 2026-11-05T15:37:37.613Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2429 stars

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
- **Issue #576** (2026-11-05): **fix(vcpLoop): 收敛思考块剥离边界并隔离代码域与工具载荷自指误伤**
  *Symptoms*: ### PR 标题 fix(vcpLoop): 收敛思考块剥离边界并隔离代码域与工具载荷自指误伤  ### 动机与背景 原先 `ToolCallParser.stripReasoningBlocks` 采用全文盲扫正则 `/<\s*(\/?)\s*(think(?:ing)?)\b[^>]*>/gi` 剥离思考块，并在 `depth > 0` 时一刀切丢弃未闭合开始标签之后的全部内容。这在实际使用中存在以下边界误伤与漏拦隐患： 1. **跨行贪婪拼合误伤**：`[^>]*>` 允许跨越换行符，当正文中出现残缺的 `<think`（无右尖括号）且后文存在 `>`（如数学不等号或 `<<<[TOOL_REQUEST]>>>` 起始标记）时，会被跨行拼合为伪造的开始标签，导致后续所有工具调用被静默吞噬； 2. **缺乏代码域与工具载荷保护**：当模型在 Markdown 代码围栏（` ``` ` / `~~~`）、行内反引号（`` `...` ``）、工具请求参数（`「始」...「末」` / `「始ESCAPE」...「末ESCAPE」`）或工具结果块内讨论/演示单侧 `<think>` 时，会触发 `depth > 0` 截断，导致当前工具块被腰斩或文末合法工具全部丢失； 3. **正文行内自指提及误伤**：当正文句子中间裸写单侧 `<think>`（如“当包含`<think>`时…”）且无配对闭合标签时，会误将后续全文当作未闭合思考流丢弃； 4. **无头思考泄漏（Headless Leak）漏拦**：当上游网关丢失开头的 `<think>`，模型直接输出思考草稿（含演练的伪工具）并以独立行 `</think>` 闭合时，原先因 `depth === 0` 无法剥离闭合标签前的思考草稿。  ### 架构与解决方案 在保持 `ToolCallParser.stripReasoningBlocks(content)` 与 `ToolCallParser.parse(content)` 对外签名完全不变的前提下，引入四重正交防线： 1. **单行无尖括号词法定界**：将标签匹配收束为单行且禁止吞入 `<` 与 `\r\n`，扩展支持 `think` / `thinking` / `thought` / `antThinking`，根除 `<think` 跨行拼合与 `<think_custom>` 前缀误判； 2. **权威字面量保护域（`_collectReasoningLiteralRanges`）**：在 `depth === 0` 时优先识别并跳过嵌套感知的工具结果域、Markdown 围栏代码块（含 0–3 空格缩进）与同段落行内反引号（含颜文字反引号豁免）；一旦进入真实思考块（`depth > 0`），内部伪代码块仍由外层思考深度统辖并 100% 剥离； 3. **顶层工具请求原子互锁与 VCP 元思考链剥离**：在代码域外且处于 `depth === 0` 已合法开启的完整 `TOOL_REQUEST` 块内部参数免于思考标签扫描；同步剥离顶层独占行的 `[--- VCP元思考链 ---]` 明文块； 4. **句中自指预检与无头思考回溯**：    - 对于行首/块首开启的未闭合思考标签，严格保留丢弃尾部的安全熔断；对于嵌在句子中间（同行左侧存在非空白字符）且后续非保护域无配对闭合标签的孤立开标签，判定为正文自指字面量原地放行；    - 当在首个思考块闭合前遇到位于行首或行尾的孤立闭合标签时，识别为无头思考泄漏并回溯清空其前缀草稿。  

- **Issue #575** (2026-11-05): **Potential security issue — requesting a private contact**
  *Symptoms*: Hello — I believe I have found a serious security issue in VCPToolBox and would prefer to report it privately rather than describe it in a public issue.  Could you either enable GitHub Private Vulnerability Reporting (Settings → Security → "Private vulnerability reporting") or share a security contact email? I will send full technical details and a suggested fix through whichever private channel you prefer.  Thank you.
  **Post-Mortem & Fix Analysis**:
  > Hi @shaikn6,  Thank you very much for following responsible disclosure practices!  We have enabled **GitHub Private Vulnerability Reporting** for this repository. You can now submit your report and the technical details directly via: https://github.com/lioensky/VCPToolBox/security/advisories/new  Looking forward to reviewing your advisory and collaborating on the fix. Thanks again! 
  > fix

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

### Incident Patch 1: `eff29b1f` (2026-11-05)
**Commit Message**: 安全fix2

**File**: `Plugin/MagiAgent/MagiAgent.js` (modified, +11/-2)
```diff
@@ -247,7 +247,11 @@ async function sendCompletionCallback(meeting) {
         }
         return;
     }
-    const callbackUrl = `${serverConfig.CALLBACK_BASE_URL}/MagiAgent/${meeting.id}`;
+    if (!serverConfig.Key) {
+        console.error('[MagiAgent] Server Key not configured; completion callback was not sent.');
+        return;
+    }
+    const callbackUrl = `${serverConfig.CALLBACK_BASE_URL.replace(/\/+$/, '')}/MagiAgent/${encodeURIComponent(meeting.id)}`;
     try {
         const resultPayload = await formatMeetingResult(meeting);
         const callbackPayload = {
@@ -259,7 +263,12 @@ async function sendCompletionCallback(meeting) {
         };
         console.log(`[MagiAgent] Sending completion callback for meeting ${meeting.id} to ${callbackUrl}`);
         await axios.post(callbackUrl, callbackPayload, {
-            headers: { 'Content-Type': 'application/json' }
+            headers: {
+                'Content-Type': 'application/json',
+                'Authorization': `Bearer ${serverConfig.Key}`
+            },
+            timeout: 15000,
+            maxRedirects: 0
         });
         console.log(`[MagiAgent] Callback for meeting ${meeting.id} sent successfully.`);
     } catch (error) {
```

**File**: `Plugin/VideoGenerator/video_handler.py` (modified, +18/-2)
```diff
@@ -210,6 +210,22 @@ def download_video(video_url, request_id):
         log_event("error", f"[{request_id}] Failed to download or save video.", {"error": str(e)})
         return None
 
+def send_completion_callback(callback_url, payload, timeout):
+    # Key authenticates the VCP server; SILICONFLOW_API_KEY authenticates the upstream.
+    key = os.getenv("Key")
+    if not key:
+        raise ValueError("Server Key not configured; callback was not sent")
+    response = requests.post(
+        callback_url, json=payload,
+        headers={"Authorization": f"Bearer {key}"},
+        timeout=timeout, allow_redirects=False
+    )
+    response.raise_for_status()
+    if 300 <= response.status_code < 400:
+        raise ValueError("Callback redirect rejected")
+    return response
+
+
 # --- 后台轮询与回调 ---
 def poll_and_callback(api_key, request_id, callback_base_url, plugin_name, debug_mode):
     log_event("info", f"[{request_id}] Entering poll_and_callback function.", {
@@ -263,7 +279,7 @@ def poll_and_callback(api_key, request_id, callback_base_url, plugin_name, debug
                 try:
                     callback_payload = ws_notification_data 
 
-                    callback_response = requests.post(callback_url, json=callback_payload, timeout=30)
+                    callback_response = send_completion_callback(callback_url, callback_payload, timeout=30)
                     callback_response.raise_for_status()
                     log_event("success", f"[{request_id}] Callback to {callback_url} successful with simplified data.", {"status_code": callback_response.status_code})
                 except requests.exceptions.RequestException as cb_e:
@@ -298,7 +314,7 @@ def poll_and_callback(api_key, request_id, callback_base_url, plugin_name, debug
                     "message": f"视频 (ID: {request_id}) 轮询超时。"
                 }
                 callback_url = f"{callback_base_url}/{plugin_name}/{request_id}"
-                requests.post(callback_url, json=timeout_notification_data, timeout=10)
+                send_completion_callback(callback_url, timeout_notification_data, timeout=10)
                 log_event("info", f"[{request_id}] Sent PollingTimeout callback to {callback_url} with simplified data.")
             except Exception as cb_timeout_e:
                 log_event("error", f"[{request_id}] Failed to send PollingTimeout callback.", {"error": str(cb_timeout_e)})
```

**File**: `tests/magiCallbackAuth.test.js` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+'use strict';
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const vm = require('node:vm');
+const http = require('node:http');
+const axios = require('axios');
+const { spawnSync } = require('node:child_process');
+
+test('MagiAgent actual callback function sends server Key for success/failure, never API_Key', async t => {
+    const source = fs.readFileSync(path.resolve(__dirname, '../Plugin/MagiAgent/MagiAgent.js'), 'utf8');
+    const begin = source.indexOf('async function sendCompletionCallback(meeting)');
+    const end = source.indexOf('// --- AI 模型调用 ---', begin);
+    assert.ok(begin >= 0 && end > begin);
+    const received = [];
+    const server = http.createServer((req, res) => {
+        let body = '';
+        req.on('data', chunk => { body += chunk; });
+        req.on('end', () => {
+            received.push({ auth: req.headers.authorization, url: req.url, body: JSON.parse(body) });
+            res.end('{}');
+        });
+    });
+    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
+    t.after(() => new Promise(resolve => server.close(resolve)));
+    const config = {
+        CALLBACK_BASE_URL: `http://127.0.0.1:${server.address().port}/plugin-callback/`,
+        Key: 'server-test-key', API_Key: 'upstream-not-for-callback'
+    };
+    const context = vm.createContext({
+        serverConfig: config, axios,
+        console: { log() {}, error() {} },
+        formatMeetingResult: async () => ({ result: 'meeting result' }),
+        sendVcpLog: null
+    });
+    vm.runInContext(source.slice(begin, end), context);
+    const send = context.sendCompletionCallback;
+    await send({ id: 'meeting-123', status: 'completed' });
+    await send({ id: 'meeting-456', status: 'failed', error: 'test failure' });
+    assert.equal(received.length, 2);
+    assert.equal(received[0].auth, 'Bearer server-test-key');
+    assert.equal(received[1].auth, 'Bearer server-test-key');
+    assert.equal(received[0].url, '/plugin-callback/MagiAgent/meeting-123');
+    assert.equal(received[0].body.status, 'Succeed');
+    assert.equal(received[1].body.status, 'Failed');
+    assert.equal(received[1].body.reason, 'test failure');
+    delete config.Key;
+    await send({ id: 'missing-key', status: 'completed' });
+    assert.equal(received.length, 2);
+});
+
+test('MagiAgent callback does not follow redirects with server credentials', async t => {
+    const source = fs.readFileSync(path.resolve(__dirname, '../Plugin/MagiAgent/MagiAgent.js'), 'utf8');
+    const begin = source.indexOf('async function sendCompletionCallback(meeting)');
+    const end = source.indexOf('// --- AI 模型调用 ---', begin);
+    let redirected = 0;
+    const server = http.createServer((req, res) => {
+        req.resume();
+        if (req.url === '/leak') { redirected++; res.end('{}'); }
+        else { res.writeHead(302, { Location: '/leak' }); res.end(); }
+    });
+    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
+    t.after(() => new Promise(resolve => server.close(resolve)));
+    const context = vm.createContext({
+        serverConfig: { CALLBACK_BASE_URL: `http://127.0.0.1:${server.address().port}/plugin-callback`, Key: 'test' },
+        axios, console: { log() {}, error() {} }, sendVcpLog: null,
+        formatMeetingResult: async () => ({ result: 'ok' })
+    });
+    vm.runInContext(source.slice(begin, end), context);
+    await context.sendCompletionCallback({ id: 'redirect', status: 'completed' });
+    assert.equal(redirected, 0);
+});
+
+test('Python video callbacks use server Key on both branches and reject redirects/errors', () => {
+    // Extract and execute the production helper via AST: no image/API dependencies or billable requests.
+    const script = String.raw`
+import ast, os, types
+from unittest.mock import patch
+source = open("Plugin/VideoGenerator/video_handler.py", encoding="utf-8-sig").read()
+tree = ast.parse(source)
+fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "send_completion_callback")
+calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "send_completion_callback"]
+assert len(calls) == 2
+seen = []
+class Response:
+    status_code = 200
+    def raise_for_status(self):
+        if self.status_code >= 400: raise RuntimeError("HTTP failure")
+response = Response()
+def post(url, **kwargs):
+    seen.append((url, kwargs))
+    return response
+scope = {"os": os, "requests": types.SimpleNamespace(post=post)}
+exec(compile(ast.Module(body=[fn], type_ignores=[]), "<production-callback>", "exec"), scope)
+send = scope["send_completion_callback"]
+with patch.dict(os.environ, {"Key": "server-key", "SILICONFLOW_API_KEY": "upstream-key"}, clear=True):
+    send("http://callback", {"status": "Succeed"}, 30)
+    send("http://callback", {"status":
```

---

### Incident Patch 2: `78e989e2` (2026-11-05)
**Commit Message**: Merge pull request #576 from infinite-vector/fix/reasoning-strip-boundary-and-self-ref

fix(vcpLoop): 收敛思考块剥离边界并隔离代码域与工具载荷自指误伤

**File**: `modules/vcpLoop/toolCallParser.js` (modified, +382/-24)
```diff
@@ -3,64 +3,422 @@ const toolMarkerFuzzyMatcher = require('./toolMarkerFuzzyMatcher');
 
 class ToolCallParser {
   static MARKERS = {
-    START: '<<<[TOOL_REQUEST]>>>',
-    END: '<<<[END_TOOL_REQUEST]>>>'
+    START: '<<<' + '[TOOL_REQUEST]>>>',
+    END: '<<<' + '[END_TOOL_REQUEST]>>>'
   };
 
   static ESCAPE_MARKERS = {
-    START: '「始ESCAPE」',
-    END: '「末ESCAPE」'
+    START: '「始' + 'ESCAPE」',
+    END: '「末' + 'ESCAPE」'
   };
 
   static ESCAPED_LITERAL_MAP = {
-    '<<<[TOOL_REQUEST_ESCAPE]>>>': '<<<[TOOL_REQUEST]>>>',
-    '<<<[END_TOOL_REQUEST_ESCAPE]>>>': '<<<[END_TOOL_REQUEST]>>>',
-    '「始ESCAPE」': '「始」',
-    '「末ESCAPE」': '「末」'
+    ['<<<[TOOL_REQUEST_' + 'ESCAPE]>>>']: '<<<' + '[TOOL_REQUEST]>>>',
+    ['<<<[END_TOOL_REQUEST_' + 'ESCAPE]>>>']: '<<<' + '[END_TOOL_REQUEST]>>>',
+    ['「始' + 'ESCAPE」']: '「始」',
+    ['「末' + 'ESCAPE」']: '「末」'
   };
 
   /**
-   * 从可见正文中剥离模型思考块。
+   * 收集正文中不受思考标签状态机影响的字面量保护区间：
+   * 1. 权威工具结果域：VCP调用结果信息汇总 ... VCP调用结果结束（嵌套感知）
+   * 2. Markdown 围栏代码块：``` ... ``` 与 ~~~ ... ~~~（含 0-3 空格缩进与流尾未闭合围栏）
+   * 3. Markdown 行内代码跨度：` ... `（限制在同段落内，且豁免颜文字反引号）
    *
-   * 支持：
-   * - <think>...</think> 与 <thinking>...</thinking>
-   * - 大小写、标签空白和属性变体
-   * - 同类或混合标签嵌套
-   * - 未闭合开始标签：保守丢弃该标签之后的全部内容
+   * 注意：已进入真实思考块（depth > 0）后，思考块内部的伪代码块由外层思考状态优先统辖，
+   * 调用方仅在 depth === 0 时查询本保护区间，从而确保思考块内的伪代码块+伪工具 100% 被剥离。
    *
-   * 未配对的结束标签只移除标签本身，不会吞掉其后的可见正文。
+   * @param {string} content
+   * @returns {Array<{start: number, end: number, kind: string}>}
+   */
+  static _collectReasoningLiteralRanges(content) {
+    if (!content || typeof content !== 'string') return [];
+
+    const ranges = [];
+    const len = content.length;
+    const TOOL_RESULT_OPEN = '[' + '[VCP调用结果信息汇总:';
+    const TOOL_RESULT_CLOSE = 'VCP调用结果结束]' + ']';
+    const EMOTICONS = ['(`・ω・´)ゞ', '(・`ω´・)', '(`・ω・´)', '(`･ω･´)'];
+
+    const isEmoticonBacktick = (idx) => EMOTICONS.some(emo => {
+      const offset = emo.indexOf('`');
+      return idx >= offset && content.startsWith(emo, idx - offset);
+    });
+
+    const countRun = (idx, ch) => {
+      let c = idx;
+      while (c < len && content[c] === ch) c += 1;
+      return c - idx;
+    };
+
+    const findLineEnd = (idx) => {
+      const nl = content.indexOf('\n', idx);
+      return nl === -1 ? len : nl;
+    };
+
+    const lineStartAt = (idx) => (idx === 0 ? 0 : content.lastIndexOf('\n', idx - 1) + 1);
+
+    let cursor = 0;
+    while (cursor < len) {
+      // 1. 优先识别工具结果数据域（嵌套感知）
+      if (content.startsWith(TOOL_RESULT_OPEN, cursor)) {
+        let depth = 1;
+        let scan = cursor + TOOL_RESULT_OPEN.length;
+        let nextOpen = content.indexOf(TOOL_RESULT_OPEN, scan);
+        let regionEnd = len;
+
+        while (scan <= len) {
+          const nextClose = content.indexOf(TOOL_RESULT_CLOSE, scan);
+          if (nextClose === -1) {
+            regionEnd = len;
+            break;
+          }
+          if (nextOpen !== -1 && nextOpen < nextClose) {
+            depth += 1;
+            scan = nextOpen + TOOL_RESULT_OPEN.length;
+            nextOpen = content.indexOf(TOOL_RESULT_OPEN, scan);
+            continue;
+          }
+          depth -= 1;
+          scan = nextClose + TOOL_RESULT_CLOSE.length;
+          if (depth === 0) {
+            regionEnd = scan;
+            break;
+          }
+          if (nextOpen !== -1 && nextOpen < scan) {
+            nextOpen = content.indexOf(TOOL_RESULT_OPEN, scan);
+          }
+        }
+
+        ranges.push({ start: cursor, end: regionEnd, kind: 'tool-result' });
+        cursor = regionEnd;
+        continue;
+      }
+
+      const ch = content[cursor];
+
+      // 2. 识别 Markdown 围栏代码块（``` 或 ~~~，行首 0-3 空格缩进）
+      if (ch === '`' || ch === '~') {
+        const runLen = countRun(cursor, ch);
+        const lineStart = lineStartAt(cursor);
+        const prefix = content.slice(lineStart, cursor);
+        const lineEnd = findLineEnd(cursor + runLen);
+        const infoString = content.slice(cursor + runLen, lineEnd);
+
+        const isValidFenceOpen =
+          runLen >= 3 &&
+          /^[ \t]{0,3}$/.test(prefix) &&
+          (ch !== '`' || !infoString.includes('`'));
+
+        if (isValidFenceOpen) {
+          let scanLineStart = lineEnd < len ? lineEnd + 1 : len;
+          let fenceEnd = len;
+
+          while (scanLineStart <= len) {
+            const scanLineEnd = findLineEnd(scanLineStart);
+            let mStart = scanLineStart;
+            let indent = 0;
+            while (
+              mStart < scanLineEnd &&
+              indent < 3 &&
+              (content[mStart] === ' ' || content[mStart] === '\t')
+            ) {
+              mStart += 1;
+              indent += 1;
+            }
+            if (content[mStart] === ch) {
+              const closeLen = countRun(mStart, ch);
+              const trailing = content.slice(mStart + closeLen, scanLineEnd);
+              if (closeLen >= runLen && /^[ \t]*\r?$/.test(trailing)) {
+                fenceE
```

**File**: `tests/reasoningAndSelfReference.test.js` (added, +401/-0)
```diff
@@ -0,0 +1,401 @@
+'use strict';
+
+/**
+ * 前后端思考标签（Reasoning Blocks）拦截与自指（Self-Reference）零误伤全维度严苛测试套件
+ *
+ * 覆盖维度（共 20 组对抗性用例）：
+ * - [外测度 · 防漏网 M1-M7]：
+ *   M1: 标准成对思考块拦截内部伪造工具调用
+ *   M2: 思考块内嵌伪造 Markdown 代码围栏与伪工具调用（外层思考状态优先剥离）
+ *   M3: 多层嵌套、混合标签（think/thinking/thought/antThinking）、大小写与带属性变体
+ *   M4: 潜空间无头思考泄漏（Headless Leak：开头无开标签，直接输出思考草稿+伪工具+独立行闭标签）
+ *   M5: 行首/缩进行首开启的流式未闭合思考截断（保守熔断丢弃尾部伪工具）
+ *   M6: VCP 元思考链明文块（闭合与未闭合）内部伪工具剥离
+ *   M7: 多段交替思考块与多枚真实并发工具穿插提取
+ * - [内测度 · 零误伤 M8-M16]：
+ *   M8: 残缺无右尖括号 `<think` 跨行面对 `>` 运算符与工具请求起始符（绝不跨行拼合）
+ *   M9: 正文句中裸写单侧未闭合开标签（如“当包含<think>时，如果只有<think>”），保留标签字面量并放行真工具
+ *   M10: 正文句中裸写单侧未闭合开标签 + 后文代码块中出现闭标签（预检器跳过代码域，不误配对）
+ *   M11: 正文句中裸写单侧闭标签（如“将</think>之间的工具屏蔽”），绝不误触发无头思考清空前文真工具
+ *   M12: Markdown 围栏代码块（``` 与 ~~~，含未闭合流尾围栏）内含独占行未闭合思考标签与伪工具
+ *   M13: Markdown 行内反引号（单反引号/双反引号）包裹单侧思考标签 + 颜文字反引号 (`・ω・´) 共存
+ *   M14: 顶层合法 TOOL_REQUEST 参数（普通「始」「末」与「始ESCAPE」「末ESCAPE」）内含独占行未闭合思考标签
+ *   M15: 权威工具结果域（VCP调用结果信息汇总，含嵌套结果块）内部包含未闭合思考标签与伪工具
+ *   M16: 近似标签名（如 `<think_custom>`、`<thinking_process>`）不误判为思考标签
+ * - [跨端协同 · 前端三剑客验证 M17-M20]：
+ *   M17: 前端 Flowlock 协议：代码块内含独占行未闭合思考标签，文末 [[Flowlock::Complete]] 正常触发
+ *   M18: 前端 Flowlock 协议：真实独占行未闭合思考块内部的伪造 [[Flowlock::Fail]] 被正确遮蔽
+ *   M19: 前端 EmotionTagScanner：流式扫描行内 `<think>` 与句中提及 `<think>` 不卡死，正常吐出后续情绪标签
+ *   M20: 前端 EmotionTagScanner：真实行首 `<think>...</think>` 思考块内的伪情绪标签被正确屏蔽
+ */
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const { pathToFileURL } = require('node:url');
+
+const ToolCallParser = require('../modules/vcpLoop/toolCallParser');
+
+// 采用函数动态拼装所有协议与思考标签，彻底免疫任何静态扫描器自指干扰
+const openTag = (name = 'think', attr = '') => '<' + name + (attr ? ' ' + attr : '') + '>';
+const closeTag = (name = 'think') => '</' + name + '>';
+const halfOpenTag = (name = 'think') => '<' + name;
+
+const TOOL_START = '<<<' + '[TOOL_REQUEST]' + '>>>';
+const TOOL_END = '<<<' + '[END_TOOL_REQUEST]' + '>>>';
+const RESULT_OPEN = '[' + '[VCP调用结果信息汇总:';
+const RESULT_CLOSE = 'VCP调用结果结束]' + ']';
+const META_OPEN = '[--- ' + 'VCP元思考链: "coding" ---]';
+const META_CLOSE = '[--- ' + '元思考链结束 ---]';
+
+function buildToolBlock(toolName, extraFields = {}) {
+  const lines = [
+    TOOL_START,
+    'maid:「始」程宸Cod「末」,',
+    `tool_name:「始」${toolName}「末」`
+  ];
+  for (const [k, v] of Object.entries(extraFields)) {
+    const isEsc = v && typeof v === 'object' && v.escape;
+    const rawVal = isEsc ? v.value : v;
+    const sMark = isEsc ? '「始ESCAPE」' : '「始」';
+    const eMark = isEsc ? '「末ESCAPE」' : '「末」';
+    lines[lines.length - 1] += ',';
+    lines.push(`${k}:${sMark}${rawVal}${eMark}`);
+  }
+  lines.push(TOOL_END);
+  return lines.join('\n');
+}
+
+// ============================================================================
+// 一、外测度测试（防漏拦：确保一切形态的思考过程与潜空间漏出 100% 被剥离）
+// ============================================================================
+
+test('M1 [外测度] 标准成对思考块内部的伪工具调用被完全剥离', () => {
+  const input = [
+    openTag('think'),
+    '先思考一下要不要调工具：',
+    buildToolBlock('HallucinatedToolInThink'),
+    closeTag('think'),
+    '思考完毕，开始正式调用：',
+    buildToolBlock('RealToolAfterThink')
+  ].join('\n');
+
+  const calls = ToolCallParser.parse(input);
+  assert.equal(calls.length, 1);
+  assert.equal(calls[0].name, 'RealToolAfterThink');
+});
+
+test('M2 [外测度] 真实思考块内部夹带伪代码块与伪工具时，由外层思考深度统辖并 100% 剥离', () => {
+  const input = [
+    openTag('thinking'),
+    '我在思考里写一段代码块草稿：',
+    '```javascript',
+    buildToolBlock('FakeToolInsideThoughtCodeFence'),
+    '```',
+    buildToolBlock('FakeToolDirectInThought'),
+    closeTag('thinking'),
+    buildToolBlock('VerifiedRealTool')
+  ].join('\n');
+
+  const calls = ToolCallParser.parse(input);
+  assert.equal(calls.length, 1);
+  assert.equal(calls[0].name, 'VerifiedRealTool');
+});
+
+test('M3 [外测度] 多层混合嵌套、大小写、空白与带属性思考标签（think/thinking/thought/antThinking）', () => {
+  const input = [
+    openTag('THINKING', 'mode="deep" step="1"'),
+    '外层思考',
+    openTag('thought'),
+    buildToolBlock('NestedFake1'),
+    openTag('antThinking', 'id="claude"'),
+    buildToolBlock('NestedFake2'),
+    closeTag('antThinking'),
+    closeTag('thought'),
+    buildToolBlock('OuterFake3'),
+    closeTag('THINKING'),
+    '可见正文',
+    buildToolBlock('FinalRealTool')
+  ].join('\n');
+
+  const calls = ToolCallParser.parse(input);
+  assert.equal(calls.length, 1);
+  assert.equal(calls[0].name, 'FinalRealTool');
+});
+
+test('M4 [外测度] 潜空间无头思考泄漏（Headless Leak）：开头的 <think> 丢失、直接裸出思考草稿与独立行 </think>', () => {
+  const input = [
+    '用户让我排查问题，我先在心里演练一下调用：',
+    buildToolBlock('LeakedDraftTool1'),
+    '不对，参数写错了，再演练一次：',
+    buildToolBlock('LeakedDraftTool2'),
+    closeTag('think'),
+    '好的，现在我正式向用户发起真实工具调用：',
+    buildToolBlock('AuthenticToolAfterHeadless')
+  ].join('\n');
```

---

### Incident Patch 3: `9448dc78` (2026-11-05)
**Commit Message**: fix(vcpLoop): 收敛思考块剥离边界并隔离代码域与工具载荷自指误伤

**File**: `modules/vcpLoop/toolCallParser.js` (modified, +382/-24)
```diff
@@ -3,64 +3,422 @@ const toolMarkerFuzzyMatcher = require('./toolMarkerFuzzyMatcher');
 
 class ToolCallParser {
   static MARKERS = {
-    START: '<<<[TOOL_REQUEST]>>>',
-    END: '<<<[END_TOOL_REQUEST]>>>'
+    START: '<<<' + '[TOOL_REQUEST]>>>',
+    END: '<<<' + '[END_TOOL_REQUEST]>>>'
   };
 
   static ESCAPE_MARKERS = {
-    START: '「始ESCAPE」',
-    END: '「末ESCAPE」'
+    START: '「始' + 'ESCAPE」',
+    END: '「末' + 'ESCAPE」'
   };
 
   static ESCAPED_LITERAL_MAP = {
-    '<<<[TOOL_REQUEST_ESCAPE]>>>': '<<<[TOOL_REQUEST]>>>',
-    '<<<[END_TOOL_REQUEST_ESCAPE]>>>': '<<<[END_TOOL_REQUEST]>>>',
-    '「始ESCAPE」': '「始」',
-    '「末ESCAPE」': '「末」'
+    ['<<<[TOOL_REQUEST_' + 'ESCAPE]>>>']: '<<<' + '[TOOL_REQUEST]>>>',
+    ['<<<[END_TOOL_REQUEST_' + 'ESCAPE]>>>']: '<<<' + '[END_TOOL_REQUEST]>>>',
+    ['「始' + 'ESCAPE」']: '「始」',
+    ['「末' + 'ESCAPE」']: '「末」'
   };
 
   /**
-   * 从可见正文中剥离模型思考块。
+   * 收集正文中不受思考标签状态机影响的字面量保护区间：
+   * 1. 权威工具结果域：VCP调用结果信息汇总 ... VCP调用结果结束（嵌套感知）
+   * 2. Markdown 围栏代码块：``` ... ``` 与 ~~~ ... ~~~（含 0-3 空格缩进与流尾未闭合围栏）
+   * 3. Markdown 行内代码跨度：` ... `（限制在同段落内，且豁免颜文字反引号）
    *
-   * 支持：
-   * - <think>...</think> 与 <thinking>...</thinking>
-   * - 大小写、标签空白和属性变体
-   * - 同类或混合标签嵌套
-   * - 未闭合开始标签：保守丢弃该标签之后的全部内容
+   * 注意：已进入真实思考块（depth > 0）后，思考块内部的伪代码块由外层思考状态优先统辖，
+   * 调用方仅在 depth === 0 时查询本保护区间，从而确保思考块内的伪代码块+伪工具 100% 被剥离。
    *
-   * 未配对的结束标签只移除标签本身，不会吞掉其后的可见正文。
+   * @param {string} content
+   * @returns {Array<{start: number, end: number, kind: string}>}
+   */
+  static _collectReasoningLiteralRanges(content) {
+    if (!content || typeof content !== 'string') return [];
+
+    const ranges = [];
+    const len = content.length;
+    const TOOL_RESULT_OPEN = '[' + '[VCP调用结果信息汇总:';
+    const TOOL_RESULT_CLOSE = 'VCP调用结果结束]' + ']';
+    const EMOTICONS = ['(`・ω・´)ゞ', '(・`ω´・)', '(`・ω・´)', '(`･ω･´)'];
+
+    const isEmoticonBacktick = (idx) => EMOTICONS.some(emo => {
+      const offset = emo.indexOf('`');
+      return idx >= offset && content.startsWith(emo, idx - offset);
+    });
+
+    const countRun = (idx, ch) => {
+      let c = idx;
+      while (c < len && content[c] === ch) c += 1;
+      return c - idx;
+    };
+
+    const findLineEnd = (idx) => {
+      const nl = content.indexOf('\n', idx);
+      return nl === -1 ? len : nl;
+    };
+
+    const lineStartAt = (idx) => (idx === 0 ? 0 : content.lastIndexOf('\n', idx - 1) + 1);
+
+    let cursor = 0;
+    while (cursor < len) {
+      // 1. 优先识别工具结果数据域（嵌套感知）
+      if (content.startsWith(TOOL_RESULT_OPEN, cursor)) {
+        let depth = 1;
+        let scan = cursor + TOOL_RESULT_OPEN.length;
+        let nextOpen = content.indexOf(TOOL_RESULT_OPEN, scan);
+        let regionEnd = len;
+
+        while (scan <= len) {
+          const nextClose = content.indexOf(TOOL_RESULT_CLOSE, scan);
+          if (nextClose === -1) {
+            regionEnd = len;
+            break;
+          }
+          if (nextOpen !== -1 && nextOpen < nextClose) {
+            depth += 1;
+            scan = nextOpen + TOOL_RESULT_OPEN.length;
+            nextOpen = content.indexOf(TOOL_RESULT_OPEN, scan);
+            continue;
+          }
+          depth -= 1;
+          scan = nextClose + TOOL_RESULT_CLOSE.length;
+          if (depth === 0) {
+            regionEnd = scan;
+            break;
+          }
+          if (nextOpen !== -1 && nextOpen < scan) {
+            nextOpen = content.indexOf(TOOL_RESULT_OPEN, scan);
+          }
+        }
+
+        ranges.push({ start: cursor, end: regionEnd, kind: 'tool-result' });
+        cursor = regionEnd;
+        continue;
+      }
+
+      const ch = content[cursor];
+
+      // 2. 识别 Markdown 围栏代码块（``` 或 ~~~，行首 0-3 空格缩进）
+      if (ch === '`' || ch === '~') {
+        const runLen = countRun(cursor, ch);
+        const lineStart = lineStartAt(cursor);
+        const prefix = content.slice(lineStart, cursor);
+        const lineEnd = findLineEnd(cursor + runLen);
+        const infoString = content.slice(cursor + runLen, lineEnd);
+
+        const isValidFenceOpen =
+          runLen >= 3 &&
+          /^[ \t]{0,3}$/.test(prefix) &&
+          (ch !== '`' || !infoString.includes('`'));
+
+        if (isValidFenceOpen) {
+          let scanLineStart = lineEnd < len ? lineEnd + 1 : len;
+          let fenceEnd = len;
+
+          while (scanLineStart <= len) {
+            const scanLineEnd = findLineEnd(scanLineStart);
+            let mStart = scanLineStart;
+            let indent = 0;
+            while (
+              mStart < scanLineEnd &&
+              indent < 3 &&
+              (content[mStart] === ' ' || content[mStart] === '\t')
+            ) {
+              mStart += 1;
+              indent += 1;
+            }
+            if (content[mStart] === ch) {
+              const closeLen = countRun(mStart, ch);
+              const trailing = content.slice(mStart + closeLen, scanLineEnd);
+              if (closeLen >= runLen && /^[ \t]*\r?$/.test(trailing)) {
+                fenceE
```

**File**: `tests/reasoningAndSelfReference.test.js` (added, +401/-0)
```diff
@@ -0,0 +1,401 @@
+'use strict';
+
+/**
+ * 前后端思考标签（Reasoning Blocks）拦截与自指（Self-Reference）零误伤全维度严苛测试套件
+ *
+ * 覆盖维度（共 20 组对抗性用例）：
+ * - [外测度 · 防漏网 M1-M7]：
+ *   M1: 标准成对思考块拦截内部伪造工具调用
+ *   M2: 思考块内嵌伪造 Markdown 代码围栏与伪工具调用（外层思考状态优先剥离）
+ *   M3: 多层嵌套、混合标签（think/thinking/thought/antThinking）、大小写与带属性变体
+ *   M4: 潜空间无头思考泄漏（Headless Leak：开头无开标签，直接输出思考草稿+伪工具+独立行闭标签）
+ *   M5: 行首/缩进行首开启的流式未闭合思考截断（保守熔断丢弃尾部伪工具）
+ *   M6: VCP 元思考链明文块（闭合与未闭合）内部伪工具剥离
+ *   M7: 多段交替思考块与多枚真实并发工具穿插提取
+ * - [内测度 · 零误伤 M8-M16]：
+ *   M8: 残缺无右尖括号 `<think` 跨行面对 `>` 运算符与工具请求起始符（绝不跨行拼合）
+ *   M9: 正文句中裸写单侧未闭合开标签（如“当包含<think>时，如果只有<think>”），保留标签字面量并放行真工具
+ *   M10: 正文句中裸写单侧未闭合开标签 + 后文代码块中出现闭标签（预检器跳过代码域，不误配对）
+ *   M11: 正文句中裸写单侧闭标签（如“将</think>之间的工具屏蔽”），绝不误触发无头思考清空前文真工具
+ *   M12: Markdown 围栏代码块（``` 与 ~~~，含未闭合流尾围栏）内含独占行未闭合思考标签与伪工具
+ *   M13: Markdown 行内反引号（单反引号/双反引号）包裹单侧思考标签 + 颜文字反引号 (`・ω・´) 共存
+ *   M14: 顶层合法 TOOL_REQUEST 参数（普通「始」「末」与「始ESCAPE」「末ESCAPE」）内含独占行未闭合思考标签
+ *   M15: 权威工具结果域（VCP调用结果信息汇总，含嵌套结果块）内部包含未闭合思考标签与伪工具
+ *   M16: 近似标签名（如 `<think_custom>`、`<thinking_process>`）不误判为思考标签
+ * - [跨端协同 · 前端三剑客验证 M17-M20]：
+ *   M17: 前端 Flowlock 协议：代码块内含独占行未闭合思考标签，文末 [[Flowlock::Complete]] 正常触发
+ *   M18: 前端 Flowlock 协议：真实独占行未闭合思考块内部的伪造 [[Flowlock::Fail]] 被正确遮蔽
+ *   M19: 前端 EmotionTagScanner：流式扫描行内 `<think>` 与句中提及 `<think>` 不卡死，正常吐出后续情绪标签
+ *   M20: 前端 EmotionTagScanner：真实行首 `<think>...</think>` 思考块内的伪情绪标签被正确屏蔽
+ */
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const { pathToFileURL } = require('node:url');
+
+const ToolCallParser = require('../modules/vcpLoop/toolCallParser');
+
+// 采用函数动态拼装所有协议与思考标签，彻底免疫任何静态扫描器自指干扰
+const openTag = (name = 'think', attr = '') => '<' + name + (attr ? ' ' + attr : '') + '>';
+const closeTag = (name = 'think') => '</' + name + '>';
+const halfOpenTag = (name = 'think') => '<' + name;
+
+const TOOL_START = '<<<' + '[TOOL_REQUEST]' + '>>>';
+const TOOL_END = '<<<' + '[END_TOOL_REQUEST]' + '>>>';
+const RESULT_OPEN = '[' + '[VCP调用结果信息汇总:';
+const RESULT_CLOSE = 'VCP调用结果结束]' + ']';
+const META_OPEN = '[--- ' + 'VCP元思考链: "coding" ---]';
+const META_CLOSE = '[--- ' + '元思考链结束 ---]';
+
+function buildToolBlock(toolName, extraFields = {}) {
+  const lines = [
+    TOOL_START,
+    'maid:「始」程宸Cod「末」,',
+    `tool_name:「始」${toolName}「末」`
+  ];
+  for (const [k, v] of Object.entries(extraFields)) {
+    const isEsc = v && typeof v === 'object' && v.escape;
+    const rawVal = isEsc ? v.value : v;
+    const sMark = isEsc ? '「始ESCAPE」' : '「始」';
+    const eMark = isEsc ? '「末ESCAPE」' : '「末」';
+    lines[lines.length - 1] += ',';
+    lines.push(`${k}:${sMark}${rawVal}${eMark}`);
+  }
+  lines.push(TOOL_END);
+  return lines.join('\n');
+}
+
+// ============================================================================
+// 一、外测度测试（防漏拦：确保一切形态的思考过程与潜空间漏出 100% 被剥离）
+// ============================================================================
+
+test('M1 [外测度] 标准成对思考块内部的伪工具调用被完全剥离', () => {
+  const input = [
+    openTag('think'),
+    '先思考一下要不要调工具：',
+    buildToolBlock('HallucinatedToolInThink'),
+    closeTag('think'),
+    '思考完毕，开始正式调用：',
+    buildToolBlock('RealToolAfterThink')
+  ].join('\n');
+
+  const calls = ToolCallParser.parse(input);
+  assert.equal(calls.length, 1);
+  assert.equal(calls[0].name, 'RealToolAfterThink');
+});
+
+test('M2 [外测度] 真实思考块内部夹带伪代码块与伪工具时，由外层思考深度统辖并 100% 剥离', () => {
+  const input = [
+    openTag('thinking'),
+    '我在思考里写一段代码块草稿：',
+    '```javascript',
+    buildToolBlock('FakeToolInsideThoughtCodeFence'),
+    '```',
+    buildToolBlock('FakeToolDirectInThought'),
+    closeTag('thinking'),
+    buildToolBlock('VerifiedRealTool')
+  ].join('\n');
+
+  const calls = ToolCallParser.parse(input);
+  assert.equal(calls.length, 1);
+  assert.equal(calls[0].name, 'VerifiedRealTool');
+});
+
+test('M3 [外测度] 多层混合嵌套、大小写、空白与带属性思考标签（think/thinking/thought/antThinking）', () => {
+  const input = [
+    openTag('THINKING', 'mode="deep" step="1"'),
+    '外层思考',
+    openTag('thought'),
+    buildToolBlock('NestedFake1'),
+    openTag('antThinking', 'id="claude"'),
+    buildToolBlock('NestedFake2'),
+    closeTag('antThinking'),
+    closeTag('thought'),
+    buildToolBlock('OuterFake3'),
+    closeTag('THINKING'),
+    '可见正文',
+    buildToolBlock('FinalRealTool')
+  ].join('\n');
+
+  const calls = ToolCallParser.parse(input);
+  assert.equal(calls.length, 1);
+  assert.equal(calls[0].name, 'FinalRealTool');
+});
+
+test('M4 [外测度] 潜空间无头思考泄漏（Headless Leak）：开头的 <think> 丢失、直接裸出思考草稿与独立行 </think>', () => {
+  const input = [
+    '用户让我排查问题，我先在心里演练一下调用：',
+    buildToolBlock('LeakedDraftTool1'),
+    '不对，参数写错了，再演练一次：',
+    buildToolBlock('LeakedDraftTool2'),
+    closeTag('think'),
+    '好的，现在我正式向用户发起真实工具调用：',
+    buildToolBlock('AuthenticToolAfterHeadless')
+  ].join('\n');
```

#### Recent Merged Pull Requests:
- **PR #576** (2026-11-05): fix(vcpLoop): 收敛思考块剥离边界并隔离代码域与工具载荷自指误伤 (@infinite-vector)
- **PR #573** (closed): fix(security): 修复 TVS 变量编辑接口路径遍历漏洞 (@934842025)
- **PR #571** (2026-11-02): fix(rivermemo): separate wormhole RRF ranking from baseline scores (@Cimo-Yu)
- **PR #568** (2026-11-01): docs(desktop): 同步 VCP桌面知识至 DesktopRemote 1.5.0 并新增索引 (@infinite-vector)
- **PR #567** (2026-11-01): feat(tdb): 升级 TriviumDB 至 0.9.0 并接入原生只读内存与存储诊断接口 (@infinite-vector)
- **PR #565** (2026-10-30): fix(knowledge-base): 完善向量基线与存储元数据生命周期自净回收闭环 (@infinite-vector)

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

## X. Empirical Invariant Guard in MagiAgent.js

**RULE**:
When implementing operations in `Plugin/MagiAgent/MagiAgent.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `eff29b1f`: 安全fix2. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `Plugin/MagiAgent/MagiAgent.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
    if (!serverConfig.Key) {
        console.error('[MagiAgent] Server Key not configured; completion callback was not sent.');
        return;
    }
    const callbackUrl = `${serverConfig.CALLBACK_BASE_URL.replace(/\/+$/, '')}/MagiAgent/${encodeURIComponent(meeting.id)}`;
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serverConfig.Key}`
            },
            timeout: 15000,
            maxRedirects: 0
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
    const callbackUrl = `${serverConfig.CALLBACK_BASE_URL}/MagiAgent/${meeting.id}`;
            headers: { 'Content-Type': 'application/json' }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `eff29b1f` are properly handled with clean fallback behavior.
