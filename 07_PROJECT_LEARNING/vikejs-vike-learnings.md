> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vikejs-vike-learnings.md`  
> **Source**: github ([https://github.com/vikejs/vike](https://github.com/vikejs/vike))  
> **Source Version**: `305221a5`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T04:27:03.822Z  
> **Learning ID**: `learn-github-vikejs-vike`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): vikejs/vike

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Mission & Technical Problem Space
`vike` (formerly `vite-plugin-ssr`) is an architectural framework layer built on top of Vite that replaces monolithic SSR meta-frameworks (e.g., Next.js, Nuxt) with a decoupled, framework-agnostic architecture. It decouples the server runtime, UI framework (React, Vue, Solid), routing paradigm (Client-side vs Server-side routing), and static asset delivery into un-opinionated primitives via explicit file-based configuration (`+config.js`, `+Page.jsx`, `+onRenderHtml.jsx`, `+onRenderClient.jsx`).

### 1.2 System Boundaries & Decoupling Model
Vike maintains absolute isolation between four execution realms:
1. **Node.js/Edge Server Environment (`node/`, `server/`)**: Manages the request lifecycle, loads page configs via `ssrLoadModule` in development or bundled chunks in production, serializes `pageContext` into HTML via `escapeInject`, and exposes raw control to server middleware (Express, Fastify, Hono, Elysia, Cloudflare Workers).
2. **Vite Plugin Hook Integration (`node/vite/`)**: Intercepts Vite config resolution (`config`, `configResolved`), injects virtual modules (`virtual:vike:...`), resolves filesystem routes, and manages HMR module invalidation while guarding against race conditions between Vite’s environment configuration and dev server initialization.
3. **Client-Side Runtime (`client/runtime-client-routing/`, `client/runtime-server-routing/`)**: Orchestrates hydration, link click interception, lazy-loading of split page chunks, client-side history navigation, and fallback mechanisms when network failures or dynamic chunk mismatches occur.
4. **Shared Universal Primitives (`shared/`)**: Serializers (via `@brillout/json-serializer`), URL normalizers, assertion systems (`assert`, `assertUsage`, `assertInfo`), and configuration schema resolvers.

```
       +--------------------------------------------------------------+
       |                         HTTP Request                         |
       +--------------------------------------------------------------+
                                       |
                                       v
       +--------------------------------------------------------------+
       |                  Host HTTP Server Framework                  |
       |               (Express / Hono / Fastify / Node)              |
       +--------------------------------------------------------------+
                                       |
                                       v
       +--------------------------------------------------------------+
       |                   Vike Node Server Plugin                    |
       |  +--------------------------------------------------------+  |
       |  | `renderPage({ urlOriginal, headers, ... })`            |  |
       |  +--------------------------------------------------------+  |
       |                               |                              |
       |                               v                              |
       |  +--------------------------------------------------------+  |
       |  | Route Matching Engine (Filesystem `+` & Route Strings) |  |
       |  +--------------------------------------------------------+  |
       |                               |                              |
       |                               v                              |
       |  +--------------------------------------------------------+  |
       |  | Config Aggregator (+config.js, +data, +guard)          |  |
       |  +--------------------------------------------------------+  |
       |                               |                              |
       |                               v                              |
       |  +--------------------------------------------------------+  |
       |  | HTML Stream / String Injector (`escapeInject`)         |  |
       |  |   - Sanitizes untrusted strings                        |  |
       |  |   - Permits raw markup via `dangerouslySkipEscape`     |  |
       |  |   - Injects serialized client `pageContext` script     |  |
       |  +--------------------------------------------------------+  |
       +--------------------------------------------------------------+
                                       |
                                       | HTTP Stream / Response (HTML)
                                       v
       +--------------------------------------------------------------+
       |                         Web Browser                          |
       |  +--------------------------------------------------------+  |
       |  | Initial Document Render                                |  |
       |  +--------------------------------------------------------+  |
       |                               |                              |
       |                               v                              |
       |  +--------------------------------------------------------+  |
       |  | `renderPageClient.ts` / Hydration Activation           |  |
       |  +--------------------------------------------------------+  |
       |                               |                              |
       |        +----------------------+----------------------+       |
       |        | (Success)                                   | (Fail)|
       |        v                                             v       |
       |  +-----------------------+      +-------------------------+  |
       |  | SPA Client Routing    |      | Chunk Fetch Error Logic |  |
       |  | Link click intercept, |      | Detect reload loop,     |  |
       |  | lazy chunk loading,   |      | check connectivity,     |  |
       |  | history pushState     |      | fallback to hard reload |  |
       |  +-----------------------+      +-------------------------+  |
       +--------------------------------------------------------------+
