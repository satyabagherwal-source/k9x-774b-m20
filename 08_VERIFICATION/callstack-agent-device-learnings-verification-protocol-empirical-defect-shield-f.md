# Verification Protocol: Verification Protocol: Empirical Defect Shield for callstack-agent-device-learnings

<!-- PROVENANCE_START
{
  "source_repository": "callstack-agent-device-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T04:18:37.695Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-callstack-agent-device-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack-agent-device-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T04:18:37.695Z`  
> **Learning ID**: `LEARN-EVO-callstack-agent-device-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `callstack-agent-device-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source**: github ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Source Version**: `3e0814c5`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T04:18:22.603Z  
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
> **Harvest Timestamp**: 2026-11-27T04:18:22.596Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Open source device layer for AI coding agents: a CLI, MCP server, and typed Node.js API to control mobile, web, TV, and desktop apps on devices and simulators, locally or in the cloud.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5524 stars

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
import { splitRecordedRefGenerationSuffix } from '@agent-device/kernel/snapshot';

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
 * #1076 versioned refs: a recorded ref positional may carry a generation pin
 * (`@e12-s3`, or the retired whole-token `@e12~s3` spelling from a script saved
 * before the pin separator changed). Generations are meaningless
 * outside the session that minted them — a replayed script runs against a NEW
 * session with its own generation counter — so replay parsing and script
 * writing strip well-formed suffixes and IGNORE the generation instead of
 * re-validating it (which would only produce spurious staleness warnings).
 * Malformed suffixes are left untouched; they were never minted by us and the
 * daemon owns rejecting them.
 */
export function stripRecordedRefGeneration(token: string): string {
  if (!token.startsWith('@')) return token;
  const split = splitRecordedRefGenerationSuffix(token);
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
    const values = action.positionals.map((value) => formatScriptArg(value));
    return [action.command, ...values].join(' ');
  }
  const targetTokens = divergenceTypingTargetTokens(action);
  const targetLabel = targetTokens.map((value) => formatScriptArg(value)).join(' ');
  return [action.command, targetLabel, '<text>'].filter((part) => part.length > 0).join(' ');
}

