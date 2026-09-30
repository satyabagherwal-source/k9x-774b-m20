# Forensic Learning Record (Deep Inspection): Vexa-ai/vexa

> **Canonical Artifact**: `07_PROJECT_LEARNING/vexa-ai-vexa-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Vexa-ai/vexa](https://github.com/Vexa-ai/vexa))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:40:44.515Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Vexa-ai/vexa`
- **Description**: Open-source meeting transcription API for Google Meet, Microsoft Teams & Zoom. Auto-join bots, real-time WebSocket transcripts, MCP server for AI agents. Self-host or use hosted SaaS.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2844 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `clients/extension/scripts/check-isolation.js`
```
#!/usr/bin/env node
// gate:isolation (P2) — @vexa/extension SOURCE-BUNDLES sibling capture bricks on purpose:
// build.mjs maps each `@vexa/<brick>` specifier to that brick's src/index.ts (esbuild alias),
// so the extension ships one self-contained bundle. Its boundary is therefore: every import is
// (a) intra-package (relative), (b) a Node/browser builtin, (c) a DECLARED dep, or (d) a
// `@vexa/*` specifier EXPLICITLY WIRED in build.mjs's alias map. An import of an UNWIRED brick
// (would silently fail to bundle) → violation. ESM; the gate runs `node scripts/check-isolation.js`.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const SRC = join(ROOT, "src");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const deps = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
const builtins = new Set(builtinModules);
// the @vexa specifiers explicitly wired for source-bundling in build.mjs
const buildMjs = readFileSync(join(ROOT, "build.mjs"), "utf8");
const wired = new Set([...buildMjs.matchAll(/['"](@vexa\/[^'"]+)['"]\s*:/g)].map((m) => m[1]));
let files = 0;
const violations = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
      files++;
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const spec = m[1] || m[2];
        if (spec.startsWith(".")) continue;                 // intra-package
        if (wired.has(spec)) continue;                      // source-bundled brick (build.mjs alias)
        const bare = spec.startsWith("node:") ? spec.slice(5) : spec;
        const scoped = bare.startsWith("@") ? bare.split("/").slice(0, 2).join("/") : bare.split("/")[0];
        if (builtins.has(bare) || builtins.has(scoped)) continue;       // builtin (± node: prefix)
        if (deps.has(spec) || deps.has(bare) || deps.has(scoped)) continue;  // declared dep
        violations.push(`${relative(SRC, p)} → ${spec}`);
      }
    }
  }
})(SRC);
if (violations.length) { console.error("❌ ISOLATION VIOLATION (undeclared dep or unwired @vexa brick):\n  " + violations.join("\n  ")); process.exit(1); }
console.log(`✅ ISOLATION VERIFIED — scanned ${files} files; every import intra-package, builtin, declared dep, or a build.mjs-wired brick (${wired.size} wired).`);

```

### Core Architecture Module: `clients/extension/src/background.ts`
```
/**
 * Background service worker — GOOGLE MEET ONLY.
 *
 * Owns the single WebSocket to the desktop ingest (ws://localhost:9099/ingest).
 * Because it runs in the extension's own context with host permissions, its
 * WebSocket is NOT subject to Google Meet's page CSP. It receives per-speaker
 * PCM chunks from the content script, encodes each into a capture.v1 binary
 * frame (@vexa/capture-codec encodeAudioFrame) and streams it to the desktop.
 *
 * Control flow: panel → START/STOP here → open/close WS and tell the meeting
 * tab's content script to begin/end capture.
 */

import { detectMeeting, isMixedHost, MeetingRef } from './meeting';
import { resolveEndpoints } from './endpoints';
import { encodeAudioFrame, encodeEvent, encodeRecordingChunk } from '@vexa/capture-codec';
import { type CaptureStatus, isActive, onFrameObserved, noSignalCheck } from './capture-liveness';

interface SessionState {
  status: CaptureStatus;
  /** Capture suspended (audio/hints dropped) but the session stays alive —
   *  resume continues the SAME meeting. Stop ends it. */
  paused: boolean;
  tabId: number | null;
  meetingId: number | null;
  platform: string | null;
  nativeMeetingId: string | null;
  streams: number;
  error: string | null;
  /** build-stamp.txt as read when THIS service worker loaded. The panel compares
   *  it to the on-disk stamp to detect a stale SW (reload deferred during capture). */
  swBuild: string;
  /** Newer build sitting on disk while reload is deferred (set by the stamp
   *  watcher). Lets the panel show "Reload now" even when the panel itself is
   *  equally stale (panelBuild == swBuild blind spot). */
  diskBuild: string;
}

const state: SessionState = {
  status: 'idle',
  paused: false,
  tabId: null,
  meetingId: null,
  platform: null,
  nativeMeetingId: null,
  streams: 0,
  error: null,
  swBuild: '',
  diskBuild: '',
};

// Endpoint resolution is deployment-aware (src/endpoints.ts): the chosen
// `deployment` preset (default 'desktop' → ws://localhost:9099/ingest +
// http://localhost:8056) unless explicit ingestUrl/gatewayUrl override it. ONE
// build thus serves desktop + lite + compose + helm. Every endpoint read below
// goes through resolveEndpoints(cfg) — there is no separate default constant.

let ws: WebSocket | null = null;

/** tabCapture stream id, minted on the toolbar-click gesture (that click is the
 *  only event that grants activeTab, which getMediaStreamId requires). Used for
 *  MIXED-lane tabs (YouTube + Zoom + Teams) where the offscreen mixed captor is
 *  the audio source. */
let tabStreamId: string | null = null;

/** MIXED-lane platforms: the whole tab's audio is one mixed stream the desktop
 *  diarizes (channel 999, via the offscreen tabCapture), as opposed to Google
 *  Meet's per-participant in-page <audio> capture. Zoom and Teams additionally
 *  feed speaker-name hints from their inpage zoom-/msteams-speakers DOM. */
const MIXED = new Set(['youtube', 'zoom', 'teams']);
const isMixed = (p: string | null | undefined): boolean => !!p && MIXED.has(p);

// ── P21 capture liveness: state is EARNED by observed frames, not the Start command.
const NO_SIGNAL_MS = 6000;
let startedAt = 0;     // when the WS went 'ready' (warm-up grace baseline)
let lastFrameAt = 0;   // last audio frame actually observed (0 = none yet this session)
let framesSeen = 0;    // audio frames observed this session

/** Per-tab meeting ref captured from a JOIN URL the tab navigated through. Teams'
 *  new web app (teams.cloud.microsoft) and Zoom's web client STRIP the meeting id
 *  from the URL once you're in — only the join link (/meet/<id>, /j/<id>) carries
 *  it. We remember it per tab and reuse it when the in-meeting URL no longer has it. */
const tabMeeting = new Map<number, MeetingRef>();
const rememberMeeting = (tabId: number, url?: string): void => {
  const m = url ? detectMeeting(url) : null;
  if (m && tabId != null) tabMeeting.set(tabId, m);
};
const meetingForTab = (tabId: number | null | undefined, url?: string): MeetingRef | null =>
  (url ? detectMeeting(url) : null) || (tabId != null ? tabMeeting.get(tabId) ?? null : null);

function broadcastStatus(): void {
  chrome.runtime.sendMessage({ type: 'STATUS', state }).catch(() => { /* panel may be closed */ });
}

/** Ensure the offscreen document exists. USER_MEDIA covers the voice-notepad mic
 *  AND the tabCapture getUserMedia; AUDIO_PLAYBACK covers re-playing the captured
 *  tab audio to the speakers (tab capture otherwise mutes the tab). */
async function ensureOffscreen(): Promise<void> {
  const has = await (chrome.offscreen as any).hasDocument?.().catch(() => false);
  if (has) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: 'Microphone and meeting/media audio capture and re-play',
  }).catch((e) => { if (!String(e).includes('single offscreen')) throw e; });
}

/** Start the mixed tab-audio capture (offscreen) for the current media session. */
function startTabAudio(): void {
  if (!tabStreamId) {
    state.error = 'tab audio needs a click — open the panel from the toolbar icon on this tab';
    broadcastStatus();
    return;
  }
  ensureOffscreen()
    .then(() => chrome.runtime.sendMessage({ type: 'TAB_CAPTURE_START', streamId: tabStreamId }))
    .then((res: any) => {
      if (res && res.ok === false) { state.error = `tab capture: ${res.error}`; broadcastStatus(); }
    })
    .catch((e) => { state.error = `tab capture: ${e.message}`; broadcastStatus(); });
}

