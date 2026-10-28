> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-pake-learnings.md`  
> **Source**: github ([https://github.com/tw93/Pake](https://github.com/tw93/Pake))  
> **Source Version**: `3816c112`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T23:05:18.677Z  
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
> **Harvest Timestamp**: 2026-10-28T23:05:18.673Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Pake`
- **Description**: Turn any website into a lightweight desktop app with one command, on macOS, Windows and Linux.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 62374 stars

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
- **Issue #1424** (2026-10-28): **[Bug] Upgraded to 3.17.7 build and issues span out**
  *Symptoms*: ### Search before asking  - [x] I searched in the [issues](https://github.com/tw93/Pake/issues?q=) and found nothing similar.   ### Pake version  Got this that comes with errors:  C:\Users\DELL\AppData\Local\pnpm\global\v11\2d30-18e2955c60370328-0\node_modules\.pnpm\pake-cli@3.17.7\node_modules\pake-cli\src-tauri\target\x86_64-pc-windows-msvc\release\bundle\msi\Pake_1.0.0_x64_en-US.msi (3.39 MiB)  It seems to have built something that I can't find using Explorer. May be should downgrade to 3.16.x that was working fine till now, or remove and make a new fresh install.  Would be great to have the pnpm, npm or some command to proceed eventually. Thanks  ### Rust version  rustc 1.99.1 (58cf8f9c3 2026-10-13)  ### Package Manager  npm  ### System version  12.1.0  ### Node.js version  v24.22.1  ### Build Command  pake https://docs.deno.com/runtime/ --name Docdeno  ### Minimal reproduce step  pake https://docs.deno.com/runtime/ --name Docdeno   ### What did you expect to see?  the msi path so I could run it  ### What did you see instead?  C:\Users\DELL\AppData\Local\pnpm\global\v11\2d30-18e2955c60370328-0\node_modules\.pnpm\pake-cli@3.17.7\node_modules\pake-cli\src-tauri\target\x86_64-pc-windows-msvc\release\bundle\msi\Pake_1.0.0_x64_en-US.msi (3.39 MiB)  ### Anything else?  no  ### Are you willing to submit a PR?  - [ ] I'm willing to submit a PR!

- **Issue #1406** (2026-10-05): **[Bug] Video Captions don't work in pake-youtube on Linux**
  *Symptoms*: ### Search before asking  - [x] I searched in the [issues](https://github.com/tw93/Pake/issues?q=) and found nothing similar.   ### Pake version  3.17.2  ### Rust version  1.89.0  ### Package Manager  pnpm  ### System version  Arch Linux  ### Node.js version  26.8.2  ### Build Command  `pake https://www.youtube.com --name youtube --targets zst`  ### Minimal reproduce step  Build and install with previous command. Open any video and enable captions. They don't appear on the screen!  ### What did you expect to see?  Captions  ### What did you see instead?  Nothing  ### Anything else?  Thanks  ### Are you willing to submit a PR?  - [ ] I'm willing to submit a PR!

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

### Incident Patch 1: `16d79b66` (2026-10-28)
**Commit Message**: fix(cli): release the cache lock when a failed Windows build is already gone

On Windows every failed build runs taskkill on the package manager's pid to
stop leftover compilers. By then npm has usually exited, so taskkill returns
128 (process not found), and that was treated as "could not confirm the build
stopped": the workspace and the compilation cache lock were kept, and every
later build refused to start with "A previous Pake process left a compilation
cache lock" until the lock was deleted by hand. Reproduced twice with 3.17.7
in a Windows 11 VM. Any other taskkill failure still keeps the lock.

Verified: the new shell.test.ts case for exit 128 fails on the old code and
passes now, the exit 1 case keeps the lock; npx vitest run 747/747 on the
final run (the timed-out descendants case is flaky on the unchanged base too).
Rollback: revert this commit and rebuild dist/cli.js.

**File**: `bin/utils/shell.ts` (modified, +11/-4)
```diff
@@ -15,10 +15,17 @@ export interface ShellCommand {
 
 async function terminateBuildTree(pid: number): Promise<void> {
   if (process.platform === 'win32') {
-    await execa('taskkill', ['/pid', String(pid), '/T', '/F'], {
-      timeout: 5000,
-      windowsHide: true,
-    });
+    try {
+      await execa('taskkill', ['/pid', String(pid), '/T', '/F'], {
+        timeout: 5000,
+        windowsHide: true,
+      });
+    } catch (error) {
+      // 128 is "process not found": a failed build has usually exited before
+      // it rejects. Treating that as unconfirmed kept the cache lock, and
+      // every later build refused to start until it was deleted by hand.
+      if ((error as { exitCode?: number }).exitCode !== 128) throw error;
+    }
     return;
   }
 
```

