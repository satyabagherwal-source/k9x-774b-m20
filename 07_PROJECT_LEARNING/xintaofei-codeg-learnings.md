# Forensic Learning Record (Deep Inspection): xintaofei/codeg

> **Canonical Artifact**: `07_PROJECT_LEARNING/xintaofei-codeg-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xintaofei/codeg](https://github.com/xintaofei/codeg))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:16:13.263Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xintaofei/codeg`
- **Description**: Collaborative multi-agent AI coding workspace: aggregate sessions from Claude Code, Codex, OpenCode, Pi, Grok Build, etc. Desktop app, self-hosted server, or Docker.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3747 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `browser-agent/probe.mjs`
```
/**
 * Drives the committed bundle in a real engine and prints what it produces.
 *
 *     pnpm browser:agent:probe
 *
 * The unit tests cover the part of `src/index.ts` that is pure. They cannot
 * cover the tree: jsdom reports every element as zero-sized, and `ai` mode
 * only names elements that are visible and receive pointer events, so under
 * jsdom the tree comes back with no refs and proves nothing. This asks a
 * browser instead.
 *
 * Chrome, because it is the one engine present on all three of our
 * development machines and it speaks CDP without a driver. It is not the
 * engine any platform actually ships — WKWebView, WebView2 and WebKitGTK are —
 * so a green run here says the bundle is sound, not that it is verified on a
 * platform. Manual, not part of `pnpm test`: it needs a browser on the box.
 */
import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const BUNDLE = readFileSync(
  resolve(root, "src-tauri/src/browser/js/agent.bundle.js"),
  "utf8"
)
// The page-world console shim, injected by the host into the PAGE world on
// the WebKit ports. Not part of the bundle; the probe measures the channel
// between it and this world.
const CONSOLE_SHIM = readFileSync(
  resolve(root, "src/browser-injected/console.js"),
  "utf8"
)
// The element picker, which the host evaluates into the isolated world on
// demand when a person asks to hand an element to a conversation. Also not
// part of the bundle.
const PICKER = readFileSync(
  resolve(root, "src/browser-injected/picker.js"),
  "utf8"
)
// What `browser_eval` wraps an agent's snippet in, and the one piece of this
// subsystem's JS that runs in the PAGE's world rather than ours. The file is
// the renderer; the six lines around it are built here the way
// `browser::eval::eval_call` builds them, and a Rust unit test pins that
// shape.
const EVAL_RENDER = readFileSync(
  resolve(root, "src/browser-injected/eval-render.js"),
  "utf8"
)
const evalCall = (code) =>
  `(function(){\n${EVAL_RENDER}\ntry {\nvar __codegEvalValue = (function () {\n${code}\n})();\nreturn __codegEvalRender(__codegEvalValue);\n} catch (e) {\nreturn __codegEvalError(e);\n}\n})()`

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const PORT = 9333

const PAGE = `<!doctype html><html><head><title>Probe</title>
<style>#stretched::after{content:"";position:absolute;inset:0}</style>
</head><body>
<header><a href="/docs">Docs</a></header>
<main>
  <h1>Orders</h1>
  <label>Search <input type="search" name="q"></label>
  <button id="exp" style="cursor:pointer">Export</button>
  <div id="pointer" style="cursor:pointer">Pointer but no handler</div>
  <div id="handler" onclick="void 0">Handler but no pointer</div>
  <div id="focusable" tabindex="0">Focusable but neither</div>
  <div id="hidden" style="display:none"><button>Invisible</button></div>
  <ul><li>alpha</li><li>beta</li></ul>
  <section id="act">
    <button id="count" onclick="this.dataset.n = (Number(this.dataset.n || 0) + 1)">Count</button>
    <form id="f" onsubmit="event.preventDefault(); this.dataset.submitted = document.getElementById('name').value">
      <label>Name <input id="name" name="name"></label>
      <button type="submit" id="save" onclick="this.dataset.clicked = 1">Save</button>
    </form>
    <label>Size <select id="size"><option value="s">Small</option><option value="m" selected>Medium</option><option value="l">Large</option></select></label>
    <div id="note" contenteditable="true">draft</div>
    <div style="position:relative;height:60px">
      <button id="under">Under</button>
      <div id="veil" style="position:absolute;inset:0;background:rgba(0,0,0,.2)"></div>
    </div>
    <a id="anchor" href="#went">Anchor</a>
  </section>
  <section id="picking">
    <div id="hiddenframes" style="position:fixed;left:0;top:0;visibility:hidden"></div>
    <div id="crowd" style="display:none"></div>
    <div id="shadowed"></div>
    <!-- The button FILLS the frame. A small one in the corner would leave the
         middle of the frame bare, and a check that presses the middle and
         finds the button unpressed would prove nothing at all. -->
    <iframe id="frame" style="width:200px;height:60px" srcdoc="&lt;body style=&quot;margin:0&quot;&gt;&lt;button id=&quot;inner&quot; style=&quot;width:200px;height:60px&quot; onclick=&quot;this.textContent='PRESSED'&quot;&gt;inner&lt;/button&gt;"></iframe>
    <div id="fat">fat</div>
    <div id="emoji">emoji</div>
    <div id="panel" style="width:200px;height:80px;overflow:auto;border:1px solid #ccc">
      <div style="height:800px">tall</div>
    </div>
    <div id="trap" style="display:none"></div>
    <div id="deepnest"></div>
    <dialog id="modal" style="padding:0;border:0;margin:0;width:100vw;height:100vh;max-width:100vw;max-height:100vh">
      <iframe id="modalframe" style="width:100%;height:100%;border:0" srcdoc="&lt;button id=modalbtn style=width:100%;height:300px&gt;modal&lt;/button&gt;"></iframe>
    </dialog>
    <div id="pop" popover="manual" style="padding:0;border:0;margin:0;inset:0;width:100vw;height:100vh">
      <iframe id="popframe" style="width:100%;height:100%;border:0" srcdoc="&lt;button id=popbtn style=width:100%;height:300px&gt;popover&lt;/button&gt;"></iframe>
    </div>
    <!-- Small, and placed to sit between every point the overlay samples.
         No backticks in here: this whole page is a template literal. -->
    <div id="smallpop" popover="manual" style="padding:0;border:0;margin:0;left:200px;top:150px;right:auto;bottom:auto;width:140px;height:60px">
      <iframe id="smallframe" style="width:140px;height:60px;border:0" srcdoc="&lt;body style=&quot;margin:0&quot;&gt;&lt;button id=smallbtn style=&quot;width:140px;height:60px&quot;&gt;small&lt;/button&gt;"></iframe>
    </div>
  </section>
  <section id="reach">
    <!-- The screen-reader-only recipe, as the frameworks ship it: a box by the
         geometry, nothing at all to a person, and named by the aria tree like
         any other heading. A pointer sent to its centre lands on whatever
         draws the space it sits in. -->
    <article id="post" style="position:relative;background:#eee;height:40px">
      <h2 id="sronly" style="position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">Posted by ada</h2>
      <p>post body</p>
    </article>
    <!-- The same intent written the modern way, and in the older way that
         still ships in every framework's stylesheet: a box of a real size,
         clipped away to nothing. Each is big enough to pass the size check,
         so it is the style that has to catch them. Kept apart from the one
         above, and from each other, because they fail at different checks and
         one regressing must not hide behind another. -->
    <div id="blocker" style="position:relative;background:#eee;height:40px">
      <h2 id="clipped" style="position:absolute;clip-path:inset(50%);width:120px;height:20px">Clipped heading</h2>
    </div>
    <div id="legacy" style="position:relative;background:#eee;height:40px">
      <h2 id="oldclip" style="position:absolute;clip:rect(0,0,0,0);width:120px;height:20px">Legacy clipped</h2>
    </div>
    <!-- And the one that must NOT be called erased: clipped, but not away.
         Its centre is inside what is left, so it is an ordinary click. -->
    <div id="partly" style="position:relative;height:60px">
      <button id="peeking" style="clip-path:inset(0 0 30% 0);width:120px;height:40px">Peeking</button>
    </div>
    <!-- The stretched-link pattern: a card whose ::after covers the whole
         card, over a link that is perfectly visible. A pointer at the link's
         centre lands on the
```

### Core Architecture Module: `browser-agent/src/act.ts`
```
/**
 * Acting on an element an agent named in a snapshot — the other half of
 * `__codegAgent`, and the reason refs exist at all.
 *
 * Everything here is JavaScript dispatching events at the element, which the
 * host reports as `synthetic` fidelity. A page cannot tell these apart from a
 * script of its own doing the same thing (`isTrusted` is false on all of
 * them), and there are things a synthetic event does not do that a real one
 * would: open a popup, enter fullscreen, apply `:hover`, move focus on
 * mousedown, submit a form on Enter. Where the engine's default action is the
 * whole point of the key — Enter in a form, Space on a button, Tab — this
 * emulates it, because an agent that pressed Enter meant the form to go.
 * Where it is not emulable (a popup needs user activation) the fidelity field
 * on the result is how the agent finds out.
 *
 * On a platform with a trusted-input channel the host does the pointing
 * itself: `pointAt` and `obstructionAt` still decide *where*, and the
 * platform delivers a real mouse there.
 *
 * Nothing here resolves a ref. `index.ts` does that, under the staleness
 * rules that live with the snapshot, and hands an element in.
 */

export type PointerButton = "left" | "right"

/** What an agent may do to an element. `press` alone may go without a ref
 *  (to whatever has focus); the rest name one. */
export type ActionRequest =
  | { kind: "click"; button?: PointerButton; count?: number }
  | { kind: "hover" }
  /** Replaces the field's value — the predictable meaning, and the one that
   *  does not depend on what was there. */
  | { kind: "type"; text: string; submit?: boolean }
  | { kind: "press"; key: string }
  | { kind: "select"; values: string[] }

export type ActionError =
  /** The ref no longer names anything: another document, a moved page, a
   *  removed element. Take a new snapshot. */
  | "stale"
  /** Nothing of the element is on screen to point at. Four shapes, told apart
   *  by the detail rather than by a code of their own, because the fix for
   *  two of them is to stop rather than to do something else. Those two are
   *  the screen-reader-only node the accessibility tree names and a pointer
   *  can never reach, which describes itself as *painting nothing* when its
   *  style erases it and as *parked outside the page* when a coordinate puts
   *  it past any scroll, and which says *no snapshot will change that* either
   *  way. The other two are the page as it happens to be: *not being rendered
   *  at the moment* wants whatever hides it opened and a fresh snapshot, and
   *  merely *outside the viewport* is a page that could not be scrolled to it
   *  this time. */
  | "not-visible"
  /** Another element is on top at the point a pointer would land. A user
   *  could not click this either; a dialog's backdrop is the common case.
   *  Something about the page has to change first, and can. */
  | "obscured"
  /** `type` on something that takes no text, `select` on no `<select>`. */
  | "not-editable"
  /** `select`: a value matched no option. The detail lists them. */
  | "no-option"
  /** The control is disabled: a person could not operate it either, and a
   *  dispatched event would reach its handlers anyway. */
  | "disabled"
  /** Not a request this world understands. */
  | "unsupported"

export type ActionFailure = { error: ActionError; detail: string }

/**
 * What a scroll key moved, in CSS pixels, so a caller can tell a scroll that
 * happened from one that had nowhere to go.
 *
 * An agent cannot see the page. The accessibility tree it reads back is the
 * whole document rather than the part on screen, so it looks the same before
 * and after a scroll — which makes "did that do anything?" unanswerable from
 * the outside, and is how a model ends up pressing PageDown thirty times at
 * the bottom of a page. `by` answers it, and `top` against `max` says whether
 * there is anywhere left to go.
 */
export type ScrollReport = {
  /** How far it actually moved. Negative upwards, `0` when it did not. */
  by: number
  /** Where the box is now. */
  top: number
  /** The furthest it can go: `top === max` is the end of it. */
  max: number
}

/** What a press did, when it did not fail. */
export type Pressed = { scrolled: ScrollReport | null }

/** A point in viewport CSS pixels, which is what both a dispatched event and
 *  CDP's `Input.dispatchMouseEvent` take. */
export type Point = { x: number; y: number }

// ---------------------------------------------------------------------------
// Where
// ---------------------------------------------------------------------------

/**
 * Bring the element into view and find the point a pointer would touch it.
 *
 * The centre of its largest visible box. Largest rather than bounding: an
 * inline element that wraps has a bounding box whose centre can be empty
 * space between its two lines. Clipped to the viewport before taking the
 * centre, so an element half under the fold is hit in the half that shows.
 */
export function pointAt(el: Element): Point | ActionFailure {
  // `center` rather than `nearest`: `nearest` leaves an element that is just
  // below the fold flush against the bottom edge, under whatever fixed
  // footer the page keeps there. `instant` so the rect read next is the one
  // the page will be at, not a frame of a smooth scroll.
  el.scrollIntoView?.({
    block: "center",
    inline: "center",
    behavior: "instant" as ScrollBehavior,
  })
  const box = visibleBox(el)
  if (box) return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  // Several ways to have no box worth pointing at, and they do not ask the
  // same thing of the caller — which is the whole reason this is not one
  // sentence. Two of them are the element's own doing and will still be true
  // next time; the rest are the page as it happens to be right now.
  //
  // Not being laid out at all is the second kind, and it arrives here looking
  // like the first: an element under a `display: none` has no boxes, so its
  // measurements are the same zeroes a one-pixel recipe leaves. The accordion
  // shut since the snapshot, the panel a route change collapsed — open what
  // hides it, snapshot again, and the ref works. Asked first, because the
  // size tests below cannot tell the two apart.
  //
  // "Snapshot again" is not a loop even when nothing opens it: `ai` mode
  // names only what is visible, so the next snapshot does not hand this ref
  // out again and there is nothing left to retry. The probe pins that.
  if (!isRendered(el))
    return {
      error: "not-visible",
      detail:
        `${describe(el)} is not being rendered at the moment — it, or something above it, is ` +
        `hidden (\`display: none\`, \`visibility: hidden\`). Whatever hides it has to be ` +
        `opened first; then take a new snapshot and use a ref from that one.`,
    }
  const own = largestBox(el)
  // A box a pixel across is the element's own doing and will be a pixel
  // across for ever.
  if (own.width <= 1 || own.height <= 1) return unreachable(el)
  // So is a full-sized box parked where no scroll can reach it, which is the
  // same intent written a third way. See [`isParkedOutsideTheDocument`].
  if (isParkedOutsideTheDocument(el, own)) return unreachable(el, "parked")
  // And what is left really is a state: a real box that nothing of lands in
  // the viewport is a place the page could not scroll to *this time*.
  return {
    error: "not-visible",
    detail:
      `${describe(el)} is laid out but none of it is inside the viewport, even after ` +
      `scrolling to it — something between it and the page is holding it off screen.`,
  }
}