/**
 * The identifying (non-text) posi
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
  type ReasonTable,
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

const RUNNER_PREPARE_REASONS = {
  // `prepare ios-runner` ran out of its deadline before the named `details.phase` began.
  deadlineExpired: { reason: 'prepare_deadline_expired' },
  // The cached runner failed its health check, and the rebuilt runner failed it too;
  // `details.rebuiltFailureMessage` says how.
  rebuiltRunnerUnhealthy: { reason: 'prepare_rebuilt_runner_unhealthy' },
} as const satisfies ReasonTable<'prepare'>;

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
  } catch (err
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
- **Issue #5074** (2026-11-26): **iOS simulator: refuse notifications permission with a hint to alert accept|dismiss**
  *Symptoms*: ## Problem  On an iOS simulator, `settings permission grant|deny|reset notifications` sends `simctl privacy <udid> <action> notifications <bundle>`. `simctl privacy` does not list a `notifications` service, so the call fails and `isIosPrivacyServiceRefusal` classifies the failure as a refusal.  - Service map: `packages/platform-apple/src/core/simctl-settings.ts:75` maps `notifications` to `'notifications'`. - Refusal hint: `packages/platform-apple/src/core/simctl-settings.ts:255-258` tells the user to use the `all` target. For notifications, `all` cannot help either.  The working path is to answer the notification prompt with `alert accept` or `alert dismiss`. That path works on local simulators, physical iOS devices and Limrun. The refusal does not name it.  Context: #5046 and #4668 (closed as not planned for core).  ## Required behavior  - An iOS simulator request for the `notifications` permission refuses before it calls `simctl`. - The refusal has its own typed reason, for example `ios-notification-permission-unsupported`. - The hint tells the user to answer the prompt with `alert accept` or `alert dismiss`. - The settings catalog help and the user docs for permissions say the same. - Other permission targets and other platforms do not change.  ## Verification  - A unit test for the iOS simulator settings plan shows that `notifications` refuses with the new reason and hint, and that no `simctl` call is made. - The docs and help text name `alert accept|dismiss` for notific
  **Post-Mortem & Fix Analysis**:
  > ## Apex Sentinel · Issue review  **Suggested label:** `bug`  The issue reports that `settings permission ... notifications` calls `simctl privacy ... notifications` on iOS, but `simctl privacy` does not support a notifications service, causing the failure to be classified as a refusal instead of an unsupported/need-alert flow. It also specifies concrete file locations, a typed refusal reason, hint text, docs, and verification, so a maintainer can act on it.  ### Required sections - [ ] Steps to reproduce (missing) - [ ] Expected and actual behavior (missing) - [ ] Version or environment (missing)  <!-- apex-sentinel:issue-review -->

- **Issue #5023** (2026-11-24): **iOS Duo: press/scroll/longpress fail with APP_SCREEN_WINDOW_UNRESOLVED on a deep AX tree**
  *Symptoms*: > Written by an AI agent on behalf of @Elehiggle.  ### Problem  On the iPhone Duo simulator, gestures fail without dispatching when the AX tree is deep enough that XCTest rejects the app root. On the test app's heavy feed, `press 'id="heavy-post-0-like"' --json` returns (trimmed):  ```json {   "code": "COMMAND_FAILED",   "message": "Neither the target app nor the system surface resolved a window, so no display could be named.",   "hint": "The capture follows the display that owns a window, so this is a runtime that is answering no window for any process; runner.log names the window frame and the query answer it refused.",   "details": { "runnerErrorCode": "APP_SCREEN_WINDOW_UNRESOLVED", "dispatched": "no" } } ```  `get text` still reads the screen. In the runner log, XCTest rejects the app's tree right before the lit-panel walk reports an empty window list:  ``` AGENT_DEVICE_RUNNER_COMMAND_ACCEPTED command=tap AGENT_DEVICE_RUNNER_AX_SNAPSHOT_ISSUE_SUPPRESSED count=4 description=Failed to resolve query: Error kAXErrorIllegalArgument getting snapshot for element <AXUIElementRef …> {pid=<app>} {uid=[ID:1 hash:0x0]} AGENT_DEVICE_RUNNER_LIT_PANEL_WINDOW lit=1(466x678) windows=0 outcome=no resolved application window frame=(inf,inf 0x0) AGENT_DEVICE_RUNNER_COMMAND_COMPLETED command=tap  ok=0 ```  Before the feed opened, the same walk found `windows=2` on the Settings screen.  From reading main (not traced at runtime): `RunnerCopyWindowList` returns nil when the query throws or retu

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

### Incident Patch 1: `2d29b6d6` (2026-11-26)
**Commit Message**: fix(daemon-client): name a sandbox-denied connect and leave that daemon alone (#5095)

* fix(daemon-client): name a sandbox-denied connect and leave that daemon alone

A reachability probe answered a boolean, so a loopback connect the host
refused (EPERM or EACCES under a sandbox around the client) read exactly like a
daemon that answers nothing. The client then judged a healthy daemon dead and
tried to replace it, and reported "Daemon replacement could not be confirmed."
The replacement attempt could also kill the daemon it could not reach.

Probes now answer a verdict, and a refusal carried by EPERM or EACCES is a
denial, not an answer about the daemon. The takeover ladder answers a new
connectDenied decision for it, and every client that hears it throws
details.reason daemon-connect-denied with the errno, transport, port, and daemon
identity, plus the host-access hint the denied listen already used. Nothing is
spawned, retired, or signaled on that answer.

The probe layer moves to daemon-client-loopback-probe.ts, which owns the
denial set, so the transport module stays under the lint file-size limit.

* fix(daemon-client): leave a daemon alone on every refused connect

A host-de

**File**: `packages/daemon-client/src/__tests__/daemon-client-ensure-drain.test.ts` (modified, +41/-0)
```diff
@@ -287,6 +287,47 @@ test('a daemon still running past the deadline that answers a probe is left alon
   }
 });
 
+// The escalation route: a daemon still running at the drain deadline that answers no probe gets force
+// retired. A connect the HOST refused is not a missed probe, so this route names the sandbox instead.
+test('a drain that outlives the deadline with a probe the host refused signals nothing', async (t) => {
+  if (!(await withLoopback(t))) return;
+  const { stateDir, paths } = stateDirAndPaths();
+  let childPid = 0;
+  const drain = installVirtualDrain(() => childPid);
+  const stale = await startScriptedDaemon(draining, {
+    afterRpc: () => {
+      drain.begin(undefined);
+      void closeLoopbackServer(stale.server);
+    },
+  });
+  const { child } = await registerDaemon(paths, {
+    httpPort: stale.port,
+    version: '0.0.0-stale',
+    capabilities: ['quiesce'],
+  });
+  childPid = child.pid;
+  const liveness = await import('../daemon-client-liveness-probe.ts');
+  vi.spyOn(liveness, 'answersLivenessProbe').mockResolvedValue({
+    reachable: false,
+    denial: { errno: 'EPERM', transport: 'socket', port: stale.port },
+  });
+
+  try {
+    await assert.rejects(ensureDaemon({ stateDir, daemonTransport: 'http' }), (error: unknown) => {
+      assert.ok(error instanceof AppError);
+      assert.equal(error.details?.reason, 'daemon-connect-denied');
+      assert.equal(error.details?.errno, 'EPERM');
+      return true;
+    });
+
+    assert.deepEqual(drain.signals, []);
+    assert.equal(isProcessAlive(childPid), true);
+    assert.equal(spawn.mock.calls.length, 0);
+  } finally {
+    drain.end();
+  }
+});
+
 test('an embedded host that outlives the deadline and answers no probe is never signaled', async (t) => {
   if (!(await withLoopback(t))) return;
   const { stateDir, paths } = stateDirAndPaths();
```

**File**: `packages/daemon-client/src/__tests__/daemon-client-ensure-explicit-lifecycle.test.ts` (modified, +35/-0)
```diff
@@ -564,6 +564,41 @@ test('ensureDaemon retires a daemon that timed out on quiesce and answers no liv
   }
 });
 
+// The route that force-retires a daemon which timed out on quiesce and answered no probe. A connect
+// the HOST refused is not a missed probe, so this daemon is neither retired nor spawned over.
+test('ensureDaemon reports a host denial instead of retiring a daemon whose quiesce timed out', async (t) => {
+  if (!(await withLoopback(t))) return;
+  const { stateDir, paths } = stateDirAndPaths();
+  const stale = await startScriptedDaemon(okResult({}));
+  const { child } = await registerDaemon(paths, {
+    httpPort: stale.port,
+    version: '0.0.0-stale',
+    capabilities: ['quiesce'],
+  });
+  vi.spyOn(transport, 'sendRequest').mockRejectedValueOnce(
+    new AppError('COMMAND_FAILED', 'Daemon request timed out', {
+      reason: 'daemon_transport_timeout',
+    }),
+  );
+  const liveness = await import('../daemon-client-liveness-probe.ts');
+  vi.spyOn(liveness, 'answersLivenessProbe').mockResolvedValue({
+    reachable: false,
+    denial: { errno: 'EPERM', transport: 'socket', port: stale.port },
+  });
+
+  try {
+    const error = await failureOf(ensureDaemon({ stateDir, daemonTransport: 'http' }));
+
+    assert.equal(error.details?.reason, 'daemon-connect-denied');
+    assert.equal(error.details?.errno, 'EPERM');
+    assert.match(String(error.details?.hint), /A sandbox around this command/);
+    assert.equal(isProcessAlive(child.pid), true, 'a refused probe authorizes no signal');
+    assert.equal(spawn.mock.calls.length, 0, 'a daemon this client cannot see is not replaced');
+  } finally {
+    await closeLoopbackServer(stale.server);
+  }
+});
+
 test('ensureDaemon keeps a daemon that timed out on quiesce but still answers a probe', async (t) => {
   if (!(await withLoopback(t))) return;
   const { stateDir, paths } = stateDirAndPaths();
```

**File**: `packages/daemon-client/src/__tests__/daemon-client-liveness-probe.test.ts` (modified, +48/-10)
```diff
@@ -6,9 +6,10 @@
 // absolute deadline exist for) spend wall-clock, and each stays inside the unit budget.
 
 import net from 'node:net';
+import EventEmitter from 'node:events';
 import http from 'node:http';
 import assert from 'node:assert/strict';
-import { test } from 'vitest';
+import { test, vi } from 'vitest';
 
 import { PUBLIC_COMMANDS } from '@agent-device/command-registry/catalog';
 import { resolveCommandTimeoutPolicy } from '@agent-device/command-registry/registry';
@@ -73,7 +74,7 @@ test('a daemon answering /health is responsive', async (t) => {
     res.end('{}');
   });
   await withLoopback(server, async (port) => {
-    assert.equal(await probeDaemonResponsive(daemonInfo({ httpPort: port })), true);
+    assert.equal((await probeDaemonResponsive(daemonInfo({ httpPort: port }))).reachable, true);
     assert.deepEqual(requestedUrls, ['/health']);
   });
 });
@@ -89,7 +90,7 @@ test('a 5xx answer is still an answer: the finding is liveness, not reachability
     res.end('overloaded');
   });
   await withLoopback(server, async (port) => {
-    assert.equal(await probeDaemonResponsive(daemonInfo({ httpPort: port })), true);
+    assert.equal((await probeDaemonResponsive(daemonInfo({ httpPort: port }))).reachable, true);
   });
 });
 
@@ -110,7 +111,7 @@ test('headers alone answer: a daemon that stalls mid-body is still served', asyn
   await withLoopback(stallingBodyServer, async (port) => {
     const startedAt = Date.now();
     assert.equal(
-      await probeDaemonResponsive(daemonInfo({ httpPort: port })),
+      (await probeDaemonResponsive(daemonInfo({ httpPort: port }))).reachable,
       true,
       'a stalled body must not be read as an unresponsive daemon',
     );
@@ -158,7 +159,7 @@ test('the health leg rides a fresh connection, never the keep-alive pool', async
       request.end();
     });
     assert.equal(clientSockets.size, 1, 'the prime must have connected');
-    assert.equal(await probeDaemonResponsive(daemonInfo({ httpPort: port })), true);
+    assert.equal((await probeDaemonResponsive(daemonInfo({ httpPort: port }))).reachable, true);
     assert.equal(probeRequests, 1, 'the health leg must actually have been asked');
     assert.equal(
       clientSockets.size,
@@ -179,14 +180,44 @@ test('a refused endpoint is negative, not a hang: the verdict arrives well insid
   });
   await withLoopback(server, async (port) => {
     const startedAt = Date.now();
-    assert.equal(await probeDaemonResponsive(daemonInfo({ port })), false);
+    assert.equal((await probeDaemonResponsive(daemonInfo({ port }))).reachable, false);
     assert.ok(
       Date.now() - startedAt < LIVENESS_PROBE_BUDGET_MS / 2,
       'refusal must settle the probe immediately, not by spending the window',
     );
   });
 });
 
+// The verdict that authorizes a reset. A connect the HOST refused (EPERM or EACCES under a sandbox
+// around this client) is not a missed probe: read as silence it would SIGKILL a daemon only this
+// client's sandbox cannot reach, which is the same mistake #3177 removed for a live peer.
+test.for(['EPERM', 'EACCES'] as const)(
+  'a %s refusal is reported as a denial, not as an unresponsive daemon',
+  async (code) => {
+    const socket = Object.assign(new EventEmitter(), {
+      destroy: () => {},
+      setEncoding: () => {},
+      setTimeout: () => socket,
+      write: () => {},
+    });
+    const createConnection = vi.spyOn(net, 'createConnection').mockImplementation(((
+      _options: unknown,
+      _listener?: () => void,
+    ) => {
+      setImmediate(() => socket.emit('error', Object.assign(new Error(code), { code })));
+      return socket;
+    }) as unknown as typeof net.createConnection);
+    try {
+      assert.deepEqual(await probeDaemonResponsive(daemonInfo({ port: 65_530 })), {
+        reachable: false,
+        denial: { errno: code, transport: 'socket', port: 65_530 },
+      });
+    } finally {
+      createConnection.mockRestore();
+    }
+  },
+);
+
 test('a silent HTTP leg cannot veto a live socket leg', async (t) => {
   if (await skipWhenLoopbackUnavailable(t)) return;
   // The regression the concurrent-legs design exists for: sequential probing lets the first
@@ -222,7 +253,7 @@ test('a silent HTTP leg cannot veto a live socket leg', async (t) => {
     await withLoopback(liveSocketServer, async (port) => {
       const startedAt = Date.now();
       assert.equal(
-        await probeDaemonResponsive(daemonInfo({ port, httpPort })),
+        (await probeDaemonResponsive(daemonInfo({ port, httpPort }))).reachable,
         true,
         'the socket answer alone is the finding; the silent HTTP leg must not outweigh it',
       );
@@ -252,7 +283,11 @@ async function expectMalformedLegAnswersNotThisOne(
     () => null,
     (error: unknown) => error,
   );
-  assert.equal(await probe, expectResponsive, `${name}: the malformed leg answers 'not this one'`);
+  assert.equal(
+    (await probe).reachable,
+    expectResponsive,
+    `${name}: th
```

**File**: `packages/daemon-client/src/__tests__/daemon-client-loopback-probe-connect-denied.test.ts` (added, +373/-0)
```diff
@@ -0,0 +1,373 @@
+import assert from 'node:assert/strict';
+import EventEmitter from 'node:events';
+import fs from 'node:fs';
+import net from 'node:net';
+import { afterEach, test, vi } from 'vitest';
+import { runCmdBackground, runCmdDetachedMonitored } from '@agent-device/host-kit/command';
+import {
+  isProcessAlive,
+  readProcessCommand,
+  readProcessStartTime,
+  waitForProcessExit,
+} from '@agent-device/host-kit/process';
+import { AppError } from '@agent-device/kernel/errors';
+import { readVersion } from '@agent-device/host-kit/version';
+import { resolveDaemonPaths } from '@agent-device/daemon-contracts/daemon-resolution';
+import {
+  closeLoopbackServer,
+  listenOnLoopback,
+  mkdtempForTestSync,
+  skipWhenLoopbackUnavailable,
+} from '@agent-device/test-kit';
+import { sendToDaemon } from '../index.ts';
+import { probeLoopbackPort, readAdvertisedConnectDenial } from '../daemon-client-loopback-probe.ts';
+import {
+  finishRegisteredDaemonFixture,
+  finishRegisteredDaemonFixtures,
+  planRegisteredDaemonLaunches,
+} from './registered-daemon-fixture.ts';
+import { currentDaemonCodeSignature } from './code-signature-fixture.ts';
+
+// A loopback connect the HOST refused (EPERM under a macOS Seatbelt sandbox around this client) is
+// evidence about this client, not about the registered daemon. These cases pin that the client names
+// that refusal instead of judging the daemon dead and trying to replace it.
+
+const DENIED_ERRNO = 'EPERM';
+
+/** A host refusal to answer a probe with, naming the errno and endpoint family it refused. */
+type DeniedProbe = Readonly<{ errno: 'EPERM' | 'EACCES'; transport: 'socket' | 'http' }>;
+
+const { mockProbeAnswers } = vi.hoisted(() => ({
+  /**
+   * What each probe of the registered daemon answers, in order: `'silent'`, or the refusal the host
+   * gave. `null` stands for silence so the list reads as answers, not as verdict shapes.
+   */
+  mockProbeAnswers: [] as (DeniedProbe | null)[],
+}));
+
+function denied(errno: DeniedProbe['errno'], transport: DeniedProbe['transport']): DeniedProbe {
+  return { errno, transport };
+}
+
+vi.mock('../daemon-client-transport.ts', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('../daemon-client-transport.ts')>();
+  return {
+    ...actual,
+    probeDaemonReachability: async (...args: Parameters<typeof actual.probeDaemonReachability>) => {
+      const answer = mockProbeAnswers.shift();
+      if (!answer) return { reachable: false };
+      // The port is the one this probe aimed at, as the real probe reports it.
+      const port = answer.transport === 'http' ? (args[0].httpPort ?? 0) : (args[0].port ?? 0);
+      return { reachable: false, denial: { ...answer, port } };
+    },
+  };
+});
+
+vi.mock('@agent-device/host-kit/command', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('@agent-device/host-kit/command')>()),
+  runCmdDetachedMonitored: vi.fn(),
+}));
+
+const spawnDaemon = vi.mocked(runCmdDetachedMonitored);
+
+afterEach(async () => {
+  mockProbeAnswers.length = 0;
+  spawnDaemon.mockReset();
+  await finishRegisteredDaemonFixtures();
+});
+
+/**
+ * A stand-in for the daemon running OUTSIDE the sandbox: a live process, plus a registration this
+ * client wrote by hand that points at loopback endpoints and this pid. The process is a plain `node
+ * -e` stand-in, not a daemon build: what makes it a daemon is the registration and the live pid, and
+ * `readProcessCommand` is read only as a skip guard for environments where process inspection is
+ * unavailable. The client never started this lifetime, so an unreachable judgement lands as a
+ * retirement it may not confirm.
+ */
+async function withRegisteredStandIn(
+  t: { skip: (reason: string) => void },
+  body: (input: { stateDir: string; pid: number; port: number; httpPort: number }) => Promise<void>,
+): Promise<void> {
+  if (await skipWhenLoopbackUnavailable(t)) return;
+  const stateDir = mkdtempForTestSync('agent-device-connect-denied-');
+  const standIn = runCmdBackground(process.execPath, ['-e', 'setInterval(() => {}, 1000);'], {
+    stdio: 'ignore',
+    allowFailure: true,
+    captureOutput: false,
+  });
+  void standIn.wait.catch(() => {});
+  const pid = standIn.child.pid;
+  assert.ok(pid, 'the stand-in has a pid');
+  const server = net.createServer((socket) => socket.on('error', () => {}));
+  const httpServer = net.createServer((socket) => socket.on('error', () => {}));
+  try {
+    await new Promise((resolve) => setTimeout(resolve, 50));
+    const processStartTime = readProcessStartTime(pid) ?? undefined;
+    const command = readProcessCommand(pid);
+    if (command === null || processStartTime === undefined) {
+      t.skip('process command/start inspection is unavailable in this environment');
+      return;
+    }
+    const port = await listenOnLoopback(server);
+    const httpPort = await listenOnLoopback(httpServer);
+    const paths = resolveDaemonPaths(
```

**File**: `packages/daemon-client/src/__tests__/daemon-client-loopback-probe-pooled-socket.test.ts` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+import assert from 'node:assert/strict';
+import http from 'node:http';
+import net from 'node:net';
+import { afterEach, test, vi, type Mock } from 'vitest';
+import {
+  closeLoopbackServer,
+  listenOnLoopback,
+  skipWhenLoopbackUnavailable,
+} from '@agent-device/test-kit';
+import * as hostTransport from '@agent-device/host-kit/transport';
+import { probeDaemonReachability } from '../daemon-client-transport.ts';
+
+// A reachability probe must not be answered around by a keep-alive socket an earlier command left in
+// the pool: a caller reads this verdict before it retires a daemon, and a pooled socket proves only
+// that SOME connect was allowed at SOME point, not that one is allowed NOW.
+//
+// This case owns a file because it patches `Socket.prototype.connect` for every socket made while the
+// patch is on and leans on the process-wide keep-alive pool. Vitest gives each file a worker of its
+// own, so the refusal cannot reach a case elsewhere that is mid-request on a shared socket, and
+// `afterEach` hands the prototype back before this file runs anything else.
+
+let server: http.Server | undefined;
+let connect: Mock<net.Socket['connect']> | undefined;
+const askedUrls: string[] = [];
+
+afterEach(async () => {
+  connect?.mockRestore();
+  connect = undefined;
+  askedUrls.length = 0;
+  if (server) await closeLoopbackServer(server);
+  server = undefined;
+});
+
+test('a fresh connect the host refused is not answered around by a pooled socket', async (t) => {
+  if (await skipWhenLoopbackUnavailable(t)) return;
+  server = http.createServer((req, res) => {
+    askedUrls.push(String(req.url));
+    res.end('{}');
+  });
+  const port = await listenOnLoopback(server);
+  // The pool may still hold a socket for THIS port from a server this worker already closed, and the
+  // OS hands loopback ports out again. Riding one would write the prime to a peer that never answers,
+  // so this endpoint's pooled sockets go first.
+  destroyPooledSockets(http.globalAgent, port);
+
+  // Prime the pool the way an earlier command primes it: one health request whose socket returns to
+  // the agent. It goes through the SAME module object the probe loads, or no candidate lands in the
+  // pool and the case proves nothing. The request is bounded so a pool this case does not control
+  // cannot hold it open to the test budget.
+  const requester = await hostTransport.loadNodeHttpRequester('http:');
+  await new Promise<void>((resolve, reject) => {
+    const request = requester.request(
+      { host: '127.0.0.1', port, path: '/health', method: 'GET', timeout: 2_000 },
+      (res) => {
+        res.resume();
+        res.on('end', resolve);
+      },
+    );
+    request.on('timeout', () => {
+      request.destroy(new Error(`the prime reached no daemon on port ${port}`));
+    });
+    request.on('error', reject);
+    request.end();
+  });
+  // A pool that took nothing in would leave the probe with nothing to ride, and a `reachable: false`
+  // verdict would then mean nothing.
+  assert.ok(
+    freeSocketCountFor(http.globalAgent, port) > 0,
+    'the prime left a keep-alive socket in the pool for this endpoint',
+  );
+
+  // A host that refuses a connect answers it immediately, with no round trip: the socket ends with
+  // the errno and carries no request. The connect is the real one, so the socket has a handle and the
+  // errno reaches the requester — destroying a socket that never connected reports only a closed
+  // socket. The refusal lands on a later turn, after the requester has put its listener on it.
+  const realConnect = net.Socket.prototype.connect;
+  connect = vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(function (
+    this: net.Socket,
+    ...args: Parameters<net.Socket['connect']>
+  ) {
+    const socket = realConnect.apply(this, args as never) as net.Socket;
+    setImmediate(() => socket.destroy(Object.assign(new Error('EPERM'), { code: 'EPERM' })));
+    return socket;
+  });
+
+  assert.deepEqual(
+    await probeDaemonReachability({ token: 'secret', pid: 1, httpPort: port }, 'http'),
+    { reachable: false, denial: { errno: 'EPERM', transport: 'http', port } },
+  );
+  assert.deepEqual(askedUrls, ['/health'], 'only the prime reached the daemon');
+
+  // The primed socket is back in the pool now, pointed at a server about to close. Drop this
+  // endpoint's entry so nothing downstream rides it.
+  destroyPooledSockets(http.globalAgent, port);
+});
+
+/** Drops the keep-alive sockets the pool holds for one loopback port, and only those. */
+function destroyPooledSockets(agent: http.Agent, port: number): void {
+  // Node types the pool as read-only, and this is the one place a test has to empty it.
+  const free = agent.freeSockets as Record<string, net.Socket[] | undefined>;
+  for (const [key, sockets] of Object.entries(free)) {
+    if (!isPooledEndpointForPort(key, port)) continue;
+    for (const socket of sockets ?? []) socket
```

**File**: `packages/daemon-client/src/__tests__/daemon-client-timeout-route.test.ts` (modified, +48/-0)
```diff
@@ -514,6 +514,54 @@ test('request-timeout route: an attach client leaves a daemon that answers no pr
   }
 });
 
+// A sandboxed client whose RPC times out AND whose probe connect the host refused holds no evidence
+// about the daemon, so the timeout's own hint must not claim its session survived. The refusal is the
+// finding worth reporting: it replaces the timeout's reason and carries the shared host-access hint.
+// EPERM and EACCES cannot be produced by a stand-in server, so the probe seam answers with the refusal
+// this client's host really gave it.
+test('a timeout whose liveness probe the host refused reports the refusal, not a kept-alive session', async (t) => {
+  if (await skipWhenLoopbackUnavailable(t)) return;
+  const daemon = await startStandIn('socket', 'refuse');
+  const paths = dummyStatePaths();
+  const info = await registeredOwner(paths, daemon.port, 'socket');
+  const liveness = await import('../daemon-client-liveness-probe.ts');
+  vi.spyOn(liveness, 'answersLivenessProbe').mockResolvedValue({
+    reachable: false,
+    denial: { errno: 'EPERM', transport: 'socket', port: daemon.port },
+  });
+  try {
+    const error = await expectRouteError(
+      sendRequest(
+        info,
+        buildRequest(RESET_POLICY_COMMAND, undefined),
+        'socket',
+        paths,
+        TIMEOUT_MS,
+        { host: createTestHostEnvironment() },
+      ),
+      /sandbox around this command/,
+    );
+
+    assert.equal(error.details?.reason, 'daemon-connect-denied');
+    assert.equal(error.details?.errno, 'EPERM');
+    assert.equal(error.details?.port, daemon.port);
+    // The refusal replaces the timeout's REASON, not its facts: this request had already been written,
+    // so the error still says the daemon may have run it. Without `daemonRequestSent` the disclosure
+    // seam would call a request that dispatched `no`, and a retrying caller would run it twice.
+    assert.equal(error.details?.daemonRequestSent, true);
+    assert.equal(error.details?.dispatched, 'unknown');
+    assert.ok(
+      !/kept alive|survive/i.test(String(error.details?.hint)),
+      'the hint claims no session this client could not have reached',
+    );
+    assert.equal(isProcessAlive(info.pid), true, 'a refused probe authorizes no signal');
+    assert.ok(fs.existsSync(paths.infoPath), 'the registration is left in place');
+    assert.ok(fs.existsSync(paths.lockPath), 'the lock is left in place');
+  } finally {
+    await closeLoopbackServer(daemon.server);
+  }
+});
+
 test('request-timeout route: the reset acts on the resolved state paths, not the request flags', async (t) => {
   if (await skipWhenLoopbackUnavailable(t)) return;
   // Path resolution happens upstream of `sendRequest`, which receives the state paths the caller
```

**File**: `packages/daemon-client/src/__tests__/daemon-client-transport.test.ts` (modified, +43/-7)
```diff
@@ -23,8 +23,8 @@ import {
 } from '@agent-device/contracts/daemon-http';
 import { sendToDaemon } from '../index.ts';
 import {
-  canConnect,
   isDaemonTransportUnavailableError,
+  probeDaemonReachability,
   sendRequest,
 } from '../daemon-client-transport.ts';
 import { DAEMON_UNAVAILABLE_REASONS } from '../daemon-lifecycle-errors.ts';
@@ -62,7 +62,13 @@ test('auto health probing reserves time for a healthy fallback when HTTP hangs',
     const httpPort = await listenOnLoopback(httpServer);
     const port = await listenOnLoopback(socketServer);
     assert.equal(
-      await canConnect({ token: 'secret', pid: 1, transport: 'http', httpPort, port }, 'auto', 120),
+      (
+        await probeDaemonReachability(
+          { token: 'secret', pid: 1, transport: 'http', httpPort, port },
+          'auto',
+          120,
+        )
+      ).reachable,
       true,
     );
   } finally {
@@ -71,6 +77,34 @@ test('auto health probing reserves time for a healthy fallback when HTTP hangs',
   }
 });
 
+// A reachability probe shape that a boolean "unreachable" would report wrongly, and that a caller
+// reads before it retires a daemon: a fallback leg that answers AFTER the deadline must not bury the
+// refusal the first leg already proved.
+test('a fallback leg answering past the deadline still reports the first leg as a denial', async () => {
+  const probe = await import('../daemon-client-loopback-probe.ts');
+  const denial = { errno: 'EPERM', transport: 'socket', port: 41_234 } as const;
+  // "Late" is spent, not faked: the budget is 20 ms and the socket leg answers after 40 ms, so the
+  // deadline has provably passed by the time the fallback's answer lands.
+  const socketLeg = vi.spyOn(probe, 'probeLoopbackPort').mockImplementation(async () => {
+    await sleep(40);
+    return { reachable: false, denial };
+  });
+  const httpLeg = vi.spyOn(probe, 'probeHttpEndpoint').mockResolvedValue({ reachable: true });
+  try {
+    assert.deepEqual(
+      await probeDaemonReachability(
+        { token: 'secret', pid: 1, transport: 'dual', port: 41_234, httpPort: 41_235 },
+        'auto',
+        20,
+      ),
+      { reachable: false, denial },
+    );
+  } finally {
+    socketLeg.mockRestore();
+    httpLeg.mockRestore();
+  }
+});
+
 test('the health deadline includes requester loading and forbids a late request', async (t) => {
   if (await skipWhenLoopbackUnavailable(t)) return;
   let requests = 0;
@@ -93,10 +127,12 @@ test('the health deadline includes requester loading and forbids a late request'
   try {
     const httpPort = await listenOnLoopback(server);
     let settled = false;
-    probing = canConnect({ token: 'secret', pid: 1, httpPort }, 'http', 40).then((reachable) => {
-      settled = true;
-      return reachable;
-    });
+    probing = probeDaemonReachability({ token: 'secret', pid: 1, httpPort }, 'http', 40).then(
+      (probe) => {
+        settled = true;
+        return probe.reachable;
+      },
+    );
     await sleep(90);
     assert.equal(settled, true, 'loading must not extend the probe deadline');
     assert.equal(await probing, false);
@@ -560,7 +596,7 @@ test.for([
 
 test('an endpoint missing for the requested transport rejects with a typed reason the classifier accepts', async () => {
   const socketOnly = { port: 1, token: 't', pid: 1 };
-  const error = await canConnect(socketOnly, 'http').then(
+  const error = await probeDaemonReachability(socketOnly, 'http').then(
     () => undefined,
     (error: unknown) => error,
   );
```

**File**: `packages/daemon-client/src/__tests__/daemon-launch-spec.test.ts` (modified, +118/-5)
```diff
@@ -9,6 +9,7 @@ import {
   type DaemonReachability,
   resolveLocalDaemonCodeIdentity,
 } from '../daemon-launch-spec.ts';
+import type { DaemonProbeVerdict } from '../daemon-client-loopback-probe.ts';
 import { isSourceCheckoutProjectRoot, readVersion } from '@agent-device/host-kit/version';
 import { resetAllProcessMemosForTests } from '@agent-device/kernel/ttl-memo';
 
@@ -128,15 +129,37 @@ test('a version mismatch is decided without asking the client transport', async
   const decision = await resolveDaemonTakeover(runningDaemon({ version: '0.0.1' }), {
     onClientTransport: async () => {
       asked = true;
-      return false;
+      return silent;
     },
-    onAnyAdvertisedTransport: async () => false,
+    onAnyAdvertisedTransport: async () => silent,
+    refusedByHost: async () => undefined,
   });
 
   assert.equal(decision.kind, 'replace');
   assert.equal(asked, false);
 });
 
+// The guard a replacement asks for is a PERMISSION question, not a liveness one: it must be a bare
+// connect, so it costs no health request, no retry and no wait step. Reaching for the reachability
+// probe here would put a `/health` request and the probe's retries on every mismatched-daemon takeover.
+test('the guard before a replacement asks only whether the host refuses the connect', async () => {
+  let probedLiveness = 0;
+  const decision = await resolveDaemonTakeover(runningDaemon({ version: '0.0.1' }), {
+    onClientTransport: async () => {
+      probedLiveness += 1;
+      return silent;
+    },
+    onAnyAdvertisedTransport: async () => {
+      probedLiveness += 1;
+      return silent;
+    },
+    refusedByHost: async () => undefined,
+  });
+
+  assert.equal(decision.kind, 'replace');
+  assert.equal(probedLiveness, 0, 'a version mismatch is replaced without a reachability probe');
+});
+
 test('a newer daemon alive only on a transport the client does not prefer is still refused', async () => {
   assert.deepEqual(
     await resolveDaemonTakeover(runningDaemon({ version: '999.0.0' }), onlyOnAnotherTransport()),
@@ -156,6 +179,58 @@ test('a same-version daemon the client transport cannot reach is replaced', asyn
   );
 });
 
+test('a same-version daemon the host refused to connect to is not judged unreachable', async () => {
+  useClientTree(false);
+
+  assert.deepEqual(
+    await resolveDaemonTakeover(runningDaemon({ codeOrigin: 'installed' }), denied()),
+    { kind: 'connectDenied', denial: DENIAL },
+  );
+});
+
+// The unreachable branch retires too, so it asks the same permission question even when the client's
+// own transport leg answered only silence: a managed client pinned to a leg the daemon does not serve
+// would otherwise replace a daemon it was never allowed to reach.
+test('a daemon unreachable on the client transport but refused by the host is not replaced', async () => {
+  useClientTree(false);
+
+  assert.deepEqual(
+    await resolveDaemonTakeover(
+      runningDaemon({ codeOrigin: 'installed' }),
+      silentButRefusedOnTheGuard(),
+    ),
+    { kind: 'connectDenied', denial: DENIAL },
+  );
+});
+
+// A replacement retires a live process, so no branch of the ladder may answer it on the record alone.
+// Before this, only a NEWER daemon was probed: an older or code-mismatched one was replaced without
+// ever being seen, which let a client whose sandbox refuses the connect kill a healthy daemon.
+test('a version mismatch the host refused to probe is a denial, not a replacement', async () => {
+  assert.deepEqual(await resolveDaemonTakeover(runningDaemon({ version: '0.0.1' }), denied()), {
+    kind: 'connectDenied',
+    denial: DENIAL,
+  });
+});
+
+test('a code mismatch the host refused to probe is a denial, not a replacement', async () => {
+  useClientTree(false);
+
+  assert.deepEqual(
+    await resolveDaemonTakeover(runningDaemon({ codeOrigin: 'checkout' }), denied()),
+    { kind: 'connectDenied', denial: DENIAL },
+  );
+});
+
+// The refusal outranks the newer-daemon refusal: both stop the daemon being touched, and only
+// `connectDenied` says the reason is this client's sandbox rather than the daemon's version.
+test('a connect the host refused never reads as a newer daemon to refuse', async () => {
+  assert.deepEqual(await resolveDaemonTakeover(runningDaemon({ version: '999.0.0' }), denied()), {
+    kind: 'connectDenied',
+    denial: DENIAL,
+  });
+});
+
 test('a reachable daemon older than the client is replaced', async () => {
   assert.deepEqual(await resolveDaemonTakeover(runningDaemon({ version: '0.0.1' }), reachable()), {
     kind: 'replace',
@@ -175,17 +250,55 @@ function useClientTree(sourceCheckout: boolean): void {
 }
 
 function reachable(): DaemonReachability {
-  return { onClientTransport: async () => true, onAnyAdvertisedTransport: async () => true };
+  return {
+    onClientTransport: async () => answered,
+    onAnyAdvertisedTransport: async () => answered,
+    refusedByHost: async () => undefined,
+  };
 }
 
 function unreachab
```

---

### Incident Patch 2: `5d6c2f4b` (2026-11-25)
**Commit Message**: fix(ios): read and press deep trees on physical devices through private AX (#5093)

* fix(ios): recover deep trees on physical devices through the private-AX tier

On a physical iPad, one deep screen failed every snapshot tier with
kAXErrorIllegalArgument. The AX server limits the depth of each snapshot
request, and XCUIElement.snapshot() and the query sweep both ask for the
whole tree in one request. The runner's private-AX tier already works
around this limit: it steps down a depth ladder and re-roots requests at
the depth-capped frontier nodes. It was compiled for iOS Simulators only.

The tier uses only XCTest's own in-process AX client
(XCUIDevice.accessibilityInterface, requestSnapshotForElement), which is
also present on a device. So the runner now offers it on iOS physical
devices too. tvOS, visionOS, watchOS, and macOS still do not get it: a
new otherApplePlatform environment keeps them on the XCTest backends,
which is what they had when they were mapped to physicalDevice.

Consequences on a physical device: a capture that the tree and query
tiers cannot serve falls through to private AX, and a penalized XCTest
channel defers to private AX instead of a bounded XCTest probe

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+AXSnapshotFallback.swift` (modified, +28/-13)
```diff
@@ -166,7 +166,7 @@ extension RunnerTests {
     hint: CaptureHint,
     deadline: Date = .distantFuture
   ) -> SnapshotAcquisition? {
-    #if os(iOS) && targetEnvironment(simulator)
+    #if os(iOS)
       let app = target.app
       let requestedDepth = hint.rawTraversalDepth ?? 64
       // An explicit --depth request is honored as asked: no accepted-depth
@@ -220,6 +220,7 @@ extension RunnerTests {
       let viewport = privateAXSnapshotViewport(
         app: app,
         bundleId: target.bundleId,
+        soleScreenSize: target.soleScreenSize,
         rootFrame: rootFrame
       )
       let nodes = privateAXAcquisition(
@@ -275,14 +276,15 @@ extension RunnerTests {
 
   /// The app's reported viewport when XCTest can read it, else the bridge's own root frame. That root
   /// is `.derived`, which cannot establish a screen origin or anchor a rotation, so its local
-  /// coordinates cannot authorize input (#4399), unless AXRuntime proves the app fills the screen.
+  /// coordinates cannot authorize input (#4399), unless the root is the full-screen proof frame.
   private func privateAXSnapshotViewport(
     app: XCUIApplication,
     bundleId: String?,
+    soleScreenSize: CGSize,
     rootFrame: CGRect
   ) -> SnapshotViewport {
     let fallback = {
-      let fullScreenFrame = Self.fullScreenFrame(of: app)
+      let fullScreenFrame = Self.fullScreenFrame(of: app, soleScreenSize: { soleScreenSize })
       let viewport = Self.privateAXRootViewport(rootFrame: rootFrame, fullScreenFrame: fullScreenFrame)
       let kind: String
       switch viewport {
@@ -319,19 +321,32 @@ extension RunnerTests {
     }
   }
 
-  /// The screen's frame when AXRuntime reports `app` as the primary app filling it, else `.null`.
-  static func fullScreenFrame(of app: XCUIApplication) -> CGRect {
+  /// The frame `app`'s root must equal, at the origin, to prove that the app fills the screen, else
+  /// `.null` (`RunnerFullScreenProofFrame`). `soleScreenSize` is read only when the AXRuntime probe
+  /// proves nothing.
+  static func fullScreenFrame(of app: XCUIApplication, soleScreenSize: () -> CGSize) -> CGRect {
     #if os(iOS)
-      return RunnerFullScreenApplicationFrame(app)
+      return RunnerFullScreenApplicationFrame(app, soleScreenSize)
     #else
       return .null
     #endif
   }
 
-  /// The viewport a private AX root establishes without XCTest. A root that is exactly the screen
-  /// AXRuntime reports the app filling, at the origin, is `.reported`: two independent reads agree
-  /// that window space is screen space, as on every iPhone app. Any other root stays `.derived`,
-  /// including a placed iPad window's local root (#4399) and a root that is the screen rotated.
+  /// The device's only screen in portrait points, read at most once per command
+  /// (`soleDisplayPortraitSize`). `.zero` when the read fails or the platform has no such screen.
+  @MainActor
+  func commandSoleScreenSize() -> CGSize {
+    #if os(iOS)
+      return soleDisplayPortraitSize() ?? .zero
+    #else
+      return .zero
+    #endif
+  }
+
+  /// The viewport a private AX root establishes without XCTest. A root that is exactly the
+  /// full-screen proof frame, at the origin, is `.reported`: two independent reads agree that window
+  /// space is screen space, as on every iPhone app. Any other root stays `.derived`, including a
+  /// placed iPad window's local root (#4399) and a root that is the screen rotated.
   static func privateAXRootViewport(rootFrame: CGRect, fullScreenFrame: CGRect) -> SnapshotViewport {
     // CONSERVATIVE: orientation is unknown here, so a landscape root (the portrait screen with width
     // and height swapped) stays `.derived` rather than guess which way to rotate it.
@@ -341,9 +356,9 @@ extension RunnerTests {
     return .reported(box: rootFrame, interfaceOrientation: RunnerInterfaceOrientation.unknown)
   }
 
-  /// True when `frame` is exactly the screen AXRuntime reports the app filling, at the origin: the one
-  /// case where window space is screen space without a live XCTest read. `fullScreenFrame` is `.null`
-  /// when the app does not fill the screen.
+  /// True when `frame` is exactly the full-screen proof frame, at the origin: the one case where
+  /// window space is screen space without a live XCTest read. `fullScreenFrame` is `.null` when no
+  /// read proves that the app fills the screen.
   static func isFullScreenAtOrigin(_ frame: CGRect, fullScreenFrame: CGRect) -> Bool {
     !fullScreenFrame.isNull && frame.origin == .zero && frame == fullScreenFrame
   }
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SnapshotAcquisition.swift` (modified, +5/-3)
```diff
@@ -145,7 +145,9 @@ extension RunnerTests {
     if requestLitPanel == nil,
       let frame = Self.fullScreenWindowFrame(
         windowFrames: rootSnapshot.children.filter { $0.elementType == .window }.map(\.frame),
-        fullScreenFrame: Self.fullScreenFrame(of: app)
+        fullScreenFrame: Self.fullScreenFrame(of: app) {
+          (try? runOnMainActor { self.commandSoleScreenSize() }.get()) ?? .zero
+        }
       )
     {
       return .reported(box: frame, interfaceOrientation: capturedInterfaceOrientation(app: app))
@@ -154,10 +156,10 @@ extension RunnerTests {
   }
 
   /// The first usable window frame of a snapshot, the window `resolveRunnerWindowElement` resolves,
-  /// when it is exactly the screen AXRuntime reports the app filling, at the origin. Nil keeps the
+  /// when it is exactly the full-screen proof frame, at the origin. Nil keeps the
   /// live read: a placed iPad window (#4399), an offset window, and a landscape window, whose frame
   /// is the portrait screen with width and height swapped.
-  /// `fullScreenFrame` runs its AXRuntime probe only once a usable window is found.
+  /// `fullScreenFrame` runs its probe only once a usable window is found.
   static func fullScreenWindowFrame(windowFrames: [CGRect], fullScreenFrame: @autoclosure () -> CGRect) -> CGRect? {
     guard
       let window = windowFrames.first(where: { !$0.isEmpty }),
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SnapshotBackendCapabilities.swift` (modified, +6/-2)
```diff
@@ -3,6 +3,8 @@ import XCTest
 enum SnapshotBackendEnvironment {
   case simulator
   case physicalDevice
+  /// tvOS, visionOS, watchOS, and macOS builds of the runner.
+  case otherApplePlatform
 }
 
 /// How a backend's acquisition relates to a regular `--depth` request. Every backend serves the
@@ -72,8 +74,10 @@ enum SnapshotBackendKind: String, CaseIterable {
   var isAvailableOnCurrentPlatform: Bool {
     #if os(iOS) && targetEnvironment(simulator)
       return isAvailable(on: .simulator)
-    #else
+    #elseif os(iOS)
       return isAvailable(on: .physicalDevice)
+    #else
+      return isAvailable(on: .otherApplePlatform)
     #endif
   }
 
@@ -82,7 +86,7 @@ enum SnapshotBackendKind: String, CaseIterable {
     case .recursiveTree, .querySweep:
       return true
     case .privateAX:
-      return environment == .simulator
+      return environment != .otherApplePlatform
     }
   }
 }
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SnapshotCapturePlan.swift` (modified, +3/-2)
```diff
@@ -153,8 +153,9 @@ extension RunnerTests {
     let suppressXCTestPenalty = snapshotXCTestPenaltyWarmupExemption.consume()
     var xCTestTierRan = false
 
-    // Reorder is iOS-only: physical devices have no independent semantic backend, so a penalized
-    // channel there uses the bounded probe instead of deferral.
+    // Only iOS runners penalize the channel. Every iOS runner, Simulator or physical device, has
+    // the private-AX backend, so a penalized regular visible plan defers to it. Raw and lit-panel
+    // plans keep their order.
     var xCTestChannelPenalized = false
     var breakerPenalized = false
     var xCTestRecoveryProbeDue = false
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SnapshotCaptureTarget.swift` (modified, +5/-0)
```diff
@@ -17,6 +17,11 @@ struct SnapshotCaptureTarget {
   /// Set on an observe-only capture, whose answer asserts app provenance: the system-alert tier then
   /// refuses the capture instead of answering with the SpringBoard tree (#3348).
   var refusesSystemAlertSubstitution = false
+  /// The device's only screen in portrait points, read on main because `XCUIScreen` is main-actor
+  /// isolated. The off-main private-AX tier proves a full-screen root against it. `.zero` when the read
+  /// failed, the platform has no such screen, or the request names a lit panel (its plan has no
+  /// private-AX tier).
+  var soleScreenSize: CGSize = .zero
 }
 
 /// The system-alert tier would have answered a capture that must come from the app.
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SnapshotExecution.swift` (modified, +6/-0)
```diff
@@ -33,6 +33,12 @@ extension RunnerTests {
           )
         target.litPanelSurface = self.litPanelState.surface
         target.refusesSystemAlertSubstitution = context.observation != nil
+        // Snapshot commands skip `executePrepared`, which starts every other command without a
+        // cached screen size, so a display change between snapshots is read again.
+        self.mainOwned.soleDisplayPortraitSize = nil
+        if self.requestLitPanel == nil {
+          target.soleScreenSize = self.commandSoleScreenSize()
+        }
         return .capture(
           target,
           systemSurface: context.systemSurface,
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerXCTestEventBridge.h` (modified, +19/-4)
```diff
@@ -133,11 +133,26 @@ FOUNDATION_EXPORT RunnerFullScreenEvidence RunnerFullScreenEvidenceFromForegroun
   CGRect screenFrame
 );
 
-// The screen's frame when AXRuntime reports `application` as the primary app filling it, else
-// `CGRectNull`. The same probe the sole-screen route admits a non-phone app with; it reads two frames
-// and walks no tree, so it answers while XCTest's accessibility channel is penalized.
+// The frame an app's own root must equal, at the origin, to prove that the app fills the screen.
+// Fills-screen evidence answers the screen AXRuntime read. Not-primary-app and windowed evidence
+// answer `CGRectNull`. Unknown evidence answers the sole XCTest screen in native portrait points,
+// because no window smaller than the screen equals it: AXRuntime answers no app from a runner on a
+// physical device. A missing, empty, or landscape sole screen answers `CGRectNull`.
+FOUNDATION_EXPORT CGRect RunnerFullScreenProofFrame(
+  RunnerFullScreenEvidence evidence,
+  CGRect probedScreenFrame,
+  CGSize soleScreenSize
+);
+
+// The frame `RunnerFullScreenProofFrame` decides for `application`, from the AXRuntime probe and,
+// only when that probe proves nothing, `soleScreenSize`. Neither read walks the app's tree, so it
+// answers while XCTest's accessibility channel is penalized. `XCUIScreen` is main-actor isolated, so
+// a caller off the main thread supplies a size that was read on main.
 #if TARGET_OS_IOS
-FOUNDATION_EXPORT CGRect RunnerFullScreenApplicationFrame(id application);
+FOUNDATION_EXPORT CGRect RunnerFullScreenApplicationFrame(
+  id application,
+  CGSize (^NS_NOESCAPE soleScreenSize)(void)
+);
 #endif
 
 FOUNDATION_EXPORT NSString * _Nullable RunnerRequireClass(
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerXCTestEventBridge.m` (modified, +34/-5)
```diff
@@ -375,6 +375,30 @@ RunnerFullScreenEvidence RunnerFullScreenEvidenceFromForeground(
     : RunnerFullScreenEvidenceWindowed;
 }
 
+CGRect RunnerFullScreenProofFrame(
+  RunnerFullScreenEvidence evidence,
+  CGRect probedScreenFrame,
+  CGSize soleScreenSize
+) {
+  switch (evidence) {
+    case RunnerFullScreenEvidenceFillsScreen:
+      return probedScreenFrame;
+    case RunnerFullScreenEvidenceNotPrimaryApp:
+    case RunnerFullScreenEvidenceWindowed:
+      return CGRectNull;
+    case RunnerFullScreenEvidenceUnknown:
+      break;
+  }
+  CGRect soleScreen = CGRectMake(0, 0, soleScreenSize.width, soleScreenSize.height);
+  // CONSERVATIVE: a landscape root is the portrait screen with width and height swapped, and no
+  // read here says which way to rotate it.
+  if (!AgentDeviceForegroundFrameIsMeasurable(soleScreen) ||
+      soleScreenSize.height < soleScreenSize.width) {
+    return CGRectNull;
+  }
+  return soleScreen;
+}
+
 #if TARGET_OS_IOS
 
 // The private AXElement class the shared protocol describes comes from AXRuntime; the bridge guest
@@ -481,12 +505,17 @@ static RunnerFullScreenEvidence RunnerProbeApplicationFillsScreen(id application
   return RunnerProbeApplicationFillsScreenFrame(application, NULL);
 }
 
-CGRect RunnerFullScreenApplicationFrame(id application) {
+CGRect RunnerFullScreenApplicationFrame(
+  id application,
+  CGSize (^NS_NOESCAPE soleScreenSize)(void)
+) {
   CGRect screen = CGRectNull;
-  if (RunnerProbeApplicationFillsScreenFrame(application, &screen) != RunnerFullScreenEvidenceFillsScreen) {
-    return CGRectNull;
-  }
-  return screen;
+  RunnerFullScreenEvidence evidence = RunnerProbeApplicationFillsScreenFrame(application, &screen);
+  return RunnerFullScreenProofFrame(
+    evidence,
+    screen,
+    evidence == RunnerFullScreenEvidenceUnknown ? soleScreenSize() : CGSizeZero
+  );
 }
 
 #endif
```

---

### Incident Patch 3: `24f8181c` (2026-11-25)
**Commit Message**: fix(metro): reload the app's own dev server instead of assuming port 8081 (#5098)

* fix(metro): reload the app's own dev server instead of assuming port 8081

A flagless metro reload resolved localhost:8081 whenever the session had bound no
dev server, which reloaded whichever project owned that port, or failed as a bare
fetch error. It now resolves in order: the session or explicit binding, the address
the app itself stored (RCT_jsLocation in an iOS simulator's preferences), then a
local dev server whose X-React-Native-Project-Root matches this directory. When
nothing resolves, it fails with details.reason metro_dev_server_unresolved naming
the address the fallback would have used. Only a session whose app runs on a local
simulator or emulator runs the lookups; a remote or physical device keeps the
previous default. Sessions that bind no address now record the app they opened so
the reload has something to look that app's address up from.

* test(metro): cover discovery branches and refuse a foreign app-reported server

Splits the pure reads out of dev-server discovery — lsof and netstat port
tables, the app's stored preferences, the project-root header, host:port, and
root overl

**File**: `packages/client/src/__tests__/index-metro-open-hosted-locally.test.ts` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import { test } from 'vitest';
+import assert from 'node:assert/strict';
+import fs from 'node:fs';
+import path from 'node:path';
+import { createAgentDeviceClient } from '../index.ts';
+import { createClientTransport, mkdtempForTestSync } from '@agent-device/test-kit';
+
+// `open` records where the session's device runs, and that is what lets a later flagless
+// `metro reload` read this machine's simulator containers and listening ports at all. These pin the
+// mapping from the daemon's device-selection answer to that trait, through the real open path.
+
+type RecordedApp = {
+  platform: string;
+  deviceId: string;
+  appId: string;
+  hostedLocally?: boolean;
+};
+
+/** An `open` answered by a local daemon, as the given device-selection metadata reports it. */
+async function openWith(selection: unknown): Promise<{ stateDir: string; app: RecordedApp }> {
+  const stateDir = mkdtempForTestSync('agent-device-client-open-host-');
+  const setup = createClientTransport(async () => ({
+    ok: true,
+    data: {
+      session: 'qa',
+      platform: 'ios',
+      id: 'UDID-1',
+      device: 'iPhone Air',
+      kind: 'simulator',
+      appBundleId: 'com.example.app',
+      ...(selection === undefined ? {} : { selection }),
+    },
+  }));
+  const client = createAgentDeviceClient(
+    { ...setup.config, stateDir, daemonBaseUrl: 'http://127.0.0.1:1' },
+    { transport: setup.transport, host: { env: {}, cwd: stateDir } },
+  );
+
+  await client.apps.open({ app: 'com.example.app', platform: 'ios' });
+
+  const record = JSON.parse(
+    fs.readFileSync(path.join(stateDir, 'metro-sessions', 'qa.json'), 'utf8'),
+  ) as { app?: RecordedApp };
+  assert.ok(record.app, 'open records the app a later reload looks the dev server up from');
+  return { stateDir, app: record.app };
+}
+
+function selectionWith(source: string) {
+  return { reason: 'single-booted-local', source, candidateCount: 1, bootOccurred: false };
+}
+
+test('an open that resolved the device locally records it as hosted here', async () => {
+  const { stateDir, app } = await openWith(selectionWith('local'));
+  try {
+    assert.equal(app.hostedLocally, true);
+    assert.equal(app.deviceId, 'UDID-1');
+  } finally {
+    fs.rmSync(stateDir, { recursive: true, force: true });
+  }
+});
+
+test('an open of a provider device records it as not hosted here', async () => {
+  const { stateDir, app } = await openWith(selectionWith('provider'));
+  try {
+    // A provider's device can be anywhere, so a reload may not read this machine's state for it.
+    assert.equal(app.hostedLocally, false);
+  } finally {
+    fs.rmSync(stateDir, { recursive: true, force: true });
+  }
+});
+
+test('an open that says nothing about the device records no host trait at all', async () => {
+  // `session` means the device was carried over from an earlier request: that says nothing about where
+  // it runs, so it must stay unproven rather than claim either way.
+  const { stateDir, app } = await openWith(selectionWith('session'));
+  try {
+    assert.equal('hostedLocally' in app, false);
+  } finally {
+    fs.rmSync(stateDir, { recursive: true, force: true });
+  }
+});
+
+test('an open response without a selection block records no host trait either', async () => {
+  const { stateDir, app } = await openWith(undefined);
+  try {
+    assert.equal('hostedLocally' in app, false);
+  } finally {
+    fs.rmSync(stateDir, { recursive: true, force: true });
+  }
+});
```

**File**: `packages/client/src/__tests__/index-metro-reload-discovery.test.ts` (added, +271/-0)
```diff
@@ -0,0 +1,271 @@
+import { test, vi } from 'vitest';
+import assert from 'node:assert/strict';
+import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
+import { createServer } from 'node:http';
+import path from 'node:path';
+import { createAgentDeviceClient } from '../index.ts';
+import { AppError } from '@agent-device/kernel/errors';
+import {
+  closeLoopbackServer,
+  listenOnLoopback,
+  mkdtempForTestSync,
+  writeMetroSessionFixture,
+} from '@agent-device/test-kit';
+import type { MetroAppTarget } from '@agent-device/react-native';
+
+// `metro reload` may look a dev server up on this machine only when the client's daemon is local and
+// the session's app is recorded as hosted here. These pin that decision through the real client path.
+// The port listing is answered from a table, so a test sweeps its own ports instead of the machine's,
+// and never reaches the default port a refused search would otherwise call.
+
+const listing = vi.hoisted(() => ({ ports: [] as number[], commands: [] as string[] }));
+
+vi.mock('@agent-device/host-kit/command', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('@agent-device/host-kit/command')>()),
+  runCmd: async (cmd: string) => {
+    listing.commands.push(cmd);
+    return cmd === 'lsof'
+      ? {
+          stdout: listing.ports.map((port) => `n127.0.0.1:${port}`).join('\n'),
+          stderr: '',
+          exitCode: 0,
+        }
+      : { stdout: '', stderr: '', exitCode: 1 };
+  },
+}));
+
+const localApp = {
+  platform: 'android',
+  deviceKind: 'emulator',
+  deviceId: 'emulator-5554',
+  appId: 'com.example.app',
+  hostedLocally: true,
+} as const satisfies MetroAppTarget;
+
+function devServer(projectRoot: string) {
+  const requests: string[] = [];
+  const server = createServer((req, res) => {
+    const url = req.url ?? '';
+    requests.push(url);
+    if (url.startsWith('/status')) {
+      res.setHeader('x-react-native-project-root', projectRoot);
+      res.end('packager-status:running');
+      return;
+    }
+    if (url.startsWith('/reload')) {
+      res.end('RELOADED');
+      return;
+    }
+    res.statusCode = 404;
+    res.end('not found');
+  });
+  return { server, requests };
+}
+
+function workspace(name: string) {
+  const root = mkdtempForTestSync(`agent-device-client-reload-${name}`);
+  const projectRoot = path.join(root, 'project');
+  mkdirSync(projectRoot, { recursive: true });
+  writeFileSync(path.join(projectRoot, 'package.json'), '{"name":"p","private":true}');
+  return { stateDir: path.join(root, 'state'), projectRoot };
+}
+
+/** A client whose daemon is local unless `daemonBaseUrl` says otherwise, and that never gets a command. */
+function clientFor(options: { stateDir: string; projectRoot: string; daemonBaseUrl: string }) {
+  return createAgentDeviceClient(
+    {
+      session: 'qa',
+      stateDir: options.stateDir,
+      cwd: options.projectRoot,
+      daemonBaseUrl: options.daemonBaseUrl,
+    },
+    {
+      transport: async () => {
+        throw new Error('flagless metro reload must stay local and never call the daemon');
+      },
+      host: { env: {}, cwd: options.projectRoot },
+    },
+  );
+}
+
+async function withDevServer<T>(
+  projectRoot: string,
+  ports: boolean,
+  run: (port: number, requests: string[]) => Promise<T>,
+): Promise<T> {
+  const { server, requests } = devServer(projectRoot);
+  const port = await listenOnLoopback(server);
+  listing.ports = ports ? [port] : [];
+  listing.commands = [];
+  try {
+    return await run(port, requests);
+  } finally {
+    listing.ports = [];
+    listing.commands = [];
+    await closeLoopbackServer(server);
+  }
+}
+
+test('a local daemon reload reloads the local dev server that serves this project', async () => {
+  const { stateDir, projectRoot } = workspace('local-found');
+  writeMetroSessionFixture({ stateDir, session: 'qa', hints: { app: localApp } });
+  try {
+    await withDevServer(projectRoot, true, async (port, requests) => {
+      const client = clientFor({
+        stateDir,
+        projectRoot,
+        daemonBaseUrl: `http://127.0.0.1:${port}`,
+      });
+      const result = await client.metro.reload();
+      assert.equal(result.reloadUrl, `http://127.0.0.1:${port}/reload`);
+      assert.equal(result.body, 'RELOADED');
+      assert.deepEqual(listing.commands, ['lsof']);
+      assert.ok(requests.some((url) => url.startsWith('/status')));
+    });
+  } finally {
+    rmSync(path.dirname(stateDir), { recursive: true, force: true });
+  }
+});
+
+test('a local daemon reload refuses another project’s server and fails typed', async () => {
+  const { stateDir, projectRoot } = workspace('local-foreign');
+  writeMetroSessionFixture({ stateDir, session: 'qa', hints: { app: localApp } });
+  try {
+    await withDevServer('/someone/else/project', true, async (port, requests) => {
+      const client = clientFor({
+        stateDir,
+        projectRoot,
+        daemonBaseUrl: `http://127.
```

**File**: `packages/client/src/index.ts` (modified, +85/-13)
```diff
@@ -19,6 +19,7 @@ import type {
   CaptureSnapshotResult,
   DaemonBinding,
   DaemonLifecycle,
+  DeviceSelectionMetadata,
   FlingOptions,
   MaterializationReleaseOptions,
   PanOptions,
@@ -63,8 +64,12 @@ import {
 } from '@agent-device/command-surface';
 import type { CommandResult } from '@agent-device/command-registry/command-result';
 import { createDaemonTransport, createRequestGuard } from '@agent-device/daemon-client';
-import { resolveDaemonPaths } from '@agent-device/daemon-contracts/daemon-resolution';
+import {
+  daemonBaseUrlIsLocal,
+  resolveDaemonPaths,
+} from '@agent-device/daemon-contracts/daemon-resolution';
 import * as devServer from '@agent-device/react-native';
+import type { MetroAppTarget } from '@agent-device/react-native';
 import {
   asOptionalRecord,
   readPresentedSurfaceFact,
@@ -114,6 +119,8 @@ export function createAgentDeviceClient(
   ) => devServer.recordOpenedMetroSession(withHost(options), input);
   const readMetroSessionRuntime = (options: { session: string; stateDir?: string }) =>
     devServer.readMetroSessionRuntime(withHost(options));
+  const readMetroSessionAppTarget = (options: { session: string; stateDir?: string }) =>
+    devServer.readMetroSessionAppTarget(withHost(options));
 
   // A non-default responseLevel (digest/full) makes the daemon return a leveled
   // shape; the per-command client normalizers assume the default shape, so the
@@ -338,17 +345,23 @@ export function createAgentDeviceClient(
       open: async (options: AppOpenOptions) => {
         const session = resolveRequestSession(options);
         const data = await executeCommand<Record<string, unknown>>('open', options);
+        const device = normalizeOpenDevice(data);
+        const appBundleId = readOptionalString(data, 'appBundleId');
+        const appId = appBundleId;
+        const selection = normalizeDeviceSelection(data.selection);
         await recordOpenedMetroSession(
           { ...mergeClientOptions(config, options), session },
           {
             explicitRuntime: options.runtime !== undefined,
             runtime: mergeClientOptions(config, options).runtime,
             sessionReused: data.sessionReused === true,
+            app: metroAppTargetFromOpen(
+              device,
+              appBundleId,
+              appHostedLocally(config, host, selection),
+            ),
           },
         );
-        const device = normalizeOpenDevice(data);
-        const appBundleId = readOptionalString(data, 'appBundleId');
-        const appId = appBundleId;
         return {
           session,
           ...readScriptDeliveryDisclosure(data),
@@ -359,7 +372,7 @@ export function createAgentDeviceClient(
           appName: readOptionalString(data, 'appName'),
           appBundleId,
           appId,
-          selection: normalizeDeviceSelection(data.selection),
+          selection,
           startup: normalizeStartupSample(data.startup),
           runtime: normalizeRuntimeHints(data.runtime),
           device,
@@ -430,15 +443,26 @@ export function createAgentDeviceClient(
         );
         return result;
       },
-      reload: async (options = {}) =>
-        await reloadMetro({
+      reload: async (options = {}) => {
+        const session = resolveSessionName(config.session);
+        const sessionOptions = { ...config, session };
+        // Discovery reads this machine: an app's stored address in a simulator container, and this
+        // host's listening ports. A client aimed at a non-loopback daemon drives devices on another
+        // machine, so its reload keeps the address its hints resolve to and probes nothing here.
+        if (!daemonIsLocal(config, host)) {
+          return await reloadMetro({
+            ...options,
+            runtime: (await readMetroSessionRuntime(sessionOptions)) ?? config.runtime,
+          });
+        }
+        return await reloadMetro({
           ...options,
-          runtime:
-            (await readMetroSessionRuntime({
-              ...config,
-              session: resolveSessionName(config.session),
-            })) ?? config.runtime,
-        }),
+          runtime: (await readMetroSessionRuntime(sessionOptions)) ?? config.runtime,
+          host,
+          projectRoot: config.cwd ?? host.cwd,
+          app: await readMetroSessionAppTarget(sessionOptions),
+        });
+      },
     },
     capture: {
       snapshot: async (options: CaptureSnapshotOptions = {}) => {
@@ -566,6 +590,54 @@ function centeredGestureInput(
   };
 }
 
+/**
+ * Whether this client talks to a daemon on this machine. Discovery in `metro reload` reads local
+ * state — a simulator container file, this host's listening ports — so it is only meaningful when
+ * the devices the session drives are hosted here too, which for a client is the daemon's machine.
+ */
+function daemonIsLocal(config: AgentDeviceClientConfig, host: HostEnvironment): boolean {
+  return daemonBaseUrlIsLocal(config.daemonBaseUrl ?? host.env.
```

**File**: `packages/command-surface/src/metro/index.ts` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ export const metroCommandFacet = defineCommandFacet({
     summary: 'Prepare the dev server or reload apps',
     searchHint: 'bundler',
     cliDetail:
-      "reload with no --metro-host/--metro-port/--bundle-url resolves against the dev server this session last bound via metro prepare or open's metro hint flags (falling back to localhost:8081 only when the session never bound one), so it never silently reloads a different project's server on the default port; pass an explicit flag to override the session hint for one call. After prepare, reload uses the local server address independently of the public or proxy address given to the device; a fresh open preserves it only when its client-config runtime points to the prepared device server, while explicit reload flags override it. For open or an explicit bundle URL, reload removes a .bundle/.jsbundle/.js entry filename and keeps the remaining path as the server mount, and when the server has no HTTP /reload route (Expo) the reload is broadcast over its /message websocket instead of trusting the app-page fallback. The binding is cleared when the session closes, and a fresh open without hint flags also clears any leftover binding from a previous same-name session. --kind expo (detected or forced) requests the virtual-entry bundle URL (.expo/.virtual-metro-entry.bundle) instead of index.bundle, since index.bundle 404s/500s against Expo dev servers in monorepos. Dependency install auto-detects the package manager from the nearest yarn.lock/pnpm-lock.yaml/bun.lock/bun.lockb/package-lock.json walking up from --project-root (bounded at the repo root), so Yarn/pnpm workspace monorepos with the lockfile at the repo root do not wrongly fall back to npm install (which fails on workspace: dependency specifiers); if install still fails, pass --no-install-deps when dependencies are already installed (for example via a monorepo root install).",
+      "reload with no --metro-host/--metro-port/--bundle-url resolves against the dev server this session last bound via metro prepare or open's metro hint flags. When the session never bound one, and the daemon that answered open reported the session's device as one of its own local devices, reload then reads the dev-server address the app itself stored (RCT_jsLocation in the app's preferences; an iOS simulator only) and accepts it when a running dev server there reports a project root that is this project's root or a parent or child of it. Failing that, it probes the ports a local process is listening on for a dev server whose X-React-Native-Project-Root is this project's root or a parent or child of it (a monorepo server reports the repo root), so it never silently reloads a different project's server. Run it from the project's own directory, or pass --metro-port, since a local search matches the working directory. When nothing resolves, reload fails with details.reason 'metro_dev_server_unresolved' naming the address it would have used, instead of calling localhost:8081, which belongs to whichever project owns that port. A session this machine cannot prove hosts its device — a provider device, a device inherited from an earlier request, or an app-less session — skips the local lookups and keeps the default address. Pass an explicit flag to override the session hint for one call. After prepare, reload uses the local server address independently of the public or proxy address given to the device; a fresh open preserves it only when its client-config runtime points to the prepared device server, while explicit reload flags override it. For open or an explicit bundle URL, reload removes a .bundle/.jsbundle/.js entry filename and keeps the remaining path as the server mount, and when the server has no HTTP /reload route (Expo) the reload is broadcast over its /message websocket instead of trusting the app-page fallback. The binding is cleared when the session closes, and a fresh open without hint flags also clears any leftover binding from a previous same-name session. --kind expo (detected or forced) requests the virtual-entry bundle URL (.expo/.virtual-metro-entry.bundle) instead of index.bundle, since index.bundle 404s/500s against Expo dev servers in monorepos. Dependency install auto-detects the package manager from the nearest yarn.lock/pnpm-lock.yaml/bun.lock/bun.lockb/package-lock.json walking up from --project-root (bounded at the repo root), so Yarn/pnpm workspace monorepos with the lockfile at the repo root do not wrongly fall back to npm install (which fails on workspace: dependency specifiers); if install still fails, pass --no-install-deps when dependencies are already installed (for example via a monorepo root install).",
   },
   metadata: metroCommandMetadata,
   run: async (client, input): Promise<MetroPrepareResult | MetroReloadResult> =>
```

**File**: `packages/daemon-client/src/daemon-client-lifecycle.ts` (modified, +1/-17)
```diff
@@ -5,7 +5,6 @@ import type {
   EnsureDaemonOptions,
 } from '@agent-device/contracts/client';
 import type { DaemonResponse } from '@agent-device/kernel/contracts';
-import net from 'node:net';
 import { AppError, normalizeError, type NormalizedError } from '@agent-device/kernel/errors';
 import type { EnvMap, HostEnvironment } from '@agent-device/kernel/source-value';
 import { readReplayDivergenceResume } from '@agent-device/ad-replay/divergence';
@@ -16,6 +15,7 @@ import {
   type OwnedReplayStateDir,
 } from '@agent-device/daemon-contracts/daemon-registration-owner';
 import {
+  isLoopbackHostname,
   resolveDaemonPaths,
   resolveDaemonServerMode,
   resolveDaemonTransportPreference,
@@ -72,11 +72,6 @@ export type EnsuredDaemon = {
   startedByClient: boolean;
 };
 
-const LOOPBACK_BLOCK_LIST = new net.BlockList();
-LOOPBACK_BLOCK_LIST.addSubnet('127.0.0.0', 8, 'ipv4');
-LOOPBACK_BLOCK_LIST.addAddress('::1', 'ipv6');
-LOOPBACK_BLOCK_LIST.addSubnet('::ffff:127.0.0.0', 104, 'ipv6');
-
 /**
  * Whether a timed-out request may retire the daemon it was waiting on. An attach client never may: the
  * daemon is not its to kill, and `ensureDaemon` reuses a compatible daemon that accepts a connection
@@ -546,17 +541,6 @@ function validateRemoteDaemonTrust(
   );
 }
 
-function isLoopbackHostname(hostname: string): boolean {
-  const normalized = hostname
-    .trim()
-    .toLowerCase()
-    .replace(/^\[(.*)\]$/, '$1');
-  if (normalized === 'localhost') return true;
-  if (net.isIPv4(normalized)) return LOOPBACK_BLOCK_LIST.check(normalized, 'ipv4');
-  if (net.isIPv6(normalized)) return LOOPBACK_BLOCK_LIST.check(normalized, 'ipv6');
-  return false;
-}
-
 export function attachSessionAddressHints(
   response: DaemonResponse,
   req: Omit<DaemonWireRequest, 'token'>,
```

**File**: `packages/daemon-contracts/src/daemon-resolution-loopback.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { expect, test } from 'vitest';
+import { daemonBaseUrlIsLocal, isLoopbackHostname } from './daemon-resolution.ts';
+
+test('a daemon base URL on loopback addresses this machine', () => {
+  expect(daemonBaseUrlIsLocal(undefined)).toBe(true);
+  expect(daemonBaseUrlIsLocal('')).toBe(true);
+  expect(daemonBaseUrlIsLocal('http://localhost:4560')).toBe(true);
+  expect(daemonBaseUrlIsLocal('http://127.0.0.1:4560/rpc')).toBe(true);
+  expect(daemonBaseUrlIsLocal('http://[::1]:4560')).toBe(true);
+});
+
+test('a daemon base URL off loopback addresses another machine', () => {
+  expect(daemonBaseUrlIsLocal('https://fleet.example.test')).toBe(false);
+  expect(daemonBaseUrlIsLocal('http://10.0.0.7:4560')).toBe(false);
+  // An unusable base URL is refused when the transport resolves it; here it is treated as remote.
+  expect(daemonBaseUrlIsLocal('not a url')).toBe(false);
+});
+
+test('loopback hostnames are recognized in each spelling a base URL carries', () => {
+  expect(isLoopbackHostname('LocalHost ')).toBe(true);
+  expect(isLoopbackHostname('127.0.0.1')).toBe(true);
+  expect(isLoopbackHostname('[::1]')).toBe(true);
+  expect(isLoopbackHostname('::ffff:127.0.0.1')).toBe(true);
+  expect(isLoopbackHostname('0.0.0.0')).toBe(false);
+  expect(isLoopbackHostname('127.1.2.3')).toBe(true);
+  expect(isLoopbackHostname('localhost.example.test')).toBe(false);
+  expect(isLoopbackHostname('')).toBe(false);
+});
```

**File**: `packages/daemon-contracts/src/daemon-resolution.ts` (modified, +34/-0)
```diff
@@ -1,5 +1,6 @@
 import crypto from 'node:crypto';
 import fs from 'node:fs';
+import net from 'node:net';
 import path from 'node:path';
 import {
   admitPrivateRoot,
@@ -258,6 +259,39 @@ export function resolveDaemonServerMode(raw: string | undefined): DaemonServerMo
   return 'socket';
 }
 
+const LOOPBACK_BLOCK_LIST = new net.BlockList();
+LOOPBACK_BLOCK_LIST.addSubnet('127.0.0.0', 8, 'ipv4');
+LOOPBACK_BLOCK_LIST.addAddress('::1', 'ipv6');
+LOOPBACK_BLOCK_LIST.addSubnet('::ffff:127.0.0.0', 104, 'ipv6');
+
+/**
+ * Whether a daemon base URL addresses this machine. A caller on a non-loopback daemon drives devices
+ * hosted elsewhere, so it must not read this machine's state to answer a question about them.
+ */
+export function daemonBaseUrlIsLocal(raw: string | undefined): boolean {
+  if (!raw) return true;
+  let hostname: string;
+  try {
+    hostname = new URL(raw).hostname;
+  } catch {
+    // An unusable base URL is refused when the transport resolves it; treat it as remote here.
+    return false;
+  }
+  return isLoopbackHostname(hostname);
+}
+
+/** Whether an address names this machine: `localhost` or a loopback literal. */
+export function isLoopbackHostname(hostname: string): boolean {
+  const normalized = hostname
+    .trim()
+    .toLowerCase()
+    .replace(/^\[(.*)\]$/, '$1');
+  if (normalized === 'localhost') return true;
+  if (net.isIPv4(normalized)) return LOOPBACK_BLOCK_LIST.check(normalized, 'ipv4');
+  if (net.isIPv6(normalized)) return LOOPBACK_BLOCK_LIST.check(normalized, 'ipv6');
+  return false;
+}
+
 export function resolveDaemonTransportPreference(
   raw: string | undefined,
 ): DaemonTransportPreference {
```

**File**: `packages/react-native/src/index.ts` (modified, +9/-0)
```diff
@@ -1,4 +1,5 @@
 import type { MetroSessionOptions, MetroSessionOpenInput } from './metro/metro-session-hints.ts';
+import type { MetroAppTarget } from './metro/metro-dev-server-discovery.ts';
 import type { SessionRuntimeHints } from '@agent-device/kernel/contracts';
 import type { HostEnvironment } from '@agent-device/kernel/source-value';
 import { resolveRuntimeTransportHints } from '@agent-device/host-kit/runtime-transport-hints';
@@ -10,6 +11,7 @@ import type { ReactDevtoolsOutput } from './react-devtools/react-devtools-output
 
 export type { PrepareMetroRuntimeOptions, ReloadMetroOptions } from './metro/client-metro.ts';
 export type { PrepareMetroRuntimeResult, ReloadMetroResult } from '@agent-device/contracts/remote';
+export type { MetroAppTarget } from './metro/metro-dev-server-discovery.ts';
 export type { MetroBridgeDescriptor } from './metro/metro-types.ts';
 export type { ReactDevtoolsCommandOptions } from './react-devtools/react-devtools-connection.ts';
 export type { ReactDevtoolsOutput } from './react-devtools/react-devtools-output.ts';
@@ -96,6 +98,13 @@ export async function readMetroSessionRuntime(
   return session.readMetroSessionRuntime(options);
 }
 
+export async function readMetroSessionAppTarget(
+  options: MetroSessionOptions,
+): Promise<MetroAppTarget | undefined> {
+  const session = await import('./metro/metro-session-hints.ts');
+  return session.readMetroSessionAppTarget(options);
+}
+
 export async function clearMetroSessionHintsQuietly(options: MetroSessionOptions): Promise<void> {
   const session = await import('./metro/metro-session-hints.ts');
   session.clearMetroSessionHintsQuietly(options);
```

#### Recent Merged Pull Requests:
- **PR #5130** (2026-11-26): perf(ios-runner): settle post-snapshot interactions on a deadline, not a fixed sleep (@imranbarbhuiya)
- **PR #5128** (2026-11-26): fix(plugins): preserve pins in provider recovery (@thymikee)
- **PR #5127** (2026-11-26): feat(settings): set the time zone on iOS simulators and Android (@imranbarbhuiya)
- **PR #5126** (2026-11-26): fix(cli): bound hosted refusal amounts by the --max-usd width (@thymikee)
- **PR #5124** (2026-11-26): fix(sdk): expose the version-matched ref pin formatter (@thymikee)
- **PR #5119** (2026-11-26): perf(android): run settings permission all in one adb shell per batch (@imranbarbhuiya)

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

## X. daemon-client): name a sandbox-denied connect and leave that daemon alone

**RULE**:
When implementing operations in `packages/daemon-client/src/__tests__/daemon-client-ensure-drain.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2d29b6d6`: daemon-client): name a sandbox-denied connect and leave that daemon alone. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/daemon-client/src/__tests__/daemon-client-ensure-drain.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
// The escalation route: a daemon still running at the drain deadline that answers no probe gets force
// retired. A connect the HOST refused is not a missed probe, so this route names the sandbox instead.
test('a drain that outlives the deadline with a probe the host refused signals nothing', async (t) => {
  if (!(await withLoopback(t))) return;
  const { stateDir, paths } = stateDirAndPaths();
  let childPid = 0;
  const drain = installVirtualDrain(() => childPid);
  const stale = await startScriptedDaemon(draining, {
    afterRpc: () => {
      drain.begin(undefined);
      void closeLoopbackServer(stale.server);
    },
  });
  const { child } = await registerDaemon(paths, {
    httpPort: stale.port,
    version: '0.0.0-stale',
    capabilities: ['quiesce'],
  });
  childPid = child.pid;
  const liveness = await import('../daemon-client-liveness-probe.ts');
  vi.spyOn(liveness, 'answersLivenessProbe').mockResolvedValue({
    reachable: false,
    denial: { errno: 'EPERM', transport: 'socket', port: stale.port },
  });

  try {
    await assert.rejects(ensureDaemon({ stateDir, daemonTransport: 'http' }), (error: unknown) => {
      assert.ok(error instanceof AppError);
      ass
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2d29b6d6` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