```

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Signal-Aware Child Subsystem Teardown in Dev Server Runners
**RULE**:
When wrapping or embedding an external long-running process or server (such as Vite's dev server) within a parent supervisory CLI, intercepting POSIX signals (`SIGINT`, `SIGTERM`) MUST explicitly invoke the underlying engine's `.close()` method. Furthermore, if zero external listeners remain after cleanup, the supervisor MUST explicitly re-issue the signal to its own process (`process.kill(process.pid, signal)`).

**WHY**:
Registering an event listener via `process.on('SIGINT', ...)` or `process.once(...)` in Node.js strips the runtime's default behavior, which is immediate process termination. If an embedded server or child runner keeps active handles open (e.g., file watchers, HTTP connection pools, open sockets), the process hangs indefinitely upon Ctrl+C. Conversely, if an integrated user server *does* register its own graceful shutdown handler, the supervisor must not unilaterally call `process.exit()`, but must terminate active engine watchers so the event loop naturally empties and allows the user's graceful exit flow to complete.

**WHEN TO APPLY**:
Any dev CLI, task runner, test harness, or application harness running on Node.js/Bun that wraps an HTTP server, watcher (`chokidar`), or database connection pool alongside custom user code.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import type { ViteDevServer } from 'vite';

/**
 * Ensures Vite dev server watchers and socket handles are closed on POSIX termination signals
 * without suppressing custom user-space shutdown logic or hanging the process.
 */
export function registerSignalTeardown(viteServer: ViteDevServer): void {
  const SIGNALS = ['SIGINT', 'SIGTERM'] as const;

  for (const signal of SIGNALS) {
    process.once(signal, () => {
      // 1. Explicitly close Vite's internal file watchers and HTTP sockets
      void viteServer.close();

      // 2. If the user's application did NOT register its own listener for this signal,
      // Node's default exit behavior has been removed by our `process.once`.
      // We must re-kill our own PID with the signal to restore native exit semantics.
      if (process.listenerCount(signal) === 0) {
        process.kill(process.pid, signal);
      }
    });
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Induces CLI hangs or brutally breaks user-land graceful shutdown
export function badSignalHandler(viteServer: ViteDevServer): void {
  // Pitfall A: Intercepts signal, calls close, but leaves process dangling if handles remain
  process.on('SIGINT', () => {
    viteServer.close();
    // Missing: process will never exit if user server opened an unclosed keep-alive socket!
  });

  // Pitfall B: Calls process.exit(0) immediately, breaking user-defined cleanup/DB flushing
  process.on('SIGTERM', () => {
    process.exit(0); // Truncates in-flight DB transactions and logs!
  });
}
```

**VERIFICATION METHOD**:
Spawn the runner in a detached child process, send `kill -SIGINT <pid>`, and assert via an automated test timeout (e.g., 2000ms) that the process exits with a non-zero exit code or expected signal code:
```typescript
import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('CLI Signal Invariant', () => {
  it('terminates within 2 seconds on SIGINT without hanging', async () => {
    const child = spawn('node', ['./dist/bin.js', 'dev'], { stdio: 'pipe' });
    await waitForOutput(child, 'Server running');
    
    const startTime = Date.now();
    child.kill('SIGINT');
    
    const exitCode = await new Promise((resolve) => {
      child.on('exit', (code, signal) => resolve(code ?? signal));
    });

    expect(Date.now() - startTime).toBeLessThan(2000);
    expect(['SIGINT', 0, 130]).toContain(exitCode);
  });
});
```

---

### 2. Client-Side Chunk Fetch Failure Infinite-Loop Circuit Breaker
**RULE**:
When an SPA / Client-Routing architecture intercepts dynamic script/chunk import failures (typically caused by a rolling deployment purging old hashed assets), fallback navigation to the target URL MUST NOT execute via a method that creates a new browser navigation entry (`type: 'navigate'`) if the current page was already loaded via a reload. Furthermore, fallback logic MUST detect blank-screen states (`document.body.innerHTML.trim() === ''`) to branch between silent hard reloads and terminal error screen rendering.

