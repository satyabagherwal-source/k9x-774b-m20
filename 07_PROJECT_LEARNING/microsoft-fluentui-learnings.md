> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-fluentui-learnings.md`  
> **Source**: github ([https://github.com/microsoft/fluentui](https://github.com/microsoft/fluentui))  
> **Source Version**: `9c0797ae`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T22:20:34.433Z  
> **Learning ID**: `learn-github-microsoft-fluentui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): microsoft/fluentui

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core System Mission
`microsoft/fluentui` is the foundational design system and component architecture powering Microsoft 365, Teams, Office, and Azure web interfaces. The repository reconciles three generations of web development:
- **Fluent UI React v9 (`@fluentui/react-components`)**: Modern zero-runtime CSS-in-JS (Griffel), slot-based composable primitives, headless hook decoupling, and strict accessibility compliance.
- **Fluent UI React v8 (`@fluentui/react`)**: Legacy monolithic architecture based on `merge-styles`, class-based components, and legacy context pipelines.
- **Fluent UI Web Components (`@fluentui/web-components`)**: Standards-based Custom Elements powered by FAST (`@microsoft/fast-element`).

### 1.2 Subsystem Decoupling & Boundary Contracts
The architecture enforces strict decoupling between state computation, DOM manipulation, style compilation, and accessibility notifications:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Design System Architecture                      │
└────────────────────────────────────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
┌───────────────────────────────────┐   ┌────────────────────────────────┐
│ React Components (v9)             │   │ Data Visualization Suite       │
│ - Slot Recipe Architecture        │   │ - Plotly Schema Sanitizer      │
│ - Hook-based Pipeline             │   │ - Binary Data Transformer      │
│ - Griffel Pre-computed Styles      │   │ - Micro-Precision Formatter    │
└───────────────────────────────────┘   └────────────────────────────────┘
         │                                                       │
         ▼                                                       ▼
┌───────────────────────────────────┐   ┌────────────────────────────────┐
│ Accessibility & State Layer       │   │ Platform Runtime Invariants    │
│ - useControllableState            │   │ - Safe URL Protocol Sanity     │
│ - useEventCallback                │   │ - Zero-Copy TypedArray Slicing │
│ - MutationObserver Layout Sync    │   │ - Memory Leaks & Loop Guards   │
│ - Asynchronous Announce Bus       │   │ - Isomorphic Layout Effects    │
└───────────────────────────────────┘   └────────────────────────────────┘
```

1. **State / Hook Boundary (`use[Component]_unstable`)**: Hooks take immutable props and return a normalized component state object. No JSX is emitted here; state hooks contain purely reactive and DOM event orchestration logic.
2. **Render Boundary (`render[Component]_unstable`)**: Pure presentation mapping using Fluent's Slot Model. Slots can be primitive values, raw React elements, props objects, or custom slot render functions (`Slot<'div'>`).
3. **Style Injection Boundary (`use[Component]Styles_unstable`)**: Atomic CSS classes are generated at build time via Griffel (`@griffel/react`) and resolved dynamically using CSS variable handles. Zero inline styles are permitted for static layout.
4. **Shared Reactive Contexts (`@fluentui/react-shared-contexts`)**: Global services such as `AnnounceProvider` decouple UI logic from screen reader live regions, avoiding race conditions between DOM mounting and assistive technology tree updates.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Two-Phase Active-State Mutation Reconciliation for Assistive Announcements
**RULE**:
Components that issue screen-reader announcements upon active item state transitions MUST NOT announce directly inside the user action handler. They MUST buffer the pending active identifier and trigger announcements within an isomorphic layout effect verified against DOM mutation completion and active-element validation.

**WHY**:
In modern React and virtualized component trees, selector-based contexts and asynchronous state batched updates commit child elements (cards, slides, tabs) *after* the parent container's click event handler finishes. Announcing immediately in the click callback results in assistive technologies querying an unmounted, stale, or partially transitioned DOM node, failing accessibility audit compliance (WCAG 4.1.2 / 4.1.3) and leaving screen reader users stranded.

**WHEN TO APPLY**:
Applies to all tab bars, carousels, steppers, teaching popovers, accordions, and virtualized list navigators where an external announcement callback formats descriptive text based on rendered child state.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import * as React from 'react';
import { useEventCallback, useIsomorphicLayoutEffect } from '@fluentui/react-utilities';

export interface UseSynchronizedTransitionOptions {
  value: string;
  announcement?: (activeValue: string) => string;
  announce: (message: string, options: { polite: boolean }) => void;
  getActiveItemFromDom: () => { value: string } | null;
  targetContainerRef: React.RefObject<HTMLElement | null>;
}

export function useSynchronizedAnnounce({
  value,
  announcement,
  announce,
  getActiveItemFromDom,
  targetContainerRef,
}: UseSynchronizedTransitionOptions): void {
  const previousValueRef = React.useRef(value);
  const pendingAnnouncementRef = React.useRef<string | null>(null);

  const announceActiveState = useEventCallback(() => {
    const pendingValue = pendingAnnouncementRef.current;
    if (pendingValue === null) {
      return;
    }

    const activeNode = getActiveItemFromDom();
    // Guard against desynchronization: Only announce if DOM has settled to target value
    if (activeNode?.value !== pendingValue) {
      return;
    }

    pendingAnnouncementRef.current = null;
    const text = announcement?.(pendingValue);
    if (text) {
      announce(text, { polite: true });
    }
  });

  // Layout phase: detect prop/state change and schedule announcement
  useIsomorphicLayoutEffect(() => {
    if (!announcement) {
      pendingAnnouncementRef.current = null;
      return;
    }

    if (previousValueRef.current === value) {
      return;
    }

    previousValueRef.current = value;
    pendingAnnouncementRef.current = value;
    announceActiveState();
  }, [value, announcement, announceActiveState]);

  // MutationObserver phase: catch child renders committed after parent layout effect
  React.useEffect(() => {
    const element = targetContainerRef.current;
    if (!element || typeof MutationObserver === 'undefined') {
      return;
    }

    const observer = new MutationObserver(() => {
      announceActiveState();
    });

    observer.observe(element, {
      attributes: true,
      attributeFilter: ['data-carousel-item', 'data-carousel-active-item'],
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      pendingAnnouncementRef.current = null;
    };
  }, [announceActiveState, targetContainerRef]);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER trigger assistive announcements inside the click event callback
const updateSlide = (event: React.MouseEvent, newValue: string) => {
  setValue(newValue);
  onValueChange?.(event, { value: newValue });

  // ANTI-PATTERN: The DOM node for 'newValue' is not rendered yet!
  // Screen reader receives announcement before card heading exists in DOM.
  const text = announcement?.(newValue);
  if (text) {
    announce(text, { polite: true });
  }
};
```

