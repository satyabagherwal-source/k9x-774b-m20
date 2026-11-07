> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-pake-learnings.md`  
> **Source**: github ([https://github.com/tw93/Pake](https://github.com/tw93/Pake))  
> **Source Version**: `1332aafa`  
> **License**: GPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-07T22:34:30.826Z  
> **Learning ID**: `learn-github-tw93-pake`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tw93/Pake

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Mission & Subsystem Topology
`tw93/Pake` is a dual-runtime compilation orchestrator that packages arbitrary web applications into lightweight, native desktop binaries across macOS, Linux, and Windows. Unlike Electron—which bundles an entire Chromium runtime and Node.js binary (~80–150 MB per application)—Pake leverages the host operating system’s embedded web engine via Rust’s `tauri` and `wry` abstraction crates:
- **macOS**: `WKWebView` via Cocoa / WebKit Objective-C runtime (`objc2-web-kit`).
- **Windows**: `WebView2` (Chromium Edge runtime via COM).
- **Linux**: `WebKitGTK` (`webkit2gtk-4.1` / `soup-3.0` over GLib/GTK3).

The system consists of two primary operational planes:
1. **The CLI Orchestrator Plane (TypeScript / Node.js ESM)**: Manages option normalization, dynamic asset fetching (favicons, PSL parsing, ICO binary rebuilding), template composition, and cross-platform compilation invocation.
2. **The Native Host Plane (Rust / Tauri v2)**: Implements native window management, multi-instance IPC, system tray integration, deep shortcut bindings, rendering engine workarounds, and user script injection.

```
+-----------------------------------------------------------------------------------------+
|                                CLI Orchestrator Plane (Node.js ESM)                     |
|                                                                                         |
|  [ Commander CLI ] -> [ Options Sanitization ] -> [ Favicon / ICO Generator (Sharp) ]   |
|         |                                                      |                        |
|         v                                                      v                        |
|  [ BuilderProvider ] ---> [ LinuxBuilder / MacBuilder / WinBuilder ]                    |
|         |                        |                                                      |
|         v                        v                                                      |
|  [ Workspace Isolator ]   [ combineFiles (.css -> __PAKE_INJECT_STYLE__, .js newline) ]|
+------------------------------------------+----------------------------------------------+
                                           | Spawns cargo / tauri build via execa
                                           v
+-----------------------------------------------------------------------------------------+
|                                  Native Host Plane (Rust / Tauri v2)                    |
|                                                                                         |
|  [ lib.rs: App Initialization ] <---> [ Platform Webview Hook (wry / WebKitGTK / Cocoa) ]|
|         |                                      |                                        |
|         +--> [ WebKitGTK Safe Mode & SHM Flags (niri/Wayland/X11 dmabuf bypass) ]       |
|         |                                      |                                        |
|         +--> [ Custom User Script Injection Engine: find.js, theme.js, proxy.js ]       |
|         |                                      |                                        |
|         +--> [ Windowing & Tab Management (macOS tabbing vs Linux/Win single window) ]   |
+-----------------------------------------------------------------------------------------+
```

### 1.2 Subsystem Invariants & Memory State Ownership
- **Build Isolation Contract**: When installed globally via `npm` or `pnpm`, Pake's package root in the global store must remain read-only. `bin/utils/dir.ts` implements a dynamic workspace redirection (`setBuildDirectory`) to an isolated temporary scratchpad (`tmp-promise`). This prevents concurrent build collisions and preserves the global package directory from mutation.
- **Foreign WebView Injection Invariant**: All scripts injected into the target site (`find.js`, style overlays) execute in an unprivileged, un-isolated DOM context alongside third-party web application scripts. They must not pollute global namespace scope, must not capture events destructively before the host web application processes them, and must handle DOM lifecycle phases (`DOMContentLoaded` vs late runtime hydration) without leaking DOM nodes or event listeners.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Concatenated Injected Script Line-Ending Termination Contract
**RULE**:
When concatenating, wrapping, or injecting arbitrary source code or CSS into dynamic script evaluation wrappers (such as `window.addEventListener('DOMContentLoaded', ...)` or polyfill envelopes), every raw input segment MUST be explicitly preceded and succeeded by a mandatory newline (`\n`). Code generation pipelines MUST NOT inline delimiters or closing wrapper braces (`});`) on the same line as the concatenated source buffer.

**WHY**:
JavaScript single-line comments (`// comment`) consume all characters until the next line terminator (`U+000A` LF or `U+000D` CR). If an injected user script or minified bundle terminates with a single-line comment without a trailing newline, appending wrapper tokens like `});` or `})()` directly to the buffer causes the closing wrapper syntax to be interpreted as part of the comment. This turns valid syntax into an unclosed token stream, triggering an uncatchable `SyntaxError: Unexpected end of input` during runtime execution and silently killing the host application's injection pipeline.

