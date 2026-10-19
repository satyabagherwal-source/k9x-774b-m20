> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/parthjadhav-app-store-screenshots-learnings.md`  
> **Source**: github ([https://github.com/ParthJadhav/app-store-screenshots](https://github.com/ParthJadhav/app-store-screenshots))  
> **Source Version**: `5386f227`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T12:07:46.544Z  
> **Learning ID**: `learn-github-parthjadhav-app-store-screenshots`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): ParthJadhav/app-store-screenshots

> **Canonical Artifact**: `07_PROJECT_LEARNING/parthjadhav-app-store-screenshots-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ParthJadhav/app-store-screenshots](https://github.com/ParthJadhav/app-store-screenshots))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T12:07:46.537Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ParthJadhav/app-store-screenshots`
- **Description**: end to end app store screenshot creation using AI
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7443 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/app-store-screenshots/template/src/lib/export-render.ts`
```
"use client";
// Rasterises one export slide to PNG.
//
// WHY THIS IS NOT JUST `toPng(node)`
// ----------------------------------
// html-to-image serialises the node into an SVG <foreignObject>, loads that SVG
// as an image and draws it to a canvas exactly once. WebKit (Safari, and any
// WebKit-based browser) decodes the <img> data URLs *nested inside* an SVG
// image asynchronously, kicked off by the first paint. That single draw can
// therefore capture the headline, background and CSS device frame while every
// screenshot is still blank, with no error. Whether it wins the race depends on
// image size and machine load, so a different slide failed on each export and a
// 4K render could fail where 1080p passed. Chrome paints nested data URLs on the
// first draw, which is why the bug looked intermittent.
//
// THE FIX
// -------
// 1. Embed only the images inside the captured slide. A connected deck renders
//    every screen side by side; embedding all of them made each SVG N× larger.
// 2. Render a baseline with every image blanked, so we know what each image's
//    region looks like when the image is missing.
// 3. Draw the real SVG repeatedly until every visible image region differs from
//    that baseline and two consecutive draws are identical. Only then export.
//    If an image never shows up within the timeout, report it instead of
//    silently shipping a blank device.
import { toSvg } from "html-to-image";
import { encodeCanvasPng } from "./png-encode";

const SETTLE_POLL_MS = 50;
const SETTLE_TIMEOUT_MS = 8000;
const FINGERPRINT_SIZE = 12;
const BLANK_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const SVG_PREFIX = "data:image/svg+xml;charset=utf-8,";

type Box = { x: number; y: number; w: number; h: number };

export type RenderedSlide = {
  /** Draw the settled slide at the given export size as opaque 24-bit PNG bytes. */
  toPng: (w: number, h: number) => Promise<Uint8Array>;
  /** Visible images that never appeared in the render. 0 when all is well. */
  missingImages: number;
};

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      image.decode().then(
        () => resolve(image),
        () => resolve(image),
      );
    };
    image.onerror = () => reject(new Error("Couldn't load the rendered slide"));
    image.src = src;
  });
}

function intersects(a: DOMRect, b: DOMRect) {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}

