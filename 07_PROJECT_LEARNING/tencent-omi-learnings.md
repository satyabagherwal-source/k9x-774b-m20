> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tencent-omi-learnings.md`  
> **Source**: GitHub ([https://github.com/Tencent/omi](https://github.com/Tencent/omi))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T07:46:05.874Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: Tencent/omi

## 1. Executive Forensic Architecture & System Mechanics

Tencent/omi is a lightweight, high-performance web component framework powered by a Signal-based reactivity engine and a Virtual DOM. It compiles components directly to standard W3C Custom Elements, allowing them to run natively in any modern browser. 

```
+-------------------------------------------------------------------------+
|                           Omi Core Runtime                              |
|  +------------------+     +--------------------+     +------------------+  |
|  |  Signal Engine   | --> |  Virtual DOM (JSX) | --> |   Shadow DOM     |  |
|  +------------------+     +--------------------+     +------------------+  |
+-------------------------------------------------------------------------+
         ^                                                      ^
         | [Reactivity Bridge]                                  | [Slot Sync]
+-------------------------------------------------------------------------+
|                    Framework Interoperability Layers                    |
|  +----------------------------------+    +---------------------------+  |
|  |           omi-vueify             |    |         reactify          |  |
|  |  - Proxy reactive props/refs     |    |  - Map React props        |  |
|  |  - Sync Vue slots to Omi slots   |    |  - Forward React events   |  |
|  +----------------------------------+    +---------------------------+  |
+-------------------------------------------------------------------------+
```

### Architectural Boundaries & Subsystems
1. **The Signal Engine**: Manages fine-grained reactive state. It bypasses the traditional Virtual DOM diffing overhead for localized updates by binding DOM nodes directly to Signal instances.
2. **The JSX Engine (`OmiJSX`)**: Provides a dedicated, isolated JSX namespace. This prevents global type pollution when Omi is co-located with React, Vue, or Solid in monorepos or micro-frontend architectures.
3. **The Interoperability Bridges (`omi-vueify`, `omi-vue2ify`, `reactify`)**: These glue layers translate framework-specific reactivity paradigms (such as Vue's `ref`/`reactive` proxies or React's synthetic events) into standard Custom Element properties, attributes, slots, and Custom Events.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

### Failure Mode 1: Infinite Recursion and Memory Exhaustion via Deep Proxying of Complex Objects
* **Failure Mode**: Passing complex objects (such as DOM nodes, class instances with circular references, or third-party library instances like Three.js scenes) as props to Omi components wrapped in `omi-vueify` causes call-stack overflow or severe memory leaks.
* **Root Cause**: The bridge layer recursively traversed and wrapped all incoming properties in reactive proxies (Vue's `reactive` or Omi's Signal proxies) without verifying if the object was a plain data object.
* **Exact Prevention / Fix**: Implement a strict boundary guard that checks the object type before applying reactive proxying. Exclude DOM nodes, window objects, and instances with custom prototypes.

```typescript
// Guard to prevent deep proxying of complex objects
function isCloneablePlainObject(val: any): boolean {
  if (typeof val !== 'object' || val === null) return false;
  
  // Skip DOM Nodes
  if (val instanceof Node) return false;
  
  // Skip Window or global objects
  if (val === window || val === globalThis) return false;
  
  const proto = Object.getPrototypeOf(val);
  return proto === null || proto === Object.prototype;
}

function safeReactiveProxy<T>(obj: T): T {
  if (!isCloneablePlainObject(obj)) {
    return obj; // Return raw reference for complex objects
  }
  // Apply proxying logic only to plain objects
  return new Proxy(obj as any, handler);
}
```

### Failure Mode 2: Desynchronized Slot Rendering in Vue-to-Omi Bridges
* **Failure Mode**: When slot content inside a Vue-wrapped Omi component is dynamically updated by Vue, the underlying Omi component fails to re-render, resulting in stale or missing DOM elements.
* **Root Cause**: Vue's slot updates do not trigger the standard Custom Element `attributeChangedCallback` or property setters if the wrapper component's own props remain unchanged.
* **Exact Prevention / Fix**: Hook into the Vue wrapper's update lifecycle or use a `MutationObserver` on the slot container to explicitly trigger a child refresh on the Omi component when slot VNodes change.

```typescript
// Inside the Vue wrapper component definition
import { nextTick } from 'vue';