async function startCaptureForTab(tabId: number, url: string, meetingRef?: MeetingRef): Promise<void> {
  if (isActive(state.status)) return;

  // An explicit ref wins. No meeting anywhere → voice-notepad mode: capture the
  // mic via the offscreen document under the synthetic 'note' platform.
  const meeting = meetingRef || meetingForTab(tabId, url)
    || { platform: 'note' as any, nativeMeetingId: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` };

  const cfg = await chrome.storage.local.get(['apiKey', 'deployment', 'ingestUrl', 'language']);
  const apiKey: string = cfg.apiKey || '';
  // Deployment-aware: the preset's ingest unless an explicit ingestUrl overrides it.
  const ingestUrl: string = resolveEndpoints(cfg).ingestUrl;
  const language: string = cfg.language || 'auto';

  state.status = 'connecting';
  state.paused = false;
  state.tabId = tabId;
  state.platform = meeting.platform;
  state.nativeMeetingId = meeting.nativeMeetingId;
  state.error = null;
  broadcastStatus();

  const qs = new URLSearchParams({
    platform: meeting.platform,
    native_meeting_id: meeting.nativeMeetingId,
    api_key: apiKey,
    language,
  });
  const fullUrl = `${ingestUrl}?${qs.toString()}`;

  try {
    ws = new WebSocket(fullUrl);
  } catch (err: any) {
    state.status = 'error'; state.error = `WS open failed: ${err.message}`; broadcastStatus(); return;
  }
  ws.binaryType = 'arraybuffer';

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      if (msg.type === 'ready') {
        state.meetingId = msg.meeting_id;
        // P21: connected + capture begun, but NO frame yet → 'starting', not 'capturing'.
        // The first observed audio frame (sendAudio) earns 'capturing'; the watchdog flips
        // to 'no-signal' if none arrives — so the panel can't show "Listening" over silence.
        state.status = 'starting';
        startedAt = Date.now(); lastFrameAt = 0; framesSeen = 0;
        broadcastStatus();
        shipTelemetry('session-ready');
        if (state.platform === 'note') {
          ensureOffscreen()
            .then(() => chrome.runtime.sendMessage({ type: 'NOTE_CAPTURE_START' }))
            .then((res: any) => {
              if (res && res.ok === false) {
                state.status = 'error';
                state.error = res.error === 'N
```

### Core Architecture Module: `clients/extension/src/capture-liveness.ts`
```
/**
 * Capture liveness — the P21 ("report state from evidence, not intent") rule for
 * the extension's capture state, as a PURE module so it is unit-testable without
 * chrome / WebSocket fakes (the extension's first state-machine tests).
 *
 * "Listening" must be EARNED by an observed audio frame — never asserted from the
 * Start command or the WS `ready`. The background worker applies these two
 * transitions to its session state:
 *
 *   connecting ─(WS ready)─► starting ─(first frame)─► capturing
 *                                │                          │
 *                                └──(no frame ≥ noSignalMs)─┴──► no-signal
 *   no-signal ─(a frame arrives)─► capturing            (self-heals)
 *
 * Before a frame is seen the state is `starting`, never `capturing` — so the panel
 * can never show "Listening — capturing N stream(s)" over silence. A stalled feed
 * flips visibly to `no-signal` with an actionable cause (P18 liveness, client-side).
 */
export type CaptureStatus = 'idle' | 'connecting' | 'starting' | 'capturing' | 'no-signal' | 'error';

/** A capture in any of these states is LIVE — don't double-start it, don't hot-reload over it. */
export const ACTIVE: ReadonlySet<CaptureStatus> = new Set<CaptureStatus>(['connecting', 'starting', 'capturing', 'no-signal']);
export const isActive = (s: CaptureStatus): boolean => ACTIVE.has(s);

/** P21 evidence rule: a real audio frame promotes a started/stalled capture to
 *  `capturing`. Idempotent once capturing; a no-op in idle/connecting/error (a
 *  stray frame must not resurrect a torn-down or never-started session). */
export function onFrameObserved(status: CaptureStatus): CaptureStatus {
  return (status === 'starting' || status === 'no-signal') ? 'capturing' : status;
}

/** P18 liveness, client-side: while a capture should be flowing, no frame within
 *  `noSignalMs` flips it to `no-signal` with an actionable cause. `lastFrameAt === 0`
 *  means no frame yet, so the warm-up grace is measured from `startedAt`. Returns the
 *  new status + hint, or `null` when nothing should change. */
export function noSignalCheck(a: {
  status: CaptureStatus; paused: boolean; frames: number;
  lastFrameAt: number; startedAt: number; now: number; noSignalMs: number; mixed: boolean;
}): { status: CaptureStatus; error: string } | null {
  if (a.paused) return null;                                   // suspended on purpose — silence is expected
  if (a.status !== 'starting' && a.status !== 'capturing') return null;
  const since = a.now - (a.lastFrameAt || a.startedAt);
  if (since <= a.noSignalMs) return null;                      // still within grace / recently fed
  const error = a.frames === 0
    ? (a.mixed
        ? 'no audio — capturing 0 streams. Click the Vexa toolbar icon ON this tab to mint capture (it is lost on reload).'
        : 'no audio — capturing 0 streams. Check the tab is in the meeting and someone is speaking.')
    : 'audio stalled — the capture feed stopped flowing';
  return { status: 'no-signal', error };
}

```

### Core Architecture Module: `clients/extension/src/content.ts`
```
/**
 * Content script (isolated world) — GOOGLE MEET ONLY.
 *
 * Bridges the MAIN-world capture (inpage.ts) and the background service worker:
 *   - relays captured audio / control messages from inpage → background
 *   - forwards START/STOP commands from background → inpage
 *
 * No networking happens here; the background worker owns the WebSocket so it is
 * governed by the extension's host permissions, not Google Meet's page CSP.
 */

import { detectMeeting } from './meeting';

const VEXA = '[vexa-content]';

// The capture loop (inpage.ts) is registered as a MAIN-world content script in
// the manifest, so Chrome injects it directly (bypassing Google Meet's page CSP
// that would block a <script src> injection). No manual injection needed here.

function sendToInpage(command: string): void {
  window.postMessage({ __vexaControl: true, command }, '*');
}

// Relay messages coming up from the MAIN-world capture loop.
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.__vexa !== true) return;

  switch (data.type) {
    case 'audio':
      // Forward one per-speaker PCM chunk to the background WebSocket.
      // speakerName = the glow name bound at the source (gmeet); undefined otherwise.
      chrome.runtime.sendMessage({ type: 'audio', index: data.index, pcm: data.pcm, speakerName: data.speakerName });
      break;
    case 'speakers':
      chrome.runtime.sendMessage({ type: 'speakers', speakers: data.speakers });
      break;
    case 'capture-started':
    case 'capture-stopped':
    case 'inpage-ready':
      chrome.runtime.sendMessage({ type: data.type, streams: data.streams });
      break;
    case 'diag':
      chrome.runtime.sendMessage({ type: 'diag', diag: data.diag });
      break;
    case 'dom_probe':
      chrome.runtime.sendMessage({ type: 'dom_probe', probe: data.probe });
      break;
    case 'speaker_activity':
      chrome.runtime.sendMessage({ type: 'speaker_activity', name: data.name, kind: data.kind, isEnd: data.isEnd });
      break;
    case 'chat-message':
      // Zoom/Teams chat panel message → capture.v1 `chat` event (background encodes it).
      chrome.runtime.sendMessage({ type: 'chat-message', sender: data.sender, text: data.text });
      break;
    case 'recording-chunk':
      // gmeet recording (combined Meet mix → MediaRecorder, @vexa/record-chunker) →
      // background → ingest WS (recording.v1). The MIXED lane records via the offscreen
      // tee instead (RECORDING_CHUNK, pre-encoded), so the two never collide.
      chrome.runtime.sendMessage({ type: 'recording-chunk', seq: data.seq, isFinal: data.isFinal, mimeType: data.mimeType, base64: data.base64 });
      break;
  }
});

// Commands from the panel → background → content → inpage.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'BEGIN_CAPTURE') {
    sendToInpage('vexa-start');
    sendResponse({ ok: true });
  } else if (msg.type === 'END_CAPTURE') {
    sendToInpage('vexa-stop');
    sendResponse({ ok: true });
  }
  return true;
});

// --- Auto-start: when this tab is in an actual Google Meet, ask the background
// to start capturing. Meet is an SPA, so the URL can change from a landing page
// to a meeting without a reload — poll for that.
let lastSeenUrl = '';
function checkAutoStart(): void {
  if (location.href === lastSeenUrl) return;
  lastSeenUrl = location.href;
  if (detectMeeting(location.href)) {
    const detectedUrl = location.href;
    // Give the meeting UI / media a moment to come up before requesting auto-start.
    setTimeout(() => chrome.runtime.sendMessage({ type: 'AUTO_START', url: detectedUrl }).catch(() => { /* sw asleep */ }), 1500);
  }
}
checkAutoStart();
setInterval(checkAutoStart, 2000);

// Teams' new web app (teams.cloud.microsoft) + meetings created in-tab NEVER expose
// the meeting id in the URL. Read the canonical thread id (19:meeting_…@thread.v2)
// from the page (DOM + same-origin storage) and report it so the background can key
// the session. Scan until found (stable per meeting), then stop.
function isTeamsHost(): boolean {
  return location.hostname.endsWith('teams.microsoft.com')
    || location.hostname.endsWith('teams.live.com')
    || location.hostname === 'teams.cloud.microsoft';
}
let teamsReported = false;
function checkTeamsMeeting(): void {
  if (teamsReported || !isTeamsHost()) return;
  let blob = '';
  try { blob = document.documentElement.outerHTML; } catch { /* */ }
  try { blob += ' ' + JSON.stringify({ ...sessionStorage, ...localStorage }); } catch { /* */ }
  const m = blob.match(/19:meeting_[A-Za-z0-9_\-]+@thread\.v2/);
  if (m) {
    teamsReported = true;
    chrome.runtime.sendMessage({ type: 'MEETING_HINT', meeting: { platform: 'teams', nativeMeetingId: m[0] } }).catch(() => { /* sw asleep */ });
    console.log(`${VEXA} teams meeting id (from DOM): ${m[0]}`);
  }
}
checkTeamsMeeting();
setInterval(checkTeamsMeeting, 2000);

console.log(`${VEXA} ready on ${location.href}`);

```

### Core Architecture Module: `clients/extension/src/endpoints.ts`
```
/**
 * Endpoint resolution — the "one build serves all deployments" piece.
 *
 * ONE extension build runs against every Vexa deployment (desktop, lite, compose,
 * helm). Rather than ship a build per target, the user picks a `deployment` preset
 * (or pastes explicit URLs) and this module resolves the concrete ingest +
 * gateway endpoints. Pure + dependency-free so it unit-tests without a browser
 * (see endpoints.test.ts).
 *
 * Resolution order (per field, independent):
 *   1. an explicit, non-empty URL from settings always wins (any deployment), then
 *   2. the chosen deployment preset's default.
 *
 *   - ingest  = the capture.v1 WebSocket (audio/events/recording).
 *   - gateway = the REST API base (bots list, meeting status, finalize on stop).
 *
 * Presets:
 *   - desktop : ws://localhost:9099/ingest  +  http://localhost:8056
 *               (the all-Node desktop pipeline — the default).
 *   - cloud   : ws://localhost:8092/ingest  +  http://localhost:8056
 *               (compose/helm/lite reached through a local port-forward/tunnel).
 */

export type Deployment = 'desktop' | 'cloud';

export const DEFAULT_DEPLOYMENT: Deployment = 'desktop';

export interface DeploymentPreset {
  ingestUrl: string;
  gatewayUrl: string;
}

/** Built-in presets, keyed by deployment. */
export const DEPLOYMENT_PRESETS: Record<Deployment, DeploymentPreset> = {
  desktop: { ingestUrl: 'ws://localhost:9099/ingest', gatewayUrl: 'http://localhost:8056' },
  cloud:   { ingestUrl: 'ws://localhost:8092/ingest', gatewayUrl: 'http://localhost:8056' },
};

/** Settings shape this resolver reads (a subset of the stored config). */
export interface EndpointConfig {
  /** Chosen preset; falls back to the default when missing/unknown. */
  deployment?: string;
  /** Explicit override for the ingest WebSocket (wins over the preset when non-empty). */
  ingestUrl?: string;
  /** Explicit override for the gateway REST base (wins over the preset when non-empty). */
  gatewayUrl?: string;
}

export interface ResolvedEndpoints {
  deployment: Deployment;
  ingestUrl: string;
  gatewayUrl: string;
}

/** Normalize an arbitrary stored value to a known deployment (default otherwise). */
export function normalizeDeployment(value: unknown): Deployment {
  return value === 'cloud' || value === 'desktop' ? value : DEFAULT_DEPLOYMENT;
}

/**
 * Resolve the concrete ingest + gateway endpoints for a stored config.
 * Explicit non-empty URLs override the chosen preset; otherwise the preset wins.
 */
export function resolveEndpoints(cfg: EndpointConfig = {}): ResolvedEndpoints {
  const deployment = normalizeDeployment(cfg.deployment);
  const preset = DEPLOYMENT_PRESETS[deployment];
  const explicit = (v: string | undefined): string => (v && v.trim() ? v.trim() : '');
  return {
    deployment,
    ingestUrl: explicit(cfg.ingestUrl) || preset.ingestUrl,
    gatewayUrl: explicit(cfg.gatewayUrl) || preset.gatewayUrl,
  };
}

```

### Core Architecture Module: `clients/extension/src/inpage.ts`
```
/**
 * In-page capture (MAIN world) — Google Meet (per-participant) + Zoom/Teams (mixed).
 *
 * GOOGLE MEET: the bot's browser-side per-speaker capture loop — each
 * participant's <audio>/<video> MediaStream is wired into an AudioWorklet that
 * emits resampled 16 kHz PCM. Where the bot called
 * window.__vexaPerSpeakerAudioData(index, data) across the Playwright bridge, we
 * postMessage the chunk to the content script, which relays it to the background
 * service worker's WebSocket (capture.v1 → the desktop ingest).
 *
 * ZOOM / MS TEAMS (MIXED lane): the inpage does NOT capture audio — the offscreen
 * document captures the whole tab's mixed audio (chrome.tabCapture → channel 999,
 * diarized by the desktop's mixed pipeline). The inpage's only job for these is to
 * emit speaker-name HINTS from the zoom-speakers / msteams-speakers DOM
 * (post('speaker_activity', …); Zoom 'dom-active', Teams blue-square 'dom-outline'),
 * which the background relays as capture.v1 active-speaker events to name the
 * mixed clusters server-side.
 *
 * It must run in the MAIN world (not the isolated content-script world) so it
 * can read the page-assigned el.srcObject MediaStream objects directly.
 *
 * Speaker attribution is the SHARED bricks @vexa/gmeet-capture (gmeet-speakers),
 * @vexa/zoom-capture (zoom-speakers), and @vexa/teams-capture (msteams-speakers)
 * — one algorithm for bot and extension.
 */

import {
  createGmeetSpeakers, GmeetSpeakers,
  createGmeetCapture, GmeetCapture, GmeetChannelBinder,
  createPcmCaptureNode,
} from '@vexa/gmeet-capture';
import { createZoomSpeakers, ZoomSpeakers, createZoomChat, ZoomChat } from '@vexa/zoom-capture';
import { createTeamsSpeakers, TeamsSpeakers, createTeamsChat, TeamsChat } from '@vexa/teams-capture';
import { createRecordingTap, type RecordingTap } from '@vexa/record-chunker';

(() => {
  const TAG = '[vexa-inpage]';

  // Takeover: if an older inpage instance is alive in this page (extension was
  // reloaded and re-injected), stop it completely before installing this one —
  // otherwise both capture and post duplicate audio/diag messages.
  try { (window as any).__vexaInpageTeardown?.(); } catch { /* old instance gone */ }

  // Capture epoch — the SINGLE source of truth for "who owns capture in this
  // page". Teardown-pointer chaining alone is racy (the pointer is overwritten by
  // each new instance and START can reach several instances), which let multiple
  // instances capture the same <audio> elements → 2-3× duplicated PCM (the
  // captured-audio stutter). Each instance claims a higher epoch on load; any
  // instance that is no longer the newest refuses to post audio and self-stops.
  const myEpoch = (((window as any).__vexaCaptureEpoch as number) || 0) + 1;
  (window as any).__vexaCaptureEpoch = myEpoch;
  const isCurrent = () => (window as any).__vexaCaptureEpoch === myEpoch;

  const TARGET_SAMPLE_RATE = 16000;

  let running = false;
  let countTimer: number | null = null;
  const contexts: AudioContext[] = [];

  // Per-participant Meet capture — SHARED gmeet brick (one codebase, bot + ext).
  let gmeetCapture: GmeetCapture | null = null;
  // Meeting RECORDING (separate concern from transcription): the combined Meet mix
  // (all participant <audio> elements) → recording.v1 chunks. The desktop stores them
  // and builds master.webm on stop. Meet-only here (per-participant lane); the MIXED
  // lane (YouTube/Zoom/Teams) records the tab stream in the OFFSCREEN document instead.
  let recordingTap: RecordingTap | null = null;
  // Per-channel glow correlation — names each channel from the tile whose glow ONSET
  // aligns with that channel's audio onset (NOT the global glow, which leaks across
  // channels). Fed glow edges from gmeet-speakers; queried per audio frame below.
  const channelBinder = new GmeetChannelBinder();

  // Reserved high index for the local microphone ("You"), kept clear of the
  // 0-based participant element indices.
  const MIC_INDEX = 1000;
  let micStream: MediaStream | null = null;

  function post(type: string, payload: any) {
    window.postMessage({ __vexa: true, type, ...payload }, '*');
  }

  // Speaker attribution — shared bricks (one codebase for bot + extension).
  //   Meet: gmeet-speakers (per-track vote/lock)  → window.__vexaGmeetSpeakers
  //   Zoom: zoom-speakers (active-speaker DOM)     → window.__vexaZoomSpeakers
  // Meet capture emits only "who's lit when" HINTS; the per-participant
  // channel→name BINDING happens via the per-channel glow correlator below.
  // Zoom audio is the mixed offscreen tabCapture track (999); we emit the DOM
  // active-speaker timeline as hints that name those clusters server-side.
  let speakers: GmeetSpeakers | null = null;
  let zoomSpeakers: ZoomSpeakers | null = null;
  let zoomChat: ZoomChat | null = null;
  let teamsSpeakers: TeamsSpeakers | null = null;
  let teamsChat: TeamsChat | null = null;

  // Teams hosts (mirrors 0.11 isTeamsHost): teams.live.com, teams.microsoft.com
  // (+ subdomains), teams.cloud.microsoft.
  function isTeamsHost(): boolean {
    return location.hostname.endsWith('teams.live.com')
      || location.hostname.endsWith('teams.microsoft.com')
      || location.hostname === 'teams.cloud.microsoft';
  }

  function startSpeakerAttribution(): void {
    if (location.hostname.endsWith('meet.google.com')) {
      if (speakers) return;
      const selfName = (document.querySelector('[data-self-name]') as HTMLElement | null)
        ?.getAttribute('data-self-name')?.trim() || undefined;
      // Pin the self/host name as never-bindable on a remote channel (the leak-proof
      // backstop — the host's own audio is the mic, never a remote <audio>). Set now if
      // known, and again via onSelf if the data-self-name marker only renders later.
      if (selfName) channelBinder.setSelfName(selfName);
      speakers = createGmeetSpeakers({
        selfName,
        log: (m) => console.log(`${TAG} ${m}`),
        onSelf: (name) => channelBinder.setSelfName(name),
        onSpeaking: (name, isEnd) => {
          channelBinder.recordGlow(name, isEnd, Date.now());   // feed the per-channel correlator
          post('speaker_activity', { name, isEnd, kind: 'dom-active' });
        },
      });
      (window as any).__vexaGmeetSpeakers = speakers;
      console.log(`${TAG} shared gmeet-speakers HINT emitter started (self="${selfName || 'unknown'}")`);
    } else if (location.hostname.endsWith('zoom.us')) {
      if (zoomSpeakers) return;
      const selfName = (document.querySelector('[data-self-name]') as HTMLElement | null)
        ?.getAttribute('data-self-name')?.trim() || undefined;
      // Zoom audio is the mixed tabCapture track (999) captured by the offscreen
      // document — the inpage does NOT capture audio here. The server diarizes
      // that track into per-speaker clusters; the DOM active-speaker timeline is
      // sent as timestamped HINTS that name those clusters (never track relabels).
      zoomSpeakers = createZoomSpeakers({
        selfName,
        log: (m) => console.log(`${TAG} [zoom] ${m}`),
        onSpeakerChange: (name) => post('speaker_activity', { name: name || '', isEnd: !name, kind: 'dom-active' }),
      });
      (window as any).__vexaZoomSpeakers = zoomSpeakers;
      console.log(`${TAG} shared zoom-speakers HINT emitter started (self="${selfName || 'unknown'}")`);
      // Chat capture — each message becomes a capture.v1 `chat` event. The chat
      // panel must be open for messages to exist in the DOM.
      if (!zoomChat) {
        zoomChat = createZoomChat({
          log: (m) => console.log(`${TAG} [zoom-chat] ${m}`),
          onMessage: ({ sender, text }) => post('chat-message', { sender, text }),
        });
        (window as any).__vexaZoomChat = zoomChat;
      }
    } else if (isTeamsHost()) {
      if (teamsSpeakers) return;
      const selfName = (document.querySelector('[data-self-name]') as HTMLElement | null)
        ?.getAttribute('data-sel
```

### Core Architecture Module: `clients/extension/src/meeting.ts`
```
/**
 * Platform + native-meeting-id detection from a tab URL — Google Meet, YouTube,
 * Zoom, and MS Teams. Shared by the content script (auto-start trigger) and the
 * background worker (session bootstrap).
 */

export interface MeetingRef {
  platform: 'google_meet' | 'youtube' | 'zoom' | 'teams';
  nativeMeetingId: string;
}

export function detectMeeting(url: string): MeetingRef | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  // Google Meet — meet.google.com/abc-defg-hij
  if (u.hostname.endsWith('meet.google.com')) {
    const seg = u.pathname.split('/').filter(Boolean)[0];
    if (seg && /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(seg)) {
      return { platform: 'google_meet', nativeMeetingId: seg };
    }
    return null;
  }

  // YouTube — youtube.com/watch?v=ID. The MIXED lane: the tab's <video> is one
  // mixed audio stream the desktop diarizes with pyannote (no per-speaker channels).
  if (u.hostname.endsWith('youtube.com')) {
    const v = u.searchParams.get('v');
    if (v) return { platform: 'youtube', nativeMeetingId: v };
    return null;
  }

  // Zoom — MIXED lane (offscreen tabCapture → channel 999, diarized by the
  // desktop's mixed pipeline) PLUS speaker-name hints from the zoom-speakers DOM.
  // Native id = the 9-11 digit meeting number. Mirrors the 0.11 server parser
  // (services/meeting-api/meeting_api/schemas.py): /j/<id>, /w/<id>, /wc/join/<id>,
  // and the web-client /wc/<id>/... shape. Hosts include zoom.us subdomains
  // (us02web.zoom.us, app.zoom.us, <company>.zoom.us).
  if (u.hostname.endsWith('zoom.us')) {
    const parts = u.pathname.split('/').filter(Boolean);
    let id = '';
    if (parts.length >= 2 && (parts[0] === 'j' || parts[0] === 'w')) {
      id = parts[1];                                   // /j/<id>, /w/<id>
    } else if (parts.length >= 3 && parts[0] === 'wc' && parts[1] === 'join') {
      id = parts[2];                                   // /wc/join/<id>
    } else if (parts.length >= 2 && parts[0] === 'wc') {
      id = parts[1];                                   // /wc/<id>/... (web client)
    }
    if (/^\d{9,11}$/.test(id)) return { platform: 'zoom', nativeMeetingId: id };
    return null;
  }

  // MS Teams — MIXED lane (offscreen tabCapture → channel 999, diarized by the
  // desktop's mixed pipeline) PLUS the blue-square speaker hints from the
  // msteams-speakers DOM. Native id = the 10-15 digit meeting number. Mirrors
  // the 0.11 server parser (services/meeting-api/meeting_api/schemas.py
  // parse_meeting_url): teams.live.com/meet/<id> (personal) and the enterprise
  // hosts' /meet/<id> short URL + /v2/...#/meet/<id> deep-link fragment. Hosts:
  // teams.live.com, teams.microsoft.com (+subdomains), teams.cloud.microsoft.
  if (
    u.hostname.endsWith('teams.live.com') ||
    u.hostname.endsWith('teams.microsoft.com') ||
    u.hostname === 'teams.cloud.microsoft'
  ) {
    // /meet/<10-15 digits> on the path (personal + enterprise short URL)…
    let m = u.pathname.match(/^\/meet\/(\d{10,15})\/?$/);
    // …or the enterprise deep-link form /v2/?…#/meet/<id>?p=… (id in the hash).
    if (!m && u.hash) m = u.hash.replace(/^#/, '').match(/^\/meet\/(\d{10,15})\b/);
    if (m) return { platform: 'teams', nativeMeetingId: m[1] };
    return null;
  }

  return null;
}

/** True when the URL is a known MIXED-lane host (whole-tab audio), regardless of
 *  whether the meeting id is in the URL yet. Used to mint the tabCapture stream on
 *  the toolbar click for hosts like teams.cloud.microsoft that expose the id only
 *  via the DOM (the content script reports the thread id separately). */
export function isMixedHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h.endsWith('youtube.com') || h.endsWith('zoom.us')
      || h.endsWith('teams.microsoft.com') || h.endsWith('teams.live.com') || h === 'teams.cloud.microsoft';
  } catch {
    return false;
  }
}

```

### Core Architecture Module: `clients/extension/src/mic-permission.ts`
```
/**
 * One-time mic permission grant page.
 *
 * Opened in a normal tab (not the side panel / offscreen doc, which can't show
 * a permission prompt). getUserMedia here triggers Chrome's prompt; granting it
 * persists permission for the extension origin, so the offscreen capture works
 * thereafter.
 */
const statusEl = document.getElementById('status')!;

async function grant(): Promise<void> {
  statusEl.textContent = 'Requesting…';
  statusEl.className = '';
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach(t => t.stop());
    statusEl.textContent = 'Microphone enabled. Go back to the Vexa panel and press Start.';
    statusEl.className = 'ok';
  } catch (err: any) {
    statusEl.textContent = `Permission ${err.name === 'NotAllowedError' ? 'denied' : 'failed'}: ${err.name}. `
      + 'Click Enable again, or allow the mic in the address bar.';
    statusEl.className = 'err';
  }
}

document.getElementById('grant')!.addEventListener('click', grant);
grant();

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1695** (2026-09-17): **Dev jeevan**
  *Symptoms*: <!-- The PR carries TWO artifacts, judged on different axes (docs/docs/governance/delivery.mdx D8):      the OBSERVATION BUNDLE answers "is the value real?"; the DIFF answers "is it correct and safe?".      A diff with no bundle is not reviewable. -->  > 👋 **Highly recommended (not required): say hi on [Discord](https://discord.gg/Ga9duGkVz9)** and > tell us, in a sentence or two, **what** you're changing and **why** — the story behind the diff. > It makes reviewing your value bundle faster and connects you to the reporter and the maintainers. > Your PR is judged on its evidence, not on whether you show up — but showing up helps a lot.  **Delivers issue:** #  ## Contribution rights <!-- Select exactly ONE. This is a legal certification: an agent may explain the choices but      must not select one for you. See CONTRIBUTOR_RIGHTS.md. -->  - [ ] **Independent:** I created this contribution, or otherwise have the right to submit it   under Apache-2.0, and it is not owned or controlled by an employer, client, or other entity.   <!-- rights:independent --> - [ ] **Employer/client authorization required:** an employer, client, or other entity owns or   may control this contribution. I am requesting Vexa's private corporate-authorization process.   <!-- rights:corporate --> - [ ] **Unsure:** I need a private rights review before merge.   <!-- rights:uncertain -->  Every commit must also carry the contributor's own DCO `Signed-off-by` line. Selecting the ind
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for opening your first PR to Vexa, @AumJeevan24!  **Highly recommended (not required):** hop into our [Discord](https://discord.gg/Ga9duGkVz9) and tell us in a sentence or two **what** this change does and **why**. It helps us review your value bundle faster and connects you with the reporter and maintainers.  Your PR is judged on its evidence — the observation bundle + the diff — not on whether you show up. But showing up makes the whole thing smoother. See [the delivery guide](https://docs.vexa.ai/governance/delivery) for how a PR reaches merge.
  > #### ⚠️ GitGuardian has uncovered 1 secret following the scan of your pull request.  Please consider investigating the findings and remediating the incidents. Failure to do so may lead to compromising the associated services or software components.  Since your pull request originates from a forked repository, GitGuardian is not able to associate the secrets uncovered with secret incidents on your GitGuardian dashboard. Skipping this check run and merging your pull request will create secret incidents on your GitGuardian dashboard.  <details> <summary>🔎 Detected hardcoded secret in your pull request</summary> <br>  | GitGuardian id | GitGuardian status | Secret                         | Commit           | Filename        |                      | | -------------- | ------------------ | ------------------------------ | ---------------- | --------------- | -------------------- | | [-](https://dashboard.gitguardian.com/workspace/695876/incidents/secrets) | - | Generic Password | 9f134b5199
  > <!-- merge-card --> ### 🃏 Merge card — #1695  | check | | what it needs | |---|---|---| | **Value** | ❌ | missing `state: value-signed` (the value sign-off) | | **Diff** | ❌ | no non-author approval on the current head sha (a new push dismisses a stale approval) |  **Not mergeable yet** — every row above must be accepted before merge (choke point 1). Fill in what's ❌ above, then this clears automatically.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>

- **Issue #1685** (2026-09-28): **fix(deploy): MinIO sidecar images from quay.io, pinned — Docker Hub minio/* no longer pulls (#1671)**
  *Symptoms*: **Delivers issue:** #1671 (item 1 — the MinIO registry blocker), and the repo-wide `pr-value` break it causes.  **This is the MinIO slice of #1679, carved out so the CI break can land on its own.** The hunks on `docker-compose.yml`, `values.yaml`, `.env.example` and `image-licenses.json` are byte-identical to #1679's; the Lite Makefile and docs carry only the MinIO paragraphs. Git merges identical changes cleanly, so either PR can land first. If #1679 gets its value sign-off first, close this one.  ## Contribution rights <!-- Select exactly ONE. This is a legal certification: an agent may explain the choices but      must not select one for you. See CONTRIBUTOR_RIGHTS.md. -->  - [ ] **Independent:** I created this contribution, or otherwise have the right to submit it   under Apache-2.0, and it is not owned or controlled by an employer, client, or other entity.   <!-- rights:independent --> - [ ] **Employer/client authorization required:** an employer, client, or other entity owns or   may control this contribution. I am requesting Vexa's private corporate-authorization process.   <!-- rights:corporate --> - [ ] **Unsure:** I need a private rights review before merge.   <!-- rights:uncertain -->  ## Observation bundle  - **Why every PR is red —** ran: `gh run view --log-failed` on [#1677's pr-value run](https://github.com/Vexa-ai/vexa/actions/runs/35207960786) · saw: `value-fsm` dies in the session `stack` fixture at `docker compose up -d --build` with `pull access denied for
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1685  | check | | what it needs | |---|---|---| | **Value** | ❌ | missing `state: value-signed` (the value sign-off) | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) |  **Not mergeable yet** — every row above must be accepted before merge (choke point 1). Fill in what's ❌ above, then this clears automatically.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>
  > Closing: quay.io stopped serving these images anonymously, so this no longer fixes the install. #1740 replaces MinIO instead.  <!-- vexa-agent -->

- **Issue #1674** (2026-09-16): **README: three doors under the title block (connect · API key · founder); credit line matches pricing**
  *Symptoms*: The README linked into vexa.ai only through sign-in and the account page. This adds one row under the title block with the same three doors as the home page: Connect your agent, Get an API key, Talk to the founder.  Also corrects the free-credit sentence in Quickstart to match vexa.ai/pricing.  Five added lines and one corrected sentence; nothing else touched.  ## Contribution rights - [x] **Independent:** I created this contribution, or otherwise have the right to submit it   under Apache-2.0, and it is not owned or controlled by an employer, client, or other entity.   <!-- rights:independent --> - [ ] **Employer/client authorization required:** an employer, client, or other entity owns or   may control this contribution. I am requesting Vexa's private corporate-authorization process.   <!-- rights:corporate --> - [ ] **Unsure:** I need a private rights review before merge.   <!-- rights:uncertain --> <!-- vexa-agent -->
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1674  | check | | what it needs | |---|---|---| | **Value** | ✅ | non-runtime + value-signed | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) |  **Ready to merge** — every row above is accepted.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>  ✓ merge-card — card accepted for: #1674

