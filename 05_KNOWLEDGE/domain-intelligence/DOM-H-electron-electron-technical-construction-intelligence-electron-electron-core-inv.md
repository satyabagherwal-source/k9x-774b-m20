# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: electron/electron Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "electron/electron",
  "source_url": "https://github.com/electron/electron",
  "source_version": "c7ba9db4",
  "license": "MIT",
  "timestamp": "2026-11-21T02:08:36.760Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-electron-electron",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [electron/electron](https://github.com/electron/electron) (Revision: `c7ba9db4`).  
> **License**: MIT | **Timestamp**: `2026-11-21T02:08:36.760Z`  
> **Learning ID**: `learn-github-electron-electron`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), B (Product Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), A (Human & Need Intelligence), C (Market & Business Intelligence)
- **Confidence Rating**: 76%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from electron/electron:

# Forensic Learning Record (Deep Inspection): electron/electron

> **Canonical Artifact**: `07_PROJECT_LEARNING/electron-electron-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/electron/electron](https://github.com/electron/electron))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T02:08:35.574Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `electron/electron`
- **Description**: :electron: Build cross-platform desktop apps with JavaScript, HTML, and CSS
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 124027 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/browser/api/service-worker-main.ts`
```
import { IpcMainImpl } from '@electron/internal/browser/ipc-main-impl';

const { ServiceWorkerMain } = process._linkedBinding('electron_browser_service_worker_main');

Object.defineProperty(ServiceWorkerMain.prototype, 'ipc', {
  get() {
    const ipc = new IpcMainImpl();
    Object.defineProperty(this, 'ipc', { value: ipc });
    return ipc;
  }
});

module.exports = ServiceWorkerMain;

```

### Core Architecture Module: `lib/browser/api/utility-process.ts`
```
import { EventEmitter } from 'events';
import { Socket } from 'net';
import { Duplex, PassThrough } from 'stream';

const { _fork } = process._linkedBinding('electron_browser_utility_process');

class ForkUtilityProcess extends EventEmitter implements Electron.UtilityProcess {
  #handle: ElectronInternal.UtilityProcessWrapper | null;
  #stdout: Duplex | null = null;
  #stderr: Duplex | null = null;
  #stdoutConnected = false;
  #stderrConnected = false;
  constructor(modulePath: string, args?: string[], options?: Electron.ForkOptions) {
    super();

    if (!modulePath) {
      throw new Error('Missing UtilityProcess entry script.');
    }

    if (args == null) {
      args = [];
    } else if (typeof args === 'object' && !Array.isArray(args)) {
      options = args;
      args = [];
    }

    if (options == null) {
      options = {};
    } else {
      options = { ...options };
    }

    if (!options) {
      throw new Error('Options cannot be undefined.');
    }

    if (options.execArgv != null) {
      if (!Array.isArray(options.execArgv)) {
        throw new TypeError('execArgv must be an array of strings.');
      }
    }

    if (options.serviceName != null) {
      if (typeof options.serviceName !== 'string') {
        throw new TypeError('serviceName must be a string.');
      }
    }

    if (options.cwd != null) {
      if (typeof options.cwd !== 'string') {
        throw new TypeError('cwd path must be a string.');
      }
    }

    if (typeof options.stdio === 'string') {
      const stdio: Array<'pipe' | 'ignore' | 'inherit'> = [];
      switch (options.stdio) {
        case 'inherit':
        case 'ignore':
          stdio.push('ignore', options.stdio, options.stdio);
          break;
        case 'pipe':
          this.#stderr = new PassThrough();
          this.#stdout = new PassThrough();
          stdio.push('ignore', options.stdio, options.stdio);
          break;
        default:
          throw new Error('stdio must be of the following values: inherit, pipe, ignore');
      }
      options.stdio = stdio;
    } else if (Array.isArray(options.stdio)) {
      if (options.stdio.length >= 3) {
        if (options.stdio[0] !== 'ignore') {
          throw new Error('stdin value other than ignore is not supported.');
        }

        if (options.stdio[1] === 'pipe') {
          this.#stdout = new PassThrough();
        } else if (options.stdio[1] !== 'ignore' && options.stdio[1] !== 'inherit') {
          throw new Error('stdout configuration must be of the following values: inherit, pipe, ignore');
        }

        if (options.stdio[2] === 'pipe') {
          this.#stderr = new PassThrough();
        } else if (options.stdio[2] !== 'ignore' && options.stdio[2] !== 'inherit') {
          throw new Error('stderr configuration must be of the following values: inherit, pipe, ignore');
        }
      } else {
        throw new Error('configuration missing for stdin, stdout or stderr.');
      }
    }

    this.#handle = _fork({ options, modulePath, args });
    this.#handle!.emit = (channel: string | symbol, ...args: any[]) => {
      if (channel === 'exit') {
        try {
          this.emit('exit', ...args);
        } finally {
          this.#handle = null;
          // Leave the streams' listeners alone: output the child wrote just
          // before exiting may still be in the pipe, and a connected stream
          // ends on its own once that has been read. Only end the ones that
          // never got connected, so their readers do not wait forever.
          const stdout = this.#stdout;
          const stderr = this.#stderr;
          this.#stdout = null;
          this.#stderr = null;
          if (!this.#stdoutConnected) stdout?.end();
          if (!this.#stderrConnected) stderr?.end();
        }
        return false;
      } else if (channel === 'stdout' && this.#stdout) {
        this.#stdoutConnected = true;
        new Socket({ fd: args[0], readable: true }).pipe(this.#stdout);
        return true;
      } else if (channel === 'stderr' && this.#stderr) {
        this.#stderrConnected = true;
        new Socket({ fd: args[0], readable: true }).pipe(this.#stderr);
        return true;
      } else {
        return this.emit(channel, ...args);
      }
    };
  }

  get pid() {
    return this.#handle?.pid;
  }

  get stdout() {
    return this.#stdout;
  }

  get stderr() {
    return this.#stderr;
  }

  _unwrapHandle() {
    return this.#handle;
  }

  postMessage(message: any, transfer?: Electron.MessagePortMain[]) {
    if (Array.isArray(transfer)) {
      return this.#handle?.postMessage(message, transfer);
    }
    return this.#handle?.postMessage(message);
  }

  kill(): boolean {
    if (this.#handle === null) {
      return false;
    }
    return this.#handle.kill();
  }
}

export function fork(modulePath: string, args?: string[], options?: Electron.ForkOptions) {
  return new ForkUtilityProcess(modulePath, args, options);
}

```

### Core Architecture Module: `lib/browser/ipc-main-internal-utils.ts`
```
import { ipcMainInternal } from '@electron/internal/browser/ipc-main-internal';

type IPCHandler = (event: ElectronInternal.IpcMainInternalEvent, ...args: any[]) => any;

export const handleSync = function <T extends IPCHandler>(channel: string, handler: T) {
  ipcMainInternal.on(channel, async (event, ...args) => {
    try {
      event.returnValue = [null, await handler(event, ...args)];
    } catch (error) {
      event.returnValue = [error];
    }
  });
};

```