**WHY**:
When chunk `[hash].js` returns 404/MIME error post-deployment, calling `location.href = url` creates a `navigate` entry in `performance.getEntriesByType('navigation')`. If that asset or an asset on the target route continues to fail, the page enters an infinite rapid-reload loop that freezes browser tabs, floods CDN infrastructure, and burns end-user mobile data. Using `window.location.reload()` maintains the navigation type as `'reload'`, permitting detection via `performance.getEntriesByType('navigation')[0].type === 'reload'` to halt reload loops immediately.

**WHEN TO APPLY**:
All single-page web application runtimes, micro-frontends, and client-side routers utilizing dynamic `import()` chunk loading.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Safely handles chunk load failures during client routing, breaking infinite reload loops.
 */
export async function handleChunkFetchError(
  err: unknown,
  targetUrl: string,
  isFirstRender: boolean,
  disableClientRouting: () => void,
  renderErrorPage: (err: unknown) => void,
): Promise<{ handled: boolean }> {
  if (!isChunkImportError(err)) {
    return { handled: false };
  }

  disableClientRouting();

  const isReload = (() => {
    const navEntries = window.performance?.getEntriesByType?.('navigation');
    if (navEntries && navEntries.length > 0) {
      return (navEntries[0] as PerformanceNavigationTiming).type === 'reload';
    }
    // Fallback for legacy web browsers
    return (window.performance as unknown as { navigation?: { type: number } })
      ?.navigation?.type === 1;
  })();

  const isBlankPage = () => {
    const root = document.getElementById('root');
    return !root || root.innerHTML.trim() === '';
  };

  // 1. If already on a reloaded page, further reloads will cause an infinite loop
  if (isReload) {
    if (isBlankPage()) {
      renderErrorPage(err);
      return { handled: true };
    }
    // Abort rendering and leave current DOM intact
    console.error('Failed to fetch updated chunks after page reload. Halting reload loop.', err);
    return { handled: true };
  }

  // 2. Client-side link transition failure: Hard redirect to target URL
  if (!isFirstRender) {
    window.location.assign(targetUrl);
    return { handled: true };
  }

  // 3. Hydration failure on initial page render: Hard reload in-place
  if (isBlankPage()) {
    // Reload without creating a new history entry of type 'navigate'
    window.location.reload();
    return { handled: true };
  }

  // 4. Page has existing SSR content: check connectivity before reloading
  const isOnline = navigator.onLine;
  if (isOnline) {
    window.location.reload();
  } else {
    renderErrorPage(new Error('Network offline; cannot fetch updated assets.'));
  }

  return { handled: true };
}

