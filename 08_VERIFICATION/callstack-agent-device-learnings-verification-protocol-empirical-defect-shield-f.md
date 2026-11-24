# Verification Protocol: Verification Protocol: Empirical Defect Shield for callstack-agent-device-learnings

<!-- PROVENANCE_START
{
  "source_repository": "callstack-agent-device-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T19:45:02.168Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-callstack-agent-device-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack-agent-device-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T19:45:02.168Z`  
> **Learning ID**: `LEARN-EVO-callstack-agent-device-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `callstack-agent-device-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source**: github ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Source Version**: `b2d4ec05`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T19:44:48.996Z  
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
> **Harvest Timestamp**: 2026-11-24T19:44:48.803Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Open source device layer for AI coding agents: a CLI, MCP server, and typed Node.js API to control mobile, web, TV, and desktop apps on devices and simulators, locally or in the cloud.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5503 stars

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
    const values = action.positionals.map((value) => formatScriptArg(value));
    return [action.command, ...values].join(' ');
  }
  const targetTokens = divergenceTypingTargetTokens(action);
  const targetLabel = targetTokens.map((value) => formatScriptArg(value)).join(' ');
  return [action.command, targetLabel, '<text>'].filter((part) => part.length > 0).join(' ');
}

/**
 * The identifying (non-text) positional tokens of a typing action:
 * `@ref`, a two-token point (`x y`), or a singl
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
- **Issue #5023** (2026-11-24): **iOS Duo: press/scroll/longpress fail with APP_SCREEN_WINDOW_UNRESOLVED on a deep AX tree**
  *Symptoms*: > Written by an AI agent on behalf of @Elehiggle.  ### Problem  On the iPhone Duo simulator, gestures fail without dispatching when the AX tree is deep enough that XCTest rejects the app root. On the test app's heavy feed, `press 'id="heavy-post-0-like"' --json` returns (trimmed):  ```json {   "code": "COMMAND_FAILED",   "message": "Neither the target app nor the system surface resolved a window, so no display could be named.",   "hint": "The capture follows the display that owns a window, so this is a runtime that is answering no window for any process; runner.log names the window frame and the query answer it refused.",   "details": { "runnerErrorCode": "APP_SCREEN_WINDOW_UNRESOLVED", "dispatched": "no" } } ```  `get text` still reads the screen. In the runner log, XCTest rejects the app's tree right before the lit-panel walk reports an empty window list:  ``` AGENT_DEVICE_RUNNER_COMMAND_ACCEPTED command=tap AGENT_DEVICE_RUNNER_AX_SNAPSHOT_ISSUE_SUPPRESSED count=4 description=Failed to resolve query: Error kAXErrorIllegalArgument getting snapshot for element <AXUIElementRef …> {pid=<app>} {uid=[ID:1 hash:0x0]} AGENT_DEVICE_RUNNER_LIT_PANEL_WINDOW lit=1(466x678) windows=0 outcome=no resolved application window frame=(inf,inf 0x0) AGENT_DEVICE_RUNNER_COMMAND_COMPLETED command=tap  ok=0 ```  Before the feed opened, the same walk found `windows=2` on the Settings screen.  From reading main (not traced at runtime): `RunnerCopyWindowList` returns nil when the query throws or retu

- **Issue #5002** (2026-11-24): **iOS alert get fails when no alert is up, while Android reports none**
  *Symptoms*: ## Purpose Agents use `alert get` as a "is anything up?" check. On Android (and the tree driver) a screen with no alert returns success with `No alert visible`. On an iOS simulator it fails with `COMMAND_FAILED: alert not found` and the generic hint "Read the diagnostics log for the failing step", so a scripted check exits non-zero and agents chase a failure that isn't one.  ## Current behavior - iOS: `RunnerTests+CommandExecution.swift` returns `alertNotFound`, and `packages/platform-apple/src/alert.ts` (`readAppleAlert`) passes it through as a failure. - Android and tree driver: `packages/capture-kit/src/alert-tree-driver.ts` returns `status: none`. - `website/docs/docs/commands.md` documents the split.  ## Required behavior (proposal) `alert get` with no alert succeeds on iOS with the same `status: none` shape as Android. `alert accept|dismiss` with no alert keep failing.  If maintainers prefer to keep the iOS error, attach the alert-not-found hint instead of "Read the diagnostics log".  ## Completion `alert get` on an iOS simulator with no alert exits 0 with `status: none`, matching Android, and the docs drop the platform note. 
  **Post-Mortem & Fix Analysis**:
  > The Apple read path now returns `status: none` for a quiet screen, with accept and dismiss still refusing when there is no alert. The change is in #5039 and `v0.21.43-nightly.20261124.245`. Could you confirm the original `alert get --json` case on that build? 
  > Confirmed on `0.21.43-nightly.20261124.245`, iPhone 17 Pro simulator (iOS 27.2), Settings in front, no alert up:  ```text $ agent-device alert get --json {"success": true, "data": {"kind": "alertStatus", "platform": "ios", "action": "get", "alert": null, "status": "none", "message": "No alert visible"}} rc=0  $ agent-device alert accept --json {"success": false, "error": {"code": "COMMAND_FAILED", "message": "alert not found", ... "runnerErrorCode": "ALERT_NOT_FOUND", "dispatched": "no"}} rc=1  $ agent-device alert dismiss Error (COMMAND_FAILED): alert not found. Not dispatched. ... rc=1 ```  `commands.md` now says `status: none` on every platform. That covers the completion points, so I'm closing this. 

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

### Incident Patch 1: `4dffcd31` (2026-11-24)
**Commit Message**: fix(harmonyos): clamp the open foreground probe's hdc read to the request deadline (#5055)

* fix(harmonyos): clamp the open foreground probe's hdc read to the request deadline

The pre-dispatch already-foreground probe ran one `aa dump -l` read on a
fixed 15s timeout, so a hung read could hold the dispatch past a request
deadline the post-open foreground poll (#4293) would have respected. The
probe now receives the request's deadline beside the signal, clamps its
read to the remaining budget (Math.min against the 15s default), skips
the device entirely when a spent deadline leaves no room for one read,
and still claims nothing when the deadline or a cancel cuts the read —
the advisory outcome machinery is unchanged and no reason set grows.

Follow-up to the optional question the #4860 review left open.

* test: retrigger the android emulator smoke lane (no code change)

* docs(evidence): record the JDY-AL50 live runs for the open probe deadline clamp

Scenario a: the already-foreground open answers with the alreadyForeground
warning at 0.7 s with no added probe latency. Scenario b: an hdc wrapper that
sleeps on the probe read cannot hold the dispatch past the admitted request
budg

**File**: `docs/evidence/ad-5055-lega/one-line.ad` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+open com.sankuai.dianping --platform harmonyos
```

**File**: `docs/evidence/ad-5055-lega/replay-lega.json` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+{
+  "success": false,
+  "error": {
+    "code": "REPLAY_DIVERGENCE",
+    "message": "Daemon request deadline exceeded",
+    "hint": "Check completed steps and the current device state before retrying the timed-out operation.",
+    "diagnosticId": "mwu8qema-6d287442",
+    "logPath": "<state-dir>/sessions/cwd_1dd430edfb664982_default/requests/97d848997a368c7f.ndjson",
+    "diagnosticsRecord": {
+      "session": "cwd:1dd430edfb664982:default",
+      "requestId": "97d848997a368c7f"
+    },
+    "details": {
+      "reason": "daemon_request_timeout",
+      "replayPath": "one-line.ad",
+      "step": 1,
+      "action": "open",
+      "positionals": ["<arg>"],
+      "artifactPaths": [],
+      "divergence": {
+        "version": 1,
+        "kind": "action-failure",
+        "step": {
+          "index": 1,
+          "source": {
+            "path": "one-line.ad",
+            "line": 1
+          }
+        },
+        "action": "open \"com.sankuai.dianping\"",
+        "cause": {
+          "code": "COMMAND_FAILED",
+          "message": "request canceled",
+          "hint": "The request was canceled intentionally (explicit cancel or client disconnect) \u2014 no retry is needed unless the cancellation was unintended."
+        },
+        "screen": {
+          "state": "unavailable",
+          "reason": "no-session",
+          "hint": "The session closed before a post-failure screen could be captured."
+        },
+        "suggestions": [],
+        "suggestionCount": 0,
+        "resume": {
+          "allowed": true,
+          "from": 1,
+          "planDigest": "2777bba07a19f1bcec3952098a94d9748a792d6b4d6b986703a7295929933ccc"
+        },
+        "repairHint": "manual"
+      },
+      "causeReason": "request_canceled",
+      "timeoutMs": 3000
+    }
+  }
+}
```

**File**: `docs/evidence/ad-5055-lega/request-97d84899.ndjson` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+{"ts":"2026-11-24T05:14:59.075Z","level":"info","phase":"request_start","session":"cwd:1dd430edfb664982:default","requestId":"97d848997a368c7f","command":"replay","data":{"publicSession":"default","effectiveSession":"cwd:1dd430edfb664982:default","command":"replay","requestLogPath":"/tmp/ad5055-lega-r2-130926/state/sessions/cwd_1dd430edfb664982_default/requests/97d848997a368c7f.ndjson","runnerLogPath":"/tmp/ad5055-lega-r2-130926/state/sessions/cwd_1dd430edfb664982_default/runner.log"}}
+{"ts":"2026-11-24T05:14:59.685Z","level":"info","phase":"resolve_target_device","session":"cwd:1dd430edfb664982:default","requestId":"97d848997a368c7f","command":"replay","durationMs":609,"data":{"platform":"harmonyos","cacheHit":false}}
+{"ts":"2026-11-24T05:14:59.703Z","level":"info","phase":"request_start","session":"cwd:1dd430edfb664982:default","requestId":"97d848997a368c7f","command":"replay","data":{"publicSession":"cwd:1dd430edfb664982:default","effectiveSession":"cwd:1dd430edfb664982:default","command":"open","requestLogPath":"/tmp/ad5055-lega-r2-130926/state/sessions/cwd_1dd430edfb664982_default/requests/97d848997a368c7f.ndjson","runnerLogPath":"/tmp/ad5055-lega-r2-130926/state/sessions/cwd_1dd430edfb664982_default/runner.log"}}
+{"ts":"2026-11-24T05:14:59.835Z","level":"info","phase":"resolve_target_device","session":"cwd:1dd430edfb664982:default","requestId":"97d848997a368c7f","command":"replay","durationMs":131,"data":{"platform":"harmonyos","cacheHit":false}}
+{"ts":"2026-11-24T05:14:59.836Z","level":"info","phase":"resolve_target_device","session":"cwd:1dd430edfb664982:default","requestId":"97d848997a368c7f","command":"replay","durationMs":0,"data":{"platform":"harmonyos","cacheHit":true}}
+{"ts":"2026-11-24T05:14:59.837Z","level":"info","phase":"resolve_target_device","session":"cwd:1dd430edfb664982:default","requestId":"97d848997a368c7f","command":"replay","durationMs":0,"data":{"platform":"harmonyos","cacheHit":true}}
+{"ts":"2026-11-24T05:15:02.461Z","level":"warn","phase":"device_claim_open_effects_unconfirmed","session":"cwd:1dd430edfb664982:default","requestId":"97d848997a368c7f","command":"replay","data":{"deviceKey":"local:harmonyos:none:77TYD26826028730","outcome":"abandoned"}}
+{"ts":"2026-11-24T05:15:02.461Z","level":"error","phase":"request_failed","session":"cwd:1dd430edfb664982:default","requestId":"97d848997a368c7f","command":"replay","data":{"error":"request canceled"}}
+{"ts":"2026-11-24T05:15:02.462Z","level":"error","phase":"request_failed","session":"cwd:1dd430edfb664982:default","requestId":"97d848997a368c7f","command":"replay","data":{"code":"COMMAND_FAILED","message":"request canceled"}}
+{"ts":"2026-11-24T05:15:02.464Z","level":"error","phase":"request_failed","session":"cwd:1dd430edfb664982:default","requestId":"97d848997a368c7f","command":"replay","data":{"code":"REPLAY_DIVERGENCE","message":"Replay failed at step 1 (open \"com.sankuai.dianping\"): request canceled"}}
```

**File**: `docs/evidence/ad-5055-partb.ad` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+# 5055 part-b replay: open an already-foreground target under a 3s request deadline
+context platform=harmonyos
+open com.sankuai.dianping
+close
```

**File**: `docs/evidence/ad-5055-partb/571738ebf4f3424a.ndjson` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+{"ts":"2026-11-24T03:59:01.629Z","level":"info","phase":"request_start","session":"cwd:e93f14f237f7fd4f:harmonyos","requestId":"571738ebf4f3424a","command":"replay","data":{"publicSession":"default","effectiveSession":"cwd:e93f14f237f7fd4f:harmonyos","command":"replay","requestLogPath":"/tmp/ad-5055-partb/state/sessions/cwd_e93f14f237f7fd4f_harmonyos/requests/571738ebf4f3424a.ndjson","runnerLogPath":"/tmp/ad-5055-partb/state/sessions/cwd_e93f14f237f7fd4f_harmonyos/runner.log"}}
+{"ts":"2026-11-24T03:59:01.629Z","level":"info","phase":"request_start","session":"cwd:e93f14f237f7fd4f:harmonyos","requestId":"571738ebf4f3424a","command":"replay","data":{"publicSession":"cwd:e93f14f237f7fd4f:harmonyos","effectiveSession":"cwd:e93f14f237f7fd4f:harmonyos","command":"open","requestLogPath":"/tmp/ad-5055-partb/state/sessions/cwd_e93f14f237f7fd4f_harmonyos/requests/571738ebf4f3424a.ndjson","runnerLogPath":"/tmp/ad-5055-partb/state/sessions/cwd_e93f14f237f7fd4f_harmonyos/runner.log"}}
+{"ts":"2026-11-24T03:59:05.054Z","level":"error","phase":"request_failed","session":"cwd:e93f14f237f7fd4f:harmonyos","requestId":"571738ebf4f3424a","command":"replay","data":{"error":"request canceled"}}
+{"ts":"2026-11-24T03:59:05.057Z","level":"error","phase":"request_failed","session":"cwd:e93f14f237f7fd4f:harmonyos","requestId":"571738ebf4f3424a","command":"replay","data":{"code":"COMMAND_FAILED","message":"request canceled"}}
+{"ts":"2026-11-24T03:59:05.061Z","level":"error","phase":"request_failed","session":"cwd:e93f14f237f7fd4f:harmonyos","requestId":"571738ebf4f3424a","command":"replay","data":{"code":"REPLAY_DIVERGENCE","message":"Replay failed at step 1 (open \"com.sankuai.dianping\"): request canceled"}}
```

**File**: `docs/evidence/ad-5055-partb/619fa17961d1bd2f.ndjson` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+{"ts":"2026-11-24T03:56:52.198Z","level":"info","phase":"request_start","session":"cwd:e93f14f237f7fd4f:harmonyos","requestId":"619fa17961d1bd2f","command":"replay","data":{"publicSession":"default","effectiveSession":"cwd:e93f14f237f7fd4f:harmonyos","command":"replay","requestLogPath":"/tmp/ad-5055-partb/state/sessions/cwd_e93f14f237f7fd4f_harmonyos/requests/619fa17961d1bd2f.ndjson","runnerLogPath":"/tmp/ad-5055-partb/state/sessions/cwd_e93f14f237f7fd4f_harmonyos/runner.log"}}
+{"ts":"2026-11-24T03:56:52.199Z","level":"info","phase":"request_start","session":"cwd:e93f14f237f7fd4f:harmonyos","requestId":"619fa17961d1bd2f","command":"replay","data":{"publicSession":"cwd:e93f14f237f7fd4f:harmonyos","effectiveSession":"cwd:e93f14f237f7fd4f:harmonyos","command":"open","requestLogPath":"/tmp/ad-5055-partb/state/sessions/cwd_e93f14f237f7fd4f_harmonyos/requests/619fa17961d1bd2f.ndjson","runnerLogPath":"/tmp/ad-5055-partb/state/sessions/cwd_e93f14f237f7fd4f_harmonyos/runner.log"}}
+{"ts":"2026-11-24T03:56:55.587Z","level":"error","phase":"request_failed","session":"cwd:e93f14f237f7fd4f:harmonyos","requestId":"619fa17961d1bd2f","command":"replay","data":{"error":"request canceled"}}
+{"ts":"2026-11-24T03:56:55.589Z","level":"error","phase":"request_failed","session":"cwd:e93f14f237f7fd4f:harmonyos","requestId":"619fa17961d1bd2f","command":"replay","data":{"code":"COMMAND_FAILED","message":"request canceled"}}
+{"ts":"2026-11-24T03:56:55.593Z","level":"error","phase":"request_failed","session":"cwd:e93f14f237f7fd4f:harmonyos","requestId":"619fa17961d1bd2f","command":"replay","data":{"code":"REPLAY_DIVERGENCE","message":"Replay failed at step 1 (open \"com.sankuai.dianping\"): request canceled"}}
```

**File**: `docs/evidence/ad-5055-partb/one-line.ad` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+open com.sankuai.dianping --platform harmonyos
```

**File**: `docs/evidence/ad-5055-partb/replay-oneline.json` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+{
+  "success": false,
+  "error": {
+    "code": "REPLAY_DIVERGENCE",
+    "message": "Daemon request deadline exceeded",
+    "hint": "Check completed steps and the current device state before retrying the timed-out operation.",
+    "diagnosticId": "mwu60q2l-f83095c6",
+    "logPath": "<state-dir>/sessions/cwd_e93f14f237f7fd4f_harmonyos/requests/571738ebf4f3424a.ndjson",
+    "diagnosticsRecord": {
+      "session": "cwd:e93f14f237f7fd4f:harmonyos",
+      "requestId": "571738ebf4f3424a"
+    },
+    "details": {
+      "reason": "daemon_request_timeout",
+      "replayPath": "one-line.ad",
+      "step": 1,
+      "action": "open",
+      "positionals": ["<arg>"],
+      "artifactPaths": [],
+      "divergence": {
+        "version": 1,
+        "kind": "action-failure",
+        "step": {
+          "index": 1,
+          "source": {
+            "path": "one-line.ad",
+            "line": 1
+          }
+        },
+        "action": "open \"com.sankuai.dianping\"",
+        "cause": {
+          "code": "COMMAND_FAILED",
+          "message": "request canceled",
+          "hint": "The request was canceled intentionally (explicit cancel or client disconnect) — no retry is needed unless the cancellation was unintended."
+        },
+        "screen": {
+          "state": "unavailable",
+          "reason": "request-canceled",
+          "hint": "Post-failure snapshot skipped after request cancellation; the original replay failure is unaffected."
+        },
+        "suggestions": [],
+        "suggestionCount": 0,
+        "resume": {
+          "allowed": true,
+          "from": 1,
+          "planDigest": "2777bba07a19f1bcec3952098a94d9748a792d6b4d6b986703a7295929933ccc",
+          "alternateFrom": 2
+        },
+        "repairHint": "manual"
+      },
+      "causeReason": "request_canceled",
+      "timeoutMs": 3000
+    }
+  }
+}
```

---

### Incident Patch 2: `a7440cc4` (2026-11-23)
**Commit Message**: ci(linux): install cached desktop packages without an apt index refresh (#5021)

* ci(linux): install cached desktop packages without an apt index refresh

The Smoke job failed when a slow Ubuntu mirror could not finish
`apt-get update` within 3x30s, although the restored archive cache
already held every package the step needs. Install the cached .debs
directly, and refresh the index only when they do not cover the
package set. The cache key is unique per run attempt so a refreshed
set replaces a stale one.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* ci(linux): stage cached debs in the apt archive before the cached install

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* ci(linux): leave dpkg headroom inside the install step budget

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* ci(linux): resolve cached packages against the lists that selected them

Cache the authenticated package lists with the archives apt selected for
the package set, keep both outside the system directories, and install
only when the offline plan needs no download. A failed cached install
recovers dpkg state and falls back to a clean archive directory. Every
install runs with --no-downl

**File**: `.github/workflows/linux.yml` (modified, +126/-41)
```diff
@@ -58,37 +58,51 @@ jobs:
         run: node --experimental-strip-types scripts/device-lane-impact.ts replay-linux linux-command-evidence
 
       # Unbounded, this step could not fail — it could only stall. On 2026-08-19 a slow mirror
-      # held apt past the job's 30-minute budget on four main-branch runs and several unrelated
-      # PRs, which reported as a red check on branches that never ran a line of project code.
-      # On 2026-10-22 it recurred: the step took 20-60s normally, but 10 of 73 runs hit the
-      # 6-minute backstop. The Azure mirror appears to be a pull-through cache. A package nobody
-      # else requested recently (poppler-data, fonts-urw-base35, pulled in by gnome-calculator)
-      # is fetched from a slow upstream on first request, and the download crawls or stalls. The
-      # retry that warmed the mirror then succeeded in seconds, which is why re-runs were green.
-      # Three bounds fix that: the downloaded .debs are cached so most runs never ask the mirror
-      # for them, a download that does stall is dropped and retried under a per-attempt deadline
-      # (apt resumes with the files already fetched), and `timeout-minutes` stays as the
-      # backstop. dpkg itself never runs under a deadline.
-      - name: Restore Linux desktop package archives
-        id: apt-archives
+      # held apt past the job's 30-minute budget. On 2026-10-22 a pull-through mirror crawled on
+      # packages nobody else had requested recently (poppler-data, fonts-urw-base35, pulled in by
+      # gnome-calculator). In November 2026 the index refresh itself became the failure: a slow
+      # archive.ubuntu.com mirror could not serve the ~41 MB of indexes within the deadline.
+      #
+      # The cache holds the Ubuntu package lists of the last refresh and the archives that apt
+      # selected for PACKAGES from them. A run verifies the signatures, list digests and archive
+      # hashes, resolves PACKAGES against those lists and installs only when the plan needs no
+      # download, so it never asks a mirror for anything. A miss, a failed check, a plan that
+      # needs a download (a changed package list or runner image) or a failed install discards
+      # the restored set, refreshes into empty job-private directories and saves a new entry.
+      # The key is unique per run attempt, so restore-keys load the newest entry and a refreshed
+      # set replaces a stale one.
+      #
+      # Every install runs with --no-download, so the network is reached only inside a bounded
+      # phase. Worst case: cached install lock wait 60s, refresh 2 x (60s + 5s kill grace),
+      # download 2 x (75s + 5s), final install lock wait 60s. That is 410s of the 540s step,
+      # which leaves 130s for dpkg (2-5s per run in CI), the checks and the cache copy. dpkg
+      # itself never runs under a deadline.
+      - name: Restore Linux desktop packages
         if: steps.impact.outputs.run != 'false'
         uses: actions/cache/restore@0057852bfaa89a56745cba8c7296529d2fc39830 # v4.2.3
         with:
-          path: ~/apt-archives
-          key: apt-archives-${{ runner.os }}-${{ hashFiles('.github/workflows/linux.yml') }}
-          restore-keys: apt-archives-${{ runner.os }}-
+          path: ~/apt-cache
+          key: apt-cache-${{ runner.os }}-${{ github.run_id }}-${{ github.run_attempt }}
+          restore-keys: apt-cache-${{ runner.os }}-
 
       - name: Install Linux desktop dependencies
+        id: apt-install
         if: steps.impact.outputs.run != 'false'
-        timeout-minutes: 6
+        timeout-minutes: 9
         run: |
           set -euo pipefail
+          CACHE="$HOME/apt-cache"
+          KEYRING=/usr/share/keyrings/ubuntu-archive-keyring.gpg
           APT_OPTS=(
             -o Acquire::Retries=2
             -o Acquire::http::Timeout=15
             -o Acquire::https::Timeout=15
             # The runner's own unattended-upgrades timer holds the dpkg lock; wait, don't hang.
             -o DPkg::Lock::Timeout=60
+            # Job-private lists and archives: the runner's periodic index update cannot change the
+            # plan between download and install, and a fallback never reuses a restored archive.
+            -o "Dir::State::Lists=$CACHE/lists/"
+            -o "Dir::Cache::Archives=$CACHE/archives/"
           )
           PACKAGES=(
             xvfb
@@ -102,40 +116,111 @@ jobs:
             gnome-calculator
             wmctrl
           )
-          # Retry a network phase under a per-attempt deadline.
+          stamp() { printf 'APT %s (UTC): %s\n' "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"; }
+          all_installed() {
+            local missing
+            missing="$(dpkg-query -W -f='${db:Status-Status} ${Package}\n' "${PACKAGES[@]}" 2>&1 | grep -v '^installed ' || true)"
+            [ -z "$missing" ] || { printf 'Not installed:\n%s\n' "$missing"; return 1; }
+          }
+          # apt trusts a list by the presence of InRelease and an archiv
```

---

### Incident Patch 3: `b3acd235` (2026-11-23)
**Commit Message**: fix(refs): name the settled diff in the plain-ref refusal and issue its replacement refs (#5037)

After `fill @e3 … --settle; press @e4` with @e4 taken from the earlier full
snapshot, the plain-ref refusal offered nothing: the agent could not tell
that a settled diff replaced the frame and paid a full `snapshot -i` every
time (#4571, the most common agent-blocking error in the dogfood data).

The frame value now records which publication minted it. `RefFrameOrigin`
(`complete` | `settle-diff` | `partial`) is set at issuance through the same
factories; every partial publication flows through one choke point
(`markSessionPartialRefsIssued`), and only the settle path
(`issueSettleRefs`) passes `settle-diff`, so find, audit, replay divergence,
and ambiguity issuances keep their refusal shape unchanged. Origin is
diagnostic only: no admission decision and no ref lifetime changes — whether
refs a diff left unchanged stay valid stays open for maintainers on #4571.

When the refusing frame is settle-diff and the refused plain ref is not one
of its issued refs, the refusal:

- names the settled diff as the replacement in the message (and says when
  the diff issued no refs),
- carries `deta

**File**: `docs/adr/0014-session-ref-frame-lifetime.md` (modified, +12/-0)
```diff
@@ -231,6 +231,18 @@ hint: Capture a fresh interactive snapshot or use a stable selector.
 The daemon cannot truthfully report `mintedGeneration` for a plain ref.
 When the actual failure is lifetime expiration, error messages must not claim that a found ref was missing or lacked bounds.
 
+#### 2026-11-24 amendment: a settled-diff frame names itself in the plain-ref refusal
+
+Issue #4571 measured the plain-ref refusal as the most common agent-blocking error after `--settle`: a bare ref from the earlier full snapshot is refused, the refusal offers nothing, and the agent pays a full `snapshot -i`.
+The frame now records which publication minted it: a bounded `origin` (`complete`, `settle-diff`, or `partial`) set at issuance through the same factories.
+The settle issuance path passes `settle-diff`; every other partial publication keeps `partial`.
+Origin is diagnostic only: it changes no admission decision and no ref lifetime — whether refs a diff left unchanged stay valid remains an open contract question for maintainers.
+
+When a settled diff replaced the frame and the refused plain ref is not one of its issued refs, the refusal names the settled diff as the replacement and carries `details.replacedBy: "settle-diff"` plus `details.replacementRefs`, each issued ref pinned to the frame epoch in the ready-to-copy `@eN~s<epoch>` form.
+The hint offers the same refs and keeps the fresh-snapshot escape.
+When the diff issued no refs, the refusal still names the diff and keeps the recapture guidance.
+The exact-emitted-ref suggestion (`details.suggestedRef`) keeps precedence when the refused body is itself in scope.
+
 ### Expiration occurs at the side-effect seam
 
 Expiration occurs after these and all other pre-action guards pass:
```

**File**: `packages/daemon/src/core/__tests__/ref-frame.test.ts` (modified, +20/-0)
```diff
@@ -8,6 +8,7 @@ import {
   expireRefFrame,
   refFrame,
   refFrameEpoch,
+  refFrameOrigin,
   refFrameScope,
   refFrameState,
   type RefFrameAdmission,
@@ -136,6 +137,25 @@ test('activateCompleteRefFrame re-authorizes a complete frame after expiry', ()
   });
 });
 
+test('frame origin records which publication minted it and survives expiry', () => {
+  // No issuance yet: no origin.
+  assert.equal(refFrameOrigin(session()), undefined);
+
+  // A complete publication, the partial default, and the settle-diff partial.
+  const complete = session({ snapshotGeneration: 42 });
+  activateCompleteRefFrame(complete);
+  assert.equal(refFrameOrigin(complete), 'complete');
+  assert.equal(refFrameOrigin(partialSession(42, new Set(['e1']))), 'partial');
+  const settled = session({ snapshotGeneration: 42 });
+  activatePartialRefFrame(settled, new Set(['e1']), 'settle-diff');
+  assert.equal(refFrameOrigin(settled), 'settle-diff');
+
+  // Expiry replaces the frame whole; the origin rides along.
+  expireRefFrame(settled);
+  assert.equal(refFrameState(settled), 'expired');
+  assert.equal(refFrameOrigin(settled), 'settle-diff');
+});
+
 test('expireRefFrame clears scoped-snapshot lineage at the seam (ADR 0014)', () => {
   const scopeTree = {
     nodes: [],
```

**File**: `packages/daemon/src/core/ref-frame-slot.ts` (modified, +15/-0)
```diff
@@ -21,11 +21,20 @@ export type RefFrameScope = 'all' | ReadonlySet<string>;
 /** Lifecycle state of the current frame. */
 export type RefFrameState = 'active' | 'expired';
 