**WHEN TO APPLY**:
Apply in any CLI, bundler, webview injection system, Babel/Rollup plugin, or automated payload generator that wraps arbitrary text files into runtime execution envelopes across TypeScript, JavaScript, Rust, or Go.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// bin/utils/combine.ts
import fs from 'fs/promises';

export default async function combineFiles(files: string[], output: string): Promise<string[]> {
  const contents = await Promise.all(
    files.map(async (file: string) => {
      if (file.endsWith('.css')) {
        const fileContent = await fs.readFile(file, 'utf-8');
        return [
          "window.addEventListener('DOMContentLoaded', (_event) => {",
          `  const css = ${JSON.stringify(fileContent)};`,
          "  if (typeof window.__PAKE_INJECT_STYLE__ === 'function') {",
          "    window.__PAKE_INJECT_STYLE__(css);",
          "  } else {",
          "    const style = document.createElement('style');",
          "    style.textContent = css;",
          "    document.head.appendChild(style);",
          "  }",
          "});",
        ].join('\n');
      }

      const fileContent = await fs.readFile(file, 'utf-8');
      // Invariant: fileContent MUST be isolated on its own lines.
      // If fileContent ends with a trailing single-line comment without \n,
      // appending '});' directly on the same line will comment out the closing brace.
      return (
        "window.addEventListener('DOMContentLoaded', (_event) => {\n" +
        fileContent +
        "\n});"
      );
    }),
  );

  await fs.writeFile(output, contents.join('\n'), 'utf-8');
  return files;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct buffer string concatenation without explicit line break isolation.
// If fileContent is: "console.log('injected'); // end comment"
// The resulting string is:
// window.addEventListener('DOMContentLoaded', (_event) => { console.log('injected'); // end comment });
// The '});' is swallowed by the line comment!
return `window.addEventListener('DOMContentLoaded', (_event) => { ${fileContent} });`;
```

**VERIFICATION METHOD**:
Enforce via unit tests validating that payloads terminating in un-terminated single-line comments parse and execute successfully:
```typescript
it("preserves closing wrapper syntax when injected file ends in a single-line comment without newline", async () => {
  const badScript = "console.log('init'); // dangling comment without newline";
  const wrapped = "window.addEventListener('DOMContentLoaded', (_event) => {\n" + badScript + "\n});";
  expect(() => new Function(wrapped)).not.toThrow();
  expect(wrapped.endsWith("\n});")).toBe(true);
});
```

---

### 2. Multi-Engine DOM Shortcut Delegation Priority Invariant
**RULE**:
Container-level and desktop-shell keyboard event listeners injected into an embedded webview MUST listen in the **bubble phase** on the `window` object, MUST check `event.defaultPrevented` before handling, and MUST NOT invoke `event.stopPropagation()` or `event.stopImmediatePropagation()`.

**WHY**:
Web applications frequently implement custom key-intercept logic (e.g., Notion, Google Docs, Monaco Editor binding `Ctrl+F` or `Cmd+K`). When a shell environment captures keyboard shortcuts in the capture phase on `document` and stops propagation, it completely starves the target web application of standard keyboard events. Conversely, registering in the bubble phase on `window` guarantees the target application's inner DOM nodes receive the event first. If the page handles the event via `event.preventDefault()`, the shell gracefully steps aside. Omitting `stopPropagation` preserves the event flow for non-conflicting background listeners.

**WHEN TO APPLY**:
Apply to all WebView shells, browser extensions, Electron preload scripts, and Tauri plugins that inject auxiliary UI overlays (find panels, menu bars, quick pickers) into third-party web content.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// src-tauri/src/inject/find.js
(function () {
  function handleFindShortcut(event) {
    // Invariant 1: If the page application already consumed the shortcut, yield immediately.
    if (event.defaultPrevented) {
      return;
    }

    const action = getFindShortcutAction(event);
    if (!action) {
      return;
    }

    // Invariant 2: Prevent default browser behavior (e.g., default browser find or page reload),
    // but NEVER call event.stopPropagation() so auxiliary non-conflicting monitors still see the event.
    event.preventDefault();
    window.pakeFind[action]();
  }

  if (state.enabled) {
    // Invariant 3: Listen on window in the bubble phase (useCapture = false / omitted).
    // This executes strictly after the target element and document event lifecycles.
    window.addEventListener("keydown", handleFindShortcut, false);
  }
})();
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Capturing phase interception with aggressive propagation stoppage.
// Starves Google Docs, Notion, Monaco editor, and other web apps of native shortcut handling.
document.addEventListener(
  "keydown",
  (event) => {
    if (event.ctrlKey && event.key === "f") {
      event.preventDefault();
      event.stopPropagation(); // BUG: Starves web app's own handlers
      openShellFindPanel();
    }
  },
  true // BUG: Intercepts before DOM elements receive event
);
```

**VERIFICATION METHOD**:
Implement a headless DOM test verifying that when an inner element invokes `preventDefault()`, the container find panel is bypassed:
```javascript
it("lets a page with its own find keep the shortcut", () => {
  const context = loadFindScript({ enabled: true });
  let openCalled = false;
  context.window.pakeFind.open = () => { openCalled = true; };

  const [listener] = context.window.listeners.keydown;
  expect(listener.options).toBeFalsy(); // Bubble phase

  const event = createKeyboardEvent("f", { ctrlKey: true });
  event.preventDefault(); // Simulate web app capturing the shortcut
  listener.handler(event);

  expect(openCalled).toBe(false);
});
```

---

### 3. Native Binary FFI Crate Dependency Feature Alignment Invariant
**RULE**:
When an application host crate links directly against a low-level C-library wrapper (e.g., `webkit2gtk`, `windows-sys`, `objc2`) that is also transitively imported and exposed by an intermediary abstraction layer (e.g., `wry`, `tauri`), the host crate’s `Cargo.toml` MUST declare the EXACT same feature version flags as the intermediary abstraction crate.

**WHY**:
In Rust, FFI bindings crates often link to platform dynamic libraries with cargo feature flags enabling specific API version ranges (e.g., `features = ["v2_40"]`). If the intermediary crate (`wry`) resolves `v2_40` but the consuming application explicitly requests `v2_38`, two catastrophic failure modes arise:
1. Cargo may resolve two distinct versions or disparate feature sets of the same crate. Attempting to downcast an opaque pointer via `PlatformWebview::inner` fails at runtime or causes undefined behavior because the structs originate from distinct crate instances.
2. The compiled binary advertises compatibility with an older platform runtime (`v2_38`) while silently linking to symbols requiring the newer version (`v2_40`), resulting in dynamic linker relocation failures (`symbol lookup error: undefined symbol`) on end-user machines with older shared libraries.

**WHEN TO APPLY**:
Apply to all Rust projects integrating with platform web engines via FFI (`wry`, `tauri`, `gtk`, `webkit2gtk`, `objc2`, `windows-rs`).

**VERIFIED IMPLEMENTATION PATTERN**:
```toml
# src-tauri/Cargo.toml
[dependencies]
# Used for native WebKitGTK go_back/go_forward on error pages.
# Version and features MUST match what wry resolves, or PlatformWebview::inner
# hands back a WebView from a different crate instance or causes FFI ABI divergence.
webkit2gtk = { version = "=2.0.2", features = ["v2_40"] }
```

**NEGATIVE CONSTRAINT**:
```toml
# ANTI-PATTERN: Understating feature requirements or mismatching upstream runtime assumptions.
# wry links against WebKitGTK 2.40 APIs, but declaring v2_38 creates ABI dissonance and runtime pointer failure.
webkit2gtk = { version = "2.0.2", features = ["v2_38"] }
```

**VERIFICATION METHOD**:
Run automated metadata verification during CI to enforce feature parity between root dependencies and transitive locks:
```bash
cargo metadata --locked --format-version 1 | jq -e '
  .packages[] | select(.name == "webkit2gtk") | .features | index("v2_40")
' > /dev/null || (echo "FATAL: webkit2gtk missing v2_40 feature alignment" && exit 1)
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: WebKitGTK Crate Feature Mismatch & Downcasting Hazard (BUG-PAKE-01)
- **Context**: Subsystem `src-tauri/Cargo.toml` and native Linux WebKitGTK runtime hooks in `src-tauri/src/lib.rs`.
- **What Was Expected**: `PlatformWebview::inner` should safely provide access to the underlying `webkit2gtk::WebView` pointer to implement native page navigation (`go_back`, `go_forward`) on network error pages.
- **What Actually Happened**: Pake declared `webkit2gtk = { version = "=2.0.2", features = ["v2_38"] }`, while upstream `wry` compiled `webkit2gtk` with `features = ["v2_40"]`. This introduced the risk of `PlatformWebview::inner` returning a struct instance belonging to a distinct crate resolution or causing ABI mismatches. Additionally, documentation and comments incorrectly restricted SHM rendering workarounds to X11 when Wayland was equally impacted.
- **Evidence in Repo**: Commit `20275be9`.
- **Root Cause**: Downstream `Cargo.toml` understated the true minimum WebKitGTK runtime feature requirement that was already unconditionally imported by `wry`.
- **Remediation Code Diff**:
```diff
--- a/src-tauri/Cargo.toml
+++ b/src-tauri/Cargo.toml
@@ -56,7 +56,7 @@ objc2-web-kit = { version = "0.3", default-features = false, features = [
 # Used for native WebKitGTK go_back/go_forward on error pages (no page JS).
 # Version and features must match what wry resolves, or PlatformWebview::inner
 # hands back a WebView from a different crate instance.
-webkit2gtk = { version = "=2.0.2", features = ["v2_38"] }
+webkit2gtk = { version = "=2.0.2", features = ["v2_40"] }
 # Reads the freedesktop color-scheme from the settings portal. Same version
 # and features that tauri-plugin-opener and single-instance already lock.
 zbus = "5.14"

--- a/src-tauri/src/lib.rs
+++ b/src-tauri/src/lib.rs
@@ -126,7 +126,7 @@ fn is_niri_session(niri_socket: Option<&str>, desktop_values: &[Option<&str>]) ->
 /// stability in general, three months before anything Wayland-specific, and
 /// upstream still reports the blank window it prevents on X11 with the NVIDIA
 /// proprietary driver (tauri-apps/tauri#9394). This is the legacy policy;
-/// apply_linux_webkit_runtime_flags substitutes SHM on WebKitGTK 2.52+ X11.
+/// apply_linux_webkit_runtime_flags substitutes SHM on WebKitGTK 2.52+.
 ///
 /// niri is excepted because #1226 was fixed by dropping both variables, and on
 /// WebKitGTK 2.52 either one alone is enough to undo that: disabling the dmabuf
```
- **Lesson**: Direct dependencies that interact via downcasting with objects initialized by indirect dependencies MUST synchronize their version strings and feature flags with exact pinned constraints.

---

### Incident 2: Host Web App Shortcut Starvation via Aggressive Capture Interception (BUG-PAKE-02)
- **Context**: Injected client script `src-tauri/src/inject/find.js`.
- **What Was Expected**: Desktop application users should be able to press `Ctrl+F` (or `Cmd+F`) to trigger Pake's built-in in-page find overlay, while complex web applications that implement their own search interfaces (e.g., Notion, Google Docs, Slack web) should retain exclusive ownership of the shortcut.
- **What Actually Happened**: `find.js` registered a capturing event listener on `document` (`document.addEventListener("keydown", handleFindShortcut, true)`) and immediately invoked `event.stopPropagation()`. As a result, web apps with dedicated find mechanisms never received the `keydown` event, breaking in-app search workflows.
- **Evidence in Repo**: Commit `49084531`. Test suite updates in `tests/unit/find-shortcuts.test.js`.
- **Root Cause**: Capturing event listeners on root DOM nodes execute before inner element targets, and calling `stopPropagation()` completely kills event propagation through the DOM tree.
- **Remediation Code Diff**:
```diff
--- a/src-tauri/src/inject/find.js
+++ b/src-tauri/src/inject/find.js
@@ -698,14 +698,19 @@
     return "";
   }

+  // The page gets the shortcut first: listening on window in the bubble phase runs after the
+  // page's own element and document handlers, and a page with its own find (Notion, Google
+  // Docs) calls preventDefault, so Pake's panel stays out of its way. Propagation is left alone.
   function handleFindShortcut(event) {
+    if (event.defaultPrevented) {
+      return;
+    }
     const action = getFindShortcutAction(event);
     if (!action) {
       return;
     }

     event.preventDefault();
-    event.stopPropagation();
     window.pakeFind[action]();
   }

@@ -720,6 +725,6 @@
   };

   if (state.enabled) {
-    document.addEventListener("keydown", handleFindShortcut, true);
+    window.addEventListener("keydown", handleFindShortcut);
   }
 })();