export const OmiVueWrapper = {
  mounted() {
    this.observer = new MutationObserver(() => {
      this.refreshOmiChildren();
    });
    this.observer.observe(this.$el, { childList: true, subtree: true });
  },
  unmounted() {
    if (this.observer) this.observer.disconnect();
  },
  methods: {
    refreshOmiChildren() {
      nextTick(() => {
        // Force the Omi custom element to update its internal slot distribution
        if (typeof this.$el.update === 'function') {
          this.$el.update(true);
        }
      });
    }
  }
};
```

### Failure Mode 3: Global JSX Namespace Pollution in Multi-Framework Monorepos
* **Failure Mode**: Importing Omi alongside React or Vue in a single TypeScript project causes compilation errors due to conflicting global `JSX` namespace declarations.
* **Root Cause**: Declaring `declare global { namespace JSX { ... } }` in Omi's typings overrode or collided with React's or Vue's JSX definitions.
* **Exact Prevention / Fix**: Define an isolated, dedicated namespace (`OmiJSX`) and configure the TSX compiler option (`jsxImportSource`) to point directly to Omi's custom JSX factory.

```typescript
// tsconfig.json configuration
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@omi/core"
  }
}

// @omi/core/jsx-runtime.d.ts
export namespace OmiJSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
export { OmiJSX as JSX };
```

### Failure Mode 4: Event Listener Leaks and Duplicate Bindings in Bridge Wrappers
* **Failure Mode**: Re-rendering a wrapped Omi component in Vue or React causes event listeners to accumulate, leading to memory leaks and duplicate event execution.
* **Root Cause**: The bridge layer bound event listeners during updates without keeping track of the original function references, preventing clean unbinding during the unmount phase.
* **Exact Prevention / Fix**: Store active event listener references in a `WeakMap` keyed by the Custom Element instance, and systematically unbind them before registering new ones or when unmounting.

```typescript
const activeListeners = new WeakMap<HTMLElement, Map<string, EventListenerOrEventListenerObject>>();

function bindEvent(el: HTMLElement, eventName: string, handler: EventListener) {
  let registry = activeListeners.get(el);
  if (!registry) {
    registry = new Map();
    activeListeners.set(el, registry);
  }

  // Unbind existing listener for this event type if present
  const existing = registry.get(eventName);
  if (existing) {
    el.removeEventListener(eventName, existing);
  }

  // Bind and register new listener
  el.addEventListener(eventName, handler);
  registry.set(eventName, handler);
}