**VERIFICATION METHOD**:
Enforce an automated integration test with React Testing Library asserting that when the announcement formatter is invoked, the previous slide heading is completely unmounted and the destination slide heading is present in the DOM:
```typescript
it('asserts DOM presence at exact time of announcement callback invocation', async () => {
  const announcement = jest.fn(val => {
    expect(screen.getByRole('heading', { name: 'Step two' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Step one' })).toBeNull();
    return `Custom ${val}`;
  });
  render(<Carousel defaultValue="one" announcement={announcement} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(announcement).toHaveBeenCalledTimes(1));
});
```

---

### 2. Guarded Context-Aware URL Protocol Whitelisting
**RULE**:
Before resolving, parsing, or rendering arbitrary URL strings into clickable DOM elements (`href`, `src`), the URL MUST be sanitized against invisible unicode separators, ASCII control codes, and whitespace BEFORE protocol extraction. Validation MUST use native `URL` instantiation constrained to an explicit protocol Set.

**WHY**:
Browsers parse URLs leniently. Attackers bypass simple regex filters (`/^https?:/`) or string lookups by prefixing protocols with soft hyphens, zero-width spaces (`\u200B`), byte-order marks (`\uFEFF`), and control characters (`\u0000-\u001F`). These characters are stripped by browser URL dispatchers, converting `jav\u200Bascri\u0000pt:alert(1)` into executable XSS vectors when injected into an `<a>` tag or chart visualization hyperlink.

**WHEN TO APPLY**:
Every documentation site router, chart tooltip hyperlink formatter, markdown renderer, and dynamically bound SVG link (`<a xlink:href="...">`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'ftp:']);

// Strip invisible characters, control codes, and Unicode zero-width boundaries
const OBFUSCATION_REGEX = /[\u0000-\u001F\u007F\s\u200B-\u200D\u2060\uFEFF]+/g;

