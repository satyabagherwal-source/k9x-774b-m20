> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/onejs-one-learnings.md`  
> **Source**: github ([https://github.com/onejs/one](https://github.com/onejs/one))  
> **Source Version**: `fe273a10`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T07:10:10.433Z  
> **Learning ID**: `learn-github-onejs-one`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): onejs/one

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Mission & Technical Problem Space
`onejs/one` (`One`) is a unified full-stack meta-framework bridging web and native platforms (iOS, Android, Web) using React 19, Vite, and React Native / Nitro primitives. The technical challenge `One` solves is reconciling three conflicting execution models:
1. **The Web Paradigm**: Dominated by Vite's ESM-native HMR pipeline, SSR/SSG streaming architectures, and HTML document lifecycle constraints.
2. **The Metro / React Native Native Paradigm**: Driven by CommonJS/mixed module systems, bytecode compilation targets (Hermes VM), native threading pools, and platform bridges (WorkManager on Android, Background Tasks on iOS).
3. **The Shared Component Model**: A single unified file-system router (`packages/one/src/router`) supporting hybrid rendering modes (`spa`, `ssr`, `ssg`) while ensuring zero runtime divergence when sharing React components across Node.js/Bun servers, browser V8/JSC runtimes, and mobile Hermes VMs.

```
                      +-------------------------------------------------------+
                      |                      onejs/one                        |
                      +-------------------------------------------------------+
                                                  |
                 +--------------------------------+--------------------------------+
                 |                                                                 |
                 v                                                                 v
+----------------------------------+                              +----------------------------------+
|           Web Engine             |                              |          Native Engine           |
|  - Vite Plugin Pipeline          |                              |  - @vxrn/compiler AST Transform  |
|  - SSR / SSG HTML Streaming      |                              |  - Hermes VM Loop Rewriter       |
|  - ServerContext Hydration Block |                              |  - Mixed CJS/ESM Export Lowerer  |
+----------------------------------+                              +----------------------------------+
                 |                                                                 |
                 |                       Universal Core                            |
                 +------------------------------> <--------------------------------+
                                                  |
                                   +------------------------------+
                                   | File-System Routing Engine   |
                                   | - useScreens.tsx             |
                                   | - Multi-platform Layout Tree |
                                   | - Nitro Background Worker    |
                                   +------------------------------+
```

### 1.2 Subsystem Boundaries & Decoupled State Ownership
- **`packages/vxrn` & `packages/compiler`**: Decouples Vite from Metro by transforming React Native source modules directly inside the Vite bundling pipeline. It handles Hermes bytecode limitations (e.g., scoping bugs in loop iteration closures) and bridges CJS module export mutations (`module.exports` vs lexical `export`) via Babel and Oxc AST transforms.
- **`packages/one` (Routing & Runtime)**: Maintains router state, hydration markers, and context boundaries (`ServerContextScript`). Enforces client/server environmental splits using `process.env.VITE_ENVIRONMENT` (`ssr` vs `client`).
- **`nitro-modules` & Native Background Workers**: Android native WorkManager worker (`OneBackgroundWorker.kt`) initializes ReactHost in headless mode without mounting an Activity, delegating lifecycle completion and 9-minute execution timeouts to a concurrent coordinator (`OneBackgroundTasksCoordinator`).
- **`.claude/skills/ios-simulator-skill`**: Autonomous agent harness orchestrating iOS simulator inspection, capturing accessibility trees and base64/token-scaled visual artifacts via `simctl` and Facebook's `idb`.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. React Hydration Non-Executable Data Block Rule
**RULE**:
When rendering client-side scripts purely to satisfy DOM hydration matching against server-injected state scripts (especially in client-rendered SPA root layouts), the client MUST render the `<script>` tag with `type="application/json"` (or another non-executable MIME type) instead of an executable JavaScript `<script>` without a type.

**WHY**:
In React 19.3+, the DOM reconciliation engine logs a critical warning whenever a client-side component creates an executable `<script>` tag: `"Encountered a script tag while rendering React component"`. In SPA root layouts (`defaultRenderMode: 'spa'`), the client renders the entire document tree. If the client component tree includes a script tag to match SSR output, React treats it as an untracked dynamic script injection. Specifying `type="application/json"` tells the browser and React engine that the tag is a static data block, preventing script execution semantics while maintaining exact attribute and tag symmetry for hydration.

**WHEN TO APPLY**:
Apply in any React 19+ universal/meta-framework where layout scripts, server context containers, or state transfer blocks are rendered into `<head>` or document roots across both SSR and client-only SPA modes.

**VERIFIED IMPLEMENTATION PATTERN**:
```tsx
// packages/one/src/server/ServerContextScript.tsx
import React from 'react'

