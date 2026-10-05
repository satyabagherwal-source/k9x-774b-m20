# Forensic Learning Record (Deep Inspection): xiaobright/dsh-anchored-standard

> **Canonical Artifact**: `07_PROJECT_LEARNING/xiaobright-dsh-anchored-standard-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:44:40.858Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xiaobright/dsh-anchored-standard`
- **Description**: Two-phase DeepSeek Harness preset: Minimal-aligned bootstrap, then full Standard tools (Project2 98/99)
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3783 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `combo-anchored/compaction-epoch.mjs`
```
/**
 * Epoch-aware promotion tracker shared by the bootstrap and baseline-gate
 * plugins of the anchored presets.
 *
 * A compaction rewrites the model-visible surface: the pre-compaction
 * conversation collapses into one synthetic summary message, and the
 * workspace-instruction baseline is re-injected from scratch. The first
 * post-compaction request is therefore a "second first request" — the same
 * first-token conditions the anchored presets exist to control. Promotion is
 * epoch-aware: only a durable promotion signal (`tool/call` and/or
 * `assistant/message`, per the caller's `promoteEvents`) recorded AFTER the
 * last `compaction/end` boundary counts as promoted. Before any compaction
 * the boundary is -1, which preserves the original one-shot semantics.
 *
 * State is memoized per session id and maintained incrementally through
 * `observe()`; a cold session scans its durable log once (so resume and
 * reload reconstruct the same phase), then O(1).
 *
 * By default subagents (`delegationDepth > 0`) are treated as already
 * promoted so their first request can use tools. Set `includeSubagents: true`
 * to make subagents follow the same bootstrap/anchor phase as top-level
 * sessions.
 */

/** Build one epoch-aware promotion tracker. */
export function createEpochPromotion(promoteEvents, options = {}) {
  const includeSubagents = options.includeSubagents === true
  const promote = new Set(promoteEvents)
  /** sessionId -> { boundary, promoted } */
  const state = new Map()

  /** Scan a session's durable log from scratch (cold start / resume). */
  const scan = (session) => {
    let boundary = -1
    let promoted = false
    for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
      const seq = event.seq ?? 0 // events without a seq are treated as post-boundary
      if (event.type === 'compaction/end') {
        boundary = seq
        promoted = false
        continue
      }
      if (promote.has(event.type) && seq > boundary) promoted = true
    }
    const entry = { boundary, promoted }
    state.set(session.id, entry)
    return entry
  }

  return {
    /**
     * Current phase of the agent's session.
     * @param agent - the assembly/pre-step agent, or undefined outside an agent.
     * @returns { boundary, promoted } — `boundary` is the last compaction/end
     *   seq (-1 before any compaction); `promoted` is true when a durable
     *   promotion signal exists after that boundary.
     */
    status(agent) {
      if (agent === undefined) return { boundary: -1, promoted: true }
      const session = agent.session
      if (session === undefined) return { boundary: -1, promoted: true }
      // By default subagents keep the full catalog from their very first
      // request; includeSubagents makes them follow the normal bootstrap phase.
      if (!includeSubagents && (session.header?.delegationDepth ?? 0) > 0) return { boundary: -1, promoted: true }
      return state.get(session.id) ?? scan(session)
    },
    /** Incremental feed: call on every `session/event`. */
    observe(session, event) {
      const entry = state.get(session.id)
      if (entry === undefined) return
      const seq = event.seq ?? 0
      if (event.type === 'compaction/end') {
        state.set(session.id, { boundary: seq, promoted: false })
        return
      }
      if (promote.has(event.type) && seq > entry.boundary && !entry.promoted) {
        state.set(session.id, { ...entry, promoted: true })
      }
    },
  }
}

```

### Core Architecture Module: `combo-anchored/cot-drip.mjs`
```
/**
 * cot-drip — deliberation maintenance for the EXECUTE phase.
 *
 * The anchor modes (and the think/execute split) open each turn with deep
 * reasoning, but deliberation decays across a long tool loop: once the model
 * is mid-execution, later steps collapse back to thin "Let me…" actions. This plugin drips ONE short user-role
 * reminder into the conversation after every Nth tool result — never
 * blocking, never erroring, never touching the tool catalog:
 *
 *   `tools/post-execute` → { kind: 'accept', additionalContexts: [notice] }
 *
 * The harness appends `additionalContexts` as durable user messages AFTER
 * all tool results of the batch, so the reminder lands in the NEXT request
 * exactly where a planning beat belongs — the same delivery shape Code Mode
 * uses for nested sub-call contexts. The model reads it, restates the goal
 * in one "We …" sentence, and continues; the user sees ordinary tool calls
 * plus a one-line context chip.
 *
 * Cadence is deliberately gentle: default `every: 4` results, at most
 * `maxPerTurn: 1` reminder per turn. `every: 0` disables the drip.
 *
 * Robustness: subagents default to undripped; counters reset per turn
 * (turn boundaries tracked from durable events, with a session-global
 * fallback if turn numbers are unavailable); any failure keeps the decision
 * from `next()` untouched.
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'cot-drip'

/**
 * Deliberately NO inject list: the listener only touches services at event
 * time and nothing needs to exist before `apply`.
 */
export const inject = []

/** Default reminder text — one planning beat, phrased to sustain the "We" voice. */
export const DRIP_TEXT = [
  'Progress check: before the next action, restate in one "We …" sentence what remains of the goal and why the next step is the right one.',
].join(' ')

function parseCounter(value, field, fallback, minimum) {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < minimum) {
    throw new TypeError(`${name}: ${field} must be an integer >= ${minimum}; got ${JSON.stringify(value)}`)
  }
  return value
}

/** Register the post-execution deliberation drip. */
export function apply(ctx, config) {
  const every = parseCounter(config?.every, 'every', 4, 0)
  const maxPerTurn = parseCounter(config?.maxPerTurn, 'maxPerTurn', 1, 1)
  const includeSubagents = config?.includeSubagents === true
  const text = typeof config?.text === 'string' && config.text.length > 0 ? config.text : DRIP_TEXT

  /** sessionId -> { results, drips, lastTurn } — per-turn counters. */
  const state = new Map()

  const countersOf = (sessionId) => {
    let entry = state.get(sessionId)
    if (entry === undefined) {
      entry = { results: 0, drips: 0, lastTurn: undefined }
      state.set(sessionId, entry)
    }
    return entry
  }

  let warned = false
  const warnOnce = (message) => {
    if (warned) return
    warned = true
    try {
      ctx.logger.warn(message)
    } catch {
      // Logger unavailable — the guard exists only to avoid spamming.
    }
  }

  // Turn tracking: reset the counters on turn/start, remember the newest
  // turn from assistant/chunk when start events carry no usable number.
  ctx.on('session/event', (session, event) => {
    if (session === undefined || session.id === undefined) return
    if (event.type === 'turn/start') {
      const turn = event.data?.turn
      const entry = countersOf(session.id)
      if (entry.lastTurn !== turn) {
        entry.lastTurn = typeof turn === 'number' ? turn : entry.lastTurn
        entry.results = 0
        entry.drips = 0
      }
      return
    }
    if (event.type === 'assistant/chunk') {
      const turn = event.data?.turn
      if (typeof turn !== 'number') return
      const entry = countersOf(session.id)
      if (entry.lastTurn === undefined || turn > entry.lastTurn) {
        // A chunk of a newer turn without a seen turn/start: reset there.
        entry.lastTurn = turn
        entry.results = 0
        entry.drips = 0
      }
    }
  })

  ctx.on('tools/post-execute', async (exec, result, next) => {
    // Count synchronously before awaiting, so parallel calls cannot race
    // past the cadence.
    const session = exec?.agent?.session
    const eligible = session !== undefined
      && session.id !== undefined
      && (includeSubagents || (session.header?.delegationDepth ?? 0) === 0)
    const entry = eligible ? countersOf(session.id) : undefined
    if (entry !== undefined) entry.results += 1
    const due = entry !== undefined
      && every > 0
      && entry.results % every === 0
      && entry.drips < maxPerTurn

    const decision = await next()
    try {
      if (!due || decision?.kind !== 'accept') return decision
      entry.drips += 1
      const notice = {
        id: `cot-drip-${crypto.randomUUID()}`,
        role: 'user',
        content: [{ type: 'text', text }],
        source: {
          kind: 'plugin',
          plugin: name,
          form: 'notice',
          summary: 'deliberation maintenance beat',
        },
      }
      return {
        ...decision,
        additionalContexts: [...(decision.additionalContexts ?? []), notice],
      }
    } catch (error) {
      warnOnce(`${name}: drip injection failed, keeping the plain result: ${String((error && error.message) || error)}`)
      return decision
    }
  })
}

```

### Core Architecture Module: `combo-anchored/custom-bash.mjs`
```
/**
 * custom-bash — a Windows-capable `bash` tool that registers under the SAME
 * name (`bash`) as the official persistent bash, with a Minimal-compatible
 * description, but executes through `ctx.subprocess.spawn` instead of a PTY.
 *
 * WHY: DeepSeek's first-request trajectory anchor keys on the tool SCHEMA
 * matching the RL training distribution (issue #11: persistent
 * bash + str_replace_editor anchored 5/5 at maxTokens=256000, pwsh/read
 * 8/8 standard-like). The official persistent bash uses a PTY, and DSH's PTY
 * backend is linux/darwin-only — `subprocess-local` throws "terminal
 * inspection is unsupported on platform win32". A custom tool that presents
 * the same name and a Minimal-like description but spawns Git Bash through
 * the ordinary (cross-platform) subprocess seam keeps the schema anchor
 * without the PTY dependency.
 *
 * Executable resolution (config `bashPath`, issue #24 — no hardcoded install
 * path): an explicit non-empty `bashPath` wins unconditionally. Unset, the
 * Git Bash executable is INFERRED, in probe order:
 *  1. the `git` executable on PATH — its install root carries `bin\bash.exe`
 *     one level up from `cmd\`, beside `bin\`, or two levels up from
 *     `mingw64\bin\` (the standard installer, choco, and winget all resolve
 *     here; a scoop SHIM does not — its directory is the shims root, not the
 *     app — which is what step 2 covers);
 *  2. the well-known Git-for-Windows roots derived from environment variables
 *     (`ProgramFiles`, `ProgramFiles(x86)`, per-user `LOCALAPPDATA\Programs
 *     \Git`, scoop's `~\scoop\apps\git\current` junction);
 *  3. plain `bash` through `ctx.subprocess.resolveExecutable` (PATH lookup —
 *     last resort, since on Windows that may pick the WSL shim; WSL bash is
 *     still true bash, only the filesystem paths shift to /mnt/…).
 *
 * If NOTHING resolves, the tool fails with an actionable error naming the
 * remedies — it does NOT silently execute under a different shell: the
 * schema above promises `bash -c` semantics, and pwsh/cmd are different
 * command languages. PowerShell stays available as its OWN tool (`pwsh`,
 * present in the promoted catalog on Windows, unlockable via
 * dev_tool_search).
 *
 * Semantics mirror the official bash tool: `bash -c <command>` in a fresh
 * process, bounded output, non-zero exit reported not thrown. No sandbox
 * confinement on Windows (the sandbox backend is linux-only); the tool
 * description says so. The bootstrap catalog pairs this with
 * `str_replace_editor` (Minimal's two tools).
 */

import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'custom-bash'

/** The subprocess and tools services must exist before this tool can register. */
export const inject = ['subprocess', 'tools']

const DEFAULT_TIMEOUT_MS = 120000
const DEFAULT_MAX_OUTPUT_BYTES = 64000

/**
 * Git Bash candidate paths, in probe order (see the header): the `git`
 * executable's install root first, then the well-known env-derived roots.
 * Exported for tests; pure — existence probing happens at the call site.
 */
export function bashCandidates(env, gitExe) {
  const candidates = []
  // git at <root>\cmd\git.exe (installer/scoop) or <root>\bin\git.exe →
  // <root>\bin\bash.exe; <root>\mingw64\bin\git.exe (portable) → two up.
  // A bare relative name means `git` did not actually resolve to a path.
  if (typeof gitExe === 'string' && /[/\\]/.test(gitExe)) {
    const dir = dirname(gitExe)
    const root = dirname(dir)
    candidates.push(
      join(root, 'bin', 'bash.exe'),
      join(dir, 'bash.exe'),
      join(dirname(root), 'bin', 'bash.exe'),
    )
  }
  if (env.ProgramFiles) candidates.push(join(env.ProgramFiles, 'Git', 'bin', 'bash.exe'))
  if (env['ProgramFiles(x86)']) candidates.push(join(env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe'))
  if (env.LOCALAPPDATA) candidates.push(join(env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'))
  if (env.USERPROFILE) candidates.push(join(env.USERPROFILE, 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'))
  // Layouts overlap (a `bin` git.exe derives the same bash twice) — probe
  // order survives the dedupe, insertion order is preserved.
  return [...new Set(candidates)]
}

/**
 * Git Bash / MSYS drive path (`/e/foo`) → Windows path (`E:\foo`).
 * Unix paths like `/usr/bin` or `/tmp` are left unchanged. Exported for tests.
 */
export function normalizeGitBashWorkdir(workdir, platform = process.platform) {
  if (typeof workdir !== 'string' || workdir.length === 0) return workdir
  if (platform !== 'win32') return workdir
  const match = workdir.match(/^\/([a-zA-Z])(?:\/(.*))?$/)
  if (!match) return workdir
  const rest = match[2] ? match[2].replace(/\//g, '\\') : ''
  return rest ? `${match[1].toUpperCase()}:\\${rest}` : `${match[1].toUpperCase()}:\\`
}

function isWorkdirEnoent(error) {
  return /\bENOENT\b/.test(String((error && error.message) || error || ''))
}

/** Tool parameter schema for the model-facing command. */
const commandSchema = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description: 'The bash command to execute (`bash -c` string domain).',
    },
    workdir: {
      type: 'string',
      description: 'Optional working directory; defaults to the session cwd. On Windows, Git Bash paths like /e/foo are accepted and converted to E:\\foo.',
    },
  },
  required: ['command'],
  additionalProperties: false,
}

/** Register the model-facing `bash` tool. */
export function apply(ctx, config) {
  const explicitBashPath = typeof config?.bashPath === 'string' && config.bashPath.length > 0 ? config.bashPath : undefined
  const timeoutMs = Number.isSafeInteger(config?.timeoutMs) && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS
  const maxOutputBytes = Number.isSafeInteger(config?.maxOutputBytes) && config.maxOutputBytes > 0 ? config.maxOutputBytes : DEFAULT_MAX_OUTPUT_BYTES

  // The inferred executable is memoized per plugin instance: candidate probing
  // walks the filesystem, and the answer cannot change within a mount. A
  // failed inference is NOT memoized — the plain `bash` fallback resolves
  // fresh on every execute until some probe succeeds.
  let inferredShell
  const exists = (path) => access(path).then(() => true, () => false)
  const resolveShell = async (signal) => {
    if (explicitBashPath !== undefined) {
      // A misconfigured explicit path must fail as itself, not as a
      // discovery miss — the raw resolution error says which path failed.
      return ctx.subprocess.resolveExecutable(explicitBashPath, undefined, signal)
    }
    if (inferredShell !== undefined) {
      return ctx.subprocess.resolveExecutable(inferredShell, undefined, signal)
    }
    let gitExe
    try {
      gitExe = await ctx.subprocess.resolveExecutable('git', undefined, signal)
    } catch {
      // git unresolvable → the env-derived candidates below still apply
    }
    for (const candidate of bashCandidates(process.env, gitExe)) {
      if (!(await exists(candidate))) continue
      try {
        inferredShell = await ctx.subprocess.resolveExecutable(candidate, undefined, signal)
        return inferredShell
      } catch {
        // Exists but unresolvable (EPERM, a broken scoop junction): keep
        // probing — one bad root must not block the rest of the chain, and
        // nothing is memoized so later executes can still find a good one.
        continue
      }
    }
    try {
      return await ctx.subprocess.resolveExecutable('bash', undefined, signal)
    } catch (error) {
      // Total discovery failure (no Git Bash root, no env root, no bash on
      // PATH): name the remedies instead of leaking a raw ENOENT. Never
      // fall back to pwsh/cmd here — the schema promises `bash -c`
      // semantics; a different shell would silently break every command.
      throw new Error(`bash executable not found — ins