export function isSafeUrl(href: string): boolean {
  if (typeof href !== 'string') {
    return false;
  }

  const normalized = href.replace(OBFUSCATION_REGEX, '');
  
  // Relative paths, hash anchors, and search queries are safe by definition
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(normalized);
  if (!hasScheme) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    return ALLOWED_URL_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    // Malformed URLs that mimic absolute schemes must be rejected
    return false;
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER check protocol using startsWith, regex testing, or decodeURIComponent directly
export function unsafeIsSafeUrl(url: string): boolean {
  // FAILS: 'javascript\u0000:alert(1)' passes regex but executes in Safari/WebKit
  // FAILS: 'java\tscript:alert(1)' is ignored by regex but parsed by anchor click
  const pattern = /^(https?|mailto|ftp):/i;
  return pattern.test(url);
}
```

**VERIFICATION METHOD**:
Execute property-based fuzz tests asserting that injected unicode zero-width characters and control codes return `false` on all malicious strings:
```typescript
test.each([
  'javascript\u0000:alert(1)',
  'java\u200Bscript:alert(1)',
  '  javascript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
])('rejects obfuscated protocol: %s', (maliciousUrl) => {
  expect(isSafeUrl(maliciousUrl)).toBe(false);
});
```

---

### 3. Safe Multi-Dimensional Array Reshaping with Integer Arithmetic Limits
**RULE**:
When deserializing flat numeric buffers or Base64 binary arrays into multidimensional arrays ($N$-rank tensors), validation MUST enforce a strict rank cap ($N \le 3$), test that all dimension inputs are non-negative safe integers, prevent integer multiplication overflow via `Number.MAX_SAFE_INTEGER / dimension` boundary checks, and guarantee exact element count parity before allocations.

**WHY**:
Parsing untrusted or external scientific schemas (e.g., Plotly, DataFrames) with unchecked shapes permits denial-of-service exploits:
1. Floating-point or non-safe integer dimensions (`1e18`, `NaN`, `0.5`) crash the JS runtime with array-length range exceptions.
2. Multiplication overflow causes element count wrapping, leading to unbounded recursion and call-stack exhaustion in recursive slicing logic.
3. Huge rank dimensions induce deep call stack allocations, overflowing the V8 execution stack.

**WHEN TO APPLY**:
All binary data decoders, Plotly schema processors, charting data engines, WebGL matrix loaders, and WebAssembly transfer bridges.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
const MAX_SHAPE_RANK = 3;

export function validateShape(dataLength: number, shape: number[]): void {
  if (shape.length === 0 || shape.length > MAX_SHAPE_RANK) {
    throw new Error(`Invalid typed-array shape: rank must be between 1 and ${MAX_SHAPE_RANK}`);
  }

  let elementCount = 1;

  for (const dimension of shape) {
    if (!Number.isSafeInteger(dimension) || dimension < 0) {
      throw new Error('Invalid typed-array shape: dimensions must be non-negative safe integers');
    }
    
    // Prevent integer overflow during multiplication
    if (dimension !== 0 && elementCount > Number.MAX_SAFE_INTEGER / dimension) {
      throw new Error('Invalid typed-array shape: element count exceeds the maximum safe integer');
    }

    elementCount *= dimension;
  }

  if (elementCount !== dataLength) {
    throw new Error('Invalid typed-array shape: dimensions do not match decoded element count');
  }
}

export function reshapeValidatedArray(data: number[], shape: number[]): number[] | number[][] | number[][][] {
  if (shape.length === 1) {
    return data;
  }
  if (shape.length === 2) {
    const [rows, cols] = shape;
    const result: number[][] = new Array(rows);
    for (let r = 0; r < rows; r++) {
      result[r] = data.slice(r * cols, (r + 1) * cols);
    }
    return result;
  }
  // Rank 3 recursion with bound step
  const [dim, ...rest] = shape;
  const step = data.length / dim;
  const result: number[][][] = new Array(dim);
  for (let i = 0; i < dim; i++) {
    result[i] = reshapeValidatedArray(data.slice(i * step, (i + 1) * step), rest) as number[][];
  }
  return result;
}

export function reshapeArray(data: number[], shape: number[]): number[] | number[][] | number[][][] {
  validateShape(data.length, shape);
  if (data.length === 0) {
    return [];
  }
  return reshapeValidatedArray(data, shape);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER reshape flat arrays without rank caps and arithmetic checks
export function unsafeReshape(data: any[], shape: number[]) {
  // VULNERABLE: shape=[1e15, 1e15] causes integer overflow and infinite recursive allocation
  return shape.reduceRight((acc, dim) => {
    const chunked = [];
    while (acc.length > 0) {
      chunked.push(acc.splice(0, dim)); // In-place array mutation destroys data
    }
    return chunked;
  }, data);
}
```

**VERIFICATION METHOD**:
```typescript
describe('reshapeArray Invariants', () => {
  it('throws on rank exceeding MAX_SHAPE_RANK', () => {
    expect(() => reshapeArray([1, 2, 3, 4], [1, 2, 2, 1])).toThrow(
      'rank must be between 1 and 3'
    );
  });

  it('throws on element count mismatch', () => {
    expect(() => reshapeArray([1, 2, 3], [2, 2])).toThrow(
      'dimensions do not match decoded element count'
    );
  });

  it('rejects non-integer dimensions', () => {
    expect(() => reshapeArray([1, 2], [1.5, 1])).toThrow(
      'dimensions must be non-negative safe integers'
    );
  });
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Screen Reader Desynchronization in TeachingPopover Carousel (BUG-ACCESSIBILITY-01)
- **Context**: `packages/react-components/react-teaching-popover/library/src/components/TeachingPopoverCarousel/Carousel/Carousel.tsx`
- **What Was Expected**: When a user navigates between steps in a carousel (clicking 'Next' or pressing Enter), the screen reader must announce the newly mounted card text after the DOM mutation settles, without losing focus on the navigation button.
- **What Actually Happened**: The announcement was executed synchronously inside the `updateSlide` click handler. Because React 18 selector-based context updates schedule and commit child cards *after* the carousel layout effect, the announcement occurred before the destination card was committed to the DOM. Screen reader engines either spoke stale text or remained completely silent.
- **Evidence in Repo**: Commit `707e0d7e`, PR `#36643`. Changeset `@fluentui-react-teaching-popover-d7c78e6e`.
- **Root Cause**: Synchronous callback execution during an event dispatch violates React's asynchronous render cycle. Child cards update via context subscriptions that resolve in a later microtask than the local state change of the carousel container.
- **Remediation Code Diff**:
```typescript
// - Synchronously calling announce inside the click callback:
  const updateSlide = useEventCallback(
    (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>, newValue: string) => {
      setValue(newValue);
      onValueChange?.(event, { event, type: 'click', value: newValue });
-     const announceText = announcement?.(newValue);
-     if (announceText) {
-       announce(announceText, { polite: true });
-     }
    },
  );

// + Hooking into useIsomorphicLayoutEffect and MutationObserver:
+ const previousValueRef = React.useRef(value);
+ const pendingAnnouncementRef = React.useRef<string | null>(null);
+
+ const announcePage = useEventCallback(() => {
+   const pendingValue = pendingAnnouncementRef.current;
+   const active = carouselWalker.active();
+   if (pendingValue === null || active?.value !== pendingValue) {
+     return;
+   }
+   pendingAnnouncementRef.current = null;
+   const text = announcement?.(pendingValue);
+   if (text) {
+     announce(text, { polite: true });
+   }
+ });
+
+ useIsomorphicLayoutEffect(() => {
+   if (!announcement) {
+     pendingAnnouncementRef.current = null;
+   }
+   if (previousValueRef.current === value) {
+     return;
+   }
+   previousValueRef.current = value;
+   pendingAnnouncementRef.current = null;
+   if (value === null || !announcement) {
+     return;
+   }
+   pendingAnnouncementRef.current = value;
+   announcePage();
+ }, [value, announcement, announcePage]);
+
+ // Inside MutationObserver callback:
+ // Selector-based context updates can commit cards after the carousel's layout effect.
+ announcePage();
```
- **Lesson**: Never trigger DOM-dependent accessibility announcements in event handlers. Buffer the intent into a ref, and verify DOM node synchronization across both layout effect and `MutationObserver` triggers.

---

### Incident 2: Hash-Route Anchor Separator `%23` Parsing Breakdown (BUG-ROUTING-02)
- **Context**: `packages/react-docsite-components/src/utilities/extractAnchorLink.ts` and `removeAnchorLink.ts`
- **What Was Expected**: Incoming links formatted with encoded section anchors (e.g. `https://developer.microsoft.com/en-us/fluentui#/styles/web/icons%23available-icons`) must correctly route to the `icons` page and scroll directly to the `#available-icons` heading.
- **What Actually Happened**: The router matched only literal `#` characters. When link aggregators or markdown publishers encoded the secondary hash separator as `%23`, the route parser treated `%23available-icons` as part of the page pathname, triggering a "Page Not Found (404)" failure.
- **Evidence in Repo**: Commit `9c0797ae`, PR `#36941`, Issue `#36938`.
- **Root Cause**: Over-simplistic URL string splitting using `url.split('#')`. The function assumed all anchors were literal hashes, failing to differentiate between an encoded route delimiter (`%23` separating route from section) versus encoded URL data within query strings or slug names.
- **Remediation Code Diff**:
```typescript
// - Naive string splitting:
export function extractAnchorLink(url: string): string {
- const split = url.split('#');
+ const split = normalizeEncodedAnchorLink(url).split('#');
  if (split.length === 3) {
    return split[2].split('?')[0];
  }
}

// + Dedicated scoped normalizer:
+ export function normalizeEncodedAnchorLink(url: string): string {
+   // Normalize an encoded section separator in a hash route without decoding other URL data.
+   // Matches #/route followed by %23 and valid anchor identifiers before any ? query
+   return url.replace(/(#\/[^#?]*?)%23(?=[\w-]*(?:\?.*)?$)/, '$1#');
+ }
```
- **Lesson**: Never perform generic global string decoding (`decodeURIComponent`) on entire URLs, as it corrupts query parameters and complex route data. Target specific structural delimiters using lookahead-constrained regular expressions.

---

### Incident 3: Release Pipeline Desynchronization & NPM Ghost Publish (BUG-DEVOPS-03)
- **Context**: Beachball release pipeline execution (`.agents/skills/release-recovery/SKILL.md` and Issue `#36939`)
- **What Was Expected**: During CI/CD automated release runs, Beachball publishes packages to npm and pushes version bump commits and git tags back to GitHub `origin/master` atomically.
- **What Actually Happened**: Azure DevOps pipeline 384306 published 69 packages to npm, but failed at the subsequent git push step with `GitHub 401 Unauthorized: fatal: could not read Username for 'https://github.com': terminal prompts disabled`. The pipeline terminated with exit code 130. Git `origin/master` was left out of sync with npm. Subsequent PRs attempted duplicate publishes of the same versions, causing pipeline failures.
- **Evidence in Repo**: PR `#36939`, Commit `6cf751bc00c5939cee2980aae0a32c5be20f22ee`.
- **Root Cause**: Lack of two-phase commit or transactional rollback between external package registries (npm) and source control (git). The CI agent's GitHub Personal Access Token (PAT) expired or was not passed to the child process during the git push phase.
- **Remediation Plan**:
1. Run manual recovery scripts (`.agents/skills/release-recovery/SKILL.md`).
2. Run `yarn beachball check --branch origin/master`.
3. Inspect npm registry versions directly (`npm view @fluentui/react-button version`) as the definitive source of truth.
4. Manually re-commit package metadata updates (`package.json`, `CHANGELOG.json`) without republishing to npm, using the dedicated recovery mode.
- **Lesson**: Tooling must consider package registries as external, non-transactional state. Release automation must either verify write access to both systems before initiating releases or maintain idempotent replay capabilities.

---

### Incident 4: Storybook Relative Pathing Disconnection in Component Slot Docs (BUG-DOCS-04)
- **Context**: `packages/react-components/react-storybook-addon/src/docs/FluentDocsPage.tsx`
- **What Was Expected**: In Storybook docs embedded across documentation domains and SharePoint previews, clicking the link "Customizing components with slots" should navigate within the current Storybook frame.
- **What Actually Happened**: The link used an absolute root path: `<Link href="/?path=/docs/...">`. When rendered under nested subpaths (such as `/react-components/` or embedded iframes), clicking the link redirected users to the server root (`404 Not Found`).
- **Evidence in Repo**: Commit `e4ba7be9`, PR `#36904`, Issue `#36903`.
- **Root Cause**: Hardcoding domain-root absolute links (`/`) instead of path-relative routing (`./`) inside documentation addons.
- **Remediation Code Diff**:
```typescript
- <Link href="/?path=/docs/concepts-developer-customizing-components-with-slots--docs">
+ <Link href="./?path=/docs/concepts-developer-customizing-components-with-slots--docs">
    Customizing components with slots{' '}
  </Link>
```
- **Lesson**: Design system documentation addons must remain agnostic to host mounting paths. Links must strictly use dot-relative path resolutions (`./`).

---

### Incident 5: Scientific Base64 Schema Shape Overflow in Plotly Deserializer (BUG-CHARTING-05)
- **Context**: `packages/charts/chart-utilities/src/DecodeBase64Data.ts`
- **What Was Expected**: `decodeBase64Fields` safely unpacks Base64-encoded binary buffers into multi-dimensional typed arrays according to a shape declaration (e.g. `[100, 3]`).
- **What Actually Happened**: Malformed or crafted schemas with arbitrary or negative shape dimensions resulted in V8 memory allocation crashes, array length range errors, and stack overflows in recursive array reconstruction.
- **Evidence in Repo**: Source implementation of `validateShape` and `reshapeValidatedArray`.
- **Root Cause**: Absence of dimension rank limits and lack of integer overflow protection during multiplicative accumulator operations.
- **Remediation Code Diff**:
```typescript
+ const MAX_SHAPE_RANK = 3;
+
+ function validateShape(dataLength: number, shape: number[]): void {
+   if (shape.length === 0 || shape.length > MAX_SHAPE_RANK) {
+     throw new Error(`Invalid typed-array shape: rank must be between 1 and ${MAX_SHAPE_RANK}`);
+   }
+   let elementCount = 1;
+   for (const dimension of shape) {
+     if (!Number.isSafeInteger(dimension) || dimension < 0) {
+       throw new Error('Invalid typed-array shape: dimensions must be non-negative safe integers');
+     }
+     if (dimension !== 0 && elementCount > Number.MAX_SAFE_INTEGER / dimension) {
+       throw new Error('Invalid typed-array shape: element count exceeds the maximum safe integer');
+     }
+     elementCount *= dimension;
+   }
+   if (elementCount !== dataLength) {
+     throw new Error('Invalid typed-array shape: dimensions do not match decoded element count');
+   }
+ }
```
- **Lesson**: Treat all structural metadata (shapes, dimensions, length buffers) in serialization formats as untrusted input requiring mathematical bounds checking before execution.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 4.1 Micro-Syntax & Token-Level Precision
1. **Implicit Falsy vs. Explicit Nullish Evaluation**:
   In design system utilities, passing `0` or empty strings `""` must not default to fallback values.
   ```typescript
   // DEFECT: 0 evaluates to falsy, defaulting startLevel to undefined logic
   const badLevel = startLevel || 0; 

   // CORRECT INVARIANT: Explicit undefined/null boundary check
   if (startLevel === undefined || startLevel < 0 || startLevel >= MULTI_LEVEL_DATE_TIME_FORMATS.length) {
     return DEFAULT;
   }
   ```
2. **Date Parsing Ambiguity Guard**:
   In `PlotlySchemaConverter.ts`, standard `Date.parse()` incorrectly treats pure numeric years (e.g., `"2000"`, `"2001"`) as timestamps or epoch offsets.
   ```typescript
   export const isDate = (value: any): boolean => {
     if (isNumber(value)) return false;
     const parsedDate = new Date(Date.parse(value));
     if (isNaN(parsedDate.getTime())) return false;
     
     const parsedYear = parsedDate.getFullYear();
     // REGEX GUARD: If no 4-digit year exists in the raw input string, reject artificial year 2000/2001 parses
     const yearInString = /\b\d{4}\b/.test(value);
     if (!yearInString && (parsedYear === 2000 || parsedYear === 2001)) {
       return false;
     }
     return true;
   };
   ```
3. **Floating Point Epsilon Snapping**:
   Rendering SVG tick markers and data visualizations causes sub-pixel blurring when fractional IEEE 754 precision artifacts occur (`0.1 + 0.2 = 0.30000000000000004`).
   ```typescript
   export function handleFloatingPointPrecisionError(num: number): number {
     const rounded = Math.round(num);
     return Math.abs(num - rounded) < 1e-6 ? rounded : num;
   }
   ```

### 4.2 Infinite Loop & Recursion Guards
1. **JSON Object Depth Limiter (`MAX_DEPTH = 15`)**:
   Prevent call-stack exhaustion during recursive object sanitization:
   ```typescript
   const MAX_DEPTH = 15;
   export const sanitizeJson = (jsonObject: any, depth: number = 0): any => {
     if (depth > MAX_DEPTH) {
       throw new Error('Maximum json depth exceeded');
     }
     if (typeof jsonObject === 'object' && jsonObject !== null) {
       for (const key in jsonObject)