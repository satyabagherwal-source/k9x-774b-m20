# Forensic Learning Record (Deep Inspection): ParthJadhav/app-store-screenshots

> **Canonical Artifact**: `07_PROJECT_LEARNING/parthjadhav-app-store-screenshots-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ParthJadhav/app-store-screenshots](https://github.com/ParthJadhav/app-store-screenshots))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:23:12.695Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ParthJadhav/app-store-screenshots`
- **Description**: end to end app store screenshot creation using AI
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7118 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/app-store-screenshots/template/next.config.mjs`
```
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Next 16.3+ otherwise writes AGENTS.md / CLAUDE.md into every scaffolded
  // project on first `dev`, leaving a dirty tree before anything is edited.
  agentRules: false,
};

export default nextConfig;

```

### Core Architecture Module: `skills/app-store-screenshots/template/postcss.config.mjs`
```
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

### Core Architecture Module: `skills/app-store-screenshots/template/src/app/api/project/route.ts`
```
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { projectValidationError } from "@/lib/project-validation";
import { rejectCrossSiteWrite } from "@/lib/request-guard";
import { readJsonBody } from "@/lib/request-body";

export const dynamic = "force-dynamic";

const PROJECT_FILE = "app-store-screenshots.json";

function filePath() {
  return path.join(process.cwd(), PROJECT_FILE);
}

const revision = (raw: string | null) => `"${raw === null ? "missing" : createHash("sha256").update(raw).digest("hex")}"`;
let writes: Promise<unknown> = Promise.resolve();

export async function GET() {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    const validationError = projectValidationError(parsed);
    if (validationError) throw new Error(validationError);
    return NextResponse.json({ ok: true, state: parsed }, { headers: { ETag: revision(raw), "Cache-Control": "no-store" } });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ ok: true, state: null }, { headers: { ETag: revision(null), "Cache-Control": "no-store" } });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  // This route OVERWRITES a git-tracked file. See lib/request-guard.ts.
  const blocked = rejectCrossSiteWrite(req);
  if (blocked) {
    return NextResponse.json({ ok: false, error: blocked.error }, { status: blocked.status });
  }
  const parsed = await readJsonBody(req, 64 * 1024 * 1024);
  if (parsed.response) return parsed.response;
  const body = parsed.value;
  const validationError = projectValidationError(body);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }
  // Compare and replace in one queue so two tabs cannot both save the same
  // revision. CLI writers may omit If-Match for backwards compatibility.
  const result = writes.then(() => writeProject(body, req.headers.get("if-match")));
  writes = result.catch(() => undefined);
  return result;
}

async function writeProject(body: unknown, expected: string | null) {
  const temporary = `${filePath()}.${randomUUID()}.tmp`;
  try {
    if (expected !== null) {
      let current: string | null;
      try { current = await fs.readFile(filePath(), "utf8"); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        current = null;
      }
      if (expected !== revision(current)) {
        return NextResponse.json(
          { ok: false, error: "Project changed in another tab or on disk. Your edits are still open here; export or copy them before reloading." },
          { status: 412 },
        );
      }
    }
    const pretty = JSON.stringify(body, null, 2) + "\n";
    // Readers must see either the previous complete project or the next one.
    await fs.writeFile(temporary, pretty, "utf8");
    await fs.rename(temporary, filePath());
    return NextResponse.json({ ok: true }, { headers: { ETag: revision(pretty) } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  } finally {
    await fs.unlink(temporary).catch(() => undefined);
  }
}

```

### Core Architecture Module: `skills/app-store-screenshots/template/src/app/api/upload-font/route.ts`
```
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { rejectCrossSiteWrite } from "@/lib/request-guard";
import type { ImportedFont } from "@/lib/types";
import { decodeBase64, readJsonBody } from "@/lib/request-body";
import { writeAsset } from "@/lib/write-asset";

export const dynamic = "force-dynamic";

const FONT_DIR_REL = path.join("public", "fonts", "imported");
const PUBLIC_PREFIX = "/fonts/imported";
const MAX_FONT_BYTES = 16 * 1024 * 1024;

const FONT_EXT: Record<ImportedFont["format"], string> = {
  woff2: "woff2",
  woff: "woff",
  truetype: "ttf",
  opentype: "otf",
};

// The stored format and extension come from the file's magic bytes, never
// from the caller-supplied filename or MIME type.
function sniffFontFormat(bytes: Buffer): ImportedFont["format"] | null {
  if (bytes.length < 4) return null;
  const tag = bytes.subarray(0, 4);
  if (tag.equals(Buffer.from("wOF2", "latin1"))) return "woff2";
  if (tag.equals(Buffer.from("wOFF", "latin1"))) return "woff";
  if (tag.equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) || tag.equals(Buffer.from("true", "latin1"))) {
    return "truetype";
  }
  if (tag.equals(Buffer.from("OTTO", "latin1"))) return "opentype";
  return null;
}

// Check container lengths and table bounds before persisting. Glyph validity
// is checked by the browser's FontFace decoder before the UI imports the file.
function hasFontStructure(bytes: Buffer, format: ImportedFont["format"]): boolean {
  const web = format === "woff" || format === "woff2";
  const header = web ? (format === "woff2" ? 48 : 44) : 12;
  if (bytes.length < header) return false;
  const count = bytes.readUInt16BE(web ? 12 : 4);
  if (!count) return false;
  if (web && (bytes.readUInt32BE(8) !== bytes.length || bytes.readUInt16BE(14) !== 0 ||
    bytes.readUInt32BE(16) > 64 * 1024 * 1024)) return false;
  if (format === "woff2") {
    const compressed = bytes.readUInt32BE(20);
    return compressed > 0 && header + count * 2 + compressed <= bytes.length;
  }
  const stride = web ? 20 : 16;
  const directoryEnd = header + count * stride;
  if (directoryEnd > bytes.length) return false;
  for (let i = 0; i < count; i++) {
    const entry = header + i * stride;
    const offset = bytes.readUInt32BE(entry + (web ? 4 : 8));
    const length = bytes.readUInt32BE(entry + (web ? 8 : 12));
    if (offset < directoryEnd || offset + length > bytes.length) return false;
    if (web && length > bytes.readUInt32BE(entry + 12)) return false;
  }
  return true;
}

export async function POST(req: Request) {
  // This route WRITES A FILE to disk. See lib/request-guard.ts.
  const blocked = rejectCrossSiteWrite(req);
  if (blocked) {
    return NextResponse.json({ ok: false, error: blocked.error }, { status: blocked.status });
  }
  const input = await readJsonBody(req, 23 * 1024 * 1024);
  if (input.response) return input.response;
  const body = input.value as { data?: unknown } | null;
  if (typeof body?.data !== "string" || !body.data) {
    return NextResponse.json({ ok: false, error: "Choose a font file first." }, { status: 400 });
  }
  // Reject oversized payloads before decoding (base64 is ~4/3 of the byte size).
  if (body.data.length > Math.ceil(MAX_FONT_BYTES / 3) * 4) {
    return NextResponse.json({ ok: false, error: "Font file is too large (16MB maximum)." }, { status: 413 });
  }
  const bytes = decodeBase64(body.data);
  if (!bytes) return NextResponse.json({ ok: false, error: "Invalid base64 font data" }, { status: 400 });
  if (bytes.byteLength > MAX_FONT_BYTES) {
    return NextResponse.json({ ok: false, error: "Font file is too large (16MB maximum)." }, { status: 413 });
  }
  const format = sniffFontFormat(bytes);
  if (!format || !hasFontStructure(bytes, format)) {
    return NextResponse.json({ ok: false, error: "Use a WOFF2, WOFF, TTF, or OTF font file." }, { status: 400 });
  }

  const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 16);
  const filename = `${hash}.${FONT_EXT[format]}`;
  const absDir = path.join(process.cwd(), FONT_DIR_REL);
  const absFile = path.join(absDir, filename);

  try {
    await fs.mkdir(absDir, { recursive: true });
    await writeAsset(absFile, bytes);
    const font: ImportedFont = { src: `${PUBLIC_PREFIX}/${filename}`, format };
    return NextResponse.json({ ok: true, font });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

```

### Core Architecture Module: `skills/app-store-screenshots/template/src/app/api/upload/route.ts`
```
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { rejectCrossSiteWrite, sniffImageType } from "@/lib/request-guard";
import sharp from "sharp";
import { decodeBase64, readJsonBody } from "@/lib/request-body";
import { writeAsset } from "@/lib/write-asset";

export const dynamic = "force-dynamic";

const UPLOAD_DIR_REL = path.join("public", "screenshots", "uploaded");
const PUBLIC_PREFIX = "/screenshots/uploaded";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const bytes = decodeBase64(m[2]);
  return bytes ? { mime, bytes } : null;
}

export async function POST(req: Request) {
  // This route WRITES A FILE to disk. See lib/request-guard.ts.
  const blocked = rejectCrossSiteWrite(req);
  if (blocked) {
    return NextResponse.json({ ok: false, error: blocked.error }, { status: blocked.status });
  }
  const input = await readJsonBody(req, 12 * 1024 * 1024);
  if (input.response) return input.response;
  const body = input.value as { dataUrl?: string } | null;
  if (!body?.dataUrl || typeof body.dataUrl !== "string") {
    return NextResponse.json({ ok: false, error: "Missing dataUrl" }, { status: 400 });
  }
  const parsed = parseDataUrl(body.dataUrl);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Unsupported data URL" }, { status: 400 });
  }
  const ext = MIME_EXT[parsed.mime];
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: `Unsupported mime: ${parsed.mime}` },
      { status: 400 },
    );
  }
  // The declared MIME comes from the caller-written data URL, so it decides
  // the stored extension. Require the bytes to actually be that image type.
  const sniffed = sniffImageType(parsed.bytes);
  if (!sniffed || MIME_EXT[sniffed] !== ext) {
    return NextResponse.json(
      { ok: false, error: "Content does not match declared image type" },
      { status: 400 },
    );
  }
  if (parsed.bytes.byteLength > 8 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Image too large (>8MB)" }, { status: 413 });
  }

  try {
    // Decode pixels too: valid headers alone still accept truncated images.
    await sharp(parsed.bytes, { limitInputPixels: 64 * 1024 * 1024, failOn: "warning" }).stats();
  } catch {
    return NextResponse.json({ ok: false, error: "Image is corrupt or exceeds 64 megapixels" }, { status: 400 });
  }

  const hash = createHash("sha1").update(parsed.bytes).digest("hex").slice(0, 16);
  const filename = `${hash}.${ext}`;
  const absDir = path.join(process.cwd(), UPLOAD_DIR_REL);
  const absFile = path.join(absDir, filename);

  try {
    await fs.mkdir(absDir, { recursive: true });
    await writeAsset(absFile, parsed.bytes);
    return NextResponse.json({ ok: true, path: `${PUBLIC_PREFIX}/${filename}` });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

```

### Core Architecture Module: `skills/app-store-screenshots/template/src/app/fonts/imported/[filename]/route.ts`
```
import { serveAsset } from "@/lib/serve-asset";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  return serveAsset("fonts/imported", filename, { woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" });
}

```

### Core Architecture Module: `skills/app-store-screenshots/template/src/app/layout.tsx`
```
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const font = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "App Store Screenshots",
  description: "Design and export App Store + Google Play screenshots.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={font.className}>{children}</body>
    </html>
  );
}

```