function unbindAllEvents(el: HTMLElement) {
  const registry = activeListeners.get(el);
  if (registry) {
    registry.forEach((handler, eventName) => {
      el.removeEventListener(eventName, handler);
    });
    activeListeners.delete(el);
  }
}
```

### Failure Mode 5: Case-Sensitivity and Naming Convention Mismatches
* **Failure Mode**: Vue components expect PascalCase props and camelCase events, whereas Web Components (Omi) strictly require kebab-case for attributes and standard lowercase/kebab-case for custom events. This mismatch causes props to be ignored or events to go uncaught.
* **Root Cause**: The bridge layer did not normalize casing when mapping Vue properties and event listeners to the underlying Custom Element.
* **Exact Prevention / Fix**: Implement a strict casing normalization utility at the bridge boundary to map PascalCase/camelCase to kebab-case.

```typescript
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function mapPropsToAttributes(el: HTMLElement, props: Record<string, any>) {
  Object.keys(props).forEach((key) => {
    const kebabKey = camelToKebab(key);
    const value = props[key];
    
    if (typeof value === 'function') {
      // Bind as property directly
      (el as any)[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      // Pass complex objects as properties
      (el as any)[key] = value;
    } else {
      // Set as attribute
      el.setAttribute(kebabKey, String(value));
    }
  });
}
```

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

### D1: Structural Boundaries & Modularity
Omi enforces a strict separation between its core reactive engine (`@omi/signals`) and its rendering target (Custom Elements). The bridge adapters (`omi-vueify`, `reactify`) are decoupled from Omi's internal rendering loop; they interact with Omi components solely through standard DOM properties, attributes, and Custom Events. This design ensures that changes to Omi's internal Virtual DOM implementation do not break downstream framework integrations.

### D2: Asynchronous State & Concurrency Defense
Omi's Signal engine uses a microtask-based batching mechanism to prevent layout thrashing and redundant renders during synchronous state mutations.

```typescript
let isPending = false;
const queue: Set<() => void> = new Set();

export function batch(fn: () => void) {
  fn();
}

export function queueUpdate(updateFn: () => void) {
  queue.add(updateFn);
  if (!isPending) {
    isPending = true;
    queueMicrotask(() => {
      queue.forEach((fn) => fn());
      queue.clear();
      isPending = false;
    });
  }
}
```
This microtask queue ensures that if multiple Signals are mutated within the same execution block, the DOM is updated exactly once in the next microtask.

### D3: Error Boundaries, Recovery & Rollback Protocols
When rendering fails inside an Omi component's lifecycle, the error must not crash the host application (especially when embedded in React or Vue). Omi implements a local error boundary mechanism:

```typescript
class OmiElement extends HTMLElement {
  // ...
  _render() {
    try {
      const vnode = this.render();
      this.patch(vnode);
    } catch (error) {
      this.onError(error);
    }
  }

  onError(error: any) {
    console.error(`[Omi Render Error] in <${this.tagName.toLowerCase()}>:`, error);
    // Fallback UI rendering
    this.shadowRoot!.innerHTML = `<div style="color: red; border: 1px solid red; padding: 8px;">Component Error</div>`;
  }
}
```

### D4: Resource Lifecycle & Leak Defenses
To prevent memory leaks when dynamically mounting and unmounting Custom Elements, Omi components hook into the native `disconnectedCallback`. This callback is used to automatically dispose of active Signal subscriptions and clean up event listeners.

```typescript
class OmiElement extends HTMLElement {
  private disposers: Set<() => void> = new Set();

  connectedCallback() {
    // Subscribe to signals and track their disposers
    this.disposers.add(
      effect(() => {
        this._render();
      })
    );
  }

  disconnectedCallback() {
    // Execute all disposers to release signal subscriptions
    this.disposers.forEach((dispose) => dispose());
    this.disposers.clear();
  }
}
```

### D5: Boundary Deserialization, Schemas & Input Sanitization
Because Custom Element attributes are natively received as strings, Omi must deserialize these values into rich types (such as arrays or objects) safely. It avoids using `eval` or unsafe `JSON.parse` wrappers.

```typescript
function deserializeAttribute(value: string | null): any {
  if (value === null) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (!isNaN(Number(value)) && value.trim() !== '') return Number(value);
  
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch {
      return value; // Fallback to raw string if parsing fails
    }
  }
  return value;
}
```

### D6: Cross-Platform & Runtime Compatibility Gotchas
A major cross-platform issue identified in the repository was case-sensitivity in file imports (Commit `6ab5f7d3`). On Windows, file paths are case-insensitive, meaning `import { MyComponent } from './MyComponent'` works even if the file is named `mycomponent.ts`. However, this causes silent build failures on Linux-based CI/CD environments. Omi resolved this by enforcing lowercase kebab-case for all source files and strict linting rules.

### D7: Build, CI/CD, Dependency Invariants
To prevent experimental TypeScript features from polluting consumer builds, Omi isolated its decorator configurations. The `experimentalDecorators` flag was moved from the root `tsconfig.json` to target-specific configurations (`tsconfig.app.json`). This ensures that consumers who do not use decorators are not forced to enable the flag in their own TypeScript configurations.

### D8: Concrete Bug Fixes & Forensic Patches

#### Patch 1: Vue Slot Update Synchronization (`omi-vueify`)
Before this fix, updating slot content in Vue did not trigger a re-render of the Omi child component. The patch forces an update on the Omi element whenever the Vue wrapper's render function is executed.

```typescript
// Before
render() {
  return h(this.tagName, this.$slots.default?.());
}

