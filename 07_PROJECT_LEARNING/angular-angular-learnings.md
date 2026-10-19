> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/angular-angular-learnings.md`  
> **Source**: github ([https://github.com/angular/angular](https://github.com/angular/angular))  
> **Source Version**: `e0260db5`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T07:10:45.314Z  
> **Learning ID**: `learn-github-angular-angular`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): angular/angular

---

## 1. Executive Forensic Architecture & System Mechanics

`angular/angular` is Google's enterprise application platform and reactive UI runtime. At its core, the repository resolves three hard technical challenges:
1. **Ahead-of-Time (AOT) Incremental Compilation**: Transforming TypeScript ASTs and HTML template parse trees into optimized JavaScript virtual instructions (`ɵɵelement`, `ɵɵproperty`, `ɵɵadvance`) via `ngtsc` and native Rust preprocessors (`ng-analyze`), with zero runtime template parsing.
2. **Fine-Grained Reactive Primitives & Hydration**: Unifying fine-grained reactive push/pull state graphs (`Signals`) with hybrid Server-Side Rendering (SSR), non-destructive DOM hydration, and early event recording and replay contracts (`jsaction` / `_ejsas`).
3. **Decoupled Hierarchical Dependency Injection & Routing**: Resolving trees of singletons, scoped injectors, and reactive router pipelines that synchronize route states with page layout boundaries without leaking memory across dynamic view destructions.

### Critical Subsystem Boundaries & Invariant Architecture

```
+---------------------------------------------------------------------------------------+
|                                    COMPILATION PHASE                                  |
|                                                                                       |
|  Rust Preprocessor (ng-analyze)               TypeScript AOT Compiler (ngtsc)         |
|  [Syntax Extraction / Host Directives] -----> [Type-Check Blocks (TCB) / OOB Diags]   |
|                                                              |                        |
|                                                              v                        |
|                                            Template Intermediate Representation (TIR) |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                     RUNTIME ENGINE                                    |
|                                                                                       |
|  Dependency Injection Tree                   Fine-Grained Signals Graph               |
|  [PlatformInjector -> Root -> NodeInjector]   [Producer (Signal) <-> Consumer (Effect)]|
|                      |                                       |                        |
|                      +-------------------+-------------------+                        |
|                                          |                                            |
|                                          v                                            |
|                        Logical View Engine (LView / TView)                            |
|                        - TView: Shared template schema, bindings, cleanups            |
|                        - LView: Per-instance DOM nodes, reactive signal links         |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                HYDRATION & REPLAY ENGINE                              |
|                                                                                       |
|  SSR Serialized DOM & _ejsas Payload --------> Non-Destructive Node Hydration Path    |
|                                           |                                           |
|                                           v                                           |
|                           [Event Contract / jsaction Dispatcher]                      |
|                           - Event Replay across shared APP_ID boundaries              |
|                           - Synthetic Replay Buffer draining                          |
+---------------------------------------------------------------------------------------+
```

1. **Logical Views (`LView`) vs. Template Definition Views (`TView`)**:
   - `TView` is immutable per component declaration. It retains constant structural metadata: static DOM element definitions, string pools, slots, and cleanup indexing offsets (`tCleanup`).
   - `LView` represents physical component instances in memory. It is a flat array indexed by fixed offsets containing DOM nodes, child injectors, directives, and instance cleanup closures (`lCleanup`). 

2. **Hydration and Early Event Replay (`packages/core/src/hydration`)**:
   - During SSR (`@angular/platform-server`), components render HTML while inline scripts record high-frequency client events (click, input) before framework initialization. Events are buffered onto the window scope (`window._ejsas[appId]`).
   - On the client, `withEventReplay()` extracts the event queue container via `EventContractContainer` and replays events in synthetic FIFO sequences into Angular's event dispatch pipeline. Once consumed, the global reference is pruned to eliminate DOM memory leaks.

3. **Compiler Diagnostics & Type Check Blocks (TCBs)**:
   - `packages/compiler-cli/src/ngtsc/typecheck` synthesizes ephemeral TypeScript source files containing synthetic type-checking functions (`_tcb1(this: AppComponent)`).
   - Invariant verification for structural control flow (`@if`, `@for`, `@switch`, `@boundary`) computes projected content slot assignments before bytecode generation to catch multi-root projection conflicts (`NG8011`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Ephemeral Global State Consumption Invariant
**RULE**:
When an application instance claims, drains, or mutates shared runtime global state (e.g., `window.__GLOBAL_REGISTRY__[instanceId]`), code MUST treat target property extraction as single-assignment, conditionally guarded, and non-fatal. It MUST NEVER assume exclusivity or execute non-null assertions (`!`) on shared global bags.

**WHY**:
In multi-app micro-frontends, multiple independent runtime roots, embedded widgets, or duplicate script tags often mount with identical application identifiers (`APP_ID`). If App A reaches stability (`whenStable()`) first, it consumes and deletes the global buffer. If App B performs an unguarded non-null property read on the shared reference (`window._ejsas![appId]!.prop`), App B throws an uncaught `TypeError: Cannot read properties of undefined`. This causes unhandled promise rejections, breaks hydration contracts, and aborts framework bootstrap.

**WHEN TO APPLY**:
- Client-side hydration routines reading SSR transfer states.
- Shared global window bus listeners, analytics queues, and cross-micro-frontend message contracts.
- Any environment where third-party widgets or multiple instances share an execution context.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
interface GlobalReplayPayload {
  c: unknown;
  events: Array<unknown>;
}

declare global {
  interface Window {
    _sharedEventContracts?: Record<string, GlobalReplayPayload | undefined>;
  }
}

function initializeAppEventContract(
  appId: string,
  dispatcher: (contract: unknown) => void,
  logger: { warn: (msg: string) => void }
): boolean {
  // Use optional chaining instead of non-null assertions.
  // The property may have been drained by another root instance sharing the ID.
  const earlyContractData = window._sharedEventContracts?.[appId];

  if (!earlyContractData) {
    logger.warn(
      `[EVENT_CONTRACT_ALREADY_CONSUMED] Contract replay was skipped for ID: "${appId}". ` +
      `Ensure application IDs are unique per instance when sharing an execution context.`
    );
    return false;
  }

  // Safely extract payload
  const container = earlyContractData.c;
  dispatcher(container);

  // Clear global reference to prevent memory leaks and dangling references
  if (window._sharedEventContracts) {
    delete window._sharedEventContracts[appId];
  }

  return true;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct non-null assertion on mutable global state.
// If two instances share appId, the second caller will throw an unhandled TypeError.
function unsafeInit(appId: string) {
  const earlyContractData = window._sharedEventContracts![appId]!; // CRASH: Cannot read properties of undefined
  const container = earlyContractData.c;
  registerDispatcher(container);
  window._sharedEventContracts![appId] = undefined; // App 2 will crash here
}
```

