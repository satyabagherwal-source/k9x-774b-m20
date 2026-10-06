# Forensic Learning Record (Deep Inspection): ParthJadhav/app-store-screenshots

> **Canonical Artifact**: `07_PROJECT_LEARNING/parthjadhav-app-store-screenshots-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ParthJadhav/app-store-screenshots](https://github.com/ParthJadhav/app-store-screenshots))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:26:51.615Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ParthJadhav/app-store-screenshots`
- **Description**: end to end app store screenshot creation using AI
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7157 stars

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

### Incident Patch 1: `feb5a7e3` (2026-10-03)
**Commit Message**: test: add Tester Army editor flows and fix undo and selection regressions

**File**: `.github/workflows/e2e.yml` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+name: Editor verification
+on:
+  pull_request:
+  push:
+    branches: [main]
+permissions:
+  contents: read
+jobs:
+  chrome:
+    runs-on: ubuntu-latest
+    defaults:
+      run:
+        working-directory: skills/app-store-screenshots/template
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 24
+      - uses: oven-sh/setup-bun@v2
+        with:
+          bun-version: 1.3.9
+      - run: bun install --frozen-lockfile
+      - run: npx playwright install chrome --with-deps
+      - run: bun run typecheck
+      - run: bun run build
+      - run: bun run test:e2e
+      - run: SCREENSHOTS_E2E_PRODUCTION=1 bun run test:e2e
+      - uses: actions/upload-artifact@v4
+        if: always()
+        with:
+          name: editor-e2e
+          path: skills/app-store-screenshots/template/.e2e/
+          include-hidden-files: true
+          retention-days: 7
```

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -56,3 +56,6 @@ skills/app-store-screenshots/template/public/screenshots/uploaded/
 *.tmp
 *.temp
 .cache/
+
+# Tester Army reports and recordings
+.e2e/
```

**File**: `BUG_BASH.md` (modified, +8/-0)
```diff
@@ -37,3 +37,11 @@ Covered the editor UI, canvas interactions, persistence, uploads, exports, local
 ## Scope limits
 
 This is a broad regression pass, not proof that every possible failure is eliminated. Browser coverage is Google Chrome; touch checks use Chrome emulation. The local API still assumes one server process. CLI callers that omit `If-Match` retain unconditional replacement behavior. Font API validation checks container structure; full font decoding is additionally checked by the editor's browser.
+
+## Tester Army follow-up — 2026-10-03
+
+The canonical editor template now ships Tester Army configuration, 23 direct browser/API tests, three wrappers for the existing 56 regression groups, and Chrome CI in each scaffold. Final dev and production runs each passed all 26 selected tests with no skips or retries.
+
+Fixed three additional issues: Undo after a rapid screen add could erase the preceding copy edit, reordering the initially selected screen could silently change the inspector selection, and cold dev page compilation after API-only traffic crashed on the Tailwind config's CommonJS `require`. Updated Next 16.3.6 to the 16.3.8 security release and validated build/type compatibility. The config failure was independently reported by Luna, reproduced in an isolated server, and repaired with a static ESM import; its root API harness then passed all nine groups.
+
+See [the current flow matrix and evidence](skills/app-store-screenshots/template/docs/testing/e2e.md) for exact commands, counts, retained red/green reports and verification limits.
```

**File**: `CONTRIBUTING.md` (modified, +9/-6)
```diff
@@ -39,17 +39,20 @@ Usually not a fit:
 
 ## Testing Changes
 
-The editor regression harness is `scripts/bug-bash.cjs`. Run it against a **disposable copy** of the template with its dev server running. It uses Google Chrome, mocks project state for browser checks, and checks the real project API rejects malformed writes. It covers editor keyboard controls, history, delayed saves/uploads, export sizes/locales, missing assets, connected crops, and feature graphics.
+The canonical product is `skills/app-store-screenshots/template`, which ships the editor and its verification suite. Start with:
 
 ```bash
-PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/bug-bash.cjs http://localhost:3098
-PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/ui-bug-bash.cjs http://localhost:3098
-node scripts/api-bug-bash.cjs http://localhost:3098
+cd skills/app-store-screenshots/template
+bun install --frozen-lockfile
+bun run typecheck
+bun run build
+bun run test:e2e
+SCREENSHOTS_E2E_PRODUCTION=1 bun run test:e2e
 ```
 
-Use an existing Playwright installation or install it outside the repo for this harness. Also run `tsc --noEmit` and the production build in the template. Use the manual checklist below for skill/scaffolding changes.
+The Tester Army configuration launches a disposable template copy and uses installed Google Chrome. Every scaffold contains the same configuration, tests, legacy regression harnesses and CI workflow. Read [the flow matrix](skills/app-store-screenshots/template/docs/testing/e2e.md) for exact coverage and residual gaps.
 
-The API harness checks validation, same-origin writes, concurrent save conflicts, bounded request bodies, and real PNG/JPEG/WOFF2 uploads. Run the harnesses sequentially: the API and export harnesses write the disposable server's project file. The browser harness also covers failed-save recovery, corrupt assets, stalled workers, and narrow screens. The UI harness exercises pointer drag/resize, rotation, layers, keyboard reordering, empty states, themes/fonts, touch controls, responsive layouts, and every device/layout combination. Set `BUG_BASH_FILTER` to run a single browser check by name. Repeat the API and upload/export checks against `next start` to catch production-only asset-serving failures.
+The original `scripts/{bug-bash,ui-bug-bash,api-bug-bash}.cjs` commands remain compatibility entry points. Only run them against a disposable editor server; they write its project and upload assets. The API and export harnesses must run sequentially. Set `BUG_BASH_FILTER` for one browser check.
 
 ### For README-only changes
 
```

**File**: `scripts/api-bug-bash.cjs` (modified, +2/-137)
```diff
@@ -1,137 +1,2 @@
-// Run only against a disposable template copy; this writes projects and assets.
-// node scripts/api-bug-bash.cjs http://localhost:3098
-const assert = require('node:assert/strict');
-const sharp = require('../skills/app-store-screenshots/template/node_modules/sharp');
-const fs = require('node:fs/promises');
-const os = require('node:os');
-const path = require('node:path');
-const {execFileSync} = require('node:child_process');
-const {randomBytes} = require('node:crypto');
-const base = process.argv[2] || 'http://localhost:3098';
-const projectURL = base + '/api/project';
-const post = (route, data, headers = {}) => fetch(base + route, {
-  method: 'POST', headers: {'content-type': 'application/json', ...headers}, body: JSON.stringify(data),
-});
-let passed = 0;
-async function check(name, run) { await run(); console.log('PASS', name); passed++; }
-(async () => {
-  const initial = await fetch(projectURL);
-  assert.equal(initial.status, 200);
-  const {state: original} = await initial.json();
-  assert.ok(original, 'Start with a disposable template project');
-  try {
-    await check('invalid project shapes are rejected without replacing the file', async () => {
-      const slide = {id:'a', layout:'no-device', screenshot:'', label:{en:'Test'}, headline:{en:'Test'}};
-      const rect = {x:0,y:0,width:10,height:10};
-      const invalid = [null, [], {}, {...original,schemaVersion:999}, {...original,connectedCanvas:'false'},
-        {...original,slidesByDevice:{typo:[]}}, {...original,locales:['en','en']},
-        ...[{headline:{en:[]}}, {transforms:{caption:{...rect,width:-1}}}, {textElements:[null]},
-          {imageElements:[{id:'x',src:'a',transform:rect},{id:'x',src:'b',transform:rect}]}]
-          .map(patch => ({...original, slidesByDevice:{watchos:[{...slide,...patch}]}}))];
-      for (const state of invalid) assert.equal((await post('/api/project',state)).status,400);
-      assert.deepEqual((await (await fetch(projectURL)).json()).state, original);
-    });
-    await check('every write route requires exact JSON content type and same origin', async () => {
-      for (const route of ['/api/project','/api/upload','/api/upload-font']) {
-        for (const type of ['text/plain','application/json-invalid']) assert.equal((await post(route,{}, {'content-type':type})).status,415);
-        for (const origin of ['null','https://evil.example','http://localhost:9999']) assert.equal((await post(route,{}, {origin})).status,403);
-        assert.equal((await post(route,{}, {'sec-fetch-site':'cross-site'})).status,403);
-      }
-      for (const host of ['localhost','127.0.0.1']) {
-        const url = new URL(projectURL); url.hostname = host;
-        const response = await fetch(url, {method:'POST',headers:{'content-type':'application/json',origin:url.origin,'sec-fetch-site':'same-origin'},body:JSON.stringify(original)});
-        assert.equal(response.status,200,host);
-      }
-    });
-    await check('concurrent stale project writes conflict and preserve the winning state', async () => {
-      const revision = (await fetch(projectURL)).headers.get('etag');
-      assert.ok(revision);
-      const candidates = ['tab A','tab B'].map(appName=>({...original,appName}));
-      const responses = await Promise.all(candidates.map(data=>post('/api/project',data,{'if-match':revision})));
-      assert.deepEqual(responses.map(r=>r.status).sort(),[200,412]);
-      const winning = responses.findIndex(r=>r.status===200);
-      const current = await fetch(projectURL);
-      assert.deepEqual((await current.json()).state,candidates[winning]);
-      assert.equal(current.headers.get('etag'),responses[winning].headers.get('etag'));
-      assert.equal((await post('/api/project',original,{'if-match':revision})).status,412);
-      assert.equal((await post('/api/project',original,{'if-match':current.headers.get('etag')})).status,200);
-    });
-    await check('truncated, forged, malformed base64 and wrong-type uploads are rejected', async () => {
-      for (const data of [null, {}, {dataUrl:'data:image/png;base64,iVBORw0KGgo='}, {dataUrl:'data:image/jpeg;base64,/9j/'},
-        {dataUrl:'data:image/png;base64,iVBORw0K!Ggo='}, {dataUrl:'data:text/html;base64,SGk='}]) {
-        assert.equal((await post('/api/upload',data)).status,400);
-      }
-      for (const data of [null,{}, {data:'d09GMg=='},{data:'T1RUTw=='},{data:'AAEAAA=='},{data:'d09GRg=='}]) {
-        assert.equal((await post('/api/upload-font',data)).status,400);
-      }
-    });
-    await check('real PNG/JPEG uploads round-trip; identical concurrent uploads stay intact', async () => {
-      for (const format of ['png','jpeg']) {
-        // Always a new hash, so restarting next start cannot mask missing
-        // runtime asset serving by indexing files from a previous test run.
-        const bytes = await sharp({create:{width:24,height:30,channels:3,background:'#'+randomBytes(3).toString('hex')}})[format]().toBuffer();

```

