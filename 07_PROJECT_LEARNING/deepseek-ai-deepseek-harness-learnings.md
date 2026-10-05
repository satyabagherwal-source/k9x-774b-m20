# Forensic Learning Record (Deep Inspection): deepseek-ai/deepseek-harness

> **Canonical Artifact**: `07_PROJECT_LEARNING/deepseek-ai-deepseek-harness-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:11:48.280Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `deepseek-ai/deepseek-harness`
- **Description**: DeepSeek Harness: Everything is a Plugin.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 243928 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/desktop-host/src/office-engine.ts`
```
/** Resolve packaged Office engine manifests from their complete, unpacked resource directories. */
import { registerHooks, type ModuleHooks } from 'node:module'
import { realpathSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Locate the archive containing a packaged runtime.
 * @param runtimeDir - Prepared or ASAR-contained runtime directory.
 * @returns Parent archive path, or undefined for a prepared directory.
 */
export function runtimeArchivePath(runtimeDir: string): string | undefined {
  const parent = dirname(runtimeDir)
  return basename(parent) === 'app.asar' ? parent : undefined
}

/**
 * Keep engine executable and resource paths usable by native child processes outside Electron.
 * Hooks apply only to this thread; worker threads must install their own resolver.
 * @param runtimeDir - Prepared or ASAR-contained dsh runtime directory.
 * @returns Installed resolver for the Host lifetime, or undefined for a non-ASAR runtime.
 */
export function installOfficeEngineResolution(runtimeDir: string): ModuleHooks | undefined {
  if (runtimeArchivePath(runtimeDir) === undefined) return undefined
  const root = realpathSync(runtimeDir)
  const archive = dirname(root)
  const source = pathToFileURL(join(root, 'node_modules', '@deepseek-ai', 'libreoffice-kit-')).href
  const destination = pathToFileURL(join(`${archive}.unpacked`, relative(archive, root), 'node_modules', '@deepseek-ai', 'libreoffice-kit-')).href
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context)
      if (!resolved.url.startsWith('file:')) return resolved
      const engineRequest = /^@deepseek-ai\/libreoffice-kit-(?:darwin|win32|linux)-/u.test(specifier)
      const engineTarget = /\/node_modules\/@deepseek-ai\/libreoffice-kit-(?:darwin|win32|linux)-[^/]+\//u
        .test(new URL(resolved.url).pathname)
      if (!engineRequest && !engineTarget) return resolved
      const canonical = pathToFileURL(realpathSync(fileURLToPath(resolved.url))).href
      if (!canonical.startsWith(source)) {
        if (canonical.startsWith(pathToFileURL(archive + '/').href)) {
          throw new Error(`desktop Office engine resolved outside the runtime package directory: ${resolved.url}`)
        }
        return resolved
      }
      const physical = realpathSync(fileURLToPath(destination + canonical.slice(source.length)))
      return { ...resolved, url: pathToFileURL(physical).href }
    },
  })
}

```

### Core Architecture Module: `apps/desktop/renderer/mandatory-update-frame.js`
```
/** The embedded shell page delegates actions only to its owning application preload. */
if (window.parent !== window && window.dshMandatoryUpdate === undefined) {
  let state
  let port
  let sequence = 0
  const listeners = new Set()
  const requests = new Map()
  const initial = Promise.withResolvers()
  const receive = event => {
    const message = event.data
    if (message?.type === 'dsh-mandatory-state' && message.state) {
      state = message.state
      initial.resolve(state)
      for (const listener of listeners) listener(state)
    }
    if (message?.type === 'dsh-mandatory-result') {
      const request = requests.get(message.id)
      if (!request) return
      requests.delete(message.id)
      if (message.ok) request.resolve()
      else request.reject(new Error('Update action failed'))
    }
  }
  window.addEventListener('message', event => {
    if (!event.isTrusted || event.source !== window.parent || event.origin !== 'dsh-app://app'
      || event.data?.type !== 'dsh-mandatory-connect' || event.ports.length !== 1 || port) return
    port = event.ports[0]
    port.onmessage = receive
  })
  window.addEventListener('pagehide', () => { port?.close() }, { once: true })
  window.dshMandatoryUpdate = {
    status: () => state ? Promise.resolve(state) : initial.promise,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    action: (action, version, revision) => {
      const id = ++sequence
      const request = Promise.withResolvers()
      requests.set(id, request)
      port.postMessage({ type: 'dsh-mandatory-action', id, action, version, revision })
      return request.promise
    },
  }
}

```

### Core Architecture Module: `apps/desktop/renderer/mandatory-update.js`
```
/** Text-only policy rendering; the main process owns task inspection and every privileged action. */
const api = window.dshMandatoryUpdate
let current
let busy = false
let localError
const element = id => document.getElementById(id)
const format = (message, values) => message.replaceAll(/\{([^{}]+)\}/gu, (match, key) => values[key] ?? match)

function render(view) {
  document.body.classList.toggle('visible', view.policy.blocking)
  if (!view.policy.blocking) return
  const wasConfirming = current?.confirmation !== undefined
  current = view
  const { locale: { id, messages }, policy, update, confirmation, navigation } = view
  const confirming = confirmation !== undefined
  const failed = update.phase === 'error'
  const ready = update.phase === 'ready' || (failed && update.failedOperation === 'install')
  const downloadable = update.phase === 'available' || (failed && update.failedOperation === 'download')
  const authenticationRequired = policy.error === 'authentication-required'
  const preparationMessages = {
    'stop-failed': messages.updateStopFailed,
    'tasks-changed': messages.updateTasksChanged,
    'tasks-unavailable': messages.updateTasksUnavailable,
  }
  const fallback = failed || update.phase === 'idle' || view.error !== undefined
  let title = policy.title ?? messages.mandatoryTitle
  let detail = policy.detail ?? messages.mandatoryDetail
  let primary = '', action = '', status = ''
  if (downloadable) { primary = failed ? messages.updateRetry : messages.updateDownload; action = 'download' }
  if (ready) { primary = view.deferred ? messages.mandatoryContinue : messages.updateRetry; action = 'install' }
  if (view.deferred) { title = messages.mandatoryReady; detail = messages.mandatoryDeferred }
  if (update.phase === 'downloading') status = format(messages.updateDownloading, { percent: String(Math.floor(update.percent ?? 0)) })
  if (update.phase === 'verifying') status = messages.updateVerifying
  if (update.phase === 'installing') status = messages.mandatoryInspecting
  if (update.phase === 'checking' || (policy.checking && ['idle', 'error'].includes(update.phase))) status = messages.updateChecking
  if (confirming) {
    title = confirmation.active ? messages.updateActiveTasks : messages.mandatoryReady
    detail = confirmation.active ? messages.updateActiveTasksDetail : messages.mandatoryReadyDetail
    primary = confirmation.active ? messages.updateStopTasks : messages.installAndRestart
    action = 'install'; status = ''
  }
  if (view.restart !== undefined) {
    title = messages.updateInstalling
    detail = view.restart === 'stopping-tasks' ? messages.mandatoryStopping : messages.mandatoryRestarting
    status = ''; primary = ''; action = ''
  }
  const error = localError ?? view.error ?? (authenticationRequired ? messages.policyLoginRequired : failed
    ? update.failedOperation === 'download' ? messages.mandatoryDownloadFailed
      : update.failedOperation === 'install'
        ? preparationMessages[update.preparationFailure] ?? messages.mandatoryInstallFailed
        : messages.mandatoryUnavailable
    : update.phase === 'idle' && !policy.checking ? messages.mandatoryNoRelease : undefined)
  const technicalDetails = failed ? update.technicalDetails ?? update.message ?? '' : ''
  document.documentElement.lang = id
  document.title = messages.mandatoryTitle
  element('title').textContent = title
  element('detail').textContent = detail
  element('status').textContent = status
  element('version').textContent = update.version === undefined ? '' : format(messages.mandatoryVersion, { version: update.version })
  element('progress').hidden = update.phase !== 'downloading'
  element('progress').value = update.percent ?? 0
  element('progress').setAttribute('aria-label', status)
  element('error').textContent = error ?? ''
  element('error').hidden = error === undefined || confirming
  if (element('technical-details-content').textContent !== technicalDetails) element('technical-details').open = false
  element('technical-details').hidden = technicalDetails === '' || confirming
  element('technical-details-label').textContent = messages.updateTechnicalDetails
  element('technical-details-content').textContent = technicalDetails
  element('update').hidden = !primary
  element('update').textContent = primary
  element('update').dataset.action = action
  element('update').disabled = busy && !confirming
  element('later').textContent = messages.updateLater
  element('later').hidden = !confirmation?.active
  element('refresh').textContent = authenticationRequired ? messages.policyLogin : messages.mandatoryRefresh
  element('refresh').hidden = confirming || view.restart !== undefined || (!authenticationRequired && (!!primary || !fallback))
  element('refresh').disabled = busy || policy.checking
  element('page').textContent = navigation ? messages.mandatoryReopen : messages.mandatoryPage
  element('page').hidden = !fallback || confirming || policy.page === undefined
  element('actions').hidden = [...element('actions').children].every(child => child.hidden)
  element('fallback').hidden = !navigation || !fallback || confirming || policy.page === undefined
  element('browser-message').textContent = navigation?.page === 'failed' ? messages.mandatoryPageFailed : messages.mandatoryOpenHelp
  element('copy').textContent = navigation?.copy === 'copied' ? messages.mandatoryCopied : messages.mandatoryCopy
  element('copy-message').textContent = navigation?.copy === 'failed' ? messages.mandatoryCopyFailed : ''
  element('manual-copy').hidden = navigation?.copy !== 'failed'
  element('address-label').textContent = messages.mandatoryAddress
  element('address').value = navigation?.copy === 'failed' ? policy.page ?? '' : ''
  // A download button can become an install button while a key remains held.
  if (confirming && !wasConfirming && document.activeElement?.id === 'update') document.activeElement.blur()
}

async function act(action) {
  const navigation = ['page', 'copy'].includes(action)
  const confirmation = current?.confirmation !== undefined && ['install', 'later'].includes(action)
  if (current === undefined || (busy && !navigation && !confirmation)) return
  if (!navigation) busy = true
  localError = undefined
  render(current)
  try { await api.action(action, current.confirmation?.version ?? current.update.version, current.confirmation?.revision) }
  catch { localError = current.locale.messages.mandatoryActionFailed }
  finally { if (!navigation) busy = false; render(current) }
}

for (const action of ['refresh', 'page', 'copy', 'later']) element(action).addEventListener('click', () => { void act(action) })
element('update').addEventListener('click', event => {
  if (event.detail <= 1) void act(element('update').dataset.action)
})
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' || (event.repeat && ['Enter', ' '].includes(event.key))) event.preventDefault()
})
let changed = false
const unsubscribe = api.subscribe(view => { changed = true; render(view) })
window.addEventListener('pagehide', unsubscribe, { once: true })
void api.status().then(view => { if (!changed) render(view) })

```

### Core Architecture Module: `apps/desktop/renderer/update-dialog.js`
```
/** Main-owned copy and responses; Escape is cancellation, never acceptance. */
const api = window.dshUpdateDialog
let view
let responding = false
function respond(index) {
  if (responding || view === undefined) return
  responding = true
  void api.respond(view.revision, index).catch(() => { responding = false })
}
document.getElementById('close').addEventListener('click', () => { respond(view.cancelId) })
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && view !== undefined) { event.preventDefault(); respond(view.cancelId) }
  if (event.key !== 'Tab') return
  const controls = [...document.querySelectorAll('button, details:not([hidden]) > summary, details[open]:not([hidden]) > pre')]
  const current = controls.indexOf(document.activeElement)
  const next = current < 0 ? (event.shiftKey ? controls.length - 1 : 0)
    : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
  event.preventDefault()
  controls[next].focus()
})
function render(state) {
  if (state === null) {
    responding = true
    document.body.classList.remove('visible')
    return
  }
  if (view !== undefined && state.revision <= view.revision) return
  responding = false
  view = state
  document.documentElement.lang = state.locale
  document.title = state.title
  document.getElementById('title').textContent = state.message
  document.getElementById('detail').textContent = state.detail
  document.getElementById('detail').hidden = state.detail === ''
  document.getElementById('close').setAttribute('aria-label', state.closeLabel)
  document.getElementById('technical-details').hidden = state.technicalDetails === ''
  document.getElementById('technical-details-label').textContent = state.technicalDetailsLabel
  document.getElementById('technical-details-content').textContent = state.technicalDetails
  document.getElementById('technical-details').open = false
  document.getElementById('actions').replaceChildren()
  for (const [index, label] of state.buttons.entries()) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.className = index === 0 ? 'primary' : 'secondary'
    button.addEventListener('click', () => { respond(index) })
    document.getElementById('actions').append(button)
  }
  document.querySelector('main').hidden = false
  document.getElementById('dialog').scrollTop = 0
  document.body.classList.add('visible')
  document.getElementById('dialog').focus()
}
let received = false
const unsubscribe = api.subscribe(state => { received = true; render(state) })
window.addEventListener('pagehide', unsubscribe, { once: true })
void api.status().then(state => { if (!received) render(state) })

```

### Core Architecture Module: `apps/desktop/scripts/render-tray-icon.ts`
```
/**
 * Render the Windows tray icon with an enlarged whale from `resources/icon-windows.svg`.
 *
 * The tray shows the icon at 16 logical pixels, so Windows picks one of the
 * bundled bitmaps by display scale. Each size is rasterized from the vector
 * source separately instead of downscaling one large bitmap, which keeps edges
 * crisp at every scale. The committed `resources/tray-windows.ico` is the output;
 * rerun `pnpm run render:tray-icon` in `apps/desktop` after changing the vector source.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/** Bitmap edge lengths bundled in the tray icon: 16 px at 100 % through 400 % display scale. */
export const TRAY_ICON_SIZES = [16, 20, 24, 32, 40, 48, 64] as const

/** Vector source and committed output of the tray icon. */
export const TRAY_ICON_PATHS = {
  source: fileURLToPath(new URL('../resources/icon-windows.svg', import.meta.url)),
  output: fileURLToPath(new URL('../resources/tray-windows.ico', import.meta.url)),
} as const

/** Coordinate space of the vector source; sharp's SVG density is scaled against it. */
const SOURCE_EDGE = 1024
const SOURCE_DENSITY = 72
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ICON_DIRECTORY_BYTES = 6
const ICON_ENTRY_BYTES = 16

/** One bitmap of an icon file. */
export interface IcoEntry {
  readonly size: number
  /** Complete PNG stream; Windows Vista and later read PNG-compressed entries directly. */
  readonly png: Buffer
}

/**
 * Pack PNG bitmaps into one ICO file.
 * @param entries - Bitmaps in ascending size; each PNG must be square with the declared edge.
 * @returns the ICO bytes.
 */
export function packIco(entries: readonly IcoEntry[]): Buffer {
  const header = Buffer.alloc(ICON_DIRECTORY_BYTES + ICON_ENTRY_BYTES * entries.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = header.length
  entries.forEach((entry, index) => {
    if (entry.size < 1 || entry.size > 256) throw new Error(`tray icon: unsupported bitmap edge ${String(entry.size)}`)
    const { width, height } = pngDimensions(entry.png)
    if (width !== entry.size || height !== entry.size) {
      throw new Error(`tray icon: bitmap ${String(index)} is ${String(width)}x${String(height)}, expected ${String(entry.size)}`)
    }
    const at = ICON_DIRECTORY_BYTES + ICON_ENTRY_BYTES * index
    // 256 px is encoded as 0 in the one-byte edge fields.
    header.writeUInt8(entry.size % 256, at)
    header.writeUInt8(entry.size % 256, at + 1)
    header.writeUInt8(0, at + 2)
    header.writeUInt8(0, at + 3)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(entry.png.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += entry.png.length
  })
  return Buffer.concat([header, ...entries.map(entry => entry.png)])
}

/**
 * Read the bitmaps back out of one ICO file.
 * @param ico - Bytes written by {@link packIco} or another PNG-entry ICO producer.
 * @returns entries in directory order, each PNG checked against its declared edge.
 */
export function unpackIco(ico: Buffer): IcoEntry[] {
  if (ico.length < ICON_DIRECTORY_BYTES || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
    throw new Error('tray icon: not an ICO file')
  }
  const count = ico.readUInt16LE(4)
  return Array.from({ length: count }, (_, index) => {
    const at = ICON_DIRECTORY_BYTES + ICON_ENTRY_BYTES * index
    const declared = ico.readUInt8(at)
    const size = declared === 0 ? 256 : declared
    const length = ico.readUInt32LE(at + 8)
    const offset = ico.readUInt32LE(at + 12)
    const png = ico.subarray(offset, offset + length)
    const { width, height } = pngDimensions(png)
    if (width !== size || height !== size) throw new Error(`tray icon: entry ${String(index)} declares ${String(size)} but holds ${String(width)}x${String(height)}`)
    return { size, png }
  })
}

/**
 * Rasterize the vector source at each tray size.
 * @param svg - SVG document with a 1024-unit square viewBox and a `tray-glyph` group.
 * @param sizes - Bitmap edges to render.
 * @returns PNG entries in the given order.
 */
export async function renderTrayIconEntries(svg: Buffer, sizes: readonly number[] = TRAY_ICON_SIZES): Promise<IcoEntry[]> {
  const source = svg.toString('utf8')
  const glyph = '<g id="tray-glyph"'
  if (!source.includes(glyph)) throw new Error('tray icon: SVG requires a tray-glyph group')
  // Scale around the application tile center, retaining its background and the whale's aspect ratio.
  const tray = Buffer.from(source.replace(glyph, `${glyph} transform="translate(552 544) scale(1.2) translate(-552 -544)"`))
  return Promise.all(sizes.map(async size => ({
    size,
    png: await sharp(tray, { density: SOURCE_DENSITY * size / SOURCE_EDGE }).resize(size, size).png().toBuffer(),
  })))
}

function pngDimensions(png: Buffer): { width: number; height: number } {
  if (png.length < 24 || !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) throw new Error('tray icon: bitmap is not a PNG stream')
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

async function main(): Promise<void> {
  const entries = await renderTrayIconEntries(await readFile(TRAY_ICON_PATHS.source))
  await writeFile(TRAY_ICON_PATHS.output, packIco(entries))
  console.info(`tray icon: wrote ${TRAY_ICON_PATHS.output} with ${entries.map(entry => String(entry.size)).join(', ')} px bitmaps`)
}

if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) await main()

```

### Core Architecture Module: `apps/desktop/scripts/windows-signing-state.mjs`
```
/** Persist a per-user hardware-signing interlock; failures and interrupted attempts never unlock automatically. */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import { failPackagingRun, recordPackagingEvent } from './packaging-run.mjs'

/**
 * Acquire the one hardware-signing attempt slot before launching SignTool.
 * @param {{runDirectory?: string, stateDirectory?: string, target: string}} options Run evidence and test-only isolated state directory.
 * @returns {{started: (pid: number|null) => void, success: () => void, failure: (code: number|string|null, diagnostic: string) => void}} Process evidence and completion callbacks; failure retains the interlock.
 */
export function beginWindowsSigningAttempt(options) {
  const runDirectory = options.runDirectory ?? process.env.DSH_DESKTOP_PACKAGING_RUN_DIR
  if (!runDirectory || !isAbsolute(runDirectory) || !existsSync(join(runDirectory, 'run.json'))) {
    throw new Error('Windows hardware signing requires a supervised packaging run with retained records')
  }
  if (existsSync(join(runDirectory, 'fatal.json'))) throw new Error('Windows signing refused: packaging run already failed')
  const root = options.stateDirectory ?? join(homedir(), '.dsh-desktop-signing')
  const lock = join(root, 'attempt.json')
  const attemptId = randomUUID()
  mkdirSync(root, { recursive: true })
  let descriptor
  try { descriptor = openSync(lock, 'wx', 0o600) }
  catch (error) {
    failPackagingRun(runDirectory, 'hardware-signing-interlock-unavailable')
    throw new Error(`Windows signing refused: interlock unavailable at ${lock}; inspect the previous attempt before administrator-approved recovery (${error.code})`)
  }
  try {
    writeFileSync(descriptor, `${JSON.stringify({ attemptId, runDirectory, pid: process.pid, startedAt: new Date().toISOString(), target: options.target })}\n`, { flush: true })
  } finally { closeSync(descriptor) }
  try { recordPackagingEvent(runDirectory, { type: 'sign-start', attemptId, target: options.target }) }
  catch (error) { failPackagingRun(runDirectory, 'signing-audit-write-failed'); throw error }
  return {
    started(pid) {
      recordPackagingEvent(runDirectory, { type: 'sign-command-start', attemptId, commandPid: pid })
    },
    success() {
      recordPackagingEvent(runDirectory, { type: 'sign-success', attemptId, target: options.target })
      if (JSON.parse(readFileSync(lock, 'utf8')).attemptId !== attemptId) throw new Error('Windows signing interlock ownership changed')
      unlinkSync(lock)
    },
    failure(code, diagnostic) {
      // The attempt file stays in place even if recording the failure or notifying the parent fails.
      try { recordPackagingEvent(runDirectory, { type: 'sign-failure', attemptId, target: options.target, code, diagnostic }) }
      finally { failPackagingRun(runDirectory, 'hardware-signing-failed') }
    },
  }
}

```

### Core Architecture Module: `apps/desktop/src/core-package-set.ts`
```
/** Signed local npm package set that supplies the Desktop-owned dsh runtime and private Host. */

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Descriptor copied beside every Desktop profile's local core tarballs. */
export const DESKTOP_PACKAGE_SET_FILE = 'desktop-packages.json'

/** Profile-relative directory containing immutable core npm tarballs. */
export const DESKTOP_PACKAGES_DIR = 'desktop-packages'

/** Private package installed beside dsh to boot the Desktop Host process. */
export const DESKTOP_HOST_PACKAGE = '@deepseek-ai/dsh-desktop-host'

/** Package-relative Desktop Host files required before a profile can boot. */
export const DESKTOP_HOST_RUNTIME_FILES = [
  'lib/index.js',
  'lib/cli.js',
] as const

/** One immutable npm tarball in the Desktop core package set. */
export interface DesktopCorePackageRecord {
  readonly name: string
  readonly version: string
  readonly file: string
  readonly bytes: number
  readonly integrity: string
}

/** Complete union of the first-party package closures rooted at dsh and its private Desktop Host. */
export interface DesktopCorePackageSet {
  readonly schemaVersion: 1
  readonly packages: readonly DesktopCorePackageRecord[]
}

const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/[a-z0-9][a-z0-9._~-]*|[a-z0-9][a-z0-9._~-]*)$/u
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/u
const FILE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.tgz$/u
const INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]+={0,2}$/u
const DSH_PACKAGE = '@deepseek-ai/dsh'
const RELEASE_PACKAGES = [DSH_PACKAGE, DESKTOP_HOST_PACKAGE] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validate package-set data read from a release artifact or active profile.
 * @param value - Parsed descriptor JSON.
 * @param expectedReleaseVersion - Required dsh and Desktop Host version when validating one release.
 * @returns The normalized package set in deterministic name order.
 */
export function parseDesktopCorePackageSet(
  value: unknown,
  expectedReleaseVersion?: string,
): DesktopCorePackageSet {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.packages)) {
    throw new Error('desktop package set: invalid descriptor')
  }
  const packages = value.packages.map((entry): DesktopCorePackageRecord => {
    if (!isRecord(entry) || typeof entry.name !== 'string' || !PACKAGE_NAME_PATTERN.test(entry.name)
      || typeof entry.version !== 'string' || !VERSION_PATTERN.test(entry.version)
      || typeof entry.file !== 'string' || !FILE_PATTERN.test(entry.file)
      || typeof entry.bytes !== 'number' || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0
      || typeof entry.integrity !== 'string' || !INTEGRITY_PATTERN.test(entry.integrity)) {
      throw new Error('desktop package set: invalid package record')
    }
    return {
      name: entry.name,
      version: entry.version,
      file: entry.file,
      bytes: entry.bytes,
      integrity: entry.integrity,
    }
  })
  const names = new Set(packages.map(entry => entry.name))
  const files = new Set(packages.map(entry => entry.file))
  if (names.size !== packages.length || files.size !== packages.length) {
    throw new Error('desktop package set: duplicate package name or filename')
  }
  const sorted = [...packages].sort((left, right) => left.name.localeCompare(right.name))
  if (JSON.stringify(sorted) !== JSON.stringify(packages)) {
    throw new Error('desktop package set: packages must be sorted by name')
  }
  for (const name of RELEASE_PACKAGES) {
    const entry = packages.find(candidate => candidate.name === name)
    if (entry === undefined) throw new Error(`desktop package set: missing ${name}`)
    if (expectedReleaseVersion !== undefined && entry.version !== expectedReleaseVersion) {
      throw new Error(`desktop package set: ${name}@${entry.version} does not match Desktop ${expectedReleaseVersion}`)
    }
  }
  return { schemaVersion: 1, packages }
}

/** Read and structurally validate one profile's core package descriptor. */
export function readDesktopCorePackageSet(projectDir: string, expectedReleaseVersion?: string): DesktopCorePackageSet {
  const path = join(projectDir, DESKTOP_PACKAGE_SET_FILE)
  let value: unknown
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`desktop package set: failed to read ${path}: ${String(error)}`)
  }
  return parseDesktopCorePackageSet(value, expectedReleaseVersion)
}

/** Return the project-relative `file:` spec for one local core tarball. */
export function desktopCorePackageSpec(record: DesktopCorePackageRecord): string {
  return `file:./${DESKTOP_PACKAGES_DIR}/${record.file}`
}

/** Return the exact pnpm override map that keeps every core package off registries. */
export function desktopCorePackageOverrides(packageSet: DesktopCorePackageSet): Record<string, string> {
  return Object.fromEntries(packageSet.packages.map(record => [record.name, desktopCorePackageSpec(record)]))
}

/** Return the local direct dependency spec for the dsh package. */
export function desktopDshPackageSpec(packageSet: DesktopCorePackageSet): string {
  const record = packageSet.packages.find(entry => entry.name === DSH_PACKAGE)
  if (record === undefined) throw new Error(`desktop package set: missing ${DSH_PACKAGE}`)
  return desktopCorePackageSpec(record)
}

/**
 * Verify every local tarball and reject extra package files before pnpm executes them.
 * @param projectDir - Build directory containing the package set.
 * @param expectedReleaseVersion - Exact dsh and Desktop Host version bound to Electron.
 * @returns The verified package set.
 */
export function verifyDesktopCorePackageSet(
  projectDir: string,
  expectedReleaseVersion: string,
): DesktopCorePackageSet {
  const packageSet = readDesktopCorePackageSet(projectDir, expectedReleaseVersion)
  const packageDir = join(projectDir, DESKTOP_PACKAGES_DIR)
  const expectedFiles = packageSet.packages.map(entry => entry.file).sort()
  let actualFiles: string[]
  try {
    actualFiles = readdirSync(packageDir).sort()
  } catch (error) {
    throw new Error(`desktop package set: failed to read ${packageDir}: ${String(error)}`)
  }
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error('desktop package set: package directory does not match its descriptor')
  }
  for (const record of packageSet.packages) {
    const path = join(packageDir, record.file)
    if (!existsSync(path) || !lstatSync(path).isFile()) {
      throw new Error(`desktop package set: ${record.file} is not a regular file`)
    }
    const body = readFileSync(path)
    const integrity = `sha512-${createHash('sha512').update(body).digest('base64')}`
    if (body.byteLength !== record.bytes || integrity !== record.integrity) {
      throw new Error(`desktop package set: integrity check failed for ${record.file}`)
    }
  }
  return packageSet
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/**
 * Reject a lockfile that resolved any packaged core name through a registry version.
 * @param lockfile - Generated pnpm lockfile text.
 * @param packageSet - Verified local core package set.
 */
export function verifyDesktopCoreLockfile(
  lockfile: string,
  packageSet: DesktopCorePackageSet,
): void {
  for (const record of packageSet.packages) {
    const registryResolution = new RegExp(
      `^  ['"]?${escapeRegExp(record.name)}@${escapeRegExp(record.version)}(?:\\([^\\r\\n]*\\))?['"]?:`,
      'mu',
    )
    if (registryResolution.test(lockfile)) {
      throw new Error(`desktop package set: lockfile resolved ${record.name}@${record.version} outside the local package set`)
    }
  }
}

```

### Core Architecture Module: `benchmarks/active-stream-reconnect/reconnect.worker.client.ts`
```
/** Compiled production Client fold for a reconnect during a long Assistant attempt. */
import { performance } from 'node:perf_hooks'
import { AssistantStreamAccumulator } from '@deepseek-ai/dsh-llm/assistant-stream'
import { LlmAttemptId } from '@deepseek-ai/dsh-llm/brand'
import type { SessionAssistantStreamBaseline } from '@deepseek-ai/dsh-api-session-controller/types'
// The Client implementation has no plain-Node export; only this adapter is bundled.
import { ClientAssistantStream } from '../../packages/api/session-controller/src/client/sessions/assistant-stream.ts'
import { assertBuiltBenchmarkRuntime } from '../support/built-worker.ts'

/** Measurements of replace() only; fixture construction and forced GC are excluded. */
export interface ReconnectReport {
  readonly deltas: number
  readonly records: number
  readonly entries: number
  readonly replaceMs: number
  readonly retainedMb: number
  readonly nextFrame: string | undefined
}

assertBuiltBenchmarkRuntime(import.meta.url, {
  '@deepseek-ai/dsh-llm/assistant-stream': import.meta.resolve('@deepseek-ai/dsh-llm/assistant-stream'),
})
const deltas = 100000
const accumulator = new AssistantStreamAccumulator()
accumulator.push({ time: 1700000000000, chunk: { type: 'block-start', index: 0, blockType: 'reasoning' } })
for (let index = 0; index < deltas; index++) {
  accumulator.push({ time: 1700000000001 + index, chunk: { type: 'reasoning-delta', index: 0, text: 'token ' } })
}
const attemptId = LlmAttemptId('synthetic-reconnect')
const nextIndex = deltas + 1
const baseline: SessionAssistantStreamBaseline = {
  revision: nextIndex + 1,
  activeAttempt: {
    attemptId, startedAfterSeq: -1, turn: 1, step: 1, nextIndex,
    stream: JSON.parse(JSON.stringify(accumulator.snapshot())) as NonNullable<SessionAssistantStreamBaseline['activeAttempt']>['stream'],
  },
}
if (globalThis.gc === undefined) throw new Error('reconnect benchmark requires --expose-gc')
globalThis.gc()
const before = process.memoryUsage().heapUsed
const client = new ClientAssistantStream()
const start = performance.now()
const visible = client.replace([], baseline)
const replaceMs = performance.now() - start
globalThis.gc()
const retainedMb = (process.memoryUsage().heapUsed - before) / 1048576
const next = client.acceptFrame({ type: 'chunk', attemptId, revision: nextIndex + 2, index: nextIndex, time: 1700000000001 + deltas, chunk: { type: 'reasoning-delta', index: 0, text: 'suffix' } })
const report: ReconnectReport = { deltas, records: baseline.activeAttempt!.stream.length, entries: visible.length, replaceMs, retainedMb, nextFrame: next?.type }
process.stdout.write(JSON.stringify(report) + '\n')

```

### Core Architecture Module: `benchmarks/agent-continuation/agent-continuation.worker.ts`
```
/** Plain-Node measurements of active request history and cold tool-heavy continuation. */

import { performance } from 'node:perf_hooks'
import { scheduler } from 'node:timers/promises'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { defineContentToolFixture } from '@deepseek-ai/dsh-tools'
import { assertBuiltBenchmarkRuntime } from '../support/built-worker.ts'
import { PARENT_ID, response, resultText, syntheticHistory, TIME_ZERO, WORKLOAD } from './workload.ts'

/** Raw timing and retained-memory report from one isolated backend process. */
export interface ContinuationReport {
  readonly totalMs: number
  readonly resumeMs: number
  readonly turnsMs: number
  readonly flushMs: number
  readonly cpuUserMs: number
  readonly cpuSystemMs: number
  readonly retainedHeapMb: number
  readonly peakRssMb: number
  readonly requests: number
  readonly toolCalls: number
  readonly events: number
}

class SyntheticAdapter extends LlmAdapter {
  requests = 0
  constructor(private readonly toolsPerTurn: number) { super() }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }

  async * stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    const tools = this.toolsPerTurn > 0 && this.requests % 2 === 0 ? this.toolsPerTurn : 0
    const reply = response(100_000 + this.requests++, tools)
    yield* reply.chunks
  }
}

async function collectHeap(): Promise<number> {
  if (globalThis.gc === undefined) throw new Error('backend benchmark requires --expose-gc')
  globalThis.gc()
  await scheduler.yield()
  globalThis.gc()
  return process.memoryUsage().heapUsed / 1_048_576
}