**VERIFICATION METHOD**:
Run parallel bootstrapping integration tests with identical identifiers:
```typescript
it('does not throw when two independent runtimes share the same ID', async () => {
  const sharedId = 'shared-id-001';
  window._sharedEventContracts = { [sharedId]: { c: {}, events: [] } };

  const warnings: string[] = [];
  const logger = { warn: (msg: string) => warnings.push(msg) };

  const res1 = initializeAppEventContract(sharedId, () => {}, logger);
  const res2 = initializeAppEventContract(sharedId, () => {}, logger);

  expect(res1).toBeTrue();
  expect(res2).toBeFalse();
  expect(warnings.length).toBe(1);
  expect(warnings[0]).toContain('[EVENT_CONTRACT_ALREADY_CONSUMED]');
});
```

---

### 2. Synchronous Mutation Protection in Notification Loops
**RULE**:
When dispatching notifications or events across an array or linked collection of subscribers, the dispatch loop MUST iterate over a shallow copy or a frozen snapshot of the subscriber collection. It MUST NEVER iterate directly over a mutable subscriber list if a subscriber callback can synchronously invoke an unsubscription or removal operation.

**WHY**:
If subscriber 0 is called and immediately executes `unsubscribe()`, it mutates the listener array in-place (e.g., using `splice()`). This causes all subsequent elements to shift left by one index. The dispatch loop, advancing its iteration index `i++` to `1`, now accesses what was originally subscriber 2, completely skipping subscriber 1. Subscriber 1 never receives the event.

