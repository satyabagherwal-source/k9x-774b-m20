# Verification Protocol: Verification Protocol: Empirical Defect Shield for callstack/agent/device

<!-- PROVENANCE_START
{
  "source_repository": "callstack/agent/device",
  "source_url": "https://github.com/callstack/agent/device",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack/agent/device](https://github.com/callstack/agent/device) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `callstack/agent/device` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source**: github ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Source Version**: `45e1372f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T07:37:41.051Z  
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
> **Harvest Timestamp**: 2026-11-11T07:37:41.040Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Open source device layer for AI coding agents: a CLI, MCP server, and typed Node.js API to control mobile, web, TV, and desktop apps on devices and simulators, locally or in the cloud.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5327 stars

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
- **Issue #4334** (2026-11-10): **Durable handle asyncDispose lets a rejected cleanup escape without the normalized error**
  *Symptoms*: Found while slimming ADR 0019 (#4330).  The durable resource contract says the idempotent `[Symbol.asyncDispose]` adapter resolves only for confirmed cleanup or already-missing outcomes, and otherwise rejects with a normalized `ownership-lost` or `cleanup-pending` error. That is ADR 0019 section 5, now stated in `packages/capture-kit/docs/durable-resource-recovery.md`.  Today the adapter turns a returned `cleanup-pending` outcome into the facet error. But when the cleanup operation itself rejects, the raw error escapes the shared adapter without normalization. Examples are the recovery handles in `packages/capture-kit/src/capture-admission/*-resource-recovery.ts`, which pass `params.dispose` straight through. So a raw throw can cross the seam where ADR 0010 expects a typed error.  Expected: the shared adapter normalizes a rejected cleanup into the typed `ownership-lost` or `cleanup-pending` error and keeps the cause. A regression test should pin this.  #4330 keeps the contract and links this issue as the known drift.

- **Issue #4333** (2026-11-10): **Target annotation writer can emit a payload over the 4 KiB ceiling**
  *Symptoms*: Found during the ADR 0012 slimming review (#4331).  `finalizeOversizedCandidate` (`packages/selectors/src/target-evidence.ts`) sets `verification: "unverifiable"` and drops `rect` when the serialized payload exceeds `TARGET_ANNOTATION_MAX_PAYLOAD_BYTES`. It does not measure again after the drop. The per-field 256-byte caps apply before JSON escaping, but the ceiling applies to the serialized JSON. So escape-heavy labels can leave a parent-only payload over 4 KiB, and the writer emits an annotation that the parser rejects.  Expected: after the rect drop, the writer measures again. If the payload is still over the ceiling, it degrades further or omits the annotation, so it never writes a payload that the writer/parser round-trip invariant rejects. A regression test with escape-heavy labels should pin this.  Not changed in #4331, which is docs-only. `packages/ad-script/docs/target-annotation.md` states the current behavior.
  **Post-Mortem & Fix Analysis**:
  > ## Apex Sentinel · Issue review  **Suggested label:** `bug`  The report identifies a concrete writer defect: finalizeOversizedCandidate drops rect without remeasuring the serialized JSON after escaping, so escape-heavy labels can still produce an over-4 KiB payload that the parser rejects. It names the file, function, invariant, and expected follow-up behavior.  ### Required sections - [ ] Steps to reproduce (missing) - [ ] Expected and actual behavior (missing) - [ ] Version or environment (missing)  <!-- apex-sentinel:issue-review -->

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

### Incident Patch 1: `1244334d` (2026-11-11)
**Commit Message**: fix(replay): escape recorded interpolation, run scripts off the event loop, harden Maestro and test flows (#4363)

* fix(replay): escape recorded literal ${...} text in written scripts

Replay interpolates every written positional, flag and runtime string,
so recorded text such as `type "cost ${amount}"` replayed as an
unresolved or substituted variable. The session script writer now emits
the `\${` escape the resolver already honours, keeping exact
`--record-as` fill placeholders live.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016qAu53rMak1bXMuR5U2gF4

* fix(maestro): run runScript in a child process and enforce the 8 MiB HTTP cap

runScript ran `vm.runInNewContext` and a `spawnSync` per `http.post`
inline in the daemon, blocking every session for up to 30 s per call
and ignoring request cancellation. It now runs in a dedicated
`run-script-child` process that the daemon awaits with the request
signal; the synchronous script semantics stay inside that child.

The HTTP child's response travelled over `spawnSync` stdout with Node's
1 MiB default buffer, so bodies above ~1 MiB failed generically while
the declared cap was 8 MiB,

**File**: `.fallowrc.json` (modified, +2/-0)
```diff
@@ -35,6 +35,8 @@
     "packages/react-native/src/companion/companion-tunnel.ts",
     "src/daemon.ts",
     "packages/capture-kit/src/png-worker.ts",
+    "packages/maestro/src/daemon-port/run-script-child.ts",
+    "packages/maestro/src/daemon-port/run-script-http-child.ts",
     "scripts/patch-xcuitest-runner-icon.ts",
     "scripts/write-xcuitest-cache-metadata.ts",
     "scripts/xcuitest-build-settings.ts",
```

**File**: `docs/adr/0017-parameterized-recorded-inputs.md` (modified, +1/-0)
```diff
@@ -139,6 +139,7 @@ The map gets one entry for each parameterized fill, added only after the entry o
 The map is never serialized: not to the script, the session event log, or diagnostics.
 The map has no read API beyond the recorder that owns it.
 The map disappears with the session.
+A placeholder that echo protection writes into a recorded result is a live script placeholder: the recorder lists its name in `SessionAction.livePlaceholders`, and the script writer escapes every other recorded `${`.
 
 This is not a reversal of the "no secret-to-name table" rule in the Mapping contract above.
 That rule rejects the retention of state to influence a *naming* decision.
```

**File**: `packages/ad-replay/src/internal/__tests__/plan-digest.test.ts` (modified, +10/-6)
```diff
@@ -20,7 +20,6 @@ function digestFor(
   return computeReplayPlanDigest({
     actions,
     actionLines: actions.map((_, i) => i + 1),
-    actionSourcePaths: undefined,
     metadata: {},
     ...overrides,
   });
@@ -31,6 +30,15 @@ test('computeReplayPlanDigest is a 64-char lowercase hex SHA-256', () => {
   assert.match(digest, /^[0-9a-f]{64}$/);
 });
 
+test('computeReplayPlanDigest keeps the published digest for an unchanged plan', () => {
+  const digest = computeReplayPlanDigest({
+    actions: [action({ command: 'open', positionals: ['Demo'] }), action()],
+    actionLines: [2, 3],
+    metadata: { platform: 'ios' },
+  });
+  assert.equal(digest, '0641236777b11822d90d446022965629ec99ac2ba1af2d5c637f06dd684fe695');
+});
+
 test('computeReplayPlanDigest is stable across repeated computation of the same plan', () => {
   const actions = [action(), action({ command: 'open', positionals: ['Demo'] })];
   assert.equal(digestFor(actions), digestFor(actions));
@@ -54,15 +62,11 @@ test('computeReplayPlanDigest changes when the command changes', () => {
   assert.notEqual(original, edited);
 });
 
-test('computeReplayPlanDigest changes when source provenance (path/line) changes', () => {
+test('computeReplayPlanDigest changes when the source line changes', () => {
   const actions = [action()];
   const original = digestFor(actions, { actionLines: [1] });
   const movedLine = digestFor(actions, { actionLines: [5] });
   assert.notEqual(original, movedLine);
-
-  const noSourcePath = digestFor(actions, { actionSourcePaths: undefined });
-  const withSourcePath = digestFor(actions, { actionSourcePaths: ['/tmp/include.ad'] });
-  assert.notEqual(noSourcePath, withSourcePath);
 });
 
 test('computeReplayPlanDigest changes when platform-conditioned metadata changes', () => {
```

**File**: `packages/ad-replay/src/internal/__tests__/step-loop.test.ts` (modified, +0/-1)
```diff
@@ -41,7 +41,6 @@ function runRequest(
     entryIndex: overrides.entryIndex ?? 0,
     keepSession: overrides.keepSession,
     actionLines: actions.map(() => 1),
-    actionSourcePaths: undefined,
     resolvedPath: 'fixture.ad',
     varSources: {},
   };
```

**File**: `packages/ad-replay/src/internal/inspect.ts` (modified, +0/-3)
```diff
@@ -32,7 +32,6 @@ import { resolveReplayEntryIndex, type PendingRecordAndHeal } from './resume.ts'
 export type AdReplayManifest = Readonly<{
   actions: SessionAction[];
   actionLines: number[];
-  actionSourcePaths: (string | undefined)[] | undefined;
   metadata: ReplayScriptMetadata;
   /** SHA-256 digest of the canonical plan (`digestFlags` binds the same platform/target the replay invokes with). */
   planDigest: string;
@@ -83,7 +82,6 @@ export function inspectAdReplay(
   const planDigest = computeReplayPlanDigest({
     actions: parsed.actions,
     actionLines: parsed.actionLines,
-    actionSourcePaths: parsed.actionSourcePaths,
     metadata: {
       platform:
         digestFlags?.platform ?? resolveDeclaredScriptPlatform(parsed.actions) ?? metadata.platform,
@@ -94,7 +92,6 @@ export function inspectAdReplay(
   return {
     actions: parsed.actions,
     actionLines: parsed.actionLines,
-    actionSourcePaths: parsed.actionSourcePaths,
     metadata,
     planDigest,
     resolveEntryIndex: (params) => resolveReplayEntryIndex(params, actionCount, planDigest),
```

**File**: `packages/ad-replay/src/internal/plan-digest.ts` (modified, +5/-12)
```diff
@@ -24,7 +24,6 @@ export type ReplayPlanDigestMetadata = {
 export function computeReplayPlanDigest(params: {
   actions: SessionAction[];
   actionLines: number[];
-  actionSourcePaths?: (string | undefined)[];
   metadata: ReplayPlanDigestMetadata;
 }): string {
   const canonical = buildCanonicalPlan(params);
@@ -35,31 +34,25 @@ export function computeReplayPlanDigest(params: {
 function buildCanonicalPlan(params: {
   actions: SessionAction[];
   actionLines: number[];
-  actionSourcePaths?: (string | undefined)[];
   metadata: ReplayPlanDigestMetadata;
 }): unknown {
-  const { actions, actionLines, actionSourcePaths, metadata } = params;
+  const { actions, actionLines, metadata } = params;
   return {
     platform: metadata.platform ?? null,
     target: metadata.target ?? null,
-    steps: actions.map((action, index) =>
-      canonicalizeAction(action, actionLines[index] ?? null, actionSourcePaths?.[index] ?? null),
-    ),
+    steps: actions.map((action, index) => canonicalizeAction(action, actionLines[index] ?? null)),
   };
 }
 
-function canonicalizeAction(
-  action: SessionAction,
-  line: number | null,
-  sourcePath: string | null,
-): unknown {
+function canonicalizeAction(action: SessionAction, line: number | null): unknown {
   return {
     command: action.command,
     positionals: action.positionals ?? [],
     flags: action.flags ?? {},
     runtime: action.runtime ?? null,
     targetEvidence: action.targetEvidence ?? null,
     targetEvidences: action.targetEvidences ?? null,
-    source: { path: sourcePath, line },
+    // Published digests hash `path: null`; dropping the key would invalidate every saved resume digest.
+    source: { path: null, line },
   };
 }
```

**File**: `packages/ad-replay/src/internal/runtime-port-types.ts` (modified, +1/-3)
```diff
@@ -348,9 +348,7 @@ export type AdReplayRunRequest = Readonly<{
    * `loc`).
    */
   readonly actionLines: readonly number[];
-  /** Per-action resolved source path when it differs from `resolvedPath` (a `runFlow` include's own file), parallel to `actions`. */
-  readonly actionSourcePaths: readonly (string | undefined)[] | undefined;
-  /** The resolved `.ad` file path — the interpolation-location fallback when an action's own `actionSourcePaths` entry is absent. */
+  /** The resolved `.ad` file path every step's interpolation-error location names. */
   readonly resolvedPath: string;
   /**
    * `${VAR}` scope inputs — plain data the daemon reads from the request/
```

**File**: `packages/ad-replay/src/internal/step-loop.ts` (modified, +2/-2)
```diff
@@ -208,13 +208,13 @@ function mergeArtifactPaths(
   return [...new Set([...ledger, ...failureArtifactPaths])];
 }
 
-/** `resolveReplayAction`'s `loc` for one step — `actionSourcePaths[index]` when the step came from a `runFlow` include, else the top-level plan's own resolved path. */
+/** `resolveReplayAction`'s `loc` for one step of the `.ad` plan. */
 function resolveActionLoc(
   request: AdReplayRunRequest,
   index: number,
 ): { file: string; line: number } {
   return {
-    file: request.actionSourcePaths?.[index] ?? request.resolvedPath,
+    file: request.resolvedPath,
     line: request.actionLines[index] ?? 1,
   };
 }
```

---

### Incident Patch 2: `7d478959` (2026-11-11)
**Commit Message**: fix(capture): audit remediation for redaction, capture lifecycle, contract validation and snapshot performance (#4366)

* fix(kernel,app-log): keep shared redaction references and validate app-log redact patterns

Redaction tracked every visited object, so a shared non-cyclic reference
was reported as [Circular]. Track only the ancestor path.

AGENT_DEVICE_APP_LOG_REDACT_PATTERNS split on every comma and dropped
patterns that did not compile. Split on top-level commas only and fail
logs start with INVALID_ARGS (app_log_redact_pattern_invalid).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016qAu53rMak1bXMuR5U2gF4

* fix(kernel): refuse overflowing and CGRectInfinite keyboard frames

The inline keyboard frame guard claimed parity with isPositiveFiniteRect
but skipped its overflow and CGRectInfinite refusals.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016qAu53rMak1bXMuR5U2gF4

* fix(capture-kit): keep typed scroll-edge capture failures

captureScrollEdgeState wrapped every capture failure, including request
cancellation and typed runner errors, in a generic COMMAND_FAILED, and

**File**: `packages/capture-kit/src/alert-tree-driver.ts` (modified, +6/-2)
```diff
@@ -8,6 +8,7 @@ import {
   type AlertPlatform,
   ALERT_NOT_FOUND_REASON,
   ALERT_POLL_INTERVAL_MS,
+  ALERT_WAIT_TIMEOUT_REASON,
   ALERT_WINDOW_EXPIRED_REASON,
   type AlertStatusKind,
   DEFAULT_ALERT_TIMEOUT_MS,
@@ -18,7 +19,8 @@ import { AppError, createRequestCanceledError } from '@agent-device/kernel/error
 import { successText } from '@agent-device/kernel/success-text';
 
 /**
- * The one driver for every backend that reads alerts from a capture tree (Android ADB). A
+ * The shared driver for backends that read alerts from a capture tree (today Android ADB; the
+ * Apple backends ask their runner or helper instead). A
  * backend supplies only its observation (`capture` + `findCandidate`), its acting policy
  * (`choose`), and its press seam (`press`). It lives in the capture kit: an iOS provider
  * must not depend on the Android package to poll a tree.
@@ -144,7 +146,9 @@ export async function runTreeAlertAction<
       // Both a quiet capture and one that stayed alert-shaped yet unresolvable mean no
       // actionable alert ever resolved within the window; the timeout phrasing is the honest
       // answer for either.
-      throw new AppError('COMMAND_FAILED', 'alert wait timed out');
+      throw new AppError('COMMAND_FAILED', 'alert wait timed out', {
+        reason: ALERT_WAIT_TIMEOUT_REASON,
+      });
     }
     return {
       kind: 'alertWait',
```

**File**: `packages/capture-kit/src/app-log-pid-monitor.ts` (modified, +16/-3)
```diff
@@ -102,9 +102,10 @@ async function pollActiveProcessPid(
 ): Promise<void> {
   while (!input.stopped() && !wait.settled()) {
     if (!(await waitForPidPoll(input, wait))) return;
-    const observedPid = await input.resolvePid();
+    const observedPid = await resolvePidOrUnknown(input);
     if (input.stopped()) return;
-    if (observedPid === scopedProcess.pid) continue;
+    // An unanswered poll is inconclusive, so retain the stream and retry on the next tick.
+    if (observedPid === undefined || observedPid === scopedProcess.pid) continue;
     await scopedProcess.process.terminate();
     return;
   }
@@ -146,7 +147,7 @@ async function pauseBeforeProcessRestart(input: PidScopedProcessMonitor): Promis
 async function startAndAdoptSubsequentProcess(
   input: PidScopedProcessMonitor,
 ): Promise<SubsequentProcessStart> {
-  const pid = await input.resolvePid();
+  const pid = await resolvePidOrUnknown(input);
   if (input.stopped()) return { status: 'stopped' };
   if (!pid) {
     input.setState('recovering');
@@ -160,6 +161,18 @@ async function startAndAdoptSubsequentProcess(
   return { status: 'stopped' };
 }
 
+/**
+ * A PID poll is a best-effort probe (one `pidof` under its own timeout). A failed poll is retried on
+ * the next tick instead of ending capture for the rest of the session.
+ */
+async function resolvePidOrUnknown(input: PidScopedProcessMonitor): Promise<string | undefined> {
+  try {
+    return await input.resolvePid();
+  } catch {
+    return undefined;
+  }
+}
+
 async function stopAdoptedProcess(
   input: PidScopedProcessMonitor,
   process: AppLogBackgroundProcess,
```

**File**: `packages/capture-kit/src/app-log-pid-process.test.ts` (modified, +55/-0)
```diff
@@ -231,3 +231,58 @@ async function testSleep(_milliseconds: number, signal?: AbortSignal): Promise<v
     signal?.addEventListener('abort', onAbort, { once: true });
   });
 }
+
+describe('PID-scoped app-log capture after a failed PID poll', () => {
+  function startCapture(
+    resolvePid: () => Promise<string>,
+    start: () => Promise<AppLogBackgroundProcess>,
+  ) {
+    return createPidScopedAppLogProcess({
+      host: hostFixture(outputFixture().sink),
+      backend: 'android',
+      outputPath: '/tmp/app.log',
+      pidPath: '/tmp/app-log.pid',
+      processStart: start,
+      setupSignal: new AbortController().signal,
+      resolvePid,
+      command: (pid) => ({
+        kind: 'host',
+        request: { executable: 'adb', args: ['logcat', '--pid', pid] },
+      }),
+      cleanupFailureMessage: 'cleanup failed',
+    });
+  }
+
+  test('keeps the active stream and keeps polling after one rejected poll', async () => {
+    const started =
+      processFixture(deferred<{ stdout: string; stderr: string; exitCode: number }>());
+    const resolvePid = vi
+      .fn<() => Promise<string>>()
+      .mockResolvedValueOnce('123')
+      .mockRejectedValueOnce(new Error('adb shell pidof timed out'))
+      .mockResolvedValue('123');
+    const handle = await startCapture(resolvePid, async () => started.process);
+
+    await vi.waitFor(() => expect(resolvePid.mock.calls.length).toBeGreaterThanOrEqual(4));
+    expect(started.dispose).not.toHaveBeenCalled();
+    expect(started.terminate).not.toHaveBeenCalled();
+    await expect(handle.finish()).resolves.toMatchObject({ status: 'completed' });
+    expect(started.terminate).toHaveBeenCalledOnce();
+  });
+
+  test('starts the stream once a rejected waiting poll is followed by a PID', async () => {
+    const started =
+      processFixture(deferred<{ stdout: string; stderr: string; exitCode: number }>());
+    const resolvePid = vi
+      .fn<() => Promise<string>>()
+      .mockResolvedValueOnce('')
+      .mockRejectedValueOnce(new Error('adb shell pidof timed out'))
+      .mockResolvedValue('456');
+    const start = vi.fn(async () => started.process);
+    const handle = await startCapture(resolvePid, start);
+
+    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
+    await handle.finish();
+    expect(started.terminate).toHaveBeenCalledOnce();
+  });
+});
```

**File**: `packages/capture-kit/src/capture-admission/__tests__/durable-capture-resource-boundary-faults.test.ts` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ test('retains recording evidence when exact-owner recovery resolves after its de
     const recovery = resource.recoverAll({
       sessionsDir: path.dirname(context.sessionStore.resolveSessionDir(context.sessionName)),
       scope,
-      perRecordDeadlineMs: 25,
+      acquisitionDeadlineMs: 25,
       onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
       acquireControl: async (_envelope, recoveryScope) => {
         expect(recoveryScope.signal.aborted).toBe(false);
```

**File**: `packages/capture-kit/src/capture-admission/app-log-resource-recovery.ts` (modified, +4/-4)
```diff
@@ -27,7 +27,7 @@ export function recoverAppLogResourcesAfterDaemonLock(params: {
   sessionsDir: string;
   gateway: DeviceRuntimeGateway<PlatformRuntimeOperations>;
   scope: PlatformRequestScope;
-  perRecordDeadlineMs?: number;
+  acquisitionDeadlineMs?: number;
   onDiagnostic?: (diagnostic: ResourceDiagnostic) => void;
 }): Promise<AppLogRecoverySummary> {
   return appLogDurableResource.recoverAll({
@@ -41,7 +41,7 @@ export function recoverAppLogResourceAfterDaemonLock(params: {
   resourcePath: string;
   gateway: DeviceRuntimeGateway<PlatformRuntimeOperations>;
   scope: PlatformRequestScope;
-  perRecordDeadlineMs?: number;
+  acquisitionDeadlineMs?: number;
   onDiagnostic?: (diagnostic: ResourceDiagnostic) => void;
 }) {
   return appLogDurableResource.recoverOne(
@@ -53,12 +53,12 @@ export function recoverAppLogResourceAfterDaemonLock(params: {
 function buildAppLogRecoveryParams(params: {
   gateway: DeviceRuntimeGateway<PlatformRuntimeOperations>;
   scope: PlatformRequestScope;
-  perRecordDeadlineMs?: number;
+  acquisitionDeadlineMs?: number;
   onDiagnostic?: (diagnostic: ResourceDiagnostic) => void;
 }) {
   return {
     scope: params.scope,
-    perRecordDeadlineMs: params.perRecordDeadlineMs,
+    acquisitionDeadlineMs: params.acquisitionDeadlineMs,
     onDiagnostic: params.onDiagnostic,
     acquireControl: async (
       envelope: DurableResourceEnvelope<'app-log'>,
```

**File**: `packages/capture-kit/src/capture-admission/audio-probe-resource-recovery.ts` (modified, +2/-2)
```diff
@@ -23,14 +23,14 @@ export function recoverAudioProbeResourceAfterDaemonLock(params: {
   resourcePath: string;
   gateway: DeviceRuntimeGateway<PlatformRuntimeOperations>;
   scope: PlatformRequestScope;
-  perRecordDeadlineMs?: number;
+  acquisitionDeadlineMs?: number;
   onDiagnostic?: (diagnostic: ResourceDiagnostic) => void;
 }) {
   return audioProbeDurableResource.recoverOne(
     {
       sessionsDir: params.sessionsDir,
       scope: params.scope,
-      perRecordDeadlineMs: params.perRecordDeadlineMs,
+      acquisitionDeadlineMs: params.acquisitionDeadlineMs,
       onDiagnostic: params.onDiagnostic,
       acquireControl: async (envelope, scope) =>
         await acquireAudioProbeRecoveryControl(params.gateway, envelope, scope),
```

**File**: `packages/capture-kit/src/capture-admission/perf-capture-resource-recovery.ts` (modified, +2/-2)
```diff
@@ -24,14 +24,14 @@ export function recoverPerfCaptureResourceAfterDaemonLock(params: {
   resourcePath: string;
   gateway: DeviceRuntimeGateway<PlatformRuntimeOperations>;
   scope: PlatformRequestScope;
-  perRecordDeadlineMs?: number;
+  acquisitionDeadlineMs?: number;
   onDiagnostic?: (diagnostic: ResourceDiagnostic) => void;
 }) {
   return perfCaptureDurableResource.recoverOne(
     {
       sessionsDir: params.sessionsDir,
       scope: params.scope,
-      perRecordDeadlineMs: params.perRecordDeadlineMs,
+      acquisitionDeadlineMs: params.acquisitionDeadlineMs,
       onDiagnostic: params.onDiagnostic,
       acquireControl: async (envelope, scope) =>
         await acquirePerfCaptureRecoveryControl(params.gateway, envelope, scope),
```

**File**: `packages/capture-kit/src/capture-admission/screen-recording-resource-recovery.ts` (modified, +2/-2)
```diff
@@ -23,14 +23,14 @@ export function recoverScreenRecordingResourceAfterDaemonLock(params: {
   resourcePath: string;
   gateway: DeviceRuntimeGateway<PlatformRuntimeOperations>;
   scope: PlatformRequestScope;
-  perRecordDeadlineMs?: number;
+  acquisitionDeadlineMs?: number;
   onDiagnostic?: (diagnostic: ResourceDiagnostic) => void;
 }) {
   return screenRecordingDurableResource.recoverOne(
     {
       sessionsDir: params.sessionsDir,
       scope: params.scope,
-      perRecordDeadlineMs: params.perRecordDeadlineMs,
+      acquisitionDeadlineMs: params.acquisitionDeadlineMs,
       onDiagnostic: params.onDiagnostic,
       acquireControl: async (envelope, scope) =>
         await acquireScreenRecordingRecoveryControl(params.gateway, envelope, scope),
```

---

### Incident Patch 3: `885cbffb` (2026-11-11)
**Commit Message**: fix(host-kit): one async process-identity reader and one identity-checked stop escalation (#4359)

* fix(host-kit): read process identity off the event loop and unify stop escalation

readProcessIdentities answers start time, command and zombie state for a
set of pids from two concurrent ps reads (one CIM query on Windows), off
the event loop. readProcessIdentityFacts is its one-pid form. The current
process's own identity is memoized by readCurrentOwnerIdentity, because a
process's start time never changes; nothing about another pid is cached.

stopProcessAndConfirmExit is now the only TERM-then-KILL escalation. It
takes an optional SIGINT opening signal, reports the last signal it sent
on a stopped verdict, and re-proves the recorded command before SIGKILL.
stopPidsWithEscalation is removed. The startup reaper, the Android
emulator terminate, the app-log terminate and the web smoke cleanup now
stop through it; the reaper reports unconfirmed and survived records
instead of labelling both as ownership lost.

Screen-recording and app-log identity reads use the async reader, and the
recording kill ladder re-proves each marker before the next rung signals
it.

Co-Authored-By: Claude O

**File**: `docs/adr/0030-process-lock-exclusion.md` (modified, +16/-1)
```diff
@@ -16,8 +16,12 @@ Mixed access with the legacy host-kit protocol is unsupported.
   An unprovable owner record or an unremovable directory also leaves release unverified.
 - A claim identifies an acquisition.
   A PID alone cannot authorize release.
-- Unknown owners and abandoned guards remain retained.
+- Unknown owners remain retained.
   Age never proves abandonment.
+- A guard records its holder's pid, start time, and token.
+  A contender removes a guard only when that holder is proven dead or its pid reused, by the same proof rule as a lock owner.
+  An exclusive per-token reap marker admits one reaper, and the reaper removes the guard only if it still names that token.
+  An unattributable guard, a legacy directory guard, and a live holder remain retained.
 - Before an upgrade, stop every legacy process that uses the shared state or cache paths.
   While hardened users operate those paths, prevent legacy versions from returning.
   Use one deployed version or separate environments.
@@ -33,6 +37,13 @@ Guard expiry admits another process.
 The first process can then resume and overwrite or delete the replacement.
 Retention of an uncertain guard sacrifices automatic crash recovery to preserve exclusion.
 
+A holder proven dead cannot resume, so its guard is not uncertain.
+Without a recorded holder, a holder killed inside its guarded step left a guard that blocked every contender until manual removal.
+A token check alone cannot remove a file conditionally, because a second reaper could remove a successor's guard after the first reaper succeeds.
+The exclusive reap marker closes that race: no other process can change the guard between the reaper's token check and its unlink.
+If a reaper dies while it holds the marker, that guard stays retained.
+A live holder whose guard stands longer than one second gets a process-table read; age only gates that read.
+
 The guard is an exclusive file at the existing guard path.
 Legacy age-based `rmdir` cannot remove it.
 A new legacy reclaimer therefore cannot take a hardened publisher's guard.
@@ -106,3 +117,7 @@ flowchart LR
     O --> L
     L --> F[Protected metadata and reports]
 ```
+
+## Decision history
+
+- 2026-11-10: A guard with a proven-dead holder became recoverable. Before this change, every abandoned guard stayed retained until manual removal, which contradicted automatic reclaim of provably dead owners.
```

**File**: `packages/daemon-contracts/src/device-claim-inspection.ts` (modified, +65/-10)
```diff
@@ -8,8 +8,10 @@ import {
 } from '@agent-device/kernel/device';
 import {
   classifyOwnerLivenessFromObservation,
+  type HostProcessIdentityObservation,
   type OwnerLiveness,
   readHostProcessIdentityObservations,
+  readHostProcessIdentityObservationsAsync,
 } from '@agent-device/host-kit/process';
 
 import { isSupersededDaemonOwner } from './daemon-registration.ts';
@@ -34,22 +36,61 @@ export type DeviceClaimSelectors = {
   serial?: string;
 };
 
+type OwnerObservations = ReadonlyMap<number, HostProcessIdentityObservation>;
+
+/**
+ * Every matching claim, judged from one process-table snapshot. This one blocks for that snapshot,
+ * which suits a one-shot CLI; a daemon path uses {@link inspectDeviceClaimsAsync}.
+ */
 export function inspectDeviceClaims(
   selectors: DeviceClaimSelectors,
   env: EnvMap,
 ): InspectedDeviceClaim[] {
+  const listed = readMatchingClaimFiles(selectors, env);
+  if ('claims' in listed) return listed.claims;
+  return classifyInspectedClaims(
+    listed.parsed,
+    readHostProcessIdentityObservations(claimOwnerPids(listed.parsed)),
+  );
+}
+
+/** {@link inspectDeviceClaims} with the snapshot taken off the event loop. */
+export async function inspectDeviceClaimsAsync(
+  selectors: DeviceClaimSelectors,
+  env: EnvMap,
+): Promise<InspectedDeviceClaim[]> {
+  const listed = readMatchingClaimFiles(selectors, env);
+  if ('claims' in listed) return listed.claims;
+  return classifyInspectedClaims(
+    listed.parsed,
+    await readHostProcessIdentityObservationsAsync(claimOwnerPids(listed.parsed)),
+  );
+}
+
+function readMatchingClaimFiles(
+  selectors: DeviceClaimSelectors,
+  env: EnvMap,
+): { parsed: InspectedDeviceClaim[] } | { claims: InspectedDeviceClaim[] } {
   const root = resolveDeviceClaimRoot(env);
   const listed = readClaimEntries(root);
-  if ('claims' in listed) return listed.claims;
+  if ('claims' in listed) return listed;
   const parsed = listed.entries
     .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
-    .map((entry) => readDeviceClaimFile(path.join(root, entry.name)))
+    .map((entry) => readDeviceClaimEntry(path.join(root, entry.name)))
     .filter((entry): entry is InspectedDeviceClaim => entry !== null)
     .filter((entry) => matchesClaimSelectors(entry.claim, selectors));
-  const observations = readHostProcessIdentityObservations(
-    parsed.flatMap((entry) => (entry.claim ? [entry.claim.ownerPid] : [])),
-  );
-  return parsed.map((entry) =>
+  return { parsed };
+}
+
+function claimOwnerPids(entries: readonly InspectedDeviceClaim[]): number[] {
+  return entries.flatMap((entry) => (entry.claim ? [entry.claim.ownerPid] : []));
+}
+
+function classifyInspectedClaims(
+  entries: readonly InspectedDeviceClaim[],
+  observations: OwnerObservations,
+): InspectedDeviceClaim[] {
+  return entries.map((entry) =>
     entry.claim
       ? classifyInspectedClaim(entry, observations.get(entry.claim.ownerPid) ?? null)
       : entry,
@@ -98,14 +139,28 @@ function matchesClaimPlatform(claim: DeviceClaim, platform: PlatformSelector | u
   );
 }
 
-export function inspectDeviceClaimFile(filePath: string): InspectedDeviceClaim | null {
-  const entry = readDeviceClaimFile(filePath);
+/** One claim file, judged off the event loop. */
+export async function inspectDeviceClaimFile(
+  filePath: string,
+): Promise<InspectedDeviceClaim | null> {
+  return await classifyDeviceClaimEntry(readDeviceClaimEntry(filePath));
+}
+
+/** Judges the owner of a claim file already read by {@link readDeviceClaimEntry}. */
+export async function classifyDeviceClaimEntry(
+  entry: InspectedDeviceClaim | null,
+): Promise<InspectedDeviceClaim | null> {
   if (!entry?.claim) return entry;
-  const observations = readHostProcessIdentityObservations([entry.claim.ownerPid]);
+  const observations = await readHostProcessIdentityObservationsAsync([entry.claim.ownerPid]);
   return classifyInspectedClaim(entry, observations.get(entry.claim.ownerPid) ?? null);
 }
 
-function readDeviceClaimFile(filePath: string): InspectedDeviceClaim | null {
+/**
+ * One claim file, decoded and not judged: its `classification` is `unknown` until
+ * {@link classifyDeviceClaimEntry} asks the host about the owner. A caller that compares only the
+ * recorded owner token, pid, and start time needs no process-table read at all.
+ */
+export function readDeviceClaimEntry(filePath: string): InspectedDeviceClaim | null {
   const fileName = path.basename(filePath);
   try {
     return inspectClaimContents(fileName, fs.readFileSync(filePath, 'utf8'));
```

**File**: `packages/daemon-contracts/src/device-claim-settlement.test.ts` (modified, +22/-0)
```diff
@@ -8,6 +8,7 @@ import {
   acquireDeviceClaim as acquireProductionDeviceClaim,
   acquireTransientDeviceClaim,
   canonicalLocalDeviceKey,
+  clearDeviceClaim,
   inspectDeviceClaims,
   inspectDeviceClaimAcquisition,
   renewDeviceClaim,
@@ -796,3 +797,24 @@ test('an owner that reopened its app after the reboot keeps the device', async (
   assert.equal(foreign.conflict.classification, 'live');
   assert.equal(storedClaim().session, 'cwd:/w:default');
 });
+
+// Claim writes run on the daemon event loop every session shares. Acquiring a free device and
+// clearing it again compares recorded owners only, so no owner is ever asked about.
+test('acquiring and clearing a free device never blocks on the process table', async () => {
+  const root = useClaimsRoot();
+  const syncReads = vi.spyOn(hostProcess, 'readHostProcessIdentityObservations');
+  const asyncReads = vi.spyOn(hostProcess, 'readHostProcessIdentityObservationsAsync');
+
+  const acquired = await acquireDeviceClaim({
+    env: process.env,
+    device,
+    session: 'counted',
+    workspace: '/worktrees/counted',
+    stateDir: root,
+  });
+  if (acquired.status !== 'acquired') throw new Error('acquisition was refused');
+  assert.equal(await clearDeviceClaim(acquired.ownership, process.env), 'deleted');
+
+  assert.equal(syncReads.mock.calls.length, 0);
+  assert.equal(asyncReads.mock.calls.length, 0);
+});
```

**File**: `packages/daemon-contracts/src/device-claim-settlement.ts` (modified, +3/-1)
```diff
@@ -113,7 +113,9 @@ export async function inspectExistingClaimSettlement(params: {
   observeDeviceBoot?: DeviceBootObservationService;
   env: EnvMap;
 }): Promise<InspectedClaimSettlement> {
-  const existing = inspectDeviceClaimFile(resolveDeviceClaimPath(params.deviceKey, params.env));
+  const existing = await inspectDeviceClaimFile(
+    resolveDeviceClaimPath(params.deviceKey, params.env),
+  );
   if (!existing) return { status: 'available' };
   if (
     existing.claim &&
```

**File**: `packages/daemon-contracts/src/device-claims-app.test.ts` (modified, +3/-3)
```diff
@@ -381,7 +381,7 @@ test.each(['invalid-json', 'unknown'] as const)(
     const file = await seedForeignMacClaim(root, { bundleId: 'com.example.one' });
     if (failure === 'invalid-json') fs.writeFileSync(file, '{');
     else
-      vi.spyOn(claimInspection, 'inspectDeviceClaims').mockReturnValue([
+      vi.spyOn(claimInspection, 'inspectDeviceClaimsAsync').mockResolvedValue([
         { fileName: path.basename(root), classification: 'unknown', error: 'EACCES' },
       ]);
     const before = fs.readFileSync(file, 'utf8');
@@ -643,8 +643,8 @@ test('failed whole-Mac acquisition leaves its abandoned app fenced against forei
   const own = entries.find((entry) => claimedApp(entry.claim) === 'com.example.one')!;
   const foreign = entries.find((entry) => claimedApp(entry.claim) === 'com.example.two')!;
   const orderedScan = vi
-    .spyOn(claimInspection, 'inspectDeviceClaims')
-    .mockReturnValue([own, foreign]);
+    .spyOn(claimInspection, 'inspectDeviceClaimsAsync')
+    .mockResolvedValue([own, foreign]);
   const whole = await acquireDeviceClaim({
     device: mac,
     session: 'whole',
```

**File**: `packages/daemon-contracts/src/device-claims.ts` (modified, +37/-37)
```diff
@@ -17,9 +17,11 @@ import { emitDiagnostic } from '@agent-device/host-kit/diagnostics';
 import { ownerIdentityMatches, readCurrentOwnerIdentity } from '@agent-device/host-kit/process';
 
 import {
+  classifyDeviceClaimEntry,
   deviceClaimOwnerCannotRelease,
   inspectDeviceClaimFile,
-  inspectDeviceClaims,
+  inspectDeviceClaimsAsync,
+  readDeviceClaimEntry,
   type DeviceClaimClassification,
   type DeviceClaimSelectors,
   type InspectedDeviceClaim,
@@ -52,6 +54,7 @@ export {
   deviceClaimOwnerCannotRelease,
   deviceClaimRequiresStaleInspection,
   inspectDeviceClaims,
+  inspectDeviceClaimsAsync,
 } from './device-claim-inspection.ts';
 export type {
   DeviceClaimClassification,
@@ -94,12 +97,12 @@ type ClaimAcquisitionInspectionParams = {
   observeDeviceBoot?: DeviceBootObservationService;
 };
 
-function inspectTransientExactClaim(
+async function inspectTransientExactClaim(
   params: ClaimAcquisitionInspectionParams,
   deviceKey: string,
   owner: ReturnType<typeof readCurrentOwnerIdentity>,
-): InspectedClaimSettlement | undefined {
-  const existing = inspectDeviceClaimFile(resolveDeviceClaimPath(deviceKey, params.env));
+): Promise<InspectedClaimSettlement | undefined> {
+  const existing = await inspectDeviceClaimFile(resolveDeviceClaimPath(deviceKey, params.env));
   const local =
     existing &&
     inspectTransientLocalClaim(existing, { ...params, coveredBySession: params.session }, owner);
@@ -117,7 +120,7 @@ async function inspectExactClaimSettlement(
 ): Promise<InspectedClaimSettlement> {
   const transient = params.command !== 'open';
   if (transient && allowTransientCoverage) {
-    const local = inspectTransientExactClaim(params, deviceKey, owner);
+    const local = await inspectTransientExactClaim(params, deviceKey, owner);
     if (local) return local;
   }
   const acquirer = {
@@ -129,19 +132,19 @@ async function inspectExactClaimSettlement(
   return await inspectExistingClaimSettlement({ ...acquirer, device, deviceKey, owner });
 }
 
-function inspectOverlappingHostScopedClaims(
+async function inspectOverlappingHostScopedClaims(
   params: ClaimAcquisitionInspectionParams,
   identity: DeviceIdentity,
   owner: ReturnType<typeof readCurrentOwnerIdentity>,
-): InspectedClaimSettlement[] {
+): Promise<InspectedClaimSettlement[]> {
   const settlements: InspectedClaimSettlement[] = [];
-  for (const entry of inspectDeviceClaims({}, params.env)) {
+  for (const entry of await inspectDeviceClaimsAsync({}, params.env)) {
     if (!entry.claim) {
       settlements.push({ status: 'conflict', conflict: entry });
       continue;
     }
     if (!isClaimOfHostScopedDevice(identity, entry.claim)) continue;
-    const current = inspectDeviceClaimFile(
+    const current = await inspectDeviceClaimFile(
       resolveDeviceClaimPath(entry.claim.deviceKey, params.env),
     );
     if (current) {
@@ -179,7 +182,7 @@ export async function inspectDeviceClaimAcquisition(
     hostDeviceId === undefined &&
     canHostScopedDevices(params.device)
   ) {
-    const local = inspectTransientExactClaim(params, deviceKey, owner);
+    const local = await inspectTransientExactClaim(params, deviceKey, owner);
     if (local) return [local];
   }
   const settlements: InspectedClaimSettlement[] = [];
@@ -188,13 +191,13 @@ export async function inspectDeviceClaimAcquisition(
     const hostKey = canonicalLocalDeviceKey(deviceClaimIdentity(host));
     const hostSettlement = await inspectExactClaimSettlement(params, host, hostKey, owner, false);
     if (hostSettlement.status === 'held') {
-      const held = inspectDeviceClaimFile(resolveDeviceClaimPath(hostKey, params.env));
+      const held = await inspectDeviceClaimFile(resolveDeviceClaimPath(hostKey, params.env));
       if (held) settlements.push({ status: 'conflict', conflict: held });
     } else {
       settlements.push(hostSettlement);
     }
   } else if (canHostScopedDevices(params.device)) {
-    settlements.push(...inspectOverlappingHostScopedClaims(params, identity, owner));
+    settlements.push(...(await inspectOverlappingHostScopedClaims(params, identity, owner)));
   }
   settlements.push(await inspectExactClaimSettlement(params, params.device, deviceKey, owner));
   return settlements;
@@ -256,7 +259,7 @@ async function withAcquisitionLocks<Result extends TransientDeviceClaimResult>(
     });
     if (hostClaim.status === 'conflict') return hostClaim;
     if (hostClaim.status === 'held') {
-      const held = inspectDeviceClaimFile(resolveDeviceClaimPath(hostKey, params.env));
+      const held = await inspectDeviceClaimFile(resolveDeviceClaimPath(hostKey, params.env));
       if (held) return { status: 'conflict', conflict: held };
     }
     const acquired = await withDeviceClaimLock(deviceKey, params.env, acquire);
@@ -326,7 +329,7 @@ export async function acquireTransientDeviceClaim(params: {
     transientCommand: params.command,
   };
   return await withAcquisitionLocks(lockParams, deviceKey, async () => {
-    c
```

**File**: `packages/daemon/src/sessions/session-lifecycle/internal/inventory.ts` (modified, +4/-4)
```diff
@@ -33,7 +33,7 @@ import {
 import { resolveAndroidSerialAllowlist } from '@agent-device/kernel/device-isolation';
 import {
   deviceClaimOwnerCannotRelease,
-  inspectDeviceClaims,
+  inspectDeviceClaimsAsync,
   canonicalLocalDeviceKey,
   deviceClaimIdentity,
   isClaimOfHostScopedDevice,
@@ -157,7 +157,7 @@ async function devicesInventoryResponse(
   env: HostEnvironment['env'],
 ): Promise<DaemonResponse> {
   try {
-    const claims = blockingClaims(env);
+    const claims = await blockingClaims(env);
     return {
       ok: true,
       data: {
@@ -180,8 +180,8 @@ async function devicesInventoryResponse(
   }
 }
 
-function blockingClaims(env: HostEnvironment['env']): DeviceClaim[] {
-  return inspectDeviceClaims({}, env).flatMap((entry) =>
+async function blockingClaims(env: HostEnvironment['env']): Promise<DeviceClaim[]> {
+  return (await inspectDeviceClaimsAsync({}, env)).flatMap((entry) =>
     entry.claim && !deviceClaimOwnerCannotRelease(entry.classification) ? [entry.claim] : [],
   );
 }
```

**File**: `packages/host-kit/src/internal/host-process-liveness.test.ts` (modified, +62/-15)
```diff
@@ -16,16 +16,18 @@ import {
   isProcessZombie,
   readHostProcessIdentityObservations,
   readHostProcessIdentityObservationsAsync,
+  readProcessIdentities,
   readProcessIdentityFacts,
 } from './host-process.ts';
 
 function psReturns(stdout: string, exitCode = 0): void {
   mockRunCmdSync.mockReturnValue({ stdout, stderr: '', exitCode });
 }
 
-function psAnswersEachField(fields: Record<string, string>): void {
+/** Answers the two batched identity reads: state and start time, and the command line. */
+function psAnswersIdentity(rows: { identity?: string; command?: string }): void {
   mockRunCmd.mockImplementation(async (_cmd: string, args: string[]) => {
-    const value = fields[args[3]!];
+    const value = args[3] === 'pid=,command=' ? rows.command : rows.identity;
     return { stdout: value ?? '', stderr: '', exitCode: value === undefined ? 1 : 0 };
   });
 }
@@ -133,11 +135,10 @@ test('no pid to ask about means no process tool runs at all', async () => {
   assert.equal(mockRunCmdSync.mock.calls.length, 0);
 });
 
-test('the ownership read spends the budget its caller names on every field', async () => {
-  psAnswersEachField({
-    'lstart=': 'Mon Aug 10 20:00:00 2026',
-    'command=': '/bin/simctl io recordVideo out.mp4',
-    'state=': 'Ss',
+test('the ownership read spends the budget its caller names on both batched reads', async () => {
+  psAnswersIdentity({
+    identity: '4242 Ss   Mon Aug 10 20:00:00 2026\n',
+    command: '4242 /bin/simctl io recordVideo out.mp4\n',
   });
 
   const facts = await readProcessIdentityFacts(4242, 5_000);
@@ -147,12 +148,61 @@ test('the ownership read spends the budget its caller names on every field', asy
     command: '/bin/simctl io recordVideo out.mp4',
     zombie: false,
   });
-  assert.equal(mockRunCmd.mock.calls.length, 3);
+  assert.deepEqual(
+    mockRunCmd.mock.calls.map((call) => call[1]),
+    [
+      ['-p', '4242', '-o', 'pid=,state=,lstart='],
+      ['-p', '4242', '-o', 'pid=,command='],
+    ],
+  );
   for (const call of mockRunCmd.mock.calls) {
     assert.equal(call[2]?.timeoutMs, 5_000);
   }
 });
 
+test('one identity read answers a whole fleet from two ps runs, on Linux and macOS output', async () => {
+  // procps pads a one-digit day with a space; BSD ps on macOS prints the same lstart layout. The
+  // command keeps its own spaces, and a pid the host did not list stays unknown.
+  psAnswersIdentity({
+    identity: [
+      '  101 Ss   Mon Nov  9 10:00:00 2026',
+      '  202 Z+   Tue Nov 10 08:30:00 2026',
+      '',
+    ].join('\n'),
+    command: [
+      '  101 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless',
+      '  202 [chrome] <defunct>',
+      '',
+    ].join('\n'),
+  });
+
+  const facts = await readProcessIdentities([101, 202, 303, 101]);
+
+  assert.deepEqual(
+    [...facts.entries()],
+    [
+      [
+        101,
+        {
+          startTime: 'Mon Nov  9 10:00:00 2026',
+          command: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless',
+          zombie: false,
+        },
+      ],
+      [202, { startTime: 'Tue Nov 10 08:30:00 2026', command: '[chrome] <defunct>', zombie: true }],
+      [303, { startTime: null, command: null, zombie: null }],
+    ],
+  );
+  assert.deepEqual(
+    mockRunCmd.mock.calls.map((call) => call[1]),
+    [
+      ['-p', '101,202,303', '-o', 'pid=,state=,lstart='],
+      ['-p', '101,202,303', '-o', 'pid=,command='],
+    ],
+  );
+  assert.equal(mockRunCmdSync.mock.calls.length, 0, 'the identity read never blocks the loop');
+});
+
 test('the ownership read reports an unanswered host as unknown, not as absence', async () => {
   mockRunCmd.mockRejectedValue(new Error('/bin/ps timed out after 5000ms'));
 
@@ -164,20 +214,17 @@ test('the ownership read reports an unanswered host as unknown, not as absence',
 });
 
 test('the ownership read leaves the zombie question open when only the state is unreadable', async () => {
-  psAnswersEachField({
-    'lstart=': 'Mon Aug 10 20:00:00 2026',
-    'command=': '/bin/simctl io recordVideo out.mp4',
-  });
+  psAnswersIdentity({ command: '4242 /bin/simctl io recordVideo out.mp4\n' });
 
   assert.deepEqual(await readProcessIdentityFacts(4242, 5_000), {
-    startTime: 'Mon Aug 10 20:00:00 2026',
+    startTime: null,
     command: '/bin/simctl io recordVideo out.mp4',
     zombie: null,
   });
 });
 
 test('the ownership read answers the zombie question from the state field', async () => {
-  psAnswersEachField({ 'lstart=': 'x', 'command=': 'y', 'state=': 'ZN' });
+  psAnswersIdentity({ identity: '4242 ZN x\n', command: '4242 y\n' });
 
   assert.deepEqual(await readProcessIdentityFacts(4242), {
     startTime: 'x',
@@ -191,7 +238,7 @@ test('the ownership read answers the zombie question from the state field', asyn
 test('a host without /bin/ps reads identity through the NixOS system profile procps', async () => {
   psInstalledAt(['/run/current-system/sw/bin/ps']);
   psReturns('
```

#### Recent Merged Pull Requests:
- **PR #4400** (2026-11-11): ci: install the Android SDK through one setup-android-sdk action (@thymikee)
- **PR #4398** (2026-11-11): fix(selectors): make only value rewrites live recorded placeholders (@thymikee)
- **PR #4397** (2026-11-11): fix(maestro): run child entrypoints through symlinked paths (@thymikee)
- **PR #4394** (2026-11-11): fix: review follow-ups (web text-entry hint, recorder echo names, mutation report on cancel) (@thymikee)
- **PR #4393** (2026-11-11): refactor(apple): remove redundant cleanup platform state (@thymikee)
- **PR #4392** (closed): test(daemon): split longpress script-writer tests to fix red main lint (@thymikee)

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

## X. replay): escape recorded interpolation, run scripts off the event loop, harden M

**RULE**:
When implementing operations in `.fallowrc.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1244334d`: replay): escape recorded interpolation, run scripts off the event loop, harden Maestro and test flows (#4363). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.fallowrc.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    "packages/maestro/src/daemon-port/run-script-child.ts",
    "packages/maestro/src/daemon-port/run-script-http-child.ts",
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1244334d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