/**
 * Whether the box is parked so far outside the document that nothing brings
 * it back.
 *
 * The third spelling of the screen-reader-only recipe, `position: absolute;
 * left: -9999px`, which no computed-style test sees: nothing about the style
 * is unusual, it is *where* the box
```

### Core Architecture Module: `browser-agent/src/index.ts`
```
/**
 * The agent-facing half of a browser tab, running in the isolated world.
 *
 * `channel.ts`'s primitive carries page state back to Rust. This bundle is the
 * other direction: Rust evaluates `__codegAgent.<fn>(...)` in the same world
 * and reads the JSON it returns. Nothing here is reachable from the page — the
 * world is separate, and the page never sees `__codegAgent`.
 *
 * Two halves: reading the page into a tree of refs (`snapshot`), and acting on
 * an element by ref (`act`, and `locate` for a host that delivers its own
 * pointer; `rectOf` for a host cropping a screenshot to one). The rules for
 * when a ref stops meaning anything live here with the snapshot that issued
 * it; `act.ts` only ever receives an element.
 *
 * The tree itself is Playwright's, vendored under `../vendor/playwright`
 * (see VENDOR.md). We call it in `ai` mode, which is the mode Playwright MCP
 * uses, so the shape an agent reads here is the shape it already knows.
 */

import {
  generateAriaTree,
  renderAriaTreeAsJSON,
} from "../vendor/playwright/injected/ariaSnapshot"
import {
  renderAriaSnapshotAsYaml,
  type AriaSnapshotYamlOptions,
} from "../vendor/playwright/isomorphic/ariaSnapshotRenderer"

import {
  clickAt,
  describe,
  hoverAt,
  isDisabledControl,
  pointAt,
  pointerReach,
  pressOn,
  selectIn,
  typeInto,
  type ActionFailure,
  type ActionRequest,
  type ScrollReport,
} from "./act"

/**
 * Identifies the world this script is running in, and with it the document.
 *
 * Playwright hands out `e1`, `e2`, … from a counter that lives in the module,
 * so a fresh document starts over at `e1`. Two pages therefore use the same
 * names for different elements, and a ref an agent read before a navigation
 * would land on whatever happens to be first in the new page — silently, and
 * on an element the agent never saw. The generation makes that answerable:
 * every snapshot reports the one it was taken in, and a request carrying an
 * older one is refused instead of resolved.
 *
 * A page cannot influence it: the script is evaluated at document start in a
 * world the page cannot reach, before any page script runs.
 */
const GENERATION = generationToken()

function generationToken(): string {
  const buf = new Uint32Array(2)
  // `getRandomValues` is available on insecure origins too — it is
  // `crypto.subtle` that is not — so a plain-http dev server takes this path
  // like anything else. The fallback is there for the engine that surprises
  // us: a predictable generation still separates one document from the next,
  // which is all this value has to do, and the page cannot read it either way.
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(buf)
  else
    for (let i = 0; i < buf.length; i++)
      buf[i] = (Math.random() * 2 ** 32) >>> 0
  return `${buf[0].toString(36)}${buf[1].toString(36)}`
}

/**
 * The elements the last snapshot named, by ref.
 *
 * Replaced wholesale on every snapshot rather than accumulated: a ref only
 * means anything against the tree it was read from, and keeping older ones
 * around would let a stale name resolve to an element still in the document.
 *
 * The elements are held strongly, which is bounded — one tree's worth, dropped
 * at the next snapshot, and the whole world dies with the document. What a
 * WeakRef would buy is not the memory but the answer for an element that has
 * since been removed from the page, and `isConnected` answers that exactly,
 * without asking for a `WeakRef` the oldest WebKit we support may not have.
 */
let refs = new Map<string, Element>()

/**
 * The names the snapshot *before* the last one handed out, and the token it
 * handed them out under — names only, no elements, so nothing here can
 * resolve to anything.
 *
 * Kept for one reason: to tell a caller that a ref it holds was unmade by its
 * own next snapshot rather than by the page moving on. See [`stale`]. Holding
 * the strings cannot make a dead ref live again, which is why it is safe to
 * keep them at all.
 */
let superseded = new Set<string>()
let supersededToken = ""

/**
 * The names the last snapshot *would* have handed out and the cap took away.
 *
 * The one thing that tells a name the caller's own `maxChars` dropped from a
 * name the page dropped, and [`stale`] cannot say the first without it: both
 * leave a name the current table does not hold, so the table alone answers
 * neither.
 *
 * Names, not elements — like [`superseded`], nothing here can resolve to
 * anything — and disjoint from `refs` by construction, since these are
 * exactly the entries deleted from it. A page-wide "was this snapshot cut"
 * flag would not do: the host caps *every* snapshot by default, so on any
 * page past the cap that flag is permanently true and says nothing about
 * this ref. A ref the page removed is never in the tree the cap cut, so it
 * can never be in here.
 */
let cutAway = new Set<string>()

/**
 * The address the last snapshot was taken at.
 *
 * The generation answers for a *new document*, which is the only kind of
 * navigation that destroys this world. It is not the only kind of navigation:
 * `pushState`, `replaceState` and a hash change all leave the document, the
 * world and this module exactly where they were while the page becomes a
 * different page. That is the ordinary case for the dev servers these tabs
 * exist to show — a route change in a single-page app — and the elements a
 * framework keeps across one, a header's buttons and its nav, are precisely
 * the ones still `isConnected` afterwards. Without this an agent could act on
 * `e8` from the page it read while looking at the page it did not.
 *
 * Compared rather than subscribed to, because there is nothing here to
 * subscribe to. See `epoch` on `SnapshotOptions`: this world structurally
 * cannot observe a page-initiated history call, so a *floor* it can check by
 * looking is worth more than a hook it cannot install.
 *
 * The direction of the error matters: this refuses some refs that would still
 * be sound, because a caller told to take a new snapshot loses a round trip,
 * while a caller handed the wrong element loses the user's page.
 */
let refsTakenAt = ""

/**
 * Two things this world *can* see move under a same-document navigation,
 * which together catch the case the address alone cannot: a route that goes
 * A → B → A.
 *
 * `history.length` grows on every `pushState`, so a page that left and came
 * back by pushing has a longer history than the snapshot saw (until the
 * engine's cap — fifty entries in Chromium — after which it stops growing;
 * a session that deep is rare and still has the address floor). `popstate`
 * and `hashchange` fire in this world like any other event, so a back and a
 * forward that land on the same address are counted even though neither the
 * address nor the length moved. What is left uncaught is a `replaceState`
 * away and back, which changes nothing observable and is its own kind of
 * rare.
 *
 * Together with the host's epoch this is what makes acting on a ref safe
 * enough to do: the cost of a stale one here is a click on the wrong thing,
 * not a confusing tree.
 */
let refsHistoryLength = 0
let refsNavTicks = 0
let navTicks = 0
addEventListener("popstate", () => void navTicks++)
addEventListener("hashchange", () => void navTicks++)

/**
 * The Navigation API's id for the current history entry, where the engine
 * has one (Chromium, and WebKit from Safari 26). It is minted anew for every
 * same-document navigation — `pushState`, `replaceState`, back, forward —
 * regardless of where the history length or the address end up, which closes
 * the two cases the floors above leave open: a length pinned at the engine's
 * cap, and a `replaceState` away and back. `null` where the API is absent,
 * and then those two stay as documented.
 */
function navigationEntryId(): string | null {
  const nav = (
    globalThis as { navigation?: { currentEntry?: { id?: string } } }
  ).na
```

### Core Architecture Module: `eslint.config.mjs`
```
import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import eslintConfigPrettier from "eslint-config-prettier"
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"

/**
 * `target="_blank"` on a raw anchor is a trap: it opens a tab in the browser
 * (web mode, `next dev`) and does NOTHING in the desktop webview, which
 * registers no new-window handler. The bug is invisible until someone runs the
 * packaged app. `<BrowserLink>` keeps the attribute AND routes the click
 * through the platform opener; it is the only place allowed to write one.
 */
const BLANK_TARGET_MESSAGE =
  'A bare <a target="_blank"> is dead in the desktop webview. Use <BrowserLink> from @/components/ui/browser-link.'

const noRawBlankTarget = {
  selector:
    "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='target'][value.value='_blank']",
  message: BLANK_TARGET_MESSAGE,
}

/** The same attribute written as an expression — `target={"_blank"}`. */
const noRawBlankTargetExpression = {
  selector:
    "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='target'] > JSXExpressionContainer > Literal[value='_blank']",
  message: BLANK_TARGET_MESSAGE,
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src-tauri/target/**",
    "src-tauri/experts/**",
    "public/vs/**",
    // Gitignored scratch space for planning/review docs and one-off probe
    // scripts. Prettier already skips it — its `--ignore-path` defaults to
    // `.gitignore` — but flat config has no such default, so without this
    // `pnpm eslint .` fails the repo on files that are not in the repo.
    ".docs/**",
    // Playwright's aria tree, vendored byte-for-byte so that updating it is a
    // copy rather than a merge (browser-agent/vendor/playwright/VENDOR.md).
    // It is written against Playwright's lint and compiler settings, not ours.
    "browser-agent/vendor/**",
    // esbuild's output, committed so a cargo build needs no node.
    "src-tauri/src/browser/js/**",
  ]),
  eslintConfigPrettier,
  eslintPluginPrettierRecommended,
  {
    rules: {
      "prettier/prettier": "error",
      "no-restricted-syntax": [
        "error",
        noRawBlankTarget,
        noRawBlankTargetExpression,
      ],
    },
  },
  {
    // Conversation render path: the aggregate workspace hook subscribes to
    // the high-frequency fileTabs slice, so any consumer here would
    // re-render on every keystroke / watcher reload in the file editor.
    // Use the narrow slice hooks instead.
    files: [
      "src/components/chat/**",
      "src/components/message/**",
      "src/components/ai-elements/**",
      "src/components/conversations/**",
    ],
    rules: {
      // Flat config REPLACES a rule's options rather than merging them, so
      // this block has to restate every restriction that applies here — drop
      // the blank-target pair and these four directories silently lose it.
      "no-restricted-syntax": [
        "error",
        noRawBlankTarget,
        noRawBlankTargetExpression,
        {
          selector: "CallExpression[callee.name='useWorkspaceContext']",
          message:
            "Hot path: use useWorkspaceActions / useWorkspaceView / useWorkspaceFileTabs instead of the aggregate useWorkspaceContext (it re-renders on every fileTabs change).",
        },
      ],
    },
  },
  {
    // The one anchor that is allowed to ask for a new window — it pairs the
    // attribute with the opener call that actually delivers one.
    files: ["src/components/ui/browser-link.tsx"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
])

export default eslintConfig

```

### Core Architecture Module: `next.config.ts`
```
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const isProd = process.env.NODE_ENV === "production"
const internalHost = process.env.TAURI_DEV_HOST || "localhost"
const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
  experimental: {
    messages: {
      path: "./src/i18n/messages",
      format: "json",
      locales: [
        "en",
        "zh-CN",
        "zh-TW",
        "ja",
        "ko",
        "es",
        "de",
        "fr",
        "pt",
        "ar",
      ],
      precompile: true,
    },
  },
})

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
}

export default withNextIntl(nextConfig)

```

### Core Architecture Module: `postcss.config.mjs`
```
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}

export default config

```

### Core Architecture Module: `src-tauri/experts/skills/brainstorming/scripts/helper.js`
```
(function() {
  const MIN_RECONNECT_MS = 500;
  const MAX_RECONNECT_MS = 30000;
  const TOMBSTONE_AFTER_MS = 15000; // show the "paused" overlay after this long disconnected

  // Pure: next backoff delay (doubles, capped). Exported for unit tests.
  function nextReconnectDelay(current, max) {
    return Math.min(current * 2, max);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { nextReconnectDelay, MIN_RECONNECT_MS, MAX_RECONNECT_MS, TOMBSTONE_AFTER_MS };
  }

  // Everything below is browser-only; bail out when loaded in Node (tests).
  if (typeof window === 'undefined') return;

  let ws = null;
  let eventQueue = [];
  let reconnectDelay = MIN_RECONNECT_MS;
  let reconnectTimer = null;
  let disconnectedSince = null;
  let everConnected = false;
  let tombstoneShown = false;

  function sessionKey() {
    try {
      return window.sessionStorage && window.sessionStorage.getItem('brainstorm-session-key');
    } catch (e) {}
    return null;
  }

  function websocketUrl() {
    const key = sessionKey();
    return 'ws://' + window.location.host + (key ? '/?key=' + encodeURIComponent(key) : '');
  }

  function reloadAfterRecovery() {
    const key = sessionKey();
    if (key) {
      window.location.replace('/?key=' + encodeURIComponent(key));
    } else {
      window.location.reload();
    }
  }

  // Reflect connection state in the frame's status pill (absent on full-doc screens).
  function setStatus(state) {
    const el = document.querySelector('.status');
    if (!el) return;
    const map = {
      connecting:   ['Connecting…',   'var(--text-tertiary)'],
      connected:    ['Connected',     'var(--success)'],
      reconnecting: ['Reconnecting…', 'var(--warning)'],
      disconnected: ['Disconnected',  'var(--error)']
    };
    const [text, color] = map[state] || map.disconnected;
    el.textContent = text;
    el.style.setProperty('--status-color', color);
  }

  // Self-styled so it works on framed and full-document screens alike.
  function showTombstone() {
    if (tombstoneShown) return;
    tombstoneShown = true;
    const el = document.createElement('div');
    el.id = 'bs-tombstone';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;' +
      'align-items:center;justify-content:center;padding:2rem;text-align:center;' +
      'background:rgba(20,20,22,0.92);color:#f5f5f7;font-family:system-ui,sans-serif';
    el.innerHTML = '<div style="max-width:480px">' +
      '<h2 style="margin:0 0 .5rem;font-weight:600">Companion paused</h2>' +
      '<p style="margin:0;opacity:.85">This brainstorm companion has stopped. ' +
      'Ask your coding agent to bring it back — this page reconnects automatically.</p></div>';
    if (document.body) document.body.appendChild(el);
  }

  function connect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    setStatus(everConnected ? 'reconnecting' : 'connecting');
    ws = new WebSocket(websocketUrl());

    ws.onopen = () => {
      const recovered = tombstoneShown;
      everConnected = true;
      disconnectedSince = null;
      reconnectDelay = MIN_RECONNECT_MS;
      tombstoneShown = false;
      setStatus('connected');
      eventQueue.forEach(e => ws.send(JSON.stringify(e)));
      eventQueue = [];
      // Recovered from a tombstoned outage (e.g. the server restarted on the same
      // port) — reload through the keyed bootstrap when possible so the cookie is
      // refreshed before the visible URL returns to bare /.
      if (recovered) reloadAfterRecovery();
    };

    ws.onmessage = (msg) => {
      let data;
      try { data = JSON.parse(msg.data); } catch (e) { return; }
      if (data.type === 'reload') window.location.reload();
    };

    ws.onclose = () => {
      ws = null;
      if (disconnectedSince === null) disconnectedSince = Date.now();
      if (Date.now() - disconnectedSince >= TOMBSTONE_AFTER_MS) {
        setStatus('disconnected');
        showTombstone();
      } else {
        setStatus('reconnecting');
      }
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = nextReconnectDelay(reconnectDelay, MAX_RECONNECT_MS);
    };

    // Let onclose own reconnection so we don't schedule it twice.
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }

  function sendEvent(event) {
    event.timestamp = Date.now();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    } else {
      eventQueue.push(event);
    }
  }

  // Capture clicks on choice elements
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-choice]');
    if (!target) return;

    sendEvent({
      type: 'click',
      text: target.textContent.trim(),
      choice: target.dataset.choice,
      id: target.id || null
    });

  });

  // Frame UI: selection tracking
  window.selectedChoice = null;

  window.toggleSelect = function(el) {
    const container = el.closest('.options') || el.closest('.cards');
    const multi = container && container.dataset.multiselect !== undefined;
    if (container && !multi) {
      container.querySelectorAll('.option, .card').forEach(o => o.classList.remove('selected'));
    }
    if (multi) {
      el.classList.toggle('selected');
    } else {
      el.classList.add('selected');
    }
    window.selectedChoice = el.dataset.choice;
  };

  // Expose API for explicit use
  window.brainstorm = {
    send: sendEvent,
    choice: (value, metadata = {}) => sendEvent({ type: 'choice', value, ...metadata })
  };

  connect();
})();

```

### Core Architecture Module: `src-tauri/experts/skills/systematic-debugging/condition-based-waiting-example.ts`
```
// Complete implementation of condition-based waiting utilities
// From: Lace test infrastructure improvements (2025-10-03)
// Context: Fixed 15 flaky tests by replacing arbitrary timeouts

import type { ThreadManager } from '~/threads/thread-manager';
import type { LaceEvent, LaceEventType } from '~/threads/types';

/**
 * Wait for a specific event type to appear in thread
 *
 * @param threadManager - The thread manager to query
 * @param threadId - Thread to check for events
 * @param eventType - Type of event to wait for
 * @param timeoutMs - Maximum time to wait (default 5000ms)
 * @returns Promise resolving to the first matching event
 *
 * Example:
 *   await waitForEvent(threadManager, agentThreadId, 'TOOL_RESULT');
 */
export function waitForEvent(
  threadManager: ThreadManager,
  threadId: string,
  eventType: LaceEventType,
  timeoutMs = 5000
): Promise<LaceEvent> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const events = threadManager.getEvents(threadId);
      const event = events.find((e) => e.type === eventType);

      if (event) {
        resolve(event);
      } else if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timeout waiting for ${eventType} event after ${timeoutMs}ms`));
      } else {
        setTimeout(check, 10); // Poll every 10ms for efficiency
      }
    };

    check();
  });
}

/**
 * Wait for a specific number of events of a given type
 *
 * @param threadManager - The thread manager to query
 * @param threadId - Thread to check for events
 * @param eventType - Type of event to wait for
 * @param count - Number of events to wait for
 * @param timeoutMs - Maximum time to wait (default 5000ms)
 * @returns Promise resolving to all matching events once count is reached
 *
 * Example:
 *   // Wait for 2 AGENT_MESSAGE events (initial response + continuation)
 *   await waitForEventCount(threadManager, agentThreadId, 'AGENT_MESSAGE', 2);
 */
export function waitForEventCount(
  threadManager: ThreadManager,
  threadId: string,
  eventType: LaceEventType,
  count: number,
  timeoutMs = 5000
): Promise<LaceEvent[]> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const events = threadManager.getEvents(threadId);
      const matchingEvents = events.filter((e) => e.type === eventType);

      if (matchingEvents.length >= count) {
        resolve(matchingEvents);
      } else if (Date.now() - startTime > timeoutMs) {
        reject(
          new Error(
            `Timeout waiting for ${count} ${eventType} events after ${timeoutMs}ms (got ${matchingEvents.length})`
          )
        );
      } else {
        setTimeout(check, 10);
      }
    };

    check();
  });
}

/**
 * Wait for an event matching a custom predicate
 * Useful when you need to check event data, not just type
 *
 * @param threadManager - The thread manager to query
 * @param threadId - Thread to check for events
 * @param predicate - Function that returns true when event matches
 * @param description - Human-readable description for error messages
 * @param timeoutMs - Maximum time to wait (default 5000ms)
 * @returns Promise resolving to the first matching event
 *
 * Example:
 *   // Wait for TOOL_RESULT with specific ID
 *   await waitForEventMatch(
 *     threadManager,
 *     agentThreadId,
 *     (e) => e.type === 'TOOL_RESULT' && e.data.id === 'call_123',
 *     'TOOL_RESULT with id=call_123'
 *   );
 */
export function waitForEventMatch(
  threadManager: ThreadManager,
  threadId: string,
  predicate: (event: LaceEvent) => boolean,
  description: string,
  timeoutMs = 5000
): Promise<LaceEvent> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const events = threadManager.getEvents(threadId);
      const event = events.find(predicate);

      if (event) {
        resolve(event);
      } else if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timeout waiting for ${description} after ${timeoutMs}ms`));
      } else {
        setTimeout(check, 10);
      }
    };

    check();
  });
}

