> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-fluentui-learnings.md`  
> **Source**: github ([https://github.com/microsoft/fluentui](https://github.com/microsoft/fluentui))  
> **Source Version**: `32c88c86`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-27T20:54:50.484Z  
> **Learning ID**: `learn-github-microsoft-fluentui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): microsoft/fluentui

---

## 1. Executive Forensic Architecture & System Mechanics

`microsoft/fluentui` is the design system and UI foundation powering Microsoft 365, Teams, Azure Portal, and Office web applications. The repository manages a multi-generational ecosystem composed of:
1. **Fluent UI React v8 (formerly Office UI Fabric)**: Legacy class-based components relying on `@fluentui/utilities`, `EventGroup`, and mutable singleton managers (`KeytipManager`).
2. **Fluent UI React v9 (Converged)**: Modern architecture built on headless hooks (`use[Component]`), JSX slots, zero-runtime-cost atomic CSS-in-JS via `@griffel`, and `@floating-ui/dom` for positioning.
3. **Fluent UI Web Components**: Web component primitives based on `@microsoft/fast-element`.
4. **Data Visualization (`@fluentui/react-charting` & `chart-utilities`)**: High-performance visualization converters transforming typed Plotly schemas and raw binary buffers (`bdata`) into accessible SVG/Canvas visualizations.

```
                              fluentui Monorepo Architecture
                                            │
        ┌───────────────────────────────────┼──────────────────────────────────┐
        ▼                                   ▼                                  ▼
Fluent v8 (Legacy)                 Fluent v9 (Converged)             Chart Utilities & Fast
- KeytipLayer / KeytipManager      - Headless state hooks            - Binary base64 decoding (TypedArray)
- EventGroup capture listeners     - Component Slot mechanics        - Protocol sanitization (isSafeUrl)
- Win/Doc event bridge             - Griffel CSS-in-JS (Atomic)       - Plotly AST normalization
        │                                   │                                  │
        └───────────────────────────────────┼──────────────────────────────────┘
                                            ▼
                           Nx Monorepo Tooling & Orchestration
                                            │
        ┌───────────────────────────────────┼──────────────────────────────────┐
        ▼                                   ▼                                  ▼
Bundle Fixture Generator            Visual Regression Harness         Autonomous Agent Skills
- AST named-import extractor        - Web Animations API freezer      - .agents/skills/ & .claude/skills/
- Subpath tree-shaking sync         - storywright / Playwright        - PR triage, drift fix, recovery
```