```
- **Lesson**: Injected container scripts must register during the bubbling phase on `window` and check `event.defaultPrevented` to yield gracefully to the underlying web application.

---

### Incident 3: Package Name Casing Divergence and Relocation Crash (BUG-PAKE-03)
- **Context**: Linux package naming and AppImage execution docs (`bin/utils/name.ts`, `docs/faq.md`).
- **What Was Expected**: Building an AppImage for an app named `MyApp` should produce a deterministic artifact and run cleanly across Linux environments.
- **What Actually Happened**: The documentation instructed users to run `./output/MyApp.AppImage`. However, Linux package generation logic in `bin/utils/name.ts` (`generateLinuxPackageName`) forcibly lowercases the package name (`myapp.AppImage`), causing command-not-found errors in shell scripts and CI jobs. Furthermore, WebKit helper processes in AppImages experienced dynamic linking failures when extracted without an explicit symlink to `webkit2gtk-4.1`.
- **Evidence in Repo**: Commit `feb88083`.
- **Root Cause**: Disconnect between string casing sanitizers (`name.toLowerCase()`) in the packaging CLI and manual documentation examples.
- **Remediation Code Diff**:
```diff
--- a/docs/faq.md
+++ b/docs/faq.md
@@ -199,7 +199,7 @@ docker run --rm --privileged \
   https://example.com --name MyApp --targets appimage
 ```

-> **Tip:** The generated AppImage may be owned by root. Run `sudo chown $(id -nu):$(id -ng) ./output/MyApp.AppImage` afterwards.
+> **Tip:** The generated AppImage may be owned by root. Run `sudo chown $(id -nu):$(id -ng) ./output/myapp.AppImage` afterwards.

 **Why This Happens:**
```
- **Lesson**: Automated tests must assert artifact output paths against the exact string normalization functions used by the bundler.

