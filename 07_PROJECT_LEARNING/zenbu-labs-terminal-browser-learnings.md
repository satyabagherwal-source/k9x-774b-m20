# Forensic Learning Record (Deep Inspection): zenbu-labs/terminal-browser

> **Canonical Artifact**: `07_PROJECT_LEARNING/zenbu-labs-terminal-browser-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zenbu-labs/terminal-browser](https://github.com/zenbu-labs/terminal-browser))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:04:44.067Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zenbu-labs/terminal-browser`
- **Description**: A browser inside your terminal
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3659 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `claude-code-plugin/hooks/bridge-protocol.ts`
```
// we cannot use libraries inside the claude code sandbox, hence this gross code


export type Frame = {
  shm: string
  format: 'rgba' | 'rgb'
  width: number
  height: number
  generation: number
  cols: number
  rows: number
}

export type BridgeState = {
  version: number
  frame: Frame | null
  title: string
  url: string | null
  alive: boolean
  error: string | null
  inbox: number
}

export type LaunchReport =
  | { port: number; token: string }
  | { error: string; code: 'tty' | 'start' }

export type SizeMessage = { type: 'size'; cols: number; rows: number }
export type InputMessage = { type: 'input'; events: unknown[] }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

export const isFrame = (value: unknown): value is Frame =>
  isRecord(value)
  && typeof value.shm === 'string'
  && (value.format === 'rgba' || value.format === 'rgb')
  && Number.isInteger(value.width)
  && Number.isInteger(value.height)
  && Number.isInteger(value.generation)
  && Number.isInteger(value.cols)
  && Number.isInteger(value.rows)

export const isBridgeState = (value: unknown): value is BridgeState =>
  isRecord(value)
  && Number.isInteger(value.version)
  && typeof value.alive === 'boolean'
  && 'frame' in value
  && (value.frame === null || isFrame(value.frame))

export const isLaunchReport = (value: unknown): value is LaunchReport =>
  isRecord(value) && (typeof value.port === 'number' || typeof value.error === 'string')

export const isSizeMessage = (data: unknown): data is SizeMessage =>
  isRecord(data) && data.type === 'size' && Number.isInteger(data.cols) && Number.isInteger(data.rows)

export const isInputMessage = (data: unknown): data is InputMessage =>
  isRecord(data) && data.type === 'input' && Array.isArray(data.events)

export type AgentText = { text: string; screenshot: string | null }

const isAgentText = (value: unknown): value is AgentText =>
  isRecord(value) && typeof value.text === 'string' && (value.screenshot === null || typeof value.screenshot === 'string')

export const takenItems = (value: unknown): AgentText[] =>
  isRecord(value) && Array.isArray(value.items) ? value.items.filter(isAgentText) : []

```

### Core Architecture Module: `claude-code-plugin/hooks/browser.d.ts`
```
export type BrowserOpenInput = { url?: string }

export type BrowserOpenResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export type Browser = {
  open: (input: BrowserOpenInput) => Promise<BrowserOpenResult>
  close: (input?: Record<string, never>) => Promise<boolean>
}

declare module 'claude-code' {
  interface EngineInterface {
    browser: Browser
  }
}

```

### Core Architecture Module: `claude-code-plugin/hooks/register.tsx`
```
/* @jsx h */
import type { EngineInterface, Register } from 'claude-code'
import type { Browser } from './browser'
import { MAX_IMAGE_CELLS } from './surface.tsx'
import { normalizeUrl } from './urls.ts'
import {
  isBridgeState,
  isInputMessage,
  isLaunchReport,
  isSizeMessage,
  takenItems,
  type BridgeState,
  type Frame,
} from './bridge-protocol.ts'



const PANE = 'browser'
const IMAGE_KEY = 'view'
const IMAGE_ALT = ''
const OPEN_TOOL = 'mcp__terminal-browser__open'
const CLOSE_TOOL = 'mcp__terminal-browser__close'
const START_URL = 'terminal-browser://start'
const INSTALL_URL = 'https://terminal-browser.sh'
const REQUIRED_CAPABILITIES = ['embedding', 'image-frames']
const WATCH_RETRY_MS = 250
const DENIED_REDRAW_MS = 500
const DENIALS_BEFORE_LOGGING = 3


const state = {
  port: null as number | null,
  token: null as string | null,
  open: false,
  pendingUrl: null as string | null,
  region: null as { cols: number; rows: number } | null,
  last: null as BridgeState | null,
  frame: null as Frame | null,
  mounted: null as { cols: number; rows: number } | null,
  watcher: 0,
  // a hack to programatically trigger agent input focus
  viewGeneration: 0,
}

const bridgeUrl = (path: string) => `http://127.0.0.1:${state.port}${path}`
const authHeaders = () => ({ authorization: `Bearer ${state.token}` })
const viewKey = () => `view${state.viewGeneration}`


async function terminalBrowserCommand($: EngineInterface): Promise<string[]> {
  const checkoutCli = `${$.plugin.root}/../cli/dist/main.js`
  if (await $.fs.exists(checkoutCli)) return ['node', checkoutCli] // dev case
  return ['terminal-browser']
}

async function checkCapabilities($: EngineInterface, command: string[]): Promise<{ ok: true } | { ok: false; installed: boolean }> {
  let result: { stdout: string; exitCode: number }
  try {
    result = await $.process.run([...command, 'capabilities'], { timeoutMs: 10_000 })
  } catch {
    return { ok: false, installed: false }
  }
  let capabilities: string[] = []
  if (result.exitCode === 0) {
    const line = result.stdout.split('\n').find((text: string) => text.startsWith('{'))
    try {
      const parsed = line ? JSON.parse(line) : null
      if (parsed && Array.isArray(parsed.capabilities)) capabilities = parsed.capabilities
    } catch {}
  }
  const ok = REQUIRED_CAPABILITIES.every(need => capabilities.includes(need))
  return ok ? { ok: true } : { ok: false, installed: true }
}

async function startBridge($: EngineInterface): Promise<{ ok: true } | { ok: false; error: string }> {
  const command = await terminalBrowserCommand($)
  const check = await checkCapabilities($, command)
  if (!check.ok) {
    return {
      ok: false,
      error: check.installed
        ? 'Newer terminal-browser version required, run terminal-browser upgrade'
        : `Please install terminal-browser first - ${INSTALL_URL}`,
    }
  }
  let report: unknown = null
  try {
    const { stdout, stderr, exitCode } = await $.process.run([...command, 'claude-bridge', 'launch'], { timeoutMs: 20_000 })
    const line = stdout.split('\n').find((text: string) => text.startsWith('{'))
    report = line ? JSON.parse(line) : { error: stderr.trim() || `exit ${exitCode}`, code: 'start' }
  } catch (err) {
    report = { error: String(err), code: 'start' }
  }
  if (!isLaunchReport(report) || !('port' in report)) {
    const detail = isLaunchReport(report) && 'error' in report ? report.error : 'terminal-browser could not start'
    return { ok: false, error: `${detail}` }
  }
  state.port = report.port
  state.token = report.token
  void watchBridge($)
  return { ok: true }
}

async function post($: EngineInterface, path: string, body: unknown): Promise<unknown> {
  if (state.port === null) return null
  try {
    const response = await $.http.fetch(bridgeUrl(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    })
    return response.ok ? JSON.parse(response.text || '{}') : null
  } catch {
    return null
  }
}

async function fetchState($: EngineInterface, version: number): Promise<BridgeState | null> {
  if (state.port === null) return null
  try {
    const response = await $.http.fetch(bridgeUrl(`/state?version=${version}`), { headers: authHeaders() })
    const parsed: unknown = response.ok ? JSON.parse(response.text) : null
    return isBridgeState(parsed) ? parsed : null
  } catch {
    return null
  }
}


function imageSource(frame: Frame) {
  return { shm: frame.shm, format: frame.format, width: frame.width, height: frame.height, generation: frame.generation }
}

function imageGrid(frame: Frame, cols: number, rows: number) {
  return {
    cols: Math.max(1, Math.min(frame.cols, cols, MAX_IMAGE_CELLS)),
    rows: Math.max(1, Math.min(frame.rows, rows, MAX_IMAGE_CELLS)),
  }
}

function fitsMounted(frame: Frame): boolean {
  const mounted = state.mounted
  if (!mounted || !state.region) return false
  const grid = imageGrid(frame, state.region.cols, state.region.rows)
  return grid.cols === mounted.cols && grid.rows === mounted.rows
}

async function watchBridge($: EngineInterface): Promise<void> {
  const watcher = ++state.watcher
  const live = () => state.watcher === watcher && state.port !== null
  let version = -1
  let denials = 0
  let lastDeniedRedraw = 0
  while (live()) {
    const fresh = await fetchState($, version)
    if (!live()) return
    if (!fresh) {
      await $.clock.sleep(WATCH_RETRY_MS)
      continue
    }
    version = fresh.version
    const previous = state.last
    state.last = fresh
    if (fresh.inbox > 0) await deliverAgentText($)
    if (!state.open) continue
    const pictureGone = fresh.frame === null && state.frame !== null
    if (pictureGone) state.frame = null
    const paneChanged =
      !previous
      || pictureGone
      || previous.title !== fresh.title
      || previous.alive !== fresh.alive
      || previous.error !== fresh.error
    if (paneChanged) {
      $.ui.invalidate('ui.render')
      if (fresh.title) await $.ui.open({ id: PANE, title: fresh.title.slice(0, 40) })
    }
    const frame = fresh.frame
    if (!frame || frame.generation === state.frame?.generation) continue
    state.frame = frame
    if (!fitsMounted(frame)) {
      $.ui.invalidate('ui.render')
      continue
    }
    const result = await $.ui.blit({ requestId: PANE, key: IMAGE_KEY, source: imageSource(frame) })
    if (!result.deny) {
      denials = 0
      continue
    }
    denials += 1
    if (denials === DENIALS_BEFORE_LOGGING) $.ui.log(`terminal-browser: frame blit refused: ${result.deny}`)
    const now = Date.now()
    if (now - lastDeniedRedraw >= DENIED_REDRAW_MS) {
      lastDeniedRedraw = now
      $.ui.invalidate('ui.render')
    }
  }
}

async function openBrowser($: EngineInterface, raw: string | null): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (state.port === null) {
    const started = await startBridge($)
    if (!started.ok) return started
  }
  const alive = state.last?.alive === true
  const url = raw ? normalizeUrl(raw) : (alive && state.last?.url ? state.last.url : START_URL)
  state.pendingUrl = url
  state.open = true
  await $.ui.open({ id: PANE, title: 'browser', focus: true, rows: 24 })
  $.ui.invalidate('ui.render')
  if (state.region) {
    state.pendingUrl = null
    await post($, '/open', { url, ...state.region })
  }
  return { ok: true, url }
}

async function closeBrowser($: EngineInterface): Promise<boolean> {
  if (!state.open) return false
  await $.ui.close({ id: PANE })
  return true
}

async function browserClosed($: EngineInterface): Promise<void> {
  state.open = false
  state.pendingUrl = null
  state.region = null
  state.frame = null
  state.mounted = null
  await post($, '/browser/close', {})
}

async function deliverAgentText($: EngineInterface): Promise<void> {
  const oneLine = (text: string) => text.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').replace(/\s+/g, ' ').trim()
  const lines = takenItems(await post($, '/inbox/take', {}))
    .filter(item => item.text.trim() !== '')
    .flatMap(item => [`> ${oneLine(item.text)}`, ...(item.screenshot ? [oneLine(item.screenshot)] : [])])
  if (lines.length === 0) return
  const { isFilled } = await $.prompt.fill({ text: `${lines.join('\n')}\n` })
  if (!isFilled) {
    // would need to see a case this happens before shipping
    // $.ui.toast('copied to clipboard')
    return
  }
  state.viewGeneration += 1
  $.ui.invalidate('ui.render')
}


