# Forensic Learning Record (Deep Inspection): totec448-spec/chat-on-steroids

> **Canonical Artifact**: `07_PROJECT_LEARNING/totec448-spec-chat-on-steroids-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/totec448-spec/chat-on-steroids](https://github.com/totec448-spec/chat-on-steroids))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:16:08.137Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `totec448-spec/chat-on-steroids`
- **Description**: Cross-platform local MCP capabilities for ChatGPT with Chrome integration, Goal, Compact & Resume, and durable multi-agent workflows.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4210 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `electron.vite.config.ts`
```
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';

const nixNodeModules = process.env.npmDeps ? resolve(process.env.npmDeps, 'node_modules') : null;

export default defineConfig({
  main: {
    // Keep node_modules external so the MCP SDK ships as real files in the asar
    // rather than being inlined by the bundler.
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          'pet-overlay': resolve(__dirname, 'src/preload/pet-overlay.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    // nixpkgs' development hook links dependencies from its immutable node_modules
    // derivation. Vite resolves those symlinks before its filesystem check, so allow
    // that exact derivation when `nix develop` exports it as npmDeps.
    server: nixNodeModules
      ? {
          fs: {
            allow: [resolve(__dirname), nixNodeModules]
          }
        }
      : undefined,
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          'pet-overlay': resolve(__dirname, 'src/renderer/pet-overlay.html')
        }
      }
    }
  }
});

```

### Core Architecture Module: `extension/active-tabs.js`
```
/** Lightweight rendering leases. The bridge/operation owns activity, never this module. */
export function createActiveTabs(chrome) {
  const KEY = 'cosActiveTabs';
  const scopes = new Map(), states = new Map(), retiring = new Set(), cancelled = new Map();
  let syncing = null, again = false;
  const valid = tab => Number.isInteger(tab?.id) && tab.id > 0 && typeof tab.url === 'string' &&
    tab.url.length <= 4096 && /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url) && !tab.pendingUrl;
  const save = () => chrome.storage.session.set({ [KEY]: [...states.values(), ...retiring]
    .filter(s => s.attached || s.failed).map(s => ({ id: s.id, url: s.url, attached: s.attached, failed: s.failed === true })) });
  const loaded = (async () => {
    // Persisted attachment custody permits cleanup only. Fresh policy must earn a new lease.
    const stored = (await chrome.storage.session.get(KEY))[KEY];
    for (const tab of (Array.isArray(stored) ? stored : []).slice(0, 64)) {
      if (!valid(tab)) continue;
      if (tab.attached) retiring.add({ id: tab.id, url: tab.url, attached: true });
      if (tab.failed) cancelled.set(tab.id, tab.url);
    }
  })();
  async function detach(state) {
    if (!state.attached) return;
    try { await chrome.debugger.detach({ tabId: state.id }); }
    catch {
      const targets = await chrome.debugger.getTargets();
      if (targets.some(t => t.tabId === state.id && t.attached)) throw new Error('Active tab release remains pending');
    }
    state.attached = false;
  }
  function current(state) { return states.get(state.id) === state && !state.cancelled; }
  async function attach(state) {
    if (cancelled.get(state.id) === state.url) state.failed = true;
    if (state.attached || state.failed || !current(state)) return;
    const tab = await chrome.tabs.get(state.id).catch(() => null);
    if (!current(state) || !valid(tab) || tab.url !== state.url) return;
    // A foreign debugger (including the browser tools) keeps its own session. Never steal it.
    state.attaching = true;
    try { await chrome.debugger.attach({ tabId: state.id }, '1.3'); }
    catch { state.failed = true; return; }
    finally { state.attaching = false; }
    state.attached = true;
    try {
      await save();
      const latest = await chrome.tabs.get(state.id);
      if (!current(state) || !valid(latest) || latest.url !== state.url) throw new Error('Tab changed');
      await chrome.debugger.sendCommand({ tabId: state.id }, 'Emulation.setFocusEmulationEnabled', { enabled: true });
      if (!current(state)) throw new Error('Activity ended');
    } catch {
      state.failed = true;
      await detach(state);
    }
  }
  function sync() {
    if (syncing) { again = true; return syncing; }
    syncing = (async () => {
      await loaded;
      do {
        again = false;
        for (const state of retiring) {
          await detach(state);
          retiring.delete(state);
        }
        for (const [id, url] of cancelled) if (states.get(id)?.url !== url) cancelled.delete(id);
        // No DOM, Runtime, Network, screenshots, artificial input or polling domains.
        for (const state of states.values()) await attach(state);
        await save();
      } while (again);
    })().finally(() => { syncing = null; });
    return syncing;
  }
  function project() {
    const wanted = new Map();
    for (const scope of scopes.values()) for (const tab of scope.tabs) if (valid(tab) && wanted.size < 64) wanted.set(tab.id, tab);
    for (const [id, state] of states) {
      if (wanted.get(id)?.url === state.url) continue;
      state.cancelled = true;
      states.delete(id);
      if (state.attached || state.attaching) retiring.add(state);
    }
    for (const [id, tab] of wanted) if (!states.has(id)) states.set(id, { id, url: tab.url, attached: false, failed: false });
    return sync();
  }
  return {
    // These are projections of existing owners, not persisted activity or opening authority.
    set(scope, tabs, eligible = null) {
      if (tabs.length) scopes.set(scope, { tabs: tabs.filter(valid).slice(0, 64), eligible });
      else scopes.delete(scope);
      return project();
    },
    owns(id) { return states.has(id) || [...retiring].some(s => s.id === id); },
    revoke() { scopes.clear(); return project(); },
    navigation(id, tab = null) {
      if (!states.has(id) && ![...retiring].some(s => s.id === id)) return Promise.resolve();
      let retained = false;
      for (const scope of scopes.values()) {
        const keep = scope.tabs.some(previous => previous.id === id) && tab?.id === id && valid(tab) && scope.eligible?.(tab) === true;
        scope.tabs = scope.tabs.flatMap(previous => previous.id !== id ? [previous] : keep ? [tab] : []);
        retained ||= keep;
      }
      // SPA routing keeps the browser document. Its existing owner can approve
      // the new route without suspending rendering during native New Chat.
      // Full document loads pass no tab and always release the old lease.
      const state = states.get(id);
      if (retained && state) {
        if (cancelled.get(id) === state.url) cancelled.set(id, tab.url);
        state.url = tab.url;
      }
      return project();
    },
    detached({ tabId }) {
      // Our own release can notify before its promise settles. It belongs to the retired
      // attachment, never a freshly projected successor at the same tab id.
      const old = [...retiring].find(s => s.id === tabId && s.attached);
      if (old) { old.attached = false; return sync(); }
      // Chrome/user cancellation lasts until this activity scope ends. No attach loop.
      const state = states.get(tabId);
      if (!state) return Promise.resolve();
      state.attached = false; state.failed = true; cancelled.set(tabId, state.url);
      return sync();
    }
  };
}

```

### Core Architecture Module: `extension/background.js`
```
/**
 * Service worker: the only part of the extension that talks to the app.
 *
 * The pairing token lives here and in chrome.storage.local, never in a content
 * script and never in the page. A content script that were somehow compromised can
 * ask this worker to post observations about the page it is already reading; it
 * cannot read the token, cannot reach the app on its own (the app refuses a
 * https://chatgpt.com origin), and there is no message that makes the app touch a
 * file, run a command or change a permission.
 *
 * Discovery is a scan of five fixed loopback ports for a /hello that identifies the
 * app. Nothing is broadcast and nothing listens.
 *
 * This worker also owns the observation journal. A content script lives only as long as
 * its page: a reload, a navigation or a crash takes its memory with it, and ChatGPT
 * virtualises old turns, so what is gone is often gone for good. So a content script
 * hands an observation over immediately and the durable copy lives here, in
 * chrome.storage.session — which survives this worker being shut down (Chrome does that
 * after seconds of idling) and dies with the browser, which is the right lifetime for a
 * record the app has not accepted yet.
 */

import { createBrowserControl } from './browser-control.js';
import { createActiveTabs } from './active-tabs.js';

const activeTabs = globalThis.chrome?.debugger ? createActiveTabs(chrome) : null;

const PORTS = [8765, 8766, 8767, 8768, 8769];
const HELLO_TIMEOUT_MS = 1200;
const REQUEST_TIMEOUT_MS = 10_000;
/** A journal receipt follows durable session writes, which can outlast an ordinary read. */
const EVENTS_REQUEST_TIMEOUT_MS = 60_000;
/**
 * The deadline for the one route that waits on a model rather than on the app's own state.
 *
 * Ordinary reads use ten seconds; journal delivery has its own durable-write budget.
 * `/goal/open` is different: it holds the
 * connection open for a whole OpenRouter completion, which the app itself allows 180s for. A
 * shorter deadline here does not cancel that work — the app keeps going and the account is
 * still billed for the answer — it only guarantees nobody is left to receive it.
 *
 * So this sits above the app's own timeout on purpose. Whichever way the request ends, the
 * app's error handling is the half that gets to say why.
 */
const MODEL_REQUEST_TIMEOUT_MS = 190_000;

/** The reason a deadline aborts with, so it is a fact the caller can act on rather than prose. */
const TIMED_OUT = 'the app took too long to answer';
/** Bumped only when the request/response shape changes; the app compares it. */
const BRIDGE_PROTOCOL = 14;
/** Browser-owned presentation preferences also exposed by the popup. */
const RENDER_STREAM_KEY = 'renderStreamEnabled';
const SHOW_TIMES_KEY = 'showStreamTimes';
let companionDiagnosticsFlight = null;

/**
 * Journal caps. The byte figure is what actually matters — chrome.storage.session has a
 * ten-megabyte budget for the whole extension — and the count keeps a pathological run
 * of tiny events from making every write expensive.
 */
const MAX_JOURNAL = 4000;
const MAX_JOURNAL_BYTES = 4 * 1024 * 1024;
const BATCH = 100;
const RETRY_ALARM = 'clf-bridge-drain';
/**
 * How long the worker sleeps between maintenance passes, in minutes.
 *
 * Thirty seconds, because thirty seconds is the floor. Chrome fires an alarm at most twice a
 * minute and clamps anything shorter in a packed extension — an unpacked development copy is
 * exempt, which is the trap: 0.25 works on this machine and silently becomes 0.5 for everybody
 * who installs a release.
 *
 * The app owns repair deadlines and normally wakes this worker over its socket.
 * This alarm is the fallback when that wake is unavailable; it can add up to
 * thirty seconds before the next collection pass.
 *
 * That floor is also why one pass collects *every* repair now due rather than one: the app can
 * decide three at the same instant, and handing them out one per pass would spread three
 * reloads across a minute and a half for no reason anybody chose.
 *
 * A one-shot re-armed at the end of every pass, rather than `periodInMinutes`: a period may not
 * go below a minute at all, and that periodic form was why a repair armed at T+20 could wait
 * until T+75.
 */
const RETRY_PERIOD_MIN = 0.5;
let retryAlarmScheduled = false;

let port = null;
let token = null;
let loaded = false;
/**
 * The one `load()` in flight, shared by everything that has to wait for it.
 *
 * `loaded` alone is not a guard, because it is only set after two awaited storage reads.
 * Chrome stops this worker after seconds of idling, so the cold path is the normal path:
 * two tabs report at the same moment, both see `loaded === false`, and both walk the whole
 * of load(). The first finishes, its handler enqueues an observation and persists it — and
 * then the second finishes and assigns the journal it read *before* that write straight
 * over the global. The entry the first handler already answered `ok` for is gone, and
 * nothing anywhere reports a loss, because as far as both halves are concerned each did
 * its job. Serialising initialisation is the whole fix: after this, the second caller
 * awaits the same promise and never re-reads.
 */
let loading = null;

/**
 * Set when the user disconnected on purpose, and cleared only when they connect again.
 *
 * Without it, "Disconnect" cleared the token and the very next `/hello` handed this
 * browser a new one — a button whose effect lasted until the next poll, roughly two
 * seconds. Auto-provisioning is right for a browser that has never connected and wrong
 * for one that was told to stop, and only this flag can tell those two apart.
 */
let disconnected = false;
/**
 * Monotonic user connection intent for this worker lifetime.
 *
 * `/pair` is an async mint. A user can press Disconnect after that request has left but
 * before its response arrives; without an intent fence the old response writes its token and
 * clears `disconnected`, undoing the newer click. Worker restart needs no persisted generation
 * because an in-flight fetch cannot survive it; the persisted `disconnected` flag is the
 * cross-worker authority.
 */
let connectionEpoch = 0;

/**
 * The `/pair` in flight, shared by everything that wants a token.
 *
 * Several tabs coming back at once all find no token and all call `/pair`. Each call
 * mints a fresh credential and invalidates the one before it, so the tabs rotate each
 * other's tokens: every request 401s, drops its token, and provisions again. One promise
 * means one credential no matter how many callers arrive together.
 */
let pairing = null;
let pairingEpoch = -1;
let pairingReconnect = false;
/** Most recent pairing failure, for the popup. Process-local and never a credential. */
let pairingError = null;

/**
 * When the app was last confirmed to be on `port`, and how long that is believed for.
 *
 * `discover()` used to run a `/hello` before every authenticated request, which doubled
 * the bridge traffic of an already-chatty poll and, with several tabs open, could spend
 * the 900/min budget on nothing but asking whether the app was still there. A failed
 * request re-checks immediately, so nothing is lost by believing a recent answer.
 */
let portCheckedAt = 0;
let portCompatible = null;
let appVersion = null;
let appProtocol = null;
const PORT_TRUST_MS = 30_000;

/**
 * Observations accepted from content scripts but not yet accepted by the app.
 *
 * Each entry carries the conversation it was observed in, captured at that moment.
 * Flushing groups by that field rather than labelling a whole batch with whatever
 * conversation happens to be current — a tab that moves from chat A to chat B while the
 * app is unreachable would otherwise file A's messages into B's history.
 */