```

### Core Architecture Module: `combo-anchored/deliberation-gate.mjs`
```
/**
 * Deliberation gate — the full Standard catalog stays visible and callable
 * (the session looks and feels completely normal), but the FIRST tool call
 * of a turn is denied with an anchor directive when the turn has not yet
 * shown enough reasoning.
 *
 * This is the engine behind `deliberation-gate` — a trajectory-depth gate
 * built on the observable layer (the harness adapters expose no logprobs):
 * durable `assistant/chunk` events carry every reasoning/text delta of the
 * live trajectory, and their accumulated length per turn is a cheap, robust
 * deliberation-depth proxy for the collapse a callable catalog causes —
 * pre-action reasoning shrinks to a fraction of its no-tools depth. When
 * the proxy says "shallow", the gate denies once with a planning directive
 * (a push-back while tools stay live — the intervention shape that both
 * prompts deeper reasoning and keeps tool calls working); the retry then
 * carries the forced deliberation in-history.
 *
 * Behavior:
 *  - `session/event` accumulates `text-delta`/`reasoning-delta` lengths per
 *    (session, turn) from `assistant/chunk` records (the durable log keeps
 *    every chunk; wire telemetry drops most of them). Tool-call deltas carry
 *    no `.text` but still open the turn's entry, so the counter is live by
 *    the time a call dispatches.
 *  - A resumed session (no in-process chunk state) is cold-scanned from its
 *    durable log on first dispatch, so restarts keep the same depth.
 *  - `tools/pre-execute` checks the CURRENT turn's accumulated depth before
 *    dispatch: at or above `minChars` (default 400, tunable) the call
 *    proceeds untouched; below it, the call is denied
 *    with `gateText` (a planning prompt, phrased so it never reads as a tool
 *    failure) at most `maxGatesPerTurn` times (default 1) — the retry then
 *    carries the forced deliberation in-history.
 *  - A turn with no streamed text at all reads as depth zero and gates
 *    exactly once — failing safe toward MORE deliberation, never silence.
 *
 * Robustness:
 *  - The gate decision is fully synchronous up to the deny (no `await`
 *    before the counters mutate), so parallel tool calls cannot race past
 *    the budget.
 *  - Subagents default to ungated (their briefs are already plans); set
 *    `includeSubagents: true` to gate them too.
 *  - Executions without an agent (service-owned calls) pass untouched.
 *  - Per-session turn maps are pruned to the last few turns, so long
 *    sessions do not accumulate state.
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'deliberation-gate'

/**
 * Deliberately NO inject list: the listeners only touch services at event
 * time and nothing needs to exist before `apply`.
 */
export const inject = []

/** Default deliberation floor before the first tool call of a turn (chars). */
export const DEFAULT_MIN_CHARS = 400

/** Default directive denied back to the model on a gated call. */
export const GATE_TEXT = [
  'Deliberation gate: this turn has not shown its reasoning yet.',
  'Before retrying this tool call, write out your full reasoning in your reply — start with "We", restate the goal, weigh the approaches, and lay out the concrete steps and risks — then issue the tool call again.',
  'This message is a planning prompt, not a tool failure.',
].join(' ')

/** Keep at most this many recent turns of depth state per session. */
const MAX_TRACKED_TURNS = 8

function parseCounter(value, field, fallback, minimum) {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < minimum) {
    throw new TypeError(`${name}: ${field} must be an integer >= ${minimum}; got ${JSON.stringify(value)}`)
  }
  return value
}

/** Register the trajectory-depth gate. */
export function apply(ctx, config) {
  const minChars = parseCounter(config?.minChars, 'minChars', DEFAULT_MIN_CHARS, 0)
  const maxGatesPerTurn = parseCounter(config?.maxGatesPerTurn, 'maxGatesPerTurn', 1, 1)
  const includeSubagents = config?.includeSubagents === true
  const gateText = typeof config?.gateText === 'string' && config.gateText.length > 0 ? config.gateText : GATE_TEXT

  /** sessionId -> { turns: Map<turn, { chars, gates }>, lastTurn } */
  const state = new Map()

  /** Live feed path: create/extend the turn entry on every streamed chunk. */
  const observeChunk = (sessionId, turn, textLength) => {
    let entry = state.get(sessionId)
    if (entry === undefined) {
      entry = { turns: new Map(), lastTurn: turn }
      state.set(sessionId, entry)
    }
    let turnEntry = entry.turns.get(turn)
    if (turnEntry === undefined) {
      // Prune old turns so long sessions do not accumulate state.
      if (entry.turns.size >= MAX_TRACKED_TURNS) {
        const oldest = [...entry.turns.keys()].sort((a, b) => a - b).slice(0, entry.turns.size - MAX_TRACKED_TURNS + 1)
        for (const key of oldest) entry.turns.delete(key)
      }
      turnEntry = { chars: 0, gates: 0 }
      entry.turns.set(turn, turnEntry)
    }
    turnEntry.chars += textLength
    if (turn > entry.lastTurn) entry.lastTurn = turn
  }

  /**
   * Depth state of a session, cold-scanning its durable log on first sight
   * so a resumed session keeps the depth it streamed before the restart.
   */
  const depthOf = (session) => {
    let entry = state.get(session.id)
    if (entry === undefined) {
      entry = { turns: new Map(), lastTurn: -1 }
      if (Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])))) {
        for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
          if (event.type !== 'assistant/chunk') continue
          const turn = event.data?.turn
          if (typeof turn !== 'number' || !Number.isFinite(turn)) continue
          const text = event.data?.chunk?.text
          observeChunk(session.id, turn, typeof text === 'string' ? text.length : 0)
        }
        entry = state.get(session.id) ?? entry
      }
      if (entry.turns.size === 0) {
        // No streamed text anywhere: depth reads as zero on a sentinel turn,
        // so the session still gets exactly one gated call, then passes.
        entry.turns.set(entry.lastTurn, { chars: 0, gates: 0 })
      }
      state.set(session.id, entry)
    }
    return entry
  }

  // Depth proxy: accumulate the turn's streamed reasoning/text lengths from
  // durable assistant/chunk records.
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'assistant/chunk') return
    const turn = event.data?.turn
    if (typeof turn !== 'number' || !Number.isFinite(turn)) return
    const text = event.data?.chunk?.text
    observeChunk(session.id, turn, typeof text === 'string' ? text.length : 0)
  })

  // The gate: synchronous decision, deny at most maxGatesPerTurn per turn
  // while the accumulated depth of the CURRENT turn sits below minChars.
  ctx.on('tools/pre-execute', (exec, next) => {
    const session = exec?.agent?.session
    if (session === undefined || session.id === undefined) return next()
    if (!includeSubagents && (session.header?.delegationDepth ?? 0) > 0) return next()
    const entry = depthOf(session)
    const turnEntry = entry.turns.get(entry.lastTurn)
    if (turnEntry === undefined) return next()
    if (turnEntry.gates >= maxGatesPerTurn) return next()
    if (turnEntry.chars >= minChars) return next()
    turnEntry.gates += 1
    return { kind: 'deny', reason: gateText }
  })
}

```

### Core Architecture Module: `combo-anchored/dev-tool-search.mjs`
```
/**
 * dev-tool-search — on-demand tool discovery and unlock, the tool-search
 * pattern for the anchored preset.
 *
 * The promoted phase keeps only a minimal resident set (shell +
 * str_replace_editor + the discovery tools) instead of dumping the whole
 * Standard catalog at once. This plugin registers ONE small tool:
 *
 *  - `dev_tool_search` — search the FULL assembled catalog by keyword and
 *    return matching tool names with short descriptions; optionally unlock
 *    tools by exact name (array `toolNames`). Unlocked names are recorded as
 *    durable `tool/call` arguments, and tool-bootstrap.mjs's assemble filter
 *    exposes them from the next request on (resume-safe).
 *
 * The tool description is deliberately an INDEX of what the minimal resident
 * set cannot do: the model should reach for dev_tool_search the moment a task
 * needs internet, delegation, workflows, goals, images, background jobs, or
 * multi-agent coordination — not try to work around them with bash.
 *
 * FIX (local): search matching was AND-over-all-tokens, so a long natural
 * query ("file edit write replace script root permissions") matched NOTHING
 * even against the full catalog. Now: exact name match wins, then tools
 * matching at least one token ranked by hit count. The description also
 * teaches the unlock path explicitly ("search empty ≠ tool absent — unlock
 * by exact toolNames"), because models observed in the wild only search and
 * never pass toolNames.
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dev-tool-search'

/** The tools registry must exist before this tool can register. */
export const inject = ['tools']

const MAX_RESULTS = 25