- **Issue #1661** (2026-09-07): **carve: prune the claude-plugin CALM node — clients/claude-plugin stays out of the carve**
  *Symptoms*: **COMMITMENTS IN THIS DRAFT — none.**  Founder ruling 2026-09-07: `clients/claude-plugin` is **excluded** from the FINOS carve. `architecture.calm.json` names the node at that path, so the carved tree failed `gate:dataflow` (completeness) on the v0.12.27 train. The carve's CALM prune already drops `clients/dashboard` and `clients/extension` for the same reason; this adds `clients/claude-plugin` to that list. Replaces #1660 (closed).  One line in `carve/transform.sh`. `docs: none` — carve tooling only.  Refs DmitriyG228/biz#451  ## Contribution rights  - [x] **Independent:** I created this contribution, or otherwise have the right to submit it   under Apache-2.0, and it is not owned or controlled by an employer, client, or other entity.   <!-- rights:independent --> - [ ] **Employer/client authorization required.** <!-- rights:corporate --> - [ ] **Unsure.** <!-- rights:uncertain -->  <!-- vexa-agent -->
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1661  | check | | what it needs | |---|---|---| | **Value** | ✅ | non-runtime + value-signed | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) |  **Ready to merge** — every row above is accepted.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>  ✓ merge-card — card accepted for: #1661

- **Issue #1660** (2026-09-07): **carve: include clients/claude-plugin (v0.12.27 train failed gate:dataflow on the carved tree)**
  *Symptoms*: **COMMITMENTS IN THIS DRAFT — none.**  The v0.12.27 train cannot be carved: `architecture.calm.json` names node `claude-plugin` at `clients/claude-plugin`, and that path is not in `CARVE_INCLUDE`, so the carved tree fails `gate:dataflow` (completeness) and the routine refuses to push. The directory is a Claude Code plugin manifest plus two skills — no code, nothing private. Carved in, next to `clients/terminal` and `clients/slim`, per the 2026-09-02 ruling that everything syncs.  One line in `carve/manifest.sh`. `docs: none` — carve tooling only.  Refs DmitriyG228/biz#451  ## Contribution rights  - [x] **Independent:** I created this contribution, or otherwise have the right to submit it   under Apache-2.0, and it is not owned or controlled by an employer, client, or other entity.   <!-- rights:independent --> - [ ] **Employer/client authorization required.** <!-- rights:corporate --> - [ ] **Unsure.** <!-- rights:uncertain -->  <!-- vexa-agent -->
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1660  | check | | what it needs | |---|---|---| | **Value** | ✅ | non-runtime + value-signed | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) |  **Ready to merge** — every row above is accepted.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>  ✓ merge-card — card accepted for: #1660
  > Closed — founder ruling 2026-09-07: `clients/claude-plugin` is excluded from the carve. The CALM node is pruned in `carve/transform.sh` instead (follow-up PR).  <!-- vexa-agent -->

- **Issue #1656** (2026-09-07): **promote: an ABSENT negative-control tag is unchanged, not an error**
  *Symptoms*: Blocks the v0.12.27 release — the last thing between a fully green promote and the moving tag.  Run [34105335802](https://github.com/Vexa-ai/vexa/actions/runs/34105335802): nine validate legs green on the published `:v0.12.27` images, image-identity green, **guarantee line 7 green on the founder's signed receipt**, guarantee line 8 green, the owner's `release-promote` Environment approval given — then `promote` died with  ``` registry-manifest-alias [registry]: vexaai/v012-admin-api@latest: manifest read: registry HTTP 404: {"errors":[{"code":"MANIFEST_UNKNOWN","message":"manifest unknown","detail":"unknown tag=latest"}]} ```  Moving `:v012` asserts `latest` is unchanged as a negative control. **`vexaai/v012-admin-api` has no `latest` tag** — of the whole v012 set only `vexaai/vexa-lite` does — so the control read 404'd and aborted the promotion. Absent before and absent after is exactly the control holding.  - `request()` gains `allowMissing`, returning `null` on 404 - `rawRegistryManifest` passes it through **for the negative control only** — every other manifest read keeps 404 as a failure - the comparison is absent-aware, and a control that **appears** during the alias still fails - two tests: absent stays absent → promotion proceeds; absent → present → rejected. `registry-candidate-validate.test.mjs` 15 pass; the map, gating and witness-gate suites green too  This is the third machinery defect the promote path has surfaced today, all from the same cause: nothing has take
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1656  | check | | what it needs | |---|---|---| | **Value** | ✅ | non-runtime + value-signed | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) |  **Ready to merge** — every row above is accepted.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>  ✓ merge-card — card accepted for: #1656

- **Issue #1654** (2026-09-07): **release: pin the v0.12.27 stable-promotion map identity**
  *Symptoms*: Blocks the v0.12.27 release. Run [34094971517](https://github.com/Vexa-ai/vexa/actions/runs/34094971517): all nine validate legs green on the published `:v0.12.27` images, image-identity green, **guarantee line 7 green on the founder's signed receipt**, guarantee line 8 green, the owner's `release-promote` Environment approval given — and `promote` then refused with `v0.12.27 has no reviewed stable-promotion map identity`.  `promote` carries its **own** map table, independent of the resolve table, so the moving tag never moves on a map nobody re-pinned there. Only `v0.12.18` and `v0.12.23` have arms; 0.12.24, 0.12.25 and 0.12.26 were published by tag push and never took this path.  This adds `v0.12.27) EXPECTED_MAP_SHA256=5dfc6f51c2b2cde6ba0f152b06de0ae35624c09e8ad159b3555cd92c6674178d` — the frozen packet on main (rc.5, validate run [34059966981](https://github.com/Vexa-ai/vexa/actions/runs/34059966981), nine legs green). It is the same hash the resolve table pins, re-stated because this table is a second review rather than a copy.  `release/*.test.mjs` 33 pass; the workflow parses.  After merge: re-dispatch `release-validate` with `promote: true` from main; the moving tag `:v012` then moves to the witnessed digests and the release is complete.  COMMITMENTS IN THIS DRAFT — none. <!-- vexa-agent -->  ## Contribution rights <!-- Select exactly ONE. This is a legal certification: an agent may explain the choices but      must not select one for you. See CONTRIBUTOR_RIGHTS.md. -
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1654  | check | | what it needs | |---|---|---| | **Value** | ✅ | non-runtime + value-signed | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) |  **Ready to merge** — every row above is accepted.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>  ✓ merge-card — card accepted for: #1654

- **Issue #1651** (2026-09-06): **release-witness-gate: a receipt may name the candidate it walked, not only the published tag**
  *Symptoms*: Found while drafting the v0.12.27 witness receipt (#1649).  `validateReceipt` demanded `candidate === version` — that the receipt witness `:vX.Y.Z`, a tag that does not exist until `promote` publishes it. So the pass had to happen before the artifact it attests to. It is not hypothetical: **`releases/v0.12.23/witness.json` carries `candidate: "v0.12.23-rc.18"` and would fail this check today**; the other eight receipts pass only because they were filled in after their tag was already published.  A candidate of the same release is not a different artifact: `release-images`' stable job **copies the witnessed candidate's descriptors** ("publish exact witnessed candidate as stable") and never rebuilds, so witnessing `rc.N` is witnessing the bytes that become `:vX.Y.Z`.  - accept `vX.Y.Z` and `vX.Y.Z-*` - still reject a candidate of a **different** release (`v9.9.8-rc.1` for `v9.9.9`) - still reject a mere prefix collision (`v9.9.90-rc.1` for `v9.9.9`) - four tests added; `node --test scripts/release-witness-gate.test.mjs` → 16 pass  Verified against the real v0.12.27 receipt: with this change the gate's only remaining failure is `signed_off is not true`, which is the founder's act.  COMMITMENTS IN THIS DRAFT — none. <!-- vexa-agent -->  ## Contribution rights <!-- Select exactly ONE. This is a legal certification: an agent may explain the choices but      must not select one for you. See CONTRIBUTOR_RIGHTS.md. -->  - [x] **Independent:** I created this contribution, or otherwise 
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1651  | check | | what it needs | |---|---|---| | **Value** | ✅ | non-runtime + value-signed | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) |  **Ready to merge** — every row above is accepted.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>  ✓ merge-card — card accepted for: #1651

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

