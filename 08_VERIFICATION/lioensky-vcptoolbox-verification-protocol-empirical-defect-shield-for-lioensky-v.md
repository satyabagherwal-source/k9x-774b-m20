# Verification Protocol: Verification Protocol: Empirical Defect Shield for lioensky/VCPToolBox

<!-- PROVENANCE_START
{
  "source_repository": "lioensky/VCPToolBox",
  "source_url": "https://github.com/lioensky/VCPToolBox",
  "source_version": "7131e7e4",
  "license": "NOASSERTION",
  "timestamp": "2026-11-22T04:39:05.032Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lioensky-vcptoolbox",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox) (Revision: `7131e7e4`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-22T04:39:05.032Z`  
> **Learning ID**: `learn-github-lioensky-vcptoolbox`


## 1. Scope & Verification Target
- **Target Repository**: `lioensky/VCPToolBox` (Commit: `7131e7e4`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): lioensky/VCPToolBox

> **Canonical Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T04:39:03.341Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2452 stars

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
- **Issue #629** (2026-11-21): **[建议] AdminPanel 占位符预览不展开提示词内部的 {{Var*}}，与模型实际注入内容不一致**
  *Symptoms*: ## 现象  控制中心 → 占位符面板里，`{{Var*}}` / `{{Tar*}}` 的预览内容直接显示文件原文。当提示词文件内部引用了其他路径变量时，预览里保留字面 `{{VarVCPToolBoxPath}}`：  ``` 获取每日新闻：file://{{VarVCPToolBoxPath}}\Plugin\DailyHot\dailyhot_cache.md 获取天气预报：file://{{VarVCPToolBoxPath}}\Plugin\WeatherReporter\weather_cache.txt ```  （以上来自 `TVStxt/toollite.txt`，该文件本身就由 `{{VarToolLite}}` 注入）  而实际注入给模型时这一层会被解析成真实路径。**面板核对时看到的内容与模型实际收到的内容不一致。**  ## 根因  三个预览端点都只调 `tvsManager.getContent()` 取文件原文，没有再往下走一层变量替换。  ### 1. `routes/admin/placeholders.js:113`（列表接口 `GET /placeholders`，`env_tar_var` 分支）  ```js } else if (raw.toLowerCase().endsWith('.txt')) {     try {         preview = await tvsManager.getContent(raw);     } catch (e) { preview = `[读取文件失败: ${e.message}]`; } } ```  ### 2. `routes/admin/placeholders.js:132`（同一接口，`env_sar` 分支）  ```js } else if (raw.toLowerCase().endsWith('.txt')) {     try {         preview = await tvsManager.getContent(raw);     } catch (e) { preview = raw || '[按模型注入]'; } } ```  ### 3. `routes/admin/placeholders.js:232`（详情接口 `GET /placeholders/detail`，`env_tar_var` / `env_sar` 分支）  ```js } else if (envVal.toLowerCase().endsWith('.txt')) {     const tvsManager = require('../../modules/tvsManager');     value = await tvsManager.getContent(envVal); } ```  `modules/tvsManager.js:64 async getContent(filename)` 只做三件事：查 `contentCache` → `fs.readFile(path.join(TVS_DIR, filename), 'utf8')` → 写缓存返回。**它按设计只负责「读文件」，不做任何变量替换。**  ### 对比：注入路径确实多走一层  `modules/messageProcessor.js:967-1001`（`role === 'system'` 时的 `Var*` / `Tar*` 展开）：  ```js if

- **Issue #627** (2026-11-21): **[建议] saveGroups 并发时直接抛错而非排队，任何新增的落盘调用点都必须自己 catch 吞异常**
  *Symptoms*: ## 现象  `SemanticGroupManager.saveGroups()` 用 `this.saveLock` 做并发保护，但实现方式是**撞车直接抛错**，而不是排队等待：  ```js // Plugin/RAGDiaryPlugin/SemanticGroupManager.js:196 async saveGroups() {     if (this.saveLock) {         const busyError = new Error('A save operation is already in progress. Please wait a moment and try again.');         console.warn(`[SemanticGroup] ${busyError.message}`);         throw busyError;     }     this.saveLock = true;     // …写临时文件 → 原子 rename…     finally {         this.saveLock = false;     } } ```  后到的调用方拿到的是一个异常，而不是「等前一次写完」或「前一次写完后合并我的改动」。  ## 为什么这是个问题  `saveGroups()` 里真正的写盘动作是临时文件 + `fs.rename`（`:221` / `:224`），耗时完全取决于磁盘。这个窗口内任何第二次调用都会失败。  而这条方法并不只有管理面板在用，现有两个调用点都在**可能同时发生**的路径上：  | 调用点 | 所在方法 | 触发场景 | |---|---|---| | `:183` | `loadGroups()` | 插件初始化时发现需要迁移/清理，重写一次 | | `:389` | `precomputeGroupVectors()` | 检测到组词元变化、重算向量后 |  `precomputeGroupVectors()` 会在一次调用里**循环处理所有组**（`:326` `for (const [groupName, groupData] of Object.entries(this.groups))`），每组可能 `await this.ragPlugin.getSingleEmbeddingCached(...)` 打一次 embedding 接口。组多时这个函数能跑几十秒。如果这段时间里初始化路径（`:183`）或另一个入口也走到写盘，后到者必然抛错。  上层的 `updateGroupsData()`（`:240`）把异常原样 re-throw 给路由（`:268` `throw error; // Re-throw the error to be caught by the route handler`），最终表现是管理面板保存失败，用户看到「A save operation is already in progress」这种提示——它不是在告诉用户「稍后再试就行」，而是在暴露内部锁状态。  ## 实测复现  在隔离副本上同时发起两次保存：  ```js const results = await Promise.allSettled([mgr.saveGroups(), mgr.saveGroups()]); ```  实际输出：  ``` [SemanticGroup] A save operation is alread
  **Post-Mortem & Fix Analysis**:
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

### Incident Patch 1: `82c0efd4` (2026-11-21)
**Commit Message**: Merge pull request #623 from infinite-vector/feat/comfyuigen-active-timeout-and-base64memo-trace

feat(ComfyUIGen,RAGDiaryPlugin): 支持 ComfyUI 进程跟随式活性超时检测与 ::Base64Memo 超栈路径溯源及自适应图像压缩

**File**: `Plugin/ComfyUIGen/ComfyUIGen.js` (modified, +165/-17)
```diff
@@ -16,6 +16,8 @@ async function loadConfiguration() {
         COMFYUI_BASE_URL: 'http://localhost:8188',
         COMFYUI_API_KEY: '',
         DEBUG_MODE: false,
+        COMFYUI_MAX_WAIT_MINUTES: 30,
+        COMFYUI_MISSING_QUEUE_TOLERANCE: 5,
         workflow: 'text2img_basic'
     };
     
@@ -29,6 +31,9 @@ async function loadConfiguration() {
             if (userSettings.serverUrl) config.COMFYUI_BASE_URL = userSettings.serverUrl;
             if (userSettings.apiKey) config.COMFYUI_API_KEY = userSettings.apiKey;
             if (userSettings.workflow) config.workflow = userSettings.workflow;
+            if (userSettings.maxWaitMinutes !== undefined) {
+                config.COMFYUI_MAX_WAIT_MINUTES = resolveNumericArg(userSettings.maxWaitMinutes, config.COMFYUI_MAX_WAIT_MINUTES);
+            }
             
             // Store all user settings for parameter processing
             config.userSettings = userSettings;
@@ -43,6 +48,12 @@ async function loadConfiguration() {
     config.COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || config.COMFYUI_BASE_URL;
     config.COMFYUI_API_KEY = process.env.COMFYUI_API_KEY || config.COMFYUI_API_KEY;
     config.DEBUG_MODE = (process.env.DEBUG_MODE || config.DEBUG_MODE || 'false').toLowerCase() === 'true';
+    if (process.env.COMFYUI_MAX_WAIT_MINUTES !== undefined && process.env.COMFYUI_MAX_WAIT_MINUTES !== '') {
+        config.COMFYUI_MAX_WAIT_MINUTES = resolveNumericArg(process.env.COMFYUI_MAX_WAIT_MINUTES, config.COMFYUI_MAX_WAIT_MINUTES);
+    }
+    if (process.env.COMFYUI_MISSING_QUEUE_TOLERANCE !== undefined && process.env.COMFYUI_MISSING_QUEUE_TOLERANCE !== '') {
+        config.COMFYUI_MISSING_QUEUE_TOLERANCE = Math.max(1, Math.floor(resolveNumericArg(process.env.COMFYUI_MISSING_QUEUE_TOLERANCE, 5)));
+    }
     
     // Required system environment variables
     config.PROJECT_BASE_PATH = process.env.PROJECT_BASE_PATH;
@@ -128,7 +139,7 @@ function fillWorkflowParameters(workflow, args, config) {
     if (JSON.stringify(workflow).includes('{{FACE_PROMPT}}') && typeof facePrompt !== 'string') {
         throw new Error('face_prompt must be a string.');
     }
-
+    
     // 构建LoRA字符串
     const lorasString = buildLoRAsString(settings.loras || []);
     
@@ -387,32 +398,161 @@ async function queuePrompt(workflow, config) {
     };
 }
 
-// 检查队列状态
+// 检查历史完成状态
 async function checkQueueStatus(promptId, config) {
     const comfyuiAxios = axios.create({
         baseURL: config.COMFYUI_BASE_URL,
+        headers: config.COMFYUI_API_KEY ? { 'Authorization': `Bearer ${config.COMFYUI_API_KEY}` } : {},
         timeout: 10000
     });
     
     const response = await comfyuiAxios.get(`/history/${promptId}`);
-    return response.data[promptId] || null;
+    return (response.data && response.data[promptId]) ? response.data[promptId] : null;
 }
 
-// 等待生成完成
-async function waitForCompletion(promptId, config, maxAttempts = 60, interval = 3000) {
-    for (let attempt = 0; attempt < maxAttempts; attempt++) {
-        debugLog(`Checking queue status, attempt ${attempt + 1}/${maxAttempts}`);
-        
-        const history = await checkQueueStatus(promptId, config);
-        if (history && history.status && history.status.completed) {
-            debugLog('Generation completed!');
-            return history;
+// 检查 ComfyUI 实时运行队列 (/queue)，判断 promptId 是否仍在 running 或 pending 中推进
+async function checkActiveQueue(promptId, config) {
+    const comfyuiAxios = axios.create({
+        baseURL: config.COMFYUI_BASE_URL,
+        headers: config.COMFYUI_API_KEY ? { 'Authorization': `Bearer ${config.COMFYUI_API_KEY}` } : {},
+        timeout: 10000
+    });
+
+    const response = await comfyuiAxios.get('/queue');
+    const data = response.data || {};
+    const runningList = Array.isArray(data.queue_running) ? data.queue_running : [];
+    const pendingList = Array.isArray(data.queue_pending) ? data.queue_pending : [];
+
+    const matchesPromptId = (item) => {
+        if (!item) return false;
+        if (Array.isArray(item)) return item[1] === promptId || item.includes(promptId);
+        if (typeof item === 'object') return item.prompt_id === promptId || item.id === promptId;
+        return item === promptId;
+    };
+
+    const inRunning = runningList.some(matchesPromptId);
+    const inPending = pendingList.some(matchesPromptId);
+
+    return {
+        inRunning,
+        inPending,
+        isActive: inRunning || inPending,
+        runningCount: runningList.length,
+        pendingCount: pendingList.length
+    };
+}
+
+// 从 ComfyUI history.status 中提取节点执行错误详情
+function extractHistoryError(history) {
+    if (!history || !history.status) return null;
+    const status = history.status;
+    const isError = status.status_str === 'error' ||
+        (Array.isArray(status.messages) && status.messages.some(m => Array.isArray(m) && (m[0] === 'execution_error' || m[0] === 'execution_interrupted')));
+    if (!isError) return null;
+
+    if (Array.isA
```

**File**: `Plugin/ComfyUIGen/config.env.example` (modified, +3/-0)
```diff
@@ -22,6 +22,9 @@
 # 调试模式（显示详细日志）
 # DEBUG_MODE=false
 
+# ComfyUI 绘图进程处于活跃推进态(/queue running/pending)时的最大兜底等待分钟数（默认 30 分钟；重型视频工作流可设为 60~120，设为 0 则只要 ComfyUI 仍在推进便不超时）
+# COMFYUI_MAX_WAIT_MINUTES=30
+
 # ==========================================
 # 用户配置通过前端界面管理，包括：
 # - LoRA模型选择和强度设置
```

**File**: `Plugin/ComfyUIGen/plugin-manifest.json.block` (modified, +7/-2)
```diff
@@ -12,7 +12,7 @@
   },
   "communication": {
     "protocol": "stdio",
-    "timeout": 300000
+    "timeout": 7200000
   },
   "configSchema": {
     "COMFYUI_BASE_URL": {
@@ -29,13 +29,18 @@
       "type": "boolean",
       "description": "是否启用调试模式，显示详细执行日志",
       "default": false
+    },
+    "COMFYUI_MAX_WAIT_MINUTES": {
+      "type": "number",
+      "description": "ComfyUI 处于活跃排队或生图推进时的最大兜底等待分钟数（默认30分钟，长视频工作流可调至60-120，设为0则只要进程活跃永不超时）",
+      "default": 30
     }
   },
   "capabilities": {
     "invocationCommands": [
       {
         "commandIdentifier": "ComfyUIGenerateImage",
-        "description": "调用此工具通过 ComfyUI 生成图像，支持配置默认值及单次调用参数覆盖。\n\n📋 **调用格式**:\n\n\n⚠️ **覆盖规则**:\n- 单次调用参数优先于 comfyui-settings.json 默认值。\n- `lora_name` 不传：保留工作流内置的 LoraLoader 设置。\n- `lora_name` 传实际文件名：替换节点式 LoRA，并可用权重参数控制。\n- `lora_name` 显式传空字符串：自动绕过并移除工作流中的 LoraLoader。\n- 用户配置中的 loras 数组仍会作为提示词 token 拼接；它与节点式 LoraLoader 是两套机制。",
+        "description": "调用此工具通过 ComfyUI 生成或超分图像，支持配置默认值及单次调用参数覆盖。\n\n📋 **调用格式与覆盖规则**:\n- 单次调用参数优先于 comfyui-settings.json 默认值。\n- `workflow`: 支持 `AnimaEZGen`(极速直出)、`AnimaEnhanced`(4x超分+FaceDetailer面修)、`AnimeSharp`(免prompt纯图片超分，需传 `image` 与可选 `resize_scale`)、`qwen21gen`、`qwen21edit` 等。\n- `resize_scale`: 缩放倍率（AnimaEnhanced 默认 1，AnimeSharp 默认 2，可传 1.5、2、4 等正数）。\n- `face_prompt`: AnimaEnhanced 专用独立面部重绘提示词（默认 detailed glassy eyes, smooth porcelain skin）。\n- `lora_name`: 不传保留内置设置；传文件名替换 LoRA；显式传空字符串 \"\" 自动绕过并移除 LoraLoader。",
         "example": "<<<[TOOL_REQUEST]>>>\nmaid:「始」CreativeAssistant「末」,\ntool_name:「始」ComfyUIGen「末」,\nworkflow:「始」AnimaEZGen「末」,\nprompt:「始」1girl, silver hair, blue eyes, cinematic anime illustration「末」,\nnegative_prompt:「始」bad hands, blurry「末」,\nwidth:「始」1024「末」,\nheight:「始」1024「末」,\nsteps:「始」24「末」,\ncfg:「始」4「末」,\nsampler:「始」euler_ancestral「末」,\nscheduler:「始」simple「末」,\nseed:「始」-1「末」,\nlora_name:「始」anima_rendering_detailer_base10.safetensors「末」,\nlora_strength:「始」0.4「末」,\nlora_clip_strength:「始」1.0「末」\n<<<[END_TOOL_REQUEST]>>>"
       }
     ]
```

**File**: `Plugin/RAGDiaryPlugin/AttachmentMemoUtils.js` (modified, +238/-10)
```diff
@@ -4,6 +4,22 @@ const fs = require('fs').promises;
 const axios = require('axios');
 const mime = require('mime-types');
 
+let sharpModule = null;
+function getSharp() {
+    if (sharpModule !== null) return sharpModule;
+    try {
+        sharpModule = require('sharp');
+    } catch {
+        sharpModule = false;
+    }
+    return sharpModule || null;
+}
+
+const DEFAULT_MAX_SIZE_MB = 20;
+const DEFAULT_COMPRESS_THRESHOLD_MB = 4;
+const DEFAULT_COMPRESS_MAX_DIMENSION = 2048;
+const DEFAULT_COMPRESS_QUALITY = 85;
+
 /**
  * 从召回文本中提取可作为 Base64Memo 注入的附件链接。
  * 支持 http / https / file 协议，并排除表情包、emoji、sticker 路径。
@@ -29,49 +45,261 @@ function extractAttachments(text) {
 }
 
 /**
- * 获取链接内容并转为 data URI base64。
+ * 规范化日记来源路径为 file:/// 超栈追踪格式。
+ *
+ * @param {object} entry
+ * @param {string} [fallbackDiaryName]
+ * @returns {{ sourcePath: string, diaryName: string }}
+ */
+function resolveEntrySourceMeta(entry, fallbackDiaryName = '') {
+    const rawPath = entry?.fullPath || entry?.sourceFile || entry?.path || '';
+    const diaryName = String(entry?.dbName || fallbackDiaryName || '').trim();
+    if (!rawPath) {
+        return { sourcePath: '', diaryName };
+    }
+    const normalized = String(rawPath).replace(/\\/g, '/').trim();
+    const sourcePath = normalized.startsWith('file://')
+        ? normalized
+        : `file:///${normalized.replace(/^\/+/, '')}`;
+    return { sourcePath, diaryName };
+}
+
+/**
+ * 从结构化检索结果数组或格式化文本中提取带日记来源路径的附件列表。
+ *
+ * @param {Array<object>} results
+ * @param {string} [fallbackText]
+ * @param {string} [diaryName]
+ * @returns {Array<{ url: string, sourcePath: string, diaryName: string }>}
+ */
+function extractAttachmentsFromResults(results, fallbackText = '', diaryName = '') {
+    const items = [];
+    const seenInBatch = new Set();
+
+    if (Array.isArray(results) && results.length > 0) {
+        for (const entry of results) {
+            const entryText = entry?.text || '';
+            const urls = extractAttachments(entryText);
+            if (urls.length === 0) continue;
+            const { sourcePath, diaryName: resolvedDiary } = resolveEntrySourceMeta(entry, diaryName);
+            for (const url of urls) {
+                if (seenInBatch.has(url)) continue;
+                seenInBatch.add(url);
+                items.push({
+                    url,
+                    sourcePath,
+                    diaryName: resolvedDiary
+                });
+            }
+        }
+    }
+
+    if (items.length === 0 && fallbackText) {
+        // 回退：从格式化后的文本块中按段落匹配紧随其后的 [路径: file:///...]
+        const lines = String(fallbackText).split(/\r?\n/);
+        let pendingUrls = [];
+        for (const line of lines) {
+            const pathMatch = line.match(/\[路径:\s*(file:\/\/\/[^\]]+)\]/i);
+            if (pathMatch && pendingUrls.length > 0) {
+                const sourcePath = pathMatch[1].trim();
+                for (const url of pendingUrls) {
+                    if (seenInBatch.has(url)) continue;
+                    seenInBatch.add(url);
+                    items.push({ url, sourcePath, diaryName: String(diaryName || '').trim() });
+                }
+                pendingUrls = [];
+                continue;
+            }
+            const lineUrls = extractAttachments(line);
+            if (lineUrls.length > 0) {
+                pendingUrls.push(...lineUrls);
+            }
+        }
+        for (const url of pendingUrls) {
+            if (seenInBatch.has(url)) continue;
+            seenInBatch.add(url);
+            items.push({ url, sourcePath: '', diaryName: String(diaryName || '').trim() });
+        }
+    }
+
+    return items;
+}
+
+function formatSizeMB(bytes) {
+    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
+}
+
+/**
+ * 构建紧邻附件图片的日记溯源与压缩说明文本。
+ *
+ * @param {object} meta
+ * @param {string} [meta.sourcePath]
+ * @param {string} [meta.diaryName]
+ * @param {boolean} [meta.compressed]
+ * @param {number} [meta.originalBytes]
+ * @param {number} [meta.finalBytes]
+ * @param {number} [meta.index]
+ * @param {number} [meta.total]
+ * @returns {string}
+ */
+function formatAttachmentSourceNote(meta = {}) {
+    const indexPrefix = (Number.isFinite(meta.index) && Number.isFinite(meta.total) && meta.total > 1)
+        ? `(${meta.index}/${meta.total}) `
+        : '';
+    const diaryLabel = meta.diaryName ? `《${meta.diaryName}》` : '';
+    const pathLabel = meta.sourcePath
+        ? `${diaryLabel ? ' ' : ''}${meta.sourcePath}`
+        : (diaryLabel || '日记记忆库');
+    const compressClause = (meta.compressed && Number.isFinite(meta.originalBytes) && Number.isFinite(meta.finalBytes))
+        ? `，原图 ${formatSizeMB(meta.originalBytes)} 已自适应压缩至 ${formatSizeMB(meta.finalBytes)}`
+        : '';
+
+    return `[日记召回附件图片${indexPrefix}：源自 ${diaryLabel}${pathLabel}${compressClause}]`;
+}
+
+/**
+ * 获取附件内容，执行硬上限检查（默认 20MB）与自适应图像瘦身（默认 >4MB 触发压缩），返回详细元数据。
  *
  * @param {string} url
  * @param {object} [options]
  * @param {Console} [op
```

**File**: `Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js` (modified, +75/-27)
```diff
@@ -1748,23 +1748,40 @@ class RAGDiaryPlugin {
                 }
             }
 
-            // 🌟 V7: 处理收集到的多模态附件
+            // 🌟 V7: 处理收集到的多模态附件（支持超栈路径溯源、20MB硬上限与4MB自适应压缩紧邻注入）
             if (collectedAttachments.length > 0) {
                 // 限制数量，优先最近的（collectedAttachments 是按召回顺序添加的，通常 RAG 结果已经按相关性/时间排序）
                 const limit = parseInt(process.env.BASE64_MEMO_LIMIT) || this.ragParams?.RAGDiaryPlugin?.base64MemoLimit || 5;
-                const uniqueAttachments = [...new Set(collectedAttachments)].slice(0, limit);
-                const base64DataArray = [];
+                const uniqueAttachmentMap = new Map();
+                for (const item of collectedAttachments) {
+                    const entryObj = typeof item === 'string'
+                        ? { url: item, sourcePath: '', diaryName: '' }
+                        : (item && typeof item.url === 'string' ? item : null);
+                    if (!entryObj || !entryObj.url) continue;
+                    if (!uniqueAttachmentMap.has(entryObj.url)) {
+                        uniqueAttachmentMap.set(entryObj.url, entryObj);
+                    } else {
+                        const existing = uniqueAttachmentMap.get(entryObj.url);
+                        if (!existing.sourcePath && entryObj.sourcePath) existing.sourcePath = entryObj.sourcePath;
+                        if (!existing.diaryName && entryObj.diaryName) existing.diaryName = entryObj.diaryName;
+                    }
+                }
+                const uniqueAttachments = Array.from(uniqueAttachmentMap.values()).slice(0, limit);
+                const resolvedAttachments = [];
 
                 console.log(`[RAGDiaryPlugin] 🌟 V7: 开始处理 ${uniqueAttachments.length} 个多模态附件 (限制: ${limit})`);
 
-                for (const url of uniqueAttachments) {
-                    const b64 = await this._fetchAsBase64(url);
-                    if (b64) {
-                        base64DataArray.push(b64);
+                for (const item of uniqueAttachments) {
+                    const fetched = await this._fetchAttachmentWithMeta(item.url);
+                    if (fetched && fetched.dataUri) {
+                        resolvedAttachments.push({
+                            ...item,
+                            ...fetched
+                        });
                     }
                 }
 
-                if (base64DataArray.length > 0) {
+                if (resolvedAttachments.length > 0) {
                     // 找到第一个用户消息（楼层最上面那个）。若它此前未因占位符
                     // 处理而克隆，此处按需克隆，保持输入 messages 完全不可变。
                     const firstUserIndex = newMessages.findIndex(m => m.role === 'user');
@@ -1775,28 +1792,43 @@ class RAGDiaryPlugin {
                             };
                         }
                         const firstUserMsg = newMessages[firstUserIndex];
-                        const note = `[召回${base64DataArray.length}个日记多模态数据]`;
 
                         if (typeof firstUserMsg.content === 'string') {
-                            const originalText = firstUserMsg.content;
                             firstUserMsg.content = [
-                                { type: 'text', text: originalText + ' ' + note }
+                                { type: 'text', text: firstUserMsg.content }
                             ];
                         } else if (Array.isArray(firstUserMsg.content)) {
-                            firstUserMsg.content = this._replaceTextInContent(firstUserMsg.content, (text) => {
-                                const trimmed = (text || '').trim();
-                                return trimmed ? `${trimmed} ${note}` : note;
-                            });
+                            firstUserMsg.content = firstUserMsg.content.slice();
+                        } else if (firstUserMsg.content && typeof firstUserMsg.content === 'object' && typeof firstUserMsg.content.text === 'string') {
+                            firstUserMsg.content = [
+                                { ...firstUserMsg.content, type: 'text' }
+                            ];
+                        } else {
+                            firstUserMsg.content = [];
                         }
 
-                        // 添加 base64 数据到 content 数组
-                        for (const b64 of base64DataArray) {
+                        // 紧邻注入：每张召回附件前紧跟一条标明日记 file:/// 超栈来源路径与半句压缩情形的文本说明
+                        const totalCount = resolvedAttachments.length;
+                        resolvedAttachments.forEach((att, idx) => {
+                            const sourceNote = AttachmentMemoUtils.formatAttachmentSourceNote({
+                                sourcePath: att.sourcePath,
+                                diaryName: att.diaryName,
+                                compressed: att.compressed,
+                                originalBytes: att.originalBytes,
+                                finalBytes: att.finalBytes,
+                                inde
```

**File**: `Plugin/RAGDiaryPlugin/config.env.example` (modified, +4/-0)
```diff
@@ -81,6 +81,10 @@ NativeRerankTimeoutMs=3000
 
 # ::Base64Memo 语法召回多模态附件的最大数量限制，默认 5
 BASE64_MEMO_LIMIT=5
+# ::Base64Memo 单张召回附件体积硬上限（单位 MB，默认 20；超过该体积的附件将直接取消召回以节省 Token，设为 0 则不限制）
+BASE64_MEMO_MAX_SIZE_MB=20
+# ::Base64Memo 静态图片自适应瘦身阈值（单位 MB，默认 4；超过该阈值且未超硬上限的图片将自动压缩为高清 WebP 并附带半句压缩情形说明，设为 0 则关闭压缩）
+BASE64_MEMO_COMPRESS_THRESHOLD_MB=4
 
 # 上下文折叠 SQLite 迷你数据库存储上限
 # 最大保存条目数，默认 200；达到上限时按 updated_at 最旧优先 LRU 淘汰
```

---

### Incident Patch 2: `7131e7e4` (2026-11-21)
**Commit Message**: fix3

**File**: `Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js` (modified, +3/-1)
```diff
@@ -645,6 +645,7 @@ class RAGDiaryPlugin {
         this.cacheManager.startCleanup('embedding');
         this.cacheManager.startCleanup('aimemo');
 
+        this.semanticGroups.resumeStatsFlush();
         console.log('[RAGDiaryPlugin] 插件初始化完成，统一缓存系统已启动');
     }
 
@@ -6277,7 +6278,7 @@ class RAGDiaryPlugin {
         });
     }
 
-    shutdown() {
+    async shutdown() {
         if (this.ragParamsReloadTimer) {
             clearTimeout(this.ragParamsReloadTimer);
             this.ragParamsReloadTimer = null;
@@ -6302,6 +6303,7 @@ class RAGDiaryPlugin {
             this.foldingStore = null;
         }
 
+        await this.semanticGroups.shutdown();
         console.log(`[RAGDiaryPlugin] 插件已关闭`);
     }
 }
```

**File**: `Plugin/RAGDiaryPlugin/SemanticGroupManager.js` (modified, +56/-11)
```diff
@@ -4,17 +4,23 @@ const fs = require('fs').promises;
 const path = require('path');
 const crypto = require('crypto');
 
+const STATS_FLUSH_INTERVAL_MS = 60_000;
+
 class SemanticGroupManager {
     constructor(ragPlugin) {
         this.ragPlugin = ragPlugin; // 引用 RAGDiaryPlugin 实例
         this.groups = {};
         this.config = {};
         this.groupVectorCache = new Map(); // 使用 Map 存储向量缓存
-        this.saveLock = false; // 添加保存锁以防止并发写入
+        this._saveTail = Promise.resolve();
+        this._statsRevision = 0;
+        this._savedStatsRevision = 0;
+        this._statsFlushTimer = null;
+        this._stopping = false;
         this.groupsFilePath = path.join(__dirname, 'semantic_groups.json');
         this.vectorsDirPath = path.join(__dirname, 'semantic_vectors');
         this.editFilePath = path.join(__dirname, 'semantic_groups.edit.json');
-        this.initialize();
+        this._ready = this.initialize();
     }
 
     async initialize() {
@@ -193,13 +199,15 @@ class SemanticGroupManager {
         }
     }
 
-    async saveGroups() {
-        if (this.saveLock) {
-            const busyError = new Error('A save operation is already in progress. Please wait a moment and try again.');
-            console.warn(`[SemanticGroup] ${busyError.message}`);
-            throw busyError;
-        }
-        this.saveLock = true;
+    saveGroups() {
+        const save = this._saveTail.then(() => this._writeGroups());
+        // 当前调用者仍收到原始失败；失败的写入不能阻塞后续保存。
+        this._saveTail = save.catch(() => {});
+        return save;
+    }
+
+    async _writeGroups() {
+        const statsRevision = this._statsRevision;
 
         const tempFilePath = this.groupsFilePath + `.${crypto.randomUUID()}.tmp`;
         try {
@@ -219,6 +227,7 @@ class SemanticGroupManager {
 
             // 2. 成功后，重命名临时文件以原子方式替换原文件
             await fs.rename(tempFilePath, this.groupsFilePath);
+            this._savedStatsRevision = statsRevision;
 
             console.log('[SemanticGroup] 语义组配置已通过原子写入操作更新并保存。');
         } catch (error) {
@@ -232,8 +241,6 @@ class SemanticGroupManager {
                 }
             }
             throw error; // 将原始错误重新抛出，以便API路由可以捕获它
-        } finally {
-            this.saveLock = false;
         }
     }
 
@@ -306,9 +313,47 @@ class SemanticGroupManager {
         if (this.groups[groupName]) {
             this.groups[groupName].last_activated = new Date().toISOString();
             this.groups[groupName].activation_count = (this.groups[groupName].activation_count || 0) + 1;
+            this._statsRevision++;
+            this._scheduleStatsFlush();
         }
     }
 
+    _scheduleStatsFlush() {
+        if (this._stopping || this._statsFlushTimer || this._statsRevision === this._savedStatsRevision) return;
+
+        this._statsFlushTimer = setTimeout(async () => {
+            this._statsFlushTimer = null;
+            try {
+                await this._ready;
+                if (!this._stopping && this._statsRevision !== this._savedStatsRevision) {
+                    await this.saveGroups();
+                }
+            } catch (error) {
+                console.warn('[SemanticGroup] 激活统计刷盘失败，将在下个周期重试:', error.message);
+            } finally {
+                this._scheduleStatsFlush();
+            }
+        }, STATS_FLUSH_INTERVAL_MS);
+        this._statsFlushTimer.unref();
+    }
+
+    resumeStatsFlush() {
+        this._stopping = false;
+        this._scheduleStatsFlush();
+    }
+
+    async shutdown() {
+        this._stopping = true;
+        clearTimeout(this._statsFlushTimer);
+        this._statsFlushTimer = null;
+        await this._saveTail;
+        if (this._statsRevision === this._savedStatsRevision) return;
+
+        await this._ready;
+        while (this._statsRevision !== this._savedStatsRevision) {
+            await this.saveGroups();
+        }
+    }
     // ============ 预计算组向量 ============
     _getWordsHash(words) {
         if (!words || words.length === 0) {
```

**File**: `tests/semanticGroupPersistence.test.js` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+'use strict';
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs/promises');
+const os = require('node:os');
+const path = require('node:path');
+const vm = require('node:vm');
+
+const sourcePath = path.join(__dirname, '../Plugin/RAGDiaryPlugin/SemanticGroupManager.js');
+
+async function fixture(t) {
+    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-group-stats-'));
+    t.after(() => fs.rm(dir, { recursive: true, force: true }));
+    const groupsPath = path.join(dir, 'semantic_groups.json');
+    const editPath = path.join(dir, 'semantic_groups.edit.json');
+    const timers = new Set();
+    const io = { ...fs };
+    const mod = { exports: {} };
+    vm.runInNewContext(await fs.readFile(sourcePath, 'utf8'), {
+        __dirname: dir,
+        module: mod,
+        require: name => name === 'fs' ? { promises: io } : require(name),
+        console: { log() {}, warn() {}, error() {} },
+        setTimeout(callback, delay) {
+            const timer = { callback, delay, referenced: true, unref() { this.referenced = false; } };
+            timers.add(timer);
+            return timer;
+        },
+        clearTimeout: timer => timers.delete(timer)
+    }, { filename: sourcePath });
+
+    async function open() {
+        const manager = new mod.exports({ getSingleEmbeddingCached: async () => [1, 0] });
+        await manager._ready;
+        return manager;
+    }
+
+    const manager = await open();
+    manager.groups = {
+        fruit: { words: ['apple', 'pear'], activation_count: 5, last_activated: '2000-01-01T00:00:00.000Z' }
+    };
+    await manager.saveGroups();
+    return {
+        manager, groupsPath, editPath, timers, io, open,
+        read: async () => JSON.parse(await fs.readFile(groupsPath, 'utf8')),
+        async flush() {
+            assert.equal(timers.size, 1);
+            const [timer] = timers;
+            timers.delete(timer);
+            await timer.callback();
+        }
+    };
+}
+
+test('activation uses one unrefed 60s window; counts survive restart and edit-file sync', async t => {
+    const f = await fixture(t);
+    assert.equal(f.manager.detectAndActivateGroups('nothing').size, 0);
+    assert.equal(f.timers.size, 0);
+    let renames = 0;
+    f.io.rename = (...args) => { renames++; return fs.rename(...args); };
+    assert.equal(f.manager.detectAndActivateGroups('apple').get('fruit').strength, 0.5);
+    const [timer] = f.timers;
+    for (let i = 0; i < 19; i++) f.manager.detectAndActivateGroups('apple and pear');
+    assert.deepEqual([...f.timers], [timer]);
+    assert.equal(timer.delay, 60_000);
+    assert.equal(timer.referenced, false);
+    assert.equal((await f.read()).groups.fruit.activation_count, 5);
+    await f.flush();
+    assert.equal(renames, 1);
+    assert.equal(f.timers.size, 0);
+    const saved = (await f.read()).groups.fruit;
+    assert.equal(saved.activation_count, 25);
+    assert.notEqual(saved.last_activated, '2000-01-01T00:00:00.000Z');
+    assert.equal(saved.last_activated, f.manager.groups.fruit.last_activated);
+
+    await fs.writeFile(f.editPath, JSON.stringify({ groups: { fruit: { words: ['apple', 'plum'], weight: 2 } } }));
+    const reopened = await f.open();
+    assert.equal(reopened.groups.fruit.activation_count, 25);
+    assert.equal(reopened.groups.fruit.last_activated, saved.last_activated);
+    assert.equal(reopened.groups.fruit.weight, 2);
+    assert.deepEqual([...reopened.groups.fruit.words], ['apple', 'plum']);
+});
+
+test('queued saves wait for rename, then capture current data; an intervening activation is not lost', async t => {
+    const f = await fixture(t);
+    let unblock;
+    let entered;
+    const gate = new Promise(resolve => { unblock = resolve; });
+    const started = new Promise(resolve => { entered = resolve; });
+    let writes = 0;
+    f.io.writeFile = (...args) => { writes++; return fs.writeFile(...args); };
+    f.io.rename = async (...args) => {
+        if (writes === 1) {
+            entered();
+            await gate;
+        }
+        await fs.rename(...args);
+    };
+
+    const first = f.manager.saveGroups();
+    await started;
+    let finished = false;
+    const second = f.manager.saveGroups().then(() => { finished = true; });
+    try {
+        f.manager.config = { edited: true };
+        f.manager.detectAndActivateGroups('pear');
+        await Promise.resolve();
+        assert.equal(writes, 1);
+        assert.equal(finished, false);
+        assert.equal((await f.read()).groups.fruit.activation_count, 5);
+    } finally {
+        unblock();
+        await Promise.all([first, second]);
+    }
+    const saved = await f.read();
+    assert.deepEqual(saved.config, { edited: true });
+    assert.equal(saved.groups.fruit.activation_count, 6);
+    await f.flush();
+    assert.equal(writes, 2, 'a regular save already persisted the dirty stats');
+});
+
+test('a failed ex
```

---

### Incident Patch 3: `eec525c5` (2026-11-21)
**Commit Message**: fix4

**File**: `docs/CONFIGURATION.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
 
 | 文件名 | 位置 | 用途 |
 |--------|------|------|
-| `tag-processor-config.env` | 根目录 | Tag 批量处理工具配置 |
+| `config.env`（Tag 批量处理工具） | 仓库根目录；独立部署时为脚本同目录 | `tag-processor-config.env.example` 是模板，不是运行时读取的文件名 |
 | `Plugin/*/config.env` | 插件目录 | 各插件专属配置 |
 | `docker-compose.yml` | 根目录 | Docker Compose 部署配置 |
 | `Dockerfile` | 根目录 | Docker 镜像构建配置 |
```