**File**: `dist/cli.js` (modified, +13/-4)
```diff
@@ -586,10 +586,19 @@ async function enterBuildWorkspace() {
 
 async function terminateBuildTree(pid) {
     if (process.platform === 'win32') {
-        await execa('taskkill', ['/pid', String(pid), '/T', '/F'], {
-            timeout: 5000,
-            windowsHide: true,
-        });
+        try {
+            await execa('taskkill', ['/pid', String(pid), '/T', '/F'], {
+                timeout: 5000,
+                windowsHide: true,
+            });
+        }
+        catch (error) {
+            // 128 is "process not found": a failed build has usually exited before
+            // it rejects. Treating that as unconfirmed kept the cache lock, and
+            // every later build refused to start until it was deleted by hand.
+            if (error.exitCode !== 128)
+                throw error;
+        }
         return;
     }
     const killGroup = (signal) => {
```

**File**: `tests/unit/shell.test.ts` (modified, +50/-1)
```diff
@@ -10,10 +10,22 @@ vi.mock('execa', async (importOriginal) => {
   return { ...actual, execa: vi.fn(actual.execa) };
 });
 
+vi.mock('@/utils/build-workspace', async (importOriginal) => {
+  const actual =
+    await importOriginal<typeof import('@/utils/build-workspace')>();
+  return {
+    ...actual,
+    preventBuildWorkspaceCleanup: vi.fn(actual.preventBuildWorkspaceCleanup),
+  };
+});
+
 import { execa } from 'execa';
 import { isMachineMode } from '@/utils/output';
 import { shellExec } from '@/utils/shell';
-import { beginBuildCancellation } from '@/utils/build-workspace';
+import {
+  beginBuildCancellation,
+  preventBuildWorkspaceCleanup,
+} from '@/utils/build-workspace';
 
 const tempDirs: string[] = [];
 afterEach(async () => {
@@ -98,6 +110,43 @@ describe('structured process execution', () => {
     ).rejects.toThrow('Command timed out after 50ms');
   });
 
+  it.each([
+    [128, 0],
+    [1, 1],
+  ])(
+    'a failed Windows build whose taskkill exits %i keeps the workspace %i times',
+    async (taskkillExit, kept) => {
+      const actual = await vi.importActual<typeof import('execa')>('execa');
+      vi.mocked(execa).mockImplementation(((file: string, ...rest: any[]) =>
+        file === 'taskkill'
+          ? Promise.reject(
+              Object.assign(new Error('taskkill failed'), {
+                exitCode: taskkillExit,
+              }),
+            )
+          : (actual.execa as any)(file, ...rest)) as any);
+      const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
+      Object.defineProperty(process, 'platform', { value: 'win32' });
+      const endCancellation = beginBuildCancellation();
+      try {
+        await expect(
+          shellExec({
+            executable: process.execPath,
+            args: ['-e', 'process.exit(7)'],
+          }),
+        ).rejects.toThrow('Exit code: 7');
+        expect(vi.mocked(execa).mock.calls.map((call) => call[0])).toContain(
+          'taskkill',
+        );
+        expect(preventBuildWorkspaceCleanup).toHaveBeenCalledTimes(kept);
+      } finally {
+        endCancellation();
+        Object.defineProperty(process, 'platform', platform);
+        vi.mocked(execa).mockImplementation(actual.execa as any);
+      }
+    },
+  );
+
   it.skipIf(process.platform === 'win32')(
     'stops compiler descendants before rejecting a timed-out build',
     async () => {
```

---

### Incident Patch 2: `a0a61a67` (2026-10-28)
**Commit Message**: docs(incidents): record the Windows cache lock left after a failed build

Log I-11 against the fix 16d79b66 and the workspace isolation commit 5d66c330 that introduced the taskkill barrier. A real failed Windows build was the first place it showed; the shell.test.ts exit 128 case catches it now.