// Same SVG with every <img> pointed at a transparent pixel: what each image
// region looks like when that image failed to paint.
function blankImages(svg: string) {
  if (!svg.startsWith(SVG_PREFIX)) return null;
  const markup = decodeURIComponent(svg.slice(SVG_PREFIX.length));
  const blanked = markup.replace(/(<img\b[^>]*?\bsrc=")[^"]*(")/g, `$1${BLANK_GIF}$2`);
  return SVG_PREFIX + encodeURIComponent(blanked);
}

function createContext(width: number, height: number, readBack = false) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", readBack ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return { canvas, ctx };
}

// Downsampled pixels of each box: cheap to compare, sensitive to "is it there".
function fingerprint(source: HTMLCanvasElement, boxes: Box[], scratch: CanvasRenderingContext2D) {
  return boxes.map((b) => {
    scratch.clearRect(0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE);
    scratch.drawImage(source, b.x, b.y, b.w, b.h, 0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE);
    return scratch.getImageData(0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE).data.join(",");
  });
}

// Does the image have visible pixels in its inner 60% ("opaque-center"), only
// nearer its edges ("edges-only"), or none at all ("empty")? Sampled from the
// decoded image itself at fingerprint resolution.
function alphaCoverage(
  image: HTMLImageElement,
  scratch: CanvasRenderingContext2D,
): "opaque-center" | "edges-only" | "empty" {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (!w || !h) return "opaque-center";
  const hasAlpha = (sx: number, sy: number, sw: number, sh: number) => {
    scratch.clearRect(0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE);
    scratch.drawImage(image, sx, sy, sw, sh, 0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE);
    const data = scratch.getImageData(0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 8) return true;
    return false;
  };
  try {
    if (hasAlpha(w * 0.2, h * 0.2, w * 0.6, h * 0.6)) return "opaque-center";
    return hasAlpha(0, 0, w, h) ? "edges-only" : "empty";
  } catch {
    // Unreadable (e.g. tainted) images keep the original inner-box check.
    return "opaque-center";
  }
}

export async function renderSlide(
  el: HTMLElement,
  width: number,
  height: number,
  backgroundColor = "#ffffff",
): Promise<RenderedSlide> {
  const root = el.getBoundingClientRect();
  const sx = width / (root.width || width);
  const sy = height / (root.height || height);
  const isVisible = (node: Element) => intersects(node.getBoundingClientRect(), root);

  const visible = Array.from(el.querySelectorAll("img")).filter(
    (image) => !!image.getAttribute("src") && isVisible(image),
  );
  await Promise.all(visible.map((image) => image.decode().catch(() => undefined)));

  const { ctx: scratch } = createContext(FINGERPRINT_SIZE, FINGERPRINT_SIZE, true);

  // Inner 60% of each visible image, in canvas pixels. The inset keeps bezels,
  // rounded corners and overlapping frames out of the comparison. An image
  // whose own centre is see-through (the iPhone mockup around an empty screen,
  // a ring-shaped logo overlay) would look "missing" there even when painted,
  // so those are checked over their full box instead, as are frames marked
  // data-export-check="full" whose middle is covered by the screen layer.
  // Images with no visible pixels at all are skipped.
  const boxes: Box[] = visible
    .map((image) => {
      const coverage = alphaCoverage(image, scratch);
      if (coverage === "empty") return null;
      const inset = coverage === "opaque-center" && image.dataset.exportCheck !== "full" ? 0.2 : 0;
      const r = image.getBoundingClientRect();
      const left = Math.max(r.left, root.left);
      const top = Math.max(r.top, root.top);
      const w = (Math.min(r.right, root.right) - left) * sx;
      const h = (Math.min(r.bottom, root.bottom) - top) * sy;
      return {
        x: (left - root.left) * sx + w * inset,
        y: (top - root.top) * sy + h * inset,
        w: w * (1 - inset * 2),
        h: h * (1 - inset * 2),
      };
    })
    .filter((b): b is Box => !!b && b.w >= 2 && b.h >= 2);

  const svg = await toSvg(el, {
    width,
    height,
    cacheBust: false,
    backgroundColor,
    filter: (node) => !(node instanceof HTMLImageElement) || isVisible(node),
  });

  const { canvas, ctx } = createContext(width, height);
  const draw = (image: HTMLImageElement) => {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
  };

  let missingImages = 0;
  const blankSvg = boxes.length > 0 ? blankImages(svg) : null;
  if (blankSvg) {
    draw(await loadImage(blankSvg));
    const baseline = fingerprint(canvas, boxes, scratch);
    const image = await loadImage(svg);
    let prev: string[] | null = null;
    let painted: boolean[] = boxes.map(() => false);
    const deadline = performance.now() + SETTLE_TIMEOUT_MS;
    for (;;) {
      draw(image);
      const cur = fingerprint(canvas, boxes, scratch);
      painted = cur.map((fp, i) => fp !== baseline[i]);
      const stable = prev !== null && cur.every((fp, i) => fp === prev![i]);
      if ((stable && painted.every(Boolean)) || performance.now() > deadline) break;
      prev = cur;
      await nextFrame();
      await sleep(SETTLE_POLL_MS);
    }
    missingImages = painted.filter((p) => !p).length;
  } else {
    draw(await loadImage(svg));
  }

  return {
    missingImages,
    toPng: (w, h) => {
      if (w === width && h === height) return encodeCanvasPng(canvas);
      const { canvas: out, ctx: octx } = createContext(w, h);
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
      // Cover, not stretch: some slots differ from the canvas aspect by a few
      // percent (Apple Watch 422×514 → 312×390), and stretching would squash
      // the device frame. Cover trims the same few pixels off the edges instead.
      const scale = Math.max(w / width, h / height);
      const dw = width * scale;
      const dh = height * scale;
      octx.drawImage(canvas, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return encodeCanvasPng(out);
    },
  };
}

```

### Core Architecture Module: `skills/app-store-screenshots/template/src/lib/png-worker.ts`
```
// Export encoding worker: RGBA pixels in, 24-bit RGB PNG bytes out.
import { encodeRgbPixels } from "./png-rgb";

type Job = { id: number; pixels: Uint8ClampedArray; width: number; height: number };

self.onmessage = async ({ data }: MessageEvent<Job>) => {
  try {
    const png = await encodeRgbPixels(data.pixels, data.width, data.height);
    self.postMessage({ id: data.id, png }, { transfer: [png.buffer] });
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};

```

### Core Architecture Module: `skills/app-store-screenshots/template/src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `skills/app-store-screenshots/template/e2e-army/chrome-provider.ts`
```
import { createServer } from "node:net";
import type { BrowserProvider } from "@e2e-dev/web";
import { type Browser, chromium } from "playwright";

// The published web engine has no channel option. Its supported provider
// contract lets us use installed Google Chrome without a Chromium fallback.
export function googleChrome(): BrowserProvider {
  const browsers = new Map<string, Browser>();
  return {
    name: "installed-google-chrome",
    async acquire(request) {
      const port = await new Promise<number>((resolve, reject) => {
        const server = createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          if (address == null || typeof address === "string") {
            server.close(() => reject(new Error("Cannot allocate Chrome CDP port")));
            return;
          }
          server.close(() => resolve(address.port));
        });
      });
      const browser = await chromium.launch({
        channel: "chrome",
        headless: request.env.SCREENSHOTS_E2E_HEADED !== "1",
        args: [`--remote-debugging-port=${port}`],
      });
      const id = `${request.runId}-${request.targetName}-${request.slot}`;
      try {
        request.signal.throwIfAborted();
        browsers.set(id, browser);
        request.log(`Google Chrome ${browser.version()} (channel: chrome)`);
        return { id, cdpEndpoint: `http://127.0.0.1:${port}` };
      } catch (error) {
        await browser.close();
        throw error;
      }
    },
    async release(lease) {
      const browser = browsers.get(lease.id);
      browsers.delete(lease.id);
      await browser?.close();
    },
  };
}

