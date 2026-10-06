# Forensic Learning Record (Deep Inspection): VectifyAI/OpenKB

> **Canonical Artifact**: `07_PROJECT_LEARNING/vectifyai-openkb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/VectifyAI/OpenKB](https://github.com/VectifyAI/OpenKB))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:10:53.712Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `VectifyAI/OpenKB`
- **Description**: OpenKB: Open LLM Knowledge Base
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4735 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `frontend/src/hooks/use-mobile.ts`
```
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

```

### Core Architecture Module: `frontend/src/hooks/useAnimatedSwitch.ts`
```
import { useRef } from "react"

/**
 * Frequency gate for section-switch enter animations (Apple §3 interruptibility):
 * returns false when the previous change to `key` was < `minGapMs` ago, so a
 * fast run through the nav renders instantly instead of replaying a spring the
 * user is already clicking past. A settled selection (gap >= minGapMs) returns
 * true. No change to `key` returns false (nothing to animate).
 */
export function useAnimatedSwitch(key: string, minGapMs = 260): boolean {
  const last = useRef<{ key: string; at: number }>({ key, at: 0 })
  if (key !== last.current.key) {
    const now = performance.now()
    const animate = now - last.current.at >= minGapMs
    last.current = { key, at: now }
    return animate
  }
  return false
}

```

### Core Architecture Module: `frontend/src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `openkb/state.py`
```
from __future__ import annotations

import hashlib
import json
import unicodedata
from pathlib import Path

from openkb.locks import atomic_write_json


class HashRegistry:
    """Persistent registry mapping file SHA-256 hashes to metadata dicts."""

    def __init__(self, path: Path) -> None:
        self._path = path
        if path.exists():
            with path.open("r", encoding="utf-8") as fh:
                self._data: dict[str, dict] = json.load(fh)
        else:
            self._data = {}

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    def is_known(self, file_hash: str) -> bool:
        """Return True if file_hash is already registered."""
        return file_hash in self._data

    def get(self, file_hash: str) -> dict | None:
        """Return metadata for file_hash, or None if not found."""
        return self._data.get(file_hash)

    def all_entries(self) -> dict[str, dict]:
        """Return a shallow copy of all hash -> metadata entries."""
        return dict(self._data)

    def get_by_path(self, path: str) -> dict | None:
        """Return metadata whose path/raw_path/source_path equals ``path``.

        ``path`` is a registry path string (posix, relative to the KB dir
        when inside it) as produced by ``converter._registry_path``. Entries
        written before the path index existed carry none of these fields and
        never match.
        """
        for metadata in self._data.values():
            if path in (
                metadata.get("path"),
                metadata.get("raw_path"),
                metadata.get("source_path"),
            ):
                return metadata
        return None

    def find_legacy_by_stem(self, stem: str) -> tuple[str, dict] | None:
        """Find a pre-path-index entry matching ``stem``.

        Returns ``(file_hash, metadata)`` for an entry that has no truthy
        ``path`` (a missing or empty ``path`` is treated as unindexed) and
        whose ``doc_name`` — or, for even older entries lacking
        ``doc_name``, the stem of its ``name`` — equals ``stem``. When
        several legacy entries match (pre-fix registries can hold
        same-named entries), the first in insertion order is returned.
        Callers use the hash to backfill ``path`` via :meth:`add`. Returns
        None when every matching name is already path-indexed. The
        comparison is NFKC-normalized on both sides, so macOS NFD
        filenames match their NFC registry entries.
        """
        for file_hash, metadata in self._data.items():
            if metadata.get("path"):
                continue
            entry_name = metadata.get("doc_name") or Path(metadata.get("name", "")).stem
            if unicodedata.normalize("NFKC", entry_name) == unicodedata.normalize("NFKC", stem):
                return file_hash, metadata
        return None

    # ------------------------------------------------------------------
    # Mutation
    # ------------------------------------------------------------------

    def add(self, file_hash: str, metadata: dict) -> None:
        """Register file_hash with metadata and persist to disk."""
        self._data[file_hash] = metadata
        self._persist()

    def remove_by_doc_name(self, doc_name: str) -> bool:
        """Remove the entry whose metadata['doc_name'] matches. Returns True if removed."""
        for file_hash, meta in list(self._data.items()):
            if meta.get("doc_name") == doc_name:
                del self._data[file_hash]
                self._persist()
                return True
        return False

    def remove_by_hash(self, file_hash: str) -> bool:
        """Remove the entry keyed by ``file_hash``. Returns True if removed.

        Preferred over :meth:`remove_by_doc_name` when the caller already
        has the hash in hand — works regardless of whether the entry's
        metadata carries a ``doc_name`` field (legacy entries written
        before commit c504e26 do not).
        """
        if file_hash not in self._data:
            return False
        del self._data[file_hash]
        self._persist()
        return True

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _persist(self) -> None:
        atomic_write_json(self._path, self._data)

    # ------------------------------------------------------------------
    # Static utility
    # ------------------------------------------------------------------

    @staticmethod
    def hash_file(path: Path) -> str:
        """Return the SHA-256 hex digest (64 chars) of the file at path."""
        h = hashlib.sha256()
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

```

### Core Architecture Module: `openkb/tree_renderer.py`
```
"""Markdown renderers for PageIndex tree structures."""

from __future__ import annotations

from openkb import frontmatter


def _yaml_frontmatter(source_name: str, doc_id: str, description: str = "") -> str:
    """Return a YAML frontmatter block for a PageIndex wiki page."""
    lines = [frontmatter.kv_line("type", "Summary")]
    if description:
        lines.append(frontmatter.kv_line("description", description))
    lines.append("doc_type: pageindex")
    lines.append(frontmatter.kv_line("full_text", f"sources/{source_name}.json"))
    return "---\n" + "\n".join(lines) + "\n---\n"


def _render_nodes_summary(nodes: list[dict], depth: int) -> str:
    """Recursively render nodes for the *summary* view (summaries only)."""
    lines: list[str] = []
    heading_prefix = "#" * min(depth, 6)
    for node in nodes:
        title = node.get("title", "")
        start = node.get("start_index", "")
        end = node.get("end_index", "")
        summary = node.get("summary", "")
        children = node.get("nodes", [])

        lines.append(f"{heading_prefix} {title} (pages {start}–{end})\n")
        if summary:
            lines.append(f"Summary: {summary}\n")
        if children:
            lines.append(_render_nodes_summary(children, depth + 1))

    return "\n".join(lines)


def render_summary_md(tree: dict, source_name: str, doc_id: str, description: str = "") -> str:
    """Render the summary Markdown page for a PageIndex tree.

    Renders each node as a heading with page range and its summary text.
    Includes a YAML frontmatter block with ``type: "Summary"`` and an
    optional ``description`` field.
    """
    frontmatter = _yaml_frontmatter(source_name, doc_id, description)
    structure = tree.get("structure", [])
    body = _render_nodes_summary(structure, depth=1)
    return frontmatter + "\n" + body

```

### Core Architecture Module: `frontend/eslint.config.js`
```
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])

```

### Core Architecture Module: `frontend/postcss.config.js`
```
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

```

### Core Architecture Module: `frontend/scripts/check-i18n.mjs`
```
#!/usr/bin/env node
// i18n guard — fails the build on either regression:
//   (1) a Chinese (CJK) literal in `src/**/*.{ts,tsx}` that is NOT a comment
//       and NOT a locale JSON — i.e. a hardcoded UI string that skipped t().
//   (2) a zh/en key-set drift in any `src/locales/{zh,en}/<ns>.json` pair
//       (a missing `en` key silently falls back to zh, so both directions matter).
//
// Comment-aware: strips `//`, `/* */`, JSDoc `* ` (inside a block), and JSX
// `{/* */}` (the `/* */` inside the braces) before scanning, while KEEPING
// string-literal and JSX-text content — so a Chinese string literal or a raw
// Chinese JSX text node is still caught. Zero deps; ESM; run from `frontend/`.

import { readFileSync, readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "src")
const LOCALES = join(SRC, "locales")
const CJK = /[一-鿿]/

/** Replace comments with spaces (newlines preserved), keeping string/template
 * literal contents and JSX text intact. A tiny state machine over the source. */
function stripComments(src) {
  let out = ""
  let state = "normal" // normal | line | block | sq | dq | tpl
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const n = src[i + 1] ?? ""
    if (state === "normal") {
      if (c === "/" && n === "/") { state = "line"; out += "  "; i++; continue }
      if (c === "/" && n === "*") { state = "block"; out += "  "; i++; continue }
      if (c === "'") { state = "sq"; out += c; continue }
      if (c === '"') { state = "dq"; out += c; continue }
      if (c === "`") { state = "tpl"; out += c; continue }
      out += c; continue
    }
    if (state === "line") {
      if (c === "\n") { state = "normal"; out += c } else { out += " " }
      continue
    }
    if (state === "block") {
      if (c === "*" && n === "/") { state = "normal"; out += "  "; i++; continue }
      out += c === "\n" ? "\n" : " "; continue
    }
    // string / template literal: preserve contents, honor escapes
    const quote = state === "sq" ? "'" : state === "dq" ? '"' : "`"
    if (c === "\\") { out += c + (src[i + 1] ?? ""); i++; continue }
    if (c === quote) { state = "normal"; out += c; continue }
    out += c
  }
  return out
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (p === LOCALES) continue // locale JSON is the source of truth, skip
      walk(p, acc)
    } else if (/\.tsx?$/.test(p)) {
      acc.push(p)
    }
  }
  return acc
}

// ---- Check 1: no leftover UI CJK outside comments/locales ------------------
const leftovers = []
for (const file of walk(SRC)) {
  const stripped = stripComments(readFileSync(file, "utf8"))
  stripped.split("\n").forEach((line, idx) => {
    if (CJK.test(line)) {
      leftovers.push(`${relative(ROOT, file)}:${idx + 1}: ${line.trim()}`)
    }
  })
}

// ---- Check 2: zh/en key-set parity across every namespace ------------------
function flatten(obj, prefix = "", keys = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, p, keys)
    else keys.add(p)
  }
  return keys
}

const parityErrors = []
const enDir = join(LOCALES, "en")
for (const f of readdirSync(enDir).filter((f) => f.endsWith(".json"))) {
  const ns = f.slice(0, -5)
  const en = flatten(JSON.parse(readFileSync(join(LOCALES, "en", f), "utf8")))
  const zh = flatten(JSON.parse(readFileSync(join(LOCALES, "zh", f), "utf8")))
  const onlyEn = [...en].filter((k) => !zh.has(k))
  const onlyZh = [...zh].filter((k) => !en.has(k))
  if (onlyEn.length) parityErrors.push(`${ns}: keys only in en → ${onlyEn.join(", ")}`)
  if (onlyZh.length) parityErrors.push(`${ns}: keys only in zh → ${onlyZh.join(", ")}`)
}

// ---- Report ----------------------------------------------------------------
let failed = false
if (leftovers.length) {
  failed = true
  console.error("i18n guard: hardcoded Chinese UI literal(s) found outside locale files.")
  console.error("Move the string into src/locales/{zh,en}/<ns>.json and wrap it with t().\n")
  for (const l of leftovers) console.error("  " + l)
  console.error("")
}
if (parityErrors.length) {
  failed = true
  console.error("i18n guard: zh/en locale key-set drift (a missing en key falls back to zh).\n")
  for (const e of parityErrors) console.error("  " + e)
  console.error("")
}

if (failed) process.exit(1)
console.log("i18n guard: OK (no leftover UI CJK; zh/en key sets identical across all namespaces).")

```

### Core Architecture Module: `frontend/src/App.tsx`
```
import { useEffect, useState } from "react"
import { Routes, Route, useParams } from "react-router"
import { MotionConfig } from "motion/react"
import { KeyRound, Loader2 } from "lucide-react"
import AppSidebar from "@/components/AppSidebar"
import TitleBar from "@/components/TitleBar"
import { ThemeToggle } from "@/lib/theme"
import { LanguageToggle } from "@/lib/language"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getApiBase, getToken, onUnauthorized, setConnection } from "@/api/client"
import Home from "@/pages/Home"
import ChatSession from "@/pages/ChatSession"
import KbList from "@/pages/KbList"
import KbDetail from "@/pages/KbDetail"
import Settings from "@/pages/Settings"

/** Remount KbDetail per KB so its page/tree state resets cleanly on nav. */
function KbDetailRoute() {
  const { id = "" } = useParams()
  return <KbDetail key={id} />
}

const inputCls =
  "mt-1.5 w-full h-9 rounded-md border border-input bg-transparent px-3 text-[13px] font-mono2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-accent-brand"

/**
 * Reactive connection prompt. Opened only when a request 401s — i.e. the server
 * has a bearer token configured and this client isn't sending the right one.
 * Mirrors the opt-in auth model: local-first (no token) works with no prompt;
 * we ask for a token only when the server actually demands one.
 */
function ConnectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { t } = useTranslation("common")
  const [base, setBase] = useState("")
  const [token, setToken] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Prefill from the stored connection each time the dialog opens.
  useEffect(() => {
    if (open) {
      setBase(getApiBase())
      setToken(getToken())
      setSubmitting(false)
    }
  }, [open])

  const submit = () => {
    setSubmitting(true)
    setConnection(base.trim(), token.trim())
    // Full reload re-runs every page's fetches with the new credentials. The
    // HashRouter route lives in the URL fragment, so the current view is kept.
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-accent-brand" />
            {t("auth.title")}
          </DialogTitle>
          <DialogDescription>{t("auth.description")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-[12px] font-medium text-muted-foreground">
              {t("auth.tokenLabel")}
            </label>
            <input
              autoFocus
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground">
              {t("auth.baseLabel")}
            </label>
            <input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="http://127.0.0.1:7566"
              className={inputCls}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("auth.connect")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function App() {
  const [authOpen, setAuthOpen] = useState(false)

  const isDesktopShell =
    typeof (window as { __OPENKB_DESKTOP__?: unknown }).__OPENKB_DESKTOP__ !== "undefined"

  // Register the reactive 401 handler once. Any request that 401s opens the
  // connection prompt (idempotent — repeated 401s just keep it open).
  useEffect(() => {
    onUnauthorized(() => setAuthOpen(true))
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div className="ambient-ground h-screen w-screen flex overflow-hidden">
        {isDesktopShell && (
          <div className="absolute top-0 inset-x-0 z-50">
            <TitleBar />
          </div>
        )}
        <div className="flex flex-1 min-h-0 w-full">
          <AppSidebar />
          <main className="relative flex-1 min-w-0 overflow-hidden">
            {/* Global floating chrome cluster: overlays content on every route
                (not the sidebar). It owns a reserved top-right "chrome lane"
                (~112px from main's right edge) sized for the theme toggle NOW
                plus Sub-project H's future i18n switcher + gaps. Page-level
                right-anchored controls reserve that lane with `pr-28` so they
                always clear the pill — see KbList's header row and KbDetail's
                gear row. Clears the desktop TitleBar via a top offset. */}
            <div
              className={cn(
                "absolute right-3 z-40 flex items-center gap-1 rounded-full glass px-1 py-1",
                isDesktopShell ? "top-10" : "top-2.5",
              )}
            >
              <ThemeToggle className="text-muted-foreground hover:text-foreground transition-colors" />
              <LanguageToggle className="text-muted-foreground hover:text-foreground transition-colors" />
            </div>
            <Routes>
              <Route path="/" element={<Home />} />
              {/* No key={id}: ChatSession must NOT remount when runTurn adopts a
                  real session id mid-turn (the new→/chat/<sid> self-navigate) —
                  a remount there would abort the live stream and drop the
                  just-finished turn's artifact cards. Its restore effect instead
                  re-runs on an `id` change and reloads only when navigating to a
                  DIFFERENT saved session, so switching /chat/A→/chat/B still
                  shows the right one. */}
              <Route path="/chat/:id" element={<ChatSession />} />
              <Route path="/kb" element={<KbList />} />
              <Route path="/kb/:id" element={<KbDetailRoute />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
        <ConnectionDialog open={authOpen} onOpenChange={setAuthOpen} />
        <Toaster />
      </div>
    </MotionConfig>
  )
}

```

### Core Architecture Module: `frontend/src/api/artifacts.ts`
```
import { apiStream, fetchAsBlobUrl } from "./client"

/**
 * Deck/skill generator streams. Both post `{ kb, name, intent, stream: true }`
 * and emit SSE events `start` / `error` / `final` / `done`, where the `final`
 * event's data is `{ name, status, path }` (see `_iter_deck`/`_iter_skill` in
 * `openkb/api_helpers.py`). NOTE: this `final` shape differs from chat/query's
 * `final` — do not fold these through `mapSseEvent`/`foldSseEvent`.
 *
 * Pass an optional `signal` (threaded to the underlying `apiStream` fetch) to
 * make the stream cancellable: aborting it disconnects the client, which the
 * backend `_stream_deck`/`_stream_skill` handlers now honor. Backward-compatible
 * — callers that omit it get an uncancellable stream exactly as before.
 */
export function runDeckCommand(kb: string, name: string, intent: string, signal?: AbortSignal) {
  return apiStream("/api/v1/deck", { kb, name, intent, stream: true }, signal)
}

export function runSkillCommand(kb: string, name: string, intent: string, signal?: AbortSignal) {
  return apiStream("/api/v1/skill", { kb, name, intent, stream: true }, signal)
}

/**
 * Fetch the rendered deck HTML with the bearer token attached CLIENT-SIDE and
 * return a `blob:` URL. The returned URL is what a sandboxed `<iframe src>` must
 * point at — NEVER point an iframe/`<a download>` directly at this authenticated
 * `/api/...` endpoint, and never put the token in a query string. Caller owns
 * the returned URL and MUST `URL.revokeObjectURL` it when done.
 */
export function getDeckBlobUrl(kb: string, name: string): Promise<string> {
  return fetchAsBlobUrl(
    `/api/v1/deck/${encodeURIComponent(name)}?kb=${encodeURIComponent(kb)}`,
  )
}

/**
 * Fetch the rendered knowledge-graph HTML (self-contained) with the bearer token
 * attached CLIENT-SIDE and return a `blob:` URL for a sandboxed `<iframe src>`.
 * Same rules as {@link getDeckBlobUrl}: never a raw href to the API path, never a
 * token in a query string; caller MUST `URL.revokeObjectURL` when done.
 */
export function getGraphBlobUrl(kb: string): Promise<string> {
  return fetchAsBlobUrl(`/api/v1/graph/html?kb=${encodeURIComponent(kb)}`)
}

/**
 * Fetch the skill's `.zip` archive with the bearer token attached CLIENT-SIDE
 * and return a `blob:` URL suitable for a temporary `<a download>`. Same rules
 * as {@link getDeckBlobUrl}: never a raw href to the API path; caller must
 * revoke the URL.
 */
export function getSkillArchiveBlobUrl(kb: string, name: string): Promise<string> {
  return fetchAsBlobUrl(
    `/api/v1/skill/${encodeURIComponent(name)}/archive?kb=${encodeURIComponent(kb)}`,
  )
}

/**
 * Fetch a conversationally-written viewable HTML artifact (output/**.html) with
 * the bearer token attached CLIENT-SIDE and return a `blob:` URL for a sandboxed
 * `<iframe src>`. Same rules as {@link getDeckBlobUrl}: never a raw href to the
 * API path, never a token in a query string; caller MUST `URL.revokeObjectURL`.
 */
export function getOutputBlobUrl(kb: string, path: string): Promise<string> {
  return fetchAsBlobUrl(
    `/api/v1/output?kb=${encodeURIComponent(kb)}&path=${encodeURIComponent(path)}`,
  )
}

```

### Core Architecture Module: `frontend/src/api/chat.ts`
```
import { apiFetch, apiStream, type SseEvent } from "./client"
import i18n from "@/lib/i18n"

/**
 * A provenance "source" derived from a `tool_call` the agent made during a
 * turn.
 *
 * This is NOT a model-authored citation — the real backend emits no citations.
 * It is the set of wiki artifacts the agent actually *read*, reconstructed from
 * the live SSE `tool_call` stream via an explicit WHITELIST of tool names
 * (never a blacklist): only tools whose provenance we can name are surfaced;
 * every other tool name is ignored (see {@link toolCallSource}).
 *
 *  - kind `"page"`: a `read_file(path)` call. Clickable — the path resolves to
 *    a real wiki page via `/api/v1/page {kb, path}`.
 *  - kind `"doc"`: a `get_page_content(doc_name, pages)` call against a long
 *    (PageIndex) document's internal JSON metadata. No endpoint serves that, so
 *    it renders as a non-clickable label — still shown, so the answer's
 *    provenance is honest about having drawn on a long document, not only wiki
 *    pages.
 */
export interface Source {
  kind: "page" | "doc"
  /** Display label: the page path (kind `"page"`) or doc name (kind `"doc"`). */
  label: string
  /** Wiki-relative page path — present only for kind `"page"`. */
  path?: string
  /** Long-document name — present only for kind `"doc"`. */
  docName?: string
}

/**
 * One item in a turn's ORDERED, interleaved trace, preserving SSE arrival
 * order: a chunk of the model's narration/answer text, or one tool read.
 *
 *  - `text`: a contiguous run of `delta` text (one block of narration, or the
 *    final answer). Consecutive deltas coalesce into the same trailing step.
 *  - `tool`: one whitelisted read (`toolCallSource`). `done` flips true once a
 *    LATER tool call arrives (the previous read must have completed) or the
 *    turn settles (`final`/`done`), driving the ✅-when-resolved affordance.
 */
export type TurnStep =
  | { kind: "text"; text: string }
  | { kind: "tool"; source: Source; done: boolean }

/**
 * Accumulated state for ONE assistant turn, folded from the SSE event stream.
 *
 * Sources are per-turn: dedupe happens within this object only, never across a
 * whole session. The same page read again in a later turn is a distinct, valid
 * source and must not be suppressed by an earlier turn.
 */
export interface ChatTurnState {
  /** Answer text: accumulated from `delta` events (progressive) and confirmed
   *  by the `final` event. Kept flat alongside `steps` for session restore and
   *  any other consumer that wants the whole answer as one string. */
  answer: string
  /** Ordered, interleaved trace of narration text and tool reads, in SSE
   *  arrival order — the source of truth for step-by-step rendering. */
  steps: TurnStep[]
  /** Whitelisted, per-turn-deduped provenance, in first-seen order. */
  sources: Source[]
  /** Most recent in-progress read, for a live "reading X…" indicator; null once
   *  the turn is idle or finished. */
  reading: Source | null
  /** Chat session id — only chat's `final` carries it; query turns stay null. */
  sessionId: string | null
  /** Where a saved query answer landed (query's `final.saved_path`). */
  savedPath: string | null
  /** Turn count from chat's `final`. */
  turnCount: number | null
  /** True once the terminal `done` event arrives. */
  done: boolean
  /** Error message from an `error` event, else null. */
  error: string | null
  /** Viewable HTML files this turn produced via the chat agent's write_file
   *  tool (from `artifact` SSE events). `kb` is captured at fold time (the
   *  active KB when the artifact event arrived), NOT re-attached at render
   *  time — the top-level `kb` state can change mid-session (KB dropdown
   *  switch), and a historical turn's file must keep pointing at the KB it
   *  was actually produced under. */
  artifacts: { path: string; name: string; kb: string }[]
}

export function initialTurnState(): ChatTurnState {
  return {
    answer: "",
    steps: [],
    sources: [],
    reading: null,
    sessionId: null,
    savedPath: null,
    turnCount: null,
    done: false,
    error: null,
    artifacts: [],
  }
}

/** Normalize a wiki path for dedupe: strip a leading `./`, surrounding slashes,
 *  and a trailing `.md` so `summaries/x` and `summaries/x.md` collapse to one. */
function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.md$/i, "")
}

function sourceKey(s: Source): string {
  return s.kind === "page"
    ? `page:${normalizePath(s.path ?? "")}`
    : `doc:${(s.docName ?? "").trim()}`
}

/**
 * The WHITELIST. Turn a `tool_call` event's `data` into a {@link Source}, or
 * `null` to drop it.
 *
 * Only `read_file` and `get_page_content` are recognised; any other tool name
 * (`get_image`, or a tool added to the agent later) yields `null` and is
 * ignored. This is deliberately a whitelist, not a blacklist: an unknown future
 * tool never becomes a broken or misleading chip.
 *
 * `arguments` is a JSON string — parsed defensively; a parse failure or a
 * missing required field yields `null` rather than a half-formed source.
 */
export function toolCallSource(data: unknown): Source | null {
  const d = (data ?? {}) as { name?: unknown; arguments?: unknown }
  const name = d.name
  if (name !== "read_file" && name !== "get_page_content") return null

  let args: Record<string, unknown> = {}
  const raw = d.arguments
  if (typeof raw === "string" && raw.trim()) {
    try {
      args = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  } else if (raw && typeof raw === "object") {
    args = raw as Record<string, unknown>
  }

  if (name === "read_file") {
    const path = typeof args.path === "string" ? args.path.trim() : ""
    if (!path) return null
    return { kind: "page", label: path, path }
  }
  // get_page_content
  const docName = typeof args.doc_name === "string" ? args.doc_name.trim() : ""
  if (!docName) return null
  return { kind: "doc", label: docName, docName }
}

/** Append a source to a per-turn list, deduped by normalized key. First-seen
 *  order is preserved. */
function mergeSource(list: Source[], s: Source): Source[] {
  const key = sourceKey(s)
  return list.some((x) => sourceKey(x) === key) ? list : [...list, s]
}

/** Append `delta` text to the CURRENT trailing text step, or start a new text
 *  step when the last step is a tool step (or the trace is empty). */
function appendDelta(steps: TurnStep[], text: string): TurnStep[] {
  const last = steps[steps.length - 1]
  if (last && last.kind === "text") {
    return [...steps.slice(0, -1), { kind: "text", text: last.text + text }]
  }
  return [...steps, { kind: "text", text }]
}

/** Flip every still-in-flight tool step to `done` (a fresh copy of any changed
 *  step; unchanged steps keep their identity). Exported so a stream that throws
 *  (see ChatSession's runTurn catch/finally) can settle any spinner still
 *  spinning on an unfinished tool read. */
export function markToolStepsDone(steps: TurnStep[]): TurnStep[] {
  return steps.map((s) => (s.kind === "tool" && !s.done ? { ...s, done: true } : s))
}

/** Rebuild a restored turn's TurnStep[] from its persisted trace. Text steps
 *  map directly; tool steps go through the same read-only whitelist used live
 *  (`toolCallSource`), so a non-read tool (e.g. write_file) yields null and is
 *  dropped — restore renders exactly what the live trace showed. Reads are
 *  already settled (done). */
export function stepsFromTrace(trace: PersistedTraceStep[]): TurnStep[] {
  const out: TurnStep[] = []
  for (const s of trace) {
    if (s.kind === "text") {
      if (typeof s.text === "string" && s.text) out.push({ kind: "text", text: s.text })
    } else if (s.kind === "tool") {
      const src = toolCallSource({ name: s.name, arguments: s.arguments })
      if (src) out.push({ kind: "tool", source: src, done: true })
    }
  }
  return out
}

/**
 * Defensively derive sources from a `final.history` array (the Agents SDK
 * `to_input_list()` record), if one is ever present.
 *
 * The current backend does NOT forward `history` over SSE — `_stream_query` and
 * `iter_chat_turn_events` deliberately strip it from the `final` frame to avoid
 * shipping large file/page contents to the browser — so this returns `null`
 * today and the live-accumulated `sources` are kept. It is retained as a
 * forward-compatible *preference*: if a future backend includes `history`, it
 * becomes the authoritative list and a dropped mid-stream `tool_call` can no
 * longer lose a source.
 */
export function sourcesFromHistory(history: unknown): Source[] | null {
  if (!Array.isArray(history)) return null
  let out: Source[] = []
  for (const item of history) {
    if (!item || typeof item !== "object") continue
    const record = item as { type?: unknown; name?: unknown; arguments?: unknown }
    const isCall =
      record.type === "function_call" ||
      (typeof record.name === "string" && "arguments" in record)
    if (!isCall) continue
    const src = toolCallSource({ name: record.name, arguments: record.arguments })
    if (src) out = mergeSource(out, src)
  }
  return out
}

/**
 * Fold one SSE event into the running turn state. Callers apply this per event
 * as the stream arrives (calling `setState`), so the UI reveals the answer and
 * the "reading" indicator live — no artificial delay.
 *
 * `kb` is the KB active at fold time (captured once by the caller at turn
 * start, e.g. `runTurn`'s `activeKb`), baked into any `artifact` produced this
 * turn — never re-derived from render-time state, so a later KB switch can't
 * retroactively repoint a historical turn's file artifact at the wrong KB.
 *
 * Real backend event shapes (verified against `openkb/api_helpers.py`):
 *   - `delta`     → `{ text }`            (incremental answer text)
 *   - `tool_call` → `{ name, arguments }` (arguments is a JSON string)
 *   - `final`  
```

### Core Architecture Module: `frontend/src/api/client.ts`
```
const LS_BASE = "openkb_api_base"
const LS_TOKEN = "openkb_token"

export function getApiBase(): string {
  return localStorage.getItem(LS_BASE) || ""
}
export function getToken(): string {
  return localStorage.getItem(LS_TOKEN) || ""
}
export function setConnection(apiBase: string, token: string): void {
  localStorage.setItem(LS_BASE, apiBase)
  localStorage.setItem(LS_TOKEN, token)
}

/**
 * Warn ONCE if the configured API base is cross-origin AND served over plain
 * `http:` — the bearer token is attached to every request, so such a base would
 * send it in the clear. Advisory only (console; no UI) and never blocking:
 * same-origin or a relative base (the production mount at `/`) is always safe
 * and never warns; a LAN/dev `http://` endpoint still works, just with a
 * heads-up. The flag flips only once we actually warn, so a base later switched
 * from safe to unsafe can still surface the warning.
 */
let baseSafetyWarned = false
function checkBaseSafety(): void {
  if (baseSafetyWarned) return
  const base = getApiBase()
  if (!base) return // same-origin
  try {
    const url = new URL(base, window.location.origin)
    if (url.origin !== window.location.origin && url.protocol === "http:") {
      baseSafetyWarned = true
      console.warn(
        `[OpenKB] API base "${base}" is cross-origin and served over http:. ` +
          "Your API token is sent to this host in the clear on every request. " +
          "Use https for a remote API, or verify this URL is trusted.",
      )
    }
  } catch {
    // Not a parseable URL — it fails at fetch time; nothing to warn about here.
  }
}

function baseUrl(): string {
  // Called by every request helper below (JSON, blob, SSE), so this is the one
  // place the base/token is first used — the right spot for the advisory.
  checkBaseSafety()
  return getApiBase().replace(/\/$/, "")
}

let unauthorizedHandler: (() => void) | null = null
export function onUnauthorized(cb: () => void): void {
  unauthorizedHandler = cb
}

export class ApiError extends Error {
  status: number
  /** Structured `detail` payload when the backend returns an object rather than
   *  a plain string — e.g. the 409 multiple-match `{ message, candidates }` from
   *  `POST /api/v1/remove`. `message` is lifted onto `.message`; the whole object
   *  is kept here so callers can read the structured fields (candidates, etc.).
   *  `undefined` for string-detail errors (404) and network failures. */
  detail?: unknown
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface FetchOpts {
  method?: string
  body?: unknown
}

/** JSON request/response helper. Attaches the bearer token when present. */
export async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(baseUrl() + path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401) unauthorizedHandler?.()
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    let structured: unknown
    try {
      const j = await res.json()
      const d = j.detail
      if (typeof d === "string") {
        // Plain-string detail (e.g. 404 "Document not found.") — unchanged path.
        detail = d
      } else if (d && typeof d === "object" && typeof (d as { message?: unknown }).message === "string") {
        // Structured detail (e.g. 409 multiple-match `{ message, candidates }`):
        // surface the human message, and keep the object so callers can read the
        // structured fields instead of seeing a raw JSON blob.
        detail = (d as { message: string }).message
        structured = d
      } else {
        detail = JSON.stringify(d ?? j)
      }
    } catch {
      // keep default message
    }
    const err = new ApiError(res.status, detail)
    err.detail = structured
    throw err
  }

  const ct = res.headers.get("content-type") || ""
  if (ct.includes("application/json")) return res.json() as Promise<T>
  return res.text() as unknown as Promise<T>
}

/**
 * Fetch raw bytes with the bearer header attached, returning a blob: URL.
 * Use this for anything an <iframe>/<a download> needs to point at — those
 * elements cannot carry an Authorization header, and the token must never
 * appear in a query string.
 */
export async function fetchAsBlobUrl(path: string): Promise<string> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(baseUrl() + path, { headers })
  if (res.status === 401) unauthorizedHandler?.()
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export interface SseEvent {
  event: string
  data: any
}

/**
 * SSE stream over fetch (EventSource can't set Authorization headers).
 *
 * Pass an optional `signal` to make the stream cancellable: aborting it rejects
 * the in-flight `fetch`/`reader.read()` with an `AbortError`, which propagates
 * out of this generator so the consumer's `for await` throws. The consumer can
 * then distinguish a user-abort (`e.name === "AbortError"` / `signal.aborted`)
 * from a real error and settle silently — see `ChatSession.runTurn`.
 */
export async function* apiStream(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(baseUrl() + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (res.status === 401) unauthorizedHandler?.()
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const blocks = buf.split("\n\n")
    buf = blocks.pop() ?? ""
    for (const block of blocks) {
      const lines = block.split("\n")
      const eventLine = lines.find((l) => l.startsWith("event: "))
      const dataLine = lines.find((l) => l.startsWith("data: "))
      if (!eventLine || !dataLine) continue
      yield {
        event: eventLine.slice("event: ".length),
        data: JSON.parse(dataLine.slice("data: ".length)),
      }
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #175** (2026-07-09): **Issue when using Amazon Bedrock**
  *Symptoms*: Hi team,  I'm not sure whether my configuration for Bedrock is correct, which I believe is not fully covered in the documentation/examples.  In `<kb>/.openkb/config.yaml`, I currently have:  ``` language: en model: bedrock/eu.anthropic.claude-sonnet-4-6 aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY aws_region_name: os.environ/AWS_REGION_NAME pageindex_threshold: 20 ```  In `<kb>/.env`, I have:  ``` AWS_ACCESS_KEY_ID=[REDACTED] AWS_SECRET_ACCESS_KEY=[REDACTED] AWS_REGION_NAME=eu-central-1 LLM_API_KEY=bedrock-api-key-[REDACTED] ```  When executing `query` or `chat`, I get the following error:  ``` [ERROR] litellm.BadRequestError: BedrockException - {"message":"The model returned the following errors: tool_choice.type: Field required"} ```  I found an open issue at https://github.com/BerriAI/litellm/issues/27184.  1. Is my configuration correct? For instance, I'm not sure whether `LLM_API_KEY` is necessary here, or whether it's enough with the access key/secret access key pair. 2. Is the error I'm getting indeed a LiteLLM issue, or something that can be fixed in OpenKB?
  **Post-Mortem & Fix Analysis**:
  > Really appreciate the feedback! I don't currently have Bedrock API access, so I'll need to do some investigation to pinpoint and fix the issue. When I have a fix ready, would you be open to testing it on your end?  And as always — if you spot any bugs or think of features you'd like to see, just shout!
  > @KylinMountain Thanks for your quick response! I'd be more than happy to test and debug this together!

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

### Incident Patch 1: `9036c2c7` (2026-07-20)
**Commit Message**: feat(web): 7566 default port + "web" install extra/command (api aliases kept) + panel chrome-lane fix (#193)

* feat(api): default port 7566 + name the install extra/command "web"

The API server also serves the Knowledge Workbench UI, so `web` reads truer
than `api` for what people install and run. Make `[web]` the canonical extra
and add an `openkb-web` console script; keep `[api]` (as a self-referential
alias) and `openkb-api` working for backwards compatibility. README and the
rest-api example now lead with the `web` names. `python -m openkb.api` (the
module path) is unchanged.

Also move the default API port off the crowded 8000 to 7566 ("KB" = ASCII
75,66) to cut collisions with other local dev servers. Updated: the argparse
default, the default CORS origins, the Vite dev-proxy target, the
connection-dialog placeholder, and the README/examples. A server already
running on 8000 keeps its port; the new default only applies to freshly
started servers.

Claude-Session: https://claude.ai/code/session_01XMxbhmAkxxVV8CFWCZDBaG

* fix(workbench): keep ArtifactPanel header buttons out from under the global chrome pills

The docked artifact panel's header action buttons (open-in-tab / 

**File**: `README.md` (modified, +5/-5)
```diff
@@ -123,13 +123,13 @@ Subscription-based providers that authenticate via OAuth device flow (e.g. `chat
 OpenKB ships a bundled web UI, served by the REST API at `/`. Install the API extra and start the server — no configuration needed:
 
 ```bash
-pip install "openkb[api]"
-openkb-api                       # serves the API + Workbench at http://127.0.0.1:8000/
+pip install "openkb[web]"
+openkb-web                       # serves the API + Workbench at http://127.0.0.1:7566/
 ```
 
-Open `http://127.0.0.1:8000/` for the Workbench. Auth is off by default (local-first); set `OPENKB_API_TOKEN` to require a bearer token before exposing the server. See the [full Web UI guide](examples/rest-api/README.md#knowledge-workbench-web-ui).
+Open `http://127.0.0.1:7566/` for the Workbench. Auth is off by default (local-first); set `OPENKB_API_TOKEN` to require a bearer token before exposing the server. See the [full Web UI guide](examples/rest-api/README.md#knowledge-workbench-web-ui).
 
-> Working on the UI itself? Run the Vite dev server with `cd frontend && npm install && npm run dev` (it proxies `/api` to a running `openkb-api`), or `npm run build` to regenerate the bundled `openkb/web/`.
+> Working on the UI itself? Run the Vite dev server with `cd frontend && npm install && npm run dev` (it proxies `/api` to a running `openkb-web`), or `npm run build` to regenerate the bundled `openkb/web/`.
 
 # 🧩 How OpenKB Works
 
@@ -341,7 +341,7 @@ The skill is read-only. It won't run `openkb add`, `remove`, or `lint --fix` wit
 
 # REST API
 
-OpenKB ships a FastAPI service for HTTP clients. Install with `pip install -e ".[api]"`, then start with `python -m openkb.api`. The interactive API reference is at [`/docs`](http://127.0.0.1:8000/docs) (importable into Postman).
+OpenKB ships a FastAPI service for HTTP clients. Install with `pip install -e ".[web]"`, then start with `python -m openkb.api`. The interactive API reference is at [`/docs`](http://127.0.0.1:7566/docs) (importable into Postman).
 
 See the [full REST API reference](examples/rest-api/README.md#rest-api) for endpoints, auth, and SSE streaming.
 
```

**File**: `examples/rest-api/README.md` (modified, +10/-10)
```diff
@@ -2,7 +2,7 @@
 
 This guide covers the OpenKB REST API (FastAPI) and the bundled Knowledge Workbench web UI.
 
-> The interactive API reference is served live at [`/docs`](http://127.0.0.1:8000/docs) (OpenAPI/Swagger) once the server is running — you can import `/openapi.json` directly into Postman.
+> The interactive API reference is served live at [`/docs`](http://127.0.0.1:7566/docs) (OpenAPI/Swagger) once the server is running — you can import `/openapi.json` directly into Postman.
 
 ## Knowledge Workbench (Web UI)
 
@@ -11,20 +11,20 @@ OpenKB ships a bundled web single-page app — the **Knowledge Workbench** — s
 
 ```bash
 # 1. Install with the API extra (the built UI ships inside the package)
-pip install "openkb[api]"
+pip install "openkb[web]"
 
 # 2. Start the server — no config needed for local use
-openkb-api --host 127.0.0.1 --port 8000   # serves the API + Workbench at http://127.0.0.1:8000/
+openkb-web --host 127.0.0.1 --port 7566   # serves the API + Workbench at http://127.0.0.1:7566/
 ```
 
 Optional environment variables:
 
 - `OPENKB_KB_ROOT` — where REST-created knowledge bases are stored (default `~/.config/openkb/kbs`).
 - `OPENKB_API_TOKEN` — set it to require bearer auth (see [Authentication](#authentication-and-common-behavior)); leave unset for open local use.
 
-> **From a source checkout?** The built bundle (`openkb/web/`) is git-ignored, so an editable install (`pip install -e ".[api]"`) has no UI until you build it once: `cd frontend && npm install && npm run build` (outputs to `openkb/web/`). Or run the Vite dev server with `npm run dev` (it proxies `/api` to a running `openkb-api`). Without the bundle, `openkb-api` serves only the REST API under `/api/v1` and `/` returns a 404.
+> **From a source checkout?** The built bundle (`openkb/web/`) is git-ignored, so an editable install (`pip install -e ".[web]"`) has no UI until you build it once: `cd frontend && npm install && npm run build` (outputs to `openkb/web/`). Or run the Vite dev server with `npm run dev` (it proxies `/api` to a running `openkb-web`). Without the bundle, `openkb-web` serves only the REST API under `/api/v1` and `/` returns a 404.
 
-Open `http://127.0.0.1:8000/` in your browser. With no `OPENKB_API_TOKEN` set it connects to the local API immediately — no prompt. (If a token is configured, a **Connection** dialog asks for it once and caches it in the browser; you can also open it manually to point the UI at a remote API base.) The Workbench then provides:
+Open `http://127.0.0.1:7566/` in your browser. With no `OPENKB_API_TOKEN` set it connects to the local API immediately — no prompt. (If a token is configured, a **Connection** dialog asks for it once and caches it in the browser; you can also open it manually to point the UI at a remote API base.) The Workbench then provides:
 
 - **Overview** — index/concept/summary/report stat cards, clickable concept chips, recent documents, and last-compile/lint activity.
 - **Documents** — drag-and-drop multi-file upload with per-file SSE progress, hash table, and delete with confirmation.
@@ -44,15 +44,15 @@ frontends, or other HTTP clients.
 Install the API dependencies if needed:
 
 ```bash
-pip install -e ".[api]"
+pip install -e ".[web]"
 ```
 
 Start the API server:
 
 ```powershell
 $env:OPENKB_API_TOKEN="test-token"
 $env:OPENKB_KB_ROOT="D:\project\OpenKB\kbs"
-.\.venv\Scripts\python.exe -m openkb.api --host 127.0.0.1 --port 8000
+.\.venv\Scripts\python.exe -m openkb.api --host 127.0.0.1 --port 7566
 ```
 
 ### Authentication and common behavior
@@ -61,7 +61,7 @@ Auth is **opt-in**, controlled by the `OPENKB_API_TOKEN` server environment
 variable:
 
 - **Unset (default)** — the API is unauthenticated. This is the local-first
-  default, so `openkb-api` and the Workbench work with no configuration.
+  default, so `openkb-web` and the Workbench work with no configuration.
 - **Set** — every request must carry the token, and the Workbench prompts for
   it once (cached in the browser):
 
@@ -73,7 +73,7 @@ variable:
 
 > **Exposing the server?** Always set `OPENKB_API_TOKEN` when binding to a
 > non-loopback host (e.g. `--host 0.0.0.0`) — otherwise the API, and every KB
-> it can reach, is world-open. `openkb-api` prints a warning in that case.
+> it can reach, is world-open. `openkb-web` prints a warning in that case.
 
 `OPENKB_KB_ROOT` is optional. It controls where REST-created knowledge bases
 are stored. If unset, OpenKB uses `~/.config/openkb/kbs`.
@@ -419,4 +419,4 @@ no watcher is active for that KB.
 stop after this many seconds). Stream events: `start`, the watcher's own events
 (e.g. `added`, `updated`, `failed`, `final`), `error`, `done`.
 
-The full OpenAPI schema is at [`/openapi.json`](http://127.0.0.1:8000/openapi.json) — importable into Postman or any OpenAPI-compatible client.
+The full OpenAPI schema is at [`/openapi.json`](http://127.0.0.1:7566/openapi.json) — importable into Postman or any OpenAPI-compatible client.
```

**File**: `frontend/src/App.tsx` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ function ConnectionDialog({
             <input
               value={base}
               onChange={(e) => setBase(e.target.value)}
-              placeholder="http://127.0.0.1:8000"
+              placeholder="http://127.0.0.1:7566"
               className={inputCls}
             />
           </div>
```

**File**: `frontend/src/components/ArtifactPanel.tsx` (modified, +5/-2)
```diff
@@ -222,8 +222,11 @@ export default function ArtifactPanel({
         className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-accent-brand/30"
       />
 
-      {/* header */}
-      <div className="shrink-0 h-12 flex items-center gap-2 px-3 border-b border-[hsl(var(--glass-border))]">
+      {/* header — pr-28 reserves the global top-right chrome lane (theme + i18n
+          pills in App.tsx, absolute right-3 z-40) so the panel's action buttons
+          (open / download / close) never sit UNDER it. Same reserve convention
+          as KbList's header row and KbDetail's gear row. */}
+      <div className="shrink-0 h-12 flex items-center gap-2 pl-3 pr-28 border-b border-[hsl(var(--glass-border))]">
         <HeaderIcon className="w-4 h-4 text-accent-brand shrink-0" />
         <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">
           {artifactLabel(active, t)}
```

**File**: `frontend/vite.config.ts` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ import path from "path"
 import react from "@vitejs/plugin-react"
 import { defineConfig } from "vite"
 
-// Dev server proxies /api to the OpenKB REST API on :8000; production
+// Dev server proxies /api to the OpenKB REST API on :7566; production
 // serves the built bundle from the same origin via FastAPI StaticFiles.
 // outDir MUST stay ../openkb/web — the wheel packages it from there
 // (see pyproject.toml [tool.hatch.build] artifacts).
@@ -22,7 +22,7 @@ export default defineConfig({
     port: 5173,
     proxy: {
       "/api": {
-        target: "http://127.0.0.1:8000",
+        target: "http://127.0.0.1:7566",
         changeOrigin: true,
       },
     },
```

**File**: `openkb/api.py` (modified, +1/-1)
```diff
@@ -776,7 +776,7 @@ async def api_not_found(path: str) -> Any:
 def main() -> None:
     parser = argparse.ArgumentParser(description="Run the OpenKB REST API.")
     parser.add_argument("--host", default="127.0.0.1")
-    parser.add_argument("--port", type=int, default=8000)
+    parser.add_argument("--port", type=int, default=7566)
     parser.add_argument("--reload", action="store_true")
     args = parser.parse_args()
 
```

**File**: `openkb/api_helpers.py` (modified, +2/-2)
```diff
@@ -69,8 +69,8 @@ def _configure_cors(app: FastAPI) -> None:
         origins = [o.strip() for o in raw.split(",") if o.strip()] or [
             "http://localhost:5173",
             "http://127.0.0.1:5173",
-            "http://localhost:8000",
-            "http://127.0.0.1:8000",
+            "http://localhost:7566",
+            "http://127.0.0.1:7566",
         ]
     # A wildcard origin with credentials is insecure: any site can issue
     # credentialed cross-origin requests. Reject this combination by forcing
```

**File**: `pyproject.toml` (modified, +7/-1)
```diff
@@ -59,6 +59,8 @@ Issues = "https://github.com/VectifyAI/OpenKB/issues"
 
 [project.scripts]
 openkb = "openkb.cli:cli"
+openkb-web = "openkb.api:main"
+# Backwards-compatible alias for the historical name; same entry point.
 openkb-api = "openkb.api:main"
 
 [tool.pytest.ini_options]
@@ -73,7 +75,11 @@ dev = [
     "mypy==1.15.0",
     "types-PyYAML==6.0.12.20260518",
 ]
-api = ["fastapi", "uvicorn", "python-multipart"]
+# The Knowledge Workbench Web UI is served by this FastAPI server. `web` is the
+# canonical extra; `api` is a backwards-compatible alias so an existing
+# `pip install "openkb[api]"` keeps working.
+web = ["fastapi", "uvicorn", "python-multipart"]
+api = ["openkb[web]"]
 
 [tool.hatch.version]
 source = "vcs"
```

---

### Incident Patch 2: `fabca428` (2026-07-20)
**Commit Message**: fix(deps): pin openai==2.44.0 to avoid InputTokensDetails breaking ch… (#191)

* fix(deps): pin openai==2.44.0 to avoid InputTokensDetails breaking change (#187)

openai 2.45.0 added a required, no-default field cache_write_tokens to
InputTokensDetails. openai-agents 0.17.3 builds that object without the
field, so every LLM response crashes usage parsing with a pydantic
ValidationError. openkb did not pin openai, so fresh installs resolved it
to 2.45/2.46 and broke on any model. Pin below 2.45 until openai-agents
adapts.

* chore(deps): update uv.lock for openai==2.44.0 pin (#187)

**File**: `pyproject.toml` (modified, +5/-0)
```diff
@@ -39,6 +39,11 @@ dependencies = [
     "watchdog==6.0.0",
     "litellm==1.87.2",
     "openai-agents==0.17.3",
+    # openai 2.45.0 added a required `cache_write_tokens` field to
+    # InputTokensDetails that openai-agents 0.17.3 does not set, crashing
+    # usage parsing on every response (issue #187). Pin below 2.45 until
+    # openai-agents catches up.
+    "openai==2.44.0",
     "pyyaml==6.0.3",
     "python-dotenv==1.2.2",
     "json-repair==0.59.10",
```

**File**: `uv.lock` (modified, +5/-3)
```diff
@@ -1919,7 +1919,7 @@ wheels = [
 
 [[package]]
 name = "openai"
-version = "2.37.0"
+version = "2.44.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "anyio" },
@@ -1931,9 +1931,9 @@ dependencies = [
     { name = "tqdm" },
     { name = "typing-extensions" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/32/50/5901f01ef14e6c27788beb91e54fef5d6204fb5fb9e97402fc8a14de2e32/openai-2.37.0.tar.gz", hash = "sha256:f4bc562cc5f3a43d40d678105572d9d44765f6e0f50c125f63055419b72f4bd9", size = 754706, upload-time = "2026-05-15T22:30:35.428Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/49/f5/7c7cb955305cb41f7f3c5fd7e0e38bf6bbf2658468863d4b7b868a5cb8df/openai-2.44.0.tar.gz", hash = "sha256:68a5a5ffad82b8ff7d451c437529fb64f7c3b8123aaf0c021966a882d9e3947d", size = 988753, upload-time = "2026-06-24T20:56:02.293Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/ed/4c/bce61680d0699a78a405fd9a67989b175ba020590428831aab2ab1d2be7c/openai-2.37.0-py3-none-any.whl", hash = "sha256:814633888b8f3b1ffd6615697c6e4ef93632d08b7c2e28c8c5ef3556e5a10107", size = 1303238, upload-time = "2026-05-15T22:30:32.767Z" },
+    { url = "https://files.pythonhosted.org/packages/ae/f4/561ed79fd94876160018a5e75254cfcb9b0e62d4dded9dcb20072e86d623/openai-2.44.0-py3-none-any.whl", hash = "sha256:0a2a3ab2e29aeda368700f662ff9ba0f9df17ba4c54577a64e08b8115a3cc0ad", size = 1366216, upload-time = "2026-06-24T20:55:58.882Z" },
 ]
 
 [[package]]
@@ -1963,6 +1963,7 @@ dependencies = [
     { name = "json-repair" },
     { name = "litellm" },
     { name = "markitdown", extra = ["docx", "pptx", "xls", "xlsx"] },
+    { name = "openai" },
     { name = "openai-agents" },
     { name = "pageindex" },
     { name = "portalocker" },
@@ -1998,6 +1999,7 @@ requires-dist = [
     { name = "litellm", specifier = "==1.87.2" },
     { name = "markitdown", extras = ["docx", "pptx", "xls", "xlsx"], specifier = "==0.1.5" },
     { name = "mypy", marker = "extra == 'dev'", specifier = "==1.15.0" },
+    { name = "openai", specifier = "==2.44.0" },
     { name = "openai-agents", specifier = "==0.17.3" },
     { name = "pageindex", specifier = "==0.3.0.dev3" },
     { name = "portalocker", specifier = "==3.2.0" },
```

---

### Incident Patch 3: `7cde4968` (2026-07-17)
**Commit Message**: feat: add REST API server and Knowledge Workbench web UI (#150)

* ﻿feat: add REST API server and Knowledge Workbench web UI

Add a production-ready REST API (FastAPI) and a bundled React single-page
app ("Knowledge Workbench") served at the same origin, so OpenKB can be
driven from the browser, Postman, or other HTTP clients without the CLI.

REST API (openkb/api.py):
- Endpoints under /api/v1: /kbs, /init, /add, /query, /chat,
  /chat/sessions{,/load,/delete}, /list, /status, /lint, /remove,
  /recompile, /watch/{start,stop,status}, /watch/events (SSE)
- Bearer-token auth, SSE streaming for query/chat/add/remove/recompile,
  multipart upload, and KB name resolution via OPENKB_KB_ROOT
- Shared SSE event layer (iter_agent_response_events) reused by query/chat
  so the CLI and API emit identical event streams
- Background file-watcher service (openkb/watch_service.py) for auto-compile

Knowledge Workbench (frontend/, built to web/):
- React + Vite dark three-pane workbench: Overview, Documents, Query,
  Chat, Maintenance, with a live retrieval/reasoning inspector timeline
- Streamed answers, multi-turn chat with persisted sessions, drag-and-drop
  upload with per-file progress, lint

**File**: `.env.example` (modified, +7/-0)
```diff
@@ -4,3 +4,10 @@
 # Gemini:    LLM_API_KEY=AIza...
 # DeepSeek:  LLM_API_KEY=sk-...
 LLM_API_KEY=your-key-here
+
+# Optional base URL override for OpenAI-compatible gateways
+# OPENAI_API_BASE=https://api.deepseek.com
+
+# --- REST API server variables (read by `openkb-api` / `python -m openkb.api`) ---
+# OPENKB_API_TOKEN=...   # required bearer token clients send as Authorization: Bearer <token>
+# OPENKB_KB_ROOT=...     # optional; where REST /init creates KBs (default: ~/.config/openkb/kbs)
```

**File**: `.github/workflows/ci.yml` (modified, +25/-1)
```diff
@@ -35,8 +35,12 @@ jobs:
       # would ignore the lockfile and let transitive versions float, defeating
       # the repo's exact-pin supply-chain policy. Run `uv lock` and commit the
       # lockfile whenever pyproject dependencies change.
+      #
+      # `--extra api` is required: the REST tests (tests/test_api*.py) import
+      # fastapi/uvicorn, which live in the `api` extra — without it pytest fails
+      # at collection with ModuleNotFoundError: fastapi.
       - name: Install (locked)
-        run: uv sync --locked --extra dev --python 3.12
+        run: uv sync --locked --extra dev --extra api --python 3.12
 
       # --no-sync: don't let `uv run` re-sync without the dev extra and
       # uninstall the tools it is about to run.
@@ -51,3 +55,23 @@ jobs:
 
       - name: Pytest
         run: uv run --no-sync pytest
+
+  # Build the Workbench SPA so a broken frontend (vite/config error, stale
+  # package-lock, JS error) is caught here at PR time rather than only in
+  # publish.yml after a release tag is pushed. Mirrors the release build step.
+  web:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@692973e3d937129bcbf40652eb9f2f61becf3332  # v4.1.7
+        with:
+          persist-credentials: false
+
+      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4
+        with:
+          node-version: "20"
+
+      - name: Build Workbench web bundle
+        working-directory: frontend
+        run: |
+          npm ci
+          npm run build
```

**File**: `.github/workflows/publish.yml` (modified, +13/-0)
```diff
@@ -37,6 +37,19 @@ jobs:
         with:
           python-version: "3.12"
 
+      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4
+        with:
+          node-version: "20"
+
+      # Build the Workbench SPA into openkb/web so it ships in the wheel/sdist
+      # (see pyproject `[tool.hatch.build] artifacts`). Without this step the
+      # published package would serve no UI.
+      - name: Build Workbench web bundle
+        working-directory: frontend
+        run: |
+          npm ci
+          npm run build
+
       - name: Install build tools
         run: pip install build
 
```

**File**: `.gitignore` (modified, +6/-0)
```diff
@@ -14,6 +14,7 @@ raw/
 wiki/
 .openkb/
 output/
+kbs/
 
 # Local only
 docs/internal/
@@ -24,3 +25,8 @@ docs/internal/
 # does not). The PDFs already tracked on main stay tracked — this only stops
 # new drops from being swept into commits.
 examples/docs/
+
+# Built Workbench web bundle (regenerate with `cd frontend && npm install && npm run build`).
+# Shipped inside the wheel via hatchling `artifacts`, never committed to git.
+/openkb/web/
+web/
```

**File**: `README.md` (modified, +60/-40)
```diff
@@ -13,7 +13,7 @@
 
 # OpenKB: Open LLM Knowledge Base
 
-<p align="center"><i>Scale to long documents&nbsp; • &nbsp;Reasoning-based retrieval&nbsp; • &nbsp;Native multi-modality&nbsp; • &nbsp;No Vector DB</i></p>
+<p align="center"><i>Scale to long documents  •  Reasoning-based retrieval  •  Native multi-modality  •  No Vector DB</i></p>
 
 </div>
 
@@ -49,6 +49,7 @@ OpenKB has two layers: a **wiki foundation** that compiles and maintains your kn
 - **Skill Factory:** Distills redistributable agent skills from your wiki.
 - **OKF-ready:** Wiki pages follow the [Google OKF](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing) specification for knowledge sharing.
 - **Obsidian-compatible:** The wiki is plain `.md` files with cross-links. Opens in Obsidian for graph view.
+- **Knowledge Workbench (Web UI):** A bundled web UI served at `/` to browse the KB, upload and compile documents, and stream queries and chats — all in the browser.
 
 # 🚀 Getting Started
 
@@ -117,6 +118,19 @@ LLM_API_KEY=your_llm_api_key
 
 Subscription-based providers that authenticate via OAuth device flow (e.g. `chatgpt/*`, `github_copilot/*`) need no API key; OpenKB skips the missing-key warning for them.
 
+### Knowledge Workbench (Web UI)
+
+OpenKB ships a bundled web UI, served by the REST API at `/`. Install the API extra and start the server — no configuration needed:
+
+```bash
+pip install "openkb[api]"
+openkb-api                       # serves the API + Workbench at http://127.0.0.1:8000/
+```
+
+Open `http://127.0.0.1:8000/` for the Workbench. Auth is off by default (local-first); set `OPENKB_API_TOKEN` to require a bearer token before exposing the server. See the [full Web UI guide](examples/rest-api/README.md#knowledge-workbench-web-ui).
+
+> Working on the UI itself? Run the Vite dev server with `cd frontend && npm install && npm run dev` (it proxies `/api` to a running `openkb-api`), or `npm run build` to regenerate the bundled `openkb/web/`.
+
 # 🧩 How OpenKB Works
 
 ### Architecture
@@ -127,12 +141,12 @@ Subscription-based providers that authenticate via OAuth device flow (e.g. `chat
 
 ### Short vs Long Document Handling
 
-| | Short documents | Long documents (PDF ≥ 20 pages) |
-|---|---|---|
-| **Convert** | markitdown → Markdown | PageIndex → tree index + summaries |
-| **Images** | Extracted inline (pymupdf) | Extracted by PageIndex |
-| **LLM reads** | Full text | Document trees |
-| **Result** | summary + concepts | summary + concepts |
+|               | Short documents            | Long documents (PDF ≥ 20 pages)    |
+| ------------- | -------------------------- | ---------------------------------- |
+| **Convert**   | markitdown → Markdown      | PageIndex → tree index + summaries |
+| **Images**    | Extracted inline (pymupdf) | Extracted by PageIndex             |
+| **LLM reads** | Full text                  | Document trees                     |
+| **Result**    | summary + concepts         | summary + concepts                 |
 
 Short documents are read in full by the LLM. Long PDFs are processed by [PageIndex](https://github.com/VectifyAI/PageIndex) into a hierarchical tree index. The LLM reads the tree instead of the full text, enabling accurate and scalable retrieval for long documents.
 
@@ -154,24 +168,24 @@ OpenKB commands fall into two layers: the **wiki foundation** (compile + manage
 
 ## Layer 1: 🧱 Wiki Foundation — compile and maintain
 
-| Command | Description |
-|---|---|
-| `openkb init` | Initialize a new knowledge base (interactive) |
+| Command                                                      | Description                                                                             |
+| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
+| `openkb init`                                                | Initialize a new knowledge base (interactive)                                           |
 | <code>openkb&nbsp;add&nbsp;&lt;file_or_dir_or_URL&gt;</code> | Add files, directories, or URLs and compile to wiki (URL content type is auto-detected) |
-| `openkb list` | List indexed documents and concepts |
-| `openkb status` | Show knowledge base stats |
-| `openkb watch` | Watch `raw/` and auto-compile new files |
-| `openkb lint` | Run structural and knowledge health checks |
+| `openkb list`                                                | List indexed documents and concepts                                                     |
+| `openkb status`                                              | Show knowledge base stats                                                               |
+| `openkb watch`                                               | Watch `raw/` and auto-compile new files                                                 |
+| `openkb lint`                                                | Run structural and knowled
```

**File**: `examples/rest-api/README.md` (added, +422/-0)
```diff
@@ -0,0 +1,422 @@
+# REST API & Knowledge Workbench
+
+This guide covers the OpenKB REST API (FastAPI) and the bundled Knowledge Workbench web UI.
+
+> The interactive API reference is served live at [`/docs`](http://127.0.0.1:8000/docs) (OpenAPI/Swagger) once the server is running — you can import `/openapi.json` directly into Postman.
+
+## Knowledge Workbench (Web UI)
+
+
+OpenKB ships a bundled web single-page app — the **Knowledge Workbench** — served directly by the REST server at `/`, so you get a full browser interface with no separate frontend process. The built UI is packaged in the `openkb` wheel, so a normal install already has it:
+
+```bash
+# 1. Install with the API extra (the built UI ships inside the package)
+pip install "openkb[api]"
+
+# 2. Start the server — no config needed for local use
+openkb-api --host 127.0.0.1 --port 8000   # serves the API + Workbench at http://127.0.0.1:8000/
+```
+
+Optional environment variables:
+
+- `OPENKB_KB_ROOT` — where REST-created knowledge bases are stored (default `~/.config/openkb/kbs`).
+- `OPENKB_API_TOKEN` — set it to require bearer auth (see [Authentication](#authentication-and-common-behavior)); leave unset for open local use.
+
+> **From a source checkout?** The built bundle (`openkb/web/`) is git-ignored, so an editable install (`pip install -e ".[api]"`) has no UI until you build it once: `cd frontend && npm install && npm run build` (outputs to `openkb/web/`). Or run the Vite dev server with `npm run dev` (it proxies `/api` to a running `openkb-api`). Without the bundle, `openkb-api` serves only the REST API under `/api/v1` and `/` returns a 404.
+
+Open `http://127.0.0.1:8000/` in your browser. With no `OPENKB_API_TOKEN` set it connects to the local API immediately — no prompt. (If a token is configured, a **Connection** dialog asks for it once and caches it in the browser; you can also open it manually to point the UI at a remote API base.) The Workbench then provides:
+
+- **Overview** — index/concept/summary/report stat cards, clickable concept chips, recent documents, and last-compile/lint activity.
+- **Documents** — drag-and-drop multi-file upload with per-file SSE progress, hash table, and delete with confirmation.
+- **Query** — streamed answers with `tool_call` reasoning shown live in the right-pane timeline; GFM Markdown rendering (bold, tables, code, etc.).
+- **Chat** — multi-turn streaming with a persisted session list: load history, resume a session, delete it.
+- **Maintenance** — lint (with optional auto-fix), recompile (all or single doc, SSE log), and a file-watcher toggle.
+
+A right-pane **Inspector** timeline shows the vectorless retrieval & reasoning steps for every streamed operation. Creating a new KB from the Workbench inherits the project-root `config.yaml` and LLM credentials (`.env`) so it runs queries out of the box. The UI is responsive — on narrow screens the three panes collapse to a single column with a hamburger nav.
+
+
+## REST API
+
+
+OpenKB also ships a FastAPI service for using a knowledge base from Postman,
+frontends, or other HTTP clients.
+
+Install the API dependencies if needed:
+
+```bash
+pip install -e ".[api]"
+```
+
+Start the API server:
+
+```powershell
+$env:OPENKB_API_TOKEN="test-token"
+$env:OPENKB_KB_ROOT="D:\project\OpenKB\kbs"
+.\.venv\Scripts\python.exe -m openkb.api --host 127.0.0.1 --port 8000
+```
+
+### Authentication and common behavior
+
+Auth is **opt-in**, controlled by the `OPENKB_API_TOKEN` server environment
+variable:
+
+- **Unset (default)** — the API is unauthenticated. This is the local-first
+  default, so `openkb-api` and the Workbench work with no configuration.
+- **Set** — every request must carry the token, and the Workbench prompts for
+  it once (cached in the browser):
+
+  ```text
+  Authorization: Bearer <OPENKB_API_TOKEN>
+  ```
+
+  A missing or wrong token is rejected with `401`.
+
+> **Exposing the server?** Always set `OPENKB_API_TOKEN` when binding to a
+> non-loopback host (e.g. `--host 0.0.0.0`) — otherwise the API, and every KB
+> it can reach, is world-open. `openkb-api` prints a warning in that case.
+
+`OPENKB_KB_ROOT` is optional. It controls where REST-created knowledge bases
+are stored. If unset, OpenKB uses `~/.config/openkb/kbs`.
+
+REST clients identify a knowledge base with `kb`, not a filesystem path. For
+example, `postman-kb` resolves to `$OPENKB_KB_ROOT/postman-kb`.
+
+Common status codes across all endpoints:
+
+- `200` — success.
+- `400` — invalid request body, unknown `kb`, or a KB that isn't an OpenKB dir
+  (missing `.openkb/` or `wiki/`).
+- `401` — missing or wrong bearer token (only when `OPENKB_API_TOKEN` is set).
+- `404` — referenced document/watcher not found (remove/recompile/watch-stop).
+- `409` — ambiguous identifier (remove/recompile) with `candidates` in `detail`.
+- `500` — server error.
+
+All JSON endpoints use `Content-Type: application/json`. `/api/v1/add` is the
+only `multipart/form-data` endpoint.
+
+###
```

**File**: `frontend/.gitignore` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+node_modules
+dist
+*.local
```

**File**: `frontend/index.html` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <title>OpenKB · Knowledge Workbench</title>
+    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css" />
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.jsx"></script>
+  </body>
+</html>
```

---

### Incident Patch 4: `0d905e40` (2026-07-13)
**Commit Message**: fix(images): write note-relative image links in sources pages (#181)

Short-doc source pages live at wiki/sources/<doc>.md but embedded
their images with wiki-root-relative links
(sources/images/<doc>/file.png). Markdown renderers resolve links
relative to the containing file — Obsidian, GitHub, VS Code — so
every image resolved to the non-existent
wiki/sources/sources/images/... and rendered broken.

- New md_image_ref() helper emits note-relative images/<doc>/...
  links, used by the three .md-visible writers
  (convert_pdf_with_images, extract_base64_images,
  copy_relative_images).
- Long-doc JSON page metadata keeps wiki-root-relative paths: it is
  internal, consumed by get_wiki_page_content/read_wiki_image against
  the wiki root. Now documented explicitly in the docstrings.
- read_wiki_image() retries note-relative paths under sources/, so
  agents can pass image paths verbatim as seen in either surface.
- Query/skill-factory prompts and the openkb skill's wiki-schema.md
  updated to describe both path forms.

Existing KBs keep their old-style links (the read_wiki_image fallback
does not cover them in renderers); a migration helper for already
ingested sources pages is left

**File**: `openkb/agent/query.py` (modified, +9/-3)
```diff
@@ -37,8 +37,11 @@
    - PageIndex documents (doc_type: pageindex): use get_page_content(doc_name, pages)
      with tight page ranges. The summary shows document tree structure with page
      ranges to help you target. Never fetch the whole document.
-6. Source content may reference images (e.g. ![image](sources/images/doc/file.png)).
-   Use the get_image tool to view them when needed.
+6. Source content may reference images. Short-doc .md pages link them
+   note-relative (e.g. ![image](images/doc/file.png), resolved from
+   wiki/sources/); long-doc JSON page metadata lists them wiki-root-relative
+   (e.g. sources/images/doc/file.png). Pass either form as seen to the
+   get_image tool — it accepts both.
 7. Synthesize a clear, concise, well-cited answer grounded in wiki content.
 
 Answer based only on wiki content. Be concise.
@@ -81,7 +84,10 @@ def get_image(image_path: str) -> ToolOutputImage | ToolOutputText:
         you'd need to see to answer accurately.
 
         Args:
-            image_path: Image path relative to wiki root (e.g. 'sources/images/doc/p1_img1.png').
+            image_path: Image path as it appears in the content — either
+                wiki-root-relative ('sources/images/doc/p1_img1.png') or
+                note-relative as used in sources/ .md pages
+                ('images/doc/p1_img1.png').
         """
         result = read_wiki_image(image_path, wiki_root)
         if result["type"] == "image":
```

**File**: `openkb/agent/tools.py` (modified, +11/-2)
```diff
@@ -147,7 +147,10 @@ def read_wiki_image(path: str, wiki_root: str) -> dict:
     """Read an image file from the wiki and return as base64 data URL.
 
     Args:
-        path: Image path relative to *wiki_root* (e.g. ``"sources/images/doc/p1_img1.png"``).
+        path: Image path relative to *wiki_root*
+            (e.g. ``"sources/images/doc/p1_img1.png"``), or note-relative
+            as embedded in sources/ .md pages
+            (``"images/doc/p1_img1.png"`` — retried under ``sources/``).
         wiki_root: Absolute path to the wiki root directory.
 
     Returns:
@@ -161,7 +164,13 @@ def read_wiki_image(path: str, wiki_root: str) -> dict:
     if not full_path.is_relative_to(root):
         return {"type": "text", "text": "Access denied: path escapes wiki root."}
     if not full_path.exists():
-        return {"type": "text", "text": f"Image not found: {path}"}
+        # Source .md pages embed images note-relative ("images/<doc>/<file>",
+        # resolved from wiki/sources/). Callers pass those verbatim — retry
+        # under sources/ before failing.
+        alt_path = (root / "sources" / path).resolve()
+        if not (alt_path.is_relative_to(root) and alt_path.exists()):
+            return {"type": "text", "text": f"Image not found: {path}"}
+        full_path = alt_path
 
     mime = _MIME_TYPES.get(full_path.suffix.lower(), "image/png")
     b64 = base64.b64encode(full_path.read_bytes()).decode()
```

**File**: `openkb/images.py` (modified, +28/-9)
```diff
@@ -23,6 +23,19 @@
 _MIN_IMAGE_DIM = 32
 
 
+def md_image_ref(alt: str, doc_name: str, filename: str) -> str:
+    """Markdown image reference as written into ``wiki/sources/<doc>.md``.
+
+    Note-relative (``images/{doc}/{file}``): source pages live directly in
+    ``wiki/sources/``, so this resolves in every renderer that resolves links
+    relative to the containing file (Obsidian, GitHub, VS Code). Internal
+    metadata (the per-page JSON of long docs) keeps wiki-root-relative
+    ``sources/images/...`` paths instead — those are consumed by tools that
+    resolve against the wiki root, not rendered from a note.
+    """
+    return f"![{alt}](images/{doc_name}/{filename})"
+
+
 def extract_pdf_images(pdf_path: Path, doc_name: str, images_dir: Path) -> dict[int, list[str]]:
     """Extract images from a PDF using pymupdf's dict-mode block iteration.
 
@@ -31,7 +44,9 @@ def extract_pdf_images(pdf_path: Path, doc_name: str, images_dir: Path) -> dict[
     as PNG. This captures both embedded bitmaps *and* vector-rendered figures
     that ``get_images()`` would miss.
 
-    Returns a mapping of page_number (1-based) → list of relative image paths.
+    Returns a mapping of page_number (1-based) → list of image paths. Paths
+    are wiki-root-relative (``sources/images/...``) — internal metadata for
+    tools that resolve against the wiki root, not note-rendered markdown.
     """
     images_dir.mkdir(parents=True, exist_ok=True)
     page_images: dict[int, list[str]] = {}
@@ -77,7 +92,10 @@ def convert_pdf_to_pages(pdf_path: Path, doc_name: str, images_dir: Path) -> lis
     """Convert a PDF to per-page dicts with text content and images.
 
     Each dict has ``{"page": int, "content": str, "images": [{"path": str}]}``.
-    Images are saved to *images_dir* and referenced with wiki-root-relative paths.
+    Images are saved to *images_dir* and referenced with wiki-root-relative
+    ``sources/images/...`` paths — these pages land in ``sources/<doc>.json``
+    (never rendered from a note), and both ``get_wiki_page_content`` and
+    ``read_wiki_image`` resolve them against the wiki root.
     """
     images_dir.mkdir(parents=True, exist_ok=True)
     pages: list[dict] = []
@@ -134,8 +152,9 @@ def convert_pdf_with_images(pdf_path: Path, doc_name: str, images_dir: Path) ->
     """Convert a PDF to markdown with inline images using pymupdf dict-mode.
 
     Iterates blocks in reading order per page. Text blocks become text,
-    image blocks are saved to disk and replaced with ``![image](path)``
-    inline — preserving the original position in the document.
+    image blocks are saved to disk and replaced with a note-relative
+    ``![image](images/{doc_name}/...)`` link inline — preserving the
+    original position in the document.
 
     Returns the full markdown string.
     """
@@ -173,7 +192,7 @@ def convert_pdf_with_images(pdf_path: Path, doc_name: str, images_dir: Path) ->
                         filename = f"p{page_num}_img{img_counter}.png"
                         (images_dir / filename).write_bytes(pix.tobytes("png"))
                         pix = None
-                        parts.append(f"\n![image](sources/images/{doc_name}/{filename})\n")
+                        parts.append(f"\n{md_image_ref('image', doc_name, filename)}\n")
                     except Exception:
                         logger.warning("Failed to save image block on page %d", page_num)
     return "\n".join(parts)
@@ -184,7 +203,7 @@ def extract_base64_images(markdown: str, doc_name: str, images_dir: Path) -> str
 
     For each ``![alt](data:image/ext;base64,DATA)`` match:
     - Decode base64 bytes → save to ``images_dir/img_NNN.ext``
-    - Replace the link with ``![alt](sources/images/{doc_name}/img_NNN.ext)``
+    - Replace the link with ``![alt](images/{doc_name}/img_NNN.ext)``
     - On decode failure: log a warning and leave the original text unchanged.
     """
     counter = 0
@@ -208,7 +227,7 @@ def extract_base64_images(markdown: str, doc_name: str, images_dir: Path) -> str
         images_dir.mkdir(parents=True, exist_ok=True)
         dest.write_bytes(image_bytes)
 
-        new_ref = f"![{alt}](sources/images/{doc_name}/{filename})"
+        new_ref = md_image_ref(alt, doc_name, filename)
         result = result.replace(match.group(0), new_ref, 1)
 
     return result
@@ -220,7 +239,7 @@ def copy_relative_images(markdown: str, source_dir: Path, doc_name: str, images_
     For each ``![alt](relative/path)`` match (skipping http/https and data URIs):
     - Resolve path relative to ``source_dir``
     - Copy to ``images_dir/{filename}``
-    - Replace link with ``![alt](sources/images/{doc_name}/{filename})``
+    - Replace link with ``![alt](images/{doc_name}/{filename})``
     - Missing source file: log a warning and leave the original text unchanged.
     """
     result = markdown
@@ -254,7 +273,7 @@ def copy_relative_images(markdown: str, source_dir: Path, doc_name: str, images_
             im
```

**File**: `openkb/skill/creator.py` (modified, +4/-2)
```diff
@@ -105,8 +105,10 @@ def get_image(image_path: str) -> ToolOutputImage | ToolOutputText:
         need to see in order to distil it correctly into the skill.
 
         Args:
-            image_path: Path relative to wiki/
-                (e.g. ``"sources/images/doc/p1_img1.png"``).
+            image_path: Image path as it appears in the content — either
+                wiki-root-relative (``"sources/images/doc/p1_img1.png"``)
+                or note-relative as used in sources/ .md pages
+                (``"images/doc/p1_img1.png"``).
         """
         result = _read_image_impl(image_path, wiki_root)
         if result["type"] == "image":
```

**File**: `skills/openkb/references/wiki-schema.md` (modified, +5/-2)
```diff
@@ -99,8 +99,11 @@ thing, read the matching entity page first.
 
 ## `wiki/sources/<doc>.md` (short docs)
 
-The markitdown-converted full text. Image refs appear as
-`![](sources/images/<doc>/p1_img1.png)`.
+The markitdown-converted full text. Image refs are note-relative —
+`![](images/<doc>/p1_img1.png)` — and resolve from `wiki/sources/`
+(the files live in `wiki/sources/images/<doc>/`). The per-page JSON of
+long docs instead lists images wiki-root-relative
+(`sources/images/<doc>/...`).
 
 ## `wiki/sources/<doc>.json` (long PDFs)
 
```

**File**: `tests/test_agent_tools.py` (modified, +50/-0)
```diff
@@ -7,9 +7,59 @@
     list_wiki_files,
     parse_pages,
     read_wiki_file,
+    read_wiki_image,
     write_wiki_file,
 )
 
+FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
+
+
+# ---------------------------------------------------------------------------
+# read_wiki_image
+# ---------------------------------------------------------------------------
+
+
+class TestReadWikiImage:
+    def _make_image(self, tmp_path):
+        images_dir = tmp_path / "sources" / "images" / "doc"
+        images_dir.mkdir(parents=True)
+        (images_dir / "p1_img1.png").write_bytes(FAKE_PNG)
+
+    def test_reads_wiki_root_relative_path(self, tmp_path):
+        self._make_image(tmp_path)
+
+        result = read_wiki_image("sources/images/doc/p1_img1.png", str(tmp_path))
+
+        assert result["type"] == "image"
+        assert result["image_url"].startswith("data:image/png;base64,")
+
+    def test_reads_note_relative_path_from_sources(self, tmp_path):
+        # Source .md pages embed images as "images/<doc>/<file>" (relative to
+        # wiki/sources/); the tool must resolve those verbatim too.
+        self._make_image(tmp_path)
+
+        result = read_wiki_image("images/doc/p1_img1.png", str(tmp_path))
+
+        assert result["type"] == "image"
+        assert result["image_url"].startswith("data:image/png;base64,")
+
+    def test_missing_image_reports_not_found(self, tmp_path):
+        self._make_image(tmp_path)
+
+        result = read_wiki_image("images/doc/nope.png", str(tmp_path))
+
+        assert result["type"] == "text"
+        assert "not found" in result["text"].lower()
+
+    def test_path_escape_denied(self, tmp_path):
+        self._make_image(tmp_path)
+
+        result = read_wiki_image("../outside.png", str(tmp_path))
+
+        assert result["type"] == "text"
+        assert "Access denied" in result["text"]
+
+
 # ---------------------------------------------------------------------------
 # list_wiki_files
 # ---------------------------------------------------------------------------
```

**File**: `tests/test_images.py` (modified, +59/-8)
```diff
@@ -41,7 +41,7 @@ def test_single_base64_image_extracted(self, tmp_path):
 
         # Result should reference a saved file, not the raw base64
         assert "data:image/png;base64," not in result
-        assert "![alt text](sources/images/doc/img_001.png)" == result
+        assert "![alt text](images/doc/img_001.png)" == result
 
         # File should exist on disk
         saved = images_dir / "img_001.png"
@@ -56,8 +56,8 @@ def test_multiple_base64_images_numbered_sequentially(self, tmp_path):
         md = f"![fig1](data:image/png;base64,{b64_png})\n![fig2](data:image/jpeg;base64,{b64_jpg})"
         result = extract_base64_images(md, "doc", images_dir)
 
-        assert "![fig1](sources/images/doc/img_001.png)" in result
-        assert "![fig2](sources/images/doc/img_002.jpeg)" in result
+        assert "![fig1](images/doc/img_001.png)" in result
+        assert "![fig2](images/doc/img_002.jpeg)" in result
         assert (images_dir / "img_001.png").exists()
         assert (images_dir / "img_002.jpeg").exists()
 
@@ -85,7 +85,7 @@ def test_mixed_valid_invalid_base64(self, tmp_path, caplog):
 
         with caplog.at_level(logging.WARNING, logger="openkb.images"):
             result = extract_base64_images(md, "doc", images_dir)
-        assert "![good](sources/images/doc/img_001.png)" in result
+        assert "![good](images/doc/img_001.png)" in result
         assert f"data:image/png;base64,{bad}" in result
 
 
@@ -107,7 +107,7 @@ def test_existing_relative_image_copied_and_rewritten(self, tmp_path):
         md = "![diagram](diagram.png)"
         result = copy_relative_images(md, source_dir, "doc", images_dir)
 
-        assert "![diagram](sources/images/doc/diagram.png)" == result
+        assert "![diagram](images/doc/diagram.png)" == result
         assert (images_dir / "diagram.png").read_bytes() == FAKE_PNG
 
     def test_missing_relative_image_leaves_original(self, tmp_path, caplog):
@@ -157,8 +157,8 @@ def test_multiple_relative_images_all_copied(self, tmp_path):
         md = "![a](a.png)\n![b](b.jpg)"
         result = copy_relative_images(md, source_dir, "doc", images_dir)
 
-        assert "![a](sources/images/doc/a.png)" in result
-        assert "![b](sources/images/doc/b.jpg)" in result
+        assert "![a](images/doc/a.png)" in result
+        assert "![b](images/doc/b.jpg)" in result
         assert (images_dir / "a.png").exists()
         assert (images_dir / "b.jpg").exists()
 
@@ -195,4 +195,55 @@ def test_same_image_referenced_twice_is_copied_once(self, tmp_path):
         result = copy_relative_images(md, source_dir, "doc", images_dir)
 
         assert [p.name for p in images_dir.iterdir()] == ["logo.png"]
-        assert result.count("sources/images/doc/logo.png") == 2
+        assert result.count("images/doc/logo.png") == 2
+
+
+# ---------------------------------------------------------------------------
+# Note-relative resolution (Obsidian / GitHub compatibility)
+# ---------------------------------------------------------------------------
+
+
+class TestNoteRelativeResolution:
+    """Generated ``![...](...)`` links must resolve relative to the note.
+
+    Source pages live at ``wiki/sources/<doc>.md`` and their images at
+    ``wiki/sources/images/<doc>/`` — renderers that resolve links relative
+    to the containing file (Obsidian, GitHub, VS Code) must find the image.
+    A wiki-root-relative link (``sources/images/...``) would resolve to the
+    non-existent ``wiki/sources/sources/images/...`` from those notes.
+    """
+
+    @staticmethod
+    def _link_paths(markdown: str) -> list[str]:
+        import re
+
+        return re.findall(r"!\[[^\]]*\]\(([^)]+)\)", markdown)
+
+    def test_base64_image_ref_resolves_from_sources_note(self, tmp_path):
+        wiki = tmp_path / "wiki"
+        note = wiki / "sources" / "doc.md"
+        images_dir = wiki / "sources" / "images" / "doc"
+        images_dir.mkdir(parents=True)
+
+        md = f"![alt](data:image/png;base64,{_make_b64(FAKE_PNG)})"
+        result = extract_base64_images(md, "doc", images_dir)
+        note.write_text(result, encoding="utf-8")
+
+        for rel in self._link_paths(result):
+            assert (note.parent / rel).exists(), rel
+
+    def test_copied_image_ref_resolves_from_sources_note(self, tmp_path):
+        source_dir = tmp_path / "clip"
+        source_dir.mkdir()
+        (source_dir / "figure.png").write_bytes(FAKE_PNG)
+
+        wiki = tmp_path / "wiki"
+        note = wiki / "sources" / "doc.md"
+        images_dir = wiki / "sources" / "images" / "doc"
+        images_dir.mkdir(parents=True)
+
+        result = copy_relative_images("![f](figure.png)", source_dir, "doc", images_dir)
+        note.write_text(result, encoding="utf-8")
+
+        for rel in self._link_paths(result):
+            assert (note.parent / rel).exists(), rel
```

---

### Incident Patch 5: `6774c593` (2026-07-09)
**Commit Message**: fix(agent): make parallel_tool_calls configurable to fix Amazon Bedrock query/chat (#175) (#177)

* fix(agent): make parallel_tool_calls configurable; fixes Bedrock query/chat (#175)

**File**: `config.yaml.example` (modified, +10/-0)
```diff
@@ -2,6 +2,16 @@ model: gpt-5.4                   # LLM model (any LiteLLM-supported provider)
 language: en                     # Wiki output language
 pageindex_threshold: 20          # PDF pages threshold for PageIndex
 
+# Optional: whether the LLM agents (query, chat, lint, skill) may call tools
+# in parallel. Leave it UNSET (commented out) to keep OpenKB's per-agent
+# defaults. Setting it applies the SAME value to every agent:
+#   true    allow parallel tool calls
+#   false   force sequential tool calls
+#   null    don't send the setting at all (use the provider default) — REQUIRED
+#           for Amazon Bedrock Claude, which rejects the request when
+#           parallel_tool_calls is sent at all (any value). See #175.
+# parallel_tool_calls: null
+
 # Optional: override the entity-type vocabulary used for entity pages.
 # Omit this key to use the default 7 types
 # (person, organization, place, product, work, event, other).
```

**File**: `examples/configuration/README.md` (modified, +31/-0)
```diff
@@ -70,6 +70,16 @@ model: gpt-5.4                   # LLM model (any LiteLLM-supported provider)
 language: en                     # Wiki output language
 pageindex_threshold: 20          # PDF pages threshold for PageIndex
 
+# Optional: whether the LLM agents (query, chat, lint, skill) may call tools
+# in parallel. Leave it UNSET (commented out) to keep OpenKB's per-agent
+# defaults. Setting it applies the SAME value to every agent:
+#   true    allow parallel tool calls
+#   false   force sequential tool calls
+#   null    don't send the setting at all (use the provider default) — REQUIRED
+#           for Amazon Bedrock Claude, which rejects the request when
+#           parallel_tool_calls is sent at all (any value). See #175.
+# parallel_tool_calls: null
+
 # Optional: override the entity-type vocabulary used for entity pages.
 # Omit this key to use the default 7 types
 # (person, organization, place, product, work, event, other).
@@ -95,6 +105,7 @@ pageindex_threshold: 20          # PDF pages threshold for PageIndex
 | `model` | `gpt-5.4` | LLM used for all compile/query/chat work. |
 | `language` | `en` | Language the wiki is written in. |
 | `pageindex_threshold` | `20` | PDFs with this many pages **or more** take the long-doc (PageIndex) path; shorter ones go through the short-doc path. See [`pageindex-cloud/`](../pageindex-cloud/). |
+| `parallel_tool_calls` | unset | Whether the LLM agents (query, chat, lint, skill) may call tools in parallel. Unset keeps OpenKB's per-agent defaults; `true`/`false` force allow/sequential for every agent; `null` omits the setting (provider default). **Amazon Bedrock needs `null`** (see below). |
 | `entity_types` | 7 defaults | Custom vocabulary for entity pages. `other` is always kept. |
 | `litellm:` | – | A pass-through block for LiteLLM. See below. |
 
@@ -177,6 +188,26 @@ LLM_API_KEY=your-key-here
   won't warn about a missing one.
 - **PageIndex Cloud** uses a separate `PAGEINDEX_API_KEY` (see
   [`pageindex-cloud/`](../pageindex-cloud/)).
+- **Amazon Bedrock** (`model: bedrock/...`) authenticates with AWS credentials,
+  not `LLM_API_KEY`. Put them in `<kb>/.env` (LiteLLM/boto3 read them from the
+  environment); `LLM_API_KEY` isn't needed:
+
+  ```bash
+  # <kb>/.env
+  AWS_ACCESS_KEY_ID=...
+  AWS_SECRET_ACCESS_KEY=...
+  AWS_REGION_NAME=eu-central-1
+  ```
+
+  ```yaml
+  # <kb>/.openkb/config.yaml
+  model: bedrock/eu.anthropic.claude-sonnet-4-6
+  parallel_tool_calls: null   # REQUIRED for Bedrock Claude: sending
+                              # parallel_tool_calls at all (any value) makes
+                              # LiteLLM send a malformed tool_choice that Bedrock
+                              # rejects (#175). null tells OpenKB to omit it.
+                              # Write it as bare `null` — not `None` or "null".
+  ```
 
 **Where keys are read from** (first match wins, existing env always respected):
 
```

**File**: `openkb/agent/linter.py` (modified, +2/-5)
```diff
@@ -8,7 +8,7 @@
 from agents.model_settings import ModelSettings
 
 from openkb.agent.tools import list_wiki_files, read_wiki_file
-from openkb.config import get_extra_headers, get_timeout_extra_args
+from openkb.config import resolve_model_settings
 from openkb.schema import get_agents_md
 
 MAX_TURNS = 50
@@ -82,10 +82,7 @@ def read_file(path: str) -> str:
         instructions=instructions,
         tools=[list_files, read_file],
         model=f"litellm/{model}",
-        model_settings=ModelSettings(
-            extra_headers=get_extra_headers() or None,
-            extra_args=get_timeout_extra_args(),
-        ),
+        model_settings=ModelSettings(**resolve_model_settings(default_parallel_tool_calls=None)),
     )
 
 
```

**File**: `openkb/agent/query.py` (modified, +2/-6)
```diff
@@ -12,7 +12,7 @@
     read_wiki_image,
     write_kb_file,
 )
-from openkb.config import get_extra_headers, get_timeout_extra_args
+from openkb.config import resolve_model_settings
 from openkb.schema import get_agents_md
 
 MAX_TURNS = 50
@@ -95,11 +95,7 @@ def get_image(image_path: str) -> ToolOutputImage | ToolOutputText:
         instructions=instructions,
         tools=[read_file, get_page_content, get_image],
         model=f"litellm/{model}",
-        model_settings=ModelSettings(
-            parallel_tool_calls=False,
-            extra_headers=get_extra_headers() or None,
-            extra_args=get_timeout_extra_args(),
-        ),
+        model_settings=ModelSettings(**resolve_model_settings()),
     )
 
 
```

**File**: `openkb/cli.py` (modified, +6/-0)
```diff
@@ -56,6 +56,8 @@ def filter(self, record: logging.LogRecord) -> bool:
     register_kb,
     resolve_extra_headers,
     set_extra_headers,
+    resolve_parallel_tool_calls,
+    set_parallel_tool_calls,
     resolve_timeout,
     set_timeout,
     resolve_litellm_settings,
@@ -174,6 +176,8 @@ def _setup_llm_key(kb_dir: Path | None = None) -> None:
     provider: str | None = None
     extra_headers: dict[str, str] = {}
     timeout: float | None = None
+    parallel_tool_calls: bool | None = None
+    parallel_tool_calls_explicit = False
     litellm_settings: dict = {}
     if kb_dir is not None:
         config_path = kb_dir / ".openkb" / "config.yaml"
@@ -183,6 +187,7 @@ def _setup_llm_key(kb_dir: Path | None = None) -> None:
             provider = _extract_provider(str(model))
             extra_headers = resolve_extra_headers(config)
             timeout = resolve_timeout(config)
+            parallel_tool_calls, parallel_tool_calls_explicit = resolve_parallel_tool_calls(config)
             litellm_settings = resolve_litellm_settings(config)
             # `timeout` / `extra_headers` in the block route to the per-call
             # stashes (replacing the legacy top-level keys); the rest are globals.
@@ -194,6 +199,7 @@ def _setup_llm_key(kb_dir: Path | None = None) -> None:
                 timeout = resolve_timeout({"timeout": litellm_settings.pop("timeout")})
     set_extra_headers(extra_headers)
     set_timeout(timeout)
+    set_parallel_tool_calls(parallel_tool_calls, parallel_tool_calls_explicit)
     _apply_litellm_settings(litellm_settings)
 
     if not api_key:
```

**File**: `openkb/config.py` (modified, +60/-0)
```diff
@@ -144,6 +144,30 @@ def resolve_extra_headers(config: dict) -> dict[str, str]:
     return headers
 
 
+def resolve_parallel_tool_calls(config: dict) -> tuple[bool | None, bool]:
+    """Resolve the optional ``parallel_tool_calls:`` key to ``(value, was_explicit)``.
+
+    Absent → ``(None, False)`` so each agent applies its own default (see
+    ``resolve_model_settings``). ``true``/``false`` → that bool; explicit
+    ``null`` → ``None`` (omit — the Amazon Bedrock #175 escape hatch); both with
+    ``was_explicit=True`` so they override every agent uniformly. An invalid
+    value degrades to omit (never breaks a provider), with a warning.
+    """
+    if "parallel_tool_calls" not in config:
+        return None, False
+    value = config["parallel_tool_calls"]
+    if value is None:
+        return None, True
+    if isinstance(value, bool):
+        return value, True
+    logger.warning(
+        "config: 'parallel_tool_calls' must be true, false, or null, got %r "
+        "— omitting the setting.",
+        value,
+    )
+    return None, True
+
+
 def resolve_timeout(config: dict) -> float | None:
     """Resolve the optional ``timeout:`` key to a finite positive number of seconds.
 
@@ -243,6 +267,42 @@ def get_timeout_extra_args() -> dict[str, float] | None:
     return {"timeout": _runtime_timeout} if _runtime_timeout is not None else None
 
 
+# Process-wide agent ``parallel_tool_calls`` as ``(value, was_explicit)``, set
+# from config by the CLI and read when building agents. ``(None, False)`` = not
+# configured, so each agent falls back to its own default (resolve_model_settings).
+_runtime_parallel_tool_calls: tuple[bool | None, bool] = (None, False)
+
+
+def set_parallel_tool_calls(value: bool | None, was_explicit: bool) -> None:
+    """Set the process-wide ``parallel_tool_calls`` — see :func:`resolve_parallel_tool_calls`."""
+    global _runtime_parallel_tool_calls
+    _runtime_parallel_tool_calls = (value, was_explicit)
+
+
+def get_parallel_tool_calls() -> tuple[bool | None, bool]:
+    """Return the process-wide ``parallel_tool_calls`` as ``(value, was_explicit)``."""
+    return _runtime_parallel_tool_calls
+
+
+def resolve_model_settings(*, default_parallel_tool_calls: bool | None = False) -> dict[str, Any]:
+    """Assemble the agents-SDK ``ModelSettings`` kwargs from the process-wide LLM
+    runtime settings — the single place tool-using agent builders wire them in.
+
+    ``default_parallel_tool_calls`` (the caller's own historical default) is used
+    only when config didn't set ``parallel_tool_calls``; an explicit value always
+    wins. Tool-less agents (skill-eval graders) skip this and omit the setting —
+    the SDK forwards an explicit ``False`` even without tools, which strict
+    OpenAI-compatible endpoints reject.
+    """
+    value, was_explicit = get_parallel_tool_calls()
+    parallel_tool_calls = value if was_explicit else default_parallel_tool_calls
+    return {
+        "extra_headers": get_extra_headers() or None,
+        "extra_args": get_timeout_extra_args(),
+        "parallel_tool_calls": parallel_tool_calls,
+    }
+
+
 def load_config(config_path: Path) -> dict[str, Any]:
     """Load YAML config from config_path, merged with DEFAULT_CONFIG.
 
```

**File**: `openkb/skill/creator.py` (modified, +9/-13)
```diff
@@ -20,7 +20,7 @@
 from agents import Agent, Runner, ToolOutputImage, ToolOutputText, function_tool
 from agents.model_settings import ModelSettings
 
-from openkb.config import get_extra_headers, get_timeout_extra_args
+from openkb.config import resolve_model_settings
 from openkb.prompts import load_prompt
 from openkb.schema import get_agents_md
 from openkb.skill import skill_dir
@@ -154,18 +154,14 @@ def done(summary: str) -> str:
             done,
         ],
         model=f"litellm/{model}",
-        # Allow the model to issue multiple read tool calls in one turn —
-        # the compile's early phase is a fan-out (list dir -> read N
-        # summaries -> read N source page-ranges), and serialising each
-        # read into its own turn costs roughly 5-10 extra round-trips per
-        # compile. Writes serialise naturally because each
-        # `write_skill_file` depends on accumulated reads; the model has
-        # no reason to issue parallel writes to the same path.
-        model_settings=ModelSettings(
-            parallel_tool_calls=True,
-            extra_headers=get_extra_headers() or None,
-            extra_args=get_timeout_extra_args(),
-        ),
+        # Default to allowing parallel read tool calls — the compile's early
+        # phase is a fan-out (list dir -> read N summaries -> read N source
+        # page-ranges), and serialising each read into its own turn costs
+        # roughly 5-10 extra round-trips per compile. Writes serialise
+        # naturally because each `write_skill_file` depends on accumulated
+        # reads; the model has no reason to issue parallel writes to the
+        # same path. An explicit config value (e.g. `null` for Bedrock) wins.
+        model_settings=ModelSettings(**resolve_model_settings(default_parallel_tool_calls=True)),
     )
 
 
```

**File**: `tests/conftest.py` (modified, +4/-2)
```diff
@@ -5,12 +5,14 @@
 
 @pytest.fixture(autouse=True)
 def _reset_extra_headers():
-    """Keep the process-wide LLM extra-headers / timeout stashes from leaking across tests."""
-    from openkb.config import set_extra_headers, set_timeout
+    """Keep the process-wide LLM extra-headers / timeout / parallel-tool-calls
+    stashes from leaking across tests."""
+    from openkb.config import set_extra_headers, set_parallel_tool_calls, set_timeout
 
     yield
     set_extra_headers({})
     set_timeout(None)
+    set_parallel_tool_calls(None, False)
 
 
 @pytest.fixture
```

---

### Incident Patch 6: `d267db29` (2026-07-03)
**Commit Message**: fix(converter): move keep_data_uris to convert call and fix lint (#165)

**File**: `openkb/converter.py` (modified, +2/-2)
```diff
@@ -231,8 +231,8 @@ def convert_document(
             markdown = convert_pdf_with_images(src, doc_name, images_dir)
         else:
             # Non-PDF, non-MD: use markitdown (docx, pptx, html, etc.)
-            mid = MarkItDown(keep_data_uris=True)
-            result = mid.convert(str(src))
+            mid = MarkItDown()
+            result = mid.convert(str(src), keep_data_uris=True)
             markdown = result.text_content
             markdown = extract_base64_images(markdown, doc_name, images_dir)
 
```

**File**: `tests/test_converter.py` (modified, +6/-3)
```diff
@@ -146,14 +146,17 @@ def test_docx_conversion_enables_keep_data_uris(self, kb_dir, tmp_path):
 
         with (
             patch("openkb.converter.MarkItDown") as mock_markitdown,
-            patch("openkb.converter.extract_base64_images", return_value="converted markdown") as mock_extract,
+            patch(
+                "openkb.converter.extract_base64_images",
+                return_value="converted markdown",
+            ) as mock_extract,
         ):
             mock_markitdown.return_value.convert.return_value = mock_result
 
             result = convert_document(src, kb_dir)
 
-        mock_markitdown.assert_called_once_with(keep_data_uris=True)
-        mock_markitdown.return_value.convert.assert_called_once_with(str(src))
+        mock_markitdown.assert_called_once_with()
+        mock_markitdown.return_value.convert.assert_called_once_with(str(src), keep_data_uris=True)
         mock_extract.assert_called_once()
         assert result.skipped is False
         assert result.is_long_doc is False
```

---

### Incident Patch 7: `3889e974` (2026-07-02)
**Commit Message**: fix(converter): preserve docx embedded images from markitdown (#163)

Fixes #162.

**File**: `openkb/converter.py` (modified, +1/-1)
```diff
@@ -231,7 +231,7 @@ def convert_document(
             markdown = convert_pdf_with_images(src, doc_name, images_dir)
         else:
             # Non-PDF, non-MD: use markitdown (docx, pptx, html, etc.)
-            mid = MarkItDown()
+            mid = MarkItDown(keep_data_uris=True)
             result = mid.convert(str(src))
             markdown = result.text_content
             markdown = extract_base64_images(markdown, doc_name, images_dir)
```

**File**: `tests/test_converter.py` (modified, +30/-0)
```diff
@@ -131,6 +131,36 @@ def test_long_pdf_returns_is_long_doc(self, kb_dir, tmp_path):
         assert result.raw_path is not None
 
 
+# ---------------------------------------------------------------------------
+# convert_document — MarkItDown-backed formats
+# ---------------------------------------------------------------------------
+
+
+class TestConvertDocumentMarkItDown:
+    def test_docx_conversion_enables_keep_data_uris(self, kb_dir, tmp_path):
+        src = tmp_path / "report.docx"
+        src.write_bytes(b"fake docx")
+
+        mock_result = MagicMock()
+        mock_result.text_content = "![](data:image/png;base64,abc123)"
+
+        with (
+            patch("openkb.converter.MarkItDown") as mock_markitdown,
+            patch("openkb.converter.extract_base64_images", return_value="converted markdown") as mock_extract,
+        ):
+            mock_markitdown.return_value.convert.return_value = mock_result
+
+            result = convert_document(src, kb_dir)
+
+        mock_markitdown.assert_called_once_with(keep_data_uris=True)
+        mock_markitdown.return_value.convert.assert_called_once_with(str(src))
+        mock_extract.assert_called_once()
+        assert result.skipped is False
+        assert result.is_long_doc is False
+        assert result.source_path is not None
+        assert result.source_path.read_text(encoding="utf-8") == "converted markdown"
+
+
 # ---------------------------------------------------------------------------
 # _registry_path
 # ---------------------------------------------------------------------------
```

---

### Incident Patch 8: `d1d3f4dd` (2026-07-02)
**Commit Message**: fix(compiler): guard concept/entity generation against malformed & truncated LLM output (#161)

* fix(compiler): guard concept/entity generation against malformed & truncated LLM output

Two silent-data-loss bugs in _compile_concepts, both from trusting the
per-page LLM response shape:

- #158: a response returned as a JSON array (e.g. [{...}] or a multi-item
  list) reached .get() on a list and raised AttributeError, which the local
  except (JSONDecodeError, ValueError) did not catch — the page was dropped
  and, because the doc index records it as written, never retried. New
  _parse_page_json unwraps a single-element [{...}] array (recovering the
  common case) and returns None for other wrong shapes so the page is skipped
  cleanly instead of writing the raw JSON as its body.

- #148: a response that hit finish_reason=length was repaired by json_repair
  and written anyway, overwriting an existing concept page with truncated
  content while still reporting [OK]. _warn_if_truncated now reports whether it
  truncated, and the four page-generation calls pass raise_on_truncation=True
  so a truncated response skips the write (existing page preserved). Other
  callers (plan, summar

**File**: `openkb/agent/compiler.py` (modified, +91/-50)
```diff
@@ -392,7 +392,14 @@ def _fmt_messages(messages: list[dict], max_content: int = 200) -> str:
     return "\n".join(parts)
 
 
-def _llm_call(model: str, messages: list[dict], step_name: str, **kwargs) -> str:
+class TruncatedResponseError(Exception):
+    """Raised when an LLM response hit the length cap and the caller asked to
+    treat truncation as a failure (so a partial page is skipped, not written)."""
+
+
+def _llm_call(
+    model: str, messages: list[dict], step_name: str, raise_on_truncation: bool = False, **kwargs
+) -> str:
     """Single LLM call with animated progress and debug logging."""
     messages = _prepare_messages(model, messages)
     extra_headers = get_extra_headers()
@@ -411,16 +418,22 @@ def _llm_call(model: str, messages: list[dict], step_name: str, **kwargs) -> str
 
     response = litellm.completion(model=model, messages=messages, **kwargs)
     content = response.choices[0].message.content or ""
-    _warn_if_truncated(response, step_name, kwargs.get("max_tokens"))
+    truncated = _warn_if_truncated(response, step_name, kwargs.get("max_tokens"))
 
     spinner.stop(_format_usage(time.time() - t0, response.usage))
     logger.debug(
         "LLM response [%s]:\n%s", step_name, content[:500] + ("..." if len(content) > 500 else "")
     )
+    if raise_on_truncation and truncated:
+        raise TruncatedResponseError(
+            f"LLM [{step_name}] hit the length limit; skipping to avoid a truncated page"
+        )
     return content.strip()
 
 
-async def _llm_call_async(model: str, messages: list[dict], step_name: str, **kwargs) -> str:
+async def _llm_call_async(
+    model: str, messages: list[dict], step_name: str, raise_on_truncation: bool = False, **kwargs
+) -> str:
     """Async LLM call with timing output and debug logging."""
     messages = _prepare_messages(model, messages)
     extra_headers = get_extra_headers()
@@ -437,17 +450,32 @@ async def _llm_call_async(model: str, messages: list[dict], step_name: str, **kw
 
     response = await litellm.acompletion(model=model, messages=messages, **kwargs)
     content = response.choices[0].message.content or ""
-    _warn_if_truncated(response, step_name, kwargs.get("max_tokens"))
+    truncated = _warn_if_truncated(response, step_name, kwargs.get("max_tokens"))
 
     elapsed = time.time() - t0
     sys.stdout.write(f"    {step_name}... {_format_usage(elapsed, response.usage)}\n")
     sys.stdout.flush()
     logger.debug(
         "LLM response [%s]:\n%s", step_name, content[:500] + ("..." if len(content) > 500 else "")
     )
+    if raise_on_truncation and truncated:
+        raise TruncatedResponseError(
+            f"LLM [{step_name}] hit the length limit; skipping to avoid a truncated page"
+        )
     return content.strip()
 
 
+async def _llm_call_page_async(model: str, messages: list[dict], step_name: str, **kwargs) -> str:
+    """``_llm_call_async`` for a step that writes a wiki page from the response.
+
+    Hard-codes ``raise_on_truncation=True`` so a truncated response skips the
+    write instead of silently persisting a partial page (#148). Use this for
+    every page-generating call so the guarantee can't be forgotten at a new
+    call site.
+    """
+    return await _llm_call_async(model, messages, step_name, raise_on_truncation=True, **kwargs)
+
+
 async def _close_async_llm_clients() -> None:
     """Close LiteLLM's cached async (aiohttp) clients for the current loop.
 
@@ -465,22 +493,26 @@ async def _close_async_llm_clients() -> None:
         logger.debug("litellm async client cleanup failed", exc_info=True)
 
 
-def _warn_if_truncated(response, step_name: str, max_tokens: int | None) -> None:
-    """Emit a warning when the LLM hit the max_tokens cap.
+def _warn_if_truncated(response, step_name: str, max_tokens: int | None) -> bool:
+    """Warn when the LLM hit the max_tokens cap; return True if it did.
 
     ``json_repair`` will silently salvage the truncated prefix, so without
-    this the caller can't tell a short response from a cut-off one.
+    this the caller can't tell a short response from a cut-off one. Callers
+    that write a page from the response can pass ``raise_on_truncation=True``
+    to ``_llm_call``/`_llm_call_async`` to turn a truncated response into a
+    skip instead of persisting partial content.
     """
     try:
         finish_reason = response.choices[0].finish_reason
     except (AttributeError, IndexError):
-        return
+        return False
     if finish_reason != "length":
-        return
+        return False
     cap = f" (max_tokens={max_tokens})" if max_tokens else ""
     logger.warning("LLM [%s] hit length limit%s — output may be truncated.", step_name, cap)
     sys.stdout.write(f"    [WARN] {step_name} hit length limit{cap} — output may be truncated.\n")
     sys.stdout.flush()
+    return True
 
 
 def _parse_json(text: str) -> list | dict:
@@ -499,6 +531,46 @@ def _parse_json(text: str) -> list | dict:
     return result
 
 
+def
```

**File**: `tests/test_compiler.py` (modified, +183/-0)
```diff
@@ -1770,6 +1770,189 @@ async def ordered_acompletion(*args, **kwargs):
         assert "[[concepts/flash-attention]]" in index_text
         assert "[[concepts/attention]]" in index_text
 
+    def test_parse_page_json_unwraps_and_guards_shape(self):
+        """#158: _parse_page_json returns an object, unwraps a single-element
+        ``[{...}]`` array, and returns None for wrong-shaped-but-valid JSON."""
+        from openkb.agent.compiler import _parse_page_json
+
+        assert _parse_page_json('{"content": "x"}') == {"content": "x"}
+        assert _parse_page_json('[{"content": "x"}]') == {"content": "x"}  # unwrapped
+        assert _parse_page_json("[]") is None
+        assert _parse_page_json('[{"a": 1}, {"b": 2}]') is None
+        assert _parse_page_json('["a", "b"]') is None
+
+    @pytest.mark.asyncio
+    async def test_page_json_wrapped_in_single_array_is_recovered(self, tmp_path):
+        """#158: a page response the model wrapped as ``[{...}]`` (instead of a
+        bare object) is unwrapped and written, not dropped with an AttributeError."""
+        wiki = self._setup_wiki(tmp_path)
+        plan_response = json.dumps(
+            {"create": [{"name": "attention", "title": "Attention"}], "update": [], "related": []}
+        )
+        array_page = json.dumps([{"brief": "b", "content": "# Attention\n\nRecovered body."}])
+        with patch("openkb.agent.compiler.litellm") as mock_litellm:
+            mock_litellm.completion = MagicMock(side_effect=_mock_completion([plan_response]))
+            mock_litellm.acompletion = AsyncMock(side_effect=_mock_acompletion([array_page]))
+            await _compile_concepts(
+                wiki,
+                tmp_path,
+                "gpt-4o-mini",
+                {"role": "system", "content": "s"},
+                {"role": "user", "content": "d"},
+                "summary",
+                "test-doc",
+                5,
+            )
+        path = wiki / "concepts" / "attention.md"
+        assert path.exists(), "single-object array should be unwrapped and written"
+        text = path.read_text()
+        assert "Recovered body." in text
+        assert "[{" not in text  # not the raw JSON array text
+
+    @pytest.mark.asyncio
+    async def test_truncated_update_preserves_existing_page(self, tmp_path):
+        """#148: an update whose response hit finish_reason='length' must not
+        overwrite the existing (complete) page with truncated content."""
+        original = "---\nsources: [old.pdf]\n---\n\n# Attention\n\nComplete original body."
+        wiki = self._setup_wiki(tmp_path, existing_concepts={"attention": original})
+        plan_response = json.dumps(
+            {"create": [], "update": [{"name": "attention", "title": "Attention"}], "related": []}
+        )
+        truncated_page = json.dumps(
+            {"brief": "x", "content": "# Attention\n\nTruncated tail cut off"}
+        )
+
+        async def truncated_acompletion(*args, **kwargs):
+            mock_resp = MagicMock()
+            mock_resp.choices = [MagicMock()]
+            mock_resp.choices[0].message.content = truncated_page
+            mock_resp.choices[0].finish_reason = "length"
+            mock_resp.usage = MagicMock(prompt_tokens=100, completion_tokens=50)
+            mock_resp.usage.prompt_tokens_details = None
+            return mock_resp
+
+        with patch("openkb.agent.compiler.litellm") as mock_litellm:
+            mock_litellm.completion = MagicMock(side_effect=_mock_completion([plan_response]))
+            mock_litellm.acompletion = AsyncMock(side_effect=truncated_acompletion)
+            await _compile_concepts(
+                wiki,
+                tmp_path,
+                "gpt-4o-mini",
+                {"role": "system", "content": "s"},
+                {"role": "user", "content": "d"},
+                "summary",
+                "test-doc",
+                5,
+            )
+        text = (wiki / "concepts" / "attention.md").read_text()
+        assert "Complete original body." in text, "existing page must survive a truncated update"
+        assert "Truncated tail" not in text
+
+    @pytest.mark.asyncio
+    async def test_truncated_create_skips_partial_page(self, tmp_path):
+        """#148: a create whose response hit finish_reason='length' must not
+        write a partial page (which would be recorded as done and never retried)."""
+        wiki = self._setup_wiki(tmp_path)
+        plan_response = json.dumps(
+            {"create": [{"name": "ghost", "title": "Ghost"}], "update": [], "related": []}
+        )
+        truncated_page = json.dumps({"brief": "x", "content": "# Ghost\n\nPartial"})
+
+        async def truncated_acompletion(*args, **kwargs):
+            mock_resp = MagicMock()
+            mock_resp.choices = [MagicMock()]
+            mock_resp.choices[0].message.content = truncated_page
+            mock_resp.choices[0].finish_reason = "length"
+            mock_resp.usage = MagicMoc
```

---

### Incident Patch 9: `dce4972b` (2026-07-02)
**Commit Message**: fix(images): disambiguate relative images that share a basename (#160)

Two relative source images with the same basename but different paths
(e.g. a/logo.png and b/logo.png) overwrote each other in
sources/images/<doc>/, collapsing both markdown links onto one file.
Track the destination assigned to each source (so an image referenced
twice is copied once) and suffix genuine basename collisions
(logo.png -> logo_1.png).

Adapted from #122 by @jichaowang02-lang; drops that PR's second commit,
which seeded the taken-name set from the existing images_dir and thereby
broke re-convert idempotency (a changed same-basename image got a fresh
suffix each run, orphaning the old file and churning links).


Claude-Session: https://claude.ai/code/session_01UtbmJxjtw6FtP8fUXUKVtg

Co-authored-by: jichao wang <[REDACTED_EMAIL]>

**File**: `openkb/images.py` (modified, +18/-4)
```diff
@@ -224,6 +224,13 @@ def copy_relative_images(markdown: str, source_dir: Path, doc_name: str, images_
     - Missing source file: log a warning and leave the original text unchanged.
     """
     result = markdown
+    # Track the destination chosen for each already-copied source so the same
+    # image referenced twice isn't duplicated, plus the set of taken names so
+    # two *different* sources that share a basename (e.g. ``a/logo.png`` and
+    # ``b/logo.png``) don't overwrite each other and collapse both links onto a
+    # single image.
+    assigned: dict[Path, str] = {}
+    taken: set[str] = set()
 
     for match in _RELATIVE_RE.finditer(markdown):
         alt, rel_path = match.group(1), match.group(2)
@@ -235,10 +242,17 @@ def copy_relative_images(markdown: str, source_dir: Path, doc_name: str, images_
             logger.warning("Relative image not found: %s; leaving original link.", src)
             continue
 
-        filename = src.name
-        dest = images_dir / filename
-        images_dir.mkdir(parents=True, exist_ok=True)
-        shutil.copy2(src, dest)
+        filename = assigned.get(src)
+        if filename is None:
+            filename = src.name
+            n = 1
+            while filename in taken:
+                filename = f"{src.stem}_{n}{src.suffix}"
+                n += 1
+            assigned[src] = filename
+            taken.add(filename)
+            images_dir.mkdir(parents=True, exist_ok=True)
+            shutil.copy2(src, images_dir / filename)
 
         new_ref = f"![{alt}](sources/images/{doc_name}/{filename})"
         result = result.replace(match.group(0), new_ref, 1)
```

**File**: `tests/test_images.py` (modified, +35/-0)
```diff
@@ -161,3 +161,38 @@ def test_multiple_relative_images_all_copied(self, tmp_path):
         assert "![b](sources/images/doc/b.jpg)" in result
         assert (images_dir / "a.png").exists()
         assert (images_dir / "b.jpg").exists()
+
+    def test_same_basename_different_dirs_no_overwrite(self, tmp_path):
+        # Two distinct images sharing a basename must not overwrite each other
+        # (which would lose one image and point both links at the survivor).
+        source_dir = tmp_path / "source"
+        (source_dir / "a").mkdir(parents=True)
+        (source_dir / "b").mkdir(parents=True)
+        (source_dir / "a" / "logo.png").write_bytes(FAKE_PNG)
+        (source_dir / "b" / "logo.png").write_bytes(FAKE_JPG)
+
+        images_dir = tmp_path / "images" / "doc"
+        images_dir.mkdir(parents=True)
+
+        md = "![a](a/logo.png)\n![b](b/logo.png)"
+        result = copy_relative_images(md, source_dir, "doc", images_dir)
+
+        saved = sorted(p.name for p in images_dir.iterdir())
+        assert len(saved) == 2  # both copied, neither overwritten
+        assert {(images_dir / n).read_bytes() for n in saved} == {FAKE_PNG, FAKE_JPG}
+        links = sorted(line.split("](")[1].rstrip(")") for line in result.strip().splitlines())
+        assert links[0] != links[1]  # links point at different files
+
+    def test_same_image_referenced_twice_is_copied_once(self, tmp_path):
+        # Identical source referenced twice: copy once, both links agree.
+        source_dir = tmp_path / "source"
+        source_dir.mkdir()
+        (source_dir / "logo.png").write_bytes(FAKE_PNG)
+        images_dir = tmp_path / "images" / "doc"
+        images_dir.mkdir(parents=True)
+
+        md = "![x](logo.png)\n![y](logo.png)"
+        result = copy_relative_images(md, source_dir, "doc", images_dir)
+
+        assert [p.name for p in images_dir.iterdir()] == ["logo.png"]
+        assert result.count("sources/images/doc/logo.png") == 2
```

---

### Incident Patch 10: `4616e491` (2026-06-30)
**Commit Message**: feat: add serial crash-safe mutation recovery (#142)

* feat: add serial mutation recovery

* fix: stage URL add mutations

Keep URL ingests on add_single_file's staged conversion path so source artifacts are published only after the mutation snapshot exists and can roll back on failure.

Add regression coverage for URL failure cleanup while preserving downloaded raw files for retry, and replace legacy asyncio.run mocks with async compiler stubs to avoid unawaited coroutine warnings in the touched tests.

**File**: `openkb/agent/compiler.py` (modified, +15/-14)
```diff
@@ -36,6 +36,7 @@
     resolve_entity_types,
 )
 from openkb.lint import list_existing_wiki_targets, strip_ghost_wikilinks
+from openkb.locks import atomic_write_text
 from openkb.schema import INDEX_SEED, get_agents_md
 
 logger = logging.getLogger(__name__)
@@ -844,7 +845,7 @@ def _write_summary(wiki_dir: Path, doc_name: str, summary: str,
     fm_lines.append(f"doc_type: {doc_type}")
     fm_lines.append(_yaml_kv_line("full_text", f"sources/{doc_name}.{ext}"))
     fm_block = "---\n" + "\n".join(fm_lines) + "\n---\n\n"
-    (summaries_dir / f"{doc_name}.md").write_text(fm_block + summary, encoding="utf-8")
+    atomic_write_text(summaries_dir / f"{doc_name}.md", fm_block + summary)
 
 
 _SAFE_NAME_RE = re.compile(r'[^\w\-]')
@@ -904,7 +905,7 @@ def _write_concept(wiki_dir: Path, name: str, content: str, source_file: str, is
             if brief:
                 fm_lines.append(_yaml_kv_line("description", brief))
             existing = frontmatter.block(fm_lines) + clean
-            path.write_text(existing, encoding="utf-8")
+            atomic_write_text(path, existing)
             return
         # Guarantee type + refresh description on update; remove legacy brief:.
         ex_parts2 = frontmatter.split(existing)
@@ -916,7 +917,7 @@ def _write_concept(wiki_dir: Path, name: str, content: str, source_file: str, is
             # Drop legacy brief: lines (migrated to description:).
             fm_block = frontmatter.drop_line(fm_block, "brief")
             existing = fm_block + body
-        path.write_text(existing, encoding="utf-8")
+        atomic_write_text(path, existing)
     else:
         clean_parts = frontmatter.split(content)
         if clean_parts is not None:
@@ -928,7 +929,7 @@ def _write_concept(wiki_dir: Path, name: str, content: str, source_file: str, is
         if brief:
             fm_lines.append(_yaml_kv_line("description", brief))
         fm_block = "---\n" + "\n".join(fm_lines) + "\n---\n\n"
-        path.write_text(fm_block + content, encoding="utf-8")
+        atomic_write_text(path, fm_block + content)
 
 
 def _write_entity(
@@ -992,10 +993,10 @@ def _build_entity_frontmatter(sources: list[str]) -> str:
                     break
             merged = [source_file] + [s for s in recovered if s != source_file]
             existing = _build_entity_frontmatter(merged) + clean
-        path.write_text(existing, encoding="utf-8")
+        atomic_write_text(path, existing)
         return
 
-    path.write_text(_build_entity_frontmatter([source_file]) + clean, encoding="utf-8")
+    atomic_write_text(path, _build_entity_frontmatter([source_file]) + clean)
 
 
 _set_fm_line = frontmatter.set_line
@@ -1106,7 +1107,7 @@ def _add_related_link(
         text = _prepend_source_to_frontmatter(text, source_file)
 
     text += f"\n\nSee also: {link}"
-    path.write_text(text, encoding="utf-8")
+    atomic_write_text(path, text)
     return True
 
 
@@ -1133,7 +1134,7 @@ def _backlink_summary_pages(
     _ensure_h2_section(lines, section, quiet=True)
     for slug in reversed(missing):
         _insert_section_entry(lines, section, f"- [[{page_dir}/{slug}]]")
-    summary_path.write_text("\n".join(lines), encoding="utf-8")
+    atomic_write_text(summary_path, "\n".join(lines))
 
 
 def _backlink_pages(
@@ -1154,7 +1155,7 @@ def _backlink_pages(
         lines = text.split("\n")
         _ensure_h2_section(lines, "## Related Documents", quiet=True)
         _insert_section_entry(lines, "## Related Documents", f"- {link}")
-        path.write_text("\n".join(lines), encoding="utf-8")
+        atomic_write_text(path, "\n".join(lines))
 
 
 def _backlink_summary(wiki_dir: Path, doc_name: str, concept_slugs: list[str]) -> None:
@@ -1260,7 +1261,7 @@ def _remove_doc_from_pages(
             path.unlink()
             deleted.append(path.stem)
         elif new_text != text:
-            path.write_text(new_text, encoding="utf-8")
+            atomic_write_text(path, new_text)
             modified.append(path.stem)
 
     return {"modified": modified, "deleted": deleted}
@@ -1356,7 +1357,7 @@ def remove_doc_from_index(wiki_dir: Path, doc_name: str, concept_slugs_deleted:
         while _remove_section_entry(lines, "## Entities", entity_link):
             pass
 
-    index_path.write_text("\n".join(lines), encoding="utf-8")
+    atomic_write_text(index_path, "\n".join(lines))
 
 
 def _update_index(
@@ -1380,7 +1381,7 @@ def _update_index(
 
     index_path = wiki_dir / "index.md"
     if not index_path.exists():
-        index_path.write_text(INDEX_SEED, encoding="utf-8")
+        atomic_write_text(index_path, INDEX_SEED)
 
     lines = index_path.read_text(encoding="utf-8").split("\n")
 
@@ -1426,7 +1427,7 @@ def _update_index(
         else:
             _insert_section_entry(lines, "## Entities", entry)
 
-    index_path.write_text("\n".join(lines), encoding="utf-8")
+    atomic_write_text(index_path, "\n".join(lines))
 
 
 # -------------------------------------------------------
```

**File**: `openkb/cli.py` (modified, +274/-161)
```diff
@@ -13,6 +13,7 @@
 import shutil
 import sys
 import time
+import uuid
 from functools import wraps
 from pathlib import Path
 from typing import Literal
@@ -47,10 +48,11 @@ def filter(self, record: logging.LogRecord) -> bool:
     resolve_extra_headers, set_extra_headers, resolve_timeout, set_timeout,
     resolve_litellm_settings,
 )
-from openkb.converter import _registry_path, convert_document
-from openkb.indexer import import_cloud_document
+from openkb.converter import _registry_path, _sanitize_stem, convert_document
+from openkb.indexer import _write_long_doc_artifacts, prepare_cloud_import
 from openkb.locks import atomic_write_json, atomic_write_text, kb_ingest_lock, kb_read_lock
 from openkb.log import append_log
+from openkb.mutation import MutationSnapshot, publish_staged_tree, snapshot_paths
 from openkb.schema import AGENTS_MD, INDEX_SEED, PAGE_CONTENT_DIRS
 
 # Suppress warnings after all imports — markitdown overrides filters at import time
@@ -332,13 +334,83 @@ def _clear_existing_skill_dir(kb_dir: Path, name: str) -> None:
         shutil.rmtree(target)
 
 
-def add_single_file(file_path: Path, kb_dir: Path) -> Literal["added", "skipped", "failed"]:
+def _staging_dir_for(kb_dir: Path, file_path: Path) -> Path:
+    safe = _sanitize_stem(file_path.stem)
+    path = kb_dir / ".openkb" / "staging" / f"add-{safe}-{uuid.uuid4().hex[:8]}"
+    path.mkdir(parents=True, exist_ok=False)
+    return path
+
+
+def _cleanup_staging(path: Path | None) -> None:
+    if path is not None:
+        shutil.rmtree(path, ignore_errors=True)
+
+
+def _final_artifact_paths(result, kb_dir: Path) -> tuple[Path | None, Path | None]:
+    final_raw = None
+    final_source = None
+    if result.raw_path is not None:
+        final_raw = kb_dir / "raw" / result.raw_path.name
+    if result.source_path is not None:
+        final_source = kb_dir / "wiki" / "sources" / result.source_path.name
+    return final_raw, final_source
+
+
+def _snapshot_add_paths(
+    kb_dir: Path,
+    doc_name: str,
+    final_raw: Path | None,
+    final_source: Path | None,
+) -> list[Path]:
+    paths = [
+        kb_dir / ".openkb" / "hashes.json",
+        kb_dir / ".openkb" / "pageindex.db",
+        kb_dir / ".openkb" / "pageindex.db-wal",
+        kb_dir / ".openkb" / "pageindex.db-shm",
+        kb_dir / ".openkb" / "pageindex.db-journal",
+        kb_dir / ".openkb" / "files",
+        kb_dir / "wiki" / "summaries" / f"{doc_name}.md",
+        kb_dir / "wiki" / "sources" / f"{doc_name}.json",
+        kb_dir / "wiki" / "sources" / "images" / doc_name,
+        kb_dir / "wiki" / "concepts",
+        kb_dir / "wiki" / "entities",
+        kb_dir / "wiki" / "index.md",
+        kb_dir / "wiki" / "log.md",
+    ]
+    if final_raw is not None:
+        paths.append(final_raw)
+    if final_source is not None:
+        paths.append(final_source)
+    return paths
+
+
+def _run_compile_with_retry(coro_factory, label: str) -> None:
+    click.echo(f"  {label}...")
+    for attempt in range(2):
+        try:
+            asyncio.run(coro_factory())
+            return
+        except Exception as exc:
+            if attempt == 0:
+                click.echo("  Retrying compilation in 2s...")
+                time.sleep(2)
+            else:
+                click.echo(f"  [ERROR] Compilation failed: {exc}")
+                logger.debug("Compilation traceback:", exc_info=True)
+                raise
+
+
+def add_single_file(
+    file_path: Path, kb_dir: Path, *, stage: bool = True
+) -> Literal["added", "skipped", "failed"]:
     """Convert, index, and compile a single document under the KB mutation lock."""
     with kb_ingest_lock(kb_dir / ".openkb"):
-        return _add_single_file_locked(file_path, kb_dir)
+        return _add_single_file_locked(file_path, kb_dir, stage=stage)
 
 
-def _add_single_file_locked(file_path: Path, kb_dir: Path) -> Literal["added", "skipped", "failed"]:
+def _add_single_file_locked(
+    file_path: Path, kb_dir: Path, *, stage: bool = True
+) -> Literal["added", "skipped", "failed"]:
     """Convert, index, and compile a single document into the knowledge base.
 
     Steps:
@@ -363,129 +435,145 @@ def _add_single_file_locked(file_path: Path, kb_dir: Path) -> Literal["added", "
     _setup_llm_key(kb_dir)
     model: str = config.get("model", DEFAULT_CONFIG["model"])
 
-    # 2. Convert document
+    staging_dir = _staging_dir_for(kb_dir, file_path) if stage else None
+    snapshot: MutationSnapshot | None = None
+
+    # 2. Convert document into staging when possible.
     click.echo(f"Adding: {file_path.name}")
     try:
-        result = convert_document(file_path, kb_dir)
+        result = convert_document(file_path, kb_dir, staging_dir=staging_dir)
     except Exception as exc:
         click.echo(f"  [ERROR] Conversion failed: {exc}")
         logger.debug("Conversion traceback:", exc_info=True)
+        _cleanup_staging(staging_dir)
         return "failed"
 
     if result.skipped:
         cl
```

**File**: `openkb/converter.py` (modified, +104/-84)
```diff
@@ -14,6 +14,7 @@
 
 from openkb.config import load_config
 from openkb.images import copy_relative_images, extract_base64_images, convert_pdf_with_images
+from openkb.locks import atomic_write_text, kb_ingest_lock
 from openkb.state import HashRegistry
 
 logger = logging.getLogger(__name__)
@@ -70,7 +71,13 @@ def _name_taken(candidate: str, registry: HashRegistry) -> bool:
     return False
 
 
-def resolve_doc_name(src: Path, kb_dir: Path, registry: HashRegistry) -> str:
+def resolve_doc_name(
+    src: Path,
+    kb_dir: Path,
+    registry: HashRegistry,
+    *,
+    persist_legacy: bool = True,
+) -> str:
     """Resolve the stable wiki name for ``src`` (Scheme A).
 
     Identity is keyed by path: a source we've seen before (same path, even
@@ -93,9 +100,10 @@ def resolve_doc_name(src: Path, kb_dir: Path, registry: HashRegistry) -> str:
         file_hash, meta = legacy
         meta = dict(meta)
         name = meta.get("doc_name") or Path(meta.get("name", "")).stem
-        meta["doc_name"] = name
-        meta["path"] = path_key
-        registry.add(file_hash, meta)  # backfill + persist
+        if persist_legacy:
+            meta["doc_name"] = name
+            meta["path"] = path_key
+            registry.add(file_hash, meta)  # backfill + persist
         return name
 
     return resolve_doc_name_from_key(src.stem, path_key, registry)
@@ -130,7 +138,12 @@ def get_pdf_page_count(path: Path) -> int:
         return doc.page_count
 
 
-def convert_document(src: Path, kb_dir: Path) -> ConvertResult:
+def convert_document(
+    src: Path,
+    kb_dir: Path,
+    *,
+    staging_dir: Path | None = None,
+) -> ConvertResult:
     """Convert a document and integrate it into the knowledge base.
 
     Steps:
@@ -141,86 +154,93 @@ def convert_document(src: Path, kb_dir: Path) -> ConvertResult:
     5. Otherwise — run MarkItDown, extract base64 images, save to ``wiki/sources/``.
     6. Register hash in the registry.
     """
-    # ------------------------------------------------------------------
-    # Load config & state
-    # ------------------------------------------------------------------
-    openkb_dir = kb_dir / ".openkb"
-    config = load_config(openkb_dir / "config.yaml")
-    threshold: int = config.get("pageindex_threshold", 20)
-    registry = HashRegistry(openkb_dir / "hashes.json")
-
-    # ------------------------------------------------------------------
-    # 1. Hash check + identity resolution
-    # ------------------------------------------------------------------
-    file_hash = HashRegistry.hash_file(src)
-    if registry.is_known(file_hash):
-        logger.info("Skipping already-known file: %s", src.name)
-        stored = registry.get(file_hash) or {}
-        return ConvertResult(
-            skipped=True,
-            file_hash=file_hash,
-            doc_name=stored.get("doc_name") or Path(stored.get("name", src.name)).stem,
-        )
-    doc_name = resolve_doc_name(src, kb_dir, registry)
-
-    # ------------------------------------------------------------------
-    # 2. Copy to raw/
-    # ------------------------------------------------------------------
-    raw_dir = kb_dir / "raw"
-    raw_dir.mkdir(parents=True, exist_ok=True)
-    if src.resolve().is_relative_to(raw_dir.resolve()):
-        # Watch mode: the file already lives in raw/ — don't copy/rename.
-        raw_dest = src
-    else:
-        raw_dest = raw_dir / f"{doc_name}{src.suffix.lower()}"
-        shutil.copy2(src, raw_dest)
-
-    # ------------------------------------------------------------------
-    # 3. PDF long-doc detection
-    # ------------------------------------------------------------------
-    if src.suffix.lower() == ".pdf":
-        page_count = get_pdf_page_count(src)
-        if page_count >= threshold:
-            logger.info(
-                "Long PDF detected (%d pages >= %d threshold): %s",
-                page_count,
-                threshold,
-                src.name,
-            )
+    with kb_ingest_lock(kb_dir / ".openkb"):
+        # ------------------------------------------------------------------
+        # Load config & state
+        # ------------------------------------------------------------------
+        openkb_dir = kb_dir / ".openkb"
+        config = load_config(openkb_dir / "config.yaml")
+        threshold: int = config.get("pageindex_threshold", 20)
+        artifact_root = staging_dir if staging_dir is not None else kb_dir
+        registry = HashRegistry(openkb_dir / "hashes.json")
+
+        # ------------------------------------------------------------------
+        # 1. Hash check + identity resolution
+        # ------------------------------------------------------------------
+        file_hash = HashRegistry.hash_file(src)
+        if registry.is_known(file_hash):
+            logger.info("Skipping already-known file: %s", src.name)
+            stored = registry.get(file_hash) or {}
             return ConvertResult(
-         
```

**File**: `openkb/indexer.py` (modified, +59/-11)
```diff
@@ -5,7 +5,7 @@
 import logging
 
 from dataclasses import dataclass
-from pathlib import Path
+from pathlib import Path, PurePosixPath
 from typing import Any
 
 import os
@@ -37,6 +37,30 @@ class CloudImportResult:
     description: str
 
 
+@dataclass
+class CloudImportData:
+    """A fetched cloud doc + its resolved wiki name, before any KB write.
+
+    Returned by :func:`prepare_cloud_import` so the caller can snapshot this
+    doc's specific paths (O(1)) before :func:`_write_long_doc_artifacts` writes
+    them — instead of copying the whole summaries/sources trees on every import.
+    """
+
+    doc_id: str
+    doc_name: str      # collision-resistant wiki slug (resolved, not yet written)
+    cloud_name: str    # cloud display name (original filename in the cloud)
+    description: str
+    tree: dict
+    all_pages: list
+
+
+def _cloud_display_stem(cloud_name: str, fallback: str) -> str:
+    """Return a platform-independent stem for a PageIndex Cloud display name."""
+    normalized = cloud_name.replace("\\", "/").rstrip("/")
+    leaf = normalized.rsplit("/", 1)[-1] if normalized else ""
+    return PurePosixPath(leaf).stem or fallback
+
+
 def _normalize_page_content(raw_pages: Any) -> list[dict[str, Any]]:
     """Normalize PageIndex/local PDF page content into OpenKB's JSON shape."""
     if not isinstance(raw_pages, list):
@@ -246,14 +270,13 @@ def _fetch_cloud_pages(col, doc_id: str) -> list[dict[str, Any]]:
     return pages
 
 
-def import_cloud_document(doc_id: str, kb_dir: Path, path_key: str) -> CloudImportResult:
-    """Import an already-indexed PageIndex Cloud document by ``doc_id``.
+def prepare_cloud_import(doc_id: str, kb_dir: Path, path_key: str) -> CloudImportData:
+    """Fetch a PageIndex Cloud doc and resolve its wiki name WITHOUT writing.
 
-    Fetches structure + OCR'd page content from the cloud (no local PDF) and
-    writes the same wiki artifacts as :func:`index_long_document`. Requires
-    ``PAGEINDEX_API_KEY``. ``path_key`` is the synthetic identity key
-    (``pageindex-cloud:<doc_id>``) used to resolve a collision-resistant
-    wiki name.
+    Cloud fetch + collision-resistant name resolution only — no KB mutation —
+    so the caller knows ``doc_name`` before writing and can snapshot just this
+    doc's paths instead of copying the whole summaries/sources trees. Name
+    resolution reads the registry but does not mutate it.
     """
     from openkb.converter import resolve_doc_name_from_key
     from openkb.state import HashRegistry
@@ -274,7 +297,7 @@ def import_cloud_document(doc_id: str, kb_dir: Path, path_key: str) -> CloudImpo
     structure: list = doc.get("structure", [])
 
     registry = HashRegistry(kb_dir / ".openkb" / "hashes.json")
-    stem = Path(cloud_name).stem or doc_id
+    stem = _cloud_display_stem(cloud_name, doc_id)
     doc_name = resolve_doc_name_from_key(stem, path_key, registry)
 
     tree = {
@@ -289,7 +312,32 @@ def import_cloud_document(doc_id: str, kb_dir: Path, path_key: str) -> CloudImpo
             f"No page content returned from PageIndex Cloud for doc_id={doc_id}"
         )
 
-    _write_long_doc_artifacts(tree, all_pages, doc_name, doc_id, kb_dir, description=description)
+    return CloudImportData(
+        doc_id=doc_id, doc_name=doc_name, cloud_name=cloud_name,
+        description=description, tree=tree, all_pages=all_pages,
+    )
+
+
+def import_cloud_document(doc_id: str, kb_dir: Path, path_key: str) -> CloudImportResult:
+    """Import an already-indexed PageIndex Cloud document by ``doc_id``.
+
+    Fetches structure + OCR'd page content from the cloud (no local PDF) and
+    writes the same wiki artifacts as :func:`index_long_document`. Requires
+    ``PAGEINDEX_API_KEY``. ``path_key`` is the synthetic identity key
+    (``pageindex-cloud:<doc_id>``) used to resolve a collision-resistant
+    wiki name.
+
+    Writes immediately. Callers that need to snapshot before writing (e.g. the
+    crash-safe CLI path) should call :func:`prepare_cloud_import` then
+    :func:`_write_long_doc_artifacts`, so the snapshot can cover only this
+    doc's paths.
+    """
+    cloud = prepare_cloud_import(doc_id, kb_dir, path_key)
+    _write_long_doc_artifacts(
+        cloud.tree, cloud.all_pages, cloud.doc_name, cloud.doc_id, kb_dir,
+        description=cloud.description,
+    )
     return CloudImportResult(
-        doc_id=doc_id, doc_name=doc_name, name=cloud_name, description=description,
+        doc_id=cloud.doc_id, doc_name=cloud.doc_name,
+        name=cloud.cloud_name, description=cloud.description,
     )
```

**File**: `openkb/lint.py` (modified, +2/-1)
```diff
@@ -16,6 +16,7 @@
 import yaml
 
 from openkb import frontmatter
+from openkb.locks import atomic_write_text
 from openkb.schema import PAGE_CONTENT_DIRS
 
 # Matches [[wikilink]] or [[subdir/link]]
@@ -249,7 +250,7 @@ def fix_broken_links(
             text, known_targets, norm_index=norm_index,
         )
         if cleaned != text:
-            md.write_text(cleaned, encoding="utf-8")
+            atomic_write_text(md, cleaned)
             files_changed += 1
             ghosts_stripped += len(ghosts)
     return files_changed, ghosts_stripped
```

**File**: `openkb/locks.py` (modified, +29/-0)
```diff
@@ -9,6 +9,7 @@
 
 import contextlib
 import json
+import logging
 import os
 import tempfile
 import threading
@@ -97,6 +98,32 @@ def _local_lock(lock_path: Path) -> _LocalRwLock:
         return lock
 
 
+def _drain_pending_journals(openkb_dir: Path) -> None:
+    """Roll back any mutation journals an interrupted process left behind.
+
+    Draining recovery is part of *taking* the mutation lock, not part of any
+    one command: a process that acquires the exclusive lock must restore the
+    KB to a known state before mutating it. Wiring this into ``kb_lock`` means
+    every exclusive-lock holder — ``add``, ``remove``, ``recompile``, ``lint``,
+    ``chat`` — drains on first acquisition, so an ``add`` that crashed mid-
+    commit cannot leave an active journal on disk that a later ``add`` rolls
+    back over the top of an intervening ``remove``/``recompile`` (clobbering
+    those edits). ``openkb_dir`` is the ``kb_dir/.openkb`` directory callers
+    pass to ``kb_lock``; the journal lives at ``openkb_dir/journal``, so the
+    KB root is ``openkb_dir.parent``.
+
+    The delayed import breaks the ``locks`` ↔ ``mutation`` cycle (``mutation``
+    imports atomic-write helpers from this module at top level). Called only
+    on first OS-lock acquisition (the reentrant branch above returns early),
+    never on a read lock, so queries pay nothing.
+    """
+    from openkb.mutation import recover_pending_journals
+
+    log = logging.getLogger(__name__)
+    for message in recover_pending_journals(openkb_dir.parent):
+        log.warning(message)
+
+
 @contextlib.contextmanager
 def kb_lock(openkb_dir: Path, *, exclusive: bool) -> Iterator[None]:
     """Hold a KB-level advisory lock."""
@@ -134,6 +161,8 @@ def kb_lock(openkb_dir: Path, *, exclusive: bool) -> Iterator[None]:
             flock(fh, exclusive=exclusive)
             held[resolved] = (1, 0) if exclusive else (0, 1)
             try:
+                if exclusive:
+                    _drain_pending_journals(openkb_dir)
                 yield
             finally:
                 held.pop(resolved, None)
```

**File**: `openkb/mutation.py` (added, +431/-0)
```diff
@@ -0,0 +1,431 @@
+"""Transactional helpers for KB mutation paths."""
+from __future__ import annotations
+
+import errno
+import json
+import logging
+import os
+import shutil
+import tempfile
+import uuid
+from dataclasses import dataclass, field
+from pathlib import Path
+
+from openkb.locks import _fsync_directory, _target_mode, atomic_write_json
+
+logger = logging.getLogger(__name__)
+
+# Cap how many times recover_pending_journals retries an active journal whose
+# rollback keeps failing. Without a cap, a deterministically-failing rollback
+# (e.g. persistent ENOSPC) is retried on every lock acquisition forever,
+# re-doing the failed work and never releasing the backup dir + journal.
+MAX_ROLLBACK_ATTEMPTS = 5
+
+
+def _apply_mode(path: Path, mode: int) -> None:
+    """Set ``path``'s permission bits (no-op where ``os.chmod`` is absent)."""
+    if hasattr(os, "chmod"):
+        os.chmod(path, mode)
+
+
+def _fsync_file(path: Path) -> None:
+    """Best-effort fsync of a file's data, for durability after a rename.
+
+    Opens read+write so ``FlushFileBuffers`` works on Windows (a read-only
+    handle can be denied). Best-effort: a failure here only weakens durability
+    of already-written bytes (the OS write-back still flushes them); it must
+    not fail the publish.
+    """
+    try:
+        with open(path, "r+b") as fh:
+            os.fsync(fh.fileno())
+    except OSError:
+        pass
+
+
+def _hardlink_or_copy(src: str, dst: str) -> None:
+    """``copytree`` copy_function that hardlinks (O(1), shares the inode).
+
+    Used for directory backups the caller has marked hardlink-safe — trees
+    whose writers all go through atomic temp+replace (so the live file moves
+    to a new inode) or that are append-only across documents. The hardlink
+    backup then keeps pointing at the old inode while the live tree is
+    mutated, so rollback restores the pre-mutation bytes without copying them
+    up front. Falls back to a real copy on EXDEV/EPERM/EACCES — cross-device,
+    a filesystem that forbids hardlinks, or (Windows) an ACL / cloud-sync
+    folder (OneDrive/Dropbox) that blocks CREATE_HARD_LINK. If the copy also
+    fails it surfaces the real error.
+    """
+    src_path = Path(src)
+    dst_path = Path(dst)
+    try:
+        os.link(src_path, dst_path)
+    except OSError as exc:
+        if exc.errno not in (errno.EXDEV, errno.EPERM, errno.EACCES):
+            raise
+        shutil.copy2(src_path, dst_path)
+
+
+def _copy_file_atomic(src: Path, dest: Path) -> None:
+    """Stream ``src`` to ``dest`` through a temp file, then atomically replace.
+
+    Streams (never buffers the whole file) so copying a large raw PDF does
+    not spike peak memory. The temp-file + ``os.replace`` means a torn
+    intermediate state can never be observed at ``dest``. Used by snapshot
+    backup creation, rollback restore, and the cross-filesystem fallback of
+    :func:`_publish_staged_file` — so every byte copy in this module shares
+    one atomic, streaming, durable semantic: the parent directory is fsynced
+    and the result carries the umask mode (not ``mkstemp``'s 0600).
+    """
+    dest.parent.mkdir(parents=True, exist_ok=True)
+    # Capture the destination mode before the temp file shadows it: a brand-
+    # new file gets the process umask mode (0o666 & ~umask), an existing file
+    # keeps its current mode — the same rule ``atomic_write_bytes`` applies.
+    mode = _target_mode(dest)
+    fd, tmp_name = tempfile.mkstemp(prefix=f".{dest.name}.", suffix=".tmp", dir=dest.parent)
+    tmp_path = Path(tmp_name)
+    try:
+        with os.fdopen(fd, "wb") as out, src.open("rb") as inp:
+            shutil.copyfileobj(inp, out)
+            out.flush()
+            os.fsync(out.fileno())
+        os.replace(tmp_path, dest)
+        _apply_mode(dest, mode)
+        _fsync_directory(dest.parent)
+    finally:
+        tmp_path.unlink(missing_ok=True)
+
+
+def _publish_staged_file(src: Path, dest: Path) -> None:
+    """Publish one staged file into its live-KB location.
+
+    Staging sits on the same filesystem as ``raw/`` and ``wiki/sources/``, so
+    an O(1) atomic ``os.replace`` (rename) is used instead of streaming the
+    bytes — a full copy + fsync per published file was the old per-file cost.
+    Only on ``EXDEV`` (staging and the live KB genuinely on different devices)
+    does it fall back to :func:`_copy_file_atomic`. Both branches leave the
+    result durable (file data + parent dir fsynced) and at the umask mode.
+    """
+    dest.parent.mkdir(parents=True, exist_ok=True)
+    mode = _target_mode(dest)
+    try:
+        os.replace(src, dest)
+    except OSError as exc:
+        if exc.errno != errno.EXDEV:
+            raise
+        _copy_file_atomic(src, dest)  # already fsyncs data + dir + sets mode
+        return
+    _apply_mode(dest, mode)
+    # Parity with _copy_file_atomic: the renamed inode's data may still be in
+    # the page cache. Without this, a crash
```

**File**: `tests/test_add_command.py` (modified, +55/-26)
```diff
@@ -72,6 +72,24 @@ def test_add_single_file_calls_helper(self, tmp_path):
             runner.invoke(cli, ["add", str(doc)])
             mock_add.assert_called_once_with(doc, kb_dir)
 
+    def test_add_single_file_compile_failure_rolls_back_converted_artifacts(self, tmp_path):
+        from openkb.cli import add_single_file
+        from openkb.state import HashRegistry
+
+        kb_dir = self._setup_kb(tmp_path)
+        doc = tmp_path / "notes.md"
+        doc.write_text("# Notes\n\nBody", encoding="utf-8")
+
+        with patch("openkb.agent.compiler.compile_short_doc", side_effect=RuntimeError("boom")), \
+             patch("openkb.cli.time.sleep"), \
+             patch("openkb.cli._setup_llm_key"):
+            outcome = add_single_file(doc, kb_dir)
+
+        assert outcome == "failed"
+        assert not (kb_dir / "raw" / "notes.md").exists()
+        assert not (kb_dir / "wiki" / "sources" / "notes.md").exists()
+        assert HashRegistry(kb_dir / ".openkb" / "hashes.json").all_entries() == {}
+
     def test_add_directory_calls_helper_for_each_file(self, tmp_path):
         kb_dir = self._setup_kb(tmp_path)
         docs_dir = tmp_path / "docs"
@@ -149,12 +167,17 @@ def test_add_short_doc_runs_compiler(self, tmp_path):
             "stale-old-hash", {"name": "test.md", "doc_name": "test", "type": "md"}
         )
 
+        compile_calls = []
+
+        async def compile_noop(*args, **kwargs):
+            compile_calls.append((args, kwargs))
+
         runner = CliRunner()
         with patch("openkb.cli._find_kb_dir", return_value=kb_dir), \
              patch("openkb.cli.convert_document", return_value=mock_result), \
-             patch("openkb.cli.asyncio.run") as mock_arun:
+             patch("openkb.agent.compiler.compile_short_doc", new=compile_noop):
             result = runner.invoke(cli, ["add", str(doc)])
-            mock_arun.assert_called_once()
+            assert len(compile_calls) == 1
             assert "OK" in result.output
 
         import json as json_mod
@@ -188,11 +211,15 @@ def test_add_oldest_legacy_entry_converges_to_single_entry(self, tmp_path):
         doc = tmp_path / "notes.md"
         doc.write_text("# Notes, edited")  # new content hash != "old-hash"
 
-        # Compilation mocked out (asyncio.run), but convert_document REAL so
+        # Compilation mocked out, but convert_document REAL so
         # the legacy backfill actually happens on disk mid-pipeline.
+        def close_coro(coro):
+            if hasattr(coro, "close"):
+                coro.close()
+
         runner = CliRunner()
         with patch("openkb.cli._find_kb_dir", return_value=kb_dir), \
-             patch("openkb.cli.asyncio.run"):
+             patch("openkb.cli.asyncio.run", side_effect=close_coro):
             result = runner.invoke(cli, ["add", str(doc)])
             assert "OK" in result.output
 
@@ -255,19 +282,31 @@ def _setup_kb(self, tmp_path):
         (openkb_dir / "hashes.json").write_text(json.dumps({}))
         return tmp_path
 
+    def _cloud_data(self, doc_name="Cloud-Paper"):
+        from openkb.indexer import CloudImportData
+
+        return CloudImportData(
+            doc_id="cloud-1",
+            doc_name=doc_name,
+            cloud_name="Cloud Paper.pdf",
+            description="desc",
+            tree={
+                "doc_name": "Cloud Paper.pdf",
+                "doc_description": "desc",
+                "structure": [],
+            },
+            all_pages=[{"page": 1, "content": "Cloud page", "images": []}],
+        )
+
     def test_registers_rawless_cloud_entry(self, tmp_path):
         import hashlib
         from openkb.cli import import_from_pageindex_cloud
-        from openkb.indexer import CloudImportResult
         from openkb.state import HashRegistry
 
         kb_dir = self._setup_kb(tmp_path)
-        result = CloudImportResult(
-            doc_id="cloud-1", doc_name="Cloud-Paper", name="Cloud Paper.pdf",
-            description="desc",
-        )
+        cloud = self._cloud_data()
 
-        with patch("openkb.cli.import_cloud_document", return_value=result), \
+        with patch("openkb.cli.prepare_cloud_import", return_value=cloud), \
              patch("openkb.cli.compile_long_doc", return_value=None) as mock_compile, \
              patch("openkb.cli._setup_llm_key"):
             outcome = import_from_pageindex_cloud("cloud-1", kb_dir)
@@ -286,29 +325,25 @@ def test_registers_rawless_cloud_entry(self, tmp_path):
 
     def test_second_import_is_skipped(self, tmp_path):
         from openkb.cli import import_from_pageindex_cloud
-        from openkb.indexer import CloudImportResult
 
         kb_dir = self._setup_kb(tmp_path)
-        result = CloudImportResult(
-            doc_id="cloud-1", doc_name="Cloud-Paper", name="Cloud Paper.pdf",
-            description="desc",
-        )
+        cloud = self._cloud_data()
 
-        with patch("openkb.cli.import_cloud_document", return_value=result) as mock_import
```

---

### Incident Patch 11: `e8960700` (2026-06-30)
**Commit Message**: fix(compiler): strip cache_control for non-Anthropic providers (#154)

The compiler tags reusable prompt context with an Anthropic ephemeral
`cache_control` marker (`_cached_text`). The docstring assumed providers
that don't support it would simply ignore it — but LiteLLM translates the
marker into a provider-native cached-content object for Gemini, which then
conflicts with `system_instruction`/`tools` and fails every request with
`400 CachedContent can not be used with ...`. As a result, *all* Gemini
compiles fail out of the box.

Strip the marker at the single request egress (`_llm_call` /
`_llm_call_async`) for any non-Anthropic provider, keeping it for Anthropic
direct and Claude via OpenRouter/Bedrock/Vertex. Anthropic prompt caching is
unchanged; Gemini's implicit caching still applies to the plain text blocks.

Provider detection uses litellm.get_llm_provider, imported locally so it
stays correct even when tests patch the module-level `litellm` reference.

Adds TestCacheControlStripping covering provider gating, marker removal
(non-mutating), and the sync stripping/keeping paths.

Co-authored-by: Aldominguez12 <[REDACTED_EMAIL]>

**File**: `openkb/agent/compiler.py` (modified, +67/-2)
```diff
@@ -262,12 +262,75 @@ def _cached_text(text: str) -> list[dict]:
     ephemeral cache_control marker.
 
     LiteLLM passes the marker through to Anthropic (and OpenRouter →
-    Anthropic). For providers that ignore cache_control, the list-of-blocks
-    payload remains a valid OpenAI-compatible content shape.
+    Anthropic). For other providers the marker is stripped at the request
+    egress (see :func:`_strip_cache_control`, applied in :func:`_llm_call`),
+    because not every provider merely *ignores* it — Gemini in particular
+    turns it into a 400. The list-of-blocks payload that remains is a valid
+    OpenAI-compatible content shape.
     """
     return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]
 
 
+def _accepts_cache_control(model: str) -> bool:
+    """Whether ``model`` honours Anthropic-style ``cache_control`` markers.
+
+    The markers emitted by :func:`_cached_text` are an Anthropic feature.
+    LiteLLM forwards them to Anthropic directly, and to Anthropic (Claude)
+    models served via OpenRouter, Bedrock and Vertex. For other providers —
+    notably Gemini — LiteLLM instead translates the marker into a
+    provider-native cached-content object that conflicts with
+    ``system_instruction``/``tools`` and makes *every* request fail with
+    ``400 CachedContent can not be used with ...``. Detect the provider so the
+    marker can be dropped before it reaches such a backend.
+    """
+    # Import the real symbol rather than going through the module-level
+    # ``litellm`` reference: provider detection must stay correct even when a
+    # caller patches ``openkb.agent.compiler.litellm`` to stub out completion.
+    from litellm import get_llm_provider
+
+    try:
+        provider = get_llm_provider(model)[1]
+    except Exception:
+        provider = ""
+    lowered = model.lower()
+    if provider == "anthropic":
+        return True
+    if provider in ("openrouter", "bedrock", "vertex_ai") and (
+        "claude" in lowered or "anthropic" in lowered
+    ):
+        return True
+    return False
+
+
+def _strip_cache_control(messages: list[dict]) -> list[dict]:
+    """Return ``messages`` with every ``cache_control`` key removed.
+
+    Only list-of-blocks contents (see :func:`_cached_text`) can carry the
+    marker; plain-string contents pass through untouched. The input is not
+    mutated.
+    """
+    cleaned: list[dict] = []
+    for msg in messages:
+        content = msg.get("content")
+        if isinstance(content, list):
+            blocks = [
+                {k: v for k, v in block.items() if k != "cache_control"}
+                if isinstance(block, dict)
+                else block
+                for block in content
+            ]
+            msg = {**msg, "content": blocks}
+        cleaned.append(msg)
+    return cleaned
+
+
+def _prepare_messages(model: str, messages: list[dict]) -> list[dict]:
+    """Drop cache_control markers when ``model`` would reject them."""
+    if _accepts_cache_control(model):
+        return messages
+    return _strip_cache_control(messages)
+
+
 class _Spinner:
     """Animated dots spinner that runs in a background thread."""
 
@@ -328,6 +391,7 @@ def _fmt_messages(messages: list[dict], max_content: int = 200) -> str:
 
 def _llm_call(model: str, messages: list[dict], step_name: str, **kwargs) -> str:
     """Single LLM call with animated progress and debug logging."""
+    messages = _prepare_messages(model, messages)
     extra_headers = get_extra_headers()
     if extra_headers:
         kwargs.setdefault("extra_headers", extra_headers)
@@ -353,6 +417,7 @@ def _llm_call(model: str, messages: list[dict], step_name: str, **kwargs) -> str
 
 async def _llm_call_async(model: str, messages: list[dict], step_name: str, **kwargs) -> str:
     """Async LLM call with timing output and debug logging."""
+    messages = _prepare_messages(model, messages)
     extra_headers = get_extra_headers()
     if extra_headers:
         kwargs.setdefault("extra_headers", extra_headers)
```

**File**: `tests/test_compiler.py` (modified, +62/-0)
```diff
@@ -2260,6 +2260,68 @@ async def test_llm_call_async_injects_extra_headers(self):
         assert kwargs["extra_headers"] == {"Copilot-Integration-Id": "vscode-chat"}
 
 
+class TestCacheControlStripping:
+    """cache_control markers must only reach providers that honour them.
+
+    ``_cached_text`` tags payloads with an Anthropic ``cache_control`` marker.
+    LiteLLM turns that marker into a hard 400 for Gemini ("CachedContent can not
+    be used with system_instruction/tools") and silently wastes it on other
+    non-Anthropic providers, so ``_llm_call``/``_llm_call_async`` strip it for
+    every non-Anthropic model. Regression for the all-Gemini-compiles-fail bug.
+    """
+
+    def test_accepts_for_anthropic_providers(self):
+        from openkb.agent.compiler import _accepts_cache_control
+
+        assert _accepts_cache_control("anthropic/claude-sonnet-4-6")
+        assert _accepts_cache_control("claude-opus-4-6")
+        # Claude served via OpenRouter still honours the marker.
+        assert _accepts_cache_control("openrouter/anthropic/claude-3.5-sonnet")
+
+    def test_rejects_for_non_anthropic_providers(self):
+        from openkb.agent.compiler import _accepts_cache_control
+
+        assert not _accepts_cache_control("gemini/gemini-2.5-pro")
+        assert not _accepts_cache_control("gpt-4o")
+
+    def test_strip_removes_marker_without_mutating_input(self):
+        from openkb.agent.compiler import _cached_text, _strip_cache_control
+
+        messages = [
+            {"role": "system", "content": "plain string stays"},
+            {"role": "user", "content": _cached_text("doc")},
+        ]
+        cleaned = _strip_cache_control(messages)
+        # Plain-string content passes through untouched.
+        assert cleaned[0]["content"] == "plain string stays"
+        # Marker gone, text preserved.
+        assert cleaned[1]["content"] == [{"type": "text", "text": "doc"}]
+        # Original input is not mutated.
+        assert "cache_control" in messages[1]["content"][0]
+
+    def test_llm_call_strips_marker_for_gemini(self):
+        from openkb.agent.compiler import _cached_text, _llm_call
+
+        with patch("openkb.agent.compiler.litellm.completion",
+                   MagicMock(side_effect=_mock_completion(["ok"]))) as mock_completion:
+            _llm_call("gemini/gemini-2.5-pro",
+                      [{"role": "user", "content": _cached_text("doc")}], "step")
+        sent = mock_completion.call_args.kwargs["messages"]
+        block = sent[0]["content"][0]
+        assert "cache_control" not in block
+        assert block["text"] == "doc"
+
+    def test_llm_call_keeps_marker_for_anthropic(self):
+        from openkb.agent.compiler import _cached_text, _llm_call
+
+        with patch("openkb.agent.compiler.litellm.completion",
+                   MagicMock(side_effect=_mock_completion(["ok"]))) as mock_completion:
+            _llm_call("anthropic/claude-sonnet-4-6",
+                      [{"role": "user", "content": _cached_text("doc")}], "step")
+        sent = mock_completion.call_args.kwargs["messages"]
+        assert sent[0]["content"][0]["cache_control"] == {"type": "ephemeral"}
+
+
 class TestFrontmatterDashBoundary:
     """Regression: description containing '---' must not truncate frontmatter."""
 
```

---

### Incident Patch 12: `6194c5ed` (2026-06-29)
**Commit Message**: fix(lint): don't hide same-stem orphans behind qualified links (#147)

find_orphans added the bare stem of *every* wikilink to the "incoming" set, so
a qualified link like `[[concepts/foo]]` also registered the stem `foo`. Any
other page that merely shared that stem in a different directory (e.g.
`summaries/foo`) was then treated as linked and excluded from orphan
detection — a genuine orphan was silently missed.

Only add the bare stem when the link itself is a bare stem (no `/`); qualified
links register only their full path. Bare `[[foo]]` links still resolve by
stem, so a page named `foo` in any directory remains non-orphaned.

Adds regression tests for both the qualified-link (orphan now flagged) and
bare-link (still matched) cases.

**File**: `openkb/lint.py` (modified, +8/-4)
```diff
@@ -321,10 +321,14 @@ def find_orphans(wiki: Path) -> list[str]:
     incoming: set[str] = set()
     for links in outgoing.values():
         for lnk in links:
-            incoming.add(lnk.strip().strip("/"))
-        # Also add stems
-        for lnk in links:
-            incoming.add(Path(lnk.strip()).stem)
+            cleaned = lnk.strip().strip("/")
+            incoming.add(cleaned)
+            # Only treat a link as a bare-stem reference when it is itself a
+            # bare stem. A qualified link like ``concepts/foo`` must not mark a
+            # same-stem page in another directory (``summaries/foo``) as linked,
+            # which would hide a genuine orphan.
+            if "/" not in cleaned:
+                incoming.add(Path(cleaned).stem)
 
     orphans: list[str] = []
     for rel, links in outgoing.items():
```

**File**: `tests/test_lint.py` (modified, +29/-0)
```diff
@@ -114,6 +114,35 @@ def test_empty_wiki_has_no_orphans(self, tmp_path):
 
         assert result == []
 
+    def test_qualified_link_does_not_hide_same_stem_orphan(self, tmp_path):
+        # A qualified link [[concepts/dup]] must not mark a *different* page
+        # that merely shares the "dup" stem (summaries/dup) as linked — that
+        # page is a genuine orphan and must still be flagged.
+        wiki = _make_wiki(tmp_path)
+        (wiki / "concepts" / "dup.md").write_text("# Linked concept", encoding="utf-8")
+        (wiki / "summaries" / "linker.md").write_text(
+            "See [[concepts/dup]]", encoding="utf-8"
+        )
+        (wiki / "summaries" / "dup.md").write_text(
+            "Orphan sharing the 'dup' stem, with no links.", encoding="utf-8"
+        )
+
+        result = find_orphans(wiki)
+
+        assert "summaries/dup" in result
+        assert "concepts/dup" not in result
+
+    def test_bare_stem_link_still_matches_same_stem_page(self, tmp_path):
+        # A bare [[dup]] link (no path) intentionally resolves by stem, so a
+        # page with that stem is not considered an orphan.
+        wiki = _make_wiki(tmp_path)
+        (wiki / "concepts" / "dup.md").write_text("# A concept", encoding="utf-8")
+        (wiki / "summaries" / "linker.md").write_text("See [[dup]]", encoding="utf-8")
+
+        result = find_orphans(wiki)
+
+        assert "concepts/dup" not in result
+
 
 class TestFindMissingEntries:
     def test_no_missing_entries(self, tmp_path):
```

---

### Incident Patch 13: `fd1756f7` (2026-06-26)
**Commit Message**: docs: OpenRouter response caching guide + rendered architecture diagram (#144)

* docs(examples): document OpenRouter response caching via extra_headers

OpenRouter Response Caching (sending X-OpenRouter-Cache / -TTL headers on
compiler LLM calls) is achievable through the general extra_headers
passthrough — no dedicated config needed. Document it in the configuration
guide alongside the other litellm/extra_headers recipes.

Refs #39

* docs: replace ASCII architecture diagram with a rendered image

Swap the text-based diagram under "Architecture" for a rendered
illustration (assets/openkb-architecture.png) covering the same pipeline:
raw/ intake -> markitdown (short docs) / PageIndex (long PDFs) -> LLM
wiki compilation -> the wiki/ foundation -> query/chat, the Skill
Factory, and future generators.

**File**: `README.md` (modified, +3/-28)
```diff
@@ -119,34 +119,9 @@ LLM_API_KEY=your_llm_api_key
 
 ### Architecture
 
-```
-raw/                              You drop files here
- │
- ├─ Short docs ──→ markitdown ──→ LLM reads full text
- │                                     │
- ├─ Long PDFs ──→ PageIndex ────→ LLM reads document trees
- │                                     │
- │                                     ▼
- │                         Wiki Compilation (using LLM)
- │                                     │
- ▼                                     ▼
-wiki/                                  │            ← the foundation
- ├── index.md            Knowledge base overview
- ├── log.md              Operations timeline
- ├── AGENTS.md           Wiki schema (LLM instructions)
- ├── sources/            Full-text conversions
- ├── summaries/          Per-document summaries
- ├── concepts/           Cross-document synthesis
- ├── entities/           Specific named things (people, orgs, places, products)
- ├── explorations/       Saved query results
- └── reports/            Lint reports
-                                       │
-                ┌──────────────────────┼──────────────────────┐
-                ▼                      ▼                      ▼
-            query / chat         Skill Factory          (future)
-          (LLM answers from    (redistributable       ppt / podcast /
-            the wiki)           agent skills)           report / …
-```
+<div align="center">
+  <img src="assets/openkb-architecture.png" alt="OpenKB Architecture: from raw documents (markitdown / PageIndex) through LLM wiki compilation to the wiki/ foundation, powering query/chat, the Skill Factory, and future generators" width="900" />
+</div>
 
 ### Short vs Long Document Handling
 
```

**File**: `examples/configuration/README.md` (modified, +21/-0)
```diff
@@ -136,6 +136,27 @@ litellm:
     Copilot-Integration-Id: vscode-chat
 ```
 
+#### OpenRouter response caching
+
+When your `model` is an `openrouter/*` model, you can opt into OpenRouter's
+[Response Caching](https://openrouter.ai/docs/guides/features/response-caching):
+identical-payload requests come back in ~80–300 ms with **zero token billing**.
+That's a direct win on the compile-retry path (a failed `add` re-runs every
+summary/plan/concept call with the same prompts) and on repeated `lint` / dev
+iteration. Send the cache headers via `extra_headers`:
+
+```yaml
+model: openrouter/anthropic/claude-sonnet-4.5
+language: en
+extra_headers:                  # top-level, or nested under `litellm:` — both work
+  X-OpenRouter-Cache: "true"
+  X-OpenRouter-Cache-TTL: "600" # optional, 1–86400s (OpenRouter default 300)
+```
+
+It's opt-in by design: responses are stored on OpenRouter, so leave it off for
+zero-data-retention / regulated content. Only `openrouter/*` models read these
+headers; other providers ignore them.
+
 ---
 
 ## 3. API keys & providers
```

---

### Incident Patch 14: `8d40458a` (2026-06-26)
**Commit Message**: docs(examples): openkb usage guides with real generated artifacts (#141)

* docs(examples): add per-case usage guides with real generated artifacts

Add examples/ as a use-case-indexed set of guides. Each case is its own
directory: a README walkthrough plus the actual artifact OpenKB produced.

- configuration  — init, config.yaml, keys, LiteLLM tuning
- commands       — the everyday loop (+ a compiled sample-wiki/)
- pageindex-cloud — long docs: local vs cloud + cloud import
- chat           — the interactive REPL: sessions + slash commands
- skills         — a generated SKILL.md + references/ + marketplace.json
- slides         — a generated single-file HTML deck
- visualize      — a generated interactive knowledge graph

Every artifact was produced by running openkb over the sample
attention-is-all-you-need.pdf with gpt-5.4-mini. The heavy/third-party test
PDFs stay gitignored under examples/docs/.

Claude-Session: https://claude.ai/code/session_018WiFnTo1YW9mtw47Fzir9K

* docs(examples): document pre-release install + slow local-runtime timeout

Cover recurring install/usage questions from the issue tracker:

- #130 / #24: openkb pins a pre-release dependency (pageindex==0.3.0.

**File**: `README.md` (modified, +23/-155)
```diff
@@ -97,8 +97,10 @@ openkb query "What are the main findings?"
 # 5. Or chat interactively
 openkb chat
 
-# (Optional) Distill a redistributable agent skill from your wiki
-openkb skill new my-expert "Reason like an expert on <your-topic>"
+# (Optional) Turn the wiki into other outputs
+openkb skill new my-expert "Reason like an expert on <your-topic>"   # a portable agent skill
+openkb visualize                                                     # an interactive knowledge graph
+openkb deck new my-deck "An intro deck on <your-topic>"              # slides — a single-file HTML deck
 ```
 
 ### Set up your LLM
@@ -171,7 +173,7 @@ A single source might touch 10--15 wiki pages. Knowledge accumulates: each docum
 
 # ⚙️ Usage
 
-OpenKB commands fall into two layers: the **wiki foundation** (compile + manage your knowledge) and **generators** (turn that wiki into useful output).
+OpenKB commands fall into two layers: the **wiki foundation** (compile + manage your knowledge) and **generators** (turn that wiki into useful output). Each links to a concrete walkthrough — a real artifact OpenKB generated from one sample paper (browse them all in [`examples/`](examples/)).
 
 ## Layer 1: 🧱 Wiki Foundation — compile and maintain
 
@@ -194,189 +196,53 @@ OpenKB commands fall into two layers: the **wiki foundation** (compile + manage
 | <code>openkb&nbsp;recompile&nbsp;[&lt;doc&gt;]&nbsp;[--all]</code> | Re-run the compile pipeline on already-indexed docs without re-indexing. Regenerates summaries and rewrites concept pages; manual edits are overwritten (`--dry-run` to preview, `--refresh-schema` to also update `wiki/AGENTS.md`) |
 | <code>openkb&nbsp;feedback&nbsp;["msg"]</code> | File feedback by opening a prefilled GitHub issue (`--type bug/feature/question` to tag it) |
 
-<!-- | `openkb lint --fix` | Auto-fix what it can | -->
-
 </details>
 
+→ **Example:** the everyday loop walked through end to end — [`examples/commands/`](examples/commands/).
+
 ## Layer 2: 💡 Generators — turn the wiki into output
 
 A "generator" reads from the compiled wiki and produces something usable: an answer, a conversation, a skill folder. The wiki is the substrate; generators are the surfaces.
 
-| Command | Output |
-|---|---|
-| <code>openkb&nbsp;query&nbsp;"question"</code> | A grounded answer with citations (`--save` to persist to `wiki/explorations/`) |
-| <code>openkb&nbsp;chat</code> | Interactive multi-turn session over the wiki (`--resume`, `--list`, `--delete` to manage sessions) |
-| <code>openkb&nbsp;visualize</code> | A self-contained interactive knowledge graph at `output/visualize/graph.html` — 3D, mind-map, and radial views |
-| | |
-| <code>openkb&nbsp;skill&nbsp;new&nbsp;&lt;skill-name&gt;&nbsp;"&lt;intent&gt;"</code> | Distill a redistributable agent skill from your wiki (see [Skill Factory](#-skill-factory--drop-in-a-book-out-comes-a-digital-expert) below) |
+| Command | Output | Example |
+|---|---|---|
+| <code>openkb&nbsp;query&nbsp;"question"</code> | A grounded answer with citations (`--save` to persist to `wiki/explorations/`) | [query & save](examples/commands/) |
+| <code>openkb&nbsp;chat</code> | Interactive multi-turn session over the wiki (`--resume`, `--list`, `--delete` to manage sessions) | [chat](examples/chat/) |
+| <code>openkb&nbsp;visualize</code> | A self-contained interactive knowledge graph at `output/visualize/graph.html` — 3D, mind-map, and radial views | [visualize](examples/visualize/) |
+| <code>openkb&nbsp;skill&nbsp;new&nbsp;&lt;skill-name&gt;&nbsp;"&lt;intent&gt;"</code> | Distill a redistributable agent skill from your wiki (see [Skill Factory](#skill-factory) below) | [skills](examples/skills/) |
+| <code>openkb&nbsp;deck&nbsp;new&nbsp;&lt;name&gt;&nbsp;"&lt;intent&gt;"</code> | Generate a single-file HTML slide deck (`--skill` picks a theme, `--critique` runs a quality pass) | [slides](examples/slides/) |
 
 <details>
 <summary><i>More skill commands:</i></summary>
 <br>
 
 | Command | Output |
 |---|---|
-| <code>openkb&nbsp;skill&nbsp;validate&nbsp;[name]</code> | Validate compiled skills (YAML frontmatter, file sizes, wikilinks, scripts). Auto-runs at end of `skill new` (`--strict` to treat warnings as failures) |
-| <code>openkb&nbsp;skill&nbsp;eval&nbsp;&lt;name&gt;</code> | Trigger-accuracy evaluation: does the `description:` field actually fire? LLM generates eval prompts; grader LLM scores activation (`--save` persists the eval set) |
-| <code>openkb&nbsp;skill&nbsp;history&nbsp;&lt;name&gt;</code> / <code>openkb&nbsp;skill&nbsp;rollback&nbsp;&lt;name&gt;</code> | Version history for skills. Each overwrite saves the previous version to `iteration-N/` with a diff; rollback restores any iteration |
-
-</details>
-
-### (i) 💬 Query & Chat — *ask the wiki*
-
-`openkb query "..."` answers a single question. `openkb chat` is interactive — each turn carries history, so you can dig into a topic without re-typing context. Both use the same underlying wiki and retrieval primitives.
```

**File**: `examples/README.md` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+# OpenKB examples
+
+Hands-on, organized by use case. Each folder is one case — a short walkthrough
+plus the **real artifact** OpenKB produced for it (generated, not hand-written).
+
+> **Test inputs** live in [`docs/`](docs/) — the sample PDFs the cases ingest.
+> They're kept out of git on purpose (large / third-party files); drop your own
+> documents there to follow along.
+
+## Cases
+
+| Folder | What it shows | Real artifact inside |
+| --- | --- | --- |
+| [`configuration/`](configuration/) | `init`, `config.yaml`, API keys, LiteLLM tuning (Ollama, Copilot) | — |
+| [`commands/`](commands/) | the everyday loop: `add` · `query` · `remove` · `recompile` · `lint` · `list` · `status` | a compiled [`sample-wiki/`](commands/sample-wiki/) |
+| [`pageindex-cloud/`](pageindex-cloud/) | long documents: local vs. cloud indexing, and importing cloud-indexed docs | — |
+| [`chat/`](chat/) | the interactive REPL: persistent sessions + slash commands | — |
+| [`skills/`](skills/) | distill a redistributable agent skill from your wiki | [`transformer-attention/SKILL.md`](skills/transformer-attention/SKILL.md) |
+| [`slides/`](slides/) | generate a single-file HTML slide deck | [`attention-intro.html`](slides/attention-intro.html) |
+| [`visualize/`](visualize/) | render the wiki as an interactive knowledge graph | [`graph.html`](visualize/graph.html) |
+
+## It's all from one paper
+
+The compiled `sample-wiki/`, the skill, the deck, and the graph were **all**
+generated by running OpenKB over a single document —
+[`docs/attention-is-all-you-need.pdf`](docs/attention-is-all-you-need.pdf) — with
+`gpt-5.4`:
+
+```bash
+mkdir my-kb && cd my-kb
+openkb init --model gpt-5.4 --language en
+
+openkb add /path/to/examples/docs/attention-is-all-you-need.pdf   # → commands/sample-wiki/
+openkb query "How does attention replace recurrence?" --save      # → commands/sample-wiki/explorations/
+openkb skill new transformer-attention "Reason about the Transformer…"  # → skills/
+openkb deck new attention-intro "A short intro deck on the Transformer…" # → slides/
+openkb visualize                                                  # → visualize/
+```
+
+Your generated text will differ run to run (LLM output isn't deterministic) — the
+*structure* is what's stable.
+
+New to OpenKB? Read [`configuration/`](configuration/) first, then
+[`commands/`](commands/).
```

**File**: `examples/chat/README.md` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+# Chat TUI
+
+`openkb chat` is an interactive REPL over your wiki. Unlike `query` (one-shot), a
+chat session keeps context across turns, can edit the KB through slash commands,
+and is saved so you can resume it later.
+
+```bash
+openkb chat
+```
+
+```text
+OpenKB Chat
+~/research-kb · anthropic/claude-sonnet-4-6 · session 20260625-143022-a1x
+Type /help for commands, Ctrl-D to exit, Ctrl-C to abort the current response.
+
+>>> How do the two papers differ on their use of attention?
+Both rely on scaled dot-product attention, but…
+  · read_wiki_file(path="concepts/self-attention.md")
+  · read_wiki_file(path="summaries/deepseek-r1.md")
+
+>>> /save attention-comparison
+Saved to wiki/explorations/attention-comparison-20260625.md
+```
+
+Answers are grounded in your wiki: the agent reads `concepts/`, `summaries/`,
+`entities/`, and source files, and shows the tool calls it makes. Responses render
+as rich Markdown (headings, tables, code) in a terminal.
+
+---
+
+## Persistent sessions
+
+Every conversation is stored as JSON in `<kb>/.openkb/chats/`. Manage them with:
+
+```bash
+openkb chat --list              # table of sessions: id · turns · updated · title
+openkb chat --resume            # resume the most recent session
+openkb chat --resume 20260625   # resume by id or unique prefix
+openkb chat --delete 20260625   # delete a session
+```
+
+Resuming replays the last few turns so you have context:
+
+```text
+$ openkb chat --resume
+Resumed session · 4 turn(s)
+[3] >>> How do the two papers differ on their use of attention?
+[3]     Both rely on scaled dot-product attention, but…
+[4] >>> /save attention-comparison
+```
+
+---
+
+## Slash commands
+
+Inside the REPL, lines starting with `/` are commands rather than questions. Run
+`/help` to see the current set; the built-ins are:
+
+| Command | What it does |
+| --- | --- |
+| `/help` | List available commands |
+| `/exit`, `/quit` | Leave the REPL (Ctrl-D also works) |
+| `/clear` | Start a fresh session (the previous one is saved) |
+| `/save [name]` | Export the transcript to `wiki/explorations/<name>-<date>.md` |
+| `/status` | Show KB status without leaving chat |
+| `/list` | List documents in the KB |
+| `/lint` | Run the integrity + knowledge lint |
+| `/add <path>` | Ingest a file or directory (Tab-completes paths) |
+| `/skill new <name> "<intent>"` | Compile a skill from the wiki — see [`skills/`](../skills/) |
+| `/deck new [--critique] [--skill <name>] <name> "<intent>"` | Generate an HTML deck — see [`slides/`](../slides/) |
+| `/critique <path>` | Run the HTML critic over an existing deck/page |
+
+Slash commands run inline — errors are reported and the conversation continues;
+Ctrl-C aborts the running command without ending the session.
+
+### Why slash commands matter
+
+They turn chat into a workbench: ask a question, realize you're missing a source,
+`/add` it, and keep going — all in one session. Because the chat agent can write
+to `wiki/explorations/**` and `output/**`, asking it to "write that up as a note"
+or "turn this into a skill" produces real files you keep.
+
+---
+
+## Plain output for piping or logs
+
+```bash
+openkb chat --no-color     # disable colored output entirely
+openkb chat --raw          # show raw Markdown source, keep prompt/tool colors
+```
+
+`--no-color` also respects the `NO_COLOR` environment variable.
```

**File**: `examples/commands/README.md` (added, +174/-0)
```diff
@@ -0,0 +1,174 @@
+# Command reference
+
+The everyday loop. Every command resolves the active KB the same way (see
+[`configuration/`](../configuration/#4-where-is-the-kb)), so you can run them from
+anywhere once a KB is initialized.
+
+> **Real artifact in this folder:** [`sample-wiki/`](sample-wiki/) is a complete
+> wiki compiled by `openkb add` from one paper —
+> [1 summary](sample-wiki/summaries/attention-is-all-you-need.md),
+> [3 concepts](sample-wiki/concepts/), [9 entities](sample-wiki/entities/), and a
+> saved [`query --save`](sample-wiki/explorations/) answer. Notice how every page
+> is stitched together with `[[wikilinks]]` — that cross-linking *is* the
+> knowledge graph you see in [`visualize/`](../visualize/).
+
+| Command | Purpose | Key flags |
+| --- | --- | --- |
+| `add <path\|dir\|URL>` | Ingest documents | `--from-pageindex-cloud` |
+| `query <question>` | One-off question | `--save`, `--raw` |
+| `remove <id>` | Delete a document | `--keep-raw`, `--keep-empty`, `--dry-run`, `--yes` |
+| `recompile [doc]` | Re-run the compile pipeline | `--all`, `--dry-run`, `--yes`, `--refresh-schema` |
+| `lint` | Check wiki integrity | `--fix` |
+| `list` | Show indexed docs & pages | – |
+| `status` | KB stats + root path | – |
+| `watch` | Auto-ingest files dropped in `raw/` | – |
+| `feedback [msg]` | File a prefilled GitHub issue | `--type` |
+
+---
+
+## `add` — ingest documents
+
+```bash
+openkb add ../docs/attention-is-all-you-need.pdf   # a single file
+openkb add ~/papers/                               # a directory (recursive)
+openkb add https://arxiv.org/pdf/2509.11420        # a URL
+openkb add --from-pageindex-cloud <DOC_ID>         # an already-indexed cloud doc
+```
+
+- **Supported formats:** `.pdf .md .markdown .docx .pptx .xlsx .xls .html .htm
+  .txt .csv` (plus URLs).
+- **URLs** are sniffed by content type: PDFs are downloaded and indexed; HTML is
+  run through a main-content extractor (trafilatura) and ingested as Markdown.
+- **Long vs. short PDFs** are split by `pageindex_threshold` — see
+  [`pageindex-cloud/`](../pageindex-cloud/).
+- **Idempotent:** a document is registered by content hash only after it compiles
+  successfully, so re-adding the same file is skipped and a failed add can be
+  retried.
+
+Compiling [`../docs/attention-is-all-you-need.pdf`](../docs/attention-is-all-you-need.pdf)
+is what produced [`sample-wiki/`](sample-wiki/) in this folder.
+
+---
+
+## `query` — ask a one-off question
+
+```bash
+openkb query "What are the main contributions of this paper?"
+openkb query "Compare the two training objectives" --save
+openkb query "How does this KB work?" --raw | less
+```
+
+- `--save` writes the answer to `wiki/explorations/<slug>.md` with a `query:`
+  frontmatter field, so good answers become part of the wiki.
+- `--raw` prints raw Markdown (no rich rendering) — useful for piping.
+- Output streams in a terminal and switches to a plain final answer when piped or
+  redirected, so it's safe in scripts.
+
+> **See it:** a real `--save` result is in
+> [`sample-wiki/explorations/`](sample-wiki/explorations/).
+
+---
+
+## `remove` — delete a document
+
+Identify a doc by filename, its slug, or a unique substring:
+
+```bash
+openkb remove attention-is-all-you-need.pdf     # exact filename
+openkb remove attention                         # unique substring
+openkb remove attention --dry-run               # preview, change nothing
+openkb remove attention --keep-empty            # keep concept & entity pages it solely sourced
+openkb remove attention --keep-raw --yes        # leave raw/ file, no prompt
+```
+
+`remove` deletes the summary, sources, and extracted images; drops the doc from
+every concept/entity page's `sources:` (deleting pages whose **only** source was
+this doc, unless `--keep-empty`); prunes `index.md` and the hash registry; and
+runs a scoped `lint --fix` to clean any dangling `[[wikilinks]]`. For long local
+PDFs it also clears the PageIndex state. Use `--dry-run` first when unsure.
+
+---
+
+## `recompile` — regenerate wiki pages
+
+Re-runs the compile step against already-ingested content (no re-conversion, no
+re-indexing):
+
+```bash
+openkb recompile attention                      # one document
+openkb recompile --all --dry-run                # preview the full set
+openkb recompile --all --yes                    # rebuild everything
+openkb recompile --all --refresh-schema         # also refresh wiki/AGENTS.md
+```
+
+> ⚠️ Recompiling **overwrites** generated summaries and concept pages — any manual
+> edits to those are lost. `--refresh-schema` backs up the old `AGENTS.md` to
+> `AGENTS.md.bak` before replacing it.
+
+---
+
+## `lint` — check (and fix) wiki integrity
+
+```bash
+openkb lint            # report only
+openkb lint --fix      # repair broken wikilinks first, then report
+```
+
+Checks broken `[[wikilinks]]`, orphaned pages, raw files with no wiki entry,
+`index.md` drift, and invalid frontmatter, plus an LLM-
```

**File**: `examples/commands/sample-wiki/concepts/attention-mechanisms.md` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+---
+type: "Concept"
+sources: ["summaries/attention-is-all-you-need.md"]
+description: "Methods that weight sequence elements to focus computation on relevant inputs."
+---
+
+# Attention Mechanisms
+
+## Overview
+
+Attention mechanisms are techniques for computing a weighted combination of values based on the relevance of a query to a set of keys. In sequence models, they let a model focus on the most relevant parts of an input or output sequence when producing a representation or a prediction.
+
+In [[summaries/attention-is-all-you-need]], attention is the central building block of the [[concepts/transformer-models|Transformer]], replacing recurrence and convolution entirely.
+
+## Core idea
+
+An attention mechanism takes:
+
+- a **query**
+- a set of **keys**
+- a set of **values**
+
+It produces an output by scoring how well the query matches each key, turning those scores into weights, and returning a weighted sum of the values.
+
+This makes attention useful for:
+
+- aligning input and output tokens
+- modeling long-range dependencies
+- selecting relevant context dynamically
+
+## Attention in the Transformer
+
+The paper describes two important forms of attention:
+
+### Scaled dot-product attention
+
+The Transformer computes attention using dot products between queries and keys, scaled by the square root of the key dimension before applying softmax. This scaling helps prevent large dot products from producing overly sharp softmax distributions.
+
+### Multi-head attention
+
+Instead of using a single attention operation, the model projects queries, keys, and values into multiple subspaces and applies attention in parallel. The outputs are concatenated and projected again.
+
+This lets the model attend to different kinds of relationships at the same time, such as syntax, position, or semantic association.
+
+## Self-attention
+
+A major special case is [[concepts/attention-mechanisms|self-attention]], where queries, keys, and values all come from the same sequence. In the Transformer:
+
+- the encoder uses self-attention to let each position attend to all others in the input
+- the decoder uses masked self-attention so each position can only attend to earlier outputs
+- encoder-decoder attention lets the decoder attend to the encoded input sequence
+
+Self-attention is the key mechanism that allows the Transformer to avoid recurrence while still modeling dependencies across the full sequence.
+
+## Why it matters
+
+The paper argues that attention mechanisms are advantageous because they:
+
+- reduce the number of sequential operations
+- improve parallelization during training
+- shorten paths between distant tokens
+- work well for translation and parsing tasks
+
+Compared with recurrent layers, attention can connect any pair of positions in constant depth. Compared with convolutions, it avoids needing many stacked layers to relate distant positions.
+
+## Positional information
+
+Because attention alone does not encode token order, the Transformer adds [[concepts/positional-encoding|positional encoding]] to token embeddings. This gives the model information about sequence position while preserving the parallel structure of attention-based computation.
+
+## Key takeaways from the paper
+
+- Attention is a flexible mechanism for dynamic relevance weighting.
+- Self-attention can replace recurrence in sequence models.
+- Multi-head attention improves expressiveness by attending from multiple subspaces.
+- Attention-only architectures can achieve strong results on machine translation and parsing.
+
+## Related pages
+
+- [[concepts/transformer-models]]
+- [[concepts/positional-encoding]]
+- [[summaries/attention-is-all-you-need]]
\ No newline at end of file
```

**File**: `examples/commands/sample-wiki/concepts/positional-encoding.md` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+---
+type: "Concept"
+sources: ["summaries/attention-is-all-you-need.md"]
+description: "Position information added to attention-only models so they can use order."
+---
+
+# Positional Encoding
+
+## Overview
+
+Positional encoding is the mechanism used in the Transformer to inject order information into token embeddings when the model has no recurrence or convolution. In [[summaries/attention-is-all-you-need]], it is the solution that lets the attention-only architecture know where each token appears in a sequence.
+
+## Why it is needed
+
+The Transformer model removes the sequential structure of recurrent networks. That makes it highly parallelizable, but it also means the model has no built-in sense of token order. Without an explicit position signal, the same set of tokens would look identical regardless of arrangement.
+
+Positional encoding fixes this by adding a position-dependent vector to each input embedding at the bottom of the encoder and decoder stacks.
+
+## How it works
+
+The paper uses fixed sinusoidal encodings:
+
+- even dimensions use sine functions
+- odd dimensions use cosine functions
+- each dimension has a different frequency
+
+This creates a position vector with the same dimensionality as the embeddings, so the two can be summed directly.
+
+The encoding is defined so that relative offsets can be represented as linear combinations of the encodings, which helps the model learn to attend by relative position.
+
+## Key properties
+
+### Same dimensionality as embeddings
+The positional vectors have dimension equal to the model dimension, so they can be added to token embeddings without changing shape.
+
+### Fixed, not learned
+The paper experimented with learned positional embeddings and found similar results, but chose sinusoidal encodings because they may generalize better to sequence lengths not seen during training.
+
+### Supports extrapolation
+Because the encoding is deterministic and not tied to a fixed lookup table, it can in principle be applied to longer sequences than those encountered during training.
+
+## Role in the Transformer
+
+Positional encoding is part of the input representation for both the encoder and decoder. It works alongside [[concepts/attention-mechanisms]] and [[concepts/transformer-models]] to make attention-based sequence modeling possible without recurrence.
+
+## Summary
+
+Positional encoding gives the Transformer access to token order while preserving the model’s fully parallel structure. In the original paper, sinusoidal positional encodings were an effective and elegant choice that performed on par with learned embeddings and offered potential extrapolation benefits.
```

**File**: `examples/commands/sample-wiki/concepts/transformer-models.md` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+---
+type: "Concept"
+sources: ["summaries/attention-is-all-you-need.md"]
+description: "Attention-only sequence models built around stacked self-attention."
+---
+
+# Transformer Models
+
+Transformer models are neural sequence transduction models that replace recurrence and convolution with attention-only computation. They use stacked self-attention layers to model relationships between tokens, making them highly parallelizable and effective for tasks such as machine translation and parsing.
+
+## Core idea
+
+The Transformer architecture was introduced in [[summaries/attention-is-all-you-need]] as an alternative to recurrent sequence-to-sequence models. Instead of processing tokens sequentially, it computes interactions between positions through [[concepts/attention-mechanisms|attention mechanisms]], allowing all positions to be considered in parallel during training.
+
+## Main architectural features
+
+A standard Transformer uses an encoder-decoder structure:
+
+- **Encoder**: a stack of identical layers, each containing
+  - multi-head self-attention
+  - a position-wise feed-forward network
+  - residual connections and layer normalization
+- **Decoder**: a similar stack with
+  - masked self-attention to preserve autoregressive generation
+  - encoder-decoder attention
+  - a position-wise feed-forward network
+  - residual connections and layer normalization
+
+The model also uses [[concepts/positional-encoding|positional encoding]] to inject token order information, since the architecture itself has no recurrence or convolution.
+
+## Why the architecture matters
+
+Transformer models were important because they addressed several limitations of recurrent neural networks:
+
+- **Parallelism**: training can process many positions at once
+- **Shorter dependency paths**: long-range relationships are easier to learn
+- **Efficiency**: they can train faster while achieving strong quality
+
+The paper argues that self-attention reduces the maximum path length between positions to a constant per layer, which helps with long-distance dependencies.
+
+## Attention in Transformers
+
+Transformers use attention in three main places:
+
+- **Encoder self-attention**: each input position attends to all other input positions
+- **Decoder self-attention**: each output position attends only to earlier output positions
+- **Encoder-decoder attention**: decoder states attend to encoder outputs
+
+The paper uses **scaled dot-product attention** and **multi-head attention**. Multiple heads let the model attend to different subspaces and different kinds of relationships at the same time.
+
+## Practical configuration from the paper
+
+The original Transformer used:
+
+- 6 encoder layers and 6 decoder layers
+- model dimension 512 in the base model
+- 8 attention heads
+- feed-forward inner dimension 2048
+- dropout and label smoothing during training
+
+The paper also reported a larger model that achieved even better translation results.
+
+## Results and impact
+
+In the source paper, Transformer models achieved state-of-the-art performance on:
+
+- [[entities/wmt-2014-english-german|WMT 2014 English-German]] translation
+- [[entities/wmt-2014-english-french|WMT 2014 English-French]] translation
+
+They also generalized well to English constituency parsing. The architecture became foundational for later advances in natural language processing and sequence modeling.
+
+## Related concepts
+
+- [[concepts/attention-mechanisms]]
+- [[concepts/positional-encoding]]
+- [[summaries/attention-is-all-you-need]]
+
+## Notable significance
+
+Transformer models are widely seen as a turning point in deep learning for language. Their attention-only design helped establish a new default architecture for machine translation, language modeling, and many other sequence tasks.
\ No newline at end of file
```

**File**: `examples/commands/sample-wiki/entities/google-brain.md` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+---
+sources: ["summaries/attention-is-all-you-need.md"]
+type: "Organization"
+description: "Google Brain is a Google research team involved in the Transformer paper."
+---
+
+## Overview
+
+Google Brain is a research organization within Google that appears in the author affiliations of [[summaries/attention-is-all-you-need]]. In that paper, multiple coauthors list Google Brain as their home institution, and the team is credited with major contributions to the development, implementation, and evaluation of the [[concepts/transformer-models|Transformer]] architecture.
+
+## Role in *Attention Is All You Need*
+
+The paper credits Google Brain personnel for several core aspects of the work, including:
+
+- proposing and evaluating self-attention as a replacement for recurrent layers
+- designing and implementing the first Transformer models
+- proposing scaled dot-product attention and multi-head attention
+- building and improving the codebase used for experiments
+- supporting efficient inference and visualization work
+
+## Named contributors affiliated with Google Brain in the paper
+
+Several authors are listed with Google Brain affiliations, including:
+
+- Ashish Vaswani
+- Noam Shazeer
+- Łukasz Kaiser
+
+The paper also notes collaborative work across [[entities/google-research|Google Research]] and other institutions.
+
+## Related ideas
+
+Google Brain's work in this paper is closely tied to:
+
+- [[concepts/attention-mechanisms|attention mechanisms]]
+- [[concepts/transformer-models|Transformer models]]
+- [[concepts/positional-encoding|positional encoding]]
+
+## Related documents
+
+- [[summaries/attention-is-all-you-need]]
+
+## Notes
+
+In this document, Google Brain is presented as the institutional setting for a major breakthrough in neural machine translation and sequence modeling, and as a central contributor to the Transformer architecture that became foundational in later NLP systems.
\ No newline at end of file
```

---

### Incident Patch 15: `b2a47757` (2026-06-24)
**Commit Message**: fix(compiler): preserve frontmatter when closing "---" has no trailing newline (#121)

* fix(compiler): preserve frontmatter when closing "---" has no trailing newline

`frontmatter.split` returns the frontmatter block ending in a bare "\n---"
(not "\n---\n") for a page that ends right at the closing delimiter with no
trailing newline — e.g. a frontmatter-only concept/entity page. Both
`_prepend_source_to_frontmatter` and `_remove_source_from_frontmatter` located
the closing delimiter with `fm_block.rpartition("\n---\n")`, which finds
nothing in that case: `fm_prefix` becomes "" and every existing frontmatter
line (the opening "---", `type`, `description`, and the prior `sources:` list)
is dropped — silently corrupting the page and losing source provenance.

Strip whichever closing form is actually present ("\n---\n" or a bare "\n---")
and re-append the same one. Pages that have a body (the common case) are
byte-for-byte unaffected.

This is reached in practice via `_add_related_link` (run for every related
concept/entity during compile) and the `openkb remove` flow
(`remove_doc_from_{concept,entity}_pages`).

Adds `TestFrontmatterSourceMutation` covering prepend + remove on a
no-t

**File**: `openkb/agent/compiler.py` (modified, +13/-7)
```diff
@@ -951,12 +951,15 @@ def _prepend_source_to_frontmatter(text: str, source_file: str) -> str:
         return text
 
     fm_block, body = parts
-    # Split the fm_block into lines for per-line manipulation. fm_block ends
-    # with "\n---\n"; strip the trailing closing delimiter + newline to get
-    # the prefix lines (opening "---" + content lines), then re-append after.
-    fm_prefix, _, _ = fm_block.rpartition("\n---\n")
+    # Strip the trailing closing delimiter to get the prefix lines (opening
+    # "---" + content lines), then re-append it. `frontmatter.split` leaves the
+    # closing at the end of fm_block as either "\n---\n" or a bare "\n---" (when
+    # the page ends at the delimiter with no trailing newline). Assuming only
+    # "\n---\n" would, for the bare form, make the strip below collapse the
+    # whole block and drop every existing frontmatter key.
+    closing = "\n---\n" if fm_block.endswith("\n---\n") else "\n---"
+    fm_prefix = fm_block[: -len(closing)]
     fm_lines = fm_prefix.split("\n")
-    closing = "\n---\n"
 
     for i, line in enumerate(fm_lines):
         if not line.lstrip().startswith("sources:"):
@@ -992,9 +995,12 @@ def _remove_source_from_frontmatter(text: str, source_file: str) -> tuple[str, b
         return text, False
 
     fm_block, body = parts
-    fm_prefix, _, _ = fm_block.rpartition("\n---\n")
+    # See _prepend_source_to_frontmatter: the closing delimiter may be "\n---\n"
+    # or a bare "\n---" (no trailing newline); strip whichever is present so the
+    # existing frontmatter lines (and the sources: line we need) are preserved.
+    closing = "\n---\n" if fm_block.endswith("\n---\n") else "\n---"
+    fm_prefix = fm_block[: -len(closing)]
     fm_lines = fm_prefix.split("\n")
-    closing = "\n---\n"
 
     for i, line in enumerate(fm_lines):
         if not line.lstrip().startswith("sources:"):
```

**File**: `tests/test_compiler.py` (modified, +33/-0)
```diff
@@ -27,11 +27,44 @@
     _parse_entities_plan,
     _filter_entity_items,
     _ENTITY_TYPE_LIST,
+    _prepend_source_to_frontmatter,
+    _remove_source_from_frontmatter,
     remove_doc_from_entity_pages,
 )
 from openkb.config import resolve_entity_types
 
 
+class TestFrontmatterSourceMutation:
+    """``_prepend_source_to_frontmatter``/``_remove_source_from_frontmatter`` must preserve existing
+    frontmatter even when the page ends at the closing ``---`` with no trailing
+    newline — ``frontmatter.split`` then returns a block ending in a bare
+    ``\\n---`` rather than ``\\n---\\n``.
+    """
+
+    def test_prepend_preserves_keys_without_trailing_newline(self):
+        text = '---\nsources: ["summaries/p1.md"]\ntype: "Concept"\ndescription: "Focus"\n---'
+        out = _prepend_source_to_frontmatter(text, "summaries/p2.md")
+        assert out.startswith("---\n")            # opening delimiter kept
+        assert 'type: "Concept"' in out           # other keys kept
+        assert 'description: "Focus"' in out
+        assert "summaries/p1.md" in out           # existing source kept
+        assert "summaries/p2.md" in out           # new source prepended
+
+    def test_remove_preserves_keys_without_trailing_newline(self):
+        text = '---\ntype: "Organization"\nsources: ["summaries/doc.md"]\n---'
+        out, now_empty = _remove_source_from_frontmatter(text, "summaries/doc.md")
+        assert now_empty is True                  # it was the only source
+        assert 'type: "Organization"' in out      # other key preserved
+        assert "summaries/doc.md" not in out      # source removed
+
+    def test_prepend_with_body_is_unchanged(self):
+        text = '---\nsources: ["a.md"]\ntype: "Concept"\n---\n\nBody.\n'
+        out = _prepend_source_to_frontmatter(text, "b.md")
+        assert out.startswith("---\n")
+        assert "b.md" in out and "a.md" in out
+        assert out.endswith("\n\nBody.\n")         # body + closing untouched
+
+
 class TestParseJson:
     def test_plain_json(self):
         assert _parse_json('[{"name": "foo"}]') == [{"name": "foo"}]
```

#### Recent Merged Pull Requests:
- **PR #268** (closed): fix(compiler): cap concept/entity brief lists in the plan prompt (@rodrigedilson-ia)
- **PR #230** (closed): fix(compiler): retry transient LLM API timeouts with bounded backoff (@sebastianbraun25)
- **PR #227** (closed): fix(web): show recent session times in local timezone (@lwylab)
- **PR #223** (closed): feat: add temporal claims to wiki pages (@Amidwestnoob)
- **PR #212** (closed): fix: keep add event stream alive (@wachiravit-thitagran)
- **PR #208** (closed): fix: use latest UI LLM settings for ingest (@wachiravit-thitagran)
- **PR #207** (closed): chore: bump openai-agents to 0.19.0 and openai to 2.48.0 (@mixxer)
- **PR #206** (closed): Fix/litellm api base provider prefixed models (@syzykf02)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