// Usage example from actual debugging session:
//
// BEFORE (flaky):
// ---------------
// const messagePromise = agent.sendMessage('Execute tools');
// await new Promise(r => setTimeout(r, 300)); // Hope tools start in 300ms
// agent.abort();
// await messagePromise;
// await new Promise(r => setTimeout(r, 50));  // Hope results arrive in 50ms
// expect(toolResults.length).toBe(2);         // Fails randomly
//
// AFTER (reliable):
// ----------------
// const messagePromise = agent.sendMessage('Execute tools');
// await waitForEventCount(threadManager, threadId, 'TOOL_CALL', 2); // Wait for tools to start
// agent.abort();
// await messagePromise;
// await waitForEventCount(threadManager, threadId, 'TOOL_RESULT', 2); // Wait for results
// expect(toolResults.length).toBe(2); // Always succeeds
//
// Result: 60% pass rate → 100%, 40% faster execution

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #518** (2026-08-22): **@ mention: CJK IME — `@美` finds file, `@美术` returns empty**
  *Symptoms*: ## Bug Composer `@` file search works for one CJK character and dies after the second.  ## Repro 1. Windows + Chinese IME 2. Type `@美` → `docs/design/汇总/美术资源清单.md` appears 3. Continue typing `术` so the query is `@美术` → File group is empty  ASCII paths such as `@docs` still work.  ## Expected `@美术` should still match `美术资源清单.md` (substring of the filename).  ## Likely cause TipTap mention uses `allow: !editor.view.composing` and only reads `nodeBefore` text. The second IME-committed character either becomes query `美shu` during composition, or splits into a new text node without `@`.  ## Env - Codeg desktop (Windows) - Chinese IME 
  **Post-Mortem & Fix Analysis**:
  > 已修复

- **Issue #507** (2026-09-19): **macos系统下全屏点击关闭没有正确关闭**
  *Symptoms*: <img width="2940" height="1912" alt="Image" src="https://github.com/user-attachments/assets/029a20ac-1325-4780-b742-cf3a6f4ffb69" /> 全屏状态下点击关闭会留着黑色的空白和工具栏

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

### Incident Patch 1: `054f7836` (2026-09-30)
**Commit Message**: Merge pull request #865 from Flyneen/fix/mobile-composer-autofocus-on-tab-switch

fix(chat): keep the soft keyboard closed when a session becomes active on touch

**File**: `src/components/chat/message-input.test.tsx` (modified, +142/-1)
```diff
@@ -12,7 +12,7 @@ import { NextIntlClientProvider } from "next-intl"
 import { toast } from "sonner"
 import type { ComponentProps } from "react"
 import type { Editor } from "@tiptap/core"
-import { afterEach, describe, expect, it, vi } from "vitest"
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
 
 import type { RichComposerHandle } from "./composer/rich-composer"
 import {
@@ -22,6 +22,7 @@ import {
 import {
   clearMessageInputDraftV2,
   loadMessageInputDraftV2,
+  saveMessageInputDraftV2,
 } from "@/lib/message-input-draft"
 import {
   emitAttachFileToSession,
@@ -327,6 +328,146 @@ describe("MessageInput (RichComposer integration)", () => {
     expect(document.activeElement).not.toBe(editor)
   })
 
+  // Switching a session is most often a read — you glance at another
+  // conversation's progress. The tab-activation auto-focus fires on every such
+  // switch, and on a phone focusing the editor raises the soft keyboard over the
+  // transcript. A coarse pointer therefore keeps the caret (and the keyboard)
+  // out until the user taps the composer, which focuses it as usual. A fine
+  // pointer is the mouse-driven behaviour the gate must not change: activating
+  // a tab still puts the caret in the composer, no keyboard in the picture.
+  //
+  // Both pointer kinds wait the same frames and then assert, so the fine side
+  // proves the wait covers the whole focus hand-off and the coarse side cannot
+  // pass by looking too early. A seeded draft makes readiness visible: the
+  // render that flips the composer ready schedules the draft restore and the
+  // auto-focus in that order, so once the draft is on screen the auto-focus
+  // frame has run. Tiptap's `focus` command then lands the DOM focus a frame
+  // later still (in jsdom; on iOS, Android and Safari it also focuses at once).
+  describe("tab-activation auto-focus", () => {
+    const draftKey = "test:tab-activation-focus"
+    // The browser's answer to the primary-pointer query. Every other query
+    // keeps the setup's desktop answer. `setPointer` changes it mid-session the
+    // way docking a 2-in-1 does, telling whoever listens.
+    let pointerCoarse = false
+    const pointerListeners = new Set<() => void>()
+    function setPointer(coarse: boolean) {
+      pointerCoarse = coarse
+      pointerListeners.forEach((listener) => listener())
+    }
+    beforeEach(() => {
+      const desktop = window.matchMedia
+      vi.spyOn(window, "matchMedia").mockImplementation((query) =>
+        query === "(pointer: coarse)"
+          ? ({
+              media: query,
+              get matches() {
+                return pointerCoarse
+              },
+              addEventListener: (_type: string, listener: () => void) =>
+                pointerListeners.add(listener),
+              removeEventListener: (_type: string, listener: () => void) =>
+                pointerListeners.delete(listener),
+            } as unknown as MediaQueryList)
+          : desktop(query)
+      )
+    })
+    afterEach(() => {
+      vi.mocked(window.matchMedia).mockRestore()
+      pointerListeners.clear()
+      pointerCoarse = false
+      clearMessageInputDraftV2(draftKey)
+    })
+
+    const composer = (isActive: boolean) => (
+      <NextIntlClientProvider locale="en" messages={enMessages}>
+        <MessageInput
+          onSend={vi.fn()}
+          promptCapabilities={CAPS}
+          draftStorageKey={draftKey}
+          isActive={isActive}
+        />
+      </NextIntlClientProvider>
+    )
+    const nextFrame = () =>
+      act(async () => {
+        await new Promise((resolve) =>
+          requestAnimationFrame(() => resolve(null))
+        )
+      })
+    async function mountReady(isActive: boolean, coarse: boolean) {
+      setPointer(coarse)
+      saveMessageInputDraftV2(draftKey, {
+        type: "doc",
+        content: [
+          { type: "paragraph", content: [{ type: "text", text: "draft" }] },
+        ],
+      }
```

**File**: `src/components/chat/message-input.tsx` (modified, +20/-5)
```diff
@@ -103,6 +103,7 @@ import {
   type ModelOptionGroup,
 } from "@/lib/model-config-groups"
 import { useAgentSkills } from "@/hooks/use-agent-skills"
+import { isPrimaryPointerCoarse } from "@/hooks/use-is-coarse-pointer"
 import { useScrollbarSafeDismiss } from "@/hooks/use-scrollbar-safe-dismiss"
 import { useAgentVocabulary } from "@/hooks/use-agent-vocabulary"
 import {
@@ -686,12 +687,26 @@ export function MessageInput({
   // editor a tick after mount (mirrors the hydration effect's gate). Ordered
   // after that hydration effect so this rAF runs after its setContent, landing
   // the caret at the end of a restored draft rather than before it.
+  //
+  // Skipped on a coarse pointer, where focusing the editor raises the soft
+  // keyboard over the transcript. Each trigger here is a moment the user is
+  // more likely reading than typing: a session opening, a switch to one, a turn
+  // ending. Tapping the composer still focuses it (natively in the text, the
+  // chrome-press handler in the padding), so the keyboard comes up on demand.
+  // The pointer kind is read when the focus would happen, not subscribed to.
+  // Every open tab keeps its composer mounted, so a subscription would cost
+  // each one a listener and a re-render on every pointer change. As a
+  // dependency here it would also focus an idle composer when the pointer turns
+  // fine (a 2-in-1 docking to its mouse).
   useEffect(() => {
-    if (isActive && composerReady && !isPrompting) {
-      requestAnimationFrame(() => {
-        editorRef.current?.focus()
-      })
-    }
+    if (!isActive || !composerReady || isPrompting) return
+    if (isPrimaryPointerCoarse()) return
+    const raf = requestAnimationFrame(() => {
+      editorRef.current?.focus()
+    })
+    // Dropped if the tab goes inactive or a turn starts before the frame runs.
+    // A tiled group keeps that composer on screen, where it would take the caret.
+    return () => cancelAnimationFrame(raf)
   }, [isActive, composerReady, isPrompting])
 
   // Re-hydrate when the user (re)edits a *different* queue item after the
```

