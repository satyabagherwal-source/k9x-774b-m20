> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/electron-electron-learnings.md`  
> **Source**: github ([https://github.com/electron/electron](https://github.com/electron/electron))  
> **Source Version**: `0240841b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T22:00:41.647Z  
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
> **Harvest Timestamp**: 2026-10-25T22:00:41.499Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `electron/electron`
- **Description**: :electron: Build cross-platform desktop apps with JavaScript, HTML, and CSS
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 123544 stars

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
- **Issue #55323** (2026-10-25): **fix: keep the window content view from blocking accessibility hit-tests**
  *Symptoms*: ### Description of Change  This continues #53460, whose author is unable to follow up on it. The original branch no longer applies to `main`, and the Windows verification the PR was waiting for was never done. This PR carries the same fix, rebased on current `main`, reuses the `ContentViewTargeterDelegate` that `main` already ships for macOS, and adds the Windows/UIA verification.  **Root cause.** `BrowserWindow` adds its `WebContentsView` as a *sibling* of the window's content view, inserted *before* it in the paint order, so that views added to the content view are painted on top of the web content (#41256). The content view covers the whole window, so the default bounds check made it win every hit-test: `ViewAXPlatformNodeDelegate::HitTestSync` returned the empty container instead of the web content. On Windows this intercepts `AccessibleObjectFromPoint`, which is what NVDA uses for mouse tracking, so the screen reader stays silent on the content and only reports an empty pane (#42945).  **The fix, in two parts.**  1. `NativeWindowViews::SetContentView` installs the same    `ContentViewTargeterDelegate` that `NativeWindowMac::SetContentView` and    `NativeWindowMacRemote::SetContentView` already install. The content view    then only intersects a point where one of its children covers it, so    accessibility hit-tests and view mouse targeting fall through to the    `WebContentsView` underneath. Unlike the original PR, this reuses the    shared delegate that already exists 

- **Issue #55320** (2026-10-25): **docs: update Windows notifications tutorial to use native toastXml**
  *Symptoms*: #### Description of Change  Updates the Windows notifications tutorial in `docs/tutorial/notifications.md` under the "Use advanced notifications" section.  Previously, this section directed developers to use third-party userland modules (`electron-windows-notifications` and `electron-windows-interactive-notifications`), both of which are deprecated/archived and require native Node addon compilation.  This change updates the tutorial to document Electron's built-in `toastXml` property on the `Notification` constructor. It provides a complete, runnable example using Microsoft Toast XML, and adds essential implementation notes covering: - Calling `app.setAppUserModelId()` so Windows associates toast notifications with the application. - Formatting local image resources with absolute `file:///` URLs. - XML escaping for dynamic values. - Error handling via the `failed` event when XML is invalid. - Handling action button clicks via the `action` event and protocol activation.  Fixes #41164.  #### Checklist  - [x] I have read the [Contributing Guidelines](https://github.com/electron/electron/blob/main/CONTRIBUTING.md) for this project. - [x] I have filled out the PR description - [x] [I have reviewed and verified the changes](https://github.com/electron/governance/blob/main/policy/ai.md) - [x] relevant API documentation, tutorials, and examples are updated and follow the [documentation style guide](https://github.com/electron/electron/blob/main/docs/development/st

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