### Core Architecture Module: `skills/app-store-screenshots/template/src/app/page.tsx`
```
import { ScreenshotEditor } from "@/components/editor/screenshot-editor";

export default function Page() {
  return <ScreenshotEditor />;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14** (2026-05-20): **bug: Generate images with transparency**
  *Symptoms*: ### Agent and environment  Claude code on mac  ### Install method  npx skills add  ### Prompt used  generic prompt   ### Expected behavior  Images without transparency   ### Actual behavior  The images were generated with transparency which is not allowed by apple, the images were rejected on app store connect.  ### Reproduction steps  models are non deterministics

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

### Incident Patch 1: `8bd75204` (2026-09-29)
**Commit Message**: Fix UI, persistence, upload, and export bugs from full bug bash

**File**: `BUG_BASH.md` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+# Bug bash — 2026-09-29
+
+Covered the editor UI, canvas interactions, persistence, uploads, exports, local APIs, and the documented project migration. Tests ran against disposable project copies in Google Chrome, including a production `next start` server. Existing project files and `promo/` were left untouched.
+
+## Fixed findings
+
+| Reproduction / failure | Fix |
+| --- | --- |
+| Open two editor tabs and save different changes; a stale tab can replace newer work. | Revision-based conditional saves, serialized compare/write, and a visible conflict message. |
+| A save fails, or the page closes before the debounce completes. | Explicit retry, bounded requests, and an unsaved-changes warning. Newer queued edits retain the revision returned by an older in-flight save. |
+| Upload truncated PNG/JPEG data with valid magic bytes, malformed base64, or truncated font containers. | Full image decoding, strict base64, font container bounds, and browser font decoding before import. |
+| Send oversized or chunked request bodies, malformed project elements, duplicate IDs, or unsupported schemas. | Streaming body limits and stronger project validation before any write. |
+| An upload is rejected by the API, but the picker installs the same image as an inline fallback. | Explicit rejections preserve the previous screenshot and display the error. |
+| Two imports complete out of order, or an image's dimensions arrive after a replacement. | Request generation checks prevent stale results replacing newer choices. |
+| Upload assets after starting a production server; the upload succeeds but the URL returns 404. | Runtime image/font serving routes preserve existing URLs and restrict filenames/extensions. Writes are atomic. |
+| A corrupt image returns HTTP 200, or an asset request never completes. | Decode checks, bounded preloading, visible failures, and retry during export. |
+| PNG workers throw, cannot deserialize messages, or never respond. | Retire failed workers and finish encoding inline. |
+| One screen's PNG encoding rejects while the previous screen is still encoding. | Attach rejection handlers immediately to prevent uncaught errors and incomplete accounting. |
+| An imported font never finishes loading during export. | Bounded font loading releases the editor with an actionable error. |
+| Narrow viewports shrink the canvas to an unusable strip. | Scrollable stacked panels and a usable canvas height below the desktop breakpoint. Verified at 320, 390, 820, 1024, and 1440 px. |
+| Duplicate/delete controls disappear on touch tablets. | Keep slide actions visible without hover. |
+| Press Escape while editing an overlay's font size; the canceled value still applies. | Cancel the draft before blur can commit it. |
+| Leave the two-device layout and return; the secondary screenshot is lost. | Preserve the chosen secondary screenshot across layout switches. |
+| Pan at the default zoom, then click Fit active screen; nothing happens. | Explicitly recenter even when the zoom value does not change. |
+| Keyboard focus reaches an image but its inspector stays closed. | Focusing the rotation control selects its element. Added accessible names to related inspector fields. |
+| A notification covers Undo; changing fade direction resets a strength of zero. | Move notifications away from toolbar controls and preserve zero fade strength. |
+| Run the documented migration on null or duplicate overlays. | Sanitize legacy values and ensure unique overlay IDs without dereferencing null. |
+
+## Verification
+
+- `scripts/bug-bash.cjs`: 35 browser regression groups. Covers real image/font upload → reload → export, concurrent tabs, failure injection, exported PNG dimensions for every device, locale output, connected crops, RTL, history, reset, and export locking.
+- `scripts/ui-bug-bash.cjs`: 12 UI interaction groups, including 67 device/layout/orientation combinations; pointer drag/resize, keyboard reorder, rotation, layers, dele
```

**File**: `CONTRIBUTING.md` (modified, +4/-0)
```diff
@@ -43,10 +43,14 @@ The editor regression harness is `scripts/bug-bash.cjs`. Run it against a **disp
 
 ```bash
 PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/bug-bash.cjs http://localhost:3098
+PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/ui-bug-bash.cjs http://localhost:3098
+node scripts/api-bug-bash.cjs http://localhost:3098
 ```
 
 Use an existing Playwright installation or install it outside the repo for this harness. Also run `tsc --noEmit` and the production build in the template. Use the manual checklist below for skill/scaffolding changes.
 
+The API harness checks validation, same-origin writes, concurrent save conflicts, bounded request bodies, and real PNG/JPEG/WOFF2 uploads. Run the harnesses sequentially: the API and export harnesses write the disposable server's project file. The browser harness also covers failed-save recovery, corrupt assets, stalled workers, and narrow screens. The UI harness exercises pointer drag/resize, rotation, layers, keyboard reordering, empty states, themes/fonts, touch controls, responsive layouts, and every device/layout combination. Set `BUG_BASH_FILTER` to run a single browser check by name. Repeat the API and upload/export checks against `next start` to catch production-only asset-serving failures.
+
 ### For README-only changes
 
 - Confirm installation instructions still make sense
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@ Example screenshots generated with this skill were accepted for [Bloom Coffee Sh
 - **Theme picker** - switch palette presets from the toolbar, including one preset per named style.
 - **Platform switcher** - iOS, Mac, and Android tabs keep every deck side by side while sharing the same editor workflow.
 - **Device selector** - iPhone, iPad, Apple TV, Apple Watch, and CarPlay under iOS; Android phone, Android tablets, and the feature graphic under Android. The Mac tab is a single 16:10 Mac deck.
-- **Autosave** - writes to disk through `/api/project` and mirrors to `localStorage` for instant reloads.
+- **Autosave** - writes to disk through `/api/project`, mirrors to `localStorage`, and detects newer disk revisions before overwriting work from another tab or agent. Failed saves can be retried; unsaved edits trigger a warning before leaving.
 - **Export bundle** - downloads a zip organized by platform, device, resolution, and locale.
 
 Tip: when capturing source iPhone screenshots, the 6.1-inch simulator is usually the easiest starting point because it reduces manual image adjustment inside the frames.
@@ -270,7 +270,7 @@ For headlines, `skills/app-store-screenshots/copy-ideas.md` has formulas per sli
 
 ## Requirements
 
-- Node.js 18+
+- Node.js 20.9+
 - One of bun, pnpm, yarn, or npm
 
 ## Contributing
```