**File**: `docs/DIARY_TAG_BATCH_PROCESSOR.md` (modified, +7/-25)
```diff
@@ -108,7 +108,7 @@ npm install
 
 #### 步骤4：配置
 
-创建 `config.env`（参考 [`tag-processor-config.env.example`](tag-processor-config.env.example:1)）：
+在脚本同目录创建 `config.env`（参考 [`tag-processor-config.env.example`](../tag-processor-config.env.example)）：
 
 ```env
 API_Key=your_api_key_here
@@ -132,14 +132,14 @@ node diary-tag-batch-processor.js /path/to/your/diaries
 
 ### 配置文件
 
-需要在VCP根目录的 `config.env` 中配置API：
+在 VCP 仓库中运行时，脚本读取仓库根目录的 `config.env`，不读取 `scripts/config.env`。独立部署时读取脚本同目录的 `config.env`。已设置的进程环境变量优先于文件中的值。
 
 ```env
 # API配置（必需）
 API_Key=your_api_key_here
 API_URL=http://127.0.0.1:3000
 
-# 可选：在 Plugin/DailyNoteWrite/config.env 中配置Tag模型
+# 可选：在同一份 config.env 中配置 Tag 模型
 TagModel=gemini-2.5-flash-preview-09-2025-thinking
 TagModelMaxTokens=40000
 TagModelPrompt=TagMaster.txt
@@ -422,18 +422,16 @@ DebugMode=true
 
 本工具可以通过独立的配置文件在其他项目中使用。以下提供完整的配置模板，可直接复制使用。
 
-### 配置文件：`tag-processor-config.env`
+### 配置文件模板：保存为 `config.env`
 
 ```env
 # ============================================================
 # VCP Tag处理器独立配置文件
 # ============================================================
 #
 # 用途：为日记批量打Tag工具提供配置