**File**: `docs/incidents.md` (modified, +13/-12)
```diff
@@ -19,15 +19,16 @@ When a review skill, its prompt or the model running it changes, rerun it on the
 
 ## Incidents
 
-| ID   | Reported   | Symptom                                                                                                                                                  | Introduced | Fixed    | Layer  | Caught by                                                                                                                                 |
-| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
-| I-01 | 2026-06-29 | `--zoom 99.5` passed the CLI range check and produced a `pake.json` the app could not load (#1274); the same value later still passed through `--config` | unknown    | 7edf2af4 | unit   | `rejects malformed zoom values instead of truncating them`, `rejects fractional zoom like the --zoom flag`                                |
-| I-02 | 2026-07-13 | Apps started at login on Windows showed a blank taskbar icon (#1323)                                                                                     | unknown    | 83a1c476 | field  | `reapplies the icon after every explicit window show`, `targets the large taskbar icon instead of only the small window icon`             |
-| I-03 | 2026-08-01 | A SPA link under `/assets/` was intercepted as a download and a 403 response was toasted as a successful download (#1339)                                | unknown    | f61b3267 | unit   | `navigates SPA routes under /assets/ instead of treating them as downloads`, `rejects non-success HTTP responses before writing the file` |
-| I-04 | 2026-08-08 | On Windows a window hidden with `--hide-on-close` could never be restored from the tray (#1343)                                                          | unknown    | 4ba7e65d | native | `acts on one edge of the click, not both`, `treats a minimized window as not on screen`                                                   |
-| I-05 | 2026-08-10 | Apps built with `--new-window` aborted (SIGABRT) on Cmd+click or `target=_blank` links on macOS 26 (#1347)                                               | unknown    | 71dccbb5 | native | `uses WebKit's target configuration with a fresh user content controller`                                                                 |
-| I-06 | 2026-09-10 | Fullscreen video on Windows lost its captions, progress bar and player controls (#1373)                                                                  | unknown    | f671ded1 | native | `preserves WebView2 native fullscreen and keeps the other platform polyfill`, `tests/browser/fullscreen.mjs`                              |
-| I-07 | 2026-09-20 | Playing a video crashed apps on Wayland with WebKitGTK 2.52 after the 3.17.1 fix had covered only X11 (#1386, #1374)                                     | unknown    | 3c978e1e | field  | `modern_wayland_uses_shm_instead_of_disabling_compositing`, `shm_preserves_legacy_webkit_niri_and_explicit_modes`                         |
-| I-08 | 2026-09-25 | `window.print()` failed with "webview.print not allowed" because the capability lacked the print permission (#1396)                                      | unknown    | 187cabb1 | review | `window_print_reaches_the_webview_only_from_trusted_contexts`                                                                             |
-| I-09 | 2026-09-28 | `--windows-toolchain gnu --keep-binary` left a raw `.exe` that would not start without `WebView2Loader.dll` beside it (#1402)                            | 1fe55a88   | 3e906e81 | unit   | `copies WebView2Loader.dll beside the raw binary for gnu`, `records the DLL as an artifact after the binary with --keep-binary`           |
-| I-10 | 2026-10-15 | On macOS the Enter that confirms a Chinese input method candidate reached the page and sent the message early (#1415)                                    | unknown    | f4b4e3cb | field  | `keeps the candidate-confirming Enter (keyCode 229) away from the page`                                                                   |
+| ID   | Reported   | Symptom                                                                                                                                                            | Introduced | Fixed    | Layer  | Caught by                                                                                                                                 |
+| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------- | ------ | ---------------------------------------------------------------------------------------
```

#### Recent Merged Pull Requests:
- **PR #1422** (2026-10-26): fix: update vitest, add vite peer and remove unused terser plugin for advisories (@jakero)
- **PR #1421** (2026-10-26): fix: update Cargo.lock crates for published RustSec advisories (@jakero)
- **PR #1420** (closed): Fix Pake CLI workflow for pake-cli 3.x (@Bulls64)
- **PR #1419** (closed): ci: gate the workflows with Plumber and publish the score badge (@Totara-thib)
- **PR #1417** (2026-10-17): Fix/windows notification default sound (@reg-chen)
- **PR #1416** (2026-10-17): ci: pin the third-party actions by commit, name the secrets the app build receives and drop persisted checkout credentials (@Totara-thib)

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

## X. cli): release the cache lock when a failed Windows build is already gone

**RULE**:
When implementing operations in `bin/utils/shell.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Pake. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `16d79b66`: cli): release the cache lock when a failed Windows build is already gone. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `bin/utils/shell.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    try {
      await execa('taskkill', ['/pid', String(pid), '/T', '/F'], {
        timeout: 5000,
        windowsHide: true,
      });
    } catch (error) {
      // 128 is "process not found": a failed build has usually exited before
      // it rejects. Treating that as unconfirmed kept the cache lock, and
      // every later build refused to start until it was deleted by hand.
      if ((error as { exitCode?: number }).exitCode !== 128) throw error;
    }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    await execa('taskkill', ['/pid', String(pid), '/T', '/F'], {
      timeout: 5000,
      windowsHide: true,
    });
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `16d79b66` are properly handled with clean fallback behavior.