**File**: `src/hooks/use-is-coarse-pointer.ts` (modified, +14/-1)
```diff
@@ -2,11 +2,24 @@
 
 import { useEffect, useState } from "react"
 
+// The primary pointer is a finger (a phone, a tablet), not a mouse or trackpad.
+const COARSE_POINTER_QUERY = "(pointer: coarse)"
+
+/**
+ * Whether the primary pointer is coarse right now. For a decision taken at one
+ * moment, such as whether an automatic focus may raise the soft keyboard, where
+ * `useIsCoarsePointer` would give every caller a listener and a re-render on
+ * each pointer change for a value nothing is drawn from.
+ */
+export function isPrimaryPointerCoarse(): boolean {
+  return window.matchMedia(COARSE_POINTER_QUERY).matches
+}
+
 export function useIsCoarsePointer() {
   const [isCoarsePointer, setIsCoarsePointer] = useState(false)
 
   useEffect(() => {
-    const query = window.matchMedia("(pointer: coarse)")
+    const query = window.matchMedia(COARSE_POINTER_QUERY)
     const update = () => setIsCoarsePointer(query.matches)
 
     update()
```

---

### Incident Patch 2: `d60820c9` (2026-09-30)
**Commit Message**: fix(tasks): save the agent the task editor shows when nothing inherits it

An untouched agent pill saved the task as inheriting (agent_type null)
whatever it showed. With no agent in task settings and no folder
default, as on a fresh install, the task was stored without an agent
and failed to launch with "no agent configured". With the inherited
agent disabled, the pill showed a substitute the task would not run.

The pill now inherits only while it shows the agent that inheriting
launches. Otherwise the shown agent is saved with the task, and the
hint under the pill says which case applies, in all ten locales. A
substitute starts from its own mode and options, and templates keep
inheriting an untouched agent.

Fixes #864.

**File**: `src/components/tasks/task-editor-dialog.agent.test.tsx` (added, +453/-0)
```diff
@@ -0,0 +1,453 @@
+import { render, screen, waitFor } from "@testing-library/react"
+import userEvent from "@testing-library/user-event"
+import { NextIntlClientProvider } from "next-intl"
+import { beforeEach, describe, expect, it, vi } from "vitest"
+import enMessages from "@/i18n/messages/en.json"
+import type { workTaskTemplateSave } from "@/lib/api"
+import type {
+  AcpAgentInfo,
+  AgentType,
+  WorkTask,
+  WorkTaskDraft,
+} from "@/lib/types"
+
+// What the launch would resolve for an agent-less task, layer by layer: the
+// effective task settings' agent (with their mode and options), then the
+// folder's own default agent.
+const inheritance = vi.hoisted(() => ({
+  settingsAgent: null as string | null,
+  settingsModeId: null as string | null,
+  settingsConfig: {} as Record<string, string>,
+  folderDefault: null as string | null,
+}))
+const templateSave = vi.hoisted(() => vi.fn())
+
+vi.mock("@/lib/api", () => ({
+  gitListAllBranches: () =>
+    Promise.resolve({
+      local: ["main"],
+      remote: [],
+      worktree_branches: [],
+      main_worktree_branch: null,
+    }),
+  getGitBranch: () => Promise.resolve("main"),
+  workTaskSettingsEffective: () =>
+    Promise.resolve({
+      default_agent_type: inheritance.settingsAgent,
+      mode_id: inheritance.settingsModeId,
+      config_values: inheritance.settingsConfig,
+      auto_process: false,
+      max_concurrent: 2,
+      merge_strategy: "squash",
+      auto_merge: false,
+      delete_worktree_default: true,
+      auto_compact_percent: 0,
+    }),
+  workTaskTemplateList: () => Promise.resolve([]),
+  workTaskTemplateSave: (...args: unknown[]) => templateSave(...args),
+  workTaskTemplateDelete: () => Promise.resolve(undefined),
+}))
+
+// The REAL agent selector, fed a registry: what it highlights on its own is
+// the thing under test.
+vi.mock("@/hooks/use-acp-agents", () => ({
+  useAcpAgents: vi.fn(),
+}))
+
+vi.mock("@/components/automations/agent-config-section", () => ({
+  AgentConfigSection: () => <div data-testid="agent-config" />,
+  effectiveSelections: (
+    _snapshot: unknown,
+    modeId: string | null,
+    configValues: Record<string, string>
+  ) => ({ mode_id: modeId, config_values: configValues }),
+  snapshotLabels: () => ({}),
+}))
+vi.mock("@/components/automations/use-agent-options", () => ({
+  useAgentOptions: (agentType: string) => ({
+    snapshot: null,
+    snapshotAgentType: agentType,
+    loading: false,
+    error: null,
+    reload: vi.fn(),
+    ensure: () => Promise.resolve(null),
+  }),
+}))
+
+// The real composer is a Tiptap editor; the editor dialog only reads text and
+// prompt blocks back off its handle.
+vi.mock("./task-message-composer", async () => {
+  const { forwardRef, useImperativeHandle, useState } = await import("react")
+  type StubProps = {
+    defaultText?: string
+    ariaLabel?: string
+    onChange?: (text: string) => void
+  }
+  return {
+    TaskMessageComposer: forwardRef(function Stub(
+      props: StubProps,
+      ref: React.Ref<unknown>
+    ) {
+      const [text, setText] = useState(props.defaultText ?? "")
+      useImperativeHandle(
+        ref,
+        () => ({
+          getText: () => text,
+          getPromptBlocks: () => [{ type: "text", text }],
+          hasAttachments: () => false,
+          hasUploadingImage: () => false,
+          focus: () => {},
+        }),
+        [text]
+      )
+      return (
+        <textarea
+          aria-label={props.ariaLabel}
+          value={text}
+          onChange={(e) => {
+            setText(e.target.value)
+            props.onChange?.(e.target.value)
+          }}
+        />
+      )
+    }),
+  }
+})
+
+vi.mock("@/stores/app-workspace-store", () => {
+  const state = {
+    get folders() {
+      return [
+        {
+          id: 1,
+          name: "proj",
+          alias: null,
+          parent_id: null,
+          kind: "regular",
+          path: "/tmp/proj",
+          default_agent_type: inheritanc
```

**File**: `src/components/tasks/task-editor-dialog.tsx` (modified, +58/-14)
```diff
@@ -138,6 +138,17 @@ function TaskEditorBody({
   const [agentType, setAgentType] = useState<AgentType>(
     task?.config?.agent_type ?? "claude_code"
   )
+  // What an agent-less task launches with in this folder, resolved the way the
+  // engine does it: the effective task settings' agent, else the folder's
+  // default agent — `null` when neither names one. Keyed by folder, so the
+  // answer for a previous folder never stands in for the current one's.
+  const [inherited, setInherited] = useState<{
+    folderId: number
+    agent: AgentType | null
+  } | null>(null)
+  // Whether the selector shows any agent as picked: with none enabled and
+  // available here it shows none.
+  const [agentShown, setAgentShown] = useState(false)
   const [modeId, setModeId] = useState<string | null>(
     task?.config?.mode_id ?? null
   )
@@ -194,9 +205,11 @@ function TaskEditorBody({
     workTaskSettingsEffective(folderId)
       .then((s) => {
         if (cancelled) return
-        setAgentType(
-          s.default_agent_type ?? folderDefaultAgent ?? "claude_code"
-        )
+        const agent = s.default_agent_type ?? folderDefaultAgent ?? null
+        setInherited({ folderId, agent })
+        // Nothing to inherit: a placeholder, which a save keeps rather than
+        // inherits (see `pinsShownAgent`).
+        setAgentType(agent ?? "claude_code")
         setModeId(s.mode_id ?? null)
         setConfigValues(s.config_values ?? {})
       })
@@ -221,9 +234,31 @@ function TaskEditorBody({
 
   const agentOptions = useAgentOptions(agentType, folderPath, true)
 
+  // An untouched pill is saved as "inherit" only while it shows the agent that
+  // inheriting launches. It can show another: the placeholder when nothing is
+  // configured to inherit, or the selector's own substitute when the inherited
+  // agent is disabled or unavailable here. Inheriting would then launch an
+  // agent other than the one on screen, or none at all ("no agent
+  // configured"), so the agent on screen is saved with the task instead. Until
+  // this folder's settings have answered, the pill inherits as it always has.
+  const pinsShownAgent =
+    !agentDirty &&
+    agentShown &&
+    inherited != null &&
+    inherited.folderId === folderId &&
+    inherited.agent !== agentType
+  const agentHint = !pinsShownAgent
+    ? t("agentInheritedHint")
+    : inherited?.agent == null
+      ? t("agentNoDefaultHint")
+      : t("agentInheritedUnavailableHint", {
+          agent: getAgentLabel(inherited.agent),
+        })
+
   // The captured composer + agent state as a `WorkTaskConfig` — the shared
-  // payload of both the task draft and a saved template.
-  const buildConfig = async (): Promise<WorkTaskConfig> => {
+  // payload of both the task draft and a saved template. Without `ownAgent`
+  // the config inherits its agent, mode and options.
+  const buildConfig = async (ownAgent: boolean): Promise<WorkTaskConfig> => {
     const displayText = (composerRef.current?.getText() ?? prompt).trim()
     // Prose + inline references + attached images, exactly as a chat send
     // composes them; the engine replays these blocks when the task launches.
@@ -233,7 +268,7 @@ function TaskEditorBody({
     // Explicitly null rather than absent when nothing is picked: clearing the
     // choice has to travel, and the save replaces the stored config wholesale.
     const base_branch = baseBranch.trim() || null
-    if (!agentDirty) {
+    if (!ownAgent) {
       return {
         prompt_blocks: blocks,
         display_text: displayText,
@@ -282,7 +317,7 @@ function TaskEditorBody({
       const draft: WorkTaskDraft = {
         folder_id: folderId,
         title: title.trim(),
-        config: await buildConfig(),
+        config: await buildConfig(agentDirty || pinsShownAgent),
       }
       await onSubmit(draft)
     } catch (e) {
@@ -333,8 +368,10 @@ function TaskEditorBody({
     try {
       // A blueprint is global — the folder is picked at 
```

**File**: `src/i18n/messages/ar.json` (modified, +2/-0)
```diff
@@ -5484,6 +5484,8 @@
     "baseBranchDefault": "الفرع الحالي عند بدء المهمة",
     "baseBranchHint": "تتفرّع المهمة من هذا الفرع، ويعيدها الدمج إليه.",
     "agentInheritedHint": "موروث من إعدادات المهام — عدِّله ليصبح خاصًا بهذه المهمة",
+    "agentNoDefaultHint": "لا يوجد وكيل افتراضي في إعدادات المهام — سيُحفَظ الوكيل المحدد مع هذه المهمة",
+    "agentInheritedUnavailableHint": "الوكيل {agent} من إعدادات المهام غير متاح — سيُحفَظ الوكيل المحدد مع هذه المهمة",
     "agentOverrideReset": "العودة إلى الوراثة",
     "sectionTarget": "الهدف",
     "errorTitle": "العنوان مطلوب",
```

**File**: `src/i18n/messages/de.json` (modified, +2/-0)
```diff
@@ -5484,6 +5484,8 @@
     "baseBranchDefault": "Aktueller Branch beim Start der Aufgabe",
     "baseBranchHint": "Die Aufgabe zweigt von diesem Branch ab und wird beim Mergen wieder dorthin übernommen.",
     "agentInheritedHint": "Aus den Aufgaben-Einstellungen geerbt — Änderungen gelten nur für diese Aufgabe",
+    "agentNoDefaultHint": "Kein Standard-Agent in den Aufgaben-Einstellungen — der ausgewählte Agent wird mit der Aufgabe gespeichert",
+    "agentInheritedUnavailableHint": "{agent} aus den Aufgaben-Einstellungen ist nicht verfügbar — der ausgewählte Agent wird mit der Aufgabe gespeichert",
     "agentOverrideReset": "Wieder erben",
     "sectionTarget": "Ziel",
     "errorTitle": "Titel ist erforderlich",
```

**File**: `src/i18n/messages/en.json` (modified, +2/-0)
```diff
@@ -5484,6 +5484,8 @@
     "baseBranchDefault": "Current branch when the task starts",
     "baseBranchHint": "The task branches from here, and merging lands it back on this branch.",
     "agentInheritedHint": "Inherited from task settings — change it to override for this task",
+    "agentNoDefaultHint": "No default agent in task settings — the selected agent will be saved with the task",
+    "agentInheritedUnavailableHint": "{agent} from task settings isn't available — the selected agent will be saved with the task",
     "agentOverrideReset": "Reset to inherited",
     "sectionTarget": "Target",
     "errorTitle": "Title is required",
```

---

### Incident Patch 3: `d93f359b` (2026-09-30)
**Commit Message**: fix(chat): keep the soft keyboard closed when a session becomes active on touch

Switching to another session pops the soft keyboard over the transcript on a
phone. `MessageInput` auto-focuses the composer whenever its tab becomes
active, and focusing a contenteditable raises the keyboard — so a switch that
was meant to read another session's progress hides it instead, and the keyboard
has to be dismissed by hand.

Skip that auto-focus when the primary pointer is coarse, using the same
`useIsCoarsePointer` signal the tab bar already uses for touch-only behaviour.
Tapping the composer still focuses it exactly as before — natively inside the
text, through the chrome-press handler in the padding — so the keyboard comes up
on demand rather than on tab activation. A fine pointer keeps the current
behaviour: opening a tab still lands the caret in the composer.

Covered by two cases in message-input.test.tsx: a coarse pointer leaves the
composer unfocused when the tab becomes active, a fine pointer still focuses it.

Validation: eslint clean, tsc --noEmit clean, full vitest suite green
(538 files / 8019 tests).