### Incident Patch 1: `a6d4549e` (2026-10-23)
**Commit Message**: fix: handle a null pending call in dbus::ObjectProxy (#55236)

* fix: handle a null pending call in dbus::ObjectProxy

dbus_connection_send_with_reply() can succeed with a null
DBusPendingCall when the connection is already disconnected.
ObjectProxy::StartAsyncMethodCall() then passes it to
dbus_pending_call_set_notify(), which fails a libdbus argument check and
aborts the process. This made the app spec "when a D-Bus bus goes away >
exits cleanly instead of crashing" end in SIGABRT on Linux.

Add a Chromium patch that runs the callback with a null response, as the
function already does for its other failures.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LPMvJBQiyP6b7QjatACmnS

* test: add a regression test for the null D-Bus pending call

Extend the dbus::ObjectProxy patch with a dbus_unittests case,
ObjectProxyMockBusTest.NullPendingCallRunsCallbackWithNull, in
dbus/object_proxy_unittest.cc. It uses a MockBus whose SendWithReply()
leaves the pending call null, and checks that the callback runs
asynchronously, exactly once, with a null response and a null error
response. Unlike the Linux bus-loss spec, it does no

**File**: `patches/chromium/.patches` (modified, +1/-0)
```diff
@@ -138,3 +138,4 @@ build_drop_the_unused_chrome_browser_win_dep_from_color_mixers.patch
 fix_plumb_the_requesting_frame_through_pointer_lock_requests.patch
 feat_let_the_host_of_a_remote_nswindow_set_more_of_its_behavior.patch
 device_make_devicemonitormessagewindow_a_nodestructor.patch
+fix_handle_a_null_pending_call_in_dbus_objectproxy.patch
```

**File**: `patches/chromium/fix_handle_a_null_pending_call_in_dbus_objectproxy.patch` (added, +177/-0)
```diff
@@ -0,0 +1,177 @@
+From 0000000000000000000000000000000000000000 Mon Sep 17 00:00:00 2001
+From: Claude <noreply@anthropic.com>
+Date: Fri, 23 Oct 2026 00:59:29 +0000
+Subject: fix: handle a null pending call in dbus::ObjectProxy
+
+dbus_connection_send_with_reply() can return TRUE and still leave the
+DBusPendingCall null. libdbus does this when the connection is already
+disconnected, and when the message carries Unix file descriptors that
+the connection cannot pass. ObjectProxy::StartAsyncMethodCall() only
+checks that bus_->Connect() succeeds, and Connect() returns true for a
+connection that exists but has since been disconnected. So a method
+call made after the bus has gone away passes the null pending call to
+dbus_pending_call_set_notify(). That fails a libdbus argument check,
+which aborts the process by default.
+
+This shows up on desktop Linux when the session bus daemon exits under
+a running app: the app is asked to quit, and a D-Bus method call made
+while it shuts down crashes it with SIGABRT instead of letting it exit.
+
+Handle the null pending call the same way as the existing failures in
+this function: run the callback with a null response and a null error
+response, and release the request message.
+
+ObjectProxyMockBusTest.NullPendingCallRunsCallbackWithNull covers this
+without a real bus: a MockBus makes SendWithReply() leave the pending
+call null, and the test checks that the callback runs asynchronously,
+exactly once, with a null response and a null error response.
+
+This patch should be upstreamed.
+
+diff --git a/dbus/object_proxy.cc b/dbus/object_proxy.cc
+index a29cccd304cde400d7f926a36cc3b36dab944f71..75abd132786dae524b8266907bd9f26addf291a8 100644
+--- a/dbus/object_proxy.cc
++++ b/dbus/object_proxy.cc
+@@ -324,6 +324,23 @@ void ObjectProxy::StartAsyncMethodCall(int timeout_ms,
+   DBusPendingCall* dbus_pending_call = nullptr;
+   bus_->SendWithReply(request_message, &dbus_pending_call, timeout_ms);
+ 
++  // dbus_connection_send_with_reply() succeeds without creating a pending
++  // call when the connection is already disconnected, or when the message
++  // carries Unix file descriptors the connection cannot pass. Passing that
++  // null pending call to dbus_pending_call_set_notify() fails a libdbus
++  // argument check, which aborts the process by default. Run the error
++  // callback with nullptr instead, as for the failures above.
++  if (!dbus_pending_call) {
++    base::OnceClosure task =
++        base::BindOnce(&ObjectProxy::RunResponseOrErrorCallback, this,
++                       std::move(callback_holder), nullptr /* response */,
++                       nullptr /* error_response */);
++    bus_->GetOriginTaskRunner()->PostTask(FROM_HERE, std::move(task));
++
++    dbus_message_unref(request_message);
++    return;
++  }
++
+   using PendingCallback =
+       base::OnceCallback<void(DBusPendingCall * pending_call)>;
+   // This returns false only when unable to allocate memory.
+diff --git a/dbus/object_proxy_unittest.cc b/dbus/object_proxy_unittest.cc
+index 4725ccd5ec97eedb932661770a065235f41abf4e..c96057532a709b25bdfcb6c087a8d858cee73feb 100644
+--- a/dbus/object_proxy_unittest.cc
++++ b/dbus/object_proxy_unittest.cc
+@@ -9,11 +9,20 @@
+ #include "base/functional/bind.h"
+ #include "base/memory/ref_counted.h"
+ #include "base/run_loop.h"
++#include "base/task/sequenced_task_runner.h"
+ #include "base/test/task_environment.h"
+ #include "dbus/bus.h"
++#include "dbus/message.h"
++#include "dbus/mock_bus.h"
++#include "dbus/object_path.h"
+ #include "dbus/test_service.h"
++#include "testing/gmock/include/gmock/gmock.h"
+ #include "testing/gtest/include/gtest/gtest.h"
+ 
++using ::testing::_;
++using ::testing::Return;
++using ::testing::SetArgPointee;
++
+ namespace dbus {
+ namespace {
+ 
+@@ -36,6 +45,54 @@ class ObjectProxyTest : public testing::Test {
+   scoped_refptr<Bus> bus_;
+ };
+ 
++// Runs ObjectProxy on a MockBus, so a test can control what the bus returns
++// without a real D-Bus connection.
++class ObjectProxyMockBusTest : public testing::Test {
++ protected:
++  ObjectProxyMockBusTest() {}
++
++  void SetUp() override {
++    Bus::Options bus_options;
++    bus_options.bus_type = Bus::SESSION;
++    bus_options.connection_type = Bus::PRIVATE;
++    mock_bus_ = new MockBus(std::move(bus_options));
++
++    // Run both the origin and the D-Bus side of ObjectProxy on the test's
++    // main thread.
++    scoped_refptr<base::SequencedTaskRunner> task_runner =
++        base::SequencedTaskRunner::GetCurrentDefault();
++    EXPECT_CALL(*mock_bus_, GetOriginTaskRunner())
++        .WillRepeatedly(Return(task_runner.get()));
++    EXPECT_CALL(*mock_bus_, GetDBusTaskRunner())
++        .WillRepeatedly(Return(task_runner.get()));
++    EXPECT_CALL(*mock_bus_, AssertOnOriginThread()).WillRepeatedly(Return());
++    EXPECT_CALL(*mock_bus_, AssertOnDBusThread()).WillRepeatedly(Return());
++    EXPECT_CALL(*mock_bus_, IsConnected()).WillRepeatedly(R
```

**File**: `spec/api-app.spec.ts` (modified, +79/-0)
```diff
@@ -235,6 +235,85 @@ describe('app module', () => {
         expect(signal).toBeNull();
         expect(code).toBe(0);
       });
+
+      ifit(fs.existsSync('/usr/bin/dbus-monitor'))(
+        'fails a method call made after the bus is lost instead of crashing',
+        async () => {
+          // Runs a private dbus-daemon and returns a function that resolves
+          // once dbus-monitor has printed a line matching the pattern.
+          const startBus = async () => {
+            const daemon = cp.spawn('dbus-daemon', ['--session', '--nofork', '--print-address']);
+            defer(() => daemon.kill());
+            const [address] = await once(daemon.stdout, 'data');
+            const monitor = cp.spawn('dbus-monitor', ['--address', address.toString().trim()]);
+            defer(() => monitor.kill());
+            const lines: string[] = [];
+            const waiters = new Set<{ pattern: RegExp; resolve: () => void }>();
+            readline.createInterface({ input: monitor.stdout }).on('line', (line) => {
+              lines.push(line);
+              for (const waiter of waiters) {
+                if (waiter.pattern.test(line)) {
+                  waiters.delete(waiter);
+                  waiter.resolve();
+                }
+              }
+            });
+            const waitFor = (pattern: RegExp) =>
+              lines.some((line) => pattern.test(line))
+                ? Promise.resolve()
+                : new Promise<void>((resolve) => waiters.add({ pattern, resolve }));
+            // dbus-monitor prints NameAcquired once it is monitoring.
+            await waitFor(/member=NameAcquired/);
+            return { daemon, address: address.toString().trim(), waitFor };
+          };
+
+          // Separate buses, so that only the system bus goes away and the
+          // session bus can show what the app's D-Bus thread did afterwards.
+          const systemBus = await startBus();
+          const sessionBus = await startBus();
+          const env = {
+            ...process.env,
+            DBUS_SESSION_BUS_ADDRESS: sessionBus.address,
+            DBUS_SYSTEM_BUS_ADDRESS: systemBus.address,
+            CHROME_DESKTOP: 'electron-test.desktop'
+          };
+
+          const appProcess = cp.spawn(process.execPath, [path.join(fixturesPath, 'api', 'bus-lost-method-call')], {
+            env
+          });
+          defer(() => appProcess.kill('SIGKILL'));
+          appProcess.stdin.on('error', () => {});
+          const exited = once(appProcess, 'exit');
+          const output: string[] = [];
+          const ready = new Promise<void>((resolve) => {
+            readline.createInterface({ input: appProcess.stdout }).on('line', (line) => {
+              output.push(line);
+              if (line === 'ready') resolve();
+            });
+          });
+
+          // Wait until the app is up and its org.freedesktop.login1 proxy
+          // has connected to the system bus, then take the system bus away.
+          await ready;
+          await systemBus.waitFor(/interface='org\.freedesktop\.login1\.Manager'/);
+          systemBus.daemon.kill();
+
+          // The badge update reaches the session bus only after the D-Bus
+          // thread has started the login1 call on the lost system bus. Without
+          // the fix, that call aborts the process first.
+          const first = await Promise.race([
+            exited.then(() => 'exit'),
+            sessionBus.waitFor(/interface=com\.canonical\.Unity\.LauncherEntry; member=Update/).then(() => 'update')
+          ]);
+          if (first === 'update') appProcess.stdin.end('x');
+
+          const [code, signal] = await exited;
+          expect(signal).toBeNull();
+          expect(code).toBe(0);
+          expect(first).toBe('update');
+          expect(output).toContain('quit');
+        }
+      );
     }
   );
 
```

**File**: `spec/fixtures/api/bus-lost-method-call/main.js` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+const { app, powerMonitor } = require('electron');
+
+const fs = require('node:fs');
+
+// Only the lost D-Bus connection may end this app. That path exits without
+// 'before-quit', so this blocks any other quit, such as one from SIGTERM.
+app.on('before-quit', (event) => event.preventDefault());
+
+// Electron exits when a bus goes away, so 'quit' runs after Chromium has
+// handled the disconnect.
+app.on('quit', () => {
+  // Starts an org.freedesktop.login1 method call on the lost system bus.
+  powerMonitor.on('shutdown', () => {});
+  // Sends a signal on the session bus, which is still up. Both buses use the
+  // same D-Bus thread, so the signal goes out only after the call above.
+  app.setBadgeCount(1);
+  process.stdout.write('quit\n');
+  // Keep the process alive until the test has seen the signal.
+  fs.readSync(0, Buffer.alloc(1));
+});
+
+app.whenReady().then(() => {
+  // Creates the org.freedesktop.login1 proxy on the system bus.
+  powerMonitor.on('suspend', () => {});
+  process.stdout.write('ready\n');
+});
```

**File**: `spec/fixtures/api/bus-lost-method-call/package.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "name": "bus-lost-method-call",
+  "main": "main.js"
+}
```

---

### Incident Patch 2: `d8cc3947` (2026-10-23)
**Commit Message**: test: fix retry-reliant network and utility process specs (#55228)

* test: fix retry-reliant network and utility process specs

- startRemoteControlApp(): the remote-control app quits itself after 30s,
  but sanitizer builds give each test 180s. Slow ASan tests that were still
  talking to the app after 30s failed with "socket hang up" or hung. Pass
  the configured spec timeout as --remote-app-timeout.
- utilityProcess child-process-gone "with default serviceName": every
  unnamed utility process shares this name, and the event for a child that
  exited via process.exit() can land in the next test (as 'killed' on
  Windows). Match this child's event by its exit code.
- webRequest "requests that no blocking listener can match": replace the
  elapsed-time thresholds with a server-side log of served paths that the
  busy main process reads, so the tests check whether the request reached
  the network while the main process was blocked, not how fast it was.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LPMvJBQiyP6b7QjatACmnS

* test: keep webRequest busy-main checks independent across retries

The served-path log liv

**File**: `spec/api-utility-process.spec.ts` (modified, +19/-3)
```diff
@@ -221,10 +221,26 @@ describe('utilityProcess module', () => {
     };
 
     it('with default serviceName', async () => {
+      // Every utility process forked without a serviceName is called "Node
+      // Utility Process", so in the spec runner the event for a child of an
+      // earlier test can reach this test's listener. Fork the child in an app
+      // of its own, where it is the only process with that name.
       const name = 'Node Utility Process';
-      const crashPromise = waitForCrash(name);
-      utilityProcess.fork(path.join(fixturesPath, 'crash.js'));
-      const details = await crashPromise;
+      const { remotely } = await startRemoteControlApp();
+      const details: Electron.Details = await remotely(
+        async (fixture: string, name: string) => {
+          const { app, utilityProcess } = require('electron');
+          const gone = new Promise((resolve) => {
+            app.on('child-process-gone', (_event: Electron.Event, details: Electron.Details) => {
+              if (details.name === name) resolve(details);
+            });
+          });
+          utilityProcess.fork(fixture);
+          return gone;
+        },
+        path.join(fixturesPath, 'crash.js'),
+        name
+      );
       expect(details.type).toBe('Utility');
       expect(details.serviceName).toBe('node.mojom.NodeService');
       expect(details.name).toBe(name);
```

**File**: `spec/api-web-request.spec.ts` (modified, +82/-27)
```diff
@@ -8,6 +8,7 @@ import { once } from 'node:events';
 import * as fs from 'node:fs';
 import * as http from 'node:http';
 import * as http2 from 'node:http2';
+import * as os from 'node:os';
 import * as path from 'node:path';
 import * as qs from 'node:querystring';
 import { ReadableStream } from 'node:stream/web';
@@ -888,11 +889,21 @@ describe('webRequest module', () => {
     // Served from another process: these tests block the main process on purpose.
     let server: childProcess.ChildProcess;
     let serverURL: string;
+    // The server appends every path it answers to this file, so a test can
+    // see what reached the network while the main process is kept busy and
+    // cannot run its event loop.
+    let servedLogDir: string;
+    let servedLog: string;
     beforeAll(async () => {
-      server = childProcess.fork(path.join(fixturesPath, 'api', 'web-request', 'server.js'));
+      servedLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-web-request-'));
+      servedLog = path.join(servedLogDir, 'served.log');
+      server = childProcess.fork(path.join(fixturesPath, 'api', 'web-request', 'server.js'), [servedLog]);
       [{ url: serverURL }] = await once(server, 'message');
     });
-    afterAll(() => server.kill());
+    afterAll(() => {
+      server.kill();
+      fs.rmSync(servedLogDir, { recursive: true, force: true });
+    });
     afterEach(() => {
       ses.webRequest.onBeforeRequest(null);
       ses.webRequest.onBeforeSendHeaders(null);
@@ -904,28 +915,72 @@ describe('webRequest module', () => {
       ses.webRequest.onErrorOccurred(null);
     });
 
-    // Starts a fetch from the page, then keeps the main process busy; a request
-    // that had to visit the main process could not finish before the busy loop.
-    async function fetchWhileMainIsBusy(url: string, busyMs = 600) {
+    const served = (requestPath: string) => {
+      try {
+        return fs.readFileSync(servedLog, 'utf8').split('\n').includes(requestPath);
+      } catch {
+        return false;
+      }
+    };
+
+    // The served log lives for the whole describe block, and a vitest retry
+    // re-runs only the test body, so an attempt could otherwise find entries
+    // that requests from an earlier attempt left there. Give every request
+    // its own path, so that an entry can only come from this attempt.
+    const uniquePath = (name: string) => `/${name}-${crypto.randomUUID()}`;
+
+    // Resolves with the URL of the first onCompleted event for `url`.
+    const completedFor = (url: string) =>
+      new Promise<string>((resolve) => {
+        ses.webRequest.onCompleted((details) => {
+          if (details.url === url) resolve(details.url);
+        });
+      });
+
+    // Has the page fetch `requestPath` and, once that response is in,
+    // `requestPath?done`; then keeps the main process busy until the server
+    // has answered the second request. Both requests have to finish while the
+    // main process is busy, which a request that had to visit the main
+    // process could not do. Returns false if the round trip has not finished
+    // after `maxBusyMs`.
+    async function roundTripWhileMainIsBusy(requestPath: string, maxBusyMs = 10_000) {
+      const url = `${serverURL}${requestPath}`;
+      // The page waits a moment before it fetches so that the main process is
+      // already busy by then.
+      await contents.executeJavaScript(
+        `window.fetchDone = new Promise(r => setTimeout(() => fetch(${JSON.stringify(url)}).then(x => x.text()).then(() => fetch(${JSON.stringify(`${url}?done`)})).then(x => x.text()).then(r), 50)); true`
+      );
+      const end = Date.now() + maxBusyMs;
+      let finished = false;
+      while (!finished && Date.now() < end) {
+        finished = served(`${requestPath}?done`);
+      }
+      await contents.executeJavaScript('window.fetchDone');
+      return finished;
+    }
+
+    // Has the page fetch `requestPath` and keeps the main process busy for
+    // `busyMs`. Returns whether the request reached the server in that time.
+    async function reachedServerWhileMainIsBusy(requestPath: string, busyMs = 600) {
+      const url = `${serverURL}${requestPath}`;
       await contents.executeJavaScript(
-        `window.fetchTiming = new Promise(r => setTimeout(() => { const t = performance.now(); fetch(${JSON.stringify(url)}).then(x => x.text()).then(() => r(performance.now() - t)); }, 50)); true`
+        `window.fetchDone = new Promise(r => setTimeout(() => fetch(${JSON.stringify(url)}).then(x => x.text()).then(r), 50)); true`
       );
       const end = Date.now() + busyMs;
-      while (Date.now() < end) {
-        /* busy */
+      let reached = false;
+      while (!reached && Date.now() < end) {
+        reached = served(requestPath);
       }
-      return contents.executeJavaScript('window.fetchTiming');
+      await contents.executeJavaScript('window.fetchDone');
+      return reached;
     }
 
     it('reach the network wit
```

**File**: `spec/fixtures/api/web-request/server.js` (modified, +6/-0)
```diff
@@ -1,8 +1,14 @@
 // Serves any path with a small body from a separate process, so a spec can
 // keep the main process busy without also stalling the server.
+const fs = require('node:fs');
 const http = require('node:http');
 
+// When given a file, appends each request's path to it before answering, so a
+// spec can tell what reached the network while its main process is busy.
+const servedLog = process.argv[2];
+
 const server = http.createServer((req, res) => {
+  if (servedLog) fs.appendFileSync(servedLog, `${req.url}\n`);
   if (req.url === '/slow') {
     res.setHeader('Access-Control-Allow-Origin', '*');
     const timer = setTimeout(() => res.end(req.url), 1000);
```

**File**: `spec/lib/spec-helpers.ts` (modified, +47/-4)
```diff
@@ -116,7 +116,21 @@ class RemoteControlApp {
 
 export async function startRemoteControlApp(extraArgs: string[] = [], options?: childProcess.SpawnOptionsWithoutStdio) {
   const appPath = path.join(import.meta.dirname, '..', 'fixtures', 'apps', 'remote-control');
-  const appProcess = childProcess.spawn(process.execPath, [appPath, ...ciGpuArgs, ...extraArgs], options);
+  // The app quits by itself after --remote-app-timeout (30s unless given) in
+  // case nothing stops it. Sanitizer builds give each test 180s
+  // (ELECTRON_SPEC_TIMEOUT) and are slow enough that a test can still be
+  // talking to the app after 30s, which then fails with "socket hang up" or
+  // hangs. Keep the app alive at least as long as the test may run; defer()
+  // below stops it when the test is done.
+  const specTimeout = Number(process.env.ELECTRON_SPEC_TIMEOUT) || 30_000;
+  const timeoutArgs = extraArgs.some((arg) => arg.startsWith('--remote-app-timeout='))
+    ? []
+    : [`--remote-app-timeout=${specTimeout}`];
+  const appProcess = childProcess.spawn(
+    process.execPath,
+    [appPath, ...ciGpuArgs, ...timeoutArgs, ...extraArgs],
+    options
+  );
   // Register cleanup before awaiting the port so a stalled startup that trips
   // the test's timeout doesn't leak the child into the in-job retry.
   defer(() => {
@@ -127,13 +141,42 @@ export async function startRemoteControlApp(extraArgs: string[] = [], options?:
   appProcess.stderr.on('data', (d) => {
     process.stderr.write(d);
   });
-  const port = await new Promise<number>((resolve) => {
-    appProcess.stdout.on('data', (d) => {
+  // Fail as soon as the app goes away before it reports its port, instead of
+  // waiting for the test's timeout.
+  const port = await new Promise<number>((resolve, reject) => {
+    let stderr = '';
+    const onStderr = (d: Buffer) => {
+      stderr += d.toString();
+    };
+    const onStdout = (d: Buffer) => {
       const m = /Listening: (\d+)/.exec(d.toString());
       if (m && m[1] != null) {
+        done();
         resolve(Number(m[1]));
       }
-    });
+    };
+    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
+      done();
+      reject(
+        new Error(
+          `remote-control app exited (code ${code}, signal ${signal}) before reporting its port.\n\nstderr:\n${stderr}`
+        )
+      );
+    };
+    const onError = (err: Error) => {
+      done();
+      reject(new Error(`remote-control app failed to start: ${err.message}\n\nstderr:\n${stderr}`, { cause: err }));
+    };
+    const done = () => {
+      appProcess.stderr.off('data', onStderr);
+      appProcess.stdout.off('data', onStdout);
+      appProcess.off('exit', onExit);
+      appProcess.off('error', onError);
+    };
+    appProcess.stderr.on('data', onStderr);
+    appProcess.stdout.on('data', onStdout);
+    appProcess.on('exit', onExit);
+    appProcess.on('error', onError);
   });
   return new RemoteControlApp(appProcess, port);
 }
```

---

### Incident Patch 3: `0e77ca92` (2026-10-23)
**Commit Message**: test: wait for GDK_BACKEND fixture exit instead of a fixed 10s poll (#55222)

The GDK_BACKEND specs polled the fixture's stdout with waitUntil's fixed
10s default while ignoring its stderr, and the fixture launched a second
Electron (ELECTRON_RUN_AS_NODE) through a blocking execFileSync. On ASan
builds the two Electron launches can take longer than 10s under load, so
the test has been passing only on retry there and failed all four
attempts on main's ASan shard after the 158.0.8116.0 roll, with no output
to say why.

Wait for the fixture to exit with spawnAndWait, bounded by the per-test
timeout (which sanitizer builds raise), and put the exit code, signal,
stdout and stderr in the assertion message. Have the fixture read the
inherited variable through /bin/sh instead of a second Electron, with a
timeout on execFileSync, and exit with an error instead of hanging if
that fails.


Claude-Session: https://claude.ai/code/session_011SCvSB39Bwi5Fiyo8eAsgn

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `spec/api-app.spec.ts` (modified, +7/-10)
```diff
@@ -2041,16 +2041,13 @@ describe('app module', () => {
   ifdescribe(process.platform === 'linux')('GDK_BACKEND', () => {
     const fixture = path.join(fixturesPath, 'apps', 'gdk-backend');
     const run = async (env: NodeJS.ProcessEnv) => {
-      const child = cp.spawn(process.execPath, [fixture], { env, stdio: ['ignore', 'pipe', 'ignore'] });
-      defer(() => {
-        if (child.exitCode === null && child.signalCode === null) child.kill();
-      });
-      let out = '';
-      child.stdout.on('data', (chunk) => {
-        out += chunk;
-      });
-      await waitUntil(() => /GDK_BACKEND in child: .*\n/.test(out));
-      return out.match(/GDK_BACKEND in child: (.*)\n/)![1];
+      // Starting Electron is slow on sanitizer builds, so stay within the
+      // per-test timeout (raised there) rather than a fixed short poll.
+      const timeout = (Number(process.env.ELECTRON_SPEC_TIMEOUT) || 30_000) - 5_000;
+      const { code, signal, stdout, stderr } = await spawnAndWait(process.execPath, [fixture], { env, timeout });
+      const match = /GDK_BACKEND in child: (.*)/.exec(stdout);
+      expect(match, `exited with ${code}/${signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`).not.toBeNull();
+      return match![1];
     };
 
     it('is not added to the environment that child processes inherit', async () => {
```

**File**: `spec/fixtures/apps/gdk-backend/main.js` (modified, +12/-9)
```diff
@@ -3,13 +3,16 @@ const { app } = require('electron');
 const { execFileSync } = require('node:child_process');
 
 app.whenReady().then(() => {
-  const inherited = execFileSync(
-    process.execPath,
-    ['-e', "process.stdout.write(process.env.GDK_BACKEND ?? '<unset>')"],
-    {
-      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
-    }
-  ).toString();
-  process.stdout.write(`GDK_BACKEND in child: ${inherited}\n`);
-  app.quit();
+  try {
+    // A shell parameter expansion, not a JS template.
+    // oxlint-disable-next-line no-template-curly-in-string
+    const inherited = execFileSync('/bin/sh', ['-c', 'printf %s "${GDK_BACKEND-<unset>}"'], {
+      timeout: 10_000
+    }).toString();
+    process.stdout.write(`GDK_BACKEND in child: ${inherited}\n`);
+    app.quit();
+  } catch (error) {
+    console.error(error);
+    app.exit(1);
+  }
 });
```

#### Recent Merged Pull Requests:
- **PR #55323** (closed): fix: keep the window content view from blocking accessibility hit-tests (@avrilmai)
- **PR #55320** (closed): docs: update Windows notifications tutorial to use native toastXml (@rudy-07)
- **PR #55317** (2026-10-25): build: update PGO profiles (@electron-pgo-updater[bot])
- **PR #55316** (2026-10-25): build: update PGO profiles (@electron-pgo-updater[bot])
- **PR #55315** (2026-10-25): build: update PGO profiles (@electron-pgo-updater[bot])
- **PR #55314** (2026-10-25): build: update PGO profiles (@electron-pgo-updater[bot])

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

## X. handle a null pending call in dbus::ObjectProxy (#55236)

**RULE**:
When implementing operations in `patches/chromium/.patches`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in electron/electron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a6d4549e`: handle a null pending call in dbus::ObjectProxy (#55236). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `patches/chromium/.patches`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
fix_handle_a_null_pending_call_in_dbus_objectproxy.patch
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a6d4549e` are properly handled with clean fallback behavior.
