# Forensic Learning Record (Deep Inspection): callstack/agent-device

> **Canonical Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:16:16.270Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Mobile app automation and verification for AI coding agents. CLI, MCP server, and typed Node.js API for iOS, Android, HarmonyOS, TV, web, macOS, and Linux.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4894 stars

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
const BARE_SCRIPT_TOKEN_RE = /^[^\s"\\]+$/;

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
  const positionals = action.positionals ?? [];
  const first = positionals[0];
  if (first === undefined) return [];
  if (first.startsWith('@')) return [first];
  if (
    positionals.length >= 3 &&
    NUMERIC_ARG_RE.test(first) &&
    NUMERIC_ARG_RE.test(positionals[1] ?? '')
  ) {
    return [first, positionals[1]!];
  }
  return [first];
}

// fallow-ignore-next-line complexity
export function appendScriptSeriesFlags(
  parts: string[],
  action: Pick<SessionAction, 'command' | 'flags'>,
): void {
  const flags = action.flags ?? {};
  if (isClickLikeCommand(action.command)) {
    if (typeof flags.count === 'number') parts.push('--count', String(flags.count));
    if (typeof flags.intervalMs === 'number') parts.push('--interval-ms', String(flags.intervalMs));
    if (typeof flags.holdMs === 'number') parts.push('--hold-ms', String(flags.holdMs));
    if (typeof flags.jitterPx === 'number') parts.push('--jitter-px', String(flags.jitterPx));
    if (flags.doubleTap === true) parts.push('--double-tap');
    const clickButton = flags.clickButton;
    if (clickButton && clickButton !== 'primary') {
      parts.push('--button', clickButton);
    }
    return;
  }
  if (action.command === 'swipe') {
    if (typeof flags.count === 'number') parts.push('--count', String(flags.count));
    if (typeof flags.pauseMs === 'number') parts.push('--pause-ms', String(flags.pauseMs));
    if (flags.pattern === 'one-way' || flags.pattern === 'ping-pong') {
      parts.push('--pattern', flags.pattern);
    }
    return;
  }
  if (action.command === 'gesture') {
    if (typeof flags.pointerCount === 'number') {
      parts.push('--pointer-count', String(flags.pointerCount));
    }
    return;
  }
  if (isTypingCommand(action.command) && typeof flags.delayMs === 'number') {
    parts.push('--delay-ms', String(flags.delayMs));
  }
}

export function appendRuntimeHintFlags(
  parts: string[],
  flags: Pick<SessionAction, 'flags'>['flags'] | SessionRuntimeHints | undefined,
): void {
  if (!flags) return;
  if (isScriptRuntimePlatform(flags.platform)) {
    parts.push('--platform', flags.platform);
  }
  if (typeof flags.metroHost === 'string' && flags.metroHost.length > 0) {
    parts.push('--metro-host', formatScriptArgQuoteIfNeeded(flags.metroHost));
  }
  if (typeof flags.metroPort === 'number') {
    parts.push('--metro-port', String(flags.metroPort));
  }
  if (typeof flags.bundleUrl === 'string' && flags.bundleUrl.length > 0) {
    parts.push('--bundle-url', formatScriptArgQuoteIfNeeded(flags.bundleUrl));
  }
  if (typeof flags.launchUrl === 'string' && flags.launchUrl.length > 0) {
    parts.push('--launch-url', formatScriptArgQuoteIfNeeded(flags.launchUrl));
  }
}

export function appendRecordActionScriptArgs(parts: string[], action: SessionAction): void {
  const [subcommand, ...rest] = action.positionals ?? [];
  if (subcommand) {
    parts.push(formatScriptArgQuoteIfNeeded(subcommand));
  }
  for (const positional of rest) {
    parts.push(formatScriptArg(positional));
  }
  if (typeof action.flags?.fps === 'number') {
    parts.push('--fps', String(action.flags.fps));
  }
  if (typeof action.flags?.quality === 'number' || typeof action.flags?.quality === 'string') {
    parts.push('--quality', String(action.flags.quality));
  }
  if (action.flags?.hideTouches) {
    parts.push('--hide-touches');
  }
}

export function appendSnapshotActionScriptArgs(parts: string[], action: SessionAction): void {
  if (action.flags?.snapshotInteractiveOnly) parts.push('-i');
  if (typeof action.flags?.snapshotDepth === 'number') {
    parts.push('-d', String(action.flags.snapshotDepth));
  }
  if (action.flags?.snapshotScope) {
    parts.push('-s', formatScriptArg(action.flags.snapshotScope));
  }
  if (action.flags?.snapshotRaw) parts.push('--raw');
}

export function appendScreenshotActionScriptArgs(parts: string[], action: SessionAction): void {
  for (const positional of action.positionals ?? []) {
    parts.push(formatScriptArg(positional));
  }
  const cropOn = action.flags?.screenshotCropOn;
  if (typeof cropOn === 'string' && cropOn.length > 0) {
    parts.push('--crop-on', formatScriptArgQuoteIfNeeded(cropOn));
  }
  appendScreenshotScriptFlags(parts, action.flags);
}

export function appendRuntimeActionScriptArgs(
  parts: string[],
  action: SessionAction,
  options: { includeAllPositionals?: boolean } = {},
): void {
  const positionals = action.positionals ?? [];
  const selectedPositionals = options.includeAllPositionals ? positionals : positionals.slice(0, 1);
  for (const positional of selectedPositionals) {
    parts.push(formatScriptArgQuoteIfNeeded(positional));
  }
  appendRuntimeHintFlags(parts, action.flags);
}