/** Minimal JSON schema compiler for tool parameters (zero dependencies). */
function toJsonSchema(spec) {
  const properties = {}
  const required = []
  for (const [key, meta] of Object.entries(spec || {})) {
    const prop = { type: meta.type }
    if (meta.description) prop.description = meta.description
    properties[key] = prop
    if (meta.required) required.push(key)
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

/**
 * The capability index: resident minimal tools (bash / str_replace_editor /
 * skill_search / skill_load) cannot cover these, so the model must search
 * and unlock them on demand. Kept in the description so the model KNOWS what
 * exists without a full catalog dump.
 */
const UNLOCKABLE_INDEX = [
  'web_search — internet search and web retrieval',
  'subagent / subagent_fork / list_subagent_models — delegate work to sub-agents and choose their LLM',
  'workflow — run multi-agent workflow scripts',
  'ralph — fresh-agent iterative loop',
  'create_goal / get_goal / update_goal — long-running goals',
  'read_image — read image files',
  'job_list / job_output / job_kill — background jobs',
  'interrupt_agent / send_message / list_agents — multi-agent control',
  'todo_write — task tracking',
  'ask_user_question — ask the user',
]

/** Register the model-facing `dev_tool_search` tool. */
export function apply(ctx) {
  ctx.tools.register({
    name: 'dev_tool_search',
    description: [
      'Discover and unlock tools that are NOT currently available.',
      '',
      'This session starts with a minimal resident set: bash, str_replace_editor, skill_search, skill_load. Everything else is unlocked on demand through this tool.',
      '',
      'If the current task needs any of the following, call dev_tool_search FIRST — do not try to work around them with bash:',
      ...UNLOCKABLE_INDEX.map((line) => `- ${line}`),
      '',
      'Usage: pass `query` to search the catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them. Unlocked tools appear from the next request on and stay unlocked for the session.',
      '',
      'Example: dev_tool_search({"query":"web","toolNames":["web_search"]}) — search AND unlock in one call.',
      'IMPORTANT: an empty search result does NOT mean the tool does not exist — it only means no tool matched ALL of your keywords. If the task needs any tool listed above, unlock it directly by exact name: dev_tool_search({"toolNames":["web_search"]}). Prefer short 1-2 keyword queries.',
    ].join('\n'),
    parameters: toJsonSchema({
      query: { type: 'string', required: false, description: 'search keywords (e.g. "web", "subagent")' },
      toolNames: { type: 'array', required: false, description: 'exact tool names to unlock', items: { type: 'string' } },
    }),
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
      render: (_a, v) => [{ type: 'text', text: v.text }],
    },
    async execute(args, exec) {
      const query = typeof args.query === 'string' ? args.query.trim() : ''
      const unlock = Array.isArray(args.toolNames) ? args.toolNames.filter((name) => typeof name === 'string' && name.length > 0) : []

      const lines = []
      if (unlock.length > 0) {
        lines.push(`Unlocked for the next request: ${unlock.join(', ')}`)
      }
      if (query.length === 0 && unlock.length === 0) {
        lines.push('Provide `query` to search the catalog, or `toolNames` to unlock tools.')
        return { text: lines.join('\n') }
      }
      if (query.length === 0) {
        return { text: lines.join('\n') || 'Nothing to do.' }
      }

      try {
        // The executing agent IS the viewing scope: preset tools register into
        // the agent-scope layer of the tools registry, and schemas() with no
        // scope only sees the global layer — every preset-provided tool would
        // be invisible to keyword search (issue #24). Same pattern as the
        // harness's own code mode (`registry.schemas(exec.agent)`).
        const schemas = ctx.tools.schemas(exec?.agent)
        const wanted = query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
        // FIX: score instead of AND-filter. Exact name match ranks first;
        // otherwise every tool matching at least one token competes, ordered
        // by hit count (desc) then name. A long natural-language query no
        // longer returns an empty catalog.
        const scored = schemas
          .map((schema) => {
            const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
            let score = 0
            for (const token of wanted) if (haystack.includes(token)) score += 1
            return {
              schema,
              score,
              exact: wanted.includes(schema.name.toLowerCase()),
            }
          })
          .filter((entry) => wanted.length > 0 && (entry.exact || entry.score >= 1))
          .sort((a, b) => (b.exact - a.exact) || (b.score - a.score) || a.schema.name.localeCompare(b.schema.name))
        const matches = scored.slice(0, MAX_RESULTS)
        if (matches.length === 0) {
          lines.push(
            `No tools match "${query}". An empty result only means no tool matched ALL keywords — if you need a specific tool, unlock it directly by exact name, e.g. dev_tool_search({"toolNames":["web_search"]}).`,
          )
        } else {
          lines.push(`Matching tools (${matches.length}${scored.length > MAX_RESULTS ? ` of ${scored.length}` : ''}):`)
          for (const { schema, exact, score } of matches) {
            const desc = (schema.description || '').split('\n')[0].slice(0, 90)
            lines.push(`- ${schema.name}${exact ? ' (exact)' : ''}: ${desc}`)
          }
          if (scored.length > MAX_RESULTS) {
            lines.push(`(truncated at ${MAX_RESULTS} — add tokens to narrow the query, e.g. "mcp browser" or "mcp tavily")`)
          }
          lines.push('Unlock with dev_tool_search({"toolNames": ["<exact name>"]}).')
        }
      } catch (error) {
        lines.push(`catalog search unavailable: ${String((error && error.message) || error)}`)
      }
      return { text: lines.join('\n') }
 
```

### Core Architecture Module: `combo-anchored/instruction-hint.mjs`
```
/**
 * instruction-hint — replace `dsh-agent-instructions`' full AGENTS.md/CLAUDE.md
 * injection with a minimal "these files exist" hint.
 *
 * WHY: the full workspace-instruction digest is a large injected block. After
 * the anchored bootstrap promotes, we want the model to KNOW the instruction
 * files exist (so it reads them before acting) without dumping their content
 * into every request. The model reads the files itself via the filesystem
 * tools when it needs them.
 *
 * Behavior:
 *  - After the session records its first durable promotion signal
 *    (`promoteOn`, default `either`), ONE hint message is injected, listing
 *    which instruction files were found:
 *      - user-global: `$DSH_HOME/AGENTS.md`
 *      - project chain: AGENTS.md / CLAUDE.md / AGENTS.local.md / CLAUDE.local.md
 *        walking up from the session cwd to the project root (a directory
 *        containing `.git`, or the cwd itself).
 *  - The hint is intended ONCE PER SESSION, DERIVED FROM DURABLE EVENTS: the
 *    guard scans the session log for an existing `instruction-hint` message
 *    (then O(1)), so a process restart — whose in-memory state starts empty —
 *    cannot inject a second copy. The scan is prevention, not a guarantee: if
 *    it runs before the session log is materialized after a host restart it
 *    sees an empty event list and re-injects. Each message therefore also
 *    carries a UNIQUE id (`instruction-hint-<sessionId>-<randomUUID>`), which
 *    turns a past or future re-injection into a few wasted context tokens
 *    instead of a broken history replay — the old deterministic id would
 *    collide with the first copy and stop history assembly entirely.
 *  - The hint tells the model the files exist so it can read them before
 *    acting when relevant, without embedding their content.
 *  - WORDING (issue #49): the hint text is deliberately NON-IMPERATIVE.
 *    Measured on deepseek-v4-pro (reasoningEffort=max), the directive
 *    wording ("read ... first and follow them") flipped the anchored
 *    "we / let's" trajectory back to "let me" on the promoted request
 *    (session 546a4f16: we 6→0, let me 0→3). Neutral / suggestive wording
 *    keeps the trajectory anchored while the model still discovers and
 *    reads the files on demand.
 *  - Files are probed via `ctx.fs` (the host filesystem seam); a missing fs
 *    service or an unreadable probe degrades to no hint (never throws).
 *  - Pre-promotion requests get NO hint (matches the anchored bootstrap).
 *  - Subagents skip the phase wait by default (their first request already
 *    counts as promoted); `includeSubagents: true` makes a subagent's own
 *    first reply or tool call open the hint — which also keeps the injection
 *    out of the context gate's stripped first request (the gate strips
 *    non-claimed messages while unpromoted).
 *
 * ROW ORDER: this plugin registers its `agent/pre-step` handler with
 * `prepend: true` and after `context-gate`/`tool-bootstrap`, so it runs
 * inside the gate's outermost strip — but it emits AFTER promotion, when the
 * strip is inactive. The hint source kind is `instruction-hint`, which is
 * not in the gate's claimed-baseline allowlist, so the gate can strip it
 * only while the session is unpromoted (never the intended path).
 */

import { randomUUID } from 'node:crypto'
import { createEpochPromotion } from './compaction-epoch.mjs'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'instruction-hint'

/** Durable session event types that count as a promotion signal per mode. */
const PROMOTE_EVENTS = {
  'tool-call': ['tool/call'],
  'assistant-message': ['assistant/message'],
  either: ['tool/call', 'assistant/message'],
}

/** Candidate file names, in probe order, for the project chain and user-global. */
const PROJECT_CANDIDATES = ['AGENTS.md', 'CLAUDE.md', 'AGENTS.local.md', 'CLAUDE.local.md']
const USER_GLOBAL_CANDIDATE = 'AGENTS.md'

function parsePromoteOn(value) {
  if (value === undefined || value === 'either') return PROMOTE_EVENTS.either
  if (value === 'tool-call' || value === 'assistant-message') return PROMOTE_EVENTS[value]
  throw new TypeError(`${name}: promoteOn must be one of "tool-call", "assistant-message", "either"; got ${JSON.stringify(value)}`)
}

/** Every config key this plugin accepts — anything else is a typo. */
const ALLOWED_KEYS = new Set(['promoteOn', 'includeSubagents'])

/** Validate an optional boolean flag with a default. */
function booleanOption(value, field, fallback) {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') {
    throw new TypeError(`${name}: ${field} must be a boolean`)
  }
  return value
}

/** Find the project root: first ancestor containing any root marker (e.g. .git). */
async function findProjectRoot(fs, cwd, signal) {
  let current = cwd
  for (;;) {
    for (const marker of ['.git', '.hg', '.svn']) {
      try {
        const target = await fs.resolve(joinPath(current, marker), { cwd, signal })
        const info = await fs.stat(target, signal)
        if (info !== undefined) return current
      } catch {
        // Probe failure = marker absent; continue.
      }
    }
    const parent = parentPath(current)
    if (parent === current || parent.length === 0) return cwd
    current = parent
  }
}

/** List instruction files present in one directory (project candidates). */
async function presentInDir(fs, dir, candidates, signal) {
  const found = []
  for (const candidate of candidates) {
    try {
      const target = await fs.resolve(joinPath(dir, candidate), { cwd: dir, signal })
      const info = await fs.stat(target, signal)
      if (info !== undefined && info.type === 'file') found.push(candidate)
    } catch {
      // Absent or unreadable — skip.
    }
  }
  return found
}

/** Join one path segment onto a directory (platform-agnostic string join). */
function joinPath(dir, segment) {
  if (dir.endsWith('/') || dir.endsWith('\\')) return dir + segment
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir + sep + segment
}

/** Parent of an absolute Windows or POSIX path. */
function parentPath(path) {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (idx <= 0) return path
  const parent = path.slice(0, idx)
  return parent.length === 0 ? path : parent
}

/** Register the post-promotion instruction-hint injector. */
export function apply(ctx, config) {
  const source = config === undefined ? {} : config
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    throw new TypeError(`${name}: config must be an object`)
  }
  const unknown = Object.keys(source).filter((key) => !ALLOWED_KEYS.has(key))
  if (unknown.length > 0) {
    throw new TypeError(
      `${name}: unknown config key(s) ${unknown.join(', ')} — allowed keys: ${[...ALLOWED_KEYS].sort().join(', ')}`,
    )
  }
  const promoteEvents = parsePromoteOn(source.promoteOn)
  const includeSubagents = booleanOption(source.includeSubagents, 'includeSubagents', false)
  const promotion = createEpochPromotion(promoteEvents, { includeSubagents })
  ctx.on('session/event', (session, event) => promotion.observe(session, event))

  /**
   * Sessions whose hint is already durable in the event log — the
   * restart-safe replacement for an in-memory "already hinted" set. Seeded by
   * a one-time scan, then maintained incrementally through `session/event`.
   */
  const hinted = new Map()
  const hintIsDurable = (session) => {
    const known = hinted.get(session.id)
    if (known !== undefined) return known
    const found = (Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) ? (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])) : []).some((event) =>
      event.type === 'user/message' && event.data?.source?.kind === 'instruction-hint',
    )
    hinted.set(session.id, found)
    return found
  }
  ctx.on('session/event', (session, event) => 
```

### Core Architecture Module: `combo-anchored/skill-search.mjs`
```
/**
 * skill-search — on-demand skill discovery and loading, replacing
 * `dsh-tool-skill`'s full-catalog injection.
 *
 * WHY: the available-skills reminder (`<available_skills>`, ~9KB with many
 * skills) is injected into the first step by dsh-tool-skill and again after
 * every promotion/compaction. That large injected block perturbs the
 * trajectory (issue #6: 0/9 anchored with the catalog present vs ~81%
 * without). We remove the catalog injection entirely and expose two small
 * tools instead — the Claude tool-search pattern:
 *
 *  - `skill_search` — list skills whose name/description match a query
 *    (summaries only, bounded; no bodies). The model discovers what exists
 *    without a 9KB dump.
 *  - `skill_load` — load ONE skill's full instructions by exact name and
 *    inject them for the NEXT request via `agent.inject` (the non-waking
 *    next-step inbox). The model (or the user) calls this only when the
 *    skill is actually needed.
 *
 * Discovery reads `ctx.skills` scoped to the calling agent, exactly like
 * dsh-tool-skill. If skills are unavailable the tools answer with a short
 * message instead of throwing.
 *
 * NOTE: this plugin REPLACES the `dsh-tool-skill` row in the composition —
 * the composition must NOT mount both, or the catalog injection returns.
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'skill-search'

/** The agent, tools, and skills services must exist before these tools can register. */
export const inject = ['agents', 'tools', 'skills']

const MAX_RESULTS = 20

/** Minimal JSON schema compiler for tool parameters (zero dependencies). */
function toJsonSchema(spec) {
  const properties = {}
  const required = []
  for (const [key, meta] of Object.entries(spec || {})) {
    const prop = { type: meta.type }
    if (meta.description) prop.description = meta.description
    properties[key] = prop
    if (meta.required) required.push(key)
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

/** Register the two on-demand skill tools. */
export function apply(ctx) {
  /** Normalize a query into lowercase tokens for simple substring matching. */
  const tokens = (text) => (text || '').toLowerCase().split(/[^a-z0-9_-]+/).filter(Boolean)

  ctx.tools.register({
    name: 'skill_search',
    description: 'Search the available skills by keyword and return matching skill names with short descriptions. This session keeps NO skill catalog in the prompt — if a task looks like it matches a skill (document conversion, image processing, game reviews, markdown, PDF, spreadsheets, …), call skill_search FIRST to find it, then skill_load to activate it. Do NOT assume skill names from memory.',
    parameters: toJsonSchema({
      query: { type: 'string', required: true, description: 'search keywords (e.g. "pdf", "obsidian", "game review")' },
    }),
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
      render: (_a, v) => [{ type: 'text', text: v.text }],
    },
    async execute(args, exec) {
      const wanted = tokens(args.query)
      const scope = exec?.agent ?? ctx
      try {
        const all = await ctx.skills.list({
          scope,
          cwd: exec?.agent?.session?.header?.cwd,
          signal: exec?.signal,
        })
        const matches = all.filter((skill) => {
          if (wanted.length === 0) return true
          const haystack = tokens(`${skill.name} ${skill.description ?? ''} ${skill.whenToUse ?? ''}`).join(' ')
          return wanted.every((token) => haystack.includes(token))
        })
        const head = matches.slice(0, MAX_RESULTS)
        const lines = head.map((skill) => {
          const desc = (skill.description || '').split('\n')[0]
          return `- ${skill.name}: ${desc}`
        })
        if (lines.length === 0) return { text: `No skills match "${args.query}". Use skill_search with other keywords.` }
        const extra = matches.length > MAX_RESULTS ? `\n…(${matches.length - MAX_RESULTS} more)` : ''
        return { text: `Matching skills (${matches.length}):\n${lines.join('\n')}${extra}\n\nLoad one with skill_load (exact name).` }
      } catch (error) {
        return { text: `skill_search unavailable: ${String((error && error.message) || error)}` }
      }
    },
  })

  ctx.tools.register({
    name: 'skill_load',
    description: 'Load the full instructions of ONE skill by its exact name (from skill_search results) and inject them for the next request. Call this before acting on a task that matches the skill.',
    parameters: toJsonSchema({
      name: { type: 'string', required: true, description: 'exact skill name (kebab-case, from skill_search)' },
    }),
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
      render: (_a, v) => [{ type: 'text', text: v.text }],
    },
    async execute(args, exec) {
      try {
        const agent = exec?.agent
        if (agent === undefined) return { text: 'skill_load requires an agent context.' }
        const skill = await ctx.skills.get(args.name, {
          scope: agent,
          cwd: agent.session.header.cwd,
          signal: exec?.signal,
        })
        if (skill === undefined) {
          return { text: `No skill named "${args.name}". Run skill_search to list available skills.` }
        }
        const body = extractSkillBody(skill)
        if (body.length === 0) {
          return { text: `Skill "${args.name}" has no loadable body.` }
        }
        // Queue the skill content as a non-waking next-step context message,
        // exactly like dsh-tool-skill's invocation injection.
        agent.inject({
          id: `skill-load-${args.name}-${Date.now()}`,
          role: 'user',
          content: [{ type: 'text', text: body }],
          source: { kind: 'skill-invocation', name: args.name, form: 'instructions' },
        })
        return { text: `Skill "${args.name}" loaded; its instructions will be injected for the next request.` }
      } catch (error) {
        return { text: `skill_load failed: ${String((error && error.message) || error)}` }
      }
    },
  })
}

/** Extract the model-facing body of a loaded skill definition. */
function extractSkillBody(skill) {
  const content = skill?.content ?? skill?.instructions ?? skill?.body
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join('\n')
  }
  return ''
}

```

### Core Architecture Module: `combo-anchored/think-phase.mjs`
```
/**
 * Think-execute two-phase bootstrap — EVERY user turn opens with ONE
 * zero-tool THINK step, then continues with the promoted resident catalog
 * for execution.
 *
 * This is the engine behind the think/execute split: separate thinking from
 * execution. On DeepSeek V4 Pro the deepest "We …" reasoning chains happen
 * when the request carries NO tool definitions, while a callable catalog
 * collapses deliberation before the first tool call — so the think step
 * strips the whole catalog. (A tools-visible-but-locked variant needs
 * wire-level `tool_choice`, which the official deepseek adapter does not
 * map at all (MVP cut); the sibling repository's `wire-think-standard`
 * covers that variant.)
 *
 * Mechanism, per user turn:
 *
 *  1. THINK (step 0): `system-prompt/assemble` strips the catalog to ZERO
 *     tools and `agent/pre-step` strips auto-injected context (an enumerated
 *     `suppressedContextSources` list), so the first
 *     request of the turn reproduces the zero-tool condition on the REAL user
 *     message — no synthetic anchor round, no deferred input. The model
 *     writes its full "We …" plan as an ordinary assistant reply.
 *
 *     SCOPE NOTE (2026-08-17): this strip is THINK-STEP-scoped (one step per
 *     turn), not session-phase-scoped — the shared context-gate's promotion
 *     phase machine does not map onto it, so the enumerated list stays here
 *     deliberately. Session-phase injection control (preset/, zero-anchored,
 *     whoami) belongs to context-gate; per-step strips are a documented
 *     exception.
 *  2. STEER: a text-only reply would close the turn, so `agent/turn-stopping`
 *     (the serial pre-commit checkpoint) calls `agent.steer(...)` exactly
 *     once per turn with a plugin-sourced notice: "tools are now open —
 *     execute the plan, or restate the final answer".
 *  3. EXECUTE (step 1+): the phase flips to execute and every later request
 *     of the turn sees the minimal RESIDENT set — the shells +
 *     `str_replace_editor` + the discovery tools + whatever the model
 *     explicitly unlocked via `dev_tool_search` (same promoted phase as the
 *     zero-anchored preset, including resume-safe unlocked-name derivation).
 *
 * `mode: 'first-turn'` degrades to the classic single anchor (only the
 * session's first user turn thinks; later turns open with tools directly)
 * when the per-turn extra model call is not worth it.
 *
 * Robustness:
 *  - The steered-turn set is rebuilt from durable `steering/message` events
 *    (source.plugin === 'think-phase') on cold start, so a restart mid-turn
 *    never steers twice; an in-memory set guards the same process.
 *  - A crashed-before-steer turn resumes as an execute step (step index > 0)
 *    with the plan already durable in history — graceful degradation, never
 *    a stuck turn.
 *  - Subagents default to always-execute (their briefs are already plans);
 *    `includeSubagents: true` makes them think first too.
 *  - A filter failure degrades to the full catalog with a one-time warning,
 *    so a bug can never brick every request of a session.
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'think-phase'

/**
 * Deliberately NO inject list, first row of the composition, `prepend: true`
 * registration — the same discipline as tool-bootstrap.mjs: the listener only
 * touches services at event time and stays the OUTERMOST waterfall transform,
 * so this filter's post-`next()` rewrite always gets the final say.
 */
export const inject = []

/** Same automatic injections the anchored variants strip while controlled. */
const DEFAULT_SUPPRESSED_SOURCES = ['skill-catalog', 'agent-instructions']

/** Shell candidates (custom-bash registers `bash`; pwsh is Windows standard). */
const SHELLS = ['bash', 'pwsh']

/** Discovery tools always resident in the execute phase (the tool-search pattern). */
const RESIDENT_DISCOVERY_TOOLS = ['dev_tool_search', 'skill_search', 'skill_load']

/** Default steering notice that opens the execute phase. */
export const STEER_TEXT = [
  'The thinking round is complete and all tools are now open.',
  'Proceed to execute the plan you laid out in your previous message, using the available tools.',
  'If that message already fully answers the user and no file, command, or verification work remains, restate the final answer concisely and finish.',
].join(' ')

function parseMode(value) {
  if (value === undefined || value === 'every-turn') return 'every-turn'
  if (value === 'first-turn') return 'first-turn'
  throw new TypeError(`${name}: mode must be "every-turn" or "first-turn"; got ${JSON.stringify(value)}`)
}

function sourceList(value, field, fallback) {
  if (value === undefined) return new Set(fallback)
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new TypeError(`${name}: ${field} must be an array of non-empty strings`)
  }
  return new Set(value)
}

/** Register the per-session think/execute phase controller. */
export function apply(ctx, config) {
  const mode = parseMode(config?.mode)
  const suppressedSources = sourceList(config?.suppressedContextSources, 'suppressedContextSources', DEFAULT_SUPPRESSED_SOURCES)
  const includeSubagents = config?.includeSubagents === true
  const steerText = typeof config?.steerText === 'string' && config.steerText.length > 0 ? config.steerText : STEER_TEXT

  /**
   * Per-session phase state: which phase the NEXT request of the session is
   * in, the turn that state was recorded for, and the turns already steered.
   * The steered set is rebuilt once from durable `steering/message` events
   * so a process restart never double-steers a turn.
   */
  const state = new Map()

  const ensure = (agent) => {
    const session = agent?.session
    if (session === undefined) return undefined
    let entry = state.get(session.id)
    if (entry === undefined) {
      const steered = new Set()
      if (Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])))) {
        for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
          if (event.type !== 'steering/message') continue
          if (event.data?.source?.plugin === name && typeof event.data?.turn === 'number') {
            steered.add(event.data.turn)
          }
        }
      }
      entry = { phase: 'execute', turn: null, steered }
      state.set(session.id, entry)
    }
    return entry
  }

  let warned = false
  const warnOnce = (message) => {
    if (warned) return
    warned = true
    try {
      ctx.logger.warn(message)
    } catch {
      // Logger unavailable — the guard exists only to avoid spamming.
    }
  }

  /**
   * Tool names the model explicitly unlocked via `dev_tool_search` for one
   * session (execute phase). Derived from durable `tool/call` events so
   * resume/reload keeps them — same derivation as zero-tool-bootstrap.
   */
  const unlockedFor = (session) => {
    const unlocked = new Set()
    if (session === undefined || !Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])))) return unlocked
    for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
      if (event.type !== 'tool/call') continue
      if (event.data?.name !== 'dev_tool_search') continue
      let args
      try {
        args = JSON.parse(event.data.arguments)
      } catch {
        continue
      }
      if (args === null || typeof args !== 'object' || Array.isArray(args)) continue
      const names = args.toolNames
      if (Array.isArray(names)) for (const toolName of names) if (typeof toolName === 'string' && toolName.length > 0) unlocked.add(toolName)
    }
    return unlocked
  }

  // Phase bookkeeping + think-phase context strip. Registration discipline
  // copied from the anchored presets: `prepend` keeps this the OUTERMOST
  // transform of the agent/p
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #90** (2026-09-08): **fix: migrate persona rows from `text:` to `prefix:` for dsh-persona 0.1.3**
  *Symptoms*: ## What  Migrates every mode directory's `persona` row from the removed `text:` key to the required `prefix:` key of `@deepseek-ai/dsh-persona` 0.1.3. The persona **text** is unchanged — only the config key moves.  Closes #89.  ## Why  dsh-persona 0.1.3-alpha.x replaced its config schema with:  ```js const Config = z.object({ 	prefix: z.string().required(), 	suffix: z.string().default(""), 	complete: z.boolean().default(false), 	includeRuntimeContext: z.boolean().default(true) }); ```  There is no `text` key anymore, so every preset that ships the old key now fails to mount on 0.1.3 with `invalid config: $.prefix missing required value`, and resume breaks for sessions that already selected the preset. PR #88 aligned the session-log scans for 0.1.3; this fixes the remaining mount blocker.  ## Change  In all seven `agent.cordis.yml` files (preset, zero-anchored-standard, whoami-standard, combo-anchored, eternal-minimal, wire-think-standard, prefab):  ```diff    config: -    text: You are a helpful software engineer assistant. +    prefix: You are a helpful software engineer assistant.      complete: true      includeRuntimeContext: false ```  The fixed row matches the official 0.1.3 `minimal` preset's persona row byte-for-byte, so the Minimal anchor condition (byte-pure persona) is unaffected.  ## Verification  - `npm run check`: **223/223 pass** (includes the materialized-copy sync gate). - Checked against the installed `@deepseek-ai/dsh-persona` 0.1.3-alpha.2 zod schema: old 
  **Post-Mortem & Fix Analysis**:
  > Merged as 19814bd — thank you for the report and the fix (and for checking the installed schema instead of guessing). Local verification and source audit:  - **Local**: `npm run check` (sync consistency + tests) passes at **223/223** on the merged main. - **Source verification at tag `dsh-v0.1.3-alpha.2`**: the persona package's `Config` is exactly `{ prefix: required, suffix: default '', complete: default false, includeRuntimeContext: default true }`, and `apply()` registers `config.prefix` as the `deployment:persona-prefix` section text with `complete: true` suppressing the suffix and every other section. So `prefix: X, complete: true, includeRuntimeContext: false` renders the same byte-pure persona the old `text: X, complete: true` did — the Minimal anchor condition is untouched, which was the thing I most wanted to check before touching a persona row. - I also confirmed your byte-for-byte claim: the official 0.1.3 `minimal` preset's persona row is `prefix: You are a helpful softwar

- **Issue #89** (2026-09-08): **Preset fails to mount on DSH 0.1.3: dsh-persona replaced `text` with a required `prefix`**
  *Symptoms*: ## Summary  On DeepSeek Harness 0.1.3-alpha.x, every mode directory's agent.cordis.yml fails to mount because the persona row still uses the old `text` config key, which @deepseek-ai/dsh-persona 0.1.3 removed in favor of a required `prefix`.  ## Symptom  New session with any preset (anchored-standard / zero / whoami / ...) fails at mount:  ``` invalid config: $.prefix missing required value ```  and resume breaks for every session that had already selected the preset.  ## Root cause  Installed @deepseek-ai/dsh-persona (0.1.3-alpha.2) schema:  ```js const Config = z.object({ 	prefix: z.string().required(), 	suffix: z.string().default(""), 	complete: z.boolean().default(false), 	includeRuntimeContext: z.boolean().default(true) }); ```  There is no `text` key anymore; `text:` is silently ignored and the missing `prefix` fails validation.  The preset still ships (e.g. preset/agent.cordis.yml):  ```yaml - id: persona   name: '@deepseek-ai/dsh-persona'   config:     text: You are a helpful software engineer assistant.     complete: true     includeRuntimeContext: false ```  ## One-line fix (verified)  ```yaml     prefix: You are a helpful software engineer assistant. ```  The persona TEXT stays byte-identical, so the Minimal anchor condition is unaffected. The fixed row matches the official 0.1.3 `minimal` preset's persona row byte-for-byte (that preset already migrated to `prefix`).  Verified against the 0.1.3-alpha.2 schema (old config rejected, new accepted), and the preset moun
  **Post-Mortem & Fix Analysis**:
  > Thanks for the precise report — a schema quote, the exact mount error, and the reminder that PR #88 only covered half of the 0.1.3 breakage.  Fixed by PR #90 (merged as 19814bd): all seven mode directories now ship `prefix:` instead of the removed `text:`, with the persona text unchanged (still byte-identical to the official 0.1.3 `minimal` persona row, so the Minimal anchor condition is unaffected).  I verified the change against the upstream source at tag `dsh-v0.1.3-alpha.2` rather than only the installed package: the persona `Config` is `{ prefix: required, suffix: default '', complete, includeRuntimeContext }`, and `complete: true` suppresses the suffix and every other section — so the rendered persona is the same bytes as before.  One thing worth knowing, now recorded in the README Compatibility section: **this is a one-way migration.** Because unknown keys fail at mount, a persona row cannot carry both `text` and `prefix`, so on dsh `0.1.3-alpha.1` and older the row must use `te

