# Forensic Learning Record (Deep Inspection): Manavarya09/design-extract

> **Canonical Artifact**: `07_PROJECT_LEARNING/manavarya09-design-extract-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Manavarya09/design-extract](https://github.com/Manavarya09/design-extract))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:59:51.424Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Manavarya09/design-extract`
- **Description**: Extract any website's complete design system with one command. DTCG tokens, semantic+primitive+composite, MCP server for Claude Code/Cursor/Windsurf, multi-platform emitters (iOS SwiftUI, Android Compose, Flutter, WordPress), Tailwind v4, Figma variables, shadcn/ui, CSS health audit, WCAG remediation, Chrome extension. MIT, Playwright, Node 20+.
- **Primary Language / Ecosystem**: HTML
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4170 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bench/score.js`
```
// Pure scoring for the extraction benchmark. Kept apart from the runner so the
// numbers we publish are unit-tested, not just printed.

export function toHex(value) {
  if (value == null) return null;
  if (typeof value === 'object') return toHex(value.hex ?? value.value ?? null);
  const s = String(value).trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return '#' + m[1].split('').map((c) => c + c).join('');
  m = s.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/);
  if (m) return '#' + m[1];
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return '#' + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  return null;
}

function hexToLab(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// CIE76 distance in Lab.
export function deltaE(a, b) {
  const [l1, a1, b1] = hexToLab(a);
  const [l2, a2, b2] = hexToLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

// ΔE ≤ 10 is "the same brand colour" (#0070f3 vs #0072f5 is under 1), while
// neighbouring hues on a brand's palette sit well above it.
export const COLOR_TOLERANCE = 10;

export function colorHit(predicted, truths, tolerance = COLOR_TOLERANCE) {
  const hex = toHex(predicted);
  if (!hex) return false;
  return truths.some((t) => {
    const truth = toHex(t);
    return truth != null && deltaE(hex, truth) <= tolerance;
  });
}

// "sohne-var" and "Söhne", "Inter Variable" and "Inter", "Mona Sans VF" and
// "Mona Sans" name the same family.
export function normalizeFont(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/["']/g, '')
    .replace(/\b(variable|var|vf)\b/g, '')
    .replace(/[\s_-]+/g, '');
}

export function fontHit(predicted, truths) {
  const p = normalizeFont(predicted);
  if (!p) return false;
  return truths.some((t) => {
    const n = normalizeFont(t);
    return n.length > 0 && (p.includes(n) || n.includes(p));
  });
}

function mostUsed(entries, nameKey) {
  const counts = new Map();
  for (const e of entries) {
    const name = e?.[nameKey];
    if (name) counts.set(name, (counts.get(name) || 0) + (e.count || 1));
  }
  let best = null;
  for (const [name, count] of counts) if (!best || count > best[1]) best = [name, count];
  return best?.[0] ?? null;
}

// Both readers apply the same rule: the most used of the families each tool
// says sets body text, else its most used family overall. Neither tool is
// judged on its heading face.
export function readDesignlang(design) {
  const families = design?.typography?.families || [];
  // designlang marks a family used for both headings and body as "all".
  const body = families.filter((f) => f.usage === 'body' || f.usage === 'all');
  return {
    primary: toHex(design?.colors?.primary),
    font: mostUsed(body, 'name') ?? mostUsed(families, 'name'),
  };
}

export function readDembrandt(output) {
  const styles = output?.typography?.styles || [];
  const body = styles.filter((s) => s.context === 'body');
  return {
    primary: toHex(output?.colors?.semantic?.primary),
    font: mostUsed(body, 'family') ?? mostUsed(styles, 'family'),
  };
}

// A dimension with no ground truth (a monochrome brand, a system body font)
// scores null: not counted, rather than counted against either tool.
export function scoreSite(truth, predicted) {
  return {
    color: truth.primary?.length ? colorHit(predicted?.primary, truth.primary) : null,
    font: truth.font?.length ? fontHit(predicted?.font, truth.font) : null,
  };
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// rows: [{ site, ok, seconds, score: { color, font } }] for one tool. A failed
// run keeps its false scores, so it counts as a miss wherever truth exists.
export function summarize(rows) {
  const ran = rows.filter((r) => r.ok);
  return {
    sites: rows.length,
    failures: rows.length - ran.length,
    colorSites: rows.filter((r) => r.score.color !== null).length,
    colorHits: rows.filter((r) => r.score.color === true).length,
    fontSites: rows.filter((r) => r.score.font !== null).length,
    fontHits: rows.filter((r) => r.score.font === true).length,
    medianSeconds: median(ran.map((r) => r.seconds)),
  };
}

```

### Core Architecture Module: `raycast-extension/src/score.tsx`
```
import { Action, ActionPanel, Detail, Form, Toast, showToast } from "@raycast/api";
import { execFile } from "child_process";
import { useState } from "react";

function normalizeUrl(u: string) {
  const t = u.trim();
  return t.startsWith("http") ? t : `https://${t}`;
}

export default function Command() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function run(values: { url: string }) {
    const toast = await showToast({ style: Toast.Style.Animated, title: "designlang: scoring..." });
    execFile(
      "npx",
      ["-y", "designlang", "score", normalizeUrl(values.url)],
      { maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          toast.style = Toast.Style.Failure;
          toast.title = "Scoring failed";
          toast.message = (stderr || err.message).slice(0, 200);
          return;
        }
        toast.style = Toast.Style.Success;
        toast.title = "Scored";
        // Strip ANSI control codes
        setResult("```\n" + stdout.replace(/\u001b\[[0-9;]*m/g, "") + "\n```");
      }
    );
  }

  if (result) {
    return <Detail markdown={result} />;
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Score Design" onSubmit={run} />
        </ActionPanel>
      }
    >
      <Form.TextField id="url" title="URL" placeholder="https://linear.app" value={url} onChange={setUrl} />
    </Form>
  );
}

```

### Core Architecture Module: `src/extractors/form-states.js`
```
// v10.5 — Form & State Capture
//
// The states LLM agents always botch when rebuilding: form fields (styling
// per type), validation hints, modal containers (backdrop + panel geometry),
// empty / loading / error placeholders, skeleton shapes, and which toast
// library (if any) is on the page. Pure function — reads the crawler's
// existing computedStyles + sections + componentCandidates.

const TOAST_LIBS = [
  { id: 'sonner', re: /\bsonner\b|sonner-toast/i },
  { id: 'react-hot-toast', re: /react-hot-toast/i },
  { id: 'react-toastify', re: /react-toastify/i },
  { id: 'radix-toast', re: /radix-toast|data-radix-toast/i },
  { id: 'chakra-toast', re: /chakra-toast/i },
  { id: 'notistack', re: /notistack/i },
];

const SKELETON_CLASS_RE = /\b(skeleton|placeholder-loading|shimmer|pulse-loading|animate-pulse)\b/i;
const SPINNER_CLASS_RE = /\b(spinner|loading-indicator|loader)\b/i;
const EMPTY_STATE_RE = /\b(empty-state|no-results|no-data|nothing-here)\b/i;
const ERROR_STATE_RE = /\b(error-state|error-message|alert-error|form-error|invalid)\b/i;

function summarizeInputs(styles = []) {
  const types = {};
  for (const s of styles) {
    if (!s.tag || !/^(input|textarea|select)$/i.test(s.tag)) continue;
    const t = (s.type || s.inputType || s.tag).toLowerCase();
    types[t] = (types[t] || 0) + 1;
  }
  return types;
}

function detectToastLib(stack = {}) {
  const haystack = [
    ...(stack.scripts || []),
    ...(stack.classNameSample || []),
  ].join(' ');
  return TOAST_LIBS.filter(t => t.re.test(haystack)).map(t => t.id);
}

function detectModals(sections = []) {
  return sections.filter(s => {
    const blob = `${s.className || ''} ${s.role || ''}`.toLowerCase();
    return /\bmodal\b|dialog|overlay|drawer|sheet/.test(blob) || s.role === 'dialog';
  }).map(s => ({
    role: s.role || null,
    className: (s.className || '').slice(0, 80),
    bounds: s.bounds || null,
  }));
}

function classBasedScan(classSample = []) {
  let skeleton = 0, spinner = 0, emptyState = 0, errorState = 0;
  for (const c of classSample) {
    if (SKELETON_CLASS_RE.test(c)) skeleton++;
    if (SPINNER_CLASS_RE.test(c)) spinner++;
    if (EMPTY_STATE_RE.test(c)) emptyState++;
    if (ERROR_STATE_RE.test(c)) errorState++;
  }
  return { skeleton, spinner, emptyState, errorState };
}

function summarizeFormFields(candidates = []) {
  const inputs = candidates.filter(c => c.kind === 'input');
  if (!inputs.length) return { count: 0, families: {} };
  const families = {};
  for (const inp of inputs) {
    const key = [
      inp.css?.borderRadius || '',
      inp.css?.padding || '',
      inp.css?.border || '',
    ].join('|');
    families[key] = (families[key] || 0) + 1;
  }
  return { count: inputs.length, families: Object.values(families).slice(0, 6) };
}

export function extractFormStates(rawData = {}, design = {}) {
  const light = rawData.light || {};
  const stack = light.stack || {};
  const sections = light.sections || [];
  const candidates = light.componentCandidates || [];

  const toastLibs = detectToastLib(stack);
  const modals = detectModals(sections);
  const classScan = classBasedScan(stack.classNameSample || []);
  const form = summarizeFormFields(candidates);
  const inputTypes = summarizeInputs(light.computedStyles || []);

  const flags = [];
  if (classScan.skeleton) flags.push('skeleton-loading');
  if (classScan.spinner) flags.push('spinner-loading');
  if (classScan.emptyState) flags.push('empty-state');
  if (classScan.errorState) flags.push('error-state');
  if (modals.length) flags.push('modal');
  if (toastLibs.length) flags.push('toast-library');
  if (form.count) flags.push('forms');

  return {
    flags,
    forms: form,
    inputTypesSeen: inputTypes,
    modals,
    toastLibraries: toastLibs,
    loading: { skeleton: classScan.skeleton, spinner: classScan.spinner },
    empty: { count: classScan.emptyState },
    error: { count: classScan.errorState },
  };
}

```

### Core Architecture Module: `src/extractors/interaction-states.js`
```
// Structured catalog of transition styles captured by the Tier-2 interaction
// pass — hover deltas, modal appearance, menu styling.

function diffStyles(before, after) {
  const diff = {};
  if (!before || !after) return diff;
  for (const k of Object.keys(after)) {
    if (before[k] !== after[k]) {
      diff[k] = { from: before[k], to: after[k] };
    }
  }
  return diff;
}

export function extractInteractionStates(interactState) {
  if (!interactState || typeof interactState !== 'object') {
    return {
      scrollSettled: false,
      menusOpened: 0,
      hover: { sampled: 0, changed: 0, deltas: [] },
      accordionsOpened: 0,
      modals: [],
    };
  }

  const deltas = [];
  const samples = Array.isArray(interactState.hoverSamples) ? interactState.hoverSamples : [];
  for (const s of samples) {
    const d = diffStyles(s.before, s.after);
    if (Object.keys(d).length > 0) {
      deltas.push({ selector: s.selector, changes: d });
    }
  }

  const modals = Array.isArray(interactState.modals) ? interactState.modals.map(m => ({
    trigger: m.trigger || '',
    bg: m.snapshot?.bg || '',
    color: m.snapshot?.color || '',
    boxShadow: m.snapshot?.boxShadow || '',
    borderRadius: m.snapshot?.borderRadius || '',
    width: m.snapshot?.width || 0,
    height: m.snapshot?.height || 0,
    role: m.snapshot?.role || '',
  })) : [];

  return {
    scrollSettled: !!interactState.scrollSettled,
    menusOpened: interactState.menusOpened || 0,
    hover: {
      sampled: samples.length,
      changed: deltas.length,
      deltas,
    },
    accordionsOpened: interactState.accordionsOpened || 0,
    modals,
  };
}

```

### Core Architecture Module: `src/utils-cookies.js`
```
// Cookie file loaders. Supports three formats so users can paste whatever
// their existing tooling exports:
//   - JSON array of Playwright cookie objects: [{name, value, domain, path, …}]
//   - Playwright storageState JSON: { cookies: [...], origins: [...] }
//   - Netscape cookies.txt: tab-separated lines (curl / wget / browser extensions)
//
// Returned shape is always the Playwright cookie array.

import { readFileSync } from 'fs';

function parseNetscape(text, targetUrl) {
  const cookies = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Skip comment lines, but keep the Netscape `#HttpOnly_<domain>` prefix
    // that browsers use to mark HttpOnly cookies — those are real entries.
    if (line.startsWith('#') && !/^#HttpOnly_/i.test(line)) continue;
    const parts = raw.split('\t');
    if (parts.length < 7) continue;
    const [domain, , path, secure, expires, name, value] = parts;
    if (!name) continue;
    const cookie = {
      name,
      value: value ?? '',
      domain: domain.replace(/^#HttpOnly_/i, ''),
      path: path || '/',
      secure: secure === 'TRUE',
      httpOnly: /^#HttpOnly_/i.test(domain),
    };
    const exp = Number(expires);
    if (Number.isFinite(exp) && exp > 0) cookie.expires = exp;
    if (!cookie.domain && targetUrl) cookie.url = targetUrl;
    cookies.push(cookie);
  }
  return cookies;
}

function parseJson(text) {
  const parsed = JSON.parse(text);
  // Playwright storageState: { cookies: [...], origins: [...] }
  if (parsed && Array.isArray(parsed.cookies)) return parsed.cookies;
  // Raw array
  if (Array.isArray(parsed)) return parsed;
  throw new Error('cookie file: JSON must be a cookie array or Playwright storageState');
}

export function loadCookiesFromFile(filePath, targetUrl) {
  const text = readFileSync(filePath, 'utf-8');
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJson(text);
  }
  return parseNetscape(text, targetUrl);
}

// Merge CLI-provided cookies (name=value strings) with file cookies.
// Later entries (file) override earlier entries (CLI) at the same name+domain.
export function mergeCookies(cliCookies = [], fileCookies = [], targetUrl) {
  const seen = new Map();
  const parseCli = (c) => {
    if (typeof c !== 'string') return c;
    const [name, ...rest] = c.split('=');
    return { name, value: rest.join('='), url: targetUrl };
  };
  for (const c of [...cliCookies.map(parseCli), ...fileCookies]) {
    if (!c || !c.name) continue;
    const key = `${c.name}|${c.domain || c.url || ''}`;
    seen.set(key, c);
  }
  return [...seen.values()];
}

```

### Core Architecture Module: `src/utils.js`
```
// Named CSS colors (subset — the 17 standard + common extras)
const NAMED_COLORS = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 },
  green: { r: 0, g: 128, b: 0, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 },
  yellow: { r: 255, g: 255, b: 0, a: 1 },
  cyan: { r: 0, g: 255, b: 255, a: 1 },
  magenta: { r: 255, g: 0, b: 255, a: 1 },
  gray: { r: 128, g: 128, b: 128, a: 1 },
  grey: { r: 128, g: 128, b: 128, a: 1 },
  orange: { r: 255, g: 165, b: 0, a: 1 },
  purple: { r: 128, g: 0, b: 128, a: 1 },
  pink: { r: 255, g: 192, b: 203, a: 1 },
  navy: { r: 0, g: 0, b: 128, a: 1 },
  teal: { r: 0, g: 128, b: 128, a: 1 },
  silver: { r: 192, g: 192, b: 192, a: 1 },
  maroon: { r: 128, g: 0, b: 0, a: 1 },
};

function oklabToRgb(L, a, b) {
  // OKLab -> linear sRGB
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  // Clamp to [0,255]
  const clamp = v => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return { r: clamp(r), g: clamp(g), b: clamp(bl) };
}

function oklchToRgb(L, C, H) {
  const hRad = H * Math.PI / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  return oklabToRgb(L, a, b);
}