### Critical Subsystem Boundaries
- **Keyboard Navigation & Keytip Engine (`packages/react/src/components/KeytipLayer`)**: A singleton event orchestrator (`KeytipManager`) bridges native DOM events (`keydown`, `keyup`, `keypress`) via `EventGroup` subscriptions across window and iframe document barriers. It maps modifier chording, hierarchical tree traversals (`KeytipTree`), and activation policies without triggering unwanted browser-native accesskey menus.
- **Visual Regression Determinism (`apps/vr-tests-react-components`)**: Storywright/Playwright screenshot testing infrastructure. It decouples UI capture from browser timing engines by hijacking the Web Animations API (`Element.prototype.animate`) to deterministically freeze or snap frame transitions.
- **Bundle Measurement Pipeline (`tools/workspace-plugin`)**: Custom Nx generators (`bundle-size-fixtures-sync`) parse project export maps and AST barrels to produce named-import bundle fixtures. This prevents namespace import bloat (`import *`) from artificially distorting minification metrics.
- **Binary Data Deserializer (`packages/charts/chart-utilities/src/DecodeBase64Data.ts`)**: Ingests base64-encoded array buffers from Python/Plotly services, performs bounds checking against `Number.MAX_SAFE_INTEGER`, enforces maximum shape ranks ($\le 3$), and maps raw memory directly into JavaScript `TypedArray` buffers (`Float64Array`, `Int32Array`, `Uint8Array`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Web Animations API Deterministic Freezing for Visual Regression Testing
**RULE**:
Visual regression harnesses MUST intercept the native Web Animations API (`Element.prototype.animate`) at runtime, force finite animations to their completed state (`finish()`), pause infinite animations at their exact midpoint ($\text{delay} + \frac{\text{duration}}{2}$), and defer execution to a microtask (`queueMicrotask`) to allow callers to register completion event listeners.

**WHY**:
CSS zeroing rules (`* { animation: none !important; transition: none !important; }`) fail to control modern JS animations driven by `@fluentui/react-motion` or the native Web Animations API. Capturing screenshots while animations are inflight produces race conditions across CI environments. Additionally, executing `animation.finish()` synchronously inside `Element.prototype.animate` breaks client code (e.g., toast elements becoming visible only on `animation.onfinish`), because the caller has not yet bound its event listener when `animate()` returns.

**WHEN TO APPLY**:
Apply to any Storybook, Playwright, Puppeteer, Cypress, or visual regression harness testing components that use the Web Animations API or JavaScript-driven animation drivers.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Intercepts Web Animations API to settle animations deterministically before screenshot capture.
 */
export function installDeterministicAnimationHarness(): void {
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
    return;
  }

  const nativeAnimate = Element.prototype.animate;

  Element.prototype.animate = function (
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions
  ): Animation {
    const animation = nativeAnimate.call(this, keyframes, options);

    // Defer settlement to a microtask so caller can attach .onfinish / .finished listeners
    queueMicrotask(() => {
      // Chromium can return null or invalid objects from animate() under headless edge cases
      const timing = animation?.effect?.getComputedTiming();

      // Guard: Do not force finish an idle or externally aborted animation
      if (!animation || !timing || animation.playState === 'idle') {
        return;
      }

      if (timing.endTime === Infinity) {
        // Freeze infinite looping animations at deterministic midpoint
        animation.pause();
        animation.currentTime = Number(timing.delay ?? 0) + Number(timing.duration ?? 0) / 2;
      } else {
        // Snap finite animations straight to final render frame
        animation.finish();
      }
    });

    return animation;
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Zeroing CSS or calling finish() synchronously
Element.prototype.animate = function (keyframes, options) {
  const anim = nativeAnimate.call(this, keyframes, options);
  anim.finish(); // CRITICAL BUG: Caller's onfinish handler is not registered yet!
  return anim;
};
```

**VERIFICATION METHOD**:
Verify using a unit test that creates a mock element, initiates an animation with an attached `onfinish` callback, and asserts via microtask flushing that `onfinish` was called and `animation.playState === 'finished'`.

---

### 2. Gesture-Isolated Modifier Activation via Keyup-Only State Transitions
**RULE**:
Systems using standalone modifier keys (such as `Alt` or `Meta`) to trigger overlay modes (like Keytips or Hotkey overlays) MUST NOT enter the mode on `keydown`. They MUST buffer a pending activation state on `keydown`, pass through or abort upon any intervening keystrokes (chords), execute entry strictly on `keyup` of the isolated modifier, and consume both the initial `keydown` and the releasing `keyup` via `preventDefault()` and `stopPropagation()` to prevent browser chrome menu takeover.

**WHY**:
Triggering mode changes on modifier `keydown` breaks standard operating system keyboard shortcuts (e.g., `Alt+F` for file menu, `Alt+Tab`, or browser-level access keys). If an overlay enters on `keydown`, characters typed while holding the modifier are stolen by the overlay instead of routing to application chords. Furthermore, international keyboards (such as those using `AltGraph` or `Ctrl+Alt` for character composition) will suffer character corruption unless release-only isolation is enforced.

**WHEN TO APPLY**:
Any desktop-class web interface providing keyboard accelerators, accessible keytip sequences, or global HUD activation via standalone modifier keys.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface KeytipActivationState {
  pendingModifierKey?: string;
  isComposing: boolean;
}

export class KeyboardGestureController {
  private _state: KeytipActivationState = { isComposing: false };
  private _consumeNextKeyUp: boolean = false;

  public handleKeyDown(ev: KeyboardEvent): boolean {
    if (this._state.isComposing || ev.isComposing || ev.key === 'AltGraph') {
      return false; // Preserve international IME & AltGraph
    }

    // Single standalone modifier press
    if (ev.key === 'Alt') {
      this._state.pendingModifierKey = ev.key;
      this._consumeNextKeyUp = true;
      ev.preventDefault(); // Suppress native browser menu bar focus
      return true;
    }

    // Intervening key was pressed while modifier held: Cancel pending mode!
    if (this._state.pendingModifierKey) {
      this._state.pendingModifierKey = undefined;
      this._consumeNextKeyUp = false; // Allow chord character to pass through
    }

    return false;
  }

  public handleKeyUp(ev: KeyboardEvent, onEnterMode: () => void): boolean {
    if (this._state.pendingModifierKey && ev.key === this._state.pendingModifierKey) {
      this._state.pendingModifierKey = undefined;
      ev.preventDefault();
      onEnterMode(); // Mode is entered ONLY upon release of unchorded modifier
      return true;
    }

    if (this._consumeNextKeyUp && ev.key === 'Alt') {
      this._consumeNextKeyUp = false;
      ev.preventDefault();
      return true;
    }

    return false;
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Immediate keytip mode transition on modifier keydown
function onKeyDown(ev: KeyboardEvent) {
  if (ev.key === 'Alt') {
    enterKeytipMode(); // BREAKS ALL CHORDING: Alt+D, Alt+F, Alt+Arrow are intercepted!
    ev.preventDefault();
  }
}
```

**VERIFICATION METHOD**:
Execute synthetic keyboard event series: `keydown(Alt)` $\rightarrow$ `keydown(H)` $\rightarrow$ `keyup(H)` $\rightarrow$ `keyup(Alt)`. Assert that `onEnterMode` was NEVER called, and verify that `defaultPrevented` on keydown `H` was `false`.

---

### 3. Tree-Shaking Measurement Isolation via Explicit Named Export Fixtures
**RULE**:
Automated bundle-size measurement fixtures MUST import target components via explicit named imports (`import { Component } from '...'`) and MUST NOT use namespace imports (`import * as Component from '...'`).

**WHY**:
Namespace imports cause JavaScript bundlers (Rollup, Webpack, esbuild) to generate an immutable module namespace object mapping every export name to a string literal key. This preserves unused internal properties, symbols, and metadata in the minified output. When testing a subpath or single component, namespace imports inflate bundle measurements and conceal tree-shaking regressions.

**WHEN TO APPLY**:
All bundle-size analyzers, Monosize configs, Webpack bundle-tracker fixtures, and package export validation suites.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// tools/workspace-plugin/src/generators/bundle-size-fixtures-sync/lib/fixtures.ts
export function renderEntryPointFixture(namedImports: string[], modulePath: string, fixtureName: string): string {
  const sortedImports = [...namedImports].sort();
  return [
    `// Named imports only - a namespace import keeps every export name as a string property in the minified output,`,
    `// which no consumer ships, and inflates the measured size.`,
    `import {`,
    `  ${sortedImports.join(',\n  ')}`,
    `} from '${modulePath}';`,
    ``,
    `console.log(`,
    `  ${sortedImports.join(',\n  ')}`,
    `);`,
    ``,
    `export default {`,
    `  name: '${fixtureName}',`,
    `};`,
    ``,
  ].join('\n');
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Namespace imports in size tracking fixtures
import * as TagPicker from '@fluentui/react-headless-components-preview/tag-picker';
console.log(TagPicker); // Injects runtime dictionary object; defeats dead-code elimination!
export default { name: 'TagPicker' };
```

**VERIFICATION METHOD**:
Run an AST linter or Nx generator test asserting that no `.fixture.js` or `.fixture.ts` file contains an `ImportNamespaceSpecifier` (`ts.isNamespaceImport`).

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Modifier Keytip Collision & Accidental Browser Interception (BUG-FLUENT-KEYTIP-01)
- **Context**: `packages/react/src/components/KeytipLayer/KeytipLayer.base.tsx`, `KeytipLayer.types.ts`
- **What Was Expected**: Pressing and releasing the `Alt` key without typing any other character should toggle Keytips. Holding `Alt` while typing application shortcuts (e.g., `Alt+H` or `Alt+C`) should execute the application shortcut without activating Keytip mode.
- **What Actually Happened**: The legacy implementation executed transitions immediately on `keydown`. Pressing `Alt` entered Keytip mode on press, capturing subsequent keys and preventing host application accesskey chords. Additionally, browser menu bar activation was not suppressed cleanly without losing the character event.
- **Evidence in Repo**: Commit `ba2bc211`, PR #36886. Added `KeytipLayer.activation.test.tsx` with 1,092 lines of unit tests.
- **Root Cause**: The transition handler operated on synchronous `keydown` without tracking user intent or key release mechanics. It failed to distinguish between a *standalone tap* of a modifier and a *chord initiation*.
- **Remediation Code Diff**:
```typescript
// packages/react/src/components/KeytipLayer/KeytipLayer.base.tsx
@@ -205,9 +239,16 @@ export class KeytipLayerBase extends React.Component<IKeytipLayerProps, IKeytipL
     } else if (transitionKeysContain(this.props.keytipStartSequences!, transitionKey) && !currKtp) {
-      this._keyHandled = true;
-      this._enterKeytipMode(transitionKey);
-      this._warnIfDuplicateKeytips();
+      if (this.props.keytipActivationBehavior) {
+        this._keyHandled = !!this._enterKeytipMode(transitionKey);
+        if (this._keyHandled) {
+          this._warnIfDuplicateKeytips();
+        }
+      } else {
+        this._keyHandled = true;
+        this._enterKeytipMode(transitionKey);
+        this._warnIfDuplicateKeytips();
+      }
     }
```
*And in the activation gesture processor:*
```typescript
+    // On standalone tap, keyup is canceled before onEnterKeytipMode runs,
+    // so the host can transfer focus cleanly within the same document after release.
+    if (this._activationKey === 'Alt' && ev.type === 'keyup') {
+      if (this._pendingActivation) {
+        ev.preventDefault();
+        this._enterKeytipMode(this._pendingActivation);
+      }
+    }
```
- **Lesson**: Activation of modes mapped to primary OS modifiers (`Alt`, `Meta`) must always be transactional: buffer on `keydown`, invalidate on any concurrent key, and commit exclusively on `keyup`.

---

### Incident 2: Synthetic Bundle Invalidation via Namespace Property String Bloat (BUG-FLUENT-BUNDLE-02)
- **Context**: `packages/react-components/react-headless-components-preview/library/bundle-size/`, `tools/workspace-plugin/src/generators/bundle-size-fixtures-sync`
- **What Was Expected**: CI bundle-size monitors for headless component subpaths (`./tag-picker`, `./teaching-popover`) should accurately reflect tree-shaken consumer production footprints.
- **What Actually Happened**: Fixtures used `import * as TagPicker from '...'`. In minified outputs, every unused export was preserved in a runtime object dictionary, artificially inflating recorded package sizes by several kilobytes.
- **Evidence in Repo**: Commit `b29f101f`, PR #36987.
- **Root Cause**: The Nx workspace generator previously lacked an `entryPoint` mode that could traverse the TypeScript AST to discover all public runtime exports and emit explicit named import identifiers.
- **Remediation Code Diff**:
```javascript
// packages/react-components/react-headless-components-preview/library/bundle-size/TagPicker.fixture.js
@@ -1,6 +1,66 @@
-import * as TagPicker from '@fluentui/react-headless-components-preview/tag-picker';
+// Named imports only - a namespace import keeps every export name as a string property in the minified output,
+// which no consumer ships, and inflates the measured size.
+import {
+  TagPicker,
+  TagPickerButton,
+  TagPickerControl,
+  TagPickerGroup,
+  TagPickerInput,
+  TagPickerList,
+  TagPickerOption,
+  TagPickerOptionGroup,
+  renderTagPicker,
+  renderTagPickerButton,
+  // ... 20 additional named exports
+} from '@fluentui/react-headless-components-preview/tag-picker';

-console.log(TagPicker);
+console.log(
+  TagPicker,
+  TagPickerButton,
+  // ...
+);
```
- **Lesson**: Performance tracking fixtures must reflect real consumer consumption patterns. Tooling must automate the generation of explicit AST named imports to maintain accurate baselines.

---

### Incident 3: Non-Deterministic Visual Regression via Web Animations API Drift (BUG-FLUENT-VR-03)
- **Context**: `apps/vr-tests-react-components/.storybook/preview.js`, `apps/vr-tests-react-components/src/stories/Positioning/Positioning.stories.tsx`
- **What Was Expected**: Playwright/Storywright visual snapshots of positioning overlays and animated components should be completely reproducible across runs.
- **What Actually Happened**: Flaky visual regression failures occurred intermittently. Components using `@fluentui/react-motion` rely on the Web Animations API (`Element.prototype.animate`), which ignores CSS animation disabling flags. Animations were captured mid-cycle. Additionally, Chromium occasionally returned `null` from `animate()`, causing test runner crashes.
- **Evidence in Repo**: Commit `98a1da51`, PR #37002, Issue #33902.
- **Root Cause**:
  1. Web Animations API timers run out-of-band relative to CSS declarations.
  2. Synchronously calling `.finish()` caused race conditions where listeners attached immediately after `element.animate()` were never triggered.
  3. Floating positioning passed intermediate layout events before settling.
- **Remediation Code Diff**:
```javascript
// apps/vr-tests-react-components/.storybook/preview.js
+function disableWebAnimations() {
+  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
+    return;
+  }
+  const animate = Element.prototype.animate;
+  Element.prototype.animate = function (keyframes, options) {
+    const animation = animate.call(this, keyframes, options);
+    // Callers attach finish handlers right after animate() returns (e.g. Toast becomes visible on enter finish),
+    // so settle the animation only once they had a chance to do that.
+    queueMicrotask(() => settleAnimation(animation));
+    return animation;
+  };
+}
+
+function settleAnimation(animation) {
+  // Chromium can return null from animate(), see https://github.com/microsoft/fluentui/issues/33902
+  const timing = animation?.effect?.getComputedTiming();
+  if (!animation || !timing || animation.playState === 'idle') {
+    return;
+  }
+  if (timing.endTime === Infinity) {
+    animation.pause();
+    animation.currentTime = Number(timing.delay ?? 0) + Number(timing.duration ?? 0) / 2;
+  } else {
+    animation.finish();
+  }
+}
```
```tsx
// apps/vr-tests-react-components/src/stories/Positioning/Positioning.stories.tsx
-    onPositioningEnd: () => setCount(s => s + 1),
+    // The number of initial positioning passes depends on layout timing, so only an event after the click is shown
+    onPositioningEnd: () => clickedRef.current && setUpdated(true),
...
-  storyWright: { steps: new Steps().click('#target').snapshot('updated 2 times').end() },
+  storyWright: {
+    steps: new Steps().click('#target').wait('[data-updated="true"]').snapshot('updated after click').end(),
+  },
```
- **Lesson**: Never assert on raw event counts during multi-pass browser layouts. Gate assertions using state-driven DOM attributes (`data-updated="true"`), and freeze low-level browser animation runtimes at the microtask boundary.

---

### Incident 4: ReDoS & CPU Exhaustion in CSS Selector AST Generation (BUG-FLUENT-REDOS-04)
- **Context**: Root monorepo dependency `postcss-selector-parser`
- **What Was Expected**: Compiling and parsing CSS class selectors in Griffel and build-time transformers should execute in linear time $O(N)$.
- **What Actually Happened**: Crafting flat, nested, or unclosed selector strings caused catastrophic backtracking (ReDoS) leading to thread CPU exhaustion in build runners.
- **Evidence in Repo**: Issue #37017, CVE-2026-104844 / GHSA-rj75-hqrm-r3gf.
- **Root Cause**: Exponential backtracking inside the parser grammar for flat selectors prior to version 6.1.5.
- **Remediation**:
```json
// package.json / yarn.lock
- "postcss-selector-parser": "6.0.13"
+ "postcss-selector-parser": "6.1.5"
```
- **Lesson**: Parsing untrusted CSS or complex selector strings requires strict linear-time grammars. Build plugins must continuously scan dependencies for parser algorithmic complexity vulnerabilities.

---

### Incident 5: CI/CD Supply Chain Hijack via Mutable Action References (BUG-FLUENT-SEC-05)
- **Context**: `.github/workflows/*.yml`
- **What Was Expected**: GitHub Action workflow steps referencing third-party repositories should execute verifiable, immutable code.
- **What Actually Happened**: Actions referenced mutable Git branch heads or version tags (e.g., `actions/checkout@v4`). An upstream account compromise could inject malicious scripts directly into the build pipeline.
- **Evidence in Repo**: Issue #37008.
- **Root Cause**: Reliance on mutable Git refs instead of dereferenced, immutable 40-character commit SHAs.
- **Remediation Diff**:
```yaml
# .github/workflows/pipeline.yml
- uses: actions/checkout@v4
+ uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```
- **Lesson**: Pin every external pipeline action to a full 40-character commit SHA with an annotated version comment, managed by automated updater bots (Dependabot).

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Safe Number Coercion vs `NaN` Traps**:
  Standard JavaScript `isFinite` and `parseFloat` behave inconsistently when passed `null`, `undefined`, boolean flags, or empty strings.
  In `packages/charts/chart-utilities/src/PlotlySchemaConverter.ts`:
  ```typescript
  export const isNumber = (value: any): boolean => !isNaN(parseFloat(value)) && isFinite(value);
  ```
  *Trap*: `Number(null)` evaluates to `0`. `isFinite(null)` evaluates to `true`. Using `parseFloat(value)` first ensures that `null`, `undefined`, and `""` are converted to `NaN`, preventing false positives.
- **`TypedArray` Guard vs `DataView` Bug**:
  Checking `ArrayBuffer.isView(x)` returns `true` for `DataView` instances. However, `DataView` does not expose `.length`, `[index]`, or `.buffer` slice methods like true `TypedArray` objects (`Float64Array`, `Uint8Array`).
  In `packages/charts/chart-utilities/src/PlotlySchemaConverter.ts`:
  ```typescript
  export function isTypedArray(a: any): boolean {
    return ArrayBuffer.isView(a) && !(a instanceof DataView);
  }
  ```
- **Base64 Modulo Length Invariant**:
  Base64 strings must strictly be multiples of 4 bytes. Missing terminal `=` padding causes browser `atob()` to throw a fatal DOMException.
  In `packages/charts/chart-utilities/src/DecodeBase64Data.ts`:
  ```typescript
  function addBase64Padding(s: string): string {
    const paddingNeeded = (4 - (s.length % 4)) % 4;
    return s + '='.repeat(paddingNeeded);
  }
  ```
  *Precision*: When `s.length % 4 === 0`, `(4 - 0) % 4 === 0`. The double modulo guarantees no redundant padding is appended.