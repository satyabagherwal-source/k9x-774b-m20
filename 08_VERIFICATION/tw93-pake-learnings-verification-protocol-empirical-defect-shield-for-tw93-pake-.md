# Verification Protocol: Verification Protocol: Empirical Defect Shield for tw93-pake-learnings

<!-- PROVENANCE_START
{
  "source_repository": "tw93-pake-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T18:33:07.783Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tw93-pake-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93-pake-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T18:33:07.783Z`  
> **Learning ID**: `LEARN-EVO-tw93-pake-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `tw93-pake-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-pake-learnings.md`  
> **Source**: github ([https://github.com/tw93/Pake](https://github.com/tw93/Pake))  
> **Source Version**: `1382507e`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T18:32:58.041Z  
> **Learning ID**: `learn-github-tw93-pake`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tw93/Pake

> **Canonical Artifact**: `07_PROJECT_LEARNING/tw93-pake-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tw93/Pake](https://github.com/tw93/Pake))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T18:32:58.034Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Pake`
- **Description**: Turn any website into a lightweight desktop app with one command, on macOS, Windows and Linux.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 63856 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bin/utils/combine.ts`
```
import fs from 'fs/promises';

export default async function combineFiles(files: string[], output: string) {
  const contents = await Promise.all(
    files.map(async (file) => {
      if (file.endsWith('.css')) {
        const fileContent = await fs.readFile(file, 'utf-8');
        return `window.addEventListener('DOMContentLoaded', (_event) => {
        const css = ${JSON.stringify(fileContent)};
        if (typeof window.__PAKE_INJECT_STYLE__ === 'function') {
          window.__PAKE_INJECT_STYLE__(css);
        } else {
          const style = document.createElement('style');
          style.textContent = css;
          document.head.appendChild(style);
        }
      });`;
      }

      const fileContent = await fs.readFile(file);
      // Keep the closing `});` on its own line. If the injected file ends in a
      // line comment without a trailing newline, appending ` });` on the same
      // line would comment it out and break the wrapper (mirrors the .css
      // branch above, which already closes on a separate line).
      return (
        "window.addEventListener('DOMContentLoaded', (_event) => {\n" +
        fileContent +
        '\n});'
      );
    }),
  );
  await fs.writeFile(output, contents.join('\n'));
  return files;
}

```

### Core Architecture Module: `bin/utils/dir.ts`
```
import path from 'path';
import { fileURLToPath } from 'url';

// Convert the current module URL to a file path
const currentModulePath = fileURLToPath(import.meta.url);

// Resolve the parent directory of the current module
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

### Core Architecture Module: `bin/utils/error.ts`
```
import type { PakeErrorCode } from './output';

/**
 * Error class used for user-facing CLI errors.
 *
 * The top-level catch in `bin/cli.ts` prints `message` directly without a
 * stack trace and exits with the code mapped from `code` (see
 * ERROR_EXIT_CODES in utils/output.ts). Use this for predictable failures
 * (invalid names, missing files, etc.) so users see a clean message instead
 * of a Node.js stack dump. `code` and `hint` also feed the `--json` result.
 */
export class PakeError extends Error {
  readonly isUserError = true;
  readonly code?: PakeErrorCode;
  readonly hint?: string;

  constructor(
    message: string,
    options?: { code?: PakeErrorCode; hint?: string },
  ) {
    super(message);
    this.name = 'PakeError';
    this.code = options?.code;
    this.hint = options?.hint;
  }
}

export function isPakeError(error: unknown): error is PakeError {
  return (
    error instanceof PakeError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { isUserError?: boolean }).isUserError === true)
  );
}

```

### Core Architecture Module: `bin/utils/ico.ts`
```
import path from 'path';
import fsExtra from 'fs-extra';

type Sharp = (typeof import('sharp'))['default'];

async function loadSharp(): Promise<Sharp> {
  return (await import('sharp')).default;
}

const ICO_HEADER_SIZE = 6;
const ICO_DIR_ENTRY_SIZE = 16;
const ICO_TYPE_ICON = 1;
// Standard Windows icon sizes covering tray (16/24/32), taskbar (32/48),
// shell (48/256) and high-DPI (128/256). Issue #1190.
export const WIN_STANDARD_ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;

type IcoEntry = {
  index: number;
  width: number;
  height: number;
  bitCount: number;
  bytesInRes: number;
  imageOffset: number;
  directory: Buffer;
  data: Buffer;
};

function decodeDimension(value: number): number {
  return value === 0 ? 256 : value;
}

function compareByPreferredSize(
  preferredSize: number,
): (a: IcoEntry, b: IcoEntry) => number {
  return (a, b) => {
    const aSize = Math.max(a.width, a.height);
    const bSize = Math.max(b.width, b.height);

    const aExact = aSize === preferredSize ? 0 : 1;
    const bExact = bSize === preferredSize ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;

    const aDistance = Math.abs(aSize - preferredSize);
    const bDistance = Math.abs(bSize - preferredSize);
    if (aDistance !== bDistance) return aDistance - bDistance;

    const aSmaller = aSize < preferredSize ? 1 : 0;
    const bSmaller = bSize < preferredSize ? 1 : 0;
    if (aSmaller !== bSmaller) return aSmaller - bSmaller;

    if (a.bitCount !== b.bitCount) return b.bitCount - a.bitCount;
    if (aSize !== bSize) return bSize - aSize;

    return a.index - b.index;
  };
}

function parseIcoBuffer(buffer: Buffer): IcoEntry[] {
  if (buffer.length < ICO_HEADER_SIZE) {
    throw new Error('Invalid ICO: header too short.');
  }

  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);

  if (reserved !== 0 || type !== ICO_TYPE_ICON || count < 1) {
    throw new Error('Invalid ICO: invalid header.');
  }

  const tableSize = ICO_HEADER_SIZE + count * ICO_DIR_ENTRY_SIZE;
  if (buffer.length < tableSize) {
    throw new Error('Invalid ICO: directory table too short.');
  }

  const entries: IcoEntry[] = [];

  for (let i = 0; i < count; i++) {
    const offset = ICO_HEADER_SIZE + i * ICO_DIR_ENTRY_SIZE;
    const widthByte = buffer.readUInt8(offset);
    const heightByte = buffer.readUInt8(offset + 1);
    const bitCount = buffer.readUInt16LE(offset + 6);
    const bytesInRes = buffer.readUInt32LE(offset + 8);
    const imageOffset = buffer.readUInt32LE(offset + 12);

    if (bytesInRes < 1 || imageOffset + bytesInRes > buffer.length) {
      throw new Error('Invalid ICO: frame out of bounds.');
    }

    entries.push({
      index: i,
      width: decodeDimension(widthByte),
      height: decodeDimension(heightByte),
      bitCount,
      bytesInRes,
      imageOffset,
      directory: buffer.subarray(offset, offset + ICO_DIR_ENTRY_SIZE),
      data: buffer.subarray(imageOffset, imageOffset + bytesInRes),
    });
  }

  return entries;
}

function buildReorderedIcoBuffer(
  buffer: Buffer,
  preferredSize: number,
): Buffer {
  const entries = parseIcoBuffer(buffer);
  const ordered = [...entries].sort(compareByPreferredSize(preferredSize));
  const count = ordered.length;
  const tableSize = ICO_HEADER_SIZE + count * ICO_DIR_ENTRY_SIZE;
  const payloadSize = ordered.reduce(
    (acc, entry) => acc + entry.data.length,
    0,
  );
  const output = Buffer.alloc(tableSize + payloadSize);

  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(ICO_TYPE_ICON, 2);
  output.writeUInt16LE(count, 4);

  let currentOffset = tableSize;
  for (let i = 0; i < count; i++) {
    const entry = ordered[i];
    const entryOffset = ICO_HEADER_SIZE + i * ICO_DIR_ENTRY_SIZE;

    entry.directory.copy(output, entryOffset, 0, 8);
    output.writeUInt32LE(entry.data.length, entryOffset + 8);
    output.writeUInt32LE(currentOffset, entryOffset + 12);
    entry.data.copy(output, currentOffset);
    currentOffset += entry.data.length;
  }

  return output;
}

export async function writeIcoWithPreferredSize(
  sourcePath: string,
  outputPath: string,
  preferredSize: number,
): Promise<boolean> {
  try {
    const sourceBuffer = await fsExtra.readFile(sourcePath);
    const reordered = buildReorderedIcoBuffer(sourceBuffer, preferredSize);
    await fsExtra.ensureDir(path.dirname(outputPath));
    await fsExtra.outputFile(outputPath, reordered);
    return true;
  } catch {
    return false;
  }
}

/**
 * PNG signature `\x89PNG`. ICO frames may carry either a BMP DIB or an
 * embedded PNG payload (PNG-in-ICO, supported since Windows Vista).
 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function frameLooksLikePng(entry: IcoEntry): boolean {
  return (
    entry.data.length >= PNG_SIGNATURE.length &&
    entry.data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  );
}

async function decodeFrameToPng(entry: IcoEntry): Promise<Buffer | null> {
  if (frameLooksLikePng(entry)) {
    return Buffer.from(entry.data);
  }
  // BMP DIB frames need to go through sharp's ico-to-PNG path, which only
  // works on the full ICO container. Fall back to letting the caller use a
  // sharp pipeline against the original ICO for the missing source.
  return null;
}

async function pickLargestFrameAsPng(
  buffer: Buffer,
  entries: IcoEntry[],
): Promise<Buffer | null> {
  const largest = [...entries].sort(
    (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height),
  )[0];
  if (largest) {
    const decoded = await decodeFrameToPng(largest);
    if (decoded) {
      return decoded;
    }
  }

  // Fallback: let sharp render directly from the ICO buffer. sharp picks the
  // largest embedded frame on its own.
  try {
    const sharp = await loadSharp();
    return await sharp(buffer).png().toBuffer();
  } catch {
    return null;
  }
}

/**
 * Ensures the produced ICO carries every Windows standard size so the OS
 * never has to downsample a 256x256 frame to 16x16 for the tray.
 * Falls back to `writeIcoWithPreferredSize` if rendering fails.
 *
 * Issue #1190.
 */
export async function ensureMultiResolutionIco(
  sourcePath: string,
  outputPath: string,
  preferredSize: number = 256,
  desiredSizes: readonly number[] = WIN_STANDARD_ICO_SIZES,
): Promise<boolean> {
  try {
    const sourceBuffer = await fsExtra.readFile(sourcePath);
    const entries = parseIcoBuffer(sourceBuffer);

    const sourcePng = await pickLargestFrameAsPng(sourceBuffer, entries);
    if (!sourcePng) {
      return await writeIcoWithPreferredSize(
        sourcePath,
        outputPath,
        preferredSize,
      );
    }

    const sharp = await loadSharp();
    const frames = await Promise.all(
      desiredSizes.map(async (size) => {
        // Reuse an existing exact-size PNG frame when possible to keep any
        // hand-tuned small icon (e.g. a 16x16 with deliberate pixel hinting).
        const exact = entries.find(
          (entry) => entry.width === size && entry.height === size,
        );
        if (exact && frameLooksLikePng(exact)) {
          return { size, png: Buffer.from(exact.data) };
        }
        const png = await sharp(sourcePng)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .ensureAlpha()
          .png()
          .toBuffer();
        return { size, png };
      }),
    );

    // Order frames so the preferred size lands first (Windows shell uses the
    // first-listed frame as a quality hint when choosing which to display).
    frames.sort((a, b) => {
      const aExact = a.size === preferredSize ? 0 : 1;
      const bExact = b.size === preferredSize ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return b.size - a.size;
    });

    const icoBuffer = buildIcoFromPngBuffers(frames);
    await fsExtra.ensureDir(path.dirname(outputPath));
    await fsExtra.outputFile(outputPath, icoBuffer);
    return true;
  } catch {
    return await writeIcoWithPreferredSize(
      sourcePath,
      outputPath,
      preferredSize,
    );
  }
}

/**
 * Builds an ICO file from an array of PNG buffers using the PNG-in-ICO format
 * (supported since Windows Vista). This preserves alpha transparency.
 */
export function buildIcoFromPngBuffers(
  frames: Array<{ size: number; png: Buffer }>,
): Buffer {
  const count = frames.length;
  const headerSize = ICO_HEADER_SIZE + count * ICO_DIR_ENTRY_SIZE;
  const totalPayload = frames.reduce((acc, f) => acc + f.png.length, 0);
  const output = Buffer.alloc(headerSize + totalPayload);

  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(ICO_TYPE_ICON, 2);
  output.writeUInt16LE(count, 4);

  let currentOffset = headerSize;
  for (let i = 0; i < count; i++) {
    const { size, png } = frames[i];
    const entryOffset = ICO_HEADER_SIZE + i * ICO_DIR_ENTRY_SIZE;
    const sizeByte = size >= 256 ? 0 : size;

    output.writeUInt8(sizeByte, entryOffset);
    output.writeUInt8(sizeByte, entryOffset + 1);
    output.writeUInt8(0, entryOffset + 2);
    output.writeUInt8(0, entryOffset + 3);
    output.writeUInt16LE(1, entryOffset + 4);
    output.writeUInt16LE(32, entryOffset + 6);
    output.writeUInt32LE(png.length, entryOffset + 8);
    output.writeUInt32LE(currentOffset, entryOffset + 12);

    png.copy(output, currentOffset);
    currentOffset += png.length;
  }

  return output;
}

```

### Core Architecture Module: `bin/utils/icon-source.ts`
```
import * as psl from 'psl';

export type IconSource = 'dashboard' | 'domain';

const LOCAL_HOST_SUFFIXES = [
  '.local',
  '.lan',
  '.internal',
  '.home',
  '.localdomain',
] as const;

const IPV4_ADDRESS_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function simplify(value: string): string {
  return normalize(value).replace(/[\s._-]+/g, '');
}

export function generateDashboardIconSlugs(appName: string): string[] {
  const normalizedName = normalize(appName);
  if (!normalizedName) {
    return [];
  }

  const slugs = new Set<string>([
    normalizedName,
    normalizedName.replace(/\s+/g, '-'),
  ]);

  return [...slugs].filter(Boolean);
}

export function isLikelyLocalHostname(hostname: string): boolean {
  const normalizedHostname = normalize(hostname);
  if (!normalizedHostname) {
    return false;
  }

  return (
    normalizedHostname === 'localhost' ||
    IPV4_ADDRESS_PATTERN.test(normalizedHostname) ||
    normalizedHostname.includes(':') ||
    !normalizedHostname.includes('.') ||
    LOCAL_HOST_SUFFIXES.some((suffix) => normalizedHostname.endsWith(suffix))
  );
}

export function shouldPreferDashboardIcons(
  url: string,
  appName: string,
): boolean {
  if (!appName) {
    return false;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (!hostname) {
      return false;
    }

    if (isLikelyLocalHostname(hostname)) {
      return true;
    }

    const parsed = psl.parse(hostname);
    if (!('domain' in parsed) || !parsed.domain) {
      return true;
    }

    const registrableDomain = parsed.domain.toLowerCase();
    if (hostname === registrableDomain) {
      return false;
    }

    const subdomain =
      'subdomain' in parsed && typeof parsed.subdomain === 'string'
        ? parsed.subdomain
        : '';
    if (!subdomain) {
      return false;
    }

    const productLabel = subdomain.split('.').pop() || '';
    const rootLabel = registrableDomain.split('.')[0] || '';
    const normalizedAppName = simplify(appName);

    return (
      normalizedAppName.length > 0 &&
      simplify(productLabel) === normalizedAppName &&
      simplify(rootLabel) !== normalizedAppName
    );
  } catch {
    return false;
  }
}

export function getIconSourcePriority(
  url: string,
  appName: string,
): IconSource[] {
  return shouldPreferDashboardIcons(url, appName)
    ? ['dashboard', 'domain']
    : ['domain', 'dashboard'];
}

```

### Core Architecture Module: `bin/utils/info.ts`
```
import crypto from 'crypto';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import { isMachineMode } from './output';

// Generates a stable identifier based on the app URL (and optionally name).
// When name is provided it is included in the hash so two apps wrapping
// the same URL can coexist. Omitting name preserves backward compatibility
// with identifiers generated before V3.10.1.
export function getIdentifier(url: string, name?: string) {
  const hashInput = name ? `${url}::${name}` : url;
  const postFixHash = crypto
    .createHash('md5')
    .update(hashInput)
    .digest('hex')
    .substring(0, 6);
  return `com.pake.a${postFixHash}`;
}

export function resolveIdentifier(
  url: string,
  explicitName: string | undefined,
  customIdentifier?: string,
) {
  const trimmedIdentifier = customIdentifier?.trim();
  if (trimmedIdentifier) {
    if (!/^[a-zA-Z][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(trimmedIdentifier)) {
      throw new Error(
        `Invalid identifier "${trimmedIdentifier}". Must start with a letter, ` +
          `contain only letters, digits, hyphens, and dots, and end with a letter or digit.`,
      );
    }
    return trimmedIdentifier;
  }

  return getIdentifier(url, explicitName);
}

export async function promptText(
  message: string,
  initial?: string,
): Promise<string> {
  const response = await prompts({
    type: 'text',
    name: 'content',
    message,
    initial,
  });
  return response.content;
}

export function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function getSpinner(text: string) {
  const loadingType = {
    interval: 80,
    frames: ['✦', '✶', '✺', '✵', '✸', '✹', '✺'],
  };
  return ora({
    text: `${chalk.cyan(text)}\n`,
    spinner: loadingType,
    color: 'cyan',
    // In machine mode stdout must stay parseable and stderr low-noise.
    isSilent: isMachineMode(),
  }).start();
}

```

### Core Architecture Module: `bin/utils/mirror.ts`
```
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export const CN_MIRROR_ENV = 'PAKE_USE_CN_MIRROR';

export function isCnMirrorEnabled(value = process.env[CN_MIRROR_ENV]): boolean {
  return TRUE_VALUES.has((value ?? '').trim().toLowerCase());
}

```

### Core Architecture Module: `bin/utils/name.ts`
```
export function generateSafeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 255);
}

export function getSafeAppName(name: string): string {
  return generateSafeFilename(name).toLowerCase();
}

export function generateLinuxPackageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function generateIdentifierSafeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '').toLowerCase();

  if (cleaned === '') {
    const fallback = Array.from(name)
      .map((char) => {
        const code = char.charCodeAt(0);
        if (
          (code >= 48 && code <= 57) ||
          (code >= 65 && code <= 90) ||
          (code >= 97 && code <= 122)
        ) {
          return char.toLowerCase();
        }
        return code.toString(16);
      })
      .join('')
      .slice(0, 50);

    return fallback || 'pake-app';
  }

  return cleaned;
}

```

### Core Architecture Module: `bin/utils/output.ts`
```
import chalk from 'chalk';
import log from 'loglevel';

/**
 * Machine-readable output support (`--json`).
 *
 * In machine mode stdout carries exactly one JSON result object; every log,
 * spinner, and subprocess output is routed to stderr so automation and AI
 * agents can `JSON.parse(stdout)` without scraping terminal text.
 */

export type PakeErrorCode =
  | 'INVALID_INPUT'
  | 'ENV_MISSING'
  | 'BUILD_FAILED'
  | 'NETWORK'
  | 'UNEXPECTED';

// Stable exit-code contract: 0 success, 2 invalid input, 3 build/network
// failure, 4 missing environment, 1 unexpected. Documented in cli-usage docs.
export const ERROR_EXIT_CODES: Record<PakeErrorCode, number> = {
  INVALID_INPUT: 2,
  BUILD_FAILED: 3,
  NETWORK: 3,
  ENV_MISSING: 4,
  UNEXPECTED: 1,
};

export interface BuildArtifact {
  path: string;
  sizeBytes: number;
  format: string;
}

export interface PakeJsonResult {
  ok: boolean;
  name: string | null;
  platform: NodeJS.Platform;
  arch: string | null;
  outputs: BuildArtifact[];
  warnings: string[];
  error: {
    code: PakeErrorCode;
    message: string;
    hint: string | null;
  } | null;
}

let machineMode = false;
const capturedWarnings: string[] = [];

/**
 * Route all loglevel output to stderr, capture warnings for the final JSON
 * result, and strip ANSI colors. Must be called before any logging happens.
 */
export function enableMachineMode(): void {
  if (machineMode) return;
  machineMode = true;
  chalk.level = 0;
  log.methodFactory = (methodName) => {
    return (...args: unknown[]) => {
      if (methodName === 'warn') {
        capturedWarnings.push(args.map(String).join(' '));
      }
      console.error(...args);
    };
  };
  // Rebuild logging methods with the new factory.
  log.setLevel(log.getLevel());
}

export function isMachineMode(): boolean {
  return machineMode;
}

export function getCapturedWarnings(): string[] {
  return [...capturedWarnings];
}

/**
 * Whether Pake may prompt the user. False in machine mode, without a TTY,
 * or inside CI, where prompts would hang or produce garbage.
 */
export function isInteractive(): boolean {
  return (
    !machineMode &&
    Boolean(process.stdin.isTTY) &&
    Boolean(process.stdout.isTTY) &&
    !process.env.CI &&
    !process.env.GITHUB_ACTIONS
  );
}

export function printJsonResult(result: PakeJsonResult): void {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

```

### Core Architecture Module: `bin/utils/platform.ts`
```
import fs from 'fs';

const { platform } = process;

export const IS_MAC = platform === 'darwin';
export const IS_WIN = platform === 'win32';
export const IS_LINUX = platform === 'linux';

export type LinuxPackageFamily = 'deb' | 'rpm';

// Distro IDs / ID_LIKE families that ship an RPM-based package manager.
const RPM_FAMILY_IDS = new Set([
  'rhel',
  'fedora',
  'centos',
  'rocky',
  'almalinux',
  'ol', // Oracle Linux
  'oracle',
  'amzn', // Amazon Linux
  'mariner',
  'azurelinux',
  'suse',
  'opensuse',
  'opensuse-leap',
  'opensuse-tumbleweed',
  'sles',
]);

// Distro IDs / ID_LIKE families that ship a DEB-based package manager.
const DEB_FAMILY_IDS = new Set([
  'debian',
  'ubuntu',
  'linuxmint',
  'pop',
  'elementary',
  'kali',
  'raspbian',
  'devuan',
]);

// Parse the shell-style key=value pairs of an /etc/os-release file, stripping
// the optional surrounding quotes around values.
function parseOsRelease(content: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (key) fields[key] = value;
  }
  return fields;
}

// Detect the package family from /etc/os-release. The distro's own ID wins over
// ID_LIKE hints, and an unknown distro falls back to 'deb' to preserve Pake's
// historical default. Accepts content directly so the decision is unit-testable
// without a real /etc/os-release.
export function detectLinuxPackageFamily(
  osReleaseContent?: string,
): LinuxPackageFamily {
  let content = osReleaseContent;
  if (content === undefined) {
    try {
      content = fs.readFileSync('/etc/os-release', 'utf-8');
    } catch {
      return 'deb';
    }
  }

  const fields = parseOsRelease(content);
  const id = (fields.ID ?? '').toLowerCase().trim();
  const idLike = (fields.ID_LIKE ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  for (const token of [id, ...idLike]) {
    if (DEB_FAMILY_IDS.has(token)) return 'deb';
    if (RPM_FAMILY_IDS.has(token)) return 'rpm';
  }
  return 'deb';
}

// Default Linux bundle targets, chosen by the host distro's package family so
// RPM-based distros (Fedora/RHEL/Oracle/Rocky/Alma/openSUSE) get a native .rpm
// instead of a .deb their package manager cannot install. AppImage stays as a
// universal fallback in both cases.
export function getDefaultLinuxTargets(): string {
  return detectLinuxPackageFamily() === 'rpm' ? 'rpm,appimage' : 'deb,appimage';
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1431** (2026-11-14): **[Bug] Power Apps Launch not working**
  *Symptoms*: ### Search before asking  - [x] I searched in the [issues](https://github.com/tw93/Pake/issues?q=) and found nothing similar.   ### Pake version  Windows x64, Version 1.5.0  ### Rust version  ---  ### Package Manager  other  ### System version  Windows 11  ### Node.js version  --  ### Build Command  Version 1.5.0  ### Minimal reproduce step  Install an App with Site Powerapps. In the Powerapps make a button with Launch(). Click button in Power Apps, the link is opend. Click the button in Pake, nothing happens  ### What did you expect to see?  The link from Launch() should open in the browser  ### What did you see instead?  nothing happend  ### Anything else?  _No response_  ### Are you willing to submit a PR?  - [ ] I'm willing to submit a PR!

- **Issue #1427** (2026-11-01): **[Bug] Web Midi issue on MacOS Arm and Intel**
  *Symptoms*: ### Search before asking  - [x] I searched in the [issues](https://github.com/tw93/Pake/issues?q=) and found nothing similar.   ### Pake version  I am encountering an issue with midi on MacOS Arm and Intel, the application is built (dmg) from local file, but the application doesn´t see midi devices and incoming midi messages. Not sure if it is an issue with Tauri Web Midi. When the application is built via npm build and runs on local server everything works normally on Macs, when using pake generated dmgs screens are ok, all the features are available except midi ports. On Windows 10 and 11 everything works fine with pake executables, midi devices listed and incoming midi messages functional. Any recommandations or hints how to fix that? Thank you.  ### Rust version  Rust 1.99.1, Pake 3.17.8, npm 11.19.1 on Mac   ### Package Manager  npm  ### System version  Sequoia 15.7 M1 Pro  ### Node.js version  v24.22.0  ### Build Command  sudo pake /Users/admin/Desktop/midee-master/dist/index.html -- name "MidoApp" -- use-local-file  ### Minimal reproduce step  midi icon in upper right corner of the apllication is greyed out.  ### What did you expect to see?  active connection of midi device and active playing like on Windows versions, those work with no issues.  ### What did you see instead?  midi icon in upper right corner of the apllication is greyed out.  ### Anything else?  Suspecting some issues with Web Midi in Tauri or Rust packages on MacOS.   ### Are you willing to submit a PR

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

### Incident Patch 1: `b3e1c8b9` (2026-11-18)
**Commit Message**: fix: stop showing sites Tauri's global API, which DeepSeek reads as an unofficial client

DeepSeek's front end warns "Abnormal usage environment" when
`"__TAURI__" in window` holds, and withGlobalTauri put that name on every
page of every packaged app. The config is now off, and Pake's injected
scripts reach the native side through window.__PAKE_NATIVE__ (bridge.js),
which sends the same commands over __TAURI_INTERNALS__: invoke, shell.open
and the nine window commands the capability grants. No permission changed.

The user's own code keeps the old name, pointed at the bridge: an injected
script that names it, and a local app's own tauri: pages. The rest of the
global API (events, paths) is gone for such code.

Verified on a real macOS bundle against chat.deepseek.com: the warning is
gone and `"__TAURI__" in window` is false, set_zoom and isFullscreen answer
through the bridge, and a custom.js naming the old global still invokes.
cargo test --lib with and without runtime-template, vitest (875), the four
tests/browser suites and tests/integration/ipc-security.mjs pass.

**File**: `.claude/rules/tauri-runtime.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ paths:
 - Native IPC is gated by the application command manifest in `src-tauri/build.rs`. Keep every registered app command in that manifest and grant only its required permissions. The packaged capability is local-only; `PakeConfig::remote_capability` grants the same permission set to exact configured entry origins (scheme, host, and port) before webviews load. Navigation flags, login redirects, subdomains, and restored URLs must not expand that grant. Keep local pages, secondary windows, loopback/IPv6 URLs, and literal hostname handling covered. ACL-denied downloads may fall back to browser attachments, but transient download anchors must bypass the IPC click interceptor to avoid recursion. Fullscreen must acquire native permission before mutating the player DOM; untrusted frame messages must never gain a top-level navigation fallback. Run `cargo test --lib` and `node tests/integration/ipc-security.mjs` (real macOS WebView); hiding `window.__TAURI__` or narrowing plugin capabilities alone does not gate application commands.
 - Injected CSS uses `src-tauri/src/inject/styles.js`: preserve DOM stylesheet order on ordinary pages; use constructable sheets only when CSP blocks the style element. `replaceSync` silently drops `@import`, so keep import-bearing CSS on its original DOM path, including escaped/case-insensitive at-keywords. Strict CSP plus imports remains unsupported. Run `node tests/browser/style-injection.mjs` with an installed Playwright runtime; mock CSSStyleSheet tests do not validate CSP or cascade behavior.
 - The `runtime-template` Cargo feature builds a prebuilt runtime that a separate builder customizes without a compiler: at launch it reads `pake-runtime/{pake.json, app.json, custom.js?, tray.png?}` from `Contents/Resources` on macOS or next to the executable elsewhere, and applies app.json's `identifier` and `productName` to the Tauri context before build. The CLI never enables the feature, so CLI-built apps keep their compiled configuration even if such a folder appears. A present but invalid override exits with a `[Pake]` message instead of falling back to the template's identity. A runtime app keys its WebView profile folder under the config dir (`%APPDATA%\<identifier>\EBWebView` on Windows) by identifier instead of product name (`data_dir_name`), so a rename keeps logins and a generated name cannot share another program's folder; CLI apps keep the product-name folder. On Windows a runtime app also sets the process AppUserModelID to its identifier before any window exists, so shortcuts carrying that ID group with the running window and toasts are attributed to it. Logic and tests live in `src-tauri/src/util.rs` (`apply_runtime_override`, `data_dir_name`, `set_app_user_model_id`); `PakeConfig::runtime_app` is the single runtime-app flag, and `run_app` copies the overridden identity from the returned Tauri config into the context; keep `cargo clippy` and `cargo test --lib` green both with and without `--features runtime-template`.
+- The app is built with `withGlobalTauri: false`: a page can read `window.__TAURI__`, and DeepSeek's front end shows "Abnormal usage environment" when `"__TAURI__" in window` holds (measured on a real bundle, 2026-11-18; its other tests are a user agent naming Tauri or Electron). Injected scripts reach the native side only through `window.__PAKE_NATIVE__` from `src-tauri/src/inject/bridge.js`, which keeps the shape they used (`core.invoke`, `shell.open` and `window.getCurrentWindow()` with the nine window commands the capability grants) over `__TAURI_INTERNALS__`; a new window call is added there with the command and argument names Tauri's own API sends, and needs its permission in the capability. Tauri decides the global API at compile time, so a prebuilt runtime cannot switch it per app: the user's own code, a bundled local page or an injected script that names `__TAURI__`, gets the name pointed at the bridge instead (`global_api_name_script` in `window.rs`): a local app only on its own `tauri:` pages, so a site it links out to stays clean, while an app with such a script shows the name to its site again. The rest of Tauri's global API (events, paths, DPI types) is gone for such code; the capability never granted a page most of it. `isTauri`, `__TAURI_INTERNALS__` and the plugins' `__TAURI_PLUGIN_*` names remain and are not configurable from a script; hiding them means patching the tauri crate, to do only when a site is shown to read them. `tests/unit/native-bridge.test.js` holds the scripts and the config to this.
 - A page's `alert()`, `confirm()` and `prompt()` show nothing in a WKWebView unless its UI delegate implements the three `runJavaScript…Panel` methods, and Wry 0.54.2's does not: `alert` returned at once, `confirm` returned false and `prompt` null in a millisecond, so a site that confirms before logging out did nothing (a user's report, 2026-11-17; WebView2 and WebKitGTK show their own). `src-tauri/src/app/script_dialogs.rs` adds
```

**File**: `docs/advanced-usage.md` (modified, +2/-0)
```diff
@@ -72,6 +72,8 @@ window.__TAURI__.core.invoke("handle_scroll", {
 });
 ```
 
+`window.__TAURI__` exists only for your own code, a bundled local page or a script you inject with `--inject` that names it, and carries what a page is allowed to call: `core.invoke`, `shell.open` and `window.getCurrentWindow()` with `close`, `minimize`, `maximize`, `toggleMaximize`, `setResizable`, `startDragging`, `isFullscreen`, `setFullscreen` and `theme`. A packaged website sees no such object, because some sites, DeepSeek among them, treat it as an unofficial client and show a warning.
+
 **Container Side (Rust):**
 
 ```rust
```

**File**: `docs/advanced-usage_CN.md` (modified, +2/-0)
```diff
@@ -72,6 +72,8 @@ window.__TAURI__.core.invoke("handle_scroll", {
 });
 ```
 
+`window.__TAURI__` 只留给你自己的代码，打包的本地页面里一直有，用 `--inject` 注入的脚本里写到它时也有，提供页面有权限调用的那部分，`core.invoke`、`shell.open` 和 `window.getCurrentWindow()` 的 `close`、`minimize`、`maximize`、`toggleMaximize`、`setResizable`、`startDragging`、`isFullscreen`、`setFullscreen`、`theme`。打包的网站看不到这个对象，因为 DeepSeek 等网站会把它当成非官方客户端并弹出提示。
+
 **容器端（Rust）：**
 
 ```rust
```

**File**: `src-tauri/src/app/window.rs` (modified, +64/-8)
```diff
@@ -259,6 +259,26 @@ fn popup_build_url(target_url: &Url) -> Url {
     }
 }
 
+/// The app carries no Tauri global API object, since a site can see it and
+/// some treat it as an unofficial client. The user's own code may still call
+/// it, as the docs showed for years: a bundled local page, or an injected
+/// script that names it. Those get the name back, pointing at Pake's bridge
+/// (`core.invoke` and the current window).
+const GLOBAL_API_NAME: &str =
+    "if (!window.__TAURI__) { window.__TAURI__ = window.__PAKE_NATIVE__; }";
+/// A local app's own pages only: a site it links out to stays without the name.
+const GLOBAL_API_NAME_ON_LOCAL_PAGES: &str = "if (!window.__TAURI__ && (location.protocol === 'tauri:' || location.hostname === 'tauri.localhost')) { window.__TAURI__ = window.__PAKE_NATIVE__; }";
+
+fn global_api_name_script(url_type: &str, custom_js: &str) -> Option<&'static str> {
+    if custom_js.contains("__TAURI__") {
+        Some(GLOBAL_API_NAME)
+    } else if url_type == "local" {
+        Some(GLOBAL_API_NAME_ON_LOCAL_PAGES)
+    } else {
+        None
+    }
+}
+
 /// Whether a page's new-window request gets a window of its own: always with
 /// `--new-window`, and without it for a blank popup and for one that asks for
 /// a size.