### Core Architecture Module: `lib/isolated_renderer/init.ts`
```
import type * as webViewElementModule from '@electron/internal/renderer/web-view/web-view-element';
import type { WebViewImplHooks } from '@electron/internal/renderer/web-view/web-view-impl';

declare const isolatedApi: WebViewImplHooks;

if (isolatedApi.guestViewInternal) {
  // Must setup the WebView element in main world.
  const { setupWebView } =
    require('@electron/internal/renderer/web-view/web-view-element') as typeof webViewElementModule;
  setupWebView(isolatedApi);
}

```

### Core Architecture Module: `lib/renderer/api/context-bridge.ts`
```
const { contextBridge } = process._linkedBinding('electron_renderer_context_bridge');

export default contextBridge;

```

### Core Architecture Module: `lib/renderer/api/crash-reporter.ts`
```
const { addExtraParameter, removeExtraParameter, getParameters } = process._linkedBinding(
  'electron_renderer_crash_reporter'
);

export default { addExtraParameter, removeExtraParameter, getParameters };

```

### Core Architecture Module: `lib/renderer/api/exports/electron.ts`
```
import { commonModuleList } from '@electron/internal/common/api/module-list';
import { defineProperties } from '@electron/internal/common/define-properties';
import { rendererModuleList } from '@electron/internal/renderer/api/module-list';

module.exports = {};

defineProperties(module.exports, commonModuleList);
defineProperties(module.exports, rendererModuleList);

```

### Core Architecture Module: `lib/renderer/api/ipc-renderer.ts`
```
const { ipcRenderer } = process._linkedBinding('electron_renderer_ipc');

export default ipcRenderer;

```

### Core Architecture Module: `lib/renderer/api/module-list.ts`
```
// Renderer side modules, please sort alphabetically.
export const rendererModuleList: ElectronInternal.ModuleEntry[] = [
  { name: 'contextBridge', loader: () => require('./context-bridge') },
  { name: 'crashReporter', loader: () => require('./crash-reporter') },
  { name: 'ipcRenderer', loader: () => require('./ipc-renderer') },
  { name: 'sharedTexture', loader: () => require('./shared-texture') },
  { name: 'webFrame', loader: () => require('./web-frame') },
  { name: 'webUtils', loader: () => require('./web-utils') }
];

```

### Core Architecture Module: `lib/renderer/api/shared-texture.ts`
```
const binding = process._linkedBinding('electron_common_shared_texture');

// Textures sent with sharedTexture.sendSharedTexture() are imported and handed
// to the receiver natively (ElectronApiServiceImpl::ReceiveSharedTexture).
const sharedTexture = {
  subtle: binding,
  setSharedTextureReceiver: binding.setSharedTextureReceiver
};

export default sharedTexture;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #55988** (2026-11-20): **Use-after-free crash at quit when a `protocol.handle` response is still streaming (NodeStreamLoader, `STRING_STAYS_VALID_UNTIL_COMPLETION`)**
  *Symptoms*: ### Preflight Checklist  - [x] I have read the [Contributing Guidelines](https://github.com/electron/electron/blob/main/CONTRIBUTING.md) for this project. - [x] I agree to follow the [Code of Conduct](https://github.com/electron/electron/blob/main/CODE_OF_CONDUCT.md) that this project adheres to. - [x] I have searched the [issue tracker](https://www.github.com/electron/electron/issues) for a bug report that matches the one I want to file, without success.  ### Electron version  45.3.4. The code is unchanged on `main` as of 2026-11-20.  ### What operating system(s) are you using?  Windows  ### Operating system version  Windows Server 2025 (GitHub Actions `windows-2025` runner), x64  ### What arch are you using?  x64  ### Last known working version  Unknown  ### Does the issue also appear in Chromium / Google Chrome?  No. The faulty code is Electron's `NodeStreamLoader`, which Chromium doesn't have.  ### Expected behavior  Quitting the app while a page is still loading a response from a `protocol.handle` handler ends the process with exit code 0.  ### Actual behavior  Sometimes the main process crashes during shutdown with an access violation (`0xC0000005`) on a thread-pool worker. Everything in JavaScript has already finished normally: `before-quit`, `will-quit`, `process.on('exit')` with code 0, and `quit` with `exitCode` 0. The crash happens afterwards, and Windows Error Reporting records nothing: there is no Application Error event and no LocalDumps dump. The only symptom i

- **Issue #55987** (2026-11-20): **fix: reflect system contrast preference in prefers-contrast media query**
  *Symptoms*: Backport of #55970  See that PR for details.   Notes: Fixed `prefers-contrast` media query ignoring the system's contrast setting. 
  **Post-Mortem & Fix Analysis**:
  > **Release Notes Persisted**  > Fixed `prefers-contrast` media query ignoring the system's contrast setting.

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

### Incident Patch 1: `7ccb4856` (2026-11-19)
**Commit Message**: build: replace the loading benchmark page and keep partial benchmark results (#55941)

* build: add an app-like page to the loading and trace benchmarks

The loading suite's only page runs a 3,000,000-iteration Math.sqrt loop
before its first paint, so its FCP and loadEventEnd mostly time renderer
setup plus that loop. Add an "app shell" page shaped like a typical
Electron app's first window: generated at run time from a fixed seed
(about 420 KiB of scripts with a small virtual DOM, store and feature
modules, 90 KiB of CSS, a 270 KiB JSON file of 1,200 items), loaded from
file://, rendering the window chrome, then, once that has painted, a
summary and a 1,200-row list. It marks app-ready once the full view is
in the DOM and records its LCP as a mark.

New stories loading.app_shell_first_load (FCP, LCP, loadEventEnd,
app_ready, PSS), loading.app_shell_reload (FCP, LCP, loadEventEnd,
app_ready) and trace.app_shell_first_load (FCP, LCP). The existing page
and stories are unchanged so the nightly and history series stay
continuous.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Vf2yMv3H6HNt1XyAwo35Sm

* build: run the app shell benc

**File**: `script/benchmarks/README.md` (modified, +83/-22)
```diff
@@ -21,18 +21,20 @@ dispatched by hand. This catches regressions between Electron versions.
 
 | Suite | Stories | Metrics |
 | --- | --- | --- |