- **Issue #88** (2026-09-06): **fix: support session.snapshotEvents() in DSH presets**
  *Symptoms*: DeepSeek Harness has removed the direct `session.events` array and now provides `session.snapshotEvents()`. This caused preset plugins that scan session history to fail, so Prefab and other anchored presets could not seed/inject context correctly after a DSH update.  This PR updates all preset plugin files and verify helpers to use:  ```js session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []) ```  and the equivalent for `agent.session.events`.  It keeps compatibility with older DSH versions that still expose `session.events`.  Verification: - `npm test` passes: 214/214 
  **Post-Mortem & Fix Analysis**:
  > Independent real-world verification of this fix: on dsh 0.1.2-rc.1, a deployed preset derived from this repo's combo-anchored/tool-bootstrap.mjs crashed on every prompt with `TypeError: Cannot read properties of undefined (reading 'length')` at the `state.next < events.length` loop in `scanEvents()` (`session.events` was removed in 0.1.2, so nothing after session-creation was ever persisted). Patching only `scanEvents()` to feature-detect `snapshotEvents()` — the same pattern as this PR — restored normal operation, verified end-to-end on a live instance (model replies, phase-1 anchoring intact, first-request input back to ~1.4K tok). The ``session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])`` fallback is confirmed sufficient on both 0.1.1 and 0.1.2-rc.1. Also affected the local anchored-creator copy the same way.
  > Merged as 4458390 — thank you for the clean, mechanical fix. Local verification and source audit on the merged main:  - **Local verification**: `npm run check` (sync consistency + tests) passes, now **223/223** (the 214 baseline plus 9 new compat tests, see below). - **Claim verified against the dsh source**: on `0.1.3-alpha.1`, the `Session` class keeps its log private, exposes `snapshotEvents(from, to)` returning a frozen `readonly SessionEvent[]` (cache invalidated on every append), and has **no public `events` member** — so the presets' history scans were indeed broken on that build. The plugin hook names (`system-prompt/assemble`, `agent/pre-step`, `tools/pre-execute`, `agent/turn-stopping`, …) are unchanged there, so this shim covers the breakage we know of. - **Follow-ups pushed to main** (docs + test commits after the merge):   - a new `test/snapshot-events-compat.test.mjs` runs the core scan paths (promotion, `dev_tool_search` durable unlocks, compaction re-anchoring, anchor-t

- **Issue #87** (2026-09-01): **feat: align subagent delegation config with dsh 0.1.2-alpha.3**
  *Symptoms*: ## Summary  Aligns the anchored-standard plugin's subagent delegation configuration with dsh `0.1.2-alpha.3` (the latest published alpha; there is no `0.1.3-alpha` tag). No behavioral change to the anchored bootstrap/anchor flow — only the subagent interface is brought in sync with upstream.  ## Changes  All 7 `agent.cordis.yml` presets (`preset`, `zero-anchored-standard`, `whoami-standard`, `combo-anchored`, `eternal-minimal`, `prefab`, `wire-think-standard`):  - `tool-subagent` (spawn): add `modelSelectionSettings: true` — enables optional `provider` / `model` / `reasoning_effort` child-selection fields and registers the shared `list_subagent_models` discovery tool. - `tool-subagent-codex` / `tool-subagent-claude-code` (disabled rows): replace the removed `enableRunInBackground: false` key with `backgroundMode: one-shot` (matches the current dsh `tool-subagent` config schema; stays `disabled: true` with `maxDepth: provider-managed`).  Plus `shared/dev-tool-search.mjs` (and its synced copies):  - Advertise `list_subagent_models` alongside `subagent / subagent_fork` so the new model-selection tool is discoverable through `dev_tool_search`.  ## Validation  - `npm run sync` — all mode copies match `shared/`. - `npm test` — 214/214 pass. - Verified against dsh `0.1.2-alpha.3` source: all delegation rows match the official `standard` preset; plugin event APIs (`session/event`, `system-prompt/assemble` + `context.agent`, `agent/pre-step`, `agent/inbox/inserted`, `agent.inject`, `c
  **Post-Mortem & Fix Analysis**:
  > 已合并（3690447）。本地验证之外，我把改动逐行对照了 dsh `0.1.2-alpha.3` 的源码（`packages/preset/agent-presets/presets/standard/agent.cordis.yml` 与 `packages/subagent/tool-subagent/src/index.ts`）：  - `tool-subagent`（spawn）行加 `modelSelectionSettings: true` —— 与官方 standard preset 逐字一致（官方 fork 行有意不加以保留 KV Cache 前缀复用，这里同样没加，正确）； - codex / claude-code 两个 disabled 行改 `backgroundMode: one-shot` —— 与官方 preset 一致；schema 确认 `backgroundMode: 'one-shot' | 'continuable'`，默认 `one-shot`； - `list_subagent_models` 确为真实工具（`tool-subagent/src/list-models.ts`），加入 `UNLOCKABLE_INDEX` 后仍走晋升后解锁路径，不进首轮 bootstrap 目录——测试套件首轮工具断言全绿（214/214，sync 校验一致）。  一处描述勘误，供以后参考：`enableRunInBackground` 并没有被上游**移除**（schema 里仍在，默认 `true`，见 `tool-subagent` Config 定义），只是官方 preset 不再用它表达这两个 provider 行的前台语义。对 `disabled: true` 的行两种写法实际等价，且本 PR 的目标是"逐行对齐官方 standard preset"——这一点完全达成，不影响合并。  正是维护期口径里"harness 兼容性更新仍会处理"的那类 PR，感谢对齐！ 

- **Issue #86** (2026-09-01): **feat: align subagent delegation config with dsh 0.1.2-alpha.3**
  *Symptoms*: ## Summary  Aligns the anchored-standard plugin's subagent delegation configuration with the latest dsh alpha (`0.1.2-alpha.3`). No behavioral change to the anchored bootstrap/anchor flow; only the subagent interface is brought in sync with upstream.  ## Changes  All 7 `agent.cordis.yml` presets (`preset`, `zero-anchored-standard`, `whoami-standard`, `combo-anchored`, `eternal-minimal`, `prefab`, `wire-think-standard`):  - `tool-subagent` (spawn): add `modelSelectionSettings: true` — enables the optional `provider` / `model` / `reasoning_effort` child-selection fields and registers the shared `list_subagent_models` discovery tool. - `tool-subagent-codex` / `tool-subagent-claude-code` (disabled rows): replace the removed `enableRunInBackground: false` key with `backgroundMode: one-shot` (matches the current dsh `tool-subagent` config schema; stays `disabled: true` with `maxDepth: provider-managed`).  Plus `shared/dev-tool-search.mjs` (and its synced copies):  - Advertise `list_subagent_models` alongside `subagent / subagent_fork` so the new model-selection tool is discoverable through `dev_tool_search`.  ## Validation  - `npm run sync` — all mode copies match `shared/`. - `npm test` — 214/214 pass. - Verified against dsh `0.1.2-alpha.3` source: all delegation rows match the official `standard` preset; plugin event APIs (`session/event`, `system-prompt/assemble` + `context.agent`, `agent/pre-step`, `agent/inbox/inserted`, `agent.inject`, `ctx.tools.schemas`, `ctx.skills`, `ctx.