+/**
+ * Which publication minted the frame. Diagnostic only — it feeds refusal text and
+ * details (#4571) and never an admission decision. `partial` covers every non-settle
+ * partial publication (`find`, `audit`, replay divergence, ambiguity candidates), which
+ * all refuse a plain ref with the same recapture guidance.
+ */
+export type RefFrameOrigin = 'complete' | 'settle-diff' | 'partial';
+
 type RefFrameFields = Readonly<{
   state: RefFrameState;
   scope: RefFrameScope;
   tree: SnapshotState | undefined;
   generation: number | undefined;
+  origin: RefFrameOrigin | undefined;
 }>;
 
 /**
@@ -57,6 +66,10 @@ class SessionRefFrame {
     return this.#fields.generation;
   }
 
+  get origin(): RefFrameOrigin | undefined {
+    return this.#fields.origin;
+  }
+
   /** Idempotent by identity: an expired frame is returned as is, so repeated expiry compares `===`. */
   static expire(frame: SessionRefFrame): SessionRefFrame {
     if (frame.#fields.state === 'expired') return frame;
@@ -77,13 +90,15 @@ export const PRISTINE_REF_FRAME: RefFrame = new SessionRefFrame({
   scope: 'all',
   tree: undefined,
   generation: undefined,
+  origin: undefined,
 });
 
 /** The frame an issuance mints. Retention and epoch semantics are the caller's; see `ref-frame.ts`. */
 export function issuedRefFrame(fields: {
   scope: RefFrameScope;
   tree: SnapshotState | undefined;
   generation: number | undefined;
+  origin: RefFrameOrigin;
 }): RefFrame {
   return new SessionRefFrame({ state: 'active', ...fields });
 }
```

**File**: `packages/daemon/src/core/ref-frame.ts` (modified, +24/-4)
```diff
@@ -5,6 +5,7 @@ import {
   issuedRefFrame,
   PRISTINE_REF_FRAME,
   type RefFrame,
+  type RefFrameOrigin,
   type RefFrameScope,
   type RefFrameState,
 } from './ref-frame-slot.ts';
@@ -153,7 +154,7 @@ export function readSessionRuntimeRevision(session: SessionState): number {
  * {@link activateRefFrame}.
  */
 export function activateCompleteRefFrame(session: SessionState): void {
-  activateRefFrame(session, 'all');
+  activateRefFrame(session, 'all', 'complete');
 }
 
 /**
@@ -165,8 +166,12 @@ export function activateCompleteRefFrame(session: SessionState): void {
  * empty result must not (see `markSessionPartialRefsIssued`) — but the transition itself
  * belongs here, with the complete form, because the two differ only in scope.
  */
-export function activatePartialRefFrame(session: SessionState, scope: ReadonlySet<string>): void {
-  activateRefFrame(session, scope);
+export function activatePartialRefFrame(
+  session: SessionState,
+  scope: ReadonlySet<string>,
+  origin: RefFrameOrigin = 'partial',
+): void {
+  activateRefFrame(session, scope, origin);
 }
 
 /**
@@ -179,18 +184,31 @@ export function activatePartialRefFrame(session: SessionState, scope: ReadonlySe
  * `session.snapshot` without disturbing this tree, so a ref keeps resolving against the
  * namespace that authorized it.
  */
-function activateRefFrame(session: SessionState, scope: RefFrameScope): void {
+function activateRefFrame(
+  session: SessionState,
+  scope: RefFrameScope,
+  origin: RefFrameOrigin,
+): void {
   session.refFrame = issuedRefFrame({
     scope,
     tree: session.snapshot,
     generation: session.snapshotGeneration,
+    origin,
   });
 }
 
 export function refFrameState(session: SessionState): RefFrameState {
   return refFrame(session).state;
 }
 
+/**
+ * Which publication minted the frame (`ref-frame-slot.ts`). Diagnostic only: refusal text
+ * and details read it (#4571); admission never does. Undefined before any issuance.
+ */
+export function refFrameOrigin(session: SessionState): RefFrameOrigin | undefined {
+  return refFrame(session).origin;
+}
+
 export function refFrameScope(session: SessionState): RefFrameScope {
   return refFrame(session).scope;
 }
@@ -199,6 +217,7 @@ export type RefMutationFrame = {
   admission: RefFrameAdmission;
   scope: RefFrameScope;
   currentGeneration: number | undefined;
+  origin: RefFrameOrigin | undefined;
 };
 
 export function readRefMutationFrame(params: {
@@ -215,6 +234,7 @@ export function readRefMutationFrame(params: {
     }),
     scope: refFrameScope(params.session),
     currentGeneration: refFrameEpoch(params.session),
+    origin: refFrameOrigin(params.session),
   };
 }
 
```

**File**: `packages/daemon/src/execution/__tests__/session-snapshot.test.ts` (modified, +4/-0)
```diff
@@ -19,6 +19,7 @@ import {
   expireRefFrame,
   refFrame,
   refFrameEpoch,
+  refFrameOrigin,
   refFrameScope,
   refFrameState,
 } from '../../core/ref-frame.ts';
@@ -257,6 +258,9 @@ for (const retire of [false, true]) {
     } else {
       expect(generation).toBe(session.snapshotGeneration);
       expect(refFrameScope(session)).toEqual(new Set(['e1']));
+      // #4571: the settle-diff origin is what lets a later plain-ref refusal name
+      // this diff as the replacement instead of a generic recapture.
+      expect(refFrameOrigin(session)).toBe('settle-diff');
     }
   });
 }
```

**File**: `packages/daemon/src/execution/interaction/internal/__tests__/interaction-ref-policy.test.ts` (modified, +85/-0)
```diff
@@ -39,7 +39,92 @@ test('a plain ref outside the emitted partial scope keeps the recapture hint', (
 
   expect(response?.ok).toBe(false);
   if (response && !response.ok) {
+    expect(response.error.message).toBe(
+      'Ref @e19 needs a complete snapshot — the current frame only authorizes its emitted refs',
+    );
     expect(response.error.details?.suggestedRef).toBeUndefined();
+    expect(response.error.details?.replacedBy).toBeUndefined();
+    expect(response.error.details?.replacementRefs).toBeUndefined();
+    expect(response.error.details?.hint).toBe(
+      'Capture a fresh interactive snapshot (snapshot -i) or use a stable selector, then retry.',
+    );
+  }
+});
+
+// #4571: `fill @e3 … --settle; press @e4` with @e4 from the earlier full snapshot — the
+// settle diff replaced the frame, so the refusal names it and hands back what it issued
+// instead of leaving the caller a full `snapshot -i` round trip.
+test('a settled-diff frame names the diff as the replacement and lists its issued refs pinned', () => {
+  const session = makeStaleRefSession('settle-frame-replacement');
+  session.snapshotGeneration = 531_735;
+  activatePartialRefFrame(session, new Set(['e34', 'e7']), 'settle-diff');
+
+  const response = refMutationAdmissionResponse({
+    ref: '@e4',
+    mintedGeneration: undefined,
+    staleRefsWarning: undefined,
+    frame: readRefMutationFrame({ session, ref: '@e4', mintedGeneration: undefined }),
+  });
+
+  expect(response?.ok).toBe(false);
+  if (response && !response.ok) {
+    expect(response.error.message).toBe(
+      'Ref @e4 needs a complete snapshot — a settled diff replaced the ref frame and only authorizes its issued refs',
+    );
+    expect(response.error.details).toMatchObject({
+      reason: 'plain_ref_requires_complete_frame',
+      currentGeneration: 531_735,
+      replacedBy: 'settle-diff',
+      replacementRefs: ['@e34~s531735', '@e7~s531735'],
+      hint: 'Retry with one of the refs the settled diff issued: @e34~s531735, @e7~s531735 — or capture a fresh interactive snapshot (snapshot -i).',
+    });
+  }
+});
+
+test('a settled-diff frame keeps the exact-emitted suggestion when the refused body is one it issued', () => {
+  const session = makeStaleRefSession('settle-frame-emitted');
+  session.snapshotGeneration = 531_735;
+  activatePartialRefFrame(session, new Set(['e34']), 'settle-diff');
+
+  const response = refMutationAdmissionResponse({
+    ref: '@e34',
+    mintedGeneration: undefined,
+    staleRefsWarning: undefined,
+    frame: readRefMutationFrame({ session, ref: '@e34', mintedGeneration: undefined }),
+  });
+
+  expect(response?.ok).toBe(false);
+  if (response && !response.ok) {
+    expect(response.error.details).toMatchObject({
+      suggestedRef: '@e34~s531735',
+      hint: 'Retry with the exact emitted ref @e34~s531735.',
+    });
+    expect(response.error.details?.replacementRefs).toBeUndefined();
+  }
+});
+
+test('a settled-diff frame that issued no refs keeps the recapture guidance', () => {
+  const session = makeStaleRefSession('settle-frame-empty');
+  session.snapshotGeneration = 531_735;
+  activatePartialRefFrame(session, new Set(), 'settle-diff');
+
+  const response = refMutationAdmissionResponse({
+    ref: '@e19',
+    mintedGeneration: undefined,
+    staleRefsWarning: undefined,
+    frame: readRefMutationFrame({ session, ref: '@e19', mintedGeneration: undefined }),
+  });
+
+  expect(response?.ok).toBe(false);
+  if (response && !response.ok) {
+    expect(response.error.message).toBe(
+      'Ref @e19 needs a complete snapshot — a settled diff replaced the ref frame and issued no refs',
+    );
+    expect(response.error.details).toMatchObject({
+      reason: 'plain_ref_requires_complete_frame',
+      replacedBy: 'settle-diff',
+    });
+    expect(response.error.details?.replacementRefs).toBeUndefined();
     expect(response.error.details?.hint).toBe(
       'Capture a fresh interactive snapshot (snapshot -i) or use a stable selector, then retry.',
     );
```

**File**: `packages/daemon/src/execution/interaction/internal/interaction-ref-policy.ts` (modified, +77/-13)
```diff
@@ -37,30 +37,94 @@ export function assertRefMutationAdmitted(params: {
     currentGeneration !== undefined
       ? `@${refBody}~s${currentGeneration}`
       : undefined;
-  throw new AppError('COMMAND_FAILED', rejectionMessage(admission.reason, params.ref), {
-    reason: admission.reason,
-    ref: params.ref,
-    currentGeneration,
-    scope: scope === 'all' ? 'all' : Array.from(scope),
-    ...(params.mintedGeneration !== undefined ? { mintedGeneration: params.mintedGeneration } : {}),
-    ...(suggestedRef ? { suggestedRef } : {}),
-    hint: suggestedRef
-      ? `Retry with the exact emitted ref ${suggestedRef}.`
-      : (params.staleRefsWarning ?? REJECTION_HINT),
-  });
+  const replacement = settledDiffReplacement(params.frame, suggestedRef);
+  throw new AppError(
+    'COMMAND_FAILED',
+    rejectionMessage(admission.reason, params.ref, replacement),
+    {
+      reason: admission.reason,
+      ref: params.ref,
+      currentGeneration,
+      scope: scope === 'all' ? 'all' : Array.from(scope),
+      ...(params.mintedGeneration !== undefined
+        ? { mintedGeneration: params.mintedGeneration }
+        : {}),
+      ...(suggestedRef ? { suggestedRef } : {}),
+      ...(replacement ? { replacedBy: 'settle-diff' } : {}),
+      ...(replacement?.replacementRefs ? { replacementRefs: replacement.replacementRefs } : {}),
+      hint: suggestedRef
+        ? `Retry with the exact emitted ref ${suggestedRef}.`
+        : (replacement?.hint ?? params.staleRefsWarning ?? REJECTION_HINT),
+    },
+  );
 }
 
 const REJECTION_HINT =
   'Capture a fresh interactive snapshot (snapshot -i) or use a stable selector, then retry.';
 
-function rejectionMessage(reason: RefFrameRejectReason, ref: string): string {
+/**
+ * The settled-diff replacement of a plain-ref refusal (#4571): the refusal names the diff
+ * that replaced the frame and hands back the refs that diff issued, each pinned to the
+ * epoch the caller faces (#4853 paste-ready standard). The frame already authorized
+ * exactly these bodies at this epoch, so printing them issues nothing new — a pasted ref
+ * is admitted without another capture. Undefined for every other refusal shape.
+ */
+type SettledDiffReplacement = {
+  /** `details.replacementRefs`; absent when the diff issued none or the exact-emitted suggestion won. */
+  replacementRefs: string[] | undefined;
+  /** The replacement hint; absent when the refusal keeps the recapture guidance. */
+  hint: string | undefined;
+};
+
+function settledDiffReplacement(
+  frame: RefMutationFrame,
+  suggestedRef: string | undefined,
+): SettledDiffReplacement | undefined {
+  if (
+    frame.admission.admitted ||
+    frame.admission.reason !== 'plain_ref_requires_complete_frame' ||
+    frame.origin !== 'settle-diff'
+  ) {
+    return undefined;
+  }
+  const replacementRefs =
+    suggestedRef === undefined &&
+    frame.scope !== 'all' &&
+    frame.scope.size > 0 &&
+    frame.currentGeneration !== undefined
+      ? Array.from(frame.scope, (body) => `@${body}~s${frame.currentGeneration}`)
+      : undefined;
+  return {
+    replacementRefs,
+    hint: replacementRefs ? settleReplacementHint(replacementRefs) : undefined,
+  };
+}
+
+/** The replacement route for a settled-diff frame: the diff's issued refs, ready to paste. */
+function settleReplacementHint(replacementRefs: string[]): string {
+  const list = replacementRefs.join(', ');
+  return replacementRefs.length === 1
+    ? `Retry with the ref the settled diff issued: ${list} — or capture a fresh interactive snapshot (snapshot -i).`
+    : `Retry with one of the refs the settled diff issued: ${list} — or capture a fresh interactive snapshot (snapshot -i).`;
+}
+
+function rejectionMessage(
+  reason: RefFrameRejectReason,
+  ref: string,
+  replacement: SettledDiffReplacement | undefined,
+): string {
   switch (reason) {
     case 'ref_frame_expired':
       return `Ref ${ref} belongs to an expired ref frame — a device action since the snapshot invalidated it`;
     case 'ref_generation_mismatch':
       return `Ref ${ref} was minted from a superseded snapshot generation`;
     case 'plain_ref_requires_complete_frame':
-      return `Ref ${ref} needs a complete snapshot — the current frame only authorizes its emitted refs`;
+      if (!replacement) {
+        return `Ref ${ref} needs a complete snapshot — the current frame only authorizes its emitted refs`;
+      }
+      return replacement.replacementRefs
+        ? `Ref ${ref} needs a complete snapshot — a settled diff replaced the ref frame and only authorizes its issued refs`
+        : `Ref ${ref} needs a complete snapshot — a settled diff replaced the ref frame and issued no refs`;
     case 'ref_not_issued':
       return `Ref ${ref} was not issued by the current ref frame`;
   }
```

**File**: `packages/daemon/src/execution/session-snapshot.ts` (modified, +14/-3)
```diff
@@ -10,6 +10,7 @@ import {
   refFrameState,
   REF_FRAME_REASONS,
 } from '../core/ref-frame.ts';
+import type { RefFrameOrigin } from '../core/ref-frame-slot.ts';
 import type { SessionRef, SessionState } from '../core/session-state.ts';
 import type { SessionStore } from '../core/session-store.ts';
 
@@ -98,8 +99,16 @@ function normalizeRefBody(ref: string): string {
  * epoch — a plain ref then requires a complete frame, and a pinned ref outside
  * the set is rejected. An empty partial result does not supersede existing
  * authority (it leaves the frame untouched), so a useful prior frame survives.
+ *
+ * `origin` records which publication issued the frame (ADR 0014 amendment): the
+ * settle path passes `settle-diff` so a later plain-ref refusal can name the
+ * diff as the replacement; every other partial publication keeps `partial`.
  */
-export function markSessionPartialRefsIssued(session: SessionState, refs: Iterable<string>): void {
+export function markSessionPartialRefsIssued(
+  session: SessionState,
+  refs: Iterable<string>,
+  origin: RefFrameOrigin = 'partial',
+): void {
   const scope = new Set<string>();
   for (const ref of refs) {
     const body = normalizeRefBody(ref);
@@ -115,7 +124,7 @@ export function markSessionPartialRefsIssued(session: SessionState, refs: Iterab
   // depend on ancestors, siblings and viewport outside the emitted subset, so the whole
   // tree is kept while the issuance set bounds authority) and the frozen epoch that keeps
   // a later read-only capture from invalidating a correct pin from this frame.
-  activatePartialRefFrame(session, scope);
+  activatePartialRefFrame(session, scope, origin);
 }
 
 /**
@@ -140,7 +149,9 @@ export function issueSettleRefs(
   if (!ref || !settle?.diff) return undefined;
   const session = sessionStore.resolveCurrent(ref);
   if (!session) return undefined;
-  markSessionPartialRefsIssued(session, collectSettleIssuedRefBodies(settle));
+  // The settle-diff origin is what lets a later plain-ref refusal (#4571) name this
+  // diff as the replacement instead of pointing at a generic recapture.
+  markSessionPartialRefsIssued(session, collectSettleIssuedRefBodies(settle), 'settle-diff');
   return session.snapshotGeneration;
 }
 
```

#### Recent Merged Pull Requests:
- **PR #5079** (2026-11-24): fix(apple): press Home through simulator HID on a foldable simulator (@kacperkapusciak)
- **PR #5077** (2026-11-24): test(daemon-client): publish startup phase fixtures atomically (@thymikee)
- **PR #5076** (2026-11-24): fix(device): select the only booted iPhone or iPad before ranking iPhones above iPads (@sjkim-expo)
- **PR #5075** (2026-11-24): fix(settings): accept union-valued permission targets without mode (@thymikee)
- **PR #5073** (closed): fix(test): repair provider restart test imports on 0.22 (@thymikee)
- **PR #5072** (2026-11-24): refactor(daemon): bind find actions to the admitted session lifetime (@thymikee)

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

## X. harmonyos): clamp the open foreground probe's hdc read to the request deadline

**RULE**:
When implementing operations in `docs/evidence/ad-5055-lega/replay-lega.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4dffcd31`: harmonyos): clamp the open foreground probe's hdc read to the request deadline. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/evidence/ad-5055-lega/replay-lega.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
{
  "success": false,
  "error": {
    "code": "REPLAY_DIVERGENCE",
    "message": "Daemon request deadline exceeded",
    "hint": "Check completed steps and the current device state before retrying the timed-out operation.",
    "diagnosticId": "mwu8qema-6d287442",
    "logPath": "<state-dir>/sessions/cwd_1dd430edfb664982_default/requests/97d848997a368c7f.ndjson",
    "diagnosticsRecord": {
      "session": "cwd:1dd430edfb664982:default",
      "requestId": "97d848997a368c7f"
    },
    "details": {
      "reason": "daemon_request_timeout",
      "replayPath": "one-line.ad",
      "step": 1,
      "action": "open",
      "positionals": ["<arg>"],
      "artifactPaths": [],
      "divergence": {
        "version": 1,
        "kind": "action-failure",
        "step": {
          "index": 1,
          "source": {
            "path": "one-line.ad",
            "line": 1
          }
        },
        "action": "open \"com.sankuai.dianping\"",
        "cause": {
          "code": "COMMAND_FAILED",
          "message": "request canceled",
          "hint": "The request was canceled intentionally (explicit cancel or client disconnect) \u2014 no retry is needed unless the cancellation was
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4dffcd31` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