```

### Core Architecture Module: `skills/app-store-screenshots/template/e2e.config.ts`
```
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { googleChrome } from './e2e-army/chrome-provider';

export default {
  tests: 'tests/**/*.e2e.ts',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  assertionTimeout: 10_000,
  cache: 'off',
  reporters: ['list', 'junit', 'markdown'],
  trace: 'retain-on-failure',
  targets: [{
    name: 'google-chrome',
    engine: web({ browser: googleChrome(), viewport: { width: 1600, height: 1000 } }),
    app: {
      url: `http://localhost:${process.env.SCREENSHOTS_E2E_PORT ?? '4312'}`,
      command: { executable: process.execPath, args: ['e2e-army/server.cjs', '{port}'], startupTimeout: 120_000, log: '.e2e/logs/app.log', env: { SCREENSHOTS_E2E_PRODUCTION: process.env.SCREENSHOTS_E2E_PRODUCTION ?? '0' } },
    },
  }],
} satisfies E2EConfig;

```

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

### Core Architecture Module: `skills/app-store-screenshots/template/src/app/api/frames/route.ts`
```
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { FRAME_FILES, type FrameFile, type MeasuredFrame } from "@/lib/frame-assets";
import { measureFrame } from "@/lib/measure-frame";

export const dynamic = "force-dynamic";

const FRAMES_DIR = path.join("public", "frames");

// Measurements keyed by file and modification time: replacing a PNG re-measures it.
const cache = new Map<string, MeasuredFrame>();

/** Which Apple bezels the user has added to public/frames/, measured. */
export async function GET() {
  const frames: Partial<Record<FrameFile, MeasuredFrame>> = {};
  const errors: Partial<Record<FrameFile, string>> = {};
  await Promise.all(FRAME_FILES.map(async (name) => {
    const file = path.join(process.cwd(), FRAMES_DIR, `${name}.png`);
    try {
      const stat = await fs.stat(file);
      const version = Math.round(stat.mtimeMs).toString(36);
      const key = `${name}:${version}:${stat.size}`;
      let frame = cache.get(key);
      if (!frame) {
        frame = await measureFrame(await fs.readFile(file), `/frames/${name}.png?v=${version}`);
        cache.set(key, frame);
      }
      frames[name] = frame;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      errors[name] = `public/frames/${name}.png: ${error instanceof Error ? error.message : String(error)}`;
    }
  }));
  return NextResponse.json({ ok: true, frames, errors }, { headers: { "Cache-Control": "no-store" } });
}

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