export function parseColor(str) {
  if (!str || str === 'none' || str === 'currentcolor' || str === 'inherit' || str === 'initial') return null;
  str = str.trim().toLowerCase();

  if (NAMED_COLORS[str]) return { ...NAMED_COLORS[str] };

  // hex: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3) return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16), a: 1 };
    if (hex.length === 4) return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16), a: parseInt(hex[3] + hex[3], 16) / 255 };
    if (hex.length === 6) return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
    if (hex.length === 8) return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: parseInt(hex.slice(6, 8), 16) / 255 };
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    return { r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3], a: rgbMatch[4] !== undefined ? +rgbMatch[4] : 1 };
  }

  // Modern syntax: rgb(r g b / a)
  const rgbModern = str.match(/rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+%?))?\s*\)/);
  if (rgbModern) {
    let a = 1;
    if (rgbModern[4] !== undefined) {
      a = rgbModern[4].endsWith('%') ? parseFloat(rgbModern[4]) / 100 : +rgbModern[4];
    }
    return { r: +rgbModern[1], g: +rgbModern[2], b: +rgbModern[3], a };
  }

  // hsl(h, s%, l%) or hsla(h, s%, l%, a)
  const hslMatch = str.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)/);
  if (hslMatch) {
    const rgb = hslToRgb(+hslMatch[1], +hslMatch[2], +hslMatch[3]);
    return { ...rgb, a: hslMatch[4] !== undefined ? +hslMatch[4] : 1 };
  }

  // hsl modern: hsl(210 50% 40%) or hsl(210 50% 40% / 0.5)
  const hslModern = str.match(/hsla?\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*([\d.]+%?))?\s*\)/);
  if (hslModern) {
    const rgb = hslToRgb(+hslModern[1], +hslModern[2], +hslModern[3]);
    let a = 1;
    if (hslModern[4] !== undefined) {
      a = hslModern[4].endsWith('%') ? parseFloat(hslModern[4]) / 100 : +hslModern[4];
    }
    return { ...rgb, a };
  }

  // oklch(L C H) or oklch(L C H / a)
  const oklchMatch = str.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/);
  if (oklchMatch) {
    const rgb = oklchToRgb(+oklchMatch[1], +oklchMatch[2], +oklchMatch[3]);
    let a = 1;
    if (oklchMatch[4] !== undefined) {
      a = oklchMatch[4].endsWith('%') ? parseFloat(oklchMatch[4]) / 100 : +oklchMatch[4];
    }
    return { ...rgb, a };
  }

  // oklab(L a b) or oklab(L a b / alpha)
  const oklabMatch = str.match(/oklab\(\s*([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/);
  if (oklabMatch) {
    const rgb = oklabToRgb(+oklabMatch[1], +oklabMatch[2], +oklabMatch[3]);
    let a = 1;
    if (oklabMatch[4] !== undefined) {
      a = oklabMatch[4].endsWith('%') ? parseFloat(oklabMatch[4]) / 100 : +oklabMatch[4];
    }
    return { ...rgb, a };
  }

  // color-mix(in srgb, color1 pct, color2)
  const mixMatch = str.match(/color-mix\(\s*in\s+\w+\s*,\s*(.+?)\s*,\s*(.+?)\s*\)/);
  if (mixMatch) {
    const part1 = mixMatch[1].trim().replace(/\s+\d+%$/, '');
    const part2 = mixMatch[2].trim().replace(/\s+\d+%$/, '');
    const c1 = parseColor(part1);
    const c2 = parseColor(part2);
    if (c1 && c2) {
      return { r: Math.round((c1.r + c2.r) / 2), g: Math.round((c1.g + c2.g) / 2), b: Math.round((c1.b + c2.b) / 2), a: (c1.a + c2.a) / 2 };
    }
  }

  return null;
}

export function rgbToHex({ r, g, b }) {
  const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  };
}

export function colorDistance(c1, c2) {
  return Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);
}

export function isSaturated({ r, g, b }) {
  const { s } = rgbToHsl({ r, g, b });
  return s > 10;
}

export function clusterColors(colors, threshold = 15) {
  const clusters = [];
  for (const color of colors) {
    const existing = clusters.find(c => colorDistance(c.representative, color.parsed) < threshold);
    if (existing) {
      existing.members.push(color);
      existing.count += color.count;
    } else {
      clusters.push({ representative: color.parsed, hex: color.hex, members: [color], count: color.count });
    }
  }
  // The first encountered colour seeded each cluster, but that's order-of-
  // iteration accident, not signal. Re-pick the representative as the
  // most-used member of the cluster so downstream consumers (primary
  // detection, palette display, brand book) get the dominant shade.
  for (const cluster of clusters) {
    if (cluster.members.length > 1) {
      const dominant = cluster.members.reduce(
        (best, m) => (m.count > best.count ? m : best),
        cluster.members[0],
      );
      cluster.representative = dominant.parsed;
      cluster.hex = dominant.hex;
    }
  }
  return clusters.sort((a, b) => b.count - a.count);
}

export function clusterValues(values, threshold) {
  const sorted = [...values].sort((a, b) => a - b);
  const groups = [];
  for (const v of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(v - last.representative) <= threshold) {
      last.members.push(v);
    } else {
      groups.push({ representative: v, members: [v] });
    }
  }
  return groups.map(g => g.representative);
}

export function parseCSSValue(str) {
  if (!str || str === 'normal' || str === 'auto' || str === 'none') return null;
  const match = str.match(/^([\d.]+)(px|rem|em|%|vw|vh|pt)?$/);
  if (!match) return null;
  return { value: parseFloat(match[1]), unit: match[2] || '' };
}

export function remToPx(rem, base = 16) {
  return rem * base;
}

export function pxToRem(px, base = 16) {
  return +(px / base).toFixed(4);
}

export function safeName(str) {
  return str.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

export function nameFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return safeName(hostname.replace(/^www\./, ''));
  } catch {
    return 'unknown-site';
  }
}

export function detectScale(values) {
  if (values.length < 3) return { base: null, scale: values };
  // Expanded candidate set. Real production palettes use 4/8 (Tailwind +
  // Material), 5 (Bootstrap), 6 (some Apple specs), 7 (rare), 10/12/16
  // (looser systems). 2 stays as a fallback for icon/component-level
  // numbers. We give 4 and 8 a small head-start because they win >70%
  // of the time and were the previous-only choices — keeps results
  // stable for sites that worked before.
  const candidates = [2, 4, 5, 6, 7, 8, 10, 12, 16];
  const bonus = { 4: 0.04, 8: 0.04 };
  let bestBase = null;
  let bestScore = 0;
  for (const base of candidates) {
    const fit = values.filter(v => v > 0 && v % base === 0).length / values.length;
    const score = fit + (bonus[base] || 0);
    if (score > bestScore) { bestScor
```

### Core Architecture Module: `src/utils/color-gamut.js`
```
// OKLCH / OKLab → sRGB hex conversion utilities.
// Based on the public OKLab formulas by Björn Ottosson
// (https://bottosson.github.io/posts/oklab/). Implemented locally (no deps).

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function linearToSrgb(x) {
  // Convert linear-light sRGB [0..1] to sRGB gamma-encoded [0..1]
  if (x < 0) x = 0;
  if (x > 1) x = 1;
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

export function oklabToSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b2 = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b2)];
}

export function oklchToSrgb(L, C, h) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  return oklabToSrgb(L, a, b);
}

function toHex(v) {
  const n = Math.round(clamp01(v) * 255);
  return n.toString(16).padStart(2, '0');
}

export function rgbToHex(r, g, b) {
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

// Parse an oklch() or oklab() CSS value. Accepts values like:
//   oklch(62.8% 0.258 29.23)
//   oklch(0.628 0.258 29.23)
//   oklab(0.628 0.1 -0.1)
// Returns { type: 'oklch'|'oklab', L, C, h, a, b, raw } or null.
export function parseOklchOrOklab(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/^\s*(oklch|oklab)\(\s*([^)]+)\)\s*$/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  // Strip alpha (everything after /)
  const body = m[2].split('/')[0].trim();
  const parts = body.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;

  function parseNum(s, scale = 1) {
    if (s.endsWith('%')) return parseFloat(s) / 100;
    return parseFloat(s) * scale;
  }

  const p0 = parts[0].endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0]);
  const p1 = parseFloat(parts[1]);
  const p2 = parseFloat(parts[2]);
  if ([p0, p1, p2].some(v => Number.isNaN(v))) return null;

  if (type === 'oklch') return { type, L: p0, C: p1, h: p2, raw };
  return { type, L: p0, a: p1, b: p2, raw };
}

export function oklchLikeToHex(raw) {
  const parsed = parseOklchOrOklab(raw);
  if (!parsed) return null;
  const [r, g, b] = parsed.type === 'oklch'
    ? oklchToSrgb(parsed.L, parsed.C, parsed.h)
    : oklabToSrgb(parsed.L, parsed.a, parsed.b);
  return rgbToHex(r, g, b);
}

// ── Inverse direction (sRGB → OKLab → OKLCH) ───────────────────
// Forward Björn Ottosson formulas. Used by the recolor pipeline so we can
// hue-rotate brand palettes while preserving perceptual lightness.

function srgbToLinear(x) {
  if (x <= 0.04045) return x / 12.92;
  return Math.pow((x + 0.055) / 1.055, 2.4);
}