async function seed(root: string): Promise<void> {
  const ctx = new Context()
  try {
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(JsonlSessionPersistence, { root, compression: 'zstd' })
    const handle = await ctx.sessionPersistence.create({
      version: SESSION_FORMAT_VERSION, id: PARENT_ID, createdAt: TIME_ZERO, cwd: '/bench', isSeeded: false,
    }, {})
    try {
      await handle.append(syntheticHistory(WORKLOAD.historyTurns))
      await handle.flush()
    } finally { await handle.close() }
  } finally { await ctx.fiber.dispose() }
}

async function runTurns(agent: Agent, turns: number): Promise<void> {
  for (let turn = 0; turn < turns; turn++) {
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Continue synthetic task ' + String(turn) }], source: { kind: 'user' } }))
    await agent.whenIdle()
  }
}

async function measure(root: string, scenario: string): Promise<ContinuationReport> {
  const ctx = new Context()
  let handle: AgentHandle | undefined
  const toolHeavy = scenario === 'tool-continuation'
  const adapter = new SyntheticAdapter(toolHeavy ? WORKLOAD.toolsPerLiveTurn : 0)
  let toolCalls = 0
  try {
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(JsonlSessionPersistence, { root, compression: 'zstd' })
    await ctx.plugin(AgentLoop, { agents: [] })
    ctx.effect(() => ctx.llm.registerAdapter(['bench'], adapter))
    ctx.effect(() => ctx.tools.register(defineContentToolFixture({
      name: 'bench_tool', description: 'Read a bounded synthetic module.',
      parameters: { ordinal: { type: 'number', required: true } },
      isConcurrencySafe: () => true,
      execute(args) {
        toolCalls++
        return Promise.resolve([{ type: 'text', text: resultText(args.ordinal) }])
      },
    })))
    if (!toolHeavy) {
      handle = await ctx.agents.resume({ resumeSessionId: PARENT_ID, agentOptions: { provider: 'bench', model: 'bench' } })
    }
    const beforeHeap = await collectHeap()
    const cpuStart = process.cpuUsage()
    const start = performance.now()
    if (handle === undefined) {
      handle = await ctx.agents.resume({ resumeSessionId: PARENT_ID, agentOptions: { provider: 'bench', model: 'bench' } })
    }
    const resumed = performance.now()
    await runTurns(handle.agent, toolHeavy ? WORKLOAD.continuationTurns : WORKLOAD.requestTurns)
    const turnsDone = performance.now()
    await ctx.sessions.flush(handle.agent.session)
    const end = performance.now()
    const cpu = process.cpuUsage(cpuStart)
    const retainedHeapMb = (await collectHeap()) - beforeHeap
    if (adapter.requests !== (toolHeavy ? WORKLOAD.continuationTurns * 2 : WORKLOAD.requestTurns)
      || toolCalls !== (toolHeavy ? WORKLOAD.continuationTurns * WORKLOAD.toolsPerLiveTurn : 0)) {
      throw new Error('backend benchmark did not complete every requested model/tool step')
    }
    return {
      totalMs: end - start, resumeMs: resumed - start, turnsMs: turnsDone - resumed, flushMs: end - turnsDone,
      cpuUserMs: cpu.user / 1_000, cpuSystemMs: cpu.system / 1_000,
      retainedHeapMb, peakRssMb: process.resourceUsage().maxRSS / 1_024,
      requests: adapter.requests, toolCalls, events: handle.agent.session.seq,
    }
  } finally {
    await handle?.dispose()
    await ctx.fiber.dispose()
  }
}

assertBuiltBenchmarkRuntime(import.meta.url, Object.fromEntries([
  '@deepseek-ai/dsh-agent-loop', '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-session-persistence-jsonl',
].map(name => [name, import.meta.resolve(name)])))
const [root, scenario] = process.argv.slice(2)
if (root === undefined || scenario === undefined || !['seed', 'request-history', 'tool-continuation'].includes(scenario)) {
  throw new Error('usage: agent-continuation.worker.js <root> <seed|request-history|tool-continuation>')
}
if (scenario === 'seed') {
  await seed(root)
  process.stdout.write(JSON.stringify({ seeded: true }) + '\n')
} else {
  process.stdout.write(JSON.stringify(await measure(root, scenario)) + '\n')
}

```

### Core Architecture Module: `benchmarks/agent-continuation/child-catalog.worker.ts`
```
/** Cold parent-catalog observations beside fork children with tool-heavy inherited histories. */

import { performance } from 'node:perf_hooks'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SESSION_FORMAT_VERSION, SessionId, SessionLogOffset, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SessionQueryEngine from '@deepseek-ai/dsh-session-query'
import SubagentRuntime, { SUBAGENT_DESCRIPTOR_VERSION } from '@deepseek-ai/dsh-subagent'
import { assertBuiltBenchmarkRuntime } from '../support/built-worker.ts'
import { PARENT_ID, syntheticHistory, TIME_ZERO, WORKLOAD } from './workload.ts'

/** Two complete catalog reads in one fresh Host, with each parent observation released. */
export interface CatalogReport {
  readonly totalMs: number
  readonly firstMs: number
  readonly repeatMs: number
  readonly cpuUserMs: number
  readonly cpuSystemMs: number
  readonly children: number
  readonly peakRssMb: number
}

class CatalogQuery extends SessionQueryEngine {
  override searchSessions(): Promise<never> {
    return Promise.reject(new Error('search is outside the child-catalog benchmark'))
  }
  override searchEvents(): Promise<never> {
    return Promise.reject(new Error('search is outside the child-catalog benchmark'))
  }
}

async function seed(ctx: Context): Promise<void> {
  const inherited = syntheticHistory(WORKLOAD.childHistoryTurns)
  const catalog: SessionEvent[] = []
  for (let child = 0; child < WORKLOAD.children; child++) {
    const id = SessionId('bench-child-' + String(child))
    catalog.push({
      type: 'subagent/catalog', seq: SessionSeq(child), time: TIME_ZERO + child,
      data: { version: 0, childId: id, childCreatedAt: TIME_ZERO + child,
        mode: 'continuable', label: 'Synthetic child ' + String(child) },
    })
    const events: SessionEvent[] = [
      ...inherited,
      { type: 'session/end-seed', seq: SessionSeq(inherited.length), time: TIME_ZERO + inherited.length, data: { inherited: true } },
      { type: 'subagent/descriptor', seq: SessionSeq(inherited.length + 1), time: TIME_ZERO + inherited.length + 1, data: {
        version: SUBAGENT_DESCRIPTOR_VERSION, mode: 'continuable', provider: 'fork', label: 'Synthetic child ' + String(child),
      } },
    ]
    const handle = await ctx.sessionPersistence.create({
      version: SESSION_FORMAT_VERSION, id, createdAt: TIME_ZERO + child, cwd: '/bench',
      parentSession: PARENT_ID, isSeeded: true, origin: 'subagent', delegationDepth: 1,
    }, { inheritedEventCount: SessionLogOffset(inherited.length) })
    try {
      await handle.append(events)
      await handle.flush()
    } finally { await handle.close() }
  }
  const parent = await ctx.sessionPersistence.create({
    version: SESSION_FORMAT_VERSION, id: PARENT_ID, createdAt: TIME_ZERO, cwd: '/bench',
    isSeeded: false,
  })
  try {
    await parent.append(catalog)
    await parent.flush()
  } finally { await parent.close() }
}

async function run(root: string, mode: string): Promise<CatalogReport | { seeded: true }> {
  const ctx = new Context()
  try {
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(JsonlSessionPersistence, { root, compression: 'zstd' })
    await ctx.plugin(CatalogQuery)
    await ctx.plugin(SubagentRuntime)
    if (mode === 'seed') {
      await seed(ctx)
      return { seeded: true }
    }
    const readCatalog = () => ctx.subagents.listChildren(PARENT_ID)
    const cpuStart = process.cpuUsage()
    const start = performance.now()
    const first = await readCatalog()
    const firstDone = performance.now()
    const repeated = await readCatalog()
    const end = performance.now()
    const cpu = process.cpuUsage(cpuStart)
    if (first.length !== WORKLOAD.children || repeated.length !== WORKLOAD.children) {
      throw new Error('child-catalog benchmark did not reach the complete healthy catalog')
    }
    return {
      totalMs: end - start, firstMs: firstDone - start, repeatMs: end - firstDone,
      cpuUserMs: cpu.user / 1_000, cpuSystemMs: cpu.system / 1_000,
      children: first.length, peakRssMb: process.resourceUsage().maxRSS / 1_024,
    }
  } finally { await ctx.fiber.dispose() }
}

assertBuiltBenchmarkRuntime(import.meta.url, Object.fromEntries([
  '@deepseek-ai/dsh-subagent', '@deepseek-ai/dsh-session-query',
  '@deepseek-ai/dsh-session-persistence-jsonl',
].map(name => [name, import.meta.resolve(name)])))
const [root, mode] = process.argv.slice(2)
if (root === undefined || (mode !== 'seed' && mode !== 'catalog')) {
  throw new Error('usage: child-catalog.worker.js <root> <seed|catalog>')
}
process.stdout.write(JSON.stringify(await run(root, mode)) + '\n')

```

### Core Architecture Module: `benchmarks/agent-continuation/profile-continuation.worker.ts`
```
/** End-to-end SDK continuation through built dsh sdk-minimal with an explicitly mounted file editor. */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client'
import { assertBuiltBenchmarkRuntime } from '../support/built-worker.ts'
import { PARENT_ID, resultText, WORKLOAD } from './workload.ts'

/** Parent-observed wall time, including profile launch and SDK shutdown. */
export interface ProfileReport {
  readonly totalMs: number
  readonly bootMs: number
  readonly turnsMs: number
  readonly closeMs: number
  readonly requests: number
  readonly toolCalls: number
}

async function run(root: string): Promise<ProfileReport> {
  const home = join(root, 'home')
  const cwd = join(root, 'workspace')
  await mkdir(cwd, { recursive: true })
  await mkdir(home, { recursive: true })
  await writeFile(join(cwd, 'synthetic.txt'), resultText(0))
  const patch = join(root, 'profile.patch.yml')
  await writeFile(patch, [
    '- id: llm-deepseek', '  disabled: true',
    '- id: sessions', '  config:', '    root: ' + JSON.stringify(join(root, 'profile-sessions')), '    compression: zstd',
    '- insert:',
    '    - id: fs-local', "      name: '@deepseek-ai/dsh-fs-local'",
    '    - id: str-replace-editor', "      name: '@deepseek-ai/dsh-tool-str-replace-editor'",
    '    - id: benchmark-model', '      name: ' + JSON.stringify(join(import.meta.dirname, 'profile-adapter.js')),
    '',
  ].join('\n'))
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH, HOME: home, USERPROFILE: home,
    DSH_AGENTS_HOME: join(home, 'agents'),
  }
  const harness = new DeepSeekHarness({
    dshBin: join(import.meta.dirname, '..', '..', '..', 'apps', 'cli', 'lib', 'bin.js'),
    profile: 'sdk-minimal', dshHome: home, processCwd: cwd, cwd,
    provider: 'bench', model: 'bench', patches: [patch], env,
    initializeTimeoutMs: 15_000, requestTimeoutMs: 15_000,
  })
  let closing: Promise<void> | undefined
  const close = (): Promise<void> => closing ??= harness.close()
  let expired = false
  const deadline = setTimeout(() => {
    expired = true
    // The awaited finally close below reports shutdown failures; this only requests cancellation.
    void close().catch(() => undefined)
  }, 40_000)
  let requests = 0
  let toolCalls = 0
  const start = performance.now()
  try {
    await harness.start()
    const booted = performance.now()
    for (let turn = 0; turn < WORKLOAD.profileTurns; turn++) {
      const result = await harness.run('Read the synthetic file ' + String(turn), { sessionId: PARENT_ID })
      requests += result.events.filter(event => event.type === 'assistant/message').length
      for (const event of result.events) {
        if (event.type !== 'tool/result') continue
        const message = event.data.message
        if (message.isError || !message.content.some(block => block.type === 'text' && block.text.includes('export const synthetic = 42;'))) {
          throw new Error('profile benchmark did not read the synthetic file')
        }
        toolCalls++
      }
    }
    const turnsDone = performance.now()
    await close()
    const end = performance.now()
    if (expired || requests !== WORKLOAD.profileTurns * 2 || toolCalls !== WORKLOAD.profileTurns * WORKLOAD.toolsPerLiveTurn) {
      throw new Error('profile benchmark did not finish every model request and real tool call')
    }
    return { totalMs: end - start, bootMs: booted - start, turnsMs: turnsDone - booted, closeMs: end - turnsDone, requests, toolCalls }
  } finally {
    clearTimeout(deadline)
    await close()
  }
}

assertBuiltBenchmarkRuntime(import.meta.url, { '@deepseek-ai/dsh-sdk-client': import.meta.resolve('@deepseek-ai/dsh-sdk-client') })
const [root] = process.argv.slice(2)
if (root === undefined) throw new Error('usage: profile-continuation.worker.js <root>')
process.stdout.write(JSON.stringify(await run(root)) + '\n')

```

### Core Architecture Module: `benchmarks/conversation-fold/conversation-fold.worker.client.ts`
```
/** Compiled worker for Client history folding and live tool preparation. */

