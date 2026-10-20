> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source**: github ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Source Version**: `f217bd67`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T17:16:50.525Z  
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
> **Harvest Timestamp**: 2026-10-20T17:16:50.292Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Mobile app automation and verification for AI coding agents. CLI, MCP server, and typed Node.js API for iOS, Android, HarmonyOS, TV, web, macOS, and Linux.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5080 stars

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
 * `@ref`, a two-token point (`x y`), or a single selector. Everything
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
- **Issue #3831** (2026-10-20): **Android smoke: first fixture capture stalls before any readable snapshot**
  *Symptoms*: Android smoke intermittently fails before its first readable capture after opening the fixture. Diagnose and fix the capture/setup boundary without increasing the wait deadline or adding retry-only recovery.  Observed command: ```sh agent-device wait text "Automation lab" 10000 --platform android --serial emulator-5554 --session <session> --daemon-server-mode dual --json ```  Evidence: - PR #3824, `14f32fb218ac9e5608012bf6a5805652dc61f7fc`: [run 39287002936](https://github.com/callstack/agent-device/actions/runs/39287002936/job/118176526423). `smoke-android-emulator.test.ts:7:1`, scenario `smoke:automation-system`, `COMMAND_FAILED`, reason `wait_capture_stalled`, one capture, zero readable captures, deadline after 10439ms. - Earlier main, `a61556b8fd3268dd0b8032409ad0f0d06107019b`: [run 39025922562](https://github.com/callstack/agent-device/actions/runs/39025922562). Same command, scenario, assertion and reason; one capture, zero readable captures, 10232ms poll. - Both runs retain `android-artifacts`. Current failure screenshot shows Automation lab; the subsequent diagnostic snapshot succeeds with healthy android-helper capture (619ms helper / 1914ms snapshot). No crash appears in its crash buffer. - PR #3824 leaves Android runtime, integration scenarios, Android workflow/setup, package manifest and lockfile unchanged from its base `a661e43d83735fc74a02118b5698e5d45e03ee21`. That exact base's [Android run](https://github.com/callstack/agent-device/actions/runs/39280682477) pa

- **Issue #3800** (2026-10-19): **iOS runner: isolate collapsed-tab occupancy test from prerequisite timeouts**
  *Symptoms*: ## Purpose  Make the collapsed-tab occupancy test exercise its intended exhausted tree tier on slow CI hosts.  `testPlanMovesPastATreeTierWhoseCollapsedTabQueryCannotStart` expects reason `budget`. It sometimes receives `capture-failed` at `RunnerTests+SnapshotCapturePlanOccupancyTests.swift:529`.  ## Evidence  The raw job logs show the same assertion on three unrelated heads:  - #3791, `0295ee5f`: [job 117698966135](https://github.com/callstack/agent-device/actions/runs/39135463874/job/117698966135). - #3798, `7c105337`: [job 117668259465](https://github.com/callstack/agent-device/actions/runs/39125040019/job/117668259465). - #3785, `449b4d48`: [job 117419145731](https://github.com/callstack/agent-device/actions/runs/39040590033/job/117419145731).  The test file is identical across these heads. #3791 changes no Swift file. Its new daemon timing step runs after the XCTest suite.  The #3791 log records a one-second `snapshot_viewport` timeout before private AX recovery. The other failures record a tree-processing timeout. These paths produce `capture-failed` before the intended budget assertion. Host timing is a suspected trigger; it is not a proven complete cause.  A focused local loop passed 3/3 times on a separate iOS 26.2 simulator. No local red reproduction or fix is proven.  ## Required behavior  - Isolate prerequisite viewport, orientation, keyboard, and processing work from the deliberately delayed tree operation. - Preserve the assertion that the delayed operation was

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

