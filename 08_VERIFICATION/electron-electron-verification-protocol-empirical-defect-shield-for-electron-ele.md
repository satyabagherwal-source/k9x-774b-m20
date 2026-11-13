# Verification Protocol: Verification Protocol: Empirical Defect Shield for electron/electron

<!-- PROVENANCE_START
{
  "source_repository": "electron/electron",
  "source_url": "https://github.com/electron/electron",
  "source_version": "cb318e5a",
  "license": "MIT",
  "timestamp": "2026-11-13T15:18:32.725Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-electron-electron",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [electron/electron](https://github.com/electron/electron) (Revision: `cb318e5a`).  
> **License**: MIT | **Timestamp**: `2026-11-13T15:18:32.725Z`  
> **Learning ID**: `learn-github-electron-electron`


## 1. Scope & Verification Target
- **Target Repository**: `electron/electron` (Commit: `cb318e5a`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): electron/electron

> **Canonical Artifact**: `07_PROJECT_LEARNING/electron-electron-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/electron/electron](https://github.com/electron/electron))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T15:18:32.132Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `electron/electron`
- **Description**: :electron: Build cross-platform desktop apps with JavaScript, HTML, and CSS
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 123888 stars

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
- **Issue #55787** (2026-11-13): **chore: cherry-pick 6e7047bfc51a from chromium**
  *Symptoms*: <!-- claude-slack-attribution --> _Requested by **Keeley Hammond**_  #### Description of Change  Cherry-pick of https://chromium-review.googlesource.com/c/chromium/src/+/8773412.  #### Release Notes  Notes: none  --- _Generated by [Claude Code](https://claude.ai/code/session_01JbwhJtyZNvyTVVxjxUGvLA)_
  **Post-Mortem & Fix Analysis**:
  > **No Release Notes**

- **Issue #55786** (2026-11-13): **chore: cherry-pick 6e7047bfc51a from chromium**
  *Symptoms*: <!-- claude-slack-attribution --> _Requested by **Keeley Hammond**_  #### Description of Change  Cherry-pick of https://chromium-review.googlesource.com/c/chromium/src/+/8773412.  #### Release Notes  Notes: none  --- _Generated by [Claude Code](https://claude.ai/code/session_01JbwhJtyZNvyTVVxjxUGvLA)_
  **Post-Mortem & Fix Analysis**:
  > **No Release Notes**

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

### Incident Patch 1: `295785f5` (2026-11-12)
**Commit Message**: fix: flush cookie stores to disk before quitting (#55745)

* fix: flush cookie stores to disk before quitting

Cookies set shortly before quit were only committed to disk while the
network service tore down each NetworkContext. If the network service
died during that teardown (e.g. the MessagePumpEpoll UBSan abort on
linux-x64-ubsan), the cookies were lost. Mirror Chrome's
browser_shutdown.cc: flush every loaded storage partition when shutdown
starts, and wait (up to 5s) for the cookie stores to report they are on
disk before quitting the main message loop.

Also disable retries for spec/api-session.spec.ts.

Fixes #55395

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* refactor: flush storage partitions fire-and-forget at shutdown

Per review, copy Chrome's OnShutdownStarting() fire-and-forget flush
and rely on BrowserProcessIOThread::ProcessHostCleanUp()'s existing
grace period for the network service instead of delaying quit on the
flush callbacks. Start the flush before the PGO profiling wait.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/api/cookies.md` (modified, +1/-1)
```diff
@@ -132,6 +132,6 @@ Returns `Promise<void>` - A promise which resolves when the cookie store has bee
 
 Writes any unwritten cookies data to disk.
 
-Cookies written by any method will not be written to disk immediately, but will be written every 30 seconds or 512 operations.
+Cookies written by any method will not be written to disk immediately, but will be written every 30 seconds or 512 operations, and when the app quits.
 
 Calling this method can cause the cookie to be written to disk immediately.
```

**File**: `shell/browser/browser.cc` (modified, +14/-0)
```diff
@@ -18,8 +18,11 @@
 #include "base/threading/thread_restrictions.h"
 #include "build/config/compiler/compiler_buildflags.h"
 #include "chrome/common/chrome_paths.h"
+#include "content/public/browser/storage_partition.h"
 #include "gin/arguments.h"
+#include "services/network/public/mojom/cookie_manager.mojom.h"
 #include "shell/browser/browser_observer.h"
+#include "shell/browser/electron_browser_context.h"
 #include "shell/browser/electron_browser_main_parts.h"
 #include "shell/browser/native_window.h"
 #include "shell/browser/window_list.h"
@@ -172,6 +175,17 @@ void Browser::Shutdown() {
 
   observers_.Notify(&BrowserObserver::OnQuit);
 
+  // Start flushing cookies and DOM storage now so persistence overlaps with
+  // the rest of shutdown. Mirrors browser_shutdown::OnShutdownStarting().
+  for (auto* browser_context : ElectronBrowserContext::BrowserContexts()) {
+    browser_context->ForEachLoadedStoragePartition(
+        [](content::StoragePartition* partition) {
+          partition->GetCookieManagerForBrowserProcess()->FlushCookieStore(
+              base::NullCallback());
+          partition->Flush();
+        });
+  }
+
 #if BUILDFLAG(CLANG_PROFILING_INSIDE_SANDBOX) && BUILDFLAG(CLANG_PGO_PROFILING)
   // In PGO-instrumented builds, sandboxed child processes write their
   // profile counters through a file handle the browser gave them, and they
```

**File**: `spec/api-session.spec.ts` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ import {
 } from './lib/spec-helpers.ts';
 import { closeAllWindows } from './lib/window-helpers.ts';
 
-describe('session module', () => {
+describe('session module', { retry: 0 }, () => {
   const fixtures = path.resolve(import.meta.dirname, 'fixtures');
   const url = 'http://127.0.0.1';
 
```

---

### Incident Patch 2: `0b0dd43c` (2026-11-11)
**Commit Message**: fix: block the revoked eMudhra RSA intermediates (#55738)

eMudhra revoked the eight RSA (G2B/G2C) intermediates from the same key
ceremony as the ECDSA set blocked in October, because their private keys
were handled outside a cryptographic module. They still chain to roots
Electron trusts, so add their SPKI hashes to both the Chromium net
blocklist and Node's list.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `patches/chromium/.patches` (modified, +1/-0)
```diff
@@ -142,3 +142,4 @@ feat_update_executioncontext_api.patch
 use_forward_slashes_for_the_default_crdtp_include_dir_in_templates.patch
 feat_let_the_macos_native_picker_offer_windows_apps_and_screens.patch
 build_guard_the_openxr_browser_tests_in_xr_browser_tests_vr_required.patch
+add_entries_to_the_spki_blocklist.patch
```

**File**: `patches/chromium/add_entries_to_the_spki_blocklist.patch` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+From 0000000000000000000000000000000000000000 Mon Sep 17 00:00:00 2001
+From: clavin <clavin@electronjs.org>
+Date: Wed, 11 Nov 2026 12:48:43 -0800
+Subject: Add entries to the SPKI blocklist
+
+Adds public key hashes of intermediates that their CA has revoked but
+that would still chain to a trusted root. Chrome can withdraw trust in
+these through the CRLSet component, which Electron does not consume, so
+they are carried in the compiled-in list instead. The comment above each
+entry is the SHA-256 fingerprint of the corresponding certificate.
+
+This patch can be removed once the hashes land in the upstream blocklist.
+
+diff --git a/net/cert/cert_verify_proc_blocklist.inc b/net/cert/cert_verify_proc_blocklist.inc
+index c196d03ef8b37db69c589a18d91f3668ad622476..d7208ffede81937341186f5af3425862ea97e4f8 100644
+--- a/net/cert/cert_verify_proc_blocklist.inc
++++ b/net/cert/cert_verify_proc_blocklist.inc
+@@ -450,7 +450,39 @@ static constexpr uint8_t
+         // 9e39de2881273acc225a149c72ba3e0f51424963669ab633ee1dc7df5db067b4.pem
+         {0xec, 0x4f, 0xfa, 0x1a, 0xd0, 0xac, 0x88, 0x08, 0x13, 0x14, 0xb7, 0xaa,
+          0xff, 0xef, 0x6a, 0x91, 0xf9, 0x7c, 0xd5, 0x72, 0x91, 0xbb, 0x5b, 0xa6,
+-         0x86, 0xc5, 0x41, 0x5f, 0x5e, 0xb4, 0xf6, 0xb6}
++         0x86, 0xc5, 0x41, 0x5f, 0x5e, 0xb4, 0xf6, 0xb6},
++        // 829ec444b8be3dfd2d030a0d9e7a1d0dd2a3c2c325d39589c27ac9a065bae793.pem
++        {0x04, 0xdb, 0x3b, 0x7d, 0xdf, 0x68, 0x3b, 0x1d, 0x4b, 0x5b, 0x64,
++         0xfe, 0x74, 0x3a, 0x3a, 0x8d, 0x8c, 0x3d, 0x71, 0xf0, 0xc3, 0x39,
++         0xd7, 0xdc, 0x25, 0xb3, 0x43, 0xe6, 0x65, 0xa9, 0xeb, 0x5b},
++        // 0427ea3cb4a7b4cb205e77a7b166d332bedb8e8ef469bc5e883169c8d0ac876d.pem
++        {0x34, 0x55, 0x68, 0x38, 0x28, 0x16, 0x88, 0xd1, 0xc9, 0x67, 0xd4,
++         0x3d, 0x13, 0x72, 0xa1, 0xbb, 0xaf, 0x38, 0x92, 0x77, 0x22, 0x2f,
++         0x03, 0xe1, 0x01, 0x7b, 0x18, 0xb3, 0x48, 0xa1, 0xf0, 0x0e},
++        // 6a7a93861982b664001710a0efd04c8a72f6a23e252b280911797e0bf1bd9012.pem
++        {0x84, 0x29, 0x35, 0x10, 0x35, 0xba, 0x90, 0xba, 0x14, 0xef, 0x3f,
++         0x7a, 0xe3, 0x8c, 0xa3, 0x54, 0x80, 0x60, 0x5a, 0x02, 0x96, 0xaa,
++         0x6c, 0x26, 0x3c, 0x6a, 0x9b, 0x26, 0xbb, 0x9a, 0x48, 0xe1},
++        // de767792e870bd32f331029fc89dc24c53f9df970dc70f1ea30cf29db3f94ba9.pem
++        {0xaa, 0x42, 0x16, 0xdc, 0x80, 0xa7, 0x29, 0x9a, 0xe6, 0xde, 0x08,
++         0x44, 0x4b, 0xea, 0x2c, 0x58, 0x8d, 0xc8, 0x73, 0x63, 0x1e, 0xbc,
++         0x56, 0x3c, 0x07, 0x76, 0xd8, 0x3a, 0x1b, 0x61, 0xe3, 0xce},
++        // e072b30d7f5b8bcf0080e51d6cc7765767072db2319e9bb1cd3d02a086898750.pem
++        {0xc2, 0x69, 0x0b, 0x6b, 0xf3, 0x5a, 0x93, 0x64, 0xe6, 0x97, 0x73,
++         0x5e, 0xc6, 0x30, 0xbf, 0xd9, 0xd2, 0xcd, 0x59, 0x04, 0x0e, 0x39,
++         0x08, 0xa6, 0x67, 0x65, 0x16, 0x8e, 0x32, 0x82, 0xb0, 0x4e},
++        // c3bc2b480fb1a1ab4d0ba1ed6c7b53e096447045733620991a32d6798d77aa20.pem
++        {0x1a, 0x94, 0x2e, 0x39, 0x25, 0xb8, 0x09, 0x89, 0x6b, 0x4b, 0x29,
++         0x1a, 0x8c, 0xd2, 0xe7, 0xbc, 0x5f, 0x1d, 0x53, 0x3a, 0xa5, 0x23,
++         0xb8, 0x35, 0x3b, 0x2d, 0xf3, 0x77, 0xb0, 0xf0, 0xad, 0xbe},
++        // 913f1a04b02814b604ac5275acb201b1c802b2c0f1b4986fb1a1eb595958e072.pem
++        {0x01, 0x69, 0x61, 0x35, 0x48, 0x12, 0x3d, 0xab, 0x14, 0xaf, 0xff,
++         0xcb, 0x5a, 0x3f, 0x0e, 0x80, 0x4c, 0x70, 0xac, 0x90, 0x3f, 0x29,
++         0xec, 0xad, 0x55, 0xed, 0x43, 0xdc, 0x75, 0xf1, 0x38, 0x81},
++        // ebac91b8ec9853323779edb393c595fadb29dd4ddb20c47e336f2a021684f27b.pem
++        {0xc0, 0x73, 0xef, 0xb3, 0x14, 0x22, 0xff, 0x4d, 0xb9, 0x9d, 0xc2,
++         0x4d, 0x74, 0x42, 0x43, 0x8e, 0x94, 0x2c, 0x73, 0xcd, 0x3c, 0x61,
++         0xb5, 0x29, 0xa8, 0xba, 0x32, 0x54, 0x2e, 0x94, 0x6b, 0x86}
+ };
+ 
+ // Hashes of SubjectPublicKeyInfos known to be used for interception by a
```

**File**: `patches/node/tls_adapt_the_upstream_spki_blocklist_for_electron.patch` (modified, +55/-3)
```diff
@@ -13,12 +13,64 @@ Electron still needs on top of it:
 - Upstream only exposes the test-only list extension through
   internalBinding('crypto'). Export C++ hooks that share the same list
   and mutex so Electron's testing binding can extend it at runtime.
+- Add entries that are not yet in the upstream list, mirroring the ones
+  Electron adds to Chromium's net blocklist.
 
 diff --git a/src/crypto/crypto_context.cc b/src/crypto/crypto_context.cc
-index 05e8e5f85c0ba67b90f48278a40f4a5bc8f0b37a..245ec85ee805e4339edf639888a16b7cd2734e93 100644
+index 05e8e5f85c0ba67b90f48278a40f4a5bc8f0b37a..ce1f724ea7c7b00afceefbb1fbbded2ce87cd9ac 100644
 --- a/src/crypto/crypto_context.cc
 +++ b/src/crypto/crypto_context.cc
-@@ -1494,12 +1494,12 @@ SpkiCheck CheckSPKIs(const STACK_OF(X509) * certs,
+@@ -1437,6 +1437,49 @@ constexpr SpkiHash kBlockedSPKIs[] = {
+     {0xe0, 0x25, 0x4c, 0x7f, 0xcd, 0xc2, 0x65, 0xe2, 0xf0, 0xf8, 0xa4,
+      0x28, 0xda, 0xbb, 0x75, 0xab, 0x4a, 0xe0, 0x39, 0xb4, 0x87, 0x2d,
+      0x62, 0xf5, 0xee, 0x57, 0xf0, 0x87, 0x7d, 0x5a, 0x8a, 0x41},
++    // The RSA (G2B/G2C) intermediates from the same key ceremony, revoked
++    // in November 2026 because their private keys were handled outside a
++    // cryptographic module and cannot be shown to have stayed confidential.
++    // 829ec444b8be3dfd2d030a0d9e7a1d0dd2a3c2c325d39589c27ac9a065bae793
++    // C=NL, O=eMudhra BV, CN=EM DV TLS CA - G2B
++    {0x04, 0xdb, 0x3b, 0x7d, 0xdf, 0x68, 0x3b, 0x1d, 0x4b, 0x5b, 0x64,
++     0xfe, 0x74, 0x3a, 0x3a, 0x8d, 0x8c, 0x3d, 0x71, 0xf0, 0xc3, 0x39,
++     0xd7, 0xdc, 0x25, 0xb3, 0x43, 0xe6, 0x65, 0xa9, 0xeb, 0x5b},
++    // 0427ea3cb4a7b4cb205e77a7b166d332bedb8e8ef469bc5e883169c8d0ac876d
++    // C=US, O=eMudhra Inc, CN=EM DV TLS CA - G2C
++    {0x34, 0x55, 0x68, 0x38, 0x28, 0x16, 0x88, 0xd1, 0xc9, 0x67, 0xd4,
++     0x3d, 0x13, 0x72, 0xa1, 0xbb, 0xaf, 0x38, 0x92, 0x77, 0x22, 0x2f,
++     0x03, 0xe1, 0x01, 0x7b, 0x18, 0xb3, 0x48, 0xa1, 0xf0, 0x0e},
++    // 6a7a93861982b664001710a0efd04c8a72f6a23e252b280911797e0bf1bd9012
++    // C=NL, O=eMudhra BV, CN=EM OV TLS CA - G2B
++    {0x84, 0x29, 0x35, 0x10, 0x35, 0xba, 0x90, 0xba, 0x14, 0xef, 0x3f,
++     0x7a, 0xe3, 0x8c, 0xa3, 0x54, 0x80, 0x60, 0x5a, 0x02, 0x96, 0xaa,
++     0x6c, 0x26, 0x3c, 0x6a, 0x9b, 0x26, 0xbb, 0x9a, 0x48, 0xe1},
++    // de767792e870bd32f331029fc89dc24c53f9df970dc70f1ea30cf29db3f94ba9
++    // C=US, O=eMudhra Inc, CN=EM OV TLS CA - G2C
++    {0xaa, 0x42, 0x16, 0xdc, 0x80, 0xa7, 0x29, 0x9a, 0xe6, 0xde, 0x08,
++     0x44, 0x4b, 0xea, 0x2c, 0x58, 0x8d, 0xc8, 0x73, 0x63, 0x1e, 0xbc,
++     0x56, 0x3c, 0x07, 0x76, 0xd8, 0x3a, 0x1b, 0x61, 0xe3, 0xce},
++    // e072b30d7f5b8bcf0080e51d6cc7765767072db2319e9bb1cd3d02a086898750
++    // C=NL, O=eMudhra BV, CN=EM EV TLS CA - G2B
++    {0xc2, 0x69, 0x0b, 0x6b, 0xf3, 0x5a, 0x93, 0x64, 0xe6, 0x97, 0x73,
++     0x5e, 0xc6, 0x30, 0xbf, 0xd9, 0xd2, 0xcd, 0x59, 0x04, 0x0e, 0x39,
++     0x08, 0xa6, 0x67, 0x65, 0x16, 0x8e, 0x32, 0x82, 0xb0, 0x4e},
++    // c3bc2b480fb1a1ab4d0ba1ed6c7b53e096447045733620991a32d6798d77aa20
++    // C=US, O=eMudhra Inc, CN=EM EV TLS CA - G2C
++    {0x1a, 0x94, 0x2e, 0x39, 0x25, 0xb8, 0x09, 0x89, 0x6b, 0x4b, 0x29,
++     0x1a, 0x8c, 0xd2, 0xe7, 0xbc, 0x5f, 0x1d, 0x53, 0x3a, 0xa5, 0x23,
++     0xb8, 0x35, 0x3b, 0x2d, 0xf3, 0x77, 0xb0, 0xf0, 0xad, 0xbe},
++    // 913f1a04b02814b604ac5275acb201b1c802b2c0f1b4986fb1a1eb595958e072
++    // C=NL, O=eMudhra BV, CN=EM OV CS CA - G2B
++    {0x01, 0x69, 0x61, 0x35, 0x48, 0x12, 0x3d, 0xab, 0x14, 0xaf, 0xff,
++     0xcb, 0x5a, 0x3f, 0x0e, 0x80, 0x4c, 0x70, 0xac, 0x90, 0x3f, 0x29,
++     0xec, 0xad, 0x55, 0xed, 0x43, 0xdc, 0x75, 0xf1, 0x38, 0x81},
++    // ebac91b8ec9853323779edb393c595fadb29dd4ddb20c47e336f2a021684f27b
++    // C=US, O=eMudhra Inc, CN=EM OV CS CA - G2C
++    {0xc0, 0x73, 0xef, 0xb3, 0x14, 0x22, 0xff, 0x4d, 0xb9, 0x9d, 0xc2,
++     0x4d, 0x74, 0x42, 0x43, 0x8e, 0x94, 0x2c, 0x73, 0xcd, 0x3c, 0x61,
++     0xb5, 0x29, 0xa8, 0xba, 0x32, 0x54, 0x2e, 0x94, 0x6b, 0x86},
+ };
+ 
+ // Extra entries registered by the test-only hooks on the crypto binding.
+@@ -1494,12 +1537,12 @@ SpkiCheck CheckSPKIs(const STACK_OF(X509) * certs,
                       X509** offender,
                       int* depth) {
    if (certs == nullptr) return SpkiCheck::kAllowed;
@@ -33,7 +85,7 @@ index 05e8e5f85c0ba67b90f48278a40f4a5bc8f0b37a..245ec85ee805e4339edf639888a16b7c
        return result;
      }
    }
-@@ -1603,6 +1603,18 @@ void InstallCertVerifyCallback(SSL_CTX* ctx) {
+@@ -1603,6 +1646,18 @@ void InstallCertVerifyCallback(SSL_CTX* ctx) {
    SSL_CTX_set_cert_verify_callback(ctx, CertVerifyCallback, nullptr);
  }
  
```

---

### Incident Patch 3: `3ee09e17` (2026-11-12)
**Commit Message**: build(deps): bump github/codeql-action/upload-sarif from 4.39.1 to 4.39.2 (#55730)

build(deps): bump github/codeql-action/upload-sarif

Bumps [github/codeql-action/upload-sarif](https://github.com/github/codeql-action) from 4.39.1 to 4.39.2.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/9b3254085494b55a0f7c4c2b3d2d52cc712ce370...1fc58d04a4d4374f921bdac573c3811c240f9c26)

---
updated-dependencies:
- dependency-name: github/codeql-action/upload-sarif
  dependency-version: 4.39.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/scorecards.yml` (modified, +1/-1)
```diff
@@ -51,6 +51,6 @@ jobs:
 
       # Upload the results to GitHub's code scanning dashboard.
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@9b3254085494b55a0f7c4c2b3d2d52cc712ce370 # v4.39.1
+        uses: github/codeql-action/upload-sarif@1fc58d04a4d4374f921bdac573c3811c240f9c26 # v4.39.2
         with:
           sarif_file: results.sarif
```

#### Recent Merged Pull Requests:
- **PR #55787** (2026-11-13): chore: cherry-pick 6e7047bfc51a from chromium (@claude[bot])
- **PR #55786** (2026-11-13): chore: cherry-pick 6e7047bfc51a from chromium (@claude[bot])
- **PR #55785** (2026-11-13): chore: cherry-pick 6e7047bfc51a from chromium (@claude[bot])
- **PR #55783** (2026-11-12): build: update PGO profiles (@electron-pgo-updater[bot])
- **PR #55782** (2026-11-12): chore: remove upstreamed skia patch (@claude[bot])
- **PR #55780** (2026-11-13): chore: bump chromium to 160.0.8158.0 (main) (@electron-roller[bot])

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

## X. flush cookie stores to disk before quitting (#55745)

**RULE**:
When implementing operations in `docs/api/cookies.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in electron/electron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `295785f5`: flush cookie stores to disk before quitting (#55745). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/api/cookies.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
Cookies written by any method will not be written to disk immediately, but will be written every 30 seconds or 512 operations, and when the app quits.
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
Cookies written by any method will not be written to disk immediately, but will be written every 30 seconds or 512 operations.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `295785f5` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
