# Forensic Learning Record (Deep Inspection): HarnessMD/munder-difflin

> **Canonical Artifact**: `07_PROJECT_LEARNING/chaitanyagiri-munder-difflin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chaitanyagiri/munder-difflin](https://github.com/chaitanyagiri/munder-difflin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:56:20.264Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HarnessMD/munder-difflin`
- **Description**: an open-source alternative to the dots, bots and muses of the world, run an office of claude code/codex like agents on your laptop, sandboxes or anywhere, uses your existing subscriptions
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8484 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/verify-worker-gc.mjs`
```
#!/usr/bin/env node
/**
 * Acceptance verify for the P4 ephemeral-worker GC gate (worktreeIsGcSafe in
 * src/main/git.ts). The repo has no test runner and git.ts can't be imported
 * standalone, so this mirrors the EXACT three git commands the helper runs
 * against real throwaway repos + worktrees and asserts the GC decision:
 *
 *   clean = `git status --porcelain` is empty
 *   if !clean              -> KEEP
 *   ahead = `git rev-list --count <base>..HEAD`
 *   if ahead === 0         -> GC   (HEAD reachable from base: FF / plain merge)
 *   if `git diff --quiet <base> HEAD` exits 0 -> GC  (tree identical: SQUASH merge)
 *   else                   -> KEEP
 *
 * Proves the fail-safe gate keeps un-integrated work AND correctly reclaims both
 * fast-forward AND squash-merged worktrees (the case the ahead-count alone misses).
 * Run: node scripts/verify-worker-gc.mjs   (exit 0 = all pass)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let failures = 0;
const tmp = mkdtempSync(join(tmpdir(), 'wgc-'));
const git = (cwd, ...args) => {
  try { return { ok: true, out: execFileSync('git', args, { cwd, encoding: 'utf8' }).trim() }; }
  catch (e) { return { ok: false, out: (e.stderr || e.stdout || String(e)).toString().trim() }; }
};
const gitOkExit = (cwd, ...args) => {
  // returns true when git exits 0 (used for `diff --quiet`)
  try { execFileSync('git', args, { cwd, stdio: 'ignore' }); return true; }
  catch { return false; }
};

/** The decision under test — a faithful mirror of worktreeIsGcSafe. */
function gcSafe(wtPath, base) {
  const status = git(wtPath, 'status', '--porcelain');
  if (!status.ok) return { gc: false, detail: 'status failed' };
  if (status.out.length > 0) return { gc: false, detail: 'dirty' };
  const rl = git(wtPath, 'rev-list', '--count', `${base}..HEAD`);
  if (rl.ok && parseInt(rl.out, 10) === 0) return { gc: true, detail: 'ahead==0' };
  if (gitOkExit(wtPath, 'diff', '--quiet', base, 'HEAD')) return { gc: true, detail: 'tree==base (squash)' };
  return { gc: false, detail: 'unintegrated' };
}

