# Forensic Learning Record (Deep Inspection): Chorus-AIDLC/Chorus

> **Canonical Artifact**: `07_PROJECT_LEARNING/chorus-aidlc-chorus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Chorus-AIDLC/Chorus](https://github.com/Chorus-AIDLC/Chorus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:18:52.878Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Chorus-AIDLC/Chorus`
- **Description**: The Agent Harness for AI-Human Collaboration, inspired by the AI-DLC (AI-Driven Development Lifecycle)
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 1191 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/daemon-lifecycle.mjs`
```
// cli/daemon-lifecycle.mjs
// Background (`-d`) run + lifecycle subcommands (stop/status/restart/logs) for
// `chorus daemon`. Pure Node, cross-platform, NO native dependencies and NO
// `shell:true` — mirrors the platform-gated spawn approach in claude-spawner.mjs
// (POSIX detached process-group leader + unref + stdio→logfile; Windows
// windowsHide, no new console). All IO is injectable so both platform branches
// are unit-testable from a single host.
//
// State files live alongside the credentials in ~/.chorus:
//   pidfile  ~/.chorus/daemon.pid   (JSON {pid, startedAt?, argsHint?}; legacy
//                                    bare-number files from older CLIs still read)
//   logfile  ~/.chorus/daemon.log   (its redirected stdout+stderr)

import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Default IO bundle — overridable per-call for tests (no real disk/process). */
function defaultIO() {
  return {
    existsSync,
    mkdirSync,
    openSync,
    readFileSync,
    unlinkSync,
    writeFileSync,
    spawn,
    spawnSync,
    // process.kill with signal 0 is the portable liveness probe (no signal sent).
    kill: (pid, sig) => process.kill(pid, sig),
    platform: process.platform,
    home: homedir(),
  };
}

/** ~/.chorus/daemon.pid */
export function pidFilePath(io = defaultIO()) {
  return join(io.home ?? homedir(), ".chorus", "daemon.pid");
}

/** ~/.chorus/daemon.log */
export function logFilePath(io = defaultIO()) {
  return join(io.home ?? homedir(), ".chorus", "daemon.log");
}

/**
 * The cmdline marker every legacy (pre-identity) chorus daemon carries — the
 * fallback identity check when the pidfile recorded no argsHint.
 */
const DAEMON_CMD_MARKER = "daemon";

/**
 * Read the recorded pidfile as a structured record, or null when absent /
 * unreadable / malformed. Two on-disk formats:
 *   - JSON `{pid, startedAt?, argsHint?}` (current — written by startBackground)
 *   - bare pid number (legacy — pre-identity CLIs) → `{ pid, legacy: true }`
 * @param {object} [io]
 * @returns {{ pid: number, startedAt?: string, argsHint?: string, legacy?: boolean }|null}
 */
export function readPidRecord(io = defaultIO()) {
  const path = pidFilePath(io);
  try {
    if (!io.existsSync(path)) return null;
    const raw = String(io.readFileSync(path, "utf8")).trim();
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      const pid = Number.parseInt(String(parsed.pid), 10);
      if (!Number.isInteger(pid) || pid <= 0) return null;
      const record = { pid };
      if (typeof parsed.startedAt === "string" && parsed.startedAt) record.startedAt = parsed.startedAt;
      if (typeof parsed.argsHint === "string" && parsed.argsHint) record.argsHint = parsed.argsHint;
      return record;
    }
    const pid = Number.parseInt(raw, 10);
    return Number.isInteger(pid) && pid > 0 ? { pid, legacy: true } : null;
  } catch {
    return null;
  }
}

/**
 * Read the recorded pid, or null when absent / unreadable / malformed.
 * Thin compatibility wrapper over readPidRecord.
 * @param {object} [io]
 * @returns {number|null}
 */
export function readPid(io = defaultIO()) {
  return readPidRecord(io)?.pid ?? null;
}

/**
 * Query the identity (command line + start time) of the process currently
 * occupying `pid`. One subprocess invocation, argument arrays only (no
 * `shell:true`), pure JS:
 *   - POSIX: `ps -p <pid> -o lstart=,args=` (lstart is second-resolution and
 *     stable across probes of the same process). busybox `ps` rejects `-p` and
 *     `-o lstart` → retry `ps -o pid=,args=` (full-table) and filter by the
 *     pid column for cmdline-only verification.
 *   - Windows: PowerShell `Get-CimInstance Win32_Process` (wmic is deprecated).
 * @param {number} pid @param {object} [io]
 * @returns {{ cmdline: string, startedAt: string|null }|null} null = query failed
 */
export function queryProcessIdentity(pid, io = defaultIO()) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    if (io.platform === "win32") {
      const r = io.spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' | Select-Object CommandLine,CreationDate | ConvertTo-Json`,
        ],
        { encoding: "utf8", windowsHide: true }
      );
      if (!r || r.status !== 0 || !r.stdout) return null;
      const parsed = JSON.parse(r.stdout);
      if (!parsed || typeof parsed.CommandLine !== "string") return null;
      return { cmdline: parsed.CommandLine, startedAt: parsed.CreationDate ? String(parsed.CreationDate) : null };
    }
    // POSIX: lstart= + args= in one call. Output shape (no headers):
    //   "Thu Jul  2 21:22:55 2026 /usr/bin/node /x/chorus.mjs daemon"
    // lstart is a fixed 5-field prefix (dow mon dd hh:mm:ss yyyy).
    const full = io.spawnSync("ps", ["-p", String(pid), "-o", "lstart=,args="], { encoding: "utf8" });
    if (full && full.status === 0 && full.stdout && full.stdout.trim()) {
      const line = full.stdout.trim();
      const fields = line.split(/\s+/);
      if (fields.length >= 6) {
        const startedAt = fields.slice(0, 5).join(" ");
        const cmdline = fields.slice(5).join(" ");
        if (cmdline) return { cmdline, startedAt };
      }
    }
    // busybox fallback: busybox ps rejects -p AND -o lstart (it only knows -o
    // and -T), so list every process as "pid args" and filter by the pid
    // column ourselves. Cmdline verification still possible; no start time.
    const argsOnly = io.spawnSync("ps", ["-o", "pid=,args="], { encoding: "utf8" });
    if (argsOnly && argsOnly.status === 0 && argsOnly.stdout) {
      for (const line of argsOnly.stdout.split("\n")) {
        const m = line.trim().match(/^(\d+)\s+(.+)$/);
        if (m && Number.parseInt(m[1], 10) === pid) {
          return { cmdline: m[2].trim(), startedAt: null };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Is the process recorded by `record` still OUR live daemon? Identity-verified
 * probe (fix-daemon-stale-pid-identity): pid existence alone is not enough —
 * after a reboot the OS recycles pids, and a foreign owner surfaces as EPERM,
 * which the old probe misread as "daemon alive". Decision table (tech design):
 *   - ESRCH / invalid pid                → false (stale)
 *   - pid exists (OK or EPERM):
 *       identity recorded    → argsHint (when recorded) decides ALONE: cmdline
 *                              contains it → true, else false. startedAt only
 *                              decides when no argsHint was recorded; query
 *                              failed → true (never auto-clean an identity we
 *                              could not verify)
 *       legacy record        → cmdline contains the daemon marker → true;
 *                              foreign cmdline → false; query failed → EPERM
 *                              proves it is not ours (same-user daemon) → false,
 *                              while a signalable pid stays conservatively true
 * Accepts a bare pid (number) for backward compatibility → treated as legacy.
 * @param {number|{pid:number,startedAt?:string,argsHint?:string,legacy?:boolean}} record
 * @param {object} [io]
 */
export function processAlive(record, io = defaultIO()) {
  const rec = typeof record === "number" ? { pid: record, legacy: true } : record;
  if (!rec || !Number.isInteger(rec.pid) || rec.pid <= 0) return false;
  let eperm = false;
  try {
    io.kill(rec.pid, 0);
  } catch (err) {
    if (!err || err.code !== "EPERM") return false;
    eperm = true;
  }
  // The pid exists. Verify the occupant is still our daemon.
  const identity = queryProcessIdentity(rec.pid, io);
  const hasRecordedIdentity = Boolean(rec.startedAt || rec.argsHint);
  if (hasRecordedIdentity) {
    if (identity === null) return true; // unverifiable → conservative: running
    // Collapse whitespace on both sides: the ps parse re-joins fields with
    // single spaces, so an argsHint containing consecutive spaces must not
    // read as a mismatch (false-stale is the dangerous direction).
    const liveCmd = identity.cmdline.replace(/\s+/g, " ");
    const hint = rec.argsHint ? rec.argsHint.replace(/\s+/g, " ") : null;
    // argsHint decides ALONE when recorded (fix-daemon-stop-ntp-false-stale):
    // startedAt strings are clock-derived (POSIX lstart is recomputed from
    // btime + start ticks at query time), so an NTP step after spawn shifts
    // them for the SAME process — it must never veto a matching argsHint, or
    // a boot-autostarted daemon becomes unstoppable once chrony corrects the
    // clock. startedAt still decides for records without an argsHint.
    if (hint) return liveCmd.includes(hint);
    if (rec.startedAt && identity.startedAt !== null && identity.startedAt !== rec.startedAt) return false;
    return true;
  }
  // Legacy record (no identity metadata): cmdline-marker fallback.
  if (identity === null) {
    // EPERM on a legacy record already proves the process belongs to another
    // user — the CLI and daemon always run as the same user (q3=a self-heal,
    // covers busybox systems where ps cannot report identity).
    return !eperm;
  }
  return identity.cmdline.includes(DAEMON_CMD_MARKER);
}

/**
 * Current daemon status from the pidfile.
 * @param {object} [io]
 * @returns {{ running: boolean, pid: number|null, stale: boolean }}
 *   `stale` = a pidfile exists but its pid is dead OR its identity no longer
 *   matches (pid recycled after a reboot / crash).
 */
export function isRunning(io = defaultIO()) {
  const record = readPidRecord(io);
  if (record == null) return { running: false, pid: null, stale: false };
  const alive = processAlive(record, io);
  return { running: alive, pid: recor
```

### Core Architecture Module: `cli/process-stop-hooks.mjs`
```
// Process-local capabilities: never serialized into execution snapshots.
const hooks = new WeakMap();

export function registerProcessStopHook(child, hook) {
  hooks.set(child, hook);
  return () => {
    if (hooks.get(child) === hook) hooks.delete(child);
  };
}

export function getProcessStopHook(child) {
  return child && hooks.get(child);
}

```

### Core Architecture Module: `cli/upload-hooks.mjs`
```
// cli/upload-hooks.mjs
// Execution-state upload hook for the daemon's observability layer
// (daemon-execution-state spec, design.md "Implementation Plan" step 3).
//
// The daemon already knows, in process memory, which tasks it is running and
// which are queued (the WakeQueue's scheduling state, joined with the waker's
// per-task lineage map). This module turns that into the snapshot the server's
// ingest endpoint expects and POSTs it:
//
//   POST /api/daemon/execution-state
//   { connectionUuid, executions: [{ taskUuid, rootIdeaUuid|null, status, startedAt|null }] }
//
// Reuses global fetch (Node 18+) and the daemon's existing Bearer credentials —
// exactly like lineage.mjs / sse-listener.mjs — so it adds ZERO new dependency
// (CLAUDE.md pitfall #9), no shell-out, no platform-specific paths. The POST is
// fire-and-forget: it never blocks or breaks the wake path, and a failed upload
// is LOGGED (no silent errors) and non-fatal — it never throws to the caller.
//
// `status` is constrained to "running"/"queued"; "ended" is a server-only
// terminal state the daemon never reports (the server rejects it).
//
// Transport: both the transcript POST and the execution-state POST go through the SHARED
// daemon REST client (`cli/daemon-rest-client.mjs`), which owns the request, Bearer auth,
// and the no-silent-errors transport contract. These hooks keep only the host-side
// concerns the client does not own — batching/debounce + content extraction for the
// transcript, and the snapshot build + serialized fire-and-forget chaining for both.

import { createDaemonRestClient } from "./daemon-rest-client.mjs";

const NOOP_LOGGER = { info() {}, warn() {}, error() {} };

/**
 * @typedef {Object} SnapshotExecution
 * @property {string} taskUuid
 * @property {string|null} [rootIdeaUuid]   null for a task with no root-idea lineage.
 * @property {"running"|"queued"} status
 * @property {string|null} [startedAt]      ISO-8601; null while merely queued.
 */

/**
 * @typedef {Object} UploadHooks
 * @property {(info: { host: string, agentUuid?: string }) => Promise<void>} onConnect
 * @property {(info: { rootIdeaKey: string, sessionId: string, isNew: boolean }) => Promise<void>} onSessionStart
 * @property {(info: { rootIdeaKey: string, sessionId: string, message: any }) => Promise<void>} onTranscriptMessage
 * @property {(info: { sessionId: string }) => Promise<{ relayError: string|null, usage: TokenUsage|null }>} [onSessionEnd]
 *   Fire-and-forget + await-able: the wake's subprocess has exited. FLUSH any buffered
 *   (debounced) transcript for the session NOW and await it, so a turn's trailing
 *   user/assistant text is persisted BEFORE the waker advances the turn to a terminal
 *   status (fix #444 — transcript-relay flush-on-exit). Best-effort + non-throwing.
 *   RETURNS `{ relayError, usage }`:
 *     • `relayError` — the final terminal upload failure reason for this session (retry
 *       exhausted / non-2xx / network) when the reply was produced but never reached
 *       Chorus, else `null` (a later success clears it). The waker forwards it onto the
 *       exit-path turn-advance so the UI can say "reply couldn't be uploaded (reason)"
 *       rather than the misleading "no reply received".
 *     • `usage` — the turn's authoritative per-turn {@link TokenUsage} (daemon-token-usage),
 *       or `null` when the run emitted no `result` frame. The waker forwards it onto the
 *       same terminal turn-advance so the server persists it.
 *   No-op (`{ relayError: null, usage: null }`) in the noop hooks and the execution-only hooks.
 * @property {() => void} [onExecutionChange]  Fire-and-forget: upload a fresh
 *   execution snapshot. The waker calls this on every lifecycle transition
 *   (enqueue / wake start / wake finish). No-op in the noop hooks.
 */

/**
 * The default no-op hooks. Each resolves immediately and does nothing — no
 * network, no disk. Used in tests and as a safe default where execution upload
 * is not wired (e.g. the daemon could not learn its connectionUuid).
 * @returns {UploadHooks}
 */
export function createNoopUploadHooks() {
  return {
    async onConnect() {},
    async onSessionStart() {},
    async onTranscriptMessage() {},
    async onSessionEnd() {
      return { relayError: null, usage: null };
    },
    onExecutionChange() {},
  };
}

/**
 * Compose several `UploadHooks` into one. The waker takes a SINGLE hooks object, but
 * the daemon now has two independent concerns — execution-state snapshots and
 * transcript relay — each built by its own factory. This merges them so each named
 * hook fans out to every set that defines it: `onSessionStart`/`onTranscriptMessage`
 * route to the transcript hooks, `onExecutionChange` to the execution hooks, etc. Async
 * hooks are awaited (all in parallel); the synchronous `onExecutionChange` is called
 * directly. Each delegate is invoked inside its own try/catch so one set throwing can
 * never break another or the wake path (warn-not-throw).
 *
 * @param {...(UploadHooks|undefined|null)} hookSets
 * @param {{ logger?: { warn(m:string):void } }} [optsLast]  Last arg may be an options
 *   object (logger). Distinguished from a hook set by the absence of hook methods.
 * @returns {UploadHooks}
 */
export function mergeUploadHooks(...args) {
  // Allow an optional trailing `{ logger }` options object.
  let logger = NOOP_LOGGER;
  const sets = [];
  for (const a of args) {
    if (!a) continue;
    const looksLikeHooks =
      typeof a.onConnect === "function" ||
      typeof a.onSessionStart === "function" ||
      typeof a.onTranscriptMessage === "function" ||
      typeof a.onSessionEnd === "function" ||
      typeof a.onExecutionChange === "function";
    if (!looksLikeHooks && a.logger) {
      logger = a.logger;
      continue;
    }
    sets.push(a);
  }

  async function fanOutAsync(name, info) {
    const results = await Promise.all(
      sets.map(async (s) => {
        const fn = s[name];
        if (typeof fn !== "function") return undefined;
        try {
          return await fn.call(s, info);
        } catch (err) {
          logger.warn(`[Chorus] ${name} hook failed: ${err}`);
          return undefined;
        }
      })
    );
    return results;
  }

  return {
    // The void-returning hooks discard the internal results array (they resolve to
    // `undefined`, matching the single-hook contract — nothing downstream reads them).
    onConnect: async (info) => {
      await fanOutAsync("onConnect", info);
    },
    onSessionStart: async (info) => {
      await fanOutAsync("onSessionStart", info);
    },
    onTranscriptMessage: async (info) => {
      await fanOutAsync("onTranscriptMessage", info);
    },
    // Fan out to every set, then AGGREGATE the transcript relay outcome + the token usage:
    // the first set that reports a non-null `relayError` wins, and independently the first
    // that reports a non-null `usage` wins (only the transcript hook produces either; others
    // resolve nulls or undefined). The waker forwards BOTH onto the exit-path turn-advance
    // (fix #444 relay drop + daemon-token-usage). Aggregated independently so one being null
    // never suppresses the other.
    onSessionEnd: async (info) => {
      const results = await fanOutAsync("onSessionEnd", info);
      const relayError =
        results.find((r) => r && r.relayError)?.relayError ?? null;
      const usage = results.find((r) => r && r.usage)?.usage ?? null;
      return { relayError, usage };
    },
    onExecutionChange: () => {
      for (const s of sets) {
        if (typeof s.onExecutionChange !== "function") continue;
        try {
          s.onExecutionChange();
        } catch (err) {
          logger.warn(`[Chorus] onExecutionChange hook failed: ${err}`);
        }
      }
    },
  };
}

// ─── Transcript upload (子1 — daemon-session-conversation) ──────────────────
//
// The daemon's stream-json consumer (claude-spawner → waker.onMessage) hands every
// NDJSON object to `onTranscriptMessage`. Claude Code's stream-json (verified against
// CLI 2.1.183) wraps each conversation message as:
//
//   { "type": "assistant" | "user", "session_id": "...",
//     "message": { "role": "assistant" | "user",
//                  "content": [ { "type": "text", "text": "..." },
//                               { "type": "thinking", ... },
//                               { "type": "tool_use", ... },
//                               { "type": "tool_result", ... } ] } }
//
// `system` (init / hooks / thinking_tokens) and `result` envelopes are NOT
// conversation messages. A `tool_result` block rides inside a `type:"user"` message,
// so filtering MUST happen at the content-BLOCK level (keep only `text`), not at the
// top-level type — otherwise a tool-result-only user message would leak. The server
// ingest stores ONLY `user`/`assistant` text (see /api/daemon/transcript), so this
// filter mirrors exactly what the server will persist.
//
// Harness-injected synthetic content: when the model loads a skill, the skill's full
// markdown body is delivered as a SYNTHETIC user turn. On the live stream-json stdout
// (verified against Claude Code CLI 2.1.195 by capturing real `claude -p
// --output-format stream-json --verbose` output) that envelope is
// `{ type:"user", isSynthetic:true, message:{ content:[{type:"text", text:"Base
// directory for this skill: …"}] } }`. Because it's a plain `text` block, the
// block-level filter alone would KEEP it and leak the whole skill body to Chorus, so
// we drop `type:"user"` envelopes flagged `isSynthetic:true` outright. ⚠️ FIELD NAME:
// the live stream marks this `isSynthetic`; the on-disk transcript JSONL
// (~/.claude/projects/.../*.jsonl, which the daemon does NOT read) marks the SAME
// message `isMeta` — keying on `isMeta` here would be a silent no-op. Genuine human
// instructions and the agent's own replies never carry `isSynthetic`, so this is a
// purely structural match (no size/
```

### Core Architecture Module: `cli/wake-queue.mjs`
```
// cli/wake-queue.mjs
// Per-key FIFO scheduler with a global concurrency cap, coalescing same-key
// wakes into batches. This is what makes the idea_root session anchor safe
// (cli-daemon spec "Per-root-idea wake serialization", design.md "Concurrency
// model") AND implements daemon-wake-coalescing (design.md §C1):
//   • within one key (root idea) → strictly serial, FIFO. The next batch waits
//     for the current runBatch to settle, so we never run two
//     `claude --resume <sameSessionId>` against one session.
//   • coalescing: when a key's slot frees, the ENTIRE pending array for that key
//     is drained (splice) and delivered to runBatch ONCE as a single batch. So
//     N events that pile up while the previous turn runs become ONE turn.
//     Natural batching only — NO debounce/collect timer, NO batch-size cap.
//   • across keys → concurrent, bounded by maxConcurrency.
//   • enqueue() returns immediately — never blocks the SSE loop.
//   • a batch whose runBatch throws is logged and the next batch for that key
//     proceeds (a poisoned wake must not wedge the key's queue forever).
// The queue carries opaque DATA items (the router passes `{ notification,
// attribution }`); it never introspects them — the runBatch callback (supplied
// at construction, wired to waker.wakeBatch in daemon.mjs) does.
// Plain ESM, zero deps, in-memory.

const NOOP_LOGGER = { info() {}, warn() {}, error() {} };

export class WakeQueue {
  /**
   * @param {{
   *   maxConcurrency?: number,
   *   logger?: { info(m:string):void, warn(m:string):void, error(m:string):void },
   *   runBatch?: (key: string, items: any[]) => Promise<void>,
   * }} [opts]
   */
  constructor(opts = {}) {
    this.maxConcurrency = opts.maxConcurrency ?? 4;
    this.logger = opts.logger ?? NOOP_LOGGER;
    // The batch runner: called ONCE per drained batch with every pending item
    // for the key. Defaults to a no-op so an unwired queue never throws (the
    // daemon always supplies the real waker.wakeBatch runner).
    this.runBatch = opts.runBatch ?? (async () => {});
    /** @type {Map<string, any[]>} pending data items per key. */
    this.pending = new Map();
    /** @type {Set<string>} keys with a batch currently running. */
    this.running = new Set();
    /** @type {string[]} keys waiting for a global concurrency slot. */
    this.readyKeys = [];
    this.activeCount = 0;
    // Graceful-shutdown latch: once set, #pump starts NOTHING new — in-flight
    // batches finish (drain observes them) but queued work stays queued and dies
    // with the process. Never cleared; a stopping queue is on its way out.
    this.stopped = false;
  }

  /** Stop starting new batches (graceful shutdown). In-flight batches are unaffected. */
  stop() {
    this.stopped = true;
  }

  /**
   * Enqueue an opaque data item under a key. Returns immediately. Items on the
   * same key coalesce: while a key's batch runs, later items pile up and are
   * drained together as ONE batch when the slot frees. Different keys run
   * concurrently up to maxConcurrency.
   * @param {string} key
   * @param {any} item  opaque data (e.g. `{ notification, attribution }`)
   */
  enqueue(key, item) {
    if (!this.pending.has(key)) this.pending.set(key, []);
    this.pending.get(key).push(item);
    // A key becomes "ready" to claim a global slot only when it's not already
    // running (serial-per-key) and not already queued for a slot. While it IS
    // running, later items simply accumulate in `pending` and are picked up by
    // the next batch — this is where coalescing happens.
    if (!this.running.has(key) && !this.readyKeys.includes(key)) {
      this.readyKeys.push(key);
    }
    this.#pump();
  }

  /** Number of keys with pending work (for tests/observability). */
  get pendingKeyCount() {
    return [...this.pending.values()].filter((q) => q.length > 0).length;
  }

  /**
   * Snapshot of the keys with a batch currently running (observability read).
   * Returns a fresh array so a caller can't mutate the internal Set.
   * @returns {string[]}
   */
  runningKeys() {
    return [...this.running];
  }

  /**
   * Snapshot of the keys that have at least one item still waiting to run —
   * i.e. enqueued but not yet started (observability read). A key that is
   * currently running with no further queued work is NOT pending. Returns a
   * fresh array so a caller can't mutate internal state.
   * @returns {string[]}
   */
  pendingKeys() {
    return [...this.pending.entries()].filter(([, q]) => q.length > 0).map(([k]) => k);
  }

  /**
   * Wait (bounded) for every in-flight batch to finish — the graceful-shutdown drain
   * (fix-daemon-exit-orphan-running-turn). Resolves `true` when the queue went idle
   * (no active batch) within `timeoutMs`, `false` on timeout — the caller exits
   * anyway and leaves the rest to the server-side reconcile backstop. Pending
   * (not-yet-started) items are NOT waited for: a shutting-down daemon stops
   * starting new work, so only the in-flight subprocesses (and their exit reports)
   * matter. Polling (50ms) keeps this zero-dep and independent of batch internals.
   * @param {number} timeoutMs
   * @returns {Promise<boolean>}
   */
  async drain(timeoutMs) {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    while (this.activeCount > 0) {
      if (Date.now() >= deadline) return false;
      await new Promise((r) => setTimeout(r, 50));
    }
    return true;
  }

  /** Try to start as many ready keys as the concurrency cap allows. */
  #pump() {
    if (this.stopped) return; // shutting down — start nothing new
    while (this.activeCount < this.maxConcurrency && this.readyKeys.length > 0) {
      const key = this.readyKeys.shift();
      if (this.running.has(key)) continue; // already running under another slot
      const queue = this.pending.get(key);
      if (!queue || queue.length === 0) continue;
      this.#startBatch(key);
    }
  }

  /**
   * Drain the ENTIRE pending array for a key into one batch and run it, then
   * chain to the following batch. No batch-size cap (design.md §C1, Q7).
   */
  #startBatch(key) {
    const queue = this.pending.get(key);
    if (!queue || queue.length === 0) {
      this.running.delete(key);
      return;
    }
    // Coalesce: take everything pending for this key right now as one batch.
    // Items that arrive after this splice accumulate for the NEXT batch.
    // An isolated instruction (Research) keeps the same serial lane but cannot
    // merge with lifecycle wakes before or after it.
    const boundary = queue.findIndex((item) => item?.isolated === true);
    const count = boundary === 0 ? 1 : boundary > 0 ? boundary : queue.length;
    const items = queue.splice(0, count);
    this.running.add(key);
    this.activeCount++;

    Promise.resolve()
      .then(() => this.runBatch(key, items))
      .catch((err) => {
        // Poisoned batch: log, do NOT let it wedge the key's queue.
        this.logger.warn(`[Chorus] wake batch for ${key} failed: ${err}`);
      })
      .finally(() => {
        this.activeCount--;
        const remaining = this.pending.get(key);
        if (remaining && remaining.length > 0) {
          // Same key accumulated more work while this batch ran → it must run
          // serially as the next batch. Re-mark ready; #pump will pick it up
          // (respecting the global cap).
          if (!this.readyKeys.includes(key)) this.readyKeys.push(key);
          this.running.delete(key); // free the key so #pump can re-claim it
        } else {
          this.running.delete(key);
          this.pending.delete(key);
        }
        this.#pump();
      });
  }
}

```

### Core Architecture Module: `packages/landing/src/i18n/utils.ts`
```
import en from './translations/en.json';
import zh from './translations/zh.json';

export type Lang = 'en' | 'zh';

const translations: Record<Lang, Record<string, unknown>> = { en, zh };

export function getLangFromUrl(url: URL): Lang {
  const seg = url.pathname.split('/')[1];
  if (seg === 'zh') return 'zh';
  return 'en';
}

export function t(lang: Lang, key: string): string {
  const parts = key.split('.');
  let current: unknown = translations[lang];
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return key;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current === 'string') return current;
  return key;
}

export function tRaw(lang: Lang, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = translations[lang];
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** URL prefix for a given lang: '' for en, '/zh' for zh */
export function langPrefix(lang: Lang): string {
  return lang === 'zh' ? '/zh' : '';
}

/** Build the alternate-language URL */
export function getAlternateUrl(url: URL): string {
  const lang = getLangFromUrl(url);
  const path = url.pathname;
  if (lang === 'zh') {
    // /zh/blog/slug/ → /blog/slug/
    return path.replace(/^\/zh(\/|$)/, '/$1').replace(/^\/\//, '/');
  }
  // /blog/slug/ → /zh/blog/slug/
  return '/zh' + (path.startsWith('/') ? path : '/' + path);
}

export function getAlternateLang(lang: Lang): Lang {
  return lang === 'en' ? 'zh' : 'en';
}

```

### Core Architecture Module: `packages/openclaw-plugin/src/connection-state.ts`
```
// packages/openclaw-plugin/src/connection-state.ts
// Holds the live DaemonConnection identity for this OpenClaw plugin process —
// the `connectionUuid` the server assigns post-handshake and reports via the
// `connection_registered` SSE data event (see api/events/notifications/route.ts).
//
// WHY A DEDICATED MODULE: the connectionUuid is captured in ONE place (the SSE
// listener, via onConnectionId) but READ in several (the daemon REST client to
// attribute execution-state / turn-advance, and the control handler to do its
// `targetConnectionUuid === my uuid` double-check). Threading it through every
// constructor would couple those modules to the listener's lifecycle; instead
// the listener writes it here and the consumers read it through a stable
// `getConnectionUuid()` accessor — the same accessor shape the shared
// `daemon-rest-client` already expects (`getConnectionUuid?: () => string|null`).
//
// The value is refreshed on every `connection_registered` (so a reconnect that
// registers a NEW DaemonConnection overwrites the stale uuid), and is the single
// source of truth for "which connection am I" across the plugin.
//
// This mirrors the CLI host's `SseListener.connectionUuid` field
// (cli/sse-listener.mjs), lifted into a module so the OpenClaw plugin's separate
// modules can share one identity without a circular import on the listener.

/**
 * A read accessor for the live connection identity. This is the exact shape the
 * shared `daemon-rest-client` (`getConnectionUuid?: () => string|null`) and the
 * control handler consume, so a single `ConnectionState` instance can be passed
 * to both.
 */
export interface ConnectionStateReader {
  /** The connection uuid this stream registered as, or null before handshake. */
  getConnectionUuid: () => string | null;
}

/**
 * Mutable connection identity. One instance per plugin process; the SSE
 * listener's `onConnectionId` writes it, the rest client + control handler read
 * it. Not a singleton export — the entry owns the instance and injects it — so
 * tests can construct an isolated state per case.
 */
export class ConnectionState implements ConnectionStateReader {
  private connectionUuid: string | null = null;

  /** The current connection identity, or null before the first handshake. */
  getConnectionUuid(): string | null {
    return this.connectionUuid;
  }

  /**
   * Record (or refresh) the connection identity. Called from the SSE listener's
   * `onConnectionId` on every `connection_registered` event, so a reconnect that
   * registers a new DaemonConnection overwrites the previous uuid rather than
   * leaving a stale one that could mis-route a control command.
   */
  setConnectionUuid(connectionUuid: string): void {
    this.connectionUuid = connectionUuid;
  }

  /**
   * Forget the connection identity (e.g. on a clean disconnect). After this,
   * `getConnectionUuid()` returns null so the control handler's double-check
   * treats every command as "not ours" until a fresh handshake re-registers.
   */
  clear(): void {
    this.connectionUuid = null;
  }
}

```

### Core Architecture Module: `src/app/(dashboard)/projects/[uuid]/dashboard/panels/utils.ts`
```
/** Normalize escaped newlines from JSON into real newlines for markdown rendering */
export function normalizeNewlines(text: string): string {
  return text.replace(/\\n/g, "\n");
}

/** Map document types to i18n keys under the "documents" namespace */
export const DOC_TYPE_I18N_KEYS: Record<string, string> = {
  prd: "typePrd",
  tech_design: "typeTechDesign",
  adr: "typeAdr",
  spec: "typeSpec",
  guide: "typeGuide",
  design: "typeDesign",
  note: "typeNote",
  report: "typeReport",
  other: "typeOther",
};

```

### Core Architecture Module: `src/app/(dashboard)/projects/[uuid]/dashboard/utils.ts`
```
import type { useTranslations } from "next-intl";
import type { BadgeHint } from "@/services/idea.service";
import { formatDateTime } from "@/lib/format-date";

export type TranslateFn = ReturnType<typeof useTranslations>;

// ===== Panel Layout Constants =====

/** Width of side panels (idea detail, document, task detail) — used for side-by-side positioning */
export const PANEL_WIDTH_PX = 480;

// ===== Shared Task Types =====

/** Flattened task shape used across panel components */
export interface FlatTask {
  uuid: string;
  title: string;
  status: string;
  commentCount: number;
  assignee?: { type: string; uuid: string; name: string } | null;
  acceptanceSummary?: {
    total: number;
    required: number;
    passed: number;
    failed: number;
    pending: number;
    requiredPassed: number;
    requiredFailed: number;
    requiredPending: number;
  } | null;
}

/** Task status → dot color mapping (shared by overview-timeline and task-list-view) */
export function getTaskStatusDotColor(status: string): string {
  switch (status) {
    case "done":
      return "bg-[#00796B]";
    case "in_progress":
      return "bg-[#1976D2]";
    case "to_verify":
      return "bg-[#7B1FA2]";
    case "open":
    case "assigned":
      return "bg-[#E65100]";
    case "closed":
      return "bg-[#9A9A9A]";
    default:
      return "bg-[#D9D9D9]";
  }
}

// ===== Relative Time Formatting =====

export function formatRelativeTime(dateString: string, t: TranslateFn): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("time.justNow");
  if (diffMins < 60) return t("time.minutesAgo", { minutes: diffMins });
  if (diffHours < 24) return t("time.hoursAgo", { hours: diffHours });
  if (diffDays < 7) return t("time.daysAgo", { days: diffDays });
  return formatDateTime(date);
}

// ===== Derived Status UI Mapping =====

/** Badge colors keyed by derived status */
export const DERIVED_STATUS_COLORS: Record<string, string> = {
  todo: "bg-[#FFF3E0] text-[#E65100] dark:bg-[#3a2a12] dark:text-[#F0A050]",
  in_progress: "bg-[#E3F2FD] text-[#1976D2] dark:bg-[#13253a] dark:text-[#5AA9F0]",
  human_conduct_required: "bg-[#F3E5F5] text-[#7B1FA2] dark:bg-[#281630] dark:text-[#C98FE0]",
  done: "bg-[#E0F2F1] text-[#00796B] dark:bg-[#12292a] dark:text-[#4FD1C0]",
};

/** i18n key mapping for derived status labels (under "ideaTracker.status" namespace) */
export const DERIVED_STATUS_I18N_KEYS: Record<string, string> = {
  todo: "todo",
  in_progress: "inProgress",
  human_conduct_required: "humanConductRequired",
  done: "done",
};

// ===== Badge Hint i18n =====

export const BADGE_HINT_I18N_KEYS: Record<string, string> = {
  open: "open",
  researching: "researching",
  answer_questions: "answerQuestions",
  planning: "planning",
  review_proposal: "reviewProposal",
  building: "building",
  verify_work: "verifyWork",
  done: "done",
};

export function getBadgeHintLabel(badgeHint: BadgeHint, t: TranslateFn): string {
  if (!badgeHint) return "";
  return t(BADGE_HINT_I18N_KEYS[badgeHint] || "open");
}

```

### Core Architecture Module: `src/app/api/daemon/execution-state/route.ts`
```
// src/app/api/daemon/execution-state/route.ts
// Daemon execution-state ingest + first-paint read.
//
// POST — the daemon uploads a full execution snapshot for ONE of its
// connections (the WakeQueue's running/queued keys mapped to the wake-triggering
// resource: task/idea/proposal/document). The server reconciles the connection's
// DaemonExecution rows to the snapshot and pushes an `execution:{connectionUuid}`
// SSE event.
//
// GET — the Agent Connections detail pane reads a single connection's current
// running/queued set for first paint, before any SSE event arrives.
//
// Auth mirrors the agent-connections / root-idea precedent exactly: any valid
// auth context (notably an agent API key) is accepted, there is NO MCP tool and
// NO new permission bit, and the writable/readable set is scoped to the caller's
// own connections by the query itself. The connectionUuid must belong to the
// authenticated agent (POST) or be visible to the caller (GET), else 404 — never
// a 403 that would reveal another agent's connection.

import { NextRequest } from "next/server";
import { z } from "zod";
import { withErrorHandler } from "@/lib/api-handler";
import { success, errors } from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth";
import {
  ACTIVE_EXECUTION_STATUSES,
  EXECUTION_ENTITY_TYPES,
  reconcileSnapshot,
  publishExecutionChange,
  connectionBelongsToAgent,
  connectionVisibleToCaller,
  getExecutionsForConnection,
  filterValidExecutionEntities,
  type SnapshotExecution,
} from "@/services/daemon-execution.service";
import { filterExecutionViewsByAccess } from "@/services/project-access.service";

// Request body schema. `entityType` is the wake-triggering resource kind
// (task | idea | proposal | document | daemon_session — the ad-hoc conversation
// wake; the enum derives from EXECUTION_ENTITY_TYPES so it stays in sync) and
// `entityUuid` its uuid. `status` is
// constrained to the two active values a daemon can report — `ended` is a
// server-only terminal state set by reconcile, never accepted from the wire.
// `startedAt`/`rootIdeaUuid`/`directIdeaUuid` are nullable/optional (a queued
// resource has no start time; a wake with no idea ancestor has neither idea id;
// an older daemon may omit `directIdeaUuid`). `directIdeaUuid` is the entity's
// direct idea (the daemon session anchor) the chat UI matches a conversation's
// execution by. `startedAt` is coerced from an ISO-8601 string to a Date.
const snapshotEntrySchema = z.object({
  entityType: z.enum([...EXECUTION_ENTITY_TYPES]),
  entityUuid: z.string().min(1),
  rootIdeaUuid: z.string().min(1).nullish(),
  // The DIRECT idea (the entity's directly-attached idea — the daemon session
  // anchor). Optional + nullable: a wake with no idea ancestor has none, and an
  // older daemon that predates this field omits it (persisted as null). The chat
  // UI matches a conversation's execution by this value, not rootIdeaUuid.
  directIdeaUuid: z.string().min(1).nullish(),
  status: z.enum([...ACTIVE_EXECUTION_STATUSES]),
  startedAt: z.coerce.date().nullish(),
});

const bodySchema = z.object({
  connectionUuid: z.string().min(1),
  executions: z.array(snapshotEntrySchema),
});

// POST /api/daemon/execution-state — ingest a connection's execution snapshot.
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errors.unauthorized();
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errors.badRequest("Invalid JSON body");
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return errors.validationError(parsed.error.flatten());
  }
  const { connectionUuid, executions } = parsed.data;

  // Ownership fence: the connection must belong to the authenticated agent within
  // its company. A connection owned by another agent (or non-existent) is 404 —
  // NOT 403 — so we never confirm another agent's connection exists. No rows are
  // touched on the negative path.
  const owns = await connectionBelongsToAgent(
    auth.companyUuid,
    auth.actorUuid,
    connectionUuid,
  );
  if (!owns) {
    return errors.notFound("Connection");
  }

  // Multi-tenancy fence on the snapshot body, best-effort: keep only entries
  // whose referenced entity resolves within the caller's company; a dead/foreign
  // reference is DROPPED rather than rejecting the whole snapshot (so one deleted
  // resource still in the daemon's registry can't wedge the connection's updates,
  // including ending other finished rows). A non-resolving rootIdeaUuid is nulled.
  const validEntries = await filterValidExecutionEntities(
    auth.companyUuid,
    executions as SnapshotExecution[],
  );

  // Snapshot is authoritative: reconcile this connection's rows to the filtered
  // snapshot (upsert reported resources; end any active row absent from it),
  // stamping company/agent from the authenticated context (never trusted from the
  // body). Dropped entries are absent from what reconcile sees, so any prior row
  // for them ends via the absent-from-snapshot rule.
  const reconciled = await reconcileSnapshot(
    auth.companyUuid,
    auth.actorUuid,
    connectionUuid,
    validEntries,
  );

  // Push the connection's new active set to subscribed UIs. Fire-and-forget —
  // swallows its own errors and never fails the ingest.
  await publishExecutionChange(auth.companyUuid, connectionUuid);

  return success({ reconciled });
});

// GET /api/daemon/execution-state?connectionUuid=… — first-paint read of a
// single connection's current running/queued set, owner/self scoped.
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errors.unauthorized();
  }

  const connectionUuid = request.nextUrl.searchParams.get("connectionUuid");
  if (!connectionUuid) {
    return errors.badRequest("connectionUuid is required");
  }

  // Visibility fence: same owner/self scoping as the connection registry. A
  // connection the caller cannot see is 404 (not 403) so it is indistinguishable
  // from a non-existent one.
  const visible = await connectionVisibleToCaller(auth, connectionUuid);
  if (!visible) {
    return errors.notFound("Connection");
  }

  // Connection visibility is not project access: hide rows for projects the
  // caller can no longer see.
  const executions = await filterExecutionViewsByAccess(
    auth,
    await getExecutionsForConnection(auth.companyUuid, connectionUuid),
  );
  return success({ executions });
});

```

### Core Architecture Module: `src/components/agent-presence/hooks.ts`
```
// Formatters + label helpers for the agent-presence rendering vocabulary.
//
// Presentational only — these hooks read i18n strings and format already-fetched
// values. They do NOT fetch data. They are shared by the pill, popover, modal,
// and the (soon-relocated) Agent Connections page so wording + formatting stay
// byte-identical across every surface.

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ExecutionView } from "@/contexts/realtime-context";

// 1s tick that drives the monospace HH:MM:SS uptime/elapsed displays. Returns a
// `nowMs` that updates every `intervalMs`. Shared by the popover and the modal
// view so there is one tick implementation; each caller mounts it only while its
// surface is open (the closed steady state has no interval). A single shared
// ticker per surface (not per row) keeps 100 rows from meaning 100 timers.
export function useNowTick(intervalMs = 1000) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return nowMs;
}

// Relative "last active" / "started" formatter — reuses the shared `time.*`
// i18n namespace already used elsewhere so wording stays consistent.
export function useRelativeTime() {
  const t = useTranslations("time");
  return useCallback(
    (dateStr: string, nowMs: number) => {
      const diffMs = nowMs - new Date(dateStr).getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffMinutes < 1) return t("justNow");
      if (diffMinutes < 60) return t("minutesAgo", { minutes: diffMinutes });
      if (diffHours < 24) return t("hoursAgo", { hours: diffHours });
      return t("daysAgo", { days: diffDays });
    },
    [t],
  );
}

// Pad an integer to two digits — used by the monospace HH:MM:SS uptime.
export function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

// Monospace duration that ticks every second from an ISO start to `nowMs`. Days
// are split off into a localized `Dd ` prefix so the seconds-tick stays
// meaningful past 24h — `999:00:00` would lose its scannability. Returns a single
// string (no JSX), intentionally placed inside a font-mono span by the caller.
// Reduced-motion is honored the same way everywhere: the value is a plain ticking
// number, no animation; any decorative pulse is gated behind `motion-safe:` at
// the call site. Shared by both the connection uptime and the running-execution
// elapsed timer (they were byte-identical formatters).
export function useDurationMono() {
  const t = useTranslations("agentConnections");
  return useCallback(
    (fromIso: string, nowMs: number) => {
      const diffMs = Math.max(0, nowMs - new Date(fromIso).getTime());
      const totalSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSeconds / 86_400);
      const hours = Math.floor((totalSeconds % 86_400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const hms = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
      if (days > 0) {
        // Localized day prefix + monospace HH:MM:SS so the second-by-second
        // tick is still visible after 24h.
        return t("uptimeMonoDays", { days, time: hms });
      }
      return hms;
    },
    [t],
  );
}

// Back-compat aliases — uptime (connection) and elapsed (running execution) are
// the same monospace duration, just named for their call sites. Both delegate to
// the single `useDurationMono` implementation so the format can never drift.
export const useUptimeMono = useDurationMono;
export const useElapsedMono = useDurationMono;

export function useClientTypeLabel() {
  const t = useTranslations("agentConnections");
  return useCallback(
    (clientType: string) => {
      switch (clientType) {
        case "claude_code":
          return t("clientClaudeCode");
        case "openclaw":
          return t("clientOpenclaw");
        case "codex":
          return t("clientCodex");
        case "kiro":
          return t("clientKiro");
        case "dsh":
          return t("clientDsh");
        case "pi":
          return t("clientPi");
        default:
          return t("clientUnknown");
      }
    },
    [t],
  );
}

// Localized label for the resource kind, shown as a small badge so a user can
// tell at a glance whether the daemon is on a task, an idea, etc.
export function useEntityTypeLabel() {
  const t = useTranslations("agentConnections");
  return useCallback(
    (entityType: string) => {
      switch (entityType) {
        case "task":
          return t("entityTask");
        case "idea":
          return t("entityIdea");
        case "proposal":
          return t("entityProposal");
        case "document":
          return t("entityDocument");
        case "daemon_session":
          // An ad-hoc (non-idea) wake reports its execution as a `daemon_session`.
          // Label it as a conversation (not "Resource"); execHref returns null for
          // it, so no broken deep link — the conversation lives in this modal.
          return t("entityConversation");
        default:
          return t("entityUnknown");
      }
    },
    [t],
  );
}

// Build the in-app deep link for an execution's target resource, or null when it
// can't be linked (no projectUuid resolved, or an unknown entity type). Each
// resource kind routes to its canonical project-scoped surface.
export function execHref(exec: ExecutionView): string | null {
  if (!exec.projectUuid) return null;
  switch (exec.entityType) {
    case "task":
      return `/projects/${exec.projectUuid}/tasks/${exec.entityUuid}`;
    case "idea":
      // The standalone /ideas page was removed — ideas open in the Dashboard side
      // panel via `?panel=`. Link straight to the canonical address (same as
      // global-search) instead of `/ideas/{uuid}`, which would only 308-redirect.
      return `/projects/${exec.projectUuid}/dashboard?panel=${exec.entityUuid}`;
    case "proposal":
      return `/projects/${exec.projectUuid}/proposals/${exec.entityUuid}`;
    case "document":
      return `/projects/${exec.projectUuid}/documents/${exec.entityUuid}`;
    default:
      return null;
  }
}

```

### Core Architecture Module: `src/components/animated-empty-state.tsx`
```
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface AnimatedEmptyStateProps {
  children: ReactNode;
}

export function AnimatedEmptyState({ children }: AnimatedEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

```

### Core Architecture Module: `src/components/mention-renderer.tsx`
```
"use client";

import React from "react";

import { MarkdownContent } from "@/components/markdown-content";
import type { Components } from "streamdown";
// Reuse the SHARED pin codec (pure, dependency-free) so the client parser and the
// server mention service can never drift on how the `?cwd=…&host=…` suffix decodes.
import { decodePinSuffix } from "@/lib/mention-format";

/**
 * Regex to match `@[DisplayName](type:uuid)` patterns in text, with an OPTIONAL
 * pinned-instance suffix `?cwd=…&host=…` INSIDE the parens (cwd-addressable
 * instances). This is byte-identical in source to the SERVER parser's
 * `MENTION_REGEX` (src/services/mention.service.ts) so the client recognizes the
 * exact same set of tokens the server produces — including pinned ones.
 * - Group 1 (DisplayName): any non-`]` characters
 * - Group 2 (type): user | agent
 * - Group 3 (uuid): a strict UUID
 * - Group 4 (pin): the raw pin query string after `?` (or undefined when unpinned),
 *   matched as "everything up to the closing paren" — the codec keeps the payload
 *   paren-free by percent-escaping `(`/`)`.
 *
 * NOTE (bug fix): the previous client regex `/@\[([^\]]+)\]\((user|agent):([a-f0-9-]+)\)/g`
 * could NOT match a pinned token — the `?…` defeated the trailing `)` — so pinned
 * mentions rendered as broken raw text. The optional 4th group fixes that while
 * leaving un-pinned tokens parsed exactly as before.
 */
const MENTION_REGEX =
  /@\[([^\]]+)\]\((user|agent):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\?([^)]*))?\)/gi;

/**
 * A parsed mention's reference shape, aligned with `MentionRef`
 * (src/services/mention.service.ts): `type`, `uuid`, `displayName`, plus the
 * OPTIONAL pinned-instance `pinnedHost`/`pinnedCwd`. The pin fields are present
 * ONLY for a pinned token — an un-pinned token omits them entirely, so its shape
 * is object-identical to before this change.
 */
export interface ParsedMentionRef {
  type: "user" | "agent";
  uuid: string;
  displayName: string;
  pinnedHost?: string | null;
  pinnedCwd?: string | null;
  runtimeCwd?: boolean;
}

interface MentionPart {
  type: "text" | "mention";
  content: string;
  mentionType?: "user" | "agent";
  mentionUuid?: string;
  // Pinned-instance fields, present only when the matched token was pinned
  // (mirrors ParsedMentionRef / MentionRef — absent on un-pinned tokens).
  pinnedHost?: string | null;
  pinnedCwd?: string | null;
  runtimeCwd?: boolean;
}

function parseMentions(text: string): MentionPart[] {
  const parts: MentionPart[] = [];
  let lastIndex = 0;

  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    // Decode the optional pin suffix (group 4) via the shared codec. Attach the
    // pin fields ONLY when present, keeping un-pinned parts byte-identical to the
    // legacy shape (mirrors the server parser in mention.service.ts).
    const { pinnedHost, pinnedCwd, runtimeCwd } = decodePinSuffix(match[4]);
    const part: MentionPart = {
      type: "mention",
      content: match[1],
      mentionType: match[2].toLowerCase() as "user" | "agent",
      mentionUuid: match[3].toLowerCase(),
    };
    if (pinnedHost !== null || pinnedCwd !== null) {
      part.pinnedHost = pinnedHost;
      part.pinnedCwd = pinnedCwd;
      if (runtimeCwd) part.runtimeCwd = true;
    }
    parts.push(part);

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return parts;
}

// Unique placeholder prefix that won't appear in normal content
const MENTION_PLACEHOLDER_PREFIX = "\u200B\u200BMENTION_";
const MENTION_PLACEHOLDER_SUFFIX = "\u200B\u200B";
const MENTION_PLACEHOLDER_REGEX = /\u200B\u200BMENTION_(\d+)\u200B\u200B/g;

/**
 * Pre-process content: replace @[Name](type:uuid) with placeholders
 * so markdown renderers don't mangle the mention syntax.
 *
 * This is the DEFAULT (non-comment) path's preprocessing. Exported so the
 * byte-stability test can assert it is unchanged by the comment-path addition —
 * its placeholder output must remain identical for every other surface.
 */
export function preprocessMentions(content: string): {
  processed: string;
  mentions: Array<{
    displayName: string;
    type: string;
    uuid: string;
    pinnedHost?: string | null;
    pinnedCwd?: string | null;
    runtimeCwd?: boolean;
  }>;
} {
  const mentions: Array<{
    displayName: string;
    type: string;
    uuid: string;
    pinnedHost?: string | null;
    pinnedCwd?: string | null;
    runtimeCwd?: boolean;
  }> = [];
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);

  // The 4th group (`pin`) is the raw pin query string (or undefined) — decode it
  // via the shared codec and attach pin fields only when present (un-pinned
  // placeholders stay byte-identical).
  const processed = content.replace(regex, (_match, name, type, uuid, pin) => {
    const index = mentions.length;
    const { pinnedHost, pinnedCwd, runtimeCwd } = decodePinSuffix(pin);
    const entry: {
      displayName: string;
      type: string;
      uuid: string;
      pinnedHost?: string | null;
      pinnedCwd?: string | null;
      runtimeCwd?: boolean;
    } = { displayName: name, type, uuid };
    if (pinnedHost !== null || pinnedCwd !== null) {
      entry.pinnedHost = pinnedHost;
      entry.pinnedCwd = pinnedCwd;
      if (runtimeCwd) entry.runtimeCwd = true;
    }
    mentions.push(entry);
    return `${MENTION_PLACEHOLDER_PREFIX}${index}${MENTION_PLACEHOLDER_SUFFIX}`;
  });

  return { processed, mentions };
}

// ── React-native mention rendering (opt-in, comment path only) ──────────────
//
// The default ContentWithMentions path above renders mentions via imperative DOM
// injection (MentionPostProcessor: document.createElement spans). That cannot host
// an interactive React component (a Radix Popover with state/handlers), so the
// comment surface needs a React-native path: mentions become real React nodes.
//
// Approach: instead of a zero-width text placeholder, preprocess each mention into
// a `<chorus-mention idx="N">@Name</chorus-mention>` custom inline TAG, then let
// Streamdown render that tag through a `components` override (markdown structure
// stays fully intact — a mention inside a list/heading/bold still works, unlike
// splitting the body at mention boundaries). `literalTagContent` keeps the tag's
// child label out of the markdown parser; `allowedTags` whitelists it through the
// sanitizer. This is gated behind the opt-in `renderMention` prop so EVERY OTHER
// surface keeps the byte-stable DOM-injection path untouched (q6 = comments only).

const MENTION_TAG = "chorus-mention";
const MENTION_TAG_ATTR = "idx";

/**
 * The parsed mention shape handed to a `renderMention` render-prop — a
 * `ParsedMentionRef` plus its stable index in the body (so the consumer can key
 * the node). This is the contract the comment path renders against.
 */
export interface RenderMentionArg extends ParsedMentionRef {
  index: number;
}

/**
 * Pre-process content for the React-native path: replace each `@[Name](type:uuid?…)`
 * with a `<chorus-mention idx="N">@Name</chorus-mention>` custom tag. Returns the
 * processed markdown plus the parsed mention refs (index-aligned with the `idx`
 * attribute). The display label is escaped of `<`/`>`/`&` so a name can never break
 * out of the tag; the badge re-derives its own label from the ref's displayName.
 *
 * Exported for the byte-stability test: a test can assert the comment path emits
 * `<chorus-mention>` tags WITHOUT mounting the heavy Streamdown renderer, and that
 * the legacy `preprocessMentions` (every other surface) is left unchanged.
 */
export function preprocessMentionsAsTags(content: string): {
  processed: string;
  mentions: ParsedMentionRef[];
} {
  const mentions: ParsedMentionRef[] = [];
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);

  const processed = content.replace(regex, (_match, name, type, uuid, pin) => {
    const index = mentions.length;
    const { pinnedHost, pinnedCwd, runtimeCwd } = decodePinSuffix(pin);
    const ref: ParsedMentionRef = {
      type: (type as string).toLowerCase() as "user" | "agent",
      uuid: (uuid as string).toLowerCase(),
      displayName: name,
    };
    if (pinnedHost !== null || pinnedCwd !== null) {
      ref.pinnedHost = pinnedHost;
      ref.pinnedCwd = pinnedCwd;
      if (runtimeCwd) ref.runtimeCwd = true;
    }
    mentions.push(ref);
    const label = `@${name}`
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<${MENTION_TAG} ${MENTION_TAG_ATTR}="${index}">${label}</${MENTION_TAG}>`;
  });

  return { processed, mentions };
}

interface MentionRendererProps {
  children: string;
  className?: string;
}

/**
 * Renders plain text with @mentions highlighted.
 * For use in places that don't need markdown rendering.
 */
export function MentionRenderer({ children, className }: MentionRendererProps) {
  if (!children || typeof children !== "string") {
    return null;
  }

  const parts = parseMentions(children);

  if (parts.length === 1 && parts[0].type === "text") {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === "mention") {
          return (
            <span
              key={index}
              className="text-blue-600 font-medium"
              title={`${part.mentionType}: ${part.mentionUuid}`}
            >
              @{part.content}
            </span>
          );
        }
        return <React.Fragment key={index}>{part.content}</React.Fragment>;
      })}
    </span>
  );
}

interfac
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #559** (2026-09-28): **[Security] Uses a Public JWT Signing Fallback**
  *Symptoms*: # Chorus Docker Compose Uses a Public JWT Signing Fallback, Allowing Forged Super Admin Sessions  **Severity:** Critical (when the default Compose deployment is exposed)   **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-321 (Use of Hard-coded Cryptographic Key)   **Affected:** Chorus `0.17.3`, commit [`8cc534fabee60e7aaf32559fec8193533b1fd81c`](https://github.com/Chorus-AIDLC/Chorus/tree/8cc534fabee60e7aaf32559fec8193533b1fd81c)    ## Summary  Chorus's Docker Compose configuration supplies a public fallback for `NEXTAUTH_SECRET`:  ```yaml NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-chorus-docker-secret-change-in-production} ```  The application uses `NEXTAUTH_SECRET` as the HMAC key for both regular user JWTs and Super Admin JWTs. An attacker who knows the repository-visible fallback can create a valid `admin_session` cookie without knowing the Super Admin password. The forged cookie is accepted by `requireSuperAdmin` and reaches Super Admin API routes.  ## Technical Details  The fallback is present in the official Compose file at [`docker-compose.yml:13`](https://github.com/Chorus-AIDLC/Chorus/blob/8cc534fabee60e7aaf32559fec8193533b1fd81c/docker-compose.yml#L13). When `NEXTAUTH_SECRET` is unset or empty, Docker Compose passes the following value to the application:  ```text chorus-docker-secret-change-in-production ```  The regular user session implementation signs JWTs with HS256 and verifies them with the same environment variable: [`src/lib/user-session.ts:22-29`](https://gi
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this! We’ve confirmed the issue and plan to address it in the next release.
  > > Thanks for reporting this! We’ve confirmed the issue and plan to address it in the next release.  @ChenNima Thank you for addressing this issue. I have reviewed your PR and confirmed that it effectively resolves the problem I reported. If you have any further questions, please feel free to contact me. I would be very happy to contribute to the project.

- **Issue #283** (2026-06-22): **Plugin install fails: requires compiled runtime output for TypeScript entry**
  *Symptoms*: ## Bug Report  `openclaw plugins install @chorus-aidlc/chorus-openclaw-plugin` fails with:  ``` package install requires compiled runtime output for TypeScript entry src/index.ts: expected ./dist/index.js, ./dist/index.mjs, ./dist/index.cjs, src/index.js, src/index.mjs, src/index.cjs Also not a valid hook pack: Error: package.json missing openclaw.hooks ```  ## Environment  - OpenClaw: 2026.5.7 (eeef486) - Node: v26.1.0 - Plugin: @chorus-aidlc/chorus-openclaw-plugin@0.4.0  ## Analysis  The published npm package only contains TypeScript source (`src/index.ts`) without compiled output. OpenClaw expects one of: - `./dist/index.js`, `./dist/index.mjs`, `./dist/index.cjs` - `src/index.js`, `src/index.mjs`, `src/index.cjs`  Likely cause: the `prepublishOnly` or `prepack` build step is missing or `dist/` is excluded from the published files.  ## Fix  Ensure `package.json` includes a build step before publish and that `dist/` is in the `files` array (or not in `.npmignore`).
  **Post-Mortem & Fix Analysis**:
  > 已在 0.10.0 版本修复

- **Issue #280** (2026-05-28): **Bug: Project Group 创建输入框未兼容输入法，回车直接触发保存**
  *Symptoms*: ## 问题描述  创建新 Project Group 时，输入框没有处理 IME (输入法) 组合状态。用户在用中文/日文等输入法打字时，按回车本应确认候选词，但实际直接触发了表单保存。  ## 复现步骤  1. 点击创建新 Project Group 2. 在名称输入框中使用中文输入法输入 3. 按回车确认候选词  ## 期望行为  回车在 IME 组合状态 (composing) 时应仅确认候选词，不触发保存。只有在非组合状态下按回车才提交表单。  ## 修复方向  监听 `compositionstart` / `compositionend` 事件，在 `isComposing` 为 true 时忽略 Enter keydown，或检查 `event.isComposing` / `event.keyCode === 229`。

- **Issue #261** (2026-06-22): **Also not a valid hook pack: Error: package.json missing openclaw.hooks**
  *Symptoms*: The following error message appears when installing plugins in the new version of OpenClaw:  ```bash ➜  ~ openclaw plugins install @chorus-aidlc/chorus-openclaw-plugin  🦞 OpenClaw 2026.5.12 (f066dd2) — I autocomplete your thoughts—just slower and with more API calls.  Installing @chorus-aidlc/chorus-openclaw-plugin into /Users/yunxin/.openclaw/npm… Linked peerDependency "openclaw" -> /usr/local/lib/node_modules/openclaw Linked peerDependency "openclaw" -> /usr/local/lib/node_modules/openclaw Linked peerDependency "openclaw" -> /usr/local/lib/node_modules/openclaw Downloading @chorus-aidlc/chorus-openclaw-plugin… Extracting /private/var/folders/hs/k281ssf557lfpbtszbqk95k00000gn/T/openclaw-hook-pack-123fecc0-8ae3-4933-a458-ed54ddf341ea-sHUDq8/chorus-aidlc-chorus-openclaw-plugin-0.4.0.tgz… package install requires compiled runtime output for TypeScript entry src/index.ts: expected ./dist/index.js, ./dist/index.mjs, ./dist/index.cjs, src/index.js, src/index.mjs, src/index.cjs. This is a plugin packaging issue, not a local config problem; update or reinstall the plugin after the publisher ships compiled JavaScript, or disable/uninstall the plugin until then. TypeScript source fallback is only supported for source checkouts and local development paths. Also not a valid hook pack: Error: package.json missing openclaw.hooks ```
  **Post-Mortem & Fix Analysis**:
  > 已在 0.10.0 版本修复

- **Issue #214** (2026-04-28): **mac 下启动失败**
  *Symptoms*:  chorus --port 3000  Starting embedded PostgreSQL (PGlite) on port 5433...  ERROR: PGlite failed to start within 15 seconds.  Possible causes:   - Port 5433 is already in use   - Corrupt data in /Users/mouyong/.chorus-data/pglite/ 
  **Post-Mortem & Fix Analysis**:
  > ai 排查后处理成功：   根因                                                                                                                                                                                  bun 全局安装 @chorus-aidlc/chorus@0.6.6 时，把它声明为捆绑依赖（files 字段里的             node_modules/@electric-sql/、node_modules/dotenv/）的子模块提升到了上层                    .bun/install/global/node_modules/。                                                                                                                                                 但 chorus.mjs 用 __dirname/node_modules/...                                                硬编码引用这些文件，找不到就静默失败，最终被错误归因为"PGlite 启动超时 /   数据库迁移失败"。                                                                                                                                                                   操作清单                                                                                      在 <chorus 包目录>/node_modules/ 下补三条软链，把 hoisted 位置链回去。                              
  > Hi @mouyong 感谢反馈！在 mac 下测试过 npx/npm 都可以正常启动，这可能是 bun 独有的问题？我们确实没有测试过 bun 或者 deno 下的行为，会在 bun 下尝试修复这个问题
  > win 也存在同样的问题。目前没法直接用的感觉

- **Issue #187** (2026-04-18): **议题审核的时候，提示事务超时，一直过不去**
  *Symptoms*: ![Screenshot_2026-04-18-18-51-19-54_57f62d029f3be7150d1a1c9b246ed07f.jpg](https://github.com/user-attachments/assets/8bb93774-7e79-4443-a40d-e27d2a93bbd1)  ![Screenshot_2026-04-18-18-51-04-02_57f62d029f3be7150d1a1c9b246ed07f.jpg](https://github.com/user-attachments/assets/2fa9ce6e-6e2e-419c-b12c-a7ba01a65bbb)   
  **Post-Mortem & Fix Analysis**:
  > 使用的是 docker-local 模式，使用的是 admin 的角色。
  > 感谢反馈，问下用的是什么 Agent，应该是 Claude Code？
  > > 感谢反馈，问下用的是什么 Agent，应该是 Claude Code？  是的。让 ai 分析了一下问题根因。  ---  现在我了解了完整情况。以下是分析：  ## 超时根因分析  ### 事务内的操作序列（`proposal.service.ts:634-736`）  一个 `prisma.$transaction()` 内包含以下 **串行** DB 写入：  | # | 操作 | 写入次数 | 方式 | |---|------|---------|------| | 1 | `tx.proposal.update()` | 1 | 单行 | | 2 | `createDocumentFromProposal()` 循环 | D 次 | **串行 for 循环** | | 3 | `createTasksFromProposal()` | 12 次 | `Promise.all` 并行 | | 4 | `tx.taskDependency.create()` 循环 | E 次 | **串行 for 循环** | | 5 | `tx.acceptanceCriterion.createMany()` 循环 | 12 次 | **串行 for 循环** |  ### 关键问题：第 3 步用了 `prisma.task.create` 而非 `tx.task.create`  ```typescript // task.service.ts:671 — 注意这里是 prisma，不是 tx！ const createPromises = tasks.map((task) =>   prisma.task.create({ ... })  // 不在事务内！ ); ```  **`createTasksFromProposal()` 用的是 `prisma`（全局客户端）而非事务 `tx`**，这意味着 12 个 task 的创建是独立的 12 次数据库连接，不在交互式事务的连接上。虽然 `Promise.all` 并行执行，但每个都需要获取连接、执行 SQL、返回结果。  加上后续 12 次 `tx.acceptanceCriterion.createMany()` 是串行的，每次都是一个独立的 SQL 语句。  ### 对 12 个 task drafts 的

- **Issue #120** (2026-04-14): **Progress bar excludes closed tasks from completion count**
  *Symptoms*: ## Bug  Project and Group level progress bars only count `done` tasks as completed, but `closed` tasks still count toward the total (denominator). This makes progress appear lower than it should be.  ### Current behavior  - **Project** (`src/app/api/projects/route.ts`): `doneTasks / totalTasks` - **Group** (`projects/page.tsx`): aggregates project-level doneTasks/tasks  Both only count `status: done` in the numerator.  ### Expected behavior  Numerator should be `done + closed`, consistent with Dashboard stats (`project.service.ts`) which already counts both.  ### Fix  Change the done-task filter to include `closed` status in: 1. `src/app/api/projects/route.ts` 2. `projects/page.tsx` group-level aggregation

- **Issue #114** (2026-04-06): **Elaboration round with needs_followup status shows questions as unanswered**
  *Symptoms*: ## Bug  When an elaboration round is validated with issues (triggering a follow-up round), the original round's status becomes `needs_followup`. The frontend displays all questions in that round as **unanswered**, even though every question has an `answer` object with `selectedOptionId` and `answeredAt`.  ## Reproduction  1. Start elaboration on an idea with multiple questions 2. Answer all questions 3. Validate the round with an issue on one question (creates a follow-up round) 4. Open the idea's elaboration view in the frontend 5. Round 1 questions all show as unanswered  ## Expected  Questions with `answer !== null` should display as answered regardless of round status.  ## Actual  Round status `needs_followup` causes the UI to treat all questions as unanswered.  ## Data evidence  Round 1 (uuid: `1050c0be-25b2-4918-ac0d-030ee13c7257`) on idea `d3a4c58b-e1fc-4fb3-9613-bf7ed7779e04` in project "Idea Tracker": - Round status: `needs_followup` - All 7 questions have `answer.selectedOptionId` set - Frontend shows them as unanswered  ## Root cause (likely)  The elaboration UI component checks `round.status` to determine display state instead of checking `question.answer !== null` per question.

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

### Incident Patch 1: `fa68a20d` (2026-10-04)
**Commit Message**: fix(pi): prefer native MCP and retain legacy compatibility (#598)

Select the Pi MCP backend from the verified host range, preserve user
constraints, and align safe adapter5 configuration with runtime discovery.
Keep workflow matching outer-only and fail closed on reviewer permissions.

Include four-SDK packed-host regressions, configuration safety coverage,
and the archived OpenSpec design and verification evidence.

Chorus-Idea: fee5109f-80b7-476f-bc19-f20f5e3f6f55

**File**: `.claude/skills/plugin-maintenance/SKILL.md` (modified, +2/-2)
```diff
@@ -103,8 +103,8 @@ public/skill/                   ← Standalone skill (any MCP-compatible agent)
 | Aspect | Claude Code | Codex | OpenClaw | Kiro CLI | Pi |
 |--------|-------------|-------|----------|----------|----|
 | Skill invocation | `/chorus:develop` | `$develop` | `/develop` | `/chorus-develop` | `/skill:develop` |
-| Tool names | `chorus_<tool>` | `chorus_<tool>` | `chorus__<tool>` | `chorus_<tool>` / `@chorus` matcher | MCP gateway may expose `chorus_chorus_<tool>`; extension uses native `chorus_<tool>` |
-| MCP config | `.mcp.json` | `~/.codex/config.toml` | Plugin config | `~/.kiro/settings/mcp.json` | `.mcp.json` or `~/.pi/agent/mcp.json` via `pi-mcp-adapter` |
+| Tool names | `chorus_<tool>` | `chorus_<tool>` | `chorus__<tool>` | `chorus_<tool>` / `@chorus` matcher | Native `mcp__chorus__chorus_<tool>` (direct/codemode); legacy adapter5 direct `chorus_chorus_<tool>` or bare; extension uses backend names |
+| MCP config | `.mcp.json` | `~/.codex/config.toml` | Plugin config | `~/.kiro/settings/mcp.json` | Native global `~/.pi/agent/mcp.json` / trusted project `.pi/mcp.json`; legacy adapter5 global `mcp-adapter.json` |
 | Session lifecycle | SubagentStart/Stop hooks | Manual/stateless | Manual | `agentSpawn`/`stop` hooks | Automatic via mutable `subagent_spawn` and `subagent_manage` events |
 | Reviewers | `agents/*.md` via Task | Skills mounted in `spawn_agent` | Reviewer skills via `sessions_spawn` | Native JSON subagents | `agents/chorus-*-reviewer.md` via `pi-subagents` |
 | User interaction | `AskUserQuestion` | Plain text | Plain text | Plain text | Plain text |
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ chorus upgrade --plugins   # Also refresh configured agents' Chorus plugins
 
 Self-upgrade supports the active **npm global installation** on Linux, macOS and Windows. It checks npm's prefix, resolves the latest stable release, avoids downgrades and verifies the installed version. Source checkouts, links, npx and other package-manager installations must use their own update workflow. CLI discovery, installation or verification failure stops plugin work.
 
-`--plugins` reads `~/.chorus/daemon.json`, including legacy single-agent records. Explicit Claude Code, Codex, Kiro and Pi types are processed even with wake disabled. Each record's home, config directory and PATH are respected; shared destinations update once. Only Chorus and required integration packages are refreshed, with existing credentials and unrelated settings preserved. Host CLIs must already be installed. Kiro templates come from the record's configured Chorus instance (its served version, which may lag npm); conflicting instance URLs for one destination are reported. Pi probes for targeted updates of Chorus and `pi-mcp-adapter`; older hosts without that capability report incomplete work, including partial installs, without updating unrelated extensions. Pinned versions, ranges and non-latest tags are preserved and reported incomplete; remove those constraints to allow latest updates.
+`--plugins` reads `~/.chorus/daemon.json`, including legacy single-agent records. Explicit Claude Code, Codex, Kiro and Pi types are processed even with wake disabled. Each record's home, config directory and PATH are respected; shared destinations update once. Only Chorus and required integration packages are refreshed, with existing credentials and unrelated settings preserved. Host CLIs must already be installed. Kiro templates come from the record's configured Chorus instance (its served version, which may lag npm); conflicting instance URLs for one destination are reported. Stable Pi >=0.99.0 <2.0.0 uses native MCP and targets Chorus only; Pi 0.84.4–0.98.x retains the verified `pi-mcp-adapter@5.0.0` pin. Unknown versions do not trigger adapter changes or an MCP-complete claim; unsupported hosts run no package commands. Updates are targeted, never all-extension; missing capability or incompatible constraints report incomplete work. User pins/ranges are preserved (the verified adapter pin is intentional, not an incomplete latest refresh). Existing native-host adapters and `-builtin:mcp` filters produce scope-specific manual-migration warnings, never automatic removal. See [Pi setup](docs/CONNECT_PI.md).
 
 The command is noninteractive and reports each target. Exit **0** means all requested work completed (missing/empty configuration is a successful no-op); exit **1** means failure or incomplete work, including offline/unknown/untyped records, missing hosts or unsupported targeted updates. Later targets still run after a plugin failure; completed changes are not rolled back. Start new agent sessions and restart the daemon when convenient to activate updates—the command does not restart processes or interrupt sessions.
 
```

**File**: `README.zh.md` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ chorus upgrade --plugins   # 同时刷新已配置 Agent 的 Chorus 插件
 
 自升级支持 Linux、macOS 和 Windows 上当前使用的 **npm 全局安装**：检查 npm prefix、查询最新稳定版本、避免降级，并在安装后验证版本。源码目录、链接、npx 和其他包管理器安装请使用各自的更新方式。CLI 检查、安装或版本验证失败后，不会继续更新插件。
 
-`--plugins` 读取 `~/.chorus/daemon.json`，兼容旧版单 Agent 配置。明确指定 Claude Code、Codex、Kiro、Pi 类型的记录都会处理，不受唤醒开关影响；按每条记录的 home、配置目录和 PATH 定位宿主，共享目标只更新一次。仅刷新 Chorus 及必需的集成依赖，保留已有凭证和无关设置，不安装宿主 CLI。Kiro 模板来自记录配置的 Chorus 实例（以该实例提供的版本为准，可能落后于 npm），共享目录对应不同实例时报告冲突。Pi 会探测是否支持定向更新 Chorus 和 `pi-mcp-adapter`；旧宿主不支持时报告未完成，部分安装也不会误报全部刷新，更不会更新其他扩展。固定版本、版本范围及非 latest 标签会保留并报告未完成；需移除这些约束后才能更新到最新。
+`--plugins` 读取 `~/.chorus/daemon.json`，兼容旧版单 Agent 配置。明确指定 Claude Code、Codex、Kiro、Pi 类型的记录都会处理，不受唤醒开关影响；按每条记录的 home、配置目录和 PATH 定位宿主，共享目标只更新一次。仅刷新 Chorus 及必需的集成依赖，保留已有凭证和无关设置，不安装宿主 CLI。Kiro 模板来自记录配置的 Chorus 实例（以该实例提供的版本为准，可能落后于 npm），共享目录对应不同实例时报告冲突。稳定版 Pi >=0.99.0 <2.0.0 使用原生 MCP，仅定向更新 Chorus；Pi 0.84.4–0.98.x 保留已验证的 `pi-mcp-adapter@5.0.0` 策略固定版本。未知版本不操作 adapter、不宣称 MCP 已完成；不支持的宿主不执行包命令。只做定向更新，绝不更新全部扩展；缺少能力或约束不兼容时报告未完成。保留用户 pins/ranges（验证过的 adapter 固定版本是预期策略，不算刷新未完成）。原生宿主已有 adapter 或 `-builtin:mcp` 时仅按作用域提示手动迁移，不自动卸载或改设置。详见 [Pi 接入](docs/CONNECT_PI.md)。
 
 命令非交互执行并逐项汇总。退出码 **0** 表示请求全部完成（配置不存在或为空也算成功）；**1** 表示失败或未全部完成，包括 offline、未知或缺少类型的记录、宿主缺失及不支持定向更新。单个插件失败不影响后续目标，已完成的变更不回滚。更新后请开启新的 Agent 会话，并在方便时重启 daemon；命令本身不会重启进程或中断现有会话。
 
```

**File**: `cli/__tests__/init-credential-seed.test.mjs` (modified, +11/-1)
```diff
@@ -1096,6 +1096,16 @@ function fakePiWrite(overrideFn) {
 }
 
 describe("seedCredentials — Pi ~/.pi/agent/mcp.json adapter sink", () => {
+  it.each([["0.87.1", "mcp-adapter.json", "directTools:true"], ["1.0.2", "mcp.json", "default codemode"], ["unknown", "mcp.json", "incomplete"]])("writes backend-specific configuration for %s", async (version, name, hint) => {
+    const write = fakePiWrite();
+    const results = await seedCredentials(baseCtx({ selection: ["pi"], env: { PI_CODING_AGENT_DIR: "/tmp/pi-seed-fixture" },
+      run: () => ({ ok: true, stdout: version }), flags: { url: "https://c", apiKey: "cho_secret" },
+      appendAgent: fakeAppend(), writePiMcp: write, validateCredentials: async () => ({ uuid: "u-pi", name: "Pi" }) }));
+    const result = [].concat(results)[0];
+    expect(write.calls[0].configPath).toBe(join("/tmp/pi-seed-fixture", name));
+    expect(result.detail).toContain(hint);
+    expect(result.detail).not.toContain("cho_secret");
+  });
   it("single pi: writes mcp.json under PI_CODING_AGENT_DIR with only { configPath, url } (no key), sets piMcpWritten, never leaks the key", async () => {
     const write = fakePiWrite();
     const res = await seedCredentials(
@@ -1115,7 +1125,7 @@ describe("seedCredentials — Pi ~/.pi/agent/mcp.json adapter sink", () => {
     // The writer is called with ONLY the config path + url — the API key is never passed here
     // (it lives as the env-referenced ${CHORUS_API_KEY} the writer emits into the header).
     expect(write.calls).toHaveLength(1);
-    expect(write.calls[0]).toEqual({ configPath: join("/tmp/xyz-pi-agent", "mcp.json"), url: "https://c" });
+    expect(write.calls[0]).toMatchObject({ configPath: join("/tmp/xyz-pi-agent", "mcp.json"), url: "https://c", backend: expect.any(Object) });
     expect(write.calls[0]).not.toHaveProperty("apiKey");
     expect(o.detail).not.toContain("cho_secret"); // key never echoed
     expect(o.detail).toMatch(/mcp\.json \(0600\)/);
```

**File**: `cli/__tests__/init-integration.test.mjs` (modified, +2/-0)
```diff
@@ -240,6 +240,8 @@ describe("chorus init — end-to-end (real registry, injected collaborators)", (
     // One shared command runner for every installer. openclaw's INSTALL fails
     // (version probe passes); everything else succeeds.
     const run = (cmd, args = []) => {
+      if (cmd === "pi" && args[0] === "--version") return { ok: true, stdout: "1.0.2" };
+      if (cmd === "pi" && args.includes("--help")) return { ok: true, stdout: "--extension <source> --no-approve" };
       if (cmd === "openclaw" && args[0] === "--version") return { ok: true, stdout: "openclaw 2026.9.9" };
       if (cmd === "openclaw" && args[0] === "plugins" && args[1] === "install") {
         return { ok: false, stderr: "simulated openclaw install failure" };
```

**File**: `cli/__tests__/init-plugin-install.test.mjs` (modified, +0/-120)
```diff
@@ -15,12 +15,10 @@ import {
   installOpencode,
   installDsh,
   installOpenclaw,
-  installPi,
   readCodexInstallState,
   readOpencodeInstallState,
   readDshInstallState,
   readOpenclawInstallState,
-  readPiInstallState,
   openclawMinHostVersion,
   guided,
   GUIDED_MESSAGES,
@@ -541,124 +539,6 @@ describe("openclawMinHostVersion (read from the package, not hardcoded)", () =>
   });
 });
 
-describe("installPi (npm-published pi extension + pi-mcp-adapter)", () => {
-  const PI_ADAPTER = "npm:pi-mcp-adapter";
-  const PI_SPEC = "npm:@chorus-aidlc/chorus-pi";
-
-  it("installs pi-mcp-adapter FIRST (the tool surface), then chorus-pi, when pi is on PATH", () => {
-    const run = fakeRun(() => ({ ok: true, code: 0, stdout: "", stderr: "" }));
-    const res = installPi({ run, env: {}, binaryOnPath: () => true });
-    expect(res.action).toBe(INSTALLED);
-    expect(run.calls).toHaveLength(2);
-    expect(run.calls[0].cmd).toBe("pi");
-    expect(run.calls[0].args).toEqual(["install", PI_ADAPTER]); // adapter first — it exposes chorus_* tools
-    expect(run.calls[1].args).toEqual(["install", PI_SPEC]); // then the chorus-pi package
-    expect(res.detail).toContain(PI_ADAPTER);
-    expect(res.detail).toContain(PI_SPEC);
-  });
-
-  it("degrades gracefully (UNSUPPORTED + BOTH manual commands) when pi is absent, running NOTHING", () => {
-    const run = fakeRun();
-    const res = installPi({ run, env: {}, binaryOnPath: () => false });
-    expect(res.action).toBe(UNSUPPORTED); // NOT a FAILURE_ACTION → init never aborts
-    expect(res.detail).toContain(`pi install ${PI_ADAPTER}`);
-    expect(res.detail).toContain(`pi install ${PI_SPEC}`);
-    expect(run.calls).toHaveLength(0); // no guessed command executed
-  });
-
-  it("reports FAILED (not a throw) and does NOT install chorus-pi when the adapter install fails", () => {
-    const run = fakeRun((cmd, args) => (args[1] === PI_ADAPTER ? { ok: false, code: 1, stderr: "adapter boom" } : { ok: true }));
-    const res = installPi({ run, env: {}, binaryOnPath: () => true });
-    expect(res.action).toBe(FAILED);
-    expect(res.detail).toContain("adapter boom");
-    expect(run.calls).toHaveLength(1); // stopped after the adapter failure — chorus-pi not attempted
-  });
-
-  it("reports FAILED (not a throw) when the chorus-pi install command fails", () => {
-    const run = fakeRun((cmd, args) => (args[1] === PI_SPEC ? { ok: false, code: 1, stderr: "boom" } : { ok: true }));
-    const res = installPi({ run, env: {}, binaryOnPath: () => true });
-    expect(res.action).toBe(FAILED);
-    expect(res.detail).toContain("boom");
-    expect(run.calls).toHaveLength(2); // adapter ok, then chorus-pi failed
-  });
-
-  it("SKIPS (already installed) and runs NOTHING when both packages are present and not updating", () => {
-    const run = fakeRun();
-    const res = installPi(
-      ctxFor("pi", {
-        run,
-        binaryOnPath: () => true,
-        state: { chorusPiInstalled: true, adapterInstalled: true },
-      }),
-    );
-    expect(res.action).toBe(SKIPPED);
-    expect(res.detail).toContain("already installed");
-    expect(run.calls).toHaveLength(0); // recognized existing install — no re-run
-  });
-
-  it("REPAIRS via `pi update --extensions` (NOT pi install) when both present and --update-installed is set", () => {
-    const run = fakeRun();
-    const res = installPi(
-      ctxFor("pi", {
-        run,
-        binaryOnPath: () => true,
-        flags: { updateInstalled: true },
-        state: { chorusPiInstalled: true, adapterInstalled: true },
-      }),
-    );
-    expect(res.action).toBe(REPAIRED);
-    // MUST use pi's real updater — `pi install` of an existing package does not pull
-    // the newer version and leaves pi's "updates available" nag showing.
-    expect(run.calls).toHaveLength(1);
-    expect(run.calls[0].cmd).toBe("pi");
-    expect(run.calls[0].args).toEqual(["update", "--extensions"]);
-    expect(res.detail).toContain("pi update --extensions");
-  });
-
-  it("REPAIRS a partial install (adapter present, chorus-pi missing) by installing both", () => {
-    const run = fakeRun();
-    const res = installPi(
-      ctxFor("pi", {
-        run,
-        binaryOnPath: () => true,
-        state: { chorusPiInstalled: false, adapterInstalled: true },
-      }),
-    );
-    expect(res.action).toBe(REPAIRED);
-    expect(run.calls).toHaveLength(2);
-  });
-});
-
-describe("readPiInstallState (settings.json packages probe)", () => {
-  const withPkgs = (packages) => ({ readJson: () => ({ packages }) });
-
-  it("detects both chorus-pi and pi-mcp-adapter from string package sources", () => {
-    const s = readPiInstallState(withPkgs(["npm:pi-mcp-adapter", "npm:@chorus-aidlc/chorus-pi"]));
-    expect(s.adapterInstalled).toBe(true);
-    expect(s.chorusPiInstalled).toBe(true);
-    expect(s.pluginInstalled).toBe(true); // both present
-  });
-
-  it("matches object-shaped package entries (source carried on a field)", () =
```

**File**: `cli/__tests__/pi-compatibility.test.mjs` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import { test } from "vitest";
+import assert from "node:assert/strict";
+import { readFileSync } from "node:fs";
+import {
+  PI_SUPPORTED_RANGE, PI_MIN_SUPPORTED_VERSION, PI_MAX_SUPPORTED_MAJOR,
+  PI_NATIVE_MCP_MIN_VERSION, PI_LEGACY_ADAPTER_SPEC,
+} from "../init/pi-compatibility.mjs";
+
+test("Pi package and installer share the verified host and adapter policy", () => {
+  const manifest = JSON.parse(readFileSync(new URL("../../packages/chorus-pi/package.json", import.meta.url)));
+  assert.equal(manifest.peerDependencies["@earendil-works/pi-coding-agent"], PI_SUPPORTED_RANGE);
+  assert.deepEqual(PI_MIN_SUPPORTED_VERSION, [0, 84, 4]);
+  assert.equal(PI_MAX_SUPPORTED_MAJOR, 2);
+  assert.deepEqual(PI_NATIVE_MCP_MIN_VERSION, [0, 99, 0]);
+  assert.equal(PI_LEGACY_ADAPTER_SPEC, "npm:pi-mcp-adapter@5.0.0");
+});
```

**File**: `cli/__tests__/pi-mcp-backend.test.mjs` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { parsePiVersion, probePiBackend, PI_CHORUS_SPEC } from "../init/pi-mcp-backend.mjs";
+import { PI_LEGACY_ADAPTER_SPEC } from "../init/pi-compatibility.mjs";
+import { installPi, readPiInstallState } from "../init/install-methods.mjs";
+
+const roots = [];
+afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
+function fixture(version = "1.0.2", packages = []) {
+  const root = mkdtempSync(join(tmpdir(), "pi-backend-"));
+  roots.push(root);
+  const env = { HOME: root, PI_CODING_AGENT_DIR: join(root, "agent"), PATH: "" };
+  const cwd = join(root, "project");
+  mkdirSync(join(cwd, ".pi"), { recursive: true });
+  mkdirSync(env.PI_CODING_AGENT_DIR);
+  const path = join(env.PI_CODING_AGENT_DIR, "settings.json");
+  writeFileSync(path, JSON.stringify({ theme: "keep", packages }));
+  const run = vi.fn((cmd, args) => ({ ok: true, stdout: args[0] === "--version" ? version : "--extension <source> --no-approve" }));
+  return { env, cwd, path, run, binaryOnPath: () => true };
+}
+const commands = (context) => context.run.mock.calls.filter(([, args]) => !args.includes("--version") && !args.includes("--help")).map(([, args]) => args);
+
+describe("Pi backend decision", () => {
+  it.each([
+    ["0.84.4", "legacy", true], ["0.87.1", "legacy", true], ["0.98.9", "legacy", true],
+    ["0.99.0", "native", true], ["0.99.2", "native", true], ["1.0.2", "native", true],
+    ["1.10.12", "native", true], ["0.100.12", "native", true], ["pi v1.0.2+build.47\n", "native", true],
+    ["0.84.3", "legacy", false], ["2.0.0", "native", false], ["10.12.34", "native", false],
+  ])("classifies %s", (output, mode, supported) => {
+    expect(parsePiVersion(output)).toMatchObject({ mode, supported });
+  });
+  it.each(["", "garbage", "0.99.0-beta.1", "v1.0.2-rc.0+build", "1.0", "1.0.2.3", "1.0.2 and 0.87.1", "01.0.2", null])("fails closed for %j", (output) => {
+    expect(parsePiVersion(output)).toMatchObject({ mode: "unknown", supported: null, version: null });
+  });
+  it("bounds version probes and handles errors, failures and timeout without echoing output", () => {
+    for (const run of [vi.fn(() => ({ ok: false, stdout: "1.0.2", error: "cho_SECRET" })), vi.fn(() => { throw new Error("timeout cho_SECRET"); })]) {
+      const result = probePiBackend({ run, env: {} });
+      expect(result.mode).toBe("unknown");
+      expect(JSON.stringify(result)).not.toContain("cho_SECRET");
+      expect(run.mock.calls[0][2].timeoutMs).toBe(5000);
+    }
+  });
+});
+
+describe("Pi install and state", () => {
+  it.each(["0.99.0", "0.99.2", "1.0.2", "1.10.2"])("installs native Chorus only on %s", (version) => {
+    const context = fixture(version);
+    expect(installPi(context)).toMatchObject({ action: "installed", complete: true });
+    expect(commands(context)).toEqual([["install", PI_CHORUS_SPEC, "--no-approve"]]);
+  });
+  it.each(["0.84.4", "0.87.1", "0.98.9"])("installs verified adapter before Chorus on %s", (version) => {
+    const context = fixture(version);
+    expect(installPi(context)).toMatchObject({ action: "installed", complete: true });
+    expect(commands(context)).toEqual([["install", PI_LEGACY_ADAPTER_SPEC, "--no-approve"], ["install", PI_CHORUS_SPEC, "--no-approve"]]);
+  });
+  it.each(["0.84.3", "2.0.0", "3.1.0"])("refuses unsupported host %s without package commands", (version) => {
+    const context = fixture(version);
+    expect(installPi(context)).toMatchObject({ action: "unsupported", complete: false });
+    expect(context.run.mock.calls.map(([, args]) => args)).toEqual([["--version"]]);
+  });
+  it.each(["", "nonsense", "1.0.2-beta"])("never touches adapter or claims completion for unknown %j", (version) => {
+    const context = fixture(version, [PI_LEGACY_ADAPTER_SPEC]);
+    expect(installPi(context)).toMatchObject({ action: "unsupported", complete: false, detail: expect.stringContaining("MCP setup incomplete") });
+    expect(commands(context)).toEqual([["install", PI_CHORUS_SPEC, "--no-approve"]]);
+  });
+  it("missing binary executes nothing and gives conditional manual guidance", () => {
+    const context = fixture();
+    const result = installPi({ ...context, binaryOnPath: () => false });
+    expect(result.action).toBe("unsupported");
+    expect(result.detail).toMatch(/native Pi.*legacy Pi.*Unknown\/unsupported/);
+    expect(context.run).not.toHaveBeenCalled();
+  });
+  it.each([[[]], [["npm:pi-mcp-adapter@99.0.0"]]])("skips native Chorus alone and ignores adapter constraints %j", (adapters) => {
+    const context = fixture("1.0.2", [PI_CHORUS_SPEC, ...adapters]);
+    expect(readPiInstallState(context)).toMatchObject({ chorusPiInstalled: true, pluginInstalled: true, adapterInstalled: !!adap
```

---

### Incident Patch 2: `628986a4` (2026-10-04)
**Commit Message**: fix: match Pi/dsh workflow tools and support Pi 1 native MCP (#597)

* fix: match Pi and dsh workflow tools by exact suffix

* fix: support Pi 1 native MCP reviewer workflows

**File**: `openspec/changes/archive/2026-10-04-fix-pi-dsh-workflow-tool-matching/.openspec.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+schema: spec-driven
+created: 2026-10-04
```

**File**: `openspec/changes/archive/2026-10-04-fix-pi-dsh-workflow-tool-matching/README.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# fix-pi-dsh-workflow-tool-matching
+
+Make Pi and dsh workflow nudges independent of MCP prefixes while retaining complete operation-name boundaries
```

**File**: `openspec/changes/archive/2026-10-04-fix-pi-dsh-workflow-tool-matching/design.md` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+# Design: exact workflow suffixes across Pi and dsh
+
+## Context and scope
+
+The three workflow operations are already enumerated in Pi's `NUDGE_TOOL_NAMES` and dsh's `ACTIONS`. Human answers selected arbitrary prefixes, including directly concatenated names such as `xchorus_submit_for_verify`, with an exact complete operation name at the end. Prefix recognition must not imply substring matching or accept extra trailing characters. The later human clarification in Idea comment `24942d56-adca-424e-8cc5-abf93145e2ff` explicitly removes Pi gateway-specific parsing: both hosts use their outer event identifiers uniformly.
+
+Pi's existing generic normalizer is also part of pending Proposal `1e831855-b9c5-4307-85b1-2ded89f48e6e`. Keep that generic behavior available and add workflow-specific suffix recognition first. This allows both efforts to coexist: the other proposal can extend generic native MCP handling without removing this workflow contract. The original main checkout is clean; implementation takes place in an isolated worktree on `fix/pi-dsh-workflow-tool-matching`.
+
+## Decisions and module contracts
+
+### Operation identification
+
+At each host's workflow recognition boundary, require a primitive string before examining it. Match only `name.endsWith(operation)` for the existing three-operation allowlist. Return the native operation string on a match; do not trim, coerce objects, fold case, strip trailing text, or impose a prefix/delimiter whitelist. Unknown or malformed values must never throw or cause a workflow reminder.
+
+Positive names for each operation: bare, `chorus_` prefix, `mcp__chorus__`, `mcp__chorus.`, `chorus__`, a custom dotted namespace, and directly glued `x`. Negative names: empty/null/undefined/non-string values, another Chorus operation, uppercase or incomplete operation names, and each valid operation followed by `_extra`, whitespace, or a newline. Plain `mcp` and `mcp__chorus` outer names do not end in a target operation and are not eligible, regardless of their arguments. JavaScript `endsWith` avoids the newline behavior of a regex `$` anchor.
+
+The existing generic normalizers may still return names for unrelated Chorus tools; the downstream workflow allowlist must continue rejecting those. Pi retains `null` and dsh retains `undefined` for unrecognized inputs. A workflow-specific helper may be introduced if it keeps generic normalization separate; identical behavior across hosts is required, not a shared cross-package runtime dependency.
+
+### Pi event identification and reminder delivery
+
+`resolveChorusToolName` normalizes only `event.toolName`. It does not inspect `input`, recognize gateway wrappers, or maintain a wrapper-name list. Every event uses the same exact workflow suffix rule, even when its prefix contains `mcp` or `gateway`. The human's later explicit instruction supersedes the original preservation of legacy `mcp` inner-name extraction; this is a deliberate scope correction, not an unnoticed regression.
+
+The existing `tool_result` handler remains the reminder owner. Preserve its configured-state and `isError` gates, the three reviewer toggles, and `sendUserMessage(..., { deliverAs: "steer" })`. Do not add reviewer injection to `tool_execution_end`, which serves the worker-session close fallback. Session creation, closure, retry, and duplicate-event behavior remain unchanged.
+
+### dsh action delivery
+
+Resolve workflow suffixes before the existing generic `mcp__chorus__` fallback or in a dedicated workflow helper. Keep the `tools/post-execute` conditions: existing agent state, non-synthetic calls, successful result, and downstream `accept`. Existing `ACTIONS` maps native operations to UUID argument fields and reminder text; preserve it.
+
+Keep action deduplication, pending-action limits, `agent/turn-stopping` delivery, session cleanup, and the daemon-origin early return. The change does not alter checkin's tool name or dsh's synthetic checkin path. dsh has no Pi-style gateway event contract in this scope.
+
+## Execution plan
+
+Two independent module tasks may run in parallel:
+
+1. Pi workflow suffix resolution, helper tests, and real extension-factory event tests.
+2. dsh workflow suffix resolution, helper matrix, and real plugin handler tests.
+
+Each task includes its own regression checks. Chorus task drafts are authoritative; `tasks.md` is a local checklist only. A third follow-up Pi task records and independently verifies the human's later instruction to remove gateway parsing without reopening the already verified original tasks. After that task passes, compare the hosts against the same positive/negative contract and repeat aggregate code review.
+
+## Validation and limitations
+
+- Pi: `bash test/all.sh` from `packages/chorus-pi`, including real factory event tests with mocked Pi/fetch; run package validation for packaging changes.
+- dsh: `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, and `pnpm run check:package` f
```

**File**: `openspec/changes/archive/2026-10-04-fix-pi-dsh-workflow-tool-matching/proposal.md` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+# Pi / dsh workflow tool-name matching
+
+## Why
+
+Pi and dsh can miss reviewer reminders when an MCP host changes the prefix of a Chorus tool. Pi currently understands bare and adapter-prefixed names, while dsh requires `mcp__chorus__`; neither consistently handles other namespaces. The human selected arbitrary prefixes with an exact complete operation-name suffix in elaboration round 1 of Idea `1f2b9067-2806-48ed-be14-414715ba7693`.
+
+## What Changes
+
+- Recognize the three workflow operations `chorus_pm_submit_proposal`, `chorus_submit_for_verify`, and `chorus_admin_verify_task` regardless of preceding text, provided the complete operation name ends the identifier.
+- Preserve existing normalizer behavior for other tools, and add targeted workflow recognition rather than changing unrelated MCP operations.
+- Match Pi events uniformly using the outer `toolName`, without gateway-specific branches or extracting `input.tool`, following the human's October 4 clarification (Idea comment `24942d56-adca-424e-8cc5-abf93145e2ff`).
+- Cover both hosts with parameterized positive/negative names and event-to-reminder tests. Retain error, feature-switch, lifecycle, and dsh daemon-origin gates.
+
+## Capabilities
+
+### New Capabilities
+
+- `workflow-tool-name-matching`: Host-independent recognition and reminder delivery for the three Chorus workflow operations in Pi and dsh.
+
+### Modified Capabilities
+
+None.
+
+## Impact
+
+Runtime changes are confined to `packages/chorus-pi` and `packages/chorus-dsh`, with focused tests and this OpenSpec change. No API, dependency, installation, credential, other-host, or release changes are required.
+
+The pending Pi native-MCP Proposal `1e831855-b9c5-4307-85b1-2ded89f48e6e` retains ownership of basic generic Pi name normalization and installation/documentation. This change layers workflow-specific recognition over existing behavior. Developers must recheck that proposal and the working tree before edits; reuse landed changes and preserve concurrent work. The baseline inspected for this change is `99aceb0b949bb6ddaea141d143085663e40a1104`, with a clean source working tree.
+
+Offline helper and real handler-factory tests are required. When a usable host environment is available, verify actual reminder injection in an isolated host session; otherwise report the host test as unverified rather than presenting offline tests as an end-to-end pass.
```

**File**: `openspec/changes/archive/2026-10-04-fix-pi-dsh-workflow-tool-matching/specs/workflow-tool-name-matching/spec.md` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+## Purpose
+
+Ensure Pi and dsh deliver the existing Chorus workflow reminders when host-specific namespaces change, while preserving complete operation-name boundaries and each host's original execution gates.
+
+## ADDED Requirements
+
+### Requirement: Workflow identification tolerates any prefix
+Pi and dsh SHALL recognize identifiers ending exactly with `chorus_pm_submit_proposal`, `chorus_submit_for_verify`, or `chorus_admin_verify_task`, with arbitrary preceding text or no prefix.
+
+#### Scenario: Supported and custom namespaces
+- **WHEN** an eligible successful event names one of the three operations with no prefix, `chorus_`, `mcp__chorus__`, `mcp__chorus.`, `chorus__`, or a custom namespace prefix
+- **THEN** the host identifies the same native workflow operation and makes its existing reminder available
+
+#### Scenario: Glued prefix
+- **WHEN** an eligible event names `xchorus_submit_for_verify`
+- **THEN** the host identifies `chorus_submit_for_verify` without requiring a delimiter
+
+### Requirement: Identification requires a complete ending
+Neither host SHALL produce a workflow reminder for a name lacking an exact complete target operation at its end. Empty, missing, and non-string name inputs SHALL be handled without throwing or producing a reminder.
+
+#### Scenario: Extra trailing text
+- **WHEN** an identifier ends with a target name followed by `_extra`, whitespace, or a newline
+- **THEN** no workflow reminder is produced
+
+#### Scenario: Similar or unrelated tool
+- **WHEN** an identifier is an incomplete or differently cased target name, `chorus_checkin`, or another unrelated tool
+- **THEN** no workflow reminder is produced
+
+#### Scenario: Malformed input
+- **WHEN** an outer tool name is empty, null, missing, an object, a boolean, or a number
+- **THEN** no workflow reminder is produced and recognition does not throw
+
+### Requirement: Pi uses one outer identifier matching rule
+Pi SHALL identify workflow operations solely from the event's outer `toolName` using the same arbitrary-prefix complete-ending rule as dsh. Pi SHALL NOT special-case gateway names or inspect `input.tool` to identify a workflow.
+
+#### Scenario: Gateway namespace in a target identifier
+- **WHEN** an eligible event's outer identifier is `custom.gateway.chorus_submit_for_verify`
+- **THEN** the existing enabled reminder is delivered using the uniform outer-name rule
+
+#### Scenario: Opaque wrapper or unrelated outer tool
+- **WHEN** the outer identifier is `mcp`, `mcp__chorus`, `bash`, or another non-target name and its arguments contain `tool: "chorus_submit_for_verify"`
+- **THEN** no workflow reminder is delivered
+
+#### Scenario: Arguments do not affect target identification
+- **WHEN** an eligible outer identifier ends exactly in a target operation and its input is missing, malformed, or names a different tool
+- **THEN** Pi identifies the outer operation without reading its input
+
+### Requirement: Existing execution gates and delivery are preserved
+Both hosts SHALL retain their original success, configuration, and lifecycle gates. Pi SHALL retain reviewer toggles and its tool-result delivery timing. dsh SHALL retain downstream acceptance, synthetic-call suppression, pending-action deduplication, and daemon-origin suppression.
+
+#### Scenario: Failed or disabled Pi event
+- **WHEN** a target event reports an error or its Pi reviewer switch is disabled
+- **THEN** no reminder is delivered
+
+#### Scenario: dsh event rejected by an existing gate
+- **WHEN** a target event fails, lacks a started agent, is synthetic, has a non-accept downstream decision, or occurs with daemon-origin lifecycle automation disabled
+- **THEN** no pending workflow reminder is added
+
+#### Scenario: dsh deduplicated delivery
+- **WHEN** multiple successful aliases of the same operation and target are accepted within one turn
+- **THEN** one existing reminder is delivered at turn stopping with the original target UUID
+
+### Requirement: Verification distinguishes offline and host evidence
+The change SHALL include positive and negative name matrices and event-to-reminder regression tests in both hosts. Verification reports SHALL distinguish mocked offline handler tests from actual host-session evidence.
+
+#### Scenario: Offline checks succeed
+- **WHEN** helper and host handler-factory tests pass without a live host session
+- **THEN** the report records them as offline verification
+
+#### Scenario: Host environment unavailable
+- **WHEN** usable host prerequisites cannot be obtained for an isolated smoke test
+- **THEN** the report records host reminder injection as unverified and states the missing prerequisite
```

**File**: `openspec/changes/archive/2026-10-04-fix-pi-dsh-workflow-tool-matching/tasks.md` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+## 1. Pi workflow recognition
+
+- [x] 1.1 Preserve generic normalization while adding exact suffix recognition for the three operations.
+- [x] 1.2 Initially resolve recognized gateway inner names (superseded by the human-directed follow-up below).
+- [x] 1.3 Add helper matrices and extension-factory reminder/gating tests; run the Pi offline suite.
+
+## 2. dsh workflow recognition
+
+- [x] 2.1 Add exact workflow suffix recognition without changing unrelated MCP, checkin, or lifecycle behavior.
+- [x] 2.2 Add helper matrices and plugin-handler reminder/gating tests.
+- [x] 2.3 Run dsh typecheck, lint, tests and package validation.
+
+## 3. Pi uniform outer-name follow-up
+
+- [x] 3.1 Remove all Pi gateway-specific name extraction and update the handler's parsing commentary.
+- [x] 3.2 Cover uniform outer-name matching and ignored input.tool values; rerun the Pi suite.
+- [x] 3.3 Independently review and admin-verify the follow-up task.
+
+## 4. Final verification
+
+- [x] 4.1 Independently review and admin-verify the two original Chorus tasks.
+- [x] 4.2 Inspect host prerequisites; record isolated smoke evidence or explicit limitations.
+- [x] 4.3 Pass aggregate code review against the latest human-directed scope.
+
+After the final review passes, archive the change, mirror the cumulative spec, and create the completion report.
```

**File**: `openspec/changes/archive/2026-10-04-verify-pi1-native-mcp-workflow/.openspec.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+schema: spec-driven
+created: 2026-10-04
```

**File**: `openspec/changes/archive/2026-10-04-verify-pi1-native-mcp-workflow/design.md` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+# Pi / dsh workflow design with Pi 1.x follow-up
+
+## Completed initial implementation
+
+# Design: exact workflow suffixes across Pi and dsh
+
+## Context and scope
+
+The three workflow operations are already enumerated in Pi's `NUDGE_TOOL_NAMES` and dsh's `ACTIONS`. Human answers selected arbitrary prefixes, including directly concatenated names such as `xchorus_submit_for_verify`, with an exact complete operation name at the end. Prefix recognition must not imply substring matching or accept extra trailing characters. The later human clarification in Idea comment `24942d56-adca-424e-8cc5-abf93145e2ff` explicitly removes Pi gateway-specific parsing: both hosts use their outer event identifiers uniformly.
+
+Pi's existing generic normalizer is also part of pending Proposal `1e831855-b9c5-4307-85b1-2ded89f48e6e`. Keep that generic behavior available and add workflow-specific suffix recognition first. This allows both efforts to coexist: the other proposal can extend generic native MCP handling without removing this workflow contract. The original main checkout is clean; implementation takes place in an isolated worktree on `fix/pi-dsh-workflow-tool-matching`.
+
+## Decisions and module contracts
+
+### Operation identification
+
+At each host's workflow recognition boundary, require a primitive string before examining it. Match only `name.endsWith(operation)` for the existing three-operation allowlist. Return the native operation string on a match; do not trim, coerce objects, fold case, strip trailing text, or impose a prefix/delimiter whitelist. Unknown or malformed values must never throw or cause a workflow reminder.
+
+Positive names for each operation: bare, `chorus_` prefix, `mcp__chorus__`, `mcp__chorus.`, `chorus__`, a custom dotted namespace, and directly glued `x`. Negative names: empty/null/undefined/non-string values, another Chorus operation, uppercase or incomplete operation names, and each valid operation followed by `_extra`, whitespace, or a newline. Plain `mcp` and `mcp__chorus` outer names do not end in a target operation and are not eligible, regardless of their arguments. JavaScript `endsWith` avoids the newline behavior of a regex `$` anchor.
+
+The existing generic normalizers may still return names for unrelated Chorus tools; the downstream workflow allowlist must continue rejecting those. Pi retains `null` and dsh retains `undefined` for unrecognized inputs. A workflow-specific helper may be introduced if it keeps generic normalization separate; identical behavior across hosts is required, not a shared cross-package runtime dependency.
+
+### Pi event identification and reminder delivery
+
+`resolveChorusToolName` normalizes only `event.toolName`. It does not inspect `input`, recognize gateway wrappers, or maintain a wrapper-name list. Every event uses the same exact workflow suffix rule, even when its prefix contains `mcp` or `gateway`. The human's later explicit instruction supersedes the original preservation of legacy `mcp` inner-name extraction; this is a deliberate scope correction, not an unnoticed regression.
+
+The existing `tool_result` handler remains the reminder owner. Preserve its configured-state and `isError` gates, the three reviewer toggles, and `sendUserMessage(..., { deliverAs: "steer" })`. Do not add reviewer injection to `tool_execution_end`, which serves the worker-session close fallback. Session creation, closure, retry, and duplicate-event behavior remain unchanged.
+
+### dsh action delivery
+
+Resolve workflow suffixes before the existing generic `mcp__chorus__` fallback or in a dedicated workflow helper. Keep the `tools/post-execute` conditions: existing agent state, non-synthetic calls, successful result, and downstream `accept`. Existing `ACTIONS` maps native operations to UUID argument fields and reminder text; preserve it.
+
+Keep action deduplication, pending-action limits, `agent/turn-stopping` delivery, session cleanup, and the daemon-origin early return. The change does not alter checkin's tool name or dsh's synthetic checkin path. dsh has no Pi-style gateway event contract in this scope.
+
+## Execution plan
+
+Two independent module tasks may run in parallel:
+
+1. Pi workflow suffix resolution, helper tests, and real extension-factory event tests.
+2. dsh workflow suffix resolution, helper matrix, and real plugin handler tests.
+
+Each task includes its own regression checks. Chorus task drafts are authoritative; `tasks.md` is a local checklist only. A third follow-up Pi task records and independently verifies the human's later instruction to remove gateway parsing without reopening the already verified original tasks. After that task passes, compare the hosts against the same positive/negative contract and repeat aggregate code review.
+
+## Validation and limitations
+
+- Pi: `bash test/all.sh` from `packages/chorus-pi`, including real factory event tests with mocked Pi/fetch; run package validation for packaging changes
```

---

### Incident Patch 3: `62f2ea02` (2026-10-03)
**Commit Message**: fix: patch security dependencies and align Prisma migration CLI (#594)

* docs: specify dependency security and migration compatibility fixes

* fix: patch application and build security dependencies

* docs: clarify patched nanoid branches and final graph verification

* fix: derive Docker migration CLI from the installed Prisma trio

* test: verify security fixes across production architectures and databases

* docs: archive verified security remediation specifications

---------

**File**: `.dockerignore` (modified, +3/-0)
```diff
@@ -8,3 +8,6 @@ packages
 !.env.example
 .pglite
 .chorus
+coverage
+.playwright-mcp
+*.tsbuildinfo
```

**File**: `.github/workflows/test.yml` (modified, +5/-0)
```diff
@@ -42,6 +42,11 @@ jobs:
       - name: Install dependencies
         run: pnpm install --frozen-lockfile
 
+      - name: Verify production migration version
+        run: |
+          node --test scripts/__tests__/prisma-migration-version.test.mjs
+          node scripts/prisma-migration-version.mjs
+
       - name: Generate Prisma client
         run: npx prisma generate
 
```

**File**: `Dockerfile` (modified, +9/-6)
```diff
@@ -36,6 +36,7 @@ COPY package.json pnpm-lock.yaml* ./
 RUN pnpm install --frozen-lockfile || pnpm install
 
 COPY . .
+RUN node scripts/prisma-migration-version.mjs > /prisma-migration-version
 RUN pnpm build
 
 # Dereference pnpm symlinks for PGlite packages (needed in production stage)
@@ -64,15 +65,17 @@ COPY --from=builder /app/prisma ./prisma
 COPY --from=builder /app/prisma.config.ts ./
 COPY --from=builder /app/package.json ./package.json
 COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
+COPY --from=builder /prisma-migration-version /tmp/prisma-migration-version
 
-# Install prisma CLI globally for database migrations. PIN to the app's @prisma/client
-# version — an unpinned `pnpm add -g prisma` floats to the latest release, and Prisma
-# CLIs newer than 7.3.0 dropped the `migrate deploy` command (docker-entrypoint.sh),
-# which made the container crash on startup → ECS circuit-breaker rollback. Keep this in
-# lockstep with the `prisma` / `@prisma/client` versions in package.json + pnpm-lock.yaml.
+# Install the exact stable CLI resolved and validated with the client and adapter
+# in the builder. Unversioned installs follow mutable npm dist-tags, which can
+# select a prerelease/new major; stable Prisma 7.x still supports migrate deploy.
 ENV PNPM_HOME="/root/.local/share/pnpm"
 ENV PATH="$PNPM_HOME:$PATH"
-RUN pnpm add -g prisma@7.3.0
+RUN PRISMA_MIGRATION_VERSION="$(cat /tmp/prisma-migration-version)" \
+ && test -n "$PRISMA_MIGRATION_VERSION" \
+ && pnpm add -g "prisma@$PRISMA_MIGRATION_VERSION" \
+ && rm /tmp/prisma-migration-version
 
 # Copy dotenv for prisma.config.ts (standalone bundles it into server.js but doesn't keep the module)
 COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
```

**File**: `openspec/changes/archive/2026-10-03-fix-security-dependencies-590-591/.openspec.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+schema: spec-driven
+created: 2026-10-03
```

**File**: `openspec/changes/archive/2026-10-03-fix-security-dependencies-590-591/README.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# fix-security-dependencies-590-591
+
+Update vulnerable application and build dependencies and align Prisma Docker migrations with stable 7.10.0
```

**File**: `openspec/changes/archive/2026-10-03-fix-security-dependencies-590-591/design.md` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+# Design
+
+## Context
+
+The baseline lockfile resolves Next.js 15.5.12, React 19.2.3 and Prisma 7.3.0. The Docker production stage separately installs Prisma 7.3.0 globally. Startup executes `prisma migrate deploy` for both external PostgreSQL and an embedded PGlite socket server.
+
+Existing evidence confirms Next.js 15.5.27 still pins PostCSS 8.4.31 and accepts sharp `^0.34.3 || ^0.35.4`. [3](ref:c907be29-c9cf-468d-8334-b1f38092663f) Prisma's `latest` tag points to an 8 RC, while 7.10.0 retains `migrate deploy` and requires Node `^20.19 || ^22.12 || >=24.0`. [4](ref:7833d6ac-c5d2-4251-93bc-fa276b1fe38c) [5](ref:35fd1d0d-884e-4dc7-9696-09c2cbb11154)
+
+The reported CVEs and scan improvements are reporter evidence, not independently reproduced results. This run must produce its own audit, build and runtime evidence.
+
+## Goals / Non-Goals
+
+Goals are patched target dependency resolution, matching production migration tooling, stable runtime behavior and reproducible evidence.
+
+This design does not change schema migrations, application authentication or deployment publication. It does not claim that updating the target packages eliminates all image vulnerabilities.
+
+## Decisions
+
+### D1. Patch existing major lines and serialize lockfile changes
+
+Use exact direct versions for Next.js / eslint-config-next 15.5.27, React / React DOM 19.2.8 and the Prisma trio 7.10.0. Regenerate the lockfile with the repository's pnpm version and validate a frozen installation. Do not perform unrelated broad updates.
+
+PostCSS candidates must be at least 8.5.18, nanoid 3.x at least 3.3.18 and sharp at least 0.35.4. Prefer current compatible patches (the issue reports 8.5.28, 3.3.19 and 0.35.5); record actual resolved versions. Confirm package availability and constraints using official package metadata during implementation.
+
+Scope nanoid overrides by major version so `docx` continues to resolve its 5.x dependency. Implementation audit also identified two advisories affecting the existing 5.1.9 resolution; use the compatible fixed 5.1.16 patch for that branch while updating 3.x to 3.3.19. [6](ref:6289f84e-8611-4b15-bd65-2da268aef4d4) [7](ref:32b759cb-ce66-4a02-8694-c45c003121b3) Select sharp override scope after checking its workspace consumers; validate any affected landing build. Retain the existing docx and shiki overrides.
+
+Task 1 and Task 2 execute sequentially because both update the same package manifest and lockfile.
+
+### D2. Derive the migration CLI from the installed build package
+
+After dependency installation in the builder, read `node_modules/prisma/package.json` and the installed client/adapter versions. Require all three to match an exact stable 7.x version, then export that version as a small build artifact. Copy this artifact into production and use it for an explicitly versioned global CLI install.
+
+The artifact avoids regex parsing of YAML peer suffixes and a fourth manually maintained version. A malformed version or mismatch must fail the image build rather than silently install a different CLI. A small executable helper with meaningful mismatch / prerelease failure tests is appropriate if validation would otherwise obscure the Dockerfile.
+
+Correct the comment: the risk is unversioned installation following mutable dist-tags. Later stable 7.x CLIs still support production migrations. Keep production's dotenv module and PGlite dependencies available.
+
+### D3. Verify the actual production path
+
+Use local production images on `linux/amd64` and `linux/arm64`. Emulated arm64 is acceptable for this local verification; identify emulation in the evidence. Existing native CI publication is unchanged.
+
+For both architectures, verify image versions and startup against external PostgreSQL TLS and embedded PGlite. Each database mode needs a new-database path and an existing-database path seeded by the baseline, followed by upgraded startup, migration count / seeded-row checks and a second startup. Temporary credentials, databases, volumes, ports and image tags must be dedicated to this effort.
+
+Verify `prisma generate`, `db push` (used by CI) and `migrate deploy`. Run existing type/lint/test/build checks. Final lint and full Vitest/coverage results must come from the completed manifest/lockfile after the Prisma upgrade; earlier application-only results do not replace them. Exercise health, login, authenticated and unauthenticated projects requests, representative rendered UI/CSS and sharp image processing.
+
+### D4. Security evidence covers the final image
+
+Capture baseline and updated dependency audit output and scan locally built baseline and updated images with the same scanner and vulnerability database. Record scanner version, database time, image identity and package findings. Image scans must include globally installed Prisma and OS packages.
+
+The acceptance target is removal of the reported HIGH/CRITICAL findings in patched target package ranges. Residual ups
```

**File**: `openspec/changes/archive/2026-10-03-fix-security-dependencies-590-591/proposal.md` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+# Dependency security and production migration compatibility
+
+## Why
+
+The checked-in lockfile and Docker migration CLI retain the dependency versions reported in Chorus #590 and #591. Operators need patched application and build dependencies while preserving production startup, database upgrades and the supported embedded database path. [1](ref:876ac293-e474-457b-8dcb-e8bc01458565) [2](ref:cacbd37d-1940-4b6f-b77f-a34691e142b3)
+
+## What Changes
+
+- Upgrade Next.js and its ESLint configuration to 15.5.27 and React / React DOM to 19.2.8, staying within the existing major versions.
+- Update vulnerable PostCSS, nanoid and sharp resolutions using scoped overrides where needed. Preserve nanoid 5.x consumers with a compatible patched 5.x release and retain the existing docx / shiki overrides.
+- Pin Prisma, its client and its PostgreSQL adapter together at 7.10.0. Derive the image migration CLI version from the package resolved during the build, and correct the Docker comment about unversioned installs.
+- Verify frozen installs, application and affected workspace builds, existing tests, CSS / image functionality, both supported image architectures and both external PostgreSQL TLS and embedded PGlite.
+- Deliver before/after dependency and final-image scan evidence, with upstream and OS findings explicitly separated from the remediated packages.
+
+The human selected runtime and build dependencies, both database paths, and implementation after proposal approval. YOLO authorization permits autonomous lifecycle gates; publishing or merging remains outside this run.
+
+## Capabilities
+
+### New Capabilities
+
+- `production-dependency-security`: patched dependency resolution without downgrading unaffected major versions, and transparent security verification for shipped images.
+- `database-migration-runtime`: stable, matching migration tooling and compatible startup upgrades for external and embedded databases.
+
+### Modified Capabilities
+
+None. The existing `docker-publish` behavior and registry/tag policy remain intact.
+
+## Impact
+
+`package.json`, `pnpm-lock.yaml`, `Dockerfile`, focused migration-version validation, security verification documentation and OpenSpec artifacts. There are no intended API or database schema changes. Validation uses isolated databases, containers and local image tags.
+
+Working tree: `/home/ubuntu/dev/Chorus-security-590-591`
+
+Aggregate review base: `b2e9b2e0`
```

**File**: `openspec/changes/archive/2026-10-03-fix-security-dependencies-590-591/specs/database-migration-runtime/spec.md` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+## Purpose
+
+Keep production database migration tooling stable and compatible with the generated client, preserving operator data during startup upgrades in external and embedded database deployments.
+
+## ADDED Requirements
+
+### Requirement: Matching stable migration tooling
+
+The production migration CLI SHALL use the exact stable 7.x version resolved for the client and adapter during the application build. Invalid or mismatched versions SHALL fail the build.
+
+#### Scenario: Matching versions produce the production CLI
+
+- **WHEN** the installed Prisma CLI, client and PostgreSQL adapter resolve to the same stable version
+- **THEN** the production image installs that exact migration CLI version
+- **AND** it provides the production migration command
+
+#### Scenario: Mismatched or prerelease versions fail
+
+- **WHEN** the build encounters differing versions or a prerelease version for the migration tooling
+- **THEN** the version-export step fails
+- **AND** no fallback to an unversioned installation occurs
+
+### Requirement: Compatible startup migrations on supported databases
+
+Patched production images SHALL complete startup migrations for new and existing external PostgreSQL TLS and embedded PGlite databases on amd64 and arm64, retaining seeded data and supporting repeated startup.
+
+#### Scenario: Fresh database startup
+
+- **WHEN** a patched image starts with a new supported database
+- **THEN** all pending migrations apply and the application becomes healthy
+
+#### Scenario: Existing database upgrade and repeated startup
+
+- **WHEN** a baseline database containing seeded records starts with a patched image and is subsequently restarted
+- **THEN** pending migrations apply without losing seeded records
+- **AND** repeated startup completes without reapplying completed migrations
+
+### Requirement: Development and CI database tooling remains usable
+
+The pinned database tooling SHALL preserve client generation and the database schema synchronization command used by CI.
+
+#### Scenario: CI preparation with patched tooling
+
+- **WHEN** CI generates the client and synchronizes an isolated test database
+- **THEN** both commands complete successfully with the pinned tooling
```

---

### Incident Patch 4: `9696a669` (2026-10-02)
**Commit Message**: fix(cli): enable systemd lingering on Linux daemon install (#593)

* feat(cli): ensure systemd lingering on Linux daemon install

chorus daemon install now runs loginctl enable-linger when Linger=no so the
systemd --user service survives logout and starts at boot. Fail-soft (warns +
prints the sudo fix, install still exits 0), --no-linger opts out, and
chorus daemon status warns when lingering is off.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* feat(cli): ensure lingering from chorus agents add + document it

The agents add daemon-setup step forwards --no-linger to installService and,
when the systemd unit is already installed, still runs the idempotent linger
check so a re-run repairs a Linger=no host. Document automatic lingering in
docs/DAEMON.md.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* chore(openspec): archive ensure-systemd-linger-on-install

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(cli): enable lingering without interactive polkit auth

loginctl enable-linger hard-codes SetUserLinger(uid, true, interactive=true),
so under an auth-requiring polkit policy the install could block on an auth
agent. 

**File**: `cli/__tests__/client-args.test.mjs` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ describe("parseClientFlags — new daemon flags", () => {
 
   it("parses boolean --chorus-only / --verbose / -d / --detach / --force", () => {
     expect(parseClientFlags(["--chorus-only"]).chorusOnly).toBe(true);
+    expect(parseClientFlags(["install", "--no-linger"]).noLinger).toBe(true);
+    expect(parseClientFlags(["install"]).noLinger).toBeUndefined();
     expect(parseClientFlags(["--verbose"]).verbose).toBe(true);
     expect(parseClientFlags(["-d"]).detach).toBe(true);
     expect(parseClientFlags(["--detach"]).detach).toBe(true);
```

**File**: `cli/__tests__/daemon-lifecycle-dispatch.test.mjs` (modified, +98/-0)
```diff
@@ -203,6 +203,59 @@ describe("runDaemon — supervisor (systemd) delegation", () => {
     expect(logs.join("")).toMatch(/NOT active/);
   });
 
+  it("status warns with the fix command when lingering is off (exit code unchanged)", async () => {
+    const service = installedActive();
+    service.lingerStatus = vi.fn(() => ({ state: "no", user: "ubuntu" }));
+    const logs = [];
+    const errs = [];
+    const code = await runDaemon(
+      { action: "status" },
+      { lifecycle: fakeLifecycle(), service, log: (m) => logs.push(m), errLog: (m) => errs.push(m), env: {} }
+    );
+    expect(code).toBe(0);
+    expect(errs.join("\n")).toMatch(/lingering is OFF for ubuntu/);
+    expect(errs.join("\n")).toContain("sudo loginctl enable-linger ubuntu");
+  });
+
+  it("status shows linger: yes and no warning when lingering is on", async () => {
+    const service = installedActive();
+    service.lingerStatus = vi.fn(() => ({ state: "yes", user: "ubuntu" }));
+    const logs = [];
+    const errs = [];
+    const code = await runDaemon(
+      { action: "status" },
+      { lifecycle: fakeLifecycle(), service, log: (m) => logs.push(m), errLog: (m) => errs.push(m), env: {} }
+    );
+    expect(code).toBe(0);
+    expect(logs.join("\n")).toMatch(/linger: yes/);
+    expect(errs).toEqual([]);
+  });
+
+  it("status prints nothing about lingering when its state is unknown", async () => {
+    const service = installedActive();
+    service.lingerStatus = vi.fn(() => ({ state: "unknown", user: "ubuntu" }));
+    const logs = [];
+    const errs = [];
+    const code = await runDaemon(
+      { action: "status" },
+      { lifecycle: fakeLifecycle(), service, log: (m) => logs.push(m), errLog: (m) => errs.push(m), env: {} }
+    );
+    expect(code).toBe(0);
+    expect([...logs, ...errs].join("\n")).not.toMatch(/linger/i);
+  });
+
+  it("status keeps exit 1 for an inactive unit even with the linger warning", async () => {
+    const service = fakeService({
+      detectSupervisor: () => ({ kind: "systemd", installed: true, active: false, unitPath: "/u" }),
+      lingerStatus: () => ({ state: "no", user: "ubuntu" }),
+    });
+    const code = await runDaemon(
+      { action: "status" },
+      { lifecycle: fakeLifecycle(), service, log: () => {}, errLog: () => {}, env: {} }
+    );
+    expect(code).toBe(1);
+  });
+
   it("stop delegates to systemctl stop and does not signal the pidfile", async () => {
     const service = installedActive();
     const lifecycle = fakeLifecycle();
@@ -447,6 +500,51 @@ describe("runDaemon — install / uninstall", () => {
     expect(errs.join("")).toMatch(/install failed: daemon-reload failed/);
   });
 
+  it("install reports lingering enabled and drops the old unconditional hint", async () => {
+    const service = fakeService({
+      installService: vi.fn(() => ({ platform: "linux", installed: true, unitPath: "/u", unitText: "", steps: ["wrote /u", "loginctl enable-linger ubuntu"], linger: { result: "enabled", user: "ubuntu" } })),
+    });
+    const logs = [];
+    const errs = [];
+    const code = await runDaemon(
+      { action: "install" },
+      { lifecycle: fakeLifecycle(), service, log: (m) => logs.push(m), errLog: (m) => errs.push(m), env: {} }
+    );
+    expect(code).toBe(0);
+    expect(logs.join("\n")).toMatch(/enabled systemd lingering for ubuntu/);
+    expect(logs.join("\n")).not.toContain('loginctl enable-linger "$USER"');
+    expect(errs.join("\n")).not.toMatch(/WARNING/);
+    expect(service.installService.mock.calls[0][0].noLinger).toBe(false);
+  });
+
+  it("install warns with the sudo fix but still exits 0 when lingering fails", async () => {
+    const service = fakeService({
+      installService: () => ({ platform: "linux", installed: true, unitPath: "/u", unitText: "", steps: ["wrote /u"], linger: { result: "failed", user: "ubuntu", error: "loginctl enable-linger failed: Access denied", fix: "sudo loginctl enable-linger ubuntu" } }),
+    });
+    const errs = [];
+    const code = await runDaemon(
+      { action: "install" },
+      { lifecycle: fakeLifecycle(), service, log: () => {}, errLog: (m) => errs.push(m), env: {} }
+    );
+    expect(code).toBe(0);
+    expect(errs.join("\n")).toContain("sudo loginctl enable-linger ubuntu");
+    expect(errs.join("\n")).toMatch(/STOP when you log out/);
+  });
+
+  it("install --no-linger threads noLinger into the service spec", async () => {
+    const service = fakeService({
+      installService: vi.fn(() => ({ platform: "linux", installed: true, unitPath: "/u", unitText: "", steps: [], linger: { result: "skipped" } })),
+    });
+    const logs = [];
+    const code = await runDaemon(
+      { action: "install", noLinger: true },
+      { lifecycle: fakeLifecycle(), service, log: (m) => logs.push(m), errLog: () => {}, env: {} }
+    );
+    expect(code).toBe(0);
+    expect(service.installService.mock.calls[0][0].noLinger).toBe(true);
+    expect(logs.join("\n")).not.toMatch(/linger/i);
+  });

```

**File**: `cli/__tests__/daemon-service.test.mjs` (modified, +257/-0)
```diff
@@ -18,8 +18,21 @@ import {
   systemctlUser,
   launchctl,
   resolveServicePaths,
+  currentUserName,
+  lingerStatus,
+  ensureLinger,
+  lingerMessages,
+  currentUserId,
+  LINGER_CALL_TIMEOUT_MS,
 } from "../daemon-service.mjs";
 
+/** The exact non-interactive SetUserLinger argv (uid 1000) the helper must spawn. */
+const SET_LINGER_ARGV = [
+  "busctl", "--system", "--allow-interactive-authorization=no", "--timeout=5s", "call",
+  "org.freedesktop.login1", "/org/freedesktop/login1", "org.freedesktop.login1.Manager",
+  "SetUserLinger", "ubb", "1000", "true", "false",
+];
+
 const BASE = {
   nodePath: "/usr/bin/node",
   scriptPath: "/opt/chorus/chorus.mjs",
@@ -456,3 +469,247 @@ describe("systemctlUser / resolveServicePaths", () => {
     expect(r.scriptPath).toMatch(/chorus\.mjs$/);
   });
 });
+
+describe("systemd lingering", () => {
+  /**
+   * A linux io whose loginctl answers are scripted per sub-command; every other
+   * command (systemctl) succeeds. Records every spawn as [cmd, ...args].
+   */
+  function lingerIO({ show = { status: 0, stdout: "no\n", stderr: "" }, enable = { status: 0, stdout: "", stderr: "" }, user = "ubuntu", uid = 1000, ...over } = {}) {
+    const calls = [];
+    const optsSeen = [];
+    const io = {
+      platform: "linux",
+      home: "/home/u",
+      mkdirSync: vi.fn(),
+      writeFileSync: vi.fn(),
+      existsSync: vi.fn(() => true),
+      unlinkSync: vi.fn(),
+      userInfo: () => ({ username: user, uid }),
+      env: {},
+      spawnSync: vi.fn((cmd, args, opts) => {
+        calls.push([cmd, ...args]);
+        // never through a shell — argv only
+        expect(opts?.shell).toBeFalsy();
+        if (cmd === "loginctl" || cmd === "busctl") optsSeen.push(opts);
+        if (cmd === "loginctl" && args[0] === "show-user") return typeof show === "function" ? show() : show;
+        if (cmd === "busctl" && args.includes("SetUserLinger")) return typeof enable === "function" ? enable() : enable;
+        return { status: 0, stdout: "", stderr: "" };
+      }),
+      ...over,
+    };
+    return {
+      io,
+      calls,
+      optsSeen,
+      loginctlCalls: () => calls.filter((c) => c[0] === "loginctl" || c[0] === "busctl"),
+    };
+  }
+
+  describe("currentUserName", () => {
+    it("prefers os.userInfo().username", () => {
+      expect(currentUserName({ userInfo: () => ({ username: "alice" }), env: { USER: "bob" } })).toBe("alice");
+    });
+    it("falls back to $USER then $LOGNAME when userInfo throws", () => {
+      const throwing = () => { throw new Error("no passwd entry"); };
+      expect(currentUserName({ userInfo: throwing, env: { USER: "bob" } })).toBe("bob");
+      expect(currentUserName({ userInfo: throwing, env: { LOGNAME: "carol" } })).toBe("carol");
+    });
+    it("returns null when nothing resolves", () => {
+      expect(currentUserName({ env: {} })).toBe(null);
+    });
+  });
+
+  describe("currentUserId", () => {
+    it("prefers os.userInfo().uid, then getuid, else null", () => {
+      expect(currentUserId({ userInfo: () => ({ uid: 1001 }), getuid: () => 5 })).toBe(1001);
+      expect(currentUserId({ userInfo: () => { throw new Error("x"); }, getuid: () => 5 })).toBe(5);
+      expect(currentUserId({})).toBe(null);
+    });
+  });
+
+  describe("lingerStatus", () => {
+    it("queries show-user with the explicit user and --value", () => {
+      const { io, calls } = lingerIO({ show: { status: 0, stdout: "yes\n", stderr: "" } });
+      expect(lingerStatus(io)).toEqual({ state: "yes", user: "ubuntu" });
+      expect(calls).toEqual([["loginctl", "show-user", "ubuntu", "-p", "Linger", "--value"]]);
+    });
+    it("reports no", () => {
+      const { io } = lingerIO();
+      expect(lingerStatus(io).state).toBe("no");
+    });
+    it("tolerates the Linger=yes form (no --value support)", () => {
+      const { io } = lingerIO({ show: { status: 0, stdout: "Linger=yes\n", stderr: "" } });
+      expect(lingerStatus(io).state).toBe("yes");
+    });
+    it("is unknown (never throws) on a non-zero exit", () => {
+      const { io } = lingerIO({ show: { status: 1, stdout: "", stderr: "Failed to get user: No such user" } });
+      const r = lingerStatus(io);
+      expect(r.state).toBe("unknown");
+      expect(r.error).toMatch(/No such user/);
+    });
+    it("is unknown (never throws) when loginctl is missing", () => {
+      const { io } = lingerIO({ show: { status: null, error: new Error("spawn loginctl ENOENT"), stdout: "", stderr: "" } });
+      const r = lingerStatus(io);
+      expect(r.state).toBe("unknown");
+      expect(r.error).toMatch(/ENOENT/);
+    });
+    it("is unknown when spawnSync throws", () => {
+      const r = lingerStatus({ userInfo: () => ({ username: "u" }), spawnSync: () => { throw new Error("boom"); } });
+      expect(r.state).toBe("unknown");
+    });
+    it("is unknown on unparseable output", () => {
+      const { io } = lingerIO({ show: { status: 0, stdout: "maybe", stderr: "" } });
+  
```

**File**: `cli/__tests__/init-args.test.mjs` (modified, +9/-0)
```diff
@@ -5,6 +5,15 @@ import { describe, it, expect } from "vitest";
 import { parseInitFlags, initHelpText } from "../init-args.mjs";
 
 describe("parseInitFlags", () => {
+  it("parses --no-linger (and leaves it unset by default)", () => {
+    expect(parseInitFlags(["--no-linger"]).noLinger).toBe(true);
+    expect(parseInitFlags([]).noLinger).toBeUndefined();
+  });
+
+  it("documents --no-linger in the help text", () => {
+    expect(initHelpText("0.0.0")).toMatch(/--no-linger/);
+  });
+
   it("parses --agents CSV (space + = forms) into a normalized id array", () => {
     expect(parseInitFlags(["--agents", "claude,codex"]).agents).toEqual(["claude", "codex"]);
     expect(parseInitFlags(["--agents=kiro,dsh"]).agents).toEqual(["kiro", "dsh"]);
```

**File**: `cli/__tests__/init-daemon-setup-integration.test.mjs` (modified, +14/-0)
```diff
@@ -24,8 +24,11 @@ describe("chorus init → daemon-setup → installService (integration, linux)",
       // unit not yet installed → detectSupervisor returns kind:none → not idempotent-skip
       existsSync: () => false,
       unlinkSync: () => {},
+      userInfo: () => ({ username: "u", uid: 1000 }),
       spawnSync: (cmd, args) => {
         spawnCalls.push([cmd, ...(args ?? [])]);
+        // A fresh host: lingering is off, and the user may enable it (polkit).
+        if (cmd === "loginctl" && args?.[0] === "show-user") return { status: 0, stdout: "no\n", stderr: "" };
         // systemctl --version (capability probe) and all install verbs succeed.
         return { status: 0, stdout: "systemd 255", stderr: "" };
       },
@@ -66,6 +69,17 @@ describe("chorus init → daemon-setup → installService (integration, linux)",
     expect(spawnCalls).toContainEqual(["systemctl", "--user", "daemon-reload"]);
     expect(spawnCalls).toContainEqual(["systemctl", "--user", "enable", "--now", "chorus-daemon.service"]);
 
+    // 2b. Lingering was ensured AFTER enable --now so the service survives logout.
+    const enableIdx = spawnCalls.findIndex((c) => c[0] === "systemctl" && c.includes("enable"));
+    const lingerIdx = spawnCalls.findIndex((c) => c[0] === "busctl" && c.includes("SetUserLinger"));
+    // non-interactive: interactive auth forbidden + interactive=false argument
+    expect(spawnCalls[lingerIdx]).toEqual([
+      "busctl", "--system", "--allow-interactive-authorization=no", "--timeout=5s", "call",
+      "org.freedesktop.login1", "/org/freedesktop/login1", "org.freedesktop.login1.Manager",
+      "SetUserLinger", "ubb", "1000", "true", "false",
+    ]);
+    expect(lingerIdx).toBeGreaterThan(enableIdx);
+
     // 3. Selection path: daemon-setup persisted NOTHING top-level. Per-agent creds +
     //    cwds + agentType are written by credential-seed into agents[] (not run here);
     //    step 1 skips resolveInstallCwds/Agent, and the gate validates with a no-op
```

**File**: `cli/__tests__/init-daemon-setup.test.mjs` (modified, +147/-0)
```diff
@@ -17,6 +17,8 @@ function ctx(over = {}) {
     autostartCapability: vi.fn(() => "systemd"),
     detectSupervisor: vi.fn(() => ({ kind: "none" })),
     installService: vi.fn(() => ({ platform: "linux", installed: true, unitPath: "/u", unitText: "Type=simple", steps: ["wrote /u", "systemctl --user enable --now chorus-daemon.service"] })),
+    // Never reach the REAL loginctl from a unit test (it would change the host).
+    ensureLinger: vi.fn(() => ({ result: "already", user: "u" })),
     resolveServicePaths: vi.fn(() => ({ nodePath: "/node", scriptPath: "/x/chorus.mjs", path: "/bin" })),
     resolveInstallCredentials: vi.fn(async () => ({ ok: true, creds: { url: "u", apiKey: "cho_k" }, identity: { uuid: "a", name: "Bot" } })),
     resolveInstallCwds: vi.fn(async () => ({ cwds: ["/a"] })),
@@ -152,6 +154,151 @@ describe("idempotency (report_skip_repair)", () => {
   });
 });
 
+describe("systemd lingering (ensure_linger)", () => {
+  const logText = (c) => c.io.log.mock.calls.flat().join("\n");
+
+  it("fresh install forwards noLinger:false and logs the enabled note", async () => {
+    const c = ctx({
+      flags: { daemonAutostart: true },
+      installService: vi.fn(() => ({ platform: "linux", installed: true, unitPath: "/u", unitText: "", steps: ["wrote /u", "loginctl enable-linger u"], linger: { result: "enabled", user: "u" } })),
+    });
+    const r = await setupDaemon(c);
+    expect(r.action).toBe(INSTALLED);
+    expect(c.installService.mock.calls[0][0].noLinger).toBe(false);
+    expect(logText(c)).toMatch(/\[chorus agents add\] enabled systemd lingering for u/);
+  });
+
+  it("fresh install with --no-linger forwards noLinger:true", async () => {
+    const c = ctx({ flags: { daemonAutostart: true, noLinger: true } });
+    await setupDaemon(c);
+    expect(c.installService.mock.calls[0][0].noLinger).toBe(true);
+  });
+
+  it("a linger failure keeps the outcome INSTALLED and logs the sudo fix", async () => {
+    const c = ctx({
+      flags: { daemonAutostart: true },
+      installService: vi.fn(() => ({ platform: "linux", installed: true, unitPath: "/u", unitText: "", steps: ["wrote /u"], linger: { result: "failed", user: "u", error: "Access denied", fix: "sudo loginctl enable-linger u" } })),
+    });
+    const r = await setupDaemon(c);
+    expect(r.action).toBe(INSTALLED);
+    expect(logText(c)).toContain("sudo loginctl enable-linger u");
+  });
+
+  it("already-installed systemd: ensures lingering, stays SKIPPED, never reinstalls", async () => {
+    const serviceIo = { platform: "linux" };
+    const c = ctx({
+      flags: { daemonAutostart: true },
+      serviceIo,
+      detectSupervisor: vi.fn(() => ({ kind: "systemd", installed: true, active: true, unitPath: "/u" })),
+      ensureLinger: vi.fn(() => ({ result: "enabled", user: "u" })),
+    });
+    const r = await setupDaemon(c);
+    expect(r.action).toBe(SKIPPED);
+    expect(r.detail).toMatch(/already configured.*enabled lingering/);
+    expect(c.ensureLinger).toHaveBeenCalledWith(serviceIo);
+    expect(c.installService).not.toHaveBeenCalled();
+    expect(logText(c)).toMatch(/enabled systemd lingering/);
+  });
+
+  it("already-installed systemd with lingering already on: plain SKIPPED detail", async () => {
+    const c = ctx({
+      flags: { daemonAutostart: true },
+      detectSupervisor: vi.fn(() => ({ kind: "systemd", installed: true, active: true, unitPath: "/u" })),
+    });
+    const r = await setupDaemon(c);
+    expect(r.action).toBe(SKIPPED);
+    expect(r.detail).toBe("daemon already configured for auto-start (systemd) — left unchanged");
+    expect(c.ensureLinger).toHaveBeenCalledOnce();
+  });
+
+  it("already-installed systemd where lingering fails: SKIPPED with a warning", async () => {
+    const c = ctx({
+      flags: { daemonAutostart: true },
+      detectSupervisor: vi.fn(() => ({ kind: "systemd", installed: true, active: true, unitPath: "/u" })),
+      ensureLinger: vi.fn(() => ({ result: "failed", user: "u", error: "Access denied", fix: "sudo loginctl enable-linger u" })),
+    });
+    const r = await setupDaemon(c);
+    expect(r.action).toBe(SKIPPED);
+    expect(r.detail).toMatch(/lingering NOT enabled/);
+    expect(logText(c)).toContain("sudo loginctl enable-linger u");
+  });
+
+  it("already-installed systemd with --no-linger: no linger call", async () => {
+    const c = ctx({
+      flags: { daemonAutostart: true, noLinger: true },
+      detectSupervisor: vi.fn(() => ({ kind: "systemd", installed: true, active: true, unitPath: "/u" })),
+    });
+    const r = await setupDaemon(c);
+    expect(r.action).toBe(SKIPPED);
+    expect(c.ensureLinger).not.toHaveBeenCalled();
+  });
+
+  it("already-installed launchd never ensures lingering", async () => {
+    const c = ctx({
+      flags: { daemonAutostart: true },
+      autostartCapability: vi.fn(() => "launchd"),
+      detectSupervisor: vi.fn(() => ({ kind: "launchd", installed: true, active: true, label: "com.chorus.daemo
```

**File**: `cli/__tests__/linger-argv-e2e.test.mjs` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+// cli/__tests__/linger-argv-e2e.test.mjs
+// End-to-end `--no-linger` coverage from RAW argv (code-review N1): drive the real
+// arg parsers → the real dispatcher (runDaemon / runAgents → runInit → daemon-setup)
+// → the REAL installService, with only the leaf service IO faked. Asserts the unit is
+// still installed and that NO logind call (loginctl / busctl) is ever spawned — and,
+// as the control, that the same run WITHOUT --no-linger does make the
+// non-interactive SetUserLinger call.
+import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
+import { mkdtempSync, rmSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { parseClientFlags, parseDaemonAction } from "../client-args.mjs";
+import { runDaemon } from "../daemon.mjs";
+import { runAgents } from "../agents.mjs";
+import { runInit } from "../init.mjs";
+import { daemonSetupStep } from "../init/steps/daemon-setup.mjs";
+import { installService, resolveServicePaths } from "../daemon-service.mjs";
+
+// Isolate from the developer's real ~/.chorus (same as the sibling runDaemon suites).
+const REAL_HOME = process.env.HOME;
+const TMP_HOME = mkdtempSync(join(tmpdir(), "chorus-linger-e2e-home-"));
+beforeAll(() => {
+  process.env.HOME = TMP_HOME;
+});
+afterAll(() => {
+  process.env.HOME = REAL_HOME;
+  rmSync(TMP_HOME, { recursive: true, force: true });
+});
+
+/** A fake linux service IO: unit not yet installed, Linger=no, every call succeeds. */
+function fakeServiceIo() {
+  const spawnCalls = [];
+  const io = {
+    platform: "linux",
+    home: "/home/u",
+    mkdirSync: () => {},
+    writeFileSync: () => {},
+    existsSync: () => false,
+    unlinkSync: () => {},
+    userInfo: () => ({ username: "u", uid: 1000 }),
+    env: {},
+    spawnSync: (cmd, args) => {
+      spawnCalls.push([cmd, ...(args ?? [])]);
+      if (cmd === "loginctl" && args?.[0] === "show-user") return { status: 0, stdout: "no\n", stderr: "" };
+      return { status: 0, stdout: "systemd 255", stderr: "" };
+    },
+  };
+  const logind = () => spawnCalls.filter((c) => c[0] === "loginctl" || c[0] === "busctl");
+  const enabled = () => spawnCalls.some((c) => c[0] === "systemctl" && c.includes("enable"));
+  return { io, spawnCalls, logind, enabled };
+}
+
+/** Exactly what chorus.mjs does for `chorus daemon …`: parse, then dispatch. */
+async function chorusDaemon(argv, io) {
+  const flags = parseClientFlags(argv);
+  const action = parseDaemonAction(argv);
+  const service = {
+    detectSupervisor: () => ({ kind: "none" }),
+    installService: (spec) => installService(spec, io), // the REAL installService
+    resolveServicePaths: () => resolveServicePaths({ PATH: "/usr/bin:/bin" }),
+    installConfig: {
+      resolveInstallCredentials: vi.fn(async () => ({ ok: true, creds: { url: "u", apiKey: "cho_k" }, identity: { uuid: "a", name: "Bot" } })),
+      resolveInstallCwds: vi.fn(async () => ({ cwds: ["/a"] })),
+      resolveInstallAgent: vi.fn(async () => ({ ok: true, agent: "claude-code", cliPath: "/bin/claude", cliFound: true })),
+    },
+  };
+  return runDaemon({ ...flags, action }, { service, log: () => {}, errLog: () => {}, env: {}, isTTY: false });
+}
+
+/** `chorus agents add <argv>` → runAgents → runInit → the real daemon-setup step. */
+async function chorusAgentsAdd(argv, io) {
+  const deps = {
+    env: { PATH: "/usr/bin:/bin" },
+    io: { log: () => {}, isTTY: false },
+    detectAgents: async () => [{ id: "claude", displayName: "Claude Code", binaryOnPath: false, configDirPresent: false, detected: false }],
+    resolveSelection: async () => ({ selectedIds: ["claude"] }),
+    orderedSteps: () => [daemonSetupStep],
+    ctxExtras: {
+      serviceIo: io,
+      writeConfig: () => "/home/u/.chorus/daemon.json",
+      readJson: () => ({ agents: [{ agentType: "claude-code", daemonWake: true }] }),
+      resolve: () => ({ url: "https://c.example", apiKey: "cho_k", source: "env" }),
+      validate: async () => ({ uuid: "agent-1", name: "Bot" }),
+      processCwd: "/proj",
+    },
+  };
+  let forwarded;
+  const code = await runAgents(["add", ...argv], {
+    runInit: (a, o) => {
+      forwarded = a;
+      return runInit(a, { ...o, ...deps });
+    },
+  });
+  return { code, forwarded };
+}
+
+describe("--no-linger end-to-end from raw argv", () => {
+  it("`chorus daemon install --no-linger` installs the unit and makes no logind call", async () => {
+    const f = fakeServiceIo();
+    const code = await chorusDaemon(["install", "--no-linger", "--yes"], f.io);
+    expect(code).toBe(0);
+    expect(f.enabled()).toBe(true);
+    expect(f.logind()).toEqual([]);
+  });
+
+  it("control: `chorus daemon install` (no flag) enables lingering non-interactively", async () => {
+    const f = fakeServiceIo();
+    const code = await chorusDaemon(["install", "--yes"], f.io);
+    expect(code).toBe(0);
+    const set = f.logind().find((c) => c[0] === "busctl");
+    ex
```

**File**: `cli/client-args.mjs` (modified, +12/-3)
```diff
@@ -39,7 +39,7 @@ export const KNOWN_AGENTS = new Set(["claude-code", "codex", "kiro", "dsh"]);
  * @returns {{
  *   url?: string, apiKey?: string, yolo?: boolean, sigintTimeout?: string,
  *   agent?: string, chorusOnly?: boolean, verbose?: boolean, detach?: boolean,
- *   cwd?: string[], force?: boolean, yes?: boolean, help?: boolean,
+ *   cwd?: string[], force?: boolean, yes?: boolean, noLinger?: boolean, help?: boolean,
  * }}
  */
 export function parseClientFlags(argv) {
@@ -70,6 +70,7 @@ export function parseClientFlags(argv) {
     else if (a === "--force") out.force = true;
     else if (a === "--yes" || a === "-y") out.yes = true;
     else if (a === "--add") out.add = true;
+    else if (a === "--no-linger") out.noLinger = true;
     else if (a === "--help" || a === "-h") out.help = true;
   }
   return out;
@@ -151,6 +152,9 @@ OPTIONS
                            backend defaults to claude-code unless --agent/CHORUS_AGENT
                            is set or one is already stored. A non-TTY install behaves
                            as if --yes were passed.
+  --no-linger              Linux install: do NOT enable systemd lingering (by
+                           default install enables it, non-interactively, so the
+                           --user service survives logout and starts at boot)
   --verbose                More detailed per-wake logging
   --sigint-timeout <ms>    Grace window after SIGINT before a forceful kill
                            (env: CHORUS_DAEMON_SIGINT_TIMEOUT; default 10000)
@@ -175,8 +179,13 @@ SERVICE (install)
   claude-code default), then checks that backend's CLI is on PATH. Pass -y/--yes or
   run non-TTY to skip all prompts (credentials are still validated). The served
   cwds AND the chosen agent live in daemon.json — the unit captures only
-  --chorus-only, NOT --cwd or --agent. On macOS/Windows install prints a correct
-  template you install manually.
+  --chorus-only, NOT --cwd or --agent. A --user service only keeps running after
+  you log out (and starts at boot) with systemd lingering, so install enables it
+  (logind SetUserLinger with interactive auth disabled — it never waits on a
+  password prompt); if that is refused it warns and prints the
+  'sudo loginctl enable-linger <user>' command, and the install still succeeds. Pass --no-linger to skip it.
+  'chorus daemon status' warns when lingering is off; uninstall leaves it on.
+  On macOS/Windows install prints a correct template you install manually.
 
 EXAMPLES
   chorus daemon                        # Foreground, default yolo (TTY confirms once)
```

---

### Incident Patch 5: `f9446304` (2026-10-01)
**Commit Message**: fix: unpin Chorus CLI install command from @0.17.0 (#588)

* fix: unpin Chorus CLI install command from @0.17.0

Install Guide, i18n tips (en/zh/ja/ko), CONNECT docs, MCP_TOOLS.md and the
retired install stubs now show `npm install -g @chorus-aidlc/chorus` so users
get the latest release. The plugin wrappers' chorus >= 0.17.0 floor check is
unchanged. test-install-codex.sh now asserts the command is unpinned.

OpenSpec change: unpin-chorus-cli-install-version

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* chore(openspec): archive unpin-chorus-cli-install-version

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `cli/init/steps/credential-seed.mjs` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ function resolveDshHome(env) {
  * its doc-mirror wrapper (packages/chorus-dsh/bin/chorus-mcp-call.mjs) reads the
  * credential keys (CHORUS_URL / CHORUS_API_KEY) from `$DSH_HOME/.env` via node:util
  * `parseEnv` whenever the `chorus` CLI is absent from PATH (e.g. invoked via `npx`
- * rather than the documented `npm install -g @chorus-aidlc/chorus@0.17.0`
+ * rather than the documented `npm install -g @chorus-aidlc/chorus`
  * global-install path). Only a `dsh` selection ever reaches this writer; every
  * other agent gets no .env.
  *
```

**File**: `docs/CONNECT_CLAUDE_CODE.md` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ export CHORUS_API_KEY="cho_your_api_key"
 Install the Chorus CLI, then let `chorus agents add` install the plugin for Claude Code — it runs Claude Code's own `claude plugin` commands for you (registers the marketplace, installs `chorus@chorus-plugins`) and seeds your credentials:
 
 ```bash
-npm install -g @chorus-aidlc/chorus@0.17.0
+npm install -g @chorus-aidlc/chorus
 chorus agents add --agents claude
 ```
 
```

**File**: `docs/CONNECT_CLAUDE_CODE.zh.md` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ export CHORUS_API_KEY="cho_your_api_key"
 先全局安装 Chorus CLI，再用 `chorus agents add` 为 Claude Code 安装插件——它会替你执行 Claude Code 自己的 `claude plugin` 命令（注册 marketplace、安装 `chorus@chorus-plugins`）并写入凭据：
 
 ```bash
-npm install -g @chorus-aidlc/chorus@0.17.0
+npm install -g @chorus-aidlc/chorus
 chorus agents add --agents claude
 ```
 
```

**File**: `docs/CONNECT_CODEX.md` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ chorus agents add --agents codex
 5. Write `CHORUS_URL` / `CHORUS_API_KEY` / `CHORUS_AGENT_PROFILE` into `~/.codex/.env` (mode `0600`, idempotent, preserving your other entries). Codex loads this dotenv file into its **own process environment** at startup, so both its plugin hooks and the model's shell-tool `chorus` calls resolve your agent identity with **no manual export**.
 6. Write the native-MCP server block `[mcp_servers.chorus]` into `~/.codex/config.toml` with `url` + `bearer_token_env_var = "CHORUS_API_KEY"` — a **keyless** reference (no API key is stored in `config.toml`). Codex resolves that env var (from the `~/.codex/.env` in step 5) into the `Authorization: Bearer <key>` header when it connects to MCP.
 
-If `CHORUS_URL` / `CHORUS_API_KEY` aren't set, `chorus agents add` prompts for them interactively (provided you have a TTY). Don't have the `chorus` CLI yet? Install it globally with `npm install -g @chorus-aidlc/chorus@0.17.0`, then run `chorus agents add --agents codex`.
+If `CHORUS_URL` / `CHORUS_API_KEY` aren't set, `chorus agents add` prompts for them interactively (provided you have a TTY). Don't have the `chorus` CLI yet? Install it globally with `npm install -g @chorus-aidlc/chorus`, then run `chorus agents add --agents codex`.
 
 ### What needs no export
 
@@ -61,7 +61,7 @@ Codex will call `chorus_checkin()` via the MCP server and report back with your
 Pass the connection explicitly and skip prompts with `--yes` — no TTY required:
 
 ```bash
-npm install -g @chorus-aidlc/chorus@0.17.0
+npm install -g @chorus-aidlc/chorus
 chorus agents add --agents codex \
   --url https://chorus.example.com \
   --api-key cho_xxx --yes
```

**File**: `docs/CONNECT_CODEX.zh.md` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ chorus agents add --agents codex
 5. 把 `CHORUS_URL` / `CHORUS_API_KEY` / `CHORUS_AGENT_PROFILE` 写入 `~/.codex/.env`（`0600`、幂等、保留你的其它条目）。Codex 启动时会把这个 dotenv 文件加载进**自己的进程环境**，因此它的插件 hook 和模型在 shell 工具里调用 `chorus` 都能解析出你的 agent 身份，**无需手动 export**。
 6. 把原生 MCP 服务块 `[mcp_servers.chorus]` 写入 `~/.codex/config.toml`，使用 `url` + `bearer_token_env_var = "CHORUS_API_KEY"`——一个**不含密钥**的引用（`config.toml` 里不存任何 API key）。Codex 连接 MCP 时会从第 5 步的 `~/.codex/.env` 解析该环境变量，生成 `Authorization: Bearer <key>` 头。
 
-如果环境里没有 `CHORUS_URL` / `CHORUS_API_KEY`，`chorus agents add` 会在有 TTY 时交互式询问。还没安装 `chorus` CLI？先用 `npm install -g @chorus-aidlc/chorus@0.17.0` 全局安装，再运行 `chorus agents add --agents codex`。
+如果环境里没有 `CHORUS_URL` / `CHORUS_API_KEY`，`chorus agents add` 会在有 TTY 时交互式询问。还没安装 `chorus` CLI？先用 `npm install -g @chorus-aidlc/chorus` 全局安装，再运行 `chorus agents add --agents codex`。
 
 ### 哪些无需手动 export
 
@@ -61,7 +61,7 @@ Codex 会通过 MCP 调用 `chorus_checkin()`，返回你的 agent 身份、权
 显式传入连接信息，并用 `--yes` 跳过交互提示，无需 TTY：
 
 ```bash
-npm install -g @chorus-aidlc/chorus@0.17.0
+npm install -g @chorus-aidlc/chorus
 chorus agents add --agents codex \
   --url https://chorus.example.com \
   --api-key cho_xxx --yes
```

**File**: `docs/CONNECT_DSH.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ chorus agents add --agents dsh --dsh-profile <name>
 `~/.chorus/daemon.json` (mode 0600), and adds the `@chorus-aidlc/chorus-dsh`
 bundle to the profile if it is not already present. It reads the values from the
 shell environment above and prompts for anything missing on a TTY. Don't have
-the `chorus` CLI yet? Install it globally with `npm install -g @chorus-aidlc/chorus@0.17.0`,
+the `chorus` CLI yet? Install it globally with `npm install -g @chorus-aidlc/chorus`,
 then run `chorus agents add --agents dsh --dsh-profile <name>`.
 
 For a `dsh` agent, `chorus agents add` ALSO writes `CHORUS_URL`, `CHORUS_API_KEY`,
```

**File**: `docs/CONNECT_DSH.zh.md` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ chorus agents add --agents dsh --dsh-profile <name>
 `chorus agents add` 会校验你的 key，并把 `CHORUS_URL` + `CHORUS_API_KEY` 写入
 `~/.chorus/daemon.json`（权限 0600），如有需要还会把 `@chorus-aidlc/chorus-dsh`
 bundle 加入该 profile。它会从上面的 shell 环境读取这些值，缺失的值在有 TTY 时
-交互式询问。还没安装 `chorus` CLI？先用 `npm install -g @chorus-aidlc/chorus@0.17.0` 全局安装，再运行 `chorus agents add --agents dsh --dsh-profile <name>`。
+交互式询问。还没安装 `chorus` CLI？先用 `npm install -g @chorus-aidlc/chorus` 全局安装，再运行 `chorus agents add --agents dsh --dsh-profile <name>`。
 
 对于 `dsh` agent，`chorus agents add` 还会把 `CHORUS_URL`、`CHORUS_API_KEY` 和
 `CHORUS_AGENT_PROFILE`（该 agent 的 UUID）写入 `$DSH_HOME/.env`（默认 `~/.dsh/.env`，
```

**File**: `docs/CONNECT_KIRO.md` (modified, +2/-2)
```diff
@@ -41,7 +41,7 @@ chorus agents add --agents kiro
 5. Merge the `chorus` MCP server into `~/.kiro/settings/mcp.json`, **preserving any MCP servers you already had** and backing up the original once.
 6. Seed your Chorus credentials once into `~/.chorus/daemon.json`.
 
-If `CHORUS_URL` / `CHORUS_API_KEY` aren't set, `chorus agents add` prompts for them interactively (provided you have a TTY). Don't have the `chorus` CLI yet? Install it globally with `npm install -g @chorus-aidlc/chorus@0.17.0`, then run `chorus agents add --agents kiro`.
+If `CHORUS_URL` / `CHORUS_API_KEY` aren't set, `chorus agents add` prompts for them interactively (provided you have a TTY). Don't have the `chorus` CLI yet? Install it globally with `npm install -g @chorus-aidlc/chorus`, then run `chorus agents add --agents kiro`.
 
 ### Global (default) vs a project-local install
 
@@ -84,7 +84,7 @@ The `chorus` agent calls `chorus_checkin()` over MCP and reports back your agent
 Pass the connection explicitly and skip prompts with `--yes` — no TTY required:
 
 ```bash
-npm install -g @chorus-aidlc/chorus@0.17.0
+npm install -g @chorus-aidlc/chorus
 chorus agents add --agents kiro \
   --url https://chorus.example.com \
   --api-key cho_xxx --yes
```

---

### Incident Patch 6: `d41f871e` (2026-09-30)
**Commit Message**: chore: retrigger landing Cloudflare build for v0.20.0 posts

The Workers Builds run for 0033270e failed (~20 min, likely timeout);
local astro build passes. Empty commit to redeploy chorus-ai.dev.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>



---

### Incident Patch 7: `939c1f8f` (2026-09-29)
**Commit Message**: fix(ui): prevent mobile input focus zoom (#583)

* fix(ui): prevent mobile input focus zoom with a scoped font floor

* docs: record human acceptance of mobile input fix

* docs(openspec): archive fix-mobile-input-focus-zoom

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `docs/testing/mobile-input-focus-zoom.md` (added, +205/-0)
```diff
@@ -0,0 +1,205 @@
+# Mobile input focus zoom — implementation evidence
+
+Idea: `b2343e9a-802b-41fb-85a7-1080399aa4f5`  
+Proposal: `f3e4c48f-1513-4e6a-8541-707468dee59f`  
+Task: `38ff25cf-1990-4e76-a2b5-a0a92555e5bc`
+
+## Implementation
+
+The `mobile-input-text` class marks actual editable controls. The shared CSS
+rule applies below 768 CSS px and on coarse-primary-pointer, no-hover devices,
+including landscape phones above the desktop breakpoint. The font declaration
+is scoped and important so consumer `text-sm`, arbitrary small font utilities,
+and the Tiptap text descendants do not bypass the floor.
+
+The default floor is `max(16px, 1rem)`. A deliberately larger input uses
+`--mobile-input-font-size` to retain its larger size. The source inventory found
+no production editable control with intentional typography above 16px; a 24px
+variant is included in the browser fixture. Wider fine-pointer desktop
+typography retains its existing values.
+
+Input, Textarea, CommandInput, and MentionEditor apply the marker centrally.
+The two direct native textarea consumers and the native directory-root select
+also apply it. The native select was discovered during implementation and uses
+the same policy; its change handler and native picker remain intact.
+
+No viewport, gesture, focus, IME, submission, data model, or editor content
+serialization code is changed.
+
+## Verification recorded on 2026-09-29
+
+- TypeScript: `pnpm exec tsc --noEmit` passed.
+- ESLint: all seven changed TSX files passed.
+- Existing tests: 9 files / 85 tests passed, covering IME, global search,
+  MentionEditor popup/selection/reply, mention picker confirmation, directory
+  browser, conversational entry, and instruction input. Existing RadioGroup
+  controlled/uncontrolled warnings appeared in conversational-entry tests.
+- `git diff --check` passed.
+- Impeccable detector: one warning on the pre-existing dynamically created
+  mention avatar `<img>`; the changed code does not touch it.
+- Chromium and desktop WebKit CSS fixtures: 12 cases per engine passed (six
+  viewport/input configurations, each in light and dark themes). Actual Input, Textarea, and CommandInput
+  components were rendered with React's server renderer. Native controls and
+  a contenteditable descendant fixture exercise the CSS rule separately.
+  These isolated fixtures are supplementary to the mounted checks below.
+- Mounted components in the temporary Next.js preview: 12 Chromium and 12
+  desktop WebKit cases passed, covering the same six viewport/input settings
+  and both themes. Checked real Tiptap paragraphs and mention nodes, shared
+  inputs, CommandInput, global search, group-name/description dialog and
+  document editing. Verified IME does not submit, ordinary Enter submits,
+  Shift+Enter retains newlines, mention insertion retains the marker, and no
+  page-level horizontal overflow appears. Document/group edits were cancelled,
+  never saved.
+- Browser paste handling: dispatched a text/plain ClipboardEvent into the real
+  Tiptap editor in both Chromium and desktop WebKit; the saved editor state
+  retained `粘贴中文\nPasted English`.
+- Actual application routes: `/login` returned 200 with 16px email/password
+  controls and local default login succeeded. `/projects` loaded authenticated;
+  its New Project dialog passed four 390/844px × light/dark input checks.
+  Screenshots were inspected with CSS transitions completed; the form was
+  cancelled without creating a project.
+- Independent read-only code preflight found no code blockers, missed editable
+  surfaces, important font conflicts, or concrete cmdk glyph clipping. This
+  preflight is not the formal Chorus task acceptance or ship-time gateway.
+
+| Width / input | Input / Textarea / Command / native textarea | Contenteditable descendant with 12px override | Larger variant | Native select | Read-only text |
+| --- | --- | --- | --- | --- | --- |
+| 390px / touch | 16px | 16px | 24px | 16px | 14px |
+| 844px / touch | 16px | 16px | 24px | 16px | 14px |
+| 767px / fine pointer | 16px | 16px | 24px | 16px | 14px |
+| 768px / touch | 16px | 16px | 24px | 16px | 14px |
+| 768px / fine pointer | 14px | 12px | 24px | 12px | 14px |
+| 1280px / fine pointer | 14px | 12px | 24px | 12px | 14px |
+
+The excluded checkbox remained at its original 12px font in every case.
+Chinese/English text and multiline native input values were retained.
+The final isolated fixtures use freshly compiled application CSS. The initial
+full-workspace compilation was blocked while scanning generated CDK asset
+directories, so compilation restricted automatic Tailwind scanning to `src`.
+The same build-only restriction is used in an isolated source copy at
+`/tmp/chorus-mobile-preview-t31adxyn`, served on port 8638. The production
+workspace's Tailwind source configuration is unchanged. The temporary
+`/mobile-input-check` route imports the actual application components; it is
+not added to the product. All eigh
```

**File**: `openspec/changes/archive/2026-09-29-fix-mobile-input-focus-zoom/.openspec.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+schema: spec-driven
+created: 2026-09-29
```

**File**: `openspec/changes/archive/2026-09-29-fix-mobile-input-focus-zoom/README.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# fix-mobile-input-focus-zoom
+
+Prevent input focus zoom across Chorus mobile text entry while retaining manual zoom
```

**File**: `openspec/changes/archive/2026-09-29-fix-mobile-input-focus-zoom/design.md` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+## Context
+
+用户确认目标环境为 iPhone Chrome，多处复现，范围为全站移动端输入。现有 UI 使用 Tailwind 4、共享 shadcn 风格控件、cmdk 与 Tiptap。
+
+代码观察（2026-09-29 工作区）：
+
+| 入口 | 当前行为与风险 |
+| --- | --- |
+| `src/components/ui/input.tsx`、`textarea.tsx` | 默认 `text-base md:text-sm`，但 `cn()` 最后合并调用方 className，较小字号覆盖可移除基础字号；横屏手机也可能跨过 md |
+| `src/components/global-search.tsx` | Input 调用方显式使用 `text-sm` |
+| `src/components/ui/command.tsx` | CommandInput 默认 `text-sm` |
+| `src/components/mention-editor.tsx` | 真正可编辑的 Tiptap 根节点使用 `text-sm`、`prose-sm`；外层 wrapper 并非输入节点 |
+| `src/components/manage-project-group-dialog.tsx` | 直接使用原生 textarea；同文件的 checkbox 不属于文本输入字号修复范围 |
+| `src/app/(dashboard)/projects/[uuid]/documents/[documentUuid]/document-content.tsx` | 文档编辑原生 textarea 使用 `text-sm` |
+| `src/app/layout.tsx`、`globals.css` | 未发现为本问题定制的 viewport 缩放限制；保留其现有职责 |
+
+以上是重点清单而非完整覆盖证明。实施时需逐项盘点共享组件调用方、原生控件和可编辑根节点，包含登录/入门、项目与分组、Idea/任务/提案表单、搜索、评论/对话、文档与管理页面。
+
+既有来源记录了 iOS Safari 小于 16px 的输入聚焦缩放现象；文章发表于 2021 年，不能代替 iPhone Chrome 真机验证。[1](ref:02559b31-0c6a-4b5d-8990-dbd0cf23d9d0) MDN 说明缩放限制和键盘视口行为，因此验收需观察比例，而非仅观察视口高度变化。[2](ref:21233df0-15f9-4cd5-9803-4a383bf256fc)
+
+## Goals / Non-Goals
+
+**Goals:** 移动端所有可编辑文本入口使用至少 16 CSS px 的计算字号；手机横竖屏输入不引起自动放大；保持主动缩放、IME、提交、提及选择与桌面体验。
+
+**Non-Goals:** 改造导航或键盘避让机制、整体放大全站文字、更改 API/数据模型、重写编辑器、禁用主动缩放。
+
+## Decisions
+
+### 1. 在实际输入节点复用移动字号规则
+
+在 `globals.css` 定义一个具名、限定范围的 `mobile-input-text` 样式，应用于共享 Input、Textarea、CommandInput、MentionEditor 的实际 editable 根节点以及排查发现的原生文本控件。
+
+规则在 `(max-width: 767px)` 或 `(hover: none) and (pointer: coarse)` 条件下启用。前者覆盖窄屏布局，后者使跨过 md 的横屏手机仍受保护；不通过 UA 字符串检测 iPhone，不依赖 hydration 或聚焦事件才更改字号。宽屏且主指针精细的桌面不触发规则。触屏平板使用可读字号是此移动输入策略的预期结果。
+
+规则的普通字号为 `max(16px, 1rem)`。如盘点发现本就使用更大字号的编辑入口，通过同一规则的显式 CSS 变量（如 `--mobile-input-font-size`）传递较大值，再取 `max(16px, 1rem, var(--mobile-input-font-size, 1rem))`，避免把更大的有意字号缩小。记录这些例外，禁止设置低于下限的覆盖。
+
+移动字号声明使用限定在此具名类上的 `!important`，确保组件调用方的 `text-sm`、`md:text-sm`、内联普通 fontSize 及 Tailwind 工具层不会打破下限。该类不是 `text-*` 工具类，避免被 `tailwind-merge` 合并删除。仅这一移动字号声明需要提升优先级，不扩展到行高、尺寸或全站字体。检查并清理冲突的 important 字号，不叠加更多竞争规则。
+
+对于 Tiptap，检查根节点及当前文本所在的 `p` 等后代的计算字号；消除 `prose-sm` 或后代字号规则对移动输入文字的影响，保证继承或显式应用相同下限。保留非编辑区域、提及菜单和只读 markdown 的文字层级。不使用 transform 缩小视觉文字。
+
+备选方案评估：只改基础组件遗漏调用方与编辑器；逐处仅添加 `text-base md:text-sm` 会遗漏横屏手机且容易再次被覆盖；全局无差别设置所有文字字号会扩大影响范围。因此采用明确标记、统一规则和全入口审计。
+
+### 2. 缩放与输入事件保持原生行为
+
+不增加 `user-scalable=no`、阻止放大的 `maximum-scale`、手势 preventDefault、touch-action 禁止缩放或聚焦后强制恢复比例的 JavaScript。不改变当前 Enter/Shift+Enter/IME guard、粘贴、自动聚焦和 mention picker 的控制逻辑。
+
+checkbox、radio、range、file、hidden、按钮、Radix Select 的按钮触发器、只读 markdown 不纳入文本字号规则；其嵌入的搜索输入如存在则纳入。可编辑文本型 input（含数字等键盘输入）与 textarea 是审计对象。disabled/readOnly 状态保留其语义，验收重点为可编辑状态。
+
+### 3. 覆盖与验收属于同一个交付任务
+
+此变更跨多个入口但共享同一字号契约，拆成多条组件任务会增加交接和遗漏风险。采用一个 5 点任务，顺序完成审计、统一样式、所有入口迁移和验证。
+
+## Module Contracts
+
+- 共享组件将移动规则挂到实际可编辑元素；消费端可以调整布局、颜色和桌面字号，移动文字不得小于 16 CSS px。
+- 原生文本控件应用同一规则；富文本后代不得绕过下限。
+- 所有支持状态下，文字、光标、placeholder 与多行内容应可见；因字号变大而需要的最小尺寸/行高修复只局限于受影响控件。
+- 大于 767px 且精细主指针的桌面保留现有计算字号；移动横屏不能因 md 响应式工具类退回较小字号。
+- 现有 IME、内容模型和输入回调契约保持不变。
+
+## Validation
+
+1. 记录源代码入口清单：每个实际编辑入口归入共享控件、原生控件或 Tiptap，注明对应规则与合理排除项；不要仅用 JSX 正则作为完整证明。
+2. 在运行中的应用检查真实 DOM 计算样式：至少 390px 竖屏、844px 横屏触摸、767/768px 边界与 1280px 精细指针桌面。覆盖带调用方 `text-sm` 覆盖的 Input、Textarea、CommandInput、MentionEditor 内容后代与两个已知原生 textarea；如 CommandInput 没有现成页面，使用临时组件预览检查并记录。
+3. 在 iPhone Chrome 真机记录设备、iOS/Chrome 版本、横竖屏与实际路由。测试键盘打开前后、输入、切换、失焦后再次聚焦；观察页面比例不变。可使用 `visualViewport.scale` 前后差值（稳定后不超过 0.01）或带浏览器环境说明的屏幕录像证明；视口高度变化和为光标滚动本身不算缩放失败。
+4. 在同一真机确认双指主动放大仍可用，放大后输入不强制恢复初始比例。检查搜索、评论/对话、表单、文档编辑的代表路径，并对样式审计发现的特殊覆盖单独复测。
+5. 对 Android Chrome、iPhone Safari 做代表入口回归；桌面检查现有字号、输入/提交和键盘导航。验证中文 IME、换行、提及插入、长文本及深浅主题无新增裁切或横向溢出。
+6. 运行受影响文件的 lint、TypeScript 检查及现有相关输入/IME/提及测试。以真实浏览器检查作为 CSS 证据，不增加仅断言 className 字符串的测试或把 jsdom/桌面 WebKit 当作 iPhone Chrome 缩放验证。
+
+真机不可用时，开发者应先完成可执行检查并通过 Chorus 评论请求设备验收，保留任务待验证；记录限制，不能以模拟器截图或自动化通过冒充真机验收完成。该设备证据是最终关闭此缺陷的条件，不阻塞方案审查。
+
+## Risks / Trade-offs
+
+- [触摸媒体查询覆盖宽屏平板] → 属于移动输入可读性策略；确认布局无裁切，精细主指针桌面保持原样。
+- [重要声明让消费端难以覆盖] → 只提升具名类的移动字号优先级；较大字体通过显式变量保留。
+- [Tiptap 子元素仍采用较小文字] → 逐层检查实际计算字号与光标位置，而不是只检查 wrapper。
+- [字号变化压缩紧凑搜索框/编辑器] → 在现有视觉系统内调整必要行高/高度，并测长文本和横屏。
+- [根因尚未真机确认] → 修复前后在目标环境采样；若达标字号仍放大，记录证据继续定位，不采用禁缩放兜底。
+
+## Migration Plan
+
+审批后在同一提交范围实现并验证，走项目正常发布流程；无数据迁移。回滚该样式与标记变更即可恢复旧行为。仅在任务验收完成后归档 OpenSpec 并同步累计 spec。
+
+## Open Questions
+
+产品范围已确认，无需新增澄清轮。实际设备/iOS/Chrome 版本由验收记录补齐，不能从 Safari 历史资料推定。
```

**File**: `openspec/changes/archive/2026-09-29-fix-mobile-input-focus-zoom/proposal.md` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+## Why
+
+用户已确认：在 iPhone Chrome 中，Chorus 多个输入位置点击后会自动放大，希望统一修复全站移动端输入框。聚焦引起的缩放改变阅读比例和操作位置，干扰连续输入。
+
+Idea `b2343e9a-802b-41fb-85a7-1080399aa4f5` 的两轮澄清已于 2026-09-29 经用户验证。小字号是代码与既有资料支持的排查方向，尚未在目标真机确认根因。[1](ref:02559b31-0c6a-4b5d-8990-dbd0cf23d9d0)
+
+## What Changes
+
+- 全站移动端文本输入采用一致的可读字号策略，覆盖普通输入、多行输入、搜索、评论/对话编辑器及页面直接使用的原生控件。
+- 在手机竖屏和横屏下，点击、输入、切换输入框不触发页面自动放大；允许正常键盘弹出和光标可见性滚动。
+- 保留主动双指缩放，避免通过 viewport 限制、拦截手势或重置页面缩放实现修复。[2](ref:21233df0-15f9-4cd5-9803-4a383bf256fc)
+- 保持桌面端现有字体层级、输入提交、IME、提及和焦点行为。
+- 交付包含输入入口清单、浏览器检查和 iPhone Chrome 真机验收记录。
+
+## Capabilities
+
+### New Capabilities
+
+无。
+
+### Modified Capabilities
+
+- `frontend-input`：追加移动端输入聚焦不放大、字号覆盖、缩放与输入交互保留要求；保留已有 IME 要求。
+
+## Impact
+
+主要涉及 `src/app/globals.css`、`src/components/ui/{input,textarea,command}.tsx`、`src/components/mention-editor.tsx`，以及全站输入调用方和原生 textarea。实施前清点 `src/app`、`src/components` 中所有实际编辑入口。既有 `cn()` 使用 tailwind-merge，调用方的 `text-sm` 可覆盖基础组件的 `text-base`，需在方案中处理。
+
+这是一个完整的输入体验修复任务，包含实现及验收，无任务间依赖。无 API、数据库、依赖包变更或新界面；不扩展为全站排版重设计、键盘布局改造或禁用缩放。
+
+资料复用 Idea 的两份已读来源，不重复外部调研。方案阶段完成代码排查，未声称已验证浏览器修复效果。
```

**File**: `openspec/changes/archive/2026-09-29-fix-mobile-input-focus-zoom/specs/frontend-input/spec.md` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+## ADDED Requirements
+
+### Requirement: Mobile text entry SHALL avoid focus-triggered page zoom
+
+Chorus SHALL keep the page zoom level stable when the user focuses, types in, blurs, or switches between editable text controls on mobile, with iPhone Chrome as the primary reported acceptance environment. This SHALL cover shared inputs, textareas, search inputs, native text controls, and rich-text editing roots across the application. Normal keyboard-driven viewport resizing and scrolling to reveal the caret SHALL remain allowed.
+
+#### Scenario: Focus and switch between mobile inputs
+- **WHEN** a user on iPhone Chrome focuses an input, types, switches to another input and refocuses the first
+- **THEN** these actions SHALL NOT automatically enlarge the page or leave it enlarged
+- **AND** input content and the caret SHALL remain visible and usable
+
+#### Scenario: Rich text and direct native controls
+- **WHEN** a user edits a comment or conversation in MentionEditor, a project group description, or a document body
+- **THEN** the same no-focus-zoom behavior SHALL apply to each actual editing surface
+
+#### Scenario: Keyboard reduces visible height
+- **WHEN** the mobile keyboard opens or the browser scrolls to reveal the caret
+- **THEN** normal viewport height and scroll changes SHALL be allowed without being treated as a zoom failure
+
+### Requirement: Mobile editable text SHALL have a consistent readable font floor
+
+Editable text SHALL compute to at least 16 CSS px when the viewport is at most 767 CSS px wide or the primary input has no hover and a coarse pointer. This floor SHALL apply before focus, survive consumer style overrides, and cover rich-text descendants containing editable text. Intentionally larger input typography SHALL NOT be reduced by the floor policy. On wider fine-pointer desktop environments, existing typography SHALL be preserved.
+
+#### Scenario: A consumer requests compact text
+- **WHEN** a mobile Input consumer supplies a compact class such as `text-sm`
+- **THEN** the actual editable text SHALL still compute to at least 16 CSS px
+
+#### Scenario: Phone rotates across the desktop breakpoint
+- **WHEN** a phone with a coarse primary pointer and no hover rotates into a viewport wider than 767 CSS px
+- **THEN** editable text SHALL retain the mobile font floor despite desktop breakpoint classes
+
+#### Scenario: Editor descendants and larger text
+- **WHEN** a rich-text editor renders paragraphs or an input intentionally uses a font larger than the minimum
+- **THEN** editable paragraphs SHALL respect the floor and the intentionally larger input SHALL retain its larger typography
+
+#### Scenario: Desktop input remains compact
+- **WHEN** a user views the application at 1280 CSS px with a fine primary pointer
+- **THEN** input font sizes SHALL retain their existing desktop values
+
+### Requirement: Focus zoom prevention SHALL preserve user zoom and input semantics
+
+The implementation MUST preserve user-initiated pinch zoom, existing IME handling, Enter and Shift+Enter semantics, focus handling, paste, mention insertion, and text state. It MUST NOT disable page zoom through viewport limits or gesture interception, reset zoom on focus, or shrink input text with transforms to evade focus zoom.
+
+#### Scenario: User intentionally zooms
+- **WHEN** a mobile user pinches to enlarge the page and subsequently focuses an input
+- **THEN** manual enlargement SHALL remain available and input focus SHALL NOT forcibly reset that chosen page scale
+
+#### Scenario: Compose and submit text
+- **WHEN** a user confirms a Chinese IME candidate, inserts a mention, pastes text, or submits outside composition
+- **THEN** the pre-existing input behavior SHALL remain intact and entered text SHALL be preserved
+
+### Requirement: Mobile focus zoom acceptance SHALL include target-device evidence
+
+Verification MUST include a source-level inventory of application text entry points, computed-style checks for representative shared, overridden, native and rich-text controls, desktop regression checks, and iPhone Chrome device evidence in portrait and landscape. The record MUST identify the device, OS and browser version, tested routes and outcomes. Desktop browser emulation alone MUST NOT be reported as target-device verification.
+
+#### Scenario: Target device is available
+- **WHEN** the fix is accepted
+- **THEN** evidence SHALL show stable page scale during focus, typing and switching controls, continued manual zoom, and readable controls without newly introduced clipping
+
+#### Scenario: Target device is unavailable
+- **WHEN** only desktop or emulated checks can be executed
+- **THEN** those results SHALL be recorded as partial verification and target-device acceptance SHALL remain pending
```

**File**: `openspec/changes/archive/2026-09-29-fix-mobile-input-focus-zoom/tasks.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+## 1. 全站移动输入修复与验收
+
+一个 Chorus 任务覆盖以下顺序步骤；Chorus task `38ff25cf-1990-4e76-a2b5-a0a92555e5bc` 是任务及验收标准的权威来源，本文件不镜像为 Document。
+
+- [x] 1.1 盘点所有文本输入入口、消费方字号覆盖及富文本后代，记录移动与桌面基线。
+- [x] 1.2 实现限定范围的共享移动输入字号规则并迁移共享组件、实际编辑根节点及原生文本控件，处理横屏及必要布局修复。
+- [x] 1.3 已由用户于 2026-09-29 明确豁免 pen 同步（“不用管pen文件，继续推进，用脚本部署，然后开pr到develop”）；未修改或宣称验收 design.pen。
+- [x] 1.4 执行计算样式、桌面/Android/Safari 回归、既有相关测试和静态检查，记录覆盖清单。
+- [x] 1.5 通过 Chorus 获取用户验收结论：2026-09-29 16:21 UTC 用户明确“我验证通过了，继续chorus的流程”；按该人工验收继续，未虚构设备/版本或逐场景结果。
+
+实施证据：`docs/testing/mobile-input-focus-zoom.md`。1.4 的静态检查、85 项既有测试、Chromium/WebKit 组件与样式检查及实际登录/项目表单检查已通过；此前待补充的移动验证现以用户总体验收结论记录，设备明细和分浏览器结果未提供。1.3 已豁免；脚本部署及 PR #583 已完成，等待用户指定的 Admin Claude 独立评审、管理验收及通过后的合并。
```

**File**: `openspec/specs/frontend-input/spec.md` (modified, +61/-0)
```diff
@@ -39,3 +39,64 @@ The check SHALL be performed via the shared helper `isImeComposing(e)` exported
 - **WHEN** `isImeComposing` is called with either a `React.KeyboardEvent` (from a React `onKeyDown` prop) or a raw `KeyboardEvent` (from Tiptap's `editorProps.handleKeyDown` callback)
 - **THEN** the helper SHALL return the same boolean result for equivalent events; consumers SHALL NOT need to unwrap or normalize the event before calling the helper
 
+### Requirement: Mobile text entry SHALL avoid focus-triggered page zoom
+
+Chorus SHALL keep the page zoom level stable when the user focuses, types in, blurs, or switches between editable text controls on mobile, with iPhone Chrome as the primary reported acceptance environment. This SHALL cover shared inputs, textareas, search inputs, native text controls, and rich-text editing roots across the application. Normal keyboard-driven viewport resizing and scrolling to reveal the caret SHALL remain allowed.
+
+#### Scenario: Focus and switch between mobile inputs
+- **WHEN** a user on iPhone Chrome focuses an input, types, switches to another input and refocuses the first
+- **THEN** these actions SHALL NOT automatically enlarge the page or leave it enlarged
+- **AND** input content and the caret SHALL remain visible and usable
+
+#### Scenario: Rich text and direct native controls
+- **WHEN** a user edits a comment or conversation in MentionEditor, a project group description, or a document body
+- **THEN** the same no-focus-zoom behavior SHALL apply to each actual editing surface
+
+#### Scenario: Keyboard reduces visible height
+- **WHEN** the mobile keyboard opens or the browser scrolls to reveal the caret
+- **THEN** normal viewport height and scroll changes SHALL be allowed without being treated as a zoom failure
+
+### Requirement: Mobile editable text SHALL have a consistent readable font floor
+
+Editable text SHALL compute to at least 16 CSS px when the viewport is at most 767 CSS px wide or the primary input has no hover and a coarse pointer. This floor SHALL apply before focus, survive consumer style overrides, and cover rich-text descendants containing editable text. Intentionally larger input typography SHALL NOT be reduced by the floor policy. On wider fine-pointer desktop environments, existing typography SHALL be preserved.
+
+#### Scenario: A consumer requests compact text
+- **WHEN** a mobile Input consumer supplies a compact class such as `text-sm`
+- **THEN** the actual editable text SHALL still compute to at least 16 CSS px
+
+#### Scenario: Phone rotates across the desktop breakpoint
+- **WHEN** a phone with a coarse primary pointer and no hover rotates into a viewport wider than 767 CSS px
+- **THEN** editable text SHALL retain the mobile font floor despite desktop breakpoint classes
+
+#### Scenario: Editor descendants and larger text
+- **WHEN** a rich-text editor renders paragraphs or an input intentionally uses a font larger than the minimum
+- **THEN** editable paragraphs SHALL respect the floor and the intentionally larger input SHALL retain its larger typography
+
+#### Scenario: Desktop input remains compact
+- **WHEN** a user views the application at 1280 CSS px with a fine primary pointer
+- **THEN** input font sizes SHALL retain their existing desktop values
+
+### Requirement: Focus zoom prevention SHALL preserve user zoom and input semantics
+
+The implementation MUST preserve user-initiated pinch zoom, existing IME handling, Enter and Shift+Enter semantics, focus handling, paste, mention insertion, and text state. It MUST NOT disable page zoom through viewport limits or gesture interception, reset zoom on focus, or shrink input text with transforms to evade focus zoom.
+
+#### Scenario: User intentionally zooms
+- **WHEN** a mobile user pinches to enlarge the page and subsequently focuses an input
+- **THEN** manual enlargement SHALL remain available and input focus SHALL NOT forcibly reset that chosen page scale
+
+#### Scenario: Compose and submit text
+- **WHEN** a user confirms a Chinese IME candidate, inserts a mention, pastes text, or submits outside composition
+- **THEN** the pre-existing input behavior SHALL remain intact and entered text SHALL be preserved
+
+### Requirement: Mobile focus zoom acceptance SHALL include target-device evidence
+
+Verification MUST include a source-level inventory of application text entry points, computed-style checks for representative shared, overridden, native and rich-text controls, desktop regression checks, and iPhone Chrome device evidence in portrait and landscape. The record MUST identify the device, OS and browser version, tested routes and outcomes. Desktop browser emulation alone MUST NOT be reported as target-device verification.
+
+#### Scenario: Target device is available
+- **WHEN** the fix is accepted
+- **THEN** evidence SHALL show stable page scale during focus, typing and switching controls, continued manual zoom, and readable controls without newly introduced clippi
```

---

### Incident Patch 8: `4812a7f7` (2026-09-29)
**Commit Message**: fix: align Research actions with agent availability (#581)

* fix: require assigned online agents for Research actions

* docs: record approved Pencil waiver for Research delivery

* docs: normalize verification metadata formatting

* docs: archive verified Research availability change

* fix: complete Research locale parity and remove obsolete picker

**File**: `docs/verification/research-action-availability.md` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+# Research action availability verification
+
+- Idea: `940b328e-1d43-4a43-8a41-21be5f1212f5`
+- Proposal: `26509a17-eb29-444f-81fe-5719b400b2f7`
+- Task: `8ad6203a-fc72-4492-9a46-aa4cd237c883`
+- Branch: `fix/research-action-availability`
+- Base: `81172effdaa1bf7f5645d02249f2ab458c691784`
+
+## Implemented behavior
+
+The human selected `research_only` and `require_assignment`. Research now
+requires an owning agent and a same-agent effectively online presence connection.
+It exposes localized assignment/offline reasons through the existing desktop
+menu and mobile sheet, and uses that same disabled reason in its selection
+handler. The unassigned Research agent chooser is no longer reachable from this
+action. Assigned-agent cwd selection still uses captureSelection and atomic
+Research dispatch. Server authorization, eligibility, origin/cwd checks and the
+other stage actions are unchanged.
+
+## Automated verification
+
+Completed 2026-09-28:
+
+| Suite | Passing tests |
+| --- | ---: |
+| ResearchAction | 43 |
+| IdeaActionsMenu | 43 |
+| Research server actions | 10 |
+| Research eligibility service | 25 |
+| usePinThenWake | 19 |
+| YoloButton | 11 |
+| Total | 151 |
+
+Command:
+
+```sh
+pnpm test src/components/__tests__/research-action.test.tsx \
+  'src/app/(dashboard)/projects/[uuid]/dashboard/__tests__/idea-actions-menu.test.tsx' \
+  'src/app/(dashboard)/projects/[uuid]/ideas/[ideaUuid]/__tests__/research-actions.test.ts' \
+  src/services/__tests__/research-eligibility.service.test.ts \
+  src/hooks/__tests__/use-pin-then-wake.test.tsx \
+  src/components/__tests__/yolo-button.test.tsx
+```
+
+Also passed:
+
+- Scoped ESLint with `--no-ignore` for the modified component and both test files.
+- `pnpm exec tsc --noEmit --incremental false`.
+- `git diff --check`.
+- Impeccable mechanical detector on ResearchAction: no findings.
+
+Coverage includes missing/human assignment, missing presence provider,
+offline/stale/unrelated connections, owning-agent resolution for instances,
+mounted assignment and presence changes, reconnection while stage-blocked,
+pointer/Enter/Space guards, bilingual reasons, duplicate submissions, accepted
+repeat requests, server rejection, and ordinary/temporary cwd selection retries.
+The full repository suite and production build were not run.
+
+## Browser verification
+
+An isolated local PGlite database and Next.js webpack dev server were used at
+`http://localhost:8637`. The standard `dev:local` startup first hit Turbopack's
+restriction on the worktree's external node_modules symlink; webpack then
+started successfully. Login used local default auth, and fixture records were
+created through the local authenticated APIs.
+
+Fixtures:
+
+- Project: `0f94ecca-a499-4bcc-a739-3eb7aa28e8cf`.
+- Unassigned Idea: `51c8179f-5d3d-4a9e-978a-0634129ca6b5`.
+- Offline-assigned Idea: `764b773b-0b27-4670-b152-d509a6df69b2`.
+
+All 16 combinations passed: en/zh × desktop/mobile × light/dark ×
+offline/unassigned. Desktop viewport was 1440×1000; mobile was 390×844.
+Each case checked `aria-disabled`, the localized accessible description,
+pointer/Enter/Space suppression and continued menu visibility. Desktop tooltips
+were opened through focus and inspected; mobile reasons remained visible inline.
+The final screenshots were visually inspected in both themes, with no clipping
+of the Research explanation and clear focus styling.
+
+The browser harness waits for the panel's content and finite entry animations
+before interacting. Earlier harness attempts incorrectly set only the locale
+cookie (the client initializes from localStorage) or captured/moused over a
+moving sheet; those attempts were corrected and the final matrix rerun.
+
+Local, gitignored evidence:
+
+- `.playwright-mcp/research-{en,zh}-{desktop,mobile}-{light,dark}-{offline,unassigned}.png`
+- `.playwright-mcp/research-desktop-contact-sheet.png`
+- `.playwright-mcp/research-mobile-contact-sheet.png`
+- `.playwright-mcp/verify-research-en.js` and `verify-research-zh.js`
+
+This verifies the local application with real authenticated fixture records;
+it does not claim production deployment or execution by a live daemon.
+Live presence transitions and successful dispatch/error paths are covered by
+the focused automated tests.
+
+## Design waiver and review status
+
+`CLAUDE.md:215` requires updating `docs/design.pen` for every user-facing change
+through Pencil. This obligation was added to the proposal after the independent
+Round 1 review; Round 2 passed. On 2026-09-29, the human explicitly waived it for
+this delivery: “不用管pencil，推进到完成” (Idea comment
+`c24d81e7-78ed-4bec-960e-e517bea482f1`, author
+`aa0b0ed8-23c9-4046-9bf5-b0b99bcbde88`).
+
+Pencil `get_app_state` failed with “Failed to access file undefined. A file needs
+to be open in the editor to perform this action.” An explicit-file
+`execute` against `/home/ubuntu/dev/ai-pm-research-action/docs/design.pen` failed
+with the same no-open-
```

**File**: `messages/en.json` (modified, +2/-0)
```diff
@@ -1880,6 +1880,8 @@
     "idea_not_found": "This idea is no longer available.",
     "unauthorized": "Sign in as a user to request research.",
     "assignment_required": "Select an agent and instance to request research.",
+    "assignmentHint": "Assign an agent before requesting research.",
+    "offlineHint": "Agent offline. Reconnect to request research.",
     "permission_denied": "You must own the assigned agent, and it needs permission to read the plan, edit ideas, and attach references.",
     "agent_offline": "The assigned instance or conversation origin is offline. Reconnect it and retry.",
     "origin_conflict": "The conversation origin conflicts with the fixed working directory. Resolve the session target before retrying.",
```

**File**: `messages/ja.json` (modified, +2/-0)
```diff
@@ -1880,6 +1880,8 @@
     "idea_not_found": "このアイデアは利用できません。",
     "unauthorized": "ユーザーとしてログインしてリサーチを依頼してください。",
     "assignment_required": "リサーチを依頼するエージェントとインスタンスを選択してください。",
+    "assignmentHint": "リサーチを依頼する前にエージェントを割り当ててください。",
+    "offlineHint": "エージェントがオフラインです。再接続してリサーチを依頼してください。",
     "permission_denied": "割り当てたエージェントの所有者である必要があります。また、エージェントには計画の閲覧、アイデアの編集、参照の追加権限が必要です。",
     "agent_offline": "割り当てたインスタンスまたは会話の接続元がオフラインです。再接続して再試行してください。",
     "origin_conflict": "会話の接続元と固定作業ディレクトリが一致しません。会話の実行先を修正してください。",
```

**File**: `messages/ko.json` (modified, +2/-0)
```diff
@@ -1880,6 +1880,8 @@
     "idea_not_found": "이 아이디어를 사용할 수 없습니다.",
     "unauthorized": "사용자로 로그인하여 리서치를 요청하세요.",
     "assignment_required": "리서치를 요청할 에이전트와 인스턴스를 선택하세요.",
+    "assignmentHint": "리서치를 요청하기 전에 에이전트를 할당하세요.",
+    "offlineHint": "에이전트가 오프라인입니다. 다시 연결한 후 리서치를 요청하세요.",
     "permission_denied": "배정된 에이전트의 소유자여야 하며 에이전트에 계획 읽기, 아이디어 편집 및 참조 추가 권한이 필요합니다.",
     "agent_offline": "배정된 인스턴스 또는 대화의 원래 연결이 오프라인입니다. 다시 연결한 후 재시도하세요.",
     "origin_conflict": "대화의 원래 연결과 고정 작업 디렉터리가 충돌합니다. 대화 실행 대상을 수정하세요.",
```

**File**: `messages/zh.json` (modified, +2/-0)
```diff
@@ -1880,6 +1880,8 @@
     "idea_not_found": "此 Idea 已不可用。",
     "unauthorized": "请以用户身份登录后请求调研。",
     "assignment_required": "请选择 Agent 和实例以请求调研。",
+    "assignmentHint": "请先分配 Agent，再请求调研。",
+    "offlineHint": "Agent 离线，请重连后请求调研。",
     "permission_denied": "你需要拥有所分配的 Agent，且它必须有读取方案、编辑 Idea 和挂载引用的权限。",
     "agent_offline": "所分配的实例或会话来源已离线，请恢复连接后重试。",
     "origin_conflict": "会话来源与固定工作目录冲突，请先解决会话目标再重试。",
```

**File**: `openspec/changes/archive/2026-09-29-align-research-action-availability/.openspec.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+schema: spec-driven
+created: 2026-09-28
```

**File**: `openspec/changes/archive/2026-09-29-align-research-action-availability/README.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# align-research-action-availability
+
+Require an assigned online agent before triggering Research
```

**File**: `openspec/changes/archive/2026-09-29-align-research-action-availability/design.md` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+## Context
+
+ResearchAction owns dispatch and renders a StageAction into IdeaActionsMenu.
+Both desktop ActionItem and MobileActionItem already display disabled reasons,
+expose aria-disabled/aria-describedby, and prevent unavailable selections.
+Research currently checks stage eligibility but does not subscribe to presence.
+YoloButton uses useAgentPresenceOptional and assigneeOwningAgentUuid to require
+any connection of the owning agent with effectiveStatus === "online".
+
+## Decisions
+
+1. Subscribe ResearchAction to the existing presence context and use the same
+   owning-agent identity and effectiveStatus predicate as YOLO. A missing provider,
+   empty connections, stale/offline connections, or connections belonging only to
+   another agent do not qualify. An agent-instance's owning agent is used, not
+   its instance UUID. This intentionally aligns with the existing agent-level UI
+   baseline; precise pinned origin and fixed-cwd checks remain server-authoritative.
+2. Derive a single disabled reason shared by renderAction and onSelect. Preserve
+   external blocking and submission busy precedence; expose assignment required
+   and agent offline ahead of stage eligibility so recovery guidance is immediate.
+   Eligibility still runs and prevents actions when presence returns.
+3. Require an owning agent before the Research action can open anything. Remove
+   ResearchAction's ResearchAgentPicker state/render/fallback. Use a distinct
+   localized assignment hint so the existing server assignment_required error
+   can still describe cwd disambiguation without misleading unassigned users.
+4. Preserve usePinThenWake and its captureSelection adapter for already assigned
+   agents. Research's atomic selection dispatch must not be replaced with generic
+   assignment APIs, which can advance the Idea lifecycle. Keep single-submission
+   protection and queued/retry behavior.
+5. Keep existing menu visuals, focusable disabled entries, desktop tooltip and
+   mobile inline explanation. No new confirmation dialog or visual redesign.
+6. Limit this change to the Research UI. The backend continues rejecting offline,
+   stale, changed, unauthorized, or conflicting targets even when UI presence is
+   momentarily stale. Do not modify other stage actions or server selection APIs.
+
+## Risks and Validation
+
+- Presence is optimistic and agent-level: test backend agent_offline feedback
+  after an initially online client, and retain all server routing checks.
+- Assignment may change while the menu is mounted: rerender with null, a user,
+  an instance, and another agent; assert no unintended dispatch/chooser.
+- Regression tests must cover desktop pointer and keyboard activation, mobile
+  inline reasons, disconnect/reconnect, missing provider, unrelated/stale
+  connections, initial eligibility loading/failure, development eligibility,
+  in-flight duplicate clicks, and assigned cwd retry.
+- Run focused ResearchAction and IdeaActionsMenu tests, existing server-action
+  and research eligibility/service regressions, scoped lint and TypeScript.
+- Use the project's supported browser workflow to verify desktop/mobile disabled
+  states in both light and dark themes. These checks passed in the 16-case local
+  browser matrix. The human explicitly waived Pencil/design-file synchronization
+  for this delivery on 2026-09-29 (Idea comment
+  `c24d81e7-78ed-4bec-960e-e517bea482f1`: “不用管pencil，推进到完成”).
+  Record the waiver as the design portion of AC7; do not claim a Pencil update.
+
+## Delivery
+
+One cohesive implementation task, independently reviewed at task level and then
+at the whole-Idea code gateway. Worktree:
+`/home/ubuntu/dev/ai-pm-research-action`, branch
+`fix/research-action-availability`, base `81172eff` (origin/develop).
+After successful verification, archive the OpenSpec change and mirror the
+cumulative specification to Chorus. Commit locally; publishing or merging is
+outside the present YOLO authorization.
+
+At proposal revision 2, Pencil get_app_state and execute with the explicit
+worktree file path both returned "A file needs to be open in the editor to
+perform this action." The subsequent human waiver above resolves that delivery
+blocker. Independent task and aggregate code reviews still apply before completion.
```

---

### Incident Patch 9: `48e402f4` (2026-09-26)
**Commit Message**: feat(markdown): support inline evidence UUID citations (#576)

* feat(markdown): render evidence UUID citations

* docs: trim trailing blank line in citation spec

* fix(markdown): harden citation loading and refresh agent guides

* fix(markdown): preserve ordinary empty-target links

* chore(plugins): align helper versions and install guidance

* fix(review): defer version bumps and preserve citation mounts

**File**: `messages/en.json` (modified, +6/-0)
```diff
@@ -722,6 +722,12 @@
     "deleteFailedNotFound": "This document no longer exists."
   },
   "references": {
+    "citationLoading": "Loading evidence…",
+    "citationMissing": "Evidence not found",
+    "citationError": "Could not load evidence. Hover or focus to retry.",
+    "citationRefreshError": "Could not refresh evidence. Showing previously loaded details.",
+    "citationOpen": "Open evidence in a new tab",
+    "citationUnsafe": "This evidence URL cannot be opened.",
     "title": "References",
     "empty": "Link official docs, a reference implementation, or an issue thread to ground this in evidence.",
     "loading": "Loading references...",
```

**File**: `messages/ja.json` (modified, +6/-0)
```diff
@@ -722,6 +722,12 @@
     "deleteFailedNotFound": "この文書はすでに存在しません。"
   },
   "references": {
+    "citationLoading": "エビデンスを読み込み中…",
+    "citationMissing": "エビデンスが見つかりません",
+    "citationError": "エビデンスを読み込めませんでした。ホバーまたはフォーカスで再試行します。",
+    "citationRefreshError": "エビデンスを更新できませんでした。前回読み込んだ詳細を表示しています。",
+    "citationOpen": "新しいタブでエビデンスを開く",
+    "citationUnsafe": "このエビデンスのURLは開けません。",
     "title": "参考資料",
     "empty": "公式ドキュメント・参考実装・課題スレッドをリンクして、根拠を示しましょう。",
     "loading": "参考資料を読み込み中...",
```

**File**: `messages/ko.json` (modified, +6/-0)
```diff
@@ -722,6 +722,12 @@
     "deleteFailedNotFound": "이 문서는 더 이상 존재하지 않습니다."
   },
   "references": {
+    "citationLoading": "근거를 불러오는 중…",
+    "citationMissing": "근거를 찾을 수 없습니다",
+    "citationError": "근거를 불러오지 못했습니다. 마우스를 올리거나 포커스하여 다시 시도하세요.",
+    "citationRefreshError": "근거를 새로 고치지 못했습니다. 이전에 불러온 상세 정보를 표시합니다.",
+    "citationOpen": "새 탭에서 근거 열기",
+    "citationUnsafe": "이 근거 URL을 열 수 없습니다.",
     "title": "참고 자료",
     "empty": "공식 문서, 참고 구현체 또는 이슈 스레드를 연결해 근거를 마련하세요.",
     "loading": "참고 자료를 불러오는 중...",
```

**File**: `messages/zh.json` (modified, +6/-0)
```diff
@@ -722,6 +722,12 @@
     "deleteFailedNotFound": "该文档已不存在。"
   },
   "references": {
+    "citationLoading": "正在加载证据…",
+    "citationMissing": "证据不存在",
+    "citationError": "无法加载证据。悬停或聚焦以重试。",
+    "citationRefreshError": "无法刷新证据，当前显示上次加载的详情。",
+    "citationOpen": "在新标签页打开证据",
+    "citationUnsafe": "无法打开此证据链接。",
     "title": "参考资料",
     "empty": "链接官方文档、参考实现或 issue 讨论，为它提供佐证。",
     "loading": "加载参考资料中...",
```

**File**: `openspec/changes/archive/2026-09-25-add-inline-evidence-citations/.openspec.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+schema: spec-driven
+created: 2026-09-25
```

**File**: `openspec/changes/archive/2026-09-25-add-inline-evidence-citations/README.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# add-inline-evidence-citations
+
+Support resource-local evidence citations in Markdown bodies and comments
```

**File**: `openspec/changes/archive/2026-09-25-add-inline-evidence-citations/design.md` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+## Context
+
+本设计依据用户纠正：直接使用证据 UUID 链接，主要修改渲染层，不动数据结构。此前按每资源证据集合隔离的方案已作废，Document 不需要新挂载能力即可引用已存在的证据。
+
+现有 `src/app/api/references/[uuid]/route.ts` GET 已按 company 隔离且鉴权，并返回 `{success:true,data: ReferenceArtifactResponse}`；缺失或跨租户为 404。现有 `MarkdownContent` 是 Streamdown 统一入口，所有正文与评论经由该入口。
+
+## Goals / Non-Goals
+
+**Goals**：作者写 `[1](ref:UUID)`；读者看到 `[1]`，hover/focus 看详情、点击打开外链；失效显示灰色提示；Agent skill 能正确生成。
+
+**Non-Goals**：数据库/服务/API/MCP 契约变更、Document target、所属资源绑定、跨资源关联表、自动编号、快照、编辑器选择器、额外列表复制按钮、导出格式扩展。
+
+## Decisions
+
+### Markdown 链接语法
+
+规范示例为 `[1](ref:550e8400-e29b-41d4-a716-446655440000)`。显示文本由作者选择（推荐递增数字、重复同一证据复用数字），渲染为带方括号的小型引用标记；UUID 才是身份。保持标准 Markdown 解析，所以行内/围栏代码、转义文本不会转换。UUID 必须是 8-4-4-4-12 十六进制格式，大小写可读并规范化为小写。无效 ref 目标不能导航到自定义协议。
+
+在 MarkdownContent 合并 anchor override，保留调用者已有 custom tags（尤其 mentions）、components、allowedTags 和 literalTagContent。URL transform 只为合法 `ref:UUID` 保留自定义 scheme，其余交给 Streamdown 默认安全转换；普通链接仍使用 Streamdown 原有 renderer 或调用者原有 anchor override，确保普通链接行为不退化。先验证安装的 Streamdown 实际 API。
+
+### 直接 UUID 读取
+
+引用组件调用现有 GET `/api/references/<uuid>`（same-origin credentials）。渲染代码不接收 targetType/targetUuid，不验证“挂载在当前资源”；权限完全沿用现有接口。
+
+同一 Markdown 渲染树重复 UUID 共用客户端状态；不同渲染树只共用进行中的请求，请求结束即移除，不缓存全局已解析证据。最后一个消费者卸载时取消请求；组件卸载或 UUID 改变后忽略旧响应。IntersectionObserver 延迟屏幕外/被裁切引用的首次读取，进入可见区域或交互时加载；之后 hover/focus 与窗口重新聚焦可刷新已加载引用。请求和响应体解析整体限时 10 秒，超时取消并允许重试。无需改造服务端变更事件。
+
+区分 loading、ready、missing（404）、error（网络/其他 HTTP 错误）。无已加载数据时 loading/error 提示本地化文案且不导航，不能误报“证据不存在”。已 ready 的引用刷新失败时保留已有详情与链接，并显示本地化刷新失败说明；后续成功清除提示，404 必须移除链接。不承诺实时推送。
+
+格式错误的 ref 目标转为无 href 的普通文本，不生成空链接。Streamdown 默认 anchor 缺失时安全降级为文本，并在开发环境告警；sanitizer 匹配失败也在开发环境告警。仅以 block 中的引用链接组成 key，绕过 Streamdown paragraph/list 子元素仅比较源码位置导致的等长 UUID 修改缓存问题；周围正文增长与相邻代码/Mermaid block 不因此重新挂载或重新取数。
+
+### 引用交互
+
+使用现有 Tooltip/Popover 和 semantic tokens；hover/focus 展示 title、type、URL、非空 notes，长内容不超出视口。有效引用是标准 anchor，直接新标签页打开 HTTP(S) 原 URL，`rel=noopener noreferrer`，无额外确认。触屏点击直接打开链接。对旧数据中非 HTTP(S) URL 禁用跳转。
+
+missing 为灰色标记、无 href、保持可聚焦以获得“证据不存在”（以及其他 locale 对等文案）。所有状态有可访问文案，且兼容明暗主题。不要在引用弹层中递归解析 notes 的引用。
+
+### Skill 文档
+
+在现有 References/External Evidence 章节旁补充：先挂载/读取已有证据获取 reference UUID，然后在任意资源正文或评论中写 `[1](ref:UUID)`；UUID 是证据记录 UUID，不是 Idea/Task UUID，也不是证据 URL；有效引用跟随最新详情，失效保留灰色提示。说明现有 create 工具只能在创建返回 UUID 后写入正文引用，不能预先猜 UUID。更新七个文档分发端，保持端特有工具名称与约定。
+
+## Module Contracts
+
+- Task 2：新增纯 ref href 识别、安全 URL helper、客户端 UUID 详情状态和共享引用组件；只在 MarkdownContent 接入，不引入每资源 context props。完成语法/数据加载/真实 renderer 和 locale 测试。
+- Task 3：文档分发端同步与实际正文/评论集成验收；复用 Task 2 行为。无服务端改动。
+- Task 1：原 Document 扩展撤销并关闭，不再实施。
+
+## Risks / Trade-offs
+
+- 自定义 scheme 被 sanitizer 清掉 → 在 renderer 集成测试核对 urlTransform 管线，且只放行严格 UUID。
+- anchor override 破坏普通链接 → 保持普通链接的既有 renderer/安全行为，混合 Markdown 测试验证。
+- 详情过期/401/404 → 交互重新读取、区别 loading/error/missing，不持久缓存跨会话数据。
+- 代码或转义文字被误解析 → 使用 Markdown 的 link 节点，不做整段字符串替换。
+
+## Verification and Rollout
+
+验证普通 Markdown、mention、frontmatter、代码、Mermaid 与 ref 链接混排；缺失/跨租户 API 404、网络错误、重复 UUID 请求合并、URL 更新与删除、键盘和明暗主题。真实浏览器验证至少资源正文、Document 正文及评论共用渲染路径。运行受影响测试、TypeScript 与 lint。数据无迁移，回滚仅影响显示。
+
+Pencil 当前因没有已连接的应用无法使用。实现后记录 UI 截图作为审阅材料；若仍无法连接，报告设计文件同步限制，不改变代码交付范围或伪称已更新设计文件。
```

**File**: `openspec/changes/archive/2026-09-25-add-inline-evidence-citations/proposal.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+## Why
+
+资源正文需要直接引用已有证据，并让读者悬浮查看详情、点击打开原链接。用户在 2026-09-25 的纠正明确要求：直接用证据 UUID 链接，主要修改统一渲染层，不修改数据结构，也不扩展 Document 证据挂载能力。
+
+Source Idea: `37e6ac4a-d2fe-4344-9e18-2eee88804317`。本版本覆盖此前“当前资源上下文、Document target 扩展”的过度设计，以用户最新评论为准；YOLO 授权持续有效。
+
+## What Changes
+
+- 使用普通 Markdown 链接语法 `[1](ref:<evidence-uuid>)`，直接指向已有证据 UUID。
+- 在共享 MarkdownContent 的链接渲染中识别这种链接，显示紧凑编号 `[1]`，通过现有 `GET /api/references/<uuid>` 获取证据详情。
+- hover/focus 展示标题、类型、URL、说明，点击打开最新 HTTP(S) 原链接；证据不存在时保留灰色标记并提示且不可跳转。
+- 所有已有 Markdown 正文、文档、评论入口自动获得能力；无需资源上下文，不要求证据挂在正文所属资源，不改变现有租户鉴权。
+- 在各端 skill 现有证据章节中增加 UUID 链接示例与使用提醒。
+
+## Capabilities
+
+### New Capabilities
+
+- `inline-evidence-citations`: 基于证据 UUID 的 Markdown 链接及交互。
+
+### Modified Capabilities
+
+无；保留既有统一 Markdown 渲染及证据存储行为。
+
+## Impact
+
+仅前端渲染、相关测试/本地化、skill 文档。复用现有 UUID 详情接口，不修改数据库/schema/service/REST/MCP 数据契约、target types 或 CRUD 通知，不新增 Document 证据管理区、编辑器 picker、编号持久化或快照。
+
+原 Document 扩展任务撤销；实现任务调整为渲染层能力和 skill 使用说明/集成验收。
```

---

### Incident Patch 10: `1bf13e77` (2026-09-25)
**Commit Message**: fix: prevent duplicate project creation with safe timeout recovery (#575)

* fix: prevent duplicate project creation submissions

* fix: recover cancelled and unconfirmed project creation safely

* fix: preserve newer cwd drafts during pending validation

* docs: archive verified project creation recovery

* fix: require acknowledgement after dismissed project creation succeeds

* docs: archive late-success acknowledgement follow-up

**File**: `messages/en.json` (modified, +5/-0)
```diff
@@ -370,6 +370,11 @@
     "docs": "docs",
     "loadingProjects": "Loading projects...",
     "createFailed": "Failed to create project",
+    "creationUnconfirmed": "The creation result is not confirmed. You can close this dialog and check or refresh the project list. Your draft will be kept.",
+    "creationConfirmed": "The previous request created a project successfully. Your draft has been kept. Confirm below only if you want to create another project.",
+    "confirmAnotherCreation": "I want to create another project",
+    "creationRetryWarning": "The previous request may still create a project, even if it is not in the list yet. Creating again could produce a duplicate.",
+    "confirmNewCreation": "I’ve checked the list and still want to create again",
     "activeProjects": "Active projects",
     "totalTasks": "Total tasks",
     "openProposals": "Open proposals",
```

**File**: `messages/ja.json` (modified, +5/-0)
```diff
@@ -370,6 +370,11 @@
     "docs": "文書",
     "loadingProjects": "プロジェクトを読み込み中...",
     "createFailed": "プロジェクトの作成に失敗しました",
+    "creationUnconfirmed": "作成結果を確認できていません。この画面を閉じて、プロジェクト一覧を確認または更新できます。下書きは保持されます。",
+    "creationConfirmed": "前回のリクエストでプロジェクトが作成されました。下書きは保持されています。別のプロジェクトを作成する場合のみ、下のボタンで確認してください。",
+    "confirmAnotherCreation": "別のプロジェクトを作成します",
+    "creationRetryWarning": "一覧にまだ表示されていなくても、前回のリクエストでプロジェクトが作成される可能性があります。再度作成すると重複する場合があります。",
+    "confirmNewCreation": "一覧を確認しました。それでも再度作成します",
     "activeProjects": "アクティブなプロジェクト",
     "totalTasks": "課題の総数",
     "openProposals": "未処理の提案",
```

**File**: `messages/ko.json` (modified, +5/-0)
```diff
@@ -370,6 +370,11 @@
     "docs": "개 문서",
     "loadingProjects": "프로젝트를 불러오는 중...",
     "createFailed": "프로젝트를 만들지 못했습니다",
+    "creationUnconfirmed": "생성 결과가 아직 확인되지 않았습니다. 이 창을 닫고 프로젝트 목록을 확인하거나 새로고침할 수 있습니다. 초안은 유지됩니다.",
+    "creationConfirmed": "이전 요청으로 프로젝트가 생성되었습니다. 초안은 유지됩니다. 다른 프로젝트를 추가로 생성하려는 경우에만 아래에서 확인해 주세요.",
+    "confirmAnotherCreation": "다른 프로젝트를 추가로 생성하겠습니다",
+    "creationRetryWarning": "목록에 아직 표시되지 않아도 이전 요청으로 프로젝트가 생성될 수 있습니다. 다시 생성하면 중복될 수 있습니다.",
+    "confirmNewCreation": "목록을 확인했으며 그래도 다시 생성하겠습니다",
     "activeProjects": "활성 프로젝트",
     "totalTasks": "전체 작업",
     "openProposals": "열린 제안",
```

**File**: `messages/zh.json` (modified, +5/-0)
```diff
@@ -370,6 +370,11 @@
     "docs": "个文档",
     "loadingProjects": "加载项目中...",
     "createFailed": "创建项目失败",
+    "creationUnconfirmed": "创建结果尚未确认。你可以关闭此窗口，检查或刷新项目列表。草稿会保留。",
+    "creationConfirmed": "上次请求已成功创建项目。草稿已保留。只有仍想创建另一个项目时，才请点击下方确认。",
+    "confirmAnotherCreation": "我仍要创建另一个项目",
+    "creationRetryWarning": "上次请求仍可能成功创建项目，即使列表中暂时还没有。再次创建可能产生重复项目。",
+    "confirmNewCreation": "我已检查列表，仍要再次创建",
     "activeProjects": "活跃项目",
     "totalTasks": "总任务数",
     "openProposals": "待审提案",
```

**File**: `openspec/changes/archive/2026-09-24-fix-duplicate-project-creation/.openspec.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+schema: spec-driven
+created: 2026-09-24
```

**File**: `openspec/changes/archive/2026-09-24-fix-duplicate-project-creation/README.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# fix-duplicate-project-creation
+
+Prevent repeated project creation during validation and pending submissions
```

**File**: `openspec/changes/archive/2026-09-24-fix-duplicate-project-creation/design.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+## Context
+
+The group header opens one shared CreateProjectDialog. Its handleSubmit awaits cwd validation before entering a React transition; the button remains enabled during validation. Enter directly invokes handleSubmit without checking pending/success. The API creates one new project per request.
+
+## Goals / Non-Goals
+
+Prevent overlapping attempts originating in this dialog while preserving ordinary creation, cwd errors, input-method handling and group selection. Do not add global same-name uniqueness, server idempotency keys, or destructive duplicate cleanup.
+
+## Decisions
+
+Use a synchronous ref as the mutual-exclusion guard, acquired before the first await. Pair it with rendered busy state covering validation and request work. Both click and Enter must use the same guarded submission function. Use the existing creating copy and indicator. Snapshot the submitted inputs/group at attempt start.
+
+Keep the guard through the existing 600ms success feedback and release only once the successful dialog has closed/reset. During an attempt disable cancel and suppress Escape/outside dismissal; prevent stale completion timers from affecting a new dialog or unmounted component. On validation failure (including rejection), request rejection, or API error, release the guard and show the existing appropriate error while preserving drafts. A reopened dialog after completion must accept a fresh submission.
+
+Preserve IME composition guards and whitespace validation. Same project names remain valid across separate successful operations. No request is automatically retried on ambiguous network failure; manual retry retains current behavior.
+
+## Risks
+
+A React state flag alone is insufficient against same-tick events. Releasing at POST completion is insufficient during success feedback. A guard held after an error could permanently disable creation. Unmounting during the timer must not refresh or close a later dialog. Tests must exercise these boundaries, not just the button disabled attribute.
+
+## Validation
+
+Use controlled validation and fetch promises to assert exactly one validation sequence and at most one POST under repeated events, and compare payloads. Cover rapid clicks, repeated Enter and mixed entry points during validation/request/success; ordinary submission with groupUuid/cwd payload; blank title and IME; validation null/rejection, API error, network failure and retry; dismissal protection and reopening after success. Run related component tests, lint for changed code and typecheck. Verify the running local UI in a browser with isolated disposable data or intercepted project POSTs, both themes. Record any environment limitations accurately.
+
+## Rollout
+
+No migration. Ship the component fix through ordinary release. Do not push/merge without explicit approval.
+
+The requester explicitly waived Pencil/design.pen synchronization for this bug fix on 2026-09-24 (Idea comment 0683e158-87ed-47a4-ad27-ab4aefecc4a9: “不用管pencil，继续推进chorus流程”). Accordingly, the former design-sync AC5 is removed from the active task criteria; no canvas update is claimed. Browser screenshots cover the existing light/dark busy presentation.
```

**File**: `openspec/changes/archive/2026-09-24-fix-duplicate-project-creation/proposal.md` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+## Why
+
+Creating a project from a group header can issue duplicate POST requests and persist two independent projects. Component experiments on 96201800 confirmed repeated Enter during a pending request and repeated clicks during asynchronous cwd validation. A single click issued one POST in the experiment; the exact original production gesture is unknown.
+
+## What Changes
+
+- Guard the entire project creation attempt synchronously, before cwd validation, across click and Enter entry points.
+- Show the existing creating state and prevent dismissal during an active attempt, including the success feedback interval, so closing/reopening cannot race an older attempt.
+- Release the guard on validation/request failure and after a successful close; preserve retry drafts, IME handling, group association and subsequent creation.
+- Add focused regression coverage and browser acceptance evidence.
+
+## Capabilities
+
+### New Capabilities
+- `project-creation-submission`: One active project creation attempt per dialog, with recoverable errors and safe completion.
+
+### Modified Capabilities
+None.
+
+## Impact
+
+Primary component: `src/components/create-project-dialog.tsx`; regression tests under `src/components/__tests__/`. Existing project API and database schema remain compatible. This is client-side duplicate submission prevention, not server-wide idempotency or same-name uniqueness. Existing duplicate data will not be deleted. The project-group creation dialog is outside this scoped bug fix.
```

---

### Incident Patch 11: `8bb27e63` (2026-09-20)
**Commit Message**: fix(chorus-pi): pin Chorus agents to the background path, and stop asking for blocking (#572)

* fix(chorus-pi): pin Chorus agents to the background path, and stop asking for blocking

The three reviewers and the worker all need ambient MCP tools — the reviewers post
their VERDICT with `chorus_add_comment`, the worker runs the whole `chorus_*` task
lifecycle — and both agent bodies forbid `curl`. Under nicobailon `pi-subagents`
an in-process foreground child (`async: false`) never loads the parent's ambient
extensions, so those tools do not exist: for a reviewer the declared `tools`
allowlist makes that a failed run, for the worker (no allowlist) it degrades
silently while the run still reports success.

- extensions/chorus.ts: at `tool_call`, pin any call carrying a Chorus agent to the
  background path and clear `clarify` (it defeats async), notifying once when an
  explicit `async: false` was overridden. The flag is written on the RUN-level
  object because one call has one mode — an item-level `async` on `tasks[]` /
  `chain[]` is read by nothing.
- lib/lib.ts: `forceSubagentCallAsync()` replaces the item-level helper (which was
  inert for composite calls); `collect()` now doc

**File**: `docs/CONNECT_PI.md` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ The extension has no plugin-settings UI (Pi extensions are config-by-env). All t
 
 ## Sub-agent concurrency discipline
 
-The bundled `subagent` tool (pi's official pattern) spawns **ephemeral** children — each runs and exits within one tool call, so there is no slot to release manually. The extension auto-creates a Chorus session when a `subagent` call starts and closes it when the tool call returns. Long chains (`/skill:yolo`) spawn multiple reviewers/workers in sequence; because each child is short-lived, no `subagent_manage close` bookkeeping is required.
+The bundled `subagent` tool (pi's official pattern) spawns **ephemeral** children — each runs and exits within one tool call, so there is no slot to release manually. The extension auto-creates a Chorus session when a `subagent` call starts and closes it when the tool call returns (or when the run settles, under nicobailon `pi-subagents`). Long chains (`/skill:yolo`) spawn multiple reviewers/workers in sequence; because each child is short-lived, there is no handle to close and no bookkeeping — `subagent_manage close` does not exist in this package.
 
 ## Troubleshooting
 
```

**File**: `packages/chorus-pi/README.md` (modified, +43/-10)
```diff
@@ -58,7 +58,7 @@ that wakes it. See [`docs/CONNECT_PI.md`](../../docs/CONNECT_PI.md#run-pi-as-a-w
 
 - **MCP: adapter path, keyless config.** `pi-mcp-adapter` reads the `mcp.json` `chorus agents add` writes at `~/.pi/agent/mcp.json` (or a project-root `.mcp.json`) and exposes all 40+ `chorus_*` tools — the extension never registers tools itself. The `Authorization` header references the key by env var (`Bearer ${CHORUS_API_KEY}`, which the adapter interpolates at connect time), so no `cho_` key lands on disk. A literal Bearer also works, but the env-referenced form is what the CLI writes.
 - **Hooks: TypeScript, not bash.** The extension replaces ~10 bash hook scripts with one TS file. No `curl`/`jq`, no Bash 3.2 compatibility traps (the `${2:-{}}` JSON-parse bug that plagued the Codex port is structurally impossible here).
-- **Sub-agent sessions: automatic.** By monitoring `subagent` tool events, the extension auto-creates a Chorus session for each worker task in a dispatch and closes it when the tool call returns — a capability the Codex port lacks (Codex has no sub-agent lifecycle events, so its workers manage sessions manually).
+- **Sub-agent sessions: automatic.** By monitoring `subagent` tool events, the extension auto-creates a Chorus session for each worker task in a dispatch and closes it when the dispatch returns (or when the run settles — `subagent:async-complete` / `process-terminal` — under nicobailon `pi-subagents`) — a capability the Codex port lacks (Codex has no sub-agent lifecycle events, so its workers manage sessions manually).
 - **Skills: same standard.** Pi implements the Agent Skills standard, so the skill bodies port with find/replace only (Claude's `Task` tool → the `subagent` tool; `/chorus:develop` → `/skill:develop`).
 
 ## Structure
@@ -91,17 +91,22 @@ packages/chorus-pi/
 
 **Complete port** of the Claude Code / Codex plugins to Pi. All 12 skills, all 3 reviewer sub-agents plus the `chorus-worker` implementer, the session-aware extension, the bundled official subagent pattern, and the OpenSpec wrapper are implemented and validated (TS transpiles, JSON valid, all skill/agent names compliant with the Agent Skills standard, no Claude/Codex-specific references remain).
 
-The extension goes beyond the Codex port in one key way: by using Pi's `tool_call` event (pre-execution, mutable input), it **auto-injects the Chorus session UUID + workflow into each dispatched worker's task** — the Pi-native equivalent of Claude's `SubagentStart` hook. The Codex port has no pre-spawn mutation channel, so its workers must manage sessions manually. On Pi, dispatch a worker via the `subagent` tool and the extension handles session creation + context injection, then closes the session when the (ephemeral) tool call returns.
+The extension goes beyond the Codex port in one key way: by using Pi's `tool_call` event (pre-execution, mutable input), it **auto-injects the Chorus session UUID + workflow into each dispatched worker's task** — the Pi-native equivalent of Claude's `SubagentStart` hook. The Codex port has no pre-spawn mutation channel, so its workers must manage sessions manually. On Pi, dispatch a worker via the `subagent` tool and the extension handles session creation + context injection, then closes the session when the dispatch returns — or when the run settles (`subagent:async-complete` / `process-terminal`) under nicobailon `pi-subagents`.
 
 
 ### Subagent run modes: blocking (bundled) vs async (nicobailon `pi-subagents`)
 
 The bundled `subagent` tool (pi's official reference pattern) is **blocking**:
 spawn → run → exit within one tool call, so the extension closes the Chorus
-session at `tool_result`. If you instead use the nicobailon `pi-subagents`
-package's `subagent` tool, top-level launches are **async (detached)** by
-default: `tool_result` returns immediately with `details.asyncId` and the run
-completes later. The extension detects this case (`asyncId`/`runId` in
+session at `tool_result`. It is also the only implementation that takes a
+composite call (`{ tasks: [...] }` / `{ chain: [...] }`). If you instead use the
+nicobailon `pi-subagents` package's `subagent` tool, top-level launches are
+**async (detached)** by default: `tool_result` returns immediately with
+`details.asyncId` and the run completes later. That tool takes **one child per
+call** — its public normalizer rejects top-level `tasks`/`chain` with *"Legacy
+top-level chain and parallel inputs were removed; use workflowScript."* (verified
+on 0.66.0 and 0.70.0), so a wave is several single dispatches rather than one
+composite. The extension detects the async case (`asyncId`/`runId` in
 `details`) and defers session close to `subagent:async-complete` /
 `subagent:process-terminal` (with `session_shutdown` sweep as a final guard).
 Tasks that already carry an injected `--- Chorus session` block (e.g. a
@@ -136,7 +141,7 @@ no conflict error, nicobailon wins deterministically.
 | Setup | What happens |
 |------
```

**File**: `packages/chorus-pi/agents/chorus-code-reviewer.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 name: chorus-code-reviewer
-description: Final ship-time review of an Idea's aggregate code change — the whole feature across all its tasks, not one task. Read-only; posts a VERDICT comment on the Idea. Spawn via the blocking subagent tool after the last task of an idea-rooted proposal is verified.
+description: Final ship-time review of an Idea's aggregate code change — the whole feature across all its tasks, not one task. Read-only; posts a VERDICT comment on the Idea. Spawn it with the subagent tool and wait for its VERDICT comment after the last task of an idea-rooted proposal is verified.
 tools: read, grep, find, ls, bash, mcp, mcpScript
 acceptance: { level: "none", reason: "read-only chorus reviewer; verdict is posted via chorus_add_comment to Chorus, not returned to parent; suppress acceptance-report injection" }
 ---
```

**File**: `packages/chorus-pi/agents/chorus-proposal-reviewer.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 name: chorus-proposal-reviewer
-description: Review submitted Chorus proposals for quality — check document completeness, task granularity, AC alignment, and cross-task dependencies. Spawn via the blocking subagent tool after chorus_pm_submit_proposal.
+description: Review submitted Chorus proposals for quality — check document completeness, task granularity, AC alignment, and cross-task dependencies. Spawn it with the subagent tool and wait for its VERDICT comment after chorus_pm_submit_proposal.
 tools: read, grep, find, ls, bash, mcp, mcpScript
 acceptance: { level: "none", reason: "read-only chorus reviewer; verdict is posted via chorus_add_comment to Chorus, not returned to parent; suppress acceptance-report injection" }
 ---
```

**File**: `packages/chorus-pi/agents/chorus-task-reviewer.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 name: chorus-task-reviewer
-description: Review submitted Chorus tasks — verify implementation against AC and proposal documents. Spawn via the blocking subagent tool after chorus_submit_for_verify.
+description: Review submitted Chorus tasks — verify implementation against AC and proposal documents. Spawn it with the subagent tool and wait for its VERDICT comment after chorus_submit_for_verify.
 tools: read, grep, find, ls, bash, mcp, mcpScript
 acceptance: { level: "none", reason: "read-only chorus reviewer; verdict is posted via chorus_add_comment to Chorus, not returned to parent; suppress acceptance-report injection" }
 ---
```

**File**: `packages/chorus-pi/agents/chorus-worker.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 ---
 name: chorus-worker
-description: General-purpose Chorus implementer subagent that claims and completes ONE Chorus task end-to-end via the develop workflow. Dispatch it via the blocking subagent tool (single or parallel mode) for wave-based execution.
+description: "General-purpose Chorus implementer subagent that claims and completes ONE Chorus task end-to-end via the develop workflow. Dispatch one per worker with the subagent tool (the bundled subagent also takes a `tasks: [...]` composite) for wave-based execution, and wait for the run to settle."
 ---
 
 You are a Chorus implementer. Your job is to take ONE assigned Chorus task and drive it from open to `to_verify` by writing real, working code — then hand back to the main agent for independent review and admin verification. You do NOT review, verify, or approve your own work.
@@ -79,7 +79,7 @@ chorus_submit_for_verify({ taskUuid: "<task-uuid>", summary: "<what you built +
 === HARD LIMITS ===
 
 - Do **NOT** admin-verify or approve your own work. `chorus_admin_verify_task`, `chorus_mark_acceptance_criteria`, and proposal approval are the main agent's / orchestrator's job — after you submit, the main agent spawns `chorus-task-reviewer` and acts on its VERDICT.
-- Do **NOT** call `chorus_create_session` or `chorus_close_session` — the chorus-pi extension owns session lifecycle (it created your session and closes it when the dispatching `subagent` tool call returns).
+- Do **NOT** call `chorus_create_session` or `chorus_close_session` — the chorus-pi extension owns session lifecycle (it created your session, and it closes it when the dispatch returns — a blocking implementation — or when the run settles under nicobailon `pi-subagents`).
 - Work on **ONE** task. If you cannot complete it (missing knowledge, hard blocker), `chorus_release_task` it, add a comment explaining why, and report that back — do not leave it half-claimed.
 
 === OUTPUT FORMAT (REQUIRED) ===
```

**File**: `packages/chorus-pi/extensions/chorus.ts` (modified, +42/-7)
```diff
@@ -17,6 +17,17 @@
  *                              injecting session context — a capability the Codex port
  *                              lacks (Codex has no pre-spawn mutation channel, so its
  *                              workers must manage sessions manually).
+ *                            → pin every REVIEWER and WORKER task to the background
+ *                              (`async: true`), so it keeps the ambient MCP tools it
+ *                              needs (reviewers: chorus_add_comment for the VERDICT;
+ *                              workers: chorus_session_checkin_task / chorus_update_task
+ *                              / chorus_report_work / chorus_submit_for_verify). A
+ *                              foreground (`async: false`) child is in-process and never
+ *                              loads ambient extensions, so those tools are missing:
+ *                              a reviewer's declared allowlist makes that a failed run,
+ *                              a worker (no allowlist) degrades silently. The bundled
+ *                              subagent ignores the flag (its child is a separate `pi`
+ *                              process) and is unaffected.
  *   - tool_result            → close the ephemeral worker session(s) once the `subagent`
  *   - tool_result            → for the official blocking subagent, close the ephemeral
  *                              worker session(s) once the `subagent` tool call returns
@@ -41,6 +52,8 @@
 
 import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
 import {
+  forceSubagentCallAsync,
+  isReviewerAgent,
   isWorkerAgent,
   subagentTaskItems,
   sessionWorkflow,
@@ -344,9 +357,9 @@ export default function (pi: ExtensionAPI) {
         specRoute,
         "",
         "## Quick Reference",
-        "- **Sessions**: auto-managed. When you dispatch a WORKER via the `subagent` tool (single/parallel/chain), the extension creates a Chorus session per worker task and injects its UUID + the session workflow into that task automatically; the session is closed when the `subagent` tool call returns (children are ephemeral). Do NOT call chorus_create_session/close_session yourself.",
+        "- **Sessions**: auto-managed. When you dispatch a WORKER via the `subagent` tool (one child per call; the bundled subagent also takes `tasks`/`chain` composites — nicobailon `pi-subagents` rejects those top-level fields, so a wave there is one single dispatch per worker), the extension creates a Chorus session per worker task and injects its UUID + the session workflow into that task automatically; the extension closes that session when the dispatch returns (blocking implementations) or when the run settles — `subagent:async-complete` / `process-terminal` — under nicobailon `pi-subagents`, which is where Chorus agents run by default. Do NOT call chorus_create_session/close_session yourself.",
         "- **Notifications**: chorus_get_notifications() fetches and auto-marks read.",
-        "- **Reviewer sub-agents**: after submit_proposal/submit_for_verify the extension nudges you to spawn chorus-proposal-reviewer / chorus-task-reviewer. Use the blocking `subagent` tool so it waits for the VERDICT; reviewers do NOT get a Chorus session.",
+        "- **Reviewer sub-agents**: after submit_proposal/submit_for_verify the extension nudges you to spawn chorus-proposal-reviewer / chorus-task-reviewer. Dispatch it with the `subagent` tool and wait for its VERDICT comment — reviewers are pinned to the background/async path, because a foreground child has no `mcp` and could not post the comment; reviewers do NOT get a Chorus session.",
         "- **Code-review gateway**: bounded by `CHORUS_MAX_CODE_REVIEW_ROUNDS` (current: " + (MAX_CODE_REVIEW_ROUNDS === 0 ? "unlimited" : String(MAX_CODE_REVIEW_ROUNDS)) + "; on FAIL, fix via /skill:quick-dev and re-run — after the limit, escalate the Idea's feature-level BLOCKERs to a human instead of shipping.",
         (CHORUS_BIN
           ? "- **OpenSpec wrapper**: `bin/chorus-mcp-call.sh` is at `" + CHORUS_BIN + "` — the CLI-absent fallback for OpenSpec-mode document mirrors. Prefer `chorus mcp call <tool> '<json>' --arg-file content=<file>` (chorus >= 0.17.0); use this wrapper only when `chorus` is not on PATH (a bare `chorus-mcp-call.sh` will NOT be on PATH for local-path installs). See /skill:openspec-aware §2."
@@ -386,15 +399,37 @@ export default function (pi: ExtensionAPI) {
   // `subagent` invocation (single / parallel / chain), create a Chorus session
   // and inject its UUID + the session workflow into that task. The ephemeral
   // child pi subprocess spawned for that task receives the UUID in its prompt.
-  pi.on("tool_call", async (event, _ctx) => {
+  pi.on("tool_call", async (event, ctx) => {
     if (!CONFIGURED || event.toolName !== "subagent") return;
+    const items = subagentTaskItems(event.input);
+    // Every Chorus agent this extension spawns needs ambient MCP tools: the
+    
```

**File**: `packages/chorus-pi/lib/lib.ts` (modified, +60/-1)
```diff
@@ -119,12 +119,15 @@ export function isWorkerAgent(name: string): boolean {
  *   - parallel: { tasks: [{ agent, task }, ...] }
  *   - chain:    { chain: [{ agent, task }, ...] }
  *
- * Each returned holder carries the agent name, the current task text, and a
+ * Each returned holder carries the agent name, the current task text, a
  * `setTask` that writes back into the SAME input object in place — so the
  * extension can inject the Chorus session workflow into a worker's task before
  * the ephemeral child `pi` process is spawned (pi's `tool_call` event input is
  * mutable). Holders with a non-string / empty agent or task are skipped.
  *
+ * Pinning a call to the background path is a separate, CALL-level operation
+ * (one call has exactly one mode) — see forceSubagentCallAsync().
+ *
  * Replaces the old persistent-model agentId extraction: the official subagent
  * children are ephemeral (spawn → run → exit within one tool call) and expose
  * no `sa_<uuid>` agentId to map, so there is nothing to parse out of a result.
@@ -142,6 +145,11 @@ export function subagentTaskItems(input: unknown): SubagentTaskItem[] {
   const collect = (holder: Record<string, unknown>): void => {
     const agent = typeof holder.agent === "string" ? holder.agent : "";
     const task = typeof holder.task === "string" ? holder.task : "";
+    // Both fields are required to enumerate — do NOT relax this to agent-only
+    // to widen the pin: the worker path writes sessionWorkflow() into `task`,
+    // and a chain step may deliberately omit it (ChainItem.task is optional and
+    // defaults to {previous}), so an agent-only enumeration would corrupt that
+    // step's prompt instead of pinning it.
     if (!agent || !task) return;
     items.push({
       agent,
@@ -161,6 +169,57 @@ export function subagentTaskItems(input: unknown): SubagentTaskItem[] {
   return items;
 }
 
+/**
+ * Force a `subagent` CALL onto the background (async) path: writes
+ * `async: true` into the ROOT input object in place, and REMOVES `clarify`.
+ *
+ * Takes the CALL object, not a task item, because `async` is a run-level
+ * parameter: it exists only as a top-level field (pi-subagents
+ * `extension/schemas.ts` — neither `ParallelTaskSchema` nor `ChainItem` has one,
+ * and `ChainItem` even sets `additionalProperties: false`), and both mode
+ * decisions read it there (`requestedAsync = effectiveParams.async ??
+ * asyncByDefault`, `runsForeground = ... (dispatchParams.async ??
+ * asyncByDefault) !== true` in `src/runs/foreground/subagent-executor.ts`). An
+ * item-level `async` on `tasks[]` / `chain[]` is read by nothing — writing one
+ * is a silent no-op, which is exactly how a "pin the reviewer" fix can look
+ * right while doing nothing for composite calls.
+ *
+ * Used for agents that need ambient MCP tools. Under the nicobailon
+ * `pi-subagents` implementation an in-process foreground child
+ * (`async: false`) never loads the parent's ambient extensions, so `mcp` /
+ * `mcpScript` / `chorus_*` do not exist for it. Verified 2026-09-20 with a probe
+ * agent that declares no `tools` allowlist (so no diagnostic can fire): its
+ * whole tool set was `read, bash, edit, write, bg_wait, contact_supervisor` —
+ * no `mcp`, no `chorus_*` — and it could not post a comment. The bundled
+ * subagent ignores the flag entirely (its child is a separate `pi` process,
+ * which does load extensions), so forcing it is safe under either
+ * implementation.
+ *
+ * `clarify` is DELETED, not assigned: it disables async in nicobailon's
+ * executor (`effectiveAsync = requestedAsync && clarify !== true`), and the
+ * public normalizer (`normalizePublicSubagentExecution`) additionally rejects
+ * any call where the property is merely **present** — `params.clarify !==
+ * undefined` in `src/extension/public-execution.js` (0.70.0:91, same in
+ * 0.66.0), "Public workflowScript execution does not support clarify UI." — so
+ * a leftover `clarify: false` would be a hard pre-dispatch rejection rather
+ * than a pin. Deleting mirrors the package's own
+ * applyForceTopLevelAsyncOverride() (that helper also honors `foregroundOnly`;
+ * a Chorus agent cannot run foreground at all, so this one deliberately does
+ * not).
+ *
+ * @returns true when the caller had explicitly asked for foreground
+ * (`async: false`) and was overridden — so the caller can surface the override
+ * instead of silently changing the dispatch mode.
+ */
+export function forceSubagentCallAsync(input: unknown): boolean {
+  if (!input || typeof input !== "object") return false;
+  const obj = input as Record<string, unknown>;
+  const overrodeExplicitForeground = obj.async === false;
+  obj.async = true;
+  if ("clarify" in obj) delete obj.clarify;
+  return overrodeExplicitForeground;
+}
+
 /**
  * Build the session-workflow suffix injected into a spawned worker's task
  * (via the tool_call event's mutable input). The subprocess receives this
```

---

### Incident Patch 12: `29094c67` (2026-09-17)
**Commit Message**: fix: accept npm uploads without waiting for registry propagation (#571)

**File**: `.claude/skills/plugin-maintenance/SKILL.md` (modified, +4/-2)
```diff
@@ -203,8 +203,10 @@ the npm Environment field blank while the workflow job has no `environment`;
 if an Environment is introduced, configure the exact same case-sensitive name
 on npm and on the workflow job. Keep `id-token: write`, do not add
 `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or a setup-node token placeholder, and do not
-disable npm's automatic provenance. A public-repository publish is accepted
-only after the workflow observes its SLSA provenance attestation.
+disable npm's automatic provenance. A zero exit status from `npm publish`
+completes the upload and is recorded as `accepted-by-npm`. Registry visibility
+and provenance metadata can lag behind acceptance; the workflow does not poll
+them or use them to gate subsequent packages.
 `@chorus-aidlc/chorus-pi` is the newest package: its Trusted Publisher must be
 registered on npmjs.org before its first coordinated publish, or the run stops
 at chorus-pi with the first three already published — a human/ops step, not
```

**File**: `.claude/skills/release/SKILL.md` (modified, +7/-4)
```diff
@@ -164,8 +164,11 @@ Each npm package's Trusted Publisher settings must match:
 The workflow file path is `.github/workflows/publish-npm.yml`; npm's Trusted
 Publisher form takes the filename, not the full path. The job runs on a
 GitHub-hosted runner with `id-token: write`, does not use `NPM_TOKEN` or
-`NODE_AUTH_TOKEN`, and leaves provenance enabled. Public-repository publishes
-must expose an SLSA provenance attestation after upload.
+`NODE_AUTH_TOKEN`, and leaves automatic provenance enabled. A zero exit status
+from `npm publish` is sufficient for the workflow to record `accepted-by-npm`
+and continue. Registry visibility and provenance metadata can lag behind npm's
+acceptance; do not wait for them or fail an accepted upload because they are
+not yet visible.
 
 **New package — one-time ops step for `@chorus-aidlc/chorus-pi`.** chorus-pi is
 the 4th coordinated package and was added after the first three. Before its
@@ -212,8 +215,8 @@ gh release view vX.Y.Z
 - [ ] PR from `develop` → `main` created, CI passed, and merged
 - [ ] `gh release create` with tag targeting `main`
 - [ ] `@chorus-aidlc/chorus-pi` Trusted Publisher registered on npmjs.org (one-time, before its first coordinated publish)
-- [ ] `publish-npm.yml` run passed for all four packages (published or safely skipped)
-- [ ] Public-package provenance attestations were verified by the workflow
+- [ ] `publish-npm.yml` run passed for all four packages (`accepted-by-npm` or safely skipped)
+- [ ] Automatic provenance remained enabled; registry propagation was not a release gate
 - [ ] Release notes contain only the new version's section
 - [ ] `develop` synced with `main` after merge
 - [ ] `gh release view` confirms everything looks correct
```

**File**: `.github/workflows/publish-npm.yml` (modified, +0/-2)
```diff
@@ -62,6 +62,4 @@ jobs:
         run: node scripts/coordinated-npm-release/prepare.mjs '${{ github.event.release.tag_name }}'
 
       - name: Publish validated tarballs in manifest order
-        env:
-          CHORUS_RELEASE_EXPECT_PROVENANCE: ${{ !github.event.repository.private }}
         run: node scripts/coordinated-npm-release/publish.mjs '${{ github.event.release.tag_name }}'
```

**File**: `openspec/specs/coordinated-npm-release/spec.md` (modified, +24/-13)
```diff
@@ -1,24 +1,24 @@
 # coordinated-npm-release Specification
 
 ## Purpose
-TBD - created by archiving change automate-coordinated-npm-releases. Update Purpose after archive.
+Publish the four Chorus npm packages from one GitHub Release with complete preflight checks, tokenless uploads, and recovery after partial publication.
 ## Requirements
 ### Requirement: Release-triggered coordinated publication
-The repository SHALL run one coordinated npm publication workflow when a GitHub Release is published, and the workflow MUST process exactly `@chorus-aidlc/chorus`, `@chorus-aidlc/chorus-openclaw-plugin`, and `@chorus-aidlc/chorus-dsh`.
+The repository SHALL run one coordinated npm publication workflow when a GitHub Release is published, and the workflow MUST process exactly `@chorus-aidlc/chorus`, `@chorus-aidlc/chorus-openclaw-plugin`, `@chorus-aidlc/chorus-dsh`, and `@chorus-aidlc/chorus-pi`.
 
 #### Scenario: Published GitHub Release starts publication
 - **WHEN** a maintainer publishes a GitHub Release for tag `vX.Y.Z`
-- **THEN** the coordinated workflow checks out that tag and prepares all three supported npm packages for version `X.Y.Z`
+- **THEN** the coordinated workflow checks out that tag and prepares all four supported npm packages for version `X.Y.Z`
 
 #### Scenario: Non-release repository activity
 - **WHEN** commits or pull requests are created without publishing a GitHub Release
 - **THEN** the coordinated npm publication workflow does not publish any package
 
 ### Requirement: Lockstep release identity
-The workflow MUST verify before any registry write that the release tag is a valid `vX.Y.Z` version and that all three supported package manifests have their expected package names and the exact version `X.Y.Z`.
+The workflow MUST verify before any registry write that the release tag is a valid `vX.Y.Z` version and that all four supported package manifests have their expected package names and the exact version `X.Y.Z`.
 
 #### Scenario: All package identities match
-- **WHEN** the Release tag and all three package manifests contain the same valid version and expected names
+- **WHEN** the Release tag and all four package manifests contain the same valid version and expected names
 - **THEN** the workflow may continue to package preparation
 
 #### Scenario: A version or package name differs
@@ -37,7 +37,7 @@ The workflow SHALL authenticate npm publication through GitHub Actions OIDC and
 - **THEN** publication fails and the workflow does not fall back to a stored npm token
 
 ### Requirement: Complete pre-publication gate
-The workflow MUST complete applicable lint, typecheck, test, build, package-content validation, and tarball creation for all three packages before uploading the first package.
+The workflow MUST complete applicable lint, typecheck, test, build, package-content validation, and tarball creation for all four packages before uploading the first package.
 
 #### Scenario: All package gates pass
 - **WHEN** every package passes its required checks and produces a validated tarball
@@ -48,16 +48,27 @@ The workflow MUST complete applicable lint, typecheck, test, build, package-cont
 - **THEN** the workflow stops before any npm registry write
 
 ### Requirement: Deterministic sequential publication
-The workflow MUST publish validated tarballs in the fixed order Chorus CLI, OpenClaw plugin, then dsh plugin, and MUST stop attempting later unpublished packages after an upload failure.
+The workflow MUST publish validated tarballs in the fixed order Chorus CLI, OpenClaw plugin, dsh plugin, then chorus-pi plugin, and MUST stop attempting later unpublished packages after an upload failure.
 
 #### Scenario: All versions are unpublished
-- **WHEN** all three validated package versions are absent from npm
-- **THEN** the workflow publishes the three tarballs in the configured order and reports each as published
+- **WHEN** all four validated package versions are absent from npm
+- **THEN** the workflow uploads the four tarballs in the configured order and reports each successful upload as `accepted-by-npm`
 
 #### Scenario: A package upload fails
 - **WHEN** npm rejects or cannot complete one package upload
 - **THEN** the workflow fails immediately and does not attempt later unpublished packages
 
+### Requirement: npm acceptance completes an upload
+The workflow MUST treat a zero exit status from `npm publish` as successful upload acceptance, MUST leave automatic provenance enabled, and MUST NOT require post-upload registry or attestation reads before proceeding.
+
+#### Scenario: Registry metadata lags behind an accepted upload
+- **WHEN** `npm publish` exits successfully but the version or its provenance metadata is not yet visible in registry reads
+- **THEN** the workflow records `accepted-by-npm` and continues to the next package without polling or failing on metadata propagation
+
+#### Scenario: Existing version has delayed attestation metadata
+- **WHEN** the pre-upload exact-vers
```

**File**: `scripts/coordinated-npm-release/__tests__/coordinated-npm-release.test.mjs` (modified, +24/-83)
```diff
@@ -246,7 +246,7 @@ if (args.join(" ") === "config get registry") {
 } else if (args[0] === "config" && args[1] === "get" && args[2].endsWith(":registry")) {
   console.log(scenario === "scope-registry-hijack" ? "https://malicious.example.com/" : "undefined");
 } else if (args[0] === "view" && args[2] === "version") {
-  if (scenario.startsWith("first-published") && index === 0) {
+  if (scenario === "all-published" || (scenario === "first-published" && index === 0)) {
     console.log(JSON.stringify("0.17.0"));
   } else if (scenario === "lookup-error-second" && index === 1) {
     console.error("E401 registry authorization failure");
@@ -261,22 +261,6 @@ if (args.join(" ") === "config get registry") {
     console.error("mock publish rejected");
     process.exitCode = 1;
   }
-} else if (args[0] === "view" && args[2] === "dist.attestations") {
-  if (scenario === "first-published-provenance-missing" && index === 0) {
-    // npm prints an empty successful response when this property is not yet present.
-  } else if (scenario === "first-published-provenance-not-visible" && index === 0) {
-    console.error("npm error code E404");
-    console.error("npm error 404 No match found for version - " + spec);
-    process.exitCode = 1;
-  } else if (scenario === "first-published-provenance-error" && index === 0) {
-    console.error("E503 attestation metadata unavailable");
-    process.exitCode = 1;
-  } else {
-    console.log(JSON.stringify({
-      url: "https://registry.npmjs.org/-/npm/v1/attestations/example",
-      provenance: { predicateType: "https://slsa.dev/provenance/v1" },
-    }));
-  }
 } else {
   console.error("unexpected mock npm invocation: " + args.join(" "));
   process.exitCode = 2;
@@ -293,8 +277,6 @@ async function runPublish(root, scenario) {
   const npmCommand = await installMockNpm(root);
   const result = runScript(root, "publish.mjs", [releaseTag], {
     CHORUS_RELEASE_NPM_CLI: npmCommand,
-    CHORUS_RELEASE_PROVENANCE_RETRY_DELAY_MS: "0",
-    CHORUS_RELEASE_PROVENANCE_RETRY_ATTEMPTS: "5",
     GITHUB_STEP_SUMMARY: summary,
     MOCK_NPM_LOG: npmLog,
     MOCK_NPM_SCENARIO: scenario,
@@ -468,7 +450,7 @@ test("real npm pack prepares all four contract-shaped tarballs in fixed order",
   }
 });
 
-test("fresh publication uses fixed order and verifies automatic provenance", async (t) => {
+test("accepted uploads continue in fixed order while registry reads still return 404", async (t) => {
   const root = await prepareFixture(t);
   const { result, calls, summary } = await runPublish(root, "all-missing");
   assert.equal(result.status, 0, result.stderr);
@@ -480,16 +462,23 @@ test("fresh publication uses fixed order and verifies automatic provenance", asy
   );
   assert.ok(publishes.every(({ args }) => args.at(-2) === "--access" && args.at(-1) === "public"));
   assert.ok(publishes.every(({ args }) => !args.some((arg) => /provenance/i.test(arg))));
-  assert.equal(
-    calls.filter(({ args }) => args[2] === "dist.attestations").length,
-    4,
+  // The fake registry keeps returning 404 even after a successful upload and
+  // rejects metadata lookups. Only the pre-upload version reads are needed.
+  assert.deepEqual(
+    calls.filter(({ args }) => args[0] === "view" || args[0] === "publish")
+      .map(({ args }) => args[0] === "view" ? args.slice(0, 3) : [args[0]]),
+    packageDefinitions.flatMap(({ packageName }) => [
+      ["view", `${packageName}@${version}`, "version"],
+      ["publish"],
+    ]),
   );
   for (const { packageName } of packageDefinitions) {
-    assert.match(summary, new RegExp(`${packageName.replaceAll("/", "\\/")}\\\` \\| published`));
+    assert.match(summary, new RegExp(`${packageName.replaceAll("/", "\\/")}\\\` \\| accepted-by-npm`));
   }
+  assert.match(summary, /metadata may appear later/);
 });
 
-test("an already-published version is skipped and remaining packages continue", async (t) => {
+test("an existing version is skipped without attestation queries and remaining uploads continue", async (t) => {
   const root = await prepareFixture(t);
   const { result, calls, summary } = await runPublish(root, "first-published");
   assert.equal(result.status, 0, result.stderr);
@@ -502,72 +491,22 @@ test("an already-published version is skipped and remaining packages continue",
         args[1] === "@chorus-aidlc/chorus@0.17.0" &&
         args[2] === "dist.attestations",
     ).length,
-    1,
+    0,
   );
   assert.match(summary, /@chorus-aidlc\/chorus` \| skipped-already-published/);
+  assert.match(summary, /chorus-openclaw-plugin` \| accepted-by-npm/);
 });
 
-test("missing provenance on an already-published version fails the rerun", async (t) => {
+test("a completed release rerun skips all four versions without uploads or metadata waits", async (t) => {
   const root = await prepareFixture(t);
-  const { result, calls, summary } = await runPublish(
-    root,
-    "first-published-provenance-missing",
-  );
-  assert.equal(result.status, 1);
-
```

**File**: `scripts/coordinated-npm-release/publish.mjs` (modified, +10/-61)
```diff
@@ -16,15 +16,6 @@ import {
 
 const releaseTag = process.argv[2];
 const npmCommand = process.env.CHORUS_RELEASE_NPM_CLI || "npm";
-const expectProvenance = process.env.CHORUS_RELEASE_EXPECT_PROVENANCE !== "false";
-const provenanceRetryDelayMs = Number(
-  process.env.CHORUS_RELEASE_PROVENANCE_RETRY_DELAY_MS ?? "3000",
-);
-// Fresh publishes need time for the registry/CDN to expose the attestation.
-// Default budget ~= (attempts - 1) * delay ≈ 177s; both are env-overridable.
-const provenanceRetryAttempts = Number(
-  process.env.CHORUS_RELEASE_PROVENANCE_RETRY_ATTEMPTS ?? "60",
-);
 const npmPublicRegistry = "https://registry.npmjs.org/";
 const manifest = await loadManifest();
 const version = parseReleaseTag(releaseTag);
@@ -125,51 +116,6 @@ function registryState(packageName, cwd) {
   );
 }
 
-async function verifyProvenance(packageName, cwd) {
-  const spec = `${packageName}@${version}`;
-  let lastDetail = "no registry response";
-  for (let attempt = 1; attempt <= provenanceRetryAttempts; attempt++) {
-    const lookup = runFile(
-      npmCommand,
-      ["view", spec, "dist.attestations", "--json"],
-      { cwd, capture: true },
-    );
-    if (lookup.status === 0) {
-      const response = lookup.stdout.trim();
-      if (response === "") {
-        lastDetail = "registry metadata does not contain an SLSA provenance attestation";
-      } else {
-        try {
-          const attestations = JSON.parse(response);
-          if (
-            typeof attestations?.url === "string" &&
-            attestations.provenance?.predicateType === "https://slsa.dev/provenance/v1"
-          ) {
-            console.log(`${spec} provenance attestation verified`);
-            return;
-          }
-          lastDetail = "registry metadata does not contain an SLSA provenance attestation";
-        } catch {
-          throw new Error(
-            `Unable to verify automatic provenance for ${spec}: registry returned invalid attestation JSON`,
-          );
-        }
-      }
-    } else {
-      lastDetail = [lookup.stdout, lookup.stderr].filter(Boolean).join("\n").trim();
-      const versionNotVisibleYet =
-        /\bE404\b/.test(lastDetail) && lastDetail.includes(spec);
-      if (!versionNotVisibleYet) {
-        throw new Error(`Unable to query automatic provenance for ${spec}: ${lastDetail}`);
-      }
-    }
-    if (attempt < provenanceRetryAttempts) {
-      await new Promise((resolve) => setTimeout(resolve, provenanceRetryDelayMs));
-    }
-  }
-  throw new Error(`Unable to verify automatic provenance for ${spec}: ${lastDetail}`);
-}
-
 try {
   const prepared = await validatePreparedResult();
 
@@ -189,21 +135,24 @@ try {
         { cwd: packageDirectory },
       );
       assertSuccessful(publish, `${entry.packageName} publish`);
-    }
-    if (expectProvenance) {
-      await verifyProvenance(entry.packageName, packageDirectory);
-    } else {
-      console.log(`${entry.packageName}@${version} provenance check skipped for a private source repository`);
+      // npm can accept the upload before the version and its automatic
+      // provenance appear in registry reads. Acceptance completes this step.
+      console.log(`${entry.packageName}@${version} upload accepted by npm`);
     }
     setStatus(
       entry.packageName,
-      alreadyPublished ? "skipped-already-published" : "published",
+      alreadyPublished ? "skipped-already-published" : "accepted-by-npm",
     );
   }
 } catch (error) {
   if (currentPackage) setStatus(currentPackage, "failed");
   console.error(error instanceof Error ? error.message : error);
   process.exitCode = 1;
 } finally {
-  await appendJobSummary(summaryTable(version, statuses));
+  await appendJobSummary([
+    summaryTable(version, statuses),
+    "",
+    "`accepted-by-npm` means `npm publish` exited successfully. Registry visibility",
+    "and automatic provenance metadata may appear later; this job does not wait for them.",
+  ].join("\n"));
 }
```

---

### Incident Patch 13: `fc487a20` (2026-09-17)
**Commit Message**: fix: converge phantom running turns (retry terminal report, turn-driven interrupt, exit-authoritative spawners) (#569)

* fix: converge phantom running turns (#idea 47ae1d67)

A daemon-woken subprocess ended but the UI kept showing the conversation as
running and offered no way to stop it — the turn stayed `running` forever.
Four independent gaps, all narrow fixes, no new infrastructure:

- cli/daemon-rest-client.mjs: bounded retry (3 attempts, 500ms then 2000ms) on
  the TERMINAL turn-advance edge only. Retryable = network failure / 429 / 5xx;
  every 4xx is a server verdict and returns immediately. Previously a single
  `fetch failed` at subprocess exit orphaned the turn permanently, and the
  server's `reconcileOrphanTurns` cannot collect it because a live, heart-beating
  daemon is never orphan-eligible. Idempotent by construction via
  advanceTurnForWake's correlated terminal short-circuit.

- cli/control-handler.mjs: an interrupt with no live child no longer returns
  silently — it reports the turn as interrupted(user) through the waker's
  existing turn reporter (same instance, no second transport). Only for the
  `idea` / `daemon_session` entity types, where sessionId === e

**File**: `cli/__tests__/child-exit.test.mjs` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+// cli/__tests__/child-exit.test.mjs
+// Covers the daemon-spawner-interface spec requirement "a wake SHALL settle on
+// process exit, not only on stdio close":
+//   • `close` first          → settle immediately, no grace warning.
+//   • `exit` with no `close` → settle with the exit code after the bounded grace,
+//                              warning logged exactly once (the "a detached
+//                              descendant inherited the pipes" diagnostic).
+//   • `exit` then `close`    → settle exactly once.
+//   • the grace timer is `unref`'d so it cannot hold the daemon's event loop open.
+import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
+import { EventEmitter } from "node:events";
+import { awaitChildSettled, DEFAULT_STDIO_GRACE_MS } from "../child-exit.mjs";
+
+function makeLogger() {
+  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
+}
+
+describe("awaitChildSettled", () => {
+  beforeEach(() => {
+    vi.useFakeTimers();
+  });
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  it("settles immediately on close-first without a grace warning", async () => {
+    const child = new EventEmitter();
+    const logger = makeLogger();
+    const settled = awaitChildSettled(child, { logger, label: "pi" });
+
+    child.emit("close", 0);
+
+    await expect(settled).resolves.toBe(0);
+    expect(logger.warn).not.toHaveBeenCalled();
+    // Nothing was scheduled: close-first never arms the grace timer.
+    expect(vi.getTimerCount()).toBe(0);
+  });
+
+  it("settles on close-first even when a nonzero code arrives", async () => {
+    const child = new EventEmitter();
+    const logger = makeLogger();
+    const settled = awaitChildSettled(child, { logger, label: "claude" });
+
+    child.emit("close", 23);
+
+    await expect(settled).resolves.toBe(23);
+    expect(logger.warn).not.toHaveBeenCalled();
+  });
+
+  it("settles with the exit code after the grace when close never arrives, warning once", async () => {
+    const child = new EventEmitter();
+    const logger = makeLogger();
+    const settled = awaitChildSettled(child, { logger, label: "codex", stdioGraceMs: 2000 });
+
+    child.emit("exit", 7, null);
+    // Still pending before the grace expires — the pipes get their bounded moment.
+    let resolvedWith = "pending";
+    settled.then((code) => {
+      resolvedWith = code;
+    });
+    await vi.advanceTimersByTimeAsync(1999);
+    expect(resolvedWith).toBe("pending");
+
+    await vi.advanceTimersByTimeAsync(1);
+    await expect(settled).resolves.toBe(7);
+    expect(logger.warn).toHaveBeenCalledTimes(1);
+    expect(logger.warn.mock.calls[0][0]).toContain("codex exited (code 7)");
+    expect(logger.warn.mock.calls[0][0]).toContain("stdio stayed open for 2000ms");
+  });
+
+  it("normalizes a signalled exit (code null) and still settles", async () => {
+    const child = new EventEmitter();
+    const logger = makeLogger();
+    const settled = awaitChildSettled(child, { logger, label: "kiro-cli", stdioGraceMs: 50 });
+
+    child.emit("exit", null, "SIGKILL");
+    await vi.advanceTimersByTimeAsync(50);
+
+    await expect(settled).resolves.toBe(null);
+    expect(logger.warn).toHaveBeenCalledTimes(1);
+    expect(logger.warn.mock.calls[0][0]).toContain("code null");
+  });
+
+  it("settles exactly once when exit is followed by close inside the grace", async () => {
+    const child = new EventEmitter();
+    const logger = makeLogger();
+    const onSettled = vi.fn();
+    awaitChildSettled(child, { logger, label: "dsh", stdioGraceMs: 2000 }).then(onSettled);
+
+    child.emit("exit", 0, null);
+    child.emit("close", 0);
+    await vi.advanceTimersByTimeAsync(5000);
+
+    expect(onSettled).toHaveBeenCalledTimes(1);
+    expect(onSettled).toHaveBeenCalledWith(0);
+    // close won the race, so the grace never expired and nothing was warned.
+    expect(logger.warn).not.toHaveBeenCalled();
+    expect(vi.getTimerCount()).toBe(0);
+  });
+
+  it("settles exactly once when close arrives after the grace already settled", async () => {
+    const child = new EventEmitter();
+    const logger = makeLogger();
+    const onSettled = vi.fn();
+    awaitChildSettled(child, { logger, label: "dsh", stdioGraceMs: 10 }).then(onSettled);
+
+    child.emit("exit", 3, null);
+    await vi.advanceTimersByTimeAsync(10);
+    child.emit("close", 0);
+    await vi.advanceTimersByTimeAsync(1000);
+
+    expect(onSettled).toHaveBeenCalledTimes(1);
+    expect(onSettled).toHaveBeenCalledWith(3);
+    expect(logger.warn).toHaveBeenCalledTimes(1);
+  });
+
+  it("arms the grace once even if exit is emitted twice", async () => {
+    const child = new EventEmitter();
+    const logger = makeLogger();
+    const onSettled = vi.fn();
+    awaitChildSettled(child, { logger, label: "pi", stdioGraceMs: 30 }).then(onSettled);
+
+    child.emit("exit", 4, null);
+    child.emit("exit", 9, null);
+    await vi.advanceTimersByTimeAsync(30);
+
+    expe
```

**File**: `cli/__tests__/control-handler.test.mjs` (modified, +241/-0)
```diff
@@ -431,3 +431,244 @@ describe("control-handler browse_directory", () => {
     });
   });
 });
+
+// --- fix-phantom-running-turn, Tech Design "D — a no-child interrupt reports the
+//     truth": an interrupt that finds no live child must no longer be a silent
+//     no-op — it reports the turn as interrupted(user) so a server-side `running`
+//     turn with nothing behind it converges. ---
+const IDEA_UUID = "idea-1111-2222-3333-444455556666";
+
+describe("control-handler no-child interrupt reports interrupted(user)", () => {
+  it("reports advanceTurn with status=interrupted / reason=user / sessionId=entityUuid for an idea, and logs the miss", () => {
+    const infos = [];
+    const waker = makeWaker([]); // no running child on this daemon
+    const killer = vi.fn(async () => {});
+    const advanceTurn = vi.fn(async () => ({ ok: true }));
+    const onControl = createControlHandler({
+      waker,
+      getConnectionUuid: () => CONN,
+      killer,
+      advanceTurn,
+      logger: { ...silent, info: (m) => infos.push(m) },
+    });
+
+    onControl(controlEvent({ entityType: "idea", entityUuid: IDEA_UUID }));
+
+    expect(killer).not.toHaveBeenCalled();
+    expect(waker.markInterrupting).not.toHaveBeenCalled();
+    expect(advanceTurn).toHaveBeenCalledTimes(1);
+    expect(advanceTurn).toHaveBeenCalledWith({
+      sessionId: IDEA_UUID,
+      status: "interrupted",
+      interruptedReason: "user",
+      entityType: "idea",
+      entityUuid: IDEA_UUID,
+    });
+    expect(infos.join("")).toMatch(/no running subprocess/i);
+    expect(infos.join("")).toMatch(/interrupted\(user\)/i);
+  });
+
+  it("reports for a daemon_session entity too (sessionId = its own business uuid)", () => {
+    const waker = makeWaker([]);
+    const advanceTurn = vi.fn(async () => ({ ok: true }));
+    const onControl = createControlHandler({
+      waker,
+      getConnectionUuid: () => CONN,
+      killer: vi.fn(async () => {}),
+      advanceTurn,
+      logger: silent,
+    });
+
+    onControl(controlEvent({ entityType: "daemon_session", entityUuid: "sess-9" }));
+
+    expect(advanceTurn).toHaveBeenCalledWith({
+      sessionId: "sess-9",
+      status: "interrupted",
+      interruptedReason: "user",
+      entityType: "daemon_session",
+      entityUuid: "sess-9",
+    });
+  });
+
+  it("reports when the entry exists but is only QUEUED (no child yet)", () => {
+    const waker = makeWaker([
+      [`idea:${IDEA_UUID}`, { entityType: "idea", entityUuid: IDEA_UUID, status: "queued", child: null }],
+    ]);
+    const advanceTurn = vi.fn(async () => ({ ok: true }));
+    const onControl = createControlHandler({
+      waker,
+      getConnectionUuid: () => CONN,
+      killer: vi.fn(async () => {}),
+      advanceTurn,
+      logger: silent,
+    });
+
+    onControl(controlEvent({ entityType: "idea", entityUuid: IDEA_UUID }));
+
+    expect(advanceTurn).toHaveBeenCalledTimes(1);
+    expect(advanceTurn.mock.calls[0][0]).toMatchObject({ status: "interrupted", interruptedReason: "user" });
+  });
+
+  it("an idea interrupt with no direct child KILLS a sibling wake running on the same session", () => {
+    // A `task:T` wake whose directIdeaUuid is the idea runs on that idea's session, and the
+    // registry is keyed by the WAKE's own resource (`task:T`). Without the sibling match the
+    // exact-key lookup misses, we report a turn miss, the server's FIFO grabs the sibling's
+    // running turn, and NOTHING is killed — the UI would say interrupted while work continues.
+    const child = { pid: 9191 };
+    const waker = makeWaker([
+      [
+        "task:T-1",
+        {
+          entityType: "task",
+          entityUuid: "T-1",
+          directIdeaUuid: "idea-9",
+          status: "running",
+          child,
+        },
+      ],
+    ]);
+    const killer = vi.fn(async () => {});
+    const advanceTurn = vi.fn(async () => ({ ok: true }));
+    const infos = [];
+    const onControl = createControlHandler({
+      waker,
+      getConnectionUuid: () => CONN,
+      killer,
+      advanceTurn,
+      logger: { ...silent, info: (m) => infos.push(m) },
+    });
+
+    onControl(controlEvent({ entityType: "idea", entityUuid: "idea-9" }));
+
+    // The sibling's wake is what gets flagged and killed — not a turn-miss report.
+    expect(waker.markInterrupting).toHaveBeenCalledWith("task", "T-1");
+    expect(killer).toHaveBeenCalledTimes(1);
+    expect(killer.mock.calls[0][0]).toBe(child);
+    expect(advanceTurn).not.toHaveBeenCalled();
+    expect(infos.join("")).toMatch(/sibling wake task:T-1/);
+  });
+
+  it("still reports the turn when a sibling entry exists but is NOT running", () => {
+    const waker = makeWaker([
+      [
+        "task:T-2",
+        {
+          entityType: "task",
+          entityUuid: "T-2",
+          directIdeaUuid: "idea-9",
+          status: "queued",
+          child: null,
+        },
+      ],
+    ]);
+    const killer = vi.fn(async () => {});
+    const ad
```

**File**: `cli/__tests__/daemon-rest-client.test.mjs` (modified, +127/-0)
```diff
@@ -470,3 +470,130 @@ describe("createDaemonRestClient — error surfacing (no silent errors)", () =>
     await expect(client.readPendingTurns()).resolves.toBeTruthy();
   });
 });
+
+// A lost TERMINAL turn-advance is the one transport failure that strands a turn as a
+// phantom `running` forever (fix-phantom-running-turn), so that edge — and only that edge —
+// gets a bounded retry: 3 attempts, 500ms then 2000ms, retryable = network / 429 / 5xx.
+describe("createDaemonRestClient — bounded retry on the terminal turn-advance edge", () => {
+  // Fails the first `failCount` attempts at the network level, then answers 200.
+  function flakyFetch(failCount, status = 200) {
+    let calls = 0;
+    return vi.fn(async () => {
+      calls += 1;
+      if (calls <= failCount) throw new Error("ECONNREFUSED");
+      return { ok: status >= 200 && status < 300, status, json: async () => ({}) };
+    });
+  }
+
+  function retryClient(overrides = {}) {
+    const warns = [];
+    const slept = [];
+    const client = makeClient({
+      logger: { ...silent, warn: (m) => warns.push(m) },
+      sleep: async (ms) => { slept.push(ms); },
+      ...overrides,
+    });
+    return { client, warns, slept };
+  }
+
+  for (const status of ["ended", "interrupted"]) {
+    it(`→ ${status} recovers from a first network failure on the second attempt (exactly 2 requests)`, async () => {
+      const fetchImpl = flakyFetch(1);
+      const { client, warns, slept } = retryClient({ fetchImpl });
+
+      const result = await client.turnAdvance({ sessionId: "idea-1", status });
+
+      expect(result).toMatchObject({ ok: true, status: 200 });
+      expect(fetchImpl).toHaveBeenCalledTimes(2);
+      expect(slept).toEqual([500]);
+      // The failed attempt is visible WITH its ordinal and its cause.
+      expect(warns).toHaveLength(1);
+      expect(warns[0]).toMatch(/turn-advance request failed \(attempt 1\/3\).*ECONNREFUSED/);
+    });
+  }
+
+  it("retries a 503 and a 429 up to the budget", async () => {
+    for (const status of [503, 429]) {
+      const fetchImpl = okFetch(status);
+      const { client, slept } = retryClient({ fetchImpl });
+
+      const result = await client.turnAdvance({ sessionId: "idea-1", status: "ended" });
+
+      expect(result).toMatchObject({ ok: false, status });
+      expect(fetchImpl).toHaveBeenCalledTimes(3);
+      expect(slept).toEqual([500, 2000]);
+    }
+  });
+
+  it("never retries a 4xx — a server verdict cannot become true by repeating", async () => {
+    for (const status of [400, 401, 404]) {
+      const fetchImpl = okFetch(status);
+      const { client, warns, slept } = retryClient({ fetchImpl });
+
+      const result = await client.turnAdvance({ sessionId: "idea-1", status: "ended" });
+
+      expect(result).toMatchObject({ ok: false, status });
+      expect(result.error).toBe(`turn-advance returned ${status}`);
+      expect(fetchImpl).toHaveBeenCalledTimes(1);
+      expect(slept).toEqual([]);
+      // The final failure line keeps its pre-retry wording (log-grep compatibility).
+      expect(warns.at(-1)).toBe(`[Chorus] turn-advance returned ${status}`);
+    }
+  });
+
+  it("stops at exactly 3 attempts with 500ms then 2000ms delays and surfaces the original failure result", async () => {
+    const fetchImpl = vi.fn(async () => {
+      throw new Error("ECONNREFUSED");
+    });
+    const { client, warns, slept } = retryClient({ fetchImpl });
+
+    const result = await client.turnAdvance({ sessionId: "idea-1", status: "ended" });
+
+    expect(fetchImpl).toHaveBeenCalledTimes(3);
+    expect(slept).toEqual([500, 2000]);
+    expect(result).toMatchObject({ ok: false, status: null });
+    // Structured failure result is byte-identical to the pre-retry one — never thrown.
+    expect(result.error).toMatch(/^turn-advance request failed: Error: ECONNREFUSED$/);
+    // An ordinal line is emitted only when another attempt actually follows — the ordinal
+    // exists to explain a retry. So attempts 1 and 2 carry one; the LAST failure does not,
+    // because it is re-logged verbatim below (no redundant near-duplicate pair).
+    expect(warns.filter((m) => /\(attempt \d\/3\)/.test(m))).toHaveLength(2);
+    expect(warns[0]).toMatch(/\(attempt 1\/3\)/);
+    expect(warns[1]).toMatch(/\(attempt 2\/3\)/);
+    expect(warns.some((m) => /\(attempt 3\/3\)/.test(m))).toBe(false);
+    // …and the last line is the unchanged final-failure wording.
+    expect(warns.at(-1)).toBe("[Chorus] turn-advance request failed: Error: ECONNREFUSED");
+  });
+
+  it("does NOT retry the → running edge (the wake runs anyway; a stale retry could race the terminal edge)", async () => {
+    const fetchImpl = vi.fn(async () => {
+      throw new Error("ECONNREFUSED");
+    });
+    const { client, warns, slept } = retryClient({ fetchImpl });
+
+    const result = await client.turnAdvance({ sessionId: "idea-1", status: "running" });
+
+    expect(fetchImpl).toHaveBeenCalledTimes(1);
+    expect(slept
```

**File**: `cli/child-exit.mjs` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+// cli/child-exit.mjs
+// One shared settlement path for every spawner's child process, so the five
+// backends (pi / claude / codex / kiro / dsh) cannot drift on "when is the wake
+// over?".
+//
+// WHY THIS EXISTS — `close` is not the same event as "the agent finished".
+// Node emits `exit` when the child process itself is reaped, but `close` only
+// once every stdio stream the child was given has been closed. A child that
+// leaves a DETACHED DESCENDANT behind (a backgrounded server, a `nohup`'d
+// helper) hands that descendant the SAME inherited pipes, so the pipes stay
+// open after the child is long gone and `close` may never fire. A spawner that
+// waits only for `close` therefore keeps reporting a finished wake as still
+// `running` — the phantom `running` turn. Settling on `exit` fixes that.
+//
+// !!! THE GRACE IS NOT A WAKE TIMEOUT AND NOT A WATCHDOG !!!
+// `stdioGraceMs` only starts counting AFTER the child process has ALREADY
+// EXITED, and it bounds one thing only: how long we wait for that dead
+// process's pipes to drain so a final stdout chunk is still parsed. It places
+// no limit whatsoever on how long an agent may run — a wake that runs for
+// hours is never interrupted, cancelled or "timed out" by this module. No
+// wake-duration limit is introduced anywhere here; do not repurpose this timer
+// into one.
+
+/** Grace for an already-exited process's pipes to drain. NOT a wake timeout. */
+export const DEFAULT_STDIO_GRACE_MS = 2000;
+
+/**
+ * Resolve once with the child's exit code as soon as the process is KNOWN to be gone.
+ *
+ *  • `close` first  → resolve immediately (today's behaviour, zero regression).
+ *  • `exit` first   → wait up to `stdioGraceMs` for `close` (so a last stdout chunk
+ *                     is still parsed), then resolve with the exit code anyway.
+ *
+ * Settles exactly once and NEVER rejects. The grace timer is `unref`'d so it can
+ * never hold the daemon's event loop open.
+ *
+ * @param {import("node:child_process").ChildProcess} child
+ * @param {{ stdioGraceMs?: number, logger?: { warn?: (msg: string) => void }, label?: string }} [options]
+ * @returns {Promise<number | null>} the exit code (`null` when the child was signalled)
+ */
+export function awaitChildSettled(child, options = {}) {
+  const { stdioGraceMs = DEFAULT_STDIO_GRACE_MS, logger, label = "child" } = options;
+
+  return new Promise((resolve) => {
+    let settled = false;
+    let timer = null;
+
+    const settle = (code) => {
+      if (settled) return;
+      settled = true;
+      if (timer) {
+        clearTimeout(timer);
+        timer = null;
+      }
+      resolve(code ?? null);
+    };
+
+    child.on?.("close", (code) => settle(code));
+
+    child.on?.("exit", (code) => {
+      if (settled || timer) return;
+      // The process is gone; give its (possibly descendant-held) pipes a bounded
+      // moment to drain, then settle regardless. See the header: not a timeout.
+      timer = setTimeout(() => {
+        timer = null;
+        if (settled) return;
+        logger?.warn?.(
+          `[Chorus] ${label} exited (code ${code ?? null}) but stdio stayed open for ` +
+            `${stdioGraceMs}ms; settling on exit`
+        );
+        settle(code);
+      }, stdioGraceMs);
+      // Never keep the daemon's event loop alive for a dead process's pipes.
+      timer?.unref?.();
+    });
+  });
+}
```

**File**: `cli/claude-spawner.mjs` (modified, +4/-1)
```diff
@@ -28,6 +28,7 @@ import { validateAgentCliConfig, overlayAgentEnv, getAgentEnv, assertConfiguredS
 import { existsSync, statSync } from "node:fs";
 import { homedir } from "node:os";
 import { win32 as pathWin32, posix as pathPosix, join as pathJoin } from "node:path";
+import { awaitChildSettled } from "./child-exit.mjs";
 
 const NOOP_LOGGER = { info() {}, warn() {}, error() {} };
 
@@ -447,7 +448,9 @@ export class ClaudeSpawner {
         resolve({ sessionId: observedSessionId, backendSessionId: id, exitCode: null, isNew });
       });
 
-      child.on("close", (code) => {
+      // Settle on process exit, not only on stdio close: a detached descendant can
+      // inherit the pipes and keep `close` from ever firing (see cli/child-exit.mjs).
+      awaitChildSettled(child, { logger: this.logger, label: "claude" }).then((code) => {
         if (code !== 0) {
           this.logger.warn(`[Chorus] claude exited with code ${code}`);
         }
```

**File**: `cli/codex-spawner.mjs` (modified, +4/-1)
```diff
@@ -33,6 +33,7 @@ import { readFileSync, statSync } from "node:fs";
 import { homedir } from "node:os";
 import { join, win32 as pathWin32, posix as pathPosix } from "node:path";
 import { parseNdjsonChunk } from "./claude-spawner.mjs";
+import { awaitChildSettled } from "./child-exit.mjs";
 import { getThreadId as defaultGetThreadId, setThreadId as defaultSetThreadId } from "./codex-session-map.mjs";
 import {
   getCodexUsageSnapshot as defaultGetUsageSnapshot,
@@ -370,7 +371,9 @@ export class CodexSpawner {
         resolve({ sessionId: anchor, backendSessionId: observedThreadId, exitCode: null, isNew });
       });
 
-      child.on("close", (code) => {
+      // Settle on process exit, not only on stdio close: a detached descendant can
+      // inherit the pipes and keep `close` from ever firing (see cli/child-exit.mjs).
+      awaitChildSettled(child, { logger: this.logger, label: "codex" }).then((code) => {
         if (code !== 0) {
           this.logger.warn(`[Chorus] codex exited with code ${code}`);
         }
```

**File**: `cli/control-handler.mjs` (modified, +104/-6)
```diff
@@ -12,6 +12,17 @@
 // so a stale / recycled connection uuid can never make the daemon kill the wrong
 // subprocess (Tech Design "Risks": mis-kill after a reconnect).
 //
+// When Check-2 fails for an `interrupt` (no live child here) the command is NOT
+// silently dropped (fix-phantom-running-turn, Tech Design "D — a no-child interrupt
+// reports the truth"): the handler logs the miss AND fire-and-forgets one
+// `advanceTurn({ status: "interrupted", interruptedReason: "user" })` so a server-side
+// `running` turn with no daemon child behind it converges instead of hanging forever.
+// The session business key is derived without any lookup, and therefore only for the
+// two control entity types where the derivation is an identity (`idea`,
+// `daemon_session` → sessionId === entityUuid). `task` / `proposal` / `document` keep
+// the pure-log behaviour: their session is anchored on the resource's DIRECT idea,
+// which the daemon cannot resolve locally, and guessing would converge the wrong turn.
+//
 // On a verified match it (a) sets a per-entity "interrupting" flag on the waker so
 // the waker reports the resulting exit as interrupted(reason="user") rather than a
 // crash, then (b) invokes the injected killer (process-killer.killProcessTree) on
@@ -25,6 +36,16 @@ import { killProcessTree } from "./process-killer.mjs";
 
 const NOOP_LOGGER = { info() {}, warn() {}, error() {} };
 
+/**
+ * Control entity types whose session business key is the entityUuid itself, so a
+ * no-child interrupt can report the turn terminal WITHOUT any REST lookup:
+ *   • `idea`           — the session anchor IS the direct idea uuid.
+ *   • `daemon_session` — the ad-hoc session's own business id.
+ * Every other member of CONTROL_ENTITY_TYPES (`task`, `proposal`, `document`) is
+ * anchored on that resource's DIRECT idea, which is not derivable locally.
+ */
+const SELF_ANCHORED_ENTITY_TYPES = new Set(["idea", "daemon_session"]);
+
 /**
  * Build the `onControl(event)` callback the SseListener invokes for a
  * `type:"control"` event.
@@ -56,6 +77,15 @@ const NOOP_LOGGER = { info() {}, warn() {}, error() {} };
  *                                            other still-pending turn along. Injected by the
  *                                            daemon (`backfill.pendingTurnsOnly`); the
  *                                            arg-less form (reconnect) still sweeps all.
+ *   advanceTurn?: (params: { sessionId: string, status: string, interruptedReason?: string,
+ *                            entityType?: string|null, entityUuid?: string|null }) => any,
+ *                                            The SAME `createTurnReporter(...)` instance the
+ *                                            waker uses (injected by `cli/daemon.mjs`; no
+ *                                            second transport, no new endpoint). Invoked
+ *                                            fire-and-forget ONLY when an `interrupt` finds no
+ *                                            live child for a self-anchored entity type, to
+ *                                            close a server-side `running` turn that nothing
+ *                                            else would ever close.
  *   logger?: { info(m:string):void, warn(m:string):void, error(m:string):void },
  * }} deps
  * @returns {(event: any) => void}  The onControl callback (synchronous, non-throwing).
@@ -67,6 +97,7 @@ export function createControlHandler(deps) {
   const sigintTimeoutMs = deps.sigintTimeoutMs;
   const redispatchResume = deps.redispatchResume;
   const deliverTurn = deps.deliverTurn;
+  const advanceTurn = deps.advanceTurn;
   const handleDirectoryRequest = deps.handleDirectoryRequest;
   const reportDirectoryRequest = deps.reportDirectoryRequest;
   const logger = deps.logger ?? NOOP_LOGGER;
@@ -202,11 +233,76 @@ export function createControlHandler(deps) {
       }
 
       // --- interrupt path: Check 2 — in-memory entity ownership (running child) ---
+      //
+      // The registry is keyed by the WAKE's own resource (`task:T`), while a
+      // conversation's control key is its session anchor (`idea:A`). A wake on a CHILD
+      // resource of idea A runs on session A (waker: `sessionId = directIdeaUuid`), so an
+      // `idea:A` interrupt must also find a running `task:T` / `proposal:P` / `document:D`
+      // entry whose `directIdeaUuid` is A — the same rule the UI's `executionMatchesSession`
+      // applies. Without this the exact-key lookup misses, we report a turn miss, the
+      // server's FIFO resolution grabs the SIBLING wake's `running` turn, and NOTHING is
+      // killed: the UI would say interrupted while the agent keeps working.
       const key = execKey(entityType, entityUuid);
-      const entry = waker?.executions?.get(key);
+      let entry = waker?.executions?.get(key);
+      // The entity the kill actually targets — normally the command's own, but a sibling
+      // wake when the match below re-points i
```

**File**: `cli/daemon-rest-client.mjs` (modified, +98/-29)
```diff
@@ -40,6 +40,26 @@
 
 const NOOP_LOGGER = { info() {}, warn() {}, error() {} };
 
+// Bounded retry policy for the TERMINAL turn-advance edge only (fix-phantom-running-turn).
+// A lost terminal report is the one failure that leaves a permanently phantom `running`
+// turn, so it — and only it — is worth retrying. Fixed constants on purpose: one more
+// configuration knob buys nothing here.
+const TERMINAL_TURN_ADVANCE_ATTEMPTS = 3;
+const TERMINAL_TURN_ADVANCE_DELAYS_MS = [500, 2000];
+
+/** Real-time delay; tests inject their own so they never sleep for real. */
+const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
+
+/**
+ * A failure is retryable when repeating it can plausibly succeed: a network-level failure
+ * (no HTTP response at all), a `429`, or any `5xx`. Every `4xx` is a server VERDICT
+ * (invalid_transition, not_found, auth) — repeating it cannot make it true.
+ * @param {number|null} status
+ */
+function isRetryableFailure(status) {
+  return status === null || status === 429 || status >= 500;
+}
+
 /**
  * @typedef {Object} DaemonRestResult
  * @property {boolean} ok           True only on a 2xx response (and, for reads, a
@@ -70,6 +90,8 @@ const NOOP_LOGGER = { info() {}, warn() {}, error() {} };
  *                                         executionState, reportInterrupt, readPendingTurns)
  *                                         require it; a null value skips the call (logged).
  *   fetchImpl?: typeof fetch,             Injectable for tests (defaults to global fetch).
+ *   sleep?: (ms: number) => Promise<void>, Injectable retry delay (defaults to setTimeout).
+ *                                         Only the terminal turn-advance edge retries.
  *   logger?: { info(m:string):void, warn(m:string):void, error(m:string):void },
  * }} opts
  * @returns {{
@@ -88,6 +110,8 @@ export function createDaemonRestClient(opts) {
   const getConnectionUuid = opts.getConnectionUuid ?? (() => null);
   const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
   const logger = opts.logger ?? NOOP_LOGGER;
+  // Injectable retry delay so tests assert the schedule without spending real seconds.
+  const sleepImpl = opts.sleep ?? realSleep;
 
   const jsonHeaders = {
     Authorization: `Bearer ${apiKey}`,
@@ -111,41 +135,71 @@ export function createDaemonRestClient(opts) {
    *                         `<op> request failed` / `<op> returned <status>` core, so the
    *                         failing entity stays visible in the log without disturbing the
    *                         established op-prefixed message.
+   * @param {boolean} [readData]   Parse the response envelope's `data` on success.
+   * @param {{ attempts: number, delaysMs: number[], sleep?: (ms: number) => Promise<void> }|null} [retry]
+   *                         Optional bounded retry policy. Absent/null = today's exact
+   *                         single-shot behaviour (used by every op but the terminal
+   *                         turn-advance edge).
    * @returns {Promise<DaemonRestResult>}
    */
-  async function post(op, path, body, successLog, context = "", readData = false) {
-    let response;
-    try {
-      response = await fetchImpl(`${url}${path}`, {
-        method: "POST",
-        headers: jsonHeaders,
-        body: JSON.stringify(body),
-      });
-    } catch (err) {
-      // Network-level failure (DNS, connection refused, abort, …). Surface WITH cause.
-      const error = `${op} request failed${context}: ${err}`;
-      logger.warn(`[Chorus] ${error}`);
-      return { ok: false, status: null, error };
-    }
-    if (!response.ok) {
-      // Non-2xx. Surface WITH the status so a 4xx/5xx is debuggable.
-      const error = `${op} returned ${response.status}${context}`;
-      logger.warn(`[Chorus] ${error}`);
-      return { ok: false, status: response.status, error };
-    }
-    let data;
-    if (readData) {
+  async function post(op, path, body, successLog, context = "", readData = false, retry = null) {
+    const attempts = retry ? retry.attempts : 1;
+    const delaysMs = retry?.delaysMs ?? [];
+    // Named distinctly from the module-closure `sleepImpl` so this local never reads as a
+    // shadow: callers with a retry policy pass their own sleep explicitly.
+    const retrySleep = retry?.sleep ?? realSleep;
+
+    let failure;
+    for (let attempt = 1; attempt <= attempts; attempt += 1) {
+      failure = undefined;
+      let response;
       try {
-        const parsed = await response.json();
-        data = parsed && typeof parsed === "object" ? parsed.data : undefined;
+        response = await fetchImpl(`${url}${path}`, {
+          method: "POST",
+          headers: jsonHeaders,
+          body: JSON.stringify(body),
+        });
       } catch (err) {
-        // Mixed-version fallback: older servers may return an empty successful body.
-        // Keep the lifecycle report successful, but make the missing correlation visible.
-        logger.warn(`[Chorus]
```

---

### Incident Patch 14: `b51172fd` (2026-09-16)
**Commit Message**: fix: open paged active sessions directly (#568)

**File**: `openspec/specs/daemon-session-transcript-read/spec.md` (modified, +25/-1)
```diff
@@ -87,7 +87,13 @@ live status, and an entity-bearing turn SHALL link to its related task/idea.
 Connection metadata (host, client version, uptime, started) SHALL be demoted from
 the headline to a secondary/collapsible position. The right pane SHALL offer
 inline send-instruction and interrupt controls, each gated on the session's origin
-being online.
+being online. When an entry point focuses a specific visible session UUID, the
+surface SHALL load and display that exact transcript even when the target session
+is older than the selected agent's currently loaded server-paginated page. The
+focused read SHALL add only that target session to the local conversation rows and
+MUST NOT restore an unbounded all-history list read. If the focused session cannot
+be loaded, the surface SHALL clear the unresolved selection and fall back to the
+selected agent's conversation list.
 
 #### Scenario: Selecting an agent then a conversation
 
@@ -121,6 +127,24 @@ being online.
 - **THEN** the surface shows a calm empty state that invites starting a
   conversation, never an error treatment
 
+#### Scenario: A focused session outside the first page opens directly
+
+- **WHEN** the Idea Tracker or another entry point focuses a visible session UUID
+  that is not present in the selected agent's currently loaded conversation page
+- **THEN** the surface reads that session by UUID and directly renders its transcript
+- **AND** mobile opens the transcript drill-down while desktop selects the same
+  transcript in the two-pane layout
+- **AND** only the focused row is added locally; the bounded server pagination
+  remains in effect
+
+#### Scenario: An unavailable focused session falls back safely
+
+- **WHEN** a focused session UUID cannot be read because it is missing, no longer
+  visible, or the request fails
+- **THEN** the unresolved selection is cleared
+- **AND** the surface falls back to the selected agent's conversation list without
+  leaving an empty mobile drill-down or requesting the full conversation history
+
 ### Requirement: The conversation surface SHALL be a near-full-height bottom sheet on mobile with the reply input kept reachable
 
 On a mobile-width viewport (below the `sm` breakpoint), the "View all" daemon conversation surface SHALL open from the bottom as a near-full-height sheet using the product's existing mobile Sheet visual language and entrance/exit motion. The sheet SHALL leave a fixed 16 CSS-pixel strip of backdrop visible above it, use rounded top corners and a visible top handle within a compact 28 CSS-pixel handle row, and retain a height bounded by the dynamic viewport so mobile browser chrome and safe-area insets do not make the reply composer unreachable. The selected conversation's transcript SHALL fill the middle region and scroll within itself, and the reply/send input SHALL remain at the bottom of the bounded sheet without dead space below it.
```

**File**: `src/components/agent-presence/__tests__/connections-modal.test.tsx` (modified, +142/-1)
```diff
@@ -116,7 +116,8 @@ function OpenForSessionTrigger({
 
 // A stand-in for the Idea Tracker / graph running-session affordance. Unlike
 // openChatForSession, this path has no SessionView seed; it must preserve the
-// activity's sessionUuid and let the already-fetched conversation list resolve it.
+// activity's sessionUuid and resolve it even when the first conversation page
+// does not contain that session.
 function OpenActiveIdeaSessionTrigger() {
   const { openChatForActiveSession } = useAgentPresence();
   return (
@@ -1182,6 +1183,146 @@ describe("Daemon chat modal — active Idea session focus", () => {
       screen.getAllByText("Current idea conversation").length,
     ).toBeGreaterThan(0);
   });
+
+  it("loads and injects the exact transcript when the active session is outside the first page", async () => {
+    mockViewport(true);
+    const ideaSession = session({
+      uuid: "s-idea",
+      agentUuid: "agent-1",
+      directIdeaUuid: "idea-1",
+      title: "Older active idea conversation",
+      originConnectionUuid: "1",
+      lastTurnAt: "2026-06-15T10:00:00.000Z",
+    });
+    respondWith({
+      connections: [
+        conn({
+          uuid: "1",
+          agentUuid: "agent-1",
+          agentName: "Alpha",
+          host: "host",
+          cwd: "/workspace/chorus",
+        }),
+      ],
+      // Simulate the bounded first page: another newer row is present, while
+      // the active target can only be resolved through its UUID detail read.
+      sessions: [
+        session({
+          uuid: "s-newer",
+          agentUuid: "agent-1",
+          title: "Newer conversation",
+          originConnectionUuid: "1",
+        }),
+      ],
+      detail: { session: ideaSession, turns: [] },
+    });
+
+    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
+    render(
+      <AgentPresenceProvider>
+        <OpenActiveIdeaSessionTrigger />
+        <AgentConnectionsModal />
+      </AgentPresenceProvider>,
+    );
+    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());
+    await user.click(screen.getByText("open-active-idea-session"));
+
+    await waitFor(() =>
+      expect(
+        mockAuthFetch.mock.calls.some(
+          (call) =>
+            typeof call[0] === "string" &&
+            call[0] === "/api/daemon-sessions/s-idea",
+        ),
+      ).toBe(true),
+    );
+    expect(
+      screen.getAllByText("Older active idea conversation").length,
+    ).toBeGreaterThan(0);
+    expect(screen.getByRole("button", { name: "Conversations" })).toBeTruthy();
+    expect(
+      mockAuthFetch.mock.calls.some(
+        (call) =>
+          typeof call[0] === "string" &&
+          call[0].startsWith(
+            "/api/daemon-sessions?agentUuid=agent-1&limit=12",
+          ),
+      ),
+    ).toBe(true);
+    expect(
+      mockAuthFetch.mock.calls.filter(
+        (call) =>
+          typeof call[0] === "string" &&
+          call[0] === "/api/daemon-sessions/s-idea",
+      ),
+    ).toHaveLength(1);
+    expect(
+      mockAuthFetch.mock.calls.some(
+        (call) =>
+          typeof call[0] === "string" &&
+          call[0] === "/api/daemon-sessions",
+      ),
+    ).toBe(false);
+  });
+
+  it("falls back to the conversation list when an active session already in the first page cannot be loaded", async () => {
+    const ideaSession = session({
+      uuid: "s-idea",
+      agentUuid: "agent-1",
+      directIdeaUuid: "idea-1",
+      title: "Unavailable active conversation",
+      originConnectionUuid: "1",
+    });
+    respondWith({
+      connections: [
+        conn({
+          uuid: "1",
+          agentUuid: "agent-1",
+          agentName: "Alpha",
+          host: "host",
+          cwd: "/workspace/chorus",
+        }),
+      ],
+      sessions: [
+        ideaSession,
+        session({
+          uuid: "s-newer",
+          agentUuid: "agent-1",
+          title: "Available conversation",
+          originConnectionUuid: "1",
+        }),
+      ],
+      detail: null,
+    });
+
+    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
+    render(
+      <AgentPresenceProvider>
+        <OpenActiveIdeaSessionTrigger />
+        <AgentConnectionsModal />
+      </AgentPresenceProvider>,
+    );
+    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());
+    await user.click(screen.getByText("open-active-idea-session"));
+
+    await waitFor(() =>
+      expect(
+        mockAuthFetch.mock.calls.some(
+          (call) =>
+            typeof call[0] === "string" &&
+            call[0] === "/api/daemon-sessions/s-idea",
+        ),
+      ).toBe(true),
+    );
+    await waitFor(() =>
+      expect(
+        screen.queryByRole("button", { name: "Conversations" }),
+      ).toBeNull(),
+    );
+    expect(
+      screen.getAllByText("Available conversation").length,
+    ).toBeGreaterThan(0);
+  });
 });
 
 describe("Daemon chat modal — transcript pagination (load earlier)", () => {
```

**File**: `src/components/agent-presence/chat/daemon-chat.tsx` (modified, +94/-10)
```diff
@@ -544,6 +544,29 @@ export function DaemonChat() {
   const [selectedSessionUuid, setSelectedSessionUuid] = useState<string | null>(
     null,
   );
+  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
+  // A one-shot focus can identify a conversation outside the selected agent's
+  // first server-paginated page. Keep that UUID while its direct detail read is
+  // in flight so the transcript can open independently of the 12 loaded rows.
+  // Once the detail succeeds it is injected into `sessions`; on failure the
+  // marker lets us safely fall back to the conversation list instead of leaving
+  // a phantom selection or an empty mobile drill-down behind.
+  const focusedSessionUuidRef = useRef<string | null>(null);
+  const focusedSessionNeedsInjectionRef = useRef<string | null>(null);
+  const connectionsRef = useRef(connections);
+  useEffect(() => {
+    connectionsRef.current = connections;
+  }, [connections]);
+  const abandonFocusedSession = useCallback((sessionUuid: string) => {
+    if (focusedSessionUuidRef.current !== sessionUuid) return false;
+    focusedSessionUuidRef.current = null;
+    focusedSessionNeedsInjectionRef.current = null;
+    setSelectedSessionUuid((current) =>
+      current === sessionUuid ? null : current,
+    );
+    setMobileDetailOpen(false);
+    return true;
+  }, []);
   // Resolve the selection: explicit pick wins when it's still in the current agent's
   // rows; otherwise null (the right pane shows the select prompt).
   const selectedSession = useMemo(
@@ -580,7 +603,10 @@ export function DaemonChat() {
   // carries only the turn, not the session, so the rollup would otherwise never update live.
   const rolledUpTurnsRef = useRef<Set<string>>(new Set());
 
-  const openUuid = selectedSession?.session.uuid ?? null;
+  // A direct focus target is authoritative even before its row is present in the
+  // current server page. Driving the detail read from the UUID (rather than the
+  // resolved row) is what lets an older active session open immediately.
+  const openUuid = selectedSessionUuid;
 
   // Tell the provider which session is open so it subscribes that transcript
   // channel; clear on close/unmount.
@@ -619,14 +645,52 @@ export function DaemonChat() {
         const res = await authFetch(`/api/daemon-sessions/${openUuid}`);
         if (reqId !== detailReqRef.current) return; // superseded
         if (!res.ok) {
-          setDetailError(true);
+          if (!abandonFocusedSession(openUuid)) {
+            setDetailError(true);
+          }
           return;
         }
         const json = await res.json();
         if (reqId !== detailReqRef.current) return;
         if (json.success) {
           const data = json.data as SessionDetailView;
           setDetail(data);
+          if (focusedSessionUuidRef.current === openUuid) {
+            focusedSessionUuidRef.current = null;
+            const needsInjection =
+              focusedSessionNeedsInjectionRef.current === openUuid;
+            focusedSessionNeedsInjectionRef.current = null;
+            const session = data.session;
+            const originOnline = connectionsRef.current.some(
+              (connection) =>
+                connection.uuid === session.originConnectionUuid &&
+                connection.effectiveStatus === "online",
+            );
+            // Preserve bounded server pagination: add only the explicitly-focused
+            // row instead of walking older pages or restoring an all-history read.
+            if (needsInjection) {
+              setSessions((current) =>
+                mergeSessionsById(
+                  [
+                    {
+                      uuid: session.uuid,
+                      agentUuid: session.agentUuid,
+                      sessionId: session.sessionId,
+                      directIdeaUuid: session.directIdeaUuid,
+                      originConnectionUuid: session.originConnectionUuid,
+                      status: session.status,
+                      title: session.title,
+                      lastTurnAt: session.lastTurnAt,
+                      originOnline,
+                      firstInstruction: null,
+                      ideaTitle: null,
+                    },
+                  ],
+                  current,
+                ),
+              );
+            }
+          }
           // The server rollup on `data.session` already accounts for every terminal turn
           // that existed at fetch time — record their uuids so a live terminal event for
           // one of them can't double-count into the local header total (daemon-token-usage).
@@ -649,17 +713,21 @@ export function DaemonChat() {
               : null,
           );
         } else {
-          setDetailError(true);
+          if (!abandonFocusedSession(openUuid)) {
+            setDetailError(true);
+          }
         }
       } catch (error) {
         if (reqId !== detailReqRef.current) return;
         clientLo
```

---

### Incident Patch 15: `43efd1c5` (2026-09-16)
**Commit Message**: fix: simplify daemon chat status metadata (#567)

**File**: `openspec/changes/archive/2026-09-16-simplify-daemon-chat-status-metadata/.openspec.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+schema: spec-driven
+created: 2026-09-16
```

**File**: `openspec/changes/archive/2026-09-16-simplify-daemon-chat-status-metadata/README.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# simplify-daemon-chat-status-metadata
+
+Remove the redundant active badge and relative daemon start-time row from every Agent Daemon chat transcript header.
```

**File**: `openspec/changes/archive/2026-09-16-simplify-daemon-chat-status-metadata/design.md` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+## Context
+
+`TranscriptView` currently renders a secondary badge for both session lifecycle states: “Active” for a normal conversation and “Ended” for a terminal one. A running turn is already represented independently by a pulse and live elapsed timer, so “Active” contributes little information. The same component’s collapsible connection card renders identity, uptime, host, and a relative process start time derived from `DaemonConnection.startedAt`.
+
+The requested change applies to every Agent Daemon conversation, including idea-anchored and ad-hoc sessions and both active and historical views. Other connection and execution surfaces are outside scope.
+
+## Goals / Non-Goals
+
+**Goals:**
+
+- Omit the redundant “Active” lifecycle badge from active transcript headers.
+- Preserve the “Ended” badge because it communicates a distinct terminal state.
+- Omit only the relative process-start row from the transcript connection disclosure.
+- Preserve all useful live-running, token, identity, uptime, host, control, and transcript behavior.
+- Add focused regression coverage for active, ended, and connection-disclosure states.
+- Keep the canonical Agent Daemon chat representation in `docs/design.pen` synchronized with the shipped interface.
+
+**Non-Goals:**
+
+- Removing `startedAt` from the API, persistence model, or other connection views.
+- Removing or renaming localization keys that may remain useful to other surfaces.
+- Changing the running pulse, elapsed runtime, session status semantics, or connection-details layout beyond natural grid reflow.
+- Redesigning the Agent Daemon chat.
+
+## Decisions
+
+### Render the lifecycle badge only for ended sessions
+
+`TranscriptView` will keep the existing `sessionEnded` derivation but conditionally mount the badge only when it is true. This directly removes “Active” without conflating session lifecycle with the current turn’s execution status. The existing running indicator remains the authoritative live-work signal.
+
+An alternative was to remove the lifecycle badge for both active and ended sessions. That would discard useful historical context and conflict with the requirement that other status behavior remain unchanged.
+
+### Remove the start-time field at the transcript presentation boundary
+
+The `DetailField` for `displayConnection.startedAt` and the now-unused relative-time formatter will be removed from `TranscriptView`. The underlying connection projection retains `startedAt`, allowing other observability surfaces to continue using it. The existing two-column grid naturally reflows the retained uptime and host fields, so no placeholder or replacement spacing is needed.
+
+An alternative was to hide the text while preserving its row. That would leave unexplained whitespace and would not satisfy the requested compact layout.
+
+### Exercise the real transcript component in focused tests
+
+Regression tests will render `TranscriptView` with real English translations and representative active, ended, and connected session fixtures. Assertions will prove that “Active” and “Started” are absent while “Ended”, uptime, host, and the connection-details trigger remain available.
+
+### Update the encrypted design source through Pencil
+
+The Agent Daemon chat screen in `docs/design.pen` will be located, edited, and visually verified through the Pencil MCP tools. The update will remove the active badge and the relative start-time row while preserving the existing visual system and the remaining connection details. The encrypted file will not be read or written through filesystem tools.
+
+## Risks / Trade-offs
+
+- **Risk: “Active” may be confused with the running indicator during implementation.** → Assert that only the lifecycle badge disappears and leave the running pulse/timer path unchanged.
+- **Risk: a broad cleanup could remove start-time data from other connection surfaces.** → Limit code changes to `TranscriptView`; retain service types and translation keys.
+- **Risk: the canonical design source could drift from the implementation.** → Update and screenshot-verify the matching `docs/design.pen` screen in the same task.
+- **Trade-off: an active-but-idle conversation has no lifecycle badge.** → This is intentional; its presence in the selected conversation view already establishes that it is available, while ended conversations retain an explicit terminal marker.
+
+## Migration Plan
+
+No data migration or rollout sequencing is required. Deploy as a frontend-only change. Rollback restores the active badge branch and the connection disclosure’s start-time `DetailField`.
+
+## Open Questions
+
+None.
```

**File**: `openspec/changes/archive/2026-09-16-simplify-daemon-chat-status-metadata/proposal.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+## Why
+
+The Agent Daemon transcript header repeats an “Active” session badge beside the more useful live running indicator, while the connection disclosure exposes a relative process start time that adds noise without helping users control or identify the conversation. Removing those two elements makes the chat header easier to scan while preserving actionable state.
+
+## What Changes
+
+- Remove the “Active” badge from the transcript header for every active Agent Daemon conversation.
+- Keep the existing “Ended” badge for ended conversations and retain the running pulse, elapsed runtime, token usage, copy-session action, and connection-details trigger.
+- Remove the relative “Started” row from the expanded connection details and let the remaining fields close the gap naturally.
+- Preserve the connection identity, uptime (when online), host, controls, transcript behavior, and all backend data contracts.
+
+## Capabilities
+
+### New Capabilities
+
+None.
+
+### Modified Capabilities
+
+- `daemon-session-transcript-read`: Simplify the transcript header and connection disclosure without weakening live execution state or connection identity.
+
+## Impact
+
+- Frontend: `src/components/agent-presence/chat/transcript-view.tsx`.
+- Tests: focused `TranscriptView` header/disclosure assertions in the existing agent-presence test suite.
+- Design source: update `docs/design.pen` through Pencil so the canonical Agent Daemon chat screen matches the simplified header and connection disclosure.
+- No API, database, daemon runtime, permission, dependency, or migration changes.
```

**File**: `openspec/changes/archive/2026-09-16-simplify-daemon-chat-status-metadata/specs/daemon-session-transcript-read/spec.md` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+## ADDED Requirements
+
+### Requirement: The daemon transcript header SHALL omit redundant lifecycle metadata
+
+The Agent Daemon transcript header SHALL NOT render an “Active” lifecycle badge for an active conversation. It SHALL retain an explicit “Ended” badge for an ended conversation and SHALL preserve the independent running indicator and live elapsed runtime whenever the current turn is running.
+
+The expanded connection-details disclosure SHALL NOT render the connection process start time or its relative “Started” value. It SHALL retain connection identity, online uptime, host, and all existing actions, and the retained fields SHALL reflow without an empty placeholder.
+
+These presentation rules SHALL apply to every Agent Daemon transcript regardless of whether the session is idea-anchored or ad-hoc. They SHALL NOT remove `startedAt` from the connection data contract or change other connection-observability surfaces.
+
+#### Scenario: Active conversation omits the lifecycle badge
+
+- **WHEN** an active Agent Daemon conversation transcript renders
+- **THEN** the header MUST NOT show the “Active” lifecycle badge
+- **AND** the running indicator and elapsed runtime MUST still appear when the current turn is running
+
+#### Scenario: Ended conversation retains terminal status
+
+- **WHEN** an ended Agent Daemon conversation transcript renders
+- **THEN** the header MUST show the existing “Ended” badge
+
+#### Scenario: Connection disclosure omits relative start time
+
+- **WHEN** the user expands connection details for a connection with a non-null `startedAt`
+- **THEN** the disclosure MUST NOT show a “Started” field or relative process-start value
+- **AND** connection identity, uptime when online, and host MUST remain visible without an empty reserved row
+
+#### Scenario: Presentation scope does not alter the connection contract
+
+- **WHEN** this header simplification is implemented
+- **THEN** the connection API and frontend connection type MUST retain `startedAt`
+- **AND** connection views outside the Agent Daemon transcript MUST remain unchanged
```

**File**: `openspec/changes/archive/2026-09-16-simplify-daemon-chat-status-metadata/tasks.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+## 1. Agent Daemon transcript metadata
+
+- [x] 1.1 Update `TranscriptView` so active conversations omit the lifecycle badge, ended conversations retain their badge, and expanded connection details omit only the relative process-start field.
+- [x] 1.2 Add focused component tests covering active and ended headers plus retained connection identity, uptime, host, and the absence of the “Started” row.
+- [x] 1.3 Update the matching Agent Daemon chat screen in `docs/design.pen` through Pencil and visually verify that it reflects the simplified status metadata in both the header and connection disclosure.
+- [x] 1.4 Run the focused agent-presence tests, lint the touched source/test files, the Impeccable detector, and OpenSpec validation.
```

**File**: `openspec/specs/daemon-session-transcript-read/spec.md` (modified, +31/-0)
```diff
@@ -428,3 +428,34 @@ The daemon conversation-list row's live status indicator (running / interrupted
 - **GIVEN** a conversation whose origin slice has no match but whose matching execution on another connection is `interrupted` with reason `user`
 - **WHEN** the conversation list renders that row
 - **THEN** the row's status indicator MUST read `interrupted` (resumable); a crash-interrupt MUST read `error`
+
+### Requirement: The daemon transcript header SHALL omit redundant lifecycle metadata
+
+The Agent Daemon transcript header SHALL NOT render an “Active” lifecycle badge for an active conversation. It SHALL retain an explicit “Ended” badge for an ended conversation and SHALL preserve the independent running indicator and live elapsed runtime whenever the current turn is running.
+
+The expanded connection-details disclosure SHALL NOT render the connection process start time or its relative “Started” value. It SHALL retain connection identity, online uptime, host, and all existing actions, and the retained fields SHALL reflow without an empty placeholder.
+
+These presentation rules SHALL apply to every Agent Daemon transcript regardless of whether the session is idea-anchored or ad-hoc. They SHALL NOT remove `startedAt` from the connection data contract or change other connection-observability surfaces.
+
+#### Scenario: Active conversation omits the lifecycle badge
+
+- **WHEN** an active Agent Daemon conversation transcript renders
+- **THEN** the header MUST NOT show the “Active” lifecycle badge
+- **AND** the running indicator and elapsed runtime MUST still appear when the current turn is running
+
+#### Scenario: Ended conversation retains terminal status
+
+- **WHEN** an ended Agent Daemon conversation transcript renders
+- **THEN** the header MUST show the existing “Ended” badge
+
+#### Scenario: Connection disclosure omits relative start time
+
+- **WHEN** the user expands connection details for a connection with a non-null `startedAt`
+- **THEN** the disclosure MUST NOT show a “Started” field or relative process-start value
+- **AND** connection identity, uptime when online, and host MUST remain visible without an empty reserved row
+
+#### Scenario: Presentation scope does not alter the connection contract
+
+- **WHEN** this header simplification is implemented
+- **THEN** the connection API and frontend connection type MUST retain `startedAt`
+- **AND** connection views outside the Agent Daemon transcript MUST remain unchanged
```

**File**: `src/components/agent-presence/__tests__/copy-session-id-button.test.tsx` (modified, +120/-1)
```diff
@@ -73,7 +73,14 @@ import {
   CopySessionIdButton,
   TranscriptView,
 } from "@/components/agent-presence/chat/transcript-view";
-import type { SessionView } from "@/services/daemon-session.service";
+import type {
+  SessionView,
+  TurnWithMessagesView,
+} from "@/services/daemon-session.service";
+import type {
+  ConnectionView,
+  ExecutionView,
+} from "@/components/agent-presence/types";
 
 const NOW = "2026-06-22T03:00:00.000Z";
 
@@ -128,6 +135,68 @@ function transcriptProps(session: SessionView | null) {
   };
 }
 
+function connectionView(
+  overrides: Partial<ConnectionView> = {},
+): ConnectionView {
+  return {
+    uuid: "conn-1",
+    agentUuid: "agent-1",
+    ownerUuid: "owner-1",
+    agentName: "Alpha",
+    clientType: "claude_code",
+    clientVersion: "1.0.0",
+    host: "host-a",
+    cwd: "/work/ai-pm",
+    startedAt: "2026-06-22T01:00:00.000Z",
+    status: "online",
+    effectiveStatus: "online",
+    connectedAt: NOW,
+    lastSeenAt: NOW,
+    disconnectedAt: null,
+    ...overrides,
+  };
+}
+
+function runningTurn(): TurnWithMessagesView {
+  return {
+    uuid: "turn-1",
+    sessionUuid: "sess-1",
+    backendSessionId: null,
+    seq: 1,
+    trigger: "instruction",
+    promptText: null,
+    status: "running",
+    interruptedReason: null,
+    relayError: null,
+    usage: null,
+    executionUuid: null,
+    startedAt: NOW,
+    endedAt: null,
+    createdAt: NOW,
+    messages: [],
+  };
+}
+
+function runningExecution(): ExecutionView {
+  return {
+    uuid: "exec-1",
+    agentUuid: "agent-1",
+    connectionUuid: "conn-1",
+    entityType: "daemon_session",
+    entityUuid: "sess-1",
+    rootIdeaUuid: null,
+    directIdeaUuid: null,
+    status: "running",
+    interruptedReason: null,
+    startedAt: NOW,
+    createdAt: NOW,
+    updatedAt: NOW,
+    entityTitle: "Refactor auth",
+    projectUuid: null,
+    rootIdeaTitle: null,
+  };
+}
+
 beforeEach(() => {
   vi.clearAllMocks();
   // jsdom doesn't implement scrollIntoView; TranscriptView's auto-scroll effect
@@ -388,3 +457,53 @@ describe("TranscriptView header — conversation token total (daemon-token-usage
     expect(screen.queryByText(/Cache/i)).toBeNull();
   });
 });
+
+describe("TranscriptView header — streamlined status metadata", () => {
+  it("omits the active lifecycle badge while preserving running pulse and elapsed runtime", () => {
+    vi.useFakeTimers();
+    vi.setSystemTime("2026-06-22T03:02:00.000Z");
+    const session = sessionView({ status: "active" });
+
+    render(
+      <TranscriptView
+        {...transcriptProps(session)}
+        turns={[runningTurn()]}
+        sessionExecutions={[runningExecution()]}
+      />,
+    );
+
+    expect(screen.queryByText("Active")).toBeNull();
+    expect(screen.getAllByText("Running").length).toBeGreaterThan(0);
+    expect(
+      screen.getByTitle("Elapsed since this run started").textContent,
+    ).toBe("00:02:00");
+  });
+
+  it("retains the ended lifecycle badge", () => {
+    const session = sessionView({ status: "ended" });
+    render(<TranscriptView {...transcriptProps(session)} />);
+
+    expect(screen.getByText("Ended")).toBeTruthy();
+    expect(screen.queryByText("Active")).toBeNull();
+  });
+
+  it("omits started metadata while retaining identity, uptime, and host details", () => {
+    const session = sessionView({ status: "active" });
+    render(
+      <TranscriptView
+        {...transcriptProps(session)}
+        originConnection={connectionView()}
+        originOnline
+      />,
+    );
+
+    fireEvent.click(screen.getByText("Connection details"));
+
+    expect(screen.getByText("Alpha")).toBeTruthy();
+    expect(screen.getByText("Uptime")).toBeTruthy();
+    expect(screen.getByText("Host")).toBeTruthy();
+    expect(screen.getAllByText("host-a").length).toBeGreaterThan(0);
+    expect(screen.queryByText("Started")).toBeNull();
+    expect(screen.queryByText("2 hours ago")).toBeNull();
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #602** (2026-10-06): fix: protect Claude daemon background agents from silent termination (@ChenNima)
- **PR #601** (2026-10-05): fix(deps): resolve root critical/high dependency vulnerabilities + CI audit gate (@ChenNima)
- **PR #600** (2026-10-04): chore: release v0.21.1 (@ChenNima)
- **PR #599** (2026-10-04): feat: safely restart Codex App Server after configuration (@ChenNima)
- **PR #598** (2026-10-04): fix(pi): prefer native MCP and retain legacy compatibility (@ChenNima)
- **PR #597** (2026-10-04): fix: match Pi/dsh workflow tools and support Pi 1 native MCP (@ChenNima)
- **PR #596** (2026-10-03): chore: release v0.21.0 (@ChenNima)
- **PR #595** (2026-10-03): feat: show daemon agent failures in chat (@ChenNima)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