**File**: `src/components/chat/message-input.test.tsx` (modified, +44/-1)
```diff
@@ -97,6 +97,13 @@ vi.mock("@/components/chat/conversation-context-bar", () => ({
 vi.mock("./composer-context-usage", () => ({
   ComposerContextUsage: () => null,
 }))
+// Pointer kind drives whether focusing the composer raises a soft keyboard.
+// Defaults to a mouse-driven device (the desktop behaviour every other test
+// asserts around); the keyboard tests below flip it to a touch-first one.
+const coarsePointer = vi.hoisted(() => vi.fn(() => false))
+vi.mock("@/hooks/use-is-coarse-pointer", () => ({
+  useIsCoarsePointer: coarsePointer,
+}))
 vi.mock("./composer-connection-status", () => ({
   ComposerConnectionStatus: () => null,
 }))
@@ -248,7 +255,10 @@ function renderInput(
 }
 
 describe("MessageInput (RichComposer integration)", () => {
-  afterEach(() => cleanup())
+  afterEach(() => {
+    cleanup()
+    coarsePointer.mockReturnValue(false)
+  })
 
   it("mounts and renders the rich-text composer surface", async () => {
     const { container } = renderInput({})
@@ -327,6 +337,39 @@ describe("MessageInput (RichComposer integration)", () => {
     expect(document.activeElement).not.toBe(editor)
   })
 
+  // Switching a session is most often a read — you glance at another
+  // conversation's progress. The tab-activation auto-focus fires on every such
+  // switch, and on a phone focusing the editor raises the soft keyboard over the
+  // transcript. A coarse pointer therefore keeps the caret (and the keyboard)
+  // out until the user taps the composer, which focuses it as usual.
+  it("leaves the composer unfocused when a tab becomes active on a coarse pointer", async () => {
+    coarsePointer.mockReturnValue(true)
+    const { container } = renderInput({ isActive: true })
+    await waitFor(() =>
+      expect(container.querySelector('[role="textbox"]')).not.toBeNull()
+    )
+    const editor = container.querySelector('[role="textbox"]') as HTMLElement
+
+    // Let the auto-focus effect's frame (and the editor's own follow-up) run
+    // before asserting nothing claimed focus.
+    await act(async () => {
+      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
+    })
+    expect(document.activeElement).not.toBe(editor)
+  })
+
+  // The mouse-driven behaviour the gate must not change: opening a tab still
+  // puts the caret in the composer, no keyboard in the picture.
+  it("focuses the composer when a tab becomes active on a fine pointer", async () => {
+    coarsePointer.mockReturnValue(false)
+    const { container } = renderInput({ isActive: true })
+    await waitFor(() =>
+      expect(container.querySelector('[role="textbox"]')).not.toBeNull()
+    )
+    const editor = container.querySelector('[role="textbox"]') as HTMLElement
+    await waitFor(() => expect(document.activeElement).toBe(editor))
+  })
+
   // A browser with no Pointer Events dispatches no `pointerdown` and names no
   // pointer kind on its clicks, so both paths above stand down and plain
   // `mousedown` is all there is — jsdom is exactly such an environment, which
```

**File**: `src/components/chat/message-input.tsx` (modified, +13/-1)
```diff
@@ -103,6 +103,7 @@ import {
   type ModelOptionGroup,
 } from "@/lib/model-config-groups"
 import { useAgentSkills } from "@/hooks/use-agent-skills"
+import { useIsCoarsePointer } from "@/hooks/use-is-coarse-pointer"
 import { useScrollbarSafeDismiss } from "@/hooks/use-scrollbar-safe-dismiss"
 import { useAgentVocabulary } from "@/hooks/use-agent-vocabulary"
 import {
@@ -472,6 +473,9 @@ export function MessageInput({
   // Flips true once the RichComposer's async (immediatelyRender:false) editor has
   // mounted, so the hydration effect can use the imperative handle.
   const [composerReady, setComposerReady] = useState(false)
+  // On a touch-first device focusing the editor raises the soft keyboard, which
+  // the tab-activation auto-focus below must not do on its own.
+  const isCoarsePointer = useIsCoarsePointer()
 
   const syncComposerEmpty = useCallback(() => {
     const ed = editorRef.current?.getEditor()
@@ -686,13 +690,21 @@ export function MessageInput({
   // editor a tick after mount (mirrors the hydration effect's gate). Ordered
   // after that hydration effect so this rAF runs after its setContent, landing
   // the caret at the end of a restored draft rather than before it.
+  //
+  // Skipped entirely on a coarse pointer: this effect also fires when a session
+  // merely *becomes active*, and on a phone focusing the editor raises the soft
+  // keyboard — switching sessions to read progress would shove the keyboard
+  // over the transcript. Tapping the composer still focuses it (native focus in
+  // the text, the chrome-press handler in the padding), so the keyboard comes
+  // up on demand instead of on tab switch.
   useEffect(() => {
+    if (isCoarsePointer) return
     if (isActive && composerReady && !isPrompting) {
       requestAnimationFrame(() => {
         editorRef.current?.focus()
       })
     }
-  }, [isActive, composerReady, isPrompting])
+  }, [isCoarsePointer, isActive, composerReady, isPrompting])
 
   // Re-hydrate when the user (re)edits a *different* queue item after the
   // initial mount hydration above. Keyed on the item id (not display text) so
```

---

### Incident Patch 4: `52014f33` (2026-09-30)
**Commit Message**: fix(canvas): name the canvas route Infinite Canvas

The sidebar item, the quick-actions entry and the page title now say
"Infinite Canvas" instead of "Infinite Conversations" in all ten
locales, each in the word its locale already uses for a canvas.

**File**: `src/components/canvas/canvas-page.test.tsx` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ describe("CanvasPage", () => {
     expect(screen.queryByTestId("board-view")).toBeNull()
     // The breadcrumb is just the route title here — nothing to go back to.
     expect(
-      screen.getByRole("heading", { name: "Infinite Conversations" })
+      screen.getByRole("heading", { name: "Infinite Canvas" })
     ).toBeTruthy()
   })
 
```

**File**: `src/i18n/messages/ar.json` (modified, +2/-2)
```diff
@@ -1998,7 +1998,7 @@
       "tasks": "المهام قيد الانتظار",
       "loadingSubsessions": "جارٍ تحميل المحادثات الفرعية…",
       "forge": "لوحة المستودع",