### Incident Patch 1: `bee50b7b` (2026-09-26)
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
+        const file = event.target.files?.[0];
+        if (file) void importFont(file);
+        event.target.value = "";
+      }}
+    />
   );
-}
+});
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
         setThemeId={(v) => setState((p) => ({ ...p, themeId: v }))}
         connectedCanvas={state.connectedCanvas}
         setConnectedCanvas={(v) => setState((p) => ({ ...p, connectedCanvas: v }))}
-        fontId={state.fontId || DEFAULT_SCREENSHOT_FONT_ID}
+        fontId={fontId}
         setFontId={(v) => setState((p) => ({ ...p, fontId: v }))}
         importedFont={state.importedFont}
         setImportedFont={(importedFont) => setState((p) => ({ ...p, fontId: "self-hosted", importedFont }))}
         locale={state.locale}
-        setLocale={(v) => setState((p) => ({ ...p, locale: v }))}
+        setLocale={(v) => setState((p) => ({ ...p, locale: v }), { history: false })}
         locales={state.locales}
         device={state.device}
-        setDevice={(v) => setState((p) => ({ ...p, device: v }))}
+        setDevice={(v) => setState((p) => ({ ...p, device: v }), { history: false })}
         orientation={state.orientation}
-        setOrientation={(v) => setState((p) => ({ ...p, orientation: v }))}
+        
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

**File**: `skills/app-store-screenshots/template/src/components/editor/slide-canvas.tsx` (modified, +12/-16)
```diff
@@ -129,7 +129,6 @@ type Props = {
   appName?: string;
   appIcon?: string;
   fontFamily?: string;
-  fontFaceCss?: string;
   editable?: boolean;
   edit?: EditHandlers;
   selectedElementId?: ElementId | null;
@@ -158,7 +157,6 @@ type DeckCanvasProps = {
   appName?: string;
   appIcon?: string;
   fontFamily?: string;
-  fontFaceCss?: string;
   connectedCanvas?: boolean;
   editable?: boolean;
   edit?: DeckEditHandlers;
@@ -559,7 +557,6 @@ export function SlideCanvas({
   appName,
   appIcon,
   fontFamily,
-  fontFaceCss,
   editable,
   edit,
   selectedElementId = null,
@@ -570,16 +567,18 @@ export function SlideCanvas({
 
   if (slide.layout === "feature-graphic" || device === "feature-graphic") {
     return (
-      <FeatureGraphicCanvas
-        slide={slide}
-        cW={cW}
-        theme={theme}
-        locale={locale}
-        appName={appName}
-        appIcon={appIcon}
-        editable={editable}
-        edit={edit}
-      />
+      <div style={{ width: "100%", height: "100%", fontFamily }}>
+        <FeatureGraphicCanvas
+          slide={slide}
+          cW={cW}
+          theme={theme}
+          locale={locale}
+          appName={appName}
+          appIcon={appIcon}
+          editable={editable}
+          edit={edit}
+        />
+      </div>
     );
   }
 
@@ -600,7 +599,6 @@ export function SlideCanvas({
         fontFamily,
       }}
     >
-      {fontFaceCss && <style>{fontFaceCss}</style>}
       <SlideBackground slide={slide} cW={cW} cH={cH} theme={theme} />
       <SlideElements
         slide={slide}
@@ -633,7 +631,6 @@ export function DeckCanvas({
   appName,
   appIcon,
   fontFamily,
-  fontFaceCss,
   connectedCanvas = true,
   editable,
   edit,
@@ -656,7 +653,6 @@ export function DeckCanvas({
         fontFamily,
       }}
     >
-      {fontFaceCss && <style>{fontFaceCss}</style>}
       {slides.map((slide, index) => {
         const screenX = index * cW;
         const active = activeSlideId === slide.id;
```

**File**: `skills/app-store-screenshots/template/src/components/editor/slide-thumb.tsx` (modified, +4/-0)
```diff
@@ -21,6 +21,7 @@ type Props = {
   locale: string;
   appName?: string;
   appIcon?: string;
+  fontFamily?: string;
   connectedCanvas: boolean;
   onSelect: () => void;
   onDelete: () => void;
@@ -41,6 +42,7 @@ export function SlideThumb({
   locale,
   appName,
   appIcon,
+  fontFamily,
   connectedCanvas,
   onSelect,
   onDelete,
@@ -116,6 +118,7 @@ export function SlideThumb({
                 locale={locale}
                 appName={appName}
                 appIcon={appIcon}
+                fontFamily={fontFamily}
                 connectedCanvas
                 editable={false}
               />
@@ -128,6 +131,7 @@ export function SlideThumb({
                 locale={locale}
                 appName={appName}
                 appIcon={appIcon}
+                fontFamily={fontFamily}
                 editable={false}
               />
             )}
```

