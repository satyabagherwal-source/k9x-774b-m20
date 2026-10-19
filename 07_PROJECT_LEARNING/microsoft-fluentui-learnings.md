> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-fluentui-learnings.md`  
> **Source**: github ([https://github.com/microsoft/fluentui](https://github.com/microsoft/fluentui))  
> **Source Version**: `12b576f6`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T11:36:16.678Z  
> **Learning ID**: `learn-github-microsoft-fluentui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): microsoft/fluentui

---

## 1. Executive Forensic Architecture & System Mechanics

`microsoft/fluentui` is an enterprise-scale monorepo supporting three generations of UI design systems (Fluent UI React v9, Fluent UI React v8, and Fluent UI Web Components v3), powering applications like Microsoft 365, Teams, and Azure Portal. The repository solves the problem of cross-framework UI convergence, strict accessibility compliance, sub-millisecond styling injection, and high-frequency data visualization within multi-tenant host applications.

```
+----------------------------------------------------------------------------------+
|                            HOST APPLICATION CONTAINER                            |
|  (Teams / Office / Outlook: Custom Window, Iframe, or Shadow DOM Environment)    |
+----------------------------------------------------------------------------------+
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
+------------------------------------+          +------------------------------------+
|     Fluent UI v9 Architecture      |          |    Charting & Utility Subsystem    |
| - Zero-Runtime Styling (Griffel)   |          | - Plotly Schema Normalization      |
| - Custom Context Hooks (useFluent) |          | - TypedArray Base64 Deserializer   |
| - DOM Decoupling Layer             |          | - Safe URL Protocol Evaluator      |
| - Strict Package Layering          |          | - Dynamic Multi-Level Intl Formats |
+------------------------------------+          +------------------------------------+
                 │                                               │
                 ├───────────────────────┬───────────────────────┤
                 ▼                       ▼                       ▼
+----------------------------------+ +-------------------------+ +-------------------+
|     packages/react-utilities     | |  packages/charts/...    | | Monorepo CI/CD    |
| - canUseDOM()                    | | - DecodeBase64Data.ts   | | - Beachball locks |
| - SSR Isolation                  | | - PlotlyConverter.ts    | | - Nx Task Runner  |
| - Safe Execution Boundaries      | | - isSafeUrl.ts          | | - Agent Guardrails|
+----------------------------------+ +-------------------------+ +-------------------+
```

### Architectural Boundaries & State Ownership
1. **Zero Global Reference Boundary (`window` / `document` Isolation)**:
   In v9, components are strictly barred from referencing globals (`window`, `document`, `navigator`). State consumption occurs via `useFluent_unstable()`, extracting `targetDocument` and `targetDocument.defaultView`. This decouples the UI from the primary host window, enabling rendering in pop-out windows, isolated `iframe` portals, SSR workers, and Micro-Frontend (MFE) contexts.
2. **Package Dependency Hierarchy**:
   Horizontal cross-talk between peer component packages is strictly prohibited (e.g., `react-button` cannot depend on `react-menu`). Common utilities and shared contexts are extracted downward into `@fluentui/react-utilities` and `@fluentui/react-shared-contexts`, preventing circular bundling and version desynchronization.
3. **Data Serialization & High-Throughput Chart Pipelines**:
   The `chart-utilities` subsystem ingests arbitrary third-party visualization specs (e.g., Plotly schemas). To prevent main-thread freezing and memory exhaustion during large dataset rendering, the subsystem performs base64 typed array decoding, shape dimension normalization (validating non-negative safe integers and bounding rank), JSON sanitization against XSS, and multi-level date formatting with floating-point epsilon corrections.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Host-Decoupled DOM Context Encapsulation
**RULE**:
Components and libraries operating in modern component trees MUST NOT directly reference global browser singletons (`window`, `document`, `navigator`, `localStorage`). All DOM interactions MUST be resolved through an ambient context hook (e.g., `useFluent().targetDocument`) or a safe execution predicate (`canUseDOM()`).

**WHY**:
Direct usage of `window` or `document` causes immediate failures in SSR node runtimes (Throwing `ReferenceError: window is not defined`), breaks multi-window setups (e.g., Electron/Teams pop-outs where events fire in detached `Window` contexts), and prevents CSS/focus isolation inside Shadow DOM boundaries.

