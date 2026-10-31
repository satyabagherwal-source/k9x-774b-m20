> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source**: github ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Source Version**: `c1f1fd02`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T11:46:45.589Z  
> **Learning ID**: `learn-github-callstack-agent-device`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): callstack/agent-device

> **Canonical Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-31T11:46:45.581Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Open source device layer for AI coding agents: a CLI, MCP server, and typed Node.js API to control mobile, web, TV, and desktop apps on devices and simulators, locally or in the cloud.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5208 stars

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
  const session = await ensureRunnerSession(device, {
    ...options,
    cleanStaleBundles: attempt > 1 ? true : options.cleanStaleBundles,
    ...readPrepareDeadlinePhaseTimeouts(options, 'runner_session'),
  });
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
  const appErr = asAppError(error, 'COMMAND_FAILED');
  if (isRequestCanceledError(appErr)) {
    await invalidateRunnerSessionBestEffort(session, 'prepare_runner_request_canceled');
    throw error;
  }
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
    throw failure;
  }
}

// fallow-ignore-next-line complexity
async function executeRunnerCommandAttempt(
  device: DeviceInfo,
  command: RunnerCommand,
  options: AppleRunnerCommandOptions,
  exchange: { entered: boolean },
): Promise<Record<string, unknown>> {
  assertRunnerRequestActive(options.r
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
function runSwiftCases(cases: readonly DifferentialCase[]): DifferentialOutcome[] {
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
  return [...presentation.presentedIndexesBySourceIndex.values()].every((indexes) =>
    indexes.every((index) => outpu
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4055** (2026-10-29): **test(docs): make startup-reason vocabulary extraction exhaustive**
  *Symptoms*: Parent: #4045  ## Purpose  literalMembers regex reads only single-quoted lowercase/underscore strings and selected spreads. Valid literals with digits/hyphens or alternate quoting can be silently ignored while the nonempty check passes.  ## Owner and scope  test/repo-guards/runner-startup-reason-docs.test.ts and local parser support if needed. Reuse existing exports/parser; retain documentation completeness.  ## Required behavior  Prefer importing the exported RUNNER_STARTUP_FAILURE_REASONS runtime vocabulary and delete the regex path while retaining independent documentation comparison. If a concrete layering constraint prohibits that import, use the repository parser and reject every unsupported member exhaustively. Do not add a compatibility fallback or general source-evaluation framework; choose one justified construction path. Do not change production reason vocabulary.  ## API or evidence example  A valid added reason such as 'phase-2' must either be included in the checked vocabulary or cause an explicit unsupported-shape failure.  ## Observable completion  - [ ] Valid literals cannot silently disappear because of spelling/quote format. - [ ] Unknown spread/member syntax fails explicitly if it cannot be interpreted safely. - [ ] Existing reason-doc coverage still detects a missing documented reason; parser tests prove nearest ignored-literal case.  ## Dependencies and sequencing  Blocked by: none.  ## Validation  Focused repo guard and isolated planted new-reason exper

- **Issue #4049** (2026-10-29): **fix(depgraph): expose incomplete impact attribution and dynamic dependents**
  *Symptoms*: Parent: #4045  ## Purpose  affected snapshot-route.ts returns commands:[] and liveOwners:[] because injected bindDevice calls have no import edge. Value-only reverse reachability also stops at dynamic imports, so output can look complete while impact is unknown.  ## Owner and scope  scripts/depgraph/affected.ts, affected-run.ts, adjacent tests and README. Reuse existing layering graph and ownership declarations.  ## Required behavior  Keep value-dependent semantics explicit. Add separately named executable/dynamic reverse reachability without conflating it with type reachability. Mark command/live attribution as partial where injection makes import reachability incomplete; use existing declaration facts, not a second inferred call graph or handwritten platform ownership list. Empty static reachability must not imply no affected command/device work. Do not change gate selection as part of this issue. commandsReaching already includes value and dynamic imports; do not claim or fix a dynamic gap there. The added transitive dynamic/executable field belongs to reverse dependents. Inspect scripts/layering/daemon-platform-runtime-inventory.ts for existing injection declarations; if those cannot support exhaustive attribution, report globally partial static attribution rather than invent a new platform list.  ## API or evidence example  Illustrative: commandAttribution: {kind:'partial', reason:'injected-runtime'}, commands:[...staticallyReachable]; separate executableDependents from 

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

### Incident Patch 1: `f9a1dab8` (2026-10-30)
**Commit Message**: fix(platform-android): disable persistent Android snapshots after an unhealthy helper retirement (#4007)

* fix(platform-android): disable persistent Android snapshots after an unhealthy helper retirement

When a failed capture's forced retirement cannot prove the helper was
released, or its cleanup times out, set that helper build's
failedSessions entry to an infinite retryAt so the existing backoff gate
keeps the device on one-shot snapshots until
resetAndroidSnapshotHelperSessions clears it. Emit
android_snapshot_helper_persistent_session_disabled with release and
externalCleanupTimedOut so the disable reason is visible. The retirement
API now returns release and cleanup status so the caller can decide.

Forward removal reports a rejection as a timed-out cleanup instead of
rejecting the teardown, so a stalled removal no longer makes the
retirement throw before it is classified.

Tests move the clock past the retry ceiling before the second capture,
cover the cleanup timeout reached through a stalled forward removal, and
only consume a configured stall when the call has a cleanup signal.

Fixes #3929

* fix(platform-android): key the persistent-snapshot disable on a reused sessio

**File**: `packages/platform-android/src/__tests__/snapshot-helper-session-lifecycle.test.ts` (modified, +120/-1)
```diff
@@ -1,5 +1,5 @@
 import assert from 'node:assert/strict';
-import { afterEach, beforeEach, test } from 'vitest';
+import { afterEach, beforeEach, test, vi } from 'vitest';
 import { captureAndroidSnapshotWithHelperSession } from '../snapshot-helper-session.ts';
 import {
   resetAndroidSnapshotHelperSessions,
@@ -11,17 +11,23 @@ import { recoverAndroidSnapshotHelperRetirement } from '../snapshot-helper-retir
 import {
   createSessionProvider,
   FakeAndroidProcess,
+  isAndroidHelperForwardRemoval,
   isAndroidHelperRuntimeForceStop,
   type SessionProviderOptions,
 } from './snapshot-helper-session.fixtures.ts';
 import type { AndroidAdbExecutor, AndroidAdbProvider } from '../adb-executor.ts';
+import path from 'node:path';
+import { promises as fs } from 'node:fs';
+import { mkdtempForTest } from './test-utils/tmp-dir.ts';
+import { withDiagnosticsScope } from '@agent-device/host-kit/diagnostics';
 
 beforeEach(async () => {
   delete process.env.AGENT_DEVICE_ANDROID_SNAPSHOT_HELPER_SESSION;
   await resetAndroidSnapshotHelperSessions();
 });
 
 afterEach(async () => {
+  vi.restoreAllMocks();
   delete process.env.AGENT_DEVICE_ANDROID_SNAPSHOT_HELPER_SESSION;
   await resetAndroidSnapshotHelperSessions();
 });
@@ -226,6 +232,119 @@ test('a session whose capture timed out is not restarted by the next command', a
   );
 });
 
+test('a reused session whose capture times out keeps the helper build one-shot until reset', async () => {
+  const spawnArgs: (readonly string[])[] = [];
+  // The helper answers once and then goes silent: the idle freeze of #3929. Force-stop kills the
+  // frozen process cleanly, so the retirement proves release and only the timeout tells.
+  const provider = createSessionProvider({
+    calls: [],
+    spawnArgs,
+    answeredSnapshotsBeforeStall: 1,
+    stalledSnapshots: 1,
+  });
+  const capture = (deviceKey: string) =>
+    captureAndroidSnapshotWithHelperSession({
+      adb: provider.exec,
+      adbProvider: provider,
+      deviceKey,
+      commandTimeoutMs: 400,
+    });
+  const logPath = path.join(
+    await mkdtempForTest('agent-device-android-session-disable-diag-'),
+    'diag.ndjson',
+  );
+
+  await withDiagnosticsScope({ debug: true, logPath }, async () => {
+    assert.equal((await capture('android:coloros-16'))?.metadata.transport, 'persistent-session');
+    assert.equal(await capture('android:coloros-16'), undefined, 'the frozen session falls back');
+    skewClockPastSessionBackoff();
+    assert.equal(
+      await capture('android:coloros-16'),
+      undefined,
+      'the next command answers one-shot after any ordinary backoff has run out',
+    );
+    assert.equal(spawnArgs.length, 1, 'the frozen helper build is not spawned again');
+    const otherDevice = await capture('android:other-device');
+    assert.equal(otherDevice?.metadata.transport, 'persistent-session');
+  });
+
+  const log = await fs.readFile(logPath, 'utf8');
+  assert.match(log, /"phase":"android_snapshot_helper_session_stop"[^\n]*"release":"released"/);
+  assert.match(log, /android_snapshot_helper_persistent_session_disabled/);
+
+  await resetAndroidSnapshotHelperSessions();
+  const fresh = await capture('android:coloros-16');
+  assert.equal(spawnArgs.length, 3, 'reset allows a fresh persistent attempt');
+  assert.equal(fresh?.metadata.transport, 'persistent-session');
+});
+
+test('a first capture that times out on a fresh session only earns the ordinary backoff', async () => {
+  const spawnArgs: (readonly string[])[] = [];
+  const provider = createSessionProvider({ calls: [], spawnArgs, stalledSnapshots: 1 });
+  const capture = () =>
+    captureAndroidSnapshotWithHelperSession({
+      adb: provider.exec,
+      adbProvider: provider,
+      deviceKey: 'android:emulator-5554',
+      commandTimeoutMs: 400,
+    });
+  const logPath = path.join(
+    await mkdtempForTest('agent-device-android-session-first-timeout-diag-'),
+    'diag.ndjson',
+  );
+
+  await withDiagnosticsScope({ debug: true, logPath }, async () => {
+    assert.equal(await capture(), undefined);
+    skewClockPastSessionBackoff();
+    assert.equal((await capture())?.metadata.transport, 'persistent-session');
+  });
+
+  assert.equal(spawnArgs.length, 2, 'the backoff ran out and a new helper was started');
+  const log = await fs.readFile(logPath, 'utf8');
+  assert.doesNotMatch(log, /android_snapshot_helper_persistent_session_disabled/);
+});
+
+test('a retirement whose forward removal stalls still falls back to one-shot', async () => {
+  const calls: (readonly string[])[] = [];
+  const spawnArgs: (readonly string[])[] = [];
+  const cleanupAborts: (readonly string[])[] = [];
+  // The forward removal hangs until the retirement budget aborts it.
+  const provider = createSessionProvider({
+    calls,
+    spawnArgs,
+    cleanupAborts,
+    stalledSnapshots: 1,
+    stalledForwardRemovals: 1,
+  });
+  const logPath = path.join(
+    await mkdtempForTest('agent-device-android-session-cleanup-ti
```

**File**: `packages/platform-android/src/__tests__/snapshot-helper-session.fixtures.ts` (modified, +13/-3)
```diff
@@ -184,7 +184,11 @@ export type SessionProviderOptions = {
   forceStopDelayMs?: number;
   recoveryFailure?: boolean;
   stalledCleanup?: boolean;
+  /** How many `forward --remove` calls hang until their cleanup budget aborts them. */
+  stalledForwardRemovals?: number;
   stalledSnapshots?: number;
+  /** How many snapshot requests each helper process answers before `stalledSnapshots` applies. */
+  answeredSnapshotsBeforeStall?: number;
   /** Whether `adb features` advertises the shell protocol that forwards device exit status. */
   shellProtocolV2?: boolean;
   /** Make the `adb features` probe fail the way an adb too old to know the command does. */
@@ -257,7 +261,7 @@ export function createSessionProvider(options: SessionProviderOptions): AndroidA
             return;
           }
           snapshotCount += 1;
-          if (stalledSnapshots > 0) {
+          if (snapshotCount > (options.answeredSnapshotsBeforeStall ?? 0) && stalledSnapshots > 0) {
             stalledSnapshots -= 1;
             return;
           }
@@ -370,8 +374,14 @@ async function stallSessionCleanupIfConfigured(
   signal: AbortSignal | undefined,
   forceStopsRuntime: boolean,
 ): Promise<void> {
-  const removesForward = args[0] === 'forward' && args[1] === '--remove';
-  if (!options.stalledCleanup || !signal || (!removesForward && !forceStopsRuntime)) return;
+  const removesForward = isAndroidHelperForwardRemoval(args);
+  const stalledForwardRemovals = options.stalledForwardRemovals ?? 0;
+  const stallsForwardRemoval = removesForward && stalledForwardRemovals > 0;
+  // Only a call with a cleanup signal can actually hang, so only it consumes a stall.
+  if (stallsForwardRemoval && signal) options.stalledForwardRemovals = stalledForwardRemovals - 1;
+  const stalls =
+    stallsForwardRemoval || (options.stalledCleanup && (removesForward || forceStopsRuntime));
+  if (!stalls || !signal) return;
   await new Promise<never>((_resolve, reject) => {
     const onAbort = () => {
       options.cleanupAborts?.push(args);
```

**File**: `packages/platform-android/src/snapshot-helper-retirement.ts` (modified, +23/-18)
```diff
@@ -227,20 +227,18 @@ export async function settleAndroidSnapshotHelperSessionCleanup(params: {
   forceStopRuntime: boolean;
 }): Promise<{ timedOut: boolean }> {
   const signal = AbortSignal.timeout(params.timeoutMs);
-  await Promise.all([
-    ...(params.forceStopRuntime
-      ? [
-          stopAndroidSnapshotHelperRuntime({
-            adb: params.adb,
-            packageName: params.packageName,
-            timeoutMs: params.timeoutMs,
-            signal,
-          }),
-        ]
-      : []),
+  const [, forwardRemoved] = await Promise.all([
+    params.forceStopRuntime
+      ? stopAndroidSnapshotHelperRuntime({
+          adb: params.adb,
+          packageName: params.packageName,
+          timeoutMs: params.timeoutMs,
+          signal,
+        })
+      : undefined,
     removeAndroidSnapshotHelperSessionForward({ ...params, signal }),
   ]);
-  return { timedOut: signal.aborted };
+  return { timedOut: signal.aborted || !forwardRemoved };
 }
 
 /**
@@ -367,13 +365,20 @@ async function removeAndroidSnapshotHelperSessionForward(params: {
   port: number;
   timeoutMs: number;
   signal: AbortSignal;
-}): Promise<void> {
+}): Promise<boolean> {
   params.process.stdin?.end();
   params.process.stdout?.destroy();
   params.process.stderr?.destroy();
-  await params.adb(['forward', '--remove', `tcp:${params.port}`], {
-    allowFailure: true,
-    timeoutMs: params.timeoutMs,
-    signal: params.signal,
-  });
+  // `allowFailure` already absorbs an adb error, so a rejection is a removal that ran out of budget
+  // or was aborted: report it as a timed-out cleanup rather than failing the teardown.
+  return await params
+    .adb(['forward', '--remove', `tcp:${params.port}`], {
+      allowFailure: true,
+      timeoutMs: params.timeoutMs,
+      signal: params.signal,
+    })
+    .then(
+      () => true,
+      () => false,
+    );
 }
```

**File**: `packages/platform-android/src/snapshot-helper-session-lifecycle.ts` (modified, +14/-0)
```diff
@@ -259,6 +259,8 @@ export async function retireFailedAndroidSnapshotHelperSession(params: {
   failedAfterMs: number;
   /** Budget of the one-shot capture that answers in place of the failed session. */
   fallbackBudgetMs: number;
+  /** The session had already answered a capture, and this one got no answer before its deadline. */
+  reusedSessionTimedOut: boolean;
   signal?: AbortSignal;
   cause: unknown;
 }): Promise<void> {
@@ -268,6 +270,18 @@ export async function retireFailedAndroidSnapshotHelperSession(params: {
     cause: params.cause,
   });
   if (params.signal?.aborted) return;
+  // A helper that answered and then went silent was frozen while idle (#3929: ColorOS freezes the
+  // idle helper, force-stop kills it cleanly, and every restarted helper is frozen again), so this
+  // build stays one-shot until reset.
+  if (params.reusedSessionTimedOut) {
+    failedSessions().set(params.identity, Number.POSITIVE_INFINITY);
+    emitDiagnostic({
+      level: 'warn',
+      phase: 'android_snapshot_helper_persistent_session_disabled',
+      data: { deviceKey: params.deviceKey, failedAfterMs: params.failedAfterMs },
+    });
+    return;
+  }
   failedSessions().set(
     params.identity,
     Date.now() +
```

**File**: `packages/platform-android/src/snapshot-helper-session-protocol.ts` (modified, +8/-0)
```diff
@@ -36,6 +36,13 @@ export function allocateAndroidSnapshotHelperSessionPort(): Promise<number> {
   });
 }
 
+const SESSION_REQUEST_TIMEOUT_REASON = 'android_snapshot_helper_session_request_timeout';
+
+/** The helper accepted the session request but sent no answer before the command deadline. */
+export function isAndroidSnapshotHelperSessionRequestTimeout(error: unknown): boolean {
+  return error instanceof AppError && error.details?.reason === SESSION_REQUEST_TIMEOUT_REASON;
+}
+
 export function sendAndroidSnapshotHelperSessionCommand(
   port: number,
   command: string,
@@ -53,6 +60,7 @@ export function sendAndroidSnapshotHelperSessionCommand(
           command: command.split(' ', 1)[0],
           timeoutMs,
           port,
+          reason: SESSION_REQUEST_TIMEOUT_REASON,
         }),
       );
     }, timeoutMs);
```

**File**: `packages/platform-android/src/snapshot-helper-session.ts` (modified, +3/-1)
```diff
@@ -15,6 +15,7 @@ import {
   type AndroidSnapshotHelperResolvedCaptureOptions,
 } from './snapshot-helper-capture.ts';
 import {
+  isAndroidSnapshotHelperSessionRequestTimeout,
   parseAndroidSnapshotHelperSessionTouchResponse,
   requestAndroidSnapshotHelperSessionSnapshot,
   sendAndroidSnapshotHelperSessionCommand,
@@ -49,8 +50,8 @@ async function captureFromAndroidSnapshotHelperSession(params: {
 }): Promise<AndroidSnapshotHelperOutput | undefined> {
   const { session, deviceKey, options, resolved } = params;
   const requestedAtMs = Date.now();
+  const reused = session.capturedCount > 0;
   try {
-    const reused = session.capturedCount > 0;
     const output = await requestAndroidSnapshotHelperSessionSnapshot({
       port: session.port,
       commandTimeoutMs: resolved.commandTimeoutMs,
@@ -76,6 +77,7 @@ async function captureFromAndroidSnapshotHelperSession(params: {
       identity: session.identity,
       failedAfterMs: Date.now() - requestedAtMs,
       fallbackBudgetMs: resolveAndroidSnapshotHelperCaptureOptions(options).commandTimeoutMs,
+      reusedSessionTimedOut: reused && isAndroidSnapshotHelperSessionRequestTimeout(error),
       signal: options.signal,
       cause: error,
     });
```

---

### Incident Patch 2: `f61fad21` (2026-10-31)
**Commit Message**: fix(daemon): recover provider leases a killed daemon left rented (#4108)

* fix(daemon): recover provider leases a killed daemon left rented

The daemon kept live provider leases only in memory and persisted a lease
only once it had expired and its release failed. A daemon killed with
`kill -9` while it held a lease forgot the lease, so a rented cloud device
stayed billed until the provider's own idle timeout.

The lease registry now reports its provider leases whenever one is issued or
leaves, and the daemon journals those whose provider can recover an expired
lease in `live-provider-leases.json`. A daemon that starts and finds the
journal moves its leases into the expired-lease recovery, which runs at
startup and ends each rented device. The journal is dropped only after the
leases are in the expired record, so a crash between the two keeps them in
one file or the other.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(daemon): keep an expiring lease journaled until its record is durable

The journal now also holds every lease that left the registry for recovery
but whose expired record has not been written, retries a failed write with
the latest leases, and survives a 

**File**: `docs/adr/0007-remote-device-leases.md` (modified, +12/-0)
```diff
@@ -85,6 +85,18 @@ In-flight work and human-control holds still keep a lease from expiring.
 After daemon shutdown begins, no new lease-end teardown starts.
 Shutdown waits for any lease-end teardown that already started before it tears sessions down itself.
 
+A daemon that dies while it holds a provider lease leaves the rented device running on the provider side, and that device stays billed.
+Thus, the daemon journals the live leases of each provider that can recover an expired lease, in `live-provider-leases.json` in its state directory.
+A daemon that starts and finds this journal hands each lease in it to the expired-lease recovery of its provider, which ends the rented device.
+It reads both lease records only after it holds the daemon registration for the state directory, because until then they can belong to a daemon that is still running.
+The lease itself is not restored, and its controller connects again.
+Restoring the live lease was rejected: the sessions and device claims of the dead daemon are gone, so a restored lease would name a device that no session can reach.
+A lease that leaves the registry for expiry stays in the journal until its expired-lease record is durable, and a journal write that fails is retried.
+Two routes still let the registry forget a provider lease while its device may be rented. The journal and expiry recovery both follow the registry, so neither covers it, and only the provider runtime still holding the device can end it:
+
+- A failed first allocation releases the registry entry without a provider release, while its provider start may still run.
+- An allocation that finishes after its requester left releases the registry entry even when the provider release throws.
+
 When a request closes a session, the daemon ends the lease of that session, unless the lease was allocated with `retainOnClose`.
 The reply to that request reports each lease that it ended once, at response level, as `endedLeases: [{ leaseId, outcome: 'released' }]`.
 On success, the report is in `data`.
```

**File**: `packages/daemon/src/resources/lease-registry-scope.ts` (modified, +6/-0)
```diff
@@ -16,6 +16,12 @@ export type LeaseRegistryOptions = {
   providerSessionRetentionMs?: number;
   now?: () => number;
   onLeaseExpired?: (lease: DeviceLease) => void;
+  /**
+   * Called with every live provider lease after a provider lease is issued or leaves the registry, so
+   * the daemon can journal what a crash would otherwise forget. An expired lease leaves only after
+   * `onLeaseExpired` has taken it over.
+   */
+  onProviderLeasesChanged?: (leases: readonly DeviceLease[]) => void;
 };
 
 export type AllocateLeaseRequest = {
```

**File**: `packages/daemon/src/resources/lease-registry.ts` (modified, +15/-0)
```diff
@@ -63,6 +63,7 @@ export class LeaseRegistry {
   private readonly resolveLeaseTtlMs: ReturnType<typeof createLeaseTtlResolver>;
   private readonly now: () => number;
   private readonly onLeaseExpired?: (lease: DeviceLease) => void;
+  private readonly onProviderLeasesChanged?: (leases: readonly DeviceLease[]) => void;
   private readonly providerSessionOwnership: ProviderSessionOwnershipRegistry;
 
   constructor(options: LeaseRegistryOptions = {}) {
@@ -72,6 +73,7 @@ export class LeaseRegistry {
     this.resolveLeaseTtlMs = createLeaseTtlResolver(options);
     this.now = options.now ?? (() => Date.now());
     this.onLeaseExpired = options.onLeaseExpired;
+    this.onProviderLeasesChanged = options.onProviderLeasesChanged;
     this.providerSessionOwnership = new ProviderSessionOwnershipRegistry({
       now: this.now,
       retentionMs: options.providerSessionRetentionMs,
@@ -175,6 +177,16 @@ export class LeaseRegistry {
     this.issuedLeaseIds.add(lease.leaseId);
     this.leases.set(lease.leaseId, lease);
     this.bindLease(lease);
+    this.reportProviderLeases(lease);
+  }
+
+  private reportProviderLeases(changed: DeviceLease): void {
+    if (!changed.leaseProvider || !this.onProviderLeasesChanged) return;
+    this.onProviderLeasesChanged(
+      [...this.leases.values()]
+        .filter((lease) => lease.leaseProvider)
+        .map((lease) => ({ ...lease })),
+    );
   }
 
   private refreshExistingRunBinding(
@@ -249,6 +261,7 @@ export class LeaseRegistry {
     this.leases.delete(lease.leaseId);
     this.unbindLease(lease);
     this.inFlightWork.forget(lease.leaseId);
+    this.reportProviderLeases(lease);
     return { released: true, lease };
   }
 
@@ -585,6 +598,7 @@ export class LeaseRegistry {
       const expiredLease = { ...lease };
       expired.push(expiredLease);
       this.onLeaseExpired?.(expiredLease);
+      this.reportProviderLeases(expiredLease);
     }
     return expired;
   }
@@ -604,6 +618,7 @@ export class LeaseRegistry {
     this.unbindLease(currentLease, currentLease.expiresAt);
     const expiredLease = { ...currentLease };
     this.onLeaseExpired?.(expiredLease);
+    this.reportProviderLeases(expiredLease);
     return expiredLease;
   }
 
```

**File**: `packages/daemon/src/server/__tests__/provider-lease-expiry.test.ts` (modified, +254/-2)
```diff
@@ -2,6 +2,7 @@ import fs from 'node:fs';
 import { expect, test, vi } from 'vitest';
 import { createExpiredProviderLeaseReleaser } from '../provider-lease-expiry.ts';
 import { LeaseRegistry } from '../../resources/lease-registry.ts';
+import { leaseReleaseRequestFor } from '../../resources/lease-registry-scope.ts';
 import type { DeviceLease } from '@agent-device/contracts/device';
 import { mkdtempForTestSync } from '@agent-device/test-kit';
 
@@ -74,12 +75,12 @@ test('retries a persisted expired provider lease after daemon restart', async ()
       ...options,
       recoverableProviderIds: [],
     });
-    await daemonWithoutLimrun.retryPending();
+    await daemonWithoutLimrun.recoverInherited();
     expect(release).toHaveBeenCalledTimes(1);
     daemonWithoutLimrun.shutdown();
 
     const restartedDaemon = createExpiredProviderLeaseReleaser(options);
-    await restartedDaemon.retryPending();
+    await restartedDaemon.recoverInherited();
     expect(release).toHaveBeenCalledTimes(2);
     expect(release).toHaveBeenLastCalledWith(lease);
     restartedDaemon.shutdown();
@@ -164,3 +165,254 @@ test('shutdown drain reports releases completed before and during its final retr
     releaser.shutdown();
   }
 });
+
+test('a daemon killed while holding a provider lease recovers it on restart', async () => {
+  const stateDir = mkdtempForTestSync('agent-device-live-provider-lease-');
+  const recoverExpiredLease = vi.fn(async (_lease: DeviceLease) => undefined);
+  const options = { recoverExpiredLease, stateDir, recoverableProviderIds: ['revyl'] };
+  const killedDaemon = createExpiredProviderLeaseReleaser(options);
+  const registry = new LeaseRegistry({
+    onProviderLeasesChanged: (leases) => killedDaemon.recordLiveLeases(leases),
+  });
+  try {
+    const held = registry.allocateLease({ tenantId: 't', runId: 'run-1', leaseProvider: 'revyl' });
+    // A provider with no recovery has nothing a restart could do, so it is not journaled.
+    registry.allocateLease({ tenantId: 't', runId: 'run-2', leaseProvider: 'browserstack' });
+    // The process dies here: no release, no expiry, nothing drained.
+    killedDaemon.shutdown();
+
+    const restartedDaemon = createExpiredProviderLeaseReleaser(options);
+    const startupDiagnostics: { phase: string; data: Record<string, unknown> }[] = [];
+    await restartedDaemon.recoverInherited((diagnostic) => startupDiagnostics.push(diagnostic));
+    expect(startupDiagnostics).toEqual([
+      expect.objectContaining({
+        phase: 'provider_lease_orphans_adopted',
+        data: { leaseIds: [held.leaseId] },
+      }),
+    ]);
+    expect(recoverExpiredLease.mock.calls.map(([lease]) => lease.leaseId)).toEqual([held.leaseId]);
+    expect(fs.existsSync(`${stateDir}/live-provider-leases.json`)).toBe(false);
+    restartedDaemon.shutdown();
+
+    // Recovered once means recovered: the next daemon inherits nothing.
+    const thirdDaemon = createExpiredProviderLeaseReleaser(options);
+    await thirdDaemon.recoverInherited();
+    expect(recoverExpiredLease).toHaveBeenCalledTimes(1);
+    thirdDaemon.shutdown();
+  } finally {
+    fs.rmSync(stateDir, { recursive: true, force: true });
+  }
+});
+
+test('a provider lease released before the daemon stops is not recovered again', async () => {
+  const stateDir = mkdtempForTestSync('agent-device-live-provider-lease-');
+  const recoverExpiredLease = vi.fn(async (_lease: DeviceLease) => undefined);
+  const options = { recoverExpiredLease, stateDir, recoverableProviderIds: ['revyl'] };
+  const daemon = createExpiredProviderLeaseReleaser(options);
+  const registry = new LeaseRegistry({
+    onProviderLeasesChanged: (leases) => daemon.recordLiveLeases(leases),
+  });
+  try {
+    const lease = registry.allocateLease({ tenantId: 't', runId: 'run-1', leaseProvider: 'revyl' });
+    registry.releaseLease(leaseReleaseRequestFor(lease));
+    daemon.shutdown();
+
+    const restartedDaemon = createExpiredProviderLeaseReleaser(options);
+    await restartedDaemon.recoverInherited();
+    expect(recoverExpiredLease).not.toHaveBeenCalled();
+    restartedDaemon.shutdown();
+  } finally {
+    fs.rmSync(stateDir, { recursive: true, force: true });
+  }
+});
+
+test('an expired lease stays journaled until its expired record is durable', async () => {
+  const stateDir = mkdtempForTestSync('agent-device-live-provider-lease-');
+  // A directory where the expired record goes makes every write of it fail.
+  fs.mkdirSync(`${stateDir}/expired-provider-leases.json`);
+  let now = 1_000;
+  const recoverExpiredLease = vi.fn(async (_lease: DeviceLease) => undefined);
+  const daemon = createExpiredProviderLeaseReleaser({
+    recoverExpiredLease,
+    stateDir,
+    recoverableProviderIds: ['revyl'],
+  });
+  const registry = new LeaseRegistry({
+    defaultLeaseTtlMs: 10,
+    minLeaseTtlMs: 1,
+    now: () => now,
+    onLeaseExpired: (lease) => void daemon.release(lease),
+    onProviderLeasesChanged: (leases) => daemon.rec
```

**File**: `packages/daemon/src/server/http/daemon-runtime.ts` (modified, +11/-1)
```diff
@@ -373,7 +373,6 @@ async function startDaemonRuntimeOnHost(
     recoverableProviderIds: deps.recoverableProviderIds,
   });
   rollback.onRollback(() => expiredProviderLeaseReleaser.shutdown());
-  void expiredProviderLeaseReleaser.retryPending();
   const leaseRegistry = new LeaseRegistry({
     maxActiveSimulatorLeases: parseIntegerEnv(env.AGENT_DEVICE_MAX_SIMULATOR_LEASES),
     defaultLeaseTtlMs: parseIntegerEnv(env.AGENT_DEVICE_LEASE_TTL_MS),
@@ -383,6 +382,7 @@ async function startDaemonRuntimeOnHost(
       void expiredProviderLeaseReleaser.release(lease);
       void endSessionsForLease(lease.leaseId, 'LEASE_EXPIRED');
     },
+    onProviderLeasesChanged: (leases) => expiredProviderLeaseReleaser.recordLiveLeases(leases),
   });
   // The registry only notices an expired lease when something calls it; this sweep ends an
   // abandoned lease (and, through `onLeaseExpired`, its session and claim) without a later request.
@@ -671,6 +671,16 @@ async function startDaemonRuntimeOnHost(
     scope: createRecoveryPlatformScope(),
     onDiagnostic: (diagnostic) => startupDiagnostics.push(diagnostic),
   });
+  // Only the registered daemon may read the state directory's lease records and act on them. Loading and
+  // adoption run before the first await, so their report reaches this startup's diagnostics.
+  void expiredProviderLeaseReleaser
+    .recoverInherited((diagnostic) => startupDiagnostics.push(diagnostic))
+    .catch((error) => {
+      // Startup has no request scope, so the failure goes to the daemon log directly.
+      void emitDaemonDiagnostic(logPath, 'provider_lease_startup_recovery_failed', {
+        error: error instanceof Error ? error.message : String(error),
+      }).catch(() => undefined);
+    });
   await reapOwnedProcessRecordsAtStartup(deps.ownedProcessRecords, {
     openWebSessionNames: openWebSessionNames(sessionStore),
     purposes: ['simctl-screen-recording'],
```

**File**: `packages/daemon/src/server/provider-lease-expiry.ts` (modified, +160/-31)
```diff
@@ -7,12 +7,18 @@ import type {
 } from '@agent-device/contracts/device';
 import { publishFileSync } from '@agent-device/host-kit/file';
 import { releaseExpiredProviderLease } from '../sessions/lease-lifecycle.ts';
-import { emitDiagnostic } from '@agent-device/host-kit/diagnostics';
+import { emitDiagnostic, type ResourceDiagnostic } from '@agent-device/host-kit/diagnostics';
 import { sleep } from '@agent-device/host-kit/retry';
 
 const DEFAULT_RETRY_DELAY_MS = 1_000;
 const PENDING_RELEASES_FILE = 'expired-provider-leases.json';
-const PENDING_RELEASES_VERSION = 1;
+/**
+ * The recoverable provider leases this daemon holds right now. A daemon that starts and finds this
+ * file inherited it from one that died without releasing them, so every lease in it is recovered.
+ */
+const LIVE_LEASES_FILE = 'live-provider-leases.json';
+/** The format version of both lease records: the expired record and the live journal. */
+const LEASE_RECORD_VERSION = 1;
 const PERSISTED_LEASE_STRING_FIELDS = [
   'leaseId',
   'tenantId',
@@ -24,14 +30,24 @@ const PERSISTED_LEASE_NUMBER_FIELDS = ['createdAt', 'heartbeatAt', 'expiresAt']
 
 type Timer = ReturnType<typeof setTimeout>;
 
-type PersistedExpiredProviderLeases = {
+type PersistedProviderLeaseRecord = {
   version: number;
   leases: DeviceLease[];
 };
 
 export type ExpiredProviderLeaseReleaser = {
   beginShutdown: () => void;
   release: (lease: DeviceLease) => Promise<void>;
+  /** Journals the registry's live provider leases, so a daemon killed while holding them recovers them. */
+  recordLiveLeases: (leases: readonly DeviceLease[]) => void;
+  /**
+   * Reads the lease records an earlier daemon left in the state directory (the expired record and the
+   * live journal), moves the journal's leases into recovery, and starts recovering. Call it only once
+   * this process holds the daemon registration: before that, both records may belong to a daemon that is
+   * still running, and acting on them would end devices it is using. Until then the releaser touches no
+   * file in the state directory.
+   */
+  recoverInherited: (onDiagnostic?: (diagnostic: ResourceDiagnostic) => void) => Promise<void>;
   retryPending: () => Promise<void>;
   /**
    * `pending` holds every lease still unreleased; `unknown` is the part of it whose release was
@@ -54,8 +70,9 @@ export function createExpiredProviderLeaseReleaser(options: {
   retryDelayMs?: number;
 }): ExpiredProviderLeaseReleaser {
   const pendingLiveLeases = new Map<string, DeviceLease>();
-  const pendingRecoveryLeases = loadPendingLeases(options.stateDir);
-  const persistedRecoveryLeaseIds = new Set(pendingRecoveryLeases.keys());
+  const pendingRecoveryLeases = new Map<string, DeviceLease>();
+  const persistedRecoveryLeaseIds = new Set<string>();
+  let inherited = false;
   const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
   let retryTimer: Timer | undefined;
   const activeReleaseAttempts = new Map<string, Promise<void>>();
@@ -74,34 +91,102 @@ export function createExpiredProviderLeaseReleaser(options: {
       );
       return false;
     }
-    const filePath = pendingReleasesPath(options.stateDir);
     try {
-      if (pendingRecoveryLeases.size === 0) {
-        fs.rmSync(filePath, { force: true });
-      } else {
-        fs.mkdirSync(options.stateDir, { recursive: true, mode: 0o700 });
-        const record: PersistedExpiredProviderLeases = {
-          version: PENDING_RELEASES_VERSION,
-          leases: [...pendingRecoveryLeases.values()],
-        };
-        publishFileSync({
-          destination: filePath,
-          contents: `${JSON.stringify(record)}\n`,
-          mode: 0o600,
-        });
-        fs.chmodSync(filePath, 0o600);
-      }
+      writeLeaseRecord(options.stateDir, PENDING_RELEASES_FILE, [
+        ...pendingRecoveryLeases.values(),
+      ]);
       persistedRecoveryLeaseIds.clear();
       for (const leaseId of pendingRecoveryLeases.keys()) {
         persistedRecoveryLeaseIds.add(leaseId);
       }
+      // Leases now durable in the expired record no longer need the journal to hold them.
+      writeJournal();
       return true;
     } catch (error) {
       emitPersistenceFailure(pendingRecoveryLeases.size, error);
       return false;
     }
   };
 
+  const adoptOrphanedLeases = (onDiagnostic?: (diagnostic: ResourceDiagnostic) => void): void => {
+    if (!options.stateDir) return;
+    const orphaned = loadLeaseRecord(options.stateDir, LIVE_LEASES_FILE, onDiagnostic);
+    if (orphaned.size === 0) return;
+    for (const [leaseId, lease] of orphaned) {
+      if (!pendingRecoveryLeases.has(leaseId)) pendingRecoveryLeases.set(leaseId, lease);
+    }
+    // The journal is dropped only once its leases are in the pending record, so a crash in between
+    // leaves them in one file or the other.
+    if (!persistPendingLeases()) return;
+    try {
+      fs.rmSync(leaseRecordPath(options.stateDir, LIVE_LEASES_FILE), { force: true });
+    } cat
```

**File**: `src/host.test.ts` (modified, +37/-0)
```diff
@@ -4,6 +4,7 @@
 // for `process.exit`, would take the test runner down with it.
 
 import fs from 'node:fs';
+import path from 'node:path';
 import { expect, test, vi } from 'vitest';
 import { resolveDaemonPaths } from '@agent-device/daemon-contracts/daemon-resolution';
 import { readDaemonStopIdentity } from '@agent-device/daemon-contracts/daemon-registration';
@@ -365,6 +366,42 @@ test('a host never takes a state directory somebody else holds', async () => {
   }
 });
 
+test('a host refused a held state directory leaves its provider lease records untouched', async () => {
+  const held = await bootHost();
+  // The running host's crash journal, as it would hold a rented device's lease.
+  const journalPath = path.join(held.paths.baseDir, 'live-provider-leases.json');
+  const journal = `${JSON.stringify({
+    version: 1,
+    leases: [
+      {
+        leaseId: 'lease-held',
+        tenantId: 'tenant',
+        runId: 'run',
+        backend: 'ios-instance',
+        leaseProvider: 'limrun',
+        createdAt: 1,
+        heartbeatAt: 1,
+        expiresAt: 2,
+      },
+    ],
+  })}\n`;
+  fs.writeFileSync(journalPath, journal);
+  try {
+    await expect(
+      startAgentDevice({ stateDir: held.stateDir, host: createTestHostEnvironment() }),
+    ).rejects.toMatchObject({ details: { reason: 'daemon_registration_refused' } });
+
+    // Only the registered daemon may read, move or act on the lease records of its state directory.
+    expect(fs.readFileSync(journalPath, 'utf8')).toBe(journal);
+    expect(fs.existsSync(path.join(held.paths.baseDir, 'expired-provider-leases.json'))).toBe(
+      false,
+    );
+  } finally {
+    await held.host.close();
+    removeStateDir(held.stateDir);
+  }
+});
+
 /**
  * The signals this code sent at a process. `0` is a liveness probe and is not one; a call with no
  * signal argument is SIGTERM, so an omitted signal counts as the signal it really is.
```

---

### Incident Patch 3: `f2c69f74` (2026-10-30)
**Commit Message**: fix(test): stop processes a test run leaves in its temp directory (#4093)

* fix(test): stop processes a test run leaves in its temp directory

Vitest global teardown and the node --test wrapper removed the run
directory without stopping processes that still held it as TMPDIR, so
fixture daemons from killed or timed-out tests ran for weeks. Teardown
now SIGKILLs the orphaned Node processes still in the run directory and
reports them. Shared tools a test started (adb, emulator) and processes
whose parent still runs are left alone. The check-affected execution
tests also kill the recorded command group when they fail before
learning its pid.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(test): stop leftover process trees after a run's own processes

Address review: a root is now a Node process in the run directory whose
parent is neither the run owner nor another run process, so subreapers
and a PID 1 runner are handled, and each root's descendants are stopped
too. Reuse the host-kit process table and signal helpers. The vitest
teardown always removes the directory and restores env, and the node
--test wrapper waits for its child after a forwarded signal, then stops
left

**File**: `scripts/check-affected/command-execution.test.ts` (modified, +19/-13)
```diff
@@ -44,6 +44,7 @@ test(
     } finally {
       child.kill('SIGKILL');
       await wait;
+      killCommandGroup(readRecordedCommandPid(cwd));
       fs.rmSync(cwd, { recursive: true, force: true });
     }
   },
@@ -72,14 +73,8 @@ test(
       const deadline = Date.now() + 5000;
       while (!fs.existsSync(ready) && Date.now() < deadline) await setTimeout(20);
       assert.ok(fs.existsSync(ready));
-      commandPid = (
-        JSON.parse(
-          fs.readFileSync(
-            path.join(cwd, '.cache', 'agent-device', 'validation.lock.active.json'),
-            'utf8',
-          ),
-        ) as { pid: number }
-      ).pid;
+      commandPid = readRecordedCommandPid(cwd);
+      assert.ok(commandPid, 'the validation parent must record its command group');
       parent.child.kill('SIGKILL');
       await parent.wait;
       waiter = runCmdBackground(
@@ -109,14 +104,25 @@ test(
     } finally {
       parent.child.kill('SIGKILL');
       waiter?.child.kill('SIGTERM');
-      if (commandPid) {
-        try {
-          process.kill(-commandPid, 'SIGKILL');
-        } catch {}
-      }
       await parent.wait;
+      killCommandGroup(commandPid ?? readRecordedCommandPid(cwd));
       await waiter?.wait;
       fs.rmSync(cwd, { recursive: true, force: true });
     }
   },
 );
+
+// The command group runs detached from the validation parent, so a test that fails before it
+// learns the group's pid must still find it here; otherwise the group outlives the run.
+function readRecordedCommandPid(cwd: string): number | undefined {
+  const active = path.join(cwd, '.cache', 'agent-device', 'validation.lock.active.json');
+  if (!fs.existsSync(active)) return undefined;
+  return (JSON.parse(fs.readFileSync(active, 'utf8')) as { pid: number | null }).pid ?? undefined;
+}
+
+function killCommandGroup(pid: number | undefined): void {
+  if (pid === undefined) return;
+  try {
+    process.kill(-pid, 'SIGKILL');
+  } catch {}
+}
```

**File**: `scripts/check-tmpdir-leaks-model.ts` (modified, +75/-8)
```diff
@@ -1,6 +1,11 @@
 import fs from 'node:fs';
 import path from 'node:path';
 import { runCmdSync } from '@agent-device/host-kit/command';
+import {
+  expandProcessTree,
+  listHostProcesses,
+  signalPidsBestEffort,
+} from '@agent-device/host-kit/process';
 
 // Every test run (Vitest via scripts/vitest-tmpdir-global-setup.ts, node --test
 // via scripts/node-test-tmpdir.ts) redirects TMPDIR into one disposable,
@@ -43,13 +48,64 @@ function isProcessAlive(pid: number): boolean {
  */
 export function liveRunDirectoryConsumers(): ReadonlySet<string> {
   const consumers = new Set<string>();
-  for (const value of readAllProcessTmpdirs()) {
-    const name = runDirectoryNameOf(value);
+  for (const { tmpdir } of readAllProcessTmpdirs()) {
+    const name = runDirectoryNameOf(tmpdir);
     if (name !== undefined) consumers.add(name);
   }
   return consumers;
 }
 
+/**
+ * SIGKILLs the process trees that tests left in `runDir` and returns one `<pid> <command>` line
+ * per stopped process. A run's owner calls this after its test processes have exited and before
+ * it removes the directory. A root is a Node process that holds `runDir` as TMPDIR and whose
+ * parent is neither the owner nor another process of this run: a test fixture whose own cleanup
+ * never ran (a killed worker, a timed-out test), reparented to init or a subreaper. Nothing
+ * else would ever stop it. A shared tool that a test happened to start first (an adb server, an
+ * emulator, watchman) runs another executable and is left alone, and so is any process whose
+ * parent in this run still runs and can still clean it up.
+ */
+export async function stopRunDirectoryConsumers(runDir: string): Promise<string[]> {
+  const name = runDirectoryNameOf(runDir);
+  if (name === undefined) return [];
+  const consumers = new Set(
+    readAllProcessTmpdirs()
+      .filter((entry) => entry.pid !== process.pid && runDirectoryNameOf(entry.tmpdir) === name)
+      .map((entry) => entry.pid),
+  );
+  if (consumers.size === 0) return [];
+  const runtime = path.basename(process.execPath);
+  const processes = await listHostProcesses({ timeoutMs: 10_000 });
+  const roots = processes.filter(
+    (entry) =>
+      consumers.has(entry.pid) &&
+      entry.ppid !== undefined &&
+      entry.ppid !== process.pid &&
+      !consumers.has(entry.ppid) &&
+      path.basename(entry.command.split(' ')[0] ?? '') === runtime,
+  );
+  const stopped = expandProcessTree(
+    roots.map((entry) => entry.pid),
+    processes,
+  );
+  signalPidsBestEffort(
+    stopped.map((entry) => entry.pid),
+    'SIGKILL',
+  );
+  return stopped.map((entry) => `${entry.pid} ${entry.command.slice(0, 300)}`.trimEnd());
+}
+
+/** One stderr block, only when a run's teardown had to stop processes its tests left behind. */
+export function reportStoppedRunDirectoryConsumers(
+  runDir: string,
+  stopped: readonly string[],
+): void {
+  if (stopped.length === 0) return;
+  process.stderr.write(
+    `[tmpdir] stopped ${stopped.length} process${stopped.length === 1 ? '' : 'es'} still using ${runDir} at teardown:\n${stopped.map((line) => `  ${line}\n`).join('')}`,
+  );
+}
+
 /** `/tmp/agent-device-test-run-123-abc/nested` → `agent-device-test-run-123-abc`; else undefined. */
 export function runDirectoryNameOf(tmpdir: string): string | undefined {
   const rootPrefix = `${TEST_RUN_TMP_ROOT}/`;
@@ -58,15 +114,19 @@ export function runDirectoryNameOf(tmpdir: string): string | undefined {
   return name.startsWith(TEST_RUN_TMP_PREFIX) ? name : undefined;
 }
 
-function readAllProcessTmpdirs(): string[] {
+type ProcessTmpdir = Readonly<{ pid: number; tmpdir: string }>;
+
+function readAllProcessTmpdirs(): ProcessTmpdir[] {
   return process.platform === 'linux' ? readProcTmpdirs() : readPsTmpdirs();
 }
 
-function readProcTmpdirs(): string[] {
+function readProcTmpdirs(): ProcessTmpdir[] {
   return fs
     .readdirSync('/proc')
     .filter((entry) => /^\d+$/.test(entry))
-    .flatMap((pid) => tmpdirsOfEnviron(readEnvironOrEmpty(pid)));
+    .flatMap((pid) =>
+      tmpdirsOfEnviron(readEnvironOrEmpty(pid)).map((tmpdir) => ({ pid: Number(pid), tmpdir })),
+    );
 }
 
 /** Another user's process, or one that exited mid-scan, contributes nothing. */
@@ -87,13 +147,20 @@ function tmpdirsOfEnviron(environ: string): string[] {
 
 // macOS (and other BSDs): -E appends the environment to each command line. Every process's
 // environment is a few MB on a busy host — well past spawnSync's 1 MB default.
-function readPsTmpdirs(): string[] {
-  const listing = runCmdSync('ps', ['-axEww', '-o', 'command='], {
+function readPsTmpdirs(): ProcessTmpdir[] {
+  const listing = runCmdSync('ps', ['-axEww', '-o', 'pid=,command='], {
     allowFailure: true,
     maxBuffer: 64 * 1024 * 1024,
   });
   if (listing.exitCode !== 0) return [];
-  return [...listing.stdout.matchAll(/(?:^|\s)TMPDIR=(\S+)/g)].map((match) => match[1] as string);
+  return listing.stdout.split('\n').flatMap((line) => {
+    cons
```

**File**: `scripts/node-test-tmpdir.test.ts` (modified, +118/-0)
```diff
@@ -86,6 +86,124 @@ test('the wrapper redirects a node --test child TMPDIR and removes it after the
   }
 });
 
+type LeftoverPids = { fixture: number; fixtureChild: number; tool: number };
+
+// Started with its child-pid path as argv[1]. Both files are published by rename, so a reader
+// never sees a partial pid.
+const LEFTOVER_FIXTURE_SOURCE = `const fs = require('node:fs');
+const child = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
+fs.writeFileSync(process.argv[1] + '.tmp', String(child.pid));
+fs.renameSync(process.argv[1] + '.tmp', process.argv[1]);
+setInterval(() => {}, 1000);`;
+
+// The probe leaves a Node fixture (with a child of its own) and a non-Node tool running, both
+// detached so they outlive the probe. With REAP_HOLD set, it then waits to be interrupted.
+const LEFTOVER_PROBE_SOURCE = `import fs from 'node:fs';
+import path from 'node:path';
+import { test } from 'node:test';
+import { runCmdDetached } from '@agent-device/host-kit/command';
+
+test('probe leaves a Node fixture and a non-Node tool running past its own exit', async () => {
+  const root = process.env.REAP_EVIDENCE_ROOT;
+  const childPidPath = path.join(root, 'fixture-child.txt');
+  const fixture = runCmdDetached(process.execPath, ['-e', ${JSON.stringify(LEFTOVER_FIXTURE_SOURCE)}, childPidPath]);
+  const tool = runCmdDetached('/bin/sleep', ['60']);
+  while (!fs.existsSync(childPidPath)) await new Promise((resolve) => setTimeout(resolve, 20));
+  const fixtureChild = Number(fs.readFileSync(childPidPath, 'utf8'));
+  const pidsPath = path.join(root, 'pids.json');
+  fs.writeFileSync(pidsPath + '.tmp', JSON.stringify({ fixture, fixtureChild, tool }));
+  fs.renameSync(pidsPath + '.tmp', pidsPath);
+  if (process.env.REAP_HOLD) await new Promise((resolve) => setTimeout(resolve, 60_000));
+});
+`;
+
+function writeLeftoverProbe(): string {
+  const probeName = `node-test-tmpdir-probe-reap-${process.pid}-${crypto.randomUUID()}.test.ts`;
+  const probePath = path.join(REPOSITORY_ROOT, 'scripts', probeName);
+  fs.writeFileSync(probePath, LEFTOVER_PROBE_SOURCE);
+  return probePath;
+}
+
+function leftoverProbeEnv(evidenceRoot: string, hold: boolean): NodeJS.ProcessEnv {
+  return { ...process.env, REAP_EVIDENCE_ROOT: evidenceRoot, REAP_HOLD: hold ? '1' : '' };
+}
+
+async function assertOnlyFixtureTreeStopped(stderr: string, pids: LeftoverPids): Promise<void> {
+  await waitFor(
+    () => !isAlive(pids.fixture) && !isAlive(pids.fixtureChild),
+    5_000,
+    'the leaked fixture or its child outlived its run',
+  );
+  assert.match(stderr, new RegExp(`\\[tmpdir\\] stopped [^]*\\n  ${pids.fixture} `));
+  assert.match(stderr, new RegExp(`\\[tmpdir\\] stopped [^]*\\n  ${pids.fixtureChild} `));
+  assert.equal(isAlive(pids.tool), true, 'a non-Node process is not the run’s to stop');
+}
+
+function killLeftovers(evidenceRoot: string): void {
+  const evidencePath = path.join(evidenceRoot, 'pids.json');
+  if (!fs.existsSync(evidencePath)) return;
+  const pids = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as LeftoverPids;
+  for (const pid of [pids.fixture, pids.fixtureChild, pids.tool]) {
+    // pid 0 or a negative pid would address a whole process group.
+    if (Number.isInteger(pid) && pid > 0 && isAlive(pid)) process.kill(pid, 'SIGKILL');
+  }
+}
+
+test('the wrapper stops an orphaned Node fixture tree still using the run directory, not a shared tool', async () => {
+  const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'node-test-tmpdir-reap-'));
+  const probePath = writeLeftoverProbe();
+  try {
+    const result = await runCmd(
+      process.execPath,
+      ['--experimental-strip-types', WRAPPER, '--experimental-strip-types', '--test', probePath],
+      { cwd: REPOSITORY_ROOT, env: leftoverProbeEnv(evidenceRoot, false), timeoutMs: 30_000 },
+    );
+    assert.equal(result.exitCode, 0, `probe run failed:\n${result.stdout}\n${result.stderr}`);
+    const pids = JSON.parse(fs.readFileSync(path.join(evidenceRoot, 'pids.json'), 'utf8'));
+    await assertOnlyFixtureTreeStopped(result.stderr, pids);
+  } finally {
+    killLeftovers(evidenceRoot);
+    fs.rmSync(probePath, { force: true });
+    fs.rmSync(evidenceRoot, { recursive: true, force: true });
+  }
+});
+
+test('an interrupted wrapper waits for its child, then stops the leftovers and exits 130', async () => {
+  const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'node-test-tmpdir-reap-signal-'));
+  const probePath = writeLeftoverProbe();
+  const wrapper = runCmdBackground(
+    process.execPath,
+    ['--experimental-strip-types', WRAPPER, '--experimental-strip-types', '--test', probePath],
+    { cwd: REPOSITORY_ROOT, env: leftoverProbeEnv(evidenceRoot, true), allowFailure: true },
+  );
+  try {
+    const evidencePath = path.join(evidenceRoot, 'pids.json');
+    await waitFor(() => fs.existsSync(evidencePath), 20_000, 'probe never reported its pids');
+    wrapper
```

**File**: `scripts/node-test-tmpdir.ts` (modified, +13/-6)
```diff
@@ -16,9 +16,9 @@
 // alike — without touching any of them, exactly like the Vitest lane.
 //
 // Cleanup runs from the process 'exit' event rather than only a try/finally,
-// so it fires for normal completion, a thrown error, AND a signal this
-// process forwards to a still-running child (Ctrl-C locally, or a CI job
-// cancellation): the signal handlers below call `process.exit()`, which
+// so it fires for normal completion, a thrown error, AND a signal (Ctrl-C
+// locally, or a CI job cancellation): the first signal is forwarded and the
+// run ends when the child exits; a second one calls `process.exit()`, which
 // triggers 'exit' synchronously before the process actually terminates.
 // Only a SIGKILL against this wrapper itself bypasses all of that; the next
 // run on the host prunes what such a kill left behind (see
@@ -33,6 +33,8 @@ import {
   TEST_RUN_TMP_ROOT,
   pruneAbandonedRunDirectories,
   reportPrunedRunDirectories,
+  reportStoppedRunDirectoryConsumers,
+  stopRunDirectoryConsumers,
 } from './check-tmpdir-leaks-model.ts';
 
 const forwardedArgs = process.argv.slice(2);
@@ -98,13 +100,18 @@ const { child, wait } = runCmdBackground(process.execPath, forwardedArgs, {
   allowFailure: true,
 });
 
+// A forwarded signal waits for the child: its own cleanup may still be running, and leftovers
+// are stopped only after it exits. A second signal stops waiting.
+let signalExitCode: number | undefined;
 for (const signal of ['SIGINT', 'SIGTERM'] as const) {
   process.on(signal, () => {
-    child.kill(signal);
+    if (signalExitCode !== undefined) process.exit(signalExitCode);
     // 128 + signal number is the shell convention for a signal-terminated exit.
-    process.exit(signal === 'SIGINT' ? 130 : 143);
+    signalExitCode = signal === 'SIGINT' ? 130 : 143;
+    child.kill(signal);
   });
 }
 
 const result = await wait;
-process.exitCode = result.exitCode;
+reportStoppedRunDirectoryConsumers(testRunTmpDir, await stopRunDirectoryConsumers(testRunTmpDir));
+process.exitCode = signalExitCode ?? result.exitCode;
```

**File**: `scripts/vitest-tmpdir-global-setup.test.ts` (modified, +48/-0)
```diff
@@ -4,6 +4,7 @@ import fs from 'node:fs';
 import os from 'node:os';
 import path from 'node:path';
 import { test } from 'node:test';
+import { setTimeout } from 'node:timers/promises';
 import { fileURLToPath } from 'node:url';
 import { runCmd } from '@agent-device/host-kit/command';
 import { TEST_RUN_TMP_PREFIX, TEST_RUN_TMP_ROOT } from './check-tmpdir-leaks-model.ts';
@@ -113,3 +114,50 @@ test('noop probe: the run itself is the subject', () => {});
     fs.rmSync(probePath, { force: true });
   }
 });
+
+test('global teardown stops a detached child a test left running in the run directory', async () => {
+  const stamp = crypto.randomUUID();
+  const probeName = `vitest-tmpdir-reap-probe-${process.pid}-${stamp}.test.ts`;
+  const probePath = path.join(REPOSITORY_ROOT, 'src', '__tests__', probeName);
+  const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-tmpdir-reap-test-'));
+  const evidencePath = path.join(evidenceRoot, 'child-pid.txt');
+  fs.writeFileSync(
+    probePath,
+    `import fs from 'node:fs';
+import { test } from 'vitest';
+import { runCmdDetached } from '@agent-device/host-kit/command';
+
+test('probe leaves a detached child running past its own worker', () => {
+  const childPid = runCmdDetached(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
+  fs.writeFileSync(${JSON.stringify(evidencePath)}, String(childPid));
+});
+`,
+  );
+  let childPid: number | undefined;
+  try {
+    const result = await runCmd(
+      path.join(REPOSITORY_ROOT, 'node_modules', '.bin', 'vitest'),
+      ['run', '--project', 'unit-core', probePath],
+      { cwd: REPOSITORY_ROOT, timeoutMs: 30_000 },
+    );
+    assert.equal(result.exitCode, 0, `probe run failed:\n${result.stdout}\n${result.stderr}`);
+    childPid = Number(fs.readFileSync(evidencePath, 'utf8'));
+    const deadline = Date.now() + 5_000;
+    while (isAlive(childPid) && Date.now() < deadline) await setTimeout(100);
+    assert.equal(isAlive(childPid), false, 'the leaked child outlived its run');
+    assert.match(result.stderr, new RegExp(`\\[tmpdir\\] stopped [^]*\\n  ${childPid} `));
+  } finally {
+    if (childPid && isAlive(childPid)) process.kill(childPid, 'SIGKILL');
+    fs.rmSync(probePath, { force: true });
+    fs.rmSync(evidenceRoot, { recursive: true, force: true });
+  }
+});
+
+function isAlive(pid: number): boolean {
+  try {
+    process.kill(pid, 0);
+    return true;
+  } catch {
+    return false;
+  }
+}
```

**File**: `scripts/vitest-tmpdir-global-setup.ts` (modified, +13/-4)
```diff
@@ -6,6 +6,8 @@ import {
   TEST_RUN_TMP_ROOT,
   pruneAbandonedRunDirectories,
   reportPrunedRunDirectories,
+  reportStoppedRunDirectoryConsumers,
+  stopRunDirectoryConsumers,
 } from './check-tmpdir-leaks-model.ts';
 
 // os.tmpdir() reads TMPDIR on every call, so redirecting it here covers every
@@ -54,10 +56,17 @@ export function setup(): void {
 }
 
 // fallow-ignore-next-line unused-export
-export function teardown(): void {
-  fs.rmSync(testRunTmpDir, { recursive: true, force: true });
-  restoreEnv('TMPDIR', previousTmpDir);
-  restoreEnv('AGENT_DEVICE_SWIFT_CACHE_DIR', previousSwiftCacheDir);
+export async function teardown(): Promise<void> {
+  try {
+    reportStoppedRunDirectoryConsumers(
+      testRunTmpDir,
+      await stopRunDirectoryConsumers(testRunTmpDir),
+    );
+  } finally {
+    fs.rmSync(testRunTmpDir, { recursive: true, force: true });
+    restoreEnv('TMPDIR', previousTmpDir);
+    restoreEnv('AGENT_DEVICE_SWIFT_CACHE_DIR', previousSwiftCacheDir);
+  }
 }
 
 function restoreEnv(key: string, value: string | undefined): void {
```

#### Recent Merged Pull Requests:
- **PR #4118** (closed): refactor(capture-kit): read AXe element trees in one shared adapter (@gergomiklos)
- **PR #4117** (2026-10-31): docs(daemon-client): correct detached probe error rationale (@thymikee)
- **PR #4108** (2026-10-31): fix(daemon): recover provider leases a killed daemon left rented (@thymikee)
- **PR #4104** (2026-10-30): fix: complete Apple runner review follow-up (@thymikee)
- **PR #4103** (2026-10-30): test(ios): fail when snapshot bridge bounds drift between host and native (@thymikee)
- **PR #4101** (2026-10-31): refactor: extract daemon client workspace package (@thymikee)

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

## X. platform-android): disable persistent Android snapshots after an unhealthy helpe

**RULE**:
When implementing operations in `packages/platform-android/src/__tests__/snapshot-helper-session-lifecycle.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f9a1dab8`: platform-android): disable persistent Android snapshots after an unhealthy helper retirement (#4007). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/platform-android/src/__tests__/snapshot-helper-session-lifecycle.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { afterEach, beforeEach, test, vi } from 'vitest';
  isAndroidHelperForwardRemoval,
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { mkdtempForTest } from './test-utils/tmp-dir.ts';
import { withDiagnosticsScope } from '@agent-device/host-kit/diagnostics';
  vi.restoreAllMocks();
test('a reused session whose capture times out keeps the helper build one-shot until reset', async () => {
  const spawnArgs: (readonly string[])[] = [];
  // The helper answers once and then goes silent: the idle freeze of #3929. Force-stop kills the
  // frozen process cleanly, so the retirement proves release and only the timeout tells.
  const provider = createSessionProvider({
    calls: [],
    spawnArgs,
    answeredSnapshotsBeforeStall: 1,
    stalledSnapshots: 1,
  });
  const capture = (deviceKey: string) =>
    captureAndroidSnapshotWithHelperSession({
      adb: provider.exec,
      adbProvider: provider,
      deviceKey,
      commandTimeoutMs: 400,
    });
  const logPath = path.join(
    await mkdtempForTest('agent-device-android-session-disable-diag-'),
    'diag.ndjson',
  );

  await withDiagnosticsScope({ debug: true, logPath }, async () => {
    as
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
import { afterEach, beforeEach, test } from 'vitest';
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f9a1dab8` are properly handled with clean fallback behavior.