-      "canvas": "محادثات لا نهائية",
+      "canvas": "لوحة لا نهائية",
       "folderGroup": {
         "newGroup": "مجموعة جديدة",
         "newGroupTitle": "مجموعة مجلدات جديدة",
@@ -6175,7 +6175,7 @@
     "save": "حفظ"
   },
   "Canvas": {
-    "title": "محادثات لا نهائية",
+    "title": "لوحة لا نهائية",
     "untitled": "محادثة بلا عنوان",
     "unresolvedConversation": "تم حذف المحادثة",
     "removeCard": "إزالة البطاقة",
```

**File**: `src/i18n/messages/de.json` (modified, +2/-2)
```diff
@@ -1998,7 +1998,7 @@
       "tasks": "To-dos",
       "loadingSubsessions": "Unterkonversationen werden geladen…",
       "forge": "Repository-Panel",
-      "canvas": "Unendliche Unterhaltungen",
+      "canvas": "Unendlicher Canvas",
       "folderGroup": {
         "newGroup": "Neue Gruppe",
         "newGroupTitle": "Neue Ordnergruppe",
@@ -6175,7 +6175,7 @@
     "save": "Speichern"
   },
   "Canvas": {
-    "title": "Unendliche Unterhaltungen",
+    "title": "Unendlicher Canvas",
     "untitled": "Unbenannte Unterhaltung",
     "unresolvedConversation": "Unterhaltung gelöscht",
     "removeCard": "Karte entfernen",
```

**File**: `src/i18n/messages/en.json` (modified, +2/-2)
```diff
@@ -1998,7 +1998,7 @@
       "tasks": "To-dos",
       "loadingSubsessions": "Loading sub-conversations…",
       "forge": "Repository panel",
-      "canvas": "Infinite Conversations",
+      "canvas": "Infinite Canvas",
       "folderGroup": {
         "newGroup": "New group",
         "newGroupTitle": "New folder group",
@@ -6175,7 +6175,7 @@
     "save": "Save"
   },
   "Canvas": {
-    "title": "Infinite Conversations",
+    "title": "Infinite Canvas",
     "untitled": "Untitled conversation",
     "unresolvedConversation": "Conversation removed",
     "removeCard": "Remove card",
```

**File**: `src/i18n/messages/es.json` (modified, +2/-2)
```diff
@@ -1998,7 +1998,7 @@
       "tasks": "Tareas pendientes",
       "loadingSubsessions": "Cargando subconversaciones…",
       "forge": "Panel del repositorio",
-      "canvas": "Conversaciones infinitas",
+      "canvas": "Lienzo infinito",
       "folderGroup": {
         "newGroup": "Nuevo grupo",
         "newGroupTitle": "Nuevo grupo de carpetas",
@@ -6175,7 +6175,7 @@
     "save": "Guardar"
   },
   "Canvas": {
-    "title": "Conversaciones infinitas",
+    "title": "Lienzo infinito",
     "untitled": "Conversación sin título",
     "unresolvedConversation": "Conversación eliminada",
     "removeCard": "Quitar tarjeta",
```

---

### Incident Patch 5: `a1e8eb0a` (2026-09-29)
**Commit Message**: fix(parsers): show opencode's context window in history as live does

OpenCode never writes a context window into its transcripts. Its ACP
adapter looks one up for each usage_update: the limit.context of the
provider and model the latest reply ran on. History guessed the window
from the model id alone, which knows none of the models OpenCode's own
gateways serve (opencode/big-pickle, opencode-go/*) and no custom
provider's, so a reopened session showed its token usage but no
context window.

History now resolves the window the way OpenCode does, by provider and
model: a limit.context declared in the user's OpenCode config, with
the files layered in OpenCode's order (global files, $OPENCODE_CONFIG,
the project's files up to its worktree root, the .opencode
directories, ~/.opencode, $OPENCODE_CONFIG_DIR); then the models.dev
catalog OpenCode caches ($OPENCODE_MODELS_PATH, else
$XDG_CACHE_HOME/opencode/models.json), which settles every model it
lists; then codeg's bundled models.dev snapshot, for a model that
catalog does not list; and only then the name guess. Config files may
be JSONC. The catalog is indexed once per version of the file, so
reading many sessions in a row does not pa

**File**: `src-tauri/src/acp/opencode_plugins.rs` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ pub(crate) fn xdg_config_home() -> Option<PathBuf> {
         .or_else(|| dirs::home_dir().map(|h| h.join(".config")))
 }
 
-fn xdg_cache_home() -> Option<PathBuf> {
+pub(crate) fn xdg_cache_home() -> Option<PathBuf> {
     std::env::var_os("XDG_CACHE_HOME")
         .filter(|value| !value.is_empty())
         .map(PathBuf::from)
```

**File**: `src-tauri/src/parsers/mod.rs` (modified, +3/-1)
```diff
@@ -13,6 +13,7 @@ pub mod hermes;
 pub mod kimi_code;
 pub mod openclaw;
 pub mod opencode;
+mod opencode_context_window;
 pub mod pi;
 pub mod qoder;
 mod summary_cache;
@@ -1005,7 +1006,8 @@ pub fn latest_turn_total_usage_tokens(turns: &[MessageTurn]) -> Option<u64> {
 /// Deliberately NOT [`latest_turn_total_usage_tokens`], which adds
 /// `output_tokens` too: for this counter shape the reply is not resident in the
 /// prompt window that produced it, so including it over-reports the gauge by
-/// the last turn's output. Claude Code and Qoder both write this shape.
+/// the last turn's output. Claude Code, Qoder and OpenCode all write this
+/// shape (OpenCode's `tokens.input` already has the cached part taken out).
 pub fn latest_turn_prompt_usage_tokens(turns: &[MessageTurn]) -> Option<u64> {
     turns.iter().rev().find_map(|turn| {
         turn.usage.as_ref().and_then(|usage| {
```

**File**: `src-tauri/src/parsers/opencode.rs` (modified, +296/-11)
```diff
@@ -1,6 +1,6 @@
 use std::collections::HashMap;
 use std::future::Future;
-use std::path::PathBuf;
+use std::path::{Path, PathBuf};
 use std::time::Duration;
 
 use chrono::{DateTime, TimeZone, Utc};
@@ -10,10 +10,13 @@ use sea_orm::{
 };
 
 use crate::models::*;
+use crate::parsers::opencode_context_window::{ModelLimitSources, ModelRef};
 use crate::parsers::{folder_name_from_path, truncate_str, AgentParser, ParseError};
 
 pub struct OpenCodeParser {
     base_dir: PathBuf,
+    /// Where the context window of a session's model is looked up.
+    model_limits: ModelLimitSources,
 }
 
 impl Default for OpenCodeParser {
@@ -25,14 +28,24 @@ impl Default for OpenCodeParser {
 impl OpenCodeParser {
     pub fn new() -> Self {
         let base_dir = resolve_opencode_base_dir();
-        Self { base_dir }
+        Self {
+            base_dir,
+            model_limits: ModelLimitSources::from_env(),
+        }
     }
 
     /// Test-only constructor that lets callers point the parser at a fixture
     /// directory containing an `opencode.db` SQLite file.
+    ///
+    /// It reads nothing else: no OpenCode config or catalog from the machine
+    /// running the test, so a context window comes only from the model-name
+    /// guess.
     #[cfg(any(test, feature = "test-utils"))]
     pub fn with_base_dir(base_dir: PathBuf) -> Self {
-        Self { base_dir }
+        Self {
+            base_dir,
+            model_limits: ModelLimitSources::default(),
+        }
     }
 
     fn sqlite_db_path(&self) -> PathBuf {
@@ -199,7 +212,10 @@ impl OpenCodeParser {
             .await?
             .ok_or_else(|| ParseError::ConversationNotFound(conversation_id.to_string()))?;
 
-        let messages = match store {
+        let LoadedMessages {
+            messages,
+            latest_model,
+        } = match store {
             SessionStore::Legacy => self.load_sqlite_messages(&conn, conversation_id).await?,
             SessionStore::V2 => self.load_v2_messages(&conn, conversation_id).await?,
         };
@@ -210,9 +226,27 @@ impl OpenCodeParser {
         // OpenCode stamps `time.created` / `time.completed` on assistant
         // messages itself; this only covers ones written with no completion.
         super::backfill_turn_durations(&mut turns, &[]);
-        let context_window_used_tokens = super::latest_turn_total_usage_tokens(&turns);
-        let context_window_max_tokens =
-            super::infer_context_window_max_tokens(summary.model.as_deref());
+        // The same reading OpenCode's own ACP adapter reports live: occupancy
+        // is `input + cache.read + cache.write` of the latest reply
+        // (`contextTokens`), whose output is not resident in the window that
+        // produced it; the window is `limit.context` of the model that reply
+        // ran on (`findContextLimit`), which OpenCode looks up rather than
+        // writes down — see `opencode_context_window`.
+        let context_window_used_tokens = super::latest_turn_prompt_usage_tokens(&turns);
+        let context_window_max_tokens = latest_model
+            .as_ref()
+            .and_then(|model| {
+                self.model_limits
+                    .context_window(summary.folder_path.as_deref().map(Path::new), model)
+            })
+            .or_else(|| {
+                super::infer_context_window_max_tokens(
+                    latest_model
+                        .as_ref()
+                        .map(|model| model.model_id.as_str())
+                        .or(summary.model.as_deref()),
+                )
+            });
         let session_stats = super::merge_context_window_stats(
             super::compute_session_stats(&turns),
             context_window_used_tokens,
@@ -231,7 +265,7 @@ impl OpenCodeParser {
         &self,
         conn: &DatabaseConnection,
         conversation_id: &str,
-    ) -> Result<Vec<UnifiedMessage>, ParseError> {
+    ) -> Result<LoadedMessages, ParseError> {
         let rows = conn
 
```

**File**: `src-tauri/src/parsers/opencode_context_window.rs` (added, +1018/-0)
```diff
@@ -0,0 +1,1018 @@
+//! The context window OpenCode gives a model: the denominator of the context
+//! gauge on a reopened OpenCode session.
+//!
+//! OpenCode never writes a window into its transcripts. Its live ACP adapter
+//! looks one up for every `usage_update` it sends (`findContextLimit(providers,
+//! providerID, modelID)`, the `limit.context` of the latest assistant message's
+//! model) in the provider list OpenCode assembles from the models.dev catalog
+//! and the user's config. Guessing from the model id alone
+//! ([`super::infer_context_window_max_tokens`]) knows none of the models
+//! OpenCode's own gateways serve (`opencode/big-pickle`, `opencode-go/*`), none
+//! of a custom provider's, and nothing of a catalog that gives one id a
+//! different window under a different provider. So a session that showed its
+//! gauge live lost it once reopened from history.
+//!
+//! This reads the same sources, in OpenCode's precedence:
+//!
+//! 1. a `limit.context` declared in the user's config files, layered the way
+//!    OpenCode 1.18 layers them (see [`ModelLimitSources::config_files`]);
+//! 2. the models.dev catalog OpenCode caches: `$OPENCODE_MODELS_PATH`, else
+//!    `$XDG_CACHE_HOME/opencode/models.json`;
+//! 3. codeg's bundled models.dev snapshot, for a model that catalog does not
+//!    list. OpenCode itself falls back to the snapshot compiled into its
+//!    binary when it has no readable cache, so a machine that never fetched
+//!    the catalog still sized its gauge from one.
+//!
+//! A model none of them names is left to the caller's name guess.
+
+use std::collections::HashMap;
+use std::path::{Path, PathBuf};
+use std::sync::{Arc, Mutex, OnceLock};
+use std::time::SystemTime;
+
+use serde_json::Value;
+
+/// A model the way OpenCode addresses it: the provider that served it, and the
+/// id that provider knows it by. Kept exactly as the transcript spells both,
+/// since they are looked up as keys.
+#[derive(Clone, Debug, PartialEq, Eq)]
+pub(crate) struct ModelRef {
+    pub(crate) provider_id: Option<String>,
+    pub(crate) model_id: String,
+}
+
+impl ModelRef {
+    /// `None` without a model id. A blank provider counts as no provider.
+    pub(crate) fn new(provider_id: Option<&str>, model_id: Option<&str>) -> Option<Self> {
+        let model_id = model_id.filter(|id| !id.trim().is_empty())?;
+        let provider_id = provider_id
+            .filter(|id| !id.trim().is_empty())
+            .map(str::to_string);
+        Some(Self {
+            provider_id,
+            model_id: model_id.to_string(),
+        })
+    }
+}
+
+/// Where OpenCode keeps what decides a model's window.
+///
+/// Every source is optional so a test can point the lookup at fixtures, or at
+/// nothing at all (the [`Default`]), which leaves the caller's name guess in
+/// charge instead of whatever the machine running the suite has installed.
+#[derive(Clone, Debug, Default)]
+pub(crate) struct ModelLimitSources {
+    /// The global config directory, `$XDG_CONFIG_HOME/opencode`.
+    pub(crate) config_dir: Option<PathBuf>,
+    /// `$OPENCODE_CONFIG`: one more config file, over the global ones.
+    pub(crate) config_file: Option<PathBuf>,
+    /// `$OPENCODE_CONFIG_DIR`: a directory read the way a `.opencode` one is.
+    pub(crate) config_dir_env: Option<PathBuf>,
+    /// The home directory, whose own `.opencode` OpenCode also reads.
+    pub(crate) home_dir: Option<PathBuf>,
+    /// Whether the session directory's own config files count. OpenCode skips
+    /// them under `OPENCODE_DISABLE_PROJECT_CONFIG`.
+    pub(crate) project_config: bool,
+    /// The models.dev catalog OpenCode caches.
+    pub(crate) catalog_file: Option<PathBuf>,
+    /// Whether codeg's bundled models.dev snapshot answers last.
+    pub(crate) bundled_catalog: bool,
+}
+
+impl ModelLimitSources {
+    /// The files the OpenCode that codeg launches reads. Its agent process
+    /// inherits codeg's environment, so the same variables
```

**File**: `src-tauri/tests/snapshots/parsers_snapshot__opencode_detail.snap` (modified, +2/-2)
```diff
@@ -58,8 +58,8 @@ expression: detail
     },
     "total_tokens": 27,
     "total_duration_ms": 1000,
-    "context_window_used_tokens": 27,
+    "context_window_used_tokens": 12,
     "context_window_max_tokens": 200000,
-    "context_window_usage_percent": 0.0135
+    "context_window_usage_percent": 0.006
   }
 }
```

---

### Incident Patch 6: `6d9c5a66` (2026-09-29)
**Commit Message**: chore(rust): quiet ld's __eh_frame warning in debug builds

rustc's asynchronous unwind tables keep most functions out of Apple's
compact unwind format, so unoptimized builds of the codeg binary and
the lib test harness carry more __eh_frame than the 16 MB ld can index.
Since linker_messages became warn-by-default in Rust 1.97, every dev
and test link on macOS surfaced ld's "__eh_frame section too large"
note, which only means slower unwinding in debug builds.

Allow linker_messages at both crate roots when debug assertions are
on. Release builds stay far below the limit and keep reporting linker
messages.

**File**: `src-tauri/src/lib.rs` (modified, +4/-0)
```diff
@@ -6,6 +6,10 @@
 // so the giant future's layout resolves. See the big-stack thread in
 // `acp/connection.rs` for the sibling *runtime* mitigation of the same frame.
 #![recursion_limit = "256"]
+// The unoptimized lib test binary trips the same harmless macOS
+// "__eh_frame section too large" linker warning as the `codeg` binary; see the
+// note at the top of `main.rs`.
+#![cfg_attr(debug_assertions, allow(linker_messages))]
 
 pub mod acp;
 pub mod acp_transcript;
```

**File**: `src-tauri/src/main.rs` (modified, +8/-0)
```diff
@@ -1,5 +1,13 @@
 // Prevents additional console window on Windows in release, DO NOT REMOVE!!
 #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
+// rustc's asynchronous unwind tables keep most functions out of Apple's
+// compact unwind format, so an unoptimized build of this binary carries more
+// `__eh_frame` than the 16 MB ld can index, and every dev link on macOS warns
+// "__eh_frame section too large". The only cost is slower unwinding in debug
+// builds. Release builds stay far below the limit, so linker messages remain
+// on there. Drop this once rustc files the message as informational
+// (rust-lang/rust#159105).
+#![cfg_attr(debug_assertions, allow(linker_messages))]
 
 fn main() {
     // When called as a git credential helper, handle it immediately and exit.
```

---

### Incident Patch 7: `9243c7df` (2026-09-29)
**Commit Message**: fix(parsers): show claude and codex context compaction in history as live does

Claude Code: the continuation record's summary is folded into the
compaction divider behind its "Summary" toggle instead of rendering as a
separate system message, and the copy a resume replays is deduped.

Codex: history draws the compaction divider from the rollout's
`compacted` record, named by the live divider's ContextCompaction item id
and opening onto the handoff summary. The handoff no longer renders as
the tail of the previous reply (it is also recognized by its text, since
0.152's `token_usage_record` breaks adjacency), and the compaction's own
thinking is dropped with its spend kept on the reply.

Compaction dividers are also deduped by call id.

**File**: `src-tauri/src/acp/connection.rs` (modified, +1/-8)
```diff
@@ -66,6 +66,7 @@ use crate::acp::types::{
 use crate::logging::throttle::LeadingEdgeThrottle;
 use crate::models::agent::AgentType;
 use crate::network::proxy;
+use crate::parsers::COMPACTION_SUMMARY_META_KEY;
 use crate::web::event_bridge::{emit_with_state, emit_with_state_gated, EventEmitter};
 
 /// Injected into the agent process only when the user has opted in — see
@@ -16291,14 +16292,6 @@ fn session_compaction_event(dispatch: &Dispatch) -> Option<AcpEvent> {
 /// bridge and both adapters' legacy calls use.
 const CONTEXT_COMPACTION_TITLE: &str = "Context compaction";
 
-/// `_meta` key claiming that a compaction call's `raw_output` IS its retained
-/// summary. Only [`session_compaction_event`] sets it, so it marks exactly the
-/// calls translated from the ACP compaction lifecycle. Codeg-namespaced (like
-/// `codeg.delegation`) rather than nested in `contextCompaction`, whose members
-/// are the adapters' reserved vocabulary. The frontend twin is
-/// `COMPACTION_SUMMARY_META_KEY` in `src/lib/context-compaction.ts`.
-const COMPACTION_SUMMARY_META_KEY: &str = "codeg.compactionSummary";
-
 /// Flatten an ACP summary payload — a `ContentBlock` or an array of them — to
 /// its text. Non-text blocks (an image in a summary would be novel) are
 /// skipped rather than stringified into JSON noise.
```

**File**: `src-tauri/src/acp/registry.rs` (modified, +3/-2)
```diff
@@ -972,8 +972,9 @@ pub fn get_agent_meta(agent_type: AgentType) -> AcpAgentMeta {
             // is `compaction_update`), and real `failed`/`cancelled` states.
             // The summary rides the synthetic call's `raw_output` under a
             // `codeg.compactionSummary` claim and opens behind the divider's
-            // "Summary" toggle; history dividers stay summary-less because the
-            // transcript already shows it as the continuation turn beneath.
+            // "Summary" toggle; the history divider opens onto the same summary,
+            // folded in by `parsers::claude` from the transcript's continuation
+            // record.
             //
             // (q) The file-change report went native (#1138), and with it the
             // COST half of the "agentFileChangeReport stays out" record in
```

**File**: `src-tauri/src/parsers/claude.rs` (modified, +292/-54)
```diff
@@ -674,56 +674,91 @@ pub(crate) fn capture_title_record(
     }
 }
 
-/// Check if an assistant message is a synthetic placeholder (e.g. generated by
-/// Claude Code for local commands like `/context` or `/model`).
-/// These carry `model: "<synthetic>"` and all-zero usage, so they should be
-/// excluded from conversation turns and stats.
+/// Opening words of the message Claude Code writes back right after a
+/// compaction (the `isCompactSummary` record): the summary of the history it
+/// dropped, framed as a `user` turn addressed to the model. `pub(crate)`: the
+/// background watcher must never take one for a prompt that opens a turn.
 pub(crate) const CONTEXT_CONTINUATION_PREFIX: &str =
     "This session is being continued from a previous conversation";
 
-/// Detect Claude Code context continuation summary messages.
-/// These are injected as "user" type but are actually system context.
-fn is_context_continuation(content: &[ContentBlock]) -> bool {
-    content.iter().any(|block| {
-        if let ContentBlock::Text { text } = block {
-            text.starts_with(CONTEXT_CONTINUATION_PREFIX)
-        } else {
-            false
+/// The text of a continuation-summary message, if `content` is one. It is
+/// injected as a `user` record, but nobody typed it.
+fn context_continuation_text(content: &[ContentBlock]) -> Option<&str> {
+    content.iter().find_map(|block| match block {
+        ContentBlock::Text { text } if text.starts_with(CONTEXT_CONTINUATION_PREFIX) => {
+            Some(text.as_str())
         }
+        _ => None,
     })
 }
 
-/// The compaction divider for a `system`/`compact_boundary` record, as the
-/// provider-neutral tool pair every agent's compaction renders through.
-///
-/// The live ACP path gets this for free: claude-agent-acp 0.75.0 streams a
-/// `tool_call` tagged `_meta.contextCompaction` (the same key codex-acp 1.3.0
-/// introduced), which `<ContextCompactionCard>` matches on `_meta` alone rather
-/// than per agent. This is the history half, so reopening a conversation shows
-/// the same divider in the same place — and it works for sessions run through
-/// the plain `claude` CLI too, which writes the record but speaks no ACP.
-///
-/// Two shape rules, both borrowed from `parsers::grok` and `parsers::deepseek`:
-/// the ToolUse needs its paired ToolResult or the card reads as a call still
-/// running, and `tool_use_id` is the record's own uuid so re-parsing the same
-/// transcript yields the same block.
+/// The framing ahead of the summary in a continuation message: its opening
+/// sentence, then the `Summary:` line the CLI puts the summary under.
+fn continuation_preamble_regex() -> &'static Regex {
+    static RE: OnceLock<Regex> = OnceLock::new();
+    RE.get_or_init(|| {
+        Regex::new(&format!(
+            r"\A\s*{}[^\n]*\n(?:[ \t]*\r?\n)*(?:[ \t]*Summary:[ \t]*\r?\n)?",
+            regex::escape(CONTEXT_CONTINUATION_PREFIX)
+        ))
+        .unwrap()
+    })
+}
+
+/// Whether `line` is one of the instructions the CLI appends to a continuation
+/// message after the summary: where the full pre-compaction transcript lives,
+/// and to pick the work back up without asking.
+fn is_continuation_trailer(line: &str) -> bool {
+    let line = line.trim_start();
+    line.starts_with("If you need specific details from before compaction")
+        || line.starts_with("Continue the conversation from where it left off")
+        || line.starts_with("Please continue the conversation from where")
+}
+
+/// The summary a continuation message carries, without the framing the CLI
+/// wraps it in for the model — the same text claude-agent-acp streams live as
+/// the compaction's `summary` (its `compactionSummaryText` strips this very
+/// framing off a persisted summary on replay), so a divider opens onto one
+/// summary whether its conversation is live or reopened.
 ///
-/// The record is bookkeeping, not a message, so it never carries usage or a
-/// model, and the cal
```

**File**: `src-tauri/src/parsers/codex.rs` (modified, +627/-21)
```diff
@@ -738,7 +738,7 @@ impl CodexParser {
                                         is_promotable_assistant_text(&text)
                                     };
                                     if promotable {
-                                        promotion.push_candidate(record_ordinal, is_user);
+                                        promotion.push_candidate(record_ordinal, is_user, &text);
                                         pending_promotions.push((
                                             is_user,
                                             is_user
@@ -753,6 +753,12 @@ impl CodexParser {
                         }
                     }
                 }
+                // The compaction's handoff summary is no message — the same
+                // denial the detail parser applies before drawing its divider.
+                "compacted" => {
+                    let summary = codex_compacted_summary(value.get("payload"));
+                    promotion.deny_compaction_summary(summary);
+                }
                 _ => {}
             }
         }
@@ -3270,6 +3276,9 @@ impl CodexParser {
         // assigns unconditionally (newest wins), so it needs its own flag rather
         // than an ordinal comparison.
         let mut title_from_thread_name = false;
+        // Index in `messages` of the compaction divider the next
+        // `item_completed.ContextCompaction` names (see the `compacted` arm).
+        let mut unnamed_compaction_divider: Option<usize> = None;
 
         for line in lines {
             if line.trim().is_empty() {
@@ -3676,6 +3685,21 @@ impl CodexParser {
                                 }
                             }
                             "item_completed" => {
+                                // The compaction the last `compacted` record
+                                // drew a divider for, now under the id codex-acp
+                                // gave the live divider (`compactionId` IS this
+                                // item id): the two are then one event to
+                                // anything that meets both, and the frontend
+                                // keeps one (`dedupeCompactionItems`).
+                                if let Some(item_id) = context_compaction_item_id(payload) {
+                                    if let Some(divider) = unnamed_compaction_divider
+                                        .take()
+                                        .and_then(|at| messages.get_mut(at))
+                                    {
+                                        rename_compaction_divider(divider, item_id);
+                                    }
+                                    continue;
+                                }
                                 if let Some(call) = completed_mcp_call(payload) {
                                     let exec_id = if deferred_scripts.is_empty()
                                         && pending_exec_scripts.len() == 1
@@ -3930,10 +3954,7 @@ impl CodexParser {
                                         let last_assistant = if grouped_reasoning.is_empty()
                                             && pending_reasoning.is_empty()
                                         {
-                                            messages
-                                                .iter_mut()
-                                                .rev()
-                                                .find(|m| matches!(m.role, MessageRole::Assistant))
+                                            messages.iter_mut().rev().find(|m| bills_codex_usage(m))
                                         } else {
                                             None
                                         };
@@ -3973,6 +3994,7 @@ impl CodexParser {
                         // Any other response item closes it — emit the reasoning
                         // gathered so far as one card, here, so it can't be reorde
```

**File**: `src-tauri/src/parsers/mod.rs` (modified, +40/-0)
```diff
@@ -1088,6 +1088,46 @@ pub fn with_reported_context_percent(
     }
 }
 
+/// `_meta` key claiming that a context-compaction call's result IS the summary
+/// the agent kept of the history it dropped.
+///
+/// The live reader stamps it on every call it translates from the ACP
+/// compaction lifecycle (`acp::connection::session_compaction_event`); a history
+/// parser stamps it through [`attach_compaction_summary`] on a divider whose
+/// summary its transcript still holds. Codeg-namespaced (like
+/// `codeg.delegation`) rather than nested in `contextCompaction`, whose members
+/// are the adapters' reserved vocabulary. The frontend twin is
+/// `COMPACTION_SUMMARY_META_KEY` in `src/lib/context-compaction.ts`, which shows
+/// a compaction call's output as its summary only under this claim.
+pub(crate) const COMPACTION_SUMMARY_META_KEY: &str = "codeg.compactionSummary";
+
+/// Hand a synthesized compaction divider — the `_meta.contextCompaction`
+/// ToolUse and its paired ToolResult that every parser emits for a compaction —
+/// the summary its agent retained, so the reopened divider opens onto the same
+/// "Summary" the live one does: the result carries the text, the call carries
+/// the claim.
+///
+/// Returns `false`, touching nothing, unless `blocks` is such a pair still
+/// waiting for its summary; a divider takes exactly one.
+pub(crate) fn attach_compaction_summary(blocks: &mut [ContentBlock], summary: String) -> bool {
+    let [ContentBlock::ToolUse {
+        meta: Some(serde_json::Value::Object(meta)),
+        ..
+    }, ContentBlock::ToolResult { output_preview, .. }] = blocks
+    else {
+        return false;
+    };
+    if !meta.contains_key("contextCompaction") || output_preview.is_some() {
+        return false;
+    }
+    meta.insert(
+        COMPACTION_SUMMARY_META_KEY.to_string(),
+        serde_json::Value::Bool(true),
+    );
+    *output_preview = Some(summary);
+    true
+}
+
 /// Relocate orphaned tool_result blocks to the turn that contains their matching tool_use.
 ///
 /// After `group_into_turns` splits assistant rounds, async tool execution can cause
```

---

### Incident Patch 8: `10b6d8f3` (2026-09-29)
**Commit Message**: fix(workspace): close the tab, not the window, on ⌘W inside a page

Tauri's default macOS menu binds ⌘W to the predefined "Close Window".
The workspace claims ⌘W in its own keydown listener, but a keystroke
pressed inside an iframe (inline HTML preview, chat HTML preview) or a
native surface (built-in browser page, HTML document view) never reaches
that document, so WebKit handed it to the menu and the whole window
closed.

The app menu is now Tauri's default with its own ⌘W item. Over a
workspace window it asks that window to handle the shortcut and names
the browser surface holding keyboard focus (found from the window's first
responder); over any other window it performs close as before. "Close
Window" stays in the Window menu without a shortcut.

The workspace routes the handed-back ⌘W as if it were pressed where it
happened — the focused iframe, or the placeholder of the focused surface
— activating that pane and closing its current tab. When the page itself
had the keystroke and nothing claimed it, or ⌘W is not the close-tab
shortcut, the window closes as it always did.

**File**: `src-tauri/Cargo.toml` (modified, +1/-1)
```diff
@@ -212,7 +212,7 @@ objc2 = "0.6"
 block2 = "0.6"
 objc2-foundation = { version = "0.3", default-features = false, features = ["std", "NSString", "NSData", "NSDictionary", "NSError", "NSObject", "NSArray", "NSValue", "NSURLRequest", "NSURL", "NSEnumerator", "NSObjCRuntime", "NSGeometry", "NSRange", "NSThread", "NSDate", "NSSet", "NSProcessInfo", "NSUUID", "NSURLError"] }
 objc2-web-kit = { version = "0.3", default-features = false, features = ["std", "block2", "objc2-app-kit", "objc2-core-foundation", "WKWebView", "WKWebViewConfiguration", "WKUserContentController", "WKUserScript", "WKContentWorld", "WKScriptMessage", "WKScriptMessageHandler", "WKFrameInfo", "WKSnapshotConfiguration", "WKFindConfiguration", "WKFindResult", "WKNavigation", "WKNavigationAction", "WKNavigationDelegate", "WKNavigationResponse", "WKUIDelegate", "WKWebsiteDataStore", "WKWebsiteDataRecord", "WKContentRuleList", "WKContentRuleListStore"] }
-objc2-app-kit = { version = "0.3", default-features = false, features = ["std", "objc2-core-foundation", "objc2-core-graphics", "NSImage", "NSImageRep", "NSBitmapImageRep", "NSGraphics", "NSGraphicsContext", "NSPasteboard", "NSResponder", "NSView", "NSWindow"] }
+objc2-app-kit = { version = "0.3", default-features = false, features = ["std", "objc2-core-foundation", "objc2-core-graphics", "NSImage", "NSImageRep", "NSBitmapImageRep", "NSGraphics", "NSGraphicsContext", "NSPasteboard", "NSResponder", "NSView", "NSWindow", "NSApplication"] }
 
 [target.'cfg(target_os = "windows")'.dependencies]
 windows-sys = { version = "0.59", features = ["Win32_Storage_FileSystem", "Win32_Foundation", "Win32_System_Threading", "Win32_NetworkManagement_IpHelper", "Win32_Networking_WinSock", "Win32_System_DataExchange", "Win32_System_Memory", "Win32_System_Ole", "Win32_UI_Shell"] }
```

**File**: `src-tauri/src/app_menu.rs` (added, +199/-0)
```diff
@@ -0,0 +1,199 @@
+//! The macOS application menu: Tauri's default one, except that ⌘W is not
+//! "Close Window".
+//!
+//! A key equivalent reaches the menu whenever the view holding keyboard focus
+//! did not claim the keystroke. The workspace claims ⌘W itself — its keydown
+//! listener closes the current tab and cancels the event — but only for
+//! keystrokes its own document receives. One pressed inside an iframe (an
+//! inline HTML preview) goes to that frame's document, and one pressed inside
+//! a built-in browser page or an HTML document view goes to another webview
+//! altogether. The workspace never saw those, WebKit handed them on, and the
+//! predefined item closed the whole window where a tab was meant to go.
+//!
+//! So ⌘W is an item of our own. Over a workspace window it leaves the decision
+//! to that window ([`CLOSE_SHORTCUT_EVENT`]), naming the browser surface that
+//! had keyboard focus if one did — only the native side can tell which of its
+//! views that was. Over any other window (settings, a commit window, an owned
+//! browser window, an inspector) it does what the predefined item did.
+//!
+//! "Close Window" stays in the Window menu without a shortcut. ⇧⌘W, where
+//! tabbed apps usually put it, is the workspace's own "close all file tabs",
+//! and a menu item there would close the window the same way whenever that
+//! shortcut did not apply.
+//!
+//! Windows and Linux have no application menu, so nothing there turns an
+//! unclaimed Ctrl+W into closing the window.
+
+use std::ffi::c_void;
+
+use objc2::rc::Retained;
+use objc2::MainThreadMarker;
+use objc2_app_kit::{NSApplication, NSWindow};
+use serde::Serialize;
+use tauri::menu::{
+    AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
+};
+use tauri::{AppHandle, Emitter, Manager, Wry};
+
+/// The File menu's "Close", bound to ⌘W.
+const CLOSE_ID: &str = "app-menu:close";
+/// The Window menu's "Close Window", without a shortcut.
+const CLOSE_WINDOW_ID: &str = "app-menu:close-window";
+
+/// Sent to a workspace window when ⌘W reached the menu while it was the key
+/// window. Mirrored by `CLOSE_SHORTCUT_EVENT` in `src/lib/menu-close-shortcut.ts`.
+pub const CLOSE_SHORTCUT_EVENT: &str = "app://close-shortcut";
+
+#[derive(Clone, Serialize)]
+#[serde(rename_all = "camelCase")]
+struct CloseShortcutPayload {
+    /// The workspace window the shortcut was pressed in. The frontend
+    /// subscribes with `EventTarget::Any`, so every webview hears the event
+    /// whatever it is addressed to; this is what the listener checks.
+    window: String,
+    /// The built-in browser surface (a browser tab's page, or a document view)
+    /// that had keyboard focus, by its backend tab id.
+    surface_tab_id: Option<String>,
+}
+
+/// Tauri's default macOS menu (`tauri::menu::Menu::default`), item for item,
+/// except for the two close items.
+pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
+    let pkg_info = app.package_info();
+    let config = app.config();
+    let about_metadata = AboutMetadata {
+        name: Some(pkg_info.name.clone()),
+        version: Some(pkg_info.version.to_string()),
+        copyright: config.bundle.copyright.clone(),
+        authors: config.bundle.publisher.clone().map(|p| vec![p]),
+        ..Default::default()
+    };
+    let close = MenuItem::with_id(app, CLOSE_ID, "Close", true, Some("CmdOrCtrl+W"))?;
+    let close_window = MenuItem::with_id(app, CLOSE_WINDOW_ID, "Close Window", true, None::<&str>)?;
+    Menu::with_items(
+        app,
+        &[
+            &Submenu::with_items(
+                app,
+                pkg_info.name.clone(),
+                true,
+                &[
+                    &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
+                    &PredefinedMenuItem::separator(app)?,
+                    &PredefinedMenuItem::services(app, None)?,
+                    &PredefinedMenuItem::separator(app)?
```

**File**: `src-tauri/src/browser/shim/macos.rs` (modified, +21/-1)
```diff
@@ -14,7 +14,9 @@ use block2::RcBlock;
 use objc2::rc::Retained;
 use objc2::runtime::{AnyObject, NSObject, NSObjectProtocol, ProtocolObject, Sel};
 use objc2::{define_class, msg_send, sel, DeclaredClass, MainThreadMarker, MainThreadOnly, Message};
-use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage, NSImageCompressionFactor};
+use objc2_app_kit::{
+    NSBitmapImageFileType, NSBitmapImageRep, NSImage, NSImageCompressionFactor, NSView, NSWindow,
+};
 use objc2_foundation::{
     ns_string, NSArray, NSDate, NSDictionary, NSError, NSNumber, NSProcessInfo, NSString, NSURL,
     NSURLErrorFailingURLErrorKey, NSUUID,
@@ -532,6 +534,24 @@ pub fn webview_pointer(webview: &wry::WebView) -> usize {
     Retained::as_ptr(&webview.webview()) as usize
 }
 
+/// `window`'s first responder and every view it sits in, innermost first, as
+/// pointers comparable with [`webview_pointer`]. Empty when no view holds
+/// keyboard focus (the window itself is the first responder).
+pub fn first_responder_chain(window: &NSWindow) -> Vec<usize> {
+    let mut chain = Vec::new();
+    let Some(Ok(mut view)) = window.firstResponder().map(|r| r.downcast::<NSView>()) else {
+        return chain;
+    };
+    loop {
+        chain.push(Retained::as_ptr(&view) as usize);
+        // SAFETY: main thread (the caller holds the key window), live view.
+        match unsafe { view.superview() } {
+            Some(parent) => view = parent,
+            None => return chain,
+        }
+    }
+}
+
 /// Diagnostic view of the native state (dev puppet only).
 pub fn debug_view(webview: &wry::WebView) -> serde_json::Value {
     let wk = webview.webview();
```

**File**: `src-tauri/src/browser/surface_child.rs` (modified, +9/-0)
```diff
@@ -112,6 +112,15 @@ fn tab_id_for_webview(pointer: usize) -> Option<String> {
     })
 }
 
+/// Main thread only: the tab whose surface has keyboard focus in `window` —
+/// its webview is the window's first responder, or holds the view that is.
+#[cfg(target_os = "macos")]
+pub fn tab_with_keyboard_focus(window: &objc2_app_kit::NSWindow) -> Option<String> {
+    shim::first_responder_chain(window)
+        .into_iter()
+        .find_map(tab_id_for_webview)
+}
+
 /// One sink for every tab: messages are attributed by source webview, because
 /// an adopted popup shares its opener's user-content controller (macOS).
 fn message_sink(app: &AppHandle) -> MessageSink {
```

**File**: `src-tauri/src/lib.rs` (modified, +12/-0)
```diff
@@ -15,6 +15,8 @@ pub use acp::{
 pub use acp::scratch_dir::scratch_sweep_task;
 pub use network::proxy::init_proxy_from_db;
 mod app_error;
+#[cfg(all(feature = "tauri-runtime", target_os = "macos"))]
+mod app_menu;
 pub mod app_state;
 pub mod automation;
 pub mod backgrounds;
@@ -462,6 +464,11 @@ mod tauri_app {
 
         let builder = tauri::Builder::default();
 
+        // The default menu minus its ⌘W "Close Window", which closed the
+        // workspace whenever ⌘W was pressed inside a page (see `app_menu`).
+        #[cfg(target_os = "macos")]
+        let builder = builder.menu(crate::app_menu::build);
+
         // Must be the first plugin: it short-circuits second launches by
         // signalling the running instance and exiting before any other
         // initialization. The callback runs in the *original* process.
@@ -1282,6 +1289,11 @@ mod tauri_app {
             .on_menu_event(|app, event| {
                 let id = event.id().as_ref().to_string();
 
+                #[cfg(target_os = "macos")]
+                if crate::app_menu::handle_event(app, &id) {
+                    return;
+                }
+
                 // Tray menu items act in Rust directly: showing the
                 // workspace and quitting are both pure runtime concerns
                 // with no UI state to coordinate.
```

---

### Incident Patch 9: `58f0fd0e` (2026-09-29)
**Commit Message**: fix(codex): show a reopened stretch of reasoning as one thinking card

Since 0.149 codex announces every item with an `event_msg.item_completed`
right before the item's own record, and the history parser ended a
reasoning run at any record that was not reasoning, so a conversation
reopened from history stacked one think as several thinking cards where
the live stream showed one. Polls folded into their call, addressed
inter-agent messages and other records that render nothing split runs
the same way.

Thinking cards left touching are now joined once the transcript is
assembled (text in order, the later card's time, both cards' usage),
except across a turn start, which is a new prompt.

**File**: `src-tauri/src/parsers/codex.rs` (modified, +432/-5)
```diff
@@ -3222,6 +3222,12 @@ impl CodexParser {
         //     writes several of these back to back (up to 28 in real rollouts),
         //     and emitting a card per record is what tore one thought into a
         //     column of 思考 cards.
+        // codex 0.149+ writes no section events: it announces each item with an
+        // `event_msg.item_completed` restating the summary that follows. That
+        // ends the run below like any record that is not reasoning, and so does
+        // everything else that turns out to render nothing — the cards they
+        // leave touching are joined once the transcript is assembled
+        // (`merge_touching_thinking_cards`).
         // So `grouped_reasoning` accumulates the settled text of the run while
         // `pending_reasoning` holds the section events not yet restated by a
         // grouped summary; the summary supersedes them (it is the same text,
@@ -5086,19 +5092,22 @@ impl CodexParser {
         let folder_path = cwd.clone();
         let folder_name = folder_path.as_ref().map(|p| folder_name_from_path(p));
 
+        let turn_starts = if task_start_markers.is_empty() {
+            &turn_context_markers
+        } else {
+            &task_start_markers
+        };
         fold_shell_session_polls(&mut messages, &poll_origins);
+        // After every pass that drops messages, so it sees every pair of cards
+        // they leave touching.
+        merge_touching_thinking_cards(&mut messages, turn_starts);
         let mut turns = group_into_turns(messages);
         reconcile_turn_usage(&mut turns, &recorded_round_usage);
         super::relocate_orphaned_tool_results(&mut turns);
         super::structurize_read_tool_output(&mut turns);
         super::resolve_patch_line_numbers(&mut turns, cwd.as_deref());
         // After relocation every turn's `completed_at` is final — tile the
         // timeline into per-reply durations before stats aggregate them.
-        let turn_starts = if task_start_markers.is_empty() {
-            &turn_context_markers
-        } else {
-            &task_start_markers
-        };
         super::backfill_turn_durations(&mut turns, turn_starts);
         let mut session_stats = super::compute_session_stats(&turns);
         session_stats =
@@ -5425,6 +5434,69 @@ fn push_turn_start(turn_starts: &mut Vec<DateTime<Utc>>, ts: DateTime<Utc>) {
     }
 }
 
+/// Join the thinking cards left touching once the transcript is assembled.
+///
+/// A reasoning run ends at the first record that is not reasoning, and many of
+/// those render nothing: codex 0.149+ announces every reasoning item with an
+/// `event_msg.item_completed` restating the summary that follows, an addressed
+/// inter-agent message never renders in place, a `write_stdin` poll or code-mode
+/// `wait` is folded into the call it collects. Each split one thought — the
+/// announcements alone gave every reasoning item a 思考 card of its own, where
+/// live streams the whole think as one. Whether a record renders is often known
+/// only now, so the cards are joined here, the way the run itself would have
+/// joined them: text in order, stamped with the later card's time, both cards'
+/// spend kept.
+fn merge_touching_thinking_cards(
+    messages: &mut Vec<UnifiedMessage>,
+    turn_starts: &[DateTime<Utc>],
+) {
+    let mut kept: Vec<UnifiedMessage> = Vec::with_capacity(messages.len());
+    for message in std::mem::take(messages) {
+        match kept.last_mut() {
+            Some(previous) if continues_thought(previous, &message, turn_starts) => {
+                if let (
+                    [ContentBlock::Thinking { text: earlier }],
+                    [ContentBlock::Thinking { text: later }],
+                ) = (previous.content.as_mut_slice(), message.content.as_slice())
+                {
+                    earlier.push_str("\n\n");
+                    earlier.push_str(later);
+                }
+                previous.timestamp = message.timestamp;
+  
```

---

### Incident Patch 10: `e906c376` (2026-09-29)
**Commit Message**: fix(acp): launch opencode acp on an automatic loopback port (#860)

Pass `--port 0 --hostname 127.0.0.1` after `acp` so a fixed
`server.port` / `server.hostname` in opencode's global config no longer
makes concurrent OpenCode sessions exit with ServeError, nor exposes the
session server on every interface. The flags only reach builds that
accept them: a managed release label or a PATH install's cached
`--version` decides; preview builds are asked through `acp --help`
(only a clean exit counts; cached per path and mtime); otherwise the
bare argv is kept.

Fixes #860.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `src-tauri/src/acp/connection.rs` (modified, +17/-3)
```diff
@@ -2027,7 +2027,7 @@ async fn build_agent(
             // localized install prompt. Do not change the wording.
             let cached =
                 crate::acp::binary_cache::find_best_cached_binary_for_agent(agent_type, cmd)?;
-            let binary_path = match cached {
+            let (binary_path, cached_version) = match cached {
                 Some((path, cached_version)) => {
                     if cached_version == registry_version {
                         tracing::info!(
@@ -2040,7 +2040,7 @@ async fn build_agent(
                             meta.name
                         );
                     }
-                    path
+                    (path, Some(cached_version))
                 }
                 None => {
                     let system =
@@ -2056,7 +2056,7 @@ async fn build_agent(
                         meta.name,
                         system.display()
                     );
-                    system
+                    (system, None)
                 }
             };
 
@@ -2092,6 +2092,20 @@ async fn build_agent(
                     cmd_args.insert(0, "--force".to_string());
                 }
             }
+            // `opencode acp` embeds an HTTP server that otherwise takes its
+            // port and host from opencode's GLOBAL config (`server.*`, meant
+            // for `opencode serve`); a fixed port there fails every concurrent
+            // session with `ServeError` (#860). The subcommand's own defaults,
+            // passed explicitly, outrank that config — for builds that know
+            // the flags (see `opencode_launch`).
+            if agent_type == AgentType::OpenCode {
+                let listen = crate::acp::opencode_launch::listen_args(
+                    &binary_path,
+                    cached_version.as_deref(),
+                )
+                .await;
+                cmd_args.extend(listen.iter().map(|a| (*a).to_string()));
+            }
             let cmd_args_for_log = cmd_args.clone();
             if !cmd_args.is_empty() {
                 server = server.args(cmd_args);
```

**File**: `src-tauri/src/acp/mod.rs` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ pub mod internal_bus;
 pub mod lifecycle;
 pub mod manager;
 pub mod opencode_catalog;
+pub mod opencode_launch;
 pub mod opencode_plugins;
 pub mod plan_approval;
 pub mod preflight;
```

**File**: `src-tauri/src/acp/opencode_launch.rs` (added, +400/-0)
```diff
@@ -0,0 +1,400 @@
+//! Launch flags for OpenCode's `opencode acp` (codeg#860).
+//!
+//! `opencode acp` is more than a stdio ACP server: its ACP bridge drives an
+//! HTTP server embedded in the same process, through the opencode SDK at
+//! `http://<hostname>:<port>`. Since 1.0.204 it resolves that listener as CLI
+//! flag > the GLOBAL config's `server.port` / `server.hostname`
+//! (`~/.config/opencode/opencode.json`) > the subcommand's own default
+//! (`--port 0 --hostname 127.0.0.1`). The config block exists for
+//! `opencode serve`, but `acp` inherits it all the same.
+//!
+//! A fixed port there cannot work under codeg, which runs one `opencode acp`
+//! per session. The first session binds it; every concurrent session — or any
+//! session while some other opencode process holds the port — exits 1 with
+//! `Error: Unexpected error` / `ServeError` before `initialize` answers,
+//! because opencode gives a non-zero port no fallback. A configured `0.0.0.0`
+//! is wrong more quietly: it publishes the session's agent API on every
+//! interface, and it is also the host the bridge's own SDK then dials — one
+//! codeg's loopback `NO_PROXY` exception (`network::proxy`) does not name.
+//!
+//! Passing the subcommand's defaults explicitly restores them, since a flag
+//! outranks the config. `--port 0` means "4096 if free, else any free port",
+//! and that fallback is what isolates concurrent sessions; a codeg-picked
+//! non-zero port would bring the failure back through the race between
+//! picking it and opencode binding it. `--hostname 127.0.0.1` keeps the
+//! listener on loopback, which also stops opencode from announcing it over
+//! mDNS (it never publishes a loopback host).
+//!
+//! The flags only exist from [`LISTEN_FLAGS_MIN_VERSION`], and opencode parses
+//! its CLI strictly: an older build exits on them instead of starting, and
+//! prints its usage to stdout — the ACP channel. Those builds are unaffected
+//! anyway (their `acp` starts no HTTP server), so they keep the bare argv, and
+//! the launch has to know which kind of build it is starting. See
+//! [`listen_args`].
+
+use std::collections::HashMap;
+use std::path::{Path, PathBuf};
+use std::process::Stdio;
+use std::sync::Mutex;
+use std::time::{Duration, SystemTime};
+
+use crate::models::agent::AgentType;
+
+/// Appended after `acp`, whose options they are. Each flag and its value are
+/// separate argv elements on purpose: releases such as 1.0.204 detect an
+/// explicit flag with `process.argv.includes("--port")`, so a `--port=0`
+/// spelling reads as "not given" there and the config wins again.
+const LISTEN_ARGS: &[&str] = &["--port", "0", "--hostname", "127.0.0.1"];
+
+/// First release whose `acp` accepts `--port` / `--hostname` (upstream
+/// 73cd8a334c). 1.0.42 was never published; 1.0.41's `acp` has neither flag.
+const LISTEN_FLAGS_MIN_VERSION: semver::Version = semver::Version::new(1, 0, 43);
+
+/// Bound on the `acp --help` probe, like every other status-path probe.
+const HELP_PROBE_TIMEOUT: Duration = Duration::from_secs(10);
+
+/// What a version string alone settles: `Some` for a release, `None` when it
+/// cannot tell. opencode publishes every preview channel (`dev`, `beta`,
+/// `next`, per-branch snapshots) as `0.0.0-<tag>` whatever the build's age —
+/// npm carries thousands of them, from before `acp` existed to last night —
+/// and a source build or a failed probe has no usable version at all.
+fn release_accepts_listen_flags(version: &str) -> Option<bool> {
+    let version = semver::Version::parse(version.trim()).ok()?;
+    if (version.major, version.minor, version.patch) == (0, 0, 0) {
+        return None;
+    }
+    Some(version.cmp_precedence(&LISTEN_FLAGS_MIN_VERSION) != std::cmp::Ordering::Less)
+}
+
+/// Whether `acp --help` output lists both flags, as whole tokens.
+fn help_lists_listen_flags(help: &str) -> bool {
+    let lists = |flag: &str| help.split_whitespace().any(|token| token == flag);
+    lists("--p
```

#### Recent Merged Pull Requests:
- **PR #866** (2026-09-30): style: lighten default lucide icon strokes to 1.75 (@SousekiL)
- **PR #865** (2026-09-30): fix(chat): keep the soft keyboard closed when a session becomes active on touch (@Flyneen)
- **PR #858** (2026-09-28): fix(parsers): read OpenCode 2.x session_v2 databases (@n0tlu5)
- **PR #848** (2026-09-28): feat(sidebar): filter the Recent section to chats or folder sessions (@SousekiL)
- **PR #847** (2026-09-28): feat(chat): inline previews for visualizations and HTML files from any agent (@SousekiL)
- **PR #842** (2026-09-28): fix(pi): support model-advertised max and minimal thinking (@dawNotPoi)
- **PR #838** (2026-09-28): fix(git-log): default commits to current worktree branch (@dawNotPoi)
- **PR #834** (2026-09-28): feat(notifications): name the session a notification is about (@Jonathan-Asher)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