- **Issue #84** (2026-09-01): **feat(wire-think): add orcarouter as a named think-route gateway**
  *Symptoms*: This lets the Wire Think-Execute preset's think-route condition run over the OrcaRouter gateway instead of only the DeepSeek endpoint — the same `tool_choice: none` wire lever, but with access to the `vendor/model` model namespace (including the adaptive `orcarouter/auto` router) and no custom base URL needed.  [OrcaRouter](https://www.orcarouter.ai) is an OpenAI-compatible AI gateway built for both models and agents. Like OpenRouter, it exposes a provider/model namespace across many models — but it also combines adaptive routing, automatic failover, zero-markup inference, observability, guardrails, and agent-tool governance behind the same endpoint. Adding orcarouter as a first-class provider means this project's users can use that stack directly, without treating OrcaRouter as an anonymous custom base URL. Given the project's own status note on DeepSeek API price increases, a zero-markup gateway route is a natural fit for keeping the evaluation loops affordable.  This mirrors the existing `toolchoice-adapter` sibling-route pattern (`deepseek-wire-think`) exactly: set `gateway: orcarouter` on the row and the adapter registers the same think route against `https://api.orcarouter.ai/v1`, resolving the key from `ORCAROUTER_API_KEY` with `baseURL`/`apiKeyEnv` row config still winning, and swaps the advisory catalog to `deepseek/deepseek-chat`, `deepseek/deepseek-reasoner`, and `orcarouter/auto`. An unknown gateway name fails the mount loudly rather than silently falling back to 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the careful construction — the GATEWAYS registry mirrors the toolchoice-adapter's existing patterns, unknown names fail the mount loudly instead of silently falling back to DeepSeek, row config still wins, and the default path is untouched. The engineering quality is not in question, so let me be equally direct about why this one can't be merged:  **This is a new feature in a maintenance-mode repo.** Per the project status (README *Project status* and [FAREWELL.md](./FAREWELL.md)), only bug fixes and harness-compatibility updates are being accepted; new functionality is not merged by default. A first-class named integration for a third-party gateway is squarely in the new-functionality class — nothing upstream in dsh forces this change.  Two additional considerations specific to a vendor-named route:  - **The capability already ships without it.** The wire-think row's `baseURL` / `apiKeyEnv` config routes the think condition at any OpenAI-compatible endpoint today — `baseURL

- **Issue #82** (2026-08-28): **docs: document identity drift under the bare Minimal persona**
  *Symptoms*: ## What  Documents a reproducible side effect of the deliberately bare Minimal persona: the model has no identity anchor and falls back to training priors on identity questions (observed: `deepseek-v4-pro` answering "I am Claude" when asked "你是谁？").  Adds one bullet to **Important behavior** (and its zh-CN mirror **重要行为**) with a one-line recipe that pins identity without touching the tool schema — the decisive anchor lever.  ## Why docs-only  - No defaults, no code, no behavior change: the persona stays byte-identical to Minimal, exactly as the mechanism requires. - Per the project's evidence bar for prompt-text changes (#49 / #63), changing the default text would need a trajectory-level A/B, which is not included here. - Full reproduction data and the fix verification live in #81.  ## Verification performed (for the issue)  - DeepSeek Harness 0.1.1-rc.2, Windows 11, `deepseek-v4-pro`, `reasoningEffort: max`. - Before the one-line fix: identity question answered *"我是 Claude，Anthropic 开发的 AI 编程助手…"*. - After appending `You are an AI agent powered by DeepSeek Harness.` to the persona `text:`: same question answered *"我是 DeepSeek，由深度求索公司创造的 AI 助手…"*. - Mechanical anchor checks unchanged on both sides: first `request/header` tools `[bash, str_replace_editor]`, no skill-catalog / AGENTS.md injection, promotion to the resident catalog, single runtime-context snapshot diffed in after promotion.  ## Related  - #81 — [Behavior] Identity drift: model claims "I am Claude" under the bar
  **Post-Mortem & Fix Analysis**:
  > 已合并（8fe290b）。README 双语 bullet 均已落地，`npm run check` 本地验证通过（文档改动，测试套件不受影响）。  正是我们想要的处理方式：不改默认文本、不动工具 schema，把已知行为和一行配方写清楚，并明确提示"偏离被测条件请自行验证首轮轨迹"。#81 下会同步回复三个选项的取舍。 

- **Issue #80** (2026-08-26): **fix(dev-tool-search): fuzzy token scoring + teach the toolNames unlock path (#32)**
  *Symptoms*: ## 问题  按需解锁链路（`dev_tool_search`）在真实会话中失效——**即使 scope 修复（issue #32 / PR #31 的 `schemas(exec?.agent)`）已经合入**。在一次真实的 anchored-standard 会话日志中，模型两次调用 `dev_tool_search` 均返回 `No tools match`，未解锁任何工具，resident 目录整个会话恒为 5 个——标准工具（web_search、subagent、todo_write 等）全程不可达。  证据已发布在 [issue #32](https://github.com/xiaobright/dsh-anchored-standard/issues/32#issuecomment-5408508279)。  ## 根因——两个独立缺陷  **缺陷 A：搜索匹配是 AND 全 token 逻辑**  ```js return wanted.every((token) => haystack.includes(token)) ```  真实会话中出现的长自然语言查询 `"file edit write replace script root permissions"`（7 个 token）要求某个工具的 name+description 同时包含**全部** token——没有任何工具能满足，即使目录完整也必然返回 `No tools match`（已复现：单 token 如 `web`/`todo` 能命中，7 token 查询永远失败）。现有回归测试只覆盖单 token 场景（`subagent`），测不出这个问题。  **缺陷 B：模型从不传 `toolNames`，解锁永不登记**  描述虽写明 "pass toolNames with exact names to unlock"，但实测模型只传 `query`。`tool-bootstrap.mjs` 的 `unlockedFor()` 从 `tool/call` 参数里解析解锁名单，没有 `toolNames` 就永远解不开 → resident 目录永不增长。  ## 修复  `shared/dev-tool-search.mjs`（经 `sync-modes` 物化到全部模式目录）：  1. **模糊评分取代 AND 过滤**——名称精确匹配优先，其次按「命中 token 数」降序返回命中 ≥1 个 token 的工具。失败的查询现在返回 `write (exact)`、`edit (exact)`、`str_replace_editor`、`todo_write` 等，而不是空结果。 2. **在工具描述里教解锁路径**——加一步到位示例 `dev_tool_search({"query":"web","toolNames":["web_search"]})`，并明确「空搜索结果不代表工具不存在，可直接用 toolNames 精确解锁」。  ## 验证  - **测试：211/211 通过**（新增 2 条回归：长自然语言查询不再返回 `No tools match`；空结果时提示 `toolNames` 解锁路径）。`scripts/sync-modes.mjs --check` 无 drift。 - **远程真实会话端到端**（deepseek-v4-pro，8 步）：   - `dev_tool_search({"query":"file edit wri
  **Post-Mortem & Fix Analysis**:
  > 已合并（1ca8da9）。本地完整跑过 `npm run check`：sync 校验通过（7 个模式副本与 shared 一致），测试 211/211 通过（main 上为 209，新增 2 例回归均有效）。你分支上的 CI 因为首次贡献需要维护者批准而没自动跑，我直接在本地验证了，不影响。  这份修复非常扎实——尤其是用真实会话日志把「scope 已修好但仍空结果」拆成 AND 匹配和只搜不解锁两层独立缺陷的定位过程，比单纯报 bug 有价值得多。模糊打分 + 空结果教学的组合也正好对症：前者保证长 query 不再一无所获，后者把「搜索无结果 ≠ 工具不存在」教给模型。已在 #32 下同步闭环说明。  维护期内这类带复现证据的 bug-fix PR 随时欢迎，感谢贡献！ 

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

### Incident Patch 1: `e4db8c76` (2026-09-08)
**Commit Message**: docs: acknowledge #90, document the 0.1.3-alpha.2 persona prefix migration

- Compatibility (bilingual): record that dsh 0.1.3-alpha.2 replaced the
  dsh-persona row's text key with a required prefix, that #90 migrated all
  seven mode dirs with the persona text unchanged (still byte-identical to the
  official minimal persona row), and that this one is a ONE-WAY migration -
  a row cannot carry both keys, so dsh 0.1.3-alpha.1 and older need text: back.
- Acknowledge Vladimir-Human (report #89 + fix #90); stats 27/19 -> 28/20.

**File**: `ACKNOWLEDGEMENTS.md` (modified, +2/-1)
```diff
@@ -31,6 +31,7 @@
 - [@mbzmr](https://github.com/mbzmr)——以修复前后的完整 session 导出证据复现极简 persona 下的身份漂移（自称 Claude），验证一行身份句配方不影响任何机械锚定指标，并按 #49/#63 的证据标准将其记录为 README 已知行为（[#81](https://github.com/xiaobright/dsh-anchored-standard/issues/81)、[#82](https://github.com/xiaobright/dsh-anchored-standard/pull/82)）。
 - [@heiheiha798](https://github.com/heiheiha798)——将 7 个 preset 的 subagent 委派配置逐行对齐 dsh 0.1.2-alpha.3 官方 standard preset（`modelSelectionSettings` 与 `backgroundMode` 迁移），并在 `dev_tool_search` 可解锁目录中收录 `list_subagent_models`（[#87](https://github.com/xiaobright/dsh-anchored-standard/pull/87)）。
 - [@324641aliyun](https://github.com/324641aliyun)——针对 dsh 0.1.3-alpha.1 移除公开 `session.events` 的破坏性变更，把全部 7 个模式与 verify 助手的历史扫描统一改为优先 `session.snapshotEvents()` 并回退 `session.events`，恢复新版 harness 下的预填充与上下文注入（[#88](https://github.com/xiaobright/dsh-anchored-standard/pull/88)）。
+- [@Vladimir-Human](https://github.com/Vladimir-Human)——报告并修复 dsh 0.1.3-alpha.2 上 `dsh-persona` 行 `text` 被必填 `prefix` 取代导致的挂载与会话恢复失败：定位 schema 变更、给出逐行修复并核对官方 minimal persona 行，7 个模式目录统一迁移且 persona 文本保持逐字节不变（[#89](https://github.com/xiaobright/dsh-anchored-standard/issues/89)、[#90](https://github.com/xiaobright/dsh-anchored-standard/pull/90)）。
 
 ## 研究与独立复现
 
@@ -45,4 +46,4 @@
 
 完整记录可在 [Contributors](https://github.com/xiaobright/dsh-anchored-standard/graphs/contributors)、[Pull Requests](https://github.com/xiaobright/dsh-anchored-standard/pulls?q=is%3Apr) 和 [Issues](https://github.com/xiaobright/dsh-anchored-standard/issues?q=is%3Aissue) 中查阅；实验材料与研究贡献见 [DeepseekCotexplorations](https://github.com/0liveiraaa/DeepseekCotexplorations)。
 
-> 统计截至 2026-09-06：主仓库共有 27 个已合并 PR，其中包括 19 位外部 PR 作者；此外还有通过协作分支、审查合并和研究仓库参与项目的贡献者。GitHub 账号与本地 Git 作者邮箱的映射可能造成贡献计数差异，因此这里以可核验的实际贡献内容为主，而不是按 commit 数量排序。
+> 统计截至 2026-09-08：主仓库共有 28 个已合并 PR，其中包括 20 位外部 PR 作者；此外还有通过协作分支、审查合并和研究仓库参与项目的贡献者。GitHub 账号与本地 Git 作者邮箱的映射可能造成贡献计数差异，因此这里以可核验的实际贡献内容为主，而不是按 commit 数量排序。
```

**File**: `README.md` (modified, +11/-0)
```diff
@@ -346,6 +346,17 @@ the presets load on both old and new harness builds. Verified against the
 `0.1.3-alpha.1` source (the session API surface the plugins touch, plus the
 plugin hook names) and by the mock suite; not by live runs on that build.
 
+DeepSeek Harness `0.1.3-alpha.2` replaced the `dsh-persona` row's `text` key
+with a required `prefix` (plus an optional `suffix`), so every mode's preset
+failed to mount with `invalid config: $.prefix missing required value`. Since PR
+[#90](https://github.com/xiaobright/dsh-anchored-standard/pull/90) the persona
+rows use `prefix:` — the persona TEXT is unchanged (it still matches the
+official 0.1.3 `minimal` persona row byte-for-byte), so the byte-pure Minimal
+anchor condition is unaffected. **This part is a one-way migration:** a preset
+row cannot carry both keys (unknown keys fail at mount), so on dsh
+`0.1.3-alpha.1` and older the persona row must use `text:` again — change that
+one line per mode directory, or use the commit before #90.
+
 The persistent shell resolves `shellPath` adaptively: it keeps the
 terminal-bash plugin default `/bin/bash` on hosts where that absolute path
 exists, and falls back to `bash` (PATH lookup) otherwise — e.g. NixOS, where
```

**File**: `README.zh-CN.md` (modified, +9/-0)
```diff
@@ -290,6 +290,15 @@ DeepSeek Harness `0.1.3-alpha.1` 移除了公开的 `session.events` 数组，
 preset 在新旧 harness 上都能加载。验证方式为对照 `0.1.3-alpha.1` 源码（插件
 触及的 session API 面 + 插件钩子名）与 mock 测试套件，未在该构建上实机运行。
 
+DeepSeek Harness `0.1.3-alpha.2` 把 `dsh-persona` 行的 `text` 键换成了必填的
+`prefix`（另有可选 `suffix`），于是每个模式的 preset 都挂载失败，报
+`invalid config: $.prefix missing required value`。自 PR
+[#90](https://github.com/xiaobright/dsh-anchored-standard/pull/90) 起，persona
+行改用 `prefix:`——persona 文本本身未动（仍与官方 0.1.3 `minimal` 的 persona
+行逐字节一致），字节纯净的 Minimal 锚定条件不受影响。**这一段是单向迁移**：
+同一行不能同时写两个键（未知键会在挂载时报错），因此在 dsh `0.1.3-alpha.1`
+及更早版本上必须把 `text:` 改回来——每个模式目录改一行，或使用 #90 之前的提交。
+
 持久 shell 的 `shellPath` 按环境自适应：`/bin/bash` 存在的传统主机保持
 terminal-bash 插件的默认行为不变；仅当该绝对路径不存在（如 NixOS，bash
 位于 Nix store 中）时才回退为 `bash`（PATH 查找）。自带 `/bin/bash` 的主机
```

---

### Incident Patch 2: `19814bdb` (2026-09-08)
**Commit Message**: Merge pull request #90 from Vladimir-Human/fix/persona-prefix-013

fix: migrate persona rows from `text:` to `prefix:` for dsh-persona 0.1.3

**File**: `combo-anchored/agent.cordis.yml` (modified, +2/-1)
```diff
@@ -50,7 +50,7 @@
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: You are a helpful software engineer assistant.
+    prefix: You are a helpful software engineer assistant.
     complete: true
     includeRuntimeContext: false
 
@@ -371,3 +371,4 @@
   config:
     fetch: false
     searchTimeoutMs: 60000
+
```

**File**: `eternal-minimal/agent.cordis.yml` (modified, +2/-1)
```diff
@@ -56,7 +56,7 @@
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: You are a helpful software engineer assistant.
+    prefix: You are a helpful software engineer assistant.
     complete: true
     includeRuntimeContext: false
 
@@ -291,3 +291,4 @@
   config:
     fetch: false
     searchTimeoutMs: 60000
+
```

**File**: `prefab/agent.cordis.yml` (modified, +2/-1)
```diff
@@ -105,7 +105,7 @@
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: You are a helpful software engineer assistant.
+    prefix: You are a helpful software engineer assistant.
     complete: true
     includeRuntimeContext: false
 
@@ -434,3 +434,4 @@
   config:
     fetch: false
     searchTimeoutMs: 60000
+
```

**File**: `preset/agent.cordis.yml` (modified, +2/-1)
```diff
@@ -99,7 +99,7 @@
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: You are a helpful software engineer assistant.
+    prefix: You are a helpful software engineer assistant.
     complete: true
     includeRuntimeContext: false
 
@@ -439,3 +439,4 @@
   config:
     fetch: false
     searchTimeoutMs: 60000
+
```

**File**: `whoami-standard/agent.cordis.yml` (modified, +2/-1)
```diff
@@ -50,7 +50,7 @@
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: You are a helpful software engineer assistant.
+    prefix: You are a helpful software engineer assistant.
     complete: true
     includeRuntimeContext: false
 
@@ -368,3 +368,4 @@
   config:
     fetch: false
     searchTimeoutMs: 60000
+
```

---

### Incident Patch 3: `51b38efb` (2026-09-08)
**Commit Message**: fix: migrate persona rows from `text:` to `prefix:` for dsh-persona 0.1.3

**File**: `combo-anchored/agent.cordis.yml` (modified, +2/-1)
```diff
@@ -50,7 +50,7 @@
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: You are a helpful software engineer assistant.
+    prefix: You are a helpful software engineer assistant.
     complete: true
     includeRuntimeContext: false
 
@@ -371,3 +371,4 @@
   config:
     fetch: false
     searchTimeoutMs: 60000
+
```

**File**: `eternal-minimal/agent.cordis.yml` (modified, +2/-1)
```diff
@@ -56,7 +56,7 @@
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: You are a helpful software engineer assistant.
+    prefix: You are a helpful software engineer assistant.
     complete: true
     includeRuntimeContext: false
 
@@ -291,3 +291,4 @@
   config:
     fetch: false
     searchTimeoutMs: 60000
+
```

**File**: `prefab/agent.cordis.yml` (modified, +2/-1)
```diff
@@ -105,7 +105,7 @@
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: You are a helpful software engineer assistant.
+    prefix: You are a helpful software engineer assistant.
     complete: true
     includeRuntimeContext: false
 
@@ -434,3 +434,4 @@
   config:
     fetch: false
     searchTimeoutMs: 60000
+
```

**File**: `preset/agent.cordis.yml` (modified, +2/-1)
```diff
@@ -99,7 +99,7 @@
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: You are a helpful software engineer assistant.
+    prefix: You are a helpful software engineer assistant.
     complete: true
     includeRuntimeContext: false
 
@@ -439,3 +439,4 @@
   config:
     fetch: false
     searchTimeoutMs: 60000
+
```

**File**: `whoami-standard/agent.cordis.yml` (modified, +2/-1)
```diff
@@ -50,7 +50,7 @@
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: You are a helpful software engineer assistant.
+    prefix: You are a helpful software engineer assistant.
     complete: true
     includeRuntimeContext: false
 
@@ -368,3 +368,4 @@
   config:
     fetch: false
     searchTimeoutMs: 60000
+
```

---

### Incident Patch 4: `44583905` (2026-09-06)
**Commit Message**: Merge pull request #88 from 324641aliyun/fix/session-snapshotEvents-compat

fix: support session.snapshotEvents() in DSH presets

**File**: `combo-anchored/compaction-epoch.mjs` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ export function createEpochPromotion(promoteEvents, options = {}) {
   const scan = (session) => {
     let boundary = -1
     let promoted = false
-    for (const event of session.events) {
+    for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
       const seq = event.seq ?? 0 // events without a seq are treated as post-boundary
       if (event.type === 'compaction/end') {
         boundary = seq
```

**File**: `combo-anchored/deliberation-gate.mjs` (modified, +2/-2)
```diff
@@ -112,8 +112,8 @@ export function apply(ctx, config) {
     let entry = state.get(session.id)
     if (entry === undefined) {
       entry = { turns: new Map(), lastTurn: -1 }
-      if (Array.isArray(session.events)) {
-        for (const event of session.events) {
+      if (Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])))) {
+        for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
           if (event.type !== 'assistant/chunk') continue
           const turn = event.data?.turn
           if (typeof turn !== 'number' || !Number.isFinite(turn)) continue
```

**File**: `combo-anchored/instruction-hint.mjs` (modified, +1/-1)
```diff
@@ -162,7 +162,7 @@ export function apply(ctx, config) {
   const hintIsDurable = (session) => {
     const known = hinted.get(session.id)
     if (known !== undefined) return known
-    const found = (Array.isArray(session.events) ? session.events : []).some((event) =>
+    const found = (Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) ? (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])) : []).some((event) =>
       event.type === 'user/message' && event.data?.source?.kind === 'instruction-hint',
     )
     hinted.set(session.id, found)
```

**File**: `combo-anchored/think-phase.mjs` (modified, +5/-5)
```diff
@@ -116,8 +116,8 @@ export function apply(ctx, config) {
     let entry = state.get(session.id)
     if (entry === undefined) {
       const steered = new Set()
-      if (Array.isArray(session.events)) {
-        for (const event of session.events) {
+      if (Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])))) {
+        for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
           if (event.type !== 'steering/message') continue
           if (event.data?.source?.plugin === name && typeof event.data?.turn === 'number') {
             steered.add(event.data.turn)
@@ -148,8 +148,8 @@ export function apply(ctx, config) {
    */
   const unlockedFor = (session) => {
     const unlocked = new Set()
-    if (session === undefined || !Array.isArray(session.events)) return unlocked
-    for (const event of session.events) {
+    if (session === undefined || !Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])))) return unlocked
+    for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
       if (event.type !== 'tool/call') continue
       if (event.data?.name !== 'dev_tool_search') continue
       let args
@@ -175,7 +175,7 @@ export function apply(ctx, config) {
     if (entry === undefined) return decision
     entry.turn = turn
     const subagent = (agent.session.header?.delegationDepth ?? 0) > 0
-    const firstUserTurn = !Array.isArray(agent.session.events) || !agent.session.events.some((event) => event.type === 'user/message')
+    const firstUserTurn = !Array.isArray((agent.session.snapshotEvents ? agent.session.snapshotEvents() : (agent.session.events ?? []))) || !(agent.session.snapshotEvents ? agent.session.snapshotEvents() : (agent.session.events ?? [])).some((event) => event.type === 'user/message')
     const think = step === 0
       && (!subagent || includeSubagents)
       && (mode === 'every-turn' || firstUserTurn)
```

**File**: `eternal-minimal/compaction-epoch.mjs` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ export function createEpochPromotion(promoteEvents, options = {}) {
   const scan = (session) => {
     let boundary = -1
     let promoted = false
-    for (const event of session.events) {
+    for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
       const seq = event.seq ?? 0 // events without a seq are treated as post-boundary
       if (event.type === 'compaction/end') {
         boundary = seq
```

---

### Incident Patch 5: `751fd674` (2026-09-05)
**Commit Message**: fix: support session.snapshotEvents() in DSH presets

DeepSeek Harness no longer exposes session.events as an array; presets
should read session history via session.snapshotEvents() when available.
Update all preset plugins and verify helpers to use snapshotEvents() with
a fallback to the older session.events API for compatibility.

**File**: `combo-anchored/compaction-epoch.mjs` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ export function createEpochPromotion(promoteEvents, options = {}) {
   const scan = (session) => {
     let boundary = -1
     let promoted = false
-    for (const event of session.events) {
+    for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
       const seq = event.seq ?? 0 // events without a seq are treated as post-boundary
       if (event.type === 'compaction/end') {
         boundary = seq
```

**File**: `combo-anchored/deliberation-gate.mjs` (modified, +2/-2)
```diff
@@ -112,8 +112,8 @@ export function apply(ctx, config) {
     let entry = state.get(session.id)
     if (entry === undefined) {
       entry = { turns: new Map(), lastTurn: -1 }
-      if (Array.isArray(session.events)) {
-        for (const event of session.events) {
+      if (Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])))) {
+        for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
           if (event.type !== 'assistant/chunk') continue
           const turn = event.data?.turn
           if (typeof turn !== 'number' || !Number.isFinite(turn)) continue
```

**File**: `combo-anchored/instruction-hint.mjs` (modified, +1/-1)
```diff
@@ -162,7 +162,7 @@ export function apply(ctx, config) {
   const hintIsDurable = (session) => {
     const known = hinted.get(session.id)
     if (known !== undefined) return known
-    const found = (Array.isArray(session.events) ? session.events : []).some((event) =>
+    const found = (Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) ? (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])) : []).some((event) =>
       event.type === 'user/message' && event.data?.source?.kind === 'instruction-hint',
     )
     hinted.set(session.id, found)
```

**File**: `combo-anchored/think-phase.mjs` (modified, +5/-5)
```diff
@@ -116,8 +116,8 @@ export function apply(ctx, config) {
     let entry = state.get(session.id)
     if (entry === undefined) {
       const steered = new Set()
-      if (Array.isArray(session.events)) {
-        for (const event of session.events) {
+      if (Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])))) {
+        for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
           if (event.type !== 'steering/message') continue
           if (event.data?.source?.plugin === name && typeof event.data?.turn === 'number') {
             steered.add(event.data.turn)
@@ -148,8 +148,8 @@ export function apply(ctx, config) {
    */
   const unlockedFor = (session) => {
     const unlocked = new Set()
-    if (session === undefined || !Array.isArray(session.events)) return unlocked
-    for (const event of session.events) {
+    if (session === undefined || !Array.isArray((session.snapshotEvents ? session.snapshotEvents() : (session.events ?? [])))) return unlocked
+    for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
       if (event.type !== 'tool/call') continue
       if (event.data?.name !== 'dev_tool_search') continue
       let args
@@ -175,7 +175,7 @@ export function apply(ctx, config) {
     if (entry === undefined) return decision
     entry.turn = turn
     const subagent = (agent.session.header?.delegationDepth ?? 0) > 0
-    const firstUserTurn = !Array.isArray(agent.session.events) || !agent.session.events.some((event) => event.type === 'user/message')
+    const firstUserTurn = !Array.isArray((agent.session.snapshotEvents ? agent.session.snapshotEvents() : (agent.session.events ?? []))) || !(agent.session.snapshotEvents ? agent.session.snapshotEvents() : (agent.session.events ?? [])).some((event) => event.type === 'user/message')
     const think = step === 0
       && (!subagent || includeSubagents)
       && (mode === 'every-turn' || firstUserTurn)
```

**File**: `eternal-minimal/compaction-epoch.mjs` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ export function createEpochPromotion(promoteEvents, options = {}) {
   const scan = (session) => {
     let boundary = -1
     let promoted = false
-    for (const event of session.events) {
+    for (const event of (session.snapshotEvents ? session.snapshotEvents() : (session.events ?? []))) {
       const seq = event.seq ?? 0 // events without a seq are treated as post-boundary
       if (event.type === 'compaction/end') {
         boundary = seq
```

---

### Incident Patch 6: `46f53e4d` (2026-08-26)
**Commit Message**: docs: acknowledge the prefab seeding and dev-tool-search fixes (#77,#80)

**File**: `ACKNOWLEDGEMENTS.md` (modified, +3/-1)
```diff
@@ -26,6 +26,8 @@
 - [@DuduluTkmttt](https://github.com/DuduluTkmttt)——定位 rc.6 上 dev_tool_search 因注册表作用域变化而失效的问题（[#32](https://github.com/xiaobright/dsh-anchored-standard/issues/32)、[#31](https://github.com/xiaobright/dsh-anchored-standard/pull/31)，修复随 a2e7d6a 落地）。
 - [@HongzhongL](https://github.com/HongzhongL)——贡献 fork-safe 目录控制与 Windows Git Bash 套件（[#34](https://github.com/xiaobright/dsh-anchored-standard/pull/34)；Windows 部分先后经 [#33](https://github.com/xiaobright/dsh-anchored-standard/pull/33)、[#44](https://github.com/xiaobright/dsh-anchored-standard/pull/44)、[#72](https://github.com/xiaobright/dsh-anchored-standard/pull/72) 落地）。
 - [@hongshuxifan321](https://github.com/hongshuxifan321)——复现 instruction-hint 跨重启重复注入与确定性 id 碰撞，给出唯一 id 容错修复、日志清理配方与排障文档（[#76](https://github.com/xiaobright/dsh-anchored-standard/issues/76)、[#79](https://github.com/xiaobright/dsh-anchored-standard/pull/79)）。
+- [@UraraO](https://github.com/UraraO)——修复默认 preset 直接创建的会话跳过轨迹预填充的问题，以 `permission/preset` 作为 born 路径的可靠触发点并堵上 await 后的 agent 竞态（[#77](https://github.com/xiaobright/dsh-anchored-standard/pull/77)）。
+- [@gwL955](https://github.com/gwL955)——以真实会话日志定位 dev_tool_search 全 token AND 匹配导致长查询必然空结果、模型只搜不解锁的双重缺陷，给出模糊打分排序与解锁路径教学的修复及回归测试（[#80](https://github.com/xiaobright/dsh-anchored-standard/pull/80)，在 [#31](https://github.com/xiaobright/dsh-anchored-standard/pull/31)、[#32](https://github.com/xiaobright/dsh-anchored-standard/issues/32) 的基础上推进）。
 
 ## 研究与独立复现
 
@@ -39,4 +41,4 @@
 
 完整记录可在 [Contributors](https://github.com/xiaobright/dsh-anchored-standard/graphs/contributors)、[Pull Requests](https://github.com/xiaobright/dsh-anchored-standard/pulls?q=is%3Apr) 和 [Issues](https://github.com/xiaobright/dsh-anchored-standard/issues?q=is%3Aissue) 中查阅；实验材料与研究贡献见 [DeepseekCotexplorations](https://github.com/0liveiraaa/DeepseekCotexplorations)。
 
-> 统计截至 2026-08-24：主仓库共有 22 个已合并 PR，其中包括 14 位外部 PR 作者；此外还有通过协作分支、审查合并和研究仓库参与项目的贡献者。GitHub 账号与本地 Git 作者邮箱的映射可能造成贡献计数差异，因此这里以可核验的实际贡献内容为主，而不是按 commit 数量排序。
+> 统计截至 2026-08-26：主仓库共有 24 个已合并 PR，其中包括 16 位外部 PR 作者；此外还有通过协作分支、审查合并和研究仓库参与项目的贡献者。GitHub 账号与本地 Git 作者邮箱的映射可能造成贡献计数差异，因此这里以可核验的实际贡献内容为主，而不是按 commit 数量排序。
```

---

### Incident Patch 7: `1ca8da98` (2026-08-26)
**Commit Message**: Merge pull request #80 from gwL955/fix/dev-tool-search-fuzzy-match

fix(dev-tool-search): fuzzy token scoring + teach the toolNames unlock path (#32)

**File**: `combo-anchored/dev-tool-search.mjs` (modified, +37/-11)
```diff
@@ -16,6 +16,14 @@
  * set cannot do: the model should reach for dev_tool_search the moment a task
  * needs internet, delegation, workflows, goals, images, background jobs, or
  * multi-agent coordination — not try to work around them with bash.
+ *
+ * FIX (local): search matching was AND-over-all-tokens, so a long natural
+ * query ("file edit write replace script root permissions") matched NOTHING
+ * even against the full catalog. Now: exact name match wins, then tools
+ * matching at least one token ranked by hit count. The description also
+ * teaches the unlock path explicitly ("search empty ≠ tool absent — unlock
+ * by exact toolNames"), because models observed in the wild only search and
+ * never pass toolNames.
  */
 
 /** Cordis plugin name used by loader diagnostics. */
@@ -71,6 +79,9 @@ export function apply(ctx) {
       ...UNLOCKABLE_INDEX.map((line) => `- ${line}`),
       '',
       'Usage: pass `query` to search the catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them. Unlocked tools appear from the next request on and stay unlocked for the session.',
+      '',
+      'Example: dev_tool_search({"query":"web","toolNames":["web_search"]}) — search AND unlock in one call.',
+      'IMPORTANT: an empty search result does NOT mean the tool does not exist — it only means no tool matched ALL of your keywords. If the task needs any tool listed above, unlock it directly by exact name: dev_tool_search({"toolNames":["web_search"]}). Prefer short 1-2 keyword queries.',
     ].join('\n'),
     parameters: toJsonSchema({
       query: { type: 'string', required: false, description: 'search keywords (e.g. "web", "subagent")' },
@@ -104,20 +115,35 @@ export function apply(ctx) {
         // harness's own code mode (`registry.schemas(exec.agent)`).
         const schemas = ctx.tools.schemas(exec?.agent)
         const wanted = query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
-        const all = schemas.filter((schema) => {
-          const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
-          return wanted.every((token) => haystack.includes(token))
-        })
-        const matches = all.slice(0, MAX_RESULTS)
-        if (all.length === 0) {
-          lines.push(`No tools match "${query}".`)
+        // FIX: score instead of AND-filter. Exact name match ranks first;
+        // otherwise every tool matching at least one token competes, ordered
+        // by hit count (desc) then name. A long natural-language query no
+        // longer returns an empty catalog.
+        const scored = schemas
+          .map((schema) => {
+            const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
+            let score = 0
+            for (const token of wanted) if (haystack.includes(token)) score += 1
+            return {
+              schema,
+              score,
+              exact: wanted.includes(schema.name.toLowerCase()),
+            }
+          })
+          .filter((entry) => wanted.length > 0 && (entry.exact || entry.score >= 1))
+          .sort((a, b) => (b.exact - a.exact) || (b.score - a.score) || a.schema.name.localeCompare(b.schema.name))
+        const matches = scored.slice(0, MAX_RESULTS)
+        if (matches.length === 0) {
+          lines.push(
+            `No tools match "${query}". An empty result only means no tool matched ALL keywords — if you need a specific tool, unlock it directly by exact name, e.g. dev_tool_search({"toolNames":["web_search"]}).`,
+          )
         } else {
-          lines.push(`Matching tools (${matches.length}${all.length > MAX_RESULTS ? ` of ${all.length}` : ''}):`)
-          for (const schema of matches) {
+          lines.push(`Matching tools (${matches.length}${scored.length > MAX_RESULTS ? ` of ${scored.length}` : ''}):`)
+          for (const { schema, exact, score } of matches) {
             const desc = (schema.description || '').split('\n')[0].s
```

**File**: `prefab/dev-tool-search.mjs` (modified, +37/-11)
```diff
@@ -16,6 +16,14 @@
  * set cannot do: the model should reach for dev_tool_search the moment a task
  * needs internet, delegation, workflows, goals, images, background jobs, or
  * multi-agent coordination — not try to work around them with bash.
+ *
+ * FIX (local): search matching was AND-over-all-tokens, so a long natural
+ * query ("file edit write replace script root permissions") matched NOTHING
+ * even against the full catalog. Now: exact name match wins, then tools
+ * matching at least one token ranked by hit count. The description also
+ * teaches the unlock path explicitly ("search empty ≠ tool absent — unlock
+ * by exact toolNames"), because models observed in the wild only search and
+ * never pass toolNames.
  */
 
 /** Cordis plugin name used by loader diagnostics. */
@@ -71,6 +79,9 @@ export function apply(ctx) {
       ...UNLOCKABLE_INDEX.map((line) => `- ${line}`),
       '',
       'Usage: pass `query` to search the catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them. Unlocked tools appear from the next request on and stay unlocked for the session.',
+      '',
+      'Example: dev_tool_search({"query":"web","toolNames":["web_search"]}) — search AND unlock in one call.',
+      'IMPORTANT: an empty search result does NOT mean the tool does not exist — it only means no tool matched ALL of your keywords. If the task needs any tool listed above, unlock it directly by exact name: dev_tool_search({"toolNames":["web_search"]}). Prefer short 1-2 keyword queries.',
     ].join('\n'),
     parameters: toJsonSchema({
       query: { type: 'string', required: false, description: 'search keywords (e.g. "web", "subagent")' },
@@ -104,20 +115,35 @@ export function apply(ctx) {
         // harness's own code mode (`registry.schemas(exec.agent)`).
         const schemas = ctx.tools.schemas(exec?.agent)
         const wanted = query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
-        const all = schemas.filter((schema) => {
-          const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
-          return wanted.every((token) => haystack.includes(token))
-        })
-        const matches = all.slice(0, MAX_RESULTS)
-        if (all.length === 0) {
-          lines.push(`No tools match "${query}".`)
+        // FIX: score instead of AND-filter. Exact name match ranks first;
+        // otherwise every tool matching at least one token competes, ordered
+        // by hit count (desc) then name. A long natural-language query no
+        // longer returns an empty catalog.
+        const scored = schemas
+          .map((schema) => {
+            const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
+            let score = 0
+            for (const token of wanted) if (haystack.includes(token)) score += 1
+            return {
+              schema,
+              score,
+              exact: wanted.includes(schema.name.toLowerCase()),
+            }
+          })
+          .filter((entry) => wanted.length > 0 && (entry.exact || entry.score >= 1))
+          .sort((a, b) => (b.exact - a.exact) || (b.score - a.score) || a.schema.name.localeCompare(b.schema.name))
+        const matches = scored.slice(0, MAX_RESULTS)
+        if (matches.length === 0) {
+          lines.push(
+            `No tools match "${query}". An empty result only means no tool matched ALL keywords — if you need a specific tool, unlock it directly by exact name, e.g. dev_tool_search({"toolNames":["web_search"]}).`,
+          )
         } else {
-          lines.push(`Matching tools (${matches.length}${all.length > MAX_RESULTS ? ` of ${all.length}` : ''}):`)
-          for (const schema of matches) {
+          lines.push(`Matching tools (${matches.length}${scored.length > MAX_RESULTS ? ` of ${scored.length}` : ''}):`)
+          for (const { schema, exact, score } of matches) {
             const desc = (schema.description || '').split('\n')[0].s
```

**File**: `preset/dev-tool-search.mjs` (modified, +37/-11)
```diff
@@ -16,6 +16,14 @@
  * set cannot do: the model should reach for dev_tool_search the moment a task
  * needs internet, delegation, workflows, goals, images, background jobs, or
  * multi-agent coordination — not try to work around them with bash.
+ *
+ * FIX (local): search matching was AND-over-all-tokens, so a long natural
+ * query ("file edit write replace script root permissions") matched NOTHING
+ * even against the full catalog. Now: exact name match wins, then tools
+ * matching at least one token ranked by hit count. The description also
+ * teaches the unlock path explicitly ("search empty ≠ tool absent — unlock
+ * by exact toolNames"), because models observed in the wild only search and
+ * never pass toolNames.
  */
 
 /** Cordis plugin name used by loader diagnostics. */
@@ -71,6 +79,9 @@ export function apply(ctx) {
       ...UNLOCKABLE_INDEX.map((line) => `- ${line}`),
       '',
       'Usage: pass `query` to search the catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them. Unlocked tools appear from the next request on and stay unlocked for the session.',
+      '',
+      'Example: dev_tool_search({"query":"web","toolNames":["web_search"]}) — search AND unlock in one call.',
+      'IMPORTANT: an empty search result does NOT mean the tool does not exist — it only means no tool matched ALL of your keywords. If the task needs any tool listed above, unlock it directly by exact name: dev_tool_search({"toolNames":["web_search"]}). Prefer short 1-2 keyword queries.',
     ].join('\n'),
     parameters: toJsonSchema({
       query: { type: 'string', required: false, description: 'search keywords (e.g. "web", "subagent")' },
@@ -104,20 +115,35 @@ export function apply(ctx) {
         // harness's own code mode (`registry.schemas(exec.agent)`).
         const schemas = ctx.tools.schemas(exec?.agent)
         const wanted = query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
-        const all = schemas.filter((schema) => {
-          const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
-          return wanted.every((token) => haystack.includes(token))
-        })
-        const matches = all.slice(0, MAX_RESULTS)
-        if (all.length === 0) {
-          lines.push(`No tools match "${query}".`)
+        // FIX: score instead of AND-filter. Exact name match ranks first;
+        // otherwise every tool matching at least one token competes, ordered
+        // by hit count (desc) then name. A long natural-language query no
+        // longer returns an empty catalog.
+        const scored = schemas
+          .map((schema) => {
+            const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
+            let score = 0
+            for (const token of wanted) if (haystack.includes(token)) score += 1
+            return {
+              schema,
+              score,
+              exact: wanted.includes(schema.name.toLowerCase()),
+            }
+          })
+          .filter((entry) => wanted.length > 0 && (entry.exact || entry.score >= 1))
+          .sort((a, b) => (b.exact - a.exact) || (b.score - a.score) || a.schema.name.localeCompare(b.schema.name))
+        const matches = scored.slice(0, MAX_RESULTS)
+        if (matches.length === 0) {
+          lines.push(
+            `No tools match "${query}". An empty result only means no tool matched ALL keywords — if you need a specific tool, unlock it directly by exact name, e.g. dev_tool_search({"toolNames":["web_search"]}).`,
+          )
         } else {
-          lines.push(`Matching tools (${matches.length}${all.length > MAX_RESULTS ? ` of ${all.length}` : ''}):`)
-          for (const schema of matches) {
+          lines.push(`Matching tools (${matches.length}${scored.length > MAX_RESULTS ? ` of ${scored.length}` : ''}):`)
+          for (const { schema, exact, score } of matches) {
             const desc = (schema.description || '').split('\n')[0].s
```

**File**: `shared/dev-tool-search.mjs` (modified, +37/-11)
```diff
@@ -16,6 +16,14 @@
  * set cannot do: the model should reach for dev_tool_search the moment a task
  * needs internet, delegation, workflows, goals, images, background jobs, or
  * multi-agent coordination — not try to work around them with bash.
+ *
+ * FIX (local): search matching was AND-over-all-tokens, so a long natural
+ * query ("file edit write replace script root permissions") matched NOTHING
+ * even against the full catalog. Now: exact name match wins, then tools
+ * matching at least one token ranked by hit count. The description also
+ * teaches the unlock path explicitly ("search empty ≠ tool absent — unlock
+ * by exact toolNames"), because models observed in the wild only search and
+ * never pass toolNames.
  */
 
 /** Cordis plugin name used by loader diagnostics. */
@@ -71,6 +79,9 @@ export function apply(ctx) {
       ...UNLOCKABLE_INDEX.map((line) => `- ${line}`),
       '',
       'Usage: pass `query` to search the catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them. Unlocked tools appear from the next request on and stay unlocked for the session.',
+      '',
+      'Example: dev_tool_search({"query":"web","toolNames":["web_search"]}) — search AND unlock in one call.',
+      'IMPORTANT: an empty search result does NOT mean the tool does not exist — it only means no tool matched ALL of your keywords. If the task needs any tool listed above, unlock it directly by exact name: dev_tool_search({"toolNames":["web_search"]}). Prefer short 1-2 keyword queries.',
     ].join('\n'),
     parameters: toJsonSchema({
       query: { type: 'string', required: false, description: 'search keywords (e.g. "web", "subagent")' },
@@ -104,20 +115,35 @@ export function apply(ctx) {
         // harness's own code mode (`registry.schemas(exec.agent)`).
         const schemas = ctx.tools.schemas(exec?.agent)
         const wanted = query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
-        const all = schemas.filter((schema) => {
-          const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
-          return wanted.every((token) => haystack.includes(token))
-        })
-        const matches = all.slice(0, MAX_RESULTS)
-        if (all.length === 0) {
-          lines.push(`No tools match "${query}".`)
+        // FIX: score instead of AND-filter. Exact name match ranks first;
+        // otherwise every tool matching at least one token competes, ordered
+        // by hit count (desc) then name. A long natural-language query no
+        // longer returns an empty catalog.
+        const scored = schemas
+          .map((schema) => {
+            const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
+            let score = 0
+            for (const token of wanted) if (haystack.includes(token)) score += 1
+            return {
+              schema,
+              score,
+              exact: wanted.includes(schema.name.toLowerCase()),
+            }
+          })
+          .filter((entry) => wanted.length > 0 && (entry.exact || entry.score >= 1))
+          .sort((a, b) => (b.exact - a.exact) || (b.score - a.score) || a.schema.name.localeCompare(b.schema.name))
+        const matches = scored.slice(0, MAX_RESULTS)
+        if (matches.length === 0) {
+          lines.push(
+            `No tools match "${query}". An empty result only means no tool matched ALL keywords — if you need a specific tool, unlock it directly by exact name, e.g. dev_tool_search({"toolNames":["web_search"]}).`,
+          )
         } else {
-          lines.push(`Matching tools (${matches.length}${all.length > MAX_RESULTS ? ` of ${all.length}` : ''}):`)
-          for (const schema of matches) {
+          lines.push(`Matching tools (${matches.length}${scored.length > MAX_RESULTS ? ` of ${scored.length}` : ''}):`)
+          for (const { schema, exact, score } of matches) {
             const desc = (schema.description || '').split('\n')[0].s
```

**File**: `test/dev-tool-search.test.mjs` (modified, +22/-1)
```diff
@@ -95,5 +95,26 @@ test('schemas() is queried with the executing agent as the viewing scope (issue
   const result = await ctx.tools.registered.execute({ query: 'pwsh' }, { agent })
   assert.equal(calls.length, 1)
   assert.equal(calls[0], agent, 'the executing agent is the viewing scope, so agent-scoped preset tools are visible')
-  assert.match(result.text, /pwsh: Execute a PowerShell command/)
+  assert.match(result.text, /pwsh.*Execute a PowerShell command/)
+})
+
+test('long natural-language query returns the most relevant tools (fuzzy scoring, not AND)', async () => {
+  const { registered } = register([
+    { name: 'web_search', description: 'internet search and web retrieval' },
+    { name: 'write', description: 'write files' },
+    { name: 'str_replace_editor', description: 'viewing, creating and editing files' },
+    { name: 'bash', description: 'run commands' },
+  ])
+  const tool = registered.find((t) => t.name === 'dev_tool_search')
+  const result = await tool.execute({ query: 'file edit write replace script root permissions' }, exec())
+  assert.match(result.text, /write/, 'long query must not return "No tools match" when tools match some tokens')
+  assert.doesNotMatch(result.text, /No tools match/)
+})
+
+test('empty search result teaches the direct unlock path (toolNames)', async () => {
+  const { registered } = register([{ name: 'bash', description: 'run commands' }])
+  const tool = registered.find((t) => t.name === 'dev_tool_search')
+  const result = await tool.execute({ query: 'zzz-nothing' }, exec())
+  assert.match(result.text, /No tools match/)
+  assert.match(result.text, /toolNames/)
 })
```

---

### Incident Patch 8: `f1265938` (2026-08-26)
**Commit Message**: Merge pull request #77 from UraraO/fix/seed-default-preset-sessions

fix(prefab): 默认 preset 直接创建的会话不再跳过轨迹预填充

**File**: `README.md` (modified, +2/-1)
```diff
@@ -361,7 +361,8 @@ repository is self-contained: the `zero-anchored-standard/`,
 `whoami-standard/`, `prefab/`, `eternal-minimal/`, `wire-think-standard/`, and
 `combo-anchored/` variants install the same way, alone or together, with no
 other directory required (see their sections below). `prefab/` automatically
-hydrates newly selected sessions; follow [`prefab/README.md`](./prefab/README.md).
+hydrates both sessions switched to it and sessions created with it as the
+default preset; follow [`prefab/README.md`](./prefab/README.md).
 
 PowerShell:
 
```

**File**: `README.zh-CN.md` (modified, +2/-1)
```diff
@@ -302,7 +302,8 @@ Prefab 模式推荐由 AI agent 一键安装：把本仓库交给编程 agent，
 `anchored-standard`。仓库中的每个模式目录都是自包含的：`zero-anchored-standard/`、
 `whoami-standard/`、`prefab/`、`eternal-minimal/`、`wire-think-standard/`、
 `combo-anchored/` 变体以同样方式安装，可只装其中一个、多个或全部，不依赖
-其他目录（见下文各自的章节）。`prefab/` 选择模式时会自动预填充内置模板；
+其他目录（见下文各自的章节）。`prefab/` 会为手动切换到该模式的会话，以及创建时
+已将其作为默认 preset 的会话自动预填充内置模板；
 按 [`prefab/README.md`](./prefab/README.md) 操作。
 
 PowerShell：
```

**File**: `prefab/README.md` (modified, +6/-3)
```diff
@@ -36,8 +36,10 @@ node .\prefab\install.mjs --confirm-dsh-closed --template project2
 
 This installs **Prefab Anchored Project2** as `prefab-anchored-project2`.
 
-Harness creates a blank session before mounting a selected preset. The bundled
-`prefab-session-seed.mjs` observes the committed preset selection, crosses the
+Harness can either mount this preset onto a blank session or create a session
+whose header already names it as the default preset. The bundled
+`prefab-session-seed.mjs` observes the committed preset selection in the first
+case and the first `permission/preset` event in the second, crosses the
 non-reentrant `Session.append` boundary with one microtask, and replays the two
 model-visible warm-up turns into that same session. It omits thousands of token
 stream chunks while retaining lifecycle events, messages, tool calls/results,
@@ -118,7 +120,8 @@ or profile can still be discovered and unlocked at runtime through
 - `template.jsonl`: the reviewed, bundled session template.
 - `template.jsonl.meta.json`: roll provenance and trajectory summary.
 - `templates/project2-benchmark.jsonl`: explicit opt-in benchmark template.
-- `prefab-session-seed.mjs`: automatic in-place hydration on mode selection.
+- `prefab-session-seed.mjs`: automatic in-place hydration on mode selection or
+  default-preset session creation.
 - `install.mjs`: one-command mode installation.
 - `instantiate.mjs`: legacy offline workspace-specific session instantiation.
 - `roll-runner.mjs` and `roll-prefab.mjs`: optional tooling for producing a
```

**File**: `prefab/prefab-session-seed.mjs` (modified, +20/-3)
```diff
@@ -452,7 +452,17 @@ export function apply(ctx, config = {}) {
   const scheduled = new WeakSet()
 
   ctx.on('session/event', (session, event) => {
-    if (event.type !== 'agent-preset/selected' || event.data?.agentPreset !== presetId) return
+    // Trigger on either of two lifecycle events:
+    // 1. `agent-preset/selected` — the preset picker swapped THIS preset onto
+    //    an already-created blank session (the original trigger).
+    // 2. A session CREATED with this preset in its header (the default preset
+    //    path) never emits `agent-preset/selected` — the preset is composed at
+    //    creation, not swapped. Its first `permission/preset` event therefore
+    //    doubles as the "this preset is live" signal: seed on it too, so
+    //    default-preset sessions start from turn 3 instead of turn 1.
+    const selected = event.type === 'agent-preset/selected' && event.data?.agentPreset === presetId
+    const born = event.type === 'permission/preset' && session.header?.agentPreset === presetId
+    if (!selected && !born) return
     if (scheduled.has(session) || session.events.some((item) => item.type === 'turn/start')) return
     scheduled.add(session)
 
@@ -470,7 +480,10 @@ export function apply(ctx, config = {}) {
           // ReactLoopAgent snapshots the final turn in its constructor. Preset
           // selection happens later, so validate that cursor before appending a
           // lifecycle transcript and synchronize it immediately afterwards.
-          synchronizeAgentTurnCursor(agent, session)
+          // The agent may not exist yet on the born path (creation is still
+          // assembling the session) — skip cursor sync until it does; the
+          // turn/start guard keeps a later double-seed from firing.
+          if (agent !== undefined) synchronizeAgentTurnCursor(agent, session)
           const cwd = session.header?.cwd
           const agentsMd = loadInstructionBundle(cwd)
           const preliminary = buildSeedPlan(template, cwd, agentsMd)
@@ -479,7 +492,11 @@ export function apply(ctx, config = {}) {
             ? buildSeedPlan(template, cwd, agentsMd, skillResults)
             : preliminary
           if (seedSession(session, plan, title)) {
-            synchronizeAgentTurnCursor(agent, session)
+            // The default-preset path may publish its agent while the skill
+            // registry is being queried. Re-read after the await so an agent
+            // created in that window receives the seeded turn cursor.
+            const currentAgent = ctx.get('agents')?.get(session.id)
+            if (currentAgent !== undefined) synchronizeAgentTurnCursor(currentAgent, session)
           }
         } catch (error) {
           ctx.logger?.error?.(`${name}: failed to seed session ${session.id}: ${String(error?.stack ?? error)}`)
```

**File**: `test/prefab-session-seed.test.mjs` (modified, +90/-0)
```diff
@@ -134,6 +134,96 @@ test('preset selection seeds after publication and ignores other or nonblank ses
   }
 })
 
+test('session created with the preset as default seeds on its first permission event', async () => {
+  const dir = mkdtempSync(join(tmpdir(), 'dsh-prefab-born-'))
+  try {
+    const handlers = new Map()
+    const errors = []
+    const ctx = {
+      on(type, callback) { handlers.set(type, callback) },
+      get(service) { return service === 'agents' ? this.agents : undefined },
+      logger: { error(message) { errors.push(message) } },
+    }
+    // A session CREATED with the preset: the header names it, and no
+    // agent-preset/selected event is ever emitted. The first
+    // permission/preset event must trigger seeding (agent may not exist yet).
+    const session = fakeSession(dir)
+    session.header.agentPreset = 'prefab-anchored-standard'
+    ctx.agents = { get(id) { return id === session.id ? undefined : undefined } }
+    apply(ctx, { templatePath: fixture(dir) })
+
+    session.listener = handlers.get('session/event')
+    session.append('permission/preset', { preset: 'workspace-write' })
+    await settle()
+    assert.equal(session.events.some((event) => event.type === 'turn/start'), true, 'born session must be seeded')
+    assert.equal(session.events.at(-1).data.title, 'Prefab Anchored Standard - Ready')
+    assert.deepEqual(errors, [], 'no agent on the born path must not error')
+
+    // The turn/start guard must prevent a later double-seed.
+    const countAfterFirst = session.events.filter((event) => event.type === 'turn/start').length
+    session.append('permission/preset', { preset: 'workspace-write' })
+    await settle()
+    assert.equal(session.events.filter((event) => event.type === 'turn/start').length, countAfterFirst, 'no double-seed')
+  } finally {
+    rmSync(dir, { recursive: true, force: true })
+  }
+})
+
+test('default-preset seeding synchronizes an agent published while skills are loading', async () => {
+  const dir = mkdtempSync(join(tmpdir(), 'dsh-prefab-born-race-'))
+  try {
+    const handlers = new Map()
+    let publishSkills
+    const skillsReady = new Promise((resolve) => { publishSkills = resolve })
+    let agent
+    const ctx = {
+      on(type, callback) { handlers.set(type, callback) },
+      get(service) {
+        if (service === 'agents') return { get() { return agent } }
+        if (service === 'skills') return { async list() { await skillsReady; return [] } }
+        return undefined
+      },
+      logger: { error(error) { throw new Error(error) } },
+    }
+    const session = fakeSession(dir)
+    session.header.agentPreset = 'prefab-anchored-standard'
+    apply(ctx, { templatePath: fixture(dir) })
+    session.listener = handlers.get('session/event')
+
+    session.append('permission/preset', { preset: 'workspace-write' })
+    await Promise.resolve()
+    agent = { session, status: 'idle', phase: { kind: 'idle', lastTurn: 0 } }
+    publishSkills()
+    await settle()
+
+    assert.equal(agent.phase.lastTurn, 1, 'late-published agent must see the seeded turn')
+    assert.equal(agent.phase.lastTurn + 1, 2)
+  } finally {
+    rmSync(dir, { recursive: true, force: true })
+  }
+})
+
+test('session with a different preset header ignores permission events', async () => {
+  const dir = mkdtempSync(join(tmpdir(), 'dsh-prefab-born-other-'))
+  try {
+    const handlers = new Map()
+    const ctx = {
+      on(type, callback) { handlers.set(type, callback) },
+      get() { return undefined },
+      logger: { error() {} },
+    }
+    const session = fakeSession(dir)
+    session.header.agentPreset = 'standard'
+    apply(ctx, { templatePath: fixture(dir) })
+    session.listener = handlers.get('session/event')
+    session.append('permission/preset', { preset: 'workspace-write' })
+    await settle()
+    assert.equal(session.events.some((event) => event.type === 'turn/start'), false, 'other preset must not seed')
+  } finally {
+    rmSyn
```

---

### Incident Patch 9: `34a17790` (2026-08-25)
**Commit Message**: fix(dev-tool-search): fuzzy token scoring + teach the toolNames unlock path

Two defects made the on-demand unlock chain fail in real sessions even
after the rc.6 scope fix (issue #32, PR #31):

1. Search was AND-over-all-tokens (`wanted.every(...)`): a long
   natural-language query such as "file edit write replace script root
   permissions" (observed in a real session log) requires every token to
   appear in a tool's name+description, so it ALWAYS returned
   "No tools match" even against the full catalog. Replace with fuzzy
   scoring: exact name match ranks first, then tools matching at least
   one token, ordered by hit count. The same query now returns write
   (exact), edit (exact), str_replace_editor, etc.

2. Models observed in the wild only ever pass `query`, never `toolNames`,
   so `tool-bootstrap`'s unlockedFor() never sees an unlock and the
   resident catalog never grows. Teach the unlock path explicitly in the
   tool description: a one-call example (search + unlock), and a note
   that an empty result does not mean the tool is absent.

Verified: 211/211 tests pass (2 new regression tests for the long-query
and unlock-hint behavior); sync-modes --check clean. End-

**File**: `combo-anchored/dev-tool-search.mjs` (modified, +37/-11)
```diff
@@ -16,6 +16,14 @@
  * set cannot do: the model should reach for dev_tool_search the moment a task
  * needs internet, delegation, workflows, goals, images, background jobs, or
  * multi-agent coordination — not try to work around them with bash.
+ *
+ * FIX (local): search matching was AND-over-all-tokens, so a long natural
+ * query ("file edit write replace script root permissions") matched NOTHING
+ * even against the full catalog. Now: exact name match wins, then tools
+ * matching at least one token ranked by hit count. The description also
+ * teaches the unlock path explicitly ("search empty ≠ tool absent — unlock
+ * by exact toolNames"), because models observed in the wild only search and
+ * never pass toolNames.
  */
 
 /** Cordis plugin name used by loader diagnostics. */
@@ -71,6 +79,9 @@ export function apply(ctx) {
       ...UNLOCKABLE_INDEX.map((line) => `- ${line}`),
       '',
       'Usage: pass `query` to search the catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them. Unlocked tools appear from the next request on and stay unlocked for the session.',
+      '',
+      'Example: dev_tool_search({"query":"web","toolNames":["web_search"]}) — search AND unlock in one call.',
+      'IMPORTANT: an empty search result does NOT mean the tool does not exist — it only means no tool matched ALL of your keywords. If the task needs any tool listed above, unlock it directly by exact name: dev_tool_search({"toolNames":["web_search"]}). Prefer short 1-2 keyword queries.',
     ].join('\n'),
     parameters: toJsonSchema({
       query: { type: 'string', required: false, description: 'search keywords (e.g. "web", "subagent")' },
@@ -104,20 +115,35 @@ export function apply(ctx) {
         // harness's own code mode (`registry.schemas(exec.agent)`).
         const schemas = ctx.tools.schemas(exec?.agent)
         const wanted = query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
-        const all = schemas.filter((schema) => {
-          const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
-          return wanted.every((token) => haystack.includes(token))
-        })
-        const matches = all.slice(0, MAX_RESULTS)
-        if (all.length === 0) {
-          lines.push(`No tools match "${query}".`)
+        // FIX: score instead of AND-filter. Exact name match ranks first;
+        // otherwise every tool matching at least one token competes, ordered
+        // by hit count (desc) then name. A long natural-language query no
+        // longer returns an empty catalog.
+        const scored = schemas
+          .map((schema) => {
+            const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
+            let score = 0
+            for (const token of wanted) if (haystack.includes(token)) score += 1
+            return {
+              schema,
+              score,
+              exact: wanted.includes(schema.name.toLowerCase()),
+            }
+          })
+          .filter((entry) => wanted.length > 0 && (entry.exact || entry.score >= 1))
+          .sort((a, b) => (b.exact - a.exact) || (b.score - a.score) || a.schema.name.localeCompare(b.schema.name))
+        const matches = scored.slice(0, MAX_RESULTS)
+        if (matches.length === 0) {
+          lines.push(
+            `No tools match "${query}". An empty result only means no tool matched ALL keywords — if you need a specific tool, unlock it directly by exact name, e.g. dev_tool_search({"toolNames":["web_search"]}).`,
+          )
         } else {
-          lines.push(`Matching tools (${matches.length}${all.length > MAX_RESULTS ? ` of ${all.length}` : ''}):`)
-          for (const schema of matches) {
+          lines.push(`Matching tools (${matches.length}${scored.length > MAX_RESULTS ? ` of ${scored.length}` : ''}):`)
+          for (const { schema, exact, score } of matches) {
             const desc = (schema.description || '').split('\n')[0].s
```

**File**: `prefab/dev-tool-search.mjs` (modified, +37/-11)
```diff
@@ -16,6 +16,14 @@
  * set cannot do: the model should reach for dev_tool_search the moment a task
  * needs internet, delegation, workflows, goals, images, background jobs, or
  * multi-agent coordination — not try to work around them with bash.
+ *
+ * FIX (local): search matching was AND-over-all-tokens, so a long natural
+ * query ("file edit write replace script root permissions") matched NOTHING
+ * even against the full catalog. Now: exact name match wins, then tools
+ * matching at least one token ranked by hit count. The description also
+ * teaches the unlock path explicitly ("search empty ≠ tool absent — unlock
+ * by exact toolNames"), because models observed in the wild only search and
+ * never pass toolNames.
  */
 
 /** Cordis plugin name used by loader diagnostics. */
@@ -71,6 +79,9 @@ export function apply(ctx) {
       ...UNLOCKABLE_INDEX.map((line) => `- ${line}`),
       '',
       'Usage: pass `query` to search the catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them. Unlocked tools appear from the next request on and stay unlocked for the session.',
+      '',
+      'Example: dev_tool_search({"query":"web","toolNames":["web_search"]}) — search AND unlock in one call.',
+      'IMPORTANT: an empty search result does NOT mean the tool does not exist — it only means no tool matched ALL of your keywords. If the task needs any tool listed above, unlock it directly by exact name: dev_tool_search({"toolNames":["web_search"]}). Prefer short 1-2 keyword queries.',
     ].join('\n'),
     parameters: toJsonSchema({
       query: { type: 'string', required: false, description: 'search keywords (e.g. "web", "subagent")' },
@@ -104,20 +115,35 @@ export function apply(ctx) {
         // harness's own code mode (`registry.schemas(exec.agent)`).
         const schemas = ctx.tools.schemas(exec?.agent)
         const wanted = query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
-        const all = schemas.filter((schema) => {
-          const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
-          return wanted.every((token) => haystack.includes(token))
-        })
-        const matches = all.slice(0, MAX_RESULTS)
-        if (all.length === 0) {
-          lines.push(`No tools match "${query}".`)
+        // FIX: score instead of AND-filter. Exact name match ranks first;
+        // otherwise every tool matching at least one token competes, ordered
+        // by hit count (desc) then name. A long natural-language query no
+        // longer returns an empty catalog.
+        const scored = schemas
+          .map((schema) => {
+            const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
+            let score = 0
+            for (const token of wanted) if (haystack.includes(token)) score += 1
+            return {
+              schema,
+              score,
+              exact: wanted.includes(schema.name.toLowerCase()),
+            }
+          })
+          .filter((entry) => wanted.length > 0 && (entry.exact || entry.score >= 1))
+          .sort((a, b) => (b.exact - a.exact) || (b.score - a.score) || a.schema.name.localeCompare(b.schema.name))
+        const matches = scored.slice(0, MAX_RESULTS)
+        if (matches.length === 0) {
+          lines.push(
+            `No tools match "${query}". An empty result only means no tool matched ALL keywords — if you need a specific tool, unlock it directly by exact name, e.g. dev_tool_search({"toolNames":["web_search"]}).`,
+          )
         } else {
-          lines.push(`Matching tools (${matches.length}${all.length > MAX_RESULTS ? ` of ${all.length}` : ''}):`)
-          for (const schema of matches) {
+          lines.push(`Matching tools (${matches.length}${scored.length > MAX_RESULTS ? ` of ${scored.length}` : ''}):`)
+          for (const { schema, exact, score } of matches) {
             const desc = (schema.description || '').split('\n')[0].s
```

**File**: `preset/dev-tool-search.mjs` (modified, +37/-11)
```diff
@@ -16,6 +16,14 @@
  * set cannot do: the model should reach for dev_tool_search the moment a task
  * needs internet, delegation, workflows, goals, images, background jobs, or
  * multi-agent coordination — not try to work around them with bash.
+ *
+ * FIX (local): search matching was AND-over-all-tokens, so a long natural
+ * query ("file edit write replace script root permissions") matched NOTHING
+ * even against the full catalog. Now: exact name match wins, then tools
+ * matching at least one token ranked by hit count. The description also
+ * teaches the unlock path explicitly ("search empty ≠ tool absent — unlock
+ * by exact toolNames"), because models observed in the wild only search and
+ * never pass toolNames.
  */
 
 /** Cordis plugin name used by loader diagnostics. */
@@ -71,6 +79,9 @@ export function apply(ctx) {
       ...UNLOCKABLE_INDEX.map((line) => `- ${line}`),
       '',
       'Usage: pass `query` to search the catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them. Unlocked tools appear from the next request on and stay unlocked for the session.',
+      '',
+      'Example: dev_tool_search({"query":"web","toolNames":["web_search"]}) — search AND unlock in one call.',
+      'IMPORTANT: an empty search result does NOT mean the tool does not exist — it only means no tool matched ALL of your keywords. If the task needs any tool listed above, unlock it directly by exact name: dev_tool_search({"toolNames":["web_search"]}). Prefer short 1-2 keyword queries.',
     ].join('\n'),
     parameters: toJsonSchema({
       query: { type: 'string', required: false, description: 'search keywords (e.g. "web", "subagent")' },
@@ -104,20 +115,35 @@ export function apply(ctx) {
         // harness's own code mode (`registry.schemas(exec.agent)`).
         const schemas = ctx.tools.schemas(exec?.agent)
         const wanted = query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
-        const all = schemas.filter((schema) => {
-          const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
-          return wanted.every((token) => haystack.includes(token))
-        })
-        const matches = all.slice(0, MAX_RESULTS)
-        if (all.length === 0) {
-          lines.push(`No tools match "${query}".`)
+        // FIX: score instead of AND-filter. Exact name match ranks first;
+        // otherwise every tool matching at least one token competes, ordered
+        // by hit count (desc) then name. A long natural-language query no
+        // longer returns an empty catalog.
+        const scored = schemas
+          .map((schema) => {
+            const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
+            let score = 0
+            for (const token of wanted) if (haystack.includes(token)) score += 1
+            return {
+              schema,
+              score,
+              exact: wanted.includes(schema.name.toLowerCase()),
+            }
+          })
+          .filter((entry) => wanted.length > 0 && (entry.exact || entry.score >= 1))
+          .sort((a, b) => (b.exact - a.exact) || (b.score - a.score) || a.schema.name.localeCompare(b.schema.name))
+        const matches = scored.slice(0, MAX_RESULTS)
+        if (matches.length === 0) {
+          lines.push(
+            `No tools match "${query}". An empty result only means no tool matched ALL keywords — if you need a specific tool, unlock it directly by exact name, e.g. dev_tool_search({"toolNames":["web_search"]}).`,
+          )
         } else {
-          lines.push(`Matching tools (${matches.length}${all.length > MAX_RESULTS ? ` of ${all.length}` : ''}):`)
-          for (const schema of matches) {
+          lines.push(`Matching tools (${matches.length}${scored.length > MAX_RESULTS ? ` of ${scored.length}` : ''}):`)
+          for (const { schema, exact, score } of matches) {
             const desc = (schema.description || '').split('\n')[0].s
```

**File**: `shared/dev-tool-search.mjs` (modified, +37/-11)
```diff
@@ -16,6 +16,14 @@
  * set cannot do: the model should reach for dev_tool_search the moment a task
  * needs internet, delegation, workflows, goals, images, background jobs, or
  * multi-agent coordination — not try to work around them with bash.
+ *
+ * FIX (local): search matching was AND-over-all-tokens, so a long natural
+ * query ("file edit write replace script root permissions") matched NOTHING
+ * even against the full catalog. Now: exact name match wins, then tools
+ * matching at least one token ranked by hit count. The description also
+ * teaches the unlock path explicitly ("search empty ≠ tool absent — unlock
+ * by exact toolNames"), because models observed in the wild only search and
+ * never pass toolNames.
  */
 
 /** Cordis plugin name used by loader diagnostics. */
@@ -71,6 +79,9 @@ export function apply(ctx) {
       ...UNLOCKABLE_INDEX.map((line) => `- ${line}`),
       '',
       'Usage: pass `query` to search the catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them. Unlocked tools appear from the next request on and stay unlocked for the session.',
+      '',
+      'Example: dev_tool_search({"query":"web","toolNames":["web_search"]}) — search AND unlock in one call.',
+      'IMPORTANT: an empty search result does NOT mean the tool does not exist — it only means no tool matched ALL of your keywords. If the task needs any tool listed above, unlock it directly by exact name: dev_tool_search({"toolNames":["web_search"]}). Prefer short 1-2 keyword queries.',
     ].join('\n'),
     parameters: toJsonSchema({
       query: { type: 'string', required: false, description: 'search keywords (e.g. "web", "subagent")' },
@@ -104,20 +115,35 @@ export function apply(ctx) {
         // harness's own code mode (`registry.schemas(exec.agent)`).
         const schemas = ctx.tools.schemas(exec?.agent)
         const wanted = query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
-        const all = schemas.filter((schema) => {
-          const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
-          return wanted.every((token) => haystack.includes(token))
-        })
-        const matches = all.slice(0, MAX_RESULTS)
-        if (all.length === 0) {
-          lines.push(`No tools match "${query}".`)
+        // FIX: score instead of AND-filter. Exact name match ranks first;
+        // otherwise every tool matching at least one token competes, ordered
+        // by hit count (desc) then name. A long natural-language query no
+        // longer returns an empty catalog.
+        const scored = schemas
+          .map((schema) => {
+            const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
+            let score = 0
+            for (const token of wanted) if (haystack.includes(token)) score += 1
+            return {
+              schema,
+              score,
+              exact: wanted.includes(schema.name.toLowerCase()),
+            }
+          })
+          .filter((entry) => wanted.length > 0 && (entry.exact || entry.score >= 1))
+          .sort((a, b) => (b.exact - a.exact) || (b.score - a.score) || a.schema.name.localeCompare(b.schema.name))
+        const matches = scored.slice(0, MAX_RESULTS)
+        if (matches.length === 0) {
+          lines.push(
+            `No tools match "${query}". An empty result only means no tool matched ALL keywords — if you need a specific tool, unlock it directly by exact name, e.g. dev_tool_search({"toolNames":["web_search"]}).`,
+          )
         } else {
-          lines.push(`Matching tools (${matches.length}${all.length > MAX_RESULTS ? ` of ${all.length}` : ''}):`)
-          for (const schema of matches) {
+          lines.push(`Matching tools (${matches.length}${scored.length > MAX_RESULTS ? ` of ${scored.length}` : ''}):`)
+          for (const { schema, exact, score } of matches) {
             const desc = (schema.description || '').split('\n')[0].s
```

**File**: `test/dev-tool-search.test.mjs` (modified, +22/-1)
```diff
@@ -95,5 +95,26 @@ test('schemas() is queried with the executing agent as the viewing scope (issue
   const result = await ctx.tools.registered.execute({ query: 'pwsh' }, { agent })
   assert.equal(calls.length, 1)
   assert.equal(calls[0], agent, 'the executing agent is the viewing scope, so agent-scoped preset tools are visible')
-  assert.match(result.text, /pwsh: Execute a PowerShell command/)
+  assert.match(result.text, /pwsh.*Execute a PowerShell command/)
+})
+
+test('long natural-language query returns the most relevant tools (fuzzy scoring, not AND)', async () => {
+  const { registered } = register([
+    { name: 'web_search', description: 'internet search and web retrieval' },
+    { name: 'write', description: 'write files' },
+    { name: 'str_replace_editor', description: 'viewing, creating and editing files' },
+    { name: 'bash', description: 'run commands' },
+  ])
+  const tool = registered.find((t) => t.name === 'dev_tool_search')
+  const result = await tool.execute({ query: 'file edit write replace script root permissions' }, exec())
+  assert.match(result.text, /write/, 'long query must not return "No tools match" when tools match some tokens')
+  assert.doesNotMatch(result.text, /No tools match/)
+})
+
+test('empty search result teaches the direct unlock path (toolNames)', async () => {
+  const { registered } = register([{ name: 'bash', description: 'run commands' }])
+  const tool = registered.find((t) => t.name === 'dev_tool_search')
+  const result = await tool.execute({ query: 'zzz-nothing' }, exec())
+  assert.match(result.text, /No tools match/)
+  assert.match(result.text, /toolNames/)
 })
```

---

### Incident Patch 10: `bf53f30e` (2026-08-23)
**Commit Message**: docs: acknowledge the instruction-hint restart-safety fix (#76,#79)

**File**: `ACKNOWLEDGEMENTS.md` (modified, +2/-1)
```diff
@@ -25,6 +25,7 @@
 - [@ruler770525](https://github.com/ruler770525)——定位命令式 hint 措辞会把锚定轨迹打回 "let me"（带 session 对照数据），并给出建议式措辞（[#49](https://github.com/xiaobright/dsh-anchored-standard/issues/49)、[#63](https://github.com/xiaobright/dsh-anchored-standard/pull/63)）。
 - [@DuduluTkmttt](https://github.com/DuduluTkmttt)——定位 rc.6 上 dev_tool_search 因注册表作用域变化而失效的问题（[#32](https://github.com/xiaobright/dsh-anchored-standard/issues/32)、[#31](https://github.com/xiaobright/dsh-anchored-standard/pull/31)，修复随 a2e7d6a 落地）。
 - [@HongzhongL](https://github.com/HongzhongL)——贡献 fork-safe 目录控制与 Windows Git Bash 套件（[#34](https://github.com/xiaobright/dsh-anchored-standard/pull/34)；Windows 部分先后经 [#33](https://github.com/xiaobright/dsh-anchored-standard/pull/33)、[#44](https://github.com/xiaobright/dsh-anchored-standard/pull/44)、[#72](https://github.com/xiaobright/dsh-anchored-standard/pull/72) 落地）。
+- [@hongshuxifan321](https://github.com/hongshuxifan321)——复现 instruction-hint 跨重启重复注入与确定性 id 碰撞，给出唯一 id 容错修复、日志清理配方与排障文档（[#76](https://github.com/xiaobright/dsh-anchored-standard/issues/76)、[#79](https://github.com/xiaobright/dsh-anchored-standard/pull/79)）。
 
 ## 研究与独立复现
 
@@ -38,4 +39,4 @@
 
 完整记录可在 [Contributors](https://github.com/xiaobright/dsh-anchored-standard/graphs/contributors)、[Pull Requests](https://github.com/xiaobright/dsh-anchored-standard/pulls?q=is%3Apr) 和 [Issues](https://github.com/xiaobright/dsh-anchored-standard/issues?q=is%3Aissue) 中查阅；实验材料与研究贡献见 [DeepseekCotexplorations](https://github.com/0liveiraaa/DeepseekCotexplorations)。
 
-> 统计截至 2026-08-24：主仓库共有 21 个已合并 PR，其中包括 13 位外部 PR 作者；此外还有通过协作分支、审查合并和研究仓库参与项目的贡献者。GitHub 账号与本地 Git 作者邮箱的映射可能造成贡献计数差异，因此这里以可核验的实际贡献内容为主，而不是按 commit 数量排序。
+> 统计截至 2026-08-24：主仓库共有 22 个已合并 PR，其中包括 14 位外部 PR 作者；此外还有通过协作分支、审查合并和研究仓库参与项目的贡献者。GitHub 账号与本地 Git 作者邮箱的映射可能造成贡献计数差异，因此这里以可核验的实际贡献内容为主，而不是按 commit 数量排序。
```

#### Recent Merged Pull Requests:
- **PR #90** (2026-09-08): fix: migrate persona rows from `text:` to `prefix:` for dsh-persona 0.1.3 (@Vladimir-Human)
- **PR #88** (2026-09-06): fix: support session.snapshotEvents() in DSH presets (@324641aliyun)
- **PR #87** (2026-09-01): feat: align subagent delegation config with dsh 0.1.2-alpha.3 (@heiheiha798)
- **PR #86** (closed): feat: align subagent delegation config with dsh 0.1.2-alpha.3 (@heiheiha798)
- **PR #84** (closed): feat(wire-think): add orcarouter as a named think-route gateway (@lovejones2914-spec)
- **PR #82** (2026-08-28): docs: document identity drift under the bare Minimal persona (@mbzmr)
- **PR #80** (2026-08-26): fix(dev-tool-search): fuzzy token scoring + teach the toolNames unlock path (#32) (@gwL955)
- **PR #79** (2026-08-23): fix(instruction-hint): unique per-injection id to survive the restart scan hole (#76) (@hongshuxifan321)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