@@ -268,7 +288,10 @@ fn builds_requested_popup(allow_new_window: bool, target_url: &Url, sized: bool)
 
 #[cfg(test)]
 mod popup_tests {
-    use super::{builds_requested_popup, is_blank_popup_url, popup_build_url};
+    use super::{
+        builds_requested_popup, global_api_name_script, is_blank_popup_url, popup_build_url,
+        GLOBAL_API_NAME, GLOBAL_API_NAME_ON_LOCAL_PAGES,
+    };
     use tauri::Url;
 
     #[test]
@@ -298,6 +321,35 @@ mod popup_tests {
         assert!(script.contains("window.addEventListener(\"click\", openUnhandledBlankLink);"));
     }
 
+    #[test]
+    fn a_site_sees_no_tauri_global_api_and_the_users_own_code_keeps_the_name() {
+        // DeepSeek reads `"__TAURI__" in window` and warns of an abnormal
+        // environment, so Tauri must not define it; Pake's own scripts are
+        // held to that in tests/unit/native-bridge.test.js.
+        let conf: serde_json::Value =
+            serde_json::from_str(include_str!("../../tauri.conf.json")).unwrap();
+        assert_eq!(conf["app"]["withGlobalTauri"], serde_json::json!(false));
+        assert_eq!(global_api_name_script("web", ""), None);
+        assert_eq!(global_api_name_script("web", "document.title = 'x';"), None);
+        let calls_it = "window.__TAURI__.core.invoke('set_zoom', { percent: 90 });";
+        assert_eq!(
+            global_api_name_script("web", calls_it),
+            Some(GLOBAL_API_NAME)
+        );
+        assert_eq!(
+            global_api_name_script("local", calls_it),
+            Some(GLOBAL_API_NAME)
+        );
+        // A bundled local page is the user's own code, with no site to object;
+        // a site that page links out to is still a site.
+        assert_eq!(
+            global_api_name_script("local", ""),
+            Some(GLOBAL_API_NAME_ON_LOCAL_PAGES)
+        );
+        assert!(GLOBAL_API_NAME_ON_LOCAL_PAGES.contains("location.protocol === 'tauri:'"));
+        assert!(GLOBAL_API_NAME.contains("window.__TAURI__ = window.__PAKE_NATIVE__"));
+    }
+
     #[test]
     fn a_popup_web_view_is_built_blank_so_the_engine_loads_its_address_once() {
         let google = Url::parse("https://accounts.google.com/gsi/select?client_id=1").unwrap();
@@ -798,7 +850,9 @@ fn build_window(
     // so only inject its ~700 lines when the feature is on. Avoids parsing the
     // find UI on every page load in the common (find-off) case. Matches the
     // enable_find gating already applied to the Find menu item.
-    window_builder = window_builder.initialization_script(include_str!("../inject/styles.js"));
+    window_builder = window_builder
+        .initialization_script(include_str!("../inject/bridge.js"))
+        .initialization_script(include_str!("../inject/styles.js"));
 
     if window_config.enable_find {
         window_builder = window_builder.initialization_script(include_str!("../inject/find.js"));
@@ -825,12 +879,14 @@ fn build_window(
             window_builder.initialization_script(include_str!("../inject/title_bar.js"));
     }
 
-    window_builder = window_builder.initialization_script(
-        config
-            .runtime_custom_js
-            .as_deref()
-            .unwrap_or(include_str!("../inject/custom.js")),
-    );
+    let custom_js = config
+        .runtime_custom_js
+        .as_deref()
+        .unwrap_or(include_str!("../inject/custom.js"));
+    if let Some(script) = global_api_name_script(&window_config.url_type, custom_js) {
+        window_builder = window_builder.initialization_script(script);
+    }
+    window_builder = window_builder.initialization_script(custom_js);
 
     #[cfg(target_os = "windows")]
     let mut windows_browser_args = String::from("--disable-features=msWebOOUI
```

**File**: `src-tauri/src/inject/bridge.js` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+// Pake's own handle on the native side, for the injected scripts that follow.
+//
+// The app is built without Tauri's global API object: a site can see that
+// object and some treat its presence as an unofficial client (DeepSeek showed
+// "Abnormal usage environment" on every packaged app). This keeps what the
+// capability allows a page to call anyway, `invoke`, the window commands and
+// opening a link in the system browser, under Pake's name and in the shape
+// the global API had, so the user's own code can be handed it under the old
+// name.
+(function () {
+  if (window.__PAKE_NATIVE__) return;
+
+  function internals() {
+    return window.__TAURI_INTERNALS__;
+  }
+
+  function invoke(command, args, options) {
+    const native = internals();
+    if (!native || typeof native.invoke !== "function") {
+      return Promise.reject(new Error("[Pake] native bridge unavailable"));
+    }
+    return native.invoke(command, args, options);
+  }
+
+  // The commands and argument names Tauri's own window API sends.
+  function windowCommand(name, value) {
+    const native = internals();
+    const label =
+      native && native.metadata && native.metadata.currentWindow
+        ? native.metadata.currentWindow.label
+        : undefined;
+    const args = { label };
+    if (value !== undefined) args.value = value;
+    return invoke("plugin:window|" + name, args);
+  }
+
+  const currentWindow = Object.freeze({
+    close: () => windowCommand("close"),
+    startDragging: () => windowCommand("start_dragging"),
+    isFullscreen: () => windowCommand("is_fullscreen"),
+    setFullscreen: (fullscreen) => windowCommand("set_fullscreen", fullscreen),
+    toggleMaximize: () => windowCommand("toggle_maximize"),
+    maximize: () => windowCommand("maximize"),
+    minimize: () => windowCommand("minimize"),
+    setResizable: (resizable) => windowCommand("set_resizable", resizable),
+    theme: () => windowCommand("theme"),
+  });
+
+  Object.defineProperty(window, "__PAKE_NATIVE__", {
+    value: Object.freeze({
+      core: Object.freeze({ invoke }),
+      window: Object.freeze({ getCurrentWindow: () => currentWindow }),
+      shell: Object.freeze({
+        open: (path, openWith) =>
+          invoke("plugin:shell|open", { path, with: openWith }),
+      }),
+    }),
+  });
+})();
```

**File**: `src-tauri/src/inject/event.js` (modified, +7/-7)
```diff
@@ -2,7 +2,7 @@
 // on blank error shells (no JS context). Falls back to history/location when
 // the IPC bridge is unavailable.
 function nativeNavigate(action) {
-  const invoke = window.__TAURI__?.core?.invoke;
+  const invoke = window.__PAKE_NATIVE__?.core?.invoke;
   if (invoke) {
     invoke("webview_navigate", { action }).catch(() => {
       fallbackNavigate(action);
@@ -41,7 +41,7 @@ function setZoom(zoom) {
   // on macOS. Native zoom recalculates layout exactly like a browser does.
   const zoomPercent = normalizeZoomPercent(zoom);
   const normalizedZoom = `${zoomPercent}%`;
-  const invoke = window.__TAURI__?.core?.invoke;
+  const invoke = window.__PAKE_NATIVE__?.core?.invoke;
   if (invoke) {
     invoke("set_zoom", { percent: zoomPercent }).catch(() => {});
   }
@@ -89,11 +89,11 @@ function handleShortcut(event) {
 // and Ctrl+L. A browser keeps all three for itself, so no page relies on them.
 function closeCurrentWindow() {
   // close() raises the window's close request, so hide-on-close still applies.
-  window.__TAURI__?.window?.getCurrentWindow?.()?.close?.();
+  window.__PAKE_NATIVE__?.window?.getCurrentWindow?.()?.close?.();
 }
 
 function quitApp() {
-  window.__TAURI__?.core?.invoke?.("quit_app")?.catch?.(() => {});
+  window.__PAKE_NATIVE__?.core?.invoke?.("quit_app")?.catch?.(() => {});
 }
 
 function copyPageAddress() {
@@ -194,7 +194,7 @@ function handleWindowFullscreenShortcut(event) {
     return;
   }
 
-  const appWindow = window.__TAURI__?.window?.getCurrentWindow?.();
+  const appWindow = window.__PAKE_NATIVE__?.window?.getCurrentWindow?.();
   if (!appWindow) {
     return;
   }
@@ -742,7 +742,7 @@ window.addEventListener("pagehide", () => {
 });
 
 document.addEventListener("DOMContentLoaded", () => {
-  const tauri = window.__TAURI__;
+  const tauri = window.__PAKE_NATIVE__;
   const appWindow = tauri.window.getCurrentWindow();
   const invoke = tauri.core.invoke;
   const pakeConfig = window["pakeConfig"] || {};
@@ -1504,7 +1504,7 @@ document.addEventListener("DOMContentLoaded", () => {
 // for DOMContentLoaded so feature-detection on Notification/setAppBadge
 // returns the polyfill before site scripts run.
 (function () {
-  const invoke = window.__TAURI__?.core?.invoke;
+  const invoke = window.__PAKE_NATIVE__?.core?.invoke;
   if (!invoke) return;
   if (typeof EventTarget !== "function" || typeof Event !== "function") return;
 
```

**File**: `src-tauri/src/inject/fullscreen.js` (modified, +2/-2)
```diff
@@ -10,12 +10,12 @@
   window.__PAKE_FULLSCREEN_POLYFILL__ = true;
 
   function initFullscreenPolyfill() {
-    if (!window.__TAURI__ || !document.head) {
+    if (!window.__PAKE_NATIVE__ || !document.head) {
       setTimeout(initFullscreenPolyfill, 100);
       return;
     }
 
-    const appWindow = window.__TAURI__.window.getCurrentWindow();
+    const appWindow = window.__PAKE_NATIVE__.window.getCurrentWindow();
     let fullscreenElement = null;
     let actualFullscreenElement = null;
     let originalStyles = null;
```

**File**: `src-tauri/src/inject/theme_refresh.js` (modified, +2/-2)
```diff
@@ -31,8 +31,8 @@ document.addEventListener("DOMContentLoaded", () => {
     else if (isLight) mode = "light";
 
     // Only invoke Rust command if an explicit theme override is detected
-    if (mode && window.__TAURI__?.core) {
-      window.__TAURI__.core.invoke("update_theme_mode", { mode });
+    if (mode && window.__PAKE_NATIVE__?.core) {
+      window.__PAKE_NATIVE__.core.invoke("update_theme_mode", { mode });
     }
   };
 
```

---

### Incident Patch 2: `1382507e` (2026-11-19)
**Commit Message**: fix(macos): tighten when a page may use the runtime's passkeys

An independent review of c65878c3 found five gaps, fixed here:

- An app built with --ignore-certificate-errors trusts any certificate for
  its host, so a stand-in on the network would get a Touch ID assertion for
  the real origin. Passkeys are now off there, as a browser refuses
  WebAuthn on a certificate error (passkey::enabled, beside incognito).
- A hidden or background window could raise Touch ID, or pull itself on
  screen with a sheet. Only the key window of the active app may now start
  a ceremony.
- A page that navigated away mid-prompt still had its key saved, which
  could also replace the account's working passkey. pagehide now cancels
  the ceremony, and a cancelled create saves nothing.
- A Mac without an enclave showed "No Passkey" and sent the user to add
  one that could never be made. It now refuses without a sheet.
- The store's folder is flushed after the rename, so a power loss does not
  bring back the file without a key the site already registered.

The FAQ says Secure Enclave (安全隔区 in Chinese), names the hardware it
needs and that --ignore-certificate-errors apps keep no passkeys.

Verified:

**File**: `.claude/rules/tauri-runtime.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ paths:
 - The `runtime-template` Cargo feature builds a prebuilt runtime that a separate builder customizes without a compiler: at launch it reads `pake-runtime/{pake.json, app.json, custom.js?, tray.png?}` from `Contents/Resources` on macOS or next to the executable elsewhere, and applies app.json's `identifier` and `productName` to the Tauri context before build. The CLI never enables the feature, so CLI-built apps keep their compiled configuration even if such a folder appears. A present but invalid override exits with a `[Pake]` message instead of falling back to the template's identity. A runtime app keys its WebView profile folder under the config dir (`%APPDATA%\<identifier>\EBWebView` on Windows) by identifier instead of product name (`data_dir_name`), so a rename keeps logins and a generated name cannot share another program's folder; CLI apps keep the product-name folder. On Windows a runtime app also sets the process AppUserModelID to its identifier before any window exists, so shortcuts carrying that ID group with the running window and toasts are attributed to it. Logic and tests live in `src-tauri/src/util.rs` (`apply_runtime_override`, `data_dir_name`, `set_app_user_model_id`); `PakeConfig::runtime_app` is the single runtime-app flag, and `run_app` copies the overridden identity from the returned Tauri config into the context; keep `cargo clippy` and `cargo test --lib` green both with and without `--features runtime-template`.
 - The app is built with `withGlobalTauri: false`: a page can read `window.__TAURI__`, and DeepSeek's front end shows "Abnormal usage environment" when `"__TAURI__" in window` holds (measured on a real bundle, 2026-11-18; its other tests are a user agent naming Tauri or Electron). Injected scripts reach the native side only through `window.__PAKE_NATIVE__` from `src-tauri/src/inject/bridge.js`, which keeps the shape they used (`core.invoke`, `shell.open` and `window.getCurrentWindow()` with the nine window commands the capability grants) over `__TAURI_INTERNALS__`; a new window call is added there with the command and argument names Tauri's own API sends, and needs its permission in the capability. Tauri decides the global API at compile time, so a prebuilt runtime cannot switch it per app: the user's own code, a bundled local page or an injected script that names `__TAURI__`, gets the name pointed at the bridge instead (`global_api_name_script` in `window.rs`): a local app only on its own `tauri:` pages, so a site it links out to stays clean, while an app with such a script shows the name to its site again. The rest of Tauri's global API (events, paths, DPI types) is gone for such code; the capability never granted a page most of it. `isTauri`, `__TAURI_INTERNALS__` and the plugins' `__TAURI_PLUGIN_*` names remain and are not configurable from a script; hiding them means patching the tauri crate, to do only when a site is shown to read them. `tests/unit/native-bridge.test.js` holds the scripts and the config to this.
 - A page's `alert()`, `confirm()` and `prompt()` show nothing in a WKWebView unless its UI delegate implements the three `runJavaScript…Panel` methods, and Wry's does not (through 0.57.2): `alert` returned at once, `confirm` returned false and `prompt` null in a millisecond, so a site that confirms before logging out did nothing (a user's report, 2026-11-17; WebView2 and WebKitGTK show their own). `src-tauri/src/app/script_dialogs.rs` adds the three methods to the delegate's class where it lacks them, for every webview from `build_window`, and then sets the same delegate on the webview again: WebKit records which methods a delegate answers when it is set, and without the reset the added methods are never called. Each panel is an NSAlert sheet on the page's window whose completion calls WebKit's handler exactly once (WebKit raises on zero or two calls), which keeps the script waiting as a browser does. The sheet goes on the window even when it is hidden, as a closed window is with hide-on-close: AppKit then shows the window with its sheet (measured: a window hidden with Cmd+W came back on screen when its page called `confirm()`), where an app-modal panel would float over whatever else the user is doing; only a webview with no window falls back to `runModal`. Cancel carries an explicit Escape key equivalent, because AppKit gives Escape only to a button titled Cancel and the Chinese title is 取消. Verify on a real bundle with a page that calls all three and writes what it got back: OK gives `true`, Cancel `false`, a prompt its field's text or `null`, and each wait is seconds, not a millisecond. Send the keys with a CGEvent tool of your own: Escape must give `false` and `null`, Return `true`. Cover it with `tests/unit/macos-script-dialogs.test.ts` and the `script_panel_encodings_match_their_selectors` Rust test, which keeps each selector's colons and its type encoding in step.
-- Passkeys on macOS (2026-11-19): WKWebView refuses WebAuthn in an
```

**File**: `docs/faq.md` (modified, +1/-1)
```diff
@@ -458,7 +458,7 @@ This is usually due to web compatibility issues. Try:
 
    When a site signs in through a popup with a size of its own (the Google button on TikTok, Notion and X, or Sign in with Apple on Yelp and Upwork), Pake on macOS and Windows opens that popup as a separate window, so it can hand the result back to the page that opened it and close itself, with or without `--new-window`. A sign-in the site opens as a link, or as a `window.open` with no size, continues in the current window on macOS and Linux, and so does every sign-in popup on Linux for now.
 
-   On macOS a Pake app keeps its own passkeys in the Mac's Secure Enclave and signs in with Touch ID, or with the login password on a Mac without it. They stay in that app on that Mac, so a passkey saved in iCloud Keychain or on an iPhone is not offered: sign in another way once, then add a passkey in the site's settings. An `--incognito` app keeps none, and signing in by scanning a QR code with a phone is not supported yet.
+   On macOS a Pake app keeps its own passkeys in the Mac's Secure Enclave and signs in with Touch ID, or with the login password on a Mac without it. They stay in that app on that Mac, so a passkey saved in iCloud Keychain or on an iPhone is not offered: sign in another way once, then add a passkey in the site's settings. This needs Apple silicon or an Intel Mac with a T2 chip. An app made with `--incognito` or `--ignore-certificate-errors` keeps none, and signing in by scanning a QR code with a phone is not supported yet.
 
 5. **WeChat Web login environment error**
 
```

**File**: `docs/faq_CN.md` (modified, +1/-1)
```diff
@@ -456,7 +456,7 @@ Pake 可以自动转换普通图片，但提供正确的格式更可靠。Icon C
 
    网站用自带尺寸的弹窗登录时（TikTok、Notion、X 上的 Google 登录，Yelp、Upwork 上的 Sign in with Apple），macOS 和 Windows 上的 Pake 会把这个弹窗开成独立窗口，登录完由它把结果交回原页面并自己关闭，开没开 `--new-window` 都一样。网站用普通链接或不带尺寸的 `window.open` 发起的登录，在 macOS 和 Linux 上仍在当前窗口内跳转，Linux 上的登录弹窗目前也都还是这样。
 
-   macOS 上的 Pake 应用会把自己的通行密钥存在这台 Mac 的安全芯片里，登录时按一下指纹就行，没有 Touch ID 的 Mac 输入登录密码。这些通行密钥只在这个应用里用，iCloud 钥匙串和 iPhone 上已有的用不了，第一次先用其他方式登录，再到网站设置里添加一个通行密钥。`--incognito` 打包的应用不保存通行密钥，用手机扫码登录暂时还不支持。
+   macOS 上的 Pake 应用会把自己的通行密钥存在这台 Mac 的安全隔区里，登录时按一下指纹就行，没有 Touch ID 的 Mac 输入登录密码，需要 Apple 芯片或带 T2 芯片的 Intel Mac。这些通行密钥只在这个应用里用，iCloud 钥匙串和 iPhone 上已有的用不了，第一次先用其他方式登录，再到网站设置里添加一个通行密钥。用 `--incognito` 或 `--ignore-certificate-errors` 打包的应用不保存通行密钥，用手机扫码登录暂时还不支持。
 
 5. **微信 Web 版登录环境异常**
 
```

**File**: `src-tauri/src/app/passkey/macos.rs` (modified, +35/-11)
```diff
@@ -307,7 +307,14 @@ fn save(path: &Path, store: &Store) -> std::io::Result<()> {
         .open(&temporary)?;
     file.write_all(store.to_json().as_bytes())?;
     file.sync_all()?;
-    std::fs::rename(&temporary, path)
+    std::fs::rename(&temporary, path)?;
+    // The rename itself is in the folder, so a power loss right after a site
+    // learned the key does not bring the old file back. Best effort: not every
+    // volume flushes a folder.
+    if let Some(directory) = path.parent() {
+        let _ = std::fs::File::open(directory).and_then(|folder| folder.sync_all());
+    }
+    Ok(())
 }
 
 fn now() -> u64 {
@@ -775,10 +782,36 @@ fn receive(
         }
         Request::Create { .. } | Request::Get { .. } => {}
     }
+    // A Mac without an enclave makes no passkeys, so it offers none and
+    // tells nobody to add one: the page goes on to its other sign-in.
+    if !available() {
+        return reply.fail(Failure::NotAllowed);
+    }
+    let window: Option<Retained<AnyObject>> = unsafe {
+        let webview = webview as *mut AnyObject;
+        if webview.is_null() {
+            None
+        } else {
+            let window: *mut AnyObject = msg_send![webview, window];
+            Retained::retain(window)
+        }
+    };
+    // Only the page in front may ask, as in a browser: a hidden window or one
+    // behind another app would raise Touch ID, or pull itself on screen with a
+    // sheet, for a sign-in the user never started.
+    let app = NSApplication::sharedApplication(mtm);
+    let active: Bool = unsafe { msg_send![&*app, isActive] };
+    let in_front = window.as_ref().is_some_and(|window| {
+        let key: Bool = unsafe { msg_send![&**window, isKeyWindow] };
+        key.as_bool()
+    });
+    if !active.as_bool() || !in_front {
+        return reply.fail(Failure::NotAllowed);
+    }
     // A sheet on a window that was closed (with its popup, or hidden by the
     // close button) would hold every later request as busy, so it gives way.
     // A minimized window, or any while the app is hidden, still has its sheet.
-    let app_hidden: Bool = unsafe { msg_send![&*NSApplication::sharedApplication(mtm), isHidden] };
+    let app_hidden: Bool = unsafe { msg_send![&*app, isHidden] };
     if !app_hidden.as_bool() {
         cancel(|ceremony| {
             ceremony.sheet.as_ref().is_some_and(|(_, window)| {
@@ -805,15 +838,6 @@ fn receive(
             sheet: None,
         })
     });
-    let window: Option<Retained<AnyObject>> = unsafe {
-        let webview = webview as *mut AnyObject;
-        if webview.is_null() {
-            None
-        } else {
-            let window: *mut AnyObject = msg_send![webview, window];
-            Retained::retain(window)
-        }
-    };
     match request {
         Request::Create { options } => create(mtm, window, store_path, origin, options, reply),
         Request::Get { options } => get(mtm, window, store_path, origin, options, reply),
```

**File**: `src-tauri/src/app/passkey/mod.rs` (modified, +15/-0)
```diff
@@ -301,6 +301,14 @@ struct RelyingParty {
     id: Option<String>,
 }
 
+/// Whether a window gets passkeys. A private window keeps nothing between
+/// runs, and one that accepts any certificate cannot tell the site from a
+/// stand-in on the network, which would then get a Touch ID signature for
+/// the real origin; a browser refuses WebAuthn on a certificate error too.
+pub fn enabled(incognito: bool, ignores_certificate_errors: bool) -> bool {
+    !incognito && !ignores_certificate_errors
+}
+
 impl CreateOptions {
     /// The rpId the site asked for, before it is checked.
     pub fn rp_id(&self) -> Option<&str> {
@@ -995,4 +1003,11 @@ mod tests {
             assert!(title.contains("x.com") && !button.is_empty());
         }
     }
+
+    #[test]
+    fn leaves_out_private_windows_and_ones_that_accept_any_certificate() {
+        assert!(enabled(false, false));
+        assert!(!enabled(true, false));
+        assert!(!enabled(false, true));
+    }
 }
```

**File**: `src-tauri/src/app/window.rs` (modified, +8/-3)
```diff
@@ -966,9 +966,11 @@ fn build_window(
             window_builder.initialization_script(include_str!("../inject/title_bar.js"));
     }
 
-    // A private window keeps nothing between runs, so it makes no passkeys either.
     #[cfg(target_os = "macos")]
-    if !window_config.incognito {
+    if crate::app::passkey::enabled(
+        window_config.incognito,
+        window_config.ignore_certificate_errors,
+    ) {
         window_builder = window_builder.initialization_script(include_str!("../inject/passkey.js"));
     }
 
@@ -1430,7 +1432,10 @@ fn build_window(
 
     // WKWebView refuses WebAuthn in this app, so the runtime answers passkey.js itself.
     #[cfg(target_os = "macos")]
-    if !window_config.incognito {
+    if crate::app::passkey::enabled(
+        window_config.incognito,
+        window_config.ignore_certificate_errors,
+    ) {
         if let Ok(directory) = app.path().app_data_dir() {
             let store = directory.join(crate::app::passkey::STORE_FILE);
             if let Err(error) = window.with_webview(move |webview| {
```

**File**: `src-tauri/src/inject/passkey.js` (modified, +4/-0)
```diff
@@ -246,6 +246,7 @@
       let timer = 0;
       const settle = () => {
         if (signal) signal.removeEventListener("abort", onAbort);
+        window.removeEventListener("pagehide", onHide);
         clearTimeout(timer);
       };
       const stop = (error) => {
@@ -258,7 +259,10 @@
         reject(error);
       };
       const onAbort = () => stop(abortReason(signal));
+      // A page that goes away mid-prompt never learns a key made after it.
+      const onHide = () => stop(notAllowed());
       if (signal) signal.addEventListener("abort", onAbort, { once: true });
+      window.addEventListener("pagehide", onHide, { once: true });
       timer = setTimeout(() => stop(notAllowed()), timeoutOf(timeout));
       call(request).then(
         (reply) => {
```

**File**: `tests/unit/passkey-bridge.test.js` (modified, +16/-0)
```diff
@@ -43,7 +43,11 @@ function load({ reply, handler = true, top = true } = {}) {
     }
   }
   const posted = [];
+  const page = new EventTarget();
   const window = {
+    addEventListener: page.addEventListener.bind(page),
+    removeEventListener: page.removeEventListener.bind(page),
+    dispatchEvent: page.dispatchEvent.bind(page),
     PublicKeyCredential,
     CredentialsContainer,
     AuthenticatorAttestationResponse,
@@ -283,6 +287,18 @@ describe("passkey bridge", () => {
     expect(posted[1].id).toBe(posted[0].id);
   });
 
+  it("tells the native side to close its prompt when the page goes away", async () => {
+    const { window, credentials, posted } = load({
+      reply: (request) =>
+        request.kind === "cancel" ? {} : new Promise(() => {}),
+    });
+    const pending = credentials.create(createOptions);
+    window.dispatchEvent(new Event("pagehide"));
+    await expect(pending).rejects.toMatchObject({ name: "NotAllowedError" });
+    expect(posted.map((request) => request.kind)).toEqual(["create", "cancel"]);
+    expect(posted[1].id).toBe(posted[0].id);
+  });
+
   it("gives up after the site's timeout, never below the browser's floor", async () => {
     vi.useFakeTimers();
     try {
```

---

### Incident Patch 3: `5874760a` (2026-11-18)
**Commit Message**: fix: build on Windows again by moving webview2-com and windows-core to Wry 0.57's versions

7c15f4b9 left Pake's own webview2-com at 0.38 and windows-core at 0.61
while Wry 0.57.2 moved to 0.39 and 0.62, so the WebView2 interfaces Wry
hands back came from a second copy of the crate: Quality run 44280093326
failed on windows-latest with `cast` not found, `&HSTRING: Param<PCWSTR>`
unsatisfied and `?` unable to convert the error, in download.rs,
navigation.rs and recovery.rs. Cargo.lock now holds one version of each.

A Windows target cannot be type-checked from this Mac (ring's C sources
need the Windows headers), so the proof is the Quality run on this commit.
cargo test --lib passes on macOS.

**File**: `src-tauri/Cargo.lock` (modified, +47/-161)
```diff
@@ -555,7 +555,7 @@ dependencies = [
  "iana-time-zone",
  "num-traits",
  "serde",
- "windows-link 0.2.1",
+ "windows-link",
 ]
 
 [[package]]
@@ -1438,7 +1438,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "1bd49230192a3797a9a4d6abe9b3eed6f7fa4c8a8a4947977c6f80025f92cbd8"
 dependencies = [
  "rustix",
- "windows-link 0.2.1",
+ "windows-link",
 ]
 
 [[package]]
@@ -1845,7 +1845,7 @@ dependencies = [
  "js-sys",
  "log",
  "wasm-bindgen",
- "windows-core 0.62.2",
+ "windows-core",
 ]
 
 [[package]]
@@ -2098,7 +2098,7 @@ dependencies = [
  "portable-atomic",
  "portable-atomic-util",
  "serde_core",
- "windows-link 0.2.1",
+ "windows-link",
 ]
 
 [[package]]
@@ -2839,8 +2839,8 @@ dependencies = [
  "tokio",
  "webkit2gtk",
  "webkit2gtk-sys",
- "webview2-com 0.38.2",
- "windows-core 0.61.2",
+ "webview2-com",
+ "windows-core",
  "windows-sys 0.61.2",
  "zbus 5.19.0",
 ]
@@ -2896,7 +2896,7 @@ dependencies = [
  "libc",
  "redox_syscall",
  "smallvec",
- "windows-link 0.2.1",
+ "windows-link",
 ]
 
 [[package]]
@@ -4192,8 +4192,8 @@ dependencies = [
  "tao-macros",
  "unicode-segmentation",
  "url",
- "windows 0.62.2",
- "windows-core 0.62.2",
+ "windows",
+ "windows-core",
  "windows-version",
  "x11-dl",
 ]
@@ -4262,9 +4262,9 @@ dependencies = [
  "tray-icon",
  "url",
  "webkit2gtk",
- "webview2-com 0.39.1",
+ "webview2-com",
  "window-vibrancy",
- "windows 0.62.2",
+ "windows",
 ]
 
 [[package]]
@@ -4464,7 +4464,7 @@ dependencies = [
  "tauri-plugin",
  "thiserror 2.0.21",
  "url",
- "windows 0.62.2",
+ "windows",
  "zbus 5.19.0",
 ]
 
@@ -4543,8 +4543,8 @@ dependencies = [
  "thiserror 2.0.21",
  "url",
  "webkit2gtk",
- "webview2-com 0.39.1",
- "windows 0.62.2",
+ "webview2-com",
+ "windows",
 ]
 
 [[package]]
@@ -4567,8 +4567,8 @@ dependencies = [
  "tauri-utils",
  "url",
  "webkit2gtk",
- "webview2-com 0.39.1",
- "windows 0.62.2",
+ "webview2-com",
+ "windows",
  "wry",
 ]
 
@@ -4628,7 +4628,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f37a6c354fd28fc9e322ed9bd47e3959576dad28c9d58ea1cf888cce1c7ccb36"
 dependencies = [
  "thiserror 2.0.21",
- "windows 0.62.2",
+ "windows",
  "windows-version",
 ]
 
@@ -5314,30 +5314,16 @@ dependencies = [
  "rustls-pki-types",
 ]
 
-[[package]]
-name = "webview2-com"
-version = "0.38.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7130243a7a5b33c54a444e54842e6a9e133de08b5ad7b5861cd8ed9a6a5bc96a"
-dependencies = [
- "webview2-com-macros",
- "webview2-com-sys 0.38.2",
- "windows 0.61.3",
- "windows-core 0.61.2",
- "windows-implement",
- "windows-interface",
-]
-
 [[package]]
 name = "webview2-com"
 version = "0.39.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "3f89fca7a704cee10dcb3654c1dbb8941d1783132f1917358af75bec37a7d7e6"
 dependencies = [
  "webview2-com-macros",
- "webview2-com-sys 0.39.1",
- "windows 0.62.2",
- "windows-core 0.62.2",
+ "webview2-com-sys",
+ "windows",
+ "windows-core",
 ]
 
 [[package]]
@@ -5351,26 +5337,15 @@ dependencies = [
  "syn 2.0.119",
 ]
 
-[[package]]
-name = "webview2-com-sys"
-version = "0.38.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "381336cfffd772377d291702245447a5251a2ffa5bad679c99e61bc48bacbf9c"
-dependencies = [
- "thiserror 2.0.21",
- "windows 0.61.3",
- "windows-core 0.61.2",
-]
-
 [[package]]
 name = "webview2-com-sys"
 version = "0.39.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "b3a07132775117d6065853d9d1178157b8c90e228de47129d6bce2c7edebedfb"
 dependencies = [
  "thiserror 2.0.21",
- "windows 0.62.2",
- "windows-core 0.62.2",
+ "windows",
+ "windows-core",
 ]
 
 [[package]]
@@ -5420,38 +5395,16 @@ dependencies = [
  "windows-version",
 ]
 
-[[package]]
-name = "windows"
-version = "0.61.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9babd3a767a4c1aef6900409f85f5d53ce2544ccdfaa86dad48c91782c6d6893"
-dependencies = [
- "windows-collections 0.2.0",
- "windows-core 0.61.2",
- "windows-future 0.2.1",
- "windows-link 0.1.3",
- "windows-numerics 0.2.0",
-]
-
 [[package]]
 name = "windows"
 version = "0.62.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "527fadee13e0c05939a6a05d5bd6eec6cd2e3dbd648b9f8e447c6518133d8580"
 dependencies = [
- "windows-collections 0.3.2",
- "windows-core 0.62.2",
- "windows-future 0.3.2",
- "windows-numerics 0.3.1",
-]
-
-[[package]]
-name = "windows-collections"
-version = "0.2.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3beeceb5e5cfd9eb1d76b381630e82c4241ccd0d27f1a39ed41b2760b255c5e8"
-dependencies = [
- "windows-core 0.61.2",
+ "windows-collections",
+ "windows-core",
+ "windows-future",
+ "windows-numerics",
 ]
 
 [[package]]
@@ -5460,20 +5413,7 @@ version = "0.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "23b2d95af1a8a14a3c7367e1ed4fc9c20e0a26e79
```

**File**: `src-tauri/Cargo.toml` (modified, +2/-2)
```diff
@@ -88,9 +88,9 @@ windows-sys = { version = "0.61.2", features = [
   "Win32_UI_WindowsAndMessaging",
 ] }
 # Used for native WebView2 GoBack/GoForward on error pages (no page JS).
-webview2-com = "0.38"
+webview2-com = "0.39"
 # The generated WebView2 interfaces use this trait for COM interface casts.
-windows-core = "0.61.2"
+windows-core = "0.62.2"
 
 [features]
 # Opt-in native Windows test harness; not enabled by packaged apps.
```

#### Recent Merged Pull Requests:
- **PR #1437** (closed): Update contributors and formatting (@alperenalbay)
- **PR #1436** (2026-11-14): feat: accept macOS Icon Composer .icon files (#1433) (@adamsiwiec1)
- **PR #1435** (2026-11-14): fix(cli): cancel in-flight icon downloads with builds (@yuxino)
- **PR #1434** (2026-11-14): fix(windows): open external links from iframes in the system browser (@crispyaus)
- **PR #1430** (closed): marge (@MrCrystal2)
- **PR #1429** (closed): sync (@tyh0615)

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

## X. stop showing sites Tauri's global API, which DeepSeek reads as an unofficial cli

**RULE**:
When implementing operations in `.claude/rules/tauri-runtime.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Pake. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b3e1c8b9`: stop showing sites Tauri's global API, which DeepSeek reads as an unofficial client. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/tauri-runtime.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- The app is built with `withGlobalTauri: false`: a page can read `window.__TAURI__`, and DeepSeek's front end shows "Abnormal usage environment" when `"__TAURI__" in window` holds (measured on a real bundle, 2026-11-18; its other tests are a user agent naming Tauri or Electron). Injected scripts reach the native side only through `window.__PAKE_NATIVE__` from `src-tauri/src/inject/bridge.js`, which keeps the shape they used (`core.invoke`, `shell.open` and `window.getCurrentWindow()` with the nine window commands the capability grants) over `__TAURI_INTERNALS__`; a new window call is added there with the command and argument names Tauri's own API sends, and needs its permission in the capability. Tauri decides the global API at compile time, so a prebuilt runtime cannot switch it per app: the user's own code, a bundled local page or an injected script that names `__TAURI__`, gets the name pointed at the bridge instead (`global_api_name_script` in `window.rs`): a local app only on its own `tauri:` pages, so a site it links out to stays clean, while an app with such a script shows the name to its site again. The rest of Tauri's global API (events, paths, DPI types) is gone for such 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b3e1c8b9` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
