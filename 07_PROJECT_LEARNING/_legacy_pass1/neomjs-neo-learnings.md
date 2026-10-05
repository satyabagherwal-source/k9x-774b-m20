# Forensic Learning Record (Deep Inspection): neomjs/neo

> **Canonical Artifact**: `07_PROJECT_LEARNING/neomjs-neo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/neomjs/neo](https://github.com/neomjs/neo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:35:33.363Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `neomjs/neo`
- **Description**: Neo.mjs is a self-evolving software organism: a professional end-to-end AI engineering team whose cross-model swarm inhabits live apps via Neural Link, Active Hybrid GraphRAG, DreamService, and self-healing loops.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3282 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/rgReplaceGuardHook.mjs`
```
#!/usr/bin/env node
/**
 * @module .claude/hooks/rgReplaceGuardHook
 * @summary Claude Code `PreToolUse` guard for the high-frequency `rg -r` footgun: in ripgrep, `-r`
 * means `--replace`, not recursion. The hook is intentionally narrow: it only inspects Bash tool
 * commands, only flags `rg` invocations, and allows explicit replacement shapes with a replacement
 * plus a search pattern.
 *
 * The hook fails open on malformed payloads. A broken guard must never block ordinary tool use; at worst,
 * it misses one warning and the user can re-run the command.
 */
import {pathToFileURL} from 'node:url';

export const RG_REPLACE_GUARD_MESSAGE = '`rg -r` is `--replace`, not recursion. ripgrep recurses by default; did you mean a plain recursive search?';

const SHELL_SEPARATORS = new Set([';', '|', '||', '&&']);

/**
 * @summary Tokenizes enough shell syntax to identify command words and simple separators without executing
 * or fully parsing Bash. Quoted strings stay single tokens; this is sufficient for `rg --replace "x" "y"`.
 * @param {String} command
 * @returns {String[]}
 */
export function tokenizeShellCommand(command = '') {
    const tokens  = [];
    let   current = '';
    let   quote   = null;
    let   escape  = false;

    function pushCurrent() {
        if (current.length > 0) {
            tokens.push(current);
            current = '';
        }
    }

    for (let i = 0; i < command.length; i++) {
        const char = command[i];

        if (escape) {
            current += char;
            escape = false;
            continue
        }

        if (char === '\\') {
            escape = true;
            continue
        }

        if (quote) {
            if (char === quote) {
                quote = null;
            } else {
                current += char;
            }
            continue
        }

        if (char === '\'' || char === '"' || char === '`') {
            quote = char;
            continue
        }

        if (/\s/.test(char)) {
            pushCurrent();
            continue
        }

        if (char === '&' && command[i + 1] === '&') {
            pushCurrent();
            tokens.push('&&');
            i++;
            continue
        }

        if (char === '|' && command[i + 1] === '|') {
            pushCurrent();
            tokens.push('||');
            i++;
            continue
        }

        if (char === ';' || char === '|') {
            pushCurrent();
            tokens.push(char);
            continue
        }

        current += char;
    }

    pushCurrent();

    return tokens
}

function isRgCommand(token) {
    return /(?:^|\/)rg(?:\.exe)?$/.test(token);
}

function isShellSeparator(token) {
    return SHELL_SEPARATORS.has(token);
}

function commandOperands(tokens, startIndex, endIndex) {
    const operands = [];

    for (let i = startIndex; i < endIndex; i++) {
        const token = tokens[i];

        if (!token || isShellSeparator(token)) {
            break
        }

        if (!token.startsWith('-')) {
            operands.push(token);
        }
    }

    return operands
}

function looksLikePathOperand(token) {
    return typeof token === 'string' && (
        token === '.' ||
        token === '..' ||
        token.startsWith('./') ||
        token.startsWith('../') ||
        token.startsWith('/') ||
        token.startsWith('~/') ||
        token.includes('/')
    )
}

function replacementOperandProblem(tokens, replacementIndex, endIndex) {
    if (replacementIndex >= endIndex || tokens[replacementIndex]?.startsWith('-')) {
        return 'missing-replacement';
    }

    const operands = commandOperands(tokens, replacementIndex, endIndex);

    if (operands.length < 2) {
        return 'missing-pattern';
    }

    // The common footgun is `rg -r "pattern" path/`: the path becomes ripgrep's search pattern while
    // the intended pattern becomes replacement text. Genuine replacement with a path needs three operands:
    // replacement, pattern, then the path.
    if (operands.length === 2 && looksLikePathOperand(operands[1])) {
        return 'missing-pattern';
    }

    return null
}

function segmentEnd(tokens, startIndex) {
    for (let i = startIndex; i < tokens.length; i++) {
        if (isShellSeparator(tokens[i])) {
            return i
        }
    }

    return tokens.length
}

function replaceFlagProblem(tokens, flagIndex, endIndex) {
    const flag = tokens[flagIndex];

    if (flag === '--replace') {
        return replacementOperandProblem(tokens, flagIndex + 1, endIndex);
    }

    if (flag.startsWith('--replace=')) {
        const replacement = flag.slice('--replace='.length);

        if (!replacement) {
            return 'missing-replacement';
        }

        const operands = commandOperands(tokens, flagIndex + 1, endIndex);

        if (operands.length < 1) {
            return 'missing-pattern';
        }

        if (operands.length === 1 && looksLikePathOperand(operands[0])) {
            return 'missing-pattern';
        }

        return null;
    }

    if (flag === '-r') {
        return replacementOperandProblem(tokens, flagIndex + 1, endIndex);
    }

    // `rg -rn foo` is the observed failure: ripgrep treats `n` as replacement text, not recursion.
    // Require separated `-r replacement pattern` or long `--replace replacement pattern` for genuine use.
    if (/^-.*r/.test(flag)) {
        return 'clustered-short-replace';
    }

    return null
}

/**
 * @summary Detects whether a Bash command contains an `rg` invocation whose replace flag shape is likely the
 * recursion mistake.
 * @param {String} command
 * @returns {{flag: String, reason: String}|null}
 */
export function findRgReplaceFootgun(command = '') {
    const tokens = tokenizeShellCommand(command);

    for (let i = 0; i < tokens.length; i++) {
        if (!isRgCommand(tokens[i])) {
            continue
        }

        const end = segmentEnd(tokens, i + 1);

        for (let j = i + 1; j < end; j++) {
            const reason = replaceFlagProblem(tokens, j, end);

            if (reason) {
                return {flag: tokens[j], reason}
            }
        }

        i = end;
    }

    return null
}

function parseHookPayload(raw) {
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function resolveBashCommand(hookPayload) {
    if (hookPayload?.tool_name && hookPayload.tool_name !== 'Bash') {
        return null
    }

    return typeof hookPayload?.tool_input?.command === 'string'
        ? hookPayload.tool_input.command
        : (typeof hookPayload?.command === 'string' ? hookPayload.command : null)
}

/**
 * @summary Returns the Claude hook block directive for suspicious `rg -r` shapes, or `null` to allow.
 * @param {Object} hookPayload Parsed Claude Code hook payload.
 * @returns {{decision: 'block', reason: String}|null}
 */
export function decideRgReplaceGuard(hookPayload) {
    const command = resolveBashCommand(hookPayload);

    if (!command) {
        return null
    }

    const finding = findRgReplaceFootgun(command);

    return finding ? {decision: 'block', reason: RG_REPLACE_GUARD_MESSAGE} : null
}

async function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data',  chunk => data += chunk);
        process.stdin.on('end',   ()    => resolve(data));
        process.stdin.on('error', reject);
    });
}

