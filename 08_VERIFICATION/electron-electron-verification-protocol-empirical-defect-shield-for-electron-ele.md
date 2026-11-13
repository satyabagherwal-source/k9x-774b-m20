# Verification Protocol: Verification Protocol: Empirical Defect Shield for electron/electron

<!-- PROVENANCE_START
{
  "source_repository": "electron/electron",
  "source_url": "https://github.com/electron/electron",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [electron/electron](https://github.com/electron/electron) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `electron/electron` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/electron-electron-learnings.md`  
> **Source**: github ([https://github.com/electron/electron](https://github.com/electron/electron))  
> **Source Version**: `ef2710fa`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T04:49:36.743Z  
> **Learning ID**: `learn-github-electron-electron`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): electron/electron

> **Canonical Artifact**: `07_PROJECT_LEARNING/electron-electron-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/electron/electron](https://github.com/electron/electron))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-09T04:49:36.735Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `electron/electron`
- **Description**: :electron: Build cross-platform desktop apps with JavaScript, HTML, and CSS
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 123828 stars

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
- **Issue #55656** (2026-11-06): **fix: limit webRequest redirects across loader restarts to avoid crashes**
  *Symptoms*: Backport of #55623  See that PR for details.   Notes: Fixed renderer crashes caused by unbounded `webRequest` redirect loops.
  **Post-Mortem & Fix Analysis**:
  > gn check failure @ https://github.com/electron/electron/actions/runs/42263998915/job/128053983878?pr=55656 looks like it's picking up the wrong image? https://github.com/electron/build-images/actions/runs/39684341789/job/119523409722 indicates the cached headers are for Node 22.23.3 ("Found in cache @ /opt/hostedtoolcache/node/22.23.3/x64") but the image installed Node 22.23.4.
  > Since nothing else is failing in 45-x-y I'm guessing it's a hiccup :man_shrugging: and re-running

- **Issue #55655** (2026-11-06): **fix: limit webRequest redirects across loader restarts to avoid crashes**
  *Symptoms*: Backport of #55623  See that PR for details.   Notes: Fixed renderer crashes caused by unbounded `webRequest` redirect loops.
  **Post-Mortem & Fix Analysis**:
  > **Release Notes Persisted**  > Fixed renderer crashes caused by unbounded `webRequest` redirect loops.

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

### Incident Patch 1: `52bb0270` (2026-11-06)
**Commit Message**: fix: run local notification callbacks on the main thread on macOS (#55629)

* fix: run local notification callbacks on the main thread on macOS

With a nil queue, NSNotificationCenter runs observer blocks on whichever
thread posts the notification, and the block called the JS callback
there. A background thread would block on the isolate's v8::Locker held
by the main thread, which could hang app.quit(). Keep the callbacks in a
main-thread-only map and post notifications from other threads to the
main thread.

Also make the detached-frame cppgc fixture collect with async GCs so
conservative stack scanning (notably ASan fake stacks) cannot keep a
stale callback holder alive, and disable retries in cpp-heap.spec.ts.

Fixes #55392

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: address clang-tidy findings in notification dispatch

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* refactor: track notification subscriptions in a single map

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/api/system-preferences.md` (modified, +2/-0)
```diff
@@ -100,6 +100,8 @@ Returns `number` - The ID of this subscription
 
 Same as `subscribeNotification`, but uses `NSNotificationCenter` for local defaults.
 This is necessary for events such as `NSUserDefaultsDidChangeNotification`.
+`callback` is always called on the main thread. Notifications posted on other
+threads are delivered to it asynchronously.
 
 If `event` is null, the `NSNotificationCenter` doesn’t use it as criteria for delivery to the observer. See [docs](https://developer.apple.com/documentation/foundation/nsnotificationcenter/1411723-addobserverforname?language=objc) for more information.
 
```

**File**: `shell/browser/api/electron_api_system_preferences_mac.mm` (modified, +80/-35)
```diff
@@ -20,6 +20,7 @@
 #include "base/no_destructor.h"
 #include "base/strings/sys_string_conversions.h"
 #include "base/task/bind_post_task.h"
+#include "base/task/single_thread_task_runner.h"
 #include "base/values.h"
 #include "chrome/browser/media/webrtc/system_media_capture_permissions_mac.h"
 #include "net/base/apple/url_conversions.h"
@@ -83,16 +84,51 @@ static bool FromV8(v8::Isolate* isolate,
 
 int g_next_id = 0;
 
-// The map to convert |id| to |int|.
-auto& GetIdMap() {
-  static base::NoDestructor<base::flat_map<int, id>> g_id_map;
-  return *g_id_map;
-}
+struct Subscription {
+  id observer;
+  NotificationCenterKind kind;
+  SystemPreferences::NotificationCallback callback;
+};
 
-auto& GetKindMap() {
-  static base::NoDestructor<base::flat_map<int, NotificationCenterKind>>
-      g_kind_map;
-  return *g_kind_map;
+// Live subscriptions, keyed by request id. Only accessed on the main thread,
+// so a subscription's JS callback is never run or destroyed elsewhere.
+auto& GetSubscriptions() {
+  static base::NoDestructor<base::flat_map<int, Subscription>> g_subscriptions;
+  return *g_subscriptions;
+}
+
+void RunNotificationCallback(int request_id,
+                             const std::string& name,
+                             base::Value user_info,
+                             const std::string& object) {
+  auto& subscriptions = GetSubscriptions();
+  auto iter = subscriptions.find(request_id);
+  // The subscription may have been removed while a notification posted on
+  // another thread was waiting to be delivered here.
+  if (iter == subscriptions.end())
+    return;
+  // Run a copy so that the callback can unsubscribe itself.
+  SystemPreferences::NotificationCallback callback = iter->second.callback;
+  callback.Run(name, std::move(user_info), object);
+}
+
+// Runs the subscription's callback now when called on the main thread, and
+// otherwise posts it to |main_task_runner| so the calling thread never waits
+// on the isolate's v8::Locker.
+void DispatchNotification(
+    const scoped_refptr<base::SingleThreadTaskRunner>& main_task_runner,
+    int request_id,
+    std::string name,
+    base::Value user_info,
+    std::string object) {
+  if ([NSThread isMainThread]) {
+    RunNotificationCallback(request_id, name, std::move(user_info), object);
+    return;
+  }
+  main_task_runner->PostTask(
+      FROM_HERE,
+      base::BindOnce(&RunNotificationCallback, request_id, std::move(name),
+                     std::move(user_info), std::move(object)));
 }
 
 AVMediaType ParseMediaType(const std::string& media_type) {
@@ -245,9 +281,6 @@ SkColor NSSystemColorToSkColor(NSColor* color) {
     const NotificationCallback& callback,
     NotificationCenterKind kind) {
   int request_id = g_next_id++;
-  // A copy is needed: the block below would capture a reference by reference.
-  // NOLINTNEXTLINE(performance-unnecessary-copy-initialization)
-  __block NotificationCallback copied_callback = callback;
 
   v8::Isolate* isolate = JavascriptEnvironment::GetIsolate();
   std::string name_str;
@@ -260,49 +293,61 @@ SkColor NSSystemColorToSkColor(NSColor* color) {
 
   auto* name = maybe_name->IsNull() ? nil : base::SysUTF8ToNSString(name_str);
 
-  GetIdMap()[request_id] = [GetNotificationCenter(kind)
+  // With a nil queue, NSNotificationCenter runs the block synchronously on
+  // whichever thread posted the notification, and many notifications are
+  // posted on background threads. The JS callback may only run on the main
+  // thread, which holds the isolate's v8::Locker for the lifetime of the
+  // JavaScript environment: calling it from another thread blocks that thread
+  // on the lock, which hangs quit if the main thread waits for it. Deliver
+  // those notifications to the main thread asynchronously instead. The block
+  // holds no V8 handles, so releasing it on any thread is safe.
+  // A copy is needed: the block below would capture a reference by reference.
+  // NOLINTNEXTLINE(performance-unnecessary-copy-initialization)
+  scoped_refptr<base::SingleThreadTaskRunner> main_task_runner =
+      base::SingleThreadTaskRunner::GetCurrentDefault();
+  id observer = [GetNotificationCenter(kind)
       addObserverForName:name
                   object:nil
                    queue:nil
               usingBlock:^(NSNotification* notification) {
-                std::string object = "";
+                std::string object;
                 if ([notification.object isKindOfClass:[NSString class]]) {
                   object = base::SysNSStringToUTF8(notification.object);
                 }
-
+                base::DictValue user_info;
                 if (notification.userInfo) {
-                  copied_callback.Run(
-                      base::SysNSStringToUTF8(notification.name),
-                      base::Value(NSDictionaryToValue(notification.userInfo)),
-                      object);
-                } else {
-                  copied_callback.Run(
-                   
```

**File**: `spec/cpp-heap.spec.ts` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ import {
 
 const fixturesPath = path.join(import.meta.dirname, 'fixtures');
 
-describe('cpp heap', () => {
+describe('cpp heap', { retry: 0 }, () => {
   ifdescribe(isTestingBindingAvailable())('native callback holders', () => {
     for (const [mode, description] of [
       ['call', 'creates callable images through an API retained from a removed iframe'],
```

**File**: `spec/fixtures/api/cppgc-detached-frame.js` (modified, +5/-2)
```diff
@@ -21,13 +21,16 @@ module.exports = async (page, child, snapshotHelper, mode) => {
     }
   });
   const evaluate = (source) => window.webContents.executeJavaScript(source);
+  // Collect from fresh tasks with no native stack. A synchronous collection
+  // scans the stack conservatively, so a stale pointer left by an earlier
+  // native frame (common under ASan's fake stacks) can keep a callback holder
+  // and its realm alive and make the counts below off by one.
   const collect = () =>
     evaluate(`
     (async () => {
       const v8Util = process._linkedBinding('electron_common_v8_util');
       for (let i = 0; i < 3; ++i) {
-        await new Promise(resolve => setTimeout(resolve, 0));
-        v8Util.requestGarbageCollectionForTesting();
+        await v8Util.requestGarbageCollectionForTesting({ execution: 'async' });
       }
       return process._linkedBinding('electron_common_testing')
         .getLiveCallbackHolderProbeCountForTesting();
```

---

### Incident Patch 2: `78d4af57` (2026-11-06)
**Commit Message**: fix: limit webRequest redirects across loader restarts to avoid crashes (#55623)

fix: limit webRequest redirects across loader restarts

Keep a per-request redirect count across target loader restarts.
Reject redirects beyond Chromium's limit with ERR_TOO_MANY_REDIRECTS.

**File**: `shell/browser/net/proxying_url_loader_factory.cc` (modified, +8/-0)
```diff
@@ -22,6 +22,7 @@
 #include "net/http/http_util.h"
 #include "net/url_request/redirect_info.h"
 #include "net/url_request/redirect_util.h"
+#include "net/url_request/url_request.h"
 #include "services/network/public/cpp/features.h"
 #include "services/network/public/mojom/early_hints.mojom.h"
 #include "services/network/public/mojom/url_response_head.mojom.h"
@@ -722,6 +723,13 @@ void ProxyingURLLoaderFactory::InProgressRequest::ContinueToBeforeRedirect(
     return;
   }
 
+  if (redirect_count_ >= net::URLRequest::kMaxRedirects) {
+    OnRequestError(
+        network::URLLoaderCompletionStatus(net::ERR_TOO_MANY_REDIRECTS));
+    return;
+  }
+  ++redirect_count_;
+
   info_->AddResponseInfoFromResourceResponse(*current_response_);
 
   if (proxied_client_receiver_.is_bound())
```

**File**: `shell/browser/net/proxying_url_loader_factory.h` (modified, +1/-0)
```diff
@@ -163,6 +163,7 @@ class ProxyingURLLoaderFactory
     mojo::ScopedDataPipeConsumerHandle current_body_;
     scoped_refptr<net::HttpResponseHeaders> override_headers_;
     GURL redirect_url_;
+    int redirect_count_ = 0;
 
     const bool for_cors_preflight_ = false;
 
```

**File**: `spec/api-web-request.spec.ts` (modified, +32/-0)
```diff
@@ -524,6 +524,38 @@ describe('webRequest module', () => {
       // This is a limitation of the WebRequest API.
       expect(result).toBe('');
     });
+
+    it('limits redirects across target loader restarts', async () => {
+      const requestURL = `${defaultURL}redirect-limit`;
+      const filter = { urls: [requestURL] };
+      const terminalEvents: string[] = [];
+      let calls = 0;
+      let redirects = 0;
+      defer(() => {
+        ses.webRequest.onBeforeRedirect(null);
+        ses.webRequest.onErrorOccurred(null);
+        ses.webRequest.onCompleted(null);
+      });
+      ses.webRequest.onBeforeRedirect(filter, () => redirects++);
+      ses.webRequest.onCompleted(filter, () => terminalEvents.push('completed'));
+      const error = new Promise<string>((resolve) => {
+        ses.webRequest.onErrorOccurred(filter, (details) => {
+          terminalEvents.push(details.error);
+          resolve(details.error);
+        });
+      });
+      ses.webRequest.onBeforeRequest(filter, (details, callback) => {
+        // Bound resource use even if the redirect limit regresses.
+        if (++calls > 25) return callback({ cancel: true });
+        setImmediate(() => callback({ redirectURL: details.url }));
+      });
+
+      await expect(ajax(requestURL)).rejects.toThrow();
+      expect(await error).toBe('net::ERR_TOO_MANY_REDIRECTS');
+      expect(calls).toBe(21);
+      expect(redirects).toBe(20);
+      expect(terminalEvents).toEqual(['net::ERR_TOO_MANY_REDIRECTS']);
+    });
   });
 
   describe('webRequest.onBeforeSendHeaders', () => {
```

---

### Incident Patch 3: `4c826c54` (2026-11-06)
**Commit Message**: fix: apply setHasShadow() to windows in app shims (#55636)

NativeWindowMacRemote::SetHasShadow only stored the value, so after the
creation-time hasShadow option was honored, a later setHasShadow() left
the shim's window unchanged while hasShadow() reported the new value.
Send it to the shim, which sets it on the NSWindow, as NativeWindowMac
does for in-process windows.

Also tag the app shim focusable spec as serial, since it needs OS-level
focus and other spec processes' windows can take it.


Claude-Session: https://claude.ai/code/session_01KX1hkKqVdmPdED1YaLQEc7

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `shell/app_shim/app_shim_controller.h` (modified, +1/-0)
```diff
@@ -109,6 +109,7 @@ class AppShimController : public mojom::AppShim, private AppShimMenu::Client {
                          const std::string& type,
                          int32_t duration_ms,
                          int32_t state) override;
+  void SetWindowHasShadow(uint64_t window_id, bool has_shadow) override;
   void PerformWindowTabAction(uint64_t window_id,
                               mojom::AppShimTabAction action) override;
   void AddTabbedWindow(uint64_t window_id, uint64_t tabbed_window_id) override;
```

**File**: `shell/app_shim/app_shim_controller.mm` (modified, +5/-0)
```diff
@@ -533,6 +533,11 @@ - (BOOL)applicationSupportsSecureRestorableState:(NSApplication*)app {
             state:static_cast<NSVisualEffectState>(state)];
 }
 
+void AppShimController::SetWindowHasShadow(uint64_t window_id,
+                                           bool has_shadow) {
+  [WindowForId(window_id).GetNativeNSWindow() setHasShadow:has_shadow];
+}
+
 void AppShimController::PerformWindowTabAction(uint64_t window_id,
                                                mojom::AppShimTabAction action) {
   [[ElectronAppShimWindow forWindowId:window_id] performTabAction:action];
```

**File**: `shell/browser/native_window_mac_remote.mm` (modified, +2/-0)
```diff
@@ -743,6 +743,8 @@ explicit RemoteRootView(NativeWindow* window)
 
 void NativeWindowMacRemote::SetHasShadow(bool has_shadow) {
   has_shadow_ = has_shadow;
+  if (auto* shim = GetAppShim())
+    shim->SetWindowHasShadow(GetRemoteWindowId(), has_shadow);
 }
 
 bool NativeWindowMacRemote::HasShadow() const {
```

**File**: `shell/common/app_shim.mojom` (modified, +1/-0)
```diff
@@ -144,6 +144,7 @@ interface AppShim {
   // NSVisualEffectState.
   SetWindowVibrancy(
       uint64 window_id, string type, int32 duration_ms, int32 state);
+  SetWindowHasShadow(uint64 window_id, bool has_shadow);
   PerformWindowTabAction(uint64 window_id, AppShimTabAction action);
   AddTabbedWindow(uint64 window_id, uint64 tabbed_window_id);
   PreviewFile(
```

**File**: `spec/api-app-shim.spec.ts` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ ifdescribe(process.platform === 'darwin' && !process.mas)('app shims', () => {
     expect(w.isVisible()).toBe(false);
   });
 
-  it('honors focusable for a window in a shim', async () => {
+  it('honors focusable for a window in a shim', { tags: ['serial'] }, async () => {
     const shim = await launchShim();
     const w = new BrowserWindow({ appShim: shim, focusable: false });
     await once(w, 'show');
```

#### Recent Merged Pull Requests:
- **PR #55656** (2026-11-06): fix: limit webRequest redirects across loader restarts to avoid crashes (@trop[bot])
- **PR #55655** (2026-11-06): fix: limit webRequest redirects across loader restarts to avoid crashes (@trop[bot])
- **PR #55654** (2026-11-06): fix: limit webRequest redirects across loader restarts to avoid crashes (@trop[bot])
- **PR #55651** (2026-11-07): ci: retry devtools esbuild bundle actions once on "service was stopped" (44-x-y) (@claude[bot])
- **PR #55650** (2026-11-07): ci: retry devtools esbuild bundle actions once on "service was stopped" (45-x-y) (@claude[bot])
- **PR #55649** (2026-11-07): ci: retry devtools esbuild bundle actions once on "service was stopped" (46-x-y) (@claude[bot])

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

## X. run local notification callbacks on the main thread on macOS (#55629)

**RULE**:
When implementing operations in `docs/api/system-preferences.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in electron/electron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `52bb0270`: run local notification callbacks on the main thread on macOS (#55629). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/api/system-preferences.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
`callback` is always called on the main thread. Notifications posted on other
threads are delivered to it asynchronously.
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `52bb0270` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
