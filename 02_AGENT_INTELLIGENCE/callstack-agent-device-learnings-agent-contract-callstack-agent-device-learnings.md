# Agent Contract: Agent Contract: callstack-agent-device-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "callstack-agent-device-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T05:20:02.189Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-callstack-agent-device-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack-agent-device-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T05:20:02.189Z`  
> **Learning ID**: `LEARN-EVO-callstack-agent-device-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `callstack-agent-device-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source**: github ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Source Version**: `d6767e09`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T05:19:56.334Z  
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
> **Harvest Timestamp**: 2026-11-22T05:19:56.329Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Open source device layer for AI coding agents: a CLI, MCP server, and typed Node.js API to control mobile, web, TV, and desktop apps on devices and simulators, locally or in the cloud.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5476 stars

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
  let suspect: SuspectCachedArtifact | undefined;
  try {
    for (let attempt = 1; attempt <= PREPARE_RUNNER_HEALTH_MAX_SESSION_ATTEMPTS; attempt += 1) {
      const result = await runPrepareAttempt({
        device,
        command,
        options: { ...options, startAdmission },
        signal,
        attempt,
        recoveryReason,
        suspect,
      });
      if (result.kind === 'prepared') return result.result;
      recoveryReason = result.recoveryReason;
      suspect = result.suspect;
    }
  } finally {
    finishRunnerStartAdmission(startAdmission);
  }

  // Unreachable while PREPARE_RUNNER_HEALTH_MAX_SESSION_ATTEMPTS is positive.
  throw new AppError('COMMAND_FAILED', 'iOS runner prepare failed');
}

type RestoredRunnerSession = RunnerSession & {
  xctestrunArtifact: NonNullable<RunnerSession['xctestrunArtifact']>;
};

/** A restored artifact that a failed attempt indicted, and the failure that indicted it. */
type SuspectCachedArtifact = Readonly<{
  artifact: RestoredRunnerSession['xctestrunArtifact'];
  reason: string;
}>;

type PrepareAttemptResult =
  | { kind: 'prepared'; result: PrepareIosRunnerResult }
  | { kind: 'retry'; recoveryReason: string; suspect: SuspectCachedArtifact | undefined };