let journal = [];
/** Two transport slots, with one in-flight batch per conversation. The journal owns custody. */
const JOURNAL_CONCURRENCY = 2;
const journalWorkers = new Set();
const j
```

### Core Architecture Module: `extension/browser-control-page.js`
```
/** Fixed DOM reader/target helper in an isolated world. No extension token enters the page. */
export function browserPage(operation, args) {
  const key = '__cosBrowserControl';
  // Inspection must not overwrite another caller's interactive references or overlay.
  const inspection = operation === 'inspect';
  let state = inspection ? { refs: new Map(), next: 0, pageId: args.pageId } : globalThis[key];
  if (!state || state.pageId !== args.pageId) {
    const overlay = state?.overlay?.isConnected ? state.overlay : null;
    state = globalThis[key] = { pageId: args.pageId, refs: new Map(), next: 0, overlay };
  }
  const compact = (value, max = 200) => String(value ?? '').slice(0, max * 4).replace(/\s+/g, ' ').trim().slice(0, max);
  const textOf = (element, excludeControls = false) => {
    if (!element) return '';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let text = '', node, count = 0;
    while (text.length < 800 && count++ < 100 && (node = walker.nextNode())) {
      if (excludeControls && node.parentElement?.closest('select,textarea')) continue;
      text += node.nodeValue.slice(0, 800 - text.length);
    }
    return compact(text);
  };
  const fail = message => { throw new Error(message); };
  const visible = (element, subtree = false) => {
    const style = getComputedStyle(element);
    return !element.closest('[inert]') && style.display !== 'none' && style.visibility !== 'hidden' &&
      (element.getClientRects().length > 0 || subtree && style.display === 'contents');
  };
  const resolve = ref => {
    const element = state.refs.get(ref);
    if (!element?.isConnected || !visible(element)) fail('BROWSER_REF_STALE: snapshot again; the element is gone or hidden.');
    if (element.matches(':disabled,[aria-disabled="true"]')) fail('BROWSER_ELEMENT_DISABLED');
    return element;
  };
  const label = element => {
    const ids = compact(element.getAttribute('aria-labelledby'), 500).split(' ').filter(Boolean);
    const labelled = ids.map(id => textOf(element.getRootNode().getElementById?.(id))).join(' ');
    return compact(element.getAttribute('aria-label') || labelled ||
      (element.labels ? Array.from(element.labels).slice(0, 5).map(node => textOf(node, true)).join(' ') : '') ||
      element.getAttribute('alt') || element.getAttribute('title') || element.getAttribute('placeholder') ||
      (element.tagName === 'INPUT' && ['button','submit','reset'].includes(element.type) ? element.value : '') || textOf(element));
  };

  if (operation === 'overlay') {
    state.overlay?.remove();
    const host = document.createElement('div');
    host.setAttribute('data-cos-browser-control', args.lease);
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;display:block!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const glow = document.createElement('div');
    glow.style.cssText = 'position:fixed;inset:0;box-shadow:inset 0 0 20px #3984ff99,inset 0 0 52px #3984ff55;pointer-events:none;';
    shadow.append(glow); document.documentElement.append(host); state.overlay = host;
    return true;
  }
  if (operation === 'removeOverlay') { state.overlay?.remove(); state.overlay = null; return true; }

  if (operation === 'snapshot' || inspection) {
    let root = document.body || document.documentElement;
    if (args.selector) {
      let scopeError;
      try { root = document.querySelector(args.selector); }
      catch { scopeError = 'BROWSER_SELECTOR_INVALID: selector must be valid CSS.'; }
      if (!scopeError && !root) scopeError = 'BROWSER_SELECTOR_NOT_FOUND: the requested subtree is absent. Inspect the page or choose a current selector.';
      if (scopeError) {
        // scripting.executeScript does not serialize a thrown page exception as a result.
        if (inspection) return { error: scopeError };
        fail(scopeError);
      }
    }
    // An explicit new snapshot replaces refs, preventing ref reuse after node replacement.
    state.refs.clear();
    const lines = []; let chars = 0, visited = 0, emitted = 0, elements = 0, truncated = false;
    const append = line => {
      if (emitted >= args.maxNodes || chars + line.length + 1 > args.maxChars) { truncated = true; return false; }
      lines.push(line); chars += line.length + 1; emitted++; return true;
    };
    const filter = (args.filter || '').toLocaleLowerCase();
    const dom = args.format === 'dom';
    const details = node => {
      const attributes = [];let attributeChars = 0, seen = 0;
      for (const attribute of node.attributes) {
        if (++seen > 100) {truncated = true;break;}
        if (!/^(?:id|class|role|name|type|href|src|title|placeholder|contenteditable|tabindex|disabled|hidden|aria-[\w-]+|data-[\w-]+)$/.test(attribute.name)) continue;
        const name = attribute.name.slice(0,100), value = attribute.value.slice(0,300);
        if (name.length < attribute.name.length || value.length < attribute.value.length) truncated = true;
        const text = `${name}=${JSON.stringify(value)}`;
        if (attributes.length >= 16 || attributeChars + text.length > 1600) {truncated = true;break;}
        attributes.push(text);attributeChars += text.length;
      }
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      const box = [rect.left,rect.top,rect.width,rect.height].map(v=>Math.round(v*10)/10);
      const css = ['display','visibility','position','overflow','pointer-events','opacity'].map(name=>`${name}=${compact(style.getPropertyValue(name),80)}`).join(' ');
      return `<${node.tagName.toLowerCase()}${attributes.length?' '+attributes.join(' '):''}> rect=${JSON.stringify(box)} ${css}`;
    };
    const implicit = { A: 'link', BUTTON: 'button', TEXTAREA: 'textbox', SELECT: 'combobox', CANVAS: 'canvas', IMG: 'img', H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', SUMMARY: 'button' };
    const stack = [{ node: root, depth: 0, namedParent: false }];
    while (stack.length) {
      if (++visited > 15000 || emitted >= args.maxNodes || chars >= args.maxChars) { truncated = true; break; }
      const { node, depth, namedParent } = stack.pop();
      if (node.nodeType === Node.TEXT_NODE) {
        if (namedParent) continue; // The ancestor's accessible name already includes this text.
        const text = compact(node.nodeValue, 500);
        if (text && (!filter || text.toLocaleLowerCase().includes(filter))) {
          const line = `${'  '.repeat(Math.min(depth, 16))}${text}`;
          if (!append(line)) break;
        }
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE || node === state.overlay ||
          ['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','HEAD'].includes(node.tagName) || !visible(node, true)) continue;
      let role = compact(node.getAttribute('role'), 50) || implicit[node.tagName];
      if (node.tagName === 'INPUT') role = ({ checkbox: 'checkbox', radio: 'radio', range: 'slider', button: 'button', submit: 'button' })[node.type] || 'textbox';
      const editingHost = node.isContentEditable && !node.parentElement?.isContentEditable;
      if (!role && (editingHost || node.tabIndex >= 0 || node.hasAttribute('onclick'))) role = editingHost ? 'textbox' : 'interactive';
      const named = role && ['button','link','textbox','checkbox','radio','combobox','slider','img','heading','interactive'].includes(role);
      let name = '';
      if (role || dom) {
        name = role ? label(node) : '';
        const detail = dom ? details(node) : '';
        // Native option popups need no DOM visibility or individual ref: select
        // consumes the parent ref and exact values. Bound discovery at its owner.
        const options = [];
        if (node.tagName === 'SELECT') {
          for (let i = 0; i < Math.min(node.options.length, 200); i++) {
            const option = node.options[i];
            const flags = [option.selected ? '
```

### Core Architecture Module: `extension/browser-control.js`
```
import { browserPage, boundedBrowserValue, browserFramePoint } from './browser-control-page.js';

/** One browser-lifetime tab custodian. No selected-tab fallback and no action replay. */
export function createBrowserControl(chrome, transport, protectedTab = () => false) {
  const KEY = 'cosBrowserControl';
  const tabs = new Map();
  let browserId, epoch = null, receipt = null, loading, pumping, again = false, saving = Promise.resolve();
  let policy = { read: false, write: false };
  const id = () => crypto.randomUUID();
  const cut = (s, n = 1000) => String(s ?? '').slice(0,n);
  const error = message => { throw new Error(message); };
  const handle = tabId => `${browserId}:${tabId}`;
  const owns = (state, command) => !!state && (state.owner === command.owner ||
    state.owner.startsWith('request:') && command.owner.startsWith('session:') && command.ownerAliases?.includes(state.owner));
  async function cleanup(work) {
    let timer;
    try { await Promise.race([work.catch(() => {}),new Promise(resolve => {timer=setTimeout(resolve,1500);})]); }
    finally {clearTimeout(timer);}
  }
  function removeIndicator(state) {
    return chrome.scripting.executeScript({target:{tabId:state.tabId},args:[state.lease],func:lease=>{
      for(const node of document.querySelectorAll('[data-cos-browser-control]')) if(node.getAttribute('data-cos-browser-control')===lease)node.remove();
    }});
  }
  const pageURL = raw => {
    if (raw === 'about:blank') return raw;
    let url; try { url = new URL(raw); } catch { error('BROWSER_URL_INVALID'); }
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) error('BROWSER_URL_UNSUPPORTED: use an HTTP(S) page without embedded credentials.');
    return url.href;
  };
  function save() {
    const work = saving.catch(() => {}).then(() => chrome.storage.session.set({ [KEY]: {
      browserId, epoch, receipt,
      tabs: [...tabs.values()].map(s => ({ tabId: s.tabId, owner: s.owner, lease: s.lease }))
    } }));
    saving = work; return work;
  }
  function newState(tabId, owner, lease = id()) {
    return { tabId, owner, lease, pageId: id(), contexts: new Map(), frames: new Map(), sessions: new Set(),
      console: [], network: new Map(), seq: 0, consoleDropped: 0, networkDropped: 0, screenshot: null, dialog: null, initialized: false };
  }
  function invalidate(state) {
    state.pageId = id(); state.screenshot = null; state.refFrames?.clear();
    for (const key of state.contexts.keys()) if (key.endsWith(':isolated')) state.contexts.delete(key);
  }
  async function ready() {
    if (!loading) loading = (async () => {
      const data = (await chrome.storage.session.get(KEY))[KEY];
      browserId = typeof data?.browserId === 'string' && /^[a-f\d-]{36}$/i.test(data.browserId) ? data.browserId : id();
      epoch = data?.epoch || null; receipt = data?.receipt || null;
      for (const entry of (Array.isArray(data?.tabs) ? data.tabs : []).slice(0,32)) {
        if (Number.isSafeInteger(entry.tabId) && typeof entry.owner === 'string' && typeof entry.lease === 'string') {
          const state = newState(entry.tabId, entry.owner, entry.lease);state.restored = true;tabs.set(entry.tabId,state);
        }
      }
      await save();
    })();
    return loading;
  }
  function alive(state, command) {
    if (tabs.get(state.tabId) !== state) error('BROWSER_DETACHED: tab ownership was released. Attach again deliberately.');
    if (command && (command.epoch !== epoch || command.expiresAt <= Date.now())) error('BROWSER_EXPIRED: remaining input was not dispatched. Earlier actions may have completed.');
    if (command?.args.pageId && !/^[a-f\d-]{36}$/i.test(command.args.pageId)) error('BROWSER_PAGE_ID_INVALID: copy the top-level pageId from the observation, not a frameId or element ref. No input was dispatched.');
    if (command?.args.pageId && state.pageId !== command.args.pageId) error('BROWSER_PAGE_STALE: navigation invalidated the observation. Snapshot again.');
  }
  async function send(state, method, params = {}, sessionId, command) {
    alive(state,command);
    if (method === 'Input.dispatchMouseEvent' && params.__sessionId) {
      const {__sessionId,...inputParams} = params;sessionId = __sessionId;params = inputParams;
    }
    let timer;
    try {
      return await Promise.race([
        chrome.debugger.sendCommand({ tabId: state.tabId, ...(sessionId ? { sessionId } : {}) }, method, params).then(value => {alive(state);return value;}),
        new Promise((_,reject) => { timer = setTimeout(() => {
          // Retire admission before releasing a stuck debugger. A late result cannot
          // lend its target to another command; accepted effects are not replayed.
          if (tabs.get(state.tabId) === state) {
            tabs.delete(state.tabId);
            void cleanup(removeIndicator(state));
            if (method === 'Runtime.evaluate') void chrome.debugger.sendCommand({tabId:state.tabId,...(sessionId ? {sessionId}: {})},'Runtime.terminateExecution').catch(() => {});
            void chrome.debugger.detach({tabId:state.tabId}).catch(() => {});
            void save().catch(() => {});
          }
          reject(new Error(`BROWSER_CDP_TIMEOUT: ${method} did not acknowledge within its deadline. This attachment was retired; the tab was not closed. List tabs, explicitly attach the same existing tab, then inspect before repeating any input.`));
        // Background compositing can legitimately outlast input's 8s bound. A
        // capture gets 20s within the same absolute RPC deadline, never a retry.
        }, Math.min(method==='Page.captureScreenshot' ? 20000 : 8000,command ? Math.max(1,command.expiresAt-Date.now()) : 8000)); })
      ]);
    } catch (cause) {
      clearTimeout(timer);
      // A debugger loss can race its MV3 notification. Confirm Chrome's current target
      // state before retiring custody; an ordinary protocol/JavaScript error is not detach.
      if (tabs.get(state.tabId) === state) {
        const targets = await chrome.debugger.getTargets().catch(() => null);
        if (targets && !targets.some(target => target.tabId === state.tabId && target.attached)) {
          await release(state);
          error('BROWSER_DETACHED: Chrome ended this attachment. Earlier input may have completed; inspect before repeating.');
        }
      }
      throw cause;
    } finally { clearTimeout(timer); }
  }
  async function currentTab(state, command) {
    alive(state,command);
    const tab = await getTab(state.tabId);
    alive(state,command);
    pageURL(tab.url);
    if (tab.pendingUrl && tab.pendingUrl !== tab.url) error('BROWSER_NAVIGATING: wait for the destination and snapshot again.');
    const observes = ['browser_snapshot','browser_screenshot','browser_console','browser_network'].includes(command?.tool);
    if (!observes && protectedTab(state.tabId, tab.url, command?.conversationId)) error('BROWSER_EXECUTOR_TAB: active ChatGPT orchestration owns this tab. browser_snapshot can inspect its DOM directly without attach. Input, navigation and arbitrary JavaScript remain unavailable here.');
    return tab;
  }
  async function getTab(tabId) {
    try { return await chrome.tabs.get(tabId); }
    catch (cause) {
      if (/No tab with id|Invalid tab ID/i.test(cause?.message || '')) error('BROWSER_TAB_CLOSED: this exact tab no longer exists, possibly closed by the user. List tabs to inspect current state; do not recreate it automatically.');
      throw cause;
    }
  }
  async function input(state, method, params, command) {
    await authorize(command);
    await currentTab(state,command);
    return send(state,method,params,undefined,command);
  }
  async function authorize(command, writes = true) {
    if (!(writes ? policy.write : policy.read)) error('BROWSER_PERMISSION_REVOKED');
    const check = await transport('/browser-control',{method:'POST',body:JSON.stringify({action:'check',browserId,id:command.id,epoch:command.epoch})});
    if (!check.ok || check
```

### Core Architecture Module: `extension/chatgpt-dom.js`
```
/**
 * Everything that knows what ChatGPT's page looks like.
 *
 * This is the only file that will break when ChatGPT changes, which is why it is the
 * only file allowed to contain a selector. Every function returns a safe empty value
 * instead of throwing, so a redesign degrades the companion to "records nothing new"
 * rather than breaking the page the user is working in.
 *
 * Anchors used, in order of how directly the live page exposes them:
 *   · turn/message data-* attributes when present (data-turn-id, data-message-id,
 *     data-message-author-role, data-interrupted, data-testid)
 *   · `.markdown` for assistant prose when the current renderer supplies no assistant
 *     data-message-id; progress markdown under data-interrupted is excluded
 *   · the id #prompt-textarea on the composer, and the send/stop/dictation buttons beside
 *     it, which is where our own composer control is anchored
 *   · one structural tool-message class substring, plus a display-contents row shape that
 *     is confirmed structurally (short header line, no prose) before it is believed
 *
 * None of these are a public ChatGPT API. In the live 2026-08-15 page one logical
 * assistant request can also be split into several sections sharing data-turn-id, so
 * turns are grouped before messages, progress or tool blocks are counted. Hashed
 * CSS-module class names are never matched because they are intentionally ephemeral.
 */

var CLF_DOM = (() => {
  // @ehkogh/#318: an alternate exchange contains both roles. Keep the native
  // structure intact; the MAIN reader supplies exact message ids on its slots.
  const LEGACY_TURN = 'section[data-testid^="conversation-turn"]';
  const SHELL_TURN = '[data-app-shell-main-surface] [data-thread-find-target="conversation"] [data-turn-key]';
  const SHELL_UNIT = '[data-content-search-unit-key]';
  // September 2026 search-unit rollout: the user/assistant rows are direct children of a
  // data-turn-key container rather than section[data-testid] or data-content-search units.
  const SEARCH_TURN = '[data-chatgpt-search-unit-key]';
  const TURN = `${LEGACY_TURN}, ${SHELL_TURN}, ${SEARCH_TURN}`;
  const PICKER = '[data-testid="composer-intelligence-picker-content"], [data-model-picker-view]';
  // ChatGPT has used both shapes in the live renderer: the older tool-message span
  // and, as of 2026-08-15, a display-contents row wrapping the visible tool label.
  // Keep both explicit structural anchors; hashed CSS-module names remain off limits.
  const TOOL_LEGACY = 'span[class*="tool-message"]';
  const STATUS_V5 = 'div:has(> [data-testid="cot-v5-tool-icon-pile"])';
  const TOOL = `${TOOL_LEGACY}, div.pointer-events-none.contents, ${STATUS_V5}`;
  // MAIN-world scan stamps only a row whose own message group proves api_tool.
  // A translated label or a generic built-in tool button never establishes identity.
  const CONNECTOR = '[data-clf-fiber]';
  const STOP =
    'button[data-testid="stop-button"], button[data-testid="composer-stop-button"], ' +
    'button[aria-label="Stop streaming"], button[aria-label="Stop generating"], button[aria-label="Stop answering"]';
  const SEND = 'button[data-testid="send-button"], form button[aria-label^="Send" i], form[data-chatgpt-composer] button[type="submit"]';
  /** The composer's own trailing controls, where the send and dictation buttons live. */
  const TRAILING =
    '[data-testid="composer-trailing-actions"], [data-testid="composer-footer-actions"], ' +
    '[class~="[grid-area:trailing]"]';
  const SPEECH =
    'button[data-testid="composer-speech-button"], button[data-testid="composer-dictate-button"], ' +
    'button[aria-label^="Dictate" i], button[aria-label^="Voice" i], ' +
    'button[aria-label="Start dictation" i], button[aria-label="Start Voice" i]';
  const safe = (fn, fallback) => {
    try {
      const value = fn();
      return value === undefined || value === null ? fallback : value;
    } catch {
      return fallback;
    }
  };

  const text = (node, cap = 256_000) =>
    node ? (node.textContent || '').replace(/ /g, ' ').trim().slice(0, cap) : '';

  function searchUnitRole(node) {
    const key = node?.getAttribute?.('data-chatgpt-search-unit-key') ||
      node?.getAttribute?.('data-content-search-unit-key') || '';
    return /:(user|assistant)$/.exec(key)?.[1] || '';
  }

  // Wire framing matches shared/user-prompt.ts; neither reader changes provider text.
  const promptContinuation = value => /^\[\[CLF-(?:HANDOFF|RESUME):[A-Za-z0-9_-]{16,64}\]\]\n\n/.exec(value)?.[0] ?? '';
  // The composer treats what it is given as Markdown source and escapes it on readback: a
  // backslash before ASCII punctuation, and one before a newline for a hard line break. The
  // frame is punctuation and newlines almost entirely, so an escaped readback matches none of
  // it — and the declared length stops matching too, because escaping adds characters. Read
  // exactly first, as everywhere else; only a frame that cannot be read as sent is read as one
  // the page escaped. It also writes an indented line's first space as `&#x20;` (#821).
  // Keep in sync with asTyped() in shared/user-prompt.ts.
  const promptAsTyped = value => value.replace(/\\\n/g, '\n').replace(/\\([!-/:-@[-`{-~])/g, '$1').replace(/(^|\n)&#x20;/g, '$1 ');
  function readPromptFrame(value) {
    const identity = promptContinuation(value);
    const header = /^\[\[COS_CONTEXT:(\d{1,6})\]\]\n/.exec(value.slice(identity.length));
    if (!header) return null;
    const end = identity.length + header[0].length + Number(header[1]);
    const boundary = '\n[[/COS_CONTEXT]]\n\n';
    return value.startsWith(boundary, end) ? identity + value.slice(end + boundary.length) : null;
  }
  function userPromptText(value) {
    value = value.replace(/\r\n?/g, '\n');
    const exact = readPromptFrame(value);
    if (exact !== null) return exact;
    const typed = promptAsTyped(value);
    return typed === value ? null : readPromptFrame(typed);
  }
  function presentUserPrompts(readUserText) {
    return safe(() => {
      for (const raw of document.querySelectorAll(`[data-message-author-role="user"] :is(.whitespace-pre-wrap, .markdown):not([data-clf-user-text]), ${SHELL_TURN} [data-content-search-unit-key$=":user"] [data-user-message-bubble] .whitespace-pre-wrap:not([data-clf-user-text])`)) {
        // Both native renderers can consume Markdown bytes. Parse the same
        // exact-id source used by receipts/recording, never reconstructed HTML.
        const classic = raw.closest('[data-message-author-role="user"]');
        const holder = classic || raw.closest(SHELL_UNIT), id = messageIdOf(holder);
        const source = !classic && (!id || !readUserText) ? null : readUserText ? readUserText({ role: 'user', id,
          node: classic ? raw.closest(TURN) : holder, text: messageText(holder, 'user') }) : raw.textContent;
        // The native editor can prepend a blank paragraph to the exact provider
        // source. Ignore that outer whitespace only for display; the frame's
        // internal length/boundary and all receipt/recording bytes stay exact.
        const authored = typeof source === 'string' ? userPromptText(source.trimStart()) : null;
        let display = raw.nextElementSibling?.matches('[data-clf-user-text]') ? raw.nextElementSibling : null;
        if (authored === null) {
          raw.removeAttribute('data-clf-prompt-hidden'); display?.remove(); continue;
        }
        if (!display) {
          display = document.createElement('div');
          display.setAttribute('data-clf-user-text', '');
          display.className = 'whitespace-pre-wrap';
          display.dir = 'auto';
          raw.after(display);
        }
        if (display.textContent !== authored) display.textContent = authored;
        if (!raw.hasAttribute('data-clf-prompt-hidden')) raw.setAttribute('data-clf-prompt-hidden', '');
      }
    });
  }

  /**
   * Visible page text with every CLF-owned surface removed first.
   *
   * The
```

### Core Architecture Module: `extension/content.js`
```
/**
 * What runs on the ChatGPT page.
 *
 * Three jobs. Observation never changes the conversation; presentation may replace the
 * visible live activity stream when the user has Overwrite enabled:
 *
 *  1. Observe. Messages, turn boundaries, live progress lines and visible errors are
 *     reported to the local app. Nothing is inferred that the page does not show, and
 *     a turn that stops for no visible reason is reported as exactly that.
 *
 *  2. Relabel. The app knows what every MCP tool call actually did, because it ran it.
 *     Each recorded call is matched to one "Called tool" block and given the real thing.
 *     Matching is per call and incremental: a block that cannot be matched confidently
 *     keeps ChatGPT's own label, and — this is the part that used to be wrong — it no
 *     longer suppresses the blocks around it that *can* be matched.
 *
 *  3. Offer Compact & resume, as a control beside ChatGPT's own composer buttons that
 *     says what the job is doing rather than vanishing on the next React render.
 *
 * Every selector lives in chatgpt-dom.js. This file only deals in the shapes that
 * module returns, so a ChatGPT redesign cannot reach past it.
 */

(() => {
  'use strict';

  // Static content scripts are not re-run in an already-open tab when an unpacked
  // extension is reloaded/updated. background.js deliberately re-injects this file into
  // those tabs from runtime.onInstalled. The normal static injection can race that recovery
  // on a freshly loaded page, so one live isolated-world recorder stays the invariant.
  //
  // Reload invalidates chrome.runtime but can leave the old context's globals and observers
  // alive. This handle arbitrates reinjection within one context; Chrome can also create a
  // separate replacement context, which cannot stop an incumbent through its private global.
  // Every observer therefore checks its OWN runtime synchronously and retires through stop()
  // before touching the shared DOM. Otherwise old and new composer observers can continually
  // remove and reinsert each other's controls, starving transport/timers and freezing the tab.
  // A healthy incumbent in this context still wins the static/recovery injection race.
  const RECORDER_VERSION = 21;
  const recorderHandle = {
    version: RECORDER_VERSION,
    healthy: () => false,
    stop: () => undefined
  };
  {
    const incumbent = globalThis.__CLF_CONTENT_RECORDER__ || null;
    let incumbentHealthy = false;
    try {
      incumbentHealthy =
        !!incumbent && typeof incumbent.healthy === 'function' && incumbent.healthy() === true;
    } catch {
      // A handle that throws is not a working recorder.
      incumbentHealthy = false;
    }
    if (incumbentHealthy && (incumbent.version || 0) >= RECORDER_VERSION) return;
    if (incumbent && typeof incumbent.stop === 'function') {
      try {
        incumbent.stop();
      } catch {
        // Best effort. The orphan's loops are inert once its `chrome.runtime` is gone.
      }
    }
    globalThis.__CLF_CONTENT_RECORDER__ = recorderHandle;
    // Kept only so a recorder from before this handle existed is still visible as "a script
    // ran here". It is never read as a reason to bail out any more.
    globalThis.__CLF_CONTENT_RECORDER_ACTIVE__ = true;
  }

  const OBSERVE_MS = 1000;
  /** Streaming mutations are bursty; never run a transcript-wide pass per token. */
  const TRANSCRIPT_OBSERVE_MS = 250;
  /**
   * How long the stop button must stay gone before a turn is called finished.
   *
   * Measured on the clock and deliberately *not* counted in observations. observe() is not
   * only the OBSERVE_MS loop: watchTranscript() also runs it from a MutationObserver, via a
   * microtask, on every relevant transcript mutation. A React rerender that unmounts the
   * stop button is itself a burst of such mutations, so a counter of quiet observations can
   * run out inside the same millisecond as the dropout it exists to filter — measuring the
   * one thing that cannot be inflated by rerender churn is the whole point.
   *
   * Four seconds covers the dropouts the live sessions show — 400 ms to 2.7 s, see
   * `quietSince` — with headroom, while delaying an honest `turn_end` by a few seconds,
   * which nothing downstream reads as anything but the turn having taken that much longer.
   */
  const TURN_SETTLE_MS = 4000;
  /** How long a settled question's generation must hold, cleanly, before it counts as a regeneration. */
  const SETTLED_REGENERATION_MS = 20_000;
  // While ChatGPT is generating, keep the app-owned transcript close enough to feel like a
  // stream rather than a two-second slideshow. This does not create duplicate rows: /activity
  // is cursor-based, streamBySeq is keyed by canonical seq, and assistant messages additionally
  // supersede their previous revision through streamMessageSeq. Session reloads are therefore
  // allowed to make us poll sooner without being treated as new transcript content.
  const LIVE_ACTIVITY_MS = 750;
  const ACTIVITY_MS = 2000;
  const IDLE_ACTIVITY_MS = 10_000;
  const HIDDEN_ACTIVITY_MS = 30_000;
  /** Keep previously proven activity ownership through brief Fiber/feed disagreement. */
  const REPLACEMENT_GRACE_MS = 8000;
  /**
   * User-driven scrolling and ChatGPT's historical virtualization happen in the same burst.
   * Never change a turn's layout inside that burst; let the viewport settle first.
   */
  const PRESENTATION_SCROLL_IDLE_MS = 240;
  const STATUS_MS = 15_000;
  /** Longer than any honest tool call: past this a silent turn is called stalled. */
  const STALL_MS = 10 * 60 * 1000;
  /** How long the button says "Starting…" before believing something went wrong. */
  const PRESS_GRACE_MS = 12_000;
  /** Persistent popup preference. On by default as of 1.7.4; the popup can turn it off. */
  const RENDER_STREAM_KEY = 'renderStreamEnabled';
  /** Timestamps are useful for debugging, but too noisy for the normal transcript. */
  const SHOW_TIMES_KEY = 'showStreamTimes';
  /**
   * Production now starts with transcript overwrite enabled. Tests deliberately start off
   * and opt in case-by-case so renderer regressions do not contaminate unrelated capture
   * tests. The storage preference is loaded before the first production paint, avoiding a
   * one-frame flash when somebody has explicitly switched Overwrite off.
   */
  const TEST_MODE = typeof globalThis.CLF_TEST_HOOK === 'function';
  /**
   * Extension-owned UI strings use the shared page-local catalog when it is present.
   * Recovery/reinjection tests can execute this file before the helper is installed, so the
   * English fallback remains a complete, behavior-preserving path.
   */
  function t(key, fallback, substitutions) {
    let translated = '';
    try {
      const helper = globalThis.CLF_I18N;
      if (helper && typeof helper.t === 'function') {
        translated = helper.t(key, fallback, substitutions);
      }
    } catch {
      // A missing/stale helper must never take the recorder down with presentation.
    }
    if (typeof translated === 'string' && translated) return translated;
    let text = String(fallback || '');
    const values = Array.isArray(substitutions)
      ? substitutions
      : substitutions === undefined || substitutions === null
        ? []
        : [substitutions];
    for (let index = 0; index < values.length; index++) {
      text = text.split(`$${index + 1}`).join(String(values[index]));
    }
    return text;
  }
  let RENDER_STREAM = TEST_MODE ? false : true;
  let SHOW_TIMES = false;
  let renderPreferenceReady = TEST_MODE;
  const renderStreamAllowed = () => RENDER_STREAM && renderPreferenceReady;
  let lastPresentationScrollInputAt = -Infinity;

  function editableScrollTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    const element = target;
    return Boolean(
      element.isContentEditable ||
      (element.closest && element.closest('input, textarea, select, [co
```

### Core Architecture Module: `extension/fiber.js`
```
/**
 * The only code this extension runs in ChatGPT's own JavaScript context.
 *
 * A collapsed connector row shows the word "Called tool" and
 * nothing else, but the React Fiber behind it already knows exactly which tool ran, under
 * which connector, and how many further calls that single row is standing in for. That
 * last part is why this file has to exist at all — the page renders one row for a run of
 * calls, not always to the same tool, so the visible rows are not a list of the calls, and
 * no amount of DOM reading from the isolated world can recover the ones it folded away.
 * The same bounded bridge also reads account-evaluated model choices and the installed
 * connector's public tool declarations. Neither path exports account/session objects or
 * invokes React action callbacks; the named serverId$ signal is read only for durable
 * conversation identity. The isolated world owns UI actions and operation claims.
 *
 * Everything here is written on the assumption that it is the least trusted code in the
 * extension:
 *
 *  · **It runs where the page can reach it.** ChatGPT could replace `JSON.parse`,
 *    `postMessage`, `Array.prototype.map` — anything this file touches. Native references
 *    are captured at load, before the page has had a chance to react to us, and the file
 *    is kept short so there is little to subvert.
 *  · **It emits an allowlist, never a filtered copy.** Only the named fields below cross
 *    into the extension. Copying the props and deleting the sensitive parts would be a
 *    denylist, and one renamed field would be a leak — the request JSON has been observed
 *    carrying tool arguments verbatim.
 *  · **It emits no argument values at all, and does not even parse them.** Tool arguments
 *    are the user's own text and this app's own secrets, and there is no key-level
 *    allowlist that generalises across tools. The request payload is never handed to
 *    `JSON.parse`; only the tool path anchored at the very front of it is read, so `args`
 *    is never walked at all. The tool's identity is what relabelling actually needs; the
 *    app already knows the arguments for every call it ran itself.
 *  · **It fails closed.** An unrecognised Fiber shape yields `null` for that row, which
 *    leaves the row exactly as ChatGPT drew it. Guessing would put a wrong tool name on a
 *    real call, which is worse than the generic label it replaced.
 *
 * The receiving side treats everything here as page-controlled evidence regardless: the
 * page can post these same messages itself. See the trust note in content.js.
 */

(() => {
  'use strict';

  /** Bumped when the descriptor shape changes, so a stale pair cannot half-understand. */
  const VERSION = 21;
  // The MAIN world survives an extension reload because the ChatGPT document survives it.
  // Recovery may therefore execute this file again in a page that still has an older helper
  // listener. Retire it across versions too: picker/plugin replies use their own v1
  // protocol, so an older listener can otherwise win with an empty or stale snapshot.
  const ACTIVE_HELPER = '__clfFiberHelper';
  const ASK = 'clf-fiber-ask';
  const REPLY = 'clf-fiber-reply';
  /** Only a successfully described connector row carries this scan reference. */
  const CONNECTOR = '[data-clf-fiber]';
  /**
   * A runaway guard on the climb, not a claim about how the page is shaped.
   *
   * This was 30, taken from an observed depth, and the live page put the group node at
   * exactly 30 — one past `up < MAX_CLIMB`. Every row of every chat then produced no
   * descriptor at all, silently, because failing closed is indistinguishable from a
   * browser where this helper never ran. What stops the climb now is `groupOf`'s own test
   * for the shape it wants; this number only keeps a detached or cyclic tree from looping.
   */
  const MAX_CLIMB = 80;
  const MAX_TEXT = 200;
  /** A page with more connector rows than this is not one we need to read exhaustively. */
  const MAX_ROWS = 400;
  /** Mounted section groups read per scan, including user and assistant groups. */
  const MAX_TURNS = 6;
  /** Connector requests reported for one turn. Far above any real turn's call count. */
  const MAX_CALLS = 200;
  /** Public generated-image descriptors retained per turn. Pixels never cross this boundary. */
  const MAX_GENERATED_IMAGES = 200;
  /** ChatGPT's own turn anchors, which is where a turn's message model hangs. */
  // Shell anchors and typed items adapted from @ehkogh's #318. Keep one wire format.
  const LEGACY_TURN_SECTION = 'section[data-testid^="conversation-turn"]';
  const SHELL_TURN = '[data-app-shell-main-surface] [data-thread-find-target="conversation"] [data-turn-key]';
  const SEARCH_TURN_ANCHOR = '[data-chatgpt-search-unit-key$=":user"]';
  const SEARCH_TURN_UNIT = '[data-chatgpt-search-unit-key]';
  const TURN_SECTION = `${LEGACY_TURN_SECTION}, ${SHELL_TURN}, ${SEARCH_TURN_ANCHOR}`;
  /** ChatGPT-rendered authored prose. Tool rows and this extension's own surfaces are excluded. */
  const MARKDOWN = '.markdown, [data-markdown-text-style="assistant-message"]';
  const TOOL = 'span[class*="tool-message"], div.pointer-events-none.contents, div:has(> [data-testid="cot-v5-tool-icon-pile"])';
  const GENERATED_IMAGE = '[class~="group/imagegen-image"] img, [class~="group/generated-image-preview"] img';
  const OWN_SURFACES = '.clf-stream, .clf-stage, .clf-composer, .clf-boot';
  const MAX_RENDERED_HTML = 120_000;
  // A 15k–20k-token compaction answer is routinely 60k–90k characters. Capping public
  // assistant prose at 32k here made the canonical session transcript lose the back half
  // even though Compact & Resume itself carried the full DOM answer. One event still stays
  // comfortably below the 512 KiB bridge body cap alongside its bounded rendered HTML.
  // Safety guard only. Compact & Resume is specified in tokens (up to 30k), so this must be
  // comfortably larger than a normal handoff rather than acting as a second token budget.
  const MAX_RENDERED_TEXT = 256_000;
  /** Aggregate authored text/HTML copied through MAIN -> isolated world in one scan. */
  const MAX_RESPONSE_TEXT = MAX_TURNS * 512 * 1024;
  const MAX_TURN_TEXT = 512 * 1024;

  function budgetedText(value, budget, perValueLimit) {
    if (typeof value !== 'string' || !value || !budget || budget.remaining <= 0) return '';
    const limit = Math.max(0, Math.min(perValueLimit, budget.remaining));
    if (limit === 0) return '';
    const taken = value.slice(0, limit);
    budget.remaining -= taken.length;
    return taken;
  }
  /**
   * The connectors this app is reached through. Nothing else is ours to vouch for.
   *
   * There is more than one now: 1.7.1 split the model-facing surface into a Core and a
   * Desktop connector, so a single hardcoded name stopped matching *anything* the page
   * held — every call in every chat lost its page evidence at once and was filed outside
   * the conversation that made it. The name is not user input: ChatGPT takes `app_name`
   * from the `resource_name` this app serves in its own protected-resource metadata
   * (`server.ts`), so these are this app naming itself rather than labels somebody typed.
   * The pre-1.7.1 name stays so an older chat's evidence still reads.
   *
   * Exact names, never a prefix: `Chat On Steroids Backup` would be somebody else's
   * connector, and a prefix test would have this app vouch for its traffic.
   */
  const OUR_APPS = ['Chat On Steroids Core', 'Chat On Steroids Desktop', 'Chat On Steroids Plugins', 'TobisComputer'];

  /** Whether an `invoked_resource.app_name` names one of this app's own connectors. */
  function ourApp(name) {
    if (typeof name !== 'string') return false;
    for (let at = 0; at < OUR_APPS.length; at++) if (OUR_APPS[at] === name) return true;
    return false;
  }

  /** Whether a request path — `/<connector>/link_…/<tool>` — is one of ours. */
  function ourPath(path) {
    if (typeof path !
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #825** (2026-09-30): **Auto-Compaction never happens**
  *Symptoms*: ### App version  2.1.21  ### Operating system and version  Windows 11 Home 26H2  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Plus  ### ChatGPT surface and workspace type  Chat / Personal  ### What happened  Auto-Compaction never happens. The chat itself keeps on working on new tasks, the auto-compaction was triggered at 77% context usage and eventually chat reached 99% context usage.... It shows "Waiting for the handoff response" but it stays in Preparing stage, I guess the agent is never free to do the handoff and keeps on working.  To compact, I have to manually Click x on "ChatGPT has not confirmed receving..." in browser and then click "Settings" icon in browser next to the text I just clicked x of. And click "Compact & resume now", then it automatically does it and handsoff stuff to new task.  Basically the chat stays stuck on Preparing for handoff. And when I manually do it, it successfully sends the [[CLF-HANDOFF: message and does the hand-off.  This issue does not happen everytime but still a thing, maybe it has to do with tasks where long running "unit tests" are running and there is a lot of "Waited on Session".   <img width="1625" height="986" alt="Image" src="https://github.com/user-attachments/assets/83287bc2-b552-4bf0-949d-a03c41cbebac" /> <img width="1633" height="983" alt="Image" src="https://github.com/user-attachments/assets/a940f5ed-729a-46b3-8fa2-7d2ba0d19292" />  ### S
  **Post-Mortem & Fix Analysis**:
  > Thanks, the first screenshot shows the cause: the CoS pill "ChatGPT has not confirmed receiving…" is open on the page while auto-compaction waits in "Preparing".  That pill means a message CoS sent (in Loop mode, often Loop's own next message) was not recognized in ChatGPT's readback, so the page keeps waiting for its confirmation. While it waits, the page refuses to start anything else: auto-compaction cannot send its handoff request, and a recovery reload is refused too. That is why closing the pill with × and starting Compact & resume by hand works. #821 found why the readback is not recognized and how the wait can last forever. #820 (the stop after "stream recovery polling timed out") very likely has the same cause.  The fix is planned in #821: recognize ChatGPT's changed readback, and never let an unconfirmed send block the chat forever. It never sends a message twice. It will ship in the next update, 2.1.22.  Until then, the workaround you found is the right one: close "ChatGPT h
  > Correction to my earlier comment: I read the pill too quickly. Its full text is "ChatGPT has not confirmed receiving the latest tool results. Nothing was compacted." That is the compaction's own safety check, not the unconfirmed send from #821.  Before an automatic compaction stops the turn, it waits for a moment when no local command is running and ChatGPT has received every result, so the handoff never misses one. That wait gave up after 30 seconds. With your long unit tests, ChatGPT keeps polling them ("Waited on session …"), and one poll can take up to five minutes, so there was almost never a 30-second gap. The compaction gave up, retried, and gave up again until the chat reached 99%.  #828 fixes this: the automatic compaction now waits up to six minutes, longer than one whole poll, and stops the turn in the gap between two calls. It is still bounded and never cuts off a running command. It will be in 2.1.22. Until then, closing the pill and pressing Compact & resume by hand remai

- **Issue #821** (2026-09-30): **COS_CONTEXT readback as &#x20; leaves Send receipt pending and blocks follow-up messages until reload**
  *Symptoms*: ### App version  2.1.21  ### Operating system and version  Windows (exact release/build not captured)  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Plus  ### ChatGPT surface and workspace type  Chat  ### What happened  An app-sent opening prompt was successfully submitted to ChatGPT, but the native user bubble exposed the full internal `[[COS_CONTEXT:<length>]] ... [[/COS_CONTEXT]]` frame instead of showing only the authored user text.  After that first turn completed, the next normal message submitted from CoS remained queued and was never claimed by the browser. Reloading the ChatGPT page caused the pending workflow to become active again, after which a retry of the same follow-up was claimed and delivered normally.  These two symptoms have the same measured cause.  The frozen opening `deliveryText` was exactly 96,000 characters and declared a `COS_CONTEXT` body length of 95,774 characters. On readback, ChatGPT had serialized some indentation spaces inside that text as the literal string `&#x20;`.  After applying CoS's existing Markdown/backslash readback normalization:  - the returned text was 235 characters longer than the original; - there were exactly 47 occurrences of `&#x20;`; - each occurrence replaces one space with six characters, adding five characters; - `47 × 5 = 235`, exactly matching the full length delta.  Replacing only those observed `&#x20;` sequences with a single space
  **Post-Mortem & Fix Analysis**:
  > I checked this against the incident's recorded data and the 2.1.21 code. The readback cause holds, with one more detail. The account of what freed the next message was incomplete, and that changes the second fix.  ### Readback  Comparing the frozen 96,000-character `deliveryText` with the stored readback of that opening message:  - the exact comparison fails, and so does the existing Markdown unescape (+235 characters); - there are exactly 47 `&#x20;` and no other HTML entity; - replacing them with a space gives the original text byte for byte; - **all 47 open a line.** On an indented line, only the first space of the indent is written as `&#x20;`; the spaces after it stay spaces. Shapes seen: `&#x20;` alone (7 lines), then one, two, 31 or 39 plain spaces after it.  So the fallback can be narrower than "`&#x20;` anywhere": only a `&#x20;` at the start of a line, tried after the exact read and after the existing unescape. An `&#x20;` a person typed mid-line stays as typed.  ### What fre
  > Excellent analysis, thank you. The plan is right on both points:  1. **Readback:** yes to the narrow fallback. Accept only a line-start `&#x20;`, after the exact read and the existing unescape, in all four readers, with the regression tests. Please send this as its own PR first. It alone would have prevented this incident, and it can go into 2.1.22 quickly. 2. **Unconfirmed receipt:** yes as well, as a separate PR. Bound the wait without a second Send, retire the row with the existing "may already have been sent; it will not be resent" outcome, and release both holds (the page's `desktopInputBusy` and the app's `browser` row for openings). Please include a test where the receipt never matches and a later queued message is still claimed without a reload.  #820 may be the same second hold showing up in Loop mode (the recovery reload is refused while the page stays "busy"), so part 2 may fix it too; we asked that reporter for log lines to confirm. If you would rather we take either part, 
  > #825 (auto-compaction stuck in Preparing) shows the same hold: the page had the "ChatGPT has not confirmed receiving" pill open while the compaction waited, and closing it released everything. So part 2 is the more urgent half: it fixes #820, #821 and #825 together. We would like to ship both parts as 2.1.22 soon; if you can open the PRs today or tomorrow, great, otherwise tell us and we take part 2. 

- **Issue #577** (2026-09-28): **OpenRouter Goal/Loop API backend omits Authorization header; same key works via Custom endpoint**
  *Symptoms*: ### App version  2.1.17  ### Operating system and version  Windows 11 Home, build 26200  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, but I am not sure the versions match  ### ChatGPT plan  Business  ### ChatGPT surface and workspace type  _No response_  ### What happened  With Goal response source set to API, Provider = OpenRouter, Model = `openrouter/free`, and an OpenRouter API key shown as stored in secure OS credential storage, Goal cannot call OpenRouter.  The app log reports:  ``` goal: draft ... failed auth_rejected: Missing Authentication header ```  No authenticated generation appears in the OpenRouter account logs for the failed attempt.  Using the same OpenRouter key through Provider = Custom endpoint with Base URL `https://openrouter.ai/api/v1` and Model = `openrouter/free` works immediately. Goal completes and OpenRouter logs show routed-via-free generations at $0.00.  Expected: the built-in OpenRouter provider should send `Authorization: Bearer <stored key>` and behave the same as the custom endpoint path.  ### Steps to reproduce  1. Open Settings -> Agents & automation. 2. Set Goal response source to API. 3. Under API provider, choose OpenRouter. 4. Enter an OpenRouter API key, leave the field so it is saved, and verify the UI says a key is stored. 5. Set Model to `openrouter/free`. 6. Enable Goal on a simple chat whose task can finish immediately. 7. Observe Goal failure and `auth_rejected: Missing Authentication header` in
  **Post-Mortem & Fix Analysis**:
  > Thanks for the precise comparison with the custom endpoint. That made it quick to pin down.  I reproduced your exact error against OpenRouter. It answers **"Missing Authentication header"** when the key after `Bearer ` starts with an invisible character such as a soft hyphen (U+00AD) or NEL (U+0085). A missing header gives a different message ("No cookie auth credentials found"), and a wrong key gives "User not found.". The key field trims spaces, but `trim()` keeps those two characters, so a key pasted together with one (from a web page or a password manager) was stored and sent as is. Your custom-endpoint paste was most likely clean.  The fix (#578) removes whitespace and invisible characters from API keys when they're stored and when they're read, so an already stored key heals without re-entering it. It ships in the next release. Until then, deleting the OpenRouter key and typing or pasting it again cleanly should work too. 
  > Thanks — that makes perfect sense now. Great catch on the invisible-character case, and thanks for reproducing it and fixing it so quickly. The custom-endpoint paste being clean explains the behavior perfectly. I’ll switch back to the built-in OpenRouter provider and verify it once the next release is available. Really appreciate the fast turnaround!
  > **2.1.20 is out** with this fix: https://github.com/totec448-spec/chat-on-steroids/releases/tag/v2.1.20  The built-in OpenRouter provider now strips invisible characters from pasted keys, both for new keys and for the one you already saved. No need to paste it again. If it still fails, reopen this and I'll take another look. 

- **Issue #574** (2026-09-28): **Reply not visible**
  *Symptoms*: ### App version  2.1.18  ### Operating system and version  MacOS 27  ### Architecture  Not sure  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Plus  ### ChatGPT surface and workspace type  _No response_  ### What happened  <img width="1470" height="956" alt="Image" src="https://github.com/user-attachments/assets/f5bf5294-9390-4fd9-9b04-08ab9ce0d1dc" />  Using 2.1.18 CoS & Extension- browser connected too.  Upon sending a message in CoS, reply is visible like this.  ### Steps to reproduce  1. Open CoS- ChatGPT & Browser companion- both connected. 2. Send a message. 3. Reply is not received, instead a json message is received as shown in the screenshot.  ### Anything else  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > [   {     "time": "2026-09-28T14:05:55.756Z",     "level": "info",     "message": "session catalog ready: 35 sessions in 3 ms"   },   {     "time": "2026-09-28T14:05:55.914Z",     "level": "info",     "message": "multi-agent: restored no active run with 2 dormant owner histories and 0 active undelivered message(s)"   },   {     "time": "2026-09-28T14:05:55.985Z",     "level": "info",     "message": "app started"   },   {     "time": "2026-09-28T14:05:55.992Z",     "level": "info",     "message": "server started on 127.0.0.1:62422"   },   {     "time": "2026-09-28T14:05:56.008Z",     "level": "info",     "message": "usage overview sessions=35 reused=35 rebuilt=0 elapsed_ms=18"   },   {     "time": "2026-09-28T14:05:56.012Z",     "level": "info",     "message": "bridge listening on 127.0.0.1:8765"   },   {     "time": "2026-09-28T14:05:56.202Z",     "level": "info",     "message": "window loaded"   },   {     "time": "2026-09-28T14:05:59.270Z",     "level": "info",     "message": "render
  > Thanks for the report and the screenshot, and for testing 2.1.19's predecessor so quickly.  The reply consists of a ChatGPT directive, `::chatgpt-content-reference{index="0" source_message_id="…"}`. ChatGPT uses it to point at content from another message, and its own page shows that content in place. CoS shows the raw directive instead. I'm working on a fix. It doesn't reproduce on my account ("Hi" gets a normal reply), so two quick questions:  1. In the **ChatGPT browser tab** of that same chat, what does the reply show, a normal answer like "Hi! How can I help?"? 2. Does it happen for any message, or mostly when you send the same short text again (your chat list shows several "Hi" chats)? 
  > 1. ChatGPT reply is fine.  <img width="1470" height="956" alt="Image" src="https://github.com/user-attachments/assets/d189afa6-67a2-420c-9afe-4a5a9341df51" />  2. Same response for any message.

- **Issue #568** (2026-09-28): **Browser not connecting**
  *Symptoms*: ### App version  2.1.18  ### Operating system and version  Mac OS 27  ### Architecture  Not sure  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Plus  ### ChatGPT surface and workspace type  _No response_  ### What happened  <img width="1470" height="956" alt="Image" src="https://github.com/user-attachments/assets/cb08c6fa-943e-4fa8-b4d4-6448336cd668" />  Browserr not getting connected  ### Steps to reproduce  1. Updated CoS to latest version 2. Updated browser extension to latest version 3. Opened CoS 4. Browser is not connected, confirm that ChatGPT Plugin has all permissions required  ### Anything else  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > [   {     "time": "2026-09-28T14:05:55.756Z",     "level": "info",     "message": "session catalog ready: 35 sessions in 3 ms"   },   {     "time": "2026-09-28T14:05:55.914Z",     "level": "info",     "message": "multi-agent: restored no active run with 2 dormant owner histories and 0 active undelivered message(s)"   },   {     "time": "2026-09-28T14:05:55.985Z",     "level": "info",     "message": "app started"   },   {     "time": "2026-09-28T14:05:55.992Z",     "level": "info",     "message": "server started on 127.0.0.1:62422"   },   {     "time": "2026-09-28T14:05:56.008Z",     "level": "info",     "message": "usage overview sessions=35 reused=35 rebuilt=0 elapsed_ms=18"   },   {     "time": "2026-09-28T14:05:56.012Z",     "level": "info",     "message": "bridge listening on 127.0.0.1:8765"   },   {     "time": "2026-09-28T14:05:56.202Z",     "level": "info",     "message": "window loaded"   },   {     "time": "2026-09-28T14:05:59.270Z",     "level": "info",     "message": "render
  > Reproduced. @Maximapple, P0 here.
  > Thanks for the screenshot. It shows the app listening on `127.0.0.1:8765`, but no browser has ever paired with it. ChatGPT itself is connected. Nothing in the bridge or the extension changed between 2.1.17 and 2.1.18 except the version number. So let's find out what stops this Chrome from pairing:  1. **Reload the extension once.** Open `chrome://extensions`, find Chat On Steroids and click its reload arrow, then refresh your ChatGPT tab. After updating from 2.1.16 or older this manual reload is needed one last time. From 2.1.17 on, the extension updates itself. 2. **Check that it's the right folder.** The extension card in `chrome://extensions` should say it was loaded from `/Users/avndp/Library/Application Support/chat-on-steroids/extension`, the folder shown in Setup. An older copy loaded from somewhere else doesn't update. 3. **Click the extension's toolbar icon** and tell us what its popup says. It shows the port it found and the last pairing error, if any. 4. **Ask the app what i

- **Issue #561** (2026-09-28): **Recommended skills problem**
  *Symptoms*: ### App version  2.1.17  ### Operating system and version  Windows 11 Home  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Pro  ### ChatGPT surface and workspace type  _No response_  ### What happened  <img width="1222" height="558" alt="Image" src="https://github.com/user-attachments/assets/234b9431-4a8b-4a23-8212-83c1960a276f" />  Just wanted to point out that these 6 skills have some sort of bad indentation and cannot be installed  ### Steps to reproduce  _No response_  ### Anything else  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in **2.1.18**: https://github.com/totec448-spec/chat-on-steroids/releases/tag/v2.1.18. All six recommended skills install again. Their descriptions contain ": ", which the generated SKILL.md wrote without quotes, so YAML read them as a nested mapping. While fixing that, a second bug turned up: skills with a quoted description containing a colon showed the first paragraph instead of their description. That is fixed too. A new test now installs every recommended skill. Thanks for the report and the screenshot!

- **Issue #499** (2026-09-27): **Workers not working**
  *Symptoms*: ### App version  2.1.16  ### Operating system and version  Windows 10  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Plus  ### ChatGPT surface and workspace type  _No response_  ### What happened  When performing a specific task where the CoS needs to carry out an operation requiring workers, this response always appears: The optional worker fan-out could not start because the saved worker model identifier is invalid in this account; no code or state was changed by that attempt. I’m continuing the investigation directly so this doesn’t  So the workers not working now from v2.1.15  ### Steps to reproduce  _No response_  ### Anything else  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. I found the cause.  A **default worker model** is saved in Settings → Agents & automation. Since 2.1.15, CoS reads the available models differently, so a default saved earlier can stop matching what your account offers. That made every worker spawn fail with exactly the message you saw.  **Workaround right now:** open Settings → Agents & automation. Under **Default sub-agent model**, press reload and pick one of the listed models; do the same for the reasoning.  **The fix is in #501:** a saved default that your account doesn't offer no longer blocks workers. They start with ChatGPT's current model, and the reply says which default was unavailable. It ships in the next release.  Could you check whether the workaround gets your workers running? 

- **Issue #454** (2026-09-26): **The user interface of ChatGPT has been updated and this has created a problem**
  *Symptoms*: ### App version  2.1.14  ### Operating system and version  Windows 10  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Plus  ### ChatGPT surface and workspace type  _No response_  ### What happened  I start a new conversation on COS, the ChatGPT page opens and the tool chooses the chosen level of thinking and then it stops and the conversation doesn't start. This happened when ChatGPT's UI was updated  ### Steps to reproduce  _No response_  ### Anything else  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in **2.1.15** (https://github.com/totec448-spec/chat-on-steroids/releases/tag/v2.1.15). The new ChatGPT layout moved and relabelled the Send control, so CoS selected the model and then never pressed Send (#418). A second break hit the first message of every chat started from the app: the new layout stores inserted text Markdown-escaped, so the sent message was never recognised. Its delivery wasn't confirmed and the turn wasn't recorded. Both are fixed and were checked live on the new layout: a new chat started from the app is sent, confirmed in about 5 seconds, and recorded.  Please update the app and reload the companion extension in `chrome://extensions`. If it still happens on 2.1.15, reopen this with the app log from the moment you start the chat.

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

### Incident Patch 1: `7c90010a` (2026-09-30)
**Commit Message**: Merge pull request #829 from Haz4rdovisk/fix/unconfirmed-send-release

Bound the wait for a Send receipt and retire an unconfirmed send

**File**: `AGENTS.md` (modified, +6/-1)
```diff
@@ -1044,7 +1044,12 @@ time alone cannot take this path. The same outbox expiry rule applies during nor
 Desktop delivery captures the native user-message identity inside the same Send acceptance
 operation that proves its text and route. It must not discard that receipt and rediscover the
 row after an await: React may already have replaced it. Navigation still revokes the operation;
-composer clear or a Stop button alone cannot supply a desktop delivery receipt.
+composer clear or a Stop button alone cannot supply a desktop delivery receipt. After the click,
+the wait for that receipt is bounded (`DESKTOP_RECEIPT_MS`) and never clicks again. When it ends
+unproven, the page reports the fixed reason `Native Send receipt was not confirmed.` and frees its
+input slot. `failBrowserInput` then retires the authorized row as the same uncertain send the
+outbox expiry produces (cancelled, never resent, a late exact receipt still confirms it), openings
+and Continue included, so later messages in that chat are claimable without a reload (#821).
 
 Confirmed terminal input receipts stop owning history retries after their exact local session
 directory is positively absent under an available history root. The outbox durably retires them
```

**File**: `extension/chatgpt-dom.js` (modified, +9/-2)
```diff
@@ -2187,7 +2187,7 @@ var CLF_DOM = (() => {
     }, false);
   }
 
-  async function send({ acceptanceTimeoutMs = 30000, stillCurrent = () => true, matchesUser = null, observeEvidence = null, clearAcceptedDraft = true, beforeSend = null, acceptUserReceipt = null } = {}) {
+  async function send({ acceptanceTimeoutMs = 30000, stillCurrent = () => true, matchesUser = null, observeEvidence = null, clearAcceptedDraft = true, beforeSend = null, acceptUserReceipt = null, receiptTimeoutMs = null } = {}) {
     try {
       const box = composer();
       if (!box || !box.isConnected || !stillCurrent() || generating() || stopButton()) return false;
@@ -2285,7 +2285,14 @@ var CLF_DOM = (() => {
             // The deadline bounds readiness, not an already-dispatched receipt.
             // Keep this same observer and exact send lifetime until the provider
             // publishes its identity; never click again because that is delayed.
-            if (acceptUserReceipt && timer !== null) { clearTimeout(timer); timer = null; }
+            if (acceptUserReceipt && timer !== null) {
+              clearTimeout(timer); timer = null;
+              // A caller may still bound the wait itself. Expiry never clicks again: it only
+              // ends this wait, so a row the page cannot recognise cannot hold its caller for
+              // the life of the document (#821). One last check keeps a receipt that is there.
+              if (Number.isFinite(receiptTimeoutMs) && receiptTimeoutMs > 0)
+                timer = setTimeout(() => { check(); finish(false); }, receiptTimeoutMs);
+            }
             try { button.click(); } catch { return finish(false); }
             check(); // Synchronous navigation/cancellation during click also re-proves ownership.
           };
```

**File**: `extension/content.js` (modified, +18/-4)
```diff
@@ -866,8 +866,8 @@
     };
   }
   function sendSubmittedText(stillCurrent, clearAcceptedDraft = true, beforeSend = null, acceptUserReceipt = null,
-                             matchesUser = matchesSubmittedUser) {
-    return CLF_DOM.send({ stillCurrent, clearAcceptedDraft, beforeSend, acceptUserReceipt, matchesUser,
+                             matchesUser = matchesSubmittedUser, receiptTimeoutMs = null) {
+    return CLF_DOM.send({ stillCurrent, clearAcceptedDraft, beforeSend, acceptUserReceipt, matchesUser, receiptTimeoutMs,
       observeEvidence: check => { pageViewChecks.add(check); return () => pageViewChecks.delete(check); } });
   }
   const GOAL_MARKER_INSTRUCTION = '\n\nFor this Goal session only: at the end of each final reply, write exactly one separate last line: [[COS_GOAL:COMPLETE]] if the entire requested task is finished, or [[COS_GOAL:CONTINUE]] if requested work remains. Do not claim completion for partial work. If user input is required, explain it and omit both markers.';
@@ -11614,6 +11614,12 @@
   let desktopDecision = null;
   let desktopDecisionSession = null;
   let desktopInputBusy = false;
+  /**
+   * How long an app-owned Send waits for its exact user row after the click. Without a bound,
+   * a row the page reads back differently (#821: `&#x20;` for a space) kept this document's
+   * input slot for good, and every later message waited for a reload.
+   */
+  const DESKTOP_RECEIPT_MS = 120_000;
   // The durable claim, never a project path/title guess, fences first tool evidence.
   let desktopProjectInput = null;
   function retireBoundProjectInput(claim, projectBound) {
@@ -12041,10 +12047,16 @@
         // may replace it before this async operation resumes; do not rediscover it.
         receipt = { conversation, user: { id: user.id } };
         return true;
-      }, matchesSubmittedBootstrap);
+      }, matchesSubmittedBootstrap, DESKTOP_RECEIPT_MS);
       // #744: one retry when the editor was replaced before anything asked to send it.
       if (!(await nativeSend()) &&
-          !(!authorizing && !sendAttempted && !receipt && !draft.current() && draftCurrent() && await nativeSend())) return false;
+          !(!authorizing && !sendAttempted && !receipt && !draft.current() && draftCurrent() && await nativeSend())) {
+        // Send was clicked, but no row proved it. Say so instead of keeping the claim open: the
+        // app retires it as an uncertain send, never a replay, and this document takes the next
+        // input. The reason is a fixed code the app recognises (see failBrowserInput).
+        if (sendAttempted && !receipt) return fail('Native Send receipt was not confirmed.');
+        return false;
+      }
       if (!receipt || !sendingTarget()) return false;
       // Native Send listeners refresh the receipt; pin only that witnessed object.
       const witnessedSendReceipt = userSendReceipt;
@@ -12738,6 +12750,7 @@
       streamRootKeys: () => [...streamRootsByKey.keys()],
       /** So a test settles a turn by the real window rather than a copy of the number. */
       TURN_SETTLE_MS,
+      DESKTOP_RECEIPT_MS,
       STALL_MS,
       GOAL_RETRY_MS,
       PRESENTATION_SCROLL_IDLE_MS,
@@ -12749,6 +12762,7 @@
       renderStreamEnabled: () => RENDER_STREAM,
       setDesktopProjectInputForTest: (claim) => { desktopProjectInput = claim; },
       desktopProjectInputForTest: () => desktopProjectInput,
+      desktopInputBusyForTest: () => desktopInputBusy,
       setShowTimes: (on) => {
         SHOW_TIMES = on === true;
       }
```

**File**: `src/main/session/input.ts` (modified, +24/-4)
```diff
@@ -109,6 +109,12 @@ const UNCERTAIN_SEND_MS = 15 * 60_000;
  * each kept its chat protected and told the extension an input was still in flight.
  */
 const ABANDONED_SEND_MS = 6 * 60 * 60_000;
+const UNCONFIRMED_SEND = 'Stopped waiting for delivery confirmation. The message may already have been sent; it will not be resent.';
+/**
+ * The page clicked native Send, but no row it could read proved the message arrived (#821: an
+ * opening read back with `&#x20;` for spaces). The same code in extension/content.js.
+ */
+const RECEIPT_UNCONFIRMED = 'Native Send receipt was not confirmed.';
 export const TOOL_INPUT_HEADER = '\n--- New instructions from the user ---\n';
 export interface ToolInputBatch {
   messages: Array<{ text: string; images: InputImage[] }>;
@@ -474,7 +480,7 @@ async function expireQueued(current: InputEntry[]): Promise<InputEntry[]> {
       if (row.recovery) return releaseRecoveryClaim(row);
       return { ...row, state: 'cancelled', error: row.requiresAuthorization && row.sendAuthorizedAt === undefined
         ? 'Not sent: browser preparation timed out. This attempt was cancelled.'
-        : 'Stopped waiting for delivery confirmation. The message may already have been sent; it will not be resent.' };
+        : UNCONFIRMED_SEND };
     }
     // An authorized claim that never reports its outcome is already unsendable: a
     // browser row past authorization is not preparable, so no path re-offers or
@@ -484,9 +490,9 @@ async function expireQueued(current: InputEntry[]): Promise<InputEntry[]> {
     // combined delivery keep their existing custody.
     if (row.state === 'browser' && row.sendAuthorizedAt !== undefined && !row.recovery && !row.opening &&
         !row.companionInputId && manualInput(row) && Date.now() - row.sendAuthorizedAt >= UNCERTAIN_SEND_MS)
-      return { ...row, state: 'cancelled', error: 'Stopped waiting for delivery confirmation. The message may already have been sent; it will not be resent.' };
+      return { ...row, state: 'cancelled', error: UNCONFIRMED_SEND };
     if (row.state === 'browser' && row.sendAuthorizedAt !== undefined && Date.now() - row.sendAuthorizedAt >= ABANDONED_SEND_MS)
-      return { ...row, state: 'cancelled', error: 'Stopped waiting for delivery confirmation. The message may already have been sent; it will not be resent.' };
+      return { ...row, state: 'cancelled', error: UNCONFIRMED_SEND };
     return row;
   }));
   for (let i = 0; i < next.length; i++) {
@@ -1573,12 +1579,26 @@ export function authorizeBrowserHelperRetry(id: string, sourceSessionId: string)
   });
 }
 
-/** Only a pre-send failure can be declared failed. An ambiguous click stays claimed. */
+/**
+ * Only a pre-send failure can be declared failed. An ambiguous click stays claimed, unless the
+ * page reports that its receipt was never confirmed: that retires it as an uncertain send.
+ */
 export function failBrowserInput(id: string, owner: string, error: string): Promise<boolean> {
   return serial(async () => {
     const current = await load();
     const entry = current.find((row) => row.id === id && row.owner === owner && row.state === 'browser');
     if (!entry || companionOf(current, entry)) return false;
+    // The page clicked Send and could not prove the result (#821). This is the outcome an
+    // unreported send reaches in expireQueued, without the wait: the session is free again,
+    // nothing is replayed, and a late exact receipt still confirms it (acknowledgeBrowserInput
+    // accepts a cancelled row). Openings and Continue included: they held their chat until then.
+    if (entry.sendAuthorizedAt !== undefined && error === RECEIPT_UNCONFIRMED) {
+      logWarn(`input ${entry.id}: native Send was clicked, but its receipt was not confirmed`);
+      await commit(current.map(row => sameDelivery(entry, row) ? { ...row, state: 'cancelled', error: UNCONFIRMED_SEND } : row));
+      decisionWaiters.get(id)?.reject(new Error('goal_browser_send_failed: ' + UNCONFIRME
```

**File**: `test/content-script.test.ts` (modified, +39/-0)
```diff
@@ -150,6 +150,8 @@ interface Hook {
   streamRootKeys(): string[];
   /** How long the stop button must stay gone before content.js calls a turn finished. */
   TURN_SETTLE_MS: number;
+  /** How long an app-owned Send waits for its exact user row after the click. */
+  DESKTOP_RECEIPT_MS: number;
   /** Test seam for the no-visible-progress fallback. */
   STALL_MS: number;
   /** How long a failed Goal draft waits before it asks again. */
@@ -159,6 +161,7 @@ interface Hook {
   renderStreamEnabled(): boolean;
   setDesktopProjectInputForTest(claim: { id: string; owner: string } | null): void;
   desktopProjectInputForTest(): { id: string; owner: string } | null;
+  desktopInputBusyForTest(): boolean;
   setShowTimes(on: boolean): void;
   /** How long Overwrite leaves a user-driven scroll completely presentation-stable. */
   PRESENTATION_SCROLL_IDLE_MS: number;
@@ -323,6 +326,9 @@ async function harness(
   const nativeTimeout = window.setTimeout.bind(window);
   window.setTimeout = ((fn: () => void, ms?: number) => {
     if (holdSendDeadline && ms === 30000) return 0;
+    // An app-owned Send's receipt deadline (DESKTOP_RECEIPT_MS). Tests settle a receipt
+    // after the click on their own schedule; one that is about the deadline fires it.
+    if (ms === 120_000) return 0;
     // Native readiness now authorizes through an async app reply. A deadline must
     // expire after those microtasks, just as a real browser timer does.
     if (ms === 30000) return nativeTimeout(fn, 0);
@@ -1194,6 +1200,39 @@ describe('desktop input delivery and helper ownership', () => {
    * from the app: its first user row read back `[[COS_CONTEXT:19956]]\\ You are…`, so the send
    * was never recognised — no ACK, and no turn start or end for Goal or Loop to act on.
    */
+  /**
+   * #821: an app-owned Send whose row the page reads back differently never got a receipt, and
+   * native Send dropped its deadline after the click. The page held its input slot until reload,
+   * and the claim stayed open in the app, so the next message could not be delivered.
+   */
+  it('ends a receipt wait the page cannot recognise without a second Send, and frees the input slot', async () => {
+    const typed = 'Inspect the exact requested task';
+    let claims = 0;
+    live = await harness(`https://chatgpt.com/?cos-input=${inputId}`, {
+      desktop_input: message => ({ ok: true, data: message.authorize || message.fail || message.ack ? { ok: true }
+        : ++claims === 1 ? { input: claimed({ text: typed }) } : {} })
+    });
+    const sends = vi.fn(() => {
+      live!.dom.reconfigure({ url: `https://chatgpt.com/c/${chatA}` });
+      userTurn(live!.document, 'unrecognised-user', `${typed}, as the page wrote it back`);
+      live!.document.querySelector('#prompt-textarea')!.textContent = '';
+      live!.hook.observe();
+    });
+    live.document.querySelector('[data-testid="send-button"]')!.addEventListener('click', sends);
+    const held = live.window.setTimeout;
+    live.window.setTimeout = ((fn: () => void, ms?: number) =>
+      held(fn, ms === live!.hook.DESKTOP_RECEIPT_MS ? 0 : ms)) as typeof live.window.setTimeout;
+    expect(await live.runtimeMessage({ type: 'clf-desktop-input', id: inputId, conversationId: null })).toEqual({ ok: false });
+    expect(sends).toHaveBeenCalledTimes(1);
+    expect(live.sent.filter(message => message.type === 'desktop_input' && message.ack)).toEqual([]);
+    expect(live.sent.filter(message => message.type === 'desktop_input' && message.fail)).toEqual([
+      expect.objectContaining({ id: inputId, owner: 'input-owner', error: 'Native Send receipt was not confirmed.' })
+    ]);
+    // The page's input slot is free again: the next message waits only for this turn to end.
+    expect(live.hook.desktopInputBusyForTest()).toBe(false);
+    expect(claims).toBe(1);
+  });
+
   it('ACKs a fresh input whose user row the page stores Markdown-escaped', async () => {
     const typed = '[[COS_CONTEXT:1]]\
```

---

### Incident Patch 2: `b7e06873` (2026-09-30)
**Commit Message**: Merge pull request #828 from Maximapple/fix/auto-compaction-waits-for-poll-gap

Let automatic compaction wait out one long poll before it gives up

**File**: `AGENTS.md` (modified, +2/-0)
```diff
@@ -2291,6 +2291,8 @@ awaiting-summary -> awaiting-chat -> claimed -> committing -> committed
    tail. Before automatic Stop, require a fresh native source-turn scan and receipt of its
    issued connector calls; local completion alone can precede delivery to ChatGPT. Missing
    scans or vanished calls cannot acknowledge an observed pending result. The bounded wait
+   (six minutes, longer than one five-minute empty `write_stdin` poll plus the model's pause, so
+   a turn that keeps polling long commands is stopped in the gap between two calls; #825)
    leaves an unsent automatic ticket durable when receipt remains unknown. Recheck the exact
    source question, route and document across every await, then retain the local-tool drain.
    Mixed visible/pre-row calls retain their outstanding request evidence, and automatic Stop
```

**File**: `extension/content.js` (modified, +12/-1)
```diff
@@ -9246,7 +9246,7 @@
         const fresh = await refreshFiber(null, true);
         if (!current()) return true;
         return fresh && received();
-      }, TOOL_SETTLE_MS);
+      }, AUTO_RECEIPT_SETTLE_MS);
       if (!current()) return t(
         'content_compact_chat_changed_waiting_results',
         'This chat changed while compaction was waiting for tool results.'
@@ -10401,6 +10401,17 @@
    * headroom without making a genuinely stuck local call wait indefinitely.
    */
   const TOOL_SETTLE_MS = 30_000;
+  /**
+   * How long an automatic compaction waits for a moment with no local call running and every
+   * result received, before it stops the turn.
+   *
+   * A busy turn is rarely idle: ChatGPT polls long commands with write_stdin, and one empty poll
+   * may run up to the app's five-minute background terminal timeout. Thirty seconds almost never
+   * found the gap between two polls, so a turn running long unit tests never compacted (#825).
+   * Six minutes always spans one whole poll plus the model's pause before the next call, and the
+   * turn is stopped inside that gap. Still bounded: a call that runs longer is refused as before.
+   */
+  const AUTO_RECEIPT_SETTLE_MS = 6 * 60_000;
   /** How many silent answers about pending calls to sit through before refusing. */
   const SETTLE_UNKNOWN_TRIES = 3;
 
```

**File**: `test/content-script.test.ts` (modified, +22/-0)
```diff
@@ -15726,6 +15726,28 @@ describe('the context meter and automatic compaction', () => {
     expect(sends()).toBe(1);
   });
 
+  it.each([[120_000, true], [8 * 60_000, false]])('lets a local poll of %i ms finish before stopping an automatic source (compacts: %s)', async (pollMs, compacts) => {
+    // #825: long unit tests are polled with write_stdin, and one poll can run for five minutes.
+    // The automatic barrier gave up after 30 seconds, so a busy turn never compacted.
+    let pollEndsAt = 0;
+    live = await harness(undefined, {
+      activity: () => withContext(205_000, settings({ auto: true }), { pendingTools: live!.window.Date.now() < pollEndsAt ? 1 : 0 }),
+      compact: () => ({ ok: true, data: { token: 'receipt-token', prompt: 'Write the brief.',
+        ...automaticTicket('not-attempted') } })
+    });
+    startGenerating(live.document);
+    const section = assistantTurn(live.document, 'polling-source', []);
+    compactionFiber(section, () => [compactionCall(true)], () => []);
+    const stopped = vi.fn(() => stopGenerating(live!.document));
+    live.document.querySelector('[data-testid="stop-button"]')!.addEventListener('click', stopped);
+    const sends = watchSend(live.document);
+    pollEndsAt = live.window.Date.now() + pollMs;
+    await live.hook.startCompact(true);
+    expect(stopped).toHaveBeenCalledTimes(compacts ? 1 : 0);
+    expect(sends()).toBe(compacts ? 1 : 0);
+    if (!compacts) expect(live.document.querySelector('.clf-pill-text')?.textContent ?? '').toContain('has not confirmed receiving');
+  });
+
   it.each(['distinct-pre-row', 'same-request-running', 'same-request-code-pending'])('waits for another outstanding call beside an answered native call (%s)', async mode => {
     let received = false;
     live = await harness(undefined, {
```

---

### Incident Patch 3: `8b622e90` (2026-09-30)
**Commit Message**: Merge pull request #827 from Maximapple/fix/log-why-repair-held

Log why the page held a recovery reload

**File**: `AGENTS.md` (modified, +3/-0)
```diff
@@ -2170,6 +2170,9 @@ A responsive page flushes native progress and Stop before the main claim, then r
 captured work/question/document after the claim. An explicit veto or navigation prevents the
 browser action. An unresponsive page supplies no new proof; the original main-process grant
 still requires independent validation. These checks use existing RPC and repair owners.
+A veto names its reason (`why`: page-changed, stop-requested, tool-running, sending, page-busy,
+compaction, draft, changed). The extension reports it with `/status?repairHeld=<token>&why=`, which
+hands nothing out and changes no repair; the app logs each token and reason once (#820).
 The maintenance projection must retain each repair's reason. Compaction uses the same two
 document checks in draft-only mode: its exact ticket can recover its busy source, but an unsent
 text/attachment draft or a new user question vetoes the reload. Suspended shells are checked
```

**File**: `extension/background.js` (modified, +5/-1)
```diff
@@ -2828,7 +2828,11 @@ async function performBrowserRepairs(repairs, policy) {
         const draftOnly = reason === 'compaction';
         const check = inspectTurn ? await tabReply(target.id,
           { type: 'clf-repair-check', conversationId, draftOnly }, documentId ? { documentId } : undefined) : null;
-        if (check?.safe === false) continue;
+        if (check?.safe === false) {
+          // The repair stays handed for the next pass; the app logs once why the page held it.
+          await call(`/status?repairHeld=${encodeURIComponent(token)}&why=${encodeURIComponent(check.why || 'unknown')}`);
+          continue;
+        }
         const claim = await call('/repairs/claim', { method: 'POST', body: JSON.stringify({ token }) });
         if (!claim.ok || claim.data?.allowed !== true) continue;
         if (target && !suspended) {
```

**File**: `extension/content.js` (modified, +16/-10)
```diff
@@ -11737,24 +11737,30 @@
       CLF_DOM.conversationId() === target && epoch === forEpoch;
     // An exact compaction ticket may recover its own busy page. It still cannot
     // discard a draft or cross a new user message while main is granting the claim.
+    // The first reason that holds, so the app can log why a repair waits (#820). Order matters
+    // only for the message; every one of them keeps the page untouched.
+    const draft = () => Boolean((CLF_DOM.composer()?.textContent || '').trim() || CLF_DOM.hasComposerAttachments());
+    const verdict = (holds, extra) => {
+      const why = holds.find(([held]) => held)?.[1];
+      return { safe: !why, ...(why ? { why } : {}), ...extra };
+    };
     if (message.draftOnly === true) {
       const questionId = CLF_DOM.messages().filter(row => row.role === 'user').at(-1)?.id ?? null;
-      return { safe: current() && !desktopInputBusy &&
-        !(CLF_DOM.composer()?.textContent || '').trim() && !CLF_DOM.hasComposerAttachments() &&
-        (!message.expected || message.expected.questionId === questionId),
-        revision: turnProgressRevision, turnId, questionId };
+      return verdict([[!current(), 'page-changed'], [desktopInputBusy, 'sending'], [draft(), 'draft'],
+        [message.expected && message.expected.questionId !== questionId, 'changed']],
+      { revision: turnProgressRevision, turnId, questionId });
     }
-    if (!current() || stopRequestedAt) return { safe: false };
+    if (!current()) return { safe: false, why: 'page-changed' };
+    if (stopRequestedAt) return { safe: false, why: 'stop-requested' };
     const source = currentAssistantTurn();
     if (source) await refreshFiber({ pageTurnId: source.id, pageTurn: source.node || source.nodes?.[0] });
     await flush();
     const questionId = CLF_DOM.messages().filter(row => row.role === 'user').at(-1)?.id ?? null;
     const expected = message.expected;
-    return { safe: current() && !stopRequestedAt && pendingTools === 0 && !desktopInputBusy && !nativeBusy && !job?.busy &&
-      !(CLF_DOM.composer()?.textContent || '').trim() && !CLF_DOM.hasComposerAttachments() &&
-      (!expected || (expected.turnId === turnId && expected.questionId === questionId &&
-        expected.revision === turnProgressRevision)),
-      revision: turnProgressRevision, turnId, questionId };
+    return verdict([[!current(), 'page-changed'], [stopRequestedAt, 'stop-requested'], [pendingTools !== 0, 'tool-running'],
+      [desktopInputBusy, 'sending'], [nativeBusy, 'page-busy'], [job?.busy, 'compaction'], [draft(), 'draft'],
+      [expected && !(expected.turnId === turnId && expected.questionId === questionId && expected.revision === turnProgressRevision), 'changed']],
+    { revision: turnProgressRevision, turnId, questionId });
   }
 
   async function acceptDesktopInput(message) {
```

**File**: `src/main/bridge.ts` (modified, +35/-1)
```diff
@@ -2147,6 +2147,8 @@ async function handle(req: http.IncomingMessage, res: http.ServerResponse): Prom
     } else if (repairFailed) {
       await failRepairAttempt(repairFailed.slice(0, 64), action);
     }
+    const repairHeld = url.searchParams.get('repairHeld');
+    if (repairHeld) noteRepairHeld(repairHeld.slice(0, 64), url.searchParams.get('why'));
     const revival = pendingBrowserRevival();
     const inputRows = await listInputs();
     const browser = browserOf(req);
@@ -2182,7 +2184,7 @@ async function handle(req: http.IncomingMessage, res: http.ServerResponse): Prom
         placement: pendingBrowserPlacement(null, browser),
         // A failure report closes this request. Reissuing the repair in the same response would
         // replace the visible failure with "Trying" before a renderer could ever observe it.
-        repairs: repairFailed ? [] : await takePendingRepairs(Date.now(), browser),
+        repairs: repairFailed || repairHeld ? [] : await takePendingRepairs(Date.now(), browser),
         ...tabPolicy,
         recoveryMonitoring: browserRecoveryMonitoring(),
         // A newer extension build ships with this app. The extension reloads into it on its own
@@ -8648,6 +8650,38 @@ async function confirmRepair(token: string, action: 'reloaded' | 'reopened' | 'r
 }
 
 /** An exact browser action failed; keep the episode queued and replace its one debug row. */
+/** Why a page said a handed repair is not safe yet, in the words the log uses. */
+const REPAIR_HOLD_REASONS: Record<string, string> = {
+  'page-changed': 'the page is on another chat or was reloaded',
+  'stop-requested': 'a Stop is in progress',
+  'tool-running': 'a local tool call for this chat is still running',
+  sending: 'a sent message is still waiting for ChatGPT to confirm it',
+  'page-busy': 'the page is busy with another action',
+  compaction: 'a Compact & resume is in progress',
+  draft: 'text or attachments are in the ChatGPT message box',
+  changed: 'the chat changed while the repair was being checked'
+};
+const repairHoldsLogged = new Set<string>();
+
+/**
+ * Logs, once per repair and reason, that the page refused a handed repair.
+ *
+ * The page may say a reload is not safe yet, and the browser then keeps the repair for its next
+ * pass. That is correct, but it used to be silent: a chat could show "Reload pending…" for as long
+ * as the page stayed busy, and the log only proved that repairs were handed out (#820).
+ */
+function noteRepairHeld(token: string, why: string | null): void {
+  const reason = why && Object.hasOwn(REPAIR_HOLD_REASONS, why) ? why : 'unknown';
+  const held = [...repairsInFlight].find(([, repair]) => repair.token === token);
+  if (!held) return;
+  const key = `${token}:${reason}`;
+  if (repairHoldsLogged.has(key)) return;
+  repairHoldsLogged.add(key);
+  if (repairHoldsLogged.size > 500) for (const old of [...repairHoldsLogged].slice(0, 100)) repairHoldsLogged.delete(old);
+  const [conversationId, repair] = held;
+  logInfo(`bridge: the page held the ${repair.reason} repair for ${conversationId}: ${REPAIR_HOLD_REASONS[reason] ?? 'it gave no reason'}`);
+}
+
 async function failRepairAttempt(token: string, action: 'reloaded' | 'reopened' | 'resumed' | 'preserved' | null): Promise<void> {
   for (const [conversationId, repair] of repairsInFlight) {
     if (repair.state !== 'handed' || repair.token !== token) continue;
```

**File**: `test/bridge.test.ts` (modified, +22/-0)
```diff
@@ -2104,6 +2104,28 @@ describe('automatic compaction', () => {
     expect(after.body.repairs?.some((row: { token: string }) => row.token === repair.token)).toBe(false);
   });
 
+  it('logs once, in words, why the page held a handed repair, and hands nothing out for that report', async () => {
+    await pair();
+    const conversationId = randomUUID();
+    const session = await createSession({ conversationId });
+    await compactSession(session.id);
+    const handout = (await request('GET', '/status')).body.repairs
+      .find((row: { conversationId: string }) => row.conversationId === conversationId);
+    const held = () => getLog().filter(entry => entry.message.includes(`held the compaction repair for ${conversationId}`)).map(entry => entry.message);
+    for (let pass = 0; pass < 3; pass++) {
+      const reply = await request('GET', `/status?repairHeld=${encodeURIComponent(handout.token)}&why=sending`);
+      expect(reply.body.repairs).toEqual([]);
+    }
+    await request('GET', `/status?repairHeld=${encodeURIComponent(handout.token)}&why=draft`);
+    await request('GET', `/status?repairHeld=unknown-token&why=sending`);
+    expect(held()).toEqual([
+      `bridge: the page held the compaction repair for ${conversationId}: a sent message is still waiting for ChatGPT to confirm it`,
+      `bridge: the page held the compaction repair for ${conversationId}: text or attachments are in the ChatGPT message box`
+    ]);
+    // The repair itself is untouched: the next ordinary pass still offers it.
+    expect((await request('GET', '/status')).body.repairs.some((row: { token: string }) => row.token === handout.token)).toBe(true);
+  });
+
   it('says an app-started Compact & resume reloaded its chat to send the request, in a row naming that chat', async () => {
     await pair();
     const conversationId = randomUUID();
```

---

### Incident Patch 4: `98bfd25f` (2026-09-30)
**Commit Message**: Merge pull request #826 from Haz4rdovisk/fix/space-entity-readback

Read an indented line's leading &#x20; back as the space it was sent as

**File**: `AGENTS.md` (modified, +4/-1)
```diff
@@ -2366,7 +2366,10 @@ An unnamed destination never reports a successful resume ACK, even after a trans
 Keep its armed dispatch and journal gate for exact marker reconciliation; a missing id plus
 generic timeout text is not proof of non-delivery and cannot authorize another Send.
 Continuation readback accepts one layer of Markdown escaping on ASCII punctuation, never
-escapes on letters/digits. Main/store/renderer and the unbundled content script must agree on
+escapes on letters/digits. The same fallback turns a line-opening `&#x20;` back into a space:
+the page writes an indented line's first space that way (#821). An `&#x20;` inside a line
+stays literal. The `COS_CONTEXT` frame readers (`shared/user-prompt.ts`, `chatgpt-dom.js`)
+follow the same order: exact first, then this one layer. Main/store/renderer and the unbundled content script must agree on
 the marker and preserve its exact removable span. Match an escaped marker separately from
 the brief before considering a fully escaped rendering, preserving literal path/glob backslashes.
 Bootstrap receipt fallback remains restricted to app-owned opening messages and retains native
```

**File**: `extension/chatgpt-dom.js` (modified, +3/-2)
```diff
@@ -79,8 +79,9 @@ var CLF_DOM = (() => {
   // frame is punctuation and newlines almost entirely, so an escaped readback matches none of
   // it — and the declared length stops matching too, because escaping adds characters. Read
   // exactly first, as everywhere else; only a frame that cannot be read as sent is read as one
-  // the page escaped. Keep in sync with asTyped() in shared/user-prompt.ts.
-  const promptAsTyped = value => value.replace(/\\\n/g, '\n').replace(/\\([!-/:-@[-`{-~])/g, '$1');
+  // the page escaped. It also writes an indented line's first space as `&#x20;` (#821).
+  // Keep in sync with asTyped() in shared/user-prompt.ts.
+  const promptAsTyped = value => value.replace(/\\\n/g, '\n').replace(/\\([!-/:-@[-`{-~])/g, '$1').replace(/(^|\n)&#x20;/g, '$1 ');
   function readPromptFrame(value) {
     const identity = promptContinuation(value);
     const header = /^\[\[COS_CONTEXT:(\d{1,6})\]\]\n/.exec(value.slice(identity.length));
```

**File**: `extension/content.js` (modified, +4/-1)
```diff
@@ -767,7 +767,10 @@
   // break — ChatGPT stores the composer's hard breaks as Markdown `\<newline>`. The second made a
   // worker's 20k-character bootstrap unrecognisable to its own receipt (2026-09-26, #426): every
   // hard break kept its backslash, so the page never bound the worker until its turn had ended.
-  const unescapeMarkdown = (value) => String(value || '').replace(/\\\r?\n/g, '\n').replace(/\\([!-\/:-@\[-`{-~])/g, '$1');
+  // A third (#821): an indented line's first space reads back as `&#x20;`. A 96,000-character
+  // opening never got its receipt, and the page held its input slot until it was reloaded.
+  const unescapeMarkdown = (value) => String(value || '').replace(/\\\r?\n/g, '\n').replace(/\\([!-\/:-@\[-`{-~])/g, '$1')
+    .replace(/(^|\n)&#x20;/g, '$1 ');
   /** The leading continuation marker, as typed or as the composer escaped it. */
   const markedAs = (value) => {
     const text = String(value || '');
```

**File**: `src/shared/session.ts` (modified, +3/-2)
```diff
@@ -526,8 +526,9 @@ const CONTINUATION_MARKER_ESCAPED = /^\s*(?:\\?\[){2}CLF\\?-(HANDOFF|RESUME)\\?:
  */
 export function unescapeMarkdown(value: string): string {
   // A backslash before a line break is the composer's Markdown hard break (see asTyped in
-  // shared/user-prompt.ts); ASCII punctuation is the other escape the page applies.
-  return value.replace(/\\\r?\n/g, '\n').replace(/\\([!-/:-@[-`{-~])/g, '$1');
+  // shared/user-prompt.ts); ASCII punctuation is the other escape the page applies, and an
+  // indented line's first space comes back as `&#x20;` (#821).
+  return value.replace(/\\\r?\n/g, '\n').replace(/\\([!-/:-@[-`{-~])/g, '$1').replace(/(^|\n)&#x20;/g, '$1 ');
 }
 
 /** The continuation marker at the head of `text`, as typed or as the composer escaped it. */
```

**File**: `src/shared/user-prompt.ts` (modified, +5/-1)
```diff
@@ -16,11 +16,15 @@ const continuation = (text: string): string => /^\[\[CLF-(?:HANDOFF|RESUME):[A-Z
  * conversation with them, and the recorder files the framed text as a second user message
  * beside the authored one.
  *
+ * It also writes the first space of an indented line as `&#x20;`, and only that one: measured
+ * in issue #821, a 96,000-character opening read back with 47 of them, every one opening a
+ * line, and replacing them gave the sent bytes exactly. An `&#x20;` inside a line stays as typed.
+ *
  * Same rule as `unescapeMarkdown()` in shared/session.ts, which readers of the continuation
  * marker already follow: try the exact text first, and only then this.
  */
 function asTyped(text: string): string {
-  return text.replace(/\\\n/g, '\n').replace(/\\([!-/:-@[-`{-~])/g, '$1');
+  return text.replace(/\\\n/g, '\n').replace(/\\([!-/:-@[-`{-~])/g, '$1').replace(/(^|\n)&#x20;/g, '$1 ');
 }
 
 function readFrame(text: string): string | null {
```

---

### Incident Patch 5: `20250d2d` (2026-09-30)
**Commit Message**: Polish the 2.1.21 release notes: highlights, grouped fixes, thanks

**File**: `CHANGELOG.md` (modified, +75/-38)
```diff
@@ -9,54 +9,91 @@ The app and the `extension/` companion are versioned together. **Reload the
 extension after updating the app**. If their bridge protocols are incompatible,
 the app refuses the extension and asks you to reload the matching copy.
 
-## [2.1.21] — Korean, a new message box and answers you can take with you
+## [2.1.21] — Korean, a calmer chat and a much more reliable Goal, Loop and Compact & resume
 
-A big update: CoS now speaks Korean, the message box has been redesigned, and every answer can be copied or saved as Markdown. It also fixes a handful of annoyances found in testing.
+The biggest update in a while. CoS now speaks Korean, the message box has been redesigned, and the chat finally shows what ChatGPT is doing while it works. Under the hood, more than 20 fixes make Goal, Loop and Compact & resume far more dependable, especially with long answers, long thinking and more than one browser.
+
+### Highlights
+
+- **See what ChatGPT is doing right now.** While a chat works, a live line at its end says what is happening, for example "Running npm test 12s" or "Searching the web", instead of a silent spinner.
+- **Your message stays in view.** After you send, your message moves to the top and the answer grows beneath it, so nothing jumps while ChatGPT writes.
+- **Steps with a real title.** A group of steps is titled with ChatGPT's own summary of that round, such as "Created and verified the test file", like in ChatGPT itself.
+- **A clearer message box.** Normal, Goal and Loop in one menu, Plan as its own button, and a context ring that shows how full the chat is.
+- **Korean (한국어),** the 11th language.
 
 ### New
 
-- **Korean.** The app is now available in Korean (한국어), the 11th language. Pick it in Appearance or with the flags in Setup.
-- **A clearer message box.** Normal, Goal and Loop now sit in one mode menu, each with a short description of what it does. Plan is its own button. The context ring opens a small panel that shows, one per line, how big the chat is, your limit, how full it is and when it compacts, together with the Compact & resume action. The model menu lists every model; the thinking-effort slider glides smoothly, and Instant models, which have nothing to choose, show no slider at all.
-- **Copy and export answers.** Under every finished answer you can copy it or save it as a Markdown file. You can also save the whole chat.
-- **See how long each answer took.** A quiet line under each of your messages shows "Working for 12s" while ChatGPT works and "Worked for 1m 12s" once it is done.
-- **For agents on this computer: a local interface.** It is off by default. When you turn it on in Settings → Setup → Advanced, tools running on this computer can read whether the app is healthy, what its chats are doing and what the app is waiting for. Keys and passwords are masked. A second switch, also off by default, lets them send a message to a chat or cancel one that has not gone out yet. They never interrupt an answer unless they ask to.
+- **Korean.** Pick it in Appearance or with the flags in Setup.
+- **A clearer message box.** Normal, Goal and Loop sit in one mode menu, each with a short description of what it does; Plan is its own button. The context ring opens a small panel with how big the chat is, your limit, how full it is and when it compacts, next to the Compact & resume action. The model menu lists every model, the thinking-effort slider glides smoothly, and Instant models, which have nothing to choose, show no slider at all.
+- **Copy and export answers.** Under every finished answer you can copy it or save it as a Markdown file, and you can save the whole chat.
+- **See how long each answer took.** A quiet line under your message shows "Working for 12s" while ChatGPT works and "Worked for 1m 12s" when it is done.
+- **For agents on this computer: a local interface.** Off by default. Turned on in Settings → Setup → Advanced, it lets tools on this computer read whether the app is health
```

**File**: `docs/release-notes/v2.1.21.md` (modified, +75/-38)
```diff
@@ -1,50 +1,87 @@
-## 2.1.21 Korean, a new message box and answers you can take with you
+## 2.1.21 Korean, a calmer chat and a much more reliable Goal, Loop and Compact & resume
 
-A big update: CoS now speaks Korean, the message box has been redesigned, and every answer can be copied or saved as Markdown. It also fixes a handful of annoyances found in testing.
+The biggest update in a while. CoS now speaks Korean, the message box has been redesigned, and the chat finally shows what ChatGPT is doing while it works. Under the hood, more than 20 fixes make Goal, Loop and Compact & resume far more dependable, especially with long answers, long thinking and more than one browser.
+
+### Highlights
+
+- **See what ChatGPT is doing right now.** While a chat works, a live line at its end says what is happening, for example "Running npm test 12s" or "Searching the web", instead of a silent spinner.
+- **Your message stays in view.** After you send, your message moves to the top and the answer grows beneath it, so nothing jumps while ChatGPT writes.
+- **Steps with a real title.** A group of steps is titled with ChatGPT's own summary of that round, such as "Created and verified the test file", like in ChatGPT itself.
+- **A clearer message box.** Normal, Goal and Loop in one menu, Plan as its own button, and a context ring that shows how full the chat is.
+- **Korean (한국어),** the 11th language.
 
 ### New
 
-- **Korean.** The app is now available in Korean (한국어), the 11th language. Pick it in Appearance or with the flags in Setup.
-- **A clearer message box.** Normal, Goal and Loop now sit in one mode menu, each with a short description of what it does. Plan is its own button. The context ring opens a small panel that shows, one per line, how big the chat is, your limit, how full it is and when it compacts, together with the Compact & resume action. The model menu lists every model; the thinking-effort slider glides smoothly, and Instant models, which have nothing to choose, show no slider at all.
-- **Copy and export answers.** Under every finished answer you can copy it or save it as a Markdown file. You can also save the whole chat.
-- **See how long each answer took.** A quiet line under each of your messages shows "Working for 12s" while ChatGPT works and "Worked for 1m 12s" once it is done.
-- **For agents on this computer: a local interface.** It is off by default. When you turn it on in Settings → Setup → Advanced, tools running on this computer can read whether the app is healthy, what its chats are doing and what the app is waiting for. Keys and passwords are masked. A second switch, also off by default, lets them send a message to a chat or cancel one that has not gone out yet. They never interrupt an answer unless they ask to.
+- **Korean.** Pick it in Appearance or with the flags in Setup.
+- **A clearer message box.** Normal, Goal and Loop sit in one mode menu, each with a short description of what it does; Plan is its own button. The context ring opens a small panel with how big the chat is, your limit, how full it is and when it compacts, next to the Compact & resume action. The model menu lists every model, the thinking-effort slider glides smoothly, and Instant models, which have nothing to choose, show no slider at all.
+- **Copy and export answers.** Under every finished answer you can copy it or save it as a Markdown file, and you can save the whole chat.
+- **See how long each answer took.** A quiet line under your message shows "Working for 12s" while ChatGPT works and "Worked for 1m 12s" when it is done.
+- **For agents on this computer: a local interface.** Off by default. Turned on in Settings → Setup → Advanced, it lets tools on this computer read whether the app is healthy, what its chats are doing and what it is waiting for, with keys and passwords masked. A second switch, also off by default, lets them send a message to a chat or cancel one that has not gone out yet. They never interrupt an answer unless 
```

---

### Incident Patch 6: `a6dc6bf5` (2026-09-30)
**Commit Message**: Merge pull request #808 from Maximapple/fix/read-browser-preferences-on-open

Read the extension's preferences when their switches come into view

**File**: `src/renderer/browser-preferences.ts` (modified, +11/-0)
```diff
@@ -29,5 +29,16 @@ export function initBrowserPreferences(): void {
   overwrite.addEventListener('change', () => void request({ overwrite: overwrite.checked }));
   durations.addEventListener('change', () => void request({ durations: durations.checked }));
   refresh.addEventListener('click', () => void request());
+  // The switches are unusable until the extension has answered, and a reader did not know to press
+  // Refresh first. Ask once each time they come into view while unconfirmed; a failed answer stays
+  // on screen with the button until the next visit, and nothing is asked in a loop.
+  if (typeof IntersectionObserver === 'function') {
+    let visible = false;
+    new IntersectionObserver(entries => {
+      const now = entries.some(entry => entry.isIntersecting);
+      if (now && !visible && !confirmed) void request();
+      visible = now;
+    }).observe(overwrite.closest('.setting') ?? overwrite);
+  }
   paint();
 }
```

**File**: `test/browser-preferences-renderer.test.ts` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import { JSDOM } from 'jsdom';
+import { afterEach, expect, it, vi } from 'vitest';
+import { readFileSync } from 'node:fs';
+import { initBrowserPreferences } from '../src/renderer/browser-preferences.js';
+
+let dom: JSDOM | undefined;
+afterEach(() => { dom?.window.close(); vi.unstubAllGlobals(); });
+
+/** The page's switches, a stubbed extension round trip, and a hand-driven "came into view". */
+function setup(reply: () => Promise<{ ok: true; data: { overwrite: boolean; durations: boolean } } | { ok: false; error: string }>) {
+  dom = new JSDOM(readFileSync('src/renderer/index.html', 'utf8'));
+  vi.stubGlobal('document', dom.window.document);
+  vi.stubGlobal('Node', dom.window.Node);
+  const browserPreferences = vi.fn(reply);
+  vi.stubGlobal('window', Object.assign(dom.window, { api: { browserPreferences } }));
+  let seen: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
+  vi.stubGlobal('IntersectionObserver', class { constructor(callback: typeof seen) { seen = callback; } observe() {} disconnect() {} });
+  initBrowserPreferences();
+  const doc = dom.window.document;
+  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
+  return {
+    browserPreferences,
+    overwrite: doc.getElementById('browserOverwrite') as HTMLInputElement,
+    durations: doc.getElementById('browserDurations') as HTMLInputElement,
+    status: doc.getElementById('browserPreferencesStatus')!,
+    show: async () => { seen!([{ isIntersecting: true }]); await settle(); },
+    hide: async () => { seen!([{ isIntersecting: false }]); await settle(); }
+  };
+}
+
+it('reads the extension preferences when its switches come into view, so they are usable without Refresh', async () => {
+  const page = setup(async () => ({ ok: true, data: { overwrite: true, durations: false } }));
+  expect(page.overwrite.disabled).toBe(true);
+  expect(page.browserPreferences).not.toHaveBeenCalled();
+
+  await page.show();
+  expect(page.browserPreferences).toHaveBeenCalledExactlyOnceWith({});
+  expect(page.overwrite.disabled).toBe(false);
+  expect(page.durations.disabled).toBe(false);
+  expect(page.overwrite.checked).toBe(true);
+  expect(page.status.textContent).toBe('Confirmed by the browser extension.');
+
+  // Confirmed values are not re-read on every visit.
+  await page.hide(); await page.show();
+  expect(page.browserPreferences).toHaveBeenCalledTimes(1);
+});
+
+it('tries again on a later visit after the extension could not answer, never in a loop', async () => {
+  let connected = false;
+  const page = setup(async () => connected
+    ? { ok: true, data: { overwrite: false, durations: true } }
+    : { ok: false, error: 'Browser did not confirm its preferences. Connect the extension and refresh.' });
+
+  await page.show();
+  expect(page.browserPreferences).toHaveBeenCalledTimes(1);
+  expect(page.overwrite.disabled).toBe(true);
+  expect(page.status.textContent).toContain('Connect the extension');
+  // Still on screen: the failure is shown, and the page does not keep asking.
+  await page.show();
+  expect(page.browserPreferences).toHaveBeenCalledTimes(1);
+
+  connected = true;
+  await page.hide(); await page.show();
+  expect(page.browserPreferences).toHaveBeenCalledTimes(2);
+  expect(page.durations.disabled).toBe(false);
+  expect(page.durations.checked).toBe(true);
+});
```

---

### Incident Patch 7: `44300b21` (2026-09-30)
**Commit Message**: Note the model list, localized Pro and Compact & resume note fixes for 2.1.21

**File**: `CHANGELOG.md` (modified, +3/-1)
```diff
@@ -35,7 +35,9 @@ A big update: CoS now speaks Korean, the message box has been redesigned, and ev
 ### Fixed
 
 - **Goal says why it stopped.** When Goal could not write its next message for good, for example because the OpenRouter account ran out of credit, it kept showing "Answer settling" in the app and on the ChatGPT page. It now shows that the goal loop stopped, and why, in your language on the ChatGPT page too.
-- **Saved GPT-6 Pro works.** Choosing GPT-6 Pro ("6") as the model for workers or Goal's helper was not recognised, so the app fell back to whatever ChatGPT had selected. It now finds the right model.
+- **Saved GPT-6 Pro works.** Choosing GPT-6 Pro ("6") as the model for workers or Goal's helper was not recognised, so the app fell back to whatever ChatGPT had selected. It now finds the right model, and when the app's saved list of your ChatGPT models is older than the model you picked, it asks an open ChatGPT page for a fresh list instead of quietly using another model.
+- **Pro is recognised on a ChatGPT page in any language.** On a ChatGPT page in another language the Pro thinking level could be read as "medium". Pro is now recognised from the model itself, whatever the page's language.
+- **A clean start after Compact & resume.** The new chat could show "Reloaded chat to recover a handoff request that has not been sent" above its first message, although that reload happened in the old chat and nothing had failed. The note now stays in the chat it belongs to and says that the chat was reloaded to send the handoff request.
 - **Working chats are left alone.** When a ChatGPT chat that is not open in the app (for example on your phone) used a CoS tool, the app could reload whichever chat was working at that moment. A chat whose own tool calls are already recognised is no longer reloaded.
 - **A chat stays in its browser.** With the extension in two browsers, a message or a repair for a chat could open a second copy of it in the other browser, and Compact & resume could then open the new chat there. A chat's messages, repairs and its Compact & resume replacement now stay in the browser that has it open.
 - **No false "goal loop stopped".** With the same chat open in two tabs or two browsers, the tab that was not running Goal showed "The goal loop stopped" while Goal went on working in the other one. That tab now stays quiet.
```

**File**: `docs/release-notes/v2.1.21.md` (modified, +3/-1)
```diff
@@ -24,7 +24,9 @@ A big update: CoS now speaks Korean, the message box has been redesigned, and ev
 ### Fixed
 
 - **Goal says why it stopped.** When Goal could not write its next message for good, for example because the OpenRouter account ran out of credit, it kept showing "Answer settling" in the app and on the ChatGPT page. It now shows that the goal loop stopped, and why, in your language on the ChatGPT page too.
-- **Saved GPT-6 Pro works.** Choosing GPT-6 Pro ("6") as the model for workers or Goal's helper was not recognised, so the app fell back to whatever ChatGPT had selected. It now finds the right model.
+- **Saved GPT-6 Pro works.** Choosing GPT-6 Pro ("6") as the model for workers or Goal's helper was not recognised, so the app fell back to whatever ChatGPT had selected. It now finds the right model, and when the app's saved list of your ChatGPT models is older than the model you picked, it asks an open ChatGPT page for a fresh list instead of quietly using another model.
+- **Pro is recognised on a ChatGPT page in any language.** On a ChatGPT page in another language the Pro thinking level could be read as "medium". Pro is now recognised from the model itself, whatever the page's language.
+- **A clean start after Compact & resume.** The new chat could show "Reloaded chat to recover a handoff request that has not been sent" above its first message, although that reload happened in the old chat and nothing had failed. The note now stays in the chat it belongs to and says that the chat was reloaded to send the handoff request.
 - **Working chats are left alone.** When a ChatGPT chat that is not open in the app (for example on your phone) used a CoS tool, the app could reload whichever chat was working at that moment. A chat whose own tool calls are already recognised is no longer reloaded.
 - **A chat stays in its browser.** With the extension in two browsers, a message or a repair for a chat could open a second copy of it in the other browser, and Compact & resume could then open the new chat there. A chat's messages, repairs and its Compact & resume replacement now stay in the browser that has it open.
 - **No false "goal loop stopped".** With the same chat open in two tabs or two browsers, the tab that was not running Goal showed "The goal loop stopped" while Goal went on working in the other one. That tab now stays quiet.
```

---

### Incident Patch 8: `70873892` (2026-09-30)
**Commit Message**: Merge pull request #806 from Maximapple/fix/repair-note-own-chat

Keep a source chat's reload note out of the chat Compact & resume opens

**File**: `AGENTS.md` (modified, +5/-1)
```diff
@@ -2350,7 +2350,11 @@ repair, but cannot create a second browser action while another repair is alread
 Every compaction reload rechecks its original continuation token and phase at handout and the
 browser action claim. Cancellation, replacement, source dispatch and completed capture revoke
 obsolete pickup authority. Recovery text distinguishes an unsent request from an outstanding
-answer; neither implies a completed brief exists. A reloaded source waits for its visible,
+answer; neither implies a completed brief exists. An explicit desktop compaction's reload says it sends the
+request; nothing failed. Every reload row's id names the chat it reloaded
+(`browser-repair:<chat>:<id>`) and the page paints it only in that chat. B's page may record its
+sent resume message after B's first attributed call already committed; that message is the
+feed's resume boundary, where A's rows stop. A reloaded source waits for its visible,
 editable composer and recorded original question before freezing the source identity or stopping
 the turn. Already observed identities and a real user Send remain cancellation boundaries during
 hydration; an empty loading DOM must not be treated as a different conversation. The source
```

**File**: `extension/content.js` (modified, +12/-7)
```diff
@@ -5671,13 +5671,18 @@
   }
 
   function repairNotice(entry) {
-    return Boolean(
-      entry &&
-        entry.kind === 'progress' &&
-        !entry.turnId &&
-        typeof entry.progressId === 'string' &&
-        entry.progressId.startsWith('browser-repair:')
-    );
+    if (
+      !entry ||
+      entry.kind !== 'progress' ||
+      entry.turnId ||
+      typeof entry.progressId !== 'string' ||
+      !entry.progressId.startsWith('browser-repair:')
+    ) return false;
+    // `browser-repair:<chat>:<id>` names the chat that was reloaded. Compact & resume moves the
+    // session on to a new chat, whose log then still holds the source chat's reload; it did not
+    // happen here. Older rows name no chat and keep their place.
+    const parts = entry.progressId.split(':');
+    return parts.length < 3 || parts[1] === CLF_DOM.conversationId();
   }
 
   /**
```

**File**: `src/main/bridge.ts` (modified, +17/-5)
```diff
@@ -7009,7 +7009,9 @@ function queueBrowserRecovery(
     reason,
     notBefore,
     token: '',
-    progressId: `browser-repair:${randomBytes(9).toString('base64url')}`
+    // Names the chat it reloads: Compact & resume moves the session on, and the page paints the
+    // row only in this chat, not before the first message of the chat the session moved to.
+    progressId: `browser-repair:${conversationId}:${randomBytes(9).toString('base64url')}`
   };
   repairsInFlight.set(conversationId, repair);
   // Queue publication owns the pickup notification, just as the input outbox does.
@@ -8524,7 +8526,7 @@ async function takePendingRepairs(
     } else {
       repair.state = 'handed';
       repair.token = randomBytes(9).toString('base64url');
-      await updateRepairProgress(conversationId, repair, `Trying to reload chat to recover ${repairReason(repair)}…`);
+      await updateRepairProgress(conversationId, repair, `Trying to reload chat to ${repairPurpose(repair).to}…`);
     }
     // A missed pre-action claim may retry the same offer. Once claimed, ambiguous
     // acknowledgement keeps custody and cannot authorize a second browser action.
@@ -8596,7 +8598,7 @@ async function confirmRepair(token: string, action: 'reloaded' | 'reopened' | 'r
         await updateRepairProgress(
           conversationId,
           repair,
-          `Kept the recovered chat open instead of reloading while recovering ${repairReason(repair)}.`
+          `Kept the recovered chat open instead of reloading while ${repairPurpose(repair).during}.`
         );
         if (turnRepairSpent.get(conversationId)?.token === token) turnRepairSpent.delete(conversationId);
         repairsInFlight.delete(conversationId);
@@ -8638,7 +8640,7 @@ async function confirmRepair(token: string, action: 'reloaded' | 'reopened' | 'r
       await updateRepairProgress(
         conversationId,
         repair,
-        `${action === 'reopened' ? 'Reopened' : action === 'resumed' ? 'Resumed' : 'Reloaded'} chat to recover ${repairReason(repair)}.`
+        `${action === 'reopened' ? 'Reopened' : action === 'resumed' ? 'Resumed' : 'Reloaded'} chat to ${repairPurpose(repair).to}.`
       );
       return;
     }
@@ -8653,7 +8655,7 @@ async function failRepairAttempt(token: string, action: 'reloaded' | 'reopened'
     await updateRepairProgress(
       conversationId,
       repair,
-      `${action === 'reopened' ? 'Reopen' : action === 'resumed' ? 'Resume' : 'Reload'} failed while recovering ${repairReason(repair)}${repair.attribution ? '.' : '; will retry.'}`
+      `${action === 'reopened' ? 'Reopen' : action === 'resumed' ? 'Resume' : 'Reload'} failed while ${repairPurpose(repair).during}${repair.attribution ? '.' : '; will retry.'}`
     );
     if (repairsInFlight.get(conversationId) !== repair) return;
     if (repair.reason === 'assistant-error' && turnRepairSpent.get(conversationId)?.token === token)
@@ -8669,6 +8671,16 @@ async function failRepairAttempt(token: string, action: 'reloaded' | 'reopened'
   }
 }
 
+/**
+ * What a reload is for, in the row's words. Compact & resume started from the app reaches its
+ * chat through this same repair channel, but nothing failed: the reload sends the request.
+ */
+function repairPurpose(repair: Repair): { to: string; during: string } {
+  if (repair.reason === 'compaction' && repair.episode.endsWith(':manual') && repair.episode.includes(':asking:'))
+    return { to: 'send the handoff request for Compact & resume', during: 'sending the handoff request for Compact & resume' };
+  return { to: `recover ${repairReason(repair)}`, during: `recovering ${repairReason(repair)}` };
+}
+
 function repairReason(repair: Repair): string {
   if (repair.reason === 'compaction') return repair.episode.includes(':asking:')
     ? 'a handoff request that has not been sent' : 'the pending handoff response';
```

**File**: `src/main/session/continuation.ts` (modified, +5/-1)
```diff
@@ -1018,7 +1018,11 @@ export async function bindContinuationDestinationMessageNow(
         entry.destinationSend.messageId === messageId
       );
     }
-    if (!isOpen(entry)) return false;
+    // B's first attributed tool call can commit the transaction before the page reports the
+    // message it typed. Recording that message for the committed destination moves nothing, and
+    // it is the resume boundary the page feed needs (where A's rows stop).
+    const committedHere = entry.state === 'committed' && entry.to === conversationId;
+    if (!isOpen(entry) && !committedHere) return false;
     if (entry.destinationSend.state !== 'dispatched-unresolved') return false;
     await transitionNow(entry, (current) => ({
       ...current,
```

**File**: `test/bridge.test.ts` (modified, +19/-0)
```diff
@@ -2104,6 +2104,25 @@ describe('automatic compaction', () => {
     expect(after.body.repairs?.some((row: { token: string }) => row.token === repair.token)).toBe(false);
   });
 
+  it('says an app-started Compact & resume reloaded its chat to send the request, in a row naming that chat', async () => {
+    await pair();
+    const conversationId = randomUUID();
+    const session = await createSession({ conversationId });
+    await compactSession(session.id);
+    const handout = (await request('GET', '/status')).body.repairs
+      .find((row: { conversationId: string }) => row.conversationId === conversationId);
+    expect(handout).toMatchObject({ reason: 'compaction' });
+    await request('POST', '/repairs/claim', { body: { token: handout.token } });
+    await request('GET', `/status?repaired=${encodeURIComponent(handout.token)}&repairAction=reloaded`);
+    const rows = foldProgress((await readEvents(session.id, { kinds: ['progress'] })).filter(
+      (event): event is Extract<SessionEvent, { kind: 'progress' }> => event.kind === 'progress' && !!event.progressId?.startsWith('browser-repair:')
+    ));
+    // The page paints this row only in the chat it names; Compact & resume moves the session on.
+    expect(rows.map(row => row.kind === 'progress' ? [row.progressId!.split(':')[1], row.message.text] : [])).toEqual([
+      [conversationId, 'Reloaded chat to send the handoff request for Compact & resume.']
+    ]);
+  });
+
   it('keeps the concrete pre-send failure and refuses a stale page abort of a newer ticket', async () => {
     await pair();
     const conversationId = randomUUID();
```

---

### Incident Patch 9: `4e8da78a` (2026-09-30)
**Commit Message**: Merge pull request #804 from lavalava45/fix/shell-pro-lane-machine-identity

fix: identify localized shell Pro lanes from execution ids

**File**: `extension/fiber.js` (modified, +9/-2)
```diff
@@ -2312,6 +2312,12 @@
     }
     return state;
   }
+  /** Shell execution ids are provider identities, not localized presentation. */
+  function shellProExecutionModel(value) {
+    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
+    return /^(?:pro|(?:gpt-?)?\d+(?:[.-]\d+)?-pro)$/.test(normalized);
+  }
+
   // The native closed picker does not mount composerIntelligencePickerState.
   // Its own ancestor carries the current execution model; its visible label
   // carries the selected effort. These are observation, never catalog discovery.
@@ -2334,7 +2340,7 @@
       if (typeof current !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(current) || (model && model !== current)) return null;
       model = current;
     }
-    const effort = (lane && lane.model === model && lane.effort) ||
+    const effort = shellProExecutionModel(model) ? 'pro' : (lane && lane.model === model && lane.effort) ||
       (machine !== null ? (['none','minimal','low','medium','high','xhigh','max','ultra','pro'].includes(machine) ? machine : null) : captionEffort);
     if (!effort) return null;
     return model ? { id: model, effort } : null;
@@ -2396,7 +2402,8 @@
       // The machine reasoningEffort is a lane's transport setting, not its identity: the
       // Pro and Extra High lanes still report medium/max. The lane's visible label is what
       // the picker offers, matching readPickerSnapshot's modelLane/thinkingEffort mapping.
-      const laneEffort = c => effort(String(c?.labels?.effort ?? c?.sliderLabel ?? '').trim().toLowerCase()) ?? effort(c?.reasoningEffort);
+      const laneEffort = c => shellProExecutionModel(c?.model) ? 'pro' :
+        effort(String(c?.labels?.effort ?? c?.sliderLabel ?? '').trim().toLowerCase()) ?? effort(c?.reasoningEffort);
       const current = options.filter(o => o?.selected === true);
       if (current.length !== 1) return null;
       const version = group(current[0].id);
```

**File**: `test/shell-compat.test.ts` (modified, +12/-0)
```diff
@@ -1174,6 +1174,18 @@ it('maps native lane labels over transport effort values (Pro/Extra High lanes)'
   expect(await f.api.selectModelSettings('gpt-5-6-thinking', 'xhigh')).toBe(true);
   expect(f.api.visibleModelSelection()).toEqual({ model: 'gpt-5-6-thinking', reasoningEffort: 'xhigh' });
 });
+it('identifies a Pro shell lane from its execution id when the effort label is localized', async () => {
+  const f = fixture();
+  Object.assign(f.selections[0]![0]!, {
+    model: 'gpt-6-pro', modelLabel: '6 Pro', reasoningEffort: 'medium',
+    sliderLabel: 'LOCALIZED_PRO', labels: { effort: 'LOCALIZED_PRO' }
+  });
+  const models = await f.api.inspectModelSettings();
+  expect(models.find((m: any) => m.id === 'gpt-6-pro')?.efforts).toEqual(['pro']);
+  expect(f.api.visibleModelSelection()).toEqual({ model: 'gpt-6-pro', reasoningEffort: 'pro' });
+  expect(await f.api.selectModelSettings('gpt-6-pro', 'pro')).toBe(true);
+  expect(f.api.visibleModelSelection()).toEqual({ model: 'gpt-6-pro', reasoningEffort: 'pro' });
+});
 it.each([false, true])('rechecks the cold shell picker owner when its account state hydrates (cancelled=%s)', async cancelled => {
   const f = fixture(), options = f.props.modelListConfig;
   f.props.modelListConfig = null;
```

---

### Incident Patch 10: `dfc28347` (2026-09-30)
**Commit Message**: fix: identify shell Pro lanes from execution ids

**File**: `extension/fiber.js` (modified, +9/-2)
```diff
@@ -2312,6 +2312,12 @@
     }
     return state;
   }
+  /** Shell execution ids are provider identities, not localized presentation. */
+  function shellProExecutionModel(value) {
+    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
+    return /^(?:pro|(?:gpt-?)?\d+(?:[.-]\d+)?-pro)$/.test(normalized);
+  }
+
   // The native closed picker does not mount composerIntelligencePickerState.
   // Its own ancestor carries the current execution model; its visible label
   // carries the selected effort. These are observation, never catalog discovery.
@@ -2334,7 +2340,7 @@
       if (typeof current !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(current) || (model && model !== current)) return null;
       model = current;
     }
-    const effort = (lane && lane.model === model && lane.effort) ||
+    const effort = shellProExecutionModel(model) ? 'pro' : (lane && lane.model === model && lane.effort) ||
       (machine !== null ? (['none','minimal','low','medium','high','xhigh','max','ultra','pro'].includes(machine) ? machine : null) : captionEffort);
     if (!effort) return null;
     return model ? { id: model, effort } : null;
@@ -2396,7 +2402,8 @@
       // The machine reasoningEffort is a lane's transport setting, not its identity: the
       // Pro and Extra High lanes still report medium/max. The lane's visible label is what
       // the picker offers, matching readPickerSnapshot's modelLane/thinkingEffort mapping.
-      const laneEffort = c => effort(String(c?.labels?.effort ?? c?.sliderLabel ?? '').trim().toLowerCase()) ?? effort(c?.reasoningEffort);
+      const laneEffort = c => shellProExecutionModel(c?.model) ? 'pro' :
+        effort(String(c?.labels?.effort ?? c?.sliderLabel ?? '').trim().toLowerCase()) ?? effort(c?.reasoningEffort);
       const current = options.filter(o => o?.selected === true);
       if (current.length !== 1) return null;
       const version = group(current[0].id);
```

#### Recent Merged Pull Requests:
- **PR #829** (2026-09-30): Bound the wait for a Send receipt and retire an unconfirmed send (@Haz4rdovisk)
- **PR #828** (2026-09-30): Let automatic compaction wait out one long poll before it gives up (@Maximapple)
- **PR #827** (2026-09-30): Log why the page held a recovery reload (@Maximapple)
- **PR #826** (2026-09-30): Read an indented line's leading &#x20; back as the space it was sent as (@Haz4rdovisk)
- **PR #824** (2026-09-30): Open a weekly maintainer digest issue (@Maximapple)
- **PR #823** (2026-09-30): Add grouped weekly Dependabot updates and CodeQL code scanning (@Maximapple)
- **PR #822** (2026-09-30): Welcome first-time contributors with the few things that help most (@Maximapple)
- **PR #819** (2026-09-30): Remind, then close, contributor PRs that wait quietly on their author (@Maximapple)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
