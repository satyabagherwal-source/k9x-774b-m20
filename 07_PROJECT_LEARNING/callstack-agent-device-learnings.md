> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source**: github ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Source Version**: `3d919010`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T05:12:49.283Z  
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
> **Harvest Timestamp**: 2026-10-19T05:12:49.274Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Mobile app automation and verification for AI coding agents. CLI, MCP server, and typed Node.js API for iOS, Android, HarmonyOS, TV, web, macOS, and Linux.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5072 stars

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
const GESTURE_NUMERIC_FLAG_MAP = new Map<string, 'pointerCount'>([
  ['--pointer-count', 'pointerCount'],
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
  key: 'until' | 'snapshotRaw' | 'snapshotDepth' | 'snapshotScope';
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
 * (#3197). Exported for the root admission test
 * (`src/commands/replay/script-flag-admission.test.ts`), which proves the tables and the
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
 * `@ref`, a two-token point (`x y`), or a single selector. Everything after
 * is the typed value and is excluded.
 */
function divergenceTypingTargetTokens(action: DivergenceActionLabelInput): string[] {
  if (action.command === 'type') return [];
  
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

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/engine.ts`
```
import {
  buildIosSnapshotComparisonIdentity,
  buildIosSnapshotPresentationKey,
  deriveIosCaptureHint,
} from '../ios-snapshot-planning.ts';
import type {
  IosSnapshotAcquisition,
  IosSnapshotInput,
  IosSnapshotPublication,
  IosSnapshotRequest,
} from '@agent-device/contracts/ios-snapshot';
import { attachRefs, type RawSnapshotNode } from '@agent-device/kernel/snapshot';
import { buildIosInteractiveSnapshotPresentation } from './semantic-index.ts';
import { validateIosSnapshotGraph } from './graph.ts';
import { foldIosSnapshot } from './geometry.ts';
import { collectPresentedSurface, type PresentedSurfaceCompleteness } from './geometry-policy.ts';
import { resolveIosViewport, validateIosPayload } from './invariants.ts';
import { projectIosQualitySnapshot, projectIosSnapshot } from './projection.ts';
import { presentIosRunnerSnapshot } from './runner-presentation.ts';
import type {
  IosSnapshotEngineOptions,
  IosSnapshotEnginePresentation,
  IosSnapshotFoldPolicy,
} from './types.ts';
import { IosSnapshotEngineError } from './types.ts';

const DEFAULT_FOLD_POLICY: IosSnapshotFoldPolicy = 'cursor-projected';

export function publishIosSnapshot(
  input: IosSnapshotInput,
  request: IosSnapshotRequest,
  options: IosSnapshotEngineOptions = {},
): IosSnapshotPublication {
  const presentation = presentIosSnapshot(input, request, options);
  const presentationKey =
    input.stage === 'presented'
      ? input.validation.presentationKey
      : buildIosSnapshotPresentationKey(request);
  const truncated =
    input.stage === 'acquired' ? input.acquisition.truncated : input.presentation.payload.truncated;
  return {
    payload: {
      nodes: attachRefs(presentation.nodes),
      ...(truncated === undefined ? {} : { truncated }),
    },
    presentationKey,
    comparisonIdentity: buildIosSnapshotComparisonIdentity(input, request),
    residue:
      input.stage === 'acquired' ? [...input.acquisition.residue] : [...input.validation.residue],
    ...(presentation.validatedViewport
      ? { validatedViewport: presentation.validatedViewport }
      : {}),
    ...(input.stage === 'acquired'
      ? {
          presentedSurface: collectPresentedSurface(
            input.acquisition.nodes,
            acquisitionCompleteness(input.acquisition),
          ),
        }
      : {}),
  };
}

/**
 * What an acquisition claims about its own completeness, from the producer's truncation statement and
 * never from the tree: a producer that reports nothing about truncation has stated nothing, and a
 * presented-surface classification may not read a silent field as "complete" (#2188 invariant 5).
 */
function acquisitionCompleteness(
  acquisition: IosSnapshotAcquisition,
): PresentedSurfaceCompleteness {
  if (acquisition.truncated === undefined) return 'unstated';
  return acquisition.truncated ? 'capped' : 'complete';
}

export function presentIosSnapshot(
  input: IosSnapshotInput,
  request: IosSnapshotRequest,
  options: IosSnapshotEngineOptions = {},
): IosSnapshotEnginePresentation {
  const foldPolicy = options.foldPolicy ?? DEFAULT_FOLD_POLICY;
  if (input.stage === 'acquired') {
    return presentAcquiredSnapshot(input.acquisition, request, foldPolicy);
  }
  return presentIosRunnerSnapshot(input, request, foldPolicy);
}

function presentAcquiredSnapshot(
  acquisition: IosSnapshotAcquisition,
  request: IosSnapshotRequest,
  foldPolicy: IosSnapshotFoldPolicy,
): IosSnapshotEnginePresentation {
  const expectedHint = deriveIosCaptureHint(request);
  assertCaptureHintMatches(acquisition, expectedHint);

  if (request.projection === 'raw') {
    validateIosSnapshotGraph(acquisition.nodes);
    const sourceNodes = acquisition.nodes.map((raw) => ({ raw, sourceIndex: raw.index }));
    const projected = projectIosSnapshot({
      nodes: sourceNodes,
      projection: 'raw',
      scope: request.scope,
      depth: request.depth,
      foldPolicy,
    });
    const qualityNodes =
      request.scope === null
        ? undefined
        : projectIosQualitySnapshot({
            nodes: sourceNodes,
            projection: 'raw',
            depth: null,
            foldPolicy,
          }).nodes;
    return {
      nodes: projected.nodes,
      ...(qualityNodes ? { qualityNodes } : {}),
      presentedIndexesBySourceIndex: remapPresentedIndexes(
        acquisition.nodes,
        projected.nodes,
        projected.sourceIndexes,
        identityMapping(projected.nodes),
      ),
      stats: {
        presentedNodeCount: projected.nodes.length,
        sourceNodeCount: acquisition.nodes.length,
        parentClipLookups: 0,
        modalContainedNodeCount: 0,
      },
    };
  }

  const viewport = resolveIosViewport(acquisition);
  const hittabilityAvailable = !hasUnavailableHittability(acquisition.residue);
  const folded = foldIosSnapshot(acquisition.nodes, viewport, request.interactiveOnly, foldPolicy, {
    hittabilityAvailable,
  });
  const foldedInput = {
    nodes: folded.nodes,
    projection: 'regular' as const,
    scope: request.scope,
    depth: request.depth,
    foldPolicy,
  };
  const projected = projectIosSnapshot(foldedInput);
  const compacted = request.interactiveOnly
    ? buildIosInteractiveSnapshotPresentation(projected.nodes)
    : {
        nodes: projected.nodes,
        presentedIndexesBySourceIndex: identityMapping(projected.nodes),
      };
  const validation = validateIosPayload(
    compacted.nodes,
    'regular',
    viewport,
    foldPolicy,
    hittabilityAvailable,
  );
  const qualityNodes =
    request.scope === null
      ? undefined
      : projectIosQualitySnapshot({
          nodes: folded.nodes,
          projection: 'regular',
          depth: null,
          foldPolicy,
        }).nodes;
  return {
    nodes: compacted.nodes,
    validatedViewport: viewport,
    ...(qualityNodes ? { qualityNodes } : {}),
    presentedIndexesBySourceIndex: remapPresentedIndexes(
      acquisition.nodes,
      projected.nodes,
      projected.sourceIndexes,
      compacted.presentedIndexesBySourceIndex,
    ),
    stats: {
      presentedNodeCount: compacted.nodes.length,
      sourceNodeCount: acquisition.nodes.length,
      parentClipLookups: folded.stats.parentClipLookups + validation.parentClipLookups,
      modalContainedNodeCount: folded.stats.modalContainedNodeCount,
    },
  };
}

function hasUnavailableHittability(residue: IosSnapshotAcquisition['residue']): boolean {
  return residue.some((entry) => entry.kind === 'unavailable-fact' && entry.fact === 'hittability');
}

function assertCaptureHintMatches(
  acquisition: IosSnapshotAcquisition,
  expected: ReturnType<typeof deriveIosCaptureHint>,
): void {
  const actual = acquisition.hint;
  if (
    actual.projection !== expected.projection ||
    actual.rawTraversalDepth !== expected.rawTraversalDepth ||
    actual.regularPresentedDepth !== expected.regularPresentedDepth ||
    actual.interactiveOnly !== expected.interactiveOnly ||
    actual.customActions !== expected.customActions ||
    actual.acquisitionIntent !== expected.acquisitionIntent
  ) {
    throw new IosSnapshotEngineError(
      'projection-mismatch',
      'acquired iOS snapshot does not match the requested capture hint',
      { projection: actual.projection },
    );
  }
}

function identityMapping(
  nodes: readonly RawSnapshotNode[],
): ReadonlyMap<number, readonly number[]> {
  return new Map(nodes.map((node) => [node.index, [node.index]]));
}

function remapPresentedIndexes(
  sourceNodes: readonly RawSnapshotNode[],
  projectedNodes: readonly RawSnapshotNode[],
  sourceIndexes: readonly number[],
  presentedIndexesByProjectedIndex: ReadonlyMap<number, readonly number[]>,
): ReadonlyMap<number, readonly number[]> {
  const sourceIndexByProjectedIndex = new Map(
    projectedNodes.map((node, position) => [node.index, sourceIndexes[position]!]),
  );
  const remapped = new Map<number, readonly number[]>(
    sourceNodes.map((node) => [node.index, []] as const),
  );
  for (const [projectedIndex, presentedIndexes] of presentedIndexesByProjectedIndex) {
    const sourceIndex = sourceIndexByProjectedIndex.get(projectedIndex);
    if (sourceIndex !== undefined) {
      remapped.set(sourceIndex, presentedIndexes);
    }
  }
  return remapped;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3792** (2026-10-19): **CLI: an empty numeric flag value is read as 0**
  *Symptoms*: ## What happens  An `int` or `number` flag given an empty or blank value is accepted as `0`. For flags with a minimum of `0`, the command runs with no error:  ```bash agent-device test ./suite --retries=          # runs with retries 0 agent-device test ./suite --retries ""        # same RETRIES= ; agent-device test ./suite --retries="$RETRIES" ```  The same applies to `--hold-ms`, `--delay-ms`, `--pause-ms`, `--interval-ms`, `--duration-ms`, `--jitter-px`, and `--settle-quiet`. For flags with a minimum of `1` or more, such as `--count=`, the error is `Invalid count: ` with an empty value, which does not name the cause.  ## Expected  The parser refuses the flag with `Flag --retries requires a value.`, as it already does for a missing value and for an empty `booleanOrString` inline value.  ## Cause  `parseFlagValue` in `src/cli/parser/args.ts` converts the value with `Number(value)` and checks only `Number.isFinite`. `Number('')` and `Number(' ')` are `0`.  ## Environment  main at `6e8c2a0`, Node 22.22.0, Linux. 

- **Issue #3782** (2026-10-18): **Daemon startup: wait for a live daemon instead of a fixed 15 s deadline on slow or overloaded hosts**
  *Symptoms*: ## Purpose  On a slow or overloaded host, the CLI kills a healthy daemon that is still starting. The result is `daemon_startup_failed`, and the run fails before any work starts. This happens on any CI that can clog: shared macOS runners, small Linux containers, Windows runners, and nested virtualization. It also happens on a developer machine under load. A slow host must make startup slower, not fail it.  #3342 records this failure class (more than 12 instances on unrelated diffs since 2026-10-08; re-runs at the same head pass). This issue is the fix contract for that class.  ## Current behavior (origin/main)  `startLocalDaemon` in `src/daemon-client/daemon-client-lifecycle.ts`:  - It sets one wall-clock deadline: `DAEMON_STARTUP_TIMEOUT_MS = 15_000` (line 83, used at line 480). - `waitForDaemonStartup` (line 818) polls until the daemon publishes a reachable `daemon.json`, or until the process exits, or until the deadline. - At the deadline, the client retires the daemon, even when the process is alive. A `timeout` result never retries (`retry` is true only for `early_exit`), so `DAEMON_STARTUP_ATTEMPTS = 2` does not help. Every report shows `startupAttempts: 1`. - No setting can change the 15 s budget.  Evidence from run [39019020372](https://github.com/callstack/agent-device/actions/runs/39019020372) (PR #3760, 2026-10-17):  - The step `pnpm clean:daemon` took 70 s on that runner, which shows that the host was overloaded. - The CLI spawned daemon pid 6849 at 09:30:03. The c

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

### Incident Patch 1: `72e79651` (2026-10-18)
**Commit Message**: fix(daemon): replace fixed 15s startup kill with progress-aware startup budget (#3791)

* fix(daemon): wait for a slow daemon startup and fail with typed reasons

A client killed a healthy daemon that was still starting: the local
startup used one 15 s wall-clock deadline, and a timeout never retried.
On an overloaded host that is a failed run before any work starts
(#3782, failure class #3342).

- startLocalDaemon now waits while the spawned daemon stays alive, up to
  a 120 s ceiling; AGENT_DEVICE_DAEMON_STARTUP_TIMEOUT_MS overrides it
  for the CLI, MCP, and Node client alike.
- The daemon records startup phase markers (modules-loaded,
  lock-acquired, listening, registered) with timestamps in
  daemon-startup-phases.jsonl beside its registration. A live daemon
  that publishes no marker for 60 s is retired as stalled; one that
  keeps progressing is waited for to the ceiling.
- Failure details carry reason (startup-exited, startup-stalled,
  startup-ceiling), the observed phase timings, and the effective
  startupTimeoutMs. Each reason has its own hint.
- help commands documents the variable and the three reasons.

* fix(daemon): give each startup its own marker file and retire

**File**: `.github/workflows/ios.yml` (modified, +8/-0)
```diff
@@ -169,6 +169,14 @@ jobs:
       - name: Preflight iOS runner through public CLI
         run: |
           pnpm clean:daemon
+          # The public-SDK record is the cold-startup evidence; the CLI timer only wraps attach.
+          node --input-type=module -e '
+            const { performance } = await import("node:perf_hooks");
+            const { ensureDaemon } = await import("./dist/src/index.js");
+            const t0 = performance.now();
+            const c = await ensureDaemon({ stateDir: process.env.AGENT_DEVICE_STATE_DIR });
+            console.log(JSON.stringify({ phase: "daemon_cold_startup", started: c.started, pid: c.daemon.pid, durationMs: Math.round(performance.now() - t0) }));
+          '
           node bin/agent-device.mjs prepare ios-runner --platform ios --udid "${{ steps.ios-simulator.outputs.simulator-udid }}" --timeout "$AGENT_DEVICE_IOS_PREPARE_TIMEOUT_MS" --json
 
       # The replay reuses the prepared runner in the same daemon. --debug keeps every step's request
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 
 - The PNG worker no longer calls `process.emitWarning` when it is unavailable, and it starts with an empty environment (`env: {}`). The daemon registers a sink when it pre-warms the worker, so every transition to unavailable (spawn failure, missing entry, load error, exit) leaves exactly one `png_worker_unavailable` event, with a typed `reason` (`entry-not-found`, `spawn-failed`, `worker-error`, `worker-exited`) and its `detail`, in `daemon.log`, with or without `--debug`. Requests then continue on the in-process fallback without repeating the event.
 - Behavior change: `resolveHubAppReference`, shipped through `agent-device/plugins/webdriver`, now needs `cwd` to resolve a relative app path. Without it the call fails with `INVALID_ARGS` and `details.reason: provider_app_cwd_missing`; it used to resolve against the process's working directory. Absolute paths, URLs and provider references are unaffected. The daemon fills it from the client's working directory (or its host's) for every provider lease request, so `connect` and `lease_allocate` are unchanged.
+- A client starting a local daemon now waits while the daemon process stays alive and keeps publishing startup progress, so an overloaded host makes startup slower instead of failing it. The wait stops at a ceiling of 120 s by default; set `AGENT_DEVICE_DAEMON_STARTUP_TIMEOUT_MS` to a positive integer number of milliseconds to override it for the CLI, MCP, and Node clients alike. The variable is read only when the client must start a daemon; a value that is not a positive integer fails with `INVALID_ARGS` before the daemon spawns, and a client that only attaches to or reuses a running daemon never reads it. A failed startup names the outcome in `error.details.reason`, and you should branch on it, never on the message: `startup-exited` (the process ended before registering), `startup-stalled` (alive but no startup progress for a fixed 60 s window, which the ceiling variable does not change; the daemon is stopped), or `startup-ceiling` (a startup was still live — this client's daemon or another client's — when the ceiling passed; the client stops its own launch and never signals another client's live daemon). `details.phases` carries the startup phase timings the client observed and `details.startupTimeoutMs` the effective ceiling.
 - The `daemon-not-running` hint now always names `--state-dir <dir>`, and a daemon force-retired for outlasting its drain is reported as `Replaced unreachable daemon` instead of `Replaced idle daemon`. `daemon-drain-timeout` and the post-drain force retire are documented in the client API and `help`.
 - Fix `ensureDaemon()`, the CLI and MCP killing a daemon they had just asked to leave. After the daemon answers the quiesce request with `draining`, the client now waits up to 60 s for it to exit by itself and clean up its registration, so plugin disposal and lease finalization finish (on Windows a signal ends the process outright, and on POSIX a drain longer than 3 s was killed). A daemon still running at the deadline that fails its liveness probes is force-retired; one that still answers is left running and the call fails with `details.reason: 'daemon-drain-timeout'`, with a hint naming `agent-device daemon stop --state-dir <path>`.
 - `@agent-device/testmu` is now a version 2 provider plugin. `import testmu from '@agent-device/testmu'` gives a factory, `testmu({ credentials: { username, accessKey } })`, that reads those credentials instead of `LT_USERNAME` and `LT_ACCESS_KEY`; without options it reads the variables as before. The package still declares the version 1 plugin entry, so `agent-device plugins add @agent-device/testmu` keeps working on hosts that predate the version 2 contract.
```

**File**: `packages/daemon-contracts/package.json` (modified, +4/-0)
```diff
@@ -44,6 +44,10 @@
       "types": "./src/daemon-shutdown-report.ts",
       "default": "./src/daemon-shutdown-report.ts"
     },
+    "./daemon-startup-phases": {
+      "types": "./src/daemon-startup-phases.ts",
+      "default": "./src/daemon-startup-phases.ts"
+    },
     "./daemon-stop": {
       "types": "./src/daemon-stop.ts",
       "default": "./src/daemon-stop.ts"
```

**File**: `packages/daemon-contracts/src/daemon-registration-owner.ts` (modified, +2/-0)
```diff
@@ -44,6 +44,7 @@ import {
   resolveDaemonShutdownReportPath,
   type DaemonShutdownOutcome,
 } from './daemon-shutdown-report.ts';
+import { sweepDeadDaemonStartupPhasesFiles } from './daemon-startup-phases.ts';
 
 export const DAEMON_STARTUP_EXIT_CODES = Object.freeze({ busy: 75, unproven: 78 });
 export type DaemonRegistrationFields = Readonly<{
@@ -85,6 +86,7 @@ export async function tryAcquireDaemonRegistration(
   try {
     acquisition.assertHeld();
     fs.rmSync(resolveDaemonShutdownReportPath(boundPaths.baseDir), { force: true });
+    sweepDeadDaemonStartupPhasesFiles(boundPaths.baseDir);
   } catch (error) {
     await releaseRegistrationAfterFailure(acquisition, error, boundPaths.logPath);
   }
```

**File**: `packages/daemon-contracts/src/daemon-startup-phases.test.ts` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+import { appendFile, readFile, writeFile } from 'node:fs/promises';
+import { spawnSync } from 'node:child_process';
+import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
+import path from 'node:path';
+import { expect, test } from 'vitest';
+import { tryAcquireDaemonRegistration } from '@agent-device/daemon-contracts/daemon-registration-owner';
+import {
+  readDaemonStartupPhaseMarkers,
+  recordDaemonStartupMarker,
+  removeDaemonStartupPhasesFile,
+  resolveDaemonStartupPhasesPath,
+} from '@agent-device/daemon-contracts/daemon-startup-phases';
+import { resolveDaemonPaths } from '@agent-device/daemon-contracts/daemon-resolution';
+import { mkdtempForTest } from '@agent-device/test-kit';
+
+test('per-launch marker files: a fresh launch never reads an older launch phases', async () => {
+  const stateDir = await mkdtempForTest('agent-device-markers-');
+  const first = resolveDaemonStartupPhasesPath(stateDir, 1111);
+  const second = resolveDaemonStartupPhasesPath(stateDir, 2222);
+  recordDaemonStartupMarker(first, 'lock-acquired');
+  expect(second).not.toBe(first);
+  expect(existsSync(second)).toBe(false);
+  recordDaemonStartupMarker(second, 'modules-loaded');
+  const firstPhases = readDaemonStartupPhaseMarkers(readFileSync(first, 'utf8'));
+  const secondPhases = readDaemonStartupPhaseMarkers(readFileSync(second, 'utf8'));
+  expect(Object.keys(firstPhases)).toEqual(['lock-acquired']);
+  expect(Object.keys(secondPhases)).toEqual(['modules-loaded']);
+});
+
+test('marker reading keeps the earliest record when a phase replays after a later one', () => {
+  const text = [
+    '{"data":{"startupPhase":"listening","timestampMs":500}}',
+    '{"data":{"startupPhase":"lock-acquired","timestampMs":20}}',
+    '{"data":{"startupPhase":"lock-acquired","timestampMs":35}}',
+  ].join('\n');
+  const phases = readDaemonStartupPhaseMarkers(text);
+  expect(phases['lock-acquired']).toBe(20);
+  expect(phases.listening).toBe(500);
+});
+
+test('marker reading ignores unknown phases and unparsable lines', () => {
+  const text = [
+    '{"data":{"startupPhase":"heartbeat","timestampMs":10}}',
+    '{"data":{"startupPhase":"registered","timestampMs":"7"}}',
+    'not json',
+    '{"data":{"startupPhase":"listening","timestampMs":30}}',
+  ].join('\n');
+  expect(readDaemonStartupPhaseMarkers(text)).toEqual({ listening: 30 });
+});
+
+test('the producer lifetime claim empties a same-pid leftover', async () => {
+  // Pid reuse after both the old client and daemon died before either cleanup: the entry removes
+  // its record before its first marker; this child repeats that producer sequence itself.
+  const stateDir = await mkdtempForTest('agent-device-markers-');
+  writeFileSync(path.join(stateDir, 'package.json'), '{"type":"module"}');
+  const entry = path.join(stateDir, 'claim-producer.js');
+  const registrationUrl = new URL('./daemon-startup-phases.ts', import.meta.url).href;
+  writeFileSync(
+    entry,
+    `import { removeDaemonStartupPhasesFile, recordDaemonStartupMarker, resolveDaemonStartupPhasesPath } from ${JSON.stringify(registrationUrl)};
+const file = resolveDaemonStartupPhasesPath(${JSON.stringify(stateDir)}, process.pid);
+recordDaemonStartupMarker(file, 'listening');
+recordDaemonStartupMarker(file, 'registered');
+removeDaemonStartupPhasesFile(file);
+recordDaemonStartupMarker(file, 'modules-loaded');
+`,
+  );
+  const child = spawnSync(process.execPath, ['--experimental-strip-types', entry], {
+    encoding: 'utf8',
+  });
+  if (child.status !== 0) throw new Error(child.stderr);
+  const phases = readDaemonStartupPhaseMarkers(
+    readFileSync(resolveDaemonStartupPhasesPath(stateDir, child.pid!), 'utf8'),
+  );
+  expect(phases).toEqual({ 'modules-loaded': expect.any(Number) });
+});
+
+test.each([
+  ['remove', (p: string, cb: (e: unknown) => void) => removeDaemonStartupPhasesFile(p, cb)],
+  [
+    'record',
+    (p: string, cb: (e: unknown) => void) => recordDaemonStartupMarker(p, 'modules-loaded', cb),
+  ],
+] as const)('a refused %s reports through the callback instead of throwing', async (_name, run) => {
+  const stateDir = await mkdtempForTest('agent-device-markers-');
+  const markerPath = resolveDaemonStartupPhasesPath(stateDir, 777);
+  mkdirSync(markerPath, { recursive: true });
+  const reported: unknown[] = [];
+  expect(() =>
+    run(markerPath, (error) => {
+      reported.push(error);
+    }),
+  ).not.toThrow();
+  expect(reported).toHaveLength(1);
+  expect(reported[0]).toHaveProperty('message');
+});
+
+test('acquiring the registration retires files of dead or unowned pids only', async () => {
+  const paths = resolveDaemonPaths(await mkdtempForTest('agent-device-markers-'));
+  const dead = resolveDaemonStartupPhasesPath(paths.baseDir, spawnDeadPid());
+  const own = resolveDaemonStartupPhasesPath(paths.baseDir, process.pid);
+  const unparseable = path.join(paths.baseDir, 'daemon-startup-phases-.jsonl');
+  const legacy 
```

**File**: `packages/daemon-contracts/src/daemon-startup-phases.ts` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+import fs from 'node:fs';
+import path from 'node:path';
+import { normalizeError, type NormalizedError } from '@agent-device/kernel/errors';
+import { isProcessAlive } from '@agent-device/host-kit/process';
+
+/**
+ * Startup phase markers: a per-launch record, named for the writing pid, of how far that startup
+ * got, so a waiting client tells "slow but progressing" from "stuck" without a heartbeat. The
+ * writer removes it on completion, the client after a joined exit, and each new registration
+ * owner sweeps the files of provably dead pids.
+ */
+const DAEMON_STARTUP_PHASES = Object.freeze([
+  'modules-loaded',
+  'composition-loaded',
+  'lock-acquired',
+  'recovery-finished',
+  'listening',
+  'registered',
+] as const);
+
+export type DaemonStartupPhase = (typeof DAEMON_STARTUP_PHASES)[number];
+
+const DAEMON_STARTUP_PHASE_SET: ReadonlySet<string> = new Set<string>(DAEMON_STARTUP_PHASES);
+
+const DAEMON_STARTUP_PHASES_ENTRY = /^daemon-startup-phases-(\d*)\.jsonl$/;
+
+/** The marker file the daemon process `pid` writes in `stateDir`; an absent file is no evidence. */
+export function resolveDaemonStartupPhasesPath(stateDir: string, pid: number): string {
+  return path.join(stateDir, `daemon-startup-phases-${pid}.jsonl`);
+}
+
+/** Appends one phase marker; a refused append goes to `reportFailure`, never fatal to a startup. */
+export function recordDaemonStartupMarker(
+  startupPhasesPath: string,
+  phase: DaemonStartupPhase,
+  reportFailure?: (error: NormalizedError) => void,
+): void {
+  try {
+    const timestampMs = Date.now();
+    fs.mkdirSync(path.dirname(startupPhasesPath), { recursive: true });
+    // A crash mid-append can leave no trailing newline; glue two appends and both are lost.
+    const separator = endsWithoutNewline(startupPhasesPath) ? '\n' : '';
+    fs.appendFileSync(
+      startupPhasesPath,
+      `${separator}${JSON.stringify({ data: { startupPhase: phase, timestampMs } })}\n`,
+    );
+  } catch (error) {
+    reportFailure?.(normalizeError(error));
+  }
+}
+
+function endsWithoutNewline(file: string): boolean {
+  let fd: number | undefined;
+  try {
+    const stats = fs.statSync(file);
+    if (stats.size === 0) return false;
+    const buffer = Buffer.alloc(1);
+    fd = fs.openSync(file, 'r');
+    if (fs.readSync(fd, buffer, 0, 1, stats.size - 1) !== 1) return false;
+    return buffer[0] !== 0x0a;
+  } catch {
+    return false;
+  } finally {
+    if (fd !== undefined) fs.closeSync(fd);
+  }
+}
+
+/**
+ * Removes this launch's record: before its first marker (a per-pid name identifies a writer, not
+ * a lifetime, so the entry claims its file first), and after a finished startup or joined exit.
+ * A refused removal only reports through `reportFailure`; it never stops a startup.
+ */
+export function removeDaemonStartupPhasesFile(
+  startupPhasesPath: string,
+  reportFailure?: (error: NormalizedError) => void,
+): void {
+  try {
+    fs.rmSync(startupPhasesPath, { force: true });
+  } catch (error) {
+    reportFailure?.(normalizeError(error));
+  }
+}
+
+/** Sweeps marker files of provably dead (or unnameable) pids; a live pid's file is kept. */
+export function sweepDeadDaemonStartupPhasesFiles(stateDir: string): void {
+  let entries: string[];
+  try {
+    entries = fs.readdirSync(stateDir);
+  } catch {
+    return;
+  }
+  for (const entry of entries) {
+    const match = DAEMON_STARTUP_PHASES_ENTRY.exec(entry);
+    if (match === null) continue;
+    const deadPid = Number(match[1]);
+    if (deadPid === process.pid) continue;
+    if (!Number.isSafeInteger(deadPid) || deadPid <= 0 || !isProcessAlive(deadPid)) {
+      removeDaemonStartupPhasesFile(path.join(stateDir, entry));
+    }
+  }
+}
+
+/**
+ * The phases observed in a marker tail, keeping each phase's earliest occurrence. Unknown and
+ * unparsable lines are ignored: a client never fails a startup over a line it does not know.
+ */
+export function readDaemonStartupPhaseMarkers(
+  markerTail: string,
+): Partial<Record<DaemonStartupPhase, number>> {
+  const phases: Partial<Record<DaemonStartupPhase, number>> = {};
+  for (const line of markerTail.split('\n')) {
+    if (!line.includes('"startupPhase"')) continue;
+    let record: DaemonStartupMarkerRecord;
+    try {
+      record = JSON.parse(line) as DaemonStartupMarkerRecord;
+    } catch {
+      continue;
+    }
+    const phase = record.data?.startupPhase;
+    const timestampMs = record.data?.timestampMs;
+    if (
+      typeof phase !== 'string' ||
+      !DAEMON_STARTUP_PHASE_SET.has(phase) ||
+      typeof timestampMs !== 'number' ||
+      !Number.isFinite(timestampMs)
+    ) {
+      continue;
+    }
+    const seen = phases[phase as DaemonStartupPhase];
+    if (seen === undefined || timestampMs < seen) phases[phase as DaemonStartupPhase] = timestampMs;
+  }
+  return phases;
+}
+
+type DaemonStartupMarkerRecord = {
+  data?: { startupPhase?: unknown; timestampMs?: unknown };
+};
```

**File**: `packages/daemon/src/server/__tests__/daemon-runtime-app-log.test.ts` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import type { ResourceDiagnostic } from '@agent-device/host-kit/diagnostics';
 import { createDurableResourceEnvelope } from '@agent-device/capture-kit';
 import { createTestAppLogLiveHandle, mkdtempForTestSync } from '@agent-device/test-kit';
 import { makeSessionStore } from '../../__tests__/support/store-factory.ts';
-import { flushDaemonStartupDiagnostics } from '../http/daemon-runtime.ts';
+import { flushDaemonStartupDiagnostics } from '../http/daemon-startup-diagnostics.ts';
 import type { SessionState } from '../../core/session-state.ts';
 import { unavailableDeviceRuntimeGateway } from '../../__tests__/support/unavailable-device-runtime-gateway.ts';
 
```

**File**: `packages/daemon/src/server/http/daemon-runtime.ts` (modified, +24/-81)
```diff
@@ -6,7 +6,7 @@ import {
   type ClaimRecoveryGatewayFactory,
 } from '@agent-device/daemon-contracts/device-claim-recovery';
 import crypto from 'node:crypto';
-import { asAppError, AppError, normalizeError } from '@agent-device/kernel/errors';
+import { asAppError, AppError } from '@agent-device/kernel/errors';
 import { SessionStore } from '../../core/session-store.ts';
 import {
   DAEMON_CAPABILITIES,
@@ -76,7 +76,6 @@ import {
   readCurrentOwnerIdentity,
   reapOwnedProcessRecordsAtStartup,
   type OwnedProcessRecordStore,
-  type OwnerIdentity,
 } from '@agent-device/host-kit/process';
 import { isEnvTruthy, sleep } from '@agent-device/host-kit/retry';
 import {
@@ -88,9 +87,12 @@ import {
 import {
   tryAcquireDaemonRegistration,
   DAEMON_STARTUP_EXIT_CODES,
-  type DaemonRegistrationOwner,
 } from '@agent-device/daemon-contracts/daemon-registration-owner';
-import { watchDaemonMetadataLoss } from './daemon-metadata-loss.ts';
+import {
+  recordDaemonStartupMarker,
+  removeDaemonStartupPhasesFile,
+  resolveDaemonStartupPhasesPath,
+} from '@agent-device/daemon-contracts/daemon-startup-phases';
 import { retainPngWorker } from '@agent-device/capture-kit/png-worker-client';
 import { openWebSessionNames } from '../../sessions/web-session-names.ts';
 import { createAppLogAdmissionLedger } from '../../resources/app-log-admission-ledger.ts';
@@ -242,83 +244,6 @@ export function daemonStartupExitCode(error: unknown): number {
   return typeof exitCode === 'number' ? exitCode : 1;
 }
 
-export async function flushDaemonStartupDiagnostics(
-  logPath: string,
-  diagnostics: readonly ResourceDiagnostic[],
-): Promise<void> {
-  if (diagnostics.length === 0) return;
-  await withDaemonDiagnosticsScope({ logPath, command: 'daemon-startup', debug: false }, () => {
-    for (const diagnostic of diagnostics) {
-      emitDiagnostic({
-        level: 'warn',
-        phase: diagnostic.phase,
-        data: { resourcePath: diagnostic.resourcePath, ...diagnostic.data },
-      });
-    }
-  });
-}
-
-/**
- * Records one daemon-level event. These run outside any request, so there is no request scope and no
- * resolved debug level to inherit; debug is forced on for the same reason the #2681 handoff forces it —
- * the event is the point of the record and must not be dropped by a level that was never set for it.
- */
-async function emitDaemonDiagnostic(
-  logPath: string,
-  phase: string,
-  data: Record<string, unknown>,
-): Promise<void> {
-  await withDaemonDiagnosticsScope({ logPath }, () => {
-    emitDiagnostic({ level: 'warn', phase, data });
-  });
-}
-
-async function finishDaemonRegistration(params: {
-  registration: DaemonRegistrationOwner;
-  infoPath: string;
-  logPath: string;
-  outcome?: Parameters<DaemonRegistrationOwner['finish']>[0];
-}): Promise<void> {
-  try {
-    const removal = await params.registration.finish(params.outcome);
-    if (removal.state !== 'removed' && removal.state !== 'absent') {
-      await emitDaemonDiagnostic(params.logPath, 'daemon_info_removal_declined', {
-        infoPath: params.infoPath,
-        removed: false,
-        reason: removal.state,
-        ...(removal.state === 'replaced' ? { registeredPid: removal.identity.pid } : {}),
-      });
-    }
-  } catch (error) {
-    await emitDaemonDiagnostic(params.logPath, 'daemon_registration_finish_failed', {
-      error: normalizeError(error),
-    });
-  }
-}
-
-/**
- * Starts the watch that reports this daemon's registration being taken over, and returns the handle
- * that stops it. It is armed only once this process has published its own record: before publication
- * the file legitimately describes a predecessor, and losing that is not this daemon's event.
- */
-function armDaemonMetadataLossWatch(
-  stateDir: string,
-  infoPath: string,
-  logPath: string,
-  owner: OwnerIdentity,
-): () => void {
-  return watchDaemonMetadataLoss({
-    infoPath,
-    stateDir,
-    owner,
-    onLoss: (loss) =>
-      void emitDaemonDiagnostic(logPath, 'daemon_metadata_lost', {
-        infoPath,
-        ...loss,
-      }).catch(() => {}),
-  });
-}
-
 export async function startDaemonRuntime(
   options: DaemonRuntimeOptions,
 ): Promise<DaemonRuntimeController> {
@@ -347,6 +272,13 @@ async function startDaemonRuntimeOnHost(
   const { env } = host;
   const stdout = options.stdout ?? process.stdout;
   const stderr = options.stderr ?? process.stderr;
+  // Function-scoped import: these helpers stay out of the daemon entry's eager closure (ADR 0019).
+  const {
+    armDaemonMetadataLossWatch,
+    emitDaemonDiagnostic,
+    finishDaemonRegistration,
+    flushDaemonStartupDiagnostics,
+  } = await import('./daemon-startup-diagnostics.ts');
   const daemonPaths = resolveDaemonPaths(env.AGENT_DEVICE_STATE_DIR, { env, cwd: host.cwd });
   const { baseDir, infoPath, logPath, sessionsDir } = daemonPaths;
   const daemonServerMode = resolveDaemonServerMode(env.AGENT_DEVICE_DAEMON_SERVER_MODE);
@@ -660,6 +592,13 @@ asy
```

---

### Incident Patch 2: `63a14fd8` (2026-10-17)
**Commit Message**: fix(daemon): retain cleanup locks and preserve healed snapshots (#3760)

* fix(daemon): retain execution locks through binding cleanup

ADR 0019 requires request bindings to dispose before device/session lock release. Await the shared cleanup outcome under initial and retained execution locks, then let response finalization preserve primary failures and report cleanup failures.

At base 4c1c786968, six blocked-cleanup regressions fail: queued same-session or same-device requests enter on success, throw, and cancellation. With the fix all six pass; the scope and open-wait suites pass (42 tests). No request-binding disposal bound exists; no timeout was added. Device dispatch is unchanged.

* fix(replay): preserve authored and explicitly recorded snapshots

ADR 0012 requires authored observations and explicit --record corrections to survive healed-script publication. Carry their typed publication intent from recording into the writer instead of stripping every snapshot. Retain ordinary diagnostic-snapshot optimization.

Isolated regression at base 4c1c786968: authored and explicit-record persisted snapshots and the correction-count/resume publication scenario all fail (3 regressions);

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@
 - Behavior change: the CLI and MCP now call `ensureDaemon()` explicitly once their config is resolved, then attach to the daemon it leaves. A command that finds a daemon from another version or build replaces it only if the daemon reports no request, session, repair session or live lease. A resumable upload still streaming and a host human-control hold that names no lease are not counted, so a replacement can end them. A daemon that answers nothing on any transport is retired after repeated failed liveness probes, which cannot show it idle. A busy one fails the command with `details.reason: 'daemon-busy'` instead of being replaced with its sessions, and a daemon from a release that predates quiescing fails it with `'daemon-incompatible'`; stop either with `agent-device daemon stop --state-dir <path>`. The takeover notice moves from `Replacing daemon … : <reason>` to `Replaced idle daemon …` (an incompatible daemon) or `Replaced unreachable daemon …` (one that answered nothing). A request that times out no longer retires an unresponsive daemon from the CLI or MCP; the error names `agent-device daemon stop --state-dir <path>`. A one-shot `replay` or `test` with an explicit `--state-dir` leaves the daemon it started running until its idle reap instead of stopping it. Remote `--daemon-base-url` connections and replay on its private ephemeral daemon are unchanged. Node.js clients keep `daemonLifecycle: 'managed'` until 0.22.
 - Add `ensureDaemon({ stateDir })` and the client config `daemonLifecycle: 'attach' | 'managed'`. An `attach` client connects to the daemon registered in the state directory and never starts, replaces or kills one, including after a request times out. It fails with `details.reason: 'daemon-not-running'` (the hint points at `ensureDaemon()`) or `'daemon-incompatible'` (both identities in `details`, the hint names `agent-device daemon stop`). `ensureDaemon()` starts a missing daemon and replaces an incompatible one that answers only through an authenticated quiesce request the daemon answers itself (a resumable upload still streaming and a human-control hold that names no lease are not counted, so a replacement can end them): it refuses with `daemon-busy` while any request is in flight or any session, repair session or live lease exists, and a daemon from a release before this one is never replaced. A registered daemon that answers nothing is retired, as is one that times out on the quiesce request and then fails repeated liveness probes; neither can be asked. A remote `daemonBaseUrl` connection never starts or retires a local daemon in either mode. `managed` stays the default and behaves as before until 0.22.
 - `lease_allocate` (and `client.leases.allocate()`) with a `leaseProvider` that no registered runtime claims now refuses before recording a lease, with `UNSUPPORTED_OPERATION`, `error.details.reason: provider-not-registered`, `details.provider`, `details.registeredProviders`, and `details.failedPlugins` naming a plugin that failed to register. Previously a plugin provider that the daemon never loaded passed admission and recorded a lease with no device behind it. Leases with no provider (a `leaseBackend` alone included), `proxy` and `cloud` need no runtime and still allocate. Restart the daemon with the provider configured, then retry.
+- Healed scripts retain authored snapshot steps and snapshots explicitly included with `--record` during repair. Diagnostic snapshots remain excluded. Behavior change: the config key `record` and `AGENT_DEVICE_RECORD` are retired — `--record` is per-invocation only, and a config file or environment naming the key fails with migration guidance naming `--record` and the SDK/MCP `record: true` call option.
+- Requests that share a session or device now queue until the preceding request finishes disposing its runtime binding and releasing its device claim, including after failure or cancellation.
 - Add `uninstall <app>` and `client.apps.uninstall({ app })` to remove an installed app on adb-backed Android targets, iOS simulators, and CoreDevice iOS devices. Both report `wasInstalled`. A package name or bundle id that is not installed succeeds with `wasInstalled: false`. Other targets, Appium and Limrun sessions included, refuse it before anything runs.
 - Add `settings mobile-data on|off` for adb-backed Android targets. It switches mobile data through `svc data` and reports the `mobileData` state stored in the global `mobile_data` row; multi-SIM read-back is not covered yet. Every other target refuses it before anything runs, and `--app` is refused because the switch is device-wide.
 - On iOS, a `fill` that runs under a degraded XCTest snapshot channel now aims at a point, including ref, selector and replay fills. When the runner identifies no text input under that point, it refuses with `NO_TEXT_INPUT_AT_POINT` (`error.details.reason: no_text_input_at_point`, `dispatched: no`) before dispatching its focus tap, and no field changes; when 
```

**File**: `packages/command-registry/src/flag-definitions-action.ts` (modified, +2/-2)
```diff
@@ -432,8 +432,8 @@ export const ACTION_FLAG_DEFINITIONS: readonly FlagDefinition[] = [
     // the synopsis stays the invocation they are choosing between (#1271 stage 2).
     usageHidden: true,
     usageDescription:
-      'Force-record this action even though its command is observation-only and would otherwise be excluded from a repair-armed heal by default (mutually exclusive with --no-record)',
-    projectConfig: true,
+      'Force-record this action into a repair-armed heal; per-invocation only, the retired config key "record" no longer opts in (mutually exclusive with --no-record)',
+    projectConfig: false,
     recorded: true,
   },
 ];
```

**File**: `packages/contracts/src/session-action.ts` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@ export type SessionAction = {
     noRecord?: boolean;
   };
   result?: Record<string, unknown>;
+  /** Retain authored plan observations or explicitly recorded repair observations. */
+  publicationIntent?: 'authored' | 'explicit-record';
   /**
    * ADR 0012 decision 3: parsed or record-time-computed `target-v1`
    * evidence, written as a comment immediately before this action's line.
```

**File**: `packages/daemon/src/core/__tests__/request-runtime-binding-router.test.ts` (modified, +83/-2)
```diff
@@ -1,5 +1,11 @@
 import fs from 'node:fs';
 import { expect, test, vi } from 'vitest';
+import {
+  clearRequestCanceled,
+  markRequestCanceled,
+  throwIfRequestCanceled,
+} from '@agent-device/host-kit/request';
+import { AppError } from '@agent-device/kernel/errors';
 import { applicationLifecycleOperationFacts } from '@agent-device/contracts/application-lifecycle-runtime';
 import {
   type DeviceBinding,
@@ -17,6 +23,7 @@ import { makeSessionStore } from '../../__tests__/support/store-factory.ts';
 import { LeaseRegistry } from '../../resources/lease-registry.ts';
 import { createRequestHandler } from '../../__tests__/support/test-device-runtime-gateway.ts';
 import { fakeCreateCommandSurface } from '../../__tests__/support/command-surface-fake.ts';
+import { getLeaseRegistryExecutionLocks } from '../../server/request-execution-scope.ts';
 
 test('request binding disposes once after response while adopted app-log handle survives', async () => {
   const runtime = makeGateway();
@@ -51,8 +58,81 @@ test('primary request failure survives a rejecting binding disposal', async () =
   expect(phases).toContain('request_binding_cleanup_failed');
 });
 
+for (const outcome of ['success', 'throw', 'cancellation'] as const) {
+  for (const key of ['session', 'device'] as const) {
+    test(`binding cleanup holds the ${key} execution lock after ${outcome}`, async () => {
+      const runtime = makeGateway();
+      const { handler, sessionStore, leaseRegistry } = makeHandler(runtime.gateway);
+      const current = sessionStore.get('session')!;
+      sessionStore.publish('other-session', { ...current, name: 'other-session', actions: [] });
+      const requestId = `cleanup-${key}-${outcome}`;
+      let markCleanupStarted: () => void = () => {};
+      let finishCleanup: () => void = () => {};
+      const cleanupStarted = new Promise<void>((resolve) => {
+        markCleanupStarted = resolve;
+      });
+      const cleanupFinished = new Promise<void>((resolve) => {
+        finishCleanup = resolve;
+      });
+      runtime.bindingDispose.mockImplementationOnce(async () => {
+        markCleanupStarted();
+        await cleanupFinished;
+      });
+      let doctorCalls = 0;
+      vi.spyOn(runtime.operations, 'appLogDoctor').mockImplementation(async () => {
+        if (doctorCalls++ > 0) return { backend: 'android', checks: {}, notes: [] };
+        if (outcome === 'throw') throw new AppError('COMMAND_FAILED', 'doctor failed');
+        if (outcome === 'cancellation') {
+          markRequestCanceled(requestId);
+          throwIfRequestCanceled(requestId);
+        }
+        return { backend: 'android', checks: {}, notes: [] };
+      });
+      const first = handler({ ...request(['doctor']), meta: { requestId } });
+      await cleanupStarted;
+      const locks = getLeaseRegistryExecutionLocks(leaseRegistry);
+      const sharedKey = key === 'session' ? 'session:session' : 'device:emulator-5554';
+      let markQueued: (entry: { previous: Promise<unknown> | undefined }) => void = () => {};
+      const queued = new Promise<{ previous: Promise<unknown> | undefined }>((resolve) => {
+        markQueued = resolve;
+      });
+      const setLock = locks.set.bind(locks);
+      const queueSpy = vi.spyOn(locks, 'set').mockImplementation((lockKey, completion) => {
+        if (lockKey === sharedKey) markQueued({ previous: locks.get(lockKey) });
+        return setLock(lockKey, completion);
+      });
+      const second = handler({
+        ...request(['doctor']),
+        session: key === 'session' ? 'session' : 'other-session',
+        meta: { requestId: `${requestId}-queued` },
+      });
+      try {
+        expect((await queued).previous).toBeDefined();
+        expect(runtime.bind).toHaveBeenCalledTimes(1);
+      } finally {
+        queueSpy.mockRestore();
+        finishCleanup();
+        clearRequestCanceled(requestId);
+        await Promise.all([first, second]);
+      }
+      const [firstResponse, secondResponse] = await Promise.all([first, second]);
+      expect(firstResponse.ok).toBe(outcome === 'success');
+      if (outcome === 'cancellation') {
+        expect(firstResponse).toMatchObject({
+          ok: false,
+          error: { code: 'COMMAND_FAILED', details: { reason: 'request_canceled' } },
+        });
+      }
+      expect(secondResponse.ok).toBe(true);
+      expect(runtime.bind).toHaveBeenCalledTimes(2);
+      expect(runtime.bindingDispose).toHaveBeenCalledTimes(2);
+    });
+  }
+}
+
 function makeHandler(gateway: DeviceRuntimeGateway<PlatformRuntimeOperations>) {
   const sessionStore = makeSessionStore('request-runtime-binding-router-');
+  const leaseRegistry = new LeaseRegistry();
   sessionStore.publish('session', {
     name: 'session',
     device: { platform: 'android', id: 'emulator-5554', name: 'Pixel', kind: 'emulator' },
@@ -62,12 +142,13 @@ function makeHandler(gateway: DeviceRuntimeGateway<PlatformRuntimeOperations>) {
   });
   return {
     sessionStore,
+ 
```

**File**: `packages/daemon/src/core/__tests__/session-action-recorder.test.ts` (modified, +36/-2)
```diff
@@ -7,10 +7,42 @@ import { isSessionRecording } from '../session-script-publication-capability.ts'
  * (`selector-recording.test.ts` covers which commands set `interactiveObservation`).
  */
 import { test, expect } from 'vitest';
-import { recordActionEntry, type RecordActionEntry } from '../session-action-recorder.ts';
+import {
+  isInteractiveObservation,
+  recordActionEntry,
+  type RecordActionEntry,
+} from '../session-action-recorder.ts';
 import { authoringPublication, makeIosSession } from '../../__tests__/support/session-factories.ts';
 
-test('an observation-only action is excluded while repair-armed and no --record is given', () => {
+test.each([
+  { command: 'wait', replayPlanStep: false, intent: undefined },
+  { command: 'diff', replayPlanStep: false, intent: undefined },
+  { command: 'snapshot', replayPlanStep: false, intent: undefined },
+  { command: 'snapshot', replayPlanStep: true, intent: 'authored' },
+])(
+  'publication intent for $command with replayPlanStep=$replayPlanStep',
+  ({ command, replayPlanStep, intent }) => {
+    const session = makeIosSession('default');
+    const req = {
+      token: 't',
+      session: 'default',
+      command,
+      positionals: [],
+      internal: { replayPlanStep },
+    };
+    const action = recordActionEntry(session, {
+      command,
+      positionals: [],
+      flags: {},
+      interactiveObservation: isInteractiveObservation(req),
+    });
+
+    expect(action).toBeDefined();
+    expect(action?.publicationIntent).toBe(intent);
+  },
+);
+
+test('an observation without --record is excluded while repair-armed', () => {
   const session = makeIosSession('default', {
     scriptPublication: {
       kind: 'repair',
@@ -47,6 +79,8 @@ test('--record forces an observation-only action through while repair-armed', ()
     interactiveObservation: true,
   });
   expect(action).toBeDefined();
+  expect(action?.flags.record).toBe(true);
+  expect(action?.publicationIntent).toBe('explicit-record');
   expect(session.actions.map((a) => a.command)).toEqual(['get']);
 });
 
```

**File**: `packages/daemon/src/core/__tests__/session-script-writer.test.ts` (modified, +63/-1)
```diff
@@ -3,7 +3,7 @@ import { test, expect, vi } from 'vitest';
 import fs from 'node:fs';
 import path from 'node:path';
 import { HEAL_COMPLETE_SENTINEL, SessionScriptWriter } from '../session-script-writer.ts';
-import { recordActionEntry } from '../session-action-recorder.ts';
+import { isInteractiveObservation, recordActionEntry } from '../session-action-recorder.ts';
 import {
   makeAuthoringSession,
   makeRepairArmedSession,
@@ -119,6 +119,38 @@ test('write() carries a recorded wait --raw through to the script and back', ()
   expect(parsed.actions[0]?.flags.snapshotRaw).toBe(true);
 });
 
+test.each(['authored', 'explicit-record'] as const)(
+  'healed output preserves a snapshot with %s publication intent',
+  (intent) => {
+    const root = mkdtempForTestSync('agent-device-script-writer-retained-snapshot-');
+    const writer = new SessionScriptWriter(path.join(root, 'sessions'));
+    const session = makeRepairCompleteSession('default');
+    const req = {
+      token: 't',
+      session: 'default',
+      command: 'snapshot',
+      positionals: [],
+      flags:
+        intent === 'explicit-record'
+          ? {
+              record: true,
+              snapshotInteractiveOnly: true,
+            }
+          : { snapshotInteractiveOnly: true },
+      ...(intent === 'authored' ? { internal: { replayPlanStep: true } } : {}),
+    };
+    recordActionEntry(session, {
+      command: req.command,
+      positionals: req.positionals,
+      flags: req.flags,
+      interactiveObservation: isInteractiveObservation(req),
+    });
+    const { parsed } = writeAndParse(writer, session);
+    expect(parsed.actions.map((entry) => entry.command)).toEqual(['snapshot']);
+    expect(parsed.actions[0]?.flags.snapshotInteractiveOnly).toBe(true);
+  },
+);
+
 test('a boundary-sliced script still strips diagnostic snapshot actions', () => {
   const root = mkdtempForTestSync('agent-device-script-writer-snapshot-strip-');
   const writer = new SessionScriptWriter(path.join(root, 'sessions'));
@@ -127,6 +159,7 @@ test('a boundary-sliced script still strips diagnostic snapshot actions', () =>
     actions: [
       action({ command: 'open', positionals: ['Demo'] }),
       action({ command: 'snapshot', positionals: [] }),
+      action({ command: 'snapshot', positionals: [], flags: { record: true } }),
       action({ command: 'click', positionals: ['label="Save"'] }),
     ],
   });
@@ -834,3 +867,32 @@ test('#1533: an ARMED authoring recording is untouched by the abort gate', () =>
   const { parsed } = writeAndParse(writer, session);
   expect(parsed.actions.map((a) => a.command)).toEqual(['click']);
 });
+
+test.each([
+  { record: undefined, replayPlanStep: false },
+  { record: true, replayPlanStep: false },
+  { record: true, replayPlanStep: true },
+])(
+  'ordinary authoring retains only authored snapshots with record=$record and replayPlanStep=$replayPlanStep',
+  ({ record, replayPlanStep }) => {
+    const root = mkdtempForTestSync('agent-device-script-writer-authoring-snapshot-');
+    const writer = new SessionScriptWriter(path.join(root, 'sessions'));
+    const session = makeAuthoringSession('default', {
+      actions: [action({ command: 'open', positionals: ['Demo'] })],
+    });
+    recordActionEntry(session, {
+      command: 'snapshot',
+      positionals: [],
+      flags: {
+        record,
+        snapshotInteractiveOnly: true,
+      },
+      interactiveObservation: !replayPlanStep,
+    });
+
+    const { parsed } = writeAndParse(writer, session);
+    expect(parsed.actions.map((entry) => entry.command)).toEqual(
+      replayPlanStep ? ['open', 'snapshot'] : ['open'],
+    );
+  },
+);
```

**File**: `packages/daemon/src/core/session-action-recorder.ts` (modified, +8/-1)
```diff
@@ -86,6 +86,13 @@ export function recordActionEntry(
     runtime: recordedEntry.runtime,
     flags: sanitizeFlags(recordedEntry.flags),
     result: recordedEntry.result,
+    ...(OBSERVATION_ONLY_COMMANDS.has(recordedEntry.command)
+      ? recordedEntry.interactiveObservation === false
+        ? { publicationIntent: 'authored' as const }
+        : recordedEntry.flags.record === true
+          ? { publicationIntent: 'explicit-record' as const }
+          : {}
+      : {}),
     ...(recordedEntry.targetEvidence ? { targetEvidence: recordedEntry.targetEvidence } : {}),
     ...(recordedEntry.targetEvidences ? { targetEvidences: recordedEntry.targetEvidences } : {}),
   };
@@ -360,7 +367,7 @@ function isExcludedRepairSegmentObservation(
 ): boolean {
   if (!entry.interactiveObservation) return false;
   if (repairSessionBoundary(session) === undefined) return false;
-  return entry.flags?.record !== true;
+  return entry.flags.record !== true;
 }
 
 // The keys a recorded action carries derive from each flag declaration's `recorded`
```

**File**: `packages/daemon/src/core/session-script-writer.ts` (modified, +7/-1)
```diff
@@ -312,7 +312,13 @@ function buildOptimizedActions(
   const relevantActions = session.actions.slice(boundary ?? 0);
   const optimized: SessionAction[] = [];
   for (const action of relevantActions) {
-    if (action.command === 'snapshot') continue;
+    if (
+      action.command === 'snapshot' &&
+      action.publicationIntent !== 'authored' &&
+      !(repairArmed && action.publicationIntent === 'explicit-record')
+    ) {
+      continue;
+    }
     const optimizedAction = optimizeSelectorChainAction(action);
     if (optimizedAction) {
       optimized.push(optimizedAction);
```

---

### Incident Patch 3: `6e8c2a04` (2026-10-17)
**Commit Message**: build(package): stop shipping Swift test sources (#3785)

* build(package): stop shipping Swift test sources

The npm files list ships apple/macos-helper whole, so its Tests/ entered
the tarball even though the install never compiles them. Excluding the
directory through files alone breaks the shipped build: SwiftPM refuses
any command once a declared test target's sources are missing, and a
manifest that probes FileManager for the directory depends on the
install working directory and manifest sandbox.

Move the test targets to apple/macos-helper-tests, a development-only
package whose Sources symlink compiles the shipped helper sources with
@testable reach. The shipped manifest keeps only the products the
install builds, so a packed tree builds unchanged and the tests keep
running through pnpm test:macos-helper in CI's macos-helper gate. A
repo guard holds the two manifests in parity.

* chore(gates): keep macOS helper test sources out of npm packs

The publish asset guard already rejects shipped benchmark scripts; add
the sibling invariant for the helper's Tests/ directory so a future
files-list edit cannot re-ship sources the install never compiles.

* fix(gates): skip non-blob

**File**: `.fallowrc.json` (modified, +5/-1)
```diff
@@ -64,7 +64,11 @@
     "scripts/maestro-conformance/corpus/**",
     "apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests.xctestplan",
     "scripts/help-conformance-sample-outputs.d.mts",
-    "scripts/help-conformance-runner-output.d.mts"
+    "scripts/help-conformance-runner-output.d.mts",
+    // A hand-written type surface for a plain-Node .mjs the typechecked program (and Fallow's
+    // graph) cannot import; its only consumer is the .mjs's real importers, resolved by tsc, not
+    // by an import edge. Same shape as the help-conformance declaration files above.
+    "scripts/size-report-package.d.mts"
   ],
   "dynamicallyLoaded": ["packages/daemon/src/execution/interaction/index.ts"],
   "ignoreDependencies": [
```

**File**: `apple/macos-helper/Package.swift` (modified, +4/-0)
```diff
@@ -1,6 +1,10 @@
 // swift-tools-version: 5.9
 import PackageDescription
 
+// The npm package ships this directory and builds it on the user's machine. The tests under
+// Tests/ stay out of the tarball through `files`, except one PackStub.swift per test target:
+// SwiftPM refuses any load of a package whose declared test target has no sources, so the
+// shipped tree needs a source per test target for the install-time `swift build` to succeed.
 let package = Package(
   name: "agent-device-macos-helper",
   platforms: [.macOS(.v13)],
```

**File**: `apple/macos-helper/Tests/AgentDeviceMacOSHelperTests/PackStub.swift` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+// The npm package ships this one file and nothing else under the test targets (see `files` in
+// package.json). SwiftPM refuses to load a package whose declared test target has no sources, so
+// the install-time `swift build` of the packed tree needs a source here; the real tests for this
+// target live beside it and are excluded from the pack.
+import XCTest
+
+final class AgentDeviceMacOSHelperPackStubTests: XCTestCase {}
```

**File**: `apple/macos-helper/Tests/AgentDeviceMacOSInputTests/PackStub.swift` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+// The npm package ships this one file and nothing else under the test targets (see `files` in
+// package.json). SwiftPM refuses to load a package whose declared test target has no sources, so
+// the install-time `swift build` of the packed tree needs a source here; the real tests for this
+// target live beside it and are excluded from the pack.
+import XCTest
+
+final class AgentDeviceMacOSInputPackStubTests: XCTestCase {}
```

**File**: `package.json` (modified, +3/-0)
```diff
@@ -222,6 +222,9 @@
     "dist",
     "apple/macos-helper",
     "!apple/macos-helper/**/.build",
+    "!apple/macos-helper/Tests/**",
+    "apple/macos-helper/Tests/AgentDeviceMacOSHelperTests/PackStub.swift",
+    "apple/macos-helper/Tests/AgentDeviceMacOSInputTests/PackStub.swift",
     "apple/snapshot-bridge",
     "apple/fold-helper",
     "android/snapshot-helper/dist",
```

**File**: `scripts/__tests__/fixtures/size-report-npm-pack.json` (modified, +79/-17)
```diff
@@ -1,21 +1,83 @@
 {
   "unpackedSize": 2319,
   "files": [
-    { "path": "dist/src/index.js", "size": 401 },
-    { "path": "dist/src/index.d.ts", "size": 102 },
-    { "path": "dist/apple/runner/RunnerTests.swift", "size": 503 },
-    { "path": "dist/apple/snapshot-presentation/Package.swift", "size": 113 },
-    { "path": "apple/snapshot-bridge/SnapshotBridge.m", "size": 0 },
-    { "path": "apple/snapshot-bridge/SnapshotBridgeRuntime.m", "size": 0 },
-    { "path": "apple/snapshot-bridge/SnapshotBridgeRuntime.h", "size": 0 },
-    { "path": "apple/snapshot-bridge/SnapshotBridgeCapture.h", "size": 0 },
-    { "path": "apple/snapshot-bridge/SnapshotBridgeCapture.m", "size": 0 },
-    { "path": "apple/macos-helper/Sources/main.swift", "size": 211 },
-    { "path": "android/snapshot-helper/dist/helper.apk", "size": 307 },
-    { "path": "android/snapshot-helper/dist/helper.manifest.json", "size": 99 },
-    { "path": "android/ime-helper/dist/helper.apk", "size": 307 },
-    { "path": "android/ime-helper/dist/helper.manifest.json", "size": 99 },
-    { "path": "package.json", "size": 99 },
-    { "path": "vendor/unknown.bin", "size": 78 }
-  ]
+    {
+      "path": "dist/src/index.js",
+      "size": 401
+    },
+    {
+      "path": "dist/src/index.d.ts",
+      "size": 102
+    },
+    {
+      "path": "dist/apple/runner/RunnerTests.swift",
+      "size": 503
+    },
+    {
+      "path": "dist/apple/snapshot-presentation/Package.swift",
+      "size": 113
+    },
+    {
+      "path": "apple/snapshot-bridge/SnapshotBridge.m",
+      "size": 0
+    },
+    {
+      "path": "apple/snapshot-bridge/SnapshotBridgeRuntime.m",
+      "size": 0
+    },
+    {
+      "path": "apple/snapshot-bridge/SnapshotBridgeRuntime.h",
+      "size": 0
+    },
+    {
+      "path": "apple/snapshot-bridge/SnapshotBridgeCapture.h",
+      "size": 0
+    },
+    {
+      "path": "apple/snapshot-bridge/SnapshotBridgeCapture.m",
+      "size": 0
+    },
+    {
+      "path": "apple/macos-helper/Package.swift",
+      "size": 1057
+    },
+    {
+      "path": "apple/macos-helper/Sources/main.swift",
+      "size": 211
+    },
+    {
+      "path": "android/snapshot-helper/dist/helper.apk",
+      "size": 307
+    },
+    {
+      "path": "android/snapshot-helper/dist/helper.manifest.json",
+      "size": 99
+    },
+    {
+      "path": "android/ime-helper/dist/helper.apk",
+      "size": 307
+    },
+    {
+      "path": "android/ime-helper/dist/helper.manifest.json",
+      "size": 99
+    },
+    {
+      "path": "package.json",
+      "size": 99
+    },
+    {
+      "path": "vendor/unknown.bin",
+      "size": 78
+    },
+    {
+      "path": "apple/macos-helper/Tests/AgentDeviceMacOSHelperTests/PackStub.swift",
+      "size": 426
+    },
+    {
+      "path": "apple/macos-helper/Tests/AgentDeviceMacOSInputTests/PackStub.swift",
+      "size": 426
+    }
+  ],
+  "entryCount": 19,
+  "size": 3376
 }
```

**File**: `scripts/__tests__/size-report-package.test.ts` (modified, +60/-5)
```diff
@@ -9,12 +9,31 @@ const fixturePack = JSON.parse(
   await readFile(join(import.meta.dirname, 'fixtures', 'size-report-npm-pack.json'), 'utf8'),
 );
 
+// The fixture pack ships the macOS helper (manifest, sources, and per-target PackStub.swift),
+// so every assertion here names the manifest source the guard would read from the packed tree;
+// without it the guard falls back to this checkout's manifest via repoRoot.
+const helperManifestSource = [
+  '.target(',
+  '  name: "AgentDeviceMacOSInput",',
+  '.executableTarget(',
+  '  name: "AgentDeviceMacOSHelper",',
+  '.testTarget(',
+  '  name: "AgentDeviceMacOSHelperTests",',
+  '.testTarget(',
+  '  name: "AgentDeviceMacOSInputTests",',
+].join('\n');
+
 test('publish package requires both Android helpers and excludes benchmark scripts', () => {
-  assert.doesNotThrow(() => assertPublishPackageContents(fixturePack.files));
+  assert.doesNotThrow(() =>
+    assertPublishPackageContents(fixturePack.files, {
+      macosHelperManifestSource: helperManifestSource,
+    }),
+  );
   assert.throws(
     () =>
       assertPublishPackageContents(
         fixturePack.files.filter((entry) => !entry.path.startsWith('android/ime-helper/')),
+        { macosHelperManifestSource: helperManifestSource },
       ),
     /android\/ime-helper/,
   );
@@ -31,16 +50,52 @@ test('publish package requires both Android helpers and excludes benchmark scrip
   assert.doesNotThrow(() =>
     assertPublishPackageContents(
       fixturePack.files.filter((entry) => !entry.path.startsWith('apple/snapshot-bridge/')),
+      { macosHelperManifestSource: helperManifestSource },
     ),
   );
   assert.throws(
     () =>
-      assertPublishPackageContents([
-        ...fixturePack.files,
-        { path: 'scripts/ios-snapshot-benchmark/run.ts', size: 1 },
-      ]),
+      assertPublishPackageContents(
+        [...fixturePack.files, { path: 'scripts/ios-snapshot-benchmark/run.ts', size: 1 }],
+        { macosHelperManifestSource: helperManifestSource },
+      ),
     /benchmark or build scripts/,
   );
+  // Each declared test target needs its PackStub.swift or the install-time `swift build` of the
+  // packed tree dies; a missing one must name the missing path.
+  assert.throws(
+    () =>
+      assertPublishPackageContents(
+        fixturePack.files.filter(
+          (entry) =>
+            entry.path !== 'apple/macos-helper/Tests/AgentDeviceMacOSInputTests/PackStub.swift',
+        ),
+        { macosHelperManifestSource: helperManifestSource },
+      ),
+    /pack stubs: apple\/macos-helper\/Tests\/AgentDeviceMacOSInputTests\/PackStub\.swift/,
+  );
+  assert.throws(
+    () =>
+      assertPublishPackageContents(
+        [
+          ...fixturePack.files,
+          {
+            path: 'apple/macos-helper/Tests/AgentDeviceMacOSInputTests/ScheduleTests.swift',
+            size: 1,
+          },
+        ],
+        { macosHelperManifestSource: helperManifestSource },
+      ),
+    /macOS helper test sources/,
+  );
+  // Sources without the manifest are not a buildable Swift package; the pack must say so.
+  assert.throws(
+    () =>
+      assertPublishPackageContents(
+        fixturePack.files.filter((entry) => entry.path !== 'apple/macos-helper/Package.swift'),
+      ),
+    /sources without its Package\.swift/,
+  );
 });
 
 test('Markdown emphasizes total install size and startup without duplicate breakdowns', () => {
```

**File**: `scripts/coverage-changed/model.test.ts` (modified, +31/-1)
```diff
@@ -86,7 +86,12 @@ const coverage = parseLcov(
 );
 
 function diff(path: string, added: number[], deleted = false): ChangedFileDiff {
-  return { path, added, deleted };
+  return { path, added, deleted, regularFile: true };
+}
+
+/** A changed path whose new side is not a blob (symlink or gitlink); `run.ts` never reads its bytes. */
+function nonBlobDiff(path: string, added: number[]): ChangedFileDiff {
+  return { path, added, deleted: false, regularFile: false };
 }
 
 test('gate fails when changed-line coverage is below threshold and lists offenders', () => {
@@ -158,6 +163,31 @@ test('waiver forces a pass but still reports the numbers', () => {
   assert.equal(result.pct, 66.67);
 });
 
+test('an includable path whose new side is a symlink or gitlink is skipped, not read', () => {
+  // A committed symlink like `tools/helper-tests/Sources -> ../helper/Sources` shows in the
+  // diff as added text (its target), so it reaches this loop by path shape. Its working-tree
+  // entry resolves to a directory, so a content read dies on EISDIR; reading the
+  // object mode is what keeps the file out of both the scored and the excluded tally.
+  const readPaths: string[] = [];
+  const result = computeChangedCoverage({
+    diffs: [
+      nonBlobDiff('src/helper-tests/index.ts', [1]),
+      nonBlobDiff('vendor/lib', [1]),
+      diff('src/covered.ts', [1, 2, 3]),
+    ],
+    coverage,
+    fileLines: (path) => {
+      readPaths.push(path);
+      return null;
+    },
+  });
+  assert.deepEqual(readPaths, ['src/covered.ts']);
+  // 2/3 = 66.67% < 70: the skip leaves the verdict exactly what the scored file alone earns.
+  assert.equal(result.totalLines, 3);
+  assert.equal(result.passed, false);
+  assert.deepEqual(result.excluded.files, []);
+});
+
 test('includable source absent from lcov counts as excluded-path code lines', () => {
   const result = computeChangedCoverage({
     diffs: [diff('src/sdk/thing.ts', [1, 2, 3])],
```

#### Recent Merged Pull Requests:
- **PR #3803** (2026-10-18): chore: remove CHANGELOG.md again and gitignore it (@thymikee)
- **PR #3799** (2026-10-18): docs(adr): add the ADR format guide and the write route (@thymikee)
- **PR #3796** (2026-10-18): docs(adr): correct stale facts in the ADR set (@thymikee)
- **PR #3795** (2026-10-18): fix(daemon): close startup and shutdown ownership gaps (@thymikee)
- **PR #3793** (2026-10-18): fix(cli): refuse an empty numeric flag value instead of reading it as 0 (@RaphaelFakhri)
- **PR #3791** (2026-10-18): fix(daemon): replace fixed 15s startup kill with progress-aware startup budget (@thymikee)

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

## X. daemon): replace fixed 15s startup kill with progress-aware startup budget (#379

**RULE**:
When implementing operations in `.github/workflows/ios.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `72e79651`: daemon): replace fixed 15s startup kill with progress-aware startup budget (#3791). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ios.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
          # The public-SDK record is the cold-startup evidence; the CLI timer only wraps attach.
          node --input-type=module -e '
            const { performance } = await import("node:perf_hooks");
            const { ensureDaemon } = await import("./dist/src/index.js");
            const t0 = performance.now();
            const c = await ensureDaemon({ stateDir: process.env.AGENT_DEVICE_STATE_DIR });
            console.log(JSON.stringify({ phase: "daemon_cold_startup", started: c.started, pid: c.daemon.pid, durationMs: Math.round(performance.now() - t0) }));
          '
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `72e79651` are properly handled with clean fallback behavior.