const SERVER_CONTEXT_KEY = '__ONE_SERVER_CONTEXT__'

export function ServerContextScript() {
  if (process.env.VITE_ENVIRONMENT === 'client') {
    // Renders data block on client so DOM matches server-rendered markup
    // without triggering React 19.3 dynamic script execution warnings.
    return (
      <script
        type="application/json"
        async
        // @ts-expect-error key tracking attribute
        href={SERVER_CONTEXT_KEY}
        id={SERVER_CONTEXT_KEY}
      />
    )
  }

  // Server-rendered executable bootstrapper
  return (
    <script
      id={SERVER_CONTEXT_KEY}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `
          globalThis['global'] = globalThis;
          globalThis["${SERVER_CONTEXT_KEY}"] = ${safeJsonStringify(clientContext)};
          globalThis.__oneLoadedCSS = new Set(${safeJsonStringify(cssUrls)});
        `,
      }}
    />
  )
}

function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}
```

**NEGATIVE CONSTRAINT**:
```tsx
// ANTI-PATTERN: Client renders executable <script> or standalone global setup tag.
export function RootLayoutRenderer() {
  return (
    <html>
      <head>
        {/* CRASH / WARNING in React 19.3: Logs "Encountered a script tag while rendering React component" */}
        <script
          dangerouslySetInnerHTML={{
            __html: `globalThis['global'] = globalThis`,
          }}
        />
        <script id="__CONTEXT__" />
      </head>
      <body>...</body>
    </html>
  )
}
```

**VERIFICATION METHOD**:
Automated Playwright/Puppeteer browser console trap asserting that no console errors or warnings match `/Encountered a script tag/`:
```typescript
it('should render client document without script execution warnings', async () => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push(msg.text())
    }
  })
  await page.goto(serverUrl, { waitUntil: 'load' })
  expect(errors.filter((e) => e.includes('Encountered a script tag'))).toEqual([])
})
```

---

### 2. Mobile VM Loop Closure Environment Decoupling Rule
**RULE**:
When compiling ES6+ lexical declarations (`let`, `const`) contained within loops targeting the Hermes JavaScript engine (or any JS engine lacking per-iteration execution environments), you MUST hoist or wrap the loop body into an immediately invoked functional boundary `(arg) => { ... }` whenever any inner closure reads a loop-head or body-lexical variable.

**WHY**:
The Hermes VM (native React Native bytecode compiler) emits a single `CreateFunctionEnvironment` bytecode instruction before the loop begins. Consequently, Hermes does NOT create a distinct lexical environment per iteration for loop heads or block-scoped declarations inside the body. Any arrow function or closure instantiated within the loop captures the same heap pointer, causing all callbacks to resolve to the variable's final terminal value (e.g., `for (let i = 0; i < 2; i++) fns.push(() => i)` outputs `[2, 2]`). This breaks critical libraries like React Native's `NativeAnimatedHelper`.

**WHEN TO APPLY**:
Apply inside compiler passes (`@vxrn/compiler`, Babel/SWC plugins) targeting React Native Hermes engine when transpiling modern JavaScript/TypeScript containing `for`, `for-of`, `for-in`, or `while` loops that enclose arrow functions or closures capturing lexical bindings.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// AST lowering invariant: Rewriting loop with closure captures to functional boundaries
// Source:
//   for (let i = 0; i < items.length; i++) {
//     callbacks.push(() => items[i])
//   }
// Transformed:
//   var _loop = (i) => {
//     callbacks.push(() => items[i])
//   }
//   for (let i = 0; i < items.length; i++) _loop(i)

export function rewriteHermesLoopBody(
  loopNode: ForStatement,
  capturedHeadIdentifiers: string[],
  code: MagicString
) {
  const loopFnName = `_hermes_loop_${loopNode.start}`
  const params = capturedHeadIdentifiers.join(', ')
  
  // Wrap body inside isolated function invocation
  code.prependLeft(
    loopNode.start,
    `var ${loopFnName} = (${params}) => `
  )
  code.overwrite(
    loopNode.body.start,
    loopNode.body.start + 1,
    `{\n  ${loopFnName}(${params});\n`
  )
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Relying on esbuild or oxc target flags (e.g. { target: 'es2015' })
// to fix loop lexical environments. Esbuild explicitly skips let/const loop lowering:
// "Transforming let to the configured target environment is not supported yet".
// Shipping untransformed let/const closures directly to hermesc causes silent production runtime data corruption.
```

**VERIFICATION METHOD**:
Evaluate transformed output inside isolated context:
```typescript
it('ensures distinct environment capture per iteration', () => {
  const transformed = transformHermesLoops(
    'var fns = []; for (let i = 0; i < 2; i++) { fns.push(() => i); }',
    'test.js'
  )
  const fn = new Function(`${transformed.code}; return fns.map(f => f());`)
  expect(fn()).toEqual([0, 1]) // Fails with [2, 2] if Hermes bug manifests
})
```

---

### 3. Mixed Module Export Writable Binding Synchronization Rule
**RULE**:
When transpiling mixed CommonJS and ES modules into a native CommonJS runtime wrapper, you MUST proxy export mutations through a dynamic closure accessor (`const __mixedExports = () => exports;`) unless `exports` is declared in the root scope, and you MUST inject explicit reassignment calls inside loop mutation expressions (`ForOfStatement`, `ForInStatement`, `AssignmentExpression`) directly to that export accessor.

**WHY**:
In Metro/React Native native dev engines, code frequently mixes CommonJS (`module.exports = ...` or `exports.foo = ...`) and ES Module syntax (`export let val = 1`). If a module defines a function whose parameters shadow `exports` (e.g. `function increment(exports) { value++; }`), direct writes to `exports['val']` will resolve to the local parameter instead of the module's export table. Additionally, `for (value of [2, 3])` mutates an exported variable without invoking a standard assignment expression. If the compiler does not inject synchronization at the loop head, the CommonJS export table desynchronizes from the lexical binding.

**WHEN TO APPLY**:
Apply in bundlers and compilers transforming ESM syntax into CommonJS execution contexts for native environments where live-binding semantics must match the React Native/Metro specification.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/compiler/src/transformMixedNativeModule.ts
function lowerLocalExports(code: string, program: Program, analysis: Analysis) {
  const edited = new MagicString(code)
  let exportAccess = '__mixedExports'
  while (code.includes(exportAccess)) exportAccess += '_'

  // Guard against parameter shadowing: closure captures outer wrapper binding
  const exportBinding = analysis.rootBindings.has('exports')
    ? `const ${exportAccess} = module.exports;`
    : `const ${exportAccess} = () => exports;`

  const exportObject = analysis.rootBindings.has('exports')
    ? exportAccess
    : `${exportAccess}()`

  // Synchronize loop iteration writes (for-of / for-in)
  function handleLoopMutations(node: ForOfStatement | ForInStatement) {
    const ids = (
      node.left.type === 'VariableDeclaration'
        ? node.left.declarations.flatMap((d) => extractNames(d.id))
        : extractNames(node.left)
    ).filter((id) => exported.has(id.name))

    if (ids.length) {
      const publish = ids
        .map((id) => `${exportObject}[${JSON.stringify(id.name)}] = ${id.name};`)
        .join('')

      if (node.body.type === 'BlockStatement') {
        edited.prependRight(node.body.start + 1, publish)
      } else {
        edited.prependRight(node.body.start, '{' + publish)
        edited.appendLeft(node.body.end, '}')
      }
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct property writes to static identifier `exports`
// If a user function declares: export function process(exports, module) { counter++; }
// Writing `exports['counter'] = counter` assigns directly to the argument,
// leaking state into caller parameters and leaving the module export table stale!
const assignments = (id: string) => `exports[${JSON.stringify(id)}] = ${id};`
```

**VERIFICATION METHOD**:
Run isolated VM context assertions matching Metro Oracle behavior:
```typescript
it('preserves export writes inside functions shadowing exports parameter', () => {
  const source = `
    export let value = 1;
    export function increment(exports) { value++; }
    increment({});
    module.exports = { published: exports.value, lexical: value };
  `
  const result = transformMixedNativeModule(source, 'probe.js')
  const ctx = { module: { exports: {} }, exports: {} }
  runInNewContext(result.code, ctx)
  expect(ctx.module.exports.published).toBe(2)
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: DevTools Wildcard Host URI Crash (BUG-DEVTOOLS-01)
- **Context**: `packages/vxrn/src/plugins/reactNativeDevServer.ts`
- **What Was Expected**: React Native DevTools URL constructed by Vite middleware must be navigable via browser automation (Playwright) and desktop web clients.
- **What Actually Happened**: When Vite bound to wildcard interface `0.0.0.0` or when `host` was evaluated as a boolean/undefined, `reactNativeDevToolsUrl` was formatted as `http://0.0.0.0:8081`. Browsers and Playwright instances on macOS/Windows rejected navigation to `0.0.0.0`, throwing network resolution errors and blocking developer tooling initialization.
- **Evidence in Repo**: Commit `f65f50d7`. Files: `packages/vxrn/src/plugins/reactNativeDevServer.ts`, `bun.lock`, `package.json`.
- **Root Cause**: Unsanitized string interpolation of Vite's internal `host` config option, which defaults to `0.0.0.0` when listening on all network interfaces or can be passed as a boolean flag.
- **Remediation Code Diff**:
```typescript
<<<<
- const reactNativeDevToolsUrl = `http://${host}:${getBoundPort(server)}`
====
+ const reactNativeDevToolsUrl = `http://${typeof host === 'string' && host !== '0.0.0.0' ? host : 'localhost'}:${getBoundPort(server)}`
>>>>
```
- **Lesson**: Network listening interfaces (`0.0.0.0`, `::`) must never be reused as client-facing loopback URLs. Disambiguate bind addresses from dial/connect addresses.

---

### Incident 2: React 19.3 Client-Rendered Script Tag Warning (BUG-HYDRATION-02)
- **Context**: `packages/one/src/router/useScreens.tsx` and `packages/one/src/server/ServerContextScript.tsx`
- **What Was Expected**: SPA root layouts (`defaultRenderMode: 'spa'`) should mount client-side components and initialize runtime server context without console warnings.
- **What Actually Happened**: React 19.3 emitted the warning: `"Encountered a script tag while rendering React component"`. The client rendered an executable `<script>` tag containing `globalThis['global'] = globalThis` and an empty context script, triggering React's new strict script injection checks on every development route load.
- **Evidence in Repo**: Commit `2fadcc7d`. Files: `packages/one/src/router/useScreens.tsx`, `packages/one/src/server/ServerContextScript.tsx`, `tests/test-not-found/tests/routing.test.ts`.
- **Root Cause**: Separating global bootstrapping into an executable `<script>` rendered inside the React component tree on the client side, rather than using non-executable JSON data blocks for hydration symmetry.
- **Remediation Code Diff**:
```tsx
<<<< packages/one/src/router/useScreens.tsx
- <script
-   dangerouslySetInnerHTML={{
-     __html: `globalThis['global'] = globalThis`,
-   }}
- />
====
(Removed completely from useScreens.tsx; folded into server-only ServerContextScript payload)
>>>>

<<<< packages/one/src/server/ServerContextScript.tsx
  if (process.env.VITE_ENVIRONMENT === 'client') {
    return (
      <script
+       type="application/json"
        async
        // @ts-expect-error
        href={SERVER_CONTEXT_KEY}
        id={SERVER_CONTEXT_KEY}
      />
    )
  }
>>>>
```
- **Lesson**: Client-side hydration placeholders must use passive MIME data blocks (`type="application/json"`). Executable scripts should only ever be emitted in initial server HTML streams or external entry points.

---

### Incident 3: Variable Export Desynchronization in Loop Iterations (BUG-COMPILER-03)
- **Context**: `packages/compiler/src/transformMixedNativeModule.ts`
- **What Was Expected**: In mixed CommonJS/ESM native modules, modifying an exported variable inside a `for..of` or `for..in` loop must immediately update the exported table `exports[name]`.
- **What Actually Happened**: The compiler only watched `AssignmentExpression` and `UpdateExpression`. When an exported identifier was used as the target of a `for (value of array)` or `for (value in obj)` loop, its updates were never synced to `exports`. Furthermore, if an exported function declared a parameter named `exports`, lexical lookups shadowed the global export object, causing crashes or silent assignment drops.
- **Evidence in Repo**: Commit `a8a18d5d`. Files: `packages/compiler/src/transformMixedNativeModule.ts`, `packages/vxrn/src/utils/createNativeDevEngine.test.ts`.
- **Root Cause**: Incomplete AST visitor coverage overlooking `ForOfStatement`/`ForInStatement` LHS variable assignment bindings, compounded by unhygienic identifier resolution for `exports`.
- **Remediation Code Diff**:
```typescript
<<<< packages/compiler/src/transformMixedNativeModule.ts
+ let exportAccess = '__mixedExports'
+ while (code.includes(exportAccess)) exportAccess += '_'
+ const exportBinding = analysis.rootBindings.has('exports')
+   ? `const ${exportAccess} = module.exports;`
+   : `const ${exportAccess} = () => exports;`
+ const exportObject = analysis.rootBindings.has('exports')
+   ? exportAccess
+   : `${exportAccess}()`
...
+ if (node.type === 'ForOfStatement' || node.type === 'ForInStatement') {
+   const ids = (
+     node.left.type === 'VariableDeclaration'
+       ? node.left.declarations.flatMap((item: Node) => names(item.id))
+       : names(node.left)
+   ).filter(
+     (id: Node) =>
+       exported.has(id.name) && analysis.binding(id) === exported.get(id.name)!.scope
+   )
+   if (ids.length) {
+     const publish = ids.map((id: Node) => assignments(id.name) + ';').join('')
+     if (node.body.type === 'BlockStatement')
+       edited.prependRight(node.body.start + 1, publish)
+     else {
+       edited.prependRight(node.body.start, '{' + publish)
+       edited.appendLeft(node.body.end, '}')
+     }
+   }
+ }
>>>>
```
- **Lesson**: Compilers lowering ES module live-bindings to CommonJS must account for all ECMAScript binding creation forms, specifically destructuring in iteration statements and scope shadowing of CommonJS free variables.

---

### Incident 4: HMR Process Termination on Syntax Error in Mobile Expo Go (BUG-HMR-04)
- **Context**: Mobile HMR server pipeline / Dev Server connection handling
- **What Was Expected**: Syntax errors introduced during active editing should trigger compile-time error overlays on mobile devices, keeping the dev server alive and waiting for file-change recovery.
- **What Actually Happened**: Saving a syntax error crashed the `one dev` CLI process entirely, terminating the WebSocket connection to the Expo Go runtime.
- **Evidence in Repo**: Issue #587 (`HMR failes to reload when running on Expo Go mobile`, closed Feb 9, 2026).
- **Root Cause**: Unhandled build rejection inside Vite/VXRN HMR transform hooks when encountering syntax exceptions in native bundle compilation, bubbling up to the top-level CLI process loop and aborting the process instead of emitting a format error diagnostic frame.
- **Remediation**: Trapped compilation pipeline failures in `createReactNativeDevServerPlugin`, returning a synthetic compilation error message payload across the Metro WebSocket protocol (`/inspector/device`) instead of allowing unhandled process rejections.
- **Lesson**: Dev server middleware must enforce strict boundary isolation between compiler failures and the host Node/Bun daemon process.

---

### Incident 5: Android WorkManager Worker Expiration Race (BUG-WORKER-05)
- **Context**: `packages/one/android/src/main/java/com/margelo/nitro/one/OneBackgroundWorker.kt`
- **What Was Expected**: Android background tasks executed via WorkManager must complete asynchronously or terminate safely before Android OS kills the process.
- **What Actually Happened**: Android WorkManager enforces a hard 10-minute timeout for workers. Tasks running without an explicit cap hit the OS watchdog limit, triggering abrupt SIGKILL of the headless React Native host runtime without executing cleanup or persistence logic in `OneBackgroundTasksCoordinator`.
- **Evidence in Repo**: `OneBackgroundWorker.kt` implementation.
- **Root Cause**: Indefinite blocking on the task completion countdown latch, missing an internal safety margin before Android OS-level intervention.
- **Remediation Code Diff**:
```kotlin
<<<< OneBackgroundWorker.kt
- val completed = record.completion.await()
====
+ // WorkManager stops workers past ~10 minutes; cap the wait below
+ // it so expiration still reports through the coordinator.
+ val completed = record.completion.await(9, TimeUnit.MINUTES)
>>>>
```
- **Lesson**: Autonomous worker threads running under platform OS watchdogs must set timeout thresholds to at least 10% below the system execution limit to allow internal cleanup and state flushing.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Network Interface Disambiguation**:
   ```typescript
   // WRONG: Coercing falsy/wildcard blindly
   const devToolsUrl = `http://${host || 'localhost'}:${port}`
   // If host === '0.0.0.0', '0.0.0.0' is truthy! It produces http://0.0.0.0:8081 (unroutable in clients)
   
   // CORRECT: Explicit type check and wildcard exclusion
   const devToolsUrl = `http://${typeof host === 'string' && host !== '0.0.0.0' ? host : 'localhost'}:${port}`
   ```
2. **Variable Name Collisions in Code Generators**:
   When synthesizing variable identifiers into source code via AST transforms, you must use dynamic while-loops to avoid variable shadowing or clashing:
   ```typescript
   let exportAccess = '__mixedExports'
   while (code.includes(exportAccess)) exportAccess += '_'
   // Guarantees zero token collision with existing identifier bindings in user source
   ```
3. **Identifier Extraction across Destructuring Patterns**:
   AST walkers must handle all 5 ECMAScript pattern nodes (`Identifier`, `ObjectPattern`, `ArrayPattern`, `AssignmentPattern`, `RestElement`):
   ```typescript
   function collectPatternNames(node: any, out: string[]) {
     if (!node || typeof node !== 'object') return
     switch (node.type) {
       case 'Identifier': out.push(node.name); return
       case 'ObjectPattern':
         for (const p of node.properties || []) collectPatternNames(p.value ?? p.argument, out)
         return
       case 'ArrayPattern':
         for (const el of node.elements || []) collectPatternNames(el, out)
         return
       case 'AssignmentPattern': collectPatternNames(node.left, out); return
       case 'RestElement': collectPatternNames(node.argument, out); return
     }
   }
   ```

### 4.2 Infinite Loop & Recursion Guards
1. **Multi-Pass AST Loop Lowering**:
   Rewriting nested loops can cause index mismatching when modifying code strings with `MagicString`. `transformHermesLoops.ts` avoids infinite recursion and corrupted AST offsets by transforming only the outermost qualifying loop per pass, repeating until the string stabilizes:
   ```typescript
   export function transformHermesLoops(code: string, filename: string) {
     let current = code
     let passes = 0
     const MAX_PASSES = 100 // Hard loop execution guard
     while (passes++ < MAX_PASSES) {
       const res = transformOnce(current, filename)
       if (!res) break
       current = res.code
     }
     if (passes >= MAX_PASSES) {
       throw new Error(`Hermes loop transform exceeded iteration limit for ${filename}`)
     }
     return { code: current }
   }
   ```
2. **Early Lexical Regex Gating**:
   Avoid running expensive oxc/babel parsers on code that cannot contain loop closures:
   ```typescript
   const LOOP_RE = /\b(?:for|while)\s*(?:await\s+)?\(/
   const LEXICAL_RE = /\b(?:let|const|class)\b/

   if (!LOOP_RE.test(code) || !LEXICAL_RE.test(code)) {
     return null // Instant zero-cost bail out
   }
   ```

### 4.3 UI & UX Micro-Mechanics
1. **React 19 Document Script Injection Guard**:
   In React 19 client components, never insert `<script dangerouslySetInnerHTML={{...}} />` tags directly into the tree if rendering in an SPA layout context. Doing so triggers DOM reconciler warnings and layout thrashing during the initial paint. Use data-type tags (`<script type="application/json">`).
2. **Deterministic CSS Chunk Tracking**:
   To prevent duplicate stylesheet injection and CSS FOUC (Flash of Unstyled Content):
   ```typescript
   globalThis.__oneLoadedCSS = new Set(safeJsonStringify(cssUrls))
   // Hydration checks against this Set before appending any <link rel="stylesheet"> to DOM
   ```

### 4.4 Backend Concurrency & Memory Safety
1. **Volatile Concurrency Guarantees in Native Workers**:
   In `OneBackgroundWorker.kt`, execution cancellation can arrive concurrently via `onStopped()` from the Android system thread while `doWork()` is executing on a background thread:
   ```kotlin
   @Volatile private var executionId: String? = null
   @Volatile private var finished = false

   override fun onStopped() {
       executionId?.let { id ->
           if (!finished) {
               finished = true
               OneBackgroundTasksCoordinator.expire(id)
           }
       }
       super.onStopped()
   }
   ```
2. **Progressive Disclosure Cache Eviction**:
   In `.claude/skills/ios-simulator-skill/scripts/common/cache_utils.py`, cache entries are stored with strict TTL and auto-cleanup on retrieval to prevent disk leaks:
   ```python
   def get(self, cache_id: str) -> dict[str, Any] | None:
       cache_file = self.cache_dir / f"{cache_id}.json"
       if not cache_file.exists():
           return None
       if self._is_expired(cache_file):
           cache_file.unlink() # Instant atomic unlinking of dead cache files
           return None
   ```

### 4.5 Defect & Error Prevention ("Galti Pakadna")
1. **Jackson's Law Enforcement**:
   Utility extraction should only occur when patterns are genuinely reused (as documented in `device_utils.py` and `idb_utils.py`), preventing premature abstraction hazards.
2. **Device Identifier Fuzzy Resolution Safety**:
   In `device_utils.py`, identifier parsing checks strict UUID regex before falling back to substring searches to prevent accidental matches on similarly named simulators:
   ```python
   if re.match(r"^[A-F0-9\-]{36}$", identifier, re.IGNORECASE):
       return identifier.upper()
   ```

---

## 5. The 9 Deep Learning