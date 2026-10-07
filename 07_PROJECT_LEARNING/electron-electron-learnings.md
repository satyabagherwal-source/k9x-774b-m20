# Forensic Learning Record (Deep Inspection): electron/electron

> **Canonical Artifact**: `07_PROJECT_LEARNING/electron-electron-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/electron/electron](https://github.com/electron/electron))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:26:21.640Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `electron/electron`
- **Description**: :electron: Build cross-platform desktop apps with JavaScript, HTML, and CSS
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 123424 stars

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

### Core Architecture Module: `lib/renderer/api/web-frame.ts`
```
const { mainFrame } = process._linkedBinding('electron_renderer_web_frame');

export default mainFrame;

```

### Core Architecture Module: `lib/renderer/api/web-utils.ts`
```
const binding = process._linkedBinding('electron_renderer_web_utils');

export const getPathForFile = binding.getPathForFile;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #54729** (2026-10-07): **[Bug]: Spellcheck reports no misspellings on Windows since Electron 41**
  *Symptoms*: ### Preflight Checklist  - [X] I have read the [Contributing Guidelines](https://github.com/electron/electron/blob/main/CONTRIBUTING.md) for this project. - [X] I agree to follow the [Code of Conduct](https://github.com/electron/electron/blob/main/CODE_OF_CONDUCT.md) that this project adheres to. - [X] I have searched the issue tracker for a bug report that matches the one I want to file, without success.  ### Electron Version  44.4.3  ### What operating system(s) are you using?  Windows  ### Operating System Version  Windows 11 Pro 10.0.26200 (build 26200), x64  ### What arch are you using?  x64  ### Last Known Working Electron version  40.10.6  ### Expected Behavior  Typing misspelled words into a `contenteditable` (or `<textarea>`) with `spellcheck="true"`, in a window created with `webPreferences: { spellcheck: true }`, should underline them and populate `params.misspelledWord` / `params.dictionarySuggestions` on the `context-menu` event.  This is what happens on Electron 40 and earlier.  ### Actual Behavior  Nothing is underlined, and `params.misspelledWord` is always `""` with `params.dictionarySuggestions` `[]`, even when right-clicking directly on a misspelled word.  `session.isSpellCheckerEnabled()` returns `true` and `session.getSpellCheckerLanguages()` returns `["en-US"]`, and the `spellcheck-dictionary-initialized` event fires for `en-US` — so the spell checker reports itself as working while flagging nothing.  Running the testcase below:  ``` # Electron 40.10.6 s
  **Post-Mortem & Fix Analysis**:
  > <!-- issue-template-check -->  Hello @MarioBava. Thanks for taking the time to open an issue and helping to make Electron better!  This issue was automatically closed because its body does not follow any of this repository's issue templates. Maintainers rely on the sections in those templates to triage issues, and issues that are missing them usually cannot be acted upon.  To get this issue triaged, please either:  * Edit the issue body above to include all of the sections from one of our [issue templates](https://github.com/electron/electron/tree/main/.github/ISSUE_TEMPLATE) - it will be reopened automatically once it does, or * File a new issue via https://github.com/electron/electron/issues/new/choose, which will fill in the correct template for you.

- **Issue #54712** (2026-10-07): **test: keep visibility specs' windows on top on the Windows CI desktop**
  *Symptoms*: Backport of #54334  See that PR for details.   Notes: none 
  **Post-Mortem & Fix Analysis**:
  > **No Release Notes**

- **Issue #54711** (2026-10-07): **test: keep visibility specs' windows on top on the Windows CI desktop**
  *Symptoms*: Backport of #54334  See that PR for details.   Notes: none 
  **Post-Mortem & Fix Analysis**:
  > **No Release Notes**

- **Issue #54709** (2026-10-07): **test: stop updater preparation on cancellation**
  *Symptoms*: Backport of #54114  See that PR for details.   Notes: none
  **Post-Mortem & Fix Analysis**:
  > **No Release Notes**

- **Issue #54708** (2026-10-07): **test: turn accessibility back off after the app a11y specs**
  *Symptoms*: Backport of #54075  See that PR for details.   Notes: none 
  **Post-Mortem & Fix Analysis**:
  > **No Release Notes**

- **Issue #54707** (2026-10-07): **test: remove transparent-window paint wait**
  *Symptoms*: Backport of #54111  See that PR for details.   Notes: none
  **Post-Mortem & Fix Analysis**:
  > **No Release Notes**

- **Issue #54706** (2026-10-07): **test: re-enable missing-file load failure**
  *Symptoms*: Backport of #54039  See that PR for details.   Notes: none
  **Post-Mortem & Fix Analysis**:
  > **No Release Notes**

- **Issue #54705** (2026-10-07): **test: re-enable the loadURL data URL base test**
  *Symptoms*: Backport of #54026  See that PR for details.   Notes: none
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

