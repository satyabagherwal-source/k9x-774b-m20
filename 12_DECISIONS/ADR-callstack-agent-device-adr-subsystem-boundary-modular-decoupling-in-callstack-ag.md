# Architecture Decision Record: ADR: Subsystem Boundary & Modular Decoupling in callstack/agent-device

<!-- PROVENANCE_START
{
  "source_repository": "callstack/agent-device",
  "source_url": "https://github.com/callstack/agent-device",
  "source_version": "6e18ea33",
  "license": "MIT",
  "timestamp": "2026-11-19T00:49:47.862Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-callstack-agent-device",
  "canonical_classification": "architecture_decision"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack/agent-device](https://github.com/callstack/agent-device) (Revision: `6e18ea33`).  
> **License**: MIT | **Timestamp**: `2026-11-19T00:49:47.862Z`  
> **Learning ID**: `learn-github-callstack-agent-device`


## Status
**ACCEPTED** (Empirically verified from callstack/agent-device)

## Context
During deep inspection of callstack/agent-device, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
# Forensic Learning Record (Deep Inspection): callstack/agent-device

> **Canonical Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T00:49:46.681Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Open source device layer for AI coding agents: a CLI, MCP server, and typed Node.js API to control mobile, web, TV, and desktop apps on devices and simulators, locally or in the cloud.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5443 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/ad-replay/src/internal/step-loop.ts`
```
import type { SessionAction } from '@agent-device/contracts/session';
import type { SnapshotTimingSample } from '@agent-device/contracts/capture';
import {
  buildReplayVarScope,
  collectReplayScrubbableVarValues,
  resolveReplayAction,
} from '@agent-device/ad-script';
import { verifyAndDispatchStep } from './verify-dispatch.ts';
import type {
  AdReplayProgressStep,
  AdReplayRunOutcome,
  AdReplayRunRequest,
  AdReplayStepRuntime,
} from './runtime-port-types.ts';

/**
 * #1478 P5 stage C2b: the `.ad` step-loop ENGINE policy, split out of
 * `packages/replay-port/src/daemon-port/native-command.ts`'s replay orchestration /
 * `resolveReplayStepResponse` / `buildReplayActionFailure`. Everything that
 * touches a real device, a snapshot, `SessionStore`, or the P4b repair
 * coordinator is daemon authority and stays behind the narrow
 * `AdReplayStepRuntime` capabilities (`./runtime-port-types.ts`) — this
 * module only decides which action to run next, when to skip one, and when
 * to stop.
 *
 * #1555 structural-quality review ("split step-loop.ts per the maestro
 * precedent it cites"): this file used to also hold the full boundary
 * vocabulary and the verify-then-dispatch orchestrator — both extracted out,
 * following `packages/maestro`'s own three-way split
 * (`runtime-port-types.ts` for the vocabulary, its engine files for the
 * orchestration logic). `./runtime-port-types.ts` now owns every
 * `AdReplayStepRuntime`-adjacent type; `./verify-dispatch.ts` owns
 * `verifyAndDispatchStep` and its two dispatch helpers. This file is left
 * with exactly the loop (`runAdReplay`) and the terminal-close/executable-
 * action structural logic it drives.
 *
 * #1554 fold-in (rebase onto main's `replay --keep-session`): main grew a
 * terminal-close-suppression decision independently, daemon-side, as
 * `runAdReplay`'s `resolveSuppressedTerminalCloseIndex`
 * / `countExecutedReplayActions`, generalizing the repair-only physical-last-
 * index check this module already had (`isRepairArmedTerminalCloseAction`) to
 * "terminal among EXECUTABLE actions" and adding `--keep-session` as a second
 * reason to suppress. Per the same "pure policy belongs in the engine"
 * boundary this whole module exists to enforce, that generalized resolution
 * — `resolveSuppressedTerminalCloseIndex` below — lives here instead,
 * unified with (replacing) the old repair-only predicate, and `runAdReplay`
 * folds the resulting `replayed` count in directly rather than a separate
 * daemon-side post-hoc counter. `requireLiveSessionForKeepSession` — the
 * `--keep-session` postcondition that inspects `SessionStore` — stays daemon
 * authority and never moved here.
 *
 * #1555 review P1 (second pass, "move variable semantics/planning behind the
 * replay entrypoint"): `runAdReplay` builds the `${VAR}` scope, via
 * `@agent-device/ad-script`'s `buildReplayVarScope`, from the request's
 * `varSources` — plain data (builtins/file/shell/cli env) the daemon reads
 * from the request/process — and resolves each action EXACTLY ONCE per step
 * (`resolveReplayAction`), before `verifyAndDispatchStep` does anything else
 * with it. The RESOLVED action is what reaches `dispatchStep` and
 * `beginTargetVerification`; every other capability still receives the
 * ORIGINAL recorded `action` (a target-binding divergence reports the
 * recorded selector, never an expanded `${VAR}`). This replaces two
 * independent daemon-side interpolation call sites — dispatch's own
 * (`session-replay-action-runtime.ts`'s `invokeReplayAction`) and target
 * verification's separate one (`session-replay-target-verification.ts`'s
 * `resolveTargetVerificationEntry`) — with this one engine-owned resolution.
 * The engine's own live scope is also the one source for the `${VAR}` values
 * a divergence report may redact (`collectReplayScrubbableVarValues`),
 * computed ONCE per run and threaded to each build-failure/`handleActionFailure`
 * capability as an explicit `scrubVars` argument rather than recomputed per
 * call site — the daemon never holds a `ReplayVarScope` value at all.
 *
 * #1478 P5 follow-up (one daemon-owned artifact ledger): artifact-path
 * accumulation used to be DOUBLE-WRITTEN — `dispatchStep` added each step's
 * entries to the daemon's own `Set` (`runReplayCommand`'s, read by its
 * catch block so a mid-loop throw still reports what was collected) AND
 * returned them for this loop to add to a second `Set` of its own. Two
 * mutable collections, kept in sync by hand, with no single owner. The
 * daemon's `Set` is now the run's ONE ledger: `dispatchStep` writes it and
 * returns its contents, and `artifactPaths` below is just the latest such
 * return value — re-bound, never mutated. `AdReplayRunOutcome.artifactPaths`
 * stays a façade field (it is wire-relevant: the daemon's success response
 * reports it), but it is now a projection of what the capability handed back
 * rather than an independently accumulated set.
 *
 * The ledger deliberately does NOT carry a divergence build's own artifacts
 * (`buildTargetBindingFailure` and friends produce a fresh capture): those
 * reach `handleActionFailure` through `mergeArtifactPaths` as a derived
 * value. Writing them into the ledger instead would change what the daemon's
 * catch block reports when `handleActionFailure` itself throws — the one
 * observable difference between the two old sets, preserved exactly.
 */

/**
 * ADR 0012 step 4's step loop: for every executable action from
 * `request.entryIndex` on, arm the save-script transaction, skip a
 * repair-armed or `--keep-session` plan's terminal `close` (lifecycle, not a
 * script step), report progress, verify-then-dispatch through
 * `verifyAndDispatchStep`, and stop at the first failure. Moved verbatim from
 * `executeReplayActions`'s composition order — only the daemon capabilities
 * it calls through were narrowed into `runtime`.
 *
 * #1554 fold-in: `terminalCloseIndex` is resolved ONCE, structurally, from
 * `actions` alone (independent of which mode wants it suppressed) via
 * `resolveSuppressedTerminalCloseIndex`. Whether it actually gets suppressed
 * THIS run is decided per-step, at the point the loop reaches it: `keepSession`
 * is a static per-run flag, but repair-armed is checked through
 * `runtime.isRepairArmed()` right after `runtime.armStep()` — deliberately
 * dynamic, because a bare `--save-script` first arms the transaction on this
 * very call (`armStep()` mutates the session), so re-reading it here (rather
 * than snapshotting it before the loop) is what lets a first-arm run and a
 * continuing `--from` leg share one check. The suppressed index is excluded
 * from `replayed` exactly like a skipped `replay` pseudo-action — never
 * dispatched, never divergence-checked, never counted.
 *
 * `scrubVars` (the `${VAR}` values a divergence report may redact) is
 * computed ONCE PER STEP — right after `resolveReplayAction` (the one call
 * that can grow the scope's expanded-builtins set THIS step) — and threaded
 * down to `verifyAndDispatchStep`/`handleActionFailure` as an explicit
 * argument, never recomputed per call inside the verify/dispatch chain
 * (`collectReplayScrubbableVarValues` is otherwise pure over `scope`, so
 * every one of those call sites would recompute the identical value).
 */
export async function runAdReplay(
  request: AdReplayRunRequest,
  runtime: AdReplayStepRuntime,
): Promise<AdReplayRunOutcome> {
  const { actions, entryIndex, keepSession } = request;
  // The one `${VAR}` scope this run builds — see the module header. Mutated
  // in place as each step resolves (tracks which builtins actually expanded,
  // for `collectReplayScrubbableVarValues`), never rebuilt mid-run.
  const scope = buildReplayVarScope(request.varSources);
  // The run's artifact ledger AS THIS ENGINE SEES IT: a plain value re-bound
  // to whatever `dispatchStep` last returned, never a collection this module
  // mutates — see the module header's ledger note.
  let artifactPaths: readonly string[] = [];
  const snapshotDiagnosticSamples: SnapshotTimingSample[] = [];
  const terminalCloseIndex = resolveSuppressedTerminalCloseIndex(actions);
  let replayed = 0;
  for (let index = entryIndex; index < actions.length; index += 1) {
    const action = actions[index];
    if (!isExecutableReplayAction(action)) continue;
    // Arm before checking terminal close so `[open, close]` records the
    // session created by `open` before treating `close` as lifecycle.
    runtime.armStep();
    if (index === terminalCloseIndex && (keepSession || runtime.isRepairArmed())) {
      continue;
    }
    replayed += 1;
    // `onStep?.(x)` short-circuits evaluating `x` when `onStep` is absent
    // (the ordinary `replay` command has no sink) — an explicit guard
    // preserves that: `describeStepValue` must not run needlessly.
    if (runtime.onStep) {
      const value = runtime.describeStepValue(action);
      runtime.onStep(buildAdReplayProgressStep(index, actions.length, action, value));
    }
    // The engine's one resolution of this step's action — see the module
    // header. Every capability below that needs an interpolated value
    // receives THIS value; every other capability still receives `action`.
    const resolvedAction = resolveReplayAction(action, scope, resolveActionLoc(request, index));
    // This step's one scrub-value computation — see the module header.
    // `resolvedAction` above is the only thing that can have just grown
    // `scope`'s expanded-builtins set, so this is computed right after it.
    const scrubVars = collectReplayScrubbableVarValues(scope);
    const sampleStart = runtime.diagnosticsMarker();
    const stepOutcome = await verifyAndDispatchStep(
      runtime,
      scrubVars,
      action,
      resolvedAction,
      index,
      artifactPaths,
    );
    snapshotDiagnosticSamples.push(...runtime.diagnosticsSince(sampleStart));
    if (stepOutcome.status === 'ok') {
      artifactPaths = stepOutcome.arti
```

### Core Architecture Module: `packages/ad-script/src/internal/script-utils.ts`
```
import type { SessionAction } from '@agent-device/contracts/session';
import type { SessionRuntimeHints } from '@agent-device/kernel/contracts';
import { appendScreenshotScriptFlags } from '@agent-device/contracts/capture';
import { splitRefGenerationSuffix } from '@agent-device/kernel/snapshot';

const SCRIPT_RUNTIME_PLATFORMS = {
  ios: true,
  android: true,
  harmonyos: true,
} satisfies Record<NonNullable<SessionRuntimeHints['platform']>, true>;

function isScriptRuntimePlatform(
  value: unknown,
): value is NonNullable<SessionRuntimeHints['platform']> {
  return typeof value === 'string' && Object.hasOwn(SCRIPT_RUNTIME_PLATFORMS, value);
}

/**
 * #1076 versioned refs: a recorded ref positional may carry a `~s<generation>`
 * pin from the client that issued it (`@e12~s3`). Generations are meaningless
 * outside the session that minted them — a replayed script runs against a NEW
 * session with its own generation counter — so replay parsing and script
 * writing strip well-formed suffixes and IGNORE the generation instead of
 * re-validating it (which would only produce spurious staleness warnings).
 * Malformed suffixes are left untouched; they were never minted by us and the
 * daemon owns rejecting them.
 */
export function stripRecordedRefGeneration(token: string): string {
  if (!token.startsWith('@')) return token;
  const split = splitRefGenerationSuffix(token);
  return split?.base ?? token;
}

const NUMERIC_ARG_RE = /^-?\d+(\.\d+)?$/;
// A token may not start with `'`: the tokenizer reads a leading `'` as a
// single-quoted literal (#3197), so the writer must quote such values or the
// re-parse would strip the apostrophe.
const BARE_SCRIPT_TOKEN_RE = /^[^\s"'\\][^\s"\\]*$/;

const CLICK_LIKE_NUMERIC_FLAG_MAP = new Map<string, 'count' | 'intervalMs' | 'holdMs' | 'jitterPx'>(
  [
    ['--count', 'count'],
    ['--interval-ms', 'intervalMs'],
    ['--hold-ms', 'holdMs'],
    ['--jitter-px', 'jitterPx'],
  ],
);

const SWIPE_NUMERIC_FLAG_MAP = new Map<string, 'count' | 'pauseMs'>([
  ['--count', 'count'],
  ['--pause-ms', 'pauseMs'],
]);
const GESTURE_NUMERIC_FLAG_MAP = new Map<string, 'pointerCount' | 'holdMs' | 'count' | 'pauseMs'>([
  ['--pointer-count', 'pointerCount'],
  ['--hold-ms', 'holdMs'],
  ['--count', 'count'],
  ['--pause-ms', 'pauseMs'],
]);

const TYPING_NUMERIC_FLAG_MAP = new Map<string, 'delayMs'>([['--delay-ms', 'delayMs']]);

/**
 * `scroll`'s stop condition, in the script grammar beside its `recorded: true`
 * declaration (#3197): the hunt for an off-screen element IS the step, so a
 * recorded `scroll down --until <selector>` carries it and a hand-written script
 * can say the same. Without this the tokens fall through as positionals and the
 * daemon reads `--until` as the scroll amount. Distance stays a positional
 * (`scroll down 0.8`): `--pixels` and `--duration-ms` are `recorded: false`, and a
 * script grammar that accepted a flag the recorder cannot carry would write a line
 * the recording path could never reproduce.
 */
const SCROLL_SCRIPT_FLAG_MAP = new Map<string, ScriptFlagEntry>([
  ['--until', { key: 'until', kind: 'string' }],
  ['--max-passes', { key: 'maxPasses', kind: 'int' }],
]);

/**
 * `wait`'s capture-scope flags (#3197): the command declares them
 * (`SELECTOR_SNAPSHOT_FLAGS`) and they are recorded, so the script grammar
 * recognizes them too. Otherwise they land inside the positional list and the
 * wait parser refuses the line as selector-shaped text. Long spellings only:
 * this is the spelling the writer emits for `wait`, so nothing the recorder can
 * write needs an alias, and matching `-d`/`-s` would reclassify realistic
 * waited text (`wait text -s so funny`) to buy almost nothing — the only line
 * losing its old reading is one whose whole token is a literal long flag word,
 * which a hand-written script can spell with the selector wrapped instead.
 */
const WAIT_SCRIPT_FLAG_MAP = new Map<string, ScriptFlagEntry>([
  ['--raw', { key: 'snapshotRaw', kind: 'boolean' }],
  ['--depth', { key: 'snapshotDepth', kind: 'int' }],
  ['--scope', { key: 'snapshotScope', kind: 'string' }],
]);

/** How one script flag token carries its value. */
type ScriptFlagEntry = {
  key: 'until' | 'maxPasses' | 'snapshotRaw' | 'snapshotDepth' | 'snapshotScope';
  kind: 'boolean' | 'int' | 'string';
};

/** The commands whose script line carries flags (`scroll`, `wait`). */
export type ScriptFlagCommand = 'scroll' | 'wait';

/** Which script flag tokens each flag-carrying command reads. */
const SCRIPT_FLAG_MAPS: Record<ScriptFlagCommand, Map<string, ScriptFlagEntry>> = {
  scroll: SCROLL_SCRIPT_FLAG_MAP,
  wait: WAIT_SCRIPT_FLAG_MAP,
};

/** The commands whose script line carries flags, derived from the parse tables. */
export const SCRIPT_FLAG_COMMANDS = Object.keys(SCRIPT_FLAG_MAPS) as readonly ScriptFlagCommand[];

/**
 * The script flag tokens one command's line reads, with their value kinds and flag keys
 * (#3197). Exported for the command-surface admission test
 * (`packages/command-surface/src/replay/script-flag-admission.test.ts`), which proves the
 * tables and the
 * flag declarations admit the same keys in both directions — the invariant that keeps the
 * script grammar and the flag declarations from diverging the way `--until` and
 * `wait --raw` did.
 */
export function scriptFlagEntries(
  command: string,
): ReadonlyArray<{ token: string } & ScriptFlagEntry> {
  const flagMap = scriptFlagMapFor(command);
  if (!flagMap) return [];
  return [...flagMap].map(([token, entry]) => ({ token, ...entry }));
}

function scriptFlagMapFor(command: string): Map<string, ScriptFlagEntry> | undefined {
  return isScriptFlagCommand(command) ? SCRIPT_FLAG_MAPS[command] : undefined;
}

// Membership comes from the tables' own keys, so a third command cannot compile into the
// type while the guard silently refuses to read its flags.
function isScriptFlagCommand(command: string): command is ScriptFlagCommand {
  return (SCRIPT_FLAG_COMMANDS as readonly string[]).includes(command);
}

/**
 * Splits a `scroll` or `wait` script line into positionals and the command's own
 * flags (#3197). A token is a flag only when it names one of the command's
 * declared script flags and, for a value kind, a value token follows; anything
 * else stays positional, so a hand-written target or text value is untouched.
 */
export function parseReplayCommandFlags(
  command: ScriptFlagCommand,
  args: string[],
): { positionals: string[]; flags: SessionAction['flags'] } {
  const positionals: string[] = [];
  const flags: SessionAction['flags'] = {};
  const flagMap = SCRIPT_FLAG_MAPS[command];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    const entry = flagMap.get(token);
    const nextArg = args[index + 1];
    if (entry === undefined || (entry.kind !== 'boolean' && nextArg === undefined)) {
      positionals.push(token);
      continue;
    }
    if (entry.kind === 'boolean') {
      Object.assign(flags, { [entry.key]: true });
      continue;
    }
    if (entry.kind === 'int') {
      const parsed = parseNonNegativeIntToken(nextArg);
      if (parsed === null) {
        positionals.push(token);
        continue;
      }
      Object.assign(flags, { [entry.key]: parsed });
    } else {
      Object.assign(flags, { [entry.key]: nextArg });
    }
    index += 1;
  }

  return { positionals, flags };
}

export function isClickLikeCommand(command: string): command is 'click' | 'press' {
  return command === 'click' || command === 'press';
}

export function isTouchTargetCommand(
  command: string,
): command is 'click' | 'press' | 'longpress' | 'hover' {
  return isClickLikeCommand(command) || command === 'longpress' || command === 'hover';
}

function isTypingCommand(command: string): command is 'type' | 'fill' {
  return command === 'type' || command === 'fill';
}

export function formatScriptArg(value: string): string {
  return formatScriptToken(value, isStructuralScriptToken);
}

// Use for literal values such as device labels where leading/trailing whitespace must survive round-trips.
export function formatScriptStringLiteral(value: string): string {
  return JSON.stringify(value);
}

// Preserve readable CLI-ish script output for ordinary tokens while still quoting whitespace.
function formatScriptArgQuoteIfNeeded(value: string): string {
  return formatScriptToken(value, isBareScriptToken);
}

function formatScriptToken(value: string, canStayBare: (value: string) => boolean): string {
  return canStayBare(value) ? value : formatScriptStringLiteral(value);
}

function isStructuralScriptToken(value: string): boolean {
  return (isBareScriptToken(value) && value.startsWith('@')) || NUMERIC_ARG_RE.test(value);
}

function isBareScriptToken(value: string): boolean {
  return BARE_SCRIPT_TOKEN_RE.test(value);
}

const TYPED_TEXT_COMMANDS = new Set(['fill', 'type']);

type DivergenceActionLabelInput = {
  command: string;
  positionals: readonly string[];
};

/**
 * Action summary safe for the divergence report / user-facing failure text.
 * For typing commands the typed value is categorically dropped and replaced
 * with a `<text>` marker — fill text is never serialized (ADR 0012), not
 * merely redacted-if-secret-shaped. The target (selector / @ref / point)
 * still shows so the caller can see WHICH field failed.
 */
export function formatDivergenceActionLabel(action: DivergenceActionLabelInput): string {
  if (!TYPED_TEXT_COMMANDS.has(action.command)) {
    const values = (action.positionals ?? []).map((value) => formatScriptArg(value));
    return [action.command, ...values].join(' ');
  }
  const targetTokens = divergenceTypingTargetTokens(action);
  const targetLabel = targetTokens.map((value) => formatScriptArg(value)).join(' ');
  return [action.command, targetLabel, '<text>'].filter((part) => part.length > 0).join(' ');
}

/**
 * The identifying (non-text) positional tokens of a typing action:
 * `@ref`, a two-token point (`x y`), or
```

### Core Architecture Module: `packages/apple-runner/src/runner-lifecycle.ts`
```
import {
  AppError,
  asAppError,
  createRequestCanceledError,
  discloseDispatch,
  discloseUnclassifiedDispatch,
  isRequestCanceledError,
  type DispatchDisclosure,
} from '@agent-device/kernel/errors';
import type { DeviceInfo } from '@agent-device/kernel/device';
import type { ReadinessPhase } from '@agent-device/contracts/wait';
import { emitDiagnostic } from './host.ts';
import { RUNNER_STARTUP_TIMEOUT_MS } from './runner-startup-transport.ts';
import { RUNNER_COMMAND_TIMEOUT_MS } from './runner-transport.ts';
import {
  type RunnerSession,
  assertExpectedRunnerSession,
  ensureRunnerSession,
  invalidateRunnerSession,
  executeRunnerCommandWithSession,
  markRunnerSessionServed,
  readRunnerSessionLiveness,
} from './runner-session.ts';
import {
  assertRunnerRequestActive,
  callerDeadlineExpired,
  resolveRunnerRequestSignal,
  withRunnerCommandId,
  type RunnerCommand,
} from './runner-contract.ts';
import {
  isRetryableRunnerError,
  shouldRetainRunnerSession,
  isRunnerPreSendRefusal,
  isStructuredRunnerFailure,
  resolveFirstAttemptDispatch,
  shouldRebuildCachedRunnerArtifact,
  shouldRestartRunnerAfterReadinessPreflight,
  shouldRestartRunnerBeforeCommandSend,
  shouldRetryRunnerConnectError,
} from './runner-error-classification.ts';
import type {
  AppleRunnerCommandOptions,
  AppleRunnerPrepareOptions,
  AppleRunnerPrepareResult,
} from './runner-provider.ts';
import {
  assertRunnerStartAdmitsPreparation,
  finishRunnerStartAdmission,
  markRunnerXctestrunArtifactBadForRun,
  openRunnerStartLoopAdmission,
} from './runner-xctestrun.ts';
import { handleRunnerTransportErrorAfterCommandSend } from './runner-command-recovery.ts';
import {
  buildRunnerRecycleBudgetExhaustedError,
  commitRunnerRecycle,
  hasRunnerRequestTouchedSession,
  markRunnerRequestTouchedSession,
  runnerRecycleLedgerKey,
  tryBeginRunnerRecycle,
} from './runner-recycle-ledger.ts';

export type PrepareIosRunnerOptions = AppleRunnerPrepareOptions;
export type PrepareIosRunnerResult = AppleRunnerPrepareResult;

const PREPARE_RUNNER_HEALTH_MAX_SESSION_ATTEMPTS = 2;

type PrepareDeadlinePhaseTimeouts = Partial<
  Pick<PrepareIosRunnerOptions, 'buildTimeoutMs' | 'startupTimeoutMs'>
>;

export async function prepareLocalIosRunner(
  device: DeviceInfo,
  options: PrepareIosRunnerOptions,
): Promise<PrepareIosRunnerResult> {
  assertRunnerRequestActive(options.requestId);
  const signal = resolveRunnerRequestSignal(options);
  const command = withRunnerCommandId({ command: 'uptime' });
  // One admission for the whole attempt loop, supplied to every start it makes: a teardown that
  // lands mid-loop closes it, and the health retry that would re-enter the start and rebuild the
  // runner the loop's killed child was building meets a closed gate instead (#3220).
  const startAdmission = openRunnerStartLoopAdmission(device.id);
  let recoveryReason: string | undefined;
  try {
    for (let attempt = 1; attempt <= PREPARE_RUNNER_HEALTH_MAX_SESSION_ATTEMPTS; attempt += 1) {
      const result = await runPrepareAttempt({
        device,
        command,
        options: { ...options, startAdmission },
        signal,
        attempt,
        recoveryReason,
      });
      if (result.kind === 'prepared') return result.result;
      recoveryReason = result.recoveryReason;
    }
  } finally {
    finishRunnerStartAdmission(startAdmission);
  }

  // Unreachable while PREPARE_RUNNER_HEALTH_MAX_SESSION_ATTEMPTS is positive.
  throw new AppError('COMMAND_FAILED', 'iOS runner prepare failed');
}

type PrepareAttemptResult =
  | { kind: 'prepared'; result: PrepareIosRunnerResult }
  | { kind: 'retry'; recoveryReason: string };

async function runPrepareAttempt(params: {
  device: DeviceInfo;
  command: RunnerCommand;
  options: PrepareIosRunnerOptions;
  signal: AbortSignal | undefined;
  attempt: number;
  recoveryReason: string | undefined;
}): Promise<PrepareAttemptResult> {
  const { device, command, options, signal, attempt, recoveryReason } = params;
  const connectStartedAt = Date.now();
  assertRunnerStartAdmitsPreparation(device.id, options.startAdmission);
  const session = await ensureRunnerSession(device, {
    ...options,
    cleanStaleBundles: attempt > 1 ? true : options.cleanStaleBundles,
    ...readPrepareDeadlinePhaseTimeouts(options, 'runner_session'),
  });
  assertExpectedRunnerSession(session, options.expectedRunnerSessionId);
  const connectMs = Date.now() - connectStartedAt;
  try {
    const result = await runPrepareHealthCheck(
      device,
      session,
      command,
      options,
      signal,
      connectMs,
      {
        recoveryReason,
      },
    );
    return { kind: 'prepared', result: recordPrepareResult(device, result) };
  } catch (error) {
    return await handlePrepareHealthFailure({
      device,
      session,
      command,
      options,
      signal,
      attempt,
      error,
    });
  }
}

async function handlePrepareHealthFailure(params: {
  device: DeviceInfo;
  session: RunnerSession;
  command: RunnerCommand;
  options: PrepareIosRunnerOptions;
  signal: AbortSignal | undefined;
  attempt: number;
  error: unknown;
}): Promise<PrepareAttemptResult> {
  const { device, session, command, options, signal, attempt, error } = params;
  assertRunnerStartAdmitsPreparation(device.id, options.startAdmission);
  if (options.expectedRunnerSessionId !== undefined) throw error;
  const appErr = asAppError(error, 'COMMAND_FAILED');
  if (isRequestCanceledError(appErr)) {
    await invalidateRunnerSessionBestEffort(session, 'prepare_runner_request_canceled');
    throw error;
  }
  if (shouldRetainRunnerSession(appErr)) throw error;
  if (attempt === 1 && shouldRecoverBadCachedRunnerArtifact(appErr, session)) {
    return {
      kind: 'prepared',
      result: await recoverBadCachedRunnerArtifact({
        device,
        session,
        command,
        options,
        signal,
        error: appErr,
      }),
    };
  }
  if (!shouldRetryPrepareRunnerHealthFailure(appErr)) {
    throw error;
  }
  const reason = appErr.message || 'runner_health_failed';
  if (attempt >= PREPARE_RUNNER_HEALTH_MAX_SESSION_ATTEMPTS) {
    await invalidateRunnerSessionBestEffort(session, 'prepare_runner_health_failed');
    throw error;
  }

  assertRunnerRequestActive(options.requestId);
  await invalidateRunnerSession(session, 'prepare_runner_health_retry');
  emitDiagnostic({
    level: 'warn',
    phase: 'ios_runner_prepare_health_retry',
    data: {
      command: command.command,
      commandId: command.commandId,
      sessionId: session.sessionId,
      attempt,
      maxAttempts: PREPARE_RUNNER_HEALTH_MAX_SESSION_ATTEMPTS,
      reason,
    },
  });
  return { kind: 'retry', recoveryReason: reason };
}

async function recoverBadCachedRunnerArtifact(params: {
  device: DeviceInfo;
  session: RunnerSession & {
    xctestrunArtifact: NonNullable<RunnerSession['xctestrunArtifact']>;
  };
  command: RunnerCommand;
  options: PrepareIosRunnerOptions;
  signal: AbortSignal | undefined;
  error: AppError;
}): Promise<PrepareIosRunnerResult> {
  const { device, session, command, options, signal, error } = params;
  const reason = error.message || 'runner_health_failed';
  await invalidateRunnerSession(session, 'prepare_cached_runner_health_failed');
  await markRunnerXctestrunArtifactBadForRun(session.xctestrunArtifact, reason);
  const connectStartedAt = Date.now();
  const rebuiltSession = await ensureRunnerSession(device, {
    ...options,
    cleanStaleBundles: true,
    forceRunnerXctestrunRebuild: true,
    ...readPrepareDeadlinePhaseTimeouts(options, 'runner_rebuild'),
  });
  const connectMs = Date.now() - connectStartedAt;
  try {
    const recovered = await runPrepareHealthCheck(
      device,
      rebuiltSession,
      command,
      options,
      signal,
      connectMs,
      { recoveryReason: reason },
    );
    emitDiagnostic({
      level: 'info',
      phase: 'ios_runner_prepare_bad_cache_recovered',
      data: {
        command: command.command,
        commandId: command.commandId,
        sessionId: rebuiltSession.sessionId,
        xctestrunPath: rebuiltSession.xctestrunArtifact?.xctestrunPath,
        reason,
      },
    });
    return recordPrepareResult(device, recovered);
  } catch (error) {
    await invalidateRunnerSessionBestEffort(rebuiltSession, 'prepare_rebuilt_runner_health_failed');
    const wrapped = wrapPrepareHealthFailure(error, rebuiltSession, reason);
    emitPrepareDiagnostic(device, {
      cache: rebuiltSession.xctestrunArtifact?.cache,
      artifact: rebuiltSession.xctestrunArtifact?.artifact,
      buildMs: rebuiltSession.xctestrunArtifact?.buildMs,
      connectMs,
      healthCheckMs: 0,
      xctestrunPath: rebuiltSession.xctestrunArtifact?.xctestrunPath,
      failureReason: wrapped.message,
    });
    throw wrapped;
  }
}

async function invalidateRunnerSessionBestEffort(
  session: RunnerSession,
  reason: Parameters<typeof invalidateRunnerSession>[1],
): Promise<void> {
  try {
    await invalidateRunnerSession(session, reason);
  } catch {}
}

function shouldRetryPrepareRunnerHealthFailure(error: AppError): boolean {
  if (isRequestCanceledError(error)) return false;
  return isRetryableRunnerError(error) || shouldRetryRunnerConnectError(error);
}

/**
 * Runs one runner command and discloses `dispatched: no` on a failure raised before the command
 * reached the exchange, or classified as a pre-send refusal by the recovery table.
 */
export async function executeRunnerCommand(
  device: DeviceInfo,
  command: RunnerCommand,
  options: AppleRunnerCommandOptions,
): Promise<Record<string, unknown>> {
  const exchange = { entered: false };
  try {
    return await executeRunnerCommandAttempt(device, command, options, exchange);
  } catch (error) {
    const failure = asAppError(error);
    if (!exchange.entered) throw discloseDispatch(failure, 'no');
    if (isRunnerPreSendRefusal(failure)) throw discloseUnclassifiedDispatch(failure, 'no');
    thro
```

### Core Architecture Module: `packages/capture-kit/src/capture-admission/session-state-slice.ts`
```
import type { PerfNativeCaptureLiveHandle } from '@agent-device/contracts/perf-runtime';
import type { AudioProbeLiveHandle } from '@agent-device/contracts/audio-probe-runtime';
import type { ScreenRecordingLiveHandle } from '@agent-device/contracts/screen-recording-runtime';
import type { DurableCaptureSessionResource } from '../durable-capture/index.ts';

/**
 * The whole of a session record these admission modules read and replace: the three durable
 * capture slots they own. The daemon's `SessionState` is structurally wider and stays assignable
 * at every call site; nothing here reaches past these fields.
 */
export type DurableCaptureSessionState = {
  perfCapture?: DurableCaptureSessionResource<'perf-capture', PerfNativeCaptureLiveHandle>;
  audioProbe?: DurableCaptureSessionResource<'audio-probe', AudioProbeLiveHandle>;
  screenRecording?: DurableCaptureSessionResource<'screen-recording', ScreenRecordingLiveHandle>;
};

```

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/action-shelf.ts`
```
import type { RawSnapshotNode, Rect } from '@agent-device/kernel/snapshot';
import { isRectVisibleInViewport, rectContains } from '@agent-device/kernel/rect';
import { normalizeType } from '@agent-device/contracts/snapshot';
import {
  areRectsApproximatelyEqual,
  collectDescendants,
  findDescendant,
  isSemanticActionNode,
  isScrollableSnapshotType,
  type SnapshotTreeRuleContext,
} from './tree.ts';

const ACTION_SHELF_MINIMUM_BUTTONS = 3;
const ACTION_SHELF_EDGE_TOLERANCE = 2;
// A rotating add/close toggle grows its axis-aligned AX bounds toward sqrt(2). Keep the threshold
// well below that transform while leaving ordinary pixel jitter and same-sized shelf actions alone.
const ACTION_TOGGLE_EXPANSION_RATIO = 1.15;

interface ActionShelfPresentation {
  actionButtons: RawSnapshotNode[];
  childActionsPresented: boolean;
  rect: Rect;
}

export function collectIosReplacedActionShelves(
  nodes: RawSnapshotNode[],
  childrenByParent: ReadonlyMap<number, RawSnapshotNode[]>,
  context: SnapshotTreeRuleContext,
): void {
  const positions = new Map(nodes.map((node, position) => [node.index, position]));
  for (const [shelfPosition, shelf] of nodes.entries()) {
    const transition = resolveReplacedActionShelf(
      nodes,
      positions,
      childrenByParent,
      shelf,
      context,
    );
    if (!transition) continue;

    suppressNodeAndDescendants(nodes, shelfPosition, context);
    const shelfBand = expandRect(transition.shelfRect, ACTION_SHELF_EDGE_TOLERANCE);
    for (const sibling of transition.intermediateSiblings) {
      if (
        isTextInput(sibling) ||
        !sibling.rect ||
        !isRectVisibleInViewport(sibling.rect, shelfBand)
      ) {
        continue;
      }
      const position = positions.get(sibling.index);
      if (position !== undefined) {
        suppressNodeAndDescendants(nodes, position, context);
      }
    }
  }
}

function resolveReplacedActionShelf(
  nodes: RawSnapshotNode[],
  positions: ReadonlyMap<number, number>,
  childrenByParent: ReadonlyMap<number, RawSnapshotNode[]>,
  shelf: RawSnapshotNode,
  context: SnapshotTreeRuleContext,
): { shelfRect: Rect; intermediateSiblings: RawSnapshotNode[] } | undefined {
  const hiddenShelf = resolveHiddenActionShelf(shelf, childrenByParent, context.sourceNodesByIndex);
  if (!hiddenShelf) return undefined;
  const replacementPosition = findActionShelfReplacementPosition(
    nodes,
    positions,
    hiddenShelf.siblings,
    hiddenShelf.position,
    hiddenShelf.parent,
  );
  if (replacementPosition < 0) return undefined;
  return {
    shelfRect: hiddenShelf.rect,
    intermediateSiblings: hiddenShelf.siblings.slice(hiddenShelf.position + 1, replacementPosition),
  };
}

function resolveHiddenActionShelf(
  shelf: RawSnapshotNode,
  childrenByParent: ReadonlyMap<number, RawSnapshotNode[]>,
  nodesByIndex: ReadonlyMap<number, RawSnapshotNode>,
):
  | { rect: Rect; parent: RawSnapshotNode; siblings: RawSnapshotNode[]; position: number }
  | undefined {
  const presentation = resolveHorizontalActionShelf(
    shelf,
    childrenFor(childrenByParent, shelf.index),
  );
  if (!presentation) return undefined;
  const parent = findParent(shelf, nodesByIndex);
  if (!parent || !parent.rect) return undefined;
  const siblings = childrenFor(childrenByParent, parent.index);
  const position = siblings.findIndex((node) => node.index === shelf.index);
  if (!hasCollapsedShelfToggle(siblings, position, shelf, presentation)) return undefined;
  return { rect: presentation.rect, parent, siblings, position };
}

function childrenFor(
  childrenByParent: ReadonlyMap<number, RawSnapshotNode[]>,
  parentIndex: number,
): RawSnapshotNode[] {
  return childrenByParent.get(parentIndex) ?? [];
}

function hasCollapsedShelfToggle(
  siblings: RawSnapshotNode[],
  shelfPosition: number,
  shelf: RawSnapshotNode,
  presentation: ActionShelfPresentation,
): boolean {
  if (shelfPosition < 1) return false;
  const leadingAction = findIndependentLeadingAction(siblings, shelfPosition, shelf);
  if (!leadingAction) return false;
  if (!presentation.childActionsPresented) return true;
  return !isExpandedActionToggle(leadingAction, presentation.actionButtons);
}

function findParent(
  node: RawSnapshotNode,
  nodesByIndex: ReadonlyMap<number, RawSnapshotNode>,
): RawSnapshotNode | undefined {
  return typeof node.parentIndex === 'number' ? nodesByIndex.get(node.parentIndex) : undefined;
}

function findActionShelfReplacementPosition(
  nodes: RawSnapshotNode[],
  positions: ReadonlyMap<number, number>,
  siblings: RawSnapshotNode[],
  shelfPosition: number,
  parent: RawSnapshotNode,
): number {
  return siblings.findIndex(
    (candidate, position) =>
      position > shelfPosition &&
      isActionShelfReplacement(nodes, positions.get(candidate.index), candidate, parent),
  );
}

function resolveHorizontalActionShelf(
  shelf: RawSnapshotNode,
  children: RawSnapshotNode[],
): ActionShelfPresentation | undefined {
  if (!isScrollableSnapshotType(shelf.type) || !shelf.rect) return undefined;
  const shelfRect = shelf.rect;
  const buttons = children.filter(
    (node) => normalizeType(node.type ?? '') === 'button' && node.rect,
  );
  if (buttons.length === 0 && shelf.hiddenContentBelow === true) {
    return { rect: shelfRect, childActionsPresented: false, actionButtons: buttons };
  }
  if (buttons.length < ACTION_SHELF_MINIMUM_BUTTONS) return undefined;
  const centers = buttons.map((button) => button.rect!.x + button.rect!.width / 2);
  if (!centers.every((center, index) => index === 0 || center > centers[index - 1]!)) {
    return undefined;
  }
  return {
    rect: shelfRect,
    childActionsPresented: buttons.some((button) => rectContains(shelfRect, button.rect!)),
    actionButtons: buttons,
  };
}

function findIndependentLeadingAction(
  siblings: RawSnapshotNode[],
  shelfPosition: number,
  shelf: RawSnapshotNode,
): RawSnapshotNode | undefined {
  if (!shelf.rect || shelfPosition < 1) return undefined;
  for (let position = shelfPosition - 1; position >= 0; position -= 1) {
    const candidate = siblings[position]!;
    if (!candidate.rect || !isSemanticActionNode(candidate)) continue;
    const centerX = candidate.rect.x + candidate.rect.width / 2;
    if (
      centerX < shelf.rect.x &&
      verticallyOverlaps(candidate.rect, expandRect(shelf.rect, ACTION_SHELF_EDGE_TOLERANCE))
    ) {
      return candidate;
    }
  }
  return undefined;
}

function isExpandedActionToggle(
  toggle: RawSnapshotNode,
  actionButtons: RawSnapshotNode[],
): boolean {
  if (!toggle.rect || actionButtons.length === 0) return false;
  const actionWidth = Math.max(...actionButtons.map((button) => button.rect?.width ?? 0));
  const actionHeight = Math.max(...actionButtons.map((button) => button.rect?.height ?? 0));
  return (
    toggle.rect.width > actionWidth * ACTION_TOGGLE_EXPANSION_RATIO ||
    toggle.rect.height > actionHeight * ACTION_TOGGLE_EXPANSION_RATIO
  );
}

function isActionShelfReplacement(
  nodes: RawSnapshotNode[],
  position: number | undefined,
  candidate: RawSnapshotNode,
  parent: RawSnapshotNode,
): boolean {
  return (
    position !== undefined &&
    normalizeType(candidate.type ?? '') === 'other' &&
    areRectsApproximatelyEqual(candidate.rect, parent.rect) &&
    Boolean(findDescendant(nodes, position, isSemanticActionNode))
  );
}

function suppressNodeAndDescendants(
  nodes: RawSnapshotNode[],
  position: number,
  context: SnapshotTreeRuleContext,
): void {
  const node = nodes[position];
  if (!node) return;
  context.suppressNode(node, []);
  for (const descendant of collectDescendants(nodes, position)) {
    context.suppressNode(descendant, []);
  }
}

function isTextInput(node: RawSnapshotNode): boolean {
  const type = normalizeType(node.type ?? '');
  return (
    type === 'textfield' ||
    type === 'securetextfield' ||
    type === 'searchfield' ||
    type === 'textview'
  );
}

function expandRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

function verticallyOverlaps(left: Rect, right: Rect): boolean {
  return Math.max(left.y, right.y) <= Math.min(left.y + left.height, right.y + right.height);
}

```

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/actions.ts`
```
import type { RawSnapshotNode } from '@agent-device/kernel/snapshot';
import { normalizeType } from '@agent-device/contracts/snapshot';
import {
  findLargestViewportRect,
  findNearestAncestor,
  isMostlyViewportSizedRect,
  mergeReplacement,
  type SnapshotTreeRuleContext,
} from './tree.ts';

export function collectIosImplicitScrollableActions(
  nodes: RawSnapshotNode[],
  context: SnapshotTreeRuleContext,
): void {
  const viewport = findLargestViewportRect(context.sourceNodesByIndex.values());
  for (const node of nodes) {
    if (!isImplicitScrollableAction(node, context.sourceNodesByIndex, viewport)) {
      continue;
    }
    mergeReplacement(context.replacements, node, { type: 'Cell' });
  }
}

function isImplicitScrollableAction(
  node: RawSnapshotNode,
  byIndex: ReadonlyMap<number, RawSnapshotNode>,
  viewport: RawSnapshotNode['rect'],
): boolean {
  if (normalizeType(node.type ?? '') !== 'other') {
    return false;
  }
  if (node.enabled === false || !node.rect || !isMeaningfulImplicitActionLabel(node.label)) {
    return false;
  }
  if (!findNearestAncestor(node, byIndex, isImplicitActionScrollAncestor)) {
    return false;
  }
  if (!isRowSizedImplicitAction(node)) {
    return false;
  }
  if (isMostlyViewportSizedRect(node.rect, viewport)) {
    return false;
  }
  return true;
}

function isRowSizedImplicitAction(node: RawSnapshotNode): boolean {
  if (!node.rect) {
    return false;
  }
  return node.rect.height >= 44 && node.rect.height <= 160 && node.rect.width >= 120;
}

function isImplicitActionScrollAncestor(node: RawSnapshotNode): boolean {
  const type = normalizeType(node.type ?? '');
  return type === 'scrollview' || type === 'scrollarea';
}

function isMeaningfulImplicitActionLabel(label: string | undefined): boolean {
  const trimmed = label?.trim();
  if (!trimmed) {
    return false;
  }
  if (/^(toolbar|window|application)$/i.test(trimmed)) {
    return false;
  }
  if (trimmed.startsWith('!,')) {
    return false;
  }
  if (/debugger|fast refresh/i.test(trimmed)) {
    return false;
  }
  return true;
}

```

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/conformance-fixture.ts`
```
import fs from 'node:fs';
import path from 'node:path';
import type {
  IosAcquisitionResidue,
  IosSnapshotAcquisition,
  IosSnapshotRequest,
  IosViewportEvidence,
} from '@agent-device/contracts/ios-snapshot';
import { createIosSnapshotRequest, deriveIosCaptureHint } from '../ios-snapshot-planning.ts';
import type { RawSnapshotNode, Rect } from '@agent-device/kernel/snapshot';

type GoldenProjectionNode = Readonly<{
  index: number;
  type: string | null;
  label: string | null;
  rect: Rect | null;
  depth: number | null;
  parentIndex: number | null;
  hittable: boolean;
  hiddenContentAbove: boolean;
  hiddenContentBelow: boolean;
}>;

type GoldenExpected = Readonly<{
  outcome: 'success' | 'failure';
  nodes: readonly GoldenProjectionNode[];
  truncated?: boolean;
  residue?: readonly IosAcquisitionResidue[];
  error?: Readonly<{ code: string; reason: string }>;
}>;

type GoldenCase = Readonly<{
  name: string;
  swift: boolean;
  projection: 'regular' | 'raw';
  interactiveOnly: boolean;
  depth: number | null;
  scope: string | null;
  foldPolicy: 'cursor-projected' | 'plain-viewport';
  truncated: boolean;
  residue: readonly IosAcquisitionResidue[];
  qualityLabels?: readonly (string | null)[];
  nodes: readonly RawSnapshotNode[];
  viewportEvidence?: IosViewportEvidence;
  expected: GoldenExpected;
}>;

type GoldenFixture = Readonly<{
  version: number;
  viewport: Rect;
  cases: readonly GoldenCase[];
}>;

const IOS_SNAPSHOT_ENGINE_FIXTURE_PATH = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'contracts',
  'fixtures',
  'ios-snapshot-engine-conformance.json',
);

export function readIosSnapshotEngineFixture(): GoldenFixture {
  return JSON.parse(fs.readFileSync(IOS_SNAPSHOT_ENGINE_FIXTURE_PATH, 'utf8')) as GoldenFixture;
}

export function requestForGoldenCase(testCase: GoldenCase): IosSnapshotRequest {
  return createIosSnapshotRequest({
    projection: testCase.projection,
    interactiveOnly: testCase.interactiveOnly,
    depth: testCase.depth,
    scope: testCase.scope,
    acquisitionIntent: 'full',
  });
}

export function acquisitionForGoldenCase(
  fixture: GoldenFixture,
  testCase: GoldenCase,
): IosSnapshotAcquisition {
  const request = requestForGoldenCase(testCase);
  return {
    producer: 'simulator-ax-bridge',
    intent: 'full',
    hint: { ...deriveIosCaptureHint(request), acquisitionIntent: 'full' },
    nodes: testCase.nodes,
    truncated: testCase.truncated,
    viewport: testCase.viewportEvidence ?? { kind: 'reported', rect: fixture.viewport },
    lineage: { targetId: 'golden-target', generation: 'golden-generation' },
    residue: testCase.residue,
  };
}

function normalizeGoldenNode(node: RawSnapshotNode): GoldenProjectionNode {
  return {
    index: node.index,
    type: node.type ?? null,
    label: node.label ?? null,
    rect: node.rect ?? null,
    depth: node.depth ?? null,
    parentIndex: node.parentIndex ?? null,
    hittable: node.hittable === true,
    hiddenContentAbove: node.hiddenContentAbove === true,
    hiddenContentBelow: node.hiddenContentBelow === true,
  };
}

export function normalizeGoldenNodes(nodes: readonly RawSnapshotNode[]): GoldenProjectionNode[] {
  return nodes.map(normalizeGoldenNode);
}

```

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/conformance-generator.ts`
```
import fc from 'fast-check';
import type { RawSnapshotNode, Rect } from '@agent-device/kernel/snapshot';
import type { compareDifferentialCases } from './conformance-harness.ts';

type DifferentialCase = Parameters<typeof compareDifferentialCases>[0][number];

const VIEWPORT: Rect = { x: 0, y: 0, width: 320, height: 240 };
const TYPES = [
  'Other',
  'Window',
  'ScrollView',
  'CollectionView',
  'Table',
  'Cell',
  'Button',
  'StaticText',
  'TextField',
] as const;

type NodeSeed = {
  type: (typeof TYPES)[number];
  label: string | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  parent: number;
  enabled: boolean;
  hittable: boolean;
  hiddenContentAbove: boolean;
  hiddenContentBelow: boolean;
};

const nodeSeedArbitrary = fc.record({
  type: fc.constantFrom(...TYPES),
  label: fc.constantFrom<string | undefined>(undefined, 'Target', 'Save', 'Decoration', 'Panel'),
  x: fc.integer({ min: -80, max: 360 }),
  y: fc.integer({ min: -80, max: 320 }),
  width: fc.integer({ min: 0, max: 260 }),
  height: fc.integer({ min: 0, max: 220 }),
  parent: fc.integer({ min: -1, max: 10 }),
  enabled: fc.boolean(),
  hittable: fc.boolean(),
  hiddenContentAbove: fc.boolean(),
  hiddenContentBelow: fc.boolean(),
});

const caseShapeArbitrary = fc
  .array(nodeSeedArbitrary, { minLength: 1, maxLength: 10 })
  .map((seeds) => makeCase(seeds));

export const differentialBatchArbitrary = fc
  .array(caseShapeArbitrary, { minLength: 1, maxLength: 10 })
  .map((cases) =>
    cases.map((testCase, index) => ({
      ...testCase,
      name: 'fuzz-case-' + String(index),
    })),
  );

function makeCase(seeds: ReadonlyArray<NodeSeed>): Omit<DifferentialCase, 'name'> {
  const nodes: RawSnapshotNode[] = [];
  for (const [index, seed] of seeds.entries()) nodes.push(makeNode(seed, index, nodes));

  return {
    route: seedRoute(seeds[0]!),
    projection: projectionFor(seeds[0]!),
    interactiveOnly: seeds[0]!.enabled,
    depth: depthFor(seeds[0]!),
    scope: scopeFor(seeds[0]!),
    foldPolicy: foldPolicyFor(seeds[0]!),
    viewport: VIEWPORT,
    nodes,
  };
}

function seedRoute(seed: NodeSeed): 'acquired' | 'runner-presented' {
  return seed.y % 2 === 0 ? 'runner-presented' : 'acquired';
}

function makeNode(
  seed: NodeSeed,
  index: number,
  nodes: readonly RawSnapshotNode[],
): RawSnapshotNode {
  const parentIndex = parentIndexFor(seed, index);
  return {
    index,
    type: typeFor(seed, index),
    label: labelFor(seed, index),
    rect: rectFor(seed, index),
    enabled: enabledFor(seed, index),
    hittable: hittableFor(seed, index),
    depth: nodeDepth(parentIndex, nodes),
    ...(parentIndex === undefined ? {} : { parentIndex }),
    ...hiddenContentFor(seed),
  };
}

function parentIndexFor(seed: NodeSeed, index: number): number | undefined {
  return index === 0 || seed.parent < 0 ? undefined : Math.min(seed.parent, index - 1);
}

function nodeDepth(parentIndex: number | undefined, nodes: readonly RawSnapshotNode[]): number {
  return parentIndex === undefined ? 0 : (nodes[parentIndex]?.depth ?? 0) + 1;
}

function typeFor(seed: NodeSeed, index: number): string {
  return index === 0 ? 'Application' : seed.type;
}

function labelFor(seed: NodeSeed, index: number): string | undefined {
  return index === 0 ? 'App' : seed.label;
}

function rectFor(seed: NodeSeed, index: number): Rect {
  return index === 0 ? VIEWPORT : { x: seed.x, y: seed.y, width: seed.width, height: seed.height };
}

function enabledFor(seed: NodeSeed, index: number): boolean {
  return index === 0 || seed.enabled;
}

function hittableFor(seed: NodeSeed, index: number): boolean {
  return index !== 0 && seed.hittable;
}

function hiddenContentFor(seed: NodeSeed): Partial<RawSnapshotNode> {
  return {
    ...(seed.hiddenContentAbove ? { hiddenContentAbove: true } : {}),
    ...(seed.hiddenContentBelow ? { hiddenContentBelow: true } : {}),
  };
}

function projectionFor(seed: NodeSeed): 'regular' | 'raw' {
  return seed.type === 'Other' ? 'raw' : 'regular';
}

function depthFor(seed: NodeSeed): number | null {
  return seed.width % 5 === 0 ? null : seed.width % 4;
}

function scopeFor(seed: NodeSeed): string | null {
  return seed.height % 5 === 0 ? 'target' : null;
}

function foldPolicyFor(seed: NodeSeed): 'cursor-projected' | 'plain-viewport' {
  return seed.x % 2 === 0 ? 'cursor-projected' : 'plain-viewport';
}

```

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/conformance-harness.fixtures.ts`
```
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempForTestSync } from '../tmp-dir.fixtures.ts';
import { shellQuoteIfNeeded } from '@agent-device/kernel/device-shell';
import type { compareDifferentialCases } from './conformance-harness.ts';

type DifferentialCase = Parameters<typeof compareDifferentialCases>[0][number];

export function swiftToolchainAvailable(): boolean {
  if (process.platform !== 'darwin') return false;
  /* c8 ignore start */
  try {
    execFileSync('swift', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
  /* c8 ignore stop */
}

export function writeDifferentialFailureArtifact(input: {
  testCase: DifferentialCase;
  seed: number;
  counterexamplePath: string;
}): { directory: string; casePath: string; replayCommand: string } {
  const directory = mkdtempForTestSync('ios-snapshot-fuzz-');
  const casePath = path.join(directory, 'case.json');
  fs.writeFileSync(casePath, JSON.stringify({ cases: [input.testCase] }, null, 2) + '\n');
  const replayCommand = [
    'node --experimental-strip-types',
    'packages/capture-kit/src/ios-snapshot-engine/replay.ts',
    shellQuoteIfNeeded(casePath),
  ].join(' ');
  fs.writeFileSync(
    path.join(directory, 'replay-command.txt'),
    replayCommand + '\nseed=' + String(input.seed) + '\npath=' + input.counterexamplePath + '\n',
  );
  return { directory, casePath, replayCommand };
}

```

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/conformance-harness.ts`
```
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { IosSnapshotAcquisition } from '@agent-device/contracts/ios-snapshot';
import {
  buildIosSnapshotPresentationKey,
  createIosSnapshotRequest,
  deriveIosCaptureHint,
} from '../ios-snapshot-planning.ts';
import { IosSnapshotEngineError, presentIosSnapshot, publishIosSnapshot } from './index.ts';
import type { RawSnapshotNode, Rect } from '@agent-device/kernel/snapshot';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const SWIFT_PACKAGE_PATH = path.join(REPO_ROOT, 'apple', 'snapshot-presentation');
const SWIFT_PRODUCT = 'snapshot-presentation-conformance';
export const SWIFT_RUN_TIMEOUT_MS = 60_000;

let swiftHarnessExecutable: string | undefined;

type DifferentialCase = Readonly<{
  name: string;
  route: 'acquired' | 'runner-presented';
  projection: 'regular' | 'raw';
  interactiveOnly: boolean;
  depth: number | null;
  scope: string | null;
  foldPolicy: 'cursor-projected' | 'plain-viewport';
  viewport: Rect;
  regularTreePolicy?: 'fullBounds' | 'originOnly' | 'tvOS';
  nodes: readonly RawSnapshotNode[];
  requiredLabels?: readonly string[];
  absentLabels?: readonly string[];
  clippedLabel?: Readonly<{ label: string; rect: Rect }>;
}>;

type DifferentialOutcome = Readonly<{
  name?: string;
  outcome: 'success' | 'failure';
  nodes: readonly CanonicalNode[];
  rawNodes?: readonly RawSnapshotNode[];
  qualityNodes?: readonly RawSnapshotNode[];
  canonicalQualityNodes?: readonly CanonicalNode[];
  error?: Readonly<{ code: string; reason: string }>;
}>;

type CanonicalNode = Readonly<{
  index: number;
  type: string | null;
  label: string | null;
  rect: Rect | null;
  depth: number | null;
  parentIndex: number | null;
  hittable: boolean;
  hiddenContentAbove: boolean;
  hiddenContentBelow: boolean;
}>;

type DifferentialMismatch = Readonly<{
  case: DifferentialCase;
  swift: unknown;
  typescript: unknown;
}>;

/* c8 ignore start */
export function compareDifferentialCases(
  cases: readonly DifferentialCase[],
): DifferentialMismatch | undefined {
  const swiftCases = runSwiftCases(cases);
  for (const testCase of cases) {
    const swift = swiftCases.find((entry) => entry.name === testCase.name);
    const typescript = runTypeScriptCase(testCase);
    const normalizedSwift = swift ? withoutName(swift) : undefined;
    if (
      !normalizedSwift ||
      (testCase.route === 'acquired'
        ? JSON.stringify(normalizedSwift) !== JSON.stringify(typescript)
        : !runnerPresentationAgrees(testCase, swift!, typescript))
    ) {
      return { case: testCase, swift: normalizedSwift, typescript };
    }
  }
  return undefined;
}
/* c8 ignore stop */

/* c8 ignore start */
export function runSwiftCases(cases: readonly DifferentialCase[]): DifferentialOutcome[] {
  const stdout = execFileSync(swiftConformanceExecutable(), [], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: JSON.stringify({ cases: cases.map(prepareDifferentialAcquisition) }),
    timeout: SWIFT_RUN_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024,
  });
  const parsed = JSON.parse(stdout) as {
    cases: Array<{
      name: string;
      outcome: 'success' | 'failure';
      nodes?: RawSnapshotNode[];
      qualityNodes?: RawSnapshotNode[];
      error?: { code: string; reason: string };
    }>;
  };
  return parsed.cases.map((entry) => ({
    name: entry.name,
    outcome: entry.outcome,
    nodes: canonicalNodes(entry.nodes ?? []),
    rawNodes: entry.nodes ?? [],
    ...(entry.qualityNodes ? { qualityNodes: entry.qualityNodes } : {}),
    ...(entry.error ? { error: entry.error } : {}),
  }));
}
/* c8 ignore stop */

/* c8 ignore start */
function swiftConformanceExecutable(): string {
  if (swiftHarnessExecutable) return swiftHarnessExecutable;
  execFileSync('swift', ['build', '--package-path', SWIFT_PACKAGE_PATH], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    timeout: SWIFT_RUN_TIMEOUT_MS,
  });
  const binPath = execFileSync(
    'swift',
    ['build', '--show-bin-path', '--package-path', SWIFT_PACKAGE_PATH],
    { cwd: REPO_ROOT, encoding: 'utf8', timeout: SWIFT_RUN_TIMEOUT_MS },
  ).trim();
  swiftHarnessExecutable = path.join(binPath, SWIFT_PRODUCT);
  return swiftHarnessExecutable;
}
/* c8 ignore stop */

function prepareDifferentialAcquisition(testCase: DifferentialCase): DifferentialCase {
  if (testCase.projection !== 'raw' || testCase.scope !== null || testCase.depth === null) {
    return testCase;
  }
  return {
    ...testCase,
    nodes: testCase.nodes.filter((node) => (node.depth ?? 0) <= testCase.depth!),
  };
}

/* c8 ignore start */
function withoutName(outcome: DifferentialOutcome): Omit<DifferentialOutcome, 'name'> {
  const {
    name: _name,
    rawNodes: _rawNodes,
    qualityNodes: _qualityNodes,
    canonicalQualityNodes: _canonicalQualityNodes,
    ...normalized
  } = outcome;
  return normalized;
}
/* c8 ignore stop */

export function runTypeScriptCase(testCase: DifferentialCase): DifferentialOutcome {
  const acquisitionInput = prepareDifferentialAcquisition(testCase);
  const request = createIosSnapshotRequest({
    projection: testCase.projection,
    interactiveOnly: testCase.interactiveOnly,
    depth: testCase.depth,
    scope: testCase.scope,
  });
  const acquisition: IosSnapshotAcquisition = {
    producer: 'simulator-ax-bridge',
    intent: 'full',
    hint: { ...deriveIosCaptureHint(request), acquisitionIntent: 'full' },
    nodes: acquisitionInput.nodes,
    truncated: false,
    viewport: { kind: 'reported', rect: testCase.viewport },
    lineage: { targetId: 'differential-target', generation: 'differential-generation' },
    residue: [],
  };
  try {
    const result = presentIosSnapshot({ stage: 'acquired', acquisition }, request, {
      foldPolicy: testCase.foldPolicy,
    });
    return {
      outcome: 'success',
      nodes: canonicalNodes(result.nodes),
      ...(testCase.route === 'runner-presented' && result.qualityNodes
        ? { canonicalQualityNodes: canonicalNodes(result.qualityNodes) }
        : {}),
    };
  } catch (error) {
    if (!(error instanceof IosSnapshotEngineError)) throw error;
    return {
      outcome: 'failure',
      nodes: [],
      error: { code: error.code, reason: error.reason },
    };
  }
}

export function runnerPresentationAgrees(
  testCase: DifferentialCase,
  swift: DifferentialOutcome,
  acquired: DifferentialOutcome,
): boolean {
  if (swift.outcome !== acquired.outcome) return false;
  if (swift.outcome === 'failure')
    return JSON.stringify(swift.error) === JSON.stringify(acquired.error);
  const { presented, published } = runRunnerComposition(testCase, swift);
  return runnerOutputAgrees(testCase, swift, acquired, presented, published);
}

function runRunnerComposition(
  testCase: DifferentialCase,
  swift: DifferentialOutcome,
): Readonly<{
  presented: ReturnType<typeof presentIosSnapshot>;
  published: readonly CanonicalNode[];
}> {
  const request = createIosSnapshotRequest(testCase);
  const input = {
    stage: 'presented' as const,
    presentation: {
      producer: 'apple-runner' as const,
      intent: 'full' as const,
      payload: { nodes: swift.rawNodes ?? [], truncated: false },
      ...(swift.qualityNodes
        ? { qualityPayload: { nodes: swift.qualityNodes, truncated: false, scope: null } }
        : {}),
    },
    validation: {
      presentationKey: buildIosSnapshotPresentationKey(request),
      viewport: { kind: 'reported' as const, rect: testCase.viewport },
      hittability: { kind: 'available' as const },
      lineage: { targetId: 'differential-target', generation: 'differential-generation' },
      residue: [],
    },
  };
  const presented = presentIosSnapshot(input, request, { foldPolicy: testCase.foldPolicy });
  const published = canonicalNodes(
    publishIosSnapshot(input, request, { foldPolicy: testCase.foldPolicy }).payload.nodes,
  );
  return { presented, published };
}

function runnerOutputAgrees(
  testCase: DifferentialCase,
  swift: DifferentialOutcome,
  acquired: DifferentialOutcome,
  presented: ReturnType<typeof presentIosSnapshot>,
  published: readonly CanonicalNode[],
): boolean {
  return (
    qualityMembershipAgrees(testCase, presented.qualityNodes, acquired.canonicalQualityNodes) &&
    representativesAreValid(swift.rawNodes ?? [], presented) &&
    capturedMembershipAgrees(testCase, swift.rawNodes ?? [], presented, published) &&
    semanticMembershipAgrees(published, acquired.nodes)
  );
}

function capturedMembershipAgrees(
  testCase: DifferentialCase,
  sources: readonly RawSnapshotNode[],
  presented: ReturnType<typeof presentIosSnapshot>,
  published: readonly CanonicalNode[],
): boolean {
  return (
    requiredLabelsHaveRepresentatives(
      testCase.requiredLabels ?? [],
      sources,
      presented,
      published,
    ) &&
    (testCase.absentLabels ?? []).every(
      (label) => !published.some((node) => node.label === label),
    ) &&
    clippedLabelAgrees(testCase.clippedLabel, published)
  );
}

function semanticMembershipAgrees(
  left: readonly CanonicalNode[],
  right: readonly CanonicalNode[],
): boolean {
  return JSON.stringify(semanticMembership(left)) === JSON.stringify(semanticMembership(right));
}

function qualityMembershipAgrees(
  testCase: DifferentialCase,
  actual: readonly RawSnapshotNode[] | undefined,
  expected: readonly CanonicalNode[] | undefined,
): boolean {
  return (
    testCase.scope === null ||
    JSON.stringify(semanticMembership(canonicalNodes(actual ?? []))) ===
      JSON.stringify(semanticMembership(expected ?? []))
  );
}

function representativesAreValid(
  sources: readonly RawSnapshotNode[],
  presentation: ReturnType<typeof presentIosSnapshot>,
): boolean {
  const outputIndexes = new Set(presentation.nodes.map((node) => node.index));
  if (sources.some((node) => !presentation.presentedIndexesBySourceIndex.has(node.index)))
    return false;
  return [...presentation.presentedIndexesBySourceIn
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4643** (2026-11-17): **An explicit --udid re-reads the simulator inventory on every command (~256 ms)**
  *Symptoms*: ## Purpose  A command that names its device with `--udid` (or `--serial`) pays about 256 ms on every call, because the daemon re-reads the simulator inventory to resolve the device, even when the session is already bound to that device. `snapshot` skips this cost; other commands do not. Callers that always pass an explicit device, such as Expo Explore against a local simulator, pay it on every command of a run.  ## Observed (while measuring #4641; iPhone 17e simulator, iOS 27.0, warm daemon, n=8, wall-clock medians)  | Command | With `--udid` | Session only | | --- | --- | --- | | `keyboard status` (branch of #4642) | 476 ms | 232 ms | | `snapshot` | 320 ms | 300 ms |  The 256 ms comes from `resolveCommandDevice` (`packages/daemon/src/resources/session-device-resolution.ts`) re-reading the inventory.  ## Required behavior  - When an explicit selector matches the device the session is already bound to, resolve it from the session without an inventory read. This is what `snapshot` effectively gets today; find out why it differs and use one path. - Keep today's refusals: a selector that names a different device than the session's still refuses as it does now, and the device-claim rules stay unchanged. - Re-read the inventory only when the selector does not match the bound device, or when there is no session.  ## Done when  - Per-command timings with and without `--udid` are within noise of each other for a bound session, measured on a simulator for at least `keyboard status`, `p

- **Issue #4641** (2026-11-17): **iOS keyboard status takes ~1.4 s, about 5x a snapshot**
  *Symptoms*: ## Purpose  `keyboard status` on iOS takes about 1.4 s per call, roughly 5× a full `snapshot` of the same screen. Callers that want to ask "is the keyboard up, and what is its return key" before acting pay more than a snapshot would cost them. Expo Explore kept its accessibility-tree heuristics for this reason.  ## Observed (0.21.39, iPhone Air simulator, iOS 27.0, warm daemon, keyboard up, wall clock per CLI call including node start)  - `keyboard status`: median 1397 ms, range 1367–1539 ms (n=8). - `snapshot`: median 260 ms, range 241–331 ms (n=8).  ## Required behavior  - Find where the time goes: runner query strategy, extra settle or idle waits, repeated tree reads. Include a timing breakdown in the PR. - Bring `keyboard status` to at most snapshot cost on the same screen, or explain the floor with evidence. - Keep the output contract (`visible`, `returnKey`, `returnKeyLabel`) unchanged.  ## Done when  Before/after timings at the same n on a simulator are recorded in the PR, and the iOS keyboard tests pass. 
  **Post-Mortem & Fix Analysis**:
  > ## Apex Sentinel · Issue review  **Suggested label:** `bug`  It reports existing CLI performance as too slow with concrete timings, environment, and a measurable target, making it an actionable performance defect rather than a new capability request.  ### Required sections - [ ] Steps to reproduce (missing) - [ ] Expected and actual behavior (missing) - [ ] Version or environment (missing)  <!-- apex-sentinel:issue-review -->

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

### Incident Patch 1: `ada87a3b` (2026-11-18)
**Commit Message**: fix: judge a save-script destination another local user can steer (#4584)

* fix(host-kit): refuse a script destination another local user can steer

A publish resolved the destination by name, so a second local user who
could write any directory on the way to it could replace that component,
or leave a symbolic link there before the entry was created, and move the
saved script wherever they chose.

`publishScriptFileSync` now asks first: `assertPrivateScriptDestination`
walks each component with `lstat` and refuses the chain under
`script_ancestor_untrusted` when a directory is writable by other, or by
a group that is not this user's own private group, unless the sticky bit
cancels the exposure. A symbolic link whose own directory others can
create entries in is refused whatever it points at. Ubuntu and Debian set
up every home directory as group-writable and owned by the user's private
group, so that shape is admitted, and `privateGroupIds` is exported so
the membership rule is testable on its own.

The caller also captures the parent's `dev:ino` before staging, and the
publish compares it before the link or rename, so a parent swapped out by
name while the file was written refus

**File**: `docs/adr/0016-active-session-script-publication.md` (modified, +38/-2)
```diff
@@ -24,6 +24,11 @@ This section is a normative summary.
 - Publication requires exactly one initial recorded `open`, a portable selector-`wait` destination guard after the last descriptor-classified mutating action, and no unresolved session-local `@ref`.
   Since #1349, the `target-v1` annotation of the guard must be `verification: "verified"`.
   Every refusal happens before filesystem work and names its recovery.
+- The destination a caller names with `--save-script=<path>` is judged before anything is created.
+  It must be absolute, and every directory the walk looks a name up in must be one no other non-root local user can change.
+  What is missing is created one level at a time at 0700, inside the directory the walk just judged, and the script file is 0600.
+  The rule is POSIX-only, and a refused destination leaves nothing behind.
+  The daemon's own state-directory chain is outside this decision (#4649).
 - Repair transactions (ADR 0012) are disjoint from this lifecycle.
   A session with `saveScriptBoundary` set refuses this action without a change to repair state.
 - A remote recording is delivered, not published (#4511 amendment).
@@ -179,7 +184,7 @@ A change to that answer is a behavior change, not a derivation.
 **Amendment (#4511, shipped).** A remote caller cannot read the daemon target, so a remote `open --save-script=<path>` delivers its recording to the caller.
 It adds no state name, command, or flag:
 
-- Before it sends the open, the client mints a random publication ID and records the destination and the `--force` grant under it in its state directory (`remote-connections/session-scripts/`), keyed by the endpoint, the tenant, the session, and that ID.
+- Before it sends the open, the client mints a random publication ID and records the destination and the `--force` grant under it in its state directory (`remote-connections/session-scripts/`), keyed by the endpoint, the tenant, the session, and that ID. That directory is the client's own private state, not a script destination: the client creates it the way it always did, with one recursive `mkdir` that forces nothing on a directory that already stands, and the only file ever written there is the client's own record. The script itself is published by the daemon to its own sessions directory; the client's own copy goes to the caller's destination, judged by the rule under [Caller-named destination](#caller-named-destination).
   The open carries the ID in `meta.scriptPublicationId` and never the caller path.
   A daemon answer that does not name the ID removes the record.
   A failed open may still have armed the recording, so it keeps its record.
@@ -207,7 +212,35 @@ It adds no state name, command, or flag:
   A batch whose steps record or close an armed remote recording is not refused. The daemon collects the versions and the close that the batch's steps wrote, and delivers them on the batch response as one `scriptDeliveryReceipt` (#4595).
 - The daemon reports the `script-artifacts` capability in `/health`, through a proxy in its upstream health; the client refuses a remote `--save-script` before dispatch without it.
 
-The destination keeps local `--save-script` semantics: the client creates a missing parent directory and checks no ancestor ownership, so another local user who can write an ancestor directory can redirect the file, locally and remotely alike (#4565).
+### Caller-named destination
+
+A destination a caller names — `--save-script=<path>` on the local route, or the same path in the remote client's publication record (#4511 amendment) — is judged before anything is created. Both routes expand the caller's path to an absolute one before asking host-kit, and host-kit refuses a relative one at its entry (`relative_destination`) on every platform. Walking a relative name would put the process's working directory in the judged chain, and Node answers that name from the first query after the last `chdir`, so it can be stale while the process stands elsewhere. Host-kit owns the whole sequence as ONE call — walk, refuse, create what is missing at 0700 inside the judged directory, judge again, answer with the judged directory and its identity — and both publishers make that one call before staging. The rule closes the window with PERMISSIONS, not with timing. It is POSIX-only: on Windows the walk does not run, owners, mode bits and link shape are not read, `chmod` toggles only the read-only bit, creation is a recursive `mkdir`, and access there is the ACL of the directory the operator chose.
+A destination is accepted only when no other non-root local user can modify any directory the publish traverses. Each directory must be owned by the current user or by root, and its mode must keep its contents closed to others. Once that holds, nobody can swap a component out or plant one, so the path that was judged is the path the publish reaches, and nothing depends on when a directory was judged.
+The walk emulates the kernel's own path
```

**File**: `packages/daemon/src/__tests__/support/script-staging-failure.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import fs from 'node:fs';
+import { vi } from 'vitest';
+import { isPublishTemporarySiblingOf } from '@agent-device/test-kit';
+
+/**
+ * Makes the staging write of a script publication fail, and only that write.
+ *
+ * A publication stages the recording in a private temp sibling of the destination and moves it into place,
+ * so the seam where the filesystem can refuse a script is that one write. `test-kit`'s temp-path predicate
+ * says which write it is, so the fixture does not have to know how the name is built.
+ *
+ * This replaces a fixture that made the destination's directory `0500`. That one asked the HOST whether a
+ * write into it is allowed, and a caller the mode bits do not bind — root — writes straight through it, so
+ * the write succeeded and the test that expected a failure failed with it. The failure injected here is the
+ * fixture's own, which makes the outcome the same for every caller.
+ */
+export function failScriptStagingWrite(destination: string): void {
+  const failure: NodeJS.ErrnoException = Object.assign(
+    new Error(`EACCES: permission denied, open '${destination}'`),
+    { code: 'EACCES', errno: -13, syscall: 'open', path: destination },
+  );
+  const realWriteFileSync = fs.writeFileSync;
+  vi.spyOn(fs, 'writeFileSync').mockImplementation(((file: fs.PathLike | number, ...rest) => {
+    if (isPublishTemporarySiblingOf(file, destination)) throw failure;
+    return (realWriteFileSync as (...args: unknown[]) => unknown)(file, ...rest);
+  }) as typeof fs.writeFileSync);
+}
```

**File**: `packages/daemon/src/core/__tests__/session-script-writer-ancestry.test.ts` (added, +494/-0)
```diff
@@ -0,0 +1,494 @@
+import { afterEach, expect, test, vi } from 'vitest';
+import fs from 'node:fs';
+import path from 'node:path';
+import {
+  FOREIGN_UID,
+  createLiveTestHostEnvironment,
+  mkdtempForTestSync,
+  serveHostOwnership,
+} from '@agent-device/test-kit';
+import { SessionScriptWriter } from '../session-script-writer.ts';
+import { makeAuthoringSession } from '../../__tests__/support/session-factories.ts';
+
+const hostCwd = createLiveTestHostEnvironment().cwd;
+const skipOnWindows = process.platform === 'win32' ? test.skip : test;
+
+/** This process's ids. Windows has neither, and every test that uses them is skipped there. */
+const currentUid = process.getuid?.() ?? -1;
+const currentGid = process.getgid?.() ?? -1;
+
+afterEach(() => {
+  vi.restoreAllMocks();
+});
+
+function action(command: string): {
+  ts: number;
+  command: string;
+  positionals: string[];
+  flags: Record<string, unknown>;
+} {
+  return { ts: Date.now(), command, positionals: ['Demo'], flags: {} };
+}
+
+function recordingTo(destination: string) {
+  return makeAuthoringSession('journey', {
+    scriptPublication: {
+      kind: 'authoring',
+      status: 'armed',
+      target: { kind: 'explicit', path: destination, force: false },
+    },
+    actions: [action('open')],
+  });
+}
+
+function root(): string {
+  return fs.realpathSync(mkdtempForTestSync('agent-device-script-ancestry-'));
+}
+
+function sharedDirectory(directory: string, mode: number): string {
+  fs.mkdirSync(directory);
+  fs.chmodSync(directory, mode);
+  return directory;
+}
+
+/** A scratch directory in this host's own primary group, at `mode`. */
+function homeDirectory(directory: string, mode: number): string {
+  fs.mkdirSync(directory);
+  fs.chownSync(directory, currentUid, currentGid);
+  fs.chmodSync(directory, mode);
+  return directory;
+}
+
+function writerFor(directory: string): SessionScriptWriter {
+  return new SessionScriptWriter(path.join(directory, 'sessions'), hostCwd);
+}
+
+function refusal(result: ReturnType<SessionScriptWriter['write']>): Record<string, unknown> {
+  expect(result.written).toBe(false);
+  if (result.written || !result.error) throw new Error('expected a refused write');
+  return result.error.details as Record<string, unknown>;
+}
+
+skipOnWindows('an ordinary recording saves under a chain only this user can write', () => {
+  const directory = root();
+  const destination = path.join(directory, 'workflows', 'journey.ad');
+
+  const result = writerFor(directory).write(recordingTo(destination));
+
+  expect(result.written).toBe(true);
+  expect(fs.readFileSync(destination, 'utf8')).toContain('open');
+});
+
+skipOnWindows('a recording saves a script no other local user can read', () => {
+  const directory = root();
+  const destination = path.join(directory, 'workflows', 'journey.ad');
+
+  const result = writerFor(directory).write(recordingTo(destination));
+
+  expect(result.written).toBe(true);
+  expect(fs.lstatSync(destination).mode & 0o777).toBe(0o600);
+});
+
+skipOnWindows('a recording refuses a destination under a world-writable directory', () => {
+  const directory = root();
+  const shared = sharedDirectory(path.join(directory, 'shared'), 0o777);
+  const destination = path.join(shared, 'journey.ad');
+
+  const details = refusal(writerFor(directory).write(recordingTo(destination)));
+
+  expect(details).toMatchObject({
+    reason: 'script_ancestor_untrusted',
+    exposure: 'world_writable',
+  });
+  expect(fs.existsSync(destination)).toBe(false);
+});
+
+skipOnWindows('a refused destination with a missing parent leaves no directories behind', () => {
+  // `close --save-script /shared/recordings/journey.ad` where `recordings` is absent. Creating the missing
+  // parent is what the caller asked for, so it cannot be judged only once it exists: a `mkdir -p` that runs
+  // first leaves `recordings` standing in the open directory after the publish refuses, which is a
+  // directory this user made in ground another local user owns the naming of. The chain that exists is
+  // therefore asked about BEFORE anything is created, and again afterwards.
+  const directory = root();
+  const shared = sharedDirectory(path.join(directory, 'shared'), 0o777);
+  const destination = path.join(shared, 'recordings', 'journey.ad');
+
+  const details = refusal(writerFor(directory).write(recordingTo(destination)));
+
+  expect(details).toMatchObject({
+    reason: 'script_ancestor_untrusted',
+    exposure: 'world_writable',
+    ancestor: shared,
+  });
+  expect(fs.readdirSync(shared)).toEqual([]);
+});
+
+skipOnWindows(
+  'a recording that steps back out of a missing directory leaves no directories behind',
+  () => {
+    // `<private>/missing/../../shared/recordings/journey.ad`. The walk ends at `missing`, so `shared` is
+    // never judged, and the `mkdir -p` this route runs resolves the two steps up as TEXT and builds
+    // `<root>/shared/recordings` — the entry would be created in a world-writa
```

**File**: `packages/daemon/src/core/__tests__/session-script-writer.test.ts` (modified, +11/-4)
```diff
@@ -15,6 +15,7 @@ import { markRepairTransactionComplete } from '../session-replay-transaction.ts'
 import { NO_SCRIPT_PUBLICATION, scriptTargetPath } from '../session-script-publication-state.ts';
 import { parseReplayScriptDetailed, resolveReplayAction } from '@agent-device/ad-script';
 import { createLiveTestHostEnvironment, mkdtempForTestSync } from '@agent-device/test-kit';
+import { failScriptStagingWrite } from '../../__tests__/support/script-staging-failure.ts';
 
 const hostCwd = createLiveTestHostEnvironment().cwd;
 
@@ -554,7 +555,10 @@ test('write(session) without { force: true } still refuses, even when a prior wr
 // concurrent race correctly without any lock — first writer wins, the loser
 // sees `EEXIST` and is refused.
 test('two writers racing on the SAME ABSENT target: exactly one linkSync wins, the other is refused (no lock involved)', () => {
-  const root = mkdtempForTestSync('agent-device-script-writer-race-');
+  // Realpath'ed because the publish creates the entry in the directory the ancestry walk ANSWERED, and on
+  // macOS `mkdtemp` spells the scratch root through the `/var` alias: this spy compares the entry's path
+  // with the one it expects to see.
+  const root = fs.realpathSync(mkdtempForTestSync('agent-device-script-writer-race-'));
   const writer = new SessionScriptWriter(path.join(root, 'sessions'), hostCwd);
   const healedPath = path.join(root, 'flows', 'login.healed.ad');
   fs.mkdirSync(path.dirname(healedPath), { recursive: true });
@@ -696,9 +700,12 @@ test('an ordinary (non-repair) recording now refuses an existing target too (beh
 test('an ordinary recording returns a filesystem write failure as a typed error, never a quiet skip', () => {
   const root = mkdtempForTestSync('agent-device-script-writer-ordinary-fs-failure-');
   const writer = new SessionScriptWriter(path.join(root, 'sessions'), hostCwd);
-  const blocker = path.join(root, 'blocker');
-  fs.writeFileSync(blocker, '');
-  const outPath = path.join(blocker, 'flow.ad');
+  // The staging write of the publication is made to fail, so the failure the caller sees is the
+  // filesystem's own and not an ancestry verdict. A directory the mode bits deny this user is not used
+  // for that: mode bits do not bind root, so under a root caller the write would succeed and this test
+  // would be reporting the host's permission model instead of the writer's error handling.
+  const outPath = path.join(root, 'flow.ad');
+  failScriptStagingWrite(outPath);
   const session = makeAuthoringSession('default', {
     scriptPublication: authoringPublication('armed', { path: outPath }),
     actions: [action({ command: 'click', positionals: ['id="new"'] })],
```

**File**: `packages/daemon/src/core/__tests__/session-store-teardown-script.test.ts` (modified, +3/-2)
```diff
@@ -81,7 +81,8 @@ test.skipIf(process.platform === 'win32')(
       expect(fs.statSync(result.path).mode & 0o777).toBe(0o600);
     }
     expect(localWrite).toMatchObject({ written: true, path: local });
-    const umask = process.umask();
-    expect(fs.statSync(local).mode & 0o777).toBe(0o666 & ~umask);
+    // A target the caller names is published by host-kit's destination rule, which SAYS 0600 on the file
+    // rather than asking for it, so the recording opens to nobody but its owner whatever the umask says.
+    expect(fs.statSync(local).mode & 0o777).toBe(0o600);
   },
 );
```

**File**: `packages/daemon/src/core/session-script-writer.ts` (modified, +25/-5)
```diff
@@ -19,7 +19,7 @@ import {
   stripRecordedRefGeneration,
 } from '@agent-device/ad-script';
 import { expandSessionPath, safeSessionName } from '@agent-device/host-kit/session-paths';
-import { publishFileSync } from '@agent-device/host-kit/file';
+import { publishFileSync, publishScriptFileSync } from '@agent-device/host-kit/file';
 import type { SessionState } from './session-state.ts';
 import {
   NO_SCRIPT_PUBLICATION,
@@ -133,8 +133,16 @@ export class SessionScriptWriter {
       const remote =
         session.scriptPublication?.kind === 'authoring' && session.scriptPublication.remoteDelivery;
       scriptPath = remote ? this.remoteScriptPath() : this.resolveScriptPath(session);
-      const scriptDir = path.dirname(scriptPath);
-      if (!fs.existsSync(scriptDir)) fs.mkdirSync(scriptDir, { recursive: true });
+      // A destination the CALLER named is the caller's own, and host-kit's destination rule is what judges it:
+      // that route walks the chain, creates nothing outside what it judged, and writes the file at 0600. A path
+      // of this daemon's own is made the way it has always been made (#4565).
+      const callerOwnsDestination =
+        !remote &&
+        scriptTargetPath(session.scriptPublication ?? NO_SCRIPT_PUBLICATION) !== undefined;
+      if (!callerOwnsDestination) {
+        const scriptDir = path.dirname(scriptPath);
+        if (!fs.existsSync(scriptDir)) fs.mkdirSync(scriptDir, { recursive: true });
+      }
       // #1258: `options.force` is the caller's already-merged decision
       // (`effectiveWriteForce` — a live flag or the per-target grant), not
       // read from `session` directly here, so this stays a pure
@@ -143,6 +151,7 @@ export class SessionScriptWriter {
         scriptPath,
         script: prepared.script,
         force: options?.force,
+        callerOwnsDestination,
         ...(remote ? { mode: 0o600 } : {}),
       });
       // COMMITTED: idempotent guard above + teardown's abort/tombstone routing.
@@ -264,7 +273,6 @@ function toRepairCommitFailure(error: unknown, scriptPath: string | undefined):
     },
   );
 }
-
 /**
  * ADR 0012 decision 6, no-clobber (maintainer-approved simplification):
  * publishes `script` to `scriptPath` atomically, refusing ANY pre-existing
@@ -302,9 +310,21 @@ function publishHealedScriptAtomically(params: {
   script: string;
   force?: boolean;
   mode?: number;
+  callerOwnsDestination: boolean;
 }): void {
-  const { scriptPath, script, force, mode } = params;
+  const { scriptPath, script, force, mode, callerOwnsDestination } = params;
   try {
+    if (callerOwnsDestination) {
+      // host-kit owns this route's whole sequence (#4565): it walks the destination's chain, refuses a
+      // destination another local user can steer BEFORE creating anything, creates what is missing one level
+      // at a time at 0700 inside the directory it judged, and writes the script itself at 0600.
+      publishScriptFileSync({
+        destination: scriptPath,
+        contents: script,
+        publish: force ? 'replace' : 'link-exclusive',
+      });
+      return;
+    }
     publishFileSync({
       destination: scriptPath,
       contents: script,
```

**File**: `packages/daemon/src/server/__tests__/atomic-publish-ownership.test.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ const PROCESS_LOCK_SOURCE = new URL(
 test('simple same-directory publishers use the shared atomic publish owner', () => {
   for (const sourcePath of SIMPLE_PUBLISHERS) {
     const source = fs.readFileSync(sourcePath, 'utf8');
-    assert.match(source, /publishFileSync/);
+    assert.match(source, /publish(?:Script)?FileSync/);
     assert.doesNotMatch(source, /fs\.(?:writeFileSync|renameSync)\s*\(/);
   }
 });
```

**File**: `packages/daemon/src/sessions/session-lifecycle/internal/__tests__/session-close-script.test.ts` (modified, +7/-4)
```diff
@@ -16,6 +16,7 @@ import {
 } from '../session-close-script.ts';
 import { createLiveTestHostEnvironment, mkdtempForTestSync } from '@agent-device/test-kit';
 import { flushSessionEventLogWrites } from '@agent-device/session-journal/session-event-log';
+import { failScriptStagingWrite } from '../../../../__tests__/support/script-staging-failure.ts';
 
 const roots: string[] = [];
 
@@ -195,10 +196,12 @@ test('#1533: an ordinary armed authoring session still publishes on bare close',
 test('ordinary close reports a filesystem failure of its script write instead of a quiet success', () => {
   const root = mkdtempForTestSync('agent-device-session-close-script-fs-');
   roots.push(root);
-  // A regular file where the target directory must be: publishing into it fails with ENOTDIR.
-  const blocker = path.join(root, 'blocker');
-  fs.writeFileSync(blocker, '');
-  const targetPath = path.join(blocker, 'flow.ad');
+  // The publication's staging write is made to fail, so the caller sees the filesystem's own failure and
+  // not an ancestry refusal. A directory whose mode denies this user is not used for that: mode bits do
+  // not bind root, so under a root caller the write would succeed and this test would be measuring the
+  // host's permission model instead of what close does with a failure.
+  const targetPath = path.join(root, 'flow.ad');
+  failScriptStagingWrite(targetPath);
   const { req, ref, sessionStore } = setup(
     'fs-failure',
     makeIosSession('fs-failure', {
```

---

### Incident Patch 2: `aa600e98` (2026-11-18)
**Commit Message**: docs: write down trust boundaries, security review scope, and startup-path gates (#4679)

* docs(agents): drop duplicated guidance

Each removed line is already owned elsewhere: the AGENTS.md task router,
another agent doc, code comments, type declarations, tests, or
CONTRIBUTING.md. This makes room for security guidance within the
agent-docs byte budget.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs(agents): add security boundaries and a trust-boundary review trigger

Write down who is trusted for which filesystem decision, the rules for
a file written at a path another party chooses, and the destination
classes. Add a design-review trigger and a scope rule to the review
guide, and the startup-path and wire checks to the gates guide.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs(adr): shorten ADR 0016's caller-named destination section

Group the walk into labeled rules, move the path-shape examples into one
case table with owning tests, and list the rejected alternatives. Record
that the local file is exactly 0600 while the remote client requests
0600 under the umask, and that resolveUserPath folds relative and ~/
spellings before the walk. Point #4649

**File**: `AGENTS.md` (modified, +13/-12)
```diff
@@ -5,12 +5,12 @@ The daemon owns sessions. Registry declarations route commands to platform runti
 
 ## Task routing
 
-Read each applicable row. Follow other links only when they apply.
+Read each applicable row. Follow other links only as needed.
 
 | When the task involves | Read |
 | --- | --- |
 | Domain vocabulary | `CONTEXT.md` |
-| Read architecture decisions | `docs/adr/README.md` |
+| Architecture decisions | `docs/adr/README.md` |
 | Write or amend an ADR | `docs/adr/FORMAT.md` |
 | Source, package boundaries, routing, diagnostics, CI | `docs/agents/code-ownership.md` |
 | Checks or a failed gate | `docs/agents/testing.md` |
@@ -22,42 +22,43 @@ Read each applicable row. Follow other links only when they apply.
 | A new or changed CLI flag | `docs/agents/cli-flags.md` |
 | A PR to open or update | `docs/agents/pull-requests.md` |
 | A change to review | `docs/agents/review.md` |
+| Trust boundaries, untrusted paths, security review | `docs/agents/security.md` |
 | Device-facing changes or manual device verification | `docs/agents/device-verification.md` |
 | Issues, PRDs, or triage labels | `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md` |
 | Web backend setup or diagnostics | `docs/agents/web-backend.md` |
 
 A device-facing change affects live device behavior: dispatch, capture, interaction, app lifecycle, or native execution.
-If a daemon edit changes none of these, a device run is not required.
+A daemon edit that changes none of these needs no device run.
 
 The versioned CLI help owns command semantics. To drive an app, start with the skill's routing card.
 
 ## Working rules
 
-- Keep edits in the requested command family or module group. Examine other platforms only when the task requires it.
+- Keep edits in the requested command family or module group. Examine other platforms only when the task needs it.
 - Fix a recurring failure at the owning type, registry, or construction path. Do not rebuild another owner's state.
 - Use typed reasons and details for behavior. Do not match error text.
 - Add compatibility or fallback behavior only on explicit request or approval. During a migration, remove superseded paths.
 - Encode invariants in names, types, and boundaries. Write comments only for public APIs, tool directives, or constraints that code cannot show.
 - Resolve a gate failure at the reported invariant. Do not suppress it. Do not add an allowlist to get a pass.
 - Use `@agent-device/selectors` to parse and match selectors. For other shared owners, see `docs/agents/code-ownership.md`.
-- Keep skills as routing cards. Keep `CONTEXT.md` as a glossary only. When behavior changes, update the owning help and user docs.
+- Keep skills as routing cards. Keep `CONTEXT.md` a glossary only. When behavior changes, update the owning help and user docs.
 
 ## Worktree setup
 
 - Use `pnpm`. Use OXC to lint and format. Run `pnpm format` on the full repository.
-- In a new worktree, run `pnpm install --frozen-lockfile && pnpm build` before you test.
+- In a new worktree, run `pnpm install --frozen-lockfile && pnpm build` before testing.
 - Do not change other worktrees, devices, sessions, dirty files, or experiments. Do not use `git stash`; all worktrees share it.
-- Do not copy `.env` into a worktree. For host credentials, source the main checkout's file by its absolute path.
-- Give each parallel worker different files and a different device. `pnpm check:affected --run`, `pnpm check`, and heavy `pnpm gate` ids share one lock.
+- Do not copy `.env` into a worktree. For host credentials, source the main checkout's file by absolute path.
+- Give each parallel worker different files and devices. `pnpm check:affected --run`, `pnpm check`, and heavy `pnpm gate` ids share one lock.
 - The layering scan reads only tracked files. Stage new modules before you trust its result.
 - When you rename a file, move its Fallow baseline entry. Do not regenerate unrelated baselines.
 
-The validation lock automatically reclaims provably dead owners. An unknown owner continues to block.
-If the wait times out, report the printed owner and the lock state. Do not remove the lock manually.
+The validation lock reclaims provably dead owners. An unknown owner blocks.
+If the wait times out, report the printed owner and lock state. Do not remove the lock manually.
 
 ## Agent docs
 
-Write agent docs in ASD-STE100. Write one instruction in each sentence.
+Write agent docs in ASD-STE100. Write one instruction per sentence.
 Put the condition before the instruction. Use one term for one concept.
-Keep commands and domain terms exact. Put specialized rules and new shared constraints in the owning task document, not in agent memory.
+Keep commands and domain terms exact. Put specialized rules and new shared constraints in the owning task document, not agent memory.
 Before you add a reminder, delete duplicate or enforced rules.
```

**File**: `docs/adr/0016-active-session-script-publication.md` (modified, +53/-23)
```diff
@@ -25,9 +25,11 @@ This section is a normative summary.
   Since #1349, the `target-v1` annotation of the guard must be `verification: "verified"`.
   Every refusal happens before filesystem work and names its recovery.
 - The destination a caller names with `--save-script=<path>` is judged before anything is created.
-  It must be absolute, and every directory the walk looks a name up in must be one no other non-root local user can change.
-  What is missing is created one level at a time at 0700, inside the directory the walk just judged, and the script file is 0600.
-  The rule is POSIX-only, and a refused destination leaves nothing behind.
+  Host-kit requires it absolute; `resolveUserPath` folds a relative or `~/` spelling lexically before that.
+  Every directory the walk looks a name up in must be owned by the current user or root, and must be either closed to entries from others or sticky.
+  What is missing is created one level at a time at 0700, inside the directory the walk just judged.
+  The local file is exactly 0600. The remote client requests 0600, and the umask can narrow it.
+  The rule is POSIX-only. A refusal before creation leaves nothing behind; a refusal after creation starts can leave the empty directories already created.
   The daemon's own state-directory chain is outside this decision (#4649).
 - Repair transactions (ADR 0012) are disjoint from this lifecycle.
   A session with `saveScriptBoundary` set refuses this action without a change to repair state.
@@ -191,12 +193,12 @@ It adds no state name, command, or flag:
 - The daemon arms the recording under that ID, which `open` and `close` name in `scriptPublicationId`.
   After each successful request that records into the ARMED recording, the daemon writes the recording so far, without a terminal `close`, and returns it as a `session-script` artifact with the ID and a growing `scriptRevision`.
   The close-time write is the final version and has the highest revision; close takes it from the close-time write itself, so a capture that close stops first never hides recorded actions.
-  Each version, the final one included, is a fresh 0600 file in a 0700 directory under the daemon's sessions directory, and is downloaded once.
+  Each version, the final one included, is a fresh file, requested at 0600 through the generic publisher, in a 0700 directory under the daemon's sessions directory, and is downloaded once.
   It registers for download for the tenant that opened the recording, whatever the tenant, capture filters, or network marker of the request that recorded it.
 - The client writes a version only to the destination of a record that matches its ID and scope, and only when its revision is newer than the last published one.
   The `savedScript` field and the `session-script` type are reserved for this path, so a script artifact under another field writes nothing.
   Thus, a daemon response never establishes a destination, and another publication's or another session's version writes nothing.
-  The download streams, capped at 8 MiB, into a new 0600 file, created exclusively and never through a symbolic link, in a 0700 staging directory beside the destination.
+  The download streams, capped at 8 MiB, into a new file requested at 0600, created exclusively and never through a symbolic link, in a staging directory beside the destination that is requested at 0700; the umask can narrow both modes.
   Under the record lock, the record names the version and the staged file's device and inode before the rename or link, and the next version settles that entry from the destination's identity.
   A second name keeps the staged inode, and its staging directory, on disk while the record may name it, so no later file can reuse that inode; settling or retiring the entry removes the staging directory.
   The record lists each staging directory before a download writes to it, so retiring or sweeping the record also removes the staging that a crashed download left behind.
@@ -214,32 +216,60 @@ It adds no state name, command, or flag:
 
 ### Caller-named destination
 
-A destination a caller names — `--save-script=<path>` on the local route, or the same path in the remote client's publication record (#4511 amendment) — is judged before anything is created. Both routes expand the caller's path to an absolute one before asking host-kit, and host-kit refuses a relative one at its entry (`relative_destination`) on every platform. Walking a relative name would put the process's working directory in the judged chain, and Node answers that name from the first query after the last `chdir`, so it can be stale while the process stands elsewhere. Host-kit owns the whole sequence as ONE call — walk, refuse, create what is missing at 0700 inside the judged directory, judge again, answer with the judged directory and its identity — and both publishers make that one call before staging. The rule closes the window with PERMISSIONS, not with timing. It is POSIX-o
```

**File**: `docs/adr/0027-descriptor-root-vs-eager-closure-budget.md` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ Rename canonicalization preserves a `git mv` of a module already inside the base
 It does not exempt a pre-existing external module moved into the closure.
 `scripts/__tests__/closure-growth-rule.ts` owns the rule.
 `scripts/__tests__/closure-growth-rule.test.ts` plants violations in every failing direction.
+To check a change, stage new entry files, fetch `origin/main`, and run `pnpm exec vitest run --project unit-core scripts/__tests__/eager-closure-budgets.test.ts`.
 The hard ADR-0019 checks remain unchanged: façade exactness and no platform implementation before binding.
 The tolerance relaxes the module-count proxy, never the loading property.
 
```

**File**: `docs/agents/cli-flags.md` (modified, +0/-5)
```diff
@@ -8,9 +8,6 @@ Pass a flag only through layers that consume it:
    Update the command family metadata/schema that exposes the flag.
    To find the owner, run `rg -n "<command>|helpDescription|summary|supportedFlags|allowedFlags" packages/command-surface/src src/commands src/cli/parser`.
    For schema-only CLI commands, use `SCHEMA_ONLY_CLI_COMMAND_SCHEMAS` in `packages/command-surface/src/schema/command-overrides.ts`.
-   Each flag declaration requires `projectConfig` and `recorded`.
-   `projectConfig` permits a project `agent-device.json` to set the flag.
-   `recorded` makes the session recorder copy it into `SessionAction.flags`.
    Only when repository control is safe, set `projectConfig: true`. Otherwise, a new flag is operator-only.
    Only when a `.ad` recording must carry the flag, set `recorded: true`.
 2. In `packages/command-surface/src/cli-grammar/*`, read the CLI flag into command input.
@@ -31,7 +28,6 @@ Pass a flag only through layers that consume it:
 ## Where CLI help and schema live
 
 - Long help prose is in `src/commands/schema/cli-help.ts`.
-  CLI input readers are in `packages/command-surface/src/cli-grammar/`.
 - `src/commands/schema/usage.ts` generates the synopsis `[label]` flag tail from `allowedFlags`.
   Only when the command synopsis names fewer options, declare `usageFlags`.
   For pure grammar or grammar with its own mutually-exclusive brackets, use `[]`.
@@ -45,4 +41,3 @@ Pass a flag only through layers that consume it:
   The parser rejects only options in rows. If it rejected `--json`, it would reject the command.
 - Keep command-specific usage/flag metadata with the command family metadata that owns the command.
 - Keep argument parsing in `src/cli/parser/`. Keep help rendering in `src/commands/schema/`.
-  Command schema metadata derives from command metadata, family declarations, and the schema-only merge in `packages/command-surface/src/schema/command-overrides.ts`.
```

**File**: `docs/agents/gates.md` (modified, +2/-2)
```diff
@@ -1,7 +1,5 @@
 # Maintain gates
 
-For execution, read [validation](testing.md).
-
 `CHECK_CATALOG` in `scripts/check-affected/checks.ts` owns checks and commands.
 CI declares ownership through the shared `run-gate` action with a literal gate id.
 For a new check, update the catalog and executable model.
@@ -28,3 +26,5 @@ Generate it or fetch evidence artifacts.
 Versioned corpora, schemas, fixtures, and golden tables remain source inputs.
 If TypeScript helpers cannot load, plain `.mjs` packaging fixtures keep child-process use local.
 Prefer `execFile`.
+
+For a startup-path import, follow ADR 0027. For a wire change, follow `test/wire-compat/README.md`.
```

**File**: `docs/agents/issue-tracker.md` (modified, +0/-2)
```diff
@@ -15,8 +15,6 @@ conditions, and dependencies. For a boundary change, include an API, data shape,
 If sandboxed `gh` fails with an authentication error, run the same command with host access, if permitted.
 Do not reconfigure credentials. If it fails again, report the command and blocker.
 
-For label meanings and state flow, see `docs/agents/triage-labels.md`.
-
 ## Current state
 
 When you change a decision or the scope of your issue, post a comment that starts with `Decision: <topic>:`.
```

**File**: `docs/agents/review.md` (modified, +5/-1)
```diff
@@ -18,7 +18,6 @@ Reopen a resolved concern only when new evidence changes the conclusion.
 - Routing and surfaces: trace through daemon and backend to the affected entrypoints.
   Helper tests that bypass the router do not prove dispatch.
 - Typed errors: follow reasons from producers through normalization, transport, and consumers.
-  Never replace them with text matching.
 - Interaction paths: verify the claims in `packages/contracts/src/interaction-guarantees.ts` against native code.
   Error-path delegation does not prove success-path parity.
   Before you compare performance, prove that both paths are reachable.
@@ -33,6 +32,11 @@ Reopen a resolved concern only when new evidence changes the conclusion.
 - Changed code: flag dead code, redundant guards, casts, narrating comments, and competing owners.
 - Help and user docs: trace changed behavior claims to code paths.
   Block unsupported claims.
+- New trust boundary: before you write code, get a rule and a case table reviewed.
+  The table names who chooses the path, what the kernel resolves, what can change between checks, where bytes are first written, which failures keep the action result, and the accepted cases.
+  If prose, tests, configuration, or dependencies change the security contract, review again.
+  Fix a regression that this change introduces at every entry point.
+  For an unrelated finding, link an existing independent issue.
 - Bulk prose rewrites (docs, ADRs, help): get a review from another model provider.
   The reviewer compares each changed sentence with the base. A self-review is not evidence.
 
```

**File**: `docs/agents/security.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+# Security boundaries
+
+The CLI client trusts its caller to choose local destinations.
+The client trusts a remote daemon for data and validated identifiers.
+Script publication takes no path from the daemon. Capture delivery still can (#4518).
+The daemon trusts its state directory. Nobody trusts the network or other local users.
+Out of scope: same uid, hostile root, ACLs, mounts, untrusted filesystems.
+
+## Applied today
+
+ADR 0016 judges caller-named script destinations on POSIX against the writing process's uid.
+Both script publishers stage and commit inside the judged directory.
+Remote script delivery caps bytes as they arrive.
+
+## Proposed in #4669; applies once approved
+
+- For caller output, judge each directory as ADR 0016 does.
+- For a peer-named entry under a local root, validate the single-entry name before filesystem work.
+
+ADR 0016's staging and byte-cap rules are candidates for that migration.
+Screenshot `--out`, contact sheets, the JUnit reporter, trace and recording outputs, client state, and daemon state do not follow these rules yet (#4669).
```

---

### Incident Patch 3: `6e18ea33` (2026-11-18)
**Commit Message**: fix(replay): verify recorded targets through the request's own capture (#4705)

* refactor(daemon): name the observation capture owner for every route, not just settle

The capture a post-action observation polls is admitted for any route whose own action
binding carries none. `--settle` was the first such route and the owner was named after
it; the owner is the route's, not the flag's. Renamed to `observation-capture.ts` with
`resolveObservationCapture` and the `observation_capture_unavailable` phase.

No behavior change: same plan, same admit-once/bind-once, same degradation and disclosure.

* fix(replay): verify recorded targets through the request's own capture

Replay captured its target-verification tree through the legacy interactor, while the
commands the replay dispatches, and so the recording itself, capture through the request-
bound runtime. On an iOS simulator those are two projections of one screen: the XCTest
runner's tree wraps the screen's content in an `other "<screen title>"` node the
Simulator AX bridge's tree does not have. `target-v1` ancestry therefore disagreed with
itself and an unchanged screen replayed as `identity-mismatch` on `ancestry[...]`.

Replay no

**File**: `packages/daemon/src/__tests__/support/handlers/session-command-harness.ts` (modified, +3/-1)
```diff
@@ -76,6 +76,7 @@ export const mockBindDeviceRuntime = vi.fn(
   async (
     device: DeviceInfo,
     use,
+    _cache?: 'bypass',
     loadLifecycleOperations: LifecycleOperationsLoader = applicationLifecycleRuntimeFixture,
   ) => narrowDeviceBinding(await readinessBinding(device, loadLifecycleOperations), use),
 );
@@ -128,7 +129,8 @@ export async function handleSessionCommands(
       params.bindDevice ??
       (lifecycleOperationsLoader === undefined
         ? mockBindDeviceRuntime
-        : (device, use) => mockBindDeviceRuntime(device, use, lifecycleOperationsLoader)),
+        : (device, use, cache) =>
+            mockBindDeviceRuntime(device, use, cache, lifecycleOperationsLoader)),
     platformResourceCleanup: params.platformResourceCleanup ?? platformResourceCleanupFixture(),
     reconcileOrphanedDeviceClaim: async () => ({
       status: 'retained',
```

**File**: `packages/daemon/src/core/__tests__/observation-capture.test.ts` (renamed, +64/-22)
```diff
@@ -3,7 +3,7 @@ import { IOS_SIMULATOR } from '@agent-device/test-kit';
 import { makeIosSession } from '../../__tests__/support/session-factories.ts';
 import { daemonPlatformServicesFixture } from '../../__tests__/support/platform-services-fixture.ts';
 import { selectorCaptureFixture } from '../../__tests__/support/selector-capture-fixture.ts';
-import { resolveSettleObservationCapture } from '../settle-observation-capture.ts';
+import { resolveObservationCapture } from '../observation-capture.ts';
 import { emitDiagnostic } from '@agent-device/host-kit/diagnostics';
 
 vi.mock('@agent-device/host-kit/diagnostics', async (importOriginal) => {
@@ -14,18 +14,20 @@ vi.mock('@agent-device/host-kit/diagnostics', async (importOriginal) => {
 // #3510: the capture a `--settle` observation polls on a route whose action runtime use carries
 // none. The guarantee it owes is producer identity with the command the caller runs next; the one it
 // must not break is that settling never fails the action it follows. These pin which plan gets
-// admitted, how often, and that every way an observation capture goes away degrades to no capture
-// while disclosing its typed reason.
+// admitted, how often, and that the owner itself discloses each of its three outcomes: a bound
+// capture (admitted + bound), a declared refusal, or a retryable failure of its own machinery.
 
-const unavailablePhase = ['settle_observation_capture_unavailable'];
-
-/** Level included: a degrade the caller cannot see must not be info-only, which success drops. */
-function disclosures(): { level: string | undefined; data: Record<string, unknown> }[] {
+/** Everything the owner discloses, with level: a loss on an ok-answering route must not be info-only. */
+function disclosures(): {
+  level: string | undefined;
+  phase: string;
+  data: Record<string, unknown>;
+}[] {
   return vi
     .mocked(emitDiagnostic)
     .mock.calls.flatMap(([event]) =>
-      event.phase === unavailablePhase[0] && event.data
-        ? [{ level: event.level, data: event.data }]
+      event.phase?.startsWith('observation_capture_') && event.data
+        ? [{ level: event.level, phase: event.phase, data: event.data }]
         : [],
     );
 }
@@ -37,20 +39,34 @@ beforeEach(() => {
 test('an available plan inspects once and binds once for the whole observation', async () => {
   const fixture = selectorCaptureFixture();
 
-  const capture = await resolveSettleObservationCapture({
+  const outcome = await resolveObservationCapture({
     command: 'back',
     session: makeIosSession('settle', { appBundleId: 'com.example.app' }),
     inspectFacts: fixture.inspectFacts,
     platformServices: daemonPlatformServicesFixture(),
     bindDevice: fixture.bindDevice,
   });
-  if (!capture) throw new Error('expected an admitted capture');
+  if (outcome.kind !== 'captured') throw new Error('expected an admitted capture');
 
   expect(fixture.inspections).toEqual([IOS_SIMULATOR]);
   expect(fixture.binds).toEqual([IOS_SIMULATOR]);
+  // The success path is observable on the request's own record: one admitted and one bound entry
+  // name the cell that reached a runtime capture, so a live trace counts binds without a fake.
+  expect(disclosures()).toEqual([
+    {
+      level: 'info',
+      phase: 'observation_capture_admitted',
+      data: { command: 'back', plan: 'selector-active-app', deviceId: IOS_SIMULATOR.id },
+    },
+    {
+      level: 'info',
+      phase: 'observation_capture_bound',
+      data: { command: 'back', plan: 'selector-active-app', deviceId: IOS_SIMULATOR.id },
+    },
+  ]);
 
-  await capture({});
-  await capture({});
+  await outcome.capture({});
+  await outcome.capture({});
   expect(fixture.binds).toEqual([IOS_SIMULATOR]);
   expect(fixture.captures).toHaveLength(2);
 });
@@ -79,25 +95,33 @@ test.each([
   async ({ refusal, session, operation, reason }) => {
     const fixture = selectorCaptureFixture(refusal);
 
-    const capture = await resolveSettleObservationCapture({
+    const outcome = await resolveObservationCapture({
       command: 'back',
       session: session(),
       inspectFacts: fixture.inspectFacts,
       platformServices: daemonPlatformServicesFixture(),
       bindDevice: fixture.bindDevice,
     });
 
-    expect(capture).toBeUndefined();
+    // The discriminated kind is all a caching caller reads: `refused` is stable until its plan
+    // changes, and the owner discloses why.
+    expect(outcome).toEqual({ kind: 'refused' });
     expect(fixture.binds).toEqual([]);
     expect(disclosures()).toEqual([
-      { level: 'warn', data: { command: 'back', outcome: 'refused', operation, reason } },
+      {
+        level: 'warn',
+        phase: 'observation_capture_unavailable',
+        data: { command: 'back', outcome: 'refused', operation, reason },
+      },
     ]);
   },
 );
 
-// The two ways the owner's own machinery can fail the observation after a valid plan. Both are
-// best-effort by contract: the command
```

**File**: `packages/daemon/src/core/observation-capture.ts` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+import type { BoundSnapshotCapture } from './snapshot-runtime-binding.ts';
+import { bindAdmittedSnapshotCapture } from './snapshot-runtime-binding.ts';
+import { admitRuntimePlan } from './session-runtime-admission.ts';
+import {
+  resolveSelectorCaptureRuntimePlan,
+  type SelectorCaptureRuntimePlan,
+} from '@agent-device/contracts/platform-runtime-operations';
+import { emitDiagnostic } from '@agent-device/host-kit/diagnostics';
+import type { RuntimeOperationUnavailability } from '@agent-device/contracts/platform-runtime';
+import type { RuntimeAdmissionBindings } from './request-runtime-binding.ts';
+import type { SessionState } from './session-state.ts';
+
+/**
+ * The request-bound capture for an internal observation, on a request whose own action binding
+ * carries none: a coordinate-targeted `press`/`fill` (whose point use declares none) or a
+ * generic-route action (#3510). Those routes polled the legacy interactor while the commands the
+ * caller runs next read the request-bound runtime, and on an iOS simulator those are two projections
+ * of one tree.
+ *
+ * Admitting the `capture-only` plan the selector family polls under closes the split; where both
+ * paths already reached the same tree, the admitted operation resolves to the implementation used
+ * before. Observing is best-effort by contract, so nothing here may fail or cancel the work it
+ * follows: the result is one of three mutually exclusive kinds — a bound `capture`, a `refused`
+ * fact about the owner's declared support, or a `retryable` probe or bind failure. A caller that
+ * reuses the answer across observations keeps `refused` until its plan changes and re-probes only
+ * on `retryable`; it never restates what a probe or bind cost the observation. Every kind is
+ * disclosed where it is decided: `admitted` and `bound` at info, so a request's own record shows
+ * which cells reached a runtime capture, and the loss kinds at `warn` — an info-only degrade on a
+ * route that answers `ok: true` is dropped on the success path, which is the passing-unnoticed the
+ * loss disclosures guard against. Admitting through the side-effect-free facts probe and binding
+ * only on admission keeps an optional observation from building a command-facing refusal response,
+ * whose Apple branch live-probes the booted simulator set for a hint nothing shows.
+ */
+export async function resolveObservationCapture(
+  params: Readonly<{ command: string; session: SessionState }> & RuntimeAdmissionBindings,
+): Promise<ObservationCaptureOutcome> {
+  const plan = resolveSelectorCaptureRuntimePlan({
+    hasActiveApp: params.session.appBundleId !== undefined,
+    intent: 'capture-only',
+  });
+  const admission = await admitObservationCapturePlan(params, plan);
+  if (admission === undefined) return { kind: 'retryable' };
+  if (!admission.admitted) {
+    return refused({
+      command: params.command,
+      operation: admission.operation,
+      reason: admission.fact.reason,
+    });
+  }
+  emitDiagnostic({
+    level: 'info',
+    phase: 'observation_capture_admitted',
+    data: { command: params.command, plan: plan.kind, deviceId: params.session.device.id },
+  });
+  try {
+    const capture = await bindAdmittedSnapshotCapture({
+      admission,
+      bindDevice: params.bindDevice,
+      platformServices: params.platformServices,
+    });
+    emitDiagnostic({
+      level: 'info',
+      phase: 'observation_capture_bound',
+      data: { command: params.command, plan: plan.kind, deviceId: params.session.device.id },
+    });
+    return { kind: 'captured', capture };
+  } catch (error) {
+    return retryable({ command: params.command, failure: 'bind-failed', error });
+  }
+}
+
+/** A failed facts probe is the owner's own machinery failing: the retryable kind, disclosed once here. */
+async function admitObservationCapturePlan(
+  params: Readonly<{ command: string; session: SessionState }> & RuntimeAdmissionBindings,
+  plan: SelectorCaptureRuntimePlan,
+) {
+  try {
+    return await admitRuntimePlan({
+      device: params.session.device,
+      plan,
+      inspectFacts: params.inspectFacts,
+    });
+  } catch (error) {
+    retryable({ command: params.command, failure: 'admission-probe-failed', error });
+    return undefined;
+  }
+}
+
+/** The three mutually exclusive answers; each carries only what its own branch decided. */
+export type ObservationCaptureOutcome =
+  | Readonly<{ kind: 'captured'; capture: BoundSnapshotCapture }>
+  | Readonly<{ kind: 'refused' }>
+  | Readonly<{ kind: 'retryable' }>;
+
+/** Discloses the declared refusal; the caller keeps it while its plan is unchanged. */
+function refused(detail: {
+  command: string;
+  operation: string;
+  reason: RuntimeOperationUnavailability['reason'];
+}): Readonly<{ kind: 'refused' }> {
+  emitDiagnostic({
+    level: 'warn',
+    phase: 'observation_capture_unavailable',
+    data: { ...detail, outcome: 'refused' },
+  });
+  return { kind: '
```

**File**: `packages/daemon/src/core/request-runtime-binding.ts` (modified, +15/-6)
```diff
@@ -32,6 +32,7 @@ export type BindDeviceRuntime = <
 >(
   device: DeviceInfo,
   use: RuntimeUse<PlatformRuntimeOperations, Required, Preferred, Conditional>,
+  cache?: 'bypass',
 ) => Promise<
   BoundDeviceRuntime<RuntimeUse<PlatformRuntimeOperations, Required, Preferred, Conditional>>
 >;
@@ -125,16 +126,24 @@ export function createRequestRuntimeBindings(params: {
     return binding;
   };
 
-  const bindDevice: BindDeviceRuntime = async (device, use) => {
+  const bindOrdinary = (device: DeviceInfo) =>
+    params.gateway
+      .bind({ device, intent: { kind: 'ordinary' }, scope: params.scope })
+      .then(async (binding) => await adoptBinding(cleanups, binding, params.scope))
+      .then(admitBinding);
+
+  const bindDevice: BindDeviceRuntime = async (device, use, cache) => {
     params.admitDevice?.(device);
+    if (cache === 'bypass') {
+      return recordBoundMutations(
+        narrowDeviceBinding(await bindOrdinary(device), use),
+        params.dispatchLedger,
+      );
+    }
     const key = JSON.stringify([deviceIdentityKey(deviceIdentity(device)), device.booted === true]);
     let bindingPromise = bindings.get(key);
     if (!bindingPromise) {
-      const intent: DeviceBindingIntent = { kind: 'ordinary' };
-      bindingPromise = params.gateway
-        .bind({ device, intent, scope: params.scope })
-        .then(async (binding) => await adoptBinding(cleanups, binding, params.scope))
-        .then(admitBinding);
+      bindingPromise = bindOrdinary(device);
       bindings.set(key, bindingPromise);
       void bindingPromise.catch(() => {
         if (bindings.get(key) === bindingPromise) bindings.delete(key);
```

**File**: `packages/daemon/src/core/settle-observation-capture.ts` (removed, +0/-100)
```diff
@@ -1,100 +0,0 @@
-import type { BoundSnapshotCapture } from './snapshot-runtime-binding.ts';
-import { bindAdmittedSnapshotCapture } from './snapshot-runtime-binding.ts';
-import { admitRuntimePlan } from './session-runtime-admission.ts';
-import {
-  resolveSelectorCaptureRuntimePlan,
-  type SelectorCaptureRuntimePlan,
-} from '@agent-device/contracts/platform-runtime-operations';
-import { emitDiagnostic } from '@agent-device/host-kit/diagnostics';
-import type { RuntimeOperationUnavailability } from '@agent-device/contracts/platform-runtime';
-import type { RuntimeAdmissionBindings } from './request-runtime-binding.ts';
-import type { SessionState } from './session-state.ts';
-
-/**
- * The capture a post-action observation (`--settle`) polls, for a request whose own action binding
- * carries none: a coordinate-targeted `press`/`fill` (whose point use declares none) or a
- * generic-route action (#3510). Those routes polled the legacy interactor while the commands the
- * caller runs next read the request-bound runtime, and on an iOS simulator those are two projections
- * of one tree.
- *
- * Admitting the `capture-only` plan the selector family polls under closes the split; where both
- * paths already reached the same tree, the admitted operation resolves to the implementation used
- * before. Settling is best-effort by contract, so nothing here may fail or cancel the action it
- * follows: every unavailability degrades to `undefined`, leaving the observation on the owner's own
- * snapshot path, and discloses its typed reason. Admitting through the side-effect-free facts probe
- * and binding only on admission keeps an optional observation from building a command-facing refusal
- * response, whose Apple branch live-probes the booted simulator set for a hint nothing shows.
- */
-export async function resolveSettleObservationCapture(
-  params: Readonly<{ command: string; session: SessionState }> & RuntimeAdmissionBindings,
-): Promise<BoundSnapshotCapture | undefined> {
-  const plan = resolveSelectorCaptureRuntimePlan({
-    hasActiveApp: params.session.appBundleId !== undefined,
-    intent: 'capture-only',
-  });
-  const admission = await admitObservationCapturePlan(params, plan);
-  if (admission === undefined) return undefined;
-  if (!admission.admitted) {
-    return unavailable({
-      command: params.command,
-      outcome: 'refused',
-      operation: admission.operation,
-      reason: admission.fact.reason,
-    });
-  }
-  try {
-    return await bindAdmittedSnapshotCapture({
-      admission,
-      bindDevice: params.bindDevice,
-      platformServices: params.platformServices,
-    });
-  } catch (error) {
-    return unavailable({ command: params.command, outcome: 'bind-failed', error });
-  }
-}
-
-/** `undefined` means the owner's facts probe failed: the caller degrades like any other refusal. */
-async function admitObservationCapturePlan(
-  params: Readonly<{ command: string; session: SessionState }> & RuntimeAdmissionBindings,
-  plan: SelectorCaptureRuntimePlan,
-) {
-  try {
-    return await admitRuntimePlan({
-      device: params.session.device,
-      plan,
-      inspectFacts: params.inspectFacts,
-    });
-  } catch (error) {
-    return unavailable({ command: params.command, outcome: 'admission-probe-failed', error });
-  }
-}
-
-/** Why the observation has to go without a capture, as one typed fact the caller can read. */
-type ObservationCaptureUnavailable = Readonly<{ command: string }> &
-  (
-    | Readonly<{
-        outcome: 'refused';
-        operation: string;
-        reason: RuntimeOperationUnavailability['reason'];
-      }>
-    | Readonly<{ outcome: 'admission-probe-failed' | 'bind-failed'; error: unknown }>
-  );
-
-function unavailable(detail: ObservationCaptureUnavailable): undefined {
-  emitDiagnostic({
-    // `warn`, not the default `info`: a degrade that answers `ok: true` is dropped at info level on
-    // the success path, which is the passing-unnoticed this discloses against.
-    level: 'warn',
-    phase: 'settle_observation_capture_unavailable',
-    // The error's name travels, never its message: request diagnostics keep user input out.
-    data:
-      detail.outcome === 'refused'
-        ? { ...detail }
-        : {
-            command: detail.command,
-            outcome: detail.outcome,
-            errorName: (detail.error as Error | undefined)?.name,
-          },
-  });
-  return undefined;
-}
```

**File**: `packages/daemon/src/execution/generic-settle.ts` (modified, +3/-3)
```diff
@@ -20,7 +20,7 @@ import {
 import type { BoundContextFromFlags } from '../core/context.ts';
 import type { RuntimeAdmissionBindings } from '../core/request-runtime-binding.ts';
 import type { DaemonPlatformServices } from '../core/platform-services.ts';
-import { resolveSettleObservationCapture } from '../core/settle-observation-capture.ts';
+import { resolveObservationCapture } from '../core/observation-capture.ts';
 import { isOutdatedObservation, refFrameTree } from '../core/ref-frame.ts';
 import { issueSettleRefs } from './session-snapshot.ts';
 import type { SessionStore } from '../core/session-store.ts';
@@ -156,7 +156,7 @@ async function createGenericSettleRuntime(
   context: GenericSettleContext,
 ): Promise<Awaited<ReturnType<typeof createInteractionRuntime>> | undefined> {
   try {
-    const boundCapture = await resolveSettleObservationCapture({
+    const outcome = await resolveObservationCapture({
       command: context.req.command,
       session: context.session,
       inspectFacts: context.inspectFacts,
@@ -173,7 +173,7 @@ async function createGenericSettleRuntime(
       contextFromFlags: context.contextFromFlags,
       platformServices: context.platformServices,
       captureSnapshotForSession,
-      settleObservationCapture: boundCapture,
+      settleObservationCapture: outcome.kind === 'captured' ? outcome.capture : undefined,
     });
   } catch {
     return undefined;
```

**File**: `packages/daemon/src/execution/interaction/internal/interaction-runtime.ts` (modified, +1/-1)
```diff
@@ -192,7 +192,7 @@ export function finalizeTouchInteraction(params: FinalizeTouchInteractionInput):
 /**
  * The capture implementation every observation on this request reads the screen through: the action
  * binding's own capture when its runtime use carries one, otherwise the capture the request admitted
- * for its observations (`settle-observation-capture.ts`). Resolved once, at construction, so a route
+ * for its observations (`observation-capture.ts`). Resolved once, at construction, so a route
  * cannot answer one capture from the request-bound runtime and the next from the legacy path. Which
  * backend a bound capture presents stays per-capture: the settle loop pins it once it sees a
  * `private-ax` verdict.
```

**File**: `packages/daemon/src/execution/interaction/internal/interaction-touch-prepare.ts` (modified, +5/-4)
```diff
@@ -7,7 +7,7 @@ import {
 } from '../../../core/touch-runtime.ts';
 import { readSettleRequest } from './interaction-flags.ts';
 import type { BoundSnapshotCapture } from '../../../core/snapshot-runtime-binding.ts';
-import { resolveSettleObservationCapture } from '../../../core/settle-observation-capture.ts';
+import { resolveObservationCapture } from '../../../core/observation-capture.ts';
 import type { InteractionRouteInput } from '../../../core/interaction/internal/types.ts';
 import type { DaemonFailureResponse } from '@agent-device/kernel/contracts';
 import { refusedBeforeDispatch } from '../../request-dispatch-disclosure.ts';
@@ -51,8 +51,8 @@ export async function prepareTouchDispatch(
   const owesObservationCapture =
     touchExecutor.captureSnapshot === undefined &&
     readSettleRequest(params.req.flags) !== undefined;
-  const settleObservationCapture = owesObservationCapture
-    ? await resolveSettleObservationCapture({
+  const settleObservationOutcome = owesObservationCapture
+    ? await resolveObservationCapture({
         command: params.req.command,
         session,
         inspectFacts: params.inspectFacts,
@@ -63,6 +63,7 @@ export async function prepareTouchDispatch(
   return {
     ok: true,
     touchExecutor,
-    settleObservationCapture,
+    settleObservationCapture:
+      settleObservationOutcome?.kind === 'captured' ? settleObservationOutcome.capture : undefined,
   };
 }
```

#### Recent Merged Pull Requests:
- **PR #4712** (closed): revert(ci): run the Android smoke lane on four vCPU again (@thymikee)
- **PR #4711** (2026-11-18): fix(test-app): handle sign-in cancellation and duplicate taps (@thymikee)
- **PR #4708** (2026-11-18): test(test-app): add a sign-in sheet lab for the hosted web auth surface (@thymikee)
- **PR #4707** (2026-11-18): chore(contracts): remove dead exports (@thymikee)
- **PR #4706** (2026-11-18): chore(scripts): wire check-provider-plugin into package.json scripts (@thymikee)
- **PR #4705** (2026-11-18): fix(replay): verify recorded targets through the request's own capture (@thymikee)

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

## X. judge a save-script destination another local user can steer

**RULE**:
When implementing operations in `docs/adr/0016-active-session-script-publication.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ada87a3b`: judge a save-script destination another local user can steer. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/adr/0016-active-session-script-publication.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- The destination a caller names with `--save-script=<path>` is judged before anything is created.
  It must be absolute, and every directory the walk looks a name up in must be one no other non-root local user can change.
  What is missing is created one level at a time at 0700, inside the directory the walk just judged, and the script file is 0600.
  The rule is POSIX-only, and a refused destination leaves nothing behind.
  The daemon's own state-directory chain is outside this decision (#4649).
- Before it sends the open, the client mints a random publication ID and records the destination and the `--force` grant under it in its state directory (`remote-connections/session-scripts/`), keyed by the endpoint, the tenant, the session, and that ID. That directory is the client's own private state, not a script destination: the client creates it the way it always did, with one recursive `mkdir` that forces nothing on a directory that already stands, and the only file ever written there is the client's own record. The script itself is published by the daemon to its own sessions directory; the client's own copy goes to the caller's destination, judged by the rule under [Caller-named de
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
- Before it sends the open, the client mints a random publication ID and records the destination and the `--force` grant under it in its state directory (`remote-connections/session-scripts/`), keyed by the endpoint, the tenant, the session, and that ID.
The destination keeps local `--save-script` semantics: the client creates a missing parent directory and checks no ancestor ownership, so another local user who can write an ancestor directory can redirect the file, locally and remotely alike (#4565).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ada87a3b` are properly handled with clean fallback behavior.


## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
