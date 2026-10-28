> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source**: github ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Source Version**: `3537dc54`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T16:19:25.250Z  
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
> **Harvest Timestamp**: 2026-10-28T16:19:25.242Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Mobile app automation and verification for AI coding agents. CLI, MCP server, and typed Node.js API for iOS, Android, HarmonyOS, TV, web, macOS, and Linux.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5173 stars

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
    ...(presentation.qualityNotes ? { qualityNotes: presentation.qualityNotes } : {}),
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
    ...(folded.qualityNotes ? { qualityNotes: folded.qualityNotes } : {}),
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
- **Issue #3982** (2026-10-27): **Taps on Jetpack Compose buttons refused because of the fake Button child node**
  *Symptoms*: **Purpose.** agent-device refuses taps on Jetpack Compose buttons with "no parent-owned touch point".  **Cause.** For every merging `Button`, Compose's `SemanticsNode.emitFakeNodes` adds a fake child node with `role=Button` that is not clickable. The competitor filter in the tap-target check matches on type and role names and ignores whether a competitor is clickable or hittable. So the fake child counts as a competing control covering the button, and the tap is blocked.  **Required behavior.** - Only count a competitor that can receive the tap (`hittable === true`). - When exactly one competitor covers the target's center, tap the center.  We patch this today in the minified `dist/src/runtime-factory.js`. In readable form:  ```js // competitors .filter((e) => isOverlappingCompetitor(e, target, byIndex)) .filter((e) => e.hittable === true) // after collecting competitors if (competitors.length === 1 && contains(competitors[0].rect, center)) return { kind: 'resolved', point: center, strategy: 'center' }; ```  **Done when.** A tap on a Compose `Button` resolves without a patch. Still present in 0.21.32.  **Dependencies.** None. 

- **Issue #3963** (2026-10-26): **iOS: recoverable service-hub interruption is misclassified as unsupported Xcode**
  *Symptoms*: ## Problem  The simulator startup classifier introduced in #3739 treats every log line containing `DTServiceHubClient` and `failed to bless service hub` as proof that Xcode is incompatible with the host macOS. A recoverable service connection interruption uses the same wording.  Observed on macOS 27.0.1, Xcode 27.1, and an iOS 27 simulator. A single `xcodebuild test-without-building` launch writes this sanitized diagnostic:  ```text DTServiceHubClient failed to bless service hub for simulator <simulator> (<udid>) ... NSUnderlyingError={Error Domain=DTServiceHubClient Code=2 "Connection to Simulator service hub (...) interrupted. Simulator service hub IS still alive."} ```  About 2.935 seconds later, the same launch starts XCTest and reports `AGENT_DEVICE_RUNNER_LISTENER_READY`. The driver can already have aborted with `simulator_service_hub_unavailable` and an instruction to update Xcode.  ## Required behavior  - Let a launch with the Code=2/still-alive diagnostic continue through the existing connection budget and serve its command when the runner becomes ready. - Preserve immediate, terminal classification for the genuine refusal reported in #3449: `DTServiceHubClient Code=1` with `localDeviceConnectionWithError:`. - A generic bless warning alone must not establish Xcode/macOS incompatibility. - Preserve existing deadlines and recovery policy; do not add retries, sleeps, or a global classification override.  ## Completion  Behavioral coverage proves that the recoverable dia

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