### Incident Patch 1: `75d042de` (2026-10-07)
**Commit Message**: fix: block WSL UNC paths in File System Access sensitive directory checks (#54676)

Port the upstream Chromium fix onto Electron's copy of MaybeIsLocalUNCPath()
so that `wsl.localhost` and `wsl.localhost.` UNC hosts are treated as local
(case-insensitive) and blocked like other local UNC paths.

Refs https://chromium-review.googlesource.com/c/chromium/src/+/8341352 (upstream commit bc5a321c6196db0a2de36f1fe3e4fab977b10007)


Claude-Session: https://claude.ai/code/session_018khRcY1YYaYT95VfQQiaGj

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `shell/browser/file_system_access/file_system_access_permission_context.cc` (modified, +6/-0)
```diff
@@ -121,6 +121,8 @@ constexpr base::TimeDelta kPermissionRevocationTimeout = base::Seconds(5);
   });
 }
 
+// Returns true if the path is a Universal Naming Convention (UNC) path pointing
+// to a local system path, device namespace, or WSL loopback redirector.
 bool MaybeIsLocalUNCPath(const base::FilePath& path) {
   if (!path.IsNetwork()) {
     return false;
@@ -135,6 +137,10 @@ bool MaybeIsLocalUNCPath(const base::FilePath& path) {
   if (components.size() >= 2 &&
       (base::FilePath::CompareEqualIgnoreCase(components[1],
                                               FILE_PATH_LITERAL("localhost")) ||
+       base::FilePath::CompareEqualIgnoreCase(
+           components[1], FILE_PATH_LITERAL("wsl.localhost")) ||
+       base::FilePath::CompareEqualIgnoreCase(
+           components[1], FILE_PATH_LITERAL("wsl.localhost.")) ||
        components[1] == FILE_PATH_LITERAL("127.0.0.1") ||
        components[1] == FILE_PATH_LITERAL(".") ||
        components[1] == FILE_PATH_LITERAL("?") ||
```

---

### Incident Patch 2: `515e4230` (2026-10-07)
**Commit Message**: build(deps): bump github/codeql-action/upload-sarif from 4.38.1 to 4.38.2 (#54680)

build(deps): bump github/codeql-action/upload-sarif

Bumps [github/codeql-action/upload-sarif](https://github.com/github/codeql-action) from 4.38.1 to 4.38.2.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/1c5b675653bb5c22dbe9b12b556ec555138e09fd...2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2)

---
updated-dependencies:
- dependency-name: github/codeql-action/upload-sarif
  dependency-version: 4.38.2
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
-        uses: github/codeql-action/upload-sarif@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/upload-sarif@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
         with:
           sarif_file: results.sarif
```

---

### Incident Patch 3: `1b9edefd` (2026-10-06)
**Commit Message**: fix(net): support non-ASCII headers and multiple cookies in net.fetch (#53550)

* fix(net): support non-ASCII headers and multiple cookies in net.fetch

* fix: address PR review feedback on protocol handler header collapse and request aborts

**File**: `lib/browser/api/net-fetch.ts` (modified, +30/-19)
```diff
@@ -1,4 +1,4 @@
-import { allowAnyProtocol } from '@electron/internal/common/api/net-client-request';
+import { allowAnyProtocol, toByteString } from '@electron/internal/common/api/net-client-request';
 
 import { ClientRequestConstructorOptions, ClientRequest, IncomingMessage, Session as SessionT } from 'electron/main';
 
@@ -110,25 +110,36 @@ export function fetchWithSession(
 
   r.on('response', (resp: IncomingMessage) => {
     if (locallyAborted) return;
-    const headers = new Headers();
-    for (const [k, v] of Object.entries(resp.headers)) {
-      headers.set(k, Array.isArray(v) ? v.join(', ') : v);
+    try {
+      const headers = new Headers();
+      for (const [k, v] of Object.entries(resp.headers)) {
+        if (Array.isArray(v)) {
+          for (const item of v) {
+            headers.append(k, toByteString(item));
+          }
+        } else if (typeof v === 'string') {
+          headers.set(k, toByteString(v));
+        }
+      }
+      const nullBodyStatus = [101, 204, 205, 304];
+      const body =
+        nullBodyStatus.includes(resp.statusCode) || req.method === 'HEAD'
+          ? null
+          : (Readable.toWeb(resp as unknown as Readable) as ReadableStream);
+      const rResp = new Response(body, {
+        headers,
+        status: resp.statusCode,
+        statusText: resp.statusMessage
+      });
+      (rResp as any).__original_resp = resp;
+      // protocol.handle relays a Response that comes back untouched without
+      // pumping its body through JS; it needs the loader and the exact stream.
+      if (body) (rResp as any).__fetch = { request: r, body: rResp.body };
+      p.resolve(rResp);
+    } catch (err: any) {
+      r.abort();
+      p.reject(err);
     }
-    const nullBodyStatus = [101, 204, 205, 304];
-    const body =
-      nullBodyStatus.includes(resp.statusCode) || req.method === 'HEAD'
-        ? null
-        : (Readable.toWeb(resp as unknown as Readable) as ReadableStream);
-    const rResp = new Response(body, {
-      headers,
-      status: resp.statusCode,
-      statusText: resp.statusMessage
-    });
-    (rResp as any).__original_resp = resp;
-    // protocol.handle relays a Response that comes back untouched without
-    // pumping its body through JS; it needs the loader and the exact stream.
-    if (body) (rResp as any).__fetch = { request: r, body: rResp.body };
-    p.resolve(rResp);
   });
 
   r.on('error', (err) => {
```

**File**: `lib/browser/api/protocol.ts` (modified, +26/-2)
```diff
@@ -1,3 +1,5 @@
+import { toByteString } from '@electron/internal/common/api/net-client-request';
+
 import { ProtocolRequest, session } from 'electron/main';
 
 import { createReadStream } from 'fs';
@@ -158,7 +160,18 @@ Protocol.prototype.handle = function (
   const success = register.call(this, scheme, async (preq: ProtocolRequest, cb: any) => {
     try {
       const body = convertToRequestBody(preq.uploadData);
-      const headers = new Headers(preq.headers);
+      const headers = new Headers();
+      if (preq.headers) {
+        for (const [k, v] of Object.entries(preq.headers)) {
+          if (Array.isArray(v)) {
+            for (const item of v) {
+              headers.append(k, toByteString(item));
+            }
+          } else if (typeof v === 'string') {
+            headers.set(k, toByteString(v));
+          }
+        }
+      }
       if (headers.get('origin') === 'null') {
         headers.delete('origin');
       }
@@ -178,8 +191,19 @@ Protocol.prototype.handle = function (
       } else if (res.type === 'error') {
         cb({ error: ERR_FAILED });
       } else {
+        const headersObj: Record<string, string | string[]> = {};
+        if (res.headers) {
+          for (const [k, v] of res.headers) {
+            if (k === 'set-cookie') {
+              if (!headersObj[k]) headersObj[k] = [];
+              (headersObj[k] as string[]).push(v);
+            } else {
+              headersObj[k] = v;
+            }
+          }
+        }
         const head = {
-          headers: res.headers ? Object.fromEntries(res.headers) : {},
+          headers: headersObj,
           statusCode: res.status,
           statusText: res.statusText,
           mimeType: (res as any).__original_resp?._responseHead?.mimeType
```

**File**: `lib/common/api/net-client-request.ts` (modified, +10/-0)
```diff
@@ -200,6 +200,16 @@ export function allowAnyProtocol(opts: ClientRequestConstructorOptions): ClientR
   } as any;
 }
 
+export function toByteString(val: string): string {
+  if (typeof val !== 'string') return String(val);
+  for (let i = 0; i < val.length; i++) {
+    if (val.charCodeAt(i) > 255) {
+      return Buffer.from(val, 'utf-8').toString('latin1');
+    }
+  }
+  return val;
+}
+
 type ExtraURLLoaderOptions = {
   redirectPolicy: RedirectPolicy;
   headers: Record<string, { name: string; value: string | string[] }>;
```

**File**: `spec/api-net.spec.ts` (modified, +33/-0)
```diff
@@ -2012,6 +2012,39 @@ describe('net module', () => {
           expect(r.status).to.equal(200);
           await expect(r.text()).to.be.rejectedWith(/ERR_INCOMPLETE_CHUNKED_ENCODING/);
         });
+
+        test('can handle non-ASCII characters in response headers', async () => {
+          const filename = 'zażółć.txt';
+          const headerValue = `attachment; filename="${filename}"`;
+          const serverUrl = await respondOnce.toSingleURL((request, response) => {
+            response.setHeader('content-disposition', Buffer.from(headerValue, 'utf-8').toString('latin1'));
+            response.end('ok');
+          });
+          const resp = await net.fetch(serverUrl);
+          expect(resp.ok).to.be.true();
+          const header = resp.headers.get('content-disposition');
+          expect(header).to.be.a('string');
+          const decoded = Buffer.from(header!, 'latin1').toString('utf-8');
+          expect(decoded).to.equal(headerValue);
+        });
+
+        test('preserves multiple Set-Cookie headers', async () => {
+          const serverUrl = await respondOnce.toSingleURL((request, response) => {
+            response.setHeader('set-cookie', [
+              'cookie1=val1; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/',
+              'cookie2=val2; Path=/'
+            ]);
+            response.end('ok');
+          });
+          const resp = await net.fetch(serverUrl);
+          expect(resp.ok).to.be.true();
+          if (typeof resp.headers.getSetCookie === 'function') {
+            const cookies = resp.headers.getSetCookie();
+            expect(cookies).to.have.lengthOf(2);
+            expect(cookies[0]).to.equal('cookie1=val1; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/');
+            expect(cookies[1]).to.equal('cookie2=val2; Path=/');
+          }
+        });
       });
     });
 
```

**File**: `spec/api-protocol.spec.ts` (modified, +20/-0)
```diff
@@ -2019,6 +2019,26 @@ describe('protocol module', () => {
       }
     });
 
+    it('accepts headers with non-ASCII characters', async () => {
+      let receivedHeader: string | null = null;
+      protocol.handle('test-scheme', (req) => {
+        receivedHeader = req.headers.get('x-non-ascii');
+        return new Response('ok');
+      });
+      defer(() => {
+        protocol.unhandle('test-scheme');
+      });
+      const resp = await net.fetch('test-scheme://foo/', {
+        headers: {
+          'x-non-ascii': Buffer.from('zażółć', 'utf-8').toString('latin1')
+        }
+      });
+      expect(resp.status).to.equal(200);
+      expect(receivedHeader).to.be.a('string');
+      const decoded = Buffer.from(receivedHeader!, 'latin1').toString('utf-8');
+      expect(decoded).to.equal('zażółć');
+    });
+
     it('normalizes urls in standard schemes', async () => {
       // NB. 'app' is registered as a standard scheme in test setup.
       protocol.handle('app', (req) => new Response(req.url));
```

---

### Incident Patch 4: `e91b6a0a` (2026-10-05)
**Commit Message**: build: update PGO profiles (#54642)

* build: update linux-arm64 PGO profile

* build: update linux-x64 PGO profile

* build: update macos-arm64 PGO profile

* build: update macos-x64 PGO profile

* build: update v8-builtins PGO profile

* build: update win-arm64 PGO profile

* build: update win-x64 PGO profile

---------

Co-authored-by: electron-pgo-updater[bot] <290827142+electron-pgo-updater[bot]@users.noreply.github.com>

**File**: `build/pgo_profiles/linux-arm64.pgo.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-electron-linux-arm64-1790481804-690ccdd890.profdata 795fe488e2e4a8e5da5b1886b0c993673edc26dce2e1ffd1c6f84af00ae42cde
+electron-linux-arm64-1791088065-df79406cec.profdata ebf8d5ebc67ca691ede9e5855aad6f0f5f78c67b649210d70efa892beb466164
```

**File**: `build/pgo_profiles/linux-x64.pgo.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-electron-linux-x64-1790481804-690ccdd890.profdata d06add53b41dc69947b7e131e4863b1e953051f680c9a47bd26629053daec25b
+electron-linux-x64-1791088065-df79406cec.profdata 6b1fb267c994c9d20aca22568bc2f8e97bc151e94f3297dc78734724285aba80
```

**File**: `build/pgo_profiles/macos-arm64.pgo.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-electron-macos-arm64-1790481804-690ccdd890.profdata 3604e32167295c0c3e96bc4b0d6ba7696728924c887043d4b0232749c8a046f4
+electron-macos-arm64-1791088065-df79406cec.profdata 7ba7ca90b471d6f88f783d7f44f1b1f7072f7699c3d13926e5229d52a7872934
```

**File**: `build/pgo_profiles/macos-x64.pgo.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-electron-macos-x64-1790481804-690ccdd890.profdata 974196f222c3efa7d02c359a86789d92dd3881bfbe374fe96b85ba23223b38df
+electron-macos-x64-1791088065-df79406cec.profdata b75a89beefbe5a638d37620a6ea0b7e892462ac68fdf7f5921722bfd35cfbed5
```

**File**: `build/pgo_profiles/v8-builtins.pgo.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-electron-v8-x64-1790478003-690ccdd890.profile b16d04481925da9e9d449f7d3ded1fb84f967e5b5516891d9ffee774a10cd9b4
+electron-v8-x64-1791084552-df79406cec.profile c5c0f60f166580298babd831f21e9cd27730f33a25d7206f3e6d2c1d9d0745b5
```

**File**: `build/pgo_profiles/win-arm64.pgo.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-electron-win-arm64-1790481804-690ccdd890.profdata 84081bf87a46885b67614a9a27ff610fb2af47d5c3ef582e50722a5acfeb34f2
+electron-win-arm64-1791088065-df79406cec.profdata bf6440865c071b8e203c16f2f0e4acef096c5822a7b530f9da2e7b18d103c6db
```

**File**: `build/pgo_profiles/win-x64.pgo.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-electron-win-x64-1790481804-690ccdd890.profdata 2ee4da37950e4208a3ef9fbe717195069502894a5df8ee3a6ee21d4ebc37c71d
+electron-win-x64-1791088065-df79406cec.profdata 80b71e62604fd01d44ebaf75a3406cb4d792f542edf112af3e876aed18fe8d3f
```

---

### Incident Patch 5: `07a3f546` (2026-10-04)
**Commit Message**: build: enable dangling raw_ptr checks (#54619)

* fix: clear vibrancy view before destruction

Keep the removed NativeViewHost alive until vibrant_native_view_host_ has been cleared.

Memory was freed at:

0 Electron Framework 0x000000012b8e4940 base::debug::CollectStackTrace(base::span<void const*, 18446744073709551615ul, void const**>) + 24
1 Electron Framework 0x000000012b8cfa00 base::debug::StackTrace::StackTrace(unsigned long) + 128
2 Electron Framework 0x000000012b8ea86c base::allocator::(anonymous namespace)::DanglingRawPtrDetected(unsigned long) + 764
3 Electron Framework 0x000000012b996bcc void partition_alloc::PartitionRoot::FreeInline<(partition_alloc::internal::FreeFlags)8>(void*) + 5392
4 Electron Framework 0x00000001335fe8f4 views::NativeViewHost::~NativeViewHost() + 16
5 Electron Framework 0x0000000124916004 ___ZN8electron15NativeWindowMac11SetVibrancyERKNSt4__Cr12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEi_block_invoke + 140
6 Electron Framework 0x0000000124915a74 electron::NativeWindowMac::SetVibrancy(std::__Cr::basic_string<char, std::__Cr::char_traits<char>, std::__Cr::allocator<char>> const&, int) + 1048

The dangling raw_ptr was released at:

0 Ele

**File**: `build/args/all.gn` (modified, +0/-5)
```diff
@@ -69,11 +69,6 @@ is_cfi = false
 use_qt5 = false
 use_qt6 = false
 
-# https://chromium.googlesource.com/chromium/src/+/main/docs/dangling_ptr.md
-# TODO(vertedinde): hunt down dangling pointers on Linux
-enable_dangling_raw_ptr_checks = false
-enable_dangling_raw_ptr_feature_flag = false
-
 # This flag speeds up the performance of fork/execve on linux systems.
 # Ref: https://chromium-review.googlesource.com/c/v8/v8/+/4602858
 v8_enable_private_mapping_fork_optimization = true
```

**File**: `patches/chromium/notification_provenance.patch` (modified, +2/-2)
```diff
@@ -59,7 +59,7 @@ index 709b7c9ed8e9e6375ab29e02840509d07d34de64..552179d1b93a9914af889fdf9377cbbf
  }
  
 diff --git a/content/browser/notifications/blink_notification_service_impl.h b/content/browser/notifications/blink_notification_service_impl.h
-index 89edc47028e80170bcc0f11a0f27d30067d1ef6c..313bbe4f1815c7e2042d4a4600f922031727d274 100644
+index 89edc47028e80170bcc0f11a0f27d30067d1ef6c..3655e3167bf91d8397251e20b7890968fc299c6c 100644
 --- a/content/browser/notifications/blink_notification_service_impl.h
 +++ b/content/browser/notifications/blink_notification_service_impl.h
 @@ -44,6 +44,7 @@ class CONTENT_EXPORT BlinkNotificationServiceImpl
@@ -74,7 +74,7 @@ index 89edc47028e80170bcc0f11a0f27d30067d1ef6c..313bbe4f1815c7e2042d4a4600f92203
    raw_ptr<PlatformNotificationContextImpl, DanglingUntriaged>
        notification_context_;
  
-+  raw_ptr<RenderFrameHost> render_frame_host_;
++  raw_ptr<RenderFrameHost, DanglingUntriaged> render_frame_host_;
    raw_ptr<BrowserContext> browser_context_;
  
    scoped_refptr<ServiceWorkerContextWrapper> service_worker_context_;
```

**File**: `shell/browser/api/electron_api_desktop_capturer.cc` (modified, +1/-1)
```diff
@@ -301,7 +301,7 @@ class DesktopCapturer::ListObserver : public DesktopMediaListObserver {
   }
 
   cppgc::Persistent<gin::WeakCell<DesktopCapturer>> capturer_;
-  raw_ptr<DesktopMediaList> list_;
+  raw_ptr<DesktopMediaList, DanglingUntriaged> list_;
   DesktopMediaList::Type list_type_;
   bool is_delegated_ = false;
   bool need_thumbnails_ = false;
```

**File**: `shell/browser/native_window_mac.mm` (modified, +3/-2)
```diff
@@ -1412,8 +1412,9 @@ bool DoesIntersectRect(const views::View* target,
     auto cleanupHandler = ^{
       if (vibrant_native_view_host_ != nullptr) {
         // Transfers ownership back to caller in the form of a unique_ptr which
-        // is subsequently deleted.
-        rootView->RemoveChildViewT(vibrant_native_view_host_);
+        // is deleted after the non-owning pointer has been cleared.
+        auto vibrant_native_view_host =
+            rootView->RemoveChildViewT(vibrant_native_view_host_);
         vibrant_native_view_host_ = nullptr;
       }
 
```

**File**: `shell/browser/net/proxying_url_loader_factory.h` (modified, +4/-2)
```diff
@@ -265,13 +265,15 @@ class ProxyingURLLoaderFactory
   // reference is guaranteed to be valid.
   //
   // In this way we can avoid using code from api namespace in this file.
-  const raw_ref<const HandlersMap> intercepted_handlers_;
+  const raw_ref<const HandlersMap, LeakedDanglingUntriaged>
+      intercepted_handlers_;
 
   const base::WeakPtr<ElectronBrowserContext> browser_context_;
 
   const int render_process_id_;
   const int frame_routing_id_;
-  raw_ptr<uint64_t> request_id_generator_;  // managed by ElectronBrowserClient
+  raw_ptr<uint64_t, LeakedDanglingUntriaged>
+      request_id_generator_;  // managed by ElectronBrowserClient
   std::unique_ptr<extensions::ExtensionNavigationUIData> navigation_ui_data_;
   std::optional<int64_t> navigation_id_;
   mojo::ReceiverSet<network::mojom::URLLoaderFactory> proxy_receivers_;
```

**File**: `shell/browser/notifications/notification.cc` (modified, +4/-2)
```diff
@@ -45,8 +45,10 @@ Notification::Notification(NotificationDelegate* delegate,
     : delegate_(delegate), presenter_(presenter) {}
 
 Notification::~Notification() {
-  if (delegate())
-    delegate()->NotificationDestroyed();
+  auto* delegate = delegate_.get();
+  delegate_ = nullptr;
+  if (delegate)
+    delegate->NotificationDestroyed();
 }
 
 void Notification::NotificationClicked() {
```

**File**: `shell/browser/notifications/notification_presenter.cc` (modified, +5/-1)
```diff
@@ -14,8 +14,12 @@ namespace electron {
 NotificationPresenter::NotificationPresenter() = default;
 
 NotificationPresenter::~NotificationPresenter() {
-  for (Notification* notification : notifications_)
+  while (!notifications_.empty()) {
+    auto it = notifications_.begin();
+    Notification* notification = *it;
+    notifications_.erase(it);
     delete notification;
+  }
 }
 
 base::WeakPtr<Notification> NotificationPresenter::CreateNotification(
```

**File**: `shell/browser/ui/cocoa/electron_ns_window_delegate.h` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ class NativeWindowMac;
 @interface ElectronNSWindowDelegate
     : ViewsNSWindowDelegate <NSTouchBarDelegate, QLPreviewPanelDataSource> {
  @private
-  raw_ptr<electron::NativeWindowMac> shell_;
+  raw_ptr<electron::NativeWindowMac, DanglingUntriaged> shell_;
   bool is_zooming_;
   int level_;
   bool is_resizable_;
```

---

### Incident Patch 6: `df79406c` (2026-10-01)
**Commit Message**: fix: crash on navigator.usb.requestDevice() in in-memory sessions (#54608)

UsbChooserContextFactory did not override GetBrowserContextToUse(), so
off-the-record contexts got no UsbChooserContext and the chooser
controller dereferenced null. Give in-memory sessions their own context,
as the HID and serial factories do.

**File**: `shell/browser/usb/electron_usb_delegate.cc` (modified, +1/-3)
```diff
@@ -100,9 +100,7 @@ class ElectronUsbDelegate::ContextObservation
   ContextObservation(ElectronUsbDelegate* parent,
                      content::BrowserContext* browser_context)
       : parent_(parent), browser_context_(browser_context) {
-    auto* chooser_context = GetChooserContext(browser_context_);
-    if (chooser_context)
-      device_observation_.Observe(chooser_context);
+    device_observation_.Observe(GetChooserContext(browser_context_));
   }
   ContextObservation(ContextObservation&) = delete;
   ContextObservation& operator=(ContextObservation&) = delete;
```

**File**: `shell/browser/usb/usb_chooser_context_factory.cc` (modified, +5/-0)
```diff
@@ -25,6 +25,11 @@ UsbChooserContextFactory::BuildServiceInstanceForBrowserContext(
       static_cast<electron::ElectronBrowserContext*>(context));
 }
 
+content::BrowserContext* UsbChooserContextFactory::GetBrowserContextToUse(
+    content::BrowserContext* context) const {
+  return context;
+}
+
 // static
 UsbChooserContextFactory* UsbChooserContextFactory::GetInstance() {
   static base::NoDestructor<UsbChooserContextFactory> instance;
```

**File**: `shell/browser/usb/usb_chooser_context_factory.h` (modified, +2/-0)
```diff
@@ -38,6 +38,8 @@ class UsbChooserContextFactory : public BrowserContextKeyedServiceFactory {
   // BrowserContextKeyedServiceFactory methods:
   std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
       content::BrowserContext* profile) const override;
+  content::BrowserContext* GetBrowserContextToUse(
+      content::BrowserContext* context) const override;
 };
 
 }  // namespace electron
```

**File**: `spec/chromium.spec.ts` (modified, +15/-5)
```diff
@@ -5611,17 +5611,17 @@ describe('navigator.usb', () => {
     serverUrl = (await listen(server)).url;
   });
 
-  const requestDevices: any = () => {
-    return w.webContents.executeJavaScript(
+  const requestDevices: any = (win = w) => {
+    return win.webContents.executeJavaScript(
       `
       navigator.usb.requestDevice({filters: []}).then(device => device.toString()).catch(err => err.toString());
     `,
       true
     );
   };
 
-  const getDevices: any = () => {
-    return w.webContents.executeJavaScript(
+  const getDevices: any = (win = w) => {
+    return win.webContents.executeJavaScript(
       `
       navigator.usb.getDevices().then(devices => devices.map(device => device.toString())).catch(err => err.toString());
     `,
@@ -5644,14 +5644,24 @@ describe('navigator.usb', () => {
 
   it('does not crash when using in-memory partitions', async () => {
     const sesWin = new BrowserWindow({
+      show: false,
       webPreferences: {
         partition: 'test-partition'
       }
     });
 
     await sesWin.loadFile(path.join(fixturesPath, 'pages', 'blank.html'));
-    const devices = await getDevices();
+    const devices = await getDevices(sesWin);
     expect(devices).to.be.an('array').that.is.empty();
+
+    let selectFired = false;
+    sesWin.webContents.session.once('select-usb-device', (event, details, callback) => {
+      selectFired = true;
+      callback();
+    });
+    const device = await requestDevices(sesWin);
+    expect(selectFired).to.be.true();
+    expect(device).to.equal(notFoundError);
   });
 
   it('does not return a device if select-usb-device event is not defined', async () => {
```

---

### Incident Patch 7: `49992b16` (2026-10-01)
**Commit Message**: fix: filter non-shareable windows from PiP capture filter updates (#51267)

Refactors the non-shareable window filtering in the Chromium
ScreenCaptureKit patch:

1. Extracts inline NSWindowSharingNone filtering into a reusable
   GetNonShareableWindows() helper function.

2. Fixes a bug where content-protected windows (via
   win.setContentProtection(true)) could temporarily appear in screen
   captures during picture-in-picture state changes — the PiP filter
   update handler was only excluding PiP windows, not non-shareable
   ones.

Notes: Fixed a bug where content-protected windows could temporarily appear in screen captures during picture-in-picture state changes.

**File**: `patches/chromium/feat_allow_usage_of_sccontentsharingpicker_on_supported_platforms.patch` (modified, +12/-12)
```diff
@@ -46,7 +46,7 @@ index 6d54c2bc01f32a0d987aadb8eb0684d0ec0444d4..40f64c7705427bbe3fa4e3c056519676
    // OnStop is called by StopAndDeAllocate.
    virtual void OnStop() = 0;
 diff --git a/content/browser/media/capture/screen_capture_kit_device_mac.mm b/content/browser/media/capture/screen_capture_kit_device_mac.mm
-index c869806df61f67d9115e6b099831b8bd6280de70..8256f0b61f6944b5781fdbabecf56efdc8fffb97 100644
+index db8f635acb0b617e7a950f84577444b49000bcb2..1963792093d5f78dc8213126317e7f514d7ba432 100644
 --- a/content/browser/media/capture/screen_capture_kit_device_mac.mm
 +++ b/content/browser/media/capture/screen_capture_kit_device_mac.mm
 @@ -31,6 +31,61 @@
@@ -111,7 +111,7 @@ index c869806df61f67d9115e6b099831b8bd6280de70..8256f0b61f6944b5781fdbabecf56efd
  
  namespace {
  std::tuple<std::optional<gfx::Rect>,
-@@ -158,18 +213,22 @@ @interface ScreenCaptureKitDeviceHelper
+@@ -184,18 +239,22 @@ @interface ScreenCaptureKitDeviceHelper
      : NSObject <SCStreamDelegate, SCStreamOutput>
  
  - (instancetype)initWithSampleCallback:(SampleCallback)sampleCallback
@@ -134,7 +134,7 @@ index c869806df61f67d9115e6b099831b8bd6280de70..8256f0b61f6944b5781fdbabecf56efd
      _errorCallback = errorCallback;
    }
    return self;
-@@ -261,14 +320,12 @@ + (SCStreamConfiguration*)streamConfigurationWithFrameSize:(gfx::Size)frameSize
+@@ -287,14 +346,12 @@ + (SCStreamConfiguration*)streamConfigurationWithFrameSize:(gfx::Size)frameSize
  
    explicit ScreenCaptureKitDeviceMac(
        const DesktopMediaID& source,
@@ -151,7 +151,7 @@ index c869806df61f67d9115e6b099831b8bd6280de70..8256f0b61f6944b5781fdbabecf56efd
          stream_created_callback_(std::move(stream_created_callback)),
          device_task_runner_(base::SingleThreadTaskRunner::GetCurrentDefault()),
          pip_screen_capture_coordinator_proxy_(
-@@ -277,21 +334,43 @@ explicit ScreenCaptureKitDeviceMac(
+@@ -303,21 +360,43 @@ explicit ScreenCaptureKitDeviceMac(
          device_task_runner_,
          base::BindRepeating(&ScreenCaptureKitDeviceMac::OnStreamSample,
                              weak_factory_.GetWeakPtr()));
@@ -195,7 +195,7 @@ index c869806df61f67d9115e6b099831b8bd6280de70..8256f0b61f6944b5781fdbabecf56efd
      CHECK(device_task_runner_->RunsTasksInCurrentSequence(),
            base::NotFatalUntil::M160);
      if (pip_screen_capture_coordinator_proxy_) {
-@@ -385,7 +464,7 @@ void CreateStream(SCContentFilter* filter) {
+@@ -389,7 +468,7 @@ void CreateStream(SCContentFilter* filter) {
        return;
      }
  
@@ -204,7 +204,7 @@ index c869806df61f67d9115e6b099831b8bd6280de70..8256f0b61f6944b5781fdbabecf56efd
        // Update the content size. This step is neccessary when used together
        // with SCContentSharingPicker. If the Chrome picker is used, it will
        // change to retina resolution if applicable.
-@@ -394,6 +473,9 @@ void CreateStream(SCContentFilter* filter) {
+@@ -398,6 +477,9 @@ void CreateStream(SCContentFilter* filter) {
                      filter.contentRect.size.height * filter.pointPixelScale);
      }
  
@@ -214,15 +214,15 @@ index c869806df61f67d9115e6b099831b8bd6280de70..8256f0b61f6944b5781fdbabecf56efd
      gfx::RectF dest_rect_in_frame;
      actual_capture_format_ = capture_params().requested_format;
      actual_capture_format_.pixel_format = media::PIXEL_FORMAT_NV12;
-@@ -407,6 +489,7 @@ void CreateStream(SCContentFilter* filter) {
+@@ -411,6 +493,7 @@ void CreateStream(SCContentFilter* filter) {
      stream_ = [[SCStream alloc] initWithFilter:filter
                                   configuration:config
                                        delegate:helper_];
 +
      {
        NSError* error = nil;
        bool add_stream_output_result =
-@@ -570,7 +653,7 @@ void OnStreamError(NSError* _Nullable error) {
+@@ -574,7 +657,7 @@ void OnStreamError(NSError* _Nullable error) {
        if (fullscreen_module_) {
          fullscreen_module_->Reset();
        }
@@ -231,7 +231,7 @@ index c869806df61f67d9115e6b099831b8bd6280de70..8256f0b61f6944b5781fdbabecf56efd
      } else {
        std::string error_string =
            base::StrCat({"Stream delegate called didStopWithError: ",
-@@ -664,33 +747,42 @@ void OnStateChanged(
+@@ -670,33 +753,42 @@ void OnStateChanged(
    }
  
    // IOSurfaceCaptureDeviceBase:
@@ -296,7 +296,7 @@ index c869806df61f67d9115e6b099831b8bd6280de70..8256f0b61f6944b5781fdbabecf56efd
    }
    void OnStop() override {
      CHECK(device_task_runner_->RunsTasksInCurrentSequence(),
-@@ -751,8 +843,7 @@ void ResetStreamTo(SCWindow* window) override {
+@@ -757,8 +849,7 @@ void ResetStreamTo(SCWindow* window) override {
  
   private:
    const DesktopMediaID source_;
@@ -306,7 +306,7 @@ index c869806df61f67d9115e6b099831b8bd6280de70..8256f0b61f6944b5781fdbabecf56efd
    StreamCallback stream_created_callback_;
    const scoped_refptr<base::SingleThreadTaskRunner> device_task_runner_;
  
-@@ -769,6 +860,10 @@ void ResetStreamTo(SCWindow* window) override {
+@@ -775,6 +866,10 @
```

**File**: `patches/chromium/feat_filter_out_non-shareable_windows_in_the_current_application_in.patch` (modified, +57/-27)
```diff
@@ -1,44 +1,74 @@
 From 0000000000000000000000000000000000000000 Mon Sep 17 00:00:00 2001
 From: Samuel Attard <sattard@salesforce.com>
-Date: Thu, 26 May 2022 15:38:32 -0700
+Date: Fri, 8 May 2026 13:05:01 -0700
 Subject: feat: filter out non-shareable windows in the current application in
  ScreenCaptureKitDevice
 
-This patch ensures that windows protected via win.setContentProtection(true) do not appear in full display captures via desktopCapturer.  This patch could be upstreamed but as the check is limited to in-process windows it doesn't make a lot of sense for Chromium itself.  This patch currently has a limitation that it only function for windows created / protected BEFORE the stream is started.  There is theoretical future work we can do via polling / observers to automatically update the SCContentFilter when new windows are made but for now this will solve 99+% of the problem and folks can re-order their logic a bit to get it working for their use cases.
+Ensures that windows with sharingType == NSWindowSharingNone (set via
+Electron's win.setContentProtection(true)) are excluded from full-display
+ScreenCaptureKit captures. The filtering is extracted into a
+GetNonShareableWindows() helper and applied in both OnShareableContentCreated
+(initial stream setup) and OnShareableContentForFilterUpdate (PiP state
+change handler), so content-protected windows stay excluded even when the
+SCContentFilter is rebuilt during capture.
+
+Limitation: only filters windows protected before the query runs. Dynamically
+protecting a window during an active capture will not take effect until the
+next filter update or stream restart.
 
 diff --git a/content/browser/media/capture/screen_capture_kit_device_mac.mm b/content/browser/media/capture/screen_capture_kit_device_mac.mm
-index 6bcb69df1ecc8ec78814793a9d4879d4a9a6576c..c869806df61f67d9115e6b099831b8bd6280de70 100644
+index 6bcb69df1ecc8ec78814793a9d4879d4a9a6576c..db8f635acb0b617e7a950f84577444b49000bcb2 100644
 --- a/content/browser/media/capture/screen_capture_kit_device_mac.mm
 +++ b/content/browser/media/capture/screen_capture_kit_device_mac.mm
-@@ -321,6 +321,31 @@ void OnShareableContentCreated(SCShareableContent* content) {
+@@ -152,6 +152,32 @@ bool IsPresenterOverlayLargeActive(CFDictionaryRef attachment) {
+   }
+   return @[];
+ }
++
++// Returns SCWindows from |content| that correspond to in-process NSWindows
++// whose sharingType is NSWindowSharingNone (content-protected via Electron's
++// win.setContentProtection(true)). Only captures windows protected before this
++// call; dynamically protected windows require a filter update.
++API_AVAILABLE(macos(12.3))
++NSArray<SCWindow*>* GetNonShareableWindows(SCShareableContent* content) {
++  NSArray<NSWindow*>* non_sharing_nswindows = [[[NSApplication sharedApplication]
++      windows]
++      filteredArrayUsingPredicate:
++          [NSPredicate predicateWithBlock:^BOOL(NSWindow* win,
++                                               NSDictionary* bindings) {
++            return [win sharingType] == NSWindowSharingNone;
++          }]];
++  return [[content windows]
++      filteredArrayUsingPredicate:
++          [NSPredicate predicateWithBlock:^BOOL(SCWindow* win,
++                                               NSDictionary* bindings) {
++            for (NSWindow* excluded : non_sharing_nswindows) {
++              if ((CGWindowID)[excluded windowNumber] == [win windowID]) {
++                return true;
++              }
++            }
++            return false;
++          }]];
++}
+ }  // namespace
+ 
+ @interface ScreenCaptureKitDeviceHelper
+@@ -321,6 +347,9 @@ void OnShareableContentCreated(SCShareableContent* content) {
                source_.id == webrtc::kFullDesktopScreenId) {
              NSArray<SCWindow*>* excluded_windows = GetWindowsToExclude(
                  content, pip_screen_capture_coordinator_proxy_.get(), source_);
-+            NSArray<NSWindow*>* non_sharing_nswindows = [[[NSApplication
-+                sharedApplication] windows]
-+                filteredArrayUsingPredicate:[NSPredicate
-+                                                predicateWithBlock:^BOOL(
-+                                                    NSWindow* win,
-+                                                    NSDictionary* bindings) {
-+                                                  return [win sharingType] ==
-+                                                         NSWindowSharingNone;
-+                                                }]];
-+            NSArray<SCWindow*>* non_sharing_scwindows = [[content windows]
-+                filteredArrayUsingPredicate:
-+                    [NSPredicate predicateWithBlock:^BOOL(
-+                                     SCWindow* win, NSDictionary* bindings) {
-+                      for (NSWindow* excluded : non_sharing_nswindows) {
-+                        if ((CGWindowID)[excluded windowNumber] ==
-+                            [win window
```

---

### Incident Patch 8: `ae5405db` (2026-09-30)
**Commit Message**: build(deps): bump github/codeql-action/upload-sarif from 4.38.0 to 4.38.1 (#54570)

build(deps): bump github/codeql-action/upload-sarif

Bumps [github/codeql-action/upload-sarif](https://github.com/github/codeql-action) from 4.38.0 to 4.38.1.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/b96794f015dfd88f77b49b1c93e0fa7110f94c63...1c5b675653bb5c22dbe9b12b556ec555138e09fd)

---
updated-dependencies:
- dependency-name: github/codeql-action/upload-sarif
  dependency-version: 4.38.1
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
-        uses: github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/upload-sarif@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
         with:
           sarif_file: results.sarif
```

---

### Incident Patch 9: `4c10d222` (2026-09-30)
**Commit Message**: ci: capture macOS memory-pressure diagnostics on build failure (#54006)

* build: bound devtools-frontend esbuild bundle concurrency on macOS

macOS x64 release builds have been failing in Build Electron when
devtools-frontend esbuild bundle actions die with "The service was
stopped": the esbuild service process is killed externally with no
crash trace, consistent with memory pressure on the 14 GB
macos-15-xlarge runners while siso runs five minify+sourcemap bundles
at once through the generic action pool.

Float a devtools-frontend patch that gives esbuild bundle actions their
own GN pool (depth 2 on macOS hosts), and dump vm_stat, swap usage and
the kernel memorystatus/jetsam log when a macOS build fails so the kill
is observable.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01H2pb2QXCU6xBfNMLmjgrLU

* chore: update patches

Refresh the devtools-frontend BUILD.gn blob ids in the esbuild pool patch
after the Chromium roll on main moved the devtools-frontend pin. No change
to the patch content.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01H2pb2QXCU6xBfNMLmjgrLU

* ci: dro

**File**: `.github/actions/build-electron/action.yml` (modified, +15/-0)
```diff
@@ -196,6 +196,21 @@ runs:
           echo "Skipping build-stats.mjs upload because DD_API_KEY is not set"
         fi
         node electron/script/build-stats.mjs $BUILD_STATS_ARGS || true
+    - name: Dump macOS memory pressure diagnostics
+      if: ${{ failure() && inputs.target-platform == 'macos' }}
+      shell: bash
+      run: |
+        set +e
+        echo "::group::vm_stat / swap"
+        sysctl vm.swapusage
+        vm_stat
+        echo "::endgroup::"
+        echo "::group::kernel memorystatus / jetsam (last 45m)"
+        log show --last 45m --style compact --predicate 'process == "kernel" AND (eventMessage CONTAINS "memorystatus" OR eventMessage CONTAINS "jetsam")' | tail -n 100
+        echo "::endgroup::"
+        echo "::group::esbuild process mentions (last 45m)"
+        log show --last 45m --style compact --predicate 'eventMessage CONTAINS "esbuild"' | tail -n 50
+        echo "::endgroup::"
     - name: Build Electron (Windows) ${{ inputs.step-suffix }}
       if: ${{ inputs.target-platform == 'win' }}
       shell: powershell
```

---

### Incident Patch 10: `bc8e748e` (2026-09-30)
**Commit Message**: docs: document denying a display media request and fix a webview spec (#54587)

* docs: document how to deny a display media request

* test: make the webview printToPDF() bad parameter spec reach the type checks

The spec loaded another <webview id="webview"> on every pass of its loop, so
from the second pass on `webview` named a collection of elements and the call
was rejected with "webview.printToPDF is not a function". Only the first of
the ten parameters was checked. Load the webview once, and require the
rejection to name the parameter.

**File**: `docs/api/desktop-capturer.md` (modified, +11/-4)
```diff
@@ -17,10 +17,17 @@ app.whenReady().then(() => {
 
   session.defaultSession.setDisplayMediaRequestHandler(
     (request, callback) => {
-      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
-        // Grant access to the first screen found.
-        callback({ video: sources[0], audio: 'loopback' })
-      })
+      desktopCapturer.getSources({ types: ['screen'] }).then(
+        (sources) => {
+          // Grant access to the first screen found.
+          callback({ video: sources[0], audio: 'loopback' })
+        },
+        () => {
+          // Deny the request if no sources could be retrieved, for example
+          // when the user cancels the PipeWire picker on Linux.
+          callback(null)
+        }
+      )
       // If true, use the system picker if available.
       // Note: this is currently experimental. If the system picker
       // is available, it will be used and the media request handler
```

**File**: `docs/api/session.md` (modified, +13/-5)
```diff
@@ -1215,7 +1215,8 @@ session.fromPartition('some-partition').setPermissionCheckHandler((webContents,
     * `audioRequested` Boolean - true if the web content requested an audio stream.
     * `userGesture` Boolean - Whether a user gesture was active when this request was triggered.
   * `callback` Function
-    * `streams` Object
+    * `streams` Object | null - Pass `null` to deny the request, which rejects
+      the `getDisplayMedia()` promise with an `AbortError`.
       * `video` Object | [WebFrameMain](web-frame-main.md) (optional)
         * `id` String - The id of the stream being granted. This will usually
           come from a [DesktopCapturerSource](structures/desktop-capturer-source.md)
@@ -1249,10 +1250,17 @@ const { session, desktopCapturer } = require('electron')
 
 session.defaultSession.setDisplayMediaRequestHandler(
   (request, callback) => {
-    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
-      // Grant access to the first screen found.
-      callback({ video: sources[0] })
-    })
+    desktopCapturer.getSources({ types: ['screen'] }).then(
+      (sources) => {
+        // Grant access to the first screen found.
+        callback({ video: sources[0] })
+      },
+      () => {
+        // Deny the request if no sources could be retrieved, for example
+        // when the user cancels the PipeWire picker on Linux.
+        callback(null)
+      }
+    )
     // Use the system picker if available.
     // Note: this is currently experimental. If the system picker
     // is available, it will be used and the media request handler
```

**File**: `spec/webview.spec.ts` (modified, +5/-4)
```diff
@@ -2474,13 +2474,14 @@ describe('<webview> tag', function () {
           preferCSSPageSize: 'no'
         };
 
+        await loadWebView(w, { src: 'data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E' });
+
         // These will hard crash in Chromium unless we type-check
         for (const [key, value] of Object.entries(badTypes)) {
           const param = { [key]: value };
-
-          const src = 'data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E';
-          await loadWebView(w, { src });
-          await expect(w.executeJavaScript(`webview.printToPDF(${JSON.stringify(param)})`)).to.eventually.be.rejected();
+          await expect(
+            w.executeJavaScript(`webview.printToPDF(${JSON.stringify(param)})`)
+          ).to.eventually.be.rejectedWith(key);
         }
       });
 
```

---

### Incident Patch 11: `7af89da3` (2026-09-30)
**Commit Message**: fix: webview findInPage() hang when the embedder page has an iframe (#54508)

**File**: `patches/chromium/.patches` (modified, +1/-0)
```diff
@@ -141,3 +141,4 @@ gin_mark_invoker_as_stack_allocated_and_drop_raw_ptr_for_its.patch
 fix_gate_webstoreprivate_on_a_delegated_availability_check.patch
 build_drop_the_unused_chrome_browser_win_dep_from_color_mixers.patch
 fix_plumb_the_requesting_frame_through_pointer_lock_requests.patch
+fix_find-in-page_frame_traversal_across_inner_webcontents.patch
```

**File**: `patches/chromium/fix_find-in-page_frame_traversal_across_inner_webcontents.patch` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+From 0000000000000000000000000000000000000000 Mon Sep 17 00:00:00 2001
+From: Shelley Vohr <shelley.vohr@gmail.com>
+Date: Mon, 28 Sep 2026 10:53:28 +0000
+Subject: fix: find-in-page frame traversal across inner WebContents
+
+FindRequestManager walks every RenderFrameHost across inner WebContentses
+with GetChildren(), GetAncestor() and Get{Next,Previous}Sibling().
+GetChildren() substitutes the main frame of an inner WebContents for the
+outer delegate FrameTreeNode that hosts it, and GetAncestor() of that
+main frame is the outer delegate's parent, but the sibling helpers first
+tried RenderFrameHostImpl::{Next,Previous}Sibling(), which return the raw
+outer delegate frame. That frame is not in its parent's GetChildren(), so
+when an embedder document has an <iframe> created before a guest,
+TraverseNext() goes iframe -> outer delegate frame -> (no sibling, wrap)
+embedder main frame -> iframe -> ... and never reaches the guest. When
+the find session is owned by the guest WebContents none of those frames
+pass CheckFrame(), so FindRequestManager::Traverse() never returns and
+the browser main thread spins. TraversePrevious() has the mirror cycle
+when the <iframe> follows the guest.
+
+Always derive siblings from GetChildren(GetAncestor(rfh)) so the three
+helpers agree on one tree. RenderFrameHostImpl::NextSibling() is itself
+a linear scan of the parent's children, so this does not change the cost.
+
+Fixes: https://github.com/electron/electron/issues/54199
+
+Upstreamed at https://chromium-review.googlesource.com/c/chromium/src/+/8470272
+
+diff --git a/content/browser/find_request_manager.cc b/content/browser/find_request_manager.cc
+index 04697138aedcc9ecccb947950291d95f157a56bf..3101b58869ef33b4c6963a28311fe16a4005d8c9 100644
+--- a/content/browser/find_request_manager.cc
++++ b/content/browser/find_request_manager.cc
+@@ -83,13 +83,9 @@ RenderFrameHostImpl* GetAncestor(RenderFrameHostImpl* rfh) {
+ }
+ 
+ // Returns the previous sibling RenderFrameHostImpl of |rfh|, if one exists,
+-// or nullptr otherwise.
++// or nullptr otherwise. Siblings come from GetChildren() so that an inner
++// WebContents is its main frame here too, not its outer delegate frame.
+ RenderFrameHostImpl* GetPreviousSibling(RenderFrameHostImpl* rfh) {
+-  if (rfh->PreviousSibling()) {
+-    return rfh->PreviousSibling()->current_frame_host();
+-  }
+-
+-  // The previous sibling may be in another WebContents.
+   if (RenderFrameHostImpl* parent = GetAncestor(rfh)) {
+     auto children = GetChildren(parent);
+     auto it = std::ranges::find(children, rfh);
+@@ -104,12 +100,8 @@ RenderFrameHostImpl* GetPreviousSibling(RenderFrameHostImpl* rfh) {
+ }
+ 
+ // Returns the next sibling RenderFrameHostImpl of |rfh|, if one exists, or
+-// nullptr otherwise.
++// nullptr otherwise. See GetPreviousSibling().
+ RenderFrameHostImpl* GetNextSibling(RenderFrameHostImpl* rfh) {
+-  if (rfh->NextSibling())
+-    return rfh->NextSibling()->current_frame_host();
+-
+-  // The next sibling may be in another WebContents.
+   if (RenderFrameHostImpl* parent = GetAncestor(rfh)) {
+     auto children = GetChildren(parent);
+     auto it = std::ranges::find(children, rfh);
```

**File**: `spec/webview.spec.ts` (modified, +41/-0)
```diff
@@ -2088,6 +2088,47 @@ describe('<webview> tag', function () {
         },
         [fixtures]
       );
+
+      // https://github.com/electron/electron/issues/54199
+      itremote(
+        'wraps past the last match when the embedder also contains an iframe',
+        async (fixtures: string) => {
+          const iframe = document.createElement('iframe');
+          iframe.srcdoc = '<p>embedder frame</p>';
+          await new Promise((resolve) => {
+            iframe.addEventListener('load', resolve, { once: true });
+            document.body.appendChild(iframe);
+          });
+
+          const webview = new WebView();
+          const didFinishLoad = new Promise((resolve) =>
+            webview.addEventListener('did-finish-load', resolve, { once: true })
+          );
+          webview.src = `file://${fixtures}/pages/content.html`;
+          document.body.appendChild(webview);
+          webview.focus();
+          await didFinishLoad;
+
+          const activeMatchOrdinal = [];
+          for (let i = 0; i < 4; i++) {
+            const foundInPage = new Promise<any>((resolve) =>
+              webview.addEventListener('found-in-page', resolve, { once: true })
+            );
+            const requestId = webview.findInPage('virtual');
+            const event = await foundInPage;
+
+            expect(event.result.requestId).to.equal(requestId);
+            expect(event.result.matches).to.equal(3);
+            activeMatchOrdinal.push(event.result.activeMatchOrdinal);
+          }
+
+          expect(activeMatchOrdinal).to.deep.equal([1, 2, 3, 1]);
+          webview.stopFindInPage('clearSelection');
+          webview.remove();
+          iframe.remove();
+        },
+        [fixtures]
+      );
     });
 
     describe('will-attach-webview event', () => {
```

---

### Incident Patch 12: `e1281848` (2026-09-29)
**Commit Message**: fix: avoid NoDestructor on trivially destructible QueueState in release builds (#54554)

With DCHECKs off, SEQUENCE_CHECKER expands to nothing, leaving QueueState
trivially destructible and tripping base::NoDestructor's static_assert.
Give it a user-provided destructor so it is non-trivial in every config.


Claude-Session: https://claude.ai/code/session_01FsSQW86CrHuBNQNRMyPCex

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `shell/browser/native_peer.cc` (modified, +3/-0)
```diff
@@ -22,6 +22,9 @@ namespace electron {
 namespace {
 
 struct QueueState {
+  // Non-trivial so NoDestructor accepts it when DCHECKs are off.
+  ~QueueState() {}  // NOLINT(modernize-use-equals-default)
+
   SEQUENCE_CHECKER(sequence_checker);
   bool release_scheduled = false;
   bool shutdown_started = false;
```

---

### Incident Patch 13: `dfcdfb14` (2026-09-29)
**Commit Message**: fix: clear detached DevTools backlinks before widget destruction (#54524)

Clear the retained view and delegate pointers before resetting their owning widget so neither raw_ptr outlives its pointee during CloseDevTools.

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `shell/browser/ui/inspectable_web_contents_view.cc` (modified, +2/-1)
```diff
@@ -198,9 +198,10 @@ void InspectableWebContentsView::CloseDevTools() {
                            : devtools_window_->GetWindowBoundsInScreen();
     inspectable_web_contents()->SaveDevToolsBounds(save_bounds);
 
-    devtools_window_.reset();
+    // The widget owns both the view and its delegate.
     devtools_window_web_view_ = nullptr;
     devtools_window_delegate_ = nullptr;
+    devtools_window_.reset();
   } else {
     devtools_web_view_->SetVisible(false);
     devtools_web_view_->SetWebContents(nullptr);
```

---

### Incident Patch 14: `8b85bb4d` (2026-09-28)
**Commit Message**: fix: detach interned string cache before isolate disposal (#54520)

Release cached strings and isolate references in OnBeforeDispose rather than after the isolate has been freed. Add a subprocess regression covering clean shutdown after nativeImage.getSize populates the cache.

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `shell/common/gin_helper/interned_strings.cc` (modified, +3/-3)
```diff
@@ -46,8 +46,8 @@ class InternedStringCache final : public gin::PerIsolateData::DisposeObserver {
   }
 
   // gin::PerIsolateData::DisposeObserver
-  void OnBeforeDispose(v8::Isolate* isolate) override { strings_.clear(); }
-  void OnDisposed() override { Detach(); }
+  void OnBeforeDispose(v8::Isolate* isolate) override { Detach(); }
+  void OnDisposed() override {}
 
  private:
   void Detach() {
@@ -66,7 +66,7 @@ class InternedStringCache final : public gin::PerIsolateData::DisposeObserver {
 
 InternedStringCache& CacheForThisThread() {
   // Never destroyed: it is a registered dispose observer, and the entries are
-  // released when the isolate reports disposal anyway.
+  // released before the isolate is disposed.
   thread_local base::NoDestructor<InternedStringCache> cache;
   return *cache;
 }
```

**File**: `spec/api-native-image.spec.ts` (modified, +17/-1)
```diff
@@ -3,11 +3,12 @@ import { BrowserWindow } from 'electron/main';
 
 import { expect } from 'chai';
 
+import { once } from 'node:events';
 import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
 
-import { ifdescribe, ifit, itremote, useRemoteContext } from './lib/spec-helpers.ts';
+import { ifdescribe, ifit, itremote, startRemoteControlApp, useRemoteContext } from './lib/spec-helpers.ts';
 import { expectDeprecationMessages } from './lib/warning-helpers.ts';
 import { closeAllWindows } from './lib/window-helpers.ts';
 
@@ -109,6 +110,21 @@ describe('nativeImage module', () => {
         expect(empty.getNativeHandle()).to.be.empty();
       }
     });
+
+    it('does not crash on exit after getting its size', async () => {
+      const rc = await startRemoteControlApp();
+      const exited = once(rc.process, 'exit');
+      const size = await rc.remotely(() => {
+        const { app, nativeImage } = require('electron');
+        const size = nativeImage.createEmpty().getSize();
+        setTimeout(() => app.quit());
+        return size;
+      });
+
+      expect(size).to.deep.equal({ width: 0, height: 0 });
+      const [code, signal] = await exited;
+      expect({ code, signal }).to.deep.equal({ code: 0, signal: null });
+    });
   });
 
   describe('createFromBitmap(buffer, options)', () => {
```

---

### Incident Patch 15: `013d90fb` (2026-09-28)
**Commit Message**: fix: crashReporter.setUploadToServer() having no effect after start (#54506)

**File**: `shell/browser/api/electron_api_crash_reporter.cc` (modified, +2/-0)
```diff
@@ -315,6 +315,8 @@ void Start(gin_helper::ErrorThrower thrower,
 void SetUploadToServer(bool upload) {
 #if !IS_MAS_BUILD()
   ElectronCrashReporterClient::Get()->SetCollectStatsConsent(upload);
+  // Reads the consent set above back through IsRunningUnattended().
+  crash_reporter::SetUploadConsent(upload);
 #endif
 }
 
```

**File**: `spec/api-crash-reporter.spec.ts` (modified, +17/-1)
```diff
@@ -92,7 +92,9 @@ const startServer = async () => {
       const reportId = Math.random().toString(16).split('.')[1].padStart(16, '0');
       res.end(reportId, async () => {
         req.socket.destroy();
-        emitter.emit('crash', { ...fields, ...files });
+        const crash = { ...fields, ...files } as CrashInfo;
+        crashes.push(crash);
+        emitter.emit('crash', crash);
       });
     });
     req.pipe(busboy);
@@ -484,6 +486,20 @@ ifdescribe(!process.mas && !process.env.DISABLE_CRASH_REPORTER_TESTS)('crashRepo
     expect(getCrashes()).to.have.length(0);
   });
 
+  ifit(!isWindowsOnArm)('should not send a minidump when setUploadToServer(false) is called after start', async () => {
+    const { port, getCrashes } = await startServer();
+    await runCrashApp('main', port, ['--set-upload-to-server=false']);
+    await setTimeout(2000);
+    expect(getCrashes()).to.have.length(0);
+  });
+
+  ifit(!isWindowsOnArm)('should send a minidump when setUploadToServer(true) is called after start', async () => {
+    const { port, waitForCrash } = await startServer();
+    runCrashApp('main', port, ['--no-upload', '--set-upload-to-server=true']);
+    const crash = await waitForCrash();
+    checkCrash('browser', crash);
+  });
+
   describe('getUploadedReports', () => {
     it('returns an array of reports', async () => {
       const { remotely } = await startRemoteControlApp();
```

**File**: `spec/fixtures/apps/crash/main.js` (modified, +5/-0)
```diff
@@ -7,6 +7,7 @@ app.setVersion('0.1.0');
 
 const url = app.commandLine.getSwitchValue('crash-reporter-url');
 const uploadToServer = !app.commandLine.hasSwitch('no-upload');
+const setUploadToServer = app.commandLine.getSwitchValue('set-upload-to-server');
 const setExtraParameters = app.commandLine.hasSwitch('set-extra-parameters-in-renderer');
 const addGlobalParam = app.commandLine.getSwitchValue('add-global-param')?.split(':');
 
@@ -23,6 +24,10 @@ crashReporter.start({
   globalExtra: addGlobalParam[0] ? { [addGlobalParam[0]]: addGlobalParam[1] } : {}
 });
 
+if (setUploadToServer) {
+  crashReporter.setUploadToServer(setUploadToServer === 'true');
+}
+
 app.whenReady().then(() => {
   const crashType = app.commandLine.getSwitchValue('crash-type');
 
```

#### Recent Merged Pull Requests:
- **PR #54712** (2026-10-07): test: keep visibility specs' windows on top on the Windows CI desktop (@trop[bot])
- **PR #54711** (2026-10-07): test: keep visibility specs' windows on top on the Windows CI desktop (@trop[bot])
- **PR #54709** (2026-10-07): test: stop updater preparation on cancellation (@trop[bot])
- **PR #54708** (2026-10-07): test: turn accessibility back off after the app a11y specs (@trop[bot])
- **PR #54707** (2026-10-07): test: remove transparent-window paint wait (@trop[bot])
- **PR #54706** (2026-10-07): test: re-enable missing-file load failure (@trop[bot])
- **PR #54705** (2026-10-07): test: re-enable the loadURL data URL base test (@trop[bot])
- **PR #54704** (2026-10-07): test: fix fullscreen spec waits (@trop[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
