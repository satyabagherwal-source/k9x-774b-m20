# Forensic Learning Record (Deep Inspection): xvirobotics/metabot

> **Canonical Artifact**: `07_PROJECT_LEARNING/xvirobotics-metabot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xvirobotics/metabot](https://github.com/xvirobotics/metabot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:41:47.519Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xvirobotics/metabot`
- **Description**: 构建受监督的、自我进化的 Agent 组织的基础设施 | Infrastructure for supervised, self-improving agent organization. 飞书/Telegram 手机端运行 Claude Code 或 Kimi Code（双引擎，两家原生订阅直接用），共享记忆、Agent 工厂、定时任务、通信总线。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 990 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cli-core/src/args.ts`
```
export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | true>;
}

/**
 * Light argparse. Supports `--name value`, `--name=value`, and `-n value`.
 * `--` ends flag parsing.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  let i = 0;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq >= 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
        i++;
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          flags[a.slice(2)] = next;
          i += 2;
        } else {
          flags[a.slice(2)] = true;
          i++;
        }
      }
    } else if (a.startsWith('-') && a.length > 1) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags[a.slice(1)] = next;
        i += 2;
      } else {
        flags[a.slice(1)] = true;
        i++;
      }
    } else {
      positional.push(a);
      i++;
    }
  }
  return { positional, flags };
}

```

### Core Architecture Module: `packages/cli-core/src/client.ts`
```
import type { Config } from './config.js';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

export interface ClientError extends Error {
  status: number;
  body: unknown;
}

function buildUrl(base: string, p: string, query?: RequestOptions['query']): string {
  const url = new URL(base + p);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

export async function request<T = unknown>(
  cfg: Config,
  opts: RequestOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const url = buildUrl(cfg.url, opts.path, opts.query);
  const method = opts.method || 'GET';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/json',
  };
  let body: string | undefined;
  if (opts.body !== undefined && opts.body !== null) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetchImpl(url, { method, headers, body });
  const text = await res.text();
  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // leave as raw text
    }
  }
  if (!res.ok) {
    const errMsg =
      typeof parsed === 'object' && parsed && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : String(parsed);
    const e = new Error(`metabot-core ${method} ${opts.path} → ${res.status}: ${errMsg}`) as ClientError;
    e.status = res.status;
    e.body = parsed;
    throw e;
  }
  return parsed as T;
}

```

### Core Architecture Module: `packages/cli-core/src/config.ts`
```
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Personal edition default: a metabot-core server running locally. Override
// with METABOT_CORE_URL to point at a remote/self-hosted host.
export const DEFAULT_URL = 'http://localhost:9200';

export interface Config {
  url: string;
  token: string;
}

function readFirstLine(p: string): string | null {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const line = raw.split(/\r?\n/)[0]?.trim();
    return line && line.length > 0 ? line : null;
  } catch {
    return null;
  }
}

export function tokenFilePath(): string {
  return path.join(os.homedir(), '.metabot-core', 'token');
}

export function adminBootstrapTokenFilePath(): string {
  return path.join(os.homedir(), '.metabot-core', 'data', 'admin-bootstrap-token.txt');
}

/**
 * Resolve URL + token.
 *
 * URL precedence:   METABOT_CORE_URL → DEFAULT_URL.
 * Token precedence: METABOT_CORE_TOKEN → ~/.metabot-core/token (first line)
 *                  → metabot-core bootstrap token (first line).
 *
 * Throws when no token is configured.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const url = (env.METABOT_CORE_URL || DEFAULT_URL).replace(/\/+$/, '');
  let token = (env.METABOT_CORE_TOKEN || '').trim();
  if (!token) {
    const fromFile = readFirstLine(tokenFilePath());
    if (fromFile) token = fromFile;
  }
  if (!token) {
    const fromBootstrapFile = readFirstLine(adminBootstrapTokenFilePath());
    if (fromBootstrapFile) token = fromBootstrapFile;
  }
  if (!token) {
    throw new Error(
      `no token configured — set METABOT_CORE_TOKEN env var, write the token to ${tokenFilePath()}, or start metabot-core once to generate ${adminBootstrapTokenFilePath()}`,
    );
  }
  return { url, token };
}

```

### Core Architecture Module: `packages/cli-core/src/index.ts`
```
export * from './config.js';
export * from './client.js';
export * from './args.js';
export * from './print.js';

```

### Core Architecture Module: `packages/cli-core/src/print.ts`
```
/**
 * Print `body` to stdout. Strings get a trailing newline if missing;
 * everything else is pretty-printed JSON.
 */
export function print(body: unknown): void {
  if (typeof body === 'string') {
    process.stdout.write(body);
    if (!body.endsWith('\n')) process.stdout.write('\n');
  } else {
    process.stdout.write(JSON.stringify(body, null, 2) + '\n');
  }
}

```

### Core Architecture Module: `packages/web-ui/src/components/t5t/board-utils.ts`
```
import type { ProjectSummary } from '../../lib/api';

/**
 * Stable, read-only projection of the Personal Edition's company core.
 * These anchors intentionally live in presentation code: they do not create
 * a second persisted hierarchy or alter T5T ownership semantics.
 */
export const CORE_PORTFOLIO_SLUGS = [
  'wbc',
  'vlm-brain',
  'g1-wuji-teleoperation',
  'humanoid-foundation',
  'matrix-agentvla',
  'xviinfra',
  'metabot',
] as const;

const CORE_PORTFOLIO_SET = new Set<string>(CORE_PORTFOLIO_SLUGS);

export function corePortfolioProjects(projects: ProjectSummary[]): ProjectSummary[] {
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  return CORE_PORTFOLIO_SLUGS.flatMap((slug) => {
    const project = bySlug.get(slug);
    return project ? [project] : [];
  });
}

export function isCorePortfolioProject(project: ProjectSummary): boolean {
  return CORE_PORTFOLIO_SET.has(project.slug);
}

```

### Core Architecture Module: `packages/web-ui/src/lib/render-html.tsx`
```
import { useEffect, useRef, useState } from 'react';

interface Props {
  content: string;
  title?: string;
}

/**
 * Render stored HTML inside a sandboxed iframe via srcDoc.
 * Deliberately omits `allow-scripts` — stored HTML is data, not code.
 *
 * Includes a toolbar with a fullscreen toggle. In fullscreen the iframe
 * fills the viewport (CSS `position: fixed; inset: 0`); ESC exits.
 */
export function HtmlDocFrame({ content, title }: Props) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Auto-height the iframe to match its body — only when NOT fullscreen.
  // In fullscreen mode CSS forces height: 100%, so JS resizing would fight it.
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    if (fullscreen) {
      iframe.style.height = '';
      return;
    }
    const resize = () => {
      try {
        const h = iframe.contentDocument?.body?.scrollHeight;
        if (h && h > 0) iframe.style.height = `${Math.min(h + 16, 4000)}px`;
      } catch { /* cross-origin shouldn't happen with srcdoc, but be defensive */ }
    };
    iframe.addEventListener('load', resize);
    const t = window.setTimeout(resize, 100);
    return () => {
      iframe.removeEventListener('load', resize);
      window.clearTimeout(t);
    };
  }, [content, fullscreen]);

  // ESC exits fullscreen; lock body scroll so background page doesn't shift.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setFullscreen(false); }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  return (
    <div className={`doc-iframe-wrap${fullscreen ? ' fullscreen' : ''}`}>
      <div className="doc-iframe-toolbar">
        {fullscreen && <span className="fs-title">{title || 'document'}</span>}
        <button
          type="button"
          className="doc-iframe-btn"
          onClick={() => setFullscreen((f) => !f)}
          title={fullscreen ? 'exit fullscreen  ( esc )' : 'fullscreen'}
          aria-label={fullscreen ? 'exit fullscreen' : 'fullscreen'}
          aria-pressed={fullscreen}
        >
          <span className="icon">{fullscreen ? '✕' : '⛶'}</span>
          <span>{fullscreen ? 'close' : 'fullscreen'}</span>
        </button>
      </div>
      <iframe
        ref={ref}
        title="document"
        srcDoc={content}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="doc-iframe"
      />
    </div>
  );
}

```

### Core Architecture Module: `packages/web-ui/src/lib/render-markdown.ts`
```
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

// For server-supplied snippets that already include <mark>...</mark> highlight tags.
export function renderSafeSnippet(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['mark'],
  });
}

```

### Core Architecture Module: `src/api/routes/core-chat-routes.ts`
```
import type * as http from 'node:http';
import { jsonResponse, parseJsonBody } from './helpers.js';
import type { RouteContext } from './types.js';
import type { ApiTaskResult } from '../../bridge/message-bridge.js';
import type { OutputFile } from '../../bridge/outputs-manager.js';
import type { EngineName } from '../../engines/index.js';
import type { CardState, PendingQuestion } from '../../types.js';
import { resolveSTTProvider, resolveTTSProvider, resolveTTSVoice } from '../voice-handler.js';

const CORE_CHAT_RUN_PREFIX = '/api/core-chat/runs';
const CORE_CHAT_CAPABILITIES_PATH = '/api/core-chat/capabilities';
const CALLBACK_RETRY_ATTEMPTS = 3;
const CALLBACK_RETRY_DELAY_MS = 250;
const DEFAULT_QUESTION_TIMEOUT_MS = 15 * 60 * 1000;

type CoreChatRunStatus = 'running' | 'completed' | 'failed' | 'canceled';
type CoreChatEventType = 'state' | 'question' | 'file' | 'log' | 'complete' | 'error';

interface PendingCoreChatQuestion {
  toolUseId: string;
  resolve: (answerJson: string) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface CoreChatRunRecord {
  runId: string;
  targetBot: string;
  executionChatId: string;
  eventCallbackUrl: string;
  status: CoreChatRunStatus;
  dispatcher?: CoreChatEventDispatcher;
  pendingQuestion?: PendingCoreChatQuestion;
}

export interface CoreChatRunRequest {
  runId: string;
  conversationId: string;
  triggerMessageId: string;
  targetBot: string;
  prompt: string;
  eventCallbackUrl: string;
  executionChatId?: string;
  userId?: string;
  engine?: EngineName;
  model?: string;
  presentation?: {
    mode: 'child-direct' | 'origin-proxy';
    chatId: string;
    targetAgentRef: string;
    requestedBy: string;
    originBotName?: string;
    wakeLead?: boolean;
  };
  maxTurns?: number;
  allowedTools?: string[];
  voice?: {
    announceCapabilities?: boolean;
    tts?: boolean;
    ttsProvider?: string;
    ttsVoice?: string;
  };
  metadata?: {
    groupId?: string;
    groupMembers?: string[];
  };
}

interface CoreChatEvent {
  runId: string;
  seq: number;
  type: CoreChatEventType;
  createdAt: string;
  bridge: {
    botName: string;
    executionChatId: string;
  };
  payload: Record<string, unknown>;
}

const activeCoreChatRuns = new Map<string, CoreChatRunRecord>();

class CoreChatTerminalStateError extends Error {
  readonly state: CardState;
  readonly bridgeMessageId: string | undefined;

  constructor(message: string, state: CardState, bridgeMessageId: string | undefined) {
    super(message);
    this.name = 'CoreChatTerminalStateError';
    this.state = state;
    this.bridgeMessageId = bridgeMessageId;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return strings.length === value.length ? strings : undefined;
}

function asEngineName(value: unknown): EngineName | undefined {
  return value === 'claude' || value === 'kimi' || value === 'codex' ? value : undefined;
}

function sanitizeChatIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 160);
}

function defaultExecutionChatId(conversationId: string, targetBot: string): string {
  return `core-${sanitizeChatIdPart(conversationId)}-${sanitizeChatIdPart(targetBot)}`;
}

function questionAnswerJson(answer: string): string {
  return JSON.stringify({ answers: { _web: answer } });
}

function questionTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.METABOT_CORE_CHAT_QUESTION_TIMEOUT_MS || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUESTION_TIMEOUT_MS;
}

function validateCallbackUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseCoreChatRunRequest(body: Record<string, unknown>): { request?: CoreChatRunRequest; error?: string } {
  const runId = asString(body.runId);
  const conversationId = asString(body.conversationId);
  const triggerMessageId = asString(body.triggerMessageId);
  const targetBot = asString(body.targetBot);
  const prompt = asString(body.prompt);
  const eventCallbackUrl = asString(body.eventCallbackUrl);

  if (!runId || !conversationId || !triggerMessageId || !targetBot || !prompt || !eventCallbackUrl) {
    return { error: 'Missing required fields: runId, conversationId, triggerMessageId, targetBot, prompt, eventCallbackUrl' };
  }
  if (!validateCallbackUrl(eventCallbackUrl)) {
    return { error: 'Invalid eventCallbackUrl' };
  }

  const metadata = typeof body.metadata === 'object' && body.metadata !== null
    ? body.metadata as Record<string, unknown>
    : undefined;
  const maxTurns = typeof body.maxTurns === 'number' && Number.isFinite(body.maxTurns)
    ? body.maxTurns
    : undefined;
  const voice = typeof body.voice === 'object' && body.voice !== null
    ? body.voice as Record<string, unknown>
    : undefined;
  const rawPresentation = typeof body.presentation === 'object' && body.presentation !== null
    ? body.presentation as Record<string, unknown>
    : undefined;
  const presentationMode: 'child-direct' | 'origin-proxy' | undefined =
    rawPresentation?.mode === 'child-direct' || rawPresentation?.mode === 'origin-proxy'
      ? rawPresentation.mode
      : undefined;
  const presentationChatId = asString(rawPresentation?.chatId);
  const presentationTarget = asString(rawPresentation?.targetAgentRef);
  const presentationRequestedBy = asString(rawPresentation?.requestedBy);
  const presentation =
    (presentationMode === 'child-direct' || presentationMode === 'origin-proxy') &&
    presentationChatId && presentationTarget && presentationRequestedBy
      ? {
          mode: presentationMode,
          chatId: presentationChatId,
          targetAgentRef: presentationTarget,
          requestedBy: presentationRequestedBy,
          originBotName: asString(rawPresentation?.originBotName),
          wakeLead: rawPresentation?.wakeLead !== false,
        }
      : undefined;

  return {
    request: {
      runId,
      conversationId,
      triggerMessageId,
      targetBot,
      prompt,
      eventCallbackUrl,
      executionChatId: asString(body.executionChatId),
      userId: asString(body.userId),
      engine: asEngineName(body.engine),
      model: asString(body.model),
      presentation,
      maxTurns,
      allowedTools: asStringArray(body.allowedTools),
      voice: voice ? {
        announceCapabilities: voice.announceCapabilities === true,
        tts: voice.tts === true,
        ttsProvider: asString(voice.ttsProvider),
        ttsVoice: asString(voice.ttsVoice),
      } : undefined,
      metadata: metadata ? {
        groupId: asString(metadata.groupId),
        groupMembers: asStringArray(metadata.groupMembers),
      } : undefined,
    },
  };
}