**File**: `scripts/bug-bash.cjs` (modified, +2/-467)
```diff
@@ -1,467 +1,2 @@
-// Run against a disposable copy: this exercises uploads and /api/project.
-// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/bug-bash.cjs http://localhost:3098
-const assert = require('node:assert/strict');
-const fs = require('node:fs/promises');
-const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
-const baseURL = process.argv[2] || 'http://localhost:3098';
-const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
-const slide = (id, extra = {}) => ({ id, layout: 'no-device', label: {en: 'LABEL'}, headline: {en: id}, screenshot: '', ...extra });
-const fixture = (extra = {}) => ({schemaVersion:2,appName:'Bug bash',themeId:'clean-light',connectedCanvas:true,locales:['en'],locale:'en',device:'watchos',orientation:'portrait',slidesByDevice:{watchos:[slide('first'),slide('second')],android:[slide('android')],iphone:[slide('iphone')]},...extra});
-(async () => {
- const browser = await chromium.launch({channel:'chrome', headless:true});
- const errors = [];
- async function open(state=fixture(), save) {
-   const page = await browser.newPage({viewport:{width:1600,height:1000}});
-   let latest=structuredClone(state);
-   page.on('pageerror', error=>errors.push(error.message));
-   await page.route('**/api/project',async route=>{
-     if(route.request().method()==='POST') {
-       const data=route.request().postDataJSON();
-       if(save) await save(data);
-       latest=data;
-     }
-     await route.fulfill({json:{ok:true,state:latest}});
-   });
-   await page.goto(baseURL);
-   await page.getByRole('button',{name:'Export bundle',exact:true}).waitFor();
-   return {page, latest:()=>latest};
- }
- let passed=0;
- async function check(name, run) {
-   if(process.env.BUG_BASH_FILTER && !name.includes(process.env.BUG_BASH_FILTER)) return;
-   await run(); passed++; console.log('PASS',name);
- }
- try {
- await check('menu arrows do not navigate slides',async()=>{
-   const {page}=await open();
-   await page.getByRole('combobox',{name:'Theme',exact:true}).click();
-   await page.keyboard.press('ArrowDown');
-   assert.match(await page.locator('main').innerText(),/Screen 1/);
-   await page.keyboard.press('Escape'); await page.close();
- });
- await check('duplicate selects copy; undo and redo preserve edits',async()=>{
-   const {page}=await open();
-   await page.getByRole('button',{name:'Duplicate screen 1',exact:true}).click();
-   assert.match(await page.locator('main').innerText(),/Screen 2/);
-   await page.getByRole('button',{name:'Undo',exact:true}).click();
-   assert.equal(await page.getByRole('button',{name:/^Delete screen/}).count(),2);
-   await page.getByRole('button',{name:'Redo',exact:true}).click();
-   assert.equal(await page.getByRole('button',{name:/^Delete screen/}).count(),3);
-   await page.close();
- });
- await check('rapid edits on different decks have separate undo steps',async()=>{
-   const {page}=await open();
-   await page.locator('textarea').first().fill('watch changed');
-   await page.getByRole('tab',{name:'Android',exact:true}).click();
-   await page.locator('textarea').first().fill('android changed');
-   await page.getByRole('button',{name:'Undo',exact:true}).click();
-   assert.equal(await page.locator('textarea').first().inputValue(),'android');
-   await page.getByRole('button',{name:'Undo',exact:true}).click();
-   assert.equal(await page.locator('textarea').first().inputValue(),'first');
-   await page.close();
- });
- await check('editing does not reset a manually panned canvas',async()=>{
-   const {page}=await open();
-   const scroller=page.locator('main .overflow-auto');
-   await scroller.evaluate(el=>el.scrollTo({left:300,behavior:'instant'}));
-   const before=await scroller.evaluate(el=>el.scrollLeft);
-   assert.ok(before>0);
-   await page.locator('textarea').first().fill('edited while panned');
-   await pause(400);
-   assert.equal(await scroller.evaluate(el=>el.scrollLeft),before);
-   await page.close();
- });
- await check('slow autosaves never overlap or overwrite newer state',async()=>{
-   let active=0,maxActive=0; const completed=[];
-   const {page,latest}=await open(fixture(),async data=>{
-     maxActive=Math.max(maxActive,++active);
-     await pause(data.appName==='older'?1800:50);
-     completed.push(data.appName); active--;
-   });
-   await pause(800);
-   await page.getByRole('textbox',{name:'App name',exact:true}).fill('older');
-   await pause(800);
-   await page.getByRole('textbox',{name:'App name',exact:true}).fill('newer');
-   await pause(2600);
-   assert.equal(maxActive,1); assert.equal(latest().appName,'newer');
-   assert.equal(completed.at(-1),'newer'); await page.close();
- });
- await check('export locks immediately and through completion, PNG dimensions/locales are correct',async()=>{
-   const {page}=await open(fixture({locales:['en','de']}));
-   let downloadCount=0; page.on('download',()=>downloadCount++);
-   const downloaded=page.waitForEvent('download');

```

**File**: `scripts/ui-bug-bash.cjs` (modified, +2/-168)
```diff
@@ -1,168 +1,2 @@
-// Interaction-focused Chrome bug bash. Uses disposable, mocked project state.
-// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/ui-bug-bash.cjs http://localhost:3098
-const assert = require('node:assert/strict');
-const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
-const baseURL = process.argv[2] || 'http://localhost:3098';
-const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
-const slide = (id, extra={})=>({id,layout:'no-device',label:{en:'LABEL'},headline:{en:id},screenshot:'',...extra});
-const rect = {x:100,y:200,width:160,height:90,zIndex:6};
-const fixture=(extra={})=>({schemaVersion:2,appName:'UI bug bash',themeId:'clean-light',connectedCanvas:true,device:'watchos',orientation:'portrait',locale:'en',locales:['en','de'],slidesByDevice:{watchos:[slide('First'),slide('Second'),slide('Third')],android:[slide('Android')],iphone:[slide('iPhone')]},...extra});
-(async()=>{
-  const browser=await chromium.launch({channel:'chrome',headless:true});
-  const errors=[];let passed=0,failures=0;
-  async function open(state=fixture(),viewport={width:1600,height:1000},options={}) {
-    const page=await browser.newPage({viewport,...options});let latest=structuredClone(state);
-    page.on('pageerror',error=>errors.push(error.message));
-    await page.route('**/api/project',async route=>{if(route.request().method()==='POST')latest=route.request().postDataJSON();await route.fulfill({json:{ok:true,state:latest}})});
-    await page.goto(baseURL);await page.getByRole('button',{name:'Export bundle',exact:true}).waitFor();
-    return {page,latest:()=>latest};
-  }
-  async function check(name,run) {
-    if(process.env.BUG_BASH_FILTER&&!name.includes(process.env.BUG_BASH_FILTER))return;
-    try{await run();passed++;console.log('PASS',name)}catch(error){failures++;console.error('FAIL',name,error.message)}
-  }
-  try {
-    await check('Escape cancels a draft text size without changing the canvas',async()=>{
-      const {page,latest}=await open(fixture({slidesByDevice:{watchos:[slide('Text',{textElements:[{id:'t',text:{en:'Overlay'},fontSize:26,transform:rect}]})]}}));
-      await page.locator('main [contenteditable=plaintext-only]').last().focus();
-      const input=page.getByRole('spinbutton',{name:'Text size in pixels',exact:true});
-      await input.fill('100');await input.press('Escape');await pause(800);
-      assert.equal(latest().slidesByDevice.watchos[0].textElements[0].fontSize,26);
-      await page.close();
-    });
-    await check('exploring layouts keeps the chosen secondary screenshot',async()=>{
-      const {page,latest}=await open(fixture({slidesByDevice:{watchos:[slide('Pair',{layout:'two-devices',screenshot:'/front.png',screenshotSecondary:'/back.png'})]}}));
-      const layout=page.locator('aside').last().getByRole('combobox').first();
-      await layout.click();await page.getByRole('option',{name:'Hero',exact:true}).click();
-      await layout.click();await page.getByRole('option',{name:'Two devices',exact:true}).click();await pause(800);
-      assert.equal(latest().slidesByDevice.watchos[0].screenshotSecondary,'/back.png');await page.close();
-    });
-    await check('keyboard reordering preserves selection, content, and undo',async()=>{
-      const {page,latest}=await open();
-      await page.getByRole('button',{name:/^Screen 2/}).click();
-      const handle=page.getByRole('button',{name:/^Reorder screen 2/});
-      await handle.focus();await page.keyboard.press('Space');await pause(100);
-      await page.keyboard.press('ArrowUp');await page.getByRole('status').filter({hasText:'over droppable area First'}).waitFor();
-      await page.keyboard.press('Space');await pause(900);
-      assert.deepEqual(latest().slidesByDevice.watchos.map(s=>s.id),['Second','First','Third']);
-      assert.equal(await page.locator('textarea').first().inputValue(),'Second');
-      await page.getByRole('button',{name:'Undo',exact:true}).click();await pause(800);
-      assert.deepEqual(latest().slidesByDevice.watchos.map(s=>s.id),['First','Second','Third']);await page.close();
-    });
-    await check('deleting the final slide exposes a usable empty state and can be undone',async()=>{
-      const {page,latest}=await open(fixture({slidesByDevice:{watchos:[slide('Only')]}}));
-      await page.getByRole('button',{name:'Delete screen 1',exact:true}).click();
-      await page.getByText('No screens yet',{exact:true}).waitFor();
-      await page.getByRole('button',{name:'Export bundle',exact:true}).click();await page.getByText('No screens to export',{exact:true}).waitFor();
-      assert.equal(await page.locator('[inert]').count(),0);
-      await page.getByRole('button',{name:'Undo',exact:true}).first().click();
-      assert.equal(await page.locator('textarea').first().inputValue(),'Only');
-      await page.getByRole('button',{name:'Delete screen 1',exact:true}).click();await pause(600);
-      await page.getByRole('button',{name:'Add s
```

**File**: `skills/app-store-screenshots/template/.github/workflows/e2e.yml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+name: Editor verification
+on:
+  pull_request:
+  push:
+    branches: [main]
+permissions:
+  contents: read
+jobs:
+  chrome:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 24
+      - uses: oven-sh/setup-bun@v2
+        with:
+          bun-version: 1.3.9
+      - run: bun install --frozen-lockfile
+      - run: npx playwright install chrome --with-deps
+      - run: bun run typecheck
+      - run: bun run build
+      - run: bun run test:e2e
+      - run: SCREENSHOTS_E2E_PRODUCTION=1 bun run test:e2e
+      - uses: actions/upload-artifact@v4
+        if: always()
+        with:
+          name: editor-e2e
+          path: .e2e/
+          include-hidden-files: true
+          retention-days: 7
```

---