### Incident Patch 1: `71321ad0` (2026-09-06)
**Commit Message**: release: unbind the v0.12.27-rc.3 packet — superseded by the Zoom fix (#1631), rc.5 rebuilds the set (#1633)

With releases/v0.12.27/candidate-images.json bound to rc.3, release-images' planner reads the
delta from that map's build_source and allows only a full rebuild or the Bot+Lite delta; the
#1631 change (mcp) surfaces as mcp + bot + lite and preflight refuses
(run 34050271135 on v0.12.27-rc.4: 'unsupported partial candidate build'). Remove the rc.3 map,
its resolve-table arm and its canonical test so the next tag builds the full set from source;
rc.5 is bound, validated and frozen in its place. The rc.3 identity stays in git history and in
the seq-32..34 ledger entries; rc.4 stands as an attempt that never built.

Signed-off-by: DmitriyG228 <2280905@gmail.com>

**File**: `.github/workflows/release-validate.yml` (modified, +0/-7)
```diff
@@ -249,13 +249,6 @@ jobs:
               EXPECTED_TOP_DESCRIPTORS=10
               EXPECTED_PLATFORM_IDENTITIES=19
               ;;
-            v0.12.27-rc.3|v0.12.27)
-              CANDIDATE_MAP=releases/v0.12.27/candidate-images.json
-              EXPECTED_MAP_STABLE_TAG=v0.12.27
-              EXPECTED_MAP_SHA256=dd4e9ad62cf327a0320262329a8eb55a58116415a0f3615e8c5d8ae84f4eb055
-              EXPECTED_TOP_DESCRIPTORS=11
-              EXPECTED_PLATFORM_IDENTITIES=21
-              ;;
             v0.12.26-rc.1|v0.12.26)
               CANDIDATE_MAP=releases/v0.12.26/candidate-images.json
               EXPECTED_MAP_STABLE_TAG=v0.12.26
```

**File**: `release/candidate-image-map.test.mjs` (modified, +0/-23)
```diff
@@ -357,29 +357,6 @@ test("v0.12.25 canonical packet binds the rc.1 train candidate", () => {
   );
 });
 
-test("v0.12.27 canonical packet binds the rc.3 train candidate (schema 2, eleven images)", () => {
-  const raw = readFileSync(
-    new URL("../releases/v0.12.27/candidate-images.json", import.meta.url),
-  );
-  assert.equal(
-    createHash("sha256").update(raw).digest("hex"),
-    "dd4e9ad62cf327a0320262329a8eb55a58116415a0f3615e8c5d8ae84f4eb055",
-  );
-  const map = validateCandidateMap(JSON.parse(raw), "v0.12.27");
-  assert.equal(map.schema_version, 2);
-  assert.equal(map.candidate_tag, "v0.12.27-rc.3");
-  assert.equal(map.build_source, "78be718f940a68253a8cd0188e7cfe8edd51d41c");
-  assert.equal(map.images["vexaai/vexa-bot"].digest, "sha256:e4be25d82b29b3bda1a50a33bd7fcc7db1b715dbfa887dc991819e7b1f581537");
-  assert.equal(Object.keys(map.images).length, 11);
-  assert.equal(
-    Object.values(map.images).reduce(
-      (count, image) => count + Object.keys(image.platform_manifests).length,
-      0,
-    ),
-    21,
-  );
-});
-
 test("v0.12.26 canonical packet binds the rc.1 train candidate", () => {
   const raw = readFileSync(
     new URL("../releases/v0.12.26/candidate-images.json", import.meta.url),
```

**File**: `releases/v0.12.27/RELEASE-NOTES.draft.md` (modified, +2/-2)
```diff
@@ -137,8 +137,8 @@ deployment relies on.
 
 ---
 
-**Images (eleven — `vexaai/v012-flows` joins the release set with this version):** `vexaai/v012-admin-api@sha256:bd43f2928c5c60096715383c9ed0dc33e88202630b5ff02c9685751c06b64aa6`, `vexaai/v012-runtime@sha256:ccbd50e384acf4fec6c7666794166af1f58968ad4b48c26831611c865825c4ea`, `vexaai/v012-agent-worker@sha256:75914538982acd7c703a8433e41cca976567b47163908f20c4222ee311306754`, `vexaai/v012-agent-api@sha256:cc8000bfb87eadf2b16aa3e8a00f729ab9a230d3cc07eece4cdebebc7e28d98a`, `vexaai/v012-meeting-api@sha256:bc3025f54b6c0452bda310e8a4d21f779951ef6437bb4de9330dc04d02e7d421`, `vexaai/v012-gateway@sha256:4f22de622093aeb77740df8d57b2a11b766c39dea7766663c3cf2ee36af14ec4`, `vexaai/v012-mcp@sha256:9ddd958646dd51be4b9fffe1c425ad742e754e7bef502d749fed58e3f5e66c32`, `vexaai/v012-terminal@sha256:02858350ca39862d57f81a16d645f8cfbb8404a2e1a6fbed6b1ad560ab5347c2`, `vexaai/vexa-bot@sha256:e4be25d82b29b3bda1a50a33bd7fcc7db1b715dbfa887dc991819e7b1f581537`, `vexaai/vexa-lite@sha256:65dc0fd1781ea7c15a064b66074dabaa3f304776188fe254d603654d4a559d85`, `vexaai/v012-flows@sha256:6ec683e4ff1570f7bb7a0c0134f8722264ce159f266e8b5ba377f8258b083df7`, published from the reviewed candidate packet
-`releases/v0.12.27/candidate-images.json` and validated by [run 33993759054](https://github.com/Vexa-ai/vexa/actions/runs/33993759054).
+**Images (eleven — `vexaai/v012-flows` joins the release set with this version):** <images>, published from the reviewed candidate packet
+`releases/v0.12.27/candidate-images.json` and validated by <validation run>.
 
 **In production:** this release is what vexa.ai runs, pinned as channel entry <channel entry> and
 re-verified against the cluster after the pin.
```

**File**: `releases/v0.12.27/candidate-images.json` (removed, +0/-226)
```diff
@@ -1,226 +0,0 @@
-{
- "schema_version": 2,
- "release": "v0.12.27",
- "stable_tag": "v0.12.27",
- "candidate_tag": "v0.12.27-rc.3",
- "build_source": "78be718f940a68253a8cd0188e7cfe8edd51d41c",
- "validation_source": "7ba34a301c7672c179d469fe56b75887775103b8",
- "build_run": "https://github.com/Vexa-ai/vexa/actions/runs/33985945402",
- "validation_run": "https://github.com/Vexa-ai/vexa/actions/runs/33993759054",
- "images": {
-  "vexaai/v012-admin-api": {
-   "class": "prod_deployed",
-   "digest": "sha256:bd43f2928c5c60096715383c9ed0dc33e88202630b5ff02c9685751c06b64aa6",
-   "platforms": [
-    "linux/amd64",
-    "linux/arm64"
-   ],
-   "platform_manifests": {
-    "linux/amd64": {
-     "manifest_digest": "sha256:f901c90d642372bd4d6d93a668381b098fc95eb96fa2593b82497aff011047f5",
-     "config_digest": "sha256:1f859168a6f40c00f006ecb2f28872e13cca0148bf1a912fb44a999639a4e3ab"
-    },
-    "linux/arm64": {
-     "manifest_digest": "sha256:e5f0d53b41c8dd0efcc246e4673fb44db9a99a685a1ce0e51dde73fed1a2e055",
-     "config_digest": "sha256:e5d0430499f552c8b82e20d14842952693e455910897fe75a59d0d5a8c9a98b2"
-    }
-   },
-   "attestations": true,
-   "evidence": "candidate build run 33985945402 at 78be718f; exact registry identities collected after the image job completed"
-  },
-  "vexaai/v012-runtime": {
-   "class": "prod_deployed",
-   "digest": "sha256:ccbd50e384acf4fec6c7666794166af1f58968ad4b48c26831611c865825c4ea",
-   "platforms": [
-    "linux/amd64",
-    "linux/arm64"
-   ],
-   "platform_manifests": {
-    "linux/amd64": {
-     "manifest_digest": "sha256:a6f62fa2209f4210d646e859185514f5c588893b366e957bd0be4b81776bf0bf",
-     "config_digest": "sha256:ed1fa17a8180b3bbf15e6783d5f2ef576894d9e022a21441f9bdda58ee708147"
-    },
-    "linux/arm64": {
-     "manifest_digest": "sha256:e24b2a310c0d63332880193d2ced86b5d26ecb58b3d72f1351b9d21a5856dd25",
-     "config_digest": "sha256:3c1cc0ac3821bc5251308ecb26d80855d04e2346c4da21ca876189bcad017556"
-    }
-   },
-   "attestations": true,
-   "evidence": "candidate build run 33985945402 at 78be718f; exact registry identities collected after the image job completed"
-  },
-  "vexaai/v012-agent-worker": {
-   "class": "oss_only",
-   "digest": "sha256:75914538982acd7c703a8433e41cca976567b47163908f20c4222ee311306754",
-   "platforms": [
-    "linux/amd64",
-    "linux/arm64"
-   ],
-   "platform_manifests": {
-    "linux/amd64": {
-     "manifest_digest": "sha256:3594150db20a606635d37a7c0746fb6cf3fad4fa9523e11821b056924d4f59b3",
-     "config_digest": "sha256:9fd33925563d679fbd0282d465283c9a9c9ace1fe831250dd787f90b849ae51a"
-    },
-    "linux/arm64": {
-     "manifest_digest": "sha256:e5e5529a85d28727cef58f910346670cc96acc215a3e61f10a0984c2028e24a9",
-     "config_digest": "sha256:06f47ac632e754452819746d69d4e4982231227c63522d1b9cb0e9b8dec5a280"
-    }
-   },
-   "attestations": true,
-   "evidence": "candidate build run 33985945402 at 78be718f; exact registry identities collected after the image job completed"
-  },
-  "vexaai/v012-agent-api": {
-   "class": "oss_only",
-   "digest": "sha256:cc8000bfb87eadf2b16aa3e8a00f729ab9a230d3cc07eece4cdebebc7e28d98a",
-   "platforms": [
-    "linux/amd64",
-    "linux/arm64"
-   ],
-   "platform_manifests": {
-    "linux/amd64": {
-     "manifest_digest": "sha256:85208c1d49c3b7695427c322832856ee0bf3a0075da69dd756b5de28d3cd68b6",
-     "config_digest": "sha256:7120079a415def96ccf53d58d2b19c46fb2a9e52d3b1d40d88a189d3b42e06eb"
-    },
-    "linux/arm64": {
-     "manifest_digest": "sha256:b192dc868f993c836138caadbbd8b65c12d6e9fa39a3c9a21dfb92773e3185d1",
-     "config_digest": "sha256:a7c0b0d66079a5912cae56878c1e97ddfeab341228c5f2b14be1edb2d655d2fc"
-    }
-   },
-   "attestations": true,
-   "evidence": "candidate build run 33985945402 at 78be718f; exact registry identities collected after the image job completed"
-  },
-  "vexaai/v012-meeting-api": {
-   "class": "prod_deployed",
-   "digest": "sha256:bc3025f54b6c0452bda310e8a4d21f779951ef6437
```

---

### Incident Patch 2: `6dd9cb27` (2026-08-31)
**Commit Message**: train 0.12.26 — one drain: Zoom per-track attribution, popup sweep, typed join evidence, probe + noble build fixes (#1371)

* docs(changelog): #1011 fragment — say what the change does, not what was already true

The fragment claimed the images "now run the Python interpreter as a non-root
user." They already did: the agent worker execs its venv as a non-root
per-subject uid in core/runtime/src/runtime_kernel/isolation.py, which predates
this PR. What #1011 changes is the traverse bit on /root, so that existing
non-root exec can actually reach its uv-managed interpreter — plus the single
Noble base shared by Lite and the full bot.

Fragments reach the public release notes; this one would have shipped a
hardening claim we did not make.

Signed-off-by: DmitriyG228 <2280905@gmail.com>

* fix(speaker-split): recognize Zoom's speaker-view active tile

Zoom's active-speaker container moved to the single-view family (single-suspension/single-main); match it so mixed-lane speaker hints cross again. Includes the live speaking-tile diagnostics used to find it (Teams + Zoom).

Signed-off-by: Jacob Schooley <jacob@schooley.com>
Signed-off-by: DmitriyG228 <2280905@gmail.com>

* fix(mixed): stam

**File**: `core/meetings/contracts/lifecycle.v1/README.md` (modified, +42/-0)
```diff
@@ -36,4 +36,46 @@ ownership remains unresolved for downstream billing. An admitted mixed-version s
 lifecycle event lacks a producer timestamp is likewise unresolved: receiver time remains useful
 for operations, but retry latency makes it invalid for rating.
 
+## `join_evidence` — typed join-failure evidence (#1059, #1058)
+
+An **additive** field on a terminal `failed` event, riding this contract's liberal ingestion
+(`additionalProperties: true`) exactly as `infra_fault` and `stt_fault` do — **no schema change, no
+seal bump**. The sealed `CompletionReason` enum is deliberately untouched: it is the retry
+classifier's input (`lifecycle/retry.py`), and this is a diagnostic axis, not a retry input.
+
+It exists because `completion_reason` alone could not answer either question an operator asks of a
+failed join. In hosted production, every one of 83 consecutive `join_failure` meetings carried
+`data.reason = None`, and a ~20s Teams refusal shared its label with a ~13min Google Meet lobby
+expiry — two different owners, two different fixes, one number.
+
+```jsonc
+"join_evidence": {
+  "reason":      "awaiting_admission_timeout",
+                                        // WHAT: awaiting_admission_rejected · awaiting_admission_timeout ·
+                                        //   auth_session_missing · never_reached_lobby ·
+                                        //   navigation_failure · stopped_while_joining · unknown
+                                        //   (the first three are the SEALED enum's own words: one
+                                        //    word per fact, so the axes layer instead of competing)
+  "attribution": "host_action",         // WHO:  system_fault · user_action · host_action ·
+                                        //   exogenous_platform · unknown
+  "source":      "bot",                 // bot (first-hand) · reconcile · runtime_destroy · derived
+  "stage":       "awaiting_admission",
+  "detail":      "…the platform's own signal that triggered the classification (capped)…",
+  "timings":     { "time_to_lobby_ms": 7000, "time_in_lobby_ms": 780000, "total_ms": 787000 },
+  "lobby_budget_ms": 600000             // the deadline the control plane itself issued
+}
+```
+
+The producer (`services/bot/src/join-evidence.ts`) classifies at the source, where the platform
+signal and the clock actually are; meeting-api (`lifecycle/join_evidence.py`) validates that verdict
+and **derives** one when a producer sends none, so reconcile-driven and runtime-destroy terminals —
+and any bot too old to classify — are evidenced too. Persisted at `meeting.data.join_evidence`,
+alongside a top-level `meeting.data.reason`.
+
+`attribution` is the axis the reliability gate reads:
+`system_failure_rate = failures(attribution = system_fault) / fair-chance meetings`, per release and
+per platform. An absent timing is **absent**, never zero — "nobody measured" and "zero ms" are
+different facts. Producing this evidence is **fail-open**: it describes a run that has already
+ended, and no fault in it may alter the terminal being recorded.
+
 No auth token (transport-layer), no tenancy fields (deferred). Goldens validated by `gate:schema`.
```

**File**: `core/meetings/contracts/lifecycle.v1/golden/LifecycleEvent.failed-join-evidence.json` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+{
+  "connection_id": "sess-uid",
+  "status": "failed",
+  "timestamp": "2026-08-08T10:23:07.000Z",
+  "exit_code": 1,
+  "failure_stage": "awaiting_admission",
+  "completion_reason": "awaiting_admission_timeout",
+  "reason": "Bot is still in the Google Meet waiting room after timeout — host did not admit",
+  "join_evidence": {
+    "reason": "awaiting_admission_timeout",
+    "attribution": "host_action",
+    "source": "bot",
+    "stage": "awaiting_admission",
+    "detail": "Bot is still in the Google Meet waiting room after timeout — host did not admit",
+    "timings": {
+      "time_to_lobby_ms": 7000,
+      "time_in_lobby_ms": 780000,
+      "total_ms": 787000
+    },
+    "lobby_budget_ms": 600000
+  }
+}
```

**File**: `core/meetings/modules/join/src/zoom/leave.ts` (modified, +13/-0)
```diff
@@ -21,6 +21,19 @@ export async function dismissZoomPopups(page: Page): Promise<void> {
     // Doesn't block joining but spams logs and remains on screen
     // until manually dismissed. Click any of OK / Dismiss / Got it / Continue.
     { selector: '.zm-modal:has-text("mic is muted") button:has-text("OK"), .zm-modal:has-text("mic is muted") button:has-text("Got it"), .zm-modal:has-text("mic is muted") button:has-text("Dismiss"), .zm-modal:has-text("mic is muted") button:has-text("Continue")', label: 'mic-muted advisory' },
+    // Zoom advisory toast (confirmed live, in the recording frame): "For a better meeting
+    // experience, enable the option 'Use graphics/hardware acceleration' under browser system
+    // settings. Learn more". A dark non-blocking bar pinned top-center over the meeting — so it
+    // lands in the recording — dismissed only by an ✕ close control (NOT a text button), with a
+    // "Learn more" link we must never click. Anchored on the distinctive word "acceleration"
+    // (the wrapper class drifts across client builds) inside any of Zoom's notification/toast/modal
+    // shapes, then the close control by aria-label or a "close" class — never "Learn more".
+    { selector: [
+        ':is([class*="notification"], [class*="toast"], [class*="alert"], [class*="tip"], .zm-modal, [role="alert"], [role="dialog"]):has-text("acceleration") [aria-label*="close" i]',
+        ':is([class*="notification"], [class*="toast"], [class*="alert"], [class*="tip"], .zm-modal, [role="alert"], [role="dialog"]):has-text("acceleration") [class*="close" i]',
+        ':is([class*="notification"], [class*="toast"], [class*="alert"], [class*="tip"], .zm-modal, [role="alert"], [role="dialog"]):has-text("acceleration") :is(button, [role="button"]):has-text("Dismiss")',
+        ':is([class*="notification"], [class*="toast"], [class*="alert"], [class*="tip"], .zm-modal, [role="alert"], [role="dialog"]):has-text("acceleration") :is(button, [role="button"]):has-text("Got it")',
+      ].join(', '), label: 'hardware-acceleration advisory' },
   ];
 
   for (const { selector, label } of dismissTargets) {
```

**File**: `core/meetings/modules/join/src/zoom/removal.ts` (modified, +7/-0)
```diff
@@ -1,6 +1,7 @@
 import { Page } from "playwright";
 import { log } from "../_host";
 import { zoomLeaveButtonSelector, zoomMeetingEndedModalSelector, zoomRemovalTexts } from "./selectors";
+import { dismissZoomPopups } from "./leave";
 
 /**
  * Starts polling for removal/end-of-meeting events.
@@ -86,6 +87,12 @@ export function startZoomRemovalMonitor(
     if (stopped || !page || page.isClosed()) return;
 
     try {
+      // Sweep benign Zoom popups off the meeting on every poll — the "mic is muted" advisory, the AI
+      // Companion notice, feature tips — so they don't linger over the call or the server-side recording.
+      // dismissZoomPopups is text/selector-anchored + instant (timeout:0), no-ops when absent, and never
+      // touches the removal/end modal (that's detected below). Was previously only run on leave.
+      await dismissZoomPopups(page).catch(() => {});
+
       // Check for end-of-meeting modal (zm-modal-body-title)
       const modalEl = page.locator(zoomMeetingEndedModalSelector).first();
       const modalVisible = await modalEl.isVisible({ timeout: 300 }).catch(() => false);
```

**File**: `core/meetings/modules/mixed-capture-core/src/mixed-audio.ts` (modified, +12/-2)
```diff
@@ -36,7 +36,7 @@ export interface MixedAudioOptions {
 
 export async function createMixedAudioCapture(
   stream: MediaStream,
-  onPcm: (pcm: Float32Array) => void,
+  onPcm: (pcm: Float32Array, tsMs?: number) => void,
   opts: MixedAudioOptions = {},
 ): Promise<MixedAudioCapture> {
   const SR = opts.sampleRate ?? 16000;
@@ -47,11 +47,21 @@ export async function createMixedAudioCapture(
   const ctx = new AudioContext({ sampleRate: SR });
   const source = ctx.createMediaStreamSource(stream);
   const proc = ctx.createScriptProcessor(4096, 1, 1);
+  // Accumulated-audio-time clock: stamp each frame with the wall-clock of the AUDIO it holds
+  // (anchor + samples-so-far / rate), NOT Date.now() at callback time. The ScriptProcessor fires a
+  // buffer-length (~256ms) AFTER the audio was captured, and that latency + event-loop jitter is
+  // exactly what pushed frames out of the speaker-hint binder's match window (misattribution). Count
+  // ALL processed samples — silent frames included — so the clock never drifts from real time. It's
+  // the same page clock the active-speaker hints carry, so the binder can align them.
+  const startMs = Date.now();
+  let processedSamples = 0;
   proc.onaudioprocess = (e: AudioProcessingEvent) => {
     const input = e.inputBuffer.getChannelData(0);
+    const tsMs = startMs + (processedSamples / SR) * 1000;   // wall-clock of this frame's first sample
+    processedSamples += input.length;
     let maxVal = 0;
     for (let i = 0; i < input.length; i++) { const a = Math.abs(input[i]); if (a > maxVal) maxVal = a; }
-    if (maxVal > SILENCE) onPcm(new Float32Array(input));   // copy — the buffer is reused
+    if (maxVal > SILENCE) onPcm(new Float32Array(input), tsMs);   // copy — the buffer is reused
   };
   source.connect(proc);
   proc.connect(ctx.destination);                           // pull the processor (outputs silence)
```

---

### Incident Patch 3: `ad7311bc` (2026-08-30)
**Commit Message**: fix(mixed): preserve text-only custom STT results (#1149)

Signed-off-by: shopkueche <info@shopkueche.de>
Signed-off-by: Dmitry Grankin <dmitry@vexa.ai>
Co-authored-by: Dmitry Grankin <dmitry@vexa.ai>
Co-authored-by: Dmitry Grankin <39370484+DmitriyG228@users.noreply.github.com>

**File**: `core/meetings/modules/mixed-pipeline/README.md` (modified, +2/-0)
```diff
@@ -82,6 +82,8 @@ loaded and there is no network:
 - `ending-context.smoke.test.ts` — speech-end cuts send a small trailing context pad
   to STT so final words survive, while transcript timestamps stay clipped to the
   committed speech boundary.
+- `text-only-stt.smoke.test.ts` — the minimum custom-STT response (`text` without
+  provider timestamps) spans the submitted speech window and remains publishable.
 - `short-ui-switch.smoke.test.ts` — a short isolated Zoom/Teams UI speaker switch
   right after a different speaker stays provisional rather than stamping a wrong name;
   a longer turn by the new speaker still binds.
```

**File**: `core/meetings/modules/mixed-pipeline/package.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@vexa/mixed-pipeline",
   "version": "0.1.0",
-  "description": "Platform-specific mixed transcription: Teams routes CSRC-owned virtual channels through the shared GMeet window; Zoom/Jitsi retain the legacy Pyannote cut-only lane. No diarization, clustering, embeddings, or voiceprints.",
+  "description": "The mixed lane: one mixed audio stream \u2192 pyannote segmenter (cut-only, the only ONNX) + shared buffer/whisper + hints namer \u2192 transcript segments. Names from time-windowed hints; no diarization/clustering.",
   "type": "module",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
@@ -16,7 +16,7 @@
   ],
   "scripts": {
     "build": "tsc && rm -rf dist/hallucinations && cp -R src/hallucinations dist/hallucinations",
-    "test": "node eval-ui/safe-resource-url.test.mjs && node eval-ui/teams-contested-word-detector.test.mjs && node eval-ui/teams-csrc-timeline.test.mjs && node eval-ui/teams-csrc-live-transcript.test.mjs && node eval-ui/server.test.mjs && tsx src/teams-contested-word-marker.test.ts && tsx src/teams-csrc-channelizer.test.ts && tsx src/teams-csrc-gmeet-pipeline.test.ts && tsx src/confirm-loop.golden.test.ts && tsx src/pending-stability.test.ts && tsx src/naming.smoke.test.ts && tsx src/claim.smoke.test.ts && tsx src/priority.smoke.test.ts && tsx src/concurrency.smoke.test.ts && tsx src/flicker.smoke.test.ts && tsx src/hint-evidence.smoke.test.ts && tsx src/hint-outcome.smoke.test.ts && tsx src/ending-context.smoke.test.ts && tsx src/short-ui-switch.smoke.test.ts && tsx src/reattribute.smoke.test.ts && tsx src/claim-contested.smoke.test.ts && tsx src/never-lose-tail.test.ts && tsx src/gap-reclaim.test.ts && tsx src/hallucination-gate.test.ts && tsx src/hallucinations-are-subset.test.ts && tsx src/turn-source.smoke.test.ts && tsx src/track-namer.smoke.test.ts && tsx src/source-name-correlator.test.ts && tsx src/csrc-spine.smoke.test.ts && tsx src/virtual-time-equivalence.test.ts",
+    "test": "node eval-ui/safe-resource-url.test.mjs && node eval-ui/teams-contested-word-detector.test.mjs && node eval-ui/teams-csrc-timeline.test.mjs && node eval-ui/teams-csrc-live-transcript.test.mjs && node eval-ui/server.test.mjs && tsx src/teams-contested-word-marker.test.ts && tsx src/teams-csrc-channelizer.test.ts && tsx src/teams-csrc-gmeet-pipeline.test.ts && tsx src/confirm-loop.golden.test.ts && tsx src/pending-stability.test.ts && tsx src/naming.smoke.test.ts && tsx src/claim.smoke.test.ts && tsx src/priority.smoke.test.ts && tsx src/concurrency.smoke.test.ts && tsx src/flicker.smoke.test.ts && tsx src/hint-evidence.smoke.test.ts && tsx src/hint-outcome.smoke.test.ts && tsx src/ending-context.smoke.test.ts && tsx src/short-ui-switch.smoke.test.ts && tsx src/reattribute.smoke.test.ts && tsx src/claim-contested.smoke.test.ts && tsx src/never-lose-tail.test.ts && tsx src/gap-reclaim.test.ts && tsx src/hallucination-gate.test.ts && tsx src/hallucinations-are-subset.test.ts && tsx src/turn-source.smoke.test.ts && tsx src/track-namer.smoke.test.ts && tsx src/source-name-correlator.test.ts && tsx src/csrc-spine.smoke.test.ts && tsx src/virtual-time-equivalence.test.ts && tsx src/text-only-stt.smoke.test.ts",
     "check:isolation": "node scripts/check-isolation.js"
   },
   "dependencies": {
```

**File**: `core/meetings/modules/mixed-pipeline/src/chunked-transcriber.ts` (modified, +9/-3)
```diff
@@ -1048,9 +1048,15 @@ export class ChunkedTranscriber {
     // Map whisper segments (relative to spanStart) to audio time.
     const lang = this.cb.language || result!.language || 'en';
     const mapped = gated.map((ws) => {
-      const startMs = spanStart + (ws.start || 0) * 1000;
-      const rawEndMs = spanStart + (ws.end || 0) * 1000;
-      const endMs = Math.min(publishEnd, rawEndMs || publishEnd) || publishEnd;
+      const relativeStart = ws.start || 0;
+      const relativeEnd = ws.end || 0;
+      const startMs = spanStart + relativeStart * 1000;
+      // Provider timestamps are optional. A segment without a positive relative
+      // span represents the submitted speech window and ends at its committed edge.
+      const rawEndMs = relativeEnd > relativeStart
+        ? spanStart + relativeEnd * 1000
+        : publishEnd;
+      const endMs = Math.min(publishEnd, rawEndMs) || publishEnd;
       return {
         text: ws.text.trim(),
         startMs,
```

**File**: `core/meetings/modules/mixed-pipeline/src/text-only-stt.smoke.test.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+/**
+ * text-only-stt.smoke — an OpenAI-compatible endpoint may return only text.
+ * The mixed lane assigns that text to the submitted speech window so the
+ * minimum custom-STT response remains publishable without provider timestamps.
+ */
+import { ChunkedTranscriber, type BoundarySource } from './index.js';
+import type { BoundaryEvent } from './pyannote-segmenter.js';
+
+const SAMPLE_RATE = 16_000;
+const BASE_MS = 10_000;
+const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
+let emit: (event: BoundaryEvent) => void = () => {};
+const published: Array<{ text: string; startMs: number; endMs: number }> = [];
+
+const transcriber = await ChunkedTranscriber.create({
+  language: 'en',
+  transcribe: async () => ({
+    text: 'text-only custom STT response',
+    language: 'en',
+    duration: 2,
+    segments: [],
+  }),
+  publish: (_speaker, confirmed) => { published.push(...confirmed); },
+  publishPending: () => {},
+  clearPending: () => {},
+  rename: () => {},
+  makeSegmenter: async (onBoundary): Promise<BoundarySource> => {
+    emit = onBoundary;
+    return { appendFrame: async () => {}, reset: () => {} };
+  },
+});
+
+emit({ tMs: BASE_MS, kind: 'silence→speaker', confidence: 0.9 });
+await sleep(25);
+
+const halfSecond = new Float32Array(SAMPLE_RATE / 2).fill(0.1);
+for (let t = BASE_MS; t < BASE_MS + 2_000; t += 500) transcriber.feedAudio(halfSecond, t);
+emit({ tMs: BASE_MS + 2_000, kind: 'speaker→silence', confidence: 0.9 });
+await sleep(150);
+await transcriber.dispose();
+
+const segment = published.find((item) => item.text === 'text-only custom STT response');
+const hasSpeechSpan = Boolean(segment && segment.endMs > segment.startMs);
+
+console.log(`published=${JSON.stringify(published)}`);
+if (!hasSpeechSpan) {
+  console.error('❌ text-only STT response was not published with a positive speech span');
+  process.exit(1);
+}
+
+console.log('✅ text-only STT response spans the submitted speech window');
```

**File**: `docs/changelog.d/1148-text-only-stt.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+- **Text-only custom STT responses now reach the transcript (#1148).** OpenAI-compatible
+  endpoints may return only `text`; the mixed pipeline now assigns that text to the submitted
+  speech window instead of discarding it for missing provider timestamps. See
+  [Custom STT endpoints](/how-to/custom-stt).
```

---

### Incident Patch 4: `ae2f7ba6` (2026-08-30)
**Commit Message**: fix(transcription): support JSON-only STT backends (#1343)

Refs #1342

Signed-off-by: Patrick Wegerer <34162475+Cantfirmed@users.noreply.github.com>
Co-authored-by: Dmitry Grankin <39370484+DmitriyG228@users.noreply.github.com>

**File**: `core/meetings/modules/whisper/src/errors.test.ts` (modified, +7/-0)
```diff
@@ -52,6 +52,13 @@ async function run() {
     const f = await faultOf(() => client.transcribe(pcm, 'en'));
     check('401 → kind=unauthorized, non-retryable', f?.kind === 'unauthorized' && f?.retryable === false);
   }
+  // An unrelated 400 remains a non-retryable provider fault; only explicit verbose_json rejection negotiates.
+  {
+    const calls = stubFetch(400, 'unsupported audio encoding');
+    const client = new TranscriptionClient({ serviceUrl: 'http://stt.test', maxRetries: 3, retryDelayMs: 1 });
+    const f = await faultOf(() => client.transcribe(pcm, 'en'));
+    check('unrelated 400 → bad_request without format fallback', f?.kind === 'bad_request' && calls() === 1, `calls=${calls()}`);
+  }
 
   (globalThis as any).fetch = realFetch;
   if (failed) { console.error(`\n❌ stt errors: ${failed} check(s) FAILED.`); process.exit(1); }
```

**File**: `core/meetings/modules/whisper/src/model.test.ts` (modified, +24/-1)
```diff
@@ -29,6 +29,11 @@ function modelPartOf(body: string): string | null {
   const m = body.match(/name="model"\r\n\r\n([^\r]*)\r\n/);
   return m ? m[1] : null;
 }
+/** The value of the `response_format` form part in a captured multipart body. */
+function responseFormatPartOf(body: string): string | null {
+  const m = body.match(/name="response_format"\r\n\r\n([^\r]*)\r\n/);
+  return m ? m[1] : null;
+}
 
 async function run() {
   const pcm = new Float32Array(1600).fill(0.05); // 0.1s of audio
@@ -47,9 +52,27 @@ async function run() {
     await client.transcribe(pcm, 'en');
     check('unconfigured → default whisper-1 (no behavior change)', modelPartOf(body()) === 'whisper-1', `got ${JSON.stringify(modelPartOf(body()))}`);
   }
+  // Backends such as Voxtral reject verbose_json but accept the same OpenAI endpoint with json.
+  {
+    const formats: Array<string | null> = [];
+    (globalThis as any).fetch = async (_url: unknown, init: { body: Buffer }) => {
+      formats.push(responseFormatPartOf(Buffer.from(init.body).toString('latin1')));
+      if (formats.length === 1) {
+        return new Response(JSON.stringify({ message: 'Currently do not support verbose_json for Voxtral' }), { status: 400 });
+      }
+      return new Response(JSON.stringify({ text: 'voxtral ok' }), { status: 200 });
+    };
+    const client = new TranscriptionClient({ serviceUrl: 'http://stt.test', model: 'voxtral', maxRetries: 0 });
+    const first = await client.transcribe(pcm, 'en');
+    await client.transcribe(pcm, 'en');
+    check('verbose_json rejection falls back once, then caches json',
+      JSON.stringify(formats) === JSON.stringify(['verbose_json', 'json', 'json']),
+      `formats=${JSON.stringify(formats)}`);
+    check('json-only response remains a valid transcription result', first.text === 'voxtral ok', `text=${JSON.stringify(first.text)}`);
+  }
 
   (globalThis as any).fetch = realFetch;
   if (failed) { console.error(`\n❌ stt model: ${failed} check(s) FAILED.`); process.exit(1); }
-  console.log('\n✅ stt model (P5, #522): the wire carries the configured model id; unset stays whisper-1.');
+  console.log('\n✅ stt model (P5, #522): configured model ids reach the wire; json-only OpenAI-compatible backends negotiate once.');
 }
 run().catch((e) => { console.error(e); process.exit(1); });
```

**File**: `core/meetings/modules/whisper/src/transcription-client.ts` (modified, +8/-1)
```diff
@@ -102,6 +102,7 @@ export class TranscriptionClient {
   private maxSpeechDurationSec: number | undefined;
   private minSilenceDurationMs: number | undefined;
   private model: string;
+  private responseFormat: 'verbose_json' | 'json' = 'verbose_json';
   constructor(config: TranscriptionClientConfig) {
     // Ensure serviceUrl ends with the transcriptions endpoint
     this.serviceUrl = config.serviceUrl.replace(/\/+$/, '');
@@ -136,6 +137,12 @@ export class TranscriptionClient {
         const fault: TranscriptionError = err instanceof TranscriptionError
           ? err
           : new TranscriptionError(err?.name === 'AbortError' ? 'timeout' : 'unavailable', undefined, err?.message, true);
+        if (fault.kind === 'bad_request' && this.responseFormat === 'verbose_json' && /verbose_json/i.test(fault.detail ?? '')) {
+          log('[TranscriptionClient] backend rejected verbose_json; falling back to json for this and later requests');
+          this.responseFormat = 'json';
+          attempt--; // Capability negotiation does not consume a configured retry.
+          continue;
+        }
         const isLastAttempt = attempt === this.maxRetries;
 
         if (fault.retryable && !isLastAttempt) {
@@ -184,7 +191,7 @@ export class TranscriptionClient {
     parts.push(Buffer.from(
       `--${boundary}\r\n` +
       `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
-      `verbose_json\r\n`
+      `${this.responseFormat}\r\n`
     ));
 
     // Language part (if specified)
```

**File**: `docs/changelog.d/1342-voxtral-json.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+- **Custom STT: JSON-only Voxtral models now transcribe meetings.** Vexa negotiates down from
+  `verbose_json` to `json` once when a backend rejects verbose output, while Whisper backends keep
+  their richer segment metadata. See [Use a custom STT endpoint](/how-to/custom-stt).
```

**File**: `docs/docs/how-to/custom-stt.mdx` (modified, +11/-0)
```diff
@@ -50,6 +50,17 @@ that path.
 If the backend ignores the `model` form part, leave `TRANSCRIPTION_MODEL` unset. If it validates model
 ids, set the exact served name.
 
+For JSON-only models such as Voxtral, Vexa first requests `verbose_json`, then falls back to `json`
+when the backend explicitly rejects the verbose format. The client remembers that choice for later
+audio windows, while Whisper-compatible backends retain segment and word metadata.
+
+```bash
+TRANSCRIPTION_MODEL=mistralai/Voxtral-Mini-4B-Realtime-2602
+```
+
+Use the exact model id returned by your gateway's `GET /v1/models`; deployments may expose a
+different Voxtral checkpoint or served name.
+
 ## Example: FunASR or SenseVoice
 
 <Note>
```

---

### Incident Patch 5: `6d6d38a2` (2026-08-29)
**Commit Message**: fix(terminal): honor DEFAULT_BOT_NAME without a terminal rebuild (#1259)

The terminal hardcoded bot_name: "Vexa" on every join, so the compose/helm/Lite
DEFAULT_BOT_NAME already wired into meeting-api never took effect. Omit the field
when unset, keep stock deploy defaults as Vexa, and wire NEXT_PUBLIC_DEFAULT_BOT_NAME
as a real terminal build arg for intentional bake-ins.

Signed-off-by: PrBart <d.samovilov@gmail.com>
Co-authored-by: Dmitry Grankin <39370484+DmitriyG228@users.noreply.github.com>

**File**: `clients/terminal/Dockerfile` (modified, +6/-0)
```diff
@@ -32,6 +32,12 @@ ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
 # agent-api paths (404). Empty (default) keeps every surface. NEXT_PUBLIC_* → set BEFORE `next build`.
 ARG NEXT_PUBLIC_TERMINAL_MODE=""
 ENV NEXT_PUBLIC_TERMINAL_MODE=$NEXT_PUBLIC_TERMINAL_MODE
+# Bot display name baked into the client bundle (src/surfaces/defaultBotName.ts). Empty (default) →
+# the terminal omits bot_name on join and meeting-api's DEFAULT_BOT_NAME decides at RUNTIME, which is
+# the knob operators should use. Set this only to pin a name into the image; it then wins over the
+# deployment's DEFAULT_BOT_NAME and a rename costs a rebuild.
+ARG NEXT_PUBLIC_DEFAULT_BOT_NAME=""
+ENV NEXT_PUBLIC_DEFAULT_BOT_NAME=$NEXT_PUBLIC_DEFAULT_BOT_NAME
 # Regular build (not standalone): produces .next served by the custom server in production.
 RUN npm run build
 
```

**File**: `clients/terminal/src/surfaces/__tests__/defaultBotName.test.ts` (modified, +7/-5)
```diff
@@ -10,16 +10,18 @@ describe('defaultBotName', () => {
     delete process.env.NEXT_PUBLIC_DEFAULT_BOT_NAME;
   });
 
-  it('returns "Vexa" when env is unset', () => {
-    expect(defaultBotName()).toBe('Vexa');
+  it('returns undefined when env is unset (JSON.stringify will omit bot_name)', () => {
+    expect(defaultBotName()).toBeUndefined();
+    expect(JSON.stringify({ platform: 'google_meet', bot_name: defaultBotName() })).toBe(
+      '{"platform":"google_meet"}',
+    );
   });
 
-  it('reads env at call time', () => {
-    expect(defaultBotName()).toBe('Vexa');
+  it('reads NEXT_PUBLIC_DEFAULT_BOT_NAME at call time when set', () => {
     process.env.NEXT_PUBLIC_DEFAULT_BOT_NAME = 'MyBot';
     expect(defaultBotName()).toBe('MyBot');
     delete process.env.NEXT_PUBLIC_DEFAULT_BOT_NAME;
-    expect(defaultBotName()).toBe('Vexa');
+    expect(defaultBotName()).toBeUndefined();
   });
 
   it('trims whitespace', () => {
```

**File**: `clients/terminal/src/surfaces/__tests__/meetingActions.test.tsx` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ describe("actionsFor — each action fires the correct endpoint+body", () => {
     const { url, init, body } = lastFetch();
     expect(url).toBe("/api/bots");
     expect(init.method).toBe("POST");
-    expect(body).toEqual({ platform: "google_meet", native_meeting_id: NATIVE, meeting_url: `https://meet.google.com/${NATIVE}`, bot_name: "Vexa" });
+    expect(body).toEqual({ platform: "google_meet", native_meeting_id: NATIVE, meeting_url: `https://meet.google.com/${NATIVE}` });
   });
 
   it("active→Stop DELETEs the bot by platform+native (the gateway /api/bots route)", () => {
```

**File**: `clients/terminal/src/surfaces/__tests__/meetingCookbook.test.ts` (modified, +2/-2)
```diff
@@ -31,9 +31,9 @@ describe("agentOnMeeting — cookbook composition over two domain contracts", ()
     const [bot, proc] = calls();
     expect(bot.url).toBe("/api/bots");
     expect(bot.init.method).toBe("POST");
-    expect(bodyOf(bot.init)).toMatchObject({
+    expect(bodyOf(bot.init)).toEqual({
       platform: "google_meet", native_meeting_id: "abc-defg-hij",
-      meeting_url: "https://meet.google.com/abc-defg-hij", bot_name: "Vexa",
+      meeting_url: "https://meet.google.com/abc-defg-hij",
     });
     expect(proc.url).toBe("/api/meeting/process");
     expect(bodyOf(proc.init)).toEqual({ native_id: "abc-defg-hij", platform: "google_meet", on: true });
```

**File**: `clients/terminal/src/surfaces/defaultBotName.ts` (modified, +9/-8)
```diff
@@ -1,12 +1,13 @@
-/** Default bot name shown in the terminal surfaces.
+/** Default bot name for terminal join requests.
  *
- *  NEXT_PUBLIC_DEFAULT_BOT_NAME sets the meeting bot name the terminal sends to the API
- *  when joining meetings. In client-bundled code Next.js inlines NEXT_PUBLIC_* at build time,
- *  so the knob takes effect per deployment build — which matches this feature's intent
- *  (a per-deployment default), and the call-time function keeps tests correct.
+ *  Returns `undefined` when unset so `JSON.stringify({ bot_name: defaultBotName() })` omits the field
+ *  and meeting-api names the bot from `DEFAULT_BOT_NAME` — the knob operators can change with a
+ *  restart. An explicit `bot_name` in a request still wins over both.
  *
- *  Read via a function (not a module constant) so tests that set the env after load observe it.
+ *  `NEXT_PUBLIC_DEFAULT_BOT_NAME` is inlined into the bundle at build time (the Dockerfile takes it as
+ *  a build arg), so setting it pins a name into the image and makes a rename cost a rebuild.
  */
-export function defaultBotName(): string {
-  return process.env.NEXT_PUBLIC_DEFAULT_BOT_NAME?.trim() || "Vexa";
+export function defaultBotName(): string | undefined {
+  const name = process.env.NEXT_PUBLIC_DEFAULT_BOT_NAME?.trim();
+  return name || undefined;
 }
```

---

### Incident Patch 6: `3fbdb3d2` (2026-08-29)
**Commit Message**: Fix/claude code effort flag (#1337)

* agent: pass VEXA_AGENT_EFFORT through to the claude-code CLI as --effort

Backends that validate the OpenAI-compatible reasoning_effort field (vLLM/LiteLLM
model groups) reject the CLI's default high when it is outside their allowlist
(400 Unexpected reasoning effort high). An explicit effort pin overrides that
default; unset keeps the argv byte-identical to before.

Signed-off-by: Patrick Wegerer <patrick.wegerer@scch.at>

* agent+settings: make the claude-code reasoning effort user-configurable

Settings → Models gains a 'Reasoning effort' select (low|medium|high|xhigh).
The effective value crosses the internal model-config edge, is stamped into
the worker env as VEXA_AGENT_EFFORT at dispatch, and the claude-code harness
passes it through as --effort — overriding the CLI's default high, which
backends that validate the OpenAI-compatible reasoning_effort field (vLLM/
LiteLLM model groups) reject with 400 when outside their allowlist. Unset
keeps every argv byte-identical to before.

Signed-off-by: Patrick Wegerer <patrick.wegerer@scch.at>

---------

Signed-off-by: Patrick Wegerer <patrick.wegerer@scch.at>
Co-authored-by: Patrick Wegerer <pat

**File**: `clients/terminal/src/surfaces/settings.tsx` (modified, +7/-0)
```diff
@@ -148,6 +148,13 @@ function ModelsSection() {
     { key: "api_key", label: "API key", placeholder: "unchanged unless typed", secret: true, showIf: (v: Record<string, string>) => v.mode === "custom" },
     { key: "model", label: "Chat model", placeholder: "deployment default (e.g. sonnet)" },
     { key: "meeting_model", label: "Meeting model", placeholder: "defaults to chat model" },
+    { key: "effort", label: "Reasoning effort", placeholder: "CLI default (e.g. medium)", options: [
+      { value: "", label: "CLI default" },
+      { value: "low", label: "low" },
+      { value: "medium", label: "medium" },
+      { value: "high", label: "high" },
+      { value: "xhigh", label: "xhigh" },
+    ] },
   ];
   const transcriptionFields = [
     { key: "url", label: "Service URL", placeholder: "deployment default" },
```

**File**: `clients/terminal/src/surfaces/settingsApi.ts` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ export type ModelPrefs = {
   mode?: "subscription" | "custom" | null;
   model?: string | null;
   meeting_model?: string | null;
+  effort?: string | null; // reasoning-effort pin (low|medium|high|xhigh) for the agent harness
   base_url?: string | null;
   api_key_set?: boolean;
   api_key?: string | null; // masked on read (********abcd) — write-only in the clear
```

**File**: `core/agent/control_plane/dispatch.py` (modified, +8/-0)
```diff
@@ -168,6 +168,14 @@ def overlay_model_config(env: dict[str, str], config: dict, *, allowlist: str =
     elif meeting_model:
         logger.warning("meeting model %r not in VEXA_MODEL_ALLOWLIST — using deployment default",
                        meeting_model)
+    # Reasoning-effort pin for the claude-code harness (Settings → Models "effort"). Empty ⇒ unset ⇒
+    # the CLI's own default (no flag on the argv); an explicit value reaches the worker env and the
+    # harness passes it through as --effort. Backends that validate the OpenAI-compatible
+    # reasoning_effort field (vLLM/LiteLLM groups) reject the CLI's default high when it is outside
+    # their allowlist; the pin overrides that default.
+    effort = (config.get("effort") or "").strip()
+    if effort:
+        env["VEXA_AGENT_EFFORT"] = effort
     if (config.get("mode") or "").strip() != "custom":
         return
     base_url = (config.get("base_url") or "").strip()
```

**File**: `core/agent/llm/claude_code.py` (modified, +9/-0)
```diff
@@ -110,6 +110,7 @@ def build_argv(
     session: Optional[str] = None,
     model: Optional[str] = None,
     mcp_config: Optional[str] = None,
+    effort: Optional[str] = None,
 ) -> list[str]:
     """The headless Claude Code argv — `claude -p <prompt> --output-format stream-json [...]`.
 
@@ -118,6 +119,11 @@ def build_argv(
     does the git commit). `--mcp-config <file>` + `--strict-mcp-config` attach EXACTLY the unit's
     granted MCP tools (the toolbelt) and nothing else. The container sandbox is the other
     enforcement layer.
+
+    `effort` — when set — pins the session's reasoning effort (`--effort low|medium|high|xhigh`).
+    Backends that validate the OpenAI-compatible `reasoning_effort` field (e.g. vLLM/LiteLLM model
+    groups) reject the CLI's default `high` when it is outside their allowlist; an explicit value
+    overrides that default. Unset ⇒ no flag ⇒ the CLI's own behaviour, unchanged.
     """
     argv = ["claude", "-p", prompt, "--output-format", "stream-json", "--verbose",
             "--include-partial-messages", "--permission-mode", "acceptEdits"]
@@ -130,6 +136,8 @@ def build_argv(
         argv += ["--resume", session]
     if model:
         argv += ["--model", model]
+    if effort:
+        argv += ["--effort", effort]
     return argv
 
 
@@ -218,6 +226,7 @@ def run_turn(self, work: Path, prompt: str, *, allowed_tools: Iterable[str] = ()
                  session: Optional[str] = None, model: Optional[str] = None,
                  mcp_config: Optional[str] = None) -> Iterator[dict]:
         argv = build_argv(prompt, allowed_tools=allowed_tools, session=session, model=model,
+                          effort=(os.environ.get("VEXA_AGENT_EFFORT") or None),
                           mcp_config=mcp_config)
         yield from parse_stream_json(self._exec(argv, str(work)))
 
```

**File**: `core/agent/tests/test_llm_claude_code.py` (modified, +7/-0)
```diff
@@ -118,8 +118,15 @@ def test_build_argv_core_flags_and_session_model():
     assert "--allowedTools" in argv and "Read" in argv
     assert "--resume" in argv and "s1" in argv
     assert "--model" in argv and "m1" in argv
+    # unset effort ⇒ NO --effort flag (the CLI's own default behaviour is preserved byte-for-byte)
+    assert "--effort" not in argv
 
 
+def test_build_argv_effort_pin():
+    argv = build_argv("hi", effort="medium")
+    assert "--effort" in argv and "medium" in argv
+    assert argv[argv.index("--effort") + 1] == "medium"
+
 # ── the untrusted-subprocess env scrub (data-plane tenancy) ──────────────────
 # The model-driven harness CLI exposes a Bash tool. It must NOT inherit the worker's REDIS_URL (which
 # reaches the SHARED redis — another tenant's tc:meeting:* / unit:*:in) nor the minted per-dispatch
```

---

### Incident Patch 7: `15bf8b3e` (2026-08-29)
**Commit Message**: fix(mixed): the virtual-time speed check measured the runner, not the tier (#1300)

`virtualMs < realMs` compared two numbers that scale differently. The 1x run's
wall clock is FLOORED by the tape (~8.5 s, ~2% variance across CI runs); the
virtual run is pure compute — and strictly MORE compute than the 1x run, because
every event and every heartbeat awaits a drain that `--realtime` never performs.
On a fast machine that costs ~1 s and the comparison looks comfortable; on a
2-core CI runner it stretches past the floor and the comparison inverts. It has
been red-lighting PRs whose entire diff is one Markdown file: 10035 vs 8672 ms on
#1288, and 14687 vs 8496 ms on an unrelated release recut.

Assert the mechanism rather than a side effect of it. VirtualClock gains
advancedMs(); tape-replay reports it beside the heartbeat count it already
printed; the test asserts (a) a heartbeat fired for every second of lane clock —
which the old check never tested at all, since a tier that fired NO heartbeats
would have been fast and passed — and (b) the run came in under the lane time it
replaced, the boundary a clock that genuinely slept cannot cross. realMs is still
measured and printed for rea

**File**: `core/meetings/modules/mixed-pipeline/src/tape-replay.ts` (modified, +1/-1)
```diff
@@ -397,7 +397,7 @@ async function main(): Promise<void> {
     // Let the tail play out: the lane's TTL finalize and its roll are heartbeat-driven, and a tape
     // that simply stops would leave the last turn's pending tail unexamined.
     await clock.advanceTo(evs.length ? evs[evs.length - 1].t + 30_000 : clock.now());
-    console.log(`virtual time: ${clock.heartbeatsFired()} heartbeat(s) fired across the tape`);
+    console.log(`virtual time: ${clock.heartbeatsFired()} heartbeat(s) fired, ${clock.advancedMs()}ms of lane clock advanced, across the tape`);
   }
   await tc.dispose();
 
```

**File**: `core/meetings/modules/mixed-pipeline/src/virtual-clock.ts` (modified, +10/-0)
```diff
@@ -37,6 +37,16 @@ export class VirtualClock {
   now(): number { return this.t; }
   heartbeatsFired(): number { return this.fired; }
 
+  /**
+   * How far the lane's clock has been moved since the tape's first timestamp — that is, the real
+   * waiting this tier replaced. Paired with `heartbeatsFired()` it states the tier's whole claim as
+   * two numbers the run can report about ITSELF: this much lane time passed, this many heartbeats
+   * fired inside it. `virtual-time-equivalence.test.ts` asserts against these rather than against
+   * how long a 1x run happened to take on the same machine, so the check measures the mechanism and
+   * not the runner.
+   */
+  advancedMs(): number { return this.t - this.opts.startMs; }
+
   setHeartbeat(fn: () => void, everyMs: number): () => void {
     const beat: Heartbeat = { fn, everyMs, nextAt: this.t + everyMs, cancelled: false };
     this.beats.push(beat);
```

**File**: `core/meetings/modules/mixed-pipeline/src/virtual-time-equivalence.test.ts` (modified, +44/-8)
```diff
@@ -14,6 +14,23 @@
  * introduced the tier. Even so this pays a few seconds of real time ONCE, which is the point: every
  * other replay in the loop no longer pays any.
  *
+ * WHY THE SPEED CHECK DOES NOT COMPARE THE TWO RUNS. It used to assert `virtualMs < realMs`, and
+ * that assertion measured the runner rather than the tier. The 1x run's wall clock is FLOORED by
+ * the tape — ~8.5 s, and it barely moves under load — while the virtual run is pure compute, and it
+ * is strictly MORE compute than the 1x run does, because every event and every heartbeat awaits a
+ * drain that `--realtime` never performs. On a fast machine that costs ~1.5 s and the comparison
+ * looks comfortable; on a 2-core CI runner it stretches past 8.5 s and the comparison inverts. It
+ * inverted on PRs whose entire diff was one Markdown file (10035 vs 8672 ms, and 14687 vs 8496 ms),
+ * which is the signature of a check that is not testing its own subject.
+ *
+ * So the speed claim is now stated against the thing it is actually about: the virtual run reports
+ * how much LANE CLOCK it advanced, and must come in under that. A clock that genuinely slept could
+ * not — it would need at least 1x, and the two CI runs above sit at 0.27x and 0.39x of the budget.
+ * The companion check asserts the mechanism ran at all (a heartbeat for every second of lane time),
+ * which the old wall-clock comparison never tested: a tier that fired NO heartbeats would have been
+ * fast, and would have passed. `realMs` is still measured and printed, because it is useful when
+ * reading a failure — it is simply never asserted on.
+ *
  * Run: npx tsx src/virtual-time-equivalence.test.ts
  */
 import { execFileSync } from 'node:child_process';
@@ -32,6 +49,7 @@ const here = dirname(fileURLToPath(import.meta.url));
 const dir = mkdtempSync(join(tmpdir(), 'vexa-vt-'));
 const T0 = 1786470000000;
 const SR = 16000;
+const TAPE_MS = 8000;
 
 // Two speakers on the transport, alternating, long enough that the heartbeat fires several times
 // within a turn — which is the only way a growing-window submission (and therefore a draft, and
@@ -45,7 +63,7 @@ const tape: string[] = [JSON.stringify({
   type: 'captured_signal_header', v: 1, platform: 'teams', native_meeting_id: 'vt',
   language: null, lane: 'mixed', sample_rate: SR, started_at: new Date(T0).toISOString(), trace_id: 'vt',
 })];
-for (let ms = 0; ms < 8000; ms += 100) {
+for (let ms = 0; ms < TAPE_MS; ms += 100) {
   const tr = activeAt(ms);
   if (tr === null) continue;
   const n = SR / 10;
@@ -60,12 +78,16 @@ writeFileSync(join(dir, 'vt.csrc.jsonl'), runs.flatMap(([tr, a, b]) => [
   JSON.stringify({ type: 'csrc', t: T0 + b, csrc: tr, active: false, lane: 'mixed' }),
 ]).join('\n') + '\n');
 
-const run = (mode: string, tag: string): { rows: string; writes: string } => {
-  execFileSync('npx', ['tsx', join(here, 'tape-replay.ts'),
+const run = (mode: string, tag: string): { rows: string; writes: string; stdout: string } => {
+  const stdout = execFileSync('npx', ['tsx', join(here, 'tape-replay.ts'),
     '--tape', join(dir, 'vt.captured-signal.jsonl'), '--turn-source', 'csrc', mode,
     '--out-json', join(dir, `${tag}.json`), '--out-writes', join(dir, `${tag}.writes.jsonl`)],
-    { stdio: 'pipe', cwd: join(here, '..') });
-  return { rows: readFileSync(join(dir, `${tag}.json`), 'utf8'), writes: readFileSync(join(dir, `${tag}.writes.jsonl`), 'utf8') };
+    { stdio: 'pipe', cwd: join(here, '..'), encoding: 'utf8' });
+  return {
+    rows: readFileSync(join(dir, `${tag}.json`), 'utf8'),
+    writes: readFileSync(join(dir, `${tag}.writes.jsonl`), 'utf8'),
+    stdout,
+  };
 };
 
 const t0 = Date.now();
@@ -75,15 +97,29 @@ const t1 = Date.now();
 const real = run('--realtime', 'rt');
 const realMs = Date.now() - t1;
 
+// The virtual run reports its own mechanism — how far it moved the lane's clock, and how many
+// heartbeats fired inside that span. Both assertions below read THOSE numbers; see the header for
+/
```

---

### Incident Patch 8: `c461ca22` (2026-08-29)
**Commit Message**: fix(transcription): stop a CPU worker admitting a GPU-sized concurrency default (#1156)

* fix(transcription): stop a CPU worker admitting a GPU-sized concurrency default

MAX_ACTIVE_REQUESTS defaulted to 20, a figure benchmarked on an RTX 4090. On a CPU device each of those 20 admitted jobs only gets 1/20th of the cores, so none finish in bounded time, the semaphore never releases, and with FAIL_FAST_WHEN_BUSY every later request 503s. The worker keeps answering /health with 200 the whole time and never self-recovers. Observed on a 12-core CPU deployment: 503 on every POST for hours, a 51-minute meeting force-completed as stt_degraded with zero transcript rows, cleared only by a container restart.

- default MAX_ACTIVE_REQUESTS is now device-aware: 20 only for an explicit cuda device, 2 otherwise. Inverted deliberately so faster-whisper's "auto" (which can resolve to CPU at runtime) does not inherit the GPU default. An operator-set env var still wins.
- DEVICE is normalized once at read time, so every comparison in the file tolerates casing and stray whitespace.
- bound the whole request with TRANSCRIPTION_TIMEOUT_S (120s) so a call that never returns cannot hold its semaphore per

**File**: `core/meetings/services/transcription/src/transcription/main.py` (modified, +184/-77)
```diff
@@ -33,7 +33,10 @@
 
 # Device detection: Use environment variable or default to cuda for GPU containers
 # CTranslate2 (used by faster-whisper) will automatically detect and use CUDA if available
-DEVICE = os.getenv("DEVICE", "cuda")
+# Normalized once here so every later `DEVICE == "..."` comparison in this file (health check,
+# CPU thread setup, the concurrency default below) sees a clean value regardless of stray
+# whitespace or casing (e.g. "CUDA", " cpu ") in the operator-set env var.
+DEVICE = os.getenv("DEVICE", "cuda").strip().lower()
 
 # Compute type optimization: Use INT8 for optimal VRAM efficiency
 # Research shows: large-v3-turbo + INT8 = ~2.1 GB VRAM (validated)
@@ -164,11 +167,26 @@ async def verify_api_token(
 
 # Load management: Global concurrency limit and bounded queue
 # These settings control how many transcription requests can be processed concurrently.
-# CTranslate2 serializes CUDA ops, so concurrent requests queue on the GPU.
-# RTX 4090 benchmarks (2026-03-08): 20 concurrent handles fine, latency ~3s worst case.
-# Set high enough to avoid artificial bottlenecks, low enough to bound queue latency.
+# CTranslate2 serializes ops per device, so concurrent requests queue on it.
+# RTX 4090 benchmarks (2026-03-08): 20 concurrent handles fine, latency ~3s worst case - that
+# number is GPU-specific. On CPU each admitted job only gets 1/Nth of the cores, so the same
+# 20 means every job runs proportionally slower, none finish in bounded time, the semaphore
+# never releases, and every request after that 503s forever (2026-08-13 CPU deadlock incident).
+# Default is therefore device-aware; an operator-set env var always wins over the default.
 # MAX_ACTIVE_REQUESTS is the preferred name; MAX_CONCURRENT_TRANSCRIPTIONS is kept for compatibility.
-MAX_CONCURRENT_TRANSCRIPTIONS = _env_int("MAX_ACTIVE_REQUESTS", _env_int("MAX_CONCURRENT_TRANSCRIPTIONS", 20))
+def _default_max_concurrent(device: str) -> int:
+    """Only an explicit "cuda" gets the RTX-4090-benchmarked 20; everything else (cpu, auto, mps,
+    or any other faster-whisper device string) gets the small CPU-safe cap. Inverted on purpose:
+    faster-whisper's "auto" resolves to whatever CTranslate2 finds at runtime - which can be CPU -
+    so it must not silently inherit the GPU default just because it isn't the literal "cpu". 2
+    lets a couple of requests overlap without each one starving for cores on a typical (8-16
+    core) CPU box - tune via MAX_ACTIVE_REQUESTS if your hardware differs."""
+    return 20 if device == "cuda" else 2
+
+
+MAX_CONCURRENT_TRANSCRIPTIONS = _env_int(
+    "MAX_ACTIVE_REQUESTS", _env_int("MAX_CONCURRENT_TRANSCRIPTIONS", _default_max_concurrent(DEVICE))
+)
 MAX_QUEUE_SIZE = _env_int("MAX_QUEUE_SIZE", 10)  # Max requests waiting in queue
 
 # Backpressure strategy:
@@ -178,11 +196,61 @@ async def verify_api_token(
 BUSY_RETRY_AFTER_S = _env_int("BUSY_RETRY_AFTER_S", 1)
 REALTIME_RESERVED_SLOTS = _env_int("REALTIME_RESERVED_SLOTS", 1)
 
+# Bound on the ENTIRE per-request transcription work - all temperature-fallback attempts
+# together (see the for-loop below), not each attempt individually. The semaphore permit for a
+# request is only released in the handler's `finally`, which only runs once this awaited work
+# returns - so work that never returns (pathological input, a hang inside
+# CTranslate2/faster-whisper, thread contention under load) would hold its permit forever
+# regardless of how small MAX_CONCURRENT_TRANSCRIPTIONS is. This is a backstop independent of the
+# concurrency default above.
+#
+# What this DOES guarantee: the semaphore permit is always reclaimed within TRANSCRIPTION_TIMEOUT_S.
+# What it does NOT guarantee: asyncio.wait_for only cancels the await - concurrent.futures.Future
+# .cancel() is a no-op once a thread has started, so the underlying thread keeps running the real
+# call to completion (or forever) and keeps occupying its transcription_executor slot. A reclaimed
+# permit is onl
```

**File**: `core/meetings/services/transcription/tests/test_load_management.py` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+"""MAX_CONCURRENT_TRANSCRIPTIONS device-aware default + TRANSCRIPTION_TIMEOUT_S.
+
+Regression coverage for the 2026-08-13 CPU deadlock incident: a GPU-sized default (20) was
+admitted on a CPU-only worker, none of the 20 concurrent jobs finished in bounded time, the
+semaphore that gates admission was never released, and the worker answered 200 on /health while
+503-ing every /v1/audio/transcriptions request for hours until it was restarted by hand.
+
+Three independent fixes, three independent test groups:
+- the concurrency default is device-aware (20 only for an explicit "cuda", the conservative
+  cap for everything else - including "auto", which can resolve to CPU at runtime), normalized
+  (stripped/lowercased) before comparison, and an operator-set MAX_ACTIVE_REQUESTS/
+  MAX_CONCURRENT_TRANSCRIPTIONS still wins over the default either way.
+- a bounded per-request timeout on the blocking model.transcribe() call guarantees the semaphore
+  permit is always reclaimed, even if that call itself never returns - the concurrency default
+  alone does not guarantee this (see the comment on TRANSCRIPTION_TIMEOUT_S).
+- the executor is sized with headroom over the semaphore, because reclaiming the permit alone
+  does not free up a thread to run the next request in (the reclaimed permit is otherwise
+  useless - see the comment on transcription_executor).
+"""
+from __future__ import annotations
+
+import importlib
+import io
+import os
+import threading
+import time
+from contextlib import contextmanager
+
+import numpy as np
+import soundfile as sf
+
+import transcription.main as svc
+
+_ENV_KEYS = ("DEVICE", "MAX_ACTIVE_REQUESTS", "MAX_CONCURRENT_TRANSCRIPTIONS", "TRANSCRIPTION_TIMEOUT_S")
+
+
+@contextmanager
+def _reloaded_with_env(**env: str):
+    """Reload transcription.main with only the given env vars of interest set, then reload again
+    on the way out so later tests see the module in its original (ambient-env) state."""
+    saved = {k: os.environ.get(k) for k in _ENV_KEYS}
+    try:
+        for k in _ENV_KEYS:
+            os.environ.pop(k, None)
+        os.environ.update(env)
+        importlib.reload(svc)
+        yield svc
+    finally:
+        for k, v in saved.items():
+            if v is None:
+                os.environ.pop(k, None)
+            else:
+                os.environ[k] = v
+        importlib.reload(svc)
+
+
+# --- default selection: pure function, no env/import gymnastics needed -----------------------
+
+def test_default_max_concurrent_is_small_on_cpu():
+    assert svc._default_max_concurrent("cpu") == 2
+
+
+def test_default_max_concurrent_is_twenty_on_cuda():
+    assert svc._default_max_concurrent("cuda") == 20
+
+
+def test_default_max_concurrent_treats_unknown_device_as_cpu_like():
+    # Inverted on purpose: only the exact literal "cuda" gets the GPU-benchmarked default.
+    # "auto" (faster-whisper's runtime-resolved device, which can land on CPU) and anything else
+    # unrecognized must NOT silently inherit the GPU default just for not being "cpu".
+    assert svc._default_max_concurrent("mps") == 2
+    assert svc._default_max_concurrent("auto") == 2
+
+
+def test_default_max_concurrent_requires_exact_lowercase_cuda():
+    # The function itself does no normalization - normalization happens once at DEVICE's
+    # assignment (see test_device_env_is_normalized below). A caller that passes an unnormalized
+    # string does not get the GPU default.
+    assert svc._default_max_concurrent("CUDA") == 2
+    assert svc._default_max_concurrent(" cuda ") == 2
+
+
+# --- the same default, wired end to end through the module's env parsing ----------------------
+
+def test_module_default_is_two_on_cpu():
+    with _reloaded_with_env(DEVICE="cpu") as m:
+        assert m.MAX_CONCURRENT_TRANSCRIPTIONS == 2
+
+
+def test_module_default_is_twenty_on_cuda():
+    with _reloaded_with_env(DEVICE="cuda") as m:
+        assert m.MAX_CONCURRENT_TRANSCRIPTIONS == 20
+
+
+def t
```

**File**: `deploy/transcription/nginx.conf` (modified, +5/-2)
```diff
@@ -56,8 +56,11 @@ http {
             proxy_set_header X-Forwarded-Proto $scheme;
             proxy_set_header X-Worker-ID $upstream_addr;
             
-            # Automatic failover to next worker on errors (fast timeout for quick failover)
-            proxy_next_upstream error timeout http_500 http_502 http_503;
+            # Automatic failover to next worker on errors (fast timeout for quick failover).
+            # http_504 included: the transcription app itself returns 504 as a hang backstop
+            # when a request wedges past TRANSCRIPTION_TIMEOUT_S (see main.py) - a wedged worker
+            # is the worst case to keep sending traffic to, so it must fail over like the rest.
+            proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
             proxy_next_upstream_tries 3;
             proxy_next_upstream_timeout 3s;
         }
```

**File**: `docs/docs/deployment.mdx` (modified, +5/-0)
```diff
@@ -94,6 +94,11 @@ docker compose -f docker-compose.cpu.yml up -d
 curl http://localhost:8083/health   # waits on the model load
 ```
 
+**CPU concurrency:** the worker's admission cap (`MAX_ACTIVE_REQUESTS`) defaults to `20` only when
+`DEVICE=cuda` (sized on an RTX 4090); on any other device (`cpu`, `auto`, `mps`) it defaults to `2`,
+because 20 CPU jobs sharing the cores never finish and the worker deadlocks while still reporting
+healthy. Set `MAX_ACTIVE_REQUESTS` explicitly if your hardware differs; an explicit value always wins.
+
 Then point the main stack at it in `deploy/compose/.env`:
 
 ```bash
```

---

### Incident Patch 9: `3e0d5ef2` (2026-08-29)
**Commit Message**: fix(gates): parse the rights declaration section, not the whole body (#1099)

Follows #1095, which fixed the line-shape half of this. One case remains.

selectedRights matches the FIRST line anywhere in the body containing the marker.
A PR that merely MENTIONS a marker -- quoting the template, or documenting this
gate -- puts prose ahead of its own declaration, so the gate reads the prose and
reports zero selections. Explaining the bug requires quoting the thing being
explained, so the PR that fixed the line shape could not declare anything.

Scoped to the last '## Contribution rights' heading onward, which is exactly what
the gate's own error message tells contributors to edit. #1095's blank-line guard
and walk-back are preserved unchanged.

Signed-off-by: DmitriyG228 <2280905@gmail.com>

**File**: `scripts/contribution-rights-gate.mjs` (modified, +7/-1)
```diff
@@ -11,7 +11,13 @@ const DECISION_MARKER = "<!-- vexa-contribution-rights-decision:v1 -->";
 // back to the checkbox of the item it belongs to. Matching only the marker's own line silently
 // reports zero selections for every correctly filled template.
 function selectedRights(body = "") {
-  const lines = body.split("\n");
+  // Parse ONLY the declaration section. A body may legitimately MENTION these markers -- quoting the
+  // template, or documenting this gate itself -- and matching the first occurrence anywhere leaves
+  // such a body unable to declare anything, because the prose sits above the real checkbox. The
+  // gate's own error message already points at "the Contribution rights section"; read exactly that.
+  const all = body.split("\n");
+  const heading = all.reduce((last, line, i) => (/^#{1,6}\s+contribution\s+rights\b/i.test(line) ? i : last), -1);
+  const lines = heading >= 0 ? all.slice(heading) : all;
   return RIGHTS.filter((right) => {
     const marker = `<!-- rights:${right} -->`;
     const markerIndex = lines.findIndex((candidate) => candidate.includes(marker));
```

**File**: `scripts/contribution-rights-gate.test.mjs` (modified, +19/-0)
```diff
@@ -70,6 +70,25 @@ test("does not attribute an orphaned marker to an earlier list item", () => {
   assert.equal(evaluatePullRequest(pr({ body: orphan }), [], config).ok, false);
 });
 
+test("a body that MENTIONS the markers can still declare", () => {
+  // Found by the PR that fixed the line-shape bug failing its own gate: explaining the bug
+  // required quoting the template, which put a marker occurrence above the declaration. Any
+  // PR documenting this gate could not declare anything. Parse the declaration section only.
+  const prose = [
+    "## What broke",
+    "The parser matched `<!-- rights:independent -->` wherever it appeared, including here:",
+    "",
+    "  <!-- rights:independent -->",
+    "",
+    "## Contribution rights",
+    "- [x] I own this contribution. <!-- rights:independent -->",
+    "- [ ] An employer or client owns or controls it. <!-- rights:corporate -->",
+    "- [ ] I am unsure. <!-- rights:uncertain -->",
+  ].join("\n");
+  assert.equal(evaluatePullRequest(pr({ body: prose }), [], config).ok, true,
+    "prose above the declaration swallowed the declaration");
+});
+
 test("independent path passes without a CLA", () => {
   const verdict = evaluatePullRequest(pr(), [], config);
   assert.equal(verdict.ok, true);
```

---

### Incident Patch 10: `31005b15` (2026-08-29)
**Commit Message**: fix(gates): report the failure instead of swallowing it (#1107) (#1114)

* fix(gates): report the failure instead of swallowing it (#1107)

Every gate in gates.mjs reported its own failures through

    (e.stdout || e.stderr || e).toString()

Under stdio: 'pipe' a child that writes only to stderr leaves e.stdout as a
ZERO-LENGTH Buffer. An empty Buffer is an object, so it is truthy, so the || chain
short-circuits on it and returns the empty string. The operator sees the gate's
name, a colon, and nothing:

    ▶ gates: schema
      ✗ schema core/agent/contracts/event.v1:

    ❌ gates failed
    ✗ pre-push: gate:schema FAILED — push aborted (fix it, or bypass with: --no-verify)

A gate that cannot say why it failed is worse than one that does not run: the only
remaining move is the --no-verify the hook itself suggests, which is exactly the
habit these hooks exist to prevent. Found when gate:schema aborted a docs-only push
and the message was blank; the underlying cause turned out to be a missing ajv in a
fresh worktree, invisible behind the empty string.

Replaces all 22 sites with one errText() helper that chooses on LENGTH rather than
truthiness, preferring stdout, falling back to 

**File**: `docs/changelog.d/1107-gate-error-text.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+fix(gates): every gate failure now prints its diagnostic — an empty stdout Buffer is truthy, so `(e.stdout || e.stderr || e)` was discarding the real error at all 21 call sites (#1107). A gate that fails because the worktree has no dependencies installed now says so.
```

**File**: `scripts/gate-error-text.test.mjs` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+// Regression test for the error-text swallow in gates.mjs (#1107).
+//
+// The bug was not in a gate's logic but in how every gate REPORTED its own failure:
+// `(e.stdout || e.stderr || e).toString()`. Under `stdio: "pipe"`, a child that writes
+// only to stderr leaves `e.stdout` a zero-length Buffer — an object, therefore TRUTHY —
+// so the `||` chain short-circuits on it and returns "". The operator saw the gate's name,
+// a colon, and nothing at all, with `--no-verify` the only move left.
+//
+// This test drives a REAL execSync failure rather than a hand-built object, because the
+// defect lives in what Node actually attaches to the thrown error. A test that asserted
+// against `{stdout: Buffer.alloc(0), stderr: Buffer.from("boom")}` would pass against a
+// wrong implementation that happened to check `!= null` instead of `.length`.
+//
+// Run: node --test scripts/gate-error-text.test.mjs
+import test from "node:test";
+import assert from "node:assert/strict";
+import { execSync } from "node:child_process";
+import { readFileSync } from "node:fs";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
+
+// The implementation under test, lifted from gates.mjs by source so the test cannot drift
+// from it silently: if the helper is edited, this reads the edited version.
+function loadErrText() {
+  const src = readFileSync(join(ROOT, "scripts", "gates.mjs"), "utf8");
+  const m = src.match(/const errText = \(e\) => \{[\s\S]*?\n\};/);
+  assert(m, "gates.mjs no longer defines errText — the swallow guard has been removed");
+  return new Function(`${m[0]}; return errText;`)();
+}
+
+function realFailure(script) {
+  try {
+    execSync(`node -e ${JSON.stringify(script)}`, { stdio: "pipe" });
+    assert.fail("expected the child to exit non-zero");
+  } catch (e) {
+    return e;
+  }
+}
+
+test("stderr-only failure: the message survives (this is the bug)", () => {
+  const errText = loadErrText();
+  const e = realFailure('process.stderr.write("BOOM-stderr"); process.exit(1)');
+
+  // The precondition that made the old code wrong — assert it, so the test still means
+  // something if Node ever changes what it attaches.
+  assert.equal(e.stdout.length, 0, "precondition: stdout is empty");
+  assert(Boolean(e.stdout), "precondition: an empty Buffer is truthy — this is why || failed");
+  assert.equal((e.stdout || e.stderr || e).toString(), "", "the old expression returns nothing");
+
+  assert.match(errText(e), /BOOM-stderr/);
+});
+
+test("stdout-only failure: stdout is preferred", () => {
+  const errText = loadErrText();
+  const e = realFailure('process.stdout.write("BOOM-stdout"); process.exit(1)');
+  assert.match(errText(e), /BOOM-stdout/);
+});
+
+test("both streams: stdout wins, and nothing throws", () => {
+  const errText = loadErrText();
+  const e = realFailure('process.stdout.write("OUT"); process.stderr.write("ERR"); process.exit(1)');
+  assert.match(errText(e), /OUT/);
+});
+
+test("neither stream (spawn failure): falls back to the error itself, never empty", () => {
+  const errText = loadErrText();
+  let e;
+  try {
+    execSync("definitely-not-a-real-binary-1107", { stdio: "pipe" });
+  } catch (err) {
+    e = err;
+  }
+  assert(errText(e).length > 0, "a failure must never report an empty message");
+});
+
+test("no swallow sites remain in gates.mjs", () => {
+  const src = readFileSync(join(ROOT, "scripts", "gates.mjs"), "utf8");
+  assert.equal(
+    (src.match(/e\.stdout \|\| e\.stderr/g) || []).length, 0,
+    "a gate is back to `e.stdout || e.stderr` and will report empty failures again",
+  );
+});
+
+// ── The fresh-worktree hint (#1107, second defect) ───────────────────────────────────────────
+// Restoring the message was half the fix. The message a fresh worktree produces is a Node
+// module-resolution stack trace, which still does not tell the operator that the f
```

**File**: `scripts/gates.mjs` (modified, +51/-22)
```diff
@@ -16,7 +16,36 @@ const ROOT = process.cwd();
 const SKIP = new Set(["node_modules", "dist", ".turbo", "__pycache__", "test-results", "playwright-report", "coverage"]);
 const skippable = (name) => name.startsWith(".") || SKIP.has(name);
 const rel = (p) => p.slice(ROOT.length + 1) || ".";
-const fail = (msgs) => { for (const m of msgs) console.error("  ✗ " + m); return false; };
+// Every gate's errors print through here, so the missing-dependency hint lives here too: it is
+// appended AFTER each caller's .slice(), so the one line that tells the operator what to actually
+// do can never be the part that gets truncated, and no individual gate has to remember to say it.
+// A fresh worktree has no node_modules, and a gate failing for that reason reads like a code
+// defect until something names the real fix (Vexa-ai/vexa#1107).
+const DEPS_MISSING = /ERR_MODULE_NOT_FOUND|Cannot find (?:module|package)/;
+const fail = (msgs) => {
+  for (const m of msgs) console.error("  ✗ " + m);
+  if (msgs.some((m) => DEPS_MISSING.test(String(m))))
+    console.error("  → hint: did you run `pnpm install` in this worktree? A fresh worktree has no node_modules.");
+  return false;
+};
+
+// Text of a failed execSync, for the operator who has to act on it.
+//
+// The obvious `errText(e)` is wrong, and wrong in the worst
+// possible direction: with `stdio: "pipe"` a child that writes only to stderr leaves
+// `e.stdout` as a ZERO-LENGTH Buffer, and an empty Buffer is an object, so it is TRUTHY.
+// The `||` chain short-circuits on it and the real diagnostic is discarded — the gate prints
+// its own name, a colon, and nothing. Measured on 2026-08-10: every gate:schema failure had
+// been silent since the gate was written, and the only move left to the operator is
+// `--no-verify`, which is precisely the habit these hooks exist to prevent
+// (Vexa-ai/vexa#1107).
+//
+// Prefer stdout, fall back to stderr, then to the error itself — choosing on LENGTH, never
+// on truthiness.
+const errText = (e) => {
+  const out = e?.stdout?.length ? e.stdout : (e?.stderr?.length ? e.stderr : e);
+  return (out ?? "").toString();
+};
 
 function walkDirs(dir = ROOT, acc = []) {
   for (const name of readdirSync(dir)) {
@@ -121,7 +150,7 @@ function gateIsolation() {
     .filter(([, s]) => existsSync(s));
   for (const [d, s] of found) {
     try { execSync(`node ${JSON.stringify(s)}`, { stdio: "pipe" }); }
-    catch (e) { return fail([`isolation failed in ${rel(d)}: ${(e.stdout || e.stderr || e).toString().slice(0, 300)}`]); }
+    catch (e) { return fail([`isolation failed in ${rel(d)}: ${errText(e).slice(0, 300)}`]); }
   }
   console.log(`  ✓ gate:isolation — ${found.length} brick(s) checked`);
   return true;
@@ -133,7 +162,7 @@ function gateGraph() {
   const targets = ["core", "integrations", "clients", "sdks", "schemas", "tools"]
     .filter((d) => existsSync(join(ROOT, d)));
   try { execSync(`npx depcruise --config .dependency-cruiser.cjs --no-progress ${targets.join(" ")}`, { stdio: "pipe" }); }
-  catch (e) { return fail([`dependency-cruiser:\n${(e.stdout || e.stderr || e).toString()}`]); }
+  catch (e) { return fail([`dependency-cruiser:\n${errText(e)}`]); }
   console.log("  ✓ gate:graph — acyclic + allowed-edges");
   return true;
 }
@@ -146,7 +175,7 @@ function gateGraph() {
 function gateIsolationPy() {
   const s = join(ROOT, "scripts", "check-isolation-py.mjs");
   try { execSync(`node ${JSON.stringify(s)} --mode=isolation`, { stdio: "pipe" }); }
-  catch (e) { return fail([`python isolation:\n${(e.stdout || e.stderr || e).toString().slice(0, 1200)}`]); }
+  catch (e) { return fail([`python isolation:\n${errText(e).slice(0, 1200)}`]); }
   console.log("  ✓ gate:isolation-py — every Python sibling import is own-module, declared, or an allowed edge");
   return true;
 }
@@ -159,7 +188,7 @@ function gateIsolationPy() {
 function gateGraphPy() {
   const s = join(ROOT, "scripts", "check-isolation-py.mjs");
   try { execSync(`node ${JSON.
```

#### Recent Merged Pull Requests:
- **PR #1695** (closed): Dev jeevan (@AumJeevan24)
- **PR #1685** (closed): fix(deploy): MinIO sidecar images from quay.io, pinned — Docker Hub minio/* no longer pulls (#1671) (@DmitriyG228)
- **PR #1674** (2026-09-16): README: three doors under the title block (connect · API key · founder); credit line matches pricing (@DmitriyG228)
- **PR #1661** (2026-09-07): carve: prune the claude-plugin CALM node — clients/claude-plugin stays out of the carve (@DmitriyG228)
- **PR #1660** (closed): carve: include clients/claude-plugin (v0.12.27 train failed gate:dataflow on the carved tree) (@DmitriyG228)
- **PR #1656** (2026-09-07): promote: an ABSENT negative-control tag is unchanged, not an error (@DmitriyG228)
- **PR #1654** (2026-09-07): release: pin the v0.12.27 stable-promotion map identity (@DmitriyG228)
- **PR #1651** (2026-09-06): release-witness-gate: a receipt may name the candidate it walked, not only the published tag (@DmitriyG228)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