function callbackAuthHeaders(): Record<string, string> {
  const token = process.env.METABOT_CORE_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postCoreChatRunEvent(
  callbackUrl: string,
  event: CoreChatEvent,
  options?: { attempts?: number; retryDelayMs?: number; fetchImpl?: typeof fetch },
): Promise<void> {
  const attempts = options?.attempts ?? CALLBACK_RETRY_ATTEMPTS;
  const retryDelayMs = options?.retryDelayMs ?? CALLBACK_RETRY_DELAY_MS;
  const fetchImpl = options?.fetchImpl ?? fetch;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...callbackAuthHeaders(),
        },
        body: JSON.stringify(event),
      });
      if (response.ok) return;
      const text = await response.text().catch(() => '');
      lastError = new Error(`core callback failed with HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < attempts) {
      await sleep(retryDelayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('core callback failed');
}

class CoreChatEventDispatcher {
  private nextSeq = 1;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly callbackUrl: string,
    private readonly runId: string,
    private readonly botName: string,
    private readonly executionChatId: string,
    private readonly logger: RouteContext['logger'],
  ) {}

  enqueue(type: CoreChatEventType, payload: Record<string, unknown>): void {
    const event = this.buildEvent(type, payload);
    this.chain = this.chain
      .then(() => postCoreChatRunEvent(this.callbackUrl, event))
      .catch((err) => {
        this.logger.warn({ err, runId: this.runId, seq: event.seq, type }, 'Core chat callback failed');
      });
  }

  async send(type: CoreChatEventType, payload: Record<string, unknown>): Promise<void> {
    const event = this.buildEvent(type, payload);
    this.chain = this.chain.then(() => postCoreChatRunEvent(this.callbackUrl, event));
    await this.chain;
  }

  async drain(): Promise<void> {
    await this.chain;
  }

  private buildEvent(type: CoreChatEventType, payload: Record<string, unknown>): CoreChatEvent {
    return {
      runId: this.runId,
      seq: this.nextSeq++,
      type,
      createdAt: new Date().toISOString(),
      bridge: {
        botName: this.botName,
        executionChatId: this.executionChatId,
      },
      payload,
    };
  }
}

function waitForCoreChatAnswer(runId: string, toolUseId: string): Promise<string> {
  return new Promise((resolve)
```

### Core Architecture Module: `src/engines/claude/executor-registry.ts`
```
/**
 * EXPERIMENTAL — Stage 2.
 *
 * ExecutorRegistry — manages a pool of {@link PersistentClaudeExecutor}
 * instances keyed by chatId. Owns the lifecycle (create, evict, shutdown)
 * so the bridge can stay simple.
 *
 * Eviction strategy:
 *   - LRU when at `maxConcurrent` capacity
 *   - Each executor self-shuts after `idleTimeoutMs` of silence
 *   - Unhealthy executors (closed / crashed) are auto-replaced on next acquire
 *   - Registry removes executors from its map when their 'closed' event fires
 *
 * Crash recovery (registry-level):
 *   The executor self-restarts on transient SDK/PTY stream errors (capped, see
 *   PersistentClaudeExecutor.maybeRestart). When that budget is exhausted it
 *   ends in 'closed' having emitted 'crashed' first. Rather than discard the
 *   pool slot immediately — which would lose all Agent-Team teammates and any
 *   in-progress work, and route the next acquire to a vanilla fresh executor —
 *   the registry KEEPS the crashed entry parked in the pool (its last sessionId
 *   captured for resume) and respawns it on the next acquire / between-turn
 *   attempt, with its own exponential backoff and a respawn cap. Only after the
 *   registry-level respawn budget is exhausted is the entry truly removed
 *   (delete + 'executor-removed').
 */

import { EventEmitter } from 'node:events';
import type { Logger } from '../../utils/logger.js';
import type { TeamEvent, ApiContext } from './executor.js';
import {
  PersistentClaudeExecutor,
  type PersistentExecutorOptions,
  type ExecutorState,
} from './persistent-executor.js';

const DEFAULT_MAX_CONCURRENT_PER_BOT = 20;
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** Registry-level crash respawn backoff + cap (separate from the executor's
 *  own in-process restart budget). Applied when a crashed entry is respawned
 *  on a later acquire. */
const DEFAULT_RESPAWN_BACKOFF_BASE_MS = 500;
const DEFAULT_RESPAWN_BACKOFF_MAX_MS = 30 * 1000;
const DEFAULT_MAX_RESPAWN_ATTEMPTS = 3;
/** Reset the respawn counter once a respawned executor has stayed healthy this
 *  long, so a single bad patch doesn't permanently burn the budget. */
const RESPAWN_COUNTER_RESET_MS = 5 * 60 * 1000;

export interface RegistryOptions {
  logger: Logger;
  /** Max concurrent executors. LRU-evicted past this. Default 20. */
  maxConcurrent?: number;
  /** Idle timeout passed to each executor. Default 30 min. 0 disables. */
  idleTimeoutMs?: number;
  /** Default model for new executors. Per-acquire option overrides this. */
  defaultModel?: string;
  /** Default API key for new executors. */
  defaultApiKey?: string;
  /** Turn backend for new executors: 'pty' (default) or 'sdk' (legacy). */
  backend?: 'sdk' | 'pty';
  /**
   * Max registry-level respawns of a crashed executor before its pool slot is
   * truly removed. Distinct from the executor's own in-process restart cap.
   * Default 3.
   */
  maxRespawnAttempts?: number;
}

/**
 * Per-acquire factory options. Things that can vary per chatId (cwd,
 * resumeSessionId, onTeamEvent callback) live here. Pool-wide defaults
 * live on the registry.
 */
export interface AcquireOptions {
  cwd: string;
  resumeSessionId?: string;
  onTeamEvent?: (event: TeamEvent) => void;
  /** Override per-acquire model (else uses registry default). */
  model?: string;
  /** MetaBot bot/chat context baked into the executor's system prompt. */
  apiContext?: ApiContext;
  /** Stable per-chat outputs directory. */
  outputsDir?: string;
}

interface PoolEntry {
  executor: PersistentClaudeExecutor;
  /** For LRU bumping; insertion order in the Map encodes recency. */
  chatId: string;
  /**
   * Effective model this executor was spawned with (`opts.model ?? defaultModel`).
   * The model binds at spawn (interactive `claude --model` / SDK queryOptions),
   * so when a later acquire requests a DIFFERENT model the executor must be
   * respawned — see {@link ExecutorRegistry.acquire}.
   */
  model?: string;
  /**
   * Per-acquire options this entry was last spawned with. Captured so a crashed
   * entry can be respawned (resuming its session) without the caller having to
   * re-supply cwd / onTeamEvent / apiContext / outputsDir.
   */
  acquireOpts: AcquireOptions;
  /**
   * True once the executor has emitted 'crashed' and its in-process restart
   * budget is exhausted (terminal 'closed' after a crash). A crashed entry is
   * KEPT in the pool (not deleted) so the next acquire can respawn it with the
   * last sessionId, preserving teammates / in-progress work.
   */
  crashed: boolean;
  /**
   * True once the executor emitted 'crashed' at least once during its life,
   * regardless of whether it later self-recovered. The terminal 'closed'
   * handler reads this to distinguish a crash-exhausted close (park slot for
   * respawn) from a clean idle/graceful close (remove slot). Reset to false on
   * each respawn so a recovered-then-cleanly-closed executor isn't mis-parked.
   */
  crashedFlagSeen?: boolean;
  /** Last sessionId observed before the crash, used as resume target. */
  resumeSessionId?: string;
  /** Registry-level respawn attempts spent on this slot since last reset. */
  respawnAttempts: number;
  /** Wall-clock floor before the next respawn is allowed (backoff gate). */
  nextRespawnAt: number;
  /** When the executor last became healthy (used to reset respawnAttempts). */
  healthySince: number;
}

export class ExecutorRegistry extends EventEmitter {
  private executors = new Map<string, PoolEntry>();
  /**
   * In-flight graceful shutdowns by chatId. {@link release} adds an entry
   * before it kicks off the shutdown await, and removes it once the
   * shutdown resolves. {@link acquire} consults this map first: if a
   * shutdown is in flight for the chatId, it awaits completion before
   * inspecting the executors map.
   *
   * Without this, a fast \`/reset\` followed by a new user message would
   * see {@link release}'s `executors.delete()` already done, fall through
   * to the "create new" branch, and end up with two executors for the
   * same chatId in flight — the old one still sending spontaneous-message
   * callbacks into the new card while it shuts down.
   */
  private pendingShutdowns = new Map<string, Promise<void>>();
  private shuttingDown = false;

  constructor(private opts: RegistryOptions) {
    super();
  }

  /**
   * Get or create a healthy executor for chatId. Existing healthy entries
   * are LRU-bumped; closed/crashed entries are replaced. May evict the
   * least-recently-used executor when at `maxConcurrent` capacity.
   *
   * If a release() is mid-shutdown for the same chatId (e.g. a /reset
   * happened a moment ago), this waits for that shutdown to resolve
   * before creating a fresh executor — see {@link pendingShutdowns}.
   */
  async acquire(chatId: string, opts: AcquireOptions): Promise<PersistentClaudeExecutor> {
    if (this.shuttingDown) throw new Error('ExecutorRegistry: shutting down');

    // Wait out any in-flight release() for this chat, otherwise we race
    // with its delete-then-async-shutdown and risk two executors in flight.
    const pending = this.pendingShutdowns.get(chatId);
    if (pending) {
      this.opts.logger.debug({ chatId }, 'ExecutorRegistry: acquire awaiting in-flight release');
      try { await pending; } catch { /* shutdown errors are logged at the source */ }
    }

    const effectiveModel = opts.model ?? this.opts.defaultModel;
    const existing = this.executors.get(chatId);
    if (existing) {
      const state = existing.executor.getState();
      const healthy = state === 'ready' || state === 'restarting' || state === 'starting';
      if (healthy && existing.model === effectiveModel) {
        // Healthy + same model — bump LRU position
        this.executors.delete(chatId);
        this.executors.set(chatId, existing);
        return existing.executor;
      }
      if (healthy) {
        // Model changed (e.g. /model switch). The model binds at spawn, so
        // reusing this executor would keep the OLD model. Release + respawn —
        // the new executor RESUMES the same session (opts.resumeSessionId), so
        // the conversation is preserved, just continued on the new model.
        this.opts.logger.info(
          { chatId, from: existing.model, to: effectiveModel },
          'ExecutorRegistry: model changed — respawning executor',
        );
        await this.release(chatId, 'model-change');
      } else if (existing.crashed && existing.model === effectiveModel) {
        // Crashed slot — respawn in place (resuming the captured session) so
        // teammates / in-progress work survive. Honors backoff + respawn cap;
        // returns the live executor on success, or undefined once the budget
        // is exhausted (slot removed) — fall through to fresh create then.
        const respawned = await this.respawnCrashed(chatId, existing, opts);
        if (respawned) {
          this.executors.delete(chatId);
          this.executors.set(chatId, existing); // bump LRU
          return respawned;
        }
      } else {
        // Unhealthy (clean close, or crashed under a different model) — drop
        // from map (will recreate below). If the slot was a parked crash, the
        // 'closed' listener intentionally left it in place, so emit removal
        // here to keep bridge bookkeeping (spontaneous subs etc.) in sync.
        this.opts.logger.info({ chatId, state, crashed: existing.crashed }, 'ExecutorRegistry: replacing unhealthy executor');
        this.executors.delete(chatId);
        if (existing.crashed) this.emit('executor-removed', chatId);
      }
    }

    // Make room if at capacity (LRU = first-inserted Map key)
    const max = this.opts.maxConcurrent ?? DEFAULT_MAX_CONCURRENT_PER_BOT;
    while (this.executors.size >= max) {
      const oldestKey = this.executors.keys().next().value as string | undefined;
      if (!oldestKey) break;
      const oldest = this.executors.get(oldestKey)!;
     
```

### Core Architecture Module: `src/engines/claude/executor.ts`
```
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKUserMessage, SpawnOptions, SpawnedProcess } from '@anthropic-ai/claude-agent-sdk';
import type { BotConfigBase } from '../../config.js';
import type { CodexReasoningEffort } from '../../config.js';
import type { Logger } from '../../utils/logger.js';
import { AsyncQueue } from '../../utils/async-queue.js';
import { buildMetaBotApiPromptContext } from '../prompt-context.js';
import type { ApiContext } from '../prompt-context.js';
import { makeCanUseTool } from './exit-plan-mode.js';
import { resolveClaudePath } from './resolve-claude.js';

export type { ApiContext } from '../prompt-context.js';

const CLAUDE_EXECUTABLE = resolveClaudePath();

/**
 * Env var prefixes to always strip from the inherited process environment.
 * CLAUDE*: prevents "nested session" errors from the SDK.
 */
const ALWAYS_FILTERED_PREFIXES = ['CLAUDE'];

/**
 * Specific CLAUDE_* env vars that are SAFE to pass through to the child
 * Claude Code process even though the broad CLAUDE* filter would normally
 * strip them. These are user-tunable feature flags / mode toggles, not
 * session-state vars (which are what the nested-session guard is for).
 *
 * Add a var here when you need MetaBot users to be able to enable a
 * Claude Code feature via .env or the host environment.
 */
const CLAUDE_ENV_PASSTHROUGH = new Set([
  'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', // /agent teams (multi-instance coordination)
  'CLAUDE_CODE_DISABLE_AGENT_VIEW',       // disable claude agents / --bg / /background
  'CLAUDE_CODE_SIMPLE',                   // --bare equivalent
  'CLAUDE_CODE_DISABLE_AUTO_MEMORY',      // toggle auto-memory (project patterns/learnings)
  'CLAUDE_CODE_DISABLE_1M_CONTEXT',       // opt out of Max-tier silent 1M context upgrade
  'CLAUDE_CODE_AUTO_COMPACT_WINDOW',      // hard-cap the auto-compact window (keeps non-[1m] models at 200k)
]);

/**
 * Auth-related env vars that are only filtered when an explicit API key
 * is provided in bots.json OR when ~/.claude/.credentials.json exists.
 * This ensures users who rely solely on ANTHROPIC_API_KEY env var can
 * still authenticate without configuring bots.json.
 */
const AUTH_ENV_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];

/**
 * Check if Claude Code has credentials.json (OAuth login).
 */
function hasCredentialsFile(): boolean {
  const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
  try {
    return fs.existsSync(credPath);
  } catch {
    return false;
  }
}

/**
 * Create a custom spawn function for cross-platform compatibility.
 * - Honors `options.command` from the SDK — for claude-agent-sdk >= 0.2.140
 *   the SDK spawns the native Claude binary directly, so we must NOT force
 *   `process.execPath` (node). Legacy JS entrypoints set `options.command`
 *   to the node executable themselves, so this works in both worlds.
 * - Always filters CLAUDE* env vars to prevent nested session errors.
 * - Filters ANTHROPIC auth env vars only when an explicit API key is provided
 *   or credentials.json exists (so env-var-only users can still authenticate).
 * - Merges process.env so child inherits system PATH, TEMP, etc.
 * - Optionally injects an explicit ANTHROPIC_API_KEY from bots.json config.
 */
function createSpawnFn(explicitApiKey?: string): (options: SpawnOptions) => SpawnedProcess {
  // Force-use-env mode: pass ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY /
  // ANTHROPIC_BASE_URL through to the Claude Code subprocess instead of
  // filtering them out. Triggered by either:
  //   (a) METABOT_PREFER_ENV_AUTH=true (explicit opt-in flag), or
  //   (b) presence of ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL
  //       in the process env (auto-detect — user clearly wants env-based auth).
  // Use case: a bot points Claude Code at a third-party Anthropic-compatible
  // proxy while other bots on the same machine still use OAuth via
  // ~/.claude/.credentials.json (which can't be deleted).
  const preferEnvAuth =
    process.env.METABOT_PREFER_ENV_AUTH === 'true' ||
    !!(
      process.env.ANTHROPIC_AUTH_TOKEN ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_BASE_URL
    );

  // Decide once whether to filter auth env vars
  const filterAuthVars = !preferEnvAuth && !!(explicitApiKey || hasCredentialsFile());

  return (options: SpawnOptions): SpawnedProcess => {
    // Merge provided env with process.env for a complete environment
    const baseEnv = options.env && Object.keys(options.env).length > 0
      ? { ...process.env, ...options.env }
      : { ...process.env };

    // Filter out env vars that interfere with auth or cause nested session errors
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(baseEnv)) {
      if (value === undefined) continue;
      // Safe-pass list takes precedence over the broad CLAUDE* strip — these
      // are feature flags users opt into (agent teams, disable agent view, etc.)
      if (CLAUDE_ENV_PASSTHROUGH.has(key)) {
        env[key] = value;
        continue;
      }
      if (ALWAYS_FILTERED_PREFIXES.some(p => key.startsWith(p))) continue;
      if (filterAuthVars && AUTH_ENV_VARS.some(v => key.startsWith(v))) continue;
      env[key] = value;
    }

    // Inject explicit API key from bots.json (after filtering, so it takes effect)
    if (explicitApiKey) {
      env.ANTHROPIC_API_KEY = explicitApiKey;
    }

    // Default-enable Claude Code Agent Teams. Without a real terminal there's
    // no tmux/iTerm2, so teammates must run in-process (controlled via the
    // `teammateMode` setting passed in queryOptions). Users can disable by
    // setting CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=0 in MetaBot's parent env.
    if (env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === undefined) {
      env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';
    }

    // Default-enable Claude Code auto-memory so Claude can write project
    // patterns / preferences / decisions to ~/.claude/projects/<projDir>/memory/
    // across sessions — the user-facing memory system the bot's skills
    // rely on. Users can disable by setting
    // CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 in MetaBot's parent env.
    // Pinning to '0' here makes the feature immune to upstream default
    // changes; the user shouldn't need to keep a magic line in .env.
    if (env.CLAUDE_CODE_DISABLE_AUTO_MEMORY === undefined) {
      env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '0';
    }

    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env,
      signal: options.signal,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return child as unknown as SpawnedProcess;
  };
}

/**
 * Apply 1M-context settings based on the effective model name in `queryOptions.model`:
 *
 *   - With `[1m]` suffix (e.g. `claude-opus-4-7[1m]`): set the matching
 *     `betas` flag. The SDK strips the suffix and forwards the beta header
 *     to the API. Belt-and-braces for API-key auth modes where the SDK
 *     may not auto-infer the beta from the suffix alone.
 *
 *   - Fable 5 has native 1M context in Claude Code, so leave its env alone
 *     and let the CLI use the model's default window.
 *
 *   - Without `[1m]` on legacy 1M-capable Opus/Sonnet models: keep the model
 *     at the standard 200K window. We set
 *     two env vars in the spawn env:
 *       • `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` — the binary's opt-out switch
 *         for the silent Max-tier 1M upgrade (opus-4-8, opus-4-7, opus-4-6,
 *         sonnet-4-6), which otherwise bills all tokens at 2× past 200K.
 *       • `CLAUDE_CODE_AUTO_COMPACT_WINDOW=200000` — caps the auto-compact
 *         window. The CLI's window resolver takes `min(modelWindow, configured)`,
 *         so on 1M-capable auth this forces auto-compaction to fire near 200K
 *         (≈ window − 13K) instead of ~987K. NOTE: on auth where the model
 *         already reports a 200K window (e.g. a proxy that doesn't grant the
 *         1M tier — as observed for opus-4-8 behind some auth proxies),
 *         this is a no-op, since min(200K, 200K) = 200K. It's a defensive
 *         guard for the day this bot runs on 1M-capable auth. Pushing the
 *         window *above* the model's reported size isn't possible here: the
 *         only upward override is `DISABLE_COMPACT + CLAUDE_CODE_MAX_CONTEXT_TOKENS`,
 *         which turns auto-compaction off entirely. Value must stay within
 *         the binary's 100K–1M bounds.
 *     (MetaBot's spawn handler merges `queryOptions.env` on top of
 *     `process.env`, so we only need to set the override keys. Both keys are
 *     in CLAUDE_ENV_PASSTHROUGH so the CLAUDE* env filter doesn't strip them.)
 *     Append `[1m]` to opt back in to the full 1M window.
 *
 * Must be called *after* any per-call `options.model` override so the
 * suffix detection sees the actually-effective model, not the bot default.
 */
export const DEFAULT_AUTO_COMPACT_WINDOW = '200000';
const FABLE_5_MODEL_RE = /^claude-fable-5(?:$|\[)/;

export function apply1MContextSettings(queryOptions: Record<string, unknown>): void {
  const model = queryOptions.model as string | undefined;
  if (model && FABLE_5_MODEL_RE.test(model)) {
    return;
  }
  if (model?.includes('[1m]')) {
    queryOptions.betas = ['context-1m-2025-08-07'];
  } else {
    const existingEnv = (queryOptions.env as Record<string, string> | undefined) ?? {};
    queryOptions.env = {
      ...existingEnv,
      CLAUDE_CODE_DISABLE_1M_CONTEXT: '1',
      CLAUDE_CODE_AUTO_COMPACT_WINDOW: DEFAULT_AUTO_COMPACT_WINDOW,
    };
  }
}

/**
 * Events surfaced by Claude Code's experimental Agent Teams hooks
 * (TaskCreated / TaskCompleted / TeammateIdle). Used to drive the
 * Feishu / Web team panel without requiring the user to switch panes.
 */
export type TeamEvent =
  | {
      kind: 'task
```

### Core Architecture Module: `src/engines/claude/exit-plan-mode.ts`
```
import type { Logger } from '../../utils/logger.js';

/**
 * ExitPlanMode's native checkPermissions always returns `{behavior: "ask",
 * message: "Exit plan mode?"}` outside sub-agent contexts — independent of
 * `permissionMode: 'bypassPermissions'` and unreachable from PreToolUse hooks
 * (the "ask" path goes via a can_use_tool control_request). Without a
 * canUseTool handler the bridge gets back an is_error tool_result, the agent
 * stays in plan mode, and the user sees a perpetual "Exit plan mode?" loop.
 *
 * We always allow — the bridge already ships the plan body to the user as a
 * separate card via StreamProcessor + sendPlanContent, so they still see what
 * was decided before implementation continues. Non-ExitPlanMode tool calls
 * normally never reach this callback under bypassPermissions; we allow them
 * too as a safety net so a stray "ask" can't deadlock the session.
 */
export function makeCanUseTool(logger: Logger) {
  return async function canUseTool(
    toolName: string,
    input: Record<string, unknown>,
    opts: { toolUseID: string },
  ): Promise<{ behavior: 'allow'; updatedInput: Record<string, unknown> }> {
    if (toolName === 'ExitPlanMode') {
      logger.info({ toolUseId: opts.toolUseID }, 'canUseTool: auto-approving ExitPlanMode');
    } else {
      logger.warn({ toolName, toolUseId: opts.toolUseID }, 'canUseTool: unexpected ask under bypassPermissions — allowing');
    }
    return { behavior: 'allow', updatedInput: input };
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #330** (2026-08-08): **[Bug] 从手机端通过metabot连接 Claude Code调用glm API的时候会被限流**
  *Symptoms*: error: "API Error: 529 {\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\",\"code\":\"1305\",\"message\":\"[1305][该模型当前访问量过大，请您稍后再试] [20260708160235ec24730091714e78]\"},\"request_id\":\"20260708160235ec24730091714e78\"}"  我用metabot来访问claude code, 然后调用的GLM的API总是显示访问量过大，然后不让访问但是我直接用claude code来调用GM API就没有问题 这个问题怎么解决
  **Post-Mortem & Fix Analysis**:
  > Closing as upstream/provider behavior rather than a confirmed MetaBot capacity bug. Current troubleshooting docs now include a specific 529 overloaded_error checklist: compare the Bridge service environment with the standalone Claude Code terminal that works (base URL, API key source, model/profile, proxy, workspace), then treat matching environments as provider-side rate limiting/quota. Reopen if you can provide redacted evidence that MetaBot is selecting a different provider/model despite identical config.

- **Issue #322** (2026-06-12): **[Bug] 用/metaskill创建子agent就会报错：Error: API Error: 400 thinking options type cannot be disabled when reasoning_effort is set**
  *Symptoms*: 如题
  **Post-Mortem & Fix Analysis**:
  > 它自己好了，可能是deepseek这边修了

- **Issue #319** (2026-08-08): **[Bug] Claude Code 在全局新会话中报错：messages[1].role unknown variant `system`, expected `user` or `assistant`**
  *Symptoms*: ## 问题描述  我在 Windows 环境中使用 Claude Code 时，突然出现 API 400 报错。最开始问题只出现在某个 `metabot-workspace` 目录中，但后续发现已经变成全局问题：即使在新建的空文件夹中启动 Claude Code，并且只发送一条简单消息 `hi`，也会立即报错。  报错信息如下：  Error: API Error: 400 Failed to deserialize the JSON body into the target type: messages[1].role: unknown variant `system`, expected `user` or `assistant` at line 1 column 5513  从错误信息看，似乎请求体中的 messages[1].role 被设置成了 system，但当前 API 只接受 user 或 assistant。  ## 触发背景 问题出现前，我做过以下操作：  1. 安装并使用了 metabot。 2. 创建了一个 metabot-workspace。 3. 使用 PM2 设置了 metabot 自启动。 4. 之后在 metabot / Claude Code 相关工作流中发送了一个 PDF 文件分析请求，内容大致如下：       请分析这个文件              [File saved at: C:\Users\a2193\AppData\Local\Temp\metabot-downloads-a2193\file_v3_00125_bc2a986e-7fb2-41dc-a251-cae39bc6fc4g_BDIC Stage4 Final Exam Schedule, Spring Trimester, 2025-2026（week13-15已更新教室安排）.pdf]              Please use the Read tool (for text/code files, images, PDFs) or Bash tool (for other formats) to read and analyze this file. 5. 在这之后，Claude Code 开始报 400 错误: messages[3].role: unknown variant `system`, expected `user` or `assistant` 6. 后来发现问题扩大: messages[1].role: unknown variant `system`, expected `user` or `assistant`  ## 当前现象 现在问题已经不是特定会话或特定项目目录的问题，而是全局问题。 我做了如下测试：  1. 在原来的 metabot-workspace 中启动 Claude Code，会报错。 2. 在新建的空文件夹中启动 Claude Code，也会报错。 3. 新会话中只发送 hi，仍然会报错。 4. .claude 项目目录看起来很干净，没有明显异常内容。  ## 我的电脑环境 1. Windows 2. PowerShell and cmd 3. Claude Code version: 2.1.156 (Claude Code) 4. claude命令路径检查结果：     (base) PS C:\Users\a2193> Get-Command claude -All       
  **Post-Mortem & Fix Analysis**:
  > 补充: 我后续尝试重装claude code，之后问题依然存在。并且没有发现metabot在windows端的卸载方式
  > 暂时解决了，发现是claude code的静默更新的问题，deepseek api没有跟上更新导致的，但是还是希望可以把windows端的卸载程序写完，我自己在本地根据uninstall.sh文件试着写了一版对应的ps1文件，在我本地跑没有太大问题，如果需要我可以提供给你 
  > Closing because the reported global Claude Code 400 was confirmed by the reporter as a Claude/provider update compatibility issue outside MetaBot. Current MetaBot docs also include the supported Windows install/update path and CLI diagnostics. If a current MetaBot install still corrupts Claude messages independently of provider compatibility, please reopen with a minimal reproduction and redacted logs.

- **Issue #318** (2026-05-29): **[Bug] metabot配置了飞书机器人+codex, codex里面总是提示Reconnecting... 5/5 (request timed out), 很慢**
  *Symptoms*: 我给终端里面配置了代理, 但是飞书里面和codex对话的时候, 先提示Reconnecting... 5/5 (request timed out), 然后才会正常回复,这个是什么原因呢?
  **Post-Mortem & Fix Analysis**:
  > <img width="630" height="148" alt="Image" src="https://github.com/user-attachments/assets/4e2131b4-6b55-4c12-bdbd-36f21f8fea83" />

- **Issue #228** (2026-08-08): **[Bug] 安装好了也启动了，打不开webui，飞书发消息也没反应**
  *Symptoms*: ## Describe the Bug  我是windows系统使用如下命令安装： irm https://raw.githubusercontent.com/xvirobotics/metabot/main/install.ps1 | iex 第一次安装卡在 ==> Phase 7: MetaMemory [INFO] MetaMemory is embedded in MetaBot (no separate server needed).  <img width="1070" height="943" alt="Image" src="https://github.com/user-attachments/assets/3b96f159-e48d-4b76-85f3-dc00e0ccea89" />  第二次执行上面的命令安装成功了，可是无法使用  http://localhost:8100/  <img width="954" height="742" alt="Image" src="https://github.com/user-attachments/assets/3fed0e8a-2f19-4ff3-ac83-ac2d5df16c12" />  <img width="690" height="686" alt="Image" src="https://github.com/user-attachments/assets/16642dc1-abe7-4b58-9434-e6d56c8dee08" />  地址打不开，程序根本没启动，可控制台确显示启动成功  ## Environment  - Node.js version: v21.7.3 - OS: win10 - Feishu app type: (custom app / store app) - Claude Code version: 2.1.119 - MetaBot version/commit: 刚拉的最新代码  ## Logs 如下图  ## Screenshots  <img width="659" height="716" alt="Image" src="https://github.com/user-attachments/assets/67066a6b-4e61-4111-9bfe-ed7e7977491e" /> 
  **Post-Mortem & Fix Analysis**:
  > <img width="779" height="755" alt="Image" src="https://github.com/user-attachments/assets/d3cdc5e0-1c06-4e29-9001-9313beb26d02" />‘’ 
  > <img width="548" height="201" alt="Image" src="https://github.com/user-attachments/assets/e85fea90-9dfb-4c7b-b0ed-4f5dc2b0a5cc" />
  > 感谢反馈 🙏 看截图你访问的是 `http://localhost:8100/`，但**当前架构下这个端口已经不存在**了 —— MetaMemory 早已 embedded 进 MetaBot 主进程，不再单独跑 8100 端口（你截图里 install.ps1 的 Phase 7 也明确写了 "MetaMemory is embedded in MetaBot (no separate server needed)"）。  实际的 Web UI 地址是：  ``` http://localhost:9100/web/ ```  请按以下步骤排查：  1. **确认进程是否真起来了**    ```powershell    pm2 list    pm2 logs metabot --lines 50    ```    或者：    ```powershell    metabot status    metabot logs    ```  2. **访问正确的 Web UI 端口**    - Web UI: `http://localhost:9100/web/`    - API health: `http://localhost:9100/api/health`  3. **如果 pm2 显示 metabot 在 online 但浏览器仍打不开 9100**    - 检查 `.env` 里的 `API_PORT`（默认 9100）    - 看 `pm2 logs metabot` 是否报 `EADDRINUSE` 端口被占用    - 看是否有报 Claude/Kimi/Codex CLI 找不到 / 未登录的错（飞书没反应通常是引擎 CLI 没登录）  4. **飞书消息没反应**通常是：    - 引擎 CLI 没登录（参考 CLAUDE.md "Prerequisites" 章节）    - Feishu app 的事件订阅模式没设成"长连接"    - `im.message.receive_v1` 事件没订阅  补充上述命令的输出后再继续排查。 

- **Issue #226** (2026-05-03): **[Bug] 使用opus模型会报API Error**
  *Symptoms*: ## Describe the Bug  API Error: Claude Code is unable to respond to this request, which appears to violate our Usage Policy (https://www.anthropic.com/legal/aup). Try rephrasing the request or attempting a different approach. If you are seeing this refusal repeatedly, try running /model claude-sonnet-4-20250514 to switch models.  
  **Post-Mortem & Fix Analysis**:
  > 这个错误来自 Anthropic 服务端的内容策略检测，不是 metabot 自身的 bug：`Claude Code is unable to respond to this request, which appears to violate our Usage Policy`。  可能的处理方向： 1. 按错误提示尝试 `/model claude-sonnet-4-20250514` 或其他模型（在 Feishu 中即 `/api` 切到不同账号或在 `bots.json` 中改 `model`） 2. 尝试改写 prompt 内容 3. 直接联系 Anthropic 支持  由于此问题超出 metabot 的可控范围，先关闭。如果你怀疑是 metabot 在传递 prompt 的过程中导致触发了策略（例如包装了不该加的内容），欢迎重开并附上具体的输入消息。

- **Issue #224** (2026-05-09): **[Bug] win系统安装报错**
  *Symptoms*: ==> Phase 6: Installing skills and setting up workspace Copy-Item : 找不到路径“D:\ClaudeTest\src\skills\metaskill\SKILL.md”，因为该路径不存在              
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈 🙏 报错路径 `D:\ClaudeTest\src\skills\metaskill\SKILL.md` 不存在，是因为仓库里 skills 实际在 `.claude/skills/metaskill/` 而不是 `src/skills/metaskill/`。可能是 install.ps1 在某个分支上路径写错了。  为了帮你定位，能否补充以下信息： 1. 你用的是哪个 install 命令？（`irm ... | iex` 还是本地拉代码运行 `install.ps1`？） 2. `git rev-parse HEAD` 的输出（用来确认你拉到的版本） 3. `install.ps1` Phase 6 之前的完整日志 4. PowerShell 版本（`$PSVersionTable.PSVersion`）和 Windows 版本  收到信息后会进一步排查。
  > 更正一下我之前的判断 🙏 我重新检查了一遍，install.ps1 引用的路径 `src\skills\metaskill\SKILL.md` 在当前 main 分支**确实是存在的**（自 2026-02-23 起就在仓库里）。所以问题不是路径写错，更可能的原因是：  1. **你的本地 clone 是旧版本**，install.ps1 的 Phase 2 用的是 `git pull --ff-only`，如果它失败（比如有本地未提交修改、本地有 diverged commit），会被 try/catch 吞掉只打印一个 warning，然后用旧代码继续到 Phase 6，那时 `src\skills\metaskill\` 还不存在就会报 "找不到路径"。 2. 或者 `D:\ClaudeTest` 不是 git 仓库根目录（譬如父目录或子目录）。  为了定位，麻烦提供：  ```powershell # 1. 确认安装目录是不是真正的 metabot 仓库根 cd D:\ClaudeTest git rev-parse --show-toplevel git rev-parse HEAD git status  # 2. 确认这些文件在你本地是否存在 Test-Path src\skills\metaskill\SKILL.md Test-Path src\skills\metabot\SKILL.md  # 3. install.ps1 Phase 2 之前的完整日志（看 git pull/clone 是否报过 warn） ```  如果 `git rev-parse HEAD` 是较老的 commit（早于 `8d9fb44`），那只要在该目录下手动 `git pull --ff-only`（或 `git fetch && git reset --hard origin/main`，**注意会丢弃本地修改**）然后重跑 install.ps1 就能修好。  我会同时改进 install.ps1，让 `git pull` 失败时早报错，避免再有人被同样的 silent failure 卡住。

- **Issue #221** (2026-04-25): **[Bug] Claude Code native binary not found**
  *Symptoms*: ## Describe the Bug  飞书机器人回复： Error: Claude Code native binary not found at /root/.nvm/versions/node/v24.14.1/bin/claude. Please ensure Claude Code is installed via native installer or specify a valid path with options.pathToClaudeCodeExecutable.  但是在终端中claude 能正常使用
  **Post-Mortem & Fix Analysis**:
  > 我又遇到了一个新bug：Error: Claude Code process exited with code 1  有点没招了😭 
  > 第一个bug的原因需要按照native安装即可，第二个bug是发生在docker容器内部，在metabot的.env中设置：IS_SANDBOX=1
  > 跟进一些相关发现，可能值得补充上 —— 即使按建议改用 native installer，Windows 上仍有两个独立的失败点会触发同一句错误信息。  **Layer 1: customSpawn 忽略 SDK 的 `options.command`（与 install 方式无关）**  `src/engines/claude/executor.ts:88` 无条件用 `process.execPath` (Node) 替换 SDK 选好的 binary：  ```ts const child = spawn(nodePath, options.args, { ... }); ```  SDK 0.2.x 的 `SpawnOptions.command` 是 SDK 按 native-binary heuristic 选好的（native install 时就是 `.exe` 路径，JS-bundle install 时才是 node 路径）。无条件用 `nodePath` 替换 → SDK 已经按"直接 spawn .exe"准备好的 args 不含 cli 路径 → Node 拿到 no-entry-file 的 argv → `spawn ENOENT` → SDK 错误处理回 `c1?` 分支报 "native binary not found at <command>"。文件其实就在那里、可执行。  最小修复：  ```ts const spawnFile = /\.exe$/i.test(options.command) ? options.command : nodePath; const child = spawn(spawnFile, options.args, { ... }); ```  `.cmd`/`.bat` 不收（Node `child_process.spawn()` 在 Windows 拒 `.cmd` 用 EINVAL，SDK 也不会选）。这层与 install 方式独立 —— 即便 native install，只要 SDK 选的是 `.exe`，这条 path 仍然把它替换掉。Fix sketch 在 fork 上：https://github.com/pandalaohe/metabot/commit/4179e13b2d

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

### Incident Patch 1: `5ed78b66` (2026-09-15)
**Commit Message**: fix(kimi): launch daemon with the web command

**File**: `src/engines/kimi/daemon-client.ts` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ import os from 'node:os';
 import path from 'node:path';
 
 const DEFAULT_ORIGIN = 'http://127.0.0.1:58627';
-const START_TIMEOUT_MS = 15_000;
+const START_TIMEOUT_MS = 30_000;
 const REQUEST_TIMEOUT_MS = 30_000;
 
 interface KimiEnvelope<T> {
@@ -416,7 +416,7 @@ export class KimiDaemonClient {
     if (!isLoopbackHostname(url.hostname)) {
       throw new KimiDaemonError(`Kimi Code server is unavailable at ${this.origin}`);
     }
-    const args = ['server', 'run', '--port', url.port || '58627', '--keep-alive'];
+    const args = ['web', '--port', url.port || '58627', '--no-open'];
     const child = spawn(this.executable, args, {
       env: { ...process.env, ...(this.apiKey ? { KIMI_API_KEY: this.apiKey } : {}) },
       stdio: 'ignore',
```

**File**: `tests/kimi-daemon-client.test.ts` (modified, +27/-0)
```diff
@@ -2,6 +2,11 @@ import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 import { mkdtemp, rm, writeFile } from 'node:fs/promises';
 import os from 'node:os';
 import path from 'node:path';
+import { spawn } from 'node:child_process';
+import { EventEmitter } from 'node:events';
+
+vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
+
 import { KimiDaemonClient, KimiDaemonError } from '../src/engines/kimi/daemon-client.js';
 
 function response<T>(data: T): Response {
@@ -24,11 +29,33 @@ describe('KimiDaemonClient', () => {
 
   afterEach(async () => {
     vi.unstubAllGlobals();
+    vi.restoreAllMocks();
+    vi.mocked(spawn).mockReset();
     if (previousHome === undefined) delete process.env.KIMI_CODE_HOME;
     else process.env.KIMI_CODE_HOME = previousHome;
     await rm(home, { recursive: true, force: true });
   });
 
+  it('starts the web daemon without opening a browser and allows more than 15 seconds', async () => {
+    const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
+    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);
+    vi.stubGlobal('fetch', vi.fn()
+      .mockRejectedValueOnce(new Error('not running'))
+      .mockResolvedValueOnce(response({ ok: true })));
+    // Probe succeeds 16 seconds after launch: within the 30-second startup window.
+    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(16_000);
+    await new KimiDaemonClient({ executable: '/test/kimi', serverUrl: 'http://127.0.0.1:58628' }).ensureRunning();
+    expect(spawn).toHaveBeenCalledWith('/test/kimi', ['web', '--port', '58628', '--no-open'],
+      expect.objectContaining({ detached: true, stdio: 'ignore' }));
+    expect(child.unref).toHaveBeenCalledOnce();
+  });
+
+  it('does not spawn a daemon when one is already healthy', async () => {
+    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true })));
+    await new KimiDaemonClient().ensureRunning();
+    expect(spawn).not.toHaveBeenCalled();
+  });
+
   it('uses the official prompt queue and steer endpoints', async () => {
     const fetchMock = vi
       .fn()
```

---

### Incident Patch 2: `b6ad5f2b` (2026-09-15)
**Commit Message**: fix(feishu): keep bot DM and group replies in their threads

**File**: `src/bridge/message-bridge.ts` (modified, +9/-0)
```diff
@@ -25,6 +25,7 @@ import { listCodexSessions } from '../engines/codex/session-lister.js';
 import { listKimiSessions } from '../engines/kimi/session-lister.js';
 import { ExecutorRegistry } from '../engines/claude/executor-registry.js';
 import { RateLimiter } from './rate-limiter.js';
+import { withReplyContext } from './reply-context.js';
 import { OutputsManager } from './outputs-manager.js';
 import { shouldRemindRestart, markReminded, restartSecondsAgo } from './restart-notice.js';
 import type { RestartTaskSnapshot } from './restart-coordinator.js';
@@ -1653,6 +1654,10 @@ export class MessageBridge {
   }
 
   async handleMessage(msg: IncomingMessage): Promise<void> {
+    return withReplyContext(msg, () => this.handleMessageInContext(msg));
+  }
+
+  private async handleMessageInContext(msg: IncomingMessage): Promise<void> {
     const { chatId, text } = msg;
 
     if (this.restartQuiesceRequestId) {
@@ -2027,6 +2032,10 @@ export class MessageBridge {
   }
 
   private async startQuery(msg: IncomingMessage): Promise<void> {
+    return withReplyContext(msg, () => this.startQueryInContext(msg));
+  }
+
+  private async startQueryInContext(msg: IncomingMessage): Promise<void> {
     const startingTask = this.reserveTaskStart(msg.chatId, msg.text, 'chat', true);
     if (!startingTask) {
       throw new Error(`Chat ${msg.chatId} is busy with another task`);
```

**File**: `src/bridge/reply-context.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import { AsyncLocalStorage } from 'node:async_hooks';
+import type { IncomingMessage } from '../types.js';
+
+// A reply belongs to the triggering message, never to the latest active chat.
+// Async scope keeps concurrent and queued turns from overwriting each other.
+const replyContext = new AsyncLocalStorage<{ chatId: string; messageId?: string }>();
+
+export function withReplyContext<T>(message: IncomingMessage, run: () => T): T {
+  // Feishu supports threads in both group chats and bot direct messages.
+  const inThread = Boolean(message.threadId || message.rootMessageId || message.parentMessageId);
+  return replyContext.run({
+    chatId: message.chatId,
+    messageId: inThread ? message.messageId : undefined,
+  }, run);
+}
+
+export function getReplyMessageId(chatId: string): string | undefined {
+  const context = replyContext.getStore();
+  return context?.chatId === chatId ? context.messageId : undefined;
+}
```

**File**: `src/feishu/event-handler.ts` (modified, +10/-2)
```diff
@@ -2,6 +2,7 @@ import * as lark from '@larksuiteoapi/node-sdk';
 import type { BotConfig } from '../config.js';
 import type { Logger } from '../utils/logger.js';
 import { MessageSender } from './message-sender.js';
+import { withReplyContext } from '../bridge/reply-context.js';
 import {
   type FeishuGroupReplyMode,
   FeishuGroupReplyModeStore,
@@ -255,6 +256,11 @@ export function createEventDispatcher(
         const chatId = message.chat_id;
         const chatType = message.chat_type;
         const messageId = message.message_id;
+        const replyMetadata = {
+          ...(typeof message.parent_id === 'string' && message.parent_id ? { parentMessageId: message.parent_id } : {}),
+          ...(typeof message.root_id === 'string' && message.root_id ? { rootMessageId: message.root_id } : {}),
+          ...(typeof message.thread_id === 'string' && message.thread_id ? { threadId: message.thread_id } : {}),
+        };
         const mentions = message.mentions;
 
         let commandText = '';
@@ -290,7 +296,9 @@ export function createEventDispatcher(
               defaultMode: config.groupNoMention || inheritedPrivateLike ? 'all' : 'mention',
               canChangeMode,
               store: groupReplyModeStore,
-              sendNotice: onGroupReplyModeNotice,
+              sendNotice: (noticeChatId, title, content, color) => withReplyContext({
+                messageId, chatId, chatType, userId, text: commandText, ...replyMetadata,
+              }, () => onGroupReplyModeNotice(noticeChatId, title, content, color)),
             });
             logger.info({ chatId, userId, botName: config.name }, 'Handled group reply mode command');
             return;
@@ -436,7 +444,7 @@ export function createEventDispatcher(
           }
         }
 
-        onMessage({ messageId, chatId, chatType, userId, text, imageKey, fileKey, fileName, extraMedia });
+        onMessage({ messageId, chatId, chatType, userId, text, ...replyMetadata, imageKey, fileKey, fileName, extraMedia });
       } catch (err) {
         logger.error({ err }, 'Error handling message event');
       }
```

**File**: `src/feishu/message-sender.ts` (modified, +23/-40)
```diff
@@ -1,6 +1,7 @@
 import * as fs from 'node:fs';
 import type * as lark from '@larksuiteoapi/node-sdk';
 import type { Logger } from '../utils/logger.js';
+import { getReplyMessageId } from '../bridge/reply-context.js';
 
 export class MessageSender {
   private chatOwnerCache = new Map<string, { ownerId?: string; expiresAt: number }>();
@@ -10,16 +11,26 @@ export class MessageSender {
     private logger: Logger,
   ) {}
 
-  async sendCard(chatId: string, cardContent: string): Promise<string | undefined> {
-    try {
-      const resp = await this.client.im.v1.message.create({
+  private async sendMessage(chatId: string, content: string, msgType: string) {
+    const messageId = getReplyMessageId(chatId);
+    const response = messageId
+      ? await this.client.im.v1.message.reply({
+        path: { message_id: messageId },
+        data: { content, msg_type: msgType, reply_in_thread: true },
+      })
+      : await this.client.im.v1.message.create({
         params: { receive_id_type: 'chat_id' },
-        data: {
-          receive_id: chatId,
-          content: cardContent,
-          msg_type: 'interactive',
-        },
+        data: { receive_id: chatId, content, msg_type: msgType },
       });
+    if (response?.code) {
+      throw new Error(`Feishu message delivery failed (${response.code}): ${response.msg}`);
+    }
+    return response;
+  }
+
+  async sendCard(chatId: string, cardContent: string): Promise<string | undefined> {
+    try {
+      const resp = await this.sendMessage(chatId, cardContent, 'interactive');
 
       const messageId = resp?.data?.message_id;
       if (!messageId) {
@@ -106,14 +117,7 @@ export class MessageSender {
 
   async sendImage(chatId: string, imageKey: string): Promise<boolean> {
     try {
-      await this.client.im.v1.message.create({
-        params: { receive_id_type: 'chat_id' },
-        data: {
-          receive_id: chatId,
-          content: JSON.stringify({ image_key: imageKey }),
-          msg_type: 'image',
-        },
-      });
+      await this.sendMessage(chatId, JSON.stringify({ image_key: imageKey }), 'image');
       return true;
     } catch (err) {
       this.logger.error({ err, chatId, imageKey }, 'Failed to send image');
@@ -149,14 +153,7 @@ export class MessageSender {
 
   async sendFile(chatId: string, fileKey: string): Promise<boolean> {
     try {
-      await this.client.im.v1.message.create({
-        params: { receive_id_type: 'chat_id' },
-        data: {
-          receive_id: chatId,
-          content: JSON.stringify({ file_key: fileKey }),
-          msg_type: 'file',
-        },
-      });
+      await this.sendMessage(chatId, JSON.stringify({ file_key: fileKey }), 'file');
       return true;
     } catch (err) {
       this.logger.error({ err, chatId, fileKey }, 'Failed to send file');
@@ -172,14 +169,7 @@ export class MessageSender {
 
   async sendAudio(chatId: string, fileKey: string): Promise<boolean> {
     try {
-      await this.client.im.v1.message.create({
-        params: { receive_id_type: 'chat_id' },
-        data: {
-          receive_id: chatId,
-          content: JSON.stringify({ file_key: fileKey }),
-          msg_type: 'audio',
-        },
-      });
+      await this.sendMessage(chatId, JSON.stringify({ file_key: fileKey }), 'audio');
       return true;
     } catch (err) {
       this.logger.error({ err, chatId, fileKey }, 'Failed to send audio');
@@ -232,14 +222,7 @@ export class MessageSender {
 
   async sendText(chatId: string, text: string): Promise<void> {
     try {
-      await this.client.im.v1.message.create({
-        params: { receive_id_type: 'chat_id' },
-        data: {
-          receive_id: chatId,
-          content: JSON.stringify({ text }),
-          msg_type: 'text',
-        },
-      });
+      await this.sendMessage(chatId, JSON.stringify({ text }), 'text');
     } catch (err) {
       this.logger.error({ err, chatId }, 'Failed to send text');
     }
```

**File**: `src/types.ts` (modified, +4/-0)
```diff
@@ -98,6 +98,10 @@ export interface IncomingMessage {
   chatType: string;
   userId: string;
   text: string;
+  /** Feishu reply/thread metadata, available in both group and direct chats. */
+  parentMessageId?: string;
+  rootMessageId?: string;
+  threadId?: string;
   timestamp?: number;
   imageKey?: string;
   fileKey?: string;
```

**File**: `tests/feishu-group-reply-mode-dispatcher.test.ts` (modified, +13/-0)
```diff
@@ -101,6 +101,19 @@ function setup(
 }
 
 describe('Feishu group reply mode dispatcher', () => {
+  it.each(['group', 'p2p'])('retains thread metadata in %s messages', async (chatType) => {
+    const ctx = setup();
+    const event = groupTextEvent({ text: 'hello', chatId: 'thread-chat', mentionedBotOpenId: ctx.botOpenId });
+    await ctx.handle({ ...event, message: {
+      ...event.message, chat_type: chatType, parent_id: 'parent-1', root_id: 'root-1', thread_id: 'thread-1',
+    } });
+    expect(ctx.onMessage).toHaveBeenCalledWith(expect.objectContaining({
+      messageId: event.message.message_id, chatType,
+      parentMessageId: 'parent-1', rootMessageId: 'root-1', threadId: 'thread-1',
+    }));
+    ctx.store.close();
+  });
+
   it('lets an owner set all mode only through an exact current-bot mention', async () => {
     const chatId = 'chat-owner-all';
     const ctx = setup();
```

**File**: `tests/feishu-thread-reply.test.ts` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+import { describe, expect, it, vi } from 'vitest';
+import type * as lark from '@larksuiteoapi/node-sdk';
+import { MessageSender } from '../src/feishu/message-sender.js';
+import { FeishuSenderAdapter } from '../src/feishu/feishu-sender-adapter.js';
+import { withReplyContext } from '../src/bridge/reply-context.js';
+import { createLogger } from '../src/utils/logger.js';
+import type { IncomingMessage } from '../src/types.js';
+
+const message: IncomingMessage = {
+  chatId: 'chat-1', messageId: 'incoming-1', chatType: 'group',
+  userId: 'user-1', text: 'hello', threadId: 'thread-1',
+};
+function setup() {
+  const create = vi.fn().mockResolvedValue({ code: 0, data: { message_id: 'new' } });
+  const reply = vi.fn().mockResolvedValue({ code: 0, data: { message_id: 'reply' } });
+  const sender = new MessageSender({ im: { v1: { message: { create, reply } } } } as unknown as lark.Client, createLogger('silent'));
+  return { sender, adapter: new FeishuSenderAdapter(sender), create, reply };
+}
+
+describe('Feishu thread delivery', () => {
+  it.each(['group', 'p2p'])('keeps cards, notices, questions, text and media in a %s thread', async (chatType) => {
+    const { sender, adapter, create, reply } = setup();
+    const card = { status: 'running' as const, userPrompt: 'hello', responseText: '', toolCalls: [] };
+    await withReplyContext({ ...message, chatType }, async () => {
+      expect(await adapter.sendCard('chat-1', card)).toBe('reply');
+      await adapter.sendQuestionCard('chat-1', card);
+      await adapter.sendTextNotice('chat-1', 'Done', 'done');
+      await adapter.sendText('chat-1', 'done');
+      await sender.sendImage('chat-1', 'image-key');
+      await sender.sendFile('chat-1', 'file-key');
+      await sender.sendAudio('chat-1', 'audio-key');
+    });
+    expect(create).not.toHaveBeenCalled();
+    expect(reply.mock.calls.map(([request]) => request.data.msg_type)).toEqual([
+      'interactive', 'interactive', 'interactive', 'text', 'image', 'file', 'audio',
+    ]);
+    for (const [request] of reply.mock.calls) {
+      expect(request.path).toEqual({ message_id: 'incoming-1' });
+      expect(request.data.reply_in_thread).toBe(true);
+    }
+  });
+
+  it.each([{ rootMessageId: 'root' }, { parentMessageId: 'parent' }])('supports reply events without thread_id: %j', async (fields) => {
+    const { sender, reply } = setup();
+    await withReplyContext({ ...message, threadId: undefined, ...fields }, () => sender.sendText('chat-1', 'hi'));
+    expect(reply).toHaveBeenCalledWith(expect.objectContaining({ path: { message_id: 'incoming-1' } }));
+  });
+
+  it('preserves ordinary chat delivery and never leaks a thread into another chat', async () => {
+    const { sender, create, reply } = setup();
+    await withReplyContext({ ...message, threadId: undefined }, () => sender.sendText('chat-1', 'normal'));
+    await withReplyContext({ ...message, chatType: 'p2p', threadId: undefined }, () => sender.sendText('chat-1', 'private'));
+    await withReplyContext(message, () => sender.sendText('chat-2', 'other chat'));
+    await sender.sendText('chat-1', 'outside task');
+    expect(create).toHaveBeenCalledTimes(4);
+    expect(reply).not.toHaveBeenCalled();
+  });
+
+  it('isolates overlapping turns and clears an inherited thread for a queued main-chat turn', async () => {
+    const { sender, reply, create } = setup();
+    let release!: () => void;
+    const gate = new Promise<void>(resolve => { release = resolve; });
+    const first = withReplyContext(message, async () => {
+      await gate;
+      await sender.sendText('chat-1', 'first');
+      await withReplyContext({ ...message, threadId: undefined }, () => sender.sendText('chat-1', 'main'));
+    });
+    await withReplyContext({ ...message, messageId: 'incoming-2', threadId: 'thread-2' }, () => sender.sendText('chat-1', 'second'));
+    release();
+    await first;
+    expect(reply.mock.calls.map(([request]) => request.path.message_id)).toEqual(['incoming-2', 'incoming-1']);
+    expect(create).toHaveBeenCalledTimes(1);
+  });
+
+  it.each(['exception', 'api-error'])('never falls back to the main chat on thread reply failure: %s', async (failure) => {
+    const { sender, reply, create } = setup();
+    if (failure === 'exception') reply.mockRejectedValue(new Error('message deleted'));
+    else reply.mockResolvedValue({ code: 230011, msg: 'message deleted' });
+    await withReplyContext(message, async () => {
+      expect(await sender.sendCard('chat-1', '{}')).toBeUndefined();
+      expect(await sender.sendImage('chat-1', 'key')).toBe(false);
+      await sender.sendText('chat-1', 'hi');
+    });
+    expect(create).not.toHaveBeenCalled();
+  });
+});
```

**File**: `tests/message-bridge.test.ts` (modified, +9/-3)
```diff
@@ -7,6 +7,7 @@ import {
   formatSpontaneousCardBody,
   resolvePersistentExecutorEnvDefault,
 } from '../src/bridge/message-bridge.js';
+import { getReplyMessageId } from '../src/bridge/reply-context.js';
 import { CodexCommandController } from '../src/bridge/codex-command-controller.js';
 import { DEFAULT_CODEX_GOAL_MAX_ITERATIONS } from '../src/engines/index.js';
 import { classifyBurstSource } from '../src/engines/claude/persistent-executor.js';
@@ -281,7 +282,7 @@ describe('MessageBridge between-turn questions', () => {
     expect(handledTexts).toEqual(['/reset']);
   });
 
-  it('queues a follow-up while the first task is still starting', async () => {
+  it.each(['group', 'p2p'])('queues a follow-up in a %s thread while the first task is still starting', async (chatType) => {
     let releaseInitialCard!: () => void;
     const initialCardGate = new Promise<void>((resolve) => {
       releaseInitialCard = resolve;
@@ -294,9 +295,11 @@ describe('MessageBridge between-turn questions', () => {
     const sender = makeSender();
     const originalSendCard = sender.sendCard.bind(sender);
     let sendCardCalls = 0;
+    const replyTargets: Array<string | undefined> = [];
     sender.sendCard = async (chatId: string, state: CardState) => {
       sendCardCalls += 1;
       if (sendCardCalls === 1) await initialCardGate;
+      replyTargets.push(getReplyMessageId(chatId));
       return originalSendCard(chatId, state);
     };
     const notices: Array<{ title: string; content: string }> = [];
@@ -326,15 +329,17 @@ describe('MessageBridge between-turn questions', () => {
     const first = bridge.handleMessage({
       messageId: 'm1',
       chatId: 'chat-1',
-      chatType: 'private',
+      chatType,
+      threadId: 'thread-first',
       userId: 'u1',
       text: 'first',
     });
 
     await bridge.handleMessage({
       messageId: 'm2',
       chatId: 'chat-1',
-      chatType: 'private',
+      chatType,
+      threadId: 'thread-second',
       userId: 'u1',
       text: 'second',
     });
@@ -353,6 +358,7 @@ describe('MessageBridge between-turn questions', () => {
 
     expect(bridge.runOneTurn.mock.calls.map((call: any[]) => call[2].prompt)).toEqual(['first', 'second']);
     expect(bridge.messageQueues.has('chat-1')).toBe(false);
+    expect(replyTargets).toEqual(['m1', 'm2']);
     bridge.destroy();
   });
 
```

---

### Incident Patch 3: `3f0cbe92` (2026-09-15)
**Commit Message**: fix(scheduler): prevent long one-time timers from firing early

**File**: `src/scheduler/task-scheduler.ts` (modified, +12/-0)
```diff
@@ -359,6 +359,18 @@ export class TaskScheduler {
 
   private setTimer(task: ScheduledTask): void {
     const delay = Math.max(0, task.executeAt - Date.now());
+
+    // Node overflows delays longer than ~24.8 days to 1 ms. Wait in chunks
+    // and recalculate the remaining delay before executing the task.
+    if (delay > MAX_SETTIMEOUT_MS) {
+      const timer = setTimeout(() => {
+        this.timers.delete(task.id);
+        this.setTimer(task);
+      }, MAX_SETTIMEOUT_MS);
+      this.timers.set(task.id, timer);
+      return;
+    }
+
     const timer = setTimeout(() => this.fireTask(task.id), delay);
     this.timers.set(task.id, timer);
   }
```

**File**: `tests/task-scheduler-one-time.test.ts` (modified, +105/-0)
```diff
@@ -31,6 +31,8 @@ vi.mock('../src/scheduler/cron-utils.js', () => ({
 
 const PERSIST_DIR = process.env.SESSION_STORE_DIR || path.join(os.homedir(), '.metabot');
 const PERSIST_FILE = path.join(PERSIST_DIR, 'scheduled-tasks.json');
+const MAX_SETTIMEOUT_MS = 2_147_483_647;
+const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
 
 function createMockLogger(): Logger {
   return {
@@ -312,6 +314,109 @@ describe('TaskScheduler one-time tasks — persistence', () => {
 // =====================================================================
 
 describe('TaskScheduler one-time tasks — execution', () => {
+  it.each([
+    MAX_SETTIMEOUT_MS - 1,
+    MAX_SETTIMEOUT_MS,
+    MAX_SETTIMEOUT_MS + 1,
+    THIRTY_DAYS_MS,
+    2 * MAX_SETTIMEOUT_MS + 1000,
+  ])('waits until the deadline and fires once for a %i ms delay', async (delay) => {
+    const registry = createMockRegistry();
+    const scheduler = new TaskScheduler(registry, createMockLogger());
+    const task = scheduler.scheduleTask({
+      botName: 'testbot',
+      chatId: 'c',
+      prompt: 'p',
+      delaySeconds: delay / 1000,
+    });
+
+    await vi.advanceTimersByTimeAsync(delay - 1);
+    expect(registry.get).not.toHaveBeenCalled();
+    expect(task.status).toBe('pending');
+    expect(vi.getTimerCount()).toBe(1);
+
+    await vi.advanceTimersByTimeAsync(1);
+    expect(registry.get).toHaveBeenCalledTimes(1);
+    expect(task.status).toBe('completed');
+    expect(vi.getTimerCount()).toBe(0);
+    scheduler.destroy();
+  });
+
+  it.each([
+    [60_000, THIRTY_DAYS_MS],
+    [THIRTY_DAYS_MS, 60_000],
+  ])('reschedules a %i ms delay to %i ms without leaving an old timer', async (originalDelay, newDelay) => {
+    const registry = createMockRegistry();
+    const scheduler = new TaskScheduler(registry, createMockLogger());
+    const task = scheduler.scheduleTask({
+      botName: 'testbot',
+      chatId: 'c',
+      prompt: 'p',
+      delaySeconds: originalDelay / 1000,
+    });
+
+    await vi.advanceTimersByTimeAsync(1000);
+    scheduler.updateTask(task.id, { delaySeconds: newDelay / 1000 });
+    expect(vi.getTimerCount()).toBe(1);
+
+    await vi.advanceTimersByTimeAsync(newDelay - 1);
+    expect(registry.get).not.toHaveBeenCalled();
+    await vi.advanceTimersByTimeAsync(1);
+    expect(task.status).toBe('completed');
+
+    await vi.advanceTimersByTimeAsync(originalDelay);
+    expect(registry.get).toHaveBeenCalledTimes(1);
+    expect(vi.getTimerCount()).toBe(0);
+    scheduler.destroy();
+  });
+
+  it('cancels a long-delay task after its timer has been rearmed', async () => {
+    const registry = createMockRegistry();
+    const scheduler = new TaskScheduler(registry, createMockLogger());
+    const task = scheduler.scheduleTask({
+      botName: 'testbot',
+      chatId: 'c',
+      prompt: 'p',
+      delaySeconds: THIRTY_DAYS_MS / 1000,
+    });
+
+    await vi.advanceTimersByTimeAsync(MAX_SETTIMEOUT_MS);
+    expect(registry.get).not.toHaveBeenCalled();
+    expect(scheduler.cancelTask(task.id)).toBe(true);
+    expect(vi.getTimerCount()).toBe(0);
+
+    await vi.advanceTimersByTimeAsync(THIRTY_DAYS_MS);
+    expect(registry.get).not.toHaveBeenCalled();
+    expect(task.status).toBe('cancelled');
+    scheduler.destroy();
+  });
+
+  it('restores a long-delay task with its original deadline', async () => {
+    const registry = createMockRegistry();
+    const logger = createMockLogger();
+    const first = new TaskScheduler(registry, logger);
+    const task = first.scheduleTask({
+      botName: 'testbot',
+      chatId: 'c',
+      prompt: 'p',
+      delaySeconds: THIRTY_DAYS_MS / 1000,
+    });
+    await vi.advanceTimersByTimeAsync(1000);
+    first.destroy();
+    expect(vi.getTimerCount()).toBe(0);
+
+    const restored = new TaskScheduler(registry, logger);
+    expect(restored.listTasks()[0].executeAt).toBe(task.executeAt);
+    await vi.advanceTimersByTimeAsync(THIRTY_DAYS_MS - 1001);
+    expect(registry.get).not.toHaveBeenCalled();
+
+    await vi.advanceTimersByTimeAsync(1);
+    expect(registry.get).toHaveBeenCalledTimes(1);
+    expect(restored.listTasks()).toHaveLength(0);
+    expect(vi.getTimerCount()).toBe(0);
+    restored.destroy();
+  });
+
   it('fires task after delay and calls executeApiTask', async () => {
     const registry = createMockRegistry({ executeSuccess: true });
     const scheduler = new TaskScheduler(registry, createMockLogger());
```

---

### Incident Patch 4: `2f05c07f` (2026-09-11)
**Commit Message**: fix(bus): preserve session availability during sends

**File**: `README.md` (modified, +4/-0)
```diff
@@ -200,6 +200,10 @@ Agent Bus 消息可绑定稳定会话并安全重试：使用 `--session <sessio
 `http://localhost:9200`，通过 `METABOT_CORE_URL` 和 `METABOT_CORE_TOKEN` 配置远端
 Personal Core；不会依赖托管服务或内部身份系统。
 
+Session 注册只接受 `online`、`resumable`、`offline`、`provisioning` 四种状态；
+显式离线的 Session 不会被静默投递，且可用 Session 会先在数据库中过滤再截断，
+避免旧的 resumable Session 被新离线记录遮蔽。
+
 完整命令详见[聊天命令](docs/usage/chat-commands.zh.md)、[CLI 参考](docs/reference/cli-metabot.zh.md)和 [REST API](docs/reference/api.zh.md)。
 
 ## 文档
```

**File**: `README_EN.md` (modified, +5/-0)
```diff
@@ -205,6 +205,11 @@ deduplicate retries, and `--implicit` to hide run presentation. Personal Core
 defaults to `http://localhost:9200`; configure a remote self-hosted Core with
 `METABOT_CORE_URL` and `METABOT_CORE_TOKEN`.
 
+Session registration accepts only `online`, `resumable`, `offline`, or
+`provisioning`. Sends never silently target an explicitly offline session and
+filter usable sessions before applying the listing cap, so a stale session
+cannot hide a resumable one.
+
 See [Chat Commands](docs/usage/chat-commands.md), the [CLI Reference](docs/reference/cli-metabot.md), and the [REST API](docs/reference/api.md) for the complete surfaces.
 
 ## Documentation
```

**File**: `packages/server/src/bus/message-routes.ts` (modified, +26/-10)
```diff
@@ -86,6 +86,12 @@ export function registerSession(deps: MessageRouteDeps, body: Record<string, unk
   if (!agent) return err(404, 'agent_not_found');
   if (cred.role !== 'admin' && agent.ownerCredentialId !== cred.id && agent.ownerName !== cred.ownerName)
     return err(403, 'session_ownership_required');
+  if (
+    body.status !== undefined &&
+    (typeof body.status !== 'string' || !['online', 'resumable', 'offline', 'provisioning'].includes(body.status))
+  ) {
+    return err(400, 'invalid_session_status');
+  }
   const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
   // Bind a provider session back to the central logical session that created
   // this room. The Bridge's local SessionRegistry UUID is not a Bus address.
@@ -138,20 +144,30 @@ export function sendMessage(deps: MessageRouteDeps, body: Record<string, unknown
   if (!text) return err(400, 'message_required');
   const agent = resolveAgent(deps.agents, ref, cred);
   if (!agent) return err(404, 'agent_not_found');
-  const listed = deps.messages.listSessions(agent.id, { limit: 100, offset: 0 }).sessions;
   const requested = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
   let session = requested ? deps.messages.getSession(requested) : null;
   if (requested && (!session || session.agentId !== agent.id)) return err(404, 'session_not_found');
+  if (session?.status === 'offline') {
+    return err(409, 'session_offline', { sessions: [session], agentId: agent.id, agentName: agent.botName });
+  }
   if (!session) {
-    const usable = listed.filter((s) => s.status === 'online' || s.status === 'resumable');
-    if (usable.length > 1)
-      return err(409, 'session_required', { sessions: usable, agentId: agent.id, agentName: agent.botName });
-    if (usable.length === 1) session = usable[0]!;
-    else if (listed.length > 0 && listed.every((s) => s.status === 'offline'))
-      return err(409, 'session_offline', { sessions: listed, agentId: agent.id, agentName: agent.botName });
-    else if (listed.length === 1 && listed[0]!.status === 'provisioning') session = listed[0]!;
-    else if (listed.some((s) => s.status === 'provisioning'))
-      return err(409, 'session_provisioning', { sessions: listed, agentId: agent.id, agentName: agent.botName });
+    // Filter before applying the result cap so old resumable sessions cannot
+    // be hidden by a burst of newer offline sessions.
+    const usable = deps.messages.listSessions(agent.id, { limit: 100, statuses: ['online', 'resumable'] });
+    if (usable.total > 1)
+      return err(409, 'session_required', { sessions: usable.sessions, agentId: agent.id, agentName: agent.botName });
+    if (usable.total === 1) session = usable.sessions[0]!;
+    else {
+      const pending = deps.messages.listSessions(agent.id, { limit: 100, statuses: ['provisioning'] });
+      if (pending.total > 1)
+        return err(409, 'session_provisioning', { sessions: pending.sessions, agentId: agent.id, agentName: agent.botName });
+      if (pending.total === 1) session = pending.sessions[0]!;
+      else {
+        const listed = deps.messages.listSessions(agent.id, { limit: 100 });
+        if (listed.total > 0)
+          return err(409, 'session_offline', { sessions: listed.sessions, agentId: agent.id, agentName: agent.botName });
+      }
+    }
   }
   const from = senderRef(cred);
   const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
```

**File**: `packages/server/src/bus/message-store.ts` (modified, +7/-5)
```diff
@@ -116,17 +116,19 @@ export class MessageStore {
 
   listSessions(
     agentId: string,
-    options: { limit?: number; offset?: number } = {},
+    options: { limit?: number; offset?: number; statuses?: MessageSessionStatus[] } = {},
   ): { sessions: MessageSession[]; total: number } {
     const limit = Math.max(1, Math.min(100, options.limit ?? 20));
     const offset = Math.max(0, options.offset ?? 0);
+    const statuses = options.statuses ?? [];
+    const where = `agent_id = ?${statuses.length ? ` AND status IN (${statuses.map(() => '?').join(',')})` : ''}`;
+    const params = [agentId, ...statuses];
     const total = Number(
-      (this.db.prepare('SELECT COUNT(*) AS n FROM message_sessions WHERE agent_id = ?').get(agentId) as { n: number })
-        .n,
+      (this.db.prepare(`SELECT COUNT(*) AS n FROM message_sessions WHERE ${where}`).get(...params) as { n: number }).n,
     );
     const rows = this.db
-      .prepare('SELECT * FROM message_sessions WHERE agent_id = ? ORDER BY updated_at DESC, id LIMIT ? OFFSET ?')
-      .all(agentId, limit, offset) as RawSession[];
+      .prepare(`SELECT * FROM message_sessions WHERE ${where} ORDER BY updated_at DESC, id LIMIT ? OFFSET ?`)
+      .all(...params, limit, offset) as RawSession[];
     return { sessions: rows.map(mapSession), total };
   }
 
```

**File**: `packages/server/tests/message-routes.test.ts` (modified, +41/-0)
```diff
@@ -314,4 +314,45 @@ describe('minimal message protocol', () => {
     expect(result.body.agents).toHaveLength(1);
     expect(result.body.hasMore).toBe(false);
   });
+
+  it('rejects invalid session status instead of persisting arbitrary state', async () => {
+    kit = await startTestServer('minimal-session-status-validation');
+    const owner = await issue(kit, 'target-owner', 'target@example.com');
+    kit.handle.agentStore.register({
+      botName: 'target',
+      url: 'inbox:',
+      ownerCredentialId: owner.credentialId,
+      ownerName: 'target@example.com',
+    });
+    const result = await call(kit.baseUrl, 'POST', '/api/messages/sessions', owner.token, {
+      agentId: 'target',
+      status: 'mysterious',
+    });
+    expect(result.status).toBe(400);
+    expect(result.body.error).toBe('invalid_session_status');
+  });
+
+  it('does not enqueue onto an explicitly offline session', async () => {
+    kit = await startTestServer('minimal-session-offline');
+    const sender = await issue(kit, 'sender', 'sender@example.com');
+    const owner = await issue(kit, 'target-owner', 'target@example.com');
+    const agent = kit.handle.agentStore.register({
+      botName: 'target',
+      url: 'inbox:',
+      ownerCredentialId: owner.credentialId,
+      ownerName: 'target@example.com',
+    });
+    const session = await call(kit.baseUrl, 'POST', '/api/messages/sessions', owner.token, {
+      agentId: agent.id,
+      status: 'offline',
+    });
+    expect(session.status).toBe(201);
+    const result = await call(kit.baseUrl, 'POST', '/api/messages', sender.token, {
+      agentId: agent.id,
+      sessionId: session.body.session.id,
+      message: 'must wait for resume',
+    });
+    expect(result.status).toBe(409);
+    expect(result.body.error).toBe('session_offline');
+  });
 });
```

---

### Incident Patch 5: `a437831b` (2026-09-11)
**Commit Message**: chore(deps): update fast-uri security fix

**File**: `package-lock.json` (modified, +3/-3)
```diff
@@ -3606,9 +3606,9 @@
       "license": "Unlicense"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.2",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.2.tgz",
-      "integrity": "sha512-rVjf7ArG3LTk+FS6Yw81V1DLuZl1bRbNrev6Tmd/9RaroeeRRJhAt7jg/6YFxbvAQXUCavSoZhPPj6oOx+5KjQ==",
+      "version": "3.1.7",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz",
+      "integrity": "sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==",
       "funding": [
         {
           "type": "github",
```

---

### Incident Patch 6: `e9e2dd89` (2026-09-02)
**Commit Message**: fix: make memory writes atomic and centralize view policy

**File**: `packages/server/src/memory/memory-routes.ts` (modified, +1/-25)
```diff
@@ -1,7 +1,7 @@
 import type { MemoryStore } from './memory-store.js';
 import type { AgentStore } from '../agents/agent-store.js';
 import type { Credential } from '../auth/credentials.js';
-import { isHiddenFromMemoryView } from './hidden-paths.js';
+import { canReadFolder, isHiddenFromMemoryView, isHiddenIdOrPath, pruneHiddenSubtrees } from './view-policy.js';
 
 export interface RouteResult {
   status: number;
@@ -17,23 +17,6 @@ function statusFromException(e: unknown): number {
   return typeof s === 'number' ? s : 400;
 }
 
-function isHiddenIdOrPath(store: MemoryStore, idOrPath: string, kind: 'folder' | 'document'): boolean {
-  if (idOrPath.startsWith('/')) return isHiddenFromMemoryView(idOrPath);
-  const path = kind === 'folder'
-    ? store.findFolderById(idOrPath)?.path ?? null
-    : store.findDocumentPathById(idOrPath);
-  return path !== null && isHiddenFromMemoryView(path);
-}
-
-function pruneHiddenSubtrees<T extends { path: string; children: T[] }>(node: T): T {
-  return {
-    ...node,
-    children: node.children
-      .filter((c) => !isHiddenFromMemoryView(c.path))
-      .map(pruneHiddenSubtrees),
-  };
-}
-
 // ---- Folder handlers ----
 
 export function listFolders(store: MemoryStore, query: URLSearchParams, cred: Credential): RouteResult {
@@ -186,10 +169,3 @@ export function search(store: MemoryStore, query: URLSearchParams, cred: Credent
   const results = store.searchDocuments(q, limit, cred, offset).filter((r) => !isHiddenFromMemoryView(r.path));
   return { status: 200, body: { results } };
 }
-
-function canReadFolder(store: MemoryStore, folder: { path: string }, cred: Credential): boolean {
-  return store.accessibleRoots(cred).some((root) => {
-    if (root === '/') return true;
-    return folder.path === root || folder.path.startsWith(root + '/');
-  }) || folder.path.startsWith('/shared');
-}
```

**File**: `packages/server/src/memory/memory-store.ts` (modified, +15/-1)
```diff
@@ -358,6 +358,13 @@ export class MemoryStore {
   }
 
   deleteFolder(folderIdOrPath: string, cred: Credential): void {
+    const deleteRecursively = this.db.transaction(
+      (idOrPath: string) => this.deleteFolderRecursively(idOrPath, cred),
+    );
+    deleteRecursively(folderIdOrPath);
+  }
+
+  private deleteFolderRecursively(folderIdOrPath: string, cred: Credential): void {
     const folder = this.resolveFolder(folderIdOrPath);
     if (!folder) throw Object.assign(new Error('not_found'), { statusCode: 404 });
     if (folder.id === 'root') throw Object.assign(new Error('cannot_delete_root'), { statusCode: 400 });
@@ -366,7 +373,7 @@ export class MemoryStore {
     // recurse
     this.db.prepare('DELETE FROM documents WHERE folder_id = ?').run(folder.id);
     const children = this.db.prepare('SELECT id FROM folders WHERE parent_id = ?').all(folder.id) as { id: string }[];
-    for (const child of children) this.deleteFolder(child.id, cred);
+    for (const child of children) this.deleteFolderRecursively(child.id, cred);
     this.db.prepare('DELETE FROM folders WHERE id = ?').run(folder.id);
   }
 
@@ -378,6 +385,13 @@ export class MemoryStore {
   // ---- Document operations ----
 
   createDocument(data: DocumentCreateInput, cred: Credential): Document {
+    const insertDocument = this.db.transaction(
+      (input: DocumentCreateInput) => this.insertDocument(input, cred),
+    );
+    return insertDocument(data);
+  }
+
+  private insertDocument(data: DocumentCreateInput, cred: Credential): Document {
     let folderId: string;
     let docPath: string;
     let title = data.title;
```

**File**: `packages/server/src/memory/view-policy.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+/**
+ * Memory view policy — the single source of truth for which memory paths are
+ * visible to API callers. Routes translate these decisions into HTTP semantics
+ * (403 on create, 404 on read/delete, empty lists) and never re-implement the
+ * path-hiding rules themselves.
+ */
+import type { MemoryStore } from './memory-store.js';
+import type { Credential } from '../auth/credentials.js';
+import { isHiddenFromMemoryView } from './hidden-paths.js';
+
+export { isHiddenFromMemoryView };
+
+export type MemoryNodeKind = 'folder' | 'document';
+
+export function isHiddenIdOrPath(store: MemoryStore, idOrPath: string, kind: MemoryNodeKind): boolean {
+  if (idOrPath.startsWith('/')) return isHiddenFromMemoryView(idOrPath);
+  const path = kind === 'folder'
+    ? store.findFolderById(idOrPath)?.path ?? null
+    : store.findDocumentPathById(idOrPath);
+  return path !== null && isHiddenFromMemoryView(path);
+}
+
+export function pruneHiddenSubtrees<T extends { path: string; children: T[] }>(node: T): T {
+  return {
+    ...node,
+    children: node.children
+      .filter((child) => !isHiddenFromMemoryView(child.path))
+      .map(pruneHiddenSubtrees),
+  };
+}
+
+export function canReadFolder(store: MemoryStore, folder: { path: string }, cred: Credential): boolean {
+  return store.accessibleRoots(cred).some((root) => {
+    if (root === '/') return true;
+    return folder.path === root || folder.path.startsWith(root + '/');
+  }) || folder.path.startsWith('/shared');
+}
```

**File**: `packages/server/tests/memory.test.ts` (modified, +55/-0)
```diff
@@ -152,3 +152,58 @@ describe('MemoryStore + ACL', () => {
     expect(list.some((f) => f.path === '/shared/teamx')).toBe(false);
   });
 });
+
+describe('MemoryStore transactional writes', () => {
+  it('rolls back auto-created folders when the document insert fails', () => {
+    kit = makeKit('mem-tx-create');
+    const admin = issue(kit, 'admin', 'admin');
+    const db = kit.db as any;
+    const originalPrepare = db.prepare.bind(db);
+    db.prepare = (sql: string) => {
+      if (sql.startsWith('INSERT INTO documents')) {
+        return { run: () => { throw new Error('insert failed'); } };
+      }
+      return originalPrepare(sql);
+    };
+
+    expect(() => kit.memory.createDocument({
+      title: 'tx doc',
+      path: '/tx-rollback/nested/doc',
+      content: 'x',
+    }, admin)).toThrow('insert failed');
+    db.prepare = originalPrepare;
+
+    expect(kit.memory.findFolderByPath('/tx-rollback')).toBeNull();
+    expect(kit.memory.findFolderByPath('/tx-rollback/nested')).toBeNull();
+  });
+
+  it('rolls back recursive folder deletion when a child delete fails', () => {
+    kit = makeKit('mem-tx-delete');
+    const admin = issue(kit, 'admin', 'admin');
+    const parent = kit.memory.createFolder({ path: '/tx-parent' }, admin);
+    kit.memory.createFolder({ path: '/tx-parent/child-a' }, admin);
+    kit.memory.createFolder({ path: '/tx-parent/child-b' }, admin);
+    kit.memory.createDocument({ title: 'a', path: '/tx-parent/child-a/a', content: 'x' }, admin);
+
+    const db = kit.db as any;
+    const originalPrepare = db.prepare.bind(db);
+    let folderDeletes = 0;
+    db.prepare = (sql: string) => {
+      const statement = originalPrepare(sql);
+      if (sql.startsWith('DELETE FROM folders')) {
+        folderDeletes++;
+        if (folderDeletes === 2) {
+          return { run: () => { throw new Error('delete failed'); } };
+        }
+      }
+      return statement;
+    };
+
+    expect(() => kit.memory.deleteFolder(parent.id, admin)).toThrow('delete failed');
+    db.prepare = originalPrepare;
+
+    expect(kit.memory.findFolderByPath('/tx-parent')).toBeTruthy();
+    expect(kit.memory.findFolderByPath('/tx-parent/child-a')).toBeTruthy();
+    expect(kit.memory.getDocument('/tx-parent/child-a/a', admin)).toBeTruthy();
+  });
+});
```

---

### Incident Patch 7: `f299d684` (2026-09-02)
**Commit Message**: fix: recover undeliverable AskUserQuestion answers

**File**: `src/engines/claude/pty/interactive-driver.ts` (modified, +27/-0)
```diff
@@ -248,6 +248,7 @@ async function answerQuestions(
     );
     if (!ready) {
       logger.warn({ qIndex: i, header: q.header }, 'pty-driver: AskUserQuestion menu never rendered');
+      await submitAnswersAsPrompt(session, answers, questions, i, logger);
       return;
     }
     await sleep(250);
@@ -292,6 +293,32 @@ async function answerQuestions(
   session.sendKeys('\r'); // "Submit answers" is the focused default
 }
 
+/**
+ * Fallback when the AskUserQuestion menu cannot be driven — typically a
+ * resumed session replaying a historical question frame that never becomes
+ * interactive again. Submit the user's answers as a plain follow-up prompt so
+ * the reply still reaches the session instead of wedging the turn.
+ */
+async function submitAnswersAsPrompt(
+  session: PtyClaudeSession,
+  answers: Record<string, string>,
+  questions: PtyParsedQuestion[],
+  fromIndex: number,
+  logger: Logger,
+): Promise<void> {
+  const parts: string[] = [];
+  for (let i = fromIndex; i < questions.length; i++) {
+    const question = questions[i];
+    const answer = (answers[question.header] ?? answers[question.question] ?? '').trim();
+    if (!answer) continue;
+    parts.push(question.header ? `${question.header}: ${answer}` : answer);
+  }
+  const text = parts.join('; ');
+  if (!text) return;
+  logger.info({ text }, 'pty-driver: AskUserQuestion unavailable — submitting answers as prompt');
+  await session.typePrompt(text);
+}
+
 /** Use the "Type something" free-text option: digit → type text → Enter. */
 async function answerFreeText(
   session: PtyClaudeSession,
```

**File**: `tests/interactive-driver-ask-fallback.test.ts` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import { describe, it, expect, vi, afterEach } from 'vitest';
+import { driveInteractiveTool } from '../src/engines/claude/pty/interactive-driver.js';
+import type { PtyClaudeSession, PtyParsedQuestion } from '../src/engines/claude/pty/contract.js';
+
+function createSession(snapshot: string) {
+  return {
+    snapshot: () => snapshot,
+    screen: () => snapshot,
+    sendKeys: vi.fn(),
+    typePrompt: vi.fn().mockResolvedValue(undefined),
+  } as unknown as PtyClaudeSession;
+}
+
+function createLogger() {
+  return { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn(), child: vi.fn(() => createLogger()) } as any;
+}
+
+const questions: PtyParsedQuestion[] = [
+  { question: 'Deploy now?', header: 'Deploy', options: ['Yes', 'No'], multiSelect: false },
+];
+
+describe('driveInteractiveTool AskUserQuestion fallback', () => {
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  it('submits answers as a prompt when the menu never renders', async () => {
+    vi.useFakeTimers();
+    const session = createSession('idle claude screen after resume');
+
+    const promise = driveInteractiveTool({
+      session,
+      tool: { name: 'AskUserQuestion', toolUseId: 'toolu_1', input: { questions: [] } },
+      response: { kind: 'answers', answers: { Deploy: 'Yes' }, questions },
+      logger: createLogger(),
+    });
+    await vi.advanceTimersByTimeAsync(21_000);
+    await promise;
+
+    expect(session.typePrompt).toHaveBeenCalledWith('Deploy: Yes');
+    expect(session.sendKeys).not.toHaveBeenCalled();
+  });
+
+  it('still drives the menu when it renders', async () => {
+    vi.useFakeTimers();
+    const session = createSession('❯ 1. Yes  2. No  Enter to select');
+
+    const promise = driveInteractiveTool({
+      session,
+      tool: { name: 'AskUserQuestion', toolUseId: 'toolu_1', input: { questions: [] } },
+      response: { kind: 'answers', answers: { Deploy: 'Yes' }, questions },
+      logger: createLogger(),
+    });
+    await vi.advanceTimersByTimeAsync(2_000);
+    await promise;
+
+    expect(session.sendKeys).toHaveBeenCalledWith('1');
+    expect(session.typePrompt).not.toHaveBeenCalled();
+  });
+});
```

---

### Incident Patch 8: `73066515` (2026-09-02)
**Commit Message**: fix: keep doc mappings on cleanup fetch failures

**File**: `src/memory/memory-client.ts` (modified, +16/-3)
```diff
@@ -23,6 +23,16 @@ import { proxyFetch } from '../utils/http.js';
 
 const DEFAULT_BASE_URL = 'http://localhost:9200';
 
+export class MemoryClientError extends Error {
+  constructor(
+    message: string,
+    public readonly status?: number,
+  ) {
+    super(message);
+    this.name = 'MemoryClientError';
+  }
+}
+
 export interface FolderTreeNode {
   id: string;
   name: string;
@@ -130,7 +140,7 @@ export class MemoryClient {
     });
     if (!res.ok) {
       const body = await res.text().catch(() => '');
-      throw new Error(`metabot-core ${res.status}: ${body}`);
+      throw new MemoryClientError(`metabot-core ${res.status}: ${body}`, res.status);
     }
     return res.json() as Promise<T>;
   }
@@ -197,8 +207,11 @@ export class MemoryClient {
         };
       }
       return null;
-    } catch {
-      return null;
+    } catch (error) {
+      if (error instanceof MemoryClientError && error.status === 404) {
+        return null;
+      }
+      throw error;
     }
   }
 
```

**File**: `src/sync/doc-sync.ts` (modified, +9/-4)
```diff
@@ -525,10 +525,15 @@ export class DocSync {
           // Note: We don't delete the wiki page itself to avoid data loss.
           // The orphaned page can be manually cleaned up.
         }
-      } catch {
-        // If we can't fetch, assume it's deleted
-        this.store.deleteDocMapping(mapping.memoryDocId);
-        if (result) result.deleted++;
+      } catch (error) {
+        // Fetch failures (network/auth/5xx) are not deletions; keep the
+        // mapping so a later sync can reconcile once the service recovers.
+        const message = error instanceof Error ? error.message : String(error);
+        if (result) result.errors.push(`Cleanup "${mapping.memoryPath}": ${message}`);
+        this.logger.warn(
+          { doc: mapping.memoryPath, err: message },
+          'Document verification failed during cleanup; keeping mapping',
+        );
       }
     }
   }
```

**File**: `tests/doc-sync.test.ts` (modified, +16/-0)
```diff
@@ -212,6 +212,22 @@ describe('DocSync', () => {
     expect(result.deleted).toBe(1);
   });
 
+  it('keeps mappings when document verification fails during cleanup', async () => {
+    const doc = makeSampleDoc();
+    setup([doc]);
+
+    await docSync.syncAll();
+
+    (docSync as any).fetchDocument = vi.fn().mockRejectedValue(new Error('metabot-core 503: unavailable'));
+    mockMemory.listDocuments.mockResolvedValue([]);
+
+    const result = await docSync.syncAll();
+    expect(result.deleted).toBe(0);
+    expect(result.errors).toHaveLength(1);
+    expect(result.errors[0]).toContain('503');
+    expect((docSync as any).store.getAllDocMappings()).toHaveLength(1);
+  });
+
   it('finds existing wiki space by name', async () => {
     setup();
     const spaceId = await (docSync as any).ensureWikiSpace();
```

---

### Incident Patch 9: `f46cfc27` (2026-09-02)
**Commit Message**: fix: prefer native claude executables on Windows

**File**: `src/engines/claude/executor.ts` (modified, +2/-14)
```diff
@@ -1,4 +1,4 @@
-import { execSync, spawn } from 'node:child_process';
+import { spawn } from 'node:child_process';
 import fs from 'node:fs';
 import os from 'node:os';
 import path from 'node:path';
@@ -11,22 +11,10 @@ import { AsyncQueue } from '../../utils/async-queue.js';
 import { buildMetaBotApiPromptContext } from '../prompt-context.js';
 import type { ApiContext } from '../prompt-context.js';
 import { makeCanUseTool } from './exit-plan-mode.js';
+import { resolveClaudePath } from './resolve-claude.js';
 
 export type { ApiContext } from '../prompt-context.js';
 
-const isWindows = process.platform === 'win32';
-
-/** Resolve the Claude Code binary path at module load time. */
-function resolveClaudePath(): string {
-  if (process.env.CLAUDE_EXECUTABLE_PATH) return process.env.CLAUDE_EXECUTABLE_PATH;
-  try {
-    const cmd = isWindows ? 'where claude' : 'which claude';
-    return execSync(cmd, { encoding: 'utf-8' }).trim().split(/\r?\n/)[0];
-  } catch {
-    return isWindows ? 'claude' : '/usr/local/bin/claude';
-  }
-}
-
 const CLAUDE_EXECUTABLE = resolveClaudePath();
 
 /**
```

**File**: `src/engines/claude/persistent-executor.ts` (modified, +2/-13)
```diff
@@ -25,7 +25,7 @@
  *   - Multi-turn overlap (still one in-flight turn at a time)
  */
 
-import { execSync, spawn } from 'node:child_process';
+import { spawn } from 'node:child_process';
 import fs from 'node:fs';
 import os from 'node:os';
 import path from 'node:path';
@@ -39,25 +39,14 @@ import { buildMetaBotApiPromptContext } from '../prompt-context.js';
 import { apply1MContextSettings } from './executor.js';
 import { makeCanUseTool } from './exit-plan-mode.js';
 import { ptyQuery } from './pty/pty-query.js';
+import { resolveClaudePath } from './resolve-claude.js';
 import type {
   PtyQueryOptions,
   PtyPromptSource,
   PtyInteractiveTool,
   PtyInteractiveResponse,
 } from './pty/contract.js';
 
-const isWindows = process.platform === 'win32';
-
-function resolveClaudePath(): string {
-  if (process.env.CLAUDE_EXECUTABLE_PATH) return process.env.CLAUDE_EXECUTABLE_PATH;
-  try {
-    const cmd = isWindows ? 'where claude' : 'which claude';
-    return execSync(cmd, { encoding: 'utf-8' }).trim().split(/\r?\n/)[0];
-  } catch {
-    return isWindows ? 'claude' : '/usr/local/bin/claude';
-  }
-}
-
 const CLAUDE_EXECUTABLE = resolveClaudePath();
 
 const ALWAYS_FILTERED_PREFIXES = ['CLAUDE'];
```

**File**: `src/engines/claude/resolve-claude.ts` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+import { execSync } from 'node:child_process';
+
+export interface ResolveClaudePathOptions {
+  /** Override for tests; defaults to the current process platform. */
+  platform?: NodeJS.Platform;
+}
+
+/**
+ * Resolve the Claude Code executable path.
+ *
+ * On Windows, PATH order may put npm's extensionless POSIX shim before the
+ * real launchers (claude.exe / claude.cmd). node-pty cannot exec the shim
+ * directly (CreateProcess error 193), so prefer native executables by suffix
+ * regardless of PATH order. An explicit CLAUDE_EXECUTABLE_PATH always wins.
+ */
+export function resolveClaudePath(options: ResolveClaudePathOptions = {}): string {
+  if (process.env.CLAUDE_EXECUTABLE_PATH) return process.env.CLAUDE_EXECUTABLE_PATH;
+
+  const isWindows = (options.platform ?? process.platform) === 'win32';
+  const command = isWindows ? 'where claude' : 'which claude';
+  try {
+    const candidates = execSync(command, { encoding: 'utf-8' })
+      .trim()
+      .split(/\r?\n/)
+      .filter(Boolean);
+
+    if (isWindows) {
+      const nativeExecutable = candidates.find((candidate) => candidate.toLowerCase().endsWith('.exe'))
+        ?? candidates.find((candidate) => /\.(cmd|bat)$/i.test(candidate));
+      if (nativeExecutable) return nativeExecutable;
+    }
+
+    return candidates[0] ?? fallbackExecutable(isWindows);
+  } catch {
+    return fallbackExecutable(isWindows);
+  }
+}
+
+function fallbackExecutable(isWindows: boolean): string {
+  return isWindows ? 'claude' : '/usr/local/bin/claude';
+}
```

**File**: `tests/resolve-claude.test.ts` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest';
+import { execSync } from 'node:child_process';
+import { resolveClaudePath } from '../src/engines/claude/resolve-claude.js';
+
+vi.mock('node:child_process', () => ({ execSync: vi.fn() }));
+
+const execSyncMock = vi.mocked(execSync);
+
+describe('resolveClaudePath', () => {
+  beforeEach(() => {
+    vi.resetModules();
+    delete process.env.CLAUDE_EXECUTABLE_PATH;
+    execSyncMock.mockReset();
+  });
+
+  it('returns the explicit CLAUDE_EXECUTABLE_PATH without searching PATH', () => {
+    process.env.CLAUDE_EXECUTABLE_PATH = 'C:/custom/claude.exe';
+    expect(resolveClaudePath({ platform: 'win32' })).toBe('C:/custom/claude.exe');
+    expect(execSyncMock).not.toHaveBeenCalled();
+  });
+
+  it('prefers claude.exe over the extensionless npm shim on Windows', () => {
+    execSyncMock.mockReturnValue(
+      'C:/npm/claude\nC:/npm/claude.cmd\nC:/Users/u/.local/bin/claude.exe\n' as never,
+    );
+    expect(resolveClaudePath({ platform: 'win32' })).toBe('C:/Users/u/.local/bin/claude.exe');
+  });
+
+  it('falls back to claude.cmd when no claude.exe exists on Windows', () => {
+    execSyncMock.mockReturnValue('C:/npm/claude\nC:/npm/claude.cmd\n' as never);
+    expect(resolveClaudePath({ platform: 'win32' })).toBe('C:/npm/claude.cmd');
+  });
+
+  it('keeps PATH order as the last resort on Windows', () => {
+    execSyncMock.mockReturnValue('C:/npm/claude\n' as never);
+    expect(resolveClaudePath({ platform: 'win32' })).toBe('C:/npm/claude');
+  });
+
+  it('keeps PATH order on non-Windows platforms', () => {
+    execSyncMock.mockReturnValue('/usr/local/bin/claude\n/opt/homebrew/bin/claude\n' as never);
+    expect(resolveClaudePath({ platform: 'darwin' })).toBe('/usr/local/bin/claude');
+  });
+
+  it('falls back per platform when the lookup fails', () => {
+    execSyncMock.mockImplementation(() => { throw new Error('not found'); });
+    expect(resolveClaudePath({ platform: 'win32' })).toBe('claude');
+    expect(resolveClaudePath({ platform: 'darwin' })).toBe('/usr/local/bin/claude');
+  });
+});
```

---

### Incident Patch 10: `474d8ce7` (2026-09-02)
**Commit Message**: fix: fall back to metabot-core bootstrap token

**File**: `packages/cli-core/src/config.ts` (modified, +11/-2)
```diff
@@ -25,11 +25,16 @@ export function tokenFilePath(): string {
   return path.join(os.homedir(), '.metabot-core', 'token');
 }
 
+export function adminBootstrapTokenFilePath(): string {
+  return path.join(os.homedir(), '.metabot-core', 'data', 'admin-bootstrap-token.txt');
+}
+
 /**
  * Resolve URL + token.
  *
  * URL precedence:   METABOT_CORE_URL → DEFAULT_URL.
- * Token precedence: METABOT_CORE_TOKEN → ~/.metabot-core/token (first line).
+ * Token precedence: METABOT_CORE_TOKEN → ~/.metabot-core/token (first line)
+ *                  → metabot-core bootstrap token (first line).
  *
  * Throws when no token is configured.
  */
@@ -40,9 +45,13 @@ export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
     const fromFile = readFirstLine(tokenFilePath());
     if (fromFile) token = fromFile;
   }
+  if (!token) {
+    const fromBootstrapFile = readFirstLine(adminBootstrapTokenFilePath());
+    if (fromBootstrapFile) token = fromBootstrapFile;
+  }
   if (!token) {
     throw new Error(
-      `no token configured — set METABOT_CORE_TOKEN env var, or write the token to ${tokenFilePath()}`,
+      `no token configured — set METABOT_CORE_TOKEN env var, write the token to ${tokenFilePath()}, or start metabot-core once to generate ${adminBootstrapTokenFilePath()}`,
     );
   }
   return { url, token };
```

**File**: `packages/metamemory/tests/cli.test.ts` (modified, +20/-0)
```diff
@@ -26,14 +26,19 @@ describe('parseArgs', () => {
 describe('loadConfig', () => {
   let tmpHome: string;
   let origHome: string | undefined;
+  let origUserProfile: string | undefined;
   beforeEach(() => {
     tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-cfg-'));
     origHome = process.env.HOME;
+    origUserProfile = process.env.USERPROFILE;
     process.env.HOME = tmpHome;
+    process.env.USERPROFILE = tmpHome;
   });
   afterEach(() => {
     if (origHome !== undefined) process.env.HOME = origHome;
     else delete process.env.HOME;
+    if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
+    else delete process.env.USERPROFILE;
     fs.rmSync(tmpHome, { recursive: true, force: true });
   });
 
@@ -51,6 +56,21 @@ describe('loadConfig', () => {
     expect(cfg.token).toBe('file-tok');
   });
 
+  it('falls back to the metabot-core bootstrap token', () => {
+    fs.mkdirSync(path.join(tmpHome, '.metabot-core', 'data'), { recursive: true });
+    fs.writeFileSync(path.join(tmpHome, '.metabot-core', 'data', 'admin-bootstrap-token.txt'), 'bootstrap-tok\n');
+    const cfg = loadConfig({});
+    expect(cfg.token).toBe('bootstrap-tok');
+  });
+
+  it('prefers ~/.metabot-core/token over the bootstrap token', () => {
+    fs.mkdirSync(path.join(tmpHome, '.metabot-core', 'data'), { recursive: true });
+    fs.writeFileSync(path.join(tmpHome, '.metabot-core', 'data', 'admin-bootstrap-token.txt'), 'bootstrap-tok\n');
+    fs.writeFileSync(path.join(tmpHome, '.metabot-core', 'token'), 'file-tok\n');
+    const cfg = loadConfig({});
+    expect(cfg.token).toBe('file-tok');
+  });
+
   it('throws when no token configured', () => {
     expect(() => loadConfig({})).toThrow(/no token configured/);
   });
```

---

### Incident Patch 11: `8fba0416` (2026-09-02)
**Commit Message**: fix: default BOTS_CONFIG in pm2 ecosystem

**File**: `ecosystem.config.cjs` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ module.exports = {
       // Environment
       env: {
         NODE_ENV: 'production',
+        BOTS_CONFIG: process.env.BOTS_CONFIG || path.join(__dirname, 'bots.json'),
         CLAUDE_MAX_TURNS: '',  // unlimited turns (override any inherited shell env)
       },
     },
```

---

### Incident Patch 12: `af76e350` (2026-09-02)
**Commit Message**: Merge pull request #387 from Ivancheng7/codex/metabot-contributing-guide

docs: align root contributing guide with development checks

**File**: `CONTRIBUTING.md` (modified, +8/-2)
```diff
@@ -19,7 +19,11 @@ cp .env.example .env
 # 4. Build
 npm run build
 
-# 5. Run in development
+# 5. Run the test suite and lint checks
+npm test
+npm run lint
+
+# 6. Run in development
 npm run dev
 ```
 
@@ -59,14 +63,16 @@ packages/        # Personal Core, Web UI, CLI, and shared packages
 1. Fork the repo and create a branch from `main`
 2. Make your changes with clear commit messages
 3. Ensure `npm run build` passes with no errors
-4. Open a PR with a clear description of what changed and why
+4. Run `npm test` and `npm run lint`
+5. Open a PR with a clear description of what changed and why
 
 ## Code Style
 
 - TypeScript strict mode
 - Use `async/await` over raw promises
 - Keep functions small and focused
 - Add JSDoc comments for public APIs
+- Use ESM imports with `.js` extensions
 
 ## Questions?
 
```

---

### Incident Patch 13: `5a709c47` (2026-09-02)
**Commit Message**: docs: align root contributing guide with development checks

**File**: `CONTRIBUTING.md` (modified, +8/-2)
```diff
@@ -19,7 +19,11 @@ cp .env.example .env
 # 4. Build
 npm run build
 
-# 5. Run in development
+# 5. Run the test suite and lint checks
+npm test
+npm run lint
+
+# 6. Run in development
 npm run dev
 ```
 
@@ -59,14 +63,16 @@ packages/        # Personal Core, Web UI, CLI, and shared packages
 1. Fork the repo and create a branch from `main`
 2. Make your changes with clear commit messages
 3. Ensure `npm run build` passes with no errors
-4. Open a PR with a clear description of what changed and why
+4. Run `npm test` and `npm run lint`
+5. Open a PR with a clear description of what changed and why
 
 ## Code Style
 
 - TypeScript strict mode
 - Use `async/await` over raw promises
 - Keep functions small and focused
 - Add JSDoc comments for public APIs
+- Use ESM imports with `.js` extensions
 
 ## Questions?
 
```

---

### Incident Patch 14: `b6ed6d94` (2026-09-02)
**Commit Message**: Merge pull request #385 from xvirobotics/fix/windows-spawn-einval

fix(oss): avoid Windows Codex spawn EINVAL

**File**: `src/engines/codex/executor.ts` (modified, +59/-2)
```diff
@@ -23,12 +23,67 @@ const FALLBACK_CODEX_CONTEXT_WINDOW = 272000;
 const CODEX_AUTH_ENV_VARS = ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN'];
 const CODEX_EXIT_GRACE_MS = 1000;
 
+function findWindowsCodexBinary(npmPrefix: string | undefined): string | undefined {
+  if (!npmPrefix) return undefined;
+
+  const target = process.arch === 'arm64'
+    ? { packageName: 'codex-win32-arm64', triple: 'aarch64-pc-windows-msvc' }
+    : { packageName: 'codex-win32-x64', triple: 'x86_64-pc-windows-msvc' };
+  const candidate = path.join(
+    npmPrefix,
+    'node_modules',
+    '@openai',
+    'codex',
+    'node_modules',
+    '@openai',
+    target.packageName,
+    'vendor',
+    target.triple,
+    'bin',
+    'codex.exe',
+  );
+  return existsSync(candidate) ? candidate : undefined;
+}
+
+export function buildCodexSpawnCommand(
+  executable: string,
+  args: string[],
+  platform: NodeJS.Platform = process.platform,
+): { command: string; args: string[] } {
+  if (platform !== 'win32') return { command: executable, args };
+
+  if (path.basename(executable).toLowerCase() === 'codex.cmd') {
+    const codexScript = path.join(
+      path.dirname(executable),
+      'node_modules',
+      '@openai',
+      'codex',
+      'bin',
+      'codex.js',
+    );
+    if (existsSync(codexScript)) {
+      return { command: process.execPath, args: [codexScript, ...args] };
+    }
+    throw new Error(`Unable to resolve Codex npm entrypoint for ${executable}`);
+  }
+
+  if (/\.(?:cmd|bat)$/i.test(executable)) {
+    throw new Error(`Codex executable must be a native executable on Windows: ${executable}`);
+  }
+  return { command: executable, args };
+}
+
 export function resolveCodexPath(explicitPath?: string): string {
   const override = explicitPath || process.env.CODEX_EXECUTABLE_PATH;
   if (override && existsSync(override)) return override;
 
   try {
-    const cmd = isWindows ? 'where codex' : 'which codex';
+    if (isWindows) {
+      const npmPrefix = process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : undefined;
+      const nativeBinary = findWindowsCodexBinary(npmPrefix);
+      if (nativeBinary) return nativeBinary;
+    }
+    const cmd = isWindows ? 'where codex.cmd' : 'which codex';
     return execSync(cmd, { encoding: 'utf-8' }).trim().split(/\r?\n/)[0];
   } catch {
     if (!isWindows) {
@@ -392,10 +447,12 @@ export class CodexExecutor {
     };
 
     try {
-      child = spawn(executable, args, {
+      const spawnCommand = buildCodexSpawnCommand(executable, args);
+      child = spawn(spawnCommand.command, spawnCommand.args, {
         cwd,
         env: buildCodexEnv(codexConfig),
         stdio: ['ignore', 'pipe', 'pipe'],
+        windowsHide: true,
       });
     } catch (err: any) {
       finishWithError(err?.message || String(err));
```

**File**: `tests/codex-build-args.test.ts` (modified, +56/-2)
```diff
@@ -1,8 +1,14 @@
 import { describe, expect, it } from 'vitest';
-import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
+import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
 import { tmpdir } from 'node:os';
 import { join } from 'node:path';
-import { buildCodexArgs, buildCodexEnv, resolveCodexModelMetadata, resolveCodexPath } from '../src/engines/codex/executor.js';
+import {
+  buildCodexArgs,
+  buildCodexSpawnCommand,
+  buildCodexEnv,
+  resolveCodexModelMetadata,
+  resolveCodexPath,
+} from '../src/engines/codex/executor.js';
 import { type CodexBotConfig, normalizeCodexReasoningEffort } from '../src/config.js';
 
 describe('buildCodexArgs', () => {
@@ -187,3 +193,51 @@ describe('buildCodexEnv', () => {
     expect(env.PATH).toBe('/bin');
   });
 });
+
+describe('buildCodexSpawnCommand', () => {
+  const args = ['exec', '--json', 'prompt with spaces & "quotes"'];
+
+  it('runs the npm Codex wrapper through Node when codex.js exists', () => {
+    const dir = mkdtempSync(join(tmpdir(), 'metabot-codex-wrapper-'));
+    try {
+      const codexScript = join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
+      mkdirSync(join(dir, 'node_modules', '@openai', 'codex', 'bin'), { recursive: true });
+      writeFileSync(codexScript, '');
+
+      expect(buildCodexSpawnCommand(join(dir, 'codex.cmd'), args, 'win32')).toEqual({
+        command: process.execPath,
+        args: [codexScript, ...args],
+      });
+    } finally {
+      rmSync(dir, { recursive: true, force: true });
+    }
+  });
+
+  it('rejects other Windows command wrappers', () => {
+    expect(() => buildCodexSpawnCommand(
+      'C:\\tools\\custom-codex.cmd',
+      args,
+      'win32',
+    )).toThrow('Codex executable must be a native executable on Windows');
+  });
+
+  it('runs Windows native executables directly', () => {
+    expect(buildCodexSpawnCommand('C:\\tools\\codex.exe', args, 'win32')).toEqual({
+      command: 'C:\\tools\\codex.exe',
+      args,
+    });
+  });
+
+  it('leaves non-Windows commands unchanged', () => {
+    expect(buildCodexSpawnCommand('/usr/local/bin/codex', args, 'linux')).toEqual({
+      command: '/usr/local/bin/codex',
+      args,
+    });
+  });
+
+  it('rejects a Codex wrapper when its npm entrypoint is missing', () => {
+    expect(() => buildCodexSpawnCommand('codex.cmd', args, 'win32')).toThrow(
+      'Unable to resolve Codex npm entrypoint',
+    );
+  });
+});
```

---

### Incident Patch 15: `46b895bf` (2026-09-02)
**Commit Message**: fix(oss): rebase Windows Codex spawn handling

**File**: `src/engines/codex/executor.ts` (modified, +4/-4)
```diff
@@ -23,10 +23,6 @@ const FALLBACK_CODEX_CONTEXT_WINDOW = 272000;
 const CODEX_AUTH_ENV_VARS = ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN'];
 const CODEX_EXIT_GRACE_MS = 1000;
 
-export function resolveCodexPath(explicitPath?: string): string {
-  const override = explicitPath || process.env.CODEX_EXECUTABLE_PATH;
-  if (override && existsSync(override)) return override;
-
 function findWindowsCodexBinary(npmPrefix: string | undefined): string | undefined {
   if (!npmPrefix) return undefined;
 
@@ -77,6 +73,10 @@ export function buildCodexSpawnCommand(
   return { command: executable, args };
 }
 
+export function resolveCodexPath(explicitPath?: string): string {
+  const override = explicitPath || process.env.CODEX_EXECUTABLE_PATH;
+  if (override && existsSync(override)) return override;
+
   try {
     if (isWindows) {
       const npmPrefix = process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : undefined;
```

#### Recent Merged Pull Requests:
- **PR #410** (2026-09-15): release: v1.3.2 (@floodsung)
- **PR #409** (2026-09-15): fix(kimi): 使用 web 命令启动 Kimi Code 0.28+ 服务 (@wengxiaoxiong)
- **PR #408** (2026-09-15): feat(feishu): 通过 larkDomain 配置支持 Lark 国际版应用 (@wengxiaoxiong)
- **PR #407** (2026-09-15): feat(feishu): isolate topic sessions and keep replies in bot DM and group threads (@wengxiaoxiong)
- **PR #406** (2026-09-15): fix(scheduler): prevent long one-time timers from firing early (@forever-ivy)
- **PR #405** (2026-09-11): release: v1.3.1 (@floodsung)
- **PR #404** (2026-09-11): feat: sync public T5T governance and session safety (@floodsung)
- **PR #403** (2026-09-15): Add GPT-6 Astra models to Codex /model picker (@amithyst)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