async function runPrepareAttempt(params: {
  device: DeviceInfo;
  command: RunnerCommand;
  options: PrepareIosRunnerOptions;
  signal: AbortSignal | undefined;
  attempt: number;
  recoveryReason: string | undefined;
  suspect: SuspectCachedArtifact | undefined;
}): Promise<PrepareAttemptResult> {
  const { device, command, options, signal, attempt, recoveryReason, suspect } = params;
  const connectStartedAt = Date.now();
  assertRunnerStartAdmitsPreparation(device.id, options.startAdmission);
  let sessionPhaseTimeouts: PrepareDeadlinePhaseTimeouts;
  try {
    sessionPhaseTimeouts = readPrepareDeadlinePhaseTimeouts(options, 'runner_session');
  } catch (error) {
    // The indicted attempt spent the deadline, so no rebuild fits in this prepare. Cleaning the
    // artifact makes the next prepare build a fresh one.
    if (suspect) await markRunnerXctestrunArtifactBadForRun(suspect.artifact, suspect.reason);
    throw error;
  }
  const session = await ensureRunnerSession(device, {
    ...options,
    cleanStaleBundles: attempt > 1 ? true : options.cleanStaleBundles,
    ...sessionPhaseTimeouts,
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
      suspect,
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
  suspect: SuspectCachedArtifact | undefined;
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
  // A slow boot on a loaded host fails the same way as a corrupt artifact, and the rebuild cleans
  // a cache that concurrent sessions read. The first indictment retries on the cache; a retry that
  // also fails, in any way, rebuilds it (#4689).
  if (params.suspect && hasRestoredRunnerArtifact(session)) {
    return {
      kind: 'prepared',
      result: await recoverBadCachedRunnerArtifact({
        device,
        session,
        command,
        options,
        signal,
        reason: params.suspect.reason,
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
  return {
    kind: 'retry',
    recoveryReason: reason,
    suspect: shouldRecoverBadCachedRunnerArtifact(appErr, session)
      ? { artifact: session.xctestrunArtifact, reason }
      : undefined,
  };
}

async function recoverBadCachedRunnerArtifact(params: {
  device: DeviceInfo;
  session: RestoredRunnerSession;
  command: RunnerCommand;
  options: PrepareIosRunnerOptions;
  signal: AbortSignal | undefined;
  reason: string;
}): Promise<PrepareIosRunnerResult> {
  const { device, session, command, options, signal, reason } = params;
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
      xctestrunPath: r
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
- **Issue #4901** (2026-11-21): **Android smoke: plain close fails with 'com.android.settings process remained running after close' since #4881**
  *Symptoms*: ## Purpose  Since #4881 (merged 2026-11-21, `0525c45`), a plain `close` closes the session app and fails when the app does not exit. The Android emulator smoke replay `test/integration/replays/android/emulator/01-settings.ad` now fails intermittently at that step, and the failure is not retried:  ``` ⨯ 01-settings.ad   failed at: Android app com.android.settings process remained running after close ```  Seen three times in about 10 minutes on unrelated PR branches: runs 44913451859 and 44913878501 (#4897, an iOS-only change) and 44913308426 (`refactor/0.22-limrun-provider-plugin`). Main passed once at `721adbc`. Any PR can fail this lane.  ## Required behavior  - Find why the Settings process is still present after the close fence (for example a system restart of `com.android.settings`, a fence that checks too early, or a pid read that catches a new process). - Fix it at the owner of the Android app-close fence, using typed evidence (process identity, not just "a process with that name exists"). Do not add retries or longer sleeps as the fix, and do not revert #4881's behavior. - A device-free regression for the identified cause, and the smoke replay green across several CI runs. 

- **Issue #4862** (2026-11-21): **0.22: route web and Vega plugin process spawns and diagnostics through the plugin host**
  *Symptoms*: Found in the review of #4857 (https://github.com/callstack/agent-device/pull/4857#issuecomment-7049407779). #4857 fixes it for HarmonyOS only; the same fault is in the two platform plugins already merged into `0.22` (#4792 web, #4828 Vega).  ## Problem  A managed platform plugin bundles its own copy of `@agent-device/host-kit` (`deps.alwaysBundle` matches `/^@agent-device\//`). A runtime import of `@agent-device/host-kit/command` or `@agent-device/host-kit/diagnostics` inside the plugin therefore uses a second `AsyncLocalStorage` scope that the daemon's `withCommandHost(...)` never enters. In the packed plugin:  - spawned tools inherit `process.env`, not the captured `host.env` (cwd and environment of the daemon host); - exec traces and timers go to the plugin's own diagnostics store, so `--debug` logs lose them.  Workspace tests resolve the plugin from `src`, where host-kit is one instance, so they do not see it.  Runtime import sites reported by #4857:  - `packages/platform-web/src`: `agent-browser-install.ts`, `agent-browser-lifecycle.ts`, `agent-browser-process-record.ts`, `agent-browser-provider.ts`, `agent-browser-tool.ts`, `interactor.ts` - `packages/platform-vega/src`: `app-lifecycle.ts`, `input-actions.ts`, `inventory.ts`, `tool-provider.ts`, `vega-executable.ts` - `packages/provider-limrun/src` has one such import on #4846; check whether a provider plugin has the same fault.  ## Required behavior  Every process a managed platform plugin spawns and every diagnostic i

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

### Incident Patch 1: `64d7fc75` (2026-11-20)
**Commit Message**: fix(remote): write record stop output only to request-named destinations (#4724)

* fix(capture): bind remote capture output authority to a client-minted grant ID per start attempt (#4518)

Corrected record slice of the reviewed defensive candidate (shared object
1685076dd5cb8c02c2151664991ad48fedc085c3, preserved untouched on
t3/defensive-capture-grants).

A remote response no longer establishes a local write destination on a finishing
capture action. The client mints one distinct grant ID per record start attempt and
persists the caller-named destination under the existing remote-connections state
owner BEFORE the request is dispatched — keyed by the immutable ID, never a
latest-slot overwrite and never created from the response. The daemon admits the
optional meta.captureGrantId on public record starts only (record-only scope; trace
and perf keep their existing paths), binds it to the accepted capture in the producer
lifecycle envelope metadata, and the matching stop echoes it from that capture's
durable record; the internal fencing token never leaves the envelope.

A persisted start destination is authorized EXCLUSIVELY by the producer-echoed grant
ID matched against the persis

**File**: `docs/agents/security.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 The CLI client trusts its caller to choose local destinations.
 The client trusts a remote daemon for data and validated identifiers.
-Script publication takes no path from the daemon. Capture delivery still can (#4518).
+Scripts and remote record stop reject daemon paths (#4518). Trace and perf take them.
 The daemon admits its state directory. Nobody trusts the network or other local users.
 Out of scope: same uid, hostile root, ACLs, mounts, untrusted filesystems.
 
```

**File**: `packages/command-surface/src/schema/command-overrides.ts` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ const SCHEMA_ONLY_CLI_COMMAND_SCHEMAS = {
     text: {
       summary: 'Expose a local daemon through an HTTP tunnel',
       description:
-        'Expose the local daemon HTTP contract through a tunnel-friendly reverse proxy.\n\nRun this on the host that has access to simulators/devices, expose the printed local proxy URL through a tunnel, then point another machine at the tunnel URL with connect proxy.\n\nThe proxy starts or reuses a local HTTP daemon, accepts /health, /rpc, /upload and resumable /upload/* routes, and /artifacts plus /artifacts/*, and also accepts the same routes under /agent-device/*. Health is unauthenticated for reachability probes. Other routes require the generated bearer token printed at startup, or the explicit --daemon-auth-token value when provided. The proxy rewrites authorized client requests to the upstream daemon token instead of exposing the local daemon token.\n\nFor a TLS-terminated tunnel, set --public-origin to the public HTTP(S) origin, for example --public-origin https://public.example:8443. Forwarded and X-Forwarded-* headers do not select upload ticket origins. For an ephemeral tunnel, obtain its public name first, then configure and restart the proxy. Without a fixed origin, Node uses the actual socket scheme and validated Host.\n\nUse the /agent-device base path when connecting through cloudflared, ngrok, or another shared origin. Treat the bearer token as a secret; anyone with it can control the proxied daemon. This direct proxy flow does not use agent-device auth.\n\nRemote captures write generated artifacts on the daemon. Screenshot, recording, performance, and trace paths select downloads on the client; they never select host files. Direct RPC callers download returned artifact IDs through /artifacts/<id>. Remote requests ignore client cwd and refuse host tooling paths and --launch-console. A fresh open --save-script=<path> arms recording; after each recorded action the client refreshes that caller file, and close writes the final script there. Remote session save-script, close/replay --save-script, and --save-script in batch steps remain refused.\n\nExamples:\n  cloudflared tunnel --url http://127.0.0.1:4310\n  agent-device proxy --port 4310 --public-origin https://example.trycloudflare.com\n  agent-device connect proxy --daemon-base-url https://example.trycloudflare.com/agent-device --daemon-auth-token <token>',
+        'Expose the local daemon HTTP contract through a tunnel-friendly reverse proxy.\n\nRun this on the host that has access to simulators/devices, expose the printed local proxy URL through a tunnel, then point another machine at the tunnel URL with connect proxy.\n\nThe proxy starts or reuses a local HTTP daemon, accepts /health, /rpc, /upload and resumable /upload/* routes, and /artifacts plus /artifacts/*, and also accepts the same routes under /agent-device/*. Health is unauthenticated for reachability probes. Other routes require the generated bearer token printed at startup, or the explicit --daemon-auth-token value when provided. The proxy rewrites authorized client requests to the upstream daemon token instead of exposing the local daemon token.\n\nFor a TLS-terminated tunnel, set --public-origin to the public HTTP(S) origin, for example --public-origin https://public.example:8443. Forwarded and X-Forwarded-* headers do not select upload ticket origins. For an ephemeral tunnel, obtain its public name first, then configure and restart the proxy. Without a fixed origin, Node uses the actual socket scheme and validated Host.\n\nUse the /agent-device base path when connecting through cloudflared, ngrok, or another shared origin. Treat the bearer token as a secret; anyone with it can control the proxied daemon. This direct proxy flow does not use agent-device auth.\n\nRemote captures write generated artifacts on the daemon. Screenshot, performance, and trace paths select downloads on the client; they never select host files. A remote recording downloads to the path named by the record stop request, or otherwise to the working directory with a warning. Direct RPC callers download returned artifact IDs through /artifacts/<id>. Remote requests ignore client cwd and refuse host tooling paths and --launch-console. A fresh open --save-script=<path> arms recording; after each recorded action the client refreshes that caller file, and close writes the final script there. Remote session save-script, close/replay --save-script, and --save-script in batch steps remain refused.\n\nExamples:\n  cloudflared tunnel --url http://127.0.0.1:4310\n  agent-device proxy --port 4310 --public-origin https://example.trycloudflare.com\n  agent-device connect proxy --daemon-base-url https://example.trycloudflare.com/agent-device --daemon-auth-token <token>',
     },
     listUsageOverride: 'proxy',
     allowedFlags: ['proxyHost', 'proxyPort', 'publicOrigin', 'daemonAuthToken', 'stateDir'],
```

**File**: `packages/remote/src/__tests__/daemon-artifacts-capture.test.ts` (modified, +0/-7)
```diff
@@ -98,13 +98,6 @@ test.for<MaterializationCase>([
     fileName: '../../x',
     expected: 'cwd/x',
   },
-  {
-    name: 'a record stop accepts the echo of its start destination',
-    command: 'record',
-    localPath: 'client/clip.mp4',
-    fileName: 'clip.mp4',
-    expected: 'client/clip.mp4',
-  },
   {
     name: 'a close does not authorize an unrelated response artifact destination',
     command: 'close',
```

**File**: `packages/remote/src/__tests__/daemon-artifacts-record-download.test.ts` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+import fs from 'node:fs';
+import http from 'node:http';
+import path from 'node:path';
+import type { DaemonArtifact } from '@agent-device/kernel/contracts';
+import { expect, test, type TestContext } from 'vitest';
+import {
+  closeLoopbackServer,
+  createTestHostEnvironment,
+  listenOnLoopback,
+  mkdtempForTestSync,
+  skipWhenLoopbackUnavailable,
+} from '@agent-device/test-kit';
+import { materializeRemoteArtifacts } from '../daemon-artifacts.ts';
+
+async function withRecordingServer(
+  t: TestContext,
+  run: (cwd: string, stop: ReturnType<typeof recordStop>) => Promise<void>,
+): Promise<void> {
+  if (await skipWhenLoopbackUnavailable(t, 'remote recording download')) return;
+  const root = mkdtempForTestSync('agent-device-record-download-');
+  const cwd = path.join(root, 'cwd');
+  fs.mkdirSync(cwd);
+  // Each artifact's bytes are its own id, served as binary so the body is never read as HTML.
+  const server = http.createServer((req, res) => {
+    res.writeHead(200, { 'content-type': 'application/octet-stream' });
+    res.end(path.basename(req.url ?? ''));
+  });
+  try {
+    const port = await listenOnLoopback(server);
+    await run(cwd, recordStop(`http://127.0.0.1:${port}`, cwd, path.join(root, 'state')));
+  } finally {
+    await closeLoopbackServer(server);
+  }
+}
+
+function recordStop(baseUrl: string, cwd: string, stateDir: string) {
+  return async (artifacts: DaemonArtifact[], requested?: string, chunks?: unknown) => {
+    const response = await materializeRemoteArtifacts(
+      { baseUrl, token: 'secret' },
+      {
+        token: 'secret',
+        command: 'record',
+        session: 'capture',
+        positionals: requested ? ['stop', requested] : ['stop'],
+        meta: { cwd },
+      },
+      { ok: true, data: { artifacts, chunks, outPath: '/daemon/other.mp4' } },
+      createTestHostEnvironment(),
+      stateDir,
+    );
+    if (!response.ok) throw new Error(response.error.message);
+    return response.data;
+  };
+}
+
+const video = {
+  artifactId: 'video',
+  field: 'outPath',
+  artifactType: 'screen-recording',
+  path: '/daemon/clip.mp4',
+  fileName: 'clip.mp4',
+} satisfies DaemonArtifact;
+
+test('record stop ignores the daemon localPath and warns about the cwd download', async (t) => {
+  await withRecordingServer(t, async (cwd, stop) => {
+    const hostile = path.resolve(cwd, '../hostile.mp4');
+    const data = await stop([{ ...video, localPath: hostile }]);
+    const fallback = path.join(cwd, 'clip.mp4');
+    expect(fs.existsSync(hostile)).toBe(false);
+    expect(fs.readFileSync(fallback, 'utf8')).toBe('video');
+    expect(data).toMatchObject({
+      outPath: fallback,
+      recordingDestinationWarnings: [
+        { reason: 'recording_destination_not_requested', field: 'outPath', path: fallback },
+      ],
+      warnings: [expect.stringContaining(fallback)],
+    });
+  });
+});
+
+test('record stop uses the destination named in the current request', async (t) => {
+  await withRecordingServer(t, async (cwd, stop) => {
+    const hostile = path.resolve(cwd, '../hostile.mp4');
+    const data = await stop([{ ...video, localPath: hostile }], '../requested.mp4');
+    const requested = path.resolve(cwd, '../requested.mp4');
+    expect(fs.existsSync(hostile)).toBe(false);
+    expect(fs.readFileSync(requested, 'utf8')).toBe('video');
+    expect(data?.outPath).toBe(requested);
+    expect(data?.recordingDestinationWarnings).toBeUndefined();
+  });
+});
+
+test('record stop replaces a destination symlink without writing through it', async (t) => {
+  await withRecordingServer(t, async (cwd, stop) => {
+    const destination = path.join(cwd, 'clip.mp4');
+    const target = path.resolve(cwd, '../target');
+    fs.writeFileSync(target, 'original');
+    fs.symlinkSync(target, destination);
+    await stop([video]);
+    expect(fs.readFileSync(target, 'utf8')).toBe('original');
+    expect(fs.lstatSync(destination).isFile()).toBe(true);
+    expect(fs.readFileSync(destination, 'utf8')).toBe('video');
+    expect(fs.readdirSync(cwd)).toEqual(['clip.mp4']);
+  });
+});
+
+test.for([
+  'C:foo.mp4',
+  'clip.mp4:stream',
+  '..',
+  'CON.mp4',
+  'nested/clip.mp4',
+  String.raw`x\clip.mp4`,
+  'x\n.mp4',
+])('record stop generates a name in cwd for %j', async (fileName, t) => {
+  await withRecordingServer(t, async (cwd, stop) => {
+    const data = await stop([{ ...video, fileName }]);
+    const names = fs.readdirSync(cwd);
+    expect(names).toHaveLength(1);
+    expect(names).not.toContain(fileName);
+    expect(names).not.toContain(path.posix.basename(fileName));
+    expect(names).not.toContain(path.win32.basename(fileName));
+    const destination = path.join(cwd, names[0]!);
+    expect(data?.outPath).toBe(destination);
+    expect(fs.readFileSync(destination, 'utf8')).toBe('video');
+    expect(data?.recordingDestinationWarnings).toEqual([
+      { reason: 'recording_destination_not_requested', field: 'outPath', pat
```

**File**: `packages/remote/src/artifact-download.ts` (modified, +29/-0)
```diff
@@ -32,13 +32,24 @@ export type RemoteArtifactDownload = RemoteArtifactRequest & {
   destinationPath: string;
   /** Whether `destinationPath` is a caller-owned root rather than one file to create. */
   isDirectory?: boolean;
+  stagedFile?: boolean;
 };
 
 /** An artifact held in memory, stopped once it crosses `maxBytes`, whatever `Content-Length` announced. */
 export type RemoteArtifactFetch = RemoteArtifactRequest & { maxBytes: number };
 
 function buildDownloadDestination(params: RemoteArtifactDownload) {
   const { destinationPath } = params;
+  if (params.stagedFile) {
+    return {
+      prepare: async () => {
+        await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
+      },
+      cleanupOnError: async () => {},
+      materialize: (res: http.IncomingMessage, signal: AbortSignal) =>
+        materializeStagedFile(res, destinationPath, signal),
+    };
+  }
   if (params.isDirectory) {
     return {
       prepare: async () => {
@@ -63,6 +74,24 @@ function buildDownloadDestination(params: RemoteArtifactDownload) {
   };
 }
 
+async function materializeStagedFile(
+  res: http.IncomingMessage,
+  destinationPath: string,
+  signal: AbortSignal,
+): Promise<string> {
+  const parent = await fs.promises.realpath(path.dirname(destinationPath));
+  const staging = await fs.promises.mkdtemp(path.join(parent, '.agent-device-download-'));
+  const staged = path.join(staging, 'artifact');
+  try {
+    await pipeline(res, fs.createWriteStream(staged, { flags: 'wx', mode: 0o600 }), { signal });
+    signal.throwIfAborted();
+    await fs.promises.rename(staged, path.join(parent, path.basename(destinationPath)));
+    return destinationPath;
+  } finally {
+    await fs.promises.rm(staging, { recursive: true, force: true });
+  }
+}
+
 /** Fetches one artifact into memory. Nothing reaches the disk, so a failure leaves nothing behind. */
 export async function fetchRemoteArtifactFromUrl(params: RemoteArtifactFetch): Promise<Buffer> {
   return await requestRemoteArtifact(params, {
```

**File**: `packages/remote/src/daemon-artifacts.ts` (modified, +82/-15)
```diff
@@ -535,6 +535,7 @@ async function downloadResponseArtifacts(
   if (artifacts.length === 0) return data === response.data ? response : { ok: true, data };
   const nextData: Record<string, unknown> = { ...(data ?? {}) };
   const nextArtifacts: DaemonArtifact[] = [];
+  const recording = isRecordStop(req) ? recordingDelivery() : undefined;
   for (const artifact of artifacts) {
     if (isSessionScriptArtifact(artifact)) {
       await scripts?.publish(artifact, nextData, nextArtifacts);
@@ -545,18 +546,20 @@ async function downloadResponseArtifacts(
       continue;
     }
     if (typeof artifact.field !== 'string' || isClientOwnedResponseField(artifact.field)) continue;
-    const downloadPath = resolveMaterializedArtifactPath(artifact, req, host);
+    const destination = resolveMaterializedArtifactPath(artifact, req, host);
     const materializedPath = await downloadRemoteArtifact({
       ...endpoint,
       artifactId: artifact.artifactId,
-      destinationPath: downloadPath,
+      destinationPath: destination.path,
       requestScope: req.meta,
       // #2246: `test-artifacts` is the one directory-shaped artifact type today — known from the
       // response, before any bytes arrive, so cleanup-on-error can be decided up front instead of
       // racing the response headers (a directory destination must never be `rm`'d wholesale; see
       // `downloadRemoteArtifact`).
-      isDirectory: artifact.artifactType === 'test-artifacts',
+      isDirectory: recording === undefined && artifact.artifactType === 'test-artifacts',
+      stagedFile: recording !== undefined,
     });
+    recording?.add(artifact.field, materializedPath, destination.fallback);
     // Directory artifacts download into a caller-owned root, then atomically publish their one
     // top-level entry beneath it. Use the path the download actually published rather than the
     // root hint sent over the wire; otherwise `artifactsDir` loses its suite invocation segment.
@@ -567,9 +570,56 @@ async function downloadResponseArtifacts(
     });
   }
   nextData.artifacts = nextArtifacts;
+  recording?.report(nextData);
   return { ok: true, data: nextData };
 }
 
+const RECORDING_DESTINATION_REASONS = {
+  notRequested: 'recording_destination_not_requested',
+} as const;
+
+type RecordingDestinationWarning = {
+  reason: typeof RECORDING_DESTINATION_REASONS.notRequested;
+  field: string;
+  path: string;
+};
+
+function recordingDelivery() {
+  const destinationWarnings: RecordingDestinationWarning[] = [];
+  const recordingPaths: string[] = [];
+  return {
+    add(field: string, written: string, fallback: boolean): void {
+      if (fallback) {
+        destinationWarnings.push({
+          reason: RECORDING_DESTINATION_REASONS.notRequested,
+          field,
+          path: written,
+        });
+      }
+      if (field === 'outPath' || field === 'chunkPath') recordingPaths.push(written);
+    },
+    report(data: Record<string, unknown>): void {
+      if (destinationWarnings.length > 0) {
+        data.recordingDestinationWarnings = destinationWarnings;
+        data.warnings = [
+          ...(Array.isArray(data.warnings) ? data.warnings : []),
+          ...destinationWarnings.map(
+            ({ path: written }) =>
+              `Saved remote recording file to ${written} in the current directory because this request named no destination.`,
+          ),
+        ];
+      }
+      // The daemon lists the first video and subsequent chunk artifacts in chunk order.
+      if (Array.isArray(data.chunks) && recordingPaths.length === data.chunks.length) {
+        data.chunks = data.chunks.map((chunk, index) => ({
+          ...chunk,
+          path: recordingPaths[index],
+        }));
+      }
+    },
+  };
+}
+
 function hasDownloadableArtifactId(
   artifact: DaemonArtifact | undefined,
 ): artifact is DaemonArtifact & { artifactId: string } {
@@ -604,15 +654,12 @@ function withoutScriptFieldOwner(
 }
 
 /**
- * Whether this request finishes a capture whose destination this client named in an EARLIER
- * request (`record start`, a perf or trace start with an output path). The daemon echoes that
- * destination, and the paths it derives from it, as `localPath`, because this process kept no
- * record of it. The finishing actions mirror the daemon's own (`request-finalization.ts`).
+ * Whether this request finishes a trace or perf capture whose destination the daemon echoes
+ * from an earlier request. The finishing actions mirror `request-finalization.ts`.
  */
 function finishesEarlierClientCapture(req: DaemonWireRequest): boolean {
   const [first, second, third] = (req.positionals ?? []).map((value) => value.toLowerCase());
   switch (req.command) {
-    case 'record':
     case 'trace':
       return first === 'stop';
     case 'perf':
@@ -622,27 +669,46 @@ function finishesEarlierClientCapture(req: DaemonWireRequest): boolean {
   }
 }
 
+function isRecordStop(req: DaemonWireRequest): boolean {
+  return req.comm
```

**File**: `test/integration/provider-scenarios/remote-daemon-client.test.ts` (modified, +19/-4)
```diff
@@ -47,6 +47,7 @@ type RemoteClient = ReturnType<typeof createAgentDeviceClient>;
 type RemotePaths = {
   screenshotPath: string;
   recordingPath: string;
+  cwd: string;
   localApkPath: string;
   localInstallSourcePath: string;
 };
@@ -547,10 +548,18 @@ async function assertRecordingArtifactRoundTrip(
   assert.equal(start.recording, 'started');
   assert.equal(fs.existsSync(paths.recordingPath), false);
 
+  // #4518: a remote stop never writes to the daemon's localPath echo. It lands in the client cwd
+  // under the daemon's file name and reports that fallback.
   const stop = await client.recording.record({ action: 'stop' });
   assert.equal(stop.recording, 'stopped');
-  assert.equal(stop.outPath, paths.recordingPath);
-  assert.deepEqual(fs.readFileSync(paths.recordingPath), RECORDING_BYTES);
+  const landed = path.join(paths.cwd, 'remote-recording.mp4');
+  assert.equal(stop.outPath, landed);
+  assert.deepEqual(fs.readFileSync(landed), RECORDING_BYTES);
+  assert.equal(fs.existsSync(paths.recordingPath), false);
+  assert.deepEqual(
+    (stop as { recordingDestinationWarnings?: unknown }).recordingDestinationWarnings,
+    [{ reason: 'recording_destination_not_requested', field: 'outPath', path: landed }],
+  );
 
   const recordStartRpc = rpcRequests.at(-2);
   assert.equal(recordStartRpc?.params?.command, 'record');
@@ -631,14 +640,19 @@ test('Provider-backed integration remote daemon client materializes artifacts an
     return;
   }
 
-  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-device-remote-client-'));
+  const stateDir = fs.realpathSync(
+    fs.mkdtempSync(path.join(os.tmpdir(), 'agent-device-remote-client-')),
+  );
+  const cwd = path.join(stateDir, 'cwd');
+  fs.mkdirSync(cwd);
   const screenshotPath = path.join(stateDir, 'remote-shot.png');
-  const recordingPath = path.join(stateDir, 'remote-recording.mp4');
+  const recordingPath = path.join(stateDir, 'clips', 'remote-recording.mp4');
   const localApkPath = path.join(stateDir, 'demo.apk');
   const localInstallSourcePath = path.join(stateDir, 'source.apk');
   fs.writeFileSync(localApkPath, 'fake-apk');
   fs.writeFileSync(localInstallSourcePath, 'fake-source-apk');
   const paths = {
+    cwd,
     screenshotPath,
     recordingPath,
     localApkPath,
@@ -656,6 +670,7 @@ test('Provider-backed integration remote daemon client materializes artifacts an
       daemonBaseUrl: `http://127.0.0.1:${port}`,
       daemonAuthToken: 'remote-token',
       stateDir,
+      cwd,
     });
 
     await assertScreenshotRoundTrip(client, paths, rpcRequests);
```

**File**: `test/wire-compat/ledger.json` (modified, +15/-10)
```diff
@@ -147,15 +147,15 @@
     "packages/daemon/src/server/upload-http.ts#resolveUploadHttpRoute": "sha256:d744044d036a46221c3b8220179cc30e1e66b8619a4e5cd3f7dd5f8582817aba",
     "packages/daemon/src/server/upload-http.ts#sendJson": "sha256:c2317b4b14a10731684c9160038005965856150f05f8923765a3fa833d2ecae9",
     "packages/daemon/src/server/upload-http.ts#sendUploadedArtifactResponse": "sha256:8a8873eb6437a32f7045c87a7b16226a48ff7fc4d61c5de459809e2558758768",
-    "packages/remote/src/artifact-download.ts#RemoteArtifactDownload": "sha256:6230fb1efacc0bdb7223ce4d66bc2dc754fdaca475268fe75ada0facd4e734ac",
+    "packages/remote/src/artifact-download.ts#RemoteArtifactDownload": "sha256:d3eeaf9a072123004d868a0261067456793a7121836d6f6b354fcd65aa0826bd",
     "packages/remote/src/artifact-download.ts#downloadRemoteArtifactFromUrl": "sha256:4772ec65900be31f0ac6fb889967a9f35a4a565f6bb87e72458e3ab6e54cc941",
     "packages/remote/src/daemon-artifacts.ts#DaemonArtifactEndpoint": "sha256:45226717ac52c0af2a62f74e91549582d95f4a4abc49be87989e026291a88c82",
-    "packages/remote/src/daemon-artifacts.ts#DownloadRemoteArtifactParams": "sha256:ba6d2f6ac51e05ccc5e0c940b355d62374e018b1ae6f6f744becf6e1760cbb63",
+    "packages/remote/src/daemon-artifacts.ts#DownloadRemoteArtifactParams": "sha256:bb02635a5576176a12b70c25a74a2443e0ae7344b0050dd07b153da9cbfe5ae6",
     "packages/remote/src/daemon-artifacts.ts#buildDaemonArtifactUrl": "sha256:06dcde057809b507f70f7bb5cdef9bde6515be84b67e45865cf19e70b8636208",
     "packages/remote/src/daemon-artifacts.ts#downloadRemoteArtifact": "sha256:3f3b6c01601c54ab2c76c8cb0946de623da4d24ba32254c75ae8a3993f66adcf",
     "packages/remote/src/daemon-artifacts.ts#isRemoteDaemon": "sha256:0f6a714c5f60ce4e8548d811b516d8b6241eca9f7e5414733732da395b8a00e7",
     "packages/remote/src/daemon-artifacts.ts#materializeRemoteArtifacts": "sha256:6d9aba219e6fafbdbcef76d30ed99fbb4f61dcc525242a0a76c3dc1bdacd24e2",
-    "packages/remote/src/daemon-artifacts.ts#resolveMaterializedArtifactPath": "sha256:660320cd62dfaeb4da80b86d6c072a5bcdbce3399723d43208a22d70b6e4a243",
+    "packages/remote/src/daemon-artifacts.ts#resolveMaterializedArtifactPath": "sha256:f8edfda6b7f3172392f7649ee68edd87ac1f489da57c0c0e5cb57347803bb184",
     "packages/remote/src/remote-request-diagnostics.ts#RemoteDaemonErrorPayload": "sha256:8fbcbcdf4bae7b66a08e465a72593794f36364759f18f1a814cd39dfdb76f309",
     "packages/remote/src/remote-request-diagnostics.ts#RemoteDiagnosticsEndpoint": "sha256:c1d5fe2fe90c425502cf8b7c87d6606374d6af65b4e9faf942a416f683930bdc",
     "packages/remote/src/remote-request-diagnostics.ts#buildRemoteRequestDiagnosticsUrl": "sha256:30a1a9bf0df24d3564a616699916a3bb4360c2b4d21c4ad0562fb0c1e738d0a9",
@@ -212,7 +212,7 @@
     "packages/daemon-contracts/src/daemon-resolution.ts#DAEMON_CAPABILITIES": "sha256:3478986d0e7b0e55e965c087a7b1dfd3cc018abdb372dba256cf90d27e63ed0b",
     "packages/daemon-contracts/src/daemon-resolution.ts#DaemonCapability": "sha256:2a5acf280a72e3d54c5ad7b52aece3ced37a30e4e721ef106a98e3bbd18ddbc3",
     "packages/daemon-contracts/src/daemon-resolution.ts#readDaemonCapabilities": "sha256:e410d36be74d307f7e5d8ddae63af5aae77f8eef77951ce9eeb7724f2fefae88",
-    "packages/remote/src/daemon-artifacts.ts#downloadResponseArtifacts": "sha256:bc620e6f98821fdfe7e65eb63404eb175ffd583730cb877fa5a5f9f4e80c9fe0",
+    "packages/remote/src/daemon-artifacts.ts#downloadResponseArtifacts": "sha256:aa3ea996bdd1329d88570ba87c03026946dd33f34172c0eccd5a6ac3d38e9884",
     "packages/remote/src/session-script-destination.ts#SessionScriptDelivery": "sha256:741fafbb8e2b43e2e967b2f4206f1d60017a636f63e3cde68b6258fd4efefa18",
     "packages/remote/src/script-version-publisher.ts#publishScriptVersion": "sha256:b37b9391d20f535ca9c0858f92ed37943297c7acbf1fb10f8cad5cd5b53423eb",
     "packages/remote/src/script-version-publisher.ts#PublishOutcome": "sha256:a4ae6fc3298d3c560719591372edddbfa83ce749f4cf3f3e2ed1d8369313bd2d",
@@ -499,8 +499,8 @@
     },
     {
       "declaration": "packages/remote/src/daemon-artifacts.ts#resolveMaterializedArtifactPath",
-      "digest": "sha256:660320cd62dfaeb4da80b86d6c072a5bcdbce3399723d43208a22d70b6e4a243",
-      "rationale": "The client, not the response, chooses the local download path: a destination it registered in this request wins, a response localPath is accepted only on a record or trace stop or a perf stop or report, and any other artifact lands in cwd under the basename of its fileName. A released daemon echoes localPath equal to the registered destination for screenshot and test, and echoes an earlier destination only on those stop and report actions, so its artifacts land where they did before. The wire shape is unchanged."
+      "digest": "sha256:f8edfda6b7f3172392f7649ee68edd87ac1f489da57c0c0e5cb57347803bb184",
+      "rationale": "#4518 client-side only. Remote record stop uses a destination from the current request. Without one, it uses one plain file name or a generated name in cwd. Trac
```

---

### Incident Patch 2: `4075dd11` (2026-11-21)
**Commit Message**: fix(host-kit): pin ps lstart reads to the C locale so daemon stop finds a live daemon (#4682)

* fix(host-kit): pin ps lstart reads to the C locale

ps -o lstart prints weekday and month names in the caller's locale, so a
daemon and a client under different LC_TIME compared one start time as
different lifetimes and daemon stop orphaned a live daemon on macOS.
Run the ps identity reads with LC_ALL=C and treat a C-form start time
against a localized one as unknown instead of reassigned.

Fixes #4656

* fix(host-kit): pin only lstart-bearing ps reads and keep legacy timestamps unverified

Addresses the blocking review on #4682:

- The LC_ALL=C pin now applies only to ps reads whose output carries
  lstart (HOST_PROCESS_IDENTITY_PS_ARGS sync/async and
  readProcessField('lstart=')). The pid=,command= batch read and
  readProcessField('command='/'state=') keep the caller's locale, so
  command text reads with one encoding from every host-kit caller,
  matching the unpinned listHostProcesses scan. BSD/macOS ps escapes
  non-ASCII argv bytes under LC_ALL=C (/tmp/é-ü -> /tmp/M-CM-)-M-CM-<),
  which broke managed-process ownership for non-ASCII paths.
- The pin is a final override on top of

**File**: `packages/daemon-client/src/__tests__/daemon-client-lifecycle.test.ts` (modified, +5/-4)
```diff
@@ -13,6 +13,7 @@ import {
   mkdtempForTestSync,
   startHttpDaemonFixture,
   skipWhenLoopbackUnavailable,
+  staleBirthTokenLike,
 } from '@agent-device/test-kit';
 import {
   planRegisteredDaemonLaunches,
@@ -382,10 +383,10 @@ test('daemon acquisition reclaims a proven reused owner before publication', asy
   const paths = resolveDaemonPaths(stateDir);
   const daemon = await startHttpDaemonFixture({ via: 'fresh-daemon' });
   vi.stubEnv('AGENT_DEVICE_STATE_DIR', stateDir);
-  const staleStartTime =
-    process.platform === 'linux'
-      ? 'linux:00000000-0000-0000-0000-000000000000:0'
-      : 'stale-start-time';
+  // A proven reuse needs a stale value in the same provenanced format as the live read of this
+  // pid; a raw legacy rendering would be unknown, not proof.
+  const liveStartTime = readProcessStartTime(process.pid);
+  const staleStartTime = staleBirthTokenLike(liveStartTime);
   const stale = tryAcquireProcessLock({
     lockDirPath: paths.lockPath,
     owner: { pid: process.pid, startTime: staleStartTime, acquiredAtMs: Date.now() },
```

**File**: `packages/daemon-contracts/src/daemon-process-takeover.test.ts` (modified, +74/-5)
```diff
@@ -5,7 +5,12 @@ import fs from 'node:fs';
 import os from 'node:os';
 import path from 'node:path';
 import { afterEach, test } from 'vitest';
-import { isProcessAlive, readProcessStartTime } from '@agent-device/host-kit/process';
+import {
+  isProcessAlive,
+  readProcessCommand,
+  readProcessStartTime,
+} from '@agent-device/host-kit/process';
+import { staleBirthTokenLike } from '@agent-device/test-kit';
 import { isAgentDeviceDaemonProcess, stopDaemonProcess } from './daemon-process.ts';
 
 const TAKEOVER_TIMEOUTS = { termTimeoutMs: 5_000, killTimeoutMs: 2_000 };
@@ -35,13 +40,13 @@ afterEach(async () => {
   }
 });
 
-/** A daemon entry from a branch-named checkout, whose path has no project-name marker. */
-function spawnFakeDaemonFromBranchNamedCheckout(): { pid: number; entryPath: string } {
+/** A daemon entry from a checkout under `prefix`, whose path has no project-name marker. */
+function spawnFakeDaemon(prefix: string): { pid: number; entryPath: string } {
   // Vitest redirects `os.tmpdir()` under a worktree-named run directory. Use
   // the host temp root so this path itself cannot accidentally contain the
   // project name and mask the worktree identity regression.
   const tempRoot = process.platform === 'win32' ? os.tmpdir() : '/tmp';
-  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(tempRoot, 'repair-evidence-')));
+  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(tempRoot, prefix)));
   spawnedRoots.push(root);
   const entryPath = path.join(root, 'dist', 'src', 'internal', 'daemon.js');
   fs.mkdirSync(path.dirname(entryPath), { recursive: true });
@@ -56,6 +61,11 @@ function spawnFakeDaemonFromBranchNamedCheckout(): { pid: number; entryPath: str
   return { pid, entryPath };
 }
 
+/** A daemon entry from a branch-named checkout, whose path has no project-name marker. */
+function spawnFakeDaemonFromBranchNamedCheckout(): { pid: number; entryPath: string } {
+  return spawnFakeDaemon('repair-evidence-');
+}
+
 // #1545: a reachable daemon with a code-signature mismatch is replaced. If a
 // branch-named worktree is rejected as "not ours", replacement leaves the old
 // daemon alive and the next request reaches a fresh empty session store.
@@ -96,7 +106,9 @@ test('does not stop a branch-named daemon when the pid belongs to a different pr
 
   const actualStartTime = readProcessStartTime(pid);
   assert.ok(actualStartTime, 'expected the spawned daemon to report a start time');
-  const staleStartTime = `${actualStartTime}-previous-lifetime`;
+  // A proven reuse needs a stale value in the same verified format as the live read; a legacy
+  // token would be unverified rather than proof.
+  const staleStartTime = staleBirthTokenLike(actualStartTime);
   assert.equal(isAgentDeviceDaemonProcess(pid, staleStartTime), false);
 
   const result = await stopDaemonProcess(
@@ -110,3 +122,60 @@ test('does not stop a branch-named daemon when the pid belongs to a different pr
   });
   assert.equal(isProcessAlive(pid), true);
 });
+
+// #4656: a record written before the provenance pin holds a raw `lstart` rendering — fr_FR prints
+// `mar. 17 nov. 19:42:27 2026`, locales that omit HH:mm:ss print no clock, and an earlier pinned
+// build stored the raw C form. All are unqualified, so at the daemon stop boundary they yield
+// unverified identity — never `already-exited`, and never a signal — so a live daemon is not
+// retired while it still runs.
+test.skipIf(process.platform !== 'darwin')(
+  'a legacy raw record yields unverified identity at daemon stop, not an exited daemon',
+  async () => {
+    const { pid } = spawnFakeDaemonFromBranchNamedCheckout();
+    const startTime = readProcessStartTime(pid);
+    assert.ok(startTime, 'expected the spawned daemon to report a start time');
+    assert.ok(startTime.startsWith('posix:'), `expected a posix birth token, got ${startTime}`);
+
+    for (const legacy of [
+      'mar. 17 nov. 19:42:27 2026',
+      '17 nov. 2026',
+      'Tue Nov 17 19:42:27 2026',
+    ]) {
+      const result = await stopDaemonProcess(
+        { pid, startTime: legacy },
+        { mode: 'graceful', termTimeoutMs: 200, killTimeoutMs: 100 },
+      );
+      assert.equal(result.status, 'retained', `legacy record ${legacy} must not retire the daemon`);
+      if (result.status === 'retained') {
+        assert.equal(result.reason, 'identity-unverified');
+      }
+      assert.equal(
+        isProcessAlive(pid),
+        true,
+        'no signal may reach a daemon the legacy record cannot verify',
+      );
+    }
+  },
+);
+
+test.skipIf(process.platform === 'win32')(
+  'the stop route reads a non-ASCII daemon argv as UTF-8, not as C-locale escapes',
+  async () => {
+    const { pid, entryPath } = spawnFakeDaemon('utf8-é-ü-');
+    assert.ok(entryPath.includes('é-ü'));
+
+    const command = readProcessCommand(pid);
+    assert.ok(command?.includes('é-ü'), `expected the UTF-8 argv, got ${JSON.stringify(command)}`);
+    const startTime =
```

**File**: `packages/daemon-contracts/src/daemon-registration-status.test.ts` (modified, +3/-1)
```diff
@@ -119,7 +119,9 @@ test('a record whose process is gone or was replaced is not a running daemon', (
     processStartTime:
       process.platform === 'linux'
         ? 'linux:00000000-0000-0000-0000-000000000000:0'
-        : 'Thu Jan  1 00:00:00 1970',
+        : process.platform === 'win32'
+          ? '000000000000000000000'
+          : 'posix:1000',
     plugins: [ACTIVE],
   });
   expect(readDaemonStatus(resolveDaemonPaths(stateDir)).state).toBe('stopped');
```

**File**: `packages/daemon-contracts/src/daemon-registration.test.ts` (modified, +52/-5)
```diff
@@ -7,7 +7,12 @@ import {
   readRegisteredDaemonIdentity,
   readRegisteredDaemonOwnership,
 } from './daemon-registration.ts';
-import { mkdtempForTestSync, publishDaemonRegistration } from '@agent-device/test-kit';
+import {
+  LIFETIME_TOKEN,
+  LEGACY_RAW_START_TIME,
+  mkdtempForTestSync,
+  publishDaemonRegistration,
+} from '@agent-device/test-kit';
 
 const roots: string[] = [];
 
@@ -55,14 +60,56 @@ test('a different published pid proves the owner no longer serves its state dir'
   assert.equal(isSupersededDaemonOwner({ stateDir, pid: 4141, startTime: 'owner-start' }), true);
 });
 
-test('a published start time proves supersession only when both sides are readable', () => {
+test('a published start time proves supersession only when both sides are provenanced', () => {
   const stateDir = useStateDir();
-  publishDaemonRegistration(stateDir, { pid: 4242, startTime: 'successor-start' });
-  assert.equal(isSupersededDaemonOwner({ stateDir, pid: 4242, startTime: 'owner-start' }), true);
+  // Two `posix:` tokens with different values are the same provenanced format, so the difference
+  // proves the pid changed hands.
+  publishDaemonRegistration(stateDir, { pid: 4242, startTime: 'posix:1763493001000' });
+  assert.equal(
+    isSupersededDaemonOwner({ stateDir, pid: 4242, startTime: 'posix:1763493000000' }),
+    true,
+  );
+  // Raw historical renderings — a localized one, and even the C form — are unqualified, so they
+  // are unverified, never a proved supersession.
+  assert.equal(
+    isSupersededDaemonOwner({ stateDir, pid: 4242, startTime: 'mar. 17 nov. 19:42:28 2026' }),
+    false,
+  );
+  assert.equal(
+    isSupersededDaemonOwner({ stateDir, pid: 4242, startTime: 'Tue Nov 17 19:42:27 2026' }),
+    false,
+  );
   // An unreadable start time on either side leaves the identity unproven.
   assert.equal(isSupersededDaemonOwner({ stateDir, pid: 4242, startTime: null }), false);
   publishDaemonRegistration(stateDir, { pid: 4242, startTime: null });
-  assert.equal(isSupersededDaemonOwner({ stateDir, pid: 4242, startTime: 'owner-start' }), false);
+  assert.equal(
+    isSupersededDaemonOwner({ stateDir, pid: 4242, startTime: 'posix:1763493000000' }),
+    false,
+  );
+});
+
+test('a record from an older release (a raw ps start time) is never treated as replaced', () => {
+  const stateDir = useStateDir();
+  publishDaemonRegistration(stateDir, { pid: 4242, startTime: LEGACY_RAW_START_TIME });
+
+  const identity = readRegisteredDaemonIdentity(infoPathOf(stateDir));
+  assert.equal(identity?.startTime, LEGACY_RAW_START_TIME);
+  // Raw record vs canonical live read: unknown, so not superseded — unresolved, not reassignment.
+  assert.equal(
+    isSupersededDaemonOwner({
+      stateDir,
+      pid: 4242,
+      startTime: LIFETIME_TOKEN,
+    }),
+    false,
+  );
+  assert.equal(
+    readRegisteredDaemonOwnership(infoPathOf(stateDir), {
+      pid: 4242,
+      startTime: LIFETIME_TOKEN,
+    }).state,
+    'unproven',
+  );
 });
 
 test('the published owner itself is never superseded, and absence is not proof', () => {
```

**File**: `packages/daemon-contracts/src/device-claim-settlement.test.ts` (modified, +6/-3)
```diff
@@ -246,7 +246,7 @@ test('a renewal through a migrated record’s own token writes back the shape th
       workspace: '/worktrees/legacy',
       stateDir: root,
       ownerPid: process.pid,
-      ownerStartTime: 'test-process-start-time',
+      ownerStartTime: 'Tue Nov 17 19:42:27 2026',
       ownerToken: 'legacy-token',
       createdAtMs: 1,
       updatedAtMs: 1,
@@ -258,7 +258,7 @@ test('a renewal through a migrated record’s own token writes back the shape th
       deviceKey: canonicalLocalDeviceKey(device),
       ownerToken: 'legacy-token',
       ownerPid: process.pid,
-      ownerStartTime: 'test-process-start-time',
+      ownerStartTime: 'Tue Nov 17 19:42:27 2026',
     },
     process.env,
   );
@@ -380,7 +380,10 @@ test('PID reuse is uncertain ownership and never authorizes reconciliation', asy
     stateDir: root,
   });
   const stored = JSON.parse(fs.readFileSync(claimPath(root), 'utf8')) as Record<string, unknown>;
-  fs.writeFileSync(claimPath(root), JSON.stringify({ ...stored, ownerStartTime: 'other-start' }));
+  fs.writeFileSync(
+    claimPath(root),
+    JSON.stringify({ ...stored, ownerStartTime: 'posix:1763493001000' }),
+  );
   const reconcile = vi.fn(async () => ({ status: 'reconciled' as const }));
 
   const result = await acquireDeviceClaim({
```

**File**: `packages/daemon/src/resources/device/__tests__/device-claims.test.ts` (modified, +6/-2)
```diff
@@ -681,8 +681,12 @@ test('release names the exact refusal for uncertain owners and misnamed claim fi
   });
   assert.equal(acquired.status, 'acquired');
   const stored = JSON.parse(fs.readFileSync(claimPath(root), 'utf8')) as Record<string, unknown>;
-  // Same PID, different recorded start time: PID reuse, uncertain ownership.
-  fs.writeFileSync(claimPath(root), JSON.stringify({ ...stored, ownerStartTime: 'other-start' }));
+  // Same PID, different recorded start time in the same provenanced format: PID reuse,
+  // uncertain ownership. A raw legacy rendering would be unverified, not reuse.
+  fs.writeFileSync(
+    claimPath(root),
+    JSON.stringify({ ...stored, ownerStartTime: 'posix:1763493001000' }),
+  );
   // A dead-owner claim stored under a name that is not the hash of its own
   // device key: the claim lock protects a different path, so release refuses.
   fs.writeFileSync(
```

**File**: `packages/daemon/src/server/http/daemon-metadata-loss.test.ts` (modified, +19/-9)
```diff
@@ -11,7 +11,8 @@ import {
 
 const OWN_PID = process.pid;
 const FOREIGN_PID = 999_999_999;
-const OWN = { pid: OWN_PID, startTime: 'own-start' } as const;
+// A provenanced POSIX birth token: the verified format, so a different token proves a recycle.
+const OWN = { pid: OWN_PID, startTime: 'posix:1763493000000' } as const;
 
 function scratch(): { stateDir: string; infoPath: string } {
   const stateDir = mkdtempForTestSync('agent-device-daemon-metadata-loss-');
@@ -25,7 +26,7 @@ function publish(stateDir: string, pid: number, startTime: string | null): void
 describe('readDaemonMetadataLoss', () => {
   test('a registration naming this daemon is not a loss', () => {
     const { stateDir, infoPath } = scratch();
-    publish(stateDir, OWN_PID, 'own-start');
+    publish(stateDir, OWN_PID, OWN.startTime);
 
     assert.equal(readDaemonMetadataLoss({ infoPath, stateDir, owner: OWN }), undefined);
   });
@@ -42,7 +43,7 @@ describe('readDaemonMetadataLoss', () => {
 
   test('a record recycling this pid under a different start time is a loss', () => {
     const { stateDir, infoPath } = scratch();
-    publish(stateDir, OWN_PID, 'recycled-start');
+    publish(stateDir, OWN_PID, 'posix:1763493001000');
 
     assert.deepEqual(readDaemonMetadataLoss({ infoPath, stateDir, owner: OWN }), {
       state: 'replaced',
@@ -52,7 +53,7 @@ describe('readDaemonMetadataLoss', () => {
 
   test('a registration deleted while the state dir stands is an absent loss', () => {
     const { stateDir, infoPath } = scratch();
-    publish(stateDir, OWN_PID, 'own-start');
+    publish(stateDir, OWN_PID, OWN.startTime);
     fs.rmSync(infoPath);
 
     assert.deepEqual(readDaemonMetadataLoss({ infoPath, stateDir, owner: OWN }), {
@@ -63,7 +64,7 @@ describe('readDaemonMetadataLoss', () => {
   test('a state dir that was pruned away entirely is not a loss this daemon should report', () => {
     // Reporting one would write a `daemon.log` back into the directory the operator just removed.
     const { stateDir, infoPath } = scratch();
-    publish(stateDir, OWN_PID, 'own-start');
+    publish(stateDir, OWN_PID, OWN.startTime);
     fs.rmSync(stateDir, { recursive: true, force: true });
 
     assert.equal(readDaemonMetadataLoss({ infoPath, stateDir, owner: OWN }), undefined);
@@ -74,7 +75,7 @@ describe('readDaemonMetadataLoss', () => {
     () => {
       // A root-owned CI host reads mode 000 anyway, so the case only binds as a non-root process.
       const { stateDir, infoPath } = scratch();
-      publish(stateDir, OWN_PID, 'own-start');
+      publish(stateDir, OWN_PID, OWN.startTime);
       fs.chmodSync(infoPath, 0o000);
       try {
         assert.equal(readDaemonMetadataLoss({ infoPath, stateDir, owner: OWN }), undefined);
@@ -94,6 +95,15 @@ describe('readDaemonMetadataLoss', () => {
     assert.equal(readDaemonMetadataLoss({ infoPath, stateDir, owner: OWN }), undefined);
   });
 
+  test('a legacy raw record under this pid is unverified, not a reported loss', () => {
+    // A record written before the provenance pin holds a raw `lstart` rendering, which cannot
+    // prove a different lifetime, so the daemon does not announce a takeover on it.
+    const { stateDir, infoPath } = scratch();
+    publish(stateDir, OWN_PID, 'Tue Nov 17 19:42:27 2026');
+
+    assert.equal(readDaemonMetadataLoss({ infoPath, stateDir, owner: OWN }), undefined);
+  });
+
   test('a corrupt record is not evidence that the registration was taken', () => {
     const { stateDir, infoPath } = scratch();
     fs.writeFileSync(infoPath, '{not json');
@@ -123,7 +133,7 @@ describe('watchDaemonMetadataLoss', () => {
     vi.useFakeTimers();
     try {
       const { stateDir, infoPath } = scratch();
-      publish(stateDir, OWN_PID, 'own-start');
+      publish(stateDir, OWN_PID, OWN.startTime);
       const watch = startWatch(stateDir, infoPath);
       try {
         watch.advance();
@@ -145,7 +155,7 @@ describe('watchDaemonMetadataLoss', () => {
     vi.useFakeTimers();
     try {
       const { stateDir, infoPath } = scratch();
-      publish(stateDir, OWN_PID, 'own-start');
+      publish(stateDir, OWN_PID, OWN.startTime);
       const watch = startWatch(stateDir, infoPath);
 
       fs.rmSync(stateDir, { recursive: true, force: true });
@@ -167,7 +177,7 @@ describe('watchDaemonMetadataLoss', () => {
     vi.useFakeTimers();
     try {
       const { stateDir, infoPath } = scratch();
-      publish(stateDir, OWN_PID, 'own-start');
+      publish(stateDir, OWN_PID, OWN.startTime);
       const watch = startWatch(stateDir, infoPath);
       watch.cancel();
       watch.cancel();
```

**File**: `packages/host-kit/src/internal/exec.test.ts` (modified, +25/-0)
```diff
@@ -319,6 +319,31 @@ test('a request command env reaches spawned commands; outside it they inherit th
   assert.equal(hostOnly.stdout, '/daemon/Developer');
 });
 
+const PRINT_TZ_AND_LOCALE = [
+  '-e',
+  'process.stdout.write(`${process.env.TZ ?? ""}|${process.env.LC_ALL ?? ""}`)',
+];
+
+test('envOverrides are the final word over the bound host environment, keeping TZ under a locale pin', async () => {
+  // Overrides merge over the effective child env instead of replacing it, so an `LC_ALL=C` pin
+  // alone still lets `TZ` through; the lstart probe itself pins `TZ=UTC` on top (host-process).
+  const host = hostWith({ TZ: 'Pacific/Kiritimati' });
+  const [pinned, requestEnvOverridden] = await Promise.all([
+    withCommandHost({ host, requestEnv: undefined }, async () =>
+      runCmd(process.execPath, PRINT_TZ_AND_LOCALE, { envOverrides: { LC_ALL: 'C' } }),
+    ),
+    withCommandHost({ host, requestEnv: { LC_ALL: 'fr_FR.UTF-8' } }, async () =>
+      runCmd(process.execPath, PRINT_TZ_AND_LOCALE, { envOverrides: { LC_ALL: 'C' } }),
+    ),
+  ]);
+  assert.equal(pinned.stdout, 'Pacific/Kiritimati|C');
+  assert.equal(
+    requestEnvOverridden.stdout,
+    'Pacific/Kiritimati|C',
+    'the override is the final word, ahead of the request env too',
+  );
+});
+
 test.runIf(process.platform !== 'win32')(
   'xcrun tool-not-found failures name the developer dir and how to change it',
   async () => {
```

---

### Incident Patch 3: `b233d672` (2026-11-21)
**Commit Message**: fix(daemon-client): bound the judge-again loop on a clock, not on a wait count (#4899)

`ENSURE_ATTEMPTS` divided the teardown grace by the judge-again delay, so a contended
`ensureDaemon` always ran 300 judgements. A wait count understates what the call can
spend: the work inside a judgement is not waited for, so a state directory another
process keeps replacing held the call for 300 judgements plus what each judgement cost.
The budget is now one teardown grace of elapsed time on the monotonic clock the
package's other budgets use, each wait clamped to what is left; one grace of waits
backstops the deadline, which a clock that stops cannot pass.

`daemon-client-ensure-explicit-lifecycle.test.ts` mocked `sleep` and still ran those 300
iterations of real work, which is what pushed it past the test timeout on a busy host. It
now moves the budget clock, as the startup-budget and drain suites move theirs, so the
grace passes in five judgements. Production timing is unchanged, and the waits are still
asked for at the production cadence, so the budget assertion pins it.

**File**: `packages/daemon-client/src/__tests__/daemon-client-ensure-explicit-lifecycle.test.ts` (modified, +46/-17)
```diff
@@ -39,9 +39,9 @@ vi.mock('@agent-device/host-kit/retry', async (importOriginal) => ({
   sleep: vi.fn(async () => {}),
 }));
 // Reading the registration judges its lock owner, and one judgement runs one process-table snapshot.
-// The contention budget is 300 judgements of a registration that does not change under the client,
-// so its inspection is read once from the real host and replayed for the rest of the loop. The seam
-// answers only that one lock path, and `afterEach` clears it.
+// A contention budget judges a registration these cases keep alive and unchanged, so its inspection is
+// read once from the real host and replayed for the rest of the loop. The seam answers only that one
+// lock path, and `afterEach` clears it.
 let recordedRegistrationLock:
   | { readonly lockPath: string; readonly inspection: ProcessLockInspection }
   | undefined;
@@ -69,6 +69,10 @@ const spawn = vi.mocked(runCmdDetachedMonitored);
 const actualRetry = await vi.importActual<typeof import('@agent-device/host-kit/retry')>(
   '@agent-device/host-kit/retry',
 );
+// `JUDGE_AGAIN_DELAY_MS` in `daemon-client-ensure.ts`.
+const JUDGE_AGAIN_DELAY_MS = 250;
+// Held before any test replaces `performance.now`, so a moved clock still starts from real elapsed time.
+const realNow = performance.now.bind(performance);
 
 afterEach(async () => {
   vi.restoreAllMocks();
@@ -83,8 +87,8 @@ afterEach(async () => {
 /**
  * Leaves the lock inspection of this registration at what the host really says right now. A daemon
  * that keeps changing under `ensureDaemon` is judged once per attempt and one judgement runs one
- * process-table snapshot, so a full budget is 300 snapshots of a registration these cases keep
- * alive and unchanged. The first snapshot is the host's own answer, taken here.
+ * process-table snapshot, so the whole budget is snapshots of a registration these cases keep alive
+ * and unchanged. The first snapshot is the host's own answer, taken here.
  */
 function registrationLockStaysAsRecorded(
   paths: ReturnType<typeof stateDirAndPaths>['paths'],
@@ -98,20 +102,43 @@ function registrationLockStaysAsRecorded(
 }
 
 /**
- * The attempt budget, through the waits it asks for: the judge-again waits must just cover the
- * teardown grace, so one fewer wait falls short of it. Halving the loop halves this total.
+ * The budget clock, moved by this file: every wait advances it by `stepMs` while the loop keeps asking
+ * for its own delay, so the teardown grace passes in a few judgements instead of the hundreds it costs
+ * at the real cadence. The loop reads `performance.now()`, the clock this package budgets on, and it is
+ * a per-test spy rather than `Date.now`: lock-guard ages are judged off real file mtimes and `Date.now`
+ * in the same window.
  */
-function assertJudgedAgainForTheFullBudget(): void {
+function judgeAgainBudgetOnMovedClock(stepMs: number): { waitedMs(): number } {
+  const startedAtMs = realNow();
+  let waitedMs = 0;
+  vi.spyOn(performance, 'now').mockImplementation(() => startedAtMs + waitedMs);
+  vi.mocked(sleep).mockImplementation(async () => {
+    waitedMs += stepMs;
+  });
+  return { waitedMs: () => waitedMs };
+}
+
+/**
+ * The budget, through the clock it counts: every wait is asked for at the production cadence, and the
+ * loop stopped once that cadence had covered the teardown grace on the clock it reads — one fewer wait
+ * falls short of it. Halving the grace or the cadence stops the loop earlier and fails this.
+ */
+function assertJudgedAgainForTheFullBudget(clock: { waitedMs(): number }, stepMs: number): void {
   const waits = vi.mocked(sleep).mock.calls.map(([ms]) => Number(ms));
   assert.ok(waits.length > 0, 'a contended ensure judged again at least once');
-  const delays = [...new Set(waits)];
-  assert.equal(delays.length, 1, `every attempt judged again with one delay, saw ${delays}`);
-  const [delay] = delays;
-  assert.ok(delay !== undefined && delay > 0, `a judge-again wait must be positive, saw ${delay}`);
-  const totalMs = waits.reduce((total, ms) => total + ms, 0);
+  assert.deepEqual(
+    [...new Set(waits)],
+    [JUDGE_AGAIN_DELAY_MS],
+    'every attempt judged again after one production wait, whatever the clock says since',
+  );
+  const { waitedMs } = clock;
+  assert.ok(
+    waitedMs() >= DAEMON_TEARDOWN_GRACE_MS && waitedMs() - stepMs < DAEMON_TEARDOWN_GRACE_MS,
+    `${waits.length} judge-again waits must just cover the ${DAEMON_TEARDOWN_GRACE_MS}ms teardown grace (${waitedMs()}ms)`,
+  );
   assert.ok(
-    totalMs >= DAEMON_TEARDOWN_GRACE_MS && totalMs - delay < DAEMON_TEARDOWN_GRACE_MS,
-    `${waits.length} judge-again waits of ${delay}ms must just cover the ${DAEMON_TEARDOWN_GRACE_MS}ms teardown grace (${totalMs}ms)`,
+    waits.length < Math.ceil(DAEMON_TEARDOWN_GRACE_MS / JUDGE_AGAIN_DELAY_MS),
+    `the clock, not the wait ceiling, ended the loop: ${waits.length} waits`,
   );
 }
 
@@ -608,14 +635,15 @@ test('ensureDaemon reports contentio
```

**File**: `packages/daemon-client/src/daemon-client-ensure.ts` (modified, +19/-14)
```diff
@@ -36,10 +36,6 @@ import {
 // a daemon this call quiesced can still be leaving. A judgement that went stale is made again after
 // a short wait, for as long as a drain can take.
 const JUDGE_AGAIN_DELAY_MS = 250;
-// The budget is counted in waits, not on a clock: each attempt that judges again waits once, so the
-// waits alone add up to the teardown grace. The work inside an attempt is not counted, so a state
-// directory that another process keeps replacing can hold this call for longer.
-const ENSURE_ATTEMPTS = Math.ceil(DAEMON_TEARDOWN_GRACE_MS / JUDGE_AGAIN_DELAY_MS);
 const DRAIN_POLL_MS = 250;
 
 type EnsureStep =
@@ -61,18 +57,27 @@ export async function ensureDaemon(
   host: HostEnvironment = captureHostEnvironment(process),
 ): Promise<DaemonConnection> {
   const settings = resolveLocalDaemonSettings(options, host);
-  for (let attempt = 1; attempt <= ENSURE_ATTEMPTS; attempt += 1) {
+  // The budget is one teardown grace of elapsed time: a state directory another process keeps
+  // replacing holds this call for the grace, not for a grace of judgements plus what each judgement
+  // cost. `maxWaits` backstops the deadline, which cannot end the loop on a clock that stops. The
+  // deadline is monotonic, like the transport and lifecycle budgets: a wall-clock step would shorten
+  // the grace, and `sleep` itself counts waiting monotonically.
+  const deadlineAtMs = performance.now() + DAEMON_TEARDOWN_GRACE_MS;
+  const maxWaits = Math.ceil(DAEMON_TEARDOWN_GRACE_MS / JUDGE_AGAIN_DELAY_MS);
+  for (let waits = 0; ; waits += 1) {
     const step = await ensureOnce(settings, options.onStart);
-    if (step.kind === 'judge-again') {
-      await sleep(JUDGE_AGAIN_DELAY_MS);
-      continue;
+    if (step.kind === 'connected') {
+      await assertDaemonPolicyMatches(step.daemon.info, settings.paths.baseDir, host);
+      return {
+        stateDir: settings.paths.baseDir,
+        daemon: daemonIdentityOf(step.daemon.info),
+        started: step.started,
+      };
     }
-    await assertDaemonPolicyMatches(step.daemon.info, settings.paths.baseDir, host);
-    return {
-      stateDir: settings.paths.baseDir,
-      daemon: daemonIdentityOf(step.daemon.info),
-      started: step.started,
-    };
+    if (waits >= maxWaits) break;
+    const remainingMs = deadlineAtMs - performance.now();
+    if (remainingMs <= 0) break;
+    await sleep(Math.min(JUDGE_AGAIN_DELAY_MS, remainingMs));
   }
   throw new AppError('COMMAND_FAILED', 'The daemon kept changing while it was being ensured.', {
     reason: 'daemon-lifecycle-contended',
```

#### Recent Merged Pull Requests:
- **PR #4926** (2026-11-21): fix(harmonyos): label snapshot nodes with their visible text (@thymikee)
- **PR #4924** (2026-11-21): refactor(reasons): declare the R3 platform-apple reasons in ReasonTable rows (@thymikee)
- **PR #4918** (2026-11-21): chore(release): publish the managed platform plugins (@thymikee)
- **PR #4915** (2026-11-21): docs(commands): regenerate the close --shutdown help row (@thymikee)
- **PR #4904** (2026-11-21): refactor(reasons): declare published reasons in ReasonTable rows beside their classifiers (@thymikee)
- **PR #4902** (2026-11-21): fix(android): end close once the pre-close processes are gone (@thymikee)

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

## X. remote): write record stop output only to request-named destinations

**RULE**:
When implementing operations in `docs/agents/security.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `64d7fc75`: remote): write record stop output only to request-named destinations. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/agents/security.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
Scripts and remote record stop reject daemon paths (#4518). Trace and perf take them.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
Script publication takes no path from the daemon. Capture delivery still can (#4518).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `64d7fc75` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