**File**: `scripts/api-bug-bash.cjs` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+// Run only against a disposable template copy; this writes projects and assets.
+// node scripts/api-bug-bash.cjs http://localhost:3098
+const assert = require('node:assert/strict');
+const sharp = require('../skills/app-store-screenshots/template/node_modules/sharp');
+const fs = require('node:fs/promises');
+const os = require('node:os');
+const path = require('node:path');
+const {execFileSync} = require('node:child_process');
+const {randomBytes} = require('node:crypto');
+const base = process.argv[2] || 'http://localhost:3098';
+const projectURL = base + '/api/project';
+const post = (route, data, headers = {}) => fetch(base + route, {
+  method: 'POST', headers: {'content-type': 'application/json', ...headers}, body: JSON.stringify(data),
+});
+let passed = 0;
+async function check(name, run) { await run(); console.log('PASS', name); passed++; }
+(async () => {
+  const initial = await fetch(projectURL);
+  assert.equal(initial.status, 200);
+  const {state: original} = await initial.json();
+  assert.ok(original, 'Start with a disposable template project');
+  try {
+    await check('invalid project shapes are rejected without replacing the file', async () => {
+      const slide = {id:'a', layout:'no-device', screenshot:'', label:{en:'Test'}, headline:{en:'Test'}};
+      const rect = {x:0,y:0,width:10,height:10};
+      const invalid = [null, [], {}, {...original,schemaVersion:999}, {...original,connectedCanvas:'false'},
+        {...original,slidesByDevice:{typo:[]}}, {...original,locales:['en','en']},
+        ...[{headline:{en:[]}}, {transforms:{caption:{...rect,width:-1}}}, {textElements:[null]},
+          {imageElements:[{id:'x',src:'a',transform:rect},{id:'x',src:'b',transform:rect}]}]
+          .map(patch => ({...original, slidesByDevice:{watchos:[{...slide,...patch}]}}))];
+      for (const state of invalid) assert.equal((await post('/api/project',state)).status,400);
+      assert.deepEqual((await (await fetch(projectURL)).json()).state, original);
+    });
+    await check('every write route requires exact JSON content type and same origin', async () => {
+      for (const route of ['/api/project','/api/upload','/api/upload-font']) {
+        for (const type of ['text/plain','application/json-invalid']) assert.equal((await post(route,{}, {'content-type':type})).status,415);
+        for (const origin of ['null','https://evil.example','http://localhost:9999']) assert.equal((await post(route,{}, {origin})).status,403);
+        assert.equal((await post(route,{}, {'sec-fetch-site':'cross-site'})).status,403);
+      }
+      for (const host of ['localhost','127.0.0.1']) {
+        const url = new URL(projectURL); url.hostname = host;
+        const response = await fetch(url, {method:'POST',headers:{'content-type':'application/json',origin:url.origin,'sec-fetch-site':'same-origin'},body:JSON.stringify(original)});
+        assert.equal(response.status,200,host);
+      }
+    });
+    await check('concurrent stale project writes conflict and preserve the winning state', async () => {
+      const revision = (await fetch(projectURL)).headers.get('etag');
+      assert.ok(revision);
+      const candidates = ['tab A','tab B'].map(appName=>({...original,appName}));
+      const responses = await Promise.all(candidates.map(data=>post('/api/project',data,{'if-match':revision})));
+      assert.deepEqual(responses.map(r=>r.status).sort(),[200,412]);
+      const winning = responses.findIndex(r=>r.status===200);
+      const current = await fetch(projectURL);
+      assert.deepEqual((await current.json()).state,candidates[winning]);
+      assert.equal(current.headers.get('etag'),responses[winning].headers.get('etag'));
+      assert.equal((await post('/api/project',original,{'if-match':revision})).status,412);
+      assert.equal((await post('/api/project',original,{'if-match':current.headers.get('etag')})).status,200);
+    });
+    await check('truncated, forged, malformed base64 and wrong-typ
```

**File**: `scripts/bug-bash.cjs` (modified, +172/-0)
```diff
@@ -288,6 +288,178 @@ const fixture = (extra = {}) => ({schemaVersion:2,appName:'Bug bash',themeId:'cl
    for(const png of pngs) assert.equal((await png.async('nodebuffer'))[25],2);
    await context.close();
  });
+ await check('rejected image uploads keep the previous screenshot instead of bypassing validation',async()=>{
+   const {page,latest}=await open(fixture({slidesByDevice:{watchos:[slide('upload',{layout:'hero',screenshot:'/previous.png'})]}}));
+   const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=10;return c.toDataURL().split(',')[1]});
+   await page.route('**/api/upload',route=>route.fulfill({status:400,json:{ok:false,error:'Rejected image'}}));
+   await page.locator('input[type=file]').last().setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
+   await page.getByText('Rejected image',{exact:true}).waitFor();
+   await pause(800); assert.equal(latest().slidesByDevice.watchos[0].screenshot,'/previous.png');
+   await page.close();
+ });
+ await check('corrupt images and fonts are rejected before upload',async()=>{
+   const {page,latest}=await open(fixture({slidesByDevice:{watchos:[slide('upload',{layout:'hero'})]}}));
+   let uploads=0;
+   await page.route('**/api/upload*',route=>{uploads++;return route.fulfill({status:400,json:{ok:false}})});
+   await page.locator('input[type=file]').last().setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgo=','base64')});
+   await page.getByText('Image is corrupt or exceeds 64 megapixels',{exact:true}).waitFor();
+   await page.locator('input[type=file]').first().setInputFiles({name:'broken.woff2',mimeType:'font/woff2',buffer:Buffer.from('wOF2')});
+   await page.getByText('Font import failed',{exact:true}).waitFor();
+   assert.equal(uploads,0);assert.equal(latest().slidesByDevice.watchos[0].screenshot,'');
+   assert.equal(await page.getByRole('button',{name:'Export bundle',exact:true}).isEnabled(),true);await page.close();
+ });
+ await check('HTTP 200 with corrupt image bytes blocks export',async()=>{
+   const {page}=await open(fixture({slidesByDevice:{watchos:[slide('corrupt',{layout:'hero',screenshot:'/corrupt.png'})]}}));
+   await page.route('**/corrupt.png',route=>route.fulfill({contentType:'image/png',body:'not an image'}));
+   let downloads=0;page.on('download',()=>downloads++);
+   await page.getByRole('button',{name:'Export bundle',exact:true}).click();
+   await page.getByText('Export failed',{exact:true}).waitFor();
+   assert.equal(downloads,0);assert.equal(await page.locator('[inert]').count(),0);await page.close();
+ });
+ await check('failed saves can be retried without another edit; dirty edits warn before leaving',async()=>{
+   const {page}=await open();
+   await pause(800);
+   let failing=true,writes=0,latest;
+   await page.route('**/api/project',async route=>{
+     writes++;latest=route.request().postDataJSON();
+     await route.fulfill({status:failing?500:200,json:{ok:!failing,error:failing?'Disk temporarily unavailable':undefined}});
+   });
+   await page.getByRole('textbox',{name:'App name',exact:true}).fill('Unsaved work');
+   const dirty=()=>page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented});
+   assert.equal(await dirty(),true);
+   await page.getByRole('button',{name:'Retry save',exact:true}).waitFor();
+   assert.equal(await dirty(),true); failing=false;
+   await page.getByRole('button',{name:'Retry save',exact:true}).click();
+   await pause(900);assert.equal(writes,2);assert.equal(latest.appName,'Unsaved work');assert.equal(await dirty(),false);
+   await page.close();
+ });
+ await check('older in-flight save advances the revision for newer queued edits',async()=>{
+   const {page}=await open();await pause(800);
+   const headers=[];let count=0;
+   await page.route('**/api/project',async route=>{
+     const n=++count;headers.push(ro
```

---

### Incident Patch 2: `94724257` (2026-09-27)
**Commit Message**: Fix editor/export bugs found in bug bash; export 24-bit RGB PNGs

Export and generation:
- Encode exports as opaque 24-bit RGB PNGs (Google Play rejects alpha) in a
  worker pool with inline fallback; faster and ~3x smaller than before
- Export/thumbnails place out-of-bounds elements where the editor shows them
- SKILL.md migration emits projects the editor accepts (unique ids/locales,
  string screenshotSecondary, known decks) and sets appIcon when present
- Feature graphic gets an app icon picker; appIcon documented in SKILL.md
- Normalise feature-graphic deck layouts at load instead of via an effect
  that created an un-undoable history step

Editor:
- Clearing inline text no longer saves "\n"; canvas resyncs on blur
- Overlay text can be cleared in non-default locales (fallback as placeholder)
- Canvas text is plaintext-only so pasted rich text can't diverge from export
- dir="auto" for RTL copy; left-set captions align to start (doc corrected)
- "Reset all devices" resets decks only, keeping locales and project settings
- Overlay colour swatch shows the colour actually rendered

Adds 9 regression checks to scripts/bug-bash.cjs (22 total).

Co-Authored-By: Claude Opus 5.5 <nore

**File**: `scripts/bug-bash.cjs` (modified, +91/-2)
```diff
@@ -101,6 +101,7 @@ const fixture = (extra = {}) => ({schemaVersion:2,appName:'Bug bash',themeId:'cl
    for(const png of pngs) {
      const bytes=await png.async('nodebuffer'); const [,w,h]=png.name.match(/\/(\d+)x(\d+)\//);
      assert.equal(bytes.readUInt32BE(16),Number(w)); assert.equal(bytes.readUInt32BE(20),Number(h));
+     assert.equal(bytes[25],2,'stores need opaque 24-bit RGB PNGs, not RGBA');
    }
    await page.getByRole('button',{name:'Export bundle',exact:true}).waitFor();
    assert.equal(await page.locator('[inert]').count(),0); assert.equal(downloadCount,1); await page.close();
@@ -133,10 +134,10 @@ const fixture = (extra = {}) => ({schemaVersion:2,appName:'Bug bash',themeId:'cl
    await inspector.getByRole('combobox').nth(1).click();
    await page.getByRole('option',{name:'Custom color',exact:true}).click();
    await page.getByRole('textbox',{name:'Custom background hex color',exact:true}).fill('#FFFFFF');
-   const caption=page.locator('main [contenteditable=true]').first();
+   const caption=page.locator('main [contenteditable=plaintext-only]').first();
    assert.equal(await caption.evaluate(el=>getComputedStyle(el).color),'rgb(23, 23, 23)');
    assert.equal(await caption.evaluate(el=>getComputedStyle(el.parentElement.parentElement.parentElement).backgroundColor),'rgb(255, 255, 255)');
-   await page.locator('main [contenteditable=true]').nth(1).focus();
+   await page.locator('main [contenteditable=plaintext-only]').nth(1).focus();
    assert.match(await page.locator('main').innerText(),/Screen 2/);
    assert.equal(await page.locator('textarea').first().inputValue(),'banner two');
    await page.close();
@@ -199,6 +200,94 @@ const fixture = (extra = {}) => ({schemaVersion:2,appName:'Bug bash',themeId:'cl
    const roundTrip=await request.get(baseURL+'/api/project');assert.deepEqual((await roundTrip.json()).state,payload.state);
    await context.close();
  });
+ await check('out-of-bounds elements export where the editor shows them',async()=>{
+   const {page}=await open(fixture({connectedCanvas:false,slidesByDevice:{watchos:[slide('a',{textElements:[{id:'t1',text:{en:'WIDE'},transform:{x:300,y:10,width:300,height:80,zIndex:6}}]})]}}));
+   const editorX=await page.locator('main .rnd-editable').last().evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41);
+   const exportX=await page.locator('[aria-hidden] [contenteditable=false]').filter({hasText:'WIDE'}).last().evaluate(el=>parseFloat(el.closest('div[style*="z-index"]').style.left));
+   assert.equal(exportX,editorX); await page.close();
+ });
+ await check('clearing inline copy saves nothing and shows the fallback after blur',async()=>{
+   const {page,latest}=await open(fixture({locales:['en','de'],locale:'de',slidesByDevice:{watchos:[slide('a',{headline:{en:'English',de:'Deutsch'}})]}}));
+   const headline=page.locator('main [contenteditable=plaintext-only]').nth(1);
+   await headline.click(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('Backspace');
+   await page.locator('textarea').first().click(); await pause(900);
+   assert.equal(latest().slidesByDevice.watchos[0].headline.de,undefined);
+   assert.equal(await headline.textContent(),'English'); await page.close();
+ });
+ await check('overlay text can be cleared and retyped in a non-default locale',async()=>{
+   const {page,latest}=await open(fixture({locales:['en','de'],locale:'de',slidesByDevice:{watchos:[slide('a',{textElements:[{id:'t1',text:{en:'Hello'},transform:{x:10,y:10,width:300,height:80,zIndex:6}}]})]}}));
+   await page.locator('main [contenteditable=plaintext-only]').nth(2).focus();
+   const text=page.getByRole('textbox',{name:'Overlay text',exact:true});
+   assert.equal(await text.inputValue(),''); assert.equal(await text.getAttribute('placeholder'),'Hello');
+   await text.fill('Hallo'); await pause(900);
+   assert.deepEqual(latest().slidesByDevice.watchos[0].textElements[0].text,{en:'Hello',de:'Hallo'}); await page.close();
+ 
```

**File**: `skills/app-store-screenshots/SKILL.md` (modified, +33/-7)
```diff
@@ -203,8 +203,16 @@ function firstString(...values) {
   return values.find((value) => typeof value === "string") || "";
 }
 
-function migrateSlide(slide) {
-  if (!slide || typeof slide !== "object") return null;
+// The editor refuses to load a deck with empty or repeated screen ids.
+function uniqueId(value, used) {
+  let id = typeof value === "string" && value.trim() ? value : "";
+  while (!id || used.has(id)) id = `migrated-${Math.random().toString(36).slice(2, 10)}`;
+  used.add(id);
+  return id;
+}
+
+function migrateSlide(slide, used) {
+  if (!slide || typeof slide !== "object" || Array.isArray(slide)) return null;
   const transforms = {};
   const rawTransforms = slide.transforms && typeof slide.transforms === "object" ? slide.transforms : {};
   for (const [id, transform] of Object.entries(rawTransforms)) {
@@ -227,26 +235,43 @@ function migrateSlide(slide) {
 
   return {
     ...slide,
-    id: typeof slide.id === "string" ? slide.id : `migrated-${Math.random().toString(36).slice(2, 10)}`,
+    id: uniqueId(slide.id, used),
     layout: LAYOUTS.includes(slide.layout) ? slide.layout : "device-bottom",
     label: localized(slide.label),
     headline: localized(slide.headline || slide.title || slide.caption || slide.copy),
     screenshot: firstString(slide.screenshot, slide.image, slide.src, slide.path),
+    screenshotSecondary: typeof slide.screenshotSecondary === "string" ? slide.screenshotSecondary : undefined,
     ...(Object.keys(transforms).length ? { transforms } : { transforms: undefined }),
     ...(textElements && textElements.length ? { textElements } : { textElements: undefined }),
   };
 }
 
 state.schemaVersion = 2;
 state.connectedCanvas = hasExplicitConnectedCanvas ? existingState.connectedCanvas : false;
-state.locales = Array.isArray(state.locales) && state.locales.length ? state.locales : [DEFAULT_LOCALE];
+// Unique codes like "en", "pt-BR", "zh_Hans"; anything else makes the editor refuse the file.
+const LOCALE_CODE = /^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/;
+state.locales = Array.isArray(state.locales)
+  ? [...new Set(state.locales.filter((locale) => typeof locale === "string" && LOCALE_CODE.test(locale)))]
+  : [];
+if (!state.locales.length) state.locales = [DEFAULT_LOCALE];
 state.locale = state.locales.includes(state.locale) ? state.locale : state.locales[0];
 state.device = DEVICE_KEYS.includes(state.device) ? state.device : "iphone";
+if (state.orientation !== "portrait" && state.orientation !== "landscape") delete state.orientation;
+for (const key of ["appName", "themeId", "appIcon"]) {
+  if (state[key] !== undefined && typeof state[key] !== "string") delete state[key];
+}
+// The feature graphic only shows an icon that `appIcon` points at.
+if (!state.appIcon && fs.existsSync(path.join("public", "app-icon.png"))) state.appIcon = "/app-icon.png";
 
 if (state.slidesByDevice && typeof state.slidesByDevice === "object") {
   for (const [device, slides] of Object.entries(state.slidesByDevice)) {
-    if (!DEVICE_KEYS.includes(device)) continue;
-    state.slidesByDevice[device] = Array.isArray(slides) ? slides.map(migrateSlide).filter(Boolean) : [];
+    // The editor only accepts known device decks; the backup keeps the original.
+    if (!DEVICE_KEYS.includes(device)) {
+      delete state.slidesByDevice[device];
+      continue;
+    }
+    const used = new Set();
+    state.slidesByDevice[device] = Array.isArray(slides) ? slides.map((slide) => migrateSlide(slide, used)).filter(Boolean) : [];
   }
 }
 
@@ -405,6 +430,7 @@ The starter project state lives in `app-store-screenshots.json`, not `src/lib/de
 If the user provided headlines, edit `app-store-screenshots.json` to set:
 - `appName`
 - `themeId` (one of `"clean-light" | "dark-bold" | "warm-editorial" | "ocean-fresh" | "bloom-roast"`, a named style slug such as `"swiss-grid-bold"` when the user picked that style, or add a matching entry to `THEMES` in `src/lib/constants.ts`). Themes may set `accentAlt` for the label color 
```

**File**: `skills/app-store-screenshots/template/README.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ The toolbar dropdown lists every Apple/Google-required size for the current devi
 
 Exports lock the editor through preparation and bundling and render a fixed project snapshot. Referenced images that cannot be loaded stop the export with an error; empty screenshot fields still produce the existing placeholder warning.
 
-Each screen is rendered once per locale at canvas resolution (`src/lib/export-render.ts`) and scaled to every size; slots whose aspect differs slightly are cover-scaled rather than stretched. Before saving, the exporter redraws until every visible screenshot has painted, because WebKit decodes images inside the html-to-image SVG asynchronously and a single draw can leave device screens blank. If a screenshot never appears, a toast names the screen.
+Each screen is rendered once per locale at canvas resolution (`src/lib/export-render.ts`) and scaled to every size; slots whose aspect differs slightly are cover-scaled rather than stretched. Before saving, the exporter redraws until every visible screenshot has painted, because WebKit decodes images inside the html-to-image SVG asynchronously and a single draw can leave device screens blank. If a screenshot never appears, a toast names the screen. Files are written as opaque 24-bit RGB PNGs (`src/lib/png-rgb.ts`, encoded in a small worker pool) because Google Play rejects PNGs with an alpha channel and canvas can only produce RGBA.
 
 CarPlay has no App Store Connect slot of its own: the CarPlay deck is a head-unit frame on a landscape iPhone canvas and exports landscape iPhone sizes for upload into the iPhone slot.
 
```

**File**: `skills/app-store-screenshots/template/src/components/editor/inspector.tsx` (modified, +28/-12)
```diff
@@ -49,6 +49,7 @@ import {
   toTextElementId,
 } from "@/lib/elements";
 import { pickText, writeLocalized } from "@/lib/locale";
+import { slideColors } from "@/lib/contrast";
 import { cn } from "@/lib/utils";
 import {
   cleanTypography,
@@ -82,6 +83,8 @@ type Props = {
   orientation: Orientation;
   theme: Theme;
   locale: string;
+  appIcon?: string;
+  onAppIconChange: (src: string) => void;
   selectedElementId: ElementId | null;
   onChange: (patch: Partial<Slide>) => void;
   /** Patch computed from the slide's latest state (safe after async work). */
@@ -101,6 +104,8 @@ export function Inspector({
   orientation,
   theme,
   locale,
+  appIcon,
+  onAppIconChange,
   selectedElementId,
   onChange,
   onUpdate,
@@ -126,12 +131,6 @@ export function Inspector({
     onChange({ [key]: writeLocalized(slide[key], locale, value) } as Partial<Slide>);
   }
 
-  React.useEffect(() => {
-    if (device === "feature-graphic" && slide.layout !== "feature-graphic") {
-      onChange({ layout: "feature-graphic", transforms: undefined, screenshotSecondary: undefined });
-    }
-  }, [device, onChange, slide.layout]);
-
   return (
     <div className="flex h-full flex-col">
       <div className="border-b p-3">
@@ -232,6 +231,7 @@ export function Inspector({
         {!isFeatureGraphic && (
           <ElementTransformControls
             slide={slide}
+            defaultTextColor={slideColors(theme, slide).fg}
             device={device}
             orientation={orientation}
             locale={locale}
@@ -243,9 +243,13 @@ export function Inspector({
         )}
 
         {isFeatureGraphic && (
-          <p className="rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
-            Shows app icon + name + tagline. Drop an icon at <span className="rounded bg-background px-1 py-0.5 font-mono text-[10px] text-foreground">/public/app-icon.png</span> (or leave blank — the app initial will be used). Name is set in the toolbar.
-          </p>
+          <div className="space-y-1.5">
+            <Label className="text-xs">App icon</Label>
+            <ScreenshotPicker label="Icon (shared by every banner)" value={appIcon || ""} onChange={onAppIconChange} />
+            <p className="text-[11px] leading-relaxed text-muted-foreground">
+              Shows app icon + name + tagline. Leave the icon blank to use the app&apos;s initial. Name is set in the toolbar.
+            </p>
+          </div>
         )}
       </div>
     </div>
@@ -293,6 +297,7 @@ function CopyIdeasMenu({ onPick }: { onPick: (formula: string) => void }) {
 
 function ElementTransformControls({
   slide,
+  defaultTextColor,
   device,
   orientation,
   locale,
@@ -302,6 +307,7 @@ function ElementTransformControls({
   onSelectElement,
 }: {
   slide: Slide;
+  defaultTextColor: string;
   device: Device;
   orientation: Orientation;
   locale: string;
@@ -554,6 +560,7 @@ function ElementTransformControls({
           imageElement={activeImageElement || undefined}
           locale={locale}
           canvas={{ cW, cH }}
+          defaultTextColor={defaultTextColor}
           onRotate={(rotation) => patchElement(activeId, { rotation })}
           onReorder={(dir) => reorder(activeId, dir)}
           onTextChange={(value) => {
@@ -591,6 +598,7 @@ function ActiveElementPanel({
   imageElement,
   locale,
   canvas,
+  defaultTextColor,
   onRotate,
   onReorder,
   onTextChange,
@@ -606,6 +614,7 @@ function ActiveElementPanel({
   imageElement?: ImageElement;
   locale: string;
   canvas: { cW: number; cH: number };
+  defaultTextColor: string;
   onRotate: (rotation: number) => void;
   onReorder: (dir: "front" | "back" | "up" | "down") => void;
   onTextChange: (value: string) => void;
@@ -649,6 +658,7 @@ function ActiveElementPanel({
           element={textElement}
           locale={locale}
           canvas={canvas}
+          defaultColor={defaultTextColor}
           onTextChange={onTextChange}
           onT
```

**File**: `skills/app-store-screenshots/template/src/components/editor/screenshot-editor.tsx` (modified, +34/-14)
```diff
@@ -495,7 +495,10 @@ export function ScreenshotEditor() {
 
     // Render each slide once per locale at canvas resolution, then scale that
     // one render to every export size. The sizes are all scalings of the same
-    // design, so re-rendering the DOM per size only added time.
+    // design, so re-rendering the DOM per size only added time. PNG encoding
+    // runs in workers, so a screen encodes while the next one renders; waiting
+    // for the previous screen first keeps at most one screen's pixels queued.
+    let encoding: Promise<void> = Promise.resolve();
     for (const locale of locales) {
       setExportLocaleOverride(locale);
       await waitForPaint();
@@ -508,30 +511,45 @@ export function ScreenshotEditor() {
         await waitForPaint();
         const el = exportRef.current;
         if (!el) {
+          await encoding;
           failed += sizes.length;
           errors.push(`${locale} screen ${i + 1}: render target missing`);
           continue;
         }
         const filename = `${String(i + 1).padStart(2, "0")}-${slide.layout}.png`;
-        let written = 0;
+        const label = `${locale} screen ${i + 1}`;
+        const fail = (e: unknown) => {
+          const msg = e instanceof Error ? e.message : String(e);
+          errors.push(`${label}: ${msg}`);
+          console.error("Export failed", { slideId: slide.id, locale }, e);
+        };
+        let pngs: Promise<Uint8Array[]>;
         try {
           const rendered = await captureSlide(el, cW, cH);
-          if (rendered.missingImages > 0) incomplete.push(`${locale} screen ${i + 1}`);
-          for (const size of sizes) {
-            const base64 = rendered.toPng(size.w, size.h).split(",")[1] || "";
-            const path = `${platform}/${state.device}/${size.w}x${size.h}/${locale}/${filename}`;
-            zip.file(path, base64, { base64: true });
-            written += 1;
-          }
+          if (rendered.missingImages > 0) incomplete.push(label);
+          pngs = Promise.all(sizes.map((size) => rendered.toPng(size.w, size.h)));
         } catch (e) {
-          const msg = e instanceof Error ? e.message : String(e);
-          errors.push(`${locale} screen ${i + 1}: ${msg}`);
-          console.error("Export failed", { slideId: slide.id, locale }, e);
+          fail(e);
+          await encoding;
+          failed += sizes.length;
+          continue;
         }
-        okCount += written;
-        failed += sizes.length - written;
+        await encoding;
+        encoding = pngs.then(
+          (files) => {
+            sizes.forEach((size, index) => {
+              zip.file(`${platform}/${state.device}/${size.w}x${size.h}/${locale}/${filename}`, files[index]);
+            });
+            okCount += sizes.length;
+          },
+          (e) => {
+            fail(e);
+            failed += sizes.length;
+          },
+        );
       }
     }
+    await encoding;
 
     setExporting("Bundling…");
 
@@ -722,6 +740,8 @@ export function ScreenshotEditor() {
               orientation={state.orientation}
               theme={theme}
               locale={state.locale}
+              appIcon={state.appIcon}
+              onAppIconChange={(appIcon) => setState((p) => ({ ...p, appIcon }))}
               selectedElementId={
                 selectedElement?.slideId === activeSlide.id ? selectedElement.elementId : null
               }
```

---

### Incident Patch 3: `7faf7fcd` (2026-09-27)
**Commit Message**: Fix editor state races and screenshot export reliability

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -50,6 +50,7 @@ Thumbs.db
 # Skill template user assets
 skills/app-store-screenshots/template/public/app-icon.png
 skills/app-store-screenshots/template/public/screenshots/**/*.png
+skills/app-store-screenshots/template/public/screenshots/uploaded/
 
 # Temporary files
 *.tmp
```

**File**: `CONTRIBUTING.md` (modified, +7/-1)
```diff
@@ -39,7 +39,13 @@ Usually not a fit:
 
 ## Testing Changes
 
-There is no traditional automated test suite in this repository, so use a manual smoke-test checklist.
+The editor regression harness is `scripts/bug-bash.cjs`. Run it against a **disposable copy** of the template with its dev server running. It uses Google Chrome, mocks project state for browser checks, and checks the real project API rejects malformed writes. It covers editor keyboard controls, history, delayed saves/uploads, export sizes/locales, missing assets, connected crops, and feature graphics.
+
+```bash
+PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/bug-bash.cjs http://localhost:3098
+```
+
+Use an existing Playwright installation or install it outside the repo for this harness. Also run `tsc --noEmit` and the production build in the template. Use the manual checklist below for skill/scaffolding changes.
 
 ### For README-only changes
 
```

**File**: `scripts/bug-bash.cjs` (added, +206/-0)
```diff
@@ -0,0 +1,206 @@
+// Run against a disposable copy: this exercises uploads and /api/project.
+// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/bug-bash.cjs http://localhost:3098
+const assert = require('node:assert/strict');
+const fs = require('node:fs/promises');
+const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
+const baseURL = process.argv[2] || 'http://localhost:3098';
+const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
+const slide = (id, extra = {}) => ({ id, layout: 'no-device', label: {en: 'LABEL'}, headline: {en: id}, screenshot: '', ...extra });
+const fixture = (extra = {}) => ({schemaVersion:2,appName:'Bug bash',themeId:'clean-light',connectedCanvas:true,locales:['en'],locale:'en',device:'watchos',orientation:'portrait',slidesByDevice:{watchos:[slide('first'),slide('second')],android:[slide('android')],iphone:[slide('iphone')]},...extra});
+(async () => {
+ const browser = await chromium.launch({channel:'chrome', headless:true});
+ const errors = [];
+ async function open(state=fixture(), save) {
+   const page = await browser.newPage({viewport:{width:1600,height:1000}});
+   let latest=structuredClone(state);
+   page.on('pageerror', error=>errors.push(error.message));
+   await page.route('**/api/project',async route=>{
+     if(route.request().method()==='POST') {
+       const data=route.request().postDataJSON();
+       if(save) await save(data);
+       latest=data;
+     }
+     await route.fulfill({json:{ok:true,state:latest}});
+   });
+   await page.goto(baseURL);
+   await page.getByRole('button',{name:'Export bundle',exact:true}).waitFor();
+   return {page, latest:()=>latest};
+ }
+ let passed=0;
+ async function check(name, run) {
+   if(process.env.BUG_BASH_FILTER && !name.includes(process.env.BUG_BASH_FILTER)) return;
+   await run(); passed++; console.log('PASS',name);
+ }
+ try {
+ await check('menu arrows do not navigate slides',async()=>{
+   const {page}=await open();
+   await page.getByRole('combobox',{name:'Theme',exact:true}).click();
+   await page.keyboard.press('ArrowDown');
+   assert.match(await page.locator('main').innerText(),/Screen 1/);
+   await page.keyboard.press('Escape'); await page.close();
+ });
+ await check('duplicate selects copy; undo and redo preserve edits',async()=>{
+   const {page}=await open();
+   await page.getByRole('button',{name:'Duplicate screen 1',exact:true}).click();
+   assert.match(await page.locator('main').innerText(),/Screen 2/);
+   await page.getByRole('button',{name:'Undo',exact:true}).click();
+   assert.equal(await page.getByRole('button',{name:/^Delete screen/}).count(),2);
+   await page.getByRole('button',{name:'Redo',exact:true}).click();
+   assert.equal(await page.getByRole('button',{name:/^Delete screen/}).count(),3);
+   await page.close();
+ });
+ await check('rapid edits on different decks have separate undo steps',async()=>{
+   const {page}=await open();
+   await page.locator('textarea').first().fill('watch changed');
+   await page.getByRole('tab',{name:'Android',exact:true}).click();
+   await page.locator('textarea').first().fill('android changed');
+   await page.getByRole('button',{name:'Undo',exact:true}).click();
+   assert.equal(await page.locator('textarea').first().inputValue(),'android');
+   await page.getByRole('button',{name:'Undo',exact:true}).click();
+   assert.equal(await page.locator('textarea').first().inputValue(),'first');
+   await page.close();
+ });
+ await check('editing does not reset a manually panned canvas',async()=>{
+   const {page}=await open();
+   const scroller=page.locator('main .overflow-auto');
+   await scroller.evaluate(el=>el.scrollTo({left:300,behavior:'instant'}));
+   const before=await scroller.evaluate(el=>el.scrollLeft);
+   assert.ok(before>0);
+   await page.locator('textarea').first().fill('edited while panned');
+   await pause(400);
+   assert.equal(await scroller.evaluate(el=>el.scrollLeft),before);
+   await page.close();
+ });
```

**File**: `skills/app-store-screenshots/SKILL.md` (modified, +1/-1)
```diff
@@ -706,7 +706,7 @@ project/
 ├── public/
 │   ├── mockup.png               # iPhone bezel (do NOT replace without re-measuring PHONE_SCREEN)
 │   ├── app-icon.png             # → user supplies
-│   ├── fonts/imported/          # Fonts imported from the toolbar (gitignored, like screenshots/uploaded/)
+│   ├── fonts/imported/          # Fonts imported from the toolbar (gitignored; uploaded screenshots are tracked in generated projects)
 │   └── screenshots/...
 └── src/
     ├── app/
```

**File**: `skills/app-store-screenshots/template/.gitignore` (modified, +2/-3)
```diff
@@ -6,9 +6,8 @@ out
 next-env.d.ts
 .env*.local
 
-# User-uploaded screenshots land here at runtime. They are the user's assets,
-# not template content, and must never be committed back into the template.
-public/screenshots/uploaded/
+# Uploaded screenshots belong to the generated project: commit them alongside
+# app-store-screenshots.json so decks remain reproducible after cloning.
 
 # Fonts imported from the editor toolbar are user assets too (and font licences
 # often forbid redistributing them), so keep them out of the template as well.
```

---

### Incident Patch 4: `bee50b7b` (2026-09-26)
**Commit Message**: fix: font menu offers only real fonts, undo skips navigation, tidy toolbar

Fonts
- "Classic Serif" rendered exactly like "Editorial Serif" (both Georgia):
  keep one "Georgia" entry and migrate saved classic-serif projects to it.
- "Import a font" was a selectable font before anything was imported and
  its @font-face stub in globals.css requested non-existent
  custom-screenshot-font.* files (404s). The stub is gone; the imported font
  is only listed once it exists (under its file name), and "Import font…"
  is an action at the bottom of the font menu instead of an extra toolbar
  button. Errors surface as toasts.
- The imported font's @font-face is registered in <head> rather than as a
  <style> inside every canvas, so html-to-image embeds it from
  document.styleSheets; a copy cloned into the export SVG pointed at a URL
  the SVG image can't load. Thumbnails and the feature graphic now use the
  selected font too.

Undo/redo
- Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z only defer to text fields and
  contenteditable text; sliders, colour pickers and buttons no longer block
  them, while arrow keys etc. still keep their meaning in any input.
- Switching platform, device, orientation or lo

**File**: `skills/app-store-screenshots/template/src/app/globals.css` (modified, +0/-10)
```diff
@@ -2,16 +2,6 @@
 @tailwind components;
 @tailwind utilities;
 
-@font-face {
-  font-family: "CustomScreenshotFont";
-  src:
-    url("/fonts/imported/custom-screenshot-font.woff2") format("woff2"),
-    url("/fonts/imported/custom-screenshot-font.woff") format("woff"),
-    url("/fonts/imported/custom-screenshot-font.ttf") format("truetype"),
-    url("/fonts/imported/custom-screenshot-font.otf") format("opentype");
-  font-display: swap;
-}
-
 @layer base {
   :root {
     --background: 240 14% 99%;
```

**File**: `skills/app-store-screenshots/template/src/components/editor/font-importer.tsx` (modified, +40/-40)
```diff
@@ -1,13 +1,14 @@
 "use client";
 import * as React from "react";
-import { Upload } from "lucide-react";
-import { Button } from "@/components/ui/button";
+import { toast } from "sonner";
+import { cleanFontName } from "@/lib/clean-imported-font";
 import type { ImportedFont } from "@/lib/types";
 
+export type FontImporterHandle = { open: () => void };
+
 type Props = {
-  disabled: boolean;
-  importedFont?: ImportedFont;
   onImported: (font: ImportedFont) => void;
+  onUploadingChange?: (uploading: boolean) => void;
 };
 
 const MAX_FONT_BYTES = 16 * 1024 * 1024;
@@ -22,57 +23,56 @@ async function fileToBase64(file: File): Promise<string> {
   return dataUrl.slice(dataUrl.indexOf(",") + 1);
 }
 
-export function FontImporter({ disabled, importedFont, onImported }: Props) {
+// Hidden file input behind the toolbar's "Import font…" menu item. The server
+// validates the file by its magic bytes and stores it under
+// public/fonts/imported/<hash>.<ext>.
+export const FontImporter = React.forwardRef<FontImporterHandle, Props>(function FontImporter(
+  { onImported, onUploadingChange },
+  ref,
+) {
   const inputRef = React.useRef<HTMLInputElement>(null);
-  const [uploading, setUploading] = React.useState(false);
-  const [error, setError] = React.useState<string | null>(null);
+  React.useImperativeHandle(ref, () => ({ open: () => inputRef.current?.click() }), []);
 
   async function importFont(file: File) {
-    setUploading(true);
-    setError(null);
+    onUploadingChange?.(true);
     try {
       if (file.size > MAX_FONT_BYTES) throw new Error("Font file is too large (16MB maximum).");
       const response = await fetch("/api/upload-font", {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify({ data: await fileToBase64(file) }),
       });
-      const data = (await response.json()) as { ok: boolean; error?: string; font?: ImportedFont };
+      const data = (await response.json().catch(() => ({ ok: false }))) as {
+        ok: boolean;
+        error?: string;
+        font?: ImportedFont;
+      };
       if (!data.ok || !data.font) throw new Error(data.error || "Could not import that font.");
-      onImported(data.font);
+      const name = cleanFontName(file.name.replace(/\.[^.]+$/, ""));
+      onImported({ ...data.font, ...(name ? { name } : {}) });
+      toast.success(`Imported ${name ?? "font"}`);
     } catch (caught) {
-      setError(caught instanceof Error ? caught.message : "Could not import that font.");
+      toast.error("Font import failed", {
+        description: caught instanceof Error ? caught.message : "Could not import that font.",
+      });
     } finally {
-      setUploading(false);
+      onUploadingChange?.(false);
     }
   }
 
   return (
-    <span className="flex items-center gap-1.5">
-      <input
-        ref={inputRef}
-        type="file"
-        accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
-        className="sr-only"
-        onChange={(event) => {
-          const file = event.target.files?.[0];
-          if (file) void importFont(file);
-          event.target.value = "";
-        }}
-      />
-      <Button
-        type="button"
-        variant="ghost"
-        size="sm"
-        className="h-8 gap-1 px-2 text-xs"
-        disabled={disabled || uploading}
-        onClick={() => inputRef.current?.click()}
-        title="Import a WOFF2, WOFF, TTF, or OTF font"
-      >
-        <Upload className="h-3.5 w-3.5" />
-        {uploading ? "Importing" : importedFont ? "Replace font" : "Import font"}
-      </Button>
-      {error && <span className="max-w-32 truncate text-[10px] text-destructive" title={error}>{error}</span>}
-    </span>
+    <input
+      ref={inputRef}
+      type="file"
+      accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
+      className="sr-only"
+      tabIndex={-1}
+      aria-hidden
+      onChange={(event) => {
+        const file = eve
```

**File**: `skills/app-store-screenshots/template/src/components/editor/preview-stage.tsx` (modified, +0/-3)
```diff
@@ -24,7 +24,6 @@ type Props = {
   appName?: string;
   appIcon?: string;
   fontFamily: string;
-  fontFaceCss?: string;
   connectedCanvas: boolean;
   selectedElement: SelectedElement | null;
   onActiveSlideChange: (id: string) => void;
@@ -47,7 +46,6 @@ export function PreviewStage({
   appName,
   appIcon,
   fontFamily,
-  fontFaceCss,
   connectedCanvas,
   selectedElement,
   onActiveSlideChange,
@@ -143,7 +141,6 @@ export function PreviewStage({
               appName={appName}
               appIcon={appIcon}
               fontFamily={fontFamily}
-              fontFaceCss={fontFaceCss}
               connectedCanvas={connectedCanvas}
               editable
               previewScale={scale}
```

**File**: `skills/app-store-screenshots/template/src/components/editor/screenshot-editor.tsx` (modified, +50/-30)
```diff
@@ -6,6 +6,7 @@ import {
   DEFAULT_SCREENSHOT_FONT_ID,
   getExportSizes,
   hasTheme,
+  IMPORTED_FONT_FAMILY,
   SCREENSHOT_FONTS,
   supportsLandscape,
   themeById,
@@ -22,6 +23,7 @@ import type {
   ElementId,
   ElementTransform,
   ImageElement,
+  ImportedFont,
   SelectedElement,
   Slide,
 } from "@/lib/types";
@@ -45,12 +47,9 @@ export function ScreenshotEditor() {
   const activeSlide =
     currentSlides.find((s) => s.id === activeSlideId) || currentSlides[0] || null;
   const theme = themeById(state.themeId);
-  const fontFamily = state.fontId === "self-hosted" && state.importedFont
-    ? '"ImportedScreenshotFont", Georgia, serif'
-    : SCREENSHOT_FONTS[state.fontId || DEFAULT_SCREENSHOT_FONT_ID].family;
-  const fontFaceCss = state.importedFont
-    ? `@font-face { font-family: "ImportedScreenshotFont"; src: url("${state.importedFont.src}") format("${state.importedFont.format}"); font-display: swap; }`
-    : undefined;
+  const fontId = state.fontId || DEFAULT_SCREENSHOT_FONT_ID;
+  const fontFamily = SCREENSHOT_FONTS[fontId].family;
+  useImportedFontFace(state.importedFont);
 
   React.useEffect(() => {
     if (selectedElement && selectedElement.slideId !== activeSlide?.id) {
@@ -67,7 +66,7 @@ export function ScreenshotEditor() {
 
   React.useEffect(() => {
     if (!supportsLandscape(state.device) && state.orientation !== "portrait") {
-      setState((p) => ({ ...p, orientation: "portrait" }));
+      setState((p) => ({ ...p, orientation: "portrait" }), { history: false });
     }
   }, [state.device, state.orientation, setState]);
 
@@ -338,11 +337,9 @@ export function ScreenshotEditor() {
   React.useEffect(() => {
     function onKey(e: KeyboardEvent) {
       const target = e.target as HTMLElement | null;
-      const inEditable =
-        target &&
-        (target.tagName === "INPUT" ||
-          target.tagName === "TEXTAREA" ||
-          (target as HTMLElement).isContentEditable);
+      const inTextField = isTextEditable(target);
+      const inControl =
+        inTextField || (!!target && (target.tagName === "INPUT" || target.tagName === "SELECT"));
       if (exporting) return;
 
       if (e.key === "Escape") {
@@ -351,21 +348,19 @@ export function ScreenshotEditor() {
         return;
       }
 
-      // Let focused inputs and contenteditable text keep their native undo,
-      // redo, selection, and deletion behavior.
-      if (inEditable) return;
-
-      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
+      // Undo/redo belongs to the text field while one is focused.
+      const mod = e.metaKey || e.ctrlKey;
+      if (mod && !e.altKey && (e.key === "z" || e.key === "Z" || e.key === "y" || e.key === "Y")) {
+        if (inTextField) return;
         e.preventDefault();
-        if (e.shiftKey) redo();
+        if (e.key === "y" || e.key === "Y" || e.shiftKey) redo();
         else undo();
         return;
       }
-      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
-        e.preventDefault();
-        redo();
-        return;
-      }
+
+      // Arrow keys, deletion etc. keep their native meaning inside any input.
+      if (inControl) return;
+
       if (!currentSlides.length) return;
       const idx = activeSlide ? currentSlides.findIndex((s) => s.id === activeSlide.id) : -1;
       if (e.key === "ArrowDown" || (e.key === "j" && !e.metaKey && !e.ctrlKey)) {
@@ -450,7 +445,7 @@ export function ScreenshotEditor() {
       try {
         // fonts.ready only covers faces already requested; explicitly load an
         // imported font so a not-yet-used face can't export as the fallback.
-        if (state.fontId === "self-hosted") await document.fonts.load(`64px ${fontFamily}`);
+        if (fontId === "self-hosted") await document.fonts.load(`64px ${fontFamily}`);
         await document.fonts.ready;
       } catch {
         /* ignore */
@@ -604,17 +599,17 @@ export function ScreenshotEditor() {
         setThemeId={(v) => setState((p
```

**File**: `skills/app-store-screenshots/template/src/components/editor/sidebar.tsx` (modified, +3/-0)
```diff
@@ -30,6 +30,7 @@ type Props = {
   locale: string;
   appName?: string;
   appIcon?: string;
+  fontFamily?: string;
   connectedCanvas: boolean;
   disabled?: boolean;
   onReorder: (next: Slide[]) => void;
@@ -48,6 +49,7 @@ export function Sidebar({
   locale,
   appName,
   appIcon,
+  fontFamily,
   connectedCanvas,
   disabled,
   onReorder,
@@ -96,6 +98,7 @@ export function Sidebar({
                   locale={locale}
                   appName={appName}
                   appIcon={appIcon}
+                  fontFamily={fontFamily}
                   connectedCanvas={connectedCanvas}
                   onSelect={() => onSelect(slide.id)}
                   onDelete={() => onDelete(slide.id)}
```

---

### Incident Patch 5: `b8f1ff10` (2026-09-26)
**Commit Message**: fix: image overlay uploads no longer revert moves; size frame to the image

Image overlay patches were built from the slide captured when the upload
started, so dragging an overlay while its file uploaded was silently undone
when the upload finished. Inspector image edits now go through a functional
onUpdate that patches the latest slide.

The first image picked for an overlay reshapes its frame to the image's
aspect ratio (centred, capped at 60% of the canvas height) so "Fill frame"
no longer crops a wide logo into a square. The Elements card header puts
the Text/Image buttons on their own row and the image panel is flatter.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `skills/app-store-screenshots/template/src/components/editor/inspector.tsx` (modified, +138/-74)
```diff
@@ -38,6 +38,7 @@ import { Textarea } from "@/components/ui/textarea";
 import { LAYOUT_HINT, LAYOUT_LABEL } from "@/lib/constants";
 import { COPY_IDEA_SLOTS } from "@/lib/copy-ideas";
 import { nid } from "@/lib/defaults";
+import { img } from "@/lib/image-cache";
 import {
   isBuiltInElementId,
   imageElementKey,
@@ -83,6 +84,8 @@ type Props = {
   locale: string;
   selectedElementId: ElementId | null;
   onChange: (patch: Partial<Slide>) => void;
+  /** Patch computed from the slide's latest state (safe after async work). */
+  onUpdate: (update: (slide: Slide) => Partial<Slide>) => void;
   onSelectElement: (id: ElementId | null) => void;
 };
 
@@ -100,6 +103,7 @@ export function Inspector({
   locale,
   selectedElementId,
   onChange,
+  onUpdate,
   onSelectElement,
 }: Props) {
   const isFeatureGraphic = device === "feature-graphic" || slide.layout === "feature-graphic";
@@ -233,6 +237,7 @@ export function Inspector({
             locale={locale}
             selectedElementId={selectedElementId}
             onChange={onChange}
+            onUpdate={onUpdate}
             onSelectElement={onSelectElement}
           />
         )}
@@ -293,6 +298,7 @@ function ElementTransformControls({
   locale,
   selectedElementId,
   onChange,
+  onUpdate,
   onSelectElement,
 }: {
   slide: Slide;
@@ -301,6 +307,7 @@ function ElementTransformControls({
   locale: string;
   selectedElementId: ElementId | null;
   onChange: (patch: Partial<Slide>) => void;
+  onUpdate: (update: (slide: Slide) => Partial<Slide>) => void;
   onSelectElement: (id: ElementId | null) => void;
 }) {
   const present: ElementId[] = ["caption"];
@@ -345,13 +352,13 @@ function ElementTransformControls({
     }
     if (isImageElementId(id)) {
       const imageId = imageElementKey(id);
-      onChange({
-        imageElements: (slide.imageElements || []).map((element) =>
+      onUpdate((latest) => ({
+        imageElements: (latest.imageElements || []).map((element) =>
           element.id === imageId
             ? { ...element, transform: { ...element.transform, ...patch } }
             : element,
         ),
-      });
+      }));
       return;
     }
     if (!isBuiltInElementId(id)) return;
@@ -380,17 +387,36 @@ function ElementTransformControls({
     onSelectElement(null);
   }
 
+  // Functional updates: an image upload can finish after the user has moved or
+  // resized the overlay, and a patch built from the render-time slide would
+  // silently revert that move.
   function patchImageElement(id: string, patch: Partial<ImageElement>) {
-    onChange({
-      imageElements: (slide.imageElements || []).map((element) =>
+    onUpdate((latest) => ({
+      imageElements: (latest.imageElements || []).map((element) =>
         element.id === id ? { ...element, ...patch } : element,
       ),
-    });
+    }));
+  }
+
+  // The first image picked for an overlay reshapes its frame to the image's
+  // aspect ratio (centred on the old frame), so "Fill frame" doesn't crop a
+  // wide logo into a square. Replacing an image keeps the frame as placed.
+  async function setImageSource(id: string, src: string) {
+    const size = src ? await naturalSize(img(src)) : null;
+    onUpdate((latest) => ({
+      imageElements: (latest.imageElements || []).map((element) => {
+        if (element.id !== id) return element;
+        if (!size || element.src) return { ...element, src };
+        return { ...element, src, transform: fitToAspect(element.transform, size.w / size.h, cH * 0.6) };
+      }),
+    }));
   }
 
   function deleteImageElement(element: ImageElement) {
-    const nextImageElements = (slide.imageElements || []).filter((item) => item.id !== element.id);
-    onChange({ imageElements: nextImageElements.length > 0 ? nextImageElements : undefined });
+    onUpdate((latest) => {
+      const nextImageElements = (latest.imageElements || []).filter((item) => item.id !== element.id);
+      return { imageElements: nextImageElements.length > 0 ? 
```

**File**: `skills/app-store-screenshots/template/src/components/editor/screenshot-editor.tsx` (modified, +16/-0)
```diff
@@ -138,6 +138,21 @@ export function ScreenshotEditor() {
     [setState],
   );
 
+  const updateSlide = React.useCallback(
+    (id: string, update: (slide: Slide) => Partial<Slide>) => {
+      setState((prev) => ({
+        ...prev,
+        slidesByDevice: {
+          ...prev.slidesByDevice,
+          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((s) =>
+            s.id === id ? { ...s, ...update(s) } : s,
+          ),
+        },
+      }));
+    },
+    [setState],
+  );
+
   const reorderSlides = React.useCallback(
     (next: Slide[]) => {
       setState((prev) => ({
@@ -684,6 +699,7 @@ export function ScreenshotEditor() {
                 selectedElement?.slideId === activeSlide.id ? selectedElement.elementId : null
               }
               onChange={(patch) => patchSlide(activeSlide.id, patch)}
+              onUpdate={(update) => updateSlide(activeSlide.id, update)}
               onSelectElement={(elementId) =>
                 setSelectedElement(
                   elementId ? { slideId: activeSlide.id, elementId } : null,
```

---

### Incident Patch 6: `87712d59` (2026-09-26)
**Commit Message**: fix: keep caption text readable on custom slide backgrounds

A custom background kept the theme's text and label colours, so a dark
custom colour on a light theme (or vice versa) produced unreadable
captions. slideColors() keeps the theme colours when they reach 4.5:1
(text) / 3:1 (label) against the custom colour, otherwise falls back to the
theme's other text colour, then near-black or white. Text elements with an
explicit colour are untouched. The Background control notes this.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `skills/app-store-screenshots/template/src/components/editor/background-controls.tsx` (modified, +5/-0)
```diff
@@ -68,6 +68,11 @@ export function BackgroundControls({ slide, theme, onChange }: Props) {
           />
         </div>
       )}
+      {mode === "custom" && (
+        <p className="text-[11px] text-muted-foreground">
+          Caption text switches to a readable colour when the theme&apos;s colours would be too faint.
+        </p>
+      )}
     </div>
   );
 }
```

**File**: `skills/app-store-screenshots/template/src/components/editor/slide-canvas.tsx` (modified, +6/-5)
```diff
@@ -35,6 +35,7 @@ import {
 import { imageElementKey, isImageElementId, toImageElementId, toTextElementId } from "@/lib/elements";
 import { img } from "@/lib/image-cache";
 import { pickText, resolveScreenshot } from "@/lib/locale";
+import { slideColors } from "@/lib/contrast";
 import { defaultTextElementFontSize, slideFontScales } from "@/lib/typography";
 import {
   AndroidPhone,
@@ -262,8 +263,7 @@ function Caption({
   inverted?: boolean;
   onFocus?: () => void;
 }) {
-  const fg = inverted ? theme.fgAlt : theme.fg;
-  const accent = inverted ? theme.accentAlt ?? theme.accent : theme.accent;
+  const { fg, accent } = slideColors(theme, { inverted, backgroundColor: slide.backgroundColor });
   const { labelScale, headlineScale } = slideFontScales(slide);
   // Scale typography off the *shorter* dimension so landscape layouts don't
   // produce headlines so tall they overlap the device frame.
@@ -793,7 +793,7 @@ function SlideBackground({
         inset: 0,
         overflow: "hidden",
         background: backgroundFor(theme, inverted, slide.backgroundColor),
-        color: inverted ? theme.fgAlt : theme.fg,
+        color: slideColors(theme, slide).fg,
       }}
     >
       <Blob cW={cW} color={theme.accent} x={-15} y={-10} size={55} opacity={inverted ? 0.25 : 0.32} />
@@ -973,6 +973,7 @@ function SlideElements({
   const screenshotSecondary = resolveScreenshot(slide.screenshotSecondary, locale);
   const { cW, cH, Frame, frameAspect, defaults } = getSlideGeometry(slide, device, orientation);
   const inverted = !!slide.inverted;
+  const colors = slideColors(theme, slide);
   const captionRect = rectFor("caption", slide, defaults);
   const deviceRect = rectFor("device", slide, defaults);
   const secondaryRect = rectFor("deviceSecondary", slide, defaults);
@@ -1076,7 +1077,7 @@ function SlideElements({
     const rect = textElement.transform;
     const rotation = rect.rotation ?? 0;
     const zIndex = rect.zIndex ?? 5 + index;
-    const textColor = textElement.color || (inverted ? theme.fgAlt : theme.fg);
+    const textColor = textElement.color || colors.fg;
     return (
       <Movable
         key={textElement.id}
@@ -1130,7 +1131,7 @@ function SlideElements({
               fontWeight: textElement.fontWeight ?? 700,
               lineHeight: 1.05,
               textAlign: textElement.align ?? "center",
-              textShadow: inverted ? "0 2px 18px rgba(0,0,0,0.22)" : "0 2px 18px rgba(255,255,255,0.2)",
+              textShadow: colors.dark ? "0 2px 18px rgba(0,0,0,0.22)" : "0 2px 18px rgba(255,255,255,0.2)",
             }}
           />
         </div>
```

**File**: `skills/app-store-screenshots/template/src/lib/contrast.ts` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import type { Slide, Theme } from "./types";
+
+// WCAG 2 contrast helpers used to keep caption text readable when a slide
+// uses a custom background colour instead of one of its theme's backgrounds.
+
+const DARK_TEXT = "#0B0B0F";
+const LIGHT_TEXT = "#FFFFFF";
+// Headlines are large, bold display text, but labels are small; aim for the
+// body-text ratio so both stay legible after App Store downscaling.
+const TEXT_CONTRAST = 4.5;
+// The accent label may be a little softer before we swap it for the text colour.
+const ACCENT_CONTRAST = 3;
+
+function parseHex(hex: string): [number, number, number] | null {
+  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
+  if (!m) return null;
+  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
+  const n = parseInt(h, 16);
+  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
+}
+
+export function relativeLuminance(hex: string): number | null {
+  const rgb = parseHex(hex);
+  if (!rgb) return null;
+  const [r, g, b] = rgb.map((v) => {
+    const c = v / 255;
+    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
+  });
+  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
+}
+
+export function contrastRatio(a: string, b: string): number {
+  const la = relativeLuminance(a);
+  const lb = relativeLuminance(b);
+  if (la === null || lb === null) return 21;
+  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
+  return (hi + 0.05) / (lo + 0.05);
+}
+
+function firstReadable(bg: string, candidates: (string | undefined)[], min: number) {
+  return candidates.find((c): c is string => !!c && contrastRatio(c, bg) >= min);
+}
+
+export type SlideColors = {
+  /** Headline and default text-element colour. */
+  fg: string;
+  /** Uppercase label colour. */
+  accent: string;
+  /** True when the slide background is dark (drives subtle text shadows). */
+  dark: boolean;
+};
+
+/**
+ * Text colours for a slide. Theme backgrounds use the theme's own colours.
+ * A custom background keeps the theme colours when they're readable on it and
+ * otherwise switches to the theme's other text colour, then to near-black or
+ * white, whichever contrasts more. Colours a user picked explicitly on a text
+ * element are never passed through here.
+ */
+export function slideColors(theme: Theme, slide: Pick<Slide, "inverted" | "backgroundColor">): SlideColors {
+  const inverted = !!slide.inverted;
+  const themeFg = inverted ? theme.fgAlt : theme.fg;
+  const themeAccent = inverted ? theme.accentAlt ?? theme.accent : theme.accent;
+  const bg = slide.backgroundColor;
+  if (!bg || relativeLuminance(bg) === null) {
+    return { fg: themeFg, accent: themeAccent, dark: inverted };
+  }
+  const dark = (relativeLuminance(bg) ?? 1) < 0.18;
+  const fallback = contrastRatio(DARK_TEXT, bg) >= contrastRatio(LIGHT_TEXT, bg) ? DARK_TEXT : LIGHT_TEXT;
+  const fg = firstReadable(bg, [themeFg, inverted ? theme.fg : theme.fgAlt], TEXT_CONTRAST) ?? fallback;
+  const accent =
+    firstReadable(bg, [themeAccent, inverted ? theme.accent : theme.accentAlt], ACCENT_CONTRAST) ?? fg;
+  return { fg, accent, dark };
+}
```

---

### Incident Patch 7: `24ffb4cd` (2026-09-26)
**Commit Message**: fix: verify image overlays in exports without false "missing" warnings

The exporter decides an image painted when its inner 60% differs from a
blanked baseline. Overlay PNGs with a see-through middle (ring logos,
badges) never differ there, and the iPhone mockup's middle is always
covered by the screen layer, so any slide with an empty iPhone or such an
overlay burned the 8s timeout and warned about a missing screenshot.

Images whose own centre is transparent, and frames marked
data-export-check="full", are now checked over their full box; images with
no visible pixels are skipped. Overlays keep being embedded and verified
exactly like device screenshots.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `skills/app-store-screenshots/template/src/components/editor/device-frames.tsx` (modified, +3/-0)
```diff
@@ -16,9 +16,12 @@ export function Phone({ src, alt = "", style, hideEmpty }: FrameProps) {
   const resolved = img(src);
   return (
     <div style={{ position: "relative", aspectRatio: "1022 / 2082", ...style }}>
+      {/* The screen layer covers the bezel's centre, so the exporter checks the
+          whole mockup (its visible bezel) rather than its hidden middle. */}
       <img
         src={img("/mockup.png")}
         alt=""
+        data-export-check="full"
         style={{ display: "block", width: "100%", height: "100%" }}
         draggable={false}
       />
```

**File**: `skills/app-store-screenshots/template/src/lib/export-render.ts` (modified, +44/-4)
```diff
@@ -88,6 +88,32 @@ function fingerprint(source: HTMLCanvasElement, boxes: Box[], scratch: CanvasRen
   });
 }
 
+// Does the image have visible pixels in its inner 60% ("opaque-center"), only
+// nearer its edges ("edges-only"), or none at all ("empty")? Sampled from the
+// decoded image itself at fingerprint resolution.
+function alphaCoverage(
+  image: HTMLImageElement,
+  scratch: CanvasRenderingContext2D,
+): "opaque-center" | "edges-only" | "empty" {
+  const w = image.naturalWidth;
+  const h = image.naturalHeight;
+  if (!w || !h) return "opaque-center";
+  const hasAlpha = (sx: number, sy: number, sw: number, sh: number) => {
+    scratch.clearRect(0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE);
+    scratch.drawImage(image, sx, sy, sw, sh, 0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE);
+    const data = scratch.getImageData(0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE).data;
+    for (let i = 3; i < data.length; i += 4) if (data[i] > 8) return true;
+    return false;
+  };
+  try {
+    if (hasAlpha(w * 0.2, h * 0.2, w * 0.6, h * 0.6)) return "opaque-center";
+    return hasAlpha(0, 0, w, h) ? "edges-only" : "empty";
+  } catch {
+    // Unreadable (e.g. tainted) images keep the original inner-box check.
+    return "opaque-center";
+  }
+}
+
 export async function renderSlide(
   el: HTMLElement,
   width: number,
@@ -104,18 +130,33 @@ export async function renderSlide(
   );
   await Promise.all(visible.map((image) => image.decode().catch(() => undefined)));
 
+  const { ctx: scratch } = createContext(FINGERPRINT_SIZE, FINGERPRINT_SIZE, true);
+
   // Inner 60% of each visible image, in canvas pixels. The inset keeps bezels,
-  // rounded corners and overlapping frames out of the comparison.
+  // rounded corners and overlapping frames out of the comparison. An image
+  // whose own centre is see-through (the iPhone mockup around an empty screen,
+  // a ring-shaped logo overlay) would look "missing" there even when painted,
+  // so those are checked over their full box instead, as are frames marked
+  // data-export-check="full" whose middle is covered by the screen layer.
+  // Images with no visible pixels at all are skipped.
   const boxes: Box[] = visible
     .map((image) => {
+      const coverage = alphaCoverage(image, scratch);
+      if (coverage === "empty") return null;
+      const inset = coverage === "opaque-center" && image.dataset.exportCheck !== "full" ? 0.2 : 0;
       const r = image.getBoundingClientRect();
       const left = Math.max(r.left, root.left);
       const top = Math.max(r.top, root.top);
       const w = (Math.min(r.right, root.right) - left) * sx;
       const h = (Math.min(r.bottom, root.bottom) - top) * sy;
-      return { x: (left - root.left) * sx + w * 0.2, y: (top - root.top) * sy + h * 0.2, w: w * 0.6, h: h * 0.6 };
+      return {
+        x: (left - root.left) * sx + w * inset,
+        y: (top - root.top) * sy + h * inset,
+        w: w * (1 - inset * 2),
+        h: h * (1 - inset * 2),
+      };
     })
-    .filter((b) => b.w >= 2 && b.h >= 2);
+    .filter((b): b is Box => !!b && b.w >= 2 && b.h >= 2);
 
   const svg = await toSvg(el, {
     width,
@@ -126,7 +167,6 @@ export async function renderSlide(
   });
 
   const { canvas, ctx } = createContext(width, height);
-  const { ctx: scratch } = createContext(FINGERPRINT_SIZE, FINGERPRINT_SIZE, true);
   const draw = (image: HTMLImageElement) => {
     ctx.fillStyle = backgroundColor;
     ctx.fillRect(0, 0, width, height);
```

---

### Incident Patch 8: `a1f02061` (2026-09-26)
**Commit Message**: fix: default screenshot font to the template's Inter and preload imported fonts

The font menu defaulted to 'Modern Sans' (the system UI font), and every
project without a fontId was migrated to it, so existing decks silently
switched typeface from Inter, which the canvas inherited before. Add an
'Inter (default)' option that inherits the editor font and use it as the
default.

Also load the imported font face explicitly before exporting
(document.fonts.ready only waits on faces already requested), and
validate a stored fontId with hasOwnProperty so keys like 'constructor'
are not accepted.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `skills/app-store-screenshots/template/docs/screenshot-fonts.md` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@ Use the **Font** menu in the toolbar to change the typeface used on the screensh
 
 ## Included choices
 
+- **Inter (default)** keeps the editor's Inter font, which is what projects created before the font menu existed use.
 - **Editorial Serif** uses Georgia.
 - **Modern Sans** uses the device’s clean system sans-serif font.
 - **Classic Serif** uses Georgia.
@@ -16,7 +17,7 @@ Use the **Font** menu in the toolbar to change the typeface used on the screensh
 2. Choose a licensed WOFF2, WOFF, TTF, or OTF file. It is copied to `public/fonts/imported/` and used immediately in previews and exports.
 3. You can also add a WOFF2, WOFF, TTF, or OTF file manually as `public/fonts/imported/custom-screenshot-font.<extension>`, choose **Import a font**, and the editor uses it when no imported file has been selected.
 
-The selected font is saved in `app-store-screenshots.json` as `fontId`.
+The selected font is saved in `app-store-screenshots.json` as `fontId`; projects without one use Inter.
 
 ## Relevant code
 
```

**File**: `skills/app-store-screenshots/template/src/components/editor/screenshot-editor.tsx` (modified, +6/-2)
```diff
@@ -3,6 +3,7 @@ import * as React from "react";
 import JSZip from "jszip";
 import { Toaster, toast } from "sonner";
 import {
+  DEFAULT_SCREENSHOT_FONT_ID,
   getExportSizes,
   hasTheme,
   SCREENSHOT_FONTS,
@@ -46,7 +47,7 @@ export function ScreenshotEditor() {
   const theme = themeById(state.themeId);
   const fontFamily = state.fontId === "self-hosted" && state.importedFont
     ? '"ImportedScreenshotFont", Georgia, serif'
-    : SCREENSHOT_FONTS[state.fontId || "system-sans"].family;
+    : SCREENSHOT_FONTS[state.fontId || DEFAULT_SCREENSHOT_FONT_ID].family;
   const fontFaceCss = state.importedFont
     ? `@font-face { font-family: "ImportedScreenshotFont"; src: url("${state.importedFont.src}") format("${state.importedFont.format}"); font-display: swap; }`
     : undefined;
@@ -432,6 +433,9 @@ export function ScreenshotEditor() {
     // matches what's on screen.
     if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
       try {
+        // fonts.ready only covers faces already requested; explicitly load an
+        // imported font so a not-yet-used face can't export as the fallback.
+        if (state.fontId === "self-hosted") await document.fonts.load(`64px ${fontFamily}`);
         await document.fonts.ready;
       } catch {
         /* ignore */
@@ -585,7 +589,7 @@ export function ScreenshotEditor() {
         setThemeId={(v) => setState((p) => ({ ...p, themeId: v }))}
         connectedCanvas={state.connectedCanvas}
         setConnectedCanvas={(v) => setState((p) => ({ ...p, connectedCanvas: v }))}
-        fontId={state.fontId || "system-sans"}
+        fontId={state.fontId || DEFAULT_SCREENSHOT_FONT_ID}
         setFontId={(v) => setState((p) => ({ ...p, fontId: v }))}
         importedFont={state.importedFont}
         setImportedFont={(importedFont) => setState((p) => ({ ...p, fontId: "self-hosted", importedFont }))}
```

**File**: `skills/app-store-screenshots/template/src/lib/constants.ts` (modified, +7/-1)
```diff
@@ -160,9 +160,15 @@ export function macW(cW: number, cH: number, clamp = 0.86) {
 // ---------- Themes ----------
 export const DEFAULT_THEME_ID: ThemeId = "clean-light";
 
-export const DEFAULT_SCREENSHOT_FONT_ID: ScreenshotFontId = "system-sans";
+export const DEFAULT_SCREENSHOT_FONT_ID: ScreenshotFontId = "template-default";
 
 export const SCREENSHOT_FONTS: Record<ScreenshotFontId, { name: string; family: string }> = {
+  // Inherit the editor's Inter (next/font in app/layout.tsx), which is what the
+  // canvas rendered before fonts were selectable, so existing decks don't shift.
+  "template-default": {
+    name: "Inter (default)",
+    family: "inherit",
+  },
   "template-serif": {
     name: "Editorial Serif",
     family: "Georgia, 'Times New Roman', serif",
```

**File**: `skills/app-store-screenshots/template/src/lib/storage.ts` (modified, +4/-3)
```diff
@@ -121,9 +121,10 @@ function mergeWithDefaults(parsed: Partial<ProjectState>): ProjectState {
     typeof parsed.themeId === "string" && parsed.themeId.trim()
       ? parsed.themeId
       : DEFAULT_PROJECT.themeId;
-  const fontId = parsed.fontId && parsed.fontId in SCREENSHOT_FONTS
-    ? parsed.fontId
-    : DEFAULT_SCREENSHOT_FONT_ID;
+  const fontId =
+    typeof parsed.fontId === "string" && Object.prototype.hasOwnProperty.call(SCREENSHOT_FONTS, parsed.fontId)
+      ? parsed.fontId
+      : DEFAULT_SCREENSHOT_FONT_ID;
   const importedFont = cleanImportedFont(parsed.importedFont);
   const slidesByDevice = parsed.slidesByDevice
     ? Object.fromEntries(
```

**File**: `skills/app-store-screenshots/template/src/lib/types.ts` (modified, +1/-0)
```diff
@@ -124,6 +124,7 @@ export type ThemeId =
   | "vintage-travel-poster";
 
 export type ScreenshotFontId =
+  | "template-default"
   | "template-serif"
   | "system-sans"
   | "classic-serif"
```

---

### Incident Patch 9: `8446c848` (2026-09-26)
**Commit Message**: fix: keep partial hex input from clobbering a slide's custom background

Typing into the custom background hex field wrote every keystroke into
the slide, so an intermediate value like '#0B' rendered as a broken
gradient, and clearing the field set backgroundColor to '' which flipped
the slide out of custom mode and unmounted the input mid-edit. Keep the
text in a local draft and only commit complete #RRGGBB values.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `skills/app-store-screenshots/template/src/components/editor/background-controls.tsx` (modified, +15/-3)
```diff
@@ -1,4 +1,5 @@
 "use client";
+import * as React from "react";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import {
@@ -8,6 +9,7 @@ import {
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
+import { cleanHexColor } from "@/lib/clean-hex-color";
 import type { Slide, Theme } from "@/lib/types";
 
 type Props = {
@@ -18,7 +20,11 @@ type Props = {
 
 export function BackgroundControls({ slide, theme, onChange }: Props) {
   const mode = slide.backgroundColor ? "custom" : slide.inverted ? "alternate" : "theme";
-  const customColor = slide.backgroundColor || theme.bg;
+  const customColor = cleanHexColor(slide.backgroundColor) || cleanHexColor(theme.bg) || "#FFFFFF";
+  // Keep partial hex input local so typing "#0B" or clearing the field doesn't
+  // write an invalid color into the slide (or drop it out of custom mode).
+  const [draft, setDraft] = React.useState(customColor);
+  React.useEffect(() => setDraft(customColor), [customColor]);
 
   return (
     <div className="space-y-1.5">
@@ -48,8 +54,14 @@ export function BackgroundControls({ slide, theme, onChange }: Props) {
             aria-label="Custom background color"
           />
           <Input
-            value={customColor}
-            onChange={(event) => onChange({ backgroundColor: event.target.value.toUpperCase() })}
+            value={draft}
+            onChange={(event) => {
+              const next = event.target.value.toUpperCase();
+              setDraft(next);
+              const color = cleanHexColor(next);
+              if (color) onChange({ backgroundColor: color });
+            }}
+            onBlur={() => setDraft(customColor)}
             placeholder="#0B0908"
             className="h-8 font-mono text-xs uppercase"
             aria-label="Custom background hex color"
```

---

### Incident Patch 10: `cb5c1933` (2026-09-26)
**Commit Message**: fix: render image overlays through Movable and skip empty placeholders on export

Image overlays had their own react-rnd wrapper that diverged from the
shared Movable used by text elements: no rotate handle, no clamping to
the canvas/deck bounds, a stopPropagation on mousedown, and an Rnd
rendered even in the non-editable export path. It also exported the
dashed 'pick an image' placeholder into PNGs when an overlay had no
image yet.

Render overlay content inside Movable like text elements, and only show
the placeholder while editing.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `skills/app-store-screenshots/template/src/components/editor/image-element-canvas.tsx` (modified, +28/-69)
```diff
@@ -1,87 +1,46 @@
 "use client";
 import * as React from "react";
 import { ImagePlus } from "lucide-react";
-import { Rnd } from "react-rnd";
 import { createImageMask } from "@/components/editor/create-image-mask";
 import { img } from "@/lib/image-cache";
-import type { ElementTransform, ImageElement } from "@/lib/types";
+import type { ImageElement } from "@/lib/types";
 
 type Props = {
   element: ImageElement;
-  rect: ElementTransform;
   editable?: boolean;
-  previewScale: number;
-  selected: boolean;
-  allowOverflow: boolean;
-  onChange: (transform: ElementTransform) => void;
-  onSelect: () => void;
 };
 
-export function ImageElementCanvas({
-  element,
-  rect,
-  editable,
-  previewScale,
-  selected,
-  allowOverflow,
-  onChange,
-  onSelect,
-}: Props) {
-  const rotation = rect.rotation ?? 0;
-  const zIndex = rect.zIndex ?? 5;
+// Image overlay content. Placement, rotation, and drag/resize handles come from
+// the shared Movable wrapper in slide-canvas so overlays behave like text.
+export function ImageElementCanvas({ element, editable }: Props) {
   const source = img(element.src);
   const maskImage = createImageMask(element.fade);
 
+  if (!source) {
+    // The empty placeholder is an editing affordance only; never export it.
+    if (!editable) return null;
+    return (
+      <div className="flex h-full w-full items-center justify-center border border-dashed border-current/40 bg-black/10 text-current/70">
+        <ImagePlus className="h-6 w-6" aria-hidden />
+        <span className="sr-only">Pick an image in the inspector</span>
+      </div>
+    );
+  }
+
   return (
-    <Rnd
-      size={{ width: rect.width, height: rect.height }}
-      position={{ x: rect.x, y: rect.y }}
-      scale={previewScale}
-      bounds={allowOverflow ? undefined : "parent"}
-      disableDragging={!editable}
-      enableResizing={editable}
-      onMouseDown={(event) => {
-        event.stopPropagation();
-        onSelect();
+    // eslint-disable-next-line @next/next/no-img-element
+    <img
+      src={source}
+      alt=""
+      draggable={false}
+      style={{
+        width: "100%",
+        height: "100%",
+        display: "block",
+        objectFit: element.fit || "cover",
+        maskImage,
+        WebkitMaskImage: maskImage,
       }}
-      onDragStop={(_, position) => onChange({ ...rect, x: position.x, y: position.y, rotation, zIndex })}
-      onResizeStop={(_, __, ref, ___, position) =>
-        onChange({
-          ...rect,
-          x: position.x,
-          y: position.y,
-          width: Math.max(1, ref.offsetWidth),
-          height: Math.max(1, ref.offsetHeight),
-          rotation,
-          zIndex,
-        })
-      }
-      className={editable ? `rnd-editable${selected ? " rnd-selected" : ""}` : ""}
-      style={{ zIndex }}
-    >
-      <div style={{ width: "100%", height: "100%", transform: `rotate(${rotation}deg)` }}>
-        {source ? (
-          // eslint-disable-next-line @next/next/no-img-element
-          <img
-            src={source}
-            alt=""
-            draggable={false}
-            style={{
-              width: "100%",
-              height: "100%",
-              display: "block",
-              objectFit: element.fit || "cover",
-              maskImage,
-              WebkitMaskImage: maskImage,
-            }}
-          />
-        ) : (
-          <div className="flex h-full w-full items-center justify-center border border-dashed border-current/40 bg-black/10 text-current/70">
-            <ImagePlus className="h-6 w-6" aria-hidden />
-            <span className="sr-only">Pick an image in the inspector</span>
-          </div>
-        )}
-        </div>
-    </Rnd>
+    />
   );
 }
```

**File**: `skills/app-store-screenshots/template/src/components/editor/slide-canvas.tsx` (modified, +16/-7)
```diff
@@ -1144,22 +1144,31 @@ function SlideElements({
     const rotation = rect.rotation ?? 0;
     const zIndex = rect.zIndex ?? 5 + index;
     return (
-      <ImageElementCanvas
+      <Movable
         key={imageElement.id}
-        element={imageElement}
         rect={toGlobal(rect)}
+        boundsW={boundsW}
+        boundsH={boundsH}
         editable={editable}
         previewScale={previewScale}
-        selected={selectedElementId === elementId}
-        allowOverflow={allowCrossScreen}
-        onChange={(transform) =>
+        rotation={rotation}
+        onChange={(t) =>
           edit?.onElementChange?.(
             elementId,
-            toLocal({ ...transform, rotation: transform.rotation ?? rotation, zIndex: transform.zIndex ?? zIndex }),
+            toLocal({
+              ...t,
+              rotation: t.rotation ?? rotation,
+              zIndex: t.zIndex ?? zIndex,
+            }),
           )
         }
+        zIndex={zIndex}
+        selected={selectedElementId === elementId}
         onSelect={() => edit?.onSelectElement?.(elementId)}
-      />
+        allowOverflow={allowCrossScreen}
+      >
+        <ImageElementCanvas element={imageElement} editable={editable} />
+      </Movable>
     );
   }
 
```

#### Recent Merged Pull Requests:
- **PR #37** (2026-09-26): Add Mac App Store screenshot support (@h-elbeheiry)
- **PR #34** (2026-09-26): Add richer screenshot editor controls (@dqstartupbuild)
- **PR #33** (2026-09-26): Add Apple TV, Apple Watch and CarPlay devices, plus a post-export check (@intrepidsilence)
- **PR #32** (2026-09-26): fix: reject cross-site writes on the disk-writing API routes (@intrepidsilence)
- **PR #31** (2026-09-26): Move template to Next 16 (@intrepidsilence)
- **PR #28** (closed): feat: ship schema v3 screenshot editor (@ParthJadhav)
- **PR #26** (2026-09-26): Add per-slide typography scale controls (@dlg95)
- **PR #24** (2026-05-31): Codex/cross screen canvas (@ParthJadhav)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