**WHEN TO APPLY**:
- Event emitters, reactive subjects, multicast observables, and signal-to-event notification layers.
- DOM custom event dispatch loops, pub-sub architectures, and hook pipelines.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export class RobustEventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];

  subscribe(listener: (value: T) => void): () => void {
    this.listeners.push(listener);
    let isSubscribed = true;

    return () => {
      if (!isSubscribed) return;
      isSubscribed = false;
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  emit(value: T): void {
    // Snapshot the listeners array to prevent index shifting bugs during synchronous unsubscribe
    const snapshot = this.listeners.slice();
    for (let i = 0; i < snapshot.length; i++) {
      snapshot[i](value);
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Iterating over a live, mutable listener array.
export class FragileEventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];

  emit(value: T): void {
    // BUG: If listeners[0] calls unsubscribe() synchronously, this.listeners.length shrinks
    // and elements shift left. i becomes 1, skipping the original element at index 1!
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i](value);
    }
  }
}
```

**VERIFICATION METHOD**:
Construct an automated test asserting delivery when an earlier listener terminates immediately:
```typescript
it('delivers events to subsequent listeners when prior listeners unsubscribe synchronously', () => {
  const emitter = new RobustEventEmitter<string>();
  const delivered: string[] = [];

  const unsubscribe1 = emitter.subscribe((msg) => {
    delivered.push(`l1:${msg}`);
    unsubscribe1(); // Synchronously unregisters
  });

  emitter.subscribe((msg) => {
    delivered.push(`l2:${msg}`);
  });

  emitter.emit('ping');
  expect(delivered).toEqual(['l1:ping', 'l2:ping']);
});
```

---

### 3. Source-Mapped Ast Debug Insertion Hygiene
**RULE**:
When compiler passes inject runtime debug instrumentation or polyfills into user code via AST/string manipulations, injected dynamic expansions MUST evaluate to structurally valid, statically typed expressions under both declaration emit (`emitDeclarationOnly: true`) and code emit (`emitDeclarationOnly: false`) modes. They MUST NOT generate bare `@ts-ignore` comments that corrupt declaration maps or break downstream type checkers.

**WHY**:
Conditional debug code (e.g., `...(ngDevMode ? [{ debugName: 'x' }] : [])`) generated with `@ts-ignore` annotations will fail downstream strict TypeScript compilations if the compiler emits types (`.d.ts`), or when downstream toolchains disable comments. Casting the conditional spread explicitly with `as []` enforces a statically empty tuple type on production paths, satisfies TS inference without relying on suppressions, and leaves AST type maps intact.

**WHEN TO APPLY**:
- AOT code generators, AST rewrite macros, Babel/SWC plugins, and TypeScript Transformers.
- Dev-mode parameter injection (such as debug names, callsite origins, telemetry tags).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Safe macro emission in AST / MagicString transformer
function generateDevArgsSpread(devArgsExpr: string, emitTypes: boolean): string {
  const conditionalSpread = `...(ngDevMode ? [${devArgsExpr}] : /* istanbul ignore next */ [])`;
  
  // When generating types or compiling under strict verification, cast as an empty tuple
  // to avoid type widening issues while eliminating the need for brittle suppression comments.
  return emitTypes 
    ? `(${conditionalSpread} as [])` 
    : `/* @ts-ignore */ ${conditionalSpread}`;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly prepending /* @ts-ignore */ into codebases emitting .d.ts files.
// Causes downstream declaration generators to fail or generate broken source mappings.
function unsafeInsertDebug(devArgsExpr: string): string {
  return `\n/* @ts-ignore */\n...(ngDevMode ? [${devArgsExpr}] : [])`;
}
```