export const register: Register = (on, options) => {
  const agentToolEnabled = options.agentTool === true

// this is a hack because the plugin api does not allow $ or the result of next to be passed to functions
  on('engine.create', async ($, e, next) => {
    const built = await next(e)
    const servedByHooks = () => { throw new Error('the browser noun is served by its hooks') }
    const browser: Browser = { open: servedByHooks, close: servedByHooks }
    return { ...built, browser }
  })

  on('browser.open', async ($, e) => {
    const opened = await openBrowser($, e.url ?? null)
    return { value: opened }
  })

  on('browser.close', async ($) => {
    return { value: await closeBrowser($) }
  })

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    let surfaces: readonly string[] = []
    try {
      surfaces = await $.session.surfaces()
    } catch {}
    if (!surfaces.includes('terminal')) return r
    await $.command.register({
      name: 'browser',
      description: 'Open a browser to the right',
      argumentHint: '[url]',
      immediate: true,
    }).catch(err => $.ui.log(`terminal-browser: /browser not registered: ${err}`))
    if (agentToolEnabled) {
      await $.tool.register({
        name: 'open',
        description: 'Open terminal-browser directly inside claude code. Control the open page with the terminal-browser action CLI.',
        inputSchema: { type: 'object', properties: { url: { type: 'string', descri
```

### Core Architecture Module: `claude-code-plugin/hooks/surface.tsx`
```
/* @jsx h */
import type { ClientKeyEvent, ClientPointerEvent, ClientSurface } from 'claude-code'

export const MAX_IMAGE_CELLS = 255

type State = { cols: number; rows: number }

type InputEvent =
  | { type: 'mouse'; kind: ClientPointerEvent['type']; button?: string; x: number; y: number; mods: Mods }
  | { type: 'key'; key: string; text?: string; mods: Mods }
type Mods = { shift: boolean; alt: boolean; ctrl: boolean; super: boolean }

const KEY_NAMES: Record<string, string> = {
  return: 'enter',
  enter: 'enter',
  backspace: 'backspace',
  delete: 'delete',
  tab: 'tab',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  home: 'home',
  end: 'end',
  pageup: 'pageup',
  pagedown: 'pagedown',
  insert: 'insert',
  space: ' ',
}

function keyEvent(event: ClientKeyEvent): InputEvent | null {
  const mods: Mods = { shift: Boolean(event.shift), alt: false, ctrl: Boolean(event.ctrl), super: Boolean(event.meta) }
  const named = KEY_NAMES[event.key.toLowerCase()]
  if (named !== undefined) {
    return { type: 'key', key: named, text: named.length === 1 && !mods.ctrl ? named : undefined, mods }
  }
  if ([...event.key].length === 1) {
    return { type: 'key', key: event.key, text: mods.ctrl || mods.super ? undefined : event.key, mods }
  }
  const fn = /^f(\d{1,2})$/i.exec(event.key)
  if (fn) return { type: 'key', key: `f${fn[1]}`, mods }
  return null
}

function pointerEvent(event: ClientPointerEvent): InputEvent | null {
  const mods: Mods = { shift: Boolean(event.shift), alt: Boolean(event.alt), ctrl: Boolean(event.ctrl), super: false }
  if (event.type === 'enter' || event.type === 'leave') return { type: 'mouse', kind: 'move', x: event.x, y: event.y, mods }
  return { type: 'mouse', kind: event.type, button: event.button, x: event.x, y: event.y, mods }
}

export default function Browser(_props: unknown, surface: ClientSurface<State>) {
  const { Box } = surface.elements
  const queue: InputEvent[] = []

  if (surface.state === undefined) {
    surface.setState({ cols: 0, rows: 0 })
    surface.onPointer(event => {
      const mapped = pointerEvent(event)
      if (mapped) queue.push(mapped)
    })
    surface.onKey(event => {
      const mapped = keyEvent(event)
      if (mapped) queue.push(mapped)
    })

    surface.every(20, () => {
      if (queue.length === 0) return
      surface.post({ type: 'input', events: queue.splice(0, queue.length) as unknown as never })
    })
  }

  const cols = Math.min(surface.columns, MAX_IMAGE_CELLS)
  const rows = Math.min(surface.rows, MAX_IMAGE_CELLS)
  if (cols > 0 && rows > 0 && surface.state && (surface.state.cols !== cols || surface.state.rows !== rows)) {
    surface.setState({ cols, rows })
    surface.post({ type: 'size', cols, rows })
  }

  return <Box flexDirection="column" height="100%" />
}

```

### Core Architecture Module: `claude-code-plugin/hooks/urls.ts`
```
export function normalizeUrl(raw: string): string {
  const text = raw.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return text
  if (/^localhost(:\d+)?(\/|$)/.test(text) || /^\d+\.\d+\.\d+\.\d+/.test(text)) return `http://${text}`
  return `https://${text}`
}

```

### Core Architecture Module: `monitor/src/enginelog.ts`
```
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface LogLine {
  at: number;
  level: string;
  target: string;
  message: string;
}

const KEEP_LINES = 500;

function logFile(pid: number): string {
  const state = process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state");
  return path.join(state, "pixel", "logs", `${pid}.jsonl`);
}

// Follows each engine's log file from where the last poll stopped.
export class EngineLog {
  private offsets = new Map<number, number>();
  private lines = new Map<number, LogLine[]>();

  hasLog(pid: number): boolean {
    return fs.existsSync(logFile(pid));
  }

  poll(pids: number[]): Map<number, LogLine[]> {
    for (const pid of pids) this.read(pid);
    for (const pid of [...this.lines.keys()]) {
      if (!pids.includes(pid)) {
        this.lines.delete(pid);
        this.offsets.delete(pid);
      }
    }
    return this.lines;
  }

  private read(pid: number): void {
    const file = logFile(pid);
    let size: number;
    try {
      size = fs.statSync(file).size;
    } catch {
      return;
    }
    const offset = this.offsets.get(pid) ?? 0;
    const start = size < offset ? 0 : offset;
    if (size === start) return;
    const buffer = Buffer.alloc(size - start);
    const fd = fs.openSync(file, "r");
    try {
      fs.readSync(fd, buffer, 0, buffer.length, start);
    } finally {
      fs.closeSync(fd);
    }
    const text = buffer.toString("utf8");
    const lastNewline = text.lastIndexOf("\n");
    if (lastNewline === -1) return;
    this.offsets.set(pid, start + Buffer.byteLength(text.slice(0, lastNewline + 1)));
    const list = this.lines.get(pid) ?? [];
    for (const line of text.slice(0, lastNewline).split("\n")) {
      let parsed: { t?: number; level?: string; target?: string; message?: string };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof parsed.message !== "string" || typeof parsed.t !== "number") continue;
      list.push({ at: parsed.t, level: parsed.level ?? "info", target: parsed.target ?? "", message: parsed.message });
    }
    this.lines.set(pid, list.slice(-KEEP_LINES));
  }
}

```

### Core Architecture Module: `pixel/engine/crates/pixel-core/native-scroll-helper.swift`
```

import AppKit

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

let scale = NSScreen.main?.backingScaleFactor ?? 2.0
print("scale \(scale)")
fflush(stdout)

private func cursorPoint() -> CGPoint {
    CGEvent(source: nil)?.location ?? .zero
}

private let outputLock = NSLock()

private func emit(_ line: String) {
    outputLock.lock()
    print(line)
    fflush(stdout)
    outputLock.unlock()
}

private func windowUnderCursor(_ point: CGPoint) -> CGRect? {
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    guard let list = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
        return nil
    }
    for info in list {
        guard let layer = info[kCGWindowLayer as String] as? Int, layer == 0 else { continue }
        if let alpha = info[kCGWindowAlpha as String] as? Double, alpha < 0.05 { continue }
        guard let raw = info[kCGWindowBounds as String],
              let bounds = CGRect(dictionaryRepresentation: raw as! CFDictionary),
              bounds.width > 1, bounds.height > 1 else { continue }
        if bounds.contains(point) { return bounds }
    }
    return nil
}

private final class WindowProbe {
    private let lock = NSLock()
    private var lastPoint = CGPoint(x: CGFloat.infinity, y: CGFloat.infinity)
    private var lastRect: CGRect?
    private var lastProbe = 0.0

    func refresh(_ point: CGPoint, force: Bool) {
        lock.lock()
        let now = ProcessInfo.processInfo.systemUptime
        let moved = hypot(point.x - lastPoint.x, point.y - lastPoint.y) > 2
        guard force || (moved && now - lastProbe > 0.08) else {
            lock.unlock()
            return
        }
        lastPoint = point
        lastProbe = now
        let previous = lastRect
        let rect = windowUnderCursor(point)
        lastRect = rect
        let changed = previous.map { p in rect.map { !$0.equalTo(p) } ?? true } ?? (rect != nil)
        lock.unlock()
        guard changed else { return }
        if let rect {
            emit("w \(rect.origin.x) \(rect.origin.y) \(rect.width) \(rect.height)")
        } else {
            emit("w none")
        }
    }

    func invalidate() {
        lock.lock()
        lastPoint = CGPoint(x: CGFloat.infinity, y: CGFloat.infinity)
        lastRect = nil
        lock.unlock()
    }
}

private let windowProbe = WindowProbe()

private final class PositionStream {
    private let lock = NSLock()
    private var armedUntil = 0.0
    private var lastEmit = 0.0

    private static let keepalive = 8.0

    func setArmed(_ value: Bool) {
        lock.lock()
        armedUntil = value ? ProcessInfo.processInfo.systemUptime + Self.keepalive : 0
        lock.unlock()
        if value { windowProbe.invalidate() }
    }

    func tick() {
        lock.lock()
        let now = ProcessInfo.processInfo.systemUptime
        guard now < armedUntil, now - lastEmit > 1.0 / 90.0 else {
            lock.unlock()
            return
        }
        lastEmit = now
        lock.unlock()
        let point = cursorPoint()
        emit("m \(point.x) \(point.y)")
        windowProbe.refresh(point, force: false)
    }
}

private let positions = PositionStream()

NSEvent.addGlobalMonitorForEvents(matching: .scrollWheel) { event in
    let precise = event.hasPreciseScrollingDeltas ? 1 : 0
    let point = cursorPoint()
    windowProbe.refresh(point, force: event.phase.contains(.began))
    emit("s \(event.scrollingDeltaY) \(event.phase.rawValue) \(event.momentumPhase.rawValue) \(precise) \(event.scrollingDeltaX) \(point.x) \(point.y)")
}

NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged, .rightMouseDragged]) { _ in
    positions.tick()
}

NotificationCenter.default.addObserver(
    forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
) { _ in
    windowProbe.invalidate()
    emit("scale \(NSScreen.main?.backingScaleFactor ?? 2.0)")
}
private let fingerStride = 96

// https://chromium.googlesource.com/chromiumos/platform/gestures/+/f9021145c74025829b14fb0c76b59d16d06d3752/src/immediate_interpreter.cc#1993
private let noiseFloorMove: Float = 0.010    // 1mm: below this nothing classifies
private let classifyMove: Float = 0.015      // 1.5mm: per-finger floor for the angle test
private let soloMove: Float = 0.040          // 4mm: one finger moving alone means scroll
private let certainMove: Float = 0.080       // 8mm: both fingers opposing locks pinch at once
private let scrollSeparationX: Float = 0.40  // 40mm: fingers this close default to...
private let scrollSeparationY: Float = 0.09  // 7mm:  ...scroll after the timeout
private let scrollDefaultAfter = 0.150       // seconds before close fingers mean scroll
private let reclassifyWindow = 0.300         // seconds a scroll may still become a pinch
private let pinchMaxCosine: Float = -0.4     // displacement vectors 113°+ apart
private let pinchMovementRatio: Float = 0.4  // slower finger must do 40% of faster one
private let jitterRatio: Float = 1.005       // min distance² change to emit
private let restingJitterRatio: Float = 1.05 // after 100ms idle or direction reversal
private let restingAfter = 0.100

private struct Contact {
    var id: Int32
    var x: Float
    var y: Float
}

private struct TouchTrack {
    enum Mode { case undecided, pinch, scroll }
    var mode: Mode
    var ids: (Int32, Int32)
    var startTime: Double
    var initial: (Contact, Contact)
    var emittedDistance: Float
    var lastEmitTime: Double
    var lastDirection: Float
}

private final class PinchState {
    let lock = NSLock()
    var track: [Int32: TouchTrack] = [:]
}
private let pinchState = PinchState()

private typealias MTContactCallback =
    @convention(c) (Int32, UnsafeMutableRawPointer?, Int32, Double, Int32) -> Int32

private let contactCallback: MTContactCallback = { device, data, fingerCount, timestamp, _ in
    guard let data else { return 0 }
    var contacts: [Contact] = []
    for i in 0..<Int(fingerCount) {
        let base = data.advanced(by: i * fingerStride)
        let phase = base.load(fromByteOffset: 20, as: Int32.self)
        let size = base.load(fromByteOffset: 48, as: Float.self)
        guard phase == 3 || phase == 4, size > 0.05 else { continue }
        contacts.append(Contact(
            id: base.load(fromByteOffset: 16, as: Int32.self),
            x: base.load(fromByteOffset: 32, as: Float.self),
            y: base.load(fromByteOffset: 36, as: Float.self)
        ))
    }
    pinchState.lock.lock()
    defer { pinchState.lock.unlock() }
    guard contacts.count == 2 else {
        pinchState.track[device] = nil
        return 0
    }
    contacts.sort { $0.id < $1.id }
    let (a, b) = (contacts[0], contacts[1])
    let distance = hypotf(a.x - b.x, a.y - b.y)
    guard var track = pinchState.track[device],
          track.ids == (a.id, b.id), distance > 0 else {
        pinchState.track[device] = TouchTrack(
            mode: .undecided, ids: (a.id, b.id), startTime: timestamp,
            initial: (a, b), emittedDistance: distance,
            lastEmitTime: timestamp, lastDirection: 0)
        return 0
    }
    defer { pinchState.track[device] = track }

    let canUpgrade = track.mode == .scroll
        && timestamp - track.startTime < reclassifyWindow
    if track.mode == .undecided || canUpgrade {
        classify(&track, a: a, b: b, timestamp: timestamp, distance: distance)
    }
    if track.mode == .pinch {
        emitPinch(&track, distance: distance, timestamp: timestamp)
    }
    return 0
}

private func classify(
    _ track: inout TouchTrack, a: Contact, b: Contact,
    timestamp: Double, distance: Float
) {
    let d0 = (x: a.x - track.initial.0.x, y: a.y - track.initial.0.y)
    let d1 = (x: b.x - track.initial.1.x, y: b.y - track.initial.1.y)
    let m0 = hypotf(d0.x, d0.y)
    let m1 = hypotf(d1.x, d1.y)
    if m0 < noiseFloorMove && m1 < noiseFloorMove { return }
    let dot = d0.x * d1.x + d0.y * d1.y
    var decision: TouchTrack.Mode = track.mode
    if m0 >= certainMove, m1 >= certainMove, dot < 0 {
        decision = .pinch
    } else if m0 >= classifyMove, m1 >= classifyMove {
        let cosine = dot / max(m0 * m1, 0.0001)
        if cosine > pinchMaxCosine {
            decision = .scroll
        } else if min(m0, m1) / max(m0, m1) >= pinchMovementRatio {
            decision = .pinch
        }
    } else if track.mode == .undecided {
        if max(m0, m1) >= soloMove, min(m0, m1) < classifyMove {
            decision = .scroll
        } else if timestamp - track.startTime > scrollDefaultAfter,
                  abs(a.x - b.x) < scrollSeparationX,
                  abs(a.y - b.y) < scrollSeparationY {
            decision = .scroll
        }
    }
    track.mode = decision
    if decision == .pinch {
        track.emittedDistance = distance
        track.lastEmitTime = timestamp
        track.lastDirection = 0
    }
}

private func emitPinch(_ track: inout TouchTrack, distance: Float, timestamp: Double) {
    guard track.emittedDistance > 0 else {
        track.emittedDistance = distance
        return
    }
    let distanceSq = distance * distance
    let emittedSq = track.emittedDistance * track.emittedDistance
    let direction: Float = distanceSq > emittedSq ? 1 : -1
    var threshold = jitterRatio
    if timestamp - track.lastEmitTime > restingAfter { threshold = restingJitterRatio }
    if track.lastDirection != 0, direction != track.lastDirection {
        threshold = max(threshold, restingJitterRatio)
    }
    guard distanceSq > emittedSq * threshold || distanceSq * threshold < emittedSq else {
        return
    }
    let point = cursorPoint()
    emit("z \(distance / track.emittedDistance - 1) \(point.x) \(point.y)")
    track.emittedDistance = distance
    track.lastEmitTime = timestamp
    track.lastDirection = direction
}

private final class MultitouchPinch {
    private typealias CreateListFn = @convention(c) () -> Unmanaged<CFArray
```

### Core Architecture Module: `pixel/engine/crates/pixel-core/src/canvas.rs`
```
use crate::surfaces::{OpaqueArea, Rect};
use crate::text_input::{MARK_CHAR, Mark, mark_advance_at};

#[derive(Clone, Copy)]
pub struct Frame<'a> {
    pub canvas: &'a Canvas,
    pub premultiplied: bool,
    pub changed: &'a [Rect],
    pub repainted: &'a [Rect],
    pub opaque: &'a [OpaqueArea],
    pub ui_over_surfaces: &'a [Rect],
}

type GlyphKey = (usize, char, u32);
type GlyphCache = std::collections::HashMap<GlyphKey, (fontdue::Metrics, Vec<u8>)>;
std::thread_local! {
    static GLYPH_CACHE: std::cell::RefCell<GlyphCache> = std::cell::RefCell::new(GlyphCache::new());
    static ADVANCE_CACHE: std::cell::RefCell<std::collections::HashMap<GlyphKey, f32>> =
        std::cell::RefCell::new(std::collections::HashMap::new());
    static LAST_RESAMPLE: std::cell::Cell<Option<(u32, u32, u32, u32)>> =
        const { std::cell::Cell::new(None) };
}

fn corner_insets(radius: [f32; 4], row: i64, height: i64) -> (i64, i64) {
    if radius == [0.0; 4] {
        return (0, 0);
    }
    let dy_top = row as f32 + 0.5;
    let dy_bottom = (height - 1 - row) as f32 + 0.5;
    let inset = |r: f32, dy: f32| -> i64 {
        if r <= 0.0 || dy >= r {
            0
        } else {
            let reach = r - dy;
            (r - (r * r - reach * reach).sqrt()).ceil() as i64
        }
    };
    (
        inset(radius[0], dy_top).max(inset(radius[3], dy_bottom)),
        inset(radius[1], dy_top).max(inset(radius[2], dy_bottom)),
    )
}

#[derive(Default)]
pub(crate) struct CanvasStats {
    pub boxes: std::cell::Cell<u64>,
    pub boxes_clipped_out: std::cell::Cell<u64>,
    pub paths: std::cell::Cell<u64>,
    pub paths_clipped: std::cell::Cell<u64>,
}

std::thread_local! {
    static STATS: CanvasStats = CanvasStats::default();
}

fn tally(pick: impl Fn(&CanvasStats) -> &std::cell::Cell<u64>) {
    STATS.with(|s| {
        let cell = pick(s);
        cell.set(cell.get() + 1);
    });
}

pub(crate) fn take_canvas_stats() -> (u64, u64, u64, u64) {
    STATS.with(|s| {
        (
            s.boxes.take(),
            s.boxes_clipped_out.take(),
            s.paths.take(),
            s.paths_clipped.take(),
        )
    })
}

fn subtract_rect(
    (fx1, fy1, fx2, fy2): (u32, u32, u32, u32),
    (hx1, hy1, hx2, hy2): (u32, u32, u32, u32),
    out: &mut Vec<(u32, u32, u32, u32)>,
) {
    if hx2 <= fx1 || hx1 >= fx2 || hy2 <= fy1 || hy1 >= fy2 {
        out.push((fx1, fy1, fx2, fy2));
        return;
    }
    if fy1 < hy1 {
        out.push((fx1, fy1, fx2, hy1));
    }
    if hy2 < fy2 {
        out.push((fx1, hy2, fx2, fy2));
    }
    let my1 = fy1.max(hy1);
    let my2 = fy2.min(hy2);
    if fx1 < hx1 {
        out.push((fx1, my1, hx1, my2));
    }
    if hx2 < fx2 {
        out.push((hx2, my1, fx2, my2));
    }
}

fn solid_paint(color: [u8; 4]) -> tiny_skia::Paint<'static> {
    let mut paint = tiny_skia::Paint::default();
    paint.set_color_rgba8(color[0], color[1], color[2], color[3]);
    paint.anti_alias = true;
    paint
}

fn blend_pixel(dst: &mut [u8], src: &[u8], alpha: u8) {
    let inv = 255 - u32::from(alpha);
    for (d, &s) in dst.iter_mut().zip(src) {
        *d = (u32::from(s) + (u32::from(*d) * inv + 127) / 255).min(255) as u8;
    }
}

fn blend_row(dst: &mut [u8], src: &[u8]) {
    if src.chunks_exact(4).all(|s| s[3] == 255) {
        dst.copy_from_slice(src);
        return;
    }
    for (dst, s) in dst.chunks_exact_mut(4).zip(src.chunks_exact(4)) {
        match s[3] {
            255 => dst.copy_from_slice(s),
            0 => {}
            alpha => blend_pixel(dst, s, alpha),
        }
    }
}

pub struct Canvas {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
    clip_stack: Vec<(u32, u32, u32, u32)>,
    occluders: Vec<(u32, (f32, f32, f32, f32))>,
    next_occluder: u32,
    scratch: Vec<u8>,
}

impl Canvas {
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            pixels: vec![0; (width * height * 4) as usize],
            clip_stack: Vec::new(),
            occluders: Vec::new(),
            next_occluder: 0,
            scratch: Vec::new(),
        }
    }

    pub fn from_rgba(pixels: Vec<u8>, width: u32, height: u32) -> Self {
        debug_assert_eq!(pixels.len(), (width * height * 4) as usize);
        Self {
            width,
            height,
            pixels,
            clip_stack: Vec::new(),
            occluders: Vec::new(),
            next_occluder: 0,
            scratch: Vec::new(),
        }
    }

    pub fn push_clip(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let (cx1, cy1, cx2, cy2) = self.clip_bounds();
        let x1 = (x.round().max(0.0) as u32).clamp(cx1, cx2);
        let y1 = (y.round().max(0.0) as u32).clamp(cy1, cy2);
        let x2 = ((x + w).round().max(0.0) as u32).clamp(x1, cx2);
        let y2 = ((y + h).round().max(0.0) as u32).clamp(y1, cy2);
        self.clip_stack.push((x1, y1, x2, y2));
    }

    pub fn pop_clip(&mut self) {
        self.clip_stack.pop();
    }

    pub fn add_occluder(&mut self, x: f32, y: f32, w: f32, h: f32) -> u32 {
        let token = self.next_occluder;
        self.next_occluder += 1;
        self.occluders.push((token, (x, y, w, h)));
        token
    }

    pub fn remove_occluder(&mut self, token: u32) {
        self.occluders.retain(|(t, _)| *t != token);
    }

    pub fn clear_occluders(&mut self) {
        self.occluders.clear();
    }

    fn occluded(&self, x: f32, y: f32, w: f32, h: f32) -> bool {
        let inside = self
            .occluders
            .iter()
            .any(|&(_, (ox, oy, ow, oh))| x >= ox && y >= oy && x + w <= ox + ow && y + h <= oy + oh);
        if inside {
            tally(|s| &s.boxes_clipped_out);
        }
        inside
    }

    fn clip_bounds(&self) -> (u32, u32, u32, u32) {
        self.clip_stack
            .last()
            .copied()
            .unwrap_or((0, 0, self.width, self.height))
    }

    // weird impl, but its a fast way to fill an array to a given color without allocating memory beforehand
    pub fn fill(&mut self, color: [u8; 4]) {
        if self.pixels.is_empty() {
            return;
        }
        self.pixels[..4].copy_from_slice(&color);
        let mut filled = 4;
        while filled < self.pixels.len() {
            let (done, rest) = self.pixels.split_at_mut(filled);
            let n = done.len().min(rest.len());
            rest[..n].copy_from_slice(&done[..n]);
            filled += n;
        }
    }

    pub fn fill_rect(&mut self, x: u32, y: u32, w: u32, h: u32, color: [u8; 4]) {
        for (fx1, fy1, fx2, fy2) in self.rect_fragments(x, y, w, h) {
            self.fill_rows(fx1, fy1, fx2, fy2, color);
        }
    }

    fn blend_rect(&mut self, x: u32, y: u32, w: u32, h: u32, color: [u8; 4]) {
        let alpha = color[3];
        let premultiplied = [
            ((u32::from(color[0]) * u32::from(alpha) + 127) / 255) as u8,
            ((u32::from(color[1]) * u32::from(alpha) + 127) / 255) as u8,
            ((u32::from(color[2]) * u32::from(alpha) + 127) / 255) as u8,
            alpha,
        ];
        for (fx1, fy1, fx2, fy2) in self.rect_fragments(x, y, w, h) {
            let row_len = ((fx2 - fx1) * 4) as usize;
            for row in fy1..fy2 {
                let start = ((row * self.width + fx1) * 4) as usize;
                for px in self.pixels[start..start + row_len].chunks_exact_mut(4) {
                    blend_pixel(px, &premultiplied, alpha);
                }
            }
        }
    }

    fn rect_fragments(&mut self, x: u32, y: u32, w: u32, h: u32) -> Vec<(u32, u32, u32, u32)> {
        let (cx1, cy1, cx2, cy2) = self.clip_bounds();
        let x1 = x.clamp(cx1, cx2);
        let y1 = y.clamp(cy1, cy2);
        let x2 = x.saturating_add(w).clamp(x1, cx2);
        let y2 = y.saturating_add(h).clamp(y1, cy2);
        if x2 <= x1 || y2 <= y1 {
            return Vec::new();
        }

        let mut fragments = vec![(x1, y1, x2, y2)];
        if !self.occluders.is_empty() {
            let mut split = Vec::new();
            for &(_, (ox, oy, ow, oh)) in &self.occluders {
                let hole = (
                    ox.ceil().max(0.0) as u32,
                    oy.ceil().max(0.0) as u32,
                    (ox + ow).floor().max(0.0) as u32,
                    (oy + oh).floor().max(0.0) as u32,
                );
                for fragment in fragments.drain(..) {
                    subtract_rect(fragment, hole, &mut split);
                }
                std::mem::swap(&mut fragments, &mut split);
            }
            if fragments != [(x1, y1, x2, y2)] {
                tally(|s| &s.boxes_clipped_out);
            }
        }
        fragments
    }

    fn fill_rows(&mut self, x1: u32, y1: u32, x2: u32, y2: u32, color: [u8; 4]) {
        let first = ((y1 * self.width + x1) * 4) as usize;
        let row_len = ((x2 - x1) * 4) as usize;
        for px in self.pixels[first..first + row_len].chunks_exact_mut(4) {
            px.copy_from_slice(&color);
        }
        let template = self.pixels[first..first + row_len].to_vec();
        for row in y1 + 1..y2 {
            let start = ((row * self.width + x1) * 4) as usize;
            self.pixels[start..start + row_len].copy_from_slice(&template);
        }
    }

    pub fn draw_text(
        &mut self,
        font: &fontdue::Font,
        text: &str,
        x: i32,
        baseline: i32,
        px: f32,
        color: [u8; 4],
    ) {
        self.draw_text_sheared(font, text, x, baseline, px, color, 0.0);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn draw_text_sheared(
        &mut self,
        font: &fontdue::Font,
        text: &str,
        x: i32,
        baseline: i32,
        px: f32,
        color: [u8; 4],
        shear: f32,
    ) {
        self.draw_marked_sheared(
            font,
            text,
            0..text.len(),
            x,
            baseline,
            px,
            color,
            &[],
            shea
```

### Core Architecture Module: `pixel/engine/crates/pixel-core/src/clipboard_image.rs`
```
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PasteSource {
    Clipboard,
    Osc,
    File,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PastedImage {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub source: PasteSource,
}

static NEXT_ID: AtomicU64 = AtomicU64::new(0);

pub(crate) fn temp_path(ext: &str) -> PathBuf {
    let dir = std::env::temp_dir().join("pixel-attachments");
    let _ = std::fs::create_dir_all(&dir);
    let n = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    dir.join(format!("paste-{}-{n}.{ext}", std::process::id()))
}

fn dims(path: &Path) -> Option<(u32, u32)> {
    image::ImageReader::open(path)
        .ok()?
        .with_guessed_format()
        .ok()?
        .into_dimensions()
        .ok()
}

fn from_file(path: &Path, source: PasteSource) -> Option<PastedImage> {
    let (width, height) = dims(path)?;
    Some(PastedImage {
        path: path.to_string_lossy().into_owned(),
        width,
        height,
        source,
    })
}

pub(crate) enum WorkerPaste {
    File(PastedImage),
    Bitmap {
        pasted: PastedImage,
        rgba: image::RgbaImage,
    },
}

pub(crate) fn read_for_worker() -> Option<WorkerPaste> {
    let mut clipboard = arboard::Clipboard::new().ok()?;
    if let Ok(files) = clipboard.get().file_list()
        && let Some(pasted) = files.iter().find_map(|f| from_file(f, PasteSource::Clipboard))
    {
        return Some(WorkerPaste::File(pasted));
    }
    let img = clipboard.get_image().ok()?;
    let rgba = image::RgbaImage::from_raw(
        img.width as u32,
        img.height as u32,
        img.bytes.into_owned(),
    )?;
    let (width, height) = rgba.dimensions();
    let pasted = PastedImage {
        path: temp_path("png").to_string_lossy().into_owned(),
        width,
        height,
        source: PasteSource::Clipboard,
    };
    Some(WorkerPaste::Bitmap { pasted, rgba })
}

pub fn image_path_from_paste(text: &str) -> Option<PastedImage> {
    let trimmed = text.trim();
    if trimmed.is_empty() || trimmed.contains('\n') {
        return None;
    }
    let unquoted = trimmed.trim_matches(|c| c == '\'' || c == '"');
    let path = match unquoted.strip_prefix("file://") {
        Some(rest) => percent_decode(rest),
        None => unescape(unquoted),
    };
    if !path.starts_with('/') && !path.starts_with('~') {
        return None;
    }
    let path = match path.strip_prefix("~/") {
        Some(rest) => Path::new(&std::env::var("HOME").ok()?).join(rest),
        None => PathBuf::from(path),
    };
    if !path.is_file() {
        return None;
    }
    from_file(&path, PasteSource::File)
}

fn unescape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(next) = chars.next() {
                out.push(next);
            }
        } else {
            out.push(c);
        }
    }
    out
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let decoded = (bytes[i] == b'%' && i + 2 < bytes.len())
            .then(|| u8::from_str_radix(&s[i + 1..i + 3], 16).ok())
            .flatten();
        match decoded {
            Some(byte) => {
                out.push(byte);
                i += 3;
            }
            None => {
                out.push(bytes[i]);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pixel-clipboard-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn temp_png(name: &str) -> PathBuf {
        let path = temp_dir().join(name);
        image::RgbaImage::from_pixel(6, 4, image::Rgba([1, 2, 3, 255]))
            .save(&path)
            .unwrap();
        path
    }

    #[test]
    fn plain_path_paste_detects_an_image() {
        let path = temp_png("plain.png");
        let pasted = image_path_from_paste(&path.to_string_lossy()).unwrap();
        assert_eq!((pasted.width, pasted.height), (6, 4));
    }

    #[test]
    fn quoted_escaped_and_file_url_paths_normalize() {
        let path = temp_png("with space.png");
        let raw = path.to_string_lossy();
        assert!(image_path_from_paste(&format!("'{raw}'")).is_some());
        assert!(image_path_from_paste(&raw.replace(' ', "\\ ")).is_some());
        let url = format!("file://{}", raw.replace(' ', "%20"));
        assert!(image_path_from_paste(&url).is_some());
    }

    #[test]
    fn ordinary_text_and_non_image_files_are_rejected() {
        assert!(image_path_from_paste("hello world").is_none());
        assert!(image_path_from_paste("/does/not/exist.png").is_none());
        assert!(image_path_from_paste("one\n/two.png").is_none());
        let path = temp_dir().join("notes.txt");
        std::fs::write(&path, "just text").unwrap();
        assert!(image_path_from_paste(&path.to_string_lossy()).is_none());
    }
}

```

### Core Architecture Module: `pixel/engine/crates/pixel-core/src/desc.rs`
```
use crate::style::Style;
use crate::tree::{ImageProps, InputProps, NodeId, Props, SlotKind, Tree};

#[derive(Default)]
pub struct Desc {
    pub style: Style,
    pub text: Option<String>,
    pub key: Option<String>,
    pub clickable: bool,
    pub input: Option<InputProps>,
    pub image: Option<ImageProps>,
    pub surface: Option<u32>,
    pub slot: Option<SlotKind>,
    pub content_height: Option<f32>,
    pub scroll_events: bool,
    pub wheel_events: bool,
    pub children: Vec<Desc>,
}

impl Desc {
    pub(crate) fn props(&self) -> Props {
        Props {
            style: self.style.clone(),
            text: self.text.clone(),
            key: self.key.clone(),
            clickable: self.clickable,
            hidden: false,
            input: self.input.clone(),
            image: self.image.clone(),
            surface: self.surface,
            slot: self.slot,
            mark: None,
            marks: Vec::new(),
            content_height: self.content_height,
            shape: None,
            scroll_events: self.scroll_events,
            wheel_events: self.wheel_events,
            pointer_events: false,
            hover_events: false,
            outside_click_events: false,
            drag_events: false,
            selection_events: false,
            move_events: false,
            spans: Vec::new(),
        }
    }

    fn reusable(&self, tree: &Tree, id: NodeId) -> bool {
        tree.get(id)
            .is_some_and(|node| node.input.is_some() == self.input.is_some())
    }
}

impl Tree {
    pub fn mount(&mut self, parent: NodeId, desc: Desc) -> NodeId {
        let id = self.create(desc.props());
        self.append(parent, id);
        for child in desc.children {
            self.mount(id, child);
        }
        id
    }

    pub fn reconcile(&mut self, desc: Desc) {
        crate::profiler::span("tree.reconcile", || {
            let root = self.root();
            let mut props = desc.props();
            if let Some(node) = self.get(root) {
                props.style.width = node.style.width;
                props.style.height = node.style.height;
            }
            self.update(root, props);
            self.reconcile_children(root, desc.children);
        });
    }

    fn reconcile_node(&mut self, id: NodeId, desc: Desc) {
        self.update(id, desc.props());
        self.reconcile_children(id, desc.children);
    }

    fn reconcile_children(&mut self, parent: NodeId, descs: Vec<Desc>) {
        let old = self.children(parent).to_vec();
        let mut used = vec![false; old.len()];
        let mut result: Vec<(NodeId, Desc)> = Vec::with_capacity(descs.len());

        for desc in descs {
            let found = match &desc.key {
                Some(key) => old.iter().enumerate().position(|(i, &c)| {
                    !used[i] && self.key_of(c) == Some(key.as_str()) && desc.reusable(self, c)
                }),
                None => old.iter().enumerate().position(|(i, &c)| {
                    !used[i] && self.key_of(c).is_none() && desc.reusable(self, c)
                }),
            };
            let id = match found {
                Some(i) => {
                    used[i] = true;
                    old[i]
                }
                None => self.create(desc.props()),
            };
            result.push((id, desc));
        }

        for (i, &id) in old.iter().enumerate() {
            if !used[i] {
                self.remove(id);
            }
        }

        let target: Vec<NodeId> = result.iter().map(|(id, _)| *id).collect();
        if self.children(parent) != target.as_slice() {
            for &id in &target {
                self.append(parent, id);
            }
        }

        for (id, desc) in result {
            self.reconcile_node(id, desc);
        }
    }
}

```

### Core Architecture Module: `pixel/engine/crates/pixel-core/src/engine/clipboard.rs`
```
use std::io;
use std::time::{Duration, Instant};

use super::EngineEvent;
use crate::clipboard_image::PastedImage;
use crate::logging;
use crate::terminal::Terminal;
use crate::text_input::MARK_CHAR;
use crate::tree::NodeId;

pub const MARK_TOKEN_OPEN: char = '⟦';
pub const MARK_TOKEN_CLOSE: char = '⟧';

/**
 * meh this is not great, the mime type we prefer in the clipboard
 */
const PASTE_IMAGE_MIMES: [(&str, &str); 4] = [
    ("image/png", "png"),
    ("image/jpeg", "jpg"),
    ("image/gif", "gif"),
    ("image/webp", "webp"),
];

struct OscPaste {
    view: usize,
    node: NodeId,
    stage: OscPasteStage,
    deadline: Instant,
}

enum OscPasteStage {
    Types,
    Data { ext: &'static str },
}

struct RichClip {
    token: u64,
    text: String,
    slots: Vec<RichSlot>,
}

struct RichSlot {
    offset: usize,
    data: Option<String>,
}

fn enrich_clipboard_text(text: &str, slots: &[RichSlot]) -> Option<String> {
    if !slots.iter().any(|s| s.data.is_some()) {
        return None;
    }
    let mut out = String::with_capacity(text.len() * 2);
    for (i, ch) in text.char_indices() {
        if ch == MARK_CHAR {
            let data = slots
                .iter()
                .find(|s| s.offset == i)
                .and_then(|s| s.data.as_deref());
            if let Some(data) = data {
                out.push(MARK_TOKEN_OPEN);
                out.push_str(data);
                out.push(MARK_TOKEN_CLOSE);
            }
        } else {
            out.push(ch);
        }
    }
    Some(out)
}

pub(super) fn parse_rich_paste(text: &str) -> Option<(String, Vec<(usize, String)>)> {
    if !text.contains(MARK_TOKEN_OPEN) {
        return None;
    }
    let mut out = String::with_capacity(text.len());
    let mut marks = Vec::new();
    let mut rest = text;
    loop {
        let Some(open) = rest.find(MARK_TOKEN_OPEN) else {
            out.push_str(rest);
            break;
        };
        let after = &rest[open + MARK_TOKEN_OPEN.len_utf8()..];
        let Some(close) = after.find(MARK_TOKEN_CLOSE) else {
            out.push_str(&rest[..open + MARK_TOKEN_OPEN.len_utf8()]);
            rest = after;
            continue;
        };
        out.push_str(&rest[..open]);
        marks.push((out.len(), after[..close].to_string()));
        out.push(MARK_CHAR);
        rest = &after[close + MARK_TOKEN_CLOSE.len_utf8()..];
    }
    (!marks.is_empty()).then_some((out, marks))
}

fn request_text_clipboard(term: &mut Terminal) {
    if let Err(error) = term.request_clipboard() {
        logging::warn("engine", format!("clipboard request failed: {error}"));
    }
}

pub(super) struct ClipboardFlows {
    rich: Option<RichClip>,
    rich_token: u64,
    osc: Option<OscPaste>,
    pending_pastes: Vec<(u64, usize, NodeId)>,
}

impl ClipboardFlows {
    pub fn new() -> Self {
        Self {
            rich: None,
            rich_token: 0,
            osc: None,
            pending_pastes: Vec::new(),
        }
    }

    pub fn begin_rich_capture(
        &mut self,
        term: &mut Terminal,
        view: usize,
        text: String,
        marks: Vec<(NodeId, crate::text_input::Mark)>,
    ) -> io::Result<Option<EngineEvent>> {
        let projection: String = text.chars().filter(|&c| c != MARK_CHAR).collect();
        term.set_clipboard(&projection)?;
        if marks.is_empty() {
            self.rich = None;
            return Ok(None);
        }
        self.rich_token += 1;
        let slots = marks
            .iter()
            .map(|(_, m)| RichSlot {
                offset: m.offset,
                data: m.data.clone(),
            })
            .collect();
        let request = marks
            .iter()
            .enumerate()
            .map(|(index, (node, m))| (*node, m.id, index))
            .collect();
        self.rich = Some(RichClip {
            token: self.rich_token,
            text,
            slots,
        });
        Ok(Some(EngineEvent::SerializeMarks {
            view,
            token: self.rich_token,
            marks: request,
        }))
    }

    pub fn attach_rich(&mut self, term: &mut Terminal, token: u64, marks: Vec<(usize, String)>) {
        let Some(rich) = self.rich.as_mut().filter(|r| r.token == token) else {
            return;
        };
        for (index, data) in marks {
            if let Some(slot) = rich.slots.get_mut(index) {
                slot.data = Some(data);
            }
        }
        let rich = self.rich.take().expect("checked above");
        if let Some(enriched) = enrich_clipboard_text(&rich.text, &rich.slots)
            && let Err(error) = term.set_clipboard(&enriched)
        {
            logging::warn("engine", format!("clipboard write failed: {error}"));
        }
    }

    pub fn request_paste(&mut self, view: usize, node: NodeId) {
        let seq = crate::image_cache::queue_clipboard_read();
        self.pending_pastes.push((seq, view, node));
    }

    pub fn resolve_pastes(
        &mut self,
        term: &mut Terminal,
        pastes: Vec<(u64, Option<PastedImage>)>,
    ) -> Vec<(usize, NodeId, PastedImage)> {
        let mut delivered = Vec::new();
        for (seq, pasted) in pastes {
            let Some(i) = self.pending_pastes.iter().position(|(s, ..)| *s == seq) else {
                continue;
            };
            let (_, view, node) = self.pending_pastes.remove(i);
            match pasted {
                Some(image) => delivered.push((view, node, image)),
                None => {
                    if self.osc.is_none()
                        && term.clipboard_data_supported()
                        && term.request_clipboard_types().is_ok()
                    {
                        self.osc = Some(OscPaste {
                            view,
                            node,
                            stage: OscPasteStage::Types,
                            deadline: Instant::now() + Duration::from_secs(3),
                        });
                    } else {
                        request_text_clipboard(term);
                    }
                }
            }
        }
        if let Some(paste) = &self.osc
            && Instant::now() > paste.deadline
        {
            self.osc = None;
            request_text_clipboard(term);
        }
        delivered
    }

    pub fn handle_clipboard_data(
        &mut self,
        term: &mut Terminal,
        items: Vec<(String, Vec<u8>)>,
        ok: bool,
    ) {
        let Some(paste) = self.osc.take() else {
            return;
        };
        if !ok {
            request_text_clipboard(term);
            return;
        }
        match paste.stage {
            OscPasteStage::Types => {
                let offered = items
                    .iter()
                    .find(|(mime, _)| mime == "." || mime.is_empty())
                    .map(|(_, data)| String::from_utf8_lossy(data).into_owned())
                    .unwrap_or_default();
                let pick = PASTE_IMAGE_MIMES
                    .iter()
                    .find(|(mime, _)| offered.split_whitespace().any(|o| o == *mime));
                match pick {
                    Some(&(mime, ext)) if term.request_clipboard_data(mime).is_ok() => {
                        self.osc = Some(OscPaste {
                            stage: OscPasteStage::Data { ext },
                            deadline: Instant::now() + Duration::from_secs(20),
                            ..paste
                        });
                    }
                    _ => request_text_clipboard(term),
                }
            }
            OscPasteStage::Data { ext } => {
                let data = items
                    .into_iter()
                    .find(|(mime, data)| mime.starts_with("image/") && !data.is_empty())
                    .map(|(_, data)| data);
                match data {
                    Some(data) => {
                        let seq = crate::image_cache::queue_pasted_bytes(
                            data,
                            ext,
                            crate::clipboard_image::PasteSource::Osc,
                        );
                        self.pending_pastes.push((seq, paste.view, paste.node));
                    }
                    None => request_text_clipboard(term),
                }
            }
        }
    }

    pub fn osc_deadline(&self) -> Option<Instant> {
        self.osc.as_ref().map(|paste| paste.deadline)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enrich_inlines_data_and_strips_dataless_sentinels() {
        let m = MARK_CHAR;
        let text = format!("a{m}b{m}c");
        let slots = vec![
            RichSlot {
                offset: 1,
                data: Some("one".into()),
            },
            RichSlot {
                offset: 1 + m.len_utf8() + 1,
                data: None,
            },
        ];
        assert_eq!(
            enrich_clipboard_text(&text, &slots).unwrap(),
            format!("a{MARK_TOKEN_OPEN}one{MARK_TOKEN_CLOSE}bc")
        );
        let none = vec![RichSlot {
            offset: 1,
            data: None,
        }];
        assert!(enrich_clipboard_text(&text, &none).is_none());
    }

    #[test]
    fn parse_round_trips_and_tolerates_unmatched_delimiters() {
        let m = MARK_CHAR;
        let pasted = format!("x{MARK_TOKEN_OPEN}one{MARK_TOKEN_CLOSE}y{MARK_TOKEN_OPEN}two{MARK_TOKEN_CLOSE}");
        let (text, marks) = parse_rich_paste(&pasted).unwrap();
        assert_eq!(text, format!("x{m}y{m}"));
        assert_eq!(marks, vec![(1, "one".into()), (2 + m.len_utf8(), "two".into())]);

        assert!(parse_rich_paste("plain text").is_none());
        let unmatched = format!("a{MARK_TOKEN_OPEN}never closed");
        assert!(parse_rich_paste(&unmatched).is_none(), "unmatched keeps text plain");
    }
}

```

### Core Architecture Module: `pixel/engine/crates/pixel-core/src/engine/compositor.rs`
```
use crate::canvas::Canvas;
use crate::style::Color;
use crate::surfaces::Rect;
use crate::tree::Tree;

const DIVIDER_W: u32 = 6;
const DIVIDER_GRAB: f32 = 5.0;
const MIN_PANE: u32 = 160;

const DIVIDER_BG: Color = [32, 33, 38, 255];
const DIVIDER_BG_ACTIVE: Color = [58, 96, 168, 255];
const DIVIDER_GRIP: Color = [118, 122, 132, 255];

pub struct View {
    pub tree: Tree,
    pub canvas: Canvas,
    pub clear_color: Color,
    pub origin_x: u32,
    pub size: (u32, u32),
    pub damage_parts: Vec<Rect>,
    pub opaque: Vec<crate::surfaces::OpaqueArea>,
    pub ui_over_surfaces: Vec<Rect>,
}

impl View {
    fn new(window: (u32, u32)) -> Self {
        Self {
            tree: Tree::new((window.0 as f32, window.1 as f32)),
            canvas: Canvas::new(window.0, window.1),
            clear_color: [0, 0, 0, 0],
            origin_x: 0,
            size: window,
            damage_parts: Vec::new(),
            opaque: Vec::new(),
            ui_over_surfaces: Vec::new(),
        }
    }

    pub(crate) fn add_damage(&mut self, rect: Rect) {
        self.damage_parts.push(rect);
    }

    fn contains(&self, x: f32) -> bool {
        x >= self.origin_x as f32 && x < (self.origin_x + self.size.0) as f32
    }
}

pub struct Compositor {
    pub views: Vec<View>,
    pub window: (u32, u32),
    pub frame: Canvas,
    pub dirty: bool,
    pub divider_drag: bool,
    pub split: Option<f32>,
    pub relayout: bool,
    pub opaque: Vec<crate::surfaces::OpaqueArea>,
    pub ui_over_surfaces: Vec<Rect>,
    changed: Vec<Rect>,
    repainted: Vec<Rect>,
    direct: Option<usize>,
    panes: [usize; 2],
    divider_hover: bool,
    last_divider: Option<(u32, bool)>,
}

impl Compositor {
    pub(crate) fn new(window: (u32, u32)) -> Self {
        Self {
            views: vec![View::new(window), View::new((0, 0))],
            window,
            frame: Canvas::new(window.0, window.1),
            dirty: true,
            divider_drag: false,
            split: None,
            relayout: true,
            opaque: Vec::new(),
            ui_over_surfaces: Vec::new(),
            changed: Vec::new(),
            repainted: Vec::new(),
            direct: None,
            panes: [0, 1],
            divider_hover: false,
            last_divider: None,
        }
    }

    pub(crate) fn add_view(&mut self) -> usize {
        self.views.push(View::new((0, 0)));
        self.views.len() - 1
    }

    pub(crate) fn set_split(&mut self, split: Option<f32>) -> bool {
        let split = split.map(|f| f.clamp(0.15, 0.85));
        if self.split == split {
            return false;
        }
        self.split = split;
        true
    }

    pub(crate) fn set_pane(&mut self, slot: usize, view: usize) -> bool {
        if slot >= self.panes.len() || view >= self.views.len() {
            return false;
        }
        let other = self.panes[1 - slot];
        if self.panes[slot] == view || other == view {
            return false;
        }
        self.panes[slot] = view;
        true
    }

    pub(crate) fn active_views(&self) -> Vec<usize> {
        if self.split.is_some() {
            vec![self.panes[0], self.panes[1]]
        } else {
            vec![self.panes[0]]
        }
    }

    pub(crate) fn is_active(&self, view: usize) -> bool {
        self.active_views().contains(&view)
    }

    pub(crate) fn view_at(&self, x: f32) -> usize {
        if self.split.is_some() && self.views[self.panes[1]].contains(x) {
            self.panes[1]
        } else {
            self.panes[0]
        }
    }

    pub(crate) fn to_local(&self, view: usize, point: (f32, f32)) -> (f32, f32) {
        (point.0 - self.views[view].origin_x as f32, point.1)
    }

    pub(crate) fn divider_x(&self) -> Option<u32> {
        let f = self.split?;
        let w = self.window.0;
        if w <= 2 * MIN_PANE + DIVIDER_W {
            return Some(w.saturating_sub(DIVIDER_W) / 2);
        }
        let x = (w as f32 * f).round() as u32;
        Some(x.clamp(MIN_PANE, w - MIN_PANE - DIVIDER_W))
    }

    pub(crate) fn on_divider(&self, x: f32) -> bool {
        self.divider_x().is_some_and(|dx| {
            x >= dx as f32 - DIVIDER_GRAB && x < (dx + DIVIDER_W) as f32 + DIVIDER_GRAB
        })
    }

    pub(crate) fn set_divider_hover(&mut self, on: bool) {
        if self.divider_hover != on {
            self.divider_hover = on;
            self.dirty = true;
        }
    }

    pub(crate) fn apply_layout(&mut self, force: bool) -> Vec<(usize, (u32, u32))> {
        let (w, h) = self.window;
        let rects: [(u32, u32); 2] = match self.divider_x() {
            Some(dx) => [(0, dx), (dx + DIVIDER_W, w.saturating_sub(dx + DIVIDER_W))],
            None => [(0, w), (0, 0)],
        };
        let active = self.active_views();
        let mut resized = Vec::new();
        for (slot, (origin, width)) in rects.iter().enumerate() {
            let index = self.panes[slot];
            let view = &mut self.views[index];
            let size = (*width, h);
            let changed = force || view.size != size || view.origin_x != *origin;
            view.origin_x = *origin;
            view.size = size;
            if !changed || !active.contains(&index) {
                continue;
            }
            view.tree.set_window((size.0 as f32, size.1 as f32));
            resized.push((index, size));
        }
        self.dirty = true;
        self.relayout = true;
        resized
    }

    pub(crate) fn drag_divider(&mut self, x: f32) -> Vec<(usize, (u32, u32))> {
        let w = self.window.0.max(1) as f32;
        let f = (x / w).clamp(0.15, 0.85);
        if self.split == Some(f) {
            return Vec::new();
        }
        self.split = Some(f);
        self.apply_layout(false)
    }

    pub(crate) fn compose(&mut self, painted: &[Painted], whole_frame: bool, direct: bool) {
        let resized = (self.frame.width, self.frame.height) != self.window;
        if resized {
            self.frame = Canvas::new(self.window.0, self.window.1);
        }
        let everything = resized || whole_frame || std::mem::take(&mut self.relayout);
        let active = self.active_views();
        let alone = active.len() == 1
            && self.views[active[0]].origin_x == 0
            && self.views[active[0]].size == self.window
            && !everything
            && direct;
        self.direct = alone.then(|| active[0]);
        self.changed.clear();
        self.repainted.clear();
        let mut divider = None;
        if !alone {
            for &view in &active {
                let size = self.views[view].size;
                let origin = self.views[view].origin_x;
                let straighten = self.views[view].clear_color[3] < 255;
                let (canvas, frame) = (&self.views[view].canvas, &mut self.frame);
                if everything {
                    blit(frame, canvas, origin, Rect::sized(size.0, size.1), straighten);
                    continue;
                }
                let Some(p) = painted.iter().find(|p| p.view == view) else {
                    continue;
                };
                crate::profiler::count("compose.px", || p.parts.iter().map(|r| r.area()).sum());
                for part in &p.parts {
                    blit(frame, canvas, origin, *part, straighten);
                }
            }
            divider = self.draw_divider();
        }
        self.collect_opaque();
        let (width, height) = (self.frame.width, self.frame.height);
        if everything {
            self.repainted.push(Rect::sized(width, height));
            return;
        }
        for p in painted {
            let origin = self.views[p.view].origin_x;
            let moved = |part: &Rect| Rect { x: part.x + origin, ..*part }.clamped(width, height);
            if p.whole {
                let size = self.views[p.view].size;
                self.repainted.push(moved(&Rect::sized(size.0, size.1)));
                self.changed.extend(p.surface_parts.iter().map(moved).filter(|r| !r.is_empty()));
            } else {
                self.changed.extend(p.parts.iter().map(moved).filter(|r| !r.is_empty()));
            }
        }
        self.changed.extend(divider);
    }

    pub(crate) fn frame(&self) -> crate::canvas::Frame<'_> {
        crate::canvas::Frame {
            canvas: self.direct.map_or(&self.frame, |view| &self.views[view].canvas),
            premultiplied: self.direct.is_some(),
            changed: &self.changed,
            repainted: &self.repainted,
            opaque: &self.opaque,
            ui_over_surfaces: &self.ui_over_surfaces,
        }
    }

    fn collect_opaque(&mut self) {
        self.opaque.clear();
        self.ui_over_surfaces.clear();
        for view in self.active_views() {
            let origin = self.views[view].origin_x;
            for area in &self.views[view].opaque {
                let moved = Rect { x: area.rect.x + origin, ..area.rect }.clamped(self.frame.width, self.frame.height);
                if !moved.is_empty() {
                    self.opaque.push(crate::surfaces::OpaqueArea { surface: area.surface, rect: moved });
                }
            }
            for rect in &self.views[view].ui_over_surfaces {
                let moved = Rect { x: rect.x + origin, ..*rect }.clamped(self.frame.width, self.frame.height);
                if !moved.is_empty() {
                    self.ui_over_surfaces.push(moved);
                }
            }
        }
    }

    fn draw_divider(&mut self) -> Option<Rect> {
        let Some(dx) = self.divider_x() else {
            self.last_divider = None;
            return None;
        };
        let engaged = self.divider_hover || self.divider_drag;
        let bg = if engaged {
            DIVIDER_BG_ACTIVE
        } else {
            DIVIDER_BG
        };
        self.frame.fill_rect(dx, 0, DIVIDER_W, self.window.1, bg);
        let cx = dx as f32 + DIVIDER_W as f32 / 2.0;
        let cy = self.window.1 as f32 / 2
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17** (2026-08-07): **Ghostty backend is chosen for libghostty-embedding terminals (cmux): every osascript call fails with -1728 but is reported as a title/tmux problem**
  *Symptoms*: ## Summary  On a Mac whose terminal is **cmux** (`com.cmuxterm.app`, which embeds libghostty), `detectBackend()` picks the **Ghostty** backend purely from environment variables, and that backend then drives the terminal exclusively through `tell application "Ghostty"`. `Ghostty.app` is not installed here, so every `osascript` call fails with `-1728`. Because `withMarkedPane()` swallows the error in `catch {}`, the user is shown a completely unrelated cause:  ``` $ terminal-browser ls terminal-browser: could not find this pane in Ghostty — something keeps rewriting the /dev/ttysNNN title (busy TUI), or this shell is inside tmux (which drops the title marker unless set-titles is on) ```  Neither is true: there is no tmux in the process tree, and nothing is fighting over the title. `terminal-browser open --split right <url>` fails identically. It took a full source dive to find out that the real error is "the app I am trying to script does not exist".  ## Environment  - terminal-browser **v0.3.3** (the relevant code is unchanged at HEAD / v0.4.1) - macOS (darwin 25.5.0), Apple Silicon - Terminal: **cmux 0.64.17**, bundle id `com.cmuxterm.app`, bundles libghostty (`ghostty --version` → `Ghostty 1.3.2-HEAD-+05c3e29`) - `/Applications/Ghostty.app` does **not** exist; the only running terminal process is `/Applications/cmux.app/Contents/MacOS/cmux`  Environment inherited from cmux:  ``` TERM=xterm-256color TERM_PROGRAM=ghostty TERM_PROGRAM_VERSION=1.3.2-HEAD-+05c3e29 GHOSTTY_RESOURC
  **Post-Mortem & Fix Analysis**:
  > Hit this too, and one detail differs in a way that changes which fix is right.  This report assumes `Ghostty.app` is absent, so every `osascript` call fails with `-1728`. On a machine where **Ghostty.app is installed alongside cmux**, there is no `-1728`:  ``` $ osascript -e 'tell application "Ghostty" to count windows' 1 ```  AppleScript succeeds and returns Ghostty.app's real panes. The cmux pane is just never among them, so `withMarkedPane` exhausts its six attempts and prints the same misleading message. Same symptom, different mechanism.  So suggestion 1 (stop swallowing the `osascript` error) is still worth doing, but it would not have helped here — there is no error to surface. Suggestion 2 is the one that covers both machines: do not treat `GHOSTTY_*` in the environment as proof that Ghostty.app owns the pane.  I took suggestion 3 and opened #23 with a cmux backend. It goes through the `cmux` CLI rather than AppleScript, which sidesteps the title-marker gap you flagged: `cmux t
  > Resolved by https://github.com/zenbu-labs/terminal-browser/pull/26

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

### Incident Patch 1: `28de0060` (2026-10-01)
**Commit Message**: Fix claude code plugin (#137)

* fix claude code plugin

* update readme

**File**: `claude-code-plugin/README.md` (modified, +1/-3)
```diff
@@ -98,7 +98,7 @@ on('command.run', { command: 'tldraw' }, async ($) => {
 
 ## How does it work?
 
-terminal-browser uses the [kitty graphics protocol] to display pixels generated by a real browser inside the terminal. To display the browser inside claude code, we use claude codes new [function hooks API](https://github.com/anthropics/claude-code/issues/91870) to render [text that instructs the terminal](https://sw.kovidgoyal.net/kitty/graphics-protocol/#unicode-placeholders) that we want to display an image where the text is located. To actually give the terminal the image, we need to communicate to the terminal by writing through claude code's TTY the location in memory the pixels are located. We do this many times a second to make applications as responsive as they would be in a normal graphical application.
+terminal-browser uses the [kitty graphics protocol] to display pixels generated by a real browser inside the terminal. To display the browser inside claude code, we use claude codes new [function hooks API](https://github.com/anthropics/claude-code/issues/91870).
 
 terminal-browser's internals have been extracted to a javascript library - https://github.com/zenbu-labs/terminal-browser/tree/main/pixel - if you would like to build your own graphical application inside claude code/the terminal
 
@@ -124,8 +124,6 @@ Even if your terminal supports the required graphics feature, if you are running
 
 ## Caveats:
 - depends on your terminal supporting the [kitty graphics protocol]
-- cannot render above 50fps while running inside claude code without risk of the terminal UI getting ["messed up"](https://github.com/zenbu-labs/pixel/pull/8)
-  - if you still see the screen getting messed up, select the text around that area with your mouse to make the terminal correctly redraw the area, or try resizing the pane till it looks right
 - the mouse position will sometimes be slightly off, since claude code does not enable pixel coordinate mouse reporting
 - the plugin needs to make fetch requests to a local http server to communicate with the terminal-browser CLI, which may cause a prompt to show in your OS that your terminal wants to access the local network
 - claude code sets a very high min width for the chat area, so its sometimes not possible to resize the browser to the size you want
```

**File**: `claude-code-plugin/hooks/bridge-protocol.ts` (modified, +26/-3)
```diff
@@ -1,10 +1,19 @@
 // we cannot use libraries inside the claude code sandbox, hence this gross code
 
 
-export type Placed = { imageId: number; cols: number; rows: number }
+export type Frame = {
+  shm: string
+  format: 'rgba' | 'rgb'
+  width: number
+  height: number
+  generation: number
+  cols: number
+  rows: number
+}
 
 export type BridgeState = {
-  placed: Placed | null
+  version: number
+  frame: Frame | null
   title: string
   url: string | null
   alive: boolean
@@ -21,8 +30,22 @@ export type InputMessage = { type: 'input'; events: unknown[] }
 
 const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
 
+export const isFrame = (value: unknown): value is Frame =>
+  isRecord(value)
+  && typeof value.shm === 'string'
+  && (value.format === 'rgba' || value.format === 'rgb')
+  && Number.isInteger(value.width)
+  && Number.isInteger(value.height)
+  && Number.isInteger(value.generation)
+  && Number.isInteger(value.cols)
+  && Number.isInteger(value.rows)
+
 export const isBridgeState = (value: unknown): value is BridgeState =>
-  isRecord(value) && typeof value.alive === 'boolean' && 'placed' in value
+  isRecord(value)
+  && Number.isInteger(value.version)
+  && typeof value.alive === 'boolean'
+  && 'frame' in value
+  && (value.frame === null || isFrame(value.frame))
 
 export const isLaunchReport = (value: unknown): value is LaunchReport =>
   isRecord(value) && (typeof value.port === 'number' || typeof value.error === 'string')
```

**File**: `claude-code-plugin/hooks/placeholders.ts` (removed, +0/-51)
```diff
@@ -1,51 +0,0 @@
-export const PLACEHOLDER = '\u{10EEEE}'
-
-const DIACRITIC_CODE_POINTS = [
-  0x0305, 0x030d, 0x030e, 0x0310, 0x0312, 0x033d, 0x033e, 0x033f, 0x0346, 0x034a,
-  0x034b, 0x034c, 0x0350, 0x0351, 0x0352, 0x0357, 0x035b, 0x0363, 0x0364, 0x0365,
-  0x0366, 0x0367, 0x0368, 0x0369, 0x036a, 0x036b, 0x036c, 0x036d, 0x036e, 0x036f,
-  0x0483, 0x0484, 0x0485, 0x0486, 0x0487, 0x0592, 0x0593, 0x0594, 0x0595, 0x0597,
-  0x0598, 0x0599, 0x059c, 0x059d, 0x059e, 0x059f, 0x05a0, 0x05a1, 0x05a8, 0x05a9,
-  0x05ab, 0x05ac, 0x05af, 0x05c4, 0x0610, 0x0611, 0x0612, 0x0613, 0x0614, 0x0615,
-  0x0616, 0x0617, 0x0657, 0x0658, 0x0659, 0x065a, 0x065b, 0x065d, 0x065e, 0x06d6,
-  0x06d7, 0x06d8, 0x06d9, 0x06da, 0x06db, 0x06dc, 0x06df, 0x06e0, 0x06e1, 0x06e2,
-  0x06e4, 0x06e7, 0x06e8, 0x06eb, 0x06ec, 0x0730, 0x0732, 0x0733, 0x0735, 0x0736,
-  0x073a, 0x073d, 0x073f, 0x0740, 0x0741, 0x0743, 0x0745, 0x0747, 0x0749, 0x074a,
-  0x07eb, 0x07ec, 0x07ed, 0x07ee, 0x07ef, 0x07f0, 0x07f1, 0x07f3, 0x0816, 0x0817,
-  0x0818, 0x0819, 0x081b, 0x081c, 0x081d, 0x081e, 0x081f, 0x0820, 0x0821, 0x0822,
-  0x0823, 0x0825, 0x0826, 0x0827, 0x0829, 0x082a, 0x082b, 0x082c, 0x082d, 0x0951,
-  0x0953, 0x0954, 0x0f82, 0x0f83, 0x0f86, 0x0f87, 0x135d, 0x135e, 0x135f, 0x17dd,
-  0x193a, 0x1a17, 0x1a75, 0x1a76, 0x1a77, 0x1a78, 0x1a79, 0x1a7a, 0x1a7b, 0x1a7c,
-  0x1b6b, 0x1b6d, 0x1b6e, 0x1b6f, 0x1b70, 0x1b71, 0x1b72, 0x1b73, 0x1cd0, 0x1cd1,
-  0x1cd2, 0x1cda, 0x1cdb, 0x1ce0, 0x1dc0, 0x1dc1, 0x1dc3, 0x1dc4, 0x1dc5, 0x1dc6,
-  0x1dc7, 0x1dc8, 0x1dc9, 0x1dcb, 0x1dcc, 0x1dd1, 0x1dd2, 0x1dd3, 0x1dd4, 0x1dd5,
-  0x1dd6, 0x1dd7, 0x1dd8, 0x1dd9, 0x1dda, 0x1ddb, 0x1ddc, 0x1ddd, 0x1dde, 0x1ddf,
-  0x1de0, 0x1de1, 0x1de2, 0x1de3, 0x1de4, 0x1de5, 0x1de6, 0x1dfe, 0x20d0, 0x20d1,
-  0x20d4, 0x20d5, 0x20d6, 0x20d7, 0x20db, 0x20dc, 0x20e1, 0x20e7, 0x20e9, 0x20f0,
-  0x2cef, 0x2cf0, 0x2cf1, 0x2de0, 0x2de1, 0x2de2, 0x2de3, 0x2de4, 0x2de5, 0x2de6,
-  0x2de7, 0x2de8, 0x2de9, 0x2dea, 0x2deb, 0x2dec, 0x2ded, 0x2dee, 0x2def, 0x2df0,
-  0x2df1, 0x2df2, 0x2df3, 0x2df4, 0x2df5, 0x2df6, 0x2df7, 0x2df8, 0x2df9, 0x2dfa,
-  0x2dfb, 0x2dfc, 0x2dfd, 0x2dfe, 0x2dff, 0xa66f, 0xa67c, 0xa67d, 0xa6f0, 0xa6f1,
-  0xa8e0, 0xa8e1, 0xa8e2, 0xa8e3, 0xa8e4, 0xa8e5, 0xa8e6, 0xa8e7, 0xa8e8, 0xa8e9,
-  0xa8ea, 0xa8eb, 0xa8ec, 0xa8ed, 0xa8ee, 0xa8ef, 0xa8f0, 0xa8f1, 0xaab0, 0xaab2,
-  0xaab3, 0xaab7, 0xaab8, 0xaabe, 0xaabf, 0xaac1, 0xfe20, 0xfe21, 0xfe22, 0xfe23,
-  0xfe24, 0xfe25, 0xfe26, 0x10a0f, 0x10a38, 0x1d185, 0x1d186, 0x1d187, 0x1d188, 0x1d189,
-  0x1d1aa, 0x1d1ab, 0x1d1ac, 0x1d1ad, 0x1d242, 0x1d243, 0x1d244,
-]
-
-export const DIACRITICS = DIACRITIC_CODE_POINTS.map(c => String.fromCodePoint(c))
-export const MAX_PLACEHOLDER_CELLS = DIACRITICS.length
-
-export function placeholderRow(row: number, cols: number): string {
-  const rowMark = DIACRITICS[row]
-  if (!rowMark) return ''
-  let out = ''
-  for (let col = 0; col < Math.min(cols, MAX_PLACEHOLDER_CELLS); col++) {
-    out += PLACEHOLDER + rowMark + DIACRITICS[col]
-  }
-  return out
-}
-
-export function imageColor(imageId: number): string {
-  return '#' + (imageId & 0xffffff).toString(16).padStart(6, '0')
-}
```

**File**: `claude-code-plugin/hooks/register.tsx` (modified, +97/-51)
```diff
@@ -1,7 +1,7 @@
 /* @jsx h */
 import type { EngineInterface, Register } from 'claude-code'
 import type { Browser } from './browser'
-import type { Props as SurfaceProps } from './surface.tsx'
+import { MAX_IMAGE_CELLS } from './surface.tsx'
 import { normalizeUrl } from './urls.ts'
 import {
   isBridgeState,
@@ -10,18 +10,22 @@ import {
   isSizeMessage,
   takenTexts,
   type BridgeState,
+  type Frame,
 } from './bridge-protocol.ts'
 
 
 
 const PANE = 'browser'
+const IMAGE_KEY = 'view'
+const IMAGE_ALT = ''
 const OPEN_TOOL = 'mcp__terminal-browser__open'
 const CLOSE_TOOL = 'mcp__terminal-browser__close'
 const START_URL = 'terminal-browser://start'
 const INSTALL_URL = 'https://terminal-browser.sh'
-const REQUIRED_CAPABILITIES = ['embedding']
-const POLL_MS = 250
-const IDLE_POLL_MS = 600
+const REQUIRED_CAPABILITIES = ['embedding', 'image-frames']
+const WATCH_RETRY_MS = 250
+const DENIED_REDRAW_MS = 500
+const DENIALS_BEFORE_LOGGING = 3
 
 
 const state = {
@@ -31,7 +35,9 @@ const state = {
   pendingUrl: null as string | null,
   region: null as { cols: number; rows: number } | null,
   last: null as BridgeState | null,
-  stopPolling: null as (() => void) | null,
+  frame: null as Frame | null,
+  mounted: null as { cols: number; rows: number } | null,
+  watcher: 0,
   // a hack to programatically trigger agent input focus
   viewGeneration: 0,
 }
@@ -91,7 +97,7 @@ async function startBridge($: EngineInterface): Promise<{ ok: true } | { ok: fal
   }
   state.port = report.port
   state.token = report.token
-  startPolling($)
+  void watchBridge($)
   return { ok: true }
 }
 
@@ -109,10 +115,10 @@ async function post($: EngineInterface, path: string, body: unknown): Promise<un
   }
 }
 
-async function fetchState($: EngineInterface): Promise<BridgeState | null> {
+async function fetchState($: EngineInterface, version: number): Promise<BridgeState | null> {
   if (state.port === null) return null
   try {
-    const response = await $.http.fetch(bridgeUrl('/state'), { headers: authHeaders() })
+    const response = await $.http.fetch(bridgeUrl(`/state?version=${version}`), { headers: authHeaders() })
     const parsed: unknown = response.ok ? JSON.parse(response.text) : null
     return isBridgeState(parsed) ? parsed : null
   } catch {
@@ -121,14 +127,83 @@ async function fetchState($: EngineInterface): Promise<BridgeState | null> {
 }
 
 
+function imageSource(frame: Frame) {
+  return { shm: frame.shm, format: frame.format, width: frame.width, height: frame.height, generation: frame.generation }
+}
+
+function imageGrid(frame: Frame, cols: number, rows: number) {
+  return {
+    cols: Math.max(1, Math.min(frame.cols, cols, MAX_IMAGE_CELLS)),
+    rows: Math.max(1, Math.min(frame.rows, rows, MAX_IMAGE_CELLS)),
+  }
+}
+
+function fitsMounted(frame: Frame): boolean {
+  const mounted = state.mounted
+  if (!mounted || !state.region) return false
+  const grid = imageGrid(frame, state.region.cols, state.region.rows)
+  return grid.cols === mounted.cols && grid.rows === mounted.rows
+}
+
+async function watchBridge($: EngineInterface): Promise<void> {
+  const watcher = ++state.watcher
+  const live = () => state.watcher === watcher && state.port !== null
+  let version = -1
+  let denials = 0
+  let lastDeniedRedraw = 0
+  while (live()) {
+    const fresh = await fetchState($, version)
+    if (!live()) return
+    if (!fresh) {
+      await $.clock.sleep(WATCH_RETRY_MS)
+      continue
+    }
+    version = fresh.version
+    const previous = state.last
+    state.last = fresh
+    if (fresh.inbox > 0) await deliverAgentText($)
+    if (!state.open) continue
+    const pictureGone = fresh.frame === null && state.frame !== null
+    if (pictureGone) state.frame = null
+    const paneChanged =
+      !previous
+      || pictureGone
+      || previous.title !== fresh.title
+      || previous.alive !== fresh.alive
+      || previous.error !== fresh.error
+    if (paneChanged) {
+      $.ui.invalidate('ui.render')
+      if (fresh.title) await $.ui.open({ id: PANE, title: fresh.title.slice(0, 40) })
+    }
+    const frame = fresh.frame
+    if (!frame || frame.generation === state.frame?.generation) continue
+    state.frame = frame
+    if (!fitsMounted(frame)) {
+      $.ui.invalidate('ui.render')
+      continue
+    }
+    const result = await $.ui.blit({ requestId: PANE, key: IMAGE_KEY, source: imageSource(frame) })
+    if (!result.deny) {
+      denials = 0
+      continue
+    }
+    denials += 1
+    if (denials === DENIALS_BEFORE_LOGGING) $.ui.log(`terminal-browser: frame blit refused: ${result.deny}`)
+    const now = Date.now()
+    if (now - lastDeniedRedraw >= DENIED_REDRAW_MS) {
+      lastDeniedRedraw = now
+      $.ui.invalidate('ui.render')
+    }
+  }
+}
+
 async function openBrowser($: EngineInterface, raw: string | null): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
   if (state.port === null) {
     const started = await startBridge($)
     if (!starte
```

**File**: `claude-code-plugin/hooks/surface.tsx` (modified, +6/-27)
```diff
@@ -1,15 +1,7 @@
 /* @jsx h */
 import type { ClientKeyEvent, ClientPointerEvent, ClientSurface } from 'claude-code'
-import { MAX_PLACEHOLDER_CELLS, imageColor, placeholderRow } from './placeholders.ts'
 
-
-
-export type Props = {
-  placed: { imageId: number; cols: number; rows: number } | null
-  cols: number
-  rows: number
-  title: string
-} | undefined
+export const MAX_IMAGE_CELLS = 255
 
 type State = { cols: number; rows: number }
 
@@ -56,8 +48,8 @@ function pointerEvent(event: ClientPointerEvent): InputEvent | null {
   return { type: 'mouse', kind: event.type, button: event.button, x: event.x, y: event.y, mods }
 }
 
-export default function Browser(props: Props, surface: ClientSurface<State>) {
-  const { Box, Text } = surface.elements
+export default function Browser(_props: unknown, surface: ClientSurface<State>) {
+  const { Box } = surface.elements
   const queue: InputEvent[] = []
 
   if (surface.state === undefined) {
@@ -77,25 +69,12 @@ export default function Browser(props: Props, surface: ClientSurface<State>) {
     })
   }
 
-  const cols = Math.min(surface.columns, MAX_PLACEHOLDER_CELLS)
-  const rows = Math.min(surface.rows, MAX_PLACEHOLDER_CELLS)
+  const cols = Math.min(surface.columns, MAX_IMAGE_CELLS)
+  const rows = Math.min(surface.rows, MAX_IMAGE_CELLS)
   if (cols > 0 && rows > 0 && surface.state && (surface.state.cols !== cols || surface.state.rows !== rows)) {
     surface.setState({ cols, rows })
     surface.post({ type: 'size', cols, rows })
   }
 
-  const placed = props?.placed
-  if (!placed) return <Box flexDirection="column" height="100%" />
-  const drawCols = Math.min(placed.cols, props?.cols ?? cols)
-  const drawRows = Math.min(placed.rows, props?.rows ?? rows)
-  const color = imageColor(placed.imageId)
-  const lines: string[] = []
-  for (let row = 0; row < drawRows; row++) lines.push(placeholderRow(row, drawCols))
-  return (
-    <Box flexDirection="column" height="100%">
-      {lines.map((line, row) => (
-        <Text key={`r${row}`} color={color} wrap="truncate-end">{line}</Text>
-      ))}
-    </Box>
-  )
+  return <Box flexDirection="column" height="100%" />
 }
```

**File**: `cli/src/claude-bridge.ts` (modified, +101/-33)
```diff
@@ -53,7 +53,6 @@ function report(value: unknown, exitCode = 0): never {
 async function launch(argv: string[]): Promise<never> {
   const tty = flag(argv, "--tty") ?? callerTty().path;
   if (!tty) report({ error: "no tty: Claude Code is not running on a terminal", code: "tty" }, 2);
-  const transport = flag(argv, "--transport") ?? "file"
   const cellOverride = flag(argv, "--cell") ?? process.env.CC_BROWSER_CELL ?? "";
   const token = crypto.randomBytes(24).toString("hex");
   const socket = path.join(os.tmpdir(), `cc-browser-${process.pid}-${Date.now().toString(36)}.sock`);
@@ -62,7 +61,7 @@ async function launch(argv: string[]): Promise<never> {
   const [self, ...selfArgs] = selfCommand();
   const child = spawn(
     self,
-    [...selfArgs, "claude-bridge", "serve", "--tty", tty, "--transport", transport, "--socket", socket, "--cell", cellOverride, "--token", token],
+    [...selfArgs, "claude-bridge", "serve", "--tty", tty, "--socket", socket, "--cell", cellOverride, "--token", token],
     { detached: true, stdio: ["ignore", "pipe", logFd] },
   );
   let line = "";
@@ -87,7 +86,7 @@ async function launch(argv: string[]): Promise<never> {
   const { port } = JSON.parse(line.split("\n")[0]) as { port: number };
   child.stdout!.destroy();
   child.unref();
-  const launched = { port, pid: child.pid, tty, transport, terminalBrowser: installedVersion() ?? "dev", token };
+  const launched = { port, pid: child.pid, tty, terminalBrowser: installedVersion() ?? "dev", token };
   fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} launch ${JSON.stringify({ ...launched, token: undefined })}\n`);
   report(launched);
 }
@@ -100,9 +99,20 @@ type Size = z.infer<typeof Size>;
 
 const Mods = z.object({ shift: z.boolean(), alt: z.boolean(), ctrl: z.boolean(), super: z.boolean() }).partial();
 
+const Frame = z.object({
+  shm: z.string(),
+  format: z.enum(["rgba", "rgb"]),
+  width: z.number().int().positive(),
+  height: z.number().int().positive(),
+  generation: z.number().int().nonnegative(),
+  cols: z.number().int().positive(),
+  rows: z.number().int().positive(),
+});
+type Frame = z.infer<typeof Frame>;
+
 const PixelMessage = z.discriminatedUnion("type", [
   z.object({ type: z.literal("join"), pane: z.string().optional(), name: z.string().optional(), pid: z.number().optional() }),
-  z.object({ type: z.literal("placed"), imageId: z.number(), cols: z.number(), rows: z.number(), cell: Cell.nullish() }),
+  Frame.extend({ type: z.literal("frame"), cell: Cell.nullish() }),
   z.object({ type: z.literal("title"), text: z.string() }),
   z.object({ type: z.literal("pointer"), shape: z.string() }),
   z.object({ type: z.literal("clipboard"), text: z.string() }),
@@ -123,15 +133,18 @@ const InputEvent = z.discriminatedUnion("type", [
 ]);
 
 const OpenBody = z.object({ url: z.string().optional(), cols: z.number().optional(), rows: z.number().optional() });
+const STATE_WAIT_MS = 1000;
+const MAX_IMAGE_PX = 4096;
 const InputBody = z.object({ events: z.array(z.unknown()) });
 const TextBody = z.object({ text: z.string().trim().min(1) });
 
 class Bridge {
-  readonly imageId = 0x100000 + Math.floor(Math.random() * 0xefffff);
   port: number | null = null;
   size: Size = { cols: 80, rows: 24 };
   url: string | null = null;
-  placed: { imageId: number; cols: number; rows: number } | null = null;
+  frame: Frame | null = null;
+  version = 0;
+  private waiters: Array<() => void> = [];
   title = "";
   alive = false;
   error: string | null = null;
@@ -145,28 +158,74 @@ class Bridge {
 
   constructor(
     readonly tty: string,
-    readonly transport: string,
     readonly socketPath: string,
     readonly cellOverride: [number, number] | null,
     readonly token: string,
   ) {}
 
   state() {
     return {
+      version: this.version,
       url: this.url,
-      placed: this.placed,
+      frame: this.frame,
       title: this.title,
       alive: this.alive,
       error: this.error,
       inbox: this.inbox.length,
     };
   }
 
+  changed(): void {
+    this.version += 1;
+    const waiters = this.waiters;
+    this.waiters = [];
+    for (const wake of waiters) wake();
+  }
+
+  stateAfter(version: number): Promise<ReturnType<Bridge["state"]>> {
+    if (version !== this.version) return Promise.resolve(this.state());
+    return new Promise((resolve) => {
+      const timer = setTimeout(() => {
+        this.waiters = this.waiters.filter((waiter) => waiter !== wake);
+        resolve(this.state());
+      }, STATE_WAIT_MS);
+      const wake = () => {
+        clearTimeout(timer);
+        resolve(this.state());
+      };
+      this.waiters.push(wake);
+    });
+  }
+
+  pushInbox(text: string): void {
+    this.inbox.push(text);
+    this.changed();
+  }
+
+  takeInbox(): string[] {
+    const texts = this.inbox.splice(0, this.inbox.length);
+    if (texts.length > 0) this.changed();
+    return texts;
+  }
+
 
   private sizeMessage(type: "init" | "size") {
     return { type, cols: th
```

**File**: `cli/src/main.ts` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ import { claudeBridgeCommand } from "./claude-bridge";
 import { configCommand } from "./config";
 
 const DIST_ROOT = process.env.TERMINAL_BROWSER_DIST_ROOT ?? null;
-const CAPABILITIES = ["embedding"] as const;
+const CAPABILITIES = ["embedding", "image-frames"] as const;
 delete process.env.ELECTRON_RUN_AS_NODE;
 
 function fail(message: string): never {
```

**File**: `pixel/engine/crates/pixel-core/src/hosted.rs` (modified, +97/-0)
```diff
@@ -94,6 +94,30 @@ pub(crate) fn placed(image_id: u32, cols: u32, rows: u32, cell: Option<(u32, u32
     json!({ "type": "placed", "imageId": image_id, "cols": cols, "rows": rows, "cell": cell.map(|(w, h)| [w, h]) })
 }
 
+pub(crate) struct HostFrame<'a> {
+    pub(crate) shm: &'a str,
+    pub(crate) width: u32,
+    pub(crate) height: u32,
+    pub(crate) generation: u64,
+    pub(crate) cols: u32,
+    pub(crate) rows: u32,
+    pub(crate) cell: Option<(u32, u32)>,
+}
+
+pub(crate) fn frame(frame: HostFrame<'_>) -> Value {
+    json!({
+        "type": "frame",
+        "shm": frame.shm,
+        "format": "rgba",
+        "width": frame.width,
+        "height": frame.height,
+        "generation": frame.generation,
+        "cols": frame.cols,
+        "rows": frame.rows,
+        "cell": frame.cell.map(|(w, h)| [w, h]),
+    })
+}
+
 impl HostState {
     pub(crate) fn fill_pixel_size(&mut self) {
         if let Some((cw, ch)) = self.cell {
@@ -504,4 +528,77 @@ mod tests {
         drop(term);
         let _ = std::fs::remove_dir_all(&dir);
     }
+
+    fn fake_embedder(dir: &std::path::Path) -> (String, std::sync::mpsc::Receiver<String>) {
+        let socket = dir.join("embed.sock");
+        let listener = std::os::unix::net::UnixListener::bind(&socket).unwrap();
+        let (tx, rx) = std::sync::mpsc::channel();
+        std::thread::spawn(move || {
+            let Ok((connection, _)) = listener.accept() else { return };
+            let mut reader = BufReader::new(connection);
+            let mut line = String::new();
+            if reader.read_line(&mut line).unwrap_or(0) == 0 {
+                return;
+            }
+            tx.send(line.clone()).unwrap();
+            let init = json!({ "type": "init", "cols": 40, "rows": 10, "width": 400, "height": 200,
+                "cell": [10, 20], "transport": "host", "imageId": 77, "focused": true });
+            send(reader.get_mut(), &init).unwrap();
+            line.clear();
+            while reader.read_line(&mut line).map(|n| n > 0).unwrap_or(false) {
+                tx.send(line.clone()).unwrap();
+                line.clear();
+            }
+        });
+        (socket.to_string_lossy().into_owned(), rx)
+    }
+
+    #[test]
+    fn an_embedded_terminal_on_the_host_transport_hands_frames_over_as_shared_memory_and_leaves_the_tty_alone() {
+        use crate::terminal::Terminal;
+        let dir = std::env::temp_dir().join(format!("pixel-embed-host-{}", std::process::id()));
+        let _ = std::fs::remove_dir_all(&dir);
+        std::fs::create_dir_all(&dir).unwrap();
+        let (socket, lines) = fake_embedder(&dir);
+        let tty = dir.join("fake-tty");
+        std::fs::write(&tty, b"").unwrap();
+
+        let mut term = Terminal::join_embedded(&socket, "pane-1", "hello", tty.to_str().unwrap()).unwrap();
+        let joined: Value = serde_json::from_str(&lines.recv_timeout(Duration::from_secs(2)).unwrap()).unwrap();
+        assert_eq!(joined["type"], "join");
+        assert!(term.is_embedded());
+        assert_eq!(term.cell_size().unwrap(), Some((10, 20)));
+
+        let mut canvas = crate::canvas::Canvas::new(25, 30);
+        canvas.pixels[..4].copy_from_slice(&[9, 8, 7, 255]);
+        let whole = [crate::surfaces::Rect::sized(canvas.width, canvas.height)];
+        let frame = crate::canvas::Frame { canvas: &canvas, premultiplied: false, changed: &[], repainted: &whole, opaque: &[], ui_over_surfaces: &[] };
+        term.draw(frame).unwrap();
+        term.draw(frame).unwrap();
+
+        let first: Value = serde_json::from_str(&lines.recv_timeout(Duration::from_secs(2)).unwrap()).unwrap();
+        let second: Value = serde_json::from_str(&lines.recv_timeout(Duration::from_secs(2)).unwrap()).unwrap();
+        assert_eq!(first["type"], "frame", "{first}");
+        assert_eq!(first["format"], "rgba");
+        assert_eq!(first["width"], 25);
+        assert_eq!(first["height"], 30);
+        assert_eq!(first["cols"], 3);
+        assert_eq!(first["rows"], 2);
+        assert_eq!(first["generation"], 0);
+        assert_eq!(second["generation"], 1);
+        assert_ne!(first["shm"], second["shm"], "every frame is a fresh object");
+        let name = first["shm"].as_str().unwrap();
+        assert!(name.starts_with("/px-") && name.len() <= 30, "{name} must fit macOS's 30 byte shm names");
+        let object = rustix::shm::open(name, rustix::shm::OFlags::RDONLY, rustix::fs::Mode::empty()).unwrap();
+        // macOS rounds a shared-memory object up to whole pages
+        assert!(rustix::fs::fstat(&object).unwrap().st_size >= 25 * 30 * 4);
+
+        drop(term);
+        assert_eq!(std::fs::read(&tty).unwrap(), b"", "nothing may be written to the host's tty");
+        assert!(
+            rustix::shm::open(name, rustix::shm::OFlags::RDONLY, rustix::fs::Mode::empty()).is_err(),
+            "dropping the terminal unlinks the objects the terminal never read"
+        );
+        let _ = std::fs::remove_dir_all(
```

---

### Incident Patch 2: `6cf73bca` (2026-10-01)
**Commit Message**: fix transparent webview background flashing opaque

**File**: `pixel/packages/pixel/src/webview.tsx` (modified, +1/-1)
```diff
@@ -536,7 +536,7 @@ export const WebView = forwardRef<WebViewHandle, WebViewProps>(function WebView(
             width: page.width,
             height: page.height,
             cornerRadius: props.style?.cornerRadius,
-            background: theme.bg,
+            background: props.browserWindowOptions?.transparent ? undefined : theme.bg,
             opaque: !props.browserWindowOptions?.transparent,
           }}
           onPointer={(event: PointerEvent) => {
```

---

### Incident Patch 3: `ff8f1707` (2026-09-20)
**Commit Message**: Add settings + shortcuts config files, ui for settings (#117)

* add settings + shortcuts config files, ui for settings

* renmae shortcuts file

* fix bad keycord case

* cleanup

**File**: `browser/src/config/commands.ts` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+type CommandKeys =
+  | { kind: "shared"; keys: string[] }
+  | { kind: "platform"; mac: string[]; other: string[] };
+
+interface CommandDef {
+  label: string;
+  keys: CommandKeys;
+}
+
+const shared = (keys: string[]): CommandKeys => ({ kind: "shared", keys });
+const platform = (mac: string[], other: string[]): CommandKeys => ({ kind: "platform", mac, other });
+
+export const COMMANDS = {
+  palette: { label: "command palette", keys: platform(["cmd+p"], ["ctrl+k", "alt+k"]) },
+  "settings.open": { label: "settings", keys: shared(["ctrl+,"]) },
+  "tab.new": { label: "new tab", keys: platform(["cmd+t", "ctrl+t"], ["ctrl+t"]) },
+  "tab.close": { label: "close tab", keys: platform(["cmd+w"], ["ctrl+w"]) },
+  "url.edit": { label: "edit url", keys: platform(["cmd+l"], ["ctrl+l"]) },
+  find: { label: "find in page", keys: platform(["cmd+shift+f"], ["ctrl+shift+f"]) },
+  "page.reload": { label: "reload page", keys: platform(["cmd+r"], ["ctrl+r"]) },
+  "page.back": { label: "back", keys: platform(["cmd+[", "ctrl+["], ["ctrl+["]) },
+  "page.forward": { label: "forward", keys: platform(["cmd+]", "ctrl+]"], ["ctrl+]"]) },
+  "devtools.toggle": {
+    label: "toggle devtools",
+    keys: platform(["cmd+shift+i", "f12"], ["ctrl+shift+i", "f12"]),
+  },
+  "devtools.console": { label: "devtools console", keys: platform(["cmd+alt+j"], ["ctrl+alt+j"]) },
+  "record.toggle": { label: "record page", keys: platform(["ctrl+r"], ["ctrl+shift+r"]) },
+  "grab.toggle": { label: "send to agent", keys: shared(["ctrl+g"]) },
+  "zoom.in": { label: "zoom in", keys: platform(["cmd+=", "ctrl+="], ["ctrl+="]) },
+  "zoom.out": { label: "zoom out", keys: platform(["cmd+-", "ctrl+-"], ["ctrl+-"]) },
+  "zoom.reset": { label: "reset zoom", keys: platform(["cmd+0", "ctrl+0"], ["ctrl+0"]) },
+  "ui.zoom.in": { label: "zoom ui in", keys: platform(["cmd+shift+=", "ctrl+shift+="], ["ctrl+shift+="]) },
+  "ui.zoom.out": { label: "zoom ui out", keys: platform(["cmd+shift+-", "ctrl+shift+-"], ["ctrl+shift+-"]) },
+  "ui.zoom.reset": {
+    label: "reset ui zoom",
+    keys: platform(["cmd+shift+0", "ctrl+shift+0"], ["ctrl+shift+0"]),
+  },
+  quit: { label: "quit", keys: platform(["ctrl+q", "ctrl+c"], ["ctrl+q"]) },
+} satisfies Record<string, CommandDef>;
+
+export type CommandId = keyof typeof COMMANDS;
+
+export const COMMAND_IDS = Object.keys(COMMANDS) as CommandId[];
+
+export function isCommandId(value: string): value is CommandId {
+  return Object.prototype.hasOwnProperty.call(COMMANDS, value);
+}
+
+export function commandLabel(id: CommandId): string {
+  return COMMANDS[id].label;
+}
+
+export function defaultKeys(id: CommandId, os: NodeJS.Platform = process.platform): string[] {
+  const keys = COMMANDS[id].keys;
+  if (keys.kind === "shared") return keys.keys;
+  return os === "darwin" ? keys.mac : keys.other;
+}
```

**File**: `browser/src/config/config.ts` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+import crypto from "node:crypto";
+import fs from "node:fs";
+import path from "node:path";
+
+import { z } from "zod";
+
+import { COMMAND_IDS, isCommandId } from "./commands";
+import type { CommandId } from "./commands";
+import { jsonText } from "./json";
+import { parseChord } from "./keys";
+import type { ShortcutOverrides } from "./keys";
+import { SETTINGS, SETTING_KEYS, defaultSettings } from "./settings";
+import type { SettingKey, Settings } from "./settings";
+
+export interface ConfigFiles {
+  settings: string;
+  shortcuts: string;
+}
+
+
+export interface LoadedConfig {
+  settings: Settings | null;
+  shortcuts: ShortcutOverrides | null;
+  errors: string[];
+}
+
+export type ConfigFile = keyof ConfigFiles;
+
+const WATCH_SETTLE_MS = 150;
+
+const jsonObject = z
+  .string()
+  .transform((text) => (text.trim() ? text : "{}"))
+  .pipe(jsonText)
+  .pipe(z.record(z.string(), z.unknown()));
+
+type JsonObject = z.infer<typeof jsonObject>;
+
+const chord = z.string().refine((spec) => parseChord(spec) !== null, {
+  message: "not a valid key chord",
+});
+
+const shortcut = z.union([z.null(), chord.transform((key) => [key]), z.array(chord)]);
+
+function deepestIssue(issues: z.core.$ZodIssue[]): { path: PropertyKey[]; message: string } {
+  let best = issues[0];
+  const visit = (issue: z.core.$ZodIssue) => {
+    if (issue.path.length > best.path.length) best = issue;
+    if (issue.code === "invalid_union") for (const branch of issue.errors) branch.forEach(visit);
+  };
+  issues.forEach(visit);
+  return best;
+}
+
+function describe(file: string, issue: { path: PropertyKey[]; message: string }): string {
+  const where = [path.basename(file), ...issue.path.map(String)].join(" › ");
+  return ` ${where}: ${issue.message}`;
+}
+
+function readText(file: string): string {
+  try {
+    return fs.readFileSync(file, "utf8");
+  } catch {
+    return "";
+  }
+}
+
+function readJsonObject(file: string): { value: JsonObject | null; error: string | null } {
+  const parsed = jsonObject.safeParse(readText(file));
+  if (parsed.success) return { value: parsed.data, error: null };
+  return { value: null, error: describe(file, parsed.error.issues[0]) };
+}
+
+function settingsFrom(file: string, raw: JsonObject): { value: Settings; errors: string[] } {
+  const value = defaultSettings() as Record<string, unknown>;
+  const errors: string[] = [];
+  for (const key of SETTING_KEYS) {
+    if (raw[key] === undefined) continue;
+    const parsed = SETTINGS[key].schema.safeParse(raw[key]);
+    if (parsed.success) value[key] = parsed.data;
+    else errors.push(describe(file, { path: [key], message: parsed.error.issues[0].message }));
+  }
+  return { value: value as Settings, errors };
+}
+
+function shortcutsFrom(file: string, raw: JsonObject): { value: ShortcutOverrides; errors: string[] } {
+  const value: ShortcutOverrides = {};
+  const errors: string[] = [];
+  for (const [id, entry] of Object.entries(raw)) {
+    if (!isCommandId(id)) {
+      errors.push(describe(file, { path: [id], message: `unknown command, expected one of ${COMMAND_IDS.join(", ")}` }));
+      continue;
+    }
+    const parsed = shortcut.safeParse(entry);
+    if (parsed.success) value[id] = parsed.data;
+    else {
+      const issue = deepestIssue(parsed.error.issues);
+      errors.push(describe(file, { path: [id, ...issue.path], message: issue.message }));
+    }
+  }
+  return { value, errors };
+}
+
+function digest(text: string): string {
+  return crypto.createHash("sha256").update(text).digest("hex");
+}
+
+export class ConfigStore {
+  private readonly written = new Map<string, string>();
+
+  constructor(readonly files: ConfigFiles) {}
+
+  load(): LoadedConfig {
+    const settingsFile = readJsonObject(this.files.settings);
+    const shortcutsFile = readJsonObject(this.files.shortcuts);
+    const settings = settingsFile.value && settingsFrom(this.files.settings, settingsFile.value);
+    const shortcuts =
+      shortcutsFile.value && shortcutsFrom(this.files.shortcuts, shortcutsFile.value);
+    return {
+      settings: settings?.value ?? null,
+      shortcuts: shortcuts?.value ?? null,
+      errors: [
+        settingsFile.error,
+        ...(settings?.errors ?? []),
+        shortcutsFile.error,
+        ...(shortcuts?.errors ?? []),
+      ].filter((error): error is string => !!error),
+    };
+  }
+
+  ownContent(file: ConfigFile): boolean {
+    const written = this.written.get(this.files[file]);
+    return written !== undefined && written === digest(readText(this.files[file]));
+  }
+
+  watch(onChange: (files: ConfigFile[]) => void): () => void {
+    const names: ConfigFile[] = ["settings", "shortcuts"];
+    const seen = new Map<ConfigFile, string>(
+      names.map((name) => [name, digest(readText(this.files[name]))]),
+    );
+    const pending = new Set<ConfigFile>();
+    let timer: ReturnType<typeof setTimeout> | null = null;
+    const settle = () => {
+      timer = null;
+
```

**File**: `browser/src/config/json.ts` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import { z } from "zod";
+
+// JSON text as a schema input, so file and response shapes can pipe off it.
+export const jsonText = z.string().transform((text, ctx): unknown => {
+  try {
+    return JSON.parse(text);
+  } catch (error) {
+    ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : String(error) });
+    return z.NEVER;
+  }
+});
```

**File**: `browser/src/config/keys.ts` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+import type { EngineKeyEvent, KeyMods } from "@zenbu-labs/pixel";
+
+import { COMMAND_IDS, defaultKeys } from "./commands";
+import type { CommandId } from "./commands";
+
+export interface Chord extends KeyMods {
+  key: string;
+}
+
+const MOD_NAMES: Record<string, keyof KeyMods> = {
+  cmd: "super",
+  command: "super",
+  super: "super",
+  meta: "super",
+  ctrl: "ctrl",
+  control: "ctrl",
+  alt: "alt",
+  option: "alt",
+  opt: "alt",
+  shift: "shift",
+};
+
+const KEY_NAMES: Record<string, string> = {
+  esc: "escape",
+  return: "enter",
+  " ": "space",
+  spacebar: "space",
+  del: "delete",
+  plus: "+",
+};
+
+const SHIFTED_SYMBOLS: Record<string, string> = { "+": "=", _: "-" };
+
+const MODIFIER_KEYS = /^(left|right)?(shift|ctrl|control|alt|option|super|meta|cmd|command)$/;
+
+function noMods(): KeyMods {
+  return { super: false, ctrl: false, alt: false, shift: false };
+}
+
+function normalizeKey(key: string, shift: boolean): { key: string; shift: boolean } {
+  const named = KEY_NAMES[key] ?? key;
+  const base = SHIFTED_SYMBOLS[named];
+  return base ? { key: base, shift: true } : { key: named, shift };
+}
+
+export function parseChord(spec: string): Chord | null {
+  const text = spec.trim().toLowerCase();
+  if (!text) return null;
+  const parts = text.split("+").filter(Boolean);
+  const key = text === "+" || text.endsWith("++") ? "+" : parts.pop();
+  if (!key || MOD_NAMES[key]) return null;
+  const mods = noMods();
+  for (const part of parts) {
+    const mod = MOD_NAMES[part];
+    if (!mod) return null;
+    mods[mod] = true;
+  }
+  const normalized = normalizeKey(key, mods.shift);
+  return { ...mods, key: normalized.key, shift: normalized.shift };
+}
+
+export function parseChords(specs: readonly string[]): Chord[] {
+  return specs.map(parseChord).filter((chord): chord is Chord => chord !== null);
+}
+
+export function formatChord(chord: Chord, platform: NodeJS.Platform = process.platform): string {
+  const parts: string[] = [];
+  if (chord.super) parts.push(platform === "darwin" ? "cmd" : "super");
+  if (chord.ctrl) parts.push("ctrl");
+  if (chord.alt) parts.push("alt");
+  if (chord.shift) parts.push("shift");
+  parts.push(chord.key);
+  return parts.join("+");
+}
+
+export function isModifierKey(key: string): boolean {
+  return MODIFIER_KEYS.test(key.toLowerCase());
+}
+
+export function chordFromEvent(event: EngineKeyEvent): Chord | null {
+  const key = event.key.toLowerCase();
+  if (!key || key === "unknown" || isModifierKey(key)) return null;
+  const normalized = normalizeKey(key, event.mods.shift);
+  return { ...event.mods, key: normalized.key, shift: normalized.shift };
+}
+
+export function sameChord(a: Chord, b: Chord): boolean {
+  return (
+    a.key === b.key &&
+    a.super === b.super &&
+    a.ctrl === b.ctrl &&
+    a.alt === b.alt &&
+    a.shift === b.shift
+  );
+}
+
+export function listStep(event: EngineKeyEvent): 1 | -1 | null {
+  if (event.key === "down" || (event.mods.ctrl && event.key === "n")) return 1;
+  if (event.key === "up" || (event.mods.ctrl && event.key === "p")) return -1;
+  return null;
+}
+
+function withoutSuper(chord: Chord): Chord {
+  return chord.super ? { ...chord, super: false, alt: true } : chord;
+}
+
+export type ShortcutOverrides = Partial<Record<CommandId, string[] | null>>;
+
+export interface ResolvedBinding {
+  id: CommandId;
+  chords: Chord[];
+  modified: boolean;
+}
+
+export class Keymap {
+  private readonly bindings = new Map<CommandId, ResolvedBinding>();
+
+  constructor(overrides: ShortcutOverrides, options: { noSuper: boolean }) {
+    for (const id of COMMAND_IDS) {
+      const override = overrides[id];
+      const chords =
+        override === undefined
+          ? parseChords(defaultKeys(id)).map((chord) =>
+              options.noSuper ? withoutSuper(chord) : chord,
+            )
+          : parseChords(override ?? []);
+      this.bindings.set(id, { id, chords, modified: override !== undefined });
+    }
+  }
+
+  match(event: EngineKeyEvent): CommandId | null {
+    const pressed = chordFromEvent(event);
+    if (!pressed) return null;
+    for (const binding of this.bindings.values()) {
+      if (binding.chords.some((chord) => sameChord(chord, pressed))) return binding.id;
+    }
+    return null;
+  }
+
+  binding(id: CommandId): ResolvedBinding {
+    return this.bindings.get(id)!;
+  }
+
+  all(): ResolvedBinding[] {
+    return [...this.bindings.values()];
+  }
+
+  labels(id: CommandId): string[] {
+    return this.binding(id).chords.map((chord) => formatChord(chord));
+  }
+
+  label(id: CommandId): string {
+    return this.labels(id)[0] ?? "";
+  }
+
+  conflicts(id: CommandId): CommandId[] {
+    const own = this.binding(id).chords;
+    return this.all()
+      .filter(
+        (other) =>
+          other.id !== id &&
+          other.chords.some((chord) => own.some((mine) => sameChord(mine, chord))),
+      )
+      .map((other) => other.id);
+  }
+}
```

**File**: `browser/src/config/search.ts` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+import { z } from "zod";
+
+import { jsonText } from "./json";
+
+export interface SearchEngine {
+  id: string;
+  name: string;
+  logo: string;
+  search: string;
+  suggest: string | null;
+}
+
+export const SUGGESTIONS_OFF = "off";
+
+export const SEARCH_ENGINES: SearchEngine[] = [
+  {
+    id: "google",
+    name: "Google",
+    logo: "search/google.png",
+    search: "https://www.google.com/search?q=%s",
+    suggest: "https://suggestqueries.google.com/complete/search?client=firefox&q=%s",
+  },
+  {
+    id: "duckduckgo",
+    name: "DuckDuckGo",
+    logo: "search/duckduckgo.png",
+    search: "https://duckduckgo.com/?q=%s",
+    suggest: "https://duckduckgo.com/ac/?q=%s&type=list",
+  },
+  {
+    id: "bing",
+    name: "Bing",
+    logo: "search/bing.png",
+    search: "https://www.bing.com/search?q=%s",
+    suggest: "https://api.bing.com/osjson.aspx?query=%s",
+  },
+  {
+    id: "brave",
+    name: "Brave",
+    logo: "search/brave.png",
+    search: "https://search.brave.com/search?q=%s",
+    suggest: "https://search.brave.com/api/suggest?q=%s",
+  },
+  {
+    id: "kagi",
+    name: "Kagi",
+    logo: "search/kagi.png",
+    search: "https://kagi.com/search?q=%s",
+    suggest: "https://kagi.com/api/autosuggest?q=%s",
+  },
+  {
+    id: "ecosia",
+    name: "Ecosia",
+    logo: "search/ecosia.png",
+    search: "https://www.ecosia.org/search?q=%s",
+    suggest: "https://ac.ecosia.org/?q=%s",
+  },
+  {
+    id: "perplexity",
+    name: "Perplexity",
+    logo: "search/perplexity.png",
+    search: "https://www.perplexity.ai/search?q=%s",
+    suggest: null,
+  },
+];
+
+export function engineBySearch(template: string): SearchEngine | null {
+  return SEARCH_ENGINES.find((engine) => engine.search === template) ?? null;
+}
+
+export function engineBySuggest(template: string): SearchEngine | null {
+  return SEARCH_ENGINES.find((engine) => engine.suggest === template) ?? null;
+}
+
+const strings = z
+  .array(z.unknown())
+  .transform((items) => items.filter((item): item is string => typeof item === "string"));
+
+// Most engines return the OpenSearch shape `[query, [suggestions], ...]`; Ecosia
+// returns `{ suggestions: [...] }`.
+const openSearchFeed = z.tuple([z.unknown(), strings]).rest(z.unknown()).transform(([, list]) => list);
+const ecosiaFeed = z.object({ suggestions: strings }).transform((feed) => feed.suggestions);
+const suggestionFeed = jsonText.pipe(z.union([openSearchFeed, ecosiaFeed]));
+
+export function parseSuggestions(body: string): string[] {
+  const parsed = suggestionFeed.safeParse(body);
+  return parsed.success ? parsed.data : [];
+}
```

**File**: `browser/src/config/settings.ts` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+import { z } from "zod";
+
+import { SEARCH_ENGINES, SUGGESTIONS_OFF } from "./search";
+
+export interface SettingChoice {
+  value: string;
+  name: string;
+  logo: string | null;
+}
+
+interface SettingDef<S extends z.ZodType> {
+  label: string;
+  hint?: string;
+  link?: string;
+  schema: S;
+  default: z.infer<S>;
+  choices?: SettingChoice[];
+}
+
+function setting<S extends z.ZodType>(def: SettingDef<S>): SettingDef<S> {
+  return def;
+}
+
+export const SETTINGS = {
+  "search.engine": setting({
+    label: "search engine",
+    hint: "%s is replaced with search text",
+    schema: z.string(),
+    default: SEARCH_ENGINES[0].search,
+    choices: SEARCH_ENGINES.map(({ search, name, logo }) => ({ value: search, name, logo })),
+  }),
+  "search.suggestions": setting({
+    label: "search suggestions",
+    hint: "%s is replaced with search text",
+    link: "https://github.com/dewitt/opensearch/blob/master/mediawiki/Specifications/OpenSearch/Extensions/Suggestions/1.1/Draft%201.wiki",
+    schema: z.string(),
+    default: SEARCH_ENGINES[0].suggest!,
+    choices: [
+      ...SEARCH_ENGINES.filter((engine) => engine.suggest).map(({ suggest, name, logo }) => ({
+        value: suggest!,
+        name,
+        logo,
+      })),
+      { value: SUGGESTIONS_OFF, name: "off", logo: null },
+    ],
+  }),
+};
+
+export type SettingKey = keyof typeof SETTINGS;
+
+export type Settings = { [K in SettingKey]: z.infer<(typeof SETTINGS)[K]["schema"]> };
+
+export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];
+
+export function isSettingKey(value: string): value is SettingKey {
+  return Object.prototype.hasOwnProperty.call(SETTINGS, value);
+}
+
+export function defaultSettings(): Settings {
+  const out = {} as Record<string, unknown>;
+  for (const key of SETTING_KEYS) out[key] = SETTINGS[key].default;
+  return out as Settings;
+}
```

**File**: `browser/src/record/session.ts` (modified, +6/-3)
```diff
@@ -34,7 +34,7 @@ import {
   unionRects,
 } from "./model";
 import type { CropScope, HandleId, MarkupObject, Rect, Tool, Vec } from "./model";
-import { isRecordKey, listStep } from "../session/keybindings";
+import { listStep } from "../config/keys";
 import { newRecordingDir } from "./paths";
 import {
   CLICK_PULSE_MS,
@@ -60,6 +60,8 @@ export interface RecordHost {
   setClipboard(text: string): void;
   toast(name: string, state: "done" | "failed", detail?: string): void;
   finished(): void;
+  isRecordKey(event: EngineKeyEvent): boolean;
+  recordKeyLabel(): string;
 }
 
 const IDLE_GAP_MS = 3000;
@@ -301,6 +303,7 @@ export class RecordSession {
       durationMs: duration,
       currentKey: this.scrub == null ? null : this.stateKey(),
       pageUrl: this.host.page().url,
+      recordKey: this.host.recordKeyLabel(),
       shots: this.shotsView(),
       shotThumb: keyframes.length > 0 ? this.thumbSurface : null,
       keyframeCount: keyframes.length,
@@ -365,7 +368,7 @@ export class RecordSession {
   handleKey(event: EngineKeyEvent): boolean {
     if (event.kind === "release") return false;
     if (this.scrub == null) {
-      if (isRecordKey(event) && !this.recorder.stopped) {
+      if (this.host.isRecordKey(event) && !this.recorder.stopped) {
         this.stopReview();
         return true;
       }
@@ -387,7 +390,7 @@ export class RecordSession {
     }
     const cmd = event.mods.super || event.mods.ctrl;
     const plainCtrl = event.mods.ctrl && !event.mods.super && !event.mods.alt;
-    if (isRecordKey(event)) {
+    if (this.host.isRecordKey(event)) {
       this.discard();
       return true;
     }
```

**File**: `browser/src/record/types.ts` (modified, +1/-0)
```diff
@@ -60,6 +60,7 @@ export interface RecordView {
   durationMs: number;
   currentKey: number | null;
   pageUrl: string;
+  recordKey: string;
   shots: RecordShot[];
   shotThumb: Surface | null;
   keyframeCount: number;
```

---

### Incident Patch 4: `6d682348` (2026-09-17)
**Commit Message**: add back linux hint

**File**: `browser/src/session/session.tsx` (modified, +4/-0)
```diff
@@ -697,6 +697,10 @@ class Session {
       this.shutdown();
       return true;
     }
+    if (process.platform === "linux" && event.mods.ctrl && event.key === "c") {
+      this.showToast("ctrl+q to quit", "alert");
+      return true;
+    }
     if (this.pageMenu) {
       this.closePageMenu();
       if (event.key === "escape") return true;
```

---

### Incident Patch 5: `aec81269` (2026-09-17)
**Commit Message**: fix readme

**File**: `claude-code-plugin/README.md` (modified, +11/-11)
```diff
@@ -29,17 +29,6 @@ Enable claude code UI plugins by adding this to `~/.claude/settings.json`:
 ```
 
 
-## Updating
-
-Update the claude code plugin:
-```
-claude plugin update terminal-browser@terminal-browser
-```
-
-Update terminal-browser
-```
-terminal-browser upgrade
-```
 
 
 Install the terminal-browser plugin
@@ -53,6 +42,17 @@ claude plugin install terminal-browser@terminal-browser
 
 Now you can run "/browser" inside claude code to open the browser
 
+## Updating
+
+Update the claude code plugin:
+```
+claude plugin update terminal-browser@terminal-browser
+```
+
+Update terminal-browser
+```
+terminal-browser upgrade
+```
 
 ### Configuration
 
```

---

### Incident Patch 6: `606bb566` (2026-09-17)
**Commit Message**: fix build, update readme

**File**: `claude-code-plugin/README.md` (modified, +2/-2)
```diff
@@ -117,15 +117,15 @@ In addition any terminals that are built on libghostty will support this feature
 
 You can find more libghostty based terminals here: [awesome-libghostty](https://github.com/Uzaaft/awesome-libghostty)
 
-Even if your terminal supports the required graphics feature, if you are running a multiplexer, the plugin may not work. This is because multiplexers rewrite the output of terminal programs and breaks terminal graphics commands. tmux support will be arriving soon (terminal-browser currently works in tmux, just not through the claude code plugin yet), and herdr is not yet supported until they implement the kitty graphics placeholders feature. Other multiplexers I have not tested, so if it does not work please file an issue and I will see if we can support this.
+Even if your terminal supports the required graphics feature, if you are running a multiplexer, the plugin may not work. This is because multiplexers rewrite the output of terminal programs and breaks terminal graphics commands. tmux support will be arriving soon (terminal-browser currently works in tmux, just not through the claude code plugin yet), and within herdr performance is very bad when running through the claude code plugin, but will likely improve soon. Other multiplexers I have not tested, so if it does not work please file an issue and I will see if we can support this.
 
 
 
 
 ## Caveats:
 - depends on your terminal supporting the [kitty graphics protocol]
 - cannot render above 50fps while running inside claude code without risk of the terminal UI getting "messed up"
-  - if you still see the screen getting messed up, select the text around that area with your mouse to make the terminal correctly redraw the area
+  - if you still see the screen getting messed up, select the text around that area with your mouse to make the terminal correctly redraw the area, or try resizing the pane till it looks right
 - the mouse position will sometimes be slightly off, since claude code does not enable pixel coordinate mouse reporting
 - the plugin needs to make fetch requests to a local http server to communicate with the terminal-browser CLI, which may cause a prompt to show in your OS that your terminal wants to access the local network
 - claude code sets a very high min width for the chat area, so its sometimes not possible to resize the browser to the size you want
```

**File**: `scripts/release.sh` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ fi
 cp -RL "$NATIVE_PKG" "$STAGE/browser/node_modules/@zenbu-labs/pixel-native-$TARGET"
 if [ -n "$DARWIN_ARCH" ]; then
   cp "$NATIVE_PKG/native-scroll-helper" "$STAGE/bin/native-scroll-helper"
+  rm -f "$STAGE/browser/node_modules/@zenbu-labs/pixel-native-$TARGET/native-scroll-helper"
 fi
 
 AGENT_BROWSER_BIN="$("$ROOT/scripts/agent-browser.sh" --path)"
```

---

### Incident Patch 7: `5fda5e5a` (2026-09-17)
**Commit Message**: Fix heading format and enhance plugin API section

Updated heading format and clarified plugin API usage examples.

**File**: `claude-code-plugin/README.md` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ claude plugin marketplace add zenbu-labs/terminal-browser
 claude plugin install terminal-browser@terminal-browser
 ```
 
-## plugin API
+## Plugin API
 
 The terminal-browser plugin comes with an API you can use within another claude code plugin to programatically open the browser and load a URL. Some examples of useful plugins you can build with this are:
 - a `/tldraw` slash command that opens tldraw in the claude code split pane
```

---

### Incident Patch 8: `6bf72120` (2026-09-17)
**Commit Message**: Fix formatting issue in README.md caveats section

**File**: `claude-code-plugin/README.md` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ Even if your terminal supports the required graphics feature, if you are running
 
 ## Caveats:
 - cannot render above 50fps while running inside claude code without risk of screen tearing (possible screen tearing regardless)
- - if you see the screen slightly getting messed up, select the text around that area with your mouse to make the terminal correctly redraw the area
+  - if you see the screen slightly getting messed up, select the text around that area with your mouse to make the terminal correctly redraw the area
 - cannot enable pixel mouse position reporting, so the mouse position will almost always be slightly off, and in some cases making interacting with some elements not possible
 - the plugin needs to make fetch requests to a local http server to communicate with the terminal-browser CLI, which may cause a prompt to show in your OS that your terminal wants to access the local network
 - claude code sets a very high min width for the chat area, so its sometimes not possible to resize the browser to the size you want
```

---

### Incident Patch 9: `b16b8574` (2026-09-09)
**Commit Message**: fix: align mouse reporting with negotiated coordinates (#105)

**File**: `engine/crates/pixel-core/src/terminal.rs` (modified, +65/-0)
```diff
@@ -397,6 +397,10 @@ impl Terminal {
             terminal.io.out().flush()?;
         }
         terminal.mouse_pixels = !wrapper.relayed() && terminal.probe_mouse_pixels()?;
+        if !terminal.mouse_pixels {
+            terminal.io.out().write_all(b"\x1b[?1016l\x1b[?1006h")?;
+            terminal.io.out().flush()?;
+        }
         terminal.clipboard_data = !wrapper.relayed() && terminal.probe_clipboard_data()?;
         terminal.connect_herdr();
         if terminal.herdr.is_none() && terminal.herdr_target.is_some() {
@@ -2481,6 +2485,67 @@ mod tests {
 mod tty_tests {
     use super::*;
 
+    #[test]
+    fn mouse_coordinates_match_the_negotiated_format() {
+        use std::io::Write as _;
+
+        for (reply, wrapper) in [
+            (Some(b"\x1b[?1016;1$y".as_slice()), Wrapper::None),
+            (Some(b"\x1b[?1016;4$y".as_slice()), Wrapper::None),
+            (None, Wrapper::None),
+            (None, Wrapper::Tmux),
+        ] {
+            let (mut master, _slave, path) = open_pty();
+            let emulator = std::thread::spawn(move || {
+                use std::io::Read as _;
+                let mut seen = Vec::new();
+                let mut pixels = false;
+                let mut byte = [0u8; 1];
+                while master.read_exact(&mut byte).is_ok() {
+                    seen.push(byte[0]);
+                    if seen.ends_with(b"\x1b[?1016h") {
+                        pixels = true;
+                    } else if seen.ends_with(b"\x1b[?1016l")
+                        || seen.ends_with(b"\x1b[?1006h")
+                    {
+                        pixels = false;
+                    } else if seen.ends_with(b"\x1b[?1016$p") {
+                        if let Some(reply) = reply {
+                            master.write_all(reply).unwrap();
+                        }
+                    } else if seen.ends_with(b"\x1b[5n") {
+                        master
+                            .write_all(if pixels {
+                                b"\x1b[<0;485;329M"
+                            } else {
+                                b"\x1b[<0;61;21M"
+                            })
+                            .unwrap();
+                    } else if seen.ends_with(b"\x1b[?1049l") {
+                        break;
+                    }
+                }
+            });
+            let mut term = Terminal::open(&path, wrapper, SessionEnv::of_process()).unwrap();
+            term.cell = Some((8, 16));
+            term.io.out().write_all(b"\x1b[5n").unwrap();
+            term.io.out().flush().unwrap();
+            let event = term.poll_event(Some(Duration::from_millis(500))).unwrap();
+            assert!(
+                matches!(event, Some(Event::Mouse(Mouse {
+                    kind: MouseKind::Down,
+                    button: MouseButton::Left,
+                    x: 484,
+                    y: 328,
+                    ..
+                }))),
+                "the same click must land at (484, 328), reply={reply:?}, wrapper={wrapper:?}: {event:?}"
+            );
+            drop(term);
+            emulator.join().unwrap();
+        }
+    }
+
     /// Returns (master, initial slave fd, slave path). The slave fd stays
     /// open so reads on the master never hit EOF between Terminal lifetimes.
     fn open_pty() -> (std::fs::File, std::fs::File, String) {
```

---

### Incident Patch 10: `25b224e5` (2026-09-03)
**Commit Message**: update react grab build

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -51,3 +51,5 @@ dist-release/
 .dev.vars
 .wrangler/
 skill/build/
+
+/assets/react-grab/index.global.js
```

**File**: `browser/package.json` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
   "private": true,
   "main": "dist/main.js",
   "scripts": {
-    "postinstall": "bash ../scripts/fetch-electron.sh",
+    "postinstall": "bash ../scripts/fetch-electron.sh && bash ../scripts/copy-react-grab.sh",
     "build": "tsc -p tsconfig.json",
     "build:engine": "pnpm --filter pixel-react build",
     "start": "pnpm build:engine && pnpm build && pnpm --filter terminal-browser-cli build && exec node ../cli/dist/main.js",
```

**File**: `browser/src/grab/grab.ts` (modified, +2/-1)
```diff
@@ -11,7 +11,8 @@ const SCRIPT_ASSET = "react-grab/index.global.js";
 let librarySource: string | null = null;
 function reactGrabLibrary(): string {
   if (librarySource) return librarySource;
-  const file = bundledAsset(SCRIPT_ASSET) ?? require.resolve("react-grab/dist/index.global.js");
+  const file = bundledAsset(SCRIPT_ASSET);
+  if (!file) throw new Error(`react-grab bundle missing: assets/${SCRIPT_ASSET} (run pnpm install)`);
   librarySource = `${fs.readFileSync(file, "utf8")}\n;undefined;`;
   return librarySource;
 }
```

**File**: `scripts/copy-react-grab.sh` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+#!/bin/bash
+# react-grab's browser bundle is read from assets at runtime, in dev and in releases alike
+set -euo pipefail
+ROOT="$(cd "$(dirname "$0")/.." && pwd)"
+SRC="$(node -e 'console.log(require.resolve("react-grab/dist/index.global.js",{paths:[process.argv[1]]}))' "$ROOT/browser")"
+mkdir -p "$ROOT/assets/react-grab"
+cp "$SRC" "$ROOT/assets/react-grab/index.global.js"
```

**File**: `scripts/release.sh` (modified, +2/-3)
```diff
@@ -45,10 +45,9 @@ cp -R "$ROOT/skill/build" "$STAGE/skills"
 
 cp "$ROOT/assets/fonts/JetBrainsMono-Regular.ttf" "$STAGE/assets/fonts/"
 
+"$ROOT/scripts/copy-react-grab.sh"
 mkdir -p "$STAGE/assets/react-grab"
-REACT_GRAB_JS="$(node -e 'console.log(require.resolve("react-grab/dist/index.global.js",{paths:[process.argv[1]]}))' "$ROOT/browser")"
-cp "$REACT_GRAB_JS" "$STAGE/assets/react-grab/index.global.js"
-cp "$ROOT/assets/react-grab/logo.png" "$STAGE/assets/react-grab/"
+cp "$ROOT/assets/react-grab/"* "$STAGE/assets/react-grab/"
 
 ELECTRON_DIST="$(node -e 'const p=require("path");console.log(p.join(p.dirname(require.resolve("electron/package.json",{paths:[process.argv[1]]})),"dist"))' "$ROOT/browser")"
 if [ ! -f "$ELECTRON_DIST/.zenbu-electron-sha256" ]; then
```

---

### Incident Patch 11: `a1378a9b` (2026-08-28)
**Commit Message**: fix split merge heuerstic

**File**: `cli/src/main.ts` (modified, +3/-1)
```diff
@@ -593,7 +593,9 @@ async function openCommand(args: string[]) {
   if (positionals.length > 1) {
     fail(`unexpected ${positionals[1]} (one url; --split <direction> opens a new pane)`);
   }
-  if (!noMerge && !args.some((arg) => arg.startsWith("--ssh="))) {
+  const targeted = Boolean(process.env.TERMINAL_BROWSER_INTEROP_TARGET);
+  const wouldSplit = split !== null || !interactiveTty();
+  if (!noMerge && (wouldSplit || targeted) && !args.some((arg) => arg.startsWith("--ssh="))) {
     if (await tryAdopt(args)) return;
   }
   await requireGraphics(await currentTerminal());
```

---

### Incident Patch 12: `2a739b31` (2026-08-21)
**Commit Message**: fix slice

**File**: `cli/src/main.ts` (modified, +2/-2)
```diff
@@ -501,12 +501,12 @@ function takeSshFlags(args: string[]): void {
   if (ssh !== undefined) args.push(`--ssh=${ssh}`);
   const bundle = takeFlag(args, "--ssh-bundle");
   if (bundle !== undefined) args.push(`--ssh-bundle=${bundle}`);
+  const bundleDir = takeFlag(args, "--ssh-bundle-dir");
+  if (bundleDir !== undefined) args.push(`--ssh-bundle-dir=${bundleDir}`);
   const at = args.findIndex((arg) => arg.startsWith("--ssh-bundle="));
   if (at >= 0) {
     args[at] = `--ssh-bundle=${path.resolve(args[at].slice("--ssh-bundle=".length))}`;
   }
-  const bundleDir = takeFlag(args, "--ssh-bundle-dir");
-  if (bundleDir !== undefined) args.push(`--ssh-bundle-dir=${bundleDir}`);
   const target = args.find((arg) => arg.startsWith("--ssh="))?.slice("--ssh=".length);
   if (at >= 0 && !target) fail("--ssh-bundle needs --ssh");
   if (args.some((arg) => arg.startsWith("--ssh-bundle-dir=")) && at < 0) {
```

---

### Incident Patch 13: `b33a3e07` (2026-08-20)
**Commit Message**: fix typo (#47)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ terminal-browser action # an agent-browser compatible cli for interacting with o
 ### Use cases:
 - You can have a coding agent and website scoped to the same terminal tab
 - Your agent has full access to interact with open terminal-browsers, which gives your agent the capability to use the web
-- You can ask an agent to make HTML plans and them open them inside terminal-browser, which will automatically open in a split pane next to your agent
+- You can ask an agent to make HTML plans and then open them inside terminal-browser, which will automatically open in a split pane next to your agent
 - terminal-browser works over SSH, which allows you to preview websites running on remote machines easily
 
 ### Shortcuts
```

---

### Incident Patch 14: `f0e6afff` (2026-08-19)
**Commit Message**: fix: pick available AppArmor ABI for chromium userns profile (#35)

Hardcoding abi/5.0 fails the parser on AppArmor 4.x (Ubuntu 24.04 LTS),
so the profile is never loaded and the sandbox cannot start.

**File**: `scripts/apparmor.sh` (modified, +13/-1)
```diff
@@ -23,7 +23,19 @@ BINARY="$(readlink -f "$BINARY")"
 NAME="terminal-browser-$(printf '%s' "$BINARY" | sha256sum | cut -c1-12)"
 PROFILE="/etc/apparmor.d/$NAME"
 
-WANTED="abi <abi/5.0>,
+# Ubuntu 24.04 ships AppArmor 4.x (abi/4.0 only). Newer releases may have abi/5.0.
+if [ -f /etc/apparmor.d/abi/5.0 ]; then
+  ABI=5.0
+elif [ -f /etc/apparmor.d/abi/4.0 ]; then
+  ABI=4.0
+elif [ -f /etc/apparmor.d/abi/3.0 ]; then
+  ABI=3.0
+else
+  echo "no AppArmor abi under /etc/apparmor.d/abi/ — cannot install profile" >&2
+  exit 1
+fi
+
+WANTED="abi <abi/${ABI}>,
 
 include <tunables/global>
 
```

---

### Incident Patch 15: `cfbefbfd` (2026-08-18)
**Commit Message**: also listen to navigation events to terminal browser quit

**File**: `browser/src/page/controller.ts` (modified, +12/-6)
```diff
@@ -141,6 +141,9 @@ export class BrowserController {
     });
     this.window.webContents.setFrameRate(frameRate());
     this.window.on("closed", this.onWindowClosed);
+    this.window.webContents.on("will-navigate", (event, url) => {
+      if (this.quitLink(url)) event.preventDefault();
+    });
     screen.on("display-added", this.onDisplayChange);
     screen.on("display-removed", this.onDisplayChange);
     screen.on("display-metrics-changed", this.onDisplayChange);
@@ -562,16 +565,19 @@ export class BrowserController {
     this.onState(this.state);
   }
 
+  private quitLink(url: string): boolean {
+    if (!url.startsWith("terminal-browser://quit")) return false;
+    setImmediate(() => {
+      if (!this.stopped) this.window.close();
+    });
+    return true;
+  }
+
   private handleWindowOpen(
     { url, disposition, features }: Electron.HandlerDetails,
     opener: Electron.WebContents,
   ): Electron.WindowOpenHandlerResponse {
-    if (url.startsWith("terminal-browser://quit")) {
-      setImmediate(() => {
-        if (!this.stopped) this.window.close();
-      });
-      return { action: "deny" };
-    }
+    if (this.quitLink(url)) return { action: "deny" };
     const wantsTab = disposition === "foreground-tab" || disposition === "background-tab";
     if (wantsTab && !this.tabsAsPopups && this.onOpenTab) {
       this.onOpenTab(url, disposition === "foreground-tab");
```

#### Recent Merged Pull Requests:
- **PR #149** (2026-10-05): Support transparency on websites via config (@RobPruzan)
- **PR #145** (2026-10-03): Include images when sending to agent (@RobPruzan)
- **PR #142** (2026-10-01): Use best effort cursor when ghostty does not change cursors (@RobPruzan)
- **PR #140** (2026-10-01): Make skill write explicit (@RobPruzan)
- **PR #139** (2026-10-01): Put react grab button in toolbar (@RobPruzan)
- **PR #138** (2026-10-01): add webmcp support (@RobPruzan)
- **PR #137** (2026-10-01): Fix claude code plugin (@RobPruzan)
- **PR #131** (2026-09-30): Add telemetry and error reporting (@RobPruzan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