**File**: `skills/app-store-screenshots/template/src/components/editor/toolbar.tsx` (modified, +50/-19)
```diff
@@ -1,6 +1,6 @@
 "use client";
 import * as React from "react";
-import { AlertTriangle, Check, Cloud, Download, Redo2, RotateCcw, Undo2, UnfoldHorizontal } from "lucide-react";
+import { AlertTriangle, Check, Cloud, Download, Redo2, RotateCcw, Undo2, UnfoldHorizontal, Upload } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import {
   Dialog,
@@ -14,12 +14,14 @@ import {
   Select,
   SelectContent,
   SelectItem,
+  SelectSeparator,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import {
   DEVICE_LABEL,
+  IMPORTED_FONT_FAMILY,
   PLATFORM_DEVICES,
   SCREENSHOT_FONTS,
   THEMES,
@@ -28,7 +30,9 @@ import {
 } from "@/lib/constants";
 import { detectPlatform } from "@/lib/defaults";
 import type { Device, ImportedFont, Orientation, Platform, ScreenshotFontId, Theme } from "@/lib/types";
-import { FontImporter } from "./font-importer";
+import { FontImporter, type FontImporterHandle } from "./font-importer";
+
+const IMPORT_FONT_ACTION = "__import-font__";
 
 type Props = {
   appName: string;
@@ -82,12 +86,23 @@ export function Toolbar(props: Props) {
   const platformDevices = PLATFORM_DEVICES[platform];
   const activeTheme = themeById(props.themeId);
 
+  const fontImporter = React.useRef<FontImporterHandle>(null);
+  const [importingFont, setImportingFont] = React.useState(false);
+  // "Imported font" is only a choice once a file has actually been imported.
+  const fontIds = (Object.keys(SCREENSHOT_FONTS) as ScreenshotFontId[]).filter(
+    (id) => id !== "self-hosted" || !!props.importedFont,
+  );
+  const fontLabel = (id: ScreenshotFontId) =>
+    id === "self-hosted" && props.importedFont?.name ? props.importedFont.name : SCREENSHOT_FONTS[id].name;
+  const fontPreviewFamily = (id: ScreenshotFontId) =>
+    id === "self-hosted" ? `"${IMPORTED_FONT_FAMILY}", sans-serif` : SCREENSHOT_FONTS[id].family;
+
   return (
     <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b bg-card/40 px-4 py-2">
       <Input
         value={props.appName}
         onChange={(e) => props.setAppName(e.target.value)}
-        className="h-8 w-40 border-dashed text-sm font-semibold focus-visible:border-input focus-visible:border-solid focus-visible:bg-background"
+        className="h-8 w-36 border-dashed text-sm font-semibold focus-visible:border-input focus-visible:border-solid focus-visible:bg-background"
         placeholder="App name"
         aria-label="App name"
         title="App name (click to edit)"
@@ -115,7 +130,7 @@ export function Toolbar(props: Props) {
       </Button>
 
       <Select value={activeTheme.id} onValueChange={props.setThemeId} disabled={props.busy}>
-        <SelectTrigger className="h-8 w-48 text-xs" title="Theme" aria-label="Theme">
+        <SelectTrigger className="h-8 w-40 text-xs" title="Theme" aria-label="Theme">
           <SelectValue>
             <ThemeOption theme={activeTheme} />
           </SelectValue>
@@ -129,19 +144,35 @@ export function Toolbar(props: Props) {
         </SelectContent>
       </Select>
 
-      <Select value={props.fontId} onValueChange={(fontId) => props.setFontId(fontId as ScreenshotFontId)} disabled={props.busy}>
-        <SelectTrigger className="h-8 w-44 text-xs" aria-label="Screenshot font">
-          <SelectValue placeholder="Font" />
+      <Select
+        value={props.fontId}
+        onValueChange={(fontId) => {
+          if (fontId === IMPORT_FONT_ACTION) fontImporter.current?.open();
+          else props.setFontId(fontId as ScreenshotFontId);
+        }}
+        disabled={props.busy || importingFont}
+      >
+        <SelectTrigger className="h-8 w-36 text-xs" title="Screenshot font" aria-label="Screenshot font">
+          <SelectValue placeholder="Font">
+            <span className="truncate">{importingFont ? "Importing font…" : fontLabel(props.fontId)}</span>
+          </SelectValue>
         </SelectTrigger>
         <SelectContent>
-          {Object.entries(SCREENSHOT_FONTS).map(([id, font]) => (
-            <SelectItem key={id} value={id}>{font.name}</SelectItem>
+          {fontIds.map((id) => (
+            <SelectItem key={id} value={id}>
+              <span style={{ fontFamily: fontPreviewFamily(id) }}>{fontLabel(id)}</span>
+            </SelectItem>
           ))}
+          <SelectSeparator />
+          <SelectItem value={IMPORT_FONT_ACTION}>
+            <span className="flex items-center gap-1.5">
+              <Upload className="h-3.5 w-3.5" />
+              {props.importedFont ? "Replace imported font…" : "Import font…"}
+            </span>
+          </SelectItem>
         </SelectContent>
       </Select>
-      {props.fontId === "self-hosted" && (
-        <FontImporter disabled={props.busy} importedFont={props.importedFont} onImported={props.setImportedFont} />
-      )}
+      <FontImporter ref={fontImporter} onImported={props.setImportedFont} onUploadingChange={setImport
```

