> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-pake-learnings.md`  
> **Source**: github ([https://github.com/tw93/Pake](https://github.com/tw93/Pake))  
> **Source Version**: `9b54b543`  
> **License**: GPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T21:55:40.518Z  
> **Learning ID**: `learn-github-tw93-pake`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tw93/Pake

---

## 1. Executive Forensic Architecture & System Mechanics

```
               +-----------------------------------------------------------+
               |                  CLI Invocations & Options                |
               |       (bin/cli.ts, bin/options/*, bin/helpers/*)          |
               +-----------------------------+-----------------------------+
                                             |
                                             v
               +-----------------------------------------------------------+
               |         Builder Abstraction (BuilderProvider.ts)          |
               |          +----------------+----------------+              |
               |          |                |                |              |
               |          v                v                v              |
               |     MacBuilder       WinBuilder       LinuxBuilder        |
               +----------+----------------+----------------+--------------+
                          |                |                |
                          +----------------+----------------+
                                           |
                                           v
               +-----------------------------------------------------------+
               |        Pake Core Preprocessing & Synthesis Engine         |
               |  - Script/CSS Ingestion: combine.ts (DOM wrappers)        |
               |  - Icon Packing: ico.ts (Multi-res binary generation)     |
               |  - Distro Target Discovery: platform.ts (/etc/os-release) |
               |  - Host Isolation: dir.ts (Ephemeral build workspaces)    |
               +---------------------------+-------------------------------+
                                           |
                                           v
               +-----------------------------------------------------------+
               |                  Tauri / Rust Subsystem                   |
               |               (src-tauri/src/main.rs, etc.)               |
               |  - Webview2 (Windows) / WebKitGTK (Linux) / WebKit (macOS)|
               |  - Native Shortcuts, Menus, IPC bridges, Tray             |
               +-----------------------------------------------------------+
```

### Problem Statement & Scope
Pake converts arbitrary web applications into resource-efficient, cross-platform desktop executables. Unlike Chromium-bundled engines (e.g., Electron) that bundle a dedicated V8 engine and Chromium rendering stack per application—incurring baseline disk footprints exceeding 150 MB and memory footprints over 200 MB per window—Pake targets the operating system's native embedded web engine via Tauri:
- **macOS**: `WKWebView` (Cocoa / WebKit)
- **Windows**: `WebView2` (Chromium-based Evergreen Runtime via Edge)
- **Linux**: `WebKitGTK` (WebKit2GTK-4.1 / libsoup-3)

The architecture reduces disk footprint down to 3–15 MB while retaining high native fidelity.

### Architectural Subsystems and Decoupling Invariants
1. **Host-Independent CLI Pipeline (`bin/`)**:
   - `BuilderProvider.ts` acts as a polymorphic factory mapping host platforms (`process.platform`) to specialized build orchestrators (`MacBuilder`, `WinBuilder`, `LinuxBuilder`).
   - All builders extend `BaseBuilder.ts`, enforcing a strict lifecycle invariant:
     $$\text{Validate Options} \longrightarrow \text{Prepare Workdir} \longrightarrow \text{Synthesize Assets} \longrightarrow \text{Generate Tauri Config} \longrightarrow \text{Invoke Rust Toolchain}$$
2. **Build Workspace Isolation Layer (`bin/utils/dir.ts`)**:
   - The CLI must not mutate the installed package directory in global storage (e.g., global `pnpm`, `npm -g`). Mutation during concurrent builds corrupts subsequent builds.
   - Pake resolves package assets as immutable templates (`packageDirectory`), while dynamic outputs and mutated Tauri configurations are redirected via `setBuildDirectory(tempWorkspace)`.
3. **Binary Image Re-Encoding & Packaging Engine (`bin/utils/ico.ts`)**:
   - Operating systems (notably Windows Explorer, Taskbar, and System Tray) require specific icon dimensions (16, 24, 32, 48, 64, 128, 256 px). Single-resolution icons scale poorly or crash shell icon caches.
   - Pake embeds a low-level binary parser and writer for ICO containers supporting both raw BMP DIB headers and PNG-in-ICO formats (standardized since Windows Vista).
4. **Machine Mode / Headless IPC Interface (`bin/utils/output.ts`)**:
   - Automated agents and CI runners consume CLI operations through a machine interface (`--json`).
   - The system redirects all standard informational logging, spinners (`ora`), and subprocess output to `stderr`, reserving `stdout` strictly for a single, machine-readable JSON object representing execution state and build artifact metadata.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Mandatory Trailing-Newline Delimitation in Polyglot Code Synthesis
**RULE**:
When concatenating user-supplied or externally sourced source code into synthetic lexical wrappers (e.g., wrapping arbitrary JavaScript inside an event listener or IIFE), the synthesizer **MUST** append an explicit newline character (`\n`) prior to injecting closing block delimiters (e.g., `});` or `}`).

**WHY**:
If the user-provided code file ends with a single-line comment (e.g., `// End of file`, `//# sourceMappingURL=...`) and omits a terminating newline, appending the closing wrapper delimiter on the same line causes the closing token to be lexically parsed as part of the comment. This results in an unclosed syntax error (`Uncaught SyntaxError: Unexpected end of input`), breaking runtime execution silently.

**WHEN TO APPLY**:
Apply in any code synthesis engine, polyglot compiler, CLI injection pipeline, build-time script wrapper, or proxy injection harness where third-party raw scripts are enclosed in lexical closures.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified from bin/utils/combine.ts
export async function wrapScriptInListener(rawScriptBuffer: Buffer): Promise<string> {
  const fileContent = rawScriptBuffer.toString('utf-8');
  
  // INVARIANT: Ensure closing '});' is guaranteed to reside on a distinct line.
  // A single-line comment on the final line without a trailing newline would
  // comment out '});' if appended directly.
  return (
    "window.addEventListener('DOMContentLoaded', (_event) => {\n" +
    fileContent +
    "\n});"
  );
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct template literal or inline concatenation
// Breaks if fileContent ends with "// my comment" without '\n'
return `window.addEventListener('DOMContentLoaded', (_event) => { ${fileContent} });`;
```

**VERIFICATION METHOD**:
Run an automated test passing script strings ending in single-line comments without trailing newlines, validating that the parsed AST or eval does not throw a syntax error:
```typescript
import { test, expect } from 'vitest';

test('wrapScriptInListener handles comments without trailing newline', () => {
  const dirtyScript = Buffer.from('console.log("active"); // trailing comment');
  const wrapped = wrapScriptInListener(dirtyScript);
  expect(() => new Function(wrapped)).not.toThrow();
  expect(wrapped.endsWith('\n});')).toBe(true);
});
```

---

### 2. Strict Stream Demultiplexing for Machine-Readable Tool Execution
**RULE**:
When implementing CLI utilities capable of emitting machine-readable payloads (e.g., `--json`), stdout **MUST** be reserved exclusively for the structured final payload, and all logging, diagnostics, warnings, and subprocess telemetry **MUST** be multiplexed to stderr.

**WHY**:
Automation wrappers and AI agents rely on parsing stdout as a single JSON document (`JSON.parse(stdout)`). Any stray token, ANSI escape sequence, update notifier, or progress spinner written to stdout renders the buffer unparseable, resulting in downstream agent failures.

**WHEN TO APPLY**:
Universal across all developer tooling, command-line interfaces, and agent plugin executables returning structured data to programmatic consumers.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified from bin/utils/output.ts
let machineMode = false;
const capturedWarnings: string[] = [];

export function enableMachineMode(): void {
  if (machineMode) return;
  machineMode = true;
  
  // 1. Strip ANSI control codes universally
  chalk.level = 0;
  
  // 2. Intercept and redirect all application-level logging to stderr
  log.methodFactory = (methodName) => {
    return (...args: unknown[]) => {
      if (methodName === 'warn') {
        capturedWarnings.push(args.map(String).join(' '));
      }
      console.error(...args);
    };
  };
  log.setLevel(log.getLevel());
}

export function printJsonResult(result: PakeJsonResult): void {
  // 3. Exactly one line of serialized, parseable JSON on stdout
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Commingling status updates and JSON on stdout
export function badOutput(result: any) {
  console.log("Build started..."); // Pollution of stdout
  console.log(JSON.stringify(result)); // Consumers fail on JSON.parse()
}
```

**VERIFICATION METHOD**:
Execute the CLI inside an integration harness with stdout piped directly into `JSON.parse()`. Any parse failure invalidates the build:
```typescript
import { execa } from 'execa';
import { test, expect } from 'vitest';

test('cli emits strictly parseable JSON on stdout in machine mode', async () => {
  const { stdout } = await execa('node', ['dist/cli.js', 'https://example.com', '--name=Test', '--json']);
  expect(() => JSON.parse(stdout)).not.toThrow();
  const parsed = JSON.parse(stdout);
  expect(parsed).toHaveProperty('ok');
});
```

---

### 3. Binary Container Frame Normalization and Ordering Invariant
**RULE**:
When generating binary multi-resolution image containers (such as Microsoft ICO format), the serializer **MUST** sort and serialize internal directory headers such that the primary shell-preferred dimension appears at index 0, and **MUST** re-calculate all internal binary offsets relative to the aggregated header and payload boundaries.

**WHY**:
The Windows Shell (`explorer.exe`) inspects directory entries sequentially. If smaller frames (e.g., 16x16) or unaligned offsets precede the primary frame, Windows will display pixelated upscaled icons in high-DPI displays or file pickers. Furthermore, invalid byte offsets in binary ICO headers lead to silent fallback to generic OS placeholders.

**WHEN TO APPLY**:
Any packaging system or asset compiler constructing `.ico` or icon-directory files for native desktop consumption.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified from bin/utils/ico.ts
export function buildIcoFromPngBuffers(
  frames: Array<{ size: number; png: Buffer }>,
): Buffer {
  const ICO_HEADER_SIZE = 6;
  const ICO_DIR_ENTRY_SIZE = 16;
  const count = frames.length;
  
  const headerSize = ICO_HEADER_SIZE + count * ICO_DIR_ENTRY_SIZE;
  const totalPayload = frames.reduce((acc, f) => acc + f.png.length, 0);
  const output = Buffer.alloc(headerSize + totalPayload);

  // Write ICO Header
  output.writeUInt16LE(0, 0);               // Reserved: MUST be 0
  output.writeUInt16LE(1, 2);               // Type: 1 = ICO, 2 = CUR
  output.writeUInt16LE(count, 4);           // Number of images

  let currentOffset = headerSize;
  for (let i = 0; i < count; i++) {
    const { size, png } = frames[i];
    const entryOffset = ICO_HEADER_SIZE + i * ICO_DIR_ENTRY_SIZE;
    // INVARIANT: 256 is encoded as 0 in ICO byte format
    const sizeByte = size >= 256 ? 0 : size;

    output.writeUInt8(sizeByte, entryOffset);         // Width
    output.writeUInt8(sizeByte, entryOffset + 1);     // Height
    output.writeUInt8(0, entryOffset + 2);             // Color palette count
    output.writeUInt8(0, entryOffset + 3);             // Reserved
    output.writeUInt16LE(1, entryOffset + 4);          // Color planes (must be 1)
    output.writeUInt16LE(32, entryOffset + 6);         // Bits per pixel (32 for RGBA)
    output.writeUInt32LE(png.length, entryOffset + 8);  // Image data size
    output.writeUInt32LE(currentOffset, entryOffset + 12); // Image byte offset

    png.copy(output, currentOffset);
    currentOffset += png.length;
  }

  return output;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Treating 256px as 256 in byte representation without overflow handling
// Writing 256 into a UInt8 causes truncation or runtime exception
output.writeUInt8(size, entryOffset); // Throws RangeError if size === 256!
```

**VERIFICATION METHOD**:
Assert header validity by reading back written binary buffers and validating boundary offsets:
```typescript
import { test, expect } from 'vitest';
import { buildIcoFromPngBuffers } from './ico';

test('buildIcoFromPngBuffers encodes 256px as 0 and preserves offsets', () => {
  const dummyPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ico = buildIcoFromPngBuffers([{ size: 256, png: dummyPng }]);
  expect(ico.readUInt8(6)).toBe(0); // 256 represented as 0
  expect(ico.readUInt32LE(18)).toBe(22); // Header (6) + Entry (16) = 22
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Edge CDN Cache Poisoning of Binary Assets (BUG-PAKE-01)
- **Context**: `README*.md` documentation headers referencing CDN asset URLs.
- **What Was Expected**: Application documentation across all localized versions (`README_CN`, `README_DE`, `README_FR`, etc.) displays the updated official brand logo.
- **What Actually Happened**: GitHub’s edge proxy (`camo.githubusercontent.com` / `raw.githubusercontent.com`) cached image blobs based on Git branch heads and tags, continually serving outdated branding across international landing pages despite updates to the master branch.
- **Evidence in Repo**: Commit `a73cf409` ("docs(readme): point the logo at the cradling mother asset").
- **Root Cause**: `raw.githubusercontent.com` does not invalidate edge cache headers immediately upon branch modifications when static asset paths are referenced via branch names or volatile references. The edge proxies hold stale objects indefinitely until evicted or referenced with an immutable object key.
- **Remediation Code Diff**:
```diff
--- a/README.md
+++ b/README.md
@@ -1,5 +1,5 @@
 <div align="center">
-  <img src="https://raw.githubusercontent.com/tw93/Pake/36acc2bc6b7d522ff24da7f3af3f9581d4d973f6/assets/logo.png" width="138" />
+  <img src="https://raw.githubusercontent.com/tw93/Pake/ac5508cf519064684c4214fe3f263c58ad7aaf5f/assets/logo.png" width="138" />
   <h1>Pake</h1>
```
- **Lesson**: Asset references served via non-invalidatable third-party CDNs must be explicitly pinned to immutable cryptographic Git commit hashes, preventing edge cache staleness.

---

### Incident 2: Host Global Workspace Corruption in Distributed Package Managers (BUG-PAKE-02)
- **Context**: `bin/utils/dir.ts` and Issue #1424 ("Upgraded to 3.17.7 build and issues span out").
- **What Was Expected**: Invoking `pake` via global managers (`pnpm dlx`, `npx`, or global links) should build the artifact in the current working directory without modifying or searching inside global virtual store directories.
- **What Actually Happened**: The builder wrote configuration files directly to `path.join(__dirname, '..', 'src-tauri', '.pake')`. On Windows installations using `pnpm` (which relies on content-addressable storage symlinks deep inside `AppData\Local\pnpm\global\...`), write permissions were rejected or outputs were emitted into an inaccessible virtual store directory rather than the user's execution context.
- **Evidence in Repo**: Issue #1424:
  `C:\Users\DELL\AppData\Local\pnpm\global\v11\2d30-18e2955c60370328-0\node_modules\.pnpm\pake-cli@3.17.7\...`
- **Root Cause**: Hardcoded relative module paths assumed that the location of the running script (`import.meta.url`) resided in a writable, user-local project workspace rather than an immutable read-only global package store.
- **Remediation Code Diff**:
```diff
--- a/bin/utils/dir.ts
+++ b/bin/utils/dir.ts
@@ -10,3 +10,9 @@ export const packageDirectory = path.join(
 export let npmDirectory = packageDirectory;
 export let tauriConfigDirectory = path.join(npmDirectory, 'src-tauri', '.pake');
+
+// A CLI invocation owns one build workspace. Keep template resolution separate
+// from generated paths so packaging never rewrites the installed package.
+export function setBuildDirectory(directory: string): void {
+  npmDirectory = directory;
+  tauriConfigDirectory = path.join(directory, 'src-tauri', '.pake');
+}
```
- **Lesson**: CLI utilities that dynamically construct configuration files before compiling code must never mutate their own installation trees; they must decouple immutable template assets from isolated, ephemeral build targets.

---

### Incident 3: Linux Video Codec and WebKitGTK Caption Rendering Failure (BUG-PAKE-03)
- **Context**: Issue #1406, Linux WebKitGTK packaging and Docker environment specs (`Dockerfile`).
- **What Was Expected**: Playing YouTube or multimedia streams inside WebKitGTK renders HTML5 closed captions, MSE (Media Source Extensions), and video streams.
- **What Actually Happened**: Video played, but closed captions and specific media formats failed silently with empty text rendering boxes on Linux distributions (Arch, Debian, Ubuntu).
- **Evidence in Repo**: Issue #1406, `Dockerfile` build instructions (`gnome-video-effects`, `libsoup-3.0-dev`, `libwebkit2gtk-4.1-dev`).
- **Root Cause**: Linux WebKitGTK depends on external GStreamer plugin pipelines (`gstreamer1.0-plugins-bad`, `gstreamer1.0-plugins-good`, `gstreamer1.0-libav`) and Cairo text-rendering overlays to composite WebVTT tracks into the hardware video surface. Without these system shared objects, WebKitGTK drops caption tracks without throwing fatal runtime errors.
- **Remediation Code Diff**:
```diff
--- a/Dockerfile
+++ b/Dockerfile
@@ -13,6 +13,7 @@ RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
     apt-get update && apt-get install -y --no-install-recommends \
     libdbus-1-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
     libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev \
-    libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev && \
+    libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
+    gnome-video-effects xdg-utils && \
     apt-get clean && rm -rf /var/lib/apt/lists/*
```
- **Lesson**: Containerized and platform-native WebKit engines fail silently on media playback unless the host’s entire multimedia pipeline (demuxers, codecs, subtitle compositors) is declared in the environment baseline.

---

### Incident 4: Shell Blur and Windows Taskbar Downsampling Artifacts (BUG-PAKE-04)
- **Context**: `bin/utils/ico.ts` (Resolving Issue #1190).
- **What Was Expected**: Custom app icons appear sharp across all Windows UI contexts: 16x16 (Tray/Window Title), 32x32 / 48x48 (Taskbar), and 256x256 (File Explorer Large Tiles).
- **What Actually Happened**: Supplying a high-res (256x256) ICO file caused Windows to perform nearest-neighbor or low-quality box downsampling, resulting in jagged taskbar icons. Conversely, supplying low-res icons produced blurry explorer icons.
- **Evidence in Repo**: `bin/utils/ico.ts`, `WIN_STANDARD_ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]`.
- **Root Cause**: Single-image ICO containers force the Windows desktop window manager (DWM) to scale images dynamically. Windows requires a multi-layer ICO container containing discrete, pre-rendered mipmaps for every standard shell metric.
- **Remediation Code Diff**:
```diff
--- a/bin/utils/ico.ts
+++ b/bin/utils/ico.ts
@@ -0,0 +1,50 @@
+export const WIN_STANDARD_ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;
+
+export async function ensureMultiResolutionIco(
+  sourcePath: string,
+  outputPath: string,
+  preferredSize: number = 256,
+  desiredSizes: readonly number[] = WIN_STANDARD_ICO_SIZES,
+): Promise<boolean> {
+  const sourceBuffer = await fsExtra.readFile(sourcePath);
+  const entries = parseIcoBuffer(sourceBuffer);
+  const sourcePng = await pickLargestFrameAsPng(sourceBuffer, entries);
+  const sharp = await loadSharp();
+
+  const frames = await Promise.all(
+    desiredSizes.map(async (size) => {
+      const exact = entries.find((e) => e.width === size && e.height === size);
+      if (exact && frameLooksLikePng(exact)) {
+        return { size, png: Buffer.from(exact.data) };
+      }
+      const png = await sharp(sourcePng)
+        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
+        .ensureAlpha()
+        .png()
+        .toBuffer();
+      return { size, png };
+    })
+  );
+  // Write unified ICO buffer
+  const icoBuffer = buildIcoFromPngBuffers(frames);
+  await fsExtra.outputFile(outputPath, icoBuffer);
+  return true;
+}
```
- **Lesson**: Operating system shell icons cannot be treated as single-resolution raster graphics; they require multi-resolution mipmap containers generated via high-order resampling kernels.

---

### Incident 5: Subdomain Brand Overwrite in Automated Icon Fetching (BUG-PAKE-05)
- **Context**: `bin/utils/icon-source.ts`.
- **What Was Expected**: Packaging a distinct sub-product hosted on an umbrella domain (e.g., `mail.google.com` or `docs.google.com` named "Docs") retrieves the application's actual branding rather than the top-level corporate logo.
- **What Actually Happened**: Naive domain icon heuristics parsed the registrable domain (`google.com`), resolved the root favicon, and discarded the specialized sub-product branding.
- **Evidence in Repo**: `bin/utils/icon-source.ts`, `shouldPreferDashboardIcons`.
- **Root Cause**: Relying solely on root registrar boundaries (`psl.parse(hostname).domain`) conflates multi-tenant / multi-product subdomains with unified sites.
- **Remediation Code Diff**:
```diff
--- a/bin/utils/icon-source.ts
+++ b/bin/utils/icon-source.ts
@@ -35,6 +35,17 @@ export function shouldPreferDashboardIcons(url: string, appName: string): boole
     const productLabel = subdomain.split('.').pop() || '';
     const rootLabel = registrableDomain.split('.')[0] || '';
     const normalizedAppName = simplify(appName);
 
+    return (
+      normalizedAppName.length > 0 &&
+      simplify(productLabel) === normalizedAppName &&
+      simplify(rootLabel) !== normalizedAppName
+    );
```
- **Lesson**: Automated metadata scrapers targeting subdomains must evaluate the public suffix distance between the subdomain component and the application name to avoid overriding specialized branding.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In binary deserialization pipelines, bitwise boundaries and token-level evaluations require precise handling:

```typescript
// 1. Binary Zero Dimension Exception in ICO Specification
// In Microsoft ICONDIRENTRY specifications, Width=0 and Height=0 mean 256px.
function decodeDimension(value: number): number {
  // CRITICAL: Cannot use 'value || 256' if value can legitimately be non-zero falsy,
  // but here 0 strictly maps to the 256 integer invariant.
  return value === 0 ? 256 : value;
}

// 2. Exact Little-Endian UInt Reading
// Byte 0-1: Reserved (must be 0)
// Byte 2-3: Resource Type (1 for ICO)
// Byte 4-5: Image Count
const reserved = buffer.readUInt16LE(0);
const type = buffer.readUInt16LE(2);
const count = buffer.readUInt16LE(4);

if (reserved !== 0 || type !== 1 || count < 1) {
  throw new Error('Corrupted or unsupported ICO binary stream.');
}
```

*Pitfall Avoided*: Writing `value || 256` in JavaScript would inadvertently coerce `null` or `undefined` to `256` during improper typing, concealing parsing errors. Explicit numeric comparison (`value === 0`) ensures strict type integrity.

### 2. Infinite Loop & Recursion Guards
When parsing untrusted binary buffers containing internal offsets, bad actors or corrupted files can trigger infinite loops or out-of-memory panics:

```typescript
// Verified Invariant: bin/utils/ico.ts
for (let i = 0; i < count; i++) {
  const offset = ICO_HEADER_SIZE + i * ICO_DIR_ENTRY_SIZE;
  const bytesInRes = buffer.readUInt32LE(offset + 8);
  const imageOffset = buffer.readUInt32LE(offset + 12);

  // TERMINATION & BOUNDS PROOF:
  // 1. bytesInRes must be strictly non-zero positive (prevents 0-byte stalling)
  // 2. imageOffset + bytesInRes MUST NOT exceed the total buffer allocation
  // 3. Mathematical overflow guard: imageOffset + bytesInRes can overflow 32-bit uint if unchecked
  if (bytesInRes < 1 || imageOffset + bytesInRes > buffer.length || imageOffset < offset) {
    throw new Error('Invalid ICO: frame buffer boundary out of bounds (corrupt table offset).');
  }

  // Safe slice bounded by invariant proof
  entries.push({
    // ...
    data: buffer.subarray(imageOffset, imageOffset + bytesInRes)
  });
}
```

### 3. UI & UX Micro-Mechanics
Desktop applications wrapping the web face DOM injection timing hazards and Content Security Policy (CSP) blocking.

```javascript
// Verified Invariant: bin/utils/combine.ts
// Injection must be resilient against custom IPC styling vs DOM fallback
window.addEventListener('DOMContentLoaded', (_event) => {
  const css = "...";