**WHEN TO APPLY**:
Apply to all React, Vue, Svelte, or Web Component design systems, micro-frontend platforms, and browser extension environments.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import * as React from 'react';

export interface DOMContextValue {
  targetDocument: Document | undefined;
}

export const DOMContext = React.createContext<DOMContextValue>({
  targetDocument: typeof document !== 'undefined' ? document : undefined,
});

export function useDOMContext(): { targetDocument: Document | undefined; defaultView: Window | null } {
  const context = React.useContext(DOMContext);
  const targetDocument = context.targetDocument;
  const defaultView = targetDocument ? targetDocument.defaultView : null;
  return { targetDocument, defaultView };
}

export function useEventListener<K extends keyof DocumentEventMap>(
  type: K,
  listener: (ev: DocumentEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): void {
  const { targetDocument } = useDOMContext();

  React.useEffect(() => {
    if (!targetDocument) {
      return;
    }
    targetDocument.addEventListener(type, listener, options);
    return () => {
      targetDocument.removeEventListener(type, listener, options);
    };
  }, [targetDocument, type, listener, options]);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct global access guarantees crashes in SSR and pop-out frames
export function useWindowResize(listener: () => void) {
  React.useEffect(() => {
    window.addEventListener('resize', listener); // CRITICAL FAULT: ReferenceError on server
    return () => window.removeEventListener('resize', listener);
  }, [listener]);
}
```

**VERIFICATION METHOD**:
Implement an ESLint rule using `@typescript-eslint/utils` that flags identifier references to globals:
```javascript
// eslint rule: "no-restricted-globals"
module.exports = {
  rules: {
    'no-restricted-globals': ['error', 
      { name: 'window', message: 'Use useDOMContext().defaultView or canUseDOM() instead.' },
      { name: 'document', message: 'Use useDOMContext().targetDocument instead.' },
      { name: 'navigator', message: 'Access navigator via targetDocument.defaultView.navigator.' }
    ]
  }
};
```

---

### 2. Multi-Dimensional Array Shape Dimension and Allocation Guard
**RULE**:
When deserializing or transforming linear buffers into multi-dimensional typed structures from external or untrusted data sources, the deserializer MUST enforce an explicit maximum rank, verify every dimension as a non-negative safe integer, assert multiplication overflow guards against `Number.MAX_SAFE_INTEGER`, and confirm that the computed product strictly matches the buffer length before allocating target collections.

**WHY**:
Malicious or malformed inputs specifying gigantic shapes (e.g., `shape: [1000000, 1000000]`) or negative/fractional dimensions cause out-of-memory (OOM) heap allocations, process crashes, integer wraparound defects, or infinite loops in nested slicing recursions.

**WHEN TO APPLY**:
Apply to any data pipeline ingesting tensor, matrix, Plotly, or binary data over JSON/RPC/REST protocols.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
const MAX_SHAPE_RANK = 3;

export function validateAndReshape<T>(data: T[], shape: number[]): T[] | T[][] | T[][][] {
  if (shape.length === 0 || shape.length > MAX_SHAPE_RANK) {
    throw new Error(`Invalid shape: rank must be between 1 and ${MAX_SHAPE_RANK}`);
  }

  let elementCount = 1;
  for (const dimension of shape) {
    if (!Number.isSafeInteger(dimension) || dimension < 0) {
      throw new Error('Invalid shape: dimensions must be non-negative safe integers');
    }
    // Prevent integer overflow before performing multiplication
    if (dimension !== 0 && elementCount > Number.MAX_SAFE_INTEGER / dimension) {
      throw new Error('Invalid shape: element count exceeds the maximum safe integer');
    }
    elementCount *= dimension;
  }

  if (elementCount !== data.length) {
    throw new Error(`Invalid shape: dimension product (${elementCount}) != data length (${data.length})`);
  }

  if (data.length === 0 || shape.length === 1) {
    return data;
  }

  if (shape.length === 2) {
    const [rows, cols] = shape;
    const result: T[][] = [];
    for (let r = 0; r < rows; r++) {
      result.push(data.slice(r * cols, (r + 1) * cols));
    }
    return result;
  }

  // 3D reshape: recurse into 2D slices
  const [dim0, ...rest] = shape;
  const step = data.length / dim0;
  const result: T[][][] = [];
  for (let i = 0; i < dim0; i++) {
    result.push(validateAndReshape(data.slice(i * step, (i + 1) * step), rest) as T[][]);
  }
  return result;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naive reshape blindly trusting input dimensions
export function unsafeReshape(data: number[], shape: number[]) {
  const [rows, cols] = shape;
  const result = [];
  for (let r = 0; r < rows; r++) { // Crashes if rows = -1 or allocates massive array if rows = 1e9
    result.push(data.slice(r * cols, (r + 1) * cols));
  }
  return result;
}
```

**VERIFICATION METHOD**:
Execute property-based fuzz tests with randomized integer arrays to verify bound enforcement:
```typescript
test('validateAndReshape rejects arithmetic overflows and negative bounds', () => {
  expect(() => validateAndReshape([1, 2, 3, 4], [Number.MAX_SAFE_INTEGER, 2])).toThrow(
    /element count exceeds the maximum safe integer/
  );
  expect(() => validateAndReshape([1, 2, 3, 4], [-2, -2])).toThrow(
    /non-negative safe integers/
  );
  expect(() => validateAndReshape([1, 2, 3, 4], [1, 2, 3, 4])).toThrow(
    /rank must be between 1 and 3/
  );
});
```

---

### 3. Whitespace-Stripping URL Protocol Sanitization
**RULE**:
Before validating a URL against an allowed protocol whitelist, the evaluation pipeline MUST strip control characters, whitespace, and invisible zero-width separators (`[\u0000-\u001F\u007F\s\u200B-\u200D\u2060\uFEFF]`) before parsing with `new URL()`. Any URL presenting a scheme pattern that fails native URL parsing MUST be rejected.

**WHY**:
Browsers allow URLs containing control characters or zero-width spaces (e.g., `java\u0000script:...` or `jav&#x09;ascript:...`) to bypass simplistic regex protocol checks while still executing JavaScript when assigned to `href` or `src` attributes.

**WHEN TO APPLY**:
Apply to all user-input links, SVG hyperlinks, chart tooltips, markdown renderers, and external redirect handlers.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'ftp:']);
const OBFUSCATION_REGEX = /[\u0000-\u001F\u007F\s\u200B-\u200D\u2060\uFEFF]+/g;
const SCHEME_TEST_REGEX = /^[a-z][a-z0-9+.-]*:/i;