-# 位置：可放在任意目录，通过 --config 参数指定
-#
-# 使用示例：
-#   node diary-tag-batch-processor.js --config ./tag-processor-config.env ./my-diaries
+# 位置：仓库根目录，或独立部署时的脚本同目录
+# 文件名：config.env
 #
 # ============================================================
 
@@ -522,23 +520,7 @@ DAILY_NOTE_EXTENSION=txt
 
 ### 如何使用独立配置
 
-#### 方法1：替换主配置（简单）
-
-将上述配置内容保存为 `config.env`，放在VCP根目录：
-
-```bash
-# 配置会自动加载
-node diary-tag-batch-processor.js ./my-diaries
-```
-
-#### 方法2：使用自定义路径（高级）
-
-如果需要在其他项目中使用，可以修改工具代码加载配置路径：
-
-```javascript
-// 在 diary-tag-batch-processor.js 开头修改
-require('dotenv').config({ path: '/path/to/your/tag-processor-config.env' });
-```
+在仓库中运行时，请将所需配置项加入现有根目录 `config.env`，不要用模板覆盖服务器配置。独立部署时，将模板复制为脚本同目录的 `config.env`。脚本不提供 `--config` 参数。
 
 ### 最小配置示例
 
```

**File**: `scripts/diary-tag-batch-processor.js` (modified, +8/-5)
```diff
@@ -13,15 +13,19 @@
  *   node diary-tag-batch-processor.js [目标文件夹路径]
  * 
  * 配置：