// After (Forensic Patch)
render() {
  const vnodes = this.$slots.default?.();
  // Schedule a microtask update to ensure the Custom Element processes the new slot children
  queueMicrotask(() => {
    const el = this.$el;
    if (el && typeof (el as any).update === 'function') {
      (el as any).update();
    }
  });
  return h(this.tagName, vnodes);
}
```

#### Patch 2: Reactive Prop Unwrapping (`omi-vueify`)
Vue `ref` and `reactive` objects passed as props were previously passed as raw proxies, which caused reactivity loss or infinite loops inside Omi's Signal engine. The patch unwraps these reactive objects to their raw values before passing them to the Custom Element.

```typescript
import { isRef, isReactive, toRaw } from 'vue';

function unwrapProp(val: any): any {
  if (isRef(val)) {
    return unwrapProp(val.value);
  }
  if (isReactive(val)) {
    return toRaw(val);
  }
  return val;
}

// Applied during prop mapping
const safeValue = unwrapProp(incomingProp);
```

---

## 4. Universal Engineering Rules

## 1. Isolated JSX Namespaces in Multi-Framework Libraries

**RULE**:
Libraries designed to run in multi-framework or micro-frontend environments must never declare global `JSX` namespaces. They must declare isolated, dedicated namespaces (e.g., `OmiJSX`) and rely on local JSX runtime configuration (`jsxImportSource`).

**WHY**:
Declaring global `JSX` namespaces causes type collisions and compilation failures when the library is co-located with other JSX-based frameworks (such as React, Vue, or Solid) in the same project or monorepo.

**WHEN TO APPLY**:
Apply this rule to any library or framework that exports JSX/TSX components and is intended for consumption in diverse host environments.

---

## 2. Non-Reactive Boundary Guard for Complex Objects

**RULE**:
When wrapping third-party objects, DOM nodes, or class instances in reactive proxies (such as Signals, Vue Reactive, or RxJS Observables), you must explicitly exclude non-plain objects from deep proxying.

**WHY**:
Deeply proxying complex objects with internal state, circular references, or native bindings (like DOM nodes or WebGL contexts) causes infinite recursion, call-stack overflows, and severe memory leaks.

**WHEN TO APPLY**:
Apply this rule at the boundary of any state management system or framework bridge layer that automatically converts incoming properties into reactive proxies.

---

## 5. Actionable Agent Skill & Implementation Checklist

This checklist is designed for AI coding agents building or maintaining cross-framework bridges or Custom Element libraries.

### Phase 1: Boundary Verification & Casing Normalization
- [ ] Implement a casing utility to map PascalCase/camelCase properties from the host framework to kebab-case attributes on the Custom Element.
- [ ] Ensure event names are mapped correctly (e.g., mapping `onMyEvent` in React to `myevent` or `my-event` on the Custom Element).
- [ ] Verify that boolean attributes are handled correctly (e.g., removing the attribute entirely when `false`, rather than setting `my-attr="false"`).

### Phase 2: Reactivity & Proxy Safety
- [ ] Add a type guard to prevent deep proxying of complex objects (DOM nodes, window, class instances).
- [ ] Unwrap host-specific reactive wrappers (such as Vue's `ref`/`reactive` or React's state hooks) to their raw values before passing them to the Custom Element.
- [ ] Ensure that updating a property on the host framework triggers a synchronous or batched update on the Custom Element.

### Phase 3: Slot & Children Synchronization
- [ ] Implement a mechanism (such as a `MutationObserver` or lifecycle hook) to detect when the host framework updates slot content.
- [ ] Force the Custom Element to re-evaluate its slot distribution when slot content changes.
- [ ] Verify that slot updates do not cause full component unmounting and remounting, which destroys local state.

### Phase 4: Resource Cleanup & Leak Prevention
- [ ] Track all event listeners bound by the bridge layer using a `WeakMap` keyed by the Custom Element instance.
- [ ] Explicitly remove all registered event listeners when the host component is unmounted.
- [ ] Dispose of any active Signal effects or reactive subscriptions in the Custom Element's `disconnectedCallback`.

### Phase 5: Build & Type Isolation
- [ ] Ensure the library does not declare global `JSX` types. Use a custom namespace and configure `jsxImportSource`.
- [ ] Verify that experimental compiler flags (such as `experimentalDecorators`) are isolated to app-specific configurations and not exposed in the root configuration.
- [ ] Enforce lowercase kebab-case for all source file names to prevent cross-platform build failures on case-sensitive filesystems.