### Incident Patch 1: `ff8029e9` (2026-10-28)
**Commit Message**: fix(mutation): measure each kernel against the tests that import it (#3994)

* fix(mutation): measure each kernel against the tests that import it

The weekly kernel-errors shard outran its 22-minute step (run 40164641005):
its scope was every test that transitively reaches errors.ts, 1,471 files,
and it grew by 75 in one week. Every shard replays the whole scope in its
dry run, so adding shards could not bound it.

A test now owns a kernel only when its own code, or the test support code
it imports, imports one of its mutated sources, directly or through a
barrel re-export, and only when the mutation
lane can collect it: the apple-runner project's tests need that project's
setup, so they join MUTATION_EXCLUDED_TESTS. The weekly scope and the PR
lane's derived selection read that one rule. The Stryker config comment
changes with it, so the report's config hash marks the scope change.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* chore(gates): cap each kernel's mutation scope in the unit suite

A unit-suite test fails the PR that grows a kernel's owned tests past
MAX_MUTATION_TEST_SCOPE_FILES, instead of the next weekly sweep timing out.
The cap comes from the weekly shard 

**File**: `.github/workflows/mutation-affected.yml` (modified, +2/-2)
```diff
@@ -18,8 +18,8 @@ name: Mutation Harness Canary
 # On a harness diff the matrix is the canary (`LANE_CANARY`, selected by
 # observed end-to-end runtime within the job budget — lane sources own no kernel,
 # so derivation alone would select nothing) plus any kernel that same diff
-# reaches through the import graph (scripts/mutation/ownership.ts): a kernel
-# source, or a test that reaches one. Selected modules are sharded like the
+# owns (scripts/mutation/ownership.ts): a kernel source, or a test that
+# imports one. Selected modules are sharded like the
 # weekly sweep, so the PR's wall clock is one module rather than their sum.
 
 on:
```

**File**: `scripts/__tests__/mutation-scope-budget.test.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import path from 'node:path';
+import { expect, test } from 'vitest';
+import { KERNEL_MODULES, MAX_MUTATION_TEST_SCOPE_FILES } from '../mutation/modules.ts';
+import { mutationTestScopes } from '../mutation/ownership.ts';
+
+const repoRoot = path.resolve(import.meta.dirname, '../..');
+
+test('every kernel mutation scope fits one weekly shard', { timeout: 30_000 }, () => {
+  const scopes = mutationTestScopes(repoRoot);
+  const oversized = KERNEL_MODULES.map((module) => ({
+    module: module.id,
+    testFiles: scopes.get(module.id)?.length ?? 0,
+  })).filter((scope) => scope.testFiles > MAX_MUTATION_TEST_SCOPE_FILES);
+  expect(
+    oversized,
+    `A kernel's owned tests exceed MAX_MUTATION_TEST_SCOPE_FILES (${MAX_MUTATION_TEST_SCOPE_FILES}). ` +
+      'Every shard replays the whole scope, so more shards do not help. Split the kernel in ' +
+      'scripts/mutation/modules.ts, or import it from fewer tests.',
+  ).toEqual([]);
+});
```

**File**: `scripts/mutation/envelope.test.ts` (modified, +2/-4)
```diff
@@ -429,15 +429,13 @@ test('a non-zero Stryker exit fails even when it wrote a report', () => {
     fs.mkdirSync(path.join(root, 'bin'));
     fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'));
     fs.writeFileSync(path.join(root, 'stryker.config.json'), '{}');
-    fs.writeFileSync(
-      path.join(root, 'vitest.config.ts'),
-      `export default { test: { projects: [{ test: { name: 'unit-core', include: ['src/**/*.test.ts'] } }] } };`,
-    );
     fs.writeFileSync(path.join(root, 'packages/kernel/src/errors.ts'), 'export const value = 1;');
     fs.writeFileSync(
       path.join(root, 'src/consumer.test.ts'),
       "import { value } from '../packages/kernel/src/errors'; console.log(value);",
     );
+    // Ownership reads the tracked import graph.
+    runCmdSync('git', ['add', 'src', 'packages'], { cwd: root });
     fs.writeFileSync(
       path.join(root, 'bin/pnpm'),
       `#!/bin/sh
```

**File**: `scripts/mutation/modules.ts` (modified, +13/-1)
```diff
@@ -98,6 +98,18 @@ export const KERNEL_MODULES: readonly KernelModule[] = [
   },
 ];
 
+/**
+ * The most test files one kernel's mutation scope may hold. Every shard of a
+ * module replays its whole scope in Stryker's dry run before the first mutant,
+ * so this bounds a shard however many shards the module declares. Measured on
+ * ubuntu-latest (weekly run 40164641005): a 684-file scope dry-ran in 4–7 min
+ * and its shards finished in 9–19 min of the 22-minute step; a 1,471-file scope
+ * dry-ran in 8–11 min and a shard outran the step. The unit suite enforces it
+ * (`scripts/__tests__/mutation-scope-budget.test.ts`), so the PR that grows a
+ * scope past it fails instead of the next weekly sweep.
+ */
+export const MAX_MUTATION_TEST_SCOPE_FILES = 600;
+
 export const ALL_MODULE_IDS: readonly ModuleId[] = KERNEL_MODULES.map((module) => module.id);
 
 export function moduleById(id: ModuleId): KernelModule {
@@ -119,7 +131,7 @@ export function mutateGlobs(ids: readonly ModuleId[] = ALL_MODULE_IDS): string[]
 
 /**
  * The module a lane-tooling change proves itself against. Keep this to a real
- * end-to-end sweep whose observed related-test scope fits the 30-minute job
+ * end-to-end sweep whose observed owned-test scope fits the 30-minute job
  * budget; mutant count alone does not capture replay cost.
  */
 export const LANE_CANARY: ModuleId = 'snapshot-occlusion';
```

**File**: `scripts/mutation/ownership.test.ts` (modified, +78/-20)
```diff
@@ -1,15 +1,19 @@
 import assert from 'node:assert/strict';
 import path from 'node:path';
 import { test } from 'node:test';
+import fs from 'node:fs';
+import { mkdtempForTestSync } from '@agent-device/test-kit';
+import { runCmdSync } from '@agent-device/host-kit/command';
 import { fileURLToPath } from 'node:url';
 import { KERNEL_MODULES } from './modules.ts';
 import {
   derivedAffectedModules,
+  importedBy,
   isTestFile,
   mutatedSources,
+  mutationTestFiles,
   ownedTestFiles,
   ownershipDeriver,
-  reachableFrom,
 } from './ownership.ts';
 
 const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
@@ -31,30 +35,84 @@ test('a kernel is owned by the mirrored test that imports it directly', () => {
   );
 });
 
-// The omission that hand-listed ownership could not see: this test asserts over
-// normalizeError without importing packages/kernel/src/errors.ts itself.
-test('a kernel is owned by tests that reach it indirectly', () => {
-  const deriver = ownershipDeriver(repoRoot);
+// Reach is not ownership: nearly every test reaches the error kernel, and a
+// reach-based scope is the whole suite. This test exercises edge detection only
+// through the back runtime, so it does not measure scroll-edge-state.
+test('a test that only reaches a kernel through other modules does not own it', () => {
+  const testFile = 'packages/daemon/src/execution/__tests__/back-runtime.test.ts';
+  assert.ok(!ownershipDeriver(repoRoot).ownersOf(testFile).includes('scroll-edge-state'));
+  assert.ok(!mutationTestFiles(['scroll-edge-state'], repoRoot).includes(testFile));
+});
+
+test('a file absent from the tracked graph imports nothing', () => {
+  assert.deepEqual([...importedBy('src/untracked-fixture.ts', repoRoot)], []);
+});
+
+test('a mutation scope holds no test another Vitest project owns', () => {
+  // The apple-runner suites need that project's host setup, which Stryker's run does not install.
   assert.ok(
-    deriver.ownersOf('src/__tests__/daemon-error.test.ts').includes('kernel-errors'),
-    'daemon-error.test.ts exercises normalizeError but does not own kernel-errors',
+    !mutationTestFiles(['kernel-errors'], repoRoot).some((file) =>
+      file.startsWith('packages/platform-apple/src/runner/'),
+    ),
   );
   assert.ok(
-    deriver
-      .ownersOf('packages/daemon/src/execution/__tests__/back-runtime.test.ts')
-      .includes('scroll-edge-state'),
-    'back-runtime.test.ts exercises edge detection but does not own scroll-edge-state',
+    !isTestFile('packages/platform-apple/src/runner/__tests__/index-dispatch-disclosure.test.ts'),
   );
 });
 
-test('reachability includes its query root when the file is absent from the tracked graph', () => {
-  assert.deepEqual(
-    [...reachableFrom('src/untracked-fixture.ts', repoRoot)],
-    ['src/untracked-fixture.ts'],
+test('a test that takes a kernel through a barrel re-export owns it', () => {
+  // `@agent-device/ad-script` re-exports the codec this test exercises.
+  assert.ok(
+    mutationTestFiles(['target-annotation-serde'], repoRoot).includes(
+      'packages/selectors/src/target-evidence.test.ts',
+    ),
   );
 });
 
-test('ownership is complete: every test reaching a kernel owns it', () => {
+test('a test that runs a kernel through its test support code owns it', () => {
+  // `capture()` in scroll-edge-state-fixtures.ts calls the kernel; this test imports only it.
+  const testFile =
+    'packages/capture-kit/src/snapshot/__tests__/scroll-edge-state-target-resolution.test.ts';
+  assert.ok(ownershipDeriver(repoRoot).ownersOf(testFile).includes('scroll-edge-state'));
+  assert.ok(mutationTestFiles(['scroll-edge-state'], repoRoot).includes(testFile));
+});
+
+test('barrel re-exports reach the module each imported name comes from, and only that one', () => {
+  const root = fs.realpathSync(mkdtempForTestSync('mutation-barrels-'));
+  try {
+    runCmdSync('git', ['init', '--quiet', root]);
+    const write = (file: string, source: string) => {
+      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
+      fs.writeFileSync(path.join(root, file), source);
+    };
+    write('package.json', JSON.stringify({ name: 'barrel-fixture', type: 'module' }));
+    write('src/kernel.ts', 'export const value = 1;');
+    write('src/other.ts', 'export const unrelated = 2;');
+    write('src/renamed.ts', "export { value as renamed } from './kernel.ts';");
+    write('src/star.ts', "export * from './other.ts';\nexport * from './kernel.ts';");
+    write('src/forwarded.ts', "import { value } from './kernel.ts';\nexport { value };");
+    write(
+      'src/__tests__/helper.ts',
+      "import { value } from '../kernel.ts';\nexport const run = () => value;",
+    );
+    write('src/renamed.test.ts', "import { renamed } from './renamed.ts';");
+    write('src/star.test.ts', "import { value } from './star.ts';");
+    write('src/star-other.test.ts', "import { unrelated } from './star.ts';");
+    write('s
```

**File**: `scripts/mutation/ownership.ts` (modified, +188/-75)
```diff
@@ -1,34 +1,29 @@
-// Which kernel module a changed file belongs to, DERIVED — never hand-listed.
+// Which tests measure a kernel module, DERIVED — never hand-listed.
 //
-// A mutation score is a statement about the tests that kill the mutants, so a
-// selection is only honest if it follows *those* tests. An enumerated list of
-// test files cannot state that: it silently omits tests that
-// exercise a kernel indirectly (`src/__tests__/daemon-error.test.ts` reaches
-// `normalizeError` through `src/daemon.ts`), and nothing fails when a new test
-// is added. So ownership is computed from the static import graph instead: a test
-// file owns every kernel module whose mutated sources it can reach.
+// A mutation score is a statement about the tests that kill the mutants, so the
+// scope has to follow the tests that exercise the kernel on purpose: the ones
+// that import one of its mutated sources. An enumerated list cannot state that
+// (a new test silently stays out), and transitive reach states something else:
+// `packages/kernel/src/errors.ts` is reachable from nearly every test in the
+// repository, so a reach-based scope is the whole suite. That scope grows with
+// every unrelated test and no shard count bounds it, because every shard replays
+// the full scope in its dry run — the weekly kernel-errors shard went from 1,396
+// to 1,471 related files in one week and outran its job (weekly run 40164641005).
 //
-// The derivation is deliberately a superset — reaching a kernel is cheaper to
-// prove than killing its mutants, so an unrelated diff can select a module and
-// pay for a report. False positives cost runner minutes; a false negative would
-// leave a kernel whose tests changed unmeasured.
-//
-// Non-test source changes outside the registry are NOT owned: they can only move
-// a score through the tests that reach the kernel, and the weekly full sweep is
-// what re-measures the whole surface. The derived claim is narrower on purpose —
-// kernel sources plus the tests that exercise them.
+// So a test owns a kernel when its own code, or the test support code it
+// imports, has an executable (value or dynamic) import of one of the kernel's
+// mutated sources, directly or through a barrel's re-export. A mutant that only
+// a distant test can kill shows up as a survivor in the kernel's own tests —
+// work for a test-strengthening PR, never a silent pass. The scope the weekly
+// sweep runs and the PR lane's derived selection read this one rule.
 
 import fs from 'node:fs';
 import path from 'node:path';
-import { genBFS, type Graph } from '@statelyai/graph';
-import {
-  readWorkspacePackages,
-  workspaceSpecifierTargets,
-} from '../layering/package-boundaries.ts';
+import { workspaceSpecifierTargets } from '../layering/package-boundaries.ts';
 import { resolveImportEdges } from '../layering/model.ts';
 import { listTrackedTypeScriptFiles } from '../layering/tracked-sources.ts';
-import { walkFiles } from '../lib/walk-files.ts';
-import { ALL_EDGES, importGraphFromResolvedEdges } from '../depgraph/import-graph.ts';
+import { parseSync } from 'oxc-parser';
+import { edgeKind, EXECUTABLE_EDGES } from '../depgraph/import-graph.ts';
 import {
   affectedModules,
   isKernelTestFile,
@@ -37,54 +32,162 @@ import {
   type ModuleId,
   type KernelModule,
 } from './modules.ts';
-import { expandMutateFiles } from './test-scope.ts';
+import { expandMutateFiles, threadHostileTestFiles } from './test-scope.ts';
+import { MUTATION_EXCLUDED_TESTS } from '../../vitest.config.ts';
 
-/** Test files the mutation lane can attribute to a kernel at all. */
+/**
+ * Test files the mutation lane can attribute to a kernel at all: the unit roots, minus every test
+ * the lane must not collect (`MUTATION_EXCLUDED_TESTS`, which includes other projects' tests).
+ */
 export function isTestFile(filePath: string): boolean {
-  return isKernelTestFile(filePath);
+  const file = normalizePath(filePath);
+  return (
+    isKernelTestFile(file) &&
+    !MUTATION_EXCLUDED_TESTS.some((excluded) => path.matchesGlob(file, excluded))
+  );
 }
 
-/**
- * Workspace package specifiers resolved through the shared exports-map reader
- * (scripts/layering/package-boundaries.ts) — never hand-listed. Without this
- * the graph walk stops at every `@agent-device/*` edge and a kernel living in
- * `packages/` silently loses all of its owned tests.
- */
-let cachedExportTargets: { repoRoot: string; targets: Map<string, string> } | undefined;
+type ImportedModule = { target: string; spec: string; symbols: readonly string[] };
 
-function exportTargetsFor(repoRoot: string): Map<string, string> {
-  if (cachedExportTargets?.repoRoot !== repoRoot) {
-    cachedExportTargets = { repoRoot, targets: workspaceSpecifierTargets(repoRoot) };
-  }
-  return cachedExportTargets.targets;
+/** One `export … from` entry: the name taken from `spec`, and the name it is exported as. */
+type Reexport = { spec: string; imported: string | typeof AL
```

**File**: `scripts/mutation/run.ts` (modified, +14/-31)
```diff
@@ -40,15 +40,10 @@ import {
   type ShardSpec,
 } from './modules.ts';
 import { shardFiles, type Shard } from './sharding.ts';
-import { derivedAffectedModules } from './ownership.ts';
+import { derivedAffectedModules, mutationTestFiles } from './ownership.ts';
 import { renderReport, type Provenance } from './report.ts';
 import { mergeReports, summarizeReport, type ModuleScore, type StrykerReport } from './score.ts';
-import {
-  expandMutateFiles,
-  relatedTestFiles,
-  TEST_SCOPE_ENV,
-  writeTestScope,
-} from './test-scope.ts';
+import { expandMutateFiles, TEST_SCOPE_ENV, writeTestScope } from './test-scope.ts';
 
 const repoRoot = runCmdSync('git', ['rev-parse', '--show-toplevel']).stdout.trim();
 
@@ -244,18 +239,14 @@ function changedFiles(base: string): string[] {
   return result.stdout.split('\n').filter(Boolean);
 }
 
-async function mutationTestScope(
-  modules: readonly ModuleId[],
-  sources: readonly string[],
-  options: Args,
-) {
+function mutationTestScope(modules: readonly ModuleId[], options: Args) {
   const pilot = options.scopeProbe || Boolean(options.scopeIndex);
   if (pilot)
     assertCoveragePolicy(JSON.parse(fs.readFileSync(path.join(repoRoot, CONFIG_PATH), 'utf8')));
   const index: CoverageScope | undefined = options.scopeIndex
     ? JSON.parse(fs.readFileSync(path.resolve(repoRoot, options.scopeIndex), 'utf8'))
     : undefined;
-  const candidates = await relatedTestFiles(sources, repoRoot);
+  const candidates = mutationTestFiles(modules, repoRoot);
   const identity = pilot
     ? {
         module: modules[0]!,
@@ -267,21 +258,17 @@ async function mutationTestScope(
   const testFiles = options.scopeIndex
     ? scopedTestFiles(index!, identity!, candidates)
     : candidates;
-  if (!testFiles.length) throw new Error(`No related mutation tests for ${modules.join(', ')}`);
+  if (!testFiles.length) throw new Error(`No owned mutation tests for ${modules.join(', ')}`);
   return { candidates, identity, index, testFiles };
 }
 
 async function mutationSourceScope(modules: readonly ModuleId[], shard: Shard | undefined) {
   const globs = mutateGlobs(modules);
   const all = expandMutateFiles(globs, repoRoot);
-  if (!shard) return { mutate: globs, sources: all, sourceCount: all.length };
+  if (!shard) return { mutate: globs, sourceCount: all.length };
   const config = JSON.parse(fs.readFileSync(path.join(repoRoot, CONFIG_PATH), 'utf8'));
   const mutate = await shardFiles(all, shard, repoRoot, config.mutator?.excludedMutations ?? []);
-  return {
-    mutate,
-    sources: [...new Set(mutate.map((file) => file.split(':')[0]!))],
-    sourceCount: mutate.length,
-  };
+  return { mutate, sourceCount: mutate.length };
 }
 
 function finishScopeProbe(
@@ -329,19 +316,15 @@ async function runStryker(
     fs.rmSync(capturePath, { force: true });
     fs.rmSync(path.join(repoRoot, COVERAGE_SCOPE_PATH), { force: true });
   }
-  // The suite Stryker replays per mutant is derived from Vitest's module graph
-  // over the mutated files, not hand-listed; see scripts/mutation/test-scope.ts.
-  const { mutate, sources, sourceCount } = await mutationSourceScope(modules, shard);
+  // The suite Stryker replays per mutant is each module's owned tests, derived
+  // from the import graph rather than hand-listed; see scripts/mutation/ownership.ts.
+  const { mutate, sourceCount } = await mutationSourceScope(modules, shard);
   const scopePath = path.join(repoRoot, TEST_SCOPE_PATH);
-  const { candidates, identity, index, testFiles } = await mutationTestScope(
-    modules,
-    sources,
-    options,
-  );
+  const { candidates, identity, index, testFiles } = mutationTestScope(modules, options);
   writeTestScope(testFiles, scopePath);
   process.stdout.write(
     `mutation: ${modules.join(', ')}${shard ? ` shard ${shard.index}/${shard.count}` : ''} -> ` +
-      `${sourceCount} source(s), ${testFiles.length} related test file(s)\n`,
+      `${sourceCount} source(s), ${testFiles.length} owned test file(s)\n`,
   );
 
   // Stryker's `--mutate` takes one comma-separated value, not repeated args.
@@ -380,7 +363,7 @@ async function runStryker(
   if (identity && scopeFingerprint(repoRoot) !== identity.fingerprint)
     throw new Error('Execution inputs changed during the scoped mutation run');
   return {
-    mode: index ? 'coverage' : 'related',
+    mode: index ? 'coverage' : 'owned',
     candidates: candidates.length,
     selected: testFiles.length,
     producerMs: index?.producerMs ?? null,
@@ -411,7 +394,7 @@ type Stage = 'setup' | 'select' | 'stryker' | 'report' | 'score' | 'complete';
  */
 const UNKNOWN_PROVENANCE: Provenance = { strykerVersion: 'unknown', configHash: 'unknown' };
 type ScopeMeasurement = {
-  mode: 'probe' | 'coverage' | 'related';
+  mode: 'probe' | 'coverage' | 'owned';
   candidates: number;
   selected: number;
   producerMs: number | null;
```

**File**: `scripts/mutation/test-scope.test.ts` (modified, +0/-30)
```diff
@@ -5,7 +5,6 @@ import { mkdtempForTestSync } from '@agent-device/test-kit';
 import { test } from 'node:test';
 import {
   expandMutateFiles,
-  relatedTestFiles,
   readTestScope,
   TEST_SCOPE_ENV,
   threadHostileTestFiles,
@@ -35,35 +34,6 @@ test('the thread-hostile exclusion is derived from imports, not listed', () => {
   assert.ok(files.every((file) => file.endsWith('.test.ts')));
 });
 
-test('related scope discovery follows indirect imports without executing tests', async () => {
-  const root = fs.realpathSync(mkdtempForTestSync('mutation-scope-'));
-  try {
-    fs.mkdirSync(path.join(root, 'src'));
-    fs.writeFileSync(
-      path.join(root, 'package.json'),
-      JSON.stringify({ name: 'scope-fixture', type: 'module' }),
-    );
-    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'));
-    const marker = path.join(root, 'executed');
-    fs.writeFileSync(
-      path.join(root, 'vitest.config.ts'),
-      `export default { test: { projects: [{ test: { name: 'unit-core', include: ['src/**/*.test.ts'] } }] } };`,
-    );
-    fs.writeFileSync(path.join(root, 'src/kernel.ts'), 'export const value = 1;');
-    fs.writeFileSync(path.join(root, 'src/consumer.ts'), "export { value } from './kernel';");
-    fs.writeFileSync(
-      path.join(root, 'src/consumer.test.ts'),
-      `import { value } from './consumer'; import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, String(value)); throw new Error('discovery must not execute tests');`,
-    );
-    fs.writeFileSync(path.join(root, 'src/unrelated.test.ts'), "throw new Error('unrelated');");
-    assert.deepEqual(await relatedTestFiles(['src/kernel.ts'], root, []), ['src/consumer.test.ts']);
-    assert.equal(fs.existsSync(marker), false, 'scope discovery executed the test module');
-    assert.deepEqual(await relatedTestFiles(['src/kernel.ts'], root, ['src/consumer.test.ts']), []);
-  } finally {
-    fs.rmSync(root, { recursive: true, force: true });
-  }
-});
-
 test('a missing scope file is rejected and an empty scope file reads as an empty list', () => {
   const root = fs.realpathSync(mkdtempForTestSync('mutation-empty-scope-'));
   const previous = process.env[TEST_SCOPE_ENV];
```

---

### Incident Patch 2: `0b49de4d` (2026-10-28)
**Commit Message**: fix(test-app): keep the inert surface control above the settings fold (#3993)

Adding the Snapshot depth section (#3786) pushed the Inert surface card
into the band the iOS 26 floating tab bar covers on a 402x874 phone, so
open-inert-surface stopped being visible after the Settings tab tap:
agent-device refuses invisible targets, its differential legs went red
every night since 10-18 (settle-after-tap step 5, tap-retry-if-no-change
step 3), while Maestro's presence-based check kept passing.

The settle flow's own guard rejects an inserted scroll and pins the
assert on this control, so the fixture restores the reachability the
flows were written against: the inert card is the second section, ahead
of the growth that followed it. Local snapshot before: the settings tree
ended at 'Open accessory setup lab' with '[content below scroll-area
hidden]'; after: open-inert-surface resolves at (201, 609) and the tap
navigates to the inert screen.

Co-authored-by: Claude Code <[REDACTED_EMAIL]>

**File**: `examples/test-app/src/screens/SettingsScreen.tsx` (modified, +15/-11)
```diff
@@ -76,6 +76,21 @@ export function SettingsScreen(props: SettingsScreenProps) {
         />
       </SectionCard>
 
+      {/* The differential flows assert and tap this control straight after the
+          Settings tab, and their settle guard rejects any inserted scroll, so
+          this card stays the second section: every later section lands under
+          the fold's floating tab bar on a 402x874 phone. */}
+      <SectionCard
+        subtitle="Open a surface where a tap provably changes nothing on screen."
+        title="Inert surface"
+      >
+        <ActionButton
+          label="Open inert surface"
+          onPress={props.onOpenInertSurface}
+          testID="open-inert-surface"
+        />
+      </SectionCard>
+
       <SectionCard subtitle="Inspect visible and raw snapshot depth." title="Snapshot depth">
         <ActionButton
           label="Open snapshot depth lab"
@@ -95,17 +110,6 @@ export function SettingsScreen(props: SettingsScreenProps) {
         />
       </SectionCard>
 
-      <SectionCard
-        subtitle="Open a surface where a tap provably changes nothing on screen."
-        title="Inert surface"
-      >
-        <ActionButton
-          label="Open inert surface"
-          onPress={props.onOpenInertSurface}
-          testID="open-inert-surface"
-        />
-      </SectionCard>
-
       <SectionCard
         subtitle="Inspect native accessibility snapshots for semantic content inside a WebView."
         title="WebView accessibility"
```

---

### Incident Patch 3: `3537dc54` (2026-10-28)
**Commit Message**: fix(open): refuse --launch-console on a provider-owned device before the relaunch close (#3938)

A provider-owned iOS simulator has the same device shape as a local one, so
open --relaunch --launch-console passed the existing shape check, closed the
running app, and only then failed. The provider branch of the lifecycle
binding now refuses launch-console with UNSUPPORTED_OPERATION and the typed
reason launch-console-owner-unadmitted before it resolves an interactor, so
no close or launch runs.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/command-registry/src/flag-definitions-target.ts` (modified, +2/-1)
```diff
@@ -363,7 +363,8 @@ export const TARGET_FLAG_DEFINITIONS: readonly FlagDefinition[] = [
     names: ['--launch-console'],
     type: 'string',
     usageLabel: '--launch-console <path>',
-    usageDescription: 'open: capture the initial iOS simulator launch console window to a file',
+    usageDescription:
+      'open: capture the initial local iOS simulator launch console window to a file',
     projectConfig: false,
     recorded: false,
   },
```

**File**: `packages/contracts/src/application-lifecycle-interaction.test.ts` (modified, +28/-0)
```diff
@@ -5,6 +5,7 @@ import type { OpenApplicationInput } from './application-lifecycle-runtime.ts';
 import {
   bindDirectApplicationLifecycle,
   bindLocalApplicationLifecycleInteractor,
+  bindProviderApplicationLifecycleInteractor,
   invokeApplicationOpen,
 } from './application-lifecycle-interaction.ts';
 
@@ -165,3 +166,30 @@ test.each([
     }),
   ).rejects.toThrow(message);
 });
+
+test('provider interactor resolution refuses launch-console before a relaunch close', async () => {
+  const calls: string[] = [];
+  const binding = bindProviderApplicationLifecycleInteractor({
+    device: IOS_SIMULATOR,
+    signal: new AbortController().signal,
+    resolveInteractor: () => {
+      calls.push('resolve');
+      return interactorWithOpen();
+    },
+  });
+  const lifecycle = bindDirectApplicationLifecycle({
+    binding,
+    owner: 'provider',
+    openTargetIdentity: 'bundle-id',
+    closeBeforeRelaunch: true,
+  });
+  await expect(
+    lifecycle.openApplication(
+      openInput({ relaunch: true, execution: { launchConsole: '/tmp/app.log' } }),
+    ),
+  ).rejects.toMatchObject({
+    code: 'UNSUPPORTED_OPERATION',
+    details: { reason: 'launch-console-owner-unadmitted', deviceId: IOS_SIMULATOR.id },
+  });
+  expect(calls).toEqual([]);
+});
```

**File**: `packages/contracts/src/application-lifecycle-interaction.ts` (modified, +11/-0)
```diff
@@ -87,6 +87,17 @@ function bindApplicationLifecycleInteractor(
     resolveInteractor: async (execution, appBundleId) => {
       const runner = applicationLifecycleRunnerContext(execution, appBundleId, signal);
       if (ownership === 'local') return await params.resolveLocalInteractor(device, runner);
+      if (execution.launchConsole) {
+        throw new AppError(
+          'UNSUPPORTED_OPERATION',
+          '--launch-console is supported only for a local iOS simulator app launch',
+          {
+            reason: 'launch-console-owner-unadmitted',
+            deviceId: device.id,
+            hint: 'Remove --launch-console, or use a local iOS simulator for launch output.',
+          },
+        );
+      }
       const interactor = ownership.resolveInteractor(runner);
       if (interactor) return interactor;
       throw new AppError(
```

**File**: `src/commands/management/app.ts` (modified, +2/-2)
```diff
@@ -45,7 +45,7 @@ const openCommandMetadata = defineFieldCommandMetadata(
     ),
     activity: stringField('Android activity name.'),
     launchConsole: stringField(
-      'File path on the daemon host for the stdout and stderr of the initial app launch. iOS simulator direct app launches only; not for URL opens.',
+      'File path on the daemon host for the stdout and stderr of the initial app launch. Local iOS simulator direct app launches only; not for URL opens.',
     ),
     launchArgs: stringArrayField(
       'Launch arguments forwarded verbatim to the platform launch command.',
@@ -199,7 +199,7 @@ export const openCommandFacet = defineCommandFacet({
   text: {
     summary: 'Open an app, deep link or URL, save replays',
     cliDetail:
-      'Use --platform to bind URL/deep-link opens to the target platform. For iOS simulator initial stdout/stderr, put --launch-console <path> on this open command, for example agent-device open "Agent Device Tester" --platform ios --launch-console artifacts/launch-console.log. Expo Go/dev-client shells accept host + URL, for example agent-device open "Expo Go" exp://127.0.0.1:8081 --platform ios. macOS also supports --surface app|frontmost-app|desktop|menubar. --metro-host/--metro-port/--bundle-url choose the app\'s Metro server and save that address for later metro reload calls in the same session. A fresh open without Metro hints clears an older same-name binding; close also clears it. --launch-url supplies the app\'s launch URL; it does not select the reload server. On an iOS simulator without --launch-url, open connects a detected Expo development client through its expo-development-client URL. The app must declare a single exp+<slug> scheme that no other installed app owns. If detection is inconclusive, the app opens normally. Bare React Native apps receive their server settings before launch. On an iOS simulator, when --launch-url raises an "Open in <App>?" prompt that keeps open from seeing the app, open accepts it if the URL scheme belongs to the session app (data.launchConfirmation: "accepted"); if the scheme belongs to another installed app, the prompt stays on screen and open fails with details.reason launch_confirmation_foreign_app; if the scheme owner cannot be resolved because no single installed app owns it or the lookup failed, the prompt stays on screen and open returns with data.launchConfirmation: "unanswered", launchConfirmationReason url-owner-unresolved, and a warning; a prompt that is seen but not recognized is reported the same way with launchConfirmationReason alert-unrecognized and its own warning; for url-owner-unresolved, answer the prompt with alert accept; for alert-unrecognized, read the alert with alert get first, because it can be the app\'s own alert (such as a permission prompt) rather than a translated launch confirmation, and answer with alert accept only when it is the launch confirmation; when agent-device cannot read whether a prompt is up at all (the alert read, the accept, or the runner itself failed, including after a re-hand of the URL), open stays green, reports no launchConfirmation plus data.launchConfirmationProbeFailure naming the failed step (alert-read, alert-accept, or runner), and appends a warning that says to check with alert get. The prompt is read whenever open cannot see the app afterwards, including on a slow host where the app\'s target discovery fails on its own deadline. When an accept leaves the app provably not running, open hands the same URL over once more and reads again; still not running, it fails with details.reason launch_confirmation_unanswered. A recognized prompt still visible after a failed accept also fails with this reason, even if the app is running behind it; answer it with alert accept or alert dismiss. A simulator openurl that CoreSimulator never answers fails within 20s with details.reason ios-simulator-openurl-timeout. Only the English prompt title with Cancel and Open buttons is recognized, so on a Simulator set to another language the prompt stays on screen. A prompt that appears after open has already seen the app is not answered; use alert accept. A device another session is holding refuses at once; add --wait <ms> to block up to that budget for it and only then fail with DEVICE_IN_USE naming the owning session.',
+      'Use --platform to bind URL/deep-link opens to the target platform. For local iOS simulator initial stdout/stderr, put --launch-console <path> on this open command, for example agent-device open "Agent Device Tester" --platform ios --launch-console artifacts/launch-console.log. Expo Go/dev-client shells accept host + URL, for example agent-device open "Expo Go" exp://127.0.0.1:8081 --platform ios. macOS also supports --surface app|frontmost-app|desktop|menubar. --metro-host/--metro-port/--bundle-url choose the app\'s Metro server and save that address for later metro reload calls in the same session. A fresh open without Metro hints clears an older same-name 
```

**File**: `test/integration/provider-scenarios/provider-device-runtime.fixtures.ts` (modified, +8/-28)
```diff
@@ -19,8 +19,7 @@ import {
 } from '@agent-device/contracts/application-lifecycle-runtime';
 import {
   bindProviderApplicationLifecycleInteractor,
-  invokeApplicationClose,
-  invokeApplicationOpen,
+  bindDirectApplicationLifecycle,
 } from '@agent-device/contracts/application-lifecycle-interaction';
 import { keyboardRuntimeOperationFacts } from '@agent-device/contracts/keyboard-runtime';
 import { bindProviderSnapshotInteractor } from '@agent-device/contracts/snapshot-runtime';
@@ -201,39 +200,20 @@ function providerScenarioApplicationLifecycle(
     signal,
     resolveInteractor: (runner) => runtime.getInteractor(device, runner),
   });
+  const direct = bindDirectApplicationLifecycle({
+    binding,
+    owner: 'scenario-provider',
+    openTargetIdentity: 'bundle-id',
+    closeBeforeRelaunch: true,
+  });
   return Object.freeze({
+    ...direct,
     resolveOpenTarget: async (input) => ({
       ...(input.target?.includes('.') ? { appBundleId: input.target } : {}),
       ...(input.target === undefined ? {} : { appName: input.target }),
     }),
-    prepareApplicationOpen: async () => undefined,
-    openApplication: async (input) => {
-      if (input.relaunch && input.target) {
-        await invokeApplicationClose({
-          device,
-          interactor: await binding.resolveInteractor(input.execution, input.appBundleId),
-          positionals: [input.appBundleId ?? input.target],
-        });
-      }
-      await invokeApplicationOpen({
-        device,
-        interactor: await binding.resolveInteractor(input.execution, input.appBundleId),
-        positionals: input.positionals,
-        appBundleId: input.appBundleId,
-        execution: input.execution,
-      });
-      return { appBundleId: input.appBundleId, timing: {} };
-    },
     applyRuntimeHints: async () => undefined,
     clearRuntimeHints: async () => undefined,
-    closeApplication: async (input) => {
-      await invokeApplicationClose({
-        device,
-        interactor: await binding.resolveInteractor(input.execution, input.appBundleId),
-        positionals: input.positionals,
-      });
-    },
-    finalizeApplicationClose: async () => ({}),
     prepareAppleRunner: async () => {
       throw new AppError('UNSUPPORTED_OPERATION', 'Fake provider does not prepare Apple runners.');
     },
```

**File**: `test/integration/provider-scenarios/provider-device-runtime.test.ts` (modified, +32/-0)
```diff
@@ -89,6 +89,38 @@ test('provider-owned iOS simulators relaunch without local CoreSimulator refresh
   );
 });
 
+test('provider-owned relaunch refuses launch-console without closing the running app', async () => {
+  await withProviderScenarioResource(
+    async () => await createFakeProviderWorld('ios'),
+    async ({ daemon, runtime }) => {
+      const lease = await allocateIosFakeProviderLease(daemon);
+      const flags = iosLeaseFlags(lease.leaseId);
+      const options = { meta: iosLeaseMeta(lease.leaseId) };
+      assertRpcOk(await daemon.callCommand('open', ['com.example.demo'], flags, options));
+      const before = runtime.calls.length;
+      const error = assertRpcError(
+        await daemon.callCommand(
+          'open',
+          ['com.example.demo'],
+          { ...flags, relaunch: true, launchConsole: '/tmp/app.log' },
+          options,
+        ),
+        500,
+        'UNSUPPORTED_OPERATION',
+        /local iOS simulator/,
+      );
+      assert.equal(
+        (error.details as Record<string, unknown>).reason,
+        'launch-console-owner-unadmitted',
+      );
+      assert.deepEqual(
+        runtime.calls.slice(before).filter((call) => call.type === 'open' || call.type === 'close'),
+        [],
+      );
+    },
+  );
+});
+
 test('provider lease allocation is refused when no registered runtime claims the provider', async () => {
   const daemon = await createProviderScenarioHarness({
     providerRuntimeIds: [FAKE_PROVIDER],
```

**File**: `website/docs/docs/client-api.md` (modified, +2/-2)
```diff
@@ -66,8 +66,8 @@ This example opens an app, takes a snapshot, interacts, handles typed errors, an
 
 `client.devices.capabilities()` returns `{ device, availableCommands }`, using the same capability matrix as the CLI. Use it to check which command names the selected target supports.
 
-For direct iOS simulator app launches, `client.apps.open({ app, platform: 'ios', launchConsole: './artifacts/app.console.log' })` captures launch-time
-stdout/stderr. The option mirrors `open --launch-console` and is not valid for URL opens or non-simulator targets.
+For direct local iOS simulator app launches, `client.apps.open({ app, platform: 'ios', launchConsole: './artifacts/app.console.log' })` captures launch-time
+stdout/stderr. The option mirrors `open --launch-console` and is not valid for URL opens, provider-owned simulators, or non-simulator targets.
 
 `client.sessions.stateDir()` mirrors `session state-dir` and returns the resolved daemon state directory without starting
 or contacting the daemon. Pass `{ stateDir }` to resolve an explicit override the same way the CLI resolves `--state-dir`.
```

**File**: `website/docs/docs/commands.md` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ Open apps and links:
 - `open [app|url] [url]` boots the selected device when needed and opens the target in a session. `open <url>` opens deep links on Android and iOS, and `open <app> <url>` opens a deep link in that app on iOS. See [Desktop targets](#desktop-targets) for macOS activation behavior.
 - On iOS devices, `http(s)://` URLs open in Safari when no app is active. Custom-scheme URLs need an active app in the session.
 - `open <app> --wait <ms>` waits up to that budget for a device another session holds, then fails with `DEVICE_IN_USE`. The wait extends the command's timeout, so you don't need a longer `--timeout`. A claim held by another workspace's daemon is not waited for; `open` returns its recovery command at once. Device-mutating commands like `install` and `reinstall` never wait either: a claim held by another session fails them at once, and when the caller sends a workspace, another workspace's claim under the same session name fails too. See [Sessions](/docs/sessions#wait-for-a-slow-or-busy-device).
-- `open <app> --launch-console <path>` captures launch-time stdout/stderr for iOS simulator app launches. It is not valid for URL opens or other targets.
+- `open <app> --launch-console <path>` captures launch-time stdout/stderr for local iOS simulator app launches. It is not valid for URL opens or other targets.
 - `open --platform macos --surface app|frontmost-app|desktop|menubar` selects the macOS session surface; `app` is the default when you name an app. See [Desktop targets](#desktop-targets). `--save-script` records the surface so `replay` reopens it; with no surface given, replay opens an app session.
 - Android React Native: `open --relaunch` needs an installed package name. Install or reinstall the APK first; `open <apk|aab> --relaunch` is rejected. For Metro-backed JS changes, run `metro reload` before reaching for `open <app> --relaunch`.
 - Android (adb): an intent target such as `open settings` records the package that opened as `appBundleId`. `open settings --relaunch` stops and restarts that app. If the intent matches more than one activity, `--relaunch` fails.
```

#### Recent Merged Pull Requests:
- **PR #4014** (2026-10-28): fix(fill): redact the read-back of a sensitive fill (@thymikee)
- **PR #4011** (2026-10-28): docs(mutation): state the file-name rule that marks test support code (@thymikee)
- **PR #4010** (2026-10-28): docs: point stable test suites to e2e (@thymikee)
- **PR #4008** (2026-10-28): fix(apple): type a text-entry-trait element as a text input in the simulator AX tree (@kacperkapusciak)
- **PR #4006** (2026-10-28): fix(ios): match alert labels through the OS prompt strings of the preferred languages (@kazutoyo)
- **PR #4003** (2026-10-28): refactor(apple): share coordinate drag execution (@thymikee)

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

## X. mutation): measure each kernel against the tests that import it (#3994)

**RULE**:
When implementing operations in `.github/workflows/mutation-affected.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ff8029e9`: mutation): measure each kernel against the tests that import it (#3994). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/mutation-affected.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
# owns (scripts/mutation/ownership.ts): a kernel source, or a test that
# imports one. Selected modules are sharded like the
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
# reaches through the import graph (scripts/mutation/ownership.ts): a kernel
# source, or a test that reaches one. Selected modules are sharded like the
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ff8029e9` are properly handled with clean fallback behavior.