- *   通过根目录的 config.env 文件配置API密钥和模型参数
+ *   在 VCP 仓库中读取根目录的 config.env；独立部署时读取脚本同目录的 config.env。
  */
 
 const fs = require('fs').promises;
 const path = require('path');
 const { existsSync } = require('fs');
 
-// 加载环境变量（独立应用配置）
-require('dotenv').config({ path: path.join(__dirname, 'config.env') });
+// 用仓库里的工具包模板识别源码布局，不根据配置文件是否存在切换来源。
+const vcpRoot = path.resolve(__dirname, '..');
+const inVcpRepo = path.basename(__dirname) === 'scripts'
+    && existsSync(path.join(vcpRoot, 'diary-tag-processor-package.json'));
+const configPath = path.join(inVcpRepo ? vcpRoot : __dirname, 'config.env');
+require('dotenv').config({ path: configPath });
 
 // --- 配置 ---
 const TAG_MODEL = process.env.TagModel || 'gemini-2.5-flash-preview-09-2025-thinking';
@@ -400,8 +404,7 @@ async function main() {
     
     // 检查API配置
     if (!API_KEY || !API_URL) {
-        error('API configuration missing in config.env!');
-        error('请在根目录的 config.env 中配置 API_Key 和 API_URL');
+        error(`缺少 API 配置：请在 ${configPath} 中配置 API_Key 和 API_URL，或通过环境变量提供。`);
         process.exit(1);
     }
     
```

**File**: `tests/approvalFeedbackPassthrough.test.js` (modified, +1/-1)
```diff
@@ -420,7 +420,7 @@ test('流式/非流式模型请求：多模态回执不损坏，免回执仅传
                 if (name.includes('roleDivider')) return { process: messages => messages };
                 return require(name.startsWith('../') ? path.join(__dirname, '..', 'modules', name.slice(3)) : name);
             },
-            console, Buffer, setTimeout, clearTimeout, setInterval, clearInterval
+            console, Buffer, setTimeout, clearTimeout, setInterval, clearInterval, process: { env: {} }
         });
         const Handler = moduleStub.exports;
         for (const scenario of ['normal', 'archery', 'silent']) {
```

**File**: `vcp-installer-source/src/installer/config_gen.rs` (modified, +33/-12)
```diff
@@ -78,38 +78,58 @@ pub fn generate_config_env(
     Ok(())
 }
 
+// Both backend launchers resolve Node after entering VCPToolBox.
+const BACKEND_NODE_SETUP: &str = "REM Resolve the service interpreter in this launcher, not in the PM2 daemon.\r\n\
+if not defined VCP_NODE_INTERPRETER if exist \"..\\runtimes\\node\\node.exe\" set \"VCP_NODE_INTERPRETER=..\\runtimes\\node\\node.exe\"\r\n\
+if not defined VCP_NODE_INTERPRETER for %%I in (node.exe) do set \"VCP_NODE_INTERPRETER=%%~$PATH:I\"\r\n\
+if defined VCP_NODE_INTERPRETER for %%I in (\"%VCP_NODE_INTERPRETER%\") do set \"VCP_NODE_INTERPRETER=%%~fI\"\r\n\
+if not exist \"%VCP_NODE_INTERPRETER%\" (\r\n\
+    echo [ERROR] Node interpreter not found: \"%VCP_NODE_INTERPRETER%\". Set VCP_NODE_INTERPRETER to node.exe.\r\n\
+    pause\r\n\
+    exit /b 1\r\n\
+)\r\n\
+\"%VCP_NODE_INTERPRETER%\" --version >nul 2>&1\r\n\
+if errorlevel 1 (\r\n\
+    echo [ERROR] Cannot run Node interpreter: \"%VCP_NODE_INTERPRETER%\".\r\n\
+    pause\r\n\
+    exit /b 1\r\n\
+)\r\n\
+echo [Runtime] Node interpreter: \"%VCP_NODE_INTERPRETER%\"\r\n\
+\r\n";
+
 /// 生成 start-backend.bat（安装根目录版本，PM2 双进程）
 pub fn generate_start_backend_bat(
     install_dir: &Path,
 ) -> Result<()> {
     // bat不能包含中文（Rust写UTF-8，cmd用GBK读取会乱码）
     // pm2必须加CALL（bat调.cmd不加CALL控制流一去不返）
-    let content = "@echo off\r\n\
-setlocal\r\n\
+    let content = format!("@echo off\r\n\
+setlocal DisableDelayedExpansion\r\n\
 chcp 65001 >nul\r\n\
 echo ==========================================\r\n\
 echo   VCP Backend Launcher (PM2)\r\n\
 echo ==========================================\r\n\
 echo.\r\n\
 set \"PATH=%~dp0runtimes\\node;%~dp0runtimes\\git\\cmd;%~dp0runtimes\\python;%~dp0runtimes\\python\\Scripts;%PATH%\"\r\n\
-cd /d \"%~dp0VCPToolBox\"\r\n\
+cd /d \"%~dp0VCPToolBox\" || exit /b 1\r\n\
 if not exist \"server.js\" (\r\n\
     echo [VCP] server.js not found. Please check VCPToolBox installation.\r\n\
     pause\r\n\
     exit /b 1\r\n\
 )\r\n\
+{BACKEND_NODE_SETUP}\
 echo [VCP] Cleaning old processes...\r\n\
 CALL pm2 delete vcp-main 2>nul\r\n\
 CALL pm2 delete vcp-admin 2>nul\r\n\
 CALL pm2 delete server 2>nul\r\n\
 echo.\r\n\
 echo [VCP] Starting main service (vcp-main)...\r\n\
-CALL pm2 start server.js --name \"vcp-main\" --no-autorestart --max-memory-restart 1500M --kill-timeout 15000\r\n\
+CALL pm2 start server.js --name \"vcp-main\" --no-autorestart --max-memory-restart 1500M --kill-timeout 15000 --interpreter \"%%VCP_NODE_INTERPRETER%%\"\r\n\
 echo [VCP] Waiting for initialization (8s)...\r\n\
 ping -n 9 127.0.0.1 >nul\r\n\
 echo.\r\n\
 echo [VCP] Starting admin panel (vcp-admin)...\r\n\
-CALL pm2 start adminServer.js --name \"vcp-admin\" --no-autorestart --max-memory-restart 512M --kill-timeout 5000\r\n\
+CALL pm2 start adminServer.js --name \"vcp-admin\" --no-autorestart --max-memory-restart 512M --kill-timeout 5000 --interpreter \"%%VCP_NODE_INTERPRETER%%\"\r\n\
 echo.\r\n\
 echo ==========================================\r\n\
 echo   VCP Backend Started\r\n\
@@ -123,7 +143,7 @@ echo   pm2 logs              View realtime logs\r\n\
 echo   pm2 restart vcp-main  Restart main service\r\n\
 echo   pm2 stop all          Stop all services\r\n\
 echo.\r\n\
-pause\r\n";
+pause\r\n");
 
     let script_path = install_dir.join("start-backend.bat");
     fs::write(&script_path, content)
@@ -170,32 +190,33 @@ pub fn generate_inner_start_bat(
     let chat_dir = install_dir.join("VCPChat");
 
     // start_server.bat — VCPToolBox内部，PM2双进程 + 向上一级找runtimes
-    let content = "@echo off\r\n\
-setlocal\r\n\
+    let content = format!("@echo off\r\n\
+setlocal DisableDelayedExpansion\r\n\
 chcp 65001 >nul\r\n\
 echo ==========================================\r\n\
 echo   VCP Backend Launcher (PM2)\r\n\
 echo ==========================================\r\n\
 echo.\r\n\
 set \"PATH=%~dp0..\\runtimes\\node;%~dp0..\\runtimes\\git\\cmd;%~dp0..\\runtimes\\python;%~dp0..\\runtimes\\python\\Scripts;%PATH%\"\r\n\
-cd /d \"%~dp0\"\r\n\
+cd /d \"%~dp0\" || exit /b 1\r\n\
 if not exist \"server.js\" (\r\n\
     echo [VCP] server.js not found. Please check VCPToolBox installation.\r\n\
     pause\r\n\
     exit /b 1\r\n\
 )\r\n\
+{BACKEND_NODE_SETUP}\
 echo [VCP] Cleaning old processes...\r\n\
 CALL pm2 delete vcp-main 2>nul\r\n\
 CALL pm2 delete vcp-admin 2>nul\r\n\
 CALL pm2 delete server 2>nul\r\n\
 echo.\r\n\
 echo [VCP] Starting main service (vcp-main)...\r\n\
-CALL pm2 start server.js --name \"vcp-main\" --no-autorestart --max-memory-restart 1500M --kill-timeout 15000\r\n\
+CALL pm2 start server.js --name \"vcp-main\" --no-autorestart --max-memory-restart 1500M --kill-timeout 15000 --interpreter \"%%VCP_NODE_INTERPRETER%%\"\r\n\
 echo [VCP] Waiting for initialization (8s)...\r\n\
 ping -n 9 127.0.0.1 >nul\r\n\
 echo.\r\n\
 echo [VCP] Starting admin panel (vcp-admin)...\r\n\
-CALL pm2 start adminServer.js --name \"vcp-admin\" --no-autorestart --max-memory-restart 512M --kill-timeout 5000\r\n\
+CALL pm2 start adminServer.
```

**File**: `一键启动服务器start_server.bat` (modified, +21/-4)
```diff
@@ -1,6 +1,23 @@
 @echo off
-setlocal enabledelayedexpansion
-cd /d "%~dp0"
+setlocal DisableDelayedExpansion
+cd /d "%~dp0" || exit /b 1
+
+REM Resolve the service interpreter in this launcher, not in the PM2 daemon.
+if not defined VCP_NODE_INTERPRETER if exist "..\runtimes\node\node.exe" set "VCP_NODE_INTERPRETER=..\runtimes\node\node.exe"
+if not defined VCP_NODE_INTERPRETER for %%I in (node.exe) do set "VCP_NODE_INTERPRETER=%%~$PATH:I"
+if defined VCP_NODE_INTERPRETER for %%I in ("%VCP_NODE_INTERPRETER%") do set "VCP_NODE_INTERPRETER=%%~fI"
+if not exist "%VCP_NODE_INTERPRETER%" (
+    echo [ERROR] Node interpreter not found: "%VCP_NODE_INTERPRETER%". Set VCP_NODE_INTERPRETER to node.exe.
+    pause
+    exit /b 1
+)
+"%VCP_NODE_INTERPRETER%" --version >nul 2>&1
+if errorlevel 1 (
+    echo [ERROR] Cannot run Node interpreter: "%VCP_NODE_INTERPRETER%".
+    pause
+    exit /b 1
+)
+echo [Runtime] Node interpreter: "%VCP_NODE_INTERPRETER%"
 
 echo ============================================
 echo   VCPToolBox - Starting Services via PM2
@@ -41,7 +58,7 @@ REM Do NOT set --max-memory-restart here. Global Tag index staging, Pairwise ass
 REM EPA/IR and TagMemo rebuilds have legitimate temporary memory peaks above 1500 MB.
 REM A low PM2 RSS limit can restart the main process in the middle of a maintenance
 REM transaction and overlap two cold-start index recoveries against the same SQLite.
-call pm2 start server.js --name "vcp-main" --kill-timeout 15000
+call pm2 start server.js --name "vcp-main" --kill-timeout 15000 --interpreter "%%VCP_NODE_INTERPRETER%%"
 
 echo.
 echo Waiting 8 seconds for main service to initialize...
@@ -51,7 +68,7 @@ REM 3. Start Admin Panel
 echo [2/2] Starting Admin Panel (vcp-admin)...
 REM Keep PM2 memory restart limits disabled for both processes while diagnosing
 REM legitimate maintenance/build memory peaks and unexpected overlapping restarts.
-call pm2 start adminServer.js --name "vcp-admin" --kill-timeout 5000
+call pm2 start adminServer.js --name "vcp-admin" --kill-timeout 5000 --interpreter "%%VCP_NODE_INTERPRETER%%"
 
 echo.
 echo ============================================
```

#### Recent Merged Pull Requests:
- **PR #623** (2026-11-21): feat(ComfyUIGen,RAGDiaryPlugin): 支持 ComfyUI 进程跟随式活性超时检测与 ::Base64Memo 超栈路径溯源及自适应图像压缩 (@infinite-vector)
- **PR #621** (2026-11-20): fix(prompt): 修复提示词与插件manifest中多处笔误、转义及格式残缺问题 (@InSciTech)
- **PR #620** (2026-11-20): fix(plugins): 修正多处插件 Manifest 示例工具名、参数大小写及格式错误 (@InSciTech)
- **PR #619** (2026-11-19): fix(vexus-lite,server): 统一GlobalChunks与ReadPool单向锁序DAG根治并发死锁，并修复关机Phase2/Phase8阻塞 (@infinite-vector)
- **PR #618** (2026-11-18): # feat(WarpedFieldAtlas): 读取 Tag 和 Chunk 双曲场训练快照，支持按节点或对话消息查询近邻 (@CI-IISATO)
- **PR #617** (2026-11-18): fix: 出站请求中降级无法投递的 Markdown data: 图片（避免上游 415/500） (@RoxyAsahi)

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

## X. Empirical Invariant Guard in ComfyUIGen.js

**RULE**:
When implementing operations in `Plugin/ComfyUIGen/ComfyUIGen.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `82c0efd4`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `Plugin/ComfyUIGen/ComfyUIGen.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
        COMFYUI_MAX_WAIT_MINUTES: 30,
        COMFYUI_MISSING_QUEUE_TOLERANCE: 5,
            if (userSettings.maxWaitMinutes !== undefined) {
                config.COMFYUI_MAX_WAIT_MINUTES = resolveNumericArg(userSettings.maxWaitMinutes, config.COMFYUI_MAX_WAIT_MINUTES);
            }
    if (process.env.COMFYUI_MAX_WAIT_MINUTES !== undefined && process.env.COMFYUI_MAX_WAIT_MINUTES !== '') {
        config.COMFYUI_MAX_WAIT_MINUTES = resolveNumericArg(process.env.COMFYUI_MAX_WAIT_MINUTES, config.COMFYUI_MAX_WAIT_MINUTES);
    }
    if (process.env.COMFYUI_MISSING_QUEUE_TOLERANCE !== undefined && process.env.COMFYUI_MISSING_QUEUE_TOLERANCE !== '') {
        config.COMFYUI_MISSING_QUEUE_TOLERANCE = Math.max(1, Math.floor(resolveNumericArg(process.env.COMFYUI_MISSING_QUEUE_TOLERANCE, 5)));
    }
    
// 检查历史完成状态
        headers: config.COMFYUI_API_KEY ? { 'Authorization': `Bearer ${config.COMFYUI_API_KEY}` } : {},
    return (response.data && response.data[promptId]) ? response.data[promptId] : null;
// 检查 ComfyUI 实时运行队列 (/queue)，判断 promptId 是否仍在 running 或 pending 中推进
async function checkActiveQueue(promptId, config) {
    const comfyuiAxios = axios.create({
        baseURL: config.C
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:

// 检查队列状态
    return response.data[promptId] || null;
// 等待生成完成
async function waitForCompletion(promptId, config, maxAttempts = 60, interval = 3000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        debugLog(`Checking queue status, attempt ${attempt + 1}/${maxAttempts}`);
        
        const history = await checkQueueStatus(promptId, config);
        if (history && history.status && history.status.completed) {
            debugLog('Generation completed!');
            return history;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `82c0efd4` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