export function srgbToOklab(r, g, b) {
  // sRGB inputs in 0..1, gamma-encoded.
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

export function srgbToOklch(r, g, b) {
  const [L, a, bx] = srgbToOklab(r, g, b);
  const C = Math.sqrt(a * a + bx * bx);
  let h = Math.atan2(bx, a) * 180 / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

// Hex string → { L, C, h } in OKLCH. Returns null on parse failure.
export function hexToOklch(hex) {
  if (typeof hex !== 'string') return null;
  const m = hex.replace(/^#/, '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  return srgbToOklch(r, g, b);
}

// { L, C, h } → hex string. Clamps to sRGB gamut by reducing chroma if the
// colour falls outside displayable range.
export function oklchToHex({ L, C, h }) {
  // Try the requested chroma, then back off if any channel goes out of range.
  for (let factor = 1; factor >= 0; factor -= 0.05) {
    const [r, g, b] = oklchToSrgb(L, C * factor, h);
    if (r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001) {
      return rgbToHex(r, g, b);
    }
  }
  return rgbToHex(...oklchToSrgb(L, 0, h));
}

```

### Core Architecture Module: `src/utils/palette-compress.js`
```
// Smart palette compression via LAB-space k-means.
//
// Raw extractions often yield 60–200 unique colours (every minor RGB
// variation, every transparent overlay's blended result). That's noise,
// not a system. This module reduces a long input list to a short,
// perceptually distinct output palette by:
//
//   1. Converting every hex to CIELAB (perceptually uniform)
//   2. Weighting each colour by its usage count (frequency)
//   3. Running weighted k-means with k+ seeded by the most-used colours
//   4. Returning the cluster medoids (the actual real colour closest to
//      each cluster centre — not a synthesised average that doesn't
//      exist on the page).
//
// Pure functions, no dependencies. ~150 LOC.

function hexToRgb(hex) {
  const s = String(hex || '').trim().replace(/^#/, '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

// sRGB → linear → XYZ → CIELAB (D65)
function rgbToLab(rgb) {
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => v / 255);
  const lin = srgb.map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
  const [r, g, b] = lin;
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
  const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function dist2(p, q) {
  const dL = p.L - q.L, da = p.a - q.a, db = p.b - q.b;
  return dL * dL + da * da + db * db;
}

function weightedCentroid(members) {
  let wL = 0, wa = 0, wb = 0, w = 0;
  for (const m of members) {
    w  += m.weight;
    wL += m.lab.L * m.weight;
    wa += m.lab.a * m.weight;
    wb += m.lab.b * m.weight;
  }
  return w > 0 ? { L: wL / w, a: wa / w, b: wb / w } : members[0]?.lab || { L: 0, a: 0, b: 0 };
}

function pickFurthestSeeds(points, k) {
  if (points.length <= k) return points.map((p) => p.lab);
  // Seed with the most-used colour, then pick the k-1 colours furthest from
  // any already-seeded colour (max-min). Deterministic, no randomness, so
  // the same input gives the same output every run.
  const seeds = [];
  const sorted = [...points].sort((x, y) => y.weight - x.weight);
  seeds.push(sorted[0].lab);
  while (seeds.length < k) {
    let best = null, bestDist = -1;
    for (const p of points) {
      const minD = seeds.reduce((m, s) => Math.min(m, dist2(p.lab, s)), Infinity);
      const score = minD * Math.log1p(p.weight); // bias toward heavy + far
      if (score > bestDist) { bestDist = score; best = p; }
    }
    if (!best) break;
    seeds.push(best.lab);
  }
  return seeds;
}

function kmeans(points, k, { maxIter = 60 } = {}) {
  if (points.length === 0) return [];
  if (points.length <= k) return points.map((p) => [p]);

  let centres = pickFurthestSeeds(points, k);
  let clusters = Array.from({ length: k }, () => []);

  for (let iter = 0; iter < maxIter; iter++) {
    clusters = Array.from({ length: k }, () => []);
    for (const p of points) {
      let bestI = 0, bestD = Infinity;
      for (let i = 0; i < centres.length; i++) {
        const d = dist2(p.lab, centres[i]);
        if (d < bestD) { bestD = d; bestI = i; }
      }
      clusters[bestI].push(p);
    }
    const newCentres = clusters.map((members, i) =>
      members.length > 0 ? weightedCentroid(members) : centres[i]
    );
    // converged?
    const moved = newCentres.reduce((sum, c, i) => sum + dist2(c, centres[i]), 0);
    centres = newCentres;
    if (moved < 0.5) break;
  }
  return clusters.filter((c) => c.length > 0);
}

/**
 * @param {Array<{ hex: string, count?: number }>} input
 * @param {number} k target palette size
 */
export function compressPalette(input, k = 12) {
  const points = [];
  for (const c of input || []) {
    const rgb = hexToRgb(c.hex);
    if (!rgb) continue;
    points.push({
      hex: c.hex,
      rgb,
      lab: rgbToLab(rgb),
      weight: Math.max(1, c.count || c.weight || 1),
      original: c,
    });
  }
  if (points.length === 0) return [];
  if (points.length <= k) return points.map((p) => ({ ...p.original, hex: p.hex, count: p.weight, clusterSize: 1 }));

  const clusters = kmeans(points, k);
  // For each cluster, return the medoid — the real colour in the
  // cluster closest to the centroid. Never invent a hex that wasn't
  // on the page.
  return clusters
    .map((members) => {
      const centre = weightedCentroid(members);
      let best = members[0], bestD = Infinity;
      for (const m of members) {
        const d = dist2(m.lab, centre);
        if (d < bestD) { bestD = d; best = m; }
      }
      const totalCount = members.reduce((s, m) => s + m.weight, 0);
      return {
        ...best.original,
        hex: best.hex,
        count: totalCount,
        clusterSize: members.length,
        clusterMembers: members.map((m) => m.hex),
      };
    })
    .sort((x, y) => (y.count || 0) - (x.count || 0));
}

```

### Core Architecture Module: `src/verify/render.js`
```
// Render a re-styled component clone on a clean canvas and return its PNG.
//
// The clone keeps its DOM structure and text but loses the site's stylesheet
// (we never load it). We pin the root to the captured box and apply ONLY the
// token-snapped inline styles, so the screenshot is "this component as the
// extracted token system would express it" — nothing more. Children inherit
// the token body font/colour; author classes resolve to nothing, by design.

import { styledToCss } from './restyle.js';

// browser: a launched Playwright Browser. comp: { outerHTML, box:{w,h}, dpr, styled }.
// tokens: used only for the page's inherited body font/colour defaults.
export async function renderComponent(browser, comp, tokens = {}) {
  const { outerHTML, box, dpr = 2, styled } = comp;
  const w = Math.max(1, Math.ceil(box?.w || 1));
  const h = Math.max(1, Math.ceil(box?.h || 1));
  const css = styledToCss(styled);

  const context = await browser.newContext({
    viewport: { width: w + 8, height: h + 8 },
    deviceScaleFactor: dpr,
    colorScheme: 'light',
  });
  try {
    const page = await context.newPage();
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: ${tokens.bodyBg || '#ffffff'}; }
body { font-family: ${tokens.bodyFamily || 'sans-serif'}; color: ${tokens.bodyColor || '#111'}; padding: 4px; }
#dl-host > * { width: ${w}px; height: ${h}px; box-sizing: border-box; overflow: hidden; display: flex; align-items: center; justify-content: center; ${css}; }
</style></head><body><div id="dl-host"></div></body></html>`;
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ outer, inline }) => {
      const host = document.getElementById('dl-host');
      host.innerHTML = outer;
      const root = host.firstElementChild;
      if (root) root.setAttribute('style', `${root.getAttribute('style') || ''};${inline}`);
    }, { outer: outerHTML, inline: css });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const root = page.locator('#dl-host > *').first();
    return await root.screenshot({ type: 'png' });
  } finally {
    await context.close();
  }
}

```

### Core Architecture Module: `website/public/gallery/render-com/android/Theme.kt`
```
// Generated by designlang v7.0.0
// Source: https://render.com
package com.designlang.tokens

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object DesignTokens {
    val ActionPrimary = Color(0xFF8A05FF)
    val ActionSecondary = Color(0xFFE7DBFF)
    val SurfaceDefault = Color(0xFFFFFFFF)
    val TextBody = Color(0xFF000000)
    val BrandPrimary = Color(0xFF8A05FF)
    val BrandSecondary = Color(0xFFE7DBFF)
    val NeutralN100 = Color(0xFFE3E3E3)
    val NeutralN200 = Color(0xFF0D0D0D)
    val NeutralN300 = Color(0xFFFFFFFF)
    val NeutralN400 = Color(0xFF000000)
    val NeutralN500 = Color(0xFF6B6B6B)
    val NeutralN600 = Color(0xFF4D4D4D)
    val NeutralN700 = Color(0xFFFCE9EA)
    val NeutralN800 = Color(0xFF272727)
    val NeutralN900 = Color(0xFF8F8F8F)
    val NeutralN1000 = Color(0xFFF4F0FF)
    val BackgroundBg0 = Color(0xFFFFFFFF)
    val BackgroundBg1 = Color(0xFF000000)
    val BackgroundBg2 = Color(0xFF141414)
    val TextText0 = Color(0xFF000000)
    val TextText1 = Color(0xFFFFFFFF)
    val TextText2 = Color(0xFF0D0D0D)
    val TextText3 = Color(0xFF4D4D4D)
    val TextText4 = Color(0xFF6B6B6B)
    val TextText5 = Color(0xFF8A05FF)
    val TextText6 = Color(0xFF009E7A)
    val TextText7 = Color(0xFFD67F2E)
    val TextText8 = Color(0xFFF680FF)
    val TextText9 = Color(0xFF0088E5)
    val SpacingS0 = 1.dp
    val SpacingS1 = 48.dp
    val SpacingS2 = 56.dp
    val SpacingS3 = 72.dp
    val SpacingS4 = 80.dp
    val SpacingS5 = 86.dp
    val SpacingS6 = 120.dp
    val SpacingS7 = 160.dp
    val SpacingS8 = 166.dp
    val SpacingS9 = 201.dp
    val SpacingS10 = 213.dp
    val SpacingS11 = 270.dp
    val SpacingS12 = 287.dp
    val SpacingS13 = 295.dp
    val SpacingS14 = 305.dp
    val SpacingS15 = 312.dp
    val SpacingS16 = 323.dp
    val SpacingS17 = 460.dp
    val SpacingS18 = 467.dp
    val SpacingS19 = 481.dp
    val RadiusR0 = 2.dp
    val RadiusR1 = 50.dp
    val RadiusR2 = 937.dp
}

```

### Core Architecture Module: `website/public/gallery/render-com/ios/DesignTokens.swift`
```
// Generated by designlang v7.0.0 — https://github.com/Manavarya09/design-extract
// Source: https://render.com
import SwiftUI

extension Color {
  init(hex: UInt32) {
    let r = Double((hex >> 16) & 0xFF) / 255
    let g = Double((hex >> 8) & 0xFF) / 255
    let b = Double(hex & 0xFF) / 255
    self.init(red: r, green: g, blue: b)
  }

  // MARK: Semantic
  static let actionPrimary = Color(hex: 0x8A05FF)
  static let actionSecondary = Color(hex: 0xE7DBFF)
  static let surfaceDefault = Color(hex: 0xFFFFFF)
  static let textBody = Color(hex: 0x000000)
}

extension CGFloat {
  // MARK: Primitive spacing
  static let spacingS0: CGFloat = 1
  static let spacingS1: CGFloat = 48
  static let spacingS2: CGFloat = 56
  static let spacingS3: CGFloat = 72
  static let spacingS4: CGFloat = 80
  static let spacingS5: CGFloat = 86
  static let spacingS6: CGFloat = 120
  static let spacingS7: CGFloat = 160
  static let spacingS8: CGFloat = 166
  static let spacingS9: CGFloat = 201
  static let spacingS10: CGFloat = 213
  static let spacingS11: CGFloat = 270
  static let spacingS12: CGFloat = 287
  static let spacingS13: CGFloat = 295
  static let spacingS14: CGFloat = 305
  static let spacingS15: CGFloat = 312
  static let spacingS16: CGFloat = 323
  static let spacingS17: CGFloat = 460
  static let spacingS18: CGFloat = 467
  static let spacingS19: CGFloat = 481

  // MARK: Primitive radius
  static let radiusR0: CGFloat = 2
  static let radiusR1: CGFloat = 50
  static let radiusR2: CGFloat = 937
}

// MARK: Primitive palette (for direct use)
extension Color {
  static let brandPrimary = Color(hex: 0x8A05FF)
  static let brandSecondary = Color(hex: 0xE7DBFF)
  static let neutralN100 = Color(hex: 0xE3E3E3)
  static let neutralN200 = Color(hex: 0x0D0D0D)
  static let neutralN300 = Color(hex: 0xFFFFFF)
  static let neutralN400 = Color(hex: 0x000000)
  static let neutralN500 = Color(hex: 0x6B6B6B)
  static let neutralN600 = Color(hex: 0x4D4D4D)
  static let neutralN700 = Color(hex: 0xFCE9EA)
  static let neutralN800 = Color(hex: 0x272727)
  static let neutralN900 = Color(hex: 0x8F8F8F)
  static let neutralN1000 = Color(hex: 0xF4F0FF)
  static let backgroundBg0 = Color(hex: 0xFFFFFF)
  static let backgroundBg1 = Color(hex: 0x000000)
  static let backgroundBg2 = Color(hex: 0x141414)
  static let textText0 = Color(hex: 0x000000)
  static let textText1 = Color(hex: 0xFFFFFF)
  static let textText2 = Color(hex: 0x0D0D0D)
  static let textText3 = Color(hex: 0x4D4D4D)
  static let textText4 = Color(hex: 0x6B6B6B)
  static let textText5 = Color(hex: 0x8A05FF)
  static let textText6 = Color(hex: 0x009E7A)
  static let textText7 = Color(hex: 0xD67F2E)
  static let textText8 = Color(hex: 0xF680FF)
  static let textText9 = Color(hex: 0x0088E5)
}

// typography.body: family=PPNeueMontreal size=80px weight=300 lineHeight=80px

```

### Core Architecture Module: `website/public/gallery/render-com/render-com-motion.framer.js`
```
// Framer Motion presets — generated by designlang (motionlang)
// Source: https://render.com
// 2026-06-25T08:30:10.009Z
//
//   import { transitions, variants } from './render.com-motion.framer';
//   <motion.div variants={variants.slideUp} initial="hidden" animate="show"
//               transition={transitions.base} />

/** Easing curves extracted from the live page, as Framer cubic-bezier arrays. */
export const easings = {
  custom1: [0.4, 0, 0.2, 1], // 173× on page
  custom2: [0.8, 0.01, 0.11, 0.98], // 43× on page
  easeInOut: [0.25, 0.1, 0.25, 1], // 1× on page
  linear: [0, 0, 1, 1], // 1× on page
};

/** Duration presets (seconds), extracted from the live page. */
export const durations = {
  xs: 0.1,
  sm: 0.2,
  md: 0.3,
  lg: 0.5,
};

/** Spring presets — pass to a Framer Motion `transition` prop. */
export const springs = {
  soft: { type: 'spring', stiffness: 320, damping: 30, mass: 1 },
};

/** Ready-to-spread Framer Motion transition objects. */
export const transitions = {
  base:  { duration: 0.3, ease: easings.custom1 },
  fast:  { duration: 0.150, ease: easings.custom1 },
  slow:  { duration: 0.540, ease: easings.custom1 },
  spring: springs.soft,
};

/** Common variants wired to the extracted timing. */
export const variants = {
  fade: {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: transitions.base },
  },
  slideUp: {
    hidden: { opacity: 0, y: 16 },
    show:   { opacity: 1, y: 0, transition: transitions.base },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.96 },
    show:   { opacity: 1, scale: 1, transition: transitions.base },
  },
  pop: {
    hidden: { opacity: 0, scale: 0.9 },
    show:   { opacity: 1, scale: 1, transition: springs.soft },
  },
  stagger: {
    hidden: {},
    show:   { transition: { staggerChildren: 0.075 } },
  },
  scroll: {
    hidden: {},
    show: {
      "transform": ["translateX(0%)","translateX(-100%)"],
      transition: transitions.base,
    },
  },
};

/** Site uses scroll- or view-timeline. Drop-in `whileInView` props. */
export const inView = {
  fadeIn: {
    initial: variants.fade.hidden,
    whileInView: variants.fade.show,
    viewport: { once: true, amount: 0.3 },
  },
  riseIn: {
    initial: variants.slideUp.hidden,
    whileInView: variants.slideUp.show,
    viewport: { once: true, amount: 0.3 },
  },
};

export default { easings, durations, springs, transitions, variants, inView };

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #44** (2026-04-24): **[Bug]: Tailwind.config.js outputs NaN values**
  *Symptoms*: ### URL extracted  https://designlang.manavaryasingh.com/  ### Command used  npx designlang npx https://designlang.manavaryasingh.com/  --full  ### What you expected  The tailwind config file contains NaN values: /** @type {import('tailwindcss').Config} */ export default {   theme: {     extend: {     colors: {         primary: {             '50': 'hsl(NaN, NaN%, 97%)',             '100': 'hsl(NaN, NaN%, 94%)',             '200': 'hsl(NaN, NaN%, 86%)',             '300': 'hsl(NaN, NaN%, 76%)',             '400': 'hsl(NaN, NaN%, 64%)',             '500': 'hsl(NaN, NaN%, 50%)',             '600': 'hsl(NaN, NaN%, 40%)',             '700': 'hsl(NaN, NaN%, 32%)',             '800': 'hsl(NaN, NaN%, 24%)',             '900': 'hsl(NaN, NaN%, 16%)',             '950': 'hsl(NaN, NaN%, 10%)',             DEFAULT: '#ff4800'         },         secondary: {             '50': 'hsl(NaN, NaN%, 97%)',             '100': 'hsl(NaN, NaN%, 94%)',             '200': 'hsl(NaN, NaN%, 86%)',             '300': 'hsl(NaN, NaN%, 76%)',             '400': 'hsl(NaN, NaN%, 64%)',             '500': 'hsl(NaN, NaN%, 50%)',             '600': 'hsl(NaN, NaN%, 40%)',             '700': 'hsl(NaN, NaN%, 32%)',             '800': 'hsl(NaN, NaN%, 24%)',             '900': 'hsl(NaN, NaN%, 16%)',             '950': 'hsl(NaN, NaN%, 10%)',             DEFAULT: '#635bff'         },         accent: {             '50': 'hsl(NaN, NaN%, 97%)',             '100': 'hsl(NaN, NaN%, 94%)',             '200': 'hsl(NaN, NaN%, 86%)'

- **Issue #43** (2026-04-24): **[Bug]: TypeError in prompt-pack formatter crashes extraction — (s.value || s).replace is not a function**
  *Symptoms*: ### URL extracted  https://dieffenbacher.com/de/energy  ### Command used  npx designlang https://dieffenbacher.com/de/energy --platforms web --out ./dieffenbacher-energy --verbose  ### What you expected  A successful extraction that writes all output files (tokens, report, motion, voice, anatomy, prompt pack) to the output directory, as documented in the v10 README.  I also expected the prompt pack generation to be optional or to fail gracefully without aborting the entire extraction, since the crawl and style harvest phases had already completed successfully (screenshots/ and logo.svg were written before the crash).  ### What actually happened  Extraction crashes during the prompt pack build phase with a TypeError. The crawl and extraction phases appear to complete (screenshots and logo are written), but the run aborts before tokens, report, or any other structured output is emitted.  ### Stack trace  ``` ✖ Extraction failed    (s.value || s).replace is not a function  TypeError: (s.value || s).replace is not a function     at file:///Users/sbr/.npm-global/lib/node_modules/designlang/src/formatters/prompt-pack.js:142:91     at Array.map (<anonymous>)     at formatCursorPrompt (file:///Users/sbr/.npm-global/lib/node_modules/designlang/src/formatters/prompt-pack.js:142:63)     at buildPromptPack (file:///Users/sbr/.npm-global/lib/node_modules/designlang/src/formatters/prompt-pack.js:210:18)     at Command.<anonymous> (file:///Users/sbr/.npm-global/lib/node_modules/designlang/b

- **Issue #41** (2026-04-24): **[Bug]:**
  *Symptoms*: ### URL extracted  https://stripe.com  ### Command used  npx designlang https://stripe.com --full  ### What you expected  I did not get any report back  ### What actually happened  Extraction failed   (s.value || s).replace is not a function  ### designlang version  Latest  ### Node.js version  v23.5.0  ### OS  macOS 26.4.1 (25E253)  ### Anything else  I was just trying your tool and I got the error.
  **Post-Mortem & Fix Analysis**:
  > Same for me

- **Issue #12** (2026-04-24): **bug: shadow DOM components not extracted**
  *Symptoms*: Elements inside closed shadow roots are invisible to `document.querySelectorAll('*')`. Open shadow roots could be partially traversed with `element.shadowRoot` but this isn't implemented yet.  Affects: Web Components, some React component libraries, Salesforce Lightning.
  **Post-Mortem & Fix Analysis**:
  > Open shadow roots are already traversed — [crawler.js:417-425](https://github.com/Manavarya09/design-extract/blob/main/src/crawler.js#L417):  ```js function collectElements(root, collected) {   for (const el of root.querySelectorAll('*')) {     if (collected.length >= maxElements) break;     collected.push(el);     if (el.shadowRoot) {       collectElements(el.shadowRoot, collected);     }   }   return collected; } ```  Closed shadow roots (`mode: 'closed'`) are by spec opaque to any page-context script — no extractor can read them without browser-level patches. That's not a designlang limitation; it's the web platform.  Closing.

- **Issue #11** (2026-04-24): **bug: cross-origin stylesheets miss media queries and keyframes**
  *Symptoms*: When CSS is loaded from CDNs (e.g. Google Fonts, Cloudflare), `document.styleSheets` throws SecurityError. This means media queries and `@keyframes` from those stylesheets are not captured.  Computed styles are still extracted correctly, but raw rule-level data is lost.  Potential fix: intercept network responses for CSS files and parse them server-side before injection.
  **Post-Mortem & Fix Analysis**:
  > Already implemented — `src/crawler.js` handles cross-origin stylesheets by fetching them via `page.evaluate(fetch)` and parsing server-side:  - [crawler.js:600-608](https://github.com/Manavarya09/design-extract/blob/main/src/crawler.js#L600) — tracks cross-origin sheets in `results.crossOriginSheets` when `cssRules` access throws - [crawler.js:904-920](https://github.com/Manavarya09/design-extract/blob/main/src/crawler.js#L904) — fetches each blocked URL and feeds the text to `parseCrossOriginCSS` - [crawler.js:923-980](https://github.com/Manavarya09/design-extract/blob/main/src/crawler.js#L923) — regex-parses `@media`, `@container`, `@keyframes`, `@font-face`, `:root` custom properties, `env()`, and modern color syntax (oklch/oklab/color-mix/light-dark/display-p3/rec2020)  The only case that stays lost is stylesheets the host blocks via CORS for fetch too — fundamentally not recoverable from a browser context.  Closing.

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

### Incident Patch 1: `49f13871` (2026-09-23)
**Commit Message**: Merge pull request #193 from Manavarya09/fix/theatre-coverage-deadlock

fix: live demo hang (screencast deadlocks CSS coverage) — v13.3.2

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
       "name": "designlang",
       "source": "./",
       "description": "Thirteen slash commands wrapping the designlang CLI: /extract (full design language → DTCG, Tailwind, Figma), /site (crawl a whole site → one canonical design system + consistency grade), /grade (shareable HTML report card + SVG badge), /battle (head-to-head graded comparison), /remix (restyle in 6 vocabularies — brutalist, swiss, art-deco, cyberpunk, soft-ui, editorial), /pack (one downloadable design-system bundle), /theme-swap (OKLCH-correct recolour around a new brand primary), /brand (full editorial brand-guidelines book — 13 chapters, hand-off-ready), /pair (fuse two designs across configurable axes — colours from one site, typography from another), /studio (live token-editor with component preview + export), /verify (rebuild from tokens and pixel-diff vs live for a fidelity score), /fidelity (score a clone vs the original — visual pixel-diff + motion fidelity — with a ranked correction plan), /gallery (build a shareable static gallery of measured clones).",
-      "version": "13.3.1",
+      "version": "13.3.2",
       "author": {
         "name": "Manavarya Singh"
       },
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "designlang",
   "description": "Extract any website's design language and ship it. Fourteen slash commands — /extract, /site, /grade, /battle, /remix, /pack, /theme-swap, /brand, /pair, /studio, /verify, /fidelity, /gallery, /dna — wrap the designlang CLI to pull DTCG tokens, Tailwind/shadcn/Figma vars, motion + voice, synthesize a whole-site canonical design system with a consistency grade, generate shareable graded report cards, head-to-head battle pages, six-vocabulary remixes, downloadable design-system bundles, OKLCH-correct theme recolouring, full editorial brand-guidelines books, design crossovers between two sites, a live token-editor studio, a rebuild-and-pixel-diff fidelity check, a measured clone-vs-original fidelity score (visual + motion) with a ranked correction plan via /fidelity, a shareable static gallery of scored clones via /gallery, and — via /dna — a measured design space that places any site among real design systems by nearest neighbours, per-axis percentiles, and the features that make it look the way it does.",
-  "version": "13.3.1",
+  "version": "13.3.2",
   "author": {
     "name": "Manavarya Singh",
     "url": "https://github.com/Manavarya09"
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -13,3 +13,4 @@ NOTES.md
 PLAN.md
 .planning/
 .engram/
+.env*.local
```

**File**: `.npmignore` (modified, +1/-0)
```diff
@@ -30,3 +30,4 @@ bench/
 .engram/
 .claude/
 docs/INTERVIEW_PREP.md
+.env*
```

**File**: `CHANGELOG.md` (modified, +13/-0)
```diff
@@ -1,5 +1,18 @@
 # Changelog
 
+## [13.3.2] — 2026-09-23
+
+**The live demo reads sites again.**
+
+- **Fixed: every live read on designlang.app hung on "walking the DOM"**
+  until the function was killed. In the single-process Chromium that runs
+  on serverless, a screencast still running when CSS coverage was read
+  deadlocked `stopCSSCoverage`. The screencast now stops once the page has
+  settled, before coverage is read. Only callers that pass
+  `onScreencastFrame` are affected; the CLI never ran a screencast.
+- **Website:** results are cached again, so repeat reads and the suggestion
+  chips are served without launching a browser.
+
 ## [13.3.1] — 2026-09-23
 
 **Faster extraction, and the live demo no longer hangs.**
```

**File**: `github-action/README.md` (modified, +2/-2)
```diff
@@ -21,13 +21,13 @@ jobs:
       - uses: actions/checkout@v4
       - uses: actions/setup-node@v4
         with: { node-version: '22' }
-      - uses: Manavarya09/design-extract/github-action@v13.3.1
+      - uses: Manavarya09/design-extract/github-action@v13.3.2
         with:
           url: https://preview-${{ github.event.number }}.yoursite.dev
           baseline: ./design-tokens.baseline.json
 ```
 
-Pin to a release tag. The action installs the designlang version it was tagged with, so a gate on `@v13.3.1` never changes behaviour under you.
+Pin to a release tag. The action installs the designlang version it was tagged with, so a gate on `@v13.3.2` never changes behaviour under you.
 
 ## Inputs
 
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "designlang",
-  "version": "13.3.1",
+  "version": "13.3.2",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "designlang",
-      "version": "13.3.1",
+      "version": "13.3.2",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.29.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "designlang",
-  "version": "13.3.1",
+  "version": "13.3.2",
   "description": "Extract the complete design language from any website and ship it — clone to a working Next.js starter, guard tokens with a CI drift bot, or browse everything in a local studio. Outputs W3C DTCG tokens, motion tokens, typed anatomy stubs, Tailwind config, and ready-to-paste v0 / Lovable / Cursor / Claude-Artifacts prompts.",
   "type": "module",
   "bin": {
```

---

### Incident Patch 2: `04adf825` (2026-09-23)
**Commit Message**: fix(crawler): stop the screencast before reading CSS coverage

The live demo on designlang.app hung on every read once it fell back to the
bundled @sparticuz Chromium: stuck on 'walking the DOM' until the function
was killed. In that single-process build a running screencast deadlocks
page.coverage.stopCSSCoverage. Reproduced in the Lambda Node 22 image: hangs
past 4 minutes with the screencast, 16s without it, 16s with this change.

The page has loaded and settled by then, so the part worth watching is over.

**File**: `src/crawler.js` (modified, +8/-8)
```diff
@@ -113,6 +113,14 @@ export async function crawlPage(url, options = {}) {
     if (wait > 0) await page.waitForTimeout(wait);
     await page.evaluate(() => document.fonts.ready).catch(() => {});
 
+    // The page has loaded and settled: the part worth watching is over. Stop the
+    // cast before reading CSS coverage — in single-process Chromium (the
+    // serverless build) a running screencast deadlocks stopCSSCoverage.
+    if (screencast) {
+      try { await screencast.stop(); } catch { /* already stopped */ }
+      screencast = null;
+    }
+
     // Capture CSS coverage after the page has settled.
     let cssCoverage = [];
     if (cssCoverageAvailable) {
@@ -148,14 +156,6 @@ export async function crawlPage(url, options = {}) {
     if (interactState) lightData.interactState = interactState;
     if (motionRuntimeObs) lightData.motionRuntime = motionRuntimeObs;
 
-    // The visually interesting window (load + auto-interact) is done — stop the
-    // cast before any multipage navigation or dark-mode context swap, which
-    // would just stream confusing reloads.
-    if (screencast) {
-      try { await screencast.stop(); } catch { /* already stopped */ }
-      screencast = null;
-    }
-
     // Component screenshots
     let componentScreenshots = {};
     if (screenshots && outDir) {
```

---

### Incident Patch 3: `a1b406d3` (2026-09-23)
**Commit Message**: Merge pull request #192 from Manavarya09/fix/extraction-speed

fix: 30s networkidle stall, stuck /watch demo — v13.3.1

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
       "name": "designlang",
       "source": "./",
       "description": "Thirteen slash commands wrapping the designlang CLI: /extract (full design language → DTCG, Tailwind, Figma), /site (crawl a whole site → one canonical design system + consistency grade), /grade (shareable HTML report card + SVG badge), /battle (head-to-head graded comparison), /remix (restyle in 6 vocabularies — brutalist, swiss, art-deco, cyberpunk, soft-ui, editorial), /pack (one downloadable design-system bundle), /theme-swap (OKLCH-correct recolour around a new brand primary), /brand (full editorial brand-guidelines book — 13 chapters, hand-off-ready), /pair (fuse two designs across configurable axes — colours from one site, typography from another), /studio (live token-editor with component preview + export), /verify (rebuild from tokens and pixel-diff vs live for a fidelity score), /fidelity (score a clone vs the original — visual pixel-diff + motion fidelity — with a ranked correction plan), /gallery (build a shareable static gallery of measured clones).",
-      "version": "13.3.0",
+      "version": "13.3.1",
       "author": {
         "name": "Manavarya Singh"
       },
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "designlang",
   "description": "Extract any website's design language and ship it. Fourteen slash commands — /extract, /site, /grade, /battle, /remix, /pack, /theme-swap, /brand, /pair, /studio, /verify, /fidelity, /gallery, /dna — wrap the designlang CLI to pull DTCG tokens, Tailwind/shadcn/Figma vars, motion + voice, synthesize a whole-site canonical design system with a consistency grade, generate shareable graded report cards, head-to-head battle pages, six-vocabulary remixes, downloadable design-system bundles, OKLCH-correct theme recolouring, full editorial brand-guidelines books, design crossovers between two sites, a live token-editor studio, a rebuild-and-pixel-diff fidelity check, a measured clone-vs-original fidelity score (visual + motion) with a ranked correction plan via /fidelity, a shareable static gallery of scored clones via /gallery, and — via /dna — a measured design space that places any site among real design systems by nearest neighbours, per-axis percentiles, and the features that make it look the way it does.",
-  "version": "13.3.0",
+  "version": "13.3.1",
   "author": {
     "name": "Manavarya Singh",
     "url": "https://github.com/Manavarya09"
```

**File**: `CHANGELOG.md` (modified, +14/-0)
```diff
@@ -1,5 +1,19 @@
 # Changelog
 
+## [13.3.1] — 2026-09-23
+
+**Faster extraction, and the live demo no longer hangs.**
+
+- **Up to 30s faster on busy pages.** The wait for the network to go quiet
+  had no cap, so Playwright's 30s default applied, and pages with analytics
+  beacons or polling never go quiet. duolingo.com and paypal.com spent 30s of
+  every run there. It is now capped at 5s. On the benchmark sites that were
+  slow or failing, the median run went from 18.7s to 10.1s with no failed
+  runs, and calendly.com and pinterest.com finish instead of timing out.
+- **Website:** a live read on `/watch` gets 300s instead of 60s, and one
+  that dies mid-stream shows an error instead of "reading…" forever.
+- **Releases** publish through npm trusted publishing (OIDC). No token.
+
 ## [13.3.0] — 2026-09-15
 
 **Ship it where people run it: releases, installs, agents and CI.**
```

**File**: `github-action/README.md` (modified, +2/-2)
```diff
@@ -21,13 +21,13 @@ jobs:
       - uses: actions/checkout@v4
       - uses: actions/setup-node@v4
         with: { node-version: '22' }
-      - uses: Manavarya09/design-extract/github-action@v13.3.0
+      - uses: Manavarya09/design-extract/github-action@v13.3.1
         with:
           url: https://preview-${{ github.event.number }}.yoursite.dev
           baseline: ./design-tokens.baseline.json
 ```
 
-Pin to a release tag. The action installs the designlang version it was tagged with, so a gate on `@v13.3.0` never changes behaviour under you.
+Pin to a release tag. The action installs the designlang version it was tagged with, so a gate on `@v13.3.1` never changes behaviour under you.
 
 ## Inputs
 
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "designlang",
-  "version": "13.3.0",
+  "version": "13.3.1",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "designlang",
-      "version": "13.3.0",
+      "version": "13.3.1",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.29.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "designlang",
-  "version": "13.3.0",
+  "version": "13.3.1",
   "description": "Extract the complete design language from any website and ship it — clone to a working Next.js starter, guard tokens with a CI drift bot, or browse everything in a local studio. Outputs W3C DTCG tokens, motion tokens, typed anatomy stubs, Tailwind config, and ready-to-paste v0 / Lovable / Cursor / Claude-Artifacts prompts.",
   "type": "module",
   "bin": {
```

**File**: `src/crawler.js` (modified, +7/-3)
```diff
@@ -19,6 +19,10 @@ async function gotoWithRetry(page, url, opts, retries = 3) {
   }
 }
 
+// Cap on waiting for the network to go quiet. Pages with analytics beacons, polling
+// or video never reach networkidle, and Playwright's default wait is 30s.
+const NETWORK_IDLE_MS = 5000;
+
 export async function crawlPage(url, options = {}) {
   const {
     width = 1280, height = 800, wait = 0, dark = false, depth = 0,
@@ -105,7 +109,7 @@ export async function crawlPage(url, options = {}) {
 
     await gotoWithRetry(page, url, { waitUntil: 'domcontentloaded', timeout: 30000 });
     // Wait for network to settle — but don't hang on sites with persistent connections
-    await page.waitForLoadState('networkidle').catch(() => {});
+    await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch(() => {});
     if (wait > 0) await page.waitForTimeout(wait);
     await page.evaluate(() => document.fonts.ready).catch(() => {});
 
@@ -183,7 +187,7 @@ export async function crawlPage(url, options = {}) {
       for (const link of internalLinks) {
         try {
           await gotoWithRetry(page, link, { waitUntil: 'domcontentloaded', timeout: 20000 });
-          await page.waitForLoadState('networkidle').catch(() => {});
+          await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch(() => {});
           await page.evaluate(() => document.fonts.ready).catch(() => {});
           const pageData = await extractPageData(page);
           additionalPages.push({ url: link, data: pageData });
@@ -209,7 +213,7 @@ export async function crawlPage(url, options = {}) {
       });
       const darkPage = await darkContext.newPage();
       await gotoWithRetry(darkPage, url, { waitUntil: 'domcontentloaded', timeout: 30000 });
-      await darkPage.waitForLoadState('networkidle').catch(() => {});
+      await darkPage.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch(() => {});
       await darkPage.evaluate(() => document.fonts.ready).catch(() => {});
       darkData = await extractPageData(darkPage);
       darkData.mediaColors = mediaColors;
```

**File**: `tests/crawler-settle.test.js` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+// A page whose network never goes idle (analytics beacons, polling, video)
+// must not cost Playwright's full 30s default wait for `networkidle`.
+// duolingo.com and paypal.com both hit that 30s ceiling on every run.
+
+import { describe, it, before, after } from 'node:test';
+import assert from 'node:assert/strict';
+import { createServer } from 'node:http';
+
+import { crawlPage } from '../src/crawler.js';
+
+const BUSY_PAGE = `<!doctype html><html><head><title>busy</title>
+<style>body{font-family:Georgia,serif;color:#123456;background:#fff}</style></head>
+<body><h1>Always polling</h1>
+<script>setInterval(() => fetch('/poll?' + Date.now()).catch(() => {}), 200);</script>
+</body></html>`;
+
+describe('crawlPage — busy network', () => {
+  let server;
+  let url;
+
+  before(async () => {
+    server = createServer((req, res) => {
+      if (req.url.startsWith('/poll')) {
+        res.writeHead(200, { 'content-type': 'text/plain' });
+        res.end('ok');
+        return;
+      }
+      res.writeHead(200, { 'content-type': 'text/html' });
+      res.end(BUSY_PAGE);
+    });
+    await new Promise((r) => server.listen(0, '127.0.0.1', r));
+    url = `http://127.0.0.1:${server.address().port}/`;
+  });
+
+  after(() => new Promise((r) => server.close(r)));
+
+  it('stops waiting for networkidle well before 30s', { timeout: 60000 }, async () => {
+    const started = Date.now();
+    const data = await crawlPage(url);
+    const seconds = (Date.now() - started) / 1000;
+    assert.ok(data.light.computedStyles.length > 0, 'page was still extracted');
+    assert.ok(seconds < 20, `crawl took ${seconds.toFixed(1)}s`);
+  });
+});
```

---

### Incident Patch 4: `3a22d235` (2026-09-23)
**Commit Message**: fix(website): give live extraction 300s instead of 60s

Production logs: 'Task timed out after 60 seconds' on a live read with the
screencast running on the fallback Chromium.

**File**: `website/app/api/extract/route.js` (modified, +3/-1)
```diff
@@ -18,7 +18,9 @@ import { recordReel, loadReel, buildReplayTimeline } from '../../../../website/l
 
 export const runtime = 'nodejs';
 export const dynamic = 'force-dynamic';
-export const maxDuration = 60;
+// A live read with the screencast on a cold Chromium ran past 60s and was killed
+// mid-stream. 300s is the Fluid Compute default.
+export const maxDuration = 300;
 
 const STAGES = [
   'crawl',
```

---

### Incident Patch 5: `bae38dc6` (2026-09-23)
**Commit Message**: fix(website): a live read that dies mid-stream shows an error, not an endless spinner

When the extract function was killed at its time limit the response just
closed, with no files and no error event, and /watch sat on "reading..."
forever.

**File**: `website/app/components/theatre/Theatre.js` (modified, +1/-0)
```diff
@@ -123,6 +123,7 @@ export default function Theatre({
       if (buffer.trim()) {
         try { dispatch(JSON.parse(buffer.trim())); } catch {}
       }
+      dispatch({ type: 'end' });
     } catch {
       dispatch({ type: 'error', error: 'Stream interrupted. Try another URL.' });
     } finally {
```

**File**: `website/lib/theatre-reducer.js` (modified, +7/-0)
```diff
@@ -74,6 +74,13 @@ export function theatreReducer(state, action) {
     case 'error':
       return { ...state, error: action.error || 'Extraction failed', status: 'error' };
 
+    case 'end':
+      // The response closed. Still streaming means it closed without files or
+      // an error — the function was killed at its time limit.
+      return state.status === 'streaming'
+        ? { ...state, error: 'That site took too long to read. Try again, or run npx designlang locally.', status: 'error' }
+        : state;
+
     default:
       return state;
   }
```

**File**: `website/lib/theatre-reducer.test.js` (modified, +25/-0)
```diff
@@ -86,3 +86,28 @@ test('cache + permalink fold', () => {
   assert.equal(s.cached, true);
   assert.equal(s.hash, 'deadbeef');
 });
+
+test('a stream that ends mid-extraction is an error, not an endless spinner', () => {
+  // The function was killed at its time limit: frames and a stage arrived,
+  // then the response simply closed with no files and no error event.
+  const s = reduceEvents([
+    { type: 'start' },
+    { type: 'stage', name: 'crawl' },
+    { type: 'frame', seq: 0, data: 'a' },
+    { type: 'end' },
+  ]);
+  assert.equal(s.status, 'error');
+  assert.match(s.error, /took too long/);
+});
+
+test('end after files or an error changes nothing', () => {
+  const done = reduceEvents([{ type: 'start' }, { type: 'files', files: {} }, { type: 'end' }]);
+  assert.equal(done.status, 'done');
+  const failed = reduceEvents([{ type: 'start' }, { type: 'error', error: 'boom' }, { type: 'end' }]);
+  assert.equal(failed.error, 'boom');
+});
+
+test('end after an idle autoplay stays idle', () => {
+  const s = reduceEvents([{ type: 'start' }, { type: 'idle' }, { type: 'end' }]);
+  assert.equal(s.status, 'idle');
+});
```

---

### Incident Patch 6: `4969de2d` (2026-09-23)
**Commit Message**: fix(crawler): stop waiting 30s for a network that never goes quiet

networkidle had no timeout, so Playwright's 30s default applied. Pages with
analytics beacons or polling never idle: duolingo.com and paypal.com spent
30s of every run here, and timed out in the benchmark. Cap it at 5s.

**File**: `src/crawler.js` (modified, +7/-3)
```diff
@@ -19,6 +19,10 @@ async function gotoWithRetry(page, url, opts, retries = 3) {
   }
 }
 
+// Cap on waiting for the network to go quiet. Pages with analytics beacons, polling
+// or video never reach networkidle, and Playwright's default wait is 30s.
+const NETWORK_IDLE_MS = 5000;
+
 export async function crawlPage(url, options = {}) {
   const {
     width = 1280, height = 800, wait = 0, dark = false, depth = 0,
@@ -105,7 +109,7 @@ export async function crawlPage(url, options = {}) {
 
     await gotoWithRetry(page, url, { waitUntil: 'domcontentloaded', timeout: 30000 });
     // Wait for network to settle — but don't hang on sites with persistent connections
-    await page.waitForLoadState('networkidle').catch(() => {});
+    await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch(() => {});
     if (wait > 0) await page.waitForTimeout(wait);
     await page.evaluate(() => document.fonts.ready).catch(() => {});
 
@@ -183,7 +187,7 @@ export async function crawlPage(url, options = {}) {
       for (const link of internalLinks) {
         try {
           await gotoWithRetry(page, link, { waitUntil: 'domcontentloaded', timeout: 20000 });
-          await page.waitForLoadState('networkidle').catch(() => {});
+          await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch(() => {});
           await page.evaluate(() => document.fonts.ready).catch(() => {});
           const pageData = await extractPageData(page);
           additionalPages.push({ url: link, data: pageData });
@@ -209,7 +213,7 @@ export async function crawlPage(url, options = {}) {
       });
       const darkPage = await darkContext.newPage();
       await gotoWithRetry(darkPage, url, { waitUntil: 'domcontentloaded', timeout: 30000 });
-      await darkPage.waitForLoadState('networkidle').catch(() => {});
+      await darkPage.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch(() => {});
       await darkPage.evaluate(() => document.fonts.ready).catch(() => {});
       darkData = await extractPageData(darkPage);
       darkData.mediaColors = mediaColors;
```

**File**: `tests/crawler-settle.test.js` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+// A page whose network never goes idle (analytics beacons, polling, video)
+// must not cost Playwright's full 30s default wait for `networkidle`.
+// duolingo.com and paypal.com both hit that 30s ceiling on every run.
+
+import { describe, it, before, after } from 'node:test';
+import assert from 'node:assert/strict';
+import { createServer } from 'node:http';
+
+import { crawlPage } from '../src/crawler.js';
+
+const BUSY_PAGE = `<!doctype html><html><head><title>busy</title>
+<style>body{font-family:Georgia,serif;color:#123456;background:#fff}</style></head>
+<body><h1>Always polling</h1>
+<script>setInterval(() => fetch('/poll?' + Date.now()).catch(() => {}), 200);</script>
+</body></html>`;
+
+describe('crawlPage — busy network', () => {
+  let server;
+  let url;
+
+  before(async () => {
+    server = createServer((req, res) => {
+      if (req.url.startsWith('/poll')) {
+        res.writeHead(200, { 'content-type': 'text/plain' });
+        res.end('ok');
+        return;
+      }
+      res.writeHead(200, { 'content-type': 'text/html' });
+      res.end(BUSY_PAGE);
+    });
+    await new Promise((r) => server.listen(0, '127.0.0.1', r));
+    url = `http://127.0.0.1:${server.address().port}/`;
+  });
+
+  after(() => new Promise((r) => server.close(r)));
+
+  it('stops waiting for networkidle well before 30s', { timeout: 60000 }, async () => {
+    const started = Date.now();
+    const data = await crawlPage(url);
+    const seconds = (Date.now() - started) / 1000;
+    assert.ok(data.light.computedStyles.length > 0, 'page was still extracted');
+    assert.ok(seconds < 20, `crawl took ${seconds.toFixed(1)}s`);
+  });
+});
```

---

### Incident Patch 7: `08113882` (2026-09-16)
**Commit Message**: ci(bench): run the benchmark on a clean runner; fix the report footer and median

- .github/workflows/bench.yml: manual (choose a set) plus weekly, installs the
  browser, runs held-out and training sets, writes both tables to the run
  summary and uploads bench/results as an artifact. Nothing is auto-committed.
- the report names the set it ran (a held-out run said bench/sites.json) and
  says when it is the held-out set
- median time rounds to one decimal (it printed 30.349999999999998s)

**File**: `.github/workflows/bench.yml` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+name: bench
+
+# Head-to-head extraction benchmark against a pinned dembrandt, on a clean
+# runner so the published numbers are reproducible. Results are uploaded as an
+# artifact; nothing is committed automatically.
+#
+# bench/sites.json is the training set the extraction fixes were tuned on.
+# bench/holdout.json was never used to tune anything: quote it for claims.
+
+on:
+  workflow_dispatch:
+    inputs:
+      set:
+        description: Which site set to run
+        type: choice
+        default: both
+        options: [both, sites, holdout]
+  schedule:
+    # Weekly, so drift in either tool shows up without anyone remembering to look.
+    - cron: '17 4 * * 1'
+
+permissions:
+  contents: read
+
+jobs:
+  bench:
+    runs-on: ubuntu-latest
+    timeout-minutes: 90
+    steps:
+      - uses: actions/checkout@v7
+
+      - uses: actions/setup-node@v6
+        with:
+          node-version: 22
+          cache: npm
+
+      - name: Install dependencies
+        run: npm ci
+
+      - name: Install browser
+        run: node bin/design-extract.js install-browser --with-deps
+
+      - name: Run held-out set
+        if: ${{ github.event.inputs.set != 'sites' }}
+        run: node bench/run.mjs --sites bench/holdout.json
+
+      - name: Run training set
+        if: ${{ github.event.inputs.set != 'holdout' }}
+        run: node bench/run.mjs
+
+      - name: Summary
+        if: always()
+        run: |
+          for f in bench/results/*.md; do
+            [ -e "$f" ] || continue
+            cat "$f" >> "$GITHUB_STEP_SUMMARY"
+            echo >> "$GITHUB_STEP_SUMMARY"
+          done
+
+      - uses: actions/upload-artifact@v4
+        if: always()
+        with:
+          name: bench-results
+          path: bench/results/
```

**File**: `bench/run.mjs` (modified, +3/-3)
```diff
@@ -94,6 +94,7 @@ const TOOLS = {
 };
 
 const sitesFile = resolve(arg('sites', join(root, 'bench/sites.json')));
+const set = basename(sitesFile, '.json');
 const only = arg('only')?.split(',');
 const truths = JSON.parse(readFileSync(sitesFile, 'utf-8')).sites.filter((s) => !only || only.includes(s.site));
 
@@ -158,19 +159,18 @@ const md = [
   `| Primary colour correct | ${ratio(summary.designlang.colorHits, summary.designlang.colorSites)} | ${ratio(summary.dembrandt.colorHits, summary.dembrandt.colorSites)} |`,
   `| Body font correct | ${ratio(summary.designlang.fontHits, summary.designlang.fontSites)} | ${ratio(summary.dembrandt.fontHits, summary.dembrandt.fontSites)} |`,
   `| Failed runs | ${summary.designlang.failures} | ${summary.dembrandt.failures} |`,
-  `| Median time | ${summary.designlang.medianSeconds ?? '—'}s | ${summary.dembrandt.medianSeconds ?? '—'}s |`,
+  `| Median time | ${summary.designlang.medianSeconds?.toFixed(1) ?? '—'}s | ${summary.dembrandt.medianSeconds?.toFixed(1) ?? '—'}s |`,
   '',
   '| Site | Truth | designlang colour | dembrandt colour | designlang font | dembrandt font |',
   '|---|---|---|---|---|---|',
   ...report.sites.map((s) => `| ${s.site} | ${truthText(s)} |${cell(s.designlang, 'color')} | ${cell(s.dembrandt, 'color')} | ${cell(s.designlang, 'font')} | ${cell(s.dembrandt, 'font')} |`),
   '',
-  'Reproduce: `node bench/run.mjs`. Ground truth and sources: `bench/sites.json`.',
+  `Reproduce: \`node bench/run.mjs${set === 'sites' ? '' : ` --sites bench/${set}.json`}\`. Ground truth and sources: \`bench/${set}.json\`${set === 'holdout' ? ' (held out: no extraction change was tuned on these sites)' : ''}.`,
   '',
 ].join('\n');
 
 // bench/sites.json writes <date>.*; any other set (e.g. holdout.json) writes
 // <date>-<set>.* so one run never overwrites another.
-const set = basename(sitesFile, '.json');
 const name = set === 'sites' ? date : `${date}-${set}`;
 const outDir = join(root, 'bench/results');
 mkdirSync(outDir, { recursive: true });
```

---

### Incident Patch 8: `2d0e2d41` (2026-09-15)
**Commit Message**: fix(bench): make the per-run timeout actually end a run

Runs were recorded as timed out while still going: 363s for a 180s cap on
designlang, 3029s once for dembrandt through npx. Killing the direct child left
grandchildren (npx's node, Playwright's Chromium in its own process group)
alive and holding stdout open, and the runner waited for the pipes to close.

- each tool runs detached with its own TMPDIR, where the browser profile lands;
  on timeout the process group is killed, plus anything whose command line
  names that directory, and the result is recorded without waiting for pipes
- a timeout is recorded as a timeout, timed at the kill rather than after cleanup
- a run that fails with a network-level error (ERR_INTERNET_DISCONNECTED and
  similar) is retried once for either tool; the report counts retries
- BENCH_TIMEOUT_MS overrides the 180s cap

Verified with a 15s cap on airbnb.com: both runs end at 15s and no browser
processes remain.

**File**: `bench/run.mjs` (modified, +44/-9)
```diff
@@ -8,15 +8,15 @@
 // same machine, alternating which goes first per site. Every result is written
 // to bench/results/<date>.{json,md}, losses included.
 
-import { spawn } from 'child_process';
+import { spawn, spawnSync } from 'child_process';
 import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
 import { tmpdir } from 'os';
 import { fileURLToPath } from 'url';
 import { basename, dirname, join, resolve } from 'path';
 import { scoreSite, summarize, readDesignlang, readDembrandt, COLOR_TOLERANCE } from './score.js';
 
 const DEMBRANDT_VERSION = '0.33.0';
-const TIMEOUT_MS = 180_000;
+const TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_MS) || 180_000;
 const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
 
 function arg(name, fallback) {
@@ -30,20 +30,50 @@ function runTool(cmd, args) {
   return new Promise((done) => {
     const cwd = mkdtempSync(join(tmpdir(), 'designlang-bench-'));
     const started = Date.now();
-    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
+    // detached: the tool gets its own process group, so the timeout can kill
+    // it. Playwright starts Chromium in a group of its own, though, and a live
+    // browser kept a "180s" run going to 363s (3029s once, through npx). So:
+    // each run gets its own TMPDIR, which is where the browser profile lands,
+    // the timeout also kills anything whose command line names that directory,
+    // and the result is recorded without waiting for the pipes to close.
+    const child = spawn(cmd, args, {
+      cwd,
+      env: { ...process.env, TMPDIR: cwd },
+      stdio: ['ignore', 'pipe', 'pipe'],
+      detached: true,
+    });
     let stdout = '';
     let stderr = '';
+    let settled = false;
     child.stdout.on('data', (d) => { stdout += d; });
     child.stderr.on('data', (d) => { stderr += d; });
-    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
-    child.on('close', (code, signal) => {
+    const finish = (result) => {
+      if (settled) return;
+      settled = true;
+      // Time the run, not the cleanup: removing a browser profile can take seconds.
+      const seconds = (Date.now() - started) / 1000;
       clearTimeout(timer);
       rmSync(cwd, { recursive: true, force: true });
-      done({ code, signal, stdout, stderr, seconds: (Date.now() - started) / 1000 });
-    });
+      done({ ...result, stdout, stderr, seconds });
+    };
+    const timer = setTimeout(() => {
+      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
+      spawnSync('pkill', ['-KILL', '-f', cwd]);
+      finish({ code: null, signal: 'SIGKILL', timedOut: true });
+    }, TIMEOUT_MS);
+    child.on('close', (code, signal) => finish({ code, signal, timedOut: false }));
   });
 }
 
+// A dropped connection says nothing about either tool, so a run that fails
+// with a network-level error is retried once, for both tools alike.
+const NETWORK_ERROR_RE = /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_RESET/;
+async function extractOnce(tool, site) {
+  const first = await tool.extract(site);
+  if (first.code === 0 || first.timedOut || !NETWORK_ERROR_RE.test(first.stdout + first.stderr)) return first;
+  return { ...(await tool.extract(site)), retried: true };
+}
+
 function parseJson(stdout) {
   const start = stdout.indexOf('{');
   const end = stdout.lastIndexOf('}');
@@ -74,7 +104,7 @@ const rows = { designlang: [], dembrandt: [] };
 for (const [i, truth] of truths.entries()) {
   const order = i % 2 ? ['dembrandt', 'designlang'] : ['designlang', 'dembrandt'];
   for (const name of order) {
-    const r = await TOOLS[name].extract(truth.site);
+    const r = await extractOnce(TOOLS[name], truth.site);
     let predicted = null;
     try { predicted = TOOLS[name].read(parseJson(r.stdout)); } catch { /* recorded as a failure */ }
     const ok = r.code === 0 && predicted != null;
@@ -85,7 +115,11 @@ for (const [i, truth] of truths.entries()) {
       predicted,
       score: scoreSite(truth, ok ? predicted : null),
     };
-    if (!ok) row.error = `${r.signal ? `killed (${r.signal})` : `exit ${r.code}`}: ${(r.stderr.trim().split('\n').pop() || '').slice(0, 160)}`;
+    if (r.retried) row.retried = true;
+    if (!ok) {
+      const why = r.timedOut ? `timed out after ${TIMEOUT_MS / 1000}s` : r.signal ? `killed (${r.signal})` : `exit ${r.code}`;
+      row.error = `${why}: ${(r.stderr.trim().split('\n').pop() || '').slice(0, 160)}`;
+    }
     rows[name].push(row);
     const mark = (hit) => (hit === null ? '–' : hit ? '✓' : '✗');
     console.log(`${truth.site.padEnd(24)} ${name.padEnd(10)} ${ok ? `colour ${mark(row.score.color)} font ${mark(row.score.font)}` : row.error} ${row.seconds}s`);
@@ -117,6 +151,7 @@ const md = [
   '',
   `designlang ${TOOLS.designlang.version} vs dembrandt ${DEMBRANDT_VERSION}, default settings, ${truths.length} sites, ${report.platform}, Node ${process.ve
```

---

### Incident Patch 9: `42047041` (2026-09-15)
**Commit Message**: docs(changelog): 13.3.0 extraction accuracy fixes found by the benchmark

**File**: `CHANGELOG.md` (modified, +20/-0)
```diff
@@ -53,6 +53,26 @@ every failure exited `1`.
 - Fixed: with zero changes, `changed-count` was written as `0` twice, which broke
   the `changed` output.
 
+**Extraction accuracy** — found by a new head-to-head benchmark (`bench/`)
+
+- **`--json` output was truncated at 64KB when piped.** `designlang https://gov.uk --json | jq`
+  received 65,536 of 70,583 bytes. The CLI now exits only after stdout has
+  flushed; `drift --json` too.
+- **Body font counts only where text renders.** `<meta>`, `<link>` and other
+  head elements carry the browser default (Times) without drawing anything, which
+  made Times dropbox.com's body font. Code faces (plexMono, commitMono, Source
+  Code Pro) are labelled `mono` and sort after the text faces, so syntax
+  highlighting no longer outvotes the body font. `typography.families[].usage`
+  gains `other` and `mono`.
+- **Themes, Tailwind and CSS vars give the body slot to the most used body
+  family** and never overwrite it (supabase's Tailwind `body` had become Source
+  Code Pro).
+- **Brand colour is ranked by chroma, repetition and painted area**, not decided
+  by one call-to-action button. Near-black and near-white can't win on volume,
+  one full-page background can't win on area, and the browser's default link
+  colours are ignored. Fixes gov.uk, atlassian, discord, mailchimp, duolingo and
+  framer.
+
 **Breaking**
 
 - The Action's `fail-on-change` now defaults to `true`. Pass `false` to keep
```

---

### Incident Patch 10: `31bd34f4` (2026-09-15)
**Commit Message**: fix(extraction): code faces aren't body fonts; weigh colour evidence by chroma

Measured by replaying the extractors against cached crawls of the 27
benchmark sites, so only the code varied between runs.

Typography: syntax highlighting draws every token as its own text element, so
counting text-rendering elements made plexMono (tailwindcss, 450 vs Inter 131),
commitMono (resend) and Departure Mono (supabase) the body font. Families whose
name marks a code face are labelled "mono" and sort after the text faces.

Colours: usage, interactive backgrounds and area now count in proportion to
chroma (full weight from chroma 30), and area scores 60*sqrt(share).
Near-black #101214 (chroma 1.5) had won atlassian on 702 uses, #231e15 had
won mailchimp, and one element painting 84% of discord.com had won on area.

Replay, previous -> this: primary colour 10/17 -> 13/17, body font
24/27 -> 27/27, no site regressed. Still missed: linear (brand colour on one
element), slack, paypal, supabase (a lighter shade of the brand green). The three
new tests fail on the previous code.

**File**: `src/extractors/colors.js` (modified, +9/-3)
```diff
@@ -99,12 +99,18 @@ export function extractColors(computedStyles) {
   //   interactive backgrounds: a strong signal, with diminishing returns
   //   chroma, not HSL saturation: near-black #002533 has s=100 but reads dark
   //   usage and painted area: a brand colour is repeated across the page
+  // Evidence of use counts only in proportion to how colourful the cluster is:
+  // near-black #101214 on atlassian.com (chroma 1.5) got in through two dark
+  // buttons and then won on 702 uses. Area has diminishing returns, since one
+  // full-page background (84% of discord.com) is a surface, not repetition.
   function brandScore(c) {
     const chroma = ((100 - Math.abs(2 * c.lightness - 100)) * c.saturation) / 100;
-    return 40 * Math.log2(1 + c.interactiveBg)
-      + chroma
+    const colourful = Math.min(1, chroma / 30);
+    return chroma + colourful * (
+      40 * Math.log2(1 + c.interactiveBg)
       + 25 * Math.log10(Math.max(1, c.count))
-      + 300 * (c.areaShare || 0);
+      + 60 * Math.sqrt(c.areaShare || 0)
+    );
   }
   // The browser's default link colours say nothing about the brand.
   const UA_LINK_COLORS = new Set(['#0000ee', '#551a8b']);
```

**File**: `src/extractors/typography.js` (modified, +7/-1)
```diff
@@ -21,6 +21,11 @@ function rendersText(el) {
   return el.hasText !== false && !NON_RENDERING_TAGS.has(el.tag);
 }
 
+// Code faces. Syntax highlighting draws every token as its own text element, so
+// on tailwindcss.com plexMono out-counted Inter 450 to 131. A code face is never
+// the body font and sorts after the text faces.
+const MONO_FAMILY_RE = /mono|code|consol|courier|menlo|monaco/i;
+
 function normaliseFamily(raw) {
   if (!raw) return null;
   // Strip quotes + take the first stack member (sites declare e.g.
@@ -349,8 +354,9 @@ export function extractTypography(computedStyles, options = {}) {
 
   // Unique font families sorted by usage
   const families = [...familyCount.entries()]
-    .sort((a, b) => b[1] - a[1])
+    .sort((a, b) => MONO_FAMILY_RE.test(a[0]) - MONO_FAMILY_RE.test(b[0]) || b[1] - a[1])
     .map(([name, count]) => {
+      if (MONO_FAMILY_RE.test(name)) return { name, count, usage: 'mono' };
       const usedOn = computedStyles
         .filter(el => el.fontFamily?.includes(name) && rendersText(el))
         .map(el => el.tag);
```

**File**: `tests/color-ranking.test.js` (modified, +21/-0)
```diff
@@ -61,6 +61,27 @@ describe('brand colour ranking', () => {
     assert.equal(extractColors(styles).primary.hex, '#ff4800');
   });
 
+  it('a near-black used everywhere does not outrank the brand blue (atlassian: #101214 x702, 21% area)', () => {
+    const styles = [
+      ...page(),
+      ...times(700, () => el({ tag: 'span', color: '#101214' })),
+      ...times(2, () => el({ tag: 'button', bg: '#101214', color: '#ffffff', area: 180_000 })),
+      ...times(200, () => el({ tag: 'a', color: '#1868db' })),
+      el({ tag: 'button', bg: '#1868db', color: '#ffffff', area: 2500 }),
+    ];
+    assert.equal(extractColors(styles).primary.hex, '#1868db');
+  });
+
+  it('one full-page background does not outrank the brand colour on buttons and text (discord: 84% area)', () => {
+    const styles = [
+      ...page(),
+      el({ tag: 'main', bg: '#1a2081', area: 6_000_000 }),
+      ...times(2, () => el({ tag: 'a', bg: '#5865f2', color: '#ffffff', area: 3000 })),
+      ...times(33, () => el({ tag: 'span', color: '#5865f2' })),
+    ];
+    assert.equal(extractColors(styles).primary.hex, '#5865f2');
+  });
+
   it('a CTA colour used on many buttons still wins over a dark accent surface (hubspot)', () => {
     const styles = [
       ...page(),
```

**File**: `tests/typography-usage.test.js` (modified, +15/-0)
```diff
@@ -56,6 +56,21 @@ describe('typography family usage', () => {
     assert.deepEqual(names, ['GDS Transport']);
   });
 
+  it('a code face is not the body font, however many highlighted tokens it draws (tailwindcss, resend)', () => {
+    const styles = [
+      // syntax highlighting: every token is its own text element
+      ...Array.from({ length: 450 }, () => el('span', 'plexMono, ui-monospace, monospace', { hasText: true })),
+      ...Array.from({ length: 90 }, () => el('p', 'inter, system-ui, sans-serif', { hasText: true })),
+      ...Array.from({ length: 41 }, () => el('h2', 'inter, system-ui, sans-serif', { hasText: true })),
+      ...Array.from({ length: 144 }, () => el('span', '"Source Code Pro", monospace', { hasText: true })),
+    ];
+    const typo = extractTypography(styles);
+    assert.equal(typo.families[0].name, 'inter', 'the text face leads the family list');
+    assert.equal(typo.families.find((f) => f.name === 'plexMono').usage, 'mono');
+    assert.equal(typo.families.find((f) => f.name === 'Source Code Pro').usage, 'mono');
+    assert.equal(typo.families.find((f) => f.name === 'inter').usage, 'all');
+  });
+
   it('still counts records captured before hasText existed', () => {
     const typo = extractTypography([el('p', '"Inter", sans-serif'), el('h2', '"Inter", sans-serif')]);
     assert.equal(typo.families[0].name, 'Inter');
```

---

### Incident Patch 11: `9b3c3dfd` (2026-09-15)
**Commit Message**: fix(colors): rank brand colours by chroma, repetition and area, not one CTA

Measured per cluster on real sites, the linear weights let a single button
decide: 100 points per interactive background against at most ~3.5 for usage
and ~2.5 for painted area. gov.uk's CTA green on 4 buttons outranked the
GOV.UK blue, Framer's one #0066ff button outranked Framer Blue used 44 times,
and HSL saturation scored near-black #002533 (l=10) as vivid as a real brand
colour.

- interactive backgrounds: 40 * log2(1 + n), strong with diminishing returns
- chroma instead of HSL saturation
- 25 * log10(count) and 300 * areaShare so repetition and surface count
- the browser's default link colours (#0000ee, #551a8b) are never the brand

Re-extracted: gov.uk, duolingo and framer now return the brand colour; hubspot
unchanged; supabase (lighter shade of the brand green), paypal and linear still
miss. Three of the five new tests fail on the previous ranking.

**File**: `src/extractors/colors.js` (modified, +18/-6)
```diff
@@ -91,14 +91,26 @@ export function extractColors(computedStyles) {
     }
   }
 
-  // Rank chromatic clusters by brand-likelihood:
-  //   interactiveBg carries the most signal (it's a CTA color)
-  //   saturation comes next (brand colors are usually punchy)
-  //   raw usage count is a weak tiebreaker (avoids neutral-heavy sites dominating)
+  // Rank chromatic clusters by brand-likelihood. Measured on real sites
+  // (bench/), linear weights let one button decide: 100 points per interactive
+  // background against at most ~3 for usage and area, so gov.uk's CTA green
+  // (4 buttons) beat the GOV.UK blue and a one-off #0066ff beat Framer Blue
+  // used 44 times.
+  //   interactive backgrounds: a strong signal, with diminishing returns
+  //   chroma, not HSL saturation: near-black #002533 has s=100 but reads dark
+  //   usage and painted area: a brand colour is repeated across the page
   function brandScore(c) {
-    return c.interactiveBg * 100 + c.saturation * 2 + Math.log10(Math.max(1, c.count)) + (c.areaShare || 0) * 10;
+    const chroma = ((100 - Math.abs(2 * c.lightness - 100)) * c.saturation) / 100;
+    return 40 * Math.log2(1 + c.interactiveBg)
+      + chroma
+      + 25 * Math.log10(Math.max(1, c.count))
+      + 300 * (c.areaShare || 0);
   }
-  const ranked = [...chromatic].sort((a, b) => brandScore(b) - brandScore(a));
+  // The browser's default link colours say nothing about the brand.
+  const UA_LINK_COLORS = new Set(['#0000ee', '#551a8b']);
+  const ranked = [...chromatic]
+    .filter((c) => !UA_LINK_COLORS.has(c.hex))
+    .sort((a, b) => brandScore(b) - brandScore(a));
 
   const primary = ranked[0] || null;
   // secondary: distinct hue from primary
```

**File**: `tests/color-ranking.test.js` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+import { describe, it } from 'node:test';
+import assert from 'node:assert/strict';
+import { extractColors } from '../src/extractors/colors.js';
+
+// Each case reproduces a ranking failure measured on a real site (bench/).
+
+const rgb = (hex) => {
+  const n = parseInt(hex.slice(1), 16);
+  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
+};
+const CLEAR = 'rgba(0, 0, 0, 0)';
+const el = ({ tag = 'div', color = '#111111', bg = null, border = null, area = 2000, classList = '' } = {}) => ({
+  tag, role: '', classList, area,
+  color: rgb(color),
+  backgroundColor: bg ? rgb(bg) : CLEAR,
+  borderColor: border ? rgb(border) : CLEAR,
+  backgroundImage: 'none',
+});
+const times = (n, make) => Array.from({ length: n }, make);
+// Every real page is mostly neutral text on white.
+const page = () => [...times(300, () => el()), el({ tag: 'body', bg: '#ffffff', area: 1_000_000 })];
+
+describe('brand colour ranking', () => {
+  it('a colour repeated across the page beats a one-off button colour (framer)', () => {
+    const styles = [
+      ...page(),
+      el({ tag: 'button', bg: '#0066ff', color: '#ffffff', area: 4000 }),
+      ...times(44, () => el({ tag: 'span', color: '#0099ff' })),
+      el({ tag: 'section', bg: '#0099ff', area: 15_000 }),
+    ];
+    assert.equal(extractColors(styles).primary.hex, '#0099ff');
+  });
+
+  it('a large brand-coloured surface beats a few CTA buttons in another hue (gov.uk)', () => {
+    const styles = [
+      ...page(),
+      ...times(4, () => el({ tag: 'button', bg: '#0f7a52', color: '#ffffff', area: 400 })),
+      ...times(2, () => el({ tag: 'a', bg: '#1d70b8', color: '#ffffff', area: 3000 })),
+      ...times(16, () => el({ tag: 'span', color: '#1d70b8' })),
+      el({ tag: 'header', bg: '#1d70b8', area: 60_000 }),
+    ];
+    assert.equal(extractColors(styles).primary.hex, '#1d70b8');
+  });
+
+  it('a near-black button is not the brand colour (supabase)', () => {
+    const styles = [
+      ...page(),
+      ...times(2, () => el({ tag: 'button', bg: '#002533', color: '#ffffff', area: 3000 })),
+      ...times(26, () => el({ tag: 'span', color: '#3ecf8e' })),
+      el({ tag: 'a', bg: '#3ecf8e', color: '#111111', area: 2500 }),
+    ];
+    assert.equal(extractColors(styles).primary.hex, '#3ecf8e');
+  });
+
+  it("ignores the browser's default link blue however often it appears (paypal)", () => {
+    const styles = [
+      ...page(),
+      ...times(1000, () => el({ tag: 'a', color: '#0000ee' })),
+      ...times(3, () => el({ tag: 'button', bg: '#ff4800', color: '#ffffff', area: 3000 })),
+    ];
+    assert.equal(extractColors(styles).primary.hex, '#ff4800');
+  });
+
+  it('a CTA colour used on many buttons still wins over a dark accent surface (hubspot)', () => {
+    const styles = [
+      ...page(),
+      ...times(5, () => el({ tag: 'button', bg: '#ff4800', color: '#ffffff', area: 1500 })),
+      ...times(16, () => el({ tag: 'span', color: '#ff4800' })),
+      el({ tag: 'section', bg: '#042729', area: 55_000 }),
+    ];
+    assert.equal(extractColors(styles).primary.hex, '#ff4800');
+  });
+});
```

---

### Incident Patch 12: `63efb00f` (2026-09-15)
**Commit Message**: fix(typography): count a font only where it renders text; stop fallbacks taking the body slot

Head and metadata elements carry the browser default (Times) without drawing
anything. On gov.uk they were 35 of Times's 36 uses; on dropbox.com Times had
1257 elements but only 90 with text, against 201 for Atlas Grotesk, so
designlang reported Times as dropbox's body font.

- families count only text-rendering elements (records without hasText, from
  older snapshots, still count)
- a family used on neither headings nor body copy is labelled "other", not body
- React/MUI theme, Tailwind and CSS vars give the body slot to the most used
  body-capable family and never overwrite it (supabase's tailwind body had
  become Source Code Pro)

**File**: `src/extractors/typography.js` (modified, +13/-3)
```diff
@@ -12,6 +12,15 @@ const GENERIC_FAMILIES = new Set([
 ]);
 const ICON_FAMILY_RE = /^(material[-\s]?icons|font\s?awesome|fa-?solid|fa-?regular|fa-?brands|ionicons|glyphicons|bootstrap-icons|remixicon|feather|tabler-icons|lucide)/i;
 
+// A family is typography only where it renders text. Head and metadata
+// elements carry the browser default (Times) without drawing anything: on
+// gov.uk they were 35 of Times's 36 "uses", enough to make it a body font.
+// Records without hasText (older snapshots) still count.
+const NON_RENDERING_TAGS = new Set(['html', 'head', 'meta', 'link', 'script', 'style', 'title', 'noscript', 'template', 'base']);
+function rendersText(el) {
+  return el.hasText !== false && !NON_RENDERING_TAGS.has(el.tag);
+}
+
 function normaliseFamily(raw) {
   if (!raw) return null;
   // Strip quotes + take the first stack member (sites declare e.g.
@@ -317,7 +326,7 @@ export function extractTypography(computedStyles, options = {}) {
   for (const el of computedStyles) {
     // Font families — normalised first-of-stack, with noise filtered out.
     const family = normaliseFamily(el.fontFamily);
-    if (family && isMeaningfulFamily(family)) {
+    if (family && isMeaningfulFamily(family) && rendersText(el)) {
       familyCount.set(family, (familyCount.get(family) || 0) + 1);
     }
 
@@ -343,11 +352,12 @@ export function extractTypography(computedStyles, options = {}) {
     .sort((a, b) => b[1] - a[1])
     .map(([name, count]) => {
       const usedOn = computedStyles
-        .filter(el => el.fontFamily?.includes(name))
+        .filter(el => el.fontFamily?.includes(name) && rendersText(el))
         .map(el => el.tag);
       const headingUse = usedOn.some(t => /^h[1-6]$/.test(t));
       const bodyUse = usedOn.some(t => ['p', 'span', 'li', 'div'].includes(t));
-      return { name, count, usage: headingUse && bodyUse ? 'all' : headingUse ? 'headings' : 'body' };
+      // A family on neither (buttons, inputs) is not a body font.
+      return { name, count, usage: headingUse && bodyUse ? 'all' : headingUse ? 'headings' : bodyUse ? 'body' : 'other' };
     });
 
   // Build type scale from unique sizes
```

**File**: `src/formatters/css-vars.js` (modified, +3/-1)
```diff
@@ -62,8 +62,10 @@ export function formatCssVars(design) {
     for (let i = 0; i < design.typography.families.length; i++) {
       const f = design.typography.families[i];
       let key;
+      // Only the most used body-capable family gets --font-body.
+      const bodyTaken = design.typography.families.slice(0, i).some((p) => p.usage === 'body' || p.usage === 'all');
       if (f.usage === 'headings') key = 'heading';
-      else if (f.usage === 'body') key = 'body';
+      else if (f.usage === 'body') key = bodyTaken ? `font-${i}` : 'body';
       else if (i === 0) key = 'sans';
       else if (f.name.toLowerCase().includes('mono')) key = 'mono';
       else key = i === 1 ? 'heading' : `font-${i}`;
```

**File**: `src/formatters/tailwind.js` (modified, +4/-1)
```diff
@@ -52,8 +52,11 @@ export function formatTailwind(design) {
   for (let i = 0; i < design.typography.families.length; i++) {
     const f = design.typography.families[i];
     let key;
+    // Only the most used body-capable family gets fontFamily.body; a later one
+    // used to overwrite it (supabase: body became Source Code Pro).
+    const bodyTaken = design.typography.families.slice(0, i).some((p) => p.usage === 'body' || p.usage === 'all');
     if (f.usage === 'headings') key = 'heading';
-    else if (f.usage === 'body') key = 'body';
+    else if (f.usage === 'body') key = bodyTaken ? `font${i}` : 'body';
     else if (i === 0) key = 'sans';
     else if (f.name.toLowerCase().includes('mono')) key = 'mono';
     else key = i === 1 ? 'heading' : `font${i}`;
```

**File**: `src/formatters/theme.js` (modified, +4/-2)
```diff
@@ -20,7 +20,9 @@ export function formatReactTheme(design) {
   theme.fonts = {};
   for (const f of typography.families) {
     const key = f.name.toLowerCase().includes('mono') ? 'mono' : f.usage === 'headings' ? 'heading' : 'body';
-    theme.fonts[key] = `'${f.name}', ${f.name.toLowerCase().includes('mono') ? 'monospace' : 'sans-serif'}`;
+    // Families are sorted by use, so the most used keeps each slot.
+    if (theme.fonts[key]) continue;
+    theme.fonts[key] =`'${f.name}', ${f.name.toLowerCase().includes('mono') ? 'monospace' : 'sans-serif'}`;
   }
 
   theme.fontSizes = {};
@@ -144,7 +146,7 @@ function buildMuiTheme(design) {
   if (colors.text.length > 1) mui.palette.text.secondary = colors.text[1];
 
   // Typography
-  const bodyFont = typography.families.find(f => f.usage === 'body');
+  const bodyFont = typography.families.find(f => f.usage === 'body' || f.usage === 'all');
   const headingFont = typography.families.find(f => f.usage === 'headings');
   mui.typography.fontFamily = bodyFont ? `'${bodyFont.name}', sans-serif` : undefined;
   for (const s of typography.scale.slice(0, 6)) {
```

**File**: `tests/typography-usage.test.js` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+import { describe, it } from 'node:test';
+import assert from 'node:assert/strict';
+import { readFileSync } from 'node:fs';
+import { extractTypography } from '../src/extractors/typography.js';
+import { formatCssVars } from '../src/formatters/css-vars.js';
+import { formatTailwind } from '../src/formatters/tailwind.js';
+import { formatReactTheme } from '../src/formatters/theme.js';
+
+const el = (tag, fontFamily, extra = {}) => ({ tag, fontFamily, fontSize: '16px', fontWeight: '400', lineHeight: '1.5', letterSpacing: 'normal', ...extra });
+
+// A real extraction with its families swapped for a measured shape.
+function designWithFamilies(families) {
+  const design = JSON.parse(readFileSync(new URL('./fixtures/example-design.json', import.meta.url), 'utf-8'));
+  design.typography.families = families;
+  return design;
+}
+// gov.uk before the fix: the brand face sets headings and body ("all"), and
+// the browser default trails behind, mislabelled as body.
+const GOV_UK_FAMILIES = [
+  { name: 'GDS Transport', count: 567, usage: 'all' },
+  { name: 'Times', count: 36, usage: 'body' },
+  { name: 'Arial', count: 13, usage: 'body' },
+];
+// supabase: two body families; the second used to overwrite the first.
+const SUPABASE_FAMILIES = [
+  { name: 'Inter', count: 4619, usage: 'body' },
+  { name: 'Source Code Pro', count: 181, usage: 'body' },
+];
+
+function tailwindFont(config, key) {
+  const m = config.match(new RegExp(`["']?${key}["']?\\s*:\\s*\\[\\s*["']([^"']+)`));
+  return m ? m[1] : null;
+}
+
+describe('typography family usage', () => {
+  it('does not label a family body when it sets neither headings nor body copy', () => {
+    const typo = extractTypography([
+      el('p', '"Inter", sans-serif', { hasText: true }),
+      el('h1', '"Inter", sans-serif', { hasText: true }),
+      el('button', 'Arial', { hasText: true }),
+    ]);
+    assert.equal(typo.families.find((f) => f.name === 'Arial').usage, 'other');
+    assert.equal(typo.families.find((f) => f.name === 'Inter').usage, 'all');
+  });
+
+  it('counts a family only where it renders text (gov.uk head elements carried Times)', () => {
+    const styles = [
+      ...Array.from({ length: 20 }, () => el('meta', 'Times', { hasText: false })),
+      el('link', 'Times', { hasText: false }),
+      el('title', 'Times', { hasText: true }),
+      el('div', 'Times', { hasText: false }),
+      el('p', '"GDS Transport", arial, sans-serif', { hasText: true }),
+      el('h1', '"GDS Transport", arial, sans-serif', { hasText: true }),
+    ];
+    const names = extractTypography(styles).families.map((f) => f.name);
+    assert.deepEqual(names, ['GDS Transport']);
+  });
+
+  it('still counts records captured before hasText existed', () => {
+    const typo = extractTypography([el('p', '"Inter", sans-serif'), el('h2', '"Inter", sans-serif')]);
+    assert.equal(typo.families[0].name, 'Inter');
+    assert.equal(typo.families[0].count, 2);
+  });
+});
+
+describe('body font in emitted themes', () => {
+  it('css vars never hand --font-body to a trailing fallback', () => {
+    const css = formatCssVars(designWithFamilies(GOV_UK_FAMILIES));
+    assert.match(css, /--font-sans: 'GDS Transport'/);
+    assert.doesNotMatch(css, /--font-body: 'Times'/);
+  });
+
+  it('css vars give --font-body to the most used body family', () => {
+    const css = formatCssVars(designWithFamilies(SUPABASE_FAMILIES));
+    assert.match(css, /--font-body: 'Inter'/);
+    assert.doesNotMatch(css, /--font-body: 'Source Code Pro'/);
+  });
+
+  it('tailwind keeps the main family on sans and never makes a fallback the body font', () => {
+    const config = formatTailwind(designWithFamilies(GOV_UK_FAMILIES));
+    assert.equal(tailwindFont(config, 'sans'), 'GDS Transport');
+    assert.notEqual(tailwindFont(config, 'body'), 'Times');
+  });
+
+  it('tailwind body is the most used body family, not the last one seen', () => {
+    const config = formatTailwind(designWithFamilies(SUPABASE_FAMILIES));
+    assert.equal(tailwindFont(config, 'body'), 'Inter');
+  });
+
+  it('the React/MUI theme sets body text in the family used everywhere', () => {
+    const out = formatReactTheme(designWithFamilies(GOV_UK_FAMILIES));
+    const text = typeof out === 'string' ? out : JSON.stringify(out);
+    assert.ok(text.includes("'GDS Transport', sans-serif"));
+    assert.ok(!text.includes("'Times', sans-serif"), 'a browser-default fallback must not become the body font');
+  });
+});
```

---

### Incident Patch 13: `49fcb190` (2026-09-15)
**Commit Message**: fix(cli): --json output was truncated at 64KB when piped

process.exit() straight after process.stdout.write() drops whatever the pipe
hasn't flushed. `designlang https://gov.uk --json | jq` received exactly
65536 bytes of a 70583-byte document, so any site with a large design broke
JSON consumers in CI. Found by the benchmark runner, which reads through a pipe.

- writeThenExit(): exit once the write is handed to the OS; used by extraction
  --json and drift --json (which exits non-zero on drift right after writing)
- the export command's error path uses the new exit codes
- bench: a family designlang marks usage "all" counts as body text, and both
  readers take the most used body family

**File**: `bench/score.js` (modified, +8/-4)
```diff
@@ -77,21 +77,25 @@ function mostUsed(entries, nameKey) {
   return best?.[0] ?? null;
 }
 
-// Both readers apply the same rule: the family each tool labels as body text,
-// else its most used family. Neither tool is judged on its heading face.
+// Both readers apply the same rule: the most used of the families each tool
+// says sets body text, else its most used family overall. Neither tool is
+// judged on its heading face.
 export function readDesignlang(design) {
   const families = design?.typography?.families || [];
+  // designlang marks a family used for both headings and body as "all".
+  const body = families.filter((f) => f.usage === 'body' || f.usage === 'all');
   return {
     primary: toHex(design?.colors?.primary),
-    font: families.find((f) => f.usage === 'body')?.name ?? mostUsed(families, 'name'),
+    font: mostUsed(body, 'name') ?? mostUsed(families, 'name'),
   };
 }
 
 export function readDembrandt(output) {
   const styles = output?.typography?.styles || [];
+  const body = styles.filter((s) => s.context === 'body');
   return {
     primary: toHex(output?.colors?.semantic?.primary),
-    font: styles.find((s) => s.context === 'body')?.family ?? mostUsed(styles, 'family'),
+    font: mostUsed(body, 'family') ?? mostUsed(styles, 'family'),
   };
 }
 
```

**File**: `bin/design-extract.js` (modified, +10/-7)
```diff
@@ -362,8 +362,9 @@ program
       // JSON mode: output and exit
       if (jsonMode) {
         const output = opts.jsonPretty ? JSON.stringify(design, null, 2) : JSON.stringify(design);
-        process.stdout.write(output + '\n');
-        process.exit(0);
+        const { EXIT, writeThenExit } = await import('../src/exit-codes.js');
+        writeThenExit(process.stdout, output + '\n', EXIT.OK);
+        return;
       }
 
       spinner.text = 'Generating outputs...';
@@ -2003,8 +2004,9 @@ program
         process.stdout.write(output + '\n');
       }
     } catch (err) {
+      const { exitCodeForError } = await import('../src/exit-codes.js');
       process.stderr.write(`Error: ${err.message}\n`);
-      process.exit(1);
+      process.exit(exitCodeForError(err));
     }
   });
 
@@ -2056,11 +2058,12 @@ program
     try {
       const { checkDrift, formatDriftMarkdown } = await import('../src/drift.js');
       const r = await checkDrift(url, { tokens: resolve(opts.tokens), tolerance: opts.tolerance });
-      if (opts.json) { process.stdout.write(JSON.stringify(r, null, 2) + '\n'); }
-      else { console.log('\n' + formatDriftMarkdown(r) + '\n'); }
       const order = ['in-sync', 'minor-drift', 'notable-drift', 'major-drift'];
-      const { EXIT } = await import('../src/exit-codes.js');
-      if (order.indexOf(r.verdict) >= order.indexOf(opts.failOn)) process.exit(EXIT.DRIFT);
+      const { EXIT, writeThenExit } = await import('../src/exit-codes.js');
+      const code = order.indexOf(r.verdict) >= order.indexOf(opts.failOn) ? EXIT.DRIFT : EXIT.OK;
+      if (opts.json) return writeThenExit(process.stdout, JSON.stringify(r, null, 2) + '\n', code);
+      console.log('\n' + formatDriftMarkdown(r) + '\n');
+      if (code !== EXIT.OK) process.exit(code);
     } catch (err) {
       const { exitCodeForError } = await import('../src/exit-codes.js');
       process.stderr.write(chalk.red(`\n  Error: ${err.message}\n\n`));
```

**File**: `src/exit-codes.js` (modified, +7/-0)
```diff
@@ -9,6 +9,13 @@ export const EXIT = Object.freeze({
   NAVIGATION_TIMEOUT: 3, // retryable: try --wait or a later run
 });
 
+// process.exit() straight after a write to a pipe drops whatever hasn't been
+// flushed: `designlang <url> --json | jq` received the first 64KB of a 70KB
+// document. Exit only once the write has been handed to the OS.
+export function writeThenExit(stream, text, code) {
+  stream.write(text, () => process.exit(code));
+}
+
 export function exitCodeForError(err) {
   if (err?.name === 'TimeoutError' || /Timeout \d+ms exceeded/.test(err?.message || '')) return EXIT.NAVIGATION_TIMEOUT;
   return EXIT.EXTRACTION_FAILED;
```

**File**: `tests/bench-score.test.js` (modified, +9/-0)
```diff
@@ -14,6 +14,15 @@ describe('bench score: reading each tool', () => {
     assert.equal(readDesignlang(design).font, 'Inter');
   });
 
+  it('counts a family used everywhere as body, and picks the most used (gov.uk)', () => {
+    const design = { colors: {}, typography: { families: [
+      { name: 'GDS Transport', count: 580, usage: 'all' },
+      { name: 'Times', count: 6, usage: 'body' },
+      { name: 'Arial', count: 3, usage: 'body' },
+    ] } };
+    assert.equal(readDesignlang(design).font, 'GDS Transport');
+  });
+
   it('reads dembrandt primary (rgb) and body context', () => {
     const out = {
       colors: { semantic: { primary: 'rgb(83, 58, 253)' } },
```

**File**: `tests/exit-codes.test.js` (modified, +19/-0)
```diff
@@ -1,7 +1,26 @@
 import { describe, it } from 'node:test';
 import assert from 'node:assert/strict';
+import { spawn } from 'node:child_process';
 import { EXIT, exitCodeForError } from '../src/exit-codes.js';
 
+describe('writeThenExit', () => {
+  it('delivers output larger than a pipe buffer in full before exiting', async () => {
+    const helper = new URL('../src/exit-codes.js', import.meta.url).href;
+    const script = `
+      import { writeThenExit } from ${JSON.stringify(helper)};
+      const doc = JSON.stringify({ rows: Array.from({ length: 6000 }, (_, i) => ({ i, pad: 'x'.repeat(40) })) });
+      writeThenExit(process.stdout, doc + '\\n', 1);
+    `;
+    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
+    let out = '';
+    child.stdout.on('data', (d) => { out += d; });
+    const code = await new Promise((resolve) => child.on('close', resolve));
+    assert.ok(Buffer.byteLength(out) > 65536 * 4, `only ${Buffer.byteLength(out)} bytes arrived`);
+    assert.equal(JSON.parse(out).rows.length, 6000);
+    assert.equal(code, 1);
+  });
+});
+
 describe('exit codes', () => {
   it('keeps drift and extraction failure distinct', () => {
     assert.deepEqual(EXIT, { OK: 0, DRIFT: 1, EXTRACTION_FAILED: 2, NAVIGATION_TIMEOUT: 3 });
```

---

### Incident Patch 14: `b73e1a6b` (2026-09-15)
**Commit Message**: fix(bench): don't score a dimension that has no ground truth

Several brands are monochrome or render body text in a system stack, so no
sourced brand colour or font appears on the live page. Scoring either tool
against an absent truth would be noise. Such a dimension now scores null and
is left out of that dimension's denominator; a failed run still counts as a
miss wherever truth exists.

**File**: `bench/run.mjs` (modified, +11/-5)
```diff
@@ -83,7 +83,7 @@ for (const [i, truth] of truths.entries()) {
       ok,
       seconds: +r.seconds.toFixed(1),
       predicted,
-      score: ok ? scoreSite(truth, predicted) : { color: false, font: false },
+      score: scoreSite(truth, ok ? predicted : null),
     };
     if (!ok) row.error = `${r.signal ? `killed (${r.signal})` : `exit ${r.code}`}: ${(r.stderr.trim().split('\n').pop() || '').slice(0, 160)}`;
     rows[name].push(row);
@@ -105,7 +105,13 @@ const report = {
 };
 
 const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
-const cell = (row, key) => (!row.ok ? 'failed' : `${row.score[key] ? '✅' : '❌'} ${row.predicted[key === 'color' ? 'primary' : 'font'] ?? '—'}`);
+const ratio = (hits, total) => `${hits}/${total} (${pct(hits, total)})`;
+const cell = (row, key) => {
+  if (row.score[key] === null) return 'n/a';
+  if (!row.ok) return '❌ failed';
+  return `${row.score[key] ? '✅' : '❌'} ${row.predicted[key === 'color' ? 'primary' : 'font'] ?? '—'}`;
+};
+const truthText = (s) => `${s.primary?.length ? s.primary.join(' / ') : 'n/a'} · ${s.font?.length ? s.font.join(' / ') : 'n/a'}`;
 const md = [
   `# Extraction benchmark — ${date}`,
   '',
@@ -114,14 +120,14 @@ const md = [
   '',
   '| | designlang | dembrandt |',
   '|---|---|---|',
-  `| Primary colour correct | ${summary.designlang.colorHits}/${truths.length} (${pct(summary.designlang.colorHits, truths.length)}) | ${summary.dembrandt.colorHits}/${truths.length} (${pct(summary.dembrandt.colorHits, truths.length)}) |`,
-  `| Body font correct | ${summary.designlang.fontHits}/${truths.length} (${pct(summary.designlang.fontHits, truths.length)}) | ${summary.dembrandt.fontHits}/${truths.length} (${pct(summary.dembrandt.fontHits, truths.length)}) |`,
+  `| Primary colour correct | ${ratio(summary.designlang.colorHits, summary.designlang.colorSites)} | ${ratio(summary.dembrandt.colorHits, summary.dembrandt.colorSites)} |`,
+  `| Body font correct | ${ratio(summary.designlang.fontHits, summary.designlang.fontSites)} | ${ratio(summary.dembrandt.fontHits, summary.dembrandt.fontSites)} |`,
   `| Failed runs | ${summary.designlang.failures} | ${summary.dembrandt.failures} |`,
   `| Median time | ${summary.designlang.medianSeconds ?? '—'}s | ${summary.dembrandt.medianSeconds ?? '—'}s |`,
   '',
   '| Site | Truth | designlang colour | dembrandt colour | designlang font | dembrandt font |',
   '|---|---|---|---|---|---|',
-  ...report.sites.map((s) => `| ${s.site} | ${s.primary.join(' / ')} · ${s.font.join(' / ')} | ${cell(s.designlang, 'color')} | ${cell(s.dembrandt, 'color')} | ${cell(s.designlang, 'font')} | ${cell(s.dembrandt, 'font')} |`),
+  ...report.sites.map((s) => `| ${s.site} | ${truthText(s)} |${cell(s.designlang, 'color')} | ${cell(s.dembrandt, 'color')} | ${cell(s.designlang, 'font')} | ${cell(s.dembrandt, 'font')} |`),
   '',
   'Reproduce: `node bench/run.mjs`. Ground truth and sources: `bench/sites.json`.',
   '',
```

**File**: `bench/score.js` (modified, +10/-5)
```diff
@@ -95,10 +95,12 @@ export function readDembrandt(output) {
   };
 }
 
+// A dimension with no ground truth (a monochrome brand, a system body font)
+// scores null: not counted, rather than counted against either tool.
 export function scoreSite(truth, predicted) {
   return {
-    color: colorHit(predicted?.primary, truth.primary),
-    font: fontHit(predicted?.font, truth.font),
+    color: truth.primary?.length ? colorHit(predicted?.primary, truth.primary) : null,
+    font: truth.font?.length ? fontHit(predicted?.font, truth.font) : null,
   };
 }
 
@@ -109,14 +111,17 @@ function median(nums) {
   return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
 }
 
-// rows: [{ site, ok, seconds, score: { color, font } }] for one tool.
+// rows: [{ site, ok, seconds, score: { color, font } }] for one tool. A failed
+// run keeps its false scores, so it counts as a miss wherever truth exists.
 export function summarize(rows) {
   const ran = rows.filter((r) => r.ok);
   return {
     sites: rows.length,
     failures: rows.length - ran.length,
-    colorHits: ran.filter((r) => r.score.color).length,
-    fontHits: ran.filter((r) => r.score.font).length,
+    colorSites: rows.filter((r) => r.score.color !== null).length,
+    colorHits: rows.filter((r) => r.score.color === true).length,
+    fontSites: rows.filter((r) => r.score.font !== null).length,
+    fontHits: rows.filter((r) => r.score.font === true).length,
     medianSeconds: median(ran.map((r) => r.seconds)),
   };
 }
```

**File**: `tests/bench-score.test.js` (modified, +10/-2)
```diff
@@ -92,9 +92,17 @@ describe('bench score: summary', () => {
 
     const rows = [
       { site: 'a', ok: true, seconds: 10, score: { color: true, font: true } },
-      { site: 'b', ok: true, seconds: 20, score: { color: false, font: true } },
+      { site: 'b', ok: true, seconds: 20, score: { color: null, font: true } },
       { site: 'c', ok: false, seconds: 180, score: { color: false, font: false } },
     ];
-    assert.deepEqual(summarize(rows), { sites: 3, failures: 1, colorHits: 1, fontHits: 2, medianSeconds: 15 });
+    assert.deepEqual(summarize(rows), {
+      sites: 3, failures: 1, colorSites: 2, colorHits: 1, fontSites: 3, fontHits: 2, medianSeconds: 15,
+    });
+  });
+
+  it('does not score a dimension without ground truth, and a failed run misses the rest', () => {
+    const monochrome = { primary: [], font: ['Inter'] };
+    assert.deepEqual(scoreSite(monochrome, { primary: '#000000', font: 'Inter Variable' }), { color: null, font: true });
+    assert.deepEqual(scoreSite(monochrome, null), { color: null, font: false });
   });
 });
```

---

### Incident Patch 15: `ddd4ad1b` (2026-09-15)
**Commit Message**: ci(release): publish to npm on version tags; fix MCP version and designlang/mcp entry

- release.yml publishes with provenance when a vX.Y.Z tag matches package.json
- MCP serverInfo reports the package version instead of a hard-coded 7.0.0
- add src/mcp/index.js, which the ./mcp export pointed at but never existed
- test a stock SDK client handshake over stdio

**File**: `.github/workflows/release.yml` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+name: release
+
+# Publishes designlang to npm when a vX.Y.Z tag is pushed.
+#
+# npm `latest` once sat three months behind the repo (12.21.0 vs 13.2.0) because
+# publishing was a manual step. Tagging is now the whole release.
+#
+# Requires the NPM_TOKEN repository secret (an npm automation token).
+
+on:
+  push:
+    tags: ['v*.*.*']
+
+permissions:
+  contents: read
+  id-token: write # npm provenance
+
+jobs:
+  publish:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v7
+
+      - uses: actions/setup-node@v6
+        with:
+          node-version: 22
+          cache: npm
+          registry-url: https://registry.npmjs.org
+
+      - name: Tag must match package.json
+        run: |
+          PKG="$(node -p "require('./package.json').version")"
+          if [ "${GITHUB_REF_NAME#v}" != "$PKG" ]; then
+            echo "::error::tag $GITHUB_REF_NAME does not match package.json $PKG"
+            exit 1
+          fi
+
+      - name: Install dependencies
+        run: npm ci
+
+      - name: Install Playwright Chromium
+        run: npx playwright install --with-deps chromium
+
+      - name: Run tests
+        run: npm test
+
+      - name: Check plugin manifest version sync
+        run: npm run check-plugin
+
+      - name: Publish
+        env:
+          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+        run: |
+          VERSION="$(node -p "require('./package.json').version")"
+          if npm view "designlang@$VERSION" version >/dev/null 2>&1; then
+            echo "designlang@$VERSION is already on npm, nothing to publish"
+            exit 0
+          fi
+          npm publish --provenance --access public
```

**File**: `docs/superpowers/specs/2026-09-15-phase-a-trust-design.md` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+# Phase A — close the adoption gaps vs dembrandt, then prove it
+
+Date: 2026-09-15 · Status: approved
+
+## Why
+
+Head-to-head on 8 sites (stripe, linear, vercel, github, gov.uk, ikea, notion,
+tailwindcss): designlang matched or beat dembrandt 0.33.0 on primary colour and
+font, and ran 1.8× faster (88s vs 159s). Yet dembrandt pulls ~6.6× the npm
+downloads. The gap is trust and distribution, not extraction:
+
+- npm `latest` is 12.21.0 (2026-06-14); repo is 13.2.0.
+- MCP server can't extract a URL (5 read-only tools over a folder), reports
+  version 7.0.0, rejects a version-less `initialize` (#182, #183).
+- CLI exits `1` for everything; the GitHub Action installs unpinned latest and
+  does not fail on drift by default.
+- `postinstall` downloads Chromium, which breaks in CI/Docker.
+- No published, reproducible evidence of quality.
+
+## Scope (in order, each its own minor release)
+
+**A1 Releases** — `.github/workflows/release.yml` on `v*.*.*` tags: `npm ci`,
+`npm test`, tag == `package.json` version, `npm publish --provenance`
+(`NPM_TOKEN`). MCP `serverInfo.version` read from `package.json`.
+
+**A2 Browser install** — drop `postinstall`; add `designlang install-browser`;
+one shared launcher: bundled Chromium → system Chrome → actionable error. All
+launch sites use it.
+
+**A3 MCP v2** — keep the 5 existing tools. Add job-based URL tools:
+`extract_design`, `get_job_status`, `list_jobs`, `cancel_job`, `get_tokens`,
+`get_colors`, `get_typography`, `get_components`, plus `compute_drift`,
+`get_findings`, `export`. A stock SDK client must handshake and list tools;
+version-less `initialize` is served on the default revision.
+
+**A4 CI gate** — exit codes 0 ok · 1 drift over threshold · 2 extraction failed
+· 3 navigation timeout. Action pins designlang to its own tag, fails on drift by
+default, annotates the PR, author Manavarya09.
+
+**A5 Benchmark** — `bench/sites.json` (~30 sites, ground-truth primary colour +
+primary font, owner-reviewed), `bench/run.mjs` runs designlang and pinned
+dembrandt sequentially with default flags, scores colour (ΔE tolerance), font,
+time, failures → `bench/results/<date>.{json,md}`. Baseline first, fix what it
+exposes (generic fallback fonts in families; primary pick on linear/gov.uk),
+then publish README table + `website/app/vs/dembrandt`. Losses are published.
+
+## Out of scope
+
+Hosted drift platform (phase C, separate design). New emitters.
+
+## Testing
+
+`npm test` gates every step. New tests: launcher fallback, MCP handshake + tool
+calls via SDK client, exit codes, benchmark scorer.
```

**File**: `src/mcp/index.js` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+// Public entry for `designlang/mcp` (see package.json exports).
+
+export { run } from './server.js';
+export { buildTools } from './tools.js';
+export { buildResources } from './resources.js';
```

**File**: `src/mcp/server.js` (modified, +2/-1)
```diff
@@ -68,8 +68,9 @@ export async function run({ outputDir }) {
   const resources = buildResources({ design, tokens });
   const tools = buildTools({ design, tokens });
 
+  const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
   const server = new Server(
-    { name: 'designlang', version: '7.0.0' },
+    { name: 'designlang', version },
     { capabilities: { resources: {}, tools: {} } },
   );
 
```

**File**: `tests/mcp.test.js` (modified, +39/-0)
```diff
@@ -1,8 +1,47 @@
 import { describe, it } from 'node:test';
 import assert from 'node:assert/strict';
+import { readFileSync, mkdtempSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { Client } from '@modelcontextprotocol/sdk/client/index.js';
+import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
 import { buildResources } from '../src/mcp/resources.js';
 import { buildTools } from '../src/mcp/tools.js';
 
+describe('MCP package entry', () => {
+  it('designlang/mcp resolves and exports run, buildTools, buildResources', async () => {
+    const mod = await import('designlang/mcp');
+    assert.equal(typeof mod.run, 'function');
+    assert.equal(typeof mod.buildTools, 'function');
+    assert.equal(typeof mod.buildResources, 'function');
+  });
+});
+
+describe('MCP server over stdio', () => {
+  it('a stock SDK client completes the handshake and sees the package version', async () => {
+    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
+    const transport = new StdioClientTransport({
+      command: process.execPath,
+      args: [
+        fileURLToPath(new URL('../bin/design-extract.js', import.meta.url)),
+        'mcp',
+        '--output-dir',
+        mkdtempSync(join(tmpdir(), 'designlang-mcp-')),
+      ],
+    });
+    const client = new Client({ name: 'designlang-test', version: '0.0.0' });
+    await client.connect(transport);
+    try {
+      assert.equal(client.getServerVersion().version, pkg.version);
+      const { tools } = await client.listTools();
+      assert.ok(tools.length >= 5);
+    } finally {
+      await client.close();
+    }
+  });
+});
+
 const tokens = {
   $metadata: { source: 'https://x.com' },
   primitive: { color: { brand: { primary: { $value: '#3b82f6', $type: 'color' } } } },
```

#### Recent Merged Pull Requests:
- **PR #195** (2026-09-29): chore(deps): bump the npm_and_yarn group across 2 directories with 3 updates (@dependabot[bot])
- **PR #194** (2026-09-29): chore(deps-dev): bump fast-uri from 3.1.6 to 3.1.8 in /vscode-extension in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #193** (2026-09-23): fix: live demo hang (screencast deadlocks CSS coverage) — v13.3.2 (@Manavarya09)
- **PR #192** (2026-09-23): fix: 30s networkidle stall, stuck /watch demo — v13.3.1 (@Manavarya09)
- **PR #191** (2026-09-23): ci(release): publish via npm trusted publishing (OIDC) (@Manavarya09)
- **PR #190** (2026-09-23): Phase A: releases, browser install, MCP v2, CI exit codes, benchmark — v13.3.0 (@Manavarya09)
- **PR #189** (2026-09-16): Phase A: releases, install, MCP v2, CI gate, and a reproducible benchmark (@Manavarya09)
- **PR #187** (2026-09-11): chore(deps): bump the npm_and_yarn group across 2 directories with 4 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