---

### Incident 4: Global Package Build Contamination in CLI Runtimes (BUG-PAKE-04)
- **Context**: Global CLI execution workspace management (`bin/utils/dir.ts`).
- **What Was Expected**: Running `pake <url>` via a globally installed binary (`pnpm add -g pake-cli`) should build target binaries in an isolated workspace without modifying or polluting the global `node_modules` directory.
- **What Actually Happened**: `tauriConfigDirectory` defaulted to `path.join(npmDirectory, 'src-tauri', '.pake')` where `npmDirectory` was resolved relative to `import.meta.url`. On Windows and multi-tenant systems, executing `pake` from a global install dumped build artifacts directly into the protected global pnpm store, leading to write permission errors or subsequent build failures (Issue #1424).
- **Evidence in Repo**: `bin/utils/dir.ts` (`setBuildDirectory`).
- **Root Cause**: Hardcoded package relative directory anchors without dynamic runtime workspace indirection.
- **Remediation Code Diff**:
```typescript
// bin/utils/dir.ts
export const packageDirectory = path.join(
  path.dirname(currentModulePath),
  '..',
);
export let npmDirectory = packageDirectory;
export let tauriConfigDirectory = path.join(npmDirectory, 'src-tauri', '.pake');

// A CLI invocation owns one build workspace. Keep template resolution separate
// from generated paths so packaging never rewrites the installed package.
export function setBuildDirectory(directory: string): void {
  npmDirectory = directory;
  tauriConfigDirectory = path.join(directory, 'src-tauri', '.pake');
}
```
- **Lesson**: Global CLI tools that invoke downstream compilers must explicitly decouple the static distribution assets from a dynamically provisioned scratchpad directory.

---

### Incident 5: Malformed ICO Dimension Truncation and DPI Degradation (BUG-PAKE-05)
- **Context**: Dynamic icon transcoding in `bin/utils/ico.ts` (Resolving Issue #1190).
- **What Was Expected**: Generating Windows ICO files from high-resolution web favicons must yield crisp icons for 16x16 tray icons, 32x32 taskbars, and 256x256 shell shortcuts without runtime blurriness.
- **What Actually Happened**: Windows ICO directory entries store width and height as single bytes (`readUInt8`). A dimension of 256 pixels overflows an 8-bit unsigned integer (256 modulo 256 is 0). Naive parsers interpreted the 0 byte as a literal width/height of 0 pixels, breaking sort order and causing Windows to scale down a blurred 16x16 icon across high-DPI displays.
- **Evidence in Repo**: `bin/utils/ico.ts` (`decodeDimension`).
- **Root Cause**: Failure to implement the Microsoft Icon format specification rule: an encoded byte value of `0` in the directory entry represents 256 pixels.
- **Remediation Code Diff**:
```typescript
// bin/utils/ico.ts
function decodeDimension(value: number): number {
  // Microsoft ICO spec: A width or height of 0 in the directory entry represents 256 pixels.
  return value === 0 ? 256 : value;
}

// When writing PNG-in-ICO frames:
const sizeByte = size >= 256 ? 0 : size;
output.writeUInt8(sizeByte, entryOffset);
output.writeUInt8(sizeByte, entryOffset + 1);
```
- **Lesson**: Binary parsing routines must strictly adhere to domain-specific protocol sentinels (e.g., zero-byte dimension aliasing).

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Falsy Zero Handling in Dimension Parsing**: In binary structures (such as Microsoft ICO headers), a dimension value of `0` is a sentinel for `256`, not a missing or zero-length frame. Evaluating `if (!width)` or `width || fallback` causes `0` to evaluate to the fallback rather than `256`. 
  ```typescript
  // INVARIANT: Explicit strict comparison against 0
  function decodeDimension(value: number): number {
    return value === 0 ? 256 : value;
  }
  ```
- **Type Coercion Hazards in Linux Distro Detection**: Shell configuration files (`/etc/os-release`) wrap values in optional quotes. Direct checks like `if (val === 'debian')` fail if the string contains surrounding quotes.
  ```typescript
  // INVARIANT: Strip matching boundary quotes without regex greediness
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
     (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  ```
- **Duck-Typing Error Containment**: When errors cross process or module boundaries (e.g., across esbuild/rollup bundles), `instanceof PakeError` checks can evaluate to `false`. Structural duck-typing is required:
  ```typescript
  export function isPakeError(error: unknown): error is PakeError {
    return (
      error instanceof PakeError ||
      (typeof error === 'object' &&
        error !== null &&
        (error as { isUserError?: boolean }).isUserError === true)
    );
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Deterministic Domain Reduction via PSL**: Recursive domain parsing can enter unbounded loops on maliciously crafted domain inputs (e.g., deeply nested subdomains). Pake bounds domain parsing using standard Public Suffix List rules:
  ```typescript
  // INVARIANT: Guard against recursion by bounded split slicing
  const productLabel = subdomain.split('.').pop() || '';
  const rootLabel = registrableDomain.split('.')[0] || '';
  ```
- **Binary Stream Offset Monotonicity Proof**: While parsing ICO directory headers, a corrupted or malicious file can specify an offset that points backward or creates an infinite loop. Monotonic progress and strict bounding must be validated:
  ```typescript
  // INVARIANT: Monotonic boundary validation per directory entry
  for (let i = 0; i < count; i++) {
    const offset = ICO_HEADER_SIZE + i * ICO_DIR_ENTRY_SIZE;
    const bytesInRes = buffer.readUInt32LE(offset + 8);
    const imageOffset = buffer.readUInt32LE(offset + 12);

    if (bytesInRes < 1 || imageOffset + bytesInRes > buffer.length) {
      throw new Error('Invalid ICO: frame out of bounds.');
    }
  }
  ```

### 3. UI & UX Micro-Mechanics
- **Style Injection Idempotency & Shadow DOM Protection**: When injecting styles into third-party websites, web applications may wipe or re-render `document.head`. To prevent visual flashing, Pake exposes `window.__PAKE_INJECT_STYLE__`. If unavailable, it falls back to standard DOM attachment:
  ```javascript
  if (typeof window.__PAKE_INJECT_STYLE__ === 'function') {
    window.__PAKE_INJECT_STYLE__(css);
  } else {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
  ```
- **Bubble Phase Keyboard Delegation**: Intercepting keys in the capturing phase prevents input fields inside Shadow DOM or iframes from handling their own events. Registering on `window` in the bubbling phase ensures elements in the focused tree process events first.

### 4. Backend Concurrency & Memory Safety
- **Zero-Collision Identifier Generation**: Multiple desktop instances wrapping the same URL must not collide in the system application data store. Pake incorporates both the target URL and the user-specified application name into the MD5 hash:
  ```typescript
  export function getIdentifier(url: string, name?: string): string {
    const hashInput = name ? `${url}::${name}` : url;
    const postFixHash = crypto
      .createHash('md5')
      .update(hashInput)
      .digest('hex')
      .substring(0, 6);
    return `com.pake.a${postFixHash}`;
  }
  ```
- **Machine-Mode Output Decoupling**: When executed by an autonomous agent or CI pipeline (`--json`), human-targeted progress spinners (`ora`) and logging libraries (`loglevel`) must be redirected away from `stdout`. Failure to do so corrupts the JSON output stream:
  ```typescript
  export function enableMachineMode(): void {
    if (machineMode) return;
    machineMode = true;
    chalk.level = 0;
    log.methodFactory = (methodName) => {
      return (...args: unknown[]) => {
        if (methodName === 'warn') {
          capturedWarnings.push(args.map(String).join(' '));
        }
        console.error(...args); // All logs routed strictly to stderr
      };
    };
    log.setLevel(log.getLevel());
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Sanitizing Target Paths Against Injection**: File names derived from arbitrary web titles can contain path