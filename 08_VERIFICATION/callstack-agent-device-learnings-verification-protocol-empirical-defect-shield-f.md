# Verification Protocol: Verification Protocol: Empirical Defect Shield for callstack-agent-device-learnings

<!-- PROVENANCE_START
{
  "source_repository": "callstack-agent-device-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T17:25:24.390Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-callstack-agent-device-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack-agent-device-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T17:25:24.390Z`  
> **Learning ID**: `LEARN-EVO-callstack-agent-device-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `callstack-agent-device-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source**: github ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Source Version**: `d78be6c8`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T17:24:51.185Z  
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
> **Harvest Timestamp**: 2026-11-14T17:24:51.181Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Open source device layer for AI coding agents: a CLI, MCP server, and typed Node.js API to control mobile, web, TV, and desktop apps on devices and simulators, locally or in the cloud.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5392 stars

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
- **Issue #4530** (2026-11-14): **Android: a view with a content description and no text reads the same as a view showing that text**
  *Symptoms*: ## Purpose  On Android, a view that has a content description and no text is published exactly like a view whose text is that string. A caller cannot tell whether `label` is text on the screen, so a text check passes on an empty view.  ## Reproduction  Any view with a description and no text:  ```java TextView saved = new TextView(this); saved.setId(R.id.saved_task); saved.setContentDescription("saved_task"); // no text yet ```  `adb shell uiautomator dump` reports it as `text="" content-desc="saved_task"`.  ```sh agent-device get attrs 'id="dev.retest.bench.tasks:id/saved_task"' --json # "node": {"type":"android.widget.TextView","label":"saved_task","identifier":"dev.retest.bench.tasks:id/saved_task", ...} agent-device get text 'id="dev.retest.bench.tasks:id/saved_task"' --json # "text": "saved_task" ```  When the app then sets the view's text to `saved_task`, the node is the same, field for field. `snapshot --raw` gives the same answer as the regular snapshot.  ## Cause  `normalizeAndroidUiHierarchyNode` in `packages/platform-android/src/ui-hierarchy.ts` labels a node with `attrs.text || attrs.desc` and publishes `contentDescription` only when it differs from the label (#2912). When the description is the label, nothing on the node says so. `labelFacts` in `packages/provider-webdriver/src/webdriver-source.ts` follows the same rule.  ## Required behavior  A node labelled by its content description can be told apart from a node labelled by its text. `label` and `contentDescri

- **Issue #4517** (2026-11-14): **Prepare Android reinstall materialization before uninstalling the app**
  *Symptoms*: Umbrella: #4368. The user authorized Claude planning, assumption verification and completion workers, followed by correctness-preserving cleanup. Source authority: main ddbfc855661fa9d29b8c836057b7f5b099bcad44. No runtime proof is claimed. Preserve typed errors, existing command envelopes, #4050 full-unit fallback and meaningful integration/regression/native evidence. Do not merge, release, push tags, weaken assertions or retry failures blindly.  Purpose: Failed replacement materialization must not remove an installed Android app.  Current trigger: packages/platform-android/src/deployment/runtime.ts resolves the package and uninstalls before prepareArtifact. The replaceExisting path passes resolveIdentity:false; preparation extracts archives/checks installable shape but does not validate APK contents. A no-installable archive can fail after app removal.  Required behavior: Keep readiness and package resolution, then prepare before uninstall. Preparation failure or pre-uninstall cancellation must not uninstall or install. Preserve fresh-state semantics, native installation caps, installer hooks and whole-operation cache invalidation. Always clean a prepared artifact after later failure/success. Do not add an APK validator, change to adb install -r, broaden identity inspection or claim rollback. Corrupt APK content and bundletool/install failures that occur after successful preparation may still be destructive; this child only protects materialization failures.  Owned files: pa

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

### Incident Patch 1: `15e298f2` (2026-11-13)
**Commit Message**: fix(ios): confirm foldable rotation from the lit panel in either simulator set (#4343) (#4440)

* fix(ios): rotate a foldable in a scoped simulator set

Dispatch through the fold helper and confirm from the lit panel's currentOrientation, choosing each picker value for the turn still needed because the guest applies picker events relatively. Map portrait-upside-down to the picker's pud wire spelling in the fold helper.

* fix(ios): confirm the final scoped dispatch and keep picker angles private

* refactor(ios): split scoped rotation state out of the dispatch loop

* fix(ios): use the measured outer-panel picker offset on iPhone Duo

The outer panel reads the orientation-picker value itself (offset 0) and
the inner panel reads it plus 90 degrees. Measured on iPhone Duo (iOS 27.3)
against the panel table over 27 dispatches and five pose changes in both
directions: the picker value survives a fold, and only the lit panel's
offset changes. After a fold that left the picker at the upside-down
value, which the outer panel's UI could not show, one dispatch of the
target with the measured offset still landed it.

The guest model in the tests now follows that measurement: one picker
value

**File**: `.changeset/foldable-scoped-rotation.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+'agent-device': patch
+---
+
+Fix foldable iPhone simulator rotation in scoped sets and confirm the lit panel in both default and scoped sets. Rotation in both sets uses the fold helper, with no CoreDevice orientation polling. An already visible target dispatches nothing. Incomplete, unknown-power and multi-lit panel tables neither confirm nor dispatch. A target the panel never shows fails with `orientation-unverified`.
+
+Use the fixed iPhone Duo picker offsets measured in both sets (outer 0 degrees, inner +90 degrees), replacing runtime calibration. Inner landscape-left sends `portrait-upside-down`, mapped to the HID wire value `pud`; it remains unsupported as a user target. Delayed reads wait without resending the same picker value to the same panel.
+
+Unresolved guest reads inside the settle loop neither confirm nor dispatch and are retried. An unresolved final read fails with `orientation-panel-table-unavailable`. Multi-panel classification admits rotation without a model-name guard; a new multi-panel model needs its own picker mapping.
```

**File**: `apple/fold-helper/Fold.m` (modified, +8/-4)
```diff
@@ -106,14 +106,18 @@ static int runSet(NSString *argument) {
   return dispatchEvents(^BOOL(CFTypeRef client) { return runFrames(client, frames); });
 }
 
-// The orientation control has no upside-down value.
+// The upside-down picker value is spelled "pud" on the wire; "portrait-upside-down" is
+// ignored by the guest. It matters because each picker event rotates the display by
+// (new - previous) picker value: without a 180 value, one of the four display orientations
+// can never be landed (measured on iPhone Duo).
 static int runRotate(NSString *orientation) {
-  if (![@[@"portrait", @"landscape-left", @"landscape-right"] containsObject:orientation]) {
-    fprintf(stderr, "Expected orientation portrait, landscape-left or landscape-right\n");
+  NSString *value = [orientation isEqualToString:@"portrait-upside-down"] ? @"pud" : orientation;
+  if (![@[@"portrait", @"landscape-left", @"landscape-right", @"pud"] containsObject:value]) {
+    fprintf(stderr, "Expected orientation portrait, landscape-left, landscape-right or portrait-upside-down\n");
     return 2;
   }
   return dispatchEvents(^BOOL(CFTypeRef client) {
-    return sendControl(client, @"orientation-picker-control", @"enum", orientation);
+    return sendControl(client, @"orientation-picker-control", @"enum", value);
   });
 }
 
```

**File**: `docs/adr/0025-foldable-apple-panels.md` (modified, +22/-16)
```diff
@@ -58,6 +58,9 @@ It is the only reader of panel tables, and it selects the source.
   For a simulator in a scoped set, the fold helper's `panels` mode is the screen authority.
   It emits the same entry shape from the guest sources that `dtdeviceinfod` relays to CoreDevice: `CADisplay` and `BLSBacklight`.
   The guest lists every integrated panel and omits only the facts it cannot read.
+  Fold pose and rotation lit-panel reads explicitly request the guest table in either simulator set.
+  Panel-count classification keeps the set-based source: CoreDevice in the default set, guest in a scoped set.
+  Rotation confirms the lit panel because CoreDevice orientation can match the picker while the visible panel shows another orientation.
 - **Completeness.**
   Both sources list one entry per integrated panel. A panel that the parser drops is not single-panel evidence.
   If two or more integrated entries exist and not all parse, the device is multi-panel without a capture panel. Capture refuses with `capture-panel-unidentified`.
@@ -104,7 +107,7 @@ It is the only reader of panel tables, and it selects the source.
   `IOS_APPLE_DISPLAY_PROBE_TIMEOUT_MS` limits the probe to 5s, below the subsequent 20s screenshot deadline.
   Thus, an unresponsive CoreDevice cannot consume the capture's own budget.
   Measured cost is 0.16–0.26s, compared with 4.93s for the screenshot.
-  The guest probe costs about 0.3s. `IOS_SCOPED_DISPLAY_PROBE_BUDGET_MS` limits it to 15s, including the first helper build.
+  The guest probe costs about 0.3s. `IOS_GUEST_DISPLAY_PROBE_BUDGET_MS` limits it to 15s, including the first helper build.
 
 ## Why the default capture had to stop being implicit
 
@@ -370,19 +373,27 @@ Rejected alternatives:
 `XCUIDevice.orientation` has no effect on an iPhone Duo simulator, and the runner readback repeats the requested value.
 `devicectl device orientation set` reports success and has no effect on a simulator that `simctl boot` started.
 `orientation` therefore rotates a multi-panel simulator through the guest device-state control: the HID event that Device Hub's orientation menu sends (`orientation-picker-control`, type `enum`).
-The control has no upside-down value, so `portrait-upside-down` is refused with `unsupported-foldable-orientation`.
-Routing uses the `fold` admission and the panel table. A resolved panel count is a hardware fact, so the daemon probes each simulator once.
-
-The verdict comes from `devicectl device orientation get`, a process that never sent the HID event.
-CoreDevice answers each query with the value that it sampled at the previous query, so the first read after a dispatch is discarded.
-A rotation that no fresh read reports is refused with `orientation-unverified`.
-A simulator in a scoped set is refused with `unsupported-device-scope` before dispatch, because no reader can verify its rotation.
+The picker accepts `pud` for upside-down dispatch, which the inner panel needs to show landscape-left.
+The user target `portrait-upside-down` remains refused with `unsupported-foldable-orientation`.
+Routing uses the `fold` admission and the set-based panel-count source. A resolved panel count is a hardware fact, so the daemon probes each simulator once.
+A supplied helper is a reuse handle; only an explicit guest-source request changes the default-set source.
+Thus, classifying a single-panel default-set simulator does not prepare the fold helper.
+
+The picker offsets were measured on iPhone Duo; a new multi-panel model needs its own mapping.
+In both simulator sets, the helper reads the guest panel table and dispatches the fixed picker value for the established lit panel.
+The table maps the outer panel at zero offset and the inner panel at +90 degrees.
+Only a fresh `currentOrientation` from an established lit panel confirms the requested visible orientation.
+An incomplete table, unknown-power sibling, or multiple lit panels cannot confirm or dispatch.
+A repeated visible target dispatches nothing; delayed reads wait without resending to the same panel.
+A target that never appears is refused with `orientation-unverified` in either set.
+An unresolved guest read inside the settle loop neither confirms nor dispatches; the loop retries it.
+An unresolved final read reports `orientation-panel-table-unavailable` and points to the inventory diagnostic.
 
 Rejected alternatives:
 
-- **The panel table's `orientation.currentDeviceOrientation`: rejected.** It is screen-relative. On the Duo inner panel, it is a quarter-turn from the device orientation.
-- **A guest orientation read: rejected.** CoreMotion `CMDeviceOrientationManager` reports `Ambiguous`, and `BKSHIDServicesIsOrientationLockedWithOrientation` reports 0, after a rotation that CoreDevice and the screenshots confirm.
-- **Dispatch without a verdict in a scoped set: rejected.** The runner path already reported a false success there.
+- **CoreDevice orientation readback: rejected.** Its picker sample can lag and can match th
```

**File**: `docs/agents/device-foldable.md` (modified, +7/-6)
```diff
@@ -1,11 +1,12 @@
 # Foldable Apple verification
 
-Before you change capture behavior on a multi-panel device, read ADR 0025.
-To list the panels, run `xcrun devicectl device info displays --device <udid>`.
-In a scoped set, run `xcrun simctl --set <set> spawn <udid> ~/.agent-device/fold-helper/<key>/fold-helper panels`.
+Before capture changes, read ADR 0025.
+For default-set capture, run `xcrun devicectl device info displays --device <udid>`.
+For scoped capture or rotation, run `xcrun simctl --set <set> spawn <udid> ~/.agent-device/fold-helper/<key>/fold-helper panels`.
+For default-set rotation, omit `--set <set>`.
 
 - Panels: the list shows each integrated panel with `backlightState`. Only the lit panel permits capture.
-  A capture of the dark panel exits 0 and writes an all-black PNG.
+  A dark-panel capture exits 0 with a black PNG.
 - Input routing: after each pose change, verify a fresh control.
   A successful synthesis acknowledgement does not prove a hit.
   Examine the runner and simulator `testmanagerd`/BackBoard logs for display identity and delivery.
@@ -14,13 +15,13 @@ In a scoped set, run `xcrun simctl --set <set> spawn <udid> ~/.agent-device/fold
   The same helper reads the hinge back in `hinge` mode.
   After a fold, take another snapshot. Folds invalidate refs and coordinates.
   Verify locally with Device Hub stopped and the simulator booted through `simctl boot`.
-  Test these items in the default set and with `--ios-simulator-device-set`:
+  Test both sets (`--ios-simulator-device-set`):
   - All three poses.
   - Capture of the active panel.
   - An app interaction.
   Until GHA supports the runtime, Duo coverage remains local.
   After a fresh boot, a closed hinge can keep the inner panel lit for more than 30 seconds.
-  The lit panel is evidence only. It cannot separate `half-open` from `open`.
+  Panel power cannot separate `half-open` from `open`.
 - Touch overlays export at the captured track size.
   The compositor checks its output size and non-black content against the raw capture.
   If that check fails, `record stop` keeps the raw file. It reports `overlayWarning`.
```

**File**: `packages/command-surface/src/system/index.ts` (modified, +1/-1)
```diff
@@ -290,7 +290,7 @@ const backCommandDescription =
 const homeCommandDescription =
   'Send the selected device to its home screen. This leaves the app session open but moves the foreground away from the app.';
 const orientationCommandDescription =
-  'Set device orientation on iOS and Android. auto hands rotation back to the sensor on ADB-backed Android (local and Limrun); other backends refuse it. A foldable iPhone simulator (iPhone Duo) refuses portrait-upside-down, and refuses every rotation in a scoped simulator set.';
+  'Set device orientation on iOS and Android. auto hands rotation back to the sensor on ADB-backed Android (local and Limrun); other backends refuse it. In both default and scoped simulator sets, an iPhone Duo classified with more than one integrated panel refuses portrait-upside-down and rotates through the fold helper; it succeeds only when the lit panel shows the requested orientation, otherwise it fails with orientation-unverified, or orientation-panel-table-unavailable when the final guest panel table cannot be read. A simulator classified with one panel, or whose first classification read is unresolved, uses the standard runner rotation.';
 const foldGuidance = {
   hingeEvent: 'simulator HID hinge event',
   permissions: 'Device Hub and host Accessibility permission are not required.',
```

**File**: `packages/platform-apple/src/core/__tests__/display-inventory.test.ts` (modified, +98/-2)
```diff
@@ -33,12 +33,15 @@ vi.mock('@agent-device/host-kit/host-file', async (importOriginal) => {
 });
 
 import {
+  appleLitPanel,
   appleSimulatorDisplayArgvFragment,
+  establishedLitPanel,
   buildInventory,
   parseCoreDeviceDisplays,
   readPanelPower,
   resolveAppleCaptureDisplay,
   queryAppleDisplayInventory,
+  panelContentRotation,
   resolveAppleCaptureTarget,
   type AppleDeviceDisplay,
 } from '../display-inventory.ts';
@@ -362,6 +365,75 @@ describe('resolveAppleCaptureDisplay', () => {
   });
 });
 
+describe('panelContentRotation', () => {
+  test('parses each panel content rotation and nothing else', () => {
+    assert.equal(panelContentRotation('rot0'), 'portrait');
+    assert.equal(panelContentRotation('rot90'), 'landscape-right');
+    assert.equal(panelContentRotation('rot180'), 'portrait-upside-down');
+    assert.equal(panelContentRotation('rot270'), 'landscape-left');
+    for (const value of ['unknown', 'constructor', 'rot45', '']) {
+      assert.equal(panelContentRotation(value), undefined);
+    }
+  });
+});
+
+describe('establishedLitPanel', () => {
+  beforeEach(() => {
+    mockReadHostTextFile.mockReset();
+    mockReadHostTextFile.mockResolvedValue('');
+  });
+
+  function duoTable(mapEntry: (entry: Record<string, unknown>) => Record<string, unknown>) {
+    return JSON.stringify({
+      result: { displays: IPHONE_DUO_CLOSED.result.displays.map(mapEntry) },
+    });
+  }
+
+  test('a complete table with one lit panel establishes that panel for both selectors', () => {
+    const inventory = buildInventory([outerPanel, innerPanel]);
+    assert.equal(establishedLitPanel(inventory), outerPanel);
+    assert.deepEqual(appleLitPanel(inventory), { displayId: 1, widthPt: 466, heightPt: 678 });
+  });
+
+  test('two lit panels establish none', () => {
+    const inventory = buildInventory([outerPanel, { ...innerPanel, power: 'lit' }]);
+    assert.equal(establishedLitPanel(inventory), undefined);
+    assert.equal(appleLitPanel(inventory), undefined);
+  });
+
+  test('a lit panel beside a panel of unknown power establishes none', () => {
+    // Unknown power may be showing content, so the lit panel is not the only one that may be lit.
+    const inventory = buildInventory([outerPanel, { ...innerPanel, power: 'unknown' }]);
+    assert.equal(establishedLitPanel(inventory), undefined);
+    assert.equal(appleLitPanel(inventory), undefined);
+  });
+
+  test('an incomplete table establishes no panel even when one parsed panel is the only lit one', async () => {
+    // Two activeOn integrated entries; the inner one has no geometry and does not parse.
+    mockReadHostTextFile.mockResolvedValue(
+      duoTable((entry) => {
+        const lit: Record<string, unknown> = { ...entry, backlightState: 'activeOn' };
+        if (entry.name !== 'LCD-1') return lit;
+        const { nativeSize: _nativeSize, ...withoutGeometry } = lit;
+        return withoutGeometry;
+      }),
+    );
+    const inventory = await queryAppleDisplayInventory(IOS_TEST_SIMULATOR, {});
+    assert.equal(inventory.multiScreen, true);
+    assert.equal(inventory.displays.filter((display) => display.power === 'lit').length, 1);
+    assert.equal(establishedLitPanel(inventory), undefined);
+    assert.equal(appleLitPanel(inventory), undefined);
+  });
+
+  test('a single-panel or unresolved table establishes no foldable panel', () => {
+    assert.equal(establishedLitPanel(buildInventory([outerPanel])), undefined);
+    assert.equal(
+      establishedLitPanel({ displays: [], multiScreen: false, ambiguous: false, unresolved: true }),
+      undefined,
+    );
+  });
+});
+
 describe('resolveAppleCaptureTarget', () => {
   beforeEach(() => {
     mockRunXcrun.mockClear();
@@ -678,7 +750,10 @@ describe('scoped simulator panel table', () => {
     assert.equal(mockRunXcrun.mock.calls.length, 0);
   });
 
-  test('reads with the fold helper the caller already opened', async () => {
+  test.each([
+    ['scoped', scopedDuo],
+    ['default', { ...scopedDuo, simulatorSetPath: undefined }],
+  ] as const)('reads with the supplied fold helper in the %s set', async (_set, device) => {
     vi.mocked(ensureFoldHelperBinary).mockClear();
     const readPanelPayload = vi.fn(async () => ({
       result: { displays: (JSON.parse(GUEST_PANELS_OPEN) as { displays: unknown[] }).displays },
@@ -690,12 +765,33 @@ describe('scoped simulator panel table', () => {
       readPanelPayload,
     };
 
-    const inventory = await queryAppleDisplayInventory(scopedDuo, { foldHelper });
+    const inventory = await queryAppleDisplayInventory(device, { source: 'guest', foldHelper });
 
     assert.equal(inventory.activeDisplay?.name, 'LCD-1');
     assert.equal(readPanelPayload.mock.calls.length, 1);
     assert.equal(vi.mocked(ensureFoldHelperBinary).mock.calls.length, 0);
     assert.equal(mockRunSimctlForDevice.mock.calls.length, 0);
+    assert.equal(mockRunXcrun.mock.calls.length, 0);
+  });
+
+  test('a helper handle alone keeps the def
```

**File**: `packages/platform-apple/src/core/config.ts` (modified, +6/-9)
```diff
@@ -31,10 +31,10 @@ export const IOS_SIMULATOR_SCREENSHOT_TIMEOUT_MS = 20_000;
 // request-level daemon reset. Measured probe cost is ~0.2s.
 export const IOS_APPLE_DISPLAY_PROBE_TIMEOUT_MS = 5_000;
 /**
- * A scoped simulator's panel table comes from a guest helper that the first read on a host also
+ * A guest panel table comes from a helper that the first read on a host also
  * builds. This ceiling on the whole read, build included, stays below the capture's own budget.
  */
-export const IOS_SCOPED_DISPLAY_PROBE_BUDGET_MS = 15_000;
+export const IOS_GUEST_DISPLAY_PROBE_BUDGET_MS = 15_000;
 /**
  * One guest hinge read, before its sampling window: the fold helper waits at most 3s for its first
  * CoreMotion sample, so this exec deadline only guards a wedged `simctl spawn`.
@@ -55,14 +55,11 @@ export const IOS_FOLD_POSE_READ_INTERVAL_MS = 1_000;
 /** Two consecutive reads this close together mean the hinge has stopped moving. */
 export const IOS_FOLD_POSE_STABLE_DEGREES = 0.5;
 /**
- * How many fresh CoreDevice orientation reads a dispatched foldable rotation gets before it is
- * refused. One read costs ~0.2s, and the iPhone Duo reported the new orientation on the first
- * fresh read; the margin covers a loaded host. A read that times out counts as one that saw no
- * orientation. With the routing probe, a cold fold-helper build, and the HID dispatch, the worst
- * case stays inside the default 90s request envelope.
+ * Bounded lit-panel reads cover delayed HID effects and the two-lit interval after a fold.
+ * A fixed picker value is sent once per lit panel; the remaining reads only observe.
  */
-export const IOS_FOLDABLE_ORIENTATION_SETTLE_ATTEMPTS = 8;
-export const IOS_FOLDABLE_ORIENTATION_READ_TIMEOUT_MS = 2_000;
+export const IOS_FOLDABLE_ORIENTATION_SETTLE_ATTEMPTS = 6;
+export const IOS_FOLDABLE_ORIENTATION_SETTLE_MS = 600;
 
 // CoreSimulator can briefly stall while it services the scale lookup immediately
 // after a keyboard transition. Keep this bounded below the full capture budget.
```

**File**: `packages/platform-apple/src/core/device-orientation.ts` (removed, +0/-46)
```diff
@@ -1,46 +0,0 @@
-import type { DeviceRotation } from '@agent-device/contracts/device';
-import type { DeviceInfo } from '@agent-device/kernel/device';
-import { isCommandTimeoutError } from '@agent-device/host-kit/command';
-
-import { runIosDevicectlJsonRequest, type IosDevicectlJsonOutcome } from './devicectl.ts';
-
-/** CoreDevice `deviceOrientation` names, which are UIDeviceOrientation case names. */
-const CORE_DEVICE_ORIENTATIONS: ReadonlyMap<unknown, DeviceRotation> = new Map<
-  unknown,
-  DeviceRotation
->([
-  ['portrait', 'portrait'],
-  ['portraitUpsideDown', 'portrait-upside-down'],
-  ['landscapeLeft', 'landscape-left'],
-  ['landscapeRight', 'landscape-right'],
-]);
-
-/**
- * Reads the orientation of the device itself through `devicectl device orientation get`.
- * The display table's `currentDeviceOrientation` is not a replacement: on the iPhone Duo inner
- * panel, it is a quarter-turn from the device orientation.
- *
- * CoreDevice answers each query with the orientation it sampled at the previous query, so the
- * first read after a change can be stale. A failed or timed-out read, face-up, and face-down
- * return nothing.
- */
-export async function readAppleDeviceOrientation(
-  device: DeviceInfo,
-  options: { timeoutMs: number; signal?: AbortSignal },
-): Promise<DeviceRotation | undefined> {
-  let outcome: IosDevicectlJsonOutcome;
-  try {
-    outcome = await runIosDevicectlJsonRequest({
-      jsonPrefix: 'agent-device-apple-orientation',
-      args: ['devicectl', 'device', 'orientation', 'get', '--device', device.id],
-      timeoutMs: options.timeoutMs,
-      signal: options.signal,
-    });
-  } catch (error) {
-    if (options.signal?.aborted || !isCommandTimeoutError(error)) throw error;
-    return undefined;
-  }
-  if (!outcome.ok) return undefined;
-  const payload = outcome.payload as { result?: { deviceOrientation?: unknown } } | null;
-  return CORE_DEVICE_ORIENTATIONS.get(payload?.result?.deviceOrientation);
-}
```

---

### Incident Patch 2: `cc3b99b3` (2026-11-13)
**Commit Message**: fix(ios): bound the idle wait of keyboard dismiss and keyboard enter (#4454)

* fix(ios): bound the idle wait of keyboard dismiss and keyboard enter

`keyboard dismiss` and `keyboard enter` tapped the keyboard's control with a
plain XCUIElement.tap() outside withBoundedInteractionIdleTimeoutIfSupported,
which `type`, `swipe` and taps already use. XCTest then waited for the app to
idle with its own timeout. An app that keeps animating (Safari right after an
iPhone Duo unfold) held the runner main thread past its 30 s watchdog: the
command failed with "main thread execution timed out" and the next commands
were refused until XCTest gave up.

Both commands now run inside the bounded wait with both quiescence waits
skipped. dismissKeyboard still waits for the keyboard to go and the screen to
settle on its own.

The host app's --agent-device-keyboard-busy fixture keeps a UIView animation
in flight while its field has focus, until a backstop, and records whether its
Done accessory and its return key landed while the app was still busy.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(ios): require busy keyboard coverage and settle Return

* docs(ios): restore Simulator keyboard

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunner/AgentDeviceRunnerAppFixtures.m` (modified, +91/-0)
```diff
@@ -75,6 +75,9 @@ @interface AgentDeviceRunnerFixtureViewController () <UNUserNotificationCenterDe
 @property(nonatomic, assign) BOOL alertFixtureStarted;
 @property(nonatomic, strong) NSTimer *alertActivationBusyBackstop;
 @property(nonatomic, strong) NSTimer *alertBannerRepost;
+@property(nonatomic, weak) UITextField *keyboardBusyField;
+@property(nonatomic, strong) UILabel *keyboardBusyAnswer;
+@property(nonatomic, strong) NSTimer *keyboardBusyBackstop;
 @end
 
 // A one-time-code field that announces how many digits it holds instead of the digits, the way
@@ -251,6 +254,57 @@ - (void)stopAlertActivationBusy {
   self.alertActivationBusyBackstop = nil;
 }
 
+// The keyboard counterpart of the busy alert: the field starts the same never-ending UIView animation
+// when it takes focus, so XCTest sees work in flight for as long as the keyboard is up. Its Done
+// accessory and its return key record whether they landed while the app was still busy. The backstop
+// passed after `--agent-device-keyboard-busy` ends the busy state, so a command that waits for the app
+// to idle before it taps still finishes, and records "after busy" instead of outlasting the test.
+static NSTimeInterval AgentDeviceKeyboardBusyWindow(void) {
+  NSArray<NSString *> *arguments = NSProcessInfo.processInfo.arguments;
+  NSUInteger flag = [arguments indexOfObject:@"--agent-device-keyboard-busy"];
+  return flag + 1 < arguments.count ? arguments[flag + 1].doubleValue : 0;
+}
+
+- (void)startKeyboardBusy {
+  if (self.keyboardBusyBackstop != nil) {
+    return;
+  }
+  self.keyboardBusyBackstop = [NSTimer scheduledTimerWithTimeInterval:AgentDeviceKeyboardBusyWindow()
+                                                               target:self
+                                                             selector:@selector(stopKeyboardBusy)
+                                                             userInfo:nil
+                                                              repeats:NO];
+  [UIView animateWithDuration:0.4
+                          delay:0
+                        options:(UIViewAnimationOptionRepeat | UIViewAnimationOptionAutoreverse)
+                     animations:^{
+                       self.keyboardBusyAnswer.transform = CGAffineTransformMakeTranslation(0, 8);
+                     }
+                     completion:nil];
+}
+
+- (void)stopKeyboardBusy {
+  [self.keyboardBusyAnswer.layer removeAllAnimations];
+  self.keyboardBusyAnswer.transform = CGAffineTransformIdentity;
+  [self.keyboardBusyBackstop invalidate];
+  self.keyboardBusyBackstop = nil;
+}
+
+- (void)recordKeyboardBusyAnswer:(NSString *)control {
+  self.keyboardBusyAnswer.text = [NSString
+      stringWithFormat:@"%@ %@", control, self.keyboardBusyBackstop != nil ? @"while busy" : @"after busy"];
+  [self stopKeyboardBusy];
+  [self.keyboardBusyField resignFirstResponder];
+}
+
+- (void)keyboardBusyDonePressed {
+  [self recordKeyboardBusyAnswer:@"Done"];
+}
+
+- (void)keyboardBusyReturnPressed {
+  [self recordKeyboardBusyAnswer:@"Return"];
+}
+
 // A banner from this app, shown over its own alert and re-posted before the previous one expires so
 // one is on screen for as long as the first alert is unanswered. XCTest treats such a banner as an
 // interruption of every event aimed at the app (#2546's late tap, from the banner side).
@@ -652,6 +706,43 @@ - (void)viewDidLoad {
     self.alertActivationBusyAnswer = busyAnswer;
   }
 
+  if ([NSProcessInfo.processInfo.arguments containsObject:@"--agent-device-keyboard-busy"]) {
+    UITextField *field = [[UITextField alloc] init];
+    field.accessibilityIdentifier = @"agent-device-keyboard-busy-input";
+    field.placeholder = @"Busy while editing";
+    field.borderStyle = UITextBorderStyleRoundedRect;
+    UIToolbar *accessory = [[UIToolbar alloc] initWithFrame:CGRectMake(0, 0, 320, 44)];
+    accessory.items = @[
+      [[UIBarButtonItem alloc] initWithBarButtonSystemItem:UIBarButtonSystemItemFlexibleSpace target:nil action:nil],
+      [[UIBarButtonItem alloc] initWithTitle:@"Done"
+                                       style:UIBarButtonItemStyleDone
+                                      target:self
+                                      action:@selector(keyboardBusyDonePressed)],
+    ];
+    field.inputAccessoryView = accessory;
+    [field addTarget:self action:@selector(startKeyboardBusy) forControlEvents:UIControlEventEditingDidBegin];
+    [field addTarget:self
+                  action:@selector(keyboardBusyReturnPressed)
+        forControlEvents:UIControlEventEditingDidEndOnExit];
+    field.translatesAutoresizingMaskIntoConstraints = NO;
+    [self.view addSubview:field];
+    UILabel *answer = [[UILabel alloc] init];
+    answer.text = @"Unanswered";
+    answer.accessibilityIdentifier = @"agent-device-keyboard-busy-answer";
+    answer.translatesAutoresizingMaskIntoConstraints = NO;
+    [self.view addSubview:answer];
+    [NSLayoutConstraint activateConstraints:@[
+      [fiel
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+CommandExecution.swift` (modified, +14/-2)
```diff
@@ -587,7 +587,13 @@ extension RunnerTests {
       }
       return Response(ok: true, data: DataPayload(message: command.command.rawValue))
     case .keyboardDismiss:
-      let result = dismissKeyboard(app: activeApp)
+      var dismissal: (wasVisible: Bool, dismissed: Bool, visible: Bool, mechanism: RunnerKeyboardDismissMechanism?)?
+      withBoundedInteractionIdleTimeoutIfSupported(activeApp, waits: .bothSkipped) {
+        dismissal = dismissKeyboard(app: activeApp)
+      }
+      guard let result = dismissal else {
+        return Response(ok: false, error: ErrorPayload(message: "keyboardDismiss produced no result"))
+      }
       if result.wasVisible && !result.dismissed {
         return Response(
           ok: false,
@@ -610,7 +616,13 @@ extension RunnerTests {
         )
       )
     case .keyboardReturn:
-      let result = pressKeyboardReturn(app: activeApp)
+      var press: (wasVisible: Bool, pressed: Bool, visible: Bool)?
+      withBoundedInteractionIdleTimeoutIfSupported(activeApp, waits: .preEventSkipped) {
+        press = pressKeyboardReturn(app: activeApp)
+      }
+      guard let result = press else {
+        return Response(ok: false, error: ErrorPayload(message: "keyboardReturn produced no result"))
+      }
       if !result.pressed {
         return Response(
           ok: false,
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/UnitTests/RunnerTests+KeyboardTests.swift` (modified, +62/-0)
```diff
@@ -327,6 +327,68 @@ extension RunnerTests {
   private func textEntryInputCount() -> Int {
     app.textFields.count + app.secureTextFields.count + app.searchFields.count + app.textViews.count
   }
+
+  // `keyboard dismiss` and `keyboard enter` tap a keyboard control. An app that never stops animating
+  // made that tap wait for XCTest's idle timeout, past the runner's main-thread watchdog, so the command
+  // failed with "main thread execution timed out" and the runner refused the next commands. The fixture
+  // keeps an animation in flight while its field has focus, until its backstop, and records whether
+  // each control landed while the app was still busy.
+  static let keyboardBusyBackstop: TimeInterval = 20
+
+  @MainActor
+  func testKeyboardDismissTapsItsDismissKeyWhileTheAppIsBusy() throws {
+    try withBusyKeyboardField {
+      let command = try runnerCommandFixture(#"{"command":"keyboardDismiss","commandId":"dismiss-busy"}"#)
+      let response = try execute(command: command)
+
+      XCTAssertTrue(response.ok, String(describing: response.error))
+      let answer = app.staticTexts["agent-device-keyboard-busy-answer"].label
+      XCTAssertEqual(answer, "Done while busy")
+      NSLog("AGENT_DEVICE_KEYBOARD_BUSY command=dismiss response.ok=%@ answer=%@", response.ok ? "true" : "false", answer)
+    }
+  }
+
+  @MainActor
+  func testKeyboardEnterPressesReturnWhileTheAppIsBusy() throws {
+    try withBusyKeyboardField {
+      let command = try runnerCommandFixture(#"{"command":"keyboardReturn","commandId":"return-busy"}"#)
+      let response = try execute(command: command)
+
+      XCTAssertTrue(response.ok, String(describing: response.error))
+      XCTAssertEqual(response.data?.wasVisible, true)
+      XCTAssertEqual(response.data?.visible, false)
+      let answer = app.staticTexts["agent-device-keyboard-busy-answer"].label
+      XCTAssertEqual(answer, "Return while busy")
+      NSLog("AGENT_DEVICE_KEYBOARD_BUSY command=enter response.ok=%@ visible=%@ answer=%@", response.ok ? "true" : "false", String(describing: response.data?.visible), answer)
+    }
+  }
+
+  @MainActor
+  private func withBusyKeyboardField(_ body: () throws -> Void) throws {
+    app.launchArguments = ["--agent-device-keyboard-busy", String(Self.keyboardBusyBackstop)]
+    app.launch()
+    defer {
+      invalidateCachedTarget(reason: "unit_test_cleanup")
+      app.terminate()
+    }
+    let field = app.textFields["agent-device-keyboard-busy-input"]
+    XCTAssertTrue(field.waitForFixtureExistence(timeout: appExistenceTimeout))
+    mainOwned.app = app
+    mainOwned.bundleId = "com.callstack.agentdevice.runner"
+    mainOwned.processIdentifier = try XCTUnwrap(Self.processIdentifier(of: app))
+    // Focus starts the busy animation, so this tap must not wait for the app to idle either.
+    withBoundedInteractionIdleTimeoutIfSupported(app, waits: .bothSkipped) { field.tap() }
+    let keyboardDeadline = Date().addingTimeInterval(5)
+    while !isKeyboardVisible(app: app) && Date() < keyboardDeadline {
+      sleepFor(0.2)
+    }
+    XCTAssertTrue(
+      isKeyboardVisible(app: app),
+      "Enable the simulator software keyboard before running the busy keyboard tests; see apple/runner/README.md"
+    )
+    XCTAssertEqual(app.staticTexts["agent-device-keyboard-busy-answer"].label, "Unanswered")
+    try body()
+  }
 #endif
 }
 #endif
```

**File**: `apple/runner/README.md` (modified, +25/-0)
```diff
@@ -56,6 +56,31 @@ Protocol and maintenance references:
 - `UnitTests/RunnerTests+<Source>Tests.swift`: the `AGENT_DEVICE_RUNNER_UNIT_TESTS` tests for each
   source file. The packaged runner source omits this directory.
 
+### Busy keyboard regression tests
+
+Run the two `testKeyboard*WhileTheAppIsBusy` tests with the simulator software keyboard enabled.
+Before you boot a throwaway simulator, save the current hardware-keyboard preference:
+
+```sh
+keyboard_preference=$(defaults read com.apple.iphonesimulator ConnectHardwareKeyboard 2>/dev/null) || keyboard_preference=absent
+defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool NO
+```
+
+After the tests, restore the preference in the same shell, including when the tests fail.
+If the key was absent, delete it:
+
+```sh
+if [ "$keyboard_preference" = absent ]; then
+  defaults delete com.apple.iphonesimulator ConnectHardwareKeyboard
+else
+  defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool "$keyboard_preference"
+fi
+```
+
+If the software keyboard does not appear, the tests fail instead of skipping.
+The tests assert command success and the fixture's `Done while busy` or `Return while busy` label.
+The Return test also asserts the keyboard visibility reported after submission.
+
 ## Snapshot Strategy
 
 iOS snapshots have two explicit public capture modes:
```

---

### Incident Patch 3: `e997f1cf` (2026-11-13)
**Commit Message**: fix(android): restore screenshot demo permission state (#4477)

* Restore Android screenshot demo permission

* fix(android): preserve screenshot errors through cleanup

* test(android): verify normalized screenshot permission restoration

* fix(android): restore demo permission from its observed listing

* test(android): retain capture failures when evidence cleanup fails

**File**: `packages/platform-android/src/__tests__/screenshot.test.ts` (modified, +124/-0)
```diff
@@ -17,6 +17,7 @@ import { screenshotAndroid } from '../screenshot.ts';
 import type { DeviceInfo } from '@agent-device/kernel/device';
 import { runCmd } from '@agent-device/host-kit/command';
 import { sleep } from '../adb.ts';
+import * as adbHost from '../adb-host.ts';
 
 const VALID_PNG = Buffer.from(
   'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+b9xkAAAAASUVORK5CYII=',
@@ -146,3 +147,126 @@ test('Android screenshots capture immediately by default and stabilize only when
     );
   });
 });
+
+for (const initial of [undefined, '0', '1', 'custom=value'] as const) {
+  for (const outcome of ['success', 'capture failure', 'settle failure'] as const) {
+    test(`stabilized screenshot restores ${initial ?? 'absent'} after ${outcome}`, async () => {
+      let setting: string | undefined = initial;
+      const primary = new Error(outcome);
+      mockRunCmd.mockImplementation(async (_cmd, args) => {
+        if (args.includes('settings')) {
+          if (args.includes('list')) {
+            return {
+              exitCode: 0,
+              stdout: setting === undefined ? '' : `sysui_demo_allowed=${setting}\n`,
+              stderr: '',
+            };
+          }
+
+          if (args.includes('get')) return { exitCode: 0, stdout: `${setting}\n`, stderr: '' };
+          if (args.includes('delete')) setting = undefined;
+          if (args.includes('put')) setting = args.at(-1);
+        }
+        if (args.includes('exec-out')) {
+          if (outcome === 'capture failure') throw primary;
+          return { exitCode: 0, stdout: '', stderr: '', stdoutBuffer: VALID_PNG };
+        }
+        return { exitCode: 0, stdout: '', stderr: '' };
+      });
+      if (outcome === 'settle failure') mockSleep.mockRejectedValue(primary);
+      await withTempScreenshot('screenshot-restore-', async (outPath) => {
+        if (outcome === 'success') await screenshotAndroid(device, outPath, { stabilize: true });
+        else
+          await assert.rejects(
+            screenshotAndroid(device, outPath, { stabilize: true }),
+            (error) => error === primary,
+          );
+        assert.equal(setting, initial);
+      });
+    });
+  }
+}
+
+test('failed prior setting read does not mutate demo mode', async () => {
+  mockRunCmd.mockImplementation(async (_cmd, args) => {
+    if (args.includes('settings') && args.includes('list'))
+      return { exitCode: 1, stdout: '', stderr: 'read failed' };
+    throw new Error('unexpected command');
+  });
+  await withTempScreenshot('screenshot-read-failure-', async (outPath) => {
+    await assert.rejects(screenshotAndroid(device, outPath, { stabilize: true }), {
+      code: 'COMMAND_FAILED',
+    });
+    assert.equal(mockRunCmd.mock.calls.length, 1);
+  });
+});
+
+test('restoration failure surfaces after a successful capture', async () => {
+  mockRunCmd.mockImplementation(async (_cmd, args) => {
+    if (args.includes('settings') && args.includes('delete'))
+      return { exitCode: 1, stdout: '', stderr: 'restore failed' };
+    if (args.includes('exec-out'))
+      return { exitCode: 0, stdout: '', stderr: '', stdoutBuffer: VALID_PNG };
+    return { exitCode: 0, stdout: '', stderr: '' };
+  });
+  await withTempScreenshot('screenshot-restore-failure-', async (outPath) => {
+    await assert.rejects(screenshotAndroid(device, outPath, { stabilize: true }), {
+      code: 'COMMAND_FAILED',
+    });
+  });
+});
+
+test('restoration failure is diagnostic evidence when capture fails', async () => {
+  const primary = new Error('capture failed');
+  const cleanup = new Error('restore failed');
+  const diagnostic = vi.spyOn(adbHost.requireAndroidAdbHost(), 'emitDiagnostic');
+  mockRunCmd.mockImplementation(async (_cmd, args) => {
+    if (args.includes('settings') && args.includes('delete')) throw cleanup;
+    if (args.includes('exec-out')) throw primary;
+    return { exitCode: 0, stdout: '', stderr: '' };
+  });
+  try {
+    await withTempScreenshot('screenshot-both-fail-', async (outPath) => {
+      await assert.rejects(
+        screenshotAndroid(device, outPath, { stabilize: true }),
+        (error) => error === primary,
+      );
+      assert.equal(
+        diagnostic.mock.calls.some(
+          ([event]) => event.phase === 'android_screenshot_demo_setting_restore_failed',
+        ),
+        true,
+      );
+    });
+  } finally {
+    diagnostic.mockRestore();
+  }
+});
+
+test('restoration uses the exact listing value across CRLF without a secondary get', async () => {
+  let setting = '0';
+  mockRunCmd.mockImplementation(async (_cmd, args) => {
+    if (args.includes('settings')) {
+      if (args.includes('list'))
+        return {
+          exitCode: 0,
+          stdout: `sysui_demo_allowed_extra=1\r\nsysui_demo_allowed=${setting}\r\nother=2\r\n`,
+          stderr: '',
+        };
+      if (args.includes('get')) return { exitCode: 0, stdout: `${setting}\r\n`, stderr: '' };
+      if (args.includes('put')) s
```

**File**: `packages/platform-android/src/__tests__/snapshot-results.test.ts` (added, +563/-0)
```diff
@@ -0,0 +1,563 @@
+import { afterEach, beforeEach, test, vi } from 'vitest';
+import assert from 'node:assert/strict';
+
+vi.mock('@agent-device/host-kit/command', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('@agent-device/host-kit/command')>();
+  return { ...actual, runCmd: vi.fn() };
+});
+vi.mock('../adb.ts', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('../adb.ts')>();
+  return { ...actual, sleep: vi.fn() };
+});
+
+import { bindMissingAndroidHelperHost } from './test-utils/android-host-test-setup.ts';
+
+import { snapshotAndroid } from '../snapshot.ts';
+
+import { buildUiHierarchySnapshot, parseUiHierarchyTree } from '../ui-hierarchy.ts';
+
+import * as diagnosticsModule from '@agent-device/host-kit/diagnostics';
+import { AppError } from '@agent-device/kernel/errors';
+
+import { resetAndroidSnapshotHelperSessions } from '../snapshot-helper-session-lifecycle.ts';
+import { type AndroidAdbExecutor } from '../snapshot-helper.ts';
+
+import {
+  androidHelperInstrumentationOutput as helperOutput,
+  ANDROID_HELPER_INSTALLED_VERSION_PROBE as installedHelperProbe,
+} from './snapshot-helper-session.fixtures.ts';
+
+import {
+  mockSleep,
+  device,
+  helperArtifact,
+  snapshotAndroidWithHelper,
+  createHelperAdb,
+  androidSnapshotHelperAdb,
+  captureDiagnostics,
+  resetSnapshotTestState,
+} from './test-utils/android-snapshot-test-world.ts';
+
+beforeEach(resetSnapshotTestState);
+afterEach(async () => {
+  await resetAndroidSnapshotHelperSessions();
+});
+
+test('snapshotAndroid emits helper failure diagnostics', async () => {
+  const helperAdb: AndroidAdbExecutor = async (args) => {
+    if (args.includes('--show-versioncode')) {
+      return {
+        exitCode: 0,
+        stdout: 'package:com.callstack.agentdevice.snapshothelper versionCode:13004',
+        stderr: '',
+      };
+    }
+    if (args[0] === 'shell' && args[1] === 'am' && args[2] === 'force-stop')
+      return { exitCode: 0, stdout: '', stderr: '' };
+    return { exitCode: 1, stdout: '', stderr: 'helper unavailable' };
+  };
+
+  const diagnostics = await captureDiagnostics(
+    { session: 'snapshot-failure', requestId: 'req-2', command: 'snapshot', debug: true },
+    async () => {
+      await assert.rejects(
+        () => snapshotAndroid(device, { helperAdb, helperArtifact }),
+        (error: unknown) => {
+          assert(error instanceof AppError);
+          assert.equal(error.code, 'COMMAND_FAILED');
+          assert.match(error.message, /helper unavailable/);
+          return true;
+        },
+      );
+      return diagnosticsModule.flushDiagnosticsToSessionFile({ force: true })?.path ?? null;
+    },
+  );
+
+  assert.match(diagnostics, /android_snapshot_helper_failed/);
+  assert.match(diagnostics, /helper unavailable/);
+});
+
+test('snapshotAndroid emits unavailable diagnostics when helper artifact is missing', async () => {
+  bindMissingAndroidHelperHost();
+  const diagnostics = await captureDiagnostics(
+    {
+      session: 'snapshot-helper-missing',
+      requestId: 'req-missing',
+      command: 'snapshot',
+      debug: true,
+    },
+    async () => {
+      await assert.rejects(() => snapshotAndroid(device), /Android snapshot helper is unavailable/);
+      return diagnosticsModule.flushDiagnosticsToSessionFile({ force: true })?.path ?? null;
+    },
+  );
+
+  assert.match(diagnostics, /android_snapshot_helper_artifact_resolution/);
+  assert.match(diagnostics, /android_snapshot_helper_unavailable/);
+  assert.match(diagnostics, /artifact_not_found/);
+});
+
+test('snapshotAndroid gives an actionable hint when the helper artifact is missing on disk', async () => {
+  bindMissingAndroidHelperHost();
+  await assert.rejects(
+    () => snapshotAndroid(device),
+    (error) => {
+      assert.match((error as Error).message, /the bundled helper artifact was not found/);
+      const hint = String((error as { details?: Record<string, unknown> }).details?.hint);
+      assert.match(hint, /pnpm build:android/);
+      assert.match(hint, /prepack/);
+      assert.match(hint, /\.manifest\.json/);
+      assert.match(hint, /\.apk/);
+      // The npm package excludes *.idsig by design — the hint must never claim it is required.
+      assert.doesNotMatch(hint, /idsig/);
+      return true;
+    },
+  );
+});
+
+test('snapshotAndroid distinguishes a device-side install rejection from a missing build artifact', async () => {
+  const helperAdb: AndroidAdbExecutor = async (args) => {
+    if (args.includes('--show-versioncode')) {
+      // No installed package reported, so ensureAndroidSnapshotHelper treats the
+      // helper as missing and attempts a real install.
+      return { exitCode: 0, stdout: '', stderr: '' };
+    }
+    if (args[0] === 'install') {
+      return { exitCode: 1, stdout: '', stderr: 'Failure [INSTALL_FAILED_TEST_ONLY]' };
+    }
+    throw new Error(`unexpected adb args: ${args.join(' ')}`);
+  };
+
+  aw
```

**File**: `packages/platform-android/src/__tests__/snapshot.test.ts` (modified, +31/-629)
```diff
@@ -12,23 +12,17 @@ vi.mock('../adb.ts', async (importOriginal) => {
   return { ...actual, sleep: vi.fn() };
 });
 
-import {
-  bindMissingAndroidHelperHost,
-  mkdtempForTest,
-} from './test-utils/android-host-test-setup.ts';
+import { mkdtempForTest } from './test-utils/android-host-test-setup.ts';
 import { screenshotAndroid } from '../screenshot.ts';
 import { snapshotAndroid } from '../snapshot.ts';
 import { readAndroidGestureViewport } from '../touch-executor.ts';
-import { buildUiHierarchySnapshot, parseUiHierarchyTree } from '../ui-hierarchy.ts';
-import type { DeviceInfo } from '@agent-device/kernel/device';
+
 import * as diagnosticsModule from '@agent-device/host-kit/diagnostics';
 import { AppError } from '@agent-device/kernel/errors';
-import { runCmd } from '@agent-device/host-kit/command';
-import { sleep } from '../adb.ts';
-import { resetAndroidSnapshotHelperInstallCache } from '../snapshot-helper-install.ts';
+
 import { resetAndroidSnapshotHelperSessions } from '../snapshot-helper-session-lifecycle.ts';
 import { type AndroidAdbExecutor } from '../snapshot-helper.ts';
-import { ANDROID_SNAPSHOT_HELPER_FIXTURE_ARTIFACT } from './test-utils/android-snapshot-helper.ts';
+
 import {
   androidHelperInstrumentationOutput as helperOutput,
   createPersistentSnapshotHelperProvider,
@@ -39,74 +33,20 @@ import {
 } from './snapshot-helper-session.fixtures.ts';
 import { withAndroidAdbProvider, type AndroidAdbProvider } from '../adb-executor.ts';
 
-const VALID_PNG = Buffer.from(
-  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+b9xkAAAAASUVORK5CYII=',
-  'base64',
-);
-const mockRunCmd = vi.mocked(runCmd);
-const mockSleep = vi.mocked(sleep);
-
-const device: DeviceInfo = {
-  platform: 'android',
-  id: 'emulator-5554',
-  name: 'Pixel',
-  kind: 'emulator',
-  booted: true,
-};
-
-const helperArtifact = ANDROID_SNAPSHOT_HELPER_FIXTURE_ARTIFACT;
-
-function snapshotAndroidWithHelper(
-  helperAdb: AndroidAdbExecutor,
-  options: Omit<
-    NonNullable<Parameters<typeof snapshotAndroid>[1]>,
-    'helperAdb' | 'helperArtifact'
-  > = {},
-) {
-  return snapshotAndroid(device, {
-    ...options,
-    helperAdb,
-    helperArtifact,
-  });
-}
-
-function createHelperAdb(
-  handlers: Partial<Record<'instrument' | 'activity', AndroidAdbExecutor>>,
-): AndroidAdbExecutor {
-  return async (args, options) => {
-    if (isHelperVersionProbe(args)) return installedHelperProbe;
-    if (isHelperRuntimeReset(args)) {
-      return { exitCode: 0, stdout: '', stderr: '' };
-    }
-    const operation = helperAdbOperation(args);
-    const handler = operation ? handlers[operation] : undefined;
-    if (handler) return await handler(args, options);
-    throw new Error(`unexpected helper adb args: ${args.join(' ')}`);
-  };
-}
-
-function isHelperVersionProbe(args: readonly string[]): boolean {
-  return args.includes('--show-versioncode');
-}
-
-function helperAdbOperation(args: readonly string[]): 'instrument' | 'activity' | undefined {
-  if (args.includes('instrument')) return 'instrument';
-  return args.includes('dumpsys') && args.includes('activity') ? 'activity' : undefined;
-}
-
-beforeEach(async () => {
-  await resetAndroidSnapshotHelperSessions();
-  resetAndroidSnapshotHelperInstallCache();
-  mockRunCmd.mockReset();
-  mockSleep.mockReset();
-  mockSleep.mockResolvedValue(undefined);
-  mockRunCmd.mockImplementation(async (_cmd, args) => {
-    if (args.includes('exec-out')) {
-      return { exitCode: 0, stdout: '', stderr: '', stdoutBuffer: VALID_PNG };
-    }
-    return { exitCode: 0, stdout: '', stderr: '' };
-  });
-});
+import {
+  VALID_PNG,
+  mockRunCmd,
+  mockSleep,
+  device,
+  helperArtifact,
+  snapshotAndroidWithHelper,
+  createHelperAdb,
+  isAndroidSdkVersionCommand,
+  captureDiagnostics,
+  resetSnapshotTestState,
+} from './test-utils/android-snapshot-test-world.ts';
+
+beforeEach(resetSnapshotTestState);
 
 afterEach(async () => {
   await resetAndroidSnapshotHelperSessions();
@@ -119,7 +59,16 @@ test('screenshotAndroid waits for transient UI when stabilization is requested',
     await screenshotAndroid(device, outPath, { stabilize: true });
 
     // Demo mode is one setting and two broadcasts, all before the settle.
-    assert.deepEqual(events, ['enable', 'enable', 'enable', 'settle:1000', 'capture', 'disable']);
+    assert.deepEqual(events, [
+      'read',
+      'enable',
+      'enable',
+      'enable',
+      'settle:1000',
+      'capture',
+      'disable',
+      'restore',
+    ]);
   });
 });
 
@@ -221,7 +170,9 @@ function mockScreenshotEvents(events: string[]): void {
       events.push('capture');
       return { exitCode: 0, stdout: '', stderr: '', stdoutBuffer: VALID_PNG };
     }
-    if (!args.includes('dumpsys')) events.push(args.includes('exit') ? 'disable' : 'enable');
+    if (args.includes('list') && args.includes('settings')) events.push('read');
+    else if (args.includes('delete') && args.includes('settings')) eve
```

**File**: `packages/platform-android/src/__tests__/test-utils/android-snapshot-test-world.ts` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+import { vi } from 'vitest';
+import assert from 'node:assert/strict';
+import { promises as fs } from 'node:fs';
+import { runCmd } from '@agent-device/host-kit/command';
+import type { DeviceInfo } from '@agent-device/kernel/device';
+import * as diagnosticsModule from '@agent-device/host-kit/diagnostics';
+import { sleep } from '../../adb.ts';
+import { snapshotAndroid } from '../../snapshot.ts';
+import { resetAndroidSnapshotHelperInstallCache } from '../../snapshot-helper-install.ts';
+import { resetAndroidSnapshotHelperSessions } from '../../snapshot-helper-session-lifecycle.ts';
+import type { AndroidAdbExecutor } from '../../snapshot-helper.ts';
+import { mkdtempForTest } from './android-host-test-setup.ts';
+import { ANDROID_SNAPSHOT_HELPER_FIXTURE_ARTIFACT } from './android-snapshot-helper.ts';
+import {
+  androidHelperInstrumentationOutput as helperOutput,
+  isAndroidHelperRuntimeForceStop as isHelperRuntimeReset,
+  ANDROID_HELPER_INSTALLED_VERSION_PROBE as installedHelperProbe,
+} from '../snapshot-helper-session.fixtures.ts';
+
+export const VALID_PNG = Buffer.from(
+  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+b9xkAAAAASUVORK5CYII=',
+  'base64',
+);
+
+export const mockRunCmd = vi.mocked(runCmd);
+
+export const mockSleep = vi.mocked(sleep);
+
+export const device: DeviceInfo = {
+  platform: 'android',
+  id: 'emulator-5554',
+  name: 'Pixel',
+  kind: 'emulator',
+  booted: true,
+};
+
+export const helperArtifact = ANDROID_SNAPSHOT_HELPER_FIXTURE_ARTIFACT;
+
+export function snapshotAndroidWithHelper(
+  helperAdb: AndroidAdbExecutor,
+  options: Omit<
+    NonNullable<Parameters<typeof snapshotAndroid>[1]>,
+    'helperAdb' | 'helperArtifact'
+  > = {},
+) {
+  return snapshotAndroid(device, {
+    ...options,
+    helperAdb,
+    helperArtifact,
+  });
+}
+
+export function createHelperAdb(
+  handlers: Partial<Record<'instrument' | 'activity', AndroidAdbExecutor>>,
+): AndroidAdbExecutor {
+  return async (args, options) => {
+    if (isHelperVersionProbe(args)) return installedHelperProbe;
+    if (isHelperRuntimeReset(args)) {
+      return { exitCode: 0, stdout: '', stderr: '' };
+    }
+    const operation = helperAdbOperation(args);
+    const handler = operation ? handlers[operation] : undefined;
+    if (handler) return await handler(args, options);
+    throw new Error(`unexpected helper adb args: ${args.join(' ')}`);
+  };
+}
+
+function isHelperVersionProbe(args: readonly string[]): boolean {
+  return args.includes('--show-versioncode');
+}
+
+function helperAdbOperation(args: readonly string[]): 'instrument' | 'activity' | undefined {
+  if (args.includes('instrument')) return 'instrument';
+  return args.includes('dumpsys') && args.includes('activity') ? 'activity' : undefined;
+}
+
+export function androidSnapshotHelperAdb(xml: string, activityDump?: string): AndroidAdbExecutor {
+  return createHelperAdb({
+    instrument: async () => ({ exitCode: 0, stdout: helperOutput(xml), stderr: '' }),
+    ...(activityDump === undefined
+      ? {}
+      : { activity: async () => ({ exitCode: 0, stdout: activityDump, stderr: '' }) }),
+  });
+}
+
+export function isAndroidSdkVersionCommand(args: readonly string[]): boolean {
+  return (
+    args.includes('shell') && args.includes('getprop') && args.includes('ro.build.version.sdk')
+  );
+}
+
+export async function captureDiagnostics(
+  scope: Parameters<typeof diagnosticsModule.withDiagnosticsScope>[0],
+  callback: () => Promise<string | null>,
+): Promise<string> {
+  const previousHome = process.env.HOME;
+  process.env.HOME = await mkdtempForTest('agent-device-android-diag-');
+  try {
+    const diagnosticsPath = await diagnosticsModule.withDiagnosticsScope(scope, callback);
+    assert.ok(diagnosticsPath);
+    return await fs.readFile(diagnosticsPath, 'utf8');
+  } finally {
+    process.env.HOME = previousHome;
+  }
+}
+
+export async function resetSnapshotTestState(): Promise<void> {
+  await resetAndroidSnapshotHelperSessions();
+  resetAndroidSnapshotHelperInstallCache();
+  mockRunCmd.mockReset();
+  mockSleep.mockReset();
+  mockSleep.mockResolvedValue(undefined);
+  mockRunCmd.mockImplementation(async (_cmd, args) => {
+    if (args.includes('exec-out')) {
+      return { exitCode: 0, stdout: '', stderr: '', stdoutBuffer: VALID_PNG };
+    }
+    return { exitCode: 0, stdout: '', stderr: '' };
+  });
+}
```

**File**: `packages/platform-android/src/screenshot.ts` (modified, +46/-7)
```diff
@@ -1,9 +1,10 @@
 import type { ScreenshotCaptureFacts } from '@agent-device/contracts/interactor-types';
-import { AppError } from '@agent-device/kernel/errors';
+import { AppError, normalizeError } from '@agent-device/kernel/errors';
 import type { DeviceInfo } from '@agent-device/kernel/device';
 import type { ShellWord } from '@agent-device/kernel/device-shell';
 import { runAndroidExecOut, runAndroidShell, sleep } from './adb.ts';
-import { requireAndroidAdbHost } from './adb-host.ts';
+import { emitAndroidAdbDiagnostic, requireAndroidAdbHost } from './adb-host.ts';
+import { androidAdbResultError } from './adb-executor.ts';
 import { probeAndroidDisplayRotation } from './input-actions.ts';
 
 // PNG file signature: 0x89 P N G \r \n 0x1A \n
@@ -29,14 +30,52 @@ export async function screenshotAndroid(
     return await captureAndroidScreenshotWithRotation(device, outPath);
   }
 
-  await enableAndroidDemoMode(device);
+  const listing = await runDemoSettingCommand(device, ['settings', 'list', 'global']);
+  const settingPrefix = 'sysui_demo_allowed=';
+  const previous = listing.stdout
+    .split(/\r?\n/)
+    .find((line) => line.startsWith(settingPrefix))
+    ?.slice(settingPrefix.length);
+
+  let capture: ScreenshotCaptureFacts;
   try {
+    await enableAndroidDemoMode(device);
     // Allow transient UI affordances like scrollbars to fade before capture.
     await sleep(ANDROID_SCREENSHOT_SETTLE_DELAY_MS);
-    return await captureAndroidScreenshotWithRotation(device, outPath);
-  } finally {
-    await disableAndroidDemoMode(device).catch(() => {});
+    capture = await captureAndroidScreenshotWithRotation(device, outPath);
+  } catch (error) {
+    await restoreAndroidDemoSetting(device, previous).catch((restoreError: unknown) => {
+      emitAndroidAdbDiagnostic({
+        level: 'error',
+        phase: 'android_screenshot_demo_setting_restore_failed',
+        data: { error: normalizeError(restoreError) },
+      });
+    });
+    throw error;
+  }
+  await restoreAndroidDemoSetting(device, previous);
+  return capture;
+}
+
+async function restoreAndroidDemoSetting(
+  device: DeviceInfo,
+  previous: string | undefined,
+): Promise<void> {
+  await disableAndroidDemoMode(device).catch(() => {});
+  await runDemoSettingCommand(
+    device,
+    previous === undefined
+      ? ['settings', 'delete', 'global', 'sysui_demo_allowed']
+      : ['settings', 'put', 'global', 'sysui_demo_allowed', previous],
+  );
+}
+
+async function runDemoSettingCommand(device: DeviceInfo, words: ShellWord[]) {
+  const result = await runAndroidShell(device, words, { allowFailure: true });
+  if (result.exitCode !== 0) {
+    throw androidAdbResultError('Android screenshot demo setting command failed', result);
   }
+  return result;
 }
 
 /**
@@ -46,7 +85,7 @@ export async function screenshotAndroid(
 async function enableAndroidDemoMode(device: DeviceInfo): Promise<void> {
   const shell = (words: ShellWord[]) => runAndroidShell(device, words, { allowFailure: true });
 
-  await shell(['settings', 'put', 'global', 'sysui_demo_allowed', '1']);
+  await runDemoSettingCommand(device, ['settings', 'put', 'global', 'sysui_demo_allowed', '1']);
 
   const broadcast = (extra: ShellWord[]) =>
     shell(['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', ...extra]);
```

**File**: `test/integration/android-emulator-e2e/live-capture-scenario.ts` (modified, +37/-0)
```diff
@@ -1,13 +1,50 @@
 import assert from 'node:assert/strict';
 import path from 'node:path';
+import fs from 'node:fs';
 
 import { PUBLIC_COMMANDS } from '@agent-device/command-registry/catalog';
 import { assertPngFile } from '../provider-scenarios/assertions.ts';
+import { assertScreenshotDemoPermissionRestoration } from './live-demo-permission-scenario.ts';
 import { type LiveContext, runStep, verifyCommand } from './live-harness.ts';
 
 const C = PUBLIC_COMMANDS;
 
 export async function assertCaptureAndClose(context: LiveContext): Promise<void> {
+  await runStep(context, 'open Settings for native permission restoration', [
+    'open',
+    'com.android.settings',
+    '--no-test-ime',
+  ]);
+  const foreground = await runStep(context, 'verify Settings is foreground', ['appstate']);
+  assert.equal(foreground.json?.data?.package, 'com.android.settings');
+  const snapshot = await runStep(
+    context,
+    'verify candidate Android helper before normalized capture',
+    ['snapshot', '-i'],
+  );
+  const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
+  assert.equal(snapshot.json?.data?.androidSnapshot?.backend, 'android-helper');
+  assert.equal(snapshot.json?.data?.androidSnapshot?.helperVersion, version);
+  fs.writeFileSync(
+    path.join(context.artifactDir, 'demo-permission-snapshot.json'),
+    JSON.stringify(snapshot.json, null, 2),
+  );
+  await assertScreenshotDemoPermissionRestoration({
+    serial: context.serial,
+    artifactDir: context.artifactDir,
+    captureScreenshot: async (filePath) => {
+      await runStep(context, 'capture normalized permission restoration evidence', [
+        'screenshot',
+        filePath,
+        '--normalize-status-bar',
+      ]);
+    },
+  });
+  await runStep(context, 'restore fixture after native permission restoration', [
+    'open',
+    context.appId,
+    '--no-test-ime',
+  ]);
   const screenshotPath = path.join(context.artifactDir, 'fixture-smoke.png');
   const screenshot = await runStep(context, 'capture fixture screenshot', [
     'screenshot',
```

**File**: `test/integration/android-emulator-e2e/live-demo-permission-scenario.ts` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+import assert from 'node:assert/strict';
+import fs from 'node:fs';
+import path from 'node:path';
+
+import { runCmd } from '@agent-device/host-kit/command';
+import { deviceShellArgv } from '@agent-device/kernel/device-shell';
+import { assertPngFile } from '../provider-scenarios/assertions.ts';
+
+const DEMO_PERMISSION = 'sysui_demo_allowed';
+const DEMO_PERMISSION_PREFIX = `${DEMO_PERMISSION}=`;
+
+type PermissionCase = {
+  state: string;
+  before: string | null;
+  after?: string | null;
+  path: string;
+};
+
+export async function assertScreenshotDemoPermissionRestoration(options: {
+  serial: string;
+  artifactDir: string;
+  captureScreenshot: (filePath: string) => Promise<void>;
+}): Promise<void> {
+  const shell = async (words: string[]) => {
+    const result = await runCmd(
+      'adb',
+      deviceShellArgv('adb', 'shell', words, ['-s', options.serial]),
+      { timeoutMs: 5_000 },
+    );
+    return result.stdout;
+  };
+  const readPermission = async () => {
+    const rows = (await shell(['settings', 'list', 'global']))
+      .split(/\r?\n/)
+      .filter((row) => row.startsWith(DEMO_PERMISSION_PREFIX));
+    assert.ok(rows.length <= 1, 'the global permission must have at most one row');
+    return rows[0] ?? null;
+  };
+  const writePermission = async (value: string | undefined) => {
+    await shell(
+      value === undefined
+        ? ['settings', 'delete', 'global', DEMO_PERMISSION]
+        : ['settings', 'put', 'global', DEMO_PERMISSION, value],
+    );
+  };
+  const apiLevel = Number((await shell(['getprop', 'ro.build.version.sdk'])).trim());
+  assert.ok(Number.isInteger(apiLevel) && apiLevel > 0, 'Android must report its API level');
+  const initial = await readPermission();
+  const cases: PermissionCase[] = [];
+  const failures: unknown[] = [];
+  fs.mkdirSync(options.artifactDir, { recursive: true });
+  try {
+    for (const value of [undefined, '0', '1']) {
+      await writePermission(value);
+      const before = await readPermission();
+      assert.equal(before, value === undefined ? null : `${DEMO_PERMISSION_PREFIX}${value}`);
+      const item: PermissionCase = {
+        state: value ?? 'absent',
+        before,
+        path: path.join(options.artifactDir, `demo-permission-${value ?? 'absent'}.png`),
+      };
+      cases.push(item);
+      await options.captureScreenshot(item.path);
+      assertPngFile(item.path);
+      assert.ok(fs.statSync(item.path).size > 8, 'the capture must contain PNG image data');
+      item.after = await readPermission();
+      assert.equal(item.after, before, `normalized capture changed the ${item.state} permission`);
+    }
+  } catch (error) {
+    failures.push(error);
+  }
+  let restored: string | null | undefined;
+  try {
+    await writePermission(
+      initial === null ? undefined : initial.slice(DEMO_PERMISSION_PREFIX.length),
+    );
+    restored = await readPermission();
+    assert.equal(restored, initial, 'the native test must restore its initial global setting');
+  } catch (error) {
+    failures.push(error);
+  }
+  try {
+    fs.writeFileSync(
+      path.join(options.artifactDir, 'demo-permission-evidence.json'),
+      `${JSON.stringify({ serial: options.serial, apiLevel, initial, restored, cases }, null, 2)}\n`,
+    );
+  } catch (error) {
+    failures.push(error);
+  }
+  if (failures.length === 1) throw failures[0];
+  if (failures.length > 1)
+    throw new AggregateError(failures, 'Android screenshot evidence and cleanup failed');
+}
```

#### Recent Merged Pull Requests:
- **PR #4549** (2026-11-14): test: isolate ps fixtures from host proc identity (@thymikee)
- **PR #4546** (2026-11-14): ci: prepare 0.22 source version and push CI for nightly releases (@thymikee)
- **PR #4538** (2026-11-14): test(maestro): keep optional-scroll continuation assertion visible (@thymikee)
- **PR #4536** (2026-11-14): fix(ios): classify the keyboard dismiss refusal by what it dispatched (@thymikee)
- **PR #4533** (2026-11-14): fix: prepare reinstall artifacts before removing apps (@thymikee)
- **PR #4532** (2026-11-14): Give remote daemon unavailability a typed refusal reason (@thymikee)

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

## X. ios): confirm foldable rotation from the lit panel in either simulator set

**RULE**:
When implementing operations in `.changeset/foldable-scoped-rotation.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `15e298f2`: ios): confirm foldable rotation from the lit panel in either simulator set. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/foldable-scoped-rotation.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
'agent-device': patch
---

Fix foldable iPhone simulator rotation in scoped sets and confirm the lit panel in both default and scoped sets. Rotation in both sets uses the fold helper, with no CoreDevice orientation polling. An already visible target dispatches nothing. Incomplete, unknown-power and multi-lit panel tables neither confirm nor dispatch. A target the panel never shows fails with `orientation-unverified`.

Use the fixed iPhone Duo picker offsets measured in both sets (outer 0 degrees, inner +90 degrees), replacing runtime calibration. Inner landscape-left sends `portrait-upside-down`, mapped to the HID wire value `pud`; it remains unsupported as a user target. Delayed reads wait without resending the same picker value to the same panel.

Unresolved guest reads inside the settle loop neither confirm nor dispatch and are retried. An unresolved final read fails with `orientation-panel-table-unavailable`. Multi-panel classification admits rotation without a model-name guard; a new multi-panel model needs its own picker mapping.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `15e298f2` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