### Incident Patch 1: `4645ddd7` (2026-10-19)
**Commit Message**: fix(daemon): preserve recorded ownership through stop and cleanup (#3806)

* fix(daemon): keep stop and retirement within the observed ownership

* chore(gates): typecheck the daemon cleanup script

* fix(daemon): judge takeover ownership once inside the retirement

readReusableLocalDaemon rejected an embedded or unknown owner before the
central retirement could look at it, so a record whose owner had already
exited wedged every managed command instead of recovering. Delete the two
client guards and the resolveTimeoutRecovery ownership guard: ownership is
judged inside stopAndRetireDaemon on every takeover route
(readReusableLocalDaemon, replaceUnreachable, quiesceOrRetireUnresponsive,
awaitDrainedDaemon and forceRetireDaemon alike). Map a retained owner
reason to the existing typed errors once, in daemonRetirementError for the
stop route and daemonTakeoverRetirementError for a takeover, and prove the
managed route recovers a crashed embedded or unrecognized owner without
signaling it.

https://github.com/callstack/agent-device/pull/3806#issuecomment-6262194144

* docs(daemon): name the reason a --clean stop refuses an unreadable record

daemon stop --clean checks the record's owne

**File**: `packages/daemon-contracts/src/daemon-process.ts` (modified, +16/-1)
```diff
@@ -103,7 +103,22 @@ export type DaemonTerminationResult =
     }>
   | Readonly<{
       status: 'retained';
-      reason: 'missing-start-time' | 'identity-unverified' | 'signal-failed' | 'exit-timeout';
+      reason:
+        | 'missing-start-time'
+        | 'identity-unverified'
+        /**
+         * A host owns this runtime and ends it. Callers that judge a registration answer this instead of
+         * calling {@link stopDaemonProcess} at all (`stopAndRetireDaemon`); this function signals
+         * whatever verified identity it is handed and never decides ownership itself.
+         */
+        | 'embedded-owner'
+        /**
+         * The record states an owner this build cannot read, so nothing proves this pid is a daemon of
+         * its own, and signalling it is refused. The other half of the same rule as `embedded-owner`.
+         */
+        | 'owner-unproven'
+        | 'signal-failed'
+        | 'exit-timeout';
       signal?: NodeJS.Signals;
     }>;
 
```

**File**: `packages/daemon-contracts/src/daemon-registration-owner.ts` (modified, +69/-17)
```diff
@@ -29,6 +29,8 @@ import type { DaemonCodeOrigin } from '@agent-device/host-kit/code-signature';
 import {
   resolveDaemonPaths,
   type DaemonCapability,
+  type DaemonOwnership,
+  type ObservedDaemonIdentity,
   type DaemonPaths,
   type DaemonServerMode,
 } from './daemon-resolution.ts';
@@ -59,6 +61,7 @@ export type DaemonRegistrationFields = Readonly<{
   capabilities?: readonly DaemonCapability[];
   /** The provider plugin inventory, so a client can read what this daemon registered. */
   plugins?: readonly PluginInventoryEntry[];
+  ownership?: DaemonOwnership;
 }>;
 type DaemonRegistrationRemoval =
   | Readonly<{ state: 'removed' }>
@@ -333,7 +336,13 @@ function requirePrivateReplayState(
 
 export type DaemonRetirementInput = Readonly<{
   paths: DaemonPaths;
-  observed: OwnerIdentity | null;
+  /**
+   * The lifetime a caller proved the daemon is, with the owner that record stated at the read. A caller
+   * that launched the process itself states `detached`, which is what it knows; a caller that read
+   * `daemon.json` passes what that record stated. Signalling on a guessed owner is the one thing this
+   * module must not do, so no caller may leave this out.
+   */
+  observed: ObservedDaemonIdentity | null;
   termTimeoutMs?: number;
   killTimeoutMs?: number;
   lockTimeoutMs?: number;
@@ -363,6 +372,13 @@ export type DaemonRetirementResult =
         | 'lock-busy'
         | 'registration-replaced'
         | 'metadata-unreadable'
+        /** A host owns the observed runtime; only that host, or its shutdown request, ends it. */
+        | 'embedded-owner'
+        /**
+         * The record states an owner this build cannot read, so nothing proves the pid it names is a
+         * daemon of its own, and signalling it is refused.
+         */
+        | 'owner-unproven'
         | 'retirement-unconfirmed';
       error?: NormalizedError;
       repairCommitFailure?: RepairCommitFailure;
@@ -395,14 +411,24 @@ export async function stopAndRetireDaemon(
       error: normalizeError(error),
     };
   }
+  // Signalling needs a proven owner, and the observation carries the one its record stated: a record
+  // naming a host describes a runtime that host ends, and a record stating an owner this build cannot
+  // read says nothing about what is safe to end. Only a proven detached daemon is signaled.
+  const owner = observed?.ownership;
   const retirement = retireObservedDaemon(
     { ...input, observed },
-    (identity) =>
-      stopDaemonProcess(identity, {
-        mode: input.mode,
-        termTimeoutMs: input.termTimeoutMs ?? 3_000,
-        killTimeoutMs: input.killTimeoutMs ?? 1_000,
-      }),
+    observed && owner !== 'detached'
+      ? (identity) =>
+          proveExitWithoutSignaling(
+            identity,
+            owner === 'embedded' ? 'embedded-owner' : 'owner-unproven',
+          )
+      : (identity) =>
+          stopDaemonProcess(identity, {
+            mode: input.mode,
+            termTimeoutMs: input.termTimeoutMs ?? 3_000,
+            killTimeoutMs: input.killTimeoutMs ?? 1_000,
+          }),
     owned,
     input.startupJoinTimeoutMs ?? 1_000,
   );
@@ -415,16 +441,16 @@ export async function stopAndRetireDaemon(
 
 function confirmOwnedStartupIdentity(
   owned: PrivateReplayState,
-  observed: OwnerIdentity | null,
-): OwnerIdentity | null {
+  observed: ObservedDaemonIdentity | null,
+): ObservedDaemonIdentity | null {
   if (!observed) {
     if (owned.startups.length === 0) return null;
     throw unownedStartupError();
   }
   const startup = owned.startups.find(({ launch }) => launch.pid === observed.pid);
   if (!startup) throw unownedStartupError();
   const { launch } = startup;
-  const identity = observed.startTime ? observed : launch.readIdentity();
+  const identity = observed.startTime ? observed : { ...observed, ...launch.readIdentity() };
   if (launch.startTime && launch.startTime === identity.startTime) return identity;
   throw unownedStartupError();
 }
@@ -439,13 +465,33 @@ function unownedStartupError(): AppError {
 export async function recoverAbandonedDaemonRegistration(
   input: DaemonRetirementInput,
 ): Promise<DaemonRetirementResult> {
-  return await retireObservedDaemon(input, async (identity) => {
-    if (!identity.startTime?.trim()) return { status: 'retained', reason: 'missing-start-time' };
-    const confirmed = { pid: identity.pid, startTime: identity.startTime };
-    return (await waitForDaemonExit(confirmed, { timeoutMs: 0 })).exited
-      ? { status: 'exited', identity: confirmed, mode: 'already-exited' }
-      : { status: 'retained', reason: 'identity-unverified' };
-  });
+  return await retireObservedDaemon(input, (identity) => proveExitWithoutSignaling(identity));
+}
+
+/**
+ * Termination refusals that name an owner's rule rather than a lifetime this caller could not prove:
+ * both mean "nobody may signal this process", and both travel to the caller at the top level.
+ */
+function isOwnerRefusal(
+  
```

**File**: `packages/daemon-contracts/src/daemon-registration-status.test.ts` (modified, +37/-0)
```diff
@@ -66,12 +66,49 @@ test('a live registered daemon reports its identity and the plugin inventory it
     state: 'running',
     stateDir,
     pid: owner.pid,
+    // A record that predates ownership is a detached daemon, which is what a reader must be able to
+    // rely on before it decides a stop may signal this pid.
+    ownership: 'detached',
     version: '0.21.30',
     transport: 'http',
     plugins: [ACTIVE, FAILED, { state: 'unknown' }],
   });
 });
 
+test('a record published by a host reports the ownership that limits what a stop may do', () => {
+  const stateDir = mkdtempForTestSync('agent-device-daemon-status-');
+  const owner = readCurrentOwnerIdentity();
+  publish(stateDir, {
+    token: 't',
+    port: 1,
+    pid: owner.pid,
+    processStartTime: owner.startTime,
+    ownership: 'embedded',
+  });
+
+  expect(readDaemonStatus(resolveDaemonPaths(stateDir))).toMatchObject({
+    state: 'running',
+    pid: owner.pid,
+    ownership: 'embedded',
+  });
+});
+
+test('a record that claims an ownership nobody knows reads as an unrecognized one', () => {
+  const stateDir = mkdtempForTestSync('agent-device-daemon-status-');
+  const owner = readCurrentOwnerIdentity();
+  publish(stateDir, {
+    token: 't',
+    port: 1,
+    pid: owner.pid,
+    processStartTime: owner.startTime,
+    ownership: 'sideways',
+  });
+
+  // An ownership value outside the vocabulary says nothing about who owns the process, and `detached`
+  // is the one reading a caller may act on by signalling it. Status says it cannot recognize the owner.
+  expect(readDaemonStatus(resolveDaemonPaths(stateDir)).ownership).toBe('unknown');
+});
+
 test('a record whose process is gone or was replaced is not a running daemon', () => {
   const stateDir = mkdtempForTestSync('agent-device-daemon-status-');
   const owner = readCurrentOwnerIdentity();
```

**File**: `packages/daemon-contracts/src/daemon-registration.ts` (modified, +99/-32)
```diff
@@ -8,11 +8,14 @@ import {
   type OwnerIdentity,
 } from '@agent-device/host-kit/process';
 import {
+  readDaemonOwnership,
   readDaemonRecord,
   readRecordedDaemonTransport,
   resolveDaemonPaths,
+  type DaemonOwnership,
   type DaemonPaths,
   type DaemonServerMode,
+  type ObservedDaemonIdentity,
 } from './daemon-resolution.ts';
 
 /**
@@ -22,8 +25,8 @@ import {
  * however alive it is.
  */
 export function readRegisteredDaemonIdentity(infoPath: string): OwnerIdentity | null {
-  const record = readRegistration(infoPath);
-  return record.status === 'registered' ? record.identity : null;
+  const reading = readDaemonRegistration(infoPath);
+  return reading.status === 'present' ? reading.identity : null;
 }
 
 export function processLockHoldsDaemonIdentity(
@@ -44,26 +47,29 @@ type ParsedRegistration = { pid: number | null; startTime: string | null };
 type DaemonRecord = Readonly<Record<string, unknown>>;
 
 /**
- * Whether `daemon.json` registers a daemon: a projection of the one record reader that adds the
- * identity, so a record that names no owner is `ownerless` however it came to.
+ * The one read of `daemon.json` behind every projection of that record in this module. `identity` is
+ * null for a record that names no process, and `ownership` is what the record states, read the way a
+ * reader must read it before anything is signaled.
  */
-function readRegistration(
-  infoPath: string,
-):
-  | Readonly<{ status: 'registered'; identity: OwnerIdentity; record: DaemonRecord }>
-  | Readonly<{ status: 'absent' | 'unreadable' | 'ownerless' }> {
+type DaemonRegistrationReading =
+  | Readonly<{
+      status: 'present';
+      record: DaemonRecord;
+      identity: OwnerIdentity | null;
+      ownership: DaemonOwnership;
+    }>
+  | Readonly<{ status: 'absent' | 'unreadable' | 'invalid' }>;
+
+function readDaemonRegistration(infoPath: string): DaemonRegistrationReading {
   const read = readDaemonRecord(infoPath);
-  if (read.status !== 'present') {
-    return { status: read.status === 'invalid' ? 'ownerless' : read.status };
-  }
+  if (read.status !== 'present') return { status: read.status };
   const parsed = parseRegistration(read.record);
-  return parsed.pid === null
-    ? { status: 'ownerless' }
-    : {
-        status: 'registered',
-        identity: { pid: parsed.pid, startTime: parsed.startTime },
-        record: read.record,
-      };
+  return {
+    status: 'present',
+    record: read.record,
+    identity: parsed.pid === null ? null : { pid: parsed.pid, startTime: parsed.startTime },
+    ownership: readDaemonOwnership(read.record.ownership),
+  };
 }
 
 function parseRegistration(parsed: {
@@ -100,15 +106,18 @@ export function readRegisteredDaemonOwnership(
   infoPath: string,
   owner: OwnerIdentity | null,
 ): RegisteredDaemonOwnership {
-  const record = readRegistration(infoPath);
-  if (record.status !== 'registered') return { state: record.status };
+  const reading = readDaemonRegistration(infoPath);
+  if (reading.status !== 'present')
+    return { state: reading.status === 'invalid' ? 'ownerless' : reading.status };
+  // A record that names no process describes nothing a caller can own, however it came to that.
+  if (!reading.identity) return { state: 'ownerless' };
   if (!owner) return { state: 'unproven' };
-  if (ownerIdentityDiffers(record.identity, owner)) {
-    return { state: 'replaced', identity: record.identity };
+  if (ownerIdentityDiffers(reading.identity, owner)) {
+    return { state: 'replaced', identity: reading.identity };
   }
   // Two missing start times agree, and agreeing on nothing is not ownership: this is the pid-only
   // fallback the fence exists to refuse, so it falls to `unproven` rather than to `match`.
-  if (ownerIdentityMatches(record.identity, owner) && record.identity.startTime !== null) {
+  if (ownerIdentityMatches(reading.identity, owner) && reading.identity.startTime !== null) {
     return { state: 'match' };
   }
   return { state: 'unproven' };
@@ -125,6 +134,11 @@ export type DaemonStatus = Readonly<{
   pid?: number;
   version?: string;
   transport?: DaemonServerMode;
+  /**
+   * Who owns the process this record names, and so who may end it. Only a running record can say: a
+   * stopped one names no live process to own.
+   */
+  ownership?: DaemonOwnership;
   /**
    * The provider plugin inventory the running daemon published, as recorded; `readPluginInventory`
    * validates it where it is shown, so this module stays out of the inventory vocabulary's closure.
@@ -145,16 +159,15 @@ export function isUnusableRecord(status: Pick<DaemonStatus, 'state'>): boolean {
  */
 export function readDaemonStatus(paths: DaemonPaths): DaemonStatus {
   const base = { stateDir: paths.baseDir } as const;
-  const read = readDaemonRecord(paths.infoPath);
-  if (read.status !== 'present') {
-    return read.status === 'absent'
+  const reading = readDaemonRegistration(paths.infoPath);
+  if (reading.status !== 'present') 
```

**File**: `packages/daemon-contracts/src/daemon-resolution-quiesce.test.ts` (modified, +54/-14)
```diff
@@ -1,6 +1,13 @@
 import assert from 'node:assert/strict';
 import { test } from 'vitest';
-import { readDaemonQuiesceCensus, readDaemonQuiesceFence } from './daemon-resolution.ts';
+import {
+  buildDaemonLifecycleRequest,
+  DAEMON_LIFECYCLE_COMMANDS,
+  readDaemonLifecycleCensus,
+  readDaemonLifecycleFence,
+  readDaemonLifecycleMode,
+  readDaemonOwnership,
+} from './daemon-resolution.ts';
 
 test('a census is read only when every count is a non-negative integer', () => {
   const census = {
@@ -10,30 +17,63 @@ test('a census is read only when every count is a non-negative integer', () => {
     repairSessions: 2,
     leases: 3,
   };
-  assert.deepEqual(readDaemonQuiesceCensus({ reason: 'daemon-busy', ...census }), census);
+  assert.deepEqual(readDaemonLifecycleCensus({ reason: 'daemon-busy', ...census }), census);
 
-  for (const malformed of [-1, 1.5, '1', Number.NaN, Number.POSITIVE_INFINITY, null]) {
-    assert.equal(readDaemonQuiesceCensus({ ...census, leases: malformed }), undefined);
+  // 2 ** 53 is an integer `Number.isInteger` accepts and arithmetic on it gets wrong, so the census
+  // reader has to be the one that refuses it.
+  for (const malformed of [-1, 1.5, '1', Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, null]) {
+    assert.equal(readDaemonLifecycleCensus({ ...census, leases: malformed }), undefined);
   }
-  assert.equal(readDaemonQuiesceCensus({ sessions: 1 }), undefined);
+  assert.equal(readDaemonLifecycleCensus({ sessions: 1 }), undefined);
   // Only a daemon that is starting up says so; an older one omits the field.
-  assert.equal(readDaemonQuiesceCensus({ ...census, startingUp: true })?.startingUp, true);
+  assert.equal(readDaemonLifecycleCensus({ ...census, startingUp: true })?.startingUp, true);
   const { startingUp: _omitted, ...withoutStartingUp } = census;
-  assert.equal(readDaemonQuiesceCensus(withoutStartingUp)?.startingUp, false);
-  assert.equal(readDaemonQuiesceCensus({ ...census, startingUp: 'yes' }), undefined);
-  assert.equal(readDaemonQuiesceCensus(undefined), undefined);
+  assert.equal(readDaemonLifecycleCensus(withoutStartingUp)?.startingUp, false);
+  assert.equal(readDaemonLifecycleCensus({ ...census, startingUp: 'yes' }), undefined);
+  assert.equal(readDaemonLifecycleCensus(undefined), undefined);
 });
 
 test('a fence names an integer pid and a start time or null, nothing else', () => {
-  assert.deepEqual(readDaemonQuiesceFence({ pid: 7, processStartTime: 'Fri' }), {
+  assert.deepEqual(readDaemonLifecycleFence({ pid: 7, processStartTime: 'Fri' }), {
     pid: 7,
     processStartTime: 'Fri',
   });
-  assert.deepEqual(readDaemonQuiesceFence({ pid: 7, processStartTime: null }), {
+  assert.deepEqual(readDaemonLifecycleFence({ pid: 7, processStartTime: null }), {
     pid: 7,
     processStartTime: null,
   });
-  assert.equal(readDaemonQuiesceFence({ pid: 7 }), undefined);
-  assert.equal(readDaemonQuiesceFence({ pid: 7.5, processStartTime: null }), undefined);
-  assert.equal(readDaemonQuiesceFence('7'), undefined);
+  assert.equal(readDaemonLifecycleFence({ pid: 7 }), undefined);
+  assert.equal(readDaemonLifecycleFence({ pid: 7.5, processStartTime: null }), undefined);
+  assert.equal(readDaemonLifecycleFence('7'), undefined);
+});
+
+test('a quiesce carries the original instance fence', () => {
+  const fence = { pid: 7, processStartTime: 'Fri Oct 17 09:00:00 2026' };
+  for (const mode of ['quiesce'] as const) {
+    const request = buildDaemonLifecycleRequest({ mode, token: 't0ken', fence, requestId: 'r-1' });
+    assert.equal(request.command, DAEMON_LIFECYCLE_COMMANDS[mode]);
+    assert.deepEqual(request.input, fence);
+    assert.equal(request.meta?.requestId, 'r-1');
+    assert.equal(readDaemonLifecycleMode(request.command), mode);
+  }
+  // A request that is not one of the two is dispatched like any other command, including a name the
+  // lookup would answer for through the object prototype.
+  assert.equal(readDaemonLifecycleMode('open'), undefined);
+  assert.equal(readDaemonLifecycleMode('toString'), undefined);
+  assert.equal(readDaemonLifecycleMode('__proto__'), undefined);
+});
+
+test('ownership names who may end the process, and an older record is detached', () => {
+  assert.equal(readDaemonOwnership('embedded'), 'embedded');
+  assert.equal(readDaemonOwnership('detached'), 'detached');
+  // An absent field is every record written before this field existed, and those are daemons that are
+  // their own process.
+  for (const absent of [undefined]) {
+    assert.equal(readDaemonOwnership(absent), 'detached');
+  }
+  // Anything else is its own state: a caller that means to signal a pid reads `unknown` as a thing it
+  // must not do, not as permission to treat the record like a detached daemon's.
+  for (const unrecognized of [null, 'owned', 7, '', 'EMBEDDED', 2 ** 53]) {
+    assert.equal(readDaemonOwnership(unrecognized), 'unknown', String(unrecognized));
+  }
 });
```

**File**: `packages/daemon-contracts/src/daemon-resolution.ts` (modified, +95/-16)
```diff
@@ -7,6 +7,7 @@ import { AppError } from '@agent-device/kernel/errors';
 import { type EnvMap } from '@agent-device/kernel/source-value';
 
 import type { DaemonWireRequest } from '@agent-device/contracts/command';
+import type { OwnerIdentity } from '@agent-device/host-kit/process';
 import type { DaemonServerMode, DaemonTransportPreference } from '@agent-device/kernel/contracts';
 export type { DaemonServerMode, DaemonTransportPreference };
 
@@ -146,35 +147,108 @@ export function resolveDaemonTransportPreference(
   return 'auto';
 }
 
-// The quiesce request is how a client asks an idle daemon to leave so a compatible one can take
-// its state directory. The client and the daemon share this vocabulary, so neither owns it.
-
 /** What a daemon can do beyond the base RPC contract, published in its `daemon.json`. */
 export const DAEMON_CAPABILITIES = ['quiesce'] as const;
 export type DaemonCapability = (typeof DAEMON_CAPABILITIES)[number];
 
-export const DAEMON_QUIESCE_COMMAND = 'daemon_quiesce';
+/**
+ * Who owns the process a registration names, and so who may end it.
+ *
+ * - `detached`: the daemon is its own process, which a stop may signal. This is what a record that
+ *   predates the field names.
+ * - `embedded`: the host that started the runtime owns the process. Nothing in the central
+ *   lifecycle signals that PID, not even hung recovery or a forced stop: the host closes the
+ *   runtime through its own close, and an external stop refuses it.
+ * - `unknown`: the record states an owner this build does not recognize, so no process may be
+ *   signaled on its strength. Signalling on a guess could end a host process, and a value this
+ *   build cannot read is exactly the case where the safe answer is to do nothing.
+ */
+const DAEMON_OWNERSHIPS = ['detached', 'embedded', 'unknown'] as const;
+export type DaemonOwnership = (typeof DAEMON_OWNERSHIPS)[number];
+
+/**
+ * The ownership a process can state about *itself*: `unknown` is what a reader answers for a record it
+ * cannot place, never what a runtime knows about its own process. So a runtime starts as detached or
+ * embedded, and the refusal for a record this build cannot read belongs to the code that reads the
+ * record — see {@link readDaemonOwnership}.
+ */
+export type DaemonRuntimeOwnership = Exclude<DaemonOwnership, 'unknown'>;
+
+/**
+ * The lifetime a lifecycle path has proved the daemon on a state directory is, together with the owner
+ * its record stated at that read. Ownership travels inside the observation because a pid only says what
+ * is safe to end once its owner is known, and two reads of `daemon.json` can name different pairs.
+ */
+export type ObservedDaemonIdentity = OwnerIdentity & {
+  ownership: DaemonOwnership;
+};
+
+/**
+ * The ownership a `daemon.json` field records. An absent field is the pre-existing detached daemon —
+ * every record written before #3757 states no owner and describes a daemon that is its own process.
+ * A field that states something else is `unknown`, and is never folded into `detached`: the two read
+ * the same way to a caller that is about to signal a pid, and only one of them is safe to act on.
+ */
+export function readDaemonOwnership(value: unknown): DaemonOwnership {
+  return DAEMON_OWNERSHIPS.includes(value as DaemonOwnership)
+    ? (value as DaemonOwnership)
+    : value === undefined
+      ? 'detached'
+      : 'unknown';
+}
+
+/** The command carrying the fenced lifecycle request. */
+export const DAEMON_LIFECYCLE_COMMANDS = {
+  /** Stop if idle: refuses while the daemon holds a request, a session, or a lease. */
+  quiesce: 'daemon_quiesce',
+} as const;
+export type DaemonLifecycleMode = keyof typeof DAEMON_LIFECYCLE_COMMANDS;
+
+/**
+ * The lifecycle mode `command` names, or `undefined` for every request that is not one. Compared
+ * explicitly, because a lookup in an object would answer for a command like `toString` too.
+ */
+export function readDaemonLifecycleMode(command: string): DaemonLifecycleMode | undefined {
+  switch (command) {
+    case DAEMON_LIFECYCLE_COMMANDS.quiesce:
+      return 'quiesce';
+    default:
+      return undefined;
+  }
+}
 
 /** The reason a daemon gives every request it refuses once it has begun to leave. */
 export const DAEMON_SHUTTING_DOWN_REASON = 'daemon_shutting_down';
 
-export const DAEMON_QUIESCE_REASONS = {
+/** Why a daemon refuses a lifecycle request: one entry per rule the admission seam enforces. */
+export const DAEMON_LIFECYCLE_REASONS = {
+  /** A quiesce found the daemon holding work, so nothing was accepted. */
   busy: 'daemon-busy',
+  /** The request names a different daemon instance than the one answering it. */
   instanceMismatch: 'daemon-instance-mismatch',
+  /** A quiesce was refused because a host owns this runtime and ends it through its own close. */
+  ownerEmbedded: 'daemon-owner-embedded',
 } as const;
 
-/** The daemon instance a quiesce request is addressed to; any other instance refuses it. */
-
```

**File**: `packages/daemon-contracts/src/daemon-stop.test.ts` (modified, +38/-21)
```diff
@@ -7,7 +7,7 @@ vi.mock('./daemon-registration-owner.ts', () => ({
   stopAndRetireDaemon: mocks.stopAndRetireDaemon,
 }));
 
-import { resolveDaemonPaths } from './daemon-resolution.ts';
+import { resolveDaemonPaths, type ObservedDaemonIdentity } from './daemon-resolution.ts';
 import { stopDaemon } from './daemon-stop.ts';
 
 afterEach(() => {
@@ -18,35 +18,45 @@ function createDaemonPaths(): ReturnType<typeof resolveDaemonPaths> {
   const stateDir = mkdtempForTestSync('agent-device-daemon-stop-');
   const paths = resolveDaemonPaths(stateDir);
   fs.mkdirSync(paths.baseDir, { recursive: true });
+  // The record's contents are the caller's business: a stop hands over the lifetime and owner its own
+  // read proved, so this fixture only has to put a record on disk for a retirement to act on.
   fs.writeFileSync(paths.infoPath, JSON.stringify({ pid: 123, processStartTime: 'start-time' }));
   return paths;
 }
 
+/** The lifetime the record above names, which is what a caller hands to the retirement it routes. */
+const observed: ObservedDaemonIdentity = {
+  pid: 123,
+  startTime: 'start-time',
+  ownership: 'detached',
+};
+
 function removeDaemonPaths(paths: ReturnType<typeof resolveDaemonPaths>): void {
   fs.rmSync(paths.baseDir, { recursive: true, force: true });
 }
 
-test('reports not-running when daemon metadata is absent', async () => {
+test('a caller that read no lifetime reports not-running without retiring', async () => {
   const paths = resolveDaemonPaths(mkdtempForTestSync('agent-device-daemon-stop-'));
 
   try {
-    const result = await stopDaemon({ paths });
+    const result = await stopDaemon({ paths, observed: null });
     expect(result).toMatchObject({ stopped: false, mode: 'not-running' });
   } finally {
     removeDaemonPaths(paths);
   }
+  expect(mocks.stopAndRetireDaemon).not.toHaveBeenCalled();
 });
 
 test('retained identity verification is reported as failure without known cleanup', async () => {
   const paths = createDaemonPaths();
   mocks.stopAndRetireDaemon.mockResolvedValue(retainedExit('identity-unverified'));
-  await expect(stopDaemon({ paths })).rejects.toMatchObject({
+  await expect(stopDaemon({ paths, observed })).rejects.toMatchObject({
     code: 'COMMAND_FAILED',
     details: { reason: 'daemon_exit_unconfirmed', terminationReason: 'identity-unverified' },
   });
   expect(mocks.stopAndRetireDaemon).toHaveBeenCalledWith({
     paths,
-    observed: { pid: 123, startTime: 'start-time' },
+    observed,
     mode: 'graceful',
     termTimeoutMs: 10_000,
     killTimeoutMs: 2_000,
@@ -55,34 +65,39 @@ test('retained identity verification is reported as failure without known cleanu
 
 test('missing start-time identity is passed to the owning termination operation', async () => {
   const paths = createDaemonPaths();
-  fs.writeFileSync(paths.infoPath, JSON.stringify({ pid: 123, processStartTime: ' ' }));
   mocks.stopAndRetireDaemon.mockResolvedValue(retainedExit('missing-start-time'));
-  await expect(stopDaemon({ paths })).rejects.toMatchObject({
+  await expect(
+    stopDaemon({ paths, observed: { pid: 123, startTime: null, ownership: 'detached' } }),
+  ).rejects.toMatchObject({
     details: { terminationReason: 'missing-start-time' },
   });
   expect(mocks.stopAndRetireDaemon).toHaveBeenCalledWith(
-    expect.objectContaining({ paths, observed: { pid: 123, startTime: null } }),
+    expect.objectContaining({
+      paths,
+      observed: { pid: 123, startTime: null, ownership: 'detached' },
+    }),
   );
 });
 
 test('a previously exited verified lifetime is reported as not-running', async () => {
   mocks.stopAndRetireDaemon.mockResolvedValue(retired('already-exited'));
-  expect(await stopDaemon({ paths: createDaemonPaths() })).toMatchObject({
+  expect(await stopDaemon({ paths: createDaemonPaths(), observed })).toMatchObject({
     stopped: false,
     mode: 'not-running',
   });
 });
 
 test('an already released pid without start time remains not-running without cleanup proof', async () => {
   const paths = createDaemonPaths();
-  fs.writeFileSync(paths.infoPath, JSON.stringify({ pid: 123 }));
   mocks.stopAndRetireDaemon.mockResolvedValue({
     status: 'retained',
     reason: 'exit-unconfirmed',
     removedInfo: false,
     termination: { status: 'not-running' },
   });
-  expect(await stopDaemon({ paths })).toMatchObject({
+  expect(
+    await stopDaemon({ paths, observed: { pid: 123, startTime: null, ownership: 'detached' } }),
+  ).toMatchObject({
     stopped: false,
     mode: 'not-running',
   });
@@ -91,15 +106,17 @@ test('an already released pid without start time remains not-running without cle
 test('confirmed TERM exit preserves graceful report behavior and configured budgets', async () => {
   const paths = createDaemonPaths();
   mocks.stopAndRetireDaemon.mockResolvedValue(retired('graceful'));
-  expect(await stopDaemon({ paths, graceTimeoutMs: 11, killTimeoutMs: 7 })).toMatchObject({
-    stopped: true,
-    mode: 'graceful
```

**File**: `packages/daemon-contracts/src/daemon-stop.ts` (modified, +148/-30)
```diff
@@ -1,10 +1,18 @@
 import { AppError } from '@agent-device/kernel/errors';
 import type { DaemonRetirementResult } from './daemon-registration-owner.ts';
-import type { OwnerIdentity } from '@agent-device/host-kit/process';
 
-import type { DaemonPaths } from './daemon-resolution.ts';
-import { readRegisteredDaemonIdentity } from './daemon-registration.ts';
-import type { DeviceClaimRecord, ProviderReleaseRecord } from './daemon-shutdown-report.ts';
+import {
+  DAEMON_LIFECYCLE_REASONS,
+  DAEMON_RECORD_OWNER_UNRECOGNIZED_REASON,
+  type DaemonPaths,
+  type ObservedDaemonIdentity,
+} from './daemon-resolution.ts';
+import type { OwnerIdentity } from '@agent-device/host-kit/process';
+import type {
+  DaemonShutdownReport,
+  DeviceClaimRecord,
+  ProviderReleaseRecord,
+} from './daemon-shutdown-report.ts';
 
 const DAEMON_STOP_GRACE_TIMEOUT_MS = 10_000;
 const DAEMON_STOP_KILL_TIMEOUT_MS = 2_000;
@@ -36,25 +44,34 @@ export type DaemonStopResult = {
   warnings: string[];
 };
 
+/**
+ * Retires the daemon whose lifetime the caller read, and shapes that retirement as a stop result.
+ *
+ * The caller hands over the lifetime and the owner its own read proved, so routing and retirement judge
+ * one record. Ownership is judged here and nowhere else: an embedded runtime belongs to its host, and a
+ * record this build cannot place proves nothing about what is safe to signal, so both come back as the
+ * refusal that names their owner, with nothing signaled.
+ */
 export async function stopDaemon(params: {
   paths: DaemonPaths;
+  observed: ObservedDaemonIdentity | null;
   graceTimeoutMs?: number;
   killTimeoutMs?: number;
 }): Promise<DaemonStopResult> {
-  const info = readRegisteredDaemonIdentity(params.paths.infoPath);
-  if (!info) return notRunningResult();
+  const observed = params.observed;
+  if (!observed) return daemonNotRunningStopResult();
   const { stopAndRetireDaemon } = await import('./daemon-registration-owner.ts');
   const retirement = await stopAndRetireDaemon({
     paths: params.paths,
-    observed: info,
+    observed,
     mode: 'graceful',
     termTimeoutMs: params.graceTimeoutMs ?? DAEMON_STOP_GRACE_TIMEOUT_MS,
     killTimeoutMs: params.killTimeoutMs ?? DAEMON_STOP_KILL_TIMEOUT_MS,
   });
   if (retirement.status === 'retained' && retirement.termination?.status === 'not-running')
-    return notRunningResult();
-  if (retirement.status !== 'retired') throw daemonRetirementError(info, retirement);
-  if (retirement.termination.mode === 'already-exited') return notRunningResult();
+    return daemonNotRunningStopResult();
+  if (retirement.status !== 'retired') throw daemonRetirementError(observed, retirement);
+  if (retirement.termination.mode === 'already-exited') return daemonNotRunningStopResult();
   if (retirement.termination.mode === 'graceful') {
     return {
       stopped: true,
@@ -84,6 +101,25 @@ export async function stopDaemon(params: {
   };
 }
 
+/**
+ * What a retirement that refused because of the record's owner answers with. This is the one place
+ * those two retained reasons become a stop's own reason: a caller that may not signal this process
+ * hears the owner's rule, not a retirement that could not be confirmed.
+ */
+function ownerRefusal(
+  reason: 'embedded-owner' | 'owner-unproven',
+): Readonly<{ reason: string; hint: string }> {
+  return reason === 'embedded-owner'
+    ? {
+        reason: DAEMON_LIFECYCLE_REASONS.ownerEmbedded,
+        hint: 'Nothing was signaled. Close the host that started this runtime, or repair its record after the process has exited.',
+      }
+    : {
+        reason: DAEMON_RECORD_OWNER_UNRECOGNIZED_REASON,
+        hint: 'Nothing was signaled. Check what owns that process, then repair the record: stop it by its own means and remove its daemon.json so a daemon can register again.',
+      };
+}
+
 function daemonRetirementError(
   info: OwnerIdentity,
   retirement: Exclude<DaemonRetirementResult, { status: 'retired' }>,
@@ -92,28 +128,32 @@ function daemonRetirementError(
   const failure = termination?.status === 'retained' ? termination : undefined;
   const error = retirement.status === 'retained' ? retirement.error : undefined;
   const { hint, diagnosticId, logPath } = error ?? {};
-  return new AppError('COMMAND_FAILED', 'Daemon retirement could not be confirmed.', {
-    pid: info.pid,
-    processStartTime: info.startTime,
-    reason: failure ? 'daemon_exit_unconfirmed' : 'daemon_retirement_unconfirmed',
-    terminationReason: failure?.reason,
-    signal: failure?.signal,
-    retirement,
-    hint,
-    diagnosticId,
-    logPath,
-  });
+  const refusal =
+    retirement.status === 'retained' &&
+    (retirement.reason === 'embedded-owner' || retirement.reason === 'owner-unproven')
+      ? ownerRefusal(retirement.reason)
+      : undefined;
+  return new AppError(
+    'COMMAND_FAILED',
+    refusal
+      ? 'The daemon was not stopped, because its owner ends it.'
+      : 'Daemon retirement could not
```

---

### Incident Patch 2: `620228b8` (2026-10-20)
**Commit Message**: fix(apple): key the toolchain fingerprint memo on the resolved xcode-select dir (#3726)

* fix(apple): key the toolchain fingerprint memo on the resolved xcode-select dir

`toolchainFingerprintCacheKey` keyed the memo on `DEVELOPER_DIR` alone, so every default
`xcode-select` selection shared one entry. A daemon that answered a cache decision before
someone ran `sudo xcode-select -s` kept answering with the Xcode the host had left, and
because every hit re-set the entry, a busy daemon served it indefinitely rather than for one
TTL (#3300).

- Resolve the default selection per read and key on it, keeping a client's `DEVELOPER_DIR`
  choice as before.
- Run that resolution under the probe clock and cancellation, capped below the probes it
  precedes. A read that cannot resolve its selection skips the memo: a key shared by every
  unresolved selection would let one host selection answer for the next.
- Measure the TTL from the read that stored an entry; a hit no longer extends it.
- Keep the report path probe-free by looking entries up under the dir the read that stored
  one resolved.

Related: #3449, whose Xcode-too-old reports should name the toolchain a decision actually read.

* f

**File**: `packages/platform-apple/src/runner/__tests__/apple-toolchain-fixtures.ts` (modified, +95/-5)
```diff
@@ -1,6 +1,9 @@
 import { beforeEach, vi } from 'vitest';
+import fs from 'node:fs';
+import { AppError } from '@agent-device/kernel/errors';
 import { appleRunnerTestHost } from '../test-host.ts';
-import type { ExecResult } from '@agent-device/host-kit/command';
+import { XCODE_SELECT_LINK_PATH } from '../apple-runner-platform.ts';
+import type { ExecOptions, ExecResult } from '@agent-device/host-kit/command';
 
 export const STUBBED_APPLE_TOOLCHAIN = {
   xcodeVersion: '26.2',
@@ -9,7 +12,16 @@ export const STUBBED_APPLE_TOOLCHAIN = {
   sdkBuildVersion: '23C53',
 } as const;
 
+const STUBBED_SELECTED_DEVELOPER_DIR = '/Applications/Xcode-Stub.app/Contents/Developer';
+
+export function selectedDeveloperDirResult(developerDir: string): ExecResult {
+  return { exitCode: 0, stdout: `${developerDir}\n`, stderr: '' };
+}
+
 export function appleToolchainProbeResult(command: string, args: readonly string[]): ExecResult {
+  if (command === 'xcode-select' && args[0] === '-p') {
+    return selectedDeveloperDirResult(STUBBED_SELECTED_DEVELOPER_DIR);
+  }
   if (command === 'xcodebuild' && args[0] === '-version') {
     return {
       exitCode: 0,
@@ -27,15 +39,93 @@ export function appleToolchainProbeResult(command: string, args: readonly string
 }
 
 /**
- * Answers the runner cache's toolchain probes from a fixed toolchain, so cases
- * that key the cache neither read the host's Xcode nor depend on one existing.
- * Returns the mock so a case can make a probe fail.
+ * Answers the runner cache's toolchain probes from a fixed toolchain, so cases that key the cache
+ * neither read the host's Xcode nor depend on one existing. No client chooses a `DEVELOPER_DIR`, so
+ * the selection a key probe resolves is the one the case scripts. Returns the mock so a case can
+ * make a probe fail.
  */
 export function stubAppleToolchainProbes(): ReturnType<typeof vi.fn> {
+  stubAppleSelectionLink();
   const runCmdSync = vi.fn(appleToolchainProbeResult);
   beforeEach(() => {
     runCmdSync.mockImplementation(appleToolchainProbeResult);
-    appleRunnerTestHost.update({ runCmdSync });
+    appleRunnerTestHost.update({
+      runCmdSync,
+      commandDeveloperDir: () => undefined,
+    });
   });
   return runCmdSync;
 }
+
+/**
+ * The host's default selection link as the Apple toolchain probes see it. Undefined keeps the link
+ * unreadable, which sends every read down the `xcode-select -p` fallback a case already scripts; a
+ * case that owns a link points it at a path it created.
+ */
+export const appleSelectionLink: { target: string | undefined } = { target: undefined };
+
+/**
+ * Hides the selection link of the machine running the suite, so a case decides the host's selection
+ * rather than inheriting it. The real host has one, and where it points is not this suite's business.
+ */
+export function stubAppleSelectionLink(): void {
+  const realRealpathSync = fs.realpathSync;
+  beforeEach(() => {
+    appleSelectionLink.target = undefined;
+    vi.spyOn(fs, 'realpathSync').mockImplementation((target: fs.PathLike) => {
+      if (String(target) !== XCODE_SELECT_LINK_PATH) return realRealpathSync(target);
+      if (appleSelectionLink.target === undefined) {
+        throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
+      }
+      return realRealpathSync(appleSelectionLink.target);
+    });
+  });
+}
+
+/**
+ * The fingerprint budget's clock, advanced only by an exec that blocks for the whole timeout it was
+ * handed. Without it a mock that throws immediately proves nothing about a deadline: no time passes,
+ * so every budget looks untouched however many attempts run.
+ */
+export function installToolchainProbeClock(): { nowMs: number } {
+  const clock = { nowMs: 0 };
+  appleRunnerTestHost.update({
+    deadlineFromTimeoutMs: (timeoutMs: number) => {
+      const startedAtMs = clock.nowMs;
+      const expiresAtMs = startedAtMs + Math.max(0, timeoutMs);
+      return {
+        remainingMs: () => Math.max(0, expiresAtMs - clock.nowMs),
+        elapsedMs: () => Math.max(0, clock.nowMs - startedAtMs),
+        isExpired: () => expiresAtMs - clock.nowMs <= 0,
+      };
+    },
+  });
+  return clock;
+}
+
+/** An exec that blocked for its whole timeout and was then killed, as the exec layer reports it. */
+export function blockForWholeTimeout(
+  clock: { nowMs: number },
+  command: string,
+  args: readonly string[],
+  options: ExecOptions,
+): AppError {
+  const timeoutMs = options.timeoutMs ?? 0;
+  clock.nowMs += timeoutMs;
+  return new AppError('COMMAND_FAILED', `${command} timed out after ${timeoutMs}ms`, {
+    cmd: command,
+    args,
+    timeoutMs,
+  });
+}
+
+/**
+ * The execs that read the toolchain itself, as opposed to the `xcode-select -p` a read runs to
+ * decide which fingerprint entry it belongs to. A case that says a cache hit must not re-read the
+ * toolchain says nothing about that one exec, so it asserts through this.
+ */
+export function valu
```

**File**: `packages/platform-apple/src/runner/__tests__/runner-cache-metadata.test.ts` (modified, +58/-60)
```diff
@@ -23,8 +23,12 @@ import { memoizedRunnerXcodeVersion } from '../runner-toolchain-probe.ts';
 import { COLD_TOOLCHAIN_PROBE_TIMEOUT_MS } from '../apple-runner-platform.ts';
 import {
   appleToolchainProbeResult,
+  blockForWholeTimeout,
+  installToolchainProbeClock,
+  selectedDeveloperDirResult,
   STUBBED_APPLE_TOOLCHAIN,
   stubAppleToolchainProbes,
+  valueProbeCommands,
 } from './apple-toolchain-fixtures.ts';
 import { mkdtempForTestSync } from './tmp-dir.ts';
 import { xcodebuildLogWithBuildArguments } from './runner-build-log.fixtures.ts';
@@ -272,7 +276,7 @@ describe('toolchain probe budget', () => {
   beforeEach(resetAllProcessMemosForTests);
 
   test('a cold-start probe recovers on retry, and the stall it survived is charged to the budget', () => {
-    const clock = installFakeToolchainClock();
+    const clock = installToolchainProbeClock();
     const xcodebuildTimeouts: number[] = [];
     runCmdSync.mockImplementation((command: string, args: string[], options: ExecOptions) => {
       if (command !== 'xcodebuild') return appleToolchainProbeResult(command, args);
@@ -292,9 +296,10 @@ describe('toolchain probe budget', () => {
   });
 
   test('an owning phase with 4 s left gets one 4 s attempt and no retry', () => {
-    const clock = installFakeToolchainClock();
+    const clock = installToolchainProbeClock();
     const phaseBudget = createRunnerPhaseBudget(4_000, undefined);
     runCmdSync.mockImplementation((command: string, args: string[], options: ExecOptions) => {
+      if (command === 'xcode-select') return appleToolchainProbeResult(command, args);
       throw blockForWholeTimeout(clock, command, args, options);
     });
     runCmdSync.mockClear();
@@ -303,14 +308,14 @@ describe('toolchain probe budget', () => {
       () => resolveExpectedRunnerCacheMetadata(IOS_SIMULATOR, undefined, phaseBudget),
       (error: unknown) => expectRunnerPhaseBudgetExhausted(error),
     );
-    assert.equal(runCmdSync.mock.calls.length, 1);
+    assert.equal(valueProbeCommands(runCmdSync.mock.calls).length, 1);
     // The one attempt was capped by the phase, not by the 30 s per-call ceiling.
-    assert.equal(runCmdSync.mock.calls[0]?.[2]?.timeoutMs, 4_000);
+    assert.equal(runCmdSync.mock.calls.at(-1)?.[2]?.timeoutMs, 4_000);
     assert.equal(clock.nowMs, 4_000);
   });
 
   test('a probe that failed on its own and merely says "timed out" in its message is not retried', () => {
-    installFakeToolchainClock();
+    installToolchainProbeClock();
     runCmdSync.mockImplementation((command: string, args: string[]) => {
       if (command !== 'xcodebuild') return appleToolchainProbeResult(command, args);
       // No `timeoutMs` detail: this is the tool reporting its own failure, not
@@ -439,7 +444,7 @@ describe('toolchain probe budget', () => {
   ];
 
   test.each(CANCELLATION_CASES)('cancellation matrix: $label', (testCase) => {
-    const clock = installFakeToolchainClock();
+    const clock = installToolchainProbeClock();
     const request = new AbortController();
     if (testCase.fingerprintCache === 'warm') {
       runCmdSync.mockImplementation(appleToolchainProbeResult);
@@ -449,6 +454,9 @@ describe('toolchain probe budget', () => {
 
     let execs = 0;
     runCmdSync.mockImplementation((command: string, args: string[], options: ExecOptions) => {
+      // The cache-key resolution picks which entry the read belongs to; it is never one of the
+      // three probes this matrix interrupts.
+      if (command === 'xcode-select') return appleToolchainProbeResult(command, args);
       execs += 1;
       if (!failsOnExec(testCase, execs)) return appleToolchainProbeResult(command, args);
       if (testCase.aborts === 'while-it-blocks') request.abort();
@@ -513,44 +521,6 @@ function expectRunnerPhaseBudgetExhausted(error: unknown): boolean {
   return true;
 }
 
-/**
- * A clock the probes' own budget reads, advanced only by
- * {@link blockForWholeTimeout}. Without it a mock that throws immediately
- * proves nothing about a deadline: no time passes, so every budget looks
- * untouched however many attempts run.
- */
-function installFakeToolchainClock(): { nowMs: number } {
-  const clock = { nowMs: 0 };
-  appleRunnerTestHost.update({
-    deadlineFromTimeoutMs: (timeoutMs: number) => {
-      const startedAtMs = clock.nowMs;
-      const expiresAtMs = startedAtMs + Math.max(0, timeoutMs);
-      return {
-        remainingMs: () => Math.max(0, expiresAtMs - clock.nowMs),
-        elapsedMs: () => Math.max(0, clock.nowMs - startedAtMs),
-        isExpired: () => expiresAtMs - clock.nowMs <= 0,
-      };
-    },
-  });
-  return clock;
-}
-
-/** A probe that blocked for its whole timeout and was then killed, as the exec layer reports it. */
-function blockForWholeTimeout(
-  clock: { nowMs: number },
-  command: string,
-  args: string[],
-  options: ExecOptions,
-): AppError {
-  const timeoutMs = options.timeoutMs ?? 0;
-  clock.nowMs += timeoutMs;
-  return new AppError('COMMAN
```

**File**: `packages/platform-apple/src/runner/__tests__/runner-toolchain-probe.test.ts` (added, +612/-0)
```diff
@@ -0,0 +1,612 @@
+import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
+import assert from 'node:assert/strict';
+import fs from 'node:fs';
+import path from 'node:path';
+import { isRequestCanceledError } from '@agent-device/kernel/errors';
+import { resetAllProcessMemosForTests } from '@agent-device/kernel/ttl-memo';
+import type { ExecOptions, ExecResult } from '@agent-device/host-kit/command';
+import { IOS_SIMULATOR } from './device-fixtures.ts';
+import { appleRunnerTestHost } from '../test-host.ts';
+import {
+  appleToolchainProbeResult,
+  appleSelectionLink,
+  blockForWholeTimeout,
+  installToolchainProbeClock,
+  selectedDeveloperDirResult,
+  STUBBED_APPLE_TOOLCHAIN,
+  stubAppleSelectionLink,
+  valueProbeCommands,
+} from './apple-toolchain-fixtures.ts';
+import {
+  memoizedRunnerXcodeVersion,
+  requireRunnerToolchainFingerprint,
+} from '../runner-toolchain-probe.ts';
+import { createRunnerPhaseBudget, type RunnerPhaseBudget } from '../runner-phase-budget.ts';
+import { mkdtempForTestSync } from './tmp-dir.ts';
+import { COLD_TOOLCHAIN_PROBE_TIMEOUT_MS } from '../apple-runner-platform.ts';
+
+// The fingerprint memo is process-wide and the selection it keys on is host state, so these cases
+// script both: `xcode-select -p` answers `selectedDeveloperDir`, and `xcodebuild` names the Xcode
+// belonging to that selection.
+const XCODE_A = '/Applications/Xcode-A.app/Contents/Developer';
+const XCODE_B = '/Applications/Xcode-B.app/Contents/Developer';
+const IPHONESIMULATOR_SDK = 'iphonesimulator';
+const XCODE_B_BUILD_VERSION = '18A100';
+const FINGERPRINT_TTL_MS = 10 * 60_000;
+/** The ceiling one `xcode-select -p` attempt gets, below the 30 s a value probe gets. */
+const XCODE_SELECT_TIMEOUT_MS = 2_000;
+
+const runCmdSync = vi.fn();
+let selectedDeveloperDir = XCODE_A;
+let nowMs = 1_700_000_000_000;
+
+stubAppleSelectionLink();
+
+/** A scratch root the case's fake developer dirs and selection links live under. */
+let tempRoot: string;
+
+beforeEach(() => {
+  resetAllProcessMemosForTests();
+  selectedDeveloperDir = XCODE_A;
+  tempRoot = mkdtempForTestSync('runner-selection-');
+  runCmdSync.mockReset().mockImplementation(appleToolchainProbeResult);
+  appleRunnerTestHost.update({
+    runCmdSync,
+    commandDeveloperDir: () => undefined,
+  });
+  vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
+});
+
+afterEach(() => {
+  vi.restoreAllMocks();
+});
+
+/**
+ * A developer dir the host can resolve, standing in for an installed Xcode at `dir`. Cases below
+ * compare keys through the memo, and a dir that does not exist cannot be resolved to its real path,
+ * so its key would fall back to the name rather than the resolved dir the case means.
+ */
+function realSelectionDir(dir: string): string {
+  const created = path.join(tempRoot, dir);
+  fs.mkdirSync(created, { recursive: true });
+  fs.writeFileSync(path.join(created, '..', 'version.plist'), '<plist>build 1</plist>\n');
+  return created;
+}
+
+/** Two Xcodes and the `sudo xcode-select -s` that moves the host's default selection between them. */
+function scriptSelectableXcodes(): void {
+  runCmdSync.mockImplementation((command: string, args: readonly string[]) =>
+    command === 'xcode-select'
+      ? selectedDeveloperDirResult(selectedDeveloperDir)
+      : command === 'xcodebuild' && selectedDeveloperDir === XCODE_B
+        ? {
+            exitCode: 0,
+            stdout: `Xcode 27.0\nBuild version ${XCODE_B_BUILD_VERSION}\n`,
+            stderr: '',
+          }
+        : appleToolchainProbeResult(command, args),
+  );
+}
+
+function readFingerprint(
+  budget?: RunnerPhaseBudget,
+): ReturnType<typeof requireRunnerToolchainFingerprint> {
+  return requireRunnerToolchainFingerprint(IPHONESIMULATOR_SDK, budget);
+}
+
+function attemptedTimeoutMs(command: string): number | undefined {
+  const call = runCmdSync.mock.calls.find(([executed]) => executed === command);
+  return (call?.[2] as ExecOptions | undefined)?.timeoutMs;
+}
+
+function blockResolutionForWholeTimeout(clock: { nowMs: number }): void {
+  runCmdSync.mockImplementation((command: string, args: string[], options: ExecOptions) => {
+    if (command !== 'xcode-select') return appleToolchainProbeResult(command, args);
+    throw blockForWholeTimeout(clock, command, args, options);
+  });
+}
+
+describe('the developer dir a toolchain fingerprint answers for', () => {
+  test('a default selection that moved re-reads instead of answering the Xcode it replaced', () => {
+    scriptSelectableXcodes();
+    expect(readFingerprint().xcodeBuildVersion).toBe(STUBBED_APPLE_TOOLCHAIN.xcodeBuildVersion);
+
+    selectedDeveloperDir = XCODE_B;
+    runCmdSync.mockClear();
+    expect(readFingerprint().xcodeBuildVersion).toBe(XCODE_B_BUILD_VERSION);
+
+    // The switch costs one resolution and one full re-read. The entry keyed on the old dir cannot
+    // answer for the new one, which is what let a daemon serve the Xcode the host had lef
```

**File**: `packages/platform-apple/src/runner/apple-runner-platform.ts` (modified, +8/-0)
```diff
@@ -21,6 +21,14 @@ import { readHostCpuArchSync } from './host.ts';
  */
 export const COLD_TOOLCHAIN_PROBE_TIMEOUT_MS = 30_000;
 
+/**
+ * The symlink `xcode-select -s` writes and `xcode-select -p` reads back. Resolving it answers which
+ * developer dir the host selects, without a subprocess, so the toolchain memo can key on that answer
+ * on a hit as well as on a miss. Beside the probe ceiling above so the constant sits with the
+ * toolchain constants this package shares rather than inside the one module that reads it.
+ */
+export const XCODE_SELECT_LINK_PATH = '/var/db/xcode_select_link';
+
 export type RunnerApplePlatformName = 'iOS' | 'tvOS' | 'macOS' | 'visionOS';
 
 type RunnerPlatformDeviceKind = 'simulator' | 'device';
```

**File**: `packages/platform-apple/src/runner/runner-toolchain-probe.ts` (modified, +207/-19)
```diff
@@ -12,8 +12,11 @@ import {
   isCommandTimeoutError,
   runCmdSync,
 } from './host.ts';
+import fs from 'node:fs';
+import path from 'node:path';
 import {
   COLD_TOOLCHAIN_PROBE_TIMEOUT_MS,
+  XCODE_SELECT_LINK_PATH,
   resolveRunnerPlatformName,
   resolveRunnerSdkName,
 } from './apple-runner-platform.ts';
@@ -24,11 +27,23 @@ import {
 } from './runner-phase-budget.ts';
 
 /**
- * Ceiling on the wall clock the whole toolchain fingerprint may spend, across all three
- * probes and their retries, when the owning phase carries no shorter budget: one stalled
- * probe, its warm retry, and the two probes still to run (#2422).
+ * Ceiling on the wall clock the whole toolchain fingerprint may spend, across the cache-key probe,
+ * the three value probes, and their retries, when the owning phase carries no shorter budget: one
+ * stalled probe, its warm retry, and the two probes still to run (#2422). The cache-key probe takes
+ * at most {@link XCODE_SELECT_PROBE_TIMEOUT_MS} of it and half of what the phase has left, so a
+ * stalled `xcode-select` costs a value probe that headroom and nothing more.
  */
 const TOOLCHAIN_FINGERPRINT_BUDGET_MS = 45_000;
+
+/**
+ * Ceiling on one `xcode-select -p` attempt, which the cache key needs only when the host's selection
+ * link cannot be read. `xcode-select -p` answers in tens of milliseconds, so this is headroom rather
+ * than an expected cost, and it stays small enough that a stalled probe cannot take the cold-start
+ * ceiling away from the value probes whose entry it is deciding. A selection this process cannot
+ * resolve leaves the read with no dir to key on.
+ */
+const XCODE_SELECT_PROBE_TIMEOUT_MS = 2_000;
+
 const TOOLCHAIN_PROBE_MAX_BUFFER = 128 * 1024;
 const TOOLCHAIN_PROBE_DETAIL_MAX_LENGTH = 200;
 const TOOLCHAIN_PROBE_HINT =
@@ -55,15 +70,22 @@ type ProbeResult<Value> =
 
 /**
  * The remaining-time and cancellation view the probes consult: one per fingerprint read,
- * so the three probes and their retries share a single budget. A phase with no deadline
- * still gets {@link TOOLCHAIN_FINGERPRINT_BUDGET_MS} as the ceiling.
+ * so the cache-key probe, the three value probes, and their retries share a single budget.
+ * A phase with no deadline still gets {@link TOOLCHAIN_FINGERPRINT_BUDGET_MS} as the ceiling.
  *
  * `spawnSync` cannot be interrupted once it has started, so cancellation is observed
  * between attempts; the per-attempt cap is what bounds how long that takes.
  */
 type ToolchainProbeClock = {
   /** Milliseconds the next attempt may block for; 0 once the budget is spent. */
   attemptTimeoutMs(): number;
+  /**
+   * Milliseconds the cache-key probe may block for. Deciding which entry to read is optional
+   * work that precedes the read which answers for it, so it may spend neither more than
+   * {@link XCODE_SELECT_PROBE_TIMEOUT_MS} nor more than half of what that read still needs.
+   * Zero once the budget is spent, which skips the optional probe entirely.
+   */
+  keyProbeTimeoutMs(): number;
   /** Throws the owning request's cancellation error once it has aborted. */
   throwIfCanceled(): void;
 };
@@ -79,6 +101,8 @@ function createToolchainProbeClock(budget: RunnerPhaseBudget | undefined): Toolc
   return {
     attemptTimeoutMs: () =>
       Math.min(COLD_TOOLCHAIN_PROBE_TIMEOUT_MS, Math.floor(deadline.remainingMs())),
+    keyProbeTimeoutMs: () =>
+      Math.min(XCODE_SELECT_PROBE_TIMEOUT_MS, Math.floor(deadline.remainingMs() / 2)),
     throwIfCanceled: () => {
       if (budget?.signal?.aborted) {
         throw createRequestCanceledError({ phase: 'apple_toolchain_probe' });
@@ -90,11 +114,13 @@ function createToolchainProbeClock(budget: RunnerPhaseBudget | undefined): Toolc
 // Lazy: createTtlMemo is a host capability, and module evaluation happens
 // before the composition root binds the host. Only a complete, parsed
 // fingerprint is ever memoized, so nothing unavailable can outlive the probe
-// that could not answer. The key carries a client-chosen DEVELOPER_DIR, so an
-// entry expires once no request has used it for TOOLCHAIN_FINGERPRINT_TTL_MS:
-// a dir no client uses any more must not stay for the daemon's lifetime. A hit
-// renews the entry, so a failure report can name the Xcode a decision read for
-// at least TOOLCHAIN_FINGERPRINT_TTL_MS after that read (the default start budget).
+// that could not answer. The key carries the developer dir the read answers for
+// and the identity of the bundle standing in it, so an entry is stale only until
+// its own key stops describing the host's selection, which is what let a daemon
+// serve the Xcode a host had left (#3300). A hit therefore renews the entry, as
+// it did before: an idle entry still goes away after
+// TOOLCHAIN_FINGERPRINT_TTL_MS, which also bounds how long a failure report
+// can name a selection no request is using any more.
 const TOOLCHAIN_FINGERPRINT_TTL_MS = 10 * 60_000;
 let lazyToolchainFingerprintCache: TtlMemo<string, RunnerToolchai
```

---

### Incident Patch 3: `f217bd67` (2026-10-20)
**Commit Message**: fix(macos-helper): set audio probe frameLength before PCM copy (#3821)

AVAudioPCMBuffer starts with frameLength 0, so mDataByteSize stays 0
and CMSampleBufferCopyPCMDataIntoAudioBufferList returns -12731. Set
frameLength first, then copy. Add a regression that feeds a real float
PCM sample buffer through add(sampleBuffer:) and asserts a non-silent
peak.

Fixes #3771

Co-authored-by: Michał Pierzchała <[REDACTED_EMAIL]>

**File**: `apple/macos-helper/Sources/AgentDeviceMacOSHelper/AudioProbe.swift` (modified, +4/-2)
```diff
@@ -31,7 +31,7 @@ private struct AudioProbeBucket {
   var peak: Double = 0
 }
 
-private final class AudioProbeStatusWriter {
+final class AudioProbeStatusWriter {
   private let outPath: String
   private let startedAt = Date()
   private let durationMs: Int
@@ -61,6 +61,9 @@ private final class AudioProbeStatusWriter {
     else {
       return
     }
+    // AVAudioPCMBuffer starts with frameLength 0, so every mDataByteSize is 0 until
+    // frameLength is set. Copying first leaves the destination empty (-12731).
+    pcmBuffer.frameLength = frameCount
     let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(
       sampleBuffer,
       at: 0,
@@ -70,7 +73,6 @@ private final class AudioProbeStatusWriter {
     guard status == noErr else {
       return
     }
-    pcmBuffer.frameLength = frameCount
     add(audioBufferList: pcmBuffer.mutableAudioBufferList, format: format)
   }
 
```

**File**: `apple/macos-helper/Tests/AgentDeviceMacOSHelperTests/AudioProbeTests.swift` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+import AVFoundation
+import CoreMedia
+import XCTest
+
+@testable import AgentDeviceMacOSHelper
+
+/// AudioProbe must set AVAudioPCMBuffer.frameLength before the PCM copy.
+final class AudioProbeTests: XCTestCase {
+  func testAddSampleBufferRecordsANonSilentPeakFromRealPCM() throws {
+    let dir = FileManager.default.temporaryDirectory.appendingPathComponent(
+      "audio-probe-\(UUID().uuidString)", isDirectory: true)
+    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
+    defer { try? FileManager.default.removeItem(at: dir) }
+
+    let outPath = dir.appendingPathComponent("probe.json").path
+    let writer = AudioProbeStatusWriter(outPath: outPath, durationMs: 1_000, bucketMs: 100)
+    writer.add(sampleBuffer: try makeFloatPCMSampleBuffer(frames: 512, amplitude: 0.5))
+    try writer.finish(reason: "test")
+
+    let response = try JSONDecoder().decode(
+      AudioProbeResponse.self, from: Data(contentsOf: URL(fileURLWithPath: outPath)))
+    XCTAssertTrue(response.heard, "a 0.5 amplitude buffer must clear the silence floor")
+    XCTAssertFalse(response.peakDbfs.isEmpty)
+    XCTAssertGreaterThan(response.peakDbfs.max() ?? -90, -90)
+  }
+}
+
+private func makeFloatPCMSampleBuffer(frames: Int, amplitude: Float) throws -> CMSampleBuffer {
+  var asbd = AudioStreamBasicDescription(
+    mSampleRate: 48_000,
+    mFormatID: kAudioFormatLinearPCM,
+    mFormatFlags: kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked
+      | kAudioFormatFlagIsNonInterleaved,
+    mBytesPerPacket: UInt32(MemoryLayout<Float>.size),
+    mFramesPerPacket: 1,
+    mBytesPerFrame: UInt32(MemoryLayout<Float>.size),
+    mChannelsPerFrame: 1,
+    mBitsPerChannel: UInt32(MemoryLayout<Float>.size * 8),
+    mReserved: 0
+  )
+
+  var formatDescription: CMAudioFormatDescription?
+  let formatStatus = CMAudioFormatDescriptionCreate(
+    allocator: kCFAllocatorDefault,
+    asbd: &asbd,
+    layoutSize: 0,
+    layout: nil,
+    magicCookieSize: 0,
+    magicCookie: nil,
+    extensions: nil,
+    formatDescriptionOut: &formatDescription
+  )
+  guard formatStatus == noErr, let formatDescription else {
+    throw NSError(
+      domain: "AudioProbeTests", code: Int(formatStatus),
+      userInfo: [NSLocalizedDescriptionKey: "CMAudioFormatDescriptionCreate failed"])
+  }
+
+  let byteCount = frames * MemoryLayout<Float>.size
+  var blockBuffer: CMBlockBuffer?
+  let blockStatus = CMBlockBufferCreateWithMemoryBlock(
+    allocator: kCFAllocatorDefault,
+    memoryBlock: nil,
+    blockLength: byteCount,
+    blockAllocator: nil,
+    customBlockSource: nil,
+    offsetToData: 0,
+    dataLength: byteCount,
+    flags: 0,
+    blockBufferOut: &blockBuffer
+  )
+  guard blockStatus == noErr, let blockBuffer else {
+    throw NSError(
+      domain: "AudioProbeTests", code: Int(blockStatus),
+      userInfo: [NSLocalizedDescriptionKey: "CMBlockBufferCreateWithMemoryBlock failed"])
+  }
+  let assureStatus = CMBlockBufferAssureBlockMemory(blockBuffer)
+  guard assureStatus == noErr else {
+    throw NSError(
+      domain: "AudioProbeTests", code: Int(assureStatus),
+      userInfo: [NSLocalizedDescriptionKey: "CMBlockBufferAssureBlockMemory failed"])
+  }
+
+  var lengthAtOffset = 0
+  var totalLength = 0
+  var dataPointer: UnsafeMutablePointer<Int8>?
+  let pointerStatus = CMBlockBufferGetDataPointer(
+    blockBuffer,
+    atOffset: 0,
+    lengthAtOffsetOut: &lengthAtOffset,
+    totalLengthOut: &totalLength,
+    dataPointerOut: &dataPointer
+  )
+  guard pointerStatus == noErr, let dataPointer else {
+    throw NSError(
+      domain: "AudioProbeTests", code: Int(pointerStatus),
+      userInfo: [NSLocalizedDescriptionKey: "CMBlockBufferGetDataPointer failed"])
+  }
+  let floatPointer = UnsafeMutableRawPointer(dataPointer).bindMemory(to: Float.self, capacity: frames)
+  for index in 0..<frames {
+    floatPointer[index] = amplitude
+  }
+
+  var timing = CMSampleTimingInfo(
+    duration: CMTime(value: 1, timescale: 48_000),
+    presentationTimeStamp: .zero,
+    decodeTimeStamp: .invalid
+  )
+  var sampleBuffer: CMSampleBuffer?
+  let sampleStatus = CMSampleBufferCreateReady(
+    allocator: kCFAllocatorDefault,
+    dataBuffer: blockBuffer,
+    formatDescription: formatDescription,
+    sampleCount: frames,
+    sampleTimingEntryCount: 1,
+    sampleTimingArray: &timing,
+    sampleSizeEntryCount: 0,
+    sampleSizeArray: nil,
+    sampleBufferOut: &sampleBuffer
+  )
+  guard sampleStatus == noErr, let sampleBuffer else {
+    throw NSError(
+      domain: "AudioProbeTests", code: Int(sampleStatus),
+      userInfo: [NSLocalizedDescriptionKey: "CMSampleBufferCreateReady failed"])
+  }
+  return sampleBuffer
+}
```

#### Recent Merged Pull Requests:
- **PR #3847** (2026-10-20): feat(gesture): add gesture tap with 2 to 5 simultaneous contacts (@camchis)
- **PR #3846** (2026-10-20): chore(diagnostics): trace Apple prepare phases and subprocess lifecycle (@thymikee)
- **PR #3845** (2026-10-20): docs(adr): drop the withdrawn host allocator design from ADR 0021 (@thymikee)
- **PR #3843** (2026-10-20): feat(sdk): start an embedded runtime from the main entry (@thymikee)
- **PR #3840** (2026-10-20): docs(ios): record SpringBoard sessions as verified on a physical iPhone (@camchis)
- **PR #3839** (2026-10-20): feat(screenshot): support selector crops on CoreDevice iPhones (@camchis)

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

## X. daemon): preserve recorded ownership through stop and cleanup (#3806)

**RULE**:
When implementing operations in `packages/daemon-contracts/src/daemon-process.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4645ddd7`: daemon): preserve recorded ownership through stop and cleanup (#3806). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/daemon-contracts/src/daemon-process.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      reason:
        | 'missing-start-time'
        | 'identity-unverified'
        /**
         * A host owns this runtime and ends it. Callers that judge a registration answer this instead of
         * calling {@link stopDaemonProcess} at all (`stopAndRetireDaemon`); this function signals
         * whatever verified identity it is handed and never decides ownership itself.
         */
        | 'embedded-owner'
        /**
         * The record states an owner this build cannot read, so nothing proves this pid is a daemon of
         * its own, and signalling it is refused. The other half of the same rule as `embedded-owner`.
         */
        | 'owner-unproven'
        | 'signal-failed'
        | 'exit-timeout';
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
      reason: 'missing-start-time' | 'identity-unverified' | 'signal-failed' | 'exit-timeout';
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4645ddd7` are properly handled with clean fallback behavior.