export function appendGenericActionScriptArgs(parts: string[], action: SessionAction): void {
  for (const positional of action.positionals ?? []) {
    // wait @ref: recorded refs may carry a `~s<generation>` pin (#1076);
    // scripts store the plain ref (see stripRecordedRefGeneration).
    parts.push(
      formatScriptArg(
        action.command === 'wait' ? stripRecordedRefGeneration(positional) : positional,
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

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/conformance-harness.ts`
```
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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
  presentation: ReturnType<typeof presentIosSna
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
  };
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

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/geometry-policy.ts`
```
import type { Rect, RawSnapshotNode } from '@agent-device/kernel/snapshot';
import { isPositiveFiniteRect, rectContains } from '@agent-device/kernel/rect';
import { normalizeType } from '@agent-device/contracts/snapshot';
import { collectChildrenByParent, collectSubtreeByParentLinks } from './tree.ts';
import type { IosSnapshotFoldPolicy } from './types.ts';

const SCROLL_CONTAINER_TYPES = new Set(['collectionview', 'scrollview', 'table']);
const VISIBILITY_CARRIER_TYPES = new Set(['application', 'window']);
const NEGLIGIBLE_DECORATION_TOLERANCE = 1;

/**
 * Private UIKit classes are matched by exact name, unlike the substring role tests the occlusion
 * pass uses: this rule decides node membership, so a near miss on a class name has to fail closed
 * rather than widen the cut.
 */
const PRESENTATION_CONTAINER_ROLE = 'uitransitionview';
const PRESENTATION_DIMMING_ROLE = 'uidimmingview';

export type TraversalState = Readonly<{
  projectedOut: boolean;
  ancestorClip?: Rect;
}>;

export type BranchState = Readonly<{
  traversal: TraversalState;
  anchor?: { index: number; rect: Rect };
  keptIndex?: number;
  keptDepth: number;
}>;

export type GeometryDecision = Readonly<{
  isIncluded: boolean;
  descendants: TraversalState;
  effectiveRect?: Rect;
  hiddenContentFrame?: Rect;
  establishesScrollAnchor: boolean;
}>;

export function rootTraversal(): TraversalState {
  return { projectedOut: false };
}

export function traversalDecision(
  node: RawSnapshotNode,
  parentTraversal: TraversalState,
  viewport: Rect,
  interactiveOnly: boolean,
  hasChildren: boolean,
  policy: IosSnapshotFoldPolicy,
): GeometryDecision {
  const ancestorClip = policy === 'cursor-projected' ? parentTraversal.ancestorClip : undefined;
  const effectiveRect = effectiveSnapshotRect(node.rect, viewport, ancestorClip);
  const hasFrame = isPositiveFiniteRect(normalizeRect(node.rect));
  const intersectsClip = isPositiveFiniteRect(effectiveRect);
  const type = normalizeType(node.type ?? '');
  const projectedOut = descendantsProjectedOut(
    policy,
    parentTraversal.projectedOut,
    hasFrame,
    intersectsClip,
    type,
    hasChildren,
  );
  const visible =
    presentationVisible(policy, parentTraversal.projectedOut, hasFrame, intersectsClip) &&
    !isNegligibleDecoration(node, hasFrame, policy);
  const isIncluded = shouldInclude(node, visible, interactiveOnly, policy);
  const establishesScrollAnchor = ownsScrollAnchor(type, isIncluded, intersectsClip, hasChildren);
  const hiddenFrame = hiddenContentFrame(
    policy,
    parentTraversal.projectedOut,
    hasFrame,
    intersectsClip,
    node,
  );
  return {
    isIncluded,
    descendants: descendantTraversal(
      policy,
      projectedOut,
      ancestorClip,
      effectiveRect,
      establishesScrollAnchor,
    ),
    effectiveRect,
    ...(hiddenFrame ? { hiddenContentFrame: hiddenFrame } : {}),
    establishesScrollAnchor,
  };
}

function effectiveSnapshotRect(
  reportedRect: Rect | undefined,
  viewport: Rect,
  ancestorClip?: Rect,
): Rect | undefined {
  const normalized = normalizeRect(reportedRect);
  if (!normalized) return undefined;
  let effective = intersectRect(normalized, viewport);
  if (ancestorClip) effective = intersectRect(effective, ancestorClip);
  return effective;
}

function descendantsProjectedOut(
  policy: IosSnapshotFoldPolicy,
  parentProjectedOut: boolean,
  hasFrame: boolean,
  intersectsClip: boolean,
  type: string,
  hasChildren: boolean,
): boolean {
  if (policy === 'plain-viewport') return !intersectsClip;
  return parentProjectedOut || (hasFrame && !intersectsClip && ownsDescendants(type, hasChildren));
}

function presentationVisible(
  policy: IosSnapshotFoldPolicy,
  parentProjectedOut: boolean,
  hasFrame: boolean,
  intersectsClip: boolean,
): boolean {
  if (policy === 'plain-viewport') return intersectsClip;
  return !parentProjectedOut && (!hasFrame || intersectsClip);
}

function isNegligibleDecoration(
  node: RawSnapshotNode,
  hasFrame: boolean,
  policy: IosSnapshotFoldPolicy,
): boolean {
  if (
    policy !== 'cursor-projected' ||
    node.parentIndex === undefined ||
    hasSemanticContent(node) ||
    !hasFrame
  ) {
    return false;
  }
  return (
    normalizedRectWidth(node.rect) <= NEGLIGIBLE_DECORATION_TOLERANCE ||
    normalizedRectHeight(node.rect) <= NEGLIGIBLE_DECORATION_TOLERANCE
  );
}

function descendantTraversal(
  policy: IosSnapshotFoldPolicy,
  projectedOut: boolean,
  ancestorClip: Rect | undefined,
  effectiveRect: Rect | undefined,
  establishesScrollAnchor: boolean,
): TraversalState {
  return {
    projectedOut,
    ...(policy === 'cursor-projected' && establishesScrollAnchor
      ? { ancestorClip: effectiveRect }
      : { ancestorClip }),
  };
}

function hiddenContentFrame(
  policy: IosSnapshotFoldPolicy,
  parentProjectedOut: boolean,
  hasFrame: boolean,
  intersectsClip: boolean,
  node: RawSnapshotNode,
): Rect | undefined {
  if (policy !== 'cursor-projected' || parentProjectedOut || !hasFrame || intersectsClip) {
    return undefined;
  }
  return normalizeRect(node.rect);
}

function ownsDescendants(type: string, hasChildren: boolean): boolean {
  return hasChildren && (type === 'cell' || SCROLL_CONTAINER_TYPES.has(type));
}

function ownsScrollAnchor(
  type: string,
  isIncluded: boolean,
  intersectsClip: boolean,
  hasChildren: boolean,
): boolean {
  return isIncluded && intersectsClip && hasChildren && SCROLL_CONTAINER_TYPES.has(type);
}

function shouldInclude(
  node: RawSnapshotNode,
  visible: boolean,
  interactiveOnly: boolean,
  policy: IosSnapshotFoldPolicy,
): boolean {
  if (node.parentIndex === undefined) return true;
  const type = normalizeType(node.type ?? '');
  if (policy === 'plain-viewport' && interactiveOnly && !visible && type !== 'application') {
    return false;
  }
  return VISIBILITY_CARRIER_TYPES.has(type) || visible;
}

function hasSemanticContent(node: RawSnapshotNode): boolean {
  return [node.label, node.identifier, node.value].some(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
}

function normalizeRect(rect: Rect | undefined): Rect | undefined {
  if (!rect) return undefined;
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return undefined;
  if (rect.width < 0 || rect.height < 0) return undefined;
  return { ...rect, width: Math.max(0, rect.width), height: Math.max(0, rect.height) };
}

function normalizedRectWidth(rect: Rect | undefined): number {
  return normalizeRect(rect)?.width ?? 0;
}

function normalizedRectHeight(rect: Rect | undefined): number {
  return normalizeRect(rect)?.height ?? 0;
}

function intersectRect(left: Rect, right: Rect): Rect {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  if (rightEdge <= x || bottomEdge <= y) {
    return { x: left.x, y: left.y, width: 0, height: 0 };
  }
  return {
    x: rightEdge > x ? x : left.x,
    y: bottomEdge > y ? y : left.y,
    width: rightEdge - x,
    height: bottomEdge - y,
  };
}

type CoveringPresentation = Readonly<{
  container: RawSnapshotNode;
  dimmingRect: Rect;
}>;

/**
 * UIKit appends each modal presentation as a later sibling of the container it presents over,
 * dims the content behind it with a dimming view that is a direct child of the presentation
 * container, and the host accessibility snapshot reports siblings in that subview order. A
 * presenting container carries only a drop shadow, so a direct-child dimming view separates a
 * modal presentation from an ordinary container, and its dimmed area says which earlier
 * presentation the user can no longer reach. A sheet resting at an undimmed detent keeps that
 * dimming view with user interaction disabled and touches reach the content under it, so the
 * rule asserts containment only when the producer states the dimming view takes touches.
 *
 * Producers that report no UIKit class names or no `userInteractionEnabled` — the XCTest runner,
 * whose own queries already omit modal-contained content — never trigger this rule.
 */
export function collectModalContainedIndexes(
  nodes: readonly RawSnapshotNode[],
): ReadonlySet<number> {
  const childrenByParent = collectChildrenByParent(nodes);
  const contained = new Set<number>();
  for (const siblings of childrenByParent.values()) {
    const covering = findCoveringPresentation(siblings, childrenByParent);
    if (!covering) continue;
    for (const sibling of siblings.slice(0, -1)) {
      if (!isDimmedByPresentation(covering, sibling)) continue;
      contained.add(sibling.index);
      for (const descendant of collectSubtreeByParentLinks(sibling, childrenByParent)) {
        contained.add(descendant.index);
      }
    }
  }
  return contained;
}

function findCoveringPresentation(
  siblings: readonly RawSnapshotNode[],
  childrenByParent: ReadonlyMap<number, RawSnapshotNode[]>,
): CoveringPresentation | undefined {
  const last = siblings.at(-1);
  if (!last || !isPresentationContainer(last)) return undefined;
  const dimming = (childrenByParent.get(last.index) ?? []).find(isPresentationDimmingView);
  if (dimming?.userInteractionEnabled !== true || !isPositiveFiniteRect(dimming.rect)) {
    return undefined;
  }
  return { container: last, dimmingRect: dimming.rect };
}

function isDimmedByPresentation(covering: CoveringPresentation, sibling: RawSnapshotNode): boolean {
  return (
    isPresentationContainer(sibling) &&
    isPositiveFiniteRect(sibling.rect) &&
    rectContains(covering.dimmingRect, sibling.rect)
  );
}

function isPresentationContainer(node: RawSnapshotNode): boolean {
  return hasRole(node, PRESENTATION_CONTAINER_ROLE);
}

function isPresentationDimmingView(node: RawSnapshotNode): boolean {
  return hasRole(node, PRESENTATION_DIMMING_ROLE);
}

function hasRole(node: RawSnapshotNode, role: string)
```

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/geometry.ts`
```
import type { Rect, RawSnapshotNode } from '@agent-device/kernel/snapshot';
import { isGeometricallyActionable } from '@agent-device/kernel/rect';
import { validateIosSnapshotGraph } from './graph.ts';
import {
  collectModalContainedIndexes,
  rootTraversal,
  traversalDecision,
  type BranchState,
  type GeometryDecision,
} from './geometry-policy.ts';
import type {
  IosSnapshotFoldOptions,
  IosSnapshotFoldPolicy,
  IosSnapshotPresentationNode,
  IosSnapshotPresentationStats,
} from './types.ts';

export function foldIosSnapshot(
  nodes: readonly RawSnapshotNode[],
  viewport: Rect,
  interactiveOnly: boolean,
  policy: IosSnapshotFoldPolicy,
  options: IosSnapshotFoldOptions = {},
): { nodes: IosSnapshotPresentationNode[]; stats: IosSnapshotPresentationStats } {
  validateIosSnapshotGraph(nodes);
  const modalContained = collectModalContainedIndexes(nodes);
  const presentable = nodes.filter((node) => !modalContained.has(node.index));
  const hasChildren = buildChildPresence(presentable);
  const states = new Map<number, BranchState>();
  const kept: IosSnapshotPresentationNode[] = [];
  const hints = new Map<number, { above: boolean; below: boolean }>();
  let parentClipLookups = 0;

  for (const node of presentable) {
    const parentState = readParentState(node, states, () => {
      parentClipLookups += 1;
    });
    const parentTraversal = parentState?.traversal ?? rootTraversal();
    const parentAnchor = policy === 'cursor-projected' ? parentState?.anchor : undefined;
    const decision = traversalDecision(
      node,
      parentTraversal,
      viewport,
      interactiveOnly,
      hasChildren.has(node.index),
      policy,
    );

    recordHiddenContentHint(decision, parentAnchor, hints);
    const foldedNode = appendFoldedNode(node, decision, parentState, kept, viewport, options);
    const anchor = nextScrollAnchor(decision, parentAnchor, foldedNode.keptIndex);
    states.set(node.index, {
      traversal: decision.descendants,
      anchor,
      keptIndex: foldedNode.keptIndex,
      keptDepth: foldedNode.keptDepth,
    });
  }

  const presented = applyHiddenContentHints(hints, kept);
  return {
    nodes: presented,
    stats: {
      presentedNodeCount: presented.length,
      sourceNodeCount: nodes.length,
      parentClipLookups,
      modalContainedNodeCount: modalContained.size,
    },
  };
}

function buildChildPresence(nodes: readonly RawSnapshotNode[]): Set<number> {
  const parents = new Set<number>();
  for (const node of nodes) {
    if (node.parentIndex !== undefined) parents.add(node.parentIndex);
  }
  return parents;
}

function readParentState(
  node: RawSnapshotNode,
  states: ReadonlyMap<number, BranchState>,
  onLookup: () => void,
): BranchState | undefined {
  if (node.parentIndex === undefined) return undefined;
  onLookup();
  return states.get(node.parentIndex);
}

function recordHiddenContentHint(
  decision: GeometryDecision,
  parentAnchor: BranchState['anchor'],
  hints: Map<number, { above: boolean; below: boolean }>,
): void {
  if (decision.hiddenContentFrame && parentAnchor) {
    rememberHiddenContentHint(decision.hiddenContentFrame, parentAnchor, hints);
  }
}

function appendFoldedNode(
  node: RawSnapshotNode,
  decision: GeometryDecision,
  parentState: BranchState | undefined,
  kept: IosSnapshotPresentationNode[],
  viewport: Rect,
  options: IosSnapshotFoldOptions,
): { keptIndex?: number; keptDepth: number } {
  let keptIndex = parentState?.keptIndex;
  let keptDepth = parentState?.keptDepth ?? -1;
  if (!decision.isIncluded) return { keptIndex, keptDepth };

  const index = kept.length;
  keptDepth += 1;
  const { hittable: sourceHittable, ...sourceNode } = node;
  kept.push({
    raw: {
      ...sourceNode,
      index,
      depth: keptDepth,
      parentIndex: keptIndex,
      ...foldedHittability(
        sourceHittable,
        node.parentIndex !== undefined,
        decision.effectiveRect,
        node.enabled !== false,
        viewport,
        options,
      ),
    },
    sourceIndex: node.index,
    ...(decision.effectiveRect ? { effectiveRect: decision.effectiveRect } : {}),
  });
  keptIndex = index;
  return { keptIndex, keptDepth };
}

function foldedHittability(
  sourceHittable: RawSnapshotNode['hittable'],
  hasParent: boolean,
  effectiveRect: Rect | undefined,
  enabled: boolean,
  viewport: Rect,
  options: IosSnapshotFoldOptions,
): Partial<Pick<RawSnapshotNode, 'hittable'>> {
  if (options.hittabilityAvailable === false) {
    return sourceHittable === false || !enabled ? { hittable: false } : {};
  }
  return {
    hittable:
      hasParent &&
      sourceHittable === true &&
      isGeometricallyActionable(enabled, effectiveRect, viewport),
  };
}

function nextScrollAnchor(
  decision: GeometryDecision,
  parentAnchor: BranchState['anchor'],
  keptIndex: number | undefined,
): BranchState['anchor'] {
  if (decision.establishesScrollAnchor && keptIndex !== undefined && decision.effectiveRect) {
    return { index: keptIndex, rect: decision.effectiveRect };
  }
  return parentAnchor;
}

function rememberHiddenContentHint(
  frame: Rect,
  anchor: { index: number; rect: Rect },
  hints: Map<number, { above: boolean; below: boolean }>,
): void {
  const hint = hints.get(anchor.index) ?? { above: false, below: false };
  if (frame.y + frame.height <= anchor.rect.y) hint.above = true;
  else if (frame.y >= anchor.rect.y + anchor.rect.height) hint.below = true;
  hints.set(anchor.index, hint);
}

function applyHiddenContentHints(
  hints: ReadonlyMap<number, { above: boolean; below: boolean }>,
  nodes: IosSnapshotPresentationNode[],
): IosSnapshotPresentationNode[] {
  return nodes.map((presentation) => {
    const hint = hints.get(presentation.raw.index);
    if (!hint) return presentation;
    const node = presentation.raw;
    return {
      ...presentation,
      raw: {
        ...node,
        hiddenContentAbove: node.hiddenContentAbove === true || hint.above ? true : undefined,
        hiddenContentBelow: node.hiddenContentBelow === true || hint.below ? true : undefined,
      },
    };
  });
}

```

### Core Architecture Module: `packages/capture-kit/src/ios-snapshot-engine/graph.ts`
```
import type { RawSnapshotNode } from '@agent-device/kernel/snapshot';
import { IosSnapshotEngineError } from './types.ts';

export function validateIosSnapshotGraph(nodes: readonly RawSnapshotNode[]): void {
  const positions = new Map<number, number>();
  for (const [position, node] of nodes.entries()) {
    if (!Number.isInteger(node.index) || node.index < 0 || positions.has(node.index)) {
      throw new IosSnapshotEngineError(
        'malformed-graph',
        'iOS snapshot graph contains a duplicate or invalid node index',
        { index: node.index },
      );
    }
    positions.set(node.index, position);
    if (node.depth !== undefined && (!Number.isInteger(node.depth) || node.depth < 0)) {
      throw new IosSnapshotEngineError(
        'malformed-graph',
        'iOS snapshot graph contains an invalid node depth',
        { index: node.index, field: 'depth' },
      );
    }
  }

  for (const [position, node] of nodes.entries()) {
    if (node.parentIndex === undefined) continue;
    const parentPosition = positions.get(node.parentIndex);
    if (parentPosition === undefined || parentPosition >= position) {
      throw new IosSnapshotEngineError(
        'malformed-graph',
        'iOS snapshot graph parent must precede its child',
        { index: node.index, parentIndex: node.parentIndex },
      );
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3183** (2026-10-05): **Drag reports a ref-frame refusal as dispatched: 'unknown' although nothing was sent**
  *Symptoms*: ## Problem  A drag whose `@ref` the ref frame refuses is reported as `dispatched: 'unknown'`, although the refusal happens before the gesture. [`prepareDragTarget`](https://github.com/callstack/agent-device/blob/be3c8104dd/src/daemon/interaction/internal/interaction-gesture.ts#L278-L296) throws the admission refusal (`ref_frame_expired`, `ref_generation_mismatch`, `plain_ref_requires_complete_frame`, `ref_not_issued`) with no disclosure. `gesture` is `mutates-app`, so the request router fills in `unknown` ([`disclosedDetails`](https://github.com/callstack/agent-device/blob/be3c8104dd/src/daemon/request-dispatch-disclosure.ts#L42-L55)).  Live on 0.21.20 (iOS 26.2 simulator, Settings): `snapshot`, `press` on one row, then `drag` with two refs from that snapshot:  ```json { "code": "COMMAND_FAILED", "reason": "ref_frame_expired", "dispatched": "unknown" } ```  The same refusal on `press` reports `dispatched: 'no'` (`refusedBeforeDispatch` in press admission).  Consumer impact: tester-army/e2e retries a stale ref as `NODE_STALE` only when nothing reached the device. It cannot key that retry on `dispatched === 'no'`, because a stale drag would then stop being retried. It keys on the reason alone instead (tester-army/e2e PR linked below).  ## Required behavior  - `prepareDragTarget` refusals report `dispatched: 'no'` (`thrownBeforeDispatch`). - Decide the Android blocking-dialog abort in [`interaction-touch-android-readiness.ts`](https://github.com/callstack/agent-device/blob/be3c8

- **Issue #3177** (2026-10-05): **Client timeout recovery ends sibling sessions: host-wide runner sweep on every timeout, daemon reset on shared daemons**
  *Symptoms*: ## Problem  A client-side request timeout recovers by acting on the whole host, not on the request that timed out. When one daemon serves several sessions, one slow request ends the others.  - **The runner sweep runs on every local timeout.** [`handleRequestTimeout`](https://github.com/callstack/agent-device/blob/be3c8104dd/src/daemon-client/daemon-client-timeout.ts#L70) calls [`cleanupTimedOutIosRunnerBuilds`](https://github.com/callstack/agent-device/blob/be3c8104dd/src/daemon-client/daemon-client-timeout.ts#L165-L179) before it checks the command's timeout policy. The sweep runs `pkill -f` with patterns that match every agent-device runner `xcodebuild` on the host: other sessions, other daemons, other workspaces. A timed-out `snapshot`, whose policy is `preserve-daemon`, still kills every runner. - **Reset-policy commands kill the shared daemon.** `open`, `back`, `scroll`, `settings` and the other commands on [`DEFAULT_TIMEOUT_POLICY`](https://github.com/callstack/agent-device/blob/be3c8104dd/packages/command-registry/src/timeout-policy.ts#L44-L48) SIGKILL the daemon ([`resetDaemonAfterTimeout`](https://github.com/callstack/agent-device/blob/be3c8104dd/src/daemon-client/daemon-client-timeout.ts#L181-L195)), which ends every session it owns.  Consumer impact: tester-army/e2e runs one session per worker slot on one local daemon. A cold iOS runner outlasted the 90 s `open` envelope, and the reset ended the sibling worker's session ([tester-army/e2e#627](https://github.com/tes
  **Post-Mortem & Fix Analysis**:
  > #3116 and #3127 are landed in main (`2212eacf5b`). They fix retirement identity, lock exclusion and metadata/report cleanup authority; they do not fix the recovery scope described here. This remains the explicit timeout-cleanup follow-up.  The per-call AbortSignal transport from #3200 is also landed. It closes the caller's connection and preserves typed cancellation, including abort during restart-health probing, without timeout retirement. Reuse that request-scoped boundary when designing recovery; daemon/process identity alone does not authorize disrupting other sessions.  The #3116 audit independently confirmed the host-wide pkill/shared-daemon-reset behavior in code. Its audit did not reproduce interruption of a concurrent recording export; retain the existing tester-army evidence with its original attribution. Add a pending-recording-export case alongside the existing two-session completion criteria: another request's timeout must leave the export and unrelated runner alive. Recor

- **Issue #3176** (2026-10-05): **fix(android): read the package from binary manifests at the spec attribute offset, and search the macOS SDK root**
  *Symptoms*: ## Problem  `install` and `reinstall` of an APK cannot name the package when the install adds no new package (the app was already on the device) and `aapt` is not found. The caller then has nothing to open. tester-army/e2e works around it ([tester-army/e2e#711](https://github.com/tester-army/e2e/pull/711)) and documents it as a known limitation in its `docs/mobile.mdx` troubleshooting section.  Two defects combine:  1. **The binary manifest parser reads the attributes 16 bytes early.** [`manifest.ts:109`](https://github.com/callstack/agent-device/blob/be3c8104dd/packages/platform-android/src/manifest.ts#L109) computes `chunkOffset + attributeStart`. In the ResXMLTree format, `attributeStart` is relative to `ResXMLTree_attrExt`, which starts after the node header (`headerSize`, 16 bytes). The attribute array starts at `chunkOffset + headerSize + attributeStart` ([AOSP ResourceTypes.h](https://android.googlesource.com/platform/frameworks/native/+/b76dd6c566a0eeaf0a1f01b0c4e2992ad7451091/include/utils/ResourceTypes.h)). A probe on two real APKs (the `examples/test-app` dev-client build and an RN 0.83 debug build) finds no `package` attribute at the current offset, and finds `com.callstack.agentdevicelab` and `com.rncli83` at the spec offset. So the in-process parser never succeeds on a real APK, and every call falls back to `aapt`. No unit test covers the binary path. 2. **The `aapt` fallback misses the macOS default SDK.** [`resolveAndroidSdkRoots`](https://github.com/callstack

- **Issue #3096** (2026-10-02): **open --launch-url: a post-open target discovery that fails on its deadline must not skip the launch confirmation read**
  *Symptoms*: Part of #3069. Follow-up to #3084.  ## What happens  On an iOS Simulator, `open <app> --launch-url <url>` reads the "Open in <app>?" sheet only when the post-open observation is `unobservable`. The observation resolves the app's bridge target first (`resolveLaunchedTarget`, `packages/platform-apple/src/snapshot-observability.ts`): an app with no running process is `unobservable` (the held launch), a discovery still running is joined, and **every other resolution failure is `probe-failed`**, which skips the read. Target discovery has its own 15 s deadline (`TARGET_DISCOVERY_TIMEOUT_MS`, `snapshot-target.ts`) over `simctl spawn launchctl list` and the runtime probe. On a slow host those probes exceed it, the discovery fails with `simulator-target-probe-failed` or a timeout, the verdict is `probe-failed`, and the sheet is never read: `open` returns success without `launchConfirmation`, the app never launches, and every later command fails `app 'com.callstack.agentdevicelab' is not running`.  Evidence: - CI run 36848770736 (#3084 at `dcffeaf1fc`, `smoke:automation-input`): the runner session was ready (served a snapshot at 10:36:36); during the deep-link open (10:36:46–10:37:05) `runner.log` shows only `targetReset`, no `alert` command; the step screenshot shows the sheet still up; the five waits that followed logged `simulator-target-discovery-pending` / `simulator-target-unavailable`. - The #3084 live run on the maintainer's host (comment of 2026-10-01 09:01Z, second fresh run)

- **Issue #2965** (2026-09-28): **fix(apple-runner): inline status probes must not clear outstanding command charges**
  *Symptoms*: ## Problem  ## Deletion-first acceptance  This is part of #2803's simplify-and-shrink initiative. Before production simplification, name the production mechanism, duplicated decision, state, fallback, forwarding layer, or public/internal interface this change removes. Compare deletion and inlining against extraction. Moving the same state into another file is not a deletion case.  Every PR reports baseline/final SHAs; added, deleted and net production lines; test/fixture/documentation changes separately; and the exact mechanisms removed. Use a rename-aware diff (`git diff --numstat -M BASE...HEAD`) and account for all affected production paths, including destination packages. Moving tests out of production files, generated output, formatting churn, and moving code elsewhere are not production-code deletion. Preserve readable code; no compressed formatting to hit a number.  Default for simplification work: net production reduction. A required behavior-preserving size split may be line-neutral. Growth needs an explicit, quantified explanation of the correctness or type guarantee it buys, why deletion/inlining cannot achieve it, and what old mechanism is removed; it is not automatically acceptable because ownership looks cleaner. If the only benefit is relocating fields or adding a wrapper, defer the change. Required regression tests and a minimal correctness fix are allowed to grow without inventing unrelated deletion to offset them.  ## Priority and scope gate  Priority: first
  **Post-Mortem & Fix Analysis**:
  > Fixed by #2994: an inline status probe no longer clears an outstanding command charge.

- **Issue #2935** (2026-09-25): **Refuse the XCTestDevices redirect when an Xcode xcrun shim (simctl or devicectl) has an armed first-launch hook: scoped simulator set deletion**
  *Symptoms*: ## Purpose  **Bug class: agent-device points `~/Library/Developer/XCTestDevices` at a user-owned simulator set while Apple's first-launch cleanup can run. That cleanup deletes every device in the user's set (data loss).**  Found while validating #2917 (see the #2878 evidence, "Live: scoped simulator set"). Reproduced on origin/main `dbc08a417a`, re-checked on `2db7c42a8b` and `6428c54853`. The code has not changed.  What happens (watcher log `2878b-watch.log`, request log `2878b-state-main/sessions/s2878bm/requests/*.ndjson`):  1. A cold `open com.apple.Preferences --ios-simulator-device-set <set> --udid <udid>` finds no cached runner (`runner_xctestrun_cache` `reason: missing_xctestrun`). It starts the runner `xcodebuild build-for-testing` inside `withXcodebuildSimulatorSetRedirect` (`packages/platform-apple/src/runner/runner-artifact.ts:475`), which calls `acquireXcodebuildSimulatorSetRedirect` (`runner-device-set.ts:68`). That call swaps `XCTestDevices` for a symlink to the user's set (`runner-device-set.ts:116-119`, `installDeviceSetRedirect` at `:164`). 2. At the same time, `open` runs `xcrun simctl --set <set> launch <udid> …`. `xcrun simctl` resolves to the Xcode shim `$DEVELOPER_DIR/usr/bin/simctl`, a bash script. The shim compares its hard-coded `EXPECTED_VERSION` (Xcode 26.2: `1051.17.7`) with the installed CoreSimulator `CFBundleVersion` (this host: `1155.4`). When they differ, the shim runs `xcodebuild -runFirstLaunch` before every simctl call. 3. `xcodebuild -run
  **Post-Mortem & Fix Analysis**:
  > ## Redesign: stop redirecting XCTestDevices and point xcodebuild at the scoped set directly  This supersedes the refusal design in this issue and in #2947.  **Finding.** xcodebuild honors the Xcode user default `DVTSimulatorSetLocation`, passed as the `-DVTSimulatorSetLocation=<set>` argument. It must be the `-Key=value` form; xcodebuild rejects the space-separated form as an invalid option. With it, xcodebuild resolves destinations in that CoreSimulator device set and runs tests there. The runner therefore no longer needs `~/Library/Developer/XCTestDevices`, and the data-loss path goes away instead of being detected.  **Evidence.** - Live, Xcode 26.2: `-showdestinations` lists the scoped devices. `-showBuildSettings -destination id=<scoped udid>` resolves the device only when the argument is present. `test-without-building` with the production runner flags reached `AGENT_DEVICE_RUNNER_LISTENER_READY`, and the runner process ran from `<set>/<udid>/data`. XCTestDevices was never touched

- **Issue #2890** (2026-09-25): **fix(ios-runner): app-launch policy is decided by the retry flag; querySelector launches a stopped app**
  *Symptoms*: ## Purpose  `CommandTraits.readOnly` is documented as one axis and consumed as several, so opting a command out of one decision silently opts it out of the others. `querySelector` is the live instance: it is deliberately not retried, and as a side effect it is no longer refused when its app is stopped, so it bare-launches the app instead of answering `APP_NOT_RUNNING`.  This issue separates app-launch policy from retry eligibility inside the existing exhaustive classification, and fixes the command's behavior.  Citations are at `f47e9c9ef4`.  ## Current behavior  - `RunnerTests+Models.swift:52-53` documents `readOnly` as "Whether the command is eligible for the session-invalidating retry". The struct comment at `:44-48` presents the table as three independent axes. - Five runner-side decisions read that one flag: retry (`RunnerTests+Lifecycle.swift:454`), the stopped-app refusal `notRunningReadResponse` (`:321-325`), activation routing (`RunnerTests+CommandDispatch.swift:445-451`), recorded-failure→session invalidation (`:536`, jointly with `isLifecycle`), and remembered-text-entry tap clearing (`RunnerTests+CommandExecution.swift:11`). - `querySelector` is classified `readOnly: .never` (`RunnerTests+Models.swift:116`, comment at `:114`). Because the refusal and the activation both read the retry bit, a `querySelector` whose target app is `.notRunning` skips `notRunningReadResponse` and reaches `activateTarget(bundleId:reason:"bundle_changed")` at `CommandDispatch.swift:451`.

- **Issue #2866** (2026-09-24): **A selector read right after `wait text` can answer from the tree captured before the screen changed**
  *Symptoms*: ## Problem  A selector read (`get`, `is`) issued right after a `wait text` can answer from the tree captured **before** the screen changed, and report `Selector did not match` for an element the wait has just observed.  Mechanism (`src/commands/interaction/runtime/wait-text.ts`, `src/daemon/selector-capture-runtime.ts`):  1. Each `wait text` poll calls the owner's native `findText` first and captures the tree only on a miss. The capture is stored on the session (`session.snapshot`). 2. The screen changes during the 300 ms poll sleep. The next poll's `findText` hits, and the wait succeeds without a new capture. 3. The next `get`/`is` runs less than 750 ms after the miss capture, so `reusableSessionSnapshot` serves the stored pre-navigation tree. The request completes in about 1 ms with no capture.  Nothing retires the stored tree when a native read observes the device after it.  ## Evidence  - `smoke:automation-input` failed locally 3/5 at `get text id="automation-event-name"` (74 ms, `COMMAND_FAILED`, request log: `request_start` then `request_failed` 1 ms later, no capture). The preceding `wait` took 585 ms: findText miss, capture, sleep, findText hit. - Minimal live repro on an iOS 26.2 simulator (fixture app): relaunch home, start `wait text "Automation lab"`, the app opens the deep link 0.4-1.3 s later, then `get text id="automation-event-name"`: **8/12 failures** on origin/main.  ## Required behavior  A native observation retires the stored tree from the session-snapshot

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

### Incident Patch 1: `14e1bd7f` (2026-10-05)
**Commit Message**: fix(recording): render the touch overlay at most 30 fps and inside the record request (#3219)

* fix(recording): render the touch overlay at most 30 fps and inside the record request

* refactor(recording): take the overlay deadline from host-kit; check its budget against record's envelope

- `exportProcessedVideo` uses `Deadline.fromTimeoutMs(...).remainingMs()` instead of a hand-rolled
  `Date.now() + budgetMs`.
- The budget's comment no longer says the client resets the daemon: since #3199 `record` keeps it
  on timeout, and the caller gets "Daemon request timed out" while the daemon finishes the stop.
- `HELPER_EXIT_GRACE_MS` names what it covers: start-up, then verifying the output or cancelling the
  export, and exiting.
- The check that the budget fits `record stop`'s envelope moves from a 90_000 literal in
  `overlay.test.ts` to the root timeout-policy test, against `record`'s resolved envelope.

* test(recording): the overlay budget leaves record stop a 20 s reserve inside its envelope

The check let the budget take all but a millisecond of the envelope; the recorder stop, the copies
and the playability checks around the overlay need room beyond it.

**File**: `apple/runner/AgentDeviceRunner/RecordingScripts/RecordingExportSupport.swift` (modified, +8/-3)
```diff
@@ -88,18 +88,23 @@ func makeRecordingExporter(
   return exporter
 }
 
-/// Bounded asynchronous export: signals completion through a semaphore and cancels after 120s so a
-/// wedged encoder cannot hang the recording pipeline past the caller's own timeout budget.
+/// How long an export may run when the caller names no budget of its own.
+let defaultRecordingExportTimeoutSeconds: Double = 120
+
+/// Bounded asynchronous export: signals completion through a semaphore and cancels after
+/// `timeoutSeconds` so a wedged or slow encoder cannot hang the recording pipeline past the
+/// caller's own timeout budget.
 func runRecordingExport(
   _ exporter: AVAssetExportSession,
+  timeoutSeconds: Double = defaultRecordingExportTimeoutSeconds,
   timeoutMessage: String,
   failureMessage: String
 ) throws {
   let semaphore = DispatchSemaphore(value: 0)
   exporter.exportAsynchronously {
     semaphore.signal()
   }
-  if semaphore.wait(timeout: .now() + 120) == .timedOut {
+  if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
     exporter.cancelExport()
     throw RecordingScriptError.exportFailed(timeoutMessage)
   }
```

**File**: `apple/runner/AgentDeviceRunner/RecordingScripts/recording-overlay.swift` (modified, +27/-11)
```diff
@@ -145,6 +145,7 @@ func run() throws {
   )
   try runRecordingExport(
     exporter,
+    timeoutSeconds: parsedArgs.timeoutSeconds,
     timeoutMessage: "Touch overlay export timed out.",
     failureMessage: "Touch overlay export failed."
   )
@@ -157,10 +158,11 @@ func run() throws {
 
 func parseArguments(
   _ arguments: [String]
-) throws -> (inputPath: String, outputPath: String, eventsPath: String) {
+) throws -> (inputPath: String, outputPath: String, eventsPath: String, timeoutSeconds: Double) {
   var inputPath: String?
   var outputPath: String?
   var eventsPath: String?
+  var timeoutSeconds = defaultRecordingExportTimeoutSeconds
   var index = 0
 
   while index < arguments.count {
@@ -185,17 +187,24 @@ func parseArguments(
         throw RecordingScriptError.invalidArgs("--quality must be one of: medium, high")
       }
       index += 2
+    case "--timeout-ms":
+      let rawValue = try recordingOptionValue(arguments, nextIndex, "--timeout-ms")
+      guard let milliseconds = Double(rawValue), milliseconds > 0 else {
+        throw RecordingScriptError.invalidArgs("--timeout-ms must be a positive number")
+      }
+      timeoutSeconds = milliseconds / 1000
+      index += 2
     default:
       throw RecordingScriptError.invalidArgs("Unknown argument: \(argument)")
     }
   }
 
   guard let inputPath, let outputPath, let eventsPath else {
     throw RecordingScriptError.invalidArgs(
-      "Usage: recording-overlay.swift --input <video> --output <video> --events <json> [--quality <medium|high>]"
+      "Usage: recording-overlay.swift --input <video> --output <video> --events <json> [--quality <medium|high>] [--timeout-ms <ms>]"
     )
   }
-  return (inputPath, outputPath, eventsPath)
+  return (inputPath, outputPath, eventsPath, timeoutSeconds)
 }
 
 /// The composited overlay must keep the captured track's dimensions, so it can only use a preset
@@ -329,19 +338,26 @@ func frameMeanLuma(_ image: CGImage) -> Double? {
   return total / Double(count)
 }
 
+/// The composited export renders at most this many frames a second, which is smooth for a touch
+/// that stays visible for 0.45s.
+let maximumCompositedFrameRate: Int32 = 30
+
+/// A variable-frame-rate capture (simctl recordVideo, adb screenrecord) reports one tick of its
+/// timescale as `minFrameDuration` (1/600s from simctl). Rendering at that asked the compositor for
+/// every frame the encoder could make, 75 a second from an iOS simulator and 60 from an Android
+/// emulator, about three times the frames the capture holds; a 5-minute recording's export then
+/// outlasted the `record stop` request. So the frame duration is the capture's, but never shorter
+/// than one frame at `maximumCompositedFrameRate`. A capture that reports none renders at that
+/// rate: its average (`nominalFrameRate`) can be a couple of frames a second over a still screen,
+/// which would skip a touch.
 func resolvedFrameDuration(for track: AVAssetTrack) -> CMTime {
+  let shortest = CMTime(value: 1, timescale: maximumCompositedFrameRate)
   let minFrameDuration = track.minFrameDuration
   if minFrameDuration.isValid && !minFrameDuration.isIndefinite && minFrameDuration.seconds > 0 {
-    return minFrameDuration
-  }
-
-  let nominalFrameRate = track.nominalFrameRate
-  if nominalFrameRate > 0 {
-    let timescale = Int32(max(1, round(nominalFrameRate)))
-    return CMTime(value: 1, timescale: timescale)
+    return CMTimeMaximum(minFrameDuration, shortest)
   }
 
-  return CMTime(value: 1, timescale: 60)
+  return shortest
 }
 
 func overlayPoint(event: GestureEvent, x: Double, y: Double, renderSize: CGSize) -> CGPoint {
```

**File**: `packages/capture-kit/src/recording/__tests__/overlay.test.ts` (modified, +45/-1)
```diff
@@ -28,7 +28,7 @@ vi.mock('../video.ts', () => ({
   waitForPlayableVideo: vi.fn(async () => {}),
 }));
 
-import { overlayRecordingTouches } from '../overlay.ts';
+import { OVERLAY_BUDGET_MS, overlayRecordingTouches } from '../overlay.ts';
 import { AppError } from '@agent-device/kernel/errors';
 import { runCmd } from '@agent-device/host-kit/command';
 
@@ -48,6 +48,7 @@ beforeEach(() => {
 });
 
 afterEach(() => {
+  vi.useRealTimers();
   fs.rmSync(tmpDir, { recursive: true, force: true });
 });
 
@@ -129,3 +130,46 @@ test('overlay forwards the requested high export preset', async () => {
     expect.arrayContaining(['--events', telemetryPath, '--quality', 'high']),
   );
 });
+
+test('overlay hands the helper what is left of its budget, inside the record request', async () => {
+  const videoPath = path.join(tmpDir, 'recording.mp4');
+  const telemetryPath = path.join(tmpDir, 'recording.gesture-telemetry.json');
+  fs.writeFileSync(videoPath, 'original');
+  fs.writeFileSync(telemetryPath, '{"events":[]}');
+
+  await overlayRecordingTouches({ videoPath, telemetryPath });
+
+  const compileCall = mockRunCmd.mock.calls.find(([cmd]) => cmd === 'xcrun');
+  const helperCall = mockRunCmd.mock.calls.find(([cmd]) => cmd !== 'xcrun');
+  const args = helperScriptArgs();
+  const exportMs = Number(args[args.indexOf('--timeout-ms') + 1]);
+  expect(exportMs).toBeGreaterThan(0);
+  // The compile, the export and the helper's exit all fit in the budget. That the budget fits in
+  // `record`'s request envelope is checked where the envelope is declared.
+  expect(compileCall?.[2]?.timeoutMs).toBeLessThanOrEqual(OVERLAY_BUDGET_MS);
+  expect(helperCall?.[2]?.timeoutMs).toBeLessThanOrEqual(OVERLAY_BUDGET_MS);
+  expect(exportMs).toBeLessThan(helperCall?.[2]?.timeoutMs ?? 0);
+});
+
+test('overlay leaves the video as recorded when compiling the helper spent its budget', async () => {
+  vi.useFakeTimers({ toFake: ['Date'] });
+  const videoPath = path.join(tmpDir, 'recording.mp4');
+  const telemetryPath = path.join(tmpDir, 'recording.gesture-telemetry.json');
+  fs.writeFileSync(videoPath, 'original');
+  fs.writeFileSync(telemetryPath, '{"events":[]}');
+
+  mockRunCmd.mockImplementationOnce(async (_cmd, args) => {
+    vi.setSystemTime(Date.now() + OVERLAY_BUDGET_MS);
+    const outputPath = args[args.indexOf('-o') + 1]!;
+    fs.writeFileSync(outputPath, 'compiled');
+    fs.chmodSync(outputPath, 0o755);
+    return { stdout: '', stderr: '', exitCode: 0 };
+  });
+
+  await expect(overlayRecordingTouches({ videoPath, telemetryPath })).rejects.toMatchObject({
+    code: 'COMMAND_FAILED',
+    message: 'Failed to add touch overlays to the recording',
+  });
+  expect(mockRunCmd.mock.calls.filter(([cmd]) => cmd !== 'xcrun')).toHaveLength(0);
+  expect(fs.readFileSync(videoPath, 'utf8')).toBe('original');
+});
```

**File**: `packages/capture-kit/src/recording/overlay.ts` (modified, +41/-4)
```diff
@@ -1,6 +1,7 @@
 import fs from 'node:fs';
 import path from 'node:path';
 import { runCmd } from '@agent-device/host-kit/command';
+import { Deadline } from '@agent-device/host-kit/retry';
 import { AppError } from '@agent-device/kernel/errors';
 import { findProjectRoot } from '@agent-device/host-kit/version';
 import {
@@ -23,6 +24,20 @@ export function getRecordingOverlaySupportWarning(
   return 'touch overlay burn-in is only available on macOS hosts; returning raw video plus gesture telemetry';
 }
 
+/**
+ * `record stop` is one daemon request, which the client abandons after `record`'s 90 s envelope:
+ * the caller gets "Daemon request timed out" while the daemon finishes the stop. So the overlay must
+ * end well inside it. Compiling the helper, its export and its exit all come out of this budget;
+ * past it the stop keeps the raw video and its gesture telemetry, with a warning.
+ */
+export const OVERLAY_BUDGET_MS = 70_000;
+
+/**
+ * The helper's time outside its export: starting up, then verifying the composited output or
+ * cancelling the export, and exiting.
+ */
+const HELPER_EXIT_GRACE_MS = 5_000;
+
 let overlayScriptPath: string | undefined;
 let exportSupportScriptPath: string | undefined;
 
@@ -44,8 +59,10 @@ async function exportProcessedVideo(params: {
   scriptPath: string;
   scriptArgs: string[];
   commandDescription: string;
+  budgetMs: number;
 }): Promise<void> {
   const { videoPath, scriptPath, scriptArgs, commandDescription } = params;
+  const deadline = Deadline.fromTimeoutMs(params.budgetMs);
   await waitForStableFile(videoPath);
   await waitForPlayableVideo(videoPath);
 
@@ -54,11 +71,30 @@ async function exportProcessedVideo(params: {
     const executablePath = await compileSwiftSourceFile({
       sourcePath: scriptPath,
       extraSourcePaths: [getExportSupportScriptPath()],
+      // `runCmd` reads a timeout of 0 as none.
+      timeoutMs: Math.max(1, deadline.remainingMs()),
     });
-    await runCmd(executablePath, ['--input', videoPath, '--output', outputPath, ...scriptArgs], {
-      timeoutMs: 120_000,
-      env: buildSwiftToolEnv(),
-    });
+    const helperMs = deadline.remainingMs();
+    const exportMs = helperMs - HELPER_EXIT_GRACE_MS;
+    if (exportMs <= 0) {
+      throw new AppError(
+        'COMMAND_FAILED',
+        `No time was left for the export within the ${params.budgetMs}ms budget`,
+      );
+    }
+    await runCmd(
+      executablePath,
+      [
+        '--input',
+        videoPath,
+        '--output',
+        outputPath,
+        ...scriptArgs,
+        '--timeout-ms',
+        String(Math.round(exportMs)),
+      ],
+      { timeoutMs: helperMs, env: buildSwiftToolEnv() },
+    );
     await waitForPlayableVideo(outputPath);
     fs.renameSync(outputPath, videoPath);
   } catch (error) {
@@ -109,5 +145,6 @@ export async function overlayRecordingTouches(params: {
     scriptPath: getOverlayScriptPath(),
     scriptArgs: ['--events', telemetryPath, '--quality', exportQuality],
     commandDescription: `Failed to add touch overlays to the ${targetLabel}`,
+    budgetMs: OVERLAY_BUDGET_MS,
   });
 }
```

**File**: `src/__tests__/command-descriptor-timeout-policy.test.ts` (modified, +13/-0)
```diff
@@ -9,6 +9,7 @@ import {
 } from '@agent-device/command-registry/registry';
 import { INTERACTION_DISPATCH_PATHS } from '@agent-device/contracts/interaction-guarantees';
 import { SELECTOR_PIPELINE_POLICIES } from '@agent-device/selectors/selector-pipeline-policy';
+import { OVERLAY_BUDGET_MS } from '@agent-device/capture-kit/recording-overlay';
 import {
   DEFAULT_TIMEOUT_POLICY,
   READINESS_BUDGET_MAX_MS,
@@ -334,6 +335,18 @@ test('snapshot uses the standard daemon request timeout with an explicit overrid
   );
 });
 
+test('the touch overlay budget leaves record stop room inside its request envelope', () => {
+  // The recorder stop, the copies and the playability checks around the overlay are outside its
+  // budget (about 1 s for a 10-minute simulator recording), so the envelope keeps a reserve for
+  // them beyond it.
+  const reserveMs = 20_000;
+  const envelopeMs = resolveCommandRequestTimeoutMs(resolveCommandTimeoutPolicy('record'), {
+    positionals: ['stop'],
+    flags: {},
+  });
+  assert.ok(envelopeMs !== undefined && OVERLAY_BUDGET_MS + reserveMs <= envelopeMs);
+});
+
 test('open and prepare startup budgets keep a client-envelope margin over the daemon deadline', () => {
   const base = { positionals: [] as string[], flags: {} };
 
```

---

### Incident Patch 2: `3f3594ea` (2026-10-05)
**Commit Message**: fix(daemon): keep an idle daemon alive only for retained leases (#3227)

* fix(daemon): keep an idle daemon alive only for retained leases

Idle reap now waits only while an unexpired retainOnClose lease is active,
through LeaseRegistry.hasRetainedLeases, which also expires leases past their
window. Other leases, including human-control holds with no expiry, reap as
before; ADR 0007 says so. A lifecycle-shutdown test restores the coverage that
a session lease is released when its session teardown rejects.

* fix(daemon): bound a retained lease's idle hold by its own expiry

hasRetainedLeases counts a retainOnClose lease only while its own expiresAt
is in the future, so a human-control hold (or admitted work) that keeps a
past-due lease registered cannot keep an idle daemon alive forever. Tests: a
registry case with a hold on the retained lease's device, and a runtime case
where a plain lease does not block self-reap but a retained one does.

**File**: `docs/adr/0007-remote-device-leases.md` (modified, +3/-2)
```diff
@@ -48,8 +48,9 @@ its provider device in place, and only `leases.release`, expiry, or daemon
 shutdown ends it. The default is unchanged so the CLI's proxy sharing still
 frees devices on `close`. The allocated lease reports `retainOnClose: true`
 only when the daemon honored it, and only the lease's own client can turn it
-on for a lease the run already holds. An unexpired lease keeps an idle daemon
-alive; one the caller stops heartbeating expires after its `ttlMs`, and idle
+on for a lease the run already holds. An unexpired `retainOnClose` lease keeps
+an idle daemon alive; other leases, including human-control holds, do not. A
+retained lease the caller stops heartbeating expires after its `ttlMs`, and idle
 reap then shuts the daemon down within one more idle window.
 
 ## Consequences
```

**File**: `src/daemon/__tests__/lease-registry.test.ts` (modified, +29/-0)
```diff
@@ -71,6 +71,19 @@ test('a request without the owning clientId cannot turn retainOnClose on for a r
   assert.equal(reused.retainOnClose, undefined);
 });
 
+test('only an unexpired retainOnClose lease counts as retained', () => {
+  let now = 1_000;
+  const registry = new LeaseRegistry({ now: () => now, defaultLeaseTtlMs: 10_000 });
+  registry.allocateLease({ tenantId: 'tenant-a', runId: 'run-plain' });
+  assert.equal(registry.hasRetainedLeases(), false);
+
+  registry.allocateLease({ tenantId: 'tenant-a', runId: 'run-retained', retainOnClose: true });
+  assert.equal(registry.hasRetainedLeases(), true);
+
+  now = 20_000;
+  assert.equal(registry.hasRetainedLeases(), false);
+});
+
 test('heartbeatLease extends active lease and releaseLease is idempotent', () => {
   let now = 1_000;
   const registry = new LeaseRegistry({
@@ -410,6 +423,22 @@ test('human holds protect leases and release refreshes the original lease TTL at
   assert.equal(registry.consumeExpiredLeases()[0]?.leaseId, lease.leaseId);
 });
 
+test('a human-control hold keeps a past-due retained lease registered but not retained', async () => {
+  let now = 1_000;
+  const registry = new LeaseRegistry({ now: () => now, defaultLeaseTtlMs: 5_000 });
+  const lease = registry.allocateLease({
+    ...HUMAN_CONTROL_LEASE_REQUEST,
+    ttlMs: 10_000,
+    retainOnClose: true,
+  });
+  await registry.putHumanControlHold({ kind: 'lease', leaseId: lease.leaseId }, 'console', {});
+  assert.equal(registry.hasRetainedLeases(), true);
+
+  now = 25_000;
+  assert.equal(registry.listActiveLeases()[0]?.leaseId, lease.leaseId);
+  assert.equal(registry.hasRetainedLeases(), false);
+});
+
 test('hold expiry refreshes from the expiry instant, without reviving abandoned leases', async () => {
   let now = 0;
   const registry = new LeaseRegistry({ now: () => now, defaultLeaseTtlMs: 5_000 });
```

**File**: `src/daemon/lease-registry.ts` (modified, +12/-0)
```diff
@@ -182,6 +182,18 @@ export class LeaseRegistry {
     assertLeaseScopeMatch(this.getActiveLease(scope.leaseId), scope);
   }
 
+  /**
+   * Whether a `retainOnClose` lease is still inside its own window. A human-control hold or admitted
+   * work can keep a past-due lease registered, but only the lease's `expiresAt` bounds how long it
+   * keeps an idle daemon alive.
+   */
+  hasRetainedLeases(): boolean {
+    const now = this.now();
+    return this.listActiveLeases().some(
+      (lease) => lease.retainOnClose === true && lease.expiresAt > now,
+    );
+  }
+
   listActiveLeases(): DeviceLease[] {
     this.cleanupExpiredLeases();
     return Array.from(this.leases.values()).map((entry) => ({ ...entry }));
```

**File**: `src/daemon/server/daemon-idle-reap.test.ts` (modified, +10/-10)
```diff
@@ -149,7 +149,7 @@ test('idle reap fires after the idle window when nothing is using the daemon', a
   const idleReap = createDaemonIdleReap({
     sessionStore,
     getInFlightRequestCount: () => 0,
-    hasActiveLeases: () => false,
+    hasRetainedLeases: () => false,
     onIdleReap: () => {
       reaped++;
     },
@@ -164,14 +164,14 @@ test('idle reap fires after the idle window when nothing is using the daemon', a
   assert.equal(reaped, 1);
 });
 
-test('idle reap waits another window while a lease no session holds is still active', async () => {
+test('idle reap waits another window while a retained lease is still active', async () => {
   vi.useFakeTimers();
   let reaped = 0;
-  let leaseActive = true;
+  let retainedLeaseActive = true;
   const idleReap = createDaemonIdleReap({
     sessionStore,
     getInFlightRequestCount: () => 0,
-    hasActiveLeases: () => leaseActive,
+    hasRetainedLeases: () => retainedLeaseActive,
     onIdleReap: () => {
       reaped++;
     },
@@ -181,7 +181,7 @@ test('idle reap waits another window while a lease no session holds is still act
   idleReap.noteActivity();
   await vi.advanceTimersByTimeAsync(120);
   assert.equal(reaped, 0);
-  leaseActive = false;
+  retainedLeaseActive = false;
   await vi.advanceTimersByTimeAsync(40);
 
   assert.equal(reaped, 1);
@@ -194,7 +194,7 @@ test('idle reap does not fire while a session is open', async () => {
   const idleReap = createDaemonIdleReap({
     sessionStore,
     getInFlightRequestCount: () => 0,
-    hasActiveLeases: () => false,
+    hasRetainedLeases: () => false,
     onIdleReap: () => {
       reaped++;
     },
@@ -223,7 +223,7 @@ test('idle reap does not fire while a recording is active', async () => {
   const idleReap = createDaemonIdleReap({
     sessionStore,
     getInFlightRequestCount: () => 0,
-    hasActiveLeases: () => false,
+    hasRetainedLeases: () => false,
     onIdleReap: () => {
       reaped++;
     },
@@ -243,7 +243,7 @@ test('idle reap does not fire while a request is in flight', async () => {
   const idleReap = createDaemonIdleReap({
     sessionStore,
     getInFlightRequestCount: () => inFlightRequestCount,
-    hasActiveLeases: () => false,
+    hasRetainedLeases: () => false,
     onIdleReap: () => {
       reaped++;
     },
@@ -266,7 +266,7 @@ test('idle reap is disabled when the window is zero', async () => {
   const idleReap = createDaemonIdleReap({
     sessionStore,
     getInFlightRequestCount: () => 0,
-    hasActiveLeases: () => false,
+    hasRetainedLeases: () => false,
     onIdleReap: () => {
       reaped++;
     },
@@ -285,7 +285,7 @@ test('cancel prevents a scheduled reap from firing', async () => {
   const idleReap = createDaemonIdleReap({
     sessionStore,
     getInFlightRequestCount: () => 0,
-    hasActiveLeases: () => false,
+    hasRetainedLeases: () => false,
     onIdleReap: () => {
       reaped++;
     },
```

**File**: `src/daemon/server/daemon-idle-reap.ts` (modified, +5/-4)
```diff
@@ -84,10 +84,11 @@ export function createDaemonIdleReap(params: {
   sessionStore: SessionStore;
   getInFlightRequestCount: () => number;
   /**
-   * An unexpired lease is a client's claim on this daemon, so a reap that finds one waits another
-   * idle window. The check must also expire leases past their window, or none would ever end.
+   * An unexpired `retainOnClose` lease is a caller's claim on this daemon beyond its sessions, so a
+   * reap that finds one waits another idle window. The check must also expire leases past their
+   * window, or none would ever end.
    */
-  hasActiveLeases: () => boolean;
+  hasRetainedLeases: () => boolean;
   onIdleReap: () => void;
   env?: NodeJS.ProcessEnv;
 }): DaemonIdleReapController {
@@ -115,7 +116,7 @@ export function createDaemonIdleReap(params: {
       // session open or new request must never lose a race against a
       // previously scheduled reap.
       if (!isIdleNow()) return;
-      if (params.hasActiveLeases()) {
+      if (params.hasRetainedLeases()) {
         schedule();
         return;
       }
```

**File**: `src/daemon/server/daemon-runtime-idle-reap.test.ts` (modified, +64/-0)
```diff
@@ -1,12 +1,28 @@
 import assert from 'node:assert/strict';
 import fs from 'node:fs';
 import { afterEach, test, vi } from 'vitest';
+
+const leaseProbe = vi.hoisted(() => ({
+  registries: [] as import('../lease-registry.ts').LeaseRegistry[],
+}));
+vi.mock('../lease-registry.ts', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('../lease-registry.ts')>();
+  class RecordedLeaseRegistry extends actual.LeaseRegistry {
+    constructor(...args: ConstructorParameters<typeof actual.LeaseRegistry>) {
+      super(...args);
+      leaseProbe.registries.push(this);
+    }
+  }
+  return { ...actual, LeaseRegistry: RecordedLeaseRegistry };
+});
+
 import { resolveDaemonPaths } from '../../daemon-resolution.ts';
 import { startDaemonRuntime } from './daemon-runtime.ts';
 import { mkdtempForTestSync } from '../../__tests__/test-utils/tmp-dir.ts';
 
 afterEach(() => {
   vi.useRealTimers();
+  leaseProbe.registries.length = 0;
 });
 
 test('daemon runtime self-reaps after the idle window when nothing ever uses it', async () => {
@@ -85,3 +101,51 @@ test('daemon runtime never self-reaps when AGENT_DEVICE_DAEMON_IDLE_TIMEOUT_MS i
     fs.rmSync(stateDir, { recursive: true, force: true });
   }
 });
+
+test('only a retained lease keeps the daemon runtime from self-reaping', async () => {
+  vi.useFakeTimers();
+  const stateDir = mkdtempForTestSync('agent-device-daemon-idle-reap-leases-');
+  let exitCode: number | undefined;
+  let resolveExit: () => void;
+  const exited = new Promise<void>((resolve) => {
+    resolveExit = resolve;
+  });
+
+  try {
+    const runtime = await startDaemonRuntime({
+      env: {
+        ...process.env,
+        AGENT_DEVICE_STATE_DIR: stateDir,
+        AGENT_DEVICE_DAEMON_SERVER_MODE: 'http',
+        AGENT_DEVICE_DAEMON_IDLE_TIMEOUT_MS: '80',
+      },
+      exit: (code) => {
+        exitCode = code;
+        resolveExit();
+      },
+      registerProcessHandlers: false,
+      stderr: { write: () => {} },
+      stdout: { write: () => {} },
+    });
+    assert.notEqual(runtime, null);
+    const [registry] = leaseProbe.registries;
+    registry!.allocateLease({ tenantId: 'tenant-a', runId: 'run-plain', ttlMs: 60_000 });
+    const retained = registry!.allocateLease({
+      tenantId: 'tenant-a',
+      runId: 'run-retained',
+      ttlMs: 60_000,
+      retainOnClose: true,
+    });
+
+    await vi.advanceTimersByTimeAsync(80);
+    assert.equal(exitCode, undefined);
+
+    registry!.releaseLease({ leaseId: retained.leaseId });
+    await vi.advanceTimersByTimeAsync(80);
+    await vi.runOnlyPendingTimersAsync();
+    await exited;
+    assert.equal(exitCode, 0);
+  } finally {
+    fs.rmSync(stateDir, { recursive: true, force: true });
+  }
+});
```

**File**: `src/daemon/server/daemon-runtime-lifecycle-shutdown.test.ts` (modified, +33/-0)
```diff
@@ -399,6 +399,39 @@ test.each([false, true])(
   },
 );
 
+test('daemon shutdown releases a session lease whose session teardown rejects', async () => {
+  const stateDir = mkdtempForTestSync('agent-device-daemon-session-lease-shutdown-');
+  const runtime = await startDaemonRuntime({
+    env: {
+      ...process.env,
+      AGENT_DEVICE_STATE_DIR: stateDir,
+      AGENT_DEVICE_DAEMON_IDLE_TIMEOUT_MS: '0',
+      AGENT_DEVICE_DAEMON_SERVER_MODE: 'http',
+    },
+    exit: () => {},
+    registerProcessHandlers: false,
+    stderr: { write: () => {} },
+    stdout: { write: () => {} },
+  });
+  const [leaseRegistry] = leaseProbe.registries;
+  const lease = leaseRegistry!.allocateLease({
+    tenantId: 'tenant-a',
+    runId: 'run-1',
+    leaseProvider: 'limrun',
+  });
+  shutdownProbe.store!.publish('bound', {
+    ...makeIosSession('bound'),
+    lease: { leaseId: lease.leaseId, tenantId: lease.tenantId, runId: lease.runId },
+  });
+  shutdownProbe.finalize.mockRejectedValueOnce(new Error('teardown failed'));
+
+  await runtime?.shutdown();
+
+  expect(shutdownProbe.finalize).toHaveBeenCalledOnce();
+  expect(leaseProbe.released).toEqual([lease]);
+  expect(leaseRegistry!.listActiveLeases()).toEqual([]);
+});
+
 test('daemon shutdown releases a retainOnClose lease that no session holds', async () => {
   const stateDir = mkdtempForTestSync('agent-device-daemon-retained-lease-shutdown-');
   try {
```

**File**: `src/daemon/server/daemon-runtime.ts` (modified, +1/-1)
```diff
@@ -581,7 +581,7 @@ export async function startDaemonRuntime(
   const idleReap = createDaemonIdleReap({
     sessionStore,
     getInFlightRequestCount: () => inFlightRequests.size,
-    hasActiveLeases: () => leaseRegistry.listActiveLeases().length > 0,
+    hasRetainedLeases: () => leaseRegistry.hasRetainedLeases(),
     onIdleReap: () => {
       void shutdown();
     },
```

---

### Incident Patch 3: `b8826b59` (2026-10-05)
**Commit Message**: fix(provider-webdriver): send an empty JSON object on bodyless POSTs (#3230)

The W3C WebDriver protocol makes every POST body a JSON object, and a gateway
in front of the driver may enforce it: AWS Device Farm's remote access endpoint
refused a bodyless POST /back with "Value null at 'payload' failed to satisfy
constraint: Member must not be null", so back failed on every Device Farm
session while Appium itself accepted the request. The transport now sends {}
for a POST with no parameters; DELETE and GET stay bodyless.

**File**: `packages/provider-webdriver/src/webdriver-transport.test.ts` (modified, +37/-0)
```diff
@@ -112,6 +112,43 @@ test('cancels a retry delay when the request binding aborts', async () => {
   assert.equal(calls, 1);
 });
 
+// AWS Device Farm's remote access endpoint sits in front of Appium and validates the request
+// against the W3C protocol, where every POST body is a JSON object: a `POST /back` with no body
+// came back as `Value null at 'payload' failed to satisfy constraint: Member must not be null`.
+test('a POST without parameters carries an empty JSON object body', async () => {
+  const seen: { method: string | undefined; contentType: string | undefined; body: string }[] = [];
+  const driver = await localDriver((request, response) => {
+    let body = '';
+    request.on('data', (chunk: Buffer) => {
+      body += chunk.toString();
+    });
+    request.on('end', () => {
+      seen.push({ method: request.method, contentType: request.headers['content-type'], body });
+      response.writeHead(200, { 'Content-Type': 'application/json' });
+      response.end(JSON.stringify({ value: null }));
+    });
+  });
+  try {
+    const transport = new WebDriverTransport({
+      clientVersion: '0.0.0-test',
+      endpoint: driver.endpoint,
+      requestPolicy: { timeoutMs: 5_000, retryAttempts: 0 },
+    });
+
+    await transport.requestValue('POST', '/session/wd-1/back');
+    await transport.requestValue('DELETE', '/session/wd-1/actions');
+    await transport.requestValue('GET', '/session/wd-1/source');
+
+    assert.deepEqual(seen, [
+      { method: 'POST', contentType: 'application/json', body: '{}' },
+      { method: 'DELETE', contentType: undefined, body: '' },
+      { method: 'GET', contentType: undefined, body: '' },
+    ]);
+  } finally {
+    await driver.close();
+  }
+});
+
 /** A 127.0.0.1 port nothing listens on: bound, then released. */
 async function refusedPort(): Promise<number> {
   const server = net.createServer();
```

**File**: `packages/provider-webdriver/src/webdriver-transport.ts` (modified, +11/-2)
```diff
@@ -117,6 +117,14 @@ type ResolvedWebDriverRequestPolicy = Required<
  */
 const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);
 
+/**
+ * What a POST without parameters carries. The W3C WebDriver protocol makes every POST body a JSON
+ * object, and a gateway in front of the driver may enforce it: AWS Device Farm's remote access
+ * endpoint refuses a bodyless `POST /back` with `Value null at 'payload'`, while Appium itself
+ * accepts either.
+ */
+const EMPTY_POST_BODY: Readonly<Record<string, never>> = Object.freeze({});
+
 /** A successful WebDriver answer: its HTTP status and the unwrapped W3C `value`. */
 export type WebDriverAnswer = { status: number; value: unknown };
 
@@ -224,6 +232,7 @@ export class WebDriverTransport {
     requestSignal?: AbortSignal,
   ): Promise<Pick<Response, 'ok' | 'status'> & { text: string }> {
     const url = new URL(trimLeadingSlash(path), this.endpoint);
+    const payload = body === undefined && method === 'POST' ? EMPTY_POST_BODY : body;
     const timeoutSignal = AbortSignal.timeout(timeoutMs);
     const signal = requestSignal ? AbortSignal.any([requestSignal, timeoutSignal]) : timeoutSignal;
     const failure = { method, path, timeoutMs, timeoutSignal, requestSignal };
@@ -233,10 +242,10 @@ export class WebDriverTransport {
         method,
         headers: {
           Accept: 'application/json',
-          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
+          ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
           ...this.headers,
         },
-        body: body === undefined ? undefined : JSON.stringify(body),
+        body: payload === undefined ? undefined : JSON.stringify(payload),
         signal,
       });
     } catch (error) {
```

---

### Incident Patch 4: `e74ddfe6` (2026-10-05)
**Commit Message**: fix(limrun): compare only the leased platform's credentials (#3222)

* fix(limrun): compare only the leased platform's credentials

A Limrun lease fingerprint now covers the account variables plus the instance
variables of the platform its lease backend names, on both the CLI and the
daemon, so a changed Android instance no longer refuses an iOS allocation.
The daemon keeps a snapshot of its startup environment and fingerprints per
lease. The lease backend to platform rule has one home in the Limrun
credentials module, which the connect profile now uses too.

* test(limrun): drive the scoped fingerprint through sendToDaemon

The client test now sends lease_allocate with an iOS and an Android lease
backend over both transports and checks each body carries the fingerprint
scoped to that platform, which fails if the client drops the backend. The
Limrun docs name the compared variables, and the credentials module says why
it keeps its own lease-backend-to-platform map.

**File**: `src/cli/connection/limrun-profile.ts` (modified, +2/-1)
```diff
@@ -10,6 +10,7 @@ import { persistAndResolveGeneratedProfile } from './generated-config.ts';
 import { resolveRequestedLeaseBackend } from '../commands/connection-runtime.ts';
 import {
   limrunInstanceVariables,
+  limrunPlatformForLeaseBackend,
   readLimrunCredentials,
 } from '../../provider-limrun-credentials.ts';
 
@@ -23,7 +24,7 @@ export function resolveLimrunConnectProfile(options: {
   const env = options.env ?? process.env;
   const profile = buildLimrunRemoteProfile({ flags: options.flags });
   const credentials = readLimrunCredentials(env);
-  const platform = profile.leaseBackend === 'ios-instance' ? 'ios' : 'android';
+  const platform = limrunPlatformForLeaseBackend(profile.leaseBackend) ?? 'android';
   if (!credentials?.apiKey && !credentials?.instances?.[platform]) {
     throw new AppError(
       'INVALID_ARGS',
```

**File**: `src/daemon-client/__tests__/daemon-client-provider-credentials.test.ts` (modified, +20/-2)
```diff
@@ -19,6 +19,11 @@ import { providerCredentialFingerprint } from '../../provider-credential-fingerp
 import { LIMRUN_CREDENTIAL_VARIABLES } from '../../provider-limrun-credentials.ts';
 
 const API_KEY = 'lim-secret-key';
+const ANDROID_ATTACH = {
+  LIM_ANDROID_INSTANCE_URL: 'https://region.limrun.example/v1/android_x/api',
+  LIM_ANDROID_INSTANCE_TOKEN: 'android-token',
+  LIM_ANDROID_INSTANCE_ADB_URL: 'wss://region.limrun.example/v1/android_x/adb',
+};
 
 afterEach(() => {
   vi.unstubAllEnvs();
@@ -38,31 +43,44 @@ test.sequential.for(['socket', 'http'] as const)(
     vi.stubEnv('AGENT_DEVICE_DAEMON_AUTH_TOKEN', undefined);
     const stateDir = mkdtempForTestSync('agent-device-provider-credentials-daemon-');
     const daemon = await startLocalDaemon(stateDir, transport);
-    const send = (command: string) =>
+    const send = (command: string, leaseBackend?: 'ios-instance' | 'android-instance') =>
       sendToDaemon({
         session: 'default',
         command,
         positionals: [],
         flags: { stateDir, daemonTransport: transport },
-        meta: { requestId: `req-${command}`, leaseProvider: 'limrun', tenantId: 'tenant-a' },
+        meta: {
+          requestId: `req-${command}`,
+          leaseProvider: 'limrun',
+          tenantId: 'tenant-a',
+          ...(leaseBackend ? { leaseBackend } : {}),
+        },
       });
+    const attachedEnv = { LIMRUN_API_KEY: API_KEY, ...ANDROID_ATTACH };
 
     try {
       vi.stubEnv('LIMRUN_API_KEY', API_KEY);
       await send('lease_allocate');
       await send('devices');
       vi.stubEnv('LIMRUN_API_KEY', undefined);
       await send('lease_allocate');
+      for (const [name, value] of Object.entries(attachedEnv)) vi.stubEnv(name, value);
+      await send('lease_allocate', 'ios-instance');
+      await send('lease_allocate', 'android-instance');
     } finally {
       await daemon.close();
       fs.rmSync(stateDir, { recursive: true, force: true });
     }
 
+    const iosFingerprint = providerCredentialFingerprint('limrun', attachedEnv, 'ios-instance');
     expect(daemon.bodies.map(readFingerprint)).toEqual([
       providerCredentialFingerprint('limrun', { LIMRUN_API_KEY: API_KEY }),
       undefined,
       undefined,
+      iosFingerprint,
+      providerCredentialFingerprint('limrun', attachedEnv, 'android-instance'),
     ]);
+    expect(iosFingerprint).not.toBe(providerCredentialFingerprint('limrun', attachedEnv));
     for (const body of daemon.bodies) expect(body).not.toContain(API_KEY);
   },
 );
```

**File**: `src/daemon-client/daemon-client.ts` (modified, +2/-2)
```diff
@@ -142,10 +142,10 @@ async function readLocalProviderCredentialFingerprint(
   info: DaemonInfo,
 ): Promise<string | undefined> {
   if (isRemoteDaemon(info) || request.command !== 'lease_allocate') return undefined;
-  const provider = leaseScopeFromRequest(request).leaseProvider;
+  const { leaseProvider: provider, leaseBackend } = leaseScopeFromRequest(request);
   if (!provider) return undefined;
   const { providerCredentialFingerprint } = await import('../provider-credential-fingerprint.ts');
-  return providerCredentialFingerprint(provider, process.env);
+  return providerCredentialFingerprint(provider, process.env, leaseBackend);
 }
 
 // A developer dir is a path on the client's host, so only a local daemon can use it.
```

**File**: `src/daemon/handlers/__tests__/lease.test.ts` (modified, +27/-1)
```diff
@@ -344,14 +344,15 @@ const BROWSERSTACK_ENV = { BROWSERSTACK_USERNAME: 'user', BROWSERSTACK_ACCESS_KE
 function providerAllocateRequest(
   leaseProvider: string,
   providerCredentialFingerprint: string | undefined,
+  leaseBackend: 'ios-instance' | 'android-instance' = 'ios-instance',
 ): DaemonRequest {
   const request = allocateRequest();
   return {
     ...request,
     meta: {
       ...request.meta,
       leaseProvider,
-      leaseBackend: 'ios-instance',
+      leaseBackend,
       providerCredentialFingerprint,
     },
   };
@@ -400,6 +401,31 @@ test('a daemon started with only LIMRUN_API_KEY refuses a shell with instance va
   );
 });
 
+test('a Limrun lease compares only the leased platform instance variables', async () => {
+  const daemonEnv = {
+    ...LIMRUN_ATTACH_ENV,
+    LIM_ANDROID_INSTANCE_URL: 'https://region.limrun.example/v1/android_x/api',
+    LIM_ANDROID_INSTANCE_TOKEN: 'android-token',
+    LIM_ANDROID_INSTANCE_ADB_URL: 'wss://region.limrun.example/v1/android_x/adb',
+  };
+  const shellEnv = { ...daemonEnv, LIM_ANDROID_INSTANCE_TOKEN: 'android-token-2' };
+  const allocate = async (leaseBackend: 'ios-instance' | 'android-instance') =>
+    await allocateWithDaemonEnv(
+      providerAllocateRequest(
+        'limrun',
+        providerCredentialFingerprint('limrun', shellEnv, leaseBackend),
+        leaseBackend,
+      ),
+      daemonEnv,
+    );
+
+  assert.equal((await allocate('ios-instance')).error, undefined);
+  assert.equal(
+    (await allocate('android-instance')).error?.details?.reason,
+    'provider-credentials-changed',
+  );
+});
+
 test('a daemon holding rotated BrowserStack keys refuses before allocation', async () => {
   const outcome = await allocateWithDaemonEnv(
     providerAllocateRequest(
```

**File**: `src/daemon/handlers/lease.ts` (modified, +6/-3)
```diff
@@ -75,7 +75,7 @@ export async function handleLeaseCommands(args: LeaseHandlerArgs): Promise<Daemo
         providerRuntimeRequiredIds,
       );
       assertProviderCredentialsUnchanged(
-        leaseScope.leaseProvider,
+        leaseScope,
         req.meta?.providerCredentialFingerprint,
         providerCredentials,
       );
@@ -296,12 +296,15 @@ function assertProviderRuntimeAvailable(
 }
 
 function assertProviderCredentialsUnchanged(
-  provider: string | undefined,
+  {
+    leaseProvider: provider,
+    leaseBackend,
+  }: Pick<ReturnType<typeof resolveLeaseScope>, 'leaseProvider' | 'leaseBackend'>,
   requested: string | undefined,
   daemon: DaemonProviderCredentials | undefined,
 ): void {
   if (!daemon || !provider || !requested) return;
-  const current = daemon.fingerprints[provider];
+  const current = daemon.fingerprint(provider, leaseBackend);
   if (requested === current) return;
   throw new AppError(
     'INVALID_ARGS',
```

**File**: `src/provider-credential-fingerprint.test.ts` (modified, +40/-8)
```diff
@@ -41,7 +41,7 @@ test.for(['limrun', 'browserstack'])(
   (provider) => {
     expect(providerCredentialFingerprint(provider, {})).toBe(undefined);
     expect(providerCredentialFingerprint(provider, { LIMRUN_REGION: ' ' })).toBe(undefined);
-    expect(readDaemonProviderCredentials({}, '/state').fingerprints[provider]).toBe(undefined);
+    expect(readDaemonProviderCredentials({}, '/state').fingerprint(provider)).toBe(undefined);
   },
 );
 
@@ -62,18 +62,50 @@ test('a provider name that only matches an inherited object key has no fingerpri
 });
 
 test('AWS Device Farm has no environment fingerprint', () => {
-  expect(providerCredentialFingerprint('aws-device-farm', { AWS_ACCESS_KEY_ID: 'id' })).toBe(
+  const env = { AWS_ACCESS_KEY_ID: 'id' };
+  expect(providerCredentialFingerprint('aws-device-farm', env)).toBe(undefined);
+  expect(readDaemonProviderCredentials(env, '/state').fingerprint('aws-device-farm')).toBe(
     undefined,
   );
-  expect(Object.keys(readDaemonProviderCredentials({}, '/state').fingerprints).sort()).toEqual([
-    'browserstack',
-    'limrun',
-  ]);
 });
 
 test('a fingerprint never contains a credential value', () => {
-  const fingerprints = JSON.stringify(
-    readDaemonProviderCredentials({ ...BROWSERSTACK_ENV, LIMRUN_API_KEY: 'lim-key' }, '/state'),
+  const daemon = readDaemonProviderCredentials(
+    { ...BROWSERSTACK_ENV, LIMRUN_API_KEY: 'lim-key' },
+    '/state',
   );
+  const fingerprints = JSON.stringify([
+    daemon.fingerprint('browserstack'),
+    daemon.fingerprint('limrun'),
+  ]);
   for (const value of ['user', 'key-1', 'lim-key']) expect(fingerprints).not.toContain(value);
 });
+
+const IOS_ATTACH = {
+  LIM_IOS_INSTANCE_URL: 'https://region.limrun.example/v1/ios_x/api',
+  LIM_IOS_INSTANCE_TOKEN: 'ios-token',
+};
+const ANDROID_ATTACH = {
+  LIM_ANDROID_INSTANCE_URL: 'https://region.limrun.example/v1/android_x/api',
+  LIM_ANDROID_INSTANCE_TOKEN: 'android-token',
+  LIM_ANDROID_INSTANCE_ADB_URL: 'wss://region.limrun.example/v1/android_x/adb',
+};
+
+test('a Limrun lease fingerprint covers only the leased platform and the account', () => {
+  const before = { LIMRUN_API_KEY: 'lim-key', ...IOS_ATTACH, ...ANDROID_ATTACH };
+  const rotatedAndroid = { ...before, LIM_ANDROID_INSTANCE_TOKEN: 'android-token-2' };
+  const ios = (env: Record<string, string>) =>
+    providerCredentialFingerprint('limrun', env, 'ios-instance');
+  const android = (env: Record<string, string>) =>
+    providerCredentialFingerprint('limrun', env, 'android-instance');
+
+  expect(ios(rotatedAndroid)).toBe(ios(before));
+  expect(android(rotatedAndroid)).not.toBe(android(before));
+  expect(ios({ ...before, LIMRUN_API_KEY: 'lim-rotated' })).not.toBe(ios(before));
+  expect(providerCredentialFingerprint('limrun', rotatedAndroid)).not.toBe(
+    providerCredentialFingerprint('limrun', before),
+  );
+  expect(
+    readDaemonProviderCredentials(before, '/state').fingerprint('limrun', 'ios-instance'),
+  ).toBe(ios(rotatedAndroid));
+});
```

**File**: `src/provider-credential-fingerprint.ts` (modified, +31/-26)
```diff
@@ -12,49 +12,54 @@ type CredentialValues = Readonly<Record<string, string | undefined>>;
 
 // Each provider's own reader, so the fingerprint sees exactly the values the provider uses. AWS
 // Device Farm is absent: it reads the AWS CLI credential chain, which no env hash identifies.
-const PROVIDER_CREDENTIAL_READERS: ReadonlyMap<string, (env: EnvMap) => CredentialValues> = new Map(
+const PROVIDER_CREDENTIAL_READERS: ReadonlyMap<
+  string,
+  (env: EnvMap, leaseBackend?: string) => CredentialValues
+> = new Map([
+  ['limrun' satisfies typeof LIMRUN_PROVIDER, readLimrunCredentialValues],
   [
-    ['limrun' satisfies typeof LIMRUN_PROVIDER, readLimrunCredentialValues],
-    [
-      CLOUD_WEBDRIVER_PROVIDERS.browserStack,
-      (env: EnvMap): CredentialValues => {
-        const { username, accessKey } = readBrowserStackCredentials(env);
-        return {
-          [BROWSERSTACK_CREDENTIAL_VARIABLES.username]: username,
-          [BROWSERSTACK_CREDENTIAL_VARIABLES.accessKey]: accessKey,
-        };
-      },
-    ],
+    CLOUD_WEBDRIVER_PROVIDERS.browserStack,
+    (env: EnvMap): CredentialValues => {
+      const { username, accessKey } = readBrowserStackCredentials(env);
+      return {
+        [BROWSERSTACK_CREDENTIAL_VARIABLES.username]: username,
+        [BROWSERSTACK_CREDENTIAL_VARIABLES.accessKey]: accessKey,
+      };
+    },
   ],
-);
+]);
 
 /**
- * A versioned, non-reversible digest of the credentials a provider reads from `env`, or undefined
- * when `env` holds none of them or the provider's credentials do not come from the environment.
+ * A versioned, non-reversible digest of the credentials a lease on `leaseBackend` reads from `env`,
+ * or undefined when `env` holds none of them or the provider's credentials do not come from the
+ * environment.
  */
-export function providerCredentialFingerprint(provider: string, env: EnvMap): string | undefined {
+export function providerCredentialFingerprint(
+  provider: string,
+  env: EnvMap,
+  leaseBackend?: string,
+): string | undefined {
   const read = PROVIDER_CREDENTIAL_READERS.get(provider);
-  return read ? digest(read(env)) : undefined;
+  return read ? digest(read(env, leaseBackend)) : undefined;
 }
 
 /** The provider credentials a daemon started with, and the state dir that names that daemon. */
 export type DaemonProviderCredentials = Readonly<{
-  /** Undefined for a provider whose credentials the daemon's environment does not hold. */
-  fingerprints: Readonly<Record<string, string | undefined>>;
+  /** Undefined when the daemon's environment holds none of the credentials such a lease reads. */
+  fingerprint(provider: string, leaseBackend?: string): string | undefined;
   stateDir: string;
 }>;
 
 export function readDaemonProviderCredentials(
   env: EnvMap,
   stateDir: string,
 ): DaemonProviderCredentials {
-  const fingerprints = Object.fromEntries(
-    [...PROVIDER_CREDENTIAL_READERS.keys()].map((provider) => [
-      provider,
-      providerCredentialFingerprint(provider, env),
-    ]),
-  );
-  return { fingerprints, stateDir };
+  const startupEnv = { ...env };
+  return {
+    fingerprint: (provider, leaseBackend) =>
+      providerCredentialFingerprint(provider, startupEnv, leaseBackend),
+    stateDir,
+  };
 }
 
 function digest(values: CredentialValues): string | undefined {
```

**File**: `src/provider-limrun-credentials.ts` (modified, +25/-4)
```diff
@@ -27,13 +27,34 @@ export const LIMRUN_CREDENTIAL_VARIABLES: readonly string[] = [
   ...INSTANCE_VARS.android,
 ];
 
-/** Each credential variable's value, read by the same rule the credential reader uses. */
+// Mirrors platformForLimrunLeaseBackend in provider-limrun, which exposes only its root entry, and
+// that entry loads the Limrun SDK; importing it here would load the SDK on every credential read.
+const LEASE_BACKEND_PLATFORMS: ReadonlyMap<string, 'ios' | 'android'> = new Map([
+  ['ios-instance', 'ios'],
+  ['android-instance', 'android'],
+]);
+
+/** The platform whose instance a Limrun lease backend reaches. */
+export function limrunPlatformForLeaseBackend(
+  leaseBackend: string | undefined,
+): 'ios' | 'android' | undefined {
+  return leaseBackend === undefined ? undefined : LEASE_BACKEND_PLATFORMS.get(leaseBackend);
+}
+
+/**
+ * The value of each credential variable a lease on `leaseBackend` depends on, read by the same
+ * rule the credential reader uses: the account variables plus that platform's instance variables,
+ * or every variable when the backend names no platform.
+ */
 export function readLimrunCredentialValues(
   env: EnvMap,
+  leaseBackend?: string,
 ): Readonly<Record<string, string | undefined>> {
-  return Object.fromEntries(
-    LIMRUN_CREDENTIAL_VARIABLES.map((name) => [name, readValue(env, name)]),
-  );
+  const platform = limrunPlatformForLeaseBackend(leaseBackend);
+  const names = platform
+    ? [...Object.values(ACCOUNT_VARS), ...INSTANCE_VARS[platform]]
+    : LIMRUN_CREDENTIAL_VARIABLES;
+  return Object.fromEntries(names.map((name) => [name, readValue(env, name)]));
 }
 
 /** The variables that give access to an existing instance of a platform. */
```

---

### Incident Patch 5: `d0deeb84` (2026-10-05)
**Commit Message**: fix(providers): refuse lease allocation when the daemon holds other provider credentials (#3207)

* fix(providers): refuse lease allocation when the daemon holds other provider credentials

A local daemon keeps the environment it started with, while connect checks
the shell's. A stale daemon could act on old credentials, for example
creating a billed Limrun instance for an attach-mode shell. On a local
lease_allocate the CLI now sends a versioned hash of the values each
provider's own reader uses (Limrun, BrowserStack), over the socket and local
HTTP; the daemon compares it with the hash of its startup environment and
refuses with INVALID_ARGS, reason provider-credentials-changed, and a hint
naming its state dir. No hash is sent from a shell without credentials or to
remote, proxy, or cloud daemons; a daemon with an HTTP auth hook treats every
caller as remote. AWS Device Farm is excluded.

* fix(providers): keep the connect verification error shape; scrub the HTTP auth hook in tests

verifyBrowserStack reads credentials through the shared reader again but keeps
its COMMAND_FAILED 'profile missed' error and reconnect hint. The hermetic test
setup now also clears AGENT_DEVICE_HTTP_A

**File**: `packages/kernel/src/contracts.ts` (modified, +2/-0)
```diff
@@ -148,6 +148,8 @@ export type DaemonRequestMeta = {
   leaseProvider?: string;
   deviceKey?: string;
   clientId?: string;
+  /** A local caller's digest of its lease-provider credential variables, compared on allocation. */
+  providerCredentialFingerprint?: string;
   sessionIsolation?: SessionIsolationMode;
   uploadedArtifactId?: string;
   clientArtifactPaths?: Record<string, string>;
```

**File**: `packages/provider-webdriver/src/index.ts` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ import type { CloudWebDriverRuntime } from './runtime.ts';
 export { CLOUD_WEBDRIVER_PROFILE_FIELDS, CLOUD_WEBDRIVER_PROVIDERS };
 export { readAwsDeviceFarmRegionFromArn };
 export { parseBrowserStackAppReference } from './browserstack.ts';
+export { requireBrowserStackCredentials } from './provider-definitions.ts';
 export type { CloudWebDriverKnownProviderName } from './providers.ts';
 export type { ProviderWebDriverDependencies, RunHostCommand } from './dependencies.ts';
 export type {
```

**File**: `packages/provider-webdriver/src/provider-definitions.ts` (modified, +21/-23)
```diff
@@ -22,7 +22,12 @@ import {
   buildBrowserStackDeviceFeatureCapabilities,
   readBrowserStackDeviceFeatureFields,
 } from './browserstack-device-features.ts';
-import { CLOUD_WEBDRIVER_PROVIDERS, type CloudWebDriverKnownProviderName } from './providers.ts';
+import {
+  BROWSERSTACK_CREDENTIAL_VARIABLES,
+  CLOUD_WEBDRIVER_PROVIDERS,
+  readBrowserStackCredentials,
+  type CloudWebDriverKnownProviderName,
+} from './providers.ts';
 import { readAwsDeviceFarmRegionFromArn } from './connection-verification.ts';
 import {
   buildCloudWebDriverBaseCapabilities,
@@ -142,14 +147,8 @@ export function createCloudWebDriverProviderDefinitions(
           endpoint: env.BROWSERSTACK_WEBDRIVER_ENDPOINT ?? BROWSERSTACK_APP_AUTOMATE_ENDPOINT,
           capabilityOverrides: BROWSERSTACK_CAPABILITY_OVERRIDES,
           listArtifacts: async ({ provider, providerSessionId }) => {
-            const username = requireEnv(
-              env,
-              'BROWSERSTACK_USERNAME',
-              'BrowserStack artifact lookup',
-            );
-            const accessKey = requireEnv(
+            const { username, accessKey } = requireBrowserStackCredentials(
               env,
-              'BROWSERSTACK_ACCESS_KEY',
               'BrowserStack artifact lookup',
             );
             return await listBrowserStackCloudArtifacts(provider, providerSessionId, {
@@ -161,8 +160,7 @@ export function createCloudWebDriverProviderDefinitions(
           },
           prepareSession: async ({ req, lease, base }) => {
             const request = requireRequest(req, 'BrowserStack');
-            const username = requireEnv(env, 'BROWSERSTACK_USERNAME', 'BrowserStack');
-            const accessKey = requireEnv(env, 'BROWSERSTACK_ACCESS_KEY', 'BrowserStack');
+            const { username, accessKey } = requireBrowserStackCredentials(env, 'BrowserStack');
             const platform = requireRequestPlatform(request, 'BrowserStack');
             const deviceName = requireFlag(
               request,
@@ -220,10 +218,8 @@ export function createCloudWebDriverProviderDefinitions(
           },
         }),
       listArtifactsFromEnv: async (providerSessionId, env) => {
-        const username = requireEnv(env, 'BROWSERSTACK_USERNAME', 'BrowserStack artifact lookup');
-        const accessKey = requireEnv(
+        const { username, accessKey } = requireBrowserStackCredentials(
           env,
-          'BROWSERSTACK_ACCESS_KEY',
           'BrowserStack artifact lookup',
         );
         return await listBrowserStackCloudArtifacts(
@@ -343,16 +339,6 @@ function readFlag(req: LeaseLifecycleContext, key: string): string | undefined {
   return typeof value === 'string' && value.length > 0 ? value : undefined;
 }
 
-function requireEnv(
-  env: DefaultCloudWebDriverProviderRuntimeEnv,
-  key: keyof DefaultCloudWebDriverProviderRuntimeEnv,
-  providerLabel: string,
-): string {
-  const value = env[key];
-  if (value) return value;
-  throw new AppError('INVALID_ARGS', `${providerLabel} requires ${key} in the environment.`);
-}
-
 function requireAwsValue(
   req: LeaseLifecycleContext,
   env: DefaultCloudWebDriverProviderRuntimeEnv,
@@ -379,3 +365,15 @@ function readAwsInteractionMode(
 function dasherize(value: string): string {
   return value.replaceAll(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
 }
+
+export function requireBrowserStackCredentials(
+  env: Readonly<Record<string, string | undefined>>,
+  consumer: string,
+): { username: string; accessKey: string } {
+  const { username, accessKey } = readBrowserStackCredentials(env);
+  if (username && accessKey) return { username, accessKey };
+  const missing = username
+    ? BROWSERSTACK_CREDENTIAL_VARIABLES.accessKey
+    : BROWSERSTACK_CREDENTIAL_VARIABLES.username;
+  throw new AppError('INVALID_ARGS', `${consumer} requires ${missing} in the environment.`);
+}
```

**File**: `packages/provider-webdriver/src/providers.ts` (modified, +16/-0)
```diff
@@ -14,6 +14,22 @@ export function isCloudWebDriverProviderName(
   return provider !== undefined && CLOUD_WEBDRIVER_KNOWN_PROVIDERS.has(provider);
 }
 
+/** The environment variables that hold BrowserStack credentials. */
+export const BROWSERSTACK_CREDENTIAL_VARIABLES = {
+  username: 'BROWSERSTACK_USERNAME',
+  accessKey: 'BROWSERSTACK_ACCESS_KEY',
+} as const;
+
+/** The BrowserStack credentials in the environment, exactly as every consumer and the fingerprint use them. */
+export function readBrowserStackCredentials(
+  env: Readonly<Record<string, string | undefined>>,
+): Readonly<{ username?: string; accessKey?: string }> {
+  return {
+    username: env[BROWSERSTACK_CREDENTIAL_VARIABLES.username] || undefined,
+    accessKey: env[BROWSERSTACK_CREDENTIAL_VARIABLES.accessKey] || undefined,
+  };
+}
+
 const BROWSERSTACK_APP_SCHEME = 'bs://';
 
 /**
```

**File**: `src/__tests__/hermetic-env-setup.ts` (modified, +4/-0)
```diff
@@ -15,13 +15,17 @@ import { afterEach } from 'vitest';
 // daemonBaseUrl/daemonAuthToken keys, and daemon-client tests take the remote
 // path ("Remote daemon is unavailable") instead of the local one they exercise.
 //
+// An HTTP auth hook likewise makes a local daemon treat every HTTP caller as remote.
+//
 // CI runs with these unset. Delete them here so a configured host matches CI.
 // Tests that genuinely need them assign their own value or pass an explicit env
 // object; that happens inside the test, after this module has loaded, so this
 // scrub does not interfere.
 const AMBIENT_DAEMON_ENV_VARS = [
   'AGENT_DEVICE_DAEMON_BASE_URL',
   'AGENT_DEVICE_DAEMON_AUTH_TOKEN',
+  'AGENT_DEVICE_HTTP_AUTH_HOOK',
+  'AGENT_DEVICE_HTTP_AUTH_EXPORT',
 ] as const;
 
 for (const name of AMBIENT_DAEMON_ENV_VARS) {
```

**File**: `src/cli/connection/cloud-webdriver-profile.ts` (modified, +2/-8)
```diff
@@ -3,6 +3,7 @@ import {
   CLOUD_WEBDRIVER_PROVIDERS,
   parseBrowserStackAppReference,
   readAwsDeviceFarmRegionFromArn,
+  requireBrowserStackCredentials,
   type CloudWebDriverKnownProviderName,
 } from '@agent-device/provider-webdriver';
 import { rejectRefusedProviderProfileFields } from '@agent-device/contracts/provider-profile-fields';
@@ -99,8 +100,7 @@ function browserStackProfileFields(options: {
   env?: EnvMap;
   cwd: string;
 }): RemoteConfigProfile {
-  requireEnv(options.env, 'BROWSERSTACK_USERNAME', 'connect browserstack');
-  requireEnv(options.env, 'BROWSERSTACK_ACCESS_KEY', 'connect browserstack');
+  requireBrowserStackCredentials(options.env ?? {}, 'connect browserstack');
   const platform = requireCloudWebDriverPlatform(
     options.flags.platform,
     'connect browserstack requires --platform ios|android.',
@@ -195,12 +195,6 @@ function requireFlag(value: string | undefined, message: string): string {
   throw new AppError('INVALID_ARGS', message);
 }
 
-function requireEnv(env: EnvMap | undefined, name: string, command: string): string {
-  const value = env?.[name];
-  if (value) return value;
-  throw new AppError('INVALID_ARGS', `${command} requires ${name} in the environment.`);
-}
-
 function requireAwsProfileValue(
   flagValue: string | undefined,
   env: EnvMap | undefined,
```

**File**: `src/cli/connection/connect-provider-adapters.ts` (modified, +4/-2)
```diff
@@ -2,6 +2,7 @@ import type { CliFlags } from '@agent-device/contracts/command';
 import type { ProviderConnectionVerification } from '@agent-device/contracts/remote';
 import { verifyLimrunConnection } from '@agent-device/provider-limrun';
 import { AppError } from '@agent-device/kernel/errors';
+import { readBrowserStackCredentials } from '@agent-device/provider-webdriver/providers';
 import { providerWebDriver } from '../../provider-webdriver.ts';
 import { resolveRemoteConfigProfile } from '../../remote/remote-config.ts';
 import { readVersion } from '@agent-device/host-kit/version';
@@ -134,14 +135,15 @@ async function verifyBrowserStack(
   context: Pick<AdapterContext, 'flags' | 'env'>,
 ): Promise<ConnectVerification> {
   const { flags, env } = context;
+  const credentials = readBrowserStackCredentials(env);
   return await providerWebDriver.verifyConnection({
     provider: 'browserstack',
     username: requiredResolvedValue(
-      env.BROWSERSTACK_USERNAME,
+      credentials.username,
       'BrowserStack profile missed BROWSERSTACK_USERNAME.',
     ),
     accessKey: requiredResolvedValue(
-      env.BROWSERSTACK_ACCESS_KEY,
+      credentials.accessKey,
       'BrowserStack profile missed BROWSERSTACK_ACCESS_KEY.',
     ),
     platform: requiredResolvedPlatform(flags.platform, 'BrowserStack'),
```

**File**: `src/commands/schema/cli-help.ts` (modified, +1/-0)
```diff
@@ -667,6 +667,7 @@ Rules:
   Use agent-device proxy for direct tunnel access to a Mac you control. Expose the printed proxy URL through cloudflared/ngrok, then run agent-device connect proxy with the tunnel URL and printed token before normal commands.
   Use Limrun, BrowserStack, and AWS Device Farm through local provider profiles; they do not accept a remote agent-device daemon URL.
   Device cloud credentials must be available before the command starts. Limrun uses LIMRUN_API_KEY, or the LIM_*_INSTANCE_* variables for an existing instance. BrowserStack uses BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY. AWS Device Farm uses the AWS CLI credential chain, including CI-provided AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_SESSION_TOKEN, AWS profiles, or web identity role variables.
+  A local daemon keeps the Limrun and BrowserStack credentials it started with. When the shell holds different ones, the first command that allocates a lease refuses with reason provider-credentials-changed; run agent-device daemon stop with the same --state-dir, then rerun the command. A shell that sets none of them uses the daemon's. A daemon with an HTTP auth hook serves remote callers and does not compare.
   Direct-provider connect performs read-only provider calls and saves active connection state only after verification succeeds. It never creates a device, instance, App Automate session, or AWS remote access session.
   connect without --session always creates a fresh remote session and prints that session in its next-step commands. Concurrent callers must pass the returned --session on every command; the ambient active connection is only a single-workflow convenience.
   To replace an existing connection, pass its returned session explicitly with --session <name> --force. --force without --session creates another fresh session and does not release or overwrite an unrelated active connection.
```

---

### Incident Patch 6: `2f933e55` (2026-10-05)
**Commit Message**: fix(doctor): warm the runner cache only for simulators this host discovered (#3226)

Doctor's fresh-machine warmup picked its simulator from provider-first
inventory, which drops the discovery source. A simulator a provider reported
is not on this host, yet doctor started a local xcodebuild runner build for it.
Doctor now keeps the inventory source and names a warmup device only from
devices this host discovered.

**File**: `src/daemon/handlers/__tests__/session-doctor-device.test.ts` (modified, +37/-1)
```diff
@@ -1,6 +1,9 @@
 import assert from 'node:assert/strict';
 import { test } from 'vitest';
-import { withTestDeviceInventoryProvider as withDeviceInventoryProvider } from '../../../__tests__/test-utils/device-inventory-gateways.ts';
+import {
+  withTestDeviceInventory,
+  withTestDeviceInventoryProvider as withDeviceInventoryProvider,
+} from '../../../__tests__/test-utils/device-inventory-gateways.ts';
 import { AppError } from '@agent-device/kernel/errors';
 import type { DeviceInfo } from '@agent-device/kernel/device';
 import { attachAdbFailureHint } from '@agent-device/platform-android/mechanics';
@@ -58,3 +61,36 @@ test('doctor android inventory timeout surfaces the wedged-adb-server hint', asy
   assert.match(androidCheck?.summary ?? '', /timed out after 10000ms/);
   assert.match(androidCheck?.hint ?? '', /adb kill-server && adb start-server/);
 });
+
+test('doctor inventory names as host devices only the platforms this host discovered', async () => {
+  const androidEmulator: DeviceInfo = {
+    platform: 'android',
+    id: 'emulator-5554',
+    name: 'Pixel',
+    kind: 'emulator',
+    booted: true,
+  };
+  const req = { token: 't', session: 'default', command: 'doctor' } as DaemonRequest;
+
+  const inventory = await withTestDeviceInventory(
+    {
+      provider: {
+        discover: async (request) =>
+          request.platform === 'apple'
+            ? { kind: 'inventory', devices: [BOOTED_IOS_SIMULATOR] }
+            : { kind: 'declined' },
+      },
+      local: async () => [androidEmulator],
+    },
+    async () => await appendDeviceInventoryCheck([], req, undefined),
+  );
+
+  assert.deepEqual(
+    inventory?.devices.map((device) => device.id),
+    [androidEmulator.id, BOOTED_IOS_SIMULATOR.id],
+  );
+  assert.deepEqual(
+    inventory?.hostDevices.map((device) => device.id),
+    [androidEmulator.id],
+  );
+});
```

**File**: `src/daemon/handlers/__tests__/session-doctor-warmup.test.ts` (modified, +70/-20)
```diff
@@ -4,6 +4,7 @@ import { isActiveProviderDevice } from '../../provider-device-admission.ts';
 import { handleDoctorCommand } from '../session-doctor.ts';
 import { createHostDiagnostics } from '../../../platform-runtime-host-diagnostics.ts';
 import { makeSessionStore } from '../../../__tests__/test-utils/store-factory.ts';
+import { withTestDeviceInventory } from '../../../__tests__/test-utils/device-inventory-gateways.ts';
 import type { DaemonResponse } from '../../daemon-request.ts';
 
 const { mockAppleRunnerWarmupCheck } = vi.hoisted(() => ({
@@ -14,14 +15,6 @@ vi.mock('@agent-device/platform-apple/doctor', async (importOriginal) => ({
   ...(await importOriginal<typeof import('@agent-device/platform-apple/doctor')>()),
   appleRunnerWarmupCheck: mockAppleRunnerWarmupCheck,
 }));
-vi.mock('../session-doctor-device.ts', async (importOriginal) => {
-  const actual = await importOriginal<typeof import('../session-doctor-device.ts')>();
-  return {
-    ...actual,
-    appendDeviceInventoryCheck: vi.fn(async () => undefined),
-    resolveDoctorDeviceForAppCheck: vi.fn(() => undefined),
-  };
-});
 vi.mock('../session-doctor-app.ts', () => ({
   appendAppChecks: vi.fn(async () => {}),
 }));
@@ -68,18 +61,46 @@ async function runDoctorWithSessionDevice(device: DeviceInfo): Promise<DaemonRes
     device,
     actions: [],
   });
-  return await handleDoctorCommand({
-    req: {
-      token: 't',
-      session: 'doctor-session',
-      command: 'doctor',
-      positionals: [],
-      flags: { session: 'doctor-session' },
-    },
-    sessionName: 'doctor-session',
-    sessionStore,
-    hostDiagnostics: createHostDiagnostics(),
-  });
+  return await withTestDeviceInventory(
+    {},
+    async () =>
+      await handleDoctorCommand({
+        req: {
+          token: 't',
+          session: 'doctor-session',
+          command: 'doctor',
+          positionals: [],
+          flags: { session: 'doctor-session' },
+        },
+        sessionName: 'doctor-session',
+        sessionStore,
+        hostDiagnostics: createHostDiagnostics(),
+      }),
+  );
+}
+
+async function runSessionlessDoctor(
+  source: 'host' | 'provider',
+  flags: { targetApp?: string } = {},
+): Promise<DaemonResponse | null> {
+  const inventory =
+    source === 'host'
+      ? { local: async () => [IOS_SIMULATOR] }
+      : {
+          provider: {
+            discover: async () => ({ kind: 'inventory' as const, devices: [IOS_SIMULATOR] }),
+          },
+        };
+  return await withTestDeviceInventory(
+    inventory,
+    async () =>
+      await handleDoctorCommand({
+        req: { token: 't', session: 'default', command: 'doctor', positionals: [], flags },
+        sessionName: 'default',
+        sessionStore: makeSessionStore('agent-device-doctor-warmup-'),
+        hostDiagnostics: createHostDiagnostics(),
+      }),
+  );
 }
 
 function readCheck(response: DaemonResponse | null, id: string): Record<string, unknown> | null {
@@ -163,3 +184,32 @@ test('doctor skips the runner warmup for provider-backed devices', async () => {
   expect(mockAppleRunnerWarmupCheck).toHaveBeenCalledWith(IOS_SIMULATOR, expect.any(Object));
   expect(readCheck(response, 'ios-runner-cache')).toBeNull();
 });
+
+const SESSIONLESS_WARMUP_CANDIDATES = [
+  { name: 'an inventory simulator', flags: {} },
+  { name: 'the --app device', flags: { targetApp: 'com.example.demo' } },
+];
+
+test.each(SESSIONLESS_WARMUP_CANDIDATES)(
+  'doctor warms the runner cache for $name this host discovered',
+  async ({ flags }) => {
+    const response = await runSessionlessDoctor('host', flags);
+
+    expect(response?.ok).toBe(true);
+    expect(mockAppleRunnerWarmupCheck).toHaveBeenCalledTimes(1);
+    expect(mockAppleRunnerWarmupCheck).toHaveBeenCalledWith(
+      expect.objectContaining({ id: IOS_SIMULATOR.id }),
+      expect.any(Object),
+    );
+  },
+);
+
+test.each(SESSIONLESS_WARMUP_CANDIDATES)(
+  'doctor starts no runner warmup for $name a provider reported',
+  async ({ flags }) => {
+    const response = await runSessionlessDoctor('provider', flags);
+
+    expect(response?.ok).toBe(true);
+    expect(mockAppleRunnerWarmupCheck).not.toHaveBeenCalled();
+  },
+);
```

**File**: `src/daemon/handlers/session-doctor-device.ts` (modified, +32/-10)
```diff
@@ -1,5 +1,5 @@
 import { buildDeviceInventoryRequestFromFlags } from '@agent-device/device-selection/dispatch-resolve';
-import { listDeviceInventory } from '@agent-device/device-selection/device-inventory-context';
+import { readDeviceInventory } from '@agent-device/device-selection/device-inventory-context';
 import {
   countDeviceInventoryByGroup,
   LOCAL_DEVICE_INVENTORY_PLATFORM_SELECTORS,
@@ -18,10 +18,13 @@ import { normalizeError } from '@agent-device/kernel/errors';
 import type { DaemonRequest } from '../daemon-request.ts';
 import type { SessionState } from '../session-state.ts';
 import type { DoctorCheck } from '@agent-device/contracts/observability';
+import type { DeviceInventoryDiscovery } from '@agent-device/contracts/platform-module';
 import { appendDoctorCheck } from './session-doctor-output.ts';
 
 export type DoctorDeviceInventory = {
   devices: DeviceInfo[];
+  /** The devices this host discovered itself; a provider-reported device is not on this host. */
+  hostDevices: DeviceInfo[];
   platform?: PlatformSelector;
   target?: DeviceTarget;
 };
@@ -53,7 +56,12 @@ export async function appendDeviceInventoryCheck(
     if (devices.length > 0) {
       appendInventoryFailureChecks(checks, inventory.failures);
     }
-    return { devices, platform: selector.platform, target: selector.target };
+    return {
+      devices,
+      hostDevices: devices.filter((device) => inventory.hostDevices.includes(device)),
+      platform: selector.platform,
+      target: selector.target,
+    };
   } catch (error) {
     const normalized = normalizeError(error);
     appendDoctorCheck(checks, {
@@ -64,7 +72,7 @@ export async function appendDeviceInventoryCheck(
       command: 'agent-device devices',
       evidence: { code: normalized.code, details: normalized.details },
     });
-    return { devices: [], platform: selector.platform, target: selector.target };
+    return { devices: [], hostDevices: [], platform: selector.platform, target: selector.target };
   }
 }
 
@@ -126,23 +134,37 @@ function filterInventoryForSelector(
   );
 }
 
-async function readDoctorDeviceInventory(
-  selector: DeviceInventoryRequest,
-): Promise<{ devices: DeviceInfo[]; failures: DoctorInventoryFailure[] }> {
+async function readDoctorDeviceInventory(selector: DeviceInventoryRequest): Promise<{
+  devices: DeviceInfo[];
+  hostDevices: DeviceInfo[];
+  failures: DoctorInventoryFailure[];
+}> {
   if (selector.platform) {
-    return { devices: await listDeviceInventory(selector), failures: [] };
+    return { ...combineDiscoveries([await readDeviceInventory(selector)]), failures: [] };
   }
 
-  const devices: DeviceInfo[] = [];
+  const discoveries: DeviceInventoryDiscovery[] = [];
   const failures: DoctorInventoryFailure[] = [];
   for (const platform of LOCAL_DEVICE_INVENTORY_PLATFORM_SELECTORS) {
     try {
-      devices.push(...(await listDeviceInventory({ ...selector, platform })));
+      discoveries.push(await readDeviceInventory({ ...selector, platform }));
     } catch (error) {
       failures.push(inventoryFailure(platform, error));
     }
   }
-  return { devices, failures };
+  return { ...combineDiscoveries(discoveries), failures };
+}
+
+function combineDiscoveries(discoveries: readonly DeviceInventoryDiscovery[]): {
+  devices: DeviceInfo[];
+  hostDevices: DeviceInfo[];
+} {
+  return {
+    devices: discoveries.flatMap((discovery) => discovery.devices),
+    hostDevices: discoveries.flatMap((discovery) =>
+      discovery.source === 'local' ? discovery.devices : [],
+    ),
+  };
 }
 
 function appendInventoryFailureChecks(
```

**File**: `src/daemon/handlers/session-doctor.ts` (modified, +9/-4)
```diff
@@ -96,7 +96,7 @@ export async function handleDoctorCommand(params: {
     bindDevice,
     req,
   });
-  const warmupDevice = appCheckDevice ?? resolveWarmupSimulator(inventory);
+  const warmupDevice = session?.device ?? resolveHostWarmupDevice(inventory, appCheckDevice);
   if (warmupDevice) {
     const warmup = await hostDiagnostics.warmupCheck(warmupDevice, context);
     if (warmup) appendDoctorCheck(checks, warmup);
@@ -137,11 +137,16 @@ function hostDiagnosticsContext(
 // background so the first `open` skips the ~10s xcodebuild build. The check
 // line makes the warmup visible either way. Any simulator record works as
 // the build device — the artifact builds against a generic simulator
-// destination and is shared across simulators and runtimes.
-function resolveWarmupSimulator(
+// destination and is shared across simulators and runtimes. Inventory names
+// the device only from what this host discovered: a provider-reported
+// simulator is not on this host, so the host runner cache is not its to warm.
+function resolveHostWarmupDevice(
   inventory: DoctorDeviceInventory | undefined,
+  appCheckDevice: DeviceInfo | undefined,
 ): DeviceInfo | undefined {
-  const simulators = (inventory?.devices ?? []).filter(
+  const hostDevices = inventory?.hostDevices ?? [];
+  if (appCheckDevice) return hostDevices.includes(appCheckDevice) ? appCheckDevice : undefined;
+  const simulators = hostDevices.filter(
     (device) => isIosFamily(device) && device.kind === 'simulator',
   );
   return simulators.find((device) => device.booted === true) ?? simulators[0];
```

---

### Incident Patch 7: `7c1489bb` (2026-10-05)
**Commit Message**: fix(apple): start no host runner cache build while a provider serves Apple tooling (#3225)

The readiness keep-hot prewarm called prewarmAppleRunnerCache with no request
id, so it reached the host xcodebuild even when a scoped Apple tool provider
served the request. On macOS every provider-scenario iOS open started a real
build-for-testing in the background; the lease-expiry parity test then hit
the hermetic signal guard when teardown pkill'd that build's children.

The cache prewarm is speculative host work, so it now declines (debug
diagnostic ios_runner_cache_prewarm_unavailable) while a provider serves Apple
tooling, the same rule the macOS helper build already follows.

**File**: `packages/platform-apple/src/core/runner-host.ts` (modified, +7/-1)
```diff
@@ -44,7 +44,12 @@ import {
   getRunnerLeaseOwnerStateDir,
 } from './runner-owner-state.ts';
 import { buildSimctlArgsForDevice, simulatorAddressFor } from './simctl.ts';
-import { readApplePlistJson, runAppleToolCommand, runXcrun } from './tool-provider.ts';
+import {
+  hasScopedAppleToolProvider,
+  readApplePlistJson,
+  runAppleToolCommand,
+  runXcrun,
+} from './tool-provider.ts';
 
 /**
  * The real host capabilities for `@agent-device/platform-apple/runner`: the one place
@@ -97,6 +102,7 @@ export const appleRunnerHost: AppleRunnerHost = {
   runAppleToolCommand,
   runXcrun,
   readApplePlistJson,
+  hasScopedAppleToolProvider,
   buildSimctlArgsForDevice,
   simulatorAddressFor,
   resolveIosPhysicalDeviceControl,
```

**File**: `packages/platform-apple/src/runner/__tests__/runner-client-prewarm.test.ts` (modified, +56/-7)
```diff
@@ -4,13 +4,19 @@ import { AppError } from '@agent-device/kernel/errors';
 import { IOS_SIMULATOR } from './device-fixtures.ts';
 import { makeRunnerSession } from './runner-session-fixtures.ts';
 import { appleRunnerTestHost } from '../test-host.ts';
+import { createLocalAppleToolProvider, withAppleToolProvider } from '../../core/tool-provider.ts';
 
-const { mockEnsureRunnerSession, mockExecuteRunnerCommandWithSession, mockEmitDiagnostic } =
-  vi.hoisted(() => ({
-    mockEnsureRunnerSession: vi.fn(),
-    mockExecuteRunnerCommandWithSession: vi.fn(),
-    mockEmitDiagnostic: vi.fn(),
-  }));
+const {
+  mockEnsureRunnerSession,
+  mockExecuteRunnerCommandWithSession,
+  mockEnsureXctestrunArtifact,
+  mockEmitDiagnostic,
+} = vi.hoisted(() => ({
+  mockEnsureRunnerSession: vi.fn(),
+  mockExecuteRunnerCommandWithSession: vi.fn(),
+  mockEnsureXctestrunArtifact: vi.fn(),
+  mockEmitDiagnostic: vi.fn(),
+}));
 
 vi.mock('../runner-session.ts', async () => {
   const actual =
@@ -22,7 +28,13 @@ vi.mock('../runner-session.ts', async () => {
   };
 });
 
-import { prewarmIosRunnerSession } from '../runner-client.ts';
+vi.mock('../runner-xctestrun.ts', async () => {
+  const actual =
+    await vi.importActual<typeof import('../runner-xctestrun.ts')>('../runner-xctestrun.ts');
+  return { ...actual, ensureXctestrunArtifact: mockEnsureXctestrunArtifact };
+});
+
+import { prewarmAppleRunnerCache, prewarmIosRunnerSession } from '../runner-client.ts';
 
 beforeEach(() => {
   vi.resetAllMocks();
@@ -82,3 +94,40 @@ test('prewarmIosRunnerSession can propagate setup failures for blocking callers'
   });
   assert.equal(mockEnsureRunnerSession.mock.calls[0]?.[1]?.propagateError, undefined);
 });
+
+test('prewarmAppleRunnerCache builds the runner artifact when the host serves Apple tooling', async () => {
+  mockEnsureXctestrunArtifact.mockResolvedValueOnce({});
+
+  await prewarmAppleRunnerCache(IOS_SIMULATOR, { requestId: 'cache-request' });
+
+  assert.equal(mockEnsureXctestrunArtifact.mock.calls.length, 1);
+  assert.equal(mockEnsureXctestrunArtifact.mock.calls[0]?.[0], IOS_SIMULATOR);
+  assert.equal(mockEnsureXctestrunArtifact.mock.calls[0]?.[1]?.requestId, 'cache-request');
+});
+
+test('prewarmAppleRunnerCache starts no host build while a provider serves Apple tooling', async () => {
+  const providerCalls: string[] = [];
+  const scriptedTools = createLocalAppleToolProvider({
+    runCommand: async (cmd, args) => {
+      providerCalls.push([cmd, ...args].join(' '));
+      throw new Error('a cache prewarm must not reach provider-served Apple tooling');
+    },
+  });
+
+  const scoped = await withAppleToolProvider(scriptedTools, async () => ({
+    prewarm: prewarmAppleRunnerCache(IOS_SIMULATOR, { requestId: 'provider-request' }),
+  }));
+
+  assert.equal(scoped.prewarm, undefined);
+  assert.equal(mockEnsureXctestrunArtifact.mock.calls.length, 0);
+  assert.deepEqual(providerCalls, []);
+  assert.deepEqual(mockEmitDiagnostic.mock.calls, [
+    [
+      {
+        level: 'debug',
+        phase: 'ios_runner_cache_prewarm_unavailable',
+        data: { deviceId: IOS_SIMULATOR.id },
+      },
+    ],
+  ]);
+});
```

**File**: `packages/platform-apple/src/runner/host.ts` (modified, +5/-1)
```diff
@@ -81,7 +81,10 @@ export type AppleRunnerHost = Pick<
   Pick<typeof KernelSourceValue, 'parseBooleanLiteral'> &
   Pick<typeof KernelDeviceShell, 'shellQuote'> &
   Pick<typeof BootDiagnostics, 'classifyBootFailure' | 'bootFailureHint'> &
-  Pick<typeof AppleToolProvider, 'runAppleToolCommand' | 'runXcrun' | 'readApplePlistJson'> &
+  Pick<
+    typeof AppleToolProvider,
+    'runAppleToolCommand' | 'runXcrun' | 'readApplePlistJson' | 'hasScopedAppleToolProvider'
+  > &
   Pick<typeof AppleSimctl, 'buildSimctlArgsForDevice' | 'simulatorAddressFor'> &
   Pick<typeof ApplePlistXml, 'visitXmlPlistEntries'> & {
     /**
@@ -185,6 +188,7 @@ export const bootFailureHint = delegate('bootFailureHint');
 export const runAppleToolCommand = delegate('runAppleToolCommand');
 export const runXcrun = delegate('runXcrun');
 export const readApplePlistJson = delegate('readApplePlistJson');
+export const hasScopedAppleToolProvider = delegate('hasScopedAppleToolProvider');
 export const buildSimctlArgsForDevice = delegate('buildSimctlArgsForDevice');
 export const simulatorAddressFor = delegate('simulatorAddressFor');
 export const visitXmlPlistEntries = delegate('visitXmlPlistEntries');
```

**File**: `packages/platform-apple/src/runner/runner-client.ts` (modified, +10/-1)
```diff
@@ -1,4 +1,4 @@
-import { retryWithPolicy, emitDiagnostic } from './host.ts';
+import { retryWithPolicy, emitDiagnostic, hasScopedAppleToolProvider } from './host.ts';
 import { isIosFamily, type DeviceInfo } from '@agent-device/kernel/device';
 import {
   ensureRunnerSession,
@@ -119,13 +119,22 @@ type PrewarmIosRunnerOptions = AppleRunnerPrewarmOptions & {
   propagateError?: boolean;
 };
 
+/** Speculative host build: a request whose Apple tooling a provider serves has none to warm. */
 export function prewarmAppleRunnerCache(
   device: DeviceInfo,
   options: PrewarmIosRunnerOptions = {},
 ): Promise<void> | undefined {
   if (!isIosFamily(device)) {
     return undefined;
   }
+  if (hasScopedAppleToolProvider()) {
+    emitDiagnostic({
+      level: 'debug',
+      phase: 'ios_runner_cache_prewarm_unavailable',
+      data: { deviceId: device.id },
+    });
+    return undefined;
+  }
   return runBestEffortIosRunnerPrewarm({
     device,
     options,
```

---

### Incident Patch 8: `df7ad0c8` (2026-10-05)
**Commit Message**: fix(settings): let clear-app-state take its app from --app and refuse two apps (#3179) (#3211)

`settings clear-app-state --app com.example.app` dropped the named app: the CLI only folded
`--app` into the settings whose app has no positional, so the clear fell through to the session
app, a destructive change to an app the caller never named. A positional app plus a different
`--app` silently kept the positional.

The clear-app-state parse now resolves its app from the positional or `--app`, and refuses a
positional and a different `--app` as a contradiction instead of picking one.

**File**: `src/commands/capture/settings.test.ts` (modified, +30/-7)
```diff
@@ -193,20 +193,43 @@ describe('settings CLI permission vocabulary', () => {
     });
   });
 
-  // The flag bag carries a configured default app the parser strips for settings; the reader still
-  // gets exercised with one present, so the clear-app-state branch cannot regress into letting
-  // `--app` redirect this destructive mutation away from the positional id.
+  // The parser strips a configured default before the reader runs, so a `--app` the reader sees was
+  // typed on this invocation. A destructive clear must land on the app the caller named, never fall
+  // through to the session app or pick one of two named apps.
   test('keeps a clear-app-state app positional and out of the request input', () => {
-    const input = settingsCliReader(['clear-app-state', 'com.example.app'], {
-      targetApp: 'com.example.other',
-    } as CliFlags);
+    const input = settingsCliReader(['clear-app-state', 'com.example.app'], flags());
     const writer = settingsDaemonWriter(input);
     expect(writer.positionals).toEqual(['clear-app-state', 'com.example.app']);
     expect(writer.input).toBeUndefined();
-    // The app the input carries is the positional, never the flag bag's default.
     expect(input).toMatchObject({ app: 'com.example.app' });
   });
 
+  test.each([[['clear-app-state']], [['clear-app-state', 'clear']]])(
+    'aims %j at the --app it names when no positional does',
+    (positionals) => {
+      const input = settingsCliReader(positionals, { targetApp: 'com.example.app' } as CliFlags);
+      expect(settingsDaemonWriter(input).positionals).toEqual([
+        'clear-app-state',
+        'com.example.app',
+      ]);
+    },
+  );
+
+  test('accepts the same app named positionally and with --app', () => {
+    const input = settingsCliReader(['clear-app-state', 'clear', 'com.example.app'], {
+      targetApp: 'com.example.app',
+    } as CliFlags);
+    expect(settingsDaemonWriter(input).positionals).toEqual(['clear-app-state', 'com.example.app']);
+  });
+
+  test('refuses a clear-app-state that names two different apps', () => {
+    expect(() =>
+      settingsCliReader(['clear-app-state', 'com.example.app'], {
+        targetApp: 'com.example.other',
+      } as CliFlags),
+    ).toThrow(/names two apps: com.example.app and com.example.other/);
+  });
+
   test('omits the request input when no app is named', () => {
     expect(
       settingsDaemonWriter(settingsCliReader(['animations', 'off'], flags())).input,
```

**File**: `src/commands/capture/settings.ts` (modified, +22/-6)
```diff
@@ -68,9 +68,9 @@ const settingsCliSchema = {
 
 export const settingsCliReader: CliReader = (positionals, flags) => {
   const options = readSettingsOptionsFromPositionals(positionals, flags);
-  // `clear-app-state` already names its app positionally, so `--app` fills the slot only for the
-  // settings whose app has no positional. Whether a mutation can consume an app at all is the
-  // daemon's scope table to decide once it knows the resolved target.
+  // `clear-app-state` resolves `--app` against its own positional slot while it parses, so the
+  // option is added here only for the settings whose app has no positional. Whether a mutation can
+  // consume an app at all is the daemon's scope table to decide once it knows the resolved target.
   return options.setting === 'clear-app-state' || flags.targetApp === undefined
     ? options
     : { ...options, app: flags.targetApp };
@@ -105,7 +105,7 @@ export const settingsCommandFacet = defineCommandFacet({
   name: SETTINGS_COMMAND_NAME,
   text: {
     summary: 'Change OS settings and app permissions',
-    cliDetail: `macOS supports only settings appearance <light|dark|toggle> and settings ${SETTINGS_MACOS_PERMISSION_USAGE}; wifi|airplane|location|animations|text-size remain unsupported on macOS. Mobile permission actions default to the active session app; pass --app <id> (or the app input) to aim a permission change, or an iOS-simulator location on|off, at an installed app no session has opened; no app needs to be running, and the CLI consumes the app only when this invocation names it, never from AGENT_DEVICE_TARGET_APP or config targetApp. A device-wide change refuses an app with setting_app_not_consumed: location set moves the device's own coordinates on every target, the Android location toggle writes the device's location_mode, and a macOS permission is a host-level TCC grant. On Android, deny|reset of a permission the app currently holds kills a running app; the response reports priorGrantState (granted|not_granted|unknown) and warns for granted and unknown, with open <app> --relaunch to restore it. Permission changes require a resolvable foreground user and fail without mutating if adb cannot report one. Android settings airplane on|off is applied by the connectivity service (Android 11+) and reports the airplaneMode that service holds; older builds fail without changing device state. settings reset-keychain clear is iOS-simulator-only and resets the whole simulator keychain, not just the selected app: simctl exposes no per-app keychain reset, so every app on that simulator loses its keychain-backed credentials (e.g. Firebase auth). clear-app-state does not touch the keychain, so a full fresh-install reset needs both; relaunch the app afterward to observe the signed-out state. settings text-size reads the preferred text size the target holds and settings text-size <category> applies one, on iPhone and iPad simulators (simctl content size) and on Android targets (system font_scale); tvOS and visionOS simulators, physical Apple devices, and the macOS host refuse it. Android has no category ladder of its own, so the read names the nearest rung and reports the exact multiplier as platformValue; an already-running app adopts a changed size at its next configuration change, so relaunch the app under test to observe it.`,
+    cliDetail: `macOS supports only settings appearance <light|dark|toggle> and settings ${SETTINGS_MACOS_PERMISSION_USAGE}; wifi|airplane|location|animations|text-size remain unsupported on macOS. Mobile permission actions default to the active session app; pass --app <id> (or the app input) to aim a permission change, or an iOS-simulator location on|off, at an installed app no session has opened; no app needs to be running, and the CLI consumes the app only when this invocation names it, never from AGENT_DEVICE_TARGET_APP or config targetApp. clear-app-state takes its app positionally or with --app, and refuses two different apps. A device-wide change refuses an app with setting_app_not_consumed: location set moves the device's own coordinates on every target, the Android location toggle writes the device's location_mode, and a macOS permission is a host-level TCC grant. On Android, deny|reset of a permission the app currently holds kills a running app; the response reports priorGrantState (granted|not_granted|unknown) and warns for granted and unknown, with open <app> --relaunch to restore it. Permission changes require a resolvable foreground user and fail without mutating if adb cannot report one. Android settings airplane on|off is applied by the connectivity service (Android 11+) and reports the airplaneMode that service holds; older builds fail without changing device state. settings reset-keychain clear is iOS-simulator-only and resets the whole simulator keychain, not just the selected app: simctl exposes no per-app keychain reset, so every app on that simulator loses its keychain-backed credentials (e.g. Firebase auth
```

**File**: `website/docs/docs/commands.md` (modified, +1/-1)
```diff
@@ -789,7 +789,7 @@ agent-device settings permission reset screen-recording --platform macos
 - Android has no category ladder, only a `font_scale` multiplier, so the two are mapped: `large` is `1.0` up through `accessibility-extra-extra-extra-large` at `3.2`. A device holding a multiplier off that ladder reads back as the nearest rung with the exact multiplier as `platformValue`, and an unset `font_scale` reads as `large`/`1.0`.
 - A text size change is a configuration change: an app already running adopts it on its next configuration change, so relaunch the app under test (`open <app> --relaunch`) when asserting rendered sizes.
 - `settings location set <lat> <lon>` sets precise coordinates on iOS simulators and Android emulators.
-- `settings clear-app-state [app-id]` clears the active session app data, or the provided app id. Android uses `pm clear`, which removes SharedPreferences, databases, files, and cache. iOS simulator removes the app data container contents and leaves the fresh-install directory layout (empty `Documents`, `Library/Caches`, `Library/Preferences`, `SystemData`, and `tmp`, as on iOS 26.5; other runtimes may differ). With no app bound to the session and no app id named, it refuses with `error.details.reason: session_app_required` and `dispatched: no`. iOS physical devices and macOS are unsupported. It does not touch the keychain, so keychain-backed credentials (e.g. Firebase auth) survive it.
+- `settings clear-app-state [app-id]` clears the active session app data, or the provided app id. The app id can also be named with `--app` (`settings clear-app-state --app com.example.app`); naming two different apps, one positionally and one with `--app`, is refused with `INVALID_ARGS`. Android uses `pm clear`, which removes SharedPreferences, databases, files, and cache. iOS simulator removes the app data container contents and leaves the fresh-install directory layout (empty `Documents`, `Library/Caches`, `Library/Preferences`, `SystemData`, and `tmp`, as on iOS 26.5; other runtimes may differ). With no app bound to the session and no app id named, it refuses with `error.details.reason: session_app_required` and `dispatched: no`. iOS physical devices and macOS are unsupported. It does not touch the keychain, so keychain-backed credentials (e.g. Firebase auth) survive it.
 - `settings reset-keychain clear` resets the iOS simulator's keychain (`xcrun simctl keychain <device> reset`), removing keychain-backed credentials such as Firebase auth tokens that `clear-app-state` leaves behind. simctl has no per-app keychain reset, so this clears the keychain for every app installed on that simulator, not only the app under test — treat it as a whole-simulator, opt-in operation and pair it with `clear-app-state` for a full fresh-install reset. iOS physical devices, Android, and macOS are unsupported.
 - Face ID and Touch ID controls are iPhone and iPad simulator-only; Apple TV and Vision Pro simulators refuse them. They post the same Darwin notifications the Simulator.app Features menu posts (`xcrun simctl spawn <device> notifyutil`): `com.apple.BiometricKit_Sim.<pearl|fingerTouch>.<match|nomatch>` for match/nonmatch, and `com.apple.BiometricKit.enrollmentChanged` (set to `1`/`0`, then posted, then read back) for enroll/unenroll. No `simctl biometric` subcommand exists, so this route works on any Xcode.
 - Android `settings airplane on|off` is applied by the connectivity service (`cmd connectivity airplane-mode`, Android 11+), which drives the radios rather than only writing the `airplane_mode_on` setting. The response reports the `airplaneMode` that service holds after the change, and Android builds without that command fail without changing device state. Connectivity takes a moment to settle after the switch, so poll the app under test rather than asserting offline behavior immediately.
```

---

### Incident Patch 9: `a12fc9d8` (2026-10-05)
**Commit Message**: fix(daemon): disclose drag ref refusals before dispatch (#3215)

* fix(daemon): disclose drag ref refusals before dispatch

* test(daemon): type Android recovery snapshot fixture

* fix(daemon): preserve recovery warning on drag refusal

**File**: `contracts/fixtures/dispatch-disclosure.json` (modified, +18/-0)
```diff
@@ -17,6 +17,24 @@
     "trigger": "fill admission (admitFill) refused the request before any backend call, e.g. a target with no text",
     "dispatched": "no"
   },
+  {
+    "id": "daemon.refusal.gesture-drag-admission",
+    "producer": "daemon",
+    "trigger": "a drag target's @ref admission refused before the gesture runtime was bound, without an earlier readiness recovery",
+    "dispatched": "no"
+  },
+  {
+    "id": "daemon.post-dispatch.gesture-drag-after-recovery",
+    "producer": "daemon",
+    "trigger": "Android readiness tapped Close app and relaunched the app, then drag ref admission refused before the gesture runtime was bound",
+    "dispatched": "unknown"
+  },
+  {
+    "id": "daemon.post-dispatch.ref-after-android-recovery",
+    "producer": "daemon",
+    "trigger": "Android blocking-dialog readiness tapped Close app and relaunched the app, then re-admission aborted the requested ref press",
+    "dispatched": "unknown"
+  },
   {
     "id": "daemon.refusal.selector-readiness-exhausted",
     "producer": "daemon",
```

**File**: `src/daemon/interaction/internal/__tests__/interaction-dispatch-disclosure.test.ts` (modified, +114/-1)
```diff
@@ -25,11 +25,16 @@ import {
 } from '../../../request-dispatch-ledger.ts';
 import type { BindDeviceRuntime } from '../../../request-runtime-binding.ts';
 import { clearAndroidObservationFixture } from '../../../__tests__/android-observation-fixture.ts';
+import { activateCompleteRefFrame, expireRefFrame } from '../../../ref-frame.ts';
 import { handleInteractionCommands } from '../../index.ts';
 import type { InteractionRouteInput } from '../types.ts';
 import { assertAndroidPressStayedInApp } from '../interaction-android-escape.ts';
 import { gestureRuntimeBindingsFixture } from './gesture-runtime-bindings.fixtures.ts';
-import { contextFromFlags, makeSession } from './interaction-touch-fixtures.ts';
+import {
+  contextFromFlags,
+  makeSession,
+  makeStaleRefSession,
+} from './interaction-touch-fixtures.ts';
 
 // contracts/fixtures/dispatch-disclosure.json, daemon and post-action guard rows: the daemon rows
 // drive a real `press` through the daemon interaction handler, inside the router's dispatch seam,
@@ -210,6 +215,110 @@ async function swipeRefusedOnSecondRepetition(): Promise<unknown> {
   throw new AppError(response.error.code, response.error.message, response.error.details);
 }
 
+/** A stale drag ref is rejected before binding any gesture operation. */
+async function gestureDragRefusedBeforeDispatch(): Promise<unknown> {
+  const gestures = gestureRuntimeBindingsFixture();
+  const sessionStore = makeSessionStore();
+  const session = makeStaleRefSession('dispatch-disclosure-stale-drag');
+  expireRefFrame(session);
+  sessionStore.publish(session.name, session);
+  const response = await routeInteraction({
+    req: {
+      token: 't',
+      session: session.name,
+      command: 'gesture',
+      positionals: [],
+      flags: {},
+      input: {
+        kind: 'drag',
+        source: '@e1',
+        destination: '@e2',
+        sourceHoldMs: 100,
+        moveMs: 100,
+        destinationHoldMs: 100,
+      },
+    },
+    sessionName: session.name,
+    sessionStore,
+    contextFromFlags,
+    inspectFacts: gestures.inspectFacts,
+    bindDevice: gestures.bindDevice,
+  });
+  assert.ok(response && !response.ok, 'expected stale drag admission to fail');
+  assert.equal(response.error.details?.reason, 'ref_frame_expired');
+  assert.equal(gestures.bindDevice.mock.calls.length, 0, 'admission must precede runtime binding');
+  throw new AppError(response.error.code, response.error.message, response.error.details);
+}
+
+async function refRefusedAfterAndroidRecovery(command: 'press' | 'gesture'): Promise<unknown> {
+  const gestures = gestureRuntimeBindingsFixture();
+  const sessionStore = makeSessionStore();
+  const session = makeAndroidSession('dispatch-disclosure-recovered-drag', {
+    appBundleId: 'com.example.app',
+  });
+  session.snapshot = makeStaleRefSession('recovery-frame').snapshot;
+  activateCompleteRefFrame(session);
+  sessionStore.publish(session.name, session);
+  const tap = vi.fn(clearAndroidObservationFixture.tap);
+  const openApp = vi.fn(clearAndroidObservationFixture.openApp);
+  const androidObservation: AndroidObservationAdapter = {
+    ...clearAndroidObservationFixture,
+    readBlockingDialog: async () => ({
+      status: 'dialog',
+      focus: { package: 'com.example.app', focusedWindow: 'Application Not Responding', raw: '' },
+    }),
+    readSnapshotNodes: async () => [
+      {
+        index: 0,
+        ref: 'e0',
+        type: 'Button',
+        label: 'Close app',
+        rect: { x: 10, y: 20, width: 100, height: 40 },
+      },
+    ],
+    tap,
+    openApp,
+  };
+  const response = await routeInteraction({
+    req: {
+      token: 't',
+      session: session.name,
+      command,
+      positionals: command === 'press' ? ['@e1'] : [],
+      flags: {},
+      input: {
+        kind: 'drag',
+        source: '@e1',
+        destination: '@e2',
+        sourceHoldMs: 100,
+        moveMs: 100,
+        destinationHoldMs: 100,
+      },
+    },
+    sessionName: session.name,
+    sessionStore,
+    contextFromFlags,
+    ...(command === 'gesture'
+      ? { inspectFacts: gestures.inspectFacts, bindDevice: gestures.bindDevice }
+      : getRuntimeBindings()),
+    androidObservation,
+  });
+  assert.ok(response && !response.ok, 'expected stale drag admission to fail after recovery');
+  assert.equal(response.error.details?.reason, 'ref_frame_expired');
+  assert.equal(tap.mock.calls.length, 1);
+  assert.equal(openApp.mock.calls.length, 1);
+  assert.equal(mockTapPoint.mock.calls.length, 0);
+  if (command === 'gesture') {
+    assert.equal(gestures.bindDevice.mock.calls.length, 0);
+    assert.equal(
+      response.error.details?.warning,
+      'Recovered Android app ANR before gesture: closed and relaunched com.example.app.',
+    );
+    assert.match(response.error.hint ?? '', /Capture a fresh interactive snapshot/);
+  }
+  throw new AppError(response.error.code, response.error.message, response.error.details);
+}
+
 /** An Andr
```

**File**: `src/daemon/interaction/internal/interaction-gesture.ts` (modified, +32/-12)
```diff
@@ -18,7 +18,7 @@ import {
   SWIPE_REPETITION_MAX,
   SWIPE_SERIES_MAX_SCHEDULED_DURATION_MS,
 } from '@agent-device/contracts/scroll-gesture';
-import { AppError, normalizeError } from '@agent-device/kernel/errors';
+import { AppError, asAppError, normalizeError } from '@agent-device/kernel/errors';
 import {
   REF_GRAMMAR_HINT,
   splitRefGenerationSuffix,
@@ -27,9 +27,13 @@ import {
 import { resolveBoundGestureRuntime, type BoundGestureExecutor } from '../../gesture-runtime.ts';
 import { isActiveProviderDevice } from '../../provider-device-admission.ts';
 import { sleep } from '@agent-device/host-kit/retry';
-import { ensureAndroidBlockingSystemDialogReady } from '../../android-system-dialog.ts';
+import {
+  ensureAndroidBlockingSystemDialogReady,
+  type AndroidBlockingDialogReadinessResult,
+} from '../../android-system-dialog.ts';
 import { readRefMutationFrame } from '../../ref-frame.ts';
 import type { DaemonResponse } from '../../daemon-request.ts';
+import { thrownBeforeDispatch } from '../../request-dispatch-disclosure.ts';
 import type { SessionState } from '../../session-state.ts';
 import { assertRefMutationAdmitted } from './interaction-ref-policy.ts';
 import {
@@ -73,17 +77,18 @@ export async function dispatchGestureViaRuntime(
   params: GestureHandlerParams,
 ): Promise<DaemonResponse> {
   params = bindInteractionSession(params);
-  return await dispatchGestureInteraction(params, 'gesture', async (session) =>
-    runGestureInteraction(params, session),
+  return await dispatchGestureInteraction(params, 'gesture', async (session, readiness) =>
+    runGestureInteraction(params, session, readiness),
   );
 }
 
 async function runGestureInteraction(
   params: GestureHandlerParams,
   session: SessionState,
+  readiness: AndroidBlockingDialogReadinessResult,
 ): Promise<GestureInteractionResult> {
   const input = readGesturePayload(params.req.input);
-  const gesture = prepareGestureCommandInput(input, session);
+  const gesture = prepareGestureCommandInput(input, session, readiness);
   if (gesture.intent === 'pan' && params.req.internal?.gestureExecutionProfile) {
     gesture.executionProfile = params.req.internal.gestureExecutionProfile;
   }
@@ -207,7 +212,10 @@ function createGestureRuntime(params: GestureHandlerParams, gestures: BoundGestu
 async function dispatchGestureInteraction(
   params: GestureHandlerParams,
   command: 'gesture' | 'swipe',
-  run: (session: SessionState) => Promise<GestureInteractionResult>,
+  run: (
+    session: SessionState,
+    readiness: AndroidBlockingDialogReadinessResult,
+  ) => Promise<GestureInteractionResult>,
 ): Promise<DaemonResponse> {
   const session = params.sessionStore.get(params.sessionName);
   if (!session) return noActiveSessionError();
@@ -222,7 +230,7 @@ async function dispatchGestureInteraction(
           phase: 'before-command',
           observation: params.androidObservation,
         });
-    const outcome = await run(session);
+    const outcome = await run(session, readiness);
     if (isRefusal(outcome)) return outcome.refused;
     if (!providerDevice) {
       await ensureAndroidBlockingSystemDialogReady({
@@ -268,14 +276,26 @@ function resolveExecutionProfile(
 function prepareGestureCommandInput(
   input: GesturePayload,
   session: SessionState,
+  readiness: AndroidBlockingDialogReadinessResult,
 ): GestureCommandInput {
   const normalized = normalizeGestureCommandInput(input);
   if (normalized.intent !== 'drag') return normalized;
-  return {
-    ...normalized,
-    source: prepareDragTarget(normalized.source, session),
-    destination: prepareDragTarget(normalized.destination, session),
-  };
+  try {
+    return {
+      ...normalized,
+      source: prepareDragTarget(normalized.source, session),
+      destination: prepareDragTarget(normalized.destination, session),
+    };
+  } catch (error) {
+    if (readiness.status === 'recovered') {
+      const failure = asAppError(error);
+      const existingWarning =
+        typeof failure.details?.warning === 'string' ? failure.details.warning + ' ' : '';
+      failure.details = { ...failure.details, warning: existingWarning + readiness.warning };
+      throw failure;
+    }
+    throw thrownBeforeDispatch(error);
+  }
 }
 
 function prepareDragTarget(target: string, session: SessionState): string {
```

---

### Incident Patch 10: `97aa8116` (2026-10-05)
**Commit Message**: fix(android): read the package from binary manifests at the spec attribute offset (#3203)

* fix(android): read the package from binary Android manifests at the spec attribute offset

The installed-package identity for an APK install came from aapt or a
before/after package-inventory diff, so a reinstall on a device that
already carried the app resolved nothing, and hosts without aapt
resolved nothing at all. Parse AndroidManifest.xml inside the APK
directly: walk the AXML string pool and element chunks with the AOSP
ResourceTypes validation rules (chunk fits the parent, whole attribute
array fits the chunk before any record is read, pool offset table is
derived from headerSize), and read the package attribute at its spec
offset. Keep aapt as a fallback, and add the macOS Android Studio SDK
root to SDK discovery; hostPlatform now enters through a function-scoped
import so the platform facade closure stays as lazy as ADR-0019 demands.

Closes #3176

* chore(gates): let the Android fixture owner cover colocated binary fixtures

**File**: `packages/platform-android/src/__tests__/sdk.test.ts` (modified, +21/-8)
```diff
@@ -42,16 +42,29 @@ async function withTempSdkLayout(
   }
 }
 
-test('resolveAndroidSdkRoots prefers configured roots before HOME default', () => {
-  const roots = resolveAndroidSdkRoots({
-    HOME: '/tmp/home',
-    ANDROID_HOME: '/tmp/android-home',
-    ANDROID_SDK_ROOT: '/tmp/android-sdk-root',
-  });
-  assert.deepEqual(roots, [
+const CONFIGURED_ENV = {
+  HOME: '/tmp/home',
+  ANDROID_HOME: '/tmp/android-home',
+  ANDROID_SDK_ROOT: '/tmp/android-sdk-root',
+};
+
+test('resolveAndroidSdkRoots orders configured roots, the macOS Studio SDK, then HOME default', () => {
+  const linuxHome = path.join('/tmp/home', 'Android', 'Sdk');
+  assert.deepEqual(resolveAndroidSdkRoots(CONFIGURED_ENV, 'linux'), [
+    '/tmp/android-sdk-root',
+    '/tmp/android-home',
+    linuxHome,
+  ]);
+  // The Studio layout joins the search only on macOS, between the env roots and the default.
+  assert.deepEqual(resolveAndroidSdkRoots(CONFIGURED_ENV, 'darwin'), [
     '/tmp/android-sdk-root',
     '/tmp/android-home',
-    path.join('/tmp/home', 'Android', 'Sdk'),
+    path.join('/tmp/home', 'Library', 'Android', 'sdk'),
+    linuxHome,
+  ]);
+  assert.deepEqual(resolveAndroidSdkRoots({ HOME: '/Users/dev' }, 'darwin'), [
+    '/Users/dev/Library/Android/sdk',
+    '/Users/dev/Android/Sdk',
   ]);
 });
 
```

**File**: `packages/platform-android/src/deployment/native.test.ts` (modified, +15/-0)
```diff
@@ -17,6 +17,7 @@ const device: DeviceInfo = {
   booted: true,
 };
 
+const INVENTORY = 'package:com.example.app\npackage:com.android.shell\n';
 const run = vi.fn();
 const dispose = vi.fn(async () => {});
 
@@ -77,6 +78,20 @@ test('constructs a signal-bound adb install in the Android package', async () =>
   );
 });
 
+test('the package inventory diff alone resolves nothing for a reinstall', async () => {
+  // The closest negative to install-artifact.test.ts's reinstall proof: the inventory is
+  // identical before and after, so the diff sees no new package and resolves nothing.
+  run.mockResolvedValue({ stdout: INVENTORY, stderr: '', exitCode: 0 });
+  const host = hostFixture();
+  const signal = new AbortController().signal;
+  await expect(
+    installAndroidArtifact(host, device, '/tmp/app.apk', undefined, signal),
+  ).resolves.toBeUndefined();
+  // The APK must really be reinstalled; the inventories resolve nothing even without it.
+  expect(run).toHaveBeenCalledWith(expect.objectContaining({ executable: 'adb-install' }), signal);
+  expect(run.mock.calls.filter(([request]) => request.executable === 'adb')).toHaveLength(2);
+});
+
 test('owns bundletool command construction and temporary output cleanup', async () => {
   const host = hostFixture({ bundletool: true });
   const signal = new AbortController().signal;
```

**File**: `packages/platform-android/src/install-artifact.test.ts` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+import assert from 'node:assert/strict';
+import type { PlatformRuntimeHost } from '@agent-device/contracts/platform-runtime-operations';
+import { test } from 'vitest';
+import { bindAndroidAdbHostStub } from './adb-host.fixtures.ts';
+import {
+  ANDROID_MANIFEST_APK_FIXTURE_PATH,
+  ANDROID_MANIFEST_FIXTURE_PACKAGE,
+} from './manifest.fixtures.ts';
+import { installAndroidArtifact } from './deployment/native.ts';
+import { prepareAndroidInstallArtifact } from './install-artifact.ts';
+import { ANDROID_EMULATOR } from './__tests__/test-utils/device-fixtures.ts';
+
+test('installing an already-installed APK resolves its package with no aapt reachable', async () => {
+  // The stub host answers `isExecutable` as false, so no `aapt` is reachable and the identity can
+  // only come from the artifact's binary manifest. The device inventory is identical before and
+  // after — the diff resolves nothing — and no adb call may run. The closest negative — the same
+  // install without the artifact identity — lives in deployment/native.test.ts.
+  bindAndroidAdbHostStub();
+  const artifact = await prepareAndroidInstallArtifact({
+    kind: 'path',
+    path: ANDROID_MANIFEST_APK_FIXTURE_PATH,
+  });
+  try {
+    assert.equal(artifact.packageName, ANDROID_MANIFEST_FIXTURE_PACKAGE);
+    const adbCalls: string[][] = [];
+    const stdout = `package:${ANDROID_MANIFEST_FIXTURE_PACKAGE}\npackage:com.android.shell\n`;
+    const host = {
+      androidTools: {
+        installPackage: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
+        runAdb: async (_device: unknown, args: string[]) => {
+          adbCalls.push(args);
+          return { stdout, stderr: '', exitCode: 0 };
+        },
+      },
+    } as unknown as PlatformRuntimeHost;
+    const packageName = await installAndroidArtifact(
+      host,
+      ANDROID_EMULATOR,
+      artifact.installablePath,
+      artifact.packageName,
+      new AbortController().signal,
+    );
+    assert.equal(packageName, ANDROID_MANIFEST_FIXTURE_PACKAGE);
+    assert.deepEqual(adbCalls, []);
+  } finally {
+    await artifact.cleanup();
+  }
+});
```

**File**: `packages/platform-android/src/manifest.fixtures.ts` (added, +307/-0)
```diff
@@ -0,0 +1,307 @@
+import { fileURLToPath } from 'node:url';
+import { crc32 } from 'node:zlib';
+
+// Binary AndroidManifest assembly following AOSP `androidfw/ResourceTypes.h`, so the attribute
+// offset rule is proven against the format, not an opaque blob. Each knob exists for a shape the
+// parser must handle or refuse instead of misreading. The committed fixtures below come from one
+// aapt2-built APK declaring the fixture package; regenerate with `aapt2 compile` + `aapt2 link`
+// against a platform `android.jar`, then `unzip -p app.apk AndroidManifest.xml >
+// src/fixtures/android-manifest-binary.fixture` and `cp app.apk
+// src/fixtures/android-manifest-apk.apk`.
+export const ANDROID_MANIFEST_FIXTURE_PACKAGE = 'com.callstack.agentdevicelab';
+export const ANDROID_MANIFEST_BINARY_FIXTURE_PATH = fileURLToPath(
+  new URL('./fixtures/android-manifest-binary.fixture', import.meta.url),
+);
+export const ANDROID_MANIFEST_APK_FIXTURE_PATH = fileURLToPath(
+  new URL('./fixtures/android-manifest-apk.apk', import.meta.url),
+);
+
+const RES_XML_TYPE = 0x0003;
+export const RES_STRING_POOL_TYPE = 0x0001;
+const RES_XML_START_NAMESPACE_TYPE = 0x0100;
+const RES_XML_END_NAMESPACE_TYPE = 0x0101;
+export const RES_XML_START_ELEMENT_TYPE = 0x0102;
+const RES_XML_END_ELEMENT_TYPE = 0x0103;
+const RES_XML_RESOURCE_MAP_TYPE = 0x0180;
+export const RES_XML_NODE_HEADER_SIZE = 16;
+export const RES_XML_ATTR_EXT_SIZE = 20;
+export const RES_XML_ATTRIBUTE_SIZE = 20;
+const RES_VALUE_SIZE = 8;
+const NO_INDEX = 0xffffffff;
+const TYPE_STRING = 0x03;
+const UTF8_FLAG = 0x100;
+const ANDROID_NAMESPACE_URI = 'http://schemas.android.com/apk/res/android';
+
+export type SyntheticAttribute = Readonly<{ name: string; value: string }>;
+
+export type SyntheticManifest = Readonly<{
+  packageName?: string;
+  elementName?: string;
+  attributes?: readonly SyntheticAttribute[];
+  utf8Strings?: boolean;
+  /** Carry the package only in `typedValue`, leaving `rawValue` as `NO_INDEX`. */
+  typedValueOnly?: boolean;
+  /** Where the `package` attribute sits among the manifest attributes. */
+  packagePosition?: 'last' | number;
+  nodeHeaderSize?: number;
+  attributeStride?: number;
+  attrExtSize?: number;
+  /** Declare `attributeStart` elsewhere than right after the extension. */
+  attributeStartOverride?: number;
+  /** Declare the manifest start-element chunk smaller than its emitted bytes. */
+  startElementChunkSizeShrink?: number;
+  paddingStrings?: number;
+}>;
+
+export function buildBinaryAndroidManifest(input: SyntheticManifest = {}): Buffer {
+  const packageName = input.packageName ?? ANDROID_MANIFEST_FIXTURE_PACKAGE;
+  const elementName = input.elementName ?? 'manifest';
+  const utf8Strings = input.utf8Strings ?? false;
+  const extraAttributes = input.attributes ?? [];
+  const attributeStride = input.attributeStride ?? RES_XML_ATTRIBUTE_SIZE;
+  const attrExtSize = input.attrExtSize ?? RES_XML_ATTR_EXT_SIZE;
+  const nodeHeaderSize = input.nodeHeaderSize ?? RES_XML_NODE_HEADER_SIZE;
+
+  const packageAttribute: SyntheticAttribute = { name: 'package', value: packageName };
+  const attributes = [...extraAttributes];
+  // `splice` clamps an out-of-range index, so any number up to `attributes.length` is first.
+  const position = input.packagePosition ?? 0;
+  attributes.splice(position === 'last' ? attributes.length : position, 0, packageAttribute);
+
+  const pool = new StringPool([elementName, 'android', ANDROID_NAMESPACE_URI, 'package']);
+  pool.add(packageName);
+  for (const attribute of attributes) pool.add(attribute.name).add(attribute.value);
+  for (let index = 0; index < (input.paddingStrings ?? 0); index += 1) pool.add(`unused${index}`);
+
+  const attributeBuffers = attributes.map((attribute) =>
+    buildAttribute(
+      pool,
+      attribute,
+      attribute === packageAttribute,
+      attributeStride,
+      attribute === packageAttribute ? input.typedValueOnly : false,
+    ),
+  );
+
+  const attrExt = Buffer.alloc(attrExtSize);
+  // aapt2 declares the root element without a namespace; `attrExtSize` may carry extra fields
+  // past the six known ones, which a reader must skip without misaligning the array.
+  attrExt.writeUInt32LE(NO_INDEX, 0);
+  attrExt.writeUInt32LE(pool.indexOf(elementName), 4);
+  attrExt.writeUInt16LE(input.attributeStartOverride ?? attrExtSize, 8);
+  attrExt.writeUInt16LE(attributeStride, 10);
+  attrExt.writeUInt16LE(attributeBuffers.length, 12);
+
+  const startElementBody = Buffer.concat([attrExt, ...attributeBuffers]);
+  const startElementChunk = buildNodeChunk(
+    RES_XML_START_ELEMENT_TYPE,
+    nodeHeaderSize,
+    startElementBody,
+    input.startElementChunkSizeShrink,
+  );
+
+  const chunks = Buffer.concat([
+    pool.build(utf8Strings),
+    buildChunk(RES_XML_RESOURCE_MAP_TYPE, 8, Buffer.alloc(4)),
+    buildNamespaceChunk(RES_XML_START_NAMESPACE_TYPE, nodeHeaderSize, pool),
+    startElementChunk,
+    buildEndElementChunk(nodeHeaderSize, po
```

**File**: `packages/platform-android/src/manifest.test.ts` (added, +290/-0)
```diff
@@ -0,0 +1,290 @@
+import assert from 'node:assert/strict';
+import { promises as fs, readFileSync } from 'node:fs';
+import path from 'node:path';
+import fc from 'fast-check';
+import { beforeEach, test } from 'vitest';
+import { bindAndroidAdbHostStub } from './adb-host.fixtures.ts';
+import { mkdtempForTest } from './__tests__/test-utils/tmp-dir.ts';
+import { resolveAndroidArchivePackageName } from './manifest.ts';
+import {
+  ANDROID_MANIFEST_BINARY_FIXTURE_PATH,
+  ANDROID_MANIFEST_APK_FIXTURE_PATH,
+  ANDROID_MANIFEST_FIXTURE_PACKAGE,
+  RES_STRING_POOL_TYPE,
+  RES_XML_ATTR_EXT_SIZE,
+  RES_XML_ATTRIBUTE_SIZE,
+  RES_XML_NODE_HEADER_SIZE,
+  RES_XML_START_ELEMENT_TYPE,
+  buildBinaryAndroidManifest,
+  buildStoredZipArchive,
+  listBinaryManifestChunks,
+  type BinaryManifestChunk,
+  type SyntheticManifest,
+} from './manifest.fixtures.ts';
+
+// Same budget as the canonical selectors fixture count, which platform packages may not import (R13).
+const PROPERTY_RUNS = 100;
+const PKG = ANDROID_MANIFEST_FIXTURE_PACKAGE;
+const binaryManifestFixture = readFileSync(ANDROID_MANIFEST_BINARY_FIXTURE_PATH);
+
+beforeEach(() => bindAndroidAdbHostStub());
+
+let archivePath: Promise<string> | undefined;
+
+// Resolves through the product seam: the manifest travels in a ZIP, so the same `unzip`
+// extraction, entry candidates, and `aapt` fallback the daemon runs are exercised. The adb-host
+// stub answers `isExecutable` as false, so identity can only come from the binary manifest.
+async function resolveManifest(
+  manifest: Buffer,
+  entry = 'AndroidManifest.xml',
+): Promise<string | undefined> {
+  archivePath ??= mkdtempForTest('agent-device-android-manifest-').then((dir) =>
+    path.join(dir, 'app.apk'),
+  );
+  const file = await archivePath;
+  await fs.writeFile(file, buildStoredZipArchive(new Map([[entry, manifest]])));
+  return await resolveAndroidArchivePackageName(file);
+}
+
+function chunkByType(manifest: Buffer, type: number): BinaryManifestChunk {
+  const chunk = listBinaryManifestChunks(manifest).find((candidate) => candidate.type === type);
+  assert.ok(chunk, `fixture carries a chunk of type ${type.toString(16)}`);
+  return chunk;
+}
+
+const attr = (name: string, value: string) => ({ name, value });
+
+// One row per shape a real toolchain emits or a corrupt producer might emit, carrying the
+// outcome the AOSP rule requires. Removing a guard fails exactly the rows that name it.
+const SYNTHETIC_CASES: readonly [string, SyntheticManifest, string | undefined, string?][] = [
+  // AOSP whole-array bound: records sit physically after a chunk that declares one fewer.
+  ['an attribute array declared past its chunk', { startElementChunkSizeShrink: 20 }, undefined],
+  // Stride guard: two 16-byte records fit the chunk, so only the stride rule realigns the read.
+  [
+    'an attribute stride below one ResXMLTree_attribute',
+    { attributeStride: RES_XML_ATTRIBUTE_SIZE - 4, attributes: [attr('versionCode', '7')] },
+    undefined,
+  ],
+  [
+    'a node header smaller than ResXMLTree_node',
+    { nodeHeaderSize: RES_XML_NODE_HEADER_SIZE - 4 },
+    undefined,
+  ],
+  // Chunk-size guard: valid node header, records present; the chunk denies the attrExt room.
+  [
+    'a node chunk with no room for ResXMLTree_attrExt',
+    { startElementChunkSizeShrink: 24 },
+    undefined,
+  ],
+  // Overlap guard: at attributeStart 0 the array fits, and record 1 lands on the package record.
+  [
+    'an attribute array overlapping ResXMLTree_attrExt',
+    { attributeStartOverride: 0, attributes: [attr('versionCode', '7')] },
+    undefined,
+  ],
+  [
+    'a package on a non-manifest element',
+    { packageName: PKG, elementName: 'application' },
+    undefined,
+  ],
+  [
+    'the typed value alone',
+    { packageName: 'com.example.tv', typedValueOnly: true },
+    'com.example.tv',
+  ],
+  [
+    'a UTF-8 string pool',
+    { packageName: 'com.example.utf8', utf8Strings: true },
+    'com.example.utf8',
+  ],
+  // The `package` attribute genuinely last, behind two other attributes.
+  [
+    'the package behind other manifest attributes',
+    {
+      packageName: 'com.example.behind',
+      packagePosition: 'last',
+      attributes: [attr('versionCode', '7'), attr('versionName', '1.2.3')],
+    },
+    'com.example.behind',
+  ],
+  // Valid control for the refusals: an extended attrExt and stride must parse, not be refused.
+  [
+    'an extended attrExt and stride',
+    {
+      packageName: 'com.example.wide',
+      attrExtSize: RES_XML_ATTR_EXT_SIZE + 8,
+      attributeStride: RES_XML_ATTRIBUTE_SIZE + 4,
+      attributes: [attr('versionCode', '7')],
+    },
+    'com.example.wide',
+  ],
+  // The resolver's second entry candidate. A real `.aab` carries a protobuf manifest there and
+  // resolves to undefined; this proves the candidate itself still parses a binary XML manifest.
+  [
+    'a bundle layout',
+    { packageName: 'com.example.bundle', utf8Strings: true },

```

**File**: `packages/platform-android/src/manifest.ts` (modified, +207/-66)
```diff
@@ -7,6 +7,16 @@ import { requireAndroidAdbHost } from './adb-host.ts';
 const RES_XML_TYPE = 0x0003;
 const RES_STRING_POOL_TYPE = 0x0001;
 const RES_XML_START_ELEMENT_TYPE = 0x0102;
+// ResChunk_header: type + headerSize + chunkSize. A ResXMLTree_header is nothing but one.
+const RES_CHUNK_HEADER_SIZE = 8;
+// ResXMLTree_node: ResChunk_header + lineNumber + comment.
+const RES_XML_NODE_HEADER_SIZE = 16;
+// ResXMLTree_attrExt: ns + name + attributeStart/Size/Count + id/class/styleIndex.
+const RES_XML_ATTR_EXT_SIZE = 20;
+// ResXMLTree_attribute: ns + name + rawValue + typedValue.
+const RES_XML_ATTRIBUTE_SIZE = 20;
+// ResStringPool_header: ResChunk_header + stringCount/styleCount/flags/stringsStart/stylesStart.
+const RES_STRING_POOL_HEADER_SIZE = 28;
 const UTF8_FLAG = 0x100;
 const TYPE_STRING = 0x03;
 const NO_INDEX = 0xffffffff;
@@ -65,84 +75,197 @@ function parseTextManifestPackageName(text: string): string | undefined {
 }
 
 function parseBinaryManifestPackageName(buffer: Buffer): string | undefined {
-  if (buffer.length < 8 || buffer.readUInt16LE(0) !== RES_XML_TYPE) {
-    return undefined;
-  }
+  const dataEnd = readBinaryTreeDataEnd(buffer);
+  if (!dataEnd) return undefined;
 
-  let strings: string[] | undefined;
-  for (let offset = buffer.readUInt16LE(2); offset + 8 <= buffer.length;) {
-    const type = buffer.readUInt16LE(offset);
-    const headerSize = buffer.readUInt16LE(offset + 2);
-    const chunkSize = buffer.readUInt32LE(offset + 4);
-    if (chunkSize <= 0 || offset + chunkSize > buffer.length) {
-      return undefined;
-    }
+  let strings: AndroidManifestStrings | undefined;
+  for (let offset = dataEnd.treeHeaderSize; offset + RES_CHUNK_HEADER_SIZE <= dataEnd.dataEnd;) {
+    const chunk = readChunkHeader(buffer, offset, dataEnd.dataEnd);
+    if (!chunk) return undefined;
 
-    if (type === RES_STRING_POOL_TYPE) {
-      strings = parseStringPool(buffer.subarray(offset, offset + chunkSize));
-    } else if (type === RES_XML_START_ELEMENT_TYPE && strings) {
-      const packageName = parseStartElementPackageName(buffer, offset, headerSize, strings);
+    if (chunk.type === RES_STRING_POOL_TYPE) {
+      strings = parseStringPool(buffer.subarray(offset, offset + chunk.chunkSize));
+      if (!strings) return undefined;
+    } else if (strings) {
+      const packageName = parsePackageInChunk(buffer, chunk, offset, strings);
       if (packageName) return packageName;
     }
-    offset += chunkSize;
+    offset += chunk.chunkSize;
   }
 
   return undefined;
 }
 
+type BinaryChunkHeader = Readonly<{ type: number; headerSize: number; chunkSize: number }>;
+
+function readChunkHeader(
+  buffer: Buffer,
+  offset: number,
+  dataEnd: number,
+): BinaryChunkHeader | undefined {
+  const type = buffer.readUInt16LE(offset);
+  const headerSize = buffer.readUInt16LE(offset + 2);
+  const chunkSize = buffer.readUInt32LE(offset + 4);
+  if (!isChunkHeaderValid(headerSize, chunkSize) || offset + chunkSize > dataEnd) {
+    return undefined;
+  }
+  return { type, headerSize, chunkSize };
+}
+
+function parsePackageInChunk(
+  buffer: Buffer,
+  chunk: BinaryChunkHeader,
+  offset: number,
+  strings: AndroidManifestStrings,
+): string | undefined {
+  if (chunk.type !== RES_XML_START_ELEMENT_TYPE) {
+    return undefined;
+  }
+  return parseStartElementPackageName(
+    buffer,
+    offset,
+    offset + chunk.chunkSize,
+    chunk.headerSize,
+    strings,
+  );
+}
+
+// AOSP `validate_chunk` checks every chunk against the parent's remaining bytes; the declared
+// end (`mDataEnd`) — not the buffer end — bounds the walk.
+function readBinaryTreeDataEnd(
+  buffer: Buffer,
+): Readonly<{ treeHeaderSize: number; dataEnd: number }> | undefined {
+  if (buffer.length < RES_CHUNK_HEADER_SIZE || buffer.readUInt16LE(0) !== RES_XML_TYPE) {
+    return undefined;
+  }
+  const treeHeaderSize = buffer.readUInt16LE(2);
+  const treeSize = buffer.readUInt32LE(4);
+  if (!isChunkHeaderValid(treeHeaderSize, treeSize) || treeSize > buffer.length) {
+    return undefined;
+  }
+  return { treeHeaderSize, dataEnd: treeSize };
+}
+
+// AOSP `validate_chunk`: a chunk header is readable only when it spans the common header, and
+// both it and the chunk size are four-byte aligned with the size at least as large.
+function isChunkHeaderValid(headerSize: number, chunkSize: number): boolean {
+  return (
+    headerSize >= RES_CHUNK_HEADER_SIZE &&
+    headerSize % 4 === 0 &&
+    chunkSize % 4 === 0 &&
+    headerSize <= chunkSize
+  );
+}
+
+type AndroidAttributeArray = Readonly<{
+  firstOffset: number;
+  stride: number;
+  count: number;
+}>;
+
+// An entry is `undefined` when its pool bytes are unreadable, which is a refusal to name that
+// string rather than a whole-manifest failure: other attributes may still resolve.
+type AndroidManifestStrings = readonly (string | undefined)[];
+
 function parseStartElementPackageName(
   buffer: Buffer,
   chunkOffset: number,
+  chunkEnd: number,
   hea
```

**File**: `packages/platform-android/src/sdk.ts` (modified, +7/-2)
```diff
@@ -28,12 +28,16 @@ function uniqueNonEmpty(values: readonly string[]): string[] {
 
 export function resolveAndroidSdkRoots(
   env: AndroidSdkEnvironment = requireAndroidAdbHost().environment,
+  platform: NodeJS.Platform,
 ): string[] {
   const configuredRoot = env.ANDROID_SDK_ROOT?.trim();
   const configuredHome = env.ANDROID_HOME?.trim();
   const homeDir = env.HOME?.trim();
+  // Android Studio installs the SDK here on macOS; the `Android/Sdk` layout is the Linux default.
+  const studioRoot =
+    platform === 'darwin' && homeDir ? path.join(homeDir, 'Library', 'Android', 'sdk') : '';
   const defaultRoot = homeDir ? path.join(homeDir, 'Android', 'Sdk') : '';
-  return uniqueNonEmpty([configuredRoot ?? '', configuredHome ?? '', defaultRoot]);
+  return uniqueNonEmpty([configuredRoot ?? '', configuredHome ?? '', studioRoot, defaultRoot]);
 }
 
 export async function ensureAndroidSdkPathConfigured(
@@ -43,7 +47,8 @@ export async function ensureAndroidSdkPathConfigured(
   const existingDirs: string[] = [];
   let detectedRoot: string | undefined;
 
-  for (const sdkRoot of resolveAndroidSdkRoots(env)) {
+  const { hostPlatform } = await import('@agent-device/host-kit/process');
+  for (const sdkRoot of resolveAndroidSdkRoots(env, hostPlatform())) {
     const presentDirs: string[] = [];
     for (const relativeDir of ANDROID_SDK_BIN_DIRS) {
       const candidate = path.join(sdkRoot, relativeDir);
```

**File**: `scripts/check-affected/model.test.ts` (modified, +20/-1)
```diff
@@ -160,12 +160,31 @@ test('Android package test fixture selects the unit suite instead of failing ope
         check: 'unit',
         path: fixture,
         rule: 'own:android-package-test-fixture',
-        detail: 'the Android package test fixture is consumed by the unit suite',
+        detail: 'Android package test fixtures are consumed by the unit suite',
       },
     ],
   );
 });
 
+test('colocated Android binary fixtures select the unit suite instead of failing open', () => {
+  const fixtures = [
+    'packages/platform-android/src/fixtures/android-manifest-binary.fixture',
+    'packages/platform-android/src/fixtures/android-manifest-apk.apk',
+  ];
+  const result = plan(fixtures);
+  assert.equal(result.failOpen, false);
+  assert.deepEqual(result.checks, ['unit']);
+  assert.deepEqual(
+    result.reasons.map((reason) => reason.path),
+    fixtures,
+  );
+  // The rule is scoped to the Android package: the same shape elsewhere stays unowned.
+  assert.equal(
+    plan(['packages/platform-harmonyos/src/fixtures/android-manifest-binary.fixture']).failOpen,
+    true,
+  );
+});
+
 test('MCP metadata change selects the mcp-metadata check', () => {
   assert.deepEqual(ids(['server.json']), ['mcp-metadata']);
 });
```

---

### Incident Patch 11: `d96754e5` (2026-10-05)
**Commit Message**: fix(ios): keep penalized-route fill on the field it focused (#3201)

* fix(ios): keep penalized-route fill on the field it focused

When the XCTest channel is penalized, iOS `fill` taps the daemon's point and
types through private synthesis. That route named the field only by the
point, but focusing can move the layout (keyboard avoidance, a bottom sheet
extending above the keyboard). The commit wait then re-read whatever sat at
the point: a fill that landed failed with TEXT_INPUT_COMMIT_NOT_OBSERVED, and
`fill ""` cleared the neighbouring field and reported success.

The input under the point is now found before the tap, and the target is
bound to its identity, the way #3161 binds an element-route target. Reads and
clears take that input's handle while it still carries the identity, and
otherwise only the focused input or the app-wide identifier match that
carries it; a target bound before its tap never re-reads the point. The
lookup and the handle check run inside the text-input probe's issue
containment, so a read that cannot answer fails the fill closed instead of
ending the runner.

Finding the input took up to 2 s more on a React Native bottom sheet, so the
replacement's focu

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunner/AgentDeviceRunnerApp.m` (modified, +37/-2)
```diff
@@ -74,6 +74,7 @@ @interface AgentDeviceRunnerViewController : UIViewController
 @property(nonatomic, assign) NSUInteger textEntryBurstEdits;
 @property(nonatomic, assign) NSTimeInterval textEntryBurstMinGap;
 @property(nonatomic, assign) NSTimeInterval textEntryAcknowledgeWindowSeconds;
+@property(nonatomic, strong) NSLayoutConstraint *textEntryFieldTop;
 @property(nonatomic, assign) BOOL alertFixtureStarted;
 @property(nonatomic, strong) NSTimer *alertActivationBusyBackstop;
 @property(nonatomic, strong) NSTimer *alertBannerRepost;
@@ -279,6 +280,10 @@ static NSTimeInterval AgentDeviceTextEntryAcknowledgeWindow(void) {
 static const NSTimeInterval AgentDeviceTextEntryBurstBreakSeconds = 1.0;
 static const NSUInteger AgentDeviceTextEntryAutoSubmitLength = 6;
 
+static const CGFloat AgentDeviceTextEntryFieldTopInset = 24;
+static const CGFloat AgentDeviceTextEntryFieldHeight = 44;
+static const CGFloat AgentDeviceTextEntryNeighbourGap = 16;
+
 - (void)agentDeviceTextEntryDidChange:(UITextField *)textField {
   // A field whose app owns its value, the way a controlled React Native `TextInput` does. A burst
   // typed faster than the app renders loses the characters that arrived while a render was in
@@ -334,6 +339,15 @@ - (void)agentDeviceTextEntryDidChange:(UITextField *)textField {
     [textField removeFromSuperview];
   }
 }
+
+// Moves the field up by its own height plus the gap below it when it gains focus, the way keyboard
+// avoidance or a bottom sheet extending above the keyboard does, so the neighbouring field slides
+// into the point the focus tap hit.
+- (void)agentDeviceTextEntryDidBeginEditing:(UITextField *)textField {
+  self.textEntryFieldTop.constant =
+      AgentDeviceTextEntryFieldTopInset - AgentDeviceTextEntryFieldHeight - AgentDeviceTextEntryNeighbourGap;
+  [self.view layoutIfNeeded];
+}
 #endif
 
 - (void)viewDidLoad {
@@ -395,12 +409,33 @@ - (void)viewDidLoad {
         forControlEvents:UIControlEventEditingChanged];
     textField.translatesAutoresizingMaskIntoConstraints = NO;
     [self.view addSubview:textField];
+    self.textEntryFieldTop = [textField.topAnchor constraintEqualToAnchor:label.bottomAnchor
+                                                                 constant:AgentDeviceTextEntryFieldTopInset];
     [NSLayoutConstraint activateConstraints:@[
       [textField.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
-      [textField.topAnchor constraintEqualToAnchor:label.bottomAnchor constant:24],
+      self.textEntryFieldTop,
       [textField.widthAnchor constraintEqualToConstant:240],
-      [textField.heightAnchor constraintEqualToConstant:44],
+      [textField.heightAnchor constraintEqualToConstant:AgentDeviceTextEntryFieldHeight],
     ]];
+    if ([NSProcessInfo.processInfo.arguments containsObject:@"--agent-device-text-entry-moves-on-focus"]) {
+      textField.text = @"stale";
+      [textField addTarget:self
+                    action:@selector(agentDeviceTextEntryDidBeginEditing:)
+          forControlEvents:UIControlEventEditingDidBegin];
+      UITextField *neighbour = [[UITextField alloc] init];
+      neighbour.accessibilityIdentifier = @"agent-device-text-entry-neighbour";
+      neighbour.borderStyle = UITextBorderStyleRoundedRect;
+      neighbour.text = @"neighbour";
+      neighbour.translatesAutoresizingMaskIntoConstraints = NO;
+      [self.view addSubview:neighbour];
+      [NSLayoutConstraint activateConstraints:@[
+        [neighbour.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
+        [neighbour.topAnchor constraintEqualToAnchor:textField.bottomAnchor
+                                            constant:AgentDeviceTextEntryNeighbourGap],
+        [neighbour.widthAnchor constraintEqualToConstant:240],
+        [neighbour.heightAnchor constraintEqualToConstant:AgentDeviceTextEntryFieldHeight],
+      ]];
+    }
     if ([NSProcessInfo.processInfo.arguments containsObject:@"--agent-device-text-entry-app-owned-value"]) {
       self.textEntryAcknowledgeWindowSeconds = AgentDeviceTextEntryAcknowledgeWindow();
       // Reports how many edits this app rendered and how many writes it had to make because a
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SynthesizedCommitDeadline.swift` (modified, +7/-2)
```diff
@@ -67,7 +67,8 @@ extension RunnerTests {
   /// already reported success. The expected value is the
   /// final text itself, and a settled mismatch is always reported: see
   /// `awaitSynthesizedReplacementCommitOutcome`'s doc comment. Text carrying a submit key is
-  /// skipped outright: the app may clear or rewrite the field on submit.
+  /// skipped outright: the app may clear or rewrite the field on submit. So is a secure field,
+  /// whose value is never readable.
   func awaitSynthesizedReplacementCommit(
     app: XCUIApplication,
     target: TextEntryTarget,
@@ -82,6 +83,7 @@ extension RunnerTests {
     let outcome = Self.awaitSynthesizedReplacementCommitOutcome(
       expectedText: expectedText,
       placeholder: ingredients.placeholder,
+      fieldIsSecure: ingredients.fieldIsSecure,
       now: { Date() },
       observe: ingredients.observe,
       waitForNextObservation: ingredients.waitForNextObservation
@@ -132,13 +134,16 @@ extension RunnerTests {
     expectedText: String
   ) -> (
     placeholder: String?,
+    fieldIsSecure: Bool,
     observe: () -> String?,
     waitForNextObservation: () -> Void
   ) {
-    let placeholder = resolveTextEntryElement(app: app, target: target)?.placeholderValue
+    let field = resolveTextEntryElement(app: app, target: target)
+    let placeholder = field?.placeholderValue
     let waitStartedAt = Date()
     return (
       placeholder: placeholder,
+      fieldIsSecure: field?.elementType == .secureTextField,
       observe: {
         let observedText = self.editableTextValue(
           for: self.resolveTextEntryElement(app: app, target: target),
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SynthesizedTextEntry.swift` (modified, +124/-20)
```diff
@@ -89,8 +89,8 @@ extension RunnerTests {
     /// One post. `characterCount` characters of the text, taken in order, are what it types.
     struct Step: Equatable {
       let characterCount: Int
-      /// True when this post selects the field's existing value away first. That selection is its
-      /// own synthesize record, so the post costs one call more than typing characters.
+      /// True when this post clears the field's existing value before typing its text in a
+      /// record of its own; `maxClearPassCount` says how.
       var replacesExistingText = false
       /// Seconds charged for what follows this post: the `--delay-ms` gap before the next post, or
       /// the warmup read-back after a peeled first character. The read-back costs one poll, because
@@ -100,9 +100,28 @@ extension RunnerTests {
       /// Set on the post whose value the loop waits for before the rest is posted.
       var warmsUpField = false
 
+      /// Most clear passes a replacing post runs, each a select-all record and a delete key record
+      /// followed by a read of the field. In a React Native app launched moments earlier (iOS 26.5
+      /// simulator) select-alls were dropped, so a pass deleted only the last character, and two
+      /// fixed passes still left "Clie" of "Client" in 3 of 5 runs. The post clears until the field
+      /// reads empty; typing over text still there would append to it.
+      static let maxClearPassCount = 4
+      /// Clear passes a field that never exposes its value gets before it is typed into unverified.
+      static let unreadableClearPassCount = 2
+
       /// How many private synthesize records this post runs.
       var synthesizeCallCount: Int {
-        replacesExistingText ? 2 : 1
+        replacesExistingText ? 2 * Self.maxClearPassCount + 1 : 1
+      }
+
+      /// Keystrokes this post types at the synthesized pace, the clears' delete keys included.
+      var keystrokeCount: Int {
+        characterCount + clearReadCount
+      }
+
+      /// Reads of the field this post makes between its clear passes.
+      var clearReadCount: Int {
+        replacesExistingText ? Self.maxClearPassCount : 0
       }
     }
 
@@ -129,8 +148,9 @@ extension RunnerTests {
     var seconds: TimeInterval {
       steps.reduce(0) { total, step in
         total
-          + Double(step.characterCount) * TextEntryTiming.synthesizedCharacterInterval
+          + Double(step.keystrokeCount) * TextEntryTiming.synthesizedCharacterInterval
           + Double(step.synthesizeCallCount) * TextEntryTiming.synthesizeCallOverhead
+          + Double(step.clearReadCount) * TextEntryTiming.synthesizedClearReadAllowance
           + step.pauseAfterSeconds
       }
     }
@@ -226,6 +246,48 @@ extension RunnerTests {
     case stop
   }
 
+  /// What the field reads between a replacement's clear passes.
+  enum ClearedFieldRead: Equatable {
+    case text(String)
+    /// The field never exposes its value: a secure field.
+    case unreadable
+    /// The read could not answer, or no input resolves.
+    case unavailable
+  }
+
+  /// How a replacing post's clear ended.
+  enum SynthesizedClearOutcome: Equatable {
+    case cleared
+    /// The field never exposes its value, so it is typed into unverified, as the commit wait leaves it.
+    case unverified
+    /// The field still held text after the last pass, or could not be read. Nothing is typed.
+    case notCleared
+    /// A clear post stopped the plan.
+    case stopped
+  }
+
+  /// Clears until the field reads empty, at most `maxClearPassCount` passes. A read that cannot
+  /// answer ends the clear, so the post never types over text it could not see removed.
+  static func clearForSynthesizedReplacement(
+    clearOnce: () -> SynthesizedStepDispatch,
+    read: () -> ClearedFieldRead
+  ) -> SynthesizedClearOutcome {
+    for pass in 1...SynthesizedTextPlan.Step.maxClearPassCount {
+      guard clearOnce() == .posted else { return .stopped }
+      switch read() {
+      case .text(let value) where value.isEmpty:
+        return .cleared
+      case .text:
+        continue
+      case .unreadable:
+        if pass >= SynthesizedTextPlan.Step.unreadableClearPassCount { return .unverified }
+      case .unavailable:
+        return .notCleared
+      }
+    }
+    return .notCleared
+  }
+
   struct SynthesizedPlanRun {
     let postedCharacterCount: Int
     /// True when a post stopped the plan before its last step.
@@ -298,32 +360,68 @@ extension RunnerTests {
         )
       )
     }
+    var clearOutcome: SynthesizedClearOutcome?
     // A private synthesis channel that is gone mid-plan leaves the command the same
     // point-and-focus fallback it had before the plan existed.
     let synthesisAvailable = runSynthesizedTextPlan(
       plan,
       text: request.text,
       post: { slice, step in
-        switch request.synthesizer.enterText(
-          app: request.app,
-          text: slice,
-          replacingExistingText:
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+TextEntry.swift` (modified, +40/-7)
```diff
@@ -8,6 +8,7 @@ extension RunnerTests {
     case notFocused = "TEXT_INPUT_NOT_FOCUSED"
     case synthesisUnavailable = "TEXT_INPUT_SYNTHESIS_UNAVAILABLE"
     case commitNotObserved = "TEXT_INPUT_COMMIT_NOT_OBSERVED"
+    case clearNotObserved = "TEXT_INPUT_CLEAR_NOT_OBSERVED"
     case synthesisBudgetExceeded = "TEXT_INPUT_SYNTHESIS_BUDGET_EXCEEDED"
 
     var message: String {
@@ -18,6 +19,8 @@ extension RunnerTests {
         return "Reliable text synthesis is unavailable while the software keyboard is hidden."
       case .commitNotObserved:
         return "The runner could not confirm the typed text reached the field."
+      case .clearNotObserved:
+        return "The runner could not clear the field before typing, so it typed nothing."
       case .synthesisBudgetExceeded:
         return "The text is longer than one runner command can type at this pace."
       }
@@ -31,6 +34,8 @@ extension RunnerTests {
         return "Show the software keyboard, then retry type."
       case .commitNotObserved:
         return "The field may hold none, part, or all of the text. Run snapshot -i and inspect the field: if it already matches, continue; otherwise retry fill with the full text quoted and --delay-ms \(TextEntryTiming.recoveryDelayMilliseconds). Do not use type, which appends to whatever committed."
+      case .clearNotObserved:
+        return "The field may still hold some or all of its old text. Run snapshot -i and inspect the field, then retry fill. Do not use type, which appends to whatever the field holds."
       case .synthesisBudgetExceeded:
         let recoveryDelay = TextEntryTiming.recoveryDelayMilliseconds
         let recoveryBudget = SynthesizedDeliveryBudget.maxTextLength(
@@ -70,8 +75,15 @@ extension RunnerTests {
     /// delivery happens before this wait starts and is bounded by `synthesizedDeliveryCeiling`.
     static let synthesizedCommitCeiling: TimeInterval = 10.0
     /// What a synthesized replacement spends before its first character: focusing the field took
-    /// 374–500 ms through the daemon on an iPhone 17 Pro simulator.
-    static let synthesizedReplacementFocusAllowance: TimeInterval = 2.0
+    /// 374–500 ms through the daemon on an iPhone 17 Pro simulator, and finding the input under the
+    /// point before that tap took up to 2.0 s more on a React Native bottom sheet (iPhone 17 Pro
+    /// Max, iOS 26.5).
+    static let synthesizedReplacementFocusAllowance: TimeInterval = 4.0
+    /// What one read of the field between a replacement's clear passes is charged. On a penalized
+    /// channel, a clear pass on a React Native bottom-sheet field took 1.18–1.26 s over 22 passes
+    /// (iPhone 17 Pro Max, iOS 26.5); less the pass's charged synthesize calls and delete key, the
+    /// read took 0.80–0.88 s. A login field read in 0.26–0.40 s.
+    static let synthesizedClearReadAllowance: TimeInterval = 0.9
     /// How long a synthesized burst may spend posting its characters: what the command's
     /// main-thread watchdog leaves after focus and the longest commit wait. The private synthesize
     /// call delivers as it returns, so text that does not fit is refused before the first character
@@ -127,26 +139,42 @@ extension RunnerTests {
     var isDistinguishable: Bool { !identifier.isEmpty }
   }
 
+  /// A text input found under a point, and the identity it carried when found. The element is an
+  /// index-bound query handle: an input inserted or reordered ahead of it later re-binds the handle
+  /// to that input, and the identity is what notices.
+  struct TextInputAtPoint {
+    let element: XCUIElement
+    let identity: TextEntryInputIdentity
+  }
+
   struct TextEntryTarget {
     let element: XCUIElement?
     let refreshPoint: CGPoint?
     let prefersFocusedElement: Bool
     let fromTapWitness: Bool
     /// The input the first resolved element was. Once bound, resolution refuses any other input.
     let boundIdentity: TextEntryInputIdentity?
+    /// The text input that sat under `refreshPoint` before the focus tap, which binds the target to
+    /// its identity. Focusing a field can move the layout (keyboard avoidance, a bottom sheet
+    /// extending above the keyboard), after which the point hits a different field or none, so once
+    /// this is set the point no longer names the field. It identifies the field for reads and
+    /// clears, never for routing.
+    let inputAtRefreshPoint: TextInputAtPoint?
 
     init(
       element: XCUIElement?,
       refreshPoint: CGPoint?,
       prefersFocusedElement: Bool,
       fromTapWitness: Bool = false,
-      boundIdentity: TextEntryInputIdentity? = nil
+      boundIdentity: TextEntryInputIdentity? = nil,
+      inputAtRefreshPoint: TextInputAtPoint? = nil
     ) {
       self.element = element
       self.refreshPoint = refreshPoint
       self.prefersFocusedElement = prefersFocusedElement
       self.fromTapWitness = fromTapWitness
-      self.boundIdentity = boundIdentity
+      self.bo
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+TextInputProbe.swift` (modified, +59/-6)
```diff
@@ -5,7 +5,7 @@ final class TextInputProbeIssues {
   var count = 0
 }
 
-enum TextInputProbeFailure: String {
+enum TextInputProbeFailure: String, Error {
   case recordedIssue = "text_input_probe_recorded_issue"
   case exception = "text_input_probe_exception"
 }
@@ -38,7 +38,60 @@ extension RunnerTests {
     }
   }
 
+  /// The input `coordinateTapTextInputAt` finds, with the identity it carried then, read inside the
+  /// same issue containment. Nil when the probe finds none or cannot answer.
+  func coordinateTapTextInputIdentityAt(app: XCUIApplication, x: Double, y: Double) -> TextInputAtPoint? {
+    let probed = containingTextInputProbeIssues(fallback: nil) { shouldStop -> TextInputAtPoint? in
+      guard let element = queryTextInputs(app: app, point: CGPoint(x: x, y: y), shouldStop: shouldStop).first,
+            case .input(let identity) = probeTextEntryInput(element)
+      else {
+        return nil
+      }
+      return TextInputAtPoint(element: element, identity: identity)
+    }
+    guard case .success(let input) = probed else { return nil }
+    return input
+  }
+
+  /// Whether `input`'s handle still resolves to the input it named when found, read inside the
+  /// same issue containment. A read that cannot answer counts as no.
+  func textInputStillResolves(_ input: TextInputAtPoint) -> Bool {
+    let probed = containingTextInputProbeIssues(fallback: false) { _ in
+      input.element.exists && probeTextEntryInput(input.element) == .input(input.identity)
+    }
+    guard case .success(let resolves) = probed else { return false }
+    return resolves
+  }
+
+  /// What `target`'s input reads between a replacement's clear passes, read inside the same issue
+  /// containment, with a placeholder read as empty. A read that cannot answer is `.unavailable`.
+  func clearedFieldRead(app: XCUIApplication, target: TextEntryTarget) -> ClearedFieldRead {
+    let probed = containingTextInputProbeIssues(fallback: ClearedFieldRead.unavailable) { _ in
+      guard let input = resolveTextEntryElement(app: app, target: target) else { return .unavailable }
+      if input.elementType == .secureTextField { return .unreadable }
+      return editableTextValue(for: input, treatingPlaceholderAsEmpty: true).map { .text($0) } ?? .unavailable
+    }
+    guard case .success(let read) = probed else { return .unavailable }
+    return read
+  }
+
   func probeTextInputs(app: XCUIApplication, point: CGPoint) -> TextInputProbeOutcome {
+    switch containingTextInputProbeIssues(fallback: [], { shouldStop in
+      queryTextInputs(app: app, point: point, shouldStop: shouldStop)
+    }) {
+    case .success(let elements):
+      return elements.isEmpty ? .absent : .matches(elements)
+    case .failure(let failure):
+      return .unavailable(failure)
+    }
+  }
+
+  /// Runs an optional probe whose XCTest issues are contained instead of recorded: an issue makes
+  /// the probe unavailable rather than failing the command and invalidating the runner.
+  private func containingTextInputProbeIssues<T>(
+    fallback: T,
+    _ probe: (_ shouldStop: () -> Bool) -> T
+  ) -> Result<T, TextInputProbeFailure> {
     precondition(Thread.isMainThread)
     let issues = TextInputProbeIssues()
     suppressedIssueLock.lock()
@@ -50,12 +103,12 @@ extension RunnerTests {
       textInputProbeIssues = previous
       suppressedIssueLock.unlock()
     }
-    let (elements, exception) = catchingObjCException(fallback: []) {
-      queryTextInputs(app: app, point: point, shouldStop: { self.hasTextInputProbeIssues(issues) })
+    let (value, exception) = catchingObjCException(fallback: fallback) {
+      probe({ self.hasTextInputProbeIssues(issues) })
     }
-    if hasTextInputProbeIssues(issues) { return .unavailable(.recordedIssue) }
-    if exception != nil { return .unavailable(.exception) }
-    return elements.isEmpty ? .absent : .matches(elements)
+    if hasTextInputProbeIssues(issues) { return .failure(.recordedIssue) }
+    if exception != nil { return .failure(.exception) }
+    return .success(value)
   }
 
   private func hasTextInputProbeIssues(_ scope: TextInputProbeIssues) -> Bool {
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+TypeExecution.swift` (modified, +4/-1)
```diff
@@ -27,6 +27,8 @@ extension RunnerTests {
       hasY: command.y != nil,
       xCTestChannelPenalized: xCTestChannelPenalized
     ), let x = command.x, let y = command.y {
+      // Resolved before the tap: the focus it causes can move the field away from this point.
+      let inputAtPoint = coordinateTapTextInputIdentityAt(app: activeApp, x: x, y: y)
       let policyKind = SynthesizedGesturePolicyKind.coordinateTap
       let context = synthesizedCoordinateContext(
         app: activeApp,
@@ -40,7 +42,8 @@ extension RunnerTests {
         resolvedCoordinateTarget = TextEntryTarget(
           element: nil,
           refreshPoint: CGPoint(x: x, y: y),
-          prefersFocusedElement: false
+          prefersFocusedElement: false,
+          inputAtRefreshPoint: inputAtPoint
         )
       case .xctestFallback:
         break
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/UnitTests/RunnerTests+SynthesizedTextEntryTests.swift` (modified, +251/-0)
```diff
@@ -155,5 +155,256 @@ extension RunnerTests {
     XCTAssertEqual(response.error?.code, "TEXT_INPUT_SYNTHESIS_BUDGET_EXCEEDED")
     XCTAssertEqual(String(describing: textField.value ?? ""), "")
   }
+
+  /// Drops the select-all of the first `remaining` replacing posts, the way a React Native field in
+  /// a freshly launched app does, so each of those passes deletes only the last character.
+  final class SelectAllDroppingSynthesizer: TextEntrySynthesizing {
+    var remaining: Int
+
+    init(dropping count: Int) {
+      remaining = count
+    }
+
+    func enterText(
+      app: XCUIApplication,
+      text: String,
+      replacingExistingText: Bool
+    ) -> SynthesizedTextEntryAction {
+      let dropsSelectAll = replacingExistingText && remaining > 0
+      if dropsSelectAll { remaining -= 1 }
+      return PrivateXCTestTextEntrySynthesizer().enterText(
+        app: app,
+        text: text,
+        replacingExistingText: replacingExistingText && !dropsSelectAll
+      )
+    }
+  }
+
+  /// Two fixed clear passes left "Clie" of "Client" in 3 of 5 fills on a freshly launched React
+  /// Native app that dropped its select-alls, and the fill typed after it. The clear now repeats
+  /// until the field reads empty, and types nothing over text it could not remove.
+  @MainActor
+  func testSynthesizedReplacementClearsPastDroppedSelectAlls() throws {
+    let field = try focusSynthesizedReplacementField()
+    defer { tearDownSynthesizedReplacementField() }
+    let frame = field.frame
+    let found = try XCTUnwrap(coordinateTapTextInputIdentityAt(app: app, x: frame.midX, y: frame.midY))
+    let cases: [(dropped: Int, failure: TextEntryFailure?)] = [
+      (2, nil),
+      (SynthesizedTextPlan.Step.maxClearPassCount, .clearNotObserved),
+    ]
+
+    for testCase in cases {
+      let label = "\(testCase.dropped) select-alls dropped"
+      let seeded = try replaceSynthesizedFieldText(field, text: "stale", commandId: "seed-\(testCase.dropped)")
+      XCTAssertTrue(seeded.ok, String(describing: seeded.error))
+      let result = typeTextReliably(
+        app: app,
+        target: TextEntryTarget(
+          element: nil,
+          refreshPoint: CGPoint(x: frame.midX, y: frame.midY),
+          prefersFocusedElement: false,
+          inputAtRefreshPoint: found
+        ),
+        text: "fresh",
+        delaySeconds: 0,
+        repairMode: .replacement,
+        xCTestChannelPenalized: true,
+        synthesizer: SelectAllDroppingSynthesizer(dropping: testCase.dropped)
+      )
+
+      let value = String(describing: field.value ?? "")
+      XCTAssertEqual(result.failure, testCase.failure, label)
+      if testCase.failure == nil {
+        XCTAssertEqual(value, "fresh", label)
+      } else {
+        XCTAssertFalse(value.contains("fresh"), "typed over text it could not clear: \(value)")
+        XCTAssertFalse(value.isEmpty, label)
+      }
+    }
+  }
+
+  /// Launches the fixture whose field moves away when focused and leaves a neighbouring field under
+  /// the point the focus tap hit, the way a React Native bottom sheet extends above the keyboard.
+  /// The field is not focused yet, so the replacement's own tap starts the move.
+  @MainActor
+  func launchFieldThatMovesOnFocus() throws -> (field: XCUIElement, neighbour: XCUIElement) {
+    app.launchArguments = ["--agent-device-text-entry-regression", "--agent-device-text-entry-moves-on-focus"]
+    app.launch()
+    XCTAssertTrue(app.waitForExistence(timeout: appExistenceTimeout))
+    let field = app.textFields["agent-device-hardware-keyboard-input"]
+    let neighbour = app.textFields["agent-device-text-entry-neighbour"]
+    XCTAssertTrue(field.waitForExistence(timeout: appExistenceTimeout))
+    XCTAssertTrue(neighbour.waitForExistence(timeout: appExistenceTimeout))
+    mainOwned.app = app
+    mainOwned.bundleId = "com.callstack.agentdevice.runner"
+    mainOwned.processIdentifier = try XCTUnwrap(Self.processIdentifier(of: app))
+    penalizeSnapshotXCTestChannel(bundleId: nil, reason: "test")
+    return (field, neighbour)
+  }
+
+  /// The commit wait used to re-read whatever field sat under the pre-focus point, which after the
+  /// move is the neighbour, so a replacement that landed was reported as
+  /// TEXT_INPUT_COMMIT_NOT_OBSERVED.
+  @MainActor
+  func testSynthesizedReplacementConfirmsAFieldThatMovedOnFocus() throws {
+    let (field, neighbour) = try launchFieldThatMovesOnFocus()
+    defer { tearDownSynthesizedReplacementField() }
+    let pointBeforeFocus = field.frame
+
+    let response = try replaceSynthesizedFieldText(field, text: "fresh", commandId: "fill-moved-field")
+
+    XCTAssertNotEqual(field.frame.midY, pointBeforeFocus.midY, "the fixture field did not move")
+    XCTAssertTrue(response.ok, String(describing: response.error))
+    XCTAssertEqual(String(describing: field.value ?? ""), "fresh")
+    XCTAssertEqual(String(describing: neighbour.value ?? ""), "neighbour")
+  }
+
+  /// `fill ""` used to
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/UnitTests/RunnerTests+TextEntryPolicyTests.swift` (modified, +115/-35)
```diff
@@ -181,6 +181,32 @@ extension RunnerTests {
     XCTAssertEqual(observations, 0, "no post-dispatch read can resolve this collision")
   }
 
+  // A secure field reads nil on every poll, so the wait could only expire: every penalized-route
+  // password `fill` failed with TEXT_INPUT_COMMIT_NOT_OBSERVED. It is left unverified instead, as
+  // the element route leaves it, also when the text equals its placeholder; an ordinary field
+  // that reads nil, or whose text equals its placeholder, still fails.
+  func testSynthesizedReplacementCommitLeavesASecureFieldUnverified() {
+    for placeholder in [nil, "hunter2"] {
+      for fieldIsSecure in [true, false] {
+        let label = "secure: \(fieldIsSecure), placeholder: \(placeholder ?? "none")"
+        var observations = 0
+        let outcome = Self.awaitSynthesizedReplacementCommitOutcome(
+          expectedText: "hunter2",
+          placeholder: placeholder,
+          fieldIsSecure: fieldIsSecure,
+          stallBudget: 0,
+          observe: {
+            observations += 1
+            return nil
+          },
+          waitForNextObservation: {}
+        )
+        XCTAssertEqual(outcome, fieldIsSecure ? .unobservable : .notObserved, label)
+        XCTAssertEqual(observations, fieldIsSecure || placeholder != nil ? 0 : 1, label)
+      }
+    }
+  }
+
   // The mapping the command actually refuses on. `.unobservable` must stay a success: it is the
   // contract for submit-key text, so inverting it would fail every `fill` ending in a submit key.
   func testOnlyAnUnobservedCommitBecomesACommandFailure() {
@@ -283,20 +309,55 @@ extension RunnerTests {
     )
   }
 
-  // A select-and-type post runs two synthesize records — the Command-A selection and the text — so a
-  // burst that replaces costs more than the characters it types. Charging one call per post is the
-  // projection defect this plan exists to remove, one level down.
-  func testSynthesizedPlanChargesAReplacingPostTwoSynthesizeCalls() {
+  // A replacing post may clear up to four times — a select-all record, a delete-key record and a
+  // read of the field each, because a freshly launched app drops select-alls — before its text
+  // record, so it is charged nine synthesize records, four keystrokes and four reads more than the
+  // characters it types. Charging one call per post is the projection defect this plan exists to
+  // remove, one level down.
+  func testSynthesizedPlanChargesAReplacingPostItsClears() {
     let replacing = SynthesizedTextPlan.Step(characterCount: 1, replacesExistingText: true)
-    XCTAssertEqual(replacing.synthesizeCallCount, 2)
+    XCTAssertEqual(replacing.synthesizeCallCount, 9)
+    XCTAssertEqual(replacing.keystrokeCount, 5)
+    XCTAssertEqual(replacing.clearReadCount, 4)
     XCTAssertEqual(
       SynthesizedTextPlan.Step(characterCount: 1).synthesizeCallCount,
       1
     )
     XCTAssertEqual(
       Self.synthesizedTextPlan(characterCount: 1, delaySeconds: 0, selectsExistingText: true).seconds,
-      TextEntryTiming.synthesizedCharacterInterval
-        + 2 * TextEntryTiming.synthesizeCallOverhead
+      5 * TextEntryTiming.synthesizedCharacterInterval
+        + 9 * TextEntryTiming.synthesizeCallOverhead
+        + 4 * TextEntryTiming.synthesizedClearReadAllowance
+    )
+  }
+
+  // Each pass's select-all can be dropped, deleting only the last character, so the clear repeats
+  // until the field reads empty, and types nothing over text it could not remove or could not read.
+  // A field that never exposes its value gets the unread passes and is typed into unverified.
+  func testSynthesizedClearRepeatsUntilTheFieldReadsEmpty() {
+    let cases: [(reads: [ClearedFieldRead], outcome: SynthesizedClearOutcome, passes: Int)] = [
+      ([.text("")], .cleared, 1),
+      ([.text("Clien"), .text("Clie"), .text("")], .cleared, 3),
+      ([.text("Clien"), .text("Clie"), .text("Cli"), .text("Cl")], .notCleared, 4),
+      ([.text("Clien"), .unavailable], .notCleared, 2),
+      ([.unreadable, .unreadable], .unverified, 2),
+    ]
+    for testCase in cases {
+      var passes = 0
+      var reads = testCase.reads[...]
+      let outcome = Self.clearForSynthesizedReplacement(
+        clearOnce: {
+          passes += 1
+          return .posted
+        },
+        read: { reads.popFirst() ?? .unavailable }
+      )
+      XCTAssertEqual(outcome, testCase.outcome, "\(testCase.reads)")
+      XCTAssertEqual(passes, testCase.passes, "\(testCase.reads)")
+    }
+    XCTAssertEqual(
+      Self.clearForSynthesizedReplacement(clearOnce: { .stop }, read: { .text("") }),
+      .stopped
     )
   }
 
@@ -535,25 +596,18 @@ extension RunnerTests {
 
 #if os(iOS)
   @MainActor
-  func testTypeTextReliablyPacesSynthesizedReplacementThroughProductionCaller() {
+  func testTypeTextReliablyPacesSynthesizedReplacementThroughProductionCaller() throws {
+    let field = try focusSynthesizedReplacementField()
+    defer { tearDownSynthesizedReplacementField()
```

---

### Incident Patch 12: `df7f5d43` (2026-10-05)
**Commit Message**: fix(daemon): scope client timeout recovery to the timed-out request (#3193)

* fix(daemon): scope timeout recovery through owned retirement

* chore(gates): declare liveness probe request type edge

**File**: `packages/platform-apple/src/runner/__tests__/runner-session-close.test.ts` (modified, +78/-0)
```diff
@@ -1,5 +1,7 @@
 import assert from 'node:assert/strict';
+import { EventEmitter } from 'node:events';
 import { beforeEach, test, vi } from 'vitest';
+import type { ExecBackgroundResult } from '@agent-device/host-kit/command';
 import { IOS_SIMULATOR } from './device-fixtures.ts';
 import { appleRunnerTestHost } from '../test-host.ts';
 import {
@@ -105,6 +107,8 @@ import {
   readRunnerSessionLiveness,
   releaseIosRunnerOnClose,
 } from '../runner-session.ts';
+import { registerRunnerPrepProcess } from '../runner-artifact.ts';
+import { runnerPrepProcessChildren } from '../runner-xctestrun.ts';
 
 // Test-only stand-in for the daemon's runtime lease-owner-state-dir setter (root-only; the package
 // cannot import it). Backs the host.leaseOwnerStateDir() getter the package reads instead.
@@ -317,3 +321,77 @@ test('releaseIosRunnerOnClose retains an idle runner, disposes a busy one, and t
   await releaseIosRunnerOnClose(device.id, { retain: false });
   assert.equal(readRunnerSessionLiveness(device.id), null);
 });
+
+/**
+ * A close that stops the device stops its in-flight runner build too (#3177). The build behind a
+ * cold start is the resource a session teardown promises to leave behind, not an orphan for the
+ * next `open` to race on the shared runner derived-data root.
+ */
+test('releaseIosRunnerOnClose stops the device build still in flight (#3177)', async () => {
+  const device = { ...IOS_SIMULATOR, id: 'runner-session-close-build-sim' };
+  await ensureRunnerSession(device, {});
+  const build = Object.assign(new EventEmitter(), {
+    pid: 4747,
+    exitCode: null,
+  }) as ExecBackgroundResult['child'];
+  registerRunnerPrepProcess(device.id, build);
+
+  await releaseIosRunnerOnClose(device.id, { retain: false });
+
+  const signaledPids = mockSignalProcessGroupBestEffort.mock.calls.map(([pid]) => pid);
+  assert.ok(
+    signaledPids.includes(4747),
+    'the non-retained close tree-killed the build still in flight',
+  );
+  assert.equal(runnerPrepProcessChildren(device.id).length, 0, 'the build left the prep ledger');
+});
+
+/**
+ * A close arriving during `build-for-testing` stops the build BEFORE waiting for the session
+ * lock (#3177 review). The start holds that lock for its whole cold build, so a close that stopped
+ * the session first would only reach the build after it finished — exactly the orphan close is
+ * supposed to prevent. Here the start is parked mid-build (the lock held), and the build must be
+ * signaled without the session stop completing first.
+ */
+test('releaseIosRunnerOnClose stops the build while the start still holds the session lock (#3177)', async () => {
+  const device = { ...IOS_SIMULATOR, id: 'runner-session-close-ordering-sim' };
+  let releaseBuild: () => void = () => {};
+  mockEnsureXctestrunArtifact.mockImplementationOnce(
+    () =>
+      new Promise<Awaited<ReturnType<typeof mockEnsureXctestrunArtifact>>>((resolve) => {
+        releaseBuild = () =>
+          resolve({
+            xctestrunPath: '/tmp/base-runner.xctestrun',
+            derived: '/tmp/derived',
+            cacheKey: RUNNER_CACHE_KEY_FIXTURE,
+            cache: 'miss',
+            artifact: 'rebuilt',
+            buildMs: 12,
+            xctestrunPathSource: 'build',
+          });
+      }),
+  );
+  const starting = ensureRunnerSession(device, {}).catch(() => undefined);
+  await vi.waitFor(() => {
+    assert.equal(mockEnsureXctestrunArtifact.mock.calls.length, 1);
+  });
+
+  const build = Object.assign(new EventEmitter(), {
+    pid: 4748,
+    exitCode: null,
+  }) as ExecBackgroundResult['child'];
+  registerRunnerPrepProcess(device.id, build);
+  const closing = releaseIosRunnerOnClose(device.id, { retain: false });
+
+  await vi.waitFor(() => {
+    const signaledPids = mockSignalProcessGroupBestEffort.mock.calls.map(([pid]) => pid);
+    assert.ok(
+      signaledPids.includes(4748),
+      'the close killed the build while the start still held the session lock',
+    );
+  });
+
+  releaseBuild();
+  await closing;
+  await starting;
+});
```

**File**: `packages/platform-apple/src/runner/__tests__/runner-start-budget.test.ts` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+import assert from 'node:assert/strict';
+import { EventEmitter } from 'node:events';
+import { beforeEach, test, vi } from 'vitest';
+import type { ExecBackgroundResult } from '@agent-device/host-kit/command';
+import {
+  AppError,
+  createRequestCanceledError,
+  isRequestCanceledError,
+} from '@agent-device/kernel/errors';
+import { IOS_SIMULATOR } from './device-fixtures.ts';
+import { appleRunnerTestHost } from '../test-host.ts';
+import { raceRunnerStartAgainstCaller } from '../runner-start-budget.ts';
+import { registerRunnerPrepProcess } from '../runner-artifact.ts';
+import { runnerPrepProcessChildren } from '../runner-xctestrun.ts';
+
+const mockSignalPidsBestEffort = vi.fn();
+const mockSignalProcessGroupBestEffort = vi.fn();
+const mockRunAppleToolCommand = vi.fn();
+const mockGetRequestSignal = vi.fn();
+
+beforeEach(() => {
+  vi.resetAllMocks();
+  mockRunAppleToolCommand.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
+  mockGetRequestSignal.mockReturnValue(undefined);
+  appleRunnerTestHost.update({
+    signalPidsBestEffort: mockSignalPidsBestEffort,
+    signalProcessGroupBestEffort: mockSignalProcessGroupBestEffort,
+    runAppleToolCommand: mockRunAppleToolCommand,
+    getRequestSignal: mockGetRequestSignal,
+  });
+});
+
+function callerDeadline(): DOMException {
+  return new DOMException('Wait deadline exceeded', 'TimeoutError');
+}
+
+/** A detached start nobody has finished — the shape of a cold build still under the lock. */
+function hangingStart(): Promise<never> {
+  return new Promise<never>(() => {});
+}
+
+function makePrepChild(pid: number): ExecBackgroundResult['child'] {
+  return Object.assign(new EventEmitter(), {
+    pid,
+    exitCode: null,
+  }) as ExecBackgroundResult['child'];
+}
+
+function signaledPids(): number[] {
+  return mockSignalProcessGroupBestEffort.mock.calls.map(([pid]) => pid as number);
+}
+
+function canceled(error: unknown): boolean {
+  return isRequestCanceledError(error) && error instanceof AppError;
+}
+
+async function settleAsyncWork(): Promise<void> {
+  for (let i = 0; i < 4; i += 1) {
+    await new Promise((resolve) => setTimeout(resolve, 5));
+  }
+}
+
+/**
+ * The waiter's cancel owns the build it waited on (#3177). A request canceled while queued behind
+ * a detached cold build must stop that build: its spawn carried only the STARTING request's
+ * cancellation signal, so without the waiter's device-scoped prep kill the build would keep
+ * compiling under the daemon on the shared runner derived-data root, and a retried `open` would
+ * race it. The kill is the same tree-kill escalation a session stop uses. Here the build's owner
+ * has no live request signal (its start is detached), so the waiter is allowed to stop it.
+ */
+test('a request canceled while waiting on the detached start stops that device build', async () => {
+  const device = { ...IOS_SIMULATOR, id: 'runner-waiter-cancel-sim' };
+  const build = makePrepChild(4848);
+  registerRunnerPrepProcess(device.id, build, 'owner-request-gone');
+  mockGetRequestSignal.mockImplementation((requestId?: string) =>
+    requestId === 'owner-request-gone' ? AbortSignal.abort() : undefined,
+  );
+
+  const controller = new AbortController();
+  controller.abort(createRequestCanceledError());
+  await assert.rejects(
+    raceRunnerStartAgainstCaller(hangingStart(), controller.signal, device.id),
+    canceled,
+  );
+  await settleAsyncWork();
+
+  assert.ok(
+    signaledPids().includes(4848),
+    'the waiter cancel reached the build through the prep tree-kill path',
+  );
+  assert.equal(
+    runnerPrepProcessChildren(device.id).length,
+    0,
+    'the killed build left the prep ledger',
+  );
+});
+
+/**
+ * A canceled waiter must not reach a build still owned by an in-flight request (#3177 review).
+ * The owner cancels its own build through its live request signal at the exec layer; a waiter
+ * tearing it down would SIGTERM another active request's work out from under it. Here the build's
+ * owner still has a registered, un-aborted signal, so the canceled waiter leaves it running.
+ */
+test('a canceled waiter leaves a build owned by a still-active request', async () => {
+  const device = { ...IOS_SIMULATOR, id: 'runner-waiter-owner-active-sim' };
+  const build = makePrepChild(4850);
+  registerRunnerPrepProcess(device.id, build, 'owner-request-live');
+  mockGetRequestSignal.mockImplementation((requestId?: string) =>
+    requestId === 'owner-request-live' ? new AbortController().signal : undefined,
+  );
+
+  const controller = new AbortController();
+  controller.abort(createRequestCanceledError());
+  await assert.rejects(
+    raceRunnerStartAgainstCaller(hangingStart(), controller.signal, device.id),
+    canceled,
+  );
+  await settleAsyncWork();
+
+  assert.equal(
+    mockSignalProcessGroupBestEffort.mock.calls.length,
+    0,
+    'a canceled waiter never signals a build another active request owns',
+  );
+  assert.deepEq
```

**File**: `packages/platform-apple/src/runner/runner-artifact.ts` (modified, +76/-5)
```diff
@@ -9,6 +9,7 @@ import {
   withProcessLock,
   emitRequestProgress,
   findProjectRoot,
+  getRequestSignal,
   isCommandTimeoutError,
 } from './host.ts';
 import type { ExecBackgroundResult } from '@agent-device/host-kit/command';
@@ -60,7 +61,78 @@ import { resolveAppleRunnerProjectPath } from './runner-source.ts';
 export { prepareXctestrunWithEnv } from './runner-artifact-env.ts';
 
 const runnerXctestrunBuildLocks = new Map<string, Promise<unknown>>();
-export const runnerPrepProcesses = new Set<ExecBackgroundResult['child']>();
+
+type RunnerPrepProcess = Readonly<{
+  deviceId: string;
+  requestId: string | undefined;
+  child: ExecBackgroundResult['child'];
+}>;
+
+const runnerPrepProcessLedger = new Set<RunnerPrepProcess>();
+
+/**
+ * Records a prep subprocess (`xcodebuild build-for-testing`) against the device it builds for and
+ * the request whose start spawned it, so a request canceled while waiting on that build can stop
+ * it (#3177). The build child keeps its owning start's signal as its first cancel path; this
+ * ledger is the device-scoped second one, for the waiters whose cancellation the spawn never saw.
+ * The owner is what keeps the second path from reaching a build another, still-active request
+ * launched: a canceled waiter stops only builds whose owner can no longer cancel them.
+ */
+export function registerRunnerPrepProcess(
+  deviceId: string,
+  child: ExecBackgroundResult['child'],
+  requestId?: string,
+): void {
+  const entry: RunnerPrepProcess = { deviceId, requestId, child };
+  runnerPrepProcessLedger.add(entry);
+  child.on('close', () => {
+    runnerPrepProcessLedger.delete(entry);
+  });
+}
+
+/** The prep subprocesses still running, for one device or for every device when none is named. */
+export function runnerPrepProcessChildren(
+  deviceId?: string,
+): readonly ExecBackgroundResult['child'][] {
+  return prepProcessEntries(deviceId).map((entry) => entry.child);
+}
+
+/**
+ * The prep subprocesses whose owning start is detached: the request that spawned it has finished,
+ * was canceled, or never existed (an in-process build with no request), so no live cancellation
+ * can reach the build anymore. A canceled waiter stops exactly these, never a build still owned by
+ * an in-flight request — that one belongs to its owner and dies through the owner's own signal.
+ */
+export function runnerPrepProcessChildrenWithoutActiveOwner(
+  deviceId?: string,
+): readonly ExecBackgroundResult['child'][] {
+  return prepProcessEntries(deviceId)
+    .filter((entry) => !isRunnerPrepOwnerActive(entry.requestId))
+    .map((entry) => entry.child);
+}
+
+function prepProcessEntries(deviceId?: string): readonly RunnerPrepProcess[] {
+  return [...runnerPrepProcessLedger].filter(
+    (entry) => deviceId === undefined || entry.deviceId === deviceId,
+  );
+}
+
+/**
+ * Whether the request owning a prep build can still cancel it: a registered, un-aborted request
+ * signal means the owner is in flight and its cancellation reaches the build through the exec
+ * layer directly.
+ */
+function isRunnerPrepOwnerActive(requestId: string | undefined): boolean {
+  if (!requestId) return false;
+  const ownerSignal = getRequestSignal(requestId);
+  return ownerSignal !== undefined && !ownerSignal.aborted;
+}
+
+export function forgetRunnerPrepProcess(child: ExecBackgroundResult['child']): void {
+  for (const entry of runnerPrepProcessLedger) {
+    if (entry.child === child) runnerPrepProcessLedger.delete(entry);
+  }
+}
 
 export type RunnerXctestrunArtifactState = 'valid' | 'rebuilt';
 
@@ -87,6 +159,8 @@ type RunnerXctestrunBuildOptions = {
   verbose?: boolean;
   logPath?: string;
   traceLogPath?: string;
+  /** The request whose start owns this build; recorded so cancel rules respect the owner. */
+  requestId?: string;
   /**
    * The build phase's one budget, opened by whoever owns the build: the cache decision's
    * blocking toolchain probes and `xcodebuild` spend the same clock, and the owning
@@ -484,10 +558,7 @@ async function buildRunnerXctestrun(
         timeoutMs: buildTimeoutMs,
         signal: options.budget?.signal,
         onSpawn: (child) => {
-          runnerPrepProcesses.add(child);
-          child.on('close', () => {
-            runnerPrepProcesses.delete(child);
-          });
+          registerRunnerPrepProcess(device.id, child, options.requestId);
         },
         onStdoutChunk: (chunk) => {
           logChunk(chunk, options.logPath, options.traceLogPath, options.verbose);
```

**File**: `packages/platform-apple/src/runner/runner-disposal.ts` (modified, +31/-6)
```diff
@@ -25,7 +25,12 @@ import {
   type RunnerLeaseCleanupAdapter,
   type RunnerXcodebuildCleanupTarget,
 } from './runner-lease.ts';
-import { IOS_RUNNER_CONTAINER_BUNDLE_IDS, runnerPrepProcesses } from './runner-xctestrun.ts';
+import {
+  forgetRunnerPrepProcess,
+  IOS_RUNNER_CONTAINER_BUNDLE_IDS,
+  runnerPrepProcessChildren,
+  runnerPrepProcessChildrenWithoutActiveOwner,
+} from './runner-xctestrun.ts';
 import { advanceRunnerSessionState, type RunnerSession } from './runner-session-types.ts';
 
 export const RUNNER_INVALIDATE_WAIT_TIMEOUT_MS = 1_000;
@@ -88,7 +93,7 @@ export async function cleanupOwnedIosRunnerLease(deviceId: string): Promise<void
 export async function abortRunnerSessionsAndPrepProcesses(
   activeSessions: readonly RunnerSession[],
 ): Promise<void> {
-  const prepProcesses = Array.from(runnerPrepProcesses);
+  const prepProcesses = runnerPrepProcessChildren();
   const macOsSessions = activeSessions.filter((session) => isMacOs(session.device));
   const otherSessions = activeSessions.filter((session) => !isMacOs(session.device));
   for (const session of activeSessions) {
@@ -108,15 +113,35 @@ export async function abortRunnerSessionsAndPrepProcesses(
   );
 }
 
-export async function stopRunnerPrepProcesses(): Promise<void> {
-  const prepProcesses = Array.from(runnerPrepProcesses);
+/**
+ * Stops the prep subprocesses (the `xcodebuild build-for-testing` behind a cold runner start)
+ * with the tree-kill escalation the sessions get. A device stops only its own builds: the caller
+ * that stops device A's session must not sweep device B's in-flight build (#3177).
+ */
+export async function stopRunnerPrepProcesses(deviceId?: string): Promise<void> {
+  await stopPrepProcessList(runnerPrepProcessChildren(deviceId));
+}
+
+/**
+ * Stops the device builds no active request owns anymore (#3177). A canceled waiter may stop the
+ * build it waited on only once that build's owning start is detached; a build still owned by an
+ * in-flight request belongs to its owner, which cancels it through its own signal, and a waiter
+ * must not SIGTERM another request's work out from under it.
+ */
+export async function stopRunnerPrepProcessesWithoutActiveOwner(deviceId?: string): Promise<void> {
+  await stopPrepProcessList(runnerPrepProcessChildrenWithoutActiveOwner(deviceId));
+}
+
+async function stopPrepProcessList(
+  prepProcesses: readonly ExecBackgroundResult['child'][],
+): Promise<void> {
   await Promise.allSettled(
     prepProcesses.map(async (child) => {
       try {
         await killRunnerProcessTree(child.pid, 'SIGTERM');
         await killRunnerProcessTree(child.pid, 'SIGKILL');
       } finally {
-        runnerPrepProcesses.delete(child);
+        forgetRunnerPrepProcess(child);
       }
     }),
   );
@@ -311,7 +336,7 @@ async function signalRunnerPrepProcesses(
     prepProcesses.map(async (child) => {
       await killRunnerProcessTree(child.pid, signal);
       if (signal === 'SIGKILL') {
-        runnerPrepProcesses.delete(child);
+        forgetRunnerPrepProcess(child);
       }
     }),
   );
```

**File**: `packages/platform-apple/src/runner/runner-session.ts` (modified, +4/-1)
```diff
@@ -120,7 +120,7 @@ export async function ensureRunnerSession(
     }
   });
   const { raceRunnerStartAgainstCaller } = await import('./runner-start-budget.ts');
-  return await raceRunnerStartAgainstCaller(start, options.signal);
+  return await raceRunnerStartAgainstCaller(start, options.signal, device.id);
 }
 
 /** How long the device-readiness probe may take, bounded by the startup budget it runs inside. */
@@ -675,6 +675,8 @@ export async function stopIosRunnerSession(deviceId: string): Promise<void> {
  * or wedges, so pooling it back hands the same stalled process to the next `open` (#2552). An idle
  * retained runner keeps warm reuse via the idle-stop timer. The decision is owned here because the
  * occupancy fact lives on the session, and awaited so `close` returns only once the lease is gone.
+ * Non-retained close stops the device's current prep processes before taking the session lock,
+ * which an in-flight cold start holds through its build. Later prep spawns are not fenced here.
  */
 export async function releaseIosRunnerOnClose(
   deviceId: string,
@@ -692,6 +694,7 @@ export async function releaseIosRunnerOnClose(
       data: { deviceId },
     });
   }
+  await stopRunnerPrepProcesses(deviceId);
   await stopIosRunnerSession(deviceId);
 }
 
```

**File**: `packages/platform-apple/src/runner/runner-start-budget.ts` (modified, +21/-4)
```diff
@@ -4,7 +4,8 @@ import {
   isRequestCanceledError,
 } from '@agent-device/kernel/errors';
 import { emitDiagnostic } from './host.ts';
-import { resolveRunnerStartupSignal } from './runner-contract.ts';
+import { isCallerDeadlineAbortReason, resolveRunnerStartupSignal } from './runner-contract.ts';
+import { stopRunnerPrepProcessesWithoutActiveOwner } from './runner-disposal.ts';
 import { createRunnerPhaseBudget, type RunnerPhaseBudget } from './runner-xctestrun.ts';
 import { normalizeRunnerStartupTimeoutMs, type RunnerSession } from './runner-session-types.ts';
 import type { AppleRunnerLifecycleOptions } from './runner-provider.ts';
@@ -85,18 +86,34 @@ function runnerStartBudgetExhaustedError(timeoutMs: number, explicit: boolean):
  * signal allows. A caller whose deadline lands during a cold xctestrun build leaves on time, the
  * build keeps going under the lock, and the next request for the device queues behind it and joins
  * the session it registers (#2894). Whatever the abort reason, the caller sees the same cancelled
- * request it would have seen from any later step; a cancelled request's abort also reaches the
- * start through its own startup signal, so nothing here decides whether the start survives. A
- * start that fails after its caller left has nobody to report to, so its failure is logged here.
+ * request it would have seen from any later step. A start that fails after its caller left has
+ * nobody to report to, so its failure is logged here.
+ *
+ * The two abort reasons get opposite treatment of the detached start, and the difference is the
+ * whole point (#2894 vs #3177). A caller's own deadline (a bounded poll) must leave the start
+ * running: it is the start the retry joins. A cancelled request means the client is gone, and the
+ * start it was waiting for belongs to nobody — its spawn carried the *waiting request's*
+ * cancellation signal only when that request opened the start, so a request that merely joined a
+ * start another request spawned has no path to it otherwise. On cancel the waiter stops the
+ * device's prep subprocesses through the same tree-kill path a session stop uses, so a timed-out
+ * `open` cannot orphan a `build-for-testing` on the shared runner derived-data root where a
+ * retried `open` would race it. Only builds whose owning start is detached are stopped: a build
+ * still owned by an in-flight request belongs to its owner and dies through the owner's own
+ * signal, never under a canceled waiter. The start itself keeps running under the lock (bounded
+ * by its own budget); its build is left running only while its owner is still there to cancel it.
  */
 export async function raceRunnerStartAgainstCaller(
   start: Promise<RunnerSession>,
   signal: AbortSignal | undefined,
+  deviceId: string,
 ): Promise<RunnerSession> {
   if (!signal) return await start;
   return await new Promise<RunnerSession>((resolve, reject) => {
     const abort = () => {
       reject(createRequestCanceledError(undefined, signal.reason));
+      if (!isCallerDeadlineAbortReason(signal.reason)) {
+        void stopRunnerPrepProcessesWithoutActiveOwner(deviceId);
+      }
       start.catch(emitDetachedRunnerStartFailed);
     };
     if (signal.aborted) {
```

**File**: `packages/platform-apple/src/runner/runner-xctestrun.ts` (modified, +3/-2)
```diff
@@ -1,9 +1,10 @@
 export {
   ensureXctestrunArtifact,
+  forgetRunnerPrepProcess,
   hasCachedAppleRunnerArtifact,
   prepareXctestrunWithEnv,
-  runnerPrepProcesses,
-  type ExternalXctestRunnerOptions,
+  runnerPrepProcessChildren,
+  runnerPrepProcessChildrenWithoutActiveOwner,
   type RunnerXctestrunArtifact,
   type RunnerXctestrunArtifactState,
 } from './runner-artifact.ts';
```

**File**: `scripts/layering/daemon-client-entry.ts` (modified, +5/-0)
```diff
@@ -48,6 +48,11 @@ export const DAEMON_CLIENT_ENTRY_EDGES: readonly DaemonClientEntryEdge[] = [
     target: 'src/daemon/daemon-request.ts',
     rationale: REQUEST_RATIONALE,
   },
+  {
+    file: 'src/daemon-client/daemon-client-liveness-probe.ts',
+    target: 'src/daemon/daemon-request.ts',
+    rationale: REQUEST_RATIONALE,
+  },
   {
     file: 'src/daemon-client/daemon-client-progress.ts',
     target: 'src/daemon/daemon-request.ts',
```

---

### Incident Patch 13: `db56bb77` (2026-10-05)
**Commit Message**: fix(limrun): keep the owner's reverse mappings on attached Android instances (#3204)

* fix(android): add a no-rebind mode to the port-reverse provider

createExecAndroidPortReverseProvider and createAndroidPortReverseManager
(executor form) take { noRebind }. The provider then runs
adb reverse --no-rebind for an endpoint it did not bind, still rebinds
its own mappings, and fails a refusal with COMMAND_FAILED and
details.reason 'android_port_reverse_rebind_refused'. The refusal is
classified from adb reverse --list, not from adb's stderr. The localhost
URL auto-reverse keeps that reason on the error it rethrows.

* fix(limrun): keep the owner's reverse mappings on attached Android instances

createLimrunAndroidSession asks createPortReverse for no-rebind mode when
ownership is 'attached'. configurePortReverse and the localhost URL
auto-reverse can then no longer replace an owner mapping such as tcp:8081,
so teardown cannot remove it. Created instances keep plain adb reverse.

* fix(android): never rebind an existing mapping in no-rebind mode

No-rebind mode now passes --no-rebind on every ensure, so a stale record
of a mapping this provider bound can no longer turn into a plain
adb

**File**: `packages/platform-android/src/__tests__/app-lifecycle-open.test.ts` (modified, +46/-3)
```diff
@@ -171,7 +171,8 @@ test('openAndroidApp ensures Android reverse before localhost deep link launch',
     booted: true,
   };
   const calls: Array<
-    { kind: 'exec'; args: readonly string[] } | { kind: 'reverse'; local: string; remote: string }
+    | { kind: 'exec'; args: readonly string[] }
+    | { kind: 'reverse'; local: string; remote: string; ownerId?: string }
   > = [];
 
   await withAndroidAdbProvider(
@@ -182,7 +183,12 @@ test('openAndroidApp ensures Android reverse before localhost deep link launch',
       },
       reverse: {
         ensure: async (mapping) => {
-          calls.push({ kind: 'reverse', local: mapping.local, remote: mapping.remote });
+          calls.push({
+            kind: 'reverse',
+            local: mapping.local,
+            remote: mapping.remote,
+            ownerId: mapping.ownerId,
+          });
         },
         remove: async () => {},
         removeAllOwned: async () => {},
@@ -193,7 +199,7 @@ test('openAndroidApp ensures Android reverse before localhost deep link launch',
   );
 
   assert.deepEqual(calls, [
-    { kind: 'reverse', local: 'tcp:8083', remote: 'tcp:8083' },
+    { kind: 'reverse', local: 'tcp:8083', remote: 'tcp:8083', ownerId: 'localhost-url' },
     {
       kind: 'exec',
       args: [
@@ -210,6 +216,43 @@ test('openAndroidApp ensures Android reverse before localhost deep link launch',
   ]);
 });
 
+test('openAndroidApp keeps the typed reason of a refused localhost reverse', async () => {
+  const device: DeviceInfo = {
+    platform: 'android',
+    id: 'emulator-5554',
+    name: 'Pixel',
+    kind: 'emulator',
+    booted: true,
+  };
+  const launches: (readonly string[])[] = [];
+
+  await assert.rejects(
+    () =>
+      withAndroidAdbProvider(
+        {
+          exec: async (args) => {
+            launches.push(args);
+            return { stdout: '', stderr: '', exitCode: 0 };
+          },
+          reverse: {
+            ensure: async () => {
+              throw new AppError('COMMAND_FAILED', 'already mapped', {
+                reason: 'android_port_reverse_rebind_refused',
+              });
+            },
+            remove: async () => {},
+            removeAllOwned: async () => {},
+          },
+        },
+        { serial: 'emulator-5554' },
+        async () => await openAndroidApp(device, 'exp://127.0.0.1:8081'),
+      ),
+    (error: unknown) =>
+      error instanceof AppError && error.details?.reason === 'android_port_reverse_rebind_refused',
+  );
+  assert.deepEqual(launches, []);
+});
+
 test('openAndroidApp ensures Android reverse before localhost app-bound deep link launch', async () => {
   const device: DeviceInfo = {
     platform: 'android',
```

**File**: `packages/platform-android/src/adb-port-reverse.test.ts` (modified, +118/-0)
```diff
@@ -67,3 +67,121 @@ test('a provider-owned reverse implementation is reused as-is when already manag
   const second = createAndroidPortReverseManager({ exec: async () => ok(), reverse: first });
   expect(second).toBe(first);
 });
+
+test('no-rebind refuses a device mapping another client owns with a typed reason', async () => {
+  bindAndroidAdbHostStub();
+  const calls: (readonly string[])[] = [];
+  const manager = createAndroidPortReverseManager(
+    async (args) => {
+      calls.push(args);
+      if (args.includes('--no-rebind')) {
+        return { exitCode: 1, stdout: '', stderr: 'adb: error: cannot rebind existing socket' };
+      }
+      return ok(args[1] === '--list' ? 'owner-host tcp:8081 tcp:8081\n' : '');
+    },
+    { noRebind: true },
+  );
+
+  await expect(
+    manager.ensure({ local: 'tcp:8081', remote: 'tcp:8081', ownerId: 'metro' }),
+  ).rejects.toMatchObject({
+    code: 'COMMAND_FAILED',
+    details: {
+      reason: 'android_port_reverse_rebind_refused',
+      existing: { local: 'tcp:8081', remote: 'tcp:8081' },
+    },
+  });
+  await manager.removeAllOwned('metro');
+
+  expect(calls).toEqual([
+    ['reverse', '--no-rebind', 'tcp:8081', 'tcp:8081'],
+    ['reverse', '--list'],
+  ]);
+});
+
+test('no-rebind does not re-point a mapping the same provider created', async () => {
+  bindAndroidAdbHostStub();
+  const calls: (readonly string[])[] = [];
+  const device = new Map<string, string>();
+  const manager = createAndroidPortReverseManager(
+    async (args) => {
+      calls.push(args);
+      if (args[1] === '--list') {
+        return ok([...device].map(([local, remote]) => `host-1 ${local} ${remote}\n`).join(''));
+      }
+      const [local, remote] = args.slice(-2) as [string, string];
+      if (args.includes('--no-rebind') && device.has(local)) {
+        return { exitCode: 1, stdout: '', stderr: 'adb: error: cannot rebind existing socket' };
+      }
+      device.set(local, remote);
+      return ok();
+    },
+    { noRebind: true },
+  );
+
+  await manager.ensure({ local: 'tcp:8081', remote: 'tcp:8081', ownerId: 'metro' });
+  await expect(
+    manager.ensure({ local: 'tcp:8081', remote: 'tcp:9090', ownerId: 'metro' }),
+  ).rejects.toMatchObject({
+    details: {
+      reason: 'android_port_reverse_rebind_refused',
+      existing: { local: 'tcp:8081', remote: 'tcp:8081', ownerId: 'metro' },
+    },
+  });
+
+  expect(device.get('tcp:8081')).toBe('tcp:8081');
+  expect(calls.filter((args) => args[1] !== '--list')).toEqual([
+    ['reverse', '--no-rebind', 'tcp:8081', 'tcp:8081'],
+    ['reverse', '--no-rebind', 'tcp:8081', 'tcp:9090'],
+  ]);
+});
+
+test('concurrent ensures of one endpoint reach the device once', async () => {
+  bindAndroidAdbHostStub();
+  const binds: (readonly string[])[] = [];
+  const device = new Set<string>();
+  const manager = createAndroidPortReverseManager(
+    async (args) => {
+      if (args[1] === '--list')
+        return ok([...device].map((local) => `host-1 ${local} ${local}\n`).join(''));
+      binds.push(args);
+      const local = args.at(-2) as string;
+      if (device.has(local)) {
+        return { exitCode: 1, stdout: '', stderr: 'adb: error: cannot rebind existing socket' };
+      }
+      device.add(local);
+      await new Promise((resolve) => setTimeout(resolve, 5));
+      return ok();
+    },
+    { noRebind: true },
+  );
+  const mapping = { local: 'tcp:8081', remote: 'tcp:8081', ownerId: 'metro' } as const;
+
+  await Promise.all([manager.ensure(mapping), manager.ensure(mapping)]);
+
+  expect(binds).toEqual([['reverse', '--no-rebind', 'tcp:8081', 'tcp:8081']]);
+});
+
+test('no-rebind reports an adb failure when the device lists no mapping for the endpoint', async () => {
+  bindAndroidAdbHostStub();
+  const manager = createAndroidPortReverseManager(
+    async (args) =>
+      args.includes('--no-rebind')
+        ? { exitCode: 1, stdout: '', stderr: 'error: device offline' }
+        : ok(),
+    { noRebind: true },
+  );
+
+  const failure = await manager
+    .ensure({ local: 'tcp:8081', remote: 'tcp:8081', ownerId: 'metro' })
+    .then(
+      () => undefined,
+      (error: unknown) => error,
+    );
+
+  expect(failure).toMatchObject({
+    code: 'COMMAND_FAILED',
+    details: { adbFailure: 'device_offline' },
+  });
+  expect(failure).not.toMatchObject({ details: { reason: 'android_port_reverse_rebind_refused' } });
+});
```

**File**: `packages/platform-android/src/adb-port-reverse.ts` (modified, +111/-59)
```diff
@@ -1,43 +1,71 @@
 import { AppError } from '@agent-device/kernel/errors';
+import { withKeyedLock } from '@agent-device/kernel/keyed-lock';
 import { androidAdbResultError } from './adb-failure.ts';
 import { normalizeAndroidAdbProvider } from './adb-provider-normalization.ts';
 import type {
   AndroidAdbExecutor,
   AndroidAdbProvider,
   AndroidPortReverseEndpoint,
   AndroidPortReverseMapping,
+  AndroidPortReverseOptions,
   AndroidPortReverseProvider,
 } from './adb-transport.ts';
 
 // Port-reverse ownership: an owner-tracked manager over a provider's reverse capability (or an
 // exec-backed fallback), so concurrent sessions cannot silently steal each other's mappings.
 
+export type AndroidExecPortReverseOptions = Readonly<{
+  /**
+   * Refuses to replace any existing device mapping, including one this provider created
+   * (`adb reverse --no-rebind`), for a device that other adb clients also drive. When
+   * `adb reverse --list` shows the endpoint after a refusal, the provider throws `COMMAND_FAILED`
+   * with `details.reason: 'android_port_reverse_rebind_refused'`; otherwise it throws the adb
+   * failure.
+   */
+  noRebind?: boolean;
+}>;
+
+const ANDROID_PORT_REVERSE_REBIND_REFUSED_REASON = 'android_port_reverse_rebind_refused';
+
 const managedAndroidPortReverseProviders = new WeakSet<AndroidPortReverseProvider>();
 
 export function createAndroidPortReverseManager(
   provider: AndroidAdbProvider | AndroidAdbExecutor,
+): AndroidPortReverseProvider;
+/** Options reach only the exec-backed provider the manager builds over a bare executor. */
+export function createAndroidPortReverseManager(
+  adb: AndroidAdbExecutor,
+  options: AndroidExecPortReverseOptions,
+): AndroidPortReverseProvider;
+export function createAndroidPortReverseManager(
+  provider: AndroidAdbProvider | AndroidAdbExecutor,
+  options?: AndroidExecPortReverseOptions,
 ): AndroidPortReverseProvider {
   const normalized = normalizeAndroidAdbProvider(provider);
   if (normalized.reverse && managedAndroidPortReverseProviders.has(normalized.reverse)) {
     return normalized.reverse;
   }
-  const reverse = normalized.reverse ?? createExecAndroidPortReverseProvider(normalized.exec);
+  const reverse =
+    normalized.reverse ?? createExecAndroidPortReverseProvider(normalized.exec, options);
   const active = new Map<AndroidPortReverseEndpoint, AndroidPortReverseMapping>();
+  const ensuring = new Map<string, Promise<unknown>>();
   const manager: AndroidPortReverseProvider = {
     async ensure(mapping, options) {
-      const current = active.get(mapping.local);
-      if (current && current.ownerId !== mapping.ownerId) {
-        throw new AppError(
-          'COMMAND_FAILED',
-          `Android port reverse ${mapping.local} is already owned by ${current.ownerId ?? 'another session'}`,
-          { current, requested: mapping },
-        );
-      }
-      if (current?.remote === mapping.remote) {
-        return;
-      }
-      await reverse.ensure(mapping, options);
-      active.set(mapping.local, { ...mapping });
+      await withKeyedLock(ensuring, mapping.local, async () => {
+        const current = active.get(mapping.local);
+        if (current && current.ownerId !== mapping.ownerId) {
+          throw new AppError(
+            'COMMAND_FAILED',
+            `Android port reverse ${mapping.local} is already owned by ${current.ownerId ?? 'another session'}`,
+            { current, requested: mapping },
+          );
+        }
+        if (current?.remote === mapping.remote) {
+          return;
+        }
+        await reverse.ensure(mapping, options);
+        active.set(mapping.local, { ...mapping });
+      });
     },
     async remove(local, options) {
       if (!active.has(local)) {
@@ -70,65 +98,89 @@ export function createAndroidPortReverseManager(
 
 export function createExecAndroidPortReverseProvider(
   adb: AndroidAdbExecutor,
+  providerOptions: AndroidExecPortReverseOptions = {},
 ): AndroidPortReverseProvider {
-  const owned = new Map<string, Set<AndroidPortReverseEndpoint>>();
+  const bound = new Map<AndroidPortReverseEndpoint, string | undefined>();
+  const list = async (options?: AndroidPortReverseOptions) => {
+    const result = await adb(['reverse', '--list'], {
+      allowFailure: true,
+      signal: options?.signal,
+      timeoutMs: options?.timeoutMs,
+    });
+    if (result.exitCode !== 0) return [];
+    return parseAndroidReverseList(result.stdout, bound);
+  };
+  const remove = async (
+    local: AndroidPortReverseEndpoint,
+    options?: AndroidPortReverseOptions,
+  ): Promise<void> => {
+    const result = await adb(['reverse', '--remove', local], {
+      allowFailure: true,
+      signal: options?.signal,
+      timeoutMs: options?.timeoutMs,
+    });
+    if (result.exitCode !== 0 && !isMissingReverseMapping(result.stdout, result.stderr)) {
+      throw androidAdbResultError(`Failed to remove Android port reverse ${local}`, result, {
+        local,
+      });
```

**File**: `packages/platform-android/src/app-lifecycle.ts` (modified, +8/-1)
```diff
@@ -28,6 +28,8 @@ const ANDROID_LAUNCHER_CATEGORY = 'android.intent.category.LAUNCHER';
 const ANDROID_LEANBACK_CATEGORY = 'android.intent.category.LEANBACK_LAUNCHER';
 const ANDROID_DEFAULT_CATEGORY = 'android.intent.category.DEFAULT';
 const ANDROID_LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
+/** Owns localhost URL reverses, so a teardown that removes only owned mappings removes them too. */
+const ANDROID_LOCALHOST_URL_REVERSE_OWNER = 'localhost-url';
 const ANDROID_CLOSE_FOCUS_TIMEOUT_MS = 2_000;
 const ANDROID_CLOSE_FOCUS_POLL_MS = 50;
 const ANDROID_CLOSE_PROCESS_TIMEOUT_MS = 2_000;
@@ -124,14 +126,19 @@ async function ensureAndroidLocalhostReverse(device: DeviceInfo, target: string)
 
   const reverse = createAndroidPortReverseManager(resolveAndroidAdbProvider(device));
   try {
-    await reverse.ensure({ local: endpoint, remote: endpoint });
+    await reverse.ensure({
+      local: endpoint,
+      remote: endpoint,
+      ownerId: ANDROID_LOCALHOST_URL_REVERSE_OWNER,
+    });
   } catch (error) {
     const details = {
       localPort: endpoint.replace('tcp:', ''),
       operation: `adb reverse ${endpoint} ${endpoint}`,
     };
     if (error instanceof AppError) {
       Object.assign(details, {
+        reason: error.details?.reason,
         hint: error.details?.hint,
         diagnosticId: error.details?.diagnosticId,
         logPath: error.details?.logPath,
```

**File**: `packages/provider-limrun/src/android.ts` (modified, +3/-1)
```diff
@@ -83,7 +83,9 @@ export async function createLimrunAndroidSession(
       await client.setText(request.target, request.text);
     },
   };
-  adbProvider.reverse = await dependencies.android.createPortReverse(adbProvider.exec);
+  adbProvider.reverse = await dependencies.android.createPortReverse(adbProvider.exec, {
+    noRebind: options.ownership === 'attached',
+  });
   return Object.assign(session, { adbProvider });
 }
 
```

**File**: `packages/provider-limrun/src/runtime-dependencies.ts` (modified, +8/-1)
```diff
@@ -75,7 +75,14 @@ export type LimrunAndroidKeyboardDismissResult = LimrunAndroidKeyboardState & {
 export type LimrunAndroidRuntimeAdapter = {
   // Interactors need provider-scoped capabilities; command helpers below need only ADB execution.
   createInteractor(device: DeviceInfo, adb: LimrunAdbProvider): Interactor;
-  createPortReverse(adb: LimrunAdbExecutor): Promise<LimrunPortReverse>;
+  /**
+   * `noRebind` refuses to replace a device mapping this session did not create, for an instance
+   * whose owner may hold reverse mappings of their own.
+   */
+  createPortReverse(
+    adb: LimrunAdbExecutor,
+    options: Readonly<{ noRebind: boolean }>,
+  ): Promise<LimrunPortReverse>;
   inferAppName(packageName: string): Promise<string>;
   listApps(
     adb: LimrunAdbExecutor,
```

**File**: `src/__tests__/limrun-runtime.test.ts` (modified, +51/-4)
```diff
@@ -843,25 +843,72 @@ test('Limrun removes only its own port reverse mappings from an attached Android
   const runtime = new LimrunRuntime({ instances: { android: ATTACHED_ANDROID } });
   const lease = { ...androidLease(), leaseId: 'lease-attached-android' };
   vi.mocked(runCmd).mockImplementation(async (_command, args) => ({
-    stdout: args.includes('--list') ? 'host-7 tcp:8081 tcp:8081\nhost-9 tcp:8097 tcp:8097\n' : '',
+    stdout: args.includes('--list')
+      ? 'host-7 tcp:8081 tcp:8081\nhost-9 tcp:8097 tcp:8097\nhost-9 tcp:8099 tcp:8099\n'
+      : '',
     stderr: '',
     exitCode: 0,
   }));
 
-  await allocateLimrunDevice(runtime, lease);
+  const device = await allocateLimrunDevice(runtime, lease);
   await runtime.configurePortReverse({
     leaseId: lease.leaseId,
     devicePort: 8097,
     hostPort: 8097,
     name: 'react-devtools',
   });
+  await runtime.getInteractor(device)?.open('http://127.0.0.1:8099/');
   await runtime.shutdown();
 
   const removals = vi
     .mocked(runCmd)
     .mock.calls.map(([, args]) => args)
-    .filter((args) => args.includes('--remove'));
-  assert.deepEqual(removals, [['-s', '127.0.0.1:62001', 'reverse', '--remove', 'tcp:8097']]);
+    .filter((args) => args.includes('--remove'))
+    .map((args) => args.at(-1))
+    .sort();
+  assert.deepEqual(removals, ['tcp:8097', 'tcp:8099']);
+});
+
+test('Limrun refuses to replace an owner port reverse on an attached Android instance', async () => {
+  const runtime = new LimrunRuntime({ instances: { android: ATTACHED_ANDROID } });
+  const lease = { ...androidLease(), leaseId: 'lease-attached-android' };
+  vi.mocked(runCmd).mockImplementation(async (_command, args) =>
+    args.includes('--no-rebind')
+      ? { stdout: '', stderr: 'adb: error: cannot rebind existing socket', exitCode: 1 }
+      : {
+          stdout: args.includes('--list') ? 'owner-host tcp:8081 tcp:8081\n' : '',
+          stderr: '',
+          exitCode: 0,
+        },
+  );
+  const isRebindRefusal = (error: unknown) =>
+    (error as { details?: { reason?: unknown } }).details?.reason ===
+    'android_port_reverse_rebind_refused';
+
+  const device = await allocateLimrunDevice(runtime, lease);
+  await assert.rejects(
+    () =>
+      runtime.configurePortReverse({
+        leaseId: lease.leaseId,
+        devicePort: 8081,
+        hostPort: 8081,
+        name: 'metro',
+      }),
+    isRebindRefusal,
+  );
+  const interactor = runtime.getInteractor(device);
+  if (!interactor) throw new Error('Limrun runtime must return an interactor');
+  await assert.rejects(() => interactor.open('exp://127.0.0.1:8081'), isRebindRefusal);
+  await runtime.shutdown();
+
+  const reverseCalls = vi
+    .mocked(runCmd)
+    .mock.calls.map(([, args]) => args.slice(2))
+    .filter((args) => args[0] === 'reverse' && args[1] !== '--list');
+  assert.deepEqual(reverseCalls, [
+    ['reverse', '--no-rebind', 'tcp:8081', 'tcp:8081'],
+    ['reverse', '--no-rebind', 'tcp:8081', 'tcp:8081'],
+  ]);
 });
 
 test('Limrun instance access wins over the API key for its platform only', async () => {
```

**File**: `src/sdk/limrun-runtime-dependencies.ts` (modified, +2/-2)
```diff
@@ -18,10 +18,10 @@ export function createLimrunRuntimeDependencies(): LimrunRuntimeDependencies {
     clientVersion: readVersion(),
     android: {
       createInteractor: (device, adb) => createAndroidInteractor(device, adb),
-      createPortReverse: async (adb) => {
+      createPortReverse: async (adb, options) => {
         const { createAndroidPortReverseManager } =
           await import('@agent-device/platform-android/mechanics');
-        return createAndroidPortReverseManager(adb);
+        return createAndroidPortReverseManager(adb, options);
       },
       inferAppName: async (packageName) => {
         const { inferAndroidAppName } = await import('@agent-device/platform-android/mechanics');
```

---

### Incident Patch 14: `2212eacf` (2026-10-04)
**Commit Message**: fix: centralize daemon startup ownership and retirement (#3127)

* fix: centralize daemon startup and retirement ownership

* refactor: share daemon registration identity proof

* chore(gates): acknowledge composed health probe timing

* refactor: keep health probe outcome classification consistent

* chore(gates): pin composed health probe declaration

* test: preserve scoped repair evidence and restart probe cancellation

**File**: `docs/adr/0030-process-lock-exclusion.md` (modified, +41/-3)
```diff
@@ -40,6 +40,44 @@ guard cannot constrain legacy code after its final check. The support boundary t
 requires deployment control; host-kit does not claim to detect or evict every legacy user.
 
 Daemon registration has a separate cutover boundary: keep the same `daemon.lock` path and
-refuse legacy files rather than automatically reclaiming them. Its startup tests must cover
-an already-running older daemon and concurrent old/new startup. This does not expand the
-host-kit mixed-protocol support contract.
+refuse legacy files rather than automatically reclaiming them. A legacy daemon creates an
+exclusive file; a hardened daemon creates a directory at that same path. The old acquisition
+cannot unlink a directory, and the new acquisition retains an existing file.
+
+The [registration tests](../../src/__tests__/daemon-registration-owner.test.ts) exercise real
+children using the c237027737 legacy acquisition and the current owner. They cover an older
+daemon already running, a hardened owner waiting to publish metadata, and concurrent startup.
+The client refuses an older registration before signaling or changing it. This proves the daemon
+cutover; it does not expand the host-kit mixed-protocol support contract. Older clients still
+require the deployment controls above.
+
+## Recovering retained legacy daemon state
+
+Stop every daemon and client using the affected state directory, including older versions,
+and verify that those processes have exited. Keep them stopped throughout recovery.
+Only then remove the legacy `daemon.lock` file and any retained `daemon.reclaim.lock` guard
+from that directory. Preserve the other state, logs and repair evidence.
+
+Start one supported version using that directory and prevent older clients or daemons from
+returning. If every user cannot be identified and stopped, retain the files and use a separate
+state directory. This procedure applies to daemon registration; shared build and cache locks
+require the same confirmation for every process using their own paths.
+
+## Registration operations
+
+[Shared retirement](../../src/daemon-registration-owner.ts) owns verified termination, protected
+metadata inspection and removal, and release. Takeover, failed startup, replay cleanup, timeout
+reset and manual stop await its result. Abandoned recovery uses the same protected retirement
+sequence without signaling a live process. Daemon publication and shutdown use functions bound
+to their acquired claim.
+
+```mermaid
+flowchart LR
+    C[Client lifecycle and timeout] --> R[Shared retirement]
+    M[Manual stop] --> R
+    P[Abandoned recovery and pruning] --> R
+    R --> L[Acquired registration claim]
+    D[Daemon startup and shutdown] --> O[Functions bound to own claim]
+    O --> L
+    L --> F[Protected metadata and reports]
+```
```

**File**: `packages/host-kit/src/internal/owner-identity-liveness.test.ts` (modified, +10/-0)
```diff
@@ -59,3 +59,13 @@ test('a missing entry in a completed process snapshot stays fail-closed without
   assert.equal(mockIsProcessZombie.mock.calls.length, 0);
   assert.equal(mockReadProcessStartTime.mock.calls.length, 0);
 });
+
+test('a pid outside the native range is unknown without a liveness probe', () => {
+  assert.equal(
+    classifyOwnerLiveness({ owner: { pid: 2_147_483_648, startTime: 'start-a' } }),
+    'unknown',
+  );
+  assert.equal(mockIsProcessAlive.mock.calls.length, 0);
+  assert.equal(mockIsProcessZombie.mock.calls.length, 0);
+  assert.equal(mockReadProcessStartTime.mock.calls.length, 0);
+});
```

**File**: `packages/host-kit/src/internal/owner-identity.ts` (modified, +10/-1)
```diff
@@ -11,6 +11,11 @@ export type OwnerIdentity = {
   startTime: string | null;
 };
 
+/** A process id accepted by Node's native signal API. */
+export function isProcessPid(value: unknown): value is number {
+  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 0x7fff_ffff;
+}
+
 export type OwnerLiveness =
   | 'live'
   | 'owner-process-dead'
@@ -75,6 +80,7 @@ export function classifyOwnerLivenessFromObservation(
   observation?: HostProcessIdentityObservation | null,
 ): OwnerLiveness {
   const { owner, stateDir } = params;
+  if (!isProcessPid(owner.pid)) return 'unknown';
   if (!isProcessAlive(owner.pid)) return 'owner-process-dead';
   if (observation !== undefined ? observation?.state.startsWith('Z') : isProcessZombie(owner.pid)) {
     return 'owner-process-dead';
@@ -88,7 +94,10 @@ export function classifyOwnerLivenessFromObservation(
       return 'owner-process-reused';
     }
   }
-  if (!stateDir) return 'live';
+  return stateDir ? classifyOwnerStateDirectory(stateDir) : 'live';
+}
+
+function classifyOwnerStateDirectory(stateDir: string): OwnerLiveness {
   try {
     fs.statSync(stateDir);
     return 'live';
```

**File**: `packages/host-kit/src/internal/process-lock.fixtures.ts` (modified, +49/-1)
```diff
@@ -1,7 +1,28 @@
 import fs from 'node:fs';
+import path from 'node:path';
 import { vi } from 'vitest';
 import { readProcessStartTime } from './host-process.ts';
-import type { ProcessLockOwner } from './process-lock.ts';
+import type { ProcessLockOwner, ProcessLockOwnerRecord } from './process-lock.ts';
+
+export function writeLockOwnerFixture(
+  lockDirPath: string,
+  owner: ProcessLockOwner | ProcessLockOwnerRecord,
+): void {
+  fs.mkdirSync(lockDirPath);
+  fs.writeFileSync(path.join(lockDirPath, 'owner.json'), JSON.stringify(owner));
+}
+
+export function writeDeadLockFixture(lockDirPath: string, acquiredAtMs = Date.now()): void {
+  writeLockOwnerFixture(lockDirPath, { pid: 999_999_999, startTime: null, acquiredAtMs });
+}
+
+export function failUnlinkForPath(filePath: string, error: Error) {
+  const unlink = fs.unlinkSync;
+  return vi.spyOn(fs, 'unlinkSync').mockImplementation((target) => {
+    if (String(target) === filePath) throw error;
+    return unlink(target);
+  });
+}
 
 export function currentProcessOwner(): ProcessLockOwner {
   return {
@@ -41,3 +62,30 @@ export function onFirstGuardOpen(mutexPath: string, action: () => void) {
   }) as typeof fs.openSync);
   return { fired: () => fired, restore: () => spy.mockRestore() };
 }
+
+export const UNINFORMATIVE_OWNER_RECORDS = [
+  '{ pid: ',
+  'null',
+  '"999999999"',
+  '{"pid":"999999999","startTime":null,"acquiredAtMs":1}',
+  '{"pid":0,"startTime":null,"acquiredAtMs":1}',
+  '{"pid":999999999,"startTime":7,"acquiredAtMs":1}',
+  '{"pid":999999999,"startTime":null}',
+] as const;
+
+function failRenameForPath(filePath: string, error: Error) {
+  const rename = fs.renameSync;
+  return vi.spyOn(fs, 'renameSync').mockImplementation((source, destination) => {
+    if (String(destination) === filePath) throw error;
+    return rename(source, destination);
+  });
+}
+
+export function failLockOwnerPublication(lockDirPath: string, releaseFails: boolean) {
+  const primary = Object.assign(new Error('publication failed'), { code: 'EIO' });
+  const releaseError = Object.assign(new Error('guard unlink refused'), { code: 'EPERM' });
+  const renameSpy = failRenameForPath(path.join(lockDirPath, 'owner.json'), primary);
+  const guardPath = lockDirPath.replace(/\.lock$/, '.reclaim.lock');
+  const unlinkSpy = releaseFails ? failUnlinkForPath(guardPath, releaseError) : undefined;
+  return { primary, renameSpy, unlinkSpy, guardPath };
+}
```

**File**: `packages/host-kit/src/internal/process-lock.test.ts` (modified, +93/-92)
```diff
@@ -2,7 +2,8 @@ import assert from 'node:assert/strict';
 import fs from 'node:fs';
 import path from 'node:path';
 import { afterEach, beforeEach, test, vi } from 'vitest';
-import { AppError } from '@agent-device/kernel/errors';
+import { AppError, normalizeError } from '@agent-device/kernel/errors';
+import * as diagnostics from './diagnostics.ts';
 
 const { zombiePids, processProbe } = vi.hoisted(() => ({
   zombiePids: new Set<number>(),
@@ -36,9 +37,14 @@ import { mkdtempForTestSync } from './tmp-dir.fixtures.ts';
 import { holdLegacyReclaimMutex } from './legacy-process-lock.fixtures.ts';
 import {
   currentProcessOwner,
+  failLockOwnerPublication,
+  UNINFORMATIVE_OWNER_RECORDS,
+  failUnlinkForPath,
   listReclaimSiblings,
   onFirstGuardOpen,
   stampDirectoryAbandoned,
+  writeDeadLockFixture,
+  writeLockOwnerFixture,
 } from './process-lock.fixtures.ts';
 
 let tmpDir: string;
@@ -67,15 +73,7 @@ test('acquireProcessLock creates and releases a lock directory', async () => {
 
 test('acquireProcessLock reclaims locks owned by dead processes', async () => {
   const lockDirPath = path.join(tmpDir, 'stale.lock');
-  fs.mkdirSync(lockDirPath);
-  fs.writeFileSync(
-    path.join(lockDirPath, 'owner.json'),
-    JSON.stringify({
-      pid: 999_999_999,
-      startTime: null,
-      acquiredAtMs: Date.now() - 10_000,
-    }),
-  );
+  writeDeadLockFixture(lockDirPath, Date.now() - 10_000);
 
   const release = await acquireProcessLock({
     lockDirPath,
@@ -113,18 +111,14 @@ test('acquireProcessLock reclaims locks owned by zombie processes', async () =>
 
 test('acquireProcessLock never steals a null-start-time lock from an alive pid', async () => {
   const lockDirPath = path.join(tmpDir, 'null-start.lock');
-  fs.mkdirSync(lockDirPath);
   // An acquiredAtMs far older than this process simulates what a wall-clock
   // step makes a live null-start owner look like; age is not proof of death,
   // so the waiter must time out instead of reclaiming the held lock.
-  fs.writeFileSync(
-    path.join(lockDirPath, 'owner.json'),
-    JSON.stringify({
-      pid: process.pid,
-      startTime: null,
-      acquiredAtMs: Date.now() - 365 * 24 * 60 * 60_000,
-    }),
-  );
+  writeLockOwnerFixture(lockDirPath, {
+    pid: process.pid,
+    startTime: null,
+    acquiredAtMs: Date.now() - 365 * 24 * 60 * 60_000,
+  });
 
   await assert.rejects(
     () =>
@@ -144,9 +138,8 @@ test('acquireProcessLock never steals a null-start-time lock from an alive pid',
 
 test('acquireProcessLock reports live lock owner details on timeout', async () => {
   const lockDirPath = path.join(tmpDir, 'busy.lock');
-  fs.mkdirSync(lockDirPath);
   const owner = currentProcessOwner();
-  fs.writeFileSync(path.join(lockDirPath, 'owner.json'), JSON.stringify(owner));
+  writeLockOwnerFixture(lockDirPath, owner);
 
   await assert.rejects(
     () =>
@@ -268,15 +261,7 @@ test('acquireProcessLock retains an owner whose record was never written', async
 
 test('one abandoned lock offered to two contenders is held by exactly one of them', async () => {
   const lockDirPath = path.join(tmpDir, 'contended.lock');
-  fs.mkdirSync(lockDirPath);
-  fs.writeFileSync(
-    path.join(lockDirPath, 'owner.json'),
-    JSON.stringify({
-      pid: 999_999_999,
-      startTime: null,
-      acquiredAtMs: Date.now(),
-    }),
-  );
+  writeDeadLockFixture(lockDirPath);
   stampDirectoryAbandoned(lockDirPath);
 
   const attempts = await Promise.allSettled([
@@ -305,16 +290,6 @@ test('one abandoned lock offered to two contenders is held by exactly one of the
   assert.deepEqual(listReclaimSiblings(tmpDir), []);
 });
 
-const UNINFORMATIVE_OWNER_RECORDS = [
-  '{ pid: ',
-  'null',
-  '"999999999"',
-  '{"pid":"999999999","startTime":null,"acquiredAtMs":1}',
-  '{"pid":0,"startTime":null,"acquiredAtMs":1}',
-  '{"pid":999999999,"startTime":7,"acquiredAtMs":1}',
-  '{"pid":999999999,"startTime":null}',
-] as const;
-
 for (const [index, record] of UNINFORMATIVE_OWNER_RECORDS.entries()) {
   test(`acquireProcessLock does not evict the lock behind the record ${record}`, async () => {
     const lockDirPath = path.join(tmpDir, `uninformative-${index}.lock`);
@@ -371,13 +346,10 @@ test('a release that could not verify ownership does not wedge the next acquire
   const release = await acquireProcessLock({ lockDirPath, owner: currentProcessOwner() });
 
   // The unlink the release needs is refused, which is what an EACCES or EMFILE looks like here.
-  const realUnlink = fs.unlinkSync;
-  const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(((target: fs.PathLike) => {
-    if (String(target) === ownerFilePath) {
-      throw Object.assign(new Error('EACCES: permission denied, unlink'), { code: 'EACCES' });
-    }
-    return realUnlink(target as string);
-  }) as typeof fs.unlinkSync);
+  const unlinkSpy = failUnlinkForPath(
+    ownerFilePath,
+    Object.assign(new Error('EACCES: permission denied, unlink'), { code: 'EACCES' }),
+  );
   
```

**File**: `packages/host-kit/src/internal/process-lock.ts` (modified, +18/-4)
```diff
@@ -1,11 +1,12 @@
 import crypto from 'node:crypto';
 import fs from 'node:fs';
 import path from 'node:path';
-import { AppError } from '@agent-device/kernel/errors';
+import { AppError, normalizeError } from '@agent-device/kernel/errors';
 import { publishFileSync } from './atomic-file.ts';
 import { emitDiagnostic } from './diagnostics.ts';
 import {
   classifyOwnerLiveness,
+  isProcessPid,
   ownerIdentityMatches,
   type OwnerLiveness,
 } from './owner-identity.ts';
@@ -179,7 +180,7 @@ function withMutationGuardHeld<Result>(
       emitDiagnostic({
         level: 'warn',
         phase: 'process_lock_guard_release_failed',
-        data: { lockDirPath, error: String(releaseError) },
+        data: { lockDirPath, error: normalizeError(releaseError) },
       });
     }
     throw error;
@@ -504,7 +505,20 @@ async function waitForReclaimMutex(lockDirPath: string): Promise<boolean> {
 }
 
 function releaseReclaimMutex(lockDirPath: string): void {
-  fs.unlinkSync(reclaimMutexPath(lockDirPath));
+  try {
+    fs.unlinkSync(reclaimMutexPath(lockDirPath));
+  } catch (error) {
+    throw new AppError(
+      'COMMAND_FAILED',
+      'Process lock mutation guard release could not be confirmed.',
+      {
+        reason: 'process_lock_guard_release_failed',
+        lockDirPath,
+        hint: staleLockHint(lockDirPath),
+      },
+      error,
+    );
+  }
 }
 
 function errorCode(error: unknown): string | undefined {
@@ -553,7 +567,7 @@ function parseProcessLockOwner(contents: string): ProcessLockOwnerRecord | null
 
 const PROCESS_LOCK_OWNER_FIELD_SHAPES: Record<keyof ProcessLockOwner, (value: unknown) => boolean> =
   {
-    pid: (value) => typeof value === 'number' && Number.isInteger(value) && value > 0,
+    pid: isProcessPid,
     acquiredAtMs: (value) => typeof value === 'number' && Number.isFinite(value),
     startTime: (value) => value === undefined || value === null || typeof value === 'string',
   };
```

**File**: `packages/host-kit/src/process.ts` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ export {
 export {
   classifyOwnerLiveness,
   classifyOwnerLivenessFromObservation,
+  isProcessPid,
   type OwnerIdentity,
   ownerIdentityDiffers,
   ownerIdentityMatches,
```

**File**: `src/__tests__/daemon-exit-wait.test.ts` (modified, +12/-3)
```diff
@@ -57,6 +57,16 @@ afterEach(() => {
   vi.restoreAllMocks();
 });
 
+test.each([0, -1, 1.5, 2_147_483_648, Number.MAX_SAFE_INTEGER])(
+  'an invalid native pid %s cannot prove exit during recovery',
+  async (pid) => {
+    expect(await waitForDaemonExit({ pid, startTime: OURS }, { timeoutMs: 0 })).toEqual({
+      exited: false,
+      elapsedMs: 0,
+    });
+  },
+);
+
 test('waitForDaemonExit reports a pid recycled mid-wait as exited, without burning the deadline', async () => {
   setTimeout(() => state.starts.set(PID, RECYCLED), 20);
   const wait = await waitForDaemonExit(
@@ -205,16 +215,15 @@ test('force termination delivers KILL first and returns its confirmed exit', asy
   });
 });
 
-test('a daemon reaped after the TERM budget retains graceful mode without signaling its zombie', async () => {
+test('a daemon that becomes a zombie on TERM retains graceful mode without SIGKILL', async () => {
   onSignal = (signal) => {
     if (signal !== 'SIGTERM') return;
     state.states.set(PID, 'Z');
     state.commands.set(PID, '<defunct>');
-    setTimeout(() => state.alive.set(PID, false), 10);
   };
   const result = await stopDaemonProcess(
     { pid: PID, startTime: OURS },
-    { mode: 'graceful', termTimeoutMs: 0, killTimeoutMs: 40 },
+    { mode: 'graceful', termTimeoutMs: 0, killTimeoutMs: 0 },
   );
   expect(signals).toEqual(['SIGTERM']);
   expect(result).toMatchObject({ status: 'exited', mode: 'graceful' });
```

---

### Incident Patch 15: `052cba83` (2026-10-04)
**Commit Message**: fix(ios): prefer USB entries for duplicate usbmux devices (#3191)

Signed-off-by: Arthur031221 <[REDACTED_EMAIL]>
Co-authored-by: Suyash Bansal <[REDACTED_EMAIL]>

**File**: `packages/platform-apple/src/runner/__tests__/runner-usbmux.test.ts` (modified, +51/-0)
```diff
@@ -174,6 +174,57 @@ test('never matches a different device whose UDID merely shares a prefix', async
   assert.equal(server.connectedDeviceId(), undefined);
 });
 
+test.each([
+  {
+    name: 'prefers USB when Network is listed first',
+    devices: [
+      { deviceId: 552, udid: DEVICE_UDID, connectionType: 'Network' },
+      { deviceId: 551, udid: DEVICE_UDID, connectionType: 'USB' },
+    ],
+    expectedDeviceId: 551,
+  },
+  {
+    name: 'prefers USB when USB is listed first',
+    devices: [
+      { deviceId: 551, udid: DEVICE_UDID, connectionType: 'USB' },
+      { deviceId: 552, udid: DEVICE_UDID, connectionType: 'Network' },
+    ],
+    expectedDeviceId: 551,
+  },
+  {
+    name: 'uses the first Network match when USB is absent',
+    devices: [
+      { deviceId: 552, udid: DEVICE_UDID, connectionType: 'Network' },
+      { deviceId: 553, udid: DEVICE_UDID, connectionType: 'Network' },
+    ],
+    expectedDeviceId: 552,
+  },
+  {
+    name: 'ignores USB entries for a different UDID',
+    devices: [
+      { deviceId: 552, udid: DEVICE_UDID, connectionType: 'Network' },
+      { deviceId: 551, udid: `${DEVICE_UDID}0`, connectionType: 'USB' },
+    ],
+    expectedDeviceId: 552,
+  },
+  {
+    name: 'ignores USB entries with an invalid device ID',
+    devices: [
+      { deviceId: 552, udid: DEVICE_UDID, connectionType: 'Network' },
+      { deviceId: 0, udid: DEVICE_UDID, connectionType: 'USB' },
+    ],
+    expectedDeviceId: 552,
+  },
+])('$name', async ({ devices, expectedDeviceId }) => {
+  const socketPath = await createSocketPath(socketDirectories);
+  const server = await serveUsbmuxDevices(socketPath, devices, 3);
+
+  const error = await postThroughFakeUsbmux(socketPath, DEVICE_UDID);
+
+  assert.equal((error as AppError).code, 'COMMAND_FAILED');
+  assert.equal(server.connectedDeviceId(), expectedDeviceId);
+});
+
 test('treats a device usbmuxd no longer knows as unattached so a tunnel fallback can run', async () => {
   const socketPath = await createSocketPath(socketDirectories);
   // Result 2 is what the real daemon answers for an unknown DeviceID.
```

**File**: `packages/platform-apple/src/runner/runner-usbmux-protocol.ts` (modified, +9/-2)
```diff
@@ -229,11 +229,18 @@ function buildPlistMessage(
 }
 
 function readDeviceIdFromList(xml: string, udid: string): number | undefined {
+  let fallback: number | undefined;
   for (const node of walkXmlNodes(parseXmlDocumentSync(xml))) {
     const device = readListedDevice(node);
-    if (device?.udid === udid) return device.id;
+    if (device?.udid !== udid) continue;
+    const connectionType = readDictEntry(
+      readDictEntry(node, 'Properties')!,
+      'ConnectionType',
+    )?.text;
+    if (connectionType === 'USB') return device.id;
+    fallback ??= device.id;
   }
-  return undefined;
+  return fallback;
 }
 
 function readListedDevice(node: XmlNode): { udid: string; id: number } | undefined {
```

#### Recent Merged Pull Requests:
- **PR #3230** (2026-10-05): fix(provider-webdriver): send an empty JSON object on bodyless POSTs (@okwasniewski)
- **PR #3227** (2026-10-05): fix(daemon): keep an idle daemon alive only for retained leases (@thymikee)
- **PR #3226** (2026-10-05): fix(doctor): warm the runner cache only for simulators this host discovered (@thymikee)
- **PR #3225** (2026-10-05): fix(apple): start no host runner cache build while a provider serves Apple tooling (@thymikee)
- **PR #3222** (2026-10-05): fix(limrun): compare only the leased platform's credentials (@thymikee)
- **PR #3221** (2026-10-05): test(provider-webdriver): carry the review tests that missed the #3169 merge (@amankansal-lt)
- **PR #3219** (2026-10-05): fix(recording): render the touch overlay at most 30 fps and inside the record request (@harrisrobin)
- **PR #3215** (2026-10-05): fix(daemon): disclose drag ref refusals before dispatch (@xujiantop-crypto)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