### Incident Patch 2: `8bd75204` (2026-09-29)
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
+- `scripts/ui-bug-bash.cjs`: 12 UI interaction groups, including 67 device/layout/orientation combinations; pointer drag/resize, keyboard reorder, rotation, layers, deletion/undo, empty states, backgrounds, themes/fonts, responsive widths, and touch controls.
+- `scripts/api-bug-bash.cjs`: 9 API regression groups, including concurrent saves/uploads, origin/content-type checks, chunked limits, asset traversal rejection, real PNG/JPEG/WOFF2 round-trips, and execution of the documented migration.
+- Production build (including TypeScript checking) and `git diff --check` passed.
+- Reproduction commands are in [CONTRIBUTING.md](CONTRIBUTING.md). Run against a disposable copy; API and upload checks write its project/assets.
+
+## Scope limits
+
+This is a broad regression pass, not proof that every possible failure is eliminated. Browser coverage is Google Chrome; touch checks use Chrome emulation. The local API still assumes one server process. CLI callers that omit `If-Match` retain unconditional replacement behavior. Font API validation checks container structure; full font decoding is additionally checked by the editor's browser.
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
+    await check('truncated, forged, malformed base64 and wrong-type uploads are rejected', async () => {
+      for (const data of [null, {}, {dataUrl:'data:image/png;base64,iVBORw0KGgo='}, {dataUrl:'data:image/jpeg;base64,/9j/'},
+        {dataUrl:'data:image/png;base64,iVBORw0K!Ggo='}, {dataUrl:'data:text/html;base64,SGk='}]) {
+        assert.equal((await post('/api/upload',data)).status,400);
+      }
+      for (const data of [null,{}, {data:'d09GMg=='},{data:'T1RUTw=='},{data:'AAEAAA=='},{data:'d09GRg=='}]) {
+        assert.equal((await post('/api/upload-font',data)).status,400);
+      }
+    });
+    await check('real PNG/JPEG uploads round-trip; identical concurrent uploads stay intact', async () => {
+      for (const format of ['png','jpeg']) {
+        // Always a new hash, so restarting next start cannot mask missing
+        // runtime asset serving by indexing files from a previous test run.
+        const bytes = await sharp({create:{width:24,height:30,channels:3,background:'#'+randomBytes(3).toString('hex')}})[format]().toBuffer();

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
+     const n=++count;headers.push(route.request().headers()['if-match']);
+     if(n===1)await pause(1600);
+     await route.fulfill({headers:{etag:`"revision-${n}"`},json:{ok:true}});
+   });
+   await page.getByRole('textbox',{name:'App name',exact:true}).fill('older');await pause(800);
+   await page.getByRole('textbox',{name:'App name',exact:true}).fill('newer');await pause(2200);
+   assert.deepEqual(headers,[undefined,'"revision-1"']);await page.close();
+ });
+ await check('two real editor tabs cannot silently overwrite each other',async()=>{
+   const original=await (await fetch(baseURL+'/api/project')).json();
+   const save=state=>fetch(baseURL+'/api/project',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(state)});
+   const pages=[];
+   try {
+     assert.equal((await save(fixture())).status,200);
+     for(let i=0;i<2;i++){
+       const page=await browser.newPage({viewport:{width:1600,height:1000}});pages.push(page);
+       page.on('pageerror',error=>errors.push(error.messa
```

**File**: `scripts/ui-bug-bash.cjs` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+// Interaction-focused Chrome bug bash. Uses disposable, mocked project state.
+// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/ui-bug-bash.cjs http://localhost:3098
+const assert = require('node:assert/strict');
+const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
+const baseURL = process.argv[2] || 'http://localhost:3098';
+const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
+const slide = (id, extra={})=>({id,layout:'no-device',label:{en:'LABEL'},headline:{en:id},screenshot:'',...extra});
+const rect = {x:100,y:200,width:160,height:90,zIndex:6};
+const fixture=(extra={})=>({schemaVersion:2,appName:'UI bug bash',themeId:'clean-light',connectedCanvas:true,device:'watchos',orientation:'portrait',locale:'en',locales:['en','de'],slidesByDevice:{watchos:[slide('First'),slide('Second'),slide('Third')],android:[slide('Android')],iphone:[slide('iPhone')]},...extra});
+(async()=>{
+  const browser=await chromium.launch({channel:'chrome',headless:true});
+  const errors=[];let passed=0,failures=0;
+  async function open(state=fixture(),viewport={width:1600,height:1000},options={}) {
+    const page=await browser.newPage({viewport,...options});let latest=structuredClone(state);
+    page.on('pageerror',error=>errors.push(error.message));
+    await page.route('**/api/project',async route=>{if(route.request().method()==='POST')latest=route.request().postDataJSON();await route.fulfill({json:{ok:true,state:latest}})});
+    await page.goto(baseURL);await page.getByRole('button',{name:'Export bundle',exact:true}).waitFor();
+    return {page,latest:()=>latest};
+  }
+  async function check(name,run) {
+    if(process.env.BUG_BASH_FILTER&&!name.includes(process.env.BUG_BASH_FILTER))return;
+    try{await run();passed++;console.log('PASS',name)}catch(error){failures++;console.error('FAIL',name,error.message)}
+  }
+  try {
+    await check('Escape cancels a draft text size without changing the canvas',async()=>{
+      const {page,latest}=await open(fixture({slidesByDevice:{watchos:[slide('Text',{textElements:[{id:'t',text:{en:'Overlay'},fontSize:26,transform:rect}]})]}}));
+      await page.locator('main [contenteditable=plaintext-only]').last().focus();
+      const input=page.getByRole('spinbutton',{name:'Text size in pixels',exact:true});
+      await input.fill('100');await input.press('Escape');await pause(800);
+      assert.equal(latest().slidesByDevice.watchos[0].textElements[0].fontSize,26);
+      await page.close();
+    });
+    await check('exploring layouts keeps the chosen secondary screenshot',async()=>{
+      const {page,latest}=await open(fixture({slidesByDevice:{watchos:[slide('Pair',{layout:'two-devices',screenshot:'/front.png',screenshotSecondary:'/back.png'})]}}));
+      const layout=page.locator('aside').last().getByRole('combobox').first();
+      await layout.click();await page.getByRole('option',{name:'Hero',exact:true}).click();
+      await layout.click();await page.getByRole('option',{name:'Two devices',exact:true}).click();await pause(800);
+      assert.equal(latest().slidesByDevice.watchos[0].screenshotSecondary,'/back.png');await page.close();
+    });
+    await check('keyboard reordering preserves selection, content, and undo',async()=>{
+      const {page,latest}=await open();
+      await page.getByRole('button',{name:/^Screen 2/}).click();
+      const handle=page.getByRole('button',{name:/^Reorder screen 2/});
+      await handle.focus();await page.keyboard.press('Space');await pause(100);
+      await page.keyboard.press('ArrowUp');await page.getByRole('status').filter({hasText:'over droppable area First'}).waitFor();
+      await page.keyboard.press('Space');await pause(900);
+      assert.deepEqual(latest().slidesByDevice.watchos.map(s=>s.id),['Second','First','Third']);
+      assert.equal(await page.locator('textarea').first().inputValue(),'Second');
+      await page.getByRole('button',{name:'Undo',exact:true}).click();await pause(800);
+      assert.deepEqual(latest().slidesByDevice.watchos.map(s=>s.id),['First','Second','Third']);await page.close();
+    });
+    await check('deleting the final slide exposes a usable empty state and can be undone',async()=>{
+      const {page,latest}=await open(fixture({slidesByDevice:{watchos:[slide('Only')]}}));
+      await page.getByRole('button',{name:'Delete screen 1',exact:true}).click();
+      await page.getByText('No screens yet',{exact:true}).waitFor();
+      await page.getByRole('button',{name:'Export bundle',exact:true}).click();await page.getByText('No screens to export',{exact:true}).waitFor();
+      assert.equal(await page.locator('[inert]').count(),0);
+      await page.getByRole('button',{name:'Undo',exact:true}).first().click();
+      assert.equal(await page.locator('textarea').first().inputValue(),'Only');
+      await page.getByRole('button',{name:'Delete screen 1',exact:true}).click();await pause(600);
+      await page.getByRole('button',{name:'Add s
```

**File**: `skills/app-store-screenshots/SKILL.md` (modified, +23/-4)
```diff
@@ -157,7 +157,7 @@ const templateState =
 const existingState = readJson(PROJECT_FILE) || {};
 const hasExplicitConnectedCanvas = typeof existingState.connectedCanvas === "boolean";
 const existingDecks =
-  existingState.slidesByDevice && typeof existingState.slidesByDevice === "object"
+  existingState.slidesByDevice && typeof existingState.slidesByDevice === "object" && !Array.isArray(existingState.slidesByDevice)
     ? existingState.slidesByDevice
     : {};
 const hasExistingDecks = Object.keys(existingDecks).length > 0;
@@ -181,7 +181,9 @@ if (legacySlides && !hasExistingDecks) {
 
 function localized(value) {
   if (typeof value === "string") return { [DEFAULT_LOCALE]: value };
-  if (value && typeof value === "object") return value;
+  if (value && typeof value === "object" && !Array.isArray(value)) {
+    return Object.fromEntries(Object.entries(value).filter(([, text]) => typeof text === "string"));
+  }
   return {};
 }
 
@@ -217,22 +219,36 @@ function migrateSlide(slide, used) {
   const rawTransforms = slide.transforms && typeof slide.transforms === "object" ? slide.transforms : {};
   for (const [id, transform] of Object.entries(rawTransforms)) {
     const cleaned = cleanTransform(transform);
-    if (cleaned) transforms[id] = cleaned;
+    if (["caption", "device", "deviceSecondary"].includes(id) && cleaned) transforms[id] = cleaned;
   }
+  const textIds = new Set();
   const textElements = Array.isArray(slide.textElements)
     ? slide.textElements
         .map((element) => {
+          if (!element || typeof element !== "object" || Array.isArray(element)) return null;
           const transform = cleanTransform(element.transform);
-          if (!element || typeof element.id !== "string" || !transform) return null;
+          if (!transform) return null;
           return {
             ...element,
+            id: uniqueId(element.id, textIds),
             text: localized(element.text),
             transform,
+            fontSize: Number.isFinite(element.fontSize) && element.fontSize > 0 ? element.fontSize : undefined,
+            fontWeight: Number.isFinite(element.fontWeight) && element.fontWeight > 0 ? element.fontWeight : undefined,
           };
         })
         .filter(Boolean)
     : undefined;
 
+  const imageIds = new Set();
+  const imageElements = Array.isArray(slide.imageElements)
+    ? slide.imageElements.map((element) => {
+        if (!element || typeof element !== "object" || Array.isArray(element) || typeof element.src !== "string") return null;
+        const transform = cleanTransform(element.transform);
+        return transform ? { ...element, id: uniqueId(element.id, imageIds), transform } : null;
+      }).filter(Boolean)
+    : undefined;
+
   return {
     ...slide,
     id: uniqueId(slide.id, used),
@@ -241,8 +257,10 @@ function migrateSlide(slide, used) {
     headline: localized(slide.headline || slide.title || slide.caption || slide.copy),
     screenshot: firstString(slide.screenshot, slide.image, slide.src, slide.path),
     screenshotSecondary: typeof slide.screenshotSecondary === "string" ? slide.screenshotSecondary : undefined,
+    inverted: typeof slide.inverted === "boolean" ? slide.inverted : undefined,
     ...(Object.keys(transforms).length ? { transforms } : { transforms: undefined }),
     ...(textElements && textElements.length ? { textElements } : { textElements: undefined }),
+    ...(imageElements && imageElements.length ? { imageElements } : { imageElements: undefined }),
   };
 }
 
@@ -709,6 +727,7 @@ The current template writes `schemaVersion: 2`. Existing projects made by earlie
 4. Keeps pre-v2 decks in isolated-screen mode by setting `connectedCanvas: false`, so already-clipped phones or captions do not suddenly appear in neighboring exports.
 5. Lets the user opt into connected crops with the toolbar's Connected/Isolated control when they are ready to use cross-screen placement.
 6. Saves the upgraded state back to `app-store-screenshots.json` and `localStorage` only after the file endpoint has loaded successfully, so stale browser cache cannot overwrite the canonical project file during dev-server restarts.
+7. Detects newer disk revisions before autosaving. If another tab or an agent edits the project, keep unsaved work open and export or copy it before reloading; do not force a stale save over the newer file.
 
 There are two migration modes:
 
```

**File**: `skills/app-store-screenshots/template/README.md` (modified, +17/-2)
```diff
@@ -4,6 +4,8 @@ A pre-built Next.js + ShadCN editor for generating App Store and Google Play scr
 
 ## Quick start
 
+Requires Node.js 20.9 or newer.
+
 ```bash
 bun install   # or pnpm / yarn / npm
 bun dev       # http://localhost:3000
@@ -57,7 +59,7 @@ The toolbar **Theme** menu recolours the whole deck (backgrounds, text, accents)
 
 The toolbar font menu sets the typeface of the screenshot canvas and exports (not the editor UI). **Inter (default)** is the template font and what projects without a `fontId` use. **System Sans** and **Georgia** are available everywhere; **Avenir Next**, **Helvetica Neue**, **Futura**, **Baskerville**, **Palatino**, **Optima** and **American Typewriter** are macOS system fonts that fall back to similar faces elsewhere, so export on the machine you designed on.
 
-**Import font…** at the bottom of the menu takes a licensed WOFF2, WOFF, TTF or OTF file (16 MB max). `/api/upload-font` checks the file's magic bytes and stores it as `public/fonts/imported/<hash>.<ext>`; the project saves it as `importedFont` with `fontId: "self-hosted"`. That font folder is gitignored (font licences often forbid redistribution); keep the file alongside the project JSON if you move the project, or screenshot text falls back to a generic sans-serif. Once imported, the font is listed in the menu under its file name, and it is loaded and embedded before every export.
+**Import font…** at the bottom of the menu takes a licensed WOFF2, WOFF, TTF or OTF file (16 MB max). The browser decodes the font before uploading; `/api/upload-font` checks the container signature, lengths and table bounds before storing it as `public/fonts/imported/<hash>.<ext>`. The project saves it as `importedFont` with `fontId: "self-hosted"`. That font folder is gitignored (font licences often forbid redistribution); keep the file alongside the project JSON if you move the project, or screenshot text falls back to a generic sans-serif. Once imported, the font is listed in the menu under its file name, and it is loaded and embedded before every export.
 
 ### Image overlays
 
@@ -83,6 +85,19 @@ The toolbar arrows, `⌘Z` / `Ctrl+Z` and `⇧⌘Z` / `Ctrl+Shift+Z` (or `Ctrl+Y
 - `mockup.png` is the iPhone bezel overlay; replacing it requires re-measuring the `PHONE_SCREEN` constants.
 - Image preloading converts every static path to a base64 data URI before exports run, and export retries paths that were previously missing. `export-render.ts` then waits for those images to paint in the render (see Exporting).
 - Reset via the toolbar's circular arrow icon clears in-memory state and reloads the default screens. To wipe disk state too, delete `app-store-screenshots.json`.
-- **Persistence model** — the canonical state lives in `app-store-screenshots.json` (git-tracked). On load, the editor reads localStorage first for instant paint, then overwrites with the file contents if present; if the file endpoint is unavailable, autosave is blocked so stale cache cannot overwrite disk. On save, both are written. File saves are serialized, and the server replaces the JSON atomically so overlapping edits cannot leave a partial file. Invalid project shapes are rejected without overwriting the project. If you ever see a conflict, the file always wins.
+- **Persistence model** — the canonical state lives in `app-store-screenshots.json` (git-tracked). On load, the editor reads localStorage first, then reconciles with the file; if the file endpoint is unavailable, autosave is blocked so stale cache cannot overwrite disk. File saves are serialized and atomic. Each editor sends the revision it loaded, so a newer save from another tab or an on-disk edit produces a conflict instead of an overwrite. Your unsaved work stays open: export or copy it before reloading. **Retry save** retries transient failures; it does not override conflicts. Leaving with unsaved edits triggers the browser's warning.
 - **Migration model** — schema v1 projects do not need a manual conversion. On first load, the editor upgrades localized text and transform records, writes `schemaVersion: 2`, preserves all existing screens, and keeps `connectedCanvas: false` so old offscreen/clipped elements export exactly as isolated screens. Turn on **Connected** in the toolbar when you want elements to cross screen edges. Explicit skill migrations preserve an existing `connectedCanvas` choice, otherwise they keep legacy decks isolated too.
 - **Custom themes** — if a project file references a theme id that is not present in `src/lib/constants.ts`, the editor falls back to `clean-light` and shows a warning. Merge custom `THEMES` entries during in-place upgrades.
+
+## Local API contract
+
+These routes are for a local editor running in one server process. They have no authentication for remote hosting. Browser writes must come from the same origin and use `Content-Type: application/json`; headerless scripts still work.
+
+- `GET /api/project` returns `{ ok, state }` and an `ETag` revision, includi
```

---

### Incident Patch 3: `94724257` (2026-09-27)
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

Co-Authored-By: Claude Opus 5.5 <[RED

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
+ });
+ await check('RTL copy gets its own base direction',async()=>{
+   const {page}=await open(fixture({locales:['en','he'],locale:'he',slidesByDevice:{watchos:[slide('a',{headline:{en:'Hi',he:'שלום עולם!'}})]}}));
+   const headline=page.locator('main [contenteditable=plaintext-only]').nth(1);
+   assert.equal(await headline.evaluate(el=>getComputedStyle(el).direction),'rtl');
+   assert.equal(await page.locator('main [contenteditable=plaintext-only]').first().evaluate(el=>getComputedStyle(el).direction),'ltr'); await page.close();
+ });
+ await check('generated feature-graphic decks normalise without an undo step',async()=>{
+   const {page,latest}=await open(fixture({device:'feature-graphic',slidesByDevice:{'feature-graphic':[slide('one',{layout:'hero'}),slide('two',{layout:'hero'})]}}));
+   await pause(1000);
+   assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),false);
+   assert.deepEqual(latest().slidesByDevice['feature-graphic'].map(s=>s.layout)
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
 - `themeId` (one of `"clean-light" | "dark-bold" | "warm-editorial" | "ocean-fresh" | "bloom-roast"`, a named style slug such as `"swiss-grid-bold"` when the user picked that style, or add a matching entry to `THEMES` in `src/lib/constants.ts`). Themes may set `accentAlt` for the label color on inverted slides.
+- `appIcon` — public path of the app icon (e.g. `"/app-icon.png"` after copying it to `public/app-icon.png`). The Play Store feature graphic shows it; blank uses the app's initial. The icon can also be picked in the feature-graphic inspector.
 - `connectedCanvas` (`true` for new connected decks; migrated legacy decks should stay `false` until the user opts in)
 - Starter slides per device with the user's `label` + `headline` + screenshot paths
 - Optional per-slide `typography: { labelScale, headlineScale, appNameScale }` (0.5–2, default 1) when one headline is much longer or shorter than the rest of the deck. `appNameScale` only applies to the feature graphic, where `headlineScale` sizes the tagline.
@@ -586,7 +612,7 @@ The editor stores headlines and labels per-locale on each slide — switch to a
 
 - Don't literally translate — rewrite for the target market.
 - Re-check line breaks per locale; German/French/Portuguese often need shorter claims.
-- For RTL (`ar`, 
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
           onTextPatch={onTextPatch}
         />
@@ -773,16 +783,21 @@ function TextElementPanel({
   element,
   locale,
   canvas,
+  defaultColor,
   onTextChange,
   onTextPatch,
 }: {
   element: TextElement;
   locale: string;
   canvas: { cW: number; cH: number };
+  defaultColor: string;
   onTextChange: (value: string) => void;
   onTextPatch: (patch: Partial<TextElement>) => void;
 }) {
-  const text = element.text?.[locale] ?? pickText(element.text, locale);
+  // Like the headline field: the locale's own text, with the fallback shown as
+  // a placeholder, so clearing a translation doesn't snap back to English.
+  const text = element.text?.[locale] ?? "";
+  const textPlaceholder = pickText(element.text, locale) || "Overlay text";
   const align = element.align ?? "center";
   const defaultSize = defaultTextElementFontSize(canvas.cW, canvas.cH);
   const range = textElementFontSizeRange(canvas.cW, canvas.cH);
@@ -814,7 +829,8 @@ function TextElementPanel({
           value={text}
     
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

**File**: `skills/app-store-screenshots/template/src/components/editor/slide-canvas.tsx` (modified, +27/-8)
```diff
@@ -198,18 +198,32 @@ function EditableText({
 
   const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
     if (!onChange) return;
-    const text = (e.currentTarget.innerText || "").replace(/\u00a0/g, " ");
+    // A cleared contenteditable keeps a placeholder <br>, which innerText
+    // reports as "\n"; that would save a blank line instead of clearing.
+    const raw = e.currentTarget.textContent ? e.currentTarget.innerText : "";
+    const text = (raw || "").replace(/\u00a0/g, " ");
     onChange(multiline ? text : text.replace(/\n/g, ""));
   };
 
   return (
     <div
       ref={ref}
-      contentEditable={editable}
+      // Per-text base direction: RTL copy (ar, he, fa, ur) keeps its
+      // punctuation on the correct side without flipping LTR locales.
+      dir="auto"
+      // Plain text only: pasted or dropped rich text would otherwise keep its
+      // colours and fonts on the canvas while the export uses the plain copy.
+      contentEditable={editable ? "plaintext-only" : false}
       suppressContentEditableWarning
       data-placeholder={placeholder}
       onInput={handleInput}
       onFocus={() => onFocus?.()}
+      onBlur={(e) => {
+        // Edits skip syncing while focused; catch up so the canvas shows what
+        // will export (e.g. clearing a translation falls back to English).
+        const incoming = value || "";
+        if (e.currentTarget.textContent !== incoming) e.currentTarget.textContent = incoming;
+      }}
       onKeyDown={(e) => {
         if (!multiline && e.key === "Enter") {
           e.preventDefault();
@@ -267,7 +281,8 @@ function Caption({
   // produce headlines so tall they overlap the device frame.
   const unit = Math.min(cW, cH);
   return (
-    <div style={{ textAlign: align, position: "relative", width: "100%" }}>
+    // "start" rather than "left" so a left-set caption hugs the right edge in RTL.
+    <div style={{ textAlign: align === "left" ? "start" : align, position: "relative", width: "100%" }}>
       <EditableText
         value={pickText(slide.label, locale)}
         editable={editable}
@@ -1314,16 +1329,21 @@ function Movable({
     </div>
   );
 
+  // The editor shows the clamped rect, so export and thumbnails must place the
+  // element there too — an out-of-bounds saved rect would otherwise export
+  // somewhere the user never saw it.
+  const display = clampRect(rect, boundsW, boundsH, allowOverflow);
+
   // Non-editable (export/thumb) path: plain absolute-positioned div, no Rnd.
   if (!editable) {
     return (
       <div
         style={{
           position: "absolute",
-          left: rect.x,
-          top: rect.y,
-          width: rect.width,
-          height: rect.height,
+          left: display.x,
+          top: display.y,
+          width: display.width,
+          height: display.height,
           zIndex,
         }}
       >
@@ -1332,7 +1352,6 @@ function Movable({
     );
   }
 
-  const display = clampRect(rect, boundsW, boundsH, allowOverflow);
   const controlScale = Math.max(0.05, previewScale);
 
   return (
```

**File**: `skills/app-store-screenshots/template/src/lib/export-render.ts` (modified, +5/-4)
```diff
@@ -24,6 +24,7 @@
 //    If an image never shows up within the timeout, report it instead of
 //    silently shipping a blank device.
 import { toSvg } from "html-to-image";
+import { encodeCanvasPng } from "./png-encode";
 
 const SETTLE_POLL_MS = 50;
 const SETTLE_TIMEOUT_MS = 8000;
@@ -34,8 +35,8 @@ const SVG_PREFIX = "data:image/svg+xml;charset=utf-8,";
 type Box = { x: number; y: number; w: number; h: number };
 
 export type RenderedSlide = {
-  /** Draw the settled slide at the given export size and return a PNG data URL. */
-  toPng: (w: number, h: number) => string;
+  /** Draw the settled slide at the given export size as opaque 24-bit PNG bytes. */
+  toPng: (w: number, h: number) => Promise<Uint8Array>;
   /** Visible images that never appeared in the render. 0 when all is well. */
   missingImages: number;
 };
@@ -200,7 +201,7 @@ export async function renderSlide(
   return {
     missingImages,
     toPng: (w, h) => {
-      if (w === width && h === height) return canvas.toDataURL("image/png");
+      if (w === width && h === height) return encodeCanvasPng(canvas);
       const { canvas: out, ctx: octx } = createContext(w, h);
       octx.imageSmoothingEnabled = true;
       octx.imageSmoothingQuality = "high";
@@ -211,7 +212,7 @@ export async function renderSlide(
       const dw = width * scale;
       const dh = height * scale;
       octx.drawImage(canvas, (w - dw) / 2, (h - dh) / 2, dw, dh);
-      return out.toDataURL("image/png");
+      return encodeCanvasPng(out);
     },
   };
 }
```

**File**: `skills/app-store-screenshots/template/src/lib/png-encode.ts` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+"use client";
+// Canvas → 24-bit RGB PNG bytes (see png-rgb.ts for why not toDataURL).
+// Encoding a full-size export is ~100ms of filtering and deflate, so it runs
+// on a small worker pool: exports keep rendering the next screen meanwhile.
+// Without workers, or if one fails, the same encoder runs inline.
+import { encodeRgbPixels } from "./png-rgb";
+
+type Job = {
+  worker: Worker;
+  pixels: Uint8ClampedArray;
+  width: number;
+  height: number;
+  resolve: (png: Uint8Array) => void;
+  reject: (error: unknown) => void;
+};
+type Result = { id: number; png?: Uint8Array; error?: string };
+
+let pool: Worker[] | null = null;
+let nextWorker = 0;
+let nextId = 0;
+const jobs = new Map<number, Job>();
+
+function encodeInline(job: Job) {
+  encodeRgbPixels(job.pixels, job.width, job.height).then(job.resolve, job.reject);
+}
+
+function workers(): Worker[] {
+  if (pool) return pool;
+  pool = [];
+  try {
+    const size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
+    for (let i = 0; i < size; i++) {
+      const worker = new Worker(new URL("./png-worker.ts", import.meta.url));
+      worker.onmessage = ({ data }: MessageEvent<Result>) => {
+        const job = jobs.get(data.id);
+        if (!job) return;
+        jobs.delete(data.id);
+        if (data.png) job.resolve(data.png);
+        else encodeInline(job);
+      };
+      // A worker that fails to load or crashes leaves the pool, and its jobs
+      // finish inline instead of leaving the export waiting forever.
+      worker.onerror = (event) => {
+        event.preventDefault();
+        worker.terminate();
+        pool = (pool || []).filter((w) => w !== worker);
+        for (const [id, job] of jobs) {
+          if (job.worker !== worker) continue;
+          jobs.delete(id);
+          encodeInline(job);
+        }
+      };
+      pool.push(worker);
+    }
+  } catch {
+    // Keep any workers that did start; an empty pool means inline encoding.
+  }
+  return pool;
+}
+
+export function encodeCanvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
+  const ctx = canvas.getContext("2d");
+  if (!ctx) return Promise.reject(new Error("Canvas 2D context unavailable"));
+  const { width, height } = canvas;
+  const pixels = ctx.getImageData(0, 0, width, height).data;
+  const available = workers();
+  if (!available.length) return encodeRgbPixels(pixels, width, height);
+  const id = nextId++;
+  const worker = available[nextWorker++ % available.length];
+  return new Promise((resolve, reject) => {
+    jobs.set(id, { worker, pixels, width, height, resolve, reject });
+    // Copied, not transferred: the pixels stay here for the inline fallback.
+    worker.postMessage({ id, pixels, width, height });
+  });
+}
```

---

### Incident Patch 4: `7faf7fcd` (2026-09-27)
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
+ await check('slow autosaves never overlap or overwrite newer state',async()=>{
+   let active=0,maxActive=0; const completed=[];
+   const {page,latest}=await open(fixture(),async data=>{
+     maxActive=Math.max(maxActive,++active);
+     await pause(data.appName==='older'?1800:50);
+     completed.push(data.appName); active--;
+   });
+   await pause(800);
+   await page.getByRole('textbox',{name:'App name',exact:true}).fill('older');
+   await pause(800);
+   await page.getByRole('textbox',{name:'App name',exact:true}).fill('newer');
+   await pause(2600);
+   assert.equal(maxActive,1); assert.equal(latest().appName,'newer');
+   assert.equal(completed.at(-1),'newer'); await page.close();
+ });
+ await check('export locks immediately and through completion, PNG dimensions/locales are correct',async()=>{
+   const {page}=await open(fixture({locales:['en','de']}));
+   let downloadCount=0; page.on('download',()=>downloadCount++);
+   const downloaded=page.waitForEvent('download');

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

**File**: `skills/app-store-screenshots/template/README.md` (modified, +4/-2)
```diff
@@ -39,6 +39,8 @@ Update the matching `screenshot` fields in `app-store-screenshots.json` to point
 
 The toolbar dropdown lists every Apple/Google-required size for the current device. Click **Export bundle** to download a zip. In Connected mode, each PNG is clipped from the connected canvas, so an element that straddles two screens appears split exactly where you placed it. In Isolated mode, each screen clips its own elements and legacy offscreen content cannot leak into neighboring exports.
 
+Exports lock the editor through preparation and bundling and render a fixed project snapshot. Referenced images that cannot be loaded stop the export with an error; empty screenshot fields still produce the existing placeholder warning.
+
 Each screen is rendered once per locale at canvas resolution (`src/lib/export-render.ts`) and scaled to every size; slots whose aspect differs slightly are cover-scaled rather than stretched. Before saving, the exporter redraws until every visible screenshot has painted, because WebKit decodes images inside the html-to-image SVG asynchronously and a single draw can leave device screens blank. If a screenshot never appears, a toast names the screen.
 
 CarPlay has no App Store Connect slot of its own: the CarPlay deck is a head-unit frame on a landscape iPhone canvas and exports landscape iPhone sizes for upload into the iPhone slot.
@@ -55,7 +57,7 @@ The toolbar **Theme** menu recolours the whole deck (backgrounds, text, accents)
 
 The toolbar font menu sets the typeface of the screenshot canvas and exports (not the editor UI). **Inter (default)** is the template font and what projects without a `fontId` use. **System Sans** and **Georgia** are available everywhere; **Avenir Next**, **Helvetica Neue**, **Futura**, **Baskerville**, **Palatino**, **Optima** and **American Typewriter** are macOS system fonts that fall back to similar faces elsewhere, so export on the machine you designed on.
 
-**Import font…** at the bottom of the menu takes a licensed WOFF2, WOFF, TTF or OTF file (16 MB max). `/api/upload-font` checks the file's magic bytes and stores it as `public/fonts/imported/<hash>.<ext>`; the project saves it as `importedFont` with `fontId: "self-hosted"`. Like uploaded screenshots, that folder is gitignored (font licences often forbid redistribution); keep the file alongside the project JSON if you move the project, or screenshot text falls back to a generic sans-serif. Once imported, the font is listed in the menu under its file name, and it is loaded and embedded before every export.
+**Import font…** at the bottom of the menu takes a licensed WOFF2, WOFF, TTF or OTF file (16 MB max). `/api/upload-font` checks the file's magic bytes and stores it as `public/fonts/imported/<hash>.<ext>`; the project saves it as `importedFont` with `fontId: "self-hosted"`. That font folder is gitignored (font licences often forbid redistribution); keep the file alongside the project JSON if you move the project, or screenshot text falls back to a generic sans-serif. Once imported, the font is listed in the menu under its file name, and it is loaded and embedded before every export.
 
 ### Image overlays
 
@@ -81,6 +83,6 @@ The toolbar arrows, `⌘Z` / `Ctrl+Z` and `⇧⌘Z` / `Ctrl+Shift+Z` (or `Ctrl+Y
 - `mockup.png` is the iPhone bezel overlay; replacing it requires re-measuring the `PHONE_SCREEN` constants.
 - Image preloading converts every static path to a base64 data URI before exports run, and export retries paths that were previously missing. `export-render.ts` then waits for those images to paint in the render (see Exporting).
 - Reset via the toolbar's circular arrow icon clears in-memory state and reloads the default screens. To wipe disk state too, delete `app-store-screenshots.json`.
-- **Persistence model** — the canonical state lives in `app-store-screenshots.json` (git-tracked). On load, the editor reads localStorage first for instant paint, then overwrites with the file contents if present; if the file endpoint is unavailable, autosave is blocked so stale cache cannot overwrite disk. On save, both are written. If you ever see a conflict, the file always wins.
+- **Persistence model** — the canonical state lives in `app-store-screenshots.json` (git-tracked). On load, the editor reads localStorage first for instant paint, then overwrites with the file contents if present; if the file endpoint is unavailable, autosave is blocked so stale cache cannot overwrite disk. On save, both are written. File saves are serialized, and the server replaces the JSON atomically so overlapping edits cannot leave a partial file. Invalid project shapes are rejected without overwriting the project. If you ever see a conflict, the file always wins.
 - **Migration model** — schema v1 projects do not need a manual conversion. On first load, the editor upgrades localized text and transform records, writes `schemaVersion: 2`, preserves all existing screens, and keeps `connectedCanvas: false` so old offscre
```

**File**: `skills/app-store-screenshots/template/src/app/api/project/route.ts` (modified, +14/-1)
```diff
@@ -1,6 +1,8 @@
 import { promises as fs } from "node:fs";
 import path from "node:path";
+import { randomUUID } from "node:crypto";
 import { NextResponse } from "next/server";
+import { projectValidationError } from "@/lib/project-validation";
 import { rejectCrossSiteWrite } from "@/lib/request-guard";
 
 export const dynamic = "force-dynamic";
@@ -15,6 +17,8 @@ export async function GET() {
   try {
     const raw = await fs.readFile(filePath(), "utf8");
     const parsed = JSON.parse(raw);
+    const validationError = projectValidationError(parsed);
+    if (validationError) throw new Error(validationError);
     return NextResponse.json({ ok: true, state: parsed });
   } catch (e) {
     const code = (e as NodeJS.ErrnoException).code;
@@ -40,14 +44,23 @@ export async function POST(req: Request) {
   } catch {
     return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
   }
+  const validationError = projectValidationError(body);
+  if (validationError) {
+    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
+  }
+  const temporary = `${filePath()}.${randomUUID()}.tmp`;
   try {
     const pretty = JSON.stringify(body, null, 2) + "\n";
-    await fs.writeFile(filePath(), pretty, "utf8");
+    // Readers must see either the previous complete project or the next one.
+    await fs.writeFile(temporary, pretty, "utf8");
+    await fs.rename(temporary, filePath());
     return NextResponse.json({ ok: true });
   } catch (e) {
     return NextResponse.json(
       { ok: false, error: e instanceof Error ? e.message : String(e) },
       { status: 500 },
     );
+  } finally {
+    await fs.unlink(temporary).catch(() => undefined);
   }
 }
```

**File**: `skills/app-store-screenshots/template/src/components/editor/inspector.tsx` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ export function Inspector({
           </Select>
         </div>
 
-        {!isFeatureGraphic && <BackgroundControls slide={slide} theme={theme} onChange={onChange} />}
+        <BackgroundControls slide={isFeatureGraphic ? { ...slide, inverted: slide.inverted ?? true } : slide} theme={theme} onChange={onChange} />
 
         {!isFeatureGraphic && (
           <div className="space-y-1.5">
```

---

### Incident Patch 5: `75128866` (2026-09-26)
**Commit Message**: Merge pull request #34 from dqstartupbuild/feat/editor-image-background-font-controls

Add richer screenshot editor controls

**File**: `skills/app-store-screenshots/SKILL.md` (modified, +11/-3)
```diff
@@ -18,6 +18,9 @@ Scaffold a pre-built Next.js + ShadCN editor that lets the user design and expor
 - One-click bulk PNG export at every Apple/Google-required resolution via `html-to-image`
 - Light/dark variant toggle per slide, a toolbar theme picker (one palette preset per named style), locale select
 - A **Copy ideas** menu next to the headline field with formulas for hero, differentiator, feature, proof, and closer slides
+- Per-slide custom background colors (caption colours stay readable automatically), a live screenshot font menu, and importing licensed WOFF2/WOFF/TTF/OTF fonts
+- Image overlay elements (logos, badges, photos) with drag/resize/rotation/layering controls and directional edge fades
+- Toolbar Undo/Redo (`⌘Z` / `⇧⌘Z`) over the last 50 edits of the session
 - Guided in-place migration for older projects created by this skill; passive and explicit migrations keep legacy decks isolated until the user intentionally opts into connected canvas
 
 Supported devices out of the box:
@@ -703,6 +706,7 @@ project/
 ├── public/
 │   ├── mockup.png               # iPhone bezel (do NOT replace without re-measuring PHONE_SCREEN)
 │   ├── app-icon.png             # → user supplies
+│   ├── fonts/imported/          # Fonts imported from the toolbar (gitignored, like screenshots/uploaded/)
 │   └── screenshots/...
 └── src/
     ├── app/
@@ -712,21 +716,25 @@ project/
     ├── components/
     │   ├── editor/
     │   │   ├── screenshot-editor.tsx   # Top-level editor (state, autosave, export)
-    │   │   ├── toolbar.tsx             # Platform tabs, device select, theme, locale, export
+    │   │   ├── toolbar.tsx             # Platform tabs, device select, theme, font, locale, undo/redo, export
     │   │   ├── sidebar.tsx             # Screen list with @dnd-kit reordering
     │   │   ├── slide-thumb.tsx         # Draggable screen card
     │   │   ├── preview-stage.tsx       # ResizeObserver-scaled connected canvas
     │   │   ├── inspector.tsx           # Right-pane controls for active slide
     │   │   ├── screenshot-picker.tsx   # File drop + picker
+    │   │   ├── background-controls.tsx # Per-slide theme / alternate / custom background
+    │   │   ├── font-importer.tsx       # Hidden input behind the toolbar's "Import font…"
+    │   │   ├── image-element-canvas.tsx # Image overlay content (+ create-image-mask.ts edge fade)
     │   │   ├── slide-canvas.tsx        # Data-driven screen/deck renderer (all layouts)
     │   │   └── device-frames.tsx       # Phone, IPad, AppleTV, AppleWatch, CarPlayScreen, MacWindow, Android
     │   └── ui/                         # Minimal ShadCN primitives (button, select, etc.)
     └── lib/
-        ├── constants.ts                # Canvas sizes, export sizes, themes, frame ratios
+        ├── constants.ts                # Canvas sizes, export sizes, themes, screenshot fonts, frame ratios
         ├── defaults.ts                 # Initial slide decks per device
         ├── types.ts                    # Slide / ProjectState / Theme types
-        ├── storage.ts                  # useProject() — localStorage autosave hook
+        ├── storage.ts                  # useProject() — autosave + undo/redo history
         ├── image-cache.ts              # preloadImages + img() helper
+        ├── contrast.ts                 # Readable caption colours on custom backgrounds
         ├── export-render.ts            # Slide → PNG; waits for every screenshot to paint
         └── utils.ts                    # cn() helper
 ```
```

**File**: `skills/app-store-screenshots/template/.gitignore` (modified, +5/-0)
```diff
@@ -9,3 +9,8 @@ next-env.d.ts
 # User-uploaded screenshots land here at runtime. They are the user's assets,
 # not template content, and must never be committed back into the template.
 public/screenshots/uploaded/
+
+# Fonts imported from the editor toolbar are user assets too (and font licences
+# often forbid redistributing them), so keep them out of the template as well.
+public/fonts/imported/*
+!public/fonts/imported/.gitkeep
```

**File**: `skills/app-store-screenshots/template/README.md` (modified, +22/-1)
```diff
@@ -13,6 +13,7 @@ bun dev       # http://localhost:3000
 
 - **Connected canvas editor** (`src/components/editor/`) — every screen sits on one horizontal canvas, so phones, captions, and other elements can be dragged across screen boundaries and exported as split crops when Connected mode is enabled.
 - **Screen controls** — drag-to-reorder screens, click-to-edit text, screenshot drop targets, per-screen layout switcher, dark/light toggle.
+- **Image overlays, fonts, backgrounds and undo** — PNG/JPG overlay elements, a live screenshot font menu (with font import), per-screen custom backgrounds, and toolbar Undo/Redo. See [Editor controls](#editor-controls).
 - **Device frames** (`src/components/editor/device-frames.tsx`) — iPhone (PNG mockup), iPad, Apple TV, Apple Watch, CarPlay head unit, Mac window, Android phone, Android tablet (portrait + landscape), feature graphic.
 - **Auto-save (git-trackable)** — every change is persisted within ~600ms to **`app-store-screenshots.json`** at the project root (via `/api/project`) **and** mirrored to `localStorage` as an instant-paint cache. Commit `app-store-screenshots.json` and you can `git clone` to another machine and resume exactly where you left off.
 - **Multi-device decks** — iOS (iPhone, iPad, Apple TV, Apple Watch, CarPlay), Mac, and Android decks live side by side; switching the platform tab keeps each tab's last device.
@@ -44,11 +45,31 @@ CarPlay has no App Store Connect slot of its own: the CarPlay deck is a head-uni
 
 Mac is its own platform tab because App Store Connect lists macOS separately from the iOS app. The Mac deck designs at 2880×1800 and exports the four 16:10 Mac App Store sizes (2880×1800, 2560×1600, 1440×900, 1280×800) to `macos/mac/<WxH>/<locale>/`. The Mac window's content area is exactly 16:10, so a full-screen 16:10 capture fills it uncropped.
 
+## Editor controls
+
+### Themes and backgrounds
+
+The toolbar **Theme** menu recolours the whole deck (backgrounds, text, accents); it doesn't touch copy, layouts or screenshots. Each screen's **Background** control in the inspector picks the theme background, the theme's alternate (dark/light) background, or a **custom colour** (colour picker or hex). A custom colour applies to that screen only and is saved as `backgroundColor` on the slide. When the theme's text or label colour would be hard to read on it (below a 4.5:1 contrast ratio for text, 3:1 for the label), the caption switches to the theme's other text colour, or to near-black / white. Text elements you've given an explicit colour keep it.
+
+### Screenshot fonts
+
+The toolbar font menu sets the typeface of the screenshot canvas and exports (not the editor UI). **Inter (default)** is the template font and what projects without a `fontId` use. **System Sans** and **Georgia** are available everywhere; **Avenir Next**, **Helvetica Neue**, **Futura**, **Baskerville**, **Palatino**, **Optima** and **American Typewriter** are macOS system fonts that fall back to similar faces elsewhere, so export on the machine you designed on.
+
+**Import font…** at the bottom of the menu takes a licensed WOFF2, WOFF, TTF or OTF file (16 MB max). `/api/upload-font` checks the file's magic bytes and stores it as `public/fonts/imported/<hash>.<ext>`; the project saves it as `importedFont` with `fontId: "self-hosted"`. Like uploaded screenshots, that folder is gitignored (font licences often forbid redistribution); keep the file alongside the project JSON if you move the project, or screenshot text falls back to a generic sans-serif. Once imported, the font is listed in the menu under its file name, and it is loaded and embedded before every export.
+
+### Image overlays
+
+In the inspector's **Elements** card, click **Image**, then **Pick** (or drop) a PNG/JPG. Uploads go through `/api/upload` into `public/screenshots/uploaded/`, like screenshots. The first image sizes the overlay frame to its aspect ratio; after that you can drag, resize, rotate (canvas handle or slider), restack, choose **Fill frame** (crop) or **Whole image**, and fade one edge into the background. In Connected mode overlays can cross screen edges like other elements. Overlays are saved per screen as `imageElements`, and the exporter waits for them to paint just like device screenshots. The Play Store feature graphic has a fixed icon + name + tagline layout, so it doesn't take overlays or text elements.
+
+### Undo and redo
+
+The toolbar arrows, `⌘Z` / `Ctrl+Z` and `⇧⌘Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`) step through the last 50 edits of the session: copy, layouts, element moves, text sizes, backgrounds, fonts, themes, overlays and resets. Rapid changes (typing, dragging a slider) collapse into one step. Switching platform, device, orientation or locale isn't an edit, so it doesn't use up an undo step; undoing an edit takes you back to the deck it was made on. While a text field is focused the shortcuts undo that field's typing instead. History resets on reload.
+
 ## Customizing
 
 
```

**File**: `skills/app-store-screenshots/template/public/fonts/imported/.gitkeep` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+
```

**File**: `skills/app-store-screenshots/template/src/app/api/upload-font/route.ts` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import { createHash } from "node:crypto";
+import { promises as fs } from "node:fs";
+import path from "node:path";
+import { NextResponse } from "next/server";
+import { rejectCrossSiteWrite } from "@/lib/request-guard";
+import type { ImportedFont } from "@/lib/types";
+
+export const dynamic = "force-dynamic";
+
+const FONT_DIR_REL = path.join("public", "fonts", "imported");
+const PUBLIC_PREFIX = "/fonts/imported";
+const MAX_FONT_BYTES = 16 * 1024 * 1024;
+
+const FONT_EXT: Record<ImportedFont["format"], string> = {
+  woff2: "woff2",
+  woff: "woff",
+  truetype: "ttf",
+  opentype: "otf",
+};
+
+// The stored format and extension come from the file's magic bytes, never
+// from the caller-supplied filename or MIME type.
+function sniffFontFormat(bytes: Buffer): ImportedFont["format"] | null {
+  if (bytes.length < 4) return null;
+  const tag = bytes.subarray(0, 4);
+  if (tag.equals(Buffer.from("wOF2", "latin1"))) return "woff2";
+  if (tag.equals(Buffer.from("wOFF", "latin1"))) return "woff";
+  if (tag.equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) || tag.equals(Buffer.from("true", "latin1"))) {
+    return "truetype";
+  }
+  if (tag.equals(Buffer.from("OTTO", "latin1"))) return "opentype";
+  return null;
+}
+
+export async function POST(req: Request) {
+  // This route WRITES A FILE to disk. See lib/request-guard.ts.
+  const blocked = rejectCrossSiteWrite(req);
+  if (blocked) {
+    return NextResponse.json({ ok: false, error: blocked.error }, { status: blocked.status });
+  }
+  let body: { data?: unknown };
+  try {
+    body = (await req.json()) as { data?: unknown };
+  } catch {
+    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
+  }
+  if (typeof body?.data !== "string" || !body.data) {
+    return NextResponse.json({ ok: false, error: "Choose a font file first." }, { status: 400 });
+  }
+  // Reject oversized payloads before decoding (base64 is ~4/3 of the byte size).
+  if (body.data.length > Math.ceil(MAX_FONT_BYTES / 3) * 4) {
+    return NextResponse.json({ ok: false, error: "Font file is too large (16MB maximum)." }, { status: 413 });
+  }
+  const bytes = Buffer.from(body.data, "base64");
+  if (bytes.byteLength > MAX_FONT_BYTES) {
+    return NextResponse.json({ ok: false, error: "Font file is too large (16MB maximum)." }, { status: 413 });
+  }
+  const format = sniffFontFormat(bytes);
+  if (!format) {
+    return NextResponse.json({ ok: false, error: "Use a WOFF2, WOFF, TTF, or OTF font file." }, { status: 400 });
+  }
+
+  const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 16);
+  const filename = `${hash}.${FONT_EXT[format]}`;
+  const absDir = path.join(process.cwd(), FONT_DIR_REL);
+  const absFile = path.join(absDir, filename);
+
+  try {
+    await fs.mkdir(absDir, { recursive: true });
+    try {
+      await fs.access(absFile);
+    } catch {
+      await fs.writeFile(absFile, bytes);
+    }
+    const font: ImportedFont = { src: `${PUBLIC_PREFIX}/${filename}`, format };
+    return NextResponse.json({ ok: true, font });
+  } catch (e) {
+    return NextResponse.json(
+      { ok: false, error: e instanceof Error ? e.message : String(e) },
+      { status: 500 },
+    );
+  }
+}
```

**File**: `skills/app-store-screenshots/template/src/components/editor/background-controls.tsx` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+"use client";
+import * as React from "react";
+import { Input } from "@/components/ui/input";
+import { Label } from "@/components/ui/label";
+import {
+  Select,
+  SelectContent,
+  SelectItem,
+  SelectTrigger,
+  SelectValue,
+} from "@/components/ui/select";
+import { cleanHexColor } from "@/lib/clean-hex-color";
+import type { Slide, Theme } from "@/lib/types";
+
+type Props = {
+  slide: Slide;
+  theme: Theme;
+  onChange: (patch: Partial<Slide>) => void;
+};
+
+export function BackgroundControls({ slide, theme, onChange }: Props) {
+  const mode = slide.backgroundColor ? "custom" : slide.inverted ? "alternate" : "theme";
+  const customColor = cleanHexColor(slide.backgroundColor) || cleanHexColor(theme.bg) || "#FFFFFF";
+  // Keep partial hex input local so typing "#0B" or clearing the field doesn't
+  // write an invalid color into the slide (or drop it out of custom mode).
+  const [draft, setDraft] = React.useState(customColor);
+  React.useEffect(() => setDraft(customColor), [customColor]);
+
+  return (
+    <div className="space-y-1.5">
+      <Label className="text-xs">Background</Label>
+      <Select
+        value={mode}
+        onValueChange={(nextMode) => {
+          if (nextMode === "theme") onChange({ inverted: false, backgroundColor: undefined });
+          if (nextMode === "alternate") onChange({ inverted: true, backgroundColor: undefined });
+          if (nextMode === "custom") onChange({ inverted: false, backgroundColor: customColor });
+        }}
+      >
+        <SelectTrigger><SelectValue /></SelectTrigger>
+        <SelectContent>
+          <SelectItem value="theme">Theme background</SelectItem>
+          <SelectItem value="alternate">Theme alternate</SelectItem>
+          <SelectItem value="custom">Custom color</SelectItem>
+        </SelectContent>
+      </Select>
+      {mode === "custom" && (
+        <div className="flex items-center gap-2">
+          <input
+            type="color"
+            value={customColor}
+            onChange={(event) => onChange({ backgroundColor: event.target.value.toUpperCase() })}
+            className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
+            aria-label="Custom background color"
+          />
+          <Input
+            value={draft}
+            onChange={(event) => {
+              const next = event.target.value.toUpperCase();
+              setDraft(next);
+              const color = cleanHexColor(next);
+              if (color) onChange({ backgroundColor: color });
+            }}
+            onBlur={() => setDraft(customColor)}
+            placeholder="#0B0908"
+            className="h-8 font-mono text-xs uppercase"
+            aria-label="Custom background hex color"
+          />
+        </div>
+      )}
+      {mode === "custom" && (
+        <p className="text-[11px] text-muted-foreground">
+          Caption text switches to a readable colour when the theme&apos;s colours would be too faint.
+        </p>
+      )}
+    </div>
+  );
+}
```

**File**: `skills/app-store-screenshots/template/src/components/editor/create-image-mask.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import type { ImageElement } from "@/lib/types";
+
+export function createImageMask(fade: ImageElement["fade"]): string | undefined {
+  if (!fade || fade.amount <= 0) return undefined;
+
+  const amount = Math.max(1, Math.min(100, fade.amount));
+
+  const direction = {
+    top: "to bottom",
+    bottom: "to top",
+    left: "to right",
+    right: "to left",
+  }[fade.edge];
+  const transparentEdge = amount * 0.25;
+  const solidOppositeEdge = amount * 0.75;
+
+  return `linear-gradient(${direction}, transparent 0%, transparent ${transparentEdge}%, #000 ${solidOppositeEdge}%, #000 100%)`;
+}
```

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

---

### Incident Patch 6: `bee50b7b` (2026-09-26)
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

### Incident Patch 7: `b8f1ff10` (2026-09-26)
**Commit Message**: fix: image overlay uploads no longer revert moves; size frame to the image

Image overlay patches were built from the slide captured when the upload
started, so dragging an overlay while its file uploaded was silently undone
when the upload finished. Inspector image edits now go through a functional
onUpdate that patches the latest slide.

The first image picked for an overlay reshapes its frame to the image's
aspect ratio (centred, capped at 60% of the canvas height) so "Fill frame"
no longer crops a wide logo into a square. The Elements card header puts
the Text/Image buttons on their own row and the image panel is flatter.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

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
+      return { imageElements: nextImageElements.length > 0 ? nextImageElements : undefined };
+    });
     onSelectElement(null);
   }
 
@@ -486,35 +512,38 @@ function ElementTransformControls({
 
   return (
     <div className="space-y-3 rounded-md border bg-muted/30 p-3">
-      <div className="flex items-start justify-between gap-2">
-        <div>
+      <div className="space-y-1">
+        <div className="flex items-center justify-between gap-2">
           <Label className="text-xs font-semibold">Elements</Label>
-          <p className="text-[11px] text-muted-foreground">
-            {activeId
-              ? "Fine-tune the selected element's rotation and stacking."
-              : "Click an element on the canvas to fine-tune its rotation and stacking."}
-          </p>
+          <div className="flex items-center gap-1.5">
+            <Button
+              type="button"
+              variant="outline"
+              size="sm"
+              className="h-7 shrink-0 px-2 text-xs"
+              onClick={addTextElement}
+           
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

### Incident Patch 8: `87712d59` (2026-09-26)
**Commit Message**: fix: keep caption text readable on custom slide backgrounds

A custom background kept the theme's text and label colours, so a dark
custom colour on a light theme (or vice versa) produced unreadable
captions. slideColors() keeps the theme colours when they reach 4.5:1
(text) / 3:1 (label) against the custom colour, otherwise falls back to the
theme's other text colour, then near-black or white. Text elements with an
explicit colour are untouched. The Background control notes this.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

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

### Incident Patch 9: `24ffb4cd` (2026-09-26)
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

---

### Incident Patch 10: `6b542ddf` (2026-09-26)
**Commit Message**: docs: describe main's theme presets in the themes guide

The guide listed a 'Mark & Carry' theme that does not exist and omitted
the style presets; point it at the single toolbar theme picker and note
how it relates to the font and per-slide background controls.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `skills/app-store-screenshots/template/docs/themes.md` (modified, +5/-7)
```diff
@@ -1,17 +1,15 @@
 # Themes
 
-Use the **Theme** menu in the toolbar to preview and apply a color system across the entire screenshot deck. Each option shows its background and accent colors before you choose it.
+Use the **Theme** menu in the toolbar to preview and apply a color system across the entire screenshot deck. Each option shows its background, alternate background, and accent colors before you choose it.
 
 Changing a theme updates every slide immediately and saves the selected theme in `app-store-screenshots.json`. It changes the canvas background, text colors, muted text, accent details, and each slide’s alternate background. It does not change screenshot images, text, layouts, or element placement.
 
 ## Included themes
 
-- **Mark & Carry**: warm near-black with cream text and muted rose accents.
-- **Clean Light**: warm off-white with blue accents.
-- **Dark Bold**: deep navy with violet accents.
-- **Warm Editorial**: soft peach with amber accents.
-- **Ocean Fresh**: pale blue with ocean-blue accents.
-- **Bloom Roast**: light stone with forest-green and warm brown accents.
+- Five base palettes: **Clean Light**, **Dark Bold**, **Warm Editorial**, **Ocean Fresh**, and **Bloom Roast**.
+- One preset per named style in `style-prompts/` (for example **Liquid Glass Aurora**, **Swiss Grid Bold**, **Quiet Japandi**). These are flat palettes for the editor; the style prompt still drives fonts, backgrounds, and decoration.
+
+Themes only set colors. Pick the screenshot typeface separately with the **Font** menu (see `screenshot-fonts.md`), and override a single slide with **Background** in the inspector (see `background-controls.md`).
 
 ## Relevant code
 
```

---

### Incident Patch 11: `a1f02061` (2026-09-26)
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

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

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

### Incident Patch 12: `8446c848` (2026-09-26)
**Commit Message**: fix: keep partial hex input from clobbering a slide's custom background

Typing into the custom background hex field wrote every keystroke into
the slide, so an intermediate value like '#0B' rendered as a broken
gradient, and clearing the field set backgroundColor to '' which flipped
the slide out of custom mode and unmounted the input mid-edit. Keep the
text in a local draft and only commit complete #RRGGBB values.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

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

### Incident Patch 13: `cb5c1933` (2026-09-26)
**Commit Message**: fix: render image overlays through Movable and skip empty placeholders on export

Image overlays had their own react-rnd wrapper that diverged from the
shared Movable used by text elements: no rotate handle, no clamping to
the canvas/deck bounds, a stopPropagation on mousedown, and an Rnd
rendered even in the non-editable export path. It also exported the
dashed 'pick an image' placeholder into PNGs when an overlay had no
image yet.

Render overlay content inside Movable like text elements, and only show
the placeholder while editing.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

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

---

### Incident Patch 14: `c4fe3f8c` (2026-09-26)
**Commit Message**: fix: guard font upload route against cross-site writes

Add lib/request-guard.ts (byte-identical to the version in #32) and call
rejectCrossSiteWrite() at the top of POST /api/upload-font, which writes
into public/fonts/imported/. The route previously accepted multipart
form data, which is CORS-simple and can be sent cross-origin without a
preflight, so the client now sends JSON ({ data: <base64> }).

The stored format and extension are now derived from the font's magic
bytes (wOF2, wOFF, 0x00010000/'true', OTTO) instead of the caller's
filename, the size limit is checked before decoding, and an existing
content-hashed file is not rewritten.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `skills/app-store-screenshots/template/src/app/api/upload-font/route.ts` (modified, +70/-20)
```diff
@@ -2,32 +2,82 @@ import { createHash } from "node:crypto";
 import { promises as fs } from "node:fs";
 import path from "node:path";
 import { NextResponse } from "next/server";
+import { rejectCrossSiteWrite } from "@/lib/request-guard";
+import type { ImportedFont } from "@/lib/types";
 
 export const dynamic = "force-dynamic";
 
-const FONT_TYPES = {
-  woff2: { format: "woff2", mime: "font/woff2" },
-  woff: { format: "woff", mime: "font/woff" },
-  ttf: { format: "truetype", mime: "font/ttf" },
-  otf: { format: "opentype", mime: "font/otf" },
-} as const;
+const FONT_DIR_REL = path.join("public", "fonts", "imported");
+const PUBLIC_PREFIX = "/fonts/imported";
+const MAX_FONT_BYTES = 16 * 1024 * 1024;
 
-export async function POST(request: Request) {
-  const form = await request.formData().catch(() => null);
-  const file = form?.get("font");
-  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Choose a font file first." }, { status: 400 });
+const FONT_EXT: Record<ImportedFont["format"], string> = {
+  woff2: "woff2",
+  woff: "woff",
+  truetype: "ttf",
+  opentype: "otf",
+};
 
-  const extension = file.name.split(".").pop()?.toLowerCase() as keyof typeof FONT_TYPES | undefined;
-  const fontType = extension ? FONT_TYPES[extension] : undefined;
-  if (!fontType) return NextResponse.json({ ok: false, error: "Use a WOFF2, WOFF, TTF, or OTF font file." }, { status: 400 });
-  if (file.size > 16 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Font file is too large (16MB maximum)." }, { status: 413 });
+// The stored format and extension come from the file's magic bytes, never
+// from the caller-supplied filename or MIME type.
+function sniffFontFormat(bytes: Buffer): ImportedFont["format"] | null {
+  if (bytes.length < 4) return null;
+  const tag = bytes.subarray(0, 4);
+  if (tag.equals(Buffer.from("wOF2", "latin1"))) return "woff2";
+  if (tag.equals(Buffer.from("wOFF", "latin1"))) return "woff";
+  if (tag.equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) || tag.equals(Buffer.from("true", "latin1"))) {
+    return "truetype";
+  }
+  if (tag.equals(Buffer.from("OTTO", "latin1"))) return "opentype";
+  return null;
+}
+
+export async function POST(req: Request) {
+  // This route WRITES A FILE to disk. See lib/request-guard.ts.
+  const blocked = rejectCrossSiteWrite(req);
+  if (blocked) {
+    return NextResponse.json({ ok: false, error: blocked.error }, { status: blocked.status });
+  }
+  let body: { data?: unknown };
+  try {
+    body = (await req.json()) as { data?: unknown };
+  } catch {
+    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
+  }
+  if (typeof body?.data !== "string" || !body.data) {
+    return NextResponse.json({ ok: false, error: "Choose a font file first." }, { status: 400 });
+  }
+  // Reject oversized payloads before decoding (base64 is ~4/3 of the byte size).
+  if (body.data.length > Math.ceil(MAX_FONT_BYTES / 3) * 4) {
+    return NextResponse.json({ ok: false, error: "Font file is too large (16MB maximum)." }, { status: 413 });
+  }
+  const bytes = Buffer.from(body.data, "base64");
+  if (bytes.byteLength > MAX_FONT_BYTES) {
+    return NextResponse.json({ ok: false, error: "Font file is too large (16MB maximum)." }, { status: 413 });
+  }
+  const format = sniffFontFormat(bytes);
+  if (!format) {
+    return NextResponse.json({ ok: false, error: "Use a WOFF2, WOFF, TTF, or OTF font file." }, { status: 400 });
+  }
 
-  const bytes = Buffer.from(await file.arrayBuffer());
   const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 16);
-  const directory = path.join(process.cwd(), "public", "fonts", "imported");
-  const filename = `${hash}.${extension}`;
+  const filename = `${hash}.${FONT_EXT[format]}`;
+  const absDir = path.join(process.cwd(), FONT_DIR_REL);
+  const absFile = path.join(absDir, filename);
 
-  await fs.mkdir(directory, { recursive: true });
-  await fs.writeFile(path.join(directory, filename), bytes);
-  return NextResponse.json({ ok: true, font: { src: `/fonts/imported/${filename}`, format: fontType.format } });
+  try {
+    await fs.mkdir(absDir, { recursive: true });
+    try {
+      await fs.access(absFile);
+    } catch {
+      await fs.writeFile(absFile, bytes);
+    }
+    const font: ImportedFont = { src: `${PUBLIC_PREFIX}/${filename}`, format };
+    return NextResponse.json({ ok: true, font });
+  } catch (e) {
+    return NextResponse.json(
+      { ok: false, error: e instanceof Error ? e.message : String(e) },
+      { status: 500 },
+    );
+  }
 }
```

**File**: `skills/app-store-screenshots/template/src/components/editor/font-importer.tsx` (modified, +18/-3)
```diff
@@ -10,6 +10,18 @@ type Props = {
   onImported: (font: ImportedFont) => void;
 };
 
+const MAX_FONT_BYTES = 16 * 1024 * 1024;
+
+async function fileToBase64(file: File): Promise<string> {
+  const dataUrl = await new Promise<string>((resolve, reject) => {
+    const reader = new FileReader();
+    reader.onloadend = () => resolve(reader.result as string);
+    reader.onerror = reject;
+    reader.readAsDataURL(file);
+  });
+  return dataUrl.slice(dataUrl.indexOf(",") + 1);
+}
+
 export function FontImporter({ disabled, importedFont, onImported }: Props) {
   const inputRef = React.useRef<HTMLInputElement>(null);
   const [uploading, setUploading] = React.useState(false);
@@ -18,10 +30,13 @@ export function FontImporter({ disabled, importedFont, onImported }: Props) {
   async function importFont(file: File) {
     setUploading(true);
     setError(null);
-    const form = new FormData();
-    form.append("font", file);
     try {
-      const response = await fetch("/api/upload-font", { method: "POST", body: form });
+      if (file.size > MAX_FONT_BYTES) throw new Error("Font file is too large (16MB maximum).");
+      const response = await fetch("/api/upload-font", {
+        method: "POST",
+        headers: { "content-type": "application/json" },
+        body: JSON.stringify({ data: await fileToBase64(file) }),
+      });
       const data = (await response.json()) as { ok: boolean; error?: string; font?: ImportedFont };
       if (!data.ok || !data.font) throw new Error(data.error || "Could not import that font.");
       onImported(data.font);
```

---

### Incident Patch 15: `7ba0e02a` (2026-09-26)
**Commit Message**: docs(mac): document the Mac tab, export path and capture guidance

Keep README.md, SKILL.md and the template README consistent: Mac is its
own tab exporting to macos/mac/<WxH>/<locale>/, the four 16:10 sizes,
a 16:10 window content area, full-screen vs single-window captures (a
window capture brings its own title bar), and the Mac starter layouts.
Mac is no longer told to always use split-landscape, and the Apple
table no longer repeats each Mac size twice.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +7/-8)
```diff
@@ -26,8 +26,8 @@ Example screenshots generated with this skill were accepted for [Bloom Coffee Sh
 - **Screen sidebar** - add, select, and drag-to-reorder screens with live thumbnails.
 - **Inspector** - edit layout, labels, headlines, screenshots, element stacking, and transforms from the right panel. A **Copy ideas** menu next to the headline drops in a proven formula to rewrite.
 - **Theme picker** - switch palette presets from the toolbar, including one preset per named style.
-- **Platform switcher** - keep iOS, Mac, and Android decks side by side while sharing the same editor workflow.
-- **Device selector** - design for iPhone, iPad, Apple TV, Apple Watch, CarPlay, Mac, Android phone, Android tablets, and feature graphic formats.
+- **Platform switcher** - iOS, Mac, and Android tabs keep every deck side by side while sharing the same editor workflow.
+- **Device selector** - iPhone, iPad, Apple TV, Apple Watch, and CarPlay under iOS; Android phone, Android tablets, and the feature graphic under Android. The Mac tab is a single 16:10 Mac deck.
 - **Autosave** - writes to disk through `/api/project` and mirrors to `localStorage` for instant reloads.
 - **Export bundle** - downloads a zip organized by platform, device, resolution, and locale.
 
@@ -189,12 +189,11 @@ App Store Connect has no CarPlay screenshot slot: CarPlay shots are uploaded int
 
 ### Mac App Store
 
-| Display | Resolution |
-|---------|------------|
-| 2880 × 1800 | 2880 x 1800 |
-| 2560 × 1600 | 2560 x 1600 |
-| 1440 × 900 | 1440 x 900 |
-| 1280 × 800 | 1280 x 800 |
+| Device | Resolution |
+|--------|------------|
+| Mac (16:10) | 2880 x 1800, 2560 x 1600, 1440 x 900, 1280 x 800 |
+
+Mac has its own **Mac** tab because App Store Connect lists macOS as a separate platform from the iOS app. Its bundle exports to `macos/mac/<WxH>/<locale>/`, next to `ios/...` and `android/...`. The Mac window frame has a 16:10 content area, so a full-screen 16:10 capture fills it without cropping.
 
 ### Google Play Store
 
```

**File**: `skills/app-store-screenshots/SKILL.md` (modified, +17/-5)
```diff
@@ -26,7 +26,7 @@ Supported devices out of the box:
 - **Apple TV** (landscape, 4K + HD) — Apple App Store
 - **Apple Watch** (portrait, every Ultra/Series size) — Apple App Store
 - **CarPlay** (landscape head unit) — uploaded into the **iPhone** slot; see "Apple TV, Apple Watch and CarPlay" under Step 5
-- **Mac** (16:10) — Mac App Store (`2880×1800`, `2560×1600`, `1440×900`, `1280×800`)
+- **Mac** (16:10 landscape, own **Mac** tab) — Mac App Store (`2880×1800`, `2560×1600`, `1440×900`, `1280×800`); see "Mac" under Step 5
 - **Android Phone** (portrait) — Google Play
 - **Android Tablet 7"** (portrait + landscape) — Google Play
 - **Android Tablet 10"** (portrait + landscape) — Google Play
@@ -587,7 +587,7 @@ The editor stores headlines and labels per-locale on each slide — switch to a
 
 ## Step 5: Export Time
 
-Inside the editor, the user picks a device, then hits **Export bundle**. A single zip downloads with every required size × every project locale for that device, organized as `<platform>/<device>/<WxH>/<locale>/NN-<layout>.png`. Repeat per device.
+Inside the editor, the user picks a device, then hits **Export bundle**. A single zip downloads with every required size × every project locale for that device, organized as `<platform>/<device>/<WxH>/<locale>/NN-<layout>.png` (e.g. `ios/iphone/1320x2868/en/01-hero.png`, `macos/mac/2880x1800/en/01-hero.png`). Repeat per device.
 
 When `connectedCanvas` is enabled, exports are crops of the connected canvas, not isolated screen renders. If a mockup sits halfway across screen 2 and screen 3, screen 2's PNG contains its left crop and screen 3's PNG contains its right crop exactly as placed. Legacy decks should start with `connectedCanvas: false`, including Step 0 migrations, so old offscreen/clipped elements export as they did before. The user can turn on **Connected** after intentionally composing cross-screen elements.
 
@@ -622,6 +622,17 @@ Every Apple TV and Apple Watch size below was read from App Store Connect's own
 - **Layouts:** `split-landscape` (caption left, device right) is the strongest layout for the wide TV and CarPlay canvases. On the watch, keep headlines to two or three short words per line — the canvas is only 422 px wide.
 - **Screenshots:** use real captures at native resolution — Apple TV 3840×2160 or 1920×1080 from the tvOS simulator, Apple Watch from the watchOS simulator, CarPlay from the CarPlay Simulator (or Xcode's I/O → External Displays → CarPlay).
 
+### Mac
+
+| Device | Display type | Accepted sizes | Canvas |
+|---|---|---|---|
+| Mac | `APP_DESKTOP` | 2880×1800, 2560×1600, 1440×900, 1280×800 (16:10 landscape only) | 2880×1800 |
+
+- **Mac is its own toolbar tab** (iOS / Mac / Android), not a device under iOS: App Store Connect lists macOS as a separate platform with its own screenshot set, so the Mac bundle exports to `macos/mac/<WxH>/<locale>/` rather than inside `ios/`. Every Mac size is an exact 16:10 downscale of the canvas; nothing is trimmed.
+- **The Mac window is contained** like the TV and CarPlay frames, and its content area below the title bar is exactly 16:10, so a full-screen 16:10 capture fills it without cropping. Other aspects are cover-cropped from the bottom (the top of the window stays visible).
+- **Screenshots:** a full-screen capture (⌘⇧3) at a 16:10 resolution is the cleanest source. Notched MacBook Pros capture at ~1.54:1, which loses a few percent off the bottom (the Dock). A single-window capture (⌘⇧4, then Space) already has its own title bar, so the frame would draw a second one: crop the window's title bar off first, or use a full-screen capture.
+- **Layouts:** the starter deck is `hero` → `split-landscape` → `device-top` (inverted) → `two-devices` → `no-device`. Because the window is contained, `hero` and `device-bottom` look almost the same; prefer `split-landscape` or `two-devices` (two overlapping windows) for variety.
+
 ## Step 6: Final QA Gate
 
 ### Message Quality
@@ -631,8 +642,8 @@ Every Apple TV and Apple Watch size below was read from App Store Connect's own
 
 ### Visual Quality
 - No two adjacent slides share the same layout
-- Landscape tablet and Mac slides use `split-landscape` — never two devices side-by-side
-- Apple TV and CarPlay decks lead with `split-landscape` or `hero`; Watch headlines fit on the 422 px canvas without wrapping mid-phrase
+- Landscape tablet slides use `split-landscape` — never two devices side-by-side
+- Apple TV, CarPlay and Mac decks lead with `split-landscape` or `hero`; Watch headlines fit on the 422 px canvas without wrapping mid-phrase
 - At least one contrast (`inverted: true`) slide when the deck is long enough
 - For decks with 5+ slides, either one cross-screen/cross-canvas moment exists or there is a clear reason to keep every screen isolated
 - Cross-screen moments are limited to adjacent screens and never split text, required info, faces, or critical UI
@@ -656,6 +667,7 @@ Every Apple TV and Apple Watch size below was read from App Sto
```

**File**: `skills/app-store-screenshots/template/README.md` (modified, +3/-1)
```diff
@@ -15,7 +15,7 @@ bun dev       # http://localhost:3000
 - **Screen controls** — drag-to-reorder screens, click-to-edit text, screenshot drop targets, per-screen layout switcher, dark/light toggle.
 - **Device frames** (`src/components/editor/device-frames.tsx`) — iPhone (PNG mockup), iPad, Apple TV, Apple Watch, CarPlay head unit, Mac window, Android phone, Android tablet (portrait + landscape), feature graphic.
 - **Auto-save (git-trackable)** — every change is persisted within ~600ms to **`app-store-screenshots.json`** at the project root (via `/api/project`) **and** mirrored to `localStorage` as an instant-paint cache. Commit `app-store-screenshots.json` and you can `git clone` to another machine and resume exactly where you left off.
-- **Multi-device decks** — iOS, Mac, and Android slide decks live side by side; switching the platform tab preserves all three.
+- **Multi-device decks** — iOS (iPhone, iPad, Apple TV, Apple Watch, CarPlay), Mac, and Android decks live side by side; switching the platform tab keeps each tab's last device.
 - **One-click export** — bulk PNG export at any required App Store / Play Store resolution using `html-to-image`; each PNG is rendered from the current connected or isolated deck mode.
 - **Project migration** — older `app-store-screenshots.json` files are migrated on load. Existing per-slide transforms remain valid, and connected crops become available without rewriting the deck by hand.
 - **Legacy-safe mode** — pre-v2 projects opened directly in the editor start in isolated-screen mode first, then can opt into connected crops with the toolbar's Connected/Isolated control. Skill-run in-place migrations keep legacy decks isolated unless the project had already explicitly opted into connected canvas.
@@ -42,6 +42,8 @@ Each screen is rendered once per locale at canvas resolution (`src/lib/export-re
 
 CarPlay has no App Store Connect slot of its own: the CarPlay deck is a head-unit frame on a landscape iPhone canvas and exports landscape iPhone sizes for upload into the iPhone slot.
 
+Mac is its own platform tab because App Store Connect lists macOS separately from the iOS app. The Mac deck designs at 2880×1800 and exports the four 16:10 Mac App Store sizes (2880×1800, 2560×1600, 1440×900, 1280×800) to `macos/mac/<WxH>/<locale>/`. The Mac window's content area is exactly 16:10, so a full-screen 16:10 capture fills it uncropped.
+
 ## Customizing
 
 | Where | What |
```

#### Recent Merged Pull Requests:
- **PR #39** (2026-10-03): Add Style Lab, Scene Playground and magnifier (@ParthJadhav)
- **PR #38** (2026-10-02): docs: add anonymized navigation retrospective (@ParthJadhav)
- **PR #37** (2026-09-26): Add Mac App Store screenshot support (@h-elbeheiry)
- **PR #34** (2026-09-26): Add richer screenshot editor controls (@dqstartupbuild)
- **PR #33** (2026-09-26): Add Apple TV, Apple Watch and CarPlay devices, plus a post-export check (@intrepidsilence)
- **PR #32** (2026-09-26): fix: reject cross-site writes on the disk-writing API routes (@intrepidsilence)
- **PR #31** (2026-09-26): Move template to Next 16 (@intrepidsilence)
- **PR #28** (closed): feat: ship schema v3 screenshot editor (@ParthJadhav)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