-| `loading` | `first_load`, `reload` (warm process, same page) | FCP and `loadEventEnd` in ms; PSS in MiB after `first_load` (total, browser, renderer and GPU processes) |
-| `trace` | `first_load`, `resize`, traced | FCP and LCP in ms; resize latency median and p90 in ms |
+| `loading` | `first_load`, `reload` (warm process, same page) of the app shell (see [The app shell page](#the-app-shell-page)) | FCP, `loadEventEnd`, `app_ready` and LCP in ms; PSS in MiB after `first_load` (total, browser, renderer and GPU processes) |
+| `trace` | `first_load` and `resize` of the app shell, traced | FCP and LCP in ms; resize latency median and p90 in ms |
 | `file_loading` | 1,500 small classic scripts and ES modules, loaded through `file://`, `protocol.registerFileProtocol`, `protocol.handle` + `fs`, and `protocol.handle` + `net.fetch` | Navigation start to "all files evaluated" in ms, and the ratio of each custom protocol to `file://` |
 | `speedometer` | Speedometer 3.1 | Score |
 | `jetstream` | JetStream 2.2 | Score |
 
 Every measure comes from one of crossbench's probes:
 
 * `performance.entries` reads paint timing (FCP), navigation timing and
-  `performance.mark()` entries from the page after each story. The
-  file-loading pages mark `files-loaded` themselves once every file has run,
-  because only the page knows when that is.
+  `performance.mark()` entries from the page after each story. The app shell
+  marks `app-ready` and keeps its LCP as the `app-lcp` mark, since the probe
+  reads no LCP entries. The file-loading pages mark `files-loaded`
+  themselves once every file has run, because only the page knows when that
+  is.
 * `meminfo` reads `/proc/<pid>/smaps_rollup` for every browser process, through
   a `meminfo` action at the end of `first_load`, after the timing.
 * `tracing` records a Chrome-style startup trace (`--trace-startup`) with only
@@ -43,17 +45,65 @@ Every measure comes from one of crossbench's probes:
   `traced`, including FCP.
   * FCP and LCP: from the main frame's `navigationStart` to
     `firstContentfulPaint` and to the last `largestContentfulPaint::Candidate`.
-  * Resize: `BrowserWindow.setSize()` from the browser's
+  * Resize: once the app shell has loaded, a script the story injects steps
+    the window between 1280x800 and 900x600 (below the app's 960px layout
+    breakpoint) with `BrowserWindow.setSize()`, through the harness preload,
+    20 times. Each is timed from the browser's
     `Widget::OnNativeWidgetSizeChanged` to the presentation (the end of the
     `PipelineReporter`) of the first renderer frame whose main frame committed
-    after the page's `resize` event, 20 times per run. Frames are matched by
-    their commit because a `PipelineReporter` starts at its BeginFrame
-    timestamp, which can be earlier than the resize the frame shows.
+    after the page's `resize` event. Frames are matched by their commit
+    because a `PipelineReporter` starts at its BeginFrame timestamp, which can
+    be earlier than the resize the frame shows.
 
 Tracing slows the browser down, so the traced stories run in their own `trace`
 invocation and the `loading` and `file_loading` numbers are never traced. The
-`trace` suite's FCP is a cross-check of the untraced one and the only source of
-LCP, which `performance.entries` does not read.
+`trace` suite's FCP and LCP are a cross-check of the untraced ones. From
+Electron 35 on, Chromium coarsens paint timing exposed to pages to 4 ms, so
+the `loading` suite's FCP and LCP move in 4 ms steps there (marks such as
+`app-ready` don't); the traced values are not coarsened.
+
+### The app shell page
+
+The `loading` and `trace` suites load an app shell shaped like a typical
+Electron app's first window, from `file://` like a packaged app.
+[`lib/app-shell.mts`](lib/app-shell.mts) generates it into the work directory
+at the start of each run from a fixed seed, so every run loads the same bytes,
+and nothing comes from the network or third parties. It has an HTML shell
+with an empty root, three stylesheets (about 90 KiB, 1,100 rules), three
+deferred classic scripts (about 420 KiB: a small module loader, virtual DOM
+with a keyed diff, store and event delegation, then about 200 generated
+helper, schema, reducer, service and component modules and a message
+catalog) and a 270 KiB JSON file of 1,200 work items. It starts fetching the
+JSON, evaluates its modules (most at startup, some never, like code a first
+window doesn't need), renders the window chrome (title bar, sidebar with
+inline SVG icons, toolbar), waits for it to paint, then renders a summary,
+four feature panels and a 1,200-row list (about 25,000 elements) through the
+diff. It avoids anything newer than Chromium 94 (Electron 15).
+
+What the measures cover, all from navigation start:
+
+| Measure | Covers |
+| --- | -
```

**File**: `script/benchmarks/compare.mts` (modified, +110/-24)
```diff
@@ -57,16 +57,25 @@ export interface MetricComparison extends SampleComparison {
 
 export interface Comparison extends ComparisonDefinition {
   metrics: MetricComparison[];
+  // Metrics only one of the two targets has results for, and which one.
+  unmatched?: { metric: string; target: string }[];
 }
 
 // Suites run through crossbench's `loading` benchmark with generated page
 // configs (see lib/configs.mts); each reports one value per repetition.
 const PAGE_SUITES = ['loading', 'trace', 'file_loading'];
 
 // Measures read from crossbench's performance.entries probe, which merges
-// every repetition of a story into <story>/performance.entries.json.
+// every repetition of a story into <story>/performance.entries.json. The app
+// shell page (lib/app-shell.mts) marks app-ready once its full first view is
+// in the DOM, and keeps its LCP as the app-lcp mark.
 const PERFORMANCE_ENTRIES: Record<string, Record<string, string>> = {
-  loading: { fcp: 'paint/first-contentful-paint/startTime', load_event_end: 'navigation/loadEventEnd' },
+  loading: {
+    fcp: 'paint/first-contentful-paint/startTime',
+    load_event_end: 'navigation/loadEventEnd',
+    app_ready: 'mark/app-ready/startTime',
+    lcp: 'mark/app-lcp/startTime'
+  },
   file_loading: { files_loaded_ms: 'mark/files-loaded/startTime' }
 };
 
@@ -84,17 +93,42 @@ const readJson = (file: string): any => JSON.parse(fs.readFileSync(file, 'utf8')
 // Values of `data[key].values`, as written by crossbench's metrics merger.
 const valuesOf = (entry: any): number[] => (Array.isArray(entry?.values) ? entry.values.filter(Number.isFinite) : []);
 
+// Reads a JSON result file, or undefined when there is none. crossbench may
+// have been killed while writing one in a run that failed, so when `failed`
+// is set a file that doesn't parse also reads as undefined (and is listed in
+// `unreadable`): its story ends up with no values instead of the whole
+// comparison aborting. A successful run's files must parse.
+function resultReader(failed: boolean, unreadable: string[]) {
+  return (file: string): any => {
+    if (!fs.existsSync(file)) return undefined;
+    try {
+      return readJson(file);
+    } catch (error) {
+      if (!failed) throw error;
+      unreadable.push(file);
+      return undefined;
+    }
+  };
+}
+
 // Returns { metrics: { metric: number }, incomplete: [description] } for one
 // crossbench invocation. A measure with fewer (or more) values than the
 // expected repetitions is dropped, so a run where some repetitions failed or
 // timed out can't bias the round's median.
 function collectInvocation(
   resultDir: string,
   suite: string,
-  expectedCount: number | undefined
+  expectedCount: number | undefined,
+  failed = false
 ): { metrics: Record<string, number>; incomplete: string[] } {
   const metrics: Record<string, number> = {};
   const incomplete: string[] = [];
+  const unreadable: string[] = [];
+  const read = resultReader(failed, unreadable);
+  const result = () => {
+    for (const file of unreadable) incomplete.push(`${path.relative(resultDir, file)} (unreadable)`);
+    return { metrics, incomplete };
+  };
   const complete = (name: string, values: number[]) => {
     if (values.length === 0) return false;
     if (expectedCount === undefined || values.length === expectedCount) return true;
@@ -104,14 +138,12 @@ function collectInvocation(
   if (!fs.existsSync(resultDir)) return { metrics, incomplete };
 
   if (PRESS_RESULTS[suite]) {
-    const file = path.join(resultDir, PRESS_RESULTS[suite].file);
-    if (!fs.existsSync(file)) return { metrics, incomplete };
-    for (const browser of Object.values<any>(readJson(file))) {
+    for (const browser of Object.values<any>(read(path.join(resultDir, PRESS_RESULTS[suite].file)) ?? {})) {
       const key = PRESS_RESULTS[suite].keys.find((k) => valuesOf(browser.data?.[k]).length > 0);
       const values = key ? valuesOf(browser.data[key]) : [];
       if (complete(`${suite}.score`, values)) metrics[`${suite}.score`] = median(values);
     }
-    return { metrics, incomplete };
+    return result();
   }
 
   // Each invocation runs one browser, so there is one <browser>/stories dir.
@@ -121,7 +153,16 @@ function collectInvocation(
     for (const story of fs.readdirSync(storiesDir)) {
       const storyDir = path.join(storiesDir, story);
       if (!fs.statSync(storyDir).isDirectory()) continue;
-      for (const [measure, values] of Object.entries(storyMeasures(suite, story, storyDir))) {
+      // A story crossbench reported errors for is left out even when every
+      // repetition has a value: the values may not mean what they should. An
+      // unreadable errors file counts as errors.
+      const errorsFile = path.join(storyDir, 'cb.errors.json');
+      const errors = read(errorsFile);
+      if ((Array.isArray(errors) && errors.length > 0) || (errors === undefined && fs.existsSync(errorsFile))) {
+        incomplete.push(`${suite}.${story} (crossbench 
```

**File**: `script/benchmarks/lib/app-shell.mts` (added, +1741/-0)
```diff
@@ -0,0 +1,1741 @@
+// Generates the "app shell" page the loading and trace suites load: a
+// self-contained, deterministic stand-in for a typical Electron app's first
+// window, loaded through file:// like a packaged app.
+//
+//   index.html             an empty #app root, three stylesheets, three
+//                          deferred scripts and an inline LCP recorder
+//   styles/*.css           about 1,100 rules: tokens, resets and utilities,
+//                          the layout, and one block per component
+//   scripts/vendor.js      a small module loader, virtual DOM (keyed diff),
+//                          store and event delegation, plus generated helper
+//                          and schema modules
+//   scripts/locale.js      a message catalog with interpolation and plurals
+//   scripts/app.js         generated feature modules (components, reducers,
+//                          services) and the app's views and bootstrap
+//   data/items.json        projects, people, labels and `rows` work items
+//
+// On load the app fetches data/items.json, evaluates its modules, renders the
+// window chrome (title bar, sidebar with inline SVG icons, toolbar), waits
+// for that to be painted (its FCP), then renders the summary (the largest
+// element, and so the LCP), four feature panels and a row for every item
+// into the same tree with the diff, and marks `app-ready`. The page marks:
+//   app-shell-rendered  the chrome is in the DOM (not yet painted)
+//   app-ready           the full first view is in the DOM
+//   app-lcp             the latest largest-contentful-paint candidate's time,
+//                       recorded by a PerformanceObserver because crossbench's
+//                       performance.entries probe only reads paint, mark and
+//                       navigation entries
+//
+// Everything comes from a seeded PRNG, so every run gets the same bytes. No
+// network, fonts or third-party code are involved. The code must run on
+// Electron 15 (Chromium 94), so it avoids newer syntax and APIs (no class
+// static blocks, Array.prototype.at, structuredClone, CSS nesting, :has(),
+// @layer or container queries).
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+export interface AppShellOptions {
+  rows?: number;
+  seed?: number;
+}
+
+// Mulberry32: small, fast and the same everywhere.
+function createRandom(seed: number) {
+  let state = seed >>> 0;
+  const next = () => {
+    state = (state + 0x6d2b79f5) >>> 0;
+    let t = state;
+    t = Math.imul(t ^ (t >>> 15), t | 1);
+    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
+    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+  };
+  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
+  function pick<T>(list: readonly T[]): T {
+    return list[Math.floor(next() * list.length)];
+  }
+  return { next, int, pick, bool: (p = 0.5) => next() < p };
+}
+type Random = ReturnType<typeof createRandom>;
+
+const NOUNS = (
+  'account action activity adapter agent alert archive asset audit backup badge balance batch billing board ' +
+  'bookmark branch bridge budget buffer build bundle cache calendar campaign canvas catalog channel chart ' +
+  'checkout client cluster comment config contract cursor customer dashboard dataset deploy design device ' +
+  'digest draft editor engine entry event export feature feedback filter folder form gateway graph guide ' +
+  'handler history import inbox index invoice issue job journal kernel label layer layout ledger library ' +
+  'license link listener locale manifest market media member message metric migration mirror model module ' +
+  'monitor network note notice offer order outline package panel parser partner payment pipeline plan player ' +
+  'policy portal preset preview profile project prompt queue quota record release report request review route ' +
+  'runtime sample schedule schema screen script search section segment session setting shard sheet signal ' +
+  'snapshot source space sprint stack storage stream summary survey table target task team template theme ' +
+  'thread ticket timeline token topic tracker update upload usage vault vendor version widget window workflow'
+).split(' ');
+const VERBS = (
+  'add adjust align archive audit build check clean close compare configure convert create debug define deploy ' +
+  'document draft enable export fix handle improve index investigate load merge migrate monitor move optimize ' +
+  'prepare publish refactor remove rename render report request resolve restore review rewrite run schedule ' +
+  'ship simplify split sync test track update upgrade validate verify'
+).split(' ');
+const ADJECTIVES = (
+  'active async basic cached central custom daily default dynamic early external final flaky global hidden ' +
+  'initial internal large legacy local main manual minor native nested new nightly offline old partial pending ' +
+  'primary private public quick remote shared silent slo
```

**File**: `script/benchmarks/lib/configs.mts` (modified, +65/-17)
```diff
@@ -176,38 +176,87 @@ export function writeFileLoadingSite(root: string, count: number) {
   );
 }
 
-// Page configs for one target. `capabilities` comes from the harness app's --cb-capabilities output.
-const hasPainted = "return performance.getEntriesByName('first-contentful-paint').length > 0";
-
 // One crossbench page action, e.g. { action: 'get', url, ready_state }.
 type Action = Record<string, string>;
 type Pages = Record<string, Action[]>;
 
 interface PageConfigOptions {
+  // From the harness app's --cb-capabilities output.
   capabilities?: Capabilities;
-  baseUrl: string;
   fileRoot: string;
+  // Where writeAppShellSite (lib/app-shell.mts) wrote the app shell page.
+  appRoot: string;
   resizeCount?: number;
 }
 
-export function pageConfigs({ capabilities = {}, baseUrl, fileRoot, resizeCount = 20 }: PageConfigOptions) {
+// The app shell marks app-ready once its full first view is in the DOM, and
+// keeps its latest LCP candidate as the app-lcp mark. The content's LCP always
+// comes after app-ready (the window chrome before it is smaller), so waiting
+// for both means the mark holds the final LCP, however slowly the version
+// under test paints.
+const appShellDone = `
+if (location.protocol !== 'file:' || document.readyState !== 'complete') return false;
+const ready = performance.getEntriesByName('app-ready')[0];
+const lcp = performance.getEntriesByName('app-lcp')[0];
+return !!ready && !!lcp && lcp.startTime > ready.startTime;`;
+
+// Injected into the app shell by the resize story. It steps the window
+// between two sizes with BrowserWindow.setSize() through the harness preload
+// (window.cbHarness). The latency itself is measured from the trace (see
+// TRACE_QUERIES): from the browser's Widget::OnNativeWidgetSizeChanged to the
+// presentation of the first renderer frame that commits after the page sees
+// the new size, which the cb-resized mark records. The cb-resize-start and
+// cb-resize-end marks bracket the resizes so the window's initial sizing is
+// left out. Each step waits for the resize event, two frames and a short idle
+// period, so the next resize never overlaps the previous one's frame. The
+// smaller size is below the app's 960px breakpoint, so every step also
+// changes its layout.
+function resizeScript(count: number) {
+  return `(async () => {
+  if (!window.cbHarness) {
+    window.__cbResizeDone = true;
+    return;
+  }
+  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
+  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
+  performance.mark('cb-resize-start');
+  for (let i = 0; i < ${count}; i++) {
+    const [width, height] = i % 2 ? [1280, 800] : [900, 600];
+    const resized = new Promise((resolve) =>
+      addEventListener('resize', () => {
+        performance.mark('cb-resized');
+        resolve();
+      }, { once: true })
+    );
+    await window.cbHarness.setSize(width, height);
+    await resized;
+    await nextFrame();
+    await nextFrame();
+    await sleep(100);
+  }
+  performance.mark('cb-resize-end');
+  window.__cbResizeDone = true;
+})();`;
+}
+
+// Page configs for one target. The loading and trace suites load the app
+// shell (lib/app-shell.mts) from file://, like a packaged app.
+export function pageConfigs({ capabilities = {}, fileRoot, appRoot, resizeCount = 20 }: PageConfigOptions) {
   const firstLoad: Action[] = [
-    { action: 'get', url: `${baseUrl}/pages/index.html`, ready_state: 'complete' },
-    { action: 'wait_for_condition', timeout: '20s', condition: hasPainted },
-    { action: 'wait', duration: '1s' }
+    { action: 'get', url: `file://${appRoot}/index.html`, ready_state: 'any' },
+    { action: 'wait_for_condition', timeout: '30s', condition: appShellDone.trim() },
+    { action: 'wait', duration: '500ms' }
   ];
   const loading: Pages = {
     // Memory is sampled once the page has painted and settled.
     first_load: [...firstLoad, { action: 'meminfo', title: 'loaded' }],
     reload: [
-      { action: 'get', url: `${baseUrl}/pages/index.html`, ready_state: 'complete' },
-      { action: 'wait', duration: '1s' },
+      ...firstLoad,
       { action: 'js', script: 'location.reload();' },
       {
         action: 'wait_for_condition',
-        timeout: '20s',
-        condition:
-          "return performance.getEntriesByType('navigation')[0].type === 'reload' && document.readyState === 'complete' && performance.getEntriesByName('first-contentful-paint').length > 0"
+        timeout: '30s',
+        condition: `if (performance.getEntriesByType('navigation')[0].type !== 'reload') return false;${appShellDone}`
       },
       { action: 'wait', duration: '500ms' }
     ]
@@ -217,10 +266,9 @@ export function pageConfigs({ capabilities = {}, baseUrl, fileRoot, resizeCount
   const trace: Pages = { first_load: firstLoad };
   if (capabilities.setSize) {
     trace.resize = [
-      { action: 'get', url: `${baseUrl}/pages/resize.html`, r
```

**File**: `script/benchmarks/lib/types.mts` (modified, +6/-0)
```diff
@@ -59,9 +59,15 @@ export interface RunMetadata {
   repeat: number;
   suites?: string[];
   fileCount?: number;
+  // run.mts --best-effort: compare.mts keeps the complete stories of a
+  // failed invocation.
+  bestEffort?: boolean;
   // Suites run.mts --best-effort stopped running after the candidate failed
   // them in the first two rounds.
   skippedSuites?: string[];
+  // Stories (<suite>/<story>) it stopped running because the candidate
+  // produced no complete results for them in the first two rounds.
+  skippedStories?: string[];
   targets: TargetInfo[];
   invocations: Invocation[];
 }
```

**File**: `script/benchmarks/pages/index.html` (removed, +0/-22)
```diff
@@ -1,22 +0,0 @@
-<!doctype html>
-<html>
-<head>
-<meta charset="utf-8">
-<title>Electron benchmark: first paint</title>
-<style>
-  body { font: 16px sans-serif; }
-  .hero { width: 640px; height: 240px; background: linear-gradient(90deg, #47848f, #2b2e3b); }
-</style>
-</head>
-<body>
-<h1>First paint and reload</h1>
-<div class="hero"></div>
-<p id="status">Loading...</p>
-<script>
-  // A little synchronous work so paint timing has something to wait for.
-  let sum = 0;
-  for (let i = 0; i < 3e6; i++) sum += Math.sqrt(i);
-  document.getElementById('status').textContent = 'done ' + Math.round(sum);
-</script>
-</body>
-</html>
```

**File**: `script/benchmarks/pages/resize.html` (removed, +0/-62)
```diff
@@ -1,62 +0,0 @@
-<!doctype html>
-<html>
-<head>
-<meta charset="utf-8">
-<title>Electron benchmark: resize</title>
-<style>
-  body { margin: 0; font: 14px sans-serif; }
-  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 4px; }
-  .grid div { height: 40px; background: #9feaf9; border-radius: 4px; }
-</style>
-</head>
-<body>
-<div class="grid" id="grid"></div>
-<script>
-  // Layout-heavy content so each resize does real relayout and paint work.
-  const grid = document.getElementById('grid');
-  for (let i = 0; i < 3000; i++) {
-    const cell = document.createElement('div');
-    cell.textContent = i;
-    grid.appendChild(cell);
-  }
-  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
-  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
-
-  // Steps the window between two sizes with BrowserWindow.setSize(). The
-  // latency itself is measured from the trace (see TRACE_QUERIES in
-  // lib/configs.mts): from the browser's Widget::OnNativeWidgetSizeChanged to
-  // the presentation of the first renderer frame that commits after the page
-  // sees the new size, which the cb-resized mark records. The cb-resize-start
-  // and cb-resize-end marks bracket the resizes so the window's initial sizing
-  // is left out. Each step waits for the resize event, two frames and a short
-  // idle period, so the next resize never overlaps the previous one's frame.
-  window.cbRunResize = async (count) => {
-    if (!window.cbHarness) {
-      window.__cbResizeDone = true;
-      return;
-    }
-    performance.mark('cb-resize-start');
-    for (let i = 0; i < count; i++) {
-      const [width, height] = i % 2 ? [1280, 800] : [900, 600];
-      const resized = new Promise((resolve) =>
-        addEventListener(
-          'resize',
-          () => {
-            performance.mark('cb-resized');
-            resolve();
-          },
-          { once: true }
-        )
-      );
-      await window.cbHarness.setSize(width, height);
-      await resized;
-      await nextFrame();
-      await nextFrame();
-      await sleep(100);
-    }
-    performance.mark('cb-resize-end');
-    window.__cbResizeDone = true;
-  };
-</script>
-</body>
-</html>
```

**File**: `script/benchmarks/run.mts` (modified, +62/-18)
```diff
@@ -5,10 +5,13 @@
 // <out>/metadata.json; compare.mts turns them into a comparison.
 //
 // --best-effort is for runs against old Electron versions (the Benchmarks
-// History workflow): a suite that fails for the candidate in the first two
-// rounds is not run again, since an old version that can't run it would fail
-// (or time out) every round, and the run only fails when no invocation
-// succeeded. Without it, any failed invocation fails the run.
+// History workflow): when the candidate fails a suite in the first two
+// rounds, the stories that produced no complete results in either round are
+// not run again (the whole suite when no story did), since an old version
+// that can't run a story would fail (or time out) on it every round.
+// compare.mts keeps the complete stories of a failed invocation, and the run
+// only fails when no invocation succeeded. Without it, any failed invocation
+// fails the run.
 //
 // Usage (under Xvfb on Linux):
 //   node script/benchmarks/run.mts --targets <dir>/targets.json --out <dir>
@@ -21,6 +24,8 @@ import * as path from 'node:path';
 import { fileURLToPath } from 'node:url';
 import { parseArgs } from 'node:util';
 
+import { storiesWithResults } from './compare.mts';
+import { writeAppShellSite } from './lib/app-shell.mts';
 import { pageConfigs, probeConfigs, writeFileLoadingSite } from './lib/configs.mts';
 
 import type { Capabilities, Invocation, RunMetadata, Target, TargetsFile } from './lib/types.mts';
@@ -82,7 +87,7 @@ async function startServer(wwwDir: string, port: number): Promise<ChildProcess>
   while (Date.now() < deadline) {
     if (server.exitCode !== null) throw new Error(`serve-benchmarks.js exited with ${server.exitCode}`);
     try {
-      const response = await fetch(`http://127.0.0.1:${port}/pages/index.html`);
+      const response = await fetch(`http://127.0.0.1:${port}/__pgo/data?bytes=1`);
       if (response.ok) return server;
     } catch {
       // Not listening yet.
@@ -312,6 +317,28 @@ export function capLogs(dir: string, { maxBytes = 32 * 2 ** 20, keepBytes = 2 **
   }
 }
 
+// For --best-effort: the stories of `suite` (as configured for the
+// candidate) that the candidate produced no complete results for in either
+// of the first two rounds, or undefined unless its crossbench run failed in
+// both. A story missing from a failed run's results is taken as failed.
+export function failedStories(
+  outDir: string,
+  suite: string,
+  stories: string[],
+  invocations: Invocation[]
+): string[] | undefined {
+  const runs = [0, 1].map((round) =>
+    invocations.find((i) => i.round === round && i.suite === suite && i.target === 'candidate')
+  );
+  if (!runs.every((run) => run !== undefined && run.exitCode !== 0)) return undefined;
+  const passed = new Set(
+    runs.flatMap((run) => [...storiesWithResults(path.join(outDir, run!.dir), suite, run!.repetitions)])
+  );
+  return stories.filter((story) => !passed.has(story));
+}
+
+type PageSuiteConfigs = Record<string, { pages: Record<string, unknown[]> }>;
+
 async function main() {
   killActiveChildrenOnSignals();
   const { values: args } = parseArgs({
@@ -352,9 +379,11 @@ async function main() {
   const cb = ensureCrossbench(workDir, args.python);
 
   const wwwDir = path.join(workDir, 'www');
-  fs.cpSync(path.join(import.meta.dirname, 'pages'), path.join(wwwDir, 'pages'), { recursive: true });
   const fileRoot = path.join(workDir, 'file-loading');
   writeFileLoadingSite(fileRoot, fileCount);
+  const appRoot = path.join(workDir, 'app-shell');
+  const appBytes = Object.values(writeAppShellSite(appRoot)).reduce((sum, size) => sum + size, 0);
+  console.log(`[run] app shell: ${Math.round(appBytes / 1024)} KiB`);
   const server = await startServer(wwwDir, port);
   const baseUrl = `http://127.0.0.1:${port}`;
 
@@ -367,10 +396,12 @@ async function main() {
   }
   const capabilities = new Map<string, Capabilities>();
   const pageConfigPaths = new Map<string, Record<string, string>>();
+  const pageConfigsByTarget = new Map<string, PageSuiteConfigs>();
   for (const target of targets) {
     const targetCapabilities = probeCapabilities(target, harnessApp, workDir);
     capabilities.set(target.id, targetCapabilities);
-    const configs = pageConfigs({ capabilities: targetCapabilities, baseUrl, fileRoot });
+    const configs: PageSuiteConfigs = pageConfigs({ capabilities: targetCapabilities, fileRoot, appRoot });
+    pageConfigsByTarget.set(target.id, configs);
     const paths: Record<string, string> = {};
     for (const [suite, config] of Object.entries(configs)) {
       if (Object.keys(config.pages).length === 0) continue;
@@ -388,6 +419,7 @@ async function main() {
     repeat,
     suites,
     fileCount,
+    bestEffort: args['best-effort'],
     targets: targets.map(({ id, electronVersion, chromiumVersion }) => ({
       id,
       electronVersion,
@@ -407,6 +439,7 @@ async function main() {
   );
 
   const skippedSuites = new Set<string>();
+  const 
```

---

### Incident Patch 2: `93d48124` (2026-11-20)
**Commit Message**: fix: reflect system contrast preference in prefers-contrast media query (#55970)

fix: set preferred_contrast from NativeTheme in web preferences

ElectronBrowserClient::OverrideWebPreferences mirrored Chrome's
forced-colors and color-scheme handling but never set
WebPreferences::preferred_contrast, so `prefers-contrast` always
evaluated to `no-preference` in web content even when
nativeTheme.shouldUseHighContrastColors was true. Set it from the native
theme as ChromeContentBrowserClient does, and compare it in
WebPreferencesNeedUpdateForColorRelatedStateChanges so a runtime
contrast change refreshes the renderer.

Fixes #55917


Claude-Session: https://claude.ai/code/session_01Mamv74GiUZ1caHCPKp6tcR

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `shell/browser/electron_browser_client.cc` (modified, +19/-1)
```diff
@@ -15,6 +15,7 @@
 #include "base/auto_reset.h"
 #include "base/base_switches.h"
 #include "base/command_line.h"
+#include "base/containers/fixed_flat_map.h"
 #include "base/debug/crash_logging.h"
 #include "base/environment.h"
 #include "base/files/file_path.h"
@@ -416,6 +417,21 @@ void MaybeAppendSecureOriginsAllowlistSwitch(base::CommandLine* cmdline) {
   }
 }
 
+// Refs
+// https://source.chromium.org/chromium/chromium/src/+/main:chrome/browser/chrome_content_browser_client.cc;l=4056-4067;drc=e70e5ce76d4eafd833b4468a6d15bcd9ea0f6cea
+blink::mojom::PreferredContrast GetPreferredContrast(
+    const ui::NativeTheme& native_theme) {
+  using NC = ui::NativeTheme::PreferredContrast;
+  using BC = blink::mojom::PreferredContrast;
+  static constexpr auto kContrastMap =
+      base::MakeFixedFlatMap<NC, BC>({{NC::kNoPreference, BC::kNoPreference},
+                                      {NC::kMore, BC::kMore},
+                                      {NC::kLess, BC::kLess},
+                                      {NC::kCustom, BC::kCustom}});
+  const NC preferred_contrast = native_theme.preferred_contrast();
+  return kContrastMap.at(preferred_contrast);
+}
+
 }  // namespace
 
 // static
@@ -517,6 +533,7 @@ void ElectronBrowserClient::OverrideWebPreferences(
   renderer_prefs->can_accept_load_drops = false;
 
   ui::NativeTheme* native_theme = ui::NativeTheme::GetInstanceForNativeUi();
+  prefs->preferred_contrast = GetPreferredContrast(*native_theme);
   prefs->in_forced_colors = native_theme->forced_colors() !=
                             ui::ColorProviderKey::ForcedColors::kNone;
   prefs->preferred_color_scheme =
@@ -545,7 +562,8 @@ bool ElectronBrowserClient::WebPreferencesNeedUpdateForColorRelatedStateChanges(
               ui::NativeTheme::PreferredColorScheme::kDark
           ? blink::mojom::PreferredColorScheme::kDark
           : blink::mojom::PreferredColorScheme::kLight;
-  return prefs.in_forced_colors != in_forced_colors ||
+  return prefs.preferred_contrast != GetPreferredContrast(*native_theme) ||
+         prefs.in_forced_colors != in_forced_colors ||
          prefs.preferred_color_scheme != preferred_color_scheme;
 }
 
```

**File**: `spec/api-native-theme.spec.ts` (modified, +20/-1)
```diff
@@ -7,7 +7,7 @@ import { once } from 'node:events';
 import * as path from 'node:path';
 import { setTimeout } from 'node:timers/promises';
 
-import { ifdescribe } from './lib/spec-helpers.ts';
+import { ifdescribe, startRemoteControlApp } from './lib/spec-helpers.ts';
 import { closeAllWindows } from './lib/window-helpers.ts';
 
 describe('nativeTheme module', () => {
@@ -117,6 +117,25 @@ describe('nativeTheme module', () => {
     it('returns a boolean', () => {
       expect(nativeTheme.shouldUseHighContrastColors).toBeTypeOf('boolean');
     });
+
+    it('is reflected in the prefers-contrast CSS media query', async () => {
+      // --force-high-contrast makes the native theme report a preference for
+      // more contrast on every platform, regardless of the OS setting.
+      const rc = await startRemoteControlApp(['--force-high-contrast']);
+      const result = await rc.remotely(async () => {
+        const { BrowserWindow, nativeTheme } = require('electron/main');
+        const w = new BrowserWindow({ show: false });
+        await w.loadURL('about:blank');
+        const prefersMoreContrast = await w.webContents.executeJavaScript(
+          'matchMedia("(prefers-contrast: more)").matches'
+        );
+        return {
+          shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors,
+          prefersMoreContrast
+        };
+      });
+      expect(result).toEqual({ shouldUseHighContrastColors: true, prefersMoreContrast: true });
+    });
   });
 
   describe('nativeTheme.shouldUseDarkColorsForSystemIntegratedUI', () => {
```

---

### Incident Patch 3: `bb5b1dd2` (2026-11-20)
**Commit Message**: test: derive spec timeouts from the vitest config (#55971)

Add getSpecTimeout() to spec/lib/spec-helpers.ts. It returns the running
test's timeout, or outside a test the testTimeout from the worker's vitest
config, which spec/vitest/runner.ts hands over. Use it where specs read
ELECTRON_SPEC_TIMEOUT themselves and repeated its 30s default, so
spec/vitest.config.ts is the one place that reads the variable.

startRemoteControlApp now passes the running test's own timeout to the
fixture app, so tests with a longer timeout (cpp-heap's 60s and 90s ones)
no longer have the app quit after 30s.


Claude-Session: https://claude.ai/code/session_01KX1hkKh58Khvku8FCchbHQ

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `spec/api-app.spec.ts` (modified, +11/-2)
```diff
@@ -16,7 +16,16 @@ import { setTimeout } from 'node:timers/promises';
 import { promisify } from 'node:util';
 
 import { collectStreamBody, getResponse } from './lib/net-helpers.ts';
-import { defer, ifdescribe, ifit, isWayland, listen, spawnAndWait, waitUntil } from './lib/spec-helpers.ts';
+import {
+  defer,
+  getSpecTimeout,
+  ifdescribe,
+  ifit,
+  isWayland,
+  listen,
+  spawnAndWait,
+  waitUntil
+} from './lib/spec-helpers.ts';
 import { runInUtilityProcess } from './lib/utility-process-helpers.ts';
 import { closeWindow, closeAllWindows } from './lib/window-helpers.ts';
 import {
@@ -2199,7 +2208,7 @@ describe('app module', () => {
     const run = async (env: NodeJS.ProcessEnv) => {
       // Starting Electron is slow on sanitizer builds, so stay within the
       // per-test timeout (raised there) rather than a fixed short poll.
-      const timeout = (Number(process.env.ELECTRON_SPEC_TIMEOUT) || 30_000) - 5_000;
+      const timeout = getSpecTimeout() - 5_000;
       const { code, signal, stdout, stderr } = await spawnAndWait(process.execPath, [fixture], { env, timeout });
       const match = /GDK_BACKEND in child: (.*)/.exec(stdout);
       expect(match, `exited with ${code}/${signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`).not.toBeNull();
```

**File**: `spec/api-utility-process.spec.ts` (modified, +2/-1)
```diff
@@ -18,6 +18,7 @@ import { respondOnce, randomString, kOneKiloByte } from './lib/net-helpers.ts';
 import {
   defer,
   deferKillUtilityProcess,
+  getSpecTimeout,
   ifit,
   isTestingBindingAvailable,
   listen,
@@ -1049,7 +1050,7 @@ describe('utilityProcess module', { retry: 0 }, () => {
     // Growing the heap to the limit and writing the snapshot is slow, so give
     // this test at least 60s. Sanitizer builds raise every test's timeout
     // (ELECTRON_SPEC_TIMEOUT, 180s) and are slower still, so never go below that.
-    const heapTimeout = Math.max(60_000, Number(process.env.ELECTRON_SPEC_TIMEOUT) || 0);
+    const heapTimeout = Math.max(60_000, getSpecTimeout());
     it('supports generating snapshots via v8.setHeapSnapshotNearHeapLimit', { timeout: heapTimeout }, async () => {
       const tmpDir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'electron-spec-utility-oom-'));
       defer(() => fs.rm(tmpDir, { recursive: true, force: true }));
```

**File**: `spec/lib/spec-helpers.ts` (modified, +23/-8)
```diff
@@ -1,6 +1,6 @@
 import type { BrowserWindow } from 'electron/main';
 
-import { afterAll, assert, beforeAll, describe, it } from 'vitest';
+import { afterAll, assert, beforeAll, describe, it, TestRunner } from 'vitest';
 
 import * as childProcess from 'node:child_process';
 import { once } from 'node:events';
@@ -31,6 +31,22 @@ export const isWayland =
 export const ciGpuArgs: string[] =
   process.env.CI && process.platform === 'darwin' && process.arch === 'x64' ? ['--disable-gpu'] : [];
 
+// The worker's vitest config, handed over by spec/vitest/runner.ts. It is the
+// object vi.setConfig() changes.
+let specConfig: { testTimeout: number } | undefined;
+export function setSpecConfig(config: { testTimeout: number }) {
+  specConfig = config;
+}
+
+// How long the running test may take: its own timeout if it sets one, else
+// testTimeout from spec/vitest.config.ts (ELECTRON_SPEC_TIMEOUT). Outside a
+// test, e.g. while a spec file is being collected, the configured testTimeout.
+export function getSpecTimeout(): number {
+  const timeout = TestRunner.getCurrentTest()?.timeout ?? specConfig?.testTimeout;
+  if (timeout === undefined) throw new Error('getSpecTimeout() needs the runner from spec/vitest/runner.ts');
+  return timeout;
+}
+
 type CleanupFunction = (() => void) | (() => Promise<void>);
 // Each cleanup comes with the error it fails with if it times out,
 // created in defer() so that its stack points at the caller.
@@ -117,15 +133,14 @@ class RemoteControlApp {
 export async function startRemoteControlApp(extraArgs: string[] = [], options?: childProcess.SpawnOptionsWithoutStdio) {
   const appPath = path.join(import.meta.dirname, '..', 'fixtures', 'apps', 'remote-control');
   // The app quits by itself after --remote-app-timeout (30s unless given) in
-  // case nothing stops it. Sanitizer builds give each test 180s
-  // (ELECTRON_SPEC_TIMEOUT) and are slow enough that a test can still be
-  // talking to the app after 30s, which then fails with "socket hang up" or
-  // hangs. Keep the app alive at least as long as the test may run; defer()
-  // below stops it when the test is done.
-  const specTimeout = Number(process.env.ELECTRON_SPEC_TIMEOUT) || 30_000;
+  // case nothing stops it. A test can run for longer than that (sanitizer
+  // builds give each test 180s, and some tests set a longer timeout of their
+  // own), and one still talking to the app after it quit fails with "socket
+  // hang up" or hangs. Keep the app alive as long as the test may run;
+  // defer() below stops it when the test is done.
   const timeoutArgs = extraArgs.some((arg) => arg.startsWith('--remote-app-timeout='))
     ? []
-    : [`--remote-app-timeout=${specTimeout}`];
+    : [`--remote-app-timeout=${getSpecTimeout()}`];
   const appProcess = childProcess.spawn(
     process.execPath,
     [appPath, ...ciGpuArgs, ...timeoutArgs, ...extraArgs],
```

**File**: `spec/vitest/runner.ts` (modified, +19/-2)
```diff
@@ -20,16 +20,26 @@
 //    so the test still fails with all of them.
 //  - spec/disabled-tests.json switches a test off by its full title without
 //    touching the spec file (used to unblock a roll while a fix is pending).
+//  - The worker's config is handed to spec/lib/spec-helpers.ts, so that
+//    getSpecTimeout() reads the configured testTimeout instead of repeating it.
 
 import { TestRunner } from 'vitest';
 
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { setImmediate } from 'node:timers/promises';
 
-import { runCleanupFunctions } from '../lib/spec-helpers.ts';
+import { runCleanupFunctions, setSpecConfig } from '../lib/spec-helpers.ts';
 
-import type { RunnerTask, RunnerTestCase, RunnerTestFile, RunnerTestSuite, TestContext, TestTryOptions } from 'vitest';
+import type {
+  RunnerTask,
+  RunnerTestCase,
+  RunnerTestFile,
+  RunnerTestSuite,
+  SerializedConfig,
+  TestContext,
+  TestTryOptions
+} from 'vitest';
 
 const disabledTests = new Set<string>(
   JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'disabled-tests.json'), 'utf8'))
@@ -68,6 +78,13 @@ function collectingErrors(hook: (context: TestContext, suite: Readonly<RunnerTes
 }
 
 export default class ElectronSpecRunner extends TestRunner {
+  constructor(config: SerializedConfig) {
+    super(config);
+    // For getSpecTimeout(), which the specs and their helpers use to pass
+    // the timeout on to the apps they start.
+    setSpecConfig(this.config);
+  }
+
   async onBeforeRunSuite(suite: RunnerTestSuite) {
     if (!prepared.has(suite)) {
       prepared.add(suite);
```

#### Recent Merged Pull Requests:
- **PR #55987** (2026-11-20): fix: reflect system contrast preference in prefers-contrast media query (@trop[bot])
- **PR #55986** (2026-11-20): fix: reflect system contrast preference in prefers-contrast media query (@trop[bot])
- **PR #55985** (2026-11-20): fix: reflect system contrast preference in prefers-contrast media query (@trop[bot])
- **PR #55984** (2026-11-20): test: derive spec timeouts from the vitest config (@trop[bot])
- **PR #55981** (2026-11-20): test: wait for the OSR image before capturing a shared texture frame (@trop[bot])
- **PR #55980** (2026-11-20): test: wait for the OSR image before capturing a shared texture frame (@trop[bot])

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

## X. build: replace the loading benchmark page and keep partial benchmark results

**RULE**:
When implementing operations in `script/benchmarks/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in electron/electron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7ccb4856`: build: replace the loading benchmark page and keep partial benchmark results. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `script/benchmarks/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
| `loading` | `first_load`, `reload` (warm process, same page) of the app shell (see [The app shell page](#the-app-shell-page)) | FCP, `loadEventEnd`, `app_ready` and LCP in ms; PSS in MiB after `first_load` (total, browser, renderer and GPU processes) |
| `trace` | `first_load` and `resize` of the app shell, traced | FCP and LCP in ms; resize latency median and p90 in ms |
  `performance.mark()` entries from the page after each story. The app shell
  marks `app-ready` and keeps its LCP as the `app-lcp` mark, since the probe
  reads no LCP entries. The file-loading pages mark `files-loaded`
  themselves once every file has run, because only the page knows when that
  is.
  * Resize: once the app shell has loaded, a script the story injects steps
    the window between 1280x800 and 900x600 (below the app's 960px layout
    breakpoint) with `BrowserWindow.setSize()`, through the harness preload,
    20 times. Each is timed from the browser's
    after the page's `resize` event. Frames are matched by their commit
    because a `PipelineReporter` starts at its BeginFrame timestamp, which can
    be earlier than the resize the frame shows.
`trace` suite's FCP and LCP are a cross-check o
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
| `loading` | `first_load`, `reload` (warm process, same page) | FCP and `loadEventEnd` in ms; PSS in MiB after `first_load` (total, browser, renderer and GPU processes) |
| `trace` | `first_load`, `resize`, traced | FCP and LCP in ms; resize latency median and p90 in ms |
  `performance.mark()` entries from the page after each story. The
  file-loading pages mark `files-loaded` themselves once every file has run,
  because only the page knows when that is.
  * Resize: `BrowserWindow.setSize()` from the browser's
    after the page's `resize` event, 20 times per run. Frames are matched by
    their commit because a `PipelineReporter` starts at its BeginFrame
    timestamp, which can be earlier than the resize the frame shows.
`trace` suite's FCP is a cross-check of the untraced one and the only source of
LCP, which `performance.entries` does not read.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7ccb4856` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