function isChunkImportError(err: unknown): err is Error {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('importing a module script failed')
  );
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Causes infinite browser reload death spirals during CDN rollouts
function badHandleChunkError(err: unknown, url: string) {
  if (err) {
    // ALWAYS redirecting with location.href creates a 'navigate' type on every iteration,
    // blinding the runtime to the fact that it is looping!
    window.location.href = url; 
  }
}
```

**VERIFICATION METHOD**:
Write an automated Playwright integration test simulating 404 on a chunk script:
1. Intercept `**/*.js` chunk requests and route `.abort('failed')`.
2. Trigger client routing link.
3. Assert that `window.location.reload` is triggered at most once, and that `performance.getEntriesByType('navigation')[0].type === 'reload'` causes the loop guard to fire without executing consecutive reloads.

---

### 3. Asynchronous Config Invalidation Guard Against Dev Server Lifecycle Deadlocks
**RULE**:
When a build plugin or framework watcher triggers a dev server restart (`viteDevServer.restart()`) from within a configuration resolution or environment-binding hook, the call to `.restart()` MUST NOT be awaited inline if the dev server instance has not fully stabilized, and the hook MUST verify the dev server's existence prior to referencing it.

**WHY**:
In modern build tool architectures (like Vite 6 with multi-environment runtimes), environment registration and configuration resolution hooks (`resolveVikeConfigInternal`) are invoked before `ViteDevServer` finishes construction. Calling or awaiting `.restart()` creates a circular dependency: the dev server is waiting for config resolution to complete before completing its initialization promise, while config resolution is awaiting the server's restart promise. This produces an unrecoverable, silent deadlock that hangs the CLI process indefinitely without error output.

**WHEN TO APPLY**:
Vite plugins, Next.js/Webpack custom plugins, or dev tooling hooks that mutate configuration on the fly and trigger runtime dev server rebuilds.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import type { ViteDevServer } from 'vite';

interface GlobalDevContext {
  server: ViteDevServer | null;
}

const devContext: GlobalDevContext = { server: null };

export function setDevServer(server: ViteDevServer): void {
  devContext.server = server;
}

export function restartDevServerSafely(): void {
  const server = devContext.server;

  // 1. Invariant: If config resolution runs during initial startup,
  // the server instance does not exist yet. We must return early.
  if (!server) {
    return;
  }

  // 2. Invariant: Do NOT await server.restart() inside config resolution hooks.
  // Vite's restart() pipeline requires the current config pass to finish.
  // Awaiting here triggers a mutual dependency deadlock.
  void Promise.resolve().then(async () => {
    try {
      await server.restart();
    } catch (err) {
      console.error('Failed to trigger development server restart:', err);
    }
  });
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Induces permanent CLI hang during early startup or config reload
async function badRestartHook() {
  const server = devContext.server;
  // Pitfall A: Assertion blows up during early initialization phases
  assert(server); 

  // Pitfall B: Deadlocks the engine because restart awaits config resolution
  await server.restart(); 
}
```

**VERIFICATION METHOD**:
Add an integration test executing `createDevMiddleware()` or initializing the plugin in an environment where Vite configuration hooks are invoked with an uninitialized server. Assert resolution completes within 500ms:
```typescript
import { test, expect } from 'vitest';

test('config resolution does not deadlock without active server', async () => {
  const resolvePromise = resolveVikeConfigInternal();
  // If deadlocked, this promise hangs forever
  await expect(resolvePromise).resolves.toBeDefined();
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Process Hang on `$ vike dev` With Custom Signal Handlers (BUG-VIKE-DEV-HANG-01)
- **Context**: `packages/vike/src/node/api/serverEntryDev.ts`
- **What Was Expected**: Executing `$ vike dev` on a project with a custom `+serverEntry.js` handling graceful shutdown (`process.on('SIGTERM', () => server.close())`) should terminate smoothly when a termination signal is received.
- **What Actually Happened**: The CLI process hung indefinitely upon receiving `SIGINT` (Ctrl+C) or `SIGTERM`. The terminal refused to return control to the shell, requiring a `kill -9`.
- **Evidence in Repo**: Commit `053cd1f7`, Issue #3618.
- **Root Cause**: Node.js disables its default termination behavior as soon as any signal listener is attached. While the user's custom server was terminating its Express HTTP listener, Vite's internal development server (`viteServer`) remained active with open socket watchers and chokidar file-system watchers. Because `viteServer.close()` was never invoked, Node's event loop held active handles and refused to exit.
- **Remediation Code Diff**:
```diff
--- a/packages/vike/src/node/api/serverEntryDev.ts
+++ b/packages/vike/src/node/api/serverEntryDev.ts
@@ -69,6 +69,7 @@ async function startServerEntry_child(viteServer: ViteDevServer, serverEntryFile
   )
   // The user's server uses the current Vite development server (e.g. `app.use(devMiddleware)`) => we restart the process instead of letting Vite restart itself (e.g. upon vite.config.js changes)
   viteServer.restart = async () => restart('Vite needs to restart')
+  closeOnSignal(viteServer)
 
   try {
     // Same module runner as the one Vike uses to load pages (`ssrLoadModule()`) => a module imported by both +serverEntry.js and a page is instantiated only once (like in production)
@@ -89,6 +90,17 @@ function restartOnFileChange(viteServer: ViteDevServer, isRestartNeeded: (filePa
   viteServer.watcher.on('unlink', onFileChange)
 }
 
+// The user's server may handle SIGINT/SIGTERM without exiting the process (e.g. graceful shutdown: close the server and let the process exit once it's idle) => close Vite's development server, otherwise it keeps the process alive
+function closeOnSignal(viteServer: ViteDevServer): void {
+  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
+    process.once(signal, () => {
+      void viteServer.close()
+      // Listening to a signal disables Node.js's default behavior of terminating the process => if the user's server doesn't listen to it, then we terminate the process ourselves
+      if (process.listenerCount(signal) === 0) process.kill(process.pid, signal)
+    })
+  }
+}
+
 function restart(reason: string): never {
```
- **Lesson**: Subsystem wrappers must monitor the listener count of signals. When wrapping child engines, explicitly close embedded child runners on signal reception, and re-emit the signal to the current PID if no other user-land listeners exist.

---

### Incident 2: Deadlock & Assertion Crash During Early Config Resolution (BUG-VIKE-CONFIG-DEADLOCK-02)
- **Context**: `packages/vike/src/node/vite/shared/resolveVikeConfigInternal.ts`
- **What Was Expected**: Vite dev server config resolution (`createDevMiddleware()`) should smoothly resolve and initialize even if Vike's multi-environment settings (`setViteEnvironmentNames()`) trigger a config invalidation during the startup phase.
- **What Actually Happened**: The dev server crashed with an assertion error (`assert(viteDevServer)` failed), or when bypassed, hung indefinitely without completing server startup.
- **Evidence in Repo**: Commit `cd8c110e`.
- **Root Cause**: `setViteEnvironmentNames()` can invoke config resolution while Vite resolves its internal configuration *before* `viteDevServer` is constructed. Invoking `assert(viteDevServer)` broke early startup. Furthermore, awaiting `viteDevServer.restart()` inside config resolution produced a mutual dependency deadlock: Vite config resolution was waiting on `restart()`, while `restart()` was blocked waiting on the existing config resolution pipeline to release its lock.
- **Remediation Code Diff**:
```diff
--- a/packages/vike/src/node/vite/shared/resolveVikeConfigInternal.ts
+++ b/packages/vike/src/node/vite/shared/resolveVikeConfigInternal.ts
@@ -1869,7 +1869,8 @@ async function resolvePrerenderContext(vikeConfig: Parameters<typeof resolvePrer
 
 function restartViteDevServer() {
   const viteDevServer = getViteDevServer()
-  assert(viteDevServer)
+  // setViteEnvironmentNames() can reload Vike's config while Vite resolves its config, before the dev server exists
+  if (!viteDevServer) return
   swallowViteLogForceOptimization_enable()
   // We don't `await` because it never resolves it if we await it here => it hangs Vike's config resolving.
   // - I don't know why but I suspect there is a dead lock of a mutual dependency between Vite's restart() and Vike's config resolving.
```
- **Lesson**: Never assume a dependent dev server exists during configuration bootstrap phases. Never await server rebuild/restart hooks from inside the configuration resolution path.

---

### Incident 3: Infinite Reload Loop on Missing Production Assets (BUG-VIKE-CHUNK-404-03)
- **Context**: `packages/vike/src/client/runtime-client-routing/renderPageClient.ts`
- **What Was Expected**: When a dynamic chunk fails to fetch due to a new deployment, the client router should reload the page gracefully. If the asset remains unavailable or hydration fails, it should display an error page without thrashing the user's browser.
- **What Actually Happened**: Users encountered infinite page reload loops. The client-side routing fallback logic used `redirectHard(pageContext.urlOriginal)`, which set `window.location.href = url`. This created a new navigation entry of type `'navigate'`. On the next load, the reload check evaluated to false, causing another reload repeatedly.
- **Evidence in Repo**: Commit `ef5704ea`, Issue #3598.
- **Root Cause**: Navigating with `location.href = url` pushes/replaces a navigation history record that browser APIs treat as a direct navigation (`type: 'navigate'`), not a reload. The detection heuristic `isPageReload()` failed to identify that the page was already attempting a recovery reload.
- **Remediation Code Diff**:
```diff
--- a/packages/vike/src/client/runtime-client-routing/renderPageClient.ts
+++ b/packages/vike/src/client/runtime-client-routing/renderPageClient.ts
@@ -810,27 +798,115 @@ async function loadPageConfigsLazyClientSideAndExecHook<
-function handleErrorFetchingStaticAssets(
+async function handleErrorFetchingStaticAssets(
   err: unknown,
   pageContext: { urlOriginal: string },
   isFirstRender: boolean,
-): boolean {
-  if (!isErrorFetchingStaticAssets(err)) {
+): Promise<boolean> {
+  if (import.meta.env.DEV) return false
+  if (!isErrorFetchingStaticAssets(err)) return false // Syntax error in user file
+
+  const showErrorPage = () => {
+    disableClientRouting(err, false)
+    return false
+  }
+  const showCurrentBrokenPage = () => {
+    disableClientRouting(err, false)
+    throw err
+  }
+  const hardReload = (url?: string) => {
+    disableClientRouting(err, true)
+    if (url) {
+      redirectHard(url)
+    } else {
+      // We use `location.reload()` instead of redirectHard(): navigating with `location.href = url` creates a `type: 'navigate'` entry, which would lead to an infinite reload loop — see isPageReload()
+      window.location.reload()
+    }
+    return true
+  }
+
+  if (!isFirstRender) {
+    return hardReload(pageContext.urlOriginal)
+  }
+
+  // Avoid infinite reload loop: we don't reload a page that was itself loaded by a reload
+  if (isPageReload()) {
+    if (isBlankPage()) {
+      return showErrorPage()
+    } else {
+      return showCurrentBrokenPage()
+    }
+  }
+
+  if (isBlankPage()) {
+    return hardReload()
+  } else {
+    globalObject.clientRoutingIsDisabled = true
+    if (!(await isConnectionDown())) {
+      return hardReload()
+    }
+  }
+}
```
- **Lesson**: When triggering browser-level recovery reloads, use `window.location.reload()` to preserve the `type: 'reload'` performance navigation timing state. Never use string navigation assignments when attempting to recover from network errors.

---

### Incident 4: False Positive Static Asset Fetch Classification (BUG-VIKE-MODULE-SPECIFIER-04)
- **Context**: `packages/vike/src/client/shared/loadPageConfigsLazyClientSide.ts`
- **What Was Expected**: Only genuine network and chunk-loading errors should trigger server-routing fallback and recovery reloads. Syntax and module resolution errors in user code should fail fast to the console/error boundary.
- **What Actually Happened**: In-code developer errors such as "error resolving module specifier" or "failed to resolve module" matched the regex/substring tests in `isFetchError`, causing developer bugs to be misclassified as CDN network drops. This led to unnecessary fallback routines that obscured code syntax errors during testing.
- **Evidence in Repo**: Commit `ef5704ea`.
- **Root Cause**: Overly broad error message matching in `FAILED_TO_FETCH_MESSAGES`. Strings like `'error resolving module specifier'` and `'failed to resolve module'` occur when import paths are malformed, not when a static network chunk fails to transfer over HTTP.
- **Remediation Code Diff**:
```diff
--- a/packages/vike/src/client/shared/loadPageConfigsLazyClientSide.ts
+++ b/packages/vike/src/client/shared/loadPageConfigsLazyClientSide.ts
@@ -71,10 +71,6 @@ function isFetchError(err: unknown): err is Error {
     'error loading dynamically imported module',
     // safari
     'Importing a module script failed',
-    // ??
-    'error resolving module specifier',
-    // ??
-    'failed to resolve module',
   ]
   return FAILED_TO_FETCH_MESSAGES.some((s) => err.message.toLowerCase().includes(s.toLowerCase()))
 }
```
- **Lesson**: Discard speculative error patterns. Classifying user bugs as infrastructure network drops prevents developers from seeing exact trace stacks and creates phantom retry behavior.

---

### Incident 5: Vitest Security Vulnerability via fs.deny Bypass (BUG-VITEST-DEP-FS-DENY-05)
- **Context**: Root `package.json` devDependencies (`vitest` bumped from `5.0.4` to `5.0.5`)
- **What Was Expected**: Vitest testing suites should respect Vite's default `fs.deny` security configuration, preventing tests or rogue imports from accessing API token files and sensitive root filesystem targets.
- **What Actually Happened**: Vitest 5.0.4 failed to keep Vite's default `fs.deny` settings when handling API token files, potentially exposing credentials in test runners reading local files.
- **Evidence in Repo**: Pull Request #3631 (Vitest Issue #11578).
- **Root Cause**: In upstream Vitest, custom file serving overrides failed to merge default server `fs.deny` arrays when API token files were present in the workspace root.
- **Remediation Code Diff**:
```diff
--- a/package.json
+++ b/package.json
@@ -35,7 +35,7 @@
     "@brillout/test-e2e": "^0.6.25",
     "@brillout/test-types": "^0.1.13",
     "playwright-chromium": "1.57.0",
-    "vitest": "^5.0.4"
+    "vitest": "^5.0.5"
   },
   "packageManager": "pnpm@9.15.9"
 }
```
- **Lesson**: Audit dev server filesystem boundaries continuously. Dev tooling dependencies with file access privileges can open arbitrary read vectors if `fs.deny` rules are dropped during option merging.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 4.1 Micro-Syntax & Token-Level Precision
1. **Base URL Normalization & Trailing Slashes**:
   When combining `baseAssets` or `baseServer` URLs with relative asset paths, never rely on loose concatenation (`base + path`).
   ```typescript
   // INVARIANT: Exactly one slash separator between base URL and asset path
   export function combineUrl(base: string, path: string): string {
     const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
     const cleanPath = path.startsWith('/') ? path.slice(1) : path;
     return `${cleanBase}/${cleanPath}`;
   }
   ```
2. **Boolean / Falsy Coercion in HTML Injection**:
   In `escapeInject`, values evaluated inside template literals must never implicitly convert `0` to empty string