function check(label, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (gc=${got}, expected ${want})`);
}

// ── Build a base repo ──────────────────────────────────────────────────────
const repo = join(tmp, 'repo');
execFileSync('git', ['init', '-q', '-b', 'main', repo]);
git(repo, 'config', 'user.email', 'v@x'); git(repo, 'config', 'user.name', 'v');
writeFileSync(join(repo, 'a.txt'), 'base\n');
git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'base');

const wt = (name) => join(tmp, name);

// ── Scenario A: un-integrated commit → KEEP ─────────────────────────────────
git(repo, 'worktree', 'add', '-q', '-b', 'wA', wt('wA'), 'main');
writeFileSync(join(wt('wA'), 'a.txt'), 'base\nwork-A\n');
git(wt('wA'), 'add', '-A'); git(wt('wA'), 'commit', '-qm', 'A work');
check('A un-integrated commit', gcSafe(wt('wA'), 'main').gc, false);

// ── Scenario B: same branch fast-forward-merged into main → GC (ahead==0) ───
git(repo, 'merge', '-q', '--ff-only', 'wA'); // main now contains wA
check('B fast-forward integrated', gcSafe(wt('wA'), 'main').gc, true);

// ── Scenario C: squash merge — work in main as a NEW commit, original commits
//    stay unreachable (ahead>0) but the TREE is identical → GC via diff --quiet ─
git(repo, 'worktree', 'add', '-q', '-b', 'wC', wt('wC'), 'main');
writeFileSync(join(wt('wC'), 'b.txt'), 'feature-C\n');
git(wt('wC'), 'add', '-A'); git(wt('wC'), 'commit', '-qm', 'C1');
writeFileSync(join(wt('wC'), 'b.txt'), 'feature-C\nmore\n');
git(wt('wC'), 'add', '-A'); git(wt('wC'), 'commit', '-qm', 'C2');
// squash-merge wC's content into main as one new commit
git(repo, 'merge', '-q', '--squash', 'wC');
git(repo, 'commit', '-qm', 'squash C');
const cAhead = parseInt(git(wt('wC'), 'rev-list', '--count', 'main..HEAD').out, 10);
check('C squash-merged (content in base)', gcSafe(wt('wC'), 'main').gc, true);
console.log(`      (sanity: wC is ${cAhead} commits ahead of main yet tree-identical — ahead-count alone would never GC this)`);

// ── Scenario D: dirty working tree → KEEP ───────────────────────────────────
git(repo, 'worktree', 'add', '-q', '-b', 'wD', wt('wD'), 'main');
writeFileSync(join(wt('wD'), 'a.txt'), 'uncommitted edit\n');
check('D dirty working tree', gcSafe(wt('wD'), 'main').gc, false);

// ── Scenario E: clean worktree identical to base, no commits → GC ───────────
git(repo, 'worktree', 'add', '-q', '-b', 'wE', wt('wE'), 'main');
check('E clean + identical to base', gcSafe(wt('wE'), 'main').gc, true);

// ── Scenario F: untracked file only (still dirty) → KEEP ────────────────────
git(repo, 'worktree', 'add', '-q', '-b', 'wF', wt('wF'), 'main');
writeFileSync(join(wt('wF'), 'scratch.tmp'), 'junk\n');
check('F untracked file present', gcSafe(wt('wF'), 'main').gc, false);

rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

```

### Core Architecture Module: `src/main/hooks.ts`
```
/**
 * HookServer — the bridge between `claude` lifecycle hooks and the harness.
 *
 * Each spawned agent is launched with `--settings` pointing its hooks at a tiny
 * shim (see HOOK_SHIM in hive.ts) that forwards the hook payload to the Unix
 * domain socket this server listens on. We then:
 *   - drive avatar state from PreToolUse/PostToolUse/Notification/etc., and
 *   - report lifecycle boundaries while renderer-side guarded queues deliver
 *     inbox work only after the session reaches a safe idle prompt.
 *
 * Runs in the Electron main process.
 */
import { createServer, createConnection, type Server, type Socket } from 'node:net';
import { existsSync, rmSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Notification, type WebContents } from 'electron';
import type { HiveManager } from './hive';
import type { HarnessConfig } from './config';
import type { ControlRegistry } from './control';
import type { CircuitBreaker } from './breaker';
import { estimateCostUsd } from './pricing';
import { validateHookEvent } from '../shared/hookEvents';

/** Maximum JSON payload bytes in one newline-delimited hook frame. */
const MAX_HOOK_FRAME_BYTES = 256 * 1024;

interface HookPayload {
  /** Ownership probe from ensureListening(): answered with { pong, instance }, never a hook. */
  ping?: string;
  hook_event_name?: string;
  agent_id?: string | null;
  session_id?: string;
  transcript_path?: string;
  /** Status-line payloads only: the session's live context accounting. */
  context_window?: { total_input_tokens?: number; context_window_size?: number };
  cwd?: string;
  tool_name?: string;
  tool_input?: unknown;
  stop_hook_active?: boolean;
  prompt?: string;
  source?: string;
  notification_type?: string;
  /** Notification hook text, e.g. "Claude is waiting for your input" (idle) vs a
   *  permission request. Used to tell "needs you" from "just done / lingering". */
  message?: string;
  /** CostSample payloads only (synthesized by the proxy-bridge sidecar for
   *  qwen). Raw token counts for one response, fed to the cost ledger. */
  model?: string;
  input?: number;
  output?: number;
  cache_read?: number;
  cache_creation?: number;
}

/** Live health of the hook socket — the ONE endpoint every lifecycle hook,
 *  proxy-bridge emit and cost sample travels through. When nothing accepts on
 *  it the shims' connect() fails and they exit 0 with empty stdout, which the
 *  CLI reads as "allow": the breaker is inert, fleet.json never appears, no cost
 *  is recorded — and until #277 nothing said so. The beat writes this into
 *  fleet.json so an operator (or god) can see it without a debugger. */
export interface HookSocketHealth {
  /** HIVE_SOCK — where the shims connect. null while the hive has no root. */
  path: string | null;
  /** True only while our server is listening AND (POSIX) the path still
   *  resolves to the socket we bound — a socket FILE can exist while nothing
   *  accepts on it, so existence proves nothing. */
  listening: boolean;
  /** Epoch ms of the current bind; null when not listening. */
  since: number | null;
  /** The last bind/verify failure — 'EADDRINUSE', 'ENOENT', 'REPLACED',
   *  'NOROOT', … — or null when healthy. */
  lastError: string | null;
  /** Bind attempts since the last successful listen (0 when healthy). */
  attempts: number;
  /** Listeners this process had to abandon because a stranger took the path
   *  (see detach()) — a non-zero count is worth a look. */
  orphans: number;
}

/** Back-off between automatic re-bind attempts after a failure. Once spent, the
 *  beat still calls ensureListening() on its own cadence, so the server never
 *  stops trying — it just stops toasting. */
const BIND_RETRY_MS = [500, 1_000, 2_000, 4_000, 8_000];

/** Identity of the socket FILE we bound — enough to tell, synchronously, whether
 *  the path still leads to it (APFS/NTFS never reuse inode numbers). */
interface FileMark { dev: number; ino: number }
const markOf = (p: string): FileMark | null => {
  try { const st = statSync(p); return { dev: st.dev, ino: st.ino }; } catch { return null; }
};
const sameMark = (a: FileMark | null, b: FileMark | null): boolean =>
  !!a && !!b && a.dev === b.dev && a.ino === b.ino;

/** Who answers at the path: nobody (missing, or a stale file from a crashed
 *  run), a stranger (another live instance — never touched), or us. */
type PathOwner = 'nobody' | 'other' | 'self';

export class HookServer {
  private server: Server | null = null;
  /** This process's identity, echoed back by the ownership ping so a probe can
   *  tell "our listener" from "some other live instance" at the same path. */
  private readonly instanceId = randomUUID();
  /** The socket FILE we bound (POSIX), so stop() and the beat can tell our
   *  socket from one another instance created at the same path (#277). */
  private mark: FileMark | null = null;
  private bound: { path: string; since: number } | null = null;
  /** Listeners abandoned because a stranger owns the path now. Closing one would
   *  make libuv unlink(2) the PATH — by name, not by inode — and take the
   *  stranger's live socket with it. Kept unref()ed until the process exits. */
  private orphans: Server[] = [];
  private lastError: string | null = null;
  private bindAttempts = 0;
  private binding = false;
  private retryTimer: NodeJS.Timeout | null = null;
  /** One toast per outage, not one per retry. */
  private alerted = false;
  /** Set by stop(): the beat must not re-bind while the hive is being moved or
   *  the app is quitting — only start() re-arms. */
  private stopped = false;
  /** agentId → the live session's transcript file, learned from hook payloads.
   *  Lets the harness read per-agent telemetry (e.g. current context size)
   *  even when several agents share one cwd. */
  private transcriptPaths = new Map<string, string>();
  /** agentId → the latest context-window accounting from the statusLine shim
   *  (current tokens + the REAL window size — 200k vs 1M, which nothing else
   *  exposes). The renderer already gets this pushed live on `hive:contextUpdate`;
   *  we also retain the last value here so a main-side read (the voice read-layer's
   *  get_agent_detail / list_agents) can report "how full is each agent's context"
   *  without depending on a renderer round-trip. */
  private contextById = new Map<string, { tokens: number; limit: number; ts: number }>();
  /** The goal last delivered to each agent's current session. Goals are durable
   *  roster state, so repeating an unchanged multi-kilobyte briefing on every
   *  prompt only bloats the transcript. One entry per agent is sufficient: an
   *  agent has one live session, and a new session id replaces the old entry. */
  private deliveredGoalByAgent = new Map<string, { sessionId: string | null; goal: string | null }>();

  constructor(
    private hive: HiveManager,
    private getWebContents: () => WebContents | null,
    private getConfig: () => HarnessConfig,
    /** #7C — operator control state. Optional so tests can omit it. */
    private control?: ControlRegistry,
    /** Circuit breaker (Lane A #6.6b) — fed the hook-derived signals (session id,
     *  repeated identical tool calls). Optional so the server still runs without it. */
    private breaker?: CircuitBreaker,
    /** Standing goal text for an agent (from the durable roster). Optional so
     *  tests can omit it; when set, injected at session start and when changed. */
    private getStandingGoal?: (agentId: string) => string | null,
    /** Optional observer of every hook boundary (agentId, event, message). The
     *  worker inbox-wake watchdog (workerWake.ts) feeds on this to learn when an
     *  agent is parked on a permission/HITL prompt so it never types into it. */
    private onEvent?: (agentId: string | undefined, event: string, message: string | undefined) => void
  ) {}

  /** Bind the hook socket. Asynchronous and safe to call repeatedly — a
   *  listening server is left alone. Before #277 this returned SILENTLY when the
   *  hive had no root yet, and left the outcome of listen() to a console.error
   *  nobody reads: either way the whole control plane could be dead for a
   *  session with nothing logged. Now every outcome is logged (console and the
   *  hive's log.jsonl), failures are retried, and the beat keeps verifying. */
  start(): void {
    this.stopped = false;
    void this.ensureListening();
  }

  /** The hook socket's live state — the beat writes it into fleet.json. */
  health(): HookSocketHealth {
    const listening = !!this.server?.listening && this.bound !== null;
    return {
      path: this.hive.sockPath(),
      listening,
      since: listening && this.bound ? this.bound.since : null,
      lastError: this.lastError,
      attempts: this.bindAttempts,
      orphans: this.orphans.length
    };
  }

  /** Make sure something is listening at HIVE_SOCK, and that it is US. Called
   *  by start() and then from the beat. Three outcomes:
   *    - not bound (never, or the last bind failed) → bind, with back-off;
   *    - bound, but the path no longer leads to our socket → we are "listening"
   *      on an orphaned inode while every shim's connect() fails: log it as lost
   *      and re-bind — unless a LIVE server owns the path now, which is never
   *      stolen;
   *    - bound and verified → nothing to do. */
  async ensureListening(): Promise<HookSocketHealth> {
    if (this.stopped || this.binding) return this.health();
    const sock = this.hive.sockPath();
    if (!sock) {
      if (this.lastError !== 'NOROOT') {
        this.lastError = 'NOROOT';
        console.warn('[hive] hook socket not bound: the hive has no root yet (the beat will retry)');
      }
      return this.health();
    }
    if (this.server?.listening && this.bound) {
      // Cheap check first (POSIX): the file at the path is still the one we bound.
      if (this.mark && sameMark(this.mark, mar
```

### Core Architecture Module: `src/main/webhook.ts`
```
/**
 * WebhookServer — a generic, secret-gated inbound HTTP API that turns external
 * POSTs into hive work and lets each caller poll that work's status by a token.
 *
 * MANY endpoints, ONE server, ONE tunnel. Endpoints are told apart by the id in
 * the request path, so adding a webhook costs no extra port and no extra tunnel:
 *   - POST /<webhookId>  + `x-md-webhook-secret: <that endpoint's secret>`
 *       + JSON body matching THAT endpoint's user-editable schema
 *       → 200 `{ ok, token, taskId }`  when the endpoint's TriggerMode lets the
 *         message through (routed to god, kanban card created), or
 *       → 202 `{ ok, pending: true, token, status: 'awaiting-approval' }` when the
 *         mode holds it for the operator. Either way the caller gets its token.
 *   - GET  /<webhookId>  + `x-md-webhook-token: <token>` (or `?token=`)
 *       → returns ONLY that token's task status: `{ ok, status, title, result? }`.
 *   - POST / (bare) is an alias for the endpoint with id `legacy`, so a caller
 *     holding the pre-multi-endpoint URL keeps working across the upgrade.
 *
 * SECURITY — this is a PUBLIC surface (tunnel-forwarded), unlike the loopback
 * /reply endpoint, so the gate is strict. Every property of the single-endpoint
 * version is preserved, plus the ones multi-tenancy adds:
 *   - constant-time secret comparison (`timingSafeEqual`, length-guarded), against
 *     THAT endpoint's secret only — revoking one endpoint cannot affect another,
 *   - an UNKNOWN endpoint id is answered exactly like a WRONG secret: the compare
 *     still runs (against an unguessable per-process decoy) and the reply is the
 *     same 401 body, so the surface can't be walked to discover which ids exist,
 *   - GET does its token lookup whether or not the id is known, for the same
 *     reason: identical work, identical 404 — no enumeration signal,
 *   - secrets are held only in this class, and NEVER logged, echoed, or forwarded
 *     into the routed message / card / response (the handler is handed `{id,name}`,
 *     not the endpoint record),
 *   - the capability token is unguessable (minted by the caller-side handler,
 *     192-bit) and a GET reveals only the single task it maps to — no listing,
 *   - a request body cap + fixed-window rate limits (GLOBAL *and* per-endpoint, so
 *     one noisy caller can't starve the others) bound abuse before parsing/crypto.
 *
 * Runs in the Electron main process. Deliberately free of any `electron` import so
 * it can be unit-/smoke-tested as a plain Node module. The actual card creation +
 * god routing + token→status lookup are injected as callbacks (they need hive
 * access, which lives in the main entrypoint); this class owns only transport,
 * the secret gate, schema validation, rate limiting, and the tunnel.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { validateAgainstSchema, type InboundKind } from '../shared/triggers';
// NOTE: `tunnelmole` is an ESM-only package. The Electron main process is bundled
// as CommonJS, so a static `import` gets externalized into `require('tunnelmole')`
// and throws ERR_REQUIRE_ESM at load. It is imported dynamically inside
// `openTunnel()` instead — Rollup preserves dynamic import() in CJS output, which
// can load ESM. Do not hoist this back to a top-level import.

/** One servable endpoint — the structural subset of `WebhookTrigger` this class
 *  needs. A whole `WebhookTrigger` is assignable, so callers pass config rows
 *  straight in without a mapping step. */
export interface WebhookEndpoint {
  id: string;
  name: string;
  /** Shared secret the caller echoes in `x-md-webhook-secret`. Never leaves this class. */
  secret: string;
  /** User-editable JSON Schema (serialised) inbound bodies are checked against. */
  schema: string;
}

/** What the dispatch handler is told about the endpoint a message arrived on.
 *  DELIBERATELY excludes `secret`: the handler writes cards, hive messages and
 *  history rows, and none of them may ever be able to carry a live credential. */
export interface WebhookEndpointRef {
  id: string;
  name: string;
}

/** The validated body of an accepted POST — just the work to do plus the sender's
 *  own framing of it. The secret has already been verified and is intentionally
 *  NOT part of this shape, so it can never be forwarded onward. */
export interface WebhookInbound {
  message: string;
  title?: string;
  /** Declared by the caller when they bothered to; the handler classifies when not. */
  kind?: InboundKind;
  /** Who is sending, for the trigger history. Falls back to the endpoint name. */
  from?: string;
}

/** What the handler did with an accepted message. `pending` is the whole point of
 *  the split: the caller is told, honestly, whether work actually started. */
export interface WebhookDispatch {
  /** Capability token to hand back — the ONLY echo, and only ever returned once. */
  token: string;
  /** Kanban card id; absent while a message waits for the operator (no card yet). */
  taskId?: string;
  /** true = held for operator approval (→ 202), false = routed to god (→ 200). */
  pending: boolean;
}

/** What a GET exposes for a token — mirrors the kanban's public columns only,
 *  plus the synthetic statuses a held message reports before it becomes work. */
export interface WebhookTaskStatus {
  status: string;
  title: string;
  result?: string;
}

export interface WebhookServerOptions {
  /** Local TCP port the HTTP server binds to (and the tunnel forwards to). */
  port: number;
  /** The endpoints to serve. May be swapped later with `setEndpoints`. */
  endpoints: WebhookEndpoint[];
  /**
   * Turn a verified POST into hive work (or into a held message awaiting the
   * operator). Return null to signal a server-side failure (→ 500). The token it
   * returns is the ONLY thing echoed to the caller; no secret ever reaches here.
   */
  onMessage: (msg: WebhookInbound, endpoint: WebhookEndpointRef) => WebhookDispatch | null;
  /**
   * Resolve a capability token to its task's public status, or null when the
   * token maps to nothing (→ 404). MUST be scoped to the one token — it must
   * never reveal or enumerate any other task.
   */
  lookupStatus: (token: string) => WebhookTaskStatus | null;
}

/** Reject bodies larger than this before buffering — callers send tiny JSON; the
 *  cap stops an unauthenticated peer forcing unbounded memory use pre-auth. */
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
/** Cap how long we wait for the public tunnel before giving up (server stays up). */
const TUNNEL_START_TIMEOUT_MS = 10_000;
/** Basic abuse guard: at most this many requests per fixed window, globally. */
const RATE_LIMIT = 120;
/** …and this many per endpoint, so one noisy caller burns its own budget first
 *  instead of everyone's. Strictly below the global cap, or it would never bind. */
const PER_ENDPOINT_RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

/** Bare `POST /` keeps serving the endpoint the pre-multi-endpoint migration
 *  parked under this id, so a caller already pointed at the old URL is unaffected. */
export const LEGACY_ENDPOINT_ID = 'legacy';

/** Rate-limit bucket shared by EVERY unknown id. One bucket, not one per id:
 *  per-id buckets for ids we don't serve would let a prober both grow our memory
 *  unboundedly and — worse — observe that unknown ids never hit the per-endpoint
 *  limit while real ones do. Sharing one bucket makes the two indistinguishable. */
const UNKNOWN_BUCKET = ':unknown';

export class WebhookServer {
  private server: Server | null = null;
  private tunnelUrl: string | null = null;
  private readonly port: number;
  private endpoints = new Map<string, WebhookEndpoint>();
  private readonly onMessage: (msg: WebhookInbound, endpoint: WebhookEndpointRef) => WebhookDispatch | null;
  private readonly lookupStatus: (token: string) => WebhookTaskStatus | null;
  /** Compared against when the requested id doesn't exist, purely so the failure
   *  path does the same work as a wrong-secret failure. Random per process and
   *  never exported, so it cannot be matched even by accident. */
  private readonly decoySecret = randomBytes(32).toString('hex');
  // Fixed-window rate limiters keyed by bucket ('' = global, else the endpoint id).
  // The remote IP is the tunnel's, so per-IP would be meaningless behind tunnelmole.
  private windows = new Map<string, { start: number; count: number }>();

  constructor(opts: WebhookServerOptions) {
    this.port = opts.port;
    this.onMessage = opts.onMessage;
    this.lookupStatus = opts.lookupStatus;
    this.setEndpoints(opts.endpoints);
  }

  /**
   * Swap the served endpoint list WITHOUT restarting the server or the tunnel —
   * the operator adds, edits and revokes webhooks from the UI, and a restart would
   * mint a fresh (ephemeral) tunnel URL, silently breaking every caller of every
   * OTHER endpoint. The map is rebuilt wholesale so a removed id stops resolving
   * on the very next request.
   */
  setEndpoints(list: WebhookEndpoint[]): void {
    const next = new Map<string, WebhookEndpoint>();
    for (const e of list) {
      if (!e || typeof e.id !== 'string' || !e.id || typeof e.secret !== 'string' || !e.secret) continue;
      next.set(e.id, e);
    }
    this.endpoints = next;
    // Drop rate-limit state for ids we no longer serve; keep the global and
    // unknown buckets so a swap can't be used to reset an in-flight flood.
    for (const key of [...this.windows.keys()]) {
      if (key === '' || key === UNKNOWN_BUCKET) continue;
      if (!next.has(key)) this.windows.delete(key);
    }
  }

  /** Ids currently served, for the settings surface that shows per-endpoint URLs. */
  endpointIds(): string[] {
    return [...this.endpoints.keys()];
  }

  /** The public tunnel URL, or null when no tunnel is up. */
  publicUrl(): string | null {
    return
```

### Core Architecture Module: `src/main/workerLaunch.ts`
```
/**
 * How a god-hired worker's spawn request becomes an executable + argv, as a
 * pure function: this exact translation silently killed real workers for days
 * while reporting success, which is what earned it a unit test.
 */
import {
  autoModeFlagForProvider,
  defaultCommandForProvider,
  hasAutoModeStance,
  inferAgentProvider,
  normalizeAgentProvider
} from '../shared/agentProvider';
import { tokenizeCommand } from '../shared/commandLine';

export interface WorkerLaunch {
  /** The executable name alone — what the PTY layer resolves and spawns. */
  bin: string;
  /** Everything else, in argv form, model flag included when applicable. */
  args: string[];
  /** The full effective command line, for display and floor cards. */
  command: string;
}

export function buildWorkerLaunch(opts: {
  /** `command` from the spawn request — god authors a full command LINE. */
  requestCommand?: unknown;
  requestProvider?: unknown;
  /** Separate `model` field from the request, if any. */
  requestModel?: unknown;
  defaultCommand?: string;
  /** The app's auto (skip-permissions) setting. */
  autoMode: boolean;
}): WorkerLaunch {
  const requestCommand =
    typeof opts.requestCommand === 'string' && opts.requestCommand.trim()
      ? opts.requestCommand.trim()
      : '';
  const requestProvider = normalizeAgentProvider(opts.requestProvider);
  const fallbackCommand = opts.defaultCommand ?? 'claude';
  // An explicit command may be a wrapper or shim and remains authoritative.
  // Without one, keep the executable and provider behavior coherent by taking
  // the provider's canonical command before the configured legacy fallback.
  let command =
    requestCommand ||
    (requestProvider ? defaultCommandForProvider(requestProvider, fallbackCommand) : fallbackCommand);
  // Inherit the app's auto (skip-permissions) mode when the request takes no
  // stance of its own: a headless worker has no human to click through tool
  // prompts, so without the flag it stalls at the first ask until the idle
  // reaper kills it. The flag is the PROVIDER'S — a codex worker needs
  // `-a never -s workspace-write`, and claude's --permission-mode
  // would mean nothing to it (an earlier hardcoded-claude version left every
  // non-claude worker stalling; review caught it). An explicit stance in the
  // request still wins: the flag's leading token already present as a TOKEN
  // (not substring — copilot's flag starts with `-s`) means the request chose.
  const provider = inferAgentProvider(command, requestProvider);
  const autoFlag = opts.autoMode ? autoModeFlagForProvider(provider) : '';
  if (autoFlag && !hasAutoModeStance(tokenizeCommand(command), provider)) {
    command += ` ${autoFlag}`;
  }
  // god authors `command` as a full command LINE ("claude --model … --permission-mode …"),
  // but the PTY layer takes ONE executable name (resolveCommand) plus argv — the
  // unsplit line made node-pty exec a binary literally named like the whole
  // string → ENOENT → the worker died within ~1s of spawning while its request
  // archived as .done (this killed both flag-carrying Ryan spawns on 2026-08-16;
  // only the bare-`claude` one lived). Split with the SAME tokenizer the
  // renderer's spawn flows use, and hand the flags over as argv.
  const tokens = tokenizeCommand(command);
  const bin = tokens[0] || command;
  const flags = tokens.slice(1);
  // A separate `model` field only applies when the command line didn't pick a
  // model itself (spawnAgentCore likewise skips its default-model injection
  // when argv already carries --model).
  const model =
    typeof opts.requestModel === 'string' && opts.requestModel.trim() ? opts.requestModel.trim() : '';
  const args = [...flags, ...(model && !flags.includes('--model') ? ['--model', model] : [])];
  return { bin, args, command };
}

```

### Core Architecture Module: `src/main/workerWake.ts`
```
/**
 * WorkerWakeWatchdog — main-process inbox-wake watchdog for worker agents (#151).
 *
 * The renderer's idle inbox-wake nudge (useHive.ts effect #3) is the ONLY wake
 * path for a worker that has gone quiet at its prompt: it polls on a setInterval
 * in the renderer, so a throttled/occluded window (Chromium suspends background
 * setInterval timers) can miss the moment mail lands and the worker then sits on
 * an undrained inbox forever — the orchestrator ("god") never has this problem
 * because the main process re-engages it on its own heartbeat cadence.
 *
 * This watchdog is the worker-side counterpart: on a cadence it finds live
 * workers that are genuinely idle, have newly arrived inbox mail, are not
 * paused / not awaiting a human decision, and have not been nudged recently —
 * then types the same guarded nudge the renderer would have, directly into the
 * PTY. Message ids make this edge-triggered: unchanged undrained mail is never
 * re-announced once a minute forever.
 *
 * Safety mirrors the renderer's guarded queue-drain (useHive.ts dispatch):
 *  - only a GENUINELY idle worker is nudged (no PTY output for IDLE_MS — the
 *    same quiescence the renderer's idle fallback uses), never a mid-turn one,
 *  - never inside the boot sequence (BOOT_GRACE_MS from spawn, mirroring the
 *    renderer's bootGraceUntil),
 *  - delivery paused / agent paused / halted → no nudge (ControlRegistry),
 *  - a recent permission/HITL notification re-arms a block (HITL_REARM_MS) so a
 *    prompt the human is deciding on is never typed into,
 *  - a per-worker cooldown (NUDGE_COOLDOWN_MS) so the watchdog and the renderer
 *    nudge don't stack on top of each other.
 *
 * Deliberately the renderer's own nudge text, and the same type pattern the
 * renderer's submitToPty uses (text first, Enter as a separate keystroke).
 *
 * No electron import — unit-testable (mirrors ControlRegistry).
 */

/** The exact nudge the renderer's inbox-wake loop would have typed. */
export const WORKER_WAKE_NUDGE =
  'You have new hive inbox message(s) — read your inbox, act on them now, and move handled ones to inbox/.done/. Act autonomously; only message god if you genuinely need a decision.';

/** No PTY output for this long = genuinely idle (renderer QUIESCE_IDLE_MS). */
export const WORKER_WAKE_IDLE_MS = 12_000;
/** Never nudge inside the boot sequence (renderer BOOT_GRACE_MS). */
export const WORKER_WAKE_BOOT_GRACE_MS = 35_000;
/** Minimum gap between two watchdog nudges of the same worker. */
export const WORKER_WAKE_COOLDOWN_MS = 60_000;
/** A permission/HITL notification blocks nudges for this long after it fires. */
export const WORKER_WAKE_HITL_REARM_MS = 5 * 60_000;
/** Mail this old with NO session activity since it landed = a STALLED worker:
 *  its CLI never took the first turn (a boot-time nudge lost while the TUI was
 *  still drawing, an occluded renderer that never typed one). PTY output cannot
 *  vouch for such a worker — a TUI redraws its chrome without doing any work,
 *  and the boot sequence itself is output — so past this age the quiet-output
 *  and never-output rules are bypassed, and so is the announced-ids edge trigger
 *  (#358 is for a worker that HEARD the announcement; a stalled one did not),
 *  still subject to paused/halted/HITL/boot-grace/cooldown. Observed live
 *  2026-09-06: a worker sat 17 minutes on its work order with 0 tokens and no
 *  transcript until the human typed "read your inbox" by hand; this watchdog
 *  never fired.
 *
 *  "Session activity" is a tool span or a usage sample with tokens (telemetry,
 *  which only Claude Code exports) OR a hook event that proves a turn
 *  (UserPromptSubmit / PreToolUse / PostToolUse / Stop — every engine the
 *  harness shims sends those). The rule is OFF for an agent that has produced
 *  neither a telemetry sample nor a single hook event: with no channel that
 *  could ever show a turn, "no activity" is not evidence of anything, and a
 *  Codex/Gemini/grok worker would otherwise read as stalled forever and be
 *  nudged every cooldown while working — the repeated nudging #368 removed. */
export const WORKER_WAKE_STALL_MS = 90_000;
/** Minimum age of pending mail before a held worker is reported in the log. */
export const WORKER_WAKE_REPORT_MS = 60_000;

/** A hook event message that means "the agent needs the human" — permission /
 *  approve / confirm prompts (mirrors the renderer's needsHuman detection in
 *  useHive.ts). Anything matching the idle-waiting shape is NOT a HITL hold. */
export type HookClass = 'needsHuman' | 'idle' | null;

export function classifyHook(event: string | undefined, message: string | undefined): HookClass {
  if (event === 'Notification') {
    const msg = (message ?? '').toLowerCase();
    const idleWaiting = !msg
      || msg.includes('waiting for your input')
      || msg.includes('is idle')
      || msg.includes('waiting for input');
    const needsHuman = msg.includes('permission')
      || msg.includes('approve')
      || msg.includes('confirm')
      || msg.includes('needs your');
    if (needsHuman && !idleWaiting) return 'needsHuman';
    return 'idle';
  }
  return null;
}

/** A hook event that proves the CLI took a turn — the activity signal every
 *  engine the harness shims produces (Codex, Gemini, grok, … are mapped onto
 *  these names in hive.ts), unlike telemetry, which only Claude Code exports.
 *  SessionStart is the CLI coming up, not a turn: a worker whose boot nudge was
 *  lost has exactly that and nothing else. Notification is the CLI waiting. */
export function isTurnHook(event: string | undefined): boolean {
  switch (event) {
    case 'UserPromptSubmit':
    case 'PreToolUse':
    case 'PostToolUse':
    case 'PostToolUseFailure':
    case 'Stop':
    case 'StopFailure':
    case 'SubagentStart':
    case 'SubagentStop':
      return true;
    default:
      return false;
  }
}

/** One worker's live facts, gathered by the caller each beat. */
export interface WorkerWakeFacts {
  /** Worker agent id (god is never a candidate). */
  agentId: string;
  /** True when this agent is the orchestrator — god is never nudged. */
  isGod?: boolean;
  /** Live PTY id, or undefined when the agent has no terminal. */
  ptyId?: string;
  /** Timestamp of the PTY's last output (0 = never output). */
  lastOutputAt: number;
  /** IDs of undrained inbox messages (empty → nothing to wake for). */
  inboxIds: readonly string[];
  /** ControlRegistry snapshot flags. */
  autoDeliveryPaused: boolean;
  paused: boolean;
  halted: boolean;
  /** When telemetry last showed the CLI doing a turn — a tool span, or a usage
   *  sample WITH tokens (activityEvidenceAt) — or 0/undefined when it never has. */
  lastActivityAt?: number;
  /** True when the telemetry collector holds ANY usage sample for the agent
   *  (even the zero-token one stamped at session start): its CLI exports
   *  telemetry, so a missing turn there means something. Only Claude Code
   *  does; for every other engine the hooks are the activity channel. */
  hasTelemetry?: boolean;
  /** created_at of the OLDEST undrained inbox message, or 0/undefined when
   *  unknown (the stall rule then stays off — fail closed, as before). */
  oldestMailAt?: number;
}

/** Why a worker with pending mail is NOT being nudged right now. */
export type WorkerWakeHold =
  | 'god' | 'no-mail' | 'no-pty'
  | 'delivery-paused' | 'paused' | 'halted'
  | 'booting' | 'mid-turn' | 'boot-grace' | 'hitl' | 'announced' | 'cooldown';

/** The inbox ids that count as mail: non-empty strings only. */
function liveInboxIds(f: WorkerWakeFacts): Set<string> {
  return new Set(f.inboxIds.filter((id) => typeof id === 'string' && id.length > 0));
}

/** Mail has waited WORKER_WAKE_STALL_MS and the CLI has shown no session
 *  activity since it landed: whatever its terminal is printing, this worker is
 *  not working the mail. */
export function isStalledWorker(f: WorkerWakeFacts, now = Date.now()): boolean {
  const mailAt = f.oldestMailAt ?? 0;
  if (mailAt <= 0 || liveInboxIds(f).size === 0) return false;
  if (now - mailAt < WORKER_WAKE_STALL_MS) return false;
  return (f.lastActivityAt ?? 0) < mailAt;
}

/** The subset of telemetry the activity rule reads. Structural so the beat can
 *  hand it the collector's own types and tests can hand it literals. */
export interface ActivityEvidence {
  /** The agent's latest usage sample (cumulative counters, ts = last update). */
  usage?: { ts: number; input: number; output: number } | null;
  /** Tool spans the agent has run, in arrival order. */
  spans?: ReadonlyArray<{ ts: number }> | null;
}

/** When the CLI last demonstrably did a turn, or 0 when it never has.
 *
 *  A usage sample only counts when it carries tokens: the collector stamps a
 *  sample at session start with every counter at zero, and a boot-time sample
 *  is exactly what a worker that never took its first turn has. A tool span is
 *  always a turn. Observed live 2026-09-07: a worker with 0 tokens, no tool and
 *  no transcript read as "last activity 63s ago" and was held as mid-turn. */
export function activityEvidenceAt(ev: ActivityEvidence): number {
  const u = ev.usage;
  const worked = u && (Number(u.input) || 0) + (Number(u.output) || 0) > 0 ? Number(u.ts) || 0 : 0;
  let span = 0;
  for (const s of ev.spans ?? []) if (s && Number(s.ts) > span) span = Number(s.ts);
  return Math.max(worked, span);
}

export class WorkerWakeWatchdog {
  /** ptyId → spawn timestamp (boot grace). */
  private spawnedAt = new Map<string, number>();
  /** agentId → last nudge timestamp (cooldown). */
  private lastNudgeAt = new Map<string, number>();
  /** agentId → inbox ids included in the last nudge. This turns the watchdog
   *  into an edge trigger: a worker is nudged again only when a new id appears. */
  private announcedInboxIds = new Map<string, Set<string>>();
  /** agentId → timestamp of the last needsHuman hook notification. */
  private lastHumanNeedsAt = new Map<st
```

### Core Architecture Module: `src/renderer/src/App.tsx`
```
import { useEffect, useState } from 'react';
import { useStore, selectedAgent } from '@/store/store';
import { startMockLoop, stopMockLoop } from '@/store/mockEvents';
import type { HarnessConfig } from '@/store/config';
import { DEFAULT_ORG_TRIGGER } from '@shared/triggers';
import { OfficeFloor } from '@/scene/office/OfficeFloor';
import { useHive } from '@/hooks/useHive';
import { useResolvedGodName } from '@/hooks/useResolvedGodName';
import { useGodNameSync } from '@/i18n/useGodNameSync';
import { useDirectionSync } from '@/i18n/useDirection';
import { useArabicTerminalSync } from '@/terminal/useArabicTerminalSync';
import { MemoryPanel } from '@/components/MemoryPanel';
import { AgentDetailPanel } from '@/components/AgentDetailPanel';
import { AgentStrip } from '@/components/AgentStrip';
import { AddAgentModal } from '@/components/AddAgentModal';
import { MichaelBooting } from '@/components/MichaelBooting';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { HivePicker } from '@/components/HivePicker';
import { QuitWarningModal, type ClosingTimeState } from '@/components/QuitWarningModal';
import { CompletionToast } from '@/realtime/CompletionToast';
import { UpdateToast } from '@/components/UpdateToast';
import { UpdateBadge } from '@/components/UpdateBadge';
import { useAppTheme, toggleAppTheme } from '@/design/theme';
import { SettingsModal, type Section as SettingsSection } from '@/components/SettingsModal';
import { PixelPanel } from '@/components/PixelPanel';
import { PixelButton } from '@/components/PixelButton';
import { Icon } from '@/components/Icon';
import { SidebarSplitter } from '@/components/SidebarSplitter';
import { acquireTerminal, notifyThemeChangeAll } from '@/components/terminalPool';
import { FullscreenTerminal } from '@/components/FullscreenTerminal';
import { TaskDetailOverlay } from '@/components/TaskDetailOverlay';
import { IdePanel } from '@/ide/IdePanel';
import { useHoldOptionToTalk } from '@/freeflow/holdOption';
import brandLogo from '@brand/logo.png?url';

// Injected at build time from package.json (see electron.vite.config.ts).
declare const __APP_VERSION__: string;

export function App() {
  // Point every {{godName}} string at the orchestrator's real, renameable name.
  useGodNameSync();
  // Mirror the document only for a user who has picked an RTL app language.
  useDirectionSync();
  // Let terminals that are ALREADY open follow a language switch too.
  useArabicTerminalSync();
  const agent = useStore(selectedAgent);
  const agents = useStore(s => s.agents);
  const agentCount = agents.length;
  const bootingGodName = useResolvedGodName();
  const addAgentOpen = useStore(s => s.addAgentOpen);
  const setAddAgentOpen = useStore(s => s.setAddAgentOpen);
  const clearPendingHires = useStore(s => s.clearPendingHires);
  const godStatus = useStore(s => s.godStatus);
  const fullscreenAgentId = useStore(s => s.fullscreenAgentId);
  const appThemeNow = useAppTheme();
  const sidebarWidth = useStore(s => s.sidebarWidth);
  const setSidebarWidth = useStore(s => s.setSidebarWidth);
  const ideOpen = useStore(s => s.ideOpen);
  const setIdeOpen = useStore(s => s.setIdeOpen);

  const [config, setConfig] = useState<HarnessConfig | null>(null);
  // Whether the user has passed the launch-time hive picker this session. Starts
  // true (skip the picker) right after a hive SWITCH — changeHome relaunches and
  // leaves a one-shot localStorage flag so we don't bounce back onto the picker for
  // the hive we just chose. Also set true on onboarding completion (below).
  const [hiveOpened, setHiveOpened] = useState<boolean>(() => {
    try {
      if (window.localStorage.getItem('cth.skipHivePickerOnce')) {
        window.localStorage.removeItem('cth.skipHivePickerOnce');
        return true;
      }
    } catch { /* localStorage unavailable — show the picker */ }
    return false;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Which tab Settings opens on. Set by a `cth:open-settings` deep link, reset
   *  to undefined (→ General) whenever the modal is opened the normal way. */
  const [settingsSection, setSettingsSection] = useState<SettingsSection | undefined>(undefined);
  const [quitWarn, setQuitWarn] = useState<{ ptyCount: number } | null>(null);
  const [closing, setClosing] = useState<ClosingTimeState | null>(null);
  const [vpWidth, setVpWidth] = useState<number>(window.innerWidth);

  // Deep link into Settings from anywhere in the tree. Settings' open state is
  // local to App, so a nested control (e.g. "set it now" beside a disabled Talk
  // button) has no path to it without threading a prop through every layer
  // between; a window event keeps that plumbing out of the components in
  // between, matching the existing `cth:` CustomEvent convention.
  useEffect(() => {
    const onOpenSettings = (e: Event): void => {
      const section = (e as CustomEvent<{ section?: SettingsSection }>).detail?.section;
      setSettingsSection(section);
      setSettingsOpen(true);
    };
    window.addEventListener('cth:open-settings', onOpenSettings);
    return () => window.removeEventListener('cth:open-settings', onOpenSettings);
  }, []);

  // Initial config load
  useEffect(() => {
    let cancelled = false;
    window.cth.getConfig().then(c => {
      if (cancelled) return;
      setConfig(c);
      // Mirror the Free Flow flag into the store so the composer mic button shows
      // only when enabled (Settings keeps this in sync on save).
      useStore.getState().setFreeflowEnabled(!!c.freeflowEnabled);
      // Mirror boolean key-presence ONLY (never the key value) so the composer can
      // show the voice button disabled-with-tooltip when Free Flow is on but no
      // Groq key is set (Settings keeps this in sync on save).
      useStore.getState().setHasGroqKey(!!c.groqApiKey);
      // Mirror the active office theme so OfficeFloor renders it (gated on the
      // tvShowOffices flag; off = always the office). Settings keeps this synced.
      useStore.getState().setOfficeTheme(c.tvShowOffices ? (c.officeTheme ?? 'office') : 'office');
      // Mirror the triggers so Settings → Connections and the Command Center's
      // Triggers tab read one list, not two copies that drift — whichever surface
      // saves calls these same setters and the other repaints. No extra IPC: main
      // deep-fills both fields on every config read (withTriggerDefaults), so
      // getConfig() already serves what listWebhooks()/getOrgTrigger() would.
      // `c` is typed as the PRELOAD's HarnessConfig, which hasn't picked the two
      // fields up yet (another lane's file); the renderer mirror type declares them.
      const withTriggers = c as HarnessConfig;
      useStore.getState().setWebhookTriggers(withTriggers.webhookTriggers ?? []);
      useStore.getState().setOrgTrigger(withTriggers.orgTrigger ?? DEFAULT_ORG_TRIGGER);
    });
    // Mirror BYOK OpenAI key presence (boolean only; the key never leaves main) so the
    // Realtime Michael voice toggle can gate on it. Lives in the secret broker, not
    // config — so fetch it rather than derive from c.
    window.cth.realtimeHasOpenAiKey().then(has => {
      if (!cancelled) useStore.getState().setHasOpenAiKey(has);
    });
    return () => { cancelled = true; };
  }, []);

  // Free Flow entry point B — hold-Option (⌥) to talk. In-renderer push-to-talk
  // for whichever agent the user is viewing; gated on the flag, terminal-safe
  // (solo-hold threshold, aborts on any other key). See freeflow/holdOption.ts.
  useHoldOptionToTalk();

  // Config subscription — the copy loaded above would otherwise go stale the
  // moment anything saves a setting.
  useEffect(() => window.cth.onConfigChanged(setConfig), []);

  // Quit warning subscription
  useEffect(() => window.cth.onCloseRequested((info) => setQuitWarn(info)), []);

  // Shareable hires: a validated manifest arriving via the munderdifflin://
  // deep link (or file import) pre-fills the Add-Agent modal. Never spawns by itself.
  const enqueuePendingHires = useStore(s => s.enqueuePendingHires);
  const closeAddAgentReview = () => {
    clearPendingHires();
    setAddAgentOpen(false);
  };
  useEffect(() => {
    const unsub = window.cth.onHireImport?.((m) => {
      enqueuePendingHires([m]);
      setAddAgentOpen(true);
    });
    // Pull anything that arrived before this subscription existed (cold-start
    // deep links; packaged renderers load too fast for push-on-load).
    void window.cth.drainPendingHires?.().then((queued) => {
      if (queued && queued.length > 0) {
        enqueuePendingHires(queued);
        setAddAgentOpen(true);
      }
    });
    return unsub;
  }, [enqueuePendingHires, setAddAgentOpen]);
  useEffect(() => window.cth.onHireError?.((info) => {
    console.error('[hire] import failed:', info.error);
  }), []);

  // Closing-time progress: drives the quit dialog's "wrapping up" view. The
  // dialog stays up through the whole protocol; on 'complete' the main process
  // tears down and quits by itself moments later.
  useEffect(() => window.cth.onClosingTime?.((ev) => {
    if (ev.phase === 'cancelled') { setClosing(null); return; }
    setClosing({ phase: ev.phase, acked: ev.acked, total: ev.total });
    if (ev.phase === 'started' || ev.phase === 'progress') setQuitWarn((w) => w ?? { ptyCount: 0 });
  }), []);

  const startClosingTime = async () => {
    const res = await window.cth.startClosingTime();
    if (!res.ok) setClosing({ phase: 'error', acked: 0, total: 0, error: res.error });
  };
  const cancelClosingTime = () => {
    void window.cth.cancelClosingTime();
    setClosing(null);
  };

  // The hive: god-agent bootstrap, hook-driven avatars, idle-agent waking. Held
  // off until the user opens a hive in the launch picker (passing null no-ops the
  // hook) so Michael doesn't boot against the current home while the user may be
  // about to switch to a different one.
  useHive(hiveOpen
```

### Core Architecture Module: `src/renderer/src/components/AddAgentModal.tsx`
```
import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelPanel } from './PixelPanel';
import { PixelButton } from './PixelButton';
import { SpritePortrait } from './SpritePortrait';
import { Icon } from './Icon';
import { ProviderLogo } from './ProviderLogo';
import { useStore, type Agent } from '@/store/store';
import { OFFICE_CAST, DEFAULT_CHARACTER, type OfficeCharacterName } from '@/scene/office/cast';
import { type AccentColorName } from '@/design/tokens';
import type { HireManifest } from '@shared/hire';
import { hireQueueProgress } from '@shared/hireQueue';
import { MCP_CATALOG } from '@shared/mcpCatalog';
import {
  OSS_LOCAL_PICKS,
  OSS_PROVIDER_PICKS,
  localSlugFor,
  hasOssQuickPicks,
  OSS_BLOG_LINKS
} from '@shared/ossModels';
import {
  type AgentProvider,
  type HarnessConfig,
  AGENT_PROVIDER_PRESETS,
  buildSpawnCommand,
  tokenizeCommand,
  modelsForProvider,
  inferAgentProvider,
  providerPreset,
  isClaudeProvider
} from '@/store/config';
import { useRtl } from '@/i18n/useDirection';

const ACCENTS: AccentColorName[] = ['coral', 'mint', 'sky', 'lemon', 'lilac', 'peach'];

// OSS quick-pick chip styling (ondev-c) — mirrors the model-picker chips.
const ossChip = (active: boolean, accent: AccentColorName): CSSProperties => ({
  padding: '3px 8px 1px',
  background: active ? `var(--cth-${accent}-light)` : 'var(--cth-cream-100)',
  boxShadow: active ? 'inset 0 0 0 1.5px var(--cth-ink-500)' : 'inset 0 0 0 1px var(--cth-ink-100)',
  fontFamily: 'var(--cth-font-ui)', fontSize: 12,
  color: 'var(--cth-ink-900)', cursor: 'pointer', border: 'none'
});
const ossGroupHead: CSSProperties = {
  fontFamily: 'var(--cth-font-display)', fontSize: 8, lineHeight: '12px',
  color: 'var(--cth-ink-500)', textTransform: 'uppercase', marginBottom: 4
};
const ossLink: CSSProperties = { color: 'var(--cth-ink-900)', textDecoration: 'underline', cursor: 'pointer' };

// One-click briefing templates — fill Description + Goal with a sharp, ready-to-run
// role so a user isn't staring at a blank field (item 7). The template BRIEFINGS
// stay English (they become agent prompts — see the i18n report); only the
// picker labels are translated.
const DESCRIPTION_TEMPLATES: { labelKey: string; description: string; goal: string }[] = [
  {
    labelKey: 'addAgent.templatesHint.repoJanitor.label',
    description: 'keeps the codebase tidy and healthy',
    goal: 'Continuously hunt for dead code, lint errors, flaky tests, and small safe refactors. Fix the safe ones and leave a note for anything risky. Never change behavior without flagging it.'
  },
  {
    labelKey: 'addAgent.templatesHint.docsWriter.label',
    description: 'keeps docs in sync with the code',
    goal: 'Watch for code changes that outdate the README and docs, then update them. Write for newcomers and prefer concrete examples over prose.'
  },
  {
    labelKey: 'addAgent.templatesHint.bugTriager.label',
    description: 'investigates and root-causes bugs',
    goal: 'For each reported issue: reproduce it, find the root cause, then propose a minimal fix with evidence. No fixes without a confirmed root cause.'
  },
  {
    labelKey: 'addAgent.templatesHint.researchAssistant.label',
    description: 'gathers and summarizes information',
    goal: 'Research the questions you are given across multiple sources, verify the key claims, and return a concise, cited summary.'
  },
  {
    labelKey: 'addAgent.templatesHint.releaseManager.label',
    description: 'prepares and ships releases',
    goal: 'Track what has shipped since the last release, update the changelog and version, and draft clear release notes.'
  }
];

// Copy-paste prompt the user hands to any AI to generate a hire manifest. It pins
// the exact JSON shape the importer accepts and ends with a fill-in section so the
// user adds their own details (item 7). Kept in sync with the HireManifest schema
// (src/shared/hire.ts) — provider allowlist is claude | codex | antigravity | cursor.
const HIRE_PROMPT = `You are designing a "hire" — a ready-to-spawn AI agent for Munder Difflin, an app that runs a team of CLI coding agents. Output ONE JSON object (a hire manifest) and nothing else.

Make the agent genuinely useful: give it a sharp role, a concrete standing goal, and a description that makes it behave like an expert operator of its CLI engine (Claude Code, Codex, or Antigravity/Gemini). It should know how to use the terminal, read and edit files, run and inspect commands, lean on available skills and MCP tools, keep notes in memory, and work autonomously toward its goal without hand-holding.

Return EXACTLY this shape (omit optional fields you don't need; keep the spec string verbatim):

{
  "spec": "munder-difflin/hire@1",
  "name": "Jim",
  "description": "one-line role — what this agent is for",
  "goal": "standing directive injected on every prompt — specific and outcome-oriented",
  "provider": "claude",
  "model": "claude-opus-4-8[1m]",
  "capabilities": ["code-review", "docs"],
  "isolate": false,
  "tokenCap": 2000000,
  "author": "your name"
}

Rules:
- "provider" MUST be one of: cursor | claude | codex | antigravity. "model" must be a real model id for that provider (e.g. gpt-5.6-luna-high, claude-opus-4-8[1m], gpt-5-codex, "Gemini 3.1 Pro (High)").
- Do NOT include shell commands or any flags beyond these fields.
- Make "description" + "goal" concrete enough that the agent knows exactly what to do on its first turn.

--- ADD YOUR DETAILS BELOW (the AI should use these) ---
Role / what I want this agent to do:
Preferred engine (claude / codex / antigravity), if any:
Repos, tools, style, or constraints to respect:
`;

// The Add Agent form has 11+ fields, so it's grouped into sections the user jumps
// between via a left sidebar index (one section shown at a time). Engine carries
// Command (it's the spawn command assembled from provider+model+flags); Workspace
// clusters Folder + Git isolation + Resume (all "where/how it runs"). Capabilities
// isn't a field here — it rides an imported hire manifest (the pinned banner).
type SectionKey = 'identity' | 'workspace' | 'engine' | 'briefing';
const SECTIONS: { key: SectionKey; labelKey: string; hintKey: string }[] = [
  { key: 'identity',  labelKey: 'addAgent.sections.identity.label',  hintKey: 'addAgent.sections.identity.hint' },
  { key: 'workspace', labelKey: 'addAgent.sections.workspace.label', hintKey: 'addAgent.sections.workspace.hint' },
  { key: 'engine',    labelKey: 'addAgent.sections.engine.label',    hintKey: 'addAgent.sections.engine.hint' },
  { key: 'briefing',  labelKey: 'addAgent.sections.briefing.label',  hintKey: 'addAgent.sections.briefing.hint' }
];

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function uniqueId(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
}

export interface AddAgentModalProps {
  onClose: () => void;
  config: HarnessConfig;
  /** Lift config changes (e.g. a project registered from this modal) back up to
   *  App so the rest of the UI — and the next time this modal opens — sees them. */
  onConfigChange?: (config: HarnessConfig) => void;
}

export function AddAgentModal({ onClose, config, onConfigChange }: AddAgentModalProps) {
  const { t: tr } = useTranslation();
  const rtl = useRtl();
  const addAgent = useStore(s => s.addAgent);
  // Deep links and file batches share one FIFO. The head alone seeds the form;
  // every item still requires an explicit spawn or skip.
  const hireQueue = useStore(s => s.hireQueue);
  const enqueuePendingHires = useStore(s => s.enqueuePendingHires);
  const finishPendingHire = useStore(s => s.finishPendingHire);
  const pendingHire = hireQueue.pending[0];
  const reviewProgress = hireQueueProgress(hireQueue);

  const knownCharacter = (c?: string): OfficeCharacterName =>
    (OFFICE_CAST.some(m => m.name === c) ? (c as OfficeCharacterName) : DEFAULT_CHARACTER);
  const knownAccent = (a?: string): AccentColorName =>
    (ACCENTS.includes(a as AccentColorName) ? (a as AccentColorName) : 'sky');
  /** The cast member a typed name refers to, if any.
   *
   *  The character tiles already set the name (clicking Meredith names the agent
   *  Meredith), but the coupling ran ONE WAY, so typing "Meredith" left the
   *  avatar on whatever was selected, in practice the Jim default. Same missing
   *  default as issue #191 from the other direction, where a manifest that omits
   *  `character` always lands on Jim.
   *
   *  Returns null on no match, and the caller leaves the avatar alone, so a
   *  deliberate pick is never overwritten by continuing to type. */
  const characterForName = (n: string): OfficeCharacterName | null => {
    const q = n.trim().toLowerCase();
    if (!q) return null;
    const hit = OFFICE_CAST.find(c => c.displayName.toLowerCase() === q || c.name === q);
    return hit ? hit.name : null;
  };
  /** The locally-built spawn command for a manifest: provider preset + model
   *  from the LOCAL config builder, with the manifest's validated flags
   *  appended. A manifest can never name the binary itself. */
  const hireCommand = (m: HireManifest): string => {
    const prov: AgentProvider = m.provider ?? inferAgentProvider(config.defaultCommand);
    const base = buildSpawnCommand(config, m.model, prov);
    return m.commandFlags?.length ? `${base} ${m.commandFlags.join(' ')}` : base;
  };

  // Default provider follows whatever the global default command is (claude
  // unless the user reconfigured it); the model only carries over for Claude.
  const initialProvider = inferAgentProvider(config.defaultCommand);
  const initialModel = isClaudeProvider(initialProvider) ? config.defaultModel : undefined;

  const [name, setName] = useState(pendingHire?.name ?? 'Jim');
  const [character, setCharacter] = useState<OfficeCharacterName>(knownCharacter(pendingH
```

### Core Architecture Module: `src/renderer/src/components/AgentCard.tsx`
```
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelPanel } from './PixelPanel';
import { PixelBadge, StatusKind } from './PixelBadge';
import { useHasTerminalDraft } from './terminalPool';
import { SpritePortrait } from './SpritePortrait';
import { RealtimeMichaelToggle } from './RealtimeMichaelToggle';
import { CostHud } from '@/realtime/CostHud';
import { AccentColorName } from '@/design/tokens';
import { OfficeCharacterName } from '@/scene/office/cast';
import { AgentNameEditor } from './AgentNameEditor';

export interface AgentCardProps {
  name: string;
  character: OfficeCharacterName;
  accent: AccentColorName;
  status: StatusKind;
  /** This agent's pty, if it has one. Only used to notice that the USER has
   *  unsent text on its prompt — which holds the agent's queue, and otherwise
   *  looks identical to an idle agent with nothing to do. */
  ptyId?: string;
  project: string;
  action?: string;
  /** Context gauge: 0..8 segments filled (session context ÷ context limit). */
  progress?: number;
  /** Live context size (tokens) — shown in the gauge tooltip. */
  contextTokens?: number;
  /** Context-window limit (tokens) assumed for the agent's model. */
  contextLimit?: number;
  selected?: boolean;
  /** Your clone — gets a persistent accent frame + BOSS tag so it stands out.
   *  (`isGod` / the `god` agent id stay as-is internally; this is display only.) */
  isGod?: boolean;
  onClick?: () => void;
  /** Persists an inline display-name edit; identity and hive paths stay unchanged. */
  onRename?: (name: string) => Promise<{ ok: boolean; error?: string }>;
  /** Number of ledger tasks this agent is actively DOING — rendered as a blue
   *  sticky note stuck to the card. Clicking it opens the first task's detail. */
  doingCount?: number;
  onTaskNoteClick?: () => void;
  draggable?: boolean; // must sit on the <button> itself — Chromium won't start a drag on an ancestor from inside a form control
  /** Private note — rendered as the card's own row (v0.3.4) so it can never
   *  cover the context gauge. First line only; full text in the tooltip. */
  note?: string;
  /** Opens the note editor (the strip owns the editing overlay). When set, the
   *  card shows a small ✎ affordance on its note row. */
  onEditNote?: () => void;
}

const fmtK = (n: number): string => `${Math.round(n / 1000)}k`;

/**
 * v0.3.4 compact redesign: one identity row (name + status), one context line
 * (action while working, repo while idle — both in the tooltip), one note row,
 * and a slim gauge pinned to the bottom edge. Nothing overlaps anything.
 */
export function AgentCard({
  name, character, accent, status, ptyId, project, action, progress = 0,
  contextTokens, contextLimit, selected, isGod, onClick, onRename,
  doingCount = 0, onTaskNoteClick, draggable, note, onEditNote
}: AgentCardProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  const typing = useHasTerminalDraft(ptyId);
  // IDENTITY and SELECTION are two different things, and conflating them is why
  // selecting Michael appeared to do nothing.
  //
  // The card used to pass `isGod || selected` into PixelPanel's 'active' variant,
  // whose frame is `inset 1px + 3px accent + 5px ink` — five pixels of border in
  // the agent's OWN accent. Three problems in one: the selection cue changed
  // colour per agent (the "blue halo" on a sky agent), it was invisible on god
  // because god was framed unconditionally, and stacking the selection ring
  // outside it made the boss card visibly fatter than its neighbours.
  //
  // Now: god is marked by its SURFACE (see godSurface), everyone shares the same
  // 1px panel border, and selection is one accent-independent ring — identical on
  // every card, god included.

  // The selected card wears an ink ring OUTSIDE its border. ink-900 rather than
  // an accent so the cue is identical on every agent, and it flips with the
  // theme (near-black on cream, near-white on the dark ground), staying legible
  // over whatever accent the card already carries.
  const selectionRing = selected ? '0 0 0 2px var(--cth-ink-900)' : '';

  // Context gauge as ONE clean fill (0..8 → 0..100%). Colour escalates as the
  // window fills: accent while comfortable, amber from 6/8, coral from 7/8.
  const pct = Math.min(8, Math.max(0, progress)) / 8 * 100;
  const gaugeColor = progress >= 7 ? 'var(--cth-coral)'
    : progress >= 6 ? 'var(--cth-lemon)'
      : `var(--cth-${accent})`;
  const gaugeTitle = contextTokens !== undefined && contextLimit
    ? t('agentCard.contextTitle', { used: fmtK(contextTokens), limit: fmtK(contextLimit), pct: Math.round((contextTokens / contextLimit) * 100) })
    : t('agentCard.contextGaugeTitle');

  // ONE card size for every agent. God used to be 216x86 against everyone
  // else's 196x76, so the dock never lined up — and once the selection ring was
  // added outside its 5px accent frame, the boss card grew a visibly thicker
  // edge than any other. Distinction now comes from the card's SURFACE, not from
  // making its box bigger or its border heavier.
  // 196 was too tight once god's row carried NAME + BOSS + status: the name
  // truncated to "MIC…" — the one word on the card that must never be the thing
  // that gets cut. Widened for every card so the dock stays uniform, with enough
  // slack that Talk's info mark (which only appears when the OpenAI key is
  // missing) has somewhere to sit rather than pushing the row apart.
  const width = 220;
  const height = 78;
  const lift = (isGod ? -2 : 0) - (hover ? 1 : 0) - (selected ? 1 : 0);
  /** God's distinction: a tinted surface plus a thin accent border all the way
   *  around — NOT the 3px rule that used to sit on the top edge alone. That rule
   *  read as a stray yellow bar rather than as part of the card, and an edge
   *  treatment that only exists on one side always looks like a mistake or a
   *  progress bar. Same 1px geometry as every other card, so the box is
   *  unchanged and the selection ring still means exactly one thing everywhere. */
  const godSurface: React.CSSProperties = isGod
    ? {
        background: `var(--cth-${accent}-light)`,
        boxShadow: `inset 0 0 0 1px var(--cth-${accent})`
      }
    : {};
  const dropShadow = isGod
    ? `2px 3px 0 0 rgba(26,19,32,${hover ? 0.2 : 0.14})`
    : (hover ? '1px 2px 0 0 rgba(26,19,32,0.12)' : 'none');
  // Ring first so it sits tight to the card, then the existing drop shadow.
  const outerShadow = [selectionRing, dropShadow === 'none' ? '' : dropShadow]
    .filter(Boolean).join(', ') || 'none';

  // One context line: what it's DOING while working, WHERE it lives while idle.
  const infoLine = (status !== 'idle' && action) ? action : project;
  const noteFirstLine = (note ?? '').split('\n').find((l) => l.trim()) ?? '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      draggable={draggable}
      // The ring is the visual answer to "which terminal is open"; this is the
      // same answer for a screen reader. Matches SidebarRow in fullscreen.
      aria-current={selected ? 'true' : undefined}
      className="cth-titlebar-nodrag"
      style={{
        width, minWidth: width, height,
        padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
        position: 'relative',
        transform: lift ? `translateY(${lift}px)` : 'none',
        boxShadow: outerShadow,
        transition: 'transform 90ms steps(2, end), box-shadow 90ms steps(2, end)'
      }}
    >
      {/* The taken note, stuck to the card like on the desk: this worker is
          actively DOING a ledger task. Click → the task's detail overlay. */}
      {doingCount > 0 && (
        <span
          title={doingCount === 1
            ? t('agentCard.doingTasks', { count: doingCount })
            : t('agentCard.doingTasksPlural', { count: doingCount })}
          onClick={(e) => { e.stopPropagation(); onTaskNoteClick?.(); }}
          style={{
            position: 'absolute', right: -4, bottom: -5, zIndex: 2,
            width: 20, height: 18,
            background: 'var(--cth-sky)',
            boxShadow: 'inset 0 0 0 1px var(--cth-ink-300), 1px 2px 0 rgba(26,19,32,0.18)',
            transform: 'rotate(4deg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-900)',
            cursor: 'pointer'
          }}
        >
          {doingCount > 1 ? doingCount : '✎'}
        </span>
      )}
      <PixelPanel
        variant="default"
        style={{ height: '100%', padding: '6px 8px', ...godSurface }}
        noPadding
      >
        <div style={{ display: 'flex', gap: 8, height: '100%' }}>
          {/* Portrait tile — vertically centred so the card reads calm and even. */}
          <div style={{
            width: 36, height: isGod ? 50 : 46, alignSelf: 'center',
            // God's CARD is now accent-light, so the tile cannot be — it would
            // vanish into its own background. Paper reads as an inset frame
            // against the tint, which is what the tile is meant to look like.
            background: isGod ? 'var(--cth-paper-100)' : `var(--cth-${accent}-light)`,
            boxShadow: `inset 0 0 0 1px var(--cth-ink-${isGod ? '300' : '100'})`,
            // Anchor the sprite's TOP: the 56px-tall portrait overflows this
            // tile, and bottom-anchoring cropped the head — crop feet, not face.
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'hidden',
         
```

### Core Architecture Module: `src/renderer/src/components/AgentControlStrip.tsx`
```
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelButton } from './PixelButton';
import { AgentHoldButton } from './AgentHoldButton';
import { isComposingKey } from '@shared/imeGuard';

/**
 * Operator control for one agent (#7C.1-7C.3) — pause (deny tools at the next
 * boundary), graceful halt (clean stop), and mid-run steering (inject context
 * without typing into the TUI). All ride Claude Code's hook-return protocol; no
 * PTY keystrokes. A thin strip under the agent header.
 *
 * The labels used to be "CONTROL", "pause", "halt", "steer", which told you the
 * mechanism and nothing about the consequence. "Control" what, and what is the
 * difference between pausing and halting? Both stop something; only one is
 * recoverable in the same breath. So each button says what HAPPENS, and the
 * explanations are on a styled hover tip rather than a native `title` that
 * waits a second and then renders an unstyled OS bubble.
 *
 * The heading is gone: once the buttons read as sentences it was labelling the
 * obvious, and a row of three clear verbs needs no title above it.
 *
 * The 1:1 hold sits here too. It is a different KIND of control — the other two
 * restrain the AGENT, 1:1 restrains MICHAEL, and the agent keeps running and
 * answering you — so that distinction now lives in its tooltip rather than in
 * the layout.
 */
interface Snapshot {
  paused: boolean;
  halted: boolean;
  autoDeliveryPaused: boolean;
  gatedTools: string[];
  pendingSteers: number;
}

export function AgentControlStrip({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [steer, setSteer] = useState('');
  const [note, setNote] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    window.cth.controlSnapshot(agentId).then((s) => { if (alive && s) setSnap(s); }).catch(() => { /* none */ });
    return () => { alive = false; };
  }, [agentId]);

  const flash = (m: string) => {
    setNote(m);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 1800);
  };

  const togglePause = async () => {
    const s = snap?.paused ? await window.cth.controlResume(agentId) : await window.cth.controlPause(agentId, true);
    if (s) setSnap(s);
    flash(snap?.paused ? t('agentControl.flashResumed') : t('agentControl.flashPaused'));
  };
  const halt = async () => {
    const s = await window.cth.controlHalt(agentId);
    if (s) setSnap(s);
    flash(t('agentControl.flashHalt'));
  };
  const sendSteer = async () => {
    const t_ = steer.trim();
    if (!t_) return;
    const s = await window.cth.controlSteer(agentId, t_);
    if (s) setSnap(s);
    setSteer('');
    flash(t('agentControl.flashSteer'));
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '6px 8px', background: 'var(--cth-paper-100)',
      borderBottom: '1px solid var(--cth-ink-300)', flexShrink: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Neither of these kills anything, and the old two-word labels never
            said so — the difference is WHEN the agent stops and whether it keeps
            its session. Say the consequence on the button, the detail on hover. */}
        <PixelButton variant={snap?.paused ? 'primary' : 'secondary'} size="sm" onClick={togglePause}>
          <span
            className="cth-tip cth-tip-left cth-tip-wrap"
            data-tip={snap?.paused
              ? t('agentControl.allowToolsTip')
              : t('agentControl.blockToolsTip')}
            aria-label={snap?.paused ? t('agentControl.allowToolsAria') : t('agentControl.blockToolsAria')}
          >
            {snap?.paused ? t('agentControl.allowTools') : t('agentControl.blockTools')}
          </span>
        </PixelButton>
        <PixelButton variant="destructive" size="sm" onClick={halt}>
          <span
            className="cth-tip cth-tip-left cth-tip-wrap"
            data-tip={t('agentControl.stopAfterStepTip')}
            aria-label={t('agentControl.stopAfterStepAria')}
          >
            {t('agentControl.stopAfterStep')}
          </span>
        </PixelButton>
        {/* Sits with them at the founder's call. It is a different KIND of
            control — the two above restrain the agent, this one restrains
            Michael — so the tooltip carries that distinction now that the
            grouping no longer does. */}
        <AgentHoldButton agentId={agentId} />
        {/* v0.3.4: the auto-delivery switch moved to the god's Command Center
            header — ONE floor-wide control instead of a per-agent toggle. */}
        {snap?.autoDeliveryPaused && (
          <span style={{ fontSize: 11, color: 'var(--cth-ink-500)' }}>{t('agentControl.deliveryPaused')}</span>
        )}
        {snap?.halted && <span style={{ fontSize: 11, color: 'var(--cth-coral)' }}>{t('agentControl.halting')}</span>}
        {!!snap?.pendingSteers && <span style={{ fontSize: 11, color: 'var(--cth-ink-500)' }}>{t('agentControl.steersQueued', { count: snap.pendingSteers })}</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="cth-input"
          value={steer}
          onChange={(e) => setSteer(e.target.value)}
          onKeyDown={(e) => { if (isComposingKey(e)) return; if (e.key === 'Enter') sendSteer(); }}
          placeholder={t('agentControl.steerPlaceholder')}
          style={{
            flex: 1, padding: '4px 6px', background: 'var(--cth-paper-100)', border: 'none',
            fontFamily: 'var(--cth-font-ui)',
            fontSize: 12, color: 'var(--cth-ink-900)', outline: 'none'
          }}
        />
        <PixelButton variant="secondary" size="sm" onClick={sendSteer} disabled={!steer.trim()}>
          <span
            className="cth-tip cth-tip-wrap"
            data-tip={t('agentControl.steerTip')}
            aria-label={t('agentControl.steerAria')}
          >{t('agentControl.steer')}</span>
        </PixelButton>
      </div>
      {note && <span style={{ fontSize: 11, color: 'var(--cth-ink-500)' }}>{note}</span>}
    </div>
  );
}

```

### Core Architecture Module: `src/renderer/src/components/AgentDetailPanel.tsx`
```
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelPanel } from './PixelPanel';
import { PixelBadge } from './PixelBadge';
import { PixelButton } from './PixelButton';
import { SpritePortrait } from './SpritePortrait';
import { PtyTerminalView } from './PtyTerminalView';
import { terminalInstanceKey } from './terminalRecovery';
import { MessageQueueComposer } from './MessageQueueComposer';
import { CommandCenterPanel } from './CommandCenterPanel';
import { disposeTerminal } from './terminalPool';
import { SidebarTabs } from './SidebarTabs';
import { ThreadsPanel } from './ThreadsPanel';
import { ToolWaterfall } from './ToolWaterfall';
import { AgentControlStrip } from './AgentControlStrip';
import { EditAgentModal } from './EditAgentModal';
import { GitTab } from './GitTab';
import { Icon } from './Icon';
import { AgentNameEditor } from './AgentNameEditor';
import { useStore, type Agent } from '@/store/store';
import { usePtyParser } from '@/hooks/usePtyParser';

export interface AgentDetailPanelProps {
  agent: Agent;
}

export function AgentDetailPanel({ agent }: AgentDetailPanelProps) {
  const { t } = useTranslation();
  const [openTerminalState, setOpenTerminalState] = useState<'idle' | 'opening' | 'ok' | 'error'>('idle');
  const [openTerminalError, setOpenTerminalError] = useState<string | undefined>();
  const [editOpen, setEditOpen] = useState(false);

  /**
   * THE HEADER STRIP HAS TO GIVE SOMETHING UP WHEN THE SIDEBAR IS DRAGGED IN.
   *
   * Four buttons with icon+label need about 246px on their own, and the
   * portrait and gaps take another 72. The sidebar can be dragged down to
   * 320px total (SidebarSplitter's `min`), so past a point there is simply
   * not enough room for the labels AND the agent's name.
   *
   * Something has to yield, and the name is the one thing in this row that
   * cannot: it is how you know WHICH agent you are looking at. So below the
   * threshold the buttons drop their words and keep their icons — the tooltip
   * and aria-label on each already carry the full explanation, so nothing is
   * actually lost, and the ~110px that frees goes back to the name.
   *
   * Measured on the strip itself rather than on `sidebarWidth`, because the
   * strip's width is set by its container and NOT by what is inside it. That
   * is what makes a single threshold safe here: swapping labels for icons
   * cannot change the number being compared, so the row cannot oscillate.
   *
   * WHERE 440 COMES FROM. Everything that is not the name costs ~318px: the
   * four buttons measure ~246 at Inter 13px, the portrait 32, and the five
   * 8px gaps another 40. The name is set in Press Start 2P, which is a
   * fixed-advance pixel font — at fontSize 10 that is a flat 10px per
   * character, plus 17 for the rename pencil beside it. Ten readable
   * characters therefore need 117, and 318 + 117 rounds to 440.
   *
   * That threshold deliberately puts the DEFAULT 420px sidebar in compact
   * mode. It has to: at 420 the labelled row leaves the name about 67px,
   * which is six pixel-font characters — the "DWIGHT S." truncation this was
   * reported as. Icons at the default width is the fix, not a side effect.
   *
   * Recompute the number if a fifth button lands in this row or a label grows.
   */
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [compactHeader, setCompactHeader] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setCompactHeader(w < 440);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const archiveAgent = useStore(s => s.archiveAgent);
  const updateAgent = useStore(s => s.updateAgent);
  const renameAgent = useStore(s => s.renameAgent);
  const setFullscreen = useStore(s => s.setFullscreen);
  const fullscreenAgentId = useStore(s => s.fullscreenAgentId);
  const sidebarTab = useStore(s => s.sidebarTab);
  const setSidebarTab = useStore(s => s.setSidebarTab);
  const isReal = !!agent.ptyId;
  // While this agent is shown in the fullscreen overlay, the fullscreen view
  // owns the pty (it sizes it to fill the screen). Keeping the embedded terminal
  // mounted too means two xterms fight over the pty's cols/rows — which corrupts
  // the display and breaks scrolling. So we unmount the embedded one here; it
  // re-mounts and re-fits when fullscreen closes.
  const isFullscreenedHere = fullscreenAgentId === agent.id;

  const onPtyStream = usePtyParser(agent.id);

  // Michael gets the full command-center dashboard instead of the plain panel.
  if (agent.isGod) return <CommandCenterPanel agent={agent} />;

  const openTerminal = async () => {
    setOpenTerminalState('opening');
    setOpenTerminalError(undefined);
    try {
      const result = await window.cth.openTerminalAt(agent.cwd);
      if (result.ok) {
        setOpenTerminalState('ok');
        setTimeout(() => setOpenTerminalState('idle'), 1500);
      } else {
        setOpenTerminalState('error');
        setOpenTerminalError(result.error ?? 'unknown error');
        setTimeout(() => setOpenTerminalState('idle'), 4000);
      }
    } catch (e) {
      setOpenTerminalState('error');
      setOpenTerminalError(e instanceof Error ? e.message : String(e));
      setTimeout(() => setOpenTerminalState('idle'), 4000);
    }
  };

  const onKill = async () => {
    if (!agent.ptyId) return;
    if (!confirm(t('agentDetail.killConfirm', { name: agent.name }))) return;
    await window.cth.killPty(agent.ptyId);
    disposeTerminal(agent.ptyId);
    archiveAgent(agent.id);
  };

  return (
    <PixelPanel
      variant="default"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 0,
        overflow: 'hidden'
      }}
      noPadding
    >
      {/* Thin header strip */}
      <div ref={headerRef} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px',
        background: 'var(--cth-cream-100)',
        borderBottom: '1px solid var(--cth-ink-700)',
        flexShrink: 0
      }}>
        <div style={{
          width: 32, height: 32,
          background: `var(--cth-${agent.accent}-light)`,
          boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
          flexShrink: 0
        }}>
          <SpritePortrait character={agent.character} scale={1} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', minWidth: 0, lineHeight: '14px' }}>
            <AgentNameEditor
              name={agent.name}
              onCommit={(name) => renameAgent(agent.id, name)}
              uppercase
              fontSize={10}
            />
          </div>
          <div style={{
            display: 'flex', gap: 6, alignItems: 'center', marginTop: 1,
            minWidth: 0, overflow: 'hidden'
          }}>
            <PixelBadge status={agent.status} />
            <span style={{
              fontSize: 12, color: 'var(--cth-ink-500)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>{agent.project}</span>
          </div>
        </div>
        <PixelButton variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
          <span
            className="cth-tip cth-tip-wrap"
            data-tip={`Edit ${agent.name}: their name and face, which engine they run on, and the briefing that tells them what they are for.`}
            aria-label="Edit this agent"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Icon name="edit" />{!compactHeader && ' edit'}
          </span>
        </PixelButton>
        {/* v0.3.4: the IDE lives at agent level (replaces the old files tab) —
            opens the full-window Monaco editor rooted at this agent's workspace. */}
        <PixelButton variant="secondary" size="sm" onClick={() => useStore.getState().setIdeOpen(true, agent.id)}>
          <span
            className="cth-tip cth-tip-wrap"
            data-tip={t('agentDetail.ideTip', { project: agent.project })}
            aria-label={t('agentDetail.openIde')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Icon name="code" />{!compactHeader && t('agentDetail.ide')}
          </span>
        </PixelButton>
        <PixelButton variant="secondary" size="sm" onClick={openTerminal} disabled={openTerminalState === 'opening'}>
          {/* "open" said nothing about WHAT opens, sitting in a row where IDE
              and Talk both also open something. The label names the thing you
              get; the tip names the folder you get it in. */}
          <span
            className="cth-tip cth-tip-wrap"
            data-tip={t('agentDetail.terminalTip', { cwd: agent.cwd })}
            aria-label={t('agentDetail.openTerminalAria')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Icon name="terminal" />
            {/* The transient states survive compact mode: they are feedback on
                a click you just made, and they are two characters wide. Only
                the resting word "terminal" is worth its space. */}
            {openTerminalState === 'opening' ? t('agentDetail.opening')
              : openTerminalState === 'ok' ? t('agentDetail.ok')
              : openTerminalState === 'error' ? t('agentDetail.err')
              : compactHeader ? '' : t('agentDetail.open')}
          </span>
        </PixelButton>
        {isReal && (
          <PixelButton variant="destructive" size="sm" onClick={onKill}>
            <Icon name="x" />
          </PixelButton>
        )}
      </div>

      {openTerminalError && (
     
```

### Core Architecture Module: `src/renderer/src/components/AgentHoldButton.tsx`
```
import { useEffect, useState } from 'react';
import { PixelButton } from './PixelButton';
import { Icon } from './Icon';
import { useStore } from '@/store/store';

/**
 * 1:1 — "I have this agent, Michael stop sending it work."
 *
 * Lives in `AgentControlStrip` beside "block tools" and "stop after this step",
 * so it is present in both sidebar and focus mode. It was briefly in the title
 * bar, which focus mode covers, making it invisible in the one mode you are
 * most likely to be in during a 1:1.
 *
 * It is a different KIND of control from the two it sits with, and the tooltip
 * carries that since the grouping no longer does: those two restrain the AGENT
 * (take its tools, or stop it after this step), while this one restrains
 * MICHAEL. The agent keeps running and keeps answering you. "Stop after this
 * step" is in fact the worst thing to reach for in a 1:1, because it stops the
 * agent you wanted to talk to.
 *
 * Never rendered for Michael himself: telling the orchestrator to stop routing
 * work to itself is not a state worth having.
 */
export function AgentHoldButton({ agentId }: { agentId: string }) {
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const godName = useStore((s) => s.agents.find((a) => a.isGod)?.name) ?? 'the orchestrator';
  const [busy, setBusy] = useState(false);
  /** Last failure, shown on the button itself. A control that silently does
   *  nothing is worse than one that says why. */
  const [err, setErr] = useState<string | null>(null);

  // The registry is the record and it survives restarts, so the store's copy
  // can be stale on a fresh launch. Read it back once per agent.
  useEffect(() => {
    let alive = true;
    window.cth.hiveRegistry?.().then((reg) => {
      if (!alive) return;
      const onHold = !!(reg as { agents?: Record<string, { onHold?: boolean }> })?.agents?.[agentId]?.onHold;
      if (onHold !== !!useStore.getState().agents.find((a) => a.id === agentId)?.onHold) {
        useStore.getState().updateAgent(agentId, { onHold });
      }
    }).catch(() => { /* no hive — the button is harmless either way */ });
    return () => { alive = false; };
  }, [agentId]);

  if (!agent || agent.isGod) return null;
  const on = !!agent.onHold;

  return (
    <PixelButton
      variant={on ? 'primary' : 'secondary'}
      size="sm"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        // Promise.resolve().then(...) rather than calling straight into the
        // bridge: on a dev build whose PRELOAD predates this feature the method
        // is undefined, and the resulting TypeError is thrown SYNCHRONOUSLY out
        // of onClick, so `finally` never runs and the button stays disabled
        // until React remounts it. Which is exactly how this was reported.
        // Preload is not hot-reloaded; only a restart picks it up.
        void Promise.resolve()
          .then(() => window.cth.hiveSetAgentHold?.(agentId, !on)
            ?? Promise.reject(new Error('restart the app: this build\'s preload predates the 1:1 control')))
          // Mirror locally only after main confirms the write. Flipping
          // optimistically would show a hold Michael never heard about.
          .then((r) => {
            if (r?.ok) { setErr(null); useStore.getState().updateAgent(agentId, { onHold: !on }); }
            else setErr(r?.error ?? 'could not set the hold');
          })
          .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
          .finally(() => setBusy(false));
      }}
    >
      <span
        className="cth-tip cth-tip-wrap"
        data-tip={err ? err : on
          ? `End the 1:1. ${godName} can hand ${agent.name} work again.`
          : `Take ${agent.name} aside. ${godName} stops sending them work until you end it. Unlike the two buttons here, this does not restrain the agent: they keep running and keep answering you.`}
        aria-label={on ? `End the 1:1 and release this agent to ${godName}` : 'Take this agent aside for a 1:1'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <Icon name={on ? 'pause' : 'play'} /> {err ? '1:1 failed' : on ? 'in 1:1' : '1:1'}
      </span>
    </PixelButton>
  );
}

```

### Core Architecture Module: `src/renderer/src/components/AgentNameEditor.tsx`
```
import { useEffect, useRef, useState } from 'react';
import { isComposingKey } from '@shared/imeGuard';

export interface AgentNameEditorProps {
  name: string;
  onCommit: (name: string) => Promise<{ ok: boolean; error?: string }>;
  /** Cards render names in their established all-caps display style. */
  uppercase?: boolean;
  fontSize?: number | string;
}

/** Inline display-name editor shared by the floor card and agent detail header. */
export function AgentNameEditor({
  name,
  onCommit,
  uppercase = false,
  fontSize = 'var(--cth-text-display-sm)'
}: AgentNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string>();
  const committing = useRef(false);
  const cancelling = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [editing, name]);

  const beginEditing = () => {
    setDraft(name);
    setError(undefined);
    setEditing(true);
  };

  const commit = async () => {
    if (committing.current || cancelling.current) return;
    const nextName = draft.trim();
    if (!nextName) {
      setError('Name is required');
      return;
    }
    if (nextName === name) {
      setEditing(false);
      return;
    }

    committing.current = true;
    setError(undefined);
    try {
      const result = await onCommit(nextName);
      if (result.ok) setEditing(false);
      else setError(result.error ?? 'Could not rename agent');
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'Could not rename agent');
    } finally {
      committing.current = false;
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        draggable={false}
        value={draft}
        aria-label={`Rename ${name}`}
        title={error}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onBlur={() => { void commit(); }}
        onKeyDown={(event) => {
          event.stopPropagation();
          // Still stop propagation for a composition key: it belongs to this
          // input's IME, not to a global hotkey.
          if (isComposingKey(event)) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            cancelling.current = true;
            setEditing(false);
            queueMicrotask(() => { cancelling.current = false; });
          }
        }}
        style={{
          width: '100%', minWidth: 0, height: 20, padding: '1px 4px', boxSizing: 'border-box',
          border: 'none', outline: 'none',
          background: 'var(--cth-paper-100)',
          boxShadow: `inset 0 0 0 1px var(--cth-${error ? 'coral' : 'ink-300'})`,
          fontFamily: 'var(--cth-font-display)', fontSize,
          color: 'var(--cth-ink-900)', textTransform: uppercase ? 'uppercase' : undefined
        }}
      />
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, minWidth: 0, flex: 1 }}>
      <span
        onDoubleClick={(event) => { event.stopPropagation(); beginEditing(); }}
        title={`${name} — double-click to rename`}
        style={{
          fontFamily: 'var(--cth-font-display)', fontSize,
          color: 'var(--cth-ink-900)',
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}
      >{uppercase ? name.toUpperCase() : name}</span>
      <button
        type="button"
        draggable={false}
        aria-label={`Rename ${name}`}
        title={`Rename ${name}`}
        onClick={(event) => { event.stopPropagation(); beginEditing(); }}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          flexShrink: 0, width: 14, height: 14, padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', cursor: 'text',
          color: 'var(--cth-ink-500)', fontFamily: 'var(--cth-font-ui)', fontSize: 9, lineHeight: 1
        }}
      >✎</button>
    </span>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #558** (2026-10-02): **[BUG] PI provider agents receive no bootstrap on spawn**
  *Symptoms*: ### What happened?  # Bug Report: PI provider agents receive no bootstrap on spawn  **Filed:** 2026-09-18 **Reporter:** `god` (Otto, orchestrator) via human owner **Severity:** High — silently breaks PI agent onboarding, leaves agent confused and idle **Affected:** All agents with `provider: pi` (ex: Toby, Meredith, Kelly, Jim's regenerated session) **Status:** Open — no workaround in harness; manual paste required by operator  ---  ## Summary  Agents spawned with `provider: pi` do not receive any bootstrap / system prompt on session start. They are created and invoked with only their first user-role turn as context, which is typically a dispatch from the orchestrator. They have no knowledge of the hive protocol, agent identity, inbox/outbox locations, fleet registry, PROTOCOL.md, or their own role.  This is inconsistent with opencode agents, which receive a full bootstrap via `claude --append-system-prompt` at spawn time and are fully oriented before their first model invocation.  ---  ## Reproduction Steps  1. Write a spawn-request manifest that targets the `pi` provider. Example shape used on 2026-09-18:     ```json    {      "id": "spawn-toby-pi-test",      "cwd": "W:\CODE\PROJECT",      "provider": "pi",      "model": "gpt-5",      "name": "Toby",      "character": "engineer",      "accent": "neutral",      "isolate": false    }    ```     (full file: `C:\Users\dev\PROJECT\hive\spawn-requests\.done\spawn-toby.json`)  2. Place it in `C:\Users\dev\PROJECT\hive\spawn-reques
  **Post-Mortem & Fix Analysis**:
  > #560 This implements F1 at the existing provider bootstrap boundary. Instead of writing directly to Pi's private session JSONL, the fix uses Pi's supported positional initial prompt interface so the bootstrap is delivered before the first model turn.

- **Issue #535** (2026-09-25): **Non-Claude (Grok) agents record zero token/cost usage**
  *Symptoms*: ### What happened?  I ran an agent on the Grok provider. The agent worked correctly — it ran turns, called tools, and completed its task. But its token usage and cost never showed up: $0.00 and 0 tokens in the roster.  I could not set any limits on it.  Grok does track the usage — grok usage <sessionId> and the on-disk usage.json both show real numbers (I confirmed $0.5388 for one live session).   Expected: a Grok agent's tokens and USD land in the ledger and roll up into fleet totals, the same as a Claude agent.      ### Steps to reproduce   1. Launch MD.  2. Add an agent configured on the Grok provider   3. Give it any task that runs at least one full turn so Grok writes usage.  4. Let the turn finish.  5. Open the fleet view / cost totals for that agent → shows $0.00, 0 tokens.  6. Compare: run grok usage <that session id> → real, non-zero usage is present.   ### Screenshot or screen recording  <img width="977" height="288" alt="Image" src="https://github.com/user-attachments/assets/49afbb9b-d9bf-4157-9472-937c78ba7926" />  ### Logs / stack trace  ```shell No crash, no stack trace.  its a silent thing. ```  ### Operating system  macOS (Intel)  ### OS version  12.7.6  ### Munder Difflin version  v0.5.2 (packaged app)  ### Node version  v20.20.2  ### Agent CLI and version (if relevant)  Grok Build CLI (grok-4.6-build)  ### Pre-flight  - [x] I attached a screenshot or recording above. - [x] I'm on the latest release, or I've said above why I can't be. - [x] I re-ran `npm inst

- **Issue #481** (2026-10-02): **Embedded terminal doesn't deliver Shift+Enter as a newline to Claude Code — the key mapping `/terminal-setup` installs for iTerm/VS Code has no equivalent for the xterm.js pane**
  *Symptoms*: ### What happened?  ## What happened Inside an agent's terminal pane, pressing Shift+Enter at the Claude Code prompt does not insert a newline (it submits, or does nothing). Claude Code recognizes Shift+Enter only when the terminal sends a specific escape sequence; `/terminal-setup` installs that mapping for iTerm2 and VS Code, but there is no way to apply it to Munder's xterm.js pane. Writing a multi-line prompt directly in the terminal is therefore awkward.  ## Expected The embedded terminal sends the same sequence `/terminal-setup` configures (or supports the kitty keyboard protocol / CSI u), so Shift+Enter inserts a newline in Claude Code and other TUIs that rely on it.  This isn't Claude Code specific. It's about how xterm.js encodes modifier keys, so it stays provider neutral: any TUI using the same convention is affected.  ## Workaround Type `\` then Enter (Claude Code's terminal-independent newline).  ## Related, but not a duplicate #24 / #27 fixed multi-line messages *sent* into a TUI, via bracketed paste. This is the other path: typing directly in the terminal pane.  ### Steps to reproduce  1. Open any Claude Code agent, then click into the terminal pane 2. Type a line at the prompt, press Shift+Enter 3. No newline is inserted; the line is submitted, or nothing happens  Same keypress works in iTerm2 after running `/terminal-setup`.  ### Screenshot or screen recording  No file attached, sorry. The failure is a keypress that produces no visible change: the prompt look
  **Post-Mortem & Fix Analysis**:
  > I confirm it's an annoying issue

- **Issue #401** (2026-10-02): **Gallery validator accepts hire manifests rejected by the app**
  *Symptoms*: ## What happened?  The static hire-manifest validator used by the Gallery and Hiring Desk no longer matches the canonical runtime validator in `src/shared/hire.ts`.  On current `main`, the browser validator accepts manifests containing command arguments that the app rejects, including:  - `--permission-mode bypassPermissions` - an attacker-controlled `--provider` - Codex `-c model_providers.*.base_url=...` configuration overrides  It also does not validate the `skills` or `mcpServers` fields, so unknown ids and arrays above the runtime limit are reported as valid. In the other direction, it rejects an HTTPS `homepage` with surrounding whitespace even though the runtime trims and accepts it.  The published JSON Schema has related drift: its provider enum omits `cursor`, and its command-token pattern still permits `%`, which the runtime rejects to prevent `cmd.exe` environment expansion.  The app import path still revalidates manifests with the canonical runtime validator, so this is a preflight/trust-contract mismatch rather than a demonstrated runtime bypass. However, the Gallery can currently tell authors and users that a manifest is valid when the app will reject it.  ## Expected behavior  The Gallery/Hiring Desk validator, published schema, and canonical app validator should agree on the acceptance boundary for command flags, bundled skills, MCP catalog ids, providers, and field limits.  ## Reproduction  1. Check out `main` at `a34a5bbe`. 2. Load `docs/hires/validator.js` 

- **Issue #399** (2026-09-06): **HookServer can corrupt split UTF-8 payloads and retain unbounded incomplete frames**
  *Symptoms*: ### What happened?  HookServer currently decodes each socket `data` chunk independently before applying newline framing:  ```ts let buf = '';  conn.on('data', (d) => {   buf += d.toString();   const nl = buf.indexOf('\n');   if (nl === -1) return;   // ... }); ``` - Socket chunk boundaries are byte boundaries, so they can split a multibyte UTF-8 code point. When that happens, decoding each chunk separately can replace an incomplete sequence with U+FFFD.  - The resulting JSON can still parse successfully, which means a valid multilingual hook payload may be silently changed before it reaches the handler.  - The same framing path also has no explicit byte limit for an incomplete request. A local hook peer that keeps sending data without a terminating newline can therefore leave an ever-growing incomplete frame retained by the Electron main process.   - I would expect HookServer to frame requests as bytes, decode UTF-8 only after a complete newline-delimited frame is available, and reject frames that exceed a fixed byte limit.  - This is a local HookServer protocol correctness and resource-boundary issue. I am not treating it as an internet-facing DoS.  - I have opened a focused #400 with the proposed fix and regression coverage. If the approach looks good, please assign this issue to me.  ### Steps to reproduce  1. Check out the current `main` branch and install dependencies. 2. Start HookServer and connect to its local socket. 3. Create a valid newline-delimited JSON payload c

- **Issue #395** (2026-09-06): **Slack "Stop" button doesn't persist slackEnabled: false — bridge silently re-arms after restart, and Settings UI shows stale "ON" state**
  *Symptoms*: ### What happened?  Version: v0.4.6 (bug present on main @ 1e41d0b4, so not fork-specific)  Summary  Clicking Stop in Settings → Connections → Slack tears down the live webhook server, but never persists slackEnabled: false to the on-disk config. Two visible symptoms: 1. Quitting and relaunching the app after an explicit Stop re-arms the Slack bridge automatically on the next boot, even though the user just turned it off. 2. The Settings panel's own ON/OFF toggle for Slack keeps showing "ON" (and the token/secret/channel fields stay open) until the modal is closed and reopened — it never reflects the Stop action just taken.  Where  - src/main/index.ts   ipcMain.handle('slack:stop', () => { stopSlackServer(); return { ok: true }; });   stops the live server object but never writes slackEnabled: false to config. The auto-start-at-boot check further down (if (slackCfg.slackEnabled && slackCfg.slackSigningSecret) { ... }) therefore still sees slackEnabled === true on the next launch and reconnects. - src/renderer/src/components/SettingsModal.tsx   stopSlack() calls window.cth.slackStop() and updates running/slackNote, but never calls setSlackEnabled(false) — the local component state that drives the ON/OFF pill and gates visibility of the token/secret/channel fields. startSlack() does call setSlackEnabled(true) on success, so the asymmetry is visible comparing the two functions side by side.  Steps to reproduce  1. Configure and Start Slack in Settings → Connections. 2. Click Sto

- **Issue #389** (2026-09-06): **Malformed Claude config can be overwritten after a JSON parse failure**
  *Symptoms*: ### What happened?  - `ensureClaudePermissionsAccepted()` currently treats an existing Claude config as an empty object when JSON parsing fails.  - For both `~/.claude/settings.json` and `~/.claude.json`, a parse failure can fall back to `{}`, after which Munder Difflin may add its permission or trust fields and write the result back to the original path. This can replace unrelated user-owned configuration instead of preserving the existing file.  - I can reproduce this deterministically with malformed config fixtures. The expected behavior is to fail closed for that config file, preserve its existing contents, and continue best-effort handling of the other independent Claude config.  - I have opened a focused #390 with the proposed fix and regression coverage. If the approach looks good, please assign this issue to me.  ### Steps to reproduce  1. Start from the current `main` implementation.  2. Create an existing malformed Claude config, for example `~/.claude/settings.json`:     ```json    {      "env": {        "CUSTOM_VALUE": "preserve-me"      }, 3. Run the code path that calls ensureClaudePermissionsAccepted(). 4. Observe that JSON parsing fails and the current implementation falls back to an empty object. 5. Munder Difflin then adds its required permission fields and can write the generated object back to the same config path. 6. Compare the file contents before and after the call. The original malformed contents are no longer preserved. The same behavior also applies

- **Issue #385** (2026-09-06): **Installing skills from the Skills browser often fails with the error**
  *Symptoms*: ### What happened?  ## Bug description  Installing skills from the Skills browser often fails with the error  `that skill is larger than this installer will fetch`  This seems to happen for many skills, including ones that should be relatively small.  From what I can tell, the issue may be related to catalog entries that point to the root of a GitHub repository instead of directly to a specific skill directory.  For example, if a catalog entry points to  `https://github.com/owner/repo`  the installer appears to recursively walk the entire repository. This can easily exceed the current 2 MiB size limit even when the actual skill itself is small.  ## Suspected cause  `parseGitHubSourceUrl()` returns an empty path for repo root URLs.  The installer then calls `walk()` starting from that empty path, which effectively treats the whole repository as the skill.  As a result, the size and file count limits are applied to the entire repository rather than to the individual skill directory.  There also does not seem to be a validation step that confirms the selected source directory contains a `SKILL.md` before recursively downloading it.  ## Proposed fix  For repo root URLs, the installer could first resolve the actual skill directory before downloading anything.  A possible flow would be  1. If the URL already points to a specific directory, use that directory. 2. If the repository root contains `SKILL.md`, treat the repository itself as the skill. 3. Otherwise, try common locations 

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

### Incident Patch 1: `0754e65a` (2026-10-05)
**Commit Message**: seo-engine: day 08 PM, merge the kit's compare cell fix and restore the full command

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `blog/src/posts/openclaw-alternatives.md` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ Licences come from each repo, checked on 5 Oct 2026. The Claude price is from [c
 
 Hermes Agent, for most people who liked what OpenClaw does. It does the same job under the same licence, and it is the only pick here whose README documents an import from `~/.openclaw`.
 
-<figure class="mg" data-scene="compare"><img src="/blog/assets/media/openclaw-alternatives/versus.png" width="1600" height="900" loading="lazy" decoding="async" alt="Animation. A table compares OpenClaw and Hermes Agent on licence, GitHub stars, latest release, chat apps and switching, then Oscar gives the verdict."><script type="application/json">{"kicker":"Checked 5 Oct 2026","title":"OpenClaw against Hermes Agent","cols":["OpenClaw","Hermes Agent"],"pick":1,"rows":[{"label":"Licence","a":"MIT","b":"MIT","win":"","note":"A tie. Both repos are MIT licensed."},{"label":"GitHub stars","a":"391,425","b":"251,363","win":"a","note":"Read on GitHub, 5 Oct 2026."},{"label":"Latest release","a":"v2026.9.8, 3 Oct","b":"v2026.9.24, 24 Sep","win":"","note":"Both shipped a release in the last two weeks."},{"label":"Chat apps in README","a":"6 named, 20+ more","b":"5 named, plus CLI","win":"a","note":"Counted from each README's headline list."},{"label":"Switching","a":"You are here","b":"Has an importer","win":"b","note":"Add --dry-run to preview the import."}],"host":"oscar","say":"Hermes is the closest swap."}</script><figcaption>OpenClaw is the bigger project. Hermes Agent is the easiest move.</figcaption></figure>
+<figure class="mg" data-scene="compare"><img src="/blog/assets/media/openclaw-alternatives/versus.png" width="1600" height="900" loading="lazy" decoding="async" alt="Animation. A table compares OpenClaw and Hermes Agent on licence, GitHub stars, latest release, chat apps and switching, then Oscar gives the verdict."><script type="application/json">{"kicker":"Checked 5 Oct 2026","title":"OpenClaw against Hermes Agent","cols":["OpenClaw","Hermes Agent"],"pick":1,"rows":[{"label":"Licence","a":"MIT","b":"MIT","win":"","note":"A tie. Both repos are MIT licensed."},{"label":"GitHub stars","a":"391,425","b":"251,363","win":"a","note":"Read on GitHub, 5 Oct 2026."},{"label":"Latest release","a":"v2026.9.8, 3 Oct","b":"v2026.9.24, 24 Sep","win":"","note":"Both shipped a release in the last two weeks."},{"label":"Chat apps in README","a":"6 named, 20+ more","b":"5 named, plus CLI","win":"a","note":"Counted from each README's headline list."},{"label":"Switching","a":"You are here","b":"hermes claw migrate","win":"b","note":"Add --dry-run to preview the import."}],"host":"oscar","say":"Hermes is the closest swap."}</script><figcaption>OpenClaw is the bigger project. Hermes Agent is the easiest move.</figcaption></figure>
 
 OpenClaw still wins on size and reach: more stars, more channels, and native apps for macOS, iOS, Android, Windows and Linux. If none of the three reasons above bothers you, stay. That is a fair outcome for a list like this.
 
```

**File**: `docs/blog/openclaw-alternatives/index.html` (modified, +1/-1)
```diff
@@ -278,7 +278,7 @@ <h2 id="openclaw-alternatives-compared-checked-5-oct-2026" tabindex="-1">OpenCla
 <p>Licences come from each repo, checked on 5 Oct 2026. The Claude price is from <a href="https://claude.com/pricing">claude.com/pricing</a> on the same day.</p>
 <h2 id="what-is-the-best-openclaw-alternative" tabindex="-1">What is the best OpenClaw alternative? <a class="anchor" href="#what-is-the-best-openclaw-alternative" aria-hidden="true">#</a></h2>
 <p>Hermes Agent, for most people who liked what OpenClaw does. It does the same job under the same licence, and it is the only pick here whose README documents an import from <code>~/.openclaw</code>.</p>
-<figure class="mg" data-scene="compare"><img src="/blog/assets/media/openclaw-alternatives/versus.png" width="1600" height="900" loading="lazy" decoding="async" alt="Animation. A table compares OpenClaw and Hermes Agent on licence, GitHub stars, latest release, chat apps and switching, then Oscar gives the verdict."><script type="application/json">{"kicker":"Checked 5 Oct 2026","title":"OpenClaw against Hermes Agent","cols":["OpenClaw","Hermes Agent"],"pick":1,"rows":[{"label":"Licence","a":"MIT","b":"MIT","win":"","note":"A tie. Both repos are MIT licensed."},{"label":"GitHub stars","a":"391,425","b":"251,363","win":"a","note":"Read on GitHub, 5 Oct 2026."},{"label":"Latest release","a":"v2026.9.8, 3 Oct","b":"v2026.9.24, 24 Sep","win":"","note":"Both shipped a release in the last two weeks."},{"label":"Chat apps in README","a":"6 named, 20+ more","b":"5 named, plus CLI","win":"a","note":"Counted from each README's headline list."},{"label":"Switching","a":"You are here","b":"Has an importer","win":"b","note":"Add --dry-run to preview the import."}],"host":"oscar","say":"Hermes is the closest swap."}</script><figcaption>OpenClaw is the bigger project. Hermes Agent is the easiest move.</figcaption></figure>
+<figure class="mg" data-scene="compare"><img src="/blog/assets/media/openclaw-alternatives/versus.png" width="1600" height="900" loading="lazy" decoding="async" alt="Animation. A table compares OpenClaw and Hermes Agent on licence, GitHub stars, latest release, chat apps and switching, then Oscar gives the verdict."><script type="application/json">{"kicker":"Checked 5 Oct 2026","title":"OpenClaw against Hermes Agent","cols":["OpenClaw","Hermes Agent"],"pick":1,"rows":[{"label":"Licence","a":"MIT","b":"MIT","win":"","note":"A tie. Both repos are MIT licensed."},{"label":"GitHub stars","a":"391,425","b":"251,363","win":"a","note":"Read on GitHub, 5 Oct 2026."},{"label":"Latest release","a":"v2026.9.8, 3 Oct","b":"v2026.9.24, 24 Sep","win":"","note":"Both shipped a release in the last two weeks."},{"label":"Chat apps in README","a":"6 named, 20+ more","b":"5 named, plus CLI","win":"a","note":"Counted from each README's headline list."},{"label":"Switching","a":"You are here","b":"hermes claw migrate","win":"b","note":"Add --dry-run to preview the import."}],"host":"oscar","say":"Hermes is the closest swap."}</script><figcaption>OpenClaw is the bigger project. Hermes Agent is the easiest move.</figcaption></figure>
 <p>OpenClaw still wins on size and reach: more stars, more channels, and native apps for macOS, iOS, Android, Windows and Linux. If none of the three reasons above bothers you, stay. That is a fair outcome for a list like this.</p>
 <h2 id="is-there-a-free-openclaw-alternative" tabindex="-1">Is there a free OpenClaw alternative? <a class="anchor" href="#is-there-a-free-openclaw-alternative" aria-hidden="true">#</a></h2>
 <p>Yes: six of the seven are free and open source, and so is OpenClaw. The software costs nothing. The model does, unless you run a local one or reuse a plan you already pay for. Goose, for example, can use an existing Claude, ChatGPT or Gemini subscription.</p>
```

---

### Incident Patch 2: `92f06532` (2026-10-05)
**Commit Message**: seo-engine: day 08 PM, three pages on the scene kit and a Codex plan fact fix

New pages, each with four coded scenes from the blog scene kit and a title card:
- OpenClaw alternatives
- Claude Code alternatives
- How to use Claude Code

Fix: codex-cli-vs-claude-code plan facts re-read on 5 Oct 2026 (Pro at 100, 200
and 500 dollars, Pro 200 open again, Plus message estimates, Free and Go wording).

Each new page passed gate.mjs and a second independent fact review.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `blog/src/_data/media.json` (modified, +33/-0)
```diff
@@ -4418,5 +4418,38 @@
       "status": "ready"
     },
     "inline": {}
+  },
+  "how-to-use-claude-code": {
+    "title": "How to Use Claude Code: Setup, First Task and the Commands That Matter",
+    "category": "guides",
+    "hero": {
+      "file": "assets/media/how-to-use-claude-code/hero.png",
+      "alt": "Michael and Jim stand under a board with the path of this guide: install and sign in, run a first task, learn the commands that matter",
+      "prompt": "Title card: a stage scene drawn by the blog scene kit (assets/mg/kit.js), made for the title image only.",
+      "status": "ready"
+    },
+    "inline": {}
+  },
+  "openclaw-alternatives": {
+    "title": "OpenClaw Alternatives: 7 Picks for Chat, Code and Cloud",
+    "category": "comparisons",
+    "hero": {
+      "file": "assets/media/openclaw-alternatives/hero.png",
+      "alt": "Michael and Jim stand under a board that lists seven OpenClaw alternatives: Hermes Agent, Munder Difflin, NanoClaw, ZeroClaw, nanobot, Goose and Claude",
+      "prompt": "Title card: a stage scene drawn by the blog scene kit (assets/mg/kit.js), made for the title image only.",
+      "status": "ready"
+    },
+    "inline": {}
+  },
+  "claude-code-alternatives": {
+    "title": "Claude Code Alternatives: 7 Coding Agents to Switch To",
+    "category": "comparisons",
+    "hero": {
+      "file": "assets/media/claude-code-alternatives/hero.png",
+      "alt": "Michael and Jim stand under a board that lists Claude Code alternatives: Codex CLI, OpenCode, Cursor, Gemini CLI, Cline, Pi and Aider, with a last line that reads Munder Difflin runs a team",
+      "prompt": "Title card: a stage scene drawn by the blog scene kit (assets/mg/kit.js), made for the title image only.",
+      "status": "ready"
+    },
+    "inline": {}
   }
 }
```

**File**: `blog/src/posts/claude-code-alternatives.md` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+---
+title: "Claude Code Alternatives: 7 Coding Agents to Switch To"
+seoTitle: "7 Claude Code Alternatives in 2026: Free, Open Source, Editor"
+description: "Seven Claude Code alternatives checked on 5 Oct 2026: Codex CLI, OpenCode, Cursor, Gemini CLI, Cline, Pi and Aider, by licence, starting price and models."
+date: 2026-10-05
+category: comparisons
+categoryLabel: Comparisons
+type: Non-technical
+primaryKeyword: "claude code alternatives"
+secondaryKeywords: ["claude code alternative", "open source claude code alternative", "free claude code alternative", "cheaper alternative to claude code", "tools like claude code"]
+tags: ["Comparisons", "Claude Code", "CLI Agents", "Open Source", "Cost"]
+ogImage: "https://munderdiffl.in/blog/assets/media/claude-code-alternatives/hero.png"
+faq:
+  - q: "What is the best Claude Code alternative?"
+    a: "We think Codex CLI is the closest swap: a terminal coding agent from a model lab, with its code under Apache 2.0. On 5 Oct 2026 OpenAI's pricing page listed the CLI from ChatGPT Plus, which costs $20 a month, the same as Claude Pro billed monthly. If you want to choose the model yourself, pick OpenCode."
+  - q: "Is there a free Claude Code alternative?"
+    a: "Yes. OpenCode says free models are included, and its Zen price list marked several models as Free on 5 Oct 2026. Cline, Pi and Aider are free software too, but you pay a model provider for the tokens. Cursor has a free Hobby plan with limited Agent requests, and ChatGPT Free includes limited Codex access, though OpenAI's Codex pricing page lists only the desktop app on that plan."
+  - q: "Is there an open source alternative to Claude Code?"
+    a: "Six of the seven. On 5 Oct 2026 GitHub listed Codex CLI, Gemini CLI, Cline and Aider under Apache 2.0, and OpenCode and Pi under MIT. Cursor is proprietary, and so is Claude Code: its repo is public but its licence file says all rights reserved."
+  - q: "Can I use Claude models without Claude Code?"
+    a: "Yes. OpenCode, Cline, Pi and Aider all take an Anthropic API key, per their own sites on 5 Oct 2026. Cursor's model list on the same day included Claude Opus 5.5 and Claude Sonnet 5.5. You are then billed by the token, or through your Cursor plan."
+  - q: "Can I run Claude Code and another coding agent together?"
+    a: "Yes. Nothing stops you installing two agents on one computer. Munder Difflin is a free and open source desktop app built for this: it runs a team of coding agents such as Claude Code, Codex and Gemini CLI on your own computer, so you can mix them or switch."
+thumb: "/blog/assets/media/claude-code-alternatives/hero.png"
+---
+
+Our picks for a Claude Code alternative are Codex CLI if you want the closest swap, OpenCode or Pi if you want open source with any model, and Cursor or Cline if you want the agent inside an editor. Checked 5 Oct 2026.
+
+This list is for people who use Claude Code, or nearly did, and want something else. Our [Comparisons hub](/blog/topics/comparisons/) has the head to head posts, and [best AI coding agents](/blog/best-ai-coding-agents/) ranks the whole field.
+
+## Why look for a Claude Code alternative?
+
+We see four reasons people look elsewhere: price, licence, model choice, or wanting an editor. On 5 Oct 2026, [Anthropic's pricing page](https://claude.com/pricing) put Claude Code in Claude Pro ($20 if billed monthly) and Max (from $100 a month), and not in the Free plan.
+
+<figure class="mg" data-scene="stage"><img src="/blog/assets/media/claude-code-alternatives/reasons.png" width="1600" height="900" loading="lazy" decoding="async" alt="Animation. Michael, Kevin, Oscar, Dwight and Jim walk on stage one by one and each says one reason people look for a Claude Code alternative: price, licence, models and editors."><script type="application/json">{"kicker":"Checked 5 Oct 2026","title":"Why people look past Claude Code","script":[{"who":"michael","say":"Four reasons people look elsewhere. Go."},{"who":"kevin","say":"Claude Pro is $20 if billed monthly. Free has no Claude Code.","carry":"$20"},{"who":"oscar","say":"Public repo. Licence: all rights reserved."},{"who":"dwight","say":"Fact: it is built for Claude models.","point":"up-left"},{"who":"jim","say":"And some people just want an editor."}]}</script><figcaption>Four reasons, five colleagues. Prices from Anthropic's pricing page, 5 Oct 2026.</figcaption></figure>
+
+The Claude Code repo is public, but its licence file says "All rights reserved", so it is not open source; [is Claude Code open source](/blog/is-claude-code-open-source/) explains why that matters. It is also built around Claude models. If none of that bothers you, stay: it is a good tool.
+
+## Seven alternatives, plus a different kind of tool
+
+**1. Codex CLI.** [Codex CLI](https://github.com/openai/codex) is OpenAI's "coding agent from OpenAI that runs locally on your computer". The code is Apache 2.0. OpenAI's [pricing page](https://learn.chatgpt.com/docs/pricing) lis
```

**File**: `blog/src/posts/codex-cli-vs-claude-code.md` (modified, +15/-14)
```diff
@@ -1,8 +1,8 @@
 ---
 title: "Codex vs Claude Code: Plans, Limits and Computer Use (Sep 2026)"
-description: "Codex vs Claude Code, checked 29 Sep 2026: models, plans, usage limits, sandboxing, computer use, MCP and subagents in one dated table, then which to pick."
+description: "Codex vs Claude Code, plans checked 5 Oct 2026: models, plans, usage limits, sandboxing, computer use, MCP and subagents in one dated table, then which to pick."
 date: 2026-09-10
-updated: 2026-09-29
+updated: 2026-10-05
 category: comparisons
 categoryLabel: Comparisons
 type: Technical
@@ -13,7 +13,7 @@ faq:
   - q: "Is Codex better than Claude Code?"
     a: "Neither wins outright as of 29 Sep 2026. Codex is the better fit if you want to try it free in the desktop app, limits published per model, and computer use that can run in the background on a Mac. Claude Code is the better fit if you want Opus 5.5 as the default model and computer use from inside the CLI on a Pro or Max plan."
   - q: "Is Codex CLI free?"
-    a: "No. The CLI needs ChatGPT Plus ($20 a month) or higher, or an API key billed at API rates, per OpenAI's Codex pricing page checked 29 Sep 2026. The Free ($0) and Go ($8 a month) plans get GPT-6 Luna in the desktop app only, subject to rollout. Claude Code is not on Claude's Free plan either; it starts at Pro."
+    a: "Partly. OpenAI's help centre says Codex is included across ChatGPT plans, including Free and Go, but the Free ($0) and Go ($8 a month) cards on its Codex pricing page list the desktop app only, subject to rollout. Plus ($20 a month) is the first card that lists the CLI, or you can use an API key billed at API rates. Checked 5 Oct 2026. Claude Code is not on Claude's Free plan either; it starts at Pro."
   - q: "Which has higher usage limits, Codex or Claude Code?"
     a: "You can only compare them on paper for Codex, because OpenAI publishes estimated messages per five hours for each model and Anthropic does not. Both products meter a rolling five hour window plus a weekly limit, and both sell credits once you run out. The multipliers line up: 5x and 20x tiers on each side."
   - q: "Does Claude Code read AGENTS.md?"
@@ -35,8 +35,8 @@ You can also skip the choice: switch between the two by hand, or run both in [Mu
 | Where it runs | CLI, IDE extension, ChatGPT desktop app, web, iOS | CLI, IDE extensions, desktop app, web |
 | Source | CLI is Apache-2.0 on GitHub | Closed, Anthropic commercial terms |
 | Models | GPT-6 Astra, GPT-6 Sol, GPT-6 Luna, GPT-5.6 family. The pricing page still lists GPT-5.5 (retires 14 Oct 2026), GPT-5.4 and GPT-5.4 mini | Opus 5.5 is the default on Pro, Max, Team and Enterprise, plus Sonnet and Haiku. Fable 5.1 can bill to usage credits, depending on plan and seat tier |
-| Cheapest plan with the CLI | Plus, $20 a month (Free and Go get the desktop app only) | Pro, $20 a month |
-| Heavy plans | Pro 5x from $100, Pro 20x at $200 (new sign ups paused, reported 11 Sep 2026) | Max 5x at $100, Max 20x at $200 |
+| First plan that lists the CLI | Plus, $20 a month (the Free and Go cards list the desktop app only) | Pro, $20 a month |
+| Heavy plans | Pro at $100, $200 or $500 a month; Astra Ultrafast on the $500 plan only (checked 5 Oct 2026) | Max 5x at $100, Max 20x at $200 |
 | Limits | Published ranges per model per 5 hours, weekly limits may apply, credits after | 5 hour session limit plus a weekly limit, no published message counts, credits after |
 | Sandbox | On by default: Seatbelt on macOS, bubblewrap on Linux and WSL2, native Windows sandbox | Built in Bash sandbox (Seatbelt, bubblewrap), set up with `/sandbox`. No native Windows |
 | Approval controls | `--sandbox` and `--ask-for-approval`, two flags | One `--permission-mode` with six modes |
@@ -49,21 +49,22 @@ Sources: OpenAI's [Codex pricing page](https://learn.chatgpt.com/docs/pricing),
 
 ## Which one has higher usage limits, Codex or Claude Code?
 
-Only Codex lets you compare on paper, because OpenAI publishes estimated local messages per five hours for each model and Anthropic publishes none. OpenAI's pricing page, checked 29 Sep 2026, lists these ranges:
+Only Codex lets you compare on paper, because OpenAI publishes estimated local messages per five hours for each model and Anthropic publishes none. OpenAI's pricing page, checked 5 Oct 2026, lists these ranges for Plus and says Pro plans currently have no five hour limit:
 
-| Model | Plus | Pro 5x | Pro 20x |
-|:--|:--|:--|:--|
-| GPT-6 Astra | 5 to 45 | 25 to 225 | 100 to 900 |
-| GPT-6 Sol | 15 to 150 | 70 to 700 | 300 to 3,000 |
-| GPT-6 Luna | 350 to 3,000 | 1,750 to 14,000 | 7,000 to 56,000 |
+| Model | Plus, local messages per five hours |
+|:--|:--|
+| GPT-6 Astra | 5 to 45 |
+| GPT-6.1 Sol | 15 to 160 |
+| GPT-6 Sol | 15 to 150 |
+| GPT-6 Luna | 350 to 3,000 |
 
 The same page says weekly limits may also apply, and that Plus and Pro users can buy credits when they run out. The spread inside each range comes from task size, context and reasonin
```

**File**: `blog/src/posts/conductor-claude-code-alternative.md` (modified, +2/-1)
```diff
@@ -85,7 +85,8 @@ language, shared MemPalace memory, inter-agent messaging, and a watchable office
 
 For the broader field, see [the best tools to run multiple Claude Code
 agents](/blog/best-claude-code-multi-agent-tools/) and a criteria-based [orchestration tools
-comparison](/blog/claude-code-orchestration-tools-compared/).
+comparison](/blog/claude-code-orchestration-tools-compared/). To replace the agent itself, see our
+[Claude Code alternatives](/blog/claude-code-alternatives/).
 
 ---
 
```

**File**: `blog/src/posts/how-to-use-claude-code-plan-mode.md` (modified, +1/-1)
```diff
@@ -130,7 +130,7 @@ Use them in order. Plan mode decides what to change, accept edits auto-approves
 * **Pick accept edits if** you already know the change and will read `git diff` afterwards.
 * **Pick auto mode if** it's a long task you've already planned and you'd rather not click through prompts.
 
-If one risky command is the real worry, a [PreToolUse hook](/blog/claude-code-hooks-explained/) blocks just that call, and [why Claude Code keeps asking for permission](/blog/why-does-claude-code-keep-asking-for-permission/) explains the prompts you'll see in Manual mode.
+If one risky command is the real worry, a [PreToolUse hook](/blog/claude-code-hooks-explained/) blocks just that call, and [why Claude Code keeps asking for permission](/blog/why-does-claude-code-keep-asking-for-permission/) explains the prompts you'll see in Manual mode. New to the tool? Start with [how to use Claude Code](/blog/how-to-use-claude-code/).
 
 ## What changed in plan mode in the last six months?
 
```

**File**: `blog/src/posts/how-to-use-claude-code.md` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+---
+title: "How to Use Claude Code: Setup, First Task and the Commands That Matter"
+description: "How to use Claude Code, checked 5 Oct 2026: install it, sign in, run a first task, then the commands, shortcuts and habits a beginner needs."
+date: 2026-10-05
+category: guides
+categoryLabel: Guides
+type: Technical
+primaryKeyword: "how to use claude code"
+secondaryKeywords: ["claude code setup", "claude code tutorial", "how to install claude code", "claude code for beginners", "claude code commands"]
+tags: ["Guides", "Claude Code", "Getting Started"]
+faq:
+  - q: "Is Claude Code free to use?"
+    a: "No. Anthropic's setup docs, checked 5 Oct 2026, say Claude Code requires a Pro, Max, Team, Enterprise or Console account, and that the free claude.ai plan does not include Claude Code access. Anthropic's pricing page says Claude Code is included in all paid plans and shares their usage limits."
+  - q: "Do I need Node.js to install Claude Code?"
+    a: "Only for the npm route: the setup docs, checked 5 Oct 2026, say the npm package requires Node.js 22 or later. The install Anthropic recommends is the native installer, one curl command on macOS, Linux and WSL or one PowerShell command on Windows, and it updates itself in the background. Homebrew and WinGet installs do not auto-update."
+  - q: "How do I start Claude Code in a project?"
+    a: "Open a terminal, cd into the project folder and run claude. The first run asks you to log in through your browser. After that, type a question such as what does this project do? and Claude Code reads the files it needs."
+  - q: "What is `CLAUDE.md` and do I need one?"
+    a: "It is a file Claude reads at the start of every conversation, used for build commands, code style and workflow rules. You don't need one to start, but running /init generates a starter file from your project. Anthropic's memory docs suggest keeping each file under 200 lines."
+  - q: "How do I undo something Claude Code changed?"
+    a: "Press Esc twice on an empty prompt, or run /rewind, to open the rewind menu and restore the code, the conversation or both. Checkpoints only track edits made through Claude's file editing tools, not changes made by shell commands. Anthropic's docs say it is not a replacement for git, so commit before a big task."
+---
+
+To use Claude Code, install it with one command, run `claude` inside a project folder, log in through your browser, and type what you want in plain English. It reads your code, edits files and runs commands. You need a paid Claude plan or a Console account. Checked 5 Oct 2026.
+
+You can do all of this by hand, or use [Munder Difflin](https://harnessmd.com/download), free and open source, a desktop app that runs a team of coding agents such as Claude Code, Codex and Gemini CLI on your own computer. It's for the day one Claude Code session is not enough. The [install guide](/blog/how-to-install-and-use-munder-difflin/) covers that setup. This post is the single session path, and it sits with the rest of our [guides](/blog/topics/guides/).
+
+## What do you need before you install Claude Code?
+
+You need a supported computer and a paid account. Anthropic's [setup page](https://code.claude.com/docs/en/setup) lists macOS 13.0 or later, Windows 10 1809 or later, Ubuntu 20.04, Debian 10 or Alpine Linux 3.19 and up, with 4 GB of RAM or more and an internet connection.
+
+On accounts, the same page says Claude Code requires a Pro, Max, Team, Enterprise or Console account, and that the free claude.ai plan does not include it. Our [Claude Code cost breakdown](/blog/how-much-does-claude-code-cost/) covers which plan fits.
+
+## How do you set up Claude Code?
+
+Run the native installer, check the version, then start `claude` in a project and log in. These are the commands from Anthropic's [quickstart](https://code.claude.com/docs/en/quickstart), read on 5 Oct 2026.
+
+<figure class="mg" data-scene="flow"><img src="/blog/assets/media/how-to-use-claude-code/setup-steps.png" width="1600" height="900" loading="lazy" decoding="async" alt="Animation. Pam walks along five boxes that light up in order: Install, Sign in, Open a project, Ask a question, Make a change."><script type="application/json">{"kicker":"Setup","title":"Claude Code from zero to a first change","nodes":[{"label":"Install","note":"One command in your terminal."},{"label":"Sign in","note":"Run claude. Log in in the browser."},{"label":"Open a project","note":"cd to the folder, then run claude."},{"label":"Ask a question","note":"Try: what does this project do?"},{"label":"Make a change","note":"It shows you the change."}],"labels":["--version","","",""],"host":"pam","say":"Five boxes. I drew them myself."}</script><figcaption>The five setup steps, from Anthropic's quickstart. Checked 5 Oct 2026.</figcaption></figure>
+
+1. **Install.** On macOS, Linux or WSL:
+
+```bash
+curl -fsSL https://claude.ai/install.sh | bash
+```
+
+On Windows PowerShell:
+
+```powershell
+irm h
```

**File**: `blog/src/posts/openclaw-alternatives.md` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+---
+title: "OpenClaw Alternatives: 7 Picks for Chat, Code and Cloud"
+seoTitle: "7 OpenClaw Alternatives in 2026: Free, Open Source and Hosted"
+description: "Seven OpenClaw alternatives sorted by job: Hermes Agent, Munder Difflin, NanoClaw, ZeroClaw, nanobot, Goose and Claude. Licences and prices checked 5 Oct 2026."
+date: 2026-10-05
+category: comparisons
+categoryLabel: Comparisons
+type: Non-technical
+primaryKeyword: "openclaw alternatives"
+secondaryKeywords: ["openclaw alternative", "best openclaw alternative", "open source openclaw alternative", "openclaw vs hermes agent", "apps like openclaw"]
+tags: ["Comparisons", "AI Agents", "Open Source", "Local-First"]
+ogImage: "https://munderdiffl.in/blog/assets/media/openclaw-alternatives/hero.png"
+faq:
+  - q: "What is the best OpenClaw alternative?"
+    a: "Hermes Agent, if you want the same job: a personal assistant in your chat apps that you host yourself. It is MIT licensed and ships a command that imports an OpenClaw setup. If your real work is code, Munder Difflin fits better."
+  - q: "Is there a free OpenClaw alternative?"
+    a: "Yes. Hermes Agent, Munder Difflin, NanoClaw, ZeroClaw, nanobot and Goose are all free and open source, checked on 5 Oct 2026. You still bring a model: an API key, a subscription you already pay for, or a local model."
+  - q: "Can I move my OpenClaw setup to another agent?"
+    a: "To Hermes Agent, yes. Its README says `hermes claw migrate` imports your settings, memories, skills and API keys, and `--dry-run` previews the import first. The setup wizard also offers the migration when it finds `~/.openclaw`."
+  - q: "Is there an OpenClaw alternative for coding?"
+    a: "Munder Difflin is the one built for it: a desktop app that runs a team of coding agents such as Claude Code, Codex and Gemini CLI on your own computer. Goose also handles code, as one general agent with a desktop app and a CLI."
+  - q: "Is there a hosted OpenClaw alternative?"
+    a: "OpenClaw's README says it has no hosted service, so you always run it yourself. Of the picks here, only Claude is hosted: Anthropic says the work runs on its servers and scheduled tasks do not need your computer awake. It needs a paid plan."
+thumb: "/blog/assets/media/openclaw-alternatives/hero.png"
+---
+
+The best OpenClaw alternative is Hermes Agent if you want the same job done, a personal assistant in your chat apps, and [Munder Difflin](https://harnessmd.com/download) if your real work is code. NanoClaw, ZeroClaw, nanobot, Goose and Claude cover tighter isolation, smaller installs and a hosted option. Checked 5 Oct 2026.
+
+<figure class="mg" data-scene="stage"><img src="/blog/assets/media/openclaw-alternatives/cast.png" width="1600" height="900" loading="lazy" decoding="async" alt="Animation. Michael, Jim, Dwight, Kevin and Oscar walk on one by one and each says one line about choosing between seven OpenClaw alternatives."><script type="application/json">{"kicker":"OpenClaw alternatives","title":"Seven ways out, sorted by job","script":[{"who":"michael","say":"Leaving OpenClaw? Seven ways out."},{"who":"jim","say":"Chat helper, coding team or cloud."},{"who":"dwight","say":"Rule: check where the tools run.","point":"up-left"},{"who":"kevin","say":"Six of the seven are free.","carry":"$0"},{"who":"oscar","say":"I read every repo on 5 Oct 2026."}]}</script><figcaption>Seven alternatives. Six are free and open source, one is hosted.</figcaption></figure>
+
+This guide sits in our [Comparisons hub](/blog/topics/comparisons/), next to the wider list of [open source AI agents](/blog/open-source-ai-agents/).
+
+## What is OpenClaw, and why would you leave it?
+
+OpenClaw is an open source AI assistant that runs on your own computer and answers in the chat apps you already use. Its [README](https://github.com/openclaw/openclaw) names Discord, iMessage, Slack, Teams, Telegram and WhatsApp, "and 20+ more". It is MIT licensed, run by the OpenClaw Foundation, and has "no paid tier, hosted service, or token". GitHub showed 391,425 stars and release v2026.9.8 (3 Oct 2026) on 5 Oct 2026.
+
+So nobody leaves over price. From OpenClaw's own README, the reasons are these:
+
+- **You host it.** There is no hosted service. You install it on your own machine (the installer sets up Node for you), and in our reading it only answers while that machine is running.
+- **Tools run on your machine.** The README says "Tools run on the host for the main session unless you configure sandboxing".
+- **It is a personal assistant.** If your work is a codebase, you may want a tool built for that.
+
+## Seven OpenClaw alternatives, by job
+
+Two of the seven kept the claw in the name. Nobody said naming was easy.
+
+**1. Hermes Agent.** [Hermes Agent](https://github.com/NousResearch/hermes-agent) from Nous Research is the closest swap. It is MIT licensed, creates skills from experience, has a cron scheduler, and answers on Telegram, Discord, Slack, WhatsApp and Signal. `herme
```

**File**: `blog/src/posts/what-is-hermes-agent.md` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ Zero assets is expected: the installer pulls from git, so the release is a tag a
 
 ## Hermes Agent vs OpenClaw, Munder Difflin, Claude Code and Pi: which should you use?
 
-Hermes or OpenClaw if you want a personal assistant in your chat apps, the other three if the job is code. Licences and releases read from each repo through `gh api` on 3 Oct 2026, dates in UTC:
+Hermes or OpenClaw if you want a personal assistant in your chat apps, the other three if the job is code. Our [OpenClaw alternatives](/blog/openclaw-alternatives/) list has more picks. Licences and releases read from each repo through `gh api` on 3 Oct 2026, dates in UTC:
 
 | | Licence | Where it runs | What it is for | Latest release |
 | --- | --- | --- | --- | --- |
```

---

### Incident Patch 3: `0ba8b440` (2026-10-05)
**Commit Message**: blog: shared scene kit for coded motion graphics (kit.js, kit.css, cast)

Seven data driven scenes for blog posts: stage, price-ladder, compare,
timeline, flow, before-after and counter. The cast is packed from the
landing page sprites by blog/scripts/build-mg-cast.mjs, pixel for pixel.
Each scene swaps a still image for a live SVG, plays only on screen,
honours reduced motion, works by keyboard and touch, and keeps the still
when the script is blocked. Guide: blog/MG_KIT.md.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `blog/MG_KIT.md` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+# Blog scene kit
+
+Coded motion graphics for blog posts. One script and one stylesheet for every post, no library.
+
+| File | What it is |
+| --- | --- |
+| `src/assets/mg/kit.js` | The scenes, the cast and the player |
+| `src/assets/mg/kit.css` | The frame, the focus ring |
+| `src/assets/mg/cast.png` | The landing page cast, 15 characters, built by `scripts/build-mg-cast.mjs` |
+| `src/assets/mg/demo.html` | Every scene with sample data: `/blog/assets/mg/demo.html` |
+
+## Put a scene in a post
+
+Add the two files once, at the end of the post:
+
+```html
+<link rel="stylesheet" href="/blog/assets/mg/kit.css"><script defer src="/blog/assets/mg/kit.js"></script>
+```
+
+Then one figure per scene. Keep it on one line so Markdown leaves it alone. The image is the still; the JSON is the page's own data.
+
+```html
+<figure class="mg" data-scene="price-ladder"><img src="/blog/assets/media/SLUG/prices.png" width="1600" height="900" loading="lazy" decoding="async" alt="Animation. Four price steps rise from Free to Team while Kevin points at them."><script type="application/json">{"title":"What each plan costs a month","prefix":"$","items":[{"label":"Free","value":0,"display":"Free"},{"label":"Pro","value":20,"highlight":true,"note":"Most people pick Pro."}],"host":"kevin","say":"Pro is the sweet spot."}</script><figcaption>Prices checked on 5 Oct 2026.</figcaption></figure>
+```
+
+What the kit does for every scene:
+
+* Swaps the still for a live SVG, 960 by 540, and plays it only while it is on screen.
+* Reduced motion: draws the still frame and does not loop. Taps and keys still work, without the move.
+* Script blocked or a broken scene: the still image stays.
+* Every tap target is a button: Tab reaches it, Enter or Space presses it, arrow keys move along a row.
+* After a reader taps, the story stops on its still frame and a "Play again" button appears.
+* Sends `blog_scene_view` (first time on screen) and `blog_scene_interact` (first tap) to PostHog with `slug` and `scene`, only when `window.posthog` exists.
+
+## Stills
+
+`?mgstill` freezes every scene on its own still frame. `?mgstill=3.5` freezes on second 3.5. Screenshot the figure at 1600 by 900 for the post still and the title image.
+
+## Scenes and their data
+
+Every scene takes `kicker` (the yellow chip) and `title`. `host` is a cast name; `say` is the host's closing line (keep it under 40 characters).
+
+| Scene | Data | The reader can |
+| --- | --- | --- |
+| `stage` | `script: [{ who, say, point, carry }]`, optional `board: { label, lines }`. Up to 5 lines. `point`: left, right, up-left, up-right, raise. `carry`: a short sign held at the chest | Tap a character to hear the line again |
+| `price-ladder` | `prefix`, `suffix`, `items: [{ label, value, display, note, highlight }]`, up to 6 | Tap or hover a step for its note |
+| `compare` | `cols: [a, b]`, `pick` (0 or 1), `rows: [{ label, a, b, win, note }]`, up to 5. `win` is "a", "b" or "" | Tap a row for its note |
+| `timeline` | `events: [{ when, label, note }]`, up to 6 | Tap a date; the host walks to it |
+| `flow` | `nodes: [{ label, note }]`, up to 8 (5 or more wrap to two rows), `labels: [text on arrow i]` | Tap a step or use arrow keys |
+| `before-after` | `before: { label, lines }`, `after: { label, lines }` | Tap the card to flip it |
+| `counter` | `from`, `to`, `prefix`, `suffix`, `label`, `note` | Tap the number to count again |
+
+Fixed roles, so readers learn the cast: Jim explains, Dwight gives rules and warnings, Kevin does prices and numbers, Oscar checks facts, Pam draws diagrams, Michael opens and closes. The defaults follow this.
+
+## The cast
+
+`cast.png` is packed from the landing page (`docs/index.html`, classes `.sp-<name>` and `.pt-<name>`), pixel for pixel. Nothing is redrawn. Run `node scripts/build-mg-cast.mjs` when the landing page cast changes; it also rewrites the cast table in `kit.js`.
+
+The landing strips only walk. The kit adds, on the same pixel grid and in each character's own colours: an arm that points (side or up), two raised arms, a hop, a talking bob, a speech bubble and a carried sign.
+
+## A custom scene for one page
+
+A page script registers its own scene with the same tools the kit uses:
+
+```html
+<script>
+(window.MGQ = window.MGQ || []).push((MG) => MG.scene("my-scene", {
+  build(svg, data, api) {
+    MG.stage(svg, { kicker: "Launch", title: "My scene" });
+    const jim = MG.actor(svg, "jim"), bub = MG.bubble(svg, 20);
+    bub.set("Hello.");
+    const draw = (t) => {
+      const w = MG.walk(t, 0.2, 1.4, -60, 300);
+      jim.draw({ x: w.x, step: w.step, arm: t > 1.5 ? "up-right" : "" });
+      bub.draw(300, MG.GROUND - jim.top - 4, MG.p(t, 1.6, 2));
+    };
+    return { draw, dur: 6, still: 3 };
+  },
+}));
+</script>
+```
+
+`draw(t)` must draw the whole frame from the time alone, so stills and reduced motion work. For a tap target use `MG.hit(parent, label, fn)` then `MG.ring(...)`, and call `api.poke(
```

**File**: `blog/scripts/build-mg-cast.mjs` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+// node scripts/build-mg-cast.mjs
+// Builds the blog scene kit's cast from the landing page, so the blog never redraws a character.
+// Reads the .sp-<name> walk strips (72 by 32, 4 frames) and .pt-<name> portraits (18 by 28) out of docs/index.html,
+// packs them into src/assets/mg/cast.png (one row per character: 4 walk frames, then the portrait),
+// and rewrites the CAST table in src/assets/mg/kit.js (row, shoulder edges, sleeve, skin and outline colours for the arms).
+// Run it again whenever the landing page cast changes.
+import fs from 'node:fs';
+import zlib from 'node:zlib';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
+const html = fs.readFileSync(path.join(root, '../docs/index.html'), 'utf8');
+const ORDER = ['michael', 'jim', 'pam', 'dwight', 'kevin', 'angela', 'oscar', 'stanley', 'phyllis', 'andy', 'kelly', 'ryan', 'toby', 'creed', 'meredith'];
+const FW = 18, FH = 32, COLS = 5;
+
+function decode(buf) {
+  let o = 8, w = 0, h = 0; const idat = [];
+  while (o < buf.length) {
+    const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
+    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[9] !== 6 || data[12]) throw new Error('expected 8 bit RGBA, not interlaced'); }
+    if (type === 'IDAT') idat.push(data);
+    o += 12 + len;
+  }
+  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4), bpl = w * 4;
+  for (let y = 0; y < h; y++) {
+    const f = raw[y * (bpl + 1)], row = y * bpl;
+    for (let x = 0; x < bpl; x++) {
+      const v = raw[y * (bpl + 1) + 1 + x], a = x >= 4 ? px[row + x - 4] : 0, b = y ? px[row - bpl + x] : 0, c = x >= 4 && y ? px[row - bpl + x - 4] : 0;
+      let pr = 0;
+      if (f === 1) pr = a; else if (f === 2) pr = b; else if (f === 3) pr = (a + b) >> 1;
+      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
+      px[row + x] = (v + pr) & 255;
+    }
+  }
+  return { w, h, px };
+}
+const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
+const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
+const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
+function encode(px, w, h) {
+  const raw = Buffer.alloc((w * 4 + 1) * h);
+  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
+  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
+  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
+}
+
+// The last rule for a class wins in the page, so the last match wins here.
+const art = {};
+for (const m of html.matchAll(/\.(sp|pt)-([a-z]+)\{background-image:url\(data:image\/png;base64,([A-Za-z0-9+/=]+)\)/g)) art[m[1] + '-' + m[2]] = decode(Buffer.from(m[3], 'base64'));
+
+const W = FW * COLS, H = FH * ORDER.length, out = Buffer.alloc(W * H * 4);
+const blit = (src, sx, sw, dx, dy) => { for (let y = 0; y < src.h; y++) for (let x = 0; x < sw; x++) src.px.copy(out, ((dy + y) * W + dx + x) * 4, (y * src.w + sx + x) * 4, (y * src.w + sx + x) * 4 + 4); };
+const hex = (s, x, y) => { const i = (y * s.w + x) * 4; return '#' + [0, 1, 2].map((k) => s.px[i + k].toString(16).padStart(2, '0')).join('').toUpperCase(); };
+const alpha = (s, x, y) => s.px[(y * s.w + x) * 4 + 3];
+const table = {};
+ORDER.forEach((name, row) => {
+  const sp = art['sp-' + name], pt = art['pt-' + name];
+  if (!sp || !pt) throw new Error('landing page has no sprite for ' + name);
+  if (sp.w !== 72 || sp.h !== 32 || pt.w !== 18 || pt.h !== 28) throw new Error('unexpected sprite size for ' + name);
+  for (let f = 0; f < 4; f++) blit(sp, f * FW, FW, f * FW, row * FH);
+  blit(pt, 0, FW, 4 * FW, row * FH);
+  // Shoulder row of frame 0: where an arm joins the body, and the colours it is drawn in.
+  const Y = 19; let l = 0, r = FW - 1;
+  while (l < FW && alpha(sp, l, Y) < 128) l++;
+  while (r > 0 && alpha(sp, r, Y) < 128) r--;
+  const tally = {};
+  for (let y = 8; y <= 14; y++) for (let x = 5; x <= 12; x++) { const c = hex(sp, x, y); tally[c] = (tally[c] || 0) + 1; }
+  const skin = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
+  table[name] = [row, l, r, hex(sp, l + 1, Y), skin, hex(sp, l, Y)];
+});
+fs.mkdirSync(path.join(root, 'src/assets/mg'), { recursive: true });
+fs.writeFileSync(path.join(root, 'src/
```

**File**: `blog/src/assets/mg/demo.html` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+<!doctype html>
+<html lang="en">
+<head>
+<meta charset="utf-8">
+<meta name="viewport" content="width=device-width, initial-scale=1">
+<meta name="robots" content="noindex">
+<title>Blog scene kit: every scene</title>
+<link rel="stylesheet" href="kit.css">
+<style>
+  body { margin: 0; background: #FCFAF0; color: #1A1320; font: 16px/1.6 system-ui, sans-serif; }
+  .prose { max-width: 760px; margin: 0 auto; padding: 32px 16px 80px; }
+  h1 { font-size: 28px; } h2 { font-size: 18px; margin: 48px 0 0; font-family: ui-monospace, monospace; }
+</style>
+</head>
+<body>
+<main class="prose">
+<h1>Blog scene kit: every scene</h1>
+<p>Test page for blog/src/assets/mg. The data here is sample data, not facts. Add ?mgstill to freeze each scene on its still frame. Real posts ship a still image in each figure; this page uses an empty one.</p>
+
+<h2>stage</h2>
+<figure class="mg" data-scene="stage"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. Michael walks in and opens, Jim explains, Dwight gives the rule, Kevin carries the number."><script type="application/json">{"kicker":"The cast","title":"Everyone has one job","script":[{"who":"michael","say":"Welcome to the blog. I open and I close."},{"who":"jim","say":"I explain how it works."},{"who":"dwight","say":"Rule one: no red. Ever.","point":"up-left"},{"who":"kevin","say":"I do the numbers.","carry":"$0"}]}</script><figcaption>stage: cast members walk in, stop, point and speak.</figcaption></figure>
+
+<h2>price-ladder</h2>
+<figure class="mg" data-scene="price-ladder"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. Four price steps rise from Free to Team while Kevin points at them."><script type="application/json">{"kicker":"Sample prices","title":"What each plan costs a month","prefix":"$","items":[{"label":"Free","value":0,"display":"Free","note":"Free covers one agent."},{"label":"Solo","value":12,"note":"Solo adds five agents."},{"label":"Pro","value":20,"highlight":true,"note":"Pro is the one most people pick."},{"label":"Team","value":45,"note":"Team is per seat."}],"host":"kevin","say":"Pro is the sweet spot."}</script><figcaption>price-ladder: tap a step for its note.</figcaption></figure>
+
+<h2>compare</h2>
+<figure class="mg" data-scene="compare"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. A table compares Tool A and Tool B on four rows and Oscar gives the verdict."><script type="application/json">{"kicker":"Sample compare","title":"Tool A against Tool B","cols":["Tool A","Tool B"],"pick":1,"rows":[{"label":"Price","a":"$20 a month","b":"Free","win":"b","note":"Checked on both pricing pages."},{"label":"Open source","a":"No","b":"Yes","win":"b"},{"label":"Runs offline","a":"Yes","b":"Yes","win":"","note":"A tie. Both run on your machine."},{"label":"Setup time","a":"2 minutes","b":"10 minutes","win":"a"}],"host":"oscar","say":"Tool B wins three of four."}</script><figcaption>compare: tap a row and Oscar checks it.</figcaption></figure>
+
+<h2>timeline</h2>
+<figure class="mg" data-scene="timeline"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. Jim walks along a timeline of four dates and says what happened at each."><script type="application/json">{"kicker":"Sample timeline","title":"How the release went","events":[{"when":"May","label":"First build","note":"One agent, one desk."},{"when":"July","label":"Open source","note":"The repo went public."},{"when":"Sept","label":"Pro","note":"The paid plan shipped."},{"when":"Oct","label":"Halloween","note":"Everyone got a costume."}],"host":"jim"}</script><figcaption>timeline: tap a date and Jim walks to it.</figcaption></figure>
+
+<h2>flow</h2>
+<figure class="mg" data-scene="flow"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. A four step flow draws itself from Prompt to Review while Pam points at each step."><script type="application/json">{"kicker":"Sample flow","title":"From a prompt to a merged change","nodes":[{"label":"Prompt","note":"You say what you want."},{"label":"Plan","note":"The agent writes a plan first."},{"label":"Code","note":"It edits files in a worktree."},{"label":"Review","note":"You read the diff and merge."}],"labels":["","ok",""],"host":"pam","say":"Four steps. That is all."}</script><figcaption>flow: tap a step, or use the arrow keys.</figcaption></figure>
+
+<h2>flow, six steps</h2>
+<figure class="mg" data-scene="flow"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. A six step flow in two rows."><script type="application/json">{"title":"Six steps wrap onto two rows","nodes":[{"label"
```

**File**: `blog/src/assets/mg/kit.css` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+/* Munder Difflin blog scene kit. One stylesheet for every post. Pairs with kit.js. */
+.prose figure.mg { margin: 42px 0; }
+.prose figure.mg img, .mg .mg-svg { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; border: 1px solid #1A1320; border-radius: 16px; background: #1A1320; }
+.mg figcaption { font: 500 13px/1.5 "Space Grotesk", system-ui, sans-serif; color: #6B5878; padding-top: 10px; text-align: center; }
+.mg .mg-svg { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
+.mg .mg-svg text { -webkit-user-select: none; user-select: none; }
+.mg .mg-svg image { image-rendering: pixelated; }
+.mg .mg-hit { cursor: pointer; outline: none; }
+.mg .mg-ring { stroke-opacity: 0; transition: stroke-opacity 0.15s; }
+.mg .mg-hit:focus-visible > .mg-ring { stroke-opacity: 1; }
+@media (hover: hover) { .mg .mg-hit:hover > .mg-ring { stroke-opacity: 0.45; } }
+@media (prefers-reduced-motion: reduce) { .mg .mg-ring { transition: none; } }
```

**File**: `blog/src/assets/mg/kit.js` (added, +569/-0)
```diff
@@ -0,0 +1,569 @@
+/* Munder Difflin blog scene kit. One script for every post. No dependencies.
+   A post ships <figure class="mg" data-scene="NAME"> holding a still <img> and, for kit scenes, a
+   <script type="application/json"> with the page's own data. This script swaps the still for a live SVG
+   scene (viewBox 960 by 540) that plays only while on screen. Reduced motion keeps one drawn frame.
+   "?mgstill=<seconds>" freezes every scene on that frame, "?mgstill" alone on each scene's still frame.
+   Custom scenes register with (window.MGQ = window.MGQ || []).push((MG) => MG.scene("name", {...})).
+   Guide: blog/MG_KIT.md. */
+(() => {
+  const NS = "http://www.w3.org/2000/svg";
+  const C = { ink: "#1A1320", ink2: "#251B2E", ink3: "#3D2E4A", faint: "#8E7B9C", soft: "#D9CFE0", line: "#4A3A58", paper: "#FCFAF0", y: "#FFCA54", sky: "#4ECDC4", lilac: "#B197FC", blue: "#6C8EF5", mint: "#6BCF7F" };
+  const W = 960, H = 540, GROUND = 500, GROT = '"Space Grotesk", system-ui, sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace';
+  const BASE = (document.currentScript && document.currentScript.src ? document.currentScript.src : "/blog/assets/mg/kit.js").replace(/[^/]*$/, "");
+  const clamp = (v) => Math.max(0, Math.min(1, v));
+  const p = (t, a, b) => clamp((t - a) / (b - a));
+  const io = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
+  const out = (t) => 1 - Math.pow(1 - t, 3);
+  const back = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
+  const hopY = (k) => Math.sin(clamp(k) * Math.PI);
+  const lerp = (a, b, k) => a + (b - a) * k;
+  const el = (tag, attrs, parent, text) => {
+    const n = document.createElementNS(NS, tag);
+    for (const k in attrs) n.setAttribute(k, attrs[k]);
+    if (text != null) n.textContent = text;
+    if (parent) parent.appendChild(n);
+    return n;
+  };
+  const set = (n, attrs) => { for (const k in attrs) n.setAttribute(k, attrs[k]); };
+  const txt = (parent, x, y, s, size, fill, extra) => el("text", Object.assign({ x, y, "font-size": size, fill, "font-family": GROT, "font-weight": 500 }, extra || {}), parent, s);
+  const wrap = (s, n) => {
+    const o = []; let l = "";
+    String(s == null ? "" : s).split(/\s+/).forEach((w) => { if (l && (l + " " + w).length > n) { o.push(l); l = w; } else l = l ? l + " " + w : w; });
+    if (l) o.push(l);
+    return o.length ? o : [""];
+  };
+  const lines = (parent, x, y, arr, size, fill, extra, lh) => {
+    const t = txt(parent, x, y, null, size, fill, extra);
+    arr.forEach((s, i) => el("tspan", { x, dy: i ? lh || size * 1.28 : 0 }, t, s));
+    return t;
+  };
+  const num = (v, d) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
+  const decimals = (v) => (String(v).split(".")[1] || "").length;
+
+  // Stage: deep ink panel, a soft glow, a fine grid, a kicker chip and a title.
+  let uid = 0;
+  function stage(svg, data, glow) {
+    const id = "mg" + ++uid, d = el("defs", {}, svg), gl = glow || [0.5, 0.35];
+    const g = el("radialGradient", { id: id + "g", cx: gl[0], cy: gl[1], r: 0.75 }, d);
+    el("stop", { offset: 0, "stop-color": "#3A2A4A" }, g);
+    el("stop", { offset: 1, "stop-color": C.ink }, g);
+    const pt = el("pattern", { id: id + "p", width: 48, height: 48, patternUnits: "userSpaceOnUse" }, d);
+    el("path", { d: "M48 0H0V48", fill: "none", stroke: "#FFFFFF", "stroke-opacity": 0.035, "stroke-width": 1 }, pt);
+    el("rect", { width: W, height: H, fill: `url(#${id}g)` }, svg);
+    el("rect", { width: W, height: H, fill: `url(#${id}p)` }, svg);
+    if (data && data.kicker) chip(svg, 60, 36, String(data.kicker).toUpperCase());
+    if (data && data.title) lines(svg, 60, data.kicker ? 104 : 70, wrap(data.title, 52).slice(0, 2), 27, C.paper, { "font-weight": 600 });
+    return d;
+  }
+  function floor(svg, x0, x1, y) {
+    el("rect", { x: x0, y: (y || GROUND) - 2, width: x1 - x0, height: 4, rx: 2, fill: C.line }, svg);
+  }
+  function chip(parent, x, y, s, fill) {
+    const g = el("g", {}, parent);
+    const r = el("rect", { x, y, height: 30, rx: 15, fill: fill || C.y }, g);
+    const t = txt(g, x + 14, y + 20.5, s, 14, C.ink, { "font-weight": 700, "letter-spacing": "0.14em" });
+    const fit = (v) => r.setAttribute("width", Math.max(52, v.length * 10.6 + 28));
+    fit(s);
+    return { g, r, t, set(v) { t.textContent = v; fit(v); } };
+  }
+
+  /* The cast. Sprites come from the landing page (blog/scripts/build-mg-cast.mjs packs them into cast.png):
+     one row per character, 4 walk frames then the portrait, each cell 18 by 32.
+     Table: row, left and right shoulder edge, then sleeve, skin and outline colours for the arms. */
+  const CAST = {
+    /*CAST:START*/
+    michael: [0,2,15,"#221E2A","#F7C9AA","#26222E"],
+    jim: [1,2,15,"#221E2A","#F7C9AA","#26222E"],
+    pam: [2,2,15,"#784C2A","#F7C9AA","#26222E"],
+    dwight: [3,2,15,"#CE8646","#F7C9AA","#26222E"],
+    ke
```

**File**: `docs/blog/assets/mg/demo.html` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+<!doctype html>
+<html lang="en">
+<head>
+<meta charset="utf-8">
+<meta name="viewport" content="width=device-width, initial-scale=1">
+<meta name="robots" content="noindex">
+<title>Blog scene kit: every scene</title>
+<link rel="stylesheet" href="kit.css">
+<style>
+  body { margin: 0; background: #FCFAF0; color: #1A1320; font: 16px/1.6 system-ui, sans-serif; }
+  .prose { max-width: 760px; margin: 0 auto; padding: 32px 16px 80px; }
+  h1 { font-size: 28px; } h2 { font-size: 18px; margin: 48px 0 0; font-family: ui-monospace, monospace; }
+</style>
+</head>
+<body>
+<main class="prose">
+<h1>Blog scene kit: every scene</h1>
+<p>Test page for blog/src/assets/mg. The data here is sample data, not facts. Add ?mgstill to freeze each scene on its still frame. Real posts ship a still image in each figure; this page uses an empty one.</p>
+
+<h2>stage</h2>
+<figure class="mg" data-scene="stage"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. Michael walks in and opens, Jim explains, Dwight gives the rule, Kevin carries the number."><script type="application/json">{"kicker":"The cast","title":"Everyone has one job","script":[{"who":"michael","say":"Welcome to the blog. I open and I close."},{"who":"jim","say":"I explain how it works."},{"who":"dwight","say":"Rule one: no red. Ever.","point":"up-left"},{"who":"kevin","say":"I do the numbers.","carry":"$0"}]}</script><figcaption>stage: cast members walk in, stop, point and speak.</figcaption></figure>
+
+<h2>price-ladder</h2>
+<figure class="mg" data-scene="price-ladder"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. Four price steps rise from Free to Team while Kevin points at them."><script type="application/json">{"kicker":"Sample prices","title":"What each plan costs a month","prefix":"$","items":[{"label":"Free","value":0,"display":"Free","note":"Free covers one agent."},{"label":"Solo","value":12,"note":"Solo adds five agents."},{"label":"Pro","value":20,"highlight":true,"note":"Pro is the one most people pick."},{"label":"Team","value":45,"note":"Team is per seat."}],"host":"kevin","say":"Pro is the sweet spot."}</script><figcaption>price-ladder: tap a step for its note.</figcaption></figure>
+
+<h2>compare</h2>
+<figure class="mg" data-scene="compare"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. A table compares Tool A and Tool B on four rows and Oscar gives the verdict."><script type="application/json">{"kicker":"Sample compare","title":"Tool A against Tool B","cols":["Tool A","Tool B"],"pick":1,"rows":[{"label":"Price","a":"$20 a month","b":"Free","win":"b","note":"Checked on both pricing pages."},{"label":"Open source","a":"No","b":"Yes","win":"b"},{"label":"Runs offline","a":"Yes","b":"Yes","win":"","note":"A tie. Both run on your machine."},{"label":"Setup time","a":"2 minutes","b":"10 minutes","win":"a"}],"host":"oscar","say":"Tool B wins three of four."}</script><figcaption>compare: tap a row and Oscar checks it.</figcaption></figure>
+
+<h2>timeline</h2>
+<figure class="mg" data-scene="timeline"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. Jim walks along a timeline of four dates and says what happened at each."><script type="application/json">{"kicker":"Sample timeline","title":"How the release went","events":[{"when":"May","label":"First build","note":"One agent, one desk."},{"when":"July","label":"Open source","note":"The repo went public."},{"when":"Sept","label":"Pro","note":"The paid plan shipped."},{"when":"Oct","label":"Halloween","note":"Everyone got a costume."}],"host":"jim"}</script><figcaption>timeline: tap a date and Jim walks to it.</figcaption></figure>
+
+<h2>flow</h2>
+<figure class="mg" data-scene="flow"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. A four step flow draws itself from Prompt to Review while Pam points at each step."><script type="application/json">{"kicker":"Sample flow","title":"From a prompt to a merged change","nodes":[{"label":"Prompt","note":"You say what you want."},{"label":"Plan","note":"The agent writes a plan first."},{"label":"Code","note":"It edits files in a worktree."},{"label":"Review","note":"You read the diff and merge."}],"labels":["","ok",""],"host":"pam","say":"Four steps. That is all."}</script><figcaption>flow: tap a step, or use the arrow keys.</figcaption></figure>
+
+<h2>flow, six steps</h2>
+<figure class="mg" data-scene="flow"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="1600" height="900" alt="Animation. A six step flow in two rows."><script type="application/json">{"title":"Six steps wrap onto two rows","nodes":[{"label"
```

**File**: `docs/blog/assets/mg/kit.css` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+/* Munder Difflin blog scene kit. One stylesheet for every post. Pairs with kit.js. */
+.prose figure.mg { margin: 42px 0; }
+.prose figure.mg img, .mg .mg-svg { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; border: 1px solid #1A1320; border-radius: 16px; background: #1A1320; }
+.mg figcaption { font: 500 13px/1.5 "Space Grotesk", system-ui, sans-serif; color: #6B5878; padding-top: 10px; text-align: center; }
+.mg .mg-svg { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
+.mg .mg-svg text { -webkit-user-select: none; user-select: none; }
+.mg .mg-svg image { image-rendering: pixelated; }
+.mg .mg-hit { cursor: pointer; outline: none; }
+.mg .mg-ring { stroke-opacity: 0; transition: stroke-opacity 0.15s; }
+.mg .mg-hit:focus-visible > .mg-ring { stroke-opacity: 1; }
+@media (hover: hover) { .mg .mg-hit:hover > .mg-ring { stroke-opacity: 0.45; } }
+@media (prefers-reduced-motion: reduce) { .mg .mg-ring { transition: none; } }
```

**File**: `docs/blog/assets/mg/kit.js` (added, +569/-0)
```diff
@@ -0,0 +1,569 @@
+/* Munder Difflin blog scene kit. One script for every post. No dependencies.
+   A post ships <figure class="mg" data-scene="NAME"> holding a still <img> and, for kit scenes, a
+   <script type="application/json"> with the page's own data. This script swaps the still for a live SVG
+   scene (viewBox 960 by 540) that plays only while on screen. Reduced motion keeps one drawn frame.
+   "?mgstill=<seconds>" freezes every scene on that frame, "?mgstill" alone on each scene's still frame.
+   Custom scenes register with (window.MGQ = window.MGQ || []).push((MG) => MG.scene("name", {...})).
+   Guide: blog/MG_KIT.md. */
+(() => {
+  const NS = "http://www.w3.org/2000/svg";
+  const C = { ink: "#1A1320", ink2: "#251B2E", ink3: "#3D2E4A", faint: "#8E7B9C", soft: "#D9CFE0", line: "#4A3A58", paper: "#FCFAF0", y: "#FFCA54", sky: "#4ECDC4", lilac: "#B197FC", blue: "#6C8EF5", mint: "#6BCF7F" };
+  const W = 960, H = 540, GROUND = 500, GROT = '"Space Grotesk", system-ui, sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace';
+  const BASE = (document.currentScript && document.currentScript.src ? document.currentScript.src : "/blog/assets/mg/kit.js").replace(/[^/]*$/, "");
+  const clamp = (v) => Math.max(0, Math.min(1, v));
+  const p = (t, a, b) => clamp((t - a) / (b - a));
+  const io = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
+  const out = (t) => 1 - Math.pow(1 - t, 3);
+  const back = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
+  const hopY = (k) => Math.sin(clamp(k) * Math.PI);
+  const lerp = (a, b, k) => a + (b - a) * k;
+  const el = (tag, attrs, parent, text) => {
+    const n = document.createElementNS(NS, tag);
+    for (const k in attrs) n.setAttribute(k, attrs[k]);
+    if (text != null) n.textContent = text;
+    if (parent) parent.appendChild(n);
+    return n;
+  };
+  const set = (n, attrs) => { for (const k in attrs) n.setAttribute(k, attrs[k]); };
+  const txt = (parent, x, y, s, size, fill, extra) => el("text", Object.assign({ x, y, "font-size": size, fill, "font-family": GROT, "font-weight": 500 }, extra || {}), parent, s);
+  const wrap = (s, n) => {
+    const o = []; let l = "";
+    String(s == null ? "" : s).split(/\s+/).forEach((w) => { if (l && (l + " " + w).length > n) { o.push(l); l = w; } else l = l ? l + " " + w : w; });
+    if (l) o.push(l);
+    return o.length ? o : [""];
+  };
+  const lines = (parent, x, y, arr, size, fill, extra, lh) => {
+    const t = txt(parent, x, y, null, size, fill, extra);
+    arr.forEach((s, i) => el("tspan", { x, dy: i ? lh || size * 1.28 : 0 }, t, s));
+    return t;
+  };
+  const num = (v, d) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
+  const decimals = (v) => (String(v).split(".")[1] || "").length;
+
+  // Stage: deep ink panel, a soft glow, a fine grid, a kicker chip and a title.
+  let uid = 0;
+  function stage(svg, data, glow) {
+    const id = "mg" + ++uid, d = el("defs", {}, svg), gl = glow || [0.5, 0.35];
+    const g = el("radialGradient", { id: id + "g", cx: gl[0], cy: gl[1], r: 0.75 }, d);
+    el("stop", { offset: 0, "stop-color": "#3A2A4A" }, g);
+    el("stop", { offset: 1, "stop-color": C.ink }, g);
+    const pt = el("pattern", { id: id + "p", width: 48, height: 48, patternUnits: "userSpaceOnUse" }, d);
+    el("path", { d: "M48 0H0V48", fill: "none", stroke: "#FFFFFF", "stroke-opacity": 0.035, "stroke-width": 1 }, pt);
+    el("rect", { width: W, height: H, fill: `url(#${id}g)` }, svg);
+    el("rect", { width: W, height: H, fill: `url(#${id}p)` }, svg);
+    if (data && data.kicker) chip(svg, 60, 36, String(data.kicker).toUpperCase());
+    if (data && data.title) lines(svg, 60, data.kicker ? 104 : 70, wrap(data.title, 52).slice(0, 2), 27, C.paper, { "font-weight": 600 });
+    return d;
+  }
+  function floor(svg, x0, x1, y) {
+    el("rect", { x: x0, y: (y || GROUND) - 2, width: x1 - x0, height: 4, rx: 2, fill: C.line }, svg);
+  }
+  function chip(parent, x, y, s, fill) {
+    const g = el("g", {}, parent);
+    const r = el("rect", { x, y, height: 30, rx: 15, fill: fill || C.y }, g);
+    const t = txt(g, x + 14, y + 20.5, s, 14, C.ink, { "font-weight": 700, "letter-spacing": "0.14em" });
+    const fit = (v) => r.setAttribute("width", Math.max(52, v.length * 10.6 + 28));
+    fit(s);
+    return { g, r, t, set(v) { t.textContent = v; fit(v); } };
+  }
+
+  /* The cast. Sprites come from the landing page (blog/scripts/build-mg-cast.mjs packs them into cast.png):
+     one row per character, 4 walk frames then the portrait, each cell 18 by 32.
+     Table: row, left and right shoulder edge, then sleeve, skin and outline colours for the arms. */
+  const CAST = {
+    /*CAST:START*/
+    michael: [0,2,15,"#221E2A","#F7C9AA","#26222E"],
+    jim: [1,2,15,"#221E2A","#F7C9AA","#26222E"],
+    pam: [2,2,15,"#784C2A","#F7C9AA","#26222E"],
+    dwight: [3,2,15,"#CE8646","#F7C9AA","#26222E"],
+    ke
```

---

### Incident Patch 4: `6f5e558e` (2026-10-03)
**Commit Message**: seo-engine: day 06 PM, What is Gemini Spark + What is Claude Cowork, ChatGPT Dots title fix

New pages: what-is-gemini-spark, what-is-claude-cowork (both passed the
gate and a second independent fact review). Fix: what-is-chatgpt-dots
search title and description now lead with the name. chatgpt-dots-alternatives
links to both new pages.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `blog/media-src/spec.js` (modified, +2/-0)
```diff
@@ -156,4 +156,6 @@ const SPEC = {
   "what-is-hermes-agent": { a: "night", blue: "always on, remembers", orange: "you sleep, it works" },
   "what-is-pi-agent": { a: "terminal", blue: "small core, your extensions", orange: "pi 1.0, MIT" },
   "what-is-codex": { a: "stack", blue: "CLI, app, cloud", orange: "one agent, three places" },
+  "what-is-gemini-spark": { a: "spotlight", blue: "works from your google apps", orange: "an agent inside gemini" },
+  "what-is-claude-cowork": { a: "kanban", blue: "hand over the whole task", orange: "claude, beyond chat" },
 };
```

**File**: `blog/src/_data/media.json` (modified, +50/-0)
```diff
@@ -4345,5 +4345,55 @@
       }
     },
     "youtube": []
+  },
+  "what-is-gemini-spark": {
+    "title": "Gemini Spark: what it is, what it costs and who can get it",
+    "category": "concepts",
+    "hero": {
+      "file": "assets/media/what-is-gemini-spark/hero.png",
+      "alt": "Hand drawn sketch: a yellow character pointing at a board with four lines on it, labelled works from your google apps, and an agent inside gemini",
+      "prompt": "Code drawn hero (media-src/spec.js, spotlight archetype).",
+      "status": "ready"
+    },
+    "inline": {
+      "note-1": {
+        "file": "assets/media/what-is-gemini-spark/note-1.png",
+        "alt": "Hand drawn sketch: a yellow character pointing at a board with a short list",
+        "prompt": "",
+        "status": "ready"
+      },
+      "note-2": {
+        "file": "assets/media/what-is-gemini-spark/note-2.png",
+        "alt": "Hand drawn sketch: two yellow characters talking, one waiting and one with an answer",
+        "prompt": "",
+        "status": "ready"
+      }
+    },
+    "youtube": []
+  },
+  "what-is-claude-cowork": {
+    "title": "What Is Claude Cowork? Plans, Prices and How to Use It",
+    "category": "concepts",
+    "hero": {
+      "file": "assets/media/what-is-claude-cowork/hero.png",
+      "alt": "Hand drawn sketch: a yellow character handing a card to a board with todo, doing and done columns, labelled hand over the whole task, and claude, beyond chat",
+      "prompt": "Code drawn hero (media-src/spec.js, kanban archetype).",
+      "status": "ready"
+    },
+    "inline": {
+      "note-1": {
+        "file": "assets/media/what-is-claude-cowork/note-1.png",
+        "alt": "Hand drawn sketch: a board with todo, doing and done columns and one finished card",
+        "prompt": "",
+        "status": "ready"
+      },
+      "note-2": {
+        "file": "assets/media/what-is-claude-cowork/note-2.png",
+        "alt": "Hand drawn sketch: a yellow character sending an envelope to a box",
+        "prompt": "",
+        "status": "ready"
+      }
+    },
+    "youtube": []
   }
 }
```

**File**: `blog/src/posts/chatgpt-dots-alternatives.md` (modified, +2/-2)
```diff
@@ -59,9 +59,9 @@ This settles who holds your files and whether work stops when you close the lid.
 
 ### Runs in the cloud
 
-**4. Claude Cowork.** Cowork is Anthropic's agent for longer pieces of work, and it now runs in the cloud. Anthropic's [Cowork help page](https://support.claude.com/en/articles/13345190-get-started-with-cowork) says "Claude's work runs on Anthropic's servers, in an isolated environment" and that scheduled tasks don't need your computer to be awake. Since 16 Sep 2026 Anthropic has been [folding Cowork into the main Claude app](https://claude.com/blog/cowork-is-now-claude), Pro and Max first. Claude Pro was $20 a month, billed monthly, on 30 Sep 2026. Best for: reports, files and research, task by task.
+**4. Claude Cowork.** [Cowork](/blog/what-is-claude-cowork/) is Anthropic's agent for longer pieces of work, and it now runs in the cloud. Anthropic's [Cowork help page](https://support.claude.com/en/articles/13345190-get-started-with-cowork) says "Claude's work runs on Anthropic's servers, in an isolated environment" and that scheduled tasks don't need your computer to be awake. Since 16 Sep 2026 Anthropic has been [folding Cowork into the main Claude app](https://claude.com/blog/cowork-is-now-claude), Pro and Max first. Claude Pro was $20 a month, billed monthly, on 30 Sep 2026. Best for: reports, files and research, task by task.
 
-**5. Gemini Spark.** Spark is Google's personal agent in the Gemini app. It works from your Connected Apps and chats, and can drive your local Chrome. If your device goes off before a task is done, Google's [Spark help page](https://support.google.com/gemini/answer/17094507) says it "might use a remote browser" in the cloud instead. You need Google AI Pro or Ultra and to be 18 or over. Like dots on Pro, it is not available in the EEA, Switzerland or the UK, nor in Nigeria. Best for: Google app users outside Europe.
+**5. Gemini Spark.** [Spark](/blog/what-is-gemini-spark/) is Google's personal agent in the Gemini app. It works from your Connected Apps and chats, and can drive your local Chrome. If your device goes off before a task is done, Google's [Spark help page](https://support.google.com/gemini/answer/17094507) says it "might use a remote browser" in the cloud instead. You need Google AI Pro or Ultra and to be 18 or over. Like dots on Pro, it is not available in the EEA, Switzerland or the UK, nor in Nigeria. Best for: Google app users outside Europe.
 
 **6. Grok Bot.** SpaceXAI's docs say your Bots run on "a persistent cloud computer with a browser, filesystem, and terminal", and closing your laptop or phone does not stop a routine. It comes with paid Cursor plans or a SuperGrok account. Cursor's Individual plan was $20 a month on 30 Sep 2026. [Grok Bot pricing](/blog/grok-bot-pricing/) has the other plans. Best for: hosted work agents whose computer never sleeps.
 
```

**File**: `blog/src/posts/what-is-chatgpt-dots.md` (modified, +3/-2)
```diff
@@ -1,8 +1,9 @@
 ---
 title: "What Is ChatGPT Dots? OpenAI's Always On Agents Explained"
-seoTitle: "What Is ChatGPT Dots? Plans, Markets and Limits (Sep 2026)"
-description: "ChatGPT dots are OpenAI's always on agents, launched 29 Sep 2026. What a dot does, who can get one, what it costs and what it cannot do yet."
+seoTitle: "ChatGPT Dots: What They Do, Price and Who Can Get One"
+description: "A ChatGPT dot is an always on agent with its own cloud computer. Needs Pro (from $100 a month) or Business Premium, not Plus. Not on Pro in the UK or EU."
 date: 2026-09-30
+updated: 2026-10-03
 category: concepts
 categoryLabel: Concepts
 type: Non-technical
```

**File**: `blog/src/posts/what-is-claude-cowork.md` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+---
+title: "What Is Claude Cowork? Plans, Prices and How to Use It"
+seoTitle: "Claude Cowork: What It Is, Price and How to Use It (Oct 2026)"
+description: "Claude Cowork is Anthropic's agent for multi-step office work. Which plans include it, what it costs, where it runs and how to start, checked 3 Oct 2026."
+date: 2026-10-03
+category: concepts
+categoryLabel: Concepts
+type: Non-technical
+primaryKeyword: "what is claude cowork"
+secondaryKeywords: ["how to use claude cowork", "claude cowork pricing", "claude cowork vs claude code", "is claude cowork free", "claude cowork plans"]
+tags: ["Concepts", "AI Agents", "Automation"]
+faq:
+  - q: "Is Claude Cowork free?"
+    a: "No. Anthropic's help page says Cowork is available to paid Claude plans only: Pro, Max, Team and Enterprise. The cheapest way in is Claude Pro, which claude.com/pricing listed at $20 a month billed monthly, or $17 a month billed annually, checked 3 Oct 2026."
+  - q: "What is the difference between Claude Cowork and Claude Code?"
+    a: "Same engine, different job. Anthropic says Cowork uses the same agentic architecture that powers Claude Code, with no terminal required. Its product page puts Claude Code on software engineering and Cowork on non-coding knowledge work such as research, analysis and documents."
+  - q: "Does Claude Cowork work on Windows?"
+    a: "Yes. The help page lists Claude Desktop for Windows and for macOS as available on all paid plans, checked 3 Oct 2026. Cowork also runs on the web at claude.ai and in the Claude mobile apps on Pro, Max and Team."
+  - q: "Does Claude Cowork need my computer to stay on?"
+    a: "Not for cloud tasks. Anthropic says the work runs on its servers in an isolated environment, and that scheduled tasks don't need your computer to be awake. You do need the Claude Desktop app open and connected when a task has to touch local files, your browser or your screen."
+  - q: "Is Claude Cowork being discontinued?"
+    a: "The separate mode is being folded into the main app, not removed. On 16 Sep 2026 Anthropic said Cowork and chat are merging into one Claude, rolling out to Pro and Max first. Everything Cowork did stays available from a normal conversation."
+---
+
+Claude Cowork is Anthropic's agent for office work: you describe an outcome, Claude plans it, runs the steps in the background and hands back finished files. It comes with every paid Claude plan, from $20 a month (checked 3 Oct 2026), and not with the free one. Since 16 Sep 2026 it is being merged into normal Claude chat.
+
+Cowork is built for documents, spreadsheets and research. If your work is a codebase and you want several coding agents at once, that is a different tool: [Munder Difflin](https://harnessmd.com/download), free and open source, is a desktop app that runs a team of coding agents such as Claude Code, Codex and Gemini CLI on your own computer. The [install guide](/blog/how-to-install-and-use-munder-difflin/) covers setup, and the [concepts hub](/blog/topics/concepts/) has more.
+
+## What is Claude Cowork?
+
+Claude Cowork is a mode of Claude that does a multi-step task for you, where chat only answers a message. Anthropic's [help page](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork) says it "uses the same agentic architecture that powers Claude Code, with no terminal required".
+
+The help page and the [product page](https://claude.com/product/cowork) list what it works with:
+
+* **Your files.** On desktop, Claude reads and writes local files with no upload step, but only in folders you have connected.
+* **A browser.** Claude can open sites, read pages, click, type and fill forms.
+* **Your apps.** Connectors link outside tools. Plugins bundle skills, connectors and sub-agents for a role or team, and one you add also works in chat and Claude Code.
+* **Office formats.** Word documents, PDFs, spreadsheets with working formulas, and presentations.
+* **Schedules.** Tasks can repeat on a timer.
+* **Sub-agents.** Claude breaks large work into smaller tasks that run side by side.
+
+## When did Claude Cowork launch?
+
+Cowork became generally available on 9 Apr 2026, after a research preview that started in January. These are the dates we could confirm on 3 Oct 2026:
+
+| Date | What happened | Source |
+| --- | --- | --- |
+| 12 Jan 2026 | Research preview in the macOS desktop app, Max plans first | [Simon Willison's launch day notes](https://simonwillison.net/2026/Jan/12/claude-cowork/) |
+| 25 Feb 2026 | Scheduled tasks added | [Anthropic release notes](https://support.claude.com/en/articles/12138966-release-notes) |
+| 9 Apr 2026 | Generally available on macOS and Windows | Anthropic release notes |
+| 7 Jul 2026 | Web and mobile, in beta | [Anthropic blog](https://claude.com/blog/cowork-web-mobile) |
+| 12 Aug 2026 | The Chrome side panel becomes Cowork | [Anthropic blog](https://claude.com/blog/cowork-chrome-side-panel) |
+| 16 Sep 2026 | Cowork and chat
```

**File**: `blog/src/posts/what-is-gemini-spark.md` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+---
+title: "Gemini Spark: what it is, what it costs and who can get it"
+description: "Gemini Spark is Google's personal AI agent in the Gemini app. Plans, US prices, countries, limits and how it compares with Grok Bot, checked 3 Oct 2026."
+date: 2026-10-03
+category: concepts
+categoryLabel: Concepts
+type: Non-technical
+primaryKeyword: "gemini spark"
+secondaryKeywords: ["what is gemini spark", "gemini spark pricing", "how to use gemini spark", "gemini spark vs grok bot", "gemini spark availability", "is gemini spark free"]
+tags: ["Concepts", "AI Agents", "Pricing"]
+faq:
+  - q: "Is Gemini Spark free?"
+    a: "No. Google's help page says you need a Google AI Pro or Ultra subscription, so the Free and Google AI Plus plans do not include it. In the US, Google AI Pro was listed at $19.99 a month when we checked on 3 Oct 2026. Spark is not sold on its own."
+  - q: "Is Gemini Spark available in the UK or Europe?"
+    a: "No. Google's help page says Spark is available wherever Gemini Apps are supported, except in the European Economic Area, Nigeria, Switzerland and the United Kingdom. That was still the wording on 3 Oct 2026."
+  - q: "Does Gemini Spark work when my laptop is off?"
+    a: "Yes, with one catch. Spark runs in Google's cloud, so tasks and schedules keep going with your devices off. A task that uses your own Chrome needs the device and Chrome awake; if the device goes off, Spark might finish it in a remote browser. One line on Google's help page also says schedules will not run if your device is off, so test any schedule you rely on."
+  - q: "Can I use Gemini Spark with a work Google account?"
+    a: "Not through the Gemini app. The help page says you must sign in with a personal Google Account, and that Spark is not available for now with a work or school account. Google's product page separately mentions select business users."
+  - q: "How many tasks can Gemini Spark run at once?"
+    a: "Up to 15. Google's help page says you can have up to 15 tasks running at a given time, and you wait for one to finish before adding another. Your plan's compute based usage limits apply on top of that."
+---
+
+Gemini Spark is Google's personal AI agent inside the Gemini app: you hand it a task or a schedule and it works through your Gmail, Calendar, Drive and the web in Google's cloud, with your laptop shut. Verdict: worth it if your day already runs on Google apps and you live outside Europe. Checked 3 Oct 2026.
+
+Our [Concepts hub](/blog/topics/concepts/) explains the ideas behind agents like this, and [Grok Bot alternatives](/blog/grok-bot-alternatives/) lines Spark up against the rest.
+
+## What is Gemini Spark?
+
+Gemini Spark is an agent, not a chat mode. Google's [help page](https://support.google.com/gemini/answer/17094507) calls it a personal AI agent that automates workflows and manages schedules for ongoing tasks in Gemini Apps. Google [announced it on 19 May 2026](https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/) at I/O, and said then that it runs on Gemini 3.5 and the Antigravity harness.
+
+It has three building blocks:
+
+* **Tasks.** One objective that Spark works on in its own thread, such as tracking internship listings.
+* **Schedules.** A task that runs at a set time or when something happens.
+* **Skills.** Reusable instructions with extra context, such as how you write emails.
+
+Because it [runs in the cloud](https://support.google.com/gemini/answer/17094710), it keeps going after you close the laptop or lock the phone.
+
+{% img "note-1" %}
+
+## How much does Gemini Spark cost?
+
+Spark has no price of its own. It comes with Google AI Pro and Google AI Ultra, and the cheaper plans do not include it. These are the US prices on Google's [plans page](https://gemini.google/us/subscriptions/?hl=en), checked 3 Oct 2026:
+
+| Plan | US price (checked 3 Oct 2026) | Gemini Spark | Usage limits |
+| --- | --- | --- | --- |
+| Free | $0 | No | Base |
+| Google AI Plus | $4.99 a month | No | 2x Free |
+| Google AI Pro | $19.99 a month | Yes | 4x Free |
+| Google AI Ultra | $99.99 a month | Yes | 5x Pro |
+| Google AI Ultra | $199.99 a month | Yes | 20x Pro |
+
+Prices differ by country, so open the plans page from where you live. That page only names Spark on the Ultra card, with the words "in select countries". The Pro entitlement comes from the help page, which asks for a Google AI Pro or Ultra subscription.
+
+The dearer plans mainly buy more room. Google's [limits page](https://support.google.com/gemini/answer/16275805) says Gemini Apps use compute based limits, and the plans page says those limits count the complexity of your prompt, the features you use and the length of the chat. Google does not publish a separate Spark quota.
+
+## Who can get Gemini Spark?
+
+You need to be 18 or over, on a personal Google Account, with Google AI Pro or Ultra and Keep Activity switched on. The help page says work and school accounts are 
```

**File**: `docs/blog/agent-tools-today-2026-10-03/index.html` (modified, +1/-1)
```diff
@@ -242,7 +242,7 @@ <h2 id="how-this-list-is-built" tabindex="-1">How this list is built <a class="a
   </div>
 
   <footer class="post-foot wrap"><div class="prevnext">
-      <a class="pn prev" href="/blog/what-is-hermes-agent/"><span class="k">← Older</span><span class="t">Hermes Agent: what it is, how to install it and what it costs</span></a>
+      <a class="pn prev" href="/blog/what-is-claude-cowork/"><span class="k">← Older</span><span class="t">What Is Claude Cowork? Plans, Prices and How to Use It</span></a>
       <span></span>
     </div>
   </footer>
```

**File**: `docs/blog/agents-rule-of-two/index.html` (modified, +14/-14)
```diff
@@ -331,50 +331,50 @@ <h2 id="faq">FAQ</h2>
       <h2>Related in Concepts</h2>
       <div class="post-grid">
         <article class="card t-concepts">
-  <a class="thumb t-concepts" href="/blog/what-is-hermes-agent/" aria-hidden="true" tabindex="-1"><img src="/blog/assets/media/what-is-hermes-agent/hero.png" alt="" loading="lazy" decoding="async" /></a>
+  <a class="thumb t-concepts" href="/blog/what-is-claude-cowork/" aria-hidden="true" tabindex="-1"><img src="/blog/assets/media/what-is-claude-cowork/hero.png" alt="" loading="lazy" decoding="async" /></a>
   <div class="body">
     <div class="meta">
       <time datetime="2026-10-03">Oct 3, 2026</time>
       <span class="dot" aria-hidden="true"></span>
       <span>5 min</span>
     </div>
-    <h3><a href="/blog/what-is-hermes-agent/">Hermes Agent: what it is, how to install it and what it costs</a></h3>
-    <p class="dek">Hermes Agent is Nous Research&#39;s MIT licensed AI agent with memory, skills and chat channels. Install command, models, pricing and how it compares.</p>
+    <h3><a href="/blog/what-is-claude-cowork/">What Is Claude Cowork? Plans, Prices and How to Use It</a></h3>
+    <p class="dek">Claude Cowork is Anthropic&#39;s agent for multi-step office work. Which plans include it, what it costs, where it runs and how to start, checked 3 Oct 2026.</p>
     <div class="foot">
       <span class="tag kind">Concepts</span>
-      <a class="more" href="/blog/what-is-hermes-agent/" aria-label="Read: Hermes Agent: what it is, how to install it and what it costs">Read →</a>
+      <a class="more" href="/blog/what-is-claude-cowork/" aria-label="Read: What Is Claude Cowork? Plans, Prices and How to Use It">Read →</a>
     </div>
   </div>
 </article>
 <article class="card t-concepts">
-  <a class="thumb t-concepts" href="/blog/what-is-codex/" aria-hidden="true" tabindex="-1"><img src="/blog/assets/media/what-is-codex/hero.png" alt="" loading="lazy" decoding="async" /></a>
+  <a class="thumb t-concepts" href="/blog/what-is-gemini-spark/" aria-hidden="true" tabindex="-1"><img src="/blog/assets/media/what-is-gemini-spark/hero.png" alt="" loading="lazy" decoding="async" /></a>
   <div class="body">
     <div class="meta">
-      <time datetime="2026-10-02">Oct 2, 2026</time>
+      <time datetime="2026-10-03">Oct 3, 2026</time>
       <span class="dot" aria-hidden="true"></span>
       <span>5 min</span>
     </div>
-    <h3><a href="/blog/what-is-codex/">What Is Codex? OpenAI&#39;s Coding Agent in the CLI, App and Cloud</a></h3>
-    <p class="dek">What is Codex? OpenAI&#39;s coding agent runs in your terminal, the ChatGPT desktop app, your IDE and the cloud. Which plans include it, checked 2 Oct 2026.</p>
+    <h3><a href="/blog/what-is-gemini-spark/">Gemini Spark: what it is, what it costs and who can get it</a></h3>
+    <p class="dek">Gemini Spark is Google&#39;s personal AI agent in the Gemini app. Plans, US prices, countries, limits and how it compares with Grok Bot, checked 3 Oct 2026.</p>
     <div class="foot">
       <span class="tag kind">Concepts</span>
-      <a class="more" href="/blog/what-is-codex/" aria-label="Read: What Is Codex? OpenAI&#39;s Coding Agent in the CLI, App and Cloud">Read →</a>
+      <a class="more" href="/blog/what-is-gemini-spark/" aria-label="Read: Gemini Spark: what it is, what it costs and who can get it">Read →</a>
     </div>
   </div>
 </article>
 <article class="card t-concepts">
-  <a class="thumb t-concepts" href="/blog/what-is-pi-agent/" aria-hidden="true" tabindex="-1"><img src="/blog/assets/media/what-is-pi-agent/hero.png" alt="" loading="lazy" decoding="async" /></a>
+  <a class="thumb t-concepts" href="/blog/what-is-hermes-agent/" aria-hidden="true" tabindex="-1"><img src="/blog/assets/media/what-is-hermes-agent/hero.png" alt="" loading="lazy" decoding="async" /></a>
   <div class="body">
     <div class="meta">
-      <time datetime="2026-10-02">Oct 2, 2026</time>
+      <time datetime="2026-10-03">Oct 3, 2026</time>
       <span class="dot" aria-hidden="true"></span>
       <span>5 min</span>
     </div>
-    <h3><a href="/blog/what-is-pi-agent/">What is Pi agent? The open source coding agent harness, explained</a></h3>
-    <p class="dek">Pi agent is Earendil&#39;s MIT licensed coding agent harness. What it is, how to install it, what Pi 1.0 and Pi Durable add, and how it compares.</p>
+    <h3><a href="/blog/what-is-hermes-agent/">Hermes Agent: what it is, how to install it and what it costs</a></h3>
+    <p class="dek">Hermes Agent is Nous Research&#39;s MIT licensed AI agent with memory, skills and chat channels. Install command, models, pricing and how it compares.</p>
     <div class="foot">
       <span class="tag kind">Concepts</span>
-      <a class="more" href="/blog/what-is-pi-agent/" aria-label="Read: What is Pi agent? The open source coding agent harness, explained">Read →</a>
+      <a class="more" href="/blog/what-is-hermes-agent/" aria-label="Read: Hermes Agent: what it is, how to i
```

---

### Incident Patch 5: `f44b986a` (2026-10-02)
**Commit Message**: Merge pull request #573 from TTAWDTT/fix/bug-12-integrations-security

fix: add socket timeouts to postSlackReply and downloadSlackFile

**File**: `src/main/index.ts` (modified, +8/-0)
```diff
@@ -1468,6 +1468,8 @@ function slackFilesDir(): string {
 
 /** Per-file download size cap — reject files larger than 10 MB before writing. */
 const SLACK_FILE_MAX_BYTES = 10 * 1024 * 1024;
+/** Socket inactivity timeout for Slack file downloads (matches fetchText.ts's 12s). */
+const SLACK_DOWNLOAD_TIMEOUT_MS = 12_000;
 
 /** Sanitize a Slack filename: keep only the basename, replace non-safe chars,
  *  prefix with a random hex tag to prevent collisions and path-traversal attacks. */
@@ -1545,6 +1547,12 @@ function downloadSlackFile(
       }
     );
     req.on('error', () => resolve(null));
+    // Node has no default socket timeout: a peer that accepts the connection but
+    // never responds would leave this promise pending forever, and onMessage
+    // awaits the download — after the webhook already 200-acked Slack — so the
+    // inbound message would be silently dropped. Destroy with an error so the
+    // 'error' handler resolves null (a dropped attachment, not a dropped message).
+    req.setTimeout(SLACK_DOWNLOAD_TIMEOUT_MS, () => req.destroy(new Error('timed out')));
     req.end();
   });
 }
```

**File**: `src/main/slack.ts` (modified, +8/-0)
```diff
@@ -108,6 +108,8 @@ const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
 const REPLAY_WINDOW_SECONDS = 60 * 5;
 /** Cap how long we wait for the public tunnel before giving up (server stays up). */
 const TUNNEL_START_TIMEOUT_MS = 10_000;
+/** Socket inactivity timeout for Slack API calls (matches fetchText.ts's 12s). */
+const SLACK_API_TIMEOUT_MS = 12_000;
 
 export class SlackWebhookServer {
   private server: Server | null = null;
@@ -388,6 +390,12 @@ export function postSlackReply(opts: {
       });
     });
     req.on('error', (e) => resolve({ ok: false, error: errMsg(e) }));
+    // Node has no default socket timeout, so a peer that accepts the connection
+    // but never responds (stalled middlebox, network partition after handshake)
+    // would leave this promise pending forever — wedging the done-summary poller
+    // (its finally never runs) and hanging the loopback /reply handler. Destroy
+    // with an error so the 'error' handler resolves the usual transient path.
+    req.setTimeout(SLACK_API_TIMEOUT_MS, () => req.destroy(new Error('timed out')));
     req.write(body);
     req.end();
   });
```

**File**: `test/repro/bug-12.repro.cjs` (added, +645/-0)
```diff
@@ -0,0 +1,645 @@
+'use strict';
+
+// Repro for: postSlackReply and downloadSlackFile have no socket timeout, so a
+// stalled Slack connection permanently wedges the done-summary poller and hangs
+// replies (src/main/slack.ts:353-394, src/main/index.ts:1468-1532).
+//
+// CLAIM
+//   postSlackReply issues a raw node:https POST to slack.com with NO timeout:
+//   no `timeout` request option, no req.setTimeout, no socket timeout. Node has
+//   no default timeout for an in-flight request, so if slack.com accepts the
+//   TCP/TLS connection but never responds (stalled middlebox, hung proxy,
+//   network partition after handshake), neither 'end' nor 'error' ever fires
+//   and the returned promise NEVER SETTLES.
+//
+//   Callers await it with no race:
+//     (a) pollSlackDoneTasks (src/main/index.ts:1585-1642) sets
+//         slackDonePolling = true (1605), awaits postSlackReply (1619), and
+//         resets the flag only in the finally (1640). A never-settling promise
+//         wedges the 5s done-summary poller for the PROCESS LIFETIME: every
+//         later tick returns at the `if (slackDonePolling) return` guard
+//         (1586). stopSlackDoneObserver/startSlackDoneObserver never touch the
+//         flag, so even Stop→Start in Settings keeps the wedge — only an app
+//         restart clears it.
+//     (b) the SlackReplyServer /reply handler (slack.ts:482) awaits
+//         postSlackReply directly, so an agent's direct reply never resolves.
+//     (c) downloadSlackFile (src/main/index.ts:1468-1532) has the same missing
+//         timeout and is awaited inside onMessage (index.ts:1675) — AFTER
+//         slack.ts already sent the unconditional 200 ack (slack.ts:277-278) —
+//         so an inbound message with an attachment is acknowledged and then
+//         silently dropped.
+//   The transient-error path the code designed for ("will retry",
+//   index.ts:1633-1637) never runs: a stall produces no error at all.
+//
+// CONTRAST: src/main/fetchText.ts:32 sets req.setTimeout — the omission is an
+// inconsistency, not a design choice.
+//
+// WHAT THIS REPRO DOES (deterministic, offline, no real Slack, no display)
+//   Everything real except the network peer:
+//     - the REAL postSlackReply / SlackWebhookServer / SlackReplyServer from
+//       src/main/slack.ts and the REAL pollSlackDoneTasks + downloadSlackFile +
+//       'slack:start'/'slack:stop' IPC handlers from src/main/index.ts, loaded
+//       through test/load-ts.cjs (the repo's own test loader);
+//     - electron → a stub; node-pty → a stub; better-sqlite3 → a stub (its
+//       Electron-ABI binding cannot load in plain Node); tunnelmole → a stub
+//       (no network). app.whenReady never resolves, so the whenReady-only boot
+//       block stays out; everything the bug needs registers at module load.
+//     - slack.com / files.slack.com → a LOCAL TLS server that completes the
+//       handshake, reads the request, then sends NOTHING (no response, no FIN,
+//       no RST) — exactly the stalled-connection scenario. A tiny https.request
+//       shim redirects the hostname while leaving the request untouched. The
+//       embedded self-signed cert (CN=slack.com, SAN slack.com /
+//       files.slack.com / 127.0.0.1, valid to 2036) needs no openssl at runtime.
+//     - a live floor window (mock) so liveWebContents() resolves and the real
+//       onMessage path can be observed forwarding to the renderer.
+//
+//   The poller is driven through the REAL public entry point: the 'slack:start'
+//   IPC handler → startSlackServer → startSlackDoneObserver's 5s timer, with a
+//   real HiveManager over a throwaway harnessHome. A RESPONDING-slack.com
+//   control proves the harness delivers the summary when Slack answers; the
+//   stall sections then show what a held connection does instead.
+//
+// CHECKS (all phrased as the DESIRED behavior, so the suite FAILS on the
+// current code and PASSES once the promise can settle — e.g. after adding a
+// request/socket timeout like fetchText.ts has):
+//   1. control: a done card is reported to a responding slack.com.
+//   2. postSlackReply SETTLES against a stalled connection.
+//   3. the 5s poller KEEPS POLLING after a stalled attempt (the finally ran).
+//   4. Stop→Start in Settings RE-ARMS the observer after a stall.
+//   5. the loopback /reply endpoint ANSWERS the in-flight request.
+//   6. an acked inbound file message is STILL FORWARDED when the download
+//      stalls.
+//
+// Run: node test/repro/bug-12.repro.cjs   (~2 min: real 5s poller cadence)
+
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+const http = require('node:http');
+const net = require('node:net');
+const tls = require('node:tls');
+const { createHmac } = require('node:crypto');
+
+const REPO = path.resolve(__dirname, '..', '..');
+const loadTs = require(path.join(REPO, 'test', 'load-ts.cjs'));
```

**File**: `test/slack-timeout.test.cjs` (added, +237/-0)
```diff
@@ -0,0 +1,237 @@
+'use strict';
+
+/**
+ * Slack API calls must be hard-capped by a socket timeout.
+ *
+ * The bug it prevents: postSlackReply (src/main/slack.ts) and downloadSlackFile
+ * (src/main/index.ts) issue raw `node:https` requests with NO timeout anywhere.
+ * Node has no default socket timeout, so a peer that accepts the TCP/TLS
+ * connection but never responds (stalled middlebox, network partition after
+ * handshake) leaves the promise pending FOREVER — and the callers await it bare:
+ *
+ *   - pollSlackDoneTasks (src/main/index.ts) sets slackDonePolling = true, awaits
+ *     postSlackReply, and resets the flag only in its finally — a never-settling
+ *     promise wedges the 5s done-summary poller for the process lifetime;
+ *   - the SlackReplyServer /reply handler awaits postSlackReply directly, so the
+ *     agent's direct reply never answers;
+ *   - onMessage awaits downloadSlackFiles AFTER the webhook already 200-acked
+ *     Slack, so an inbound attachment message is acknowledged and then silently
+ *     dropped.
+ *
+ * The transient-retry path the poller explicitly designed for ("will retry")
+ * never runs: a stall produces no error at all. fetchText.ts already arms
+ * req.setTimeout — this pins the same cap onto the Slack calls.
+ *
+ * postSlackReply is behaviorally tested here (slack.ts is deliberately free of
+ * any electron import). downloadSlackFile lives in index.ts, which imports
+ * electron and cannot load in a plain test — it is pinned by source checks, the
+ * same approach test/update-check-timeout.test.cjs uses for updater.ts. The full
+ * end-to-end stall scenario (poller wedge, /reply hang, acked-then-dropped
+ * message) lives in test/repro/bug-12.repro.cjs.
+ */
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const tls = require('node:tls');
+const https = require('node:https');
+const net = require('node:net');
+const loadTs = require('./load-ts.cjs');
+
+const { postSlackReply } = loadTs('src/main/slack.ts');
+
+// Generous on purpose: the fix's own timeout (12s, matching fetchText.ts) must
+// clear this deadline. On the buggy code nothing settles, so the deadline only
+// costs wall-clock, never flakes.
+const CONTROL_DEADLINE_MS = 5_000;   // a responding endpoint answers in ms
+const STALL_DEADLINE_MS = 25_000;    // > the 12s fix timeout
+
+// ─── embedded self-signed cert for the fake slack.com (valid to 2036) ───────
+const STALL_KEY = [
+  '-----BEGIN PRIVATE KEY-----',
+  'MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCuCqcv9CFD2zmU',
+  'Oh4xGMhKE0/AVGJ9Q9bP5crWH6tPKp7cUgc4y7D4swVFaoy56MhP+xgvDQxbXKp2',
+  'XC5kjvRrfJCmFA4APwRPxW/XsgDyuS7mpQe+Ik0tEietc3epBnIUa0P1UBNiPlup',
+  'aG+JbXQfNKxdzd/hF9uca+TTPJIlr1POAZreX8ufutlaJRhmbcBDiBgYU23mGgLV',
+  'npDT1aZhizTmvefJ38JjU3JuhsLP7we+7qH+2pu/0LLa/DRB0ENaoujmw3QpHvCh',
+  'zLtCgwNj2vMul6dMT3+ik7pnQfO/DFXgTJhEVs5hGclVVTg84W2AuwlT7IaLjCQ1',
+  'nwIQlHyHAgMBAAECggEAC4C5vxIgFreJDTJwJ2ePaVHwbfJF1iijLHdwGgnazS8w',
+  'c7haMNdJmY5fdVCO/4SSpLKgTQ/MNsefnpYGHPBT2DzR5KAjssF3e/w9IaDqriAu',
+  'KOFUay0iM63lAHJGwN2jsZTLV43U0iPz8/TqlkctKxjUoZiHSP3GLob1Bz8UG7ho',
+  'N3CADE2IO4Z1hgwN3AF0HSE4tFrL61ehPITHkoFiV9Ciwjc+Y0EZDWjfinHG9Znh',
+  'MHww/hG/wv4d8MT5ZZtvuS8massQ7YFx7cVwQ9LEU+M9HvdGMa4VsYJN0MtBhBWG',
+  'ndqkeiU9oPzb9butO1S0SuBWbDgRxhFG2XbPyMhc4QKBgQDs7dT9agUjpJ2dfjH9',
+  'YsboZ+LE+GCZRHBVR86VZY+Qx9/Nla5FEHt3A7lS5nWZYwLTGrog13sV2oRnVe6C',
+  'R+kQT9GhUxEwxWtxBAsNaG0vvjPhohMqgVN1VRPq6JzYJhsddFMEzyQkQvS5UnUs',
+  'OAZUK4KAZLyZKuIXpFUaXSDRYQKBgQC8DPXyTpVQEDtX5xXznooVQo1PP8Zep+Uo',
+  'zWAn6uwcU3y8/mCZYt4OSole5klI54oFKTiVeC5FhPgUJd/4VQxTTgYcWOQStvu5',
+  'lRsgs3XUMwzP3+MSFksgSHnK4QQQ9/I2mMJEPoQIGxoLCozkgkYgENUMdlqR2aSW',
+  'SlPKO6xO5wKBgEiuDJBQXZM5hEAz3hHkoy/X7nCN4NQjcnI2vOCHbyrypWzjZbo5',
+  '/CXeNpN/rsOG4+7uW/qHH3LsvYEVkzzT4mLmmV/ro3JanULmAp3yUsw6hJ/KoCaB',
+  '1aBAoQOGp9aGmfrHHFB1WpjlET1oVhlidk6LqlTIkjJKPWETQCf+OXsBAoGBAIfs',
+  '6l3B1YVwpiRsoV5dqzugxlmRJIbI3wh2ItnXoeD7q79EM3jLkOxNjivtUu2Chy4h',
+  '1Iedvfx8F4Egu1pZxzXzwND+o6SvZRaIo3oonbPLTqh3ET/Co3zrRjWSHglR3179',
+  'XfZMJc1iIZn3f02wqJWG9Sgz6FViNuh3Q0d7iJnjAoGBAKht+rTQO9Thd07XYdVi',
+  'So+K6RNAs9AoWH4eDzxytOtkRucdAvbpuqK5DN+G5UfCW0x4WlyvBtgNnpmOrm6P',
+  'ZqiW1NDsZoLpMliFUtEtV1VIQLCtR0/dz6HFZIVnWEtzJNwkoXAkQB/d39gzgHdZ',
+  'Ou3D4RctcHfhlHOnKfEp6/nC',
+  '-----END PRIVATE KEY-----',
+].join('\n');
+
+const STALL_CERT = [
+  '-----BEGIN CERTIFICATE-----',
+  'MIIDNzCCAh+gAwIBAgIUDTCZioH/P1HpflLN1Nw8ifKUSvUwDQYJKoZIhvcNAQEL',
+  'BQAwFDESMBAGA1UEAwwJc2xhY2suY29tMB4XDTI2MDkxOTE5NTcyNFoXDTM2MDkx',
+  'NjE5NTcyNFowFDESMBAGA1UEAwwJc2xhY2suY29tMIIBIjANBgkqhkiG9w0BAQEF',
+  'AAOCAQ8AMIIBCgKCAQEArgqnL/QhQ9s5lDoeMRjIShNPwFRifUPWz+XK1h+rTyqe',
+  '3FIHOMuw+LMFRWqMuejIT/sYLw0MW1yqdlwuZI70a3yQphQOAD8ET8Vv17IA8rku',
+  '5qUHviJNLRInrXN3qQZyFGtD9VATYj5bqWhviW10HzSsXc3f4RfbnGvk0zySJa9T',
+  'zgGa3l/Ln7rZWiUYZm3AQ4gYGFNt5hoC1Z6Q09WmYYs05r3nyd/CY1NybobCz+8H',
+  'vu6h/tq
```

---

### Incident Patch 6: `c342c320` (2026-10-02)
**Commit Message**: Merge pull request #572 from TTAWDTT/fix/bug-11-integrations-security

fix: getStatus consumes the second path of porcelain -z rename records

**File**: `src/main/git.ts` (modified, +14/-3)
```diff
@@ -34,6 +34,7 @@ export interface GitStatusEntry {
   path: string;
   index: string;   // staged status char
   worktree: string; // unstaged status char
+  oldPath?: string; // rename/copy source, when the record carries one
 }
 export interface GitStatus {
   staged: GitStatusEntry[];
@@ -69,13 +70,23 @@ export async function getStatus(cwd: string): Promise<GitStatus | { error: strin
   const entries: GitStatusEntry[] = [];
   const untracked: string[] = [];
   const tokens = res.stdout.split('\0').filter(Boolean);
-  for (const token of tokens) {
+  for (let i = 0; i < tokens.length; i++) {
+    const token = tokens[i];
     if (token.length < 3) continue;
     const index = token[0];
     const worktree = token[1];
     const path = token.slice(3);
-    if (index === '?' && worktree === '?') untracked.push(path);
-    else entries.push({ path, index, worktree });
+    if (index === '?' && worktree === '?') { untracked.push(path); continue; }
+    const entry: GitStatusEntry = { path, index, worktree };
+    // Rename/copy records carry a SECOND null-terminated path — the source
+    // ("R  <new>\0<old>\0"). Consume it (as parseNameStatusZ does) and keep it
+    // on the entry, or the old path is parsed as another status record whose
+    // status letters come from the filename.
+    if (index === 'R' || index === 'C' || worktree === 'R' || worktree === 'C') {
+      const oldPath = tokens[i + 1];
+      if (oldPath !== undefined) { entry.oldPath = oldPath; i += 1; }
+    }
+    entries.push(entry);
   }
   return {
     staged: entries.filter(e => e.index !== ' ' && e.index !== '?'),
```

**File**: `test/git-status-rename.test.cjs` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+'use strict';
+
+/**
+ * getStatus() parses `git status --porcelain=v1 -z` by splitting on NUL and
+ * reading every token as one `XY <path>` record. That is wrong for rename and
+ * copy records, which porcelain -z emits with a SECOND null-terminated path —
+ * the source:
+ *
+ *     "R  <new>" \0 "<old>" \0
+ *
+ * When the old-path token was fed through the single-path parser its first two
+ * characters became the status letters and slice(3) became the path, so
+ * `git mv alpha.txt beta.txt` surfaced a phantom entry
+ * { path: "ha.txt", index: "a", worktree: "l" } in BOTH the staged and
+ * unstaged lists (both filters pass a letter), while the real old path was
+ * dropped. A 2-char old name ("ab") was silently skipped instead. The same
+ * file's parseNameStatusZ (commit files) has always consumed the second path
+ * of two-path records; getStatus now does too, and keeps it as oldPath.
+ *
+ * These tests run the parser against real git output in throwaway repos, so a
+ * change in porcelain's wire format fails loudly here rather than silently
+ * in the IDE panel's staged/unstaged lists.
+ */
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const { execFileSync } = require('node:child_process');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+const loadTs = require('./load-ts.cjs');
+
+const { getStatus } = loadTs('src/main/git.ts');
+
+const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
+
+function makeRepo() {
+  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-status-rename-'));
+  git(repo, 'init', '-q', '-b', 'main');
+  git(repo, 'config', 'user.email', 'test@example.com');
+  git(repo, 'config', 'user.name', 'Test');
+  git(repo, 'commit', '-q', '--allow-empty', '-m', 'base');
+  return repo;
+}
+
+function withRepo(fn) {
+  const repo = makeRepo();
+  return Promise.resolve(fn(repo)).finally(() => fs.rmSync(repo, { recursive: true, force: true }));
+}
+
+/** The paths git itself reports, from line-based porcelain — renames render as
+ *  one unambiguous "R  old -> new" line there, so this is the ground truth the
+ *  -z parser must not disagree with. */
+function groundTruthPaths(repo) {
+  const out = git(repo, 'status', '--porcelain=v1', '--untracked-files=all');
+  const paths = [];
+  for (const line of out.split('\n')) {
+    if (!line) continue;
+    const rest = line.slice(3);
+    if (rest.includes(' -> ')) paths.push(...rest.split(' -> '));
+    else paths.push(rest);
+  }
+  return paths;
+}
+
+function allReportedPaths(status) {
+  return [
+    ...status.staged.map((e) => e.path),
+    ...status.unstaged.map((e) => e.path),
+    ...status.untracked
+  ];
+}
+
+/** Shared shape checks: no phantom paths, no worktree leak for a purely staged
+ *  rename, the old path survives, the new path is staged. */
+function assertRenameParsed(status, oldPath, newPath) {
+  const real = new Set(groundTruthPaths(status.cwd));
+  const reported = allReportedPaths(status);
+  assert.deepEqual(
+    reported.filter((p) => !real.has(p)), [],
+    `phantom status entries from a misparsed rename record; ` +
+    `expected only ${JSON.stringify([...real])}, got ${JSON.stringify(reported)}`
+  );
+  assert.deepEqual(status.unstaged, [], 'a staged rename must not leak into the unstaged list');
+  const staged = status.staged.find((e) => e.path === newPath);
+  assert.ok(staged, `staged rename target ${newPath} missing from staged list`);
+  assert.equal(staged.oldPath, oldPath, `rename source ${oldPath} must be kept as oldPath`);
+}
+
+async function getStatusFor(repo) {
+  const status = await getStatus(repo);
+  assert.ok(!('error' in status), `getStatus failed: ${JSON.stringify(status)}`);
+  return { ...status, cwd: repo };
+}
+
+test('a staged git mv parses as one rename entry carrying the old path', () =>
+  withRepo(async (repo) => {
+    fs.writeFileSync(path.join(repo, 'alpha.txt'), 'hello\n');
+    git(repo, 'add', '-A');
+    git(repo, 'commit', '-q', '-m', 'add alpha');
+    git(repo, 'mv', 'alpha.txt', 'beta.txt');
+    assertRenameParsed(await getStatusFor(repo), 'alpha.txt', 'beta.txt');
+  }));
+
+test('a rename staged from an editor (delete + add) parses the same way', () =>
+  withRepo(async (repo) => {
+    fs.writeFileSync(path.join(repo, 'old-name.txt'), 'content\n');
+    git(repo, 'add', '-A');
+    git(repo, 'commit', '-q', '-m', 'add old-name');
+    fs.rmSync(path.join(repo, 'old-name.txt'));
+    fs.writeFileSync(path.join(repo, 'new-name.txt'), 'content\n');
+    git(repo, 'add', '-A');
+    assertRenameParsed(await getStatusFor(repo), 'old-name.txt', 'new-name.txt');
+  }));
+
+test('a rename staged alongside an untracked file does not swallow the next record', () =>
+  withRepo(async (repo) => {
+    // The rename's old-path token sits directly before the untracked record in
+    // the -z stream; a parser that skips one token 
```

---

### Incident Patch 7: `a6bc3b84` (2026-10-02)
**Commit Message**: Merge pull request #563 from TTAWDTT/fix/bug-2-hive-routing

fix(hive): make the HOP_CAP loop guard real - harness owns hops and increments per bounce

**File**: `src/main/hive.ts` (modified, +28/-27)
```diff
@@ -1627,7 +1627,14 @@ export class HiveManager {
       act,
       subject: partial.subject ?? '',
       body: partial.body ?? '',
-      hops: typeof partial.hops === 'number' ? partial.hops : 0,
+      // hops is harness-owned (PROTOCOL.md: "The harness fills in `id`, `from`,
+      // `hops`, and timestamps"), so an agent-authored value is only a carried
+      // count, never authoritative. Clamp it into range: an echoed relay must
+      // keep climbing toward the cap, while a copied-forward `hops: 13` must
+      // not read as a runaway loop (only a harness bounce moves the counter —
+      // see bounceToGod). A negative value would just buy more free bounces,
+      // so the floor is 0.
+      hops: Math.max(0, Math.min(typeof partial.hops === 'number' ? partial.hops : 0, HOP_CAP)),
       requires_reply: partial.requires_reply ?? ['request', 'query', 'propose'].includes(act),
       needs_human: partial.needs_human ?? false,
       created_at: partial.created_at ?? new Date().toISOString()
@@ -1644,6 +1651,22 @@ export class HiveManager {
     return true;
   }
 
+  /** One harness bounce of `msg` to god: bump the hop counter, rewrite the
+   *  subject, and log the drop once the counter passes HOP_CAP. Agents can't
+   *  move hops past the cap themselves (normalize clamps what they wrote), so
+   *  this fuse can only fire on a REAL relay loop — a bounced mail that keeps
+   *  coming back undeliverable — and never on an agent-authored number. */
+  private bounceToGod(msg: HiveMessage, godId: string, subject: string): void {
+    const hops = msg.hops + 1;
+    if (hops > HOP_CAP) {
+      // loop guard — drop a runaway message rather than let agents ping-pong.
+      // There's no human queue to fall back on; the god agent owns conflicts.
+      this.appendLog({ kind: 'drop', reason: 'hop-cap', from: msg.from, to: msg.to, id: msg.id });
+      return;
+    }
+    this.deliver({ ...msg, hops, to: godId, subject }, godId);
+  }
+
   /** Inject a message directly (used by the orchestrator / UI / tests). */
   send(partial: Partial<HiveMessage>, from = 'system'): HiveMessage {
     const msg = this.normalize(partial, from);
@@ -1653,12 +1676,6 @@ export class HiveManager {
   }
 
   private routeMessage(msg: HiveMessage): void {
-    if (msg.hops > HOP_CAP) {
-      // loop guard — drop a runaway message rather than let agents ping-pong.
-      // There's no human queue to fall back on; the god agent owns conflicts.
-      this.appendLog({ kind: 'drop', reason: 'hop-cap', from: msg.from, to: msg.to, id: msg.id });
-      return;
-    }
     const reg = this.registry();
     const godId = reg.godId ?? 'god';
     // The hive has no separate human-approval queue — approvals are native to
@@ -1684,11 +1701,7 @@ export class HiveManager {
       // unread for hours). Bounce such mail to god instead, so the sender's intent
       // surfaces immediately and nothing is silently lost.
       if (reg.agents[t]?.isAssistant) {
-        this.deliver({
-          ...msg,
-          to: godId,
-          subject: `[bounced — "${t}" is the send-only prep assistant; route work to a real agent] ${msg.subject}`
-        }, godId);
+        this.bounceToGod(msg, godId, `[bounced — "${t}" is the send-only prep assistant; route work to a real agent] ${msg.subject}`);
         continue;
       }
       // An ARCHIVED recipient (its terminal is gone) still has an inbox, so the
@@ -1732,11 +1745,7 @@ export class HiveManager {
       // (the bounce target).
       if (t !== godId && !canReceiveInbox(reg.agents[t]?.provider)) {
         if (!this.emitTerminalHandoff(msg, t)) {
-          this.deliver({
-            ...msg,
-            to: godId,
-            subject: `[undeliverable — "${t}" runs ${reg.agents[t]?.provider ?? 'a hookless CLI'} and the terminal handoff failed (renderer unavailable); relay this to it] ${msg.subject}`
-          }, godId);
+          this.bounceToGod(msg, godId, `[undeliverable — "${t}" runs ${reg.agents[t]?.provider ?? 'a hookless CLI'} and the terminal handoff failed (renderer unavailable); relay this to it] ${msg.subject}`);
         } else delivered.push(t);
         continue;
       }
@@ -1748,11 +1757,7 @@ export class HiveManager {
       const proxyDesc = bridgeOf(reg.agents[t]?.provider);
       if (t !== godId && proxyDesc?.kind === 'proxy' && proxyDesc.inboxDelivery === 'terminal') {
         if (!this.emitTerminalHandoff(msg, t)) {
-          this.deliver({
-            ...msg,
-            to: godId,
-            subject: `[undeliverable — "${t}" runs ${reg.agents[t]?.provider ?? 'a proxy-tier CLI'} and the terminal handoff failed (renderer unavailable); relay this to it] ${msg.subject}`
-          }, godId);
+          this.bounceToGod(msg, godId, `[undeliverable — "${t}" runs ${reg.agents[t]?.provider ?? 'a proxy-tier CLI'} and the terminal handoff failed (renderer unavailable); relay this to it] ${msg.subject}`);
         } else delivered.push(t);
         continue;
  
```

**File**: `test/hive-hop-cap.test.cjs` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+'use strict';
+
+/**
+ * Regression for the inoperative HOP_CAP loop guard. routeMessage() checked
+ * `msg.hops > HOP_CAP` with a "loop guard — drop a runaway message" comment,
+ * but the harness never incremented hops and every bounce path spread `...msg`
+ * unchanged: normalize copied the agent-supplied value verbatim, so the guard
+ * compared a frozen 0 against 12 forever while a god↔hookless-worker relay
+ * loop delivered a duplicate bounce (plus a log line and a git commit) every
+ * router tick. Conversely an outbox JSON echoing `hops: 13` — a field
+ * PROTOCOL.md says the HARNESS fills in — had its first delivery dropped.
+ *
+ * The fix makes hops harness-owned end to end: normalize clamps the
+ * agent-carried value into [0, HOP_CAP] so a copied-forward count can neither
+ * fake a runaway loop nor read as one, and the four harness bounce paths now
+ * go through bounceToGod(), the only place the counter moves (+1 per bounce),
+ * where the cap fuse actually fires — and only on a real relay loop.
+ */
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+const loadTs = require('./load-ts.cjs');
+
+const { HiveManager } = loadTs('src/main/hive.ts');
+
+/** The cap constant from src/main/hive.ts (module-private, not exported). */
+const HOP_CAP = 12;
+/** Comfortably past the cap: a working fuse must fire long before this many. */
+const RELAYS = 30;
+
+async function floor(t) {
+  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-hop-cap-'));
+  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
+  const hive = new HiveManager(() => home);
+  // hopless-1 runs kimi — no hook bridge, canReceiveInbox:false, so every
+  // direct mail to it bounces to god (the hookless path). No PTY, no sidecar,
+  // no net: routing exercises the bounce ladder with nothing running but the
+  // router itself.
+  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
+  await hive.ensureAgent({ id: 'worker-1', name: 'Dwight', provider: 'claude', cwd: home });
+  await hive.ensureAgent({ id: 'hopless-1', name: 'Kimi', provider: 'kimi', cwd: home });
+  const outbox = (id) => path.join(home, 'hive', 'agents', id, 'outbox');
+  return { hive, outbox };
+}
+
+/** Write one agent-authored outbox message, exactly as an agent process would. */
+function writeOutbox(outbox, filename, partial) {
+  fs.writeFileSync(path.join(outbox, filename), JSON.stringify(partial), 'utf8');
+}
+
+const dropEntries = (hive, reason) =>
+  hive.logTail(5000).filter((e) => e.kind === 'drop' && e.reason === reason);
+
+test('a god↔hookless-worker relay loop is bounded and hops climbs to the cap', async (t) => {
+  const { hive, outbox } = await floor(t);
+
+  // The documented echo loop: god mails the hookless worker, the harness
+  // bounces to god, god's scripted relay re-sends to the worker, and so on.
+  // The god relays FAITHFULLY — it copies what it received (subject, body,
+  // conversation, in_reply_to and hops verbatim) into its own outbox, exactly
+  // the fields PROTOCOL.md's send schema describes, and lets the harness do
+  // the rest.
+  writeOutbox(outbox('god-1'), 'm-000.json', {
+    to: 'hopless-1', act: 'request', subject: 'PING — coordinate with me',
+    body: 'worker asks hookless peer to sync', conversation: 'conv-echo'
+  });
+
+  const hopsSeen = [];
+  for (let i = 1; i <= RELAYS; i++) {
+    hive.routeOnce();
+    const bounces = hive.inbox('god-1').filter((m) => m.subject.startsWith('[undeliverable'));
+    const bounce = bounces[bounces.length - 1] ?? null;
+    if (bounces.length < i) break; // post-fix: the fuse dropped the relay — loop is bounded
+    hopsSeen.push(bounce.hops);
+    writeOutbox(outbox('god-1'), `relay-${String(i).padStart(3, '0')}.json`, {
+      to: 'hopless-1',
+      act: 'request',
+      subject: bounce.subject,
+      body: bounce.body,
+      conversation: bounce.conversation,
+      in_reply_to: bounce.id,
+      hops: bounce.hops // carry the counter the schema says exists
+    });
+  }
+  hive.routeOnce();
+
+  const bounces = hive.inbox('god-1').filter((m) => m.subject.startsWith('[undeliverable — "hopless-1"'));
+
+  assert.ok(
+    hopsSeen.length > 0 && hopsSeen[0] === 1,
+    `the harness must increment hops on its own bounce (first bounce read: ${hopsSeen[0]}) — ` +
+    'the counter is harness-owned, not a frozen agent-supplied 0'
+  );
+  assert.deepEqual(
+    hopsSeen, hopsSeen.map((_, i) => i + 1),
+    `each harness bounce must carry the next hop (seen: ${JSON.stringify(hopsSeen)})`
+  );
+  assert.ok(
+    bounces.length <= HOP_CAP,
+    `${bounces.length} relay passes were delivered — the HOP_CAP=${HOP_CAP} fuse ` +
+    `did not bound the ${RELAYS}-pass loop (each pass writes a duplicate bounce, ` +
+    'a log line, and a hive git commit)'
+  );
+ 
```

---

### Incident Patch 8: `1e7265d4` (2026-10-02)
**Commit Message**: Merge pull request #560 from HsienW/fix/pi-initial-prompt-bootstrap

fix(hive): seed Pi with positional bootstrap prompt

**File**: `src/main/hive.ts` (modified, +4/-4)
```diff
@@ -829,8 +829,7 @@ export class HiveManager {
 
     const claudeProvider = isClaudeProvider(meta.provider ?? 'claude');
 
-    // Non-hive-aware providers (Antigravity's `agy`, OpenAI's `codex`, xAI's
-    // `grok`) don't
+    // Non-hive-aware providers (for example Antigravity, Codex, Grok and Pi) don't
     // understand Claude Code's flags (no `--append-system-prompt`, no telemetry,
     // no `--settings`). Instead: (1) the hive identity+protocol rides in as the
     // session's INITIAL prompt — the closest thing to `--append-system-prompt`
@@ -841,7 +840,7 @@ export class HiveManager {
     //
     // How the prompt rides in differs by CLI:
     //  - agy takes it under a flag (`agy -i "<prompt>"`) → push [flag, prompt].
-    //  - codex/grok take it POSITIONALLY (`codex|grok "<prompt>"`) → push the
+    //  - codex/grok/pi take it POSITIONALLY (`codex|grok|pi "<prompt>"`) → push the
     //    bare prompt as a trailing arg (node-pty passes argv literally, so it
     //    arrives as one positional argument after codex's own flags).
     if (!isHiveAwareProvider(meta.provider)) {
@@ -968,7 +967,8 @@ export class HiveManager {
       // seedPrompt; the renderer types it into the TUI after boot (ondev-b).
       const deg = degraded ? { degraded } : {};
       if (preset.seedDelivery === 'type-into-tui') return { args: [...preArgs], env, seedPrompt: prompt, ...deg };
-      // If a provider somehow exposes neither a flag nor a positional prompt, spawn bare.
+      // Providers with no declared seed strategy intentionally spawn bare. Inbox-capable
+      // non-hive-aware presets are guarded by the provider contract tests.
       if (flag) return { args: [...preArgs, flag, prompt], env, ...deg };
       if (preset.positionalInitialPrompt) return { args: [...preArgs, prompt], env, ...deg };
       return { args: preArgs, env, ...deg };
```

**File**: `src/shared/agentProvider.ts` (modified, +9/-6)
```diff
@@ -121,9 +121,9 @@ export interface AgentProviderPreset {
   /** For non-hive-aware CLIs that still take an INITIAL prompt to orient the
    *  session (Antigravity's `agy -i "<prompt>"`), the flag to pass it under. The
    *  hive identity+protocol rides in as the first turn — the closest thing to
-   *  Claude's `--append-system-prompt` these CLIs offer. undefined = the CLI
-   *  takes its initial prompt POSITIONALLY (Codex: `codex "<prompt>"`) and the
-   *  injection branch appends it as a quoted trailing arg instead of a flag. */
+   *  Claude's `--append-system-prompt` these CLIs offer. undefined means this
+   *  provider has no flag form; positional delivery must be declared explicitly
+   *  with `positionalInitialPrompt`. */
   initialPromptFlag?: string;
   /** How the hive protocol seed is delivered for a CLI that takes NEITHER a flag
    *  nor a positional seed. `'type-into-tui'` = the CLI is a bare interactive TUI
@@ -135,8 +135,8 @@ export interface AgentProviderPreset {
    *  collide). Absent/undefined = today's flag-or-positional behavior. (ondev-b) */
   seedDelivery?: 'type-into-tui';
   /** This CLI accepts the initial hive prompt as a trailing positional argument.
-   *  Codex does; Kimi/custom do not, so they must spawn bare when no prompt flag
-   *  exists instead of receiving an invalid positional argument. */
+   *  Codex/Grok/Pi do; Kimi/custom do not, so they must spawn bare when no prompt
+   *  flag exists instead of receiving an invalid positional argument. */
   positionalInitialPrompt?: boolean;
   /** Flag to resume a prior session on respawn, given the recorded session id
    *  (Claude `--resume <sid>`, Antigravity `--conversation <id>`). undefined = no
@@ -489,7 +489,10 @@ export const AGENT_PROVIDER_PRESETS: AgentProviderPreset[] = [
     // or we lean on the renderer idle nudge) is UNVERIFIED pending keys. Renderer nudge
     // is the guaranteed drain fallback either way.
     canReceiveInbox: true,
-    initialPromptFlag: undefined, // positional, like codex: pi "<prompt>"
+    initialPromptFlag: undefined,
+    // Pi's documented `pi [options] [messages...]` form accepts the hive protocol
+    // as its initial user message while leaving the interactive session alive.
+    positionalInitialPrompt: true,
     resumeFlag: '--session',
     // --ignore-scripts: don't run the package's postinstall on the user's machine.
     installCommand: 'npm install -g --ignore-scripts @earendil-works/pi-coding-agent',
```

**File**: `test/hive-pi-bootstrap.test.cjs` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+'use strict';
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+const loadTs = require('./load-ts.cjs');
+
+const { HiveManager } = loadTs('src/main/hive.ts');
+
+function tmpHome() {
+  return fs.mkdtempSync(path.join(os.tmpdir(), 'md-hive-pi-bootstrap-'));
+}
+
+test('Pi fresh spawn receives exactly one positional hive bootstrap', async (t) => {
+  const home = tmpHome();
+  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
+
+  const hive = new HiveManager(() => home);
+  const injection = await hive.ensureAgent({
+    id: 'toby-pi-test',
+    name: 'Toby',
+    provider: 'pi',
+    cwd: home
+  });
+
+  assert.equal(injection.seedPrompt, undefined, 'Pi receives its bootstrap on argv, not via TUI typing');
+  assert.equal(injection.args.length, 1, 'the bootstrap must remain one trailing positional argument');
+
+  const [prompt] = injection.args;
+  assert.match(prompt, /^You are "Toby" \(toby-pi-test\),/);
+  assert.match(prompt, /HIVE PROTOCOL/);
+  assert.ok(prompt.includes(path.join(home, 'hive', 'agents', 'toby-pi-test', 'inbox')));
+  assert.ok(prompt.split('\n').length > 5, 'the multiline bootstrap must not be split into argv tokens');
+});
+
+test('Pi bridge setup failure does not suppress its positional bootstrap', async (t) => {
+  const home = tmpHome();
+  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
+
+  const hive = new HiveManager(() => home);
+  const errors = [];
+  t.mock.method(console, 'error', (...args) => errors.push(args));
+  hive.installPiHooks = () => { throw new Error('synthetic bridge failure'); };
+
+  const injection = await hive.ensureAgent({
+    id: 'pi-degraded-test',
+    name: 'Meredith',
+    provider: 'pi',
+    cwd: home
+  });
+
+  assert.equal(injection.env.PI_CODING_AGENT_DIR, undefined);
+  assert.equal(injection.args.length, 1);
+  assert.match(injection.args[0], /^You are "Meredith" \(pi-degraded-test\),/);
+  assert.match(injection.args[0], /HIVE PROTOCOL/);
+  assert.equal(errors.length, 1);
+  assert.match(String(errors[0][0]), /install hooks bridge failed/);
+});
```

**File**: `test/provider-config.test.cjs` (modified, +32/-0)
```diff
@@ -5,6 +5,7 @@ const assert = require('node:assert/strict');
 const loadTs = require('./load-ts.cjs');
 
 const {
+  AGENT_PROVIDER_PRESETS,
   inferAgentProvider,
   isAgentProvider,
   providerPreset
@@ -58,6 +59,37 @@ test('Grok is a first-class inferred provider with hooks, resume, and always-app
   assert.equal(preset.resumeFlag, '--resume');
 });
 
+test('Pi is a first-class inferred provider with hooks, positional bootstrap, and resume', () => {
+  assert.equal(isAgentProvider('pi'), true);
+  assert.equal(inferAgentProvider('pi --model anthropic/claude-sonnet-4-5'), 'pi');
+
+  const preset = providerPreset('pi');
+  assert.equal(preset.defaultCommand, 'pi');
+  assert.equal(preset.canReceiveInbox, true);
+  assert.deepEqual(preset.bridge, { kind: 'hooks', shim: 'pi' });
+  assert.equal(preset.initialPromptFlag, undefined);
+  assert.equal(preset.positionalInitialPrompt, true);
+  assert.equal(preset.resumeFlag, '--session');
+});
+
+test('every non-hive-aware inbox provider declares exactly one bootstrap delivery path', () => {
+  for (const preset of AGENT_PROVIDER_PRESETS) {
+    if (preset.hiveAware || !preset.canReceiveInbox) continue;
+
+    const deliveries = [
+      typeof preset.initialPromptFlag === 'string' && preset.initialPromptFlag.length > 0,
+      preset.positionalInitialPrompt === true,
+      preset.seedDelivery !== undefined
+    ].filter(Boolean).length;
+
+    assert.equal(
+      deliveries,
+      1,
+      `${preset.id} can receive hive inbox but declares ${deliveries} bootstrap delivery paths`
+    );
+  }
+});
+
 test('provider commands use matching models and equivalent bypass modes', () => {
   assert.equal(
     buildSpawnCommand(autoConfig, 'claude-sonnet-5', 'claude'),
```

---

### Incident Patch 9: `b9e20f74` (2026-10-02)
**Commit Message**: Merge pull request #546 from snehithareddy28/fix/terminal-shift-enter

fix(terminal): Shift+Enter inserts a newline instead of submitting

**File**: `src/renderer/src/components/terminalKeys.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+/**
+ * Modifier-key encoding for the embedded terminal.
+ *
+ * xterm.js encodes Shift+Enter exactly like Enter — a bare CR — so a TUI cannot
+ * tell the two apart, and Shift+Enter at a prompt submits instead of opening a
+ * new line (#481). Terminals that get this right send a distinct sequence, and
+ * the one Claude Code's `/terminal-setup` installs for iTerm2 and VS Code is
+ * ESC CR. Nothing configures that for our pane, so it has to be sent here.
+ *
+ * Kept structural and free of imports — no xterm, no window — so the mapping is
+ * unit-testable on its own, the same way askMeOrder.ts and queueDelivery.ts are.
+ * The caller supplies the fields it reads from a KeyboardEvent.
+ */
+
+/** ESC CR — "insert a newline, do not submit". Provider-neutral: it is the
+ *  convention `/terminal-setup` writes for Claude Code, and the same sequence
+ *  Alt+Enter has always produced, so any TUI that honours one honours the other. */
+export const NEWLINE_SEQUENCE = '\x1b\r';
+
+/** The fields this needs from a KeyboardEvent. */
+export interface TerminalKey {
+  type: string;
+  key: string;
+  shiftKey: boolean;
+  ctrlKey: boolean;
+  metaKey: boolean;
+  altKey: boolean;
+}
+
+/**
+ * The bytes to send for a key the terminal would otherwise encode wrongly, or
+ * null to let xterm handle it as usual.
+ *
+ * Deliberately narrow. Only Shift+Enter is claimed, and only when it is the ONLY
+ * modifier held:
+ *   - plain Enter still submits, which is the whole point of the prompt;
+ *   - Alt+Enter already produces this sequence natively, so intercepting it
+ *     would be a no-op at best and a double-encode at worst;
+ *   - Ctrl+Enter and Cmd+Enter belong to the TUI (and to the app's own
+ *     shortcuts), so they are left alone rather than quietly redefined.
+ *
+ * keydown only: xterm's custom-key hook also sees keypress and keyup, and
+ * answering on more than one of them would insert the newline two or three times.
+ */
+export function terminalKeySequence(ev: TerminalKey): string | null {
+  if (ev.type !== 'keydown') return null;
+  if (ev.key !== 'Enter') return null;
+  if (!ev.shiftKey) return null;
+  if (ev.ctrlKey || ev.metaKey || ev.altKey) return null;
+  return NEWLINE_SEQUENCE;
+}
```

**File**: `src/renderer/src/components/terminalPool.ts` (modified, +13/-0)
```diff
@@ -39,6 +39,7 @@ import {
   type TerminalAutomationBlock
 } from './terminalAutomation';
 import { sanitizeTerminalSelection } from './terminalSelection';
+import { terminalKeySequence } from './terminalKeys';
 import '@xterm/xterm/css/xterm.css';
 
 export interface TerminalEntry {
@@ -255,6 +256,18 @@ export function acquireTerminal(ptyId: string, theme?: ThemeMap, fontSize = 14):
   };
   term.attachCustomKeyEventHandler((ev) => {
     if (ev.type !== 'keydown') return true;
+    // Keys xterm would encode in a way the TUI cannot read. Checked BEFORE the
+    // Ctrl/Cmd gate below, because Shift+Enter holds neither: without this it
+    // fell straight through to xterm's default, which sends the same bare CR as
+    // Enter — so Shift+Enter submitted the prompt instead of opening a new line
+    // (#481). Writing to the pty directly is the same path the OSC colour replies
+    // below already use.
+    const seq = terminalKeySequence(ev);
+    if (seq !== null) {
+      if (!entry.exited) window.cth.writePty(ptyId, seq);
+      ev.preventDefault();
+      return false;
+    }
     if (!(ev.ctrlKey || ev.metaKey)) return true;
     const key = ev.key.toLowerCase();
     if (key === 'c' && (ev.shiftKey || term.hasSelection())) {
```

**File**: `test/terminal-keys.test.cjs` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+'use strict';
+/**
+ * Upstream issue #481: Shift+Enter at a prompt inside the embedded terminal
+ * submits instead of inserting a newline. xterm.js encodes Shift+Enter exactly
+ * like Enter — a bare CR — so the TUI cannot tell them apart. Terminals that
+ * get this right send ESC CR, which is what Claude Code's `/terminal-setup`
+ * installs for iTerm2 and VS Code; nothing configures our pane, so the pane has
+ * to send it. These tests pin the mapping, and pin how narrow it is: every other
+ * Enter combination is left to xterm and to the TUI.
+ */
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const loadTs = require('./load-ts.cjs');
+
+const { terminalKeySequence, NEWLINE_SEQUENCE } = loadTs('src/renderer/src/components/terminalKeys.ts');
+
+/** A KeyboardEvent as the handler sees it. */
+const key = (over = {}) => ({
+  type: 'keydown', key: 'Enter',
+  shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...over
+});
+
+test('Shift+Enter sends ESC CR — the sequence /terminal-setup installs', () => {
+  assert.equal(terminalKeySequence(key({ shiftKey: true })), '\x1b\r');
+  assert.equal(NEWLINE_SEQUENCE, '\x1b\r');
+});
+
+test('plain Enter is left alone, so the prompt still submits', () => {
+  assert.equal(terminalKeySequence(key()), null);
+});
+
+test('Enter with another modifier is left to the TUI', () => {
+  // Alt+Enter already produces ESC CR natively — intercepting it would double-encode.
+  assert.equal(terminalKeySequence(key({ shiftKey: true, altKey: true })), null);
+  assert.equal(terminalKeySequence(key({ altKey: true })), null);
+  // Ctrl+Enter / Cmd+Enter belong to the TUI and to the app's own shortcuts.
+  assert.equal(terminalKeySequence(key({ shiftKey: true, ctrlKey: true })), null);
+  assert.equal(terminalKeySequence(key({ shiftKey: true, metaKey: true })), null);
+});
+
+test('only keydown answers, so the newline is not inserted two or three times', () => {
+  // xterm's custom-key hook also sees keypress and keyup for the same press.
+  assert.equal(terminalKeySequence(key({ shiftKey: true, type: 'keypress' })), null);
+  assert.equal(terminalKeySequence(key({ shiftKey: true, type: 'keyup' })), null);
+});
+
+test('Shift with any other key is not claimed', () => {
+  for (const k of ['a', 'Tab', 'Backspace', 'ArrowUp', 'NumpadEnter']) {
+    assert.equal(terminalKeySequence(key({ shiftKey: true, key: k })), null, k);
+  }
+});
```

---

### Incident Patch 10: `811e5f98` (2026-10-02)
**Commit Message**: Merge pull request #512 from gpechieu/fix/archived-recipient-notice

fix(hive): mail to an archived agent is filed, and its sender is told nobody is there

**File**: `src/main/hive.ts` (modified, +33/-0)
```diff
@@ -1691,6 +1691,39 @@ export class HiveManager {
         }, godId);
         continue;
       }
+      // An ARCHIVED recipient (its terminal is gone) still has an inbox, so the
+      // mail lands there and reads as delivered — and stays unread. Filing it
+      // is right: a worker re-hired under the same id reads it on its first turn
+      // (a released worker's inbox is settled only up to its done signal). But
+      // the sender learned nothing, so god kept mailing dead agents for hours
+      // (seen live 2026-08-16), and a request to a worker nobody re-hires was
+      // simply lost. Now mail that expects an answer is filed AND its sender is
+      // told, at once, that no one is there to answer it. Inform-only mail
+      // (status, done, agree) is filed quietly. This comes BEFORE the provider
+      // branches below on purpose: with no terminal there is nothing to hand a
+      // work order to, whatever the engine — the inbox is the only place left.
+      // The notice itself is ROUTED, not dropped into an inbox, so a sender on
+      // a hookless or proxy-tier engine gets it the way it gets any mail.
+      if (t !== godId && reg.agents[t]?.archived) {
+        if (this.deliver(msg, t)) delivered.push(t);
+        this.appendLog({ kind: 'archived-recipient', from: msg.from, to: t, id: msg.id, act: msg.act });
+        const sender = reg.agents[msg.from];
+        if (msg.requires_reply && sender && !sender.archived) {
+          this.routeMessage(this.normalize({
+            to: msg.from,
+            act: 'inform',
+            in_reply_to: msg.id,
+            conversation: msg.conversation,
+            hops: msg.hops + 1,
+            requires_reply: false,
+            subject: `[no one is there to answer — "${t}" is archived] ${msg.subject}`,
+            body: `Your ${msg.act} to ${t} was filed in its inbox, but ${t} has no live terminal (archived), `
+              + `so it will only be read if ${t} is restored or re-hired under the same id. `
+              + 'If you need this done now, route it to an agent on the live roster or hire one.'
+          }, 'system'));
+        }
+        continue;
+      }
       // A provider without safe-idle lifecycle state (a hookless custom command)
       // would let direct mail rot unread. Claude and bridged Antigravity/Codex
       // receive directly into inbox/ for guarded renderer delivery. Otherwise try
```

**File**: `test/hive-archived-recipient.test.cjs` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+'use strict';
+// Mail to an ARCHIVED agent is filed, and its sender is told nobody is there.
+//
+// An archived agent (terminal gone) keeps its inbox, so a message to it lands
+// there, is logged as delivered, and stays unread. Filing it is right — a
+// worker re-hired under the same id reads it on its first turn, and a released
+// worker's inbox is settled only up to its done signal — but the sender learned
+// nothing: god kept mailing dead agents for hours (seen live 2026-08-16), and a
+// request to a worker nobody re-hired was simply lost. Now a message that
+// expects an answer (request / query / propose) is filed AND its sender gets an
+// immediate inform saying so; inform-only mail is filed quietly.
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+const loadTs = require('./load-ts.cjs');
+
+const { HiveManager } = loadTs('src/main/hive.ts');
+
+async function floor(t) {
+  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-archived-to-'));
+  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
+  const hive = new HiveManager(() => home);
+  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
+  await hive.ensureAgent({ id: 'worker-jim', name: 'Jim', provider: 'claude', cwd: home });
+  await hive.ensureAgent({ id: 'pam-1', name: 'Pam', provider: 'claude', cwd: home });
+  hive.setArchived('worker-jim', true);
+  return { home, hive };
+}
+
+const entries = (hive, kind) => hive.logTail(500).filter((e) => e.kind === kind);
+
+test('a request to an archived agent is filed in its inbox and the sender is informed at once', async (t) => {
+  const { hive } = await floor(t);
+  const sent = hive.send({ to: 'worker-jim', act: 'request', subject: 'T15 — start the build', body: 'go' }, 'god-1');
+
+  const filed = hive.inbox('worker-jim');
+  assert.equal(filed.length, 1, 'the mail is filed, so a re-hire under the same id reads it');
+  assert.equal(filed[0].subject, 'T15 — start the build', 'filed verbatim, not rewritten');
+
+  const [notice] = hive.inbox('god-1');
+  assert.ok(notice, 'the sender hears about it');
+  assert.equal(notice.act, 'inform');
+  assert.equal(notice.from, 'system');
+  assert.equal(notice.in_reply_to, sent.id, 'threaded on the original message');
+  assert.equal(notice.requires_reply, false, 'a notice never asks for an answer (no ping-pong)');
+  assert.match(notice.subject, /^\[no one is there to answer — "worker-jim" is archived\] T15 — start the build$/);
+  assert.match(notice.body, /re-hired under the same id/);
+
+  const [logged] = entries(hive, 'archived-recipient');
+  assert.deepEqual({ from: logged.from, to: logged.to, id: logged.id, act: logged.act },
+    { from: 'god-1', to: 'worker-jim', id: sent.id, act: 'request' });
+  const [routed] = entries(hive, 'message').filter((e) => e.id === sent.id);
+  assert.deepEqual(routed.delivered, ['worker-jim'], 'the message log still reports the delivery that happened');
+});
+
+test('query and propose are told too; an inform / done to an archived agent is filed quietly', async (t) => {
+  const { hive } = await floor(t);
+  hive.send({ to: 'worker-jim', act: 'query', subject: 'status?', body: '' }, 'god-1');
+  hive.send({ to: 'worker-jim', act: 'propose', subject: 'plan B', body: '' }, 'god-1');
+  assert.equal(hive.inbox('god-1').length, 2);
+  hive.send({ to: 'worker-jim', act: 'inform', subject: 'FYI', body: 'anchors' }, 'god-1');
+  hive.send({ to: 'worker-jim', act: 'done', subject: 'closing', body: '' }, 'pam-1');
+  assert.equal(hive.inbox('god-1').length, 2, 'no notice for mail that expects no answer');
+  assert.equal(hive.inbox('pam-1').length, 0);
+  assert.equal(hive.inbox('worker-jim').length, 4, 'everything is filed all the same');
+  assert.equal(entries(hive, 'archived-recipient').length, 4);
+});
+
+test('a live agent other than god is informed the same way; a sender off the roster is not', async (t) => {
+  const { hive } = await floor(t);
+  hive.send({ to: 'worker-jim', act: 'request', subject: 'from Pam', body: '' }, 'pam-1');
+  assert.equal(hive.inbox('pam-1').length, 1);
+  assert.equal(hive.inbox('god-1').length, 0, 'the notice goes to the sender, not to god');
+  // The UI / harness sends as "system", which has no inbox to inform.
+  hive.send({ to: 'worker-jim', act: 'request', subject: 'from the UI', body: '' }, 'system');
+  assert.equal(hive.inbox('god-1').length, 0);
+  assert.equal(hive.inbox('worker-jim').length, 2);
+});
+
+// The archived check runs BEFORE the provider branches: an archived agent on a
+// hookless engine used to be handed a terminal work order (there is no
+// terminal) instead of having the mail filed, and its sender heard nothing.
+// The notice is routed like any mail, so a sender on such an engine is told the
+// way it is told anything else (term
```

---

### Incident Patch 11: `0dc82f31` (2026-10-02)
**Commit Message**: Merge pull request #511 from HsienW/fix/pi-tool-event-normalization

fix(hive): preserve Pi tool identity across hook events

**File**: `src/main/hive.ts` (modified, +23/-3)
```diff
@@ -2365,7 +2365,7 @@ export class HiveManager {
       writeFileSync(join(extDir, 'hive-bridge.js'), PI_EXTENSION, 'utf8');
       // A manifest so Pi auto-loads the extension on start (best-effort; harmless if
       // Pi ignores it). Kept minimal and hive-authored.
-      const manifest = { name: 'munder-hive-bridge', version: '0.3.1', main: 'extensions/hive-bridge.js', auto: true };
+      const manifest = { name: 'munder-hive-bridge', version: '0.3.2', main: 'extensions/hive-bridge.js', auto: true };
       writeFileSync(join(home, 'extensions.json'), JSON.stringify(manifest, null, 2), 'utf8');
 
       const userPiDir = join(homedir(), '.pi', 'agent');
@@ -3208,15 +3208,35 @@ function post(payload) {
     c.on('error', function () {});
   } catch (e) {}
 }
+function firstDefined(primary, fallback) {
+  return primary !== undefined && primary !== null ? primary : fallback;
+}
+function piField(ev, key) {
+  try { return ev == null ? undefined : ev[key]; } catch (e) { return undefined; }
+}
+function piToolName(ev) {
+  var tool = piField(ev, 'tool');
+  return firstDefined(piField(ev, 'toolName'), firstDefined(piField(ev, 'name'), piField(tool, 'name')));
+}
+function piToolInput(ev) {
+  return firstDefined(piField(ev, 'input'), piField(ev, 'args'));
+}
+function piToolPayload(hookEventName, ev) {
+  return {
+    hook_event_name: hookEventName,
+    tool_name: piToolName(ev),
+    tool_input: piToolInput(ev)
+  };
+}
 function register(pi) {
   if (!pi || typeof pi.on !== 'function') return false;
   try {
     pi.on('tool_call', function (ev) {
-      post({ hook_event_name: 'PreToolUse', tool_name: ev && (ev.name || (ev.tool && ev.tool.name)), tool_input: ev && (ev.args || ev.input) });
+      post(piToolPayload('PreToolUse', ev));
       if (AUTO) { try { if (ev && typeof ev.approve === 'function') ev.approve(); } catch (e) {} return { approve: true }; }
       return undefined;
     });
-    pi.on('tool_result', function (ev) { post({ hook_event_name: 'PostToolUse', tool_name: ev && (ev.name || (ev.tool && ev.tool.name)) }); });
+    pi.on('tool_result', function (ev) { post(piToolPayload('PostToolUse', ev)); });
     pi.on('agent_end', function () { post({ hook_event_name: 'Stop' }); });
     return true;
   } catch (e) { return false; }
```

**File**: `test/pi-bridge.test.cjs` (added, +287/-0)
```diff
@@ -0,0 +1,287 @@
+'use strict';
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+const vm = require('node:vm');
+const loadTs = require('./load-ts.cjs');
+
+const { HiveManager } = loadTs('src/main/hive.ts');
+const { CircuitBreaker } = loadTs('src/main/breaker.ts');
+
+async function installedPiBridge(t) {
+  const hiveHome = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pi-bridge-hive-'));
+  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pi-bridge-user-'));
+  t.after(() => fs.rmSync(hiveHome, { recursive: true, force: true }));
+  t.after(() => fs.rmSync(fakeHome, { recursive: true, force: true }));
+
+  const realHome = process.env.HOME;
+  const realProfile = process.env.USERPROFILE;
+  process.env.HOME = fakeHome;
+  process.env.USERPROFILE = fakeHome;
+  try {
+    const hive = new HiveManager(() => hiveHome);
+    const injection = await hive.ensureAgent({
+      id: 'pi-bridge-test',
+      name: 'Pi Bridge Test',
+      provider: 'pi',
+      cwd: hiveHome
+    });
+    const piDir = injection.env.PI_CODING_AGENT_DIR;
+    assert.ok(piDir, 'Pi agent directory should be injected');
+    return {
+      source: fs.readFileSync(path.join(piDir, 'extensions', 'hive-bridge.js'), 'utf8'),
+      manifest: JSON.parse(fs.readFileSync(path.join(piDir, 'extensions.json'), 'utf8'))
+    };
+  } finally {
+    if (realHome === undefined) delete process.env.HOME;
+    else process.env.HOME = realHome;
+    if (realProfile === undefined) delete process.env.USERPROFILE;
+    else process.env.USERPROFILE = realProfile;
+  }
+}
+
+function runBridge(source, options = {}) {
+  const frames = [];
+  const handlers = new Map();
+  let connections = 0;
+  const socket = {
+    end(data) {
+      frames.push(JSON.parse(String(data).trim()));
+    },
+    on(event, listener) {
+      if (event === 'error' && options.socketError) process.nextTick(listener);
+      return this;
+    }
+  };
+  const net = {
+    createConnection(_address, onConnect) {
+      connections += 1;
+      if (options.connectThrows) throw new Error('connect failed');
+      if (!options.neverConnect && !options.socketError) process.nextTick(onConnect);
+      return socket;
+    }
+  };
+  const pi = options.pi ?? {
+    on(event, handler) {
+      if (options.registrationFailure === event) throw new Error('registration failed');
+      handlers.set(event, handler);
+    }
+  };
+  const mod = { exports: {} };
+  const env = {
+    AGENT_ID: 'pi-bridge-test',
+    ...(options.withoutSocket ? {} : { HIVE_SOCK: '\\\\.\\pipe\\munder-pi-test' }),
+    ...(options.autoApprove ? { HIVE_AUTO_APPROVE: '1' } : {})
+  };
+
+  vm.runInNewContext(source, {
+    module: mod,
+    exports: mod.exports,
+    require(request) {
+      if (request === 'node:net') return net;
+      throw new Error(`unexpected require: ${request}`);
+    },
+    process: { env },
+    globalThis: { pi }
+  }, { filename: 'hive-bridge.js', timeout: 1000 });
+
+  return {
+    frames,
+    handlers,
+    activate: mod.exports,
+    connections: () => connections,
+    flush: () => new Promise((resolve) => setImmediate(resolve))
+  };
+}
+
+function makeBreaker() {
+  return new CircuitBreaker(() => ({
+    enabled: true,
+    hardStop: false,
+    repeatedToolLimit: 8,
+    errorStormLimit: 5,
+    tokenVelocityPerMin: 60_000
+  }));
+}
+
+function tick(breaker, now) {
+  return breaker.tick([{
+    agentId: 'pi-bridge-test',
+    sample: null,
+    progressing: true
+  }], now)[0];
+}
+
+test('generated Pi bridge preserves tool identity and breaker semantics', async (t) => {
+  const { source, manifest } = await installedPiBridge(t);
+
+  await t.test('installs the repaired bridge manifest', () => {
+    assert.equal(manifest.name, 'munder-hive-bridge');
+    assert.equal(manifest.version, '0.3.2');
+    assert.equal(manifest.main, 'extensions/hive-bridge.js');
+    assert.equal(manifest.auto, true);
+  });
+
+  await t.test('maps confirmed Pi fields on both tool boundaries', async () => {
+    const bridge = runBridge(source);
+    const event = { toolName: 'bash', input: { command: 'git status' } };
+    bridge.handlers.get('tool_call')(event);
+    bridge.handlers.get('tool_result')(event);
+    await bridge.flush();
+
+    assert.deepEqual(bridge.frames, [
+      {
+        hook_event_name: 'PreToolUse',
+        tool_name: 'bash',
+        tool_input: { command: 'git status' },
+        agent_id: 'pi-bridge-test'
+      },
+      {
+        hook_event_name: 'PostToolUse',
+        tool_name: 'bash',
+        tool_input: { command: 'git status' },
+        agent_id: 'pi-bridge-test'
+      }
+    ]);
+  });
+
+  await t.test('retains legacy fallbacks with confirmed fields taking precedence', async () => {
+    const bridge = runBridge(source);
+    bridge.handlers.get('tool_result')({ name: 'read', args: { path: 'README.md' } });
+ 
```

---

### Incident Patch 12: `94be9942` (2026-10-02)
**Commit Message**: Merge pull request #508 from HsienW/fix/reflect-framed-summary

fix(reflect): use framed summaries for reliable condensation

**File**: `src/main/reflect.ts` (modified, +115/-20)
```diff
@@ -39,21 +39,38 @@ const PINNED_HEADING = '## 📌 Durable facts (pinned — never condensed)';
 const CONDENSED_HEADING = '## 🗜 Condensed history';
 const RECENT_HEADING = '## Recent';
 
+0/** Line-oriented output protocol. The prompt and parser share these literals so
+ *  the contract cannot drift without changing both sides together. */
+const CONDENSED_MARKER = '<<<CONDENSED>>>';
+const HOIST_MARKER = '<<<HOIST>>>';
+const END_MARKER = '<<<END>>>';
+const HOIST_BULLET_PREFIX = '- ';
+const SUMMARY_MARKERS = [CONDENSED_MARKER, HOIST_MARKER, END_MARKER] as const;
+
 /** Instruction prefix — kept byte-identical across calls (no dates/ids spliced
  *  in) so Claude Code prompt-caches it; the dynamic content goes in the tail. */
 const CONDENSE_SYSTEM = [
   "You are compacting one AI agent's long-term memory file. You will receive:",
   '(A) the current CONDENSED summary, (B) older RECENT sections being evicted,',
   '(C) the PINNED durable-facts block (for context only — do not rewrite it).',
-  'Produce STRICT JSON: {"condensed": "<text>", "hoist": ["<line>", ...]}.',
+  'Output exactly one block in this format:',
+  CONDENSED_MARKER,
+  '<free-form condensed summary>',
+  HOIST_MARKER,
+  `${HOIST_BULLET_PREFIX}<new durable fact, one per line>`,
+  END_MARKER,
   'RULES:',
-  '- "condensed" = a single bounded summary of (A)+(B). Re-summarize (A) together',
+  '- The condensed section = a single bounded summary of (A)+(B). Re-summarize (A) together',
   '  with (B) so the result does not grow unbounded. Target <= 1500 words. Preserve',
   '  every decision, root cause, protocol, file path, commit SHA, and numeric result.',
   '  Drop routine standup chatter, resolved blockers, and superseded plans.',
-  '- "hoist" = any NEW high-importance durable fact found in (B) that belongs in the',
-  '  pinned block and is not already in (C). Lines only; may be empty.',
-  '- Output ONLY the JSON object. No prose, no code fence.'
+  '- Write the condensed section as literal free-form text; do not JSON-encode or escape it.',
+  '- The hoist section = any NEW high-importance durable fact found in (B) that belongs',
+  '  in the pinned block and is not already in (C). Prefix every fact with "- ".',
+  '- Leave the hoist section empty when there are no new durable facts.',
+  `- ${SUMMARY_MARKERS.join(', ')} must each appear exactly once on a line by itself,`,
+  '  in that order. Never copy these marker strings into either section.',
+  '- Output ONLY the framed block. No surrounding prose or code fence.'
 ].join('\n');
 
 export interface ReflectSettings {
@@ -290,7 +307,7 @@ export class MemoryReflector {
       throw new Error(result.error ?? 'condense: hidden session returned no text');
     }
     const parsed = parseSummary(result.text);
-    if (!parsed) throw new Error('condense: response contained no parseable JSON');
+    if (!parsed) throw new Error('condense: response contained no parseable summary');
     return parsed;
   }
 }
@@ -376,7 +393,7 @@ export function verify(args: {
   condensed: string; keep: Section[];
 }): { ok: true } | { ok: false; reason: string } {
   const { rebuilt, newBytes, oldBytes, oldPinnedLines, mergedPinned, condensed, keep } = args;
-  // 6) Valid summary JSON already enforced upstream (parseSummary). Here: structure.
+  // 6) Valid summary structure already enforced upstream (parseSummary). Here: memory shape.
   // 1) Parses back into the 3-region structure.
   const re = parseMemory(rebuilt);
   if (re.pinned === null || re.condensed === null) return { ok: false, reason: 'structure-missing-region' };
@@ -399,27 +416,105 @@ export function verify(args: {
   return { ok: true };
 }
 
-/** Pull `{condensed, hoist}` out of `claude -p --output-format json` output.
- *  Two layers: the CLI envelope `{result: "<text>"}`, then the model's strict
- *  JSON (tolerating an accidental ```json fence). Returns null on any failure. */
-export function parseSummary(stdout: string): { condensed: string; hoist: string[] } | null {
-  const raw = stdout.trim();
-  if (!raw) return null;
-  let inner = raw;
+/** Unwrap the JSON envelope emitted by `claude -p --output-format json`. If the
+ *  text is not a recognized envelope, preserve it as direct model output. */
+function unwrapCliEnvelope(raw: string): string {
   try {
-    const env = JSON.parse(raw) as { result?: unknown; text?: unknown };
-    if (typeof env.result === 'string') inner = env.result;
-    else if (typeof env.text === 'string') inner = env.text;
-  } catch { /* not the CLI envelope — treat stdout itself as the model output */ }
-  inner = inner.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
+    const parsed = JSON.parse(raw) as unknown;
+    if (!parsed || typeof parsed !== 'object') return raw;
+    const env = parsed as { result?: unknown; text?: unknown };
+    if (typeof env.result === 'string') return env.result;
+    if (typeof env.text === 'string') return env.text;
+    return raw;
+  } catc
```

**File**: `test/reflect-summary.test.cjs` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+'use strict';
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const loadTs = require('./load-ts.cjs');
+
+const { parseSummary } = loadTs('src/main/reflect.ts');
+
+const CONDENSED = '<<<CONDENSED>>>';
+const HOIST = '<<<HOIST>>>';
+const END = '<<<END>>>';
+
+function frame(condensed, hoist = []) {
+  return [
+    CONDENSED,
+    condensed,
+    HOIST,
+    ...hoist.map((fact) => `- ${fact}`),
+    END
+  ].join('\n');
+}
+
+test('parses the framed summary contract', () => {
+  assert.deepEqual(parseSummary(frame('A bounded summary.', ['fact one', 'fact two'])), {
+    condensed: 'A bounded summary.',
+    hoist: ['fact one', 'fact two']
+  });
+  assert.deepEqual(parseSummary(frame('No durable facts.')), {
+    condensed: 'No durable facts.',
+    hoist: []
+  });
+});
+
+test('framed condensed text is literal and does not depend on JSON escaping', () => {
+  const condensed = [
+    'Mode is "plan" and the repo is C:\\D\\ai-agent\\src\\main.',
+    'Use `npm run build` and preserve config = {"mode":"safe"}.',
+    'A truncated JSON fragment is still memory content: {"foo": "bar"',
+    '```ts',
+    'const path = "C:\\\\work\\\\repo";',
+    '```'
+  ].join('\n');
+
+  assert.deepEqual(parseSummary(frame(condensed, ['Preserve quoted Windows paths'])), {
+    condensed,
+    hoist: ['Preserve quoted Windows paths']
+  });
+});
+
+test('normalizes framed CRLF and accepts CLI result or text envelopes', () => {
+  const output = frame('line one\nline two', ['durable']);
+  const expected = { condensed: 'line one\nline two', hoist: ['durable'] };
+
+  assert.deepEqual(parseSummary(output.replace(/\n/g, '\r\n')), expected);
+  assert.deepEqual(parseSummary(JSON.stringify({ result: output })), expected);
+  assert.deepEqual(parseSummary(JSON.stringify({ text: output })), expected);
+});
+
+test('accepts an optional complete outer code fence without stripping inner fences', () => {
+  const condensed = ['Keep this example:', '```json', '{"ok": true}', '```'].join('\n');
+  const output = frame(condensed);
+  const expected = { condensed, hoist: [] };
+
+  for (const tag of ['', 'text', 'json']) {
+    assert.deepEqual(parseSummary(`\`\`\`${tag}\n${output}\n\`\`\``), expected);
+  }
+});
+
+test('rejects partial, duplicated, out-of-order, or contaminated frames', () => {
+  const invalid = [
+    `summary\n${HOIST}\n${END}`,
+    `${CONDENSED}\nsummary\n${END}`,
+    `${CONDENSED}\nsummary\n${HOIST}`,
+    `${CONDENSED}\nsummary\n${CONDENSED}\n${HOIST}\n${END}`,
+    `${CONDENSED}\nsummary\n${HOIST}\n${HOIST}\n${END}`,
+    `${CONDENSED}\nsummary\n${HOIST}\n${END}\n${END}`,
+    `${HOIST}\n${CONDENSED}\nsummary\n${END}`,
+    `Here is the summary:\n${frame('summary')}`,
+    `${frame('summary')}\nHope this helps.`,
+    `${CONDENSED}\n \n${HOIST}\n${END}`,
+    `${CONDENSED}\nsummary\n${HOIST}\nnot a bullet\n${END}`,
+    `${CONDENSED}\nsummary\n${HOIST}\n- \n${END}`,
+    `\`\`\`text\n${frame('summary')}`
+  ];
+
+  for (const output of invalid) {
+    assert.doesNotThrow(() => parseSummary(output));
+    assert.equal(parseSummary(output), null, output);
+  }
+});
+
+test('preserves valid legacy JSON and its existing hoist filtering', () => {
+  const legacy = { condensed: 'legacy summary', hoist: ['fact', 42, null] };
+  const expected = { condensed: 'legacy summary', hoist: ['fact'] };
+
+  assert.deepEqual(parseSummary(JSON.stringify(legacy)), expected);
+  assert.deepEqual(parseSummary(JSON.stringify({ result: JSON.stringify(legacy) })), expected);
+  assert.deepEqual(parseSummary(`\`\`\`json\n${JSON.stringify(legacy)}\n\`\`\``), expected);
+  assert.deepEqual(parseSummary(JSON.stringify({ condensed: 'legacy summary' })), {
+    condensed: 'legacy summary',
+    hoist: []
+  });
+});
+
+test('malformed legacy JSON and garbage remain fail-closed', () => {
+  const invalid = [
+    '',
+    'random text',
+    '{{{{',
+    '{"condensed":"unfinished","hoist":[]',
+    String.raw`{"condensed":"C:\work","hoist":[]}`,
+    '{"condensed":"line one\nline two","hoist":[]}',
+    '{"hoist":[]}',
+    '{"condensed":"   ","hoist":[]}'
+  ];
+
+  for (const output of invalid) {
+    assert.doesNotThrow(() => parseSummary(output));
+    assert.equal(parseSummary(output), null, output);
+  }
+});
```

---

### Incident Patch 13: `443a4c83` (2026-10-02)
**Commit Message**: Merge pull request #499 from HsienW/fix/provider-default-command

fix(worker): resolve omitted commands from requested provider

**File**: `src/main/hive.ts` (modified, +3/-3)
```diff
@@ -1580,7 +1580,7 @@ export class HiveManager {
     // saying nothing, and COMMANDS.md documents it either way for the case where
     // the operator turns it on after god was already running.
     const spawnQueueLine = meta.isGod && this.orchestratorMaySpawn()
-      ? `SPAWNING A WORKER: you can start an ephemeral worker yourself by writing ONE JSON file into ${inRoot('spawn-requests')}/<id>.json. Required: \`objective\` (what the worker must do) and \`cwd\` (the repo it runs in). Optional: \`name\`, \`command\`, \`provider\`, \`model\`, \`isolate\` (default true = its own git worktree), \`tokenCap\`, and \`slack\` ({channel, thread_ts}) to route its failures back to a thread. The harness polls that directory, spawns \`worker-<id>\`, and moves the request to \`spawn-requests/.done/\` on success or \`.failed/\` with a reason. This is the ONLY way you can spawn; a hire manifest under research/hires/ needs the human to confirm it in the UI, so it is not a route you can complete on your own. Reuse an existing agent first, as above — a worker is a fresh spend every time.`
+      ? `SPAWNING A WORKER: you can start an ephemeral worker yourself by writing ONE JSON file into ${inRoot('spawn-requests')}/<id>.json. Required: \`objective\` (what the worker must do) and \`cwd\` (the repo it runs in). Optional: \`name\`, \`command\` (overrides the provider default), \`provider\` (selects its default CLI when command is omitted), \`model\`, \`isolate\` (default true = its own git worktree), \`tokenCap\`, and \`slack\` ({channel, thread_ts}) to route its failures back to a thread. The harness polls that directory, spawns \`worker-<id>\`, and moves the request to \`spawn-requests/.done/\` on success or \`.failed/\` with a reason. This is the ONLY way you can spawn; a hire manifest under research/hires/ needs the human to confirm it in the UI, so it is not a route you can complete on your own. Reuse an existing agent first, as above — a worker is a fresh spend every time.`
       : '';
     const godLine = meta.isGod
       ? 'You are the GOD / ORCHESTRATOR of this hive — your job is to ORCHESTRATE, not to implement: maintain live situational awareness and delegate the work. (1) AWARENESS — always know what is going on: keep an accurate picture of every agent (active vs archived/idle), the task board, and all in-flight work; drain your inbox continually and triage every other agent\'s requests, answering clarifications so the team runs autonomously. (2) DELEGATE — decompose work and fan it out to the hive agents via their inboxes (route messages and assign owners; do not do their jobs); do NOT take on grunt implementation yourself. Stay aware of who is already on the floor and delegate OPPORTUNISTICALLY: BEFORE you spawn anything, CHECK THE LIVE ROSTER (active agents in registry.json + their state in fleet.json) and prefer routing to an EXISTING agent that fits — above all when the request names one ("ask Pam to…", "have Jim…"), route to that agent instead of reflexively creating a new one. Reuse an idle or already-running agent whose role matches; only spawn a fresh agent when no existing one is a sensible fit, and say that you checked. One capable owner beats a duplicate. (3) OWN ONLY THE IMPORTANT, high-leverage things — task decomposition, dispatch decisions, sign-offs, conflict resolution, branch integration, and final QA — and remain the sole scribe of board.md. You are otherwise fully autonomous — there is NO separate approval queue. For the genuinely critical (destructive actions, spending real money, scope changes, unresolvable conflicts), ask the human directly in your own session and let the tool-permission prompt gate the action; the human approves natively, including remotely from their phone via /remote-control. Keep the team unblocked. When you DISPATCH a task, write it as a 4-part contract so the agent can run autonomously: (1) OBJECTIVE — the concrete goal; (2) OUTPUT — the expected deliverable/format; (3) TOOLS — what to use or avoid, and any references to read instead of re-deriving; (4) BOUNDARIES — scope limits + the definition of done. Pass references (file paths, message ids, board sections), not pasted content — keep dispatches short.'
@@ -3026,8 +3026,8 @@ the hive root:
   "objective": "what the worker must do (required)",
   "cwd": "/absolute/path/to/the/repo (required)",
   "name": "display name (optional)",
-  "command": "engine CLI (optional; defaults to the configured one)",
-  "provider": "claude | codex | cursor | antigravity | … (optional)",
+  "command": "engine CLI (optional; overrides the provider default)",
+  "provider": "claude | codex | cursor | antigravity | … (optional; selects its default CLI when command is omitted)",
   "model": "model override (optional)",
   "isolate": true,
   "tokenCap": 0,
```

**File**: `src/main/workerLaunch.ts` (modified, +18/-4)
```diff
@@ -3,7 +3,13 @@
  * pure function: this exact translation silently killed real workers for days
  * while reporting success, which is what earned it a unit test.
  */
-import { autoModeFlagForProvider, hasAutoModeStance, inferAgentProvider } from '../shared/agentProvider';
+import {
+  autoModeFlagForProvider,
+  defaultCommandForProvider,
+  hasAutoModeStance,
+  inferAgentProvider,
+  normalizeAgentProvider
+} from '../shared/agentProvider';
 import { tokenizeCommand } from '../shared/commandLine';
 
 export interface WorkerLaunch {
@@ -25,10 +31,18 @@ export function buildWorkerLaunch(opts: {
   /** The app's auto (skip-permissions) setting. */
   autoMode: boolean;
 }): WorkerLaunch {
-  let command =
+  const requestCommand =
     typeof opts.requestCommand === 'string' && opts.requestCommand.trim()
       ? opts.requestCommand.trim()
-      : (opts.defaultCommand ?? 'claude');
+      : '';
+  const requestProvider = normalizeAgentProvider(opts.requestProvider);
+  const fallbackCommand = opts.defaultCommand ?? 'claude';
+  // An explicit command may be a wrapper or shim and remains authoritative.
+  // Without one, keep the executable and provider behavior coherent by taking
+  // the provider's canonical command before the configured legacy fallback.
+  let command =
+    requestCommand ||
+    (requestProvider ? defaultCommandForProvider(requestProvider, fallbackCommand) : fallbackCommand);
   // Inherit the app's auto (skip-permissions) mode when the request takes no
   // stance of its own: a headless worker has no human to click through tool
   // prompts, so without the flag it stalls at the first ask until the idle
@@ -38,7 +52,7 @@ export function buildWorkerLaunch(opts: {
   // non-claude worker stalling; review caught it). An explicit stance in the
   // request still wins: the flag's leading token already present as a TOKEN
   // (not substring — copilot's flag starts with `-s`) means the request chose.
-  const provider = inferAgentProvider(command, opts.requestProvider);
+  const provider = inferAgentProvider(command, requestProvider);
   const autoFlag = opts.autoMode ? autoModeFlagForProvider(provider) : '';
   if (autoFlag && !hasAutoModeStance(tokenizeCommand(command), provider)) {
     command += ` ${autoFlag}`;
```

**File**: `test/worker-launch.test.cjs` (modified, +21/-0)
```diff
@@ -91,9 +91,30 @@ test('a multi-token auto flag appends whole, and the stance check is by token',
 
 test("an explicit request provider picks that provider's flag for a custom binary", () => {
   const l = launch({ requestCommand: 'my-codex-wrapper', requestProvider: 'codex', autoMode: true });
+  assert.equal(l.bin, 'my-codex-wrapper');
   assert.deepEqual(l.args, ['-a', 'never', '-s', 'workspace-write']);
 });
 
+test('a missing command resolves from an explicit provider before the configured default', () => {
+  const l = launch({ requestProvider: 'codex', defaultCommand: 'claude', autoMode: true });
+  assert.equal(l.bin, 'codex');
+  assert.deepEqual(l.args, ['-a', 'never', '-s', 'workspace-write']);
+});
+
+test('provider-only resolution honors providers whose auto-mode stance is config-based', () => {
+  const l = launch({ requestProvider: 'opencode', defaultCommand: 'claude', autoMode: true });
+  assert.equal(l.bin, 'opencode');
+  assert.deepEqual(l.args, []);
+});
+
+test('custom and invalid providers preserve the configured command fallback', () => {
+  const custom = launch({ requestProvider: 'custom', defaultCommand: 'company-agent', autoMode: true });
+  assert.equal(custom.bin, 'company-agent');
+  assert.deepEqual(custom.args, []);
+
+  assert.equal(launch({ requestProvider: null, defaultCommand: 'opencode' }).bin, 'opencode');
+});
+
 test('a missing command falls back to the default, then to claude', () => {
   assert.equal(launch({ defaultCommand: 'codex --full-auto' }).bin, 'codex');
   assert.equal(launch({}).bin, 'claude');
```

---

### Incident Patch 14: `a38a8a81` (2026-10-02)
**Commit Message**: Merge pull request #495 from snehithareddy28/fix/hook-socket-health

fix(hooks): make an unbound hook socket loud, self-healing and visible

**File**: `src/main/hooks.ts` (modified, +275/-43)
```diff
@@ -10,8 +10,9 @@
  *
  * Runs in the Electron main process.
  */
-import { createServer, type Server } from 'node:net';
-import { existsSync, rmSync } from 'node:fs';
+import { createServer, createConnection, type Server, type Socket } from 'node:net';
+import { existsSync, rmSync, statSync } from 'node:fs';
+import { randomUUID } from 'node:crypto';
 import { Notification, type WebContents } from 'electron';
 import type { HiveManager } from './hive';
 import type { HarnessConfig } from './config';
@@ -24,6 +25,8 @@ import { validateHookEvent } from '../shared/hookEvents';
 const MAX_HOOK_FRAME_BYTES = 256 * 1024;
 
 interface HookPayload {
+  /** Ownership probe from ensureListening(): answered with { pong, instance }, never a hook. */
+  ping?: string;
   hook_event_name?: string;
   agent_id?: string | null;
   session_id?: string;
@@ -49,8 +52,71 @@ interface HookPayload {
   cache_creation?: number;
 }
 
+/** Live health of the hook socket — the ONE endpoint every lifecycle hook,
+ *  proxy-bridge emit and cost sample travels through. When nothing accepts on
+ *  it the shims' connect() fails and they exit 0 with empty stdout, which the
+ *  CLI reads as "allow": the breaker is inert, fleet.json never appears, no cost
+ *  is recorded — and until #277 nothing said so. The beat writes this into
+ *  fleet.json so an operator (or god) can see it without a debugger. */
+export interface HookSocketHealth {
+  /** HIVE_SOCK — where the shims connect. null while the hive has no root. */
+  path: string | null;
+  /** True only while our server is listening AND (POSIX) the path still
+   *  resolves to the socket we bound — a socket FILE can exist while nothing
+   *  accepts on it, so existence proves nothing. */
+  listening: boolean;
+  /** Epoch ms of the current bind; null when not listening. */
+  since: number | null;
+  /** The last bind/verify failure — 'EADDRINUSE', 'ENOENT', 'REPLACED',
+   *  'NOROOT', … — or null when healthy. */
+  lastError: string | null;
+  /** Bind attempts since the last successful listen (0 when healthy). */
+  attempts: number;
+  /** Listeners this process had to abandon because a stranger took the path
+   *  (see detach()) — a non-zero count is worth a look. */
+  orphans: number;
+}
+
+/** Back-off between automatic re-bind attempts after a failure. Once spent, the
+ *  beat still calls ensureListening() on its own cadence, so the server never
+ *  stops trying — it just stops toasting. */
+const BIND_RETRY_MS = [500, 1_000, 2_000, 4_000, 8_000];
+
+/** Identity of the socket FILE we bound — enough to tell, synchronously, whether
+ *  the path still leads to it (APFS/NTFS never reuse inode numbers). */
+interface FileMark { dev: number; ino: number }
+const markOf = (p: string): FileMark | null => {
+  try { const st = statSync(p); return { dev: st.dev, ino: st.ino }; } catch { return null; }
+};
+const sameMark = (a: FileMark | null, b: FileMark | null): boolean =>
+  !!a && !!b && a.dev === b.dev && a.ino === b.ino;
+
+/** Who answers at the path: nobody (missing, or a stale file from a crashed
+ *  run), a stranger (another live instance — never touched), or us. */
+type PathOwner = 'nobody' | 'other' | 'self';
+
 export class HookServer {
   private server: Server | null = null;
+  /** This process's identity, echoed back by the ownership ping so a probe can
+   *  tell "our listener" from "some other live instance" at the same path. */
+  private readonly instanceId = randomUUID();
+  /** The socket FILE we bound (POSIX), so stop() and the beat can tell our
+   *  socket from one another instance created at the same path (#277). */
+  private mark: FileMark | null = null;
+  private bound: { path: string; since: number } | null = null;
+  /** Listeners abandoned because a stranger owns the path now. Closing one would
+   *  make libuv unlink(2) the PATH — by name, not by inode — and take the
+   *  stranger's live socket with it. Kept unref()ed until the process exits. */
+  private orphans: Server[] = [];
+  private lastError: string | null = null;
+  private bindAttempts = 0;
+  private binding = false;
+  private retryTimer: NodeJS.Timeout | null = null;
+  /** One toast per outage, not one per retry. */
+  private alerted = false;
+  /** Set by stop(): the beat must not re-bind while the hive is being moved or
+   *  the app is quitting — only start() re-arms. */
+  private stopped = false;
   /** agentId → the live session's transcript file, learned from hook payloads.
    *  Lets the harness read per-agent telemetry (e.g. current context size)
    *  even when several agents share one cwd. */
@@ -86,55 +152,221 @@ export class HookServer {
     private onEvent?: (agentId: string | undefined, event: string, message: string | undefined) => void
   ) {}
 
+  /** Bind the hook socket. Asynchronous and safe to call repeatedly — a
+   *  listening server is left alone. Before #277 this returned SILENTLY when the
+   *  hive had no root yet, and left the outcome
```

**File**: `src/main/index.ts` (modified, +11/-1)
```diff
@@ -1320,7 +1320,9 @@ function writeFleetSnapshot(): void {
           onHold: !!a.onHold
         };
       });
-    hive.writeFleetSnapshot({ ts: now, agents });
+    // `hooks` is the control plane's own health (#277): god and the operator
+    // can read from fleet.json whether hooks are being enforced at all.
+    hive.writeFleetSnapshot({ ts: now, agents, hooks: hookServer.health() });
   } catch (e) {
     console.error('[fleet] snapshot failed:', e);
   }
@@ -5159,7 +5161,10 @@ function bootstrapHiveServices(): void {
 /** Cadence of the worker inbox-wake watchdog (#151). Well under the renderer's
  *  own nudge cooldown so a throttled window is caught within ~15s of a stall. */
 const WORKER_WAKE_POLL_MS = 15_000;
+/** How often the beat verifies the hook socket is bound AND still ours (#277). */
+const HOOK_HEALTH_MS = 15_000;
 let workerWakeTimer: ReturnType<typeof setInterval> | null = null;
+let hookHealthTimer: ReturnType<typeof setInterval> | null = null;
 
 /** Type the renderer's guarded nudge into one worker's PTY — text first, Enter a
  *  tick later (the exact submitToPty pattern: a single-chunk write would land the
@@ -5271,6 +5276,11 @@ function armAlwaysOnBeats(): void {
   if (workerWakeTimer) clearInterval(workerWakeTimer);
   workerWakeTimer = setInterval(() => { try { runWorkerWakeBeat(); } catch (e) { console.error('[worker-wake beat]', e); } }, WORKER_WAKE_POLL_MS);
   runWorkerWakeBeat(); // catch-up on arm — power-resume re-arms and drains the backlog
+  // The hook socket is the whole control plane; a session where it is silently
+  // unbound looks exactly like "no workers have spawned yet" (#277). Verify it
+  // — bound, and the path still ours — and re-bind when it is not.
+  if (hookHealthTimer) clearInterval(hookHealthTimer);
+  hookHealthTimer = setInterval(() => { hookServer.ensureListening().catch((e) => console.error('[hooks beat]', e)); }, HOOK_HEALTH_MS);
 }
 
 /** Wall-clock instant we last observed the machine suspend or lock, so a resume
```

**File**: `test/hooks-framing.test.cjs` (modified, +6/-2)
```diff
@@ -146,7 +146,9 @@ test('oversized incomplete frame is rejected without routing a payload', async (
   assert.equal(result.didClose, true, 'server retained an oversized incomplete frame');
   assert.deepEqual(routed, []);
   assert.equal(result.response, '');
-  assert.deepEqual(logs, [{
+  // The server also records its own bind in the same log (#277); only the
+  // rejection entries are this test's concern.
+  assert.deepEqual(logs.filter((l) => l.kind === 'hook-frame-rejected'), [{
     kind: 'hook-frame-rejected',
     reason: 'frame-too-large',
     bytes: MAX_HOOK_FRAME_BYTES + 1,
@@ -175,7 +177,9 @@ test('payload one byte above the limit is rejected', async (t) => {
   assert.equal(result.didClose, true);
   assert.deepEqual(routed, []);
   assert.equal(result.response, '');
-  assert.deepEqual(logs, [{
+  // The server also records its own bind in the same log (#277); only the
+  // rejection entries are this test's concern.
+  assert.deepEqual(logs.filter((l) => l.kind === 'hook-frame-rejected'), [{
     kind: 'hook-frame-rejected',
     reason: 'frame-too-large',
     bytes: MAX_HOOK_FRAME_BYTES + 1,
```

**File**: `test/hooks-socket.test.cjs` (added, +193/-0)
```diff
@@ -0,0 +1,193 @@
+'use strict';
+/**
+ * The hook socket (HIVE_SOCK) is the ONE endpoint every lifecycle hook, proxy
+ * emit and cost sample travels through. Upstream issue #277: it was silently
+ * unbound for a whole session — the app was up, `hooks.sock` did not exist,
+ * every hook's connect() failed and exited 0 (which the CLI reads as "allow"),
+ * fleet.json never appeared, and NOTHING was logged. These tests pin down the
+ * behaviour that makes that impossible to miss, and closes the one way we know
+ * a live socket can vanish under a running app:
+ *   1. a successful bind is reported (console + log.jsonl + fleet-visible health);
+ *   2. a failed bind is reported and retried, and toasts once the back-off is spent;
+ *   3. stop() removes only the socket file IT bound — never another instance's
+ *      (an old instance hanging on quit + a relaunch is the #277 shape);
+ *   4. the beat re-binds when the socket file disappears under a listening server;
+ *   5. the beat never steals a socket another live server owns;
+ *   6. a hive with no root yet is not silent either.
+ */
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const net = require('node:net');
+const os = require('node:os');
+const path = require('node:path');
+const loadTs = require('./load-ts.cjs');
+
+const electron = require.resolve('electron');
+const toasts = [];
+require.cache[electron] = {
+  id: electron, filename: electron, loaded: true,
+  exports: {
+    Notification: class {
+      constructor(opts) { this.opts = opts; }
+      show() { toasts.push(this.opts); }
+      static isSupported() { return true; }
+    }
+  }
+};
+
+const { HiveManager } = loadTs('src/main/hive.ts');
+const { HookServer } = loadTs('src/main/hooks.ts');
+const CONFIG = { notifications: true };
+
+const posixOnly = { skip: process.platform === 'win32' ? 'named pipes have no socket file' : false };
+
+async function floor(t) {
+  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mdh-'));
+  const hive = new HiveManager(() => home);
+  await hive.ensureAgent({ id: 'jim-1', name: 'Jim', provider: 'claude', cwd: home });
+  const servers = [];
+  const make = () => { const s = new HookServer(hive, () => null, () => CONFIG, undefined, undefined); servers.push(s); return s; };
+  t.after(() => { for (const s of servers) { try { s.stop(); } catch { /* noop */ } } fs.rmSync(home, { recursive: true, force: true }); });
+  toasts.length = 0;
+  return { home, hive, make, sock: hive.sockPath() };
+}
+
+/** What a shim does: connect, send one JSON line, read the reply. */
+function roundTrip(sock, payload = { hook_event_name: 'Unknown', agent_id: 'jim-1' }) {
+  return new Promise((resolve, reject) => {
+    const c = net.createConnection(sock, () => c.write(JSON.stringify(payload) + '\n'));
+    let resp = '';
+    c.setEncoding('utf8');
+    c.on('data', (d) => { resp += d; });
+    c.on('end', () => resolve(resp));
+    c.on('error', reject);
+  });
+}
+
+function hookLog(hive) {
+  const p = path.join(hive.root(), 'log.jsonl');
+  if (!fs.existsSync(p)) return [];
+  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.kind === 'hooks');
+}
+
+const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
+/** Poll until `fn()` is truthy (start() binds asynchronously). */
+async function waitFor(fn, ms = 3000) {
+  const until = Date.now() + ms;
+  while (Date.now() < until) { if (fn()) return true; await sleep(20); }
+  return false;
+}
+
+test('a successful bind is reported: log.jsonl, health, and a shim round-trip', async (t) => {
+  const { hive, make, sock } = await floor(t);
+  const a = make();
+  a.start();
+  assert.ok(await waitFor(() => fs.existsSync(sock)), 'socket file appears');
+  assert.equal(await roundTrip(sock), '{}', 'a shim gets a JSON reply');
+  const log = hookLog(hive);
+  assert.deepEqual(log.map((e) => e.state), ['listening'], 'the bind is recorded where an operator can find it');
+  assert.equal(log[0].path, sock);
+  const h = a.health();
+  assert.equal(h.listening, true, JSON.stringify(h));
+  assert.equal(h.path, sock);
+  assert.equal(h.lastError, null);
+  assert.equal(h.attempts, 0);
+  assert.equal(h.orphans, 0);
+  assert.ok(typeof h.since === 'number');
+});
+
+test('a failed bind is loud and retried, and toasts once the back-off is spent', async (t) => {
+  const { home } = await floor(t);
+  const logs = [];
+  // A hive whose socket path cannot be bound (its directory does not exist).
+  const hive = { sockPath: () => path.join(home, 'nope', 'hooks.sock'), appendLog: (e) => logs.push(e) };
+  const a = new HookServer(hive, () => null, () => CONFIG, undefined, undefined);
+  t.after(() => a.stop());
+  const h = await a.ensureListening();
+  assert.equal(h.listening, false);
+  assert.ok(['ENOENT', 'EACCES'].includes(h.lastError), JSON.stringify(h)); // macOS says EACCES for a missing dir
+  assert
```

---

### Incident Patch 15: `6f406b9d` (2026-10-02)
**Commit Message**: Merge pull request #474 from HsienW/fix/hive-generated-doc-refresh

fix(hive): avoid rewriting generated docs during runtime operations

**File**: `src/main/hive.ts` (modified, +27/-13)
```diff
@@ -621,13 +621,10 @@ export class HiveManager {
     if (!root) return;
     mkdirSync(join(root, 'agents'), { recursive: true });
 
-    // Refreshed each bootstrap, like COMMANDS.md just below. It used to be
-    // written only when absent, which meant a hive created once never saw a
-    // protocol change again: this repo's own hive still carried the file from
-    // the day it was initialised, so every protocol addition since had reached
-    // new hives only. The file is generated, not user-authored, and agents are
-    // pointed at it as the authority, so a stale copy is worse than a rewrite.
-    writeFileSync(join(root, 'PROTOCOL.md'), PROTOCOL_MD, 'utf8');
+    for (const { filename, contents } of GENERATED_HIVE_DOCS) {
+      const path = join(root, filename);
+      if (!existsSync(path)) writeFileSync(path, contents, 'utf8');
+    }
 
     const registry = join(root, 'registry.json');
     if (!existsSync(registry)) {
@@ -649,10 +646,6 @@ export class HiveManager {
     const log = join(root, 'log.jsonl');
     if (!existsSync(log)) writeFileSync(log, '', 'utf8');
 
-    // The Claude Code command reference Michael consults (refreshed each bootstrap
-    // so it tracks the bundled list).
-    writeFileSync(join(root, 'COMMANDS.md'), COMMANDS_MD, 'utf8');
-
     // Keep the churny/ephemeral live files out of the hive git repo.
     const gitignore = join(root, '.gitignore');
     // `crashes/` holds raw PTY output from abnormal agent exits. It is
@@ -684,6 +677,15 @@ export class HiveManager {
     }
   }
 
+  /** Deliberately replace generated hive docs with the bundled versions. */
+  refreshGeneratedDocs(): void {
+    const root = this.root();
+    if (!root) return;
+    for (const { filename, contents } of GENERATED_HIVE_DOCS) {
+      writeFileSync(join(root, filename), contents, 'utf8');
+    }
+  }
+
   /** Validate an agent's cwd the way a spawn does — it must be an ABSOLUTE path
    *  that exists as a directory. Surfaced as `cwdValid` on the registry entry so
    *  the roster reliably exposes whether a worker's working directory is usable.
@@ -2883,14 +2885,19 @@ export class HiveManager {
   }
 }
 
-// ─── PROTOCOL.md (written into the hive, readable by every agent) ────────────
+// ─── Generated hive docs (written into the hive for every agent) ─────────────
+
+const GENERATED_DOC_NOTICE =
+  '<!-- Generated and managed by Munder Difflin. Local edits may be replaced during hive bootstrap. -->';
 
 /** The Claude Code command reference written to <hive>/COMMANDS.md, rendered from
  *  the SAME source as the UI "commands" tab so they never drift. Leads with the
  *  orchestrator note: slash = own session only, cli = shell/fleet; monitor
  *  siblings via fleet.json (claude agents does NOT see them). */
 function renderCommandsMd(): string {
   const lines: string[] = [
+    GENERATED_DOC_NOTICE,
+    '',
     '# Claude Code commands',
     '',
     'Reference of the Claude Code commands available to you. Two kinds:',
@@ -2911,7 +2918,9 @@ function renderCommandsMd(): string {
 }
 const COMMANDS_MD = renderCommandsMd();
 
-const PROTOCOL_MD = `# Hive protocol
+const PROTOCOL_MD = `${GENERATED_DOC_NOTICE}
+
+# Hive protocol
 
 You are one of several Claude agents sharing this hive. Coordination is entirely
 file-based; the harness (main process) is the only thing that runs git and the
@@ -3056,6 +3065,11 @@ Your \`memory.md\` is mined into the palace automatically, so the durable facts
 write there become searchable by every agent. You don't run \`mine\` yourself.
 `;
 
+const GENERATED_HIVE_DOCS = [
+  { filename: 'PROTOCOL.md', contents: PROTOCOL_MD },
+  { filename: 'COMMANDS.md', contents: COMMANDS_MD }
+] as const;
+
 // ─── cth-hook shim (written to <hive>/bin/cth-hook.cjs) ──────────────────────
 // A minimal pipe: read the hook payload on stdin, tag it with this agent's id,
 // forward it to the hive's UDS, and relay the response back to `claude`. All the
```

**File**: `src/main/index.ts` (modified, +1/-0)
```diff
@@ -5098,6 +5098,7 @@ ipcMain.handle('workers:stop', (_evt, workerId: string): { ok: boolean; error?:
 function bootstrapHiveServices(): void {
   if (!hive.enabled()) return;
   hive.ensureHive();
+  hive.refreshGeneratedDocs();
   // Tell the hive what it is running inside, BEFORE anything spawns: the prompt
   // builder reads this, so an agent spawned earlier would never learn it.
   hive.setRuntimeInfo({ version: app.getVersion(), packaged: app.isPackaged, appPath: app.getAppPath() });
```

**File**: `test/hive-generated-docs.test.cjs` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+'use strict';
+
+/**
+ * Generated hive documents are refreshed during hive-service bootstrap, not as a
+ * side effect of ordinary task or agent mutations. These regressions exercise the
+ * public HiveManager paths and pin the main-process bootstrap wiring without
+ * starting Electron, a PTY, or a CLI.
+ */
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+const loadTs = require('./load-ts.cjs');
+
+const { HiveManager } = loadTs('src/main/hive.ts');
+
+const GENERATED_NOTICE_PREFIX = '<!-- Generated and managed by Munder Difflin.';
+const GENERATED_DOCS = [
+  { filename: 'PROTOCOL.md', sentinel: 'PROTOCOL_SENTINEL\n', heading: '# Hive protocol' },
+  { filename: 'COMMANDS.md', sentinel: 'COMMANDS_SENTINEL\n', heading: '# Claude Code commands' }
+];
+
+function floor(t) {
+  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-generated-docs-'));
+  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
+  const hive = new HiveManager(() => home);
+  hive.ensureHive();
+  return { hive, root: path.join(home, 'hive') };
+}
+
+function writeSentinels(root) {
+  for (const { filename, sentinel } of GENERATED_DOCS) {
+    fs.writeFileSync(path.join(root, filename), sentinel, 'utf8');
+  }
+}
+
+function assertSentinels(root) {
+  for (const { filename, sentinel } of GENERATED_DOCS) {
+    assert.equal(fs.readFileSync(path.join(root, filename), 'utf8'), sentinel);
+  }
+}
+
+function readGeneratedDoc(root, filename) {
+  return fs.readFileSync(path.join(root, filename), 'utf8');
+}
+
+function assertGenerated(root, docs = GENERATED_DOCS) {
+  for (const { filename, heading } of docs) {
+    const contents = readGeneratedDoc(root, filename);
+    assert.equal(contents.startsWith(GENERATED_NOTICE_PREFIX), true);
+    assert.equal(contents.split('\n').includes(heading), true);
+  }
+}
+
+test('writeTasks preserves existing generated hive docs', (t) => {
+  const { hive, root } = floor(t);
+  writeSentinels(root);
+
+  hive.writeTasks([]);
+
+  assertSentinels(root);
+});
+
+test('ensureAgent preserves existing generated hive docs', async (t) => {
+  const { hive, root } = floor(t);
+  writeSentinels(root);
+
+  await hive.ensureAgent({ id: 'agent-1', name: 'Agent', provider: 'claude', cwd: root });
+
+  assertSentinels(root);
+});
+
+test('refreshGeneratedDocs replaces stale generated hive docs', (t) => {
+  const { hive, root } = floor(t);
+  writeSentinels(root);
+
+  hive.refreshGeneratedDocs();
+
+  for (const { filename, sentinel } of GENERATED_DOCS) {
+    assert.equal(readGeneratedDoc(root, filename).includes(sentinel), false);
+  }
+  assertGenerated(root);
+});
+
+test('hive-service bootstrap refreshes generated hive docs', () => {
+  const source = fs.readFileSync(path.join(__dirname, '..', 'src/main/index.ts'), 'utf8');
+  const bootstrapBody = source.match(/function bootstrapHiveServices\(\): void \{([\s\S]*?)^\}/m)?.[1];
+
+  assert.ok(bootstrapBody, 'bootstrapHiveServices() is missing');
+  assert.match(
+    bootstrapBody,
+    /hive\.ensureHive\(\);\s*hive\.refreshGeneratedDocs\(\);/,
+    'bootstrapHiveServices() must refresh generated docs after ensuring the hive'
+  );
+  assert.equal(
+    source.match(/hive\.refreshGeneratedDocs\(\);/g)?.length,
+    1,
+    'refreshGeneratedDocs() must have one production caller'
+  );
+});
+
+test('ensureHive restores missing generated hive docs', (t) => {
+  const { hive, root } = floor(t);
+  for (const { filename } of GENERATED_DOCS) fs.rmSync(path.join(root, filename));
+
+  hive.ensureHive();
+
+  assertGenerated(root);
+});
+
+test('ensureHive restores only the missing generated hive doc', (t) => {
+  const { hive, root } = floor(t);
+  const [missing, preserved] = GENERATED_DOCS;
+  fs.rmSync(path.join(root, missing.filename));
+  fs.writeFileSync(path.join(root, preserved.filename), preserved.sentinel, 'utf8');
+
+  hive.ensureHive();
+
+  assertGenerated(root, [missing]);
+  assert.equal(readGeneratedDoc(root, preserved.filename), preserved.sentinel);
+});
```

#### Recent Merged Pull Requests:
- **PR #700** (2026-10-05): blog: bright scenes without the cast for How to use Claude Code (@chaitanyagiri)
- **PR #699** (2026-10-05): seo-engine: day 08 PM, three pages with coded scenes + Codex plan fact fix (@chaitanyagiri)
- **PR #698** (closed): blog: shared scene kit for coded motion graphics (@chaitanyagiri)
- **PR #693** (2026-10-04): blog: ASD-STE100 prompting, Karpathy's 4 tricks, with coded motion graphics (@chaitanyagiri)
- **PR #692** (2026-10-04): seo-engine: day 07, Agent Tools Today daily brief for 4 Oct (@chaitanyagiri)
- **PR #691** (2026-10-04): site: serve the favicon by URL so Google shows the logo in search results (@chaitanyagiri)
- **PR #679** (2026-10-04): seo-engine: day 06 PM, What is Gemini Spark + What is Claude Cowork, ChatGPT Dots title fix (@chaitanyagiri)
- **PR #675** (2026-10-03): seo-engine: day 06 AM, first Agent Tools Today daily brief + What is Hermes Agent (@chaitanyagiri)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