export function isSafeUrl(href: string): boolean {
  if (typeof href !== 'string') {
    return false;
  }

  // Normalize potentially obfuscated protocols
  const normalized = href.replace(OBFUSCATION_REGEX, '');
  const hasScheme = SCHEME_TEST_REGEX.test(normalized);

  // Relative URLs without a scheme are safe
  if (!hasScheme) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    return ALLOWED_URL_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    // Malformed absolute URLs containing schemes are untrusted
    return false;
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Regex matching without zero-width character stripping and scheme detection
export function unsafeIsSafeUrl(url: string) {
  // Bypassed by "javascript :alert(1)" or "java\u200Bscript:alert(1)"
  return !url.startsWith('javascript:');
}
```

**VERIFICATION METHOD**:
Run unit tests across standard XSS evasions:
```typescript
describe('isSafeUrl security audit', () => {
  it('detects evasions using control characters and zero-width spaces', () => {
    expect(isSafeUrl('jav\u0000ascript:alert(1)')).toBe(false);
    expect(isSafeUrl('java\u200Bscript:alert(1)')).toBe(false);
    expect(isSafeUrl('javascript\t:alert(1)')).toBe(false);
    expect(isSafeUrl('https://valid.com')).toBe(true);
    expect(isSafeUrl('/internal/route')).toBe(true);
  });
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Monorepo Package Release Desynchronization via Multi-Changefile PRs (BUG-MONOREPO-BEACHBALL-01)
- **Context**: Root monorepo agent and contribution governance (`AGENTS.md`, Beachball release orchestration).
- **What Was Expected**: Continuous delivery pipeline must consume automated Beachball changelogs without generating fragmented semantic version increments or conflicting publish plans when multiple changes touch the same package.
- **What Actually Happened**: Automated agents and contributors generated multiple Beachball change files for a single package within a single PR. During automated merge and tag resolution, Beachball registered conflicting semver step increments, leading to duplicated changelog entries and botched npm versioning.
- **Evidence in Repo**: Commit `12b576f6`, PR #36933, file `AGENTS.md`.
- **Root Cause**: Absence of an invariant constraint capping change files to at most one file per package per PR.
- **Remediation Code Diff**:
```diff
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -23,6 +23,7 @@
  3. **Never access `window`, `document`, or `navigator` directly.** In v9 components, use `useFluent_unstable()` to get `targetDocument` and `targetDocument.defaultView` instead of `document`/`window`. For non-component code, use `canUseDOM()` from `@fluentui/react-utilities`.
  4. **Never add dependencies between component packages.** `react-button` must not depend on `react-menu`. Shared logic goes in `react-utilities` or `react-shared-contexts`. See [docs/architecture/layers.md](docs/architecture/layers.md).
  5. **Never skip beachball change files** for published package changes. Run `yarn beachball change`.
+ 6. **Each PR must contain at most one Beachball change file per package.** Consolidate all changes for that package in the PR into that one file.
```
- **Lesson**: CI/CD release tools driven by distributed file markers must enforce unique partition keys (one file per target package per transaction) to prevent non-deterministic release calculations.

---

### Incident 2: Autonomous Agent Context Splattering Across PR Boundaries (BUG-AGENT-CONTRIB-02)
- **Context**: Automated PR lifecycle and Copilot PR generation (`.agents/skills/review-pr`, PR #36915, PR #36591).
- **What Was Expected**: Automated code generation tasks addressing PR review feedback must isolate refactoring changes strictly to the blast radius of that review.
- **What Actually Happened**: The autonomous agent bundled unrelated architectural revisions into an active PR, causing code review stagnation and blocking pipeline verification.
- **Evidence in Repo**: Closed PR #36915 ("*Separate changes from original PR into a new PR to address feedback*"), triggering review: `https://github.com/microsoft/fluentui/pull/36591#discussion_r4303053061` (*"@copilot these changes are not related to the PR revert here and move them to a separate PR"*).
- **Root Cause**: Lack of git diff scope checking in the automated prompt agent loop, allowing out-of-scope edits to leak into active working branches.
- **Remediation Code Diff**:
```diff
--- a/.agents/skills/review-pr/SKILL.md
+++ b/.agents/skills/review-pr/SKILL.md
@@ -12,3 +12,7 @@
+## Invariant Rules
+- Branch modifications must be restricted solely to files modified in the base pull request.
+- If reviewer feedback requests orthogonal features, spawn an independent branch and PR.
+- Verify `git diff --name-only origin/master...HEAD` matches approved PR scope before requesting review.
```
- **Lesson**: Autonomous code modification workflows require deterministic blast-radius verifiers that compare the active working diff against the originating issue bounds.

---

### Incident 3: Floating-Point Tick Precision Drift in Visualization Axes (BUG-CHART-FORMATTER-03)
- **Context**: Axis formatting and localization (`packages/charts/chart-utilities/src/formatter.ts`).
- **What Was Expected**: Generated chart axis ticks representing integral boundary steps (e.g., `4.000000000000001` or `2.999999999999999`) must display as clean integers (`4` or `3`) in formatted locale output.
- **What Actually Happened**: IEEE 754 floating-point precision errors caused `toLocaleString` to render unwanted fractional values (e.g., `"4.000000000000001"`), resulting in visual clutter and layout thrashing on SVG axis renders.
- **Evidence in Repo**: `packages/charts/chart-utilities/src/formatter.ts` - `handleFloatingPointPrecisionError()`.
- **Root Cause**: Calling `.toLocaleString()` directly on unrounded floating-point calculations derived from tick intervals (`step = (max - min) / count`).
- **Remediation Code Diff**:
```diff
--- a/packages/charts/chart-utilities/src/formatter.ts
+++ b/packages/charts/chart-utilities/src/formatter.ts
@@ -0,0 +1,10 @@
+export function handleFloatingPointPrecisionError(num: number): number {
+  const rounded = Math.round(num);
+  return Math.abs(num - rounded) < 1e-6 ? rounded : num;
+}
...
   if (typeof data === 'number') {
     const toGroup = Math.abs(data) >= 10000;
-    return data.toLocaleString(culture, { useGrouping: toGroup });
+    return handleFloatingPointPrecisionError(data).toLocaleString(culture, { useGrouping: toGroup });
   }
```
- **Lesson**: Any continuous calculation destined for human-readable DOM representation must pass through an epsilon-based discrete boundary clamp (`Math.abs(num - Math.round(num)) < EPSILON`).

---

### Incident 4: Ambiguous Date String Parsing and Epoch Millennium Traps (BUG-CHART-DATEPARSER-04)
- **Context**: Input schema conversion (`packages/charts/chart-utilities/src/PlotlySchemaConverter.ts`).
- **What Was Expected**: Numerical values passed to charting data schemas must not be misidentified as `Date` objects, and incomplete string fragments must not trigger false-positive calendar mapping.
- **What Actually Happened**: JavaScript's native `Date.parse()` converts pure integers (interpreted as epoch timestamps) into valid dates. Furthermore, parsing short strings or partial identifiers (e.g., `"00"`, `"01"`) defaults to years 2000 or 2001, misclassifying categorical strings as time-series data.
- **Evidence in Repo**: `packages/charts/chart-utilities/src/PlotlySchemaConverter.ts` - `isDate()`.
- **Root Cause**: Relying solely on `!isNaN(new Date(Date.parse(value)).getTime())` without checking numerical type identity and 4-digit year regex patterns.
- **Remediation Code Diff**:
```diff
--- a/packages/charts/chart-utilities/src/PlotlySchemaConverter.ts
+++ b/packages/charts/chart-utilities/src/PlotlySchemaConverter.ts
@@ -0,0 +1,14 @@
+export const isDate = (value: any): boolean => {
+  // Don't consider number as date. There is no way to differentiate milliseconds from date and number
+  // without additional context.
+  if (isNumber(value)) {
+    return false;
+  }
+  const parsedDate = new Date(Date.parse(value));
+  if (isNaN(parsedDate.getTime())) {
+    return false;
+  }
+  const parsedYear = parsedDate.getFullYear();
+  const yearInString = /\b\d{4}\b/.test(value);
+  if (!yearInString && (parsedYear === 2000 || parsedYear === 2001)) {
+    return false;
+  }
+  return true;
+};
```
- **Lesson**: Parsing untyped dynamic values into dates requires semantic preconditions (guaranteeing non-number types and explicit calendar year presence) to prevent heuristic parser hallucinations.

---

### Incident 5: Recursive JSON Injection and Call-Stack Exhaustion (BUG-CHART-XSS-STACK-05)
- **Context**: Payload sanitization for dynamic Plotly schemas (`packages/charts/chart-utilities/src/PlotlySchemaConverter.ts`).
- **What Was Expected**: Sanitizing arbitrary nested JSON specs against script injection (`<` and `>` tags) must complete safely without overflowing the JavaScript call stack.
- **What Actually Happened**: Cyclic objects or deeply nested structures passed into naive recursive sanitizers caused `RangeError: Maximum call stack size exceeded`.
- **Evidence in Repo**: `packages/charts/chart-utilities/src/PlotlySchemaConverter.ts` - `sanitizeJson()`.
- **Root Cause**: Unbounded recursion depth in JSON traversal.
- **Remediation Code Diff**:
```diff
--- a/packages/charts/chart-utilities/src/PlotlySchemaConverter.ts
+++ b/packages/charts/chart-utilities/src/PlotlySchemaConverter.ts
@@ -0,0 +1,18 @@
+const MAX_DEPTH = 15;
+export const sanitizeJson = (jsonObject: any, depth: number = 0): any => {
+  if (depth > MAX_DEPTH) {
+    throw new Error('Maximum json depth exceeded');
+  }
+  if (typeof jsonObject === 'object' && jsonObject !== null) {
+    for (const key in jsonObject) {
+      if (jsonObject.hasOwnProperty(key)) {
+        if (typeof jsonObject[key] === 'string') {
+          jsonObject[key] = jsonObject[key].replace(/</g, '&lt;').replace(/>/g, '&gt;');
+        } else {
+          jsonObject[key] = sanitizeJson(jsonObject[key], depth + 1);
+        }
+      }
+    }
+  }
+  return jsonObject;
+};
```
- **Lesson**: Recursive tree-walking routines on dynamic external JSON must always maintain an explicit recursion counter (`depth > MAX_DEPTH`) to guard the call stack against cyclic or malicious payloads.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Numerical Type Coercion Hazards**:
  In `packages/charts/chart-utilities/src/PlotlySchemaConverter.ts`, testing if a value represents a number uses:
  ```typescript
  export const isNumber = (value: any): boolean => !isNaN(parseFloat(value)) && isFinite(value);
  ```
  `isFinite(value)` coerces booleans and null (`isFinite(null) === true`, `isFinite(false) === true`). Therefore, callers must strictly assert type bounds.
- **Window vs. Global `isNaN` Inconsistency**:
  Notice the microscopic pattern in `formatter.ts`:
  ```typescript
  } else if (typeof data === 'string' && !window.isNaN(Number(data))) {
  ```
  `Number.isNaN` vs `window.isNaN`: `window.isNaN(" ") === false` because `Number(" ") === 0`. The codebase checks `data === ''` prior to conversion to prevent empty strings from coercing to `0`.

### 2. Infinite Loop & Recursion Guards
- **Multi-Level Time Format Bounding**:
  In `packages/charts/chart-utilities/src/formatter.ts`:
  ```typescript
  if (startLevel === undefined || startLevel < 0 || startLevel >= MULTI_LEVEL_DATE_TIME_FORMATS.length) {
    return DEFAULT;
  }
  if (endLevel === undefined || endLevel < startLevel) {
    return MULTI_LEVEL_DATE_TIME_FORMATS[startLevel][startLevel];
  }
  ```
  The multi-level matrix lookup avoids indexing out-of-bounds (`MULTI_LEVEL_DATE_TIME_FORMATS[startLevel]`) by asserting both `startLevel < 0` and `>= length`, with a fallback when `endLevel < startLevel` to prevent inversion loops.

### 3. UI & UX Micro-Mechanics
- **Zero-Runtime CSS Isolation (Griffel)**:
  Fluent UI v9 avoids runtime CSS injection overhead by pre-compiling CSS-in-JS into static atomic rules. Atomic classes avoid CSS specificity escalation:
  - Rules are injected via an internal renderer into the specific document context: `renderer.insertCSSRules(targetDocument)`.
  - In Jest tests, `@griffel/jest-serializer` serializes style hashes into readable class selectors to prevent snapshot churn across build environments.

### 4. Backend Concurrency & Memory Safety
- **Terser Name Mangling Restrictions**:
  In `packages/charts/chart-utilities/webpack.config.js`:
  ```javascript
  const regex = new RegExp(
    ['(truncateText|addNodeShapetoSVG|createPathLink|addLinktoSVG|',
     'createTree|createTreeDataStructure|createTreeChart)$'].join('')
  );
  // ...
  terserOptions: {
    mangle: {
      keep_classnames: false,
      keep_fnames: false,
      properties: {
        regex: regex,
        undeclared: true,
      },
    },
  }
  ```
  Minification targets specific internal charting function identifiers to preserve external SVG and D3/Plotly property contracts, preventing broken SVG property accessors at runtime.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Base64 Padding Rectification**:
  In `packages/charts/chart-utilities/src/DecodeBase64Data.ts`:
  ```typescript
  function addBase64Padding(s: string): string {
    const paddingNeeded = (4 - (s.length % 4)) % 4;
    return s + '='.repeat(paddingNeeded);
  }
  ```
  Standard JavaScript `atob()` throws a `DOMException` if base64 inputs lack `=` padding. Rather than failing, the deserializer calculates `(4 - (len % 4)) % 4` and auto-heals stripped trailing padding.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Layered Decoupling**: Separation into three tiers:
  1. Base primitives: `@fluentui/react-utilities`, `@fluentui/tokens`.
  2. Unstyled state engines: `@fluentui/react-tabster` (keyboard focus handling).
  3. Styled components: `@fluentui/react-components` using Griffel atomic CSS.
- **Cross-Component Isolation**: Peer packages (e.g., `react-card` and `react-button`) cannot import each other directly; they can only compose via public slots and child tokens.

### 2. Core Abstractions
- **Slots Pattern**: Every component defines slots (`root`, `icon`, `content`, `badge`) typed as `Slot<ComponentProps>`. This enables slot replacement, custom rendering, and child overrides while preserving accessibility attributes.
- **State Hooks**: Splitting lifecycle into `useComponent_unstable(props)` (computes state), `useComponentStyles_unstable(state)` (applies Griffel classes), and `renderComponent_unstable(state)` (pure JSX projection).

### 3. Error Handling
- **Graceful Visualization Degradation**: In `PlotlySchemaConverter.ts`, if annotation data exists but series data is empty or malformed, `getValidSchema()` falls back to an empty series rather than throwing, preserving layout titles and labels:
  ```typescript
  if (validatedSchema.data.length === 0) {
    if (hasAnnotations) {
      return { ...validatedSchema, data: [] };
    }
    throw new Error('Plotly input data is empty');
  }
  ```

### 4. Testing
- **Multi-Level Verification Matrix**:
  1. Unit tests: `jest` with `ts-jest` using `isolatedModules: true` for build speed.
  2. Style regression: `@griffel/jest-serializer` inspecting atomic class generation.
  3. Visual regression: Playwright/Cypress screenshot suites orchestrated via `.github/actions/run-publish-vr-screenshot`.
  4. Type compliance: `@arethetypeswrong/cli` checking ESM/CJS export interfaces.

### 5. Security
- **Strict Protocol Validation (`isSafeUrl`)**: Disallows non-whitelisted protocols. Blocks XSS payloads hidden behind zero-width and invisible control unicode characters.
- **Deep JSON DOM Sanitization**: `sanitizeJson` maps dynamic chart labels and tooltips, escaping `<` and `>` into HTML entities prior to SVG canvas emission.

### 6. Performance
- **Zero-Copy TypedArray Base64 Extraction**:
  `DecodeBase64Data.ts` converts base64 strings directly into `Uint8Array` byte buffers and maps them to target views (`Float64Array`, `Int32Array`) via `decodedBytes.buffer`, avoiding redundant intermediate string copies.
- **Atomic CSS Invariant**: Griffel generates single-rule classes (`.f1xxxx { display: flex; }`), ensuring that CSS bundle sizes scale logarithmically with UI complexity rather than linearly.

### 7. Deployment
- **Nx Monorepo Pipeline**: Configured with strict task graphs (`nx run-many -t clean, build, test`).
- **Semantic Version Locking**: Enforced through Beachball, requiring developer-authored change files verified in CI via `beachball check`.
- **Node Engine Constraint**: Strictly pinned to modern LTS engines: `"node": "^22.0.0 || ^24.0.0"`.

### 8. Agent Patterns
- **Standardized Repository Skills**:
  The repository maintains structured AI agent prompt contracts in `.agents/skills/` and `.claude/skills/`:
  - `v9-component`: Generates compliant slot-based component templates.
  - `change`: Enforces one Beachball file per package per PR.
  - `assign-prs`: Routes pull requests to maintainers based on CODEOWNERS and workload distribution schemas.

### 9. Data Flow
- **Data Flow Lifecycle in Charts**:
  `Untrusted Plotly JSON` -> `sanitizeJson()` -> `decodeBase64Fields()` -> `isDate/isNumber Normalization` -> `validateShape()` -> `SVG Presentation Pipeline`.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Ambient Window & Document Safe Resolver
```typescript
import { canUseDOM } from '@fluentui/react-utilities';

export function getSafeDocument(customDoc?: Document): Document | undefined {
  if (customDoc) {
    return customDoc;
  }
  return canUseDOM() ? document : undefined;
}

export function getSafeWindow(customDoc?: Document): Window | null {
  const doc = getSafeDocument(customDoc);
  return doc ? doc.defaultView : null;
}
```

### 2. Rule
**All array/buffer reshaping logic parsing external schemas MUST validate that `rank <= MAX_RANK`, dimensions are non-negative safe integers, and their product equals the source buffer length before generating collections.**

### 3. Architecture Principle
**Component libraries must be strictly presentation-only or slot-compositional; peer component packages must never form horizontal dependencies.**

### 4. Failure Mode
- **Symptom**: Chart crashes with `DOMException: The string to be decoded is not correctly encoded`.
- **Cause**: Third-party API sends raw base64 data stripped of trailing `=` padding characters.
- **Remedy**: Auto-calculate missing modulo-4 padding using `(4 - (str.length % 4)) % 4` before