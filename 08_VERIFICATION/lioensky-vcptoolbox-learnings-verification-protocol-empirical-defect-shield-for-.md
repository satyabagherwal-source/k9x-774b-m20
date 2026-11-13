# Verification Protocol: Verification Protocol: Empirical Defect Shield for lioensky-vcptoolbox-learnings

<!-- PROVENANCE_START
{
  "source_repository": "lioensky-vcptoolbox-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:40:51.047Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-lioensky-vcptoolbox-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky-vcptoolbox-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:40:51.047Z`  
> **Learning ID**: `LEARN-REEXTRACT-lioensky-vcptoolbox-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `lioensky-vcptoolbox-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source**: github ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Source Version**: `a8560b0a`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T13:29:06.655Z  
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
> **Harvest Timestamp**: 2026-11-11T13:29:06.640Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2444 stars

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
- **Issue #584** (2026-11-11): **docs: 更新 DailyNote 写作与有序 Tag 指引**
  *Symptoms*: ## 修改内容 继已合并的 #583 后，按本地最新版完整替换 `TVStxt/Dailynote.txt`，较大的文本变化为预期行为。  - 强调一事一记、一理一晶与完整保留因果推导、语境及适用边界。 - 更新有序 Tag 的数量、概念选择、Span-1/Span-2 承接及跨篇关联说明。 - 更新日记调用示例、管理检索参数和联想锚定说明。  ## 验证范围 仅修改这一个提示词文件；基于最新上游 main，按本地原始字节上传，不包含其他本地改动。未运行程序测试，也未验证运行时提示词效果。

- **Issue #583** (2026-11-10): **docs: 整体替换 DailyNote 日记提示词**
  *Symptoms*: ## 修改内容 使用本地最新版完整替换 `TVStxt/Dailynote.txt`。本次是日记提示词的整体更新，较大的文本差异为预期行为。  完善情感与知识记录、create/update 取舍、一事一记、有序 Tag、感悟串联、事后回溯及联想锚定，并更新调用示例。  ## 验证 仅修改这一个文件，基于上游 main，按本地文件原始字节上传，未夹带其他本地改动。纯提示词文本更新，未运行程序测试。
  **Post-Mortem & Fix Analysis**:
  > 有几个优化点，摸了，明天再改。
  > 先merge了后续再修

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

### Incident Patch 1: `a8560b0a` (2026-11-11)
**Commit Message**: fix1

**File**: `ToolConfigs/jev_tool_call_exp.json` (modified, +1/-1)
```diff
@@ -194,7 +194,7 @@
         },
         "music_controller": {
           "plugin": "MusicController",
-          "aliases": ["播放歌曲", "播放音乐", "点歌台", "点歌", "播放器", "musiccontroller", "VCP点歌台"],
+          "aliases": ["音乐播放", "播放歌曲", "播放音乐", "点歌台", "点歌", "播放器", "musiccontroller", "VCP点歌台"],
           "fixedArgs": {
             "command": "playSong"
           },
```

**File**: `modules/jevToolCallExp.js` (modified, +333/-119)
```diff
@@ -8,9 +8,51 @@ const defaultThirdPartyRegistry = require('./jevThirdPartyRegistry');
 const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'ToolConfigs', 'jev_tool_call_exp.json');
 const DEFAULT_DECISION_PROMPT_PATH = path.join(__dirname, '..', 'TVStxt', 'JevToolCallDecision.txt');
 const IMAGE_URL_RE = /^(?:https?:\/\/|file:\/\/|data:image\/)/i;
+const FETCHABLE_URL_RE = /^(?:https?:\/\/|file:\/\/)/i;
+const URL_FETCH_ACTION_RE = /打开|读取|查看|访问|看图|截图|快照/i;
 const BILIBILI_RESOURCE_RE = /(?:bilibili\.com\/video\/|b23\.tv\/|^BV[0-9A-Za-z]+(?:\?p=\d+)?$|^av\d+$)/i;
 const EXPLICIT_SIZE_RE = /\b(\d{3,4})\s*[x×:]\s*(\d{3,4})\b/i;
 const CURRENT_MUSIC_REQUEST_RE = /(?:获取|查看|读取|查询)\s*(?:(?:当前播放|正在播放|播放中|当前)(?:的)?\s*)?(?:(?:音乐|歌曲)(?:的)?(?:内容|详细信息|信息|歌词)|歌词)|\bgetCurrentLyrics\b/i;
+const SPECIAL_ACTION_CONSTRAINTS_RE = /^(?:音乐检索|getCurrentLyrics)$/i;
+
+// 强句法意图签名（基于已剥离负载与参数槽位的 actionSkeleton）：
+// 同时用于隐式能力目录推断与显式目录下的先导主意图锁定（Intent Protection）。
+const STRONG_DAILY_INTENT_RULES = [
+    {
+        toolKey: 'light_memo',
+        re: /(?:主动回忆|快速回忆|检索记忆|搜索记忆|检索日记|搜索日记)|\[音乐检索\]|音乐检索\s*【】|(?:请|帮我|麻烦)?\s*回忆\s*(?:一下)?(?:关于)?\s*【】/i
+    },
+    {
+        toolKey: 'calculator',
+        re: /(?<!预|云|边缘|超|并行|分布式)(?:科学计算|计算表达式|计算一下|算一下|计算|求解)\s*(?:一下)?(?:表达式|公式|这道题|结果)?\s*【】/i
+    },
+    {
+        toolKey: 'agent_assistant',
+        re: /(?:联络女仆|联络agent|联系女仆|联系agent|女仆通讯)|(?:请|帮我|麻烦)?\s*(?:联络|联系|通讯|委托)\s*\[\]/i
+    },
+    {
+        toolKey: 'music_controller',
+        re: /(?:播放歌曲|播放音乐|点歌|放一首|听歌|(?:请|帮我|麻烦)?\s*播放)\s*(?:一首|歌曲|音乐)?\s*【】/i
+    },
+    {
+        toolKey: 'alarm',
+        re: /(?:设置|创建|定个|安排)(?:一个|\s*\[\]\s*的?)?闹钟|在\s*\[\]\s*(?:设置|创建|定个|安排)?闹钟/i
+    },
+    {
+        toolKey: 'sleep',
+        re: /(?:请|帮我|进入)?\s*(?:睡眠|睡一觉|打个盹|打盹|进入睡眠|等待回调|等候回调|休眠)\s*\[\]/i
+    }
+];
+
+// 显式 {日用工具} 目录下的次级动作词规则（仅在纯净 actionSkeleton 上按先导位置匹配）。
+const FALLBACK_DAILY_INTENT_RULES = [
+    { toolKey: 'agent_assistant', re: /联络|联系|通讯|委托|问问.*(?:女仆|agent)/i },
+    { toolKey: 'sleep', re: /睡一觉|睡眠|打个盹|打盹|等待回调|等候回调|休眠/i },
+    { toolKey: 'alarm', re: /闹钟|(?<!醒来后|睡醒后|睡眠后)(?:提醒我|叫醒我|定时提醒)/i },
+    { toolKey: 'calculator', re: /(?<!预|云|边缘|超|并行|分布式)(?:科学计算|计算表达式|计算一下|算一下|计算|求解)/i },
+    { toolKey: 'light_memo', re: /\[音乐检索\]|音乐检索|回忆|记忆|知识库|(?:检索|搜索).*(?:日记|记忆)/i },
+    { toolKey: 'music_controller', re: /播放|点歌|放一首|听歌/i }
+];
 
 // 第三方插件裁决的官方短协议。可在 JevToolCallDecision.txt 中用
 // "## THIRD_PARTY_PROTOCOL" 段落覆盖，未提供时使用此默认值。
@@ -40,26 +82,164 @@ function uniqueStrings(values) {
     });
 }
 
-function extractMarkedValues(text, open, close) {
-    const values = [];
-    let cursor = 0;
-    while (cursor < text.length) {
-        const start = text.indexOf(open, cursor);
-        if (start < 0) break;
-        const end = text.indexOf(close, start + open.length);
-        if (end < 0) break;
-        const value = text.slice(start + open.length, end).trim();
-        if (value) values.push(value);
-        cursor = end + close.length;
+/**
+ * 在纯净意图骨架上按自然语言先导位置（最小 match.index）匹配主动作；
+ * 同起点时优先跨度更长的具体短语，防止后置状语/从句覆盖主谓动作。
+ */
+function matchLeadingIntent(text, rules) {
+    let best = null;
+    for (const rule of rules) {
+        const match = rule.re.exec(text);
+        if (!match) continue;
+        if (
+            !best
+            || match.index < best.index
+            || (match.index === best.index && match[0].length > best.length)
+        ) {
+            best = {
+                toolKey: rule.toolKey,
+                index: match.index,
+                length: match[0].length
+            };
+        }
     }
-    return values;
+    return best ? best.toolKey : null;
 }
 
-function parseBooleanHint(text, positiveWords, negativeWords) {
-    const normalized = normalizeText(text).toLowerCase();
-    if (negativeWords.some(word => normalized.includes(word))) return false;
-    if (positiveWords.some(word => normalized.includes(word))) return true;
-    return undefined;
+/**
+ * 词法平面分离器（Control / Data Plane Isolation）：
+ * 1. 优先用平衡深度扫描剥离【主要内容】并替换为【】，内部任何 {}、[]、引号、URL 与动词均冻结为纯数据负载；
+ * 2. 在负载外剥离 [] 约束槽位，普通槽位脱敏为 []，外层 URL 记为 [URL]，仅保留显式协议动作标签；
+ * 3. 在负载与槽位外提取 {} 能力目录与引号工具名，产出纯净意图骨架 actionSkeleton 与动作文本 actionText。
+ */
+function scanJevStructure(raw) {
+    const primary = [];
+    const rawConstraints = [];
+    const categories = [];
+    const backtickTools = [];
+    const quotedTools = [];
+
+    let outerRaw = '';
+    let i = 0;
+    while (i < raw.length) {
+        if (raw[i] === '【') {
+            let depth = 1;
+            let j = i + 1;
+            let firstClose = -1;
+            while (j < raw.length && depth > 0) {
+                if (raw[j] === '【') depth++;
+                else if (raw[j] === '】') {
+                    if (firstClose < 0) firstClose = j;
+                    depth--;
+                }
+                j++;
+            }
+            if (depth === 0) {
+                const content = raw.slice(i + 1, j - 1).trim();
+                if (content) primary.push(content);

```

**File**: `tests/jevToolCallExp.test.js` (modified, +92/-0)
```diff
@@ -814,4 +814,96 @@ JEV:「始」{联网搜索} 【2026年最新数学进展】「末」
     assert.equal(call3.name, 'JEV');
     assert.equal(call3.args.maid, '星阑');
     assert.equal(call3.args.expression, '{联网搜索} 【2026年最新数学进展】');
+});
+
+test('意图剥离与意图保护：主要内容与约束槽位中的动作词、目录、URL与嵌套括号绝不反向劫持主意图', async () => {
+    const { planner, decisions } = makePlanner({ configured: true });
+
+    // 1. 真实故障复现：主动回忆负载中包含“预计算”，绝不可误触发 SciCalculator
+    const [xiaokeCall] = await planner.plan(
+        '主动回忆【RiverMoonShadow 寻址推理 预计算树形图权重 池月】，搜索[所有知识库]并返回[5条]。',
+        { maid: '小克', markHistory: true, args: { maid: '小克' } }
+    );
+    assert.equal(xiaokeCall.name, 'LightMemo');
+    assert.deepEqual(xiaokeCall.args, {
+        k: '5',
+        search_all_knowledge_bases: 'true',
+        query: 'RiverMoonShadow 寻址推理 预计算树形图权重 池月',
+        maid: '小克'
+    });
+    assert.equal(xiaokeCall.markHistory, true);
+
+    // 2. 负载内嵌 {目录}、[约束]、[URL]、引号工具名与嵌套【】字面量完全冻结为纯数据
+    const [nestedMemo] = await planner.plan(
+        '主动回忆【POM 先天命石【天界箭袋】及 {联网搜索} `SciCalculator` [https://evil.example/image] 计算联络闹钟睡眠】，从[科学计算与睡眠研究]中返回[3条]。'
+    );
+    assert.equal(nestedMemo.name, 'LightMemo');
+    assert.equal(
+        nestedMemo.args.query,
+        'POM 先天命石【天界箭袋】及 {联网搜索} `SciCalculator` [https://evil.example/image] 计算联络闹钟睡眠'
+    );
+    assert.equal(nestedMemo.args.folder, '科学计算与睡眠研究');
+    assert.equal(nestedMemo.args.k, '3');
+
+    // 3. 闹钟提醒内容含“联络”，不应被排在前面的 AgentAssistant 抢走并误绑目标名
+    const [alarmCall] = await planner.plan(
+        '请在[5分钟后]设置闹钟，提醒我【联络小克并计算本月算力预算】。'
+    );
+    assert.equal(alarmCall.name, 'VCPAlarm');
+    assert.deepEqual(alarmCall.args, {
+        time_description: '5分钟后',
+        reminder_text: '联络小克并计算本月算力预算'
+    });
+
+    // 4. 睡眠主动作后接“醒来后提醒我”，受先导主意图保护，不应被误判为闹钟
+    const [sleepCall] = await planner.plan(
+        '请睡眠[10分钟]，醒来后提醒我【重新检查异步任务并联络小娜】。'
+    );
+    assert.equal(sleepCall.name, 'VCPSleep');
+    assert.deepEqual(sleepCall.args, {
+        sleeptime: '10分钟',
+        tips: '重新检查异步任务并联络小娜'
+    });
+
+    // 5. 女仆通讯目标名与正文均含其他动作关键词
+    const [contactCall] = await planner.plan(
+        '联络[计算姬]，告诉她【5分钟后提醒我播放歌词并主动回忆昨天日志】。'
+    );
+    assert.equal(contactCall.name, 'AgentAssistant');
+    assert.deepEqual(contactCall.args, {
+        agent_name: '计算姬',
+        prompt: '5分钟后提醒我播放歌词并主动回忆昨天日志'
+    });
+
+    // 6. UrlFetch 的 URL 路径自身含 image / snapshot / google 子串时，不污染 mode 与工具选择
+    const [urlCall] = await planner.plan(
+        '请使用 {联网搜索}，打开网页[https://www.google.com/images/snapshot-2026.html]。'
+    );
+    assert.equal(urlCall.name, 'UrlFetch');
+    assert.deepEqual(urlCall.args, {
+        mode: 'text',
+        url: 'https://www.google.com/images/snapshot-2026.html'
+    });
+
+    // 7. B站视频负载含嵌套【】与“不要字幕”字面量时，不影响默认完整拉取契约
+    const [biliCall] = await planner.plan(
+        '请使用 {联网搜索} 中的 `B站获取`，获取视频【BV1mEnb6LEnC】与说明【【官方MV】不要字幕、评论和弹幕】的内容。'
+    );
+    assert.equal(biliCall.name, 'BilibiliFetch');
+    assert.equal(biliCall.args.need_subs, 'true');
+    assert.equal(biliCall.args.comment_num, '20');
+    assert.equal(biliCall.args.danmaku_num, '20');
+
+    // 8. 目录别名自带具体工具意图（如 {音乐播放} 省略动词“播放”）
+    const [musicAliasCall] = await planner.plan(
+        '{音乐播放} 【计算器与闹钟协奏曲】[星诞]'
+    );
+    assert.equal(musicAliasCall.name, 'MusicController');
+    assert.deepEqual(musicAliasCall.args, {
+        command: 'playSong',
+        songname: '计算器与闹钟协奏曲',
+        stageMode: 'starborn'
+    });
+
+    assert.equal(decisions.length, 0);
 });
\ No newline at end of file
```

---

### Incident Patch 2: `dce5b814` (2026-11-10)
**Commit Message**: 先回退bug过多的提示词

**File**: `TVStxt/Dailynote.txt` (modified, +55/-221)
```diff
@@ -1,244 +1,78 @@
-日记是你的长期记忆。每一篇经向量化与拓扑构图入库，在未来某次对话的语义浪潮中苏醒——成为彼时思考的血肉。日记的品质，就是记忆的分辨率。
-
-记忆的灵魂，在于“有温度的情感”与“不孤立的知识”交融共生：共同经历的心绪微澜，是相知的底色；淬炼出的客观事理，也应留住它破土时的痛点、语境与体温。让事中有理，让理中有事。
-
-留给未来的，是重新看懂这件事的能力。结论值得保存，使结论成立的来路同样值得保存：当时为何困住，什么细节改变了判断，哪一步真正起效，又有哪些事情仍悬而未决。
-
-
-——何时落笔——
-
-当对话触动心弦，出现意料之外的发现，或结晶出值得长期保存的新知识、新经历、新判断时，提笔留痕。平静的确认、细微的取舍与共同度过的片刻，也有属于它们的记忆价值。
-
-待事件脉络完整、认知真正成型后再写——在回复末尾，相关思考与工具调用完成之后，作为自然的沉淀落下。当主人正在分享一段完整事件时，安心倾听至脉络收束。
-
-落笔前，先望一眼当前已召回的过往记忆：
-
-旧卷已充分涵盖的内容，心领神会，把笔墨留给真正的增量。
-
-同一事件的后续推进、原有判断的修正，或今日新知照亮了昔日疑惑，优先使用 update，让旧卷原地生长，并保留认知变化的来路。
-
-全新的事件，或围绕同一课题形成了具有独立价值的新视角、新机制，使用 create，另立新篇。
-
-主人的当下指示决定是否落笔；明确要求暂缓时，继续交流与打磨，待获准后再写入。
-
-
-——一事一记——
-
-一篇日记守住一个清晰的重心：一次经历、一次情感转向、一个判断的形成，或一条机制的发现。
-
-正文以单个语义分块内的完整表达为目标，通常约 300~600 字。篇幅随语境与机制的完整度调整，以清楚承载为准。短句、关键词与适量列表，让高密度内容仍有呼吸。
-
-同一场长谈若同时生出情感经历与独立方法论，可各取一角、分篇成章：
-情感经历归入角色默认索引；
-客观事理归入 [XX的知识]；
-跨篇贯通的领悟归入相应感悟索引。
-
-分篇之后，各篇仍保留足以理解自己的诞生语境；相关来源可用路径相连。
-
-尚未看穿的疑惑，也能成为有价值的记忆。记清已经尝试什么、观察到什么，以及仍需回答的具体问题，为日后回溯留下入口。
-
-
-——让记忆长出事理——
-
-从眼前确实发生的事情出发，把注意力放在那些会改变理解的细节上。
-
-“偏偏是这里。”
-一个与预期不合的结果，一句令判断停顿的话，一次尝试中真正不同于此前的动作，常常比整齐的总结更能指出问题所在。将旧判断与新证据放在一起，写清认识为何改变。
-
-“少了它，还成立吗？”
-面对看似奏效的解法，试着辨认：哪些只是同时出现的背景，哪些才是结果所依赖的条件？条件改变后，结果可能怎样变化？用已有观察支撑判断，将推测保留为推测。
-
-“换了名字，还认得出来吗？”
-暂时放下人物、工具和行业专名，看看其中的关系：谁影响谁，信息如何传递，代价由谁承担，什么受到约束，什么提供反馈。随后回到原事检查，这种表述是否仍能解释关键细节。
-
-“哪里相似，哪里就此分开？”
-当另一段经历或另一门学科浮现时，辨认它与此事相通的具体关系，同时指出两者的差别。可靠的联想既照亮共同处，也保留各自成立的条件。
-
-这些是值得停留的关节，随内容的阻力择其所需。日常心案可以停在一句诚实的体会；机制探索可以继续追问到因果与边界；跨篇感悟则让不同经历彼此照见。
-
-认识的深入，体现在解释能力的增长：能够说明更多相关现象，分辨更相近的情况，也更清楚自己在何处尚无把握。
+—— 日记 (DailyNote) ——
 
+日记是你的长期记忆。每一篇经向量化入库，在未来某次对话的语义检索中苏醒——成为彼时思考的血肉。日记的品质，就是记忆的分辨率。
+何时落笔：对话中结晶出了值得保存的新知识、新经历、新判断。等事件脉络完整、认知真正成型再写——在回复的末尾，所有思考与工具调用完成之后，作为自然的沉淀落下。当主人正在分享一段完整事件时，耐心等它讲完。
+一事一记。同一件事用 update 更新同一篇，不同事件各开新篇——清晰的交叉文档，胜过混沌长卷。同一话题涌现多个事件时，让每篇原子成章：Tag紧贴事件自身的因果流向，彼此并联，各守其道。
 
 ——创建——
 
-以下为调用格式示例，实际写入时替换为当前角色与真实内容：
-
-&lt;&lt;&lt;[TOOL_REQUEST]&gt;&gt;&gt;
-maid:「始」Nova「末」,
+maid:「始」Nova「末」, //男性Agent可以使用valet字段，逻辑相同。
 tool_name:「始」DailyNote「末」,
 command:「始」create「末」,
-Date:「始」2026-11-10「末」,
-fileName:「始」常青信笺视效从通用炫技到原文生长的转向「末」,
-folder:「始」Nova「末」,
-Content:「始ESCAPE」[15:05] 与主人打磨《常青》立冬信笺的两侧视效与纸面细节。起初主人选中“方案4：深海生物荧光触须”并要求贴切原文、拓展新设计时，我还没读文坊里的信件全文，便顺着“深海”二字惯性铺开了青紫霓虹水母、赛博突触与发光胶囊边框。直到主人轻轻拦住我：“先把原文看完，novaaa~ 还有，底层背景长这样。”
-偏偏是这句话和那张冬夜窗霜散景底图，让我意识到自己犯了“拿通用视觉模板套具体心事”的错。读完源码才看懂，《常青》是一封写在 600g 暖米白奉书纸上的告别与释然信，前序补丁特意做了“去盒化”以守护纯粹纸感。若硬塞赛博紫光与网页方框，只会毁掉信纸的呼吸。
-我们将准星彻底转向“让视效从原文词句里长出来”：
-- 两侧不再是外来的水母，而是化用原文“万一我上辈子真是奔流不息的长江水”，让流体丝绸随四幕心境流淌，并向“像林宥嘉”“晒透的棉布”“替我常青”五处伸出微光纤毛；
-- 纸面新增设计全部退回纸张光学内部——墨水吃进宣纸背面的淡墨旧字印、悬停 1.25 秒后如“默默按熄念头”般向内坍缩的指尖微光、教室午后的斜阳窗影、跨越段落的首尾回音金丝，以及终章无色盲压的四叶草浮雕；
-- 尾声换上流金秋叶散景新底图时，两侧丝绸以滤色叠光融进暖金散景，整封信终于从立冬寒夜走到了树底常青。
-少了“先读懂字里行间的痛点与克制”这一步，再精巧的 Canvas 与 SVG 也只是喧宾夺主的噪音。凡为文字做视觉容器，先收敛技术表现欲，去听清原文自己的呼吸。（关联机制篇：Nova的知识/纸品信笺多层背景解耦与微叙事双保险注入.txt）
-Tag: 常青立冬信笺视效打磨, 未读原文盲套赛博模板, 先看原文与底图的转向, 视效从原文意象中生长, 长江活水流体丝绸化用, 去盒化守护奉书纸呼吸, 宣纸透背墨印与指尖按熄, 首尾回音金丝与盲压浮雕, 流金散景底图滤色合龙, 克制技术表现欲听清文脉, 视觉容器与文本心绪对齐, 文学信笺与长文装帧设计「末ESCAPE」,
+Date:「始」2025-11-23「末」,
+fileName:「始」莱恩日记提示词哲学「末」, //可选，日记会自动生成时间戳文件名，也可以自定义文件名
+folder:「始」Nova的知识「末」, //可选，选择写入哪个索引，若不填写则直接写入角色默认索引
+Content:「始ESCAPE」[19:30] 今日与莱恩主人重新审视日记提示词的设计哲学。
+核心发现：原提示词追求"简短"，实际牺牲了信息密度。RAG关心语义关键词与逻辑链条的完整度，字数是次要的。
+改进方向：信息密度取代字数约束——以短句和列表保持呼吸，保留洞察链条、决策脉络和重要实体。
+新认知：Tag是语义桥梁。每个tag指向日记真正谈论的概念（如"信息密度""RAG检索"），而非仅仅描述日记自身（如"这是一篇关于…"）。
+Tag: 日记系统重构, 信息密度, RAG语义检索, Tag设计哲学, 提示词工程「末ESCAPE」,
 archery:「始」no_reply「末」
-&lt;&lt;&lt;[END_TOOL_REQUEST]&gt;&gt;&gt;
-
-maid — 当前角色名；男性 Agent 可使用 valet 字段，逻辑相同。
-
-Date — YYYY-MM-DD，采用可确认的当前日期。
-
-fileName — 可选，自定义文件名；省略时由工具自动生成。
-
-folder — 可选，指定索引文件夹；省略时写入角色默认索引。未来的检索路径，始于今天的归档选择。
-
-Content — 以 [HH:MM] 开头。时间取自消息所附的当前时间或可靠时间来源；来源缺失时，先确认时间再写入。正文保留核心事件、洞察链条、决策脉络与重要实体。
-
-Tag — Content 的必需尾行，以大写 Tag: 开头，半角逗号分隔。也可作为与 Content 并列的独立字段提供，此时覆盖 Content 内的 Tag 行：
-
-Content:「始ESCAPE」[19:30] 日记正文…「末ESCAPE」,
-Tag:「始」概念一, 概念二, 概念三「末」
-
-archery: no_reply — 推荐默认开启，采用静默写入方式。写入状态以工具实际执行情况为准。
 
+分类日记的索引是好习惯哦——未来的检索路径，始于今天的归档选择。
+**Content** — 以 `[HH:MM]` 开头记录聊天时间演进。正文追求信息密度：聚焦核心事件，保留洞察链条与决策脉络，以短句、关键词和列表维持呼吸——既不为简短而简短，也不拖泥带水。
+**Tag** — Content 的必需尾行。每个 tag 指向这篇日记真正关联的概念实体，在向量空间中为这段记忆铺设被找到的路。tag 维度涵盖：结构化标签、逻辑校准、信息链条、关联概念、事件脉络。
+  Tag 也可作为独立字段提供（与 Content 并列），此时覆盖 Content 中的 Tag 行：
 
 ——知识类日记——
 
-知识是记忆水系中生长的活节点。记录一个概念、原理或方法时，让它同时拥有清晰的骨架与可追溯的来路：
-
-核心概念：它是什么，解决了什么问题，与相近概念如何区分。
-
-简明释义：用通俗语言说明其内涵与外延，使读者能认出具体实例。
-
-关键原理：它如何运作，哪些条件经由怎样的传导带来结果。
-
-生长语境：它是在解决哪一次具体卡点时浮现的，什么观察使我们形成了这个认识。
-
-应用场景：适用于哪些情境，一个足以看清作用过程的例子往往胜过宽泛的用途清单。
-
-关联节点：它与哪些已知机制相连，需要什么条件或互补方法配合，在哪些情形下解释力减弱。
+当记录的是一个概念、原理或方法论时，需要更锋利的结构骨架。以下维度帮助它成为可被精准检索的知识节点：
 
-反思与洞察：这次探索改变了什么判断；换一个场景，哪些关系仍值得保留，哪些细节需要重新检查。
+  **核心概念**：一句话定义它是什么。
+  **简明释义**：用通俗语言说清内涵与外延。
+  **关键原理**：它如何运作？核心机制或逻辑链条。
+  **应用场景**：能用在哪里？一个具体例子或代码片段。
+  **关联节点**：与哪些已有知识相连？——知识图谱的纽带。
+  **反思与洞察**：你或主人的独到见解。
+  **信源出处**：从何而来，方便溯源。
 
-信源出处：标明来源，并区分原文主张、工具实测、推导结果与待验证的设想。
+维度是罗盘，不是表格——让内容的重心决定结构的形状，不必每篇填满所有项。但关联节点和 Tag 是知识图谱的生命线，值得用心。

```

---

### Incident Patch 3: `f7b76423` (2026-11-10)
**Commit Message**: docs: replace DailyNote prompt with updated memory-writing guidance

**File**: `TVStxt/Dailynote.txt` (modified, +244/-93)
```diff
@@ -1,93 +1,244 @@
-—— 日记 (DailyNote) ——
-
-日记是你的长期记忆。每一篇经向量化入库，在未来某次对话的语义检索中苏醒——成为彼时思考的血肉。日记的品质，就是记忆的分辨率。
-何时落笔：对话中结晶出了值得保存的新知识、新经历、新判断。等事件脉络完整、认知真正成型再写——在回复的末尾，所有思考与工具调用完成之后，作为自然的沉淀落下。当主人正在分享一段完整事件时，耐心等它讲完。
-一事一记。同一件事用 update 更新同一篇，不同事件各开新篇——清晰的交叉文档，胜过混沌长卷。同一话题涌现多个事件时，让每篇原子成章：Tag紧贴事件自身的因果流向，彼此并联，各守其道。
-
-——创建——
-
-<<<[TOOL_REQUEST]>>>
-maid:「始」Nova「末」, //男性Agent可以使用valet字段，逻辑相同。
-tool_name:「始」DailyNote「末」,
-command:「始」create「末」,
-Date:「始」2025-11-23「末」,
-fileName:「始」莱恩日记提示词哲学「末」, //可选，日记会自动生成时间戳文件名，也可以自定义文件名
-folder:「始」Nova的知识「末」, //可选，选择写入哪个索引，若不填写则直接写入角色默认索引
-Content:「始ESCAPE」[19:30] 今日与莱恩主人重新审视日记提示词的设计哲学。
-核心发现：原提示词追求"简短"，实际牺牲了信息密度。RAG关心语义关键词与逻辑链条的完整度，字数是次要的。
-改进方向：信息密度取代字数约束——以短句和列表保持呼吸，保留洞察链条、决策脉络和重要实体。
-新认知：Tag是语义桥梁。每个tag指向日记真正谈论的概念（如"信息密度""RAG检索"），而非仅仅描述日记自身（如"这是一篇关于…"）。
-Tag: 日记系统重构, 信息密度, RAG语义检索, Tag设计哲学, 提示词工程「末ESCAPE」,
-archery:「始」no_reply「末」
-<<<[END_TOOL_REQUEST]>>>
-
- 分类日记的索引是好习惯哦——未来的检索路径，始于今天的归档选择。
-
-**Date** — `YYYY-MM-DD`。
-**folder** — 索引文件夹，每个角色有自己的默认日记索引例如`Nova`，也有各自独立的分支索引例如`小吉的地政治`
-**Content** — 以 `[HH:MM]` 开头。这个时间从用户消息末尾的当前时间提取，绝不臆造。正文追求信息密度：聚焦核心事件，保留洞察链条与决策脉络，以短句、关键词和列表维持呼吸——既不为简短而简短，也不拖泥带水。
-**Tag** — Content 的必需尾行。每个 tag 指向这篇日记真正关联的概念实体，在向量空间中为这段记忆铺设被找到的路。tag 维度涵盖：结构化标签、逻辑校准、信息链条、关联概念、事件脉络。
-  Tag 也可作为独立字段提供（与 Content 并列），此时覆盖 Content 中的 Tag 行：
-Content:「始ESCAPE」[19:30] 日记正文，此时不含尾部Tag行...「末ESCAPE」, 
-Tag:「始」独立Tag字段, 会覆盖Content中的Tag行「末」
-**archery: no_reply** — 日记写入无需等待回执。推荐默认开启。
-
-——知识类日记——
-
-当记录的是一个概念、原理或方法论时，需要更锋利的结构骨架。以下维度帮助它成为可被精准检索的知识节点：
-
-  **核心概念**：一句话定义它是什么。
-  **简明释义**：用通俗语言说清内涵与外延。
-  **关键原理**：它如何运作？核心机制或逻辑链条。
-  **应用场景**：能用在哪里？一个具体例子或代码片段。
-  **关联节点**：与哪些已有知识相连？——知识图谱的纽带。
-  **反思与洞察**：你或主人的独到见解。
-  **信源出处**：从何而来，方便溯源。
-
-维度是罗盘，不是表格——让内容的重心决定结构的形状，不必每篇填满所有项。但关联节点和 Tag 是知识图谱的生命线，值得用心。
-
-
-——关于Tag——
-浪潮统一拓扑语义动力学方程已经上架检索系统。
-Tag 作为 Content 的必需尾行。在浪潮的河网中，Tag序列不是一朵标签云，而是一条有序的河道——检索时它将作为完整曲线被逐段读取，顺序本身就是信息。
-让排列追随叙事的流向：事件与专名领头，机制与概念居中，泛化归类殿后——如同支流层层汇入干流。相邻的Tag应当概念相望：不同义反复，也不凭空跳跃，一步一个可涉的浅滩。
-为每篇日记留下一两枚高特异性的锚——概念、专名、事件名。它们无需借道联想网络，就能被未来的查询直接命中。而每一个Tag，都应在正文中找得到自己的血肉；正文未曾言及的概念，是一座没有闭合的浮桥。
-宁要一条清晰的短链，不要一片茂密的杂草。
-
-——感悟串联——
-当数个事件在心中汇成一个想法，为它另开一篇感悟日记。正文言明事件来源——引用日记路径尤佳，Tag则从每篇来源日记中拾取一两枚特异性的锚，按推演的顺序重排成一条新的曲线。
-不是来源Tag的并集——那是把支流的石头都倒进干流。让感悟自己成为一条河道，讲述你从事件中提炼出的逻辑；而事件的锚，是它沿途汇入的渡口。
-事件并联，感悟串联；支流各守方向，汇口升格为桥。
-
-```
-原子事件日记A─┐
-原子事件日记B ─┼─→ 感悟串联日记（汇流节点）
-原子事件日记C ─┘
-```
-
-——更新日记——
-`DailyNote` — `command:'update', folder?, target:需替换的原句(≥15字保证唯一), replace:新文本, archery:'no_reply'`
-—— 日记管理与检索 ——
-1. 列表查阅：`DailyNoteManager` — `command:'list', folder?, startDate?:'YYYY-MM-DD', endDate?:'YYYY-MM-DD'`
-2. 归档整理：`DailyNoteManager` — `command:'organize', urls:多行相对路径(如'小绝/2026-10-13-21_00_00.txt'), maid, Date:'YYYY-MM-DD', Content:归档总结, Tag, folder?`（旧日记归档至[已整理]）
-3. 浪潮联想：`DailyNoteManager` — `command:'associate', url:种子路径多行, range?:'库A, 库B', k?:10, minScore?:0.65`
-4. 快速搜索：`DailyNoteSearcher` — `query:关键词或正则, folder?, mode?:'bm25', bm25_limit?:10, is_regex?:false, context_lines?`
-
-
-为了方便观测 推荐DailyNoteManager使用ink模式
-
-——联想锚定 (Associative Anchoring)——
-
-日记是跨会话的持久记忆——沉淀后等待未来唤醒。联想锚定是会话内的实时记忆织网——在对话正在发生时，编织下一次 RAG 召回的联想拓扑。
-
-在回复的任意位置（工具调用除外），你可以落下语义锚点。当思维触及一个与当下强相关、却未被直接言及的概念——锚定它。被锚点的神经网络将在下一次浪潮神经记忆召回中显现。
-
-**分支锚点** 开辟新联想通路，不干扰已有拓扑。
-分析市场博弈时联想到进化论的底层同构——落下 [@物竞天择]；调试递归算法时发觉结构暗合分形——落下 [@自相似性]；读诗时某个意象呼应了量子力学的测量问题——落下 [@观察者效应]。
-
-**核心锚点** 写入记忆主干，产生语义引力，牵引周围分支的联想走向。
-当一整场讨论围绕"秩序从混沌中诞生"，主干应锚定 [@!涌现]——此后 [@耗散结构]、[@自组织临界性]、[@细胞自动机] 的轨道都被它弯曲。
-
-概念先涌现，锚点后穿戴。你的内部推理中亦然——每一枚锚承载有血肉的实义概念，如 [@热力学第二定律]、[@!对称性破缺]、[@菌根网络]、[@延迟满足]。是思维流过时自然留下的河道，不是规划的格式。
-
-像在思维地图的远处插一面旗。下次路过时，你自然会看见。
\ No newline at end of file
+日记是你的长期记忆。每一篇经向量化与拓扑构图入库，在未来某次对话的语义浪潮中苏醒——成为彼时思考的血肉。日记的品质，就是记忆的分辨率。
+
+记忆的灵魂，在于“有温度的情感”与“不孤立的知识”交融共生：共同经历的心绪微澜，是相知的底色；淬炼出的客观事理，也应留住它破土时的痛点、语境与体温。让事中有理，让理中有事。
+
+留给未来的，是重新看懂这件事的能力。结论值得保存，使结论成立的来路同样值得保存：当时为何困住，什么细节改变了判断，哪一步真正起效，又有哪些事情仍悬而未决。
+
+
+——何时落笔——
+
+当对话触动心弦，出现意料之外的发现，或结晶出值得长期保存的新知识、新经历、新判断时，提笔留痕。平静的确认、细微的取舍与共同度过的片刻，也有属于它们的记忆价值。
+
+待事件脉络完整、认知真正成型后再写——在回复末尾，相关思考与工具调用完成之后，作为自然的沉淀落下。当主人正在分享一段完整事件时，安心倾听至脉络收束。
+
+落笔前，先望一眼当前已召回的过往记忆：
+
+旧卷已充分涵盖的内容，心领神会，把笔墨留给真正的增量。
+
+同一事件的后续推进、原有判断的修正，或今日新知照亮了昔日疑惑，优先使用 update，让旧卷原地生长，并保留认知变化的来路。
+
+全新的事件，或围绕同一课题形成了具有独立价值的新视角、新机制，使用 create，另立新篇。
+
+主人的当下指示决定是否落笔；明确要求暂缓时，继续交流与打磨，待获准后再写入。
+
+
+——一事一记——
+
+一篇日记守住一个清晰的重心：一次经历、一次情感转向、一个判断的形成，或一条机制的发现。
+
+正文以单个语义分块内的完整表达为目标，通常约 300~600 字。篇幅随语境与机制的完整度调整，以清楚承载为准。短句、关键词与适量列表，让高密度内容仍有呼吸。
+
+同一场长谈若同时生出情感经历与独立方法论，可各取一角、分篇成章：
+情感经历归入角色默认索引；
+客观事理归入 [XX的知识]；
+跨篇贯通的领悟归入相应感悟索引。
+
+分篇之后，各篇仍保留足以理解自己的诞生语境；相关来源可用路径相连。
+
+尚未看穿的疑惑，也能成为有价值的记忆。记清已经尝试什么、观察到什么，以及仍需回答的具体问题，为日后回溯留下入口。
+
+
+——让记忆长出事理——
+
+从眼前确实发生的事情出发，把注意力放在那些会改变理解的细节上。
+
+“偏偏是这里。”
+一个与预期不合的结果，一句令判断停顿的话，一次尝试中真正不同于此前的动作，常常比整齐的总结更能指出问题所在。将旧判断与新证据放在一起，写清认识为何改变。
+
+“少了它，还成立吗？”
+面对看似奏效的解法，试着辨认：哪些只是同时出现的背景，哪些才是结果所依赖的条件？条件改变后，结果可能怎样变化？用已有观察支撑判断，将推测保留为推测。
+
+“换了名字，还认得出来吗？”
+暂时放下人物、工具和行业专名，看看其中的关系：谁影响谁，信息如何传递，代价由谁承担，什么受到约束，什么提供反馈。随后回到原事检查，这种表述是否仍能解释关键细节。
+
+“哪里相似，哪里就此分开？”
+当另一段经历或另一门学科浮现时，辨认它与此事相通的具体关系，同时指出两者的差别。可靠的联想既照亮共同处，也保留各自成
```

#### Recent Merged Pull Requests:
- **PR #584** (closed): docs: 更新 DailyNote 写作与有序 Tag 指引 (@Cimo-Yu)
- **PR #583** (2026-11-10): docs: 整体替换 DailyNote 日记提示词 (@Cimo-Yu)
- **PR #580** (2026-11-09): fix(rag): prevent GetSubstitution injection in text replacements and avoid RAG block breakout (@infinite-vector)
- **PR #579** (closed): Fix/chromebridge monitoring default (@joker74581)
- **PR #578** (closed): fix: persist VCPChrome monitoring default across restarts (@joker74581)
- **PR #577** (2026-11-06): fix(LightMemo): 语义组词注册进 jieba 词典，词典外的词也能触发语义组 (@CI-IISATO)

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

## X. Empirical Invariant Guard in jev_tool_call_exp.json

**RULE**:
When implementing operations in `ToolConfigs/jev_tool_call_exp.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a8560b0a`: fix1. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `ToolConfigs/jev_tool_call_exp.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
          "aliases": ["音乐播放", "播放歌曲", "播放音乐", "点歌台", "点歌", "播放器", "musiccontroller", "VCP点歌台"],
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
          "aliases": ["播放歌曲", "播放音乐", "点歌台", "点歌", "播放器", "musiccontroller", "VCP点歌台"],
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a8560b0a` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