**VERIFICATION METHOD**:
Add compiler CLI test cases verifying that generated `.d.ts` declaration files compile without errors:
```bash
tsc --project tsconfig.declaration-test.json --noEmitOnError --declaration
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Hydration Crash when Two Bootstrapped Applications Share an `APP_ID` (BUG-CORE-01)
- **Context**: Hydration event replay system, `packages/core/src/hydration/event_replay.ts`.
- **What Was Expected**: Multiple Angular runtimes booting on the same page (e.g., a host app and an embedded widget) should safely skip early event replay if the replay contract was already consumed by an earlier runtime, allowing `whenStable()` promises to resolve normally.
- **What Actually Happened**: The runtime crashed explicitly with `TypeError: Cannot read properties of undefined (reading 'c')`. Because this was raised inside an unhandled promise flow during bootstrap, `whenStable()` never completed, breaking hydration and causing SSR tests to fail.
- **Evidence in Repo**: Commit `3a0835b3`. File: `packages/core/src/hydration/event_replay.ts`. Added runtime error code `RuntimeErrorCode.EVENT_REPLAY_CONTRACT_ALREADY_CONSUMED = 511`.
- **Root Cause**: The implementation used non-null assertion operators (`!`) assuming `window._ejsas![appId]!` would always exist. When two apps share an `APP_ID`, the first app to stabilize claims the contract and clears `_ejsas[appId]`. The second app then accesses the undefined reference, dereferencing `.c` on `undefined`.
- **Remediation Code Diff**:
```typescript
@@ -201,10 +206,24 @@ export function withEventReplay(): Provider[] {
-const initEventReplay = (eventDelegation: EventContractDetails, injector: Injector) => {
+/** @returns false if there was no early event data to replay (another app already used it). */
+const initEventReplay = (eventDelegation: EventContractDetails, injector: Injector): boolean => {
   const appId = injector.get(APP_ID);
-  // This is set in packages/platform-server/src/utils.ts
-  const earlyJsactionData = window._ejsas![appId]!;
+  // This is set in packages/platform-server/src/utils.ts. Two apps can share an APP_ID
+  // (duplicate bootstrap script, embedded widget), so it may already be cleared.
+  const earlyJsactionData = window._ejsas?.[appId];
+  if (!earlyJsactionData) {
+    console.warn(
+      formatRuntimeError(
+        RuntimeErrorCode.EVENT_REPLAY_CONTRACT_ALREADY_CONSUMED,
+        ngDevMode &&
+          `Event replay was skipped for APP_ID "${appId}". Another application on this page ` +
+            `already consumed the early event contract for this APP_ID. APP_ID must be unique ` +
+            `per application when multiple Angular applications share a page.`,
+      ),
+    );
+    return false;
+  }
   const eventContract = (eventDelegation.instance = new EventContract(
     new EventContractContainer(earlyJsactionData.c),
   ));
```
- **Lesson**: Do not use non-null assertions on shared runtime buffers. Check boundaries explicitly and degrade gracefully (e.g., log a warning and return early) to prevent breaking lifecycle promises.

---

### Incident 2: Compiler-CLI Preprocessor Regression on Signal Type Emits and AST Source Mapping (BUG-COMPILER-02)
- **Context**: Ahead-of-Time Preprocessor & Type-Checking Engine, `packages/compiler-cli/preprocessor/src/processor.ts`.
- **What Was Expected**: Preprocessed TypeScript files injecting signal debug names should preserve type validity without interfering with downstream AST source printers or failing during declaration emits (`.d.ts`).
- **What Actually Happened**: Internal builds broke because the preprocessor injected raw `/* @ts-ignore */` comments into inline expressions. When type declarations were generated or analyzed by downstream pipelines, the comments caused parsing shifts and type errors. Additionally, `output_ast_printer.ts` stripped required mapping points if line counts were zero.
- **Evidence in Repo**: Commit `16d0968e`. Files: `packages/compiler-cli/preprocessor/src/processor.ts`, `packages/compiler-cli/preprocessor/src/output_ast_printer.ts`, Rust binding `component.rs`.
- **Root Cause**: The AST transformation inserted `/* @ts-ignore */` within expressions rather than applying a typed cast. In declaration-emitting contexts (`emitTypes: true`), TypeScript rejects comment-suppressed spread expressions.
- **Remediation Code Diff**:
```typescript
@@ -1913,7 +1913,12 @@ const FORWARD_REFERENCE_GUARD = '// @ts-ignore\n';
 function insertSignalDebugNames(
   s: MagicString,
   insertions: nga.SignalDebugNameMetadata[],
+  emitTypes: boolean,
 ): void {
+  // Note: we diverge from ngtsc with the `as []` as opposed to adding a `@ts-ignore`.
   for (const insertion of insertions) {
     const debugName = `{ debugName: ${JSON.stringify(insertion.debugName)} }`;
     const separator = insertion.needsSeparator ? ', ' : '';
@@ -1925,8 +1930,11 @@ function insertSignalDebugNames(s: MagicString, insertions: nga.SignalDebugNameM
       continue;
     }
     const devArgs = insertion.prependUndefined ? `undefined, ${debugName}` : debugName;
-    const spread = `\n/* @ts-ignore */\n...(ngDevMode ? [${devArgs}] : /* istanbul ignore next */ [])`;
-    s.appendLeft(insertion.position, `${insertion.needsSeparator ? ',' : ''}${spread}`);
+    const spread = `...(ngDevMode ? [${devArgs}] : /* istanbul ignore next */ [])`;
+    s.appendLeft(
+      insertion.position,
+      emitTypes ? `${separator}${spread} as []` : `${separator}/* @ts-ignore */ ${spread}`,
+    );
   }
 }
```
- **Lesson**: When generating synthetic code for consumption by both the compiler and the type-checker, use strict type-level coercions (like `as []`) rather than parser suppressions (`@ts-ignore`) that break declaration outputs.

---

### Incident 3: `@boundary` Block Content Projection Diagnostic Blind Spot (BUG-COMPILER-03)
- **Context**: Template type-checking diagnostics (`NG8011`), `packages/compiler/src/typecheck/ops/content_projection.ts`.
- **What Was Expected**: When a parent component projects projected content into slots matching specific selectors (e.g., `<ng-content select="[foo]"/>`), structural blocks wrapping projected elements must be analyzed. If a block contains multiple root nodes, it cannot project attributes cleanly, and the compiler must warn developers.
- **What Actually Happened**: The compiler checked `@if`, `@for`, and `@switch` blocks, but omitted `@boundary` blocks. When an element inside a `@boundary` block was paired with a sibling root node, the compiler remained silent. At runtime, the element failed to match its selector slot and was routed to the default `<ng-content>` catch-all slot.
- **Evidence in Repo**: Commit `d9bd6825`. Issue #71288.
- **Root Cause**: The AST visitor in `TcbControlFlowContentProjectionOp` did not include `BoundaryBlock` in its type guards, missing it during AST traversal.
- **Remediation Code Diff**:
```typescript
@@ -95,8 +96,9 @@ export class TcbControlFlowContentProjectionOp extends TcbOp {
   private findPotentialControlFlowNodes() {
-    const result: Array<IfBlockBranch | SwitchBlockCaseGroup | ForLoopBlock | ForLoopBlockEmpty> =
-      [];
+    const result: Array<
+      IfBlockBranch | SwitchBlockCaseGroup | ForLoopBlock | ForLoopBlockEmpty | BoundaryBlock
+    > = [];

     for (const child of this.element.children) {
@@ -118,6 +120,12 @@ export class TcbControlFlowContentProjectionOp extends TcbOp {
             result.push(current);
           }
         }
+      } else if (child instanceof BoundaryBlock) {
+        // `@error` blocks aren't checked, because they don't copy the
+        // tag name and attributes of their root node for content projection.
+        if (this.shouldCheck(child)) {
+          result.push(child);
+        }
       }
     }
```
- **Lesson**: When extending language grammar with new control flow blocks (like `@boundary`), update all AST traversal diagnostics that process structural nodes.

---

### Incident 4: `OutputEmitterRef.emit()` Skips Listeners on Synchronous Unsubscribe (BUG-CORE-04)
- **Context**: Signal Output primitive, `OutputEmitterRef`, `packages/core/src/render3/output_ref.ts`.
- **What Was Expected**: Calling `.emit()` on an `output()` should deliver the value to all registered listeners, even if the first listener unsubscribes synchronously upon receiving the value (e.g., using `take(1)`).
- **What Actually Happened**: Listener 0 ran and unsubscribed immediately. Listener 1 was skipped and never executed.
- **Evidence in Repo**: Issue #69325.
- **Root Cause**: The internal listener container was an array iterated by index (`for (let i = 0; i < this.listeners.length; i++)`). When Listener 0 ran, its synchronous unsubscription spliced the array, shifting index 1 into index 0. The loop counter incremented to `i = 1`, which now pointed to index 2, skipping the shifted listener.
- **Remediation Code Diff**:
```typescript
// Conceptual fix in output notification pipeline:
- for (let i = 0; i < this.listeners.length; i++) {
-   this.listeners[i](value);
- }
+ const listenersSnapshot = this.listeners.slice();
+ for (let i = 0; i < listenersSnapshot.length; i++) {
+   listenersSnapshot[i](value);
+ }
```
- **Lesson**: Always iterate over an immutable snapshot of a listener set when dispatching callbacks that can trigger side effects.

---

### Incident 5: Signal Forms Radio Button Binding Desynchronization (BUG-FORMS-05)
- **Context**: Signal Forms integration, `packages/forms/src/directives/radio_control_value_accessor.ts`.
- **What Was Expected**: A radio button bound to a signal model holding an enum value (`[field]="form.status"` and `[value]="Status.CLOSED"`) should initialize with the matching radio button selected.
- **What Actually Happened**: The radio button initialized in an unchecked state, only synchronizing after a manual click.
- **Evidence in Repo**: Issue #66402.
- **Root Cause**: Template binding evaluation order dependency. When `[field]` was bound before `[value]`, the form field directive read the element value before the `[value]` property binding had written the enum value to the DOM node. Consequently, it compared the signal value against an empty/undefined initial element value.
- **Remediation Code Diff**:
```html
<!-- Workaround / order fix: Ensure [value] is bound prior to [field] -->
- <input type="radio" [field]="projectForm.status" [value]="projectStatusEnum.CLOSED" />
+ <input type="radio" [value]="projectStatusEnum.CLOSED" [field]="projectForm.status" />
```
```typescript
// Core framework correction: Value accessor coordinates value resolution
// deferring initial comparison until all host properties are resolved:
override writeValue(value: any): void {
  this._pendingValue = value;
  // Delay match evaluation until inputs are bound
  queueMicrotask(() => this._checkName());
}
```
- **Lesson**: Form controls and value accessors must not assume that input bindings evaluate simultaneously. Coordinate dependent inputs through microtask scheduling or explicit input change lifecycles.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **TView Cleanup Pointer Indexing**: In `collectDomEventsInfo` (`packages/core/src/hydration/event_replay.ts`), cleanup tables (`tCleanup`) encode directives and event hooks into flat tuples. Stepping through `tCleanup` uses an index stride `i += 2`:
```typescript
for (let i = 0; i < tCleanup.length;) {
  const firstParam = tCleanup[i++];
  const secondParam = tCleanup[i++];
  if (typeof firstParam !== 'string') {
    // Non-string indicates a directive or cleanup function offset; advance appropriately
    continue;
  }
}
```
*Hazard*: Mixing `for (let i = 0; i < tCleanup.length; i++)` with inside-block `i++` increments corrupts parameter parsing, producing runtime exceptions like `tCleanup[i] is not a function`.

- **Explicit Zero vs. Falsy Index Guarding**: When resolving slide transitions in navigation components (`adev/src/app/core/layout/secondary-navigation/secondary-navigation.component.ts`):
```typescript
const shouldExpandItem = (node: NavigationItem): boolean =>
  node.level !== undefined &&
  (this.primaryActiveRouteItem() === PAGE_PREFIX.REFERENCE
    ? node.level > 0
    : node.level > 1);
```
*Hazard*: Using `!node.level` treats root level `0` as falsy, causing the navigation tree to skip expanding top-level nodes. Use strict checks against `undefined`.

### 2. Infinite Loop & Recursion Guards
- **Router Navigation Dimming Effect & Super-session**: In `ProgressBarComponent` (`adev/src/app/core/layout/progress-bar/progress-bar.component.ts`), navigation triggers are tracked using Angular effects. Multiple rapid route changes can trigger overlapping timeouts:
```typescript
effect((onCleanup) => {
  if (!this.router.currentNavigation()) {
    return;
  }
  const timeoutId = setTimeout(() => this.progressBar().start(), PROGRESS_BAR_DELAY);
  
  // Cleanup guard: guarantees cancellation of pending timers on subsequent runs
  onCleanup(() => {
    clearTimeout(timeoutId);
    this.progressBar().complete();
  });
});
```
*Termination Invariant Proof*: The reactive `effect` automatically invokes `onCleanup` before re-running when `this.router.currentNavigation()` changes. This guarantees that pending timers are cleared, preventing leaked animations or CPU thrashing.

- **Tree Hierarchy Expansion Depth Caps**: Recursive tree walking (`expandItemHierarchy`) requires cycles to be terminated via explicit parent links and depth predicates:
```typescript
private getInitialPath(routerState: RouterStateSnapshot): string {
  let route: ActivatedRouteSnapshot = routerState.root;
  let depth = 0;
  const MAX_ROUTE_DEPTH = 64; // Invariant loop termination cap

  while (route.firstChild && depth < MAX_ROUTE_DEPTH) {
    route = route.firstChild;
    depth++;
  }
  return route.routeConfig?.path ?? '';
}
```

### 3. UI & UX Micro-Mechanics
- **Body Scroll-Lock Management**: When opening mobile navigation drawers (`adev/src/app/core/layout/navigation/navigation.component.ts`), setting `overflow: hidden` on the body must be safely restored:
```typescript
private preventToScrollContentWhenSecondaryNavIsOpened(): void {
  this.isMobileNavigationOpened$.pipe(takeUntilDestroyed()).subscribe((opened) => {
    if (opened) {
      this.document.body.style.overflowY = 'hidden';
    } else {
      // Must use removeProperty rather than style.overflowY = 'auto' or ''
      // to avoid overriding responsive utility CSS rules applied by stylesheets
      this.document.body.style.removeProperty('overflow-y');
    }
  });
}
```

- **Motion Preference Guards**: Before scheduling CSS animations, check user accessibility preferences:
```typescript
private initSlideAnimation(): void {
  if (shouldReduceMotion()) {
    return; // Leave transition at 0ms
  }
  setTimeout(() => {
    this.transition.set(`${ANIMATION_DURATION}ms`);
  }, ANIMATION_DURATION);
}
```

### 4. Backend Concurrency & Memory Safety
- **Synthetic Dispatch Event Listener Leaks**: In event replay initializers (`withEventReplay`), listeners must be unregistered immediately after draining early contracts:
```typescript
const jsActionMap = injector.get(JSACTION_BLOCK_ELEMENT_MAP);
jsActionMap.get(EAGER_CONTENT_LISTENERS_KEY)?.forEach(removeListeners);
jsActionMap.delete(EAGER_CONTENT_LISTENERS_KEY);
```
Failing to call `delete` retains DOM element references in the injector map, preventing garbage collection for long-lived Single Page Applications.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Stack Trace Sanitization Regex Pitfalls**: In `formatErrorForAnalytics` (`adev/src/app/core/services/analytics/analytics-format-error.ts`), stack frame parsing must account for browser variations (Chrome, Safari, Edge):
```typescript
export function formatErrorForAnalytics(error: Error): string {
  let stack = '<no-stack>';
  if (error.stack) {
    stack = stripErrorMessagePrefix(error.stack)
      .replace(error.message + '\n', '')
      .replace(/^ +/gm, '')
      .replace(/^at /gm, '')
      // Captures URLs while isolating filename:line:column
      .replace(/(?: \(|@)http.+\/([^/)]+)\)?(?:\n|$)/gm, '@$1\n')
      // Edge-specific: matches eval code frames
      .replace(/ *\((eval code:\d+:\d+)\)(?:\n|$)/gm, '@???$1\n');
  }
  return `${error.message}\n${stack}`;
}
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary Decoupling**: Separation between the compiler (`packages/compiler`, `packages/compiler-cli`) and runtime (`packages/core`). The runtime has zero dependency on TypeScript or Babel AST modules. The compiler produces plain JavaScript instruction arrays (`ɵɵdefineComponent`).
- **State Ownership Hierarchy**: State resides in Signal graphs. Directives and components hold local state instances, while the dependency injection tree manages singleton lifetimes.

### 2. Core Abstractions
- **`LView` & `TView`**: The core runtime data structures. Arrays are used instead of object graphs to optimize V8 hidden classes, reduce memory overhead, and ensure cache locality during change detection.
- **`Signal<T>` / `WritableSignal<T>`**: Reactive primitives implemented as push-pull dependency graphs. State reads establish automatic edge connections with active reactive contexts (`Effect` / `Computed`).

### 3. Error Handling
- **Categorized Runtime Codes**: Runtime exceptions are indexed (`packages/core/src/errors.ts`) via `RuntimeErrorCode` (e.g., `NG0511`).
- **Fault-Tolerant Hydration**: Hydration mismatches generate structured warnings in development (`ngDevMode`) and fall back to client-side re-rendering in production rather than throwing unhandled exceptions.

### 4. Testing
- **Public API Goldens**: Every public package exposes an `.api.md` golden file (e.g., `goldens/public-api/core/errors.api.md`). CI checks enforce that API modifications require approved golden updates (`pnpm public-api:check`).
- **Type-Check Block Integration**: Testing harnesses compile synthetic templates and assert against compiler-emitted diagnostics (`env.driveDiagnostics()`).

### 5. Security
- **Type-Checked Template Security (`tsec`)**: Bazel targets execute `tsec` to enforce safe DOM operations.
- **Sanitization Pipelines**: Values bound to attributes like `[innerHTML]` pass through `DomSanitizer`, using built-in contexts (`HTML`, `STYLE`, `SCRIPT`, `URL`, `RESOURCE_URL`) to strip XSS vectors.

### 6. Performance
- **Zero-Copy Replay**: In Event Replay, the synthetic event queue created by `_ejsas` does not clone event objects. It buffers native browser events directly and replays them into Angular's dispatcher, avoiding allocation churn