---

### Incident Patch 2: `edc42f6a` (2026-10-15)
**Commit Message**: fix(template): size rounded magnifier corners from the lens's shorter side

A fixed canvas-relative radius changed every existing square lens. Taking
14% of the shorter side keeps square lenses as they were and still gives
wide lenses round corners.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `skills/app-store-screenshots/template/src/components/editor/scene-layers.tsx` (modified, +7/-3)
```diff
@@ -363,28 +363,32 @@ export function DeviceDepth({
 
 /**
  * A loupe showing part of the screenshot at `zoom`× the size it appears on the
- * device. `screenWidth` is the device's on-canvas screen width in canvas px.
+ * device. `screenWidth` is the device's on-canvas screen width in canvas px;
+ * `shortSide` is the lens's shorter side in canvas px.
  */
 export function CalloutLoupe({
   callout,
   src,
   screenWidth,
+  shortSide,
   cW,
   accent,
   hideEmpty,
 }: {
   callout: Callout;
   src: string;
   screenWidth: number;
+  shortSide: number;
   cW: number;
   accent: string;
   hideEmpty?: boolean;
 }) {
   const resolved = img(src);
   const border = Math.max(3, cW * 0.009);
   // A % radius resolves against width and height separately, so a wide lens
-  // got stretched elliptical corners. A canvas-relative px radius stays round.
-  const radius = callout.shape === "circle" ? "50%" : `${cW * 0.035}px`;
+  // got stretched elliptical corners. A px radius from the shorter side stays
+  // round and matches the old 14% on a square lens.
+  const radius = callout.shape === "circle" ? "50%" : `${shortSide * 0.14}px`;
   // An export without a screenshot shouldn't ship an empty lens.
   if (!resolved && hideEmpty) return null;
   return (
```

**File**: `skills/app-store-screenshots/template/src/components/editor/slide-canvas.tsx` (modified, +1/-0)
```diff
@@ -1424,6 +1424,7 @@ function SlideElements({
           callout={callout}
           src={screenshot}
           screenWidth={deviceWidth * SCREEN_WIDTH_FRACTION}
+          shortSide={Math.min(rect.width, rect.height)}
           cW={cW}
           accent={theme.accent}
           hideEmpty={hideEmpty}
```

---

### Incident Patch 3: `24ffb4cd` (2026-09-26)
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

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

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

#### Recent Merged Pull Requests:
- **PR #48** (2026-10-16): docs: add repository achievement badges (@ParthJadhav)
- **PR #46** (2026-10-09): Tell the two iPhone Duo displays apart, and measure bezels faster (@ParthJadhav)
- **PR #44** (2026-10-09): Add iPhone Duo and App Store creative targets, with Apple bezel support (@ParthJadhav)
- **PR #43** (closed): Cursor/cloud agent 1791302156373 v0x3p (@yanclogic)
- **PR #42** (closed): docs: give the screenshot skill one source for copy, frames, and migr… (@yanclogic)
- **PR #40** (2026-10-15): fix(template): keep rounded magnifier corners round on wide lenses (@jeffsteinmetz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