import { performance } from 'node:perf_hooks'
import { Context } from '@deepseek-ai/cordis'
import { AssistantStreamAccumulator } from '@deepseek-ai/dsh-llm/assistant-stream'
import { LlmAttemptId, ToolCallId } from '@deepseek-ai/dsh-llm/brand'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { ChatNode, ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
// These Client-only fold modules have no plain-Node package export and are compiled into this worker.
import { ConversationNodeAssembler } from '../../packages/client/ui-conversation/src/client/conversation/assembler.ts'
import { ConversationEventRegistry } from '../../packages/client/ui-conversation/src/client/conversation/event-registry.ts'
import { inspectRequestPrompt } from '../../packages/client/ui-conversation/src/client/contract/request-inspection.ts'
import type { ConversationViewDefinition } from '../../packages/client/ui-conversation/src/client/contract/conversation.ts'
import { registerAssistantConversationNode } from '../../packages/client/ui-chat/src/client/conversation-nodes/assistant.ts'
import { chatViewDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/chat-snapshot-builder.ts'
import { commandDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/command.ts'
import { compactionDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/compaction.ts'
import { unknownFallbackDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/fallback.ts'
import { nextStepInboxDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/inbox.ts'
import { messageDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/message.ts'
import { processGroupDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/process-groups.ts'
import { requestPromptDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/request-prompt.ts'
import { retryDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/retry.ts'
import { registerToolConversationNode } from '../../packages/client/ui-chat/src/client/conversation-nodes/tool.ts'
import { turnErrorDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/turn-error.ts'
import { turnMaxTokensDefinition } from '../../packages/client/ui-chat/src/client/conversation-nodes/turn-max-tokens.ts'
import { registerTurnProcess } from '../../packages/client/ui-chat/src/client/conversation-nodes/turn-process.ts'
import { registerTurnTailConversationNode } from '../../packages/client/ui-chat/src/client/conversation-nodes/turn-tail.ts'
import { assertBuiltBenchmarkRuntime } from '../support/built-worker.ts'

const TIME_ZERO = 1_700_000_000_000

/** Result emitted by the compiled conversation-fold worker. */
export interface ConversationFoldWorkerReport {
  readonly events: number
  readonly compactRecords: number
  readonly streamedDeltas: number
  readonly chatNodes: number
  readonly smallFoldMs: number
  readonly largeFoldMs: number
  readonly scaling: number
}

/** Incremental argument folding through the Tool Definition and Chat group publication. */
export interface PreparingToolWorkerReport {
  readonly tool: 'write' | 'bash'
  readonly characters: number | undefined
  readonly fragments: number
  readonly elapsedMs: number
  readonly retainedMb: number
  readonly maxRssMb: number
  readonly rowReads: number
  readonly progressKb: number | undefined
  readonly filePath: string | undefined
  readonly detail: string | undefined
}

function registerEventDefinitions(ctx: Context): ConversationEventRegistry {
  const events = new ConversationEventRegistry(ctx)
  // Only the service holder is an adapter; registrations and routing use production code.
  Object.defineProperty(ctx, 'uiConversation', { value: { events } })
  events.register(nextStepInboxDefinition)
  events.register(messageDefinition)
  events.register(requestPromptDefinition(inspectRequestPrompt))
  registerAssistantConversationNode(ctx)
  registerTurnProcess(ctx)
  registerToolConversationNode(ctx)
  events.register(commandDefinition)
  events.register(compactionDefinition)
  events.register(retryDefinition)
  events.register(turnErrorDefinition)
  events.register(turnMaxTokensDefinition)
  registerTurnTailConversationNode(ctx)
  events.registerFallback(unknownFallbackDefinition)
  return events
}

class BenchViewDefinitions {
  entries(): readonly ConversationViewDefinition[] {
    return [chatViewDefinition]
  }
}

function entry(seq: number, type: string, data: unknown, extra: Record<string, unknown> = {}): SessionEventLikeEntry {
  return {
    type: 'event',
    event: { seq, time: TIME_ZERO + seq, type, data, ...extra } as unknown as SessionEvent,
  }
}

function synthesizeWindow(
  turns: number,
  deltas: number,
): { readonly entries: readonly SessionEventLikeEntry[]; readonly records: number } {
  const entries: SessionEventLikeEntry[] = []
  let seq = 0
  let records = 0
  const push = (type: string, data: unknown, extra: Record<string, unknown> = {}): void => {
    entries.push(entry(seq, type, data, extra))
    seq += 1
  }
  const reasoningDeltas = Math.floor(deltas / 4)
  for (let turn = 1; turn <= turns; turn += 1) {
    push('turn/start', { turn })
    push('user/message', {
      id: `user-${String(turn)}`,
      role: 'user',
      content: [{ type: 'text', text: `prompt ${String(turn)}` }],
      source: { kind: 'user' },
    }, { surfaceOp: 'append' })
    push('step/start', { turn, step: 1 })
    const accumulator = new AssistantStreamAccumulator()
    let time = TIME_ZERO + seq * 1_000
    const stream = (chunk: StreamChunk): void => {
      accumulator.push({ time, chunk })
      time += 1
    }
    stream({ type: 'block-start', index: 0, blockType: 'reasoning' })
    let reasoning = ''
    for (let index = 0; index < reasoningDeltas; index += 1) {
      const delta = `r${String(index)} `
      reasoning += delta
      stream({ type: 'reasoning-delta', index: 0, text: delta })
    }
    stream({ type: 'block-end', index: 0, block: { type: 'reasoning', text: reasoning } })
    stream({ type: 'block-start', index: 1, blockType: 'text' })
    let text = ''
    for (let index = 0; index < deltas; index += 1) {
      const delta = `w${String(index)} `
      text += delta
      stream({ type: 'text-delta', index: 1, text: delta })
    }
    stream({ type: 'block-end', index: 1, block: { type: 'text', text } })
    const usage = { inputTokens: 100, outputTokens: deltas }
    stream({ type: 'usage', usage })
    stream({ type: 'finish', reason: { kind: 'stop' } })
    const snapshot = accumulator.snapshot()
    records += snapshot.length
    push('assistant/message', {
      turn,
      step: 1,
      message: {
        id: `assistant-${String(turn)}`,
        role: 'assistant',
        content: [{ type: 'reasoning', text: reasoning }, { type: 'text', text }],
        source: { kind: 'model', provider: 'bench', model: 'bench' },
      },
      usage,
      stream: snapshot,
    }, { surfaceOp: 'append' })
    push('step/end', { turn, step: 1 })
    push('turn/end', { turn, reason: { kind: 'completed' } })
  }
  return { entries, records }
}

function foldOnce(entries: readonly SessionEventLikeEntry[], definitions: ConversationEventRegistry): { readonly ms: number; readonly nodes: number } {
  const started = performance.now()
  const assembler = new ConversationNodeAssembler(definitions, new BenchViewDefinitions())
  assembler.replaceWindow(entries, false)
  assembler.activateTarget('chat')
  const snapshot = assembler.snapshot('chat') as ChatSnapshot | undefined
  return { ms: performance.now() - started, nodes: snapshot?.order.length ?? 0 }
}

function bestOf(
  entries: readonly SessionEventLikeEntry[],
  attempts: number,
  definitions: ConversationEventRegistry,
): { readonly ms: number; readonly nodes: number } {
  let best = foldOnce(entries, definitions)
  for (let attempt = 1; attempt < attempts; attempt += 1) {
    const next = foldOnce(entries, definitions)
    if (next.ms < best.ms) best = next
  }
  return best
}

function positiveInteger(value: string | undefined, label: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`)
  return parsed
}

function preparingTool(tool: 'write' | 'bash', characters: number, definitions: ConversationEventRegistry): PreparingToolWorkerReport {
  if (globalThis.gc === undefined) throw new Error('preparing benchmark requires --expose-gc')
  const chunkSize = 16
  const chunksPerPublication = 64
  const payload = 'abcdefghijklmno '.repeat(Math.ceil(characters / chunkSize)).slice(0, characters)
  const tail = `${payload}"}`
  const callId = ToolCallId('preparing-benchmark')
  const attemptId = LlmAttemptId('preparing-benchmark')
  const delta = (index: number, argumentsDelta: string): SessionEventLikeEntry => ({
    type: 'transient',
    event: {
      type: 'assistant/live-chunk', seq: 2 + index / (tail.length + 1), time: TIME_ZERO + index,
      data: { turn: 1, step: 1, attemptId, chunk: {
        type: 'tool-call-delta', index: 0, id: callId, argumentsDelta,
        ...index === 0 ? { name: tool } : {},
      } },
    },
  })
  const chunks: SessionEventLikeEntry[] = []
  for (let at = 0; at < tail.length; at += chunkSize) chunks.push(delta(at + 1, tail.slice(at, at + chunkSize)))
  const assembler = new ConversationNodeAssembler(
    definitions, new BenchViewDefinitions(),
    { entries: () => [processGroupDefinition], forTarget: target => target === 'chat' ? processGroupDefinition : undefined },
  )
  assembler.replaceWindow(
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- *No recent closed bug issues fetched.*

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

### Incident Patch 1: `a809d928` (2026-10-03)
**Commit Message**: fix(release): preflight channels without relying on latest

**File**: `.agents/notes/implemented/process/2026-08-10-npm-release-sequences.i18n.yaml` (modified, +6/-6)
```diff
@@ -21,8 +21,8 @@
   en: 321f48c7e4afac24
   zh: 974a7fa1a75c810d
 /agent-note-private-npm-publication-as-three-independent-sequences/decision/publication-runs-only-on-github-and-the-registry-decides-what-goes-out:
-  en: 8b255f6df8bd762f
-  zh: 2ed6d1a84efe3e44
+  en: 8c8cd90e6eabe07d
+  zh: 7035b71a6eeeb379
 /agent-note-private-npm-publication-as-three-independent-sequences/decision/workspace-internal-references-use-the-workspace-protocol:
   en: 82a7925d449fc283
   zh: 653358a1ffbad80a
@@ -42,8 +42,8 @@
   en: c505237cad2c4128
   zh: 55364ba462536680
 /agent-note-private-npm-publication-as-three-independent-sequences/alternatives-considered:
-  en: b98c53537c33ba02
-  zh: b9e3bddadff0d6d6
+  en: ed22fa8a47b5c4b6
+  zh: 7b367971a51a67ff
 /agent-note-private-npm-publication-as-three-independent-sequences/consequences:
-  en: 72c2be77f220dcda
-  zh: 64312d7065abe25e
+  en: 46f82110175ea3f7
+  zh: 1cdd1c99bfb88440
```

**File**: `.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md` (modified, +3/-3)
```diff
@@ -76,7 +76,7 @@ All three sequences decide this way, including the native one: it publishes thro
 
 Two registry behaviours shape how a publish is attempted. Writes are spaced by at least two seconds and retried with a backoff, because publishing several packages back to back outruns the registry's own processing and earns `E409 Failed to save packument`. And every retry re-reads the registry first: a reported failure can answer a write that landed anyway, so a version that now exists with this tarball's integrity counts as published rather than as a version to place again.
 
-For dsh and vendor, `release:publish --dist-tag <tag>` overrides the family's default publication channel. The vendor publish workflow accepts the optional `dist-tag` input; omitting it preserves the family default. An override must be a valid npm dist-tag. Before publishing any tarball, the publisher checks that tag for every packed member: an absent binding or one already naming the intended version is accepted; a binding to another version rejects the entire attempt. Existing integrity checks and retries still apply. Skipped versions are never retagged.
+For dsh and vendor, `release:publish --dist-tag <tag>` overrides the family's default publication channel. The vendor publish workflow accepts the optional `dist-tag` input; omitting it preserves the family default. An override must be a valid npm dist-tag. Before publishing any tarball, the publisher checks every packed member: the selected tag must already name the intended version, or both that tag and the version must be absent. A tag bound elsewhere, or an already published version without the selected tag, rejects the entire attempt before any upload. Existing integrity checks and retries still apply. Skipped versions are never retagged.
 
 The preflight does not reserve npm tags atomically. The release manager coordinates external publishers that could change a binding after the check. A dedicated dist-tag also does not exclude stable versions from existing dependency ranges: isolation requires prerelease versions and an audit of the actual packed dependency ranges.
 
@@ -150,7 +150,7 @@ The installed-consumer probe captures npm's HTTP diagnostics and includes them w
 
 **Event-level tags (`vendor-r1`, `vendor-r2`).** Prepared for one release event carrying several package versions. Once the registry decides what publishes, the workflow no longer infers the set from the tag, so per-package tags suffice — and each one names its own package's real version.
 
-**Putting the nine vendored packages on one `4.0.x` line.** It removes change detection, but cosmokit would jump from `1.8.1` to `4.0.1` and lose its upstream lineage; the upstream ranges inside the nine (`^1.8.1` and friends) would stop matching immediately, forcing a rewrite of the vendored manifests.
+**Putting the nine vendored packages on one `4.0.x` line.** Cosmokit would jump from `1.8.1` to `4.0.1` and lose its upstream lineage; the upstream ranges inside the nine (`^1.8.1` and friends) would stop matching immediately, forcing a rewrite of the vendored manifests.
 
 **Publishing only changed vendor directories.** A directory diff does not establish that repacking from another repository state produces identical bytes. Advancing all nine packages avoids integrity collisions for unchanged directories at the cost of additional versions.
 
@@ -170,7 +170,7 @@ The installed-consumer probe captures npm's HTTP diagnostics and includes them w
 
 ## Consequences
 
-The release scripts are importable modules behind a guarded entry point, and their judgements carry unit tests: tag naming, publish order and cycle reporting, version-baseline arithmetic, the payload change judgement, and each family's payload policy. Two defects the first draft carried — a publish command that ran the pack command on import, and a change judgement blind to `vendor/cordis` source edits — are exactly what a test at that seam catches.
+The release scripts are importable modules behind a guarded entry point, and their judgements carry unit tests: tag naming, publish order and cycle reporting, version-baseline arithmetic, and each family's payload policy. The entry guard prevents an import from executing a release command.
 
 A pull request runs the full pack for both sequences without credentials and installs the packed dsh tarballs into a throwaway consumer, where plain Node drives `dsh --version`. That probe is deliberately one command: it proves `files` selected a complete payload and that the published ranges resolve, and says nothing about interactive behavior.
 
```

**File**: `.agents/notes/implemented/process/2026-08-10-npm-release-sequences.zh.md` (modified, +3/-3)
```diff
@@ -76,7 +76,7 @@ tag 预留包版本并标识其 commit，不代表发布成功。即使对应发
 
 registry 的两个行为决定了「怎么尝试一次发布」。写入之间至少间隔两秒并带退避重试，因为连续背靠背发多个包会超出 registry 自身的处理速度，换来 `E409 Failed to save packument`。而每次重试都先重查 registry：报出来的失败可能对应一次其实已经落地的写入，所以「该版本现在存在且 integrity 与本 tarball 相同」算作已发布，而不是又一个待放置的版本。
 
-对 dsh 和 vendor，`release:publish --dist-tag <tag>` 覆盖该族默认发布通道。vendor 发布 workflow 接受可选的 `dist-tag` 输入；省略时保留该族默认值。覆盖值必须是合法的 npm dist-tag。发布任何 tarball 前，publisher 检查每个打包成员的该 tag：允许尚未绑定或已指向预期版本；若指向其他版本，则拒绝整次发布。原有 integrity 检查与重试继续生效。跳过的版本不会重新绑定 tag。
+对 dsh 和 vendor，`release:publish --dist-tag <tag>` 覆盖该族默认发布通道。vendor 发布 workflow 接受可选的 `dist-tag` 输入；省略时保留该族默认值。覆盖值必须是合法的 npm dist-tag。发布任何 tarball 前，publisher 检查每个打包成员：所选 tag 必须已指向预期版本，或者该 tag 和版本都不存在。tag 指向其他版本，或版本已经发布但缺少所选 tag，都会在上传前拒绝整次发布。原有 integrity 检查与重试继续生效。跳过的版本不会重新绑定 tag。
 
 预检不会原子性地预留 npm tag。发布负责人协调可能在检查后更改绑定的外部发布者。专用 dist-tag 也不会让稳定版本被已有依赖范围排除：隔离需要预发布版本，并核查实际打包产物中的依赖范围。
 
@@ -150,7 +150,7 @@ dsh 的验证会一并安装 vendored 族的 pack 产物。harness 的包把 ven
 
 **事件级 tag（`vendor-r1`、`vendor-r2`）。** 为「一次发布事件携带多个包版本」准备。既然由 registry 决定发什么，workflow 就不再从 tag 推断集合，per-package tag 够用，而且每个 tag 携带的是它自己那个包的真实版本。
 
-**把九个 vendored 包统一到一条 `4.0.x` 版本线。** 省掉变更检测，但 cosmokit 会从 `1.8.1` 跳到 `4.0.1`、丢失上游血缘；九包内部的上游范围（`^1.8.1` 之类）会立刻失配，必须改写 vendored manifest。
+**把九个 vendored 包统一到一条 `4.0.x` 版本线。** Cosmokit 会从 `1.8.1` 跳到 `4.0.1`、丢失上游血缘；九包内部的上游范围（`^1.8.1` 之类）会立刻失配，必须改写 vendored manifest。
 
 **只发布目录有变更的 vendor 包。** 目录 diff 不能证明从不同仓库状态重新打包会产出相同字节。递增全部九个包可避免未改目录的 integrity 冲突，代价是增加版本号。
 
@@ -170,7 +170,7 @@ dsh 的验证会一并安装 vendored 族的 pack 产物。harness 的包把 ven
 
 ## 后果
 
-发布脚本是带入口守卫的可 import 模块，其判断都有单测覆盖：tag 命名、发布顺序与环报告、版本基线运算、payload 变更判据，以及各族的 payload 策略。第一版带过的两个缺陷——publish 命令在 import 时执行了 pack 命令、变更判据对 `vendor/cordis` 的源码改动失明——正是这类测试在对应接缝上能抓住的。
+发布脚本是带入口守卫的可 import 模块，其判断都有单测覆盖：tag 命名、发布顺序与环报告、版本基线运算，以及各族的 payload 策略。入口守卫阻止 import 执行发布命令。
 
 一个 pull request 会为两条序列跑完整的 pack（无凭据），并把打包好的 dsh tarball 装进一次性 consumer，用普通 Node 驱动 `dsh --version`。这个探针刻意只有一条命令：它证明 `files` 选出了完整 payload、发布出去的范围可解析，不涉及任何交互行为。
 
```

**File**: `scripts/release/publish.spec.ts` (modified, +92/-17)
```diff
@@ -31,6 +31,7 @@ vi.mock('node:timers/promises', async importOriginal => ({
 const CHANNEL = 'dsh-0-2-1-alpha-1'
 const ABSENT: CommandResult = { status: 1, stdout: '', stderr: 'npm error code E404' }
 const SUCCESS: CommandResult = { status: 0, stdout: '', stderr: '' }
+const CONFLICT: CommandResult = { status: 1, stdout: '', stderr: 'npm error code E409 Failed to save packument' }
 
 interface PackedFixture {
   readonly name: string
@@ -69,15 +70,23 @@ function registry(
 ): void {
   vi.mocked(attempt).mockImplementation((command, args) => {
     expect(command).toBe('npm')
+    if (args[0] === 'dist-tag') {
+      expect(args).toHaveLength(3)
+      expect(args[1]).toBe('ls')
+      const name = args[2]
+      if (name === undefined) throw new Error('Missing npm dist-tag package')
+      if (!tags.has(name)) return ABSENT
+      const payload = tags.get(name)
+      const stdout = payload !== null && typeof payload === 'object' && !Array.isArray(payload)
+        ? Object.entries(payload).map(([tag, version]) => `${tag}: ${String(version)}`).join('\n')
+        : JSON.stringify(payload) ?? 'undefined'
+      return { ...SUCCESS, stdout }
+    }
     expect(args).toHaveLength(4)
     expect(args[0]).toBe('view')
     expect(args[3]).toBe('--json')
     const selector = args[1]
     if (selector === undefined) throw new Error('Missing npm view selector')
-    if (args[2] === 'dist-tags') {
-      if (!tags.has(selector)) return ABSENT
-      return { ...SUCCESS, stdout: JSON.stringify(tags.get(selector)) }
-    }
     if (args[2] === 'dist.integrity') {
       const integrity = integrities.get(selector)
       return integrity === undefined ? ABSENT : { ...SUCCESS, stdout: JSON.stringify(integrity) }
@@ -127,9 +136,9 @@ describe('release publication channels', () => {
     expect(second).toBeDefined()
     registry(new Map([[first!.name, { latest: '1.0.5', next: '1.0.5-rc.1' }]]))
     vi.mocked(attemptEchoed).mockImplementation(() => {
-      expect(vi.mocked(attempt).mock.calls.filter(([, args]) => args[2] === 'dist-tags')).toEqual([
-        ['npm', ['view', first!.name, 'dist-tags', '--json']],
-        ['npm', ['view', second!.name, 'dist-tags', '--json']],
+      expect(vi.mocked(attempt).mock.calls.filter(([, args]) => args[0] === 'dist-tag')).toEqual([
+        ['npm', ['dist-tag', 'ls', first!.name]],
+        ['npm', ['dist-tag', 'ls', second!.name]],
       ])
       return SUCCESS
     })
@@ -166,20 +175,20 @@ describe('release publication channels', () => {
     const fixture = packedRelease(['1.0.6-alpha.1', '4.0.5-alpha.1'])
     const [first, second] = fixture.packages
     registry(new Map([
-      [first!.name, {}],
+      [first!.name, { latest: '1.0.5' }],
       [second!.name, { [CHANNEL]: '4.0.4' }],
     ]))
 
     await expect(publishRelease('vendor', fixture.directory, CHANNEL)).rejects.toThrow()
 
-    expect(vi.mocked(attempt).mock.calls).toEqual([
-      ['npm', ['view', first!.name, 'dist-tags', '--json']],
-      ['npm', ['view', second!.name, 'dist-tags', '--json']],
+    expect(vi.mocked(attempt).mock.calls.filter(([, args]) => args[0] === 'dist-tag')).toEqual([
+      ['npm', ['dist-tag', 'ls', first!.name]],
+      ['npm', ['dist-tag', 'ls', second!.name]],
     ])
     expect(attemptEchoed).not.toHaveBeenCalled()
   })
 
-  it.each([null, [], 'not an object', { [CHANNEL]: 42 }])('rejects malformed registry channels %j before publishing', async (payload) => {
+  it.each([null, [], {}, 'not an object', { [CHANNEL]: 42 }])('rejects malformed registry channels %j before publishing', async (payload) => {
     const fixture = packedRelease(['1.0.6-alpha.1'])
     registry(new Map([[fixture.packages[0]!.name, payload]]))
 
@@ -197,7 +206,19 @@ describe('release publication channels', () => {
     expect(attemptEchoed).not.toHaveBeenCalled()
   })
 
-  it('skips an identical artifact when the custom channel already names its version', async () => {
+  it('rejects repeated channel bindings before publishing', async () => {
+    const fixture = packedRelease(['1.0.6-alpha.1'])
+    vi.mocked(attempt).mockReturnValue({
+      ...SUCCESS,
+      stdout: `${CHANNEL}: 1.0.6-alpha.1\n${CHANNEL}: 1.0.6-alpha.1\n`,
+    })
+
+    await expect(publishRelease('vendor', fixture.directory, CHANNEL)).rejects.toThrow('invalid dist-tags')
+
+    expect(attemptEchoed).not.toHaveBeenCalled()
+  })
+
+  it('skips an identical artifact with its custom channel and no latest tag', async () => {
     const fixture = packedRelease(['1.0.6-alpha.1'])
     const entry = fixture.packages[0]!
     registry(
@@ -207,19 +228,73 @@ describe('release publication channels', () => {
 
     await publishRelease('vendor', fixture.directory, CHANNEL)
 
+    expect(attempt).toHaveBeenCalledWith('npm', ['dist-tag', 'ls', entry.name])
     expect(attemptEchoed).not.toHaveBeenCalled()
     expect(sleep).not.toHaveBeenCalled()
   })
 
-  it('leaves an absent custom channel unchanged when the identical version is alrea
```

**File**: `scripts/release/publish.ts` (modified, +21/-12)
```diff
@@ -17,7 +17,7 @@ import { readFileSync } from 'node:fs'
 import { join, resolve } from 'node:path'
 import { setTimeout as sleep } from 'node:timers/promises'
 import { parseArgs } from 'node:util'
-import { validRange } from 'semver'
+import { valid, validRange } from 'semver'
 import { releaseFamily } from './families.ts'
 import { attempt, attemptEchoed, isEntry } from './process.ts'
 import { packedIdentity, readPublishOrder, type PackedIdentity } from './tarball.ts'
@@ -85,29 +85,38 @@ function registryState(name: string, version: string): RegistryState {
   return { kind: 'present', integrity: parsed }
 }
 
-/** Reject empty tags, npm option prefixes, URI-encoded characters, and version ranges. */
+/** Reject empty tags, npm option prefixes, characters requiring URI encoding, and version ranges. */
 function validateDistTag(distTag: string): void {
   if (distTag === '' || distTag.startsWith('-') || encodeURIComponent(distTag) !== distTag || validRange(distTag) !== null) {
-    throw new Error(`Invalid npm dist-tag ${JSON.stringify(distTag)}: use a non-empty tag without a leading hyphen, URI-encoded characters, or a version range.`)
+    throw new Error(`Invalid npm dist-tag ${JSON.stringify(distTag)}: use a non-empty tag without a leading hyphen, characters requiring URI encoding, or a version range.`)
   }
 }
 
 /** An explicit channel may be new or already name the same version after a partial publication. */
 function verifyDistTag(member: PackedIdentity, distTag: string): void {
-  const result = attempt('npm', ['view', member.name, 'dist-tags', '--json'])
+  const result = attempt('npm', ['dist-tag', 'ls', member.name])
   if (result.status !== 0) {
     const output = `${result.stdout}${result.stderr}`
     if (output.includes('E404') || output.includes('404 Not Found')) return
-    throw new Error(`npm view ${member.name} dist-tags failed:\n${output}`)
+    throw new Error(`npm dist-tag ls ${member.name} failed:\n${output}`)
   }
-  const parsed: unknown = JSON.parse(result.stdout)
-  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
-    throw new Error(`registry reported invalid dist-tags for ${member.name}`)
+  const tags = new Map<string, string>()
+  for (const line of result.stdout.split(/\r?\n/u).filter(line => line !== '')) {
+    const match = /^(\S+): (\S+)$/u.exec(line)
+    const tag = match?.[1]
+    const version = match?.[2]
+    if (tag === undefined || version === undefined || valid(version) === null || tags.has(tag)) {
+      throw new Error(`npm reported invalid dist-tags for ${member.name}: ${JSON.stringify(line)}`)
+    }
+    tags.set(tag, version)
   }
-  const version: unknown = Object.hasOwn(parsed, distTag) ? Reflect.get(parsed, distTag) : undefined
-  if (version === undefined) return
-  if (typeof version !== 'string' || version === '') {
-    throw new Error(`registry reported an invalid ${distTag} dist-tag for ${member.name}`)
+  if (tags.size === 0) throw new Error(`npm reported no dist-tags for ${member.name}`)
+  const version = tags.get(distTag)
+  if (version === undefined) {
+    if (registryState(member.name, member.version).kind === 'present') {
+      throw new Error(`${member.name}@${member.version} is already published without dist-tag ${distTag}; this run cannot bind an existing version to a new channel.`)
+    }
+    return
   }
   if (version !== member.version) {
     throw new Error(`${member.name}@${distTag} already points to ${version}; choose an unused dist-tag instead of replacing it with ${member.version}.`)
```

---

### Incident Patch 2: `44d678e2` (2026-10-02)
**Commit Message**: fix(docs): map example plugin aliases to themselves in doc-typecheck

The examples subpath alias of the mods bridge points at TypeScript entries
that ship no declarations; a documentation fence never imports them, so the
mapper keeps the authored path instead of failing the gate.

**File**: `scripts/doc-typecheck-paths.spec.ts` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@ describe('builtDeclarationPath', () => {
       .toBe('./packages/core/session/lib/types/index.d.ts')
     expect(builtDeclarationPath('./packages/core/session/src/types.ts'))
       .toBe('./packages/core/session/lib/types/types.d.ts')
+    expect(builtDeclarationPath('./packages/experimental/claude-code-mods/examples/*'))
+      .toBe('./packages/experimental/claude-code-mods/examples/*')
   })
 
   it('rejects aliases without a supported source target', () => {
```

**File**: `scripts/doc-typecheck-paths.ts` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@ export function builtDeclarationPath(candidate: string): string {
   if (candidate.endsWith('/src/*')) {
     return `${candidate.slice(0, -'/src/*'.length)}/lib/types/*`
   }
+  // Example plugin entries ship no declarations; a documentation fence never imports them, so they stay as authored.
+  if (candidate.includes('/examples/')) return candidate
   const sourceFile = /^(.*)\/src\/(.+)\.ts$/.exec(candidate)
   if (sourceFile?.[1] && sourceFile[2]) {
     return `${sourceFile[1]}/lib/types/${sourceFile[2]}.d.ts`
```

---

### Incident Patch 3: `56f2f486` (2026-10-02)
**Commit Message**: fix(experimental): hairline band borders and one engine-event list

The band's bordered boxes and buttons draw the theme's 0.5px hairline, as
the elevation gate requires; KNOWN_EVENTS is built from ENGINE_EVENTS
instead of repeating the list.

**File**: `packages/experimental/claude-code-mods/src/matcher.ts` (modified, +1/-20)
```diff
@@ -29,26 +29,7 @@ export const ENGINE_EVENTS: ReadonlySet<string> = new Set([
  * fails at load rather than registering a hook that never runs.
  */
 export const KNOWN_EVENTS: ReadonlySet<string> = new Set([
-  // tools
-  'tool.call', 'tool.check', 'tool.describe',
-  // prompts and what the model reads
-  'prompt.submit', 'prompt.fill', 'prompt.suggest', 'prompt.edit', 'prompt.compose', 'prompt.section',
-  'prompt.context', 'prompt.attachment', 'skill.prompt', 'attribution.text',
-  // commands and configuration
-  'command.run', 'command.describe', 'config.set', 'config.describe',
-  // turns
-  'turn.start', 'turn.step', 'turn.complete',
-  // session
-  'session.start', 'session.end', 'session.compact', 'session.receive', 'session.send', 'session.append',
-  'session.attach', 'session.detach', 'session.measure',
-  // subagents
-  'agent.offer', 'agent.spawn',
-  // interface
-  'ui.render', 'ui.resolve', 'ui.press', 'ui.input', 'ui.select', 'ui.focus', 'ui.scroll', 'ui.close', 'ui.message',
-  // other mods
-  'plugin.register', 'engine.create',
-  // telemetry
-  'telemetry.log', 'telemetry.mark',
+  ...ENGINE_EVENTS,
   // mods API calls
   'ui.log', 'ui.toast', 'ui.status', 'ui.notice', 'ui.invalidate', 'ui.open', 'ui.panes', 'ui.blit', 'ui.ask', 'ui.copy',
   'command.register', 'command.list',
```

**File**: `packages/experimental/client-ui-claude-code-mods/src/client/Band.module.css` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@
 }
 
 .box[data-border] {
-  border: 1px solid var(--dsw-alias-border-l2, currentColor);
+  border: 0.5px solid var(--dsw-alias-border-l2);
   border-radius: 6px;
 }
 
@@ -76,7 +76,7 @@
   gap: 4px;
   margin: 0 2px;
   padding: 1px 8px;
-  border: 1px solid var(--dsw-alias-border-l2, currentColor);
+  border: 0.5px solid var(--dsw-alias-border-l2);
   border-radius: 6px;
   background: transparent;
   color: inherit;
```

---

### Incident Patch 4: `233032b8` (2026-10-02)
**Commit Message**: fix(experimental): close the mods bridge review findings

- Disposal cancels detached runs before the engine waits for timer callbacks,
  so a callback parked in a $ call ends instead of blocking unload.
- A forgotten band wakes and ends its watch streams; a refresh asked for
  during a pass joins one more pass that settles after it; the Web band drops
  an ended stream so the next subscriber opens a fresh one.
- $ has Claude Code's namespaces: an unserved member rejects with
  'no implementation for <namespace>.<member>' instead of a TypeError.
- A .catch handler's next makes the rewrite check; a tool rename is refused
  like an argument rewrite; a null op answer is reported as no answer;
  defineMod returns its disposer from apply; the live turn record is copied
  before the chain freezes it; prompt.submit is raised only for batches with
  a human message and names the submitting mod as origin.
- $.http.fetch bounds the body while streaming; bandColumns/bandRows are
  Config; the client package drops its stale gateway edges; the source
  overlay lives in the package and anchors its entries to the file, and the
  dsh installation no longer depends on the experimental packages.

**File**: `.oxlintrc.json` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@
     "packages/typert/generator/tests/fixtures/type-model/**", // tsgolint rejects this fixture's preserved project shapes before rules run.
     "website/.generated/**",
     "vendor/**", // Vendored source keeps upstream style and idioms.
-    "packages/experimental/claude-code-mods/examples/**", // Claude Code's published example mods and their tests keep the upstream style; see the headers.
+    "packages/experimental/claude-code-mods/examples/*/{hooks,tests,types}/**", // Claude Code's published example mods and their tests keep the upstream style; see the headers.
     "native/**", // The imported landlock-run subtree has its own gates; see native/README.md.
     "**/*.js",
     "**/*.mjs",
```

**File**: `apps/cli/config/examples/claude-code-mods.overlay.yml` (removed, +0/-20)
```diff
@@ -1,20 +0,0 @@
-# Opt-in: the Claude Code mods bridge, its band above the prompt, and the three
-# example mods from Anthropic's "Getting started with Claude Code mods" post.
-# Source launch only: the example wrappers are TypeScript under the package's
-# examples/ directory. Mods load in list order and the band above the prompt is
-# one instance consulted in that order, so the guards that yield when idle come
-# before Token Weather, which draws whenever it has a reading.
-#
-#   pnpm dsh web --patch apps/cli/config/examples/claude-code-mods.overlay.yml
-#   pnpm dsh --profile headless --patch apps/cli/config/examples/claude-code-mods.overlay.yml "task"
-- insert:
-    - id: claude-code-mods
-      name: '@deepseek-ai/dsh-experimental-claude-code-mods'
-    - id: claude-code-mod-blast-radius
-      name: '@deepseek-ai/dsh-experimental-claude-code-mods/examples/blast-radius/index.ts'
-    - id: claude-code-mod-replay-theater
-      name: '@deepseek-ai/dsh-experimental-claude-code-mods/examples/replay-theater/index.ts'
-    - id: claude-code-mod-token-weather
-      name: '@deepseek-ai/dsh-experimental-claude-code-mods/examples/token-weather/index.ts'
-    - id: client-ui-claude-code-mods
-      name: '@deepseek-ai/dsh-experimental-client-ui-claude-code-mods'
```

**File**: `apps/cli/package.json` (modified, +1/-3)
```diff
@@ -102,9 +102,7 @@
     "@deepseek-ai/dsh-atomic-write": "workspace:*",
     "@deepseek-ai/dsh-agent-preset": "workspace:*",
     "@deepseek-ai/dsh-experimental-voice-input-bundle": "workspace:*",
-    "@deepseek-ai/dsh-experimental-auto-review": "workspace:*",
-    "@deepseek-ai/dsh-experimental-claude-code-mods": "workspace:*",
-    "@deepseek-ai/dsh-experimental-client-ui-claude-code-mods": "workspace:*"
+    "@deepseek-ai/dsh-experimental-auto-review": "workspace:*"
   },
   "devDependencies": {
     "@agentclientprotocol/sdk": "1.4.0",
```

**File**: `docs/config-catalog.md` (modified, +5/-1)
```diff
@@ -946,7 +946,7 @@ export interface StagehandModelConfig {
 
 ## `@deepseek-ai/dsh-experimental-claude-code-mods`
 
-- `source`: [`packages/experimental/claude-code-mods/src/index.ts:53`](../packages/experimental/claude-code-mods/src/index.ts)
+- `source`: [`packages/experimental/claude-code-mods/src/index.ts:52`](../packages/experimental/claude-code-mods/src/index.ts)
 
 ```ts config-catalog
 /** Plugin config: the limits mod hooks run under. */
@@ -959,6 +959,10 @@ export interface Config {
   processTimeoutMs?: number
   /** Claude Code tool name → harness tool name entries added to the built-in alias table. */
   toolAliases?: Record<string, string>
+  /** Columns the band above the prompt reports to `ui.render` as `bodyColumns` and `viewport.columns`. */
+  bandColumns?: number
+  /** Rows the band reports as `maxRows`. */
+  bandRows?: number
 }
 ```
 <!-- END GENERATED config-catalog:@deepseek-ai/dsh-experimental-claude-code-mods -->
```

**File**: `docs/config-catalog.zh.md` (modified, +5/-1)
```diff
@@ -948,7 +948,7 @@ export interface StagehandModelConfig {
 
 ## `@deepseek-ai/dsh-experimental-claude-code-mods`
 
-- `source`: [`packages/experimental/claude-code-mods/src/index.ts:53`](../packages/experimental/claude-code-mods/src/index.ts)
+- `source`: [`packages/experimental/claude-code-mods/src/index.ts:52`](../packages/experimental/claude-code-mods/src/index.ts)
 
 ```ts config-catalog
 /** Plugin config: the limits mod hooks run under. */
@@ -961,6 +961,10 @@ export interface Config {
   processTimeoutMs?: number
   /** Claude Code tool name → harness tool name entries added to the built-in alias table. */
   toolAliases?: Record<string, string>
+  /** Columns the band above the prompt reports to `ui.render` as `bodyColumns` and `viewport.columns`. */
+  bandColumns?: number
+  /** Rows the band reports as `maxRows`. */
+  bandRows?: number
 }
 ```
 <!-- END GENERATED config-catalog:@deepseek-ai/dsh-experimental-claude-code-mods -->
```

**File**: `docs/module-graph.md` (modified, +1/-2)
```diff
@@ -1287,7 +1287,6 @@ flowchart TD
   pkg_experimental_client_ui_agent_team --> pkg_client_ui_workspace
   pkg_experimental_client_ui_agent_team --> pkg_experimental_agent_team
   pkg_experimental_client_ui_agent_team --> pkg_session
-  pkg_experimental_client_ui_claude_code_mods --> pkg_api_gateway
   pkg_experimental_client_ui_claude_code_mods --> pkg_api_remotes
   pkg_experimental_client_ui_claude_code_mods --> pkg_api_session_controller
   pkg_experimental_client_ui_claude_code_mods --> pkg_client_locale
@@ -1686,7 +1685,7 @@ flowchart TD
 | [`subagent-fork-in-process`](../packages/subagent/subagent-fork-in-process) | `subagent` | [`agent`](../packages/core/agent), [`session`](../packages/core/session), [`subagent`](../packages/subagent/subagent), [`subagent-in-process-driver`](../packages/subagent/subagent-in-process-driver) |
 | [`subagent-spawn-in-process`](../packages/subagent/subagent-spawn-in-process) | `subagent` | [`subagent`](../packages/subagent/subagent), [`subagent-in-process-driver`](../packages/subagent/subagent-in-process-driver) |
 | [`experimental-client-ui-agent-team`](../packages/experimental/client-ui-agent-team) | `experimental` | [`api-session-controller`](../packages/api/session-controller), [`client-locale`](../packages/client/locale), [`client-ui-conversation`](../packages/client/ui-conversation), [`client-ui-primitives`](../packages/client/ui-primitives), [`client-ui-renderer`](../packages/client/ui-renderer), [`client-ui-session`](../packages/client/ui-session), [`client-ui-slots`](../packages/client/ui-slots), [`client-ui-workspace`](../packages/client/ui-workspace), [`experimental-agent-team`](../packages/experimental/agent-team), [`session`](../packages/core/session) |
-| [`experimental-client-ui-claude-code-mods`](../packages/experimental/client-ui-claude-code-mods) | `experimental` | [`api-gateway`](../packages/api/gateway), [`api-remotes`](../packages/api/remotes), [`api-session-controller`](../packages/api/session-controller), [`client-locale`](../packages/client/locale), [`client-ui-conversation`](../packages/client/ui-conversation), [`client-ui-primitives`](../packages/client/ui-primitives), [`client-ui-renderer`](../packages/client/ui-renderer), [`client-ui-session`](../packages/client/ui-session), [`client-ui-slots`](../packages/client/ui-slots), [`experimental-claude-code-mods`](../packages/experimental/claude-code-mods), [`session`](../packages/core/session), [`typert-protocol`](../packages/typert/protocol) |
+| [`experimental-client-ui-claude-code-mods`](../packages/experimental/client-ui-claude-code-mods) | `experimental` | [`api-remotes`](../packages/api/remotes), [`api-session-controller`](../packages/api/session-controller), [`client-locale`](../packages/client/locale), [`client-ui-conversation`](../packages/client/ui-conversation), [`client-ui-primitives`](../packages/client/ui-primitives), [`client-ui-renderer`](../packages/client/ui-renderer), [`client-ui-session`](../packages/client/ui-session), [`client-ui-slots`](../packages/client/ui-slots), [`experimental-claude-code-mods`](../packages/experimental/claude-code-mods), [`session`](../packages/core/session), [`typert-protocol`](../packages/typert/protocol) |
 | [`experimental-client-ui-voice-input`](../packages/experimental/client-ui-voice-input) | `experimental` | [`api-gateway`](../packages/api/gateway), [`api-remotes`](../packages/api/remotes), [`api-session-controller`](../packages/api/session-controller), [`client-locale`](../packages/client/locale), [`client-store`](../packages/client/store), [`client-ui-conversation`](../packages/client/ui-conversation), [`client-ui-plugin-manager`](../packages/client/ui-plugin-manager), [`client-ui-primitives`](../packages/client/ui-primitives), [`client-ui-renderer`](../packages/client/ui-renderer), [`client-ui-session`](../packages/client/ui-session), [`client-ui-slots`](../packages/client/ui-slots), [`experimental-api-speech-to-text`](../packages/experimental/api-speech-to-text), [`experimental-speech-to-text`](../packages/experimental/speech-to-text), [`session`](../packages/core/session), [`typert-protocol`](../packages/typert/protocol) |
 | [`experimental-tool-agent-team`](../packages/experimental/tool-agent-team) | `experimental` | [`agent`](../packages/core/agent), [`experimental-agent-team`](../packages/experimental/agent-team), [`session`](../packages/core/session), [`system-prompt`](../packages/core/system-prompt), [`tools`](../packages/core/tools) |
 | [`schedule`](../packages/schedule/schedule) | `schedule` | [`agent`](../packages/core/agent), [`api-session-controller`](../packages/api/session-controller), [`brand`](../packages/util/brand), [`llm`](../packages/llm/llm), [`session`](../packages/core/session), [`session-persistence`](../packages/session/session-persistence), [`session-projection`](../packages/session/session-projection), [`storage-domain`](../packages/storage/storage-domain), [`subagent`](../packages/subagent/subagent), [`tools`](../p
```

**File**: `docs/module-graph.zh.md` (modified, +1/-2)
```diff
@@ -1289,7 +1289,6 @@ flowchart TD
   pkg_experimental_client_ui_agent_team --> pkg_client_ui_workspace
   pkg_experimental_client_ui_agent_team --> pkg_experimental_agent_team
   pkg_experimental_client_ui_agent_team --> pkg_session
-  pkg_experimental_client_ui_claude_code_mods --> pkg_api_gateway
   pkg_experimental_client_ui_claude_code_mods --> pkg_api_remotes
   pkg_experimental_client_ui_claude_code_mods --> pkg_api_session_controller
   pkg_experimental_client_ui_claude_code_mods --> pkg_client_locale
@@ -1688,7 +1687,7 @@ flowchart TD
 | [`subagent-fork-in-process`](../packages/subagent/subagent-fork-in-process) | `subagent` | [`agent`](../packages/core/agent), [`session`](../packages/core/session), [`subagent`](../packages/subagent/subagent), [`subagent-in-process-driver`](../packages/subagent/subagent-in-process-driver) |
 | [`subagent-spawn-in-process`](../packages/subagent/subagent-spawn-in-process) | `subagent` | [`subagent`](../packages/subagent/subagent), [`subagent-in-process-driver`](../packages/subagent/subagent-in-process-driver) |
 | [`experimental-client-ui-agent-team`](../packages/experimental/client-ui-agent-team) | `experimental` | [`api-session-controller`](../packages/api/session-controller), [`client-locale`](../packages/client/locale), [`client-ui-conversation`](../packages/client/ui-conversation), [`client-ui-primitives`](../packages/client/ui-primitives), [`client-ui-renderer`](../packages/client/ui-renderer), [`client-ui-session`](../packages/client/ui-session), [`client-ui-slots`](../packages/client/ui-slots), [`client-ui-workspace`](../packages/client/ui-workspace), [`experimental-agent-team`](../packages/experimental/agent-team), [`session`](../packages/core/session) |
-| [`experimental-client-ui-claude-code-mods`](../packages/experimental/client-ui-claude-code-mods) | `experimental` | [`api-gateway`](../packages/api/gateway), [`api-remotes`](../packages/api/remotes), [`api-session-controller`](../packages/api/session-controller), [`client-locale`](../packages/client/locale), [`client-ui-conversation`](../packages/client/ui-conversation), [`client-ui-primitives`](../packages/client/ui-primitives), [`client-ui-renderer`](../packages/client/ui-renderer), [`client-ui-session`](../packages/client/ui-session), [`client-ui-slots`](../packages/client/ui-slots), [`experimental-claude-code-mods`](../packages/experimental/claude-code-mods), [`session`](../packages/core/session), [`typert-protocol`](../packages/typert/protocol) |
+| [`experimental-client-ui-claude-code-mods`](../packages/experimental/client-ui-claude-code-mods) | `experimental` | [`api-remotes`](../packages/api/remotes), [`api-session-controller`](../packages/api/session-controller), [`client-locale`](../packages/client/locale), [`client-ui-conversation`](../packages/client/ui-conversation), [`client-ui-primitives`](../packages/client/ui-primitives), [`client-ui-renderer`](../packages/client/ui-renderer), [`client-ui-session`](../packages/client/ui-session), [`client-ui-slots`](../packages/client/ui-slots), [`experimental-claude-code-mods`](../packages/experimental/claude-code-mods), [`session`](../packages/core/session), [`typert-protocol`](../packages/typert/protocol) |
 | [`experimental-client-ui-voice-input`](../packages/experimental/client-ui-voice-input) | `experimental` | [`api-gateway`](../packages/api/gateway), [`api-remotes`](../packages/api/remotes), [`api-session-controller`](../packages/api/session-controller), [`client-locale`](../packages/client/locale), [`client-store`](../packages/client/store), [`client-ui-conversation`](../packages/client/ui-conversation), [`client-ui-plugin-manager`](../packages/client/ui-plugin-manager), [`client-ui-primitives`](../packages/client/ui-primitives), [`client-ui-renderer`](../packages/client/ui-renderer), [`client-ui-session`](../packages/client/ui-session), [`client-ui-slots`](../packages/client/ui-slots), [`experimental-api-speech-to-text`](../packages/experimental/api-speech-to-text), [`experimental-speech-to-text`](../packages/experimental/speech-to-text), [`session`](../packages/core/session), [`typert-protocol`](../packages/typert/protocol) |
 | [`experimental-tool-agent-team`](../packages/experimental/tool-agent-team) | `experimental` | [`agent`](../packages/core/agent), [`experimental-agent-team`](../packages/experimental/agent-team), [`session`](../packages/core/session), [`system-prompt`](../packages/core/system-prompt), [`tools`](../packages/core/tools) |
 | [`schedule`](../packages/schedule/schedule) | `schedule` | [`agent`](../packages/core/agent), [`api-session-controller`](../packages/api/session-controller), [`brand`](../packages/util/brand), [`llm`](../packages/llm/llm), [`session`](../packages/core/session), [`session-persistence`](../packages/session/session-persistence), [`session-projection`](../packages/session/session-projection), [`storage-domain`](../packages/storage/storage-domain), [`subagent`](../packages/subagent/subagent), [`tools`](../p
```

**File**: `docs/subsystems/claude-code-mods.i18n.yaml` (modified, +8/-8)
```diff
@@ -6,20 +6,20 @@
   en: e520df3bf44e1160
   zh: 557956eaf6faf4a7
 /claude-code-mods-compatibility/packaging-and-loading:
-  en: 2c36fb0f324f8a6d
-  zh: 69723bf6e3a953e5
+  en: 75cf021ce8babaab
+  zh: caa20540f8bce11a
 /claude-code-mods-compatibility/events:
-  en: 4932edf66891e29b
-  zh: 0a08ca2fcc233cd2
+  en: cea776ec0063c311
+  zh: 6b8c8b32f2f7ede9
 /claude-code-mods-compatibility/the-chain:
   en: 111c186536345342
   zh: 8ddc81c78c05a840
 /claude-code-mods-compatibility/members:
-  en: 7b4984a5bdf5029b
-  zh: 114b91a050cc8b85
+  en: 1f1d39f01937b39c
+  zh: 6365f4d47ea0ba8f
 /claude-code-mods-compatibility/drawing:
-  en: ad63be0ce30bb705
-  zh: 15811dc20f5f9ce8
+  en: 1bd1a60970fcf426
+  zh: 8f6a8e069f742fb7
 /claude-code-mods-compatibility/testing:
   en: 8b3530b79e09a067
   zh: c041e63f7fd8de5a
```

---

### Incident Patch 5: `34f52880` (2026-10-02)
**Commit Message**: test(experimental): typecheck the mod test fixtures and example wrappers

Hook results spread the typed result from beneath, element props accept an
explicit undefined as a JavaScript mod passes it, the band's registry
payload is narrowed by assertion, and the example wrappers join the Host
typecheck project.

**File**: `packages/experimental/claude-code-mods/src/elements.ts` (modified, +18/-18)
```diff
@@ -17,34 +17,34 @@ export interface UiElement {
 /** What a `ui.render` hook returns: an element, text, nothing, or a list of those. */
 export type UiNode = UiElement | string | number | null | undefined | false | readonly UiNode[]
 
-/** `Box` props this host lays out. */
+/** `Box` props this host lays out; a prop set to `undefined` is one a mod left out. */
 export interface BoxProps {
-  readonly flexDirection?: 'row' | 'column'
-  readonly paddingX?: number
-  readonly paddingY?: number
-  readonly padding?: number
-  readonly gap?: number
-  readonly border?: boolean | string
-  readonly borderColor?: string
-  readonly children?: UiNode
+  readonly flexDirection?: 'row' | 'column' | undefined
+  readonly paddingX?: number | undefined
+  readonly paddingY?: number | undefined
+  readonly padding?: number | undefined
+  readonly gap?: number | undefined
+  readonly border?: boolean | string | undefined
+  readonly borderColor?: string | undefined
+  readonly children?: UiNode | undefined
 }
 
 /** `Text` props this host styles. */
 export interface TextProps {
-  readonly color?: string
-  readonly bold?: boolean
-  readonly dimColor?: boolean
-  readonly italic?: boolean
-  readonly underline?: boolean
-  readonly children?: UiNode
+  readonly color?: string | undefined
+  readonly bold?: boolean | undefined
+  readonly dimColor?: boolean | undefined
+  readonly italic?: boolean | undefined
+  readonly underline?: boolean | undefined
+  readonly children?: UiNode | undefined
 }
 
 /** `Button` props: a label, an optional hotkey hint, and the callback a press runs on the host. */
 export interface ButtonProps {
   readonly label: string
-  readonly hotkey?: string
-  readonly disabled?: boolean
-  readonly onPress?: () => unknown
+  readonly hotkey?: string | undefined
+  readonly disabled?: boolean | undefined
+  readonly onPress?: (() => unknown) | undefined
 }
 
 /** The constructors `$.ui.resolve(e)` returns. */
```

**File**: `packages/experimental/claude-code-mods/tests/bridge.spec.ts` (modified, +1/-1)
```diff
@@ -503,7 +503,7 @@ describe('the mods API over harness services', () => {
 })
 
 describe('$.ui.ask through the user-questions answerer', () => {
-  function askMod(): string {
+  function askMod(): Promise<ModPlugin> {
     return writeMod('ask-mod', `
       export function register(on) {
         on('tool.call', { tool: 'echo' }, async ($, e, next) => {
```

**File**: `packages/experimental/claude-code-mods/tests/chain.spec.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import type { DispatchRequest, LoadedMod, RegisteredHook } from '../src/chain.ts
 import { createModsApi } from '../src/api.ts'
 import type { AnyHook, HookMatcher, ModsApi } from '../src/types.ts'
 
-const mod = (name: string, order = 0): LoadedMod => ({ name, version: undefined, root: '/mods/' + name, modulePath: '', options: {}, order })
+const mod = (name: string, order = 0): LoadedMod => ({ name, version: undefined, root: '/mods/' + name, options: {}, order })
 
 function hook(owner: LoadedMod, event: string, fn: AnyHook, matcher?: HookMatcher): RegisteredHook {
   return { mod: owner, event, matcher, hook: fn, catchHandler: undefined, reported: new Set() }
```

**File**: `packages/experimental/claude-code-mods/tests/define-mod.spec.ts` (modified, +2/-2)
```diff
@@ -17,7 +17,7 @@ describe('defineMod', () => {
       userConfig: { history: 12, unit: 'tokens' },
       register(on, options) {
         seen.push(options)
-        on('turn.complete', ($, e, next) => next(e))
+        on('turn.complete', (_$, e, next) => next(e))
       },
     })
     expect(plugin.name).toBe('claude-code-mod-weather')
@@ -26,7 +26,7 @@ describe('defineMod', () => {
     expect(typeof plugin.definition.register).toBe('function')
     expect(plugin.Config({})).toEqual({})
     expect(plugin.Config({ history: 3, tags: ['a'] })).toEqual({ history: 3, tags: ['a'] })
-    expect(() => plugin.Config({ history: { nested: true } })).toThrow()
+    expect(() => plugin.Config({ history: { nested: true } } as never)).toThrow()
 
     const ctx = new Context()
     fibers.push(ctx.fiber)
```

**File**: `packages/experimental/claude-code-mods/tests/host-ops.spec.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ afterEach(async () => {
   for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
 })
 
-const mod: LoadedMod = { name: 'unit-mod', version: undefined, root: '/mods/unit-mod', modulePath: '', options: {}, order: 0 }
+const mod: LoadedMod = { name: 'unit-mod', version: undefined, root: '/mods/unit-mod', options: {}, order: 0 }
 
 function setup(ctx = new Context()) {
   contexts.push(ctx)
```

**File**: `packages/experimental/claude-code-mods/tests/testing.spec.ts` (modified, +3/-3)
```diff
@@ -65,7 +65,7 @@ describe('createModTestKit: stubs, defaults, and inline mods', () => {
           $.ui.toast(`turn ${value + 1}`, { timeoutMs: 10 })
           const { Text } = $.ui.resolve({ component: 'AbovePrompt', surface: 'AbovePrompt', props: {}, viewport: { columns: 80 } })
           const resolved = Text({ children: 'hi' }).type
-          return { ...(await next(e) as object), turns: value + 1, resolved }
+          return { ...await next(e), turns: value + 1, resolved }
         })
       },
     }] })
@@ -135,7 +135,7 @@ describe('createModTestKit: stubs, defaults, and inline mods', () => {
           await $.store.delete('stale')
           await $.env.set('NOTES_HOME', await $.env.get('HOME_DIR') ?? 'unset')
           await $.env.set('GONE', undefined)
-          return { ...(await next(e) as object), keys: await $.store.keys() }
+          return { ...await next(e), keys: await $.store.keys() }
         })
       },
     }] })
@@ -239,7 +239,7 @@ describe('createModTestKit: surfaces, clocks, and kit defaults', () => {
         on('turn.start', async ($, e, next) => {
           const before = await $.clock.now()
           await $.clock.sleep(250)
-          return { ...(await next(e) as object), before, after: await $.clock.now() }
+          return { ...await next(e), before, after: await $.clock.now() }
         })
       },
     }] })
```

**File**: `packages/experimental/client-ui-claude-code-mods/tests/mount.client.spec.ts` (modified, +14/-1)
```diff
@@ -1,4 +1,5 @@
 /** The band's registration: the Remote mount, one watch per session fed into the dock entry, and the press. */
+import assert from 'node:assert/strict'
 import { Context, Service } from '@deepseek-ai/cordis'
 import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
 import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
@@ -12,6 +13,12 @@ import { inject, mountModsBand } from '../src/client/mount.ts'
 
 const REMOTE: TypertRemoteContribution = { package: '@deepseek-ai/dsh-experimental-claude-code-mods', descriptors: [] }
 
+/** Narrow the erased registry payload before exercising the band's injected face. */
+function assertBandInjected(value: Record<string, unknown>): asserts value is Record<string, unknown> & BandInjected {
+  assert(typeof value.press === 'function')
+  assert(typeof value.hooks === 'object' && value.hooks !== null)
+}
+
 /** A fake `watchBand` stream handle the test feeds by hand. */
 function stream() {
   const queue: SurfaceSnapshot[] = []
@@ -71,7 +78,13 @@ async function fixture() {
   await fiber
   const entry = ctx.slots.entries('conversation.input.dock').find(candidate => candidate.component === Band)
   if (entry === undefined || dispose === undefined) throw new Error('the band registered no dock entry')
-  const injected = (sessionId: string): BandInjected => (entry.inject as (sessionId: SessionId) => BandInjected)(sessionId as SessionId)
+  const injectFace = entry.inject
+  if (injectFace === undefined) throw new Error('the dock entry injects nothing')
+  const injected = (sessionId: string): BandInjected => {
+    const value = injectFace(sessionId as SessionId as never)
+    assertBandInjected(value)
+    return value
+  }
   return { ctx, dispose, unmount, streams, watchBand, pressBand, warn, injected }
 }
 
```

**File**: `tsconfig.host.json` (modified, +1/-0)
```diff
@@ -185,6 +185,7 @@
     "apps/desktop-host/tests/**/*.ts",
     "benchmarks/**/*.ts",
     "packages/*/*/tests/**/*.ts",
+    "packages/experimental/claude-code-mods/examples/*/index.ts",
     "packages/experimental/inspector/scripts/**/*.ts",
     "scripts/**/*.ts",
     "website/**/*.ts",
```

---

### Incident Patch 6: `2794d0a4` (2026-10-02)
**Commit Message**: Merge pull request #5584 from deepseek-harness/fix/plugin-manager-runtime-resolution-1001

fix(plugin-manager): refresh runtime package resolution

**File**: `.agents/notes/implemented/architecture/2026-09-09-profile-resolution-generations.i18n.yaml` (modified, +10/-10)
```diff
@@ -6,8 +6,8 @@
   en: 6a4338564c01ad91
   zh: 241248cff9bd4cfc
 /agent-note-add-immutable-profile-resolution-generations/problem:
-  en: 8e192c176fe48c4c
-  zh: adb965d650088eb0
+  en: 907a40c722a6faff
+  zh: a471d7034d8c231f
 /agent-note-add-immutable-profile-resolution-generations/decision:
   en: a3022a87337058c5
   zh: 1d53a08a25ed6eb3
@@ -21,8 +21,8 @@
   en: 53a9e92698ce9a5d
   zh: 6124d446e8d4a532
 /agent-note-add-immutable-profile-resolution-generations/decision/immutable-generations:
-  en: cd4e64bd80f448a2
-  zh: 585e1fbd8721ae99
+  en: e10b224e0e68b701
+  zh: d43fbdf37e6bfc54
 /agent-note-add-immutable-profile-resolution-generations/decision/shared-esm-and-commonjs-rule:
   en: 0e0575a04a081b52
   zh: 94c74334939e6d13
@@ -33,8 +33,8 @@
   en: 99308bd758859e02
   zh: 35f1e7719fe80d2e
 /agent-note-add-immutable-profile-resolution-generations/decision/additive-package-changes:
-  en: 718dfa7826783f2a
-  zh: 21c3d5fdfae9cb99
+  en: 0e5e2006caec3c91
+  zh: fb3b61dd5692d2e3
 /agent-note-add-immutable-profile-resolution-generations/decision/filesystem-and-runtime-carriers:
   en: b0607713102a093d
   zh: 2de9c33bfaa0e3e2
@@ -45,8 +45,8 @@
   en: 2426173c58a17a48
   zh: 0423b3700273accd
 /agent-note-add-immutable-profile-resolution-generations/verification:
-  en: fbb17aa8fe62b1e8
-  zh: 2ed091fdfd995fc8
+  en: 74cb43ea2ccdb334
+  zh: b966bbed43a83c82
 /agent-note-add-immutable-profile-resolution-generations/consequences:
-  en: 54cae20b2734a07e
-  zh: caa334f8f7a40452
+  en: 457a7d1e82b45fe0
+  zh: 800036e083a7674c
```

**File**: `.agents/notes/implemented/architecture/2026-09-09-profile-resolution-generations.md` (modified, +6/-6)
```diff
@@ -8,7 +8,7 @@ English | [中文](2026-09-09-profile-resolution-generations.zh.md)
 
 A profile loads plugin rows from its own package project, while Harness packages and packages carried by selected bundles can live outside that project's ordinary dependency tree. Bridging the trees through shared symlinks, profile-owned links, or packaged-executable proxy packages persists package selections across processes and installations. Those files require reconciliation and locking, expose generated proxy manifests to metadata readers, and cannot represent a process-local change atomically.
 
-The runtime design keeps installation-first, ordered-bundle, and local-before-fallback precedence. It covers imports performed by plugin modules as well as Loader row imports and works in the main thread and Harness-owned Workers. Generation replacement preserves existing package mappings and local package names, permits linked-root membership changes, and never mutates a live table entry by entry.
+The runtime design keeps installation-first, ordered-bundle, and local-before-fallback precedence. It covers imports performed by plugin modules as well as Loader row imports and works in the main thread and Harness-owned Workers. Generation replacement preserves retained package identities, permits removing profile packages and changing linked-root membership, and never mutates a live table entry by entry.
 
 ## Decision
 
@@ -75,7 +75,7 @@ Linked-root membership is immutable within a generation. A successor may add or
 
 The router retains the real target of each successfully published link name for its lifetime, solely to validate successors. Removing a root does not erase that record or keep its directory intercepted. Re-adding the same name and target is allowed; a different target is rejected because Node caches real paths. Failed publication changes neither the current generation nor the recorded targets.
 
-The launcher constructs one startup generation. The service accepts a complete successor, but no package-manager transaction invokes replacement in this implementation.
+The launcher constructs one startup generation. `ProfileRuntimeResolution` retains only the installation anchor, Harness home, and optional profile directory as recomputation inputs; successors reread disk selection and layers rather than inheriting a supplied profile's synthetic layers. A generation without a profile directory can recompute installation packages. The [package refresh decision](2026-09-30-profile-package-refresh-and-manifest-invalidation.md) assigns successor publication to Plugin Manager operations.
 
 ### Shared ESM and CommonJS rule
 
@@ -105,9 +105,9 @@ New Workers inherit the latest published generation. Existing Workers keep the g
 
 ### Additive package changes
 
-A caller adding a package completes its pnpm transaction before constructing a successor generation. Replacement rejects any generation that changes the directory or version of an existing package. The caller publishes an additive successor before mounting the new Loader row; this implementation does not provide that package transaction. A mount failure may leave the package installed but inactive.
+A caller adding a package completes its pnpm transaction before constructing a successor generation. Replacement rejects any generation that changes the directory or version of a retained package. Plugin Manager publishes the successor before mounting the new Loader row. A mount failure may leave the package installed but inactive.
 
-Changing or removing an existing runtime package mapping, or removing a recorded profile-local package name, requires process restart because Node's ESM Module Map, CommonJS cache, existing object references, and running Workers can retain the old module identity. These restrictions do not prohibit removing a linked root from the interception scope. Generation replacement does not claim to unload modules.
+A retained package keeps its normalized directory, version, and scope; installation entries also keep their declaring anchor and cannot be removed. Violating these restrictions requires process restart because Node's ESM Module Map, CommonJS cache, existing object references, and running Workers can retain the old module identity. A profile entry may change its declaring anchor: deselecting the first bundle that reaches a shared dependency can leave another bundle selecting the same physical package. Profile-scoped mappings and profile-local package names may be removed; the caller stops their plugins before deleting package files. These restrictions do not prohibit removing a linked root from the interception scope. Generation replacement does not claim to unload modules.
 
 ### Filesystem and runtime carriers
 
@@ -142,7 +142,7 @@ Behavior tests exercise root order, transitive and peer dependencies, local and
 ## Verification
 
 - One eager computation supplies the runtime resolution; startup neither writes nor retires module-resolution data.
```

**File**: `.agents/notes/implemented/architecture/2026-09-09-profile-resolution-generations.zh.md` (modified, +6/-6)
```diff
@@ -8,7 +8,7 @@ Status: implemented
 
 profile 从自己的包项目加载插件配置项，而 Harness 包和所选 bundle 携带的包可能位于该项目普通依赖树之外。通过共享 symlink、profile 自有链接或打包可执行文件的代理包连接两棵依赖树，会让选包结果跨进程和安装版本持续存在。这些文件需要协调和锁来维护，并向元数据读取方暴露生成的代理 manifest（元数据清单），也无法原子表示进程内变更。
 
-运行时设计保留安装优先、有序 bundle 和本地包优先于 fallback 的顺序。它覆盖插件模块内部的 import 以及 Loader 配置项的 import，并在主线程和 Harness 自有 Worker 中工作。generation 替换保留既有包映射和本地包名，允许调整 linked root 集合，不会逐项修改正在使用的表。
+运行时设计保留安装优先、有序 bundle 和本地包优先于 fallback 的顺序。它覆盖插件模块内部的 import 以及 Loader 配置项的 import，并在主线程和 Harness 自有 Worker 中工作。generation 替换保持保留包的身份不变，允许移除 profile 包和调整 linked root 集合，不会逐项修改正在使用的表。
 
 ## Decision
 
@@ -75,7 +75,7 @@ linked root 集合在一个 generation 内不可变。后继 generation 可以
 
 解析器在自身生命周期内保留每个已成功发布的 link 名称对应的真实目标，仅用于校验后继 generation。移除 root 不会抹掉该记录，也不会让其目录继续被拦截。同名、同目标可以重新加入；不同目标会被拒绝，因为 Node 缓存真实路径。发布失败时，当前 generation 和已记录目标均不变。
 
-launcher 只构造启动 generation。服务接受完整的后继 generation，但本实现没有包管理器事务调用替换操作。
+launcher 只构造启动 generation。`ProfileRuntimeResolution` 仅保留安装锚点、Harness home 和可选的 profile 目录作为重算输入；后继代重新读取磁盘上的选择与配置层，不继承传入 profile 的合成层。没有 profile 目录的 generation 可以重算安装包。[包操作刷新决策](2026-09-30-profile-package-refresh-and-manifest-invalidation.zh.md)规定由 Plugin Manager 的操作发布后继代。
 
 ### ESM 与 CommonJS 共用规则
 
@@ -105,9 +105,9 @@ runtime resolution 列出它提供的包；Loader entries 组成活动插件列
 
 ### 只增加包的变更
 
-添加包的调用方先完成 pnpm 事务，再构造下一代。替换操作会拒绝改变任何既有 package name 的目录或版本。调用方先发布只增加映射的后继 generation，再挂载新的 Loader 配置项；本实现不提供该包事务。挂载失败可以留下已安装但未启用的包。
+添加包的调用方先完成 pnpm 事务，再构造下一代。替换操作会拒绝改变任何保留包的目录或版本。Plugin Manager 先发布后继 generation，再挂载新的 Loader 配置项。挂载失败可以留下已安装但未启用的包。
 
-修改或删除既有运行时包映射，或删除已记录的 profile 本地包名，需要重启，因为 Node 的 ESM Module Map、CommonJS cache、现存对象引用和运行中的 Worker 都可能保留旧模块 identity。这些限制不禁止从拦截范围移除 linked root。generation 换代不声称卸载模块。
+保留包的规范化目录、版本和作用域必须不变；安装条目还必须保留声明锚点，且不能移除。违反这些限制需要重启，因为 Node 的 ESM Module Map、CommonJS cache、现存对象引用和运行中的 Worker 都可能保留旧模块 identity。profile 条目可以改变声明锚点：取消选入最先找到共享依赖的组合包后，另一个组合包仍可能选中同一物理包。profile 范围的映射和 profile 本地包名可以移除；调用方在删除包文件之前先停止相关插件。这些限制不禁止从拦截范围移除 linked root。generation 换代不声称卸载模块。
 
 ### 文件系统与运行时载体
 
@@ -142,7 +142,7 @@ generation 构造发生在启动或显式更新阶段，不属于单次 resolve
 ## Verification
 
 - 一次 eager 计算供应 runtime resolution；启动既不写入也不退休模块解析数据。
-- [Generation 测试](../../../../packages/boot/app-boot/tests/profile-resolution.spec.ts)覆盖普通目录和递归软链接下的安装图与所选 bundle 图，包括逻辑锚点和真实锚点旁存在不同依赖版本的情况。测试还覆盖 linked root 移除、同目标恢复、重叠 root、原生缺包、已加载模块的新请求，以及移除后重新链接不同目标时的拒绝。
+- [Generation 测试](../../../../packages/boot/app-boot/tests/profile-resolution.spec.ts)覆盖普通目录和递归软链接下的安装图与所选 bundle 图，包括逻辑锚点和真实锚点旁存在不同依赖版本的情况。测试还覆盖同包 profile 声明者变更、保留包身份变更拒绝、捕获目录后的重算、linked root 移除、同目标恢复、重叠 root、原生缺包、已加载模块的新请求，以及移除后重新链接不同目标时的拒绝。
 - [源码启动测试](../../../../apps/cli/tests/source-launch.compat.spec.ts)与[构建入口测试](../../../../apps/cli/tests/built-bin.e2e.ts)通过真实 CLI 运行两种 profile 布局，断言 ESM/CJS 版本、加载路径、各模块格式内的依赖身份，以及一致的 Tools/AgentLoop 模块实例和可访问的 scheduler 键。
 - pkg 与 Electron 载体选择 runtime 解析；Electron 以 Node 模式从 ASAR 承载的 dsh 依赖树执行 Host，原生可执行条目保持 unpacked。
 - ESM 与 CommonJS 适配器共享同一个路由器，并把最终解析委托给 Node，不使用 `module.registerHooks` 或替换 `_findPath`。
@@ -152,4 +152,4 @@ generation 构造发生在启动或显式更新阶段，不属于单次 resolve
 
 ## Consequences
 
-runtime 启动避免磁盘修改和代理 manifest，同时保留包优先级规则。真实目录锚点让依赖发现对齐 Node 默认加载与 tsx workspace 映射，也覆盖软链接逻辑路径会选中另一版本的情况。实现需要持续维护 Node Internal 兼容测试，并在每个自有 Worker 中尽早执行自包含 bootstrap；它不提供纯磁盘后端或 dual 对比模式。包映射和本地包名仍只允许新增；linked root 集合可以变化，而不卸载模块。
+runtime 启动避免磁盘修改和代理 manifest，同时保留包优先级规则。真实目录锚点让依赖发现对齐 Node 默认加载与 tsx workspace 映射，也覆盖软链接逻辑路径会选中另一版本的情况。实现需要持续维护 Node Internal 兼容测试，并在每个自有 Worker 中尽早执行自包含 bootstrap；它不提供纯磁盘后端或 dual 对比模式。profile 包记录和 linked root 集合可以移除，而不卸载模块；保留包的身份保持不变。
```

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.i18n.yaml` (modified, +27/-21)
```diff
@@ -2,30 +2,36 @@
 # section, a hash of its English and Chinese blocks outside code blocks and generated regions.
 # After editing either side, bring the other along and re-record with:
 #   pnpm run verify-translation-pairing --write .agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.md
-/agent-note-expire-hmr-package-configuration:
-  en: e6905d7657387304
-  zh: a7e906173a82f27c
-/agent-note-expire-hmr-package-configuration/problem:
-  en: e327f239592ffec0
-  zh: 339aa414b9dc8652
-/agent-note-expire-hmr-package-configuration/decision:
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration:
+  en: ea66719b3dcdd21c
+  zh: 893364551594ddaf
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/problem:
+  en: e59e3f5c61158701
+  zh: 2ced78e3c84f604e
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision:
   en: a15c7c13f167e5ac
   zh: a15c7c13f167e5ac
-/agent-note-expire-hmr-package-configuration/decision/responsibilities:
-  en: e72abbf8fafc89bb
-  zh: f6c59177696c5cd3
-/agent-note-expire-hmr-package-configuration/decision/hmr-package-configuration-expiry:
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision/responsibilities:
+  en: 3ffd0c78fa204b04
+  zh: f468bab00a7ff357
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision/runtime-resolution:
+  en: ca45b973e1968533
+  zh: 002f23bb70e4fed7
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision/plugin-manager:
+  en: 9b04926c175f22e8
+  zh: fbf05dd4065b0738
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision/hmr-package-configuration-expiry:
   en: c7de8dafe47a5587
   zh: 6010a70d8451edd1
-/agent-note-expire-hmr-package-configuration/decision/future-work:
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision/future-work:
   en: 31818f8f7f80470b
   zh: ecb7ac85bb49cf6d
-/agent-note-expire-hmr-package-configuration/alternatives-considered:
-  en: 5dab1237a312169c
-  zh: b24927d5badedcf7
-/agent-note-expire-hmr-package-configuration/verification:
-  en: d1d931904beb1c9f
-  zh: ea7874b974e1c209
-/agent-note-expire-hmr-package-configuration/consequences:
-  en: e557562e3f7b07bc
-  zh: 3cd196a63e4099b0
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/alternatives-considered:
+  en: 7c1c6d21570cda0d
+  zh: e6f8334c85f1b404
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/verification:
+  en: 939cedceed200cb2
+  zh: c7bb02d0da400c8d
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/consequences:
+  en: 1b9e31b4e773fac5
+  zh: c140ce07fc64bd55
```

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.md` (modified, +42/-1)
```diff
@@ -1,11 +1,14 @@
-# Agent Note: Expire HMR package configuration
+# Agent Note: Refresh runtime resolution after package operations and expire HMR package configuration
 
 Status: implemented
 
 English | [中文](2026-09-30-profile-package-refresh-and-manifest-invalidation.zh.md)
 
 ## Problem
 
+Two pieces of Host state did not follow changes while the process ran:
+
+- **Runtime resolution was built only at startup.** After a GUI install or enablement, nothing published the latest generation, so a bundle's private dependencies never reached the profile fallback and its bare plugins could not be found. After disablement or removal, a new generation could not remove profile-scoped entries or profile-local names, so stale records and package metadata remained. A newly installed package directory is new, and Node holds no stale cache for it; only the table was missing.
 - **Package configuration and module evaluation have separate caches.** Clearing a plugin's module cache does not refresh the package.json fields that Node uses for exports, main, imports, and format detection. A package.json can also be imported as a JSON module, in which case its consumers need ordinary module reloads.
 
 ## Decision
@@ -14,8 +17,37 @@ English | [中文](2026-09-30-profile-package-refresh-and-manifest-invalidation.
 
 | Owner | Does | Does not |
 |---|---|---|
+| resolver (`app-boot/src/profile-resolution/resolver.ts`) | `replace()` allows removing `scope: profile` entries and profile-local names | Touch any Node cache |
+| plugin-manager | Calls `pluginPackages.refresh()` at fixed points of package operations | Construct resolutions or manage module and package-configuration caches |
 | HMR (`packages/boot/hmr`) | Expires package configuration and preserves ordinary reloads for manifests loaded as JSON modules | Reload plugins for configuration-only manifests; handle `node_modules` package replacement |
 
+### Runtime resolution
+
+The [generation Note](2026-09-09-profile-resolution-generations.md) owns package identity and Worker inheritance rules.
+
+Validation of a new generation in `replace()`:
+
+- `scope: profile` entries may be removed.
+- Profile-local package names may be removed.
+- Retained profile entries keep their normalized directory, version, and scope, but may change declaring anchor when another selected bundle supplies the same package. Installation mappings and declaring anchors remain unchanged. The profile scope cannot change; a new local name cannot override an existing entry; a published link name cannot select another real directory.
+
+### Plugin Manager
+
+| Operation | Publication point |
+|---|---|
+| Install a new package | After pnpm succeeds and the bundle selection is saved, before reconciliation, whether or not the bundle is enabled |
+| Overwrite an installed package | No publication; the result is `restart-required` |
+| Enable a bundle | After the selection is saved, before reconciliation |
+| Disable a bundle | With HMR, after reconciliation stops its plugins; without HMR, no publication, and running plugins keep the current table |
+| Remove | After pnpm remove succeeds, inside the HMR transaction |
+| Failed or cancelled install, failed removal | No publication |
+
+`createRuntimeResolution()` returns a `ProfileRuntimeResolution`, which privately keeps the installation anchor, Harness home, and profile directory it was computed from. Its `computeLatestResolution()` rereads that profile with the same inputs and returns a new object for the latest generation, leaving the original unchanged; Workers receive only the table fields. `PluginPackages.refresh()` calls the current resolution's `computeLatestResolution()` and then `replace()`; a resolution constructed as plain data cannot be refreshed and makes the call throw.
+
+Without HMR, deselecting a startup bundle does not stop its plugins. While such a bundle remains deselected, later package operations keep the existing runtime table instead of publishing its removal. Other no-HMR installations and removals of non-running bundles still publish normally.
+
+A successful package operation is not rolled back when publication is rejected afterwards. The result reports the failed runtime application and retains the successful disk changes. Recomputing uses the captured profile directory on disk, not synthetic in-memory layers; a computed resolution without a profile recomputes installation packages only.
+
 ### HMR package-configuration expiry
 
 In HMR's change dispatch, a changed file named `package.json` outside `node_modules` goes to `PackageManifests.invalidate()`. A manifest in the host dependency graph still requests a host reload; one loaded as a JSON module still reloads its consumers. A configuration-only manifest schedules no module reload. Configuration-owned paths stay with their dedicated watcher. Source changes in the same batch reload afterwards.
@@ -54,6 +86,10 @@ The binding's `getNearestParentPackageJSON` is called only by `pack
```

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.zh.md` (modified, +42/-1)
```diff
@@ -1,11 +1,14 @@
-# Agent Note: HMR 包配置失效
+# Agent Note: 包操作刷新 runtime resolution 与 HMR 包配置失效
 
 Status: implemented
 
 [English](2026-09-30-profile-package-refresh-and-manifest-invalidation.md) | 中文
 
 ## Problem
 
+Host 运行期间有两处状态没有随变化更新：
+
+- **runtime resolution 只在启动时构造。** GUI 安装或启用 bundle 后，没有人发布最新代，bundle 的私有依赖进不了 profile fallback，它的 bare 插件找不到。停用、卸载后，新一代又不允许移除 profile 范围的条目和本地包名，旧记录和包元数据一直留着。新安装的包目录本身是新的，Node 对它没有旧缓存，缺的只是这张表。
 - **包配置与模块求值使用独立缓存。** 清理插件的模块缓存不会刷新 Node 用于 exports、main、imports 和格式判断的 package.json 字段。package.json 也可以被作为 JSON 模块导入，此时其消费方需要普通的模块重载。
 
 ## Decision
@@ -14,8 +17,37 @@ Status: implemented
 
 | 负责方 | 做什么 | 不做什么 |
 |---|---|---|
+| resolver（`app-boot/src/profile-resolution/resolver.ts`） | `replace()` 允许移除 `scope: profile` 条目和 profile 本地包名 | 不碰 Node 的任何缓存 |
+| plugin-manager | 在包操作的确定时点调用 `pluginPackages.refresh()` | 不构造 resolution；不管模块缓存与包配置缓存 |
 | HMR（`packages/boot/hmr`） | 使包配置失效，并保留作为 JSON 模块加载的 manifest 的普通重载 | 不因仅作为配置的 manifest 重载插件；不处理 `node_modules` 包替换 |
 
+### runtime resolution
+
+包身份与 Worker 继承规则由[代际说明](2026-09-09-profile-resolution-generations.zh.md)定义。
+
+`replace()` 对新一代的校验：
+
+- `scope: profile` 的条目可以移除。
+- profile 本地包名可以移除。
+- 保留的 profile 条目保持规范化目录、版本与作用域不变；另一个已选 bundle 提供同一包时，可以更换声明锚点。安装范围的映射与声明锚点保持不变。profile 范围不能变；新本地包名不能覆盖已有条目；已发布的 link 名称不能换真实目录。
+
+### plugin-manager
+
+| 操作 | 发布时点 |
+|---|---|
+| 安装新包 | pnpm 成功、保存 bundle 选择之后，reconciliation 之前；无论是否立即启用都发布 |
+| 覆盖已安装的包 | 不发布，结果为 `restart-required` |
+| 启用 bundle | 保存选择后发布，再做 reconciliation |
+| 停用 bundle | 有 HMR 时，reconciliation 让插件退出后再发布；没有 HMR 时不发布，运行中的插件继续使用原表 |
+| 卸载 | pnpm remove 成功后，在 HMR 事务内发布 |
+| 安装失败、取消、卸载失败 | 不发布 |
+
+`createRuntimeResolution()` 返回 `ProfileRuntimeResolution`，它私有保存构造时的 installAnchor、home 和 profile 目录；`computeLatestResolution()` 用同一组输入重新读取 profile，返回表示最新代的新对象，原实例不变；Worker 只收到表数据。`PluginPackages.refresh()` 调用当前 resolution 的 `computeLatestResolution()` 再 `replace()`；以纯数据构造的 resolution 无法刷新，调用时抛错。
+
+没有 HMR 时，取消启动 bundle 的选择不会停止它的插件。只要该 bundle 仍未选中，后续包操作就保留当前 runtime 表，不发布其移除。其他无 HMR 的安装和未运行 bundle 卸载仍正常发布。
+
+包操作成功后若发布被拒绝，不回滚已完成的包操作。结果报告运行时应用失败，并保留成功的磁盘变更。重新计算使用捕获的磁盘 profile 目录，不继承内存合成 layers；没有 profile 的已计算 resolution 只重算安装范围的包。
+
 ### HMR 包配置失效
 
 HMR 的文件变化分派中，文件名为 `package.json` 且不在 `node_modules` 内的变化，交给 `PackageManifests.invalidate()`。位于宿主依赖图中的 manifest 仍请求宿主重载；作为 JSON 模块加载的 manifest 仍重载消费方。仅作为配置的 manifest 不安排模块重载。配置专属路径仍由其独立 watcher 处理。同一批的源码变化随后重载。
@@ -54,6 +86,10 @@ binding 的 `getNearestParentPackageJSON` 只被 `package_json_reader` 自己调
 
 ## Alternatives considered
 
+**每次查找都读当前磁盘（#4703）。** 解析能跟上磁盘，但不清模块缓存，也不重载运行中的插件。同一 URL 时新内容不生效，不同 URL 时新旧版本在同一进程并存。它还要维护一份入口解析实现，并且绕过自定义 bare-name hook。它也没有刷新 runtime resolution，GUI 安装的私有依赖依然找不到。
+
+**在 runtime resolution 发布时全量重读已见过的 manifest（#5496）。** 它把包配置失效放进了绑定表发布，和模块缓存脱了钩：覆盖已安装的包时报需要重启，但下一次无关的发布会让新导入拿到新版本，旧插件仍在运行。包配置缓存属于内容，应该和模块缓存由同一方负责，也就是 HMR。
+
 **让 HMR 支持 `node_modules` 内的包重载。** 这需要沿包含 `node_modules` 的模块图确定受影响插件，防止共享库和 Cordis 被重复求值，还要处理动态 import 漏边、模块副作用和 Worker。本次不做，这些场景继续要求重启。
 
 **package.json 变化时重载所有插件。** 仅作为配置的 manifest 不要求模块求值。实际作为 JSON 模块导入的 manifest 保留普通的依赖驱动重载。
@@ -66,13 +102,18 @@ binding 的 `getNearestParentPackageJSON` 只被 `package_json_reader` 自己调
 
 | 覆盖面 | 位置 |
 |---|---|
+| 新一代可移除 profile 条目与本地包名、仍拒绝修改保留条目 | `packages/boot/app-boot/tests/profile-resolution.spec.ts` |
+| GUI 安装、延迟启用、停用、卸载、覆盖、失败、取消，有无 HMR | `packages/boot/plugin-manager/tests/package-reload.spec.ts` |
+| 捕获目录后的重新计算、无 profile 的已计算 resolution 刷新、纯数据拒绝 | `packages/boot/app-boot/tests/profile-resolution.spec.ts`、`packages/boot/app-boot/tests/profile-resolution-service.spec.ts` |
+| 无 HMR 连续操作、共享依赖声明来源、磁盘成功但发布失败 | `packages/boot/plugin-manager/tests/package-reload.spec.ts` |
 | 失效后的 exports、main、imports、type、scope、最近 package.json，原生 reader 对照，实际 CommonJS 加载及旧模块实例保留，node_modules 边界，恢复 | `packages/boot/hmr/tests/package-manifest.spec.ts` |
 | 配置专用 manifest、JSON 模块与宿主重载、源码重载、同名及共享运行时的 entry、导入与激活失败回滚、entry 重启和 node_modules 排除规则 | `packages/boot/hmr/tests/package-manifest-dispatch.spec.ts` |
 
 测试不需要 API key，不调用模型。
 
 ## Consequences
 
+- 有 HMR 时，支持的包操作发布更新后的私有依赖，并在插件停止后移除不再需要的映射。没有 HMR 时，待生效的启动 bundle 停用会将后续发布延迟到重启，保留运行中插件的映射。
 - 在支持的线程内，package.json 配置读取使用更新后的字段；JSON 模块保留自己的重载行为。上述模块、loader 线程及 Worker 的独立限制仍然适用。
 - 包配置读取改由 JS 解析 package.json，需要与原生读取保持字段和错误语义一致；测试在 Node 22、24、26 上与原生读取逐项比较。
 - 依赖多个 Node internal 接口，Node 升级时需要重跑这些测试。
```

**File**: `apps/web/tests/scaffold.ts` (modified, +1/-1)
```diff
@@ -742,7 +742,6 @@ export async function launchWebScaffold(options: LaunchOptions = {}): Promise<We
       patches: [],
     }
     const resolutionOptions = { installAnchor: INSTALL_ANCHOR, home: harnessHome, profile }
-    const resolution = await createRuntimeResolution(resolutionOptions)
     await mkdir(profileDir, { recursive: true })
     const rootConfig = join(profileDir, 'cordis.yml')
     await writeFile(rootConfig, '[]\n')
@@ -796,6 +795,7 @@ export async function launchWebScaffold(options: LaunchOptions = {}): Promise<We
         throw new Error(`web e2e scaffold: the web app requested exit ${String(code)} with no arguments to reject`)
       },
     })
+    const resolution = await createRuntimeResolution(resolutionOptions)
     await ctx.plugin(PluginPackages, {
       resolution,
     })
```

**File**: `apps/web/tests/voice-setup.e2e.ts` (modified, +1/-2)
```diff
@@ -34,8 +34,7 @@ it('guides a newly enabled voice plugin to installation and lets the user postpo
   const card = page.locator('[data-plugin-package="@deepseek-ai/dsh-experimental-voice-input-bundle"]')
   expect(await card.getByRole('status').count()).toBe(0)
   await toggle.click()
-  await expect.poll(() => toggle.getAttribute('aria-checked')).toBe('false')
-  await toggle.click()
+  await page.getByRole('switch', { name: 'Enable Voice input', exact: true, checked: false }).click()
   await dialog.getByRole('button', { name: 'Go to setup', exact: true }).click()
   await page.getByRole('button', { name: 'Download and prepare', exact: true }).waitFor()
   expect(await dialog.count()).toBe(0)
```

---

### Incident Patch 7: `0046fe3f` (2026-10-01)
**Commit Message**: test(app-boot): update captured resolution source fixture

**File**: `packages/boot/app-boot/tests/config-schema.spec.ts` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ describe('generateConfigSchema', () => {
     const original = structuredClone(layers)
     const installAnchor = join(dir, 'installation.json')
     const resolve = vi.spyOn(profileOperations, 'createRuntimeResolution')
-      .mockResolvedValue(new profileOperations.ProfileRuntimeResolution({ installAnchor: '', home: '', profile: undefined }, resolution))
+      .mockResolvedValue(new profileOperations.ProfileRuntimeResolution({ installAnchor: '', home: '', profileDir: undefined }, resolution))
     const result = await generateConfigSchema(profile, layers, installAnchor)
     expect(resolve).toHaveBeenCalledExactlyOnceWith({ installAnchor, profile })
     expect(result['x-cordis'].entries.map(entry => [entry.path, entry.name])).toEqual([
```

---

### Incident Patch 8: `abf8b760` (2026-10-01)
**Commit Message**: fix(plugin-manager): preserve live runtime resolution mappings

**File**: `packages/boot/app-boot/src/profile-resolution/resolver.ts` (modified, +5/-3)
```diff
@@ -127,9 +127,11 @@ export interface RuntimeInterception {
    * Atomically publish a complete successor and fresh caches. Profile-scoped mappings, local names, and linked
    * roots may be removed; removed roots stop intercepting uncovered directories. Existing modules and Node caches
    * remain intact, so callers remove a package only after its plugins stop.
+   * A retained profile mapping may change its declarer if its normalized directory, version, and scope stay unchanged.
    * @param successor - fully constructed generation retaining the installation mappings.
-   * @throws when the profile scope or a retained mapping changes, an installation mapping is removed, a new local name
-   * overrides an existing mapping, or a previously published link name selects a different real directory.
+   * @throws when the profile scope, a retained directory, version, scope, or installation declarer changes;
+   * an installation mapping is removed; a new local name overrides an existing mapping; or a previously published
+   * link name selects a different real directory.
    */
   replace(successor: RuntimeResolution): void
   /** Restore the native resolver methods. Interceptions dispose in reverse order. */
@@ -382,7 +384,7 @@ class ResolutionRouter {
       if (next === undefined && current.scope === 'profile') continue
       if (next === undefined
         || !sameResolution(current.packageDir, next.packageDir)
-        || !sameResolution(current.declarer, next.declarer)
+        || (current.scope === 'installation' && !sameResolution(current.declarer, next.declarer))
         || current.version !== next.version
         || current.scope !== next.scope) {
         throw new Error(`profile resolution: replacing ${JSON.stringify(name)} requires a process restart`)
```

**File**: `packages/boot/app-boot/src/profile-resolution/service.ts` (modified, +5/-2)
```diff
@@ -78,7 +78,9 @@ export class PluginPackages extends Service {
 
   /**
    * Publish a complete successor generation for this process and subsequently created Workers.
-   * Linked roots may be removed without unloading modules or clearing Node caches.
+   * Profile mappings and local package names may be removed after their plugins stop; linked roots may also be removed.
+   * Retained profile mappings may change their declarer, but not their normalized directory, version, or scope;
+   * installation mappings must remain unchanged. Publication does not unload modules or clear Node caches.
    * @param successor - fully constructed generation accepted by {@link RuntimeInterception.replace}.
    */
   replace(successor: RuntimeResolution): void {
@@ -93,7 +95,8 @@ export class PluginPackages extends Service {
   /**
    * Publish the latest generation computed by the installed resolution through {@link replace}. Package contents
    * and loaded modules are not reloaded.
-   * @throws when no resolution is installed, the installed one was not computed from a profile, or the successor is rejected.
+   * @throws when no resolution is installed, it is plain data rather than a {@link ProfileRuntimeResolution},
+   * reading the latest files fails, or the successor is rejected. A computed resolution without a profile can refresh.
    */
   async refresh(): Promise<void> {
     if (!(this.current instanceof ProfileRuntimeResolution)) {
```

**File**: `packages/boot/app-boot/src/profile.ts` (modified, +6/-5)
```diff
@@ -455,7 +455,7 @@ export async function createRuntimeResolution(
     : collectProfileScopePackages(profile, packageNames, profileDeclarers, profileVersions)
   const linkedRoots = profile === undefined ? [] : linkedProfileRoots(profile, profilesDir)
   // The Promise return type is the pre-stable API; construction has no asynchronous step.
-  return await Promise.resolve(new ProfileRuntimeResolution({ installAnchor, profile, home }, {
+  return await Promise.resolve(new ProfileRuntimeResolution({ installAnchor, profileDir: profile?.dir, home }, {
     profilesDir,
     profileDir: profile?.dir,
     localPackageNames: Object.freeze(localPackageNames),
@@ -477,7 +477,7 @@ export async function createRuntimeResolution(
 interface ResolutionSource {
   installAnchor: string
   home: string
-  profile: Profile | undefined
+  profileDir: string | undefined
 }
 
 /**
@@ -508,14 +508,15 @@ export class ProfileRuntimeResolution implements RuntimeResolution {
 
   /**
    * Compute the latest generation from the same installation, profile directory, and Harness home, rereading the
-   * profile's manifest, bundle selection, and installed packages. This instance is unchanged.
+   * profile's manifest, bundle selection, and installed packages from disk, without retaining synthetic layers.
+   * With no profile directory, only installation packages are recomputed. This instance is unchanged.
    * @returns a new resolution for the latest generation.
    */
   computeLatestResolution(): Promise<ProfileRuntimeResolution> {
-    const { installAnchor, home, profile } = this.#source
+    const { installAnchor, home, profileDir } = this.#source
     return createRuntimeResolution({
       installAnchor, home,
-      ...profile === undefined ? {} : { profile: loadProfileDirectory('dsh', profile.dir, installAnchor) },
+      ...profileDir === undefined ? {} : { profile: loadProfileDirectory('dsh', profileDir, installAnchor) },
     })
   }
 }
```

**File**: `packages/boot/app-boot/tests/profile-resolution-service.spec.ts` (modified, +20/-1)
```diff
@@ -83,7 +83,26 @@ describe('profile package metadata service', () => {
     expect(createRequire(join(profileDir, 'caller.cjs')).resolve('metadata-lib')).toBe(join(privateDir, 'index.cjs'))
   })
 
-  it('rejects refreshing a resolution that was not computed from a profile', async () => {
+  it('refreshes a computed resolution without a profile', async () => {
+    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-package-service-installation-')))
+    roots.push(root)
+    const installAnchor = join(root, 'install', 'package.json')
+    file(installAnchor, JSON.stringify({ name: 'installation', version: '1.0.0', dependencies: { 'metadata-lib': '*' } }))
+    const ctx = new Context()
+    contexts.push(ctx)
+    await ctx.plugin(PluginPackages, { resolution: await createRuntimeResolution({ installAnchor, home: root }) })
+    const parentURL = pathToFileURL(join(root, 'profiles', 'test', 'caller.cjs')).href
+    expect(ctx.pluginPackages.packageOf('metadata-lib', parentURL)).toBeUndefined()
+    const packageDir = join(root, 'install', 'node_modules', 'metadata-lib')
+    pkg(packageDir, '1.0.0')
+
+    await ctx.pluginPackages.refresh()
+
+    expect(ctx.pluginPackages.packageOf('metadata-lib', parentURL)).toMatchObject({ dir: packageDir, version: '1.0.0' })
+    expect(createRequire(parentURL).resolve('metadata-lib')).toBe(join(packageDir, 'index.cjs'))
+  })
+
+  it('rejects refreshing a plain-data or absent resolution', async () => {
     const root = mkdtempSync(join(tmpdir(), 'dsh-package-service-plain-'))
     roots.push(root)
     const packageDir = join(root, 'lib')
```

**File**: `packages/boot/app-boot/tests/profile-resolution.spec.ts` (modified, +77/-0)
```diff
@@ -1618,6 +1618,14 @@ describe('runtime resolution', { concurrent: false }, () => {
           : entry),
       })
     }).toThrow(/requires a process restart/u)
+    expect(() => {
+      registration.replace({
+        ...first,
+        entries: first.entries.map(entry => entry.name === '@deepseek-ai/dsh-core'
+          ? { ...entry, declarer: join(f.root, 'another-bundle', 'package.json') }
+          : entry),
+      })
+    }).toThrow(/requires a process restart/u)
     expect(() => {
       registration.replace({ ...first, localPackageNames: ['@deepseek-ai/dsh-core'] })
     }).toThrow(/requires a process restart/u)
@@ -1671,6 +1679,75 @@ describe('runtime resolution', { concurrent: false }, () => {
     expect(registration.packageDir('private-lib', parent)).toBe(firstDir)
   })
 
+  it('accepts another profile declarer for the same normalized package directory and version', async () => {
+    const f = fixture()
+    const shared = join(f.root, 'shared', 'node_modules', 'private-lib')
+    pkg(shared, 'private-lib', 1)
+    const firstAnchor = pkg(join(f.root, 'shared', 'bundle-a'), 'bundle-a', 1, { 'private-lib': '*' })
+    const nextAnchor = pkg(join(f.root, 'shared', 'bundle-b'), 'bundle-b', 1, { 'private-lib': '*' })
+    const alias = join(f.root, 'private-lib-alias')
+    symlinkSync(shared, alias, process.platform === 'win32' ? 'junction' : 'dir')
+    try {
+      const base = await resolutionOf(f)
+      const entry = { name: 'private-lib', packageDir: shared, declarer: firstAnchor, version: '1.0.0', scope: 'profile' as const }
+      const registration = installRuntimeInterception({ ...base, entries: [...base.entries, entry] })
+      registrations.push(registration)
+      const parent = pathToFileURL(join(f.profile.dir, 'entry.mjs')).href
+      const require = createRequire(parent)
+      expect(registration.packageDir('private-lib', parent)).toBe(shared)
+      expect(require.resolve('private-lib')).toBe(join(shared, 'index.cjs'))
+      expect(resolveFrom('private-lib', parent)).toBe(pathToFileURL(join(shared, 'index.js')).href)
+
+      registration.replace({ ...base, entries: [...base.entries, { ...entry, packageDir: alias, declarer: nextAnchor }] })
+
+      expect(registration.packageDir('private-lib', parent)).toBe(alias)
+      expect(require.resolve('private-lib')).toBe(join(shared, 'index.cjs'))
+      expect(resolveFrom('private-lib', parent)).toBe(pathToFileURL(join(shared, 'index.js')).href)
+    } finally {
+      unlinkSync(alias)
+    }
+  })
+
+  it.each(['directory', 'version', 'scope'] as const)('rejects a retained profile mapping with a different %s', async (change) => {
+    const f = fixture()
+    const packageDir = join(f.root, 'bundle', 'node_modules', 'private-lib')
+    pkg(packageDir, 'private-lib', 1)
+    const base = await resolutionOf(f)
+    const entry = { name: 'private-lib', packageDir, declarer: join(packageDir, 'package.json'), version: '1.0.0', scope: 'profile' as const }
+    const registration = installRuntimeInterception({ ...base, entries: [...base.entries, entry] })
+    registrations.push(registration)
+    const successor = {
+      ...entry,
+      packageDir: change === 'directory' ? join(f.root, 'different') : entry.packageDir,
+      version: change === 'version' ? '2.0.0' : entry.version,
+      scope: change === 'scope' ? 'installation' as const : entry.scope,
+    }
+
+    expect(() => { registration.replace({ ...base, entries: [...base.entries, successor] }) })
+      .toThrow(/replacing "private-lib" requires a process restart/u)
+    expect(registration.packageDir('private-lib', pathToFileURL(join(f.profile.dir, 'entry.mjs')).href)).toBe(packageDir)
+  })
+
+  it('recomputes from the captured directory without retaining synthetic profile layers', async () => {
+    const f = fixture()
+    const profileDir = f.profile.dir
+    const bundleDir = join(f.root, 'synthetic-bundle')
+    pkg(bundleDir, 'synthetic-bundle', 1, { 'private-lib': '*' })
+    pkg(join(bundleDir, 'node_modules', 'private-lib'), 'private-lib', 1)
+    f.profile.layers.push({ packageName: 'synthetic-bundle', packageDir: bundleDir, patchPaths: [], patches: [] })
+    const first = await createRuntimeResolution({ installAnchor: f.installAnchor, home: f.root, profile: f.profile })
+    expect(first.entries.some(entry => entry.name === 'private-lib')).toBe(true)
+    f.profile.dir = join(f.root, 'another-profile')
+    file(join(f.profile.dir, 'package.json'), JSON.stringify({ name: 'another-profile' }))
+
+    const latest = await first.computeLatestResolution()
+
+    expect(latest.profileDir).toBe(profileDir)
+    expect(latest.entries.some(entry => entry.name === 'private-lib')).toBe(false)
+    expect(first.profileDir).toBe(profileDir)
+    expect(first.entries.some(entry => entry.name === 'private-lib')).toBe(true)
+  })
+
   it('leaves non-package and out-of-scope metadata lookups to native resolution', async () => {
     const f = fixture()
     const outs
```

**File**: `packages/boot/plugin-manager/src/index.ts` (modified, +5/-0)
```diff
@@ -779,6 +779,11 @@ export class PluginManager extends TypertRemoteService {
   }
 
   private async refreshPackages(): Promise<void> {
+    if (this.ownerContext.get('hmr') === undefined) {
+      const selected = readProfileManifest('dsh', this.profile.dir).dsh?.profile?.bundles ?? []
+      // Deselected startup bundles still run without HMR and need the existing package table.
+      if (this.profile.startedBundles.some(name => !selected.includes(name))) return
+    }
     await this.ownerContext.get('pluginPackages')?.refresh()
   }
 
```

**File**: `packages/boot/plugin-manager/tests/package-reload.spec.ts` (modified, +101/-2)
```diff
@@ -1,5 +1,6 @@
 /** GUI package operations publish profile package resolution around activation and disposal through the real Loader. */
-import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
+import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
+import { createRequire } from 'node:module'
 import { tmpdir } from 'node:os'
 import { join } from 'node:path'
 import { pathToFileURL } from 'node:url'
@@ -66,7 +67,20 @@ function removeFiles(dir: string): void {
   rmSync(join(dir, 'node_modules', 'addon'), { recursive: true })
 }
 
-async function fixture(options: { live?: boolean; installed?: boolean; enabled?: boolean } = {}) {
+function installOtherBundle(dir: string, shared = false): void {
+  const bundleDir = join(dir, 'node_modules', 'other')
+  mkdirSync(bundleDir, { recursive: true })
+  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({
+    name: 'other', version: '1.0.0', dependencies: shared ? { 'addon-plugin': '1.0.0' } : {},
+    dsh: { bundle: { patch: './cordis.patch.yml' } },
+  }))
+  writeFileSync(join(bundleDir, 'cordis.patch.yml'), '[]\n')
+  const manifest = readProfileManifest('test', dir)
+  manifest.dependencies = { ...manifest.dependencies, other: '1.0.0' }
+  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest))
+}
+
+async function fixture(options: { live?: boolean; installed?: boolean; enabled?: boolean; shared?: boolean } = {}) {
   const home = realpathSync.native(mkdtempSync(join(tmpdir(), 'manager-package-reload-')))
   let owner: Context | undefined
   onTestFinished(async () => {
@@ -98,6 +112,13 @@ export function apply(ctx) {
   manifest.dependencies = {}
   writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest))
   if (options.installed === true) installFiles(dir, 1)
+  if (options.shared === true) {
+    renameSync(join(dir, 'node_modules', 'addon', 'node_modules', 'addon-plugin'), join(dir, 'node_modules', 'addon-plugin'))
+    installOtherBundle(dir, true)
+    const shared = readProfileManifest('test', dir)
+    shared.dsh = { profile: { bundles: ['core', 'addon', 'other'] } }
+    writeFileSync(join(dir, 'package.json'), JSON.stringify(shared))
+  }
   const loaded = loadProfileDirectory('test', dir, installAnchor)
   const profile: ProfileContext = {
     name: 'test', dir, patchPath: join(dir, 'cordis.patch.yml'), installAnchor, cwd: home, home,
@@ -227,6 +248,64 @@ it('keeps the running plugin and its private package lookup when a bundle is dis
   expect(trace).toEqual(['start:sibling', 'start:addon:1'])
 })
 
+it('keeps the running bundle resolution through later package operations without HMR', async () => {
+  const { ctx, dir, trace, published, manager, parentURL, entry } = await fixture({ live: false, installed: true })
+  const previous = entry()?.fiber
+  const mapping = ctx.pluginPackages.packageOf('addon-plugin', parentURL)
+  expect(previous?.state).toBe(FiberState.ACTIVE)
+  expect(mapping?.version).toBe('1.0.0')
+  mockPnpm(dir, trace, (args) => {
+    if (args[0] === 'add') {
+      installOtherBundle(dir)
+    } else {
+      expect(args).toEqual(['remove', 'other'])
+      const manifest = readProfileManifest('test', dir)
+      delete manifest.dependencies?.other
+      writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest))
+      rmSync(join(dir, 'node_modules', 'other'), { recursive: true })
+    }
+  })
+  const expectRunningBundle = () => {
+    expect(ctx.pluginPackages.packageOf('addon-plugin', parentURL)).toBe(mapping)
+    expect(entry()?.fiber).toBe(previous)
+    expect(previous?.state).toBe(FiberState.ACTIVE)
+    expect(ctx.get('addonVersion')).toBe(1)
+    expect(published).not.toHaveBeenCalled()
+  }
+
+  expect(await manager.setBundleEnabled('addon', false)).toMatchObject({ application: 'restart-required', changed: true })
+  expectRunningBundle()
+  expect(await manager.installBundle('other', { enabled: false })).toMatchObject({ application: 'restart-required', changed: true })
+  expectRunningBundle()
+  expect(await manager.setBundleEnabled('other', true)).toMatchObject({ application: 'restart-required', changed: true })
+  expectRunningBundle()
+  expect(await manager.removeBundle('other')).toMatchObject({ application: 'restart-required', changed: true })
+  expectRunningBundle()
+  expect(readProfileManifest('test', dir).dsh?.profile?.bundles).toEqual(['core'])
+  expect(readProfileManifest('test', dir).dependencies).toEqual({ addon: '1.0.0' })
+  expect(existsSync(join(dir, 'node_modules', 'other'))).toBe(false)
+  expect(trace).toEqual(['start:sibling', 'start:addon:1', 'pnpm:add', 'pnpm:remove'])
+})
+
+it.each(['disable', 'remove'] as const)('retains a shared dependency after %s of its first declaring bundle', async (operation) => {
+  const { ctx, dir, trace, published, manager, parentURL, entry } = await fixture({ installed: true, shared: true })
+
```

---

### Incident Patch 9: `869afc49` (2026-09-30)
**Commit Message**: fix(plugin-manager): refresh runtime package resolution

**File**: `.agents/notes/implemented/architecture/2026-09-09-profile-resolution-generations.i18n.yaml` (modified, +8/-8)
```diff
@@ -6,8 +6,8 @@
   en: 6a4338564c01ad91
   zh: 241248cff9bd4cfc
 /agent-note-add-immutable-profile-resolution-generations/problem:
-  en: 8e192c176fe48c4c
-  zh: adb965d650088eb0
+  en: deee06bffda52a6a
+  zh: a4eb7c0bfebb0a7f
 /agent-note-add-immutable-profile-resolution-generations/decision:
   en: a3022a87337058c5
   zh: 1d53a08a25ed6eb3
@@ -21,8 +21,8 @@
   en: 53a9e92698ce9a5d
   zh: 6124d446e8d4a532
 /agent-note-add-immutable-profile-resolution-generations/decision/immutable-generations:
-  en: cd4e64bd80f448a2
-  zh: 585e1fbd8721ae99
+  en: 8ca32abdff273e2d
+  zh: e7ca1d76a9af8f80
 /agent-note-add-immutable-profile-resolution-generations/decision/shared-esm-and-commonjs-rule:
   en: 0e0575a04a081b52
   zh: 94c74334939e6d13
@@ -33,8 +33,8 @@
   en: 99308bd758859e02
   zh: 35f1e7719fe80d2e
 /agent-note-add-immutable-profile-resolution-generations/decision/additive-package-changes:
-  en: 718dfa7826783f2a
-  zh: 21c3d5fdfae9cb99
+  en: b689db324c5b59c1
+  zh: af5a46acbd7be8d7
 /agent-note-add-immutable-profile-resolution-generations/decision/filesystem-and-runtime-carriers:
   en: b0607713102a093d
   zh: 2de9c33bfaa0e3e2
@@ -48,5 +48,5 @@
   en: fbb17aa8fe62b1e8
   zh: 2ed091fdfd995fc8
 /agent-note-add-immutable-profile-resolution-generations/consequences:
-  en: 54cae20b2734a07e
-  zh: caa334f8f7a40452
+  en: 457a7d1e82b45fe0
+  zh: 800036e083a7674c
```

**File**: `.agents/notes/implemented/architecture/2026-09-09-profile-resolution-generations.md` (modified, +5/-5)
```diff
@@ -8,7 +8,7 @@ English | [中文](2026-09-09-profile-resolution-generations.zh.md)
 
 A profile loads plugin rows from its own package project, while Harness packages and packages carried by selected bundles can live outside that project's ordinary dependency tree. Bridging the trees through shared symlinks, profile-owned links, or packaged-executable proxy packages persists package selections across processes and installations. Those files require reconciliation and locking, expose generated proxy manifests to metadata readers, and cannot represent a process-local change atomically.
 
-The runtime design keeps installation-first, ordered-bundle, and local-before-fallback precedence. It covers imports performed by plugin modules as well as Loader row imports and works in the main thread and Harness-owned Workers. Generation replacement preserves existing package mappings and local package names, permits linked-root membership changes, and never mutates a live table entry by entry.
+The runtime design keeps installation-first, ordered-bundle, and local-before-fallback precedence. It covers imports performed by plugin modules as well as Loader row imports and works in the main thread and Harness-owned Workers. Generation replacement preserves retained package mappings, permits removing profile packages and changing linked-root membership, and never mutates a live table entry by entry.
 
 ## Decision
 
@@ -75,7 +75,7 @@ Linked-root membership is immutable within a generation. A successor may add or
 
 The router retains the real target of each successfully published link name for its lifetime, solely to validate successors. Removing a root does not erase that record or keep its directory intercepted. Re-adding the same name and target is allowed; a different target is rejected because Node caches real paths. Failed publication changes neither the current generation nor the recorded targets.
 
-The launcher constructs one startup generation. The service accepts a complete successor, but no package-manager transaction invokes replacement in this implementation.
+The launcher constructs one startup generation. The [package refresh decision](2026-09-30-profile-package-refresh-and-manifest-invalidation.md) assigns successor publication to Plugin Manager operations.
 
 ### Shared ESM and CommonJS rule
 
@@ -105,9 +105,9 @@ New Workers inherit the latest published generation. Existing Workers keep the g
 
 ### Additive package changes
 
-A caller adding a package completes its pnpm transaction before constructing a successor generation. Replacement rejects any generation that changes the directory or version of an existing package. The caller publishes an additive successor before mounting the new Loader row; this implementation does not provide that package transaction. A mount failure may leave the package installed but inactive.
+A caller adding a package completes its pnpm transaction before constructing a successor generation. Replacement rejects any generation that changes the directory or version of a retained package. Plugin Manager publishes the successor before mounting the new Loader row. A mount failure may leave the package installed but inactive.
 
-Changing or removing an existing runtime package mapping, or removing a recorded profile-local package name, requires process restart because Node's ESM Module Map, CommonJS cache, existing object references, and running Workers can retain the old module identity. These restrictions do not prohibit removing a linked root from the interception scope. Generation replacement does not claim to unload modules.
+Changing an existing runtime package mapping or removing an installation mapping requires process restart because Node's ESM Module Map, CommonJS cache, existing object references, and running Workers can retain the old module identity. Profile-scoped mappings and profile-local package names may be removed; the caller stops their plugins before deleting package files. These restrictions do not prohibit removing a linked root from the interception scope. Generation replacement does not claim to unload modules.
 
 ### Filesystem and runtime carriers
 
@@ -152,4 +152,4 @@ Behavior tests exercise root order, transitive and peer dependencies, local and
 
 ## Consequences
 
-Runtime startup avoids disk mutation and proxy manifests while retaining package-precedence rules. Real-directory anchors align dependency discovery with default Node loading and tsx workspace mapping, including cases where a logical symlink path would select another version. The implementation accepts the maintenance cost of Node Internal compatibility tests and an early, self-contained bootstrap in each owned Worker; it provides no disk-only backend or dual comparison mode. Package mappings and local package names remain additive; linked-root membership may change without unloading modules.
+Runtime startup avoids disk mutation and proxy manifests while retaining package-precedence rules. Rea
```

**File**: `.agents/notes/implemented/architecture/2026-09-09-profile-resolution-generations.zh.md` (modified, +5/-5)
```diff
@@ -8,7 +8,7 @@ Status: implemented
 
 profile 从自己的包项目加载插件配置项，而 Harness 包和所选 bundle 携带的包可能位于该项目普通依赖树之外。通过共享 symlink、profile 自有链接或打包可执行文件的代理包连接两棵依赖树，会让选包结果跨进程和安装版本持续存在。这些文件需要协调和锁来维护，并向元数据读取方暴露生成的代理 manifest（元数据清单），也无法原子表示进程内变更。
 
-运行时设计保留安装优先、有序 bundle 和本地包优先于 fallback 的顺序。它覆盖插件模块内部的 import 以及 Loader 配置项的 import，并在主线程和 Harness 自有 Worker 中工作。generation 替换保留既有包映射和本地包名，允许调整 linked root 集合，不会逐项修改正在使用的表。
+运行时设计保留安装优先、有序 bundle 和本地包优先于 fallback 的顺序。它覆盖插件模块内部的 import 以及 Loader 配置项的 import，并在主线程和 Harness 自有 Worker 中工作。generation 替换保持保留包的映射不变，允许移除 profile 包和调整 linked root 集合，不会逐项修改正在使用的表。
 
 ## Decision
 
@@ -75,7 +75,7 @@ linked root 集合在一个 generation 内不可变。后继 generation 可以
 
 解析器在自身生命周期内保留每个已成功发布的 link 名称对应的真实目标，仅用于校验后继 generation。移除 root 不会抹掉该记录，也不会让其目录继续被拦截。同名、同目标可以重新加入；不同目标会被拒绝，因为 Node 缓存真实路径。发布失败时，当前 generation 和已记录目标均不变。
 
-launcher 只构造启动 generation。服务接受完整的后继 generation，但本实现没有包管理器事务调用替换操作。
+launcher 只构造启动 generation。[包操作刷新决策](2026-09-30-profile-package-refresh-and-manifest-invalidation.zh.md)规定由 Plugin Manager 的操作发布后继代。
 
 ### ESM 与 CommonJS 共用规则
 
@@ -105,9 +105,9 @@ runtime resolution 列出它提供的包；Loader entries 组成活动插件列
 
 ### 只增加包的变更
 
-添加包的调用方先完成 pnpm 事务，再构造下一代。替换操作会拒绝改变任何既有 package name 的目录或版本。调用方先发布只增加映射的后继 generation，再挂载新的 Loader 配置项；本实现不提供该包事务。挂载失败可以留下已安装但未启用的包。
+添加包的调用方先完成 pnpm 事务，再构造下一代。替换操作会拒绝改变任何保留包的目录或版本。Plugin Manager 先发布后继 generation，再挂载新的 Loader 配置项。挂载失败可以留下已安装但未启用的包。
 
-修改或删除既有运行时包映射，或删除已记录的 profile 本地包名，需要重启，因为 Node 的 ESM Module Map、CommonJS cache、现存对象引用和运行中的 Worker 都可能保留旧模块 identity。这些限制不禁止从拦截范围移除 linked root。generation 换代不声称卸载模块。
+修改既有运行时包映射或删除安装映射需要重启，因为 Node 的 ESM Module Map、CommonJS cache、现存对象引用和运行中的 Worker 都可能保留旧模块 identity。profile 范围的映射和 profile 本地包名可以移除；调用方在删除包文件之前先停止相关插件。这些限制不禁止从拦截范围移除 linked root。generation 换代不声称卸载模块。
 
 ### 文件系统与运行时载体
 
@@ -152,4 +152,4 @@ generation 构造发生在启动或显式更新阶段，不属于单次 resolve
 
 ## Consequences
 
-runtime 启动避免磁盘修改和代理 manifest，同时保留包优先级规则。真实目录锚点让依赖发现对齐 Node 默认加载与 tsx workspace 映射，也覆盖软链接逻辑路径会选中另一版本的情况。实现需要持续维护 Node Internal 兼容测试，并在每个自有 Worker 中尽早执行自包含 bootstrap；它不提供纯磁盘后端或 dual 对比模式。包映射和本地包名仍只允许新增；linked root 集合可以变化，而不卸载模块。
+runtime 启动避免磁盘修改和代理 manifest，同时保留包优先级规则。真实目录锚点让依赖发现对齐 Node 默认加载与 tsx workspace 映射，也覆盖软链接逻辑路径会选中另一版本的情况。实现需要持续维护 Node Internal 兼容测试，并在每个自有 Worker 中尽早执行自包含 bootstrap；它不提供纯磁盘后端或 dual 对比模式。profile 包记录和 linked root 集合可以移除，而不卸载模块；保留包的身份保持不变。
```

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.i18n.yaml` (modified, +27/-21)
```diff
@@ -2,30 +2,36 @@
 # section, a hash of its English and Chinese blocks outside code blocks and generated regions.
 # After editing either side, bring the other along and re-record with:
 #   pnpm run verify-translation-pairing --write .agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.md
-/agent-note-expire-hmr-package-configuration:
-  en: e6905d7657387304
-  zh: a7e906173a82f27c
-/agent-note-expire-hmr-package-configuration/problem:
-  en: e327f239592ffec0
-  zh: 339aa414b9dc8652
-/agent-note-expire-hmr-package-configuration/decision:
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration:
+  en: ea66719b3dcdd21c
+  zh: 893364551594ddaf
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/problem:
+  en: e59e3f5c61158701
+  zh: 2ced78e3c84f604e
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision:
   en: a15c7c13f167e5ac
   zh: a15c7c13f167e5ac
-/agent-note-expire-hmr-package-configuration/decision/responsibilities:
-  en: e72abbf8fafc89bb
-  zh: f6c59177696c5cd3
-/agent-note-expire-hmr-package-configuration/decision/hmr-package-configuration-expiry:
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision/responsibilities:
+  en: 3ffd0c78fa204b04
+  zh: f468bab00a7ff357
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision/runtime-resolution:
+  en: ca45b973e1968533
+  zh: 002f23bb70e4fed7
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision/plugin-manager:
+  en: 9b04926c175f22e8
+  zh: fbf05dd4065b0738
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision/hmr-package-configuration-expiry:
   en: c7de8dafe47a5587
   zh: 6010a70d8451edd1
-/agent-note-expire-hmr-package-configuration/decision/future-work:
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/decision/future-work:
   en: 31818f8f7f80470b
   zh: ecb7ac85bb49cf6d
-/agent-note-expire-hmr-package-configuration/alternatives-considered:
-  en: 5dab1237a312169c
-  zh: b24927d5badedcf7
-/agent-note-expire-hmr-package-configuration/verification:
-  en: d1d931904beb1c9f
-  zh: ea7874b974e1c209
-/agent-note-expire-hmr-package-configuration/consequences:
-  en: e557562e3f7b07bc
-  zh: 3cd196a63e4099b0
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/alternatives-considered:
+  en: 7c1c6d21570cda0d
+  zh: e6f8334c85f1b404
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/verification:
+  en: 939cedceed200cb2
+  zh: c7bb02d0da400c8d
+/agent-note-refresh-runtime-resolution-after-package-operations-and-expire-hmr-package-configuration/consequences:
+  en: 1b9e31b4e773fac5
+  zh: c140ce07fc64bd55
```

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.md` (modified, +42/-1)
```diff
@@ -1,11 +1,14 @@
-# Agent Note: Expire HMR package configuration
+# Agent Note: Refresh runtime resolution after package operations and expire HMR package configuration
 
 Status: implemented
 
 English | [中文](2026-09-30-profile-package-refresh-and-manifest-invalidation.zh.md)
 
 ## Problem
 
+Two pieces of Host state did not follow changes while the process ran:
+
+- **Runtime resolution was built only at startup.** After a GUI install or enablement, nothing published the latest generation, so a bundle's private dependencies never reached the profile fallback and its bare plugins could not be found. After disablement or removal, a new generation could not remove profile-scoped entries or profile-local names, so stale records and package metadata remained. A newly installed package directory is new, and Node holds no stale cache for it; only the table was missing.
 - **Package configuration and module evaluation have separate caches.** Clearing a plugin's module cache does not refresh the package.json fields that Node uses for exports, main, imports, and format detection. A package.json can also be imported as a JSON module, in which case its consumers need ordinary module reloads.
 
 ## Decision
@@ -14,8 +17,37 @@ English | [中文](2026-09-30-profile-package-refresh-and-manifest-invalidation.
 
 | Owner | Does | Does not |
 |---|---|---|
+| resolver (`app-boot/src/profile-resolution/resolver.ts`) | `replace()` allows removing `scope: profile` entries and profile-local names | Touch any Node cache |
+| plugin-manager | Calls `pluginPackages.refresh()` at fixed points of package operations | Construct resolutions or manage module and package-configuration caches |
 | HMR (`packages/boot/hmr`) | Expires package configuration and preserves ordinary reloads for manifests loaded as JSON modules | Reload plugins for configuration-only manifests; handle `node_modules` package replacement |
 
+### Runtime resolution
+
+The [generation Note](2026-09-09-profile-resolution-generations.md) owns package identity and Worker inheritance rules.
+
+Validation of a new generation in `replace()`:
+
+- `scope: profile` entries may be removed.
+- Profile-local package names may be removed.
+- Retained profile entries keep their normalized directory, version, and scope, but may change declaring anchor when another selected bundle supplies the same package. Installation mappings and declaring anchors remain unchanged. The profile scope cannot change; a new local name cannot override an existing entry; a published link name cannot select another real directory.
+
+### Plugin Manager
+
+| Operation | Publication point |
+|---|---|
+| Install a new package | After pnpm succeeds and the bundle selection is saved, before reconciliation, whether or not the bundle is enabled |
+| Overwrite an installed package | No publication; the result is `restart-required` |
+| Enable a bundle | After the selection is saved, before reconciliation |
+| Disable a bundle | With HMR, after reconciliation stops its plugins; without HMR, no publication, and running plugins keep the current table |
+| Remove | After pnpm remove succeeds, inside the HMR transaction |
+| Failed or cancelled install, failed removal | No publication |
+
+`createRuntimeResolution()` returns a `ProfileRuntimeResolution`, which privately keeps the installation anchor, Harness home, and profile directory it was computed from. Its `computeLatestResolution()` rereads that profile with the same inputs and returns a new object for the latest generation, leaving the original unchanged; Workers receive only the table fields. `PluginPackages.refresh()` calls the current resolution's `computeLatestResolution()` and then `replace()`; a resolution constructed as plain data cannot be refreshed and makes the call throw.
+
+Without HMR, deselecting a startup bundle does not stop its plugins. While such a bundle remains deselected, later package operations keep the existing runtime table instead of publishing its removal. Other no-HMR installations and removals of non-running bundles still publish normally.
+
+A successful package operation is not rolled back when publication is rejected afterwards. The result reports the failed runtime application and retains the successful disk changes. Recomputing uses the captured profile directory on disk, not synthetic in-memory layers; a computed resolution without a profile recomputes installation packages only.
+
 ### HMR package-configuration expiry
 
 In HMR's change dispatch, a changed file named `package.json` outside `node_modules` goes to `PackageManifests.invalidate()`. A manifest in the host dependency graph still requests a host reload; one loaded as a JSON module still reloads its consumers. A configuration-only manifest schedules no module reload. Configuration-owned paths stay with their dedicated watcher. Source changes in the same batch reload afterwards.
@@ -54,6 +86,10 @@ The binding's `getNearestParentPackageJSON` is called only by `pack
```

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.zh.md` (modified, +42/-1)
```diff
@@ -1,11 +1,14 @@
-# Agent Note: HMR 包配置失效
+# Agent Note: 包操作刷新 runtime resolution 与 HMR 包配置失效
 
 Status: implemented
 
 [English](2026-09-30-profile-package-refresh-and-manifest-invalidation.md) | 中文
 
 ## Problem
 
+Host 运行期间有两处状态没有随变化更新：
+
+- **runtime resolution 只在启动时构造。** GUI 安装或启用 bundle 后，没有人发布最新代，bundle 的私有依赖进不了 profile fallback，它的 bare 插件找不到。停用、卸载后，新一代又不允许移除 profile 范围的条目和本地包名，旧记录和包元数据一直留着。新安装的包目录本身是新的，Node 对它没有旧缓存，缺的只是这张表。
 - **包配置与模块求值使用独立缓存。** 清理插件的模块缓存不会刷新 Node 用于 exports、main、imports 和格式判断的 package.json 字段。package.json 也可以被作为 JSON 模块导入，此时其消费方需要普通的模块重载。
 
 ## Decision
@@ -14,8 +17,37 @@ Status: implemented
 
 | 负责方 | 做什么 | 不做什么 |
 |---|---|---|
+| resolver（`app-boot/src/profile-resolution/resolver.ts`） | `replace()` 允许移除 `scope: profile` 条目和 profile 本地包名 | 不碰 Node 的任何缓存 |
+| plugin-manager | 在包操作的确定时点调用 `pluginPackages.refresh()` | 不构造 resolution；不管模块缓存与包配置缓存 |
 | HMR（`packages/boot/hmr`） | 使包配置失效，并保留作为 JSON 模块加载的 manifest 的普通重载 | 不因仅作为配置的 manifest 重载插件；不处理 `node_modules` 包替换 |
 
+### runtime resolution
+
+包身份与 Worker 继承规则由[代际说明](2026-09-09-profile-resolution-generations.zh.md)定义。
+
+`replace()` 对新一代的校验：
+
+- `scope: profile` 的条目可以移除。
+- profile 本地包名可以移除。
+- 保留的 profile 条目保持规范化目录、版本与作用域不变；另一个已选 bundle 提供同一包时，可以更换声明锚点。安装范围的映射与声明锚点保持不变。profile 范围不能变；新本地包名不能覆盖已有条目；已发布的 link 名称不能换真实目录。
+
+### plugin-manager
+
+| 操作 | 发布时点 |
+|---|---|
+| 安装新包 | pnpm 成功、保存 bundle 选择之后，reconciliation 之前；无论是否立即启用都发布 |
+| 覆盖已安装的包 | 不发布，结果为 `restart-required` |
+| 启用 bundle | 保存选择后发布，再做 reconciliation |
+| 停用 bundle | 有 HMR 时，reconciliation 让插件退出后再发布；没有 HMR 时不发布，运行中的插件继续使用原表 |
+| 卸载 | pnpm remove 成功后，在 HMR 事务内发布 |
+| 安装失败、取消、卸载失败 | 不发布 |
+
+`createRuntimeResolution()` 返回 `ProfileRuntimeResolution`，它私有保存构造时的 installAnchor、home 和 profile 目录；`computeLatestResolution()` 用同一组输入重新读取 profile，返回表示最新代的新对象，原实例不变；Worker 只收到表数据。`PluginPackages.refresh()` 调用当前 resolution 的 `computeLatestResolution()` 再 `replace()`；以纯数据构造的 resolution 无法刷新，调用时抛错。
+
+没有 HMR 时，取消启动 bundle 的选择不会停止它的插件。只要该 bundle 仍未选中，后续包操作就保留当前 runtime 表，不发布其移除。其他无 HMR 的安装和未运行 bundle 卸载仍正常发布。
+
+包操作成功后若发布被拒绝，不回滚已完成的包操作。结果报告运行时应用失败，并保留成功的磁盘变更。重新计算使用捕获的磁盘 profile 目录，不继承内存合成 layers；没有 profile 的已计算 resolution 只重算安装范围的包。
+
 ### HMR 包配置失效
 
 HMR 的文件变化分派中，文件名为 `package.json` 且不在 `node_modules` 内的变化，交给 `PackageManifests.invalidate()`。位于宿主依赖图中的 manifest 仍请求宿主重载；作为 JSON 模块加载的 manifest 仍重载消费方。仅作为配置的 manifest 不安排模块重载。配置专属路径仍由其独立 watcher 处理。同一批的源码变化随后重载。
@@ -54,6 +86,10 @@ binding 的 `getNearestParentPackageJSON` 只被 `package_json_reader` 自己调
 
 ## Alternatives considered
 
+**每次查找都读当前磁盘（#4703）。** 解析能跟上磁盘，但不清模块缓存，也不重载运行中的插件。同一 URL 时新内容不生效，不同 URL 时新旧版本在同一进程并存。它还要维护一份入口解析实现，并且绕过自定义 bare-name hook。它也没有刷新 runtime resolution，GUI 安装的私有依赖依然找不到。
+
+**在 runtime resolution 发布时全量重读已见过的 manifest（#5496）。** 它把包配置失效放进了绑定表发布，和模块缓存脱了钩：覆盖已安装的包时报需要重启，但下一次无关的发布会让新导入拿到新版本，旧插件仍在运行。包配置缓存属于内容，应该和模块缓存由同一方负责，也就是 HMR。
+
 **让 HMR 支持 `node_modules` 内的包重载。** 这需要沿包含 `node_modules` 的模块图确定受影响插件，防止共享库和 Cordis 被重复求值，还要处理动态 import 漏边、模块副作用和 Worker。本次不做，这些场景继续要求重启。
 
 **package.json 变化时重载所有插件。** 仅作为配置的 manifest 不要求模块求值。实际作为 JSON 模块导入的 manifest 保留普通的依赖驱动重载。
@@ -66,13 +102,18 @@ binding 的 `getNearestParentPackageJSON` 只被 `package_json_reader` 自己调
 
 | 覆盖面 | 位置 |
 |---|---|
+| 新一代可移除 profile 条目与本地包名、仍拒绝修改保留条目 | `packages/boot/app-boot/tests/profile-resolution.spec.ts` |
+| GUI 安装、延迟启用、停用、卸载、覆盖、失败、取消，有无 HMR | `packages/boot/plugin-manager/tests/package-reload.spec.ts` |
+| 捕获目录后的重新计算、无 profile 的已计算 resolution 刷新、纯数据拒绝 | `packages/boot/app-boot/tests/profile-resolution.spec.ts`、`packages/boot/app-boot/tests/profile-resolution-service.spec.ts` |
+| 无 HMR 连续操作、共享依赖声明来源、磁盘成功但发布失败 | `packages/boot/plugin-manager/tests/package-reload.spec.ts` |
 | 失效后的 exports、main、imports、type、scope、最近 package.json，原生 reader 对照，实际 CommonJS 加载及旧模块实例保留，node_modules 边界，恢复 | `packages/boot/hmr/tests/package-manifest.spec.ts` |
 | 配置专用 manifest、JSON 模块与宿主重载、源码重载、同名及共享运行时的 entry、导入与激活失败回滚、entry 重启和 node_modules 排除规则 | `packages/boot/hmr/tests/package-manifest-dispatch.spec.ts` |
 
 测试不需要 API key，不调用模型。
 
 ## Consequences
 
+- 有 HMR 时，支持的包操作发布更新后的私有依赖，并在插件停止后移除不再需要的映射。没有 HMR 时，待生效的启动 bundle 停用会将后续发布延迟到重启，保留运行中插件的映射。
 - 在支持的线程内，package.json 配置读取使用更新后的字段；JSON 模块保留自己的重载行为。上述模块、loader 线程及 Worker 的独立限制仍然适用。
 - 包配置读取改由 JS 解析 package.json，需要与原生读取保持字段和错误语义一致；测试在 Node 22、24、26 上与原生读取逐项比较。
 - 依赖多个 Node internal 接口，Node 升级时需要重跑这些测试。
```

**File**: `apps/web/tests/scaffold.ts` (modified, +1/-1)
```diff
@@ -742,7 +742,6 @@ export async function launchWebScaffold(options: LaunchOptions = {}): Promise<We
       patches: [],
     }
     const resolutionOptions = { installAnchor: INSTALL_ANCHOR, home: harnessHome, profile }
-    const resolution = await createRuntimeResolution(resolutionOptions)
     await mkdir(profileDir, { recursive: true })
     const rootConfig = join(profileDir, 'cordis.yml')
     await writeFile(rootConfig, '[]\n')
@@ -796,6 +795,7 @@ export async function launchWebScaffold(options: LaunchOptions = {}): Promise<We
         throw new Error(`web e2e scaffold: the web app requested exit ${String(code)} with no arguments to reject`)
       },
     })
+    const resolution = await createRuntimeResolution(resolutionOptions)
     await ctx.plugin(PluginPackages, {
       resolution,
     })
```

**File**: `apps/web/tests/voice-setup.e2e.ts` (modified, +1/-2)
```diff
@@ -34,8 +34,7 @@ it('guides a newly enabled voice plugin to installation and lets the user postpo
   const card = page.locator('[data-plugin-package="@deepseek-ai/dsh-experimental-voice-input-bundle"]')
   expect(await card.getByRole('status').count()).toBe(0)
   await toggle.click()
-  await expect.poll(() => toggle.getAttribute('aria-checked')).toBe('false')
-  await toggle.click()
+  await page.getByRole('switch', { name: 'Enable Voice input', exact: true, checked: false }).click()
   await dialog.getByRole('button', { name: 'Go to setup', exact: true }).click()
   await page.getByRole('button', { name: 'Download and prepare', exact: true }).waitFor()
   expect(await dialog.count()).toBe(0)
```

---

### Incident Patch 10: `fdacc98b` (2026-10-02)
**Commit Message**: Merge pull request #5583 from deepseek-harness/fix/hmr-package-manifest-invalidation-1001

fix(hmr): invalidate changed package manifests

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.i18n.yaml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# Bilingual-pair consistency record for 2026-09-30-profile-package-refresh-and-manifest-invalidation.md (docs/i18n/README.md): per heading
+# section, a hash of its English and Chinese blocks outside code blocks and generated regions.
+# After editing either side, bring the other along and re-record with:
+#   pnpm run verify-translation-pairing --write .agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.md
+/agent-note-expire-hmr-package-configuration:
+  en: e6905d7657387304
+  zh: a7e906173a82f27c
+/agent-note-expire-hmr-package-configuration/problem:
+  en: e327f239592ffec0
+  zh: 339aa414b9dc8652
+/agent-note-expire-hmr-package-configuration/decision:
+  en: a15c7c13f167e5ac
+  zh: a15c7c13f167e5ac
+/agent-note-expire-hmr-package-configuration/decision/responsibilities:
+  en: e72abbf8fafc89bb
+  zh: f6c59177696c5cd3
+/agent-note-expire-hmr-package-configuration/decision/hmr-package-configuration-expiry:
+  en: c7de8dafe47a5587
+  zh: 6010a70d8451edd1
+/agent-note-expire-hmr-package-configuration/decision/future-work:
+  en: 31818f8f7f80470b
+  zh: ecb7ac85bb49cf6d
+/agent-note-expire-hmr-package-configuration/alternatives-considered:
+  en: 5dab1237a312169c
+  zh: b24927d5badedcf7
+/agent-note-expire-hmr-package-configuration/verification:
+  en: d1d931904beb1c9f
+  zh: ea7874b974e1c209
+/agent-note-expire-hmr-package-configuration/consequences:
+  en: e557562e3f7b07bc
+  zh: 3cd196a63e4099b0
```

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.md` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# Agent Note: Expire HMR package configuration
+
+Status: implemented
+
+English | [中文](2026-09-30-profile-package-refresh-and-manifest-invalidation.zh.md)
+
+## Problem
+
+- **Package configuration and module evaluation have separate caches.** Clearing a plugin's module cache does not refresh the package.json fields that Node uses for exports, main, imports, and format detection. A package.json can also be imported as a JSON module, in which case its consumers need ordinary module reloads.
+
+## Decision
+
+### Responsibilities
+
+| Owner | Does | Does not |
+|---|---|---|
+| HMR (`packages/boot/hmr`) | Expires package configuration and preserves ordinary reloads for manifests loaded as JSON modules | Reload plugins for configuration-only manifests; handle `node_modules` package replacement |
+
+### HMR package-configuration expiry
+
+In HMR's change dispatch, a changed file named `package.json` outside `node_modules` goes to `PackageManifests.invalidate()`. A manifest in the host dependency graph still requests a host reload; one loaded as a JSON module still reloads its consumers. A configuration-only manifest schedules no module reload. Configuration-owned paths stay with their dedicated watcher. Source changes in the same batch reload afterwards.
+
+`invalidate(manifest)` records the directory as expired. Afterwards:
+
+- package.json reads, scope lookups, type lookups, and nearest-manifest lookups below that directory read the current file. Ownership follows the real directory when a consumer reaches the package through a link.
+- ESM `ResolveCache` is cleared. Its entries do not record every consulted manifest, and a package entry may resolve outside the package directory.
+- CommonJS `_pathCache` is cleared for the same reason. Unrelated requests recompute their resolution without unloading their modules.
+- CommonJS loads using the default resolver pass the freshly resolved filename to the native loader. Its private request alias cannot select an older entry; cached module instances remain intact.
+
+Configuration invalidation alone leaves loaded modules unchanged. Loader entries retain their raw import results before export normalization. HMR matches imported Node module objects to cached ModuleJob namespaces and reloads the loaded URLs. All matching entry records, including disabled entries, update only after a successful reload and remain unchanged on failure. Stopping and restarting a Loader entry resolves its package name again and selects the new entry.
+
+Entry names are scoped by configuration-tree base URL and retain all distinct imported namespaces. An uninitialized entry contributes the name without erasing loaded namespaces; name-based resolution is used only when none is recorded, or for `cordis:` builtins. Dependency analysis considers every recorded module. Entries sharing a plugin runtime use one replacement operation, while each Loader entry selects its replacement by its original namespace. Module imports and export normalization finish before the old runtime is removed. Failed imports or activation restore the previous modules and plugin implementations and clean up partially activated replacements.
+
+An instance without a Loader entry has no recorded module identity. If a shared runtime's replacement modules have different plugin callbacks, HMR reports an ambiguity error and rolls back instead of assigning that instance to an arbitrary module.
+
+Package invalidation lives in `packages/boot/hmr/src/package-manifest.ts`, which encapsulates its Node internal interfaces. `index.ts` dispatches manifest changes and locates loaded entries by module identity. HMR's `node_modules` exclusion is unchanged.
+
+| Interface | Action |
+|---|---|
+| modules binding `readPackageJSON`, `getPackageScopeConfig`, `getPackageType` | Replaced: paths in an expired directory read the current file; other calls reach the native method |
+| `package_json_reader.getNearestParentPackageJSON` | Replaced: expired directories bypass its JS cache; a lookup without a manifest returns the native absent result |
+| The ESM Loader's `ResolveCache` instance | The prototype `get` is replaced for one lookup to obtain the instance and restored at once; the resolution cache is then cleared |
+| CommonJS `Module._pathCache` | The request-to-filename cache is cleared |
+| CommonJS `Module._load` | Default-resolver requests load by resolved filename; builtins and registered resolve hooks keep the original path |
+
+The binding's `getNearestParentPackageJSON` is called only by `package_json_reader` and is not replaced. Each HMR instance owns a separate configuration cache. Its replacements are installed at the first expiry and restored when the service is disposed, alongside watcher and reload-queue cleanup.
+
+### Future Work
+
+- Online replacement inside `node_modules`, same-path reinstall, changed link targets, and cross-package reload propagation remain unsupported. Package updates need process rest
```

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.zh.md` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# Agent Note: HMR 包配置失效
+
+Status: implemented
+
+[English](2026-09-30-profile-package-refresh-and-manifest-invalidation.md) | 中文
+
+## Problem
+
+- **包配置与模块求值使用独立缓存。** 清理插件的模块缓存不会刷新 Node 用于 exports、main、imports 和格式判断的 package.json 字段。package.json 也可以被作为 JSON 模块导入，此时其消费方需要普通的模块重载。
+
+## Decision
+
+### 职责
+
+| 负责方 | 做什么 | 不做什么 |
+|---|---|---|
+| HMR（`packages/boot/hmr`） | 使包配置失效，并保留作为 JSON 模块加载的 manifest 的普通重载 | 不因仅作为配置的 manifest 重载插件；不处理 `node_modules` 包替换 |
+
+### HMR 包配置失效
+
+HMR 的文件变化分派中，文件名为 `package.json` 且不在 `node_modules` 内的变化，交给 `PackageManifests.invalidate()`。位于宿主依赖图中的 manifest 仍请求宿主重载；作为 JSON 模块加载的 manifest 仍重载消费方。仅作为配置的 manifest 不安排模块重载。配置专属路径仍由其独立 watcher 处理。同一批的源码变化随后重载。
+
+`invalidate(manifest)` 把该目录登记为已失效，之后：
+
+- 位于该目录下的 package.json 读取、scope 查询、type 查询、最近 package.json 查询，都按当前磁盘解析。消费方经由链接路径访问时，按真实目录判断归属。
+- 清空 ESM `ResolveCache`。其条目不记录查询过的全部 manifest，包入口也可能解析到包目录之外。
+- 基于相同原因清空 CommonJS `_pathCache`。无关请求重新计算解析结果，不卸载其模块。
+- 使用默认 resolver 的 CommonJS 加载把重新解析的文件名交给原生 loader。其私有请求别名不再选中旧入口，已缓存的模块实例保持不变。
+
+仅使配置失效不会改变已加载模块。Loader entry 保留导出规范化之前的原始导入结果。HMR 将已导入的 Node 模块对象与缓存中 ModuleJob 的模块命名空间按对象身份匹配，重载已加载 URL。所有匹配的 entry 记录，包括已停用的 entry，仅在重载成功后更新，失败时保持不变。停止并重新启动 Loader entry 时，会重新按包名解析并选择新入口。
+
+entry 名称以配置树 base URL 为作用域，并保留所有不同的已导入命名空间。尚未初始化的 entry 只登记名称，不抹去已加载的命名空间；仅在没有记录命名空间或入口为 `cordis:` 内置模块时按名称解析。依赖分析考虑每个已记录模块。共享插件运行时的 entry 使用同一次替换操作，但每个 Loader entry 按自身原命名空间选择替换实现。模块导入与导出规范化在移除旧运行时之前完成。导入或激活失败时，恢复原来的模块和插件实现，并清理已部分激活的替换实例。
+
+没有 Loader entry 的实例不具备已记录的模块身份。如果共享运行时的替换模块具有不同的插件回调，HMR 会报告歧义错误并回滚，而不是将该实例随意分配给某个模块。
+
+包配置失效实现在 `packages/boot/hmr/src/package-manifest.ts`，封装其使用的 Node internal 接口。`index.ts` 分派 manifest 变更，并按模块身份定位已加载 entry。HMR 的 `node_modules` 排除规则不变。
+
+| 接口 | 动作 |
+|---|---|
+| modules binding 的 `readPackageJSON`、`getPackageScopeConfig`、`getPackageType` | 替换：路径位于已失效目录时按当前磁盘解析，其余调用原生方法 |
+| `package_json_reader.getNearestParentPackageJSON` | 替换：已失效目录绕过它的 JS 缓存；没有 manifest 时返回原生的缺失结果 |
+| ESM Loader 的 `ResolveCache` 实例 | 临时替换原型的 `get`，取得实例后立即恢复，再清空解析缓存 |
+| CJS `Module._pathCache` | 清空请求到文件名的缓存 |
+| CJS `Module._load` | 默认 resolver 的请求按解析后的文件名加载；内置模块及注册的 resolve hooks 保留原路径 |
+
+binding 的 `getNearestParentPackageJSON` 只被 `package_json_reader` 自己调用，不替换。每个 HMR 实例拥有独立的配置缓存，在第一次失效时安装 hook，并在服务销毁时恢复，同时清理 watcher 和重载队列。
+
+### 后续工作
+
+- 不支持 `node_modules` 内在线替换、同路径重装、link 换目标及跨包重载传播。包更新需要重启进程；这不保证每个管理操作的结果都已正确报告这一要求。
+- 使用异步 loader 线程的 TSX 版本，其线程内包配置不受这些 hook 管理。线程同步留待后续；本次不提供通用 Worker 缓存同步。
+- 注册了同步 resolve hooks 时，CommonJS 私有请求缓存刷新留待后续；这些请求保留原有 loader 行为。
+- 销毁 HMR 会恢复原生 reader，其此前缓存的配置可能重新可见。跨 HMR 替换保留失效状态留待后续。
+
+## Alternatives considered
+
+**让 HMR 支持 `node_modules` 内的包重载。** 这需要沿包含 `node_modules` 的模块图确定受影响插件，防止共享库和 Cordis 被重复求值，还要处理动态 import 漏边、模块副作用和 Worker。本次不做，这些场景继续要求重启。
+
+**package.json 变化时重载所有插件。** 仅作为配置的 manifest 不要求模块求值。实际作为 JSON 模块导入的 manifest 保留普通的依赖驱动重载。
+
+**按插件名重新 import 被重载的插件。** 这能让入口改名随源码重载生效，但会改变 `partialReload` 以已加载 URL 为重载单位的规则。入口改名在 Loader entry 重启时已经生效，所以本次不改。
+
+**每个 entry 名称只保留一个命名空间。** 名称和 base URL 相同的 entry，可能在 manifest 变化前后加载了不同模块。只保留最早或最后一个命名空间会遗漏仍在使用的模块；尚未初始化的 entry 也不能抹去其他 entry 的已导入命名空间。
+
+## Verification
+
+| 覆盖面 | 位置 |
+|---|---|
+| 失效后的 exports、main、imports、type、scope、最近 package.json，原生 reader 对照，实际 CommonJS 加载及旧模块实例保留，node_modules 边界，恢复 | `packages/boot/hmr/tests/package-manifest.spec.ts` |
+| 配置专用 manifest、JSON 模块与宿主重载、源码重载、同名及共享运行时的 entry、导入与激活失败回滚、entry 重启和 node_modules 排除规则 | `packages/boot/hmr/tests/package-manifest-dispatch.spec.ts` |
+
+测试不需要 API key，不调用模型。
+
+## Consequences
+
+- 在支持的线程内，package.json 配置读取使用更新后的字段；JSON 模块保留自己的重载行为。上述模块、loader 线程及 Worker 的独立限制仍然适用。
+- 包配置读取改由 JS 解析 package.json，需要与原生读取保持字段和错误语义一致；测试在 Node 22、24、26 上与原生读取逐项比较。
+- 依赖多个 Node internal 接口，Node 升级时需要重跑这些测试。
```

**File**: `apps/desktop-host/src/office-engine.ts` (modified, +5/-1)
```diff
@@ -29,7 +29,11 @@ export function installOfficeEngineResolution(runtimeDir: string): ModuleHooks |
   return registerHooks({
     resolve(specifier, context, nextResolve) {
       const resolved = nextResolve(specifier, context)
-      if (!/^@deepseek-ai\/libreoffice-kit-(?:darwin|win32|linux)-/u.test(specifier)) return resolved
+      if (!resolved.url.startsWith('file:')) return resolved
+      const engineRequest = /^@deepseek-ai\/libreoffice-kit-(?:darwin|win32|linux)-/u.test(specifier)
+      const engineTarget = /\/node_modules\/@deepseek-ai\/libreoffice-kit-(?:darwin|win32|linux)-[^/]+\//u
+        .test(new URL(resolved.url).pathname)
+      if (!engineRequest && !engineTarget) return resolved
       const canonical = pathToFileURL(realpathSync(fileURLToPath(resolved.url))).href
       if (!canonical.startsWith(source)) {
         if (canonical.startsWith(pathToFileURL(archive + '/').href)) {
```

**File**: `apps/desktop-host/tests/office-engine.spec.ts` (modified, +48/-2)
```diff
@@ -1,19 +1,26 @@
 import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
 import { createRequire, type ModuleHooks } from 'node:module'
 import { tmpdir } from 'node:os'
-import { dirname, join } from 'node:path'
+import { dirname, join, sep } from 'node:path'
 import { afterEach, expect, it } from 'vitest'
 import { installOfficeEngineResolution } from '../src/office-engine.ts'
+import { PackageManifests } from '../../../packages/boot/hmr/src/package-manifest.ts'
 
 const roots: string[] = []
 const hooks: ModuleHooks[] = []
+const disposers: Array<() => void> = []
 afterEach(() => {
+  for (const dispose of disposers.splice(0).reverse()) dispose()
   for (const hook of hooks.splice(0)) hook.deregister()
+  const cache = createRequire(import.meta.url).cache
+  for (const path of Object.keys(cache)) {
+    if (roots.some(root => path.startsWith(root + sep))) Reflect.deleteProperty(cache, path)
+  }
   for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
 })
 
 function fixture(runtimeName = 'dsh') {
-  const root = mkdtempSync(join(tmpdir(), 'desktop-office-resolution-'))
+  const root = realpathSync(mkdtempSync(join(tmpdir(), 'desktop-office-resolution-')))
   roots.push(root)
   const runtime = join(root, 'app.asar', runtimeName)
   const manifest = 'node_modules/@deepseek-ai/libreoffice-kit-darwin-arm64/package.json'
@@ -40,6 +47,45 @@ it('resolves engine manifests to physical directories and leaves unrelated modul
   expect(f.require('@deepseek-ai/libreoffice-kit/package.json')).toEqual({ name: '@deepseek-ai/libreoffice-kit' })
 })
 
+it('resolves an absolute engine manifest to its unpacked copy', () => {
+  const f = fixture()
+  expect(f.require(join(f.runtime, f.manifest)))
+    .toMatchObject({ path: realpathSync(dirname(join(f.root, 'app.asar.unpacked', 'dsh', f.manifest))) })
+})
+
+it.each(['exports', 'main'] as const)('refreshes a cached plugin %s while Office resolution stays active', (field) => {
+  const f = fixture()
+  const packageRoot = join(f.root, 'plugin')
+  mkdirSync(packageRoot)
+  const manifest = join(packageRoot, 'package.json')
+  const a = join(packageRoot, 'a.cjs')
+  const b = join(packageRoot, 'b.cjs')
+  writeFileSync(manifest, JSON.stringify({ name: 'plugin', [field]: './a.cjs' }))
+  writeFileSync(a, 'module.exports = { marker: "a" }')
+  writeFileSync(b, 'module.exports = { marker: "b" }')
+  symlinkSync(packageRoot, join(f.runtime, 'node_modules', 'plugin'), process.platform === 'win32' ? 'junction' : 'dir')
+  const require = createRequire(join(f.runtime, 'package.json'))
+  const original: unknown = require('plugin')
+  const next: unknown = require(b)
+  const originalModule = require.cache[a]
+  const nextModule = require.cache[b]
+  const engine = f.require('@deepseek-ai/libreoffice-kit-darwin-arm64/package.json')
+  expect(original).toEqual({ marker: 'a' })
+  expect(next).toEqual({ marker: 'b' })
+  expect(require('plugin')).toBe(original)
+  const manifests = new PackageManifests()
+  disposers.push(() => { manifests.dispose() })
+  writeFileSync(manifest, JSON.stringify({ name: 'plugin', [field]: './b.cjs' }))
+  manifests.invalidate(manifest)
+  expect(require('plugin')).toBe(next)
+  expect(require.resolve('plugin')).toBe(b)
+  expect(require.cache[a]).toBe(originalModule)
+  expect(require.cache[b]).toBe(nextModule)
+  expect(require(a)).toBe(original)
+  expect(f.require('@deepseek-ai/libreoffice-kit-darwin-arm64/package.json')).toBe(engine)
+  expect(f.require(join(f.runtime, f.manifest))).toBe(engine)
+})
+
 it('rejects an engine missing from the unpacked tree instead of using its archived copy', () => {
   const f = fixture()
   rmSync(join(f.root, 'app.asar.unpacked'), { recursive: true })
```

**File**: `docs/config-catalog.md` (modified, +1/-1)
```diff
@@ -1305,7 +1305,7 @@ export interface Config {
 ## `@deepseek-ai/dsh-hmr`
 
 - `refs`: `ChokidarOptions` (`chokidar`)
-- `source`: [`packages/boot/hmr/src/index.ts:51`](../packages/boot/hmr/src/index.ts)
+- `source`: [`packages/boot/hmr/src/index.ts:53`](../packages/boot/hmr/src/index.ts)
 
 ```ts config-catalog
 /** Module roots and watcher timing, with Chokidar deployment options. */
```

**File**: `docs/config-catalog.zh.md` (modified, +1/-1)
```diff
@@ -1307,7 +1307,7 @@ export interface Config {
 ## `@deepseek-ai/dsh-hmr`
 
 - `refs`: `ChokidarOptions` (`chokidar`)
-- `source`: [`packages/boot/hmr/src/index.ts:51`](../packages/boot/hmr/src/index.ts)
+- `source`: [`packages/boot/hmr/src/index.ts:53`](../packages/boot/hmr/src/index.ts)
 
 ```ts config-catalog
 /** Module roots and watcher timing, with Chokidar deployment options. */
```

**File**: `docs/event-producer-consumer.md` (modified, +2/-2)
```diff
@@ -51,8 +51,8 @@ This matrix shows which packages dispatch each harness-owned event and which pac
 | `fs/write-intent` | `waterfall` | [`packages/fs/fs/src/index.ts:59`](../packages/fs/fs/src/index.ts) | [`tool-fs`](../packages/fs/tool-fs) (`waterfall`), [`tool-str-replace-editor`](../packages/fs/tool-str-replace-editor) (`waterfall`) | [`fs-observation-policy`](../packages/fs/fs-observation-policy) |
 | `goal/activation-changed` | `emit` | [`packages/goal/goal/src/types.ts:150`](../packages/goal/goal/src/types.ts) | [`goal`](../packages/goal/goal) (`emit`) | `remotes` |
 | `goal/changed` | `emit` | [`packages/goal/goal/src/domain.ts:114`](../packages/goal/goal/src/domain.ts) | [`goal`](../packages/goal/goal) (`emit`) | [`goal-round-driver`](../packages/goal/goal-round-driver) |
-| `hmr/change` | `emit` | [`packages/boot/hmr/src/index.ts:30`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
-| `hmr/reload` | `emit` | [`packages/boot/hmr/src/index.ts:35`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
+| `hmr/change` | `emit` | [`packages/boot/hmr/src/index.ts:32`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
+| `hmr/reload` | `emit` | [`packages/boot/hmr/src/index.ts:37`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
 | `llm/adapters-updated` | `emit` | [`packages/llm/llm/src/types.ts:23`](../packages/llm/llm/src/types.ts) | [`llm`](../packages/llm/llm) (`events.dispatch`) | [`acp`](../packages/acp/acp), `remotes` |
 | `llm/stream` | `waterfall` | [`packages/llm/llm/src/index.ts:75`](../packages/llm/llm/src/index.ts) | [`llm`](../packages/llm/llm) (`waterfall`) | [`llm-replay`](../packages/test-support/llm-replay), [`session-checkpoint-policy`](../packages/session/session-checkpoint-policy), [`session-title`](../packages/session/session-title) |
 | `permission-presets/catalog-changed` | `emit` | [`packages/interaction/permission-presets/src/types.ts:48`](../packages/interaction/permission-presets/src/types.ts) | [`permission-presets`](../packages/interaction/permission-presets) (`events.dispatch`) | `remotes` |
```

---

### Incident Patch 11: `4eb53e63` (2026-10-02)
**Commit Message**: fix(ci): cover HMR edge cases and document strict assertions

**File**: `packages/boot/hmr/tests/modules.spec.ts` (modified, +70/-2)
```diff
@@ -202,6 +202,34 @@ it('does not replace a plugin whose dependencies have not changed', async () =>
   expect(imported).not.toHaveBeenCalled()
 })
 
+it('keeps a node_modules entry cached when it shares a runtime with a replaced source entry', async () => {
+  const { ctx, module, imports, imported, cache, reload } = await fixture()
+  const original = { apply: vi.fn() }
+  const replacement = { apply: vi.fn() }
+  const source = module('source.mjs', original)
+  const installedNamespace = { apply: original.apply }
+  const installed = module('node_modules/addon/index.mjs', installedNamespace)
+  await ctx.loader.root.update([
+    { id: 'source', name: source.url },
+    { id: 'installed', name: installed.url },
+  ])
+  await ctx.loader.await()
+  expect(ctx.loader.resolve('source').fiber?.runtime).toBe(ctx.loader.resolve('installed').fiber?.runtime)
+  imports.set(source.url, replacement)
+  imported.mockClear()
+  reload.stashed.add(source.url)
+
+  await reload.partialReload()
+
+  expect(imported).toHaveBeenCalledExactlyOnceWith(source.url, expect.any(Function))
+  expect(replacement.apply).toHaveBeenCalledOnce()
+  expect(cache.get(installed.url)).toBe(installed)
+  expect(ctx.loader.resolve('installed').moduleNamespace).toBe(installedNamespace)
+  expect(ctx.loader.resolve('installed').fiber?.runtime?.callback).toBe(original.apply)
+  expect(ctx.loader.resolve('source').fiber?.runtime?.callback).toBe(replacement.apply)
+  expect(reload.accepted).not.toContain(installed.url)
+})
+
 it('replaces a plugin when a linked dependency changes, excluding framework modules', async () => {
   const { ctx, module, imports, reload } = await fixture()
   const dependency = module('dependency.mjs')
@@ -273,14 +301,15 @@ it('leaves disposed child instances to their replacing parent', async () => {
   expect(entry.fiber?._config).toEqual({ value: 'entry' })
 })
 
-it('invalidates a disabled module without activating it', async () => {
-  const { ctx, module, imports, reload } = await fixture()
+it.each(['v1', 'v2'] as const)('invalidates a disabled %s module without activating it', async (version) => {
+  const { ctx, module, imports, resolve, reload } = await fixture(version)
   const job = module('disabled.mjs', { apply() {} })
   const id = await ctx.loader.create({ name: job.url, disabled: true })
   const apply = vi.fn()
   imports.set(job.url, { apply })
   reload.stashed.add(job.url)
   await reload.partialReload()
+  expect(resolve.mock.calls).toEqual(version === 'v1' ? [[job.url, ctx.baseUrl, {}]] : [[job.url]])
   expect(ctx.loader.resolve(id).fiber).toBeUndefined()
   expect(apply).not.toHaveBeenCalled()
 })
@@ -299,6 +328,45 @@ it('does not disturb an unchanged runtime after an earlier replacement fails', a
   expect(untouched).toHaveBeenCalledOnce()
 })
 
+it('cleans up a shared replacement runtime once when a later plugin activation fails', async () => {
+  const { ctx, module, imports, cache, reload } = await fixture()
+  const mounted: string[] = []
+  const disposed: string[] = []
+  const original = { apply(_ctx: Context, config: { label: string }) { mounted.push(config.label) } }
+  const replacement = { apply(ctx: Context, config: { label: string }) {
+    ctx.effect(() => () => { disposed.push(config.label) })
+  } }
+  const first = module('shared.mjs', original)
+  const second = module('failing.mjs', { apply() {} })
+  await ctx.loader.root.update([
+    { id: 'one', name: first.url, config: { label: 'one' } },
+    { id: 'two', name: first.url, config: { label: 'two' } },
+    { id: 'failing', name: second.url },
+  ])
+  await ctx.loader.await()
+  imports.set(first.url, replacement)
+  imports.set(second.url, { apply() { throw new Error('later activation failed') } })
+  const remove = vi.spyOn(ctx.registry, 'delete')
+  const event = vi.fn()
+  ctx.on('hmr/reload', event)
+  reload.stashed.add(first.url)
+  reload.stashed.add(second.url)
+
+  await expect(reload.partialReload()).rejects.toThrow('later activation failed')
+
+  expect(disposed.sort()).toEqual(['one', 'two'])
+  expect(mounted).toEqual(['one', 'two', 'one', 'two'])
+  expect(remove.mock.calls.filter(([plugin]) => plugin === replacement.apply)).toHaveLength(1)
+  expect(ctx.registry.get(replacement)).toBeUndefined()
+  const restored = ctx.registry.get(original)
+  expect([...restored!.fibers]).toHaveLength(2)
+  expect(ctx.loader.resolve('one').fiber?.runtime).toBe(restored)
+  expect(ctx.loader.resolve('two').fiber?.runtime).toBe(restored)
+  expect(cache.get(first.url)).toBe(first)
+  expect(cache.get(second.url)).toBe(second)
+  expect(event).not.toHaveBeenCalled()
+})
+
 it('restores the prior plugin when the replacement does not export a plugin', async () => {
   const { ctx, module, imported, reload } = await fixture()
   const original = { apply: vi.fn() }
```

**File**: `packages/experimental/webworker-runtime/src/node/builtin_modules/implemented/assert/strict.ts` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@
  * Require a truthy value; falsy values throw `ERR_ASSERTION` or the supplied Error.
  * @param value - Value to test.
  * @param message - Failure message or Error to throw unchanged; omitted messages use generic text.
+ * @returns Nothing; successful completion narrows the value to a truthy value.
  */
 export function ok(value: unknown, message?: string | Error): asserts value {
   if (value) return
@@ -21,7 +22,7 @@ export function ok(value: unknown, message?: string | Error): asserts value {
 /** CommonJS interop marker for lowered ESM default imports. */
 export const __esModule = true
 
+/** Callable truthiness assertion with the identical `ok` method; other assertion APIs are absent. */
 const assert: typeof ok & { ok: typeof ok } = Object.assign(ok, { ok })
 
-/** Callable truthiness assertion with the identical `ok` method; other assertion APIs are absent. */
 export default assert
```

---

### Incident Patch 12: `93b469a5` (2026-10-02)
**Commit Message**: fix(webworker): support strict truthiness assertions

**File**: `packages/experimental/webworker-runtime/README.i18n.yaml` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@
   en: ca75c51c89c2c9b0
   zh: 64715dc7e6d02f71
 /deepseek-ai-dsh-experimental-webworker-runtime/known-limitations-and-deferred-work:
-  en: 6fe586817a42fdad
-  zh: c19ab678d61e82d3
+  en: dd2469d07c86127a
+  zh: efa1be38e57bdd1e
 /deepseek-ai-dsh-experimental-webworker-runtime/known-limitations-and-deferred-work/dev-note:
   en: e67f633dc6fe7773
   zh: e88aeb617ffb74ea
```

**File**: `packages/experimental/webworker-runtime/README.md` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ None; this package neither assembles nor sends a provider request.
 
 - **The worker composition writes plaintext session logs** (`compression: 'none'` boot patch): it carries no Zstandard codec, so exported logs are `.jsonl`, never `.jsonl.zstd`.
 - **`node:dns/promises`, `node:vm`, `node:net`, `node:sqlite`, `node:worker_threads` are structural stubs**: every call reports its refusal on the console and throws. Rows needing native DNS, a real process, or realm isolation cannot run here.
+- **`node:assert/strict` supports truthiness assertions only**: for falsy values, the callable default and `ok` throw `ERR_ASSERTION` with the supplied message or generic text, or rethrow a supplied Error unchanged. Other assertion APIs are absent.
 - **Desktop product telemetry is unavailable**: `got.post` reports an explicit worker-host refusal. Got and its Node HTTP dependencies are excluded from the browser image; Desktop reporting remains disabled in the preview composition.
 - **Host package commands are unavailable**: `execa` reports an explicit worker-host refusal; the preview cannot run pnpm, install plugins, or install native dependencies.
 - **PTC Node programs are unavailable**: the process shim exposes `/dsh/bin/node` as its executable identity so the provider can activate, but the Worker has neither a Node executable nor `stripTypeScriptTypes`. Program execution fails before launching a child.
```

**File**: `packages/experimental/webworker-runtime/README.zh.md` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ kind: "package-library"
 
 - **worker 组合写明文会话日志**（`compression: 'none'` boot patch）：不带 Zstandard 编解码器，导出日志是 `.jsonl`，不会是 `.jsonl.zstd`。
 - **`node:dns/promises`、`node:vm`、`node:net`、`node:sqlite`、`node:worker_threads` 是结构化 stub**：每次调用在 console 报告拒绝并抛出。需要原生 DNS、真进程或真 realm 隔离的行在此无法运行。
+- **`node:assert/strict` 仅支持真值断言**：对于假值，可调用的默认导出和 `ok` 使用传入的消息或通用文本抛出 `ERR_ASSERTION`，或原样抛出传入的 Error。其他断言 API 未提供。
 - **桌面产品埋点不可用**：`got.post` 明确报告 worker host 不支持该调用。浏览器镜像不包含 Got 及其 Node HTTP 依赖；预览组合不启用桌面上报。
 - **宿主包管理命令不可用**：`execa` 明确报告 worker host 不支持该调用；预览无法运行 pnpm、安装插件或安装原生依赖。
 - **PTC Node 程序不可用**：process shim 用 `/dsh/bin/node` 表示可执行文件身份，使 provider 能够激活，但 Worker 既没有 Node 可执行文件，也没有 `stripTypeScriptTypes`。程序执行会在启动子进程前失败。
```

**File**: `packages/experimental/webworker-runtime/src/module-proxies.ts` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ export const MODULE_PROXIES: Record<string, string> = {
   // Sync-stack AsyncLocalStorage semantics.
   'node:async_hooks': './node/builtin_modules/implemented/async_hooks.ts',
   // Real implementations over browser primitives.
+  'node:assert/strict': './node/builtin_modules/implemented/assert/strict.ts',
+  'assert/strict': './node/builtin_modules/implemented/assert/strict.ts',
   'node:util': './node/builtin_modules/implemented/util.ts',
   'node:util/types': './node/builtin_modules/implemented/util/types.ts',
   'node:events': './node/builtin_modules/implemented/events.ts',
```

**File**: `packages/experimental/webworker-runtime/src/node/builtin_modules/implemented/assert/strict.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+/** Truthiness assertions for Worker modules importing `node:assert/strict`. */
+
+/**
+ * Require a truthy value; falsy values throw `ERR_ASSERTION` or the supplied Error.
+ * @param value - Value to test.
+ * @param message - Failure message or Error to throw unchanged; omitted messages use generic text.
+ */
+export function ok(value: unknown, message?: string | Error): asserts value {
+  if (value) return
+  if (message instanceof Error) throw message
+  throw Object.assign(new Error(message ?? 'The expression evaluated to a falsy value.'), {
+    name: 'AssertionError',
+    code: 'ERR_ASSERTION',
+    actual: value,
+    expected: true,
+    operator: '==',
+    generatedMessage: message === undefined,
+  })
+}
+
+/** CommonJS interop marker for lowered ESM default imports. */
+export const __esModule = true
+
+const assert: typeof ok & { ok: typeof ok } = Object.assign(ok, { ok })
+
+/** Callable truthiness assertion with the identical `ok` method; other assertion APIs are absent. */
+export default assert
```

**File**: `packages/experimental/webworker-runtime/src/node/builtin_modules/implemented/module.ts` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ export function createRequire(base: string | URL): NodeRequire {
 
 /** Builtin specifiers the module proxy table answers (without the `node:` prefix). */
 export const builtinModules = [
-  'assert', 'async_hooks', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http', 'module',
+  'assert', 'assert/strict', 'async_hooks', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http', 'module',
   'net', 'os', 'path', 'process', 'stream', 'tty', 'url', 'util', 'worker_threads',
 ]
 
```

**File**: `packages/experimental/webworker-runtime/src/node/builtins.ts` (modified, +2/-0)
```diff
@@ -21,6 +21,7 @@
  * other import. Deferring a shim's own start-up cost therefore belongs inside
  * that shim, on the path that first needs it.
  */
+import * as nodeAssertStrict from './builtin_modules/implemented/assert/strict.ts'
 import * as nodeAsyncHooks from './builtin_modules/implemented/async_hooks.ts'
 import * as nodeBuffer from './builtin_modules/implemented/buffer.ts'
 import * as nodeCrypto from './builtin_modules/implemented/crypto.ts'
@@ -61,6 +62,7 @@ import type { StaticModuleFactory } from '../module-system/module-loader.ts'
 
 /** Builtin modules, keyed with and without the `node:` prefix. */
 const BUILTINS: Record<string, StaticModuleFactory> = {
+  'assert/strict': () => nodeAssertStrict,
   async_hooks: () => nodeAsyncHooks,
   buffer: () => nodeBuffer,
   child_process: () => nodeChildProcess,
```

**File**: `packages/experimental/webworker-runtime/tests/node/assert-strict.spec.ts` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+/** Strict assertion resolution and execution through the Worker image loader. */
+import { describe, expect, it } from 'vitest'
+import { lowerModuleSource } from '../../src/compile/transform.ts'
+import { MODULE_PROXIES } from '../../src/module-proxies.ts'
+import { WorkerModuleLoader } from '../../src/module-system/module-loader.ts'
+import { createNodeBuiltins } from '../../src/node/builtins.ts'
+import assert, { ok } from '../../src/node/builtin_modules/implemented/assert/strict.ts'
+import { isBuiltin } from '../../src/node/builtin_modules/implemented/module.ts'
+import { MemoryVfs } from '../../src/storage/memory.ts'
+
+describe('Worker strict assertions', () => {
+  it.each([true, 1, 'present', {}, []])('accepts truthy value %j', (value) => {
+    expect(() => { assert(value) }).not.toThrow()
+  })
+
+  it.each([false, 0, '', null, undefined, NaN])('rejects falsy value %j with assertion fields', (value) => {
+    expect(() => { assert(value, 'HMR pending module is missing') }).toThrow(expect.objectContaining({
+      name: 'AssertionError',
+      code: 'ERR_ASSERTION',
+      message: 'HMR pending module is missing',
+      actual: value,
+      expected: true,
+      operator: '==',
+      generatedMessage: false,
+    }))
+  })
+
+  it('generates a message when none is supplied', () => {
+    expect(() => { assert(false) }).toThrow(expect.objectContaining({
+      message: 'The expression evaluated to a falsy value.',
+      generatedMessage: true,
+    }))
+  })
+
+  it('preserves an explicitly empty message', () => {
+    expect(() => { assert(false, '') }).toThrow(expect.objectContaining({ message: '', generatedMessage: false }))
+  })
+
+  it('throws a supplied Error unchanged', () => {
+    const error = new Error('missing module')
+    expect.assertions(2)
+    try {
+      assert(false, error)
+    } catch (reason) {
+      expect(reason).toBe(error)
+    }
+    expect(() => { assert(true, error) }).not.toThrow()
+  })
+
+  it('shares the callable default and ok exports', () => {
+    expect(assert).toBe(ok)
+    expect(assert.ok).toBe(ok)
+  })
+
+  it.each(['node:assert/strict', 'assert/strict'])('resolves and executes a lowered default import from %s', (specifier) => {
+    const vfs = new MemoryVfs()
+    vfs.seedDirectory('/dsh')
+    const loader = new WorkerModuleLoader({ vfs, root: '/dsh', staticModules: createNodeBuiltins() })
+    const transformed = lowerModuleSource({
+      filename: '/dsh/probe.js',
+      source: `import assert, { ok } from '${specifier}';
+        assert({ getNamespace() {} }, 'HMR pending module is missing');
+        ok(true);
+        export const same = assert === ok && assert.ok === ok;
+        export function reject() { assert(undefined, 'HMR pending module is missing'); }`,
+    })
+    expect(transformed.moduleRequests).toContain(specifier)
+    expect(loader.resolve(specifier, '/dsh')).toMatchObject({ kind: 'static' })
+    expect(isBuiltin(specifier)).toBe(true)
+    expect(MODULE_PROXIES[specifier]).toBe('./node/builtin_modules/implemented/assert/strict.ts')
+    vfs.writeFileSync('/dsh/probe.js', transformed.code)
+    const require = loader.createRequire('/dsh/')
+    expect(require('assert/strict')).toBe(require('node:assert/strict'))
+    const probe = require('./probe.js') as { same: boolean; reject: () => void }
+    expect(probe.same).toBe(true)
+    expect(probe.reject).toThrow(expect.objectContaining({ code: 'ERR_ASSERTION', message: 'HMR pending module is missing' }))
+  })
+})
```

---

### Incident Patch 13: `a59beb8a` (2026-10-02)
**Commit Message**: fix(hmr): preserve manifest refresh with Office resolution

**File**: `apps/desktop-host/src/office-engine.ts` (modified, +5/-1)
```diff
@@ -29,7 +29,11 @@ export function installOfficeEngineResolution(runtimeDir: string): ModuleHooks |
   return registerHooks({
     resolve(specifier, context, nextResolve) {
       const resolved = nextResolve(specifier, context)
-      if (!/^@deepseek-ai\/libreoffice-kit-(?:darwin|win32|linux)-/u.test(specifier)) return resolved
+      if (!resolved.url.startsWith('file:')) return resolved
+      const engineRequest = /^@deepseek-ai\/libreoffice-kit-(?:darwin|win32|linux)-/u.test(specifier)
+      const engineTarget = /\/node_modules\/@deepseek-ai\/libreoffice-kit-(?:darwin|win32|linux)-[^/]+\//u
+        .test(new URL(resolved.url).pathname)
+      if (!engineRequest && !engineTarget) return resolved
       const canonical = pathToFileURL(realpathSync(fileURLToPath(resolved.url))).href
       if (!canonical.startsWith(source)) {
         if (canonical.startsWith(pathToFileURL(archive + '/').href)) {
```

**File**: `apps/desktop-host/tests/office-engine.spec.ts` (modified, +48/-2)
```diff
@@ -1,19 +1,26 @@
 import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
 import { createRequire, type ModuleHooks } from 'node:module'
 import { tmpdir } from 'node:os'
-import { dirname, join } from 'node:path'
+import { dirname, join, sep } from 'node:path'
 import { afterEach, expect, it } from 'vitest'
 import { installOfficeEngineResolution } from '../src/office-engine.ts'
+import { PackageManifests } from '../../../packages/boot/hmr/src/package-manifest.ts'
 
 const roots: string[] = []
 const hooks: ModuleHooks[] = []
+const disposers: Array<() => void> = []
 afterEach(() => {
+  for (const dispose of disposers.splice(0).reverse()) dispose()
   for (const hook of hooks.splice(0)) hook.deregister()
+  const cache = createRequire(import.meta.url).cache
+  for (const path of Object.keys(cache)) {
+    if (roots.some(root => path.startsWith(root + sep))) Reflect.deleteProperty(cache, path)
+  }
   for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
 })
 
 function fixture(runtimeName = 'dsh') {
-  const root = mkdtempSync(join(tmpdir(), 'desktop-office-resolution-'))
+  const root = realpathSync(mkdtempSync(join(tmpdir(), 'desktop-office-resolution-')))
   roots.push(root)
   const runtime = join(root, 'app.asar', runtimeName)
   const manifest = 'node_modules/@deepseek-ai/libreoffice-kit-darwin-arm64/package.json'
@@ -40,6 +47,45 @@ it('resolves engine manifests to physical directories and leaves unrelated modul
   expect(f.require('@deepseek-ai/libreoffice-kit/package.json')).toEqual({ name: '@deepseek-ai/libreoffice-kit' })
 })
 
+it('resolves an absolute engine manifest to its unpacked copy', () => {
+  const f = fixture()
+  expect(f.require(join(f.runtime, f.manifest)))
+    .toMatchObject({ path: realpathSync(dirname(join(f.root, 'app.asar.unpacked', 'dsh', f.manifest))) })
+})
+
+it.each(['exports', 'main'] as const)('refreshes a cached plugin %s while Office resolution stays active', (field) => {
+  const f = fixture()
+  const packageRoot = join(f.root, 'plugin')
+  mkdirSync(packageRoot)
+  const manifest = join(packageRoot, 'package.json')
+  const a = join(packageRoot, 'a.cjs')
+  const b = join(packageRoot, 'b.cjs')
+  writeFileSync(manifest, JSON.stringify({ name: 'plugin', [field]: './a.cjs' }))
+  writeFileSync(a, 'module.exports = { marker: "a" }')
+  writeFileSync(b, 'module.exports = { marker: "b" }')
+  symlinkSync(packageRoot, join(f.runtime, 'node_modules', 'plugin'), process.platform === 'win32' ? 'junction' : 'dir')
+  const require = createRequire(join(f.runtime, 'package.json'))
+  const original: unknown = require('plugin')
+  const next: unknown = require(b)
+  const originalModule = require.cache[a]
+  const nextModule = require.cache[b]
+  const engine = f.require('@deepseek-ai/libreoffice-kit-darwin-arm64/package.json')
+  expect(original).toEqual({ marker: 'a' })
+  expect(next).toEqual({ marker: 'b' })
+  expect(require('plugin')).toBe(original)
+  const manifests = new PackageManifests()
+  disposers.push(() => { manifests.dispose() })
+  writeFileSync(manifest, JSON.stringify({ name: 'plugin', [field]: './b.cjs' }))
+  manifests.invalidate(manifest)
+  expect(require('plugin')).toBe(next)
+  expect(require.resolve('plugin')).toBe(b)
+  expect(require.cache[a]).toBe(originalModule)
+  expect(require.cache[b]).toBe(nextModule)
+  expect(require(a)).toBe(original)
+  expect(f.require('@deepseek-ai/libreoffice-kit-darwin-arm64/package.json')).toBe(engine)
+  expect(f.require(join(f.runtime, f.manifest))).toBe(engine)
+})
+
 it('rejects an engine missing from the unpacked tree instead of using its archived copy', () => {
   const f = fixture()
   rmSync(join(f.root, 'app.asar.unpacked'), { recursive: true })
```

**File**: `packages/boot/hmr/README.i18n.yaml` (modified, +4/-4)
```diff
@@ -21,8 +21,8 @@
   en: 45ee194ad781d603
   zh: b3d7fcd8ed73717c
 /deepseek-ai-dsh-hmr/understand-the-implementation:
-  en: c4a270a9970e7ee9
-  zh: 700c4ddacb5d0333
+  en: 227c3c99c3c4b597
+  zh: 853b656340cb8bce
 /deepseek-ai-dsh-hmr/model-experience:
   en: 215e7ba838619b7b
   zh: a311da3843709f90
@@ -39,8 +39,8 @@
   en: 89e0624fafd701fb
   zh: 19d36a33c1d9af9d
 /deepseek-ai-dsh-hmr/known-limitations-and-deferred-work:
-  en: 0b1966d667d1830d
-  zh: 0c4b7ab863ef24bb
+  en: 0f46d4df1dab7f3b
+  zh: d172835159a20cce
 /deepseek-ai-dsh-hmr/known-limitations-and-deferred-work/dev-note:
   en: 7972e4b2005ec9a4
   zh: 754c49ec538c164c
```

**File**: `packages/boot/hmr/README.md` (modified, +3/-3)
```diff
@@ -64,7 +64,7 @@ Loader entries retain their raw import results. HMR retains every distinct impor
 
 Entries sharing a runtime are replaced together, with each entry receiving the implementation for its own module. Duplicate entries for one module retain their separate plugin instances. On replacement failure, HMR removes partially activated replacements and restores the previous modules and plugin implementations. A successful reload updates every matching entry record, including disabled entries; a failed replacement leaves those records unchanged. Entries that have never loaded remain uninitialized.
 
-[package-manifest.ts](src/package-manifest.ts) owns the Node internal interfaces for package reads, scope, type, and nearest-manifest lookups. Each HMR instance owns its configuration cache and restores its installed hooks on disposal. Manifest invalidation clears the ESM `ResolveCache` and CommonJS `_pathCache`: neither records every consulted manifest, and entries may point outside their package directory. With Node's default resolver, CommonJS loads resolve the request to a filename before entering the native loader, bypassing its old request alias while preserving evaluated modules. Ordinary module replacement remains HMR's separate operation.
+[package-manifest.ts](src/package-manifest.ts) owns the Node internal interfaces for package reads, scope, type, and nearest-manifest lookups. Each HMR instance owns its configuration cache and restores its installed hooks on disposal. Manifest invalidation clears the ESM `ResolveCache` and CommonJS `_pathCache`: neither records every consulted manifest, and entries may point outside their package directory. CommonJS loads resolve requests with Node's default resolver before entering the native loader, bypassing old request aliases while preserving evaluated modules. Synchronous resolve hooks receive the resulting filenames. Ordinary module replacement remains HMR's separate operation.
 
 Watched module paths use Node ESM resolution's `realpathSync()` spelling, including Windows short directory names, so file events match the module cache.
 
@@ -95,8 +95,8 @@ Reloading a contributing plugin can change later request prefixes; HMR does not
 
 - Module replacement requires Node loader internals. Framework dependency changes call the host-provided `loader.exit()` hook; HMR itself does not restart the process.
 - Replacing installed package versions still requires a restart through Plugin Manager; manifests below `node_modules` keep Node's cached configuration. The browser Client module graph retains its separate browser-side loading mechanism.
-- Future work: support TSX's asynchronous loader thread. Main-thread hooks do not invalidate that thread's package configuration; ordinary application-created Workers are outside the supported scope.
-- CommonJS requests with registered synchronous resolve hooks retain the original loader path; refreshing their private request cache is deferred. Builtins retain Node's original loading behavior.
+- TSX loaders and ordinary application-created Workers are outside the supported package-cache refresh scope.
+- CommonJS requests must be resolvable by Node's default resolver. Synchronous hooks may postprocess the resulting filenames, as Desktop's Office resolver does; hooks requiring the original request name or introducing virtual requests are unsupported. Builtins retain Node's original loading behavior.
 - Future work: retain package invalidation across HMR disposal and replacement. Restoring the native readers can expose their older cached configuration again.
 - If a shared runtime's replacement modules have different plugin callbacks, an instance without a Loader entry cannot be assigned to one of them. HMR reports an ambiguity error and rolls back the reload.
 - `watchConfig()` resolves when Chokidar reports readiness. On darwin, libuv starts the FSEvents stream afterwards on its own thread, so a write that lands within milliseconds of registration is not reported until the next event in that directory; edits made after startup are unaffected.
```

**File**: `packages/boot/hmr/README.zh.md` (modified, +3/-3)
```diff
@@ -64,7 +64,7 @@ Loader entry 保留原始导入结果。HMR 为每个 entry 名称与配置树 b
 
 共享同一运行时的 entry 一起替换，每个 entry 使用其自身模块对应的实现。同一模块的重复 entry 仍保有各自的插件实例。替换失败时，HMR 清理已部分激活的替换实例，并恢复原来的模块和插件实现。重载成功后更新所有匹配的 entry 记录，包括已停用的 entry；替换失败时这些记录保持不变。从未加载过的 entry 仍保持未初始化状态。
 
-[package-manifest.ts](src/package-manifest.ts) 封装 package 读取、scope、type 和最近 manifest 查询所需的 Node internal 接口。每个 HMR 实例拥有自己的配置缓存，销毁时恢复它安装的 hook。manifest 失效会清空 ESM `ResolveCache` 和 CommonJS `_pathCache`：它们都不记录查询过的全部 manifest，入口也可能指向包目录之外。使用 Node 默认 resolver 时，CommonJS 加载先将请求解析为文件名，再进入原生 loader，绕过旧请求别名并保留已求值模块。普通模块替换仍由 HMR 独立处理。
+[package-manifest.ts](src/package-manifest.ts) 封装 package 读取、scope、type 和最近 manifest 查询所需的 Node internal 接口。每个 HMR 实例拥有自己的配置缓存，销毁时恢复它安装的 hook。manifest 失效会清空 ESM `ResolveCache` 和 CommonJS `_pathCache`：它们都不记录查询过的全部 manifest，入口也可能指向包目录之外。CommonJS 加载先用 Node 默认 resolver 解析请求，再进入原生 loader，绕过旧请求别名并保留已求值模块。同步 resolve hook 收到的是解析后的文件名。普通模块替换仍由 HMR 独立处理。
 
 被监听模块的路径沿用 Node ESM 解析所用的 `realpathSync()` 表示，包括 Windows 短目录名，使文件事件与模块缓存匹配。
 
@@ -95,8 +95,8 @@ Loader entry 保留原始导入结果。HMR 为每个 entry 名称与配置树 b
 
 - 模块替换需要 Node loader 内部接口。框架依赖变化调用宿主提供的 `loader.exit()` 钩子；HMR 本身不重启进程。
 - 通过插件管理器替换已安装包版本仍需要重启；`node_modules` 之下的 manifest 保留 Node 缓存的配置。浏览器 Client 模块图保留独立的浏览器侧加载机制。
-- 后续工作：支持 TSX 的异步 loader 线程。主线程 hook 不会使该线程内的包配置失效；普通应用自行创建的 Worker 不在支持范围内。
-- 注册了同步 resolve hooks 的 CommonJS 请求保留原有 loader 路径，其私有请求缓存刷新留待后续。内置模块保留 Node 原有的加载行为。
+- TSX loader 和普通应用自行创建的 Worker 不在包缓存刷新支持范围内。
+- CommonJS 请求必须能由 Node 默认 resolver 解析。同步 hook 可以像 Desktop 的 Office resolver 一样处理解析后的文件名；依赖原始请求名或引入虚拟请求的 hook 不受支持。内置模块保留 Node 原有的加载行为。
 - 后续工作：跨 HMR 销毁和替换保留包配置失效状态。恢复原生 reader 后，其旧配置缓存可能重新可见。
 - 如果共享运行时的替换模块具有不同的插件回调，没有 Loader entry 的实例就无法确定应使用哪一个。HMR 会报告歧义错误并回滚此次重载。
 - `watchConfig()` 在 Chokidar 报告就绪时 resolve。darwin 上 libuv 随后才在自己的线程启动 FSEvents 流，因此注册后数毫秒内落地的写入要等到该目录的下一个事件才会被报告；启动之后的编辑不受影响。
```

**File**: `packages/boot/hmr/src/package-manifest.ts` (modified, +1/-3)
```diff
@@ -51,7 +51,6 @@ interface NativeAccess {
   reader: PackageReader
   ResolveCache: ResolveCacheClass
   cjs: CommonJsModule
-  customization: { resolveHooks: readonly unknown[] }
   esmLoader: { resolveSync(...args: unknown[]): unknown }
 }
 
@@ -94,7 +93,6 @@ function loadNodeInternals(): NativeAccess {
     reader: requireInternal('internal/modules/package_json_reader') as PackageReader,
     ResolveCache: (requireInternal('internal/modules/esm/module_map') as { ResolveCache: ResolveCacheClass }).ResolveCache,
     cjs: (requireInternal('internal/modules/cjs/loader') as { Module: CommonJsModule }).Module,
-    customization: requireInternal('internal/modules/customization_hooks') as NativeAccess['customization'],
     esmLoader: esm.getOrInitializeCascadedLoader(),
   }
 }
@@ -219,7 +217,7 @@ export class PackageManifests {
   private hookCommonJsLoad(...[request, parent, isMain, ...options]: Parameters<CommonJsModule['_load']>) {
     const native = this.installPackageHooks()
     // Absolute filenames bypass Node's private request cache without evicting evaluated modules.
-    const filename = request.startsWith('node:') || isBuiltin(request) || native.customization.resolveHooks.length
+    const filename = request.startsWith('node:') || isBuiltin(request)
       ? request : native.cjs._resolveFilename(request, parent, isMain)
     return this.rawCommonJs._load.call(native.cjs, filename, parent, isMain, ...options)
   }
```

**File**: `packages/boot/hmr/tests/package-manifest.spec.ts` (modified, +5/-4)
```diff
@@ -61,7 +61,7 @@ function resolveEsm(specifier: string, parentURL: string): string {
 }
 
 describe('package manifest invalidation', { concurrent: false }, () => {
-  it('preserves synchronous resolve hooks and node-prefixed builtins after invalidation', async () => {
+  it('preserves filename-based resolve hooks and node-prefixed builtins after invalidation', async () => {
     const f = fixture()
     file(f.manifest, '{}')
     const importerRequire = createRequire(f.importer)
@@ -70,12 +70,13 @@ describe('package manifest invalidation', { concurrent: false }, () => {
     const missingFailure = outcome(() => importerRequire(missingBuiltin))
     expect(missingFailure).toHaveProperty('code', 'ERR_UNKNOWN_BUILTIN_MODULE')
     const target = join(f.dir, 'a.cjs')
-    const specifier = `virtual:${f.importerURL}`
+    const specifier = join(f.dir, 'alias.cjs')
+    file(specifier, 'module.exports = { marker: "alias" }')
     cleanup.push(() => { Reflect.deleteProperty(importerRequire.cache, target) })
     let hooks: ReturnType<typeof registerHooks> | undefined = registerHooks({
       resolve(request, context, nextResolve) {
-        if (request === specifier) return { url: pathToFileURL(target).href, shortCircuit: true }
-        return nextResolve(request, context)
+        const resolved = nextResolve(request, context)
+        return resolved.url === pathToFileURL(specifier).href ? { ...resolved, url: pathToFileURL(target).href } : resolved
       },
     })
     cleanup.push(() => { hooks?.deregister() })
```

---

### Incident Patch 14: `b1c5f861` (2026-10-01)
**Commit Message**: fix(hmr): preserve loaded entry identities across manifest changes

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.i18n.yaml` (modified, +8/-8)
```diff
@@ -15,17 +15,17 @@
   en: e72abbf8fafc89bb
   zh: f6c59177696c5cd3
 /agent-note-expire-hmr-package-configuration/decision/hmr-package-configuration-expiry:
-  en: 04a76774135df963
-  zh: 8f84d6d9f1fdfa9a
+  en: c7de8dafe47a5587
+  zh: 6010a70d8451edd1
 /agent-note-expire-hmr-package-configuration/decision/future-work:
-  en: 94635542451fac60
-  zh: d0e366a39c03c10c
+  en: 31818f8f7f80470b
+  zh: ecb7ac85bb49cf6d
 /agent-note-expire-hmr-package-configuration/alternatives-considered:
-  en: 47590f8e9712ab5f
-  zh: 681162750e3b5cfb
+  en: 5dab1237a312169c
+  zh: b24927d5badedcf7
 /agent-note-expire-hmr-package-configuration/verification:
-  en: 89f8e51419468406
-  zh: 372e3b02773ddd01
+  en: d1d931904beb1c9f
+  zh: ea7874b974e1c209
 /agent-note-expire-hmr-package-configuration/consequences:
   en: e557562e3f7b07bc
   zh: 3cd196a63e4099b0
```

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.md` (modified, +9/-4)
```diff
@@ -27,9 +27,13 @@ In HMR's change dispatch, a changed file named `package.json` outside `node_modu
 - CommonJS `_pathCache` is cleared for the same reason. Unrelated requests recompute their resolution without unloading their modules.
 - CommonJS loads using the default resolver pass the freshly resolved filename to the native loader. Its private request alias cannot select an older entry; cached module instances remain intact.
 
-Configuration invalidation alone leaves loaded modules unchanged. Stopping and restarting a Loader entry resolves its package name again and selects the new entry. Tracking active entry URLs independently of later package-name resolutions is deferred.
+Configuration invalidation alone leaves loaded modules unchanged. Loader entries retain their raw import results before export normalization. HMR matches imported Node module objects to cached ModuleJob namespaces and reloads the loaded URLs. All matching entry records, including disabled entries, update only after a successful reload and remain unchanged on failure. Stopping and restarting a Loader entry resolves its package name again and selects the new entry.
 
-The implementation lives in `packages/boot/hmr/src/package-manifest.ts`, which encapsulates its Node internal interfaces. `index.ts` dispatches manifest changes without changing the module-reload algorithm. HMR's `node_modules` exclusion is unchanged.
+Entry names are scoped by configuration-tree base URL and retain all distinct imported namespaces. An uninitialized entry contributes the name without erasing loaded namespaces; name-based resolution is used only when none is recorded, or for `cordis:` builtins. Dependency analysis considers every recorded module. Entries sharing a plugin runtime use one replacement operation, while each Loader entry selects its replacement by its original namespace. Module imports and export normalization finish before the old runtime is removed. Failed imports or activation restore the previous modules and plugin implementations and clean up partially activated replacements.
+
+An instance without a Loader entry has no recorded module identity. If a shared runtime's replacement modules have different plugin callbacks, HMR reports an ambiguity error and rolls back instead of assigning that instance to an arbitrary module.
+
+Package invalidation lives in `packages/boot/hmr/src/package-manifest.ts`, which encapsulates its Node internal interfaces. `index.ts` dispatches manifest changes and locates loaded entries by module identity. HMR's `node_modules` exclusion is unchanged.
 
 | Interface | Action |
 |---|---|
@@ -45,7 +49,6 @@ The binding's `getNearestParentPackageJSON` is called only by `package_json_read
 
 - Online replacement inside `node_modules`, same-path reinstall, changed link targets, and cross-package reload propagation remain unsupported. Package updates need process restart; this does not guarantee that every management result already reports that requirement correctly.
 - TSX versions using an asynchronous loader thread keep that thread's package configuration outside these hooks. Synchronizing it is deferred; this change does not provide general Worker cache synchronization.
-- After exports or main moves an entry, HMR can fail to locate its old loaded module by package name. Keeping an active-entry URL association is deferred; restarting the Loader entry selects the new entry.
 - CommonJS private-request-cache refresh with registered synchronous resolve hooks is deferred. Those requests retain their original loader behavior.
 - Disposing HMR restores the native readers, whose previous cached configuration can become visible again. Preserving invalidation state across HMR replacement is deferred.
 
@@ -57,12 +60,14 @@ The binding's `getNearestParentPackageJSON` is called only by `package_json_read
 
 **Re-import reloaded plugins by package name.** It would let an entry rename follow a source reload, but changes `partialReload`'s rule that the loaded URL is the reload unit. Entry renames already take effect when the Loader entry restarts, so this is not changed.
 
+**Keep one namespace per entry name.** Entries with the same name and base URL can have loaded different modules before and after a manifest change. Keeping only the first or last namespace loses a live module; an uninitialized entry must not erase another entry's imported namespace.
+
 ## Verification
 
 | Coverage | Location |
 |---|---|
 | Expired exports, main, imports, type, scope, and nearest manifests; native-reader parity; actual CommonJS loads and retained module instances; the `node_modules` boundary; restoration | `packages/boot/hmr/tests/package-manifest.spec.ts` |
-| Configuration-only manifests, JSON-module and host reloads, source reloads, entry restarts, and the `node_modules` exclusion | `packages/boot/hmr/tests/package-manifest-dispatch.spec.ts` |
+| Configuration-only manifests, JSON-module and host reloads, source reloads, same-name and shar
```

**File**: `.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.zh.md` (modified, +9/-4)
```diff
@@ -27,9 +27,13 @@ HMR 的文件变化分派中，文件名为 `package.json` 且不在 `node_modul
 - 基于相同原因清空 CommonJS `_pathCache`。无关请求重新计算解析结果，不卸载其模块。
 - 使用默认 resolver 的 CommonJS 加载把重新解析的文件名交给原生 loader。其私有请求别名不再选中旧入口，已缓存的模块实例保持不变。
 
-仅使配置失效不会改变已加载模块。停止并重新启动 Loader entry 时，会重新按包名解析并选择新入口。独立于后续包名解析记录活动入口 URL 留待后续。
+仅使配置失效不会改变已加载模块。Loader entry 保留导出规范化之前的原始导入结果。HMR 将已导入的 Node 模块对象与缓存中 ModuleJob 的模块命名空间按对象身份匹配，重载已加载 URL。所有匹配的 entry 记录，包括已停用的 entry，仅在重载成功后更新，失败时保持不变。停止并重新启动 Loader entry 时，会重新按包名解析并选择新入口。
 
-实现位于 `packages/boot/hmr/src/package-manifest.ts`，封装其使用的 Node internal 接口。`index.ts` 分派 manifest 变更，不改变模块重载算法。HMR 的 `node_modules` 排除规则不变。
+entry 名称以配置树 base URL 为作用域，并保留所有不同的已导入命名空间。尚未初始化的 entry 只登记名称，不抹去已加载的命名空间；仅在没有记录命名空间或入口为 `cordis:` 内置模块时按名称解析。依赖分析考虑每个已记录模块。共享插件运行时的 entry 使用同一次替换操作，但每个 Loader entry 按自身原命名空间选择替换实现。模块导入与导出规范化在移除旧运行时之前完成。导入或激活失败时，恢复原来的模块和插件实现，并清理已部分激活的替换实例。
+
+没有 Loader entry 的实例不具备已记录的模块身份。如果共享运行时的替换模块具有不同的插件回调，HMR 会报告歧义错误并回滚，而不是将该实例随意分配给某个模块。
+
+包配置失效实现在 `packages/boot/hmr/src/package-manifest.ts`，封装其使用的 Node internal 接口。`index.ts` 分派 manifest 变更，并按模块身份定位已加载 entry。HMR 的 `node_modules` 排除规则不变。
 
 | 接口 | 动作 |
 |---|---|
@@ -45,7 +49,6 @@ binding 的 `getNearestParentPackageJSON` 只被 `package_json_reader` 自己调
 
 - 不支持 `node_modules` 内在线替换、同路径重装、link 换目标及跨包重载传播。包更新需要重启进程；这不保证每个管理操作的结果都已正确报告这一要求。
 - 使用异步 loader 线程的 TSX 版本，其线程内包配置不受这些 hook 管理。线程同步留待后续；本次不提供通用 Worker 缓存同步。
-- exports 或 main 改变入口后，HMR 可能无法按包名找到旧的已加载模块。保留活动 entry URL 关联留待后续；重启 Loader entry 会选择新入口。
 - 注册了同步 resolve hooks 时，CommonJS 私有请求缓存刷新留待后续；这些请求保留原有 loader 行为。
 - 销毁 HMR 会恢复原生 reader，其此前缓存的配置可能重新可见。跨 HMR 替换保留失效状态留待后续。
 
@@ -57,12 +60,14 @@ binding 的 `getNearestParentPackageJSON` 只被 `package_json_reader` 自己调
 
 **按插件名重新 import 被重载的插件。** 这能让入口改名随源码重载生效，但会改变 `partialReload` 以已加载 URL 为重载单位的规则。入口改名在 Loader entry 重启时已经生效，所以本次不改。
 
+**每个 entry 名称只保留一个命名空间。** 名称和 base URL 相同的 entry，可能在 manifest 变化前后加载了不同模块。只保留最早或最后一个命名空间会遗漏仍在使用的模块；尚未初始化的 entry 也不能抹去其他 entry 的已导入命名空间。
+
 ## Verification
 
 | 覆盖面 | 位置 |
 |---|---|
 | 失效后的 exports、main、imports、type、scope、最近 package.json，原生 reader 对照，实际 CommonJS 加载及旧模块实例保留，node_modules 边界，恢复 | `packages/boot/hmr/tests/package-manifest.spec.ts` |
-| 配置专用 manifest、JSON 模块与宿主重载、源码重载、entry 重启和 node_modules 排除规则 | `packages/boot/hmr/tests/package-manifest-dispatch.spec.ts` |
+| 配置专用 manifest、JSON 模块与宿主重载、源码重载、同名及共享运行时的 entry、导入与激活失败回滚、entry 重启和 node_modules 排除规则 | `packages/boot/hmr/tests/package-manifest-dispatch.spec.ts` |
 
 测试不需要 API key，不调用模型。
 
```

**File**: `docs/config-catalog.md` (modified, +1/-1)
```diff
@@ -1305,7 +1305,7 @@ export interface Config {
 ## `@deepseek-ai/dsh-hmr`
 
 - `refs`: `ChokidarOptions` (`chokidar`)
-- `source`: [`packages/boot/hmr/src/index.ts:52`](../packages/boot/hmr/src/index.ts)
+- `source`: [`packages/boot/hmr/src/index.ts:53`](../packages/boot/hmr/src/index.ts)
 
 ```ts config-catalog
 /** Module roots and watcher timing, with Chokidar deployment options. */
```

**File**: `docs/config-catalog.zh.md` (modified, +1/-1)
```diff
@@ -1307,7 +1307,7 @@ export interface Config {
 ## `@deepseek-ai/dsh-hmr`
 
 - `refs`: `ChokidarOptions` (`chokidar`)
-- `source`: [`packages/boot/hmr/src/index.ts:52`](../packages/boot/hmr/src/index.ts)
+- `source`: [`packages/boot/hmr/src/index.ts:53`](../packages/boot/hmr/src/index.ts)
 
 ```ts config-catalog
 /** Module roots and watcher timing, with Chokidar deployment options. */
```

**File**: `docs/event-producer-consumer.md` (modified, +2/-2)
```diff
@@ -51,8 +51,8 @@ This matrix shows which packages dispatch each harness-owned event and which pac
 | `fs/write-intent` | `waterfall` | [`packages/fs/fs/src/index.ts:59`](../packages/fs/fs/src/index.ts) | [`tool-fs`](../packages/fs/tool-fs) (`waterfall`), [`tool-str-replace-editor`](../packages/fs/tool-str-replace-editor) (`waterfall`) | [`fs-observation-policy`](../packages/fs/fs-observation-policy) |
 | `goal/activation-changed` | `emit` | [`packages/goal/goal/src/types.ts:150`](../packages/goal/goal/src/types.ts) | [`goal`](../packages/goal/goal) (`emit`) | `remotes` |
 | `goal/changed` | `emit` | [`packages/goal/goal/src/domain.ts:114`](../packages/goal/goal/src/domain.ts) | [`goal`](../packages/goal/goal) (`emit`) | [`goal-round-driver`](../packages/goal/goal-round-driver) |
-| `hmr/change` | `emit` | [`packages/boot/hmr/src/index.ts:31`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
-| `hmr/reload` | `emit` | [`packages/boot/hmr/src/index.ts:36`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
+| `hmr/change` | `emit` | [`packages/boot/hmr/src/index.ts:32`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
+| `hmr/reload` | `emit` | [`packages/boot/hmr/src/index.ts:37`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
 | `llm/adapters-updated` | `emit` | [`packages/llm/llm/src/types.ts:23`](../packages/llm/llm/src/types.ts) | [`llm`](../packages/llm/llm) (`events.dispatch`) | [`acp`](../packages/acp/acp), `remotes` |
 | `llm/stream` | `waterfall` | [`packages/llm/llm/src/index.ts:75`](../packages/llm/llm/src/index.ts) | [`llm`](../packages/llm/llm) (`waterfall`) | [`llm-replay`](../packages/test-support/llm-replay), [`session-checkpoint-policy`](../packages/session/session-checkpoint-policy), [`session-title`](../packages/session/session-title) |
 | `permission-presets/catalog-changed` | `emit` | [`packages/interaction/permission-presets/src/types.ts:48`](../packages/interaction/permission-presets/src/types.ts) | [`permission-presets`](../packages/interaction/permission-presets) (`events.dispatch`) | `remotes` |
```

**File**: `docs/event-producer-consumer.zh.md` (modified, +2/-2)
```diff
@@ -53,8 +53,8 @@
 | `fs/write-intent` | `waterfall` | [`packages/fs/fs/src/index.ts:59`](../packages/fs/fs/src/index.ts) | [`tool-fs`](../packages/fs/tool-fs) (`waterfall`), [`tool-str-replace-editor`](../packages/fs/tool-str-replace-editor) (`waterfall`) | [`fs-observation-policy`](../packages/fs/fs-observation-policy) |
 | `goal/activation-changed` | `emit` | [`packages/goal/goal/src/types.ts:150`](../packages/goal/goal/src/types.ts) | [`goal`](../packages/goal/goal) (`emit`) | `remotes` |
 | `goal/changed` | `emit` | [`packages/goal/goal/src/domain.ts:114`](../packages/goal/goal/src/domain.ts) | [`goal`](../packages/goal/goal) (`emit`) | [`goal-round-driver`](../packages/goal/goal-round-driver) |
-| `hmr/change` | `emit` | [`packages/boot/hmr/src/index.ts:31`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
-| `hmr/reload` | `emit` | [`packages/boot/hmr/src/index.ts:36`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
+| `hmr/change` | `emit` | [`packages/boot/hmr/src/index.ts:32`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
+| `hmr/reload` | `emit` | [`packages/boot/hmr/src/index.ts:37`](../packages/boot/hmr/src/index.ts) | [`hmr`](../packages/boot/hmr) (`emit`) | - |
 | `llm/adapters-updated` | `emit` | [`packages/llm/llm/src/types.ts:23`](../packages/llm/llm/src/types.ts) | [`llm`](../packages/llm/llm) (`events.dispatch`) | [`acp`](../packages/acp/acp), `remotes` |
 | `llm/stream` | `waterfall` | [`packages/llm/llm/src/index.ts:75`](../packages/llm/llm/src/index.ts) | [`llm`](../packages/llm/llm) (`waterfall`) | [`llm-replay`](../packages/test-support/llm-replay), [`session-checkpoint-policy`](../packages/session/session-checkpoint-policy), [`session-title`](../packages/session/session-title) |
 | `permission-presets/catalog-changed` | `emit` | [`packages/interaction/permission-presets/src/types.ts:48`](../packages/interaction/permission-presets/src/types.ts) | [`permission-presets`](../packages/interaction/permission-presets) (`events.dispatch`) | `remotes` |
```

**File**: `packages/boot/hmr/README.i18n.yaml` (modified, +4/-4)
```diff
@@ -21,8 +21,8 @@
   en: 45ee194ad781d603
   zh: b3d7fcd8ed73717c
 /deepseek-ai-dsh-hmr/understand-the-implementation:
-  en: 62af58987aad9ad3
-  zh: ef66c9a8fb24b6cb
+  en: c4a270a9970e7ee9
+  zh: 700c4ddacb5d0333
 /deepseek-ai-dsh-hmr/model-experience:
   en: 215e7ba838619b7b
   zh: a311da3843709f90
@@ -39,8 +39,8 @@
   en: 89e0624fafd701fb
   zh: 19d36a33c1d9af9d
 /deepseek-ai-dsh-hmr/known-limitations-and-deferred-work:
-  en: bc0c2ea681297be5
-  zh: 73adddd67dcc50a3
+  en: 0b1966d667d1830d
+  zh: 0c4b7ab863ef24bb
 /deepseek-ai-dsh-hmr/known-limitations-and-deferred-work/dev-note:
   en: 7972e4b2005ec9a4
   zh: 754c49ec538c164c
```

---

### Incident Patch 15: `d7d2e5fd` (2026-10-01)
**Commit Message**: fix(hmr): refresh CommonJS requests without evicting modules

**File**: `packages/boot/hmr/src/package-manifest.ts` (modified, +17/-1)
```diff
@@ -1,7 +1,7 @@
 /** Expire Node's cached package configuration for package directories whose manifest changed. */
 import { isUtf8 } from 'node:buffer'
 import { readFileSync, realpathSync } from 'node:fs'
-import { createRequire } from 'node:module'
+import { createRequire, isBuiltin } from 'node:module'
 import { basename, dirname, join, sep, toNamespacedPath } from 'node:path'
 import { fileURLToPath, pathToFileURL } from 'node:url'
 
@@ -42,13 +42,16 @@ interface ResolveCacheClass {
 
 interface CommonJsModule {
   _pathCache: Record<string, string>
+  _resolveFilename(request: string, parent: NodeJS.Module | null | undefined, isMain?: boolean): string
+  _load(request: string, parent: NodeJS.Module | null | undefined, isMain?: boolean, ...options: unknown[]): unknown
 }
 
 interface NativeAccess {
   binding: PackageBinding
   reader: PackageReader
   ResolveCache: ResolveCacheClass
   cjs: CommonJsModule
+  customization: { resolveHooks: readonly unknown[] }
   esmLoader: { resolveSync(...args: unknown[]): unknown }
 }
 
@@ -91,6 +94,7 @@ function loadNodeInternals(): NativeAccess {
     reader: requireInternal('internal/modules/package_json_reader') as PackageReader,
     ResolveCache: (requireInternal('internal/modules/esm/module_map') as { ResolveCache: ResolveCacheClass }).ResolveCache,
     cjs: (requireInternal('internal/modules/cjs/loader') as { Module: CommonJsModule }).Module,
+    customization: requireInternal('internal/modules/customization_hooks') as NativeAccess['customization'],
     esmLoader: esm.getOrInitializeCascadedLoader(),
   }
 }
@@ -137,6 +141,7 @@ export class PackageManifests {
   private native: NativeAccess | undefined
   private rawBinding!: PackageBinding
   private rawReader!: PackageReader
+  private rawCommonJs!: Pick<CommonJsModule, '_load'>
   private readonly restorers: Array<() => void> = []
 
   /**
@@ -197,17 +202,28 @@ export class PackageManifests {
     this.native = native
     const binding = createReplaceHelper(native.binding)
     const reader = createReplaceHelper(native.reader)
+    const commonJs = createReplaceHelper<Pick<CommonJsModule, '_load'>>(native.cjs)
     this.rawBinding = binding.rawImpl
     this.rawReader = reader.rawImpl
+    this.rawCommonJs = commonJs.rawImpl
     this.restorers.push(
       binding.replaceMethod('readPackageJSON', this.hookBindingReadPackageJSON.bind(this)),
       binding.replaceMethod('getPackageScopeConfig', this.hookBindingGetPackageScopeConfig.bind(this)),
       binding.replaceMethod('getPackageType', this.hookBindingGetPackageType.bind(this)),
       reader.replaceMethod('getNearestParentPackageJSON', this.hookReaderGetNearestParentPackageJSON.bind(this)),
+      commonJs.replaceMethod('_load', this.hookCommonJsLoad.bind(this)),
     )
     return native
   }
 
+  private hookCommonJsLoad(...[request, parent, isMain, ...options]: Parameters<CommonJsModule['_load']>) {
+    const native = this.installPackageHooks()
+    // Absolute filenames bypass Node's private request cache without evicting evaluated modules.
+    const filename = request.startsWith('node:') || isBuiltin(request) || native.customization.resolveHooks.length
+      ? request : native.cjs._resolveFilename(request, parent, isMain)
+    return this.rawCommonJs._load.call(native.cjs, filename, parent, isMain, ...options)
+  }
+
   private hookBindingReadPackageJSON(path: string, isEsm?: boolean, base?: string, specifier?: string) {
     return this.isPathInInvalidatedDirectory(path)
       ? this.readCachedPackageConfig(
```

**File**: `packages/boot/hmr/tests/package-manifest.spec.ts` (modified, +79/-1)
```diff
@@ -1,7 +1,7 @@
 /** Package configuration read by Node's resolver follows an invalidated manifest on disk. */
 import { spawn } from 'node:child_process'
 import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
-import { createRequire } from 'node:module'
+import NodeModule, { createRequire, registerHooks } from 'node:module'
 import { tmpdir } from 'node:os'
 import { dirname, join, toNamespacedPath } from 'node:path'
 import { fileURLToPath, pathToFileURL } from 'node:url'
@@ -61,6 +61,84 @@ function resolveEsm(specifier: string, parentURL: string): string {
 }
 
 describe('package manifest invalidation', { concurrent: false }, () => {
+  it('preserves synchronous resolve hooks and node-prefixed builtins after invalidation', async () => {
+    const f = fixture()
+    file(f.manifest, '{}')
+    const importerRequire = createRequire(f.importer)
+    const nativeFs = importerRequire('node:fs') as typeof import('node:fs')
+    const missingBuiltin = 'node:dsh-hmr-missing'
+    const missingFailure = outcome(() => importerRequire(missingBuiltin))
+    expect(missingFailure).toHaveProperty('code', 'ERR_UNKNOWN_BUILTIN_MODULE')
+    const target = join(f.dir, 'a.cjs')
+    const specifier = `virtual:${f.importerURL}`
+    cleanup.push(() => { Reflect.deleteProperty(importerRequire.cache, target) })
+    let hooks: ReturnType<typeof registerHooks> | undefined = registerHooks({
+      resolve(request, context, nextResolve) {
+        if (request === specifier) return { url: pathToFileURL(target).href, shortCircuit: true }
+        return nextResolve(request, context)
+      },
+    })
+    cleanup.push(() => { hooks?.deregister() })
+    try {
+      const original = importerRequire(specifier) as { marker: string }
+      expect(original).toEqual({ marker: 'a' })
+      await f.invalidate(f.manifest)
+      expect(importerRequire(specifier)).toBe(original)
+    } finally {
+      hooks.deregister()
+      hooks = undefined
+    }
+
+    const descriptor = Object.getOwnPropertyDescriptor(importerRequire.cache, 'fs')
+    const restore = () => {
+      if (descriptor) Object.defineProperty(importerRequire.cache, 'fs', descriptor)
+      else Reflect.deleteProperty(importerRequire.cache, 'fs')
+    }
+    cleanup.push(restore)
+    const fake = new NodeModule('fs')
+    const fakeExports = { marker: 'fake fs' }
+    fake.exports = fakeExports
+    try {
+      importerRequire.cache.fs = fake
+      expect(importerRequire('fs')).toBe(fakeExports)
+      expect(importerRequire('node:fs')).toBe(nativeFs)
+      expect(outcome(() => importerRequire(missingBuiltin))).toEqual(missingFailure)
+    } finally {
+      restore()
+    }
+  })
+
+  it('loads changed CommonJS exports without evicting previously loaded modules', async () => {
+    const f = fixture()
+    const a = join(f.dir, 'a.cjs')
+    const b = join(f.dir, 'b.cjs')
+    const unrelated = join(f.root, 'unrelated.cjs')
+    file(unrelated, 'module.exports = { marker: "unrelated" }')
+    file(f.manifest, JSON.stringify({ name: 'pkg', exports: './a.cjs' }))
+    const importerRequire = createRequire(f.importer)
+    cleanup.push(() => {
+      for (const path of [a, b, unrelated]) Reflect.deleteProperty(importerRequire.cache, path)
+    })
+    const original = importerRequire('pkg') as { marker: string }
+    const other = importerRequire(unrelated) as { marker: string }
+    const originalModule = importerRequire.cache[a]
+    const otherModule = importerRequire.cache[unrelated]
+    expect(original).toEqual({ marker: 'a' })
+    expect(originalModule).toBeDefined()
+    expect(otherModule).toBeDefined()
+
+    file(f.manifest, JSON.stringify({ name: 'pkg', exports: './b.cjs' }))
+    await f.invalidate(f.manifest)
+    expect(importerRequire.resolve('pkg')).toBe(b)
+    const current = importerRequire('pkg') as { marker: string }
+    expect(importerRequire.cache[a]).toBe(originalModule)
+    expect(importerRequire.cache[unrelated]).toBe(otherModule)
+    expect(original).toEqual({ marker: 'a' })
+    expect(importerRequire(a)).toBe(original)
+    expect(importerRequire(unrelated)).toBe(other)
+    expect(current).toEqual({ marker: 'b' })
+  })
+
   it.each(['symlink', 'main'] as const)('refreshes a cached external %s entry after its manifest changes', async (entry) => {
     const f = fixture()
     const external = join(f.root, 'packages', 'outside', 'entry.mjs')
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