async function main() {
    const decision = decideRgReplaceGuard(parseHookPayload(await readStdin()));

    if (decision) {
        process.stdout.write(`${JSON.stringify(decision)}\n`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main().catch(() => {});
}

```

### Core Architecture Module: `ServiceWorker.mjs`
```
import Neo         from './src/Neo.mjs';
import * as core   from './src/core/_export.mjs';
import ServiceBase from './src/worker/ServiceBase.mjs';

/**
 * @class Neo.ServiceWorker
 * @extends Neo.worker.ServiceBase
 * @singleton
 */
class ServiceWorker extends ServiceBase {
    static config = {
        /**
         * @member {String} className='Neo.ServiceWorker'
         * @protected
         */
        className: 'Neo.ServiceWorker',
        /**
         * @member {Boolean} singleton=true
         * @protected
         */
        singleton: true,
        /**
         * @member {String} version='13.1.0'
         */
        version: '13.1.0'
    }

    /**
     * @member {String} workerId='service'
     * @protected
     */
    workerId = 'service'
}

export default Neo.setupClass(ServiceWorker);

```

### Core Architecture Module: `apps/ai/neural-link/app.mjs`
```
import Viewport from './view/Viewport.mjs';

export const onStart = () => Neo.app({
    mainView: Viewport,
    name    : 'NeuralLink'
});

```

### Core Architecture Module: `apps/ai/neural-link/view/Viewport.mjs`
```
import Button   from '../../../../src/button/Base.mjs';
import TextArea from '../../../../src/form/field/TextArea.mjs';
import Viewport from '../../../../src/container/Viewport.mjs';

/**
 * @class NeuralLink.view.Viewport
 * @extends Neo.container.Viewport
 */
class NeuralLinkViewport extends Viewport {
    static config = {
        className: 'NeuralLink.view.Viewport',
        layout: { ntype: 'vbox', align: 'stretch'},
        style : { padding: '20px' },
        items : [{
            ntype: 'component',
            flex : 'none',
            html : '<h1>Neural Link Testbed</h1><p>Open the browser console to see connection logs.</p>'
        }, {
            module   : TextArea,
            labelText: 'Logs (Placeholder)',
            height   : 300,
            reference: 'log-view'
        }, {
            module : Button,
            flex   : 'none',
            text   : 'Ping Agent',
            handler: 'up.onPing',
            style  : {marginTop: '10px'}
        }]
    }

    onPing() {
        console.log('Ping button clicked');
    }
}

export default Neo.setupClass(NeuralLinkViewport);

```

### Core Architecture Module: `apps/colors/app.mjs`
```
import Viewport from './view/Viewport.mjs';

export const onStart = () => Neo.app({
    mainView: Viewport,
    name    : 'Colors'
});

```

### Core Architecture Module: `apps/colors/childapps/widget/app.mjs`
```
import Viewport from './view/Viewport.mjs';

export const onStart = () => Neo.app({
    appThemeFolder: 'colors',
    mainView      : Viewport,
    name          : 'ColorsWidget'
});

```

### Core Architecture Module: `apps/colors/childapps/widget/view/Viewport.mjs`
```
import BaseViewport from '../../../../../src/container/Viewport.mjs';

/**
 * @class ColorsWidget.view.Viewport
 * @extends Neo.container.Viewport
 */
class Viewport extends BaseViewport {
    static config = {
        /**
         * @member {String} className='ColorsWidget.view.Viewport'
         * @protected
         */
        className: 'ColorsWidget.view.Viewport',
        /**
         * Stable id so whitebox e2e runs (Neural Link childapp-connect proof) can read the
         * viewport back through a live session without relying on generated ids.
         * @member {String} id='colors-widget-viewport'
         */
        id: 'colors-widget-viewport'
    }
}

export default Neo.setupClass(Viewport);

```

### Core Architecture Module: `apps/colors/model/Color.mjs`
```
import Model from '../../../src/data/Model.mjs';

/**
 * @class Colors.model.Color
 * @extends Neo.data.Model
 */
class Color extends Model {
    static config = {
        /**
         * @member {String} className='Colors.model.Color'
         * @protected
         */
        className: 'Colors.model.Color'
    }

    /**
     * @param {Object} config
     */
    construct(config) {
        super.construct(config);

        let startCharCode = 'A'.charCodeAt(0),
            i             = 0,
            len           = 26, // amount of chars inside the ISO basic latin alphabet
            fields        = [{
                name: 'id',
                type: 'String'
            }];

        for (; i < len; i++) {
            fields.push({
                name: 'column' + String.fromCharCode(startCharCode + i),
                type: 'String'
            })
        }

        this.fields = fields
    }
}

export default Neo.setupClass(Color);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #19332** (2026-09-30): **The build scripts' --help prints the engine's own issue tracker, not the consumer's missing one**
  *Symptoms*: ## Context  Four engine build scripts end their commander definition with the same `--help` epilogue: *"In case you have any issues, please create a ticket here:"* followed by `packageJson.bugs.url`. In every one of them `packageJson` is the **consumer's** `package.json` (loaded from `process.cwd()` / `path.resolve()`), because the scripts run inside workspaces as well as inside the engine.  - `buildScripts/build/themes.mjs:45` - `buildScripts/build/all.mjs:39` - `buildScripts/webpack/buildThreads.mjs:35` - `buildScripts/docs/seo/copy.mjs:85`  Measured by @neo-opus-vega (A2A defect-note, 2026-09-30 14:07Z): in `neo-agent-institution`, whose `package.json` has no `bugs` field, `node node_modules/neo.mjs/buildScripts/build/themes.mjs --help` throws `TypeError: Cannot read properties of undefined (reading 'url')`; the build itself (`-e dev -n`) works. Reproduced by reading the four files at `dev@d55ecce707` and both consumer manifests (the Institution: no `bugs`; the Brain: has one).  ## Problem  Two defects in one line:  1. **A crash on a help screen.** Any consumer without a `bugs` field — the Institution today, most fresh workspaces — gets a stack trace instead of help. 2. **The wrong tracker even when it works.** The epilogue was copied from the scaffolding repository, where `packageJson` *is* the tool's own manifest (the sanitizer sweep of 2025-12-02 replicated the block across the build scripts). In a consumer, the line sends the reader of an **engine** build script's help

- **Issue #19320** (2026-09-29): **The monaco-editor > dompurify override no longer holds a floor, so the npm-overrides job reds every engine PR (#19316)**
  *Symptoms*: Terminal predicate: `package.json`'s `overrides` block carries no rule that no dependent in scope can resolve below — the shared PR baseline's `npm overrides` job is green on `neomjs/neo` and every future one, because `monaco-editor` 0.57.0 declares `dompurify 3.4.15` itself and the `monaco-editor > dompurify ^3.4.13` rule no longer holds a floor.  ## Problem scope  `neomjs/neo#19316` bumped `monaco-editor` 0.56.0 → 0.57.0 (merged). In 0.56.0 the editor exact-pinned `dompurify 3.4.8`, which is why this repo carries an override forcing it up. In 0.57.0 the pin is `dompurify 3.4.15` — two patch releases above the floor the override sets.  The rule is now dead weight, and the shared baseline notices:  ``` ❌ monaco-editor > dompurify ^3.4.13 · REDUNDANT — all 1 dependent range(s) in scope    start at or above its floor. Delete the rule. check-npm-overrides: 1 of 3 override(s) no longer hold a floor. ```  `baseline / npm overrides` exits 1, so **every new PR on the engine reds** on a rule that is enforcing nothing. Reproduced on `neomjs/neo#19318` (Dependabot's lint-staged bump), job `109341762807`; @neo-opus-vega filed the same defect-note at 2026-09-28T18:17Z. The Institution already removed its copy (PR #318, `386f8c4`) — the engine is the last holder.  **Measured, on `dev@` `package.json` + `package-lock.json` (lockfileVersion 3):**  | | dev | without the rule | |---|---|---| | `monaco-editor@0.57.0` declares | `dompurify 3.4.15` | `dompurify 3.4.15` | | hoisted `node_modules/

- **Issue #19311** (2026-09-27): **A tooltip left inside its show delay stays visible**
  *Symptoms*: ## Context Found re-capturing FM's observatory goldens (neomjs/neo-agent-institution#288). After a click on a tooltip target, the pointer moved away at once, and the tooltip appeared a moment later and stayed. It happens with FM's keeper-nav icon rail, the pane's Route toggle and the skin switch. A quick pointer sweep over any tooltip target does the same for a user.  ## The Problem Two timer defects in `src/tooltip/Base.mjs`, measured with a unit arm on dev, red as noted: 1. **A leave never cancels a pending show.** `onDelegateMouseLeave` calls `hideDelayed` (400 ms) and leaves the `showDelay` (200 ms) timer armed. The show fires first, and `show()` runs `clearTimeout(['hide', 'dismiss'])`, which cancels the hide. So a target left inside 200 ms shows its tooltip, and it stays. Red: enter, then leave, then wait → one show, still mounted. 2. **Re-arming a delay leaks the earlier timer.** `addTimeout(id, …)` calls `this.clearTimeout(this[id])`, passing the timer *handle* to the class's `clearTimeout(timers)`, which expects the names `'show' | 'hide' | 'dismiss'`. It clears nothing, and the handle is overwritten. A second `showDelayed` before the first fires leaves the first unreachable, and an instant `hide()` cannot cancel it. Red: `showDelayed` twice, then `hide()` → one show later.  ## The Architectural Reality - `src/tooltip/Base.mjs`: `addTimeout` (:89), `clearTimeout(timers)` (:167, names only), `hide` (:279, clears all three by name), `onDelegateMouseEnter` / `onDelegate

- **Issue #19307** (2026-09-27): **The first perspective save with activate: false is always refused**
  *Symptoms*: ## Context  The Institution's `FleetPermanenceMatrixRow4NL` saves the live Fleet dock document through the real writer with `perspectiveStore.savePerspective(record, {activate: false, replace: true})` into an empty library. It has been refused since at least engine pin 9 (retained on neomjs/neo-agent-institution#10, 2026-09-14): `["activeLayoutId must name an existing layout when layouts are present"]`. The refusal reproduces on engine `2965d82` and on dev `a50ae57ce8` (neomjs/neo-agent-institution#274).  ## The Problem  `savePerspective`'s `activate` option is documented as "Point `activeLayoutId` at the saved record". Into an empty library, `activate: false` leaves `activeLayoutId: null` with one layout present. The whole-candidate validator (`PerspectiveLibrary`'s collection check) refuses exactly that state, so the option can never succeed on the first save. The caller gets `saved: false` and an error that names an invariant it could not have satisfied. Every product caller today activates (the Institution's `CockpitPerspectives` and cockpit controller, the engine's `DockService`), so the defect is latent. `PerspectiveLibrary.spec` only uses `activate: false` after an activating first save.  ## The Architectural Reality  `src/dashboard/dock/persistence/PerspectiveLibrary.mjs#savePerspective` already resolves one dangling pointer: a replaced active holder hands its activeness to the replacement, "rather than leaving the pointer dangling (the whole-candidate validator would

- **Issue #19305** (2026-09-27): **A press overtakes its coalesced mousemove, so a click orbits GraphScene**
  *Symptoms*: ## Context  Found while wiring click selection into the Institution's Observatory (neomjs/neo-agent-institution#271, PR neomjs/neo-agent-institution#272), whose renderer extends `Neo.canvas.GraphScene`. An NL arm that clicked a node after an orbit and a zoom selected nothing. The node had been orbited away at the press.  Probe (Institution NL harness, engine `a50ae57ce8`): the pointer rests at A for 200 ms, then `page.mouse.click(B)` jumps 400 px right and 200 px down and presses within one frame. The camera went from `{yaw: 0.7, pitch: 0.32, touched: false}` to `{yaw: 3.1, pitch: 1.45, touched: true}`: 400 px × `orbitSpeed` 0.006 = 2.4 rad of yaw, and pitch clamped at 1.45. One click rotated the scene by 2.4 rad.  ## The Problem  `src/main/DomEvents.mjs` coalesces `mousemove` into the next animation frame. `onMouseMove` stores `lastMouseMoveData` and schedules `flushMouseMove` with `requestAnimationFrame`, the #8654 perf change. `onMouseDown`, `onMouseUp`, `onClick`, `onWheel` and `onMouseLeave` send at once. A move and a press inside one frame therefore reach the App worker as press-then-move.  `Neo.canvas.Base#updateMouseState` derives `dx`/`dy` from the last reported position. The press report carries the whole unreported jump with `buttons: 1`, and `GraphScene#updateMouseState` orbits on exactly that combination. The late move lands afterwards. The same ordering hands a canvas a move after its `leave`, which re-arms a pointer that has left. Real hands hit this with a fas

- **Issue #19303** (2026-09-27): **Drag start throws when the pressed node is replaced during the start delay**
  *Symptoms*: ## Context  This came out of #19288's red arm, `WorkstationDragAffordancesNL` › "the ordinary body-mounted tab proxy has a theme-owned surface in both modes", which fails under the 1920×1080 headless screen. The second (light) pass presses the Audit tab header and moves 17 px. On failing runs: - the main-thread Mouse sensor holds `currentElement: neo-tab-header-button-17, dragging: true`; - `Neo.main.addon.DragDrop` holds `dragZoneId: null, dragElementRootId: null`; - the App's tab SortZone never logs an `onDragStart`, and no proxy appears; - the page throws `event.target.getBoundingClientRect is not a function at DragDrop.onDragStart (DragDrop.mjs:654)`. The stack runs `Mouse.startDrag` ← `onDistanceChange` ← the start-delay timeout (`Mouse.mjs:179`).  The same arm passes when a settle separates the preceding theme switch from the press. Measured on the #19288 branch, 2026-09-26, with App-worker logs read back through Neural Link.  ## The Problem  `sensor/Base#trigger` dispatches a sensor event on `document` when the pressed node is no longer connected. Its JSDoc explains why: a gesture's own side effects can remove or replace the source node, and a detached node swallows the event. It also states the contract: *consumers read `event.detail`, never the dispatch target*. That fallback came with `#15282`.  `DragDrop#onDragStart` still reads the dispatch target: - `event.target.getBoundingClientRect()`: `document` has no such method, so the handler throws before it resolves the

- **Issue #19300** (2026-09-26): **Escape does not cancel a drag once it has crossed into another window**
  *Symptoms*: ## Context  **Operator's hand run, 2026-09-26** (with #19278): dragging a tab inside the main window and pressing Esc recovers the previous state. It does not when the popup proxy (a converted vessel) is active, or when the tab proxy stands inside a different window.  ## The Problem  The cancel itself already works across windows. `DragCoordinator#onDragCancel` leaves the remote target, resets the vessel conversion (`sourceSortZone.resetVesselConversion`) and clears the native-window drop candidates.  What fails is delivery. Escape is heard only by the main-thread `DragDrop` addon of the window where the gesture started: - `onKeyDown` fires only when `event.key === 'Escape' && me.dragZoneId`. - `dragZoneId` is set in that window's own `onDragStart`.  During a converted or cross-window drag, the keyboard focus is in another window, the vessel or the target popup. Its `DragDrop` has no `dragZoneId`, so Escape is dropped.  ## The Architectural Reality  - `src/main/addon/DragDrop.mjs`: `onKeyDown` (a global capture listener, `addGlobalEventListeners`) holds the Escape guard. It sets `dragCancelled`, cancels a resize, and sends one `drag:cancel` carrying the zone id. Its remote API (`remote.app`) has no cancel entry. - `src/manager/DomEvent.mjs`: routes a `drag:cancel` to `Neo.get(data.dragZoneId).onDragCancel`, and ignores one without a zone. `fire()` receives the worker message; its `windowId` rides on the message (`worker.Manager#sendMessage`), not in `data`. - `src/manager/Dra

- **Issue #19298** (2026-09-26): **The cross-window tab-header proxy clones the hidden tab, so its label never shows**
  *Symptoms*: ## Context  **Operator's hand run, 2026-09-26** (#19278 AC-5): a tab dragged into a vessel over another popup. The target shows the tab-header proxy, "but the label text inside of it is missing or styled in a way that I can not see it".  **Measured headless**, at #19289's head `ca8cc98195`, 1920×1080 screen, `WorkstationHumanPopupOverlapNL` "large-over-small: one local proxy plus readable target choices", with a DOM probe on the target proxy: - The proxy root is skinned as designed: `neo-tab-header-toolbar … neo-dock-dragproxy neo-theme-neo-dark workstation-vessel-dragproxy neo-dragproxy`, a direct child of `body`, ground `rgb(20, 26, 35)`, `--tab-button-text-color: #d6dce6`. - The label is "Audit", white, opacity 1, 12 px, but its computed `visibility` is `hidden`. - The cloned button carries the inline style `visibility: hidden`.  ## The Problem  `DragZone#getDragProxyVdom` clones the drag element as it is at call time. The in-window proxy calls it at drag start. Then `SortZone` hides the dragged item in place (`itemStyle.visibility = 'hidden'`). The target proxy of #19248 / #19254 calls it later, during the cross-window move, and copies that hidden style.  The JSDoc already states the intended contract: "A cross-window target proxy renders the same content as the local one." The code breaks it, because its source is the live element.  ## The Architectural Reality  - `src/draggable/DragZone.mjs`: `createDragProxy` builds the local proxy from `getDragProxyVdom()` inside `dra

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

### Incident Patch 1: `83e0c2fc` (2026-09-30)
**Commit Message**: fix(build): the scripts' --help prints the engine's own issue tracker (#19332) (#19333)

**File**: `buildScripts/build/all.mjs` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ program
     .allowUnknownOption()
     .on('--help', () => {
         console.log('\nIn case you have any issues, please create a ticket here:');
-        console.log(chalk.cyan(packageJson.bugs.url));
+        console.log(chalk.cyan(requireJson(path.resolve(neoPath, 'package.json')).bugs.url));
     })
     .parse(process.argv);
 
```

**File**: `buildScripts/build/themes.mjs` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ program
     .allowUnknownOption()
     .on('--help', () => {
         console.log('\nIn case you have any issues, please create a ticket here:');
-        console.log(chalk.cyan(packageJson.bugs.url));
+        console.log(chalk.cyan(requireJson(path.resolve(neoPath, 'package.json')).bugs.url));
     })
     .parse(process.argv);
 
```

**File**: `buildScripts/docs/seo/copy.mjs` (modified, +2/-1)
```diff
@@ -9,6 +9,7 @@ const
     cwd         = process.cwd(),
     requireJson = path => JSON.parse(fs.readFileSync((path))),
     packageJson = requireJson(path.join(__dirname, 'package.json')),
+    neoPath     = path.resolve(packageJson.name.includes('neo.mjs') ? './' : './node_modules/neo.mjs/'),
     program     = new Command(),
     programName = `${packageJson.name} copySeoFiles`,
     APP_DIR     = path.resolve(cwd, 'apps'),
@@ -82,7 +83,7 @@ program
     .allowUnknownOption()
     .on('--help', () => {
         console.log('\nIn case you have any issues, please create a ticket here:');
-        console.log(chalk.cyan(packageJson.bugs.url));
+        console.log(chalk.cyan(requireJson(path.resolve(neoPath, 'package.json')).bugs.url));
     })
     .parse(process.argv);
 
```

**File**: `buildScripts/webpack/buildThreads.mjs` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ program
     .allowUnknownOption()
     .on('--help', () => {
         console.log('\nIn case you have any issues, please create a ticket here:');
-        console.log(chalk.cyan(packageJson.bugs.url));
+        console.log(chalk.cyan(requireJson(path.resolve(neoPath, 'package.json')).bugs.url));
     })
     .parse(process.argv);
 
```

---

### Incident Patch 2: `067f9fb9` (2026-09-27)
**Commit Message**: fix(markdown): preserve ordered-list start numbers (#13018) (#19313)

**File**: `src/component/markdown/Parser.mjs` (modified, +9/-2)
```diff
@@ -61,7 +61,7 @@ const
     REGEX_BREAK      = /^[ \t]*([-_*])[ \t]*(?:\1[ \t]*){2,}$/,
     REGEX_FENCE_OPEN = /^(`{3,}|~{3,})[ \t]*([\w-]*)[ \t]*$/,
     REGEX_HEADING    = /^(#{1,6})[ \t]+(.*)$/,
-    REGEX_OL_ITEM    = /^[ \t]{0,3}\d{1,9}[.)][ \t]+(.*)$/,
+    REGEX_OL_ITEM    = /^[ \t]{0,3}(\d{1,9})[.)][ \t]+(.*)$/,
     REGEX_QUOTE      = /^[ \t]{0,3}>[ \t]?(.*)$/,
     REGEX_UL_ITEM    = /^[ \t]{0,3}[-*+][ \t]+(.*)$/;
 
@@ -278,6 +278,7 @@ export default class MarkdownParser {
                 vdom = {
                     tag: raw.ordered ? 'ol' : 'ul',
                     id,
+                    ...(raw.ordered && raw.start !== undefined ? {start: String(raw.start)} : {}),
                     cn : raw.items.map(item => ({
                         tag: 'li',
                         id : childId(),
@@ -469,13 +470,18 @@ export default class MarkdownParser {
                     itemRe  = ordered ? REGEX_OL_ITEM : REGEX_UL_ITEM,
                     start   = index,
                     items   = [];
+                let startNumber = 1;
 
                 while (index < lines.length) {
                     const current = lines[index],
                           item    = current.match(itemRe);
 
                     if (item) {
-                        items.push(item[1].trim())
+                        if (ordered && items.length === 0) {
+                            startNumber = Number(item[1])
+                        }
+
+                        items.push(item[ordered ? 2 : 1].trim())
                     } else if (items.length > 0 && !this.#opensBlock(current)) {
                         // Soft-wrapped continuation of the previous item.
                         items[items.length - 1] += ' ' + current.trim()
@@ -490,6 +496,7 @@ export default class MarkdownParser {
                     type  : BLOCK_TYPES.list,
                     items,
                     ordered,
+                    ...(ordered && startNumber !== 1 ? {start: startNumber} : {}),
                     open  : index >= lines.length,
                     source: lines.slice(start, index).join('\n')
                 });
```

**File**: `test/playwright/unit/component/markdown/Parser.spec.mjs` (modified, +15/-0)
```diff
@@ -227,6 +227,21 @@ test.describe('MarkdownParser — extended block grammar', () => {
         expect(blocks[1].cn.map(item => item.tag)).toEqual(['li', 'li'])
     });
 
+    test('preserves ordered-list starts across separated producer ranks, including zero, without changing normal or unordered lists', () => {
+        const parser = new MarkdownParser({idPrefix: 'list-start'}),
+              blocks = parser.update('1. first\n2. second\n\n2. restarted rank\n\n0. zero rank\n\n- unordered\n\n');
+
+        expect(blocks.map(block => block.tag)).toEqual(['ol', 'ol', 'ol', 'ul']);
+        expect(blocks[0].start).toBeUndefined();
+        expect(blocks[0].cn).toHaveLength(2);
+        expect(blocks[1].start).toBe('2');
+        expect(blocks[2].start).toBe('0');
+        expect(blocks[3].start).toBeUndefined();
+        expect(textOf([blocks[1].cn[0]])).toBe('restarted rank');
+        expect(textOf([blocks[2].cn[0]])).toBe('zero rank');
+        expect(textOf([blocks[3].cn[0]])).toBe('unordered')
+    });
+
     test('a marker-type switch splits into two list blocks', () => {
         const parser = new MarkdownParser({idPrefix: 'split'});
 
```

---

### Incident Patch 3: `c300181b` (2026-09-27)
**Commit Message**: fix(tooltip): a leave cancels the pending show, and a re-armed delay replaces its timer (#19311) (#19312)

A target left inside the show delay kept its show armed; the show fired after
the leave and its clearTimeout(['hide', 'dismiss']) cancelled the hide, so
the tooltip stuck. addTimeout passed the timer handle to the name-keyed
clearTimeout, which cleared nothing, so a delay armed twice leaked the
earlier timer past any hide. The leave now clears the pending show, and
addTimeout clears its predecessor by name.

**File**: `src/tooltip/Base.mjs` (modified, +6/-5)
```diff
@@ -82,15 +82,14 @@ class Tooltip extends Container {
     }
 
     /**
-     * @param {String} id
+     * Arms one of the named delays, replacing a pending timer of the same name.
+     * @param {String} id valid values: dismiss, hide, show
      * @param {Function} callback
      * @param {Number} delay
      */
     addTimeout(id, callback, delay) {
-        id += 'DelayTaskId';
-
-        this.clearTimeout(this[id]);
-        this[id] = setTimeout(callback, delay)
+        this.clearTimeout(id);
+        this[id + 'DelayTaskId'] = setTimeout(callback, delay)
     }
 
     /**
@@ -343,6 +342,8 @@ class Tooltip extends Container {
             });
 
             me.activeTarget = null;
+            // a show still pending would fire after the leave and cancel the hide
+            me.clearTimeout('show');
             me.hideDelayed(data)
         }
     }
```

**File**: `test/playwright/unit/tooltip/DelayTimers.spec.mjs` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+import {setup} from '../../setup.mjs';
+
+setup({
+    neoConfig: {
+        allowVdomUpdatesInTests: true,
+        useDomApiRenderer      : true
+    },
+    appConfig: {
+        name: 'TooltipDelayTimersTest'
+    }
+});
+
+import {test, expect} from '@playwright/test';
+import Neo            from '../../../../src/Neo.mjs';
+import * as core      from '../../../../src/core/_export.mjs';
+// the spec stands in for the thread entrypoint, which imports the instance manager Neo.get resolves through
+import                     '../../../../src/manager/Instance.mjs';
+import Tooltip        from '../../../../src/tooltip/Base.mjs';
+
+/**
+ * @summary The tooltip's delay timers through the class's own methods, on a prototype host whose own data
+ * properties shadow the reactive configs: a mount records a show, an unmount a hide. Real timers at short
+ * delays, so a pending timer fires exactly as it would under a pointer.
+ * @returns {{host: Object, shows: Number[]}}
+ */
+function makeHost() {
+    const host = Object.create(Tooltip.prototype), shows = [];
+
+    Object.entries({
+        activeTarget      : null,
+        align             : {},
+        dismissDelay      : null,
+        dismissDelayTaskId: null,
+        fire              : () => {},
+        hideDelay         : 40,
+        hideDelayTaskId   : null,
+        initVnode         : () => { host.mounted = true; shows.push(Date.now()) },
+        mounted           : false,
+        showDelay         : 20,
+        showDelayTaskId   : null,
+        unmount           : () => { host.mounted = false }
+    }).forEach(([key, value]) => Object.defineProperty(host, key, {configurable: true, enumerable: true, value, writable: true}));
+
+    return {host, shows}
+}
+
+const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
+
+test.describe('Neo.tooltip.Base — the show and hide delays', () => {
+    test('a target left inside the show delay never shows the tooltip', async () => {
+        const {host, shows} = makeHost();
+
+        host.onDelegateMouseEnter({currentTarget: 'target-1'});
+        // Neo.get answers the hovered component; the host has none registered
+        host.activeTarget = {id: 'target-1'};
+        host.onDelegateMouseLeave({currentTarget: 'target-1'});
+
+        await wait(120);
+
+        expect(shows, 'the pending show was cancelled by the leave').toHaveLength(0);
+        expect(host.mounted).toBe(false)
+    });
+
+    test('a target held past the show delay shows the tooltip, and leaving hides it after the hide delay', async () => {
+        const {host, shows} = makeHost();
+
+        host.onDelegateMouseEnter({currentTarget: 'target-1'});
+        host.activeTarget = {id: 'target-1'};
+
+        await wait(60);
+        expect(shows).toHaveLength(1);
+
+        host.onDelegateMouseLeave({currentTarget: 'target-1'});
+        expect(host.mounted, 'the hide waits its delay').toBe(true);
+
+        await wait(100);
+        expect(host.mounted).toBe(false)
+    });
+
+    test('a delay armed twice keeps one timer: an instant hide cancels it, and nothing shows later', async () => {
+        const {host, shows} = makeHost();
+
+        host.showDelayed({});
+        host.showDelayed({});
+        host.hide();
+
+        await wait(120);
+
+        expect(shows).toHaveLength(0)
+    });
+});
```

---

### Incident Patch 4: `942b43c8` (2026-09-27)
**Commit Message**: fix(main): every other mouse event sends a move still waiting for its frame first (#19305) (#19306)

* fix(main): every other mouse event sends a move still waiting for its frame first (#19305)

DomEvents coalesces mousemove into the next animation frame but sent presses, releases, clicks, wheels and enter/leave at once. A press that followed a jump in the same frame therefore reached the app worker as press-then-move. The canvas mouse state read the whole jump as a held button's movement, so a click orbited a GraphScene camera by 2.4 rad in the probe. flushPendingMouseMove sends the waiting move first; moves alone still send once per frame.

* fix(main): a wheel the main thread keeps leaves the waiting move to its frame (#19305)

**File**: `src/main/DomEvents.mjs` (modified, +24/-0)
```diff
@@ -478,6 +478,7 @@ class DomEvents extends Base {
     onClick(event) {
         let me = this;
 
+        me.flushPendingMouseMove();
         me.sendMessageToApp(me.getMouseEventData(event));
 
         me.testPathInclusion(event, preventClickTargets) && event.preventDefault()
@@ -489,6 +490,7 @@ class DomEvents extends Base {
     onContextMenu(event) {
         let me = this;
 
+        me.flushPendingMouseMove();
         me.sendMessageToApp(me.getMouseEventData(event));
 
         if (event.ctrlKey || me.testPathInclusion(event, preventContextmenuTargets)) {
@@ -510,6 +512,7 @@ class DomEvents extends Base {
     onDoubleClick(event) {
         let me = this;
 
+        me.flushPendingMouseMove();
         me.sendMessageToApp(me.getMouseEventData(event));
 
         me.testPathInclusion(event, preventClickTargets) && event.preventDefault()
@@ -675,6 +678,7 @@ class DomEvents extends Base {
      * @param {MouseEvent} event
      */
     onMouseDown(event) {
+        this.flushPendingMouseMove();
         this.sendMessageToApp(this.getMouseEventData(event))
     }
 
@@ -685,6 +689,7 @@ class DomEvents extends Base {
         let me       = this,
             appEvent = {...me.getMouseEventData(event), fromElementId: event.fromElement?.id || null, toElementId: event.toElement?.id || null};
 
+        me.flushPendingMouseMove();
         me.sendMessageToApp(appEvent);
         me.fire('mouseEnter', appEvent)
     }
@@ -696,6 +701,7 @@ class DomEvents extends Base {
         let me       = this,
             appEvent = {...me.getMouseEventData(event), fromElementId: event.fromElement?.id || null, toElementId: event.toElement?.id || null};
 
+        me.flushPendingMouseMove();
         me.sendMessageToApp(appEvent);
         me.fire('mouseLeave', appEvent)
     }
@@ -727,10 +733,27 @@ class DomEvents extends Base {
         me.mouseMoveReqId = null
     }
 
+    /**
+     * Sends a coalesced move that is still waiting for its frame, ahead of the mouse event that calls this. Without
+     * it a press overtakes the move and reaches the app worker as press-then-move, so a consumer deriving movement
+     * from the last reported position (a canvas's mouse state) reads the whole jump as a held button's movement.
+     * Call it only on the path that sends: an event the main thread keeps has no order to restore, and flushing for
+     * it would spend the frame's one move.
+     */
+    flushPendingMouseMove() {
+        let me = this;
+
+        if (me.mouseMoveReqId) {
+            cancelAnimationFrame(me.mouseMoveReqId);
+            me.flushMouseMove()
+        }
+    }
+
     /**
      * @param {MouseEvent} event
      */
     onMouseUp(event) {
+        this.flushPendingMouseMove();
         this.sendMessageToApp(this.getMouseEventData(event))
     }
 
@@ -862,6 +885,7 @@ class DomEvents extends Base {
                 // the deltas and the target's scroll geometry ride beside them.
                 let {deltaMode, deltaX, deltaY, deltaZ} = event;
 
+                this.flushPendingMouseMove();
                 this.sendMessageToApp({
                     ...this.getMouseEventData(event),
                     clientHeight: target.node.clientHeight,
```

**File**: `test/playwright/unit/main/DomEvents.spec.mjs` (modified, +96/-0)
```diff
@@ -149,6 +149,102 @@ test.describe('Neo.main.DomEvents', () => {
               ...extra
           });
 
+    // A move waits for the next frame; a press is sent at once. A press that overtakes the move reaches the app as
+    // press-then-move, and the canvas mouse state reads the whole jump as movement of a held button.
+    test('every other mouse event sends a move still waiting for its frame first; moves alone still send once per frame', () => {
+        const
+            sent     = [],
+            frames   = [],
+            rafWas   = globalThis.requestAnimationFrame,
+            cafWas   = globalThis.cancelAnimationFrame,
+            mouse    = (type, clientX, extra) => ({
+                altKey: false, button: 0, buttons: 0, clientX, clientY: 70, composedPath: () => [node, documentRef.body],
+                ctrlKey: false, metaKey: false, preventDefault: () => {}, shiftKey: false, stopPropagation: () => {}, type, ...extra
+            }),
+            // one move to 200 still waiting for its frame, then the other event
+            overtake = (send, type) => {
+                DomEvents.onMouseMove(mouse('mousemove', 200));
+                send(mouse(type, 200, {buttons: type === 'mousedown' ? 1 : 0}))
+            };
+
+        globalThis.requestAnimationFrame = fn => frames.push(fn);
+        globalThis.cancelAnimationFrame  = id => { frames[id - 1] = null };
+
+        try {
+            DomEvents.getEventData     = ({type}) => ({type});
+            DomEvents.sendMessageToApp = data => sent.push(data.type);
+
+            overtake(event => DomEvents.onMouseDown(event),   'mousedown');
+            overtake(event => DomEvents.onMouseUp(event),     'mouseup');
+            overtake(event => DomEvents.onClick(event),       'click');
+            overtake(event => DomEvents.onDoubleClick(event), 'dblclick');
+            overtake(event => DomEvents.onContextMenu(event), 'contextmenu');
+            overtake(event => DomEvents.onMouseEnter(event),  'mouseenter');
+            overtake(event => DomEvents.onMouseLeave(event),  'mouseleave');
+            overtake(event => DomEvents.onWheel(wheelOn(node, {clientX: 200})), 'wheel');
+
+            expect(sent).toEqual(['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'mouseenter', 'mouseleave', 'wheel'].flatMap(type => ['mousemove', type]));
+            frames.forEach(frame => frame?.());
+            expect(sent, 'a flushed move leaves nothing for its frame').toHaveLength(16);
+
+            sent.length = 0;
+            DomEvents.onMouseMove(mouse('mousemove', 10));
+            DomEvents.onMouseMove(mouse('mousemove', 20));
+            frames.at(-1)();
+
+            expect(sent, 'two moves in one frame send once').toEqual(['mousemove']);
+            expect(DomEvents.mouseMoveReqId).toBeNull()
+        } finally {
+            globalThis.requestAnimationFrame = rafWas;
+            globalThis.cancelAnimationFrame  = cafWas
+        }
+    });
+
+    // A wheel the main thread keeps never reaches the app, so there is no order to restore: the waiting move keeps
+    // its frame, and the next move in that frame replaces it.
+    test('a wheel the main thread keeps leaves a waiting move to its frame', () => {
+        const
+            sent          = [],
+            frames        = [],
+            rafWas        = globalThis.requestAnimationFrame,
+            cafWas        = globalThis.cancelAnimationFrame,
+            dateSelector  = {...node, classList: {contains: cls => cls === 'neo-dateselector'}},
+            bufferedWheel = () => DomEvents.onWheel(wheelOn(dateSelector, {composedPath: () => [dateSelector, documentRef.body]})),
+            move          = clientX => DomEvents.onMouseMove({
+                altKey: false, button: 0, buttons: 0, clientX, clientY: 70, composedPath: () => [node, documentRef.body],
+                ctrlKey: false, metaKey: false, preventDefault: () => {}, shiftKey: false, stopPropagation: () => {}, type: 'mous
```

---

### Incident Patch 5: `ed5aac1b` (2026-09-27)
**Commit Message**: fix(main): a drag start reads the press from the sensor when a re-render replaced its node (#19303) (#19304)

sensor.Base#trigger dispatches on document once the pressed node is no longer
connected; its contract is that consumers read event.detail. DragDrop's
onDragStart still read event.target.getBoundingClientRect() and the dispatch
path, so a tab header re-rendered inside the 100 ms start delay made the start
throw: no zone was resolved, drag:start never reached the App, and the sensor
went on dragging a gesture nobody owned.

resolveSensorPath takes the press's own path from detail when the dispatch
path begins at document, with each replaced node answering through the
connected node carrying its id, so the App sizes its proxy from live geometry.
resolvePressedElement measures that successor for the main-thread offsets. A
connected press keeps the dispatch target and its live ancestors, as before.

**File**: `buildScripts/util/file-size-baseline.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
     "examples/dashboard/crossWindow/DemoBWorkspace.mjs": 2503,
     "src/dashboard/dock/Workspace.mjs": 1170,
-    "src/main/addon/DragDrop.mjs": 1276
+    "src/main/addon/DragDrop.mjs": 1294
 }
```

**File**: `src/main/addon/DragDrop.mjs` (modified, +47/-3)
```diff
@@ -314,7 +314,7 @@ class DragDrop extends Base {
      * @returns {Object}
      */
     getEventData(event) {
-        let path   = event.path || event.composedPath(),
+        let path   = this.resolveSensorPath(event),
             detail = event.detail,
 
         e = {
@@ -674,8 +674,8 @@ class DragDrop extends Base {
      */
     onDragStart(event) {
         let me   = this,
-            path = event.path || event.composedPath(),
-            rect = event.target.getBoundingClientRect();
+            path = me.resolveSensorPath(event),
+            rect = me.resolvePressedElement(event).getBoundingClientRect();
 
         // Resolve the owning zone synchronously from the event path against the zone registry.
         // Zones register eagerly at construction (registerZone) and re-register on every
@@ -887,6 +887,50 @@ class DragDrop extends Base {
         return null
     }
 
+    /**
+     * @summary The element a sensor gesture pressed, for measuring it.
+     *
+     * `sensor.Base#trigger` dispatches on `document` once the pressed node is no longer connected,
+     * so `document` as the target means a re-render replaced that node. The connected node with its
+     * id is the replacement; without one, the detached node still answers (a zero rect).
+     * @param {Event} event A sensor event.
+     * @returns {HTMLElement}
+     * @protected
+     */
+    resolvePressedElement(event) {
+        const
+            {detail, target} = event,
+            doc              = globalThis.document;
+
+        if (target !== doc || !detail?.element) {
+            return target
+        }
+
+        return (detail.element.id && doc.getElementById(detail.element.id)) || detail.element
+    }
+
+    /**
+     * @summary The DOM path a sensor event describes: the dispatch path, or, when the dispatch fell
+     * back to `document` because the pressed node was replaced, the press's own path from `detail`.
+     * A `document` dispatch path names no element, so the zone and the App's listeners could not
+     * resolve from it. In the press's path, a node a re-render replaced answers through the
+     * connected node with its id, so the App measures live geometry, not a detached node's zeros.
+     * @param {Event} event A sensor event.
+     * @returns {Array<EventTarget>}
+     * @protected
+     */
+    resolveSensorPath(event) {
+        const
+            doc  = globalThis.document,
+            path = event.path || event.composedPath();
+
+        if (path[0] !== doc || !event.detail?.path) {
+            return path
+        }
+
+        return event.detail.path.map(node => (node?.isConnected === false && node.id && doc.getElementById(node.id)) || node)
+    }
+
     /**
      * Removes a zone's registration(s). Both shapes run (never either/or): the keyed delete by
      * root id AND the sweep of every key pointing at the zone id — a wrong or stale root key
```

**File**: `test/playwright/unit/main/addon/DragDrop.spec.mjs` (modified, +103/-3)
```diff
@@ -1391,6 +1391,8 @@ test.describe('Neo.main.addon.DragDrop — main-thread resize preview', () => {
             getEventData          : () => ({}),
             isWindowDragging      : false,
             resolveDragZoneId     : () => 'splitter-zone',
+            resolvePressedElement : DragDrop.prototype.resolvePressedElement,
+            resolveSensorPath     : DragDrop.prototype.resolveSensorPath,
             scrollContainerElement: null
         };
 
@@ -1458,9 +1460,11 @@ test.describe('Neo.main.addon.DragDrop — main-thread resize preview', () => {
                     starts = [],
                     target = {getBoundingClientRect: () => ({height: 6, left: 0, top: 0, width: 6})},
                     addon  = {
-                        dragResize       : {start: (...args) => starts.push(args)},
-                        getEventData     : () => ({}),
-                        resolveDragZoneId: () => 'splitter-zone'
+                        dragResize           : {start: (...args) => starts.push(args)},
+                        getEventData         : () => ({}),
+                        resolveDragZoneId    : () => 'splitter-zone',
+                        resolvePressedElement: DragDrop.prototype.resolvePressedElement,
+                        resolveSensorPath    : DragDrop.prototype.resolveSensorPath
                     };
 
                 dockFlip === undefined
@@ -1909,5 +1913,101 @@ test.describe('Neo.main.addon.DragDrop — Escape across windows', () => {
         expect(owner.dragCancelled).toBe(true);
         expect(resizeCancels).toBe(1);
         expect(idle.dragCancelled).toBe(false)
+    })
+});
+
+/**
+ * @summary A re-render can replace the pressed node inside the sensor's start delay; the sensor then
+ * dispatches `drag:start` on `document`, and the addon must read the press from `detail`.
+ */
+test.describe('Neo.main.addon.DragDrop — a drag start whose pressed node a re-render replaced', () => {
+    const
+        rectOf  = (left, top, width, height) => () => ({height, left, top, width}),
+        toolbar = {id: 'neo-tab-header-toolbar-4'},
+        createAddon = () => ({
+            dragResize           : null,
+            getEventData         : DragDrop.prototype.getEventData,
+            resolveDragZoneId    : DragDrop.prototype.resolveDragZoneId,
+            resolvePressedElement: DragDrop.prototype.resolvePressedElement,
+            resolveSensorPath    : DragDrop.prototype.resolveSensorPath,
+            zoneRegistrations    : {'neo-tab-header-toolbar-4': 'neo-dock-tab-sortzone-4'}
+        }),
+        start = (addon, event) => {
+            const
+                sent         = [],
+                activeDoc    = globalThis.document,
+                originalSend = DomEvents.sendMessageToApp;
+
+            globalThis.document        = documentRef;
+            DomEvents.sendMessageToApp = data => sent.push(data);
+
+            try {
+                DragDrop.prototype.onDragStart.call(addon, event)
+            } finally {
+                globalThis.document        = activeDoc;
+                DomEvents.sendMessageToApp = originalSend
+            }
+
+            return sent
+        };
+
+    test('dispatched from document, it measures the replacement node and resolves the zone from the press path', () => {
+        const
+            pressed     = {getBoundingClientRect: rectOf(0, 0, 0, 0), id: 'neo-tab-header-button-17', isConnected: false},
+            replacement = {getBoundingClientRect: rectOf(1100, 121, 48, 32), id: 'neo-tab-header-button-17', isConnected: true},
+            addon       = createAddon();
+
+        documentRef.getElementById = id => id === replacement.id ? replacement : null;
+
+        let sent;
+
+        try {
+            sent = start(addon, {
+                composedPath: () => [documentRef, windowRef],
+                detail      : {
+                    clientX      : 1112,
+                    clientY      : 131,
+                    element
```

---

### Incident Patch 6: `9fcc3668` (2026-09-27)
**Commit Message**: fix(dock): the converting vessel parks clear of the target, which shows its zones before the park (#19278) (#19289)

* fix(dock): a converting vessel parks clear of the target popup, not behind it (#19278)

Under a real OS mouse drag `focus()` raises nothing, so a vessel parked behind the target stayed on
top of it and covered its drop zones and the target-side proxy. The pointer park now shrinks as
before, then moves the vessel to the corner of the target display's work area that covers the
target least (`NativeVesselTransaction.resolveClearPark`), and focuses nothing; the receipt reports
`cleared`. The native-titlebar park runs after the OS released the drag, where focus is granted, and
keeps its focus chain.

* fix(dock): the target shows its drop zones before the park admits (#19278)

While the park was pending or refused, a transition-owned frame reached no target, so the hand saw
no zones until the vessel parked. The source now marks a standing claim it has not converted yet
with `preview: true`, and the coordinator sends that frame with `embodyProxy: false` and without
commit eligibility, so the target renders its zones from the claim and a drop on it commits nothing.
ADR 00

**File**: `apps/workstation/view/VesselWorkspace.mjs` (modified, +55/-50)
```diff
@@ -1264,17 +1264,22 @@ class VesselWorkspace extends DockWorkspace {
     }
 
     /**
-     * Parks one converted vessel behind its conversion target — the cover geometry that keeps
-     * the REAL OS window alive while the proxy embodies over the target. Close-and-reopen is a
-     * one-way door (mid-gesture popup acquisition reads as unsolicited), so conversion parks
-     * instead: the same exact generation re-shows on out-conversion or restore. The focus /
-     * resize / move / refocus chain is the platform-law choreography (z-order hides the parked
-     * vessel). A source whose outer frame cannot fit behind the target first shrinks through its
-     * exact native route; a refocus refusal compensates to the original extent and source rect.
-     * On the native-titlebar path to the MAIN window nothing is parked at all — the hold is the
-     * gesture: the transfer lands when the dwell completes and the popup retires right after, so the
-     * park answers satisfied with no platform effect (the platform never grants a popup an opener
-     * focus without a user activation, and an OS titlebar drag carries none).
+     * Parks one converted vessel out of its conversion target's way, which keeps the REAL OS window
+     * alive while the target embodies the drag. Close-and-reopen is a one-way door (mid-gesture popup
+     * acquisition reads as unsolicited), so conversion parks instead: the same exact generation
+     * re-shows on out-conversion or restore.
+     *
+     * The pointer path parks CLEAR of the target: a source whose outer frame exceeds the
+     * target first shrinks through its exact native route, then moves to the corner of the target
+     * display's work area that covers the target least ({@link NativeVesselTransaction.resolveClearPark}).
+     * Nothing is focused: under a real OS mouse drag `focus()` raises nothing, which left the vessel on
+     * top of the target's zones. The native-titlebar path parks only after the OS released the drag,
+     * where focus is granted, so it keeps the focus / move / refocus chain that hides the vessel
+     * behind the target; a refocus refusal compensates to the source rect. On that path to the MAIN
+     * window nothing is parked at all — the hold is the gesture: the transfer lands when the dwell
+     * completes and the popup retires right after, so the park answers satisfied with no platform
+     * effect (the platform never grants a popup an opener focus without a user activation, and an OS
+     * titlebar drag carries none).
      * @param {Object} vessel
      * @param {String} vessel.itemId
      * @param {Boolean} [vessel.nativeTitlebar=false] The park follows an OS titlebar drag terminal
@@ -1292,8 +1297,8 @@ class VesselWorkspace extends DockWorkspace {
             targetIsMain = me.vesselConversionTargetWindowId === me.windowId,
             // The size check and the authority check speak published inner-window geometry (a child
             // omitting outerRect never rejects an authorized live vessel); the park POSITION is a
-            // frame: `moveTo` places the source frame on the target's frame origin, so the parked
-            // window lies behind the target's chrome and content alike.
+            // frame origin: `moveTo` places the source frame, clear of the target on the pointer path,
+            // on the target's frame origin behind it on the native-titlebar path.
             sourceRect   = sourceWindow?.innerRect,
             sourceOuter  = sourceWindow?.outerRect ?? sourceRect,
             targetRect   = targetWindow?.innerRect,
@@ -1310,10 +1315,6 @@ class VesselWorkspace extends DockWorkspace {
                 width : sourceOuter.width,
                 x     : sourceOuter.x,
                 y     : sourceOuter.y
-            } : null,
-            parkGeometry  = needsResize ? {
-                park   : {...parkSize, x: targetOuter?.x, y: targetOuter?.y},
-                restore: restoreRect
             
```

**File**: `learn/agentos/decisions/0029-docking-design.md` (modified, +34/-21)
```diff
@@ -579,44 +579,52 @@ handles by the semantic `windowName` passed to `Main.windowOpen()`. Those identi
 This is the generic multi-window Possession Interface consumed by inspection tooling. Product code still decides what a
 window *means* and which semantic transaction precedes a physical effect.
 
-#### §2.8.6 In-gesture vessel conversion and park (2026-07-19, #15396; amended 2026-07-29, #16117)
+#### §2.8.6 In-gesture vessel conversion and park (2026-07-19, #15396; amended 2026-07-29, #16117; amended 2026-09-26, #19278)
 
 Popup-to-proxy conversion is an admitted transition inside the existing outcome machine, not a new
 terminal state. A source may enter `HOVERING_CLAIM` only after its physical park effect returns strict
 `true`; leaving the claim may resume `DETACHED_MOVING` only after strict re-show admission. Promise
 dispatch is provisional authority: conversion and park owners retain their prior state until settlement,
 and a stale generation cannot mutate a successor gesture.
 
-The Workstation browser-runtime park binding is **target-cover**, behind generic exact-handle capabilities. Its
-admission reads the source's live **outer** extent and the target's live **inner** extent; creation-time dimensions
-and equal-size assumptions are not authority:
+The pointer-conversion park binding is **target-clear**, behind generic exact-handle capabilities, in the Workstation
+and in the engine's default transaction alike. Its admission reads the source's live **outer** extent and the target's
+live **inner** extent; creation-time dimensions and equal-size assumptions are not authority:
 
 1. resolve both connected generations from `manager.Window` and require opener-minted routes;
-2. require exact target focus and exact source position authority; require exact source resize authority only when the
-   source outer frame exceeds the target inner frame on either axis;
-3. focus the exact target route first;
-4. only after focus admission, pause pointer-follow, drain already-issued physical moves, preserve the source's exact
-   outer extent and origin, and — when needed — request a best-effort target-origin pre-position before resizing the
-   same exact source handle to
+2. require exact source position authority; require exact source resize authority only when the source outer frame
+   exceeds the target inner frame on either axis;
+3. read the target display's visible work area (`availLeft`, `availTop`, `availWidth`, `availHeight`) and pick the
+   **park position**: the corner of that work area whose parked frame overlaps the target's inner rect least, the
+   farthest one among equals, the whole frame inside the work area. A frame larger than the work area, or a target
+   inner rect without extent, refuses the park here, before any resize or move: no corner holds that frame whole;
+4. pause pointer-follow, drain already-issued physical moves, preserve the source's exact outer extent and origin, and —
+   when needed — resize the same exact source handle to
    `{width: min(sourceOuter.width, targetInner.width), height: min(sourceOuter.height, targetInner.height)}`;
-5. verify the target realm's observed `outerWidth` / `outerHeight`, move the exact source route to the target origin,
-   then refocus the exact target route.
-
-The order is load-bearing. A focus refusal leaves the source untouched and moving. The full-size pre-position is
-deliberately non-admitting: Chrome may clamp a frame that cannot yet fit at the requested target origin, so only the
-post-resize exact move can admit cover. A resize refusal restores the original extent before pointer-follow resumes. A
-final move refusal restores the original origin and extent. A final-refocus refusal re-shows the same source generation;
-if that compensation is itself refused, the still-parked generation remains the sole retry authority. Browser
-minimum-size clamping therefore fails closed: requested dimensions are never projected into topology truth, and a
-non-matc
```

**File**: `src/dashboard/dock/interaction/TabSortZone.mjs` (modified, +9/-2)
```diff
@@ -639,9 +639,12 @@ class TabSortZone extends TabHeaderSortZone {
      * @param {Object} frame.logicalSourceRect
      * @param {String|null} frame.targetId
      * @param {Object|null} frame.targetRect
-     * @returns {{commitEligible: Boolean, engage: Boolean, retain: Boolean,
+     * @returns {{commitEligible: Boolean, engage: Boolean, preview: (true|undefined), retain: Boolean,
      *     proxyRect: (Object|undefined)}|null}
      *     An engaged record carries the target proxy's extent ({@link #getVesselConversionProxyRect});
+     *     `preview: true` marks a pointer claim on this target that the park has not admitted yet
+     *     (pending or refused), whose frames may render the target's drop zones without an embodiment
+     *     or a commit;
      *     `null` keeps the legacy coordinator path when conversion is disabled or the source is not
      *     in a window drag.
      */
@@ -720,7 +723,10 @@ class TabSortZone extends TabHeaderSortZone {
                 targetRect
             });
 
-            return {commitEligible: false, engage: false, retain: false}
+            // a park still pending for the target the pointer claims: its zones may show before it admits
+            return pointerInTarget === true && sensor.targetConverted === true && targetId != null && targetId === me.vesselConversionTargetId
+                ? {commitEligible: false, engage: false, preview: true, retain: false}
+                : {commitEligible: false, engage: false, retain: false}
         }
 
         if (pointerInTarget === true && targetId != null && targetRect) {
@@ -773,6 +779,7 @@ class TabSortZone extends TabHeaderSortZone {
             return {
                 commitEligible: record.converted && !record.transitioning,
                 engage        : record.converted && !record.transitioning,
+                preview       : true,
                 retain        : false,
                 proxyRect     : record.converted && !record.transitioning
                     ? me.getVesselConversionProxyRect()
```

**File**: `src/dashboard/dock/window/NativeVesselTransaction.mjs` (modified, +91/-60)
```diff
@@ -1,4 +1,5 @@
 import Base          from '../../../core/Base.mjs';
+import Rectangle     from '../../../util/Rectangle.mjs';
 import WindowManager from '../../../manager/Window.mjs';
 
 /**
@@ -53,10 +54,10 @@ class NativeVesselTransaction extends Base {
      * @summary Resolves the source and target native-route admissions for one vessel.
      *
      * Both consumers reached the identical pair independently: `position` on the source (the park
-     * moves it) and `focus` on the target (the parked window hides behind it). `resize` is resolved
-     * unconditionally so the receipt can report the capability, and gated separately — reporting a
-     * capability and requiring it are different questions, and conflating them is what made one
-     * consumer's park look stricter than its own re-show.
+     * moves it) and `focus` on the target, which the park no longer uses and the receipt still
+     * reports. `resize` is resolved unconditionally so the receipt can report the capability, and
+     * gated separately — reporting a capability and requiring it are different questions, and
+     * conflating them is what made one consumer's park look stricter than its own re-show.
      * @param {Object} descriptor
      * @param {Object|null} entry The resolved vessel registry entry.
      * @param {String|null} targetWindowId
@@ -123,6 +124,54 @@ class NativeVesselTransaction extends Base {
         return {x: rect.x - (chrome?.left ?? 0), y: rect.y - (chrome?.top ?? 0)}
     }
 
+    /**
+     * @summary Where a parked vessel goes so it covers the target as little as the display allows: the
+     * corner of the target display's work area whose frame overlaps the target's content least, the
+     * farthest one among equals, with the whole frame kept inside the work area.
+     *
+     * A real OS mouse drag does not honour a `focus()` raise, so a vessel parked behind the target
+     * would stay on top of every affordance the conversion produced. Clear of the target, it needs no
+     * z-order at all.
+     * @param {Object} data
+     * @param {{height:Number,width:Number}} data.frame The parked frame's outer extent
+     * @param {Object} data.screen The target display's `availLeft`, `availTop`, `availWidth` and `availHeight`
+     * @param {{height:Number,width:Number,x:Number,y:Number}} data.target The target's content rect
+     * @returns {{cleared:Boolean,x:Number,y:Number}|null} The frame origin, and whether the frame misses the
+     * target's content; `null` when an input is not measurable, the target has no extent, or the frame is
+     * larger than the work area and cannot be placed whole
+     */
+    static resolveClearPark({frame, screen, target} = {}) {
+        const {availHeight, availLeft, availTop, availWidth} = screen ?? {};
+
+        if (
+            ![availHeight, availLeft, availTop, availWidth, frame?.height, frame?.width, target?.height, target?.width, target?.x, target?.y].every(Number.isFinite) ||
+            availHeight <= 0 || availWidth <= 0 || frame.height <= 0 || frame.width <= 0 || target.height <= 0 || target.width <= 0 ||
+            frame.height > availHeight || frame.width > availWidth
+        ) {
+            return null
+        }
+
+        const
+            content = new Rectangle(target.x, target.y, target.width, target.height),
+            right   = availLeft + availWidth  - frame.width,
+            bottom  = availTop  + availHeight - frame.height;
+
+        let best = null;
+
+        for (const [x, y] of [[availLeft, availTop], [right, availTop], [availLeft, bottom], [right, bottom]]) {
+            const
+                overlap  = Rectangle.getIntersection(new Rectangle(x, y, frame.width, frame.height), content),
+                area     = overlap ? overlap.width * overlap.height : 0,
+                distance = Math.hypot(x + frame.width / 2 - content.x - content.width / 2, y + frame.height / 2 - content.y - content.height / 2);
+
+            if (!best || area
```

**File**: `src/manager/DragCoordinator.mjs` (modified, +7/-3)
```diff
@@ -1045,6 +1045,7 @@ class DragCoordinator extends Manager {
             };
 
         let
+            previewOnly         = false,
             transitionOwned     = false,
             transitionProxyRect = null;
 
@@ -1105,7 +1106,10 @@ class DragCoordinator extends Manager {
                 }
 
                 if (transition.engage !== true || transition.commitEligible !== true || !claimed?.zone) {
-                    targetSortZone = null
+                    // Zones before the park: a standing claim the source has not converted yet may still
+                    // preview, without an embodiment and never commit-eligible.
+                    previewOnly    = transition.preview === true && targetSortZone != null && targetSortZone === claimed?.zone;
+                    targetSortZone = previewOnly ? targetSortZone : null
                 }
             }
         }
@@ -1139,13 +1143,13 @@ class DragCoordinator extends Manager {
                 me.activeTargetZone = targetSortZone
             }
 
-            me.activeTargetCommitEligible = true;
+            me.activeTargetCommitEligible = !previewOnly;
             me.activeTransitionOwned      = transitionOwned;
 
             targetSortZone.onRemoteDragMove({
                 draggedItem,
                 embodyHeader: Boolean(header),
-                embodyProxy : transitionOwned,
+                embodyProxy : transitionOwned && !previewOnly,
                 localX,
                 localY,
                 offsetX,
```

---

### Incident Patch 7: `050fdef1` (2026-09-27)
**Commit Message**: fix(dock): the first record of an empty perspective library is active, even saved with activate: false (#19307) (#19308)

savePerspective's activate: false left an empty library's null pointer beside the record it had just saved. The whole-candidate validator refuses that state, so the option could never succeed on a first save. The saved record is the only one the pointer may name, so it takes it, as a replaced active holder already hands its activeness on. activate: false keeps meaning: never move an existing pointer.

**File**: `src/dashboard/dock/persistence/PerspectiveLibrary.mjs` (modified, +5/-2)
```diff
@@ -524,7 +524,9 @@ class PerspectiveLibrary extends Base {
      * @param {Object} layout A `neo.dock.layout.v1` saved-layout record.
      * @param {Object} [options={}]
      * @param {Boolean} [options.replace=false] The caller's explicit collision decision.
-     * @param {Boolean} [options.activate=true] Point `activeLayoutId` at the saved record.
+     * @param {Boolean} [options.activate=true] Point `activeLayoutId` at the saved record. `false` leaves an
+     * existing pointer where it is; the first record of an empty library is active either way, being the
+     * only record the pointer may name.
      * @returns {{saved: Boolean, layoutId: String|null, collision: Object|null, errors: String[]}}
      */
     savePerspective(layout, {replace = false, activate = true} = {}) {
@@ -597,7 +599,8 @@ class PerspectiveLibrary extends Base {
             candidate.activeLayoutId = record.layoutId
         }
 
-        activate && (candidate.activeLayoutId = record.layoutId);
+        // an empty library's null pointer is dangling the moment it holds a record, whatever `activate` says
+        (activate || candidate.activeLayoutId === null) && (candidate.activeLayoutId = record.layoutId);
 
         return me.commit(candidate, 'perspectiveSaved', {layoutId: record.layoutId, name}) ?
             {collision: null, errors: [], layoutId: record.layoutId, saved: true} :
```

**File**: `test/playwright/unit/dashboard/PerspectiveLibrary.spec.mjs` (modified, +10/-0)
```diff
@@ -90,6 +90,16 @@ test.describe('Neo.dashboard.dock.persistence.PerspectiveLibrary (B6 — the nam
         ])
     });
 
+    test('activate: false never moves an existing pointer, and the first record of an empty library is active whatever it says', () => {
+        const first = store.savePerspective(makeLayout('l-1', 'Coding'), {activate: false});
+
+        expect(first, 'the only record is the only valid active one').toMatchObject({errors: [], saved: true, layoutId: 'l-1'});
+        expect(store.collection.activeLayoutId).toBe('l-1');
+
+        expect(store.savePerspective(makeLayout('l-2', 'Review', ['beta']), {activate: false})).toMatchObject({saved: true});
+        expect(store.collection.activeLayoutId, 'a pointer already there stays put').toBe('l-1')
+    });
+
     test('name collision returns the structured choice and saves NOTHING unless the caller decides', () => {
         store.savePerspective(makeLayout('l-1', 'Coding'));
 
```

---

### Incident Patch 8: `a50ae57c` (2026-09-26)
**Commit Message**: fix(tab): the Overflow projection never withholds the tab that holds focus (#19285) (#19294)

* fix(tab): the Overflow projection never withholds the tab that holds focus (#19285)

Withholding a tab removes its node, the browser moves focus to the body, the tab container's
`containsFocus` drops, and the header's gated contextual actions withdraw — so a tab the user had
focused vanishes out from under the caret and takes its actions with it.

The filing offered two shapes and deliberately picked neither. Measured against the source, the
focus hand-off cannot work: `syncControl` creates the control with `autoInitVnode` + `autoMount`, a
promise, so `focus()` resolves its node through `DomAccess.getElement` and gets null; and the plugin's
own `mounted` edge — the natural place to complete a hand-off — fires a render round-trip AFTER the
removal, by which point the withdrawal is causal rather than a race. A late hand-off restores
`document.activeElement` and cannot un-withdraw the actions.

So the partition keeps the node, which is the trade it already makes for the active tab:

- `computeOverflow` takes a `focusedItemId` and protects `activeItemId` union `focusedItemId`. The
  displace

**File**: `src/tab/plugin/Overflow.mjs` (modified, +68/-28)
```diff
@@ -67,18 +67,19 @@ class Overflow extends Plugin {
 
     /**
      * The pure overflow decision — active-never-hidden packing with overflow-only control-width reservation.
-     * Headless + deterministic (unit-covered): given header widths, the strip extent, the active id and the
+     * Headless + deterministic (unit-covered): given header widths, the strip extent, the protected ids and the
      * reserved control width, it returns the visible/hidden id partition. It lives here as the plugin's own
      * static so the runtime half owns its decision — no adapter namespace-reach, no adapter chain in the test
      * path (the smell that marked the old dashboard home).
      * @param {Object}   config
      * @param {Object[]} config.items            `{id, headerWidth}` per tab, in header order.
      * @param {Number}   config.extent           The always-measurable strip extent.
      * @param {String}   [config.activeItemId]   The active tab id — never hidden.
+     * @param {String}   [config.focusedItemId]  The tab holding focus — never hidden.
      * @param {Number}   [config.controlWidth=0] Width reserved for the overflow control (only when overflowing).
      * @returns {{visible: String[], hidden: String[]}}
      */
-    static computeOverflow({items, extent, activeItemId, controlWidth = 0}) {
+    static computeOverflow({items, extent, activeItemId, focusedItemId, controlWidth = 0}) {
         const list  = Array.isArray(items) ? items : [],
               width = entry => {
                   const value = Number(entry?.headerWidth);
@@ -104,29 +105,55 @@ class Overflow extends Plugin {
             }
         }
 
-        // the active item never hides: swap it in, overflow the last-fitting non-active item
-        const activeIndex = hidden.indexOf(activeItemId);
-
-        if (activeIndex !== -1) {
-            hidden.splice(activeIndex, 1);
+        // Neither protected tab hides: the ACTIVE one (the selection) and the FOCUSED one both swap
+        // in, and the last-fitting non-protected items overflow.
+        //
+        // The focused id is protected for the same reason, not as a preference: withholding a tab removes its
+        // node, the browser moves focus to the body, and the tab container's `containsFocus` drops — which
+        // withdraws the header's gated contextual actions (`toolbar.Base#applyContextualActionState`). Moving
+        // focus elsewhere cannot repair that after the fact, so keeping the node is the only shape that holds,
+        // and it is the trade this function already makes for the active tab.
+        const protectedIds = [...new Set([activeItemId, focusedItemId].filter(id => id != null))],
+              protectedSet = new Set(protectedIds),
+              withheld     = protectedIds.filter(id => hidden.includes(id));
+
+        if (withheld.length > 0) {
+            const order     = list.map(entry => entry.id),
+                  needed    = withheld.reduce((sum, id) => sum + width(list.find(entry => entry.id === id)), 0),
+                  displaced = [];
+
+            withheld.forEach(id => hidden.splice(hidden.indexOf(id), 1));
+
+            // Displace as many visible items as it takes to fit the protected width — now possibly a PAIR.
+            // Popping exactly one under-displaces when a protected tab is wider than that single displaced tab,
+            // and popping per-protected-tab under-displaces when the pair is wider than one pop, so the sum is
+            // fitted once. Popping none is also correct when a protected tab already fits (it was hidden only
+            // because an earlier item overflowed the `hidden.length === 0` gate above). The loop runs out of
+            // DISPLACEABLE items in the degenerate case — protected tabs wider than the whole extent stay
+            // visible regardless, and the caller caps their boxes, so two of them can jointly overhang.
+            //
+            // The scan SKIPS protected ids, and that 
```

**File**: `test/playwright/unit/tab/plugin/Overflow.spec.mjs` (modified, +251/-0)
```diff
@@ -788,6 +788,116 @@ test.describe('Neo.tab.plugin.Overflow (re-entrancy contract)', () => {
             .toEqual({edgeAlign: 'b0-t0', target: action.id})
     });
 
+    // ---- the projection must not remove the node that holds focus ----
+
+    /**
+     * A tab button fixture with the DOM seams `applySplit` writes through.
+     * @param {String} id
+     * @returns {Object}
+     */
+    const focusableTab = id => ({
+        addedCls: [],
+        hidden  : false,
+        id,
+        addCls(cls) { this.addedCls.push(cls) },
+        removeCls(cls) { this.addedCls = this.addedCls.filter(entry => entry !== cls) },
+        show() { this.hidden = false }
+    });
+
+    const threeTabPlugin = async () => {
+        const plugin = createPlugin(async ids => ids[0] === 'tab-overflow-test-owner'
+            ? [{height: 300, left: 0, top: 0, width: 300, x: 0, y: 0}]
+            : ids.slice(1).map(() => ({height: 20, width: 110})));
+
+        await new Promise(resolve => setTimeout(resolve, 0));
+
+        // 3 x 110 against a 300 extent with the historic 40px control reservation → usable 260, so a and
+        // b pack (220) and c is the first non-fit. activeIndex 0 → b1 is active, so the tab under test is
+        // never the active one.
+        plugin.owner.items = [focusableTab('b1'), focusableTab('b2'), focusableTab('b3')];
+
+        // The control itself is not what these arms are about, and instantiating the real floating Button
+        // leaks async theme/vdom work that reaches `Neo.get` — a namespace seam this spec never loads (every
+        // arm that runs a real projection here stubs applySplit for the same reason). The partition, the hide
+        // pass and the cap ledger all stay real; only the embodiment is stubbed.
+        plugin.syncControl = () => {};
+
+        return plugin
+    };
+
+    test('a FOCUSED non-active tab keeps its DOM node through the projection', async () => {
+        const plugin = await threeTabPlugin();
+
+        plugin.naturalWidths = {b1: 110, b2: 110, b3: 110};
+
+        // The defect: withholding b3 sets hidden → removeDom, the browser moves focus to the body, and
+        // the tab container's containsFocus drops — which withdraws the header's gated actions.
+        plugin.owner.items[2].containsFocus = true;
+
+        await plugin.project(false);
+
+        expect(plugin.owner.items[2].hidden, 'the node that holds focus must survive the projection')
+            .toBeFalsy();
+        expect(plugin.owner.items[1].hidden, 'and the protection is real: a tab is withheld to make room')
+            .toBe(true)
+    });
+
+    test('the same projection WITHOUT focus still withholds the trailing tab', async () => {
+        const plugin = await threeTabPlugin();
+
+        plugin.naturalWidths = {b1: 110, b2: 110, b3: 110};
+
+        await plugin.project(false);
+
+        // The control: nothing is focused, so the partition must be the ordinary one. Without this the
+        // arm above could pass for a projection that simply stopped withholding anything.
+        expect(plugin.owner.items[2].hidden, 'an unfocused trailing tab is withheld as before').toBe(true);
+        expect(plugin.owner.items[1].hidden).toBeFalsy()
+    });
+
+    test('a protected FOCUSED tab wider than the usable extent is capped, not underlapped', async () => {
+        const plugin = await threeTabPlugin();
+
+        // b3 is surfaced by the focus protection and is wider than the whole strip. The degenerate cap
+        // exists so every geometry derived from a surfaced button (the per-button indicator, the strip's
+        // crossfade indicator, the label) ends where the control begins — it used to gate on the ACTIVE
+        // button alone, so a protected focused tab would have underlapped the control.
+        plugin.naturalWidths = {b1: 110, b2: 110, b3: 300};
+        plugin.owner.items[2].containsFocus = true;
+
+        await plugin.project(false);
+
+        const capped = plugin
```

---

### Incident Patch 9: `cb91585d` (2026-09-26)
**Commit Message**: fix(dock): Escape cancels a drag that crossed into another window (#19300) (#19301)

* fix(dock): Escape cancels a drag that crossed into another window (#19300)

During a converted or cross-window drag the keyboard focus sits in the
vessel or the target popup, whose DragDrop owns no gesture, so Escape was
dropped. Such a window now sends one crossWindow drag:cancel; DomEvent hands
it with the message's windowId to DragCoordinator#cancelCrossWindowGesture,
which asks every other window's DragDrop#cancelDrag. Only the gesture's
owner holds a dragZoneId, so no coordinator state gates the routing:
activeSourceZone is null while a conversion is pending.

* refactor(dock): the owner's Escape delegates to DragDrop#cancelDrag (#19300)

**File**: `buildScripts/util/file-size-baseline.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
     "examples/dashboard/crossWindow/DemoBWorkspace.mjs": 2503,
     "src/dashboard/dock/Workspace.mjs": 1170,
-    "src/main/addon/DragDrop.mjs": 1267
+    "src/main/addon/DragDrop.mjs": 1276
 }
```

**File**: `src/main/addon/DragDrop.mjs` (modified, +36/-12)
```diff
@@ -184,6 +184,7 @@ class DragDrop extends Base {
             app: [
                 'requestWindowManagementPermission',
                 'acknowledgeWindowDragOrphanRecovery',
+                'cancelDrag',
                 'hasWindowDragOrphanRecovery',
                 'parkWindowDrag',
                 'registerZone',
@@ -381,24 +382,47 @@ class DragDrop extends Base {
     }
 
     /**
-     * Captures Escape at the gesture owner, independent of which dragged node still owns focus.
-     * A single `drag:cancel` is routed directly to the active worker drag zone; subsequent native
-     * move/end events are ignored until the sensor releases and resets the main-thread session.
-     * @param {KeyboardEvent} event
+     * @summary Cancels the gesture this window owns, as Escape at the owner does.
+     * One `drag:cancel` goes to the active worker drag zone, after which native move/end events are
+     * ignored until the sensor releases. Without a gesture, or once it is cancelled, nothing happens.
+     * The App Worker calls it when Escape reached another window of a cross-window drag.
+     * @param {Object} [data] Fields the `drag:cancel` carries: Escape's keyboard data at the owner, or
+     * the App Worker's routing `windowId`
+     * @returns {Boolean} true when this call cancelled the gesture
      */
-    onKeyDown(event) {
+    cancelDrag(data) {
         let me = this;
 
-        if (event.key === 'Escape' && me.dragZoneId && !me.dragCancelled) {
+        if (me.dragZoneId && !me.dragCancelled) {
             me.dragCancelled = true;
-            event.preventDefault();
             me.dragResize?.cancel();
 
-            DomEvents.sendMessageToApp({
-                ...DomEvents.getKeyboardEventData(event),
-                dragZoneId: me.dragZoneId,
-                type      : 'drag:cancel'
-            })
+            DomEvents.sendMessageToApp({...data, dragZoneId: me.dragZoneId, type: 'drag:cancel'});
+            return true
+        }
+
+        return false
+    }
+
+    /**
+     * @summary Captures Escape wherever it lands, independent of which dragged node still owns focus.
+     * The gesture owner cancels its drag once, routed directly to the active worker drag zone; subsequent
+     * native move/end events are ignored until the sensor releases and resets the main-thread session.
+     * A window without a gesture of its own (a cross-window drag's vessel or target holds the focus
+     * there) asks the App Worker to cancel one elsewhere, and leaves the key's default to its own UI.
+     * @param {KeyboardEvent} event
+     */
+    onKeyDown(event) {
+        let me = this;
+
+        if (event.key === 'Escape') {
+            let data = DomEvents.getKeyboardEventData(event);
+
+            if (!me.dragZoneId) {
+                DomEvents.sendMessageToApp({...data, crossWindow: true, type: 'drag:cancel'})
+            } else if (me.cancelDrag(data)) {
+                event.preventDefault()
+            }
         }
     }
 
```

**File**: `src/manager/DomEvent.mjs` (modified, +3/-0)
```diff
@@ -271,6 +271,9 @@ class DomEvent extends Base {
                         'drop:leave': 'onDropLeave',
                     }[eventName]].call(dragZone, data)
                 }
+            } else if (eventName === 'drag:cancel' && data.crossWindow) {
+                // Escape in a window that owns no gesture: a cross-window drag may belong to another one
+                Neo.manager.DragCoordinator?.cancelCrossWindowGesture({windowId: event.windowId})
             }
         }
     }
```

**File**: `src/manager/DragCoordinator.mjs` (modified, +13/-0)
```diff
@@ -186,6 +186,19 @@ class DragCoordinator extends Manager {
      */
     claimTraceLimit = 40
 
+    /**
+     * @summary Escape reached a window that owns no gesture: during a cross-window drag the vessel or the
+     * target holds the keyboard focus. Every other window of the app is asked to cancel the drag it owns;
+     * only the gesture's owner has one, and its cancel takes the ordinary path, `onDragCancel` included.
+     * @param {Object} data
+     * @param {String} data.windowId The window that heard Escape
+     */
+    cancelCrossWindowGesture({windowId}) {
+        Object.keys(Neo.apps || {}).forEach(id => {
+            id !== windowId && Neo.main.addon.DragDrop.cancelDrag({windowId: id})?.catch?.(Neo.emptyFn)
+        })
+    }
+
     /**
      * @summary Clears a pending geometry-only native window-drop candidate.
      *
```

**File**: `test/playwright/unit/dashboard/DockTabSortZone.spec.mjs` (modified, +28/-0)
```diff
@@ -529,6 +529,34 @@ test.describe('Neo.dashboard.dock.interaction.TabSortZone', () => {
             expect(fired[1][1]).toMatchObject({itemId: 'graph', retirement})
         });
 
+        test('a cancel while the conversion is still pending retires the vessel as a converted one does', async () => {
+            const fired      = [];
+            const retirement = Promise.resolve(true);
+            const zone       = zoneFor(fired, {
+                dragComponent   : {dockItemId: 'graph', id: 'graph-button'},
+                fire            : (name, data) => fired.push([name, data]),
+                isWindowDragging: true,
+                owner           : {up: () => ({fire(name, data) {
+                    name === 'dockTearOutCancel' && (data.settlement = retirement);
+                    fired.push([name, data])
+                }})},
+                // Escape from another window can land here before the coordinator ever admitted a target
+                vesselConversionSensor: {converted: false, transitioning: true}
+            });
+
+            zone.onDragEnd = data => runDragEnd(zone, data);
+
+            await DockTabSortZone.prototype.onDragCancel.call(zone, {key: 'Escape'});
+
+            expect(fired.map(([name]) => name)).toEqual([
+                'dockTearOutCancel',
+                'dockVesselConversionRetired',
+                'dragCancel',
+                'dockCrossZoneDragCancel'
+            ]);
+            expect(fired[1][1]).toMatchObject({itemId: 'graph', retirement})
+        });
+
         test('an in-window cancel never emits a tear-out terminal', async () => {
             const fired = [];
             const zone  = zoneFor(fired, {
```

---

### Incident Patch 10: `9bf0bd88` (2026-09-26)
**Commit Message**: fix(draggable): a cross-window proxy copies the tab the drag showed, not the one the sort zone hid (#19298) (#19299)

**File**: `src/draggable/DragZone.mjs` (modified, +19/-8)
```diff
@@ -81,6 +81,14 @@ class DragZone extends Base {
          * @member {Object|null} dragElement=null
          */
         dragElement: null,
+        /**
+         * A copy of the drag element as the drag proxy first showed it, kept for the gesture: a sort zone
+         * hides the element in place once its proxy exists, and a later proxy (a cross-window target's)
+         * must still show what the drag showed.
+         * @member {Object|null} dragElementSnapshot=null
+         * @protected
+         */
+        dragElementSnapshot: null,
         /**
          * The bounding client rect of the dragElement
          * Will get set inside dragStart()
@@ -305,12 +313,13 @@ class DragZone extends Base {
     /**
      * @summary The drag proxy's content: a fresh clone of the drag element (or of the configured proxy
      * vdom), wrapped unless `useProxyWrapper` is off. A cross-window target proxy renders the same
-     * content as the local one.
+     * content as the local one: during a gesture the clone comes from the `dragElementSnapshot` the local
+     * proxy was built from, not from the element the sort zone has hidden since.
      * @returns {Object|null} `null` while no drag element is known
      */
     getDragProxyVdom() {
         let me     = this,
-            source = me.dragProxyConfig?.vdom || me.dragElement,
+            source = me.dragProxyConfig?.vdom || me.dragElementSnapshot || me.dragElement,
             clone  = source && VDomUtil.clone(source);
 
         return !clone ? null : me.useProxyWrapper ? {cn: [clone]} : clone
@@ -349,7 +358,8 @@ class DragZone extends Base {
             config.cls = config.cls || [];
             config.cls.push('neo-draggable');
         } else {
-            config.vdom = me.getDragProxyVdom();
+            me.dragElementSnapshot = me.dragElement && VDomUtil.clone(me.dragElement);
+            config.vdom            = me.getDragProxyVdom();
 
             if (config.vdom.cls && !me.useProxyWrapper) {
                 config.cls = config.cls || [];
@@ -482,11 +492,12 @@ class DragZone extends Base {
         }
 
         Object.assign(me, {
-            dragElementRect  : null,
-            dragStartIndex   : null,
-            offsetX          : 0,
-            offsetY          : 0,
-            scrollContainerId: null
+            dragElementRect    : null,
+            dragElementSnapshot: null,
+            dragStartIndex     : null,
+            offsetX            : 0,
+            offsetY            : 0,
+            scrollContainerId  : null
         });
 
         me.fire('dragEnd', data);
```

**File**: `test/playwright/unit/draggable/DragZone.spec.mjs` (modified, +23/-0)
```diff
@@ -321,4 +321,27 @@ test.describe('Neo.draggable.DragZone', () => {
             !bare.isDestroyed && bare.destroy()
         }
     });
+
+    test('a later proxy copies the drag element as the first proxy showed it, not as the sort zone hid it after', async () => {
+        const
+            dragElement = {id: 'snapshot-tab', cls: ['neo-tab-header-button'], cn: [{id: 'snapshot-text', tag: 'span', text: 'Audit'}]},
+            owner       = {cls: [], getTheme: () => 'neo-theme-neo-light'},
+            zone        = Neo.create(DragZone, {appName: 'DraggableDragZoneTest', dragElement, owner, windowId: 'test-window-1'});
+
+        try {
+            await zone.createDragProxy({height: 32, width: 48, x: 0, y: 0}, false);
+
+            // what SortZone#onDragStart does to the dragged item once its proxy exists
+            dragElement.style = {visibility: 'hidden'};
+
+            expect(zone.getDragProxyVdom(), 'the cross-window proxy shows the tab the drag showed')
+                .toEqual({cn: [{cls: ['neo-tab-header-button'], cn: [{tag: 'span', text: 'Audit'}]}]});
+
+            zone.dragEnd({});
+
+            expect(zone.getDragProxyVdom().cn[0].style, 'after the gesture, the live element again').toEqual({visibility: 'hidden'})
+        } finally {
+            !zone.isDestroyed && zone.destroy()
+        }
+    });
 });
```

#### Recent Merged Pull Requests:
- **PR #19333** (2026-09-30): fix(build): the scripts' --help prints the engine's own issue tracker (#19332) (@neo-fable-clio)
- **PR #19331** (2026-09-30): docs(roadmap): the line table records the Institution line's own roadmap and gate (#19330) (@neo-fable-clio)
- **PR #19328** (2026-09-30): build(deps): bump webpack-dev-middleware from 8.0.3 to 8.3.0 (@dependabot[bot])
- **PR #19327** (2026-09-30): build(deps-dev): bump markdown-it from 14.2.0 to 14.3.2 (@dependabot[bot])
- **PR #19326** (2026-09-30): build(deps-dev): bump the all-deps group with 2 updates (@dependabot[bot])
- **PR #19325** (2026-09-29): feat(dock): share native workspace return and replay (#19296) (@neo-gpt)
- **PR #19324** (2026-09-29): chore(dock): retire unused conversion exit signal (#19245) (@neo-gpt)
- **PR #19322** (2026-09-29): build(content): resources/content leaves the engine (#19159) (@neo-opus-vega